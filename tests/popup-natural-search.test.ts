import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BookmarkRecord } from '../src/shared/types.js'
import {
  buildLocalNaturalSearchPlan,
  filterBookmarksByNaturalDateRange,
  mergeNaturalSearchResultSets,
  normalizeNaturalSearchAiPlan
} from '../src/popup/natural-search.js'
import {
  indexBookmarkForSearch,
  searchBookmarks,
  searchBookmarksUnbounded
} from '../src/popup/search.js'

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

test('builds local natural search plan with relative date and synonym expansion', () => {
  const now = new Date(2026, 3, 30, 12).getTime()
  const plan = buildLocalNaturalSearchPlan('帮我找上周收藏的那个 React 表格教程', now)

  assert.equal(plan.source, 'local')
  assert.equal(plan.dateRange?.label, '上周收藏')
  assert.ok(plan.queries.some((query) => query.includes('react')))
  assert.ok(plan.queries.some((query) => query.includes('table')))
  assert.ok(plan.highlightQuery.includes('教程'))
})

test('exports popup search results without the popup result cap for larger surfaces', () => {
  const bookmarks = Array.from({ length: 26 }, (_value, index) =>
    indexBookmarkForSearch(bookmark({
      id: `react-${index}`,
      title: `React Guide ${index}`,
      normalizedTitle: `react guide ${index}`,
      dateAdded: index + 1
    }))
  )

  assert.equal(searchBookmarks('react', bookmarks).length, 20)
  assert.equal(searchBookmarksUnbounded('react', bookmarks).length, 26)
})

test('keeps structured search operators in local natural search queries', () => {
  const plan = buildLocalNaturalSearchPlan('帮我找 site:github.com 文件夹:Frontend 的 React 文档')

  assert.ok(plan.queries.some((query) => query.includes('site:github.com')))
  assert.ok(plan.queries.some((query) => query.includes('文件夹:frontend')))
  assert.ok(plan.highlightQuery.includes('site:github.com'))
})

test('filters natural search candidates by parsed bookmark date range', () => {
  const now = new Date(2026, 3, 30, 12).getTime()
  const plan = buildLocalNaturalSearchPlan('上周收藏的 React 教程', now)
  const inRange = indexBookmarkForSearch(bookmark({
    id: 'in-range',
    title: 'React Guide',
    normalizedTitle: 'react guide',
    dateAdded: new Date(2026, 3, 22, 10).getTime()
  }))
  const outOfRange = indexBookmarkForSearch(bookmark({
    id: 'out-of-range',
    title: 'React Guide Old',
    normalizedTitle: 'react guide old',
    dateAdded: new Date(2026, 3, 10, 10).getTime()
  }))

  assert.deepEqual(
    filterBookmarksByNaturalDateRange([inRange, outOfRange], plan).map((item) => item.id),
    ['in-range']
  )
})

test('parses broader natural date ranges without AI', () => {
  const now = new Date(2026, 3, 30, 12).getTime()
  const recentWeeks = buildLocalNaturalSearchPlan('最近 2 周收藏的 TypeScript 文档', now)
  const recentMonths = buildLocalNaturalSearchPlan('近 3 个月的 LLM 论文', now)
  const lastYear = buildLocalNaturalSearchPlan('去年收藏的 React 教程', now)
  const explicitMonth = buildLocalNaturalSearchPlan('2026年4月收藏的 React 表格教程', now)
  const explicitDay = buildLocalNaturalSearchPlan('2026-04-20 收藏的 React 教程', now)

  assert.equal(recentWeeks.dateRange?.label, '最近 2 周')
  assert.equal(recentWeeks.dateRange?.from, new Date(2026, 3, 17).getTime())
  assert.equal(recentMonths.dateRange?.label, '最近 3 个月')
  assert.equal(recentMonths.dateRange?.from, new Date(2026, 0, 30).getTime())
  assert.equal(lastYear.dateRange?.from, new Date(2025, 0, 1).getTime())
  assert.equal(lastYear.dateRange?.to, new Date(2026, 0, 1).getTime())
  assert.equal(explicitMonth.dateRange?.label, '2026-04 收藏')
  assert.equal(explicitMonth.dateRange?.to, new Date(2026, 4, 1).getTime())
  assert.equal(explicitDay.dateRange?.label, '2026-04-20 收藏')
  assert.equal(explicitDay.dateRange?.to, new Date(2026, 3, 21).getTime())
})

test('clamps recent month ranges at the end of shorter months', () => {
  const now = new Date(2026, 4, 31, 12).getTime()
  const plan = buildLocalNaturalSearchPlan('最近 3 个月收藏的 React 教程', now)

  assert.equal(plan.dateRange?.label, '最近 3 个月')
  assert.equal(plan.dateRange?.from, new Date(2026, 1, 28).getTime())
  assert.equal(plan.dateRange?.to, new Date(2026, 5, 1).getTime())
})

test('local natural search excludes negated Chinese and dash terms', () => {
  const plan = buildLocalNaturalSearchPlan('找 React 教程 不要视频 -youtube')
  const article = indexBookmarkForSearch(bookmark({
    id: 'article',
    title: 'React Table Tutorial',
    normalizedTitle: 'react table tutorial',
    normalizedUrl: 'example.com/react-table-tutorial',
    path: 'Frontend / Articles'
  }))
  const video = indexBookmarkForSearch(bookmark({
    id: 'video',
    title: 'React Table Video Tutorial',
    normalizedTitle: 'react table video tutorial',
    normalizedUrl: 'youtube.com/watch/react-table',
    domain: 'youtube.com',
    path: 'Frontend / Videos'
  }))
  const resultSets = plan.queries.map((query) => ({
    query,
    results: searchBookmarks(query, [article, video])
  }))

  assert.ok(plan.excludedTerms.includes('视频'))
  assert.ok(plan.excludedTerms.includes('youtube'))
  assert.deepEqual(mergeNaturalSearchResultSets(plan, resultSets).map((item) => item.id), ['article'])
})

test('normalizes AI natural search plan with safe fallback queries and exclusive date end', () => {
  const now = new Date(2026, 3, 30, 12).getTime()
  const fallback = buildLocalNaturalSearchPlan('找最近 3 天的 LLM 论文', now)
  const plan = normalizeNaturalSearchAiPlan({
    queries: ['LLM paper research'],
    keywords: ['LLM', '论文'],
    excluded_terms: ['video'],
    date_range: {
      from: '2026-04-20',
      to: '2026-04-25',
      label: 'AI 指定时间'
    },
    explanation: '按论文关键词匹配'
  }, fallback, now)

  assert.equal(plan.source, 'ai')
  assert.equal(plan.dateRange?.label, '最近 3 天')
  assert.ok(plan.queries.includes('llm paper research'))
  assert.ok(plan.excludedTerms.includes('video'))
})
