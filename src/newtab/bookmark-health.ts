import type { BookmarkTagIndex, BookmarkTagRecord } from '../shared/bookmark-tags.js'
import type {
  ContentSnapshotIndex,
  ContentSnapshotRecord
} from '../shared/content-snapshots.js'
import type { BookmarkRecord } from '../shared/types.js'

export type NewTabBookmarkHealthCardId =
  | 'uncategorized'
  | 'duplicates'
  | 'missing-tags'
  | 'missing-summaries'
  | 'recent-unprocessed'

export type NewTabBookmarkHealthSeverity = 'info' | 'warning' | 'critical'

export interface NewTabBookmarkHealthActivityRecord {
  bookmarkId: string
  openCount?: number
  firstOpenedAt?: number
  lastOpenedAt?: number
}

export interface NewTabBookmarkHealthActivity {
  pinnedIds?: unknown[]
  records?: Record<string, unknown>
}

export interface NewTabBookmarkHealthCard {
  id: NewTabBookmarkHealthCardId
  label: string
  count: number
  detail: string
  actionHash: string
  severity: NewTabBookmarkHealthSeverity
  bookmarkIds: string[]
}

export interface NewTabBookmarkHealthDuplicateGroup {
  duplicateKey: string
  bookmarkIds: string[]
  latestDateAdded: number
}

export interface NewTabBookmarkHealthDetails {
  uncategorizedBookmarkIds: string[]
  duplicateGroups: NewTabBookmarkHealthDuplicateGroup[]
  missingTagBookmarkIds: string[]
  missingSummaryBookmarkIds: string[]
  recentUnprocessedBookmarkIds: string[]
}

export interface NewTabBookmarkHealthResult {
  totalBookmarks: number
  cards: NewTabBookmarkHealthCard[]
  details: NewTabBookmarkHealthDetails
}

export interface NewTabBookmarkHealthInput {
  bookmarks: BookmarkRecord[]
  tagIndex?: BookmarkTagIndex | null
  snapshotIndex?: ContentSnapshotIndex | null
  activity?: NewTabBookmarkHealthActivity | null
  now?: number
  recentWindowDays?: number
  maxCardBookmarkIds?: number
}

interface BookmarkHealthCardDefinition {
  id: NewTabBookmarkHealthCardId
  label: string
  actionHash: string
  criticalCount: number
}

const DEFAULT_RECENT_WINDOW_DAYS = 14
const DEFAULT_MAX_CARD_BOOKMARK_IDS = 50
const DAY_MS = 24 * 60 * 60 * 1000

export const NEW_TAB_BOOKMARK_HEALTH_CARD_DEFINITIONS: Record<
  NewTabBookmarkHealthCardId,
  BookmarkHealthCardDefinition
> = {
  uncategorized: {
    id: 'uncategorized',
    label: '待整理',
    actionHash: '#folder-cleanup',
    criticalCount: 12
  },
  duplicates: {
    id: 'duplicates',
    label: '重复候选',
    actionHash: '#duplicates',
    criticalCount: 8
  },
  'missing-tags': {
    id: 'missing-tags',
    label: '缺少标签',
    actionHash: '#ai',
    criticalCount: 24
  },
  'missing-summaries': {
    id: 'missing-summaries',
    label: '缺少摘要',
    actionHash: '#ai',
    criticalCount: 24
  },
  'recent-unprocessed': {
    id: 'recent-unprocessed',
    label: '新近未处理',
    actionHash: '#dashboard',
    criticalCount: 8
  }
}

const CARD_ORDER: NewTabBookmarkHealthCardId[] = [
  'uncategorized',
  'duplicates',
  'missing-tags',
  'missing-summaries',
  'recent-unprocessed'
]

const TO_ORGANIZE_PATH_PATTERNS = [
  /(^|[\\/>|›»])\s*(inbox|unsorted|uncategorized|to organize|later)\s*($|[\\/>|›»])/i,
  /(^|[\\/>|›»])\s*(待整理|未分类|收件箱|临时收藏|稍后整理)\s*($|[\\/>|›»])/
]

export function buildNewTabBookmarkHealth({
  bookmarks,
  tagIndex = null,
  snapshotIndex = null,
  activity = null,
  now = Date.now(),
  recentWindowDays = DEFAULT_RECENT_WINDOW_DAYS,
  maxCardBookmarkIds = DEFAULT_MAX_CARD_BOOKMARK_IDS
}: NewTabBookmarkHealthInput): NewTabBookmarkHealthResult {
  const validBookmarks = normalizeHealthBookmarks(bookmarks)
  const tagRecords = tagIndex?.records || {}
  const snapshotRecords = snapshotIndex?.records || {}
  const normalizedActivity = normalizeHealthActivity(activity)
  const pinnedIds = new Set(normalizedActivity.pinnedIds)
  const recentCutoff = getRecentCutoff(now, recentWindowDays)

  const uncategorizedBookmarkIds: string[] = []
  const missingTagBookmarkIds: string[] = []
  const missingSummaryBookmarkIds: string[] = []
  const recentUnprocessedBookmarkIds: string[] = []

  for (const bookmark of validBookmarks) {
    const id = bookmark.id
    const tagRecord = getBookmarkTagRecord(tagRecords, id)
    const snapshotRecord = getBookmarkSnapshotRecord(snapshotRecords, id)
    const hasTags = hasBookmarkTags(tagRecord)
    const hasSummary = hasBookmarkSummary(tagRecord, snapshotRecord)

    if (isToOrganizeBookmark(bookmark)) {
      uncategorizedBookmarkIds.push(id)
    }
    if (!hasTags) {
      missingTagBookmarkIds.push(id)
    }
    if (!hasSummary) {
      missingSummaryBookmarkIds.push(id)
    }
    if (
      isRecentBookmark(bookmark, recentCutoff, now) &&
      !isBookmarkProcessed({
        bookmark,
        tagRecord,
        snapshotRecord,
        activityRecord: normalizedActivity.records[id],
        pinned: pinnedIds.has(id)
      })
    ) {
      recentUnprocessedBookmarkIds.push(id)
    }
  }

  const duplicateGroups = buildDuplicateGroups(validBookmarks)
  const duplicateBookmarkIds = uniqueIds(duplicateGroups.flatMap((group) => group.bookmarkIds))
  const details: NewTabBookmarkHealthDetails = {
    uncategorizedBookmarkIds,
    duplicateGroups,
    missingTagBookmarkIds,
    missingSummaryBookmarkIds,
    recentUnprocessedBookmarkIds
  }

  return {
    totalBookmarks: validBookmarks.length,
    details,
    cards: CARD_ORDER.map((id) => buildHealthCard({
      id,
      details,
      duplicateBookmarkIds,
      maxBookmarkIds: maxCardBookmarkIds
    }))
  }
}

export function hasActionableBookmarkHealth(cards: NewTabBookmarkHealthCard[]): boolean {
  return cards.some((card) => card.count > 0)
}

function buildHealthCard({
  id,
  details,
  duplicateBookmarkIds,
  maxBookmarkIds
}: {
  id: NewTabBookmarkHealthCardId
  details: NewTabBookmarkHealthDetails
  duplicateBookmarkIds: string[]
  maxBookmarkIds: number
}): NewTabBookmarkHealthCard {
  const definition = NEW_TAB_BOOKMARK_HEALTH_CARD_DEFINITIONS[id]
  const bookmarkIds = getCardBookmarkIds(id, details, duplicateBookmarkIds)
  const count = bookmarkIds.length
  return {
    id,
    label: definition.label,
    count,
    detail: getHealthCardDetail(id, count, details),
    actionHash: definition.actionHash,
    severity: getHealthSeverity(count, definition.criticalCount),
    bookmarkIds: bookmarkIds.slice(0, Math.max(0, Math.floor(maxBookmarkIds)))
  }
}

function getCardBookmarkIds(
  id: NewTabBookmarkHealthCardId,
  details: NewTabBookmarkHealthDetails,
  duplicateBookmarkIds: string[]
): string[] {
  if (id === 'uncategorized') {
    return details.uncategorizedBookmarkIds
  }
  if (id === 'duplicates') {
    return duplicateBookmarkIds
  }
  if (id === 'missing-tags') {
    return details.missingTagBookmarkIds
  }
  if (id === 'missing-summaries') {
    return details.missingSummaryBookmarkIds
  }
  return details.recentUnprocessedBookmarkIds
}

function getHealthCardDetail(
  id: NewTabBookmarkHealthCardId,
  count: number,
  details: NewTabBookmarkHealthDetails
): string {
  if (count <= 0) {
    return '暂无需要处理的书签。'
  }

  if (id === 'uncategorized') {
    return `${count} 个书签位于 Inbox、待整理或未分类位置。`
  }
  if (id === 'duplicates') {
    return `${details.duplicateGroups.length} 组重复链接，共 ${count} 个候选书签。`
  }
  if (id === 'missing-tags') {
    return `${count} 个书签还没有手动或智能标签。`
  }
  if (id === 'missing-summaries') {
    return `${count} 个书签还没有本地摘要或内容快照。`
  }
  return `${count} 个最近新增书签还没有打开、固定、标签或摘要信号。`
}

function getHealthSeverity(count: number, criticalCount: number): NewTabBookmarkHealthSeverity {
  if (count <= 0) {
    return 'info'
  }
  return count >= criticalCount ? 'critical' : 'warning'
}

function normalizeHealthBookmarks(bookmarks: BookmarkRecord[]): BookmarkRecord[] {
  const seen = new Set<string>()
  const output: BookmarkRecord[] = []
  for (const bookmark of Array.isArray(bookmarks) ? bookmarks : []) {
    const id = cleanText(bookmark?.id)
    const url = cleanText(bookmark?.url)
    if (!id || !url || seen.has(id)) {
      continue
    }
    seen.add(id)
    output.push({
      ...bookmark,
      id,
      url
    })
  }
  return output
}

function normalizeHealthActivity(activity: NewTabBookmarkHealthActivity | null): {
  pinnedIds: string[]
  records: Record<string, NewTabBookmarkHealthActivityRecord>
} {
  const source = activity && typeof activity === 'object' && !Array.isArray(activity) ? activity : {}
  const pinnedIds = uniqueIds(Array.isArray(source.pinnedIds) ? source.pinnedIds.map(cleanText) : [])
  const rawRecords = source.records && typeof source.records === 'object' && !Array.isArray(source.records)
    ? source.records
    : {}
  const records: Record<string, NewTabBookmarkHealthActivityRecord> = {}

  for (const [fallbackId, rawRecord] of Object.entries(rawRecords)) {
    if (!rawRecord || typeof rawRecord !== 'object' || Array.isArray(rawRecord)) {
      continue
    }
    const sourceRecord = rawRecord as Record<string, unknown>
    const bookmarkId = cleanText(sourceRecord.bookmarkId) || cleanText(fallbackId)
    if (!bookmarkId) {
      continue
    }
    records[bookmarkId] = {
      bookmarkId,
      openCount: clampInteger(sourceRecord.openCount, 0, 9999),
      firstOpenedAt: normalizeTimestamp(sourceRecord.firstOpenedAt),
      lastOpenedAt: normalizeTimestamp(sourceRecord.lastOpenedAt)
    }
  }

  return { pinnedIds, records }
}

function buildDuplicateGroups(bookmarks: BookmarkRecord[]): NewTabBookmarkHealthDuplicateGroup[] {
  const groups = new Map<string, BookmarkRecord[]>()
  for (const bookmark of bookmarks) {
    const duplicateKey = getDuplicateKey(bookmark)
    if (!duplicateKey) {
      continue
    }
    const group = groups.get(duplicateKey) || []
    group.push(bookmark)
    groups.set(duplicateKey, group)
  }

  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([duplicateKey, group]) => ({
      duplicateKey,
      bookmarkIds: group
        .slice()
        .sort((left, right) =>
          Number(right.dateAdded) - Number(left.dateAdded) ||
          String(left.id).localeCompare(String(right.id))
        )
        .map((bookmark) => bookmark.id),
      latestDateAdded: Math.max(...group.map((bookmark) => normalizeTimestamp(bookmark.dateAdded)))
    }))
    .sort((left, right) =>
      right.bookmarkIds.length - left.bookmarkIds.length ||
      right.latestDateAdded - left.latestDateAdded ||
      left.duplicateKey.localeCompare(right.duplicateKey)
    )
}

function isToOrganizeBookmark(bookmark: BookmarkRecord): boolean {
  const path = `/${cleanText(bookmark.path)}/`
  return TO_ORGANIZE_PATH_PATTERNS.some((pattern) => pattern.test(path))
}

function isRecentBookmark(bookmark: BookmarkRecord, recentCutoff: number, now: number): boolean {
  const dateAdded = normalizeTimestamp(bookmark.dateAdded)
  return dateAdded > 0 && dateAdded <= now && dateAdded >= recentCutoff
}

function isBookmarkProcessed({
  bookmark,
  tagRecord,
  snapshotRecord,
  activityRecord,
  pinned
}: {
  bookmark: BookmarkRecord
  tagRecord: BookmarkTagRecord | null
  snapshotRecord: ContentSnapshotRecord | null
  activityRecord?: NewTabBookmarkHealthActivityRecord
  pinned: boolean
}): boolean {
  if (pinned || hasBookmarkTags(tagRecord) || hasBookmarkSummary(tagRecord, snapshotRecord)) {
    return true
  }

  const dateAdded = normalizeTimestamp(bookmark.dateAdded)
  const lastOpenedAt = normalizeTimestamp(activityRecord?.lastOpenedAt)
  return lastOpenedAt > 0 && (!dateAdded || lastOpenedAt >= dateAdded)
}

function hasBookmarkTags(record: BookmarkTagRecord | null): boolean {
  return Boolean(record && [
    ...(Array.isArray(record.manualTags) ? record.manualTags : []),
    ...(Array.isArray(record.tags) ? record.tags : [])
  ].some((tag) => cleanText(tag)))
}

function hasBookmarkSummary(
  tagRecord: BookmarkTagRecord | null,
  snapshotRecord: ContentSnapshotRecord | null
): boolean {
  return Boolean(cleanText(tagRecord?.summary) || cleanText(snapshotRecord?.summary))
}

function getBookmarkTagRecord(
  records: Record<string, BookmarkTagRecord>,
  bookmarkId: string
): BookmarkTagRecord | null {
  return records[bookmarkId] || null
}

function getBookmarkSnapshotRecord(
  records: Record<string, ContentSnapshotRecord>,
  bookmarkId: string
): ContentSnapshotRecord | null {
  return records[bookmarkId] || null
}

function getDuplicateKey(bookmark: BookmarkRecord): string {
  return (
    cleanText(bookmark.duplicateKey) ||
    cleanText(bookmark.normalizedUrl) ||
    cleanText(bookmark.url).toLowerCase()
  )
}

function getRecentCutoff(now: number, recentWindowDays: number): number {
  const safeNow = normalizeTimestamp(now) || Date.now()
  const days = Math.max(1, Math.min(90, Math.floor(Number(recentWindowDays) || DEFAULT_RECENT_WINDOW_DAYS)))
  return safeNow - days * DAY_MS
}

function normalizeTimestamp(value: unknown): number {
  const timestamp = Number(value)
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0
}

function clampInteger(value: unknown, min: number, max: number): number {
  const number = Math.floor(Number(value))
  if (!Number.isFinite(number)) {
    return min
  }
  return Math.min(max, Math.max(min, number))
}

function uniqueIds(values: unknown[]): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const value of values) {
    const id = cleanText(value)
    if (!id || seen.has(id)) {
      continue
    }
    seen.add(id)
    ids.push(id)
  }
  return ids
}

function cleanText(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim()
}
