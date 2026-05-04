import {
  AUTO_BACKUP_RETENTION_LIMIT,
  BOOKMARKS_BAR_ID,
  STORAGE_KEYS
} from './constants.js'
import { getBookmarkTree, createBookmark } from './bookmarks-api.js'
import { extractBookmarkData } from './bookmark-tree.js'
import {
  buildBookmarkTagDuplicateKey,
  mergeBookmarkTagImport,
  normalizeBookmarkTagIndex,
  normalizeBookmarkTagUrl,
  saveBookmarkTagIndex,
  type BookmarkTagIndex
} from './bookmark-tags.js'
import { getLocalStorage, setLocalStorage } from './storage.js'

const BACKUP_SCHEMA_VERSION = 1
const BACKUP_APP = 'curator-bookmarks'
const BACKUP_KIND = 'full-backup'
const AUTO_BACKUP_DB_NAME = 'curatorBookmarkHeavyUserData'
const AUTO_BACKUP_DB_VERSION = 2
const AUTO_BACKUP_STORE = 'autoBackups'
const CONTENT_FULL_TEXT_STORE = 'contentFullText'

export type DangerousOperationKind =
  | 'batch-delete'
  | 'batch-move'
  | 'duplicate-cleanup'
  | 'availability-cleanup'
  | 'folder-cleanup-delete'
  | 'folder-cleanup-merge'
  | 'folder-cleanup-move'
  | 'redirect-url-update'
  | 'batch-tag-update'
  | 'restore'

export type BackupRestoreMode = 'tagsOnly' | 'newTabOnly' | 'safeFull'

export interface AutoBackupBeforeDangerousOperationOptions {
  kind: DangerousOperationKind
  source: 'options' | 'popup' | 'newtab' | 'service-worker'
  reason: string
  targetBookmarkIds?: string[]
  targetFolderIds?: string[]
  estimatedChangeCount?: number
  retentionLimit?: number
  now?: number
}

export interface AutoBackupHookResult {
  backupId: string
  fileName: string
  createdAt: number
  skipped: boolean
  reason?: string
  sizeBytes?: number
}

export interface AutoBackupIndexEntry extends AutoBackupHookResult {
  kind: DangerousOperationKind
  source: AutoBackupBeforeDangerousOperationOptions['source']
  operationReason: string
}

export interface CuratorBackupFileV1 {
  app: 'curator-bookmarks'
  kind: 'full-backup'
  schemaVersion: 1
  exportedAt: string
  extensionVersion: string
  manifestVersion: 3
  source: 'manual' | 'auto'
  redaction: {
    aiProviderSettings: 'apiKey-omitted'
    omittedFields: ['apiKey']
  }
  chromeBookmarks: {
    exportedAt: string
    tree: chrome.bookmarks.BookmarkTreeNode[]
  }
  storage: {
    bookmarkTagIndex: BookmarkTagIndex
    recycleBin: unknown[]
    ignoreRules: {
      bookmarks: unknown[]
      domains: unknown[]
      folders: unknown[]
    }
    redirectCache: unknown
    newTab: Record<string, unknown>
    popupPreferences?: unknown
    aiProviderSettings: Record<string, unknown> & {
      apiKeyRedacted: true
    }
  }
  notes?: string[]
}

export interface BackupRestorePreview {
  valid: boolean
  fileName?: string
  exportedAt: string
  extensionVersion: string
  counts: {
    bookmarkNodes: number
    bookmarkUrls: number
    missingBookmarkUrls: number
    tagRecords: number
    tagMatched: number
    tagUnmatched: number
    recycleEntries: number
    ignoreRules: number
    redirectEntries: number
    newTabSections: number
  }
  warnings: string[]
  modes: Array<{
    mode: BackupRestoreMode
    label: string
    description: string
  }>
}

export interface BackupRestoreResult {
  mode: BackupRestoreMode
  restored: {
    tags: number
    newTabSections: number
    storageSections: number
    copiedBookmarks: number
  }
  unmatchedTags: number
  skippedBookmarks: number
}

export async function createCuratorBackupFile(
  source: 'manual' | 'auto' = 'manual',
  now = Date.now()
): Promise<CuratorBackupFileV1> {
  const exportedAt = new Date(now).toISOString()
  const tree = await getBookmarkTree()
  const stored = await getBackupStorageSnapshot()

  return {
    app: BACKUP_APP,
    kind: BACKUP_KIND,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    extensionVersion: getExtensionVersion(),
    manifestVersion: 3,
    source,
    redaction: {
      aiProviderSettings: 'apiKey-omitted',
      omittedFields: ['apiKey']
    },
    chromeBookmarks: {
      exportedAt,
      tree
    },
    storage: {
      bookmarkTagIndex: normalizeBookmarkTagIndex(stored[STORAGE_KEYS.bookmarkTagIndex]),
      recycleBin: normalizeUnknownArray(stored[STORAGE_KEYS.recycleBin]),
      ignoreRules: normalizeIgnoreRulesForBackup(stored[STORAGE_KEYS.ignoreRules]),
      redirectCache: stored[STORAGE_KEYS.redirectCache] ?? null,
      newTab: {
        customIcons: stored[STORAGE_KEYS.newTabCustomIcons] ?? null,
        backgroundSettings: stored[STORAGE_KEYS.newTabBackgroundSettings] ?? null,
        searchSettings: stored[STORAGE_KEYS.newTabSearchSettings] ?? null,
        iconSettings: stored[STORAGE_KEYS.newTabIconSettings] ?? null,
        faviconAccentCache: stored[STORAGE_KEYS.newTabFaviconAccentCache] ?? null,
        timeSettings: stored[STORAGE_KEYS.newTabTimeSettings] ?? null,
        generalSettings: stored[STORAGE_KEYS.newTabGeneralSettings] ?? null,
        folderSettings: stored[STORAGE_KEYS.newTabFolderSettings] ?? null,
        activity: stored[STORAGE_KEYS.newTabActivity] ?? null
      },
      popupPreferences: stored[STORAGE_KEYS.popupPreferences] ?? null,
      aiProviderSettings: redactAiProviderSettings(stored[STORAGE_KEYS.aiProviderSettings])
    },
    notes: [
      'AI Provider API Key is intentionally omitted.',
      'New tab background media blobs in IndexedDB are not included.'
    ]
  }
}

export function getBackupFileName(now = Date.now()): string {
  return `curator-backup-${new Date(now).toISOString().slice(0, 10)}.json`
}

export function parseCuratorBackupFile(payload: unknown): CuratorBackupFileV1 {
  const source = payload && typeof payload === 'object'
    ? payload as Partial<CuratorBackupFileV1>
    : {}
  if (
    source.app !== BACKUP_APP ||
    source.kind !== BACKUP_KIND ||
    source.schemaVersion !== BACKUP_SCHEMA_VERSION ||
    !source.storage ||
    !source.chromeBookmarks
  ) {
    throw new Error('备份文件格式不正确，无法恢复。')
  }

  return {
    app: BACKUP_APP,
    kind: BACKUP_KIND,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: String(source.exportedAt || ''),
    extensionVersion: String(source.extensionVersion || ''),
    manifestVersion: 3,
    source: source.source === 'auto' ? 'auto' : 'manual',
    redaction: {
      aiProviderSettings: 'apiKey-omitted',
      omittedFields: ['apiKey']
    },
    chromeBookmarks: {
      exportedAt: String(source.chromeBookmarks.exportedAt || source.exportedAt || ''),
      tree: Array.isArray(source.chromeBookmarks.tree) ? source.chromeBookmarks.tree : []
    },
    storage: {
      bookmarkTagIndex: normalizeBookmarkTagIndex(source.storage.bookmarkTagIndex),
      recycleBin: normalizeUnknownArray(source.storage.recycleBin),
      ignoreRules: normalizeIgnoreRulesForBackup(source.storage.ignoreRules),
      redirectCache: source.storage.redirectCache ?? null,
      newTab: normalizeObject(source.storage.newTab),
      popupPreferences: source.storage.popupPreferences ?? null,
      aiProviderSettings: redactAiProviderSettings(source.storage.aiProviderSettings)
    },
    notes: Array.isArray(source.notes) ? source.notes.map((note) => String(note)) : []
  }
}

export async function buildBackupRestorePreview(
  backup: CuratorBackupFileV1,
  fileName = ''
): Promise<BackupRestorePreview> {
  const currentTree = await getBookmarkTree()
  const currentData = extractBookmarkData(currentTree[0])
  const backupBookmarks = extractBackupBookmarkNodes(backup.chromeBookmarks.tree)
  const currentInstances = new Set(
    currentData.bookmarks.map((bookmark) => buildBookmarkInstanceKey(bookmark.url, bookmark.path || ''))
  )
  const missingBookmarkUrls = extractBackupBookmarkInstances(backup.chromeBookmarks.tree).filter((instance) => {
    return !currentInstances.has(buildBookmarkInstanceKey(instance.url, instance.path))
  }).length
  const tagRecords = Object.values(backup.storage.bookmarkTagIndex.records)
  const matchedTags = tagRecords.filter((record) => {
    return currentData.bookmarkMap.has(record.bookmarkId) ||
      currentData.bookmarks.some((bookmark) => {
        return normalizeBookmarkTagUrl(bookmark.url) === record.normalizedUrl ||
          buildBookmarkTagDuplicateKey(bookmark.url) === record.duplicateKey
      })
  }).length

  const warnings: string[] = []
  if (hasApiKeyLikeField(backup)) {
    warnings.push('备份文件中出现疑似 API Key 字段，恢复会忽略这些字段。')
  }
  if (missingBookmarkUrls) {
    warnings.push(`有 ${missingBookmarkUrls} 条备份书签实例当前不存在；完整恢复会复制到新的恢复文件夹。`)
  }
  warnings.push('完整恢复会覆盖回收站、忽略规则、重定向缓存和弹窗偏好等集合类本地数据；不会覆盖 Chrome 现有书签树。')

  return {
    valid: true,
    fileName,
    exportedAt: backup.exportedAt,
    extensionVersion: backup.extensionVersion,
    counts: {
      bookmarkNodes: countBookmarkNodes(backup.chromeBookmarks.tree),
      bookmarkUrls: backupBookmarks.filter((node) => Boolean(node.url)).length,
      missingBookmarkUrls,
      tagRecords: tagRecords.length,
      tagMatched: matchedTags,
      tagUnmatched: tagRecords.length - matchedTags,
      recycleEntries: backup.storage.recycleBin.length,
      ignoreRules: countIgnoreRules(backup.storage.ignoreRules),
      redirectEntries: countRedirectEntries(backup.storage.redirectCache),
      newTabSections: countPresentObjectValues(backup.storage.newTab)
    },
    warnings,
    modes: [
      {
        mode: 'tagsOnly',
        label: '只恢复标签数据',
        description: '按书签 ID、规范 URL 和重复键匹配当前书签，不改动 Chrome 书签。'
      },
      {
        mode: 'newTabOnly',
        label: '只恢复新标签页设置',
        description: '恢复书签来源、布局、搜索、时间和背景设置；不恢复背景媒体缓存。'
      },
      {
        mode: 'safeFull',
        label: '恢复全部可安全恢复的数据',
        description: '恢复扩展本地数据并覆盖集合类本地记录；缺失书签按 URL 和路径实例复制到新的恢复文件夹，不替换现有书签树。'
      }
    ]
  }
}

export async function restoreCuratorBackup(
  backup: CuratorBackupFileV1,
  mode: BackupRestoreMode
): Promise<BackupRestoreResult> {
  const currentTree = await getBookmarkTree()
  const currentData = extractBookmarkData(currentTree[0])
  const result: BackupRestoreResult = {
    mode,
    restored: {
      tags: 0,
      newTabSections: 0,
      storageSections: 0,
      copiedBookmarks: 0
    },
    unmatchedTags: 0,
    skippedBookmarks: 0
  }

  if (mode === 'tagsOnly' || mode === 'safeFull') {
    const currentIndex = normalizeBookmarkTagIndex(
      (await getLocalStorage([STORAGE_KEYS.bookmarkTagIndex]))[STORAGE_KEYS.bookmarkTagIndex]
    )
    const tagImport = mergeBookmarkTagImport(currentIndex, {
      records: Object.values(backup.storage.bookmarkTagIndex.records)
    }, currentData.bookmarks)
    await saveBookmarkTagIndex(tagImport.index)
    result.restored.tags = tagImport.added + tagImport.overwritten
    result.unmatchedTags = tagImport.unmatched
  }

  if (mode === 'newTabOnly' || mode === 'safeFull') {
    const newTabPayload = buildNewTabStoragePayload(backup.storage.newTab)
    if (Object.keys(newTabPayload).length) {
      await setLocalStorage(newTabPayload)
      result.restored.newTabSections = Object.keys(newTabPayload).length
    }
  }

  if (mode === 'safeFull') {
    const currentAiSettings = (await getLocalStorage([STORAGE_KEYS.aiProviderSettings]))[STORAGE_KEYS.aiProviderSettings]
    const localPayload: Record<string, unknown> = {
      [STORAGE_KEYS.recycleBin]: backup.storage.recycleBin,
      [STORAGE_KEYS.ignoreRules]: backup.storage.ignoreRules,
      [STORAGE_KEYS.redirectCache]: backup.storage.redirectCache,
      [STORAGE_KEYS.popupPreferences]: backup.storage.popupPreferences
    }
    localPayload[STORAGE_KEYS.aiProviderSettings] = mergeRestoredAiProviderSettings(
      currentAiSettings,
      backup.storage.aiProviderSettings
    )
    await setLocalStorage(localPayload)
    result.restored.storageSections = Object.keys(localPayload).length

    const copyResult = await copyMissingBookmarksToRestoreFolder(backup, currentData.bookmarks)
    result.restored.copiedBookmarks = copyResult.copied
    result.skippedBookmarks = copyResult.skipped
  }

  return result
}

export async function createAutoBackupBeforeDangerousOperation(
  options: AutoBackupBeforeDangerousOperationOptions
): Promise<AutoBackupHookResult> {
  const createdAt = options.now ?? Date.now()
  const retentionLimit = Math.max(1, options.retentionLimit ?? AUTO_BACKUP_RETENTION_LIMIT)

  try {
    const backup = await createCuratorBackupFile('auto', createdAt)
    const backupId = `auto-${createdAt}-${Math.random().toString(36).slice(2, 8)}`
    const fileName = getBackupFileName(createdAt)
    const sizeBytes = estimateJsonSizeBytes(backup)
    await putAutoBackup({
      backupId,
      createdAt,
      fileName,
      kind: options.kind,
      source: options.source,
      operationReason: options.reason,
      targetBookmarkIds: options.targetBookmarkIds || [],
      targetFolderIds: options.targetFolderIds || [],
      estimatedChangeCount: options.estimatedChangeCount || 0,
      payload: backup
    })
    const { pruned } = await updateAutoBackupIndex({
      backupId,
      fileName,
      createdAt,
      skipped: false,
      sizeBytes,
      kind: options.kind,
      source: options.source,
      operationReason: options.reason
    }, retentionLimit)
    await pruneAutoBackups(pruned)

    return {
      backupId,
      fileName,
      createdAt,
      skipped: false,
      sizeBytes
    }
  } catch (error) {
    return {
      backupId: `failed-${createdAt}`,
      fileName: '',
      createdAt,
      skipped: true,
      reason: error instanceof Error ? error.message : '自动备份失败'
    }
  }
}

async function getBackupStorageSnapshot(): Promise<Record<string, unknown>> {
  return getLocalStorage([
    STORAGE_KEYS.bookmarkTagIndex,
    STORAGE_KEYS.recycleBin,
    STORAGE_KEYS.ignoreRules,
    STORAGE_KEYS.redirectCache,
    STORAGE_KEYS.newTabCustomIcons,
    STORAGE_KEYS.newTabBackgroundSettings,
    STORAGE_KEYS.newTabSearchSettings,
    STORAGE_KEYS.newTabIconSettings,
    STORAGE_KEYS.newTabFaviconAccentCache,
    STORAGE_KEYS.newTabTimeSettings,
    STORAGE_KEYS.newTabGeneralSettings,
    STORAGE_KEYS.newTabFolderSettings,
    STORAGE_KEYS.newTabActivity,
    STORAGE_KEYS.popupPreferences,
    STORAGE_KEYS.aiProviderSettings
  ])
}

function getExtensionVersion(): string {
  try {
    return chrome.runtime.getManifest().version || ''
  } catch {
    return ''
  }
}

function redactAiProviderSettings(rawSettings: unknown): Record<string, unknown> & { apiKeyRedacted: true } {
  const source = normalizeObject(rawSettings)
  const { apiKey: _apiKey, api_key: _apiKeySnake, key: _key, token: _token, ...safeSettings } = source
  return {
    ...safeSettings,
    apiKeyRedacted: true
  }
}

function normalizeIgnoreRulesForBackup(rawRules: unknown): CuratorBackupFileV1['storage']['ignoreRules'] {
  const source = normalizeObject(rawRules)
  return {
    bookmarks: normalizeUnknownArray(source.bookmarks),
    domains: normalizeUnknownArray(source.domains),
    folders: normalizeUnknownArray(source.folders)
  }
}

function buildNewTabStoragePayload(newTab: Record<string, unknown>): Record<string, unknown> {
  const mapping: Array<[string, string]> = [
    ['customIcons', STORAGE_KEYS.newTabCustomIcons],
    ['backgroundSettings', STORAGE_KEYS.newTabBackgroundSettings],
    ['searchSettings', STORAGE_KEYS.newTabSearchSettings],
    ['iconSettings', STORAGE_KEYS.newTabIconSettings],
    ['faviconAccentCache', STORAGE_KEYS.newTabFaviconAccentCache],
    ['timeSettings', STORAGE_KEYS.newTabTimeSettings],
    ['generalSettings', STORAGE_KEYS.newTabGeneralSettings],
    ['folderSettings', STORAGE_KEYS.newTabFolderSettings],
    ['activity', STORAGE_KEYS.newTabActivity]
  ]
  const payload: Record<string, unknown> = {}
  for (const [field, storageKey] of mapping) {
    if (newTab[field] !== undefined && newTab[field] !== null) {
      payload[storageKey] = newTab[field]
    }
  }
  return payload
}

async function copyMissingBookmarksToRestoreFolder(
  backup: CuratorBackupFileV1,
  currentBookmarks: Array<{ url: string; path?: string }>
): Promise<{ copied: number; skipped: number }> {
  const knownInstances = new Set(
    currentBookmarks.map((bookmark) => buildBookmarkInstanceKey(bookmark.url, bookmark.path || ''))
  )
  const rootChildren = backup.chromeBookmarks.tree.flatMap((node) => node.children || [])
  const missingCount = extractBackupBookmarkInstances(backup.chromeBookmarks.tree)
    .filter((instance) => !knownInstances.has(buildBookmarkInstanceKey(instance.url, instance.path)))
    .length

  if (!missingCount) {
    return { copied: 0, skipped: 0 }
  }

  const restoreFolder = await createBookmark({
    parentId: BOOKMARKS_BAR_ID,
    title: `Curator Restore ${new Date().toISOString().slice(0, 10)}`
  })
  let copied = 0
  let skipped = 0

  for (const child of rootChildren) {
    const result = await copyMissingNode(child, String(restoreFolder.id), knownInstances, '')
    copied += result.copied
    skipped += result.skipped
  }

  return { copied, skipped }
}

async function copyMissingNode(
  node: chrome.bookmarks.BookmarkTreeNode,
  parentId: string,
  knownInstances: Set<string>,
  folderPath: string
): Promise<{ copied: number; skipped: number }> {
  if (node.url) {
    const instanceKey = buildBookmarkInstanceKey(node.url, folderPath)
    if (knownInstances.has(instanceKey)) {
      return { copied: 0, skipped: 1 }
    }
    await createBookmark({
      parentId,
      title: node.title || node.url,
      url: node.url
    })
    knownInstances.add(instanceKey)
    return { copied: 1, skipped: 0 }
  }

  const children = node.children || []
  const nextFolderPath = buildChildFolderPath(folderPath, node.title)
  if (!children.some((child) => nodeHasMissingBookmark(child, knownInstances, nextFolderPath))) {
    return { copied: 0, skipped: children.length }
  }

  let folder: chrome.bookmarks.BookmarkTreeNode | null = null
  let copied = 0
  let skipped = 0
  for (const child of children) {
    if (!folder) {
      folder = await createBookmark({
        parentId,
        title: node.title || '未命名文件夹'
      })
    }
    const result = await copyMissingNode(child, String(folder.id), knownInstances, nextFolderPath)
    copied += result.copied
    skipped += result.skipped
  }
  return { copied, skipped }
}

function nodeHasMissingBookmark(
  node: chrome.bookmarks.BookmarkTreeNode,
  knownInstances: Set<string>,
  folderPath: string
): boolean {
  if (node.url) {
    return !knownInstances.has(buildBookmarkInstanceKey(node.url, folderPath))
  }
  const nextFolderPath = buildChildFolderPath(folderPath, node.title)
  return (node.children || []).some((child) => nodeHasMissingBookmark(child, knownInstances, nextFolderPath))
}

function extractBackupBookmarkNodes(tree: chrome.bookmarks.BookmarkTreeNode[]): chrome.bookmarks.BookmarkTreeNode[] {
  const output: chrome.bookmarks.BookmarkTreeNode[] = []
  const visit = (node: chrome.bookmarks.BookmarkTreeNode) => {
    output.push(node)
    for (const child of node.children || []) {
      visit(child)
    }
  }
  tree.forEach(visit)
  return output
}

function extractBackupBookmarkInstances(tree: chrome.bookmarks.BookmarkTreeNode[]): Array<{ url: string; path: string }> {
  const output: Array<{ url: string; path: string }> = []
  const visit = (node: chrome.bookmarks.BookmarkTreeNode, folderPath = '') => {
    if (node.url) {
      output.push({
        url: node.url,
        path: folderPath
      })
      return
    }
    const nextFolderPath = buildChildFolderPath(folderPath, node.title)
    for (const child of node.children || []) {
      visit(child, nextFolderPath)
    }
  }
  for (const root of tree) {
    for (const child of root.children || []) {
      visit(child, '')
    }
  }
  return output
}

function countBookmarkNodes(tree: chrome.bookmarks.BookmarkTreeNode[]): number {
  return extractBackupBookmarkNodes(tree).length
}

function countIgnoreRules(rules: CuratorBackupFileV1['storage']['ignoreRules']): number {
  return rules.bookmarks.length + rules.domains.length + rules.folders.length
}

function countRedirectEntries(cache: unknown): number {
  const source = normalizeObject(cache)
  return Array.isArray(source.results) ? source.results.length : 0
}

function countPresentObjectValues(value: Record<string, unknown>): number {
  return Object.values(value).filter((item) => item !== undefined && item !== null).length
}

function hasApiKeyLikeField(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false
  }
  if (Array.isArray(value)) {
    return value.some((item) => hasApiKeyLikeField(item))
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase()
    if (normalizedKey === 'apikey' || normalizedKey === 'api_key') {
      return true
    }
    if (hasApiKeyLikeField(child)) {
      return true
    }
  }
  return false
}

function normalizeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function normalizeUnknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function estimateJsonSizeBytes(value: unknown): number {
  const json = JSON.stringify(value)
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(json).length
  }
  return json.length
}

function mergeRestoredAiProviderSettings(currentSettings: unknown, backupSettings: unknown): Record<string, unknown> {
  const current = normalizeObject(currentSettings)
  const safeBackupSettings = redactAiProviderSettings(backupSettings)
  const { apiKeyRedacted: _apiKeyRedacted, ...backupSafeFields } = safeBackupSettings
  return {
    ...current,
    ...backupSafeFields
  }
}

function buildChildFolderPath(parentPath: string, title: unknown): string {
  const segment = String(title || '').trim()
  if (!segment) {
    return parentPath
  }
  return parentPath ? `${parentPath} / ${segment}` : segment
}

function buildBookmarkInstanceKey(url: string, path: string): string {
  return `${normalizeBookmarkTagUrl(url)}\n${normalizePathKey(path)}`
}

function normalizePathKey(path: string): string {
  return String(path || '').replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ').trim().toLowerCase()
}

function openAutoBackupDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AUTO_BACKUP_DB_NAME, AUTO_BACKUP_DB_VERSION)
    request.addEventListener('upgradeneeded', () => {
      const db = request.result
      if (!db.objectStoreNames.contains(AUTO_BACKUP_STORE)) {
        db.createObjectStore(AUTO_BACKUP_STORE, { keyPath: 'backupId' })
      }
      if (!db.objectStoreNames.contains(CONTENT_FULL_TEXT_STORE)) {
        db.createObjectStore(CONTENT_FULL_TEXT_STORE, { keyPath: 'snapshotId' })
      }
    })
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () => reject(request.error || new Error('无法打开自动备份数据库。')))
  })
}

async function putAutoBackup(record: Record<string, unknown>): Promise<void> {
  const db = await openAutoBackupDb()
  await runAutoBackupStoreRequest(db, 'readwrite', (store) => store.put(record))
  db.close()
}

async function deleteAutoBackup(backupId: string): Promise<void> {
  const db = await openAutoBackupDb()
  await runAutoBackupStoreRequest(db, 'readwrite', (store) => store.delete(backupId))
  db.close()
}

function runAutoBackupStoreRequest(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AUTO_BACKUP_STORE, mode)
    const store = transaction.objectStore(AUTO_BACKUP_STORE)
    createRequest(store)
    transaction.addEventListener('complete', () => resolve())
    transaction.addEventListener('error', () => reject(transaction.error || new Error('自动备份存储失败。')))
    transaction.addEventListener('abort', () => reject(transaction.error || new Error('自动备份存储中断。')))
  })
}

async function updateAutoBackupIndex(
  entry: AutoBackupIndexEntry,
  retentionLimit: number
): Promise<{ kept: AutoBackupIndexEntry[]; pruned: AutoBackupIndexEntry[] }> {
  const stored = await getLocalStorage([STORAGE_KEYS.autoBackupIndex])
  const current = Array.isArray(stored[STORAGE_KEYS.autoBackupIndex])
    ? stored[STORAGE_KEYS.autoBackupIndex] as AutoBackupIndexEntry[]
    : []
  const sorted = [entry, ...current]
    .filter((item) => item && typeof item.backupId === 'string')
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
  const kept = sorted.slice(0, retentionLimit)
  const pruned = sorted.slice(retentionLimit)

  await setLocalStorage({
    [STORAGE_KEYS.autoBackupIndex]: kept
  })
  return { kept, pruned }
}

async function pruneAutoBackups(prunedEntries: AutoBackupIndexEntry[]): Promise<void> {
  await Promise.all(
    prunedEntries
      .filter((entry) => entry?.backupId)
      .map((entry) => deleteAutoBackup(entry.backupId))
  )
}
