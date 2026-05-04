import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BookmarkTagIndex } from '../src/shared/bookmark-tags.js'
import type { BookmarkRecord } from '../src/shared/types.js'
import {
  buildNewTabSearchIndex,
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
      hasPopupSearchBookmark: Boolean(entry.searchBookmark)
    })),
    [
      {
        id: 'selected',
        folderTitle: 'New Tab',
        folderPath: 'Bookmarks Bar / New Tab',
        hasPopupSearchBookmark: true
      },
      {
        id: 'outside',
        folderTitle: 'Rust',
        folderPath: 'Other Bookmarks / Engineering / Rust',
        hasPopupSearchBookmark: true
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

test('reuses popup search for Chinese pinyin and bookmark tags', () => {
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

  assert.deepEqual(getSearchBookmarkSuggestionsFromIndex('qianduan', index, 6).map((item) => item.id), ['zh'])
  assert.deepEqual(getSearchBookmarkSuggestionsFromIndex('pinia', index, 6).map((item) => item.id), ['zh'])
})

test('uses popup local natural-language expansion without remote AI', () => {
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

  const suggestions = getSearchBookmarkSuggestionsFromIndex(
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
  assert.equal(prepared.popupBookmarks.length, 1)
  assert.equal(prepared.entriesById.get('tagged'), index[0])
  assert.deepEqual(getSearchBookmarkSuggestionsFromIndex('pinia', prepared, 6).map((item) => item.id), ['tagged'])
})
