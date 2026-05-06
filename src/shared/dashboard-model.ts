import { getEffectiveBookmarkTags, type BookmarkTagIndex } from './bookmark-tags.js'
import { OTHER_BOOKMARKS_ID, ROOT_ID } from './constants.js'
import {
  buildContentSnapshotSearchMap,
  type ContentSnapshotIndex
} from './content-snapshots.js'
import {
  buildSearchTextQuery,
  matchesParsedSearchQuery,
  parseSearchQuery,
  type ParsedSearchQuery
} from './search-query.js'
import { extractDomain, normalizeText } from './text.js'
import type { BookmarkRecord, FolderRecord } from './types.js'

export type DashboardSortKey = 'date-desc' | 'date-asc' | 'title-asc' | 'domain-asc'

export interface DashboardFilters {
  query?: string
  parsedQuery?: ParsedSearchQuery | null
  folderId?: string
  domain?: string
  month?: string
  sortKey?: DashboardSortKey
  textMatchMode?: 'all' | 'any'
}

export interface DashboardFilterSortOptions {
  limit?: number
}

export interface DashboardItem extends BookmarkRecord {
  normalizedAncestorIds: string[]
  folderTitle: string
  topFolderId: string
  topFolderTitle: string
  monthKey: string
  monthLabel: string
  hasKnownDate: boolean
  tagSummary: string
  tags: string[]
  aiTags: string[]
  hasManualTags: boolean
  topics: string[]
  aliases: string[]
  summary: string
  searchText: string
}

export interface DashboardFolderTarget {
  id: string
  title: string
  path: string
  normalizedPath: string
  bookmarkCount: number
  folderCount: number
}

export interface DashboardModel {
  items: DashboardItem[]
  folders: FolderRecord[]
  folderTargets: DashboardFolderTarget[]
  totalBookmarks: number
  totalFolders: number
  domainCount: number
  unknownDateCount: number
}

export function buildDashboardModel({
  bookmarks = [],
  folders = [],
  tagIndex = null,
  contentSnapshotIndex = null,
  contentSnapshotSearchMap = null,
  includeFullText = false
}: {
  bookmarks?: BookmarkRecord[]
  folders?: FolderRecord[]
  tagIndex?: BookmarkTagIndex | null
  contentSnapshotIndex?: ContentSnapshotIndex | null
  contentSnapshotSearchMap?: Map<string, string> | null
  includeFullText?: boolean
} = {}): DashboardModel {
  const folderMap = new Map(folders.map((folder) => [String(folder.id), folder]))
  const tagRecords = tagIndex?.records || {}
  const snapshotSearchMap = contentSnapshotSearchMap ||
    (contentSnapshotIndex
      ? buildContentSnapshotSearchMap(contentSnapshotIndex, { includeFullText })
      : new Map<string, string>())
  const items = bookmarks.map((bookmark) => {
    const normalizedAncestorIds = normalizeDashboardIdList(bookmark.ancestorIds)
    const tagRecord = tagRecords[String(bookmark.id)] || null
    const folder = folderMap.get(String(bookmark.parentId || '')) || null
    const topFolder = getDashboardTopFolder(bookmark, folderMap)
    const dateMeta = getDashboardDateMeta(bookmark.dateAdded)
    const tags = normalizeDashboardTextList(getEffectiveBookmarkTags(tagRecord))
    const aiTags = normalizeDashboardTextList(tagRecord?.tags)
    const hasManualTags = Boolean(tagRecord?.manualTags?.length)
    const topics = normalizeDashboardTextList(tagRecord?.topics)
    const aliases = normalizeDashboardTextList(tagRecord?.aliases)
    const summary = String(tagRecord?.summary || '').replace(/\s+/g, ' ').trim()
    const snapshotSearchText = snapshotSearchMap.get(String(bookmark.id)) || ''
    const tagSummary = tags.slice(0, 4).join(' / ')
    const domain = String(bookmark.domain || extractDomain(bookmark.url) || '').trim()
    const searchText = normalizeText([
      bookmark.title,
      bookmark.url,
      domain,
      bookmark.path,
      tagRecord?.title,
      tagRecord?.path,
      tagRecord?.contentType,
      summary,
      ...tags,
      ...topics,
      ...aliases,
      snapshotSearchText
    ].join(' '))

    return {
      ...bookmark,
      normalizedAncestorIds,
      domain,
      folderTitle: folder?.title || bookmark.path || '未归档路径',
      topFolderId: topFolder?.id || '',
      topFolderTitle: topFolder?.title || '未归档路径',
      monthKey: dateMeta.key,
      monthLabel: dateMeta.label,
      hasKnownDate: dateMeta.known,
      tagSummary,
      tags,
      aiTags,
      hasManualTags,
      topics,
      aliases,
      summary,
      searchText
    }
  })

  const domainSet = new Set(items.map((item) => item.domain).filter(Boolean))
  return {
    items,
    folders: folders.slice().sort(compareByPathTitle),
    folderTargets: getDashboardFolderTargets(folders),
    totalBookmarks: items.length,
    totalFolders: folders.filter((folder) => String(folder.id) !== ROOT_ID).length,
    domainCount: domainSet.size,
    unknownDateCount: items.filter((item) => !item.hasKnownDate).length
  }
}

export function filterDashboardItems(items: DashboardItem[], filters: DashboardFilters = {}): DashboardItem[] {
  const predicate = createDashboardItemPredicate(filters)
  return items.filter(predicate)
}

export function filterAndSortDashboardItems(
  items: DashboardItem[],
  filters: DashboardFilters = {},
  options: DashboardFilterSortOptions = {}
): DashboardItem[] {
  const limit = Math.floor(Number(options.limit))
  if (!Number.isFinite(limit) || limit <= 0) {
    return sortDashboardItems(filterDashboardItems(items, filters), filters.sortKey)
  }

  const predicate = createDashboardItemPredicate(filters)
  const comparator = getDashboardItemComparator(filters.sortKey)
  const topItems: DashboardItem[] = []

  for (const item of items) {
    if (!predicate(item)) {
      continue
    }

    retainTopDashboardItem(topItems, item, limit, comparator)
  }

  return topItems.sort(comparator)
}

function createDashboardItemPredicate(filters: DashboardFilters = {}): (item: DashboardItem) => boolean {
  const parsedQuery = filters.parsedQuery || parseSearchQuery(filters.query || '')
  const queryText = buildSearchTextQuery(parsedQuery)
  const queryTerms = parsedQuery.textTerms
  const folderId = String(filters.folderId || '').trim()
  const domain = String(filters.domain || '').trim()
  const month = String(filters.month || '').trim()
  const textMatchMode = filters.textMatchMode === 'any' ? 'any' : 'all'

  return (item) => {
    if (!matchesParsedSearchQuery(parsedQuery, {
      searchText: item.searchText,
      domain: item.domain,
      url: item.normalizedUrl || item.url,
      path: item.path,
      type: item.searchText,
      dateAdded: item.dateAdded
    })) {
      return false
    }

    if (
      queryText &&
      !item.searchText.includes(queryText) &&
      (
        textMatchMode === 'any'
          ? !queryTerms.some((term) => item.searchText.includes(term))
          : !queryTerms.every((term) => item.searchText.includes(term))
      )
    ) {
      return false
    }

    if (
      folderId &&
      String(item.parentId || '') !== folderId &&
      !item.normalizedAncestorIds.includes(folderId)
    ) {
      return false
    }

    if (domain && item.domain !== domain) {
      return false
    }

    if (month && item.monthKey !== month) {
      return false
    }

    return true
  }
}

export function sortDashboardItems(
  items: DashboardItem[],
  sortKey: DashboardSortKey = 'date-desc'
): DashboardItem[] {
  return items.slice().sort(getDashboardItemComparator(sortKey))
}

function retainTopDashboardItem(
  items: DashboardItem[],
  item: DashboardItem,
  limit: number,
  comparator: (left: DashboardItem, right: DashboardItem) => number
): void {
  if (items.length < limit) {
    items.push(item)
    return
  }

  let worstIndex = 0
  for (let index = 1; index < items.length; index += 1) {
    if (comparator(items[index], items[worstIndex]) > 0) {
      worstIndex = index
    }
  }

  if (comparator(item, items[worstIndex]) < 0) {
    items[worstIndex] = item
  }
}

function getDashboardItemComparator(
  sortKey: DashboardSortKey = 'date-desc'
): (left: DashboardItem, right: DashboardItem) => number {
  return (left, right) => {
    if (sortKey === 'title-asc') {
      return left.title.localeCompare(right.title, 'zh-CN') || compareDashboardItemPath(left, right)
    }

    if (sortKey === 'domain-asc') {
      return left.domain.localeCompare(right.domain, 'zh-CN') || left.title.localeCompare(right.title, 'zh-CN')
    }

    if (sortKey === 'date-asc') {
      return compareDashboardDates(left, right, 'asc') || compareDashboardItemPath(left, right)
    }

    return compareDashboardDates(left, right, 'desc') || compareDashboardItemPath(left, right)
  }
}

export function getDashboardFolderTargets(folders: FolderRecord[]): DashboardFolderTarget[] {
  return folders
    .filter((folder) => String(folder.id) !== ROOT_ID)
    .slice()
    .sort(compareByPathTitle)
    .map((folder) => ({
      id: String(folder.id),
      title: folder.title || '未命名文件夹',
      path: folder.path || folder.title || '未命名文件夹',
      normalizedPath: folder.normalizedPath || normalizeText(folder.path || folder.title || ''),
      bookmarkCount: Number(folder.bookmarkCount) || 0,
      folderCount: Number(folder.folderCount) || 0
    }))
}

export function buildDashboardFolderBookmarkCounts(items: Pick<DashboardItem, 'ancestorIds' | 'parentId'>[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of items) {
    const folderIds = new Set<string>([
      ...(Array.isArray(item.ancestorIds) ? item.ancestorIds.map(String) : []),
      String(item.parentId || '')
    ].filter(Boolean))
    for (const folderId of folderIds) {
      counts.set(folderId, (counts.get(folderId) || 0) + 1)
    }
  }
  return counts
}

export function getDashboardTopFolder(
  bookmark: BookmarkRecord,
  folderMap: Map<string, FolderRecord>
): FolderRecord | null {
  const ancestorIds = Array.isArray(bookmark.ancestorIds) ? bookmark.ancestorIds.map(String) : []
  return folderMap.get(ancestorIds[0] || '') || folderMap.get(String(bookmark.parentId || '')) || null
}

export function getDashboardDateMeta(value: unknown): { key: string; label: string; known: boolean } {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return {
      key: 'unknown',
      label: '未知时间',
      known: false
    }
  }

  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) {
    return {
      key: 'unknown',
      label: '未知时间',
      known: false
    }
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return {
    key: `${year}-${month}`,
    label: formatDashboardDateTime(timestamp),
    known: true
  }
}

export function normalizeDashboardTextList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
}

function normalizeDashboardIdList(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))]
    : []
}

function compareDashboardDates(left: DashboardItem, right: DashboardItem, direction: 'asc' | 'desc'): number {
  if (left.hasKnownDate !== right.hasKnownDate) {
    return left.hasKnownDate ? -1 : 1
  }
  if (!left.hasKnownDate || !right.hasKnownDate) {
    return 0
  }

  const leftDate = Number(left.dateAdded) || 0
  const rightDate = Number(right.dateAdded) || 0
  return direction === 'asc' ? leftDate - rightDate : rightDate - leftDate
}

function compareDashboardItemPath(left: DashboardItem, right: DashboardItem): number {
  return compareByPathTitle(left, right) || left.title.localeCompare(right.title, 'zh-CN')
}

function compareByPathTitle(left: { path?: string; title?: string }, right: { path?: string; title?: string }): number {
  const rootOrder = getDashboardRootFolderOrder(left) - getDashboardRootFolderOrder(right)
  if (rootOrder !== 0) {
    return rootOrder
  }

  return (
    String(left.path || '').localeCompare(String(right.path || ''), 'zh-CN') ||
    String(left.title || '').localeCompare(String(right.title || ''), 'zh-CN')
  )
}

function getDashboardRootFolderOrder(item: { path?: string; title?: string; id?: string }): number {
  const id = String(item.id || '').trim()
  const path = String(item.path || item.title || '').trim()
  const rootTitle = path.split(/\s*(?:\/|>|›|»|\\)\s*/g).map((segment) => segment.trim()).filter(Boolean)[0] || path

  if (id === OTHER_BOOKMARKS_ID || rootTitle === '其他书签') {
    return 2
  }

  if (rootTitle === '书签栏') {
    return 0
  }

  return 1
}

function formatDashboardDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(timestamp)
}
