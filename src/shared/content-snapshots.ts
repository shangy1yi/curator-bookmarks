import { CONTENT_SNAPSHOT_LOCAL_TEXT_LIMIT, STORAGE_KEYS } from './constants.js'
import { getLocalStorage, setLocalStorage } from './storage.js'
import { normalizeText } from './text.js'
import type { BookmarkRecord } from './types.js'

export const HEAVY_USER_DB_NAME = 'curatorBookmarkHeavyUserData'
export const HEAVY_USER_DB_VERSION = 2
export const CONTENT_FULL_TEXT_STORE = 'contentFullText'
export const AUTO_BACKUP_STORE = 'autoBackups'

let contentSnapshotIndexWriteQueue: Promise<unknown> = Promise.resolve()
interface ContentFullTextOperations {
  put: (record: ContentFullTextRecord) => Promise<void>
  get: (snapshotId: string) => Promise<string>
  getMany: (snapshotIds: string[]) => Promise<Map<string, string>>
  delete: (snapshotId: string) => Promise<void>
}

let contentFullTextOperations: ContentFullTextOperations = {
  put: putContentFullText,
  get: getContentFullText,
  getMany: getContentFullTexts,
  delete: deleteContentFullText
}

export interface ContentSnapshotSettings {
  version: 1
  enabled: boolean
  autoCaptureOnBookmarkCreate: boolean
  saveFullText: boolean
  fullTextSearchEnabled: boolean
  localOnlyNoAiUpload: boolean
}

export interface ContentSnapshotSourceContext {
  finalUrl?: string
  title?: string
  description?: string
  ogDescription?: string
  canonicalUrl?: string
  headings?: string[]
  mainText?: string
  contentType?: string
  source?: string
  extractionStatus?: string
  contentLength?: number
  warnings?: string[]
}

export interface ContentSnapshotRecord {
  snapshotId: string
  bookmarkId: string
  url: string
  title: string
  summary: string
  headings: string[]
  canonicalUrl: string
  finalUrl: string
  contentType: string
  source: string
  extractionStatus: string
  extractedAt: number
  hasFullText: boolean
  fullTextBytes: number
  fullTextStorage: 'none' | 'local' | 'idb'
  fullText?: string
  fullTextRef?: string
  warnings: string[]
}

export interface ContentSnapshotIndex {
  version: 1
  updatedAt: number
  records: Record<string, ContentSnapshotRecord>
}

export interface ContentFullTextRecord {
  snapshotId: string
  bookmarkId: string
  text: string
  bytes: number
  savedAt: number
}

export const DEFAULT_CONTENT_SNAPSHOT_SETTINGS: ContentSnapshotSettings = {
  version: 1,
  enabled: true,
  autoCaptureOnBookmarkCreate: true,
  saveFullText: true,
  fullTextSearchEnabled: true,
  localOnlyNoAiUpload: false
}

export function normalizeContentSnapshotSettings(raw: unknown): ContentSnapshotSettings {
  const source = normalizeObject(raw)
  return {
    version: 1,
    enabled: source.enabled !== false,
    autoCaptureOnBookmarkCreate: source.autoCaptureOnBookmarkCreate !== false,
    saveFullText: source.saveFullText !== false,
    fullTextSearchEnabled: source.fullTextSearchEnabled !== false,
    localOnlyNoAiUpload: source.localOnlyNoAiUpload === true
  }
}

export function normalizeContentSnapshotIndex(raw: unknown): ContentSnapshotIndex {
  const source = normalizeObject(raw)
  const rawRecords = normalizeObject(source.records)
  const records: Record<string, ContentSnapshotRecord> = {}

  for (const [bookmarkId, value] of Object.entries(rawRecords)) {
    const record = normalizeContentSnapshotRecord(value)
    if (record.bookmarkId && record.snapshotId) {
      records[String(bookmarkId)] = record
    }
  }

  return {
    version: 1,
    updatedAt: Number(source.updatedAt) || 0,
    records
  }
}

export async function loadContentSnapshotSettings(): Promise<ContentSnapshotSettings> {
  const stored = await getLocalStorage([STORAGE_KEYS.contentSnapshotSettings])
  return normalizeContentSnapshotSettings(stored[STORAGE_KEYS.contentSnapshotSettings])
}

export async function saveContentSnapshotSettings(settings: unknown): Promise<ContentSnapshotSettings> {
  const normalized = normalizeContentSnapshotSettings(settings)
  await setLocalStorage({
    [STORAGE_KEYS.contentSnapshotSettings]: normalized
  })
  return normalized
}

export async function loadContentSnapshotIndex(): Promise<ContentSnapshotIndex> {
  const stored = await getLocalStorage([STORAGE_KEYS.contentSnapshotIndex])
  return normalizeContentSnapshotIndex(stored[STORAGE_KEYS.contentSnapshotIndex])
}

export async function saveContentSnapshotFromContext({
  bookmark,
  context,
  settings,
  now = Date.now()
}: {
  bookmark: Pick<BookmarkRecord, 'id' | 'url' | 'title'>
  context: ContentSnapshotSourceContext
  settings?: ContentSnapshotSettings
  now?: number
}): Promise<ContentSnapshotRecord | null> {
  const normalizedSettings = normalizeContentSnapshotSettings(settings)
  if (!normalizedSettings.enabled || !bookmark?.id) {
    return null
  }

  const bookmarkId = String(bookmark.id || '').trim()
  const { record, fullTextRecord } = buildContentSnapshotRecord({
    bookmark,
    context,
    settings: normalizedSettings,
    now
  })

  if (fullTextRecord) {
    await contentFullTextOperations.put(fullTextRecord)
  }
  try {
    await updateContentSnapshotIndex((index) => {
      const previous = index.records[bookmarkId] || null
      if (previous?.fullTextStorage === 'idb' && previous.fullTextRef && previous.fullTextRef !== record.fullTextRef) {
        contentFullTextOperations.delete(previous.fullTextRef).catch(() => {})
      }
      if (!record.hasFullText && previous?.fullTextStorage === 'idb' && previous.fullTextRef) {
        contentFullTextOperations.delete(previous.fullTextRef).catch(() => {})
      }

      return {
        version: 1,
        updatedAt: now,
        records: {
          ...index.records,
          [record.bookmarkId]: record
        }
      }
    })
    return record
  } catch (error) {
    if (fullTextRecord?.snapshotId) {
      await contentFullTextOperations.delete(fullTextRecord.snapshotId).catch(() => {})
    }
    throw error
  }
}

export async function removeContentSnapshotForBookmark(bookmarkId: string, now = Date.now()): Promise<boolean> {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (!normalizedBookmarkId) {
    return false
  }

  let deletedFullTextRef = ''
  let removed = false
  await updateContentSnapshotIndex((index) => {
    const existing = index.records[normalizedBookmarkId] || null
    if (!existing) {
      return index
    }

    if (existing.fullTextStorage === 'idb' && existing.fullTextRef) {
      deletedFullTextRef = existing.fullTextRef
    }
    const records = { ...index.records }
    delete records[normalizedBookmarkId]
    removed = true
    return {
      version: 1,
      updatedAt: now,
      records
    }
  })

  if (deletedFullTextRef) {
    await contentFullTextOperations.delete(deletedFullTextRef).catch(() => {})
  }
  return removed
}

function updateContentSnapshotIndex(
  updater: (index: ContentSnapshotIndex) => ContentSnapshotIndex
): Promise<ContentSnapshotIndex> {
  const task = contentSnapshotIndexWriteQueue.then(async () => {
    const current = await loadContentSnapshotIndex()
    const nextIndex = normalizeContentSnapshotIndex(updater(current))
    await setLocalStorage({
      [STORAGE_KEYS.contentSnapshotIndex]: nextIndex
    })
    return nextIndex
  })

  contentSnapshotIndexWriteQueue = task.catch(() => {})
  return task
}

export function buildContentSnapshotRecord({
  bookmark,
  context,
  settings,
  now = Date.now()
}: {
  bookmark: Pick<BookmarkRecord, 'id' | 'url' | 'title'>
  context: ContentSnapshotSourceContext
  settings?: ContentSnapshotSettings
  now?: number
}): { record: ContentSnapshotRecord; fullTextRecord: ContentFullTextRecord | null } {
  const normalizedSettings = normalizeContentSnapshotSettings(settings)
  const bookmarkId = String(bookmark.id || '').trim()
  const snapshotId = `snapshot-${bookmarkId}-${now}`
  const mainText = cleanText(context.mainText || '')
  const fullTextBytes = estimateTextBytes(mainText)
  const shouldSaveFullText = normalizedSettings.saveFullText && Boolean(mainText)
  const useIndexedDb = shouldSaveFullText && fullTextBytes > CONTENT_SNAPSHOT_LOCAL_TEXT_LIMIT
  const summary = buildSnapshotSummary(context, mainText)

  const record: ContentSnapshotRecord = {
    snapshotId,
    bookmarkId,
    url: String(bookmark.url || '').trim(),
    title: cleanText(context.title || bookmark.title || ''),
    summary,
    headings: normalizeTextList(context.headings, 28, 120),
    canonicalUrl: String(context.canonicalUrl || '').trim(),
    finalUrl: String(context.finalUrl || bookmark.url || '').trim(),
    contentType: cleanText(context.contentType || inferContentTypeLabel(context)),
    source: cleanText(context.source || 'fallback'),
    extractionStatus: cleanText(context.extractionStatus || 'fallback'),
    extractedAt: now,
    hasFullText: shouldSaveFullText,
    fullTextBytes: shouldSaveFullText ? fullTextBytes : 0,
    fullTextStorage: shouldSaveFullText ? (useIndexedDb ? 'idb' : 'local') : 'none',
    fullText: shouldSaveFullText && !useIndexedDb ? mainText : undefined,
    fullTextRef: shouldSaveFullText && useIndexedDb ? snapshotId : undefined,
    warnings: normalizeTextList(context.warnings, 8, 160)
  }

  return {
    record,
    fullTextRecord: shouldSaveFullText && useIndexedDb
      ? {
          snapshotId,
          bookmarkId,
          text: mainText,
          bytes: fullTextBytes,
          savedAt: now
        }
      : null
  }
}

export function buildContentSnapshotSearchText(record: ContentSnapshotRecord | null | undefined, options: { includeFullText?: boolean } = {}): string {
  if (!record) {
    return ''
  }

  return normalizeText([
    record.summary,
    record.contentType,
    record.source,
    record.extractionStatus,
    record.finalUrl,
    record.canonicalUrl,
    ...(record.headings || []),
    options.includeFullText && record.fullTextStorage === 'local' ? record.fullText : ''
  ].join(' '))
}

export function buildContentSnapshotSearchMap(
  index: ContentSnapshotIndex,
  options: { includeFullText?: boolean } = {}
): Map<string, string> {
  const searchMap = new Map<string, string>()
  for (const record of Object.values(index.records)) {
    const text = buildContentSnapshotSearchText(record, options)
    if (text) {
      searchMap.set(record.bookmarkId, text)
    }
  }
  return searchMap
}

export async function buildContentSnapshotSearchMapWithFullText(
  index: ContentSnapshotIndex,
  options: { includeFullText?: boolean; maxRecords?: number } = {}
): Promise<Map<string, string>> {
  const searchMap = buildContentSnapshotSearchMap(index, {
    includeFullText: options.includeFullText
  })
  if (!options.includeFullText) {
    return searchMap
  }

  const maxRecords = Math.max(0, options.maxRecords ?? 600)
  const idbRecords = Object.values(index.records)
    .filter((record) => record.fullTextStorage === 'idb' && record.fullTextRef)
    .slice(0, maxRecords)

  if (!idbRecords.length) {
    return searchMap
  }

  const fullTexts = await contentFullTextOperations.getMany(
    idbRecords.map((record) => record.fullTextRef || '')
  )

  for (const record of idbRecords) {
    const fullText = fullTexts.get(record.fullTextRef || '')
    if (!fullText) {
      continue
    }
    const existing = searchMap.get(record.bookmarkId) || ''
    searchMap.set(record.bookmarkId, normalizeText(`${existing} ${fullText}`))
  }

  return searchMap
}

export async function putContentFullText(record: ContentFullTextRecord): Promise<void> {
  const db = await openHeavyUserDb()
  await runStoreRequest(db, CONTENT_FULL_TEXT_STORE, 'readwrite', (store) => store.put(record))
  db.close()
}

export async function getContentFullText(snapshotId: string): Promise<string> {
  if (!snapshotId) {
    return ''
  }
  const db = await openHeavyUserDb()
  const record = await runStoreValueRequest<ContentFullTextRecord | undefined>(
    db,
    CONTENT_FULL_TEXT_STORE,
    'readonly',
    (store) => store.get(snapshotId)
  )
  db.close()
  return cleanText(record?.text || '')
}

export async function getContentFullTexts(snapshotIds: string[]): Promise<Map<string, string>> {
  const uniqueSnapshotIds = Array.from(new Set(
    snapshotIds
      .map((snapshotId) => String(snapshotId || '').trim())
      .filter(Boolean)
  ))
  const fullTexts = new Map<string, string>()
  if (!uniqueSnapshotIds.length) {
    return fullTexts
  }

  const db = await openHeavyUserDb()
  try {
    await runStoreValueBatchRequest<ContentFullTextRecord | undefined>(
      db,
      CONTENT_FULL_TEXT_STORE,
      uniqueSnapshotIds,
      (store, snapshotId) => store.get(snapshotId),
      (snapshotId, record) => {
        const text = cleanText(record?.text || '')
        if (text) {
          fullTexts.set(snapshotId, text)
        }
      }
    )
    return fullTexts
  } finally {
    db.close()
  }
}

export async function deleteContentFullText(snapshotId: string): Promise<void> {
  if (!snapshotId) {
    return
  }
  const db = await openHeavyUserDb()
  await runStoreRequest(db, CONTENT_FULL_TEXT_STORE, 'readwrite', (store) => store.delete(snapshotId))
  db.close()
}

export function setContentFullTextOperationsForTest(
  operations: Partial<typeof contentFullTextOperations>
): () => void {
  const previous = contentFullTextOperations
  const nextOperations = {
    ...contentFullTextOperations,
    ...operations
  }
  if (operations.get && !operations.getMany) {
    nextOperations.getMany = (snapshotIds: string[]) => getContentFullTextsWithSingleReads(snapshotIds, nextOperations.get)
  }
  contentFullTextOperations = nextOperations
  return () => {
    contentFullTextOperations = previous
  }
}

export function estimateTextBytes(value: unknown): number {
  const text = String(value || '')
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length
  }
  return text.length
}

async function getContentFullTextsWithSingleReads(
  snapshotIds: string[],
  getFullText: (snapshotId: string) => Promise<string>
): Promise<Map<string, string>> {
  const fullTexts = new Map<string, string>()
  for (const snapshotId of snapshotIds) {
    const fullText = await getFullText(snapshotId).catch(() => '')
    if (fullText) {
      fullTexts.set(snapshotId, fullText)
    }
  }
  return fullTexts
}

function normalizeContentSnapshotRecord(raw: unknown): ContentSnapshotRecord {
  const source = normalizeObject(raw)
  const fullTextStorage = ['local', 'idb'].includes(String(source.fullTextStorage))
    ? String(source.fullTextStorage) as ContentSnapshotRecord['fullTextStorage']
    : 'none'
  return {
    snapshotId: String(source.snapshotId || '').trim(),
    bookmarkId: String(source.bookmarkId || '').trim(),
    url: String(source.url || '').trim(),
    title: cleanText(source.title || ''),
    summary: cleanText(source.summary || ''),
    headings: normalizeTextList(source.headings, 28, 120),
    canonicalUrl: String(source.canonicalUrl || '').trim(),
    finalUrl: String(source.finalUrl || '').trim(),
    contentType: cleanText(source.contentType || ''),
    source: cleanText(source.source || ''),
    extractionStatus: cleanText(source.extractionStatus || ''),
    extractedAt: Number(source.extractedAt) || 0,
    hasFullText: source.hasFullText === true,
    fullTextBytes: Number(source.fullTextBytes) || 0,
    fullTextStorage,
    fullText: fullTextStorage === 'local' ? cleanText(source.fullText || '') : undefined,
    fullTextRef: fullTextStorage === 'idb' ? String(source.fullTextRef || source.snapshotId || '').trim() : undefined,
    warnings: normalizeTextList(source.warnings, 8, 160)
  }
}

function buildSnapshotSummary(context: ContentSnapshotSourceContext, mainText: string): string {
  return truncateCleanText(
    context.description ||
      context.ogDescription ||
      mainText ||
      context.title ||
      '',
    700
  )
}

function inferContentTypeLabel(context: ContentSnapshotSourceContext): string {
  const source = String(context.source || '').toLowerCase()
  if (source === 'pdf') {
    return 'PDF'
  }
  if (source === 'github') {
    return 'GitHub README / 仓库'
  }
  if (source === 'youtube') {
    return 'YouTube 描述'
  }
  if (source === 'docs') {
    return '文档页'
  }
  return ''
}

function cleanText(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function truncateCleanText(value: unknown, limit: number): string {
  const text = cleanText(value)
  return text.length > limit ? text.slice(0, limit).trim() : text
}

function normalizeTextList(values: unknown, limit: number, itemLimit: number): string[] {
  const items = Array.isArray(values) ? values : []
  const seen = new Set<string>()
  const output: string[] = []
  for (const item of items) {
    const text = truncateCleanText(item, itemLimit)
    const key = normalizeText(text)
    if (!text || seen.has(key)) {
      continue
    }
    seen.add(key)
    output.push(text)
    if (output.length >= limit) {
      break
    }
  }
  return output
}

function normalizeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function openHeavyUserDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HEAVY_USER_DB_NAME, HEAVY_USER_DB_VERSION)
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
    request.addEventListener('error', () => reject(request.error || new Error('无法打开全文索引数据库。')))
  })
}

function runStoreRequest(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    createRequest(store)
    transaction.addEventListener('complete', () => resolve())
    transaction.addEventListener('error', () => reject(transaction.error || new Error('全文索引存储失败。')))
    transaction.addEventListener('abort', () => reject(transaction.error || new Error('全文索引存储中断。')))
  })
}

function runStoreValueRequest<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    const request = createRequest(store)
    transaction.addEventListener('complete', () => resolve(request.result as T))
    transaction.addEventListener('error', () => reject(transaction.error || new Error('全文索引读取失败。')))
    transaction.addEventListener('abort', () => reject(transaction.error || new Error('全文索引读取中断。')))
  })
}

function runStoreValueBatchRequest<T>(
  db: IDBDatabase,
  storeName: string,
  snapshotIds: string[],
  createRequest: (store: IDBObjectStore, snapshotId: string) => IDBRequest,
  handleValue: (snapshotId: string, value: T) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)

    for (const snapshotId of snapshotIds) {
      let request: IDBRequest
      try {
        request = createRequest(store, snapshotId)
      } catch {
        continue
      }
      request.addEventListener('success', () => {
        handleValue(snapshotId, request.result as T)
      })
      request.addEventListener('error', (event) => {
        // Skip a bad record without letting one request abort the whole readonly batch.
        event.preventDefault()
        event.stopPropagation()
      })
    }

    transaction.addEventListener('complete', () => resolve())
    transaction.addEventListener('error', () => reject(transaction.error || new Error('全文索引读取失败。')))
    transaction.addEventListener('abort', () => reject(transaction.error || new Error('全文索引读取中断。')))
  })
}
