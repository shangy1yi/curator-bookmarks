import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BOOKMARK_TAG_ALIASES_LIMIT,
  BOOKMARK_TAG_INDEX_SAFE_BYTES,
  BOOKMARK_TAG_SUMMARY_LIMIT,
  BOOKMARK_TAG_TAGS_LIMIT,
  BOOKMARK_TAG_TAG_TEXT_LIMIT,
  BOOKMARK_TAG_TOPICS_LIMIT,
  assertBookmarkTagIndexWithinQuota,
  buildBookmarkTagDuplicateKey,
  buildBookmarkTagExport,
  buildBookmarkTagRecord,
  mergeBookmarkTagImport,
  normalizeBookmarkTagConfidence,
  normalizeBookmarkTagIndex,
  normalizeBookmarkTagUrl,
  normalizeBookmarkTags,
  removeBookmarkTagRecord,
  saveManualBookmarkTags,
  upsertBookmarkTagRecord
} from '../src/shared/bookmark-tags.js'
import { STORAGE_KEYS } from '../src/shared/constants.js'
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

test('normalizes bookmark tag record fields and confidence values', () => {
  const record = buildBookmarkTagRecord({
    bookmark: bookmark({
      id: 'b1',
      title: '百度',
      url: 'https://www.baidu.com/s?wd=ai&utm_source=test#top',
      path: '工具 / 搜索'
    }),
    analysis: {
      summary: 'x'.repeat(BOOKMARK_TAG_SUMMARY_LIMIT + 80),
      topics: Array.from({ length: BOOKMARK_TAG_TOPICS_LIMIT + 5 }, (_value, index) => `主题 ${index}`),
      tags: Array.from({ length: BOOKMARK_TAG_TAGS_LIMIT + 5 }, (_value, index) => `标签 ${index}`),
      aliases: Array.from({ length: BOOKMARK_TAG_ALIASES_LIMIT + 5 }, (_value, index) => `别名 ${index}`),
      confidence: '85/100'
    },
    source: 'ai_naming',
    model: 'gpt-test',
    extraction: {
      status: 'ok',
      source: 'html',
      warnings: ['正文抽取内容较少，结果置信度可能偏低。']
    },
    now: 123
  })

  assert.ok(record)
  assert.equal(record.summary.length, BOOKMARK_TAG_SUMMARY_LIMIT)
  assert.equal(record.topics.length, BOOKMARK_TAG_TOPICS_LIMIT)
  assert.equal(record.tags.length, BOOKMARK_TAG_TAGS_LIMIT)
  assert.equal(record.aliases.length, BOOKMARK_TAG_ALIASES_LIMIT)
  assert.equal(record.confidence, 0.85)
  assert.equal(record.source, 'ai_naming')
  assert.equal(record.model, 'gpt-test')
  assert.ok(record.tags.every((tag) => tag.length <= BOOKMARK_TAG_TAG_TEXT_LIMIT))
})

test('normalizes AI tag output into short atomic tags', () => {
  const tags = normalizeBookmarkTags([
    '效率工具与网络技术博客',
    'AI API/LLM 网关/模型聚合/OpenAI 兼容',
    'OpenAI 兼容 Claude 兼容 Gemini 兼容',
    '一个支持 OpenAI Claude Gemini 的 API 聚合网关',
    '网站',
    '个人博客'
  ])

  assert.ok(tags.includes('效率工具'))
  assert.ok(tags.includes('网络技术'))
  assert.ok(tags.includes('博客'))
  assert.ok(tags.includes('AI API'))
  assert.ok(tags.includes('LLM 网关'))
  assert.ok(tags.includes('模型聚合'))
  assert.ok(tags.includes('OpenAI 兼容'))
  assert.ok(tags.includes('个人博客'))
  assert.equal(tags.includes('网站'), false)
  assert.equal(tags.some((tag) => tag.startsWith('一个支持')), false)
  assert.ok(tags.every((tag) => tag.length <= BOOKMARK_TAG_TAG_TEXT_LIMIT))
})

test('normalizes confidence from number and string inputs', () => {
  assert.equal(normalizeBookmarkTagConfidence(85), 0.85)
  assert.equal(normalizeBookmarkTagConfidence('85'), 0.85)
  assert.equal(normalizeBookmarkTagConfidence('85%'), 0.85)
  assert.equal(normalizeBookmarkTagConfidence('85/100'), 0.85)
  assert.equal(normalizeBookmarkTagConfidence('0.85'), 0.85)
  assert.equal(normalizeBookmarkTagConfidence('high'), 0)
  assert.equal(normalizeBookmarkTagConfidence(-1), 0)
  assert.equal(normalizeBookmarkTagConfidence(120), 1)
})

test('normalizes URLs without dropping business query parameters', () => {
  const normalized = normalizeBookmarkTagUrl(
    'https://Example.com/docs/?q=react&utm_source=newsletter&fbclid=abc&spm=track#section'
  )

  assert.equal(normalized, 'https://example.com/docs?q=react')
  assert.equal(buildBookmarkTagDuplicateKey(normalized), normalized)
})

test('imports matching tag records by id and URL with timestamp conflict handling', () => {
  const bookmarks = [
    bookmark({ id: 'b1', title: 'Local One', url: 'https://example.com/a?x=1', path: 'Root / A' }),
    bookmark({ id: 'b2', title: 'Local Two', url: 'https://example.com/b?keep=1&utm_campaign=old', path: 'Root / B' })
  ]
  const localRecord = buildBookmarkTagRecord({
    bookmark: bookmarks[0],
    analysis: { summary: 'local summary', tags: ['local'], confidence: 0.7 },
    source: 'ai_naming',
    model: 'gpt-test',
    now: 2000
  })
  const olderRecord = buildBookmarkTagRecord({
    bookmark: bookmarks[0],
    analysis: { summary: 'older summary', tags: ['older'], confidence: 0.8 },
    source: 'ai_naming',
    model: 'gpt-test',
    now: 1000
  })
  const urlMatchedRecord = buildBookmarkTagRecord({
    bookmark: {
      id: 'old-b2',
      title: 'Imported Two',
      url: 'https://example.com/b?keep=1&utm_source=import',
      path: 'Old / B'
    },
    analysis: { summary: 'imported summary', tags: ['imported'], confidence: '85%' },
    source: 'popup_smart',
    model: 'gpt-test',
    now: 3000
  })
  const orphanRecord = buildBookmarkTagRecord({
    bookmark: { id: 'orphan', title: 'Orphan', url: 'https://missing.example.com' },
    analysis: { summary: 'missing', tags: ['missing'] },
    source: 'ai_naming',
    now: 3000
  })

  const result = mergeBookmarkTagImport(
    normalizeBookmarkTagIndex({
      records: {
        b1: localRecord
      }
    }),
    {
      app: 'curator-bookmarks',
      version: 1,
      records: [olderRecord, urlMatchedRecord, orphanRecord]
    },
    bookmarks
  )

  assert.equal(result.added, 1)
  assert.equal(result.overwritten, 0)
  assert.equal(result.skipped, 1)
  assert.equal(result.unmatched, 1)
  assert.equal(result.index.records.b1.summary, 'local summary')
  assert.equal(result.index.records.b2.summary, 'imported summary')
  assert.equal(result.index.records.b2.source, 'imported')
})

test('exports only existing bookmark tag records and omits settings or page excerpts', () => {
  const keptBookmark = bookmark({ id: 'b1', url: 'https://example.com/a' })
  const keptRecord = buildBookmarkTagRecord({
    bookmark: keptBookmark,
    analysis: {
      summary: 'short summary',
      tags: ['docs'],
      aliases: ['Example Docs'],
      main_text_excerpt: 'should not be saved',
      apiKey: 'should not be saved'
    } as any,
    source: 'ai_naming',
    model: 'gpt-test',
    now: 1000
  })
  const orphanRecord = buildBookmarkTagRecord({
    bookmark: { id: 'orphan', title: 'Orphan', url: 'https://missing.example.com' },
    analysis: { summary: 'orphan summary', tags: ['orphan'] },
    source: 'ai_naming',
    now: 1000
  })
  const payload = buildBookmarkTagExport(
    normalizeBookmarkTagIndex({
      records: {
        b1: keptRecord,
        orphan: orphanRecord
      }
    }),
    [keptBookmark]
  )
  const json = JSON.stringify(payload)

  assert.equal(payload.records.length, 1)
  assert.equal(payload.records[0].bookmarkId, 'b1')
  assert.equal(json.includes('apiKey'), false)
  assert.equal(json.includes('main_text_excerpt'), false)
  assert.equal(json.includes('should not be saved'), false)
})

test('rejects oversized tag index writes', () => {
  const records = Object.fromEntries(
    Array.from({ length: Math.ceil(BOOKMARK_TAG_INDEX_SAFE_BYTES / 200) }, (_value, index) => [
      `b${index}`,
      {
        schemaVersion: 1,
        bookmarkId: `b${index}`,
        url: `https://example.com/${index}`,
        normalizedUrl: `https://example.com/${index}`,
        duplicateKey: `https://example.com/${index}`,
        title: `Bookmark ${index}`,
        path: 'Root',
        summary: 'x'.repeat(500),
        contentType: 'docs',
        topics: [],
        tags: [],
        aliases: [],
        confidence: 0.5,
        source: 'ai_naming',
        model: 'gpt-test',
        extraction: { status: 'ok', source: 'html', warnings: [] },
        generatedAt: 1,
        updatedAt: 1
      }
    ])
  )

  let errorMessage = ''
  try {
    assertBookmarkTagIndexWithinQuota({
      version: 1,
      updatedAt: 1,
      records: records as any
    })
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error)
  }
  assert.ok(/标签库数据过大/.test(errorMessage))
})

test('serializes bookmark tag upserts without dropping concurrent records', async () => {
  const store: Record<string, unknown> = {}

  ;(globalThis as any).chrome = createStorageMock(store)

  const firstRecord = buildBookmarkTagRecord({
    bookmark: bookmark({ id: 'b1', title: 'First', url: 'https://example.com/first' }),
    analysis: { summary: 'first summary', tags: ['first'] },
    source: 'ai_naming',
    now: 1000
  })
  const secondRecord = buildBookmarkTagRecord({
    bookmark: bookmark({ id: 'b2', title: 'Second', url: 'https://example.com/second' }),
    analysis: { summary: 'second summary', tags: ['second'] },
    source: 'popup_smart',
    now: 1000
  })

  await Promise.all([
    upsertBookmarkTagRecord(firstRecord),
    upsertBookmarkTagRecord(secondRecord)
  ])

  const index = normalizeBookmarkTagIndex(store[STORAGE_KEYS.bookmarkTagIndex])
  assert.equal(index.records.b1.summary, 'first summary')
  assert.equal(index.records.b2.summary, 'second summary')
})

test('serializes manual tag saves with AI tag upserts without dropping fields', async () => {
  const store: Record<string, unknown> = {}

  ;(globalThis as any).chrome = createStorageMock(store)

  const aiRecord = buildBookmarkTagRecord({
    bookmark: bookmark({ id: 'b1', title: 'First', url: 'https://example.com/first' }),
    analysis: { summary: 'AI summary', tags: ['ai'], aliases: ['Docs'] },
    source: 'auto_analyze',
    now: 1000
  })

  await Promise.all([
    upsertBookmarkTagRecord(aiRecord),
    saveManualBookmarkTags(
      bookmark({ id: 'b1', title: 'First Manual', url: 'https://example.com/first' }),
      ['manual'],
      2000
    )
  ])

  const index = normalizeBookmarkTagIndex(store[STORAGE_KEYS.bookmarkTagIndex])
  assert.equal(index.records.b1.summary, 'AI summary')
  assert.deepEqual(index.records.b1.tags, ['ai'])
  assert.deepEqual(index.records.b1.manualTags, ['manual'])
})

test('serializes bookmark tag removals without dropping concurrent upserts', async () => {
  const store: Record<string, unknown> = {}

  ;(globalThis as any).chrome = createStorageMock(store)

  const firstRecord = buildBookmarkTagRecord({
    bookmark: bookmark({ id: 'remove-me', title: 'Remove', url: 'https://example.com/remove' }),
    analysis: { summary: 'remove summary', tags: ['old'] },
    source: 'ai_naming',
    now: 1000
  })
  const secondRecord = buildBookmarkTagRecord({
    bookmark: bookmark({ id: 'keep-me', title: 'Keep', url: 'https://example.com/keep' }),
    analysis: { summary: 'keep summary', tags: ['new'] },
    source: 'popup_smart',
    now: 1000
  })

  await upsertBookmarkTagRecord(firstRecord)
  await Promise.all([
    removeBookmarkTagRecord('remove-me'),
    upsertBookmarkTagRecord(secondRecord)
  ])

  const index = normalizeBookmarkTagIndex(store[STORAGE_KEYS.bookmarkTagIndex])
  assert.equal(index.records['remove-me'], undefined)
  assert.equal(index.records['keep-me'].summary, 'keep summary')
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
