import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BookmarkTagIndex } from '../src/shared/bookmark-tags.js'
import type { BookmarkRecord } from '../src/shared/types.js'
import {
  buildNewTabSearchIndex,
  getNaturalSearchBookmarkSuggestionsFromIndex,
  getSearchBookmarkSuggestionsFromIndex,
  normalizeNewTabSearchText,
  prepareNewTabSearchIndex
} from '../src/newtab/content-state.js'

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

test('builds a reusable newtab search index from bookmark sections', () => {
  const index = buildNewTabSearchIndex([
    {
      title: 'Work',
      path: 'Bookmarks / Work',
      bookmarks: [
        { id: '1', title: 'React Table Guide', url: 'https://example.com/react-table' },
        { id: '2', title: 'Empty URL', url: '' }
      ]
    },
    {
      title: 'Design',
      path: 'Bookmarks / Design',
      bookmarks: [
        { id: '3', title: '', url: 'https://design.example.com/' }
      ]
    }
  ])

  assert.equal(index.length, 2)
  assert.deepEqual(
    index.map((entry) => ({
      id: entry.id,
      title: entry.title,
      folderTitle: entry.folderTitle,
      order: entry.order
    })),
    [
      { id: '1', title: 'React Table Guide', folderTitle: 'Work', order: 0 },
      { id: '3', title: 'https://design.example.com/', folderTitle: 'Design', order: 1 }
    ]
  )
})

test('uses precomputed normalized fields when ranking newtab bookmark suggestions', () => {
  const index = buildNewTabSearchIndex([
    {
      title: 'Development',
      path: 'Bookmarks / Development',
      bookmarks: [
        { id: '1', title: 'React Table Guide', url: 'https://example.com/react-table' },
        { id: '2', title: 'Weekly Notes', url: 'https://example.com/react-notes' },
        { id: '3', title: 'Design Tokens', url: 'https://example.com/tokens' }
      ]
    },
    {
      title: 'React',
      path: 'Bookmarks / React',
      bookmarks: [
        { id: '4', title: 'Hooks Reference', url: 'https://example.com/hooks' }
      ]
    }
  ])

  const suggestions = getSearchBookmarkSuggestionsFromIndex('react', index, 4)

  assert.deepEqual(
    suggestions.map((suggestion) => ({
      id: suggestion.id,
      score: suggestion.score,
      order: suggestion.order
    })),
    [
      { id: '1', score: 1, order: 0 },
      { id: '2', score: 3, order: 1 },
      { id: '4', score: 4, order: 3 }
    ]
  )
})

test('keeps only top ranked newtab suggestions while preserving exact prefix url and folder order', () => {
  const index = buildNewTabSearchIndex([
    {
      title: 'React Folder',
      path: 'Bookmarks / React Folder',
      bookmarks: [
        { id: 'late-exact', title: 'React', url: 'https://z.example.com/react', dateAdded: 1 },
        { id: 'prefix', title: 'React Table Guide', url: 'https://b.example.com/table', dateAdded: 2 },
        { id: 'title-contains', title: 'Advanced React Notes', url: 'https://c.example.com/notes', dateAdded: 3 },
        { id: 'url-match', title: 'Grid Article', url: 'https://react.example.com/grid', dateAdded: 4 },
        { id: 'folder-match', title: 'Hooks Reference', url: 'https://d.example.com/hooks', dateAdded: 5 }
      ]
    },
    {
      title: 'Archive',
      path: 'Bookmarks / Archive',
      bookmarks: [
        { id: 'early-exact', title: 'React', url: 'https://a.example.com/react', dateAdded: 7 }
      ]
    }
  ])

  const fullOrder = getSearchBookmarkSuggestionsFromIndex('react', index, 20)
    .map((suggestion) => suggestion.id)

  assert.deepEqual(fullOrder, [
    'late-exact',
    'early-exact',
    'prefix',
    'title-contains',
    'url-match',
    'folder-match'
  ])
  assert.deepEqual(
    getSearchBookmarkSuggestionsFromIndex('react', index, 3).map((suggestion) => suggestion.id),
    fullOrder.slice(0, 3)
  )
})

test('bounded newtab suggestions keep multi-term matches equal to the full sorted result', () => {
  const index = buildNewTabSearchIndex([
    {
      title: 'Archive',
      path: 'Bookmarks / Archive',
      bookmarks: Array.from({ length: 24 }, (_, index) => ({
        id: `noise-${index}`,
        title: `React Virtual Grid ${index}`,
        url: `https://example.com/noise-${index}`
      })).concat([
        { id: 'winner', title: 'React Grid', url: 'https://example.com/winner' },
        { id: 'term-match', title: 'React Virtual Grid', url: 'https://example.com/term' }
      ])
    }
  ])

  const fullOrder = getSearchBookmarkSuggestionsFromIndex('react grid', index, 30)
    .map((suggestion) => suggestion.id)

  assert.deepEqual(
    getSearchBookmarkSuggestionsFromIndex('react grid', index, 2).map((suggestion) => suggestion.id),
    fullOrder.slice(0, 2)
  )
})

test('normalizes newtab search text consistently', () => {
  assert.equal(normalizeNewTabSearchText('  Ｒｅａｃｔ   TABLE  '), 'react table')
  assert.deepEqual(getSearchBookmarkSuggestionsFromIndex('', [], 6), [])
  assert.deepEqual(getSearchBookmarkSuggestionsFromIndex('react', [], 0), [])
})

test('builds full-tree newtab search index from extracted bookmark records', () => {
  const index = buildNewTabSearchIndex({
    bookmarks: [
      bookmark({
        id: 'selected',
        title: 'Selected React Guide',
        normalizedTitle: 'selected react guide',
        path: 'Bookmarks Bar / New Tab'
      }),
      bookmark({
        id: 'outside',
        title: 'Rust Async Notes',
        normalizedTitle: 'rust async notes',
        path: 'Other Bookmarks / Engineering / Rust'
      })
    ]
  })

  assert.deepEqual(
    index.map((entry) => ({
      id: entry.id,
      folderTitle: entry.folderTitle,
      folderPath: entry.folderPath,
      hasPopupSearchSource: Boolean(entry.sourceBookmark)
    })),
    [
      {
        id: 'selected',
        folderTitle: 'New Tab',
        folderPath: 'Bookmarks Bar / New Tab',
        hasPopupSearchSource: true
      },
      {
        id: 'outside',
        folderTitle: 'Rust',
        folderPath: 'Other Bookmarks / Engineering / Rust',
        hasPopupSearchSource: true
      }
    ]
  )
})

test('finds full-tree bookmarks outside selected source folders', () => {
  const index = buildNewTabSearchIndex({
    bookmarks: [
      bookmark({
        id: 'selected',
        title: 'Selected Dashboard',
        normalizedTitle: 'selected dashboard',
        path: 'Bookmarks Bar / New Tab'
      }),
      bookmark({
        id: 'outside',
        title: 'Hidden React Table Guide',
        normalizedTitle: 'hidden react table guide',
        path: 'Other Bookmarks / Frontend'
      })
    ]
  })

  const suggestions = getSearchBookmarkSuggestionsFromIndex('react table', index, 6)

  assert.equal(suggestions[0]?.id, 'outside')
  assert.equal(suggestions[0]?.folderPath, 'Other Bookmarks / Frontend')
})

test('reuses lazy popup search for Chinese pinyin while keeping tags in the light index', async () => {
  const tagIndex: BookmarkTagIndex = {
    version: 1,
    updatedAt: 1,
    records: {
      zh: {
        schemaVersion: 1,
        bookmarkId: 'zh',
        url: 'https://example.com/vue',
        normalizedUrl: 'example.com/vue',
        duplicateKey: 'example.com/vue',
        title: '前端状态管理',
        path: 'Bookmarks Bar / 中文资料',
        summary: 'Vue Pinia 状态管理教程',
        contentType: '文档',
        topics: ['前端框架'],
        tags: ['状态管理'],
        aliases: ['Pinia Guide'],
        confidence: 0.9,
        source: 'manual',
        model: 'local',
        extraction: { status: 'ok', source: 'manual', warnings: [] },
        generatedAt: 1,
        updatedAt: 1
      }
    }
  }
  const index = buildNewTabSearchIndex({
    bookmarks: [
      bookmark({
        id: 'zh',
        title: '前端状态管理',
        normalizedTitle: '前端状态管理',
        url: 'https://example.com/vue',
        normalizedUrl: 'example.com/vue',
        path: 'Bookmarks Bar / 中文资料'
      })
    ],
    tagIndex
  })

  assert.deepEqual(getSearchBookmarkSuggestionsFromIndex('pinia', index, 6).map((item) => item.id), ['zh'])
  assert.deepEqual(getSearchBookmarkSuggestionsFromIndex('qianduan', index, 6).map((item) => item.id), [])
  assert.deepEqual((await getNaturalSearchBookmarkSuggestionsFromIndex('qianduan', index, 6)).map((item) => item.id), ['zh'])
})

test('uses popup local natural-language expansion without remote AI', async () => {
  const now = new Date(2026, 4, 4).getTime()
  const index = buildNewTabSearchIndex({
    bookmarks: [
      bookmark({
        id: 'article',
        title: 'React Data Grid Tutorial',
        normalizedTitle: 'react data grid tutorial',
        path: 'Bookmarks Bar / Frontend',
        dateAdded: now - 3 * 24 * 60 * 60 * 1000
      }),
      bookmark({
        id: 'video',
        title: 'React Data Grid Video',
        normalizedTitle: 'react data grid video',
        path: 'Bookmarks Bar / Video',
        dateAdded: now - 3 * 24 * 60 * 60 * 1000
      }),
      bookmark({
        id: 'old',
        title: 'React Data Grid Tutorial',
        normalizedTitle: 'react data grid tutorial',
        path: 'Bookmarks Bar / Archive',
        dateAdded: now - 60 * 24 * 60 * 60 * 1000
      })
    ]
  })

  const directSuggestions = getSearchBookmarkSuggestionsFromIndex(
    '帮我找最近 2 周收藏的 React 表格教程 不要视频',
    index,
    6,
    { now }
  )

  assert.deepEqual(directSuggestions.map((suggestion) => suggestion.id), [])

  const suggestions = await getNaturalSearchBookmarkSuggestionsFromIndex(
    '帮我找最近 2 周收藏的 React 表格教程 不要视频',
    index,
    6,
    { now }
  )

  assert.deepEqual(suggestions.map((suggestion) => suggestion.id), ['article'])
})

test('prepares reusable search lookup structures without changing popup matching', () => {
  const tagIndex: BookmarkTagIndex = {
    version: 1,
    updatedAt: 1,
    records: {
      tagged: {
        schemaVersion: 1,
        bookmarkId: 'tagged',
        url: 'https://example.com/vue',
        normalizedUrl: 'example.com/vue',
        duplicateKey: 'example.com/vue',
        title: '前端状态管理',
        path: 'Bookmarks Bar / 中文资料',
        summary: 'Vue Pinia 状态管理教程',
        contentType: '文档',
        topics: ['前端框架'],
        tags: ['状态管理'],
        aliases: ['Pinia Guide'],
        confidence: 0.9,
        source: 'manual',
        model: 'local',
        extraction: { status: 'ok', source: 'manual', warnings: [] },
        generatedAt: 1,
        updatedAt: 1
      }
    }
  }
  const index = buildNewTabSearchIndex({
    bookmarks: [
      bookmark({
        id: 'tagged',
        title: '前端状态管理',
        normalizedTitle: '前端状态管理',
        url: 'https://example.com/vue',
        normalizedUrl: 'example.com/vue',
        path: 'Bookmarks Bar / 中文资料'
      })
    ],
    tagIndex
  })
  const prepared = prepareNewTabSearchIndex(index)

  assert.equal(prepared.entries, index)
  assert.equal(prepared.supportsPopupSearch, true)
  assert.equal(prepared.popupSearchEntries.length, 1)
  assert.equal(prepared.popupSearchBookmarks, undefined)
  assert.equal(prepared.entriesById.get('tagged'), index[0])
  assert.deepEqual(getSearchBookmarkSuggestionsFromIndex('pinia', prepared, 6).map((item) => item.id), ['tagged'])
})

test('natural newtab search builds popup search entries lazily and reuses them', async () => {
  const index = buildNewTabSearchIndex({
    bookmarks: [
      bookmark({
        id: 'react',
        title: 'React Table Guide',
        normalizedTitle: 'react table guide',
        path: 'Bookmarks Bar / Frontend'
      })
    ]
  })
  const prepared = prepareNewTabSearchIndex(index)

  assert.equal(prepared.popupSearchBookmarks, undefined)

  assert.deepEqual(
    (await getNaturalSearchBookmarkSuggestionsFromIndex('帮我找 React 表格', prepared, 6))
      .map((item) => item.id),
    ['react']
  )

  const firstPreparedBookmarks = prepared.popupSearchBookmarks
  assert.ok(firstPreparedBookmarks)
  assert.equal(firstPreparedBookmarks?.length, 1)

  assert.deepEqual(
    (await getNaturalSearchBookmarkSuggestionsFromIndex('React Table', prepared, 6))
      .map((item) => item.id),
    ['react']
  )
  assert.equal(prepared.popupSearchBookmarks, firstPreparedBookmarks)
})
