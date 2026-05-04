import type { BookmarkTagIndex } from '../shared/bookmark-tags.js'
import type {
  ContentSnapshotIndex,
  ContentSnapshotSettings
} from '../shared/content-snapshot-search.js'
import {
  loadContentSnapshotIndex,
  loadContentSnapshotSettings
} from '../shared/content-snapshot-search.js'
import type { BookmarkRecord } from '../shared/types.js'
import {
  indexBookmarkForSearch,
  type PopupSearchBookmark
} from './search.js'

export const POPUP_SNAPSHOT_FULL_TEXT_LIMIT = 600

export interface PopupSearchIndexSource {
  bookmarks: BookmarkRecord[]
  tagIndex: BookmarkTagIndex | null
  snapshotIndex?: ContentSnapshotIndex | null
  includeFullText?: boolean
}

export interface PopupSearchIndexSnapshotState {
  settings: ContentSnapshotSettings | null
  index: ContentSnapshotIndex | null
}

export function buildLightPopupSearchIndex({
  bookmarks,
  tagIndex,
  snapshotIndex = null
}: PopupSearchIndexSource): PopupSearchBookmark[] {
  const tagRecords = tagIndex?.records || {}
  const snapshotRecords = snapshotIndex?.records || {}

  return bookmarks.map((bookmark) =>
    indexBookmarkForSearch(
      bookmark,
      tagRecords[bookmark.id] || null,
      snapshotRecords[bookmark.id] || null,
      { includeFullText: false }
    )
  )
}

export async function loadPopupSearchIndexSnapshotState(): Promise<PopupSearchIndexSnapshotState> {
  const settings = await loadContentSnapshotSettings().catch(() => null)
  const index = await loadContentSnapshotIndex().catch(() => null)
  return { settings, index }
}

export function shouldWarmPopupSnapshotFullText(
  snapshotState: PopupSearchIndexSnapshotState | null
): boolean {
  return Boolean(
    snapshotState?.settings?.fullTextSearchEnabled &&
    snapshotState.index &&
    Object.values(snapshotState.index.records || {}).some((record) =>
      (record.fullTextStorage === 'local' && Boolean(record.fullText)) ||
      (record.fullTextStorage === 'idb' && Boolean(record.fullTextRef))
    )
  )
}

export async function enrichPopupSearchIndexWithSnapshotFullText({
  bookmarks,
  tagIndex,
  snapshotIndex,
  includeFullText = true
}: PopupSearchIndexSource): Promise<PopupSearchBookmark[]> {
  if (!snapshotIndex || !includeFullText) {
    return buildLightPopupSearchIndex({ bookmarks, tagIndex, snapshotIndex })
  }

  const { buildContentSnapshotSearchMapWithFullText } = await import('../shared/content-snapshots.js')
  const snapshotSearchMap = await buildContentSnapshotSearchMapWithFullText(snapshotIndex, {
    includeFullText: true,
    maxRecords: POPUP_SNAPSHOT_FULL_TEXT_LIMIT
  }).catch(() => new Map<string, string>())
  const tagRecords = tagIndex?.records || {}

  return bookmarks.map((bookmark) => {
    const indexed = indexBookmarkForSearch(
      bookmark,
      tagRecords[bookmark.id] || null,
      snapshotIndex.records?.[bookmark.id] || null,
      { includeFullText: true }
    )
    const snapshotSearchText = snapshotSearchMap.get(bookmark.id)
    if (snapshotSearchText) {
      indexed.searchText = `${indexed.searchText} ${snapshotSearchText}`.trim()
    }
    return indexed
  })
}
