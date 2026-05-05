import {
  BOOKMARKS_BAR_ID,
  ROOT_ID,
  STORAGE_KEYS,
  RECYCLE_BIN_LIMIT
} from '../shared/constants.js'
import type { NavigationAttempt } from '../shared/types.js'
import {
  getLocalStorage,
  removeLocalStorage,
  setLocalStorage
} from '../shared/storage.js'
import {
  getBookmarkTree,
  moveBookmark,
  updateBookmark,
  removeBookmark,
  createBookmark
} from '../shared/bookmarks-api.js'
import {
  extractBookmarkData
} from '../shared/bookmark-tree.js'
import {
  normalizeText,
  stripCommonUrlPrefix,
  normalizeUrl,
  displayUrl,
  extractDomain,
  buildDuplicateKey
} from '../shared/text.js'
import {
  buildBookmarkTagExport,
  clearBookmarkTagIndex,
  loadBookmarkTagIndex,
  mergeBookmarkTagImport,
  normalizeBookmarkTags,
  normalizeBookmarkTagIndex,
  saveBookmarkTagIndex,
  upsertBookmarkTagFromAnalysis,
  type BookmarkTagIndex
} from '../shared/bookmark-tags.js'
import {
  normalizeInboxSettings,
  saveInboxSettings
} from '../shared/inbox.js'
import {
  buildBackupRestorePreview,
  createAutoBackupBeforeDangerousOperation,
  createCuratorBackupFile,
  getBackupFileName,
  parseCuratorBackupFile,
  restoreCuratorBackup,
  type BackupRestoreMode
} from '../shared/backup.js'
import { cancelNavigationCheck, requestNavigationCheck } from '../shared/messages.js'
import { renderDotMatrixLoader } from '../shared/dot-matrix-loader.js'
import {
  extractAiErrorMessage,
  extractChatCompletionsJsonText,
  extractResponsesJsonText,
  getAiEndpoint
} from '../shared/ai-response.js'
import {
  normalizeAiNamingSettings,
  normalizeAiNamingCustomModels,
  normalizeAiNamingFetchedModels,
  serializeAiNamingSettings
} from './sections/ai-settings.js'
import {
  buildAvailabilityProfileFromUserSettings,
  createAvailabilityRunScheduler,
  formatAvailabilityRunnerStatus,
  getDefaultAvailabilityRunnerUserSettings,
  normalizeAvailabilityRunnerUserSettings,
  runAvailabilityQueue,
  type AvailabilityRunOutcome,
  type AvailabilityRunScheduler
} from './sections/availability-runner.js'
import {
  FETCH_TIMEOUT_MS,
  buildNavigationSuccess,
  buildFailureClassification,
  shouldRetryNavigation,
  shouldAcceptNavigationSuccess,
  summarizeNavigationEvidence,
  shouldClassifyAsHighConfidence,
  shouldFallbackToGet,
  classifyProbeResponse,
  classifyProbeError,
  isRedirectedNavigation,
  normalizeNavigationUrl
} from './sections/classifier.js'
import {
  buildFallbackPageContentFromUrl,
  buildJinaReaderUrl,
  buildPageContextForAi,
  buildRemotePageContentFromText,
  combinePageContentContexts,
  decideDirectPageFetch,
  extractPageContentFromHtml,
  appendPageContentWarnings,
  getDirectPageFetchFailureWarning,
  getDirectPageFetchOriginPattern,
  normalizePageContentContext
} from './sections/content-extraction.js'
import {
  buildContentSnapshotSearchMap,
  buildContentSnapshotSearchText,
  buildContentSnapshotSearchMapWithFullText,
  normalizeContentSnapshotIndex,
  normalizeContentSnapshotSettings,
  saveContentSnapshotFromContext,
  saveContentSnapshotSettings
} from '../shared/content-snapshots.js'
import { parseSearchQuery } from '../shared/search-query.js'
import {
  SECTION_META,
  NAVIGATION_TIMEOUT_MS,
  NAVIGATION_RETRY_TIMEOUT_MS,
  AI_NAMING_DEFAULT_BASE_URL,
  AI_NAMING_DEFAULT_MODEL,
  AI_NAMING_DEFAULT_TIMEOUT_MS,
  AI_NAMING_DEFAULT_BATCH_SIZE,
  AI_NAMING_MAX_TEXT_LENGTH,
  AI_NAMING_JINA_READER_ORIGIN,
  AI_NAMING_MODELS_ENDPOINT_SUFFIX,
  AI_NAMING_PRESET_MODELS,
  AI_NAMING_RESPONSE_SCHEMA
} from './shared-options/constants.js'
import {
  availabilityState,
  managerState,
  folderCleanupState,
  aiNamingState,
  aiNamingManagerState,
  dashboardState,
  contentSnapshotState,
  backupRestoreState,
  createEmptyIgnoreRules,
  createEmptyRedirectCache
} from './shared-options/state.js'
import { dom, cacheDom } from './shared-options/dom.js'
import { escapeHtml, escapeAttr } from './shared-options/html.js'
import {
  isInteractionLocked,
  compareByPathTitle,
  syncSelectionSet,
  formatDateTime,
  setModalHidden
} from './shared-options/utils.js'
import {
  collectRequestOrigins,
  containsPermissions,
  getOriginPermissionPattern,
  isCheckableUrl,
  requestPermissions
} from './shared-options/permissions.js'
import { truncateText } from './shared-options/text.js'
import {
  normalizeIgnoreRules,
  serializeIgnoreRules,
  saveIgnoreRules,
  matchesIgnoreRules,
  renderIgnoreSection,
  handleIgnoreRulesClick,
  clearIgnoreRules
} from './sections/ignore.js'
import {
  normalizeRecycleBin,
  renderRecycleSection,
  handleRecycleResultsClick,
  clearRecycleSelection,
  selectAllRecycleEntries,
  restoreSelectedRecycleEntries,
  clearSelectedRecycleEntries,
  clearRecycleBin,
  deleteBookmarksToRecycle
} from './sections/recycle.js'
import {
  buildDuplicateGroups,
  renderDuplicateSection,
  handleDuplicateGroupsClick,
  handleDuplicateToolbarClick,
  clearDuplicateSelection,
  deleteSelectedDuplicates
} from './sections/duplicates.js'
import {
  hydrateFolderCleanupState,
  analyzeFolderCleanupSuggestions,
  rescanFolderCleanupSuggestions,
  renderFolderCleanupSection,
  handleFolderCleanupClick,
  handleFolderCleanupPreviewClick
} from './sections/folder-cleanup.js'
import {
  normalizeRedirectCache,
  saveRedirectCache,
  synchronizeRedirectResults,
  getRedirectSectionState,
  persistRedirectCacheSnapshot,
  removeRedirectIdsFromState,
  renderRedirectSection,
  handleRedirectResultsClick,
  clearRedirectSelection,
  selectAllRedirects,
  updateSelectedRedirects,
  deleteSelectedRedirects,
  deleteAllRedirects
} from './sections/redirects.js'
import {
  hydrateDetectionHistory,
  getHistoryRunsForScope,
  getHistoricalAbnormalStreak,
  syncHistoryComparisonScope,
  finalizeDetectionHistory,
  renderAvailabilityHistory,
  clearDetectionHistoryLogs,
  toggleHistoryLogsCollapsed,
  syncHistoryEntryStatus,
  upsertAvailabilityHistoryEntry
} from './sections/history.js'
import {
  buildPendingAvailabilitySnapshot,
  normalizePendingAvailabilitySnapshot,
  reconcilePendingAvailabilitySnapshot,
  savePendingAvailabilitySnapshot
} from './sections/pending-availability.js'
import {
  hydrateBookmarkAddHistory,
  renderBookmarkAddHistory,
  clearBookmarkAddHistory
} from './sections/bookmark-add-history.js'
import {
  cancelDashboardDrag,
  closeDashboardTagEditor,
  closeDashboardTagPopover,
  getSelectedDashboardBookmarks,
  handleDashboardClick,
  handleDashboardDocumentClick,
  handleDashboardDocumentFocusIn,
  handleDashboardInput,
  handleDashboardKeydown,
  handleDashboardPointerCancel,
  handleDashboardPointerDown,
  handleDashboardPointerMove,
  handleDashboardPointerUp,
  handleDashboardTagPointerOut,
  handleDashboardTagPointerOver,
  isDashboardViewReady,
  prepareDashboardSectionEntry,
  getSingleDashboardMoveBookmark,
  moveSingleDashboardBookmark,
  moveSelectedDashboardBookmarks,
  removeDashboardSelectionIds,
  renderDashboardSection
} from './sections/dashboard.js'

const IS_OPTIONS_DASHBOARD_EMBED_MODE =
  new URLSearchParams(window.location.search).get('embed') === 'newtab-dashboard'

applyOptionsDashboardEmbedClasses()

let newTabDashboardReadyPosted = false
let activeSectionKey = ''
let availabilityRenderFrame = 0
let availabilityDurationTimer = 0
let aiNamingDurationTimer = 0
let availabilityPauseResolvers: Array<() => void> = []
const AVAILABILITY_FILTERS = new Set([
  'all',
  'failed',
  'review',
  'redirected',
  'new',
  'persistent',
  'recovered',
  'ignored'
])
const COLLAPSIBLE_NAV_GROUP_SECTIONS: Record<string, Set<string>> = {
  'availability-tools': new Set(['availability', 'history', 'redirects', 'ignore'])
}
let confirmModalResolve: ((confirmed: boolean) => void) | null = null
let activeManagedModalKey = ''
let modalReturnFocusElement = null

const MODAL_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

const LEGACY_AI_NAMING_CACHE_STORAGE_KEYS = [
  'curatorBookmarkAiMetadataCache',
  'curatorBookmarkAiResultCache'
]

const SHORTCUTS_SETTINGS_URL = 'chrome://extensions/shortcuts'
const NEW_TAB_SHORTCUT_FOLDER_TITLE = '标签页'
const RESULTS_PAGE_SIZE = 25
const SHORTCUT_COMMAND_ORDER = [
  'curator-capture-inbox',
  'curator-open-search',
  'curator-open-smart-classifier',
  'curator-toggle-auto-analyze'
]
const SHORTCUT_COMMAND_LABELS: Record<string, { title: string; detail: string }> = {
  'curator-capture-inbox': {
    title: '直接收藏到 Inbox',
    detail: '保存当前网页到 Inbox / 待整理，并在后台分析归类。'
  },
  'curator-open-search': {
    title: '打开并聚焦搜索',
    detail: '打开弹窗后直接聚焦搜索框。'
  },
  'curator-open-smart-classifier': {
    title: '直接智能分类当前页',
    detail: '打开弹窗后立即分析当前页面并给出保存建议。'
  },
  'curator-toggle-auto-analyze': {
    title: '切换自动分析',
    detail: '通过快捷键开启或关闭新增书签自动分析。'
  }
}
const CONTENT_SNAPSHOT_FULL_TEXT_RETRY_LIMIT = 2
const CONTENT_SNAPSHOT_FULL_TEXT_RETRY_DELAY_MS = 1200

const recycleCallbacks = {
  renderAvailabilitySection,
  hydrateAvailabilityCatalog,
  getBookmarkRecord,
  removeDeletedResultsFromState,
  saveRedirectCache,
  confirm: requestConfirmation
}

const duplicatesCallbacks = {
  renderAvailabilitySection,
  confirm: requestConfirmation,
  recycleCallbacks
}

const redirectsCallbacks = {
  renderAvailabilitySection,
  getCurrentAvailabilityScopeMeta,
  hydrateAvailabilityCatalog,
  confirm: requestConfirmation,
  recycleCallbacks
}

const historyCallbacks = {
  renderAvailabilitySection,
  getCurrentAvailabilityScopeMeta,
  confirm: requestConfirmation
}

const dashboardCallbacks = {
  renderAvailabilitySection,
  hydrateAvailabilityCatalog,
  regenerateAiTags: regenerateDashboardAiTagsForBookmark,
  openMoveModal,
  closeMoveModal,
  exitDashboard,
  confirm: requestConfirmation,
  recycleCallbacks
}

const folderCleanupCallbacks = {
  renderAvailabilitySection,
  hydrateAvailabilityCatalog,
  confirm: requestConfirmation
}

document.addEventListener('DOMContentLoaded', async () => {
  applyOptionsDashboardEmbedClasses()
  cacheDom()
  bindEvents()

  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual'
  }

  const initialSectionKey = normalizeSectionKey(getCurrentSectionKey())
  if (initialSectionKey !== getCurrentSectionKey()) {
    window.history.replaceState(null, '', `#${initialSectionKey}`)
  }

  syncPageSection()
  resetOptionsScrollPosition()
  window.addEventListener('hashchange', () => {
    syncPageSection()
    resetOptionsScrollPosition()
  })
  window.addEventListener('popstate', () => {
    syncPageSection()
    resetOptionsScrollPosition()
  })
  window.addEventListener('curator:dashboard-view-ready', notifyNewTabDashboardReady)
  void hydrateShortcutCommands()

  await hydratePersistentState()
  await hydrateAvailabilityCatalog({ analyzeFolderCleanup: !IS_OPTIONS_DASHBOARD_EMBED_MODE })
  await hydrateProbePermission()
  await hydrateAiNamingPermissionState()
  renderAvailabilitySection()
})

async function hydratePersistentState() {
  availabilityState.storageLoading = true
  scheduleAvailabilityRender()

  try {
    const stored = await getLocalStorage([
      STORAGE_KEYS.ignoreRules,
      STORAGE_KEYS.detectionHistory,
      STORAGE_KEYS.bookmarkAddHistory,
      STORAGE_KEYS.redirectCache,
      STORAGE_KEYS.pendingAvailabilityResults,
      STORAGE_KEYS.availabilitySettings,
      STORAGE_KEYS.recycleBin,
      STORAGE_KEYS.aiProviderSettings,
      STORAGE_KEYS.bookmarkTagIndex,
      STORAGE_KEYS.folderCleanupState,
      STORAGE_KEYS.inboxSettings,
      STORAGE_KEYS.contentSnapshotSettings,
      STORAGE_KEYS.contentSnapshotIndex
    ])

    managerState.ignoreRules = normalizeIgnoreRules(stored[STORAGE_KEYS.ignoreRules])
    hydrateDetectionHistory(stored[STORAGE_KEYS.detectionHistory], historyCallbacks)
    hydrateBookmarkAddHistory(stored[STORAGE_KEYS.bookmarkAddHistory])
    managerState.redirectCache = normalizeRedirectCache(stored[STORAGE_KEYS.redirectCache])
    managerState.pendingAvailabilitySnapshot = normalizePendingAvailabilitySnapshot(stored[STORAGE_KEYS.pendingAvailabilityResults])
    availabilityState.settings = normalizeAvailabilityRunnerUserSettings(stored[STORAGE_KEYS.availabilitySettings])
    managerState.recycleBin = normalizeRecycleBin(stored[STORAGE_KEYS.recycleBin])
    aiNamingManagerState.settings = normalizeAiNamingSettings(stored[STORAGE_KEYS.aiProviderSettings])
    aiNamingState.tagIndex = normalizeBookmarkTagIndex(stored[STORAGE_KEYS.bookmarkTagIndex])
    contentSnapshotState.settings = normalizeContentSnapshotSettings(stored[STORAGE_KEYS.contentSnapshotSettings])
    contentSnapshotState.index = normalizeContentSnapshotIndex(stored[STORAGE_KEYS.contentSnapshotIndex])
    contentSnapshotState.searchTextMap = buildContentSnapshotSearchMap(contentSnapshotState.index, {
      includeFullText: false
    })
    contentSnapshotState.searchTextMapIncludesFullText = false
    contentSnapshotState.searchTextMapLoadingFullText = false
    resetContentSnapshotFullTextSearchMapRetry()
    hydrateFolderCleanupState(stored[STORAGE_KEYS.folderCleanupState])
    managerState.inboxSettings = normalizeInboxSettings(stored[STORAGE_KEYS.inboxSettings])
    void removeLocalStorage(LEGACY_AI_NAMING_CACHE_STORAGE_KEYS).catch(() => {})
  } catch (error) {
    availabilityState.lastError =
      error instanceof Error ? error.message : '本地规则读取失败，请刷新页面后重试。'
  } finally {
    availabilityState.storageLoading = false
    renderAvailabilitySection()
  }
}

function scheduleContentSnapshotFullTextSearchMapHydration(): void {
  if (
    !contentSnapshotState.settings.fullTextSearchEnabled ||
    contentSnapshotState.searchTextMapIncludesFullText ||
    contentSnapshotState.searchTextMapLoadingFullText
  ) {
    return
  }

  const hydrate = () => {
    void hydrateContentSnapshotFullTextSearchMap()
  }

  const requestIdleCallback = (window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
  }).requestIdleCallback?.bind(window)

  if (requestIdleCallback) {
    requestIdleCallback(hydrate, { timeout: 3000 })
    return
  }

  window.setTimeout(hydrate, 0)
}

function scheduleContentSnapshotFullTextSearchMapRetry(): void {
  if (
    contentSnapshotState.searchTextMapFullTextRetryCount >= CONTENT_SNAPSHOT_FULL_TEXT_RETRY_LIMIT ||
    contentSnapshotState.searchTextMapFullTextRetryTimer
  ) {
    return
  }

  contentSnapshotState.searchTextMapFullTextRetryCount += 1
  contentSnapshotState.searchTextMapFullTextRetryTimer = window.setTimeout(() => {
    contentSnapshotState.searchTextMapFullTextRetryTimer = 0
    void hydrateContentSnapshotFullTextSearchMap()
  }, CONTENT_SNAPSHOT_FULL_TEXT_RETRY_DELAY_MS)
}

function resetContentSnapshotFullTextSearchMapRetry(): void {
  if (contentSnapshotState.searchTextMapFullTextRetryTimer) {
    window.clearTimeout(contentSnapshotState.searchTextMapFullTextRetryTimer)
  }
  contentSnapshotState.searchTextMapFullTextRetryTimer = 0
  contentSnapshotState.searchTextMapFullTextRetryCount = 0
}

async function hydrateContentSnapshotFullTextSearchMap(): Promise<void> {
  if (
    !contentSnapshotState.settings.fullTextSearchEnabled ||
    contentSnapshotState.searchTextMapIncludesFullText ||
    contentSnapshotState.searchTextMapLoadingFullText
  ) {
    return
  }

  contentSnapshotState.searchTextMapLoadingFullText = true
  try {
    contentSnapshotState.searchTextMap = await buildContentSnapshotSearchMapWithFullText(contentSnapshotState.index, {
      includeFullText: true,
      maxRecords: 1000
    })
    contentSnapshotState.searchTextMapIncludesFullText = true
    resetContentSnapshotFullTextSearchMapRetry()
    renderDashboardSectionIfVisible()
  } catch {
    contentSnapshotState.searchTextMapIncludesFullText = false
    scheduleContentSnapshotFullTextSearchMapRetry()
  } finally {
    contentSnapshotState.searchTextMapLoadingFullText = false
  }
}

async function saveAiNamingSettings(settings = aiNamingManagerState.settings) {
  aiNamingManagerState.settings = normalizeAiNamingSettings(settings)
  await setLocalStorage({
    [STORAGE_KEYS.aiProviderSettings]: serializeAiNamingSettings(aiNamingManagerState.settings)
  })
}

function syncPageSection() {
  const rawKey = getCurrentSectionKey()
  const key = normalizeSectionKey(rawKey)
  const previousSectionKey = activeSectionKey
  const section = SECTION_META[key]
  const links = document.querySelectorAll('[data-section-link]')
  const panels = document.querySelectorAll<HTMLElement>('[data-section-panel]')

  if (rawKey !== key) {
    window.history.replaceState(null, '', `#${key}`)
  }

  if (previousSectionKey !== 'dashboard' && key === 'dashboard') {
    prepareDashboardSectionEntry()
  }
  activeSectionKey = key
  maybeHydrateContentSnapshotFullTextSearchMapForVisibleDashboard()

  document.body.classList.toggle('dashboard-fullscreen-active', key === 'dashboard')

  links.forEach((link) => {
    const linkKey = link.getAttribute('data-section-link')
    const isActive = linkKey === key
    link.classList.toggle('active', isActive)
    if (isActive) {
      link.setAttribute('aria-current', 'page')
    } else {
      link.removeAttribute('aria-current')
    }
  })

  syncCollapsibleNavGroups(key)

  panels.forEach((panel) => {
    panel.hidden = panel.getAttribute('data-section-panel') !== key
  })

  document.title = `${section.title} · Curator Bookmark`

  if (dom.availabilityAction) {
    renderAvailabilitySection()
  }

  if (key === 'general') {
    renderAiNamingSection()
  }

  scrollToSectionAnchor()
}

function applyOptionsDashboardEmbedClasses(): void {
  document.documentElement.classList.toggle(
    'options-dashboard-embed-root',
    IS_OPTIONS_DASHBOARD_EMBED_MODE
  )
  document.body?.classList.toggle('options-dashboard-embed', IS_OPTIONS_DASHBOARD_EMBED_MODE)
}

function exitDashboard(): void {
  if (IS_OPTIONS_DASHBOARD_EMBED_MODE) {
    window.parent.postMessage(
      { type: 'curator:newtab-dashboard-close' },
      window.location.origin
    )
    return
  }

  window.location.hash = '#general'
}

function notifyNewTabDashboardReady(): void {
  if (
    !IS_OPTIONS_DASHBOARD_EMBED_MODE ||
    newTabDashboardReadyPosted ||
    normalizeSectionKey(getCurrentSectionKey()) !== 'dashboard' ||
    availabilityState.catalogLoading ||
    !isDashboardViewReady()
  ) {
    return
  }

  newTabDashboardReadyPosted = true
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.parent.postMessage(
        { type: 'curator:newtab-dashboard-ready' },
        window.location.origin
      )
    })
  })
}

function syncCollapsibleNavGroups(activeSectionKey) {
  Object.entries(COLLAPSIBLE_NAV_GROUP_SECTIONS).forEach(([groupKey, sectionKeys]) => {
    const trigger = document.querySelector(
      `[data-nav-group-trigger="${CSS.escape(groupKey)}"]`
    ) as HTMLButtonElement | null
    const panel = document.querySelector(
      `[data-nav-group-panel="${CSS.escape(groupKey)}"]`
    ) as HTMLElement | null
    if (!trigger || !panel) {
      return
    }

    const isActive = sectionKeys.has(String(activeSectionKey))
    if (isActive) {
      setCollapsibleNavGroupExpanded(trigger, panel, true)
    } else {
      setCollapsibleNavGroupExpanded(trigger, panel, trigger.getAttribute('aria-expanded') !== 'false')
    }
    trigger.classList.toggle('active', isActive)
  })
}

function setCollapsibleNavGroupExpanded(trigger: HTMLButtonElement, panel: HTMLElement, expanded: boolean) {
  trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false')
  trigger.classList.toggle('collapsed', !expanded)
  panel.hidden = !expanded
}

function handleCollapsibleNavGroupClick(event) {
  if (!(event.target instanceof Element)) {
    return
  }

  const trigger = event.target.closest('[data-nav-group-trigger]') as HTMLButtonElement | null
  if (!trigger) {
    return
  }

  event.preventDefault()
  const groupKey = String(trigger.getAttribute('data-nav-group-trigger') || '').trim()
  const panel = document.querySelector(
    `[data-nav-group-panel="${CSS.escape(groupKey)}"]`
  ) as HTMLElement | null
  if (!panel) {
    return
  }

  setCollapsibleNavGroupExpanded(trigger, panel, trigger.getAttribute('aria-expanded') === 'false')
}

function handleSectionNavigationClick(event) {
  if (!(event.target instanceof Element)) {
    return
  }

  const link = event.target.closest('a[data-section-link]') as HTMLAnchorElement | null
  const key = link?.getAttribute('data-section-link') || ''
  if (!link || !(key in SECTION_META)) {
    return
  }

  const targetUrl = new URL(link.href, window.location.href)
  if (targetUrl.origin !== window.location.origin || targetUrl.pathname !== window.location.pathname) {
    return
  }

  const nextHash = targetUrl.hash || `#${key}`
  const nextSectionKey = normalizeSectionKey(nextHash.replace(/^#/, '').split(':')[0] || key)
  if (nextSectionKey !== key) {
    return
  }

  event.preventDefault()
  if (window.location.hash !== nextHash) {
    window.history.pushState(null, '', nextHash)
  }
  syncPageSection()
  resetOptionsScrollPosition()
}

function resetOptionsScrollPosition() {
  if (getCurrentSectionAnchor()) {
    return
  }

  const reset = () => {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }

  reset()
  window.requestAnimationFrame(() => {
    reset()
    window.requestAnimationFrame(reset)
  })
  window.setTimeout(reset, 0)
}

function scrollToSectionAnchor() {
  if (normalizeSectionKey(getCurrentSectionKey()) !== 'general') {
    return
  }

  if (getCurrentSectionAnchor() !== 'ai-provider') {
    return
  }

  const target = document.getElementById('ai-provider-settings')
  if (!target) {
    return
  }

  window.requestAnimationFrame(() => {
    target.scrollIntoView({ block: 'start', behavior: 'smooth' })
    target.classList.add('attention')
    window.setTimeout(() => target.classList.remove('attention'), 1400)
  })
}


function bindEvents() {
  const ignoreCallbacks = {
    confirm: requestConfirmation,
    onIgnoreRulesChanged() {
      repartitionAvailabilityResultsByIgnoreRules()
      renderAvailabilitySection()
    }
  }


  document.addEventListener('click', handleSectionNavigationClick)
  document.addEventListener('click', handleCollapsibleNavGroupClick)
  dom.availabilityScopeTrigger?.addEventListener('click', () => openScopeModal('availability'))
  dom.dashboardPanel?.addEventListener('click', (event) => {
    void handleDashboardClick(event, dashboardCallbacks)
  })
  dom.dashboardPanel?.addEventListener('input', handleDashboardInput)
  dom.dashboardPanel?.addEventListener('change', handleDashboardInput)
  dom.dashboardPanel?.addEventListener('keydown', handleDashboardKeydown)
  dom.dashboardPanel?.addEventListener('pointerdown', handleDashboardPointerDown)
  dom.dashboardPanel?.addEventListener('pointerover', handleDashboardTagPointerOver)
  dom.dashboardPanel?.addEventListener('pointerout', handleDashboardTagPointerOut)
  document.addEventListener('pointermove', handleDashboardPointerMove)
  document.addEventListener('pointerup', (event) => {
    void handleDashboardPointerUp(event, dashboardCallbacks)
  })
  document.addEventListener('pointercancel', handleDashboardPointerCancel)
  document.addEventListener('click', handleDashboardDocumentClick)
  document.addEventListener('click', handleAvailabilitySettingsDocumentClick)
  document.addEventListener('focusin', handleDashboardDocumentFocusIn)
  dom.historyScopeTrigger?.addEventListener('click', () => openScopeModal('history'))
  dom.aiScopeTrigger?.addEventListener('click', () => openScopeModal('ai'))
  dom.aiSaveSettings?.addEventListener('click', () => {
    void saveAiNamingSettingsFromDom()
  })
  dom.aiTestConnection?.addEventListener('click', handleAiConnectivityTest)
  dom.aiAction?.addEventListener('click', handleAiNamingAction)
  dom.aiPauseAction?.addEventListener('click', toggleAiNamingPause)
  dom.aiStopAction?.addEventListener('click', requestAiNamingStop)
  dom.aiSelectAll?.addEventListener('click', selectAllAiNamingResults)
  dom.aiSelectHighConfidence?.addEventListener('click', selectHighConfidenceAiResults)
  dom.aiClearSelection?.addEventListener('click', clearAiNamingSelection)
  dom.aiApplySelection?.addEventListener('click', applySelectedAiNamingResults)
  dom.aiMoveSelectionToSuggested?.addEventListener('click', handleMoveSelectedAiNamingResults)
  dom.aiResults?.addEventListener('click', handleAiResultsClick)
  dom.aiResults?.addEventListener('change', handleAiResultsChange)
  dom.aiResultsPagination?.addEventListener('click', (event) => {
    handleResultsPaginationClick(event, 'ai-results')
  })
  dom.aiFilterStatus?.addEventListener('change', handleAiResultsFilterChange)
  dom.aiFilterConfidence?.addEventListener('change', handleAiResultsFilterChange)
  dom.aiFilterQuery?.addEventListener('input', handleAiResultsFilterChange)
  dom.aiClearFilters?.addEventListener('click', clearAiResultsFilters)
  dom.aiTagExport?.addEventListener('click', handleBookmarkTagExport)
  dom.aiTagImport?.addEventListener('click', () => dom.aiTagImportInput?.click())
  dom.aiTagImportInput?.addEventListener('change', handleBookmarkTagImport)
  dom.aiTagClear?.addEventListener('click', handleBookmarkTagClear)
  dom.backupExport?.addEventListener('click', handleFullBackupExport)
  dom.backupImport?.addEventListener('click', () => dom.backupImportInput?.click())
  dom.backupImportInput?.addEventListener('change', handleFullBackupImport)
  dom.backupRestoreTags?.addEventListener('click', () => handleFullBackupRestore('tagsOnly'))
  dom.backupRestoreNewTab?.addEventListener('click', () => handleFullBackupRestore('newTabOnly'))
  dom.backupRestoreSafeFull?.addEventListener('click', () => handleFullBackupRestore('safeFull'))
  dom.aiBaseUrl?.addEventListener('input', () => syncAiNamingSettingsDraftFromDom({ markDirty: true }))
  dom.aiApiKey?.addEventListener('input', () => syncAiNamingSettingsDraftFromDom({ markDirty: true }))
  dom.aiRevealApiKey?.addEventListener('change', handleAiRevealApiKeyChange)
  dom.aiModelPickerTrigger?.addEventListener('click', openAiModelPickerModal)
  dom.aiFetchModels?.addEventListener('click', handleFetchAiModels)
  dom.aiManageModels?.addEventListener('click', openAiModelModal)
  dom.openShortcutsSettings?.addEventListener('click', openShortcutsSettingsPage)
  dom.copyShortcutsUrl?.addEventListener('click', () => {
    void copyShortcutsUrl()
  })
  dom.refreshShortcuts?.addEventListener('click', () => {
    void hydrateShortcutCommands()
  })
  dom.aiApiStyle?.addEventListener('change', () => syncAiNamingSettingsDraftFromDom({ markDirty: true }))
  dom.aiTimeoutMs?.addEventListener('input', () => syncAiNamingSettingsDraftFromDom({ markDirty: true }))
  dom.aiBatchSize?.addEventListener('input', () => syncAiNamingSettingsDraftFromDom({ markDirty: true }))
  dom.aiAllowRemoteParser?.addEventListener('change', handleAiRemoteParserChange)
  dom.aiAutoAnalyzeBookmarks?.addEventListener('change', handleAutoAnalyzeBookmarksChange)
  dom.inboxAutoMoveToRecommendedFolder?.addEventListener('change', () => {
    void handleInboxWorkflowSettingChange('autoMoveToRecommendedFolder')
  })
  dom.inboxTagOnlyNoAutoMove?.addEventListener('change', () => {
    void handleInboxWorkflowSettingChange('tagOnlyNoAutoMove')
  })
  dom.contentSnapshotEnabled?.addEventListener('change', () => {
    void saveContentSnapshotSettingsFromDom()
  })
  dom.contentSnapshotFullText?.addEventListener('change', () => {
    void saveContentSnapshotSettingsFromDom({ syncFullTextSearch: true })
  })
  dom.contentSnapshotSearchFullText?.addEventListener('change', () => {
    void saveContentSnapshotSettingsFromDom()
  })
  dom.contentSnapshotLocalOnly?.addEventListener('change', () => {
    void saveContentSnapshotSettingsFromDom()
  })
  dom.availabilitySettingsTrigger?.addEventListener('click', toggleAvailabilitySettingsPopover)
  dom.availabilitySettingsSave?.addEventListener('click', () => {
    void saveAvailabilitySettingsFromDom()
  })
  dom.availabilitySettingsReset?.addEventListener('click', () => {
    void resetAvailabilitySettings()
  })
  dom.availabilityConcurrencyInput?.addEventListener('input', syncAvailabilitySettingsDraftFromDom)
  dom.availabilityTimeoutInput?.addEventListener('input', syncAvailabilitySettingsDraftFromDom)
  dom.availabilityAction?.addEventListener('click', handleAvailabilityAction)
  dom.availabilityPauseAction?.addEventListener('click', toggleAvailabilityPause)
  dom.availabilityStopAction?.addEventListener('click', requestAvailabilityStop)
  dom.availabilityFilterBar?.addEventListener('click', handleAvailabilityFilterClick)
  dom.availabilityReviewResults?.addEventListener('click', handleReviewResultAction)
  dom.availabilityResults?.addEventListener('click', handleFailedResultAction)
  dom.availabilityReviewPagination?.addEventListener('click', (event) => {
    handleResultsPaginationClick(event, 'availability-review')
  })
  dom.availabilityFailedPagination?.addEventListener('click', (event) => {
    handleResultsPaginationClick(event, 'availability-failed')
  })
  dom.availabilityClearHistory?.addEventListener('click', () => clearDetectionHistoryLogs(historyCallbacks))
  dom.availabilityToggleHistoryLogs?.addEventListener('click', () => toggleHistoryLogsCollapsed(historyCallbacks))
  dom.bookmarkAddHistoryClear?.addEventListener('click', () => clearBookmarkAddHistory({
    renderAvailabilitySection,
    confirm: requestConfirmation
  }))
  dom.availabilityClearSelection?.addEventListener('click', clearAvailabilitySelection)
  dom.availabilitySelectionRetest?.addEventListener('click', retestSelectedAvailabilityResults)
  dom.availabilitySelectionPromote?.addEventListener('click', () => {
    moveSelectedAvailabilityResults('failed')
  })
  dom.availabilitySelectionDemote?.addEventListener('click', () => {
    moveSelectedAvailabilityResults('review')
  })
  dom.availabilitySelectionMove?.addEventListener('click', () => {
    openMoveModal('availability')
  })
  dom.availabilitySelectionIgnoreBookmark?.addEventListener('click', () => {
    ignoreSelectedAvailabilityResults('bookmark')
  })
  dom.availabilitySelectionIgnoreDomain?.addEventListener('click', () => {
    ignoreSelectedAvailabilityResults('domain')
  })
  dom.availabilitySelectionIgnoreFolder?.addEventListener('click', () => {
    ignoreSelectedAvailabilityResults('folder')
  })
  dom.availabilitySelectionDelete?.addEventListener('click', deleteSelectedAvailabilityResults)
  dom.availabilitySelectAllReview?.addEventListener('click', () => {
    selectAvailabilityResultsByStatus('review')
  })
  dom.availabilitySelectAllFailed?.addEventListener('click', () => {
    selectAvailabilityResultsByStatus('failed')
  })
  dom.redirectResults?.addEventListener('click', (event) => handleRedirectResultsClick(event, redirectsCallbacks))
  dom.redirectPagination?.addEventListener('click', (event) => {
    handleResultsPaginationClick(event, 'redirects')
  })
  dom.redirectClearSelection?.addEventListener('click', () => clearRedirectSelection(redirectsCallbacks))
  dom.redirectBatchUpdate?.addEventListener('click', () => updateSelectedRedirects(redirectsCallbacks))
  dom.redirectDeleteSelection?.addEventListener('click', () => deleteSelectedRedirects(redirectsCallbacks))
  dom.redirectSelectAll?.addEventListener('click', () => selectAllRedirects(redirectsCallbacks))
  dom.redirectDeleteAll?.addEventListener('click', () => deleteAllRedirects(redirectsCallbacks))
  dom.duplicateGroups?.addEventListener('click', (event) => handleDuplicateGroupsClick(event, duplicatesCallbacks))
  dom.duplicateStrategyControls?.addEventListener('click', (event) => handleDuplicateToolbarClick(event, duplicatesCallbacks))
  dom.duplicateClearSelection?.addEventListener('click', () => clearDuplicateSelection(duplicatesCallbacks))
  dom.duplicateDeleteSelection?.addEventListener('click', () => deleteSelectedDuplicates(duplicatesCallbacks))
  dom.folderCleanupAnalyze?.addEventListener('click', () => {
    void rescanFolderCleanupSuggestions(folderCleanupCallbacks)
  })
  dom.folderCleanupResults?.addEventListener('click', (event) => {
    handleFolderCleanupPreviewClick(event, folderCleanupCallbacks)
    void handleFolderCleanupClick(event, folderCleanupCallbacks)
  })
  dom.ignoreBookmarkRules?.addEventListener('click', (event) => handleIgnoreRulesClick(event, ignoreCallbacks))
  dom.ignoreDomainRules?.addEventListener('click', (event) => handleIgnoreRulesClick(event, ignoreCallbacks))
  dom.ignoreFolderRules?.addEventListener('click', (event) => handleIgnoreRulesClick(event, ignoreCallbacks))
  dom.ignoreClearBookmarks?.addEventListener('click', () => clearIgnoreRules('bookmark', ignoreCallbacks))
  dom.ignoreClearDomains?.addEventListener('click', () => clearIgnoreRules('domain', ignoreCallbacks))
  dom.ignoreClearFolders?.addEventListener('click', () => clearIgnoreRules('folder', ignoreCallbacks))
  dom.recycleResults?.addEventListener('click', (event) => handleRecycleResultsClick(event, recycleCallbacks))
  dom.recycleClearSelection?.addEventListener('click', () => clearRecycleSelection(recycleCallbacks))
  dom.recycleRestoreSelection?.addEventListener('click', () => restoreSelectedRecycleEntries(recycleCallbacks))
  dom.recycleClearSelected?.addEventListener('click', () => clearSelectedRecycleEntries(recycleCallbacks))
  dom.recycleSelectAll?.addEventListener('click', () => selectAllRecycleEntries(recycleCallbacks))
  dom.recycleClearAll?.addEventListener('click', () => clearRecycleBin(recycleCallbacks))
  dom.deleteFailedBookmarks?.addEventListener('click', openDeleteModal)
  dom.cancelDeleteModal?.addEventListener('click', closeDeleteModal)
  dom.confirmDeleteModal?.addEventListener('click', confirmDeleteFailedBookmarks)
  dom.cancelConfirmModal?.addEventListener('click', () => resolveConfirmModal(false))
  dom.confirmModalConfirm?.addEventListener('click', () => resolveConfirmModal(true))
  dom.moveSearchInput?.addEventListener('input', () => {
    managerState.moveSearchQuery = dom.moveSearchInput.value
    managerState.moveFolderActiveId = ''
    renderMoveModal()
  })
  dom.moveSearchInput?.addEventListener('keydown', handleMoveSearchKeydown)
  dom.moveFolderResults?.addEventListener('click', handleMoveFolderResultsClick)
  dom.moveFolderResults?.addEventListener('keydown', handleMoveFolderResultsKeydown)
  dom.moveFolderResults?.addEventListener('focusin', handleMoveFolderResultsFocus)
  dom.cancelMoveModal?.addEventListener('click', closeMoveModal)
  dom.scopeSearchInput?.addEventListener('input', () => {
    managerState.scopeSearchQuery = dom.scopeSearchInput.value
    managerState.scopeFolderActiveId = null
    renderScopeModal()
  })
  dom.scopeSearchInput?.addEventListener('keydown', handleScopeSearchKeydown)
  dom.scopeFolderResults?.addEventListener('click', handleScopeFolderResultsClick)
  dom.scopeFolderResults?.addEventListener('keydown', handleScopeFolderResultsKeydown)
  dom.scopeFolderResults?.addEventListener('focusin', handleScopeFolderResultsFocus)
  dom.cancelScopeModal?.addEventListener('click', closeScopeModal)
  dom.closeAiModelModal?.addEventListener('click', closeAiModelModal)
  dom.cancelAiModelModal?.addEventListener('click', closeAiModelModal)
  dom.saveAiModelModal?.addEventListener('click', saveAiModelModalSettings)
  dom.aiModelPickerSearchInput?.addEventListener('input', () => {
    managerState.aiModelPickerSearchQuery = dom.aiModelPickerSearchInput.value
    managerState.aiModelPickerActiveId = ''
    renderAiModelPickerModal()
  })
  dom.aiModelPickerSearchInput?.addEventListener('keydown', handleAiModelPickerSearchKeydown)
  dom.aiModelPickerResults?.addEventListener('click', handleAiModelPickerResultsClick)
  dom.aiModelPickerResults?.addEventListener('keydown', handleAiModelPickerResultsKeydown)
  dom.aiModelPickerResults?.addEventListener('focusin', handleAiModelPickerResultsFocus)
  dom.closeAiModelPickerModal?.addEventListener('click', closeAiModelPickerModal)
  dom.cancelAiModelPickerModal?.addEventListener('click', closeAiModelPickerModal)
  dom.aiModelPickerFetchButton?.addEventListener('click', handleFetchAiModels)
  dom.aiModelPickerManageButton?.addEventListener('click', () => {
    closeAiModelPickerModal()
    openAiModelModal()
  })
  document.addEventListener('keydown', handleKeydown)
  dom.deleteModalBackdrop?.addEventListener('click', (event) => {
    if (event.target === dom.deleteModalBackdrop) {
      closeDeleteModal()
    }
  })
  dom.confirmModalBackdrop?.addEventListener('click', (event) => {
    if (event.target === dom.confirmModalBackdrop) {
      resolveConfirmModal(false)
    }
  })
  dom.moveModalBackdrop?.addEventListener('click', (event) => {
    if (event.target === dom.moveModalBackdrop) {
      closeMoveModal()
    }
  })
  dom.scopeModalBackdrop?.addEventListener('click', (event) => {
    if (event.target === dom.scopeModalBackdrop) {
      closeScopeModal()
    }
  })
  dom.aiModelModalBackdrop?.addEventListener('click', (event) => {
    if (event.target === dom.aiModelModalBackdrop) {
      closeAiModelModal()
    }
  })
  dom.aiModelPickerModalBackdrop?.addEventListener('click', (event) => {
    if (event.target === dom.aiModelPickerModalBackdrop) {
      closeAiModelPickerModal()
    }
  })
}

function getCurrentSectionKey() {
  if (IS_OPTIONS_DASHBOARD_EMBED_MODE) {
    return 'dashboard'
  }

  return window.location.hash.replace(/^#/, '').split(':')[0] || 'general'
}

function getCurrentSectionAnchor() {
  if (IS_OPTIONS_DASHBOARD_EMBED_MODE) {
    return ''
  }

  const [, anchor = ''] = window.location.hash.replace(/^#/, '').split(':')
  return anchor
}

function normalizeSectionKey(key: string): keyof typeof SECTION_META {
  if (key === 'ai-tag-data') {
    return 'backup'
  }

  return key in SECTION_META ? (key as keyof typeof SECTION_META) : 'general'
}

function handleKeydown(event) {
  if (event.key === 'Tab' && trapModalFocus(event)) {
    return
  }

  if (event.key !== 'Escape') {
    return
  }

  if (availabilityState.settingsOpen) {
    event.preventDefault()
    closeAvailabilitySettingsPopover()
    return
  }

  if (cancelDashboardDrag()) {
    event.preventDefault()
    return
  }

  if (closeDashboardTagEditor()) {
    event.preventDefault()
    return
  }

  if (closeDashboardTagPopover()) {
    event.preventDefault()
    return
  }

  if (managerState.confirmModalOpen) {
    event.preventDefault()
    resolveConfirmModal(false)
    return
  }

  if (managerState.aiModelModalOpen) {
    event.preventDefault()
    closeAiModelModal()
    return
  }

  if (managerState.aiModelPickerModalOpen) {
    event.preventDefault()
    closeAiModelPickerModal()
    return
  }

  if (managerState.scopeModalOpen) {
    event.preventDefault()
    closeScopeModal()
    return
  }

  if (managerState.moveModalOpen) {
    event.preventDefault()
    closeMoveModal()
    return
  }

  if (availabilityState.deleteModalOpen) {
    event.preventDefault()
    closeDeleteModal()
    return
  }

  if (getCurrentSectionKey() === 'dashboard') {
    event.preventDefault()
    exitDashboard()
  }
}

function setManagedModalHidden(key, backdrop, open, preferredFocus = null) {
  if (!backdrop) {
    return
  }

  const wasOpen = backdrop.dataset.modalOpen === 'true'
  const visibilityUpdate = setModalHidden(backdrop, open)
  backdrop.dataset.modalOpen = open ? 'true' : 'false'

  if (open && !wasOpen) {
    activeManagedModalKey = key
    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement && !backdrop.contains(activeElement)) {
      modalReturnFocusElement = activeElement
    }
    void Promise.resolve(visibilityUpdate).then(() => {
      window.setTimeout(() => focusModal(backdrop, preferredFocus), 0)
    })
    return
  }

  if (!open && wasOpen && activeManagedModalKey === key) {
    activeManagedModalKey = ''
    const returnFocusElement = modalReturnFocusElement
    modalReturnFocusElement = null
    void Promise.resolve(visibilityUpdate).then(() => {
      if (
        activeManagedModalKey ||
        !(returnFocusElement instanceof HTMLElement) ||
        !document.contains(returnFocusElement) ||
        returnFocusElement.hasAttribute('disabled')
      ) {
        return
      }
      returnFocusElement.focus()
    })
  }
}

function focusModal(backdrop, preferredFocus = null) {
  const target = preferredFocus instanceof HTMLElement && backdrop.contains(preferredFocus)
    ? preferredFocus
    : getModalFocusableElements(backdrop)[0]

  if (target instanceof HTMLElement) {
    target.focus()
  }
}

function getModalFocusableElements(backdrop) {
  return [...backdrop.querySelectorAll(MODAL_FOCUSABLE_SELECTOR)].filter((element) => {
    return (
      element instanceof HTMLElement &&
      !element.hasAttribute('disabled') &&
      !element.getAttribute('aria-hidden') &&
      element.getClientRects().length > 0
    )
  })
}

function getOpenModalBackdrop() {
  return [
    dom.confirmModalBackdrop,
    dom.aiModelModalBackdrop,
  dom.aiModelPickerModalBackdrop,
  dom.scopeModalBackdrop,
  dom.moveModalBackdrop,
  dom.deleteModalBackdrop
  ].find((backdrop) => {
    return backdrop?.dataset?.modalOpen === 'true' && !backdrop.classList.contains('hidden')
  }) || null
}

function trapModalFocus(event) {
  const backdrop = getOpenModalBackdrop()
  if (!backdrop) {
    return false
  }

  const focusableElements = getModalFocusableElements(backdrop)
  if (!focusableElements.length) {
    event.preventDefault()
    return true
  }

  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]
  const activeElement = document.activeElement

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

  if (!backdrop.contains(activeElement)) {
    event.preventDefault()
    firstElement.focus()
    return true
  }

  return false
}

function getPaginationStateKey(kind) {
  if (kind === 'availability-review') {
    return { state: availabilityState, key: 'reviewResultsPage' }
  }
  if (kind === 'availability-failed') {
    return { state: availabilityState, key: 'failedResultsPage' }
  }
  if (kind === 'ai-results') {
    return { state: aiNamingState, key: 'resultsPage' }
  }
  return { state: managerState, key: 'redirectResultsPage' }
}

function getClampedResultsPage(kind, totalCount, pageSize = RESULTS_PAGE_SIZE) {
  const { state, key } = getPaginationStateKey(kind)
  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalCount) / pageSize))
  const currentPage = Math.min(Math.max(1, Number(state[key]) || 1), totalPages)
  state[key] = currentPage
  return currentPage
}

function getPaginatedResults(kind, results, pageSize = RESULTS_PAGE_SIZE) {
  const page = getClampedResultsPage(kind, results.length, pageSize)
  const start = (page - 1) * pageSize
  return results.slice(start, start + pageSize)
}

function renderResultsPagination(container, kind, totalCount, label, pageSize = RESULTS_PAGE_SIZE) {
  if (!container) {
    return
  }

  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalCount) / pageSize))
  const page = getClampedResultsPage(kind, totalCount, pageSize)
  const start = totalCount ? (page - 1) * pageSize + 1 : 0
  const end = Math.min(totalCount, page * pageSize)
  container.classList.toggle('hidden', totalPages <= 1)

  if (totalPages <= 1) {
    container.innerHTML = ''
    return
  }

  container.innerHTML = `
    <span class="results-pagination-label">${escapeHtml(label)} ${escapeHtml(String(start))}-${escapeHtml(String(end))} / ${escapeHtml(String(totalCount))}</span>
    <button class="options-button secondary small" type="button" data-results-page="${escapeAttr(kind)}" data-page-direction="prev" ${page <= 1 ? 'disabled' : ''}>上一页</button>
    <span class="option-value">${escapeHtml(String(page))} / ${escapeHtml(String(totalPages))}</span>
    <button class="options-button secondary small" type="button" data-results-page="${escapeAttr(kind)}" data-page-direction="next" ${page >= totalPages ? 'disabled' : ''}>下一页</button>
  `
}

function resetResultsPage(kind) {
  const { state, key } = getPaginationStateKey(kind)
  state[key] = 1
}

function handleResultsPaginationClick(event, expectedKind) {
  const button = event.target.closest('[data-results-page]')
  if (!button || button.hasAttribute('disabled')) {
    return
  }

  const kind = String(button.getAttribute('data-results-page') || '')
  if (kind !== expectedKind) {
    return
  }

  const direction = String(button.getAttribute('data-page-direction') || '')
  const { state, key } = getPaginationStateKey(kind)
  state[key] = Math.max(1, (Number(state[key]) || 1) + (direction === 'next' ? 1 : -1))
  renderAvailabilitySection()
}

function handleReviewResultAction(event) {
  const selectionInput = event.target.closest('input[data-availability-select]')
  if (selectionInput) {
    toggleAvailabilitySelection(selectionInput.getAttribute('data-bookmark-id'), selectionInput.checked)
    return
  }

  const handled = handleAvailabilityResultQuickAction(event)
  if (handled) {
    return
  }

  const actionButton = event.target.closest('[data-review-action="promote-failed"]')
  if (
    !actionButton ||
    availabilityState.deleting ||
    availabilityState.stopRequested ||
    (availabilityState.running && !availabilityState.paused)
  ) {
    return
  }

  const bookmarkId = String(actionButton.getAttribute('data-bookmark-id') || '').trim()
  if (!bookmarkId) {
    return
  }

  promoteReviewResultToFailed(bookmarkId)
}

function handleFailedResultAction(event) {
  const selectionInput = event.target.closest('input[data-availability-select]')
  if (selectionInput) {
    toggleAvailabilitySelection(selectionInput.getAttribute('data-bookmark-id'), selectionInput.checked)
    return
  }

  const handled = handleAvailabilityResultQuickAction(event)
  if (handled) {
    return
  }

  const actionButton = event.target.closest('[data-failed-action="demote-review"]')
  if (
    !actionButton ||
    availabilityState.deleting ||
    availabilityState.stopRequested ||
    (availabilityState.running && !availabilityState.paused)
  ) {
    return
  }

  const bookmarkId = String(actionButton.getAttribute('data-bookmark-id') || '').trim()
  if (!bookmarkId) {
    return
  }

  demoteFailedResultToReview(bookmarkId)
}

function handleAvailabilityFilterClick(event) {
  const button = event.target.closest('[data-availability-filter]')
  if (!button) {
    return
  }

  const filter = String(button.getAttribute('data-availability-filter') || 'all').trim()
  if (!AVAILABILITY_FILTERS.has(filter)) {
    return
  }

  availabilityState.availabilityFilter = filter
  resetResultsPage('availability-review')
  resetResultsPage('availability-failed')
  if (filter === 'redirected') {
    resetResultsPage('availability-review')
  }
  renderAvailabilitySection()
}

function handleAvailabilityResultQuickAction(event) {
  const actionButton = event.target.closest('[data-availability-result-action]')
  if (!actionButton) {
    return false
  }

  if (isAvailabilityResultActionLocked()) {
    return true
  }

  const action = String(actionButton.getAttribute('data-availability-result-action') || '').trim()
  const bookmarkId = String(actionButton.getAttribute('data-bookmark-id') || '').trim()
  if (!action || !bookmarkId) {
    return true
  }

  if (action === 'hide-run') {
    hideAvailabilityResultForCurrentRun(bookmarkId)
    return true
  }

  if (action === 'never-check') {
    void ignoreSingleAvailabilityResult(bookmarkId, 'bookmark')
    return true
  }

  if (action === 'ignore-bookmark' || action === 'ignore-domain' || action === 'ignore-folder') {
    void ignoreSingleAvailabilityResult(bookmarkId, action.replace('ignore-', ''))
    return true
  }

  return true
}

function collectNewTabShortcutFolderIds(
  rootNode: chrome.bookmarks.BookmarkTreeNode | null | undefined,
  rawFolderSettings?: unknown
): Set<string> {
  const excludedFolderIds = new Set<string>()
  if (!rootNode) {
    return excludedFolderIds
  }

  const selectedFolderIds = new Set(getSelectedNewTabFolderIds(rawFolderSettings))

  function walk(
    node: chrome.bookmarks.BookmarkTreeNode,
    parentId = '',
    insideShortcutFolder = false
  ) {
    if (node.url) {
      return
    }

    const folderId = String(node.id || '').trim()
    const effectiveParentId = String(node.parentId || parentId || '').trim()
    const title = String(node.title || '').trim()
    const isShortcutFolder =
      title === NEW_TAB_SHORTCUT_FOLDER_TITLE &&
      (effectiveParentId === BOOKMARKS_BAR_ID || selectedFolderIds.has(folderId))
    const shouldExclude = insideShortcutFolder || isShortcutFolder

    if (folderId && shouldExclude) {
      excludedFolderIds.add(folderId)
    }

    for (const child of node.children || []) {
      walk(child, folderId, shouldExclude)
    }
  }

  walk(rootNode)
  return excludedFolderIds
}

function getSelectedNewTabFolderIds(rawFolderSettings?: unknown): string[] {
  if (!rawFolderSettings || typeof rawFolderSettings !== 'object' || Array.isArray(rawFolderSettings)) {
    return []
  }

  const selectedFolderIds = (rawFolderSettings as Record<string, unknown>).selectedFolderIds
  if (!Array.isArray(selectedFolderIds)) {
    return []
  }

  return selectedFolderIds
    .map((folderId) => String(folderId || '').trim())
    .filter(Boolean)
}

async function hydrateAvailabilityCatalog({ preserveResults = false, analyzeFolderCleanup = true } = {}) {
  availabilityState.catalogLoading = true
  availabilityState.lastError = ''
  scheduleAvailabilityRender()

  try {
    const [tree, newTabStorage] = await Promise.all([
      getBookmarkTree(),
      getLocalStorage([STORAGE_KEYS.newTabFolderSettings])
    ])
    const rootNode = Array.isArray(tree) ? tree[0] : tree
    const extracted = extractBookmarkData(rootNode)
    const bookmarks = extracted.bookmarks
    const excludedDuplicateFolderIds = collectNewTabShortcutFolderIds(
      rootNode,
      newTabStorage[STORAGE_KEYS.newTabFolderSettings]
    )

    folderCleanupState.rootNode = rootNode
    availabilityState.allBookmarks = bookmarks
    availabilityState.allFolders = extracted.folders
    availabilityState.bookmarkMap = extracted.bookmarkMap
    availabilityState.folderMap = extracted.folderMap
    if (dashboardState.folderId && !availabilityState.folderMap.has(String(dashboardState.folderId))) {
      dashboardState.folderId = ''
    }
    managerState.duplicateGroups = buildDuplicateGroups(bookmarks, {
      excludedFolderIds: excludedDuplicateFolderIds
    })
    applyAvailabilityScope({ preserveResults })
    syncAiNamingCatalog({ preserveResults })
  } catch (error) {
    availabilityState.allBookmarks = []
    availabilityState.allFolders = []
    availabilityState.bookmarkMap = new Map()
    availabilityState.folderMap = new Map()
    availabilityState.bookmarks = []
    availabilityState.requestOrigins = []
    availabilityState.totalBookmarks = 0
    availabilityState.eligibleBookmarks = 0
    availabilityState.skippedCount = 0
    resetDetectionResults()
    managerState.duplicateGroups = []
    folderCleanupState.rootNode = null
    folderCleanupState.suggestions = []
    syncAiNamingCatalog({ preserveResults: false })
    availabilityState.lastError =
      error instanceof Error ? error.message : '书签列表读取失败，请刷新页面后重试。'
  } finally {
    availabilityState.catalogLoading = false
    if (analyzeFolderCleanup && folderCleanupState.rootNode) {
      await analyzeFolderCleanupSuggestions(folderCleanupCallbacks)
    }
    renderAvailabilitySection()
  }
}

async function hydrateProbePermission() {
  availabilityState.permissionPending = true
  scheduleAvailabilityRender()

  try {
    if (!availabilityState.requestOrigins.length) {
      availabilityState.probePermissionGranted = false
      return
    }

    availabilityState.probePermissionGranted = await containsPermissions({
      origins: availabilityState.requestOrigins
    })
  } catch (error) {
    availabilityState.probePermissionGranted = false
  } finally {
    availabilityState.permissionPending = false
    renderAvailabilitySection()
  }
}

function applyAvailabilityScope({ preserveResults = false } = {}) {
  if (availabilityState.scopeFolderId && !availabilityState.folderMap.has(String(availabilityState.scopeFolderId))) {
    availabilityState.scopeFolderId = ''
  }

  const scopedBookmarks = getScopedBookmarks()
  const eligibleBookmarks = scopedBookmarks.filter((bookmark) => isCheckableUrl(bookmark.url))

  availabilityState.bookmarks = eligibleBookmarks
  availabilityState.requestOrigins = collectRequestOrigins(eligibleBookmarks)
  availabilityState.totalBookmarks = scopedBookmarks.length
  availabilityState.eligibleBookmarks = eligibleBookmarks.length
  availabilityState.skippedCount = Math.max(scopedBookmarks.length - eligibleBookmarks.length, 0)

  syncHistoryComparisonScope(historyCallbacks)

  if (preserveResults) {
    reconcileCatalogAfterMutation()
  } else {
    resetCurrentAvailabilityRunState()
    clearAvailabilitySelection()
    clearRedirectSelection(redirectsCallbacks)
    clearDuplicateSelection(duplicatesCallbacks)
    clearRecycleSelection(recycleCallbacks)
    restorePendingAvailabilitySnapshotForScope()
  }

  if (!eligibleBookmarks.length) {
    availabilityState.lastError = '当前检测范围内没有可检测的 http/https 书签。'
  }
}

function getScopedBookmarks() {
  if (!availabilityState.scopeFolderId) {
    return availabilityState.allBookmarks.slice()
  }

  return availabilityState.allBookmarks.filter((bookmark) => {
    return (bookmark.ancestorIds || []).includes(String(availabilityState.scopeFolderId))
  })
}

function getCurrentAvailabilityScopeMeta() {
  const folderId = String(availabilityState.scopeFolderId || '').trim()
  if (!folderId) {
    return {
      key: 'all',
      type: 'all',
      folderId: '',
      label: '全部书签'
    }
  }

  const folder = availabilityState.folderMap.get(folderId)
  return {
    key: `folder:${folderId}`,
    type: 'folder',
    folderId,
    label: folder?.path || folder?.title || '指定文件夹'
  }
}

function getAiNamingScopedBookmarks() {
  if (!aiNamingState.scopeFolderId) {
    return availabilityState.allBookmarks.slice()
  }

  return availabilityState.allBookmarks.filter((bookmark) => {
    return (bookmark.ancestorIds || []).includes(String(aiNamingState.scopeFolderId))
  })
}

function getCurrentAiNamingScopeMeta() {
  const folderId = String(aiNamingState.scopeFolderId || '').trim()
  if (!folderId) {
    return {
      key: 'all',
      type: 'all',
      folderId: '',
      label: '全部书签'
    }
  }

  const folder = availabilityState.folderMap.get(folderId)
  return {
    key: `folder:${folderId}`,
    type: 'folder',
    folderId,
    label: folder?.path || folder?.title || '指定文件夹'
  }
}

function resetAiNamingRunState() {
  aiNamingState.checkedBookmarks = 0
  aiNamingState.paused = false
  aiNamingState.pauseResolvers = []
  aiNamingState.suggestedCount = 0
  aiNamingState.manualReviewCount = 0
  aiNamingState.unchangedCount = 0
  aiNamingState.highConfidenceCount = 0
  aiNamingState.mediumConfidenceCount = 0
  aiNamingState.lowConfidenceCount = 0
  aiNamingState.failedCount = 0
  aiNamingState.results = []
  aiNamingState.resultsPage = 1
  aiNamingState.selectedResultIds = new Set()
  aiNamingState.pendingMoveResultIds = new Set()
  aiNamingState.pendingMoveSelection = false
  aiNamingState.runStartedAt = 0
  aiNamingState.lastCompletedAt = 0
  aiNamingState.lastError = ''
  contentSnapshotState.aiRunSavedCount = 0
  contentSnapshotState.aiRunFailedCount = 0
  contentSnapshotState.statusMessage = ''
}

function syncAiNamingCatalog({ preserveResults = false } = {}) {
  if (aiNamingState.scopeFolderId && !availabilityState.folderMap.has(String(aiNamingState.scopeFolderId))) {
    aiNamingState.scopeFolderId = ''
  }

  const scopedBookmarks = getAiNamingScopedBookmarks()
  const eligibleBookmarks = scopedBookmarks.filter((bookmark) => isCheckableUrl(bookmark.url))
  aiNamingState.bookmarks = eligibleBookmarks
  aiNamingState.requestOrigins = collectRequestOrigins(eligibleBookmarks)
  aiNamingState.eligibleBookmarks = eligibleBookmarks.length

  if (preserveResults) {
    aiNamingState.results = syncAiNamingResultMetadata(aiNamingState.results)
    syncSelectionSet(
      aiNamingState.selectedResultIds,
      new Set(
        aiNamingState.results
          .filter((result) => result.status === 'suggested')
          .map((result) => String(result.id))
      )
    )
    recalculateAiNamingSummary()
  } else if (!aiNamingState.running && !aiNamingState.applying) {
    resetAiNamingRunState()
  }
}

function syncAiNamingResultMetadata(results) {
  return results
    .map((result) => {
      const latestBookmark = availabilityState.bookmarkMap.get(String(result.id))
      if (!latestBookmark) {
        return null
      }

      return {
        ...result,
        status:
          result.status === 'suggested' &&
          normalizeText(String(result.suggestedTitle || '')) === normalizeText(latestBookmark.title)
            ? 'unchanged'
            : result.status,
        currentTitle: latestBookmark.title,
        url: latestBookmark.url,
        displayUrl: latestBookmark.displayUrl,
        path: latestBookmark.path,
        domain: latestBookmark.domain,
        ancestorIds: latestBookmark.ancestorIds,
        parentId: latestBookmark.parentId,
        index: latestBookmark.index
      }
    })
    .filter(Boolean)
}

function recalculateAiNamingSummary() {
  aiNamingState.suggestedCount = aiNamingState.results.filter((result) => result.status === 'suggested').length
  aiNamingState.manualReviewCount = aiNamingState.results.filter((result) => result.status === 'manual_review').length
  aiNamingState.unchangedCount = aiNamingState.results.filter((result) => result.status === 'unchanged').length
  aiNamingState.failedCount = aiNamingState.results.filter((result) => result.status === 'failed').length
  aiNamingState.highConfidenceCount = aiNamingState.results.filter((result) => result.confidence === 'high').length
  aiNamingState.mediumConfidenceCount = aiNamingState.results.filter((result) => result.confidence === 'medium').length
  aiNamingState.lowConfidenceCount = aiNamingState.results.filter((result) => result.confidence === 'low').length
}

async function hydrateAiNamingPermissionState() {
  aiNamingState.requestingPermission = true
  scheduleAvailabilityRender()

  try {
    aiNamingState.remoteParserPermissionGranted = await hasJinaReaderPermission()
    const permissionOrigins = getAiNamingPermissionOrigins()
    if (!permissionOrigins.length) {
      aiNamingState.permissionGranted = false
      return
    }

    aiNamingState.permissionGranted = await containsPermissions({
      origins: permissionOrigins
    })
  } catch (error) {
    aiNamingState.permissionGranted = false
    aiNamingState.remoteParserPermissionGranted = false
  } finally {
    aiNamingState.requestingPermission = false
    renderAvailabilitySection()
  }
}

function resetCurrentAvailabilityRunState() {
  resetDetectionResults()
  resetResultsPage('availability-review')
  resetResultsPage('availability-failed')
  resetResultsPage('redirects')
  availabilityState.lastCompletedAt = 0
  availabilityState.lastRunOutcome = ''
  availabilityState.runStartedAt = 0
  availabilityState.runnerStatusCopy = ''
  availabilityState.currentRunProbeEnabled = false
  availabilityState.retestingSelection = false
  availabilityState.retestSelectionTotal = 0
  availabilityState.retestSelectionCompleted = 0
  availabilityState.retestSelectionProbeEnabled = false
}

function restorePendingAvailabilitySnapshotForScope() {
  if (
    availabilityState.running ||
    availabilityState.retestingSelection ||
    availabilityState.deleting ||
    availabilityState.lastCompletedAt
  ) {
    return false
  }

  const snapshot = managerState.pendingAvailabilitySnapshot
  const restored = reconcilePendingAvailabilitySnapshot(
    snapshot,
    availabilityState.bookmarkMap,
    getCurrentAvailabilityScopeMeta()
  )

  if (!restored) {
    return false
  }

  availabilityState.reviewResults = restored.reviewResults
  availabilityState.failedResults = restored.failedResults
  availabilityState.redirectResults = restored.redirectResults
  managerState.currentHistoryEntries = restored.currentHistoryEntries
  managerState.suppressedResults = []

  availabilityState.reviewCount = restored.reviewResults.length
  availabilityState.failedCount = restored.failedResults.length
  availabilityState.redirectedCount = restored.redirectResults.length
  availabilityState.ignoredCount = Math.max(0, Number(snapshot?.summary?.ignoredCount) || 0)
  availabilityState.availableCount = Math.max(0, Number(snapshot?.summary?.availableCount) || 0)
  availabilityState.checkedBookmarks = Math.max(
    restored.matchedCount,
    Number(snapshot?.summary?.checkedBookmarks) || restored.matchedCount
  )
  availabilityState.currentRunProbeEnabled = Boolean(snapshot?.probeEnabled)
  availabilityState.lastCompletedAt = Number(snapshot?.completedAt || snapshot?.savedAt) || 0
  availabilityState.lastRunOutcome = String(snapshot?.runOutcome || 'completed')
  availabilityState.runStartedAt = 0

  sortResultsByPath(availabilityState.reviewResults)
  sortResultsByPath(availabilityState.failedResults)
  sortResultsByPath(availabilityState.redirectResults)
  syncSelectionSet(
    managerState.selectedAvailabilityIds,
    new Set(
      [...availabilityState.reviewResults, ...availabilityState.failedResults].map((result) => String(result.id))
    )
  )

  if (restored.droppedCount) {
    availabilityState.lastError = `已恢复上次待处理结果；${restored.droppedCount} 条结果因书签已变更而跳过。`
  }

  return true
}

async function persistPendingAvailabilitySnapshot({
  savedAt = Date.now()
}: {
  savedAt?: number
} = {}) {
  const snapshot = buildPendingAvailabilitySnapshot({
    reviewResults: availabilityState.reviewResults,
    failedResults: availabilityState.failedResults,
    redirectResults: availabilityState.redirectResults,
    scope: getCurrentAvailabilityScopeMeta(),
    savedAt,
    completedAt: availabilityState.lastCompletedAt || savedAt,
    runOutcome: availabilityState.lastRunOutcome || (availabilityState.lastCompletedAt ? 'completed' : ''),
    probeEnabled: availabilityState.currentRunProbeEnabled || availabilityState.retestSelectionProbeEnabled,
    summary: {
      checkedBookmarks: availabilityState.checkedBookmarks,
      availableCount: availabilityState.availableCount,
      redirectedCount: availabilityState.redirectedCount,
      reviewCount: availabilityState.reviewCount,
      failedCount: availabilityState.failedCount,
      ignoredCount: availabilityState.ignoredCount
    }
  })

  managerState.pendingAvailabilitySnapshot = snapshot
  await savePendingAvailabilitySnapshot(snapshot)
}

function persistPendingAvailabilitySnapshotSoon() {
  void persistPendingAvailabilitySnapshot().catch(() => {})
}

function hasPendingAvailabilityResults() {
  return Boolean(
    availabilityState.reviewResults.length ||
    availabilityState.failedResults.length ||
    availabilityState.redirectResults.length
  )
}

async function ensureProbePermissionForRun({ interactive = true } = {}) {
  if (!availabilityState.requestOrigins.length) {
    availabilityState.probePermissionGranted = false
    return false
  }

  if (availabilityState.probePermissionGranted) {
    return true
  }

  if (!interactive) {
    return false
  }

  availabilityState.requestingPermission = true
  scheduleAvailabilityRender()

  try {
    availabilityState.probePermissionGranted = await requestPermissions({
      origins: availabilityState.requestOrigins
    })
    return availabilityState.probePermissionGranted
  } catch (error) {
    availabilityState.probePermissionGranted = false
    return false
  } finally {
    availabilityState.requestingPermission = false
    renderAvailabilitySection()
  }
}

async function handleAvailabilityAction() {
  if (
    availabilityState.running ||
    availabilityState.retestingSelection ||
    availabilityState.catalogLoading ||
    availabilityState.requestingPermission ||
    availabilityState.deleting
  ) {
    return
  }

  if (!availabilityState.bookmarks.length) {
    availabilityState.lastError = '当前没有可检测的 http/https 书签。'
    renderAvailabilitySection()
    return
  }

  const probeEnabled = await ensureProbePermissionForRun({ interactive: true })
  availabilityState.currentRunProbeEnabled = probeEnabled
  await runAvailabilityDetection({ probeEnabled })
}

async function handleAvailabilityScopeChange(nextScopeFolderId) {
  availabilityState.lastError = ''
  availabilityState.scopeFolderId = String(nextScopeFolderId || '').trim()
  applyAvailabilityScope({ preserveResults: false })
  renderAvailabilitySection()
  await hydrateProbePermission()
}

function toggleAvailabilityPause() {
  if (!availabilityState.running || availabilityState.deleting || availabilityState.stopRequested) {
    return
  }

  availabilityState.paused = !availabilityState.paused

  if (!availabilityState.paused) {
    releaseAvailabilityPauseResolvers()
  }

  renderAvailabilitySection()
}

function requestAvailabilityStop() {
  if (!availabilityState.running || availabilityState.deleting || availabilityState.stopRequested) {
    return
  }

  availabilityState.stopRequested = true
  availabilityState.paused = false
  availabilityState.abortController?.abort()
  cancelActiveNavigationChecks()
  releaseAvailabilityPauseResolvers()
  renderAvailabilitySection()
}

function createAvailabilityScheduler() {
  return createAvailabilityRunScheduler({
    profile: buildAvailabilityProfileFromUserSettings(availabilityState.settings)
  })
}

async function runAvailabilityDetection({ probeEnabled }) {
  const redirectCacheScope = getCurrentAvailabilityScopeMeta()
  const scheduler = createAvailabilityScheduler()
  availabilityState.running = true
  availabilityState.paused = false
  availabilityState.stopRequested = false
  availabilityState.lastError = ''
  availabilityState.lastCompletedAt = 0
  availabilityState.lastRunOutcome = ''
  availabilityState.runStartedAt = Date.now()
  updateAvailabilityRunnerStatus(scheduler)
  availabilityState.runQueue = availabilityState.bookmarks.slice()
  availabilityState.deletedBookmarkIds = new Set()
  availabilityState.abortController = new AbortController()
  availabilityState.activeNavigationCheckIds = new Set()
  resetDetectionResults()
  clearAvailabilitySelection()
  clearRedirectSelection(redirectsCallbacks)
  renderAvailabilitySection()

  try {
    await runAvailabilityQueue({
      items: availabilityState.runQueue,
      scheduler,
      getUrl: (bookmark) => bookmark?.url,
      shouldContinue: waitForAvailabilityRun,
      shouldSkip: (bookmark) => !bookmark || isBookmarkRemovedDuringRun(bookmark.id),
      wait: waitForAvailabilityQueueDelay,
      onWait: () => {
        updateAvailabilityRunnerStatus(scheduler)
      },
      processItem: async (bookmark) => {
        const result = await inspectBookmarkAvailability(bookmark, { probeEnabled, scheduler })
        if (!result) {
          return
        }

        if (isBookmarkRemovedDuringRun(result.id)) {
          return
        }

        applyAvailabilityResult(result)
        updateAvailabilityRunnerStatus(scheduler)
      }
    })

    sortResultsByPath(availabilityState.reviewResults)
    sortResultsByPath(availabilityState.failedResults)
    sortResultsByPath(availabilityState.redirectResults)
    if (!availabilityState.stopRequested) {
      await finalizeDetectionHistory(historyCallbacks)
    }
    availabilityState.lastCompletedAt = Date.now()
    availabilityState.lastRunOutcome = availabilityState.stopRequested ? 'stopped' : 'completed'
  } catch (error) {
    availabilityState.lastRunOutcome = ''
    availabilityState.lastError =
      error instanceof Error ? error.message : '书签可用性检测失败，请稍后重试。'
  } finally {
    availabilityState.running = false
    availabilityState.paused = false
    availabilityState.stopRequested = false
    availabilityState.runQueue = []
    availabilityState.deletedBookmarkIds = new Set()
    availabilityState.abortController = null
    availabilityState.activeNavigationCheckIds = new Set()
    updateAvailabilityRunnerStatus(scheduler)
    releaseAvailabilityPauseResolvers()
    try {
      await persistRedirectCacheSnapshot(redirectsCallbacks, {
        savedAt: availabilityState.lastCompletedAt || Date.now(),
        scope: redirectCacheScope
      })
    } catch {}
    try {
      if (availabilityState.lastCompletedAt || hasPendingAvailabilityResults()) {
        await persistPendingAvailabilitySnapshot({
          savedAt: availabilityState.lastCompletedAt || Date.now()
        })
      }
    } catch {}
    renderAvailabilitySection()
  }
}

async function inspectBookmarkAvailability(
  bookmark,
  {
    probeEnabled,
    scheduler = null
  }: {
    probeEnabled: boolean
    scheduler?: AvailabilityRunScheduler | null
  }
) {
  if (!(await waitForAvailabilityRun())) {
    return null
  }

  const attempts: NavigationAttempt[] = []
  const timeoutPolicy = scheduler?.getTimeoutPolicy(bookmark?.url) || {
    navigationTimeoutMs: NAVIGATION_TIMEOUT_MS,
    retryNavigationTimeoutMs: NAVIGATION_RETRY_TIMEOUT_MS,
    probeTimeoutMs: FETCH_TIMEOUT_MS
  }

  const firstNavigation = await runNavigationAttempt(bookmark.url, timeoutPolicy.navigationTimeoutMs)
  scheduler?.recordOutcome(bookmark.url, getNavigationAttemptRunOutcome(firstNavigation))
  if (availabilityState.stopRequested) {
    return null
  }
  attempts.push(firstNavigation)

  if (shouldAcceptNavigationSuccess(firstNavigation)) {
    return buildNavigationSuccess(bookmark, firstNavigation, '首轮后台导航成功')
  }

  if (shouldRetryNavigation(firstNavigation)) {
    if (!(await waitForAvailabilityRun())) {
      return null
    }

    const secondNavigation = await runNavigationAttempt(bookmark.url, timeoutPolicy.retryNavigationTimeoutMs)
    scheduler?.recordOutcome(bookmark.url, getNavigationAttemptRunOutcome(secondNavigation))
    if (availabilityState.stopRequested) {
      return null
    }
    attempts.push(secondNavigation)

    if (shouldAcceptNavigationSuccess(secondNavigation)) {
      return buildNavigationSuccess(bookmark, secondNavigation, '二次后台导航成功')
    }
  }

  let probe = null
  if (probeEnabled) {
    if (!(await waitForAvailabilityRun())) {
      return null
    }

    probe = await probeBookmarkUrl(bookmark.url, { timeoutMs: timeoutPolicy.probeTimeoutMs })
    scheduler?.recordOutcome(bookmark.url, getProbeRunOutcome(probe))
    if (availabilityState.stopRequested) {
      return null
    }
  }

  return buildFailureClassification(bookmark, attempts, probe, probeEnabled)
}

async function waitForAvailabilityRun() {
  while (availabilityState.paused && !availabilityState.stopRequested) {
    await new Promise((resolve) => {
      availabilityPauseResolvers.push(() => resolve(undefined))
    })
  }

  return !availabilityState.stopRequested
}

function releaseAvailabilityPauseResolvers() {
  const resolvers = availabilityPauseResolvers
  availabilityPauseResolvers = []

  resolvers.forEach((resolve) => {
    resolve()
  })
}

function isBookmarkRemovedDuringRun(bookmarkId) {
  return availabilityState.deletedBookmarkIds.has(String(bookmarkId || '').trim())
}

async function runNavigationAttempt(url, timeoutMs): Promise<NavigationAttempt> {
  const checkId = createNavigationCheckId()
  availabilityState.activeNavigationCheckIds?.add(checkId)

  try {
    const result = await requestNavigationCheck(url, timeoutMs, checkId)

    return {
      status: result?.status || 'failed',
      finalUrl: result?.finalUrl || url,
      detail: result?.detail || '后台导航失败。',
      errorCode: result?.errorCode || '',
      networkEvidence: result?.networkEvidence
    }
  } catch (error) {
    return {
      status: 'failed' as const,
      finalUrl: url,
      detail: error instanceof Error ? error.message : '后台导航失败。',
      errorCode: 'runtime-message-failed'
    }
  } finally {
    availabilityState.activeNavigationCheckIds?.delete(checkId)
  }
}

function createNavigationCheckId() {
  return `nav-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

function cancelActiveNavigationChecks() {
  const checkIds = [...(availabilityState.activeNavigationCheckIds || [])]
  availabilityState.activeNavigationCheckIds = new Set()

  checkIds.forEach((checkId) => {
    cancelNavigationCheck(checkId).catch(() => {})
  })
}

async function probeBookmarkUrl(url, { timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  try {
    const headResponse = await fetchWithTimeout(url, 'HEAD', timeoutMs)
    if (!shouldFallbackToGet(headResponse.status)) {
      return classifyProbeResponse(headResponse, 'HEAD')
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      return {
        kind: 'unknown',
        method: 'HEAD',
        label: '探测超时',
        detail: `网络探测超时，超过 ${Math.round(timeoutMs / 1000)} 秒仍未返回。`
      }
    }
  }

  try {
    const getResponse = await fetchWithTimeout(url, 'GET', timeoutMs)
    return classifyProbeResponse(getResponse, 'GET')
  } catch (error) {
    if (error?.name === 'AbortError') {
      return {
        kind: 'unknown',
        method: 'GET',
        label: '探测超时',
        detail: `网络探测超时，超过 ${Math.round(timeoutMs / 1000)} 秒仍未返回。`
      }
    }

    return classifyProbeError(error)
  }
}

async function fetchWithTimeout(url, method, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController()
  const runSignal = availabilityState.abortController?.signal
  const abortCurrentFetch = () => {
    controller.abort()
  }

  if (runSignal?.aborted) {
    controller.abort()
  } else {
    runSignal?.addEventListener('abort', abortCurrentFetch, { once: true })
  }

  const timeoutId = window.setTimeout(() => {
    controller.abort()
  }, Math.max(1000, Number(timeoutMs) || FETCH_TIMEOUT_MS))

  try {
    return await fetch(url, {
      method,
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
      signal: controller.signal
    })
  } finally {
    clearTimeout(timeoutId)
    runSignal?.removeEventListener('abort', abortCurrentFetch)
  }
}

function getNavigationAttemptRunOutcome(attempt: NavigationAttempt | null | undefined): AvailabilityRunOutcome {
  const statusCode = Number(attempt?.networkEvidence?.statusCode) || extractStatusCodeFromText(attempt?.errorCode) || extractStatusCodeFromText(attempt?.detail)
  const errorCode = String(attempt?.networkEvidence?.errorCode || attempt?.errorCode || '').trim()
  const detail = String(attempt?.detail || '').trim()

  if (statusCode === 429) {
    return { kind: 'throttle', statusCode, errorCode, detail }
  }

  if (
    ['timeout', 'net::ERR_TIMED_OUT', 'net::ERR_CONNECTION_TIMED_OUT'].includes(errorCode) ||
    /timeout|超时/i.test(detail)
  ) {
    return { kind: 'timeout', statusCode, errorCode, detail, timedOut: true }
  }

  if (attempt?.status === 'available') {
    return { kind: 'success', statusCode, errorCode, detail }
  }

  return {
    kind: statusCode ? 'http' : 'network',
    statusCode,
    errorCode,
    detail
  }
}

function getProbeRunOutcome(probe): AvailabilityRunOutcome {
  const statusCode = extractStatusCodeFromText(probe?.label) || extractStatusCodeFromText(probe?.detail)
  const detail = String(probe?.detail || '').trim()

  if (statusCode === 429) {
    return { kind: 'throttle', statusCode, detail }
  }

  if (/timeout|超时/i.test(detail) || String(probe?.label || '').includes('超时')) {
    return { kind: 'timeout', statusCode, detail, timedOut: true }
  }

  if (probe?.kind === 'ok') {
    return { kind: 'success', statusCode, detail }
  }

  return {
    kind: statusCode ? 'http' : 'unknown',
    statusCode,
    detail
  }
}

function extractStatusCodeFromText(value): number {
  const match = String(value || '').match(/\b(?:HTTP|http-|status\s*)?([1-5][0-9]{2})\b/)
  return match ? Number(match[1]) || 0 : 0
}

async function waitForAvailabilityQueueDelay(ms: number): Promise<void> {
  const delayMs = Math.max(1, Math.round(Number(ms) || 1))
  await new Promise((resolve) => {
    window.setTimeout(resolve, delayMs)
  })
}

function updateAvailabilityRunnerStatus(scheduler: AvailabilityRunScheduler | null = null) {
  availabilityState.runnerStatusCopy = scheduler
    ? formatAvailabilityRunnerStatus(scheduler.getSnapshot())
    : formatAvailabilityRunnerStatus(createAvailabilityScheduler().getSnapshot())
}

function getAvailabilityRunnerStatusCopy() {
  return availabilityState.runnerStatusCopy || formatAvailabilityRunnerStatus(createAvailabilityScheduler().getSnapshot())
}

async function fetchWithRequestTimeout(url, options: RequestInit = {}, timeoutMs = AI_NAMING_DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController()
  const externalSignal = options.signal
  const abortCurrentFetch = () => {
    controller.abort()
  }

  if (externalSignal?.aborted) {
    controller.abort()
  } else {
    externalSignal?.addEventListener('abort', abortCurrentFetch, { once: true })
  }

  const timeoutId = window.setTimeout(() => {
    controller.abort()
  }, Math.max(1000, Number(timeoutMs) || AI_NAMING_DEFAULT_TIMEOUT_MS))

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    })
  } finally {
    clearTimeout(timeoutId)
    externalSignal?.removeEventListener('abort', abortCurrentFetch)
  }
}

function throwIfAborted(signal?: AbortSignal | null) {
  if (signal?.aborted) {
    throw new DOMException('操作已取消。', 'AbortError')
  }
}

function isAbortError(error) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function applyAvailabilityResult(result) {
  availabilityState.checkedBookmarks += 1

  if (result.status === 'available') {
    availabilityState.availableCount += 1
    scheduleAvailabilityRender()
    return
  }

  if (result.status === 'redirected') {
    availabilityState.redirectedCount += 1
    availabilityState.redirectResults.push({
      ...result,
      finalUrl: result.finalUrl || result.url
    })
    scheduleAvailabilityRender()
    return
  }

  const historyStatus = managerState.previousHistoryMap.has(result.id) ? 'persistent' : 'new'
  const abnormalStreak = managerState.previousHistoryMap.has(result.id)
    ? getHistoricalAbnormalStreak(result.id, historyCallbacks) + 1
    : 1
  const nextResult = {
    ...result,
    historyStatus,
    abnormalStreak
  }

  managerState.currentHistoryEntries.push({
    id: nextResult.id,
    title: nextResult.title,
    url: nextResult.url,
    path: nextResult.path,
    status: nextResult.status,
    streak: abnormalStreak
  })

  if (matchesIgnoreRules(nextResult)) {
    managerState.suppressedResults.push(nextResult)
    availabilityState.ignoredCount = managerState.suppressedResults.length
    scheduleAvailabilityRender()
    return
  }

  if (nextResult.status === 'review') {
    availabilityState.reviewResults.push(nextResult)
    availabilityState.reviewCount = availabilityState.reviewResults.length
  } else {
    availabilityState.failedResults.push(nextResult)
    availabilityState.failedCount = availabilityState.failedResults.length
  }

  scheduleAvailabilityRender()
}

function renderAvailabilitySection() {
  if (!dom.availabilityAction) {
    return
  }

  synchronizeRedirectResults()
  renderAvailabilityScopeControls()
  const scopeMeta = getCurrentAvailabilityScopeMeta()
  renderAvailabilitySettingsControl()

  dom.availabilityPermissionBadge.className = `options-chip ${getModeBadgeTone()}`
  dom.availabilityPermissionBadge.textContent = getModeBadgeText()
  dom.availabilityPermissionCopy.textContent = getModeCopyText()

  dom.availabilityAction.disabled =
    availabilityState.running ||
    availabilityState.retestingSelection ||
    availabilityState.catalogLoading ||
    availabilityState.requestingPermission ||
    availabilityState.deleting
  setLoadingLabel(dom.availabilityAction, getAvailabilityActionText(), {
    busy: isAvailabilityPrimaryActionBusy(),
    wrapperClass: 'button-loading-label',
    loaderClass: 'button-dot-loader'
  })
  dom.availabilityPauseAction?.classList.toggle('hidden', !availabilityState.running)
  dom.availabilityStopAction?.classList.toggle('hidden', !availabilityState.running)

  if (dom.availabilityPauseAction) {
    dom.availabilityPauseAction.disabled =
      !availabilityState.running ||
      availabilityState.deleting ||
      availabilityState.stopRequested
    dom.availabilityPauseAction.textContent = availabilityState.paused ? '继续检测' : '暂停检测'
  }

  if (dom.availabilityStopAction) {
    dom.availabilityStopAction.disabled =
      !availabilityState.running ||
      availabilityState.deleting ||
      availabilityState.stopRequested
    setLoadingLabel(
      dom.availabilityStopAction,
      availabilityState.stopRequested ? '停止中…' : '停止本次检测',
      {
        busy: availabilityState.stopRequested,
        wrapperClass: 'button-loading-label',
        loaderClass: 'button-dot-loader'
      }
    )
  }

  const progressTotal = availabilityState.retestingSelection
    ? availabilityState.retestSelectionTotal
    : availabilityState.eligibleBookmarks
  const progressCompleted = availabilityState.retestingSelection
    ? availabilityState.retestSelectionCompleted
    : availabilityState.checkedBookmarks
  const progressLabel = progressTotal
    ? `${progressCompleted} / ${progressTotal}`
    : '未开始'
  const progressValue = progressTotal
    ? Math.round((progressCompleted / progressTotal) * 100)
    : 0

  const availabilityProgressLabel = availabilityState.retestingSelection
    ? `重测中 ${progressLabel}`
    : availabilityState.running
    ? availabilityState.stopRequested
      ? `正在停止 ${progressLabel}`
      : availabilityState.paused
        ? `已暂停 ${progressLabel}`
        : `检测中 ${progressLabel}`
    : availabilityState.lastCompletedAt
      ? availabilityState.lastRunOutcome === 'stopped'
        ? `已停止 ${progressLabel}`
        : `已完成 ${progressLabel}`
      : progressLabel
  setLoadingLabel(dom.availabilityProgressText, availabilityProgressLabel, {
    busy: isAvailabilityProgressBusy(),
    wrapperClass: 'status-loading-label',
    loaderClass: 'status-dot-loader'
  })
  dom.availabilityProgressBar.style.width = `${Math.max(0, Math.min(progressValue, 100))}%`
  dom.availabilityStatusCopy.textContent = getAvailabilityStatusCopy()
  renderAvailabilityDecisionSummary(scopeMeta, progressCompleted, progressTotal)
  renderAvailabilityFilterBar()

  if (dom.availabilityReviewTitle) {
    dom.availabilityReviewTitle.textContent = getAvailabilityPanelTitle('review')
  }
  if (dom.availabilityFailedTitle) {
    dom.availabilityFailedTitle.textContent = getAvailabilityPanelTitle('failed')
  }
  dom.availabilityReviewSubtitle.textContent = getAvailabilityReviewSubtitle()
  const panelCounts = getAvailabilityPanelCounts()
  dom.availabilityReviewCount.textContent = `${panelCounts.review} 条${getAvailabilityPanelCountLabel('review')}`
  dom.availabilityLastRun.textContent = availabilityState.lastCompletedAt
    ? `${availabilityState.lastRunOutcome === 'stopped' ? '最近一次停止于' : '最近一次完成于'} ${formatDateTime(availabilityState.lastCompletedAt)}`
    : '尚未执行检测'
  dom.availabilityErrorCount.textContent = `${panelCounts.failed} 条${getAvailabilityPanelCountLabel('failed')}`

  dom.deleteFailedBookmarks.disabled =
    isInteractionLocked() ||
    availabilityState.failedResults.length === 0
  dom.deleteFailedBookmarks.textContent = availabilityState.deleting ? '正在删除…' : '批量删除'

  renderActiveOptionsSection()
  renderScopeModal()
  renderMoveModal()
  renderDeleteModal()
  renderConfirmModal()
  renderAiModelModal()
  renderAiModelPickerModal()
}

function renderActiveOptionsSection() {
  const activeSection = normalizeSectionKey(getCurrentSectionKey())

  if (activeSection === 'availability') {
    renderAvailabilitySelectionGroup()
    renderReviewResults()
    renderFailedResults()
    return
  }

  if (activeSection === 'dashboard') {
    renderDashboardSection()
    notifyNewTabDashboardReady()
    return
  }

  if (activeSection === 'history') {
    renderAvailabilityHistory(historyCallbacks)
    return
  }

  if (activeSection === 'bookmark-history') {
    renderBookmarkAddHistory()
    return
  }

  if (activeSection === 'general') {
    renderAiNamingSection()
    renderShortcutSettingsSection()
    return
  }

  if (activeSection === 'ai') {
    renderAiNamingSection()
    return
  }

  if (activeSection === 'backup') {
    renderBookmarkTagDataCard()
    renderBackupRestoreSection()
    return
  }

  if (activeSection === 'redirects') {
    renderRedirectSection(redirectsCallbacks)
    return
  }

  if (activeSection === 'duplicates') {
    renderDuplicateSection()
    return
  }

  if (activeSection === 'folder-cleanup') {
    renderFolderCleanupSection(folderCleanupCallbacks)
    return
  }

  if (activeSection === 'ignore') {
    renderIgnoreSection()
    return
  }

  if (activeSection === 'recycle') {
    renderRecycleSection(recycleCallbacks)
  }
}

function renderAvailabilityDecisionSummary(scopeMeta, progressCompleted, progressTotal) {
  const decisionStats = getAvailabilityDecisionStats()

  if (dom.availabilityDecisionScope) {
    dom.availabilityDecisionScope.textContent = scopeMeta.label
  }
  if (dom.availabilityDecisionProgress) {
    dom.availabilityDecisionProgress.textContent = `${progressCompleted} / ${progressTotal || availabilityState.eligibleBookmarks}`
  }
  updateAvailabilityDurationDisplay()
  syncAvailabilityDurationTimer()
  if (dom.availabilityDecisionNew) {
    dom.availabilityDecisionNew.textContent = String(decisionStats.newCount)
  }
  if (dom.availabilityDecisionPersistent) {
    dom.availabilityDecisionPersistent.textContent = String(decisionStats.persistentCount)
  }
  if (dom.availabilityDecisionRecovered) {
    dom.availabilityDecisionRecovered.textContent = String(decisionStats.recoveredCount)
  }
  if (dom.availabilityDecisionIgnored) {
    dom.availabilityDecisionIgnored.textContent = String(availabilityState.ignoredCount)
  }
}

function renderAvailabilityFilterBar() {
  if (!dom.availabilityFilterBar) {
    return
  }

  const activeFilter = getAvailabilityFilter()
  const counts = getAvailabilityFilterCounts()
  const buttons = dom.availabilityFilterBar.querySelectorAll('[data-availability-filter]')

  buttons.forEach((button) => {
    const filter = String(button.getAttribute('data-availability-filter') || 'all').trim()
    const active = filter === activeFilter
    const label = getAvailabilityFilterLabel(filter)
    const count = counts[filter] ?? 0
    button.classList.toggle('active', active)
    button.setAttribute('aria-pressed', active ? 'true' : 'false')
    button.textContent = `${label} ${count}`
  })
}

function getAvailabilityFilter() {
  const filter = String(availabilityState.availabilityFilter || 'all').trim()
  return AVAILABILITY_FILTERS.has(filter) ? filter : 'all'
}

function getAvailabilityFilterLabel(filter) {
  return {
    all: '全部',
    failed: '高置信',
    review: '低置信 / 待确认',
    redirected: '重定向',
    new: '新增',
    persistent: '持续',
    recovered: '已恢复',
    ignored: '已忽略过滤'
  }[filter] || '全部'
}

function getAvailabilityFilterCounts() {
  const abnormalResults = getAllCurrentAbnormalResults()
  return {
    all: availabilityState.reviewResults.length + availabilityState.failedResults.length,
    failed: availabilityState.failedResults.length,
    review: availabilityState.reviewResults.length,
    redirected: availabilityState.redirectResults.length,
    new: abnormalResults.filter((result) => result.historyStatus === 'new').length,
    persistent: abnormalResults.filter((result) => result.historyStatus === 'persistent').length,
    recovered: managerState.historyRecoveredResults.length,
    ignored: managerState.suppressedResults.length
  }
}

function renderAvailabilitySettingsControl() {
  const settings = normalizeAvailabilityRunnerUserSettings(availabilityState.settings)
  availabilityState.settings = settings

  if (dom.availabilitySettingsTrigger) {
    dom.availabilitySettingsTrigger.disabled =
      availabilityState.running ||
      availabilityState.retestingSelection ||
      availabilityState.catalogLoading ||
      availabilityState.storageLoading
    dom.availabilitySettingsTrigger.setAttribute('aria-expanded', availabilityState.settingsOpen ? 'true' : 'false')
  }

  if (dom.availabilitySettingsPopover) {
    dom.availabilitySettingsPopover.classList.toggle('hidden', !availabilityState.settingsOpen)
  }

  if (availabilityState.settingsOpen) {
    if (dom.availabilityConcurrencyInput && dom.availabilityConcurrencyInput !== document.activeElement) {
      dom.availabilityConcurrencyInput.value = String(settings.concurrency)
    }
    if (dom.availabilityTimeoutInput && dom.availabilityTimeoutInput !== document.activeElement) {
      dom.availabilityTimeoutInput.value = String(Math.round(settings.navigationTimeoutMs / 1000))
    }
  }

  if (dom.availabilitySettingsStatus) {
    const tone = String(availabilityState.settingsStatusTone || 'muted')
    dom.availabilitySettingsStatus.className = `options-inline-status ${tone}`
    dom.availabilitySettingsStatus.textContent = availabilityState.settingsStatus || ''
  }
}

function openAvailabilitySettingsPopover() {
  if (
    availabilityState.running ||
    availabilityState.retestingSelection ||
    availabilityState.catalogLoading ||
    availabilityState.storageLoading
  ) {
    return
  }

  availabilityState.settingsOpen = true
  availabilityState.settingsStatus = ''
  renderAvailabilitySection()
  window.setTimeout(() => {
    dom.availabilityConcurrencyInput?.focus()
    dom.availabilityConcurrencyInput?.select?.()
  }, 0)
}

function closeAvailabilitySettingsPopover() {
  if (!availabilityState.settingsOpen) {
    return
  }

  availabilityState.settingsOpen = false
  availabilityState.settingsStatus = ''
  renderAvailabilitySection()
}

function toggleAvailabilitySettingsPopover() {
  if (availabilityState.settingsOpen) {
    closeAvailabilitySettingsPopover()
    return
  }

  openAvailabilitySettingsPopover()
}

function handleAvailabilitySettingsDocumentClick(event) {
  if (!availabilityState.settingsOpen) {
    return
  }

  const target = event.target
  if (!(target instanceof Node)) {
    return
  }

  if (
    dom.availabilitySettingsPopover?.contains(target) ||
    dom.availabilitySettingsTrigger?.contains(target)
  ) {
    return
  }

  closeAvailabilitySettingsPopover()
}

function readAvailabilitySettingsFromDom() {
  return normalizeAvailabilityRunnerUserSettings({
    concurrency: Number(dom.availabilityConcurrencyInput?.value),
    navigationTimeoutMs: Number(dom.availabilityTimeoutInput?.value) * 1000
  })
}

function syncAvailabilitySettingsDraftFromDom() {
  if (!availabilityState.settingsOpen) {
    return
  }

  availabilityState.settings = readAvailabilitySettingsFromDom()
  availabilityState.settingsStatus = '未保存'
  availabilityState.settingsStatusTone = 'muted'
  updateAvailabilityRunnerStatus()
  renderAvailabilitySettingsControl()
  dom.availabilityPermissionCopy.textContent = getModeCopyText()
}

async function saveAvailabilitySettingsFromDom() {
  const nextSettings = readAvailabilitySettingsFromDom()
  availabilityState.settings = nextSettings
  availabilityState.settingsStatus = '已保存'
  availabilityState.settingsStatusTone = 'success'

  try {
    await setLocalStorage({
      [STORAGE_KEYS.availabilitySettings]: nextSettings
    })
  } catch {
    availabilityState.settingsStatus = '保存失败'
    availabilityState.settingsStatusTone = 'warning'
  }

  updateAvailabilityRunnerStatus()
  renderAvailabilitySection()
}

async function resetAvailabilitySettings() {
  availabilityState.settings = getDefaultAvailabilityRunnerUserSettings()
  availabilityState.settingsStatus = '已恢复'
  availabilityState.settingsStatusTone = 'success'

  try {
    await setLocalStorage({
      [STORAGE_KEYS.availabilitySettings]: availabilityState.settings
    })
  } catch {
    availabilityState.settingsStatus = '保存失败'
    availabilityState.settingsStatusTone = 'warning'
  }

  updateAvailabilityRunnerStatus()
  renderAvailabilitySection()
}

function getAvailabilityDecisionStats() {
  const abnormalResults = getAllCurrentAbnormalResults()
  const fallbackNewCount = abnormalResults.filter((result) => result.historyStatus === 'new').length
  const fallbackPersistentCount = abnormalResults.filter((result) => result.historyStatus === 'persistent').length
  return {
    newCount: managerState.historyNewCount || fallbackNewCount,
    persistentCount: managerState.historyPersistentCount || fallbackPersistentCount,
    recoveredCount: managerState.historyRecoveredResults.length
  }
}

function getAllCurrentAbnormalResults() {
  return [
    ...availabilityState.reviewResults,
    ...availabilityState.failedResults,
    ...managerState.suppressedResults
  ]
}

function getAvailabilityDurationLabel() {
  const startedAt = Number(availabilityState.runStartedAt) || 0
  if ((availabilityState.running || availabilityState.retestingSelection) && startedAt) {
    return `用时 ${formatDuration(Date.now() - startedAt)}`
  }

  if (availabilityState.lastCompletedAt && startedAt && availabilityState.lastCompletedAt >= startedAt) {
    return `用时 ${formatDuration(availabilityState.lastCompletedAt - startedAt)}`
  }

  if (availabilityState.lastCompletedAt) {
    return formatDateTime(availabilityState.lastCompletedAt)
  }

  return '未开始'
}

function updateAvailabilityDurationDisplay() {
  if (dom.availabilityDecisionDuration) {
    dom.availabilityDecisionDuration.textContent = getAvailabilityDurationLabel()
  }
}

function syncAvailabilityDurationTimer() {
  const shouldTick = Boolean(
    Number(availabilityState.runStartedAt) &&
    (availabilityState.running || availabilityState.retestingSelection)
  )

  if (!shouldTick) {
    clearAvailabilityDurationTimer()
    return
  }

  if (availabilityDurationTimer) {
    return
  }

  availabilityDurationTimer = window.setInterval(updateAvailabilityDurationDisplay, 1000)
}

function clearAvailabilityDurationTimer() {
  if (!availabilityDurationTimer) {
    return
  }

  window.clearInterval(availabilityDurationTimer)
  availabilityDurationTimer = 0
}

function formatDuration(durationMs) {
  const totalSeconds = Math.max(0, Math.round((Number(durationMs) || 0) / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes) {
    return `${minutes} 分 ${seconds} 秒`
  }

  return `${seconds} 秒`
}

function getAvailabilityPanelCounts() {
  const filter = getAvailabilityFilter()
  if (filter === 'redirected') {
    return { review: 0, failed: availabilityState.redirectResults.length }
  }
  if (filter === 'recovered') {
    return { review: managerState.historyRecoveredResults.length, failed: 0 }
  }

  return {
    review: getAvailabilityPanelResults('review').length,
    failed: getAvailabilityPanelResults('failed').length
  }
}

function getAvailabilityPanelCountLabel(panel) {
  const filter = getAvailabilityFilter()
  if (filter === 'redirected') {
    return '重定向'
  }
  if (filter === 'recovered') {
    return '已恢复'
  }
  if (filter === 'ignored') {
    return '已忽略过滤'
  }
  if (filter === 'new') {
    return '新增异常'
  }
  if (filter === 'persistent') {
    return '持续异常'
  }
  if (filter === 'failed') {
    return '高置信异常'
  }
  if (filter === 'review') {
    return '待确认异常'
  }

  return panel === 'review' ? '低置信异常' : '异常'
}

function getAvailabilityPanelTitle(panel) {
  const filter = getAvailabilityFilter()
  if (filter === 'redirected' && panel === 'failed') {
    return '重定向'
  }
  if (filter === 'ignored' && panel === 'failed') {
    return '已忽略过滤'
  }
  if (filter === 'recovered' && panel === 'review') {
    return '已恢复'
  }
  if (filter === 'new') {
    return panel === 'review' ? '新增待确认' : '新增高置信'
  }
  if (filter === 'persistent') {
    return panel === 'review' ? '持续待确认' : '持续高置信'
  }
  if (filter === 'review' && panel === 'review') {
    return '低置信 / 待确认'
  }
  if (filter === 'failed' && panel === 'failed') {
    return '高置信异常'
  }

  return panel === 'review' ? '低置信异常' : '高置信异常'
}

function getAvailabilityReviewSubtitle() {
  const filter = getAvailabilityFilter()
  if (filter === 'recovered') {
    return '这些书签在上一次同范围检测中异常，本轮结果中未再次出现。'
  }
  if (filter === 'new') {
    return '这里只显示相较上一次同范围检测新增的低置信异常。'
  }
  if (filter === 'persistent') {
    return '这里只显示连续多轮出现的低置信异常。'
  }
  if (filter === 'review') {
    return '导航失败但证据不足以直接判定为高置信异常，建议人工确认。'
  }

  return availabilityState.currentRunProbeEnabled
    ? '导航失败但证据不足以直接判定为高置信异常，已归为低置信异常'
    : '当前轮未启用第二层网络探测，因此这些结果暂归为低置信异常'
}

function syncAiNamingSettingsDraftFromDom({ markDirty = false } = {}) {
  if (!dom.aiBaseUrl) {
    return aiNamingManagerState.settings
  }

  aiNamingManagerState.settings = normalizeAiNamingSettings({
    baseUrl: dom.aiBaseUrl.value,
    apiKey: dom.aiApiKey.value,
    model: aiNamingManagerState.settings.model,
    customModels: aiNamingManagerState.settings.customModels,
    fetchedModels: aiNamingManagerState.settings.fetchedModels,
    apiStyle: dom.aiApiStyle.value,
    timeoutMs: dom.aiTimeoutMs.value,
    batchSize: dom.aiBatchSize.value,
    autoSelectHighConfidence: true,
    allowRemoteParsing: Boolean(dom.aiAllowRemoteParser?.checked),
    autoAnalyzeBookmarks: Boolean(dom.aiAutoAnalyzeBookmarks?.checked),
    systemPrompt: ''
  })

  if (markDirty) {
    aiNamingState.settingsDirty = true
    resetAiNamingConnectivityState()
    renderAiNamingSection()
  }

  return aiNamingManagerState.settings
}

async function saveContentSnapshotSettingsFromDom({
  syncFullTextSearch = false
}: {
  syncFullTextSearch?: boolean
} = {}) {
  const previousSettings = contentSnapshotState.settings
  const saveFullText = readCheckboxSetting(dom.contentSnapshotFullText, previousSettings.saveFullText)
  const nextSettings = normalizeContentSnapshotSettings({
    ...previousSettings,
    enabled: readCheckboxSetting(dom.contentSnapshotEnabled, previousSettings.enabled),
    saveFullText,
    fullTextSearchEnabled: dom.contentSnapshotSearchFullText
      ? readCheckboxSetting(dom.contentSnapshotSearchFullText, previousSettings.fullTextSearchEnabled)
      : syncFullTextSearch ? saveFullText : previousSettings.fullTextSearchEnabled,
    localOnlyNoAiUpload: readCheckboxSetting(dom.contentSnapshotLocalOnly, previousSettings.localOnlyNoAiUpload)
  })

  try {
    contentSnapshotState.settings = await saveContentSnapshotSettings(nextSettings)
    contentSnapshotState.searchTextMap = await buildContentSnapshotSearchMapWithFullText(contentSnapshotState.index, {
      includeFullText: contentSnapshotState.settings.fullTextSearchEnabled,
      maxRecords: 1000
    }).catch(() => new Map<string, string>())
    contentSnapshotState.searchTextMapIncludesFullText = contentSnapshotState.settings.fullTextSearchEnabled
    contentSnapshotState.searchTextMapLoadingFullText = false
    resetContentSnapshotFullTextSearchMapRetry()
    contentSnapshotState.statusMessage = '网页内容索引设置已保存。'
  } catch (error) {
    contentSnapshotState.statusMessage =
      error instanceof Error ? `网页内容索引设置保存失败：${error.message}` : '网页内容索引设置保存失败。'
  } finally {
    renderAiNamingSection()
    renderDashboardSection()
  }
}

function readCheckboxSetting(element: typeof dom.contentSnapshotEnabled | undefined, fallback: boolean): boolean {
  return element ? Boolean(element.checked) : fallback
}

function renderContentSnapshotSettings() {
  const settings = contentSnapshotState.settings
  const snapshotRecords = Object.values(contentSnapshotState.index.records || {})
  const snapshotCount = snapshotRecords.length
  const fullTextCount = snapshotRecords.filter((record) => record.hasFullText).length
  if (dom.contentSnapshotEnabled) {
    dom.contentSnapshotEnabled.checked = Boolean(settings.enabled)
  }
  if (dom.contentSnapshotFullText) {
    dom.contentSnapshotFullText.checked = Boolean(settings.saveFullText)
    dom.contentSnapshotFullText.disabled = !settings.enabled
  }
  if (dom.contentSnapshotSearchFullText) {
    dom.contentSnapshotSearchFullText.checked = Boolean(settings.saveFullText)
    dom.contentSnapshotSearchFullText.disabled = !settings.enabled || !settings.saveFullText
  }
  if (dom.contentSnapshotLocalOnly) {
    dom.contentSnapshotLocalOnly.checked = Boolean(settings.localOnlyNoAiUpload)
    dom.contentSnapshotLocalOnly.disabled = !settings.enabled
  }
  if (dom.contentSnapshotStatus) {
    const modeCopy = settings.enabled
      ? buildContentSnapshotStatusCopy(settings.saveFullText, snapshotCount, fullTextCount)
      : '已关闭网页内容索引；不会为新增网页书签保存摘要或正文。'
    const aiRunCopy = buildContentSnapshotAiRunStatusCopy()
    dom.contentSnapshotStatus.textContent = contentSnapshotState.statusMessage ||
      aiRunCopy ||
      modeCopy
  }
}

function buildContentSnapshotStatusCopy(saveFullText: boolean, snapshotCount: number, fullTextCount: number): string {
  if (saveFullText) {
    return `已保存 ${snapshotCount} 条网页内容索引，其中 ${fullTextCount} 条包含正文；当前用于摘要和正文搜索。`
  }
  return `已保存 ${snapshotCount} 条网页内容索引；当前只保存摘要、标题和链接，不保存正文。`
}

function buildContentSnapshotAiRunStatusCopy(): string {
  const savedCount = Math.max(0, Number(contentSnapshotState.aiRunSavedCount) || 0)
  const failedCount = Math.max(0, Number(contentSnapshotState.aiRunFailedCount) || 0)
  if (!aiNamingState.running && !savedCount && !failedCount) {
    return ''
  }

  const totalCount = Object.keys(contentSnapshotState.index.records || {}).length
  if (failedCount) {
    return `书签智能分析已同步 ${savedCount} 条网页内容索引，${failedCount} 条保存失败；当前共 ${totalCount} 条索引。`
  }
  if (aiNamingState.running) {
    return `书签智能分析正在同步网页内容索引，本轮已保存 ${savedCount} 条；当前共 ${totalCount} 条索引。`
  }
  return `书签智能分析本轮已保存 ${savedCount} 条网页内容索引；当前共 ${totalCount} 条索引。`
}

function resetAiNamingConnectivityState() {
  aiNamingState.testingConnection = false
  aiNamingState.lastConnectivityTestAt = 0
  aiNamingState.lastConnectivityTestStatus = ''
  aiNamingState.lastConnectivityTestMessage = ''
}

function renderLoadingLabel(
  label,
  {
    variant = 'bar',
    wrapperClass = 'status-loading-label',
    loaderClass = 'status-dot-loader'
  }: {
    variant?: string
    wrapperClass?: string
    loaderClass?: string
  } = {}
) {
  const loaderVariant = variant === 'spiral' ? 'spiral' : 'bar'
  return `
    <span class="${wrapperClass}">
      ${renderDotMatrixLoader({ variant: loaderVariant, className: loaderClass })}
      <span>${escapeHtml(label)}</span>
    </span>
  `
}

function setLoadingLabel(
  element,
  label,
  {
    busy = false,
    variant = 'bar',
    wrapperClass,
    loaderClass
  }: {
    busy?: boolean
    variant?: string
    wrapperClass?: string
    loaderClass?: string
  } = {}
) {
  if (!element) {
    return
  }

  if (busy) {
    element.innerHTML = renderLoadingLabel(label, {
      variant,
      wrapperClass: wrapperClass || 'status-loading-label',
      loaderClass: loaderClass || 'status-dot-loader'
    })
    return
  }

  element.textContent = label
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.select()

  try {
    if (!document.execCommand('copy')) {
      throw new Error('copy command failed')
    }
  } finally {
    textarea.remove()
  }
}

async function hydrateShortcutCommands() {
  managerState.shortcutStatus = 'loading'
  managerState.shortcutStatusTone = 'muted'
  renderShortcutSettingsSection()

  try {
    managerState.shortcutCommands = await getAllExtensionCommands()
    managerState.shortcutStatus = 'ready'
    managerState.shortcutStatusTone = 'success'
  } catch (error) {
    managerState.shortcutCommands = []
    managerState.shortcutStatus = error instanceof Error ? error.message : '快捷键读取失败'
    managerState.shortcutStatusTone = 'warning'
  } finally {
    renderShortcutSettingsSection()
  }
}

function getAllExtensionCommands(): Promise<chrome.commands.Command[]> {
  return new Promise((resolve, reject) => {
    if (!chrome.commands?.getAll) {
      reject(new Error('快捷键未配置，可在 Chrome 扩展快捷键页设置。'))
      return
    }

    chrome.commands.getAll((commands) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(commands || [])
    })
  })
}

function renderShortcutSettingsSection() {
  if (!dom.shortcutList) {
    return
  }

  const commands = getOrderedShortcutCommands()
  if (dom.shortcutStatus) {
    const statusTone = String(managerState.shortcutStatusTone || 'muted')
    dom.shortcutStatus.className = `options-chip ${statusTone}`
    dom.shortcutStatus.textContent = getShortcutStatusLabel()
  }
  if (dom.shortcutStatusDetail) {
    const statusTone = String(managerState.shortcutStatusTone || 'muted')
    const statusDetail = getShortcutStatusDetail()
    dom.shortcutStatusDetail.className = `shortcut-status-detail ${statusTone}`
    dom.shortcutStatusDetail.textContent = statusDetail
    dom.shortcutStatusDetail.classList.toggle('hidden', !statusDetail)
  }

  if (!commands.length && managerState.shortcutStatus !== 'loading') {
    dom.shortcutList.innerHTML = '<div class="detect-empty">暂未读取到扩展快捷键命令。</div>'
  } else if (managerState.shortcutStatus === 'loading') {
    dom.shortcutList.innerHTML = '<div class="detect-empty">正在读取当前快捷键绑定…</div>'
  } else {
    dom.shortcutList.innerHTML = commands.map(renderShortcutCommandRow).join('')
  }

  if (dom.refreshShortcuts) {
    dom.refreshShortcuts.disabled = managerState.shortcutStatus === 'loading'
  }
}

function getOrderedShortcutCommands() {
  const commandMap = new Map(
    (managerState.shortcutCommands || []).map((command) => [String(command.name || ''), command])
  )

  return SHORTCUT_COMMAND_ORDER.map((name) => {
    const fallback = SHORTCUT_COMMAND_LABELS[name]
    const command = commandMap.get(name)
    return {
      name,
      description: command?.description || fallback?.detail || '',
      shortcut: command?.shortcut || '',
      title: fallback?.title || command?.description || name,
      detail: fallback?.detail || command?.description || name
    }
  })
}

function renderShortcutCommandRow(command) {
  const shortcut = String(command.shortcut || '').trim()
  const shortcutLabel = shortcut || '未配置'
  return `
    <div class="shortcut-row">
      <div class="shortcut-copy">
        <strong>${escapeHtml(command.title)}</strong>
        <span>${escapeHtml(command.detail)}</span>
      </div>
      <span class="shortcut-key ${shortcut ? '' : 'unassigned'}">${escapeHtml(shortcutLabel)}</span>
    </div>
  `
}

function getShortcutStatusLabel() {
  if (managerState.shortcutStatus === 'loading') {
    return '读取中'
  }

  if (managerState.shortcutStatus === 'ready') {
    const hasAssignedShortcut = (managerState.shortcutCommands || []).some((command) => {
      return Boolean(String(command.shortcut || '').trim())
    })
    if (!hasAssignedShortcut) {
      return '未配置'
    }
    return '已同步'
  }

  if (managerState.shortcutStatusTone === 'success') {
    return '已完成'
  }

  if (managerState.shortcutStatusTone === 'warning' || managerState.shortcutStatusTone === 'danger') {
    return '未配置'
  }

  return '需刷新'
}

function getShortcutStatusDetail() {
  const status = String(managerState.shortcutStatus || '').trim()
  if (!status || status === 'loading') {
    return ''
  }

  if (status === 'ready') {
    const hasAssignedShortcut = (managerState.shortcutCommands || []).some((command) => {
      return Boolean(String(command.shortcut || '').trim())
    })
    return hasAssignedShortcut ? '' : '快捷键未配置，可在 Chrome 扩展快捷键页设置。'
  }

  return status
}

async function openShortcutsSettingsPage() {
  try {
    await chrome.tabs.create({ url: SHORTCUTS_SETTINGS_URL })
    setShortcutStatus('已打开快捷键设置页。', 'success')
  } catch {
    await copyShortcutsUrl()
  }
}

async function copyShortcutsUrl() {
  try {
    await copyTextToClipboard(SHORTCUTS_SETTINGS_URL)
    setShortcutStatus('已复制快捷键设置地址。', 'success')
  } catch {
    setShortcutStatus(`请在地址栏打开 ${SHORTCUTS_SETTINGS_URL}`, 'warning')
  }
}

function setShortcutStatus(message, tone = 'success') {
  managerState.shortcutStatus = message
  managerState.shortcutStatusTone = tone
  renderShortcutSettingsSection()
}

function isAvailabilityPrimaryActionBusy() {
  return (
    availabilityState.catalogLoading ||
    availabilityState.requestingPermission ||
    availabilityState.retestingSelection ||
    availabilityState.stopRequested ||
    (availabilityState.running && !availabilityState.paused)
  )
}

function isAvailabilityProgressBusy() {
  return (
    availabilityState.retestingSelection ||
    availabilityState.requestingPermission ||
    availabilityState.catalogLoading ||
    availabilityState.stopRequested ||
    (availabilityState.running && !availabilityState.paused)
  )
}

function isAiProgressBusy() {
  return aiNamingState.running && !aiNamingState.paused
}

async function saveAiNamingSettingsFromDom({ validateRequired = true } = {}) {
  try {
    const settings = syncAiNamingSettingsDraftFromDom()
    if (validateRequired || settings.autoAnalyzeBookmarks) {
      validateAiNamingSettings(settings)
    }
    if (settings.autoAnalyzeBookmarks) {
      const providerGranted = await ensureAiNamingProviderPermission({
        interactive: true,
        baseUrl: settings.baseUrl
      })
      if (!providerGranted) {
        throw new Error('未授予 AI 服务地址访问权限，无法开启自动分析。')
      }
      if (settings.allowRemoteParsing) {
        const jinaGranted = await ensureJinaReaderPermission({ interactive: true })
        if (!jinaGranted) {
          throw new Error('未授予 Jina Reader 访问权限，无法开启远程解析自动分析。')
        }
      }
    }
    await saveAiNamingSettings(settings)
    aiNamingState.settingsDirty = false
    aiNamingState.lastError = ''
    await hydrateAiNamingPermissionState()
    return true
  } catch (error) {
    aiNamingState.lastError =
      error instanceof Error ? error.message : 'AI 渠道保存失败，请稍后重试。'
    return false
  } finally {
    renderAvailabilitySection()
  }
}

async function handleAutoAnalyzeBookmarksChange() {
  if (!dom.aiAutoAnalyzeBookmarks) {
    return
  }

  const previousSettings = normalizeAiNamingSettings(aiNamingManagerState.settings)
  const saved = await saveAiNamingSettingsFromDom({
    validateRequired: Boolean(dom.aiAutoAnalyzeBookmarks.checked)
  })
  if (!saved) {
    aiNamingManagerState.settings = previousSettings
    dom.aiAutoAnalyzeBookmarks.checked = Boolean(previousSettings.autoAnalyzeBookmarks)
    renderAvailabilitySection()
  }
}

async function handleInboxWorkflowSettingChange(
  source: 'autoMoveToRecommendedFolder' | 'tagOnlyNoAutoMove'
) {
  if (!dom.inboxAutoMoveToRecommendedFolder || !dom.inboxTagOnlyNoAutoMove) {
    return
  }

  const previousSettings = normalizeInboxSettings(managerState.inboxSettings)
  const tagOnlyNoAutoMove = Boolean(dom.inboxTagOnlyNoAutoMove.checked)
  const autoMoveToRecommendedFolder = source === 'tagOnlyNoAutoMove' && tagOnlyNoAutoMove
    ? false
    : Boolean(dom.inboxAutoMoveToRecommendedFolder.checked)

  try {
    managerState.inboxSettingsStatus = '正在保存 Inbox 设置…'
    renderAiNamingSection()
    managerState.inboxSettings = await saveInboxSettings({
      ...previousSettings,
      autoMoveToRecommendedFolder,
      tagOnlyNoAutoMove
    })
    managerState.inboxSettingsStatus = 'Inbox 设置已保存。'
  } catch (error) {
    managerState.inboxSettings = previousSettings
    managerState.inboxSettingsStatus = error instanceof Error
      ? error.message
      : 'Inbox 设置保存失败，请稍后重试。'
  } finally {
    renderAiNamingSection()
  }
}

async function handleAiRemoteParserChange() {
  if (!dom.aiAllowRemoteParser) {
    return
  }

  const nextEnabled = Boolean(dom.aiAllowRemoteParser.checked)

  try {
    aiNamingState.lastError = ''
    const settings = normalizeAiNamingSettings({
      ...syncAiNamingSettingsDraftFromDom(),
      allowRemoteParsing: nextEnabled
    })

    if (nextEnabled) {
      aiNamingState.requestingPermission = true
      renderAvailabilitySection()

      const granted = await ensureJinaReaderPermission({ interactive: true })
      if (!granted) {
        throw new Error('未授予 Jina Reader 访问权限，远程解析已保持关闭。')
      }

      settings.allowRemoteParsing = true
      aiNamingState.remoteParserPermissionGranted = true
    } else {
      settings.allowRemoteParsing = false
    }

    await saveAiNamingSettings(settings)
    aiNamingState.settingsDirty = false
    await hydrateAiNamingPermissionState()
  } catch (error) {
    const settings = normalizeAiNamingSettings({
      ...aiNamingManagerState.settings,
      allowRemoteParsing: false
    })
    await saveAiNamingSettings(settings).catch(() => {})
    aiNamingState.settingsDirty = false
    aiNamingState.remoteParserPermissionGranted = await hasJinaReaderPermission()
    aiNamingState.lastError =
      error instanceof Error ? error.message : 'Jina Reader 远程解析开启失败，请稍后重试。'
  } finally {
    aiNamingState.requestingPermission = false
    renderAvailabilitySection()
  }
}

async function handleAiConnectivityTest() {
  if (aiNamingState.testingConnection || aiNamingState.running || aiNamingState.applying) {
    return
  }

  try {
    const settings = syncAiNamingSettingsDraftFromDom()
    validateAiNamingSettings(settings)
    aiNamingState.lastError = ''
    resetAiNamingConnectivityState()
    aiNamingState.testingConnection = true
    renderAvailabilitySection()

    const permissionGranted = await ensureAiNamingProviderPermission({
      interactive: true,
      baseUrl: settings.baseUrl
    })
    if (!permissionGranted) {
      throw new Error('未授予 AI 服务地址访问权限，无法执行连通性测试。')
    }

    aiNamingState.lastConnectivityTestMessage = await requestAiNamingConnectivityTest(settings)
    aiNamingState.lastConnectivityTestStatus = 'success'
    aiNamingState.lastConnectivityTestAt = Date.now()
  } catch (error) {
    aiNamingState.lastConnectivityTestStatus = 'error'
    aiNamingState.lastConnectivityTestAt = Date.now()
    aiNamingState.lastConnectivityTestMessage = normalizeAiNamingConnectivityError(
      error,
      aiNamingManagerState.settings.timeoutMs
    )
  } finally {
    aiNamingState.testingConnection = false
    await hydrateAiNamingPermissionState()
    renderAvailabilitySection()
  }
}

function renderAiNamingSection() {
  if (!dom.aiAction) {
    return
  }

  const settings = aiNamingManagerState.settings
  if (dom.aiBaseUrl && dom.aiBaseUrl !== document.activeElement) {
    dom.aiBaseUrl.value = settings.baseUrl
  }
  if (dom.aiApiKey && dom.aiApiKey !== document.activeElement) {
    dom.aiApiKey.value = settings.apiKey
    dom.aiApiKey.type = managerState.aiRevealApiKey ? 'text' : 'password'
  }
  if (dom.aiRevealApiKey) {
    dom.aiRevealApiKey.checked = managerState.aiRevealApiKey
  }
  renderAiModelPickerTrigger(settings)
  renderAiFetchModelsStatus()
  if (managerState.aiModelPickerModalOpen) {
    renderAiModelPickerModal()
  }
  if (dom.aiApiStyle && dom.aiApiStyle !== document.activeElement) {
    dom.aiApiStyle.value = settings.apiStyle
  }
  if (dom.aiTimeoutMs && dom.aiTimeoutMs !== document.activeElement) {
    dom.aiTimeoutMs.value = String(settings.timeoutMs)
  }
  if (dom.aiBatchSize && dom.aiBatchSize !== document.activeElement) {
    dom.aiBatchSize.value = String(settings.batchSize)
  }
  if (dom.aiAllowRemoteParser) {
    dom.aiAllowRemoteParser.checked = Boolean(settings.allowRemoteParsing)
    dom.aiAllowRemoteParser.disabled =
      aiNamingState.running ||
      aiNamingState.applying ||
      aiNamingState.requestingPermission
  }
  if (dom.aiRemoteParserStatus) {
    const remoteParserEnabled = Boolean(settings.allowRemoteParsing)
    const remoteParserGranted = Boolean(aiNamingState.remoteParserPermissionGranted)
    const statusTone = remoteParserEnabled
      ? remoteParserGranted
        ? 'success'
        : 'warning'
      : 'muted'
    dom.aiRemoteParserStatus.className = `options-chip ai-inline-status ${statusTone}`
    dom.aiRemoteParserStatus.textContent = remoteParserEnabled
      ? remoteParserGranted
        ? '已授权'
        : '待授权'
      : '未开启'
  }
  if (dom.aiAutoAnalyzeBookmarks) {
    dom.aiAutoAnalyzeBookmarks.checked = Boolean(settings.autoAnalyzeBookmarks)
    dom.aiAutoAnalyzeBookmarks.disabled =
      aiNamingState.running ||
      aiNamingState.applying ||
      aiNamingState.testingConnection ||
      aiNamingState.requestingPermission
  }
  if (dom.aiAutoAnalyzeStatus) {
    const autoAnalyzeEnabled = Boolean(settings.autoAnalyzeBookmarks)
    dom.aiAutoAnalyzeStatus.className = `options-chip ai-inline-status ${autoAnalyzeEnabled ? 'success' : 'muted'}`
    dom.aiAutoAnalyzeStatus.textContent = autoAnalyzeEnabled ? '自动分析开启' : '未开启'
  }
  const inboxSettings = normalizeInboxSettings(managerState.inboxSettings)
  if (dom.inboxAutoMoveToRecommendedFolder) {
    dom.inboxAutoMoveToRecommendedFolder.checked = Boolean(inboxSettings.autoMoveToRecommendedFolder)
    dom.inboxAutoMoveToRecommendedFolder.disabled =
      Boolean(inboxSettings.tagOnlyNoAutoMove) ||
      aiNamingState.running ||
      aiNamingState.applying ||
      aiNamingState.requestingPermission
  }
  if (dom.inboxTagOnlyNoAutoMove) {
    dom.inboxTagOnlyNoAutoMove.checked = Boolean(inboxSettings.tagOnlyNoAutoMove)
    dom.inboxTagOnlyNoAutoMove.disabled =
      aiNamingState.running ||
      aiNamingState.applying ||
      aiNamingState.requestingPermission
  }
  if (dom.inboxWorkflowStatus) {
    const statusText = managerState.inboxSettingsStatus ||
      (inboxSettings.tagOnlyNoAutoMove
        ? '只生成标签'
        : inboxSettings.autoMoveToRecommendedFolder
          ? '自动移动开启'
          : '保留在 Inbox')
    const statusTone = managerState.inboxSettingsStatus
      ? managerState.inboxSettingsStatus.includes('失败') || managerState.inboxSettingsStatus.includes('Error')
        ? 'warning'
        : 'success'
      : inboxSettings.autoMoveToRecommendedFolder && !inboxSettings.tagOnlyNoAutoMove
        ? 'success'
        : 'muted'
    dom.inboxWorkflowStatus.className = `options-chip ai-inline-status ${statusTone}`
    dom.inboxWorkflowStatus.textContent = statusText
  }
  renderContentSnapshotSettings()

  const hasRequiredConfig = Boolean(settings.baseUrl && settings.apiKey && settings.model)
  const configTone = aiNamingState.settingsDirty
    ? 'warning'
    : hasRequiredConfig
      ? 'success'
      : 'muted'
  const configText = aiNamingState.settingsDirty
    ? '待保存'
    : hasRequiredConfig
      ? '已配置'
      : '待配置'
  const hasSavedApiKey = Boolean(settings.apiKey)
  const connectivityMeta = getAiNamingConnectivityMeta()

  if (dom.aiProviderNoticeText) {
    dom.aiProviderNoticeText.textContent = aiNamingState.settingsDirty
      ? '有未保存改动，保存后会用于所有 AI 功能。'
      : hasRequiredConfig
        ? '配置已保存，可继续获取模型或测试连接。'
        : '填写 API Key 后即可获取模型并测试连接。'
  }

  dom.aiConfigStatus.className = `options-chip ai-provider-status-chip ${configTone}`
  dom.aiConfigStatus.textContent = configText
  if (dom.aiSaveStatus) {
    dom.aiSaveStatus.className = `ai-provider-save-state ${configTone}`
    dom.aiSaveStatus.textContent = aiNamingState.settingsDirty
      ? '有未保存改动'
      : hasRequiredConfig
        ? '已保存'
        : '待配置'
  }
  if (dom.aiManageModels) {
    dom.aiManageModels.disabled = aiNamingState.running || aiNamingState.applying || aiNamingState.testingConnection
  }
  if (dom.aiFetchModels) {
    dom.aiFetchModels.disabled =
      aiNamingState.running ||
      aiNamingState.applying ||
      aiNamingState.testingConnection ||
      aiNamingState.fetchingModels ||
      aiNamingState.requestingPermission
    setLoadingLabel(dom.aiFetchModels, aiNamingState.fetchingModels ? '获取中' : '获取模型', {
      busy: aiNamingState.fetchingModels,
      wrapperClass: 'button-loading-label',
      loaderClass: 'button-dot-loader'
    })
  }
  if (dom.aiConnectivityCopy) {
    dom.aiConnectivityCopy.className = `ai-provider-connectivity ${connectivityMeta.tone}`
    dom.aiConnectivityCopy.classList.toggle('hidden', !connectivityMeta.visible)
    setLoadingLabel(dom.aiConnectivityCopy, connectivityMeta.copy, {
      busy: aiNamingState.testingConnection,
      wrapperClass: 'status-loading-label',
      loaderClass: 'status-dot-loader'
    })
  }
  if (dom.aiConfigLink) {
    dom.aiConfigLink.textContent = hasSavedApiKey ? '已配置 API KEY' : '配置 API Key'
    dom.aiConfigLink.classList.toggle('configured', hasSavedApiKey)
    dom.aiConfigLink.setAttribute(
      'aria-label',
      hasSavedApiKey ? '已配置 API KEY，前往通用设置查看或修改' : '配置 API Key'
    )
  }

  dom.aiRunBadge.className = `options-chip ${getAiNamingBadgeTone()}`
  dom.aiRunBadge.textContent = getAiNamingBadgeText()
  dom.aiStatusCopy.textContent = getAiNamingStatusCopy()
  dom.aiProgressCopy.textContent = getAiNamingProgressCopy()

  const progressLabel = aiNamingState.eligibleBookmarks
    ? `${aiNamingState.checkedBookmarks} / ${aiNamingState.eligibleBookmarks}`
    : '未开始'
  const progressValue = aiNamingState.eligibleBookmarks
    ? Math.round((aiNamingState.checkedBookmarks / aiNamingState.eligibleBookmarks) * 100)
    : 0

  const aiProgressLabel = aiNamingState.running
    ? aiNamingState.stopRequested
      ? `正在停止 ${progressLabel}`
      : aiNamingState.paused
        ? `已暂停 ${progressLabel}`
        : `生成中 ${progressLabel}`
    : aiNamingState.lastCompletedAt
      ? `已完成 ${progressLabel}`
      : progressLabel
  setLoadingLabel(dom.aiProgressText, aiProgressLabel, {
    busy: isAiProgressBusy(),
    wrapperClass: 'status-loading-label',
    loaderClass: 'status-dot-loader'
  })
  dom.aiProgressBar.style.width = `${Math.max(0, Math.min(progressValue, 100))}%`

  renderBookmarkTagDataCard()

  dom.aiAction.disabled =
    availabilityState.catalogLoading ||
    !hasRequiredConfig ||
    aiNamingState.testingConnection ||
    aiNamingState.running ||
    aiNamingState.applying ||
    aiNamingState.requestingPermission
  dom.aiAction.textContent = aiNamingState.lastCompletedAt ? '重新分析并生成建议' : '开始分析并生成建议'
  if (dom.aiPauseAction) {
    dom.aiPauseAction.classList.toggle('hidden', !aiNamingState.running)
    dom.aiPauseAction.disabled = !aiNamingState.running || aiNamingState.stopRequested
    dom.aiPauseAction.textContent = aiNamingState.paused ? '继续生成' : '暂停生成'
  }
  dom.aiStopAction.classList.toggle('hidden', !aiNamingState.running)
  dom.aiStopAction.disabled = !aiNamingState.running || aiNamingState.stopRequested
  dom.aiStopAction.textContent = aiNamingState.stopRequested ? '停止中…' : '停止本次生成'
  const showSaveSettingsButton = aiNamingState.settingsDirty || !hasRequiredConfig
  dom.aiSaveSettings.classList.toggle('hidden', !showSaveSettingsButton)
  dom.aiSaveSettings.classList.remove('secondary')
  dom.aiSaveSettings.disabled = aiNamingState.running || aiNamingState.applying || aiNamingState.testingConnection
  dom.aiSaveSettings.textContent = '保存设置'
  if (dom.aiTestConnection) {
    dom.aiTestConnection.classList.toggle('secondary', showSaveSettingsButton)
    dom.aiTestConnection.disabled =
      !hasRequiredConfig ||
      aiNamingState.testingConnection ||
      aiNamingState.running ||
      aiNamingState.applying ||
      aiNamingState.requestingPermission
    setLoadingLabel(dom.aiTestConnection, aiNamingState.testingConnection ? '测试中' : '测试连接', {
      busy: aiNamingState.testingConnection,
      wrapperClass: 'button-loading-label',
      loaderClass: 'button-dot-loader'
    })
  }

  dom.aiEligible.textContent = String(aiNamingState.eligibleBookmarks)
  dom.aiSuggested.textContent = String(aiNamingState.suggestedCount)
  dom.aiManualReview.textContent = String(aiNamingState.manualReviewCount)
  dom.aiUnchanged.textContent = String(aiNamingState.unchangedCount)
  dom.aiHighConfidence.textContent = String(aiNamingState.highConfidenceCount)
  dom.aiMediumConfidence.textContent = String(aiNamingState.mediumConfidenceCount)
  dom.aiLowConfidence.textContent = String(aiNamingState.lowConfidenceCount)
  dom.aiFailed.textContent = String(aiNamingState.failedCount)
  updateAiNamingDurationDisplay()
  syncAiNamingDurationTimer()

  const selectableResults = getSelectableAiNamingResults()
  const highConfidenceResults = selectableResults.filter((result) => result.confidence === 'high')
  const selectedResults = getSelectedAiNamingResults()
  const selectedMovableResults = selectedResults.filter((result) => canMoveAiNamingResultToSuggestedFolder(result))
  dom.aiSelectionGroup.classList.toggle('hidden', selectableResults.length === 0)
  dom.aiSelectionCount.textContent = `${selectedResults.length} 条已选择`
  dom.aiSelectAll.disabled =
    aiNamingState.running ||
    aiNamingState.applying ||
    selectableResults.length === 0
  dom.aiSelectHighConfidence.disabled =
    aiNamingState.running ||
    aiNamingState.applying ||
    highConfidenceResults.length === 0
  dom.aiClearSelection.disabled = selectedResults.length === 0
  dom.aiApplySelection.disabled = aiNamingState.running || aiNamingState.applying || selectedResults.length === 0
  if (dom.aiMoveSelectionToSuggested) {
    const pending = aiNamingState.pendingMoveSelection && selectedMovableResults.length > 0
    dom.aiMoveSelectionToSuggested.disabled =
      aiNamingState.running ||
      aiNamingState.applying ||
      selectedMovableResults.length === 0
    dom.aiMoveSelectionToSuggested.classList.toggle('confirm', pending)
    dom.aiMoveSelectionToSuggested.innerHTML = pending
      ? '<span class="double-confirm-icon" aria-hidden="true">✓✓</span> 确认移动'
      : '移动至推荐文件夹'
    dom.aiMoveSelectionToSuggested.title = selectedMovableResults.length
      ? pending
        ? `再次点击，移动 ${selectedMovableResults.length} 条书签到各自推荐文件夹`
        : `移动 ${selectedMovableResults.length} 条书签到各自推荐文件夹`
      : '所选结果没有可用的推荐文件夹'
  }

  const visibleAiResults = getVisibleAiNamingResults()
  dom.aiResultCount.textContent = visibleAiResults.length === aiNamingState.results.length
    ? `${aiNamingState.results.length} 条结果`
    : `${visibleAiResults.length} / ${aiNamingState.results.length} 条结果`
  dom.aiResultsSubtitle.textContent = aiNamingState.lastCompletedAt
    ? `最近一次完成于 ${formatDateTime(aiNamingState.lastCompletedAt)}。建议改名 ${aiNamingState.suggestedCount} 条，待确认 ${aiNamingState.manualReviewCount} 条，失败 ${aiNamingState.failedCount} 条。网页标签与 AI 建议每次都会重新生成。`
    : '在通用设置中配置 AI 渠道后，开始分析并生成建议，这里会展示当前标题、建议标题、标签、置信度与原因。'

  renderAiResultsFilterControls()

  renderAiNamingResults()
}

function getAiNamingDurationLabel() {
  const startedAt = Number(aiNamingState.runStartedAt) || 0

  if ((aiNamingState.running || aiNamingState.applying) && startedAt) {
    return `用时 ${formatDuration(Date.now() - startedAt)}`
  }

  if (aiNamingState.lastCompletedAt && startedAt && aiNamingState.lastCompletedAt >= startedAt) {
    return `用时 ${formatDuration(aiNamingState.lastCompletedAt - startedAt)}`
  }

  if (aiNamingState.lastCompletedAt) {
    return formatDateTime(aiNamingState.lastCompletedAt)
  }

  return '未开始'
}

function updateAiNamingDurationDisplay() {
  if (dom.aiDecisionStatus) {
    dom.aiDecisionStatus.textContent = getAiNamingDurationLabel()
  }
}

function syncAiNamingDurationTimer() {
  const shouldTick = Boolean(
    Number(aiNamingState.runStartedAt) &&
    (aiNamingState.running || aiNamingState.applying)
  )

  if (!shouldTick) {
    clearAiNamingDurationTimer()
    return
  }

  if (aiNamingDurationTimer) {
    return
  }

  aiNamingDurationTimer = window.setInterval(updateAiNamingDurationDisplay, 1000)
}

function clearAiNamingDurationTimer() {
  if (!aiNamingDurationTimer) {
    return
  }

  window.clearInterval(aiNamingDurationTimer)
  aiNamingDurationTimer = 0
}

function renderBookmarkTagDataCard() {
  if (!dom.aiTagDataCount) {
    return
  }

  const index = normalizeBookmarkTagIndex(aiNamingState.tagIndex)
  const records = Object.values(index.records)
  const latestUpdatedAt = records.length
    ? records.reduce((latest, record) => {
        return Math.max(latest, Number(record.updatedAt) || 0)
      }, 0)
    : 0
  dom.aiTagDataCount.textContent = `${records.length} 条记录`
  dom.aiTagDataUpdated.textContent = latestUpdatedAt
    ? `最近更新于 ${formatDateTime(latestUpdatedAt)}。`
    : '尚未保存标签数据。'
  if (dom.aiTagDataStatus) {
    dom.aiTagDataStatus.textContent = aiNamingState.tagDataStatus || ''
  }
  if (dom.aiTagExport) {
    dom.aiTagExport.disabled = records.length === 0 || aiNamingState.running || aiNamingState.applying
  }
  if (dom.aiTagImport) {
    dom.aiTagImport.disabled = aiNamingState.running || aiNamingState.applying
  }
  if (dom.aiTagClear) {
    dom.aiTagClear.disabled = records.length === 0 || aiNamingState.running || aiNamingState.applying
  }
}

async function handleBookmarkTagExport() {
  try {
    const bookmarks = await getCurrentBookmarksForTagData()
    const index = await loadBookmarkTagIndex()
    aiNamingState.tagIndex = index
    const payload = buildBookmarkTagExport(index, bookmarks)
    if (!payload.records.length) {
      aiNamingState.tagDataStatus = '没有可导出的标签记录。'
      renderAiNamingSection()
      return
    }

    downloadJsonFile(
      `curator-bookmark-tags-${new Date().toISOString().slice(0, 10)}.json`,
      payload
    )
    aiNamingState.tagDataStatus = `已导出 ${payload.records.length} 条标签记录。`
    renderActiveOptionsSection()
  } catch (error) {
    aiNamingState.tagDataStatus = error instanceof Error ? error.message : '标签数据导出失败。'
    renderActiveOptionsSection()
  }
}

async function handleBookmarkTagImport(event) {
  const input = event?.target
  const file = input?.files?.[0]
  if (!file) {
    return
  }

  try {
    const rawText = await readTextFile(file)
    const payload = JSON.parse(rawText)
    const bookmarks = await getCurrentBookmarksForTagData()
    const currentIndex = await loadBookmarkTagIndex()
    const result = mergeBookmarkTagImport(currentIndex, payload, bookmarks)
    const savedIndex = await saveBookmarkTagIndex(result.index)
    aiNamingState.tagIndex = savedIndex
    aiNamingState.tagDataStatus =
      `导入完成：新增 ${result.added}，覆盖 ${result.overwritten}，跳过 ${result.skipped}，无法匹配 ${result.unmatched}。`
  } catch (error) {
    aiNamingState.tagDataStatus = error instanceof Error ? error.message : '标签数据导入失败。'
  } finally {
    if (input) {
      input.value = ''
    }
    renderActiveOptionsSection()
  }
}

async function handleBookmarkTagClear() {
  const confirmed = await requestConfirmation({
    title: '清空标签数据？',
    copy: '只会清空本地标签数据，包括 AI 生成内容和手动维护标签；不会删除 Chrome 书签、AI 渠道设置或 API Key。建议先导出备份。',
    confirmLabel: '清空标签数据',
    cancelLabel: '取消',
    tone: 'danger',
    label: 'Clear'
  })

  if (!confirmed) {
    return
  }

  try {
    await clearBookmarkTagIndex()
    aiNamingState.tagIndex = normalizeBookmarkTagIndex(null)
    aiNamingState.tagDataStatus = '已清空标签数据。'
    renderActiveOptionsSection()
  } catch (error) {
    aiNamingState.tagDataStatus = error instanceof Error ? error.message : '标签数据清空失败。'
    renderActiveOptionsSection()
  }
}

function renderBackupRestoreSection() {
  if (!dom.backupPreview) {
    return
  }

  const hasBackup = Boolean(backupRestoreState.backup && backupRestoreState.preview)
  const busy = Boolean(backupRestoreState.restoring)
  if (dom.backupStatus) {
    dom.backupStatus.textContent = backupRestoreState.status || ''
  }
  if (dom.backupExport) {
    dom.backupExport.disabled = busy
  }
  if (dom.backupImport) {
    dom.backupImport.disabled = busy
  }
  if (dom.backupRestoreTags) {
    dom.backupRestoreTags.disabled = !hasBackup || busy
  }
  if (dom.backupRestoreNewTab) {
    dom.backupRestoreNewTab.disabled = !hasBackup || busy
  }
  if (dom.backupRestoreSafeFull) {
    dom.backupRestoreSafeFull.disabled = !hasBackup || busy
  }

  if (!backupRestoreState.preview) {
    dom.backupPreview.innerHTML = '<div class="detect-empty">请选择备份文件进行预览。</div>'
    return
  }

  const preview = backupRestoreState.preview
  const warnings = preview.warnings.length
    ? `<ul class="detect-result-evidence">${preview.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>`
    : '<p class="detect-result-detail">未发现阻塞恢复的问题。</p>'
  dom.backupPreview.innerHTML = `
    <article class="detect-result-card">
      <div class="detect-result-copy">
        <strong>${escapeHtml(preview.fileName || '已导入备份文件')}</strong>
        <div class="detect-result-detail">导出时间：${escapeHtml(preview.exportedAt || '未知')} · 扩展版本：${escapeHtml(preview.extensionVersion || '未知')}</div>
        <div class="detect-result-detail">书签 URL：${preview.counts.bookmarkUrls}，当前缺失：${preview.counts.missingBookmarkUrls}；标签记录：${preview.counts.tagRecords}，可匹配：${preview.counts.tagMatched}，无法匹配：${preview.counts.tagUnmatched}</div>
        <div class="detect-result-detail">回收站：${preview.counts.recycleEntries}；忽略规则：${preview.counts.ignoreRules}；重定向历史：${preview.counts.redirectEntries}；新标签页配置：${preview.counts.newTabSections}</div>
        ${warnings}
      </div>
    </article>
  `
}

async function handleFullBackupExport() {
  backupRestoreState.status = '正在生成完整备份...'
  renderBackupRestoreSection()

  try {
    const now = Date.now()
    const payload = await createCuratorBackupFile('manual', now)
    downloadJsonFile(getBackupFileName(now), payload)
    backupRestoreState.status = '完整备份已导出，文件不包含 API Key。'
  } catch (error) {
    backupRestoreState.status = error instanceof Error ? error.message : '完整备份导出失败。'
  } finally {
    renderBackupRestoreSection()
  }
}

async function handleFullBackupImport(event) {
  const input = event?.target
  const file = input?.files?.[0]
  if (!file) {
    return
  }

  backupRestoreState.status = '正在读取备份文件...'
  backupRestoreState.backup = null
  backupRestoreState.preview = null
  renderBackupRestoreSection()

  try {
    const rawText = await readTextFile(file)
    const backup = parseCuratorBackupFile(JSON.parse(rawText))
    const preview = await buildBackupRestorePreview(backup, file.name)
    backupRestoreState.fileName = file.name
    backupRestoreState.backup = backup
    backupRestoreState.preview = preview
    backupRestoreState.status = '已生成恢复预览，请选择恢复范围。'
  } catch (error) {
    backupRestoreState.status = error instanceof Error ? error.message : '备份文件导入失败。'
  } finally {
    if (input) {
      input.value = ''
    }
    renderBackupRestoreSection()
  }
}

async function handleFullBackupRestore(mode: BackupRestoreMode) {
  if (!backupRestoreState.backup || backupRestoreState.restoring) {
    return
  }

  const modeLabel = mode === 'tagsOnly'
    ? '只恢复标签数据'
    : mode === 'newTabOnly'
      ? '只恢复新标签页设置'
      : '恢复全部可安全恢复的数据'
  const confirmed = await requestConfirmation({
    title: `${modeLabel}？`,
    copy: mode === 'safeFull'
      ? '恢复前会自动创建本地备份；缺失书签只会复制到新的恢复文件夹，不会替换整个 Chrome 书签树，也不会恢复 API Key。'
      : mode === 'newTabOnly'
        ? '恢复会写入书签来源、布局、搜索、时间和背景设置；不会恢复背景媒体缓存，也不会恢复 API Key。'
        : '恢复会写入对应的本地扩展数据，不会恢复 API Key。',
    confirmLabel: modeLabel,
    cancelLabel: '取消',
    tone: mode === 'safeFull' ? 'warning' : 'danger',
    label: 'Restore'
  })
  if (!confirmed) {
    return
  }

  backupRestoreState.restoring = true
  backupRestoreState.status = '正在恢复...'
  renderBackupRestoreSection()

  try {
    await createAutoBackupBeforeDangerousOperation({
      kind: 'restore',
      source: 'options',
      reason: `恢复备份：${modeLabel}`
    })
    const result = await restoreCuratorBackup(backupRestoreState.backup, mode)
    await hydrateAvailabilityCatalog({ preserveResults: true })
    aiNamingState.tagIndex = await loadBookmarkTagIndex()
    backupRestoreState.status =
      `恢复完成：标签 ${result.restored.tags} 条，新标签页配置 ${result.restored.newTabSections} 项，本地数据 ${result.restored.storageSections} 项，复制缺失书签 ${result.restored.copiedBookmarks} 条；无法匹配标签 ${result.unmatchedTags} 条。`
  } catch (error) {
    backupRestoreState.status = error instanceof Error ? error.message : '备份恢复失败。'
  } finally {
    backupRestoreState.restoring = false
    renderBackupRestoreSection()
  }
}

async function getCurrentBookmarksForTagData() {
  if (availabilityState.allBookmarks.length) {
    return availabilityState.allBookmarks
  }

  const tree = await getBookmarkTree()
  const rootNode = Array.isArray(tree) ? tree[0] : tree
  return extractBookmarkData(rootNode).bookmarks
}

function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result || '')))
    reader.addEventListener('error', () => reject(new Error('标签数据文件读取失败。')))
    reader.readAsText(file)
  })
}

function downloadJsonFile(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function getAiNamingModelOptions(settings = aiNamingManagerState.settings) {
  const options = []
  const seen = new Set()
  const appendOption = (value) => {
    const normalizedValue = String(value || '').trim()
    if (!normalizedValue) {
      return
    }

    const dedupeKey = normalizeText(normalizedValue)
    if (!dedupeKey || seen.has(dedupeKey)) {
      return
    }

    seen.add(dedupeKey)
    options.push(normalizedValue)
  }

  AI_NAMING_PRESET_MODELS.forEach((model) => appendOption(model))
  settings.customModels.forEach((model) => appendOption(model))
  settings.fetchedModels.forEach((model) => appendOption(model))
  appendOption(settings.model)

  return options
}

function handleAiRevealApiKeyChange(event) {
  managerState.aiRevealApiKey = Boolean(event?.target?.checked)
  renderAiNamingSection()
}

function renderAiModelPickerTrigger(settings = aiNamingManagerState.settings) {
  if (dom.aiModelPickerLabel) {
    dom.aiModelPickerLabel.textContent = settings.model || AI_NAMING_DEFAULT_MODEL
  }
  if (dom.aiModelPickerTrigger) {
    dom.aiModelPickerTrigger.disabled =
      aiNamingState.running || aiNamingState.applying || aiNamingState.testingConnection
  }
}

function renderAiFetchModelsStatus() {
  if (!dom.aiFetchModelsStatus) {
    return
  }

  let tone = ''
  let copy = ''

  if (aiNamingState.fetchingModels) {
    tone = 'muted'
    copy = '正在获取模型列表…'
  } else if (aiNamingState.lastFetchModelsError) {
    tone = 'danger'
    copy = `获取失败：${aiNamingState.lastFetchModelsError}`
  } else if (aiNamingState.lastFetchModelsAt) {
    tone = 'success'
    const timeLabel = formatDateTime(aiNamingState.lastFetchModelsAt)
    copy = `已获取 ${aiNamingState.lastFetchModelsCount} 个模型 · ${timeLabel}`
  }

  dom.aiFetchModelsStatus.className = `ai-provider-connectivity ${tone || 'muted'}`
  dom.aiFetchModelsStatus.classList.toggle('hidden', !copy)
  setLoadingLabel(dom.aiFetchModelsStatus, copy, {
    busy: aiNamingState.fetchingModels,
    wrapperClass: 'status-loading-label',
    loaderClass: 'status-dot-loader'
  })
}

function openAiModelPickerModal() {
  if (aiNamingState.running || aiNamingState.applying) {
    return
  }

  managerState.aiModelPickerModalOpen = true
  managerState.aiModelPickerSearchQuery = ''
  managerState.aiModelPickerActiveId = aiNamingManagerState.settings.model || AI_NAMING_DEFAULT_MODEL
  renderAiModelPickerModal()

  window.setTimeout(() => {
    if (dom.aiModelPickerSearchInput) {
      dom.aiModelPickerSearchInput.value = ''
      dom.aiModelPickerSearchInput.focus()
    }
  }, 0)
}

function closeAiModelPickerModal() {
  managerState.aiModelPickerModalOpen = false
  managerState.aiModelPickerSearchQuery = ''
  managerState.aiModelPickerActiveId = ''
  renderAiModelPickerModal()
}

function renderAiModelPickerModal() {
  if (!dom.aiModelPickerModalBackdrop) {
    return
  }

  setManagedModalHidden(
    'ai-model-picker',
    dom.aiModelPickerModalBackdrop,
    managerState.aiModelPickerModalOpen,
    dom.aiModelPickerSearchInput
  )

  if (!managerState.aiModelPickerModalOpen) {
    return
  }

  const settings = aiNamingManagerState.settings
  const allModels = getAiNamingModelOptions(settings)
  const fetchedCount = settings.fetchedModels.length
  const lastFetchedAt = aiNamingState.lastFetchModelsAt
  const lastFetchedLabel = lastFetchedAt ? formatDateTime(lastFetchedAt) : ''

  if (dom.aiModelPickerModalCopy) {
    let copy = '输入关键字筛选，点击卡片即可选中。可点击「获取模型」从 API 拉取最新列表。'
    if (aiNamingState.fetchingModels) {
      copy = '正在从 API 拉取模型列表…'
    } else if (aiNamingState.lastFetchModelsError) {
      copy = `上次拉取失败：${aiNamingState.lastFetchModelsError}`
    } else if (fetchedCount > 0) {
      copy = lastFetchedLabel
        ? `已从 API 拉取 ${fetchedCount} 个模型（${lastFetchedLabel}）。支持搜索预设 + 自定义 + 已拉取模型。`
        : `已从 API 拉取 ${fetchedCount} 个模型。支持搜索预设 + 自定义 + 已拉取模型。`
    }
    setLoadingLabel(dom.aiModelPickerModalCopy, copy, {
      busy: aiNamingState.fetchingModels,
      wrapperClass: 'status-loading-label',
      loaderClass: 'status-dot-loader'
    })
  }

  if (dom.aiModelPickerSearchInput && dom.aiModelPickerSearchInput !== document.activeElement) {
    dom.aiModelPickerSearchInput.value = managerState.aiModelPickerSearchQuery
  }

  if (dom.aiModelPickerFetchButton) {
    dom.aiModelPickerFetchButton.disabled =
      aiNamingState.fetchingModels ||
      aiNamingState.running ||
      aiNamingState.applying ||
      aiNamingState.testingConnection ||
      aiNamingState.requestingPermission
    setLoadingLabel(dom.aiModelPickerFetchButton, aiNamingState.fetchingModels ? '拉取中' : '获取模型', {
      busy: aiNamingState.fetchingModels,
      wrapperClass: 'button-loading-label',
      loaderClass: 'button-dot-loader'
    })
  }
  if (dom.aiModelPickerManageButton) {
    dom.aiModelPickerManageButton.disabled =
      aiNamingState.running || aiNamingState.applying || aiNamingState.testingConnection
  }

  if (!dom.aiModelPickerResults) {
    return
  }

  const normalizedQuery = normalizeText(managerState.aiModelPickerSearchQuery)
  const filteredModels = normalizedQuery
    ? allModels.filter((model) => normalizeText(model).includes(normalizedQuery))
    : allModels

  if (!filteredModels.length) {
    managerState.aiModelPickerActiveId = ''
    dom.aiModelPickerResults.innerHTML = normalizedQuery
      ? '<div class="detect-empty">没有匹配的模型。</div>'
      : '<div class="detect-empty">尚未加载模型，可点击下方「获取模型」从 API 拉取。</div>'
    return
  }

  resolveAiModelPickerActiveId(filteredModels, settings)
  dom.aiModelPickerResults.innerHTML = filteredModels
    .map((model) => buildAiModelPickerCard(model, settings))
    .join('')
}

function buildAiModelPickerCard(model, settings = aiNamingManagerState.settings) {
  const isCurrent = String(model) === String(settings.model || '')
  const isActive = String(model) === String(managerState.aiModelPickerActiveId || '')
  const isFetched = settings.fetchedModels.some((value) => value === model)
  const isCustom = settings.customModels.some((value) => value === model)
  const isPreset = AI_NAMING_PRESET_MODELS.some((value) => value === model)
  const tags = []
  if (isCurrent) {
    tags.push('当前')
  }
  if (isPreset) {
    tags.push('预设')
  }
  if (isCustom) {
    tags.push('自定义')
  }
  if (isFetched) {
    tags.push('已拉取')
  }
  const tagsHtml = tags.length
    ? `<span class="ai-model-card-tags">${tags.map((tag) => `<span class="ai-model-card-tag">${escapeHtml(tag)}</span>`).join('')}</span>`
    : ''

  return `
    <button
      class="scope-folder-card ai-model-card ${isCurrent ? 'current' : ''}"
      type="button"
      role="option"
      aria-selected="${isCurrent ? 'true' : 'false'}"
      data-ai-model-id="${escapeAttr(model)}"
      tabindex="${isActive ? '0' : '-1'}"
      title="${escapeAttr(model)}"
    >
      <div class="scope-folder-head">
        <strong>${escapeHtml(model)}</strong>
      </div>
      ${tagsHtml}
    </button>
  `
}

function resolveAiModelPickerActiveId(models, settings = aiNamingManagerState.settings) {
  if (!models.length) {
    managerState.aiModelPickerActiveId = ''
    return ''
  }

  const activeId = models.some((model) => model === managerState.aiModelPickerActiveId)
    ? managerState.aiModelPickerActiveId
    : models.some((model) => model === settings.model)
      ? settings.model
      : models[0] || ''
  managerState.aiModelPickerActiveId = activeId
  return activeId
}

function getAiModelPickerOptionButtons() {
  return [...dom.aiModelPickerResults.querySelectorAll<HTMLButtonElement>('[data-ai-model-id]')]
}

function handleAiModelPickerSearchKeydown(event) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
    return
  }

  if (!getAiModelPickerOptionButtons().length) {
    return
  }

  event.preventDefault()
  focusAiModelPickerOption(event.key === 'ArrowDown' ? 'first' : 'last')
}

function handleAiModelPickerResultsKeydown(event) {
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
    dom.aiModelPickerSearchInput?.focus()
    return
  }

  if (event.key === 'Home') {
    focusAiModelPickerOption('first')
  } else if (event.key === 'End') {
    focusAiModelPickerOption('last')
  } else {
    focusAiModelPickerOption(event.key === 'ArrowDown' ? 1 : -1)
  }
}

function handleAiModelPickerResultsFocus(event) {
  const target = event.target
  if (!(target instanceof HTMLElement) || !target.dataset.aiModelId) {
    return
  }

  managerState.aiModelPickerActiveId = target.dataset.aiModelId
  syncAiModelPickerTabStops(managerState.aiModelPickerActiveId)
}

function syncAiModelPickerTabStops(activeId) {
  for (const button of getAiModelPickerOptionButtons()) {
    button.tabIndex = button.dataset.aiModelId === activeId ? 0 : -1
  }
}

function focusAiModelPickerOptionById(modelId) {
  let targetButton = null
  for (const button of getAiModelPickerOptionButtons()) {
    const isTarget = button.dataset.aiModelId === modelId
    button.tabIndex = isTarget ? 0 : -1
    if (isTarget) {
      targetButton = button
    }
  }

  if (!targetButton) {
    return false
  }

  managerState.aiModelPickerActiveId = modelId
  targetButton.focus()
  return true
}

function focusAiModelPickerOption(direction) {
  const buttons = getAiModelPickerOptionButtons()
  if (!buttons.length) {
    return
  }

  const currentIndex = buttons.findIndex((button) => button === document.activeElement)
  let nextIndex = managerState.aiModelPickerActiveId
    ? buttons.findIndex((button) => button.dataset.aiModelId === managerState.aiModelPickerActiveId)
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
  const modelId = String(button?.dataset.aiModelId || '')
  if (modelId) {
    focusAiModelPickerOptionById(modelId)
  }
}

function handleAiModelPickerResultsClick(event) {
  if (aiNamingState.running || aiNamingState.applying) {
    return
  }

  const targetButton = event.target.closest('[data-ai-model-id]')
  if (!targetButton) {
    return
  }

  const modelId = String(targetButton.getAttribute('data-ai-model-id') || '').trim()
  if (!modelId) {
    return
  }

  managerState.aiModelPickerActiveId = modelId
  aiNamingManagerState.settings = normalizeAiNamingSettings({
    ...aiNamingManagerState.settings,
    model: modelId
  })
  syncAiNamingSettingsDraftFromDom({ markDirty: true })
  closeAiModelPickerModal()
  renderAiNamingSection()
}

function getAiModelsEndpoint(settings) {
  const baseUrl = String(settings.baseUrl || '').replace(/\/+$/, '')
  const suffix = AI_NAMING_MODELS_ENDPOINT_SUFFIX
  return baseUrl.endsWith(`/${suffix}`) ? baseUrl : `${baseUrl}/${suffix}`
}

function extractFetchedModelIds(payload) {
  if (!payload || typeof payload !== 'object') {
    return []
  }

  const candidates = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.models)
      ? payload.models
      : Array.isArray(payload)
        ? payload
        : []

  return candidates
    .map((entry) => {
      if (!entry) {
        return ''
      }
      if (typeof entry === 'string') {
        return entry
      }
      return String(entry.id || entry.name || '').trim()
    })
    .filter(Boolean)
}

async function handleFetchAiModels() {
  if (aiNamingState.fetchingModels || aiNamingState.running || aiNamingState.applying) {
    return
  }

  syncAiNamingSettingsDraftFromDom()
  const settings = aiNamingManagerState.settings
  const baseUrl = String(settings.baseUrl || '').trim()
  const apiKey = String(settings.apiKey || '').trim()

  if (!baseUrl || !apiKey) {
    aiNamingState.lastFetchModelsError = !baseUrl
      ? '请先填写 Base URL。'
      : '请先填写 API Key。'
    aiNamingState.lastFetchModelsAt = 0
    aiNamingState.lastFetchModelsCount = 0
    renderAiFetchModelsStatus()
    if (managerState.aiModelPickerModalOpen) {
      renderAiModelPickerModal()
    }
    return
  }

  const permissionGranted = await ensureAiNamingProviderPermission({
    interactive: true,
    baseUrl
  })
  if (!permissionGranted) {
    aiNamingState.lastFetchModelsError = '未授权该 Origin，无法访问该 API。'
    aiNamingState.lastFetchModelsAt = 0
    aiNamingState.lastFetchModelsCount = 0
    renderAiFetchModelsStatus()
    if (managerState.aiModelPickerModalOpen) {
      renderAiModelPickerModal()
    }
    return
  }

  aiNamingState.fetchingModels = true
  aiNamingState.lastFetchModelsError = ''
  renderAiFetchModelsStatus()
  if (managerState.aiModelPickerModalOpen) {
    renderAiModelPickerModal()
  }

  try {
    const url = getAiModelsEndpoint(settings)
    const response = await fetchWithRequestTimeout(
      url,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json'
        }
      },
      settings.timeoutMs
    )

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      const detail = text ? `：${text.slice(0, 200)}` : ''
      throw new Error(`HTTP ${response.status}${detail}`)
    }

    const payload = await response.json().catch(() => null)
    const ids = extractFetchedModelIds(payload)
    if (!ids.length) {
      throw new Error('接口未返回任何模型 ID。')
    }

    const normalizedIds = normalizeAiNamingFetchedModels(ids)
    aiNamingManagerState.settings = normalizeAiNamingSettings({
      ...aiNamingManagerState.settings,
      fetchedModels: normalizedIds
    })
    await saveAiNamingSettings(aiNamingManagerState.settings)
    aiNamingState.lastFetchModelsAt = Date.now()
    aiNamingState.lastFetchModelsCount = normalizedIds.length
    aiNamingState.lastFetchModelsError = ''
  } catch (error) {
    aiNamingState.lastFetchModelsError =
      error instanceof Error ? error.message : '拉取模型列表失败，请稍后重试。'
    aiNamingState.lastFetchModelsAt = 0
    aiNamingState.lastFetchModelsCount = 0
  } finally {
    aiNamingState.fetchingModels = false
    renderAiFetchModelsStatus()
    renderAiNamingSection()
    if (managerState.aiModelPickerModalOpen) {
      renderAiModelPickerModal()
    }
  }
}

function openAiModelModal() {
  if (aiNamingState.running || aiNamingState.applying) {
    return
  }

  managerState.aiModelModalOpen = true
  renderAiModelModal()

  window.setTimeout(() => {
    dom.aiCustomModelsInput?.focus()
  }, 0)
}

function closeAiModelModal() {
  managerState.aiModelModalOpen = false
  renderAiModelModal()
}

function renderAiModelModal() {
  if (!dom.aiModelModalBackdrop) {
    return
  }

  setManagedModalHidden(
    'ai-model',
    dom.aiModelModalBackdrop,
    managerState.aiModelModalOpen,
    dom.aiCustomModelsInput
  )

  if (!managerState.aiModelModalOpen) {
    return
  }

  if (dom.aiCustomModelsInput && dom.aiCustomModelsInput !== document.activeElement) {
    dom.aiCustomModelsInput.value = formatAiCustomModelsInput(aiNamingManagerState.settings.customModels)
  }
}

function formatAiCustomModelsInput(models) {
  return normalizeAiNamingCustomModels(models).join('\n')
}

async function saveAiModelModalSettings() {
  const customModels = normalizeAiNamingCustomModels(dom.aiCustomModelsInput?.value)
  aiNamingManagerState.settings = normalizeAiNamingSettings({
    ...aiNamingManagerState.settings,
    customModels
  })
  aiNamingState.settingsDirty = true
  resetAiNamingConnectivityState()
  closeAiModelModal()
  renderAvailabilitySection()
}

function renderAiResultsFilterControls() {
  if (dom.aiFilterStatus && dom.aiFilterStatus !== document.activeElement) {
    dom.aiFilterStatus.value = aiNamingState.filterStatus
  }
  if (dom.aiFilterConfidence && dom.aiFilterConfidence !== document.activeElement) {
    dom.aiFilterConfidence.value = aiNamingState.filterConfidence
  }
  if (dom.aiFilterQuery && dom.aiFilterQuery !== document.activeElement) {
    dom.aiFilterQuery.value = aiNamingState.filterQuery
  }
  if (dom.aiClearFilters) {
    dom.aiClearFilters.disabled = !hasActiveAiResultsFilter()
  }
}

function handleAiResultsFilterChange() {
  aiNamingState.filterStatus = String(dom.aiFilterStatus?.value || 'all')
  aiNamingState.filterConfidence = String(dom.aiFilterConfidence?.value || 'all')
  aiNamingState.filterQuery = String(dom.aiFilterQuery?.value || '').trim()
  resetResultsPage('ai-results')
  renderAvailabilitySection()
}

function clearAiResultsFilters() {
  aiNamingState.filterStatus = 'all'
  aiNamingState.filterConfidence = 'all'
  aiNamingState.filterQuery = ''
  resetResultsPage('ai-results')
  renderAvailabilitySection()
}

function hasActiveAiResultsFilter() {
  return (
    aiNamingState.filterStatus !== 'all' ||
    aiNamingState.filterConfidence !== 'all' ||
    Boolean(aiNamingState.filterQuery)
  )
}

function renderAiNamingResults() {
  if (!dom.aiResults) {
    return
  }

  const visibleResults = getVisibleAiNamingResults()
  const visibleResultIds = new Set(visibleResults.map((result) => String(result.id)))
  aiNamingState.expandedTagResultIds = new Set(
    [...aiNamingState.expandedTagResultIds].filter((id) => visibleResultIds.has(String(id)))
  )

  if (aiNamingState.running && !aiNamingState.results.length) {
    dom.aiResults.innerHTML = '<div class="detect-empty">正在读取网页内容、生成标签并生成命名建议，请稍候。</div>'
    renderResultsPagination(dom.aiResultsPagination, 'ai-results', 0, 'AI 结果')
    return
  }

  if (!aiNamingState.results.length) {
    dom.aiResults.innerHTML = aiNamingState.lastError
      ? `<div class="detect-empty">${escapeHtml(aiNamingState.lastError)}</div>`
      : aiNamingState.lastCompletedAt
        ? '<div class="detect-empty">最近一次生成已完成，当前没有待处理的书签智能分析结果。</div>'
        : '<div class="detect-empty">保存 AI 渠道并开始分析后，这里会展示书签智能分析结果。</div>'
    renderResultsPagination(dom.aiResultsPagination, 'ai-results', 0, 'AI 结果')
    return
  }

  if (!visibleResults.length) {
    dom.aiResults.innerHTML = '<div class="detect-empty">当前筛选条件下没有匹配的书签智能分析结果。</div>'
    renderResultsPagination(dom.aiResultsPagination, 'ai-results', 0, 'AI 结果')
    return
  }

  const pageResults = getPaginatedResults('ai-results', visibleResults)
  dom.aiResults.innerHTML = pageResults
    .map((result) => buildAiNamingResultCard(result))
    .join('')
  renderResultsPagination(dom.aiResultsPagination, 'ai-results', visibleResults.length, 'AI 结果')
  syncAiResultTagOverflow()
}

function syncAiResultTagOverflow() {
  if (!dom.aiResults) {
    return
  }

  window.requestAnimationFrame(() => {
    dom.aiResults.querySelectorAll<HTMLElement>('[data-ai-tag-shell]').forEach((shell) => {
      const resultId = String(shell.getAttribute('data-ai-tag-shell') || '')
      const list = shell.querySelector<HTMLElement>('[data-ai-tag-list]')
      const toggle = shell.querySelector<HTMLElement>('[data-ai-toggle-tags]')
      if (!resultId || !list || !toggle) {
        return
      }

      const expanded = aiNamingState.expandedTagResultIds.has(resultId)
      shell.classList.toggle('expanded', expanded)
      toggle.textContent = expanded ? '收起标签' : '展开标签'
      toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false')
      const hasOverflow = list.scrollHeight > list.clientHeight + 1
      toggle.classList.toggle('hidden', !expanded && !hasOverflow)
    })
  })
}

function getVisibleAiNamingResults() {
  const normalizedQuery = normalizeText(aiNamingState.filterQuery)
  return aiNamingState.results.filter((result) => {
    if (aiNamingState.filterStatus === 'changed' && !isLargeAiTitleChange(result)) {
      return false
    }

    if (
      aiNamingState.filterStatus !== 'all' &&
      aiNamingState.filterStatus !== 'changed' &&
      result.status !== aiNamingState.filterStatus
    ) {
      return false
    }

    if (
      aiNamingState.filterConfidence !== 'all' &&
      result.confidence !== aiNamingState.filterConfidence
    ) {
      return false
    }

    if (normalizedQuery) {
      const haystack = normalizeText([
        result.path,
        result.domain,
        result.url,
        result.currentTitle,
        result.suggestedTitle,
        result.summary,
        result.contentType,
        result.suggestedFolder,
        ...(Array.isArray(result.topics) ? result.topics : []),
        ...(Array.isArray(result.tags) ? result.tags : []),
        ...(Array.isArray(result.aliases) ? result.aliases : [])
      ].join(' '))
      if (!haystack.includes(normalizedQuery)) {
        return false
      }
    }

    return true
  })
}

function isLargeAiTitleChange(result) {
  if (result.status !== 'suggested') {
    return false
  }

  const currentTitle = normalizeText(result.currentTitle)
  const suggestedTitle = normalizeText(result.suggestedTitle)
  if (!currentTitle || !suggestedTitle || currentTitle === suggestedTitle) {
    return false
  }

  const maxLength = Math.max(currentTitle.length, suggestedTitle.length, 1)
  const lengthDelta = Math.abs(currentTitle.length - suggestedTitle.length)
  const distanceRatio = levenshteinDistance(currentTitle, suggestedTitle) / maxLength
  return lengthDelta >= 16 || distanceRatio >= 0.55
}

function levenshteinDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_value, index) => index)
  const current = Array.from({ length: right.length + 1 }, () => 0)

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + cost
      )
    }

    for (let index = 0; index < previous.length; index += 1) {
      previous[index] = current[index]
    }
  }

  return previous[right.length]
}

function getAiNamingResultActionLabel(action, result) {
  const title = String(result?.currentTitle || result?.suggestedTitle || displayUrl(result?.url) || '未命名书签')
    .replace(/\s+/g, ' ')
    .trim()
  const safeTitle = title.length > 48 ? `${title.slice(0, 47).trim()}…` : title

  return `${action}：${safeTitle || '未命名书签'}`
}

function buildAiNamingResultCard(result) {
  const selectable = result.status === 'suggested'
  const interactionLocked = aiNamingState.running || aiNamingState.applying
  const isSelected = aiNamingState.selectedResultIds.has(String(result.id))
  const canMoveToSuggestedFolder = canMoveAiNamingResultToSuggestedFolder(result)
  const pendingMove = aiNamingState.pendingMoveResultIds.has(String(result.id))
  const selectionLabel = getAiNamingResultActionLabel(
    selectable ? '选择书签智能分析建议' : '书签智能分析建议不可直接应用',
    result
  )
  const openLabel = getAiNamingResultActionLabel('打开书签页面', result)
  const applyLabel = getAiNamingResultActionLabel('应用书签智能分析建议', result)
  const moveLabel = getAiNamingResultActionLabel('移动至推荐文件夹', result)
  const badgeTone = result.status === 'failed'
    ? 'danger'
    : result.confidence === 'high'
      ? 'success'
      : result.confidence === 'medium'
        ? 'warning'
        : 'muted'
  const statusLabel = getAiNamingStatusLabel(result)
  const topics = Array.isArray(result.topics) ? result.topics : []
  const tags = Array.isArray(result.tags) ? result.tags : []
  const aliases = Array.isArray(result.aliases) ? result.aliases : []
  const tagsExpanded = aiNamingState.expandedTagResultIds.has(String(result.id))
  const detailRows = [
    result.summary ? `摘要：${result.summary}` : '',
    result.contentType || topics.length
      ? `类型：${result.contentType || '未分类'}${topics.length ? ` · 主题：${topics.join(' / ')}` : ''}`
      : '',
    tags.length ? `标签：${tags.join(' / ')}` : '',
    aliases.length ? `别名：${aliases.join(' / ')}` : '',
    result.extractionStatus ? `内容来源：${getAiExtractionLabel(result.extractionStatus, result.extractionSource)}` : '',
    result.reason || result.detail || ''
  ].filter(Boolean)
  const moveButtonMarkup = canMoveToSuggestedFolder
    ? `
        <button
          class="detect-result-action ai-move-recommended-action double-confirm-action ${pendingMove ? 'confirm' : ''}"
          type="button"
          data-ai-move-recommended="${escapeAttr(result.id)}"
          title="${escapeAttr(pendingMove ? `再次点击，移动到 ${result.suggestedFolder}` : `移动到 ${result.suggestedFolder}`)}"
          aria-label="${escapeAttr(moveLabel)}"
          ${interactionLocked ? 'disabled' : ''}
        >
          ${pendingMove ? '<span class="double-confirm-icon" aria-hidden="true">✓✓</span> 确认移动' : '移动至推荐文件夹'}
        </button>
      `
    : ''
  const suggestedFolderMarkup = result.suggestedFolder
    ? `
        <div class="ai-result-folder-suggestion">
          <div class="ai-result-folder-copy">
            <span>推荐文件夹</span>
            <strong>${escapeHtml(result.suggestedFolder)}</strong>
          </div>
          ${moveButtonMarkup}
        </div>
      `
    : ''
  const tagPreviewMarkup = tags.length
    ? `
        <div class="ai-result-tag-shell ${tagsExpanded ? 'expanded' : ''}" data-ai-tag-shell="${escapeAttr(result.id)}">
          <div class="ai-result-tag-list" aria-label="标签预览" data-ai-tag-list="${escapeAttr(result.id)}">
            ${tags.map((tag) => `<span class="ai-result-tag">${escapeHtml(tag)}</span>`).join('')}
          </div>
          <button
            class="ai-result-tag-toggle hidden"
            type="button"
            data-ai-toggle-tags="${escapeAttr(result.id)}"
            aria-expanded="${tagsExpanded ? 'true' : 'false'}"
          >${tagsExpanded ? '收起标签' : '展开标签'}</button>
        </div>
      `
    : ''
  const detailMarkup = detailRows.length
    ? `
        <details class="ai-result-details">
          <summary>分析细节</summary>
          <div class="ai-result-detail-list">
            ${detailRows.map((detail) => `<p class="detect-result-detail">${escapeHtml(detail)}</p>`).join('')}
          </div>
        </details>
      `
    : ''
  return `
    <article class="detect-result-card ${isSelected ? 'selected' : ''}">
      <div class="detect-result-head">
        <div class="detect-result-head-left">
          <label class="detect-result-check">
            <input
              type="checkbox"
              data-ai-select="${escapeAttr(result.id)}"
              aria-label="${escapeAttr(selectionLabel)}"
              ${selectable && isSelected ? 'checked' : ''}
              ${selectable && !interactionLocked ? '' : 'disabled'}
            >
            <span>${selectable ? '选择' : '不可直接应用'}</span>
          </label>
          <span class="options-chip ${badgeTone}">${escapeHtml(statusLabel)}</span>
          <span class="options-chip muted">${escapeHtml(getAiNamingConfidenceLabel(result.confidence))}</span>
          ${Number.isFinite(Number(result.confidenceScore)) ? `<span class="options-chip muted">${escapeHtml(Math.round(Number(result.confidenceScore) * 100))}%</span>` : ''}
        </div>
        <div class="detect-result-actions">
          <a class="detect-result-open" href="${escapeAttr(result.url)}" target="_blank" rel="noreferrer noopener" aria-label="${escapeAttr(openLabel)}">打开页面</a>
          ${selectable ? `<button class="detect-result-action" type="button" data-ai-apply="${escapeAttr(result.id)}" aria-label="${escapeAttr(applyLabel)}" ${interactionLocked ? 'disabled' : ''}>应用建议</button>` : ''}
        </div>
      </div>
      <div class="detect-result-copy ai-result-copy">
        <strong>${escapeHtml(result.currentTitle || '未命名书签')}</strong>
        <p class="ai-result-suggested">${escapeHtml(result.suggestedTitle || '未生成建议标题')}</p>
        <div class="ai-result-meta">
          <span>${escapeHtml(displayUrl(result.url))}</span>
          <span>${escapeHtml(result.path || '未归档路径')}</span>
        </div>
        ${suggestedFolderMarkup}
        ${tagPreviewMarkup}
        ${detailMarkup}
      </div>
    </article>
  `
}

function getSelectableAiNamingResults() {
  return getVisibleAiNamingResults().filter((result) => result.status === 'suggested')
}

function canMoveAiNamingResultToSuggestedFolder(result) {
  if (!result?.id) {
    return false
  }

  const suggestedFolder = normalizeAiSuggestedFolderPath(result.suggestedFolder)
  if (!suggestedFolder) {
    return false
  }

  const matchedFolder = findAiSuggestedFolder(result.suggestedFolder, result.parentId)
  if (matchedFolder) {
    return String(matchedFolder.id) !== String(result.parentId || '')
  }

  const currentPath = normalizeAiSuggestedFolderPath(result.path)
  return normalizeText(suggestedFolder) !== normalizeText(currentPath)
}

function splitAiSuggestedFolderPath(value) {
  return String(value || '')
    .split(/\s*(?:->|\/|>|›|»|\\|·|•|→|➜)\s*/g)
    .map((segment) => normalizeAiResultText(segment, 60))
    .filter(Boolean)
    .slice(0, 5)
}

function normalizeAiSuggestedFolderPath(value) {
  const segments = splitAiSuggestedFolderPath(value)
  if (!segments.length) {
    return ''
  }

  const strippedSegments = stripKnownRootFolderSegment(segments)
  return (strippedSegments.length ? strippedSegments : segments).join(' / ')
}

function normalizeAiFolderFullPath(value) {
  return splitAiSuggestedFolderPath(value).join(' / ')
}

function stripKnownRootFolderSegment(segments) {
  if (!segments.length || !getKnownRootFolderByTitle(segments[0])) {
    return segments.slice()
  }

  return segments.slice(1)
}

function getKnownRootFolderByTitle(title) {
  const normalizedTitle = normalizeText(title)
  if (!normalizedTitle) {
    return null
  }

  const rootFolders = (availabilityState.allFolders || []).filter((folder) => {
    return Number(folder.depth) <= 1 && String(folder.id) !== ROOT_ID
  })
  const matchedRoot = rootFolders.find((folder) => {
    return normalizeText(folder.title) === normalizedTitle || normalizeText(folder.path) === normalizedTitle
  })

  if (matchedRoot) {
    return matchedRoot
  }

  const commonRootLabels = new Set([
    '书签栏',
    '书签列',
    '收藏夹栏',
    'bookmarks bar',
    'bookmark bar',
    'favorites bar',
    '其他书签',
    'other bookmarks',
    '移动设备书签',
    'mobile bookmarks'
  ])
  if (!commonRootLabels.has(normalizedTitle)) {
    return null
  }

  return (
    availabilityState.folderMap.get(BOOKMARKS_BAR_ID) ||
    rootFolders.find((folder) => normalizeText(folder.title) === normalizedTitle) ||
    null
  )
}

function getAiFolderComparableKey(value) {
  return normalizeText(normalizeAiSuggestedFolderPath(value))
}

function getAiFolderFullKey(value) {
  return normalizeText(normalizeAiFolderFullPath(value))
}

function findAiSuggestedFolder(value, currentParentId = '') {
  const segments = splitAiSuggestedFolderPath(value)
  if (!segments.length) {
    return null
  }

  const fullKey = getAiFolderFullKey(value)
  const comparableKey = getAiFolderComparableKey(value)
  const targetTitleKey = normalizeText(stripKnownRootFolderSegment(segments).at(-1) || segments.at(-1) || '')
  const folders = (availabilityState.allFolders || []).filter((folder) => String(folder.id) !== ROOT_ID)
  const matchGroups = [
    folders.filter((folder) => getAiFolderFullKey(folder.path) === fullKey),
    folders.filter((folder) => comparableKey && getAiFolderComparableKey(folder.path) === comparableKey),
    segments.length === 1 || stripKnownRootFolderSegment(segments).length === 1
      ? folders.filter((folder) => normalizeText(folder.title) === targetTitleKey)
      : []
  ]

  for (const matches of matchGroups) {
    if (!matches.length) {
      continue
    }

    const currentFolder = matches.find((folder) => String(folder.id) === String(currentParentId || ''))
    if (currentFolder) {
      return currentFolder
    }

    return matches.slice().sort(compareAiSuggestedFolderCandidates)[0]
  }

  return null
}

function compareAiSuggestedFolderCandidates(left, right) {
  const leftBookmarkCount = Number(left.bookmarkCount) || 0
  const rightBookmarkCount = Number(right.bookmarkCount) || 0
  return (
    Number(left.depth || 0) - Number(right.depth || 0) ||
    rightBookmarkCount - leftBookmarkCount ||
    compareByPathTitle(left, right)
  )
}

function getAiFolderCacheKey(value) {
  return getAiFolderFullKey(value) || getAiFolderComparableKey(value)
}

function cacheAiSuggestedFolder(folderCache, pathValue, folderId) {
  const fullKey = getAiFolderFullKey(pathValue)
  const comparableKey = getAiFolderComparableKey(pathValue)
  if (fullKey) {
    folderCache.set(fullKey, String(folderId))
  }
  if (comparableKey) {
    folderCache.set(comparableKey, String(folderId))
  }
}

function getAiFolderCreationRoot(rawSegments) {
  const rootMatch = getKnownRootFolderByTitle(rawSegments[0])
  if (rootMatch) {
    return {
      rootId: String(rootMatch.id),
      rootTitle: String(rootMatch.title || ''),
      segments: rawSegments.slice(1)
    }
  }

  const bookmarksBar = availabilityState.folderMap.get(BOOKMARKS_BAR_ID)
  return {
    rootId: BOOKMARKS_BAR_ID,
    rootTitle: String(bookmarksBar?.title || '书签栏'),
    segments: rawSegments.slice()
  }
}

async function ensureAiSuggestedFolderPath(value, folderCache = new Map()) {
  const rawSegments = splitAiSuggestedFolderPath(value)
  if (!rawSegments.length) {
    throw new Error('推荐文件夹为空。')
  }

  const cacheKey = getAiFolderCacheKey(value)
  if (cacheKey && folderCache.has(cacheKey)) {
    return folderCache.get(cacheKey)
  }

  const existingFolder = findAiSuggestedFolder(value)
  if (existingFolder) {
    cacheAiSuggestedFolder(folderCache, value, existingFolder.id)
    return String(existingFolder.id)
  }

  const creationRoot = getAiFolderCreationRoot(rawSegments)
  let parentId = creationRoot.rootId
  let pathSegments = creationRoot.rootTitle ? [creationRoot.rootTitle] : []

  if (!creationRoot.segments.length) {
    cacheAiSuggestedFolder(folderCache, value, parentId)
    return parentId
  }

  for (const segment of creationRoot.segments) {
    pathSegments = [...pathSegments, segment]
    const prefixPath = pathSegments.join(' / ')
    const prefixKey = getAiFolderCacheKey(prefixPath)
    if (prefixKey && folderCache.has(prefixKey)) {
      parentId = String(folderCache.get(prefixKey))
      continue
    }

    const existingPrefix = findAiSuggestedFolder(prefixPath)
    if (existingPrefix) {
      parentId = String(existingPrefix.id)
      cacheAiSuggestedFolder(folderCache, prefixPath, parentId)
      continue
    }

    const createdFolder = await createBookmark({
      parentId,
      title: segment
    })
    parentId = String(createdFolder.id)
    cacheAiSuggestedFolder(folderCache, prefixPath, parentId)
  }

  cacheAiSuggestedFolder(folderCache, value, parentId)
  return parentId
}

function getSelectedAiNamingResults() {
  const resultMap = new Map(
    getSelectableAiNamingResults().map((result) => [String(result.id), result])
  )

  return [...aiNamingState.selectedResultIds]
    .map((bookmarkId) => resultMap.get(String(bookmarkId)))
    .filter(Boolean)
}

function clearAiNamingSelection() {
  aiNamingState.selectedResultIds.clear()
  aiNamingState.pendingMoveSelection = false
  renderAvailabilitySection()
}

function selectAllAiNamingResults() {
  aiNamingState.pendingMoveSelection = false
  aiNamingState.selectedResultIds = new Set(
    getSelectableAiNamingResults().map((result) => String(result.id))
  )
  renderAvailabilitySection()
}

function selectHighConfidenceAiResults() {
  aiNamingState.pendingMoveSelection = false
  aiNamingState.selectedResultIds = new Set(
    getSelectableAiNamingResults()
      .filter((result) => result.confidence === 'high')
      .map((result) => String(result.id))
  )
  renderAvailabilitySection()
}

function handleAiResultsChange(event) {
  if (aiNamingState.running || aiNamingState.applying) {
    return
  }

  const selectionInput = event.target.closest('input[data-ai-select]')
  if (!selectionInput) {
    return
  }

  const bookmarkId = String(selectionInput.getAttribute('data-ai-select') || '').trim()
  if (!bookmarkId) {
    return
  }

  if (selectionInput.checked) {
    aiNamingState.selectedResultIds.add(bookmarkId)
  } else {
    aiNamingState.selectedResultIds.delete(bookmarkId)
  }

  aiNamingState.pendingMoveSelection = false
  renderAvailabilitySection()
}

function handleAiResultsClick(event) {
  const tagToggle = event.target.closest('[data-ai-toggle-tags]')
  if (tagToggle) {
    const bookmarkId = String(tagToggle.getAttribute('data-ai-toggle-tags') || '').trim()
    if (!bookmarkId) {
      return
    }
    if (aiNamingState.expandedTagResultIds.has(bookmarkId)) {
      aiNamingState.expandedTagResultIds.delete(bookmarkId)
    } else {
      aiNamingState.expandedTagResultIds.add(bookmarkId)
    }
    renderAiNamingResults()
    return
  }

  const moveButton = event.target.closest('[data-ai-move-recommended]')
  if (moveButton) {
    if (aiNamingState.running || aiNamingState.applying) {
      return
    }

    const bookmarkId = String(moveButton.getAttribute('data-ai-move-recommended') || '').trim()
    const targetResult = aiNamingState.results.find((result) => String(result.id) === bookmarkId)
    if (!bookmarkId || !targetResult || !canMoveAiNamingResultToSuggestedFolder(targetResult)) {
      return
    }

    if (aiNamingState.pendingMoveResultIds.has(bookmarkId)) {
      moveAiNamingResultsToSuggestedFolders([bookmarkId])
      return
    }

    aiNamingState.pendingMoveSelection = false
    aiNamingState.pendingMoveResultIds = new Set([bookmarkId])
    renderAvailabilitySection()
    return
  }

  const applyButton = event.target.closest('[data-ai-apply]')
  if (!applyButton || aiNamingState.running || aiNamingState.applying) {
    return
  }

  const bookmarkId = String(applyButton.getAttribute('data-ai-apply') || '').trim()
  if (!bookmarkId) {
    return
  }

  applyAiNamingResultsByIds([bookmarkId])
}

async function handleAiNamingAction() {
  if (availabilityState.catalogLoading || aiNamingState.running || aiNamingState.applying) {
    return
  }

  try {
    const settings = syncAiNamingSettingsDraftFromDom()
    validateAiNamingSettings(settings)
    await saveAiNamingSettings(settings)
    aiNamingState.settingsDirty = false

    if (!aiNamingState.bookmarks.length) {
      throw new Error('当前范围内没有可处理的 http/https 书签。')
    }

    const permissionGranted = await ensureAiNamingPermissionsForRun({ interactive: true })
    if (!permissionGranted) {
      throw new Error('未授予网页抓取或 AI 服务访问权限，无法运行书签智能分析。')
    }

    await runAiNamingSuggestions()
  } catch (error) {
    aiNamingState.lastError =
      error instanceof Error ? error.message : '书签智能分析失败，请稍后重试。'
    renderAvailabilitySection()
  }
}

function requestAiNamingStop() {
  if (!aiNamingState.running || aiNamingState.stopRequested) {
    return
  }

  aiNamingState.stopRequested = true
  aiNamingState.paused = false
  aiNamingState.abortController?.abort()
  releaseAiNamingPauseResolvers()
  renderAvailabilitySection()
}

function toggleAiNamingPause() {
  if (!aiNamingState.running || aiNamingState.stopRequested || aiNamingState.applying) {
    return
  }

  aiNamingState.paused = !aiNamingState.paused
  if (!aiNamingState.paused) {
    releaseAiNamingPauseResolvers()
  }

  renderAvailabilitySection()
}

async function waitForAiNamingRun() {
  while (aiNamingState.paused && !aiNamingState.stopRequested) {
    await new Promise((resolve) => {
      aiNamingState.pauseResolvers.push(resolve)
    })
  }

  return !aiNamingState.stopRequested
}

function releaseAiNamingPauseResolvers() {
  const resolvers = aiNamingState.pauseResolvers || []
  aiNamingState.pauseResolvers = []

  resolvers.forEach((resolve) => {
    resolve()
  })
}

async function ensureAiNamingPermissionsForRun({ interactive = true } = {}) {
  const permissionOrigins = getAiNamingPermissionOrigins()
  if (!permissionOrigins.length) {
    aiNamingState.permissionGranted = false
    return false
  }

  try {
    if (await containsPermissions({ origins: permissionOrigins })) {
      aiNamingState.permissionGranted = true
      return true
    }
  } catch (error) {
    aiNamingState.permissionGranted = false
  }

  if (!interactive) {
    return false
  }

  aiNamingState.requestingPermission = true
  renderAvailabilitySection()

  try {
    aiNamingState.permissionGranted = await requestPermissions({
      origins: permissionOrigins
    })
    return aiNamingState.permissionGranted
  } catch (error) {
    aiNamingState.permissionGranted = false
    return false
  } finally {
    aiNamingState.requestingPermission = false
    renderAvailabilitySection()
  }
}

async function ensureAiNamingProviderPermission({ interactive = true, baseUrl = aiNamingManagerState.settings.baseUrl } = {}) {
  const providerOrigin = getAiNamingProviderPermissionOrigin(baseUrl)
  if (!providerOrigin) {
    return false
  }

  try {
    if (await containsPermissions({ origins: [providerOrigin] })) {
      return true
    }
  } catch (error) {
  }

  if (!interactive) {
    return false
  }

  aiNamingState.requestingPermission = true
  renderAvailabilitySection()

  try {
    return await requestPermissions({
      origins: [providerOrigin]
    })
  } catch (error) {
    return false
  } finally {
    aiNamingState.requestingPermission = false
    renderAvailabilitySection()
  }
}

async function ensureJinaReaderPermission({ interactive = true } = {}) {
  if (await hasJinaReaderPermission()) {
    aiNamingState.remoteParserPermissionGranted = true
    return true
  }

  if (!interactive) {
    aiNamingState.remoteParserPermissionGranted = false
    return false
  }

  try {
    aiNamingState.remoteParserPermissionGranted = await requestPermissions({
      origins: [AI_NAMING_JINA_READER_ORIGIN]
    })
    return aiNamingState.remoteParserPermissionGranted
  } catch (error) {
    aiNamingState.remoteParserPermissionGranted = false
    return false
  }
}

async function hasJinaReaderPermission() {
  try {
    return await containsPermissions({
      origins: [AI_NAMING_JINA_READER_ORIGIN]
    })
  } catch (error) {
    return false
  }
}

function getAiNamingPermissionOrigins() {
  return getAiNamingPermissionOriginsForBookmarks(aiNamingState.bookmarks)
}

function getAiNamingPermissionOriginsForBookmarks(bookmarks = []) {
  const origins = new Set(
    bookmarks
      .flatMap((bookmark) => {
        const origin = getOriginPermissionPattern(bookmark.url)
        return origin ? [origin] : []
      })
  )
  const providerOrigin = getOriginPermissionPattern(aiNamingManagerState.settings.baseUrl)
  if (providerOrigin) {
    origins.add(providerOrigin)
  }
  if (aiNamingManagerState.settings.allowRemoteParsing) {
    origins.add(AI_NAMING_JINA_READER_ORIGIN)
  }
  return [...origins]
}

async function ensureAiNamingPermissionsForBookmarks(bookmarks = [], { interactive = true } = {}) {
  const origins = getAiNamingPermissionOriginsForBookmarks(bookmarks)
  if (!origins.length) {
    aiNamingState.permissionGranted = false
    return false
  }

  try {
    if (await containsPermissions({ origins })) {
      aiNamingState.permissionGranted = true
      return true
    }
  } catch (error) {
    aiNamingState.permissionGranted = false
  }

  if (!interactive) {
    return false
  }

  aiNamingState.requestingPermission = true
  renderAvailabilitySection()
  try {
    aiNamingState.permissionGranted = await requestPermissions({ origins })
    return aiNamingState.permissionGranted
  } catch (error) {
    aiNamingState.permissionGranted = false
    return false
  } finally {
    aiNamingState.requestingPermission = false
    renderAvailabilitySection()
  }
}

function getAiNamingProviderPermissionOrigin(baseUrl = aiNamingManagerState.settings.baseUrl) {
  return getOriginPermissionPattern(baseUrl)
}

async function handleAiScopeChange(nextScopeFolderId) {
  aiNamingState.scopeFolderId = String(nextScopeFolderId || '').trim()
  aiNamingState.lastError = ''
  syncAiNamingCatalog({ preserveResults: false })
  await hydrateAiNamingPermissionState()
  renderAvailabilitySection()
}

async function applySelectedAiNamingResults() {
  const selectedResults = getSelectedAiNamingResults()
  if (!selectedResults.length) {
    return
  }

  const confirmed = await requestConfirmation({
    title: `应用 ${selectedResults.length} 条 AI 命名建议？`,
    copy: `会重命名这些书签：${formatAiNamingRenameImpactList(selectedResults)}。只改书签标题，不移动文件夹。`,
    confirmLabel: `应用 ${selectedResults.length} 条命名`,
    label: 'Rename',
    tone: 'warning'
  })
  if (!confirmed) {
    return
  }

  aiNamingState.pendingMoveSelection = false
  aiNamingState.pendingMoveResultIds.clear()
  await applyAiNamingResultsByIds(selectedResults.map((result) => result.id))
}

async function handleMoveSelectedAiNamingResults() {
  if (aiNamingState.running || aiNamingState.applying) {
    return
  }

  const selectedMovableResults = getSelectedAiNamingResults()
    .filter((result) => canMoveAiNamingResultToSuggestedFolder(result))
  if (!selectedMovableResults.length) {
    aiNamingState.pendingMoveSelection = false
    renderAvailabilitySection()
    return
  }

  if (!aiNamingState.pendingMoveSelection) {
    aiNamingState.pendingMoveSelection = true
    aiNamingState.pendingMoveResultIds.clear()
    renderAvailabilitySection()
    return
  }

  const confirmed = await requestConfirmation({
    title: `移动 ${selectedMovableResults.length} 条书签到推荐文件夹？`,
    copy: `会移动这些书签：${formatAiNamingMoveImpactList(selectedMovableResults)}。书签标题不变，必要时会创建推荐文件夹路径。`,
    confirmLabel: `移动 ${selectedMovableResults.length} 条书签`,
    label: 'Move',
    tone: 'warning'
  })
  if (!confirmed) {
    aiNamingState.pendingMoveSelection = false
    renderAvailabilitySection()
    return
  }

  await moveAiNamingResultsToSuggestedFolders(selectedMovableResults.map((result) => result.id))
}

async function moveAiNamingResultsToSuggestedFolders(bookmarkIds) {
  const targetIds = new Set(bookmarkIds.map((id) => String(id)).filter(Boolean))
  const targetResults = aiNamingState.results.filter((result) => {
    return targetIds.has(String(result.id)) && canMoveAiNamingResultToSuggestedFolder(result)
  })

  if (!targetResults.length) {
    aiNamingState.pendingMoveSelection = false
    aiNamingState.pendingMoveResultIds.clear()
    renderAvailabilitySection()
    return
  }

  aiNamingState.applying = true
  aiNamingState.lastError = ''
  renderAvailabilitySection()

  const movedIds = []
  const moveErrors = []
  const folderCache = new Map()

  try {
    await createAutoBackupBeforeDangerousOperation({
      kind: 'batch-move',
      source: 'options',
      reason: `AI 推荐文件夹批量移动 ${targetResults.length} 条`,
      targetBookmarkIds: targetResults.map((result) => String(result.id)),
      estimatedChangeCount: targetResults.length
    })

    for (const result of targetResults) {
      try {
        const targetFolderId = await ensureAiSuggestedFolderPath(result.suggestedFolder, folderCache)
        if (!targetFolderId || String(targetFolderId) === String(result.parentId || '')) {
          continue
        }

        await moveBookmark(String(result.id), String(targetFolderId))
        movedIds.push(String(result.id))
      } catch (error) {
        const title = result.currentTitle || result.suggestedTitle || result.url || result.id
        const message = error instanceof Error ? error.message : '未知错误'
        moveErrors.push(`${title}：${message}`)
      }
    }
  } finally {
    aiNamingState.applying = false
    aiNamingState.pendingMoveSelection = false
    aiNamingState.pendingMoveResultIds.clear()

    if (movedIds.length) {
      await hydrateAvailabilityCatalog({ preserveResults: true })
    }

    if (moveErrors.length) {
      const firstError = moveErrors[0]
      aiNamingState.lastError = movedIds.length
        ? `推荐文件夹移动完成 ${movedIds.length} 条，${moveErrors.length} 条失败：${firstError}`
        : `移动至推荐文件夹失败：${firstError}`
    } else if (movedIds.length) {
      aiNamingState.lastError = `已将 ${movedIds.length} 条书签移动至推荐文件夹。`
    } else {
      aiNamingState.lastError = '所选书签已位于推荐文件夹。'
    }

    renderAvailabilitySection()
  }
}

function formatAiNamingRenameImpactList(results) {
  return formatAiNamingImpactList(results, (result) => {
    const currentTitle = result.currentTitle || result.url || result.id
    const suggestedTitle = result.suggestedTitle || currentTitle
    return `${currentTitle} -> ${suggestedTitle}`
  })
}

function formatAiNamingMoveImpactList(results) {
  return formatAiNamingImpactList(results, (result) => {
    const title = result.currentTitle || result.suggestedTitle || result.url || result.id
    return `${title} -> ${result.suggestedFolder}`
  })
}

function formatAiNamingImpactList(results, formatter) {
  const names = results.slice(0, 3).map(formatter)
  const remaining = Math.max(0, results.length - names.length)
  return remaining ? `${names.join('；')} 等 ${results.length} 条` : names.join('；')
}

async function applyAiNamingResultsByIds(bookmarkIds) {
  const targetIds = new Set(bookmarkIds.map((id) => String(id)).filter(Boolean))
  const targetResults = aiNamingState.results.filter((result) => {
    return targetIds.has(String(result.id)) && result.status === 'suggested'
  })

  if (!targetResults.length) {
    return
  }

  aiNamingState.applying = true
  aiNamingState.lastError = ''
  renderAvailabilitySection()

  const appliedIds = []
  let applyError = null

  try {
    await createAutoBackupBeforeDangerousOperation({
      kind: 'batch-tag-update',
      source: 'options',
      reason: `AI 命名建议批量应用 ${targetResults.length} 条`,
      targetBookmarkIds: targetResults.map((result) => String(result.id)),
      estimatedChangeCount: targetResults.length
    })

    for (const result of targetResults) {
      await updateBookmark(result.id, {
        title: result.suggestedTitle
      })
      appliedIds.push(String(result.id))
    }
  } catch (error) {
    applyError = error
  } finally {
    aiNamingState.applying = false

    if (appliedIds.length) {
      const appliedIdSet = new Set(appliedIds)
      aiNamingState.results = aiNamingState.results.filter((result) => {
        return !appliedIdSet.has(String(result.id))
      })
      aiNamingState.selectedResultIds = new Set(
        [...aiNamingState.selectedResultIds].filter((id) => !appliedIdSet.has(String(id)))
      )
      recalculateAiNamingSummary()
      await hydrateAvailabilityCatalog({ preserveResults: true })
    }

    if (applyError) {
      aiNamingState.lastError =
        applyError instanceof Error
          ? `应用建议过程中断，已应用 ${appliedIds.length} 条：${applyError.message}`
          : `应用建议过程中断，已应用 ${appliedIds.length} 条。`
    } else if (appliedIds.length) {
      aiNamingState.lastError = `已应用 ${appliedIds.length} 条书签命名建议。`
    }

    renderAvailabilitySection()
  }
}

function validateAiNamingSettings(settings) {
  const normalized = normalizeAiNamingSettings(settings)
  if (!normalized.baseUrl) {
    throw new Error('请填写 Base URL。')
  }

  try {
    const parsedUrl = new URL(normalized.baseUrl)
    if (!/^https?:$/i.test(parsedUrl.protocol)) {
      throw new Error('仅支持 http/https Base URL。')
    }
  } catch (error) {
    throw new Error('Base URL 格式无效。')
  }

  if (!normalized.apiKey) {
    throw new Error('请填写 API Key。')
  }

  if (!normalized.model) {
    throw new Error('请填写 AI 模型名称。')
  }
}

function getAiNamingBadgeTone() {
  if (aiNamingState.requestingPermission || availabilityState.catalogLoading) {
    return 'warning'
  }

  if (aiNamingState.lastError) {
    return 'danger'
  }

  if (!aiNamingManagerState.settings.apiKey || !aiNamingManagerState.settings.model) {
    return 'muted'
  }

  return aiNamingState.permissionGranted ? 'success' : 'muted'
}

function getAiNamingBadgeText() {
  if (availabilityState.catalogLoading) {
    return '读取中'
  }

  if (aiNamingState.requestingPermission) {
    return '授权中'
  }

  if (!aiNamingManagerState.settings.apiKey || !aiNamingManagerState.settings.model) {
    return '待配置'
  }

  if (aiNamingState.running) {
    return '生成中'
  }

  return aiNamingState.permissionGranted ? '已就绪' : '待授权'
}

function getAiNamingStatusCopy() {
  if (aiNamingState.lastError) {
    return aiNamingState.lastError
  }

  if (aiNamingState.testingConnection) {
    return '正在测试当前模型，请稍候。'
  }

  if (!aiNamingManagerState.settings.apiKey || !aiNamingManagerState.settings.model) {
    return '请先在“通用设置 > 自定义 AI 渠道”填写 API Key 并选择模型。'
  }

  if (aiNamingState.settingsDirty) {
    return '设置已修改，开始分析前会自动按当前输入保存。'
  }

  if (aiNamingState.running) {
    if (aiNamingState.paused) {
      return '书签智能分析已暂停。继续后会保留当前结果并从下一条书签继续处理。'
    }

    return aiNamingManagerState.settings.allowRemoteParsing
      ? '正在结合本地内容和 Jina Reader 解析结果生成智能分析建议，并同步网页内容索引。你可以随时停止当前批次。'
      : '正在读取网页内容、生成书签智能分析建议，并同步网页内容索引。你可以随时停止当前批次。'
  }

  if (aiNamingState.lastCompletedAt) {
    return `最近一次书签智能分析完成于 ${formatDateTime(aiNamingState.lastCompletedAt)}。`
  }

  return '配置 AI 渠道后，可批量生成更适合收藏、检索和重命名的书签标签与标题。应用前你可以逐条预览。'
}

function getAiNamingProgressCopy() {
  const scopeMeta = getCurrentAiNamingScopeMeta()
  const remoteCopy = aiNamingManagerState.settings.allowRemoteParsing
    ? '已开启 Jina Reader 远程解析，本轮会结合本地抽取与远程解析内容。'
    : '仅使用本地网页抓取与内容抽取。'
  return `当前范围：${scopeMeta.label}。本轮会处理 ${aiNamingState.eligibleBookmarks} 条 http/https 书签，并调用模型 ${aiNamingManagerState.settings.model || '未配置'} 生成书签智能分析建议。${remoteCopy}`
}

function getAiNamingConnectivityMeta() {
  if (aiNamingState.testingConnection) {
    return {
      visible: true,
      tone: 'warning',
      copy: '正在测试当前模型，请稍候。'
    }
  }

  if (aiNamingState.lastConnectivityTestStatus === 'success') {
    return {
      visible: true,
      tone: 'success',
      copy: `${aiNamingState.lastConnectivityTestMessage || '连接成功，当前模型可用。'}${aiNamingState.settingsDirty ? ' 当前改动尚未保存。' : ''}`
    }
  }

  if (aiNamingState.lastConnectivityTestStatus === 'error') {
    return {
      visible: true,
      tone: 'danger',
      copy: aiNamingState.lastConnectivityTestMessage || '连通性测试失败。'
    }
  }

  return {
    visible: false,
    tone: 'muted',
    copy: ''
  }
}

function getAiNamingStatusLabel(result) {
  if (result.status === 'failed') {
    return '生成失败'
  }

  if (result.status === 'unchanged') {
    return '无需改名'
  }

  if (result.status === 'manual_review') {
    return '待人工确认'
  }

  return '建议改名'
}

function getAiNamingConfidenceLabel(confidence) {
  if (confidence === 'high') {
    return '高置信'
  }

  if (confidence === 'medium') {
    return '中置信'
  }

  if (confidence === 'low') {
    return '低置信'
  }

  return '未分类'
}

function getAiExtractionLabel(status, source = '') {
  const sourceLabel = source ? ` / ${source}` : ''
  if (status === 'combined') {
    return `本地 + Jina Reader 联合解析${sourceLabel}`
  }
  if (status === 'remote') {
    return `远程解析${sourceLabel}`
  }
  if (status === 'ok') {
    return `本地正文抽取${sourceLabel}`
  }
  if (status === 'limited') {
    return `本地内容不足${sourceLabel}`
  }
  if (status === 'failed') {
    return `抓取失败${sourceLabel}`
  }
  return `URL 推断${sourceLabel}`
}

async function runAiNamingSuggestions() {
  const runStartedAt = Date.now()
  const controller = new AbortController()
  aiNamingState.running = true
  aiNamingState.stopRequested = false
  aiNamingState.paused = false
  aiNamingState.abortController = controller
  resetAiNamingRunState()
  aiNamingState.runStartedAt = runStartedAt
  aiNamingState.eligibleBookmarks = aiNamingState.bookmarks.length
  renderAvailabilitySection()

  try {
    const settings = aiNamingManagerState.settings
    const bookmarks = aiNamingState.bookmarks.slice()

    for (let start = 0; start < bookmarks.length; start += settings.batchSize) {
      if (aiNamingState.stopRequested) {
        break
      }

      const chunk = bookmarks.slice(start, start + settings.batchSize)
      const preparedItems = []
      const retryCandidates = []

      for (const bookmark of chunk) {
        if (!(await waitForAiNamingRun())) {
          break
        }

        if (aiNamingState.stopRequested) {
          break
        }

        try {
          preparedItems.push(await buildAiNamingPreparedItem(bookmark, settings.timeoutMs, {
            signal: controller.signal
          }))
          throwIfAborted(controller.signal)
        } catch (error) {
          retryCandidates.push({
            bookmark,
            initialError: error
          })
        } finally {
          aiNamingState.checkedBookmarks += 1
          recalculateAiNamingSummary()
          scheduleAvailabilityRender()
        }
      }

      if (!(await waitForAiNamingRun())) {
        break
      }

      if (!preparedItems.length || aiNamingState.stopRequested) {
        if (retryCandidates.length && !aiNamingState.stopRequested) {
          await retryAiNamingBookmarks(retryCandidates, settings)
        }
        continue
      }

      try {
        const aiResponseItems = await requestAiNamingBatch(preparedItems, {
          signal: controller.signal
        })
        if (aiNamingState.stopRequested || controller.signal.aborted) {
          break
        }
        const failedPreparedItems = await mergeAiNamingBatchResults(preparedItems, aiResponseItems, settings)
        retryCandidates.push(...failedPreparedItems.map((preparedItem) => {
          return {
            bookmark: preparedItem.bookmark,
            preparedItem,
            initialError: new Error('AI 返回中缺少该书签的命名结果。')
          }
        }))
      } catch (error) {
        retryCandidates.push(...preparedItems.map((preparedItem) => {
          return {
            bookmark: preparedItem.bookmark,
            initialError: error
          }
        }))
      }

      if (retryCandidates.length && !aiNamingState.stopRequested) {
        await retryAiNamingBookmarks(retryCandidates, settings)
      }

      recalculateAiNamingSummary()
      scheduleAvailabilityRender()
    }

    aiNamingState.lastCompletedAt = Date.now()
    recalculateAiNamingSummary()
    if (aiNamingState.stopRequested || controller.signal.aborted) {
      aiNamingState.lastError = `已手动停止，本轮保留 ${aiNamingState.results.length} 条已生成结果。`
    }
    notifyAiNamingRunFinished({
      stopped: aiNamingState.stopRequested || controller.signal.aborted,
      startedAt: runStartedAt,
      completedAt: aiNamingState.lastCompletedAt
    }).catch((error) => {
      console.warn('[Curator] 书签智能分析完成通知发送失败', error)
    })
  } finally {
    aiNamingState.running = false
    aiNamingState.stopRequested = false
    aiNamingState.paused = false
    if (aiNamingState.abortController === controller) {
      aiNamingState.abortController = null
    }
    releaseAiNamingPauseResolvers()
    recalculateAiNamingSummary()
    renderAvailabilitySection()
  }
}

async function notifyAiNamingRunFinished({
  stopped = false,
  startedAt = 0,
  completedAt = Date.now()
} = {}): Promise<void> {
  if (!chrome.notifications?.create) {
    return
  }

  const permissionLevel = await getNotificationPermissionLevel().catch(() => 'denied')
  if (permissionLevel !== 'granted') {
    return
  }

  const processed = Math.max(0, Number(aiNamingState.checkedBookmarks) || 0)
  const total = Math.max(processed, Number(aiNamingState.eligibleBookmarks) || 0)
  const title = stopped ? '书签智能分析已停止' : '书签智能分析已完成'
  const message = stopped
    ? `已处理 ${processed}/${total} 条，保留 ${aiNamingState.results.length} 条已生成结果。`
    : `已处理 ${processed}/${total} 条，建议改名 ${aiNamingState.suggestedCount} 条，待确认 ${aiNamingState.manualReviewCount} 条，失败 ${aiNamingState.failedCount} 条。`
  const elapsedCopy = formatElapsedTime(Math.max(0, Number(completedAt) - Number(startedAt || completedAt)))
  const scopeMeta = getCurrentAiNamingScopeMeta()

  await createOptionsNotification(`ai-naming-${completedAt}-${Math.random().toString(16).slice(2)}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('src/assets/icon128.png'),
    title,
    message,
    contextMessage: `范围：${scopeMeta.label}${elapsedCopy ? ` · 用时 ${elapsedCopy}` : ''}`,
    priority: 1,
    requireInteraction: false,
    silent: false
  })
}

function getNotificationPermissionLevel(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!chrome.notifications?.getPermissionLevel) {
      resolve('denied')
      return
    }

    chrome.notifications.getPermissionLevel((level) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(String(level || 'denied'))
    })
  })
}

function createOptionsNotification(
  notificationId: string,
  options: chrome.notifications.NotificationOptions<true>
): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.notifications.create(notificationId, options, () => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve()
    })
  })
}

function formatElapsedTime(elapsedMs: number): string {
  const totalSeconds = Math.round(Math.max(0, elapsedMs) / 1000)
  if (!totalSeconds) {
    return ''
  }

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (!minutes) {
    return `${seconds} 秒`
  }
  if (!seconds) {
    return `${minutes} 分钟`
  }
  return `${minutes} 分 ${seconds} 秒`
}

async function retryAiNamingBookmarks(retryCandidates, settings = aiNamingManagerState.settings) {
  for (const candidate of retryCandidates) {
    if (!(await waitForAiNamingRun())) {
      break
    }

    if (aiNamingState.stopRequested) {
      break
    }

    try {
      const { modelItem, preparedItem } = await generateAiNamingResultForBookmark(candidate.bookmark, settings)
      await commitAiNamingResult(candidate.bookmark, modelItem, settings, preparedItem)
    } catch (retryError) {
      upsertAiNamingResult(
        buildAiNamingRetriedFailureResult(candidate.bookmark, candidate.initialError, retryError)
      )
    }

    recalculateAiNamingSummary()
    scheduleAvailabilityRender()
  }

  sortAiNamingResults()
  scheduleAvailabilityRender()
}

async function generateAiNamingResultForBookmark(
  bookmark,
  settings = aiNamingManagerState.settings,
  options: { signal?: AbortSignal | null } = {}
) {
  const preparedItem = await buildAiNamingPreparedItem(bookmark, settings.timeoutMs, options)
  throwIfAborted(options.signal)
  const aiResponseItems = await requestAiNamingBatch([preparedItem], options)
  const modelItem = aiResponseItems.find((item) => String(item.bookmarkId) === String(bookmark.id))
  if (!modelItem) {
    throw new Error('AI 返回中缺少该书签的命名结果。')
  }

  return { modelItem, preparedItem }
}

async function regenerateDashboardAiTagsForBookmark(bookmark, signal = null) {
  if (aiNamingState.running || aiNamingState.applying) {
    throw new Error('书签智能分析正在运行，请等待当前任务结束后再重新生成。')
  }

  if (!isCheckableUrl(bookmark?.url)) {
    throw new Error('该书签不是可分析的 http/https 链接。')
  }

  const settings = normalizeAiNamingSettings(aiNamingManagerState.settings)
  validateAiNamingSettings(settings)
  aiNamingManagerState.settings = settings

  throwIfAborted(signal)
  const permissionGranted = await ensureAiNamingPermissionsForBookmarks([bookmark], { interactive: true })
  if (!permissionGranted) {
    throw new Error('未授予网页抓取或 AI 服务访问权限，无法重新生成标签。')
  }

  throwIfAborted(signal)
  const { modelItem, preparedItem } = await generateAiNamingResultForBookmark(bookmark, settings, { signal })
  throwIfAborted(signal)
  const nextResult = buildAiNamingResultFromModelItem(bookmark, modelItem, preparedItem)
  const record = await persistAiNamingTagRecord(bookmark, nextResult, settings, preparedItem, {
    rethrow: true
  })

  if (!record) {
    throw new Error('AI 未生成可保存的标签数据。')
  }
}

async function commitAiNamingResult(bookmark, modelItem, settings = aiNamingManagerState.settings, preparedItem = null) {
  const nextResult = buildAiNamingResultFromModelItem(bookmark, modelItem, preparedItem)
  upsertAiNamingResult(nextResult)
  await persistAiNamingTagRecord(bookmark, nextResult, settings, preparedItem)

  if (
    nextResult.status === 'suggested' &&
    modelItem.confidence === 'high' &&
    settings.autoSelectHighConfidence
  ) {
    aiNamingState.selectedResultIds.add(String(bookmark.id))
  }
}

function buildAiNamingResultFromModelItem(bookmark, modelItem, preparedItem = null) {
  const normalizedTitle = cleanAiSuggestedTitle(modelItem.suggestedTitle || bookmark.title)
  const sameAsCurrent = normalizeText(normalizedTitle) === normalizeText(bookmark.title)
  const status = modelItem.action === 'keep'
    ? 'unchanged'
    : modelItem.action === 'manual_review'
      ? 'manual_review'
      : sameAsCurrent || !normalizedTitle
        ? 'unchanged'
        : 'suggested'

  return {
    id: String(bookmark.id),
    currentTitle: bookmark.title,
    suggestedTitle: status === 'suggested' ? normalizedTitle : bookmark.title,
    status,
    confidence: modelItem.confidence,
    confidenceScore: normalizeAiConfidenceScore(modelItem.confidenceScore ?? modelItem.confidence),
    summary: normalizeAiResultText(modelItem.summary, 420),
    contentType: normalizeAiResultText(modelItem.contentType || preparedItem?.pageContext?.content_type, 80),
    topics: normalizeAiResultTextList(modelItem.topics, 8, 48),
    suggestedFolder: normalizeAiResultText(modelItem.suggestedFolder, 180),
    tags: normalizeBookmarkTags(modelItem.tags),
    aliases: normalizeAiResultTextList(modelItem.aliases, 20, 40),
    extractionStatus: String(preparedItem?.pageContext?.extraction?.status || ''),
    extractionSource: String(preparedItem?.pageContext?.extraction?.source || ''),
    extractionWarnings: Array.isArray(preparedItem?.pageContext?.extraction?.warnings)
      ? preparedItem.pageContext.extraction.warnings.slice(0, 4)
      : [],
    reason: modelItem.reason || 'AI 未提供额外说明。',
    url: bookmark.url,
    displayUrl: bookmark.displayUrl,
    path: bookmark.path,
    domain: bookmark.domain,
    ancestorIds: bookmark.ancestorIds,
    parentId: bookmark.parentId,
    index: bookmark.index
  }
}

async function persistAiNamingTagRecord(
  bookmark,
  result,
  settings = aiNamingManagerState.settings,
  preparedItem = null,
  options: { rethrow?: boolean } = {}
) {
  try {
    const record = await upsertBookmarkTagFromAnalysis({
      bookmark: {
        id: bookmark.id,
        title: result.suggestedTitle || bookmark.title,
        url: bookmark.url,
        path: bookmark.path
      },
      analysis: {
        summary: result.summary,
        contentType: result.contentType,
        topics: result.topics,
        tags: result.tags,
        aliases: result.aliases,
        confidence: result.confidenceScore,
        extraction: {
          status: result.extractionStatus,
          source: result.extractionSource,
          warnings: result.extractionWarnings
        }
      },
      source: 'ai_naming',
      model: settings.model,
      extraction: {
        status: String(preparedItem?.pageContext?.extraction?.status || result.extractionStatus || ''),
        source: String(preparedItem?.pageContext?.extraction?.source || result.extractionSource || ''),
        warnings: Array.isArray(result.extractionWarnings) ? result.extractionWarnings : []
      }
    })
    if (record) {
      aiNamingState.tagIndex = normalizeBookmarkTagIndex({
        ...aiNamingState.tagIndex,
        updatedAt: Date.now(),
        records: {
          ...aiNamingState.tagIndex.records,
          [record.bookmarkId]: record
        }
      })
      renderBookmarkTagDataCard()
    }
    return record
  } catch (error) {
    aiNamingState.tagDataStatus = error instanceof Error ? error.message : '标签数据写入失败。'
    renderAiNamingSection()
    if (options.rethrow) {
      throw error
    }
    return null
  }
}

function buildAiNamingRetriedFailureResult(bookmark, initialError, retryError) {
  const initialMessage = getAiNamingFailureMessage(initialError)
  const retryMessage = getAiNamingFailureMessage(retryError)
  return {
    ...buildAiNamingFailedResult(bookmark, retryError),
    reason:
      initialMessage === retryMessage
        ? `重试 1 次后仍失败：${retryMessage}`
        : `首次失败：${initialMessage}；重试后仍失败：${retryMessage}`
  }
}

function getAiNamingFailureMessage(error) {
  return error instanceof Error ? error.message : '生成建议失败。'
}

function buildAiFolderCandidates(bookmark) {
  const candidates = []
  const seen = new Set()
  const appendFolder = (value) => {
    const folderPath = String(value || '').replace(/\s+/g, ' ').trim()
    const key = normalizeText(folderPath)
    if (!folderPath || !key || seen.has(key)) {
      return
    }

    seen.add(key)
    candidates.push(folderPath)
  }

  appendFolder(bookmark?.path)
  availabilityState.allFolders
    .slice()
    .sort((left, right) => {
      const leftSameDomain = String(bookmark?.path || '').startsWith(String(left.path || left.title || '')) ? -1 : 0
      const rightSameDomain = String(bookmark?.path || '').startsWith(String(right.path || right.title || '')) ? -1 : 0
      return leftSameDomain - rightSameDomain || compareByPathTitle(left, right)
    })
    .forEach((folder) => {
      appendFolder(folder.path || folder.title)
    })

  return candidates.slice(0, 80)
}

async function buildAiNamingPreparedItem(bookmark, timeoutMs, options: { signal?: AbortSignal | null } = {}) {
  throwIfAborted(options.signal)
  const metadata = await getAiMetadataForBookmark(bookmark, timeoutMs, options)
  throwIfAborted(options.signal)
  const pageContext = buildPageContextForAi(metadata)
  const preparedItem = {
    bookmark,
    pageMetadata: metadata,
    pageContext,
    requestItem: {
      bookmark_id: String(bookmark.id),
      current_title: String(bookmark.title || '未命名书签'),
      url: String(bookmark.url || ''),
      final_url: String(metadata.finalUrl || bookmark.url || ''),
      folder_path: String(bookmark.path || ''),
      domain: String(bookmark.domain || extractDomain(metadata.finalUrl || bookmark.url || '')),
      existing_folders: buildAiFolderCandidates(bookmark),
      page_context: pageContext
    }
  }
  await saveContentSnapshotForAiPreparedItem(preparedItem)
  throwIfAborted(options.signal)
  return preparedItem
}

async function saveContentSnapshotForAiPreparedItem(preparedItem): Promise<void> {
  if (!contentSnapshotState.settings.enabled || !preparedItem?.bookmark || !preparedItem?.pageMetadata) {
    return
  }

  try {
    const record = await saveContentSnapshotFromContext({
      bookmark: preparedItem.bookmark,
      context: preparedItem.pageMetadata,
      settings: contentSnapshotState.settings
    })
    if (!record) {
      return
    }

    contentSnapshotState.index = normalizeContentSnapshotIndex({
      ...contentSnapshotState.index,
      updatedAt: Math.max(Number(contentSnapshotState.index.updatedAt) || 0, Number(record.extractedAt) || Date.now()),
      records: {
        ...contentSnapshotState.index.records,
        [record.bookmarkId]: record
      }
    })
    updateContentSnapshotSearchTextForRecord(record)
    resetContentSnapshotFullTextSearchMapRetry()
    contentSnapshotState.aiRunSavedCount += 1
    contentSnapshotState.statusMessage = ''
    renderContentSnapshotSettings()
  } catch (error) {
    contentSnapshotState.aiRunFailedCount += 1
    const title = preparedItem.bookmark?.title || preparedItem.bookmark?.url || preparedItem.bookmark?.id || '未知书签'
    const message = error instanceof Error ? error.message : '未知错误'
    contentSnapshotState.statusMessage = `书签智能分析保存网页内容索引失败：${title}：${message}`
    console.warn('[Curator] 书签智能分析保存网页内容索引失败', error)
    renderContentSnapshotSettings()
  }
}

function updateContentSnapshotSearchTextForRecord(record): void {
  const searchText = buildContentSnapshotSearchText(record, {
    includeFullText: contentSnapshotState.searchTextMapIncludesFullText
  })
  const bookmarkId = String(record?.bookmarkId || '').trim()
  if (!bookmarkId) {
    return
  }

  const nextSearchMap = new Map(contentSnapshotState.searchTextMap)
  if (searchText) {
    nextSearchMap.set(bookmarkId, searchText)
  } else {
    nextSearchMap.delete(bookmarkId)
  }
  contentSnapshotState.searchTextMap = nextSearchMap
  if (shouldHydrateContentSnapshotFullTextSearchMapForDashboard()) {
    scheduleContentSnapshotFullTextSearchMapHydration()
  }
}

function renderDashboardSectionIfVisible(): void {
  if (normalizeSectionKey(getCurrentSectionKey()) !== 'dashboard') {
    return
  }

  renderDashboardSection()
}

function shouldHydrateContentSnapshotFullTextSearchMapForDashboard(): boolean {
  return (
    normalizeSectionKey(getCurrentSectionKey()) === 'dashboard' &&
    parseSearchQuery(dashboardState.query).textTerms.length > 0 &&
    contentSnapshotState.settings.fullTextSearchEnabled &&
    !contentSnapshotState.searchTextMapIncludesFullText &&
    !contentSnapshotState.searchTextMapLoadingFullText
  )
}

function maybeHydrateContentSnapshotFullTextSearchMapForVisibleDashboard(): void {
  if (!shouldHydrateContentSnapshotFullTextSearchMapForDashboard()) {
    return
  }

  scheduleContentSnapshotFullTextSearchMapHydration()
}

async function getAiMetadataForBookmark(bookmark, timeoutMs, options: { signal?: AbortSignal | null } = {}) {
  let metadata
  try {
    metadata = await fetchBookmarkMetadataForAi(bookmark.url, timeoutMs, bookmark, options)
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    metadata = buildFallbackPageContentFromUrl(bookmark.url, {
      currentTitle: bookmark.title,
      error
    })
  }

  return normalizePageContentContext(metadata)
}

async function fetchBookmarkMetadataForAi(
  url,
  timeoutMs,
  bookmark = null,
  options: { signal?: AbortSignal | null } = {}
) {
  let context = null
  const originPattern = getDirectPageFetchOriginPattern(url)
  const canFetchDirectly = originPattern ? await hasOriginPermission(originPattern) : false
  const directFetchDecision = decideDirectPageFetch(url, canFetchDirectly)

  if (!directFetchDecision.allowed) {
    context = appendPageContentWarnings(
      buildFallbackPageContentFromUrl(url, {
        currentTitle: bookmark?.title
      }),
      [directFetchDecision.warning]
    )
  } else {
    try {
      const response = await fetchWithRequestTimeout(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        signal: options.signal
      }, timeoutMs)
      throwIfAborted(options.signal)
      const finalUrl = String(response.url || url || '')
      const contentType = String(response.headers.get('content-type') || '').toLowerCase()

      if (!contentType.includes('text/html')) {
        context = buildFallbackPageContentFromUrl(finalUrl, {
          currentTitle: bookmark?.title,
          contentType
        })
      } else {
        const html = await response.text()
        context = extractPageContentFromHtml(html, {
          url: finalUrl,
          currentTitle: bookmark?.title,
          contentType
        })
      }
    } catch (error) {
      if (isAbortError(error)) {
        throw error
      }
      context = appendPageContentWarnings(
        buildFallbackPageContentFromUrl(url, {
          currentTitle: bookmark?.title,
          error
        }),
        [getDirectPageFetchFailureWarning(error)]
      )
    }
  }

  if (aiNamingManagerState.settings.allowRemoteParsing) {
    const canUseRemoteParser = await hasOriginPermission(AI_NAMING_JINA_READER_ORIGIN)
    if (!canUseRemoteParser) {
      return normalizePageContentContext({
        ...context,
        warnings: [
          ...(context.warnings || []),
          'Jina Reader 未授权，本次已跳过远程解析。'
        ]
      })
    }

    try {
      throwIfAborted(options.signal)
      const remoteContext = await fetchRemoteBookmarkContentForAi(context.finalUrl || url, timeoutMs, context, options)
      return combinePageContentContexts(context, remoteContext)
    } catch (error) {
      if (isAbortError(error)) {
        throw error
      }
      return normalizePageContentContext({
        ...context,
        warnings: [
          ...(context.warnings || []),
          `远程解析失败：${getAiNamingFailureMessage(error)}`
        ]
      })
    }
  }

  return context
}

async function hasOriginPermission(origin) {
  if (!origin) {
    return false
  }

  try {
    return Boolean(await containsPermissions({ origins: [origin] }))
  } catch (error) {
    return false
  }
}

async function fetchRemoteBookmarkContentForAi(
  url,
  timeoutMs,
  fallbackContext,
  options: { signal?: AbortSignal | null } = {}
) {
  const readerUrl = buildJinaReaderUrl(url)
  if (!readerUrl) {
    throw new Error('远程解析 URL 无效。')
  }

  const response = await fetchWithRequestTimeout(readerUrl, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'follow',
    referrerPolicy: 'no-referrer',
    headers: {
      Accept: 'text/plain, text/markdown;q=0.9, */*;q=0.1'
    },
    signal: options.signal
  }, timeoutMs)

  if (!response.ok) {
    throw new Error(`Jina Reader 返回 HTTP ${response.status}。`)
  }

  const text = await response.text()
  return buildRemotePageContentFromText(text, {
    url: fallbackContext?.finalUrl || url,
    currentTitle: fallbackContext?.title
  })
}

async function requestAiNamingConnectivityTest(settings = aiNamingManagerState.settings) {
  const endpoint = getAiEndpoint(settings)
  const response = await fetchWithRequestTimeout(endpoint, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify(buildAiNamingConnectivityRequestBody(settings))
  }, settings.timeoutMs)

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(extractAiErrorMessage(payload, response.status))
  }

  return `连接成功，当前模型 ${settings.model} 可用。`
}

function buildAiNamingConnectivityRequestBody(settings = aiNamingManagerState.settings) {
  if (settings.apiStyle === 'chat_completions') {
    return {
      model: settings.model,
      messages: [
        {
          role: 'user',
          content: 'Reply with OK.'
        }
      ]
    }
  }

  return {
    model: settings.model,
    input: 'Reply with OK.'
  }
}

function normalizeAiNamingConnectivityError(error, timeoutMs = aiNamingManagerState.settings.timeoutMs) {
  if (error?.name === 'AbortError') {
    return `连通性测试超时，当前超时设置为 ${Math.max(1, Math.round((Number(timeoutMs) || AI_NAMING_DEFAULT_TIMEOUT_MS) / 1000))} 秒。`
  }

  return error instanceof Error ? error.message : '连通性测试失败，请稍后重试。'
}

async function requestAiNamingBatch(preparedItems, options: { signal?: AbortSignal | null } = {}) {
  const settings = aiNamingManagerState.settings
  const endpoint = getAiEndpoint(settings)
  const requestBody = buildAiNamingRequestBody(preparedItems, settings)
  throwIfAborted(options.signal)
  const response = await fetchWithRequestTimeout(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify(requestBody),
    signal: options.signal
  }, settings.timeoutMs)

  throwIfAborted(options.signal)
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(extractAiErrorMessage(payload, response.status))
  }

  const rawJsonText = settings.apiStyle === 'responses'
    ? extractResponsesJsonText(payload)
    : extractChatCompletionsJsonText(payload)
  let parsedPayload = null
  try {
    parsedPayload = JSON.parse(rawJsonText)
  } catch (error) {
    throw new Error('AI 返回了无法解析的 JSON 结果。')
  }
  return normalizeAiNamingResponseItems(parsedPayload, preparedItems)
}

function buildAiNamingRequestBody(preparedItems, settings) {
  const systemPrompt = settings.systemPrompt || getDefaultAiNamingSystemPrompt()
  const userPrompt = buildAiNamingUserPrompt(preparedItems)

  if (settings.apiStyle === 'chat_completions') {
    const schemaHint = '\n\n请严格按以下 JSON 格式返回结果，不要添加任何额外文本或 markdown 标记：\n' + JSON.stringify(AI_NAMING_RESPONSE_SCHEMA, null, 2)
    return {
      model: settings.model,
      messages: [
        {
          role: 'system',
          content: systemPrompt + schemaHint
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      response_format: { type: 'json_object' }
    }
  }

  return {
    model: settings.model,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: systemPrompt
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: userPrompt
          }
        ]
      }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'bookmark_naming_batch',
        strict: true,
        schema: AI_NAMING_RESPONSE_SCHEMA
      }
    }
  }
}

function getDefaultAiNamingSystemPrompt() {
  return [
    '你是一个面向中文用户的浏览器书签整理助手。',
    '你的任务是根据 current_title、url、final_url、folder_path、domain、existing_folders 和 page_context，为每条书签生成更适合长期保存、回看和检索的结构化建议。',
    'page_context 是扩展从网页中抽取和压缩后的内容，包含 title、description、Open Graph、canonical URL、语言、headings、正文摘录、链接上下文、内容类型与抽取状态。',
    '如果 page_context.source_contexts 同时包含“本地抽取”和“Jina Reader”，请结合两路内容判断：本地抽取通常保留浏览器可见的 title/meta/链接上下文，Jina Reader 通常提供更干净的 Markdown 正文。两者冲突时，优先相信更具体、更能被正文支持的信息。',
    '标题风格要像中文用户手动整理过的书签：清晰、克制、稳定、便于再次查找，而不是网页 SEO 标题或营销文案。',
    '优先提炼页面真正的主题词、对象名、文档名、文章名、产品名或工具名；必要时可保留版本号、年份、平台名、作者名、语言、文档类型等关键信息。',
    '删除无信息价值的噪音，例如站点名堆叠、首页、欢迎语、广告语、登录提示、促销词、重复后缀、无意义分隔符。',
    '默认优先输出自然中文标题；但如果页面主体明显是英文或其他语言，则翻译原语言核心标题，在源语言核心标题后方用冒号添加译文。格式示例：`核心标题: 中文译文`。',
    '不要凭空补充页面中没有出现的实体、结论、时间或用途。',
    'summary 要概括页面主要内容；content_type 从文档、博客、论文、工具、新闻、GitHub 项目、视频、商品页、论坛、登录页、网页中选择最贴近的一类。',
    'suggested_folder 优先从 existing_folders 中选择；如果都明显不合适，可以给出一个简短的新文件夹建议。',
    'topics 是主题归类，可稍长；tags 是界面展示和筛选用短标签，必须短、原子、稳定。',
    'tags 规则：每个 tag 只表达一个概念；中文优先 2-6 个字，英文优先 1-3 个词；通常输出 4-8 个高价值 tag。',
    '禁止把句子、标题、描述、多个概念组合成 tag；如果包含“与、和、及、逗号或斜杠”等多个概念，请拆成多个短 tag。',
    '好的 tags 示例：["AI", "LLM", "网关", "API", "OpenAI 兼容"]；坏的 tags 示例：["一个支持 OpenAI Claude Gemini 的 API 聚合网关", "效率工具与网络技术博客"]。',
    'aliases 只负责语义别名、简称、英文名、中文名或常见叫法；不要输出拼音全拼或首字母，拼音索引会由本地程序生成。',
    'confidence 必须是 0 到 1 的数字。内容不足、抽取状态为 limited/fallback/failed、或判断依赖 URL 猜测时要降低 confidence。',
    `建议标题应尽量精炼，通常不超过 ${AI_NAMING_MAX_TEXT_LENGTH} 个字符。`,
    '如果当前标题已经足够清晰、稳定且适合检索，请返回 keep。',
    '如果页面信息过少、噪音过多、含义不明确，或无法可靠判断该怎样命名，请返回 manual_review。',
    '当 action 为 keep 或 manual_review 时，suggested_title 请填写当前标题或仅做最小清理后的标题。',
    'reason 要简短说明判断依据，适合给中文用户阅读。',
    '必须严格返回 JSON Schema 指定的数据，不要输出任何额外文本。'
  ].join('\n')
}

function buildAiNamingUserPrompt(preparedItems) {
  const payload = preparedItems.map((item) => item.requestItem)
  return [
    '请逐条理解这些书签页面，先基于网页内容生成摘要、主题、标签和语义别名，再判断推荐标题和推荐文件夹，并返回结构化结果。',
    '优先语言：与页面标题的主要语言保持一致；若信息不足，则保留当前标题或标记为 manual_review，并降低 confidence。',
    '输入数据如下：',
    JSON.stringify({ items: payload }, null, 2)
  ].join('\n\n')
}

function normalizeAiNamingResponseItems(payload, preparedItems) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.items)) {
    throw new Error('AI 返回结果缺少 items 数组。')
  }

  const validIds = new Set(preparedItems.map((item) => String(item.bookmark.id)))
  return payload.items
    .map((item) => {
      const bookmarkId = String(item?.bookmark_id || '').trim()
      if (!validIds.has(bookmarkId)) {
        return null
      }

      const action = String(item?.action || '').trim()

      return {
        bookmarkId,
        action:
          action === 'rename' || action === 'keep' || action === 'manual_review'
            ? action
            : 'manual_review',
        summary: normalizeAiResultText(item?.summary, 420),
        contentType: normalizeAiResultText(item?.content_type, 80),
        topics: normalizeAiResultTextList(item?.topics, 8, 48),
        suggestedTitle: cleanAiSuggestedTitle(item?.suggested_title),
        suggestedFolder: normalizeAiResultText(item?.suggested_folder, 180),
        tags: normalizeBookmarkTags(item?.tags),
        aliases: normalizeAiResultTextList(item?.aliases, 20, 40),
        confidence: normalizeAiConfidence(item?.confidence),
        confidenceScore: normalizeAiConfidenceScore(item?.confidence),
        reason: String(item?.reason || '').replace(/\s+/g, ' ').trim()
      }
    })
    .filter(Boolean)
}

async function mergeAiNamingBatchResults(preparedItems, aiResponseItems, settings = aiNamingManagerState.settings) {
  const responseMap = new Map(aiResponseItems.map((item) => [String(item.bookmarkId), item]))
  const failedPreparedItems = []

  for (const preparedItem of preparedItems) {
    const bookmark = preparedItem.bookmark
    const modelItem = responseMap.get(String(bookmark.id))
    if (!modelItem) {
      failedPreparedItems.push(preparedItem)
      continue
    }

    await commitAiNamingResult(bookmark, modelItem, settings, preparedItem)
  }

  sortAiNamingResults()
  return failedPreparedItems
}

function upsertAiNamingResult(result) {
  const bookmarkId = String(result?.id || '').trim()
  if (!bookmarkId) {
    return
  }

  const index = aiNamingState.results.findIndex((entry) => String(entry.id) === bookmarkId)
  if (index === -1) {
    aiNamingState.results.push(result)
    return
  }

  aiNamingState.results.splice(index, 1, result)
}

function sortAiNamingResults() {
  const confidenceRank = {
    high: 0,
    medium: 1,
    low: 2
  }
  const statusRank = {
    suggested: 0,
    manual_review: 1,
    failed: 2,
    unchanged: 3
  }

  aiNamingState.results.sort((left, right) => {
    return (
      (statusRank[left.status] ?? 9) - (statusRank[right.status] ?? 9) ||
      (confidenceRank[left.confidence] ?? 9) - (confidenceRank[right.confidence] ?? 9) ||
      compareByPathTitle(
        {
          path: left.path,
          title: left.currentTitle
        },
        {
          path: right.path,
          title: right.currentTitle
        }
      )
    )
  })
}

function buildAiNamingFailedResult(bookmark, error) {
  return {
    id: String(bookmark.id),
    currentTitle: bookmark.title,
    suggestedTitle: bookmark.title,
    status: 'failed',
    confidence: 'low',
    confidenceScore: 0,
    summary: '',
    contentType: '',
    topics: [],
    suggestedFolder: '',
    tags: [],
    extractionStatus: '',
    extractionSource: '',
    extractionWarnings: [],
    reason: error instanceof Error ? error.message : '生成建议失败。',
    url: bookmark.url,
    displayUrl: bookmark.displayUrl,
    path: bookmark.path,
    domain: bookmark.domain,
    ancestorIds: bookmark.ancestorIds,
    parentId: bookmark.parentId,
    index: bookmark.index
  }
}

function normalizeAiConfidence(confidence) {
  if (typeof confidence === 'number') {
    if (confidence >= 0.78) {
      return 'high'
    }
    if (confidence >= 0.52) {
      return 'medium'
    }
    return 'low'
  }

  const normalized = String(confidence || '').trim()
  if (normalized === 'high' || normalized === 'medium' || normalized === 'low') {
    return normalized
  }
  const numeric = Number(normalized)
  if (Number.isFinite(numeric)) {
    return normalizeAiConfidence(numeric)
  }
  return 'low'
}

function normalizeAiConfidenceScore(confidence) {
  if (typeof confidence === 'number' && Number.isFinite(confidence)) {
    return Math.max(0, Math.min(confidence, 1))
  }

  const normalized = String(confidence || '').trim()
  const numeric = Number(normalized)
  if (Number.isFinite(numeric)) {
    return Math.max(0, Math.min(numeric, 1))
  }

  if (normalized === 'high') {
    return 0.86
  }
  if (normalized === 'medium') {
    return 0.64
  }
  if (normalized === 'low') {
    return 0.34
  }

  return 0
}

function normalizeAiResultText(value, limit = 180) {
  return truncateText(
    String(value || '')
      .replace(/\s+/g, ' ')
      .trim(),
    limit
  )
}

function normalizeAiResultTextList(values, limit = 8, itemLimit = 48) {
  const source = Array.isArray(values)
    ? values
    : typeof values === 'string'
      ? values.split(/[,，;；\n]+/g)
      : []
  const seen = new Set()

  return source
    .map((value) => normalizeAiResultText(value, itemLimit))
    .filter(Boolean)
    .filter((value) => {
      const key = normalizeText(value)
      if (!key || seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
    .slice(0, limit)
}

function cleanAiSuggestedTitle(title) {
  return truncateText(
    String(title || '')
      .replace(/\s+/g, ' ')
      .trim(),
    AI_NAMING_MAX_TEXT_LENGTH
  )
}

function renderAvailabilitySelectionGroup() {
  if (!dom.availabilitySelectionGroup) {
    return
  }

  const selectedResults = getSelectedAvailabilityResults()
  const selectedReviewCount = selectedResults.filter((result) => result.status === 'review').length
  const selectedFailedCount = selectedResults.filter((result) => result.status === 'failed').length
  const interactionLocked = isInteractionLocked()

  dom.availabilitySelectionGroup.classList.toggle('hidden', selectedResults.length === 0)
  dom.availabilitySelectionCount.textContent = `${selectedResults.length} 条已选择`
  dom.availabilitySelectionRetest.disabled =
    interactionLocked ||
    availabilityState.catalogLoading ||
    availabilityState.requestingPermission ||
    selectedResults.length === 0
  dom.availabilitySelectionRetest.textContent = availabilityState.retestingSelection ? '重新测试中…' : '重新测试'
  dom.availabilitySelectionPromote.disabled = interactionLocked || selectedReviewCount === 0
  dom.availabilitySelectionDemote.disabled = interactionLocked || selectedFailedCount === 0
  dom.availabilitySelectionMove.disabled = interactionLocked || selectedResults.length === 0
  dom.availabilitySelectionIgnoreBookmark.disabled = interactionLocked || selectedResults.length === 0
  dom.availabilitySelectionIgnoreDomain.disabled = interactionLocked || selectedResults.length === 0
  dom.availabilitySelectionIgnoreFolder.disabled = interactionLocked || selectedResults.length === 0
  dom.availabilitySelectionDelete.disabled = interactionLocked || selectedResults.length === 0
}

function renderAvailabilityScopeControls() {
  const scopeMeta = getCurrentAvailabilityScopeMeta()
  const aiScopeMeta = getCurrentAiNamingScopeMeta()
  renderScopeTriggerControl(
    dom.availabilityScopeTrigger,
    dom.availabilityScopeLabel,
    dom.availabilityScopeCopy,
    {
      disabled: availabilityState.running || availabilityState.retestingSelection || availabilityState.deleting || availabilityState.catalogLoading,
      label: scopeMeta.label,
      copy: `当前范围：${scopeMeta.label}。本轮只会检测该范围内的书签，历史对比也只与同范围的上一次检测结果进行比较。`
    }
  )
  renderScopeTriggerControl(
    dom.historyScopeTrigger,
    dom.historyScopeLabel,
    dom.historyScopeCopy,
    {
      disabled: availabilityState.running || availabilityState.retestingSelection || availabilityState.deleting || availabilityState.catalogLoading,
      label: scopeMeta.label,
      copy: `当前显示范围：${scopeMeta.label}。这里只展示该检测范围对应的历史日志、异常趋势和已恢复记录。`
    }
  )
  renderScopeTriggerControl(
    dom.aiScopeTrigger,
    dom.aiScopeLabel,
    dom.aiScopeCopy,
    {
      disabled: aiNamingState.running || aiNamingState.applying || availabilityState.catalogLoading,
      label: aiScopeMeta.label,
      copy: `当前范围：${aiScopeMeta.label}。书签智能分析只会读取该范围里的 http/https 书签，并基于网页内容生成标签和标题建议。`
    }
  )
}

function renderScopeTriggerControl(triggerElement, labelElement, copyElement, { disabled, label, copy }) {
  if (!triggerElement || !labelElement || !copyElement) {
    return
  }

  labelElement.textContent = label
  triggerElement.disabled = disabled
  triggerElement.title = label
  copyElement.textContent = copy
}

function renderScopeModal() {
  if (!dom.scopeModalBackdrop) {
    return
  }

  setManagedModalHidden(
    'scope',
    dom.scopeModalBackdrop,
    managerState.scopeModalOpen,
    dom.scopeSearchInput
  )

  if (!managerState.scopeModalOpen) {
    return
  }

  const sourceLabel =
    managerState.scopeModalSource === 'history'
      ? '历史范围'
      : managerState.scopeModalSource === 'ai'
        ? '书签智能分析范围'
        : '检测范围'
  const normalizedQuery = normalizeText(managerState.scopeSearchQuery)
  const folders = availabilityState.allFolders
    .filter((folder) => {
      if (!normalizedQuery) {
        return true
      }

      return folder.normalizedTitle.includes(normalizedQuery) || folder.normalizedPath.includes(normalizedQuery)
    })
    .sort((left, right) => compareByPathTitle(left, right))

  dom.scopeModalCopy.textContent = managerState.scopeModalSource === 'ai'
    ? '请选择一个文件夹作为当前书签智能分析范围，支持搜索文件夹名称或路径；选择后会立即更新可处理书签列表。'
    : `请选择一个文件夹作为当前${sourceLabel}，支持搜索文件夹名称或路径；选择后会立即更新可用性检测与历史记录视图。`
  dom.scopeSearchInput.value = managerState.scopeSearchQuery

  const activeScopeFolderId = getCurrentScopeFolderId()
  const allSelected = !activeScopeFolderId
  const activeId = resolveScopeFolderActiveId(folders, activeScopeFolderId)
  const allActive = activeId === ''
  const allOption = `
    <button
      class="scope-folder-card ${allSelected ? 'current' : ''}"
      type="button"
      role="option"
      aria-selected="${allSelected ? 'true' : 'false'}"
      data-scope-folder-id=""
      tabindex="${allActive ? '0' : '-1'}"
    >
      <div class="scope-folder-head">
        <span class="scope-folder-icon" aria-hidden="true"></span>
        <strong>全部书签</strong>
      </div>
      <span>不限制来源文件夹</span>
    </button>
  `

  if (!folders.length) {
    dom.scopeFolderResults.innerHTML = `${allOption}<div class="detect-empty" role="presentation">没有匹配的文件夹。</div>`
    return
  }

  dom.scopeFolderResults.innerHTML = `
    ${allOption}
    ${folders.map((folder) => buildScopeFolderCard(folder)).join('')}
  `
}

function buildScopeFolderCard(folder) {
  const activeScopeFolderId = getCurrentScopeFolderId()
  const isCurrent = String(folder.id) === String(activeScopeFolderId || '')
  const isActive = String(folder.id) === String(managerState.scopeFolderActiveId || '')

  return `
    <button
      class="scope-folder-card ${isCurrent ? 'current' : ''}"
      type="button"
      role="option"
      aria-selected="${isCurrent ? 'true' : 'false'}"
      data-scope-folder-id="${escapeAttr(folder.id)}"
      tabindex="${isActive ? '0' : '-1'}"
      title="${escapeAttr(folder.path || folder.title || '未命名文件夹')}"
    >
      <div class="scope-folder-head">
        <span class="scope-folder-icon" aria-hidden="true"></span>
        <strong>${escapeHtml(folder.title || '未命名文件夹')}</strong>
      </div>
      <span>${escapeHtml(folder.path || folder.title || '未命名文件夹')}</span>
    </button>
  `
}

function getCurrentScopeFolderId() {
  return managerState.scopeModalSource === 'ai'
    ? aiNamingState.scopeFolderId
    : availabilityState.scopeFolderId
}

function getScopeFolderOptionButtons() {
  return [...dom.scopeFolderResults.querySelectorAll<HTMLButtonElement>('[data-scope-folder-id]')]
}

function resolveScopeFolderActiveId(folders, activeScopeFolderId = getCurrentScopeFolderId()) {
  const optionIds = new Set(['', ...folders.map((folder) => String(folder.id || ''))])
  const storedActiveId = managerState.scopeFolderActiveId === null
    ? null
    : String(managerState.scopeFolderActiveId || '')
  const selectedId = String(activeScopeFolderId || '')
  const activeId = storedActiveId !== null && optionIds.has(storedActiveId)
    ? storedActiveId
    : optionIds.has(selectedId)
      ? selectedId
      : ''

  managerState.scopeFolderActiveId = activeId
  return activeId
}

function renderReviewResults() {
  if (!dom.availabilityReviewResults) {
    return
  }

  const panelResults = getAvailabilityPanelResults('review')
  const activeFilter = getAvailabilityFilter()
  const emptyLabel = getAvailabilityPanelCountLabel('review')

  if (isAvailabilityPanelHidden('review')) {
    dom.availabilityReviewResults.innerHTML = `<div class="detect-empty">当前筛选不包含低置信异常区。可切换到“全部”或“待确认”查看。</div>`
    renderResultsPagination(dom.availabilityReviewPagination, 'availability-review', 0, '低置信异常')
    return
  }

  if (!availabilityState.lastCompletedAt && !availabilityState.running) {
    dom.availabilityReviewResults.innerHTML = '<div class="detect-empty">开始检测后，这里会展示证据不足以直接判定为高置信异常的书签。</div>'
    renderResultsPagination(dom.availabilityReviewPagination, 'availability-review', 0, '低置信异常')
    return
  }

  if (availabilityState.running && !panelResults.length) {
    dom.availabilityReviewResults.innerHTML = `<div class="detect-empty">正在多层检测，暂时还没有${escapeHtml(emptyLabel)}。</div>`
    renderResultsPagination(dom.availabilityReviewPagination, 'availability-review', 0, emptyLabel)
    return
  }

  if (!panelResults.length) {
    dom.availabilityReviewResults.innerHTML = `<div class="detect-empty">${escapeHtml(getAvailabilityEmptyCopy('review', activeFilter))}</div>`
    renderResultsPagination(dom.availabilityReviewPagination, 'availability-review', 0, emptyLabel)
    return
  }

  const pageResults = getPaginatedResults('availability-review', panelResults)
  dom.availabilityReviewResults.innerHTML = pageResults
    .map((result) => buildAvailabilityDisplayCard(result, 'review'))
    .join('')
  renderResultsPagination(
    dom.availabilityReviewPagination,
    'availability-review',
    panelResults.length,
    emptyLabel
  )
}

function renderFailedResults() {
  if (!dom.availabilityResults) {
    return
  }

  const panelResults = getAvailabilityPanelResults('failed')
  const activeFilter = getAvailabilityFilter()
  const emptyLabel = getAvailabilityPanelCountLabel('failed')

  if (isAvailabilityPanelHidden('failed')) {
    dom.availabilityResults.innerHTML = '<div class="detect-empty">当前筛选不包含高置信异常区。可切换到“全部”或“高置信”查看。</div>'
    renderResultsPagination(dom.availabilityFailedPagination, 'availability-failed', 0, '高置信异常')
    return
  }

  if (availabilityState.running && !panelResults.length) {
    dom.availabilityResults.innerHTML = `<div class="detect-empty">正在多层检测，暂时还没有发现${escapeHtml(emptyLabel)}。</div>`
    renderResultsPagination(dom.availabilityFailedPagination, 'availability-failed', 0, emptyLabel)
    return
  }

  if (availabilityState.lastError && !availabilityState.lastCompletedAt && !panelResults.length) {
    dom.availabilityResults.innerHTML = `<div class="detect-empty">${escapeHtml(availabilityState.lastError)}</div>`
    renderResultsPagination(dom.availabilityFailedPagination, 'availability-failed', 0, emptyLabel)
    return
  }

  if (!availabilityState.lastCompletedAt && !availabilityState.running) {
    dom.availabilityResults.innerHTML = '<div class="detect-empty">开始检测后，这里会展示多层验证后仍可判定为高置信异常的书签。</div>'
    renderResultsPagination(dom.availabilityFailedPagination, 'availability-failed', 0, '高置信异常')
    return
  }

  if (!panelResults.length) {
    dom.availabilityResults.innerHTML = `<div class="detect-empty">${escapeHtml(getAvailabilityEmptyCopy('failed', activeFilter))}</div>`
    renderResultsPagination(dom.availabilityFailedPagination, 'availability-failed', 0, emptyLabel)
    return
  }

  const pageResults = getPaginatedResults('availability-failed', panelResults)
  dom.availabilityResults.innerHTML = pageResults
    .map((result) => buildAvailabilityDisplayCard(result, 'failed'))
    .join('')
  renderResultsPagination(
    dom.availabilityFailedPagination,
    'availability-failed',
    panelResults.length,
    emptyLabel
  )
}

function getAvailabilityPanelResults(panel) {
  const filter = getAvailabilityFilter()

  if (panel === 'review') {
    if (filter === 'recovered') {
      return managerState.historyRecoveredResults.map((result) => ({
        ...result,
        status: 'recovered'
      }))
    }
    if (!shouldShowAbnormalPanelForFilter(filter)) {
      return []
    }
    return filterAvailabilityAbnormalResults(availabilityState.reviewResults, filter)
  }

  if (filter === 'redirected') {
    return availabilityState.redirectResults.slice()
  }
  if (filter === 'ignored') {
    return managerState.suppressedResults.slice()
  }
  if (!shouldShowAbnormalPanelForFilter(filter)) {
    return []
  }

  return filterAvailabilityAbnormalResults(availabilityState.failedResults, filter)
}

function shouldShowAbnormalPanelForFilter(filter) {
  return filter === 'all' ||
    filter === 'failed' ||
    filter === 'review' ||
    filter === 'new' ||
    filter === 'persistent'
}

function filterAvailabilityAbnormalResults(results, filter) {
  if (filter === 'failed') {
    return results.filter((result) => result.status === 'failed')
  }
  if (filter === 'review') {
    return results.filter((result) => result.status === 'review')
  }
  if (filter === 'new') {
    return results.filter((result) => result.historyStatus === 'new')
  }
  if (filter === 'persistent') {
    return results.filter((result) => result.historyStatus === 'persistent')
  }

  return results.slice()
}

function isAvailabilityPanelHidden(panel) {
  const filter = getAvailabilityFilter()
  if (panel === 'review') {
    return filter === 'redirected' || filter === 'ignored' || filter === 'failed'
  }

  return filter === 'recovered' || filter === 'review'
}

function getAvailabilityEmptyCopy(panel, filter) {
  if (filter === 'new') {
    return '当前结果中没有相较上次新增的异常。'
  }
  if (filter === 'persistent') {
    return '当前结果中没有连续出现的异常。'
  }
  if (filter === 'redirected') {
    return '最近一次检测没有发现重定向结果。'
  }
  if (filter === 'ignored') {
    return '当前没有被忽略规则过滤的异常结果。'
  }
  if (filter === 'recovered') {
    return '最近一次检测没有相较上次已恢复的书签。'
  }
  if (filter === 'failed' || panel === 'failed') {
    return '最近一次检测未发现高置信异常书签。'
  }

  return '最近一次检测没有低置信异常书签。'
}

function renderMoveModal() {
  if (!dom.moveModalBackdrop) {
    return
  }

  setManagedModalHidden(
    'move',
    dom.moveModalBackdrop,
    managerState.moveModalOpen,
    dom.moveSearchInput
  )

  if (!managerState.moveModalOpen) {
    return
  }

  const selectedResults = managerState.moveSelectionSource === 'dashboard'
    ? getSelectedDashboardBookmarks()
    : managerState.moveSelectionSource === 'dashboard-single'
      ? [getSingleDashboardMoveBookmark()].filter(Boolean)
      : getSelectedAvailabilityResults()
  const normalizedQuery = normalizeText(managerState.moveSearchQuery)
  const folders = availabilityState.allFolders
    .filter((folder) => String(folder.id) !== ROOT_ID)
    .filter((folder) => {
      if (!normalizedQuery) {
        return true
      }

      return folder.normalizedTitle.includes(normalizedQuery) || folder.normalizedPath.includes(normalizedQuery)
    })
    .sort((left, right) => compareByPathTitle(left, right))

  dom.moveModalCopy.textContent = managerState.moveSelectionSource === 'dashboard-single'
    ? '请选择一个目标文件夹，这条书签会被移动到该位置。'
    : selectedResults.length
      ? `请选择一个目标文件夹，已选 ${selectedResults.length} 条书签会被一起移动到该位置。`
      : '请选择一个目标文件夹，所选书签会被一起移动到该位置。'
  dom.moveSearchInput.value = managerState.moveSearchQuery

  if (!folders.length) {
    managerState.moveFolderActiveId = ''
    dom.moveFolderResults.innerHTML = '<div class="detect-empty">没有匹配的目标文件夹。</div>'
    return
  }

  resolveMoveFolderActiveId(folders)
  dom.moveFolderResults.innerHTML = folders
    .map((folder) => buildMoveFolderCard(folder))
    .join('')
}

function buildAvailabilityResultCard(result, tone) {
  return buildAvailabilityDisplayCard(result, tone === 'warning' ? 'review' : 'failed')
}

function buildAvailabilityDisplayCard(result, panel) {
  const status = String(result?.status || '')
  const isSelectable = status === 'review' || status === 'failed'
  const selected = isSelectable && managerState.selectedAvailabilityIds.has(String(result.id))
  const interactionLocked = isInteractionLocked()
  const tone = getAvailabilityResultTone(result, panel)
  const statusLabel = getAvailabilityResultStatusLabel(result)
  const actionLocked = isAvailabilityResultActionLocked()
  const actionButton = getAvailabilityConfidenceMoveAction(result, actionLocked)
  const selectionLabel = getAvailabilityResultActionLabel('选择异常书签', result)
  const openLabel = getAvailabilityResultActionLabel('打开异常书签链接', result)
  const quickActions = buildAvailabilityQuickActions(result, actionLocked)
  const metadataItems = getAvailabilityResultMetadata(result)
  const evidenceCopy = getAvailabilityEvidenceSummary(result)
  const recommendation = getAvailabilityResultRecommendation(result)
  const finalUrl = String(result?.finalUrl || '').trim()
  const showFinalUrl = finalUrl && isRedirectedNavigation(result?.url || '', finalUrl)

  return `
    <article class="detect-result-card availability-result-card ${selected ? 'selected' : ''}">
      <div class="detect-result-head">
        <div class="detect-result-head-left">
          ${isSelectable ? `
            <label class="detect-result-check">
              <input
                type="checkbox"
                data-availability-select="true"
                data-bookmark-id="${escapeAttr(result.id)}"
                aria-label="${escapeAttr(selectionLabel)}"
                ${selected ? 'checked' : ''}
                ${interactionLocked ? 'disabled' : ''}
              >
              <span>选择</span>
            </label>
          ` : ''}
          <span class="options-chip ${tone}">${escapeHtml(statusLabel)}</span>
          <span class="options-chip muted">${escapeHtml(result.badgeText || getAvailabilityResultFallbackBadge(result))}</span>
        </div>
        <div class="detect-result-actions">
          ${actionButton}
          ${isCheckableUrl(result?.url) ? `
            <a
              class="detect-result-open"
              href="${escapeAttr(result.url)}"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="${escapeAttr(openLabel)}"
            >
              打开链接
            </a>
          ` : ''}
        </div>
      </div>
      <div class="detect-result-copy">
        <strong>${escapeHtml(result.title || '未命名书签')}</strong>
        ${result.url ? `
          <a
            class="detect-result-url"
            href="${escapeAttr(result.url)}"
            target="_blank"
            rel="noreferrer noopener"
          >
            ${escapeHtml(displayUrl(result.url))}
          </a>
        ` : '<p class="detect-result-url">无可打开 URL</p>'}
        ${showFinalUrl ? `<p class="detect-result-detail">最终地址：${escapeHtml(displayUrl(finalUrl))}</p>` : ''}
        <p class="detect-result-detail">${escapeHtml(recommendation)}</p>
        <p class="detect-result-detail">证据摘要：${escapeHtml(evidenceCopy)}</p>
        <p class="detect-result-path" title="${escapeAttr(result.path || '未归档路径')}">路径：${escapeHtml(result.path || '未归档路径')}</p>
        <div class="availability-result-meta">
          ${metadataItems.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}
        </div>
        ${quickActions}
      </div>
    </article>
  `
}

function getAvailabilityResultTone(result, panel) {
  const status = String(result?.status || '')
  if (status === 'failed') {
    return 'danger'
  }
  if (status === 'review') {
    return 'warning'
  }
  if (status === 'redirected' || status === 'recovered') {
    return 'success'
  }
  if (panel === 'failed') {
    return 'danger'
  }
  return 'muted'
}

function getAvailabilityResultStatusLabel(result) {
  const status = String(result?.status || '')
  if (status === 'failed') {
    return '高置信异常'
  }
  if (status === 'review') {
    return '待确认'
  }
  if (status === 'redirected') {
    return '重定向'
  }
  if (status === 'recovered') {
    return '已恢复'
  }
  return '已忽略过滤'
}

function getAvailabilityResultFallbackBadge(result) {
  const status = String(result?.status || '')
  if (status === 'failed') {
    return '多层验证异常'
  }
  if (status === 'review') {
    return '证据不足'
  }
  if (status === 'redirected') {
    return 'URL 变化'
  }
  if (status === 'recovered') {
    return '本轮未再异常'
  }
  return '忽略规则命中'
}

function getAvailabilityResultActionLabel(action, result) {
  const title = String(result?.title || displayUrl(result?.url) || '未命名书签')
    .replace(/\s+/g, ' ')
    .trim()
  const path = String(result?.path || '')
    .replace(/\s+/g, ' ')
    .trim()
  const safeTitle = title.length > 48 ? `${title.slice(0, 47).trim()}…` : title
  const safePath = path.length > 48 ? `${path.slice(0, 47).trim()}…` : path

  return `${action}：${safeTitle || '未命名书签'}${safePath ? `，位置：${safePath}` : ''}`
}

function getAvailabilityConfidenceMoveAction(result, interactionLocked) {
  if (result.status === 'review') {
    const actionLabel = getAvailabilityResultActionLabel('移入高置信异常', result)

    return `
      <button
        class="detect-result-action"
        type="button"
        data-review-action="promote-failed"
        data-bookmark-id="${escapeAttr(result.id)}"
        aria-label="${escapeAttr(actionLabel)}"
        ${interactionLocked ? 'disabled' : ''}
      >
        移入高置信异常
      </button>
    `
  }

  if (result.status === 'failed') {
    const actionLabel = getAvailabilityResultActionLabel('移回低置信异常', result)

    return `
      <button
        class="detect-result-action"
        type="button"
        data-failed-action="demote-review"
        data-bookmark-id="${escapeAttr(result.id)}"
        aria-label="${escapeAttr(actionLabel)}"
        ${interactionLocked ? 'disabled' : ''}
      >
        移回低置信异常
      </button>
    `
  }

  return ''
}

function buildAvailabilityQuickActions(result, interactionLocked) {
  if (result.status !== 'review' && result.status !== 'failed') {
    return ''
  }

  const domainDisabled = !String(result.domain || '').trim()
  const folderDisabled = !String(result.parentId || '').trim()
  const bookmarkIgnored = managerState.ignoreRules.bookmarkIds.has(String(result.id))
  const domainIgnored = result.domain && managerState.ignoreRules.domainValues.has(String(result.domain))
  const folderIgnored = result.parentId && managerState.ignoreRules.folderIds.has(String(result.parentId))

  return `
    <div class="availability-result-actions" aria-label="异常结果忽略操作">
      ${buildAvailabilityQuickActionButton({
        action: 'hide-run',
        bookmarkId: result.id,
        label: '本次隐藏',
        impact: '只从当前结果移除',
        disabled: interactionLocked
      })}
      ${buildAvailabilityQuickActionButton({
        action: 'ignore-bookmark',
        bookmarkId: result.id,
        label: bookmarkIgnored ? '已忽略书签' : '忽略此书签',
        impact: '以后不再检测此条',
        disabled: interactionLocked || bookmarkIgnored
      })}
      ${buildAvailabilityQuickActionButton({
        action: 'never-check',
        bookmarkId: result.id,
        label: bookmarkIgnored ? '已不再检测' : '以后不再检测',
        impact: '同“忽略此书签”',
        disabled: interactionLocked || bookmarkIgnored
      })}
      ${buildAvailabilityQuickActionButton({
        action: 'ignore-domain',
        bookmarkId: result.id,
        label: domainIgnored ? '已忽略域名' : '忽略此域名',
        impact: result.domain ? `影响 ${result.domain}` : '无可用域名',
        disabled: interactionLocked || domainDisabled || Boolean(domainIgnored)
      })}
      ${buildAvailabilityQuickActionButton({
        action: 'ignore-folder',
        bookmarkId: result.id,
        label: folderIgnored ? '已忽略文件夹' : '忽略此文件夹',
        impact: result.path || '无可用文件夹',
        disabled: interactionLocked || folderDisabled || Boolean(folderIgnored)
      })}
    </div>
  `
}

function buildAvailabilityQuickActionButton({ action, bookmarkId, label, impact, disabled }) {
  return `
    <span class="availability-result-action-pair">
      <button
        class="detect-result-action"
        type="button"
        data-availability-result-action="${escapeAttr(action)}"
        data-bookmark-id="${escapeAttr(bookmarkId)}"
        aria-label="${escapeAttr(`${label}：${impact}`)}"
        title="${escapeAttr(impact)}"
        ${disabled ? 'disabled' : ''}
      >
        ${escapeHtml(label)}
      </button>
      <span>${escapeHtml(impact)}</span>
    </span>
  `
}

function getAvailabilityResultMetadata(result) {
  const metadata = []
  metadata.push(`状态：${getAvailabilityResultStatusLabel(result)}`)
  metadata.push(`置信度：${getAvailabilityConfidenceLabel(result)}`)

  if (result.status === 'review' || result.status === 'failed') {
    metadata.push(`连续异常：${Math.max(1, Number(result.abnormalStreak) || 1)} 次`)
    metadata.push(`历史：${result.historyStatus === 'persistent' ? '持续异常' : result.historyStatus === 'new' ? '新增异常' : '无上次记录'}`)
  }

  metadata.push(`上次检测：${availabilityState.lastCompletedAt ? formatDateTime(availabilityState.lastCompletedAt) : availabilityState.running ? '本轮检测中' : '尚无记录'}`)
  return metadata
}

function getAvailabilityConfidenceLabel(result) {
  const status = String(result?.status || '')
  if (status === 'failed') {
    return '高'
  }
  if (status === 'review') {
    return '低'
  }
  if (status === 'redirected') {
    return '重定向待确认'
  }
  if (status === 'recovered') {
    return '已恢复'
  }
  return '已过滤'
}

function getAvailabilityEvidenceSummary(result) {
  const detail = String(result?.detail || '').replace(/\s+/g, ' ').trim()
  if (detail) {
    return truncateText(detail, 180)
  }

  if (result.status === 'redirected' && result.finalUrl) {
    return `后台导航落地到 ${displayUrl(result.finalUrl)}。`
  }

  if (result.status === 'recovered') {
    return '该书签在上一轮异常，本轮结果中未再次出现。'
  }

  return '当前结果缺少更细的检测证据。'
}

function buildMoveFolderCard(folder) {
  const isActive = String(folder.id) === String(managerState.moveFolderActiveId || '')
  return `
    <button
      class="move-folder-card"
      type="button"
      role="option"
      aria-selected="false"
      data-move-target-folder="${escapeAttr(folder.id)}"
      tabindex="${isActive ? '0' : '-1'}"
      ${isInteractionLocked() ? 'disabled' : ''}
    >
      <strong>${escapeHtml(folder.title || '未命名文件夹')}</strong>
      <span>${escapeHtml(folder.path || folder.title || '文件夹')}</span>
    </button>
  `
}

function promoteReviewResultToFailed(bookmarkId) {
  const reviewIndex = availabilityState.reviewResults.findIndex((result) => {
    return String(result.id) === String(bookmarkId)
  })

  if (reviewIndex === -1) {
    return
  }

  const [result] = availabilityState.reviewResults.splice(reviewIndex, 1)
  const movedResult = {
    ...result,
    status: 'failed',
    badgeText: '手动移入异常',
    detail: appendManualPromotionDetail(result.detail)
  }

  availabilityState.reviewCount = availabilityState.reviewResults.length
  upsertResult(availabilityState.failedResults, movedResult)
  availabilityState.failedCount = availabilityState.failedResults.length
  syncHistoryEntryStatus(bookmarkId, 'failed')
  sortResultsByPath(availabilityState.reviewResults)
  sortResultsByPath(availabilityState.failedResults)
  persistPendingAvailabilitySnapshotSoon()
  renderAvailabilitySection()
}

function appendManualPromotionDetail(detail) {
  const normalizedDetail = normalizeManualMoveDetail(detail)
  const promotionNote = '已由你手动移入高置信异常，可参与批量删除。'

  if (!normalizedDetail) {
    return promotionNote
  }

  if (normalizedDetail.includes(promotionNote)) {
    return normalizedDetail
  }

  return `${normalizedDetail} ${promotionNote}`
}

function demoteFailedResultToReview(bookmarkId) {
  const failedIndex = availabilityState.failedResults.findIndex((result) => {
    return String(result.id) === String(bookmarkId)
  })

  if (failedIndex === -1) {
    return
  }

  const [result] = availabilityState.failedResults.splice(failedIndex, 1)
  const movedResult = {
    ...result,
    status: 'review',
    badgeText: '手动移回低置信',
    detail: appendManualReviewDetail(result.detail)
  }

  availabilityState.failedCount = availabilityState.failedResults.length
  upsertResult(availabilityState.reviewResults, movedResult)
  availabilityState.reviewCount = availabilityState.reviewResults.length
  syncHistoryEntryStatus(bookmarkId, 'review')
  sortResultsByPath(availabilityState.reviewResults)
  sortResultsByPath(availabilityState.failedResults)
  persistPendingAvailabilitySnapshotSoon()
  renderAvailabilitySection()
}

function appendManualReviewDetail(detail) {
  const normalizedDetail = normalizeManualMoveDetail(detail)
  const reviewNote = '已由你手动移回低置信异常，不再参与批量删除。'

  if (!normalizedDetail) {
    return reviewNote
  }

  if (normalizedDetail.includes(reviewNote)) {
    return normalizedDetail
  }

  return `${normalizedDetail} ${reviewNote}`
}

function normalizeManualMoveDetail(detail) {
  return String(detail || '')
    .replace(/\s*已由你手动移入高置信异常，可参与批量删除。/g, '')
    .replace(/\s*已由你手动移回低置信异常，不再参与批量删除。/g, '')
    .trim()
}

function upsertResult(collection, nextResult) {
  const existingIndex = collection.findIndex((result) => {
    return String(result.id) === String(nextResult.id)
  })

  if (existingIndex === -1) {
    collection.push(nextResult)
    return
  }

  collection[existingIndex] = nextResult
}

function sortResultsByPath(results) {
  results.sort((left, right) => compareByPathTitle(left, right))
}

function toggleAvailabilitySelection(bookmarkId, checked) {
  const normalizedId = String(bookmarkId || '').trim()
  if (!normalizedId) {
    return
  }

  if (checked) {
    managerState.selectedAvailabilityIds.add(normalizedId)
  } else {
    managerState.selectedAvailabilityIds.delete(normalizedId)
  }

  renderAvailabilitySection()
}

function clearAvailabilitySelection() {
  managerState.selectedAvailabilityIds.clear()
  renderAvailabilitySection()
}

function getSelectedAvailabilityResults() {
  const resultMap = new Map(
    [...availabilityState.reviewResults, ...availabilityState.failedResults].map((result) => [
      String(result.id),
      result
    ])
  )

  return [...managerState.selectedAvailabilityIds]
    .map((bookmarkId) => resultMap.get(String(bookmarkId)))
    .filter(Boolean)
}

function selectAvailabilityResultsByStatus(status) {
  const targetResults = (status === 'failed'
    ? availabilityState.failedResults
    : availabilityState.reviewResults
  )
    .map((result) => String(result.id))

  if (status === 'failed') {
    resetResultsPage('availability-failed')
  } else {
    resetResultsPage('availability-review')
  }

  managerState.selectedAvailabilityIds = new Set([
    ...managerState.selectedAvailabilityIds,
    ...targetResults
  ])

  renderAvailabilitySection()
}

function moveSelectedAvailabilityResults(targetStatus) {
  if (isInteractionLocked()) {
    return
  }

  const selectedResults = getSelectedAvailabilityResults()
  if (!selectedResults.length) {
    return
  }

  selectedResults.forEach((result) => {
    if (targetStatus === 'failed' && result.status === 'review') {
      promoteReviewResultToFailed(result.id)
    }

    if (targetStatus === 'review' && result.status === 'failed') {
      demoteFailedResultToReview(result.id)
    }
  })
}

async function retestSelectedAvailabilityResults() {
  if (
    isInteractionLocked() ||
    availabilityState.catalogLoading ||
    availabilityState.requestingPermission
  ) {
    return
  }

  const selectedResults = getSelectedAvailabilityResults()
  if (!selectedResults.length) {
    return
  }

  const targetBookmarks = selectedResults
    .map((result) => availabilityState.bookmarkMap.get(String(result.id)) || result)
    .filter((bookmark) => isCheckableUrl(bookmark?.url))

  if (!targetBookmarks.length) {
    availabilityState.lastError = '所选书签中没有可重新测试的 http/https 链接。'
    renderAvailabilitySection()
    return
  }

  availabilityState.lastError = ''
  const probeEnabled = await ensureProbePermissionForRun({ interactive: true })
  availabilityState.retestingSelection = true
  availabilityState.runStartedAt = Date.now()
  availabilityState.retestSelectionTotal = targetBookmarks.length
  availabilityState.retestSelectionCompleted = 0
  availabilityState.retestSelectionProbeEnabled = probeEnabled
  const scheduler = createAvailabilityScheduler()
  updateAvailabilityRunnerStatus(scheduler)
  renderAvailabilitySection()

  let processedCount = 0

  try {
    await runAvailabilityQueue({
      items: targetBookmarks,
      scheduler,
      getUrl: (bookmark) => bookmark?.url,
      shouldSkip: (bookmark) => !bookmark,
      wait: waitForAvailabilityQueueDelay,
      onWait: () => {
        updateAvailabilityRunnerStatus(scheduler)
      },
      onItemSettled: () => {
        availabilityState.retestSelectionCompleted += 1
        updateAvailabilityRunnerStatus(scheduler)
        scheduleAvailabilityRender()
      },
      processItem: async (bookmark) => {
        if (isBookmarkRemovedDuringRun(bookmark.id)) {
          return
        }

        const result = await inspectBookmarkAvailability(bookmark, { probeEnabled, scheduler })
        if (result && !isBookmarkRemovedDuringRun(result.id)) {
          applyRetestedAvailabilityResult(result)
          processedCount += 1
        }
      }
    })

    sortResultsByPath(availabilityState.reviewResults)
    sortResultsByPath(availabilityState.failedResults)
    sortResultsByPath(availabilityState.redirectResults)

    try {
      await persistRedirectCacheSnapshot(redirectsCallbacks, {
        savedAt: Date.now(),
        scope: getCurrentAvailabilityScopeMeta()
      })
    } catch {}
    try {
      await persistPendingAvailabilitySnapshot()
    } catch {}

    availabilityState.lastError = `已重新测试 ${processedCount} 条已选书签。`
  } catch (error) {
    availabilityState.lastError =
      error instanceof Error
        ? `重新测试所选书签失败：${error.message}`
        : '重新测试所选书签失败，请稍后重试。'
  } finally {
    availabilityState.retestingSelection = false
    availabilityState.retestSelectionTotal = 0
    availabilityState.retestSelectionCompleted = 0
    availabilityState.retestSelectionProbeEnabled = false
    updateAvailabilityRunnerStatus(scheduler)
    renderAvailabilitySection()
  }
}

function applyRetestedAvailabilityResult(result) {
  const bookmarkId = String(result?.id || '').trim()
  if (!bookmarkId) {
    return
  }

  const shouldKeepSelected = managerState.selectedAvailabilityIds.has(bookmarkId)
  removeAvailabilityResultById(bookmarkId)

  if (result.status === 'available') {
    availabilityState.availableCount += 1
    managerState.selectedAvailabilityIds.delete(bookmarkId)
    return
  }

  if (result.status === 'redirected') {
    upsertResult(availabilityState.redirectResults, {
      ...result,
      finalUrl: result.finalUrl || result.url
    })
    availabilityState.redirectedCount = availabilityState.redirectResults.length
    managerState.selectedAvailabilityIds.delete(bookmarkId)
    return
  }

  const historyStatus = managerState.previousHistoryMap.has(bookmarkId) ? 'persistent' : 'new'
  const abnormalStreak = managerState.previousHistoryMap.has(bookmarkId)
    ? getHistoricalAbnormalStreak(bookmarkId, historyCallbacks) + 1
    : 1
  const nextResult = {
    ...result,
    historyStatus,
    abnormalStreak
  }

  upsertAvailabilityHistoryEntry(nextResult)

  if (matchesIgnoreRules(nextResult)) {
    upsertResult(managerState.suppressedResults, nextResult)
    availabilityState.ignoredCount = managerState.suppressedResults.length
    managerState.selectedAvailabilityIds.delete(bookmarkId)
    return
  }

  if (nextResult.status === 'review') {
    upsertResult(availabilityState.reviewResults, nextResult)
    availabilityState.reviewCount = availabilityState.reviewResults.length
  } else {
    upsertResult(availabilityState.failedResults, nextResult)
    availabilityState.failedCount = availabilityState.failedResults.length
  }

  if (shouldKeepSelected) {
    managerState.selectedAvailabilityIds.add(bookmarkId)
  }
}

function removeAvailabilityResultById(bookmarkId) {
  const normalizedId = String(bookmarkId || '').trim()
  if (!normalizedId) {
    return
  }

  availabilityState.reviewResults = availabilityState.reviewResults.filter((result) => {
    return String(result.id) !== normalizedId
  })
  availabilityState.failedResults = availabilityState.failedResults.filter((result) => {
    return String(result.id) !== normalizedId
  })
  managerState.suppressedResults = managerState.suppressedResults.filter((result) => {
    return String(result.id) !== normalizedId
  })
  managerState.currentHistoryEntries = managerState.currentHistoryEntries.filter((entry) => {
    return String(entry.id) !== normalizedId
  })
  removeRedirectIdsFromState([normalizedId])

  availabilityState.reviewCount = availabilityState.reviewResults.length
  availabilityState.failedCount = availabilityState.failedResults.length
  availabilityState.ignoredCount = managerState.suppressedResults.length
}

async function ignoreSelectedAvailabilityResults(kind) {
  if (isInteractionLocked()) {
    return
  }

  const selectedResults = getSelectedAvailabilityResults()
  if (!selectedResults.length) {
    return
  }

  let addedCount = 0

  for (const result of selectedResults) {
    if (addAvailabilityIgnoreRule(result, kind)) {
      addedCount += 1
    }
  }

  if (!addedCount) {
    availabilityState.lastError = '没有新增忽略规则。'
    renderAvailabilitySection()
    return
  }

  await saveIgnoreRules()
  repartitionAvailabilityResultsByIgnoreRules()
  persistPendingAvailabilitySnapshotSoon()
  clearAvailabilitySelection()
  availabilityState.lastError = `已新增 ${addedCount} 条忽略规则。`
  renderAvailabilitySection()
}

async function ignoreSingleAvailabilityResult(bookmarkId, kind) {
  if (isAvailabilityResultActionLocked()) {
    return
  }

  const result = getAvailabilityResultById(bookmarkId)
  if (!result) {
    availabilityState.lastError = '未找到这条检测结果。'
    renderAvailabilitySection()
    return
  }

  const added = addAvailabilityIgnoreRule(result, kind)
  if (!added) {
    availabilityState.lastError = '没有新增忽略规则。'
    renderAvailabilitySection()
    return
  }

  await saveIgnoreRules()
  repartitionAvailabilityResultsByIgnoreRules()
  persistPendingAvailabilitySnapshotSoon()
  availabilityState.lastError = `已${getIgnoreKindActionLabel(kind)}，后续检测会自动过滤。`
  renderAvailabilitySection()
}

function addAvailabilityIgnoreRule(result, kind) {
  if (!result) {
    return false
  }

  if (kind === 'bookmark') {
    const bookmarkId = String(result.id || '').trim()
    if (!bookmarkId || managerState.ignoreRules.bookmarkIds.has(bookmarkId)) {
      return false
    }

    managerState.ignoreRules.bookmarks.push({
      bookmarkId,
      title: result.title,
      url: result.url,
      createdAt: Date.now()
    })
    managerState.ignoreRules.bookmarkIds.add(bookmarkId)
    return true
  }

  if (kind === 'domain') {
    const domain = String(result.domain || '').trim().toLowerCase()
    if (!domain || managerState.ignoreRules.domainValues.has(domain)) {
      return false
    }

    managerState.ignoreRules.domains.push({
      domain,
      createdAt: Date.now()
    })
    managerState.ignoreRules.domainValues.add(domain)
    return true
  }

  if (kind === 'folder') {
    const folderId = String(result.parentId || '').trim()
    if (!folderId || managerState.ignoreRules.folderIds.has(folderId)) {
      return false
    }

    const folder = availabilityState.folderMap.get(folderId)
    managerState.ignoreRules.folders.push({
      folderId,
      title: folder?.title || '未命名文件夹',
      path: folder?.path || result.path || '',
      createdAt: Date.now()
    })
    managerState.ignoreRules.folderIds.add(folderId)
    return true
  }

  return false
}

function getIgnoreKindActionLabel(kind) {
  if (kind === 'domain') {
    return '忽略此域名'
  }
  if (kind === 'folder') {
    return '忽略此文件夹'
  }
  return '忽略此书签'
}

function hideAvailabilityResultForCurrentRun(bookmarkId) {
  if (isAvailabilityResultActionLocked()) {
    return
  }

  const result = getAvailabilityResultById(bookmarkId)
  if (!result) {
    return
  }

  removeAvailabilityResultById(bookmarkId)
  managerState.selectedAvailabilityIds.delete(String(bookmarkId))
  persistPendingAvailabilitySnapshotSoon()
  availabilityState.lastError = `已从本次结果隐藏“${result.title || '未命名书签'}”。不会新增忽略规则，重新检测后可能再次出现。`
  renderAvailabilitySection()
}

function isAvailabilityResultActionLocked() {
  return availabilityState.deleting ||
    availabilityState.retestingSelection ||
    availabilityState.stopRequested ||
    (availabilityState.running && !availabilityState.paused)
}

function getAvailabilityResultById(bookmarkId) {
  const normalizedId = String(bookmarkId || '').trim()
  if (!normalizedId) {
    return null
  }

  return availabilityState.reviewResults.find((result) => String(result.id) === normalizedId) ||
    availabilityState.failedResults.find((result) => String(result.id) === normalizedId) ||
    managerState.suppressedResults.find((result) => String(result.id) === normalizedId) ||
    null
}

async function deleteSelectedAvailabilityResults() {
  if (isInteractionLocked()) {
    return
  }

  const selectedResults = getSelectedAvailabilityResults()
  if (!selectedResults.length) {
    return
  }

  const confirmed = await requestConfirmation({
    title: `删除 ${selectedResults.length} 条异常书签？`,
    copy: '这些书签会从 Chrome 书签中移除并进入回收站。你仍可在回收站里恢复它们，当前选择会被清空。',
    confirmLabel: '删除并移入回收站',
    label: '移入回收站',
    tone: 'danger'
  })
  if (!confirmed) {
    return
  }

  await deleteBookmarksToRecycle(
    selectedResults.map((result) => result.id),
    '异常书签批量删除',
    recycleCallbacks
  )
  clearAvailabilitySelection()
}

function openMoveModal(source) {
  if (isInteractionLocked()) {
    return
  }

  if (source === 'availability' && !getSelectedAvailabilityResults().length) {
    return
  }
  if (source === 'dashboard' && !getSelectedDashboardBookmarks().length) {
    return
  }
  if (source === 'dashboard-single' && !getSingleDashboardMoveBookmark()) {
    return
  }

  managerState.moveSelectionSource = source
  managerState.moveSearchQuery = ''
  managerState.moveFolderActiveId = ''
  managerState.moveModalOpen = true
  renderMoveModal()

  window.setTimeout(() => {
    dom.moveSearchInput?.focus()
  }, 0)
}

function openScopeModal(source) {
  const locked = source === 'ai'
    ? aiNamingState.running || aiNamingState.applying || availabilityState.catalogLoading
    : availabilityState.running || availabilityState.retestingSelection || availabilityState.deleting || availabilityState.catalogLoading

  if (locked) {
    return
  }

  managerState.scopeModalSource = source
  managerState.scopeSearchQuery = ''
  managerState.scopeFolderActiveId = getCurrentScopeFolderId()
  managerState.scopeModalOpen = true
  renderScopeModal()

  window.setTimeout(() => {
    dom.scopeSearchInput?.focus()
  }, 0)
}

function closeMoveModal() {
  if (availabilityState.deleting) {
    return
  }

  managerState.moveModalOpen = false
  managerState.moveSearchQuery = ''
  managerState.moveFolderActiveId = ''
  managerState.moveDashboardBookmarkId = ''
  renderMoveModal()
}

function closeScopeModal() {
  if (availabilityState.deleting) {
    return
  }

  managerState.scopeModalOpen = false
  managerState.scopeSearchQuery = ''
  managerState.scopeFolderActiveId = null
  renderScopeModal()
}

async function handleMoveFolderResultsClick(event) {
  const targetButton = event.target.closest('[data-move-target-folder]')
  if (!targetButton || isInteractionLocked()) {
    return
  }

  const folderId = String(targetButton.getAttribute('data-move-target-folder') || '').trim()
  if (!folderId) {
    return
  }
  managerState.moveFolderActiveId = folderId

  if (managerState.moveSelectionSource === 'dashboard') {
    await moveSelectedDashboardBookmarks(folderId, dashboardCallbacks)
    return
  }
  if (managerState.moveSelectionSource === 'dashboard-single') {
    await moveSingleDashboardBookmark(folderId, dashboardCallbacks)
    return
  }

  await moveSelectedAvailabilityToFolder(folderId)
}

function handleMoveSearchKeydown(event) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
    return
  }

  if (!getMoveFolderOptionButtons().length) {
    return
  }

  event.preventDefault()
  focusMoveFolderOption(event.key === 'ArrowDown' ? 'first' : 'last')
}

function handleMoveFolderResultsKeydown(event) {
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
    dom.moveSearchInput?.focus()
    return
  }

  if (event.key === 'Home') {
    focusMoveFolderOption('first')
  } else if (event.key === 'End') {
    focusMoveFolderOption('last')
  } else {
    focusMoveFolderOption(event.key === 'ArrowDown' ? 1 : -1)
  }
}

function handleMoveFolderResultsFocus(event) {
  const target = event.target
  if (!(target instanceof HTMLElement) || !target.dataset.moveTargetFolder) {
    return
  }

  managerState.moveFolderActiveId = target.dataset.moveTargetFolder
  syncMoveFolderTabStops(managerState.moveFolderActiveId)
}

function getMoveFolderOptionButtons() {
  return [...dom.moveFolderResults.querySelectorAll<HTMLButtonElement>('[data-move-target-folder]')]
}

function resolveMoveFolderActiveId(folders) {
  if (!folders.length) {
    managerState.moveFolderActiveId = ''
    return ''
  }

  const activeId = folders.some((folder) => folder.id === managerState.moveFolderActiveId)
    ? managerState.moveFolderActiveId
    : folders[0]?.id || ''
  managerState.moveFolderActiveId = activeId
  return activeId
}

function syncMoveFolderTabStops(activeId) {
  for (const button of getMoveFolderOptionButtons()) {
    button.tabIndex = button.dataset.moveTargetFolder === activeId ? 0 : -1
  }
}

function focusMoveFolderOptionById(folderId) {
  let targetButton = null
  for (const button of getMoveFolderOptionButtons()) {
    const isTarget = button.dataset.moveTargetFolder === folderId
    button.tabIndex = isTarget ? 0 : -1
    if (isTarget) {
      targetButton = button
    }
  }

  if (!targetButton) {
    return false
  }

  managerState.moveFolderActiveId = folderId
  targetButton.focus()
  return true
}

function focusMoveFolderOption(direction) {
  const buttons = getMoveFolderOptionButtons()
  if (!buttons.length) {
    return
  }

  const currentIndex = buttons.findIndex((button) => button === document.activeElement)
  let nextIndex = managerState.moveFolderActiveId
    ? buttons.findIndex((button) => button.dataset.moveTargetFolder === managerState.moveFolderActiveId)
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
  const folderId = String(button?.dataset.moveTargetFolder || '')
  if (folderId) {
    focusMoveFolderOptionById(folderId)
  }
}

async function handleScopeFolderResultsClick(event) {
  const targetButton = event.target.closest('[data-scope-folder-id]')
  if (
    !targetButton ||
    availabilityState.catalogLoading
  ) {
    return
  }

  const folderId = String(targetButton.getAttribute('data-scope-folder-id') || '').trim()
  managerState.scopeFolderActiveId = folderId
  const source = managerState.scopeModalSource
  if (source === 'ai' && (aiNamingState.running || aiNamingState.applying)) {
    return
  }

  if (source !== 'ai' && (availabilityState.running || availabilityState.retestingSelection || availabilityState.deleting)) {
    return
  }

  closeScopeModal()
  if (source === 'ai') {
    await handleAiScopeChange(folderId)
    return
  }

  await handleAvailabilityScopeChange(folderId)
}

function handleScopeSearchKeydown(event) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
    return
  }

  if (!getScopeFolderOptionButtons().length) {
    return
  }

  event.preventDefault()
  focusScopeFolderOption(event.key === 'ArrowDown' ? 'first' : 'last')
}

function handleScopeFolderResultsKeydown(event) {
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
    dom.scopeSearchInput?.focus()
    return
  }

  if (event.key === 'Home') {
    focusScopeFolderOption('first')
  } else if (event.key === 'End') {
    focusScopeFolderOption('last')
  } else {
    focusScopeFolderOption(event.key === 'ArrowDown' ? 1 : -1)
  }
}

function handleScopeFolderResultsFocus(event) {
  const target = event.target
  if (!(target instanceof HTMLElement) || !target.hasAttribute('data-scope-folder-id')) {
    return
  }

  managerState.scopeFolderActiveId = String(target.getAttribute('data-scope-folder-id') || '')
  syncScopeFolderTabStops(managerState.scopeFolderActiveId)
}

function syncScopeFolderTabStops(activeId) {
  for (const button of getScopeFolderOptionButtons()) {
    button.tabIndex = String(button.getAttribute('data-scope-folder-id') || '') === activeId ? 0 : -1
  }
}

function focusScopeFolderOptionById(folderId) {
  const normalizedFolderId = String(folderId || '')
  let targetButton = null
  for (const button of getScopeFolderOptionButtons()) {
    const isTarget = String(button.getAttribute('data-scope-folder-id') || '') === normalizedFolderId
    button.tabIndex = isTarget ? 0 : -1
    if (isTarget) {
      targetButton = button
    }
  }

  if (!targetButton) {
    return false
  }

  managerState.scopeFolderActiveId = normalizedFolderId
  targetButton.focus()
  return true
}

function focusScopeFolderOption(direction) {
  const buttons = getScopeFolderOptionButtons()
  if (!buttons.length) {
    return
  }

  const currentIndex = buttons.findIndex((button) => button === document.activeElement)
  const storedActiveId = managerState.scopeFolderActiveId === null
    ? null
    : String(managerState.scopeFolderActiveId || '')
  let nextIndex = storedActiveId === null
    ? -1
    : buttons.findIndex((button) => String(button.getAttribute('data-scope-folder-id') || '') === storedActiveId)

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
  if (button) {
    focusScopeFolderOptionById(String(button.getAttribute('data-scope-folder-id') || ''))
  }
}

async function moveSelectedAvailabilityToFolder(folderId) {
  const selectedResults = getSelectedAvailabilityResults()
  if (!selectedResults.length) {
    closeMoveModal()
    return
  }

  availabilityState.deleting = true
  availabilityState.lastError = ''
  renderAvailabilitySection()

  const movedIds = []
  let moveError = null

  try {
    await createAutoBackupBeforeDangerousOperation({
      kind: 'batch-move',
      source: 'options',
      reason: `可用性结果批量移动 ${selectedResults.length} 条`,
      targetBookmarkIds: selectedResults.map((result) => String(result.id)),
      targetFolderIds: [folderId],
      estimatedChangeCount: selectedResults.length
    })

    for (const result of selectedResults) {
      await moveBookmark(result.id, folderId)
      movedIds.push(result.id)
    }
  } catch (error) {
    moveError = error
  } finally {
    availabilityState.deleting = false
    closeMoveModal()

    if (movedIds.length) {
      await hydrateAvailabilityCatalog({ preserveResults: true })
      persistPendingAvailabilitySnapshotSoon()
    }

    clearAvailabilitySelection()
    const targetFolder = availabilityState.folderMap.get(folderId)

    if (moveError) {
      availabilityState.lastError =
        moveError instanceof Error
          ? `批量移动过程中断，已移动 ${movedIds.length} 条：${moveError.message}`
          : `批量移动过程中断，已移动 ${movedIds.length} 条。`
    } else if (movedIds.length) {
      availabilityState.lastError = `已将 ${movedIds.length} 条书签移动到 ${targetFolder?.path || targetFolder?.title || '目标文件夹'}。`
    }

    renderAvailabilitySection()
  }
}

function openDeleteModal() {
  if (
    !availabilityState.failedResults.length ||
    availabilityState.deleting ||
    availabilityState.stopRequested ||
    (availabilityState.running && !availabilityState.paused)
  ) {
    return
  }

  availabilityState.deleteModalOpen = true
  renderDeleteModal()
}

function closeDeleteModal() {
  if (availabilityState.deleting) {
    return
  }

  availabilityState.deleteModalOpen = false
  renderDeleteModal()
}

async function confirmDeleteFailedBookmarks() {
  if (
    !availabilityState.failedResults.length ||
    availabilityState.deleting ||
    availabilityState.stopRequested ||
    (availabilityState.running && !availabilityState.paused)
  ) {
    return
  }

  availabilityState.deleteModalOpen = false
  renderDeleteModal()

  await deleteBookmarksToRecycle(
    availabilityState.failedResults.map((result) => result.id),
    '高置信异常批量删除',
    recycleCallbacks
  )
}

function removeDeletedResultsFromState(bookmarkIds) {
  const removedIdSet = new Set(bookmarkIds.map((id) => String(id)).filter(Boolean))
  if (!removedIdSet.size) {
    return
  }

  removedIdSet.forEach((bookmarkId) => {
    availabilityState.deletedBookmarkIds.add(bookmarkId)
    managerState.selectedAvailabilityIds.delete(bookmarkId)
    managerState.selectedDuplicateIds.delete(bookmarkId)
  })
  removeDashboardSelectionIds([...removedIdSet])

  availabilityState.reviewResults = availabilityState.reviewResults.filter((result) => {
    return !removedIdSet.has(String(result.id))
  })
  availabilityState.failedResults = availabilityState.failedResults.filter((result) => {
    return !removedIdSet.has(String(result.id))
  })
  managerState.suppressedResults = managerState.suppressedResults.filter((result) => {
    return !removedIdSet.has(String(result.id))
  })
  managerState.currentHistoryEntries = managerState.currentHistoryEntries.filter((entry) => {
    return !removedIdSet.has(String(entry.id))
  })
  removeRedirectIdsFromState([...removedIdSet])

  availabilityState.reviewCount = availabilityState.reviewResults.length
  availabilityState.failedCount = availabilityState.failedResults.length
  availabilityState.redirectedCount = availabilityState.redirectResults.length
  availabilityState.ignoredCount = managerState.suppressedResults.length
  persistPendingAvailabilitySnapshotSoon()
}

function getBookmarkRecord(bookmarkId) {
  const normalizedId = String(bookmarkId || '').trim()
  return (
    availabilityState.bookmarkMap.get(normalizedId) ||
    availabilityState.reviewResults.find((result) => String(result.id) === normalizedId) ||
    availabilityState.failedResults.find((result) => String(result.id) === normalizedId) ||
    availabilityState.redirectResults.find((result) => String(result.id) === normalizedId) ||
    managerState.suppressedResults.find((result) => String(result.id) === normalizedId) ||
    null
  )
}

function renderDeleteModal() {
  if (!dom.deleteModalBackdrop) {
    return
  }

  setManagedModalHidden(
    'delete',
    dom.deleteModalBackdrop,
    availabilityState.deleteModalOpen,
    dom.cancelDeleteModal
  )
  dom.deleteModalCopy.textContent = availabilityState.failedResults.length
    ? `确认删除当前 ${availabilityState.failedResults.length} 条高置信异常书签？这些书签会从 Chrome 书签中移除，并先进入回收站；低置信异常结果会保留。`
    : '这些书签会从 Chrome 书签中移除，并先进入回收站；低置信异常结果会保留。'
  dom.confirmDeleteModal.disabled = availabilityState.deleting
  dom.confirmDeleteModal.textContent = availabilityState.deleting ? '正在删除…' : '确认删除'
}

function requestConfirmation({
  title = '确认操作？',
  copy = '请确认是否继续。',
  confirmLabel = '确认',
  cancelLabel = '取消',
  tone = 'danger',
  label = ''
}: {
  title?: string
  copy?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: string
  label?: string
} = {}): Promise<boolean> {
  if (!dom.confirmModalBackdrop) {
    return Promise.resolve(false)
  }

  if (confirmModalResolve) {
    confirmModalResolve(false)
    confirmModalResolve = null
  }

  managerState.confirmModalOpen = true
  managerState.confirmModalTone = tone === 'warning' ? 'warning' : 'danger'
  managerState.confirmModalLabel = label || (managerState.confirmModalTone === 'warning' ? '确认' : '删除')
  managerState.confirmModalTitle = title
  managerState.confirmModalCopy = copy
  managerState.confirmModalConfirmLabel = confirmLabel
  managerState.confirmModalCancelLabel = cancelLabel

  return new Promise<boolean>((resolve) => {
    confirmModalResolve = resolve
    renderConfirmModal()
  })
}

function resolveConfirmModal(confirmed) {
  if (!managerState.confirmModalOpen && !confirmModalResolve) {
    return
  }

  managerState.confirmModalOpen = false
  renderConfirmModal()

  const resolver = confirmModalResolve
  confirmModalResolve = null
  if (resolver) {
    resolver(Boolean(confirmed))
  }
}

function renderConfirmModal() {
  if (!dom.confirmModalBackdrop) {
    return
  }

  setManagedModalHidden(
    'confirm',
    dom.confirmModalBackdrop,
    managerState.confirmModalOpen,
    dom.cancelConfirmModal
  )

  if (!managerState.confirmModalOpen) {
    return
  }

  const tone = managerState.confirmModalTone === 'warning' ? 'warning' : 'danger'
  if (dom.confirmModalLabel) {
    dom.confirmModalLabel.className = `options-section-label ${tone}`
    dom.confirmModalLabel.textContent = managerState.confirmModalLabel
  }
  if (dom.confirmModalTitle) {
    dom.confirmModalTitle.textContent = managerState.confirmModalTitle
  }
  if (dom.confirmModalCopy) {
    dom.confirmModalCopy.textContent = managerState.confirmModalCopy
  }
  if (dom.cancelConfirmModal) {
    dom.cancelConfirmModal.textContent = managerState.confirmModalCancelLabel
  }
  if (dom.confirmModalConfirm) {
    dom.confirmModalConfirm.className = `options-button ${tone === 'danger' ? 'danger' : ''}`.trim()
    dom.confirmModalConfirm.textContent = managerState.confirmModalConfirmLabel
  }
}

function reconcileCatalogAfterMutation() {
  availabilityState.reviewResults = syncBookmarkMetadataForResults(availabilityState.reviewResults)
  availabilityState.failedResults = syncBookmarkMetadataForResults(availabilityState.failedResults)
  availabilityState.redirectResults = syncBookmarkMetadataForResults(availabilityState.redirectResults)
  managerState.suppressedResults = syncBookmarkMetadataForResults(managerState.suppressedResults)
  managerState.currentHistoryEntries = managerState.currentHistoryEntries
    .map((entry) => {
      const latestBookmark = availabilityState.bookmarkMap.get(String(entry.id))
      if (!latestBookmark) {
        return null
      }

      return {
        ...entry,
        title: latestBookmark.title,
        url: latestBookmark.url,
        path: latestBookmark.path
      }
    })
    .filter(Boolean)

  repartitionAvailabilityResultsByIgnoreRules()
  availabilityState.redirectedCount = availabilityState.redirectResults.length
}

function syncBookmarkMetadataForResults(results) {
  return results
    .map((result) => {
      const latestBookmark = availabilityState.bookmarkMap.get(String(result.id))
      if (!latestBookmark) {
        return null
      }

      return {
        ...result,
        title: latestBookmark.title,
        url: latestBookmark.url,
        displayUrl: latestBookmark.displayUrl,
        path: latestBookmark.path,
        ancestorIds: latestBookmark.ancestorIds,
        parentId: latestBookmark.parentId,
        index: latestBookmark.index,
        domain: latestBookmark.domain,
        normalizedTitle: latestBookmark.normalizedTitle,
        normalizedUrl: latestBookmark.normalizedUrl,
        duplicateKey: latestBookmark.duplicateKey
      }
    })
    .filter(Boolean)
}

function repartitionAvailabilityResultsByIgnoreRules() {
  const combinedResults = dedupeResultsById([
    ...availabilityState.reviewResults,
    ...availabilityState.failedResults,
    ...managerState.suppressedResults
  ])

  availabilityState.reviewResults = []
  availabilityState.failedResults = []
  managerState.suppressedResults = []

  for (const result of combinedResults) {
    if (matchesIgnoreRules(result)) {
      managerState.suppressedResults.push(result)
      continue
    }

    if (result.status === 'failed') {
      availabilityState.failedResults.push(result)
    } else {
      availabilityState.reviewResults.push(result)
    }
  }

  availabilityState.reviewCount = availabilityState.reviewResults.length
  availabilityState.failedCount = availabilityState.failedResults.length
  availabilityState.ignoredCount = managerState.suppressedResults.length
  sortResultsByPath(availabilityState.reviewResults)
  sortResultsByPath(availabilityState.failedResults)

  syncSelectionSet(
    managerState.selectedAvailabilityIds,
    new Set(
      [...availabilityState.reviewResults, ...availabilityState.failedResults].map((result) => String(result.id))
    )
  )
}

function dedupeResultsById(results) {
  const resultMap = new Map()

  for (const result of results) {
    const bookmarkId = String(result?.id || '').trim()
    if (!bookmarkId) {
      continue
    }

    resultMap.set(bookmarkId, result)
  }

  return [...resultMap.values()]
}


function getModeBadgeTone() {
  if (availabilityState.catalogLoading || availabilityState.permissionPending || availabilityState.requestingPermission) {
    return 'warning'
  }

  return availabilityState.probePermissionGranted ? 'success' : 'muted'
}

function getModeBadgeText() {
  if (availabilityState.catalogLoading) {
    return '准备中'
  }

  if (availabilityState.requestingPermission) {
    return '授权中'
  }

  if (availabilityState.permissionPending) {
    return '读取中'
  }

  return availabilityState.probePermissionGranted ? '多层校验' : '后台导航'
}

function getModeCopyText() {
  if (availabilityState.catalogLoading) {
    return '正在读取书签并准备多层可用性校验。'
  }

  if (!availabilityState.bookmarks.length) {
    return '当前没有可检测的 http/https 书签，因此不会启动后台标签页或第二层网络探测。'
  }

  if (availabilityState.probePermissionGranted) {
    return `当前会按“后台导航 -> 失败重试 -> 网络探测”三层方式校验。${getAvailabilityRunnerStatusCopy()}`
  }

  return `当前默认会先做后台导航检测。点击开始检测时会尝试申请第二层网络探测权限；如果未授权，系统仍会继续做后台导航检测。${getAvailabilityRunnerStatusCopy()}`
}

function getAvailabilityResultRecommendation(result): string {
  const status = String(result?.status || '')
  const badgeText = String(result?.badgeText || '')
  const finalUrl = String(result?.finalUrl || '')

  if (status === 'redirected' || (finalUrl && isRedirectedNavigation(result?.url || '', finalUrl))) {
    return '建议：先打开最终链接确认目标页面正确；更新前系统会重新读取书签并确认当前 URL 仍等于检测时原地址。'
  }

  if (status === 'failed' || badgeText.includes('高置信')) {
    return '建议：先重测或抽样打开确认；确认失效后可移动归档或批量删除到回收站。'
  }

  return '建议：先人工打开确认；若是登录、地区限制、反爬或临时失败，可保留在低置信或加入忽略规则。'
}

function getAvailabilityActionText() {
  const scopeMeta = getCurrentAvailabilityScopeMeta()
  const scopeActionLabel = scopeMeta.type === 'all' ? '全部书签' : '当前范围'

  if (availabilityState.catalogLoading) {
    return '正在准备检测…'
  }

  if (availabilityState.requestingPermission) {
    return '正在准备第二层探测…'
  }

  if (availabilityState.retestingSelection) {
    return '正在重新测试…'
  }

  if (availabilityState.running) {
    if (availabilityState.stopRequested) {
      return '停止中…'
    }

    if (availabilityState.paused) {
      return '检测已暂停'
    }

    return '正在检测…'
  }

  return availabilityState.lastCompletedAt ? `重新检测${scopeActionLabel}` : `开始检测${scopeActionLabel}`
}

function getAvailabilityStatusCopy() {
  if (availabilityState.lastError) {
    return availabilityState.lastError
  }

  if (availabilityState.catalogLoading) {
    return '正在读取书签并准备检测目录。'
  }

  if (availabilityState.storageLoading) {
    return '正在读取忽略规则、检测历史与回收站。'
  }

  if (availabilityState.requestingPermission) {
    return '正在为第二层网络探测申请当前书签来源站点的访问权限。'
  }

  if (availabilityState.retestingSelection) {
    return availabilityState.retestSelectionProbeEnabled
      ? `正在重新测试已选书签，当前进度 ${availabilityState.retestSelectionCompleted} / ${availabilityState.retestSelectionTotal}。本次会继续执行后台导航、失败重试和网络探测。`
      : `正在重新测试已选书签，当前进度 ${availabilityState.retestSelectionCompleted} / ${availabilityState.retestSelectionTotal}。本次仅执行后台导航与失败重试。`
  }

  if (availabilityState.running) {
    if (availabilityState.stopRequested) {
      return '正在停止本次检测。当前已开始的检测步骤结束后，会保留已完成结果并停止继续排队。'
    }

    if (availabilityState.paused) {
      return '检测已暂停。继续后会从当前进度继续；已经开始的单条检测会在当前步骤结束后暂停。'
    }

    if (availabilityState.currentRunProbeEnabled) {
      return `本轮依次执行后台导航、失败重试和网络探测。${getAvailabilityRunnerStatusCopy()}`
    }

    return `本轮仅执行后台导航和失败重试，因为未启用第二层网络探测。${getAvailabilityRunnerStatusCopy()}`
  }

  if (availabilityState.lastCompletedAt) {
    if (availabilityState.lastRunOutcome === 'stopped') {
      return `本轮检测范围为“${getCurrentAvailabilityScopeMeta().label}”，已手动停止，已完成 ${availabilityState.checkedBookmarks} 条书签，可访问 ${availabilityState.availableCount} 条，重定向 ${availabilityState.redirectedCount} 条，低置信异常 ${availabilityState.reviewCount} 条，高置信异常 ${availabilityState.failedCount} 条。`
    }

    return `本轮检测范围为“${getCurrentAvailabilityScopeMeta().label}”，共检查 ${availabilityState.eligibleBookmarks} 条书签，可访问 ${availabilityState.availableCount} 条，重定向 ${availabilityState.redirectedCount} 条，低置信异常 ${availabilityState.reviewCount} 条，高置信异常 ${availabilityState.failedCount} 条，已忽略 ${availabilityState.ignoredCount} 条。`
  }

  return '仅检测 http/https 书签，默认会做后台导航；若允许第二层网络探测，则会进一步交叉验证。'
}

function scheduleAvailabilityRender() {
  if (availabilityRenderFrame) {
    return
  }

  availabilityRenderFrame = window.requestAnimationFrame(() => {
    availabilityRenderFrame = 0
    renderAvailabilitySection()
  })
}

function resetDetectionResults() {
  availabilityState.checkedBookmarks = 0
  availabilityState.availableCount = 0
  availabilityState.redirectedCount = 0
  availabilityState.reviewCount = 0
  availabilityState.failedCount = 0
  availabilityState.ignoredCount = 0
  availabilityState.reviewResults = []
  availabilityState.failedResults = []
  availabilityState.reviewResultsPage = 1
  availabilityState.failedResultsPage = 1
  availabilityState.redirectResults = []
  availabilityState.availabilityFilter = 'all'
  managerState.redirectResultsPage = 1
  managerState.suppressedResults = []
  managerState.currentHistoryEntries = []
}
