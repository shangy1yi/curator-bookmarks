import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildBookmarkTagRecord,
  getEffectiveBookmarkTags,
  normalizeBookmarkTagIndex,
  type BookmarkTagIndex
} from '../src/shared/bookmark-tags.js'
import {
  buildBookmarkTagUsageStats,
  deleteBookmarkTags,
  mergeBookmarkTags,
  pruneEmptyBookmarkTagRecords,
  renameBookmarkTag
} from '../src/shared/tag-management.js'
import {
  buildTagUsageSummary,
  deleteTagFromIndex,
  renameTagInIndex
} from '../src/options/sections/tag-management.js'
import type { BookmarkRecord } from '../src/shared/types.js'

function bookmark(overrides: Partial<BookmarkRecord>): BookmarkRecord {
  const title = overrides.title || 'Example'
  const url = overrides.url || 'https://example.com'
  return {
    id: overrides.id || title,
    title,
    url,
    displayUrl: overrides.displayUrl || url,
    normalizedTitle: overrides.normalizedTitle || title.toLowerCase(),
    normalizedUrl: overrides.normalizedUrl || url.replace(/^https?:\/\//, '').toLowerCase(),
    duplicateKey: overrides.duplicateKey || url,
    domain: overrides.domain || 'example.com',
    path: overrides.path || 'Bookmarks Bar',
    ancestorIds: overrides.ancestorIds || ['1'],
    parentId: overrides.parentId || '1',
    index: overrides.index || 0,
    dateAdded: overrides.dateAdded || 0
  }
}

function tagRecord(input: {
  id: string
  title?: string
  tags?: string[]
  manualTags?: string[]
  summary?: string
  aliases?: string[]
  updatedAt?: number
}) {
  const record = buildBookmarkTagRecord({
    bookmark: bookmark({
      id: input.id,
      title: input.title || input.id,
      url: `https://example.com/${input.id}`,
      path: `Root / ${input.id}`
    }),
    analysis: {
      summary: input.summary || '',
      tags: input.tags || [],
      aliases: input.aliases || []
    },
    source: 'ai_naming',
    now: input.updatedAt || 1000
  })
  assert.ok(record)
  if (input.manualTags) {
    record.manualTags = input.manualTags
    record.manualUpdatedAt = input.updatedAt || 1000
  }
  return record
}

function createOptionsIndex(): BookmarkTagIndex {
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

test('builds tag usage stats with manual tags taking precedence', () => {
  const index = normalizeBookmarkTagIndex({
    records: {
      a: tagRecord({ id: 'a', tags: ['React', 'Docs'], manualTags: ['Frontend'], updatedAt: 1000 }),
      b: tagRecord({ id: 'b', tags: ['frontend'], updatedAt: 3000 }),
      c: tagRecord({ id: 'c', tags: ['Docs'], summary: 'Has summary', updatedAt: 2000 })
    }
  })

  const stats = buildBookmarkTagUsageStats(index)
  const frontend = stats.find((item) => item.normalizedTag === 'frontend')
  const docs = stats.find((item) => item.normalizedTag === 'docs')

  assert.equal(frontend?.count, 2)
  assert.equal(frontend?.manualCount, 1)
  assert.equal(frontend?.aiCount, 1)
  assert.equal(frontend?.latestUpdatedAt, 3000)
  assert.deepEqual(frontend?.examples.map((item) => item.bookmarkId), ['a', 'b'])
  assert.equal(docs?.count, 1)
})

test('renames tags across manual and AI fields without dropping metadata', () => {
  const index = normalizeBookmarkTagIndex({
    records: {
      a: tagRecord({ id: 'a', tags: ['React', 'Docs'], manualTags: ['React'], summary: 'Keep summary' }),
      b: tagRecord({ id: 'b', tags: ['React'] })
    }
  })

  const result = renameBookmarkTag(index, 'React', 'Frontend', { now: 4000 })

  assert.equal(result.affectedRecords, 2)
  assert.equal(result.removedRecords, 0)
  assert.deepEqual(result.index.records.a.manualTags, ['Frontend'])
  assert.deepEqual(result.index.records.a.tags, ['Frontend', 'Docs'])
  assert.equal(result.index.records.a.summary, 'Keep summary')
  assert.equal(result.index.records.a.updatedAt, 4000)
})

test('merges multiple tags into one canonical tag', () => {
  const index = normalizeBookmarkTagIndex({
    records: {
      a: tagRecord({ id: 'a', tags: ['JavaScript', 'JS', 'Frontend'] }),
      b: tagRecord({ id: 'b', manualTags: ['js'] }),
      c: tagRecord({ id: 'c', tags: ['Design'] })
    }
  })

  const result = mergeBookmarkTags(index, ['JS', 'JavaScript'], 'JavaScript', { now: 5000 })

  assert.equal(result.affectedRecords, 2)
  assert.deepEqual(result.index.records.a.tags, ['JavaScript', 'Frontend'])
  assert.deepEqual(result.index.records.b.manualTags, ['JavaScript'])
  assert.deepEqual(result.index.records.c.tags, ['Design'])
})

test('deletes tags and prunes tag-only records when empty', () => {
  const index = normalizeBookmarkTagIndex({
    records: {
      tagOnly: tagRecord({ id: 'tagOnly', tags: ['Noise'] }),
      withSummary: tagRecord({ id: 'withSummary', tags: ['Noise'], summary: 'Keep me' })
    }
  })

  const result = deleteBookmarkTags(index, ['Noise'], { now: 6000 })

  assert.equal(result.affectedRecords, 2)
  assert.equal(result.removedRecords, 1)
  assert.equal(result.index.records.tagOnly, undefined)
  assert.equal(result.index.records.withSummary.summary, 'Keep me')
  assert.deepEqual(result.index.records.withSummary.tags, [])
})

test('prunes empty tag records but keeps useful aliases and summaries', () => {
  const index = normalizeBookmarkTagIndex({
    records: {
      empty: tagRecord({ id: 'empty' }),
      aliasOnly: tagRecord({ id: 'aliasOnly', aliases: ['Readable Name'] }),
      summaryOnly: tagRecord({ id: 'summaryOnly', summary: 'Summary' })
    }
  })

  const result = pruneEmptyBookmarkTagRecords(index, { now: 7000 })

  assert.equal(result.index.records.empty, undefined)
  assert.ok(result.index.records.aliasOnly)
  assert.ok(result.index.records.summaryOnly)
})

test('options tag management summary adapts shared stats for the settings UI', () => {
  const summary = buildTagUsageSummary(createOptionsIndex())

  assert.equal(summary.totalTags, 3)
  assert.equal(summary.taggedBookmarks, 2)
  assert.equal(summary.manualTags, 2)
  assert.deepEqual(summary.stats.map((stat) => [stat.tag, stat.count]), [
    ['tool', 2],
    ['reference', 1],
    ['docs', 1]
  ])
})

test('options tag management wrappers rename and delete through shared utilities', () => {
  const renamed = renameTagInIndex(createOptionsIndex(), 'tool', 'utility')

  assert.deepEqual(getEffectiveBookmarkTags(renamed.records.a), ['utility', 'docs'])
  assert.deepEqual(getEffectiveBookmarkTags(renamed.records.b), ['reference', 'utility'])

  const deleted = deleteTagFromIndex(renamed, 'utility')
  assert.deepEqual(getEffectiveBookmarkTags(deleted.records.a), ['docs'])
  assert.deepEqual(getEffectiveBookmarkTags(deleted.records.b), ['reference'])
  assert.equal(Object.keys(deleted.records).length, 2)
})
