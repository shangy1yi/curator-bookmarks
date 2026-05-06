import { pinyin } from 'pinyin-pro'
import type { BookmarkRecord } from '../shared/types.js'
import { normalizeText, stripCommonUrlPrefix } from '../shared/text.js'
import { getEffectiveBookmarkTags, type BookmarkTagRecord } from '../shared/bookmark-tags.js'
import {
  buildSearchTextQuery,
  matchesParsedSearchQuery,
  parseSearchQuery,
  type ParsedSearchQuery
} from '../shared/search-query.js'
import {
  buildContentSnapshotSearchText,
  type ContentSnapshotRecord
} from '../shared/content-snapshot-search.js'

export const MAX_POPUP_SEARCH_RESULTS = 20
export const POPUP_SEARCH_ASYNC_THRESHOLD = 1200
const SEARCH_PREFILTER_THRESHOLD = 1200
const SEARCH_CHUNK_SIZE = 260
const RECENT_SORT_TERMS = new Set(['recent', 'new', 'newest', 'latest', '最近', '新近', '最近优先'])

export interface PopupSearchBookmark extends BookmarkRecord {
  normalizedPath: string
  tagSummary: string
  tagContentType: string
  tagTopics: string[]
  tagTags: string[]
  tagAliases: string[]
  tagPinyinFull: string[]
  tagPinyinInitials: string[]
  searchText: string
}

export interface PopupSearchResult extends PopupSearchBookmark {
  score: number
  matchReasons: string[]
}

export interface CooperativeSearchOptions {
  isActive: () => boolean
  yieldWork?: () => Promise<unknown>
}

interface ParsedPopupSearchQuery extends ParsedSearchQuery {
  normalizedQuery: string
  queryTerms: string[]
  recencyHint: boolean
  hasStructuredFilters: boolean
}

export function indexBookmarkForSearch(
  bookmark: BookmarkRecord,
  tagRecord: BookmarkTagRecord | null = null,
  snapshotRecord: ContentSnapshotRecord | null = null,
  options: { includeFullText?: boolean } = {}
): PopupSearchBookmark {
  const normalizedPath = normalizeText(bookmark.path || '')
  const normalizedDomain = normalizeText(bookmark.domain || '')
  const tagSummary = normalizeText(tagRecord?.summary || '')
  const tagContentType = normalizeText(tagRecord?.contentType || '')
  const tagTopics = normalizeSearchList(tagRecord?.topics)
  const tagTags = normalizeSearchList(getEffectiveBookmarkTags(tagRecord))
  const tagAliases = normalizeSearchList(tagRecord?.aliases)
  const snapshotSearchText = buildContentSnapshotSearchText(snapshotRecord, options)
  const pinyinTokens = buildPinyinSearchTokens([
    bookmark.title,
    bookmark.path,
    ...(tagRecord?.topics || []),
    ...getEffectiveBookmarkTags(tagRecord),
    ...(tagRecord?.aliases || [])
  ])

  return {
    ...bookmark,
    normalizedPath,
    tagSummary,
    tagContentType,
    tagTopics,
    tagTags,
    tagAliases,
    tagPinyinFull: pinyinTokens.full,
    tagPinyinInitials: pinyinTokens.initials,
    searchText: [
      bookmark.normalizedTitle,
      bookmark.normalizedUrl,
      normalizedPath,
      normalizedDomain,
      tagContentType,
      ...tagTopics,
      ...tagTags,
      ...tagAliases,
      ...pinyinTokens.full,
      ...pinyinTokens.initials,
      tagSummary,
      snapshotSearchText
    ]
      .filter(Boolean)
      .join(' ')
  }
}

export function searchBookmarks(
  query: string,
  bookmarks: PopupSearchBookmark[]
): PopupSearchResult[] {
  return searchBookmarksWithLimit(query, bookmarks, MAX_POPUP_SEARCH_RESULTS)
}

export function searchBookmarksUnbounded(
  query: string,
  bookmarks: PopupSearchBookmark[]
): PopupSearchResult[] {
  return searchBookmarksWithLimit(query, bookmarks, 0)
}

function searchBookmarksWithLimit(
  query: string,
  bookmarks: PopupSearchBookmark[],
  limit: number
): PopupSearchResult[] {
  const parsedQuery = parsePopupSearchQuery(query)
  const candidates = getSearchCandidates(bookmarks, parsedQuery)
  const results: PopupSearchResult[] = []
  const bounded = limit > 0

  for (const bookmark of candidates) {
    const match = scoreBookmarkWithReasons(bookmark, parsedQuery)
    if (match.score > 0) {
      const result = {
        ...bookmark,
        score: match.score,
        matchReasons: match.reasons
      }
      if (bounded) {
        appendTopSearchResult(results, result, limit)
      } else {
        results.push(result)
      }
    }
  }

  return bounded ? results : results.sort(compareSearchResults)
}

export async function searchBookmarksCooperatively(
  query: string,
  bookmarks: PopupSearchBookmark[],
  options: CooperativeSearchOptions
): Promise<PopupSearchResult[]> {
  const parsedQuery = parsePopupSearchQuery(query)
  const candidates = await getSearchCandidatesCooperatively(
    bookmarks,
    parsedQuery,
    options
  )
  const results: PopupSearchResult[] = []

  for (let index = 0; index < candidates.length; index += SEARCH_CHUNK_SIZE) {
    assertSearchActive(options)
    const end = Math.min(index + SEARCH_CHUNK_SIZE, candidates.length)

    for (let itemIndex = index; itemIndex < end; itemIndex += 1) {
      const bookmark = candidates[itemIndex]
      const match = scoreBookmarkWithReasons(bookmark, parsedQuery)
      if (match.score > 0) {
        appendTopSearchResult(results, {
          ...bookmark,
          score: match.score,
          matchReasons: match.reasons
        })
      }
    }

    if (end < candidates.length) {
      await yieldSearchWork(options)
    }
  }

  return results
}

export function getQueryTerms(query: string): string[] {
  return [...new Set(String(query || '').split(/\s+/).filter(Boolean))]
}

export function normalizeQuery(value: unknown): string {
  return normalizeText(stripCommonUrlPrefix(value))
}

function parsePopupSearchQuery(query: string): ParsedPopupSearchQuery {
  const parsed = parseSearchQuery(query)
  const recencyHint = parsed.textTerms.some(isRecencyHintTerm)
  const textTerms = parsed.textTerms.filter((term) => !isRecencyHintTerm(term))
  const normalizedQuery = buildSearchTextQuery({ ...parsed, textTerms })
  return {
    ...parsed,
    textTerms,
    normalizedQuery,
    queryTerms: getQueryTerms(normalizedQuery),
    recencyHint,
    hasStructuredFilters: Boolean(
      parsed.siteFilters.length ||
      parsed.folderFilters.length ||
      parsed.typeFilters.length ||
      parsed.excludedTerms.length ||
      parsed.dateRange
    )
  }
}

function isRecencyHintTerm(term: string): boolean {
  const normalized = normalizeText(term).replace(/^sort[:：]/, '')
  return RECENT_SORT_TERMS.has(normalized)
}

export function scoreBookmark(
  bookmark: PopupSearchBookmark,
  normalizedQuery: string,
  queryTerms: string[]
): number {
  return scoreBookmarkWithReasons(bookmark, {
    rawQuery: normalizedQuery,
    normalizedQuery,
    queryTerms,
    siteFilters: [],
    folderFilters: [],
    typeFilters: [],
    textTerms: queryTerms,
    excludedTerms: [],
    dateRange: null,
    chips: [],
    recencyHint: false,
    hasStructuredFilters: false
  }).score
}

function scoreBookmarkWithReasons(
  bookmark: PopupSearchBookmark,
  parsedQuery: ParsedPopupSearchQuery
): { score: number; reasons: string[] } {
  const { normalizedQuery, queryTerms } = parsedQuery
  const title = bookmark.normalizedTitle
  const url = bookmark.normalizedUrl
  const domain = normalizeText(bookmark.domain || '')
  let score = 0
  let matched = false
  const reasons: string[] = []

  if (!matchesStructuredFilters(bookmark, parsedQuery, reasons)) {
    return { score: 0, reasons: [] }
  }

  if (!matchesRequiredPhraseTerms(bookmark, parsedQuery)) {
    return { score: 0, reasons: [] }
  }

  if (!normalizedQuery && !parsedQuery.hasStructuredFilters && !parsedQuery.recencyHint) {
    return { score: 0, reasons: [] }
  }

  if (parsedQuery.hasStructuredFilters) {
    score += 90
    matched = true
  }

  if (normalizedQuery && title === normalizedQuery) {
    score += 620
    matched = true
    addReason(reasons, `命中：标题 ${bookmark.title}`)
  }

  if (normalizedQuery && title.startsWith(normalizedQuery)) {
    score += 420
    matched = true
    addReason(reasons, `命中：标题前缀 ${normalizedQuery}`)
  }

  const titleIndex = normalizedQuery ? title.indexOf(normalizedQuery) : -1
  if (titleIndex !== -1) {
    score += 300 - Math.min(titleIndex, 120)
    matched = true
    addReason(reasons, `命中：标题 ${normalizedQuery}`)
  }

  if (normalizedQuery && (url.startsWith(normalizedQuery) || domain.startsWith(normalizedQuery))) {
    score += 250
    matched = true
    addReason(reasons, `命中：网址 ${normalizedQuery}`)
  }

  const urlIndex = normalizedQuery
    ? Math.max(url.indexOf(normalizedQuery), domain.indexOf(normalizedQuery))
    : -1
  if (urlIndex !== -1) {
    score += 190 - Math.min(urlIndex, 100)
    matched = true
    addReason(reasons, `命中：网址 ${normalizedQuery}`)
  }

  if (normalizedQuery || queryTerms.length) {
    const semanticMatch = scoreSemanticFields(bookmark, normalizedQuery, queryTerms, reasons)
    if (semanticMatch.score > 0) {
      score += semanticMatch.score
      matched = true
    }
  }

  let allTermsPresent = queryTerms.length > 0

  for (const term of queryTerms) {
    let termMatched = false
    const termTitleIndex = title.indexOf(term)
    const termUrlIndex = url.indexOf(term)

    if (termTitleIndex !== -1) {
      score += 72 - Math.min(termTitleIndex, 40)
      termMatched = true
      matched = true
      addReason(reasons, `命中：标题 ${term}`)
    }

    if (termUrlIndex !== -1) {
      score += 45 - Math.min(termUrlIndex, 40)
      termMatched = true
      matched = true
      addReason(reasons, `命中：网址 ${term}`)
    }

    if (
      !termMatched &&
      termMatchedSemanticField(bookmark, term)
    ) {
      termMatched = true
    }

    if (!termMatched) {
      allTermsPresent = false
    }
  }

  if (allTermsPresent && queryTerms.length > 1) {
    score += 120
    insertReason(reasons, buildQueryCoverageReason(queryTerms), 1)
  }

  const approximateMatch = scoreLatinApproximateTerms(bookmark, queryTerms, reasons)
  if (approximateMatch.score > 0) {
    score += approximateMatch.score
    matched = true
  }

  const titleFuzzy = subsequenceScore(title, normalizedQuery)
  const urlFuzzy = subsequenceScore(url, normalizedQuery)
  const fuzzyScore = Math.max(titleFuzzy * 2, urlFuzzy)

  if (fuzzyScore > 0) {
    score += fuzzyScore
    matched = true
    addReason(reasons, `命中：模糊匹配 ${normalizedQuery}`)
  }

  if (normalizedQuery && title.includes(normalizedQuery) && url.includes(normalizedQuery)) {
    score += 38
  }

  if (parsedQuery.recencyHint) {
    const recencyBoost = getBookmarkRecencyBoost(bookmark)
    if (recencyBoost > 0) {
      score += recencyBoost
      matched = true
      insertReason(reasons, '排序：最近添加优先', 0)
    }
  }

  score -= Math.floor(bookmark.title.length / 28)

  return {
    score: matched ? Math.max(score, 0) : 0,
    reasons: prioritizeSearchReasons(reasons, 3)
  }
}

function scoreSemanticFields(
  bookmark: PopupSearchBookmark,
  normalizedQuery: string,
  queryTerms: string[],
  reasons: string[]
): { score: number } {
  let score = 0
  const summaryEnabled = shouldUseSummaryForQuery(normalizedQuery)
  const terms = queryTerms.length ? queryTerms : [normalizedQuery]

  score += scoreListField(bookmark.tagAliases, normalizedQuery, terms, 65, (label) => {
    addReason(reasons, `命中：别名 ${label}`)
  })
  score += scoreListField(bookmark.tagTags, normalizedQuery, terms, 60, (labels) => {
    addReason(reasons, `标签：${labels}`)
  })
  score += scoreListField(bookmark.tagTopics, normalizedQuery, terms, 50, (labels) => {
    addReason(reasons, `主题：${labels}`)
  })
  score += scoreTextField(bookmark.normalizedPath, normalizedQuery, terms, 40, () => {
    addReason(reasons, `命中：文件夹 ${bookmark.path || ''}`.trim())
  })
  score += scoreTextField(bookmark.tagContentType, normalizedQuery, terms, 10, () => {
    addReason(reasons, `命中：类型 ${bookmark.tagContentType}`)
  })
  score += scoreListField(bookmark.tagPinyinInitials, normalizedQuery, terms, 58, () => {
    addReason(reasons, `命中：首字母 ${normalizedQuery}`)
  })
  score += scoreListField(bookmark.tagPinyinFull, normalizedQuery, terms, 52, () => {
    addReason(reasons, `命中：拼音 ${normalizedQuery}`)
  })

  if (summaryEnabled) {
    score += scoreTextField(bookmark.tagSummary, normalizedQuery, terms, 22, () => {
      addReason(reasons, `命中：摘要 ${normalizedQuery}`)
    })
  }

  return { score }
}

function scoreListField(
  values: string[],
  normalizedQuery: string,
  queryTerms: string[],
  weight: number,
  onMatch: (label: string) => void
): number {
  if (!values.length) {
    return 0
  }

  let score = 0
  const matchedLabels: string[] = []
  for (const value of values) {
    if (value === normalizedQuery) {
      score += weight + 22
      matchedLabels.push(value)
    } else if (value.startsWith(normalizedQuery)) {
      score += weight + 10
      matchedLabels.push(value)
    } else if (value.includes(normalizedQuery)) {
      score += weight
      matchedLabels.push(value)
    } else {
      const matchedTerms = queryTerms.filter((term) => value.includes(term))
      if (matchedTerms.length) {
        score += Math.round(weight * (matchedTerms.length / queryTerms.length))
        matchedLabels.push(value)
      }
    }
  }

  if (matchedLabels.length) {
    onMatch(matchedLabels.slice(0, 3).join(' / '))
  }

  return score
}

function scoreTextField(
  value: string,
  normalizedQuery: string,
  queryTerms: string[],
  weight: number,
  onMatch: () => void
): number {
  if (!value) {
    return 0
  }

  if (value === normalizedQuery) {
    onMatch()
    return weight + 16
  }

  if (value.startsWith(normalizedQuery)) {
    onMatch()
    return weight + 8
  }

  if (value.includes(normalizedQuery)) {
    onMatch()
    return weight
  }

  const matchedTerms = queryTerms.filter((term) => value.includes(term))
  if (!matchedTerms.length) {
    return 0
  }

  onMatch()
  return Math.round(weight * (matchedTerms.length / queryTerms.length))
}

function matchesStructuredFilters(
  bookmark: PopupSearchBookmark,
  parsedQuery: ParsedPopupSearchQuery,
  reasons: string[]
): boolean {
  if (!matchesParsedSearchQuery(parsedQuery, {
    searchText: getBookmarkSearchText(bookmark),
    domain: bookmark.domain,
    url: bookmark.normalizedUrl,
    path: bookmark.path,
    type: bookmark.tagContentType,
    dateAdded: bookmark.dateAdded
  })) {
    return false
  }

  if (parsedQuery.siteFilters.length) {
    const domain = normalizeText(bookmark.domain || '')
    const url = bookmark.normalizedUrl || ''
    const matchedSite = parsedQuery.siteFilters.find((filter) =>
      domain.includes(filter) || url.includes(filter)
    )
    if (!matchedSite) {
      return false
    }
    addReason(reasons, `筛选：站点 ${matchedSite}`)
  }

  if (parsedQuery.folderFilters.length) {
    const matchedFolder = parsedQuery.folderFilters.find((filter) =>
      bookmark.normalizedPath.includes(filter)
    )
    if (!matchedFolder) {
      return false
    }
    addReason(reasons, `筛选：文件夹 ${matchedFolder}`)
  }

  if (parsedQuery.typeFilters.length) {
    const matchedType = parsedQuery.typeFilters.find((filter) =>
      bookmark.tagContentType.includes(filter)
    )
    if (!matchedType) {
      return false
    }
    addReason(reasons, `筛选：类型 ${matchedType}`)
  }

  if (parsedQuery.excludedTerms.length) {
    addReason(reasons, `排除：${parsedQuery.excludedTerms.join('、')}`)
  }

  if (parsedQuery.dateRange) {
    addReason(reasons, `筛选：${parsedQuery.dateRange.label}`)
  }

  return true
}

function matchesRequiredPhraseTerms(
  bookmark: PopupSearchBookmark,
  parsedQuery: ParsedPopupSearchQuery
): boolean {
  const phraseTerms = parsedQuery.textTerms.filter((term) => /\s/.test(term))
  if (!phraseTerms.length) {
    return true
  }

  const searchText = getBookmarkSearchText(bookmark)
  return phraseTerms.every((term) => searchText.includes(term))
}

function termMatchedSemanticField(bookmark: PopupSearchBookmark, term: string): boolean {
  return [
    bookmark.normalizedPath,
    bookmark.tagSummary,
    bookmark.tagContentType,
    ...bookmark.tagTopics,
    ...bookmark.tagTags,
    ...bookmark.tagAliases,
    ...bookmark.tagPinyinFull,
    ...bookmark.tagPinyinInitials
  ].some((value) => value.includes(term))
}

function scoreLatinApproximateTerms(
  bookmark: PopupSearchBookmark,
  queryTerms: string[],
  reasons: string[]
): { score: number } {
  const latinTerms = queryTerms.filter(isApproximateLatinTerm)
  if (!latinTerms.length) {
    return { score: 0 }
  }

  const tokens = collectApproximateSearchTokens(bookmark)
  if (!tokens.length) {
    return { score: 0 }
  }

  let score = 0
  for (const term of latinTerms) {
    if (tokens.some((token) => token.includes(term))) {
      continue
    }

    const match = findClosestLatinToken(term, tokens)
    if (!match) {
      continue
    }

    score += Math.max(24, 58 - match.distance * 12)
    addReason(reasons, `命中：近似 ${match.token} / ${term}`)
  }

  return { score }
}

function isApproximateLatinTerm(term: string): boolean {
  return /^[a-z0-9][a-z0-9+.#-]{3,}$/i.test(term)
}

function collectApproximateSearchTokens(bookmark: PopupSearchBookmark): string[] {
  const values = [
    bookmark.normalizedTitle,
    bookmark.normalizedUrl,
    normalizeText(bookmark.domain || ''),
    bookmark.normalizedPath,
    bookmark.tagSummary,
    bookmark.tagContentType,
    ...bookmark.tagTopics,
    ...bookmark.tagTags,
    ...bookmark.tagAliases
  ]
  const tokens = new Set<string>()

  for (const value of values) {
    const matches = String(value || '').match(/[a-z0-9][a-z0-9+.#-]{2,}/gi) || []
    for (const match of matches) {
      const token = normalizeText(match)
      if (token.length >= 3 && token.length <= 48) {
        tokens.add(token)
      }
    }
  }

  return [...tokens]
}

function findClosestLatinToken(
  term: string,
  tokens: string[]
): { token: string; distance: number } | null {
  let bestMatch: { token: string; distance: number } | null = null
  const maxDistance = getApproximateDistanceLimit(term)

  for (const token of tokens) {
    if (
      Math.abs(token.length - term.length) > maxDistance ||
      token[0] !== term[0]
    ) {
      continue
    }

    const distance = damerauLevenshteinDistance(term, token, maxDistance)
    if (distance > maxDistance) {
      continue
    }

    if (!bestMatch || distance < bestMatch.distance || token.length < bestMatch.token.length) {
      bestMatch = { token, distance }
    }
  }

  return bestMatch
}

function getApproximateDistanceLimit(term: string): number {
  if (term.length >= 8) {
    return 2
  }
  return term.length >= 5 ? 2 : 1
}

function damerauLevenshteinDistance(left: string, right: string, limit: number): number {
  const previousPreviousRow = new Array(right.length + 1).fill(0)
  let previousRow = Array.from({ length: right.length + 1 }, (_value, index) => index)

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const currentRow = [leftIndex]
    let rowBest = currentRow[0]

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
      let distance = Math.min(
        previousRow[rightIndex] + 1,
        currentRow[rightIndex - 1] + 1,
        previousRow[rightIndex - 1] + substitutionCost
      )

      if (
        leftIndex > 1 &&
        rightIndex > 1 &&
        left[leftIndex - 1] === right[rightIndex - 2] &&
        left[leftIndex - 2] === right[rightIndex - 1]
      ) {
        distance = Math.min(distance, previousPreviousRow[rightIndex - 2] + 1)
      }

      currentRow[rightIndex] = distance
      rowBest = Math.min(rowBest, distance)
    }

    if (rowBest > limit) {
      return limit + 1
    }

    previousPreviousRow.splice(0, previousPreviousRow.length, ...previousRow)
    previousRow = currentRow
  }

  return previousRow[right.length] ?? limit + 1
}

function shouldUseSummaryForQuery(normalizedQuery: string): boolean {
  if (normalizedQuery.length < 2) {
    return false
  }
  return !/^[\u3400-\u9fff]$/u.test(normalizedQuery)
}

function normalizeSearchList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return []
  }
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))]
}

function buildPinyinSearchTokens(values: unknown[]): { full: string[]; initials: string[] } {
  const full = new Set<string>()
  const initials = new Set<string>()

  for (const value of values) {
    const text = String(value || '')
    const matches = text.match(/[\u3400-\u9fff]+/gu) || []
    for (const match of matches) {
      const fullToken = buildPinyinToken(match, {})
      const initialsToken = buildPinyinToken(match, { pattern: 'first' })
      if (fullToken) {
        full.add(fullToken)
      }
      if (initialsToken) {
        initials.add(initialsToken)
      }
    }
  }

  return {
    full: [...full],
    initials: [...initials]
  }
}

function buildPinyinToken(text: string, options: Record<string, unknown>): string {
  return normalizeText(
    pinyin(text, {
      toneType: 'none',
      type: 'array',
      ...options
    }).join('')
  )
}

function addReason(reasons: string[], reason: string): void {
  const text = normalizeReasonText(reason)
  if (text && !reasons.includes(text)) {
    reasons.push(text)
  }
}

function insertReason(reasons: string[], reason: string, index: number): void {
  const text = normalizeReasonText(reason)
  if (!text || reasons.includes(text)) {
    return
  }

  reasons.splice(Math.max(0, Math.min(index, reasons.length)), 0, text)
}

function normalizeReasonText(reason: string): string {
  const text = String(reason || '').replace(/\s+/g, ' ').trim()
  return text
}

function prioritizeSearchReasons(reasons: string[], limit: number): string[] {
  const visibleLimit = Math.max(0, limit)
  if (!visibleLimit || reasons.length <= visibleLimit) {
    return reasons.slice(0, visibleLimit)
  }

  const explicitReasons = reasons.filter(isExplicitSearchReason)
  const supportingReasons = reasons.filter((reason) => !isExplicitSearchReason(reason))
  return [...explicitReasons, ...supportingReasons].slice(0, visibleLimit)
}

function isExplicitSearchReason(reason: string): boolean {
  return /^(筛选|排除|排序)：/.test(reason)
}

function buildQueryCoverageReason(queryTerms: string[]): string {
  const termSummary = formatReasonTerms(queryTerms)
  return termSummary ? `匹配：包含全部关键词 ${termSummary}` : ''
}

function formatReasonTerms(terms: string[]): string {
  const uniqueTerms = [...new Set(terms.map((term) => normalizeText(term)).filter(Boolean))]
  const visibleTerms = uniqueTerms.slice(0, 4)
  if (!visibleTerms.length) {
    return ''
  }

  const suffix = uniqueTerms.length > visibleTerms.length ? ` 等 ${uniqueTerms.length} 个` : ''
  return `${visibleTerms.join(' / ')}${suffix}`
}

function getBookmarkRecencyBoost(bookmark: PopupSearchBookmark): number {
  const dateAdded = Number(bookmark.dateAdded)
  if (!Number.isFinite(dateAdded) || dateAdded <= 0) {
    return 0
  }

  const ageDays = Math.max(0, (Date.now() - dateAdded) / (24 * 60 * 60 * 1000))
  if (ageDays <= 7) {
    return 120
  }
  if (ageDays <= 30) {
    return 90
  }
  if (ageDays <= 90) {
    return 58
  }
  if (ageDays <= 180) {
    return 30
  }
  return 8
}

function getSearchCandidates(
  bookmarks: PopupSearchBookmark[],
  parsedQuery: ParsedPopupSearchQuery
): PopupSearchBookmark[] {
  if (bookmarks.length < SEARCH_PREFILTER_THRESHOLD) {
    return bookmarks
  }

  const requiredTerms = getCandidateRequiredTerms(parsedQuery)
  const directMatches = bookmarks.filter((bookmark) => {
    if (!matchesSearchCandidateFilters(bookmark, parsedQuery)) {
      return false
    }
    const searchText = getBookmarkSearchText(bookmark)
    return requiredTerms.every((term) => !term || searchText.includes(term))
  })

  if (directMatches.length) {
    return directMatches
  }

  const prefix = parsedQuery.normalizedQuery.slice(0, Math.min(parsedQuery.normalizedQuery.length, 3))
  if (!prefix) {
    return bookmarks
  }

  const prefixMatches = bookmarks.filter((bookmark) => {
    if (!matchesSearchCandidateFilters(bookmark, parsedQuery)) {
      return false
    }
    const searchText = getBookmarkSearchText(bookmark)
    return searchText.includes(prefix)
  })

  return prefixMatches.length ? prefixMatches : bookmarks
}

async function getSearchCandidatesCooperatively(
  bookmarks: PopupSearchBookmark[],
  parsedQuery: ParsedPopupSearchQuery,
  options: CooperativeSearchOptions
): Promise<PopupSearchBookmark[]> {
  if (bookmarks.length < SEARCH_PREFILTER_THRESHOLD) {
    return bookmarks
  }

  const requiredTerms = getCandidateRequiredTerms(parsedQuery)
  const directMatches: PopupSearchBookmark[] = []

  for (let index = 0; index < bookmarks.length; index += SEARCH_CHUNK_SIZE) {
    assertSearchActive(options)
    const end = Math.min(index + SEARCH_CHUNK_SIZE, bookmarks.length)
    for (let itemIndex = index; itemIndex < end; itemIndex += 1) {
      const bookmark = bookmarks[itemIndex]
      if (!matchesSearchCandidateFilters(bookmark, parsedQuery)) {
        continue
      }
      const searchText = getBookmarkSearchText(bookmark)
      if (requiredTerms.every((term) => !term || searchText.includes(term))) {
        directMatches.push(bookmark)
      }
    }

    if (end < bookmarks.length) {
      await yieldSearchWork(options)
    }
  }

  if (directMatches.length) {
    return directMatches
  }

  const prefix = parsedQuery.normalizedQuery.slice(0, Math.min(parsedQuery.normalizedQuery.length, 3))
  if (!prefix) {
    return bookmarks
  }

  const prefixMatches: PopupSearchBookmark[] = []
  for (let index = 0; index < bookmarks.length; index += SEARCH_CHUNK_SIZE) {
    assertSearchActive(options)
    const end = Math.min(index + SEARCH_CHUNK_SIZE, bookmarks.length)
    for (let itemIndex = index; itemIndex < end; itemIndex += 1) {
      const bookmark = bookmarks[itemIndex]
      if (!matchesSearchCandidateFilters(bookmark, parsedQuery)) {
        continue
      }
      const searchText = getBookmarkSearchText(bookmark)
      if (searchText.includes(prefix)) {
        prefixMatches.push(bookmark)
      }
    }

    if (end < bookmarks.length) {
      await yieldSearchWork(options)
    }
  }

  return prefixMatches.length ? prefixMatches : bookmarks
}

function getCandidateRequiredTerms(parsedQuery: ParsedPopupSearchQuery): string[] {
  return parsedQuery.textTerms.length
    ? parsedQuery.textTerms
    : [parsedQuery.normalizedQuery]
}

function matchesSearchCandidateFilters(
  bookmark: PopupSearchBookmark,
  parsedQuery: ParsedPopupSearchQuery
): boolean {
  return matchesParsedSearchQuery(parsedQuery, {
    searchText: getBookmarkSearchText(bookmark),
    domain: bookmark.domain,
    url: bookmark.normalizedUrl,
    path: bookmark.path,
    type: bookmark.tagContentType,
    dateAdded: bookmark.dateAdded
  })
}

function getBookmarkSearchText(bookmark: PopupSearchBookmark): string {
  return bookmark.searchText || `${bookmark.normalizedTitle} ${bookmark.normalizedUrl}`
}

function appendTopSearchResult(results: PopupSearchResult[], result: PopupSearchResult, limit = MAX_POPUP_SEARCH_RESULTS): void {
  results.push(result)
  results.sort(compareSearchResults)
  if (results.length > limit) {
    results.length = limit
  }
}

function compareSearchResults(left: PopupSearchResult, right: PopupSearchResult): number {
  if (right.score !== left.score) {
    return right.score - left.score
  }

  const dateDelta = Number(right.dateAdded || 0) - Number(left.dateAdded || 0)
  if (dateDelta !== 0) {
    return dateDelta
  }

  if (left.title.length !== right.title.length) {
    return left.title.length - right.title.length
  }

  return left.path.localeCompare(right.path, 'zh-Hans-CN')
}

function subsequenceScore(text: string, query: string): number {
  if (!text || !query || query.length < 2) {
    return 0
  }

  let textIndex = 0
  let queryIndex = 0
  let streak = 0
  let bestStreak = 0
  let gapPenalty = 0

  while (textIndex < text.length && queryIndex < query.length) {
    if (text[textIndex] === query[queryIndex]) {
      queryIndex += 1
      streak += 1
      bestStreak = Math.max(bestStreak, streak)
    } else if (queryIndex > 0) {
      streak = 0
      gapPenalty += 1
    }

    textIndex += 1
  }

  if (queryIndex !== query.length) {
    return 0
  }

  return 40 + query.length * 10 + bestStreak * 10 - gapPenalty
}

function assertSearchActive(options: CooperativeSearchOptions): void {
  if (!options.isActive()) {
    throw new Error('search-cancelled')
  }
}

function yieldSearchWork(options: CooperativeSearchOptions): Promise<unknown> {
  if (options.yieldWork) {
    return options.yieldWork()
  }

  return Promise.resolve()
}
