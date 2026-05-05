import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildTagUsageSummary,
  deleteTagFromIndex,
  renameTagInIndex
} from '../src/options/sections/tag-management.js'
import { getEffectiveBookmarkTags, type BookmarkTagIndex } from '../src/shared/bookmark-tags.js'

function createIndex(): BookmarkTagIndex {
  return {
    version: 1,
    updatedAt: 1000,
    records: {
      a: {
        schemaVersion: 1,
        bookmarkId: 'a',
        url: 'https://example.com/a',
        normalizedUrl: 'https://example.com/a',
        duplicateKey: 'https://example.com/a',
        title: 'Alpha',
        path: 'Bookmarks / Alpha',
        summary: '',
        contentType: '',
        topics: [],
        tags: ['tool', 'docs'],
        aliases: [],
        confidence: 0.8,
        source: 'ai_naming',
        model: 'test',
        extraction: { status: '', source: '', warnings: [] },
        generatedAt: 1000,
        updatedAt: 1000
      },
      b: {
        schemaVersion: 1,
        bookmarkId: 'b',
        url: 'https://example.com/b',
        normalizedUrl: 'https://example.com/b',
        duplicateKey: 'https://example.com/b',
        title: 'Beta',
        path: 'Bookmarks / Beta',
        summary: '',
        contentType: '',
        topics: [],
        tags: ['tool'],
        manualTags: ['reference', 'tool'],
        manualUpdatedAt: 1100,
        aliases: [],
        confidence: 1,
        source: 'manual',
        model: '',
        extraction: { status: '', source: '', warnings: [] },
        generatedAt: 1100,
        updatedAt: 1100
      }
    }
  }
}

test('tag management summary counts effective tags by usage frequency', () => {
  const summary = buildTagUsageSummary(createIndex())

  assert.equal(summary.totalTags, 3)
  assert.equal(summary.taggedBookmarks, 2)
  assert.equal(summary.manualTags, 2)
  assert.deepEqual(summary.stats.map((stat) => [stat.tag, stat.count]), [
    ['tool', 2],
    ['docs', 1],
    ['reference', 1]
  ])
})

test('tag management can rename and delete tags without removing bookmark records', () => {
  const renamed = renameTagInIndex(createIndex(), 'tool', 'utility')

  assert.deepEqual(getEffectiveBookmarkTags(renamed.records.a), ['utility', 'docs'])
  assert.deepEqual(getEffectiveBookmarkTags(renamed.records.b), ['reference', 'utility'])

  const deleted = deleteTagFromIndex(renamed, 'utility')
  assert.deepEqual(getEffectiveBookmarkTags(deleted.records.a), ['docs'])
  assert.deepEqual(getEffectiveBookmarkTags(deleted.records.b), ['reference'])
  assert.equal(Object.keys(deleted.records).length, 2)
})
