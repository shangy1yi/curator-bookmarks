import {
  BOOKMARKS_BAR_ID,
  NEWTAB_SPEED_DIAL_STATE_MESSAGE_TYPE,
  NEWTAB_TOGGLE_SPEED_DIAL_MESSAGE_TYPE,
  STORAGE_KEYS
} from '../shared/constants.js'
import {
  extractBookmarkData,
  findBookmarksBar
} from '../shared/bookmark-tree.js'
import { getLocalStorage, setLocalStorage } from '../shared/storage.js'
import type { BookmarkRecord, ExtractedBookmarkData, FolderRecord } from '../shared/types.js'
import type {
  BookmarkTagExtraction,
  BookmarkTagIndex,
  BookmarkTagRecord,
  BookmarkTagSource
} from '../shared/bookmark-tags.js'
import type { ContentSnapshotIndex } from '../shared/content-snapshots.js'
import {
  DEFAULT_ICON_SETTINGS,
  ICON_LAYOUT_PRESETS,
  ICON_PRESET_META,
  type IconLayoutPresetKey,
  type IconSettings,
  detectPresetFromValues,
  getEffectiveIconTileWidthPx,
  getFixedIconGridWidthPx,
  getFolderGapPx,
  getIconGapPx,
  getIconPageWidthPx,
  getResponsiveFixedIconColumns,
  getIconRowGapPx,
  normalizeIconSettings
} from './icon-settings.js'
import {
  buildNewTabSearchIndex,
  buildNewTabSourceNavigationItems,
  createMissingFolderView,
  createNewTabPage,
  createStateView,
  buildNewTabPortalOverview,
  collectPortalBookmarkSourceItems,
  createLoadingStateView,
  getPortalQuickAccessItems,
  getNaturalSearchBookmarkSuggestionsFromIndex,
  getNewTabSourceAnchorId,
  getPopupSearchBookmarkSuggestionsFromIndex,
  prepareNewTabSearchIndex,
  getAdaptiveSearchOffsetBounds,
  getAdaptiveSearchWidthBounds,
  getVerticalCenterCollisionOffset,
  normalizeNewTabSearchText,
  resolvePortalPanelLayout,
  type AdaptiveSearchOffsetBounds,
  type PortalOverview,
  type PortalQuickAccessItem,
  resolveNewTabContentState,
  type NewTabPageModule,
  type NewTabSearchIndexEntry,
  type NewTabPreparedSearchIndex,
  type SearchBookmarkSuggestion
} from './content-state.js'
import {
  DEFAULT_FOLDER_SETTINGS,
  DEFAULT_NEW_TAB_FOLDER_TITLE,
  type NewTabFolderSettings,
  findNewTabFolder,
  getDisplayableNewTabSourceFolders,
  getFolderBookmarkCounts,
  normalizeFolderIds,
  normalizeFolderSettings,
  normalizeFolderSettingsWithDefault
} from './folder-settings.js'
import {
  buildChromeFaviconUrl,
  formatFaviconAccentCssRgb,
  getFaviconAccentCacheEntry,
  normalizeFaviconAccentCache,
  removeFaviconAccentCacheEntry,
  selectFaviconAccentColor,
  upsertFaviconAccentCacheEntry,
  type FaviconAccentCache,
  type FaviconAccentColor
} from './favicon-cache.js'
import {
  BACKGROUND_URL_FETCH_TIMEOUT_MS,
  BACKGROUND_URL_MAX_BYTES,
  applyBookmarkMoveOperationsToChildren,
  buildBookmarkOrderAfterInsert,
  buildMinimalBookmarkMoveOperations,
  resolveRestorableBookmarkParentId,
  resolveBookmarkDragInsertIndex,
  type BookmarkMoveOperation,
  type BookmarkDragSlotRectLike,
  validateBackgroundBlobSize,
  validateBackgroundContentLength
} from './interactions.js'
import {
  DEFAULT_ENABLED_SEARCH_ENGINE_IDS,
  SEARCH_ENGINE_CONFIG_BY_ID,
  SEARCH_MULTI_OPEN_LIMIT,
  buildSearchEngineUrl,
  normalizeEnabledSearchEngineIds,
  normalizeSearchEngineId,
  planSearchOpenTargets,
  type SearchEngineId
} from './search-engines.js'
import {
  DEFAULT_TIME_SETTINGS,
  formatClockDate,
  formatClockDateTime,
  formatClockPeriod,
  formatClockTime,
  formatClockTimeDateTime,
  getClockAriaLabel,
  getClockUpdateDelay,
  normalizeTimeSettings,
  type NewTabTimeSettings
} from './time-settings.js'
import {
  buildNewTabBookmarkHealth,
  hasActionableBookmarkHealth
} from './bookmark-health.js'
import {
  buildCommandPaletteItems,
  shouldOpenDashboardFromKeydown,
  type CommandPaletteItem
} from './command-palette.js'
import {
  buildNewTabModuleSettingRows,
  DEFAULT_NEW_TAB_MODULE_SETTINGS,
  normalizeNewTabModuleSettings,
  type NewTabModuleSettingKey,
  type NewTabModuleSettings
} from './module-settings.js'
import {
  buildSpeedDialItems,
  createSpeedDialEmptyState,
  getSpeedDialPinActionCopy,
  isSpeedDialBookmarkPinned
} from './speed-dial.js'
import {
  getActiveNewTabWorkspace,
  normalizeNewTabWorkspaceSettings,
  setActiveNewTabWorkspace,
  toggleNewTabWorkspacePin,
  updateNewTabWorkspace,
  type NewTabWorkspaceSettings
} from './workspace-settings.js'
const FAVICON_SIZE = 64
const MOTION_CLOSE_TOKEN = 'motionCloseToken'
const FAVICON_COLOR_SAMPLE_SIZE = 32
const CUSTOM_ICON_MAX_BYTES = 2 * 1024 * 1024
const BOOKMARK_DRAG_LONG_PRESS_MS = 320
const FOLDER_DRAG_LONG_PRESS_MS = BOOKMARK_DRAG_LONG_PRESS_MS
const SETTINGS_SAVE_DEBOUNCE_MS = 260
const FAVICON_ACCENT_SAVE_DEBOUNCE_MS = 900
const EAGER_FAVICON_LIMIT = 40
const HIGH_PRIORITY_FAVICON_LIMIT = 12
const FAVICON_ACCENT_EXTRACTION_INITIAL_BUDGET = 48
const BACKGROUND_MEDIA_DB_NAME = 'curatorNewTabBackgroundMedia'
const BACKGROUND_MEDIA_STORE = 'media'
const BACKGROUND_URL_CACHE_KEY = 'urlImage'
const BACKGROUND_URL_CACHE_MAX_DIMENSION = 2560
const BACKGROUND_URL_CACHE_QUALITY = 0.86
const BACKGROUND_IMAGE_READY_TIMEOUT_MS = 2200
const BACKGROUND_VIDEO_READY_TIMEOUT_MS = 2800
const DEFAULT_BACKGROUND_SETTINGS = {
  type: 'color',
  color: '#000000',
  imageName: '',
  videoName: '',
  url: '',
  maskEnabled: false,
  maskStyle: 'dark',
  maskBlur: 12
}
const SUPPORTED_BACKGROUND_TYPES = new Set(['image', 'video', 'urls', 'color'])
const SUPPORTED_BACKGROUND_MASK_STYLES = new Set(['dark', 'frosted', 'light'])
const DEFAULT_SEARCH_SETTINGS = {
  enabled: true,
  openInNewTab: false,
  engine: 'google' as SearchEngineId,
  enabledEngines: DEFAULT_ENABLED_SEARCH_ENGINE_IDS,
  placeholder: '搜索网页或书签',
  width: 34,
  height: 34,
  offsetY: 0,
  background: 30
}
const SEARCH_OFFSET_BOUNDS_FALLBACK: AdaptiveSearchOffsetBounds = { min: -32, max: 72 }
const SEARCH_OFFSET_ABSOLUTE_MIN = -240
const SEARCH_OFFSET_ABSOLUTE_MAX = 240
const SEARCH_WIDTH_BOUNDS_FALLBACK = { min: 16, max: 72 }
const NEWTAB_LAYOUT_SAFE_GAP = 12

type MotionCleanup = () => void | Promise<void>

function prefersReducedMotion(): boolean {
  return Boolean(
    typeof window !== 'undefined' &&
      'matchMedia' in window &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function waitForMotionEnd(element: Element, timeoutMs = 260): Promise<void> {
  if (prefersReducedMotion()) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    let resolved = false
    let timeoutId = 0

    let finishFromEvent: (event: Event) => void
    const finish = () => {
      if (resolved) {
        return
      }
      resolved = true
      window.clearTimeout(timeoutId)
      element.removeEventListener('animationend', finishFromEvent)
      element.removeEventListener('transitionend', finishFromEvent)
      resolve()
    }
    finishFromEvent = (event: Event) => {
      if (event.target === element) {
        finish()
      }
    }

    element.addEventListener('animationend', finishFromEvent)
    element.addEventListener('transitionend', finishFromEvent)
    timeoutId = window.setTimeout(finish, timeoutMs)
  })
}

function cancelExitMotion(element: Element, closingClass = 'is-closing'): void {
  if (element instanceof HTMLElement) {
    delete element.dataset[MOTION_CLOSE_TOKEN]
  }
  element.classList.remove(closingClass)
}

async function closeWithExitMotion(
  element: Element,
  closingClass: string,
  removeOrHide: MotionCleanup,
  timeoutMs = 260
): Promise<void> {
  if (prefersReducedMotion()) {
    cancelExitMotion(element, closingClass)
    await removeOrHide()
    return
  }

  const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  if (element instanceof HTMLElement) {
    element.dataset[MOTION_CLOSE_TOKEN] = token
  }
  element.classList.add(closingClass)

  await waitForMotionEnd(element, timeoutMs)

  if (
    element instanceof HTMLElement &&
    element.dataset[MOTION_CLOSE_TOKEN] !== token
  ) {
    return
  }

  cancelExitMotion(element, closingClass)
  await removeOrHide()
}
const SEARCH_SUGGESTION_LIMIT = 6
const SEARCH_SUGGESTION_DEBOUNCE_MS = 80
const SEARCH_SUGGESTION_CACHE_LIMIT = 24

function getBookmarkTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getTree((tree) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(tree)
    })
  })
}

async function moveBookmarkLazy(
  ...args: Parameters<typeof import('../shared/bookmarks-api.js').moveBookmark>
): ReturnType<typeof import('../shared/bookmarks-api.js').moveBookmark> {
  const { moveBookmark } = await import('../shared/bookmarks-api.js')
  return moveBookmark(...args)
}

async function updateBookmarkLazy(
  ...args: Parameters<typeof import('../shared/bookmarks-api.js').updateBookmark>
): ReturnType<typeof import('../shared/bookmarks-api.js').updateBookmark> {
  const { updateBookmark } = await import('../shared/bookmarks-api.js')
  return updateBookmark(...args)
}

async function createBookmarkLazy(
  ...args: Parameters<typeof import('../shared/bookmarks-api.js').createBookmark>
): ReturnType<typeof import('../shared/bookmarks-api.js').createBookmark> {
  const { createBookmark } = await import('../shared/bookmarks-api.js')
  return createBookmark(...args)
}

async function deleteBookmarkToRecycleLazy(
  ...args: Parameters<typeof import('../shared/recycle-bin.js').deleteBookmarkToRecycle>
): ReturnType<typeof import('../shared/recycle-bin.js').deleteBookmarkToRecycle> {
  const { deleteBookmarkToRecycle } = await import('../shared/recycle-bin.js')
  return deleteBookmarkToRecycle(...args)
}

async function removeRecycleEntryLazy(
  ...args: Parameters<typeof import('../shared/recycle-bin.js').removeRecycleEntry>
): ReturnType<typeof import('../shared/recycle-bin.js').removeRecycleEntry> {
  const { removeRecycleEntry } = await import('../shared/recycle-bin.js')
  return removeRecycleEntry(...args)
}

const BOOKMARK_TILE_INITIAL_RENDER_LIMIT = 160
const BOOKMARK_TILE_RENDER_CHUNK_SIZE = 80
const BOOKMARK_CHANGE_REFRESH_DEBOUNCE_MS = 120
const QUICK_ACCESS_ITEM_LIMIT = 8
const ACTIVITY_RECORD_LIMIT = 160
const DASHBOARD_FRAME_READY_TIMEOUT_MS = 12000
const DEFAULT_GENERAL_SETTINGS = {
  hideSettingsTrigger: false,
  showPortalOverview: true,
  showQuickAccess: true,
  showSourceNavigation: true,
  openBookmarksInNewTab: false
}
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

interface NewTabFolderSection {
  id: string
  sourceId: string
  title: string
  path: string
  node: chrome.bookmarks.BookmarkTreeNode
  bookmarks: chrome.bookmarks.BookmarkTreeNode[]
  directBookmarkCount: number
  totalBookmarkCount: number
}

interface NewTabFolderCandidate {
  id: string
  title: string
  path: string
  normalizedTitle: string
  normalizedPath: string
  directBookmarkCount: number
  totalBookmarkCount: number
}

interface NewTabActivityRecord {
  bookmarkId: string
  title: string
  url: string
  openCount: number
  firstOpenedAt: number
  lastOpenedAt: number
}

interface NewTabActivityState {
  pinnedIds: string[]
  records: Record<string, NewTabActivityRecord>
}

interface QuickAccessItem {
  id: string
  title: string
  url: string
  detail: string
  badge: string
  reason: PortalQuickAccessItem['reason']
  bookmark: chrome.bookmarks.BookmarkTreeNode
}

type MenuActionIcon = 'trash' | 'refresh' | 'save' | 'plus' | 'copy' | 'pin'
type SettingsSaveState = 'idle' | 'saving' | 'saved' | 'error'
type SettingsDrawerSection = 'folder' | 'workspaces'

interface LastDeletedBookmarkState {
  bookmark: chrome.bookmarks.BookmarkTreeNode
  recycleId: string
  deletedAt: number
  customIcon?: string
}

const state = {
  loading: true,
  creatingFolder: false,
  error: '',
  rootNode: null as chrome.bookmarks.BookmarkTreeNode | null,
  folderData: null as ExtractedBookmarkData | null,
  bookmarkTagIndex: null as BookmarkTagIndex | null,
  searchSnapshotIndex: null as ContentSnapshotIndex | null,
  folderNodeMap: new Map<string, chrome.bookmarks.BookmarkTreeNode>(),
  folderNode: null as chrome.bookmarks.BookmarkTreeNode | null,
  folderSections: [] as NewTabFolderSection[],
  bookmarks: [] as chrome.bookmarks.BookmarkTreeNode[],
  bookmarkMap: new Map<string, chrome.bookmarks.BookmarkTreeNode>(),
  allBookmarks: [] as chrome.bookmarks.BookmarkTreeNode[],
  allBookmarkMap: new Map<string, chrome.bookmarks.BookmarkTreeNode>(),
  searchIndex: [] as NewTabSearchIndexEntry[],
  preparedSearchIndex: prepareNewTabSearchIndex([]) as NewTabPreparedSearchIndex,
  activeMenuBookmarkId: '',
  menuX: 0,
  menuY: 0,
  editTitle: '',
  editUrl: '',
  menuBusy: false,
  menuError: '',
  menuStatus: '',
  editIconMode: 'website',
  pendingCustomIconDataUrl: '',
  pendingDeleteBookmarkId: '',
  lastDeletedBookmark: null as LastDeletedBookmarkState | null,
  deleteToastStatus: '',
  deleteToastBusy: false,
  addMenuOpen: false,
  addMenuExpanded: false,
  addFolderId: '',
  addMenuX: 0,
  addMenuY: 0,
  addTitle: '',
  addUrl: '',
  addMenuBusy: false,
  addMenuError: '',
  customIcons: {} as Record<string, string>,
  faviconAccentCache: {} as FaviconAccentCache,
  backgroundUrlCacheBusy: false,
  backgroundUrlCacheStatus: '',
  backgroundStatus: '',
  backgroundStatusTone: 'info' as 'info' | 'success' | 'warning' | 'error',
  draggingBookmarkId: '',
  dragPointerId: 0,
  dragLongPressTimer: 0,
  dragClientX: 0,
  dragClientY: 0,
  dragOffsetX: 0,
  dragOffsetY: 0,
  draggingBookmarkFolderId: '',
  dragOriginalOrderIds: [] as string[],
  dragPendingInsertIndex: -1,
  dragSuppressClick: false,
  draggingFolderId: '',
  folderDragPointerId: 0,
  folderDragLongPressTimer: 0,
  folderDragClientX: 0,
  folderDragClientY: 0,
  folderDragOffsetX: 0,
  folderDragOffsetY: 0,
  folderDragOriginalOrderIds: [] as string[],
  folderDragOriginalSections: [] as NewTabFolderSection[],
  folderDragSuppressClick: false,
  reorderingBookmarks: false,
  selfBookmarkMoveIds: new Set<string>(),
  selfBookmarkMoveSuppressUntil: 0,
  bookmarkReorderError: '',
  folderReorderStatus: '',
  folderReorderStatusTone: 'success' as 'success' | 'error',
  backgroundSettings: { ...DEFAULT_BACKGROUND_SETTINGS },
  searchSettings: { ...DEFAULT_SEARCH_SETTINGS },
  iconSettings: { ...DEFAULT_ICON_SETTINGS },
  generalSettings: { ...DEFAULT_GENERAL_SETTINGS },
  folderSettings: { ...DEFAULT_FOLDER_SETTINGS } as NewTabFolderSettings,
  moduleSettings: { ...DEFAULT_NEW_TAB_MODULE_SETTINGS } as NewTabModuleSettings,
  workspaceSettings: normalizeNewTabWorkspaceSettings(null) as NewTabWorkspaceSettings,
  commandPaletteOpen: false,
  commandPaletteQuery: '',
  commandPaletteActiveIndex: 0,
  activity: {
    pinnedIds: [],
    records: {}
  } as NewTabActivityState,
  folderCandidatesExpanded: false,
  folderCandidateQuery: '',
  folderCandidateActiveId: '',
  timeSettings: { ...DEFAULT_TIME_SETTINGS } as NewTabTimeSettings,
  settingsSaveState: 'idle' as SettingsSaveState,
  settingsSaveMessage: '',
  dashboardOpen: false,
  dashboardFrameLoaded: false,
  dashboardFrameReady: false,
  dashboardFrameError: '',
  searchOffsetBounds: { ...SEARCH_OFFSET_BOUNDS_FALLBACK } as AdaptiveSearchOffsetBounds,
  searchWidthBounds: { ...SEARCH_WIDTH_BOUNDS_FALLBACK },
  faviconRefreshTokens: new Map<string, number>()
}

const root = document.getElementById('newtab-root')
const dashboardTrigger = document.getElementById('newtab-dashboard-trigger')
const dashboardOverlay = document.getElementById('newtab-dashboard-overlay')
const dashboardFrame = document.getElementById('newtab-dashboard-frame') as HTMLIFrameElement | null
const dashboardFallback = document.getElementById('newtab-dashboard-fallback')
const dashboardFallbackCopy = document.getElementById('newtab-dashboard-fallback-copy')
const settingsTrigger = document.getElementById('newtab-settings-trigger')
const settingsDrawer = document.getElementById('newtab-settings-drawer')
const settingsBackdrop = document.getElementById('newtab-settings-backdrop')
const settingsClose = document.getElementById('newtab-settings-close')
let clockTimer = 0
let backgroundApplyToken = 0
let activeBackgroundObjectUrl = ''
let lastAppliedBackgroundMediaSignature = ''
let bookmarkDragGhost: HTMLElement | null = null
let bookmarkDragGhostFrame = 0
let folderDragGhost: HTMLElement | null = null
let folderDragGhostFrame = 0
let resizeLayoutFrame = 0
let verticalCenterCollisionFrame = 0
let deferredRenderFrame = 0
let bookmarkTileRenderVersion = 0
let settingsDrawerReturnFocusElement: HTMLElement | null = null
let deferredRenderClockUpdate = false
let searchSettingsSaveTimer = 0
let searchSettingsSettleTimer = 0
let iconSettingsSaveTimer = 0
let faviconAccentSaveTimer = 0
let timeSettingsSaveTimer = 0
let settingsSaveStatusTimer = 0
let folderReorderStatusTimer = 0
let bookmarkChangeRefreshTimer = 0
let bookmarkChangeRefreshInFlight = false
let bookmarkChangeRefreshQueued = false
let dashboardFrameReadyTimeout = 0
let preloadedBackgroundSettings: typeof DEFAULT_BACKGROUND_SETTINGS | null = null
let bookmarkDragSlotRects = new Map<string, DOMRect>()
let bookmarkDragSlotOrderIds: string[] = []
let dashboardReturnFocusTarget: HTMLElement | null = null
const backgroundPreloadPromise = preloadBackgroundSettings()

document.addEventListener('DOMContentLoaded', () => {
  bindEvents()
  renderIconPresetCards()
  void backgroundPreloadPromise
  void refreshNewTab()
})

function bindEvents(): void {
  bindGeneralSettingsEvents()
  bindFolderSettingsEvents()
  bindBackgroundSettingsEvents()
  bindSearchSettingsEvents()
  bindIconSettingsEvents()
  bindTimeSettingsEvents()
  bindSettingsRangeVisuals()
  dashboardTrigger?.addEventListener('click', (event) => {
    event.preventDefault()
    openDashboardRoute()
  })
  dashboardFrame?.addEventListener('error', () => {
    setDashboardFrameError('书签仪表盘加载失败。你可以返回新标签页，或重试打开仪表盘。')
  })
  dashboardFallback?.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }

    const actionButton = target.closest<HTMLElement>('[data-dashboard-fallback-action]')
    const action = actionButton?.getAttribute('data-dashboard-fallback-action')
    if (action === 'return') {
      closeDashboardRoute()
      return
    }
    if (action === 'retry') {
      retryDashboardFrame()
    }
  })
  window.addEventListener('hashchange', syncDashboardRoute)
  window.addEventListener('message', handleDashboardMessage)
  syncDashboardRoute()
  settingsTrigger?.addEventListener('click', () => {
    openSettingsDrawer()
  })
  settingsClose?.addEventListener('click', closeSettingsDrawer)
  settingsBackdrop?.addEventListener('click', closeSettingsDrawer)
  document.addEventListener('keydown', handleDocumentKeydown)
  document.addEventListener('pointerdown', (event) => {
    const target = event.target
    if (!(target instanceof Element) || (!state.activeMenuBookmarkId && !state.addMenuOpen)) {
      return
    }

    if (
      target.closest('.bookmark-edit-menu') ||
      target.closest('.bookmark-add-menu') ||
      target.closest('.newtab-delete-toast') ||
      target.closest('[data-bookmark-id]')
    ) {
      return
    }

    closeBookmarkMenu()
    closeAddBookmarkMenu()
  })
  window.addEventListener('resize', () => {
    closeBookmarkMenu()
    closeAddBookmarkMenu()
    cancelBookmarkDrag()
    cancelFolderDrag()
    if (!resizeLayoutFrame) {
      resizeLayoutFrame = window.requestAnimationFrame(() => {
        resizeLayoutFrame = 0
        render()
        updateClockText()
      })
    }
  })

  root?.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }

    const addButton = target.closest('[data-add-bookmark-folder-id]')
    if (addButton instanceof HTMLElement) {
      event.preventDefault()
      const folderId = String(addButton.dataset.addBookmarkFolderId || '').trim()
      openAddBookmarkMenuForElement(addButton, folderId)
      return
    }

    if (
      (state.dragSuppressClick && target.closest('[data-bookmark-id]')) ||
      (state.folderDragSuppressClick && target.closest('[data-folder-drag-handle]'))
    ) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
  })

  document.body.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }

    if (target.closest('[data-undo-delete]')) {
      event.preventDefault()
      void undoLastDeletedBookmark()
      return
    }

    if (target.closest('[data-open-recycle]')) {
      event.preventDefault()
      openRecycleBin()
      return
    }
  })
  root?.addEventListener('pointerdown', handleFolderPointerDown)
  root?.addEventListener('pointerdown', handleBookmarkPointerDown)
  window.addEventListener('pointermove', handleBookmarkPointerMove)
  window.addEventListener('pointermove', handleFolderPointerMove)
  window.addEventListener('pointerup', (event) => {
    void finishBookmarkDrag(event)
    void finishFolderDrag(event)
  })
  window.addEventListener('pointercancel', () => {
    cancelBookmarkDrag({ keepSuppressClick: true })
    cancelFolderDrag({ keepSuppressClick: true })
  })
  root?.addEventListener('contextmenu', (event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }

    if (
      state.draggingBookmarkId ||
      state.dragSuppressClick ||
      state.draggingFolderId ||
      state.folderDragSuppressClick
    ) {
      event.preventDefault()
      return
    }

    const bookmarkTarget = target.closest('[data-bookmark-id]')
    if (bookmarkTarget instanceof HTMLElement) {
      event.preventDefault()
      closeAddBookmarkMenu({ animate: false })
      openBookmarkMenu(
        String(bookmarkTarget.dataset.bookmarkId || ''),
        event.clientX,
        event.clientY
      )
      return
    }

    if (target.closest('.newtab-search')) {
      return
  }

  event.preventDefault()
  closeBookmarkMenu({ animate: false })
  openAddBookmarkMenu(event.clientX, event.clientY)
})

  chrome.bookmarks?.onCreated?.addListener(handleBookmarksChanged)
  chrome.bookmarks?.onRemoved?.addListener(handleBookmarksChanged)
  chrome.bookmarks?.onChanged?.addListener(handleBookmarksChanged)
  chrome.bookmarks?.onMoved?.addListener(handleBookmarkMoved)

  window.clearTimeout(clockTimer)
  scheduleClockTick()
}

function bindSettingsRangeVisuals(): void {
  for (const input of document.querySelectorAll<HTMLInputElement>('.setting-range')) {
    input.addEventListener('input', () => {
      updateSettingRangeVisual(input)
    })
    updateSettingRangeVisual(input)
  }
}

function updateAllSettingRangeVisuals(): void {
  for (const input of document.querySelectorAll<HTMLInputElement>('.setting-range')) {
    updateSettingRangeVisual(input)
  }
}

function updateSettingRangeVisual(input: HTMLInputElement): void {
  const min = Number(input.min || 0)
  const max = Number(input.max || 100)
  const value = Number(input.value || min)
  const progress = max > min
    ? ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100
    : 0
  input.style.setProperty('--range-progress', `${progress}%`)
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (state.commandPaletteOpen) {
    handleCommandPaletteKeydown(event)
    return
  }

  if (event.key === 'Tab' && trapDashboardOverlayFocus(event)) {
    return
  }

  if (event.key === 'Tab' && trapSettingsDrawerFocus(event)) {
    return
  }

  if (event.key === 'Escape') {
    if (state.dashboardOpen) {
      event.preventDefault()
      closeDashboardRoute()
      return
    }
    if (isSettingsDrawerOpen()) {
      event.preventDefault()
      closeSettingsDrawer()
    }
    closeBookmarkMenu()
    closeAddBookmarkMenu()
    cancelFolderDrag()
    return
  }

  if (shouldOpenDashboardFromKeydown(event)) {
    event.preventDefault()
    openDashboardRoute()
    return
  }

  if (!shouldFocusSearchFromKeydown(event)) {
    return
  }

  const input = document.querySelector<HTMLInputElement>('.newtab-search-input')
  if (!input) {
    return
  }

  event.preventDefault()
  input.focus()

  if (event.key === '/') {
    input.select()
    return
  }

  if (event.key.length === 1) {
    input.value = event.key
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }
}

function shouldFocusSearchFromKeydown(event: KeyboardEvent): boolean {
  if (
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    !state.searchSettings.enabled ||
    state.draggingBookmarkId ||
    state.draggingFolderId ||
    state.activeMenuBookmarkId ||
    state.addMenuOpen ||
    document.body.classList.contains('settings-open')
  ) {
    return false
  }

  const activeElement = document.activeElement
  if (
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement ||
    activeElement instanceof HTMLSelectElement ||
    activeElement instanceof HTMLButtonElement ||
    activeElement instanceof HTMLAnchorElement ||
    activeElement?.getAttribute('contenteditable') === 'true'
  ) {
    return false
  }

  return event.key === '/'
}

function bindTimeSettingsEvents(): void {
  document.getElementById('time-enabled')?.addEventListener('change', handleTimeSettingsChange)
  document.getElementById('time-show-seconds')?.addEventListener('change', handleTimeSettingsChange)
  document.getElementById('time-hour12')?.addEventListener('change', handleTimeSettingsChange)
  document.getElementById('time-date-format')?.addEventListener('change', handleTimeSettingsChange)
  document.getElementById('time-time-zone')?.addEventListener('change', handleTimeSettingsChange)
  document.getElementById('time-display-mode')?.addEventListener('change', handleTimeSettingsChange)
  document.getElementById('time-density')?.addEventListener('change', handleTimeSettingsChange)
  document.getElementById('time-clock-size')?.addEventListener('input', handleTimeSettingsChange)
}

function bindBackgroundSettingsEvents(): void {
  document.getElementById('background-type')?.addEventListener('change', handleBackgroundSettingsChange)
  document.getElementById('background-color')?.addEventListener('input', handleBackgroundSettingsChange)
  document.getElementById('background-url')?.addEventListener('input', handleBackgroundSettingsChange)
  document.getElementById('background-mask-enabled')?.addEventListener('change', handleBackgroundSettingsChange)
  document.getElementById('background-mask-style')?.addEventListener('change', handleBackgroundSettingsChange)
  document.getElementById('background-mask-blur')?.addEventListener('input', handleBackgroundSettingsChange)
  document.getElementById('background-image-picker')?.addEventListener('click', () => {
    const input = document.getElementById('background-image-file')
    if (input instanceof HTMLInputElement) {
      input.click()
    }
  })
  document.getElementById('background-video-picker')?.addEventListener('click', () => {
    const input = document.getElementById('background-video-file')
    if (input instanceof HTMLInputElement) {
      input.click()
    }
  })
  document.getElementById('background-image-file')?.addEventListener('change', (event) => {
    void handleBackgroundFileChange('image', event)
  })
  document.getElementById('background-video-file')?.addEventListener('change', (event) => {
    void handleBackgroundFileChange('video', event)
  })
}

function bindSearchSettingsEvents(): void {
  document.getElementById('search-enabled')?.addEventListener('change', handleSearchSettingsChange)
  document.getElementById('search-open-new-tab')?.addEventListener('change', handleSearchSettingsChange)
  document.getElementById('search-engine')?.addEventListener('change', handleSearchSettingsChange)
  document.querySelectorAll<HTMLInputElement>('[data-search-engine-toggle]').forEach((input) => {
    input.addEventListener('change', handleSearchSettingsChange)
  })
  document.getElementById('search-placeholder')?.addEventListener('input', handleSearchSettingsChange)
  document.getElementById('search-width')?.addEventListener('input', handleSearchSettingsPreview)
  document.getElementById('search-height')?.addEventListener('input', handleSearchSettingsPreview)
  document.getElementById('search-offset-y')?.addEventListener('input', handleSearchSettingsPreview)
  document.getElementById('search-background')?.addEventListener('input', handleSearchSettingsPreview)
  document.getElementById('search-width')?.addEventListener('change', handleSearchSettingsCommit)
  document.getElementById('search-height')?.addEventListener('change', handleSearchSettingsCommit)
  document.getElementById('search-offset-y')?.addEventListener('change', handleSearchSettingsCommit)
  document.getElementById('search-background')?.addEventListener('change', handleSearchSettingsCommit)
}

function bindIconSettingsEvents(): void {
  document.getElementById('icon-page-width')?.addEventListener('input', handleIconSettingsChange)
  document.getElementById('icon-tile-width')?.addEventListener('input', handleIconSettingsChange)
  document.getElementById('icon-shell-size')?.addEventListener('input', handleIconSettingsChange)
  document.getElementById('icon-column-gap')?.addEventListener('input', handleIconSettingsChange)
  document.getElementById('icon-row-gap')?.addEventListener('input', handleIconSettingsChange)
  document.getElementById('icon-folder-gap')?.addEventListener('input', handleIconSettingsChange)
  document.getElementById('icon-columns')?.addEventListener('input', handleIconSettingsChange)
  document.getElementById('icon-vertical-center')?.addEventListener('change', handleIconSettingsChange)
  document.getElementById('icon-show-titles')?.addEventListener('change', handleIconSettingsChange)
  document.getElementById('icon-layout-control')?.addEventListener('click', handleIconLayoutModeClick)
  document.getElementById('icon-title-lines-control')?.addEventListener('click', handleIconTitleLinesClick)
  document.getElementById('icon-advanced-toggle')?.addEventListener('click', toggleIconAdvanced)
  document.getElementById('icon-reset-defaults')?.addEventListener('click', resetIconSettingsToDefaults)
  document.getElementById('icon-preset-row')?.addEventListener('click', handlePresetCardClick)
}

function bindGeneralSettingsEvents(): void {
  document
    .getElementById('general-hide-settings-trigger')
    ?.addEventListener('change', handleGeneralSettingsChange)
  document
    .getElementById('general-show-overview')
    ?.addEventListener('change', handleGeneralSettingsChange)
  document
    .getElementById('general-show-quick-access')
    ?.addEventListener('change', handleGeneralSettingsChange)
  document
    .getElementById('general-open-bookmarks-new-tab')
    ?.addEventListener('change', handleGeneralSettingsChange)
}

function bindFolderSettingsEvents(): void {
  document
    .getElementById('folder-hide-names')
    ?.addEventListener('change', handleFolderSettingsChange)
  document
    .getElementById('folder-show-source-navigation')
    ?.addEventListener('change', handleGeneralSettingsChange)
  document
    .getElementById('folder-candidates-toggle')
    ?.addEventListener('click', toggleFolderCandidates)
  document
    .getElementById('folder-candidate-search')
    ?.addEventListener('input', handleFolderCandidateSearch)
  document
    .getElementById('folder-candidate-search')
    ?.addEventListener('keydown', handleFolderCandidateSearchKeydown)
  document
    .getElementById('folder-candidate-list')
    ?.addEventListener('click', handleFolderCandidateClick)
  document
    .getElementById('folder-candidate-list')
    ?.addEventListener('keydown', handleFolderCandidateListKeydown)
  document
    .getElementById('folder-candidate-list')
    ?.addEventListener('focusin', handleFolderCandidateFocus)
  document
    .getElementById('folder-selected-list')
    ?.addEventListener('click', handleSelectedFolderClick)
  document
    .getElementById('workspace-settings-list')
    ?.addEventListener('click', handleWorkspaceSettingsClick)
  document
    .getElementById('workspace-settings-list')
    ?.addEventListener('input', handleWorkspaceSettingsInput)
  document
    .getElementById('newtab-speed-dial-setting')
    ?.addEventListener('change', handleModuleSettingsChange)
  document
    .getElementById('newtab-health-setting')
    ?.addEventListener('change', handleModuleSettingsChange)
}

function handleGeneralSettingsChange(): void {
  state.generalSettings = readGeneralSettingsFromControls()
  void saveGeneralSettings().catch((error) => {
    console.warn('新标签页通用设置保存失败。', error)
  })
  syncGeneralSettingsControls()
  applyGeneralSettings()
  render()
  updateClockText()
}

function handleFolderSettingsChange(): void {
  state.folderSettings = readFolderSettingsFromControls()
  void saveFolderSettings().catch((error) => {
    console.warn('新标签页文件夹设置保存失败。', error)
  })
  syncFolderSettingsControls()
  applyFolderSettings()
  render()
  updateClockText()
}

function toggleFolderCandidates(): void {
  state.folderCandidatesExpanded = !state.folderCandidatesExpanded
  syncFolderSettingsControls()
}

function handleFolderCandidateSearch(event: Event): void {
  const target = event.target
  state.folderCandidateQuery = target instanceof HTMLInputElement ? target.value : ''
  state.folderCandidateActiveId = ''
  syncFolderSettingsControls()
}

function handleFolderCandidateSearchKeydown(event: KeyboardEvent): void {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
    return
  }

  const candidates = getFilteredFolderCandidates()
  if (!candidates.length) {
    return
  }

  event.preventDefault()
  focusFolderCandidateOption(event.key === 'ArrowDown' ? 'first' : 'last')
}

function handleFolderCandidateClick(event: Event): void {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  const button = target.closest('[data-folder-candidate-id]')
  if (!(button instanceof HTMLElement)) {
    return
  }

  const folderId = String(button.dataset.folderCandidateId || '').trim()
  if (!folderId) {
    return
  }

  state.folderCandidateActiveId = folderId
  void toggleSelectedFolder(folderId, {
    preserveCandidateScroll: true,
    restoreCandidateFocus: true,
    focusCandidateId: folderId
  })
}

function handleFolderCandidateListKeydown(event: KeyboardEvent): void {
  if (
    event.key !== 'ArrowDown' &&
    event.key !== 'ArrowUp' &&
    event.key !== 'Home' &&
    event.key !== 'End' &&
    event.key !== 'Escape'
  ) {
    return
  }

  event.preventDefault()
  if (event.key === 'Escape') {
    document.getElementById('folder-candidate-search')?.focus()
    return
  }

  if (event.key === 'Home') {
    focusFolderCandidateOption('first')
  } else if (event.key === 'End') {
    focusFolderCandidateOption('last')
  } else {
    focusFolderCandidateOption(event.key === 'ArrowDown' ? 1 : -1)
  }
}

function getFolderCandidateOptionButtons(): HTMLButtonElement[] {
  const candidateList = document.getElementById('folder-candidate-list')
  if (!(candidateList instanceof HTMLElement)) {
    return []
  }

  return [...candidateList.querySelectorAll<HTMLButtonElement>('[data-folder-candidate-id]')]
}

function focusFolderCandidateOptionById(folderId: string): boolean {
  let targetButton: HTMLButtonElement | null = null
  for (const candidateButton of getFolderCandidateOptionButtons()) {
    const isTarget = candidateButton.dataset.folderCandidateId === folderId
    candidateButton.tabIndex = isTarget ? 0 : -1
    if (isTarget) {
      targetButton = candidateButton
    }
  }

  if (!targetButton) {
    return false
  }

  state.folderCandidateActiveId = folderId
  targetButton.focus()
  return true
}

function resolveFolderCandidateActiveId(candidates: NewTabFolderCandidate[]): string {
  if (!candidates.length) {
    state.folderCandidateActiveId = ''
    return ''
  }

  const activeId = candidates.some((folder) => folder.id === state.folderCandidateActiveId)
    ? state.folderCandidateActiveId
    : candidates[0]?.id || ''
  state.folderCandidateActiveId = activeId
  return activeId
}

function syncFolderCandidateOptionTabStops(activeId: string): void {
  for (const candidateButton of getFolderCandidateOptionButtons()) {
    candidateButton.tabIndex = candidateButton.dataset.folderCandidateId === activeId ? 0 : -1
  }
}

function focusFolderCandidateOption(direction: 1 | -1 | 'first' | 'last'): void {
  const buttons = getFolderCandidateOptionButtons()
  if (!buttons.length) {
    return
  }

  const currentIndex = buttons.findIndex((button) => button === document.activeElement)
  let nextIndex = state.folderCandidateActiveId
    ? buttons.findIndex((button) => button.dataset.folderCandidateId === state.folderCandidateActiveId)
    : -1

  if (direction === 'first') {
    nextIndex = 0
  } else if (direction === 'last') {
    nextIndex = buttons.length - 1
  } else if (currentIndex >= 0) {
    nextIndex = (currentIndex + direction + buttons.length) % buttons.length
  } else if (nextIndex < 0) {
    nextIndex = direction > 0 ? 0 : buttons.length - 1
  }

  const button = buttons[Math.max(0, nextIndex)]
  const folderId = String(button?.dataset.folderCandidateId || '')
  if (folderId) {
    focusFolderCandidateOptionById(folderId)
  }
}

function handleFolderCandidateFocus(event: FocusEvent): void {
  const target = event.target
  if (!(target instanceof HTMLElement) || !target.dataset.folderCandidateId) {
    return
  }

  state.folderCandidateActiveId = target.dataset.folderCandidateId
  syncFolderCandidateOptionTabStops(state.folderCandidateActiveId)
}

function handleSelectedFolderClick(event: Event): void {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  const button = target.closest('[data-folder-remove-id]')
  if (!(button instanceof HTMLElement)) {
    return
  }

  const folderId = String(button.dataset.folderRemoveId || '').trim()
  if (!folderId) {
    return
  }

  void removeSelectedFolder(folderId)
}

async function toggleSelectedFolder(
  folderId: string,
  {
    preserveCandidateScroll = false,
    restoreCandidateFocus = false,
    focusCandidateId = ''
  } = {}
): Promise<void> {
  const currentIds = state.folderSettings.selectedFolderIds
  const nextIds = currentIds.includes(folderId)
    ? currentIds.filter((id) => id !== folderId)
    : [...currentIds, folderId]
  await updateSelectedFolders(nextIds, {
    preserveCandidateScroll,
    restoreCandidateFocus,
    focusCandidateId
  })
}

async function removeSelectedFolder(folderId: string): Promise<void> {
  await updateSelectedFolders(
    state.folderSettings.selectedFolderIds.filter((id) => id !== folderId)
  )
}

async function updateSelectedFolders(
  folderIds: string[],
  {
    preserveCandidateScroll = false,
    restoreCandidateFocus = false,
    focusCandidateId = ''
  } = {}
): Promise<void> {
  const candidateList = document.getElementById('folder-candidate-list')
  const previousScrollTop = preserveCandidateScroll && candidateList instanceof HTMLElement
    ? candidateList.scrollTop
    : 0
  const previousSettings = state.folderSettings
  const previousSections = [...state.folderSections]

  state.folderSettings = normalizeFolderSettings({
    ...state.folderSettings,
    selectedFolderIds: folderIds
  })
  state.folderSections = buildNewTabFolderSections(state.rootNode, state.folderSettings)
  refreshDerivedBookmarkState()

  try {
    await saveFolderSettings()
  } catch (error) {
    state.folderSettings = previousSettings
    state.folderSections = previousSections
    refreshDerivedBookmarkState()
    render()
    syncFolderSettingsControls()
    applyFolderSettings()
    updateClockText()
    setSettingsSaveStatus('error', '来源保存失败，已恢复到上次已保存状态')
    console.warn('新标签页来源设置保存失败，已回滚。', error)
    return
  }

  render()
  syncFolderSettingsControls()
  applyFolderSettings()
  updateClockText()

  if (preserveCandidateScroll || restoreCandidateFocus) {
    window.requestAnimationFrame(() => {
      const nextList = document.getElementById('folder-candidate-list')
      if (nextList instanceof HTMLElement) {
        nextList.scrollTop = previousScrollTop
      }
      if (restoreCandidateFocus) {
        focusFolderCandidateOptionById(focusCandidateId || state.folderCandidateActiveId)
      }
    })
  }
}

function handleIconSettingsChange(): void {
  commitIconSettings(readIconSettingsFromControls())
}

function handleIconLayoutModeClick(event: Event): void {
  const target = event.target
  const button = target instanceof Element
    ? target.closest<HTMLElement>('[data-icon-layout-mode]')
    : null
  const layoutMode = button?.dataset.iconLayoutMode
  if (layoutMode !== 'auto' && layoutMode !== 'fixed') {
    return
  }

  commitIconSettings(normalizeIconSettings({
    ...state.iconSettings,
    layoutMode,
    preset: ''
  }))
}

function handleIconTitleLinesClick(event: Event): void {
  const target = event.target
  const button = target instanceof Element
    ? target.closest<HTMLElement>('[data-icon-title-lines]')
    : null
  if (!button || button.getAttribute('aria-disabled') === 'true') {
    return
  }

  commitIconSettings(normalizeIconSettings({
    ...state.iconSettings,
    titleLines: Number(button.dataset.iconTitleLines),
    preset: ''
  }))
}

function handleSearchSettingsChange(): void {
  state.searchSettings = readSearchSettingsFromControls()
  scheduleSearchSettingsSave()
  scheduleRender({ updateClock: true })
  syncSearchSettingsControls()
}

function handleSearchSettingsPreview(): void {
  state.searchSettings = readSearchSettingsFromControls()
  scheduleSearchSettingsSave()
  applySearchSettingsLive()
  syncSearchSettingsControls()
  scheduleSearchSettingsSettle()
}

function handleSearchSettingsCommit(): void {
  state.searchSettings = readSearchSettingsFromControls()
  scheduleSearchSettingsSave()
  scheduleRender({ updateClock: true })
}

function applySearchSettingsLive(): void {
  const settings = state.searchSettings
  const widthBounds = state.searchWidthBounds || SEARCH_WIDTH_BOUNDS_FALLBACK
  const offsetBounds = state.searchOffsetBounds || SEARCH_OFFSET_BOUNDS_FALLBACK
  const slot = root?.querySelector<HTMLElement>('.newtab-search-slot')
  const form = slot?.querySelector<HTMLElement>('.newtab-search')
  const width = clampNumber(settings.width, widthBounds.min, widthBounds.max, DEFAULT_SEARCH_SETTINGS.width)
  const offsetY = clampNumber(settings.offsetY, offsetBounds.min, offsetBounds.max, DEFAULT_SEARCH_SETTINGS.offsetY)

  slot?.style.setProperty('--search-width', `${width}vw`)
  slot?.style.setProperty('--search-height', `${settings.height}px`)
  slot?.style.setProperty('--search-offset-y', `${offsetY}px`)
  form?.style.setProperty('--search-width', `${width}vw`)
  form?.style.setProperty('--search-height', `${settings.height}px`)
  form?.style.setProperty('--search-bg-alpha', String(settings.background / 100))
}

function scheduleSearchSettingsSettle(): void {
  window.clearTimeout(searchSettingsSettleTimer)
  searchSettingsSettleTimer = window.setTimeout(() => {
    searchSettingsSettleTimer = 0
    scheduleAdaptiveNewTabLayoutUpdate()
  }, SETTINGS_SAVE_DEBOUNCE_MS)
}

function handleBackgroundSettingsChange(): void {
  const previousSettings = state.backgroundSettings
  const nextSettings = readBackgroundSettingsFromControls()
  const shouldClearUrlCache = shouldClearBackgroundUrlCache(previousSettings, nextSettings)
  if (shouldClearUrlCache) {
    state.backgroundUrlCacheStatus = ''
  }
  state.backgroundSettings = nextSettings
  setWallpaperPlaceholderColor(nextSettings.color)
  void saveBackgroundSettings().catch((error) => {
    console.warn('新标签页背景设置保存失败。', error)
  })
  syncBackgroundSettingsControls()
  void applyBackgroundSettingsAfterCacheUpdate(shouldClearUrlCache)
}

async function applyBackgroundSettingsAfterCacheUpdate(shouldClearUrlCache: boolean): Promise<void> {
  if (shouldClearUrlCache) {
    await clearBackgroundUrlCache()
  }
  await applyBackgroundSettings()
}

async function handleBackgroundFileChange(
  mediaType: 'image' | 'video',
  event: Event
): Promise<void> {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) {
    return
  }

  const file = input.files?.[0] || null
  input.value = ''
  if (!file) {
    return
  }

  const expectedPrefix = mediaType === 'image' ? 'image/' : 'video/'
  if (!file.type.startsWith(expectedPrefix)) {
    setBackgroundStatus(
      mediaType === 'image'
        ? '文件类型不匹配：请选择图片文件（JPG、PNG、WebP 或 GIF）。'
        : '文件类型不匹配：请选择视频文件（MP4、WebM 或 MOV）。',
      'warning'
    )
    syncBackgroundSettingsControls()
    return
  }

  try {
    const previousSettings = state.backgroundSettings
    setBackgroundStatus('正在保存背景文件...', 'info')
    syncBackgroundSettingsControls()
    await saveBackgroundMedia(mediaType, file)
    state.backgroundSettings = normalizeBackgroundSettings({
      ...state.backgroundSettings,
      type: mediaType,
      imageName: mediaType === 'image' ? file.name : state.backgroundSettings.imageName,
      videoName: mediaType === 'video' ? file.name : state.backgroundSettings.videoName
    })
    await saveBackgroundSettings()
    if (shouldClearBackgroundUrlCache(previousSettings, state.backgroundSettings)) {
      await clearBackgroundUrlCache()
    }
    syncBackgroundSettingsControls()
    await applyBackgroundSettings()
    setBackgroundStatus(
      mediaType === 'image' ? '背景图片已保存。' : '背景视频已保存。',
      'success'
    )
    syncBackgroundSettingsControls()
  } catch (error) {
    setBackgroundStatus(getBackgroundMediaSaveErrorMessage(error), 'error')
    syncBackgroundSettingsControls()
  }
}

function handleTimeSettingsChange(): void {
  state.timeSettings = readTimeSettingsFromControls()
  scheduleTimeSettingsSave()
  scheduleRender({ updateClock: true })
  syncTimeSettingsControls()
  scheduleClockTick()
}

function openSettingsDrawer(options?: { focusFirstControl?: boolean; section?: SettingsDrawerSection }): void {
  const focusFirstControl = options?.focusFirstControl !== false
  settingsDrawerReturnFocusElement = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null
  if (settingsDrawer) {
    cancelExitMotion(settingsDrawer)
  }
  if (settingsBackdrop) {
    cancelExitMotion(settingsBackdrop)
  }
  syncGeneralSettingsControls()
  syncFolderSettingsControls()
  syncBackgroundSettingsControls()
  syncSearchSettingsControls()
  syncIconSettingsControls()
  syncTimeSettingsControls()
  syncNewTabModernSettingsControls()
  syncSettingsSaveStatus()
  updateAllSettingRangeVisuals()
  scheduleAdaptiveNewTabLayoutUpdate()
  settingsDrawer?.classList.add('open')
  settingsBackdrop?.classList.add('open')
  settingsDrawer?.setAttribute('aria-hidden', 'false')
  settingsDrawer?.removeAttribute('inert')
  settingsTrigger?.setAttribute('aria-expanded', 'true')
  document.body.classList.add('settings-open')
  setSettingsModalBackgroundInert(true)
  if (focusFirstControl) {
    window.requestAnimationFrame(() => {
      focusFirstSettingsDrawerControl()
    })
  }
  if (options?.section) {
    window.requestAnimationFrame(() => {
      focusSettingsSection(options.section)
    })
  }
}

function openFolderSourceSettings(): void {
  state.folderCandidatesExpanded = true
  state.folderCandidateQuery = ''
  openSettingsDrawer({ focusFirstControl: false, section: 'folder' })
  syncFolderSettingsControls()
}

function openWorkspaceSettings(): void {
  openSettingsDrawer({ focusFirstControl: false, section: 'workspaces' })
}

function focusSettingsSection(section: SettingsDrawerSection): void {
  const titleIdBySection: Record<SettingsDrawerSection, string> = {
    folder: 'settings-folder-title',
    workspaces: 'settings-workspaces-title'
  }
  const targetSection = document.getElementById(titleIdBySection[section])?.closest('.settings-section')
  targetSection?.scrollIntoView({ block: 'start', behavior: 'smooth' })

  if (section === 'folder') {
    const searchInput = document.getElementById('folder-candidate-search')
    if (searchInput instanceof HTMLInputElement) {
      searchInput.focus()
    }
    return
  }

  const firstControl = targetSection?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
  firstControl?.focus()
}

function closeSettingsDrawer(): void {
  if (!isSettingsDrawerOpen()) {
    return
  }

  settingsDrawer?.classList.remove('open')
  settingsBackdrop?.classList.remove('open')
  settingsDrawer?.classList.add('is-closing')
  settingsBackdrop?.classList.add('is-closing')
  settingsDrawer?.setAttribute('aria-hidden', 'true')
  settingsDrawer?.setAttribute('inert', '')
  settingsTrigger?.setAttribute('aria-expanded', 'false')
  document.body.classList.remove('settings-open')
  setSettingsModalBackgroundInert(false)
  window.setTimeout(() => {
    settingsDrawer?.classList.remove('is-closing')
    settingsBackdrop?.classList.remove('is-closing')
  }, 260)
  restoreSettingsDrawerFocus()
}

function setSettingsModalBackgroundInert(inert: boolean): void {
  const backgroundElements = [
    root,
    settingsTrigger instanceof HTMLElement ? settingsTrigger : null,
    dashboardTrigger instanceof HTMLElement ? dashboardTrigger : null
  ]

  for (const element of backgroundElements) {
    if (!element) {
      continue
    }
    if (inert) {
      element.setAttribute('inert', '')
      element.setAttribute('aria-hidden', 'true')
    } else {
      element.removeAttribute('inert')
      element.removeAttribute('aria-hidden')
    }
  }
}

function isSettingsDrawerOpen(): boolean {
  return document.body.classList.contains('settings-open')
}

function focusFirstSettingsDrawerControl(): void {
  if (!settingsDrawer || !isSettingsDrawerOpen()) {
    return
  }

  const [firstElement] = getFocusableElements(settingsDrawer)
  ;(firstElement || settingsDrawer).focus()
}

function restoreSettingsDrawerFocus(): void {
  const returnElement = settingsDrawerReturnFocusElement
  settingsDrawerReturnFocusElement = null

  if (returnElement?.isConnected && !returnElement.hasAttribute('disabled')) {
    returnElement.focus()
    return
  }

  settingsTrigger?.focus()
}

function trapSettingsDrawerFocus(event: KeyboardEvent): boolean {
  if (!settingsDrawer || !isSettingsDrawerOpen()) {
    return false
  }

  const focusableElements = getFocusableElements(settingsDrawer)
  const firstElement = focusableElements[0] || settingsDrawer
  const lastElement = focusableElements[focusableElements.length - 1] || settingsDrawer
  const activeElement = document.activeElement

  if (!settingsDrawer.contains(activeElement)) {
    event.preventDefault()
    ;(event.shiftKey ? lastElement : firstElement).focus()
    return true
  }

  if (event.shiftKey && activeElement === firstElement) {
    event.preventDefault()
    lastElement.focus()
    return true
  }

  if (!event.shiftKey && activeElement === lastElement) {
    event.preventDefault()
    firstElement.focus()
    return true
  }

  return false
}

function trapDashboardOverlayFocus(event: KeyboardEvent): boolean {
  if (!dashboardOverlay || !state.dashboardOpen) {
    return false
  }

  const focusableElements = getFocusableElements(dashboardOverlay)
  const firstElement = focusableElements[0] || dashboardOverlay
  const lastElement = focusableElements[focusableElements.length - 1] || dashboardOverlay
  const activeElement = document.activeElement

  if (!dashboardOverlay.contains(activeElement)) {
    event.preventDefault()
    ;(event.shiftKey ? lastElement : firstElement).focus()
    return true
  }

  if (event.shiftKey && activeElement === firstElement) {
    event.preventDefault()
    lastElement.focus()
    return true
  }

  if (!event.shiftKey && activeElement === lastElement) {
    event.preventDefault()
    firstElement.focus()
    return true
  }

  return false
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter((element) => {
    return !element.hasAttribute('disabled') &&
      !element.getAttribute('aria-hidden') &&
      element.offsetParent !== null
  })
}

function openBookmarkMenu(bookmarkId: string, clientX: number, clientY: number): void {
  const bookmark = getBookmarkById(bookmarkId)
  if (!bookmark?.url) {
    return
  }

  state.activeMenuBookmarkId = bookmarkId
  state.menuX = clientX
  state.menuY = clientY
  state.editTitle = String(bookmark.title || '').trim() || String(bookmark.url || '')
  state.editUrl = String(bookmark.url || '').trim()
  state.editIconMode = state.customIcons[bookmarkId] ? 'custom' : 'website'
  state.pendingCustomIconDataUrl = ''
  state.pendingDeleteBookmarkId = ''
  state.menuBusy = false
  state.menuError = ''
  state.menuStatus = ''
  renderBookmarkMenu()
}

function openAddBookmarkMenu(clientX: number, clientY: number): void {
  closeBookmarkMenu({ animate: false })
  state.addMenuOpen = true
  state.addMenuExpanded = false
  state.addFolderId = ''
  state.addMenuX = clientX
  state.addMenuY = clientY
  state.addTitle = ''
  state.addUrl = ''
  state.addMenuBusy = false
  state.addMenuError = ''
  renderAddBookmarkMenu()
}

function openAddBookmarkMenuForElement(anchor: HTMLElement, folderId: string): void {
  const rect = anchor.getBoundingClientRect()
  closeBookmarkMenu({ animate: false })
  state.addMenuOpen = true
  state.addMenuExpanded = true
  state.addFolderId = folderId
  state.addMenuX = rect.right
  state.addMenuY = rect.bottom + 8
  state.addTitle = ''
  state.addUrl = ''
  state.addMenuBusy = false
  state.addMenuError = ''
  renderAddBookmarkMenu()
}

function closeBookmarkMenu({ animate = true } = {}): void {
  state.activeMenuBookmarkId = ''
  state.menuBusy = false
  state.menuError = ''
  state.menuStatus = ''
  state.pendingCustomIconDataUrl = ''
  state.pendingDeleteBookmarkId = ''
  const menu = document.querySelector<HTMLElement>('.bookmark-edit-menu')
  if (menu) {
    if (animate) {
      void closeWithExitMotion(menu, 'is-closing', () => menu.remove(), 180)
    } else {
      cancelExitMotion(menu)
      menu.remove()
    }
  }
}

function closeAddBookmarkMenu({ animate = true } = {}): void {
  state.addMenuOpen = false
  state.addMenuExpanded = false
  state.addFolderId = ''
  state.addMenuBusy = false
  state.addMenuError = ''
  const menu = document.querySelector<HTMLElement>('.bookmark-add-menu')
  if (menu) {
    if (animate) {
      void closeWithExitMotion(menu, 'is-closing', () => menu.remove(), 180)
    } else {
      cancelExitMotion(menu)
      menu.remove()
    }
  }
}

function handleBookmarkPointerDown(event: PointerEvent): void {
  if (state.draggingFolderId || state.folderDragLongPressTimer) {
    return
  }

  if (event.pointerType === 'mouse' && event.button !== 0) {
    return
  }

  const target = event.target
  if (!(target instanceof Element) || target.closest('.bookmark-edit-menu')) {
    return
  }

  const bookmarkTarget = target.closest('[data-bookmark-id]')
  if (!(bookmarkTarget instanceof HTMLElement)) {
    return
  }

  const bookmarkId = String(bookmarkTarget.dataset.bookmarkId || '')
  if (!getBookmarkById(bookmarkId)) {
    return
  }
  const folderId = String(bookmarkTarget.dataset.folderId || '').trim()
  if (!folderId) {
    return
  }

  cancelBookmarkDrag({ keepSuppressClick: true })
  state.dragPointerId = event.pointerId
  state.draggingBookmarkId = bookmarkId
  state.draggingBookmarkFolderId = folderId
  state.dragClientX = event.clientX
  state.dragClientY = event.clientY
  try {
    bookmarkTarget.setPointerCapture(event.pointerId)
  } catch {
    // Pointer capture can fail if the browser has already released this pointer.
  }
  state.dragLongPressTimer = window.setTimeout(() => {
    beginBookmarkDrag()
  }, BOOKMARK_DRAG_LONG_PRESS_MS)
}

function beginBookmarkDrag(): void {
  if (!state.draggingBookmarkId || !getBookmarkById(state.draggingBookmarkId)) {
    cancelBookmarkDrag()
    return
  }

  closeBookmarkMenu()
  closeAddBookmarkMenu()
  state.dragLongPressTimer = 0
  state.dragOriginalOrderIds = getActiveBookmarkFolderBookmarks().map((bookmark) => String(bookmark.id))
  state.dragSuppressClick = true
  document.body.classList.add('bookmark-dragging')
  const sourceTile = getActiveDragTile()
  createBookmarkDragGhost(sourceTile)
  captureBookmarkDragLayout()
  sourceTile?.classList.add('dragging')
  document.body.classList.add('bookmark-drag-preview-initializing')
  syncBookmarkDragVisualPreview()
  window.requestAnimationFrame(() => {
    document.body.classList.remove('bookmark-drag-preview-initializing')
  })
}

function handleBookmarkPointerMove(event: PointerEvent): void {
  if (!state.draggingBookmarkId || event.pointerId !== state.dragPointerId) {
    return
  }

  state.dragClientX = event.clientX
  state.dragClientY = event.clientY

  if (state.dragLongPressTimer) {
    return
  }

  event.preventDefault()
  updateBookmarkDragGhost()
  const insertIndex = getBookmarkInsertIndex(event.clientX, event.clientY)
  setBookmarkDragPendingInsertIndex(insertIndex)
}

async function finishBookmarkDrag(event: PointerEvent): Promise<void> {
  if (!state.draggingBookmarkId || event.pointerId !== state.dragPointerId) {
    return
  }

  window.clearTimeout(state.dragLongPressTimer)
  state.dragLongPressTimer = 0

  const wasDragging = Boolean(state.dragOriginalOrderIds.length)
  const folderId = state.draggingBookmarkFolderId
  const originalOrderIds = [...state.dragOriginalOrderIds]
  const pendingInsertIndex = state.dragPendingInsertIndex >= 0
    ? state.dragPendingInsertIndex
    : getBookmarkInsertIndex(event.clientX, event.clientY)
  const finalOrderIds = wasDragging && pendingInsertIndex >= 0
    ? applyDraggedBookmarkInsertInState(pendingInsertIndex)
    : getActiveBookmarkFolderBookmarks().map((bookmark) => String(bookmark.id))
  clearBookmarkDragState({ keepSuppressClick: wasDragging })

  if (!wasDragging) {
    return
  }

  render()
  updateClockText()

  if (areStringArraysEqual(originalOrderIds, finalOrderIds)) {
    return
  }

  await persistBookmarkOrder(folderId, originalOrderIds, finalOrderIds)
}

function cancelBookmarkDrag({ keepSuppressClick = false } = {}): void {
  if (!state.draggingBookmarkId && !state.dragLongPressTimer) {
    return
  }

  window.clearTimeout(state.dragLongPressTimer)
  clearBookmarkDragState({ keepSuppressClick })
  render()
  updateClockText()
}

function clearBookmarkDragState({ keepSuppressClick = false } = {}): void {
  getActiveDragTile()?.classList.remove('dragging')
  state.draggingBookmarkId = ''
  state.dragPointerId = 0
  state.dragLongPressTimer = 0
  state.dragClientX = 0
  state.dragClientY = 0
  state.dragOffsetX = 0
  state.dragOffsetY = 0
  state.draggingBookmarkFolderId = ''
  state.dragOriginalOrderIds = []
  state.dragPendingInsertIndex = -1
  removeBookmarkDragGhost()
  clearBookmarkDragVisualPreview()
  document.body.classList.remove('bookmark-drag-preview-initializing')
  document.body.classList.remove('bookmark-dragging')

  if (keepSuppressClick) {
    state.dragSuppressClick = true
    window.setTimeout(() => {
      state.dragSuppressClick = false
    }, 250)
  } else {
    state.dragSuppressClick = false
  }
}

function createBookmarkDragGhost(sourceTile = getActiveDragTile()): void {
  removeBookmarkDragGhost()

  if (!sourceTile) {
    return
  }

  const rect = sourceTile.getBoundingClientRect()
  const ghost = sourceTile.cloneNode(true) as HTMLElement
  ghost.classList.remove('dragging')
  ghost.classList.add('bookmark-drag-ghost')
  ghost.removeAttribute('href')
  ghost.removeAttribute('data-bookmark-id')
  ghost.removeAttribute('data-folder-id')
  ghost.setAttribute('aria-hidden', 'true')
  copyBookmarkDragGhostVariables(sourceTile, ghost)
  ghost.style.width = `${rect.width}px`
  ghost.style.height = `${rect.height}px`
  ghost.style.visibility = 'hidden'
  bookmarkDragGhost = ghost
  document.body.appendChild(ghost)
  syncBookmarkDragOffsetToGhostIcon(ghost, rect)
  updateBookmarkDragGhost({ immediate: true })
  ghost.style.visibility = ''
}

function copyBookmarkDragGhostVariables(sourceTile: HTMLElement, ghost: HTMLElement): void {
  const sourceStyles = window.getComputedStyle(sourceTile)
  const inheritedVariableNames = [
    '--icon-shell-size',
    '--icon-title-lines',
    '--bookmark-card-rgb',
    '--bookmark-card-bg-alpha',
    '--bookmark-card-border-alpha',
    '--bookmark-card-hover-alpha'
  ]

  for (const variableName of inheritedVariableNames) {
    const value = sourceStyles.getPropertyValue(variableName).trim()
    if (value) {
      ghost.style.setProperty(variableName, value)
    }
  }
}

function syncBookmarkDragOffsetToGhostIcon(ghost: HTMLElement, sourceRect: DOMRect): void {
  const ghostRect = ghost.getBoundingClientRect()
  const iconRect = ghost.querySelector('.bookmark-icon-shell')?.getBoundingClientRect()
  if (iconRect && ghostRect.width && ghostRect.height) {
    state.dragOffsetX = iconRect.left + iconRect.width / 2 - ghostRect.left
    state.dragOffsetY = iconRect.top + iconRect.height / 2 - ghostRect.top
    return
  }

  state.dragOffsetX = sourceRect.width / 2
  state.dragOffsetY = sourceRect.height / 2
}

function getActiveDragTile(): HTMLElement | null {
  if (!state.draggingBookmarkId) {
    return null
  }

  return document.querySelector<HTMLElement>(
    `.bookmark-tile[data-bookmark-id="${CSS.escape(state.draggingBookmarkId)}"]`
  )
}

function updateBookmarkDragGhost({ immediate = false } = {}): void {
  if (immediate) {
    updateBookmarkDragGhostPosition()
    return
  }

  if (bookmarkDragGhostFrame) {
    return
  }

  bookmarkDragGhostFrame = window.requestAnimationFrame(() => {
    bookmarkDragGhostFrame = 0
    updateBookmarkDragGhostPosition()
  })
}

function updateBookmarkDragGhostPosition(): void {
  if (!bookmarkDragGhost) {
    return
  }

  const left = state.dragClientX - state.dragOffsetX
  const top = state.dragClientY - state.dragOffsetY
  bookmarkDragGhost.style.transform = `translate3d(${left}px, ${top}px, 0)`
}

function removeBookmarkDragGhost(): void {
  window.cancelAnimationFrame(bookmarkDragGhostFrame)
  bookmarkDragGhostFrame = 0
  bookmarkDragGhost?.remove()
  bookmarkDragGhost = null
}

function setBookmarkDragPendingInsertIndex(insertIndex: number): void {
  const nextInsertIndex = hasBookmarkInsertChange(insertIndex) ? insertIndex : -1
  if (state.dragPendingInsertIndex === nextInsertIndex) {
    return
  }

  state.dragPendingInsertIndex = nextInsertIndex
  syncBookmarkDragVisualPreview()
}

function getActiveBookmarkFolderSection(): NewTabFolderSection | null {
  if (!state.draggingBookmarkFolderId) {
    return null
  }

  return state.folderSections.find((section) => section.id === state.draggingBookmarkFolderId) || null
}

function getActiveBookmarkFolderBookmarks(): chrome.bookmarks.BookmarkTreeNode[] {
  return getActiveBookmarkFolderSection()?.bookmarks || []
}

function setActiveBookmarkFolderBookmarks(bookmarks: chrome.bookmarks.BookmarkTreeNode[]): void {
  const section = getActiveBookmarkFolderSection()
  if (!section) {
    return
  }

  section.bookmarks = bookmarks
  refreshDerivedBookmarkState()
}

function getBookmarkInsertIndex(clientX: number, clientY: number): number {
  const folderId = state.draggingBookmarkFolderId
  if (!folderId) {
    return -1
  }

  const slots = getBookmarkDragLayoutSlots()
  if (!slots.length) {
    return -1
  }

  return resolveBookmarkDragInsertIndex(
    slots,
    state.draggingBookmarkId,
    getBookmarkDragTargetPoint(clientX, clientY)
  )
}

function hasBookmarkInsertChange(insertIndex: number): boolean {
  if (insertIndex < 0 || !state.draggingBookmarkId) {
    return false
  }

  const currentOrderIds = getActiveBookmarkFolderBookmarks().map((bookmark) => String(bookmark.id))
  const finalOrderIds = buildBookmarkOrderAfterInsert(
    currentOrderIds,
    state.draggingBookmarkId,
    insertIndex
  )
  return !areStringArraysEqual(currentOrderIds, finalOrderIds)
}

function getPreviewBookmarkOrderIds(): string[] {
  const currentOrderIds = getActiveBookmarkFolderBookmarks().map((bookmark) => String(bookmark.id))
  if (state.dragPendingInsertIndex < 0 || !state.draggingBookmarkId) {
    return currentOrderIds
  }

  return buildBookmarkOrderAfterInsert(
    currentOrderIds,
    state.draggingBookmarkId,
    state.dragPendingInsertIndex
  )
}

function captureBookmarkDragLayout(): void {
  bookmarkDragSlotRects = new Map()
  bookmarkDragSlotOrderIds = []
  const grid = getActiveBookmarkGrid()
  if (!grid) {
    return
  }

  for (const tile of grid.querySelectorAll<HTMLElement>(':scope > .bookmark-tile[data-bookmark-id]')) {
    const bookmarkId = String(tile.dataset.bookmarkId || '')
    if (!bookmarkId) {
      continue
    }
    bookmarkDragSlotOrderIds.push(bookmarkId)
    bookmarkDragSlotRects.set(bookmarkId, tile.getBoundingClientRect())
  }
}

function getActiveBookmarkGrid(): HTMLElement | null {
  const section = getActiveBookmarkFolderSection()
  if (!section) {
    return null
  }

  return document.querySelector<HTMLElement>(
    `.bookmark-grid[data-bookmark-grid-folder-id="${CSS.escape(section.id)}"]`
  )
}

function getBookmarkDragLayoutSlots(): BookmarkDragSlotRectLike[] {
  if (bookmarkDragSlotOrderIds.length && bookmarkDragSlotRects.size) {
    return bookmarkDragSlotOrderIds
      .map((bookmarkId) => {
        const rect = bookmarkDragSlotRects.get(bookmarkId)
        return rect ? {
          id: bookmarkId,
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        } : null
      })
      .filter((slot): slot is BookmarkDragSlotRectLike => Boolean(slot))
  }

  const grid = getActiveBookmarkGrid()
  if (!grid) {
    return []
  }

  return Array
    .from(grid.querySelectorAll<HTMLElement>(':scope > .bookmark-tile[data-bookmark-id]'))
    .map((tile) => {
      const rect = tile.getBoundingClientRect()
      return {
        id: String(tile.dataset.bookmarkId || ''),
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      }
    })
    .filter((slot) => slot.id)
}

function getBookmarkDragTargetPoint(
  clientX: number,
  clientY: number
): { x: number; y: number } {
  // The pointer is kept at the favicon center, so it matches the point users steer visually.
  return { x: clientX, y: clientY }
}

function syncBookmarkDragVisualPreview(): void {
  const grid = getActiveBookmarkGrid()
  if (!grid || !bookmarkDragSlotOrderIds.length) {
    return
  }

  const tileByBookmarkId = new Map<string, HTMLElement>()
  for (const tile of grid.querySelectorAll<HTMLElement>(':scope > .bookmark-tile[data-bookmark-id]')) {
    const bookmarkId = String(tile.dataset.bookmarkId || '')
    if (bookmarkId) {
      tileByBookmarkId.set(bookmarkId, tile)
    }
  }

  const targetSlotByBookmarkId = new Map<string, DOMRect>()
  const targetOrderIds = getPreviewBookmarkOrderIds()
  if (targetOrderIds.length !== bookmarkDragSlotOrderIds.length) {
    return
  }

  for (let index = 0; index < targetOrderIds.length; index += 1) {
    const slotBookmarkId = bookmarkDragSlotOrderIds[index]
    const targetRect = bookmarkDragSlotRects.get(slotBookmarkId)
    if (!targetRect) {
      return
    }
    targetSlotByBookmarkId.set(targetOrderIds[index], targetRect)
  }

  for (const bookmarkId of getPreviewBookmarkOrderIds()) {
    const tile = tileByBookmarkId.get(bookmarkId)
    const originalRect = bookmarkDragSlotRects.get(bookmarkId)
    const targetRect = targetSlotByBookmarkId.get(bookmarkId)
    if (!tile || !originalRect || !targetRect) {
      continue
    }

    const deltaX = targetRect.left - originalRect.left
    const deltaY = targetRect.top - originalRect.top
    const isDraggedTile = bookmarkId === state.draggingBookmarkId
    tile.style.transform = buildBookmarkPreviewTransform(deltaX, deltaY, isDraggedTile)
    tile.style.zIndex = isDraggedTile ? '1' : ''
  }

}

function buildBookmarkPreviewTransform(deltaX: number, deltaY: number, isDraggedTile: boolean): string {
  const hasOffset = Math.abs(deltaX) >= 0.5 || Math.abs(deltaY) >= 0.5
  if (!hasOffset) {
    return isDraggedTile ? 'scale(0.92)' : ''
  }

  const translate = `translate3d(${deltaX}px, ${deltaY}px, 0)`
  return isDraggedTile ? `${translate} scale(0.92)` : translate
}

function clearBookmarkDragVisualPreview(): void {
  for (const tile of document.querySelectorAll<HTMLElement>('.bookmark-tile[data-bookmark-id]')) {
    tile.style.transform = ''
    tile.style.zIndex = ''
  }
  bookmarkDragSlotRects = new Map()
  bookmarkDragSlotOrderIds = []
}

function applyDraggedBookmarkInsertInState(insertIndex: number): string[] {
  const currentBookmarks = getActiveBookmarkFolderBookmarks()
  const currentOrderIds = currentBookmarks.map((bookmark) => String(bookmark.id))
  const finalOrderIds = buildBookmarkOrderAfterInsert(
    currentOrderIds,
    state.draggingBookmarkId,
    insertIndex
  )
  if (areStringArraysEqual(currentOrderIds, finalOrderIds)) {
    return currentOrderIds
  }

  const bookmarkById = new Map(currentBookmarks.map((bookmark) => [String(bookmark.id), bookmark]))
  const nextBookmarks: chrome.bookmarks.BookmarkTreeNode[] = []
  for (const bookmarkId of finalOrderIds) {
    const bookmark = bookmarkById.get(bookmarkId)
    if (!bookmark) {
      return currentOrderIds
    }
    nextBookmarks.push(bookmark)
  }

  setActiveBookmarkFolderBookmarks(nextBookmarks)
  return finalOrderIds
}

async function persistBookmarkOrder(
  folderId: string,
  originalBookmarkIds: string[],
  finalBookmarkIds: string[]
): Promise<void> {
  if (!folderId) {
    return
  }

  const operations = buildMinimalBookmarkMoveOperations(
    originalBookmarkIds,
    finalBookmarkIds,
    folderId
  )
  if (!operations.length) {
    return
  }

  state.reorderingBookmarks = true
  state.selfBookmarkMoveIds = new Set(operations.map((operation) => operation.id))
  state.selfBookmarkMoveSuppressUntil = Date.now() + 1500
  state.bookmarkReorderError = ''
  syncBookmarkReorderBusyState()
  try {
    for (const operation of operations) {
      await moveBookmarkLazy(operation.id, operation.parentId, operation.index)
    }

    if (!syncPersistedBookmarkOrderInState(folderId, operations, finalBookmarkIds)) {
      await refreshNewTab()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '书签排序保存失败，请刷新后重试。'
    await refreshNewTab()
    state.bookmarkReorderError = message
    render()
    updateClockText()
  } finally {
    state.reorderingBookmarks = false
    syncBookmarkReorderBusyState()
  }
}

function syncPersistedBookmarkOrderInState(
  folderId: string,
  operations: BookmarkMoveOperation[],
  finalBookmarkIds: string[]
): boolean {
  const folderNode = state.folderNodeMap.get(folderId) || null
  const nextChildren = applyBookmarkMoveOperationsToChildren(folderNode?.children, operations)
  if (!folderNode || !nextChildren) {
    return false
  }

  const nextBookmarkIds = nextChildren
    .filter((child) => Boolean(child.url))
    .map((child) => String(child.id))
  if (!areStringArraysEqual(nextBookmarkIds, finalBookmarkIds)) {
    return false
  }

  folderNode.children = nextChildren
  state.folderData = extractBookmarkData(state.rootNode)
  state.folderNodeMap = buildFolderNodeMap(state.rootNode)
  state.folderSections = buildNewTabFolderSections(
    state.rootNode,
    state.folderSettings,
    state.folderData,
    state.folderNodeMap
  )
  refreshDerivedBookmarkState()
  render()
  updateClockText()
  return true
}

function syncBookmarkReorderBusyState(): void {
  const busy = state.reorderingBookmarks ? 'true' : 'false'
  document.querySelector<HTMLElement>('.newtab-content')?.setAttribute('aria-busy', busy)
  document.querySelectorAll<HTMLElement>('.bookmark-grid').forEach((grid) => {
    grid.setAttribute('aria-busy', busy)
  })
}

function handleFolderPointerDown(event: PointerEvent): void {
  if (state.draggingBookmarkId || state.dragLongPressTimer) {
    return
  }

  if (event.pointerType === 'mouse' && event.button !== 0) {
    return
  }

  const target = event.target
  if (!(target instanceof Element) || target.closest('.bookmark-edit-menu')) {
    return
  }

  const folderTarget = target.closest('[data-folder-drag-handle]')
  if (!(folderTarget instanceof HTMLElement)) {
    return
  }

  const folderId = String(folderTarget.dataset.folderDragHandle || '').trim()
  if (!folderId || !state.folderSections.some((section) => section.id === folderId)) {
    return
  }

  cancelFolderDrag({ keepSuppressClick: true })
  state.folderDragPointerId = event.pointerId
  state.draggingFolderId = folderId
  state.folderDragClientX = event.clientX
  state.folderDragClientY = event.clientY
  try {
    folderTarget.setPointerCapture(event.pointerId)
  } catch {
    // Pointer capture can fail if the browser has already released this pointer.
  }
  state.folderDragLongPressTimer = window.setTimeout(() => {
    beginFolderDrag()
  }, FOLDER_DRAG_LONG_PRESS_MS)
}

function beginFolderDrag(): void {
  if (!state.draggingFolderId || !state.folderSections.some((section) => section.id === state.draggingFolderId)) {
    cancelFolderDrag()
    return
  }

  closeBookmarkMenu()
  closeAddBookmarkMenu()
  clearFolderReorderStatus()
  state.folderDragLongPressTimer = 0
  state.folderDragOriginalOrderIds = state.folderSections.map((section) => section.id)
  state.folderDragOriginalSections = [...state.folderSections]
  state.folderDragSuppressClick = true
  document.body.classList.add('folder-order-dragging')
  const sourceHeader = getActiveFolderDragHeader()
  createFolderDragGhost(sourceHeader)
  sourceHeader?.classList.add('dragging')
}

function handleFolderPointerMove(event: PointerEvent): void {
  if (!state.draggingFolderId || event.pointerId !== state.folderDragPointerId) {
    return
  }

  state.folderDragClientX = event.clientX
  state.folderDragClientY = event.clientY

  if (state.folderDragLongPressTimer) {
    return
  }

  event.preventDefault()
  updateFolderDragGhost()
  const insertIndex = getFolderInsertIndex(event.clientY)
  if (insertIndex < 0) {
    return
  }

  if (moveDraggedFolderInState(insertIndex)) {
    renderWithFolderFlip()
    updateFolderDragGhost({ immediate: true })
  }
}

async function finishFolderDrag(event: PointerEvent): Promise<void> {
  if (!state.draggingFolderId || event.pointerId !== state.folderDragPointerId) {
    return
  }

  window.clearTimeout(state.folderDragLongPressTimer)
  state.folderDragLongPressTimer = 0

  const wasDragging = Boolean(state.folderDragOriginalOrderIds.length)
  const finalOrderIds = state.folderSections.map((section) => section.id)
  const originalOrderIds = [...state.folderDragOriginalOrderIds]
  const originalSections = [...state.folderDragOriginalSections]
  clearFolderDragState({ keepSuppressClick: wasDragging })

  if (!wasDragging) {
    return
  }

  render()
  updateClockText()

  if (areStringArraysEqual(originalOrderIds, finalOrderIds)) {
    return
  }

  state.folderSettings = normalizeFolderSettings({
    ...state.folderSettings,
    selectedFolderIds: finalOrderIds
  })
  try {
    await saveFolderSettings()
    syncFolderSettingsControls()
    setFolderReorderStatus('文件夹顺序已保存。', 'success')
  } catch (error) {
    state.folderSettings = normalizeFolderSettings({
      ...state.folderSettings,
      selectedFolderIds: originalOrderIds
    })
    restoreFolderDragOrder(originalOrderIds, originalSections)
    syncFolderSettingsControls()
    const message = error instanceof Error ? error.message : '请稍后重试。'
    setFolderReorderStatus(`文件夹顺序保存失败，已恢复到拖拽前顺序。${message}`, 'error')
  }
}

function cancelFolderDrag({ keepSuppressClick = false } = {}): void {
  if (!state.draggingFolderId && !state.folderDragLongPressTimer) {
    return
  }

  window.clearTimeout(state.folderDragLongPressTimer)
  const originalOrderIds = [...state.folderDragOriginalOrderIds]
  const originalSections = [...state.folderDragOriginalSections]
  clearFolderDragState({ keepSuppressClick })
  restoreFolderDragOrder(originalOrderIds, originalSections)
  render()
  updateClockText()
}

function clearFolderDragState({ keepSuppressClick = false } = {}): void {
  getActiveFolderDragHeader()?.classList.remove('dragging')
  state.draggingFolderId = ''
  state.folderDragPointerId = 0
  state.folderDragLongPressTimer = 0
  state.folderDragClientX = 0
  state.folderDragClientY = 0
  state.folderDragOffsetX = 0
  state.folderDragOffsetY = 0
  state.folderDragOriginalOrderIds = []
  state.folderDragOriginalSections = []
  removeFolderDragGhost()
  document.body.classList.remove('folder-order-dragging')

  if (keepSuppressClick) {
    state.folderDragSuppressClick = true
    window.setTimeout(() => {
      state.folderDragSuppressClick = false
    }, 250)
  } else {
    state.folderDragSuppressClick = false
  }
}

function createFolderDragGhost(sourceHeader = getActiveFolderDragHeader()): void {
  removeFolderDragGhost()

  if (!sourceHeader) {
    return
  }

  const rect = sourceHeader.getBoundingClientRect()
  state.folderDragOffsetX = rect.width / 2
  state.folderDragOffsetY = rect.height / 2

  const ghost = sourceHeader.cloneNode(true) as HTMLElement
  ghost.classList.remove('dragging')
  ghost.classList.add('folder-drag-ghost')
  ghost.removeAttribute('data-folder-drag-handle')
  ghost.setAttribute('aria-hidden', 'true')
  ghost.style.width = `${rect.width}px`
  ghost.style.height = `${rect.height}px`
  folderDragGhost = ghost
  document.body.appendChild(ghost)
  updateFolderDragGhost({ immediate: true })
}

function getActiveFolderDragHeader(): HTMLElement | null {
  if (!state.draggingFolderId) {
    return null
  }

  return document.querySelector<HTMLElement>(
    `.folder-section-header[data-folder-drag-handle="${CSS.escape(state.draggingFolderId)}"]`
  )
}

function updateFolderDragGhost({ immediate = false } = {}): void {
  if (immediate) {
    updateFolderDragGhostPosition()
    return
  }

  if (folderDragGhostFrame) {
    return
  }

  folderDragGhostFrame = window.requestAnimationFrame(() => {
    folderDragGhostFrame = 0
    updateFolderDragGhostPosition()
  })
}

function updateFolderDragGhostPosition(): void {
  if (!folderDragGhost) {
    return
  }

  const left = state.folderDragClientX - state.folderDragOffsetX
  const top = state.folderDragClientY - state.folderDragOffsetY
  folderDragGhost.style.transform = `translate3d(${left}px, ${top}px, 0)`
}

function removeFolderDragGhost(): void {
  window.cancelAnimationFrame(folderDragGhostFrame)
  folderDragGhostFrame = 0
  folderDragGhost?.remove()
  folderDragGhost = null
}

function getFolderSectionRects(): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>()
  for (const section of document.querySelectorAll<HTMLElement>('.bookmark-folder-section[data-folder-section-id]')) {
    const folderId = String(section.dataset.folderSectionId || '')
    if (folderId) {
      rects.set(folderId, section.getBoundingClientRect())
    }
  }
  return rects
}

function renderWithFolderFlip(): void {
  const previousRects = getFolderSectionRects()
  render()
  updateClockText()

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }

  for (const section of document.querySelectorAll<HTMLElement>('.bookmark-folder-section[data-folder-section-id]')) {
    const folderId = String(section.dataset.folderSectionId || '')
    if (!folderId || folderId === state.draggingFolderId) {
      continue
    }

    const previousRect = previousRects.get(folderId)
    if (!previousRect) {
      continue
    }

    const currentRect = section.getBoundingClientRect()
    const deltaY = previousRect.top - currentRect.top
    if (Math.abs(deltaY) < 0.5) {
      continue
    }

    section.animate(
      [
        { transform: `translate3d(0, ${deltaY}px, 0)` },
        { transform: 'translate3d(0, 0, 0)' }
      ],
      {
        duration: 180,
        easing: 'cubic-bezier(0.22, 0.72, 0.18, 1)'
      }
    )
  }
}

function getFolderInsertIndex(clientY: number): number {
  const sections = Array.from(document.querySelectorAll<HTMLElement>('.bookmark-folder-section[data-folder-section-id]'))
  if (!sections.length) {
    return -1
  }

  let closestSection: HTMLElement | null = null
  let closestDistance = Number.POSITIVE_INFINITY
  for (const section of sections) {
    const rect = section.getBoundingClientRect()
    const centerY = rect.top + rect.height / 2
    const distance = Math.abs(clientY - centerY)
    if (distance < closestDistance) {
      closestDistance = distance
      closestSection = section
    }
  }

  if (!closestSection) {
    return -1
  }

  const folderId = String(closestSection.dataset.folderSectionId || '')
  const targetIndex = state.folderSections.findIndex((section) => section.id === folderId)
  if (targetIndex < 0) {
    return -1
  }

  const rect = closestSection.getBoundingClientRect()
  return targetIndex + (clientY > rect.top + rect.height / 2 ? 1 : 0)
}

function moveDraggedFolderInState(insertIndex: number): boolean {
  const currentIndex = state.folderSections.findIndex(
    (section) => section.id === state.draggingFolderId
  )
  if (currentIndex < 0) {
    return false
  }

  const nextSections = [...state.folderSections]
  const [draggedSection] = nextSections.splice(currentIndex, 1)
  const normalizedIndex = Math.max(
    0,
    Math.min(
      currentIndex < insertIndex ? insertIndex - 1 : insertIndex,
      nextSections.length
    )
  )

  if (currentIndex === normalizedIndex) {
    return false
  }

  nextSections.splice(normalizedIndex, 0, draggedSection)
  state.folderSections = nextSections
  refreshDerivedBookmarkState()
  return true
}

function restoreFolderDragOrder(
  originalOrderIds: string[],
  originalSections: NewTabFolderSection[]
): boolean {
  if (!originalOrderIds.length || originalSections.length !== originalOrderIds.length) {
    return false
  }

  const sectionById = new Map(originalSections.map((section) => [section.id, section]))
  const restoredSections: NewTabFolderSection[] = []
  for (const folderId of originalOrderIds) {
    const section = sectionById.get(folderId)
    if (!section) {
      return false
    }
    restoredSections.push(section)
  }

  state.folderSections = restoredSections
  refreshDerivedBookmarkState()
  return true
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

function handleBookmarksChanged(): void {
  if (state.reorderingBookmarks) {
    return
  }

  scheduleBookmarkChangeRefresh()
}

function handleBookmarkMoved(bookmarkId: string): void {
  if (isSelfBookmarkMoveEvent(bookmarkId)) {
    return
  }

  handleBookmarksChanged()
}

function scheduleBookmarkChangeRefresh(): void {
  bookmarkChangeRefreshQueued = true
  if (bookmarkChangeRefreshTimer || bookmarkChangeRefreshInFlight) {
    return
  }

  bookmarkChangeRefreshTimer = window.setTimeout(() => {
    bookmarkChangeRefreshTimer = 0
    void flushBookmarkChangeRefresh()
  }, BOOKMARK_CHANGE_REFRESH_DEBOUNCE_MS)
}

async function flushBookmarkChangeRefresh(): Promise<void> {
  if (bookmarkChangeRefreshInFlight || !bookmarkChangeRefreshQueued) {
    return
  }

  bookmarkChangeRefreshQueued = false
  bookmarkChangeRefreshInFlight = true
  try {
    await refreshNewTab()
  } finally {
    bookmarkChangeRefreshInFlight = false
    if (bookmarkChangeRefreshQueued) {
      scheduleBookmarkChangeRefresh()
    }
  }
}

function isSelfBookmarkMoveEvent(bookmarkId: string): boolean {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (
    normalizedBookmarkId &&
    state.selfBookmarkMoveIds.has(normalizedBookmarkId) &&
    Date.now() <= state.selfBookmarkMoveSuppressUntil
  ) {
    state.selfBookmarkMoveIds.delete(normalizedBookmarkId)
    return true
  }

  if (Date.now() > state.selfBookmarkMoveSuppressUntil) {
    state.selfBookmarkMoveIds.clear()
  }

  return state.reorderingBookmarks
}

function isActiveMenuBookmarkPinned(): boolean {
  const bookmark = getActiveMenuBookmark()
  return Boolean(bookmark && isSpeedDialBookmarkPinned(getActiveWorkspacePinnedIds(), String(bookmark.id)))
}

async function toggleActiveMenuBookmarkPin(): Promise<void> {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark?.url) {
    closeBookmarkMenu()
    return
  }

  const bookmarkId = String(bookmark.id)
  const workspace = getActiveNewTabWorkspace(state.workspaceSettings)
  const pinned = isSpeedDialBookmarkPinned(workspace.pinnedIds, bookmarkId)
  state.workspaceSettings = toggleNewTabWorkspacePin(
    state.workspaceSettings,
    workspace.id,
    bookmarkId,
    { validBookmarkIds: state.allBookmarkMap.keys() }
  )

  try {
    state.pendingDeleteBookmarkId = ''
    await saveNewTabWorkspaceSettings()
    const copy = getSpeedDialPinActionCopy(pinned, workspace.name)
    state.menuError = ''
    state.menuStatus = copy.status
    render()
    updateClockText()
    renderBookmarkMenu({ focusFirst: false, focusAction: 'toggle-pin' })
  } catch (error) {
    state.menuStatus = ''
    state.menuError = error instanceof Error ? error.message : '固定状态保存失败，请稍后重试。'
    renderBookmarkMenu({ focusFirst: false, focusAction: 'toggle-pin' })
  }
}

async function saveBookmarkMenuChanges(): Promise<void> {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    closeBookmarkMenu()
    return
  }

  try {
    const previousUrl = String(bookmark.url || '').trim()
    const title = state.editTitle.trim() || state.editUrl.trim()
    const url = normalizeBookmarkInputUrl(state.editUrl)
    state.pendingDeleteBookmarkId = ''
    state.menuBusy = true
    state.menuError = ''
    state.menuStatus = ''
    renderBookmarkMenu()

    await updateBookmarkLazy(bookmark.id, { title, url })
    await persistCustomIconChoice(bookmark.id)
    if (previousUrl !== url) {
      await deleteFaviconAccentCacheEntry(bookmark.id)
      state.faviconRefreshTokens.set(bookmark.id, Date.now())
    }
    closeBookmarkMenu()
    await refreshNewTab()
  } catch (error) {
    state.menuBusy = false
    state.menuStatus = ''
    state.menuError = error instanceof Error ? error.message : '保存失败，请稍后重试。'
    renderBookmarkMenu()
  }
}

async function copyActiveMenuBookmarkUrl(): Promise<void> {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark?.url) {
    closeBookmarkMenu()
    return
  }

  try {
    state.pendingDeleteBookmarkId = ''
    await writeClipboardText(bookmark.url)
    state.menuError = ''
    state.menuStatus = '链接已复制'
    renderBookmarkMenu({ focusFirst: false, focusAction: 'copy-url' })
  } catch (error) {
    state.menuStatus = ''
    state.menuError = error instanceof Error ? `复制失败：${error.message}` : '复制失败，请手动复制链接。'
    renderBookmarkMenu({ focusFirst: false, focusAction: 'copy-url' })
  }
}

function writeClipboardText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    if (!document.execCommand('copy')) {
      throw new Error('浏览器拒绝写入剪贴板。')
    }
    return Promise.resolve()
  } catch (error) {
    return Promise.reject(error)
  } finally {
    textarea.remove()
  }
}

async function deleteActiveMenuBookmark(): Promise<void> {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    closeBookmarkMenu()
    return
  }

  const bookmarkId = String(bookmark.id || '')
  if (state.pendingDeleteBookmarkId !== bookmarkId) {
    state.pendingDeleteBookmarkId = bookmarkId
    state.menuError = ''
    state.menuStatus = getDeleteBookmarkConfirmationText(bookmark)
    renderBookmarkMenu({ focusFirst: false, focusAction: 'delete-bookmark' })
    return
  }

  try {
    state.menuBusy = true
    state.menuError = ''
    state.menuStatus = `正在删除 1 个书签：「${getBookmarkDisplayTitle(bookmark)}」...`
    renderBookmarkMenu({ focusFirst: false, focusAction: 'delete-bookmark' })

    const recycleId = `recycle-${bookmark.id}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    await deleteBookmarkToRecycleLazy(bookmark.id, {
      recycleId,
      bookmarkId: String(bookmark.id),
      title: bookmark.title || '未命名书签',
      url: bookmark.url,
      parentId: String(bookmark.parentId || ''),
      index: Number.isFinite(Number(bookmark.index)) ? Number(bookmark.index) : 0,
      path: getBookmarkFolderPath(bookmark) || DEFAULT_NEW_TAB_FOLDER_TITLE,
      source: '新标签页删除',
      deletedAt: Date.now()
    })
    const deletedCustomIcon = state.customIcons[bookmark.id]
    if (deletedCustomIcon) {
      const nextIcons = { ...state.customIcons }
      delete nextIcons[bookmark.id]
      await saveCustomIcons(nextIcons).catch((error) => {
        console.warn('新标签页自定义图标清理失败。', error)
      })
    }
    await deleteFaviconAccentCacheEntry(bookmark.id).catch((error) => {
      console.warn('新标签页网站图标色彩缓存清理失败。', error)
    })
    await removeBookmarkFromActivity(bookmark.id).catch((error) => {
      console.warn('新标签页打开记录清理失败。', error)
    })
    await removeBookmarkFromWorkspacePins(bookmark.id).catch((error) => {
      console.warn('新标签页 workspace 固定入口清理失败。', error)
    })

    state.pendingDeleteBookmarkId = ''
    state.lastDeletedBookmark = {
      bookmark,
      recycleId,
      deletedAt: Date.now(),
      customIcon: deletedCustomIcon
    }
    state.deleteToastStatus = ''
    closeBookmarkMenu()
    await refreshNewTab()
  } catch (error) {
    state.pendingDeleteBookmarkId = ''
    state.menuBusy = false
    state.menuStatus = ''
    state.menuError = error instanceof Error ? error.message : '删除失败，请稍后重试。'
    renderBookmarkMenu()
  }
}

function getDeleteBookmarkConfirmationText(bookmark: chrome.bookmarks.BookmarkTreeNode): string {
  const title = getBookmarkDisplayTitle(bookmark)
  const folderPath = getBookmarkFolderPath(bookmark) || DEFAULT_NEW_TAB_FOLDER_TITLE
  return `再点一次“确认删除 1 个”会从 Chrome 书签中删除「${title}」，位置：${folderPath}。删除记录会进入回收站，可从回收站恢复。`
}

async function undoLastDeletedBookmark(): Promise<void> {
  const deleted = state.lastDeletedBookmark
  if (!deleted || state.deleteToastBusy) {
    return
  }

  state.deleteToastBusy = true
  state.deleteToastStatus = '正在恢复...'
  renderDeleteToast()

  try {
    const bookmark = deleted.bookmark
    const parentId = await getRestorableParentId(bookmark.parentId)
    const createdBookmark = await createBookmarkLazy({
      parentId,
      index: Number.isFinite(Number(bookmark.index)) ? Number(bookmark.index) : undefined,
      title: bookmark.title || '未命名书签',
      url: bookmark.url
    })
    await removeRecycleEntryLazy(deleted.recycleId).catch((error) => {
      console.warn('新标签页撤销删除时清理回收站记录失败。', error)
    })
    if (deleted.customIcon) {
      await saveCustomIcons({
        ...state.customIcons,
        [String(createdBookmark.id)]: deleted.customIcon
      }).catch((error) => {
        console.warn('新标签页撤销删除时恢复自定义图标失败。', error)
      })
    }

    state.lastDeletedBookmark = null
    state.deleteToastBusy = false
    state.deleteToastStatus = ''
    await refreshNewTab()
    renderDeleteToast()
  } catch (error) {
    state.deleteToastBusy = false
    state.deleteToastStatus = error instanceof Error ? error.message : '恢复失败，请打开回收站处理。'
    renderDeleteToast()
  }
}

async function getRestorableParentId(parentId: string | undefined): Promise<string> {
  try {
    const rootNode = (await getBookmarkTree())[0] || null
    const bookmarksBar = findBookmarksBar(rootNode)
    return resolveRestorableBookmarkParentId(parentId, rootNode, bookmarksBar?.id || BOOKMARKS_BAR_ID)
  } catch {
    return BOOKMARKS_BAR_ID
  }
}

function openRecycleBin(): void {
  const url = chrome.runtime.getURL('src/options/options.html#recycle')
  void chrome.tabs?.create?.({ url })
  state.lastDeletedBookmark = null
  state.deleteToastStatus = ''
  renderDeleteToast()
}

function openOptionsHash(hash: string): void {
  const normalizedHash = String(hash || '').startsWith('#') ? String(hash) : `#${String(hash || '').trim()}`
  const url = chrome.runtime.getURL(`src/options/options.html${normalizedHash}`)
  void chrome.tabs?.create?.({ url })
}

function getBookmarkDisplayTitle(bookmark: chrome.bookmarks.BookmarkTreeNode): string {
  return String(bookmark.title || '').trim() || String(bookmark.url || '').trim() || '未命名书签'
}

function getBookmarkActionLabelContext(bookmark: chrome.bookmarks.BookmarkTreeNode): string {
  const title = getBookmarkDisplayTitle(bookmark)
  return title.length > 48 ? `${title.slice(0, 47).trim()}…` : title
}

function refreshActiveMenuIcon(): void {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    closeBookmarkMenu()
    return
  }

  state.pendingDeleteBookmarkId = ''
  state.faviconRefreshTokens.set(bookmark.id, Date.now())
  void deleteFaviconAccentCacheEntry(bookmark.id).catch((error) => {
    console.warn('新标签页网站图标色彩缓存刷新失败。', error)
  })
  render()
  updateClockText()
  renderBookmarkMenu({ focusFirst: false, focusAction: 'refresh-icon' })
}

function expandAddBookmarkMenu(): void {
  state.addMenuExpanded = true
  state.addMenuError = ''
  renderAddBookmarkMenu()
}

async function saveAddedBookmark(): Promise<void> {
  try {
    const url = normalizeBookmarkInputUrl(state.addUrl)
    const title = state.addTitle.trim() || url
    state.addMenuBusy = true
    state.addMenuError = ''
    renderAddBookmarkMenu({ focusFirst: false })

    const folderId = state.addFolderId || await ensureNewTabFolder()
    await createBookmarkLazy({
      parentId: folderId,
      title,
      url
    })
    closeAddBookmarkMenu()
    await refreshNewTab()
  } catch (error) {
    state.addMenuBusy = false
    state.addMenuError =
      error instanceof Error ? error.message : '添加失败，请稍后重试。'
    renderAddBookmarkMenu({ focusFirst: false })
  }
}

async function refreshNewTab(): Promise<void> {
  state.loading = true
  state.error = ''
  state.bookmarkReorderError = ''
  clearFolderReorderStatus()
  render()

  try {
    const [tree, stored, preloadedBackground] = await Promise.all([
      getBookmarkTree(),
      getLocalStorage([
        STORAGE_KEYS.newTabCustomIcons,
        STORAGE_KEYS.newTabSearchSettings,
        STORAGE_KEYS.newTabIconSettings,
        STORAGE_KEYS.newTabFaviconAccentCache,
        STORAGE_KEYS.newTabGeneralSettings,
        STORAGE_KEYS.newTabFolderSettings,
        STORAGE_KEYS.newTabTimeSettings,
        STORAGE_KEYS.newTabWorkspaceSettings,
        STORAGE_KEYS.newTabModuleSettings,
        STORAGE_KEYS.newTabActivity,
        STORAGE_KEYS.bookmarkTagIndex,
        STORAGE_KEYS.contentSnapshotIndex
      ]),
      backgroundPreloadPromise
    ])
    const rootNode = tree[0] || null
    const folderData = extractBookmarkData(rootNode)
    const folderNodeMap = buildFolderNodeMap(rootNode)
    const folderSettings = normalizeFolderSettingsWithDefault(
      stored[STORAGE_KEYS.newTabFolderSettings],
      rootNode
    )
    const folderSections = buildNewTabFolderSections(rootNode, folderSettings, folderData, folderNodeMap)

    state.rootNode = rootNode
    state.folderData = folderData
    state.bookmarkTagIndex = normalizeNewTabBookmarkTagIndex(stored[STORAGE_KEYS.bookmarkTagIndex])
    state.searchSnapshotIndex = normalizeNewTabContentSnapshotIndex(stored[STORAGE_KEYS.contentSnapshotIndex])
    state.folderNodeMap = folderNodeMap
    state.folderSettings = folderSettings
    state.folderSections = folderSections
    refreshDerivedBookmarkState()
    state.customIcons = normalizeCustomIcons(stored[STORAGE_KEYS.newTabCustomIcons])
    state.faviconAccentCache = normalizeFaviconAccentCache(stored[STORAGE_KEYS.newTabFaviconAccentCache])
    state.activity = normalizeNewTabActivity(stored[STORAGE_KEYS.newTabActivity], state.allBookmarks)
    state.workspaceSettings = normalizeNewTabWorkspaceSettings(stored[STORAGE_KEYS.newTabWorkspaceSettings], {
      validBookmarkIds: state.allBookmarkMap.keys(),
      legacyPinnedIds: state.activity.pinnedIds
    })
    state.moduleSettings = normalizeNewTabModuleSettings(stored[STORAGE_KEYS.newTabModuleSettings])
    state.backgroundSettings = preloadedBackground || state.backgroundSettings
    state.searchSettings = normalizeSearchSettings(stored[STORAGE_KEYS.newTabSearchSettings])
    state.iconSettings = normalizeIconSettings(stored[STORAGE_KEYS.newTabIconSettings])
    state.generalSettings = normalizeGeneralSettings(stored[STORAGE_KEYS.newTabGeneralSettings])
    state.timeSettings = normalizeTimeSettings(stored[STORAGE_KEYS.newTabTimeSettings])
  } catch (error) {
    state.error = error instanceof Error ? error.message : '新标签页加载失败，请刷新后重试。'
  } finally {
    state.loading = false
    render()
    renderDeleteToast()
    syncBackgroundSettingsControls()
    void applyBackgroundSettings()
    syncSearchSettingsControls()
    syncIconSettingsControls()
    syncGeneralSettingsControls()
    applyGeneralSettings()
    syncFolderSettingsControls()
    applyFolderSettings()
    syncNewTabModernSettingsControls()
    syncTimeSettingsControls()
    updateAllSettingRangeVisuals()
    updateClockText()
    scheduleClockTick()
  }
}

async function preloadBackgroundSettings(): Promise<typeof DEFAULT_BACKGROUND_SETTINGS | null> {
  try {
    const stored = await getLocalStorage([STORAGE_KEYS.newTabBackgroundSettings])
    state.backgroundSettings = normalizeBackgroundSettings(stored[STORAGE_KEYS.newTabBackgroundSettings])
    preloadedBackgroundSettings = state.backgroundSettings
    setWallpaperPlaceholderColor(state.backgroundSettings.color)
    syncBackgroundSettingsControls()
    void applyBackgroundSettings()
    return state.backgroundSettings
  } catch (error) {
    console.warn('新标签页背景预加载失败。', error)
    markWallpaperReady()
    return preloadedBackgroundSettings
  }
}

async function createNewTabFolder(): Promise<void> {
  if (state.creatingFolder) {
    return
  }

  state.creatingFolder = true
  state.error = ''
  render()

  try {
    const rootNode = state.rootNode || (await getBookmarkTree())[0] || null
    const bookmarksBar = findBookmarksBar(rootNode)
    const createdFolder = await createBookmarkLazy({
      parentId: bookmarksBar?.id || BOOKMARKS_BAR_ID,
      title: DEFAULT_NEW_TAB_FOLDER_TITLE
    })
    state.folderSettings = normalizeFolderSettings({
      ...state.folderSettings,
      selectedFolderIds: [...state.folderSettings.selectedFolderIds, String(createdFolder.id)]
    })
    await saveFolderSettings()
    await refreshNewTab()
  } catch (error) {
    state.error = error instanceof Error ? error.message : '书签来源文件夹创建失败，请稍后重试。'
    render()
  } finally {
    state.creatingFolder = false
    render()
  }
}

async function ensureNewTabFolder(): Promise<string> {
  const primarySection = state.folderSections[0]
  if (primarySection?.id) {
    return primarySection.id
  }

  const rootNode = state.rootNode || (await getBookmarkTree())[0] || null
  const existingFolder = findNewTabFolder(rootNode)
  if (existingFolder?.id) {
    state.folderSettings = normalizeFolderSettings({
      ...state.folderSettings,
      selectedFolderIds: [String(existingFolder.id)]
    })
    state.folderSections = buildNewTabFolderSections(rootNode, state.folderSettings)
    refreshDerivedBookmarkState()
    await saveFolderSettings()
    return String(existingFolder.id)
  }

  const bookmarksBar = findBookmarksBar(rootNode)
  const createdFolder = await createBookmarkLazy({
    parentId: bookmarksBar?.id || BOOKMARKS_BAR_ID,
    title: DEFAULT_NEW_TAB_FOLDER_TITLE
  })
  state.folderSettings = normalizeFolderSettings({
    ...state.folderSettings,
    selectedFolderIds: [String(createdFolder.id)]
  })
  state.folderSections = buildNewTabFolderSections(rootNode, state.folderSettings)
  refreshDerivedBookmarkState()
  await saveFolderSettings()
  return String(createdFolder.id)
}

function render(): void {
  if (!root) {
    return
  }

  bookmarkTileRenderVersion += 1
  cancelScheduledAdaptiveNewTabLayoutUpdate()
  root.replaceChildren()
  const contentState = resolveNewTabContentState({
    loading: state.loading,
    error: state.error,
    selectedFolderCount: state.folderSettings.selectedFolderIds.length,
    visibleFolderCount: state.folderSections.length
  })

  if (contentState.type === 'loading') {
    root.appendChild(createNewTabLayout(createLoadingStateView()))
    scheduleAdaptiveNewTabLayoutUpdate()
    return
  }

  if (contentState.type === 'error') {
    root.appendChild(createStateView(contentState.message, '重新加载', () => {
      void refreshNewTab()
    }))
    return
  }

  if (contentState.type === 'missing-folder') {
    root.appendChild(createNewTabLayout(createMissingFolderView({
      creatingFolder: state.creatingFolder,
      reason: contentState.reason,
      onCreateFolder: () => {
        void createNewTabFolder()
      },
      onOpenFolderSettings: openFolderSourceSettings
    })))
    scheduleAdaptiveNewTabLayoutUpdate()
    return
  }

  root.appendChild(createNewTabLayout(createBookmarkSections(state.folderSections)))
  scheduleAdaptiveNewTabLayoutUpdate()
}

function syncDashboardRoute(): void {
  const shouldOpen = window.location.hash === '#dashboard'
  if (shouldOpen === state.dashboardOpen) {
    if (shouldOpen) {
      ensureDashboardFrameLoaded()
    }
    return
  }

  state.dashboardOpen = shouldOpen
  renderDashboard()
  if (shouldOpen) {
    closeSettingsDrawer()
  }
}

function openDashboardRoute(): void {
  dashboardReturnFocusTarget = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : dashboardTrigger instanceof HTMLElement
      ? dashboardTrigger
      : null

  if (window.location.hash === '#dashboard') {
    if (state.dashboardFrameError) {
      retryDashboardFrame()
    }
    syncDashboardRoute()
    return
  }

  window.location.hash = 'dashboard'
}

function closeDashboardRoute(): void {
  window.clearTimeout(dashboardFrameReadyTimeout)
  dashboardFrameReadyTimeout = 0
  if (window.location.hash !== '#dashboard') {
    state.dashboardOpen = false
    renderDashboard()
    restoreDashboardFocus()
    return
  }

  history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  syncDashboardRoute()
  restoreDashboardFocus()
}

function ensureDashboardFrameLoaded(): void {
  if (!dashboardFrame) {
    return
  }

  if (state.dashboardFrameLoaded) {
    if (
      state.dashboardOpen &&
      !state.dashboardFrameReady &&
      !state.dashboardFrameError &&
      !dashboardFrameReadyTimeout
    ) {
      scheduleDashboardFrameReadyTimeout()
    }
    return
  }

  state.dashboardFrameReady = false
  state.dashboardFrameError = ''
  dashboardFrame.src = chrome.runtime.getURL('src/options/options.html?embed=newtab-dashboard#dashboard')
  state.dashboardFrameLoaded = true
  scheduleDashboardFrameReadyTimeout()
}

function retryDashboardFrame(): void {
  if (!dashboardFrame) {
    setDashboardFrameError('书签仪表盘加载失败。请返回新标签页后再试。')
    return
  }

  window.clearTimeout(dashboardFrameReadyTimeout)
  dashboardFrameReadyTimeout = 0
  state.dashboardFrameLoaded = false
  state.dashboardFrameReady = false
  state.dashboardFrameError = ''
  dashboardFrame.removeAttribute('src')
  renderDashboard()
}

function scheduleDashboardFrameReadyTimeout(): void {
  window.clearTimeout(dashboardFrameReadyTimeout)
  dashboardFrameReadyTimeout = window.setTimeout(() => {
    if (!state.dashboardOpen || state.dashboardFrameReady) {
      return
    }

    setDashboardFrameError('书签仪表盘加载耗时过长。你可以返回新标签页，或重试打开仪表盘。')
  }, DASHBOARD_FRAME_READY_TIMEOUT_MS)
}

function setDashboardFrameError(message: string): void {
  window.clearTimeout(dashboardFrameReadyTimeout)
  dashboardFrameReadyTimeout = 0
  state.dashboardFrameReady = false
  state.dashboardFrameError = message
  renderDashboard()
}

function renderDashboard(): void {
  if (!dashboardOverlay) {
    return
  }

  const hasDashboardError = Boolean(state.dashboardFrameError)
  dashboardOverlay.hidden = !state.dashboardOpen
  dashboardOverlay.setAttribute('aria-hidden', state.dashboardOpen ? 'false' : 'true')
  dashboardOverlay.dataset.dashboardReady = state.dashboardFrameReady && !hasDashboardError ? 'true' : 'false'
  dashboardOverlay.dataset.dashboardError = hasDashboardError ? 'true' : 'false'
  dashboardTrigger?.setAttribute('aria-expanded', state.dashboardOpen ? 'true' : 'false')
  if (dashboardFallback) {
    dashboardFallback.hidden = !hasDashboardError
  }
  if (dashboardFallbackCopy) {
    dashboardFallbackCopy.textContent = state.dashboardFrameError || ''
  }

  if (state.dashboardOpen) {
    ensureDashboardFrameLoaded()
    focusDashboardOverlay()
  }
}

function focusDashboardOverlay(): void {
  window.setTimeout(() => {
    if (!state.dashboardOpen) {
      return
    }

    if (state.dashboardFrameReady && dashboardFrame) {
      dashboardFrame.focus()
      return
    }

    dashboardOverlay?.focus()
  }, 0)
}

function restoreDashboardFocus(): void {
  const focusTarget = dashboardReturnFocusTarget?.isConnected
    ? dashboardReturnFocusTarget
    : dashboardTrigger instanceof HTMLElement
      ? dashboardTrigger
      : null
  dashboardReturnFocusTarget = null
  focusTarget?.focus()
}

function handleDashboardMessage(event: MessageEvent): void {
  if (!dashboardFrame || event.source !== dashboardFrame.contentWindow) {
    return
  }

  if (event.origin !== window.location.origin) {
    return
  }

  if (event.data?.type === 'curator:newtab-dashboard-close') {
    closeDashboardRoute()
    return
  }

  if (event.data?.type === 'curator:newtab-dashboard-ready') {
    window.clearTimeout(dashboardFrameReadyTimeout)
    dashboardFrameReadyTimeout = 0
    state.dashboardFrameError = ''
    state.dashboardFrameReady = true
    postDashboardSpeedDialState()
    renderDashboard()
    return
  }

  if (event.data?.type === NEWTAB_TOGGLE_SPEED_DIAL_MESSAGE_TYPE) {
    const bookmarkId = String(event.data?.bookmarkId || '').trim()
    void toggleDashboardBookmarkSpeedDial(bookmarkId)
  }
}

function postDashboardSpeedDialState(): void {
  if (!dashboardFrame || !state.dashboardFrameReady || !state.dashboardOpen) {
    return
  }

  dashboardFrame.contentWindow?.postMessage({
    type: NEWTAB_SPEED_DIAL_STATE_MESSAGE_TYPE,
    pinnedIds: getActiveWorkspacePinnedIds()
  }, window.location.origin)
}

async function toggleDashboardBookmarkSpeedDial(bookmarkId: string): Promise<void> {
  const normalizedId = String(bookmarkId || '').trim()
  const bookmark = normalizedId ? getBookmarkById(normalizedId) : null
  if (!bookmark?.url) {
    return
  }

  const activeWorkspace = getActiveNewTabWorkspace(state.workspaceSettings)
  state.workspaceSettings = toggleNewTabWorkspacePin(
    state.workspaceSettings,
    activeWorkspace.id,
    normalizedId,
    { validBookmarkIds: state.allBookmarkMap.keys() }
  )

  try {
    await saveNewTabWorkspaceSettings()
    syncWorkspaceSettingsControls()
    render()
    postDashboardSpeedDialState()
    updateClockText()
  } catch (error) {
    console.warn('从书签仪表盘切换 Speed Dial 固定状态失败。', error)
  }
}

function renderDeleteToast(): void {
  document.querySelector<HTMLElement>('.newtab-delete-toast')?.remove()
  const deleted = state.lastDeletedBookmark
  if (!deleted) {
    return
  }
  const bookmarkLabel = getBookmarkActionLabelContext(deleted.bookmark)

  const toast = document.createElement('section')
  toast.className = 'newtab-delete-toast'
  toast.setAttribute('role', 'status')
  toast.setAttribute('aria-live', 'polite')

  const copy = document.createElement('div')
  copy.className = 'newtab-delete-toast-copy'

  const title = document.createElement('strong')
  title.textContent = '已删除书签'

  const detail = document.createElement('span')
  detail.textContent = state.deleteToastStatus || getBookmarkDisplayTitle(deleted.bookmark)

  copy.append(title, detail)

  const actions = document.createElement('div')
  actions.className = 'newtab-delete-toast-actions'

  const undo = document.createElement('button')
  undo.type = 'button'
  undo.dataset.undoDelete = 'true'
  undo.disabled = state.deleteToastBusy
  undo.textContent = state.deleteToastBusy ? '恢复中' : '撤销'
  undo.setAttribute('aria-label', `撤销删除：${bookmarkLabel}`)

  const recycle = document.createElement('button')
  recycle.type = 'button'
  recycle.dataset.openRecycle = 'true'
  recycle.textContent = '回收站'
  recycle.setAttribute('aria-label', `打开回收站查看：${bookmarkLabel}`)

  actions.append(undo, recycle)
  toast.append(copy, actions)
  document.body.appendChild(toast)
}

function scheduleRender({ updateClock = false } = {}): void {
  deferredRenderClockUpdate = deferredRenderClockUpdate || updateClock
  if (deferredRenderFrame) {
    return
  }

  deferredRenderFrame = window.requestAnimationFrame(() => {
    deferredRenderFrame = 0
    const shouldUpdateClock = deferredRenderClockUpdate
    deferredRenderClockUpdate = false
    render()
    if (shouldUpdateClock) {
      updateClockText()
    }
  })
}

function cancelScheduledAdaptiveNewTabLayoutUpdate(): void {
  if (!verticalCenterCollisionFrame) {
    return
  }

  window.cancelAnimationFrame(verticalCenterCollisionFrame)
  verticalCenterCollisionFrame = 0
}

function scheduleAdaptiveNewTabLayoutUpdate(): void {
  cancelScheduledAdaptiveNewTabLayoutUpdate()
  verticalCenterCollisionFrame = window.requestAnimationFrame(() => {
    verticalCenterCollisionFrame = 0
    updateAdaptiveSearchOffsetBounds()
    updateVerticalCenterCollisionOffset()
  })
}

function updateAdaptiveSearchOffsetBounds(): void {
  const page = root?.querySelector<HTMLElement>('.newtab-page')
  const slot = page?.querySelector<HTMLElement>('.newtab-search-slot')
  if (!page || !slot) {
    state.searchOffsetBounds = { ...SEARCH_OFFSET_BOUNDS_FALLBACK }
    state.searchWidthBounds = { ...SEARCH_WIDTH_BOUNDS_FALLBACK }
    syncSearchWidthControl()
    syncSearchOffsetControl()
    return
  }

  const shellRect = root?.getBoundingClientRect()
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth || 1280
  const slotRect = slot.getBoundingClientRect()
  const searchRect = slot.getBoundingClientRect()
  const previousModule = slot.previousElementSibling instanceof HTMLElement
    ? slot.previousElementSibling
    : null
  const primaryContent = page.dataset.iconVerticalCenter === 'true'
    ? page.querySelector<HTMLElement>(':scope > .newtab-primary-slot > .newtab-content')
    : null
  const viewportTop = shellRect?.top ?? 0
  const viewportBottom = shellRect?.bottom ??
    (document.documentElement.clientHeight || window.innerHeight || 0)
  const bounds = getAdaptiveSearchOffsetBounds({
    currentOffsetY: state.searchSettings.offsetY,
    searchTop: searchRect.top,
    searchBottom: searchRect.bottom,
    viewportTop,
    viewportBottom,
    previousModuleBottom: previousModule?.getBoundingClientRect().bottom,
    primaryContentTop: primaryContent?.getBoundingClientRect().top,
    minimumGap: NEWTAB_LAYOUT_SAFE_GAP,
    absoluteMin: SEARCH_OFFSET_ABSOLUTE_MIN,
    absoluteMax: SEARCH_OFFSET_ABSOLUTE_MAX
  })
  const widthBounds = getAdaptiveSearchWidthBounds({
    viewportWidth,
    containerWidth: slotRect.width
  })

  state.searchOffsetBounds = bounds
  state.searchWidthBounds = widthBounds
  slot.style.setProperty(
    '--search-width',
    `${clampNumber(state.searchSettings.width, widthBounds.min, widthBounds.max, DEFAULT_SEARCH_SETTINGS.width)}vw`
  )
  slot.style.setProperty(
    '--search-offset-y',
    `${clampNumber(state.searchSettings.offsetY, bounds.min, bounds.max, DEFAULT_SEARCH_SETTINGS.offsetY)}px`
  )
  syncSearchWidthControl()
  syncSearchOffsetControl()
}

function updateVerticalCenterCollisionOffset(): void {
  const page = root?.querySelector<HTMLElement>('.newtab-page[data-icon-vertical-center="true"]')
  if (!page) {
    return
  }

  const utilityStack = page.querySelector<HTMLElement>(':scope > .newtab-utility-stack')
  const primaryContent = page.querySelector<HTMLElement>(':scope > .newtab-primary-slot > .newtab-content')
  if (!utilityStack || !primaryContent) {
    page.style.removeProperty('--primary-collision-offset-y')
    return
  }

  page.style.setProperty('--primary-collision-offset-y', '0px')
  const utilityRect = utilityStack.getBoundingClientRect()
  const contentRect = primaryContent.getBoundingClientRect()
  const offset = getVerticalCenterCollisionOffset({
    utilityBottom: utilityRect.bottom,
    contentTop: contentRect.top
  })
  if (offset > 0) {
    page.style.setProperty('--primary-collision-offset-y', `${offset}px`)
  }
}

function createNewTabLayout(primaryContent: HTMLElement): HTMLElement {
  const modules: NewTabPageModule[] = []

  const clock = createClockWidget()
  if (clock) {
    modules.push({
      id: 'clock',
      element: clock,
      placement: 'utility'
    })
  } else {
    const spacer = document.createElement('div')
    spacer.className = 'newtab-clock-spacer'
    modules.push({
      id: 'clock-spacer',
      element: spacer,
      placement: 'utility'
    })
  }

  const search = createSearchWidget()
  if (search) {
    modules.push({
      id: 'search',
      element: search,
      placement: 'utility'
    })
  }

  modules.push({
    id: primaryContent.classList.contains('newtab-content') ? 'bookmarks' : 'state',
    element: primaryContent,
    placement: 'primary'
  })

  return createNewTabPage({ modules })
}

function createSearchWidget(): HTMLElement | null {
  const settings = state.searchSettings
  if (!settings.enabled) {
    return null
  }

  const slot = document.createElement('section')
  slot.className = 'newtab-search-slot'
  slot.style.setProperty('--search-width', `${settings.width}vw`)
  slot.style.setProperty('--search-height', `${settings.height}px`)
  slot.style.setProperty('--search-offset-y', `${settings.offsetY}px`)
  slot.setAttribute('aria-label', '搜索网页或书签')

  const form = document.createElement('form')
  form.className = 'newtab-search'
  form.style.setProperty('--search-width', `${settings.width}vw`)
  form.style.setProperty('--search-height', `${settings.height}px`)
  form.style.setProperty('--search-bg-alpha', String(settings.background / 100))
  form.setAttribute('role', 'search')
  form.setAttribute('aria-label', '搜索网页或书签')

  const input = document.createElement('input')
  const searchPlaceholder = getSearchPlaceholder(settings)
  input.className = 'newtab-search-input'
  input.type = 'search'
  input.autocomplete = 'off'
  input.enterKeyHint = 'search'
  input.placeholder = searchPlaceholder
  input.spellcheck = false
  input.setAttribute('role', 'combobox')
  input.setAttribute('aria-label', '输入关键词搜索书签，或按 Enter 搜索网页')
  input.setAttribute('aria-autocomplete', 'list')
  input.setAttribute('aria-controls', 'newtab-search-suggestions')
  input.setAttribute('aria-expanded', 'false')

  const clearButton = document.createElement('button')
  clearButton.className = 'newtab-search-clear hidden'
  clearButton.type = 'button'
  clearButton.setAttribute('aria-label', '清空搜索')
  clearButton.textContent = '×'

  const engineButton = document.createElement('button')
  engineButton.className = 'newtab-search-engine'
  engineButton.type = 'button'
  engineButton.setAttribute('aria-haspopup', 'menu')
  engineButton.setAttribute('aria-expanded', 'false')

  const updateEngineButton = () => {
    const engine = SEARCH_ENGINE_CONFIG_BY_ID.get(state.searchSettings.engine)
    const label = engine?.shortName || '搜索'
    engineButton.textContent = label
    engineButton.title = `当前引擎：${engine?.name || label}。Cmd/Ctrl+Enter 搜索前 ${SEARCH_MULTI_OPEN_LIMIT} 个启用引擎。`
    engineButton.setAttribute('aria-label', `选择搜索引擎，当前为 ${engine?.name || label}`)
  }

  const closeEngineMenu = ({ restoreFocus = false } = {}) => {
    const existingMenu = slot.querySelector<HTMLElement>('.newtab-search-engine-menu')
    existingMenu?.remove()
    engineButton.setAttribute('aria-expanded', 'false')
    if (restoreFocus) {
      engineButton.focus()
    }
  }

  const focusEngineMenuItem = (menu: HTMLElement, direction: 1 | -1 | 'first' | 'last') => {
    const items = [...menu.querySelectorAll<HTMLButtonElement>('.newtab-search-engine-item')]
    if (!items.length) {
      return
    }

    const activeElement = document.activeElement
    const currentIndex = items.findIndex((item) => item === activeElement)
    let nextIndex = items.findIndex((item) => item.classList.contains('active'))
    if (direction === 'first') {
      nextIndex = 0
    } else if (direction === 'last') {
      nextIndex = items.length - 1
    } else if (currentIndex >= 0) {
      nextIndex = (currentIndex + direction + items.length) % items.length
    } else if (nextIndex < 0) {
      nextIndex = direction > 0 ? 0 : items.length - 1
    }

    items[Math.max(0, nextIndex)]?.focus()
  }

  const renderEngineMenu = (initialFocus: 'active' | 'first' | 'last' | 'none' = 'none') => {
    closeEngineMenu()
    const menu = document.createElement('div')
    menu.className = 'newtab-search-engine-menu'
    menu.setAttribute('role', 'menu')
    menu.setAttribute('aria-label', '搜索引擎')

    for (const engineId of state.searchSettings.enabledEngines) {
      const engine = SEARCH_ENGINE_CONFIG_BY_ID.get(engineId)
      if (!engine) {
        continue
      }

      const item = document.createElement('button')
      item.className = `newtab-search-engine-item${engineId === state.searchSettings.engine ? ' active' : ''}`
      item.type = 'button'
      item.setAttribute('role', 'menuitemradio')
      item.setAttribute('aria-checked', String(engineId === state.searchSettings.engine))
      item.tabIndex = -1
      item.textContent = engine.name
      item.addEventListener('click', () => {
        state.searchSettings = normalizeSearchSettings({
          ...state.searchSettings,
          engine: engineId
        })
        scheduleSearchSettingsSave()
        updateEngineButton()
        closeEngineMenu()
        input.focus()
        scheduleSuggestionsRender({ preserveActive: true, immediate: true })
      })
      menu.appendChild(item)
    }

    menu.addEventListener('keydown', (event) => {
      if (
        event.key !== 'ArrowDown' &&
        event.key !== 'ArrowUp' &&
        event.key !== 'Home' &&
        event.key !== 'End' &&
        event.key !== 'Escape'
      ) {
        return
      }

      event.preventDefault()
      if (event.key === 'Escape') {
        closeEngineMenu({ restoreFocus: true })
        return
      }

      if (event.key === 'Home') {
        focusEngineMenuItem(menu, 'first')
      } else if (event.key === 'End') {
        focusEngineMenuItem(menu, 'last')
      } else {
        focusEngineMenuItem(menu, event.key === 'ArrowDown' ? 1 : -1)
      }
    })

    const hint = document.createElement('div')
    hint.className = 'newtab-search-engine-menu-hint'
    hint.textContent = `Cmd/Ctrl+Enter 打开前 ${SEARCH_MULTI_OPEN_LIMIT} 个启用引擎`
    menu.appendChild(hint)
    slot.appendChild(menu)
    engineButton.setAttribute('aria-expanded', 'true')

    if (initialFocus !== 'none') {
      focusEngineMenuItem(menu, initialFocus === 'last' ? 'last' : initialFocus === 'first' ? 'first' : 1)
    }
  }

  const separator = document.createElement('span')
  separator.className = 'newtab-search-separator hidden'
  separator.setAttribute('aria-hidden', 'true')

  const submitButton = document.createElement('button')
  submitButton.className = 'newtab-search-submit'
  submitButton.type = 'submit'
  submitButton.setAttribute('aria-label', '搜索网页')
  submitButton.title = '搜索网页'
  submitButton.disabled = true

  const icon = document.createElement('span')
  icon.className = 'newtab-search-icon'
  icon.setAttribute('aria-hidden', 'true')
  submitButton.appendChild(icon)

  const suggestionsPanel = document.createElement('div')
  suggestionsPanel.id = 'newtab-search-suggestions-panel'
  suggestionsPanel.className = 'newtab-search-suggestions-panel hidden'

  const suggestions = document.createElement('div')
  suggestions.id = 'newtab-search-suggestions'
  suggestions.className = 'newtab-search-suggestions'
  suggestions.setAttribute('role', 'listbox')
  suggestions.setAttribute('aria-label', '匹配的书签')

  const suggestionsHeading = document.createElement('div')
  suggestionsHeading.className = 'newtab-search-section-label'
  suggestionsHeading.textContent = '书签匹配'

  const suggestionsHint = document.createElement('div')
  suggestionsHint.className = 'newtab-search-hint'
  suggestionsHint.setAttribute('role', 'status')
  suggestionsHint.setAttribute('aria-live', 'polite')
  suggestionsHint.hidden = true

  suggestionsPanel.append(suggestionsHeading, suggestions, suggestionsHint)

  let searchSuggestions: SearchBookmarkSuggestion[] = []
  let activeSuggestionIndex = -1
  let suggestionDebounceTimer = 0
  let suggestionRequestId = 0

  const hideSuggestions = () => {
    window.clearTimeout(suggestionDebounceTimer)
    suggestionDebounceTimer = 0
    searchSuggestions = []
    activeSuggestionIndex = -1
    suggestions.replaceChildren()
    suggestions.hidden = false
    suggestionsHeading.textContent = '书签匹配'
    suggestionsHeading.hidden = false
    suggestionsHint.replaceChildren()
    suggestionsHint.hidden = true
    suggestionsPanel.classList.add('hidden')
    input.setAttribute('aria-expanded', 'false')
    input.removeAttribute('aria-activedescendant')
  }

  const renderSuggestions = (suggestionList: SearchBookmarkSuggestion[], {
    preserveActive = false,
    query = input.value
  }: {
    preserveActive?: boolean
    query?: string
  } = {}) => {
    const trimmedQuery = String(query || '').trim()
    const previousActiveIndex = activeSuggestionIndex
    searchSuggestions = suggestionList
    if (!searchSuggestions.length) {
      activeSuggestionIndex = -1
      suggestions.replaceChildren()
      suggestions.hidden = true
      input.removeAttribute('aria-activedescendant')
      if (!trimmedQuery) {
        hideSuggestions()
        return
      }

      suggestionsHeading.textContent = '网页搜索'
      suggestionsHeading.hidden = false
      suggestionsHint.replaceChildren(createSearchWebFallbackButton(trimmedQuery))
      suggestionsHint.hidden = false
      suggestionsPanel.classList.remove('hidden')
      input.setAttribute('aria-expanded', 'true')
      return
    }

    suggestions.hidden = false
    suggestionsHeading.textContent = '书签匹配'
    activeSuggestionIndex = preserveActive && previousActiveIndex >= 0
      ? Math.min(previousActiveIndex, searchSuggestions.length - 1)
      : -1

    suggestions.replaceChildren(...searchSuggestions.map((suggestion, index) =>
      createSearchSuggestionButton(
        suggestion,
        index,
        index === activeSuggestionIndex,
        (selectedSuggestion) => {
          input.value = selectedSuggestion.title
          syncSearchInputActions(input, clearButton, separator, submitButton)
          hideSuggestions()
          openBookmarkSuggestion(selectedSuggestion)
        }
      )
    ))
    suggestionsPanel.classList.remove('hidden')
    suggestionsHeading.hidden = false
    suggestionsHint.textContent = `按 ↓ 选择书签，选中后 Enter 打开；Cmd/Ctrl+Enter 用 ${getSearchEngineDisplayName()} 搜索网页`
    suggestionsHint.hidden = false
    input.setAttribute('aria-expanded', 'true')

    if (activeSuggestionIndex >= 0) {
      input.setAttribute('aria-activedescendant', getSearchSuggestionElementId(activeSuggestionIndex))
    } else {
      input.removeAttribute('aria-activedescendant')
    }
  }

  const scheduleSuggestionsRender = ({ preserveActive = false, immediate = false } = {}) => {
    const query = input.value
    const requestId = suggestionRequestId + 1
    suggestionRequestId = requestId
    window.clearTimeout(suggestionDebounceTimer)

    const renderCurrentSuggestions = () => {
      void getSearchBookmarkSuggestions(query).then((directSuggestions) => {
        if (requestId !== suggestionRequestId) {
          return
        }

        renderSuggestions(directSuggestions, { preserveActive, query })
        if (!shouldLoadNaturalSearchSuggestions(query, directSuggestions)) {
          return
        }

        void getNaturalSearchBookmarkSuggestions(query).then((naturalSuggestions) => {
          if (requestId !== suggestionRequestId) {
            return
          }

          renderSuggestions(naturalSuggestions, { preserveActive: true, query })
        }).catch(() => {
          // Keep the popup-aligned suggestions visible if the optional natural-search chunk fails to load.
        })
      }).catch(() => {
        if (requestId !== suggestionRequestId) {
          return
        }

        renderSuggestions([], { preserveActive, query })
      })
    }

    if (!query.trim() || immediate) {
      suggestionDebounceTimer = 0
      renderCurrentSuggestions()
      return
    }

    suggestionDebounceTimer = window.setTimeout(() => {
      suggestionDebounceTimer = 0
      if (requestId !== suggestionRequestId) {
        return
      }
      renderCurrentSuggestions()
    }, SEARCH_SUGGESTION_DEBOUNCE_MS)
  }

  const moveActiveSuggestion = (direction: 1 | -1) => {
    if (!searchSuggestions.length) {
      scheduleSuggestionsRender({ preserveActive: true, immediate: true })
    }
    if (!searchSuggestions.length) {
      return
    }

    activeSuggestionIndex = activeSuggestionIndex < 0
      ? (direction > 0 ? 0 : searchSuggestions.length - 1)
      : (activeSuggestionIndex + direction + searchSuggestions.length) % searchSuggestions.length
    renderSuggestions(searchSuggestions, { preserveActive: true, query: input.value })
  }

  input.addEventListener('input', () => {
    syncSearchInputActions(input, clearButton, separator, submitButton)
    scheduleSuggestionsRender()
  })
  input.addEventListener('focus', () => {
    scheduleSuggestionsRender({ immediate: true })
  })
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveActiveSuggestion(event.key === 'ArrowDown' ? 1 : -1)
      return
    }

    if (event.key === 'Enter' && activeSuggestionIndex >= 0 && !event.metaKey && !event.ctrlKey) {
      const suggestion = searchSuggestions[activeSuggestionIndex]
      if (suggestion) {
        event.preventDefault()
        input.value = suggestion.title
        syncSearchInputActions(input, clearButton, separator, submitButton)
        hideSuggestions()
        openBookmarkSuggestion(suggestion)
      }
      return
    }

    if (event.key !== 'Escape') {
      return
    }

    event.preventDefault()
    if (searchSuggestions.length || !suggestionsPanel.classList.contains('hidden')) {
      hideSuggestions()
      return
    }

    if (input.value) {
      input.value = ''
      syncSearchInputActions(input, clearButton, separator, submitButton)
      return
    }

    input.blur()
  })
  clearButton.addEventListener('click', () => {
    input.value = ''
    syncSearchInputActions(input, clearButton, separator, submitButton)
    hideSuggestions()
    input.focus()
  })
  engineButton.addEventListener('click', () => {
    if (engineButton.getAttribute('aria-expanded') === 'true') {
      closeEngineMenu()
      return
    }
    renderEngineMenu('active')
  })
  engineButton.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return
    }

    event.preventDefault()
    renderEngineMenu(event.key === 'ArrowDown' ? 'first' : 'last')
  })
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    closeEngineMenu()
    hideSuggestions()
    submitSearch(input.value)
  })
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      closeEngineMenu()
      hideSuggestions()
      submitSearch(input.value, true)
    }
  })
  slot.addEventListener('focusout', () => {
    window.setTimeout(() => {
      if (!slot.contains(document.activeElement)) {
        closeEngineMenu()
        hideSuggestions()
      }
    }, 0)
  })

  updateEngineButton()
  form.append(input, clearButton, separator, engineButton, submitButton)
  syncSearchInputActions(input, clearButton, separator, submitButton)
  slot.append(form, suggestionsPanel)
  return slot

  function createSearchWebFallbackButton(query: string): HTMLButtonElement {
    const button = document.createElement('button')
    button.className = 'newtab-search-web-hint'
    button.type = 'button'
    button.textContent = `未找到书签；按 Enter 仅在本页用 ${getSearchEngineDisplayName()} 搜索网页`
    button.title = `用 ${getSearchEngineDisplayName()} 搜索「${query}」`
    button.setAttribute('aria-label', button.textContent)
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault()
    })
    button.addEventListener('click', () => {
      closeEngineMenu()
      hideSuggestions()
      submitSearch(query)
    })
    return button
  }

  function getSearchEngineDisplayName(): string {
    return SEARCH_ENGINE_CONFIG_BY_ID.get(state.searchSettings.engine)?.name || 'Google'
  }
}

function syncSearchInputActions(
  input: HTMLInputElement,
  clearButton: HTMLButtonElement,
  separator: HTMLElement,
  submitButton: HTMLButtonElement
): void {
  const hasValue = Boolean(input.value.trim())
  clearButton.classList.toggle('hidden', !input.value)
  separator.classList.toggle('hidden', !input.value)
  submitButton.disabled = !hasValue
  submitButton.setAttribute('aria-disabled', String(!hasValue))
}

const searchSuggestionCache = new Map<string, Promise<SearchBookmarkSuggestion[]>>()
const naturalSearchSuggestionCache = new Map<string, Promise<SearchBookmarkSuggestion[]>>()

function getSearchBookmarkSuggestions(query: string): Promise<SearchBookmarkSuggestion[]> {
  const cacheKey = getSearchSuggestionCacheKey(query)
  const cached = searchSuggestionCache.get(cacheKey)
  if (cached) {
    searchSuggestionCache.delete(cacheKey)
    searchSuggestionCache.set(cacheKey, cached)
    return cached
  }

  const suggestionsPromise = getPopupSearchBookmarkSuggestionsFromIndex(
    query,
    state.preparedSearchIndex,
    SEARCH_SUGGESTION_LIMIT
  )
  searchSuggestionCache.set(cacheKey, suggestionsPromise)
  while (searchSuggestionCache.size > SEARCH_SUGGESTION_CACHE_LIMIT) {
    const oldestKey = searchSuggestionCache.keys().next().value
    if (!oldestKey) {
      break
    }
    searchSuggestionCache.delete(oldestKey)
  }
  return suggestionsPromise
}

function getNaturalSearchBookmarkSuggestions(query: string): Promise<SearchBookmarkSuggestion[]> {
  const cacheKey = getSearchSuggestionCacheKey(query)
  const cached = naturalSearchSuggestionCache.get(cacheKey)
  if (cached) {
    naturalSearchSuggestionCache.delete(cacheKey)
    naturalSearchSuggestionCache.set(cacheKey, cached)
    return cached
  }

  const suggestionsPromise = getNaturalSearchBookmarkSuggestionsFromIndex(
    query,
    state.preparedSearchIndex,
    SEARCH_SUGGESTION_LIMIT
  )
  naturalSearchSuggestionCache.set(cacheKey, suggestionsPromise)
  while (naturalSearchSuggestionCache.size > SEARCH_SUGGESTION_CACHE_LIMIT) {
    const oldestKey = naturalSearchSuggestionCache.keys().next().value
    if (!oldestKey) {
      break
    }
    naturalSearchSuggestionCache.delete(oldestKey)
  }
  return suggestionsPromise
}

function shouldLoadNaturalSearchSuggestions(
  query: string,
  directSuggestions: SearchBookmarkSuggestion[]
): boolean {
  const normalizedQuery = normalizeNewTabSearchText(query)
  if (!normalizedQuery) {
    return false
  }
  if (!directSuggestions.length) {
    return true
  }
  return /帮我|帮忙|麻烦|请|找|搜索|查找|收藏|书签|不要|不看|排除|过滤|剔除|去掉|最近|近期|过去|上周|本周|今天|昨天/
    .test(normalizedQuery) ||
    /\b(?:last|this|recent|recently|saved|bookmark|bookmarks|without|exclude|excluding|not|no|find|show)\b/i
      .test(normalizedQuery)
}

function normalizeNewTabBookmarkTagIndex(raw: unknown): BookmarkTagIndex {
  const source = raw && typeof raw === 'object'
    ? raw as { updatedAt?: unknown; records?: unknown }
    : {}
  const rawRecords = source.records && typeof source.records === 'object'
    ? source.records as Record<string, unknown>
    : {}
  const records: BookmarkTagIndex['records'] = {}

  for (const [fallbackBookmarkId, rawRecord] of Object.entries(rawRecords)) {
    const record = normalizeNewTabBookmarkTagRecord(rawRecord, fallbackBookmarkId)
    if (record) {
      records[record.bookmarkId] = record
    }
  }

  return {
    version: 1,
    updatedAt: normalizeNewTabTimestamp(source.updatedAt) || getLatestNewTabBookmarkTagUpdatedAt(records),
    records
  }
}

function normalizeNewTabBookmarkTagRecord(raw: unknown, fallbackBookmarkId: string): BookmarkTagRecord | null {
  const source = raw && typeof raw === 'object'
    ? raw as Record<string, unknown>
    : {}
  const bookmarkId = normalizeNewTabTagText(source.bookmarkId || fallbackBookmarkId)
  const url = normalizeNewTabTagText(source.url)
  if (!bookmarkId || !url) {
    return null
  }

  const generatedAt = normalizeNewTabTimestamp(source.generatedAt) || Date.now()
  const updatedAt = normalizeNewTabTimestamp(source.updatedAt) || generatedAt
  const manualTags = normalizeNewTabBookmarkTagList(source.manualTags, 12)
  const record: BookmarkTagRecord = {
    schemaVersion: 1,
    bookmarkId,
    url,
    normalizedUrl: normalizeNewTabTagText(source.normalizedUrl || url),
    duplicateKey: normalizeNewTabTagText(source.duplicateKey || source.normalizedUrl || url),
    title: normalizeNewTabTagText(source.title, 180),
    path: normalizeNewTabTagText(source.path, 240),
    summary: normalizeNewTabTagText(source.summary, 500),
    contentType: normalizeNewTabTagText(source.contentType || source.content_type, 40),
    topics: normalizeNewTabTagTextList(source.topics, 8, 40),
    tags: normalizeNewTabBookmarkTagList(source.tags, 12),
    aliases: normalizeNewTabTagTextList(source.aliases, 20, 40),
    confidence: normalizeNewTabTagConfidence(source.confidence),
    source: normalizeNewTabBookmarkTagSource(source.source),
    model: normalizeNewTabTagText(source.model, 120),
    extraction: normalizeNewTabBookmarkTagExtraction(source.extraction),
    generatedAt,
    updatedAt
  }

  if (manualTags.length) {
    record.manualTags = manualTags
    record.manualUpdatedAt = normalizeNewTabTimestamp(source.manualUpdatedAt) || updatedAt
  }

  return record
}

function normalizeNewTabBookmarkTagExtraction(raw: unknown): BookmarkTagExtraction {
  const source = raw && typeof raw === 'object'
    ? raw as { status?: unknown; source?: unknown; warnings?: unknown }
    : {}

  return {
    status: normalizeNewTabTagText(source.status, 40),
    source: normalizeNewTabTagText(source.source, 80),
    warnings: normalizeNewTabTagTextList(source.warnings, 4, 40)
  }
}

function normalizeNewTabBookmarkTagSource(value: unknown): BookmarkTagSource {
  const source = String(value || '').trim()
  return source === 'ai_naming' ||
    source === 'auto_analyze' ||
    source === 'popup_smart' ||
    source === 'imported' ||
    source === 'manual'
    ? source
    : 'imported'
}

function normalizeNewTabBookmarkTagList(value: unknown, limit: number): string[] {
  return normalizeNewTabTagTextList(value, limit, 24)
}

function normalizeNewTabTagTextList(value: unknown, limit: number, itemLimit: number): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,，、\n]/)
      : []
  const seen = new Set<string>()
  const output: string[] = []

  for (const item of values) {
    const text = normalizeNewTabTagText(item, itemLimit)
    const key = text.toLowerCase()
    if (!text || seen.has(key)) {
      continue
    }
    seen.add(key)
    output.push(text)
    if (output.length >= limit) {
      break
    }
  }

  return output
}

function normalizeNewTabTagText(value: unknown, limit = 1000): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

function normalizeNewTabTagConfidence(value: unknown): number {
  const rawNumber = typeof value === 'number'
    ? value
    : Number(String(value ?? '').replace(/%$/, ''))
  if (!Number.isFinite(rawNumber)) {
    return 0
  }
  const normalized = rawNumber > 1 && rawNumber <= 100 ? rawNumber / 100 : rawNumber
  return Math.max(0, Math.min(normalized, 1))
}

function normalizeNewTabTimestamp(value: unknown): number {
  const timestamp = Number(value)
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0
}

function getLatestNewTabBookmarkTagUpdatedAt(records: BookmarkTagIndex['records']): number {
  return Object.values(records).reduce((latest, record) => Math.max(latest, Number(record.updatedAt) || 0), 0)
}

function normalizeNewTabContentSnapshotIndex(raw: unknown): ContentSnapshotIndex {
  const source = raw && typeof raw === 'object'
    ? raw as { updatedAt?: unknown; records?: unknown }
    : {}
  const rawRecords = source.records && typeof source.records === 'object'
    ? source.records as Record<string, unknown>
    : {}
  const records: ContentSnapshotIndex['records'] = {}

  for (const [fallbackBookmarkId, rawRecord] of Object.entries(rawRecords)) {
    const record = normalizeNewTabContentSnapshotRecord(rawRecord, fallbackBookmarkId)
    if (record.bookmarkId && record.snapshotId) {
      records[record.bookmarkId] = record
    }
  }

  return {
    version: 1,
    updatedAt: Number(source.updatedAt) || 0,
    records
  }
}

function normalizeNewTabContentSnapshotRecord(raw: unknown, fallbackBookmarkId: string): ContentSnapshotIndex['records'][string] {
  const source = raw && typeof raw === 'object'
    ? raw as Record<string, unknown>
    : {}
  const bookmarkId = String(source.bookmarkId || fallbackBookmarkId || '').trim()
  const snapshotId = String(source.snapshotId || bookmarkId || '').trim()
  const fullTextStorage = ['local', 'idb'].includes(String(source.fullTextStorage))
    ? String(source.fullTextStorage) as ContentSnapshotIndex['records'][string]['fullTextStorage']
    : 'none'

  return {
    snapshotId,
    bookmarkId,
    url: String(source.url || '').trim(),
    title: normalizeNewTabSnapshotText(source.title),
    summary: normalizeNewTabSnapshotText(source.summary),
    headings: normalizeNewTabSnapshotTextList(source.headings, 28),
    canonicalUrl: String(source.canonicalUrl || '').trim(),
    finalUrl: String(source.finalUrl || '').trim(),
    contentType: normalizeNewTabSnapshotText(source.contentType),
    source: normalizeNewTabSnapshotText(source.source),
    extractionStatus: normalizeNewTabSnapshotText(source.extractionStatus),
    extractedAt: Number(source.extractedAt) || 0,
    hasFullText: source.hasFullText === true,
    fullTextBytes: Number(source.fullTextBytes) || 0,
    fullTextStorage,
    fullText: undefined,
    fullTextRef: fullTextStorage === 'idb' ? String(source.fullTextRef || snapshotId || '').trim() : undefined,
    warnings: normalizeNewTabSnapshotTextList(source.warnings, 8)
  }
}

function normalizeNewTabSnapshotText(value: unknown, limit = 500): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

function normalizeNewTabSnapshotTextList(value: unknown, limit: number): string[] {
  return Array.isArray(value)
    ? value.map((item) => normalizeNewTabSnapshotText(item, 120)).filter(Boolean).slice(0, limit)
    : []
}

function getSearchSuggestionCacheKey(query: string): string {
  return [
    state.preparedSearchIndex.entries.length,
    state.bookmarkTagIndex?.updatedAt || 0,
    state.searchSnapshotIndex?.updatedAt || 0,
    normalizeNewTabSearchText(query)
  ].join(':')
}

function createSearchSuggestionButton(
  suggestion: SearchBookmarkSuggestion,
  index: number,
  active: boolean,
  onSelect: (suggestion: SearchBookmarkSuggestion) => void
): HTMLButtonElement {
  const button = document.createElement('button')
  button.id = getSearchSuggestionElementId(index)
  button.className = `newtab-search-suggestion${active ? ' active' : ''}`
  button.type = 'button'
  button.setAttribute('role', 'option')
  button.setAttribute('aria-selected', String(active))
  button.setAttribute('aria-label', `打开书签：${suggestion.title}`)
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault()
  })
  button.addEventListener('click', () => {
    onSelect(suggestion)
  })

  const mark = document.createElement('span')
  mark.className = 'newtab-search-suggestion-mark'
  mark.setAttribute('aria-hidden', 'true')
  mark.textContent = getFallbackLabel(suggestion.title)

  const copy = document.createElement('span')
  copy.className = 'newtab-search-suggestion-copy'

  const title = document.createElement('strong')
  title.textContent = suggestion.title

  const meta = document.createElement('span')
  const source = suggestion.folderPath || suggestion.folderTitle
  meta.textContent = source
    ? `${source} · ${formatSearchSuggestionUrl(suggestion.url)}`
    : formatSearchSuggestionUrl(suggestion.url)

  copy.append(title, meta)
  button.append(mark, copy)
  return button
}

function getSearchSuggestionElementId(index: number): string {
  return `newtab-search-suggestion-${index}`
}

function formatSearchSuggestionUrl(url: string): string {
  try {
    const parsedUrl = new URL(url)
    const pathname = parsedUrl.pathname === '/' ? '' : parsedUrl.pathname
    return `${parsedUrl.hostname}${pathname}`
  } catch {
    return url.replace(/^https?:\/\//i, '')
  }
}

function openBookmarkSuggestion(suggestion: SearchBookmarkSuggestion): void {
  const bookmark = state.allBookmarkMap.get(String(suggestion.id)) || getBookmarkById(suggestion.id)
  if (!bookmark) {
    openSearchTarget(suggestion.url)
    return
  }

  void recordBookmarkOpen(bookmark)
  openSearchTarget(suggestion.url)
}

function createClockWidget(): HTMLElement | null {
  const settings = state.timeSettings
  if (!settings.enabled) {
    return null
  }

  const clock = document.createElement('section')
  clock.className = 'newtab-clock'
  clock.style.setProperty('--clock-scale', String(settings.clockSize / 100))
  const now = new Date()
  clock.dataset.clockDisplayMode = settings.displayMode
  clock.dataset.clockDensity = settings.density
  clock.dataset.clockShowSeconds = String(settings.showSeconds && settings.displayMode !== 'date')
  clock.dataset.clockHour12 = String(settings.hour12 && settings.displayMode !== 'date')
  clock.setAttribute('aria-label', getClockAriaLabel(now, settings))

  if (settings.displayMode !== 'date') {
    const timeGroup = document.createElement('span')
    timeGroup.className = 'newtab-clock-time-group'

    const time = document.createElement('time')
    time.className = 'newtab-clock-time'
    time.dataset.clockTime = 'true'
    time.dateTime = formatClockTimeDateTime(now, settings)
    time.textContent = formatClockTime(now, settings)
    timeGroup.appendChild(time)

    if (settings.hour12) {
      const period = document.createElement('span')
      period.className = 'newtab-clock-period'
      period.dataset.clockPeriod = 'true'
      period.textContent = formatClockPeriod(now, settings)
      timeGroup.appendChild(period)
    }

    clock.appendChild(timeGroup)
  }

  if (settings.displayMode !== 'time') {
    const date = document.createElement('time')
    date.className = 'newtab-clock-date'
    date.dataset.clockDate = 'true'
    date.dateTime = formatClockDateTime(now, settings)
    date.textContent = formatClockDate(now, settings)
    clock.appendChild(date)
  }

  return clock
}

function createBookmarkSections(sections: NewTabFolderSection[]): HTMLElement {
  const view = document.createElement('section')
  view.className = 'newtab-content'
  const gridSettings = {
    ...state.iconSettings,
    columns: getResponsiveIconColumns(state.iconSettings)
  }
  view.style.setProperty('--icon-page-width', `${getIconPageWidthPx(state.iconSettings.pageWidth)}px`)
  view.style.setProperty('--icon-column-gap', `${getIconGapPx(state.iconSettings.columnGap)}px`)
  view.style.setProperty('--icon-row-gap', `${getIconRowGapPx(state.iconSettings.rowGap)}px`)
  view.style.setProperty('--icon-folder-gap', `${getFolderGapPx(state.iconSettings.folderGap)}px`)
  view.style.setProperty('--icon-tile-width', `${getEffectiveIconTileWidthPx(state.iconSettings)}px`)
  view.style.setProperty('--icon-shell-size', `${state.iconSettings.iconShellSize}px`)
  view.style.setProperty('--icon-fixed-grid-width', `${getFixedIconGridWidthPx(gridSettings)}px`)
  view.style.setProperty('--icon-columns', String(gridSettings.columns))
  view.style.setProperty('--icon-title-lines', String(state.iconSettings.titleLines))
  view.dataset.iconLayoutMode = state.iconSettings.layoutMode
  view.dataset.iconShowTitles = String(state.iconSettings.showTitles)
  view.dataset.iconVerticalCenter = String(state.iconSettings.verticalCenter)
  view.setAttribute('aria-busy', state.reorderingBookmarks ? 'true' : 'false')

  const commandPalette = createCommandPaletteOverlay()
  if (commandPalette) {
    view.appendChild(commandPalette)
  }

  const workspaceSwitcher = createWorkspaceSwitcher()
  if (workspaceSwitcher) {
    view.appendChild(workspaceSwitcher)
  }

  const speedDial = createSpeedDialPanel()
  if (speedDial) {
    view.appendChild(speedDial)
  }

  const health = createBookmarkHealthPanel()
  if (health) {
    view.appendChild(health)
  }

  const portal = createPortalPanel()
  if (portal) {
    view.appendChild(portal)
  }

  const sourceNavigation = createSourceNavigation(sections)
  if (sourceNavigation) {
    view.appendChild(sourceNavigation)
  }

  const groupList = document.createElement('div')
  groupList.className = 'bookmark-folder-sections'
  let renderedBookmarkIndex = 0

  for (const section of sections) {
    const sectionNode = document.createElement('section')
    sectionNode.className = 'bookmark-folder-section'
    sectionNode.id = getNewTabSourceAnchorId(section.id)
    sectionNode.dataset.folderSectionId = section.id
    sectionNode.tabIndex = -1
    if (section.id === state.draggingFolderId && state.folderDragOriginalOrderIds.length) {
      sectionNode.classList.add('dragging-folder')
    }

    const header = document.createElement('button')
    header.className = 'folder-section-header'
    header.type = 'button'
    header.dataset.folderDragHandle = section.id
    header.title = section.path || section.title
    header.setAttribute('aria-label', `${section.title}，长按拖拽调整文件夹顺序`)
    if (section.id === state.draggingFolderId && state.folderDragOriginalOrderIds.length) {
      header.classList.add('dragging')
    }

    const title = document.createElement('span')
    title.className = 'folder-section-title'
    title.textContent = section.title || '未命名文件夹'

    const count = document.createElement('span')
    count.className = 'folder-section-count'
    count.textContent = String(section.bookmarks.length)

    header.append(title, count)

    const headerRow = document.createElement('div')
    headerRow.className = 'folder-section-header-row'
    headerRow.append(header, createFolderAddButton(section))
    sectionNode.appendChild(headerRow)

    if (section.bookmarks.length) {
      const list = document.createElement('nav')
      list.className = 'bookmark-grid'
      list.dataset.bookmarkGridFolderId = section.id
      list.setAttribute('aria-label', `${section.title || '文件夹'}书签`)
      list.setAttribute('aria-busy', state.reorderingBookmarks ? 'true' : 'false')
      renderedBookmarkIndex = appendBookmarkTilesInChunks(
        list,
        section,
        renderedBookmarkIndex,
        bookmarkTileRenderVersion
      )

      sectionNode.appendChild(list)
    } else {
      sectionNode.appendChild(createEmptyFolderState(section))
    }

    groupList.appendChild(sectionNode)
  }

  const reorderStatusMessage = state.bookmarkReorderError || state.folderReorderStatus
  if (reorderStatusMessage) {
    const status = document.createElement('p')
    status.className = 'bookmark-reorder-status'
    status.dataset.tone = state.bookmarkReorderError ? 'error' : state.folderReorderStatusTone
    status.setAttribute('role', 'status')
    status.textContent = reorderStatusMessage
    groupList.appendChild(status)
  }

  view.appendChild(groupList)
  return view
}

function getActiveWorkspacePinnedIds(): string[] {
  return getActiveNewTabWorkspace(state.workspaceSettings).pinnedIds
}

function getActiveWorkspaceName(): string {
  return getActiveNewTabWorkspace(state.workspaceSettings).name
}

function createWorkspaceSwitcher(): HTMLElement | null {
  if (!state.moduleSettings.speedDial) {
    return null
  }

  const activeWorkspace = getActiveNewTabWorkspace(state.workspaceSettings)
  const section = document.createElement('section')
  section.className = 'newtab-workspaces'
  section.setAttribute('aria-label', '书签场景')

  const label = document.createElement('span')
  label.className = 'newtab-workspaces-label'
  label.textContent = '场景'

  const list = document.createElement('div')
  list.className = 'newtab-workspace-list'
  list.setAttribute('role', 'listbox')
  list.setAttribute('aria-label', '切换书签场景')

  for (const workspace of state.workspaceSettings.workspaces) {
    const button = document.createElement('button')
    button.className = 'newtab-workspace-pill'
    button.type = 'button'
    button.dataset.workspaceId = workspace.id
    button.setAttribute('role', 'option')
    button.setAttribute('aria-selected', String(workspace.id === activeWorkspace.id))
    button.textContent = workspace.name
    button.addEventListener('click', () => {
      void switchNewTabWorkspace(workspace.id)
    })
    list.appendChild(button)
  }

  const manageButton = document.createElement('button')
  manageButton.className = 'newtab-workspace-manage'
  manageButton.type = 'button'
  manageButton.textContent = '管理'
  manageButton.addEventListener('click', openWorkspaceSettings)

  section.append(label, list, manageButton)
  return section
}

function createSpeedDialPanel(): HTMLElement | null {
  if (!state.moduleSettings.speedDial) {
    return null
  }

  const activeWorkspace = getActiveNewTabWorkspace(state.workspaceSettings)
  const items = buildSpeedDialItems({
    pinnedIds: activeWorkspace.pinnedIds,
    bookmarks: state.allBookmarkMap
  })
  const section = document.createElement('section')
  section.className = 'newtab-speed-dial'
  section.setAttribute('aria-label', `${activeWorkspace.name} Speed Dial`)

  const header = document.createElement('div')
  header.className = 'newtab-module-heading'
  const title = document.createElement('h2')
  title.textContent = 'Speed Dial'
  const meta = document.createElement('span')
  meta.textContent = `${activeWorkspace.name} · ${items.length} 个固定入口`
  header.append(title, meta)
  section.appendChild(header)

  if (!items.length) {
    section.appendChild(createSpeedDialEmptyPanel(activeWorkspace.name))
    return section
  }

  const list = document.createElement('div')
  list.className = 'newtab-speed-dial-grid'
  for (const item of items) {
    const bookmark = getBookmarkById(item.id)
    if (!bookmark?.url) {
      continue
    }
    list.appendChild(createSpeedDialLink(item, bookmark))
  }

  section.appendChild(list)
  return section
}

function createSpeedDialEmptyPanel(workspaceName: string): HTMLElement {
  const emptyState = createSpeedDialEmptyState(workspaceName)
  const empty = document.createElement('div')
  empty.className = 'newtab-speed-dial-empty'

  const copy = document.createElement('div')
  copy.className = 'newtab-speed-dial-empty-copy'
  const title = document.createElement('strong')
  title.textContent = emptyState.title
  const detail = document.createElement('span')
  detail.textContent = emptyState.detail
  copy.append(title, detail)
  empty.appendChild(copy)
  return empty
}

function createSpeedDialLink(
  item: ReturnType<typeof buildSpeedDialItems>[number],
  bookmark: chrome.bookmarks.BookmarkTreeNode
): HTMLAnchorElement {
  const link = document.createElement('a')
  link.className = 'newtab-speed-dial-card'
  link.href = item.url
  link.title = item.title
  link.draggable = false
  link.dataset.bookmarkId = item.id
  bindBookmarkNavigation(link, bookmark)
  applyCachedFaviconAccent(link, item.id, item.url)

  const mark = document.createElement('span')
  mark.className = 'newtab-speed-dial-mark'
  mark.setAttribute('aria-hidden', 'true')
  mark.textContent = item.fallbackLabel

  const copy = document.createElement('span')
  copy.className = 'newtab-speed-dial-copy'
  const title = document.createElement('strong')
  title.textContent = item.title
  const detail = document.createElement('span')
  detail.textContent = item.detail
  copy.append(title, detail)

  link.append(mark, copy)
  return link
}

function createBookmarkHealthPanel(): HTMLElement | null {
  if (!state.moduleSettings.health) {
    return null
  }

  const health = buildNewTabBookmarkHealth({
    bookmarks: getAllBookmarkRecords(),
    tagIndex: state.bookmarkTagIndex,
    snapshotIndex: state.searchSnapshotIndex,
    activity: state.activity
  })
  const visibleCards = health.cards.filter((card) => card.count > 0).slice(0, 4)
  const cards = visibleCards.length ? visibleCards : health.cards.slice(0, 3)

  if (!hasActionableBookmarkHealth(health.cards) && health.totalBookmarks <= 0) {
    return null
  }

  const section = document.createElement('section')
  section.className = 'newtab-bookmark-health'
  section.setAttribute('aria-label', '书签健康提醒')

  const header = document.createElement('div')
  header.className = 'newtab-module-heading'
  const title = document.createElement('h2')
  title.textContent = '书签健康'
  const meta = document.createElement('span')
  meta.textContent = hasActionableBookmarkHealth(health.cards)
    ? '轻量整理提醒'
    : '当前没有明显待处理项'
  header.append(title, meta)

  const list = document.createElement('div')
  list.className = 'newtab-health-grid'
  for (const card of cards) {
    const button = document.createElement('button')
    button.className = 'newtab-health-card'
    button.type = 'button'
    button.dataset.severity = card.severity
    button.addEventListener('click', () => {
      openOptionsHash(card.actionHash)
    })

    const count = document.createElement('strong')
    count.textContent = String(card.count)
    const label = document.createElement('span')
    label.textContent = card.label
    const detail = document.createElement('small')
    detail.textContent = card.detail
    button.append(count, label, detail)
    list.appendChild(button)
  }

  section.append(header, list)
  return section
}

function createCommandPaletteOverlay(): HTMLElement | null {
  if (!state.commandPaletteOpen) {
    return null
  }

  const items = getCurrentCommandPaletteItems()
  const overlay = document.createElement('section')
  overlay.className = 'newtab-command-palette'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', '命令面板')

  const panel = document.createElement('div')
  panel.className = 'newtab-command-palette-panel'

  const input = document.createElement('input')
  input.className = 'newtab-command-palette-input'
  input.type = 'search'
  input.placeholder = '搜索书签、固定入口、切换场景或打开整理工具'
  input.value = state.commandPaletteQuery
  input.setAttribute('aria-label', '搜索命令')
  input.setAttribute('aria-controls', 'newtab-command-palette-results')
  input.addEventListener('input', () => {
    state.commandPaletteQuery = input.value
    state.commandPaletteActiveIndex = 0
    scheduleRender()
  })

  const list = document.createElement('div')
  list.id = 'newtab-command-palette-results'
  list.className = 'newtab-command-palette-results'
  list.setAttribute('role', 'listbox')

  items.forEach((item, index) => {
    const button = document.createElement('button')
    button.className = 'newtab-command-palette-item'
    button.type = 'button'
    button.dataset.commandId = item.id
    button.dataset.commandType = item.type
    button.setAttribute('role', 'option')
    button.setAttribute('aria-selected', String(index === state.commandPaletteActiveIndex))
    button.addEventListener('click', () => {
      void executeCommandPaletteItem(item)
    })

    const title = document.createElement('strong')
    title.textContent = item.title
    const detail = document.createElement('span')
    detail.textContent = item.detail
    button.append(title, detail)
    list.appendChild(button)
  })

  if (!items.length) {
    const empty = document.createElement('p')
    empty.className = 'newtab-command-palette-empty'
    empty.textContent = '没有匹配命令。试试书签标题、URL、场景名或“重复”“整理”。'
    list.appendChild(empty)
  }

  panel.append(input, list)
  overlay.appendChild(panel)
  overlay.addEventListener('pointerdown', (event) => {
    if (event.target === overlay) {
      closeCommandPalette()
    }
  })

  window.requestAnimationFrame(() => {
    const activeInput = document.querySelector<HTMLInputElement>('.newtab-command-palette-input')
    activeInput?.focus()
    activeInput?.setSelectionRange(activeInput.value.length, activeInput.value.length)
  })

  return overlay
}

function getCurrentCommandPaletteItems(): CommandPaletteItem[] {
  return buildCommandPaletteItems({
    query: state.commandPaletteQuery,
    searchIndex: state.searchIndex,
    pinnedIds: getActiveWorkspacePinnedIds(),
    workspaces: state.workspaceSettings.workspaces,
    activeWorkspaceId: state.workspaceSettings.activeWorkspaceId,
    limit: 12
  })
}

function openCommandPalette(): void {
  closeBookmarkMenu()
  closeAddBookmarkMenu()
  state.commandPaletteOpen = true
  state.commandPaletteQuery = ''
  state.commandPaletteActiveIndex = 0
  render()
}

function closeCommandPalette(): void {
  state.commandPaletteOpen = false
  state.commandPaletteQuery = ''
  state.commandPaletteActiveIndex = 0
  render()
}

function handleCommandPaletteKeydown(event: KeyboardEvent): void {
  if (!state.commandPaletteOpen) {
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    closeCommandPalette()
    return
  }

  const items = getCurrentCommandPaletteItems()
  if (!items.length) {
    return
  }

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const direction = event.key === 'ArrowDown' ? 1 : -1
    state.commandPaletteActiveIndex =
      (state.commandPaletteActiveIndex + direction + items.length) % items.length
    scheduleRender()
    return
  }

  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    state.commandPaletteActiveIndex = event.key === 'Home' ? 0 : items.length - 1
    scheduleRender()
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    void executeCommandPaletteItem(items[state.commandPaletteActiveIndex] || items[0])
  }
}

async function executeCommandPaletteItem(item: CommandPaletteItem | undefined): Promise<void> {
  if (!item) {
    return
  }

  if (item.type === 'bookmark' && item.bookmarkId) {
    const bookmark = getBookmarkById(item.bookmarkId)
    if (bookmark?.url) {
      closeCommandPalette()
      await recordBookmarkOpen(bookmark)
      window.location.assign(bookmark.url)
    }
    return
  }

  if ((item.type === 'pin' || item.type === 'unpin') && item.bookmarkId) {
    state.workspaceSettings = toggleNewTabWorkspacePin(
      state.workspaceSettings,
      state.workspaceSettings.activeWorkspaceId,
      item.bookmarkId,
      { validBookmarkIds: state.allBookmarkMap.keys() }
    )
    await saveNewTabWorkspaceSettings()
    postDashboardSpeedDialState()
    closeCommandPalette()
    return
  }

  if (item.type === 'workspace' && item.workspaceId) {
    await switchNewTabWorkspace(item.workspaceId)
    closeCommandPalette()
    return
  }

  closeCommandPalette()
  if (item.type === 'settings') {
    openSettingsDrawer({ focusFirstControl: false, section: 'workspaces' })
    return
  }

  if (item.type === 'dashboard') {
    openDashboardRoute()
    return
  }

  if (item.type === 'options' && item.actionHash) {
    openOptionsHash(item.actionHash)
  }
}

async function switchNewTabWorkspace(workspaceId: string): Promise<void> {
  const nextSettings = setActiveNewTabWorkspace(state.workspaceSettings, workspaceId)
  if (nextSettings === state.workspaceSettings) {
    return
  }

  state.workspaceSettings = nextSettings
  await saveNewTabWorkspaceSettings()
  syncWorkspaceSettingsControls()
  render()
  postDashboardSpeedDialState()
  updateClockText()
}

function appendBookmarkTilesInChunks(
  list: HTMLElement,
  section: NewTabFolderSection,
  renderedBookmarkIndex: number,
  renderVersion: number
): number {
  const initialCount = Math.min(section.bookmarks.length, BOOKMARK_TILE_INITIAL_RENDER_LIMIT)
  for (let index = 0; index < initialCount; index += 1) {
    list.appendChild(createBookmarkTile(section.bookmarks[index], section.id, renderedBookmarkIndex + index))
  }

  if (initialCount < section.bookmarks.length) {
    list.dataset.incrementalRender = 'true'
    list.setAttribute('aria-busy', 'true')
    scheduleBookmarkTileChunkRender(list, section, initialCount, renderedBookmarkIndex + initialCount, renderVersion)
  }

  return renderedBookmarkIndex + section.bookmarks.length
}

function scheduleBookmarkTileChunkRender(
  list: HTMLElement,
  section: NewTabFolderSection,
  nextIndex: number,
  renderedBookmarkIndex: number,
  renderVersion: number
): void {
  window.requestAnimationFrame(() => {
    if (renderVersion !== bookmarkTileRenderVersion || !list.isConnected) {
      return
    }

    const fragment = document.createDocumentFragment()
    const endIndex = Math.min(section.bookmarks.length, nextIndex + BOOKMARK_TILE_RENDER_CHUNK_SIZE)
    for (let index = nextIndex; index < endIndex; index += 1) {
      fragment.appendChild(createBookmarkTile(section.bookmarks[index], section.id, renderedBookmarkIndex + (index - nextIndex)))
    }
    list.appendChild(fragment)

    if (endIndex < section.bookmarks.length) {
      scheduleBookmarkTileChunkRender(
        list,
        section,
        endIndex,
        renderedBookmarkIndex + (endIndex - nextIndex),
        renderVersion
      )
      return
    }

    delete list.dataset.incrementalRender
    list.setAttribute('aria-busy', state.reorderingBookmarks ? 'true' : 'false')
  })
}

function createEmptyFolderState(section: NewTabFolderSection): HTMLElement {
  const empty = document.createElement('div')
  empty.className = 'bookmark-folder-empty-state'

  const copy = document.createElement('p')
  copy.className = 'bookmark-folder-empty'
  copy.textContent = '此文件夹还没有书签。你可以先添加一个书签，或改用已有的非空来源；选择来源只改变展示，不会移动或删除书签。'

  const actions = document.createElement('div')
  actions.className = 'bookmark-folder-empty-actions'

  const addButton = document.createElement('button')
  addButton.className = 'newtab-button secondary'
  addButton.type = 'button'
  addButton.dataset.addBookmarkFolderId = section.id
  addButton.textContent = '添加书签到这里'

  const sourceButton = document.createElement('button')
  sourceButton.className = 'newtab-button secondary'
  sourceButton.type = 'button'
  sourceButton.textContent = '选择现有来源'
  sourceButton.title = '打开来源设置并选择已有文件夹'
  sourceButton.addEventListener('click', openFolderSourceSettings)

  actions.append(addButton, sourceButton)
  empty.append(copy, actions)
  return empty
}

function createSourceNavigation(sections: NewTabFolderSection[]): HTMLElement | null {
  if (!state.generalSettings.showSourceNavigation || sections.length < 2) {
    return null
  }

  const items = buildNewTabSourceNavigationItems(sections)
  if (items.length < 2) {
    return null
  }

  const nav = document.createElement('nav')
  nav.className = 'source-navigation'
  nav.setAttribute('aria-label', '书签来源导航')

  const label = document.createElement('span')
  label.className = 'source-navigation-label'
  label.textContent = '来源'

  const list = document.createElement('div')
  list.className = 'source-navigation-list'

  for (const item of items) {
    const link = document.createElement('a')
    link.className = 'source-navigation-link'
    link.href = `#${item.anchorId}`
    link.dataset.sourceNavigationTarget = item.anchorId
    link.title = item.path
    link.draggable = false
    link.setAttribute('aria-label', `跳转到「${item.title}」，${item.bookmarkCount} 个书签`)
    link.addEventListener('click', (event) => {
      event.preventDefault()
      focusSourceSection(item.anchorId)
    })

    const title = document.createElement('span')
    title.className = 'source-navigation-title'
    title.textContent = item.title

    const count = document.createElement('span')
    count.className = 'source-navigation-count'
    count.textContent = String(item.bookmarkCount)

    link.append(title, count)
    list.appendChild(link)
  }

  nav.append(label, list)
  return nav
}

function focusSourceSection(anchorId: string): void {
  const section = document.getElementById(anchorId)
  if (!(section instanceof HTMLElement)) {
    return
  }

  section.scrollIntoView({ block: 'start', behavior: 'smooth' })
  section.focus({ preventScroll: true })
}

function createFolderAddButton(section: NewTabFolderSection): HTMLButtonElement {
  const button = document.createElement('button')
  button.className = 'folder-section-add'
  button.type = 'button'
  button.dataset.addBookmarkFolderId = section.id
  button.title = `添加书签到「${section.title || '未命名文件夹'}」`
  button.setAttribute('aria-label', button.title)
  button.append(createMenuActionIcon('plus'))
  button.addEventListener('pointerdown', (event) => {
    event.stopPropagation()
  })
  return button
}

function createPortalPanel(): HTMLElement | null {
  const showOverview = state.generalSettings.showPortalOverview
  const showQuickAccess = state.generalSettings.showQuickAccess
  const overview = buildNewTabPortalOverview({
    sections: state.folderSections,
    activityRecords: state.activity.records,
    now: Date.now()
  })
  const quickAccess = createQuickAccessPanel()
  const layout = resolvePortalPanelLayout({
    showOverview,
    hasOverviewSignal: hasPortalOverviewSignal(overview),
    hasQuickAccess: Boolean(quickAccess)
  })

  if (layout === 'hidden') {
    return null
  }

  const panel = document.createElement('section')
  panel.className = layout === 'full' ? 'newtab-portal' : `newtab-portal ${layout}`
  panel.setAttribute('aria-label', '今日门户')

  if (layout === 'full' || layout === 'overview-only') {
    panel.appendChild(createPortalOverview(overview, {
      showQuickAccess,
      hasQuickAccess: Boolean(quickAccess)
    }))
  }
  if (quickAccess) {
    panel.appendChild(quickAccess)
  }

  return panel
}

function hasPortalOverviewSignal(overview: PortalOverview): boolean {
  return overview.openedTodayCount > 0 || overview.addedTodayCount > 0
}

function createPortalOverview(
  overview: PortalOverview,
  options: {
    showQuickAccess: boolean
    hasQuickAccess: boolean
  }
): HTMLElement {
  const section = document.createElement('section')
  section.className = 'newtab-portal-overview'
  section.setAttribute('aria-label', '今日概览')

  const heading = document.createElement('div')
  heading.className = 'newtab-portal-heading'

  const title = document.createElement('strong')
  title.textContent = '今日'

  const meta = document.createElement('span')
  meta.textContent = createPortalSummaryText(overview, options)

  heading.append(title, meta)

  const stats = document.createElement('div')
  stats.className = 'newtab-portal-stats'
  stats.append(...createPortalStats(overview))
  if (stats.childElementCount) {
    section.appendChild(stats)
  }

  section.prepend(heading)
  return section
}

function createPortalStats(overview: PortalOverview): HTMLElement[] {
  const stats: HTMLElement[] = []

  if (overview.openedTodayCount > 0) {
    stats.push(createPortalStat('今日打开', overview.openedTodayCount))
  }
  if (overview.addedTodayCount > 0) {
    stats.push(createPortalStat('今日新增', overview.addedTodayCount))
  }

  return stats
}

function createPortalSummaryText(
  overview: PortalOverview,
  options: {
    showQuickAccess: boolean
    hasQuickAccess: boolean
  }
): string {
  if (options.hasQuickAccess) {
    return 'Curator 常用和新近添加已整理'
  }

  if (overview.addedTodayCount > 0) {
    return `今天新增 ${overview.addedTodayCount} 个书签`
  }
  if (overview.bookmarkCount > 0) {
    return '从这里继续浏览'
  }
  return '等待添加书签'
}

function createPortalStat(label: string, value: number): HTMLElement {
  const stat = document.createElement('span')
  stat.className = 'newtab-portal-stat'

  const number = document.createElement('strong')
  number.textContent = String(Math.max(0, value))

  const copy = document.createElement('span')
  copy.textContent = label

  stat.append(number, copy)
  return stat
}

function createQuickAccessPanel(): HTMLElement | null {
  const { frequentItems, recentItems } = getPortalQuickAccessItems({
    bookmarks: state.bookmarks,
    pinnedIds: getActiveWorkspacePinnedIds(),
    records: state.activity.records,
    now: Date.now(),
    itemLimit: QUICK_ACCESS_ITEM_LIMIT,
    showFrequent: state.generalSettings.showQuickAccess,
    showRecent: state.generalSettings.showQuickAccess
  })

  const frequentQuickAccessItems = frequentItems
    .map(createQuickAccessItemFromPortalItem)
    .filter((item): item is QuickAccessItem => Boolean(item))
  const recentQuickAccessItems = recentItems
    .map(createQuickAccessItemFromPortalItem)
    .filter((item): item is QuickAccessItem => Boolean(item))

  if (!frequentQuickAccessItems.length && !recentQuickAccessItems.length) {
    return null
  }

  const panel = document.createElement('section')
  panel.className = 'newtab-quick-access'
  panel.setAttribute('aria-label', 'Curator 常用和新近添加书签')

  if (frequentQuickAccessItems.length) {
    panel.appendChild(createQuickAccessGroup('Curator 常用', frequentQuickAccessItems))
  }
  if (recentQuickAccessItems.length) {
    panel.appendChild(createQuickAccessGroup('新近添加', recentQuickAccessItems))
  }

  return panel
}

function createQuickAccessItemFromPortalItem(item: PortalQuickAccessItem): QuickAccessItem | null {
  const bookmark = state.allBookmarkMap.get(item.id)
  if (!bookmark?.url) {
    return null
  }

  return createQuickAccessItem(bookmark, item.detail, item.badge, item.reason)
}

function createQuickAccessGroup(label: string, items: QuickAccessItem[]): HTMLElement {
  const group = document.createElement('section')
  group.className = 'newtab-quick-group'
  group.setAttribute('aria-label', `${label}书签`)

  const header = document.createElement('div')
  header.className = 'newtab-quick-heading'
  header.textContent = label

  const list = document.createElement('div')
  list.className = 'newtab-quick-list'

  for (const item of items) {
    list.appendChild(createQuickAccessLink(item))
  }

  group.append(header, list)
  return group
}

function createQuickAccessLink(item: QuickAccessItem): HTMLAnchorElement {
  const link = document.createElement('a')
  link.className = 'newtab-quick-link'
  link.href = item.url
  link.title = `${item.title} · ${item.detail}`
  link.draggable = false
  link.dataset.bookmarkId = item.id
  link.dataset.quickReason = item.reason
  bindBookmarkNavigation(link, item.bookmark)

  const mark = document.createElement('span')
  mark.className = 'newtab-quick-mark'
  mark.textContent = item.badge
  mark.setAttribute('aria-hidden', 'true')

  const copy = document.createElement('span')
  copy.className = 'newtab-quick-copy'

  const title = document.createElement('strong')
  title.textContent = item.title

  const detail = document.createElement('span')
  detail.textContent = item.detail

  copy.append(title, detail)
  link.append(mark, copy)
  return link
}

function createQuickAccessItem(
  bookmark: chrome.bookmarks.BookmarkTreeNode,
  detail: string,
  badge: string,
  reason: PortalQuickAccessItem['reason']
): QuickAccessItem {
  const url = String(bookmark.url || '').trim()
  const title = String(bookmark.title || '').trim() || url
  return {
    id: String(bookmark.id),
    title,
    url,
    detail,
    badge,
    reason,
    bookmark
  }
}

function getResponsiveIconColumns(settings: IconSettings): number {
  return getResponsiveFixedIconColumns(
    settings,
    document.documentElement.clientWidth || window.innerWidth || 1280
  )
}

function createBookmarkTile(
  bookmark: chrome.bookmarks.BookmarkTreeNode,
  folderId: string,
  renderIndex = 0
): HTMLAnchorElement {
  const url = String(bookmark.url || '')
  const title = String(bookmark.title || '').trim() || url
  const item = document.createElement('a')
  item.className = 'bookmark-tile'
  item.href = url
  item.title = title
  item.draggable = false
  item.dataset.bookmarkId = String(bookmark.id)
  item.dataset.folderId = folderId
  bindBookmarkNavigation(item, bookmark)
  const customIcon = state.customIcons[String(bookmark.id)]
  if (!customIcon) {
    applyCachedFaviconAccent(item, String(bookmark.id), url)
  }
  if (String(bookmark.id) === state.draggingBookmarkId && state.dragOriginalOrderIds.length) {
    item.classList.add('dragging')
  }

  const iconShell = document.createElement('span')
  iconShell.className = 'bookmark-icon-shell'
  iconShell.setAttribute('aria-hidden', 'true')

  const icon = document.createElement('img')
  icon.className = 'bookmark-favicon'
  if (customIcon) {
    icon.classList.add('custom-icon')
  }
  icon.src = customIcon || getFaviconUrl(url, String(bookmark.id))
  icon.alt = ''
  icon.draggable = false
  icon.loading = renderIndex < EAGER_FAVICON_LIMIT ? 'eager' : 'lazy'
  icon.decoding = 'async'
  icon.setAttribute(
    'fetchpriority',
    renderIndex < HIGH_PRIORITY_FAVICON_LIMIT ? 'high' : 'low'
  )
  icon.addEventListener('error', () => {
    iconShell.classList.add('favicon-missing')
  })
  if (!customIcon && renderIndex < FAVICON_ACCENT_EXTRACTION_INITIAL_BUDGET) {
    icon.addEventListener('load', () => {
      handleFaviconLoaded(icon, item, String(bookmark.id), url)
    }, { once: true })
  }

  const fallback = document.createElement('span')
  fallback.className = 'bookmark-fallback'
  fallback.textContent = getFallbackLabel(title)

  const label = document.createElement('span')
  label.className = 'bookmark-title'
  label.textContent = title

  iconShell.append(icon, fallback)
  item.append(iconShell, label)
  return item
}

function applyCachedFaviconAccent(item: HTMLElement, bookmarkId: string, url: string): void {
  const entry = getFaviconAccentCacheEntry(state.faviconAccentCache, bookmarkId, url)
  if (!entry) {
    return
  }

  applyFaviconAccentToTile(item, entry.color)
}

function handleFaviconLoaded(
  icon: HTMLImageElement,
  item: HTMLElement,
  bookmarkId: string,
  url: string
): void {
  const cachedEntry = getFaviconAccentCacheEntry(state.faviconAccentCache, bookmarkId, url)
  if (cachedEntry) {
    applyFaviconAccentToTile(item, cachedEntry.color)
    return
  }

  const color = extractFaviconAccentColor(icon)
  if (!color) {
    return
  }

  applyFaviconAccentToTile(item, color)
  state.faviconAccentCache = upsertFaviconAccentCacheEntry(
    state.faviconAccentCache,
    bookmarkId,
    url,
    color
  )
  scheduleFaviconAccentCacheSave()
}

function extractFaviconAccentColor(icon: HTMLImageElement): FaviconAccentColor | null {
  if (!icon.naturalWidth || !icon.naturalHeight) {
    return null
  }

  const canvas = document.createElement('canvas')
  const size = Math.min(
    FAVICON_COLOR_SAMPLE_SIZE,
    Math.max(icon.naturalWidth, icon.naturalHeight)
  )
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    return null
  }

  try {
    context.clearRect(0, 0, size, size)
    context.drawImage(icon, 0, 0, size, size)
    return selectFaviconAccentColor(context.getImageData(0, 0, size, size).data)
  } catch {
    return null
  }
}

function applyFaviconAccentToTile(item: HTMLElement, color: FaviconAccentColor): void {
  item.style.setProperty('--bookmark-card-rgb', formatFaviconAccentCssRgb(color))
}

async function saveFaviconAccentCache(): Promise<void> {
  state.faviconAccentCache = normalizeFaviconAccentCache(state.faviconAccentCache)
  await setLocalStorage({
    [STORAGE_KEYS.newTabFaviconAccentCache]: state.faviconAccentCache
  })
}

function scheduleFaviconAccentCacheSave(): void {
  window.clearTimeout(faviconAccentSaveTimer)
  faviconAccentSaveTimer = window.setTimeout(() => {
    faviconAccentSaveTimer = 0
    void saveFaviconAccentCache().catch((error) => {
      console.warn('新标签页网站图标色彩缓存保存失败。', error)
    })
  }, FAVICON_ACCENT_SAVE_DEBOUNCE_MS)
}

function bindBookmarkNavigation(
  link: HTMLAnchorElement,
  bookmark: chrome.bookmarks.BookmarkTreeNode
): void {
  const url = String(bookmark.url || '').trim()
  if (!url) {
    return
  }

  link.addEventListener('click', (event) => {
    if (
      state.dragSuppressClick ||
      state.folderDragSuppressClick ||
      state.draggingBookmarkId ||
      state.draggingFolderId
    ) {
      return
    }

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      void recordBookmarkOpen(bookmark)
      return
    }

    event.preventDefault()
    if (state.generalSettings.openBookmarksInNewTab) {
      const opened = window.open(url, '_blank', 'noopener')
      if (opened) {
        opened.opener = null
      }
      void recordBookmarkOpen(bookmark)
      return
    }

    void recordBookmarkOpen(bookmark)
    window.location.assign(url)
  })
}

function buildFolderNodeMap(
  rootNode: chrome.bookmarks.BookmarkTreeNode | null
): Map<string, chrome.bookmarks.BookmarkTreeNode> {
  const map = new Map<string, chrome.bookmarks.BookmarkTreeNode>()
  if (!rootNode) {
    return map
  }

  const walk = (node: chrome.bookmarks.BookmarkTreeNode): void => {
    if (!node.url) {
      map.set(String(node.id), node)
      for (const child of node.children || []) {
        if (!child.url) {
          walk(child)
        }
      }
    }
  }

  walk(rootNode)
  return map
}

function buildAllBookmarks(
  rootNode: chrome.bookmarks.BookmarkTreeNode | null
): chrome.bookmarks.BookmarkTreeNode[] {
  return collectPortalBookmarkSourceItems(rootNode) as chrome.bookmarks.BookmarkTreeNode[]
}

function buildNewTabFolderSections(
  rootNode: chrome.bookmarks.BookmarkTreeNode | null,
  settings: NewTabFolderSettings,
  folderData = state.folderData,
  folderNodeMap = state.folderNodeMap
): NewTabFolderSection[] {
  if (!rootNode) {
    return []
  }

  const resolvedFolderData = folderData || extractBookmarkData(rootNode)
  const resolvedFolderNodeMap = folderNodeMap.size ? folderNodeMap : buildFolderNodeMap(rootNode)
  const selectedIds = normalizeFolderIds(settings.selectedFolderIds)
  const sections: NewTabFolderSection[] = []
  const seenSectionIds = new Set<string>()

  for (const folderId of selectedIds) {
    const node = resolvedFolderNodeMap.get(folderId) || null
    if (!node || node.url) {
      continue
    }

    for (const displayNode of getDisplayableNewTabSourceFolders(node)) {
      const sectionId = String(displayNode.id || '').trim()
      if (!sectionId || seenSectionIds.has(sectionId)) {
        continue
      }

      const folder = resolvedFolderData.folderMap.get(sectionId)
      sections.push(createFolderSection(displayNode, folder, folderId))
      seenSectionIds.add(sectionId)
    }
  }

  return sections
}

function createFolderSection(
  node: chrome.bookmarks.BookmarkTreeNode,
  folder?: FolderRecord,
  sourceId = String(node.id)
): NewTabFolderSection {
  const title = String(folder?.title || node.title || '未命名文件夹').trim() || '未命名文件夹'
  const counts = getFolderBookmarkCounts(node)
  return {
    id: String(node.id),
    sourceId,
    title,
    path: String(folder?.path || title),
    node,
    bookmarks: getDirectBookmarks(node),
    directBookmarkCount: counts.directBookmarkCount,
    totalBookmarkCount: counts.totalBookmarkCount
  }
}

function getDirectBookmarks(
  folderNode: chrome.bookmarks.BookmarkTreeNode | null
): chrome.bookmarks.BookmarkTreeNode[] {
  return (folderNode?.children || []).filter((child) => Boolean(child.url))
}

function getAllSectionBookmarks(): chrome.bookmarks.BookmarkTreeNode[] {
  return state.folderSections.flatMap((section) => section.bookmarks)
}

function refreshDerivedBookmarkState(): void {
  state.folderNode = state.folderSections[0]?.node || null
  state.bookmarks = getAllSectionBookmarks()
  state.bookmarkMap = new Map(state.bookmarks.map((bookmark) => [String(bookmark.id), bookmark]))
  state.allBookmarks = buildAllBookmarks(state.rootNode)
  state.allBookmarkMap = new Map(state.allBookmarks.map((bookmark) => [String(bookmark.id), bookmark]))
  state.searchIndex = buildNewTabSearchIndex({
    bookmarks: getVisibleBookmarkRecords(),
    tagIndex: state.bookmarkTagIndex,
    snapshotIndex: state.searchSnapshotIndex
  })
  state.preparedSearchIndex = prepareNewTabSearchIndex(state.searchIndex)
  searchSuggestionCache.clear()
  naturalSearchSuggestionCache.clear()
}

function getVisibleBookmarkRecords(): BookmarkRecord[] {
  const folderData = state.folderData || extractBookmarkData(state.rootNode)
  const records: BookmarkRecord[] = []
  const seenIds = new Set<string>()

  for (const bookmark of state.bookmarks) {
    const bookmarkId = String(bookmark.id || '').trim()
    const record = bookmarkId ? folderData.bookmarkMap.get(bookmarkId) : null
    if (!record || seenIds.has(record.id)) {
      continue
    }

    records.push(record)
    seenIds.add(record.id)
  }

  return records
}

function getAllBookmarkRecords(): BookmarkRecord[] {
  const folderData = state.folderData || extractBookmarkData(state.rootNode)
  return folderData.bookmarks
}

function getBookmarkById(bookmarkId: string): chrome.bookmarks.BookmarkTreeNode | null {
  return state.bookmarkMap.get(String(bookmarkId)) || state.allBookmarkMap.get(String(bookmarkId)) || null
}

function getBookmarkFolderPath(bookmark: chrome.bookmarks.BookmarkTreeNode): string {
  const parentId = String(bookmark.parentId || '')
  return state.folderSections.find((section) => section.id === parentId)?.path ||
    state.folderData?.folderMap.get(parentId)?.path ||
    ''
}

async function recordBookmarkOpen(bookmark: chrome.bookmarks.BookmarkTreeNode): Promise<void> {
  const bookmarkId = String(bookmark.id || '').trim()
  const url = String(bookmark.url || '').trim()
  if (!bookmarkId || !url) {
    return
  }

  const now = Date.now()
  const previousRecord = state.activity.records[bookmarkId]
  state.activity = normalizeNewTabActivity({
    ...state.activity,
    records: {
      ...state.activity.records,
      [bookmarkId]: {
        bookmarkId,
        title: String(bookmark.title || '').trim() || url,
        url,
        openCount: Math.min((previousRecord?.openCount || 0) + 1, 9999),
        firstOpenedAt: previousRecord?.firstOpenedAt || now,
        lastOpenedAt: now
      }
    }
  }, state.allBookmarks)

  await saveNewTabActivity().catch((error) => {
    console.warn('新标签页打开记录保存失败。', error)
  })
}

async function removeBookmarkFromActivity(bookmarkId: string): Promise<void> {
  const normalizedId = String(bookmarkId || '').trim()
  if (!normalizedId) {
    return
  }

  const records = { ...state.activity.records }
  delete records[normalizedId]
  state.activity = {
    pinnedIds: state.activity.pinnedIds.filter((id) => id !== normalizedId),
    records
  }
  await saveNewTabActivity()
}

async function removeBookmarkFromWorkspacePins(bookmarkId: string): Promise<void> {
  const normalizedId = String(bookmarkId || '').trim()
  if (!normalizedId) {
    return
  }

  let nextSettings = state.workspaceSettings
  for (const workspace of state.workspaceSettings.workspaces) {
    if (!workspace.pinnedIds.includes(normalizedId)) {
      continue
    }
    nextSettings = updateNewTabWorkspace(
      nextSettings,
      workspace.id,
      { pinnedIds: workspace.pinnedIds.filter((id) => id !== normalizedId) },
      { validBookmarkIds: state.allBookmarkMap.keys() }
    )
  }

  state.workspaceSettings = nextSettings
  await saveNewTabWorkspaceSettings()
  postDashboardSpeedDialState()
}

async function saveNewTabActivity(): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.newTabActivity]: normalizeNewTabActivity(state.activity, state.allBookmarks)
  })
}

async function saveNewTabWorkspaceSettings(): Promise<void> {
  state.workspaceSettings = normalizeNewTabWorkspaceSettings(state.workspaceSettings, {
    validBookmarkIds: state.allBookmarkMap.keys()
  })
  await setLocalStorage({
    [STORAGE_KEYS.newTabWorkspaceSettings]: state.workspaceSettings
  })
}

async function saveNewTabModuleSettings(): Promise<void> {
  state.moduleSettings = normalizeNewTabModuleSettings(state.moduleSettings)
  await saveSettingsWithFeedback({
    [STORAGE_KEYS.newTabModuleSettings]: state.moduleSettings
  })
}

function normalizeNewTabActivity(
  rawActivity: unknown,
  bookmarks: chrome.bookmarks.BookmarkTreeNode[]
): NewTabActivityState {
  const validIds = new Set(bookmarks.map((bookmark) => String(bookmark.id)))
  const source = rawActivity && typeof rawActivity === 'object' && !Array.isArray(rawActivity)
    ? rawActivity as Record<string, unknown>
    : {}
  const pinnedIds = Array.isArray(source.pinnedIds)
    ? uniqueActivityIds(source.pinnedIds, validIds).slice(0, QUICK_ACCESS_ITEM_LIMIT)
    : []
  const rawRecords = source.records && typeof source.records === 'object' && !Array.isArray(source.records)
    ? source.records as Record<string, unknown>
    : {}
  const records: Record<string, NewTabActivityRecord> = {}

  const normalizedRecords = Object.entries(rawRecords)
    .map(([bookmarkId, value]) => normalizeActivityRecord(bookmarkId, value, validIds))
    .filter((record): record is NewTabActivityRecord => Boolean(record))
    .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt)
    .slice(0, ACTIVITY_RECORD_LIMIT)

  for (const record of normalizedRecords) {
    records[record.bookmarkId] = record
  }

  return { pinnedIds, records }
}

function uniqueActivityIds(values: unknown[], validIds: Set<string>): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const id = String(value || '').trim()
    if (!id || seen.has(id) || !validIds.has(id)) {
      continue
    }
    seen.add(id)
    ids.push(id)
  }
  return ids
}

function normalizeActivityRecord(
  bookmarkId: string,
  value: unknown,
  validIds: Set<string>
): NewTabActivityRecord | null {
  const id = String(bookmarkId || '').trim()
  if (!id || !validIds.has(id) || !value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const source = value as Record<string, unknown>
  const openCount = Math.max(0, Math.min(Math.floor(Number(source.openCount) || 0), 9999))
  const lastOpenedAt = Number(source.lastOpenedAt) || 0
  if (openCount <= 0 || lastOpenedAt <= 0) {
    return null
  }

  return {
    bookmarkId: id,
    title: String(source.title || '').trim().slice(0, 160),
    url: String(source.url || '').trim().slice(0, 2048),
    openCount,
    firstOpenedAt: Number(source.firstOpenedAt) || lastOpenedAt,
    lastOpenedAt
  }
}

function getActiveMenuBookmark(): chrome.bookmarks.BookmarkTreeNode | null {
  return state.activeMenuBookmarkId ? getBookmarkById(state.activeMenuBookmarkId) : null
}

function renderBookmarkMenu({ focusFirst = true, focusAction = '' } = {}): void {
  const existingMenu = document.querySelector<HTMLElement>('.bookmark-edit-menu')
  if (existingMenu) {
    cancelExitMotion(existingMenu)
    existingMenu.remove()
  }

  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    return
  }

  const menu = document.createElement('section')
  menu.className = 'bookmark-edit-menu'
  menu.setAttribute('role', 'dialog')
  menu.setAttribute('aria-label', '书签设置')
  menu.style.left = `${state.menuX}px`
  menu.style.top = `${state.menuY}px`

  const titleField = createMenuTextField('标题', 'Example', state.editTitle, (value) => {
    state.editTitle = value
  })
  const urlField = createMenuTextField('链接', 'https://example.com/', state.editUrl, (value) => {
    state.editUrl = value
  })

  const iconRow = document.createElement('label')
  iconRow.className = 'bookmark-menu-row'
  const iconLabel = document.createElement('span')
  iconLabel.textContent = '图标'
  const iconSelect = document.createElement('select')
  iconSelect.className = 'bookmark-menu-select'
  iconSelect.disabled = state.menuBusy
  const websiteOption = document.createElement('option')
  websiteOption.value = 'website'
  websiteOption.textContent = '网站图标'
  const customOption = document.createElement('option')
  customOption.value = 'custom'
  customOption.textContent = '自定义图片'
  iconSelect.append(websiteOption, customOption)
  iconSelect.value = state.editIconMode === 'custom' ? 'custom' : 'website'
  iconSelect.addEventListener('change', () => {
    void handleIconModeChange(iconSelect.value)
  })
  iconRow.append(iconLabel, iconSelect)

  const separator = document.createElement('div')
  separator.className = 'bookmark-menu-separator'

  const actionList = document.createElement('div')
  actionList.className = 'bookmark-menu-actions'
  actionList.setAttribute('role', 'menu')
  actionList.setAttribute('aria-label', '书签操作')
  actionList.addEventListener('keydown', handleMenuActionsKeydown)
  const bookmarkLabel = getBookmarkActionLabelContext(bookmark)
  const pinCopy = getSpeedDialPinActionCopy(isActiveMenuBookmarkPinned(), getActiveWorkspaceName())
  const deleteLabel = state.pendingDeleteBookmarkId === String(bookmark.id) ? '确认删除书签' : '删除书签'
  actionList.append(
    createMenuAction(
      pinCopy.label,
      'pin',
      toggleActiveMenuBookmarkPin,
      { actionId: 'toggle-pin', ariaLabel: `${pinCopy.ariaLabel}：${bookmarkLabel}` }
    ),
    createMenuAction('复制链接', 'copy', copyActiveMenuBookmarkUrl, {
      actionId: 'copy-url',
      ariaLabel: `复制书签链接：${bookmarkLabel}`
    }),
    createMenuAction(
      state.pendingDeleteBookmarkId === String(bookmark.id) ? '确认删除 1 个' : '删除链接',
      'trash',
      deleteActiveMenuBookmark,
      { actionId: 'delete-bookmark', variant: 'danger', ariaLabel: `${deleteLabel}：${bookmarkLabel}` }
    ),
    createMenuAction('刷新图标', 'refresh', refreshActiveMenuIcon, {
      actionId: 'refresh-icon',
      ariaLabel: `刷新书签图标：${bookmarkLabel}`
    }),
    createMenuAction('保存更改', 'save', saveBookmarkMenuChanges, {
      actionId: 'save-bookmark',
      ariaLabel: `保存书签更改：${bookmarkLabel}`
    })
  )

  menu.append(titleField, urlField, iconRow, separator, actionList)

  if (state.menuError) {
    const error = document.createElement('p')
    error.className = 'bookmark-menu-error'
    error.textContent = state.menuError
    menu.appendChild(error)
  }

  if (state.menuStatus) {
    const status = document.createElement('p')
    status.className = 'bookmark-menu-status'
    if (state.pendingDeleteBookmarkId === String(bookmark.id)) {
      status.classList.add('is-warning')
    }
    status.textContent = state.menuStatus
    menu.appendChild(status)
  }

  document.body.appendChild(menu)
  positionBookmarkMenu(menu)

  const focusedAction = focusAction
    ? menu.querySelector<HTMLButtonElement>(`[data-menu-action="${focusAction}"]`)
    : null
  if (focusedAction && !focusedAction.disabled) {
    focusedAction.focus()
    return
  }

  const firstInput = menu.querySelector('input')
  if (focusFirst && firstInput instanceof HTMLInputElement) {
    firstInput.focus()
    firstInput.select()
  }
}

function renderAddBookmarkMenu({ focusFirst = true } = {}): void {
  const existingMenu = document.querySelector<HTMLElement>('.bookmark-add-menu')
  if (existingMenu) {
    cancelExitMotion(existingMenu)
    existingMenu.remove()
  }

  if (!state.addMenuOpen) {
    return
  }

  const menu = document.createElement('section')
  menu.className = `bookmark-add-menu ${state.addMenuExpanded ? 'expanded' : ''}`
  menu.setAttribute('role', 'dialog')
  menu.setAttribute('aria-label', '添加新标签页书签')
  menu.style.left = `${state.addMenuX}px`
  menu.style.top = `${state.addMenuY}px`

  if (!state.addMenuExpanded) {
    const addButton = document.createElement('button')
    addButton.className = 'bookmark-add-trigger'
    addButton.type = 'button'
    addButton.append(createMenuActionIcon('plus'), document.createTextNode('添加书签'))
    addButton.addEventListener('click', expandAddBookmarkMenu)
    menu.appendChild(addButton)
  } else {
    const titleField = createMenuTextField('标题', 'Example', state.addTitle, (value) => {
      state.addTitle = value
    }, {
      disabled: state.addMenuBusy,
      onEnter: saveAddedBookmark
    })
    const urlField = createMenuTextField('链接', 'https://example.com', state.addUrl, (value) => {
      state.addUrl = value
    }, {
      disabled: state.addMenuBusy,
      onEnter: saveAddedBookmark
    })
    const separator = document.createElement('div')
    separator.className = 'bookmark-menu-separator'
    const actionList = document.createElement('div')
    actionList.className = 'bookmark-menu-actions'
    actionList.setAttribute('role', 'menu')
    actionList.setAttribute('aria-label', '添加书签操作')
    actionList.addEventListener('keydown', handleMenuActionsKeydown)
    actionList.append(createMenuAction('添加书签', 'plus', saveAddedBookmark, {
      disabled: state.addMenuBusy
    }))
    menu.append(titleField, urlField, separator, actionList)
  }

  if (state.addMenuError) {
    const error = document.createElement('p')
    error.className = 'bookmark-menu-error'
    error.textContent = state.addMenuError
    menu.appendChild(error)
  }

  document.body.appendChild(menu)
  positionMenu(menu, state.addMenuX, state.addMenuY)

  const firstInput = menu.querySelector('input')
  if (focusFirst && firstInput instanceof HTMLInputElement) {
    firstInput.focus()
    firstInput.select()
  }
}

async function handleIconModeChange(nextMode: string): Promise<void> {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    closeBookmarkMenu()
    return
  }

  if (nextMode === 'website') {
    state.editIconMode = 'website'
    state.pendingCustomIconDataUrl = ''
    state.pendingDeleteBookmarkId = ''
    state.menuError = ''
    state.menuStatus = ''
    renderBookmarkMenu({ focusFirst: false })
    return
  }

  state.menuBusy = true
  state.pendingDeleteBookmarkId = ''
  state.menuError = ''
  state.menuStatus = ''
  renderBookmarkMenu({ focusFirst: false })

  try {
    const dataUrl = await pickCustomIconImage()
    state.menuBusy = false
    if (!dataUrl) {
      state.editIconMode = state.customIcons[bookmark.id] ? 'custom' : 'website'
      renderBookmarkMenu({ focusFirst: false })
      return
    }

    state.editIconMode = 'custom'
    state.pendingCustomIconDataUrl = dataUrl
    renderBookmarkMenu({ focusFirst: false })
  } catch (error) {
    state.menuBusy = false
    state.menuStatus = ''
    state.menuError =
      error instanceof Error ? error.message : '自定义图片读取失败，请重试。'
    state.editIconMode = state.customIcons[bookmark.id] ? 'custom' : 'website'
    renderBookmarkMenu({ focusFirst: false })
  }
}

function createMenuTextField(
  label: string,
  placeholder: string,
  value: string,
  onInput: (value: string) => void,
  {
    disabled = state.menuBusy,
    onEnter = saveBookmarkMenuChanges
  }: {
    disabled?: boolean
    onEnter?: () => void | Promise<void>
  } = {}
): HTMLLabelElement {
  const field = document.createElement('label')
  field.className = 'bookmark-menu-row'

  const labelNode = document.createElement('span')
  labelNode.textContent = label

  const input = document.createElement('input')
  input.className = 'bookmark-menu-input'
  input.type = label === '链接' ? 'url' : 'text'
  input.placeholder = placeholder
  input.value = value
  input.disabled = disabled
  input.spellcheck = false
  input.addEventListener('input', () => {
    state.pendingDeleteBookmarkId = ''
    onInput(input.value)
  })
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void onEnter()
    }
  })

  field.append(labelNode, input)
  return field
}

function createMenuAction(
  label: string,
  icon: MenuActionIcon,
  action: () => void | Promise<void>,
  {
    disabled = state.menuBusy,
    actionId = '',
    variant = '',
    ariaLabel = label
  }: {
    disabled?: boolean
    actionId?: string
    variant?: 'danger' | ''
    ariaLabel?: string
  } = {}
): HTMLButtonElement {
  const button = document.createElement('button')
  button.className = `bookmark-menu-action${variant ? ` ${variant}` : ''}`
  button.type = 'button'
  button.disabled = disabled
  button.setAttribute('role', 'menuitem')
  button.setAttribute('aria-label', ariaLabel)
  if (actionId) {
    button.dataset.menuAction = actionId
  }
  button.append(createMenuActionIcon(icon), document.createTextNode(label))
  button.addEventListener('click', () => {
    void action()
  })
  return button
}

function handleMenuActionsKeydown(event: KeyboardEvent): void {
  if (
    event.key !== 'ArrowUp' &&
    event.key !== 'ArrowDown' &&
    event.key !== 'ArrowLeft' &&
    event.key !== 'ArrowRight' &&
    event.key !== 'Home' &&
    event.key !== 'End'
  ) {
    return
  }

  const actionList = event.currentTarget
  if (!(actionList instanceof HTMLElement)) {
    return
  }

  const actions = Array.from(
    actionList.querySelectorAll<HTMLButtonElement>('.bookmark-menu-action:not(:disabled)')
  )
  if (!actions.length) {
    return
  }

  const currentIndex = actions.findIndex((action) => action === document.activeElement)
  const fallbackIndex = currentIndex >= 0 ? currentIndex : 0
  let nextIndex = fallbackIndex

  if (event.key === 'Home') {
    nextIndex = 0
  } else if (event.key === 'End') {
    nextIndex = actions.length - 1
  } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
    nextIndex = (fallbackIndex - 1 + actions.length) % actions.length
  } else {
    nextIndex = (fallbackIndex + 1) % actions.length
  }

  event.preventDefault()
  actions[nextIndex]?.focus()
}

function createMenuActionIcon(icon: MenuActionIcon): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')

  const paths: Record<MenuActionIcon, string[]> = {
    trash: [
      'M4 7h16',
      'M10 11v6',
      'M14 11v6',
      'M6 7l1 14h10l1-14',
      'M9 7V4h6v3'
    ],
    refresh: [
      'M20 12a8 8 0 0 1-13.7 5.7',
      'M4 12A8 8 0 0 1 17.7 6.3',
      'M17.7 2.8v3.5h-3.5',
      'M6.3 21.2v-3.5h3.5'
    ],
    save: [
      'M5 3h12l2 2v16H5z',
      'M8 3v6h8V3',
      'M8 21v-7h8v7'
    ],
    plus: [
      'M12 5v14',
      'M5 12h14'
    ],
    copy: [
      'M8 8h11v11H8z',
      'M5 16H4V5h11v1'
    ],
    pin: [
      'M7 4h10',
      'M9 4l1 7-3 3v2h10v-2l-3-3 1-7',
      'M12 16v5'
    ]
  }

  for (const value of paths[icon]) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', value)
    svg.appendChild(path)
  }

  return svg
}

function positionBookmarkMenu(menu: HTMLElement): void {
  positionMenu(menu, state.menuX, state.menuY)
}

function positionMenu(menu: HTMLElement, menuX: number, menuY: number): void {
  const margin = 8
  const rect = menu.getBoundingClientRect()
  const left = Math.max(
    margin,
    Math.min(menuX, window.innerWidth - rect.width - margin)
  )
  const top = Math.max(
    margin,
    Math.min(menuY, window.innerHeight - rect.height - margin)
  )
  menu.style.left = `${left}px`
  menu.style.top = `${top}px`
}

function normalizeBookmarkInputUrl(value: string): string {
  const rawUrl = String(value || '').trim()
  if (!rawUrl) {
    throw new Error('链接不能为空。')
  }

  const candidate = /^[a-z][a-z\d+\-.]*:/i.test(rawUrl) ? rawUrl : `https://${rawUrl}`

  try {
    const parsedUrl = new URL(candidate)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('unsupported protocol')
    }
    return parsedUrl.href
  } catch {
    throw new Error('请输入有效链接。')
  }
}

async function persistCustomIconChoice(bookmarkId: string): Promise<void> {
  const nextIcons = { ...state.customIcons }

  if (state.editIconMode === 'custom') {
    const iconData = state.pendingCustomIconDataUrl || nextIcons[bookmarkId]
    if (!iconData) {
      throw new Error('请选择自定义图片，或切回网站图标。')
    }
    nextIcons[bookmarkId] = iconData
  } else {
    delete nextIcons[bookmarkId]
  }

  await saveCustomIcons(nextIcons)
}

async function saveCustomIcons(nextIcons: Record<string, string>): Promise<void> {
  state.customIcons = nextIcons
  await setLocalStorage({
    [STORAGE_KEYS.newTabCustomIcons]: nextIcons
  })
}

async function deleteFaviconAccentCacheEntry(bookmarkId: string): Promise<void> {
  const nextCache = removeFaviconAccentCacheEntry(state.faviconAccentCache, bookmarkId)
  if (nextCache === state.faviconAccentCache) {
    return
  }

  state.faviconAccentCache = nextCache
  await saveFaviconAccentCache()
}

function normalizeCustomIcons(rawIcons: unknown): Record<string, string> {
  if (!rawIcons || typeof rawIcons !== 'object' || Array.isArray(rawIcons)) {
    return {}
  }

  const normalized: Record<string, string> = {}
  for (const [bookmarkId, value] of Object.entries(rawIcons as Record<string, unknown>)) {
    const key = String(bookmarkId || '').trim()
    const dataUrl = String(value || '').trim()
    if (key && dataUrl.startsWith('data:image/')) {
      normalized[key] = dataUrl
    }
  }
  return normalized
}

function normalizeBackgroundSettings(rawSettings: unknown): typeof DEFAULT_BACKGROUND_SETTINGS {
  if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
    return { ...DEFAULT_BACKGROUND_SETTINGS }
  }

  const settings = rawSettings as Record<string, unknown>
  const type = SUPPORTED_BACKGROUND_TYPES.has(String(settings.type))
    ? String(settings.type)
    : DEFAULT_BACKGROUND_SETTINGS.type
  return {
    type,
    color: normalizeHexColor(settings.color, DEFAULT_BACKGROUND_SETTINGS.color),
    imageName: String(settings.imageName || '').trim(),
    videoName: String(settings.videoName || '').trim(),
    url: String(settings.url || '').trim(),
    maskEnabled: settings.maskEnabled === true,
    maskStyle: SUPPORTED_BACKGROUND_MASK_STYLES.has(String(settings.maskStyle))
      ? String(settings.maskStyle)
      : DEFAULT_BACKGROUND_SETTINGS.maskStyle,
    maskBlur: clampNumber(settings.maskBlur, 0, 32, DEFAULT_BACKGROUND_SETTINGS.maskBlur)
  }
}

function readBackgroundSettingsFromControls(): typeof DEFAULT_BACKGROUND_SETTINGS {
  const typeInput = document.getElementById('background-type')
  const colorInput = document.getElementById('background-color')
  const urlInput = document.getElementById('background-url')
  const maskEnabledInput = document.getElementById('background-mask-enabled')
  const maskStyleInput = document.getElementById('background-mask-style')
  const maskBlurInput = document.getElementById('background-mask-blur')

  return normalizeBackgroundSettings({
    type: typeInput instanceof HTMLSelectElement ? typeInput.value : state.backgroundSettings.type,
    color: colorInput instanceof HTMLInputElement ? colorInput.value : state.backgroundSettings.color,
    imageName: state.backgroundSettings.imageName,
    videoName: state.backgroundSettings.videoName,
    url: urlInput instanceof HTMLInputElement ? urlInput.value : state.backgroundSettings.url,
    maskEnabled: maskEnabledInput instanceof HTMLInputElement
      ? maskEnabledInput.checked
      : state.backgroundSettings.maskEnabled,
    maskStyle: maskStyleInput instanceof HTMLSelectElement
      ? maskStyleInput.value
      : state.backgroundSettings.maskStyle,
    maskBlur: maskBlurInput instanceof HTMLInputElement
      ? Number(maskBlurInput.value)
      : state.backgroundSettings.maskBlur
  })
}

function syncBackgroundSettingsControls(): void {
  const settings = state.backgroundSettings
  const typeInput = document.getElementById('background-type')
  const colorInput = document.getElementById('background-color')
  const urlInput = document.getElementById('background-url')
  const colorRow = document.getElementById('background-color-row')
  const imageRow = document.getElementById('background-image-row')
  const videoRow = document.getElementById('background-video-row')
  const urlRow = document.getElementById('background-url-row')
  const backgroundStatus = document.getElementById('background-status')
  const colorControl = document.getElementById('background-color-control')
  const colorValue = document.getElementById('background-color-value')
  const imageButton = document.getElementById('background-image-picker')
  const videoButton = document.getElementById('background-video-picker')
  const maskEnabledInput = document.getElementById('background-mask-enabled')
  const maskStyleInput = document.getElementById('background-mask-style')
  const maskBlurInput = document.getElementById('background-mask-blur')
  const maskStyleRow = document.getElementById('background-mask-style-row')
  const maskBlurRow = document.getElementById('background-mask-blur-row')

  if (typeInput instanceof HTMLSelectElement) {
    typeInput.value = settings.type
  }
  if (colorInput instanceof HTMLInputElement) {
    colorInput.value = settings.color
  }
  if (urlInput instanceof HTMLInputElement) {
    urlInput.value = settings.url
  }
  if (colorRow instanceof HTMLElement) {
    colorRow.hidden = settings.type !== 'color'
  }
  if (imageRow instanceof HTMLElement) {
    imageRow.hidden = settings.type !== 'image'
  }
  if (videoRow instanceof HTMLElement) {
    videoRow.hidden = settings.type !== 'video'
  }
  if (urlRow instanceof HTMLElement) {
    urlRow.hidden = settings.type !== 'urls'
  }
  if (backgroundStatus instanceof HTMLElement) {
    backgroundStatus.textContent = state.backgroundStatus
    backgroundStatus.hidden = !state.backgroundStatus
    backgroundStatus.dataset.tone = state.backgroundStatusTone
  }
  if (colorControl instanceof HTMLElement) {
    colorControl.style.backgroundColor = settings.color
    colorControl.style.color = getReadableTextColor(settings.color)
  }
  if (colorValue) {
    colorValue.textContent = settings.color.toUpperCase()
  }
  if (imageButton) {
    imageButton.textContent = settings.imageName ? '更换图片' : '选择图片'
    if (settings.imageName) {
      imageButton.setAttribute('title', settings.imageName)
    } else {
      imageButton.removeAttribute('title')
    }
  }
  if (videoButton) {
    videoButton.textContent = settings.videoName ? '更换视频' : '选择视频'
    if (settings.videoName) {
      videoButton.setAttribute('title', settings.videoName)
    } else {
      videoButton.removeAttribute('title')
    }
  }
  if (maskEnabledInput instanceof HTMLInputElement) {
    maskEnabledInput.checked = settings.maskEnabled
  }
  if (maskStyleInput instanceof HTMLSelectElement) {
    maskStyleInput.value = settings.maskStyle
    maskStyleInput.disabled = !settings.maskEnabled
  }
  if (maskBlurInput instanceof HTMLInputElement) {
    maskBlurInput.value = String(settings.maskBlur)
    maskBlurInput.disabled = !settings.maskEnabled
  }
  setTextContent('background-mask-blur-value', `${settings.maskBlur}px`)
  if (maskStyleRow instanceof HTMLElement) {
    maskStyleRow.hidden = !settings.maskEnabled
    maskStyleRow.classList.remove('setting-row-disabled')
  }
  if (maskBlurRow instanceof HTMLElement) {
    maskBlurRow.hidden = !settings.maskEnabled
    maskBlurRow.classList.remove('setting-row-disabled')
  }
}

async function saveBackgroundSettings(): Promise<void> {
  await saveSettingsWithFeedback({
    [STORAGE_KEYS.newTabBackgroundSettings]: state.backgroundSettings
  })
}

function shouldClearBackgroundUrlCache(
  previousSettings: typeof DEFAULT_BACKGROUND_SETTINGS,
  nextSettings: typeof DEFAULT_BACKGROUND_SETTINGS
): boolean {
  if (previousSettings.type !== nextSettings.type) {
    return true
  }

  return normalizeBackgroundImageUrl(previousSettings.url) !== normalizeBackgroundImageUrl(nextSettings.url)
}

function getBackgroundMediaSignature(settings: typeof DEFAULT_BACKGROUND_SETTINGS): string {
  return [
    settings.type,
    normalizeHexColor(settings.color, DEFAULT_BACKGROUND_SETTINGS.color),
    settings.imageName,
    settings.videoName,
    normalizeBackgroundImageUrl(settings.url)
  ].join('|')
}

function setBackgroundStatus(
  message: string,
  tone: 'info' | 'success' | 'warning' | 'error' = 'info'
): void {
  state.backgroundStatus = message
  state.backgroundStatusTone = tone
}

function getBackgroundMediaSaveErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/quota|storage|空间|容量/i.test(message)) {
    return '保存失败：浏览器本地存储空间可能不足，请换用更小文件或清理空间后重试。'
  }
  return '保存失败：请确认文件可读取，或换用更小的图片/视频后重试。'
}

function getBackgroundUrlCacheErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/不是图片|content/i.test(message)) {
    return '远程缓存失败：链接返回的不是图片，请换用直连图片地址。'
  }
  if (/请求失败|status|404|403|401|500/i.test(message)) {
    return '远程缓存失败：图片请求失败，请检查链接是否可访问或重新授权后重试。'
  }
  if (/太大|上限|size|large/i.test(message)) {
    return message || '远程缓存失败：图片文件超过本地缓存上限，请换用更小的图片。'
  }
  if (/超时|timeout|abort/i.test(message)) {
    return '远程缓存失败：图片下载超时，请检查网络或换用更稳定的直连图片。'
  }
  if (/quota|storage|空间|容量/i.test(message)) {
    return '远程缓存失败：本地存储空间可能不足，请清理空间后重试。'
  }
  return '远程缓存失败：仍会使用原图片链接，请检查网络、图片地址或授权后重试。'
}

function hasAppliedBackgroundMedia(settings: typeof DEFAULT_BACKGROUND_SETTINGS): boolean {
  if (settings.type === 'color') {
    return true
  }
  if (settings.type === 'video') {
    return Boolean(document.querySelector('.newtab-background-video'))
  }
  if (settings.type === 'image' || settings.type === 'urls') {
    return Boolean(document.body.style.backgroundImage)
  }
  return true
}

function setWallpaperPlaceholderColor(color = state.backgroundSettings.color): void {
  document.documentElement.style.setProperty(
    '--wallpaper-placeholder-bg',
    normalizeHexColor(color, DEFAULT_BACKGROUND_SETTINGS.color)
  )
}

function markWallpaperReady(): void {
  document.documentElement.classList.remove('loading-wallpaper', 'newtab-booting')
}

function markWallpaperPending(): void {
  document.documentElement.classList.add('loading-wallpaper')
}

async function applyBackgroundSettings(): Promise<void> {
  const applyToken = ++backgroundApplyToken
  const settings = state.backgroundSettings
  const mediaSignature = getBackgroundMediaSignature(settings)
  applyBackgroundMaskSettings(settings)
  setWallpaperPlaceholderColor(settings.color)

  if (
    mediaSignature === lastAppliedBackgroundMediaSignature &&
    hasAppliedBackgroundMedia(settings)
  ) {
    markWallpaperReady()
    return
  }

  if (settings.type === 'color') {
    clearVideoBackground()
    setActiveBackgroundObjectUrl('')
    document.body.style.backgroundImage = ''
    document.documentElement.style.setProperty('--bg', settings.color)
    lastAppliedBackgroundMediaSignature = mediaSignature
    markWallpaperReady()
    return
  }

  document.documentElement.style.setProperty('--bg', settings.color)

  if (settings.type === 'urls') {
    const imageUrl = normalizeBackgroundImageUrl(settings.url)
    if (imageUrl) {
      markWallpaperReady()
      void applyUrlBackgroundImage(imageUrl, applyToken, mediaSignature)
    } else {
      clearVideoBackground()
      setActiveBackgroundObjectUrl('')
      document.body.style.backgroundImage = ''
      lastAppliedBackgroundMediaSignature = mediaSignature
      markWallpaperReady()
    }
    return
  }

  if (settings.type !== 'image' && settings.type !== 'video') {
    lastAppliedBackgroundMediaSignature = mediaSignature
    markWallpaperReady()
    return
  }

  clearVideoBackground()
  setActiveBackgroundObjectUrl('')
  document.body.style.backgroundImage = ''
  markWallpaperPending()

  const mediaType = settings.type
  let mediaRecord: Awaited<ReturnType<typeof getBackgroundMedia>>
  try {
    mediaRecord = await getBackgroundMedia(mediaType)
  } catch {
    if (applyToken === backgroundApplyToken) {
      markWallpaperReady()
    }
    return
  }
  if (applyToken !== backgroundApplyToken || !mediaRecord) {
    if (applyToken === backgroundApplyToken) {
      markWallpaperReady()
    }
    return
  }

  const objectUrl = URL.createObjectURL(mediaRecord.blob)
  setActiveBackgroundObjectUrl(objectUrl)
  if (mediaType === 'image') {
    const ready = await waitForBackgroundImageReady(objectUrl, applyToken)
    if (applyToken !== backgroundApplyToken) {
      return
    }
    if (ready) {
      document.body.style.backgroundImage = `url("${escapeCssUrl(objectUrl)}")`
      lastAppliedBackgroundMediaSignature = mediaSignature
    } else {
      setActiveBackgroundObjectUrl('')
    }
    markWallpaperReady()
    return
  }

  const video = document.createElement('video')
  video.className = 'newtab-background-video'
  video.autoplay = true
  video.loop = true
  video.muted = true
  video.playsInline = true
  video.src = objectUrl
  document.body.prepend(video)
  const ready = await waitForBackgroundVideoReady(video, applyToken)
  if (applyToken !== backgroundApplyToken) {
    return
  }
  if (ready) {
    void video.play()
    lastAppliedBackgroundMediaSignature = mediaSignature
  } else {
    video.remove()
    setActiveBackgroundObjectUrl('')
  }
  markWallpaperReady()
}

function waitForBackgroundImageReady(imageUrl: string, applyToken: number): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image()
    let settled = false
    let timeout = 0

    const settle = (ready: boolean) => {
      if (settled) {
        return
      }
      settled = true
      window.clearTimeout(timeout)
      image.onload = null
      image.onerror = null
      resolve(ready && applyToken === backgroundApplyToken)
    }

    timeout = window.setTimeout(() => {
      settle(false)
    }, BACKGROUND_IMAGE_READY_TIMEOUT_MS)
    image.onload = () => {
      settle(true)
    }
    image.onerror = () => {
      settle(false)
    }
    image.src = imageUrl
  })
}

function waitForBackgroundVideoReady(video: HTMLVideoElement, applyToken: number): Promise<boolean> {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return Promise.resolve(applyToken === backgroundApplyToken)
  }

  return new Promise((resolve) => {
    let settled = false
    let timeout = 0

    const cleanup = () => {
      window.clearTimeout(timeout)
      video.removeEventListener('loadedmetadata', handleReady)
      video.removeEventListener('canplay', handleReady)
      video.removeEventListener('error', handleError)
    }

    const settle = (ready: boolean) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      resolve(ready && applyToken === backgroundApplyToken)
    }

    function handleReady(): void {
      settle(true)
    }

    function handleError(): void {
      settle(false)
    }

    timeout = window.setTimeout(() => {
      settle(false)
    }, BACKGROUND_VIDEO_READY_TIMEOUT_MS)
    video.addEventListener('loadedmetadata', handleReady, { once: true })
    video.addEventListener('canplay', handleReady, { once: true })
    video.addEventListener('error', handleError, { once: true })
  })
}

async function applyUrlBackgroundImage(
  imageUrl: string,
  applyToken: number,
  mediaSignature: string
): Promise<void> {
  try {
    const cachedRecord = await getBackgroundUrlCache(imageUrl)
    if (applyToken !== backgroundApplyToken) {
      return
    }

    if (cachedRecord) {
      const ready = await setBackgroundImageFromBlob(cachedRecord.blob, applyToken, {
        preserveCurrentUntilReady: true
      })
      if (applyToken !== backgroundApplyToken) {
        return
      }
      if (ready) {
        clearVideoBackground()
        lastAppliedBackgroundMediaSignature = mediaSignature
      }
      markWallpaperReady()
      return
    }

    const ready = await waitForBackgroundImageReady(imageUrl, applyToken)
    if (applyToken !== backgroundApplyToken) {
      return
    }
    if (ready) {
      clearVideoBackground()
      setActiveBackgroundObjectUrl('')
      document.body.style.backgroundImage = `url("${escapeCssUrl(imageUrl)}")`
      lastAppliedBackgroundMediaSignature = mediaSignature
    }
    markWallpaperReady()
    void cacheBackgroundUrlImage(imageUrl)
  } catch {
    if (applyToken === backgroundApplyToken) {
      const ready = await waitForBackgroundImageReady(imageUrl, applyToken)
      if (applyToken !== backgroundApplyToken) {
        return
      }
      if (ready) {
        clearVideoBackground()
        setActiveBackgroundObjectUrl('')
        document.body.style.backgroundImage = `url("${escapeCssUrl(imageUrl)}")`
        lastAppliedBackgroundMediaSignature = mediaSignature
      }
      markWallpaperReady()
    }
  }
}

async function cacheBackgroundUrlImage(imageUrl: string): Promise<void> {
  if (state.backgroundUrlCacheBusy || !isCurrentBackgroundUrl(imageUrl)) {
    return
  }

  state.backgroundUrlCacheBusy = true
  state.backgroundUrlCacheStatus = '下载中...'
  try {
    const blob = await fetchBackgroundUrlImage(imageUrl)
    if (!isCurrentBackgroundUrl(imageUrl)) {
      return
    }

    await saveBackgroundUrlCache(imageUrl, blob)
    if (!isCurrentBackgroundUrl(imageUrl)) {
      return
    }

    state.backgroundUrlCacheStatus = `已缓存 ${formatBytes(blob.size)}`
  } catch {
    // 缓存是增强能力，失败时继续使用原图片链接，不向扩展错误页写入噪音。
  } finally {
    state.backgroundUrlCacheBusy = false
  }
}

function isCurrentBackgroundUrl(imageUrl: string): boolean {
  return state.backgroundSettings.type === 'urls' &&
    normalizeBackgroundImageUrl(state.backgroundSettings.url) === imageUrl
}

async function setBackgroundImageFromBlob(
  blob: Blob,
  applyToken = backgroundApplyToken,
  { preserveCurrentUntilReady = false }: { preserveCurrentUntilReady?: boolean } = {}
): Promise<boolean> {
  const objectUrl = URL.createObjectURL(blob)
  if (!preserveCurrentUntilReady) {
    setActiveBackgroundObjectUrl(objectUrl)
  }
  const ready = await waitForBackgroundImageReady(objectUrl, applyToken)
  if (applyToken !== backgroundApplyToken) {
    if (preserveCurrentUntilReady) {
      URL.revokeObjectURL(objectUrl)
    }
    return false
  }
  if (ready) {
    if (preserveCurrentUntilReady) {
      setActiveBackgroundObjectUrl(objectUrl)
    }
    document.body.style.backgroundImage = `url("${escapeCssUrl(objectUrl)}")`
  } else {
    if (preserveCurrentUntilReady) {
      URL.revokeObjectURL(objectUrl)
    } else {
      setActiveBackgroundObjectUrl('')
    }
  }
  return ready
}

function applyBackgroundMaskSettings(settings = state.backgroundSettings): void {
  const mask = document.getElementById('newtab-background-mask')
  document.body.classList.toggle('background-mask-enabled', settings.maskEnabled)
  document.body.dataset.backgroundMaskStyle = settings.maskStyle
  document.documentElement.style.setProperty('--background-mask-blur', `${settings.maskBlur}px`)

  if (mask instanceof HTMLElement) {
    mask.dataset.maskStyle = settings.maskStyle
  }
}

function clearVideoBackground(): void {
  document.querySelector('.newtab-background-video')?.remove()
}

function setActiveBackgroundObjectUrl(nextUrl: string): void {
  if (activeBackgroundObjectUrl && activeBackgroundObjectUrl !== nextUrl) {
    URL.revokeObjectURL(activeBackgroundObjectUrl)
  }
  activeBackgroundObjectUrl = nextUrl
}

function normalizeBackgroundImageUrl(value: string): string {
  const rawUrl = String(value || '').trim()
  if (!rawUrl) {
    return ''
  }

  const candidate = /^[a-z][a-z\d+\-.]*:/i.test(rawUrl) ? rawUrl : `https://${rawUrl}`
  try {
    const parsedUrl = new URL(candidate)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return ''
    }
    return parsedUrl.href
  } catch {
    return ''
  }
}

function escapeCssUrl(value: string): string {
  return value.replace(/["\\]/g, '\\$&')
}

function openBackgroundMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BACKGROUND_MEDIA_DB_NAME, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(BACKGROUND_MEDIA_STORE)) {
        db.createObjectStore(BACKGROUND_MEDIA_STORE)
      }
    }
    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onerror = () => {
      reject(request.error || new Error('背景媒体数据库打开失败。'))
    }
  })
}

async function saveBackgroundMedia(mediaType: 'image' | 'video', file: File): Promise<void> {
  const db = await openBackgroundMediaDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(BACKGROUND_MEDIA_STORE, 'readwrite')
      transaction.objectStore(BACKGROUND_MEDIA_STORE).put({
        blob: file,
        name: file.name,
        type: file.type,
        updatedAt: Date.now()
      }, mediaType)
      transaction.oncomplete = () => {
        resolve()
      }
      transaction.onerror = () => {
        reject(transaction.error || new Error('背景媒体保存失败。'))
      }
      transaction.onabort = () => {
        reject(transaction.error || new Error('背景媒体保存失败。'))
      }
    })
  } finally {
    db.close()
  }
}

async function getBackgroundMedia(mediaType: 'image' | 'video'): Promise<{
  blob: Blob
  name: string
  type: string
  updatedAt: number
} | null> {
  const db = await openBackgroundMediaDb()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(BACKGROUND_MEDIA_STORE, 'readonly')
      const request = transaction.objectStore(BACKGROUND_MEDIA_STORE).get(mediaType)
      request.onsuccess = () => {
        const record = request.result as {
          blob?: unknown
          name?: unknown
          type?: unknown
          updatedAt?: unknown
        } | undefined
        if (!record?.blob || !(record.blob instanceof Blob)) {
          resolve(null)
          return
        }
        resolve({
          blob: record.blob,
          name: String(record.name || ''),
          type: String(record.type || ''),
          updatedAt: Number(record.updatedAt) || 0
        })
      }
      request.onerror = () => {
        reject(request.error || new Error('背景媒体读取失败。'))
      }
    })
  } finally {
    db.close()
  }
}

async function getBackgroundUrlCache(imageUrl: string): Promise<{
  blob: Blob
  url: string
  type: string
  updatedAt: number
} | null> {
  const db = await openBackgroundMediaDb()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(BACKGROUND_MEDIA_STORE, 'readonly')
      const request = transaction.objectStore(BACKGROUND_MEDIA_STORE).get(BACKGROUND_URL_CACHE_KEY)
      request.onsuccess = () => {
        const record = request.result as {
          blob?: unknown
          url?: unknown
          type?: unknown
          updatedAt?: unknown
        } | undefined
        if (
          !record?.blob ||
          !(record.blob instanceof Blob) ||
          String(record.url || '') !== imageUrl
        ) {
          resolve(null)
          return
        }
        resolve({
          blob: record.blob,
          url: String(record.url || ''),
          type: String(record.type || ''),
          updatedAt: Number(record.updatedAt) || 0
        })
      }
      request.onerror = () => {
        reject(request.error || new Error('背景 URL 缓存读取失败。'))
      }
    })
  } finally {
    db.close()
  }
}

async function saveBackgroundUrlCache(imageUrl: string, blob: Blob): Promise<void> {
  const db = await openBackgroundMediaDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(BACKGROUND_MEDIA_STORE, 'readwrite')
      transaction.objectStore(BACKGROUND_MEDIA_STORE).put({
        blob,
        url: imageUrl,
        type: blob.type,
        updatedAt: Date.now()
      }, BACKGROUND_URL_CACHE_KEY)
      transaction.oncomplete = () => {
        resolve()
      }
      transaction.onerror = () => {
        reject(transaction.error || new Error('背景 URL 缓存保存失败。'))
      }
      transaction.onabort = () => {
        reject(transaction.error || new Error('背景 URL 缓存保存失败。'))
      }
    })
  } finally {
    db.close()
  }
}

async function clearBackgroundUrlCache(): Promise<void> {
  const db = await openBackgroundMediaDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(BACKGROUND_MEDIA_STORE, 'readwrite')
      transaction.objectStore(BACKGROUND_MEDIA_STORE).delete(BACKGROUND_URL_CACHE_KEY)
      transaction.oncomplete = () => {
        resolve()
      }
      transaction.onerror = () => {
        reject(transaction.error || new Error('背景 URL 缓存清除失败。'))
      }
      transaction.onabort = () => {
        reject(transaction.error || new Error('背景 URL 缓存清除失败。'))
      }
    })
  } finally {
    db.close()
  }
}

async function fetchBackgroundUrlImage(imageUrl: string): Promise<Blob> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => {
    controller.abort()
  }, BACKGROUND_URL_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(imageUrl, {
      cache: 'force-cache',
      signal: controller.signal
    })
    if (!response.ok) {
      throw new Error(`图片请求失败：${response.status}`)
    }

    const declaredSize = validateBackgroundContentLength(
      response.headers.get('content-length'),
      BACKGROUND_URL_MAX_BYTES
    )
    if (!declaredSize.allowed) {
      throw new Error(declaredSize.message)
    }

    const blob = await response.blob()
    const contentType = response.headers.get('content-type') || blob.type
    if (!blob.size || !contentType.toLowerCase().startsWith('image/')) {
      throw new Error('链接返回的内容不是图片。')
    }

    const finalSize = validateBackgroundBlobSize(blob.size, BACKGROUND_URL_MAX_BYTES)
    if (!finalSize.allowed) {
      throw new Error(finalSize.message)
    }

    const optimizedBlob = await createOptimizedBackgroundImageBlob(blob)
    const optimizedSize = validateBackgroundBlobSize(optimizedBlob.size, BACKGROUND_URL_MAX_BYTES)
    if (!optimizedSize.allowed) {
      throw new Error(optimizedSize.message)
    }
    return optimizedBlob
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('远程图片下载超时。')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

async function createOptimizedBackgroundImageBlob(blob: Blob): Promise<Blob> {
  if (['image/gif', 'image/svg+xml'].includes(blob.type.toLowerCase())) {
    return blob
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    return blob
  }

  try {
    const targetMaxDimension = getBackgroundCacheTargetDimension()
    const sourceMaxDimension = Math.max(bitmap.width, bitmap.height)
    if (!sourceMaxDimension || sourceMaxDimension <= targetMaxDimension) {
      return blob
    }

    const scale = targetMaxDimension / sourceMaxDimension
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale))
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const context = canvas.getContext('2d')
    if (!context) {
      return blob
    }

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
    const optimizedBlob = await canvasToBlob(canvas, 'image/webp', BACKGROUND_URL_CACHE_QUALITY)
    if (!optimizedBlob || optimizedBlob.size >= blob.size) {
      return blob
    }

    return optimizedBlob
  } finally {
    bitmap.close()
  }
}

function getBackgroundCacheTargetDimension(): number {
  const viewportMaxDimension = Math.max(window.innerWidth || 0, window.innerHeight || 0, 1280)
  const pixelRatio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2)
  return Math.min(BACKGROUND_URL_CACHE_MAX_DIMENSION, Math.ceil(viewportMaxDimension * pixelRatio))
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob)
    }, type, quality)
  })
}

function normalizeSearchSettings(rawSettings: unknown): typeof DEFAULT_SEARCH_SETTINGS {
  if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
    return { ...DEFAULT_SEARCH_SETTINGS }
  }

  const settings = rawSettings as Record<string, unknown>
  const placeholder = String(settings.placeholder || '').trim() || DEFAULT_SEARCH_SETTINGS.placeholder
  const engine = normalizeSearchEngineId(settings.engine, DEFAULT_SEARCH_SETTINGS.engine)
  return {
    enabled: settings.enabled !== false,
    openInNewTab: settings.openInNewTab === true,
    engine,
    enabledEngines: normalizeEnabledSearchEngineIds(settings.enabledEngines, engine),
    placeholder,
    width: clampNumber(settings.width, 16, 72, DEFAULT_SEARCH_SETTINGS.width),
    height: clampNumber(settings.height, 28, 56, DEFAULT_SEARCH_SETTINGS.height),
    offsetY: clampNumber(
      settings.offsetY,
      SEARCH_OFFSET_ABSOLUTE_MIN,
      SEARCH_OFFSET_ABSOLUTE_MAX,
      DEFAULT_SEARCH_SETTINGS.offsetY
    ),
    background: clampNumber(settings.background, 0, 92, DEFAULT_SEARCH_SETTINGS.background)
  }
}

function getSearchPlaceholder(settings: typeof DEFAULT_SEARCH_SETTINGS): string {
  return String(settings.placeholder || '').trim() || DEFAULT_SEARCH_SETTINGS.placeholder
}

function readSearchSettingsFromControls(): typeof DEFAULT_SEARCH_SETTINGS {
  const enabledInput = document.getElementById('search-enabled')
  const openInput = document.getElementById('search-open-new-tab')
  const engineInput = document.getElementById('search-engine')
  const engineToggleInputs = Array.from(
    document.querySelectorAll<HTMLInputElement>('[data-search-engine-toggle]')
  )
  const placeholderInput = document.getElementById('search-placeholder')
  const widthInput = document.getElementById('search-width')
  const heightInput = document.getElementById('search-height')
  const offsetYInput = document.getElementById('search-offset-y')
  const backgroundInput = document.getElementById('search-background')

  return normalizeSearchSettings({
    enabled: enabledInput instanceof HTMLInputElement ? enabledInput.checked : state.searchSettings.enabled,
    openInNewTab: openInput instanceof HTMLInputElement ? openInput.checked : state.searchSettings.openInNewTab,
    engine: engineInput instanceof HTMLSelectElement ? engineInput.value : state.searchSettings.engine,
    enabledEngines: engineToggleInputs.length
      ? engineToggleInputs
        .filter((input) => input.checked)
        .map((input) => input.dataset.searchEngineToggle || '')
      : state.searchSettings.enabledEngines,
    placeholder: placeholderInput instanceof HTMLInputElement ? placeholderInput.value : state.searchSettings.placeholder,
    width: widthInput instanceof HTMLInputElement ? Number(widthInput.value) : state.searchSettings.width,
    height: heightInput instanceof HTMLInputElement ? Number(heightInput.value) : state.searchSettings.height,
    offsetY: offsetYInput instanceof HTMLInputElement ? Number(offsetYInput.value) : state.searchSettings.offsetY,
    background: backgroundInput instanceof HTMLInputElement ? Number(backgroundInput.value) : state.searchSettings.background
  })
}

function syncSearchSettingsControls(): void {
  const settings = state.searchSettings
  const enabledInput = document.getElementById('search-enabled')
  const openInput = document.getElementById('search-open-new-tab')
  const engineInput = document.getElementById('search-engine')
  const engineToggleInputs = Array.from(
    document.querySelectorAll<HTMLInputElement>('[data-search-engine-toggle]')
  )
  const placeholderInput = document.getElementById('search-placeholder')
  const widthInput = document.getElementById('search-width')
  const heightInput = document.getElementById('search-height')
  const offsetYInput = document.getElementById('search-offset-y')
  const backgroundInput = document.getElementById('search-background')
  const dependentControls = [
    openInput,
    engineInput,
    ...engineToggleInputs,
    placeholderInput,
    widthInput,
    heightInput,
    offsetYInput,
    backgroundInput
  ]

  if (enabledInput instanceof HTMLInputElement) {
    enabledInput.checked = settings.enabled
  }
  if (openInput instanceof HTMLInputElement) {
    openInput.checked = settings.openInNewTab
    openInput.disabled = !settings.enabled
  }
  if (engineInput instanceof HTMLSelectElement) {
    engineInput.value = settings.engine
    engineInput.disabled = !settings.enabled
  }
  for (const input of engineToggleInputs) {
    const engineId = input.dataset.searchEngineToggle || ''
    const isSelected = settings.engine === engineId
    input.checked = settings.enabledEngines.includes(engineId as SearchEngineId)
    input.disabled = !settings.enabled || isSelected
    input.closest<HTMLElement>('.search-engine-toggle')?.classList.toggle('active', input.checked)
    input.closest<HTMLElement>('.search-engine-toggle')?.classList.toggle('locked', isSelected)
  }
  if (placeholderInput instanceof HTMLInputElement) {
    placeholderInput.value = settings.placeholder
    placeholderInput.disabled = !settings.enabled
  }
  syncSearchWidthControl()
  if (heightInput instanceof HTMLInputElement) {
    heightInput.value = String(settings.height)
    heightInput.disabled = !settings.enabled
  }
  syncSearchOffsetControl()
  if (backgroundInput instanceof HTMLInputElement) {
    backgroundInput.value = String(settings.background)
    backgroundInput.disabled = !settings.enabled
  }

  setTextContent('search-height-value', `${settings.height}px`)
  setTextContent('search-background-value', `${settings.background}%`)

  for (const control of dependentControls) {
    const row = control instanceof HTMLElement
      ? control.closest<HTMLElement>('.setting-row')
      : null
    row?.classList.toggle('setting-row-disabled', !settings.enabled)
  }
}

function syncSearchWidthControl(): void {
  const widthInput = document.getElementById('search-width')
  const bounds = state.searchWidthBounds || SEARCH_WIDTH_BOUNDS_FALLBACK
  const value = clampNumber(
    state.searchSettings.width,
    bounds.min,
    bounds.max,
    DEFAULT_SEARCH_SETTINGS.width
  )
  if (widthInput instanceof HTMLInputElement) {
    widthInput.min = String(bounds.min)
    widthInput.max = String(bounds.max)
    widthInput.value = String(value)
    widthInput.disabled = !state.searchSettings.enabled
    updateSettingRangeVisual(widthInput)
  }
  setTextContent('search-width-value', `${value}vw`)
}

function syncSearchOffsetControl(): void {
  const offsetYInput = document.getElementById('search-offset-y')
  const bounds = state.searchOffsetBounds || SEARCH_OFFSET_BOUNDS_FALLBACK
  const value = clampNumber(
    state.searchSettings.offsetY,
    bounds.min,
    bounds.max,
    DEFAULT_SEARCH_SETTINGS.offsetY
  )
  if (offsetYInput instanceof HTMLInputElement) {
    offsetYInput.min = String(bounds.min)
    offsetYInput.max = String(bounds.max)
    offsetYInput.value = String(value)
    offsetYInput.disabled = !state.searchSettings.enabled
    updateSettingRangeVisual(offsetYInput)
  }
  setTextContent('search-offset-y-value', `${value}px`)
}

async function saveSearchSettings(): Promise<void> {
  await saveSettingsWithFeedback({
    [STORAGE_KEYS.newTabSearchSettings]: state.searchSettings
  })
}

function scheduleSearchSettingsSave(): void {
  window.clearTimeout(searchSettingsSaveTimer)
  searchSettingsSaveTimer = window.setTimeout(() => {
    searchSettingsSaveTimer = 0
    void saveSearchSettings().catch((error) => {
      console.warn('新标签页搜索设置保存失败。', error)
    })
  }, SETTINGS_SAVE_DEBOUNCE_MS)
}

function normalizeGeneralSettings(rawSettings: unknown): typeof DEFAULT_GENERAL_SETTINGS {
  if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
    return { ...DEFAULT_GENERAL_SETTINGS }
  }

  const settings = rawSettings as Record<string, unknown>
  const legacyQuickAccess = settings.showFrequentBookmarks !== false || settings.showRecentBookmarks !== false
  return {
    hideSettingsTrigger: settings.hideSettingsTrigger === true,
    showPortalOverview: settings.showPortalOverview !== false,
    showQuickAccess: typeof settings.showQuickAccess === 'boolean'
      ? settings.showQuickAccess
      : legacyQuickAccess,
    showSourceNavigation: settings.showSourceNavigation !== false,
    openBookmarksInNewTab: settings.openBookmarksInNewTab === true
  }
}

function readGeneralSettingsFromControls(): typeof DEFAULT_GENERAL_SETTINGS {
  const hideInput = document.getElementById('general-hide-settings-trigger')
  const showOverviewInput = document.getElementById('general-show-overview')
  const showQuickAccessInput = document.getElementById('general-show-quick-access')
  const openBookmarksInput = document.getElementById('general-open-bookmarks-new-tab')
  const showSourceNavigationInput = document.getElementById('folder-show-source-navigation')

  return normalizeGeneralSettings({
    hideSettingsTrigger: hideInput instanceof HTMLInputElement
      ? hideInput.checked
      : state.generalSettings.hideSettingsTrigger,
    showPortalOverview: showOverviewInput instanceof HTMLInputElement
      ? showOverviewInput.checked
      : state.generalSettings.showPortalOverview,
    showQuickAccess: showQuickAccessInput instanceof HTMLInputElement
      ? showQuickAccessInput.checked
      : state.generalSettings.showQuickAccess,
    showSourceNavigation: showSourceNavigationInput instanceof HTMLInputElement
      ? showSourceNavigationInput.checked
      : state.generalSettings.showSourceNavigation,
    openBookmarksInNewTab: openBookmarksInput instanceof HTMLInputElement
      ? openBookmarksInput.checked
      : state.generalSettings.openBookmarksInNewTab
  })
}

function syncGeneralSettingsControls(): void {
  const hideInput = document.getElementById('general-hide-settings-trigger')
  const showOverviewInput = document.getElementById('general-show-overview')
  const showQuickAccessInput = document.getElementById('general-show-quick-access')
  const openBookmarksInput = document.getElementById('general-open-bookmarks-new-tab')
  const showSourceNavigationInput = document.getElementById('folder-show-source-navigation')

  if (hideInput instanceof HTMLInputElement) {
    hideInput.checked = state.generalSettings.hideSettingsTrigger
  }
  if (showOverviewInput instanceof HTMLInputElement) {
    showOverviewInput.checked = state.generalSettings.showPortalOverview
  }
  if (showQuickAccessInput instanceof HTMLInputElement) {
    showQuickAccessInput.checked = state.generalSettings.showQuickAccess
  }
  if (openBookmarksInput instanceof HTMLInputElement) {
    openBookmarksInput.checked = state.generalSettings.openBookmarksInNewTab
  }
  if (showSourceNavigationInput instanceof HTMLInputElement) {
    showSourceNavigationInput.checked = state.generalSettings.showSourceNavigation
  }
}

async function saveGeneralSettings(): Promise<void> {
  await saveSettingsWithFeedback({
    [STORAGE_KEYS.newTabGeneralSettings]: state.generalSettings
  })
}

function applyGeneralSettings(): void {
  document.body.classList.toggle(
    'settings-trigger-auto-hide',
    state.generalSettings.hideSettingsTrigger
  )
}

function readFolderSettingsFromControls(): NewTabFolderSettings {
  const hideInput = document.getElementById('folder-hide-names')

  return normalizeFolderSettings({
    selectedFolderIds: state.folderSettings.selectedFolderIds,
    hideFolderNames: hideInput instanceof HTMLInputElement
      ? hideInput.checked
      : state.folderSettings.hideFolderNames
  })
}

function syncFolderSettingsControls(): void {
  const hideInput = document.getElementById('folder-hide-names')
  const selectedList = document.getElementById('folder-selected-list')
  const selectedCount = document.getElementById('folder-selected-count')
  const toggle = document.getElementById('folder-candidates-toggle')
  const panel = document.getElementById('folder-candidates-panel')
  const searchInput = document.getElementById('folder-candidate-search')
  const candidateList = document.getElementById('folder-candidate-list')

  if (hideInput instanceof HTMLInputElement) {
    hideInput.checked = state.folderSettings.hideFolderNames
  }

  if (selectedCount) {
    selectedCount.textContent = String(state.folderSettings.selectedFolderIds.length)
  }

  if (selectedList instanceof HTMLElement) {
    selectedList.replaceChildren(...createSelectedFolderControls())
  }

  if (toggle instanceof HTMLButtonElement) {
    toggle.setAttribute('aria-expanded', String(state.folderCandidatesExpanded))
    toggle.classList.toggle('expanded', state.folderCandidatesExpanded)
    const label = toggle.querySelector('[data-folder-toggle-label]')
    if (label) {
      label.textContent = state.folderCandidatesExpanded ? '收起候选文件夹' : '展开候选文件夹'
    }
  }

  if (panel instanceof HTMLElement) {
    setRevealPanelExpanded(panel, state.folderCandidatesExpanded)
  }

  if (searchInput instanceof HTMLInputElement && searchInput.value !== state.folderCandidateQuery) {
    searchInput.value = state.folderCandidateQuery
  }

  if (candidateList instanceof HTMLElement) {
    candidateList.replaceChildren(...createFolderCandidateControls())
  }
}

function syncNewTabModernSettingsControls(): void {
  syncWorkspaceSettingsControls()
  syncModuleSettingsControls()
}

function syncWorkspaceSettingsControls(): void {
  const activeWorkspace = getActiveNewTabWorkspace(state.workspaceSettings)
  setTextContent('workspace-active-name', `${activeWorkspace.name} · ${activeWorkspace.pinnedIds.length} 个固定入口`)

  const list = document.getElementById('workspace-settings-list')
  if (!(list instanceof HTMLElement)) {
    return
  }

  const rows = state.workspaceSettings.workspaces.map((workspace) => {
    const row = document.createElement('div')
    row.className = 'workspace-settings-row'
    row.dataset.workspaceId = workspace.id

    const input = document.createElement('input')
    input.className = 'setting-text-input workspace-name-input'
    input.type = 'text'
    input.value = workspace.name
    input.maxLength = 24
    input.dataset.workspaceNameInput = workspace.id
    input.setAttribute('aria-label', `重命名场景 ${workspace.name}`)

    const meta = document.createElement('span')
    meta.className = 'workspace-settings-meta'
    meta.textContent = `${workspace.pinnedIds.length} 个固定入口`

    const button = document.createElement('button')
    button.className = 'newtab-button secondary workspace-activate-button'
    button.type = 'button'
    button.dataset.workspaceActivate = workspace.id
    button.disabled = workspace.id === state.workspaceSettings.activeWorkspaceId
    button.textContent = workspace.id === state.workspaceSettings.activeWorkspaceId ? '当前' : '切换'

    row.append(input, meta, button)
    return row
  })

  list.replaceChildren(...rows)
}

function syncModuleSettingsControls(): void {
  const containerIdByKey: Record<NewTabModuleSettingKey, string> = {
    speedDial: 'newtab-speed-dial-setting',
    health: 'newtab-health-setting'
  }

  for (const setting of buildNewTabModuleSettingRows(state.moduleSettings)) {
    const container = document.getElementById(containerIdByKey[setting.key])
    if (container instanceof HTMLElement) {
      container.replaceChildren(createModuleSettingRow(setting))
    }
  }
}

function createModuleSettingRow(setting: ReturnType<typeof buildNewTabModuleSettingRows>[number]): HTMLLabelElement {
  const label = document.createElement('label')
  label.className = 'setting-row'
  label.dataset.moduleSettingRow = setting.key

  const copy = document.createElement('span')
  copy.className = 'setting-label-stack'
  const title = document.createElement('span')
  title.textContent = setting.label
  const detail = document.createElement('small')
  detail.textContent = setting.description
  copy.append(title, detail)

  const input = document.createElement('input')
  input.className = 'setting-switch-input'
  input.type = 'checkbox'
  input.checked = setting.enabled
  input.dataset.moduleSettingToggle = setting.key

  const switchVisual = document.createElement('span')
  switchVisual.className = 'setting-switch'
  switchVisual.setAttribute('aria-hidden', 'true')

  label.append(copy, input, switchVisual)
  return label
}

function handleWorkspaceSettingsClick(event: Event): void {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  const button = target.closest<HTMLButtonElement>('[data-workspace-activate]')
  if (!button) {
    return
  }

  void switchNewTabWorkspace(String(button.dataset.workspaceActivate || ''))
}

function handleWorkspaceSettingsInput(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) {
    return
  }

  const workspaceId = String(target.dataset.workspaceNameInput || '')
  if (!workspaceId) {
    return
  }

  state.workspaceSettings = updateNewTabWorkspace(
    state.workspaceSettings,
    workspaceId,
    { name: target.value },
    { validBookmarkIds: state.allBookmarkMap.keys() }
  )
  void saveNewTabWorkspaceSettings().catch((error) => {
    setSettingsSaveStatus('error', error instanceof Error ? error.message : '场景设置保存失败')
  })
  render()
}

function handleModuleSettingsChange(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) {
    return
  }

  const key = target.dataset.moduleSettingToggle as NewTabModuleSettingKey | undefined
  if (!key || !(key in state.moduleSettings)) {
    return
  }

  state.moduleSettings = normalizeNewTabModuleSettings({
    ...state.moduleSettings,
    [key]: target.checked
  })
  void saveNewTabModuleSettings().catch((error) => {
    setSettingsSaveStatus('error', error instanceof Error ? error.message : '模块设置保存失败')
  })
  syncNewTabModernSettingsControls()
  render()
}

function createSelectedFolderControls(): HTMLElement[] {
  const selectedIds = state.folderSettings.selectedFolderIds
  if (!selectedIds.length) {
    const empty = document.createElement('p')
    empty.className = 'folder-source-empty'
    empty.textContent = '未选择来源文件夹。选择来源只会决定新标签页显示哪些书签，不会移动、删除或重排原有书签。'
    return [empty]
  }

  const folders = getFolderCandidateMap()
  return selectedIds.map((folderId) => {
    const folder = folders.get(folderId)
    const row = document.createElement('div')
    row.className = 'folder-source-selected-item'

    const copy = document.createElement('span')
    copy.className = 'folder-source-selected-copy'

    const title = document.createElement('strong')
    title.textContent = folder?.title || '已删除的文件夹'

    const path = document.createElement('span')
    path.textContent = folder?.path || folderId

    const stats = document.createElement('span')
    stats.textContent = folder
      ? formatFolderCandidateCountSummary(folder)
      : '来源不可用'

    copy.append(title, path, stats)

    const remove = document.createElement('button')
    remove.className = 'folder-source-remove'
    remove.type = 'button'
    remove.dataset.folderRemoveId = folderId
    const folderTitle = folder?.title || '文件夹'
    const affectedCount = folder?.totalBookmarkCount || 0
    const removeLabel = `从新标签页移除「${folderTitle}」，将隐藏 ${affectedCount} 个书签，不会删除书签`
    remove.setAttribute('aria-label', removeLabel)
    remove.title = removeLabel
    remove.textContent = '×'

    row.append(copy, remove)
    return row
  })
}

function createFolderCandidateControls(): HTMLElement[] {
  const candidates = getFilteredFolderCandidates()
  if (!candidates.length) {
    const empty = document.createElement('p')
    empty.className = 'folder-source-empty'
    empty.setAttribute('role', 'status')
    empty.setAttribute('aria-live', 'polite')
    empty.textContent = '没有匹配的文件夹。请清空搜索词，或选择其他来源文件夹。'
    return [empty]
  }

  const selectedIds = new Set(state.folderSettings.selectedFolderIds)
  const activeId = resolveFolderCandidateActiveId(candidates)
  return candidates.map((folder) => {
    const selected = selectedIds.has(folder.id)
    const button = document.createElement('button')
    button.className = `folder-candidate-card ${selected ? 'selected' : ''}`
    button.type = 'button'
    button.dataset.folderCandidateId = folder.id
    button.tabIndex = folder.id === activeId ? 0 : -1
    button.title = folder.path || folder.title
    button.setAttribute('role', 'option')
    button.setAttribute('aria-selected', String(selected))

    const copy = document.createElement('span')
    copy.className = 'folder-candidate-copy'

    const title = document.createElement('strong')
    title.textContent = folder.title || '未命名文件夹'

    const path = document.createElement('span')
    path.textContent = folder.path || folder.title || '未命名文件夹'

    const stats = document.createElement('span')
    stats.textContent = formatFolderCandidateCountSummary(folder)

    copy.append(title, path, stats)

    const badge = document.createElement('span')
    badge.className = 'folder-candidate-badge'
    badge.textContent = selected ? '已选' : String(folder.totalBookmarkCount)

    button.append(copy, badge)
    return button
  })
}

function getFilteredFolderCandidates(): NewTabFolderCandidate[] {
  const query = normalizeSettingSearchText(state.folderCandidateQuery)
  return getFolderCandidates().filter((folder) => {
    if (!query) {
      return true
    }

    return folder.normalizedTitle.includes(query) || folder.normalizedPath.includes(query)
  })
}

function getFolderCandidates(): NewTabFolderCandidate[] {
  if (!state.rootNode) {
    return []
  }

  const folderData = state.folderData || extractBookmarkData(state.rootNode)
  const folderNodeMap = state.folderNodeMap.size ? state.folderNodeMap : buildFolderNodeMap(state.rootNode)
  return folderData.folders.map((folder) => {
    const counts = getFolderBookmarkCounts(folderNodeMap.get(folder.id) || null)
    return {
      id: folder.id,
      title: folder.title,
      path: folder.path,
      normalizedTitle: folder.normalizedTitle,
      normalizedPath: folder.normalizedPath,
      directBookmarkCount: counts.directBookmarkCount,
      totalBookmarkCount: counts.totalBookmarkCount
    }
  })
}

function getFolderCandidateMap(): Map<string, NewTabFolderCandidate> {
  return new Map(getFolderCandidates().map((folder) => [folder.id, folder]))
}

function formatFolderCandidateCountSummary(folder: NewTabFolderCandidate): string {
  return `直属 ${folder.directBookmarkCount} / 合计 ${folder.totalBookmarkCount}`
}

function normalizeSettingSearchText(value: string): string {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

async function saveFolderSettings(): Promise<void> {
  await saveSettingsWithFeedback({
    [STORAGE_KEYS.newTabFolderSettings]: state.folderSettings
  })
}

function setFolderReorderStatus(message: string, tone: 'success' | 'error'): void {
  window.clearTimeout(folderReorderStatusTimer)
  state.folderReorderStatus = message
  state.folderReorderStatusTone = tone
  render()
  updateClockText()

  folderReorderStatusTimer = window.setTimeout(() => {
    clearFolderReorderStatus()
    render()
    updateClockText()
  }, tone === 'success' ? 1800 : 4200)
}

function clearFolderReorderStatus(): void {
  window.clearTimeout(folderReorderStatusTimer)
  folderReorderStatusTimer = 0
  state.folderReorderStatus = ''
  state.folderReorderStatusTone = 'success'
}

function applyFolderSettings(): void {
  document.body.classList.toggle(
    'folder-names-hidden',
    state.folderSettings.hideFolderNames
  )
}

function readIconSettingsFromControls(): IconSettings {
  const pageWidthInput = document.getElementById('icon-page-width')
  const tileWidthInput = document.getElementById('icon-tile-width')
  const iconShellSizeInput = document.getElementById('icon-shell-size')
  const columnGapInput = document.getElementById('icon-column-gap')
  const rowGapInput = document.getElementById('icon-row-gap')
  const folderGapInput = document.getElementById('icon-folder-gap')
  const columnsInput = document.getElementById('icon-columns')
  const verticalCenterInput = document.getElementById('icon-vertical-center')
  const showTitlesInput = document.getElementById('icon-show-titles')

  const settings = normalizeIconSettings({
    pageWidth: pageWidthInput instanceof HTMLInputElement
      ? Number(pageWidthInput.value)
      : state.iconSettings.pageWidth,
    tileWidth: tileWidthInput instanceof HTMLInputElement
      ? Number(tileWidthInput.value)
      : state.iconSettings.tileWidth,
    iconShellSize: iconShellSizeInput instanceof HTMLInputElement
      ? Number(iconShellSizeInput.value)
      : state.iconSettings.iconShellSize,
    columnGap: columnGapInput instanceof HTMLInputElement
      ? Number(columnGapInput.value)
      : state.iconSettings.columnGap,
    rowGap: rowGapInput instanceof HTMLInputElement
      ? Number(rowGapInput.value)
      : state.iconSettings.rowGap,
    folderGap: folderGapInput instanceof HTMLInputElement
      ? Number(folderGapInput.value)
      : state.iconSettings.folderGap,
    layoutMode: state.iconSettings.layoutMode,
    columns: columnsInput instanceof HTMLInputElement
      ? Number(columnsInput.value)
      : state.iconSettings.columns,
    verticalCenter: verticalCenterInput instanceof HTMLInputElement
      ? verticalCenterInput.checked
      : state.iconSettings.verticalCenter,
    showTitles: showTitlesInput instanceof HTMLInputElement
      ? showTitlesInput.checked
      : state.iconSettings.showTitles,
    titleLines: state.iconSettings.titleLines,
    preset: ''
  })

  return withDetectedIconPreset(settings)
}

function syncIconSettingsControls(): void {
  const settings = state.iconSettings
  const pageWidthInput = document.getElementById('icon-page-width')
  const tileWidthInput = document.getElementById('icon-tile-width')
  const iconShellSizeInput = document.getElementById('icon-shell-size')
  const columnGapInput = document.getElementById('icon-column-gap')
  const rowGapInput = document.getElementById('icon-row-gap')
  const folderGapInput = document.getElementById('icon-folder-gap')
  const columnsInput = document.getElementById('icon-columns')
  const verticalCenterInput = document.getElementById('icon-vertical-center')
  const showTitlesInput = document.getElementById('icon-show-titles')
  const tileWidthRow = document.getElementById('icon-tile-width-row')
  const titleLinesRow = document.getElementById('icon-title-lines-row')
  const columnsRow = document.getElementById('icon-columns-row')

  if (pageWidthInput instanceof HTMLInputElement) {
    pageWidthInput.value = String(settings.pageWidth)
  }
  if (tileWidthInput instanceof HTMLInputElement) {
    tileWidthInput.value = String(settings.tileWidth)
    tileWidthInput.disabled = !settings.showTitles
  }
  if (iconShellSizeInput instanceof HTMLInputElement) {
    iconShellSizeInput.value = String(settings.iconShellSize)
  }
  if (columnGapInput instanceof HTMLInputElement) {
    columnGapInput.value = String(settings.columnGap)
  }
  if (rowGapInput instanceof HTMLInputElement) {
    rowGapInput.value = String(settings.rowGap)
  }
  if (folderGapInput instanceof HTMLInputElement) {
    folderGapInput.value = String(settings.folderGap)
  }
  if (columnsInput instanceof HTMLInputElement) {
    columnsInput.value = String(settings.columns)
    columnsInput.disabled = settings.layoutMode !== 'fixed'
  }
  if (verticalCenterInput instanceof HTMLInputElement) {
    verticalCenterInput.checked = settings.verticalCenter
  }
  if (showTitlesInput instanceof HTMLInputElement) {
    showTitlesInput.checked = settings.showTitles
  }

  setTextContent('icon-page-width-value', `${settings.pageWidth}%`)
  setTextContent('icon-tile-width-value', `${settings.tileWidth}px`)
  setTextContent('icon-shell-size-value', `${settings.iconShellSize}px`)
  setTextContent('icon-column-gap-value', `${getIconGapPx(settings.columnGap)}px`)
  setTextContent('icon-row-gap-value', `${getIconRowGapPx(settings.rowGap)}px`)
  setTextContent('icon-folder-gap-value', `${getFolderGapPx(settings.folderGap)}px`)
  setTextContent('icon-columns-value', String(settings.columns))

  syncIconSegmentButtons('[data-icon-layout-mode]', settings.layoutMode)
  syncIconSegmentButtons('[data-icon-title-lines]', String(settings.titleLines), !settings.showTitles)
  tileWidthRow?.classList.toggle('setting-row-disabled', !settings.showTitles)
  titleLinesRow?.classList.toggle('setting-row-disabled', !settings.showTitles)
  columnsRow?.classList.toggle('setting-row-disabled', settings.layoutMode !== 'fixed')
  syncPresetCardSelection()
  syncIconAdvancedPanel()
  renderIconPreview()
}

async function saveIconSettings(): Promise<void> {
  await saveSettingsWithFeedback({
    [STORAGE_KEYS.newTabIconSettings]: state.iconSettings
  })
}

function scheduleIconSettingsSave(): void {
  window.clearTimeout(iconSettingsSaveTimer)
  iconSettingsSaveTimer = window.setTimeout(() => {
    iconSettingsSaveTimer = 0
    void saveIconSettings().catch((error) => {
      console.warn('新标签页图标设置保存失败。', error)
    })
  }, SETTINGS_SAVE_DEBOUNCE_MS)
}

function commitIconSettings(nextSettings: IconSettings): void {
  state.iconSettings = withDetectedIconPreset(nextSettings)
  scheduleIconSettingsSave()
  applyIconSettingsLive()
  syncIconSettingsControls()
  updateAllSettingRangeVisuals()
}

function applyIconSettingsLive(): void {
  const content = root?.querySelector<HTMLElement>('.newtab-content')
  const page = root?.querySelector<HTMLElement>('.newtab-page')
  if (!content) {
    scheduleRender({ updateClock: true })
    return
  }

  const gridSettings = {
    ...state.iconSettings,
    columns: getResponsiveIconColumns(state.iconSettings)
  }
  content.style.setProperty('--icon-page-width', `${getIconPageWidthPx(state.iconSettings.pageWidth)}px`)
  content.style.setProperty('--icon-column-gap', `${getIconGapPx(state.iconSettings.columnGap)}px`)
  content.style.setProperty('--icon-row-gap', `${getIconRowGapPx(state.iconSettings.rowGap)}px`)
  content.style.setProperty('--icon-folder-gap', `${getFolderGapPx(state.iconSettings.folderGap)}px`)
  content.style.setProperty('--icon-tile-width', `${getEffectiveIconTileWidthPx(state.iconSettings)}px`)
  content.style.setProperty('--icon-shell-size', `${state.iconSettings.iconShellSize}px`)
  content.style.setProperty('--icon-fixed-grid-width', `${getFixedIconGridWidthPx(gridSettings)}px`)
  content.style.setProperty('--icon-columns', String(gridSettings.columns))
  content.style.setProperty('--icon-title-lines', String(state.iconSettings.titleLines))
  content.dataset.iconLayoutMode = state.iconSettings.layoutMode
  content.dataset.iconShowTitles = String(state.iconSettings.showTitles)
  content.dataset.iconVerticalCenter = String(state.iconSettings.verticalCenter)
  if (page instanceof HTMLElement) {
    page.dataset.iconVerticalCenter = String(state.iconSettings.verticalCenter)
  }
  scheduleAdaptiveNewTabLayoutUpdate()
}

function withDetectedIconPreset(settings: IconSettings): IconSettings {
  const { preset: _preset, ...presetValues } = settings
  return {
    ...settings,
    preset: detectPresetFromValues(presetValues)
  }
}

function applyIconPreset(presetKey: IconLayoutPresetKey): void {
  const preset = ICON_LAYOUT_PRESETS[presetKey]
  state.iconSettings = normalizeIconSettings({
    ...preset,
    verticalCenter: state.iconSettings.verticalCenter,
    preset: presetKey
  })
  void saveIconSettings().catch((error) => {
    console.warn('新标签页图标预设保存失败。', error)
  })
  render()
  syncIconSettingsControls()
  updateAllSettingRangeVisuals()
  updateClockText()
}

function resetIconSettingsToDefaults(): void {
  state.iconSettings = normalizeIconSettings(DEFAULT_ICON_SETTINGS)
  void saveIconSettings().catch((error) => {
    console.warn('新标签页图标默认布局保存失败。', error)
  })
  render()
  syncIconSettingsControls()
  updateAllSettingRangeVisuals()
  updateClockText()
}

function toggleIconAdvanced(): void {
  const toggle = document.getElementById('icon-advanced-toggle')
  const panel = document.getElementById('icon-advanced-panel')
  if (!toggle || !panel) return

  const expanded = toggle.getAttribute('aria-expanded') === 'true'
  toggle.setAttribute('aria-expanded', String(!expanded))
  toggle.classList.toggle('expanded', !expanded)
  setRevealPanelExpanded(panel, !expanded)
}

function setRevealPanelExpanded(panel: HTMLElement, expanded: boolean): void {
  panel.hidden = false
  panel.classList.toggle('is-expanded', expanded)
  panel.classList.toggle('is-collapsed', !expanded)
  panel.setAttribute('aria-hidden', String(!expanded))
  if (expanded) {
    panel.removeAttribute('inert')
  } else {
    panel.setAttribute('inert', '')
  }
}

function handlePresetCardClick(event: Event): void {
  const target = event.target
  const card = target instanceof HTMLElement ? target.closest<HTMLElement>('.icon-preset-card') : null
  if (!card) return

  const presetKey = card.dataset.preset as IconLayoutPresetKey | undefined
  if (presetKey && presetKey in ICON_LAYOUT_PRESETS) {
    applyIconPreset(presetKey)
  }
}

function syncPresetCardSelection(): void {
  const cards = document.querySelectorAll<HTMLElement>('.icon-preset-card')
  for (const card of cards) {
    const selected = card.dataset.preset === state.iconSettings.preset
    card.classList.toggle('selected', selected)
    card.setAttribute('aria-pressed', String(selected))
  }
}

function syncIconAdvancedPanel(): void {
  const tileWidthInput = document.getElementById('icon-tile-width')
  if (tileWidthInput instanceof HTMLInputElement) {
    tileWidthInput.title = state.iconSettings.showTitles
      ? ''
      : '显示标题时生效'
  }

  const columnsInput = document.getElementById('icon-columns')
  if (columnsInput instanceof HTMLInputElement) {
    columnsInput.title = state.iconSettings.layoutMode === 'fixed'
      ? ''
      : '固定列数模式下生效'
  }
}

function setTextContent(elementId: string, text: string): void {
  const element = document.getElementById(elementId)
  if (element) {
    element.textContent = text
  }
}

async function saveSettingsWithFeedback(values: Record<string, unknown>): Promise<void> {
  setSettingsSaveStatus('saving', '保存中...')
  try {
    await setLocalStorage(values)
    setSettingsSaveStatus('saved', '已保存')
  } catch (error) {
    setSettingsSaveStatus('error', '保存失败，本次调整仅临时生效；刷新后会恢复到上次已保存状态')
    throw error
  }
}

function setSettingsSaveStatus(nextState: SettingsSaveState, message: string): void {
  window.clearTimeout(settingsSaveStatusTimer)
  state.settingsSaveState = nextState
  state.settingsSaveMessage = message
  syncSettingsSaveStatus()

  if (nextState === 'saved') {
    settingsSaveStatusTimer = window.setTimeout(() => {
      state.settingsSaveState = 'idle'
      state.settingsSaveMessage = ''
      syncSettingsSaveStatus()
    }, 1800)
  }
}

function syncSettingsSaveStatus(): void {
  const status = document.getElementById('settings-save-status')
  if (!(status instanceof HTMLElement)) {
    return
  }

  status.dataset.state = state.settingsSaveState
  status.hidden = state.settingsSaveState === 'idle'
  status.textContent = state.settingsSaveMessage
}

function syncIconSegmentButtons(selector: string, selectedValue: string, disabled = false): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>(selector)) {
    const value = button.dataset.iconLayoutMode || button.dataset.iconTitleLines || ''
    const selected = value === selectedValue
    button.classList.toggle('selected', selected)
    button.setAttribute('aria-pressed', String(selected))
    button.disabled = disabled
    button.setAttribute('aria-disabled', String(disabled))
  }
}

function renderIconPreview(): void {
  const preview = document.getElementById('icon-live-preview')
  if (!preview) {
    return
  }

  const settings = state.iconSettings
  const previewColumnGap = Math.max(4, Math.round(getIconGapPx(settings.columnGap) * 0.34))
  const previewRowGap = Math.max(4, Math.round(getIconRowGapPx(settings.rowGap) * 0.34))
  const effectiveTileWidth = getEffectiveIconTileWidthPx(settings)
  const previewTileWidth = Math.max(48, Math.round(effectiveTileWidth * 0.42))
  const previewShellSize = Math.max(18, Math.round(settings.iconShellSize * 0.62))
  const previewColumns = settings.layoutMode === 'fixed'
    ? Math.max(2, Math.min(6, settings.columns))
    : Math.max(2, Math.min(4, Math.round(settings.pageWidth / 24)))
  const previewGridMaxWidth = previewColumns * previewTileWidth + (previewColumns - 1) * previewColumnGap
  const sampleCount = Math.max(4, Math.min(8, previewColumns * 2))
  const summary = [
    settings.layoutMode === 'fixed' ? `${settings.columns} 列固定` : '自动适配',
    `${settings.tileWidth}px 卡片`,
    `${settings.iconShellSize}px 图标区`,
    settings.showTitles ? `${settings.titleLines} 行标题` : '图标模式'
  ].join(' · ')

  preview.dataset.iconLayoutMode = settings.layoutMode
  preview.dataset.iconShowTitles = String(settings.showTitles)
  preview.style.setProperty('--preview-page-width', `${settings.pageWidth}%`)
  preview.style.setProperty('--preview-column-gap', `${previewColumnGap}px`)
  preview.style.setProperty('--preview-row-gap', `${previewRowGap}px`)
  preview.style.setProperty('--preview-tile-width', `${previewTileWidth}px`)
  preview.style.setProperty('--preview-shell-size', `${previewShellSize}px`)
  preview.style.setProperty('--preview-title-lines', String(settings.titleLines))
  preview.style.setProperty('--preview-grid-max-width', `${previewGridMaxWidth}px`)
  setTextContent('icon-live-preview-summary', summary)

  const grid = document.createElement('div')
  grid.className = 'icon-live-preview-grid'
  grid.style.gridTemplateColumns = `repeat(${previewColumns}, minmax(0, 1fr))`

  const names = ['阅读', '工作台', '邮箱', '文档', '设计', '数据', '日程', '收藏']
  for (let index = 0; index < sampleCount; index++) {
    const tile = document.createElement('span')
    tile.className = 'icon-live-preview-tile'

    const shell = document.createElement('span')
    shell.className = 'icon-live-preview-shell'
    const mark = document.createElement('span')
    mark.className = 'icon-live-preview-mark'
    mark.textContent = names[index]?.slice(0, 1) || '*'
    shell.appendChild(mark)

    const title = document.createElement('span')
    title.className = 'icon-live-preview-title'
    title.textContent = names[index]

    tile.append(shell, title)
    grid.appendChild(tile)
  }

  preview.replaceChildren(grid)
}

function renderIconPresetCards(): void {
  const row = document.getElementById('icon-preset-row')
  if (!row) return

  row.replaceChildren()
  for (const [key, meta] of Object.entries(ICON_PRESET_META)) {
    const card = document.createElement('button')
    card.className = 'icon-preset-card'
    card.type = 'button'
    card.dataset.preset = key
    card.setAttribute('aria-pressed', 'false')
    card.setAttribute('aria-label', `${meta.name}布局，${meta.desc}，${meta.detail}`)

    const preview = document.createElement('div')
    preview.className = 'icon-preset-preview'
    preview.style.gridTemplateColumns = `repeat(${meta.cols}, 1fr)`
    preview.style.gap = key === 'compact' ? '3px' : key === 'spacious' ? '5px' : '4px'
    preview.style.padding = '0 4px'

    for (let i = 0; i < meta.cols * meta.rows; i++) {
      const cell = document.createElement('span')
      cell.className = 'icon-preset-preview-cell'
      cell.style.height = key === 'compact' ? '8px' : key === 'spacious' ? '12px' : '10px'
      preview.appendChild(cell)
    }

    const name = document.createElement('span')
    name.className = 'icon-preset-name'
    name.textContent = meta.name

    const desc = document.createElement('span')
    desc.className = 'icon-preset-desc'
    desc.textContent = meta.desc

    const detail = document.createElement('span')
    detail.className = 'icon-preset-detail'
    detail.textContent = meta.detail

    card.append(preview, name, desc, detail)
    row.appendChild(card)
  }
}

function submitSearch(value: string, openAllEnabled = false): void {
  const query = String(value || '').trim()
  if (!query) {
    return
  }

  const directUrl = getDirectNavigationUrl(query)
  if (directUrl) {
    openSearchTarget(directUrl)
    return
  }

  const targets = planSearchOpenTargets(
    query,
    state.searchSettings.engine,
    state.searchSettings.enabledEngines,
    openAllEnabled,
    SEARCH_MULTI_OPEN_LIMIT
  )
  openSearchTargets(targets.map((target) => target.url))
}

function getDirectNavigationUrl(value: string): string {
  const rawUrl = String(value || '').trim()
  if (!rawUrl || /\s/.test(rawUrl)) {
    return ''
  }

  const hasScheme = /^[a-z][a-z\d+\-.]*:\/\//i.test(rawUrl)
  const looksLikeDomain =
    rawUrl.includes('.') ||
    /^localhost(?::\d+)?(?:\/|$)/i.test(rawUrl) ||
    /^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:\/|$)/.test(rawUrl)
  if (!hasScheme && !looksLikeDomain) {
    return ''
  }

  const candidate = hasScheme ? rawUrl : `https://${rawUrl}`
  try {
    const parsedUrl = new URL(candidate)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return ''
    }
    return parsedUrl.href
  } catch {
    return ''
  }
}

function getSearchUrl(query: string, engine: string): string {
  return buildSearchEngineUrl(query, normalizeSearchEngineId(engine))
}

function openSearchTarget(targetUrl: string): void {
  openSearchTargets([targetUrl])
}

function openSearchTargets(targetUrls: string[]): void {
  const urls = targetUrls.filter(Boolean)
  if (!urls.length) {
    return
  }

  if (urls.length > 1) {
    for (const url of urls.slice(0, SEARCH_MULTI_OPEN_LIMIT)) {
      const opened = window.open(url, '_blank', 'noopener')
      if (opened) {
        opened.opener = null
      }
    }
    return
  }

  const targetUrl = urls[0]
  if (state.searchSettings.openInNewTab) {
    const opened = window.open(targetUrl, '_blank', 'noopener')
    if (opened) {
      opened.opener = null
    }
    return
  }

  window.location.assign(targetUrl)
}

function readTimeSettingsFromControls(): NewTabTimeSettings {
  const enabledInput = document.getElementById('time-enabled')
  const secondsInput = document.getElementById('time-show-seconds')
  const hour12Input = document.getElementById('time-hour12')
  const sizeInput = document.getElementById('time-clock-size')
  const dateFormatInput = document.getElementById('time-date-format')
  const timeZoneInput = document.getElementById('time-time-zone')
  const displayInput = document.getElementById('time-display-mode')
  const densityInput = document.getElementById('time-density')

  return normalizeTimeSettings({
    enabled: enabledInput instanceof HTMLInputElement ? enabledInput.checked : state.timeSettings.enabled,
    showSeconds: secondsInput instanceof HTMLInputElement ? secondsInput.checked : state.timeSettings.showSeconds,
    hour12: hour12Input instanceof HTMLInputElement ? hour12Input.checked : state.timeSettings.hour12,
    clockSize: sizeInput instanceof HTMLInputElement ? Number(sizeInput.value) : state.timeSettings.clockSize,
    dateFormat: dateFormatInput instanceof HTMLSelectElement ? dateFormatInput.value : state.timeSettings.dateFormat,
    timeZone: timeZoneInput instanceof HTMLSelectElement ? timeZoneInput.value : state.timeSettings.timeZone,
    displayMode: displayInput instanceof HTMLSelectElement ? displayInput.value : state.timeSettings.displayMode,
    density: densityInput instanceof HTMLSelectElement ? densityInput.value : state.timeSettings.density
  })
}

function syncTimeSettingsControls(): void {
  const settings = state.timeSettings
  const enabledInput = document.getElementById('time-enabled')
  const secondsInput = document.getElementById('time-show-seconds')
  const hour12Input = document.getElementById('time-hour12')
  const sizeInput = document.getElementById('time-clock-size')
  const dateFormatInput = document.getElementById('time-date-format')
  const timeZoneInput = document.getElementById('time-time-zone')
  const displayInput = document.getElementById('time-display-mode')
  const densityInput = document.getElementById('time-density')
  const dependentControls = [
    secondsInput,
    hour12Input,
    sizeInput,
    dateFormatInput,
    timeZoneInput,
    displayInput,
    densityInput
  ]

  if (enabledInput instanceof HTMLInputElement) {
    enabledInput.checked = settings.enabled
  }
  if (secondsInput instanceof HTMLInputElement) {
    secondsInput.checked = settings.showSeconds
    secondsInput.disabled = !settings.enabled || settings.displayMode === 'date'
  }
  if (hour12Input instanceof HTMLInputElement) {
    hour12Input.checked = settings.hour12
    hour12Input.disabled = !settings.enabled || settings.displayMode === 'date'
  }
  if (sizeInput instanceof HTMLInputElement) {
    sizeInput.value = String(settings.clockSize)
    sizeInput.disabled = !settings.enabled
  }
  if (dateFormatInput instanceof HTMLSelectElement) {
    dateFormatInput.value = settings.dateFormat
    dateFormatInput.disabled = !settings.enabled || settings.displayMode === 'time'
  }
  if (timeZoneInput instanceof HTMLSelectElement) {
    timeZoneInput.value = settings.timeZone
    timeZoneInput.disabled = !settings.enabled
  }
  if (displayInput instanceof HTMLSelectElement) {
    displayInput.value = settings.displayMode
    displayInput.disabled = !settings.enabled
  }
  if (densityInput instanceof HTMLSelectElement) {
    densityInput.value = settings.density
    densityInput.disabled = !settings.enabled
  }

  setTextContent('time-clock-size-value', `${settings.clockSize}%`)

  for (const control of dependentControls) {
    const disabled = control instanceof HTMLInputElement || control instanceof HTMLSelectElement
      ? control.disabled
      : !settings.enabled
    const row = control instanceof HTMLElement
      ? control.closest<HTMLElement>('.setting-row')
      : null
    row?.classList.toggle('setting-row-disabled', disabled)
  }
}

async function saveTimeSettings(): Promise<void> {
  await saveSettingsWithFeedback({
    [STORAGE_KEYS.newTabTimeSettings]: state.timeSettings
  })
}

function scheduleTimeSettingsSave(): void {
  window.clearTimeout(timeSettingsSaveTimer)
  timeSettingsSaveTimer = window.setTimeout(() => {
    timeSettingsSaveTimer = 0
    void saveTimeSettings().catch((error) => {
      console.warn('新标签页时间设置保存失败。', error)
    })
  }, SETTINGS_SAVE_DEBOUNCE_MS)
}

function scheduleClockTick(): void {
  window.clearTimeout(clockTimer)
  const delay = getClockUpdateDelay(new Date(), state.timeSettings)
  if (delay <= 0) {
    clockTimer = 0
    return
  }

  clockTimer = window.setTimeout(() => {
    clockTimer = 0
    updateClockText()
    scheduleClockTick()
  }, delay)
}

function updateClockText(): void {
  const clockNode = document.querySelector('.newtab-clock')
  const timeNode = document.querySelector('[data-clock-time]')
  const dateNode = document.querySelector('[data-clock-date]')
  const periodNode = document.querySelector('[data-clock-period]')
  if (!timeNode && !dateNode && !periodNode) {
    return
  }

  const now = new Date()
  const settings = state.timeSettings
  if (clockNode instanceof HTMLElement) {
    clockNode.setAttribute('aria-label', getClockAriaLabel(now, settings))
  }
  if (timeNode instanceof HTMLTimeElement) {
    timeNode.textContent = formatClockTime(now, settings)
    timeNode.dateTime = formatClockTimeDateTime(now, settings)
  }
  if (periodNode) {
    periodNode.textContent = formatClockPeriod(now, settings)
  }
  if (dateNode instanceof HTMLTimeElement) {
    dateNode.textContent = formatClockDate(now, settings)
    dateNode.dateTime = formatClockDateTime(now, settings)
  }
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallback
  }
  return Math.max(min, Math.min(max, Math.round(numericValue)))
}

function formatBytes(bytes: number): string {
  const size = Math.max(0, Number(bytes) || 0)
  if (size < 1024) {
    return `${Math.round(size)} B`
  }
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function normalizeHexColor(value: unknown, fallback: string): string {
  const color = String(value || '').trim()
  if (/^#[\da-f]{6}$/i.test(color)) {
    return color.toLowerCase()
  }
  if (/^#[\da-f]{3}$/i.test(color)) {
    return `#${color.slice(1).split('').map((char) => `${char}${char}`).join('')}`.toLowerCase()
  }
  return fallback
}

function getReadableTextColor(hexColor: string): string {
  const color = normalizeHexColor(hexColor, DEFAULT_BACKGROUND_SETTINGS.color).slice(1)
  const red = parseInt(color.slice(0, 2), 16)
  const green = parseInt(color.slice(2, 4), 16)
  const blue = parseInt(color.slice(4, 6), 16)
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000
  return luminance > 150 ? '#111111' : '#ffffff'
}

function pickCustomIconImage(): Promise<string | null> {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.hidden = true

  return new Promise((resolve, reject) => {
    let settled = false

    const cleanup = () => {
      input.remove()
      window.removeEventListener('focus', handleWindowFocus)
    }

    const settle = (value: string | null) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      resolve(value)
    }

    const fail = (error: Error) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      reject(error)
    }

    const handleWindowFocus = () => {
      window.setTimeout(() => {
        if (!input.files?.length) {
          settle(null)
        }
      }, 300)
    }

    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) {
        settle(null)
        return
      }

      if (!file.type.startsWith('image/')) {
        fail(new Error('请选择图片文件。'))
        return
      }

      if (file.size > CUSTOM_ICON_MAX_BYTES) {
        fail(new Error('自定义图片不能超过 2MB。'))
        return
      }

      readFileAsDataUrl(file).then(settle, fail)
    })

    window.addEventListener('focus', handleWindowFocus)
    document.body.appendChild(input)
    input.click()
  })
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      const result = String(reader.result || '')
      if (!result.startsWith('data:image/')) {
        reject(new Error('图片读取失败，请换一张图片重试。'))
        return
      }
      resolve(result)
    })
    reader.addEventListener('error', () => {
      reject(new Error('图片读取失败，请换一张图片重试。'))
    })
    reader.readAsDataURL(file)
  })
}

function getFaviconUrl(url: string, bookmarkId = ''): string {
  const refreshToken = bookmarkId ? state.faviconRefreshTokens.get(bookmarkId) : 0
  return buildChromeFaviconUrl(
    chrome.runtime.getURL('/_favicon/'),
    url,
    {
      size: FAVICON_SIZE,
      cacheToken: refreshToken
    }
  )
}

function getFallbackLabel(title: string): string {
  const trimmed = title.trim()
  return (trimmed[0] || '*').toUpperCase()
}
