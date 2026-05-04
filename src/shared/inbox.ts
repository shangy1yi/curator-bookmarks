import {
  BOOKMARKS_BAR_ID,
  DEFAULT_INBOX_FOLDER_TITLE,
  INBOX_AUTO_MOVE_MIN_CONFIDENCE,
  STORAGE_KEYS
} from './constants.js'
import { getLocalStorage, setLocalStorage } from './storage.js'

export const INBOX_UNDO_MOVE_WINDOW_MS = 10 * 60 * 1000
export { DEFAULT_INBOX_FOLDER_TITLE } from './constants.js'

export interface InboxSettings {
  version: 1
  enabled: boolean
  folderTitle: string
  autoMoveToRecommendedFolder: boolean
  tagOnlyNoAutoMove: boolean
  minAutoMoveConfidence: number
  notifyOnClassified: boolean
}

export type InboxItemStatus =
  | 'captured'
  | 'analyzing'
  | 'tagged'
  | 'moved'
  | 'needs-review'
  | 'failed'
  | 'undone'

export interface InboxItem {
  captureId: string
  bookmarkId: string
  url: string
  title: string
  inboxFolderId: string
  originalParentId: string
  recommendedFolderId?: string
  recommendedFolderPath?: string
  confidence?: number
  status: InboxItemStatus
  createdAt: number
  updatedAt: number
  lastError?: string
}

export interface InboxUndoMove {
  bookmarkId: string
  fromFolderId: string
  toFolderId: string
  movedAt: number
  expiresAt: number
}

export interface InboxState {
  version: 1
  folderId: string
  items: InboxItem[]
  lastUndoMove?: InboxUndoMove
}

let inboxStateWriteQueue: Promise<unknown> = Promise.resolve()

export function getDefaultInboxSettings(): InboxSettings {
  return {
    version: 1,
    enabled: true,
    folderTitle: DEFAULT_INBOX_FOLDER_TITLE,
    autoMoveToRecommendedFolder: true,
    tagOnlyNoAutoMove: false,
    minAutoMoveConfidence: INBOX_AUTO_MOVE_MIN_CONFIDENCE,
    notifyOnClassified: true
  }
}

export function normalizeInboxSettings(rawSettings: unknown): InboxSettings {
  const defaults = getDefaultInboxSettings()
  const source = rawSettings && typeof rawSettings === 'object'
    ? rawSettings as Record<string, unknown>
    : {}
  const folderTitle = cleanInboxText(source.folderTitle) || defaults.folderTitle
  const tagOnlyNoAutoMove = Boolean(source.tagOnlyNoAutoMove)

  return {
    version: 1,
    enabled: typeof source.enabled === 'boolean' ? source.enabled : defaults.enabled,
    folderTitle,
    autoMoveToRecommendedFolder: tagOnlyNoAutoMove
      ? false
      : typeof source.autoMoveToRecommendedFolder === 'boolean'
        ? source.autoMoveToRecommendedFolder
        : defaults.autoMoveToRecommendedFolder,
    tagOnlyNoAutoMove,
    minAutoMoveConfidence: clampInboxConfidence(source.minAutoMoveConfidence, defaults.minAutoMoveConfidence),
    notifyOnClassified: typeof source.notifyOnClassified === 'boolean'
      ? source.notifyOnClassified
      : defaults.notifyOnClassified
  }
}

export async function loadInboxSettings(): Promise<InboxSettings> {
  const stored = await getLocalStorage([STORAGE_KEYS.inboxSettings])
  return normalizeInboxSettings(stored[STORAGE_KEYS.inboxSettings])
}

export async function saveInboxSettings(settings: Partial<InboxSettings>): Promise<InboxSettings> {
  const current = await loadInboxSettings()
  const nextSettings = normalizeInboxSettings({
    ...current,
    ...settings
  })
  await setLocalStorage({
    [STORAGE_KEYS.inboxSettings]: nextSettings
  })
  return nextSettings
}

export function normalizeInboxState(rawState: unknown): InboxState {
  const source = rawState && typeof rawState === 'object'
    ? rawState as Record<string, unknown>
    : {}
  const items = Array.isArray(source.items) ? source.items : []
  const lastUndoMove = normalizeInboxUndoMove(source.lastUndoMove)

  return {
    version: 1,
    folderId: String(source.folderId || '').trim(),
    items: items
      .map(normalizeInboxItem)
      .filter(Boolean)
      .sort((left, right) => Number(right?.createdAt || 0) - Number(left?.createdAt || 0))
      .slice(0, 200) as InboxItem[],
    ...(lastUndoMove ? { lastUndoMove } : {})
  }
}

export async function loadInboxState(): Promise<InboxState> {
  const stored = await getLocalStorage([STORAGE_KEYS.inboxState])
  return normalizeInboxState(stored[STORAGE_KEYS.inboxState])
}

export async function saveInboxState(state: InboxState): Promise<InboxState> {
  const normalized = normalizeInboxState(state)
  await setLocalStorage({
    [STORAGE_KEYS.inboxState]: normalized
  })
  return normalized
}

export async function ensureInboxFolder(settings = getDefaultInboxSettings()): Promise<string> {
  const title = cleanInboxText(settings.folderTitle) || DEFAULT_INBOX_FOLDER_TITLE
  const storedState = await loadInboxState()

  if (storedState.folderId && await folderExists(storedState.folderId)) {
    return storedState.folderId
  }

  const tree = await getBookmarkTree()
  const rootNode = Array.isArray(tree) ? tree[0] : tree
  const rootFolder = getBookmarksBarNode(rootNode)
  const existing = findFolderByTitle(rootFolder, title)
  const folderId = existing
    ? String(existing.id)
    : String((await createBookmarkFolder({ parentId: String(rootFolder.id), title })).id)

  const updateFolderId = (state: InboxState) => ({
    ...state,
    folderId
  })
  await updateInboxState(updateFolderId, updateFolderId)
  return folderId
}

export async function upsertInboxItem(item: InboxItem): Promise<InboxState> {
  const nextItem = normalizeInboxItem(item)
  if (!nextItem) {
    return updateInboxState(() => null)
  }
  const upsertItem = (state: InboxState) => {
    return {
      ...state,
      folderId: nextItem.inboxFolderId || state.folderId,
      items: [
        nextItem,
        ...state.items.filter((entry) => entry.captureId !== nextItem.captureId && entry.bookmarkId !== nextItem.bookmarkId)
      ]
    }
  }
  return updateInboxState(upsertItem, upsertItem)
}

export async function updateInboxItem(
  bookmarkId: string,
  patch: Partial<Omit<InboxItem, 'bookmarkId' | 'captureId' | 'createdAt'>>
): Promise<InboxItem | null> {
  let updatedItem: InboxItem | null = null
  let updatedAt = 0
  const patchItem = (state: InboxState) => {
    updatedAt ||= Date.now()
    const result = patchInboxItemState(state, bookmarkId, patch, updatedAt)
    updatedItem = result.updatedItem || updatedItem
    return result.state
  }
  await updateInboxState(patchItem, patchItem)
  return updatedItem
}

export async function findInboxItemByBookmarkId(bookmarkId: string): Promise<InboxItem | null> {
  const state = await loadInboxState()
  return state.items.find((item) => item.bookmarkId === bookmarkId) || null
}

export async function recordInboxUndoMove(move: Omit<InboxUndoMove, 'expiresAt'>): Promise<InboxState> {
  const movedAt = Number(move.movedAt) || Date.now()
  const recordUndoMove = (state: InboxState) => {
    return {
      ...state,
      lastUndoMove: {
        bookmarkId: String(move.bookmarkId || '').trim(),
        fromFolderId: String(move.fromFolderId || '').trim(),
        toFolderId: String(move.toFolderId || '').trim(),
        movedAt,
        expiresAt: movedAt + INBOX_UNDO_MOVE_WINDOW_MS
      }
    }
  }
  return updateInboxState(recordUndoMove, recordUndoMove)
}

export async function clearInboxUndoMove(bookmarkId?: string): Promise<void> {
  const clearUndoMove = (state: InboxState) => {
    if (!state.lastUndoMove) {
      return null
    }
    if (bookmarkId && state.lastUndoMove.bookmarkId !== bookmarkId) {
      return null
    }
    const { lastUndoMove: _lastUndoMove, ...nextState } = state
    return nextState
  }
  await updateInboxState(clearUndoMove, clearUndoMove)
}

function updateInboxState(
  updater: (state: InboxState) => InboxState | null,
  reconcileAfterWrite: (state: InboxState) => InboxState | null = (state) => state
): Promise<InboxState> {
  const task = inboxStateWriteQueue.then(async () => {
    const currentState = await loadInboxState()
    const nextState = updater(currentState)
    if (!nextState) {
      return currentState
    }
    await saveInboxState(nextState)

    const latestState = await loadInboxState()
    const reconciledState = reconcileAfterWrite(latestState)
    if (!reconciledState) {
      return latestState
    }
    const normalizedReconciledState = normalizeInboxState(reconciledState)
    if (!haveSameInboxStates(latestState, normalizedReconciledState)) {
      return saveInboxState(normalizedReconciledState)
    }
    return latestState
  })

  inboxStateWriteQueue = task.catch(() => {})
  return task
}

function patchInboxItemState(
  state: InboxState,
  bookmarkId: string,
  patch: Partial<Omit<InboxItem, 'bookmarkId' | 'captureId' | 'createdAt'>>,
  updatedAt: number
): { state: InboxState | null, updatedItem: InboxItem | null } {
  let updatedItem: InboxItem | null = null
  const items = state.items.map((item) => {
    if (item.bookmarkId !== bookmarkId) {
      return item
    }
    updatedItem = normalizeInboxItem({
      ...item,
      ...patch,
      bookmarkId: item.bookmarkId,
      captureId: item.captureId,
      createdAt: item.createdAt,
      updatedAt
    })
    return updatedItem || item
  })

  if (!updatedItem) {
    return {
      state: null,
      updatedItem: null
    }
  }
  return {
    state: {
      ...state,
      items
    },
    updatedItem
  }
}

function haveSameInboxStates(leftState: InboxState, rightState: InboxState): boolean {
  return JSON.stringify(leftState) === JSON.stringify(rightState)
}

function normalizeInboxItem(rawItem: unknown): InboxItem | null {
  if (!rawItem || typeof rawItem !== 'object') {
    return null
  }

  const source = rawItem as Record<string, unknown>
  const bookmarkId = String(source.bookmarkId || '').trim()
  const url = String(source.url || '').trim()
  const createdAt = Number(source.createdAt) || 0
  if (!bookmarkId || !url || !createdAt) {
    return null
  }

  return {
    captureId: String(source.captureId || `inbox-${createdAt}-${bookmarkId}`).trim(),
    bookmarkId,
    url,
    title: cleanInboxText(source.title) || '未命名网页',
    inboxFolderId: String(source.inboxFolderId || '').trim(),
    originalParentId: String(source.originalParentId || source.inboxFolderId || '').trim(),
    recommendedFolderId: String(source.recommendedFolderId || '').trim() || undefined,
    recommendedFolderPath: cleanInboxText(source.recommendedFolderPath) || undefined,
    confidence: clampInboxConfidence(source.confidence, 0),
    status: normalizeInboxItemStatus(source.status),
    createdAt,
    updatedAt: Number(source.updatedAt) || createdAt,
    lastError: cleanInboxText(source.lastError) || undefined
  }
}

function normalizeInboxUndoMove(rawMove: unknown): InboxUndoMove | undefined {
  if (!rawMove || typeof rawMove !== 'object') {
    return undefined
  }

  const source = rawMove as Record<string, unknown>
  const bookmarkId = String(source.bookmarkId || '').trim()
  const fromFolderId = String(source.fromFolderId || '').trim()
  const toFolderId = String(source.toFolderId || '').trim()
  const movedAt = Number(source.movedAt) || 0
  const expiresAt = Number(source.expiresAt) || 0
  if (!bookmarkId || !fromFolderId || !toFolderId || !movedAt || expiresAt <= Date.now()) {
    return undefined
  }

  return {
    bookmarkId,
    fromFolderId,
    toFolderId,
    movedAt,
    expiresAt
  }
}

function normalizeInboxItemStatus(status: unknown): InboxItemStatus {
  const value = String(status || '').trim()
  if (['captured', 'analyzing', 'tagged', 'moved', 'needs-review', 'failed', 'undone'].includes(value)) {
    return value as InboxItemStatus
  }
  return 'captured'
}

function clampInboxConfidence(value: unknown, fallback: number): number {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallback
  }
  return Math.max(0, Math.min(1, numericValue))
}

function cleanInboxText(value: unknown): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getBookmarkTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getTree((tree) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }
      resolve(tree)
    })
  })
}

function getBookmarksBarNode(rootNode: chrome.bookmarks.BookmarkTreeNode): chrome.bookmarks.BookmarkTreeNode {
  const candidates = rootNode?.children || []
  return candidates.find((node) => String(node.id) === BOOKMARKS_BAR_ID) ||
    candidates.find((node) => !node.url) ||
    rootNode
}

function findFolderByTitle(
  rootNode: chrome.bookmarks.BookmarkTreeNode,
  title: string
): chrome.bookmarks.BookmarkTreeNode | null {
  if (!rootNode) {
    return null
  }
  const queue = [rootNode]
  const normalizedTitle = normalizeInboxTitle(title)
  while (queue.length) {
    const node = queue.shift()
    if (!node) {
      continue
    }
    if (!node.url && normalizeInboxTitle(node.title) === normalizedTitle) {
      return node
    }
    queue.push(...(node.children || []))
  }
  return null
}

async function folderExists(folderId: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.bookmarks.get(folderId, (nodes) => {
      const error = chrome.runtime.lastError
      if (error) {
        resolve(false)
        return
      }
      resolve(Boolean(nodes?.[0] && !nodes[0].url))
    })
  })
}

function createBookmarkFolder(payload: chrome.bookmarks.BookmarkCreateArg): Promise<chrome.bookmarks.BookmarkTreeNode> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.create(payload, (node) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }
      resolve(node)
    })
  })
}

function normalizeInboxTitle(value: unknown): string {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
