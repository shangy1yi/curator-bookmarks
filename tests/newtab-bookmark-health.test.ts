import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildNewTabBookmarkHealth,
  hasActionableBookmarkHealth
} from '../src/newtab/bookmark-health.js'
import type { BookmarkTagIndex, BookmarkTagRecord } from '../src/shared/bookmark-tags.js'
import type { ContentSnapshotIndex, ContentSnapshotRecord } from '../src/shared/content-snapshots.js'
import type { BookmarkRecord } from '../src/shared/types.js'

const NOW = new Date('2026-05-05T10:00:00+08:00').getTime()
const DAY_MS = 24 * 60 * 60 * 1000

function bookmark(overrides: Partial<BookmarkRecord>): BookmarkRecord {
  const id = overrides.id || 'bookmark'
  const title = overrides.title || `Bookmark ${id}`
  const url = overrides.url || `https://example.com/${id}`
  return {
    id,
    title,
    url,
    displayUrl: overrides.displayUrl || url,
    normalizedTitle: overrides.normalizedTitle || title.toLowerCase(),
    normalizedUrl: overrides.normalizedUrl || url.toLowerCase(),
    duplicateKey: overrides.duplicateKey || url.toLowerCase(),
    domain: overrides.domain || 'example.com',
    path: overrides.path || '书签栏 / 工作',
    ancestorIds: overrides.ancestorIds || ['1'],
    parentId: overrides.parentId || '1',
    index: overrides.index || 0,
    dateAdded: overrides.dateAdded ?? NOW - 30 * DAY_MS
  }
}

function tagRecord(
  bookmarkId: string,
  overrides: Partial<BookmarkTagRecord> = {}
): BookmarkTagRecord {
  return {
    schemaVersion: 1,
    bookmarkId,
    url: `https://example.com/${bookmarkId}`,
    normalizedUrl: `https://example.com/${bookmarkId}`,
    duplicateKey: `https://example.com/${bookmarkId}`,
    title: `Bookmark ${bookmarkId}`,
    path: '书签栏 / 工作',
    summary: '',
    contentType: '',
    topics: [],
    tags: [],
    aliases: [],
    confidence: 0,
    source: 'manual',
    model: '',
    extraction: {
      status: '',
      source: '',
      warnings: []
    },
    generatedAt: NOW,
    updatedAt: NOW,
    ...overrides
  }
}

function snapshotRecord(
  bookmarkId: string,
  overrides: Partial<ContentSnapshotRecord> = {}
): ContentSnapshotRecord {
  return {
    snapshotId: `snapshot-${bookmarkId}`,
    bookmarkId,
    url: `https://example.com/${bookmarkId}`,
    title: `Bookmark ${bookmarkId}`,
    summary: '',
    headings: [],
    canonicalUrl: '',
    finalUrl: `https://example.com/${bookmarkId}`,
    contentType: '',
    source: 'fallback',
    extractionStatus: 'ok',
    extractedAt: NOW,
    hasFullText: false,
    fullTextBytes: 0,
    fullTextStorage: 'none',
    warnings: [],
    ...overrides
  }
}

function tagIndex(records: Record<string, BookmarkTagRecord>): BookmarkTagIndex {
  return {
    version: 1,
    updatedAt: NOW,
    records
  }
}

function snapshotIndex(records: Record<string, ContentSnapshotRecord>): ContentSnapshotIndex {
  return {
    version: 1,
    updatedAt: NOW,
    records
  }
}

test('builds stable health cards from local bookmark, tag, snapshot and activity data', () => {
  const health = buildNewTabBookmarkHealth({
    now: NOW,
    bookmarks: [
      bookmark({
        id: 'inbox-recent',
        path: '书签栏 / Inbox / 待整理',
        dateAdded: NOW - DAY_MS
      }),
      bookmark({
        id: 'dup-a',
        duplicateKey: 'https://duplicate.example.com/page',
        dateAdded: NOW - 20 * DAY_MS
      }),
      bookmark({
        id: 'dup-b',
        duplicateKey: 'https://duplicate.example.com/page',
        dateAdded: NOW - 10 * DAY_MS
      }),
      bookmark({
        id: 'old-missing',
        dateAdded: NOW - 60 * DAY_MS
      }),
      bookmark({
        id: 'opened-recent',
        dateAdded: NOW - 2 * DAY_MS
      }),
      bookmark({
        id: 'complete-recent',
        dateAdded: NOW - 3 * DAY_MS
      })
    ],
    tagIndex: tagIndex({
      'dup-a': tagRecord('dup-a', { tags: ['docs'], summary: 'Duplicate A summary' }),
      'dup-b': tagRecord('dup-b', { tags: ['docs'] }),
      'complete-recent': tagRecord('complete-recent', { manualTags: ['read later'] })
    }),
    snapshotIndex: snapshotIndex({
      'dup-b': snapshotRecord('dup-b', { summary: 'Duplicate B snapshot summary' }),
      'complete-recent': snapshotRecord('complete-recent', { summary: 'Complete recent summary' })
    }),
    activity: {
      pinnedIds: [],
      records: {
        'opened-recent': {
          bookmarkId: 'opened-recent',
          openCount: 1,
          lastOpenedAt: NOW - DAY_MS
        }
      }
    }
  })

  assert.equal(health.totalBookmarks, 6)
  assert.deepEqual(
    health.cards.map((card) => [card.id, card.label, card.count, card.actionHash, card.severity]),
    [
      ['uncategorized', '待整理', 1, '#folder-cleanup', 'warning'],
      ['duplicates', '重复候选', 2, '#duplicates', 'warning'],
      ['missing-tags', '缺少标签', 3, '#ai', 'warning'],
      ['missing-summaries', '缺少摘要', 3, '#ai', 'warning'],
      ['recent-unprocessed', '新近未处理', 1, '#dashboard', 'warning']
    ]
  )
  assert.deepEqual(health.details.uncategorizedBookmarkIds, ['inbox-recent'])
  assert.deepEqual(health.details.duplicateGroups, [
    {
      duplicateKey: 'https://duplicate.example.com/page',
      bookmarkIds: ['dup-b', 'dup-a'],
      latestDateAdded: NOW - 10 * DAY_MS
    }
  ])
  assert.deepEqual(health.details.recentUnprocessedBookmarkIds, ['inbox-recent'])
  assert.equal(hasActionableBookmarkHealth(health.cards), true)
})

test('recent unprocessed excludes pinned, opened, tagged and summarized bookmarks', () => {
  const health = buildNewTabBookmarkHealth({
    now: NOW,
    recentWindowDays: 7,
    bookmarks: [
      bookmark({ id: 'pinned', dateAdded: NOW - DAY_MS }),
      bookmark({ id: 'opened', dateAdded: NOW - DAY_MS }),
      bookmark({ id: 'tagged', dateAdded: NOW - DAY_MS }),
      bookmark({ id: 'summarized', dateAdded: NOW - DAY_MS }),
      bookmark({ id: 'stale', dateAdded: NOW - 30 * DAY_MS }),
      bookmark({ id: 'needs-work', dateAdded: NOW - 2 * DAY_MS })
    ],
    tagIndex: tagIndex({
      tagged: tagRecord('tagged', { tags: ['research'] })
    }),
    snapshotIndex: snapshotIndex({
      summarized: snapshotRecord('summarized', { summary: 'Local page summary' })
    }),
    activity: {
      pinnedIds: ['pinned'],
      records: {
        opened: {
          bookmarkId: 'opened',
          openCount: 1,
          lastOpenedAt: NOW
        }
      }
    }
  })

  assert.deepEqual(health.details.recentUnprocessedBookmarkIds, ['needs-work'])
  assert.equal(health.cards.find((card) => card.id === 'recent-unprocessed')?.count, 1)
})

test('empty health input returns quiet cards without side effects', () => {
  const health = buildNewTabBookmarkHealth({
    now: NOW,
    bookmarks: [],
    tagIndex: null,
    snapshotIndex: null,
    activity: null
  })

  assert.equal(health.totalBookmarks, 0)
  assert.equal(health.cards.length, 5)
  assert.deepEqual(health.cards.map((card) => card.count), [0, 0, 0, 0, 0])
  assert.deepEqual(health.cards.map((card) => card.severity), ['info', 'info', 'info', 'info', 'info'])
  assert.equal(hasActionableBookmarkHealth(health.cards), false)
})
