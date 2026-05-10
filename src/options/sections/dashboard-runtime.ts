import type { BookmarkRecord, FolderRecord } from '../../shared/types.js'
import {
  buildBookmarkPathSegments,
  formatBookmarkPath,
  formatFolderPath
} from '../../shared/bookmark-path.js'
import {
  clearAiBookmarkTags,
  getEffectiveBookmarkTags,
  normalizeBookmarkTagIndex,
  normalizeBookmarkTags,
  saveManualBookmarkTags,
  type BookmarkTagIndex,
  type BookmarkTagRecord
} from '../../shared/bookmark-tags.js'
import { displayUrl, normalizeText } from '../../shared/text.js'
import { moveBookmark } from '../../shared/bookmarks-api.js'
import { createAutoBackupBeforeDangerousOperation } from '../../shared/backup.js'
import { createMemoryCache, type MemoryCache } from '../../shared/cache.js'
import { renderDotMatrixLoader } from '../../shared/dot-matrix-loader.js'
import { cancelExitMotion, closeWithExitMotion } from '../../shared/motion.js'
import {
  buildSearchTextQuery,
  deleteSavedSearch,
  getSavedSearchesForScope,
  loadSavedSearchIndex,
  parseSearchQuery,
  saveSearch,
  type SavedSearch,
  type SavedSearchIndex
} from '../../shared/search-query.js'
import {
  buildContentSnapshotSearchMapWithFullText,
  type ContentSnapshotIndex
} from '../../shared/content-snapshots.js'
import {
  BOOKMARKS_BAR_ID,
  NEWTAB_SPEED_DIAL_STATE_MESSAGE_TYPE,
  NEWTAB_TOGGLE_SPEED_DIAL_MESSAGE_TYPE,
  STORAGE_KEYS,
  type NewTabSpeedDialStateMessage,
  type NewTabToggleSpeedDialMessage
} from '../../shared/constants.js'
import { getLocalStorage, setLocalStorage } from '../../shared/storage.js'
import { runIdle } from '../../shared/idle.js'
import {
  getActiveNewTabWorkspace,
  normalizeNewTabWorkspaceSettings,
  toggleNewTabWorkspacePin
} from '../../shared/newtab-workspace-settings.js'
import {
  buildDashboardFolderBookmarkCounts,
  buildDashboardModel,
  filterDashboardItems,
  sortDashboardItems,
  type DashboardFilters,
  type DashboardFolderTarget,
  type DashboardItem,
  type DashboardModel,
  type DashboardSortKey
} from '../../shared/dashboard-model.js'
import { aiNamingState, availabilityState, contentSnapshotState, dashboardState, managerState } from '../shared-options/state.js'
import { dom } from '../shared-options/dom.js'
import { escapeAttr, escapeHtml } from '../shared-options/html.js'
import { deleteBookmarksToRecycle } from './recycle.js'
import type { NaturalSearchPlan, NaturalSearchResultSet } from '../../popup/natural-search.js'
import {
  indexBookmarkForSearch,
  searchBookmarksTopK,
  searchBookmarksUnbounded,
  type PopupSearchBookmark,
  type PopupSearchResult
} from '../../popup/search.js'
import { measureNow as perfMeasureNow, logCount as perfLogCount } from '../../shared/perf.js'
import { queryLooksLikePinyin } from '../../shared/search/pinyin.js'
import type {
  DashboardSearchWorkerRequest,
  DashboardSearchWorkerResponse,
  DashboardSearchWorkerStructuralFilters
} from '../../shared/search/search-worker-contract.js'
export {
  computeDashboardVirtualWindow,
  getDashboardVirtualColumnCount,
  getDashboardVirtualOverscanRows,
  getDashboardVirtualRenderedCount
} from './dashboard-virtual.js'
import {
  DASHBOARD_CARD_HEIGHT,
  DASHBOARD_CARD_MIN_WIDTH,
  DASHBOARD_GRID_GAP,
  DASHBOARD_VIRTUAL_FAST_SCROLL_PX_PER_MS,
  DASHBOARD_VIRTUAL_MIN_READY_HEIGHT,
  DASHBOARD_VIRTUAL_MIN_READY_WIDTH,
  computeDashboardVirtualWindow,
  getDashboardVirtualColumnCount,
  type DashboardVirtualWindow
} from './dashboard-virtual.js'
import {
  DASHBOARD_FAVICON_FETCH_VERSION,
  DASHBOARD_FAVICON_SIZE,
  DASHBOARD_FAVICON_WARMUP_BATCH_DELAY_MS,
  DASHBOARD_FAVICON_WARMUP_BATCH_SIZE,
  DASHBOARD_FAVICON_WARMUP_CONCURRENCY,
  DASHBOARD_FAVICON_WARMUP_OVERSCAN_ROWS,
  buildDashboardFaviconUrl,
  clampDashboardInteger,
  createDashboardFaviconWarmupQueue,
  getDashboardCachedFaviconEntry as getDashboardCachedFaviconEntryFromCache,
  getDashboardFaviconCacheKey,
  getDashboardFaviconEndpointUrl,
  isDashboardSafeImageUrl,
  normalizeDashboardFaviconCache,
  warmDashboardFavicon,
  type DashboardFaviconCache,
  type DashboardFaviconCacheEntry,
  type DashboardFaviconWarmupQueue
} from './dashboard-favicons.js'
export {
  buildDashboardFaviconWarmupItems,
  createDashboardFaviconWarmupQueue,
  type DashboardFaviconWarmupItem
} from './dashboard-favicons.js'

export interface DashboardDragStateSnapshot {
  armed: boolean
  active: boolean
  moving: boolean
  bookmarkId: string
  pointerId: number
  hoverFolderId: string
  hoverDeleteTarget: boolean
  originX: number
  originY: number
  currentX: number
  currentY: number
}

interface DashboardDragState extends DashboardDragStateSnapshot {
  captureElement: HTMLElement | null
}

interface DashboardVirtualState {
  items: DashboardItem[]
  filterKey: string
  scrollResetKey: string
  filterChangeReason: DashboardVirtualFilterChangeReason
  scrollTop: number
  contentWidth: number
  containerHeight: number
  columnCount: number
  rowStride: number
  cardHeight: number
  minCardWidth: number
  renderedStartIndex: number
  renderedEndIndex: number
  renderedColumnCount: number
  renderedTotalHeight: number
  renderedOffsetY: number
  renderedStateKey: string
  renderedStaticListKey: string
  renderedItems: DashboardItem[] | null
  frame: number
  sectionFrame: number
  resetScrollOnNextRender: boolean
  resizeObserver: ResizeObserver | null
  observedElement: HTMLElement | null
  pendingInitialMeasure: boolean
  measureRetryFrame: number
  lastResizeWidth: number
  lastResizeHeight: number
  lastResizeColumnCount: number
  lastScrollTop: number
  lastScrollAt: number
  isFastScrolling: boolean
  scrollIdleTimer: number
  scrollSettleTimer: number
}

interface DashboardModelCacheKey {
  bookmarks: BookmarkRecord[]
  folders: FolderRecord[]
  tagIndex: BookmarkTagIndex | null
  tagRecords: BookmarkTagIndex['records'] | null
  tagUpdatedAt: number
  contentSnapshotIndex: ContentSnapshotIndex | null
  contentSnapshotRecords: ContentSnapshotIndex['records'] | null
  contentSnapshotUpdatedAt: number
  contentSnapshotSearchMap: Map<string, string> | null
  contentSnapshotSearchMapSize: number
  includeFullText: boolean
}

type DashboardVirtualFilterChangeReason = 'folder' | 'query' | 'filter' | 'append'

interface DashboardRenderCache {
  modelKey: DashboardModelCacheKey | null
  model: DashboardModel | null
  visibleModel: DashboardModel | null
  visibleNaturalPlan: NaturalSearchPlan | null
  visibleQuery: string
  visibleFolderId: string
  visibleDomain: string
  visibleMonth: string
  visibleSortKey: DashboardSortKey
  visibleItems: DashboardItem[] | null
  folderCountsModel: DashboardModel | null
  folderBookmarkCounts: Map<string, number> | null
  sidebarModel: DashboardModel | null
  sidebarSelectedFolderId: string
  sidebarMarkup: string
  sidebarTotalFolders: number
}

interface DashboardNaturalSearchCacheEntry {
  plan: NaturalSearchPlan
  results: PopupSearchResult[]
}

interface DashboardPopupSearchIndexCache {
  model: DashboardModel | null
  tagRecords: BookmarkTagIndex['records'] | null
  tagUpdatedAt: number
  bookmarks: PopupSearchBookmark[] | null
  bookmarkById: Map<string, PopupSearchBookmark> | null
  pinyinReady: boolean
  pinyinPending: boolean
  pinyinRunId: number
  pinyinPriorityKey: string
  pinyinPriorityPending: boolean
}

interface DashboardSearchWorkerState {
  worker: Worker | null
  model: DashboardModel | null
  tagRecords: BookmarkTagIndex['records'] | null
  tagUpdatedAt: number
  pinyinReady: boolean
  indexReady: boolean
  indexSize: number
  initRequestId: number
  requestId: number
  pendingSearchKey: string
  limitByKey: Map<string, number>
  resultCache: Map<string, string[]>
  error: string
}

interface DashboardFaviconWarmupDebugSummary {
  skipped: number
  firstPageUrl: string
  firstError: string
}

interface DashboardCallbacks {
  renderAvailabilitySection: () => void
  hydrateAvailabilityCatalog: (options?: { preserveResults?: boolean }) => Promise<void>
  regenerateAiTags: (bookmark: BookmarkRecord, signal?: AbortSignal) => Promise<void>
  openMoveModal: (source: string) => void
  closeMoveModal: () => void
  exitDashboard?: () => void
  confirm: (options: {
    title: string
    copy: string
    confirmLabel: string
    label: string
    tone: string
  }) => Promise<boolean>
  recycleCallbacks: any
}

export const DASHBOARD_DRAG_MOVE_THRESHOLD = 4
const DASHBOARD_VIRTUAL_CARD_NODE_POOL_LIMIT = 300
const DASHBOARD_VIRTUAL_THRESHOLD = 90
const DASHBOARD_SELECTION_MOTION_MS = 260
const DASHBOARD_NEWTAB_EMBED_PARAM = 'newtab-dashboard'
const DASHBOARD_NATURAL_SEARCH_CACHE_LIMIT = 24
const DASHBOARD_NATURAL_SEARCH_CACHE_TTL_MS = 5 * 60 * 1000
const DASHBOARD_SEARCH_WORKER_THRESHOLD = 3000
const DASHBOARD_SEARCH_INITIAL_LIMIT = 240
const DASHBOARD_SEARCH_INCREMENT = 240
const DASHBOARD_SEARCH_MAX_SYNC_LIMIT = 1000
const DASHBOARD_SEARCH_SCROLL_PREFETCH_PX = 1200
const DASHBOARD_SEARCH_SCROLL_PREFETCH_MIN_INTERVAL_MS = 450
const DASHBOARD_SEARCH_SCROLL_PREFETCH_IDLE_TIMEOUT_MS = 650
const DASHBOARD_SCROLL_IDLE_MS = 110
const DASHBOARD_SCROLL_SETTLE_MS = 160
const DASHBOARD_FAVICON_LOAD_SYNC_BATCH_SIZE = 64
const DASHBOARD_FAVICON_DIRTY_SYNC_DELAY_MS = 160
const DASHBOARD_FAVICON_DIRTY_SYNC_SCROLL_DELAY_MS = 220
const DASHBOARD_FAVICON_WARMUP_DEBUG_DELAY_MS = 1400

let dashboardStatusTimer = 0
let dashboardResultsStableFrame = 0
let dashboardResultsUpdateOverlay: HTMLElement | null = null
let dashboardSelectionMotionFrame = 0
let dashboardSelectionMotionTimer = 0
let dashboardSelectionCompositeMotionActive = false
let dashboardVirtualResizeDeferredForSelection = false
let dashboardVirtualResizeFrame = 0
let dashboardTagRegenerateController: AbortController | null = null
let closingDashboardTagEditor = false
let dashboardViewReady = false
let dashboardViewRevealFrame = 0
let dashboardViewRevealRenderVersion = 0
let dashboardCardsRenderVersion = 0
let dashboardCardsCommittedRenderVersion = 0
let dashboardListRenderFrame = 0
let dashboardListRenderPendingForScroll = false
let pendingDashboardFolderFocusId = ''
let dashboardFaviconWarmupQueue: DashboardFaviconWarmupQueue | null = null
let dashboardFaviconWarmupItems: DashboardItem[] | null = null
let dashboardFaviconWarmupKey = ''
let dashboardFaviconWarmupStartIndex = -1
let dashboardFaviconWarmupEndIndex = -1
let dashboardFaviconWarmupEndpointUrl = ''
let dashboardFaviconWarmupPendingItems: DashboardItem[] | null = null
let dashboardFaviconWarmupPendingStartIndex = -1
let dashboardFaviconWarmupPendingEndIndex = -1
let dashboardFaviconLoadSyncFrame = 0
let dashboardFaviconLoadSyncTimer = 0
let dashboardFaviconDirtySyncTimer = 0
const dashboardFaviconDirtyPageUrls = new Set<string>()
let dashboardFaviconCache: DashboardFaviconCache = {}
let dashboardFaviconCacheHydrated = false
let dashboardFaviconCacheSaveTimer = 0
let dashboardFaviconDebugSummaryTimer = 0
let dashboardFaviconWarmupDebugSummary: DashboardFaviconWarmupDebugSummary | null = null
let dashboardDropHoverCard: HTMLElement | null = null
let dashboardSearchPrefetchIdleScheduled = false
let dashboardSearchPrefetchRetryTimer = 0
let dashboardSearchPrefetchLastRequestedAt = 0
let dashboardSearchPrefetchPendingKey = ''
let dashboardVirtualCardNodePoolTick = 0
let dashboardNaturalSearchModulePromise: Promise<typeof import('../../popup/natural-search.js')> | null = null
let dashboardNaturalSearchAiModulePromise: Promise<typeof import('../../popup/natural-search-ai.js')> | null = null
let dashboardActiveSearchKey = ''
let dashboardActiveSearchLimit = 0
let dashboardActiveSearchResultCount = 0
const dashboardPopupSearchIndexCache: DashboardPopupSearchIndexCache = {
  model: null,
  tagRecords: null,
  tagUpdatedAt: 0,
  bookmarks: null,
  bookmarkById: null,
  pinyinReady: false,
  pinyinPending: false,
  pinyinRunId: 0,
  pinyinPriorityKey: '',
  pinyinPriorityPending: false
}
const dashboardSearchWorkerState: DashboardSearchWorkerState = {
  worker: null,
  model: null,
  tagRecords: null,
  tagUpdatedAt: 0,
  pinyinReady: false,
  indexReady: false,
  indexSize: 0,
  initRequestId: 0,
  requestId: 0,
  pendingSearchKey: '',
  limitByKey: new Map(),
  resultCache: new Map(),
  error: ''
}
const dashboardNaturalSearchCache: MemoryCache<string, DashboardNaturalSearchCacheEntry> = createMemoryCache({
  maxEntries: DASHBOARD_NATURAL_SEARCH_CACHE_LIMIT,
  ttlMs: DASHBOARD_NATURAL_SEARCH_CACHE_TTL_MS,
  version: 'dashboard-natural-search-v1'
})
const EMPTY_DASHBOARD_TAG_RECORDS: BookmarkTagIndex['records'] = {}
const dashboardVirtualCardNodePool = new Map<string, {
  element: HTMLElement
  renderKey: string
  lastUsed: number
}>()
const dashboardRenderCache: DashboardRenderCache = {
  modelKey: null,
  model: null,
  visibleModel: null,
  visibleNaturalPlan: null,
  visibleQuery: '',
  visibleFolderId: '',
  visibleDomain: '',
  visibleMonth: '',
  visibleSortKey: 'date-desc',
  visibleItems: null,
  folderCountsModel: null,
  folderBookmarkCounts: null,
  sidebarModel: null,
  sidebarSelectedFolderId: '',
  sidebarMarkup: '',
  sidebarTotalFolders: -1
}

const virtualState: DashboardVirtualState = {
  items: [],
  filterKey: '',
  scrollResetKey: '',
  filterChangeReason: 'filter',
  scrollTop: 0,
  contentWidth: 0,
  containerHeight: 0,
  columnCount: 1,
  rowStride: DASHBOARD_CARD_HEIGHT + DASHBOARD_GRID_GAP,
  cardHeight: DASHBOARD_CARD_HEIGHT,
  minCardWidth: DASHBOARD_CARD_MIN_WIDTH,
  renderedStartIndex: -1,
  renderedEndIndex: -1,
  renderedColumnCount: 0,
  renderedTotalHeight: -1,
  renderedOffsetY: -1,
  renderedStateKey: '',
  renderedStaticListKey: '',
  renderedItems: null,
  frame: 0,
  sectionFrame: 0,
  resetScrollOnNextRender: false,
  resizeObserver: null,
  observedElement: null,
  pendingInitialMeasure: false,
  measureRetryFrame: 0,
  lastResizeWidth: 0,
  lastResizeHeight: 0,
  lastResizeColumnCount: 0,
  lastScrollTop: 0,
  lastScrollAt: 0,
  isFastScrolling: false,
  scrollIdleTimer: 0,
  scrollSettleTimer: 0
}

function loadDashboardNaturalSearchModule(): Promise<typeof import('../../popup/natural-search.js')> {
  dashboardNaturalSearchModulePromise ||= import('../../popup/natural-search.js')
  return dashboardNaturalSearchModulePromise
}

function loadDashboardNaturalSearchAiModule(): Promise<typeof import('../../popup/natural-search-ai.js')> {
  dashboardNaturalSearchAiModulePromise ||= import('../../popup/natural-search-ai.js')
  return dashboardNaturalSearchAiModulePromise
}

const dragState: DashboardDragState = {
  ...createDashboardDragState(),
  captureElement: null
}

export function createDashboardDragState(
  overrides: Partial<DashboardDragStateSnapshot> = {}
): DashboardDragStateSnapshot {
  return {
    armed: false,
    active: false,
    moving: false,
    bookmarkId: '',
    pointerId: -1,
    hoverFolderId: '',
    hoverDeleteTarget: false,
    originX: 0,
    originY: 0,
    currentX: 0,
    currentY: 0,
    ...overrides
  }
}

export function hasDashboardDragPassedThreshold(
  state: DashboardDragStateSnapshot,
  x: number,
  y: number,
  threshold = DASHBOARD_DRAG_MOVE_THRESHOLD
): boolean {
  return Math.hypot(x - state.originX, y - state.originY) > threshold
}

export function updateDashboardDragHover(
  state: DashboardDragStateSnapshot,
  hoverFolderId: string
): DashboardDragStateSnapshot {
  return {
    ...state,
    hoverFolderId: String(hoverFolderId || '').trim()
  }
}

export function getDashboardSelectionLabel(
  item: Pick<DashboardItem, 'title' | 'path' | 'url'>
): string {
  const title = String(item.title || '').replace(/\s+/g, ' ').trim() || '未命名书签'
  const context = String(item.path || displayUrl(item.url) || '')
    .replace(/\s+/g, ' ')
    .trim()

  return context
    ? `选择书签：${title}，位置：${context}`
    : `选择书签：${title}`
}

export function getDashboardCardActionLabel(
  action: string,
  item: Pick<DashboardItem, 'title' | 'url'>
): string {
  const title = String(item.title || displayUrl(item.url) || '未命名书签')
    .replace(/\s+/g, ' ')
    .trim()
  const safeTitle = title.length > 48 ? `${title.slice(0, 47).trim()}…` : title

  return `${action}：${safeTitle || '未命名书签'}`
}

export function renderDashboardIcon(icon: 'open' | 'copy' | 'tag' | 'speed-dial' | 'move' | 'delete'): string {
  const pathByIcon: Record<typeof icon, string> = {
    open: '<path d="M7 17 17 7"></path><path d="M9 7h8v8"></path>',
    copy: '<rect x="8" y="8" width="9" height="9" rx="2"></rect><path d="M6 14H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1"></path>',
    tag: '<path d="M20 12 12 20 4 12V4h8l8 8Z"></path><path d="M8 8h.01"></path>',
    'speed-dial': '<path d="M12 3v5"></path><path d="m16.6 5.4-3.5 3.5"></path><path d="M21 12h-5"></path><path d="M18.4 18.4 14.8 15"></path><path d="M5.6 18.4 9.2 15"></path><path d="M3 12h5"></path><path d="m7.4 5.4 3.5 3.5"></path><circle cx="12" cy="12" r="3"></circle>',
    move: '<path d="M12 3v18"></path><path d="m8 7 4-4 4 4"></path><path d="m8 17 4 4 4-4"></path><path d="M3 12h18"></path><path d="m7 8-4 4 4 4"></path><path d="m17 8 4 4-4 4"></path>',
    delete: '<path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M6 7l1 13h10l1-13"></path><path d="M9 7V4h6v3"></path>'
  }

  return `<svg aria-hidden="true" viewBox="0 0 24 24">${pathByIcon[icon]}</svg>`
}

function renderDashboardMoreIcon(): string {
  return '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"></circle><circle cx="12" cy="12" r="1.6"></circle><circle cx="19" cy="12" r="1.6"></circle></svg>'
}

function renderDashboardCardAction({
  as = 'button',
  icon,
  label,
  tooltip,
  className = '',
  attrs = '',
  text,
  disabled = false
}: {
  as?: 'a' | 'button'
  icon: Parameters<typeof renderDashboardIcon>[0]
  label: string
  tooltip: string
  className?: string
  attrs?: string
  text: string
  disabled?: boolean
}): string {
  const safeTooltip = escapeAttr(tooltip)
  const safeLabel = escapeAttr(label)
  const safeText = escapeHtml(text)
  const classes = ['dashboard-icon-action', className].filter(Boolean).join(' ')
  const disabledAttr = disabled ? ' disabled' : ''
  const content = `
    ${renderDashboardIcon(icon)}
    <span class="sr-only">${safeText}</span>
  `

  return as === 'a'
    ? `<a class="${escapeAttr(classes)}" ${attrs} data-dashboard-tooltip="${safeTooltip}" aria-label="${safeLabel}">${content}</a>`
    : `<button class="${escapeAttr(classes)}" type="button" ${attrs} data-dashboard-tooltip="${safeTooltip}" aria-label="${safeLabel}"${disabledAttr}>${content}</button>`
}

function renderDashboardCardMenuItem({
  icon,
  label,
  attrs,
  text,
  danger = false,
  disabled = false
}: {
  icon: Parameters<typeof renderDashboardIcon>[0]
  label: string
  attrs: string
  text: string
  danger?: boolean
  disabled?: boolean
}): string {
  return `
    <button
      class="dashboard-card-menu-item ${danger ? 'danger' : ''}"
      type="button"
      ${attrs}
      aria-label="${escapeAttr(label)}"
      ${disabled ? 'disabled' : ''}
    >
      ${renderDashboardIcon(icon)}
      <span>${escapeHtml(text)}</span>
    </button>
  `
}

export function createNewTabToggleSpeedDialMessage(bookmarkId: string): NewTabToggleSpeedDialMessage {
  return {
    type: NEWTAB_TOGGLE_SPEED_DIAL_MESSAGE_TYPE,
    bookmarkId: String(bookmarkId || '').trim()
  }
}

export function applyNewTabSpeedDialStateMessage(
  message: unknown
): boolean {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return false
  }

  const payload = message as Partial<NewTabSpeedDialStateMessage>
  if (payload.type !== NEWTAB_SPEED_DIAL_STATE_MESSAGE_TYPE || !Array.isArray(payload.pinnedIds)) {
    return false
  }

  dashboardState.speedDialPinnedIds = new Set(
    payload.pinnedIds
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  )
  renderDashboardSection()
  return true
}

export function isNewTabDashboardEmbed(search = window.location.search): boolean {
  return new URLSearchParams(search).get('embed') === DASHBOARD_NEWTAB_EMBED_PARAM
}

export function resetDashboardDragStateSnapshot(): DashboardDragStateSnapshot {
  return createDashboardDragState()
}

export function syncDashboardSelection(selection: Set<string>, validIds: Set<string>): Set<string> {
  for (const selectedId of [...selection]) {
    if (!validIds.has(String(selectedId))) {
      selection.delete(String(selectedId))
    }
  }
  return selection
}

export interface DashboardVirtualMetricsSnapshot {
  contentWidth: number
  containerHeight: number
  columnCount: number
}

function syncDashboardGridSurface(): void {
  if (dom.dashboardResults) {
    dom.dashboardResults.style.setProperty('--dashboard-card-height', `${DASHBOARD_CARD_HEIGHT}px`)
    dom.dashboardResults.style.setProperty('--dashboard-card-min-width', `${DASHBOARD_CARD_MIN_WIDTH}px`)
  }
}

export function getDashboardVirtualMetricsSnapshot(
  container: HTMLElement | null,
  fallbackWidth = 0,
  fallbackHeight = 0,
  minCardWidth = DASHBOARD_CARD_MIN_WIDTH
): DashboardVirtualMetricsSnapshot {
  if (!container) {
    return {
      contentWidth: 0,
      containerHeight: 0,
      columnCount: 1
    }
  }

  const style = window.getComputedStyle(container)
  const paddingLeft = Number.parseFloat(style.paddingLeft) || 0
  const paddingRight = Number.parseFloat(style.paddingRight) || 0
  const bounds = container.getBoundingClientRect()
  const parentBounds = container.parentElement?.getBoundingClientRect()
  const measuredWidth = Math.max(
    0,
    Number(container.clientWidth) || 0,
    Number(bounds.width) || 0,
    Number(parentBounds?.width) || 0
  )
  const rawWidth = measuredWidth >= DASHBOARD_VIRTUAL_MIN_READY_WIDTH
    ? measuredWidth
    : Math.max(measuredWidth, Number(fallbackWidth) || 0)
  const contentWidth = Math.max(0, rawWidth - paddingLeft - paddingRight)
  const measuredHeight = Math.max(
    0,
    Number(container.clientHeight) || 0,
    Number(bounds.height) || 0,
    Number(parentBounds?.height) || 0
  )
  const containerHeight = measuredHeight >= DASHBOARD_VIRTUAL_MIN_READY_HEIGHT
    ? measuredHeight
    : Math.max(measuredHeight, Number(fallbackHeight) || 0)

  return {
    contentWidth,
    containerHeight,
    columnCount: getDashboardVirtualColumnCount(contentWidth, minCardWidth)
  }
}

export function isDashboardVirtualMetricsReady(metrics: DashboardVirtualMetricsSnapshot): boolean {
  return (
    metrics.contentWidth >= DASHBOARD_VIRTUAL_MIN_READY_WIDTH &&
    metrics.containerHeight >= DASHBOARD_VIRTUAL_MIN_READY_HEIGHT
  )
}

function hasDashboardVirtualMetricsChanged(metrics: DashboardVirtualMetricsSnapshot): boolean {
  return (
    Math.round(metrics.contentWidth) !== Math.round(virtualState.lastResizeWidth) ||
    Math.round(metrics.containerHeight) !== Math.round(virtualState.lastResizeHeight) ||
    metrics.columnCount !== virtualState.lastResizeColumnCount
  )
}

export function shouldResetDashboardPanelRevealForRender({
  catalogLoading,
  viewReady
}: {
  catalogLoading: boolean
  viewReady: boolean
}): boolean {
  return Boolean(catalogLoading && viewReady)
}

export function shouldResetDashboardPanelRevealForSectionEntry({
  previousSectionKey,
  nextSectionKey
}: {
  previousSectionKey: string
  nextSectionKey: string
}): boolean {
  return previousSectionKey !== 'dashboard' && nextSectionKey === 'dashboard'
}

export function shouldRevealDashboardPanelAfterRender({
  catalogLoading,
  viewReady,
  revealFramePending,
  latestRenderVersion,
  revealRenderVersion,
  committedRenderVersion
}: {
  catalogLoading: boolean
  viewReady: boolean
  revealFramePending: boolean
  latestRenderVersion: number
  revealRenderVersion: number
  committedRenderVersion: number
}): boolean {
  const safeLatestVersion = Math.max(0, Math.floor(Number(latestRenderVersion) || 0))
  const safeRevealVersion = Math.max(0, Math.floor(Number(revealRenderVersion) || 0))
  const safeCommittedVersion = Math.max(0, Math.floor(Number(committedRenderVersion) || 0))

  return (
    !catalogLoading &&
    !viewReady &&
    !revealFramePending &&
    safeRevealVersion > 0 &&
    safeRevealVersion === safeLatestVersion &&
    safeCommittedVersion === safeRevealVersion
  )
}

export function shouldResetDashboardVirtualScrollForFilterChange({
  previousKey,
  nextKey,
  reason
}: {
  previousKey: string
  nextKey: string
  reason: DashboardVirtualFilterChangeReason
}): boolean {
  if (!nextKey || previousKey === nextKey) {
    return false
  }

  return reason !== 'folder' && reason !== 'append'
}

export function getSelectedDashboardBookmarks(): BookmarkRecord[] {
  return [...dashboardState.selectedIds]
    .map((id) => availabilityState.bookmarkMap.get(String(id)))
    .filter(Boolean)
}

function applyDashboardSelectionInputState(input: HTMLInputElement): boolean {
  const bookmarkId = getDashboardSelectionInputBookmarkId(input)
  if (!bookmarkId) {
    return false
  }

  const isChecked = Boolean(input.checked)
  const isSelected = dashboardState.selectedIds.has(bookmarkId)
  if (isChecked === isSelected) {
    return false
  }

  if (isChecked) {
    dashboardState.selectedIds.add(bookmarkId)
  } else {
    dashboardState.selectedIds.delete(bookmarkId)
  }
  return true
}

function getDashboardSelectionInputBookmarkId(input: HTMLInputElement): string {
  return String(input.getAttribute('data-dashboard-select') || '').trim()
}

export function syncDashboardSelectionOnly(changedIds?: Set<string>): void {
  if (!dom.dashboardResults) {
    return
  }

  const { model, visibleItems } = getDashboardRenderData()
  if (changedIds?.size) {
    for (const bookmarkId of changedIds) {
      if (!availabilityState.bookmarkMap.has(String(bookmarkId))) {
        dashboardState.selectedIds.delete(String(bookmarkId))
      }
    }
  } else {
    syncDashboardSelection(
      dashboardState.selectedIds,
      new Set(model.items.map((item) => String(item.id)))
    )
  }
  renderDashboardSelectionBar(visibleItems)

  if (changedIds?.size && changedIds.size <= 8) {
    for (const bookmarkId of changedIds) {
      syncDashboardSelectionCardState(String(bookmarkId || '').trim())
    }
    return
  }

  syncDashboardRenderedSelectionState()
}

function syncDashboardRenderedSelectionState(): void {
  dom.dashboardResults.querySelectorAll<HTMLElement>('[data-dashboard-card]').forEach((card) => {
    const bookmarkId = String(card.getAttribute('data-dashboard-bookmark-id') || '').trim()
    syncDashboardSelectionCardElement(card, bookmarkId)
  })
}

function syncDashboardSelectionCardState(bookmarkId: string): void {
  if (!bookmarkId) {
    return
  }

  const card = findDashboardCardElement(bookmarkId)
  if (card) {
    syncDashboardSelectionCardElement(card, bookmarkId)
  }
}

function syncDashboardSelectionCardElement(card: HTMLElement, bookmarkId: string): void {
  const selected = bookmarkId ? dashboardState.selectedIds.has(bookmarkId) : false
  card.classList.toggle('selected', selected)
  const input = card.querySelector<HTMLInputElement>('input[data-dashboard-select]')
  if (input) {
    input.checked = selected
  }
}

export function __resetDashboardSearchCachesForTest(): void {
  invalidateDashboardPopupSearchCaches()
}

function getDashboardScopeTitle(folderId: string): string {
  const folder = folderId ? availabilityState.folderMap.get(folderId) : null
  if (!folder) {
    return '书签栏'
  }

  return formatFolderPath(folder, availabilityState.folderMap) || folder.title || '书签栏'
}

function toggleDashboardTagPopover(tagToggle: HTMLElement): boolean {
  const bookmarkId = String(tagToggle.getAttribute('data-dashboard-toggle-tags') || '').trim()
  if (!bookmarkId) {
    return false
  }

  const previousExpandedIds = new Set(dashboardState.expandedTagIds)
  if (dashboardState.expandedTagIds.has(bookmarkId)) {
    closeDashboardTagPopover()
    return true
  } else {
    dashboardState.expandedTagIds.clear()
    dashboardState.expandedTagIds.add(bookmarkId)
  }
  if (!syncDashboardTagPopoverCards(new Set([...previousExpandedIds, bookmarkId]))) {
    renderDashboardSection()
  }
  return true
}

export function removeDashboardSelectionIds(bookmarkIds: unknown[]): void {
  for (const bookmarkId of bookmarkIds) {
    dashboardState.selectedIds.delete(String(bookmarkId))
  }
}

export function renderDashboardSection(): void {
  if (!dom.dashboardResults) {
    return
  }

  if (shouldResetDashboardPanelRevealForRender({
    catalogLoading: availabilityState.catalogLoading,
    viewReady: dashboardViewReady
  })) {
    resetDashboardPanelReveal()
  }
  const { model, visibleItems } = getDashboardRenderData()
  syncDashboardPanelReadyState()

  syncDashboardSelection(
    dashboardState.selectedIds,
    new Set(model.items.map((item) => String(item.id)))
  )
  syncDashboardSelection(
    dashboardState.expandedTagIds,
    new Set(model.items.map((item) => String(item.id)))
  )

  const effectiveFolderId = getDashboardEffectiveFolderId()
  const scopeTitle = getDashboardScopeTitle(effectiveFolderId)
  const scopedCountText = `(${visibleItems.length})`
  if (dom.dashboardTitle) {
    dom.dashboardTitle.innerHTML = `${escapeHtml(scopeTitle)} <span id="dashboard-total">${escapeHtml(scopedCountText)}</span>`
    dom.dashboardTotal = dom.dashboardTitle.querySelector('#dashboard-total') as typeof dom.dashboardTotal
  }
  if (dom.dashboardCardsTitle) {
    dom.dashboardCardsTitle.textContent = scopeTitle
  }
  dom.dashboardTotal.textContent = scopedCountText
  renderDashboardStatusOnly()
  dom.dashboardQuery.value = dashboardState.query
  syncDashboardGridSurface()
  renderDashboardSearchTools()
  renderDashboardFolderBreadcrumbs()
  renderDashboardFolderSidebar(model)

  renderDashboardSelectionBar(visibleItems)
  const renderVersion = beginDashboardCardsRender()
  renderDashboardCards(visibleItems, renderVersion)
  renderDashboardTagEditor(model)

  if (dragState.active) {
    renderDashboardDragOverlay(model)
  }
}

export function isDashboardViewReady(): boolean {
  return !availabilityState.catalogLoading && dashboardViewReady
}

export function prepareDashboardSectionEntry(): void {
  resetDashboardPanelReveal()
  dashboardFaviconWarmupItems = null
  dashboardFaviconWarmupKey = ''
  clearPendingDashboardFaviconWarmup()
  scheduleDashboardFaviconLoadSync()
  void hydrateDashboardSavedSearches().then(() => {
    if (!dom.dashboardPanel?.hidden) {
      renderDashboardSearchTools()
    }
  })
  startDashboardNaturalSearch()
}

export function hydrateDashboardFaviconCache(rawCache: unknown, now = Date.now()): void {
  dashboardFaviconCache = normalizeDashboardFaviconCache(rawCache, { now })
  dashboardFaviconCacheHydrated = true
}

export function handleDashboardInput(event: Event): void {
  const target = event.target as HTMLInputElement | HTMLSelectElement | null
  if (!target) {
    return
  }

  if (target.matches('input[data-dashboard-select]')) {
    const bookmarkId = getDashboardSelectionInputBookmarkId(target as HTMLInputElement)
    if (applyDashboardSelectionInputState(target as HTMLInputElement)) {
      syncDashboardSelectionOnly(new Set([bookmarkId]))
    }
    return
  }

  if (target.id === 'dashboard-tag-editor-input') {
    dashboardState.tagEditorDraft = target.value
    dashboardState.tagEditorStatus = ''
    return
  }

  if (target.id !== 'dashboard-query') {
    return
  }

  dashboardState.query = target.value
  ensureDashboardFullTextSearchMapForQuery()
  startDashboardNaturalSearch()
  invalidateDashboardVisibleItemCacheForSearchKey()
  markDashboardVirtualFilterChange('query')
  scheduleDashboardSectionRender()
}

function syncDashboardCardMenuOpenState(activeDetails: HTMLDetailsElement | null): void {
  window.requestAnimationFrame(() => {
    const detailsList = [
      ...(dom.dashboardPanel?.querySelectorAll<HTMLDetailsElement>('.dashboard-card-more') || [])
    ]
    for (const details of detailsList) {
      if (activeDetails && details !== activeDetails && details.open) {
        details.open = false
      }
      const open = details.open
      details.closest<HTMLElement>('[data-dashboard-card]')?.classList.toggle('menu-open', open)
      details.querySelector<HTMLElement>('summary')?.setAttribute('aria-expanded', open ? 'true' : 'false')
    }
  })
}

function closeDashboardCardMenuElement(details: HTMLDetailsElement): void {
  details.open = false
  details.closest<HTMLElement>('[data-dashboard-card]')?.classList.remove('menu-open')
  details.querySelector<HTMLElement>('summary')?.setAttribute('aria-expanded', 'false')
}

function closeOpenDashboardCardMenu({ restoreFocus = false }: { restoreFocus?: boolean } = {}): boolean {
  const openDetails = dom.dashboardPanel?.querySelector<HTMLDetailsElement>('.dashboard-card-more[open]')
  if (!openDetails) {
    return false
  }

  const summary = openDetails.querySelector<HTMLElement>('summary')
  closeDashboardCardMenuElement(openDetails)
  if (restoreFocus) {
    summary?.focus()
  }
  return true
}

export function handleDashboardKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null
  if (!target) {
    return
  }

  if (event.key === 'Escape' && closeOpenDashboardCardMenu({ restoreFocus: true })) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  if (event.key === 'Escape' && dashboardState.expandedTagIds.size) {
    if (closeDashboardTagPopover()) {
      event.preventDefault()
      event.stopPropagation()
    }
    return
  }

  if (handleDashboardFolderListboxKeydown(event, target)) {
    return
  }

  if (dashboardState.tagEditorBookmarkId && isDashboardTagEditorEvent(event)) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeDashboardTagEditor()
      return
    }

    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      void saveDashboardTagEditor()
    }
    return
  }

  const tagToggle = target.closest<HTMLElement>('[data-dashboard-toggle-tags]')
  if (!tagToggle || (event.key !== 'Enter' && event.key !== ' ')) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  toggleDashboardTagPopover(tagToggle)
}

export async function handleDashboardClick(event: Event, callbacks: DashboardCallbacks): Promise<void> {
  const target = event.target as HTMLElement | null
  if (!target) {
    return
  }

  const moreSummary = target.closest<HTMLElement>('.dashboard-card-more > summary')
  if (moreSummary) {
    syncDashboardCardMenuOpenState(moreSummary.closest<HTMLDetailsElement>('.dashboard-card-more'))
  }

  const savedSearchButton = target.closest<HTMLElement>('[data-dashboard-saved-search-action]')
  if (savedSearchButton) {
    await handleDashboardSavedSearchAction(savedSearchButton)
    return
  }

  const folderFilterButton = target.closest<HTMLElement>('[data-dashboard-folder-filter]')
  if (folderFilterButton) {
    applyDashboardFolderFilter(folderFilterButton.getAttribute('data-dashboard-folder-filter'))
    return
  }

  const selectionInput = target.closest<HTMLInputElement>('input[data-dashboard-select]')
  if (selectionInput) {
    const bookmarkId = getDashboardSelectionInputBookmarkId(selectionInput)
    if (applyDashboardSelectionInputState(selectionInput)) {
      syncDashboardSelectionOnly(new Set([bookmarkId]))
    }
    return
  }

  const tagToggle = target.closest<HTMLElement>('[data-dashboard-toggle-tags]')
  if (tagToggle) {
    toggleDashboardTagPopover(tagToggle)
    return
  }

  const actionButton = target.closest<HTMLElement>('[data-dashboard-action]')
  if (actionButton) {
    const action = actionButton.getAttribute('data-dashboard-action')
    if (action === 'select-visible') {
      selectVisibleDashboardItems()
    } else if (action === 'clear-selection') {
      if (dashboardState.selectedIds.size) {
        dashboardState.selectedIds.clear()
        syncDashboardSelectionOnly()
      }
    } else if (action === 'move-selected') {
      callbacks.openMoveModal('dashboard')
    } else if (action === 'delete-selected') {
      await deleteSelectedDashboardItems(callbacks)
    } else if (action === 'move-one') {
      const bookmarkId = String(actionButton.getAttribute('data-dashboard-bookmark-id') || '').trim()
      moveSingleDashboardItem(bookmarkId, callbacks)
    } else if (action === 'delete-one') {
      const bookmarkId = String(actionButton.getAttribute('data-dashboard-bookmark-id') || '').trim()
      await deleteDashboardBookmarkFromCard(bookmarkId, callbacks)
    } else if (action === 'toggle-speed-dial') {
      const bookmarkId = String(actionButton.getAttribute('data-dashboard-bookmark-id') || '').trim()
      await toggleDashboardBookmarkSpeedDial(bookmarkId)
    } else if (action === 'exit-dashboard') {
      if (callbacks.exitDashboard) {
        callbacks.exitDashboard()
      } else {
        window.location.hash = '#general'
      }
    } else if (action === 'edit-tags') {
      const bookmarkId = String(actionButton.getAttribute('data-dashboard-bookmark-id') || '').trim()
      openDashboardTagEditor(bookmarkId)
    } else if (action === 'toggle-natural-search') {
      void toggleDashboardNaturalSearch()
    } else if (action === 'close-tag-editor') {
      if (!cancelDashboardTagRegeneration()) {
        closeDashboardTagEditor()
      }
    } else if (action === 'save-tags') {
      await saveDashboardTagEditor()
    } else if (action === 'clear-ai-tags') {
      await clearDashboardAiTags()
    } else if (action === 'regenerate-ai-tags') {
      await regenerateDashboardAiTags(callbacks)
    }
    return
  }

  const copyButton = target.closest<HTMLElement>('[data-dashboard-copy]')
  if (copyButton) {
    await copyDashboardBookmarkUrl(String(copyButton.getAttribute('data-dashboard-copy') || '').trim())
    return
  }

}

export function handleDashboardError(event: Event, callbacks: DashboardCallbacks): void {
  const target = event.target
  if (!(target instanceof HTMLImageElement) || !target.matches('[data-dashboard-favicon]')) {
    return
  }

  handleDashboardFaviconError(target, callbacks)
}

export function handleDashboardLoad(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLImageElement) || !target.matches('[data-dashboard-favicon]')) {
    return
  }

  handleDashboardFaviconLoad(target)
}

export function handleDashboardTagPointerOver(event: PointerEvent): void {
  const target = event.target as HTMLElement | null
  const tagToggle = target?.closest<HTMLElement>('[data-dashboard-toggle-tags]')
  const bookmarkId = String(tagToggle?.getAttribute('data-dashboard-toggle-tags') || '').trim()
  if (!bookmarkId) {
    return
  }

  if (dashboardState.expandedTagIds.has(bookmarkId)) {
    const popover = findDashboardCardElement(bookmarkId)?.querySelector<HTMLElement>('.dashboard-tag-popover')
    if (popover) {
      cancelExitMotion(popover, 'is-closing')
    }
    return
  }

  const previousExpandedIds = new Set(dashboardState.expandedTagIds)
  dashboardState.expandedTagIds.clear()
  dashboardState.expandedTagIds.add(bookmarkId)
  if (!syncDashboardTagPopoverCards(new Set([...previousExpandedIds, bookmarkId]))) {
    renderDashboardSection()
  }
}

export function handleDashboardTagPointerOut(event: PointerEvent): void {
  if (!dashboardState.expandedTagIds.size) {
    return
  }

  const target = event.target as HTMLElement | null
  const boundary = target?.closest<HTMLElement>('[data-dashboard-toggle-tags], .dashboard-tag-popover')
  if (!boundary) {
    return
  }

  const nextTarget = event.relatedTarget as HTMLElement | null
  if (
    nextTarget &&
    (
      boundary.contains(nextTarget) ||
      Boolean(nextTarget.closest('[data-dashboard-toggle-tags], .dashboard-tag-popover'))
    )
  ) {
    return
  }

  closeDashboardTagPopover()
}

export function handleDashboardDocumentClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null
  if (target?.closest('.dashboard-card-more')) {
    return
  }
  closeOpenDashboardCardMenu()

  if (dashboardState.tagEditorBookmarkId && !isDashboardTagEditorEvent(event)) {
    if (!dashboardState.tagEditorSaving) {
      closeDashboardTagEditor()
    }
    return
  }

  if (!dashboardState.expandedTagIds.size) {
    return
  }

  if (isDashboardTagPopoverEvent(event)) {
    return
  }

  closeDashboardTagPopover()
}

export function handleDashboardDocumentFocusIn(event: FocusEvent): void {
  const target = event.target as HTMLElement | null
  if (!target?.closest('.dashboard-card-more')) {
    closeOpenDashboardCardMenu()
  }

  if (!dashboardState.expandedTagIds.size) {
    return
  }

  if (isDashboardTagPopoverEvent(event)) {
    return
  }

  closeDashboardTagPopover()
}

export function closeDashboardTagPopover(): boolean {
  if (!dashboardState.expandedTagIds.size) {
    return false
  }

  const bookmarkId = String([...dashboardState.expandedTagIds][0] || '')
  const popover = findDashboardCardElement(bookmarkId)?.querySelector<HTMLElement>('.dashboard-tag-popover')
  if (popover) {
    void closeWithExitMotion(popover, 'is-closing', () => {
      if (dashboardState.expandedTagIds.has(bookmarkId)) {
        dashboardState.expandedTagIds.delete(bookmarkId)
      }
      if (!syncDashboardTagPopoverCard(bookmarkId)) {
        renderDashboardSection()
      }
    }, 180)
  } else {
    const closingIds = new Set(dashboardState.expandedTagIds)
    dashboardState.expandedTagIds.clear()
    if (!syncDashboardTagPopoverCards(closingIds)) {
      renderDashboardSection()
    }
  }
  return true
}

export function closeDashboardTagEditor(): boolean {
  const closingBookmarkId = String(dashboardState.tagEditorBookmarkId || '')
  if (!closingBookmarkId) {
    return false
  }
  if (dashboardState.tagEditorBusyAction === 'regenerate-ai' && dashboardState.tagEditorSaving) {
    return cancelDashboardTagRegeneration()
  }
  if (dashboardState.tagEditorSaving) {
    return false
  }

  if (closingDashboardTagEditor) {
    return true
  }

  const editor = dom.dashboardTagEditor
  if (!editor || editor.classList.contains('hidden')) {
    clearDashboardTagEditorState()
    renderDashboardSection()
    restoreDashboardTagEditorFocus(closingBookmarkId)
    return true
  }

  closingDashboardTagEditor = true
  void closeWithExitMotion(editor, 'is-closing', () => {
    clearDashboardTagEditorState()
    closingDashboardTagEditor = false
    renderDashboardSection()
    restoreDashboardTagEditorFocus(closingBookmarkId)
  }, 220).catch(() => {
    clearDashboardTagEditorState()
    closingDashboardTagEditor = false
    renderDashboardSection()
    restoreDashboardTagEditorFocus(closingBookmarkId)
  })
  return true
}

function clearDashboardTagEditorState(): void {
  dashboardState.tagEditorBookmarkId = ''
  dashboardState.tagEditorDraft = ''
  dashboardState.tagEditorStatus = ''
  dashboardState.tagEditorSaving = false
  dashboardState.tagEditorBusyAction = ''
  dashboardState.tagEditorReturnFocusId = ''
  dashboardTagRegenerateController = null
}

function clearIdleDashboardTagEditorForFilterChange(): void {
  if (!dashboardState.tagEditorBookmarkId || dashboardState.tagEditorSaving) {
    return
  }

  clearDashboardTagEditorState()
}

function restoreDashboardTagEditorFocus(bookmarkId: string): void {
  const returnFocusId = String(dashboardState.tagEditorReturnFocusId || bookmarkId || '').trim()
  if (!returnFocusId) {
    return
  }

  window.setTimeout(() => {
    const card = findDashboardCardElement(returnFocusId)
    const editButton = card?.querySelector<HTMLElement>('[data-dashboard-action="edit-tags"]')
    if (editButton && document.contains(editButton) && !editButton.hasAttribute('disabled')) {
      editButton.focus()
    }
  }, 0)
}

function openDashboardTagEditor(bookmarkId: string): void {
  const { model } = getDashboardRenderData()
  const item = model.items.find((entry) => String(entry.id) === String(bookmarkId))
  if (!item) {
    return
  }

  dashboardState.expandedTagIds.clear()
  dashboardState.tagEditorBookmarkId = String(item.id)
  dashboardState.tagEditorReturnFocusId = String(item.id)
  dashboardState.tagEditorDraft = item.tags.join('\n')
  dashboardState.tagEditorStatus = item.hasManualTags
    ? '当前显示的是手动标签，AI 标签仍可单独重新生成或清除。'
    : item.tags.length
      ? '当前显示的是 AI 标签，保存后会作为手动标签保留。'
      : '当前没有标签，保存后会创建手动标签。'
  dashboardState.tagEditorSaving = false
  dashboardState.tagEditorBusyAction = ''
  dashboardTagRegenerateController = null
  closingDashboardTagEditor = false
  if (dom.dashboardTagEditor) {
    cancelExitMotion(dom.dashboardTagEditor, 'is-closing')
  }
  renderDashboardSection()
  window.setTimeout(() => dom.dashboardTagEditorInput?.focus(), 0)
}

async function saveDashboardTagEditor(): Promise<void> {
  const bookmark = availabilityState.bookmarkMap.get(String(dashboardState.tagEditorBookmarkId))
  if (!bookmark || dashboardState.tagEditorSaving) {
    return
  }

  dashboardState.tagEditorSaving = true
  dashboardState.tagEditorBusyAction = 'save'
  dashboardState.tagEditorStatus = '正在保存标签...'
  renderDashboardTagEditor()

  try {
    const manualTags = normalizeBookmarkTags(dashboardState.tagEditorDraft)
    const savedIndex = await saveManualBookmarkTags(bookmark, dashboardState.tagEditorDraft)
    aiNamingState.tagIndex = normalizeBookmarkTagIndex(savedIndex)
    const savedRecord = aiNamingState.tagIndex.records[String(bookmark.id)] || null
    dashboardState.statusMessage = manualTags.length
      ? '标签已保存。'
      : savedRecord?.tags?.length
        ? '已清除手动标签，显示 AI 标签。'
        : '已清除手动标签。'
    dashboardState.tagEditorSaving = false
    dashboardState.tagEditorBusyAction = ''
    closeDashboardTagEditor()
    renderDashboardSection()
  } catch (error) {
    dashboardState.tagEditorSaving = false
    dashboardState.tagEditorBusyAction = ''
    dashboardState.tagEditorStatus = error instanceof Error ? error.message : '标签保存失败。'
    renderDashboardTagEditor()
  }
}

async function clearDashboardAiTags(): Promise<void> {
  const bookmarkId = String(dashboardState.tagEditorBookmarkId || '').trim()
  if (!bookmarkId || dashboardState.tagEditorSaving) {
    return
  }

  dashboardState.tagEditorSaving = true
  dashboardState.tagEditorBusyAction = 'clear-ai'
  dashboardState.tagEditorStatus = '正在清除 AI 标签...'
  renderDashboardTagEditor()

  try {
    const savedIndex = await clearAiBookmarkTags(bookmarkId)
    aiNamingState.tagIndex = normalizeBookmarkTagIndex(savedIndex)
    dashboardState.tagEditorSaving = false
    dashboardState.tagEditorBusyAction = ''
    const record = aiNamingState.tagIndex.records[bookmarkId] || null
    if (!record?.manualTags?.length) {
      dashboardState.tagEditorDraft = ''
    }
    dashboardState.tagEditorStatus = record?.manualTags?.length
      ? '已清除 AI 标签，当前仍显示手动标签。'
      : '已清除 AI 标签，当前没有标签。'
    dashboardState.statusMessage = '已清除 AI 标签。'
    renderDashboardSection()
  } catch (error) {
    dashboardState.tagEditorSaving = false
    dashboardState.tagEditorBusyAction = ''
    dashboardState.tagEditorStatus = error instanceof Error ? error.message : 'AI 标签清除失败。'
    renderDashboardTagEditor()
  }
}

async function regenerateDashboardAiTags(callbacks: DashboardCallbacks): Promise<void> {
  const bookmark = availabilityState.bookmarkMap.get(String(dashboardState.tagEditorBookmarkId))
  if (!bookmark || dashboardState.tagEditorSaving) {
    return
  }

  dashboardTagRegenerateController?.abort()
  dashboardTagRegenerateController = new AbortController()
  dashboardState.tagEditorSaving = true
  dashboardState.tagEditorBusyAction = 'regenerate-ai'
  dashboardState.tagEditorStatus = '正在重新生成 AI 标签...'
  renderDashboardTagEditor()

  try {
    await callbacks.regenerateAiTags(bookmark, dashboardTagRegenerateController.signal)
    const bookmarkId = String(bookmark.id)
    const record = aiNamingState.tagIndex.records[bookmarkId] || null
    if (!record?.manualTags?.length) {
      dashboardState.tagEditorDraft = getEffectiveBookmarkTags(record).join('\n')
    }
    dashboardState.tagEditorSaving = false
    dashboardState.tagEditorBusyAction = ''
    dashboardTagRegenerateController = null
    dashboardState.tagEditorStatus = record?.manualTags?.length
      ? 'AI 标签已重新生成，当前仍显示手动标签。'
      : getEffectiveBookmarkTags(record).length
        ? 'AI 标签已重新生成。'
        : 'AI 已完成分析，但没有生成可展示的标签。'
    dashboardState.statusMessage = 'AI 标签已重新生成。'
    renderDashboardSection()
  } catch (error) {
    const wasCancelled = dashboardTagRegenerateController?.signal.aborted === true
    dashboardState.tagEditorSaving = false
    dashboardState.tagEditorBusyAction = ''
    dashboardTagRegenerateController = null
    dashboardState.tagEditorStatus = wasCancelled && isAbortError(error)
      ? '已取消重新生成 AI 标签。'
      : error instanceof Error ? error.message : 'AI 标签重新生成失败。'
    renderDashboardTagEditor()
  }
}

function cancelDashboardTagRegeneration(): boolean {
  if (dashboardState.tagEditorBusyAction !== 'regenerate-ai' || !dashboardState.tagEditorSaving) {
    return false
  }

  dashboardState.tagEditorStatus = '正在取消重新生成 AI 标签...'
  dashboardTagRegenerateController?.abort()
  renderDashboardTagEditor()
  return true
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function isDashboardTagPopoverEvent(event: Event): boolean {
  return event.composedPath().some((item) => {
    return item instanceof HTMLElement &&
      Boolean(item.closest('[data-dashboard-toggle-tags], .dashboard-tag-popover'))
  })
}

function isDashboardTagEditorEvent(event: Event): boolean {
  return event.composedPath().some((item) => {
    return item instanceof HTMLElement &&
      Boolean(item.closest('[data-dashboard-action="edit-tags"], .dashboard-tag-editor'))
  })
}

export function handleDashboardPointerDown(event: PointerEvent): void {
  if (
    event.button !== 0 ||
    !event.isPrimary ||
    availabilityState.catalogLoading ||
    availabilityState.deleting ||
    dragState.moving
  ) {
    return
  }

  const target = event.target as HTMLElement | null
  if (!target || shouldIgnoreDashboardDragTarget(target)) {
    return
  }

  const card = target.closest<HTMLElement>('[data-dashboard-card]')
  const bookmarkId = String(card?.getAttribute('data-dashboard-bookmark-id') || '').trim()
  if (!card || !bookmarkId || !availabilityState.bookmarkMap.has(bookmarkId)) {
    return
  }

  suppressDashboardNativeSelection(event)
  cancelDashboardDrag({ silent: true })

  dragState.armed = true
  dragState.active = false
  dragState.bookmarkId = bookmarkId
  dragState.pointerId = event.pointerId
  dragState.originX = event.clientX
  dragState.originY = event.clientY
  dragState.currentX = event.clientX
  dragState.currentY = event.clientY
  dragState.hoverFolderId = ''
  dragState.hoverDeleteTarget = false
  dragState.captureElement = card

  try {
    card.setPointerCapture(event.pointerId)
  } catch {
    // Some synthetic events and older Chromium edge cases cannot capture; drag still works via bubbling.
  }
}

export function handleDashboardPointerMove(event: PointerEvent): void {
  if (!isDashboardDragPointer(event)) {
    return
  }

  if (event.pointerType !== 'touch') {
    suppressDashboardNativeSelection(event)
  }

  dragState.currentX = event.clientX
  dragState.currentY = event.clientY

  if (
    dragState.armed &&
    !dragState.active &&
    hasDashboardDragPassedThreshold(dragState, event.clientX, event.clientY)
  ) {
    startDashboardDrag()
  }

  if (!dragState.active) {
    return
  }

  suppressDashboardNativeSelection(event)
  updateDashboardDragPreviewPosition()
  updateDashboardDropHoverFromPoint(event.clientX, event.clientY)
}

export async function handleDashboardPointerUp(event: PointerEvent, callbacks: DashboardCallbacks): Promise<void> {
  if (!isDashboardDragPointer(event)) {
    return
  }

  if (!dragState.active) {
    cancelDashboardDrag({ silent: true })
    return
  }

  suppressDashboardNativeSelection(event)
  updateDashboardDropHoverFromPoint(event.clientX, event.clientY)

  const bookmarkId = dragState.bookmarkId
  const dropOnDeleteTarget = dragState.hoverDeleteTarget
  const folderId = dragState.hoverFolderId
  if (dropOnDeleteTarget) {
    dragState.moving = true
    dom.dashboardDragOverlay?.classList.add('is-moving')
    if (dom.dashboardDragHint) {
      dom.dashboardDragHint.textContent = '等待确认删除...'
    }

    await closeDashboardDragForFollowUp({ silent: true })
    await deleteDashboardBookmarkFromDrop(bookmarkId, callbacks)
    return
  }

  if (!folderId) {
    cancelDashboardDrag({ silent: true })
    return
  }

  dragState.moving = true
  dom.dashboardDragOverlay?.classList.add('is-moving')
  if (dom.dashboardDragHint) {
    dom.dashboardDragHint.textContent = '正在移动书签...'
  }

  await moveDashboardBookmarkToFolder(bookmarkId, folderId, callbacks)
  cancelDashboardDrag({ silent: true })
}

export function handleDashboardPointerCancel(): void {
  cancelDashboardDrag({ silent: true })
}

export function cancelDashboardDrag({ silent = false }: { silent?: boolean } = {}): boolean {
  const wasActive = resetDashboardDragState()
  void hideDashboardDragOverlay()

  if (wasActive && !silent) {
    setDashboardStatus('已取消移动。')
  }

  return wasActive
}

export function selectVisibleDashboardItems(): void {
  const { visibleItems } = getDashboardRenderData()
  let changed = false
  for (const item of visibleItems) {
    const bookmarkId = String(item.id)
    if (!dashboardState.selectedIds.has(bookmarkId)) {
      dashboardState.selectedIds.add(bookmarkId)
      changed = true
    }
  }
  if (changed) {
    syncDashboardSelectionOnly()
  }
}

export async function deleteSelectedDashboardItems(callbacks: DashboardCallbacks): Promise<void> {
  const selectedBookmarks = getSelectedDashboardBookmarks()
  if (!selectedBookmarks.length || availabilityState.deleting) {
    return
  }

  const confirmed = await callbacks.confirm({
    title: `删除 ${selectedBookmarks.length} 条书签？`,
    copy: '这些书签会从 Chrome 书签中移除并进入回收站。你仍可在回收站里恢复它们。',
    confirmLabel: '删除并移入回收站',
    label: '移入回收站',
    tone: 'danger'
  })
  if (!confirmed) {
    return
  }

  await deleteBookmarksToRecycle(
    selectedBookmarks.map((bookmark) => bookmark.id),
    '书签仪表盘批量删除',
    callbacks.recycleCallbacks
  )
}

async function deleteDashboardBookmarkFromDrop(
  bookmarkId: string,
  callbacks: DashboardCallbacks
): Promise<void> {
  await deleteDashboardBookmark(bookmarkId, callbacks, {
    reason: '书签仪表盘拖拽删除',
    cancelledStatus: '已取消删除。'
  })
}

async function deleteDashboardBookmarkFromCard(
  bookmarkId: string,
  callbacks: DashboardCallbacks
): Promise<void> {
  await deleteDashboardBookmark(bookmarkId, callbacks, {
    reason: '书签仪表盘卡片删除',
    cancelledStatus: '已取消删除。'
  })
}

async function deleteDashboardBookmark(
  bookmarkId: string,
  callbacks: DashboardCallbacks,
  {
    reason,
    cancelledStatus
  }: {
    reason: string
    cancelledStatus: string
  }
): Promise<void> {
  const bookmark = availabilityState.bookmarkMap.get(String(bookmarkId))
  if (!bookmark?.url) {
    setDashboardStatus('删除失败：书签不存在。')
    return
  }

  const confirmed = await callbacks.confirm({
    title: '删除这个书签？',
    copy: `“${bookmark.title || '未命名书签'}” 会从 Chrome 书签中移除并进入回收站，可在回收站恢复。`,
    confirmLabel: '删除并移入回收站',
    label: '移入回收站',
    tone: 'danger'
  })
  if (!confirmed) {
    setDashboardStatus(cancelledStatus)
    return
  }

  dashboardState.selectedIds.delete(String(bookmarkId))
  await deleteBookmarksToRecycle([bookmarkId], reason, callbacks.recycleCallbacks)
  setDashboardStatus(
    availabilityState.bookmarkMap.has(String(bookmarkId))
      ? (availabilityState.lastError || '删除失败，请稍后重试。')
      : '已删除书签，并移入回收站。'
  )
}

function moveSingleDashboardItem(bookmarkId: string, callbacks: DashboardCallbacks): void {
  const bookmark = availabilityState.bookmarkMap.get(String(bookmarkId))
  if (!bookmark?.url || availabilityState.deleting) {
    return
  }

  managerState.moveDashboardBookmarkId = String(bookmarkId)
  callbacks.openMoveModal('dashboard-single')
}

export async function hydrateDashboardSpeedDialState(): Promise<void> {
  if (isNewTabDashboardEmbed()) {
    return
  }

  try {
    const stored = await getLocalStorage([STORAGE_KEYS.newTabWorkspaceSettings])
    applyDashboardSpeedDialWorkspaceSettings(stored[STORAGE_KEYS.newTabWorkspaceSettings])
  } catch {
    dashboardState.speedDialPinnedIds = new Set()
  }
}

function applyDashboardSpeedDialWorkspaceSettings(rawSettings: unknown): void {
  const settings = normalizeNewTabWorkspaceSettings(rawSettings, {
    validBookmarkIds: availabilityState.bookmarkMap.keys()
  })
  dashboardState.speedDialPinnedIds = new Set(getActiveNewTabWorkspace(settings).pinnedIds)
}

async function toggleDashboardBookmarkSpeedDial(bookmarkId: string): Promise<void> {
  const safeBookmarkId = String(bookmarkId || '').trim()
  if (!safeBookmarkId || !availabilityState.bookmarkMap.has(safeBookmarkId)) {
    setDashboardStatus('添加失败：书签不存在。')
    return
  }

  if (isNewTabDashboardEmbed()) {
    window.parent.postMessage(createNewTabToggleSpeedDialMessage(safeBookmarkId), window.location.origin)
    if (dashboardState.speedDialPinnedIds.has(safeBookmarkId)) {
      dashboardState.speedDialPinnedIds.delete(safeBookmarkId)
    } else {
      dashboardState.speedDialPinnedIds.add(safeBookmarkId)
    }
    if (!patchDashboardCardById(safeBookmarkId)) {
      renderDashboardSection()
    }
    setDashboardStatus('已切换 Speed Dial 固定状态。', '', { render: false })
    return
  }

  try {
    const stored = await getLocalStorage([STORAGE_KEYS.newTabWorkspaceSettings])
    const settings = normalizeNewTabWorkspaceSettings(stored[STORAGE_KEYS.newTabWorkspaceSettings], {
      validBookmarkIds: availabilityState.bookmarkMap.keys()
    })
    const activeWorkspace = getActiveNewTabWorkspace(settings)
    const nextSettings = toggleNewTabWorkspacePin(settings, activeWorkspace.id, safeBookmarkId, {
      validBookmarkIds: availabilityState.bookmarkMap.keys()
    })
    await setLocalStorage({
      [STORAGE_KEYS.newTabWorkspaceSettings]: nextSettings
    })
    dashboardState.speedDialPinnedIds = new Set(getActiveNewTabWorkspace(nextSettings).pinnedIds)
    if (!patchDashboardCardById(safeBookmarkId)) {
      renderDashboardSection()
    }
    setDashboardStatus(
      dashboardState.speedDialPinnedIds.has(safeBookmarkId)
        ? '已添加到 Speed Dial。'
        : '已从 Speed Dial 移除。',
      '',
      { render: false }
    )
  } catch (error) {
    setDashboardStatus(error instanceof Error ? error.message : 'Speed Dial 状态更新失败，请稍后重试。')
  }
}

export function getSingleDashboardMoveBookmark(): BookmarkRecord | null {
  const bookmarkId = String(managerState.moveDashboardBookmarkId || '').trim()
  if (!bookmarkId) {
    return null
  }
  return availabilityState.bookmarkMap.get(bookmarkId) || null
}

export async function moveSelectedDashboardBookmarks(
  folderId: string,
  callbacks: DashboardCallbacks
): Promise<void> {
  const selectedBookmarks = getSelectedDashboardBookmarks()
  if (!selectedBookmarks.length) {
    callbacks.closeMoveModal()
    return
  }

  availabilityState.deleting = true
  availabilityState.lastError = ''
  callbacks.renderAvailabilitySection()

  const movedIds: string[] = []
  let moveError: unknown = null

  try {
    await createAutoBackupBeforeDangerousOperation({
      kind: 'batch-move',
      source: 'options',
      reason: `书签仪表盘批量移动 ${selectedBookmarks.length} 条`,
      targetBookmarkIds: selectedBookmarks.map((bookmark) => String(bookmark.id)),
      targetFolderIds: [folderId],
      estimatedChangeCount: selectedBookmarks.length
    })

    for (const bookmark of selectedBookmarks) {
      if (String(bookmark.parentId || '') === folderId) {
        continue
      }
      await moveBookmark(bookmark.id, folderId)
      movedIds.push(bookmark.id)
    }
  } catch (error) {
    moveError = error
  } finally {
    availabilityState.deleting = false
    callbacks.closeMoveModal()

    if (movedIds.length) {
      removeDashboardSelectionIds(movedIds)
      await callbacks.hydrateAvailabilityCatalog({ preserveResults: true })
    }

    const targetFolder = availabilityState.folderMap.get(folderId)
    if (moveError) {
      availabilityState.lastError = moveError instanceof Error
        ? `仪表盘批量移动过程中断，已移动 ${movedIds.length} 条：${moveError.message}`
        : `仪表盘批量移动过程中断，已移动 ${movedIds.length} 条。`
    } else if (movedIds.length) {
      availabilityState.lastError = `已将 ${movedIds.length} 条书签移动到 ${targetFolder?.path || targetFolder?.title || '目标文件夹'}。`
    } else {
      availabilityState.lastError = '所选书签已在目标文件夹。'
    }

    callbacks.renderAvailabilitySection()
  }
}

export async function moveSingleDashboardBookmark(
  folderId: string,
  callbacks: DashboardCallbacks
): Promise<void> {
  const bookmarkId = String(managerState.moveDashboardBookmarkId || '').trim()
  const bookmark = bookmarkId ? availabilityState.bookmarkMap.get(bookmarkId) : null
  const targetFolder = availabilityState.folderMap.get(String(folderId))
  if (!bookmark?.url || !targetFolder) {
    callbacks.closeMoveModal()
    setDashboardStatus('移动失败：目标书签或文件夹不存在。')
    return
  }

  availabilityState.deleting = true
  availabilityState.lastError = ''
  callbacks.renderAvailabilitySection()

  let moved = false
  let moveError: unknown = null

  try {
    await createAutoBackupBeforeDangerousOperation({
      kind: 'batch-move',
      source: 'options',
      reason: '书签仪表盘单项移动',
      targetBookmarkIds: [bookmarkId],
      targetFolderIds: [folderId],
      estimatedChangeCount: 1
    })

    if (String(bookmark.parentId || '') !== folderId) {
      await moveBookmark(bookmarkId, folderId)
      moved = true
    }
  } catch (error) {
    moveError = error
  } finally {
    availabilityState.deleting = false
    callbacks.closeMoveModal()

    if (moved) {
      await callbacks.hydrateAvailabilityCatalog({ preserveResults: true })
    }

    if (moveError) {
      setDashboardStatus(moveError instanceof Error ? `移动失败：${moveError.message}` : '移动失败，请稍后重试。')
    } else if (moved) {
      setDashboardStatus(`已移动到 ${targetFolder.path || targetFolder.title}。`)
    } else {
      setDashboardStatus('书签已在该文件夹。')
    }
  }
}

export function getDashboardRenderData() {
  const model = perfMeasureNow('dashboard.modelBuildMs', () => getCachedDashboardModel({
    bookmarks: availabilityState.allBookmarks,
    folders: availabilityState.allFolders,
    tagIndex: (aiNamingState.tagIndex as BookmarkTagIndex) || null,
    contentSnapshotIndex: contentSnapshotState.index,
    contentSnapshotSearchMap: contentSnapshotState.searchTextMap,
    includeFullText: contentSnapshotState.settings.fullTextSearchEnabled
  }))
  const effectiveFolderId = getDashboardEffectiveFolderId()
  const visibleItems = perfMeasureNow('dashboard.filterMs', () => getCachedDashboardVisibleItems(model, {
    query: dashboardState.query,
    folderId: effectiveFolderId,
    domain: dashboardState.domain,
    month: dashboardState.month,
    sortKey: dashboardState.sortKey
  }))
  perfLogCount('dashboard.visibleCount', visibleItems.length)

  return {
    model,
    visibleItems
  }
}

function getCachedDashboardModel({
  bookmarks,
  folders,
  tagIndex,
  contentSnapshotIndex,
  contentSnapshotSearchMap,
  includeFullText
}: {
  bookmarks: BookmarkRecord[]
  folders: FolderRecord[]
  tagIndex: BookmarkTagIndex | null
  contentSnapshotIndex: ContentSnapshotIndex | null
  contentSnapshotSearchMap: Map<string, string> | null
  includeFullText: boolean
}): DashboardModel {
  const key: DashboardModelCacheKey = {
    bookmarks,
    folders,
    tagIndex,
    tagRecords: tagIndex?.records || null,
    tagUpdatedAt: Number(tagIndex?.updatedAt) || 0,
    contentSnapshotIndex,
    contentSnapshotRecords: contentSnapshotIndex?.records || null,
    contentSnapshotUpdatedAt: Number(contentSnapshotIndex?.updatedAt) || 0,
    contentSnapshotSearchMap,
    contentSnapshotSearchMapSize: contentSnapshotSearchMap?.size || 0,
    includeFullText
  }

  if (dashboardRenderCache.model && dashboardRenderCache.modelKey && isDashboardModelCacheKeyEqual(dashboardRenderCache.modelKey, key)) {
    return dashboardRenderCache.model
  }

  const model = buildDashboardModel({
    bookmarks,
    folders,
    tagIndex,
    contentSnapshotIndex,
    contentSnapshotSearchMap,
    includeFullText
  })
  dashboardRenderCache.modelKey = key
  dashboardRenderCache.model = model
  dashboardRenderCache.visibleItems = null
  dashboardRenderCache.visibleModel = null
  dashboardRenderCache.visibleNaturalPlan = null
  dashboardRenderCache.folderCountsModel = null
  dashboardRenderCache.folderBookmarkCounts = null
  dashboardRenderCache.sidebarModel = null
  dashboardRenderCache.sidebarMarkup = ''
  dashboardPopupSearchIndexCache.model = null
  dashboardPopupSearchIndexCache.bookmarks = null
  dashboardPopupSearchIndexCache.bookmarkById = null
  dashboardPopupSearchIndexCache.pinyinReady = false
  dashboardPopupSearchIndexCache.pinyinPending = false
  dashboardPopupSearchIndexCache.pinyinRunId += 1
  dashboardPopupSearchIndexCache.pinyinPriorityKey = ''
  dashboardPopupSearchIndexCache.pinyinPriorityPending = false
  resetDashboardSearchWorker()
  return model
}

function ensureDashboardFullTextSearchMapForQuery(): void {
  if (
    !contentSnapshotState.settings.fullTextSearchEnabled ||
    contentSnapshotState.searchTextMapIncludesFullText ||
    contentSnapshotState.searchTextMapLoadingFullText ||
    !parseSearchQuery(dashboardState.query).textTerms.length
  ) {
    return
  }

  contentSnapshotState.searchTextMapLoadingFullText = true
  void buildContentSnapshotSearchMapWithFullText(contentSnapshotState.index, {
    includeFullText: true,
    maxRecords: 1000
  })
    .then((searchMap) => {
      contentSnapshotState.searchTextMap = searchMap
      contentSnapshotState.searchTextMapIncludesFullText = true
      dashboardRenderCache.modelKey = null
      dashboardRenderCache.model = null
      markDashboardVirtualFilterChange('append')
      scheduleDashboardListRender()
    })
    .catch(() => {
      contentSnapshotState.searchTextMapIncludesFullText = false
      contentSnapshotState.searchTextMapFullTextRetryCount = 0
    })
    .finally(() => {
      contentSnapshotState.searchTextMapLoadingFullText = false
    })
}

function invalidateDashboardVisibleItemCache(): void {
  dashboardRenderCache.visibleItems = null
  dashboardRenderCache.visibleModel = null
  dashboardRenderCache.visibleNaturalPlan = null
}

function invalidateDashboardVisibleItemCacheForSearchKey(searchKey = ''): void {
  invalidateDashboardVisibleItemCache()
  if (searchKey) {
    dashboardSearchWorkerState.resultCache.delete(searchKey)
    dashboardSearchWorkerState.limitByKey.delete(searchKey)
  } else {
    dashboardSearchWorkerState.resultCache.clear()
    dashboardSearchWorkerState.limitByKey.clear()
  }
}

function invalidateDashboardPopupSearchCaches(): void {
  invalidateDashboardVisibleItemCache()
  dashboardActiveSearchKey = ''
  dashboardActiveSearchLimit = 0
  dashboardActiveSearchResultCount = 0
  dashboardPopupSearchIndexCache.model = null
  dashboardPopupSearchIndexCache.tagRecords = null
  dashboardPopupSearchIndexCache.tagUpdatedAt = 0
  dashboardPopupSearchIndexCache.bookmarks = null
  dashboardPopupSearchIndexCache.bookmarkById = null
  dashboardPopupSearchIndexCache.pinyinReady = false
  dashboardPopupSearchIndexCache.pinyinPending = false
  dashboardPopupSearchIndexCache.pinyinRunId += 1
  dashboardPopupSearchIndexCache.pinyinPriorityKey = ''
  dashboardPopupSearchIndexCache.pinyinPriorityPending = false
  resetDashboardSearchWorker()
}

function isDashboardModelCacheKeyEqual(left: DashboardModelCacheKey, right: DashboardModelCacheKey): boolean {
  return (
    left.bookmarks === right.bookmarks &&
    left.folders === right.folders &&
    left.tagIndex === right.tagIndex &&
    left.tagRecords === right.tagRecords &&
    left.tagUpdatedAt === right.tagUpdatedAt &&
    left.contentSnapshotIndex === right.contentSnapshotIndex &&
    left.contentSnapshotRecords === right.contentSnapshotRecords &&
    left.contentSnapshotUpdatedAt === right.contentSnapshotUpdatedAt &&
    left.contentSnapshotSearchMap === right.contentSnapshotSearchMap &&
    left.contentSnapshotSearchMapSize === right.contentSnapshotSearchMapSize &&
    left.includeFullText === right.includeFullText
  )
}

function getCachedDashboardVisibleItems(
  model: DashboardModel,
  filters: DashboardFilters = {}
): DashboardItem[] {
  const query = String(filters.query || '')
  const naturalPlan = getDashboardVisibleNaturalSearchPlan(query)
  const folderId = String(filters.folderId || '')
  const domain = String(filters.domain || '')
  const month = String(filters.month || '')
  const sortKey = filters.sortKey || 'date-desc'

  if (
    dashboardRenderCache.visibleItems &&
    dashboardRenderCache.visibleModel === model &&
    dashboardRenderCache.visibleNaturalPlan === naturalPlan &&
    dashboardRenderCache.visibleQuery === query &&
    dashboardRenderCache.visibleFolderId === folderId &&
    dashboardRenderCache.visibleDomain === domain &&
    dashboardRenderCache.visibleMonth === month &&
    dashboardRenderCache.visibleSortKey === sortKey
  ) {
    return dashboardRenderCache.visibleItems
  }

  const visibleItems = naturalPlan
    ? getNaturalDashboardVisibleItems(model, naturalPlan, {
      query,
      folderId,
      domain,
      month,
      sortKey
    })
    : getPopupDashboardVisibleItems(model, {
      query,
      folderId,
      domain,
      month,
      sortKey
    })
  dashboardRenderCache.visibleModel = model
  dashboardRenderCache.visibleNaturalPlan = naturalPlan
  dashboardRenderCache.visibleQuery = query
  dashboardRenderCache.visibleFolderId = folderId
  dashboardRenderCache.visibleDomain = domain
  dashboardRenderCache.visibleMonth = month
  dashboardRenderCache.visibleSortKey = sortKey
  dashboardRenderCache.visibleItems = visibleItems
  return visibleItems
}

function getPopupDashboardVisibleItems(
  model: DashboardModel,
  filters: DashboardFilters = {}
): DashboardItem[] {
  const query = String(filters.query || '').trim()
  const normalizedQuery = normalizeDashboardSearchText(query)
  const isPinyinQuery = queryLooksLikePinyin(normalizedQuery)
  const structurallyFiltered = filterDashboardItems(model.items, {
    query: query ? '' : query,
    folderId: filters.folderId,
    domain: filters.domain,
    month: filters.month
  })
  if (!query) {
    dashboardActiveSearchKey = ''
    dashboardActiveSearchLimit = 0
    dashboardActiveSearchResultCount = 0
  }
  if (!query) {
    return sortDashboardItems(structurallyFiltered, filters.sortKey)
  }

  const itemById = new Map(structurallyFiltered.map((item) => [String(item.id), item]))
  const searchKey = getDashboardSearchKey({ model, filters, query, itemCount: structurallyFiltered.length })
  const limit = getDashboardSearchResultLimit(searchKey)
  dashboardActiveSearchKey = searchKey
  dashboardActiveSearchLimit = limit
  dashboardActiveSearchResultCount = structurallyFiltered.length

  if (isPinyinQuery) {
    const popupBookmarks = getDashboardPopupSearchBookmarksFromItems(model, structurallyFiltered)
    const results = searchDashboardPinyinBookmarks(query, searchKey, popupBookmarks, limit)
    dashboardActiveSearchResultCount = results.length < limit ? results.length : structurallyFiltered.length
    return results
      .map((result) => itemById.get(String(result.id)))
      .filter((item): item is DashboardItem => Boolean(item))
  }

  if (shouldUseDashboardSearchWorker(structurallyFiltered.length)) {
    const cachedIds = getDashboardWorkerSearchResultIds({
      model,
      filters,
      query,
      searchKey,
      limit
    })
    dashboardActiveSearchResultCount = cachedIds.length < limit ? cachedIds.length : structurallyFiltered.length
    return cachedIds
      .map((id) => itemById.get(String(id)))
      .filter((item): item is DashboardItem => Boolean(item))
  }

  const popupBookmarks = getDashboardPopupSearchBookmarksFromItems(model, structurallyFiltered)
  const results = searchBookmarksTopK(query, popupBookmarks, limit)
  dashboardActiveSearchResultCount = results.length < limit ? results.length : structurallyFiltered.length
  return results
    .map((result) => itemById.get(String(result.id)))
    .filter((item): item is DashboardItem => Boolean(item))
}

function getDashboardSearchKey({
  model,
  filters,
  query,
  itemCount
}: {
  model: DashboardModel
  filters: DashboardFilters
  query: string
  itemCount: number
}): string {
  return [
    query,
    String(filters.folderId || ''),
    String(filters.domain || ''),
    String(filters.month || ''),
    String(filters.sortKey || 'date-desc'),
    String(itemCount),
    String(model.items.length),
    String(model.items[0]?.id || ''),
    String(model.items[model.items.length - 1]?.id || '')
  ].join('\u0001')
}

function getDashboardSearchResultLimit(searchKey: string): number {
  const requestedLimit = dashboardSearchWorkerState.limitByKey.get(searchKey) || 0
  const currentLimit = dashboardSearchWorkerState.resultCache.get(searchKey)?.length || 0
  return Math.min(
    DASHBOARD_SEARCH_MAX_SYNC_LIMIT,
    Math.max(DASHBOARD_SEARCH_INITIAL_LIMIT, requestedLimit, currentLimit)
  )
}

function getNextDashboardSearchResultLimit(searchKey: string): number {
  const currentLimit = getDashboardSearchResultLimit(searchKey)
  return Math.min(
    DASHBOARD_SEARCH_MAX_SYNC_LIMIT,
    Math.max(DASHBOARD_SEARCH_INITIAL_LIMIT, currentLimit + DASHBOARD_SEARCH_INCREMENT)
  )
}

function shouldUseDashboardSearchWorker(itemCount: number): boolean {
  return itemCount > DASHBOARD_SEARCH_WORKER_THRESHOLD && typeof Worker !== 'undefined'
}

function searchDashboardPinyinBookmarks(
  query: string,
  searchKey: string,
  bookmarks: PopupSearchBookmark[],
  limit: number
): PopupSearchResult[] {
  if (!dashboardPopupSearchIndexCache.pinyinReady) {
    ensureDashboardPinyinForQuery(query, searchKey, bookmarks)
  }
  return searchBookmarksTopK(query, bookmarks, limit)
}

function collectDashboardPendingPinyinTargets(bookmarks: PopupSearchBookmark[]): PopupSearchBookmark[] {
  return bookmarks.filter((bookmark) => bookmark.pinyinEnriched !== true)
}

function getDashboardWorkerSearchResultIds({
  model,
  filters,
  query,
  searchKey,
  limit
}: {
  model: DashboardModel
  filters: DashboardFilters
  query: string
  searchKey: string
  limit: number
}): string[] {
  ensureDashboardSearchWorker(model)
  if (dashboardSearchWorkerState.error) {
    const popupBookmarks = getDashboardPopupSearchBookmarksFromItems(
      model,
      filterDashboardItems(model.items, {
        query: '',
        folderId: filters.folderId,
        domain: filters.domain,
        month: filters.month
      })
    )
    ensureDashboardPinyinForQuery(query, searchKey, popupBookmarks)
    return searchBookmarksTopK(query, popupBookmarks, limit).map((result) => String(result.id))
  }

  const cachedIds = dashboardSearchWorkerState.resultCache.get(searchKey)
  if (!cachedIds || cachedIds.length < limit) {
    requestDashboardWorkerSearch({
      searchKey,
      query,
      filters,
      limit
    })
  }

  return cachedIds ? cachedIds.slice(0, limit) : []
}

function ensureDashboardSearchWorker(model: DashboardModel): Worker | null {
  const tagIndex = (aiNamingState.tagIndex as BookmarkTagIndex | null) || null
  const tagRecords = tagIndex?.records || EMPTY_DASHBOARD_TAG_RECORDS
  const tagUpdatedAt = Number(tagIndex?.updatedAt) || 0
  const state = dashboardSearchWorkerState
  ensureDashboardPopupSearchIndexPinyin()

  if (
    state.worker &&
    state.model === model &&
    state.tagRecords === tagRecords &&
    state.tagUpdatedAt === tagUpdatedAt &&
    state.pinyinReady === dashboardPopupSearchIndexCache.pinyinReady
  ) {
    return state.worker
  }

  resetDashboardSearchWorker()
  if (typeof Worker === 'undefined') {
    return null
  }

  const worker = new Worker(new URL('../../shared/search/search-worker.ts', import.meta.url), {
    type: 'module',
    name: 'dashboard-search'
  })
  state.worker = worker
  state.model = model
  state.tagRecords = tagRecords
  state.tagUpdatedAt = tagUpdatedAt
  state.pinyinReady = dashboardPopupSearchIndexCache.pinyinReady
  state.indexReady = false
  state.indexSize = 0
  state.error = ''
  state.initRequestId += 1
  worker.onmessage = handleDashboardSearchWorkerMessage
  worker.onerror = handleDashboardSearchWorkerError
  postDashboardSearchWorkerMessage({
    type: 'init',
    requestId: state.initRequestId,
    bookmarks: getDashboardPopupSearchBookmarks(model)
  })
  return worker
}

function requestDashboardWorkerSearch({
  searchKey,
  query,
  filters,
  limit
}: {
  searchKey: string
  query: string
  filters: DashboardFilters
  limit: number
}): void {
  const state = dashboardSearchWorkerState
  if (!state.worker) {
    return
  }

  const safeLimit = Math.max(0, Math.floor(Number(limit) || 0))
  if (!safeLimit) {
    return
  }

  state.limitByKey.set(searchKey, safeLimit)
  if (!state.indexReady) {
    state.pendingSearchKey = searchKey
    return
  }

  state.pendingSearchKey = searchKey
  state.requestId += 1
  postDashboardSearchWorkerMessage({
    type: 'query',
    requestId: state.requestId,
    searchKey,
    query,
    limit: safeLimit,
    offset: 0,
    filters: getDashboardSearchWorkerStructuralFilters(filters)
  })
}

function postDashboardSearchWorkerMessage(message: DashboardSearchWorkerRequest): void {
  dashboardSearchWorkerState.worker?.postMessage(message)
}

function getDashboardSearchWorkerStructuralFilters(filters: DashboardFilters): DashboardSearchWorkerStructuralFilters {
  return {
    folderId: String(filters.folderId || ''),
    domain: String(filters.domain || ''),
    month: String(filters.month || '')
  }
}

function handleDashboardSearchWorkerMessage(event: MessageEvent<DashboardSearchWorkerResponse>): void {
  const message = event.data
  const state = dashboardSearchWorkerState
  if (!message || typeof message !== 'object') {
    return
  }

  if (message.type === 'ready') {
    if (message.requestId !== state.initRequestId) {
      return
    }
    state.indexReady = true
    state.indexSize = message.indexSize
    invalidateDashboardVisibleItemCache()
    scheduleDashboardListRender()
    return
  }

  if (message.type === 'partial' || message.type === 'final') {
    if (message.requestId !== state.requestId) {
      return
    }

    state.resultCache.set(message.searchKey, message.ids)
    if (message.type === 'final' || message.complete) {
      state.pendingSearchKey = ''
    }
    invalidateDashboardVisibleItemCache()
    markDashboardVirtualFilterChange('append')
    scheduleDashboardListRender()
    return
  }

  if (message.type === 'cancelled') {
    if (message.requestId === state.requestId) {
      state.pendingSearchKey = ''
    }
    return
  }

  if (message.type === 'error' && message.requestId === state.requestId) {
    state.error = message.message
    state.pendingSearchKey = ''
  }
}

function handleDashboardSearchWorkerError(event: ErrorEvent): void {
  dashboardSearchWorkerState.error = event.message || 'Dashboard search worker failed.'
  dashboardSearchWorkerState.pendingSearchKey = ''
}

function resetDashboardSearchWorker(): void {
  const state = dashboardSearchWorkerState
  state.worker?.terminate()
  state.worker = null
  state.model = null
  state.tagRecords = null
  state.tagUpdatedAt = 0
  state.pinyinReady = false
  state.indexReady = false
  state.indexSize = 0
  state.pendingSearchKey = ''
  state.limitByKey.clear()
  state.resultCache.clear()
  state.error = ''
  dashboardSearchPrefetchPendingKey = ''
  dashboardSearchPrefetchIdleScheduled = false
  if (dashboardSearchPrefetchRetryTimer) {
    globalThis.clearTimeout(dashboardSearchPrefetchRetryTimer)
    dashboardSearchPrefetchRetryTimer = 0
  }
}

function getDashboardVisibleNaturalSearchPlan(query: string): NaturalSearchPlan | null {
  const normalizedQuery = normalizeDashboardSearchText(query)
  if (!normalizedQuery || !dashboardState.naturalSearchEnabled || queryLooksLikePinyin(normalizedQuery)) {
    return null
  }

  if (dashboardState.naturalSearchPlan?.rawQuery === String(query || '').trim()) {
    return dashboardState.naturalSearchPlan
  }

  const cachedEntry = dashboardNaturalSearchCache.get(getDashboardNaturalSearchCacheKey(normalizedQuery))
  if (cachedEntry) {
    dashboardState.naturalSearchPlan = cachedEntry.plan
    return cachedEntry.plan
  }

  return null
}

function getNaturalDashboardVisibleItems(
  model: DashboardModel,
  plan: NaturalSearchPlan,
  filters: DashboardFilters = {}
): DashboardItem[] {
  const normalizedQuery = normalizeDashboardSearchText(filters.query || plan.rawQuery)
  const cachedEntry = dashboardNaturalSearchCache.get(getDashboardNaturalSearchCacheKey(normalizedQuery))
  const rankedIds = cachedEntry && cachedEntry.plan === plan
    ? cachedEntry.results.map((result) => String(result.id))
    : []
  const parsedQueries = createDashboardNaturalParsedQueries(plan)
  const candidatesById = new Map<string, DashboardItem>()
  const candidateOrder = new Map<string, number>()

  for (const parsedQuery of parsedQueries) {
    const matches = filterDashboardItems(model.items, {
      ...filters,
      query: buildSearchTextQuery(parsedQuery),
      parsedQuery,
      textMatchMode: 'any'
    })
    for (const item of matches) {
      const id = String(item.id)
      if (!candidatesById.has(id)) {
        candidatesById.set(id, item)
        candidateOrder.set(id, candidateOrder.size)
      }
    }
  }

  const rankedItems: DashboardItem[] = []
  for (const id of rankedIds) {
    const item = candidatesById.get(id)
    if (!item) {
      continue
    }
    rankedItems.push(item)
    candidatesById.delete(id)
  }

  const fallbackItems = sortDashboardItems([...candidatesById.values()], filters.sortKey)
  const rankOffset = rankedItems.length
  const rankMap = new Map(rankedIds.map((id, index) => [id, index]))
  return [...rankedItems, ...fallbackItems].sort((left, right) => {
    const leftRank = rankMap.get(String(left.id))
    const rightRank = rankMap.get(String(right.id))
    const leftKnownRank = leftRank !== undefined
    const rightKnownRank = rightRank !== undefined
    if (leftKnownRank || rightKnownRank) {
      return (leftKnownRank ? leftRank : rankOffset + (candidateOrder.get(String(left.id)) || 0)) -
        (rightKnownRank ? rightRank : rankOffset + (candidateOrder.get(String(right.id)) || 0))
    }
    return 0
  })
}

function createDashboardNaturalParsedQueries(plan: NaturalSearchPlan) {
  const queries = [
    plan.rawQuery,
    plan.highlightQuery,
    ...plan.queries
  ].filter(Boolean)

  return queries.map((query) => {
    const parsed = parseSearchQuery(query)
    return {
      ...parsed,
      dateRange: plan.dateRange || parsed.dateRange,
      excludedTerms: [...new Set([...parsed.excludedTerms, ...plan.excludedTerms])]
    }
  })
}

function getDashboardTagRecord(bookmarkId: string): BookmarkTagRecord | null {
  const tagIndex = normalizeBookmarkTagIndex(aiNamingState.tagIndex)
  return tagIndex.records[String(bookmarkId)] || null
}

function renderDashboardSearchTools(): void {
  const parsed = parseSearchQuery(dashboardState.query)
  const chips = parsed.chips
  renderDashboardNaturalSearchToggle()

  dom.dashboardSearchChips?.classList.toggle('hidden', chips.length === 0)
  if (dom.dashboardSearchChips) {
    dom.dashboardSearchChips.innerHTML = chips
      .map((chip) => `<span class="dashboard-search-chip ${escapeAttr(chip.kind)}">${escapeHtml(chip.label)}</span>`)
      .join('')
  }

  renderDashboardSavedSearches()
}

function renderDashboardNaturalSearchToggle(): void {
  const button = dom.dashboardNaturalSearchToggle
  if (!button) {
    return
  }

  const active = dashboardState.naturalSearchEnabled
  const pending = dashboardState.naturalSearchPending
  const fallback = Boolean(active && dashboardState.naturalSearchError)
  button.classList.toggle('active', active)
  button.classList.toggle('pending', pending)
  button.classList.toggle('fallback', fallback)
  button.textContent = getDashboardNaturalSearchToggleText()
  button.setAttribute('aria-pressed', String(active))
  button.setAttribute('aria-label', active ? '关闭 Dashboard AI 语义搜索' : '开启 Dashboard AI 语义搜索')
  button.title = getDashboardNaturalSearchToggleTitle()
}

function renderDashboardSavedSearches(): void {
  const container = dom.dashboardSavedSearches
  if (!container) {
    return
  }

  const savedSearches = dashboardState.savedSearches
    ? getSavedSearchesForScope(dashboardState.savedSearches, 'dashboard')
    : []
  const normalizedQuery = normalizeDashboardSearchText(dashboardState.query)
  const canSaveCurrent = Boolean(normalizedQuery)
  const hasCurrentSaved = canSaveCurrent && savedSearches.some((item) => normalizeDashboardSearchText(item.query) === normalizedQuery)
  const show = canSaveCurrent || savedSearches.length > 0 || dashboardState.savedSearchesError

  container.classList.toggle('hidden', !show)
  if (!show) {
    container.innerHTML = ''
    return
  }

  const status = dashboardState.savedSearchesError
    ? `<span class="dashboard-saved-search-status error">${escapeHtml(dashboardState.savedSearchesError)}</span>`
    : !savedSearches.length
      ? '<span class="dashboard-saved-search-status">还没有保存搜索</span>'
      : ''
  const saveButton = canSaveCurrent
    ? `
      <button class="dashboard-saved-search-save" type="button" data-dashboard-saved-search-action="save-current" ${hasCurrentSaved ? 'disabled' : ''}>
        ${hasCurrentSaved ? '已保存' : '保存搜索'}
      </button>
    `
    : ''
  const items = savedSearches.slice(0, 6).map(renderDashboardSavedSearchChip).join('')

  container.innerHTML = `
    <div class="dashboard-saved-search-head">
      <span>保存搜索</span>
      ${saveButton}
    </div>
    ${status}
    ${items ? `<div class="dashboard-saved-search-list">${items}</div>` : ''}
  `
}

function renderDashboardSavedSearchChip(search: SavedSearch): string {
  const isActive = normalizeDashboardSearchText(search.query) === normalizeDashboardSearchText(dashboardState.query)
  return `
    <span class="dashboard-saved-search-chip ${isActive ? 'active' : ''}">
      <button
        class="dashboard-saved-search-apply"
        type="button"
        data-dashboard-saved-search-action="apply"
        data-dashboard-saved-search-id="${escapeAttr(search.id)}"
        title="${escapeAttr(search.query)}"
      >${escapeHtml(search.name || search.query)}</button>
      <button
        class="dashboard-saved-search-delete"
        type="button"
        data-dashboard-saved-search-action="delete"
        data-dashboard-saved-search-id="${escapeAttr(search.id)}"
        aria-label="删除保存搜索：${escapeAttr(search.name || search.query)}"
      >×</button>
    </span>
  `
}

async function hydrateDashboardSavedSearches(): Promise<void> {
  if (dashboardState.savedSearchesLoaded) {
    return
  }

  try {
    dashboardState.savedSearches = await loadSavedSearchIndex()
    dashboardState.savedSearchesLoaded = true
    dashboardState.savedSearchesError = ''
  } catch {
    dashboardState.savedSearchesLoaded = true
    dashboardState.savedSearchesError = '保存搜索读取失败'
  }
}

async function ensureDashboardSavedSearchIndex(): Promise<SavedSearchIndex> {
  if (dashboardState.savedSearches) {
    return dashboardState.savedSearches
  }

  dashboardState.savedSearches = await loadSavedSearchIndex()
  dashboardState.savedSearchesLoaded = true
  dashboardState.savedSearchesError = ''
  return dashboardState.savedSearches
}

async function handleDashboardSavedSearchAction(button: HTMLElement): Promise<void> {
  const action = button.getAttribute('data-dashboard-saved-search-action')
  const searchId = button.getAttribute('data-dashboard-saved-search-id')

  if (action === 'save-current') {
    await saveDashboardCurrentSearchQuery()
    return
  }

  if (action === 'apply') {
    const savedSearch = dashboardState.savedSearches
      ? getSavedSearchesForScope(dashboardState.savedSearches, 'dashboard').find((item) => item.id === searchId)
      : null
    if (savedSearch) {
      applyDashboardSearchQuery(savedSearch.query)
      setDashboardStatus(`已应用保存搜索：${savedSearch.name}`)
      dom.dashboardQuery?.focus()
    }
    return
  }

  if (action === 'delete') {
    await deleteDashboardSavedSearch(searchId)
  }
}

async function saveDashboardCurrentSearchQuery(): Promise<void> {
  const query = dashboardState.query.trim()
  if (!query) {
    setDashboardStatus('请输入查询后再保存。')
    dom.dashboardQuery?.focus()
    return
  }

  try {
    const index = await ensureDashboardSavedSearchIndex()
    dashboardState.savedSearches = await saveSearch(index, {
      name: createDashboardSavedSearchName(query),
      query,
      scope: 'both'
    })
    dashboardState.savedSearchesLoaded = true
    dashboardState.savedSearchesError = ''
    renderDashboardSearchTools()
    setDashboardStatus('已保存搜索，可在 popup、newtab 和 Dashboard 复用。')
  } catch (error) {
    dashboardState.savedSearchesError = error instanceof Error ? error.message : '保存搜索失败'
    renderDashboardSearchTools()
    setDashboardStatus('保存搜索失败，请稍后重试。')
  }
}

async function deleteDashboardSavedSearch(searchId: unknown): Promise<void> {
  try {
    const index = await ensureDashboardSavedSearchIndex()
    dashboardState.savedSearches = await deleteSavedSearch(index, String(searchId || ''))
    dashboardState.savedSearchesLoaded = true
    dashboardState.savedSearchesError = ''
    renderDashboardSearchTools()
    setDashboardStatus('已删除保存搜索。')
  } catch (error) {
    dashboardState.savedSearchesError = error instanceof Error ? error.message : '删除保存搜索失败'
    renderDashboardSearchTools()
    setDashboardStatus('删除保存搜索失败，请稍后重试。')
  }
}

function createDashboardSavedSearchName(query: string): string {
  const parsed = parseSearchQuery(query)
  const chipLabels = parsed.chips.map((chip) => chip.label.replace(/^[^：]+：/, '')).filter(Boolean)
  const terms = parsed.textTerms.join(' ')
  return truncateDashboardText([...chipLabels, terms].filter(Boolean).join(' · ') || query, 60) || '未命名搜索'
}

function applyDashboardSearchQuery(query: string): void {
  dashboardState.query = query
  if (dom.dashboardQuery) {
    dom.dashboardQuery.value = query
  }
  dashboardState.selectedIds.clear()
  dashboardState.expandedTagIds.clear()
  clearIdleDashboardTagEditorForFilterChange()
  ensureDashboardFullTextSearchMapForQuery()
  startDashboardNaturalSearch()
  invalidateDashboardVisibleItemCacheForSearchKey()
  markDashboardVirtualFilterChange('query')
  scheduleDashboardSectionRender()
}

async function toggleDashboardNaturalSearch(): Promise<void> {
  const enabled = !dashboardState.naturalSearchEnabled

  if (enabled) {
    await refreshDashboardNaturalSearchAiConfiguredState()
    if (!dashboardState.naturalSearchAiConfigured) {
      dashboardState.naturalSearchEnabled = false
      dashboardState.naturalSearchError = ''
      dashboardState.naturalSearchPlan = null
      dashboardState.naturalSearchPending = false
      abortDashboardNaturalSearchRequest()
      setDashboardStatus('请配置 AI 渠道。')
      openDashboardAiProviderSettings()
      renderDashboardSearchTools()
      window.setTimeout(() => dom.dashboardQuery?.focus(), 0)
      return
    }
  }

  dashboardState.naturalSearchEnabled = enabled
  dashboardState.naturalSearchError = ''
  dashboardState.naturalSearchPlan = null
  abortDashboardNaturalSearchRequest()
  invalidateDashboardVisibleItemCache()
  if (!dashboardState.naturalSearchEnabled) {
    dashboardNaturalSearchCache.clear()
    ensureDashboardFullTextSearchMapForQuery()
    markDashboardVirtualFilterChange('query')
    scheduleDashboardSectionRender()
    window.setTimeout(() => dom.dashboardQuery?.focus(), 0)
    return
  }

  ensureDashboardFullTextSearchMapForQuery()
  startDashboardNaturalSearch()
  markDashboardVirtualFilterChange('query')
  scheduleDashboardSectionRender()
  window.setTimeout(() => dom.dashboardQuery?.focus(), 0)
  await prepareDashboardNaturalSearchAi()
  if (!dashboardState.naturalSearchEnabled) {
    renderDashboardSearchTools()
    return
  }
  startDashboardNaturalSearch()
  markDashboardVirtualFilterChange('query')
  scheduleDashboardSectionRender()
}

async function prepareDashboardNaturalSearchAi(): Promise<void> {
  try {
    const naturalSearchAi = await loadDashboardNaturalSearchAiModule()
    const settings = await naturalSearchAi.loadNaturalSearchAiProviderSettings()
    if (!naturalSearchAi.hasConfiguredNaturalSearchAiProvider(settings)) {
      dashboardState.naturalSearchAiConfigured = false
      dashboardState.naturalSearchAiConfigChecked = true
      dashboardState.naturalSearchEnabled = false
      dashboardState.naturalSearchError = ''
      setDashboardStatus('请配置 AI 渠道。')
      openDashboardAiProviderSettings()
      return
    }

    dashboardState.naturalSearchAiConfigured = true
    dashboardState.naturalSearchAiConfigChecked = true
    naturalSearchAi.validateNaturalSearchAiProvider(settings)
    await naturalSearchAi.ensureNaturalSearchAiPermissions(settings, { interactive: true })
  } catch {
    dashboardState.naturalSearchError = 'AI 未就绪，请检查 AI 渠道配置或授权。'
  }
}

async function refreshDashboardNaturalSearchAiConfiguredState(): Promise<void> {
  try {
    const naturalSearchAi = await loadDashboardNaturalSearchAiModule()
    const settings = await naturalSearchAi.loadNaturalSearchAiProviderSettings()
    dashboardState.naturalSearchAiConfigured = naturalSearchAi.hasConfiguredNaturalSearchAiProvider(settings)
  } catch {
    dashboardState.naturalSearchAiConfigured = false
  } finally {
    dashboardState.naturalSearchAiConfigChecked = true
  }
}

function openDashboardAiProviderSettings(): void {
  window.location.hash = '#general:ai-provider'
}

function startDashboardNaturalSearch(): void {
  const query = String(dashboardState.query || '').trim()
  const normalizedQuery = normalizeDashboardSearchText(query)
  if (!dashboardState.naturalSearchEnabled || !normalizedQuery) {
    abortDashboardNaturalSearchRequest()
    dashboardState.naturalSearchPending = false
    dashboardState.naturalSearchError = ''
    dashboardState.naturalSearchPlan = null
    invalidateDashboardVisibleItemCache()
    return
  }

  const cacheKey = getDashboardNaturalSearchCacheKey(normalizedQuery)
  const cachedEntry = dashboardNaturalSearchCache.get(cacheKey)
  if (cachedEntry) {
    dashboardState.naturalSearchPlan = cachedEntry.plan
    dashboardState.naturalSearchPending = false
    dashboardState.naturalSearchError = ''
    invalidateDashboardVisibleItemCache()
    return
  }

  void resolveDashboardNaturalSearch(query, normalizedQuery, cacheKey)
}

async function resolveDashboardNaturalSearch(
  query: string,
  normalizedQuery: string,
  cacheKey: string
): Promise<void> {
  abortDashboardNaturalSearchRequest()
  const controller = new AbortController()
  dashboardState.naturalSearchAbortController = controller
  dashboardState.naturalSearchPending = true
  dashboardState.naturalSearchError = ''
  renderDashboardSearchTools()

  try {
    const naturalSearch = await loadDashboardNaturalSearchModule()
    if (!isCurrentDashboardNaturalSearchRequest(controller, normalizedQuery)) {
      return
    }

    const effectiveLocalPlan = naturalSearch.buildLocalNaturalSearchPlan(query)
    const naturalSearchAi = await loadDashboardNaturalSearchAiModule()
    const settings = await naturalSearchAi.loadNaturalSearchAiProviderSettings()
    if (!naturalSearchAi.hasConfiguredNaturalSearchAiProvider(settings)) {
      dashboardState.naturalSearchAiConfigured = false
      dashboardState.naturalSearchAiConfigChecked = true
      dashboardState.naturalSearchEnabled = false
      dashboardState.naturalSearchPending = false
      dashboardState.naturalSearchError = ''
      dashboardState.naturalSearchPlan = null
      setDashboardStatus('请配置 AI 渠道。')
      openDashboardAiProviderSettings()
      return
    }
    dashboardState.naturalSearchAiConfigured = true
    dashboardState.naturalSearchAiConfigChecked = true

    const plan = await naturalSearchAi.requestNaturalSearchAiPlan({
      query,
      localPlan: effectiveLocalPlan,
      settings,
      signal: controller.signal
    })
    dashboardState.naturalSearchError = ''

    const results = await searchDashboardNaturalPlan(plan)
    if (!isCurrentDashboardNaturalSearchRequest(controller, normalizedQuery)) {
      return
    }

    dashboardState.naturalSearchPlan = plan
    dashboardNaturalSearchCache.set(cacheKey, { plan, results })
    invalidateDashboardVisibleItemCache()
    markDashboardVirtualFilterChange('append')
    scheduleDashboardListRender()
  } catch (error) {
    if (!isCurrentDashboardNaturalSearchRequest(controller, normalizedQuery) || isDashboardNaturalSearchAbortError(error)) {
      return
    }

    const naturalSearchAi = await loadDashboardNaturalSearchAiModule()
    dashboardState.naturalSearchError = naturalSearchAi.normalizeNaturalSearchAiError(error)
    dashboardState.naturalSearchPlan = null
    invalidateDashboardVisibleItemCache()
    markDashboardVirtualFilterChange('append')
    scheduleDashboardListRender()
  } finally {
    if (dashboardState.naturalSearchAbortController === controller) {
      dashboardState.naturalSearchAbortController = null
    }
    if (normalizeDashboardSearchText(dashboardState.query) === normalizedQuery) {
      dashboardState.naturalSearchPending = false
      renderDashboardSearchTools()
    }
  }
}

async function searchDashboardNaturalPlan(plan: NaturalSearchPlan): Promise<PopupSearchResult[]> {
  const naturalSearch = await loadDashboardNaturalSearchModule()
  const model = getDashboardRenderData().model
  const popupBookmarks = getDashboardPopupSearchBookmarks(model)
  const bookmarks = naturalSearch.filterBookmarksByNaturalDateRange(popupBookmarks, plan)
  const resultSets: NaturalSearchResultSet[] = []
  const seenQueries = new Set<string>()

  for (const query of [plan.rawQuery, ...plan.queries]) {
    const normalizedQuery = normalizeDashboardSearchText(query)
    if (!normalizedQuery || seenQueries.has(normalizedQuery)) {
      continue
    }
    seenQueries.add(normalizedQuery)
    const results = searchBookmarksUnbounded(query, bookmarks)
    if (results.length) {
      resultSets.push({ query, results })
    }
  }

  return resultSets.length ? naturalSearch.mergeNaturalSearchResultSets(plan, resultSets) : []
}

function getDashboardPopupSearchBookmarks(model: DashboardModel): PopupSearchBookmark[] {
  return getDashboardPopupSearchBookmarksFromItems(model, model.items)
}

function getDashboardPopupSearchBookmarksFromItems(
  model: DashboardModel,
  items: DashboardItem[]
): PopupSearchBookmark[] {
  const fullIndex = getDashboardPopupSearchIndex(model)
  if (items === model.items) {
    return fullIndex
  }

  const bookmarkById = dashboardPopupSearchIndexCache.bookmarkById
  if (!bookmarkById) {
    return []
  }

  const popupBookmarks: PopupSearchBookmark[] = []
  for (const item of items) {
    const indexed = bookmarkById.get(String(item.id))
    if (indexed) {
      popupBookmarks.push(indexed)
    }
  }
  return popupBookmarks
}

function getDashboardPopupSearchIndex(model: DashboardModel): PopupSearchBookmark[] {
  const tagIndex = (aiNamingState.tagIndex as BookmarkTagIndex | null) || null
  const tagRecords = tagIndex?.records || EMPTY_DASHBOARD_TAG_RECORDS
  const tagUpdatedAt = Number(tagIndex?.updatedAt) || 0
  if (
    dashboardPopupSearchIndexCache.model === model &&
    dashboardPopupSearchIndexCache.tagRecords === tagRecords &&
    dashboardPopupSearchIndexCache.tagUpdatedAt === tagUpdatedAt &&
    dashboardPopupSearchIndexCache.bookmarks
  ) {
    return dashboardPopupSearchIndexCache.bookmarks
  }

  const popupBookmarks: PopupSearchBookmark[] = []
  const bookmarkById = new Map<string, PopupSearchBookmark>()
  for (const item of model.items) {
    const tagRecord = tagRecords[String(item.id)] || null
    const indexed = indexBookmarkForSearch(item, tagRecord)
    popupBookmarks.push(indexed)
    bookmarkById.set(String(item.id), indexed)
  }
  dashboardPopupSearchIndexCache.model = model
  dashboardPopupSearchIndexCache.tagRecords = tagRecords
  dashboardPopupSearchIndexCache.tagUpdatedAt = tagUpdatedAt
  dashboardPopupSearchIndexCache.bookmarks = popupBookmarks
  dashboardPopupSearchIndexCache.bookmarkById = bookmarkById
  dashboardPopupSearchIndexCache.pinyinReady = false
  dashboardPopupSearchIndexCache.pinyinPending = false
  dashboardPopupSearchIndexCache.pinyinRunId += 1
  dashboardPopupSearchIndexCache.pinyinPriorityKey = ''
  dashboardPopupSearchIndexCache.pinyinPriorityPending = false
  return popupBookmarks
}

function ensureDashboardPopupSearchIndexPinyin(): void {
  const cache = dashboardPopupSearchIndexCache
  if (cache.pinyinReady || cache.pinyinPending || !cache.bookmarks?.length) {
    return
  }

  const pendingTargets = collectDashboardPendingPinyinTargets(cache.bookmarks)
  if (!pendingTargets.length) {
    cache.pinyinReady = true
    resetDashboardSearchWorker()
    return
  }

  const runId = cache.pinyinRunId
  cache.pinyinPending = true
  window.setTimeout(() => {
    if (cache.pinyinRunId !== runId || !cache.bookmarks) {
      cache.pinyinPending = false
      return
    }

    void import('../../shared/search/pinyin.js')
      .then(({ enrichPinyinTokensCooperatively }) =>
        enrichPinyinTokensCooperatively(
          collectDashboardPendingPinyinTargets(cache.bookmarks || []),
          {
            isActive: () => cache.pinyinRunId === runId
          }
        )
      )
      .then((result) => {
        if (cache.pinyinRunId !== runId) {
          return
        }

        cache.pinyinPending = false
        if (result.aborted) {
          return
        }

        cache.pinyinReady = true
        resetDashboardSearchWorker()
        invalidateDashboardVisibleItemCacheForSearchKey()
        if (dashboardState.query.trim()) {
          markDashboardVirtualFilterChange('append')
          scheduleDashboardListRender()
        }
      })
      .catch(() => {
        if (cache.pinyinRunId !== runId) {
          return
        }
        cache.pinyinPending = false
      })
  }, 0)
}

function ensureDashboardPinyinForQuery(
  query: string,
  searchKey: string,
  bookmarks: PopupSearchBookmark[]
): void {
  const normalizedQuery = normalizeDashboardSearchText(query)
  const cache = dashboardPopupSearchIndexCache
  const pendingTargets = collectDashboardPendingPinyinTargets(bookmarks)
  if (
    cache.pinyinReady ||
    !queryLooksLikePinyin(normalizedQuery) ||
    !pendingTargets.length
  ) {
    return
  }

  const runId = cache.pinyinRunId
  const targets = pendingTargets.slice()
  cache.pinyinPriorityKey = searchKey
  cache.pinyinPriorityPending = true

  void import('../../shared/search/pinyin.js')
    .then(({ enrichPinyinTokensCooperatively }) =>
      enrichPinyinTokensCooperatively(targets, {
        isActive: () => cache.pinyinRunId === runId,
        batchSize: Math.min(250, Math.max(50, targets.length))
      })
    )
    .then((result) => {
      if (cache.pinyinRunId !== runId) {
        return
      }

      cache.pinyinPriorityPending = false
      if (result.aborted) {
        return
      }

      resetDashboardSearchWorker()
      invalidateDashboardVisibleItemCacheForSearchKey(searchKey)
      if (normalizeDashboardSearchText(dashboardState.query) === normalizedQuery) {
        markDashboardVirtualFilterChange('append')
        scheduleDashboardListRender()
      } else if (queryLooksLikePinyin(normalizeDashboardSearchText(dashboardState.query))) {
        invalidateDashboardVisibleItemCacheForSearchKey()
        scheduleDashboardListRender()
      }
    })
    .catch(() => {
      if (cache.pinyinRunId !== runId) {
        return
      }
      cache.pinyinPriorityPending = false
    })
}

function abortDashboardNaturalSearchRequest(): void {
  dashboardState.naturalSearchAbortController?.abort()
  dashboardState.naturalSearchAbortController = null
  dashboardState.naturalSearchPending = false
}

function isCurrentDashboardNaturalSearchRequest(controller: AbortController, normalizedQuery: string): boolean {
  return (
    dashboardState.naturalSearchAbortController === controller &&
    dashboardState.naturalSearchEnabled &&
    normalizeDashboardSearchText(dashboardState.query) === normalizedQuery
  )
}

function isDashboardNaturalSearchAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function getDashboardNaturalSearchCacheKey(normalizedQuery: string): string {
  return `${formatDashboardLocalDate(Date.now())}\u0000${normalizedQuery}`
}

function getDashboardNaturalSearchToggleText(): string {
  if (!dashboardState.naturalSearchEnabled) {
    return '语义'
  }

  if (dashboardState.naturalSearchPending) {
    return '思考中'
  }

  return 'AI'
}

function getDashboardNaturalSearchToggleTitle(): string {
  if (!dashboardState.naturalSearchEnabled) {
    return dashboardState.naturalSearchAiConfigured
      ? '开启 AI 语义搜索'
      : '需要先配置 AI 渠道'
  }

  if (dashboardState.naturalSearchPending) {
    return '正在用 AI 理解搜索意图，点击关闭'
  }

  if (dashboardState.naturalSearchError) {
    return `${dashboardState.naturalSearchError}；点击关闭`
  }

  if (dashboardState.naturalSearchPlan?.source === 'ai') {
    return 'AI 已改写查询；点击关闭语义搜索'
  }

  return '点击关闭 AI 语义搜索'
}

function normalizeDashboardSearchText(value: unknown): string {
  return normalizeText(value).trim()
}

function truncateDashboardText(value: unknown, limit = 60): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= limit) {
    return text
  }
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`
}

function formatDashboardLocalDate(value: unknown): string {
  const date = new Date(Number(value))
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function renderDashboardFolderBreadcrumbs(): void {
  if (!dom.dashboardFolderBreadcrumbs) {
    return
  }

  const selectedFolderId = getDashboardEffectiveFolderId()
  const selectedFolder = selectedFolderId
    ? availabilityState.folderMap.get(selectedFolderId)
    : null

  dom.dashboardFolderBreadcrumbs.classList.toggle('hidden', !selectedFolder)
  dom.dashboardFolderBreadcrumbs.innerHTML = selectedFolder
    ? buildDashboardFolderBreadcrumbMarkup(selectedFolder)
    : ''
}

function buildDashboardFolderBreadcrumbMarkup(folder: FolderRecord): string {
  const segments = buildBookmarkPathSegments(folder, availabilityState.folderMap)
  if (!segments.length) {
    return ''
  }

  return `
    <ol class="dashboard-folder-breadcrumb-list">
      ${segments.map((segment, index) => {
        const content = segment.current || !segment.id
          ? `
            <span
              class="dashboard-folder-breadcrumb-current"
              aria-current="page"
              title="${escapeAttr(segment.path)}"
            >${escapeHtml(segment.label)}</span>
          `
          : `
            <button
              class="dashboard-folder-breadcrumb-link"
              type="button"
              data-dashboard-folder-filter="${escapeAttr(segment.id)}"
              title="${escapeAttr(segment.path)}"
            >${escapeHtml(segment.label)}</button>
          `

        return `
          ${index === 0 ? '' : '<li class="dashboard-folder-breadcrumb-separator" aria-hidden="true">&gt;</li>'}
          <li>${content}</li>
        `
      }).join('')}
    </ol>
  `
}

function renderDashboardFolderSidebar(model: DashboardModel): void {
  if (!dom.dashboardFolderTree || !dom.dashboardFolderSidebarCount) {
    return
  }

  const selectedFolderId = getDashboardEffectiveFolderId()
  const folderBookmarkCounts = getCachedDashboardFolderBookmarkCounts(model)
  const folderMarkup = getCachedDashboardFolderSidebarMarkup(model, selectedFolderId, folderBookmarkCounts)
  const folderCountText = `${model.totalFolders} 个文件夹`

  if (dom.dashboardFolderSidebarCount.textContent !== folderCountText) {
    dom.dashboardFolderSidebarCount.textContent = folderCountText
  }
  if (dom.dashboardFolderTree.innerHTML !== folderMarkup) {
    dom.dashboardFolderTree.innerHTML = folderMarkup
  }
  restorePendingDashboardFolderFocus()
}

function getCachedDashboardFolderSidebarMarkup(
  model: DashboardModel,
  selectedFolderId: string,
  folderBookmarkCounts: Map<string, number>
): string {
  if (
    dashboardRenderCache.sidebarModel === model &&
    dashboardRenderCache.sidebarSelectedFolderId === selectedFolderId &&
    dashboardRenderCache.sidebarTotalFolders === model.totalFolders
  ) {
    return dashboardRenderCache.sidebarMarkup
  }

  const markup = model.folderTargets
    .map((folder) => {
      const folderRecord = availabilityState.folderMap.get(String(folder.id))
      const depth = Number(folderRecord?.depth) || getDashboardFolderPathDepth(folder.path)
      return buildDashboardFolderSidebarItem({
        id: folder.id,
        title: folder.title,
        path: formatFolderPath(folderRecord || folder, availabilityState.folderMap) || folder.path || folder.title,
        count: folderBookmarkCounts.get(String(folder.id)) || 0,
        depth: Math.max(0, depth - 1),
        active: selectedFolderId === String(folder.id)
      })
    })
    .join('')

  dashboardRenderCache.sidebarModel = model
  dashboardRenderCache.sidebarSelectedFolderId = selectedFolderId
  dashboardRenderCache.sidebarMarkup = markup
  dashboardRenderCache.sidebarTotalFolders = model.totalFolders
  return markup
}

function getCachedDashboardFolderBookmarkCounts(model: DashboardModel): Map<string, number> {
  if (dashboardRenderCache.folderCountsModel === model && dashboardRenderCache.folderBookmarkCounts) {
    return dashboardRenderCache.folderBookmarkCounts
  }
  const counts = buildDashboardFolderBookmarkCounts(model.items)
  dashboardRenderCache.folderCountsModel = model
  dashboardRenderCache.folderBookmarkCounts = counts
  return counts
}

function buildDashboardFolderSidebarItem({
  id,
  title,
  path,
  count,
  depth,
  active
}: {
  id: string
  title: string
  path: string
  count: number
  depth: number
  active: boolean
}): string {
  const clampedDepth = Math.min(Math.max(Number(depth) || 0, 0), 8)
  const countLabel = `${Number(count) || 0} 个书签`
  const countBadge = `${Number(count) || 0}`
  const titleText = String(title || '未命名文件夹').trim() || '未命名文件夹'
  const pathText = String(path || titleText).trim() || titleText
  const currentAttribute = active ? ' aria-current="page"' : ''
  const tabIndex = active ? 0 : -1

  return `
    <button
      class="dashboard-folder-tree-item ${active ? 'active' : ''}"
      type="button"
      role="option"
      data-dashboard-folder-filter="${escapeAttr(id)}"
      data-dashboard-no-drag
      aria-selected="${active ? 'true' : 'false'}"
      tabindex="${tabIndex}"
     ${currentAttribute}
      aria-label="${escapeAttr(`${pathText}，${countLabel}`)}"
      title="${escapeAttr(pathText)}"
      style="--folder-depth-offset: ${clampedDepth * 13}px;"
    >
      <span class="dashboard-folder-tree-branch" aria-hidden="true"></span>
      <span class="dashboard-folder-tree-label">${escapeHtml(titleText)}</span>
      <span class="dashboard-folder-tree-count" title="${escapeAttr(countLabel)}">${escapeHtml(countBadge)}</span>
    </button>
  `
}

function handleDashboardFolderListboxKeydown(event: KeyboardEvent, target: HTMLElement): boolean {
  const option = target.closest<HTMLElement>('[data-dashboard-folder-filter]')
  if (!option || !dom.dashboardFolderTree?.contains(option)) {
    return false
  }

  if (event.key !== 'ArrowDown' && event.key !== 'ArrowRight' &&
    event.key !== 'ArrowUp' && event.key !== 'ArrowLeft' &&
    event.key !== 'Home' && event.key !== 'End') {
    return false
  }

  const options = getDashboardFolderFilterOptions()
  if (!options.length) {
    return false
  }

  const currentIndex = Math.max(0, options.indexOf(option))
  let nextIndex = currentIndex
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
    nextIndex = Math.min(options.length - 1, currentIndex + 1)
  } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
    nextIndex = Math.max(0, currentIndex - 1)
  } else if (event.key === 'Home') {
    nextIndex = 0
  } else if (event.key === 'End') {
    nextIndex = options.length - 1
  }

  event.preventDefault()
  event.stopPropagation()
  focusAndApplyDashboardFolderOption(options[nextIndex], { restoreAfterRender: true })
  return true
}

function getDashboardFolderFilterOptions(): HTMLElement[] {
  return Array.from(
    dom.dashboardFolderTree?.querySelectorAll<HTMLElement>('[data-dashboard-folder-filter]') || []
  )
}

function focusAndApplyDashboardFolderOption(
  option: HTMLElement | undefined,
  { restoreAfterRender = false } = {}
): void {
  if (!option) {
    return
  }

  const folderId = String(option.getAttribute('data-dashboard-folder-filter') || '').trim()
  for (const item of getDashboardFolderFilterOptions()) {
    item.tabIndex = item === option ? 0 : -1
  }

  option.focus()
  if (restoreAfterRender) {
    pendingDashboardFolderFocusId = folderId
  }
  applyDashboardFolderFilter(folderId)
  if (restoreAfterRender) {
    schedulePendingDashboardFolderFocusRestore()
  }
}

function schedulePendingDashboardFolderFocusRestore(): void {
  window.requestAnimationFrame(() => {
    restorePendingDashboardFolderFocus()
  })
}

function restorePendingDashboardFolderFocus(): void {
  if (!pendingDashboardFolderFocusId || !dom.dashboardFolderTree) {
    return
  }

  const focusId = pendingDashboardFolderFocusId
  const option = dom.dashboardFolderTree.querySelector<HTMLElement>(
    `[data-dashboard-folder-filter="${CSS.escape(focusId)}"]`
  )
  if (!option) {
    return
  }

  for (const item of getDashboardFolderFilterOptions()) {
    item.tabIndex = item === option ? 0 : -1
  }
  pendingDashboardFolderFocusId = ''
  option.focus({ preventScroll: true })
}

function getDashboardFolderPathDepth(path: string): number {
  return String(path || '')
    .split(/\s*(?:\/|>|›|»|\\)\s*/g)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .length
}

function renderDashboardSelectionBar(visibleItems: DashboardItem[]): void {
  const selectedCount = getSelectedDashboardBookmarks().length
  const shouldHideSelection = selectedCount === 0
  const selectionVisibilityChanged = dom.dashboardSelectionGroup.classList.contains('hidden') !== shouldHideSelection
  const useCompositeMotion = shouldUseDashboardSelectionCompositeMotion()

  dom.dashboardPanel?.setAttribute(
    'data-dashboard-selection-motion',
    useCompositeMotion ? 'composite' : 'layout'
  )
  if (selectionVisibilityChanged) {
    transitionDashboardSelectionBarVisibility(shouldHideSelection, useCompositeMotion)
  } else {
    if (!useCompositeMotion) {
      finishDashboardSelectionCompositeMotion({ commitResize: false })
    }
    dom.dashboardSelectionGroup.classList.toggle('hidden', shouldHideSelection)
  }
  dom.dashboardSelectionCount.textContent = `${selectedCount} 条已选择`
  dom.dashboardSelectVisible.disabled = availabilityState.deleting || visibleItems.length === 0
  dom.dashboardClearSelection.disabled = availabilityState.deleting || selectedCount === 0
  dom.dashboardMoveSelection.disabled = availabilityState.deleting || selectedCount === 0
  dom.dashboardDeleteSelection.disabled = availabilityState.deleting || selectedCount === 0

  dom.dashboardPanel
    ?.querySelectorAll<HTMLButtonElement>('[data-dashboard-action="select-visible"]')
    .forEach((button) => {
      button.disabled = availabilityState.deleting || visibleItems.length === 0
    })
}

function shouldUseDashboardSelectionCompositeMotion(): boolean {
  return true
}

function transitionDashboardSelectionBarVisibility(
  shouldHideSelection: boolean,
  useCompositeMotion: boolean
): void {
  if (!useCompositeMotion) {
    finishDashboardSelectionCompositeMotion({ commitResize: false })
    dom.dashboardSelectionGroup.classList.toggle('hidden', shouldHideSelection)
    return
  }

  const motionTarget = dom.dashboardCardRegion
  const beforeTop = motionTarget?.getBoundingClientRect().top ?? 0
  beginDashboardSelectionCompositeMotion()
  dom.dashboardSelectionGroup.classList.toggle('hidden', shouldHideSelection)

  if (!motionTarget) {
    finishDashboardSelectionCompositeMotion()
    return
  }

  const afterTop = motionTarget.getBoundingClientRect().top
  animateDashboardSelectionCardRegionShift(motionTarget, beforeTop - afterTop)
}

function applyDashboardFolderFilter(folderId: unknown): void {
  const normalizedFolderId = String(folderId || '').trim()
  const selectedFolder = normalizedFolderId
    ? availabilityState.folderMap.get(normalizedFolderId)
    : null

  const nextFolderId = selectedFolder ? normalizedFolderId : getDashboardDefaultFolderId()
  if (getDashboardEffectiveFolderId() === nextFolderId) {
    return
  }

  dashboardState.folderId = nextFolderId
  dashboardState.selectedIds.clear()
  dashboardState.expandedTagIds.clear()
  clearIdleDashboardTagEditorForFilterChange()
  beginStableDashboardResultsUpdate()
  markDashboardVirtualFilterChange('folder')
  setDashboardStatus(selectedFolder
    ? `已筛选：${formatFolderPath(selectedFolder, availabilityState.folderMap) || selectedFolder.title}`
    : '已显示书签栏', '', { render: false })
  scheduleDashboardSectionRender()
}

function getDashboardEffectiveFolderId(): string {
  const selectedFolderId = String(dashboardState.folderId || '').trim()
  if (selectedFolderId && availabilityState.folderMap.has(selectedFolderId)) {
    return selectedFolderId
  }

  return getDashboardDefaultFolderId()
}

function getDashboardDefaultFolderId(): string {
  return availabilityState.folderMap.has(BOOKMARKS_BAR_ID) ? BOOKMARKS_BAR_ID : ''
}

function renderDashboardCards(items: DashboardItem[], renderVersion = beginDashboardCardsRender()): void {
  syncDashboardGridSurface()

  if (availabilityState.catalogLoading) {
    resetDashboardVirtualRenderCache({ clearItems: true })
    clearStableDashboardResultsUpdate()
    dom.dashboardResults.innerHTML = renderDashboardEmptyLoading('正在读取书签目录。')
    commitDashboardCardsRender(renderVersion)
    return
  }

  if (!items.length) {
    resetDashboardVirtualRenderCache({ clearItems: true })
    dom.dashboardResults.innerHTML = isDashboardWorkerSearchPending()
      ? renderDashboardEmptyLoading('正在搜索书签。')
      : dashboardState.query
        ? '<div class="detect-empty">当前搜索没有匹配的书签。</div>'
      : '<div class="detect-empty">没有可展示的书签。</div>'
    endStableDashboardResultsUpdate()
    commitDashboardCardsRender(renderVersion)
    return
  }

  ensureDashboardVirtualGrid()
  virtualState.items = items

  applyDashboardVirtualFilterReset(items)
  const metricsReady = updateDashboardVirtualMetrics()

  if (items.length < DASHBOARD_VIRTUAL_THRESHOLD) {
    virtualState.items = items
    const renderedIds = new Set(items.map((item) => String(item.id)))
    const stateKey = getDashboardVirtualRenderStateKey(items)
    const staticListKey = getDashboardStaticListRenderKey(items, stateKey)
    const canReuseStaticList =
      virtualState.renderedStartIndex === 0 &&
      virtualState.renderedEndIndex === items.length &&
      virtualState.renderedStaticListKey === staticListKey &&
      !dom.dashboardResults.classList.contains('is-virtualized')

    if (!canReuseStaticList) {
      resetDashboardVirtualRenderCache({ preserveItems: true })
      virtualState.items = items
      dom.dashboardResults.innerHTML = items.map((item) => buildDashboardCard(item)).join('')
      virtualState.renderedStartIndex = 0
      virtualState.renderedEndIndex = items.length
      virtualState.renderedStateKey = stateKey
      virtualState.renderedStaticListKey = staticListKey
    }
    virtualState.renderedItems = items

    if (isDashboardLargeVirtualSet(items)) {
      stopDashboardFaviconWarmup()
    } else {
      syncDashboardFaviconWarmup(items)
    }
    reconcileDashboardTransientUiWithRenderedItems(renderedIds)
    updateDashboardFloatingEditorPosition(renderedIds)
    endStableDashboardResultsUpdate()
    commitDashboardCardsRender(renderVersion)
    return
  }

  dom.dashboardResults.classList.add('is-virtualized')
  if (!metricsReady) {
    virtualState.pendingInitialMeasure = true
    scheduleDashboardVirtualMeasureRetry(renderVersion)
    return
  }

  virtualState.pendingInitialMeasure = false
  const scrollTop = virtualState.resetScrollOnNextRender ? 0 : dom.dashboardResults.scrollTop
  const virtualWindow = computeDashboardVirtualWindow({
    itemCount: items.length,
    contentWidth: virtualState.contentWidth,
    containerHeight: virtualState.containerHeight,
    scrollTop,
    cardHeight: virtualState.cardHeight,
    minCardWidth: virtualState.minCardWidth,
    fastScrolling: virtualState.isFastScrolling
  })
  const viewportWindow = computeDashboardVirtualWindow({
    itemCount: items.length,
    contentWidth: virtualState.contentWidth,
    containerHeight: virtualState.containerHeight,
    scrollTop,
    cardHeight: virtualState.cardHeight,
    minCardWidth: virtualState.minCardWidth,
    overscanRows: 0
  })

  if (dom.dashboardResults.scrollTop !== virtualWindow.scrollTop) {
    dom.dashboardResults.scrollTop = virtualWindow.scrollTop
  }
  virtualState.resetScrollOnNextRender = false
  virtualState.scrollTop = virtualWindow.scrollTop
  virtualState.columnCount = virtualWindow.columnCount
  virtualState.rowStride = virtualWindow.rowStride
  if (isDashboardLargeVirtualSet(items)) {
    stopDashboardFaviconWarmup()
  } else {
    scheduleDashboardFaviconWarmup(
      items,
      getDashboardFaviconWarmupStartIndex(viewportWindow),
      getDashboardFaviconWarmupEndIndex(viewportWindow, items.length)
    )
  }

  if (canReuseDashboardVirtualShell(items, virtualWindow, viewportWindow)) {
    syncDashboardVirtualRenderedShellGeometry(virtualWindow)
    reconcileDashboardVirtualTransientUiAfterScroll(items)
    endStableDashboardResultsUpdate()
    commitDashboardCardsRender(renderVersion)
    return
  }

  const renderedIds = commitDashboardVirtualWindow(items, virtualWindow)
  endStableDashboardResultsUpdate()
  updateDashboardFloatingEditorPosition(renderedIds)
  commitDashboardCardsRender(renderVersion)
}

function canReuseDashboardVirtualShell(
  items: DashboardItem[],
  virtualWindow: DashboardVirtualWindow,
  viewportWindow: DashboardVirtualWindow,
  {
    validateRenderKey = true,
    allowAnchoredGeometry = false
  }: {
    validateRenderKey?: boolean
    allowAnchoredGeometry?: boolean
  } = {}
): boolean {
  if (
    virtualState.renderedStartIndex < 0 ||
    virtualState.renderedEndIndex <= virtualState.renderedStartIndex ||
    virtualState.renderedColumnCount !== virtualWindow.columnCount ||
    (!allowAnchoredGeometry && virtualState.renderedTotalHeight !== virtualWindow.totalHeight)
  ) {
    return false
  }

  const viewportStartIndex = viewportWindow.startIndex
  const viewportEndIndex = viewportWindow.endIndex
  if (
    virtualState.renderedStartIndex > viewportStartIndex ||
    virtualState.renderedEndIndex < viewportEndIndex
  ) {
    return false
  }

  if (!validateRenderKey) {
    return true
  }

  const renderedItems = items.slice(virtualState.renderedStartIndex, virtualState.renderedEndIndex)
  const stateKey = getDashboardVirtualRenderStateKey(renderedItems)
  return virtualState.renderedStaticListKey === getDashboardStaticListRenderKey(renderedItems, stateKey)
}

function renderDashboardVirtualScrollFrame(): void {
  renderDashboardVirtualScrollWindow()
}

function renderDashboardVirtualScrollWindow(
  scrollTopOverride?: number,
  {
    syncContainerScroll = true
  }: {
    syncContainerScroll?: boolean
  } = {}
): void {
  const container = dom.dashboardResults
  const items = virtualState.items
  if (
    !container?.classList.contains('is-virtualized') ||
    !items.length ||
    virtualState.pendingInitialMeasure ||
    virtualState.contentWidth < DASHBOARD_VIRTUAL_MIN_READY_WIDTH ||
    virtualState.containerHeight < DASHBOARD_VIRTUAL_MIN_READY_HEIGHT
  ) {
    return
  }

  const scrollTop = scrollTopOverride == null ? container.scrollTop : scrollTopOverride
  const viewportWindow = computeDashboardVirtualWindow({
    itemCount: items.length,
    contentWidth: virtualState.contentWidth,
    containerHeight: virtualState.containerHeight,
    scrollTop,
    cardHeight: virtualState.cardHeight,
    minCardWidth: virtualState.minCardWidth,
    overscanRows: 0
  })

  const shouldRefreshScrollCards = getDashboardRenderedCardMode() === 'scroll' &&
    getDashboardVirtualCardRenderMode() === 'full'
  if (
    !shouldRefreshScrollCards &&
    canReuseDashboardVirtualShell(items, viewportWindow, viewportWindow, {
      validateRenderKey: false,
      allowAnchoredGeometry: true
    })
  ) {
    virtualState.scrollTop = viewportWindow.scrollTop
    virtualState.columnCount = viewportWindow.columnCount
    virtualState.rowStride = viewportWindow.rowStride
    scheduleDashboardFaviconWarmupForViewport(items, viewportWindow)
    return
  }

  const virtualWindow = computeDashboardVirtualWindow({
    itemCount: items.length,
    contentWidth: virtualState.contentWidth,
    containerHeight: virtualState.containerHeight,
    scrollTop,
    cardHeight: virtualState.cardHeight,
    minCardWidth: virtualState.minCardWidth,
    fastScrolling: virtualState.isFastScrolling
  })

  if (syncContainerScroll && container.scrollTop !== virtualWindow.scrollTop) {
    container.scrollTop = virtualWindow.scrollTop
  }
  virtualState.scrollTop = virtualWindow.scrollTop
  virtualState.columnCount = virtualWindow.columnCount
  virtualState.rowStride = virtualWindow.rowStride

  scheduleDashboardFaviconWarmupForViewport(items, viewportWindow)

  if (
    !shouldRefreshScrollCards &&
    canReuseDashboardVirtualShell(items, virtualWindow, viewportWindow, { validateRenderKey: false })
  ) {
    syncDashboardVirtualRenderedShellGeometry(virtualWindow)
    reconcileDashboardVirtualTransientUiAfterScroll(items)
    return
  }

  const renderedIds = commitDashboardVirtualWindow(items, virtualWindow, { preferNodePatch: true })
  updateDashboardFloatingEditorPosition(renderedIds)
}

function isDashboardLargeVirtualSet(items = virtualState.items): boolean {
  return items.length >= 500
}

function scheduleDashboardFaviconWarmupForViewport(
  items: DashboardItem[],
  viewportWindow: DashboardVirtualWindow
): void {
  if (isDashboardLargeVirtualSet(items)) {
    stopDashboardFaviconWarmup()
    return
  }

  scheduleDashboardFaviconWarmup(
    items,
    getDashboardFaviconWarmupStartIndex(viewportWindow),
    getDashboardFaviconWarmupEndIndex(viewportWindow, items.length)
  )
}

function commitDashboardVirtualWindow(
  items: DashboardItem[],
  virtualWindow: DashboardVirtualWindow,
  {
    preferNodePatch = false
  }: {
    preferNodePatch?: boolean
  } = {}
): Set<string> {
  const renderedItems = items.slice(virtualWindow.startIndex, virtualWindow.endIndex)
  const renderedIds = new Set(renderedItems.map((item) => String(item.id)))
  reconcileDashboardTransientUiWithRenderedItems(renderedIds)

  const stateKey = getDashboardVirtualRenderStateKey(renderedItems)
  const virtualWindowKey = getDashboardStaticListRenderKey(renderedItems, stateKey)
  const canReuseShell =
    virtualState.renderedStartIndex === virtualWindow.startIndex &&
    virtualState.renderedEndIndex === virtualWindow.endIndex &&
    virtualState.renderedColumnCount === virtualWindow.columnCount &&
    virtualState.renderedTotalHeight === virtualWindow.totalHeight &&
    virtualState.renderedOffsetY === virtualWindow.offsetY &&
    virtualState.renderedStaticListKey === virtualWindowKey

  if (!canReuseShell) {
    renderDashboardVirtualWindow({
      renderedItems,
      renderedIds,
      startIndex: virtualWindow.startIndex,
      endIndex: virtualWindow.endIndex,
      totalHeight: virtualWindow.totalHeight,
      offsetY: virtualWindow.offsetY,
      columnCount: virtualWindow.columnCount,
      preferNodePatch
    })
  } else {
    updateDashboardVirtualShellGeometry(virtualWindow)
  }
  virtualState.renderedItems = items
  virtualState.renderedStartIndex = virtualWindow.startIndex
  virtualState.renderedEndIndex = virtualWindow.endIndex
  virtualState.renderedColumnCount = virtualWindow.columnCount
  virtualState.renderedTotalHeight = virtualWindow.totalHeight
  virtualState.renderedOffsetY = virtualWindow.offsetY
  virtualState.renderedStateKey = stateKey
  virtualState.renderedStaticListKey = virtualWindowKey
  return renderedIds
}

function syncDashboardVirtualRenderedShellGeometry(virtualWindow: DashboardVirtualWindow): void {
  const anchoredOffsetY = virtualState.renderedOffsetY >= 0
    ? virtualState.renderedOffsetY
    : virtualWindow.offsetY
  const anchoredColumnCount = virtualState.renderedColumnCount || virtualWindow.columnCount
  updateDashboardVirtualShellGeometry({
    ...virtualWindow,
    columnCount: anchoredColumnCount,
    offsetY: anchoredOffsetY
  }, { updateRenderedOffset: false })
}

function updateDashboardVirtualShellGeometry(
  virtualWindow: DashboardVirtualWindow,
  {
    updateRenderedOffset = true
  }: {
    updateRenderedOffset?: boolean
  } = {}
): void {
  const spacer = dom.dashboardResults?.querySelector<HTMLElement>('.dashboard-virtual-spacer')
  const windowElement = spacer?.querySelector<HTMLElement>('.dashboard-virtual-window') ||
    dom.dashboardResults?.querySelector<HTMLElement>('.dashboard-virtual-window') ||
    null
  if (spacer) {
    spacer.style.height = `${Math.ceil(virtualWindow.totalHeight)}px`
  }
  if (windowElement) {
    windowElement.style.removeProperty('top')
    windowElement.style.transform = `translate3d(0, ${Math.round(virtualWindow.offsetY)}px, 0)`
    windowElement.style.gridTemplateColumns = `repeat(${virtualWindow.columnCount}, minmax(0, 1fr))`
  }
  virtualState.renderedTotalHeight = virtualWindow.totalHeight
  if (updateRenderedOffset) {
    virtualState.renderedOffsetY = virtualWindow.offsetY
  }
}

function reconcileDashboardVirtualTransientUiAfterScroll(items: DashboardItem[]): void {
  if (!dashboardState.expandedTagIds.size && !dashboardState.tagEditorBookmarkId) {
    return
  }

  const stableRenderedItems = items.slice(virtualState.renderedStartIndex, virtualState.renderedEndIndex)
  const stableRenderedIds = new Set(stableRenderedItems.map((item) => String(item.id)))
  reconcileDashboardTransientUiWithRenderedItems(stableRenderedIds)
  updateDashboardFloatingEditorPosition(stableRenderedIds)
}

function getDashboardStaticListRenderKey(items: DashboardItem[], stateKey: string): string {
  if (stateKey.startsWith('scroll\u0001')) {
    return [
      stateKey,
      items.length,
      items[0]?.id || '',
      items[items.length - 1]?.id || ''
    ].join('\u0001')
  }

  return [
    stateKey,
    items.length,
    ...items.map(getDashboardCardRenderKey)
  ].join('\u0001')
}

function getDashboardCardRenderKey(item: DashboardItem): string {
  return [
    getDashboardVirtualCardRenderMode(),
    item.id,
    item.title,
    item.url,
    item.parentId,
    item.path,
    item.hasManualTags ? 'manual' : 'auto',
    item.aiTags.length,
    ...item.tags
  ].map((value) => String(value || '')).join('\u0002')
}

function getDashboardVirtualCardRenderMode(): 'full' | 'scroll' {
  return 'full'
}

function getDashboardRenderedCardMode(): 'full' | 'scroll' {
  return virtualState.renderedStateKey.startsWith('scroll\u0001') ? 'scroll' : 'full'
}

function isDashboardScrollActive(): boolean {
  return virtualState.isFastScrolling || Boolean(virtualState.scrollIdleTimer)
}

function getDashboardFaviconWarmupStartIndex(window: DashboardVirtualWindow): number {
  const startRow = Math.max(0, window.startRow - DASHBOARD_FAVICON_WARMUP_OVERSCAN_ROWS)
  return startRow * Math.max(1, window.columnCount)
}

function getDashboardFaviconWarmupEndIndex(window: DashboardVirtualWindow, itemCount: number): number {
  const endRow = Math.max(window.endRow, window.startRow + 1) + DASHBOARD_FAVICON_WARMUP_OVERSCAN_ROWS
  return Math.min(Math.max(0, itemCount), endRow * Math.max(1, window.columnCount))
}

function renderDashboardVirtualWindow({
  renderedItems,
  renderedIds,
  startIndex,
  endIndex,
  totalHeight,
  offsetY,
  columnCount,
  preferNodePatch = false
}: {
  renderedItems: DashboardItem[]
  renderedIds: Set<string>
  startIndex: number
  endIndex: number
  totalHeight: number
  offsetY: number
  columnCount: number
  preferNodePatch?: boolean
}): void {
  const { spacer, windowElement } = ensureDashboardVirtualWindowElements()
  spacer.style.height = `${Math.ceil(totalHeight)}px`
  windowElement.style.removeProperty('top')
  windowElement.style.transform = `translate3d(0, ${Math.round(offsetY)}px, 0)`
  windowElement.style.gridTemplateColumns = `repeat(${columnCount}, minmax(0, 1fr))`

  if (
    preferNodePatch &&
    patchDashboardVirtualWindowNodes({
      windowElement,
      renderedItems,
      startIndex,
      endIndex,
      columnCount
    })
  ) {
    pruneDashboardVirtualCardNodePool(renderedIds)
    return
  }

  const fragment = document.createDocumentFragment()
  for (const item of renderedItems) {
    fragment.append(getDashboardVirtualCardNode(item))
  }
  windowElement.replaceChildren(fragment)
  pruneDashboardVirtualCardNodePool(renderedIds)
}

function patchDashboardVirtualWindowNodes({
  windowElement,
  renderedItems,
  startIndex,
  endIndex,
  columnCount
}: {
  windowElement: HTMLElement
  renderedItems: DashboardItem[]
  startIndex: number
  endIndex: number
  columnCount: number
}): boolean {
  const previousStartIndex = virtualState.renderedStartIndex
  const previousEndIndex = virtualState.renderedEndIndex
  const previousRenderMode = getDashboardRenderedCardMode()
  const nextRenderMode = getDashboardVirtualCardRenderMode()
  if (
    virtualState.renderedItems !== virtualState.items ||
    virtualState.renderedColumnCount !== columnCount ||
    (previousRenderMode === 'scroll' && nextRenderMode === 'full') ||
    previousStartIndex < 0 ||
    previousEndIndex <= previousStartIndex ||
    startIndex >= previousEndIndex ||
    endIndex <= previousStartIndex
  ) {
    return false
  }

  const previousCount = previousEndIndex - previousStartIndex
  if (windowElement.childElementCount !== previousCount) {
    return false
  }

  if (startIndex > previousStartIndex) {
    removeDashboardVirtualWindowEdgeNodes(windowElement, startIndex - previousStartIndex, 'start')
  } else if (startIndex < previousStartIndex) {
    prependDashboardVirtualWindowNodes(windowElement, renderedItems, startIndex, previousStartIndex)
  }

  if (endIndex < previousEndIndex) {
    removeDashboardVirtualWindowEdgeNodes(windowElement, previousEndIndex - endIndex, 'end')
  } else if (endIndex > previousEndIndex) {
    appendDashboardVirtualWindowNodes(windowElement, renderedItems, startIndex, previousEndIndex, endIndex)
  }

  return windowElement.childElementCount === endIndex - startIndex
}

function prependDashboardVirtualWindowNodes(
  windowElement: HTMLElement,
  renderedItems: DashboardItem[],
  startIndex: number,
  previousStartIndex: number
): void {
  const fragment = document.createDocumentFragment()
  for (let index = startIndex; index < previousStartIndex; index += 1) {
    const item = renderedItems[index - startIndex]
    if (item) {
      fragment.append(getDashboardVirtualCardNode(item))
    }
  }
  windowElement.prepend(fragment)
}

function appendDashboardVirtualWindowNodes(
  windowElement: HTMLElement,
  renderedItems: DashboardItem[],
  startIndex: number,
  previousEndIndex: number,
  endIndex: number
): void {
  const fragment = document.createDocumentFragment()
  for (let index = previousEndIndex; index < endIndex; index += 1) {
    const item = renderedItems[index - startIndex]
    if (item) {
      fragment.append(getDashboardVirtualCardNode(item))
    }
  }
  windowElement.append(fragment)
}

function removeDashboardVirtualWindowEdgeNodes(
  windowElement: HTMLElement,
  count: number,
  edge: 'start' | 'end'
): void {
  for (let index = 0; index < count; index += 1) {
    const child = edge === 'start'
      ? windowElement.firstElementChild
      : windowElement.lastElementChild
    if (!child) {
      return
    }
    child.remove()
  }
}

function ensureDashboardVirtualWindowElements(): {
  spacer: HTMLElement
  windowElement: HTMLElement
} {
  let spacer = dom.dashboardResults.querySelector<HTMLElement>('.dashboard-virtual-spacer')
  let windowElement = spacer?.querySelector<HTMLElement>('.dashboard-virtual-window') || null
  if (spacer && windowElement) {
    return { spacer, windowElement }
  }

  spacer = document.createElement('div')
  spacer.className = 'dashboard-virtual-spacer'
  windowElement = document.createElement('div')
  windowElement.className = 'dashboard-virtual-window'
  spacer.append(windowElement)
  dom.dashboardResults.replaceChildren(spacer)
  return { spacer, windowElement }
}

function getDashboardVirtualCardNode(item: DashboardItem): HTMLElement {
  const bookmarkId = String(item.id)
  const renderKey = getDashboardCardRenderKey(item)
  const pooled = dashboardVirtualCardNodePool.get(bookmarkId)
  dashboardVirtualCardNodePoolTick += 1
  if (pooled && pooled.renderKey === renderKey) {
    pooled.lastUsed = dashboardVirtualCardNodePoolTick
    return pooled.element
  }

  const element = createDashboardCardElement(item)
  dashboardVirtualCardNodePool.set(bookmarkId, {
    element,
    renderKey,
    lastUsed: dashboardVirtualCardNodePoolTick
  })
  return element
}

function createDashboardCardElement(item: DashboardItem): HTMLElement {
  const template = document.createElement('template')
  template.innerHTML = buildDashboardCard(item).trim()
  const element = template.content.firstElementChild
  if (!(element instanceof HTMLElement)) {
    throw new Error('Dashboard card markup did not produce an element.')
  }
  return element
}

function pruneDashboardVirtualCardNodePool(renderedIds: Set<string>): void {
  if (dashboardVirtualCardNodePool.size <= DASHBOARD_VIRTUAL_CARD_NODE_POOL_LIMIT) {
    return
  }

  const staleEntries = [...dashboardVirtualCardNodePool.entries()]
    .filter(([bookmarkId]) => !renderedIds.has(bookmarkId))
    .sort((left, right) => left[1].lastUsed - right[1].lastUsed)
  const removeCount = Math.max(0, dashboardVirtualCardNodePool.size - DASHBOARD_VIRTUAL_CARD_NODE_POOL_LIMIT)
  for (const [bookmarkId] of staleEntries.slice(0, removeCount)) {
    dashboardVirtualCardNodePool.delete(bookmarkId)
  }
}

function patchDashboardCardById(bookmarkId: string): boolean {
  const safeBookmarkId = String(bookmarkId || '').trim()
  if (!safeBookmarkId) {
    return true
  }

  const item = virtualState.items.find((entry) => String(entry.id) === safeBookmarkId)
  const card = findDashboardCardElement(safeBookmarkId)
  if (!item || !card) {
    return false
  }

  const nextCard = createDashboardCardElement(item)

  card.replaceWith(nextCard)
  if (dom.dashboardResults?.classList.contains('is-virtualized')) {
    dashboardVirtualCardNodePoolTick += 1
    dashboardVirtualCardNodePool.set(safeBookmarkId, {
      element: nextCard,
      renderKey: getDashboardCardRenderKey(item),
      lastUsed: dashboardVirtualCardNodePoolTick
    })
  }
  scheduleDashboardFaviconLoadSync()
  const renderedIds = getDashboardRenderedIds()
  reconcileDashboardTransientUiWithRenderedItems(renderedIds)
  updateDashboardFloatingEditorPosition(renderedIds)
  return true
}

function patchDashboardCardsById(bookmarkIds: Set<string>): boolean {
  let patched = true
  for (const bookmarkId of bookmarkIds) {
    patched = patchDashboardCardById(bookmarkId) && patched
  }
  return patched
}

function getDashboardRenderedItemById(bookmarkId: string): DashboardItem | null {
  const safeBookmarkId = String(bookmarkId || '').trim()
  if (!safeBookmarkId) {
    return null
  }

  return virtualState.items.find((entry) => String(entry.id) === safeBookmarkId) ||
    getDashboardRenderData().model.items.find((entry) => String(entry.id) === safeBookmarkId) ||
    null
}

function syncDashboardTagPopoverCard(bookmarkId: string): boolean {
  const safeBookmarkId = String(bookmarkId || '').trim()
  const item = getDashboardRenderedItemById(safeBookmarkId)
  const card = findDashboardCardElement(safeBookmarkId)
  if (!safeBookmarkId || !item || !card) {
    return false
  }

  const expanded = dashboardState.expandedTagIds.has(safeBookmarkId)
  card.classList.toggle('tags-expanded', expanded)
  card
    .querySelector<HTMLElement>('[data-dashboard-toggle-tags]')
    ?.setAttribute('aria-expanded', expanded ? 'true' : 'false')

  const popover = card.querySelector<HTMLElement>('.dashboard-tag-popover')
  if (!expanded || !item.tags.length) {
    if (popover) {
      cancelExitMotion(popover, 'is-closing')
      popover.remove()
    }
    return true
  }

  if (popover) {
    cancelExitMotion(popover, 'is-closing')
    return true
  }

  const template = document.createElement('template')
  template.innerHTML = renderDashboardTagPopoverMarkup(item).trim()
  const nextPopover = template.content.firstElementChild
  if (!(nextPopover instanceof HTMLElement)) {
    return false
  }

  card.append(nextPopover)
  return true
}

function syncDashboardTagPopoverCards(bookmarkIds: Set<string>): boolean {
  let synced = true
  for (const bookmarkId of bookmarkIds) {
    synced = syncDashboardTagPopoverCard(bookmarkId) && synced
  }
  return synced
}

function getDashboardRenderedIds(): Set<string> {
  const cards = dom.dashboardResults?.querySelectorAll<HTMLElement>('[data-dashboard-card]') || []
  return new Set([...cards].map((card) => String(card.getAttribute('data-dashboard-bookmark-id') || '')).filter(Boolean))
}

function resetDashboardVirtualRenderCache({
  clearItems = false,
  preserveItems = false
}: {
  clearItems?: boolean
  preserveItems?: boolean
} = {}): void {
  if (clearItems) {
    virtualState.items = []
    virtualState.filterKey = ''
    virtualState.scrollResetKey = ''
    virtualState.filterChangeReason = 'filter'
    clearDashboardVirtualCardNodePool()
  } else if (!preserveItems) {
    virtualState.items = []
    clearDashboardVirtualCardNodePool()
  }
  virtualState.renderedItems = null
  virtualState.renderedStartIndex = -1
  virtualState.renderedEndIndex = -1
  virtualState.renderedColumnCount = 0
  virtualState.renderedTotalHeight = -1
  virtualState.renderedOffsetY = -1
  virtualState.renderedStateKey = ''
  virtualState.renderedStaticListKey = ''
  virtualState.pendingInitialMeasure = false
  virtualState.isFastScrolling = false
  virtualState.lastScrollTop = 0
  virtualState.lastScrollAt = 0
  if (virtualState.scrollIdleTimer) {
    window.clearTimeout(virtualState.scrollIdleTimer)
    virtualState.scrollIdleTimer = 0
  }
  if (virtualState.scrollSettleTimer) {
    window.clearTimeout(virtualState.scrollSettleTimer)
    virtualState.scrollSettleTimer = 0
  }
  if (virtualState.measureRetryFrame) {
    window.cancelAnimationFrame(virtualState.measureRetryFrame)
    virtualState.measureRetryFrame = 0
  }
  dom.dashboardResults?.classList.remove('is-virtualized')
}

function clearDashboardVirtualCardNodePool(): void {
  dashboardVirtualCardNodePool.clear()
  dashboardVirtualCardNodePoolTick = 0
}

function applyDashboardVirtualFilterReset(items: DashboardItem[]): void {
  const filterKey = getDashboardVirtualFilterKey(items)
  if (virtualState.filterKey === filterKey) {
    return
  }

  virtualState.filterKey = filterKey
  if (shouldResetDashboardVirtualScrollForFilterChange({
    previousKey: virtualState.scrollResetKey,
    nextKey: filterKey,
    reason: virtualState.filterChangeReason
  })) {
    virtualState.scrollResetKey = filterKey
    resetDashboardVirtualScroll()
    virtualState.filterChangeReason = 'filter'
    return
  }

  virtualState.scrollResetKey = filterKey
  virtualState.filterChangeReason = 'filter'
  resetDashboardVirtualRenderCache({ preserveItems: true })
}

function getDashboardVirtualFilterKey(items: DashboardItem[]): string {
  return [
    dashboardState.query,
    getDashboardEffectiveFolderId(),
    dashboardState.domain,
    dashboardState.month,
    dashboardState.sortKey,
    items.length,
    items[0]?.id || '',
    items[items.length - 1]?.id || ''
  ].map((value) => String(value || '')).join('\u0001')
}

function getDashboardVirtualScrollResetKey(): string {
  return [
    dashboardState.query,
    dashboardState.domain,
    dashboardState.month,
    dashboardState.sortKey
  ].map((value) => String(value || '')).join('\u0001')
}

function markDashboardVirtualFilterChange(reason: DashboardVirtualFilterChangeReason): void {
  virtualState.filterChangeReason = reason
  if (reason !== 'folder') {
    virtualState.scrollResetKey = ''
    return
  }

  virtualState.scrollResetKey = getDashboardVirtualScrollResetKey()
}

function getDashboardVirtualRenderStateKey(renderedItems: DashboardItem[]): string {
  if (getDashboardVirtualCardRenderMode() === 'scroll') {
    return [
      'scroll',
      availabilityState.deleting ? 'deleting' : 'idle',
      renderedItems.length,
      renderedItems[0]?.id || '',
      renderedItems[renderedItems.length - 1]?.id || ''
    ].join('\u0001')
  }

  const itemState = renderedItems.map((item) => {
    const id = String(item.id)
    return [
      id,
      dashboardState.copyFeedbackId === id ? '1' : '0',
      dashboardState.speedDialPinnedIds.has(id) ? '1' : '0'
    ].join(':')
  }).join('|')

  return [
    getDashboardVirtualCardRenderMode(),
    availabilityState.deleting ? 'deleting' : 'idle',
    itemState
  ].join('\u0001')
}

function ensureDashboardVirtualGrid(): void {
  const container = dom.dashboardResults
  if (!container || virtualState.observedElement === container) {
    return
  }

  virtualState.observedElement?.removeEventListener('scroll', handleDashboardVirtualScroll)
  virtualState.resizeObserver?.disconnect()
  if (virtualState.frame) {
    window.cancelAnimationFrame(virtualState.frame)
    virtualState.frame = 0
  }
  if (virtualState.scrollIdleTimer) {
    window.clearTimeout(virtualState.scrollIdleTimer)
    virtualState.scrollIdleTimer = 0
  }
  if (virtualState.measureRetryFrame) {
    window.cancelAnimationFrame(virtualState.measureRetryFrame)
    virtualState.measureRetryFrame = 0
  }
  if (dashboardVirtualResizeFrame) {
    window.cancelAnimationFrame(dashboardVirtualResizeFrame)
    dashboardVirtualResizeFrame = 0
  }
  virtualState.observedElement = container
  virtualState.lastResizeWidth = 0
  virtualState.lastResizeHeight = 0
  virtualState.lastResizeColumnCount = 0
  virtualState.lastScrollTop = container.scrollTop
  virtualState.lastScrollAt = 0
  virtualState.isFastScrolling = false

  container.addEventListener('scroll', handleDashboardVirtualScroll, { passive: true })
  if (typeof ResizeObserver !== 'undefined') {
    virtualState.resizeObserver = new ResizeObserver(handleDashboardVirtualResize)
    virtualState.resizeObserver.observe(container)
  }
}

function handleDashboardVirtualResize(): void {
  if (dashboardSelectionCompositeMotionActive) {
    dashboardVirtualResizeDeferredForSelection = true
    return
  }

  const metrics = getDashboardVirtualMetricsSnapshot(
    dom.dashboardResults,
    virtualState.contentWidth,
    virtualState.containerHeight,
    DASHBOARD_CARD_MIN_WIDTH
  )
  if (!isDashboardVirtualMetricsReady(metrics) && virtualState.items.length >= DASHBOARD_VIRTUAL_THRESHOLD) {
    virtualState.pendingInitialMeasure = true
    scheduleDashboardVirtualMeasureRetry()
    return
  }

  if (!hasDashboardVirtualMetricsChanged(metrics) && !virtualState.pendingInitialMeasure) {
    return
  }

  scheduleDashboardVirtualResize()
}

function scheduleDashboardVirtualResize({
  showMask = true
}: {
  showMask?: boolean
} = {}): void {
  if (dashboardVirtualResizeFrame) {
    return
  }

  dashboardVirtualResizeFrame = window.requestAnimationFrame(() => {
    dashboardVirtualResizeFrame = 0
    if (dashboardSelectionCompositeMotionActive) {
      dashboardVirtualResizeDeferredForSelection = true
      return
    }
    commitDashboardVirtualResize({ showMask })
  })
}

function commitDashboardVirtualResize({
  showMask = true,
  preserveRenderedWindow = false
}: {
  showMask?: boolean
  preserveRenderedWindow?: boolean
} = {}): void {
  if (virtualState.frame) {
    window.cancelAnimationFrame(virtualState.frame)
    virtualState.frame = 0
  }
  const metrics = getDashboardVirtualMetricsSnapshot(
    dom.dashboardResults,
    virtualState.contentWidth,
    virtualState.containerHeight,
    DASHBOARD_CARD_MIN_WIDTH
  )
  if (!isDashboardVirtualMetricsReady(metrics) && virtualState.items.length >= DASHBOARD_VIRTUAL_THRESHOLD) {
    virtualState.pendingInitialMeasure = true
    scheduleDashboardVirtualMeasureRetry()
    return
  }
  if (!hasDashboardVirtualMetricsChanged(metrics) && !virtualState.pendingInitialMeasure && !preserveRenderedWindow) {
    clearStableDashboardResultsUpdate()
    return
  }
  if (showMask) {
    beginStableDashboardResultsUpdate()
  }
  if (preserveRenderedWindow) {
    updateDashboardVirtualMetrics()
    return
  }
  resetDashboardVirtualRenderCache({ preserveItems: true })
  if (virtualState.items.length) {
    renderDashboardCards(virtualState.items)
  }
}

function beginDashboardSelectionCompositeMotion(): void {
  dashboardSelectionCompositeMotionActive = true
  dashboardVirtualResizeDeferredForSelection = false
  dom.dashboardPanel?.classList.add('is-selection-motion-active')
  if (dashboardSelectionMotionFrame) {
    window.cancelAnimationFrame(dashboardSelectionMotionFrame)
    dashboardSelectionMotionFrame = 0
  }
  if (dashboardSelectionMotionTimer) {
    window.clearTimeout(dashboardSelectionMotionTimer)
    dashboardSelectionMotionTimer = 0
  }
}

function animateDashboardSelectionCardRegionShift(target: HTMLElement, deltaY: number): void {
  const shift = Number.isFinite(deltaY) ? Math.round(deltaY) : 0
  target.style.removeProperty('--dashboard-selection-motion-shift')

  if (!shift) {
    dashboardSelectionMotionTimer = window.setTimeout(() => {
      finishDashboardSelectionCompositeMotion()
    }, DASHBOARD_SELECTION_MOTION_MS)
    return
  }

  target.style.setProperty('--dashboard-selection-motion-shift', `${shift}px`)
  target.classList.add('is-selection-motion-shifting')
  dashboardSelectionMotionFrame = window.requestAnimationFrame(() => {
    dashboardSelectionMotionFrame = 0
    target.classList.add('is-selection-motion-settling')
    target.style.setProperty('--dashboard-selection-motion-shift', '0px')
  })
  dashboardSelectionMotionTimer = window.setTimeout(() => {
    target.classList.remove('is-selection-motion-shifting', 'is-selection-motion-settling')
    target.style.removeProperty('--dashboard-selection-motion-shift')
    finishDashboardSelectionCompositeMotion()
  }, DASHBOARD_SELECTION_MOTION_MS + 60)
}

function finishDashboardSelectionCompositeMotion({
  commitResize = true
}: {
  commitResize?: boolean
} = {}): void {
  if (dashboardSelectionMotionFrame) {
    window.cancelAnimationFrame(dashboardSelectionMotionFrame)
    dashboardSelectionMotionFrame = 0
  }
  if (dashboardSelectionMotionTimer) {
    window.clearTimeout(dashboardSelectionMotionTimer)
    dashboardSelectionMotionTimer = 0
  }

  dom.dashboardCardRegion?.classList.remove('is-selection-motion-shifting', 'is-selection-motion-settling')
  dom.dashboardCardRegion?.style.removeProperty('--dashboard-selection-motion-shift')
  dom.dashboardPanel?.classList.remove('is-selection-motion-active')

  const shouldCommitResize = commitResize && dashboardVirtualResizeDeferredForSelection
  dashboardSelectionCompositeMotionActive = false
  dashboardVirtualResizeDeferredForSelection = false

  if (shouldCommitResize) {
    commitDashboardVirtualResize({ showMask: false, preserveRenderedWindow: true })
  }
}

function handleDashboardVirtualScroll(): void {
  const container = dom.dashboardResults
  if (!container?.classList.contains('is-virtualized')) {
    return
  }

  const now = getDashboardNow()
  const nextScrollTop = container.scrollTop
  const previousScrollTop = virtualState.lastScrollTop
  const previousScrollAt = virtualState.lastScrollAt
  const elapsedMs = previousScrollAt ? Math.max(1, now - previousScrollAt) : Number.POSITIVE_INFINITY
  const velocity = Math.abs(nextScrollTop - previousScrollTop) / elapsedMs

  virtualState.scrollTop = nextScrollTop
  virtualState.lastScrollTop = nextScrollTop
  virtualState.lastScrollAt = now
  virtualState.isFastScrolling = velocity >= DASHBOARD_VIRTUAL_FAST_SCROLL_PX_PER_MS
  scheduleDashboardScrollIdle()
  maybePrefetchDashboardSearchResults(container)
  scheduleDashboardVirtualRender()
}

function getDashboardNow(): number {
  try {
    return performance.now()
  } catch {
    return Date.now()
  }
}

function scheduleDashboardScrollIdle(): void {
  if (virtualState.scrollIdleTimer) {
    window.clearTimeout(virtualState.scrollIdleTimer)
  }
  if (virtualState.scrollSettleTimer) {
    window.clearTimeout(virtualState.scrollSettleTimer)
    virtualState.scrollSettleTimer = 0
  }
  if (dashboardListRenderFrame) {
    window.cancelAnimationFrame(dashboardListRenderFrame)
    dashboardListRenderFrame = 0
    dashboardListRenderPendingForScroll = true
  }
  virtualState.scrollIdleTimer = window.setTimeout(() => {
    virtualState.scrollIdleTimer = 0
    const wasFastScrolling = virtualState.isFastScrolling
    virtualState.isFastScrolling = false
    if (dashboardListRenderPendingForScroll) {
      dashboardListRenderPendingForScroll = false
      scheduleDashboardListRender()
    }
    virtualState.scrollSettleTimer = window.setTimeout(() => {
      virtualState.scrollSettleTimer = 0
      flushPendingDashboardFaviconWarmup()
      flushDashboardFaviconDirtySync()
      if (
        virtualState.items.length >= DASHBOARD_VIRTUAL_THRESHOLD &&
        (wasFastScrolling || getDashboardRenderedCardMode() === 'scroll')
      ) {
        scheduleDashboardVirtualRender()
      }
    }, DASHBOARD_SCROLL_SETTLE_MS)
  }, DASHBOARD_SCROLL_IDLE_MS)
}

function maybePrefetchDashboardSearchResults(container: HTMLElement): void {
  if (!dashboardActiveSearchKey || !dashboardState.query.trim()) {
    return
  }

  if (
    dashboardActiveSearchLimit >= DASHBOARD_SEARCH_MAX_SYNC_LIMIT ||
    dashboardActiveSearchResultCount <= dashboardActiveSearchLimit
  ) {
    return
  }

  const remainingPx = container.scrollHeight - container.scrollTop - container.clientHeight
  if (remainingPx > DASHBOARD_SEARCH_SCROLL_PREFETCH_PX) {
    return
  }

  const nextLimit = getNextDashboardSearchResultLimit(dashboardActiveSearchKey)
  if (nextLimit <= dashboardActiveSearchLimit) {
    return
  }

  dashboardSearchPrefetchPendingKey = dashboardActiveSearchKey
  scheduleDashboardSearchPrefetchLimitIncrease()
}

function scheduleDashboardSearchPrefetchLimitIncrease(): void {
  if (dashboardSearchPrefetchIdleScheduled || !dashboardSearchPrefetchPendingKey) {
    return
  }

  dashboardSearchPrefetchIdleScheduled = true
  runIdle(() => {
    dashboardSearchPrefetchIdleScheduled = false
    applyPendingDashboardSearchPrefetchLimitIncrease()
  }, { timeout: DASHBOARD_SEARCH_SCROLL_PREFETCH_IDLE_TIMEOUT_MS })
}

function applyPendingDashboardSearchPrefetchLimitIncrease(): void {
  const searchKey = dashboardSearchPrefetchPendingKey
  dashboardSearchPrefetchPendingKey = ''
  if (!searchKey || searchKey !== dashboardActiveSearchKey || !dashboardState.query.trim()) {
    return
  }

  const now = getDashboardNow()
  if (now - dashboardSearchPrefetchLastRequestedAt < DASHBOARD_SEARCH_SCROLL_PREFETCH_MIN_INTERVAL_MS) {
    dashboardSearchPrefetchPendingKey = searchKey
    if (!dashboardSearchPrefetchRetryTimer) {
      dashboardSearchPrefetchRetryTimer = window.setTimeout(() => {
        dashboardSearchPrefetchRetryTimer = 0
        scheduleDashboardSearchPrefetchLimitIncrease()
      }, DASHBOARD_SEARCH_SCROLL_PREFETCH_MIN_INTERVAL_MS)
    }
    return
  }

  const nextLimit = getNextDashboardSearchResultLimit(searchKey)
  if (
    nextLimit <= dashboardActiveSearchLimit ||
    dashboardActiveSearchLimit >= DASHBOARD_SEARCH_MAX_SYNC_LIMIT ||
    dashboardActiveSearchResultCount <= dashboardActiveSearchLimit
  ) {
    return
  }

  dashboardSearchPrefetchLastRequestedAt = now
  dashboardSearchWorkerState.limitByKey.set(searchKey, nextLimit)
  invalidateDashboardVisibleItemCache()
  markDashboardVirtualFilterChange('append')
  scheduleDashboardListRender()
}

function isDashboardWorkerSearchPending(): boolean {
  return Boolean(
    dashboardActiveSearchKey &&
    dashboardSearchWorkerState.pendingSearchKey === dashboardActiveSearchKey &&
    !dashboardSearchWorkerState.resultCache.has(dashboardActiveSearchKey) &&
    !dashboardSearchWorkerState.error
  )
}

function scheduleDashboardVirtualRender(): void {
  if (virtualState.frame) {
    return
  }

  virtualState.frame = window.requestAnimationFrame(() => {
    virtualState.frame = 0
    if (virtualState.items.length) {
      renderDashboardVirtualScrollFrame()
    }
  })
}

function scheduleDashboardVirtualMeasureRetry(renderVersion = dashboardCardsRenderVersion): void {
  if (virtualState.measureRetryFrame) {
    return
  }

  virtualState.measureRetryFrame = window.requestAnimationFrame(() => {
    virtualState.measureRetryFrame = 0
    if (!virtualState.items.length || renderVersion !== dashboardCardsRenderVersion) {
      return
    }

    renderDashboardCards(virtualState.items, renderVersion)
  })
}

function scheduleDashboardSectionRender(): void {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return
  }

  if (virtualState.sectionFrame) {
    return
  }

  virtualState.sectionFrame = window.requestAnimationFrame(() => {
    virtualState.sectionFrame = 0
    renderDashboardSection()
  })
}

function scheduleDashboardListRender(): void {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return
  }

  if (virtualState.scrollIdleTimer) {
    dashboardListRenderPendingForScroll = true
    return
  }

  if (dashboardListRenderFrame) {
    return
  }

  dashboardListRenderFrame = window.requestAnimationFrame(() => {
    dashboardListRenderFrame = 0
    renderDashboardListOnly()
  })
}

function renderDashboardListOnly(): void {
  if (!dom.dashboardResults) {
    return
  }

  const { model, visibleItems } = getDashboardRenderData()
  syncDashboardSelection(
    dashboardState.selectedIds,
    new Set(model.items.map((item) => String(item.id)))
  )
  syncDashboardSelection(
    dashboardState.expandedTagIds,
    new Set(model.items.map((item) => String(item.id)))
  )
  renderDashboardStatusOnly()
  renderDashboardSelectionBar(visibleItems)
  const renderVersion = beginDashboardCardsRender()
  renderDashboardCards(visibleItems, renderVersion)
  renderDashboardTagEditor(model)
  if (dragState.active) {
    renderDashboardDragOverlay(model)
  }
}

function beginStableDashboardResultsUpdate(): void {
  const container = dom.dashboardResults
  if (!container) {
    return
  }

  const stableHeight = Math.ceil(container.getBoundingClientRect().height)
  if (stableHeight > 0) {
    container.style.setProperty('--dashboard-results-stable-height', `${stableHeight}px`)
  }
  container.classList.add('is-updating')
  showDashboardResultsUpdateOverlay()
  if (dashboardResultsStableFrame) {
    window.cancelAnimationFrame(dashboardResultsStableFrame)
  }
  dashboardResultsStableFrame = window.requestAnimationFrame(() => {
    dashboardResultsStableFrame = window.requestAnimationFrame(() => {
      dashboardResultsStableFrame = 0
      clearStableDashboardResultsUpdate()
    })
  })
}

function endStableDashboardResultsUpdate(): void {
  if (!dom.dashboardResults?.classList.contains('is-updating')) {
    return
  }

  if (dashboardResultsStableFrame) {
    window.cancelAnimationFrame(dashboardResultsStableFrame)
  }
  dashboardResultsStableFrame = window.requestAnimationFrame(() => {
    dashboardResultsStableFrame = 0
    clearStableDashboardResultsUpdate()
  })
}

function clearStableDashboardResultsUpdate(): void {
  if (dashboardResultsStableFrame) {
    window.cancelAnimationFrame(dashboardResultsStableFrame)
    dashboardResultsStableFrame = 0
  }
  dom.dashboardResults?.classList.remove('is-updating')
  dom.dashboardResults?.style.removeProperty('--dashboard-results-stable-height')
  hideDashboardResultsUpdateOverlay()
}

function showDashboardResultsUpdateOverlay(): void {
  const host = dom.dashboardCardRegion
  if (!host) {
    return
  }

  if (dashboardResultsUpdateOverlay?.isConnected) {
    dashboardResultsUpdateOverlay.classList.remove('hidden')
    return
  }

  const overlay = document.createElement('div')
  overlay.className = 'dashboard-update-overlay'
  overlay.setAttribute('aria-hidden', 'true')
  overlay.innerHTML = `
    <div class="dashboard-update-indicator">
      ${renderDotMatrixLoader({ variant: 'spiral', className: 'dashboard-update-dot-loader' })}
    </div>
  `
  dashboardResultsUpdateOverlay = overlay
  host.append(overlay)
}

function hideDashboardResultsUpdateOverlay(): void {
  dashboardResultsUpdateOverlay?.remove()
  dashboardResultsUpdateOverlay = null
}

function syncDashboardPanelReadyState(): void {
  dom.dashboardPanel?.setAttribute(
    'data-dashboard-ready',
    isDashboardViewReady() ? 'true' : 'false'
  )
}

function beginDashboardCardsRender(): number {
  dashboardCardsRenderVersion += 1
  return dashboardCardsRenderVersion
}

function commitDashboardCardsRender(renderVersion: number): void {
  const safeRenderVersion = Math.max(0, Math.floor(Number(renderVersion) || 0))
  if (!safeRenderVersion || safeRenderVersion !== dashboardCardsRenderVersion) {
    return
  }

  dashboardCardsCommittedRenderVersion = safeRenderVersion
  scheduleDashboardFaviconLoadSync()
  scheduleDashboardPanelReveal(safeRenderVersion)
}

function scheduleDashboardPanelReveal(renderVersion: number): void {
  if (availabilityState.catalogLoading || dashboardViewReady) {
    return
  }

  const safeRenderVersion = Math.max(0, Math.floor(Number(renderVersion) || 0))
  if (
    dashboardCardsCommittedRenderVersion !== safeRenderVersion ||
    dashboardCardsRenderVersion !== safeRenderVersion
  ) {
    return
  }

  if (dashboardViewRevealFrame) {
    if (dashboardViewRevealRenderVersion === safeRenderVersion) {
      return
    }
    window.cancelAnimationFrame(dashboardViewRevealFrame)
    dashboardViewRevealFrame = 0
  }

  dashboardViewRevealRenderVersion = safeRenderVersion
  dashboardViewRevealFrame = window.requestAnimationFrame(() => {
    dashboardViewRevealFrame = window.requestAnimationFrame(() => {
      const revealRenderVersion = dashboardViewRevealRenderVersion
      dashboardViewRevealFrame = 0
      if (!shouldRevealDashboardPanelAfterRender({
        catalogLoading: availabilityState.catalogLoading,
        viewReady: dashboardViewReady,
        revealFramePending: false,
        latestRenderVersion: dashboardCardsRenderVersion,
        revealRenderVersion,
        committedRenderVersion: dashboardCardsCommittedRenderVersion
      })) {
        if (
          !availabilityState.catalogLoading &&
          !dashboardViewReady &&
          dashboardCardsCommittedRenderVersion === dashboardCardsRenderVersion
        ) {
          scheduleDashboardPanelReveal(dashboardCardsRenderVersion)
        }
        return
      }
      dashboardViewReady = true
      syncDashboardPanelReadyState()
      if (isDashboardViewReady()) {
        window.dispatchEvent(new CustomEvent('curator:dashboard-view-ready'))
      }
    })
  })
}

function resetDashboardPanelReveal(): void {
  dashboardViewReady = false
  dashboardViewRevealRenderVersion = 0
  if (dashboardViewRevealFrame) {
    window.cancelAnimationFrame(dashboardViewRevealFrame)
    dashboardViewRevealFrame = 0
  }
  syncDashboardPanelReadyState()
}

function resetDashboardVirtualScroll(): void {
  virtualState.scrollTop = 0
  resetDashboardVirtualRenderCache({ preserveItems: true })
  if (dom.dashboardResults) {
    dom.dashboardResults.scrollTop = 0
    virtualState.resetScrollOnNextRender = false
  } else {
    virtualState.resetScrollOnNextRender = true
  }
}

function updateDashboardVirtualMetrics(): boolean {
  const container = dom.dashboardResults
  if (!container) {
    virtualState.containerHeight = 0
    virtualState.columnCount = 1
    virtualState.contentWidth = 0
    virtualState.cardHeight = DASHBOARD_CARD_HEIGHT
    virtualState.minCardWidth = DASHBOARD_CARD_MIN_WIDTH
    virtualState.rowStride = virtualState.cardHeight + DASHBOARD_GRID_GAP
    return false
  }

  if (virtualState.resetScrollOnNextRender) {
    container.scrollTop = 0
    virtualState.resetScrollOnNextRender = false
  }

  const metrics = getDashboardVirtualMetricsSnapshot(
    container,
    virtualState.contentWidth,
    virtualState.containerHeight,
    DASHBOARD_CARD_MIN_WIDTH
  )

  virtualState.cardHeight = DASHBOARD_CARD_HEIGHT
  virtualState.minCardWidth = DASHBOARD_CARD_MIN_WIDTH
  virtualState.containerHeight = Math.max(1, metrics.containerHeight)
  virtualState.contentWidth = Math.max(1, metrics.contentWidth)
  virtualState.columnCount = metrics.columnCount
  virtualState.rowStride = virtualState.cardHeight + DASHBOARD_GRID_GAP
  virtualState.lastResizeWidth = virtualState.contentWidth
  virtualState.lastResizeHeight = virtualState.containerHeight
  virtualState.lastResizeColumnCount = virtualState.columnCount
  return isDashboardVirtualMetricsReady(metrics)
}

function reconcileDashboardTransientUiWithRenderedItems(renderedIds: Set<string>): void {
  for (const expandedId of [...dashboardState.expandedTagIds]) {
    if (!renderedIds.has(String(expandedId))) {
      dashboardState.expandedTagIds.delete(String(expandedId))
    }
  }

  const editorBookmarkId = String(dashboardState.tagEditorBookmarkId || '')
  if (
    editorBookmarkId &&
    !dashboardState.tagEditorSaving &&
    !renderedIds.has(editorBookmarkId)
  ) {
    clearDashboardTagEditorState()
    dom.dashboardTagEditor?.classList.add('hidden')
    dom.dashboardTagEditor?.setAttribute('aria-hidden', 'true')
  }
}

function updateDashboardFloatingEditorPosition(renderedIds: Set<string>): void {
  const editorBookmarkId = String(dashboardState.tagEditorBookmarkId || '')
  if (editorBookmarkId && renderedIds.has(editorBookmarkId)) {
    positionDashboardTagEditor(editorBookmarkId)
  }
}

function renderDashboardTagEditor(existingModel?: DashboardModel): void {
  if (!dom.dashboardTagEditor) {
    return
  }

  const bookmarkId = String(dashboardState.tagEditorBookmarkId || '').trim()
  if (!bookmarkId) {
    dom.dashboardTagEditor.classList.add('hidden')
    dom.dashboardTagEditor.setAttribute('aria-hidden', 'true')
    return
  }

  const model = existingModel || getDashboardRenderData().model
  const item = model.items.find((entry) => String(entry.id) === bookmarkId)
  const record = getDashboardTagRecord(bookmarkId)
  if (!item) {
    closeDashboardTagEditor()
    return
  }

  dom.dashboardTagEditor.classList.remove('hidden')
  dom.dashboardTagEditor.setAttribute('aria-hidden', 'false')
  dom.dashboardTagEditorTitle.textContent = item.title || '未命名书签'
  dom.dashboardTagEditorMeta.textContent = `${displayUrl(item.url)} · ${item.path || '未归档路径'}`
  dom.dashboardTagEditorInput.value = dashboardState.tagEditorDraft
  dom.dashboardTagEditorInput.disabled = dashboardState.tagEditorSaving
  const busyAction = String(dashboardState.tagEditorBusyAction || '')
  const statusText = dashboardState.tagEditorStatus || '用逗号、顿号或换行分隔标签。'
  dom.dashboardTagEditorStatus.textContent = statusText
  const hasAiTags = Boolean(record?.tags?.length)
  dom.dashboardTagEditorSave.disabled = dashboardState.tagEditorSaving
  dom.dashboardTagEditorSave.innerHTML = busyAction === 'save'
    ? renderDashboardLoadingLabel('保存中...', {
      wrapperClass: 'button-loading-label',
      loaderClass: 'dashboard-button-dot-loader'
    })
    : '保存标签'
  dom.dashboardTagEditorClearAi.disabled = dashboardState.tagEditorSaving || !hasAiTags
  dom.dashboardTagEditorClearAi.innerHTML = busyAction === 'clear-ai'
    ? renderDashboardLoadingLabel('清除中...', {
      wrapperClass: 'button-loading-label',
      loaderClass: 'dashboard-button-dot-loader'
    })
    : '清除 AI 标签'
  dom.dashboardTagEditorRegenerateAi.disabled =
    dashboardState.tagEditorSaving ||
    availabilityState.catalogLoading ||
    aiNamingState.running ||
    aiNamingState.applying
  dom.dashboardTagEditorRegenerateAi.innerHTML = busyAction === 'regenerate-ai'
    ? renderDashboardLoadingLabel('生成中...', {
      variant: 'spiral',
      wrapperClass: 'button-loading-label',
      loaderClass: 'dashboard-button-dot-loader'
    })
    : '重新生成 AI 标签'
  dom.dashboardTagEditor
    ?.querySelectorAll<HTMLButtonElement>('[data-dashboard-action="close-tag-editor"]')
    .forEach((button) => {
      const canCancelGeneration = busyAction === 'regenerate-ai' && dashboardState.tagEditorSaving
      button.disabled = dashboardState.tagEditorSaving && !canCancelGeneration
      button.textContent = canCancelGeneration ? '取消生成' : '取消'
      button.classList.toggle('danger', canCancelGeneration)
      button.classList.toggle('secondary', !canCancelGeneration)
    })
  positionDashboardTagEditor(bookmarkId)
}

function positionDashboardTagEditor(bookmarkId: string): void {
  const editor = dom.dashboardTagEditor
  const card = findDashboardCardElement(bookmarkId)
  if (!editor || !card) {
    return
  }

  const margin = 16
  const gap = 12
  const cardRect = card.getBoundingClientRect()
  const editorRect = editor.getBoundingClientRect()
  const editorWidth = Math.min(editorRect.width || 430, window.innerWidth - margin * 2)
  const editorHeight = Math.min(editorRect.height || 300, window.innerHeight - margin * 2)
  const hasRightSpace = cardRect.right + gap + editorWidth <= window.innerWidth - margin
  const hasLeftSpace = cardRect.left - gap - editorWidth >= margin

  let left = hasRightSpace
    ? cardRect.right + gap
    : hasLeftSpace
      ? cardRect.left - gap - editorWidth
      : Math.min(Math.max(cardRect.left, margin), window.innerWidth - editorWidth - margin)
  let top = cardRect.top

  left = Math.min(Math.max(left, margin), window.innerWidth - editorWidth - margin)
  top = Math.min(Math.max(top, margin), window.innerHeight - editorHeight - margin)

  editor.style.left = `${Math.round(left)}px`
  editor.style.top = `${Math.round(top)}px`
  editor.style.right = 'auto'
}

function findDashboardCardElement(bookmarkId: string): HTMLElement | null {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (!normalizedBookmarkId || !dom.dashboardResults) {
    return null
  }

  return dom.dashboardResults.querySelector<HTMLElement>(
    `[data-dashboard-card][data-dashboard-bookmark-id="${CSS.escape(normalizedBookmarkId)}"]`
  )
}

function buildDashboardCard(item: DashboardItem): string {
  const selected = dashboardState.selectedIds.has(String(item.id))
  const expanded = dashboardState.expandedTagIds.has(String(item.id))
  const selectionLabel = getDashboardSelectionLabel(item)
  const openLabel = getDashboardCardActionLabel('打开书签', item)
  const copyActionLabel = getDashboardCardActionLabel('复制书签链接', item)
  const editTagsLabel = getDashboardCardActionLabel('修改书签标签', item)
  const moveLabel = getDashboardCardActionLabel('移动书签', item)
  const deleteLabel = getDashboardCardActionLabel('删除书签', item)
  const speedDialPinned = dashboardState.speedDialPinnedIds.has(String(item.id))
  const speedDialActionText = speedDialPinned ? '从 Speed Dial 移除' : '添加进 Speed Dial'
  const speedDialTooltip = speedDialPinned ? '从 Speed Dial 移除' : '添加进 Speed Dial'
  const speedDialActionLabel = getDashboardCardActionLabel(speedDialTooltip, item)
  const moreLabel = getDashboardCardActionLabel('更多操作', item)
  const visibleTagLimit = 1
  const tags = item.tags.slice(0, visibleTagLimit)
  const hiddenTagCount = Math.max(0, item.tags.length - tags.length)
  const copyLabel = dashboardState.copyFeedbackId === String(item.id) ? '已复制' : '复制'
  const faviconMarkup = renderDashboardFaviconImage(item.url)
  const tagStatusTitle = item.hasManualTags
    ? '已有手动标签'
    : item.aiTags.length
      ? '已有 AI 标签'
      : '未生成 AI 标签'
  const itemPath = formatBookmarkPath(item.path) || '未归档路径'
  const tagMarkup = tags.length
    ? tags.map((tag) => `<span class="dashboard-mini-chip">${escapeHtml(tag)}</span>`).join('')
    : ''
  const toggleMarkup = item.tags.length > visibleTagLimit
    ? `
        <button
          class="dashboard-mini-chip dashboard-tag-toggle"
          type="button"
          data-dashboard-toggle-tags="${escapeAttr(item.id)}"
          data-dashboard-no-drag
          aria-expanded="${expanded ? 'true' : 'false'}"
          aria-controls="dashboard-tag-popover-${escapeAttr(item.id)}"
          aria-label="查看 ${escapeAttr(String(hiddenTagCount))} 个隐藏标签"
        >+${escapeHtml(String(hiddenTagCount))}</button>
      `
    : ''
  const tagPopoverMarkup = expanded && item.tags.length
    ? renderDashboardTagPopoverMarkup(item)
    : ''
  const tagRowMarkup = tagMarkup || toggleMarkup
    ? `<div class="dashboard-card-tag-row">${tagMarkup}${toggleMarkup}</div>`
    : '<div class="dashboard-card-tag-row empty" aria-hidden="true"></div>'

  return `
    <article
      class="dashboard-bookmark-card ${selected ? 'selected' : ''} ${expanded ? 'tags-expanded' : ''}"
      data-dashboard-card
      data-dashboard-bookmark-id="${escapeAttr(item.id)}"
    >
      <label class="dashboard-card-check" data-dashboard-no-drag>
        <input
          type="checkbox"
          data-dashboard-select="${escapeAttr(item.id)}"
          aria-label="${escapeAttr(selectionLabel)}"
          ${selected ? 'checked' : ''}
          ${availabilityState.deleting ? 'disabled' : ''}
        >
        <span class="sr-only">${escapeHtml(selectionLabel)}</span>
      </label>
      <div class="dashboard-card-body">
        <span class="dashboard-favicon-shell" aria-hidden="true">
          ${faviconMarkup}
          <span>${escapeHtml(getFallbackLabel(item.title))}</span>
        </span>
        <div class="dashboard-card-copy">
          <div class="dashboard-card-title-row">
            <strong title="${escapeAttr(item.title || '未命名书签')}">${escapeHtml(item.title || '未命名书签')}</strong>
          </div>
          <a
            class="dashboard-card-url"
            href="${escapeAttr(item.url)}"
            target="_blank"
            rel="noreferrer noopener"
            data-dashboard-no-drag
          >${escapeHtml(displayUrl(item.url))}</a>
          <div class="dashboard-card-meta">
            <div class="dashboard-card-path-row">
              <button
                class="dashboard-path-chip"
                type="button"
                data-dashboard-folder-filter="${escapeAttr(item.parentId || '')}"
                data-dashboard-no-drag
                title="${escapeAttr(itemPath)}"
                aria-label="按文件夹筛选：${escapeAttr(itemPath)}"
              >${escapeHtml(itemPath)}</button>
            </div>
            ${tagRowMarkup}
          </div>
        </div>
      </div>
      <div class="dashboard-card-side">
        <span
          class="dashboard-status-dot ${item.tags.length ? 'has-tags' : ''}"
          title="${escapeAttr(tagStatusTitle)}"
        ></span>
      </div>
      <div class="dashboard-card-footer">
        <div class="dashboard-card-actions">
          ${renderDashboardCardAction({
            as: 'a',
            icon: 'open',
            label: openLabel,
            tooltip: '打开书签',
            className: 'detect-result-open',
            attrs: `href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer noopener" data-dashboard-no-drag`,
            text: '打开'
          })}
          ${renderDashboardCardAction({
            icon: 'copy',
            label: copyActionLabel,
            tooltip: copyLabel === '已复制' ? '已复制' : '复制链接',
            className: 'detect-result-action',
            attrs: `data-dashboard-copy="${escapeAttr(item.id)}" data-dashboard-no-drag`,
            text: copyLabel
          })}
          <details class="dashboard-card-more" data-dashboard-no-drag>
            <summary
              class="dashboard-icon-action dashboard-card-more-trigger"
              data-dashboard-tooltip="更多操作"
              aria-label="${escapeAttr(moreLabel)}"
              aria-haspopup="menu"
              aria-expanded="false"
            >
              ${renderDashboardMoreIcon()}
              <span class="sr-only">更多</span>
            </summary>
            <div class="dashboard-card-menu" role="menu" aria-label="${escapeAttr(moreLabel)}">
              ${renderDashboardCardMenuItem({
                icon: 'tag',
                label: editTagsLabel,
                attrs: `data-dashboard-action="edit-tags" data-dashboard-bookmark-id="${escapeAttr(item.id)}" data-dashboard-no-drag role="menuitem"`,
                text: '修改标签'
              })}
              ${renderDashboardCardMenuItem({
                icon: 'speed-dial',
                label: speedDialActionLabel,
                attrs: `data-dashboard-action="toggle-speed-dial" data-dashboard-bookmark-id="${escapeAttr(item.id)}" data-dashboard-no-drag role="menuitem" aria-pressed="${speedDialPinned ? 'true' : 'false'}"`,
                text: speedDialActionText
              })}
              ${renderDashboardCardMenuItem({
                icon: 'move',
                label: moveLabel,
                attrs: `data-dashboard-action="move-one" data-dashboard-bookmark-id="${escapeAttr(item.id)}" data-dashboard-no-drag role="menuitem"`,
                text: '移动',
                disabled: availabilityState.deleting
              })}
              ${renderDashboardCardMenuItem({
                icon: 'delete',
                label: deleteLabel,
                attrs: `data-dashboard-action="delete-one" data-dashboard-bookmark-id="${escapeAttr(item.id)}" data-dashboard-no-drag role="menuitem"`,
                text: '删除',
                danger: true,
                disabled: availabilityState.deleting
              })}
            </div>
          </details>
        </div>
      </div>
      ${tagPopoverMarkup}
    </article>
  `
}

function renderDashboardTagPopoverMarkup(item: DashboardItem): string {
  return `
    <div id="dashboard-tag-popover-${escapeAttr(item.id)}" class="dashboard-tag-popover" data-dashboard-no-drag role="dialog" aria-modal="false" aria-label="全部标签">
      <strong>全部标签</strong>
      <div class="dashboard-tag-popover-list">
        ${item.tags.map((tag) => `<span class="dashboard-mini-chip">${escapeHtml(tag)}</span>`).join('')}
      </div>
    </div>
  `
}

async function copyDashboardBookmarkUrl(bookmarkId: string): Promise<void> {
  const bookmark = availabilityState.bookmarkMap.get(String(bookmarkId))
  if (!bookmark?.url) {
    return
  }

  try {
    await navigator.clipboard.writeText(bookmark.url)
    setDashboardStatus('链接已复制。', bookmarkId)
  } catch {
    setDashboardStatus('复制失败，请手动复制链接。')
  }
}

function handleDashboardFaviconLoad(image: HTMLImageElement): void {
  if (!image.naturalWidth || !image.naturalHeight) {
    return
  }

  const shell = image.closest<HTMLElement>('.dashboard-favicon-shell')
  shell?.classList.add('has-favicon')
}

function handleDashboardFaviconError(image: HTMLImageElement, _callbacks: DashboardCallbacks): void {
  markDashboardFaviconImageFailed(image)
}

function markDashboardFaviconImageFailed(image: HTMLImageElement): void {
  const failedSource = String(image.getAttribute('data-dashboard-favicon-source') || '')
  const pageUrl = String(image.getAttribute('data-dashboard-favicon-page-url') || '').trim()
  const shell = image.closest<HTMLElement>('.dashboard-favicon-shell')
  if (failedSource === 'cache' && pageUrl) {
    removeDashboardRemoteFavicon(pageUrl)
    const chromeFallbackUrl = getDashboardFaviconFallbackUrl(pageUrl)
    if (chromeFallbackUrl) {
      image.src = chromeFallbackUrl
      image.setAttribute('data-dashboard-favicon-source', 'chrome')
      shell?.classList.remove('has-favicon')
      return
    }
  }

  image.remove()
  shell?.classList.remove('has-favicon')
}

function scheduleDashboardFaviconLoadSync(): void {
  if (dashboardFaviconLoadSyncFrame || dashboardFaviconLoadSyncTimer || typeof window === 'undefined') {
    return
  }

  dashboardFaviconLoadSyncTimer = window.setTimeout(() => {
    dashboardFaviconLoadSyncTimer = 0
    dashboardFaviconLoadSyncFrame = window.requestAnimationFrame(() => {
      dashboardFaviconLoadSyncFrame = 0
      syncCompletedDashboardFaviconImages()
    })
  }, virtualState.scrollIdleTimer ? DASHBOARD_FAVICON_DIRTY_SYNC_SCROLL_DELAY_MS : 0)
}

function syncCompletedDashboardFaviconImages(): void {
  syncDashboardVirtualLoadWorkload()
}

function syncDashboardVirtualLoadWorkload(): void {
  const host = dom.dashboardResults?.querySelector<HTMLElement>('.dashboard-virtual-window') ||
    dom.dashboardResults ||
    null
  if (!host) {
    return
  }

  const limit = virtualState.isFastScrolling
    ? Math.max(32, Math.floor(DASHBOARD_FAVICON_LOAD_SYNC_BATCH_SIZE / 2))
    : DASHBOARD_FAVICON_LOAD_SYNC_BATCH_SIZE
  let processed = 0
  for (const image of host.querySelectorAll<HTMLImageElement>('img[data-dashboard-favicon]')) {
    if (processed >= limit) {
      break
    }
    if (!image.complete) {
      continue
    }
    processed += 1
    if (image.naturalWidth && image.naturalHeight) {
      handleDashboardFaviconLoad(image)
      continue
    }
    markDashboardFaviconImageFailed(image)
  }
}

async function moveDashboardBookmarkToFolder(
  bookmarkId: string,
  folderId: string,
  callbacks: DashboardCallbacks
): Promise<void> {
  const bookmark = availabilityState.bookmarkMap.get(String(bookmarkId))
  const targetFolder = availabilityState.folderMap.get(String(folderId))
  if (!bookmark?.url || !targetFolder) {
    setDashboardStatus('移动失败：目标书签或文件夹不存在。')
    return
  }

  if (String(bookmark.parentId || '') === folderId) {
    setDashboardStatus('书签已在该文件夹。')
    return
  }

  try {
    await createAutoBackupBeforeDangerousOperation({
      kind: 'batch-move',
      source: 'options',
      reason: '书签仪表盘拖拽移动',
      targetBookmarkIds: [bookmarkId],
      targetFolderIds: [folderId],
      estimatedChangeCount: 1
    })
    await moveBookmark(bookmarkId, folderId)
    dashboardState.selectedIds.delete(bookmarkId)
    await callbacks.hydrateAvailabilityCatalog({ preserveResults: true })
    setDashboardStatus(`已移动到 ${targetFolder.path || targetFolder.title}。`)
  } catch (error) {
    setDashboardStatus(error instanceof Error ? `移动失败：${error.message}` : '移动失败，请稍后重试。')
  }
}

function setDashboardStatus(
  message: string,
  copiedId = '',
  { render = true }: { render?: boolean } = {}
): void {
  const previousCopiedId = String(dashboardState.copyFeedbackId || '')
  dashboardState.statusMessage = message
  dashboardState.copyFeedbackId = copiedId
  renderDashboardStatusOnly()
  if (render) {
    const patched = previousCopiedId || copiedId
      ? patchDashboardCardsById(new Set([previousCopiedId, copiedId].filter(Boolean)))
      : true
    if (!patched) {
      renderDashboardSection()
    }
  }

  if (dashboardStatusTimer) {
    window.clearTimeout(dashboardStatusTimer)
  }

  dashboardStatusTimer = window.setTimeout(() => {
    const clearingCopiedId = String(dashboardState.copyFeedbackId || '')
    dashboardState.statusMessage = ''
    dashboardState.copyFeedbackId = ''
    renderDashboardStatusOnly()
    if (clearingCopiedId && findDashboardCardElement(clearingCopiedId) && !patchDashboardCardById(clearingCopiedId)) {
      renderDashboardSection()
    }
  }, 1800)
}

function renderDashboardStatusOnly(): void {
  if (!dom.dashboardStatus) {
    return
  }

  dom.dashboardStatus.innerHTML = availabilityState.deleting
    ? renderDashboardLoadingLabel('正在处理所选书签...', {
      loaderClass: 'dashboard-status-dot-loader'
    })
    : escapeHtml(dashboardState.statusMessage || '')
}

function renderDashboardLoadingLabel(
  label: string,
  {
    variant = 'bar',
    wrapperClass = 'status-loading-label',
    loaderClass = 'dashboard-status-dot-loader'
  }: {
    variant?: 'bar' | 'spiral'
    wrapperClass?: string
    loaderClass?: string
  } = {}
): string {
  return `
    <span class="${escapeAttr(wrapperClass)}">
      ${renderDotMatrixLoader({ variant, className: loaderClass })}
      <span>${escapeHtml(label)}</span>
    </span>
  `
}

function renderDashboardEmptyLoading(label: string): string {
  return `
    <div class="detect-empty dashboard-loading-empty">
      ${renderDashboardLoadingLabel(label, { variant: 'spiral' })}
    </div>
  `
}

function startDashboardDrag(): void {
  if (!dragState.armed || dragState.active || dragState.moving) {
    return
  }

  const bookmark = availabilityState.bookmarkMap.get(String(dragState.bookmarkId))
  if (!bookmark?.url) {
    cancelDashboardDrag({ silent: true })
    return
  }

  dragState.armed = false
  dragState.active = true
  renderDashboardDragOverlay()
  updateDashboardDragPreviewPosition()
}

function renderDashboardDragOverlay(existingModel?: DashboardModel): void {
  if (!dom.dashboardDragOverlay || !dom.dashboardFolderDropGrid || !dom.dashboardDragPreview) {
    return
  }

  ensureDashboardDragOverlayPortal()

  const model = existingModel || buildDashboardModel({
    bookmarks: availabilityState.allBookmarks,
    folders: availabilityState.allFolders,
    tagIndex: (aiNamingState.tagIndex as BookmarkTagIndex) || null,
    contentSnapshotIndex: contentSnapshotState.index,
    contentSnapshotSearchMap: contentSnapshotState.searchTextMap,
    includeFullText: contentSnapshotState.settings.fullTextSearchEnabled
  })
  const bookmark = availabilityState.bookmarkMap.get(String(dragState.bookmarkId))
  const faviconMarkup = renderDashboardFaviconImage(bookmark?.url || '')

  dom.dashboardPanel?.classList.add('is-dashboard-dragging')
  cancelExitMotion(dom.dashboardDragOverlay, 'is-closing')
  dom.dashboardDragOverlay.classList.remove('hidden')
  dom.dashboardDragOverlay.classList.toggle('is-moving', dragState.moving)
  dom.dashboardDragOverlay.setAttribute('aria-hidden', 'false')
  setDashboardDeleteDropHover(dragState.hoverDeleteTarget)
  if (dom.dashboardDragHint) {
    dom.dashboardDragHint.innerHTML = dragState.moving
      ? renderDashboardLoadingLabel('正在移动书签...', {
        wrapperClass: 'status-loading-label',
        loaderClass: 'dashboard-status-dot-loader'
      })
      : '选择目标文件夹后松开即可移动。'
  }

  dom.dashboardFolderDropGrid.innerHTML = model.folderTargets.length
    ? model.folderTargets.map((folder) => buildDashboardFolderDropCard(folder)).join('')
    : '<div class="detect-empty">没有可用的目标文件夹。</div>'
  setDashboardDropHover(dragState.hoverFolderId)

  dom.dashboardDragPreview.innerHTML = `
    <span class="dashboard-favicon-shell" aria-hidden="true">
      ${faviconMarkup}
      <span>${escapeHtml(getFallbackLabel(bookmark?.title || ''))}</span>
    </span>
    <span>${escapeHtml(bookmark?.title || '未命名书签')}</span>
  `
  scheduleDashboardFaviconLoadSync()
}

function buildDashboardFolderDropCard(folder: DashboardFolderTarget): string {
  const active = dragState.hoverFolderId === folder.id
  const bookmarkCopy = `${folder.bookmarkCount} 个书签`
  const folderCopy = folder.folderCount ? ` · ${folder.folderCount} 个子文件夹` : ''
  return `
    <button
      class="dashboard-folder-drop-card ${active ? 'active' : ''}"
      type="button"
      role="option"
      aria-selected="${active ? 'true' : 'false'}"
      data-dashboard-drop-folder="${escapeAttr(folder.id)}"
      title="${escapeAttr(folder.path)}"
    >
      <span class="dashboard-folder-icon" aria-hidden="true"></span>
      <span class="dashboard-folder-copy">
        <strong>${escapeHtml(folder.title)}</strong>
        <span>${escapeHtml(folder.path)}</span>
        <small>${escapeHtml(bookmarkCopy + folderCopy)}</small>
      </span>
    </button>
  `
}

function updateDashboardDragPreviewPosition(): void {
  if (!dom.dashboardDragPreview || !dragState.active) {
    return
  }

  dom.dashboardDragPreview.style.transform =
    `translate3d(${dragState.currentX}px, ${dragState.currentY}px, 0) translate3d(-50%, -50%, 0)`
}

function updateDashboardDropHoverFromPoint(x: number, y: number): void {
  const element = document.elementFromPoint(x, y) as HTMLElement | null
  const deleteTarget = element?.closest<HTMLElement>('[data-dashboard-delete-drop]')
  if (deleteTarget) {
    setDashboardDeleteDropHover(true)
    setDashboardDropHover('')
    return
  }

  setDashboardDeleteDropHover(false)
  const folderCard = element?.closest<HTMLElement>('[data-dashboard-drop-folder]')
  setDashboardDropHover(String(folderCard?.getAttribute('data-dashboard-drop-folder') || '').trim())
}

function setDashboardDeleteDropHover(active: boolean): void {
  dragState.hoverDeleteTarget = active
  dom.dashboardDeleteDropTarget?.classList.toggle('active', active)
}

function setDashboardDropHover(folderId: string): void {
  const nextFolderId = String(folderId || '').trim()
  if (
    dragState.hoverFolderId === nextFolderId &&
    dashboardDropHoverCard?.isConnected &&
    dashboardDropHoverCard.getAttribute('data-dashboard-drop-folder') === nextFolderId
  ) {
    return
  }

  dashboardDropHoverCard?.classList.remove('active')
  dragState.hoverFolderId = nextFolderId
  dashboardDropHoverCard = nextFolderId
    ? dom.dashboardFolderDropGrid?.querySelector<HTMLElement>(
      `[data-dashboard-drop-folder="${CSS.escape(nextFolderId)}"]`
    ) || null
    : null
  dashboardDropHoverCard?.classList.add('active')
}

function hideDashboardDragOverlay(): Promise<void> {
  const overlay = dom.dashboardDragOverlay
  if (!overlay || overlay.classList.contains('hidden')) {
    dom.dashboardPanel?.classList.remove('is-dashboard-dragging')
    clearDashboardDragOverlayContent()
    return Promise.resolve()
  }

  return closeWithExitMotion(overlay, 'is-closing', () => {
    dom.dashboardPanel?.classList.remove('is-dashboard-dragging')
    overlay.classList.add('hidden')
    overlay.classList.remove('is-moving')
    overlay.setAttribute('aria-hidden', 'true')
    clearDashboardDragOverlayContent()
  }, 220)
}

function clearDashboardDragOverlayContent(): void {
  setDashboardDeleteDropHover(false)
  dashboardDropHoverCard = null
  if (dom.dashboardFolderDropGrid) {
    dom.dashboardFolderDropGrid.innerHTML = ''
  }
  if (dom.dashboardDragPreview) {
    dom.dashboardDragPreview.innerHTML = ''
    dom.dashboardDragPreview.style.transform = ''
  }
}

function ensureDashboardDragOverlayPortal(): void {
  if (!dom.dashboardDragOverlay || !document.body) {
    return
  }

  if (dom.dashboardDragOverlay.parentElement !== document.body) {
    document.body.appendChild(dom.dashboardDragOverlay)
  }
}

function releaseDashboardPointerCapture(): void {
  const captureElement = dragState.captureElement
  if (!captureElement || dragState.pointerId < 0) {
    return
  }

  try {
    if (captureElement.hasPointerCapture(dragState.pointerId)) {
      captureElement.releasePointerCapture(dragState.pointerId)
    }
  } catch {
    // Capture may already be gone after DOM updates.
  }
}

function resetDashboardDragState(): boolean {
  const wasActive = dragState.active || dragState.armed
  releaseDashboardPointerCapture()
  Object.assign(dragState, createDashboardDragState(), {
    captureElement: null
  })
  return wasActive
}

async function closeDashboardDragForFollowUp({ silent = false }: { silent?: boolean } = {}): Promise<boolean> {
  const wasActive = resetDashboardDragState()
  await hideDashboardDragOverlay()

  if (wasActive && !silent) {
    setDashboardStatus('已取消移动。')
  }

  return wasActive
}

function isDashboardDragPointer(event: PointerEvent): boolean {
  return dragState.pointerId === event.pointerId && (dragState.armed || dragState.active)
}

function shouldIgnoreDashboardDragTarget(target: HTMLElement): boolean {
  return Boolean(target.closest('a, button, input, label, select, textarea, [data-dashboard-no-drag]'))
}

function suppressDashboardNativeSelection(event?: Event): void {
  if (event?.cancelable) {
    event.preventDefault()
  }
  document.getSelection()?.removeAllRanges()
}

export function getDashboardFaviconFallbackUrl(url: string): string {
  const endpointUrl = getDashboardFaviconEndpointUrl()
  if (!endpointUrl || !url) {
    return ''
  }
  return buildDashboardFaviconUrl(endpointUrl, url, { size: DASHBOARD_FAVICON_SIZE })
}

function renderDashboardFaviconImage(pageUrl: string): string {
  const normalizedPageUrl = String(pageUrl || '').trim()
  if (!normalizedPageUrl) {
    return ''
  }

  const remoteEntry = getDashboardCachedFaviconEntry(normalizedPageUrl)
  if (remoteEntry?.iconUrl) {
    return renderDashboardFaviconImg({
      src: remoteEntry.iconUrl,
      source: 'cache',
      pageUrl: normalizedPageUrl
    })
  }

  const chromeFaviconUrl = getDashboardFaviconFallbackUrl(normalizedPageUrl)
  if (!chromeFaviconUrl) {
    return ''
  }

  return renderDashboardFaviconImg({
    src: chromeFaviconUrl,
    source: 'chrome',
    pageUrl: normalizedPageUrl
  })
}

function renderDashboardFaviconImg({
  src,
  source,
  pageUrl
}: {
  src: string
  source: 'cache' | 'chrome'
  pageUrl: string
}): string {
  return `<img src="${escapeAttr(src)}" alt="" loading="lazy" decoding="async" draggable="false" data-dashboard-favicon data-dashboard-favicon-source="${source}" data-dashboard-favicon-page-url="${escapeAttr(pageUrl)}">`
}

function getFallbackLabel(title: string): string {
  const trimmed = String(title || '').trim()
  return (trimmed[0] || '*').toUpperCase()
}

function syncDashboardFaviconWarmup(
  items: DashboardItem[],
  startIndex = 0,
  endIndex = items.length
): void {
  if (availabilityState.catalogLoading || dom.dashboardPanel?.hidden) {
    stopDashboardFaviconWarmup()
    return
  }

  const endpointUrl = getDashboardFaviconEndpointUrl()
  const safeStartIndex = clampDashboardInteger(startIndex, 0, items.length, 0)
  const safeEndIndex = clampDashboardInteger(endIndex, safeStartIndex, items.length, items.length)
  if (
    endpointUrl &&
    dashboardFaviconWarmupQueue &&
    dashboardFaviconWarmupItems === items &&
    dashboardFaviconWarmupEndpointUrl === endpointUrl &&
    safeStartIndex === dashboardFaviconWarmupStartIndex &&
    safeEndIndex === dashboardFaviconWarmupEndIndex
  ) {
    return
  }

  const warmupItems = items.slice(safeStartIndex, safeEndIndex)
  if (!endpointUrl || !warmupItems.length) {
    stopDashboardFaviconWarmup()
    return
  }
  const warmupKey = getDashboardFaviconWarmupStableKey(warmupItems)

  if (
    warmupKey === dashboardFaviconWarmupKey &&
    safeStartIndex === dashboardFaviconWarmupStartIndex &&
    safeEndIndex === dashboardFaviconWarmupEndIndex &&
    dashboardFaviconWarmupQueue
  ) {
    return
  }

  stopDashboardFaviconWarmup()
  dashboardFaviconWarmupItems = items
  dashboardFaviconWarmupKey = warmupKey
  dashboardFaviconWarmupStartIndex = safeStartIndex
  dashboardFaviconWarmupEndIndex = safeEndIndex
  dashboardFaviconWarmupEndpointUrl = endpointUrl
  dashboardFaviconWarmupQueue = createDashboardFaviconWarmupQueue({
    bookmarks: warmupItems,
    faviconEndpointUrl: endpointUrl,
    remoteCache: dashboardFaviconCache,
    size: DASHBOARD_FAVICON_SIZE,
    maxConcurrent: DASHBOARD_FAVICON_WARMUP_CONCURRENCY,
    batchSize: DASHBOARD_FAVICON_WARMUP_BATCH_SIZE,
    batchDelayMs: DASHBOARD_FAVICON_WARMUP_BATCH_DELAY_MS,
    loadFavicon: (chromeFaviconUrl, item) => warmDashboardFavicon(chromeFaviconUrl, item, {
      getCache: () => dashboardFaviconCache,
      upsert: upsertDashboardRemoteFavicon,
      markFailed: markDashboardRemoteFaviconFailed
    }, {
      canFetchRemote: canFetchDashboardRemoteFavicon
    }),
    onWarm: (item) => {
      scheduleDashboardFaviconForPageUrlSync(item.pageUrl)
    },
    onError: (item, error) => {
      aggregateDashboardFaviconWarmupError(item.pageUrl, error)
    }
  })
  dashboardFaviconWarmupQueue.start()
}

function scheduleDashboardFaviconWarmup(
  items: DashboardItem[],
  startIndex = 0,
  endIndex = items.length
): void {
  if (!virtualState.scrollIdleTimer) {
    syncDashboardFaviconWarmup(items, startIndex, endIndex)
    return
  }

  dashboardFaviconWarmupPendingItems = items
  dashboardFaviconWarmupPendingStartIndex = startIndex
  dashboardFaviconWarmupPendingEndIndex = endIndex
}

function flushPendingDashboardFaviconWarmup(): void {
  const items = dashboardFaviconWarmupPendingItems
  if (!items) {
    return
  }

  const startIndex = dashboardFaviconWarmupPendingStartIndex
  const endIndex = dashboardFaviconWarmupPendingEndIndex
  clearPendingDashboardFaviconWarmup()
  syncDashboardFaviconWarmup(items, startIndex, endIndex)
}

function clearPendingDashboardFaviconWarmup(): void {
  dashboardFaviconWarmupPendingItems = null
  dashboardFaviconWarmupPendingStartIndex = -1
  dashboardFaviconWarmupPendingEndIndex = -1
}

function stopDashboardFaviconWarmup(): void {
  dashboardFaviconWarmupQueue?.cancel()
  dashboardFaviconWarmupQueue = null
  dashboardFaviconWarmupItems = null
  dashboardFaviconWarmupKey = ''
  dashboardFaviconWarmupStartIndex = -1
  dashboardFaviconWarmupEndIndex = -1
  dashboardFaviconWarmupEndpointUrl = ''
  clearPendingDashboardFaviconWarmup()
  dashboardFaviconDirtyPageUrls.clear()
  if (dashboardFaviconDirtySyncTimer) {
    globalThis.clearTimeout(dashboardFaviconDirtySyncTimer)
    dashboardFaviconDirtySyncTimer = 0
  }
  flushDashboardFaviconWarmupDebugSummary()
}

function resetDashboardFaviconWarmupForCacheChange(): void {
  stopDashboardFaviconWarmup()
}

function getDashboardFaviconWarmupStableKey(items: DashboardItem[]): string {
  return items.map((item) => `${String(item.id || '')}\u0002${String(item.url || '')}`).join('\u0001')
}

function syncDashboardFaviconsForPageUrls(pageUrls: Iterable<string>): void {
  if (dom.dashboardPanel?.hidden || availabilityState.catalogLoading) {
    return
  }

  if (!dom.dashboardResults) {
    return
  }

  const dirtyEntries = new Map<string, DashboardFaviconCacheEntry>()
  for (const pageUrl of pageUrls) {
    const cacheKey = getDashboardFaviconCacheKey(pageUrl)
    if (!cacheKey || dirtyEntries.has(cacheKey)) {
      continue
    }
    const entry = getDashboardCachedFaviconEntry(cacheKey)
    if (entry?.iconUrl) {
      dirtyEntries.set(cacheKey, entry)
    }
  }
  if (!dirtyEntries.size) {
    return
  }

  const host = dom.dashboardResults.querySelector<HTMLElement>('.dashboard-virtual-window') || dom.dashboardResults
  host.querySelectorAll<HTMLImageElement>('img[data-dashboard-favicon]').forEach((image) => {
    const imageCacheKey = getDashboardFaviconCacheKey(
      String(image.getAttribute('data-dashboard-favicon-page-url') || '').trim()
    )
    const entry = dirtyEntries.get(imageCacheKey)
    if (!entry?.iconUrl || image.getAttribute('src') === entry.iconUrl) {
      return
    }
    const shell = image.closest<HTMLElement>('.dashboard-favicon-shell')
    shell?.classList.remove('has-favicon')
    image.src = entry.iconUrl
    image.setAttribute('data-dashboard-favicon-source', 'cache')
  })
  scheduleDashboardFaviconLoadSync()
}

function scheduleDashboardFaviconForPageUrlSync(pageUrl: string): void {
  const normalizedPageUrl = getDashboardFaviconCacheKey(pageUrl)
  if (!normalizedPageUrl) {
    return
  }

  dashboardFaviconDirtyPageUrls.add(normalizedPageUrl)
  if (typeof window === 'undefined') {
    flushDashboardFaviconDirtySync()
    return
  }
  if (dashboardFaviconDirtySyncTimer) {
    return
  }

  dashboardFaviconDirtySyncTimer = window.setTimeout(
    () => flushDashboardFaviconDirtySync(),
    virtualState.scrollIdleTimer
      ? DASHBOARD_FAVICON_DIRTY_SYNC_SCROLL_DELAY_MS
      : DASHBOARD_FAVICON_DIRTY_SYNC_DELAY_MS
  )
}

function flushDashboardFaviconDirtySync(): void {
  if (dashboardFaviconDirtySyncTimer) {
    window.clearTimeout(dashboardFaviconDirtySyncTimer)
    dashboardFaviconDirtySyncTimer = 0
  }
  if (!dashboardFaviconDirtyPageUrls.size) {
    return
  }

  const dirtyPageUrls = [...dashboardFaviconDirtyPageUrls]
  dashboardFaviconDirtyPageUrls.clear()
  runIdle(() => {
    syncDashboardFaviconsForPageUrls(dirtyPageUrls)
  }, { timeout: DASHBOARD_FAVICON_DIRTY_SYNC_SCROLL_DELAY_MS })
}

function getDashboardCachedFaviconEntry(pageUrl: string, now = Date.now()): DashboardFaviconCacheEntry | null {
  return getDashboardCachedFaviconEntryFromCache(dashboardFaviconCache, pageUrl, now)
}

function upsertDashboardRemoteFavicon(pageUrl: string, iconUrl: string, now = Date.now()): void {
  const key = getDashboardFaviconCacheKey(pageUrl)
  if (!key || !isDashboardSafeImageUrl(iconUrl)) {
    return
  }

  dashboardFaviconCache = normalizeDashboardFaviconCache({
    ...dashboardFaviconCache,
    [key]: {
      pageUrl: key,
      iconUrl,
      updatedAt: now,
      version: DASHBOARD_FAVICON_FETCH_VERSION
    }
  }, { now })
  scheduleDashboardFaviconCacheSave()
}

function markDashboardRemoteFaviconFailed(pageUrl: string, now = Date.now()): void {
  const key = getDashboardFaviconCacheKey(pageUrl)
  if (!key) {
    return
  }

  dashboardFaviconCache = normalizeDashboardFaviconCache({
    ...dashboardFaviconCache,
    [key]: {
      pageUrl: key,
      iconUrl: '',
      updatedAt: 0,
      failedAt: now,
      version: DASHBOARD_FAVICON_FETCH_VERSION
    }
  }, { now })
  scheduleDashboardFaviconCacheSave()
}

function removeDashboardRemoteFavicon(pageUrl: string): void {
  const key = getDashboardFaviconCacheKey(pageUrl)
  if (!key || !dashboardFaviconCache[key]) {
    return
  }

  dashboardFaviconCache = { ...dashboardFaviconCache }
  delete dashboardFaviconCache[key]
  scheduleDashboardFaviconCacheSave()
}

function scheduleDashboardFaviconCacheSave(): void {
  if (!dashboardFaviconCacheHydrated) {
    return
  }

  if (dashboardFaviconCacheSaveTimer) {
    window.clearTimeout(dashboardFaviconCacheSaveTimer)
  }

  dashboardFaviconCacheSaveTimer = window.setTimeout(() => {
    dashboardFaviconCacheSaveTimer = 0
    void setLocalStorage({
      [STORAGE_KEYS.dashboardFaviconCache]: dashboardFaviconCache
    }).catch((error) => {
      logDashboardFaviconDebug('[Curator] Dashboard favicon cache save skipped', error)
    })
  }, 600)
}

async function canFetchDashboardRemoteFavicon(pageUrl: string): Promise<boolean> {
  const originPattern = getDashboardRemoteFaviconOriginPattern(pageUrl)
  if (!originPattern || typeof chrome === 'undefined' || !chrome.permissions?.contains) {
    return false
  }

  try {
    return await chrome.permissions.contains({ origins: [originPattern] })
  } catch {
    return false
  }
}

function getDashboardRemoteFaviconOriginPattern(pageUrl: string): string {
  try {
    const parsedUrl = new URL(pageUrl)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return ''
    }
    return `${parsedUrl.origin}/*`
  } catch {
    return ''
  }
}

function aggregateDashboardFaviconWarmupError(pageUrl: string, error: unknown): void {
  if (!isDashboardFaviconDebugEnabled()) {
    return
  }

  dashboardFaviconWarmupDebugSummary = {
    skipped: (dashboardFaviconWarmupDebugSummary?.skipped || 0) + 1,
    firstPageUrl: dashboardFaviconWarmupDebugSummary?.firstPageUrl || String(pageUrl || ''),
    firstError: dashboardFaviconWarmupDebugSummary?.firstError || getDashboardFaviconErrorSummary(error)
  }
  if (dashboardFaviconDebugSummaryTimer || typeof window === 'undefined') {
    return
  }

  dashboardFaviconDebugSummaryTimer = window.setTimeout(
    () => flushDashboardFaviconWarmupDebugSummary(),
    DASHBOARD_FAVICON_WARMUP_DEBUG_DELAY_MS
  )
}

function flushDashboardFaviconWarmupDebugSummary(): void {
  if (dashboardFaviconDebugSummaryTimer) {
    window.clearTimeout(dashboardFaviconDebugSummaryTimer)
    dashboardFaviconDebugSummaryTimer = 0
  }
  const summary = dashboardFaviconWarmupDebugSummary
  dashboardFaviconWarmupDebugSummary = null
  if (!summary || !isDashboardFaviconDebugEnabled()) {
    return
  }

  console.debug?.('[Curator] Dashboard favicon warmup skipped', {
    count: summary.skipped,
    sampleUrl: summary.firstPageUrl,
    sampleError: summary.firstError
  })
}

function getDashboardFaviconErrorSummary(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error || 'unknown error')
}

function logDashboardFaviconDebug(message: string, payload: unknown): void {
  if (!isDashboardFaviconDebugEnabled()) {
    return
  }
  console.debug?.(message, payload)
}

function isDashboardFaviconDebugEnabled(): boolean {
  try {
    const globalFlags = globalThis as {
      __CURATOR_DASHBOARD_DEBUG__?: boolean
      __CURATOR_PERF__?: boolean
    }
    if (globalFlags.__CURATOR_DASHBOARD_DEBUG__ === true || globalFlags.__CURATOR_PERF__ === true) {
      return true
    }
  } catch {
    // ignore
  }

  try {
    return globalThis.localStorage?.getItem('curator_dashboard_debug') === '1'
  } catch {
    return false
  }
}
