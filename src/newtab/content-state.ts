import type { BookmarkTagIndex, BookmarkTagRecord } from '../shared/bookmark-tags.js'
import type {
  ContentSnapshotIndex,
  ContentSnapshotRecord
} from '../shared/content-snapshots.js'
import type { BookmarkRecord } from '../shared/types.js'
import type { NaturalSearchPlan, NaturalSearchResultSet } from '../popup/natural-search.js'
import { extractDomain } from '../shared/text.js'
import { searchBookmarksTopK, type PopupSearchBookmark } from '../popup/search.js'

export type NewTabContentState =
  | { type: 'loading' }
  | { type: 'error'; message: string }
  | { type: 'missing-folder'; reason: 'none-selected' | 'selected-unavailable' }
  | { type: 'bookmarks' }

export interface ResolveNewTabContentStateInput {
  loading: boolean
  error: string
  selectedFolderCount: number
  visibleFolderCount: number
}

export interface NewTabPageModule {
  id: string
  element: HTMLElement
  placement: 'utility' | 'primary'
}

export interface NewTabPageOptions {
  modules: NewTabPageModule[]
}

export interface NewTabSearchIndexBookmark {
  id: string
  title?: string
  url?: string
  dateAdded?: number
}

export interface NewTabSearchIndexSection {
  title: string
  path: string
  bookmarks: NewTabSearchIndexBookmark[]
}

export interface NewTabSearchIndexSource {
  bookmarks: BookmarkRecord[]
  tagIndex?: BookmarkTagIndex | null
  snapshotIndex?: ContentSnapshotIndex | null
}

export interface NewTabSourceNavigationSection {
  id: string
  title: string
  path: string
  bookmarks: NewTabSearchIndexBookmark[]
}

export interface NewTabSourceNavigationItem {
  id: string
  anchorId: string
  title: string
  path: string
  bookmarkCount: number
}

export interface NewTabSearchIndexEntry {
  id: string
  title: string
  url: string
  folderTitle: string
  folderPath: string
  normalizedTitle: string
  normalizedUrl: string
  normalizedFolderTitle: string
  normalizedSearchText: string
  order: number
  sourceBookmark?: BookmarkRecord
  sourceTagRecord?: BookmarkTagRecord | null
  sourceSnapshotRecord?: ContentSnapshotRecord | null
}

export interface NewTabPopupSearchSourceEntry {
  entryId: string
  bookmark: BookmarkRecord
  tagRecord: BookmarkTagRecord | null
  snapshotRecord: ContentSnapshotRecord | null
}

export interface NewTabPreparedSearchIndex {
  entries: NewTabSearchIndexEntry[]
  entriesById: Map<string, NewTabSearchIndexEntry>
  popupSearchEntries: NewTabPopupSearchSourceEntry[]
  popupSearchBookmarks?: PopupSearchBookmark[]
  popupSearchPinyinReady?: boolean
  supportsPopupSearch: boolean
}

export interface SearchBookmarkSuggestion {
  id: string
  title: string
  url: string
  folderTitle: string
  folderPath: string
  score: number
  order: number
}

export interface PortalBookmarkActivityRecord {
  bookmarkId: string
  openCount: number
  lastOpenedAt: number
}

export interface PortalBookmarkSourceItem {
  id: string
  title?: string
  url?: string
  dateAdded?: number
}

export interface PortalQuickAccessItem {
  id: string
  reason: 'pinned' | 'frequent' | 'added'
  detail: string
  badge: string
}

export interface PortalQuickAccessInput {
  bookmarks: PortalBookmarkSourceItem[]
  pinnedIds: string[]
  records: Record<string, PortalBookmarkActivityRecord>
  now: number
  itemLimit: number
  showFrequent: boolean
  showRecent: boolean
}

export interface BookmarkTreeSourceItem extends PortalBookmarkSourceItem {
  children?: BookmarkTreeSourceItem[]
}

export interface MissingFolderViewOptions {
  creatingFolder: boolean
  reason: 'none-selected' | 'selected-unavailable'
  onCreateFolder: () => void
  onOpenFolderSettings: () => void
}

export interface VerticalCenterCollisionOffsetInput {
  utilityBottom: number
  contentTop: number
  minimumGap?: number
}

export interface AdaptiveSearchOffsetBoundsInput {
  currentOffsetY: number
  searchTop: number
  searchBottom: number
  viewportTop: number
  viewportBottom: number
  previousModuleBottom?: number
  primaryContentTop?: number
  minimumGap?: number
  minimumRange?: number
  absoluteMin?: number
  absoluteMax?: number
}

export interface AdaptiveSearchOffsetBounds {
  min: number
  max: number
}

export interface AutoCenteredSearchOffsetInput {
  currentOffsetY: number
  searchTop: number
  searchBottom: number
  viewportTop: number
  viewportBottom: number
  previousModuleBottom?: number
  nextModuleTop?: number
  minimumGap?: number
  minOffsetY?: number
  maxOffsetY?: number
  fallbackOffsetY?: number
}

export interface AdaptiveSearchWidthBoundsInput {
  viewportWidth: number
  containerWidth: number
  minWidthVw?: number
  maxWidthVw?: number
  minWidthPx?: number
}

const DEFAULT_VERTICAL_CENTER_COLLISION_GAP = 12
const DEFAULT_ADAPTIVE_SEARCH_OFFSET_GAP = 12
const DEFAULT_ADAPTIVE_SEARCH_OFFSET_MINIMUM_RANGE = 24
const DEFAULT_ADAPTIVE_SEARCH_OFFSET_MIN = -240
const DEFAULT_ADAPTIVE_SEARCH_OFFSET_MAX = 240
const DEFAULT_ADAPTIVE_SEARCH_WIDTH_MIN_VW = 16
const DEFAULT_ADAPTIVE_SEARCH_WIDTH_MAX_VW = 72
const DEFAULT_ADAPTIVE_SEARCH_WIDTH_MIN_PX = 220

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallback
  }
  return Math.max(min, Math.min(max, Math.round(numericValue)))
}

export function getVerticalCenterCollisionOffset({
  utilityBottom,
  contentTop,
  minimumGap = DEFAULT_VERTICAL_CENTER_COLLISION_GAP
}: VerticalCenterCollisionOffsetInput): number {
  const requiredTop = utilityBottom + Math.max(0, minimumGap)
  const offset = Math.ceil(requiredTop - contentTop)
  if (!Number.isFinite(offset)) {
    return 0
  }
  return Math.max(0, offset)
}

export function getAdaptiveSearchOffsetBounds({
  currentOffsetY,
  searchTop,
  searchBottom,
  viewportTop,
  viewportBottom,
  previousModuleBottom,
  primaryContentTop,
  minimumGap = DEFAULT_ADAPTIVE_SEARCH_OFFSET_GAP,
  minimumRange = DEFAULT_ADAPTIVE_SEARCH_OFFSET_MINIMUM_RANGE,
  absoluteMin = DEFAULT_ADAPTIVE_SEARCH_OFFSET_MIN,
  absoluteMax = DEFAULT_ADAPTIVE_SEARCH_OFFSET_MAX
}: AdaptiveSearchOffsetBoundsInput): AdaptiveSearchOffsetBounds {
  const safeGap = Math.max(0, minimumGap)
  const minBound = Math.min(absoluteMin, absoluteMax)
  const maxBound = Math.max(absoluteMin, absoluteMax)
  const currentOffset = Number.isFinite(currentOffsetY) ? currentOffsetY : 0
  const safeViewportTop = Number.isFinite(viewportTop) ? viewportTop : 0
  const safeViewportBottom = Number.isFinite(viewportBottom) ? viewportBottom : safeViewportTop
  const topCandidates = [safeViewportTop + safeGap]

  if (Number.isFinite(previousModuleBottom)) {
    topCandidates.push(Number(previousModuleBottom) + safeGap)
  }

  const bottomCandidates = [safeViewportBottom - safeGap]
  if (Number.isFinite(primaryContentTop)) {
    bottomCandidates.push(Number(primaryContentTop) - safeGap)
  }

  const minimumTop = Math.max(...topCandidates)
  const maximumBottom = Math.min(...bottomCandidates)
  const measuredMin = Math.floor(currentOffset + minimumTop - searchTop)
  const measuredMax = Math.ceil(currentOffset + maximumBottom - searchBottom)

  if (!Number.isFinite(measuredMin) || !Number.isFinite(measuredMax)) {
    const fallback = Math.min(maxBound, Math.max(minBound, currentOffset))
    return { min: fallback, max: fallback }
  }

  const min = Math.min(maxBound, Math.max(minBound, measuredMin))
  const max = Math.min(maxBound, Math.max(minBound, measuredMax))
  if (max < min) {
    const fallback = Math.min(maxBound, Math.max(minBound, currentOffset))
    const halfRange = Math.max(1, Math.ceil(minimumRange / 2))
    return {
      min: Math.max(minBound, fallback - halfRange),
      max: Math.min(maxBound, fallback + halfRange)
    }
  }

  return { min, max }
}

export function getAutoCenteredSearchOffsetY({
  currentOffsetY,
  searchTop,
  searchBottom,
  viewportTop,
  viewportBottom,
  previousModuleBottom,
  nextModuleTop,
  minimumGap = DEFAULT_ADAPTIVE_SEARCH_OFFSET_GAP,
  minOffsetY = DEFAULT_ADAPTIVE_SEARCH_OFFSET_MIN,
  maxOffsetY = DEFAULT_ADAPTIVE_SEARCH_OFFSET_MAX,
  fallbackOffsetY = currentOffsetY
}: AutoCenteredSearchOffsetInput): number {
  const min = Math.min(minOffsetY, maxOffsetY)
  const max = Math.max(minOffsetY, maxOffsetY)
  const fallback = clampNumber(fallbackOffsetY, min, max, 0)
  const safeGap = Math.max(0, minimumGap)
  const safeViewportTop = Number.isFinite(viewportTop) ? viewportTop : 0
  const safeViewportBottom = Number.isFinite(viewportBottom) ? viewportBottom : safeViewportTop
  const topCandidates = [safeViewportTop + safeGap]
  const bottomCandidates = [safeViewportBottom - safeGap]

  if (Number.isFinite(previousModuleBottom)) {
    topCandidates.push(Number(previousModuleBottom) + safeGap)
  }
  if (Number.isFinite(nextModuleTop)) {
    bottomCandidates.push(Number(nextModuleTop) - safeGap)
  }

  const availableTop = Math.max(...topCandidates)
  const availableBottom = Math.min(...bottomCandidates)
  const searchHeight = searchBottom - searchTop

  if (
    !Number.isFinite(currentOffsetY) ||
    !Number.isFinite(searchTop) ||
    !Number.isFinite(searchBottom) ||
    !Number.isFinite(searchHeight) ||
    searchHeight <= 0 ||
    !Number.isFinite(availableTop) ||
    !Number.isFinite(availableBottom) ||
    availableBottom <= availableTop
  ) {
    return fallback
  }

  const centeredTop = availableTop + ((availableBottom - availableTop - searchHeight) / 2)
  const offset = Math.round(currentOffsetY + centeredTop - searchTop)
  return clampNumber(offset, min, max, fallback)
}

export function getAdaptiveSearchWidthBounds({
  viewportWidth,
  containerWidth,
  minWidthVw = DEFAULT_ADAPTIVE_SEARCH_WIDTH_MIN_VW,
  maxWidthVw = DEFAULT_ADAPTIVE_SEARCH_WIDTH_MAX_VW,
  minWidthPx = DEFAULT_ADAPTIVE_SEARCH_WIDTH_MIN_PX
}: AdaptiveSearchWidthBoundsInput): { min: number; max: number } {
  const min = Math.max(1, Math.floor(Math.min(minWidthVw, maxWidthVw)))
  const absoluteMax = Math.max(min, Math.ceil(Math.max(minWidthVw, maxWidthVw)))
  const safeViewportWidth = Math.max(1, viewportWidth)
  const safeContainerWidth = Math.max(0, containerWidth)
  const minWidthPercent = Math.ceil((Math.max(0, minWidthPx) / safeViewportWidth) * 100)
  const availableWidthPercent = Math.floor((safeContainerWidth / safeViewportWidth) * 100)
  const max = Math.min(
    absoluteMax,
    Math.max(min, minWidthPercent, availableWidthPercent)
  )

  return { min, max }
}

export function resolveNewTabContentState(
  input: ResolveNewTabContentStateInput
): NewTabContentState {
  if (input.loading) {
    return { type: 'loading' }
  }

  if (input.error) {
    return { type: 'error', message: input.error }
  }

  if (!input.visibleFolderCount) {
    return {
      type: 'missing-folder',
      reason: input.selectedFolderCount > 0 ? 'selected-unavailable' : 'none-selected'
    }
  }

  return { type: 'bookmarks' }
}

export interface NewTabSearchSuggestionOptions {
  now?: number
  naturalSearchPlan?: NaturalSearchPlan | null
}

export function buildNewTabSearchIndex(
  source: NewTabSearchIndexSection[] | NewTabSearchIndexSource
): NewTabSearchIndexEntry[] {
  if (!Array.isArray(source)) {
    return buildNewTabSearchIndexFromBookmarks(source)
  }

  const entries: NewTabSearchIndexEntry[] = []
  let order = 0

  for (const section of source) {
    const folderTitle = section.title || '未命名文件夹'
    const folderPath = section.path || section.title || ''
    const normalizedFolderTitle = normalizeNewTabSearchText(folderTitle)

    for (const bookmark of section.bookmarks) {
      const url = String(bookmark.url || '').trim()
      if (!url) {
        continue
      }

      const title = String(bookmark.title || '').trim() || url
      entries.push({
        id: String(bookmark.id),
        title,
        url,
        folderTitle,
        folderPath,
        normalizedTitle: normalizeNewTabSearchText(title),
        normalizedUrl: normalizeNewTabSearchText(url),
        normalizedFolderTitle,
        normalizedSearchText: buildNewTabEntrySearchText({
          title,
          url,
          folderTitle,
          folderPath
        }),
        order
      })
      order += 1
    }
  }

  return entries
}

export function prepareNewTabSearchIndex(index: NewTabSearchIndexEntry[]): NewTabPreparedSearchIndex {
  const entriesById = new Map<string, NewTabSearchIndexEntry>()
  const popupSearchEntries: NewTabPopupSearchSourceEntry[] = []
  let supportsPopupSearch = true

  for (const entry of index) {
    entriesById.set(entry.id, entry)
    if (!entry.sourceBookmark) {
      supportsPopupSearch = false
      continue
    }
    popupSearchEntries.push({
      entryId: entry.id,
      bookmark: entry.sourceBookmark,
      tagRecord: entry.sourceTagRecord || null,
      snapshotRecord: entry.sourceSnapshotRecord || null
    })
  }

  return {
    entries: index,
    entriesById,
    popupSearchEntries,
    supportsPopupSearch
  }
}

function buildNewTabSearchIndexFromBookmarks({
  bookmarks,
  tagIndex = null,
  snapshotIndex = null
}: NewTabSearchIndexSource): NewTabSearchIndexEntry[] {
  const tagRecords = tagIndex?.records || {}
  const snapshotRecords = snapshotIndex?.records || {}

  return bookmarks
    .map((bookmark, order): NewTabSearchIndexEntry | null => {
      const url = String(bookmark.url || '').trim()
      if (!url) {
        return null
      }

      const title = String(bookmark.title || '').trim() || url
      const folderPath = String(bookmark.path || '').trim()
      const folderTitle = getNewTabSearchFolderTitle(folderPath)
      const tagRecord = tagRecords[bookmark.id] || null
      const snapshotRecord = snapshotRecords[bookmark.id] || null
      return {
        id: String(bookmark.id),
        title,
        url,
        folderTitle,
        folderPath,
        normalizedTitle: normalizeNewTabSearchText(bookmark.normalizedTitle || title),
        normalizedUrl: normalizeNewTabSearchText(bookmark.normalizedUrl || url),
        normalizedFolderTitle: normalizeNewTabSearchText(folderTitle),
        normalizedSearchText: buildNewTabEntrySearchText({
          bookmark,
          title,
          url,
          folderTitle,
          folderPath,
          tagRecord,
          snapshotRecord
        }),
        order,
        sourceBookmark: bookmark,
        sourceTagRecord: tagRecord,
        sourceSnapshotRecord: snapshotRecord
      }
    })
    .filter((entry): entry is NewTabSearchIndexEntry => Boolean(entry))
}

function buildNewTabEntrySearchText({
  bookmark,
  title,
  url,
  folderTitle,
  folderPath,
  tagRecord = null,
  snapshotRecord = null
}: {
  bookmark?: BookmarkRecord
  title: string
  url: string
  folderTitle: string
  folderPath: string
  tagRecord?: BookmarkTagRecord | null
  snapshotRecord?: ContentSnapshotRecord | null
}): string {
  return [
    title,
    url,
    bookmark?.normalizedTitle,
    bookmark?.normalizedUrl,
    bookmark?.domain,
    folderTitle,
    folderPath,
    tagRecord?.summary,
    tagRecord?.contentType,
    ...(tagRecord?.topics || []),
    ...(tagRecord?.tags || []),
    ...(tagRecord?.manualTags || []),
    ...(tagRecord?.aliases || []),
    snapshotRecord?.title,
    snapshotRecord?.summary,
    snapshotRecord?.canonicalUrl,
    snapshotRecord?.finalUrl,
    snapshotRecord?.contentType,
    ...(snapshotRecord?.headings || [])
  ]
    .map((value) => normalizeNewTabSearchText(String(value || '')))
    .filter(Boolean)
    .join(' ')
}

function getNewTabSearchFolderTitle(path: string): string {
  const parts = String(path || '').split('/').map((part) => part.trim()).filter(Boolean)
  return parts.at(-1) || '未归档路径'
}

export function buildNewTabSourceNavigationItems(
  sections: NewTabSourceNavigationSection[]
): NewTabSourceNavigationItem[] {
  return sections
    .map((section) => {
      const id = String(section.id || '').trim()
      if (!id) {
        return null
      }

      const title = String(section.title || '').trim() || '未命名文件夹'
      return {
        id,
        anchorId: getNewTabSourceAnchorId(id),
        title,
        path: String(section.path || title).trim() || title,
        bookmarkCount: section.bookmarks.filter((bookmark) => String(bookmark.url || '').trim()).length
      }
    })
    .filter((item): item is NewTabSourceNavigationItem => Boolean(item))
}

export function getNewTabSourceAnchorId(sourceId: string): string {
  const normalizedId = String(sourceId || '').trim()
  const safeId = normalizedId
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `newtab-source-${safeId || 'folder'}`
}

export function getSearchBookmarkSuggestionsFromIndex(
  query: string,
  index: NewTabSearchIndexEntry[] | NewTabPreparedSearchIndex,
  limit: number,
  _options: NewTabSearchSuggestionOptions = {}
): SearchBookmarkSuggestion[] {
  const normalizedQuery = normalizeNewTabSearchText(query)
  if (!normalizedQuery || limit <= 0) {
    return []
  }

  const preparedIndex = Array.isArray(index) ? prepareNewTabSearchIndex(index) : index
  const popupBookmarks = getFallbackPopupSearchBookmarks(preparedIndex.entries)
  const results = searchBookmarksTopK(query, popupBookmarks, limit)
  return results
    .map((result) => getSuggestionFromFallbackPopupResult(preparedIndex, result.id, result.score))
    .filter((suggestion): suggestion is SearchBookmarkSuggestion => Boolean(suggestion))
}

export async function getPopupSearchBookmarkSuggestionsFromIndex(
  query: string,
  index: NewTabSearchIndexEntry[] | NewTabPreparedSearchIndex,
  limit: number,
  options: NewTabSearchSuggestionOptions = {}
): Promise<SearchBookmarkSuggestion[]> {
  const normalizedQuery = normalizeNewTabSearchText(query)
  if (!normalizedQuery || limit <= 0) {
    return []
  }

  const preparedIndex = Array.isArray(index) ? prepareNewTabSearchIndex(index) : index
  if (!preparedIndex.supportsPopupSearch || !preparedIndex.popupSearchEntries.length) {
    return getSearchBookmarkSuggestionsFromIndex(query, preparedIndex, limit, options)
  }

  const {
    indexBookmarkForSearch,
    searchBookmarksTopK
  } = await import('../popup/search.js')
  const popupBookmarks = getPreparedPopupSearchBookmarks(preparedIndex, indexBookmarkForSearch)
  await ensurePopupBookmarksHavePinyinIfNeeded(query, preparedIndex, popupBookmarks)

  return searchBookmarksTopK(query, popupBookmarks, limit)
    .map((result) => getSuggestionFromPopupResult(preparedIndex, result.id, result.score))
    .filter((suggestion): suggestion is SearchBookmarkSuggestion => Boolean(suggestion))
}

export async function getNaturalSearchBookmarkSuggestionsFromIndex(
  query: string,
  index: NewTabSearchIndexEntry[] | NewTabPreparedSearchIndex,
  limit: number,
  options: NewTabSearchSuggestionOptions = {}
): Promise<SearchBookmarkSuggestion[]> {
  const normalizedQuery = normalizeNewTabSearchText(query)
  if (!normalizedQuery || limit <= 0) {
    return []
  }

  const preparedIndex = Array.isArray(index) ? prepareNewTabSearchIndex(index) : index
  if (!preparedIndex.supportsPopupSearch || !preparedIndex.popupSearchEntries.length) {
    return getSearchBookmarkSuggestionsFromIndex(query, preparedIndex, limit, options)
  }

  const {
    indexBookmarkForSearch,
    searchBookmarksTopK
  } = await import('../popup/search.js')
  const {
    buildLocalNaturalSearchPlan,
    filterBookmarksByNaturalDateRange,
    mergeNaturalSearchResultSets
  } = await import('../popup/natural-search.js')

  const plan = options.naturalSearchPlan || buildLocalNaturalSearchPlan(query, options.now)
  const popupBookmarks = getPreparedPopupSearchBookmarks(preparedIndex, indexBookmarkForSearch)
  const naturalQueriesNeedingPinyin = [query, ...plan.queries].some((value) => value)
  if (naturalQueriesNeedingPinyin) {
    await ensurePopupBookmarksHavePinyinIfNeeded(query, preparedIndex, popupBookmarks)
    for (const naturalQuery of plan.queries) {
      await ensurePopupBookmarksHavePinyinIfNeeded(naturalQuery, preparedIndex, popupBookmarks)
    }
  }
  const bookmarks = filterBookmarksByNaturalDateRange(popupBookmarks, plan)
  const resultSets: NaturalSearchResultSet[] = []
  const seenQueries = new Set<string>()

  const directQuery = normalizeNewTabSearchText(query)
  if (directQuery) {
    const directResults = searchBookmarksTopK(query, bookmarks, limit)
    if (directResults.length) {
      resultSets.push({ query, results: directResults })
      seenQueries.add(directQuery)
    }
  }

  for (const naturalQuery of plan.queries) {
    const normalizedNaturalQuery = normalizeNewTabSearchText(naturalQuery)
    if (!normalizedNaturalQuery || seenQueries.has(normalizedNaturalQuery)) {
      continue
    }

    seenQueries.add(normalizedNaturalQuery)
    const results = searchBookmarksTopK(naturalQuery, bookmarks, limit)
    if (results.length) {
      resultSets.push({ query: naturalQuery, results })
    }
  }

  if (!resultSets.length) {
    return []
  }

  return mergeNaturalSearchResultSets(plan, resultSets)
    .map((result) => getSuggestionFromPopupResult(preparedIndex, result.id, result.score))
    .filter((suggestion): suggestion is SearchBookmarkSuggestion => Boolean(suggestion))
    .slice(0, limit)
}

function getPreparedPopupSearchBookmarks(
  index: NewTabPreparedSearchIndex,
  indexBookmarkForSearch: typeof import('../popup/search.js').indexBookmarkForSearch
): PopupSearchBookmark[] {
  if (index.popupSearchBookmarks) {
    return index.popupSearchBookmarks
  }

  index.popupSearchBookmarks = index.popupSearchEntries.map((entry) =>
    indexBookmarkForSearch(entry.bookmark, entry.tagRecord, entry.snapshotRecord, {
      includeFullText: false
    })
  )
  return index.popupSearchBookmarks
}

async function ensurePopupBookmarksHavePinyinIfNeeded(
  query: string,
  index: NewTabPreparedSearchIndex,
  popupBookmarks: PopupSearchBookmark[]
): Promise<void> {
  if (index.popupSearchPinyinReady) {
    return
  }
  if (!query) {
    return
  }
  const { requiresPinyinTokens, enrichPinyinTokensCooperatively } = await import('../shared/search/pinyin.js')
  if (!requiresPinyinTokens(query)) {
    return
  }
  await enrichPinyinTokensCooperatively(popupBookmarks)
  index.popupSearchPinyinReady = true
}

function getSuggestionFromPopupResult(
  index: NewTabPreparedSearchIndex,
  resultId: string,
  score: number
): SearchBookmarkSuggestion | null {
  const entry = index.entriesById.get(resultId)
  if (!entry) {
    return null
  }

  return {
    id: entry.id,
    title: entry.title,
    url: entry.url,
    folderTitle: entry.folderTitle,
    folderPath: entry.folderPath,
    score,
    order: entry.order
  }
}

function getSuggestionFromFallbackPopupResult(
  index: NewTabPreparedSearchIndex,
  resultId: string,
  score: number
): SearchBookmarkSuggestion | null {
  const entry = index.entriesById.get(resultId)
  if (!entry) {
    return null
  }

  return {
    id: entry.id,
    title: entry.title,
    url: entry.url,
    folderTitle: entry.folderTitle,
    folderPath: entry.folderPath,
    score,
    order: entry.order
  }
}

function getFallbackPopupSearchBookmarks(entries: NewTabSearchIndexEntry[]): PopupSearchBookmark[] {
  return entries.map((entry) => {
    const url = String(entry.url || '').trim()
    const title = String(entry.title || '').trim() || url
    const folderPath = String(entry.folderPath || '').trim()
    const domain = extractDomain(url)
    const normalizedTitle = normalizeNewTabSearchText(title)
    const normalizedUrl = normalizeNewTabSearchText(url)
    const normalizedFolderPath = normalizeNewTabSearchText(folderPath)

    return {
      id: entry.id,
      title,
      url,
      displayUrl: url,
      normalizedTitle,
      normalizedUrl,
      duplicateKey: normalizedUrl || normalizedTitle || entry.id,
      domain,
      path: folderPath,
      ancestorIds: [],
      parentId: '',
      index: entry.order,
      dateAdded: 0,
      normalizedPath: normalizedFolderPath,
      tagSummary: '',
      tagContentType: '',
      tagTopics: [],
      tagTags: [],
      tagAliases: [],
      tagPinyinFull: [],
      tagPinyinInitials: [],
      searchText: [
        title,
        url,
        domain,
        entry.folderTitle,
        folderPath
      ]
        .map((value) => normalizeNewTabSearchText(String(value || '')))
        .filter(Boolean)
        .join(' ')
    } as PopupSearchBookmark
  })
}

export function getPortalQuickAccessItems({
  bookmarks,
  pinnedIds,
  records,
  now,
  itemLimit,
  showFrequent,
  showRecent
}: PortalQuickAccessInput): {
  frequentItems: PortalQuickAccessItem[]
  recentItems: PortalQuickAccessItem[]
} {
  const bookmarkMap = new Map(
    bookmarks
      .filter((bookmark) => String(bookmark.id || '').trim() && String(bookmark.url || '').trim())
      .map((bookmark) => [String(bookmark.id), bookmark])
  )
  const limit = Math.max(0, Math.floor(itemLimit))
  const frequentItems: PortalQuickAccessItem[] = []
  const recentItems: PortalQuickAccessItem[] = []
  const usedIds = new Set<string>()

  if (showFrequent && limit > 0) {
    for (const bookmarkId of pinnedIds) {
      const id = String(bookmarkId || '').trim()
      if (!id || usedIds.has(id) || !bookmarkMap.has(id)) {
        continue
      }

      frequentItems.push({
        id,
        reason: 'pinned',
        detail: '已固定',
        badge: '固'
      })
      usedIds.add(id)
      if (frequentItems.length >= limit) {
        break
      }
    }

    if (frequentItems.length < limit) {
      const frequentRecords = Object.values(records)
        .filter((record) =>
          Number(record.openCount) > 0 &&
          !usedIds.has(String(record.bookmarkId)) &&
          bookmarkMap.has(String(record.bookmarkId))
        )
        .sort((left, right) =>
          Number(right.openCount) - Number(left.openCount) ||
          Number(right.lastOpenedAt) - Number(left.lastOpenedAt)
        )

      for (const record of frequentRecords) {
        const id = String(record.bookmarkId)
        frequentItems.push({
          id,
          reason: 'frequent',
          detail: `打开 ${Math.min(Math.floor(Number(record.openCount) || 0), 9999)} 次`,
          badge: '常'
        })
        usedIds.add(id)
        if (frequentItems.length >= limit) {
          break
        }
      }
    }
  }

  if (showRecent && limit > 0) {
    const recentlyAdded = [...bookmarkMap.values()]
      .filter((bookmark) =>
        !usedIds.has(String(bookmark.id)) &&
        Number.isFinite(Number(bookmark.dateAdded)) &&
        Number(bookmark.dateAdded) > 0
      )
      .sort((left, right) => Number(right.dateAdded) - Number(left.dateAdded))

    for (const bookmark of recentlyAdded) {
      const id = String(bookmark.id)
      recentItems.push({
        id,
        reason: 'added',
        detail: formatNewTabRelativeActivityTime(Number(bookmark.dateAdded), '添加', now),
        badge: '新'
      })
      usedIds.add(id)
      if (recentItems.length >= limit) {
        break
      }
    }
  }

  return { frequentItems, recentItems }
}

export function collectPortalBookmarkSourceItems(
  rootNode: BookmarkTreeSourceItem | null | undefined
): PortalBookmarkSourceItem[] {
  const bookmarks: PortalBookmarkSourceItem[] = []
  if (!rootNode) {
    return bookmarks
  }

  const walk = (node: BookmarkTreeSourceItem): void => {
    if (String(node.url || '').trim()) {
      bookmarks.push(node)
      return
    }

    for (const child of node.children || []) {
      walk(child)
    }
  }

  walk(rootNode)
  return bookmarks
}

export function formatNewTabRelativeActivityTime(
  timestamp: number,
  label: string,
  now = Date.now()
): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return `${label}时间未知`
  }

  const diffMs = Math.max(0, now - timestamp)
  const minuteMs = 60 * 1000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs

  if (diffMs < hourMs) {
    return `${label}于刚刚`
  }
  if (diffMs < dayMs) {
    return `${label}于 ${Math.max(1, Math.floor(diffMs / hourMs))} 小时前`
  }
  if (diffMs < 30 * dayMs) {
    return `${label}于 ${Math.max(1, Math.floor(diffMs / dayMs))} 天前`
  }

  const date = new Date(timestamp)
  return `${label}于 ${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

export function normalizeNewTabSearchText(value: string): string {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function getSearchSuggestionScore(
  query: string,
  title: string,
  url: string,
  folderTitle: string,
  searchText: string
): number {
  if (title === query) {
    return 0
  }
  if (title.startsWith(query)) {
    return 1
  }
  if (title.includes(query)) {
    return 2
  }
  if (url.includes(query)) {
    return 3
  }
  if (folderTitle.includes(query)) {
    return 4
  }
  if (searchText.includes(query)) {
    return 5
  }
  const terms = query.split(/\s+/).filter(Boolean)
  if (terms.length > 1 && terms.every((term) => searchText.includes(term))) {
    return 6
  }
  return -1
}

export function createNewTabPage({ modules }: NewTabPageOptions): HTMLElement {
  const page = document.createElement('main')
  page.className = 'newtab-page'
  page.dataset.contentState = modules.some((module) => module.id === 'bookmarks')
    ? 'bookmarks'
    : 'empty'

  const utilityStack = document.createElement('div')
  utilityStack.className = 'newtab-utility-stack'

  const primarySlot = document.createElement('div')
  primarySlot.className = 'newtab-primary-slot'

  for (const module of modules) {
    module.element.dataset.newtabModule = module.id
    if (module.placement === 'utility') {
      utilityStack.appendChild(module.element)
    } else {
      primarySlot.appendChild(module.element)
    }
  }

  page.classList.toggle('has-search', modules.some((module) => module.id === 'search'))
  page.classList.toggle('has-clock', modules.some((module) => module.id === 'clock'))
  const bookmarkModule = modules.find((module) => module.id === 'bookmarks')
  if (bookmarkModule) {
    page.dataset.iconVerticalCenter = bookmarkModule.element.dataset.iconVerticalCenter || 'false'
  }
  page.append(utilityStack, primarySlot)
  return page
}

export function createMissingFolderView({
  creatingFolder,
  reason,
  onCreateFolder,
  onOpenFolderSettings
}: MissingFolderViewOptions): HTMLElement {
  const view = document.createElement('section')
  view.className = 'newtab-state folder-missing'
  view.setAttribute('aria-labelledby', 'newtab-missing-folder-title')

  const title = document.createElement('h1')
  title.id = 'newtab-missing-folder-title'
  title.textContent = reason === 'selected-unavailable'
    ? '已选书签来源不可用'
    : '当前没有显示来源'

  const copy = document.createElement('p')
  copy.textContent = reason === 'selected-unavailable'
    ? '之前选择的文件夹可能已被删除或移动。请打开设置里的“书签来源”，重新选择要显示的文件夹。'
    : '没有找到可直接展示的非空文件夹。你可以选择已有来源，或新建专用文件夹后添加书签。'

  const actions = document.createElement('div')
  actions.className = 'newtab-state-actions'

  const settingsButton = document.createElement('button')
  settingsButton.className = 'newtab-button'
  settingsButton.type = 'button'
  settingsButton.textContent = '选择现有来源'
  settingsButton.addEventListener('click', onOpenFolderSettings)

  const createButton = document.createElement('button')
  createButton.className = 'newtab-button secondary'
  createButton.type = 'button'
  createButton.disabled = creatingFolder
  createButton.textContent = creatingFolder ? '正在创建' : '新建专用文件夹'
  createButton.addEventListener('click', onCreateFolder)

  actions.append(settingsButton, createButton)
  view.append(title, copy, actions)
  return view
}

export function createStateView(message: string, actionLabel = '', action?: () => void): HTMLElement {
  const view = document.createElement('section')
  view.className = 'newtab-state'

  const copy = document.createElement('p')
  copy.textContent = message
  view.appendChild(copy)

  if (actionLabel && action) {
    const button = document.createElement('button')
    button.className = 'newtab-button secondary'
    button.type = 'button'
    button.textContent = actionLabel
    button.addEventListener('click', action)
    view.appendChild(button)
  }

  return view
}

export function createLoadingStateView(label = '正在加载书签'): HTMLElement {
  const view = document.createElement('section')
  view.className = 'newtab-state newtab-loading-state'
  view.setAttribute('role', 'status')
  view.setAttribute('aria-label', label)
  view.innerHTML = renderNewTabDotMatrixLoader('newtab-state-loader')
  return view
}

function renderNewTabDotMatrixLoader(className = ''): string {
  const classes = ['dot-matrix-loader', 'dot-matrix-loader--spiral', className]
    .filter(Boolean)
    .join(' ')
  const dots: Array<[string, number, number]> = [
    ['00', 6, 6],
    ['01', 17, 6],
    ['02', 28, 6],
    ['03', 39, 6],
    ['04', 50, 6],
    ['10', 6, 17],
    ['11', 17, 17],
    ['12', 28, 17],
    ['13', 39, 17],
    ['14', 50, 17],
    ['20', 6, 28],
    ['21', 17, 28],
    ['22', 28, 28],
    ['23', 39, 28],
    ['24', 50, 28],
    ['30', 6, 39],
    ['31', 17, 39],
    ['32', 28, 39],
    ['33', 39, 39],
    ['34', 50, 39],
    ['40', 6, 50],
    ['41', 17, 50],
    ['42', 28, 50],
    ['43', 39, 50],
    ['44', 50, 50]
  ]
  const litDots = dots
    .map(([key, x, y]) => `<circle class="dot-matrix-loader-lit dot-matrix-loader-d${key}" cx="${x}" cy="${y}" r="3.1"></circle>`)
    .join('')

  return `<svg class="${classes}" viewBox="0 0 56 56" aria-hidden="true" focusable="false">${litDots}</svg>`
}
