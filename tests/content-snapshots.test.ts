import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildContentSnapshotRecord,
  buildContentSnapshotSearchMapWithFullText,
  buildContentSnapshotSearchText,
  type ContentSnapshotRecord,
  getContentFullTexts,
  normalizeContentSnapshotSettings,
  normalizeContentSnapshotIndex,
  removeContentSnapshotForBookmark,
  saveContentSnapshotFromContext,
  setContentFullTextOperationsForTest
} from '../src/shared/content-snapshots.js'
import { CONTENT_SNAPSHOT_LOCAL_TEXT_LIMIT, STORAGE_KEYS } from '../src/shared/constants.js'

const bookmark = {
  id: '42',
  title: 'React 文档',
  url: 'https://react.dev/learn'
}

test('content snapshot settings enable full text capture and search by default', () => {
  const settings = normalizeContentSnapshotSettings(null)

  assert.equal(settings.enabled, true)
  assert.equal(settings.saveFullText, true)
  assert.equal(settings.fullTextSearchEnabled, true)
})

test('content snapshot keeps summary and headings searchable by default', () => {
  const { record } = buildContentSnapshotRecord({
    bookmark,
    context: {
      finalUrl: 'https://react.dev/learn',
      canonicalUrl: 'https://react.dev/learn',
      description: 'React 官方学习文档',
      headings: ['快速开始', '添加交互'],
      contentType: 'documentation',
      mainText: 'React lets you build user interfaces.'
    },
    settings: normalizeContentSnapshotSettings({ saveFullText: false }),
    now: 1000
  })

  assert.equal(record.summary, 'React 官方学习文档')
  assert.deepEqual(record.headings, ['快速开始', '添加交互'])
  assert.equal(record.hasFullText, false)
  assert.match(buildContentSnapshotSearchText(record), /react 官方学习文档/)
  assert.match(buildContentSnapshotSearchText(record), /快速开始/)
})

test('content snapshot stores short full text in local index', () => {
  const { record, fullTextRecord } = buildContentSnapshotRecord({
    bookmark,
    context: {
      mainText: '短正文用于全文搜索',
      contentType: 'article'
    },
    settings: normalizeContentSnapshotSettings({ saveFullText: true }),
    now: 1000
  })

  assert.equal(record.fullTextStorage, 'local')
  assert.equal(record.fullText, '短正文用于全文搜索')
  assert.equal(fullTextRecord, null)
})

test('content snapshot settings preserve independent storage fields', () => {
  const settings = normalizeContentSnapshotSettings({
    enabled: false,
    saveFullText: true,
    fullTextSearchEnabled: true,
    localOnlyNoAiUpload: true
  })

  assert.equal(settings.enabled, false)
  assert.equal(settings.saveFullText, true)
  assert.equal(settings.fullTextSearchEnabled, true)
  assert.equal(settings.localOnlyNoAiUpload, true)
})

test('content snapshot moves full text over 20KB to IndexedDB record', () => {
  const largeText = 'a'.repeat(CONTENT_SNAPSHOT_LOCAL_TEXT_LIMIT + 1)
  const { record, fullTextRecord } = buildContentSnapshotRecord({
    bookmark,
    context: {
      mainText: largeText,
      contentType: 'article'
    },
    settings: normalizeContentSnapshotSettings({ saveFullText: true }),
    now: 1000
  })

  assert.equal(record.fullTextStorage, 'idb')
  assert.equal(record.fullText, undefined)
  assert.equal(record.fullTextRef, record.snapshotId)
  assert.equal(fullTextRecord?.text.length, CONTENT_SNAPSHOT_LOCAL_TEXT_LIMIT + 1)
})

test('content snapshot full text search map uses batched full text reads', async () => {
  const getManyCalls: string[][] = []
  const singleGetCalls: string[] = []
  const restoreFullTextOperations = setContentFullTextOperationsForTest({
    get: async (snapshotId: string) => {
      singleGetCalls.push(snapshotId)
      return ''
    },
    getMany: async (snapshotIds: string[]) => {
      getManyCalls.push([...snapshotIds])
      return new Map([
        ['snapshot-42-100', 'React hooks hidden detail'],
        ['snapshot-43-100', 'IndexedDB batch hydration']
      ])
    }
  })

  try {
    const searchMap = await buildContentSnapshotSearchMapWithFullText({
      version: 1,
      updatedAt: 100,
      records: {
        '42': contentSnapshotRecord({
          snapshotId: 'snapshot-42-100',
          bookmarkId: '42',
          summary: 'React snapshot',
          fullTextStorage: 'idb',
          fullTextRef: 'snapshot-42-100'
        }),
        '43': contentSnapshotRecord({
          snapshotId: 'snapshot-43-100',
          bookmarkId: '43',
          summary: 'IndexedDB snapshot',
          fullTextStorage: 'idb',
          fullTextRef: 'snapshot-43-100'
        })
      }
    }, {
      includeFullText: true,
      maxRecords: 1000
    })

    assert.deepEqual(getManyCalls, [['snapshot-42-100', 'snapshot-43-100']])
    assert.deepEqual(singleGetCalls, [])
    assert.match(searchMap.get('42') || '', /react hooks hidden detail/)
    assert.match(searchMap.get('43') || '', /indexeddb batch hydration/)
  } finally {
    restoreFullTextOperations()
  }
})

test('content snapshot batched full text reads skip missing and failed records', async () => {
  const indexedDbMock = createIndexedDbMock({
    'snapshot-42-100': {
      snapshotId: 'snapshot-42-100',
      bookmarkId: '42',
      text: 'React persisted full text',
      bytes: 25,
      savedAt: 100
    }
  }, new Set(['snapshot-44-100']))
  ;(globalThis as any).indexedDB = indexedDbMock.indexedDB

  try {
    const fullTexts = await getContentFullTexts([
      'snapshot-42-100',
      'snapshot-43-100',
      'snapshot-44-100',
      'snapshot-42-100',
      ''
    ])

    assert.equal(indexedDbMock.openCount(), 1)
    assert.equal(indexedDbMock.transactionCount(), 1)
    assert.deepEqual(indexedDbMock.requestedIds(), [
      'snapshot-42-100',
      'snapshot-43-100',
      'snapshot-44-100'
    ])
    assert.equal(fullTexts.get('snapshot-42-100'), 'React persisted full text')
    assert.equal(fullTexts.has('snapshot-43-100'), false)
    assert.equal(fullTexts.has('snapshot-44-100'), false)
    assert.equal(indexedDbMock.closedCount(), 1)
  } finally {
    delete (globalThis as any).indexedDB
  }
})

test('content snapshot cleans up IndexedDB full text when local index write fails', async () => {
  const deletedSnapshotIds: string[] = []
  const restoreFullTextOperations = setContentFullTextOperationsForTest({
    put: async () => {},
    delete: async (snapshotId: string) => {
      deletedSnapshotIds.push(snapshotId)
    }
  })
  ;(globalThis as any).chrome = {
    storage: {
      local: {
        get(_keys: string[], callback: (items: Record<string, unknown>) => void) {
          setTimeout(() => callback({}), 0)
        },
        set(_payload: Record<string, unknown>, callback: () => void) {
          setTimeout(() => {
            lastError = { message: 'quota exceeded' }
            callback()
            lastError = undefined
          }, 0)
        }
      }
    },
    runtime: {
      get lastError() {
        return lastError
      }
    }
  }
  let lastError: { message: string } | undefined

  try {
    await assert.rejects(
      saveContentSnapshotFromContext({
        bookmark,
        context: {
          mainText: 'a'.repeat(CONTENT_SNAPSHOT_LOCAL_TEXT_LIMIT + 1),
          contentType: 'article'
        },
        settings: normalizeContentSnapshotSettings({ saveFullText: true }),
        now: 123
      }),
      /quota exceeded/
    )

    assert.deepEqual(deletedSnapshotIds, ['snapshot-42-123'])
  } finally {
    restoreFullTextOperations()
    delete (globalThis as any).chrome
  }
})

test('content snapshot removal deletes index record and IndexedDB full text ref', async () => {
  const deletedSnapshotIds: string[] = []
  const restoreFullTextOperations = setContentFullTextOperationsForTest({
    delete: async (snapshotId: string) => {
      deletedSnapshotIds.push(snapshotId)
    }
  })
  const store: Record<string, unknown> = {
    [STORAGE_KEYS.contentSnapshotIndex]: {
      version: 1,
      updatedAt: 100,
      records: {
        '42': {
          snapshotId: 'snapshot-42-100',
          bookmarkId: '42',
          url: 'https://react.dev/learn',
          title: 'React 文档',
          summary: 'React snapshot',
          headings: [],
          canonicalUrl: '',
          finalUrl: 'https://react.dev/learn',
          contentType: 'article',
          source: 'html',
          extractionStatus: 'ok',
          extractedAt: 100,
          hasFullText: true,
          fullTextBytes: CONTENT_SNAPSHOT_LOCAL_TEXT_LIMIT + 1,
          fullTextStorage: 'idb',
          fullTextRef: 'snapshot-42-100',
          warnings: []
        },
        '43': {
          snapshotId: 'snapshot-43-100',
          bookmarkId: '43',
          url: 'https://example.com',
          title: 'Example',
          summary: 'Example snapshot',
          headings: [],
          canonicalUrl: '',
          finalUrl: 'https://example.com',
          contentType: 'article',
          source: 'html',
          extractionStatus: 'ok',
          extractedAt: 100,
          hasFullText: false,
          fullTextBytes: 0,
          fullTextStorage: 'none',
          warnings: []
        }
      }
    }
  }
  ;(globalThis as any).chrome = createStorageMock(store)

  try {
    const removed = await removeContentSnapshotForBookmark('42', 200)
    const index = normalizeContentSnapshotIndex(store[STORAGE_KEYS.contentSnapshotIndex])

    assert.equal(removed, true)
    assert.equal(index.updatedAt, 200)
    assert.equal(index.records['42'], undefined)
    assert.equal(index.records['43']?.snapshotId, 'snapshot-43-100')
    assert.deepEqual(deletedSnapshotIds, ['snapshot-42-100'])
  } finally {
    restoreFullTextOperations()
    delete (globalThis as any).chrome
  }
})

function createStorageMock(store: Record<string, unknown>) {
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

function contentSnapshotRecord(overrides: Partial<ContentSnapshotRecord>): ContentSnapshotRecord {
  return {
    snapshotId: 'snapshot-42-100',
    bookmarkId: '42',
    url: 'https://react.dev/learn',
    title: 'React 文档',
    summary: 'React snapshot',
    headings: [],
    canonicalUrl: '',
    finalUrl: 'https://react.dev/learn',
    contentType: 'article',
    source: 'html',
    extractionStatus: 'ok',
    extractedAt: 100,
    hasFullText: true,
    fullTextBytes: CONTENT_SNAPSHOT_LOCAL_TEXT_LIMIT + 1,
    fullTextStorage: 'idb',
    fullTextRef: 'snapshot-42-100',
    warnings: [],
    ...overrides
  }
}

function createIndexedDbMock(
  records: Record<string, unknown>,
  failingIds: Set<string> = new Set()
) {
  let openCount = 0
  let transactionCount = 0
  let closedCount = 0
  const requestedSnapshotIds: string[] = []

  const createEventTarget = (initial: Record<string, unknown> = {}) => {
    const listeners: Record<string, Array<(event: any) => void>> = {}
    return {
      ...initial,
      addEventListener(type: string, listener: (event: any) => void) {
        listeners[type] ||= []
        listeners[type].push(listener)
      },
      dispatch(type: string, event: any = {}) {
        for (const listener of listeners[type] || []) {
          listener(event)
        }
      }
    }
  }

  const db: any = {
    objectStoreNames: {
      contains: () => true
    },
    createObjectStore: () => {},
    transaction: () => {
      transactionCount += 1
      const transaction: any = createEventTarget({
        error: null
      })
      let pendingRequests = 0
      const completeIfIdle = () => {
        if (pendingRequests === 0) {
          setTimeout(() => transaction.dispatch('complete'), 0)
        }
      }
      const store = {
        get(snapshotId: string) {
          requestedSnapshotIds.push(snapshotId)
          pendingRequests += 1
          const request: any = createEventTarget({
            result: records[snapshotId],
            error: failingIds.has(snapshotId) ? new Error('record read failed') : null
          })
          setTimeout(() => {
            if (failingIds.has(snapshotId)) {
              request.dispatch('error', {
                preventDefault() {},
                stopPropagation() {}
              })
            } else {
              request.dispatch('success')
            }
            pendingRequests -= 1
            completeIfIdle()
          }, 0)
          return request
        }
      }
      transaction.objectStore = () => store
      return transaction
    },
    close: () => {
      closedCount += 1
    }
  }

  return {
    indexedDB: {
      open: () => {
        openCount += 1
        const request: any = createEventTarget({
          result: db,
          error: null
        })
        setTimeout(() => request.dispatch('success'), 0)
        return request
      }
    },
    openCount: () => openCount,
    transactionCount: () => transactionCount,
    closedCount: () => closedCount,
    requestedIds: () => [...requestedSnapshotIds]
  }
}
