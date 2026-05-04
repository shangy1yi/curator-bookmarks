import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

import {
  type InboxItem,
  INBOX_UNDO_MOVE_WINDOW_MS,
  recordInboxUndoMove,
  updateInboxItem,
  upsertInboxItem
} from '../src/shared/inbox.js'
import { STORAGE_KEYS } from '../src/shared/constants.js'

test('serializes concurrent inbox upserts without dropping captured items', async () => {
  const store: Record<string, unknown> = {}
  ;(globalThis as any).chrome = createChromeStorageMock({ store })

  await Promise.all([
    upsertInboxItem(createInboxItem({ bookmarkId: 'bookmark-1', createdAt: 100 })),
    upsertInboxItem(createInboxItem({ bookmarkId: 'bookmark-2', createdAt: 200 }))
  ])

  const state = store[STORAGE_KEYS.inboxState] as {
    folderId: string
    items: Array<{ bookmarkId: string }>
  }
  assert.equal(state.folderId, 'inbox-folder')
  assert.deepEqual(
    state.items.map((item) => item.bookmarkId),
    ['bookmark-2', 'bookmark-1']
  )
})

test('serializes concurrent inbox updates without overwriting prior patches', async () => {
  const store: Record<string, unknown> = {
    [STORAGE_KEYS.inboxState]: {
      version: 1,
      folderId: 'inbox-folder',
      items: [
        createInboxItem({ bookmarkId: 'bookmark-1', createdAt: 100 }),
        createInboxItem({ bookmarkId: 'bookmark-2', createdAt: 200 })
      ]
    }
  }
  ;(globalThis as any).chrome = createChromeStorageMock({ store })

  await Promise.all([
    updateInboxItem('bookmark-1', {
      status: 'tagged',
      recommendedFolderId: 'folder-react',
      recommendedFolderPath: 'Bookmarks / React',
      confidence: 0.9
    }),
    updateInboxItem('bookmark-2', {
      status: 'failed',
      lastError: '分析失败'
    })
  ])

  const state = store[STORAGE_KEYS.inboxState] as {
    items: Array<{
      bookmarkId: string
      status: string
      recommendedFolderId?: string
      lastError?: string
    }>
  }
  const first = state.items.find((item) => item.bookmarkId === 'bookmark-1')
  const second = state.items.find((item) => item.bookmarkId === 'bookmark-2')

  assert.equal(first?.status, 'tagged')
  assert.equal(first?.recommendedFolderId, 'folder-react')
  assert.equal(second?.status, 'failed')
  assert.equal(second?.lastError, '分析失败')
})

test('serializes concurrent inbox undo recording with item updates', async () => {
  const store: Record<string, unknown> = {
    [STORAGE_KEYS.inboxState]: {
      version: 1,
      folderId: 'inbox-folder',
      items: [
        createInboxItem({ bookmarkId: 'bookmark-1', createdAt: 100, status: 'analyzing' })
      ]
    }
  }
  ;(globalThis as any).chrome = createChromeStorageMock({ store })
  const movedAt = Date.now()

  await Promise.all([
    updateInboxItem('bookmark-1', {
      status: 'moved',
      recommendedFolderId: 'folder-react',
      recommendedFolderPath: 'Bookmarks / React',
      confidence: 0.88
    }),
    recordInboxUndoMove({
      bookmarkId: 'bookmark-1',
      fromFolderId: 'inbox-folder',
      toFolderId: 'folder-react',
      movedAt
    })
  ])

  const state = store[STORAGE_KEYS.inboxState] as {
    items: Array<{ bookmarkId: string, status: string, recommendedFolderId?: string }>
    lastUndoMove?: {
      bookmarkId: string
      fromFolderId: string
      toFolderId: string
      movedAt: number
      expiresAt: number
    }
  }

  assert.equal(state.items[0]?.status, 'moved')
  assert.equal(state.items[0]?.recommendedFolderId, 'folder-react')
  assert.deepEqual(state.lastUndoMove, {
    bookmarkId: 'bookmark-1',
    fromFolderId: 'inbox-folder',
    toFolderId: 'folder-react',
    movedAt,
    expiresAt: movedAt + INBOX_UNDO_MOVE_WINDOW_MS
  })
})

test('service worker records and undoes inbox auto moves in the correct direction', () => {
  const source = readProjectFile('src/service-worker/service-worker.ts')

  assert.match(
    source,
    /recordInboxUndoMove\(\{\s*bookmarkId,\s*fromFolderId: originalParentId,\s*toFolderId: folderId,\s*movedAt: Date\.now\(\)\s*\}/
  )
  assert.match(
    source,
    /const movedNode = await moveBookmarkNode\(undoMove\.bookmarkId, undoMove\.fromFolderId\)/
  )
  assert.match(
    source,
    /parentId: String\(movedNode\.parentId \|\| undoMove\.fromFolderId\)/
  )
  assert.doesNotMatch(source, /fromFolderId: folderId,\s*toFolderId: originalParentId/)
  assert.doesNotMatch(source, /moveBookmarkNode\(undoMove\.bookmarkId, undoMove\.toFolderId\)/)
})

function createInboxItem(overrides: Partial<InboxItem> = {}): InboxItem {
  const bookmarkId = overrides.bookmarkId || 'bookmark-1'
  const createdAt = overrides.createdAt || 100
  return {
    captureId: overrides.captureId || `capture-${bookmarkId}`,
    bookmarkId,
    url: overrides.url || `https://${bookmarkId}.example.com`,
    title: overrides.title || `Title ${bookmarkId}`,
    inboxFolderId: overrides.inboxFolderId || 'inbox-folder',
    originalParentId: overrides.originalParentId || 'inbox-folder',
    status: overrides.status || 'captured',
    createdAt,
    updatedAt: overrides.updatedAt || createdAt,
    recommendedFolderId: overrides.recommendedFolderId,
    recommendedFolderPath: overrides.recommendedFolderPath,
    confidence: overrides.confidence,
    lastError: overrides.lastError
  }
}

function readProjectFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function createChromeStorageMock(options: {
  store: Record<string, unknown>
}) {
  const { store } = options

  return {
    storage: {
      local: {
        get(keys: string[], callback: (items: Record<string, unknown>) => void) {
          const snapshot: Record<string, unknown> = {}
          for (const key of keys) {
            snapshot[key] = store[key]
          }
          setTimeout(() => callback(snapshot), 0)
        },
        set(payload: Record<string, unknown>, callback: () => void) {
          setTimeout(() => {
            Object.assign(store, payload)
            callback()
          }, 0)
        }
      }
    },
    runtime: {}
  }
}
