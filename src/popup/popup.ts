import {
  AUTO_ANALYZE_STATUS_ACTIVE_EXPIRE_MS,
  AUTO_ANALYZE_STATUS_FINAL_EXPIRE_MS,
  BOOKMARKS_BAR_ID,
  DEFAULT_INBOX_FOLDER_TITLE,
  POPUP_COMMAND_INTENT_TTL_MS,
  ROOT_ID,
  RECYCLE_BIN_LIMIT,
  STORAGE_KEYS,
  UNDO_WINDOW_MS
} from '../shared/constants.js'
import {
  extractBookmarkData,
  findBookmarksBar,
  findNodeById
} from '../shared/bookmark-tree.js'
import {
  buildBookmarkPathSegments,
  formatBookmarkPath,
  formatFolderPath
} from '../shared/bookmark-path.js'
import {
  displayUrl,
  extractDomain,
  normalizeText
} from '../shared/text.js'
import { normalizeBookmarkSaveUrl } from '../shared/bookmark-save-url.js'
import {
  createBookmark,
  createTab,
  getBookmarkTree,
  moveBookmark,
  updateBookmark
} from '../shared/bookmarks-api.js'
import { getLocalStorage, removeLocalStorage, setLocalStorage } from '../shared/storage.js'
import { requestBookmarkSave } from '../shared/messages.js'
import { loadBookmarkTagIndex, normalizeBookmarkTags } from '../shared/bookmark-tags.js'
import { renderDotMatrixLoader } from '../shared/dot-matrix-loader.js'
import { cancelExitMotion, closeWithExitMotion } from '../shared/motion.js'
import {
  MAX_POPUP_SEARCH_RESULTS,
  POPUP_SEARCH_ASYNC_THRESHOLD,
  getQueryTerms,
  normalizeQuery,
  searchBookmarks,
  searchBookmarksCooperatively,
  type PopupSearchResult
} from './search.js'
import {
  deleteSavedSearch,
  getSavedSearchesForScope,
  loadSavedSearchIndex,
  parseSearchQuery,
  saveSearch
} from '../shared/search-query.js'
import type { SavedSearch, SavedSearchIndex } from '../shared/search-query.js'
import {
  DEFAULT_NEW_TAB_WORKSPACE_ID,
  getActiveNewTabWorkspace,
  normalizeNewTabWorkspaceSettings,
  toggleNewTabWorkspacePin
} from '../shared/newtab-workspace-settings.js'
import type {
  NaturalSearchPlan,
  NaturalSearchResultSet
} from './natural-search.js'
import {
  buildLightPopupSearchIndex,
  enrichPopupSearchIndexWithSnapshotFullText,
  loadPopupSearchIndexSnapshotState,
  shouldWarmPopupSnapshotFullText
} from './search-index.js'
import { dom, cacheDom } from './dom.js'
import { state } from './state.js'

const SEARCH_DEBOUNCE_MS = 140
const NATURAL_SEARCH_DEBOUNCE_MS = 520
const VIEW_NOTICE_MS = 1800
const MAX_VISIBLE_TOASTS = 2
const SEARCH_SNAPSHOT_WARM_DELAY_MS = 220
const SMART_RECOMMENDATION_LIMIT = 3
const SMART_LOADING_STEP_COUNT = 3
const POPUP_SMART_DEFAULT_TIMEOUT_MS = 30000
const POPUP_JINA_READER_ORIGIN = 'https://r.jina.ai/*'
const POPUP_DEFAULT_WORKSPACE_STORAGE = {
  activeWorkspaceId: DEFAULT_NEW_TAB_WORKSPACE_ID,
  workspaces: []
}
const DEFAULT_POPUP_PREFERENCES = {
  naturalSearchEnabled: false
}
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')
let popupDialogReturnFocusElement: HTMLElement | null = null
let naturalSearchModulePromise: Promise<typeof import('./natural-search.js')> | null = null
let naturalSearchAiModulePromise: Promise<typeof import('./natural-search-ai.js')> | null = null
let contentExtractionModulePromise: Promise<typeof import('../options/sections/content-extraction.js')> | null = null
let aiSettingsModulePromise: Promise<typeof import('../options/sections/ai-settings.js')> | null = null
let aiResponseModulePromise: Promise<typeof import('../shared/ai-response.js')> | null = null
let recycleBinModulePromise: Promise<typeof import('../shared/recycle-bin.js')> | null = null

function abortNaturalSearchRequest() {
  state.naturalSearchAbortController?.abort()
  state.naturalSearchAbortController = null
}

function loadNaturalSearchModule(): Promise<typeof import('./natural-search.js')> {
  naturalSearchModulePromise ||= import('./natural-search.js')
  return naturalSearchModulePromise
}

function loadNaturalSearchAiModule(): Promise<typeof import('./natural-search-ai.js')> {
  naturalSearchAiModulePromise ||= import('./natural-search-ai.js')
  return naturalSearchAiModulePromise
}

function loadContentExtractionModule(): Promise<typeof import('../options/sections/content-extraction.js')> {
  contentExtractionModulePromise ||= import('../options/sections/content-extraction.js')
  return contentExtractionModulePromise
}

function loadAiSettingsModule(): Promise<typeof import('../options/sections/ai-settings.js')> {
  aiSettingsModulePromise ||= import('../options/sections/ai-settings.js')
  return aiSettingsModulePromise
}

function loadAiResponseModule(): Promise<typeof import('../shared/ai-response.js')> {
  aiResponseModulePromise ||= import('../shared/ai-response.js')
  return aiResponseModulePromise
}

function loadRecycleBinModule(): Promise<typeof import('../shared/recycle-bin.js')> {
  recycleBinModulePromise ||= import('../shared/recycle-bin.js')
  return recycleBinModulePromise
}

const SMART_CLASSIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'content_type', 'topics', 'tags', 'aliases', 'confidence', 'existing_folders', 'new_folder'],
  properties: {
    title: { type: 'string', maxLength: 80 },
    summary: { type: 'string', maxLength: 500 },
    content_type: { type: 'string', maxLength: 40 },
    topics: {
      type: 'array',
      maxItems: 8,
      items: { type: 'string', maxLength: 40 }
    },
    tags: {
      type: 'array',
      maxItems: 12,
      items: { type: 'string', maxLength: 24 }
    },
    aliases: {
      type: 'array',
      maxItems: 20,
      items: { type: 'string', maxLength: 40 }
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    existing_folders: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['folder_path', 'reason', 'confidence'],
        properties: {
          folder_path: { type: 'string' },
          reason: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        }
      }
    },
    new_folder: {
      type: 'object',
      additionalProperties: false,
      required: ['folder_path', 'reason', 'confidence'],
      properties: {
        folder_path: { type: 'string' },
        reason: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1 }
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  cacheDom()
  void hydratePopupPreferences().finally(() => {
    bindEvents()
    render()
    void hydrateAutoAnalyzeStatus()
    refreshData({ initial: true, preserveSearch: false }).finally(() => {
      void consumePopupCommandIntent().then((handled) => {
        if (!handled && !document.body.classList.contains('smart-active')) {
          dom.searchInput.focus()
        }
      })
    })
  })
})

window.addEventListener('pagehide', cleanupPopupRuntime)

function bindEvents() {
  dom.openSettings.addEventListener('click', openSettingsPage)
  dom.smartFooterSettings.addEventListener('click', openSettingsPage)
  dom.smartClassifier.addEventListener('click', handleSmartClassifierClick)
  dom.smartClassifier.addEventListener('input', handleSmartClassifierInput)
  dom.savedSearches.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }

    const actionButton = target.closest('[data-saved-search-action]')
    if (actionButton) {
      handleSavedSearchAction(actionButton)
    }
  })
  dom.searchInput.addEventListener('input', () => {
    setSearchQuery(dom.searchInput.value)
  })

  dom.naturalSearchToggle.addEventListener('click', () => {
    void toggleNaturalLanguageSearch()
  })

  dom.clearSearch.addEventListener('click', () => {
    setSearchQuery('', { immediate: true })
    showViewNotice('已清空搜索')
    dom.searchInput.focus()
  })
  dom.folderFilterTrigger.addEventListener('click', openFilterDialog)
  dom.clearFolderFilter.addEventListener('click', clearFolderFilter)
  dom.openInboxFilter.addEventListener('click', applyInboxFolderFilter)

  dom.content.addEventListener('click', handleContentClick)
  dom.emptyState.addEventListener('click', handleContentClick)
  dom.content.addEventListener('pointerover', handleContentPointerOver)
  dom.folderBreadcrumbs.addEventListener('click', handlePopupBreadcrumbClick)
  dom.filterFolderList.addEventListener('click', handleFilterListClick)
  dom.filterFolderList.addEventListener('keydown', handleFilterListKeydown)
  dom.filterFolderList.addEventListener('focusin', handleFilterListFocus)
  dom.filterSearchInput.addEventListener('input', () => {
    state.filterSearchQuery = dom.filterSearchInput.value
    state.filterFolderActiveId = ''
    renderFilterModal()
  })
  dom.filterSearchInput.addEventListener('keydown', handleFilterSearchKeydown)
  dom.closeFilterModal.addEventListener('click', closeDialogs)
  dom.moveFolderList.addEventListener('click', handleMoveListClick)
  dom.moveSearchInput.addEventListener('input', () => {
    state.moveSearchQuery = dom.moveSearchInput.value
    renderMoveModal()
  })
  dom.closeMoveModal.addEventListener('click', closeDialogs)
  dom.smartFolderList.addEventListener('click', handleSmartFolderListClick)
  dom.smartFolderSearchInput.addEventListener('input', () => {
    state.smartFolderSearchQuery = dom.smartFolderSearchInput.value
    renderSmartFolderModal()
  })
  dom.closeSmartFolderModal.addEventListener('click', closeDialogs)
  dom.closeEditModal.addEventListener('click', closeDialogs)
  dom.cancelEdit.addEventListener('click', closeDialogs)
  dom.saveEdit.addEventListener('click', saveEditedBookmark)
  dom.editTitleInput.addEventListener('input', handleEditDraftInput)
  dom.editUrlInput.addEventListener('input', handleEditDraftInput)
  dom.editTitleInput.addEventListener('keydown', handleEditInputKeydown)
  dom.editUrlInput.addEventListener('keydown', handleEditInputKeydown)
  dom.cancelDelete.addEventListener('click', closeDialogs)
  dom.confirmDelete.addEventListener('click', confirmDeleteBookmark)
  dom.modalBackdrop.addEventListener('click', (event) => {
    if (event.target === dom.modalBackdrop) {
      closeDialogs()
    }
  })

  dom.autoAnalyzeStatus.addEventListener('click', handleAutoAnalyzeStatusClick)
  dom.toastRoot.addEventListener('click', handleToastClick)
  chrome.storage?.onChanged?.addListener(handleAutoAnalyzeStorageChanged)

  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
}

async function hydratePopupPreferences() {
  try {
    const stored = await getLocalStorage([STORAGE_KEYS.popupPreferences])
    const preferences = normalizePopupPreferences(stored[STORAGE_KEYS.popupPreferences])
    state.naturalSearchEnabled = preferences.naturalSearchEnabled
  } catch {
    state.naturalSearchEnabled = DEFAULT_POPUP_PREFERENCES.naturalSearchEnabled
  }
}

function normalizePopupPreferences(value) {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_POPUP_PREFERENCES }
  }

  return {
    naturalSearchEnabled: value.naturalSearchEnabled === true
  }
}

async function savePopupPreferences() {
  await setLocalStorage({
    [STORAGE_KEYS.popupPreferences]: {
      naturalSearchEnabled: state.naturalSearchEnabled
    }
  })
}

async function hydrateSavedSearches() {
  if (state.savedSearchesLoaded) {
    return
  }

  try {
    state.savedSearches = await loadSavedSearchIndex()
    state.savedSearchesLoaded = true
    state.savedSearchesError = ''
  } catch {
    state.savedSearchesLoaded = true
    state.savedSearchesError = '保存搜索读取失败'
  } finally {
    renderSearchTools()
  }
}

async function saveCurrentSearchQuery() {
  const query = state.searchQuery.trim()
  if (!query) {
    showViewNotice('请输入查询后再保存')
    dom.searchInput.focus()
    return
  }

  try {
    const index = await ensureSavedSearchIndex()
    state.savedSearches = await saveSearch(index, {
      name: createSavedSearchName(query),
      query,
      scope: 'both'
    })
    state.savedSearchesLoaded = true
    state.savedSearchesError = ''
    renderSearchTools()
    showViewNotice('已保存搜索，可在 popup 复用')
  } catch (error) {
    state.savedSearchesError = error instanceof Error ? error.message : '保存搜索失败'
    renderSearchTools()
    showToast({ type: 'error', message: '保存搜索失败，请稍后重试。' })
  }
}

async function deletePopupSavedSearch(searchId) {
  try {
    const index = await ensureSavedSearchIndex()
    state.savedSearches = await deleteSavedSearch(index, String(searchId || ''))
    state.savedSearchesLoaded = true
    state.savedSearchesError = ''
    renderSearchTools()
    showViewNotice('已删除保存搜索')
  } catch (error) {
    state.savedSearchesError = error instanceof Error ? error.message : '删除保存搜索失败'
    renderSearchTools()
    showToast({ type: 'error', message: '删除保存搜索失败，请稍后重试。' })
  }
}

async function ensureSavedSearchIndex(): Promise<SavedSearchIndex> {
  if (state.savedSearches) {
    return state.savedSearches
  }

  state.savedSearches = await loadSavedSearchIndex()
  state.savedSearchesLoaded = true
  return state.savedSearches
}

function createSavedSearchName(query) {
  const parsed = parseSearchQuery(query)
  const chipLabels = parsed.chips.map((chip) => chip.label.replace(/^[^：]+：/, '')).filter(Boolean)
  const terms = parsed.textTerms.join(' ')
  const label = [...chipLabels, terms].filter(Boolean).join(' · ')
  return cleanSmartText(label || query, 60) || '未命名搜索'
}

async function openSettingsPage(target: Event | 'general' | 'ai-provider' = 'general') {
  const hash = target === 'ai-provider' ? 'general:ai-provider' : 'general'
  try {
    await chrome.tabs.create({
      url: chrome.runtime.getURL(`src/options/options.html#${hash}`)
    })
    window.close()
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? error.message : '设置页打开失败，请稍后重试。'
    })
  }
}

async function openBookmarkHistoryPage() {
  try {
    await chrome.tabs.create({
      url: chrome.runtime.getURL('src/options/options.html#bookmark-history')
    })
    window.close()
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? error.message : '添加历史打开失败，请稍后重试。'
    })
  }
}

async function hydrateAutoAnalyzeStatus() {
  try {
    const stored = await getLocalStorage([STORAGE_KEYS.autoAnalyzeStatus])
    const currentStatus = normalizeAutoAnalyzeStatus(stored[STORAGE_KEYS.autoAnalyzeStatus])
    state.autoAnalyzeStatus = currentStatus
    renderAutoAnalyzeStatus()
    if (stored[STORAGE_KEYS.autoAnalyzeStatus] && !currentStatus) {
      await removeLocalStorage(STORAGE_KEYS.autoAnalyzeStatus)
    }
    await acknowledgeAutoAnalyzeBadge(currentStatus)
    await removeLocalStorage(STORAGE_KEYS.pendingAutoAnalyzeNotice)
  } catch (error) {
  }
}

async function dismissAutoAnalyzeStatus() {
  state.autoAnalyzeStatus = null
  renderAutoAnalyzeStatus()
  await removeLocalStorage([
    STORAGE_KEYS.autoAnalyzeStatus,
    STORAGE_KEYS.pendingAutoAnalyzeNotice
  ])
  await clearActionBadge()
}

async function acknowledgeAutoAnalyzeBadge(status = state.autoAnalyzeStatus) {
  await clearActionBadge()
  if (!status) {
    return
  }

  try {
    const stored = await getLocalStorage([STORAGE_KEYS.autoAnalyzeStatus])
    const currentStatus = normalizeAutoAnalyzeStatus(stored[STORAGE_KEYS.autoAnalyzeStatus])
    if (!currentStatus || currentStatus.bookmarkId !== status.bookmarkId) {
      return
    }

    await setLocalStorage({
      [STORAGE_KEYS.autoAnalyzeStatus]: {
        ...currentStatus,
        badgeVisible: false
      }
    })
  } catch {
  }
}

function clearActionBadge(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!chrome.action?.setBadgeText) {
      resolve()
      return
    }

    chrome.action.setBadgeText({ text: '' }, () => {
      resolve()
    })
  })
}

function handleAutoAnalyzeStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string
) {
  if (areaName !== 'local') {
    return
  }

  const statusChange = changes[STORAGE_KEYS.autoAnalyzeStatus]
  if (statusChange) {
    const nextStatus = normalizeAutoAnalyzeStatus(statusChange.newValue)
    state.autoAnalyzeStatus = nextStatus
    renderAutoAnalyzeStatus()
    if (nextStatus?.badgeVisible) {
      void acknowledgeAutoAnalyzeBadge(nextStatus)
    }
    if (statusChange.newValue && !nextStatus) {
      void removeLocalStorage(STORAGE_KEYS.autoAnalyzeStatus).finally(() => {
        void clearActionBadge()
      })
    }
  }

  const popupIntentChange = changes[STORAGE_KEYS.popupCommandIntent]
  if (popupIntentChange?.newValue) {
    void consumePopupCommandIntent(popupIntentChange.newValue)
  }
}

function handleAutoAnalyzeStatusClick(event) {
  const actionButton = event.target.closest('[data-auto-analyze-action]')
  if (!actionButton) {
    return
  }

  const action = actionButton.getAttribute('data-auto-analyze-action')
  if (action === 'dismiss') {
    void dismissAutoAnalyzeStatus()
    return
  }

  if (action === 'history') {
    void openBookmarkHistoryPage()
  }
}

function renderAutoAnalyzeStatus() {
  const status = state.autoAnalyzeStatus
  if (!status) {
    dom.autoAnalyzeStatus.innerHTML = ''
    dom.autoAnalyzeStatus.className = 'auto-analyze-status hidden'
    return
  }

  const view = getAutoAnalyzeStatusView(status)
  const actions = status.status === 'completed'
    ? `
        <button class="auto-analyze-action" type="button" data-auto-analyze-action="history">查看</button>
        <button class="auto-analyze-action ghost" type="button" data-auto-analyze-action="dismiss" aria-label="关闭自动分析状态">关闭</button>
      `
    : `<button class="auto-analyze-action ghost" type="button" data-auto-analyze-action="dismiss" aria-label="关闭自动分析状态">关闭</button>`

  dom.autoAnalyzeStatus.className = `auto-analyze-status ${escapeAttr(status.status)}`
  dom.autoAnalyzeStatus.innerHTML = `
    <div class="auto-analyze-indicator" aria-hidden="true"></div>
    <div class="auto-analyze-copy" role="status">
      <p class="auto-analyze-title">${escapeHtml(view.title)}</p>
      <p class="auto-analyze-detail">${escapeHtml(view.detail)}</p>
    </div>
    <div class="auto-analyze-actions">${actions}</div>
  `
}

function getAutoAnalyzeStatusView(status) {
  const title = cleanSmartText(status.title || '新增书签', 44) || '新增书签'
  const folderPath = cleanSmartText(status.folderPath || '', 48)
  const error = cleanSmartText(status.error || '', 80)
  const detail = cleanSmartText(status.detail || '', 80)

  if (status.status === 'queued') {
    return {
      title: '已加入自动分析',
      detail: detail || `正在整理标签和命名：${title}`
    }
  }

  if (status.status === 'processing') {
    return {
      title: '自动分析进行中',
      detail: detail || `正在整理标签和命名：${title}`
    }
  }

  if (status.status === 'failed') {
    const retryHint = status.maxAttempts && status.attempts < status.maxAttempts
      ? `，稍后重试 ${status.attempts}/${status.maxAttempts}`
      : ''
    const failureMessage = detail || error || '可重试；若持续失败，请检查 AI 设置'
    return {
      title: '自动分析失败',
      detail: `${failureMessage}${retryHint}`.includes('AI 设置')
        ? `${failureMessage}${retryHint}`
        : `${failureMessage}${retryHint}；可重试或检查 AI 设置`
    }
  }

  return {
    title: '自动分析结果已保存',
    detail: detail || (folderPath ? `结果已保存到 ${folderPath}：${title}` : `结果已保存：${title}`)
  }
}

function normalizeAutoAnalyzeStatus(rawStatus) {
  if (!rawStatus || typeof rawStatus !== 'object') {
    return null
  }

  const status = String(rawStatus.status || '').trim()
  if (!['queued', 'processing', 'completed', 'failed'].includes(status)) {
    return null
  }

  const bookmarkId = String(rawStatus.bookmarkId || '').trim()
  if (!bookmarkId) {
    return null
  }

  const updatedAt = Number(rawStatus.updatedAt) || Date.now()
  const createdAt = Number(rawStatus.createdAt) || updatedAt
  const expiresAt = Number(rawStatus.expiresAt) || updatedAt + getAutoAnalyzeStatusTtl(status)
  if (expiresAt <= Date.now()) {
    return null
  }

  return {
    status,
    bookmarkId,
    title: cleanSmartText(rawStatus.title || '新增书签', 80) || '新增书签',
    url: String(rawStatus.url || '').trim(),
    folderPath: cleanSmartText(rawStatus.folderPath || '', 120),
    confidence: normalizeSmartConfidence(rawStatus.confidence),
    error: cleanSmartText(rawStatus.error || '', 160),
    detail: cleanSmartText(rawStatus.detail || '', 160),
    attempts: Math.max(0, Math.round(Number(rawStatus.attempts) || 0)),
    maxAttempts: Math.max(0, Math.round(Number(rawStatus.maxAttempts) || 0)),
    badgeVisible: rawStatus.badgeVisible !== false,
    createdAt,
    updatedAt,
    expiresAt
  }
}

function getAutoAnalyzeStatusTtl(status) {
  return status === 'queued' || status === 'processing'
    ? AUTO_ANALYZE_STATUS_ACTIVE_EXPIRE_MS
    : AUTO_ANALYZE_STATUS_FINAL_EXPIRE_MS
}

async function consumePopupCommandIntent(rawIntent = undefined): Promise<boolean> {
  let intentSource = rawIntent

  if (typeof rawIntent === 'undefined') {
    const stored = await getLocalStorage([STORAGE_KEYS.popupCommandIntent])
    intentSource = stored[STORAGE_KEYS.popupCommandIntent]
  }

  const intent = normalizePopupCommandIntent(intentSource)
  if (!intent) {
    if (intentSource) {
      await removeLocalStorage(STORAGE_KEYS.popupCommandIntent).catch(() => {})
    }
    return false
  }

  await removeLocalStorage(STORAGE_KEYS.popupCommandIntent).catch(() => {})

  if (intent.action === 'feedback') {
    showCommandFeedbackIntent(intent)
    return false
  }

  if (intent.action === 'smart-classifier') {
    await runSmartClassifierFromCommand(intent)
    return true
  }

  focusSearchFromCommand(intent)
  return true
}

function normalizePopupCommandIntent(rawIntent) {
  if (!rawIntent || typeof rawIntent !== 'object') {
    return null
  }

  const action = String(rawIntent.action || '').trim()
  if (!['search', 'smart-classifier', 'feedback'].includes(action)) {
    return null
  }

  const tone = String(rawIntent.tone || '').trim()
  const createdAt = Number(rawIntent.createdAt) || Date.now()
  const expiresAt = Number(rawIntent.expiresAt) || createdAt + POPUP_COMMAND_INTENT_TTL_MS
  if (expiresAt <= Date.now()) {
    return null
  }

  return {
    action,
    sourceCommand: String(rawIntent.sourceCommand || '').trim(),
    message: cleanSmartText(rawIntent.message || '', 120),
    tone: ['success', 'warning', 'danger', 'info'].includes(tone) ? tone : 'info',
    createdAt,
    expiresAt
  }
}

function showCommandFeedbackIntent(intent) {
  const message = intent.message || '快捷键操作已完成。'
  showViewNotice(message)
  showToast({
    type: intent.tone === 'success' ? 'success' : 'error',
    message
  })
}

function focusSearchFromCommand(intent) {
  if (hasOpenModal()) {
    closeDialogs()
  }

  if (['loading', 'results', 'error', 'permission'].includes(state.smartStatus)) {
    resetSmartClassification()
  }

  state.activeMenuBookmarkId = null
  render()

  window.requestAnimationFrame(() => {
    dom.searchInput.focus()
    dom.searchInput.select()
    showViewNotice(intent.message || (state.searchQuery ? '已聚焦搜索框，可继续编辑查询' : '已聚焦搜索框，可直接输入'))
  })
}

async function runSmartClassifierFromCommand(intent) {
  if (hasOpenModal()) {
    closeDialogs()
  }

  const currentUrl = String(state.currentTab?.url || '').trim()
  if (!isSmartClassifiableUrl(currentUrl)) {
    showToast({
      type: 'error',
      message: '当前页面无法进行智能分类。'
    })
    dom.searchInput.focus()
    return
  }

  state.activeMenuBookmarkId = null
  if (state.smartStatus === 'unavailable') {
    state.smartStatus = 'idle'
  }
  render()
  showViewNotice(intent.message || '正在智能分类当前页面。')

  await classifyCurrentPage()
}

async function refreshData({ initial = false, preserveSearch = true } = {}) {
  state.isLoading = true
  state.loadError = ''
  state.activeMenuBookmarkId = null
  render()

  try {
    const tree = await getBookmarkTree()
    const rootNode = Array.isArray(tree) ? tree[0] : tree

    state.rawTreeRoot = rootNode
    state.bookmarksBarNode = findBookmarksBar(rootNode)

    const extracted = extractBookmarkData(rootNode)
    const [tagIndex, snapshotState] = await Promise.all([
      loadBookmarkTagIndex().catch(() => null),
      loadPopupSearchIndexSnapshotState()
    ])
    const indexedBookmarks = buildLightPopupSearchIndex({
      bookmarks: extracted.bookmarks,
      tagIndex,
      snapshotIndex: snapshotState.index
    })
    state.allBookmarks = indexedBookmarks
    state.allFolders = extracted.folders
    state.bookmarkMap = new Map(indexedBookmarks.map((bookmark) => [bookmark.id, bookmark]))
    state.bookmarkDuplicateKeyMap = buildPopupBookmarkDuplicateKeyMap(indexedBookmarks)
    state.folderMap = extracted.folderMap
    state.searchTagIndex = tagIndex
    state.searchSnapshotState = snapshotState
    state.searchSnapshotFullTextReady = false
    state.searchSnapshotFullTextPending = false
    state.searchSnapshotFullTextRunId += 1
    clearSearchCaches()
    await hydrateCurrentTabState()
    void hydrateSavedSearches()

    const folderIds = new Set(extracted.folders.map((folder) => folder.id))
    const defaultExpanded = getDefaultExpandedFolders(state.bookmarksBarNode)
    const allExpanded = new Set(extracted.folders.map((folder) => folder.id))

    if (state.selectedFolderFilterId && !folderIds.has(state.selectedFolderFilterId)) {
      state.selectedFolderFilterId = null
    }

    if (initial || state.expandedFolders.size === 0) {
      state.expandedFolders = defaultExpanded
    } else {
      state.expandedFolders = new Set(
        [...state.expandedFolders].filter((folderId) => folderIds.has(folderId))
      )
      if (!state.expandedFolders.size) {
        state.expandedFolders = defaultExpanded
      }
    }

    if (initial || state.moveExpandedFolders.size === 0) {
      state.moveExpandedFolders = allExpanded
    } else {
      state.moveExpandedFolders = new Set(
        [...state.moveExpandedFolders].filter((folderId) => folderIds.has(folderId))
      )
      if (!state.moveExpandedFolders.size) {
        state.moveExpandedFolders = allExpanded
      }
    }

    if (preserveSearch) {
      state.debouncedQuery = state.searchQuery.trim()
      runSearch()
    } else {
      state.searchRunId += 1
      state.searchQuery = ''
      state.debouncedQuery = ''
      state.searchResults = []
      state.activeResultIndex = 0
      state.searchPending = false
      state.naturalSearchPending = false
      state.naturalSearchError = ''
      state.naturalSearchPlan = null
      abortNaturalSearchRequest()
      state.searchHighlightQuery = ''
      dom.searchInput.value = ''
    }
  } catch (error) {
    state.searchRunId += 1
    state.searchPending = false
    state.naturalSearchPending = false
    state.loadError = error instanceof Error ? error.message : '书签加载失败，请稍后重试。'
    state.searchResults = []
  } finally {
    state.isLoading = false
    render()
  }
}

async function hydrateCurrentTabState() {
  state.currentTab = await getActiveTab().catch(() => null)
  const currentUrl = String(state.currentTab?.url || '').trim()
  const normalizedCurrentUrl = normalizeBookmarkSaveUrl(currentUrl)
  const matchedBookmark = normalizedCurrentUrl
    ? state.bookmarkDuplicateKeyMap.get(normalizedCurrentUrl)
    : null

  state.currentPageBookmarkId = matchedBookmark?.id || null

  if (!isSmartClassifiableUrl(currentUrl)) {
    state.smartStatus = 'unavailable'
    state.smartRecommendations = []
    state.smartSelectedRecommendationId = ''
    return
  }

  if (!['loading', 'results', 'permission', 'saving'].includes(state.smartStatus)) {
    state.smartStatus = 'idle'
  }
}

function buildPopupBookmarkDuplicateKeyMap(bookmarks) {
  const map = new Map()
  for (const bookmark of bookmarks) {
    const duplicateKey = String(bookmark.duplicateKey || '').trim()
    if (duplicateKey && !map.has(duplicateKey)) {
      map.set(duplicateKey, bookmark)
    }
  }
  return map
}

function cleanupPopupRuntime() {
  abortNaturalSearchRequest()
  chrome.storage?.onChanged?.removeListener?.(handleAutoAnalyzeStorageChanged)
  clearTimeout(state.searchTimer)
  state.searchTimer = null
  clearViewNotice()
  clearEditDiscardGuard()
  for (const timeoutId of state.toastTimers.values()) {
    clearTimeout(timeoutId)
  }
  state.toastTimers.clear()
  state.toasts = []
  state.contentRenderHtml = ''
  state.filteredBookmarksCacheKey = ''
  state.filteredBookmarksCache = []
  clearSearchCaches()
}

function maybeWarmPopupSnapshotFullTextForSearch() {
  if (
    state.searchSnapshotFullTextReady ||
    state.searchSnapshotFullTextPending ||
    !state.debouncedQuery.trim()
  ) {
    return
  }

  const snapshotState = state.searchSnapshotState
  const warmupRunId = state.searchSnapshotFullTextRunId + 1
  state.searchSnapshotFullTextRunId = warmupRunId

  if (!shouldWarmPopupSnapshotFullText(snapshotState)) {
    state.searchSnapshotFullTextPending = false
    state.searchSnapshotFullTextReady = false
    return
  }

  state.searchSnapshotFullTextPending = true
  window.setTimeout(() => {
    window.requestAnimationFrame(() => {
      void warmPopupSnapshotFullTextIndex(snapshotState, warmupRunId)
    })
  }, SEARCH_SNAPSHOT_WARM_DELAY_MS)
}

async function warmPopupSnapshotFullTextIndex(snapshotState, warmupRunId) {
  if (state.searchSnapshotFullTextRunId !== warmupRunId || !snapshotState?.index) {
    return
  }

  const indexedBookmarks = await enrichPopupSearchIndexWithSnapshotFullText({
    bookmarks: state.allBookmarks,
    tagIndex: state.searchTagIndex,
    snapshotIndex: snapshotState.index,
    includeFullText: true
  })

  if (state.searchSnapshotFullTextRunId !== warmupRunId) {
    return
  }

  state.allBookmarks = indexedBookmarks
  state.bookmarkMap = new Map(indexedBookmarks.map((bookmark) => [bookmark.id, bookmark]))
  state.bookmarkDuplicateKeyMap = buildPopupBookmarkDuplicateKeyMap(indexedBookmarks)
  state.searchSnapshotFullTextReady = true
  state.searchSnapshotFullTextPending = false
  clearSearchCaches()

  if (state.debouncedQuery) {
    runSearch()
  }

  render()
}

function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(tabs?.[0] || null)
    })
  })
}

function setSearchQuery(value, { immediate = false } = {}) {
  state.searchQuery = value
  state.naturalSearchSetupRequired = false
  state.activeMenuBookmarkId = null
  clearViewNotice()

  if (dom.searchInput.value !== value) {
    dom.searchInput.value = value
  }

  clearTimeout(state.searchTimer)

  if (immediate) {
    state.debouncedQuery = value.trim()
    runSearch()
    render()
    return
  }

  const debounceMs = state.naturalSearchEnabled ? NATURAL_SEARCH_DEBOUNCE_MS : SEARCH_DEBOUNCE_MS
  state.searchTimer = window.setTimeout(() => {
    state.debouncedQuery = value.trim()
    runSearch()
    render()
  }, debounceMs)

  render()
}

async function toggleNaturalLanguageSearch() {
  const enabled = !state.naturalSearchEnabled

  state.naturalSearchEnabled = enabled
  state.naturalSearchSetupRequired = false
  state.naturalSearchPending = false
  state.naturalSearchError = ''
  state.naturalSearchPlan = null
  abortNaturalSearchRequest()
  state.searchHighlightQuery = ''
  state.searchRunId += 1
  render()
  void savePopupPreferences().catch(() => {})

  if (enabled) {
    await prepareNaturalLanguageSearchAi()
  }

  if (state.naturalSearchEnabled !== enabled) {
    return
  }

  setSearchQuery(state.searchQuery, { immediate: true })
  dom.searchInput.focus()
}

async function prepareNaturalLanguageSearchAi() {
  try {
    const naturalSearchAi = await loadNaturalSearchAiModule()
    const settings = await naturalSearchAi.loadNaturalSearchAiProviderSettings()
    if (!naturalSearchAi.hasConfiguredNaturalSearchAiProvider(settings)) {
      state.naturalSearchError = '未配置 AI 渠道，当前使用本地解析。'
      return
    }

    naturalSearchAi.validateNaturalSearchAiProvider(settings)
    await naturalSearchAi.ensureNaturalSearchAiPermissions(settings, { interactive: true })
  } catch {
    state.naturalSearchError = 'AI 未就绪，当前使用本地解析。'
  }
}

function runSearch() {
  const query = state.debouncedQuery
  const normalizedQuery = normalizeQuery(query)
  const runId = state.searchRunId + 1
  state.searchRunId = runId
  state.searchHighlightQuery = normalizedQuery
  state.naturalSearchSetupRequired = false
  state.naturalSearchError = ''

  if (!normalizedQuery) {
    state.searchResults = []
    state.activeResultIndex = 0
    state.searchPending = false
    state.naturalSearchPending = false
    state.naturalSearchPlan = null
    state.filteredBookmarksCacheKey = ''
    state.filteredBookmarksCache = []
    abortNaturalSearchRequest()
    return
  }

  maybeWarmPopupSnapshotFullTextForSearch()

  if (state.naturalSearchEnabled) {
    runNaturalSearch(query, normalizedQuery, runId)
    return
  }

  abortNaturalSearchRequest()
  state.naturalSearchPending = false
  state.naturalSearchPlan = null

  try {
    const cacheKey = getSearchCacheKey(normalizedQuery)
    const cachedResults = state.searchCache.get(cacheKey)
    const bookmarks = getFilteredBookmarks()

    if (cachedResults) {
      state.searchPending = false
      state.searchResults = cachedResults.slice(0, MAX_POPUP_SEARCH_RESULTS)
      state.activeResultIndex = Math.min(
        state.activeResultIndex,
        Math.max(state.searchResults.length - 1, 0)
      )
      return
    }

    if (bookmarks.length < POPUP_SEARCH_ASYNC_THRESHOLD) {
      const results = searchBookmarks(normalizedQuery, bookmarks)
      cacheSearchResults(cacheKey, results)
      state.searchPending = false
      state.searchResults = results.slice(0, MAX_POPUP_SEARCH_RESULTS)
      state.activeResultIndex = Math.min(
        state.activeResultIndex,
        Math.max(state.searchResults.length - 1, 0)
      )
      return
    }

    state.searchPending = true
    state.searchResults = []
    state.activeResultIndex = 0

    searchBookmarksCooperatively(normalizedQuery, bookmarks, {
      isActive: () => state.searchRunId === runId,
      yieldWork
    })
      .then((results) => {
        if (state.searchRunId !== runId) {
          return
        }

        cacheSearchResults(cacheKey, results)
        state.searchPending = false
        state.searchResults = results.slice(0, MAX_POPUP_SEARCH_RESULTS)
        state.activeResultIndex = Math.min(
          state.activeResultIndex,
          Math.max(state.searchResults.length - 1, 0)
        )
        render()
      })
      .catch((error) => {
        if (state.searchRunId !== runId) {
          return
        }

        state.searchPending = false
        state.searchResults = []
        state.loadError = error instanceof Error ? error.message : '查询失败，请重试。'
        render()
      })
  } catch (error) {
    state.searchPending = false
    state.searchResults = []
    state.loadError = error instanceof Error ? error.message : '查询失败，请重试。'
  }
}

async function runNaturalSearch(query, normalizedQuery, runId) {
  abortNaturalSearchRequest()
  const controller = new AbortController()
  state.naturalSearchAbortController = controller
  const cacheKey = getSearchCacheKey(`natural:${getNaturalSearchDateBucket()}:${normalizedQuery}`)
  const planCacheKey = getNaturalSearchPlanCacheKey(normalizedQuery)
  const cachedResults = state.searchCache.get(cacheKey)

  if (!cachedResults) {
    state.searchPending = true
    state.naturalSearchPending = true
    state.searchResults = []
    state.activeResultIndex = 0
  }

  try {
    const naturalSearch = await loadNaturalSearchModule()
    if (state.searchRunId !== runId) {
      return
    }

    if (cachedResults) {
      const cachedPlanResult = await resolveCachedNaturalSearchPlan(query, planCacheKey, naturalSearch)
      if (state.searchRunId !== runId) {
        return
      }

      if (cachedPlanResult.canReuseResults) {
        state.naturalSearchPlan = cachedPlanResult.plan
        state.searchHighlightQuery = cachedPlanResult.plan.highlightQuery || normalizedQuery
        state.searchPending = false
        state.naturalSearchPending = false
        state.searchResults = cachedResults.slice(0, MAX_POPUP_SEARCH_RESULTS)
        state.activeResultIndex = Math.min(
          state.activeResultIndex,
          Math.max(state.searchResults.length - 1, 0)
        )
        render()
        return
      }

      state.searchCache.delete(cacheKey)
      state.searchPending = true
      state.naturalSearchPending = true
      state.searchResults = []
      state.activeResultIndex = 0
    }

    const plan = await resolveNaturalSearchPlan(query, normalizedQuery, naturalSearch, {
      signal: controller.signal
    })
    if (state.searchRunId !== runId) {
      return
    }

    state.naturalSearchPlan = plan
    state.searchHighlightQuery = plan.highlightQuery || normalizedQuery

    const bookmarks = naturalSearch.filterBookmarksByNaturalDateRange(getFilteredBookmarks(), plan)
    const resultSets: NaturalSearchResultSet[] = []
    for (const naturalQuery of plan.queries) {
      if (state.searchRunId !== runId) {
        return
      }

      const results = await searchNaturalQuery(naturalQuery, bookmarks, runId)
      resultSets.push({ query: naturalQuery, results })
    }

    if (state.searchRunId !== runId) {
      return
    }

    const results = naturalSearch.mergeNaturalSearchResultSets(plan, resultSets)
    cacheSearchResults(cacheKey, results)
    state.searchPending = false
    state.naturalSearchPending = false
    state.searchResults = results.slice(0, MAX_POPUP_SEARCH_RESULTS)
    state.activeResultIndex = Math.min(
      state.activeResultIndex,
      Math.max(state.searchResults.length - 1, 0)
    )
    render()
  } catch (error) {
    if (
      state.searchRunId !== runId ||
      isAbortError(error) ||
      (error instanceof Error && error.message === 'search-cancelled')
    ) {
      return
    }

    state.searchPending = false
    state.naturalSearchPending = false
    state.searchResults = []
    state.loadError = error instanceof Error ? error.message : '自然语言搜索失败，请重试。'
    render()
  } finally {
    if (state.naturalSearchAbortController === controller) {
      state.naturalSearchAbortController = null
    }
  }
}

async function resolveCachedNaturalSearchPlan(
  query,
  planCacheKey,
  naturalSearch: typeof import('./natural-search.js')
): Promise<{ plan: NaturalSearchPlan; canReuseResults: boolean }> {
  const localPlan = naturalSearch.buildLocalNaturalSearchPlan(query)
  const cachedPlan = state.naturalSearchPlanCache.get(planCacheKey)
  if (!cachedPlan || cachedPlan.source !== 'ai') {
    return { plan: localPlan, canReuseResults: true }
  }

  try {
    const naturalSearchAi = await loadNaturalSearchAiModule()
    const settings = await naturalSearchAi.loadNaturalSearchAiProviderSettings()
    if (naturalSearchAi.hasConfiguredNaturalSearchAiProvider(settings)) {
      return { plan: cachedPlan, canReuseResults: true }
    }
  } catch {
    // Fall through to local parsing when provider settings cannot be read.
  }

  state.naturalSearchPlanCache.delete(planCacheKey)
  state.naturalSearchError = '未配置 AI 渠道，已使用本地解析。'
  return { plan: localPlan, canReuseResults: false }
}

async function resolveNaturalSearchPlan(
  query,
  normalizedQuery,
  naturalSearch: typeof import('./natural-search.js'),
  options: { signal?: AbortSignal | null } = {}
): Promise<NaturalSearchPlan> {
  const cacheKey = getNaturalSearchPlanCacheKey(normalizedQuery)
  const localPlan = naturalSearch.buildLocalNaturalSearchPlan(query)
  let plan = localPlan
  let settings

  try {
    const naturalSearchAi = await loadNaturalSearchAiModule()
    settings = await naturalSearchAi.loadNaturalSearchAiProviderSettings()
  } catch (error) {
    const naturalSearchAi = await loadNaturalSearchAiModule()
    state.naturalSearchError = naturalSearchAi.normalizeNaturalSearchAiError(error)
    return localPlan
  }

  const naturalSearchAi = await loadNaturalSearchAiModule()
  if (!naturalSearchAi.hasConfiguredNaturalSearchAiProvider(settings)) {
    state.naturalSearchError = '未配置 AI 渠道，已使用本地解析。'
    return localPlan
  }

  const cachedPlan = state.naturalSearchPlanCache.get(cacheKey)
  if (cachedPlan) {
    return cachedPlan
  }

  try {
    plan = await naturalSearchAi.requestNaturalSearchAiPlan({
      query,
      localPlan,
      settings,
      signal: options.signal
    })
    state.naturalSearchError = ''
  } catch (error) {
    state.naturalSearchError = naturalSearchAi.normalizeNaturalSearchAiError(error)
  }

  if (plan.source === 'ai') {
    state.naturalSearchPlanCache.set(cacheKey, plan)
  }

  return plan
}

async function searchNaturalQuery(query, bookmarks, runId): Promise<PopupSearchResult[]> {
  if (!query || !bookmarks.length) {
    return []
  }

  if (bookmarks.length < POPUP_SEARCH_ASYNC_THRESHOLD) {
    return searchBookmarks(query, bookmarks)
  }

  return searchBookmarksCooperatively(query, bookmarks, {
    isActive: () => state.searchRunId === runId,
    yieldWork
  })
}

function render() {
  renderBanner()
  renderAutoAnalyzeStatus()
  renderToolbar()
  renderFilterBar()
  renderSmartClassifier()
  renderMainContent()
  renderFilterModal()
  renderMoveModal()
  renderSmartFolderModal()
  renderEditModal()
  renderDeleteModal()
  renderToasts()
}

function renderBanner() {
  const naturalSearchFallback = isNaturalSearchLocalFallback()
  const naturalSearchPending = state.naturalSearchPending

  dom.heroSubtitle.textContent = state.loadError
    ? '读取失败时不会上传数据，请检查扩展权限后重试'
    : '本地读取，不上传任何书签内容'

  dom.errorBanner.textContent = state.loadError
  dom.errorBanner.classList.toggle('hidden', !state.loadError)
  dom.clearSearch.classList.toggle('hidden', !state.searchQuery)
  dom.searchInput.placeholder = getSearchInputPlaceholder()
  dom.searchInput.setAttribute('aria-label', getSearchInputAriaLabel())
  dom.naturalSearchToggle.classList.toggle('active', state.naturalSearchEnabled)
  dom.naturalSearchToggle.classList.toggle('pending', naturalSearchPending)
  dom.naturalSearchToggle.classList.toggle('fallback', naturalSearchFallback)
  dom.naturalSearchToggle.textContent = getNaturalSearchToggleText()
  dom.naturalSearchToggle.setAttribute('aria-pressed', String(state.naturalSearchEnabled))
  dom.naturalSearchToggle.setAttribute(
    'aria-label',
    getNaturalSearchToggleAriaLabel(naturalSearchPending)
  )
  dom.naturalSearchToggle.title = getNaturalSearchToggleTitle(naturalSearchPending)
  renderSearchTools()
}

function renderSearchTools() {
  const parsed = parseSearchQuery(state.searchQuery)
  const chips = parsed.chips
  dom.searchChips.classList.toggle('hidden', chips.length === 0)
  dom.searchChips.innerHTML = chips
    .map((chip) => `<span class="search-filter-chip ${escapeAttr(chip.kind)}">${escapeHtml(chip.label)}</span>`)
    .join('')
  renderSavedSearches()
}

function renderSavedSearches() {
  const savedSearches = state.savedSearches
    ? getSavedSearchesForScope(state.savedSearches, 'popup')
    : []
  const normalizedQuery = normalizeQuery(state.searchQuery)
  const canSaveCurrent = Boolean(normalizedQuery)
  const hasCurrentSaved = canSaveCurrent && savedSearches.some((item) => normalizeQuery(item.query) === normalizedQuery)
  const show = canSaveCurrent || savedSearches.length > 0 || state.savedSearchesError

  dom.savedSearches.classList.toggle('hidden', !show)
  if (!show) {
    dom.savedSearches.innerHTML = ''
    return
  }

  const status = state.savedSearchesError
    ? `<span class="saved-search-status error">${escapeHtml(state.savedSearchesError)}</span>`
    : !savedSearches.length
      ? '<span class="saved-search-status">还没有保存搜索</span>'
      : ''
  const saveButton = canSaveCurrent
    ? `
      <button class="saved-search-save" type="button" data-saved-search-action="save-current" ${hasCurrentSaved ? 'disabled' : ''}>
        ${hasCurrentSaved ? '已保存' : '保存搜索'}
      </button>
    `
    : ''
  const items = savedSearches.slice(0, 6).map(renderSavedSearchChip).join('')

  dom.savedSearches.innerHTML = `
    <div class="saved-search-head">
      <span>保存搜索</span>
      ${saveButton}
    </div>
    ${status}
    ${items ? `<div class="saved-search-list">${items}</div>` : ''}
  `
}

function renderSavedSearchChip(search: SavedSearch) {
  const isActive = normalizeQuery(search.query) === normalizeQuery(state.searchQuery)
  return `
    <span class="saved-search-chip ${isActive ? 'active' : ''}">
      <button
        class="saved-search-apply"
        type="button"
        data-saved-search-action="apply"
        data-saved-search-id="${escapeAttr(search.id)}"
        title="${escapeAttr(search.query)}"
      >${escapeHtml(search.name || search.query)}</button>
      <button
        class="saved-search-delete"
        type="button"
        data-saved-search-action="delete"
        data-saved-search-id="${escapeAttr(search.id)}"
        aria-label="删除保存搜索：${escapeAttr(search.name || search.query)}"
      >×</button>
    </span>
  `
}

function getSearchInputPlaceholder() {
  return state.naturalSearchEnabled ? '自然语言搜索' : '关键词搜索'
}

function getSearchInputAriaLabel() {
  return state.naturalSearchEnabled
    ? '自然语言搜索书签'
    : '关键词搜索书签标题、网址、标签或高级语法'
}

function isNaturalSearchLocalFallback() {
  return Boolean(
    state.naturalSearchEnabled &&
    (
      state.naturalSearchError ||
      (state.debouncedQuery && state.naturalSearchPlan?.source === 'local')
    )
  )
}

function getNaturalSearchToggleText() {
  if (!state.naturalSearchEnabled) {
    return '语义'
  }

  if (state.naturalSearchPending) {
    return state.naturalSearchError ? '本地' : '理解中'
  }

  if (state.naturalSearchPlan?.source === 'ai' && !state.naturalSearchError) {
    return 'AI'
  }

  return '本地'
}

function getNaturalSearchToggleAriaLabel(isPending: boolean) {
  if (!state.naturalSearchEnabled) {
    return '开启语义和自然语言搜索，本地解析，可在 AI 可用时改写查询'
  }

  if (isPending) {
    return state.naturalSearchError
      ? '本地自然语言搜索正在解析，点击可关闭'
      : '自然语言搜索正在解析，点击可关闭'
  }

  return '关闭语义和自然语言搜索，回到关键词搜索'
}

function getNaturalSearchToggleTitle(isPending: boolean) {
  if (!state.naturalSearchEnabled) {
    return '开启自然语言搜索：优先本地解析，AI 可用时改写查询'
  }

  if (isPending) {
    return state.naturalSearchError
      ? 'AI 不可用，正在使用本地解析；点击关闭'
      : '正在理解搜索意图，点击关闭'
  }

  if (state.naturalSearchPlan?.source === 'ai' && !state.naturalSearchError) {
    return 'AI 已改写查询；点击关闭自然语言搜索'
  }

  return '本地自然语言解析中；点击关闭'
}

function renderToolbar() {
  if (state.viewNoticeMessage && !state.isLoading && !state.searchPending && !state.naturalSearchPending) {
    dom.viewCaption.textContent = state.viewNoticeMessage
    return
  }

  if (state.debouncedQuery) {
    if (state.naturalSearchEnabled) {
      dom.viewCaption.textContent = state.searchPending
        ? getNaturalSearchPendingCaption()
        : `${getNaturalSearchResultCaption()} · ${state.searchResults.length} 条`
      return
    }

    dom.viewCaption.textContent = state.searchPending
      ? '本地搜索中…'
      : `本地匹配 · ${state.searchResults.length} 条`
    return
  }

  const currentRoot = getCurrentTreeRoot()
  dom.viewCaption.textContent = currentRoot?.title || '书签栏'
}

function getNaturalSearchPendingCaption() {
  return state.naturalSearchError ? 'AI 不可用，本地解析中…' : '自然语言搜索解析中…'
}

function getNaturalSearchResultCaption() {
  const plan = state.naturalSearchPlan
  const modeLabel = plan?.source === 'ai' && !state.naturalSearchError
    ? 'AI 改写后匹配'
    : '本地自然语言筛选'
  const statusLabel = getNaturalSearchStatusLabelFallback(plan)
  const detail = statusLabel.replace(/^(AI 解析|本地解析)( · )?/, '').trim()
  return detail ? `${modeLabel} · ${detail}` : modeLabel
}

function getNaturalSearchStatusLabelFallback(plan: NaturalSearchPlan | null): string {
  if (!plan) {
    return '自然语言搜索'
  }

  const parts = [plan.source === 'ai' ? 'AI 解析' : '本地解析']
  if (plan.dateRange?.label) {
    parts.push(plan.dateRange.label)
  }
  const keywordSummary = getNaturalKeywordSummaryFallback(plan)
  if (keywordSummary) {
    parts.push(`关键词 ${keywordSummary}`)
  }
  const exclusionSummary = formatNaturalTermsFallback(plan.excludedTerms, 2)
  if (exclusionSummary) {
    parts.push(`排除 ${exclusionSummary}`)
  }
  return parts.join(' · ')
}

function getNaturalKeywordSummaryFallback(plan: NaturalSearchPlan): string {
  const terms = getQueryTerms(plan.highlightQuery)
    .filter((term) => !plan.excludedTerms.includes(term))
  return formatNaturalTermsFallback(terms, 3)
}

function formatNaturalTermsFallback(terms: string[], limit: number): string {
  const uniqueTerms = [...new Set(terms)]
  const visibleTerms = uniqueTerms
    .slice(0, Math.max(1, limit))
    .map((term) => cleanSmartText(term, 20))
    .filter(Boolean)

  if (!visibleTerms.length) {
    return ''
  }

  const suffix = uniqueTerms.length > visibleTerms.length ? ` 等 ${uniqueTerms.length} 个` : ''
  return `${visibleTerms.join(' / ')}${suffix}`
}

function showViewNotice(message, { durationMs = VIEW_NOTICE_MS } = {}) {
  const normalizedMessage = cleanViewNotice(message)
  if (!normalizedMessage) {
    return
  }

  clearViewNotice()
  state.viewNoticeMessage = normalizedMessage
  renderToolbar()

  state.viewNoticeTimer = window.setTimeout(() => {
    if (state.viewNoticeMessage === normalizedMessage) {
      state.viewNoticeMessage = ''
      renderToolbar()
    }
    state.viewNoticeTimer = null
  }, durationMs)
}

function clearViewNotice() {
  if (state.viewNoticeTimer) {
    window.clearTimeout(state.viewNoticeTimer)
    state.viewNoticeTimer = null
  }
  state.viewNoticeMessage = ''
}

function cleanViewNotice(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= 72) {
    return text
  }
  return `${text.slice(0, 71).trim()}…`
}

function getPopupActionKey(action, targetId = '') {
  return `${String(action || 'action')}:${String(targetId || 'global')}`
}

function isPopupActionPending(action, targetId = '') {
  return state.pendingActionIds.has(getPopupActionKey(action, targetId))
}

function setPopupActionPending(action, targetId, pending) {
  const key = getPopupActionKey(action, targetId)
  if (pending) {
    state.pendingActionIds.add(key)
  } else {
    state.pendingActionIds.delete(key)
  }
}

function hasBlockingPopupActionPending() {
  return [...state.pendingActionIds].some((key) => {
    return (
      key.startsWith('move:') ||
      key.startsWith('edit:') ||
      key.startsWith('delete:') ||
      key.startsWith('undo-delete:') ||
      key.startsWith('save-current-page:')
    )
  })
}

function renderFilterBar() {
  const selectedFolder = state.selectedFolderFilterId
    ? state.folderMap.get(state.selectedFolderFilterId)
    : null
  const selectedPath = selectedFolder ? formatFolderPath(selectedFolder, state.folderMap) : ''

  dom.folderFilterTrigger.textContent = selectedFolder
    ? `文件夹：${selectedPath || selectedFolder.title}`
    : '全部文件夹'
  dom.folderFilterTrigger.title = selectedPath || ''
  dom.clearFolderFilter.classList.toggle('hidden', !selectedFolder)
  dom.folderBreadcrumbs.classList.toggle('hidden', !selectedFolder)
  dom.folderBreadcrumbs.innerHTML = selectedFolder
    ? renderPopupFolderBreadcrumbs(selectedFolder)
    : ''
}

function renderPopupFolderBreadcrumbs(folder) {
  const segments = buildBookmarkPathSegments(folder, state.folderMap)
  if (!segments.length) {
    return ''
  }

  return `
    <ol class="folder-breadcrumb-list">
      ${segments.map((segment, index) => {
        const separator = index > 0 ? '<li class="folder-breadcrumb-separator" aria-hidden="true">&gt;</li>' : ''
        const content = segment.current || !segment.id
          ? `
            <span
              class="folder-breadcrumb-current"
              aria-current="page"
              title="${escapeAttr(segment.path)}"
            >${escapeHtml(segment.label)}</span>
          `
          : `
            <button
              class="folder-breadcrumb-link"
              type="button"
              data-folder-breadcrumb-id="${escapeAttr(segment.id)}"
              title="${escapeAttr(segment.path)}"
            >${escapeHtml(segment.label)}</button>
          `

        return `${separator}<li>${content}</li>`
      }).join('')}
    </ol>
  `
}

function renderSmartClassifier() {
  const currentUrl = String(state.currentTab?.url || '').trim()
  const smartAvailable = isSmartClassifiableUrl(currentUrl)
  const smartOverlayActive =
    smartAvailable && ['loading', 'results', 'error', 'permission'].includes(state.smartStatus)

  document.body.classList.toggle('smart-active', smartOverlayActive)
  dom.smartClassifier.classList.toggle('hidden', !smartAvailable)
  dom.smartFooter.classList.toggle('hidden', !smartOverlayActive)
  dom.smartTotal.textContent = `总计 ${state.allBookmarks.length}`

  if (!smartAvailable) {
    return
  }

  if (state.isLoading && state.smartStatus !== 'results') {
    dom.smartClassifier.innerHTML = `<div class="state-panel">${renderPopupLoadingStack('正在读取当前网页…')}</div>`
    return
  }

  if (state.smartStatus === 'loading') {
    renderSmartLoadingState()
    animateSmartProgress()
    return
  }

  if (state.smartStatus === 'results') {
    dom.smartClassifier.innerHTML = renderSmartResultCard()
    return
  }

  if (state.smartStatus === 'error') {
    dom.smartClassifier.innerHTML = `
      ${renderSmartPageCard()}
      <div class="smart-panel-head smart-panel-head-standalone">
        <p>智能分类失败</p>
        ${renderSmartExitButton()}
      </div>
      <div class="error-banner">${escapeHtml(state.smartError || '智能分类失败，请稍后重试。')}</div>
      <div class="smart-actions smart-actions-three">
        <button class="smart-cancel-button" type="button" data-smart-action="manual-folder">
          手动选择
        </button>
        <button class="smart-settings-action" type="button" data-smart-action="open-ai-settings">
          AI 设置
        </button>
        <button class="smart-classify-button" type="button" data-smart-action="classify">
          重试
        </button>
      </div>
    `
    return
  }

  if (state.smartStatus === 'permission') {
    dom.smartClassifier.innerHTML = renderSmartPermissionCard()
    return
  }

  dom.smartClassifier.innerHTML = renderSmartPageCard()
}

function renderSmartPageCard() {
  const title = getCurrentPageTitle()
  const favicon = String(state.currentTab?.favIconUrl || '')
  const bookmark = state.currentPageBookmarkId
    ? state.bookmarkMap.get(state.currentPageBookmarkId)
    : null

  return `
    <article class="smart-page-card ${bookmark ? 'bookmarked' : 'unbookmarked'}">
      <div class="smart-page-main">
        <span class="smart-page-icon" aria-hidden="true">
          ${favicon ? `<img src="${escapeAttr(favicon)}" alt="">` : escapeHtml(getSmartFallbackIconLabel(title))}
        </span>
        <div class="smart-page-copy">
          <p class="smart-page-title" title="${escapeAttr(title)}">${escapeHtml(title)}</p>
          <p class="smart-page-status" title="${escapeAttr(bookmark?.path || '')}">
            ${bookmark ? `已收藏 · ${escapeHtml(formatBookmarkPath(bookmark.path) || '未归档路径')}` : '未收藏 · 可快速保存到文件夹'}
          </p>
        </div>
      </div>
      ${bookmark ? renderBookmarkedCurrentPageActions(bookmark) : renderUnbookmarkedCurrentPageActions()}
    </article>
  `
}

function renderBookmarkedCurrentPageActions(bookmark) {
  const pinPending = isPopupActionPending('pin-newtab', bookmark.id)
  return `
    <div class="current-page-actions" aria-label="当前页快捷操作">
      <button class="current-page-action" type="button" data-current-page-action="open-folder">所在文件夹</button>
      <button class="current-page-action" type="button" data-current-page-action="edit">编辑</button>
      <button class="current-page-action primary" type="button" data-current-page-action="pin-newtab" ${pinPending ? 'disabled' : ''}>
        ${pinPending ? renderButtonLoadingLabel('固定中') : '固定到 newtab'}
      </button>
    </div>
  `
}

function renderUnbookmarkedCurrentPageActions() {
  return `
    <div class="current-page-actions" aria-label="当前页快捷操作">
      <button class="current-page-action primary" type="button" data-current-page-action="save">快速保存</button>
      <button class="current-page-action" type="button" data-smart-action="classify">智能分类</button>
    </div>
  `
}

function renderSmartExitButton() {
  return `
    <button class="smart-exit-button" type="button" data-smart-action="exit" aria-label="退出智能分类">
      退出
    </button>
  `
}

function renderSmartManualButton() {
  return `
    <button class="smart-manual-button" type="button" data-smart-action="manual-folder">
      <span class="smart-folder-icon" aria-hidden="true"></span>
      <span>手动选择文件夹</span>
    </button>
  `
}

function renderSmartPermissionCard() {
  const origins = Array.isArray(state.smartPermissionRequest?.origins)
    ? state.smartPermissionRequest.origins
    : []

  return `
    <article class="smart-permission-card">
      <div class="smart-panel-head">
        <p>需要授权 AI 渠道</p>
        ${renderSmartExitButton()}
      </div>
      <div class="smart-permission-body">
        <p class="smart-permission-copy">
          智能分类需要访问你配置的 AI 服务地址。当前网页不会申请额外权限，正文读取失败时会用标题和 URL 继续推荐。
        </p>
        ${
          origins.length
            ? `<div class="smart-permission-origins">${origins
                .map((origin) => `<span>${escapeHtml(formatPermissionOrigin(origin))}</span>`)
                .join('')}</div>`
            : ''
        }
        ${
          state.smartError
            ? `<p class="smart-permission-error">${escapeHtml(state.smartError)}</p>`
            : ''
        }
      </div>
      <div class="smart-actions">
        <button class="smart-cancel-button" type="button" data-smart-action="manual-folder">
          手动选择
        </button>
        <button class="smart-settings-action" type="button" data-smart-action="open-ai-settings">
          AI 设置
        </button>
        <button class="smart-classify-button" type="button" data-smart-action="grant-permission">
          授权并继续
        </button>
      </div>
    </article>
  `
}

function renderPopupLoadingStack(label) {
  return `
    <span class="popup-loading-stack">
      ${renderDotMatrixLoader({ variant: 'spiral', className: 'popup-loading-loader' })}
      <span>${escapeHtml(label)}</span>
    </span>
  `
}

function renderButtonLoadingLabel(label) {
  return `
    <span class="button-loading-label">
      ${renderDotMatrixLoader({ variant: 'bar', className: 'button-dot-loader' })}
      <span>${escapeHtml(label)}</span>
    </span>
  `
}

function renderSmartLoadingCard(currentProgress = state.smartProgressPercent) {
  const step = Math.max(1, Math.min(state.smartStep || 1, SMART_LOADING_STEP_COUNT))
  const progress = getSmartProgressTarget()
  const startProgress = Math.max(0, Math.min(Number(currentProgress) || 0, progress))

  return `
    <article class="smart-loading-card">
      <div class="smart-panel-head">
        <p>智能分类</p>
        ${renderSmartExitButton()}
      </div>
      <div class="smart-loading-body">
        ${renderDotMatrixLoader({ variant: 'spiral', className: 'smart-loading-loader' })}
        <div class="smart-loading-content">
          <p class="smart-loading-copy">
            <span>${escapeHtml(getSmartLoadingLabel())}</span>
            <small>${step}/${SMART_LOADING_STEP_COUNT}</small>
          </p>
          <div class="smart-progress-track" aria-hidden="true">
            <span
              class="smart-progress-bar"
              data-smart-progress-target="${escapeAttr(String(progress))}"
              style="--smart-progress-scale: ${startProgress / 100}"
            ></span>
          </div>
        </div>
      </div>
    </article>
  `
}

function renderSmartLoadingState() {
  const existingCard = dom.smartClassifier.querySelector<HTMLElement>('.smart-loading-card')
  if (!existingCard) {
    dom.smartClassifier.innerHTML = renderSmartLoadingCard(state.smartProgressPercent)
    return
  }

  const step = Math.max(1, Math.min(state.smartStep || 1, SMART_LOADING_STEP_COUNT))
  const progress = getSmartProgressTarget()
  const label = existingCard.querySelector<HTMLElement>('.smart-loading-copy span')
  const stepLabel = existingCard.querySelector<HTMLElement>('.smart-loading-copy small')
  const progressBar = existingCard.querySelector<HTMLElement>('.smart-progress-bar')

  if (label) {
    label.textContent = getSmartLoadingLabel()
  }
  if (stepLabel) {
    stepLabel.textContent = `${step}/${SMART_LOADING_STEP_COUNT}`
  }
  if (progressBar) {
    progressBar.dataset.smartProgressTarget = String(progress)
  }
}

function animateSmartProgress() {
  const progressBar = dom.smartClassifier.querySelector<HTMLElement>('.smart-progress-bar')
  if (!progressBar) {
    return
  }

  const targetProgress = Math.max(
    0,
    Math.min(Number(progressBar.getAttribute('data-smart-progress-target')) || 0, 100)
  )

  window.requestAnimationFrame(() => {
    progressBar.style.setProperty('--smart-progress-scale', String(targetProgress / 100))
    state.smartProgressPercent = targetProgress
  })
}

function renderSmartResultCard() {
  const selectedId = state.smartSelectedRecommendationId
  const recommendations = state.smartRecommendations || []
  const canSave = Boolean(recommendations.length && !state.smartSaving && !state.smartSaved)

  return `
    <article class="smart-result-card">
      <div class="smart-panel-head">
        <p>推荐文件夹</p>
        ${renderSmartExitButton()}
      </div>
      <div class="smart-title-row">
        <input
          id="smart-title-input"
          class="smart-title-input"
          type="text"
          spellcheck="false"
          maxlength="180"
          value="${escapeAttr(state.smartSuggestedTitle || getCurrentPageTitle())}"
          aria-label="推荐书签标题"
        >
      </div>

      <p class="smart-section-label">推荐文件夹</p>
      <div class="smart-recommendations">
        ${
          recommendations.length
            ? recommendations.map((recommendation) => renderSmartRecommendation(recommendation, selectedId)).join('')
            : '<div class="state-panel compact">未生成可用推荐，请手动选择文件夹。</div>'
        }
      </div>

      <div class="smart-actions">
        <button class="smart-cancel-button" type="button" data-smart-action="reset">取消</button>
        <button class="smart-save-button ${state.smartSaved ? 'saved' : ''}" type="button" data-smart-action="save" ${canSave ? '' : 'disabled'}>
          ${state.smartSaved ? '已保存' : state.smartSaving ? renderButtonLoadingLabel('保存中') : '确认保存'}
        </button>
      </div>
    </article>
    ${renderSmartManualButton()}
  `
}

function renderSmartRecommendation(recommendation, selectedId) {
  const isSelected = recommendation.id === selectedId
  const confidence = Math.round(Math.max(0, Math.min(Number(recommendation.confidence) || 0, 1)) * 100)
  const path = recommendation.path || recommendation.title || ''
  const formattedPath = formatBookmarkPath(path) || path

  return `
    <button
      class="smart-folder-option ${isSelected ? 'selected' : ''}"
      type="button"
      data-smart-recommendation="${escapeAttr(recommendation.id)}"
    >
      <span class="smart-folder-main">
        <span class="smart-folder-head">
          <span class="smart-folder-icon" aria-hidden="true"></span>
          <span class="smart-folder-name">${escapeHtml(recommendation.title || path || '未命名文件夹')}</span>
        </span>
        <span class="smart-folder-path" title="${escapeAttr(formattedPath)}">${escapeHtml(formattedPath || '未归档路径')}</span>
      </span>
      <span class="smart-folder-meta">
        ${recommendation.kind === 'new' ? '<span class="smart-new-badge">新建</span>' : ''}
        ${isSelected ? '<span class="smart-checkmark">✓</span>' : ''}
        <span>${escapeHtml(String(confidence))}%</span>
      </span>
    </button>
  `
}

function renderMainContent() {
  const hasQuery = Boolean(state.debouncedQuery)
  const showNaturalSearchSetup =
    state.naturalSearchSetupRequired &&
    !state.isLoading &&
    !state.searchPending &&
    !state.naturalSearchPending
  const showSearchLoading =
    hasQuery &&
    state.searchPending &&
    !state.searchResults.length &&
    !state.isLoading
  const showEmptySearch =
    hasQuery &&
    !state.searchPending &&
    !state.searchResults.length &&
    !state.isLoading
  const currentRoot = getCurrentTreeRoot()
  const showEmptyTree =
    !hasQuery &&
    !state.isLoading &&
    (!currentRoot || !(currentRoot.children || []).length)

  dom.loadingState.classList.toggle('hidden', !(state.isLoading || showSearchLoading))
  dom.content.classList.toggle(
    'hidden',
    state.isLoading || showSearchLoading || showNaturalSearchSetup || showEmptySearch || showEmptyTree
  )
  dom.emptyState.classList.toggle('hidden', !(showNaturalSearchSetup || showEmptySearch || showEmptyTree))

  if (showNaturalSearchSetup) {
    dom.emptyState.innerHTML = renderNaturalSearchSetupState()
  } else if (showEmptySearch) {
    dom.emptyState.innerHTML = renderEmptySearchState()
  } else if (showEmptyTree) {
    dom.emptyState.textContent = state.selectedFolderFilterId
      ? '当前筛选文件夹下暂无可展示内容'
      : '未找到可展示的书签栏内容'
  }

  if (state.isLoading) {
    dom.loadingState.innerHTML = renderPopupLoadingStack('正在加载书签…')
    return
  }

  if (showSearchLoading) {
    dom.loadingState.innerHTML = renderPopupLoadingStack(
      state.naturalSearchEnabled ? '正在理解搜索意图…' : '正在搜索书签…'
    )
    return
  }

  replaceContentHtml(hasQuery ? renderSearchResults() : renderTreeView(), {
    preserveScroll: !hasQuery
  })
  updateActiveResultVisibility()
}

function renderNaturalSearchSetupState() {
  return `
    <div class="empty-search-state natural-search-setup-state">
      <p class="empty-title">正在使用本地解析</p>
      <p class="empty-hint">无需配置 AI 渠道；配置后可尝试 AI 改写，失败也会继续本地解析。</p>
      <div class="empty-actions">
        <button class="empty-action primary" type="button" data-empty-action="dismiss-natural-setup">继续本地解析</button>
        <button class="empty-action" type="button" data-empty-action="open-ai-settings">配置 AI 增强</button>
      </div>
    </div>
  `
}

function renderEmptySearchState() {
  const naturalSearchActive = state.naturalSearchEnabled
  const hasFolderFilter = Boolean(state.selectedFolderFilterId)
  const title = naturalSearchActive
    ? (hasFolderFilter ? '当前文件夹未匹配自然语言条件' : '未找到符合自然语言条件的书签')
    : (hasFolderFilter ? '当前文件夹未找到相关书签' : '未找到相关书签')
  const hint = naturalSearchActive
    ? '可以清除筛选、查看全部，或关闭自然语言搜索改用关键词语法。'
    : '可以清除筛选、查看全部，或试试 site:github.com、folder:"前端 资料"、最近 2 周、-视频 等高级语法。'
  const actions = [
    '<button class="empty-action primary" type="button" data-empty-action="clear-query">清空搜索</button>',
    hasFolderFilter
      ? '<button class="empty-action" type="button" data-empty-action="clear-filter">清除筛选</button>'
      : '',
    '<button class="empty-action" type="button" data-empty-action="show-all">查看全部</button>',
    naturalSearchActive
      ? '<button class="empty-action" type="button" data-empty-action="toggle-natural">关闭自然语言</button>'
      : '<button class="empty-action" type="button" data-empty-action="toggle-natural">自然语言搜索</button>'
  ].filter(Boolean).join('')

  return `
    <div class="empty-search-state">
      <p class="empty-title">${escapeHtml(title)}</p>
      <p class="empty-hint">${escapeHtml(hint)}</p>
      <div class="empty-actions">
        ${actions}
      </div>
    </div>
  `
}

function replaceContentHtml(nextHtml, { preserveScroll = false } = {}) {
  if (state.contentRenderHtml === nextHtml) {
    return
  }

  const previousScrollTop = dom.content.scrollTop
  state.contentRenderHtml = nextHtml
  dom.content.innerHTML = nextHtml

  if (preserveScroll) {
    dom.content.scrollTop = previousScrollTop
  }
}

function renderTreeView() {
  const currentRoot = getCurrentTreeRoot()
  if (!currentRoot) {
    return ''
  }

  return renderFolderNode(currentRoot, 0)
}

function renderFolderNode(node, depth) {
  const currentRoot = getCurrentTreeRoot()
  const isPinnedRoot = depth === 0 && currentRoot?.id === node.id
  const isExpanded =
    isPinnedRoot || state.expandedFolders.has(node.id)
  const children = Array.isArray(node.children) ? node.children : []
  const folderInfo = state.folderMap.get(node.id)
  const toggleLabel = getPopupFolderToggleLabel(
    isExpanded ? '折叠文件夹' : '展开文件夹',
    folderInfo ? formatFolderPath(folderInfo, state.folderMap) || folderInfo.title : node.title
  )
  const childMarkup = isExpanded
    ? children
        .map((child) => {
          if (child.url) {
            const bookmark = state.bookmarkMap.get(child.id)
            return bookmark ? renderBookmarkRow(bookmark, depth + 1) : ''
          }

          return renderFolderNode(child, depth + 1)
        })
        .join('')
    : ''

  const toggleMarkup = isPinnedRoot
    ? '<span class="tree-toggle-spacer" aria-hidden="true"></span>'
    : `
      <button
        class="tree-toggle ${isExpanded ? 'expanded' : ''}"
        type="button"
        data-toggle-folder="${escapeAttr(node.id)}"
        aria-label="${escapeAttr(toggleLabel)}"
      ></button>
    `

  const cardMarkup = isPinnedRoot
    ? `
      <div class="folder-card root-folder-card">
        <span class="folder-kind" aria-hidden="true"></span>
        <span class="row-main">
          <span class="row-title">${escapeHtml(node.title || '未命名文件夹')}</span>
          <span class="row-subtitle">${escapeHtml(describeFolder(folderInfo))}</span>
        </span>
      </div>
    `
    : `
      <button
        class="folder-card"
        type="button"
        data-toggle-folder="${escapeAttr(node.id)}"
        aria-expanded="${isExpanded}"
      >
        <span class="folder-kind" aria-hidden="true"></span>
        <span class="row-main">
          <span class="row-title">${escapeHtml(node.title || '未命名文件夹')}</span>
          <span class="row-subtitle">${escapeHtml(describeFolder(folderInfo))}</span>
        </span>
      </button>
    `

  return `
    <div class="tree-row folder-row ${isPinnedRoot ? 'root-folder-row' : ''}" style="--depth:${depth}">
      ${toggleMarkup}
      ${cardMarkup}
    </div>
    ${childMarkup}
  `
}

function renderBookmarkRow(bookmark, depth) {
  const isMenuOpen = state.activeMenuBookmarkId === bookmark.id
  const menuId = getActionMenuId(bookmark.id)
  const menuLabel = getBookmarkActionMenuLabel(bookmark)

  return `
    <div class="tree-row bookmark-row" style="--depth:${depth}">
      <button class="bookmark-card" type="button" data-open-bookmark="${escapeAttr(bookmark.id)}">
        <span class="bookmark-kind" aria-hidden="true"></span>
        <span class="row-main">
          <span class="row-title">${escapeHtml(bookmark.title)}</span>
          <span class="row-subtitle" title="${escapeAttr(bookmark.url)}">${escapeHtml(bookmark.displayUrl)}</span>
        </span>
      </button>
      <div class="menu-anchor">
        <button class="icon-button" type="button" data-open-menu="${escapeAttr(bookmark.id)}" aria-label="${escapeAttr(menuLabel)}" aria-haspopup="menu" aria-expanded="${String(isMenuOpen)}" aria-controls="${escapeAttr(menuId)}"></button>
        ${renderActionMenu(bookmark.id)}
      </div>
    </div>
  `
}

function renderSearchResults() {
  return state.searchResults
    .map((bookmark, index) => {
      const isActive = index === state.activeResultIndex
      const isMenuOpen = state.activeMenuBookmarkId === bookmark.id
      const menuId = getActionMenuId(bookmark.id)
      const menuLabel = getBookmarkActionMenuLabel(bookmark)
      const matchReason = Array.isArray(bookmark.matchReasons) && bookmark.matchReasons.length
        ? bookmark.matchReasons.join(' · ')
        : ''

      return `
        <article class="result-card ${isActive ? 'active' : ''}" data-result-index="${index}">
          <button class="result-main" type="button" data-open-bookmark="${escapeAttr(bookmark.id)}">
            <span class="bookmark-kind" aria-hidden="true"></span>
            <span class="result-copy">
              <span class="result-title">${highlightText(bookmark.title, state.searchHighlightQuery || state.debouncedQuery)}</span>
              <span class="result-url" title="${escapeAttr(bookmark.url)}">${highlightText(bookmark.displayUrl, state.searchHighlightQuery || state.debouncedQuery)}</span>
              <span class="result-path-shell">
                <span
                  class="result-path"
                  title="${escapeAttr(bookmark.path || '未归档路径')}"
                >${escapeHtml(bookmark.path || '未归档路径')}</span>
              </span>
              ${matchReason
                ? `<span class="result-match-reason" title="${escapeAttr(matchReason)}">${escapeHtml(matchReason)}</span>`
                : ''}
            </span>
          </button>
          <div class="menu-anchor">
            <button class="icon-button" type="button" data-open-menu="${escapeAttr(bookmark.id)}" aria-label="${escapeAttr(menuLabel)}" aria-haspopup="menu" aria-expanded="${String(isMenuOpen)}" aria-controls="${escapeAttr(menuId)}"></button>
            ${renderActionMenu(bookmark.id)}
          </div>
        </article>
      `
    })
    .join('')
}

function getBookmarkActionMenuLabel(bookmark) {
  const title = cleanSmartText(bookmark?.title || '未命名书签', 48)
  return `打开 ${title} 的操作菜单`
}

function getBookmarkActionLabel(action, bookmarkId) {
  const bookmark = state.bookmarkMap.get(String(bookmarkId || ''))
  const title = cleanSmartText(bookmark?.title || bookmark?.displayUrl || bookmarkId || '未命名书签', 48)
  return `${action}：${title || '未命名书签'}`
}

function getPopupFolderToggleLabel(action, folderPath) {
  const target = cleanSmartText(folderPath || '未命名文件夹', 72)
  return `${action}：${target || '未命名文件夹'}`
}

function renderActionMenu(bookmarkId) {
  if (state.activeMenuBookmarkId !== bookmarkId) {
    return ''
  }

  const menuBusy = hasBlockingPopupActionPending()
  const copyBusy = isPopupActionPending('copy-url', bookmarkId)
  const openBusy = isPopupActionPending('open-current-tab', bookmarkId)
  const moveBusy = isPopupActionPending('move', bookmarkId)
  const editBusy = isPopupActionPending('edit', bookmarkId)
  const deleteBusy = isPopupActionPending('delete', bookmarkId)
  const menuId = getActionMenuId(bookmarkId)
  const editLabel = getBookmarkActionLabel('编辑书签', bookmarkId)
  const copyLabel = getBookmarkActionLabel('复制书签链接', bookmarkId)
  const openLabel = getBookmarkActionLabel('当前页打开书签', bookmarkId)
  const moveLabel = getBookmarkActionLabel('移动书签', bookmarkId)
  const deleteLabel = getBookmarkActionLabel('删除书签', bookmarkId)

  return `
    <div id="${escapeAttr(menuId)}" class="action-menu" role="menu" aria-label="书签操作">
      <button role="menuitem" type="button" data-menu-action="edit" data-bookmark-id="${escapeAttr(bookmarkId)}" aria-label="${escapeAttr(editLabel)}" ${menuBusy || editBusy ? 'disabled' : ''}>编辑</button>
      <button role="menuitem" type="button" data-menu-action="copy-url" data-bookmark-id="${escapeAttr(bookmarkId)}" aria-label="${escapeAttr(copyLabel)}" ${copyBusy ? 'disabled' : ''}>复制链接</button>
      <button role="menuitem" type="button" data-menu-action="open-current-tab" data-bookmark-id="${escapeAttr(bookmarkId)}" aria-label="${escapeAttr(openLabel)}" ${menuBusy || openBusy ? 'disabled' : ''}>当前页打开</button>
      <button role="menuitem" type="button" data-menu-action="move" data-bookmark-id="${escapeAttr(bookmarkId)}" aria-label="${escapeAttr(moveLabel)}" ${menuBusy || moveBusy ? 'disabled' : ''}>移动至</button>
      <button role="menuitem" class="danger" type="button" data-menu-action="delete" data-bookmark-id="${escapeAttr(bookmarkId)}" aria-label="${escapeAttr(deleteLabel)}" ${menuBusy || deleteBusy ? 'disabled' : ''}>删除</button>
    </div>
  `
}

function getActionMenuId(bookmarkId) {
  return `popup-action-menu-${String(bookmarkId || '').replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

function setPopupSurfaceOpen(element, open) {
  if (!element) {
    return
  }

  if (open) {
    cancelExitMotion(element)
    element.classList.remove('hidden', 'is-closing')
    return
  }

  if (element.classList.contains('hidden') || element.classList.contains('is-closing')) {
    return
  }

  void closeWithExitMotion(element, 'is-closing', () => {
    element.classList.add('hidden')
  }, 220)
}

function renderFilterModal() {
  setPopupSurfaceOpen(dom.filterModal, state.isFilterPickerOpen)

  if (!state.isFilterPickerOpen) {
    syncBackdropVisibility()
    return
  }

  dom.filterSearchInput.value = state.filterSearchQuery
  dom.filterFolderList.innerHTML = renderFilterFolderList()
  syncBackdropVisibility()
}

function renderMoveModal() {
  const bookmark = state.moveTargetBookmarkId
    ? state.bookmarkMap.get(state.moveTargetBookmarkId)
    : null
  const isOpen = Boolean(bookmark)

  setPopupSurfaceOpen(dom.moveModal, isOpen)

  if (!isOpen) {
    syncBackdropVisibility()
    return
  }

  dom.moveBookmarkTitle.textContent = bookmark.title
  dom.moveBookmarkPath.textContent = formatBookmarkPath(bookmark.path) || '未归档路径'
  dom.moveSearchInput.value = state.moveSearchQuery
  dom.moveFolderList.innerHTML = renderMoveFolderList(bookmark)
  syncBackdropVisibility()
}

function renderSmartFolderModal() {
  setPopupSurfaceOpen(dom.smartFolderModal, state.smartFolderPickerOpen)

  if (!state.smartFolderPickerOpen) {
    syncBackdropVisibility()
    return
  }

  dom.smartFolderPageTitle.textContent = state.smartSuggestedTitle || getCurrentPageTitle()
  dom.smartFolderPageUrl.textContent = getSmartFolderTargetPathLabel()
  dom.smartFolderSearchInput.value = state.smartFolderSearchQuery
  dom.smartFolderList.innerHTML = renderSmartFolderList()
  syncBackdropVisibility()
}

function renderEditModal() {
  const bookmark = state.editTargetBookmarkId
    ? state.bookmarkMap.get(state.editTargetBookmarkId)
    : null
  const isOpen = Boolean(bookmark)

  setPopupSurfaceOpen(dom.editModal, isOpen)

  if (!isOpen) {
    syncBackdropVisibility()
    return
  }

  if (state.editDraftBookmarkId !== bookmark.id) {
    resetEditDraft(bookmark)
  }

  dom.editBookmarkPath.textContent = bookmark.path || '未归档路径'
  if (dom.editTitleInput.value !== state.editDraftTitle) {
    dom.editTitleInput.value = state.editDraftTitle
  }
  if (dom.editUrlInput.value !== state.editDraftUrl) {
    dom.editUrlInput.value = state.editDraftUrl
  }
  renderEditDraftControls()
  syncBackdropVisibility()
}

function renderDeleteModal() {
  const bookmark = state.confirmDeleteBookmarkId
    ? state.bookmarkMap.get(state.confirmDeleteBookmarkId)
    : null
  const isOpen = Boolean(bookmark)

  setPopupSurfaceOpen(dom.deleteModal, isOpen)

  if (!isOpen) {
    syncBackdropVisibility()
    return
  }

  dom.deleteBookmarkTitle.textContent = bookmark.title
  dom.deleteBookmarkPath.textContent = bookmark.path || '未归档路径'
  dom.cancelDelete.disabled = isPopupActionPending('delete', bookmark.id)
  dom.confirmDelete.disabled = isPopupActionPending('delete', bookmark.id)
  dom.confirmDelete.textContent = isPopupActionPending('delete', bookmark.id) ? '删除中…' : '删除'
  syncBackdropVisibility()
}

function resetEditDraft(bookmark) {
  clearEditDiscardGuard()
  state.editDraftBookmarkId = String(bookmark?.id || '')
  state.editDraftTitle = String(bookmark?.title || '')
  state.editDraftUrl = String(bookmark?.url || '')
  state.editDraftDirty = false
  state.editSaving = false
}

function clearEditDraft() {
  clearEditDiscardGuard()
  state.editDraftBookmarkId = ''
  state.editDraftTitle = ''
  state.editDraftUrl = ''
  state.editDraftDirty = false
  state.editSaving = false
}

function handleEditDraftInput() {
  if (!state.editTargetBookmarkId || state.editSaving) {
    return
  }

  state.editDraftBookmarkId = String(state.editTargetBookmarkId)
  state.editDraftTitle = dom.editTitleInput.value
  state.editDraftUrl = dom.editUrlInput.value
  state.editDraftDirty = isCurrentEditDraftDirty()
  clearEditDiscardGuard()
  renderEditDraftControls()
}

function clearEditDiscardGuard() {
  if (state.editDiscardTimer) {
    window.clearTimeout(state.editDiscardTimer)
    state.editDiscardTimer = null
  }
  state.editDiscardArmed = false
}

function shouldBlockDirtyEditClose() {
  if (!state.editTargetBookmarkId || !state.editDraftDirty) {
    return false
  }

  if (state.editDiscardArmed) {
    clearEditDiscardGuard()
    return false
  }

  state.editDiscardArmed = true
  showToast({
    type: 'info',
    message: '编辑尚未保存，再次取消将放弃修改。'
  })
  state.editDiscardTimer = window.setTimeout(() => {
    state.editDiscardArmed = false
    state.editDiscardTimer = null
  }, 1800)
  return true
}

function isCurrentEditDraftDirty() {
  const bookmark = state.editTargetBookmarkId
    ? state.bookmarkMap.get(state.editTargetBookmarkId)
    : null

  if (!bookmark) {
    return false
  }

  return (
    String(state.editDraftTitle || '') !== String(bookmark.title || '') ||
    String(state.editDraftUrl || '') !== String(bookmark.url || '')
  )
}

function renderEditDraftControls() {
  if (!dom.saveEdit) {
    return
  }

  const bookmarkId = state.editTargetBookmarkId || state.editDraftBookmarkId
  const saving = state.editSaving || isPopupActionPending('edit', bookmarkId || '')
  const dirty = Boolean(state.editDraftDirty)

  dom.saveEdit.disabled = saving || !dirty
  dom.saveEdit.textContent = saving ? '保存中…' : dirty ? '保存' : '未修改'
  dom.cancelEdit.disabled = saving
  dom.closeEditModal.disabled = saving
  dom.editTitleInput.disabled = saving
  dom.editUrlInput.disabled = saving
}

function syncBackdropVisibility() {
  const hasOpenModal = Boolean(
    state.isFilterPickerOpen ||
      state.moveTargetBookmarkId ||
      state.smartFolderPickerOpen ||
      state.editTargetBookmarkId ||
      state.confirmDeleteBookmarkId
  )
  syncPopupAppShellModalState(hasOpenModal)
  dom.modalBackdrop.setAttribute('aria-hidden', String(!hasOpenModal))
  setPopupSurfaceOpen(dom.modalBackdrop, hasOpenModal)
}

function syncPopupAppShellModalState(hasOpenModal) {
  if (!dom.appShell) {
    return
  }

  if (hasOpenModal) {
    dom.appShell.setAttribute('aria-hidden', 'true')
    dom.appShell.setAttribute('inert', '')
    return
  }

  dom.appShell.setAttribute('aria-hidden', 'false')
  dom.appShell.removeAttribute('inert')
}

function renderFilterFolderList() {
  const query = normalizeText(state.filterSearchQuery)
  const folders = query
    ? state.allFolders.filter((folder) => {
        return (
          folder.normalizedTitle.includes(query) ||
          folder.normalizedPath.includes(query)
        )
      })
    : state.allFolders

  const activeId = resolveFilterFolderActiveId(folders)
  const folderItems = folders
    .map((folder) => {
      const isSelected = state.selectedFolderFilterId === folder.id
      const isActive = folder.id === activeId
      const folderPath = formatFolderPath(folder, state.folderMap) || folder.title || '未命名文件夹'
      return `
        <button
          class="filter-option ${isSelected ? 'selected' : ''}"
          type="button"
          role="option"
          aria-selected="${isSelected ? 'true' : 'false'}"
          data-select-filter-folder="${escapeAttr(folder.id)}"
          tabindex="${isActive ? '0' : '-1'}"
          title="${escapeAttr(folder.path)}"
        >
          <span class="folder-kind" aria-hidden="true"></span>
          <span class="filter-option-copy">
            <span class="filter-option-title">${highlightText(folder.title, state.filterSearchQuery)}</span>
            <span class="filter-option-path">${highlightText(folderPath, state.filterSearchQuery)}</span>
          </span>
        </button>
      `
    })
    .join('')

  if (!folderItems && query) {
    return '<div class="state-panel compact">未找到相关文件夹</div>'
  }

  return folderItems
}

function renderMoveFolderList(bookmark) {
  const roots = (state.rawTreeRoot?.children || []).filter((node) => !node.url)
  const query = normalizeText(state.moveSearchQuery)
  const markup = roots
    .map((node) => renderMoveFolderNode(node, 0, query, bookmark))
    .join('')

  if (!markup.trim()) {
    return '<div class="state-panel">未找到相关文件夹</div>'
  }

  return markup
}

function renderSmartFolderList() {
  const roots = (state.rawTreeRoot?.children || []).filter((node) => !node.url)
  const query = normalizeText(state.smartFolderSearchQuery)
  const markup = roots
    .map((node) => renderSmartFolderNode(node, 0, query))
    .join('')

  if (!markup.trim()) {
    return '<div class="state-panel">未找到相关文件夹</div>'
  }

  return markup
}

function renderSmartFolderNode(node, depth, query) {
  if (node.id === ROOT_ID) {
    return ''
  }

  const folder = state.folderMap.get(node.id)
  if (!folder) {
    return ''
  }

  const childFolders = (node.children || []).filter((child) => !child.url)
  const isFilterMode = Boolean(query)
  const childMarkup = childFolders
    .map((child) => renderSmartFolderNode(child, depth + 1, query))
    .join('')
  const matchesCurrent =
    !query ||
    folder.normalizedTitle.includes(query) ||
    folder.normalizedPath.includes(query)

  if (isFilterMode && !matchesCurrent && !childMarkup) {
    return ''
  }

  const isExpanded = isFilterMode || state.moveExpandedFolders.has(node.id)
  const saving = state.smartSaving || isPopupActionPending('save-current-page', node.id)
  const folderPath = formatFolderPath(folder, state.folderMap) || folder.title || '未命名文件夹'
  const toggleLabel = getPopupFolderToggleLabel(isExpanded ? '折叠文件夹' : '展开文件夹', folderPath)

  return `
    <div class="picker-row" style="--depth:${depth}">
      <button
        class="tree-toggle ${isExpanded ? 'expanded' : ''}"
        type="button"
        ${childFolders.length ? '' : 'data-disabled="true"'}
        data-toggle-smart-folder="${escapeAttr(node.id)}"
        role="treeitem"
        aria-level="${depth + 1}"
        aria-expanded="${childFolders.length ? String(isExpanded) : 'false'}"
        aria-label="${escapeAttr(toggleLabel)}"
      ></button>
      <button
        class="picker-folder-card"
        type="button"
        role="treeitem"
        aria-level="${depth + 1}"
        aria-selected="false"
        data-smart-select-folder="${escapeAttr(node.id)}"
        ${saving ? 'disabled' : ''}
      >
        <span class="folder-kind" aria-hidden="true"></span>
        <span class="picker-folder-main">
          <span class="row-title">${highlightText(folder.title, state.smartFolderSearchQuery)}</span>
          <span class="picker-path" title="${escapeAttr(folderPath)}">${highlightText(folderPath, state.smartFolderSearchQuery)}</span>
        </span>
      </button>
    </div>
    ${isExpanded ? childMarkup : ''}
  `
}

function renderMoveFolderNode(node, depth, query, bookmark) {
  if (node.id === ROOT_ID) {
    return ''
  }

  const folder = state.folderMap.get(node.id)
  if (!folder) {
    return ''
  }

  const childFolders = (node.children || []).filter((child) => !child.url)
  const isFilterMode = Boolean(query)
  const childMarkup = childFolders
    .map((child) => renderMoveFolderNode(child, depth + 1, query, bookmark))
    .join('')

  const matchesCurrent =
    !query ||
    folder.normalizedTitle.includes(query) ||
    folder.normalizedPath.includes(query)

  if (isFilterMode && !matchesCurrent && !childMarkup) {
    return ''
  }

  const isExpanded = isFilterMode || state.moveExpandedFolders.has(node.id)
  const isCurrentFolder = bookmark.parentId === node.id
  const moving = isPopupActionPending('move', bookmark.id)
  const folderPath = formatFolderPath(folder, state.folderMap) || folder.title || '未命名文件夹'
  const toggleLabel = getPopupFolderToggleLabel(isExpanded ? '折叠文件夹' : '展开文件夹', folderPath)

  return `
    <div class="picker-row ${isCurrentFolder ? 'current' : ''}" style="--depth:${depth}">
      <button
        class="tree-toggle ${isExpanded ? 'expanded' : ''}"
        type="button"
        ${childFolders.length ? '' : 'data-disabled="true"'}
        data-toggle-move-folder="${escapeAttr(node.id)}"
        role="treeitem"
        aria-level="${depth + 1}"
        aria-expanded="${childFolders.length ? String(isExpanded) : 'false'}"
        aria-label="${escapeAttr(toggleLabel)}"
      ></button>
      <button
        class="picker-folder-card"
        type="button"
        role="treeitem"
        aria-level="${depth + 1}"
        aria-selected="${isCurrentFolder ? 'true' : 'false'}"
        data-select-folder="${escapeAttr(node.id)}"
        ${moving ? 'disabled' : ''}
      >
        <span class="folder-kind" aria-hidden="true"></span>
        <span class="picker-folder-main">
          <span class="row-title">${highlightText(folder.title, state.moveSearchQuery)}</span>
          <span class="picker-path" title="${escapeAttr(folderPath)}">${highlightText(folderPath, state.moveSearchQuery)}</span>
          ${isCurrentFolder ? '<span class="picker-badge">当前位置</span>' : ''}
        </span>
      </button>
    </div>
    ${isExpanded ? childMarkup : ''}
  `
}

function renderToasts() {
  dom.toastRoot.innerHTML = state.toasts
    .map((toast) => {
      return `
        <div class="toast ${escapeAttr(toast.type)}" data-toast-id="${escapeAttr(toast.id)}">
          <div class="toast-copy">
            <p class="toast-message">${escapeHtml(toast.message)}</p>
          </div>
          ${
            toast.action
              ? `<button class="toast-action" type="button" data-toast-action="${escapeAttr(
                  toast.action
                )}" data-toast-id="${escapeAttr(toast.id)}">${escapeHtml(toast.actionLabel || '操作')}</button>`
              : ''
          }
          <button class="toast-dismiss" type="button" data-dismiss-toast="${escapeAttr(toast.id)}">关闭</button>
        </div>
      `
    })
    .join('')
}

function handleSmartClassifierClick(event) {
  const savedSearchButton = event.target.closest('[data-saved-search-action]')
  if (savedSearchButton) {
    handleSavedSearchAction(savedSearchButton)
    return
  }

  const quickActionButton = event.target.closest('[data-current-page-action]')
  if (quickActionButton) {
    handleCurrentPageQuickAction(quickActionButton.getAttribute('data-current-page-action'))
    return
  }

  const recommendationButton = event.target.closest('[data-smart-recommendation]')
  if (recommendationButton) {
    const nextRecommendationId = recommendationButton.getAttribute('data-smart-recommendation')
    if (nextRecommendationId !== state.smartSelectedRecommendationId) {
      state.smartSaved = false
    }
    state.smartSelectedRecommendationId = nextRecommendationId
    renderSmartClassifier()
    return
  }

  const actionButton = event.target.closest('[data-smart-action]')
  if (!actionButton) {
    return
  }

  const action = actionButton.getAttribute('data-smart-action')
  if (action === 'classify') {
    classifyCurrentPage()
    return
  }

  if (action === 'grant-permission') {
    grantSmartPermissionAndClassify()
    return
  }

  if (action === 'open-ai-settings') {
    void openSettingsPage('ai-provider')
    return
  }

  if (action === 'manual-folder') {
    openSmartFolderDialog()
    return
  }

  if (action === 'reset') {
    resetSmartClassification()
    return
  }

  if (action === 'exit') {
    resetSmartClassification()
    return
  }

  if (action === 'save') {
    saveSmartRecommendation()
  }
}

function handleSavedSearchAction(button) {
  const action = button.getAttribute('data-saved-search-action')
  const searchId = button.getAttribute('data-saved-search-id')

  if (action === 'save-current') {
    void saveCurrentSearchQuery()
    return
  }

  if (action === 'apply') {
    const savedSearch = state.savedSearches
      ? getSavedSearchesForScope(state.savedSearches, 'popup').find((item) => item.id === searchId)
      : null
    if (savedSearch) {
      setSearchQuery(savedSearch.query, { immediate: true })
      showViewNotice(`已应用保存搜索：${savedSearch.name}`)
      dom.searchInput.focus()
    }
    return
  }

  if (action === 'delete') {
    void deletePopupSavedSearch(searchId)
  }
}

function handleCurrentPageQuickAction(action) {
  const bookmarkId = state.currentPageBookmarkId

  if (action === 'save') {
    openSmartFolderDialog()
    return
  }

  if (!bookmarkId) {
    showToast({ type: 'error', message: '当前页面尚未收藏。' })
    return
  }

  if (action === 'open-folder') {
    const bookmark = state.bookmarkMap.get(bookmarkId)
    if (bookmark?.parentId) {
      applyFolderFilter(bookmark.parentId)
      resetSmartClassification()
      showViewNotice('已打开当前页所在文件夹')
    }
    return
  }

  if (action === 'edit') {
    openEditDialog(bookmarkId)
    return
  }

  if (action === 'pin-newtab') {
    void pinCurrentPageToNewTab(bookmarkId)
  }
}

function handleSmartClassifierInput(event) {
  if (event.target?.id === 'smart-title-input') {
    state.smartSuggestedTitle = event.target.value
    state.smartSaved = false
  }
}

function handleContentClick(event) {
  const folderToggle = event.target.closest('[data-toggle-folder]')
  if (folderToggle) {
    const folderId = folderToggle.getAttribute('data-toggle-folder')
    toggleFolder(folderId)
    return
  }

  const menuToggle = event.target.closest('[data-open-menu]')
  if (menuToggle) {
    const bookmarkId = menuToggle.getAttribute('data-open-menu')
    if (state.activeMenuBookmarkId === bookmarkId) {
      closeActionMenu({ restoreFocus: true, focusBookmarkId: bookmarkId })
      return
    }
    openActionMenuFromToggle(bookmarkId)
    return
  }

  const actionButton = event.target.closest('[data-menu-action]')
  if (actionButton) {
    const bookmarkId = actionButton.getAttribute('data-bookmark-id')
    const action = actionButton.getAttribute('data-menu-action')

    if (action === 'edit') {
      openEditDialog(bookmarkId)
      return
    }

    if (action === 'move') {
      openMoveDialog(bookmarkId)
      return
    }

    if (action === 'copy-url') {
      void copyBookmarkUrl(bookmarkId)
      return
    }

    if (action === 'open-current-tab') {
      void openBookmarkInCurrentTab(bookmarkId)
      return
    }

    if (action === 'delete') {
      openDeleteDialog(bookmarkId)
    }

    return
  }

  const bookmarkButton = event.target.closest('[data-open-bookmark]')
  if (bookmarkButton) {
    const bookmarkId = bookmarkButton.getAttribute('data-open-bookmark')
    void openBookmark(bookmarkId)
    return
  }

  const emptyAction = event.target.closest('[data-empty-action]')
  if (emptyAction) {
    handleEmptySearchAction(emptyAction.getAttribute('data-empty-action'))
  }
}

function handlePopupBreadcrumbClick(event) {
  const breadcrumbButton = event.target.closest('[data-folder-breadcrumb-id]')
  if (!breadcrumbButton) {
    return
  }

  applyFolderFilter(breadcrumbButton.getAttribute('data-folder-breadcrumb-id'))
}

function handleEmptySearchAction(action) {
  if (action === 'clear-query') {
    setSearchQuery('', { immediate: true })
    showViewNotice('已清空搜索')
    dom.searchInput.focus()
    return
  }

  if (action === 'clear-filter') {
    clearFolderFilter()
    return
  }

  if (action === 'show-all') {
    state.selectedFolderFilterId = null
    setSearchQuery('', { immediate: true })
    showViewNotice('已显示全部书签')
    dom.searchInput.focus()
    return
  }

  if (action === 'toggle-natural') {
    void toggleNaturalLanguageSearch()
    return
  }

  if (action === 'open-ai-settings') {
    void openSettingsPage('ai-provider')
    return
  }

  if (action === 'dismiss-natural-setup') {
    state.naturalSearchSetupRequired = false
    render()
    dom.searchInput.focus()
  }
}

function handleContentPointerOver(event) {
  const resultCard = event.target.closest('[data-result-index]')
  if (!resultCard || !state.debouncedQuery) {
    return
  }

  const nextIndex = Number(resultCard.getAttribute('data-result-index'))
  if (!Number.isNaN(nextIndex)) {
    setActiveResultIndex(nextIndex)
  }
}

function handleFilterListClick(event) {
  const filterButton = event.target.closest('[data-select-filter-folder]')
  if (!filterButton) {
    return
  }

  const folderId = filterButton.getAttribute('data-select-filter-folder')
  state.filterFolderActiveId = String(folderId || '')
  applyFolderFilter(folderId === 'all' ? null : folderId)
}

function handleFilterSearchKeydown(event) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
    return
  }

  if (!getFilterFolderOptionButtons().length) {
    return
  }

  event.preventDefault()
  focusFilterFolderOption(event.key === 'ArrowDown' ? 'first' : 'last')
}

function handleFilterListKeydown(event) {
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
    dom.filterSearchInput.focus()
    return
  }

  if (event.key === 'Home') {
    focusFilterFolderOption('first')
  } else if (event.key === 'End') {
    focusFilterFolderOption('last')
  } else {
    focusFilterFolderOption(event.key === 'ArrowDown' ? 1 : -1)
  }
}

function handleFilterListFocus(event) {
  const target = event.target
  if (!(target instanceof HTMLElement) || !target.dataset.selectFilterFolder) {
    return
  }

  state.filterFolderActiveId = target.dataset.selectFilterFolder
  syncFilterFolderTabStops(state.filterFolderActiveId)
}

function getFilterFolderOptionButtons() {
  return [...dom.filterFolderList.querySelectorAll<HTMLButtonElement>('[data-select-filter-folder]')]
}

function resolveFilterFolderActiveId(folders) {
  if (!folders.length) {
    state.filterFolderActiveId = ''
    return ''
  }

  const selectedId = state.selectedFolderFilterId || ''
  const activeId = folders.some((folder) => folder.id === state.filterFolderActiveId)
    ? state.filterFolderActiveId
    : folders.some((folder) => folder.id === selectedId)
      ? selectedId
      : folders[0]?.id || ''
  state.filterFolderActiveId = activeId
  return activeId
}

function syncFilterFolderTabStops(activeId) {
  for (const button of getFilterFolderOptionButtons()) {
    button.tabIndex = button.dataset.selectFilterFolder === activeId ? 0 : -1
  }
}

function focusFilterFolderOptionById(folderId) {
  let targetButton = null
  for (const button of getFilterFolderOptionButtons()) {
    const isTarget = button.dataset.selectFilterFolder === folderId
    button.tabIndex = isTarget ? 0 : -1
    if (isTarget) {
      targetButton = button
    }
  }

  if (!targetButton) {
    return false
  }

  state.filterFolderActiveId = folderId
  targetButton.focus()
  return true
}

function focusFilterFolderOption(direction) {
  const buttons = getFilterFolderOptionButtons()
  if (!buttons.length) {
    return
  }

  const currentIndex = buttons.findIndex((button) => button === document.activeElement)
  let nextIndex = state.filterFolderActiveId
    ? buttons.findIndex((button) => button.dataset.selectFilterFolder === state.filterFolderActiveId)
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
  const folderId = String(button?.dataset.selectFilterFolder || '')
  if (folderId) {
    focusFilterFolderOptionById(folderId)
  }
}

function handleMoveListClick(event) {
  const toggle = event.target.closest('[data-toggle-move-folder]')
  if (toggle && !state.moveSearchQuery.trim()) {
    const folderId = toggle.getAttribute('data-toggle-move-folder')
    if (!toggle.hasAttribute('data-disabled')) {
      toggleMoveFolder(folderId)
    }
    return
  }

  const folderButton = event.target.closest('[data-select-folder]')
  if (folderButton) {
    const folderId = folderButton.getAttribute('data-select-folder')
    void moveBookmarkToFolder(folderId)
  }
}

function handleSmartFolderListClick(event) {
  const toggle = event.target.closest('[data-toggle-smart-folder]')
  if (toggle && !state.smartFolderSearchQuery.trim()) {
    const folderId = toggle.getAttribute('data-toggle-smart-folder')
    if (!toggle.hasAttribute('data-disabled')) {
      toggleMoveFolder(folderId)
      renderSmartFolderModal()
    }
    return
  }

  const folderButton = event.target.closest('[data-smart-select-folder]')
  if (folderButton) {
    const folderId = folderButton.getAttribute('data-smart-select-folder')
    void saveCurrentPageToFolder(folderId)
  }
}

function openActionMenuFromToggle(bookmarkId, { focusLast = false } = {}) {
  if (!bookmarkId) {
    return
  }

  state.activeMenuBookmarkId = bookmarkId
  renderMainContent()
  window.requestAnimationFrame(() => {
    focusActionMenuItem(focusLast ? getActionMenuItems().length - 1 : 0)
  })
}

function closeActionMenu({ restoreFocus = false, focusBookmarkId = state.activeMenuBookmarkId } = {}) {
  const menu = document.querySelector('.action-menu')
  const hadMenu = Boolean(state.activeMenuBookmarkId)
  const returnBookmarkId = focusBookmarkId
  state.activeMenuBookmarkId = null
  const focusMenuToggle = () => {
    if (restoreFocus) {
      getMenuToggleForBookmark(returnBookmarkId)?.focus()
    }
  }

  if (menu instanceof HTMLElement && !menu.classList.contains('is-closing')) {
    void closeWithExitMotion(menu, 'is-closing', () => {
      renderMainContent()
      focusMenuToggle()
    }, 180)
    return
  }

  if (hadMenu) {
    renderMainContent()
    focusMenuToggle()
  }
}

function handleDocumentPointerDown(event) {
  if (!state.activeMenuBookmarkId) {
    return
  }

  if (!event.target.closest('.menu-anchor')) {
    closeActionMenu()
  }
}

function handleDocumentKeydown(event) {
  if (event.isComposing) {
    return
  }

  if (event.key === 'Tab' && handleModalFocusTrap(event)) {
    return
  }

  if (event.key === 'Escape') {
    if (handleEscapeAction()) {
      event.preventDefault()
    }
    return
  }

  if (hasOpenModal()) {
    return
  }

  if (handleSearchFocusShortcut(event)) {
    return
  }

  if (handleActionMenuToggleKeydown(event)) {
    return
  }

  if (handleActionMenuKeydown(event)) {
    return
  }

  if (!state.debouncedQuery || !state.searchResults.length) {
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    setActiveResultIndex(state.activeResultIndex + 1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    setActiveResultIndex(state.activeResultIndex - 1)
    return
  }

  if (event.key === 'Enter') {
    const activeResult = state.searchResults[state.activeResultIndex]
    if (activeResult) {
      event.preventDefault()
      openBookmark(activeResult.id)
    }
  }
}

function handleEscapeAction() {
  if (hasOpenModal()) {
    closeDialogs()
    return true
  }

  if (state.activeMenuBookmarkId) {
    closeActionMenu({ restoreFocus: true })
    return true
  }

  if (['loading', 'results', 'error'].includes(state.smartStatus)) {
    resetSmartClassification()
    return true
  }

  if (state.searchQuery) {
    setSearchQuery('', { immediate: true })
    showViewNotice('已清空搜索')
    return true
  }

  return false
}

function handleSearchFocusShortcut(event) {
  const key = String(event.key || '')
  const isCommandSearch = (event.ctrlKey || event.metaKey) && key.toLowerCase() === 'k'
  const isSlashSearch = key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey

  if ((!isCommandSearch && !isSlashSearch) || isEditableTarget(event.target)) {
    return false
  }

  if (document.body.classList.contains('smart-active')) {
    return false
  }

  event.preventDefault()
  state.activeMenuBookmarkId = null
  renderMainContent()
  dom.searchInput.focus()
  dom.searchInput.select()
  showViewNotice(state.searchQuery ? '已聚焦搜索框，可继续编辑查询' : '已聚焦搜索框，可直接输入')
  return true
}

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

function handleActionMenuKeydown(event) {
  if (!state.activeMenuBookmarkId) {
    return false
  }

  const items = getActionMenuItems()
  if (!items.length) {
    return false
  }

  const currentIndex = items.findIndex((item) => item === document.activeElement)
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
    event.preventDefault()
    focusActionMenuItem(currentIndex + 1)
    return true
  }

  if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
    event.preventDefault()
    focusActionMenuItem(currentIndex <= 0 ? items.length - 1 : currentIndex - 1)
    return true
  }

  if (event.key === 'Home') {
    event.preventDefault()
    focusActionMenuItem(0)
    return true
  }

  if (event.key === 'End') {
    event.preventDefault()
    focusActionMenuItem(items.length - 1)
    return true
  }

  return false
}

function handleActionMenuToggleKeydown(event) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
    return false
  }

  const toggle = event.target instanceof Element
    ? event.target.closest('[data-open-menu]')
    : null
  if (!toggle) {
    return false
  }

  const bookmarkId = toggle.getAttribute('data-open-menu')
  if (!bookmarkId) {
    return false
  }

  event.preventDefault()
  openActionMenuFromToggle(bookmarkId, { focusLast: event.key === 'ArrowUp' })
  return true
}

function focusActionMenuItem(index) {
  const items = getActionMenuItems()
  if (!items.length) {
    return
  }

  const nextIndex = ((index % items.length) + items.length) % items.length
  items[nextIndex].focus()
}

function getActionMenuItems() {
  return [...document.querySelectorAll<HTMLButtonElement>('.action-menu [data-menu-action]')]
}

function handleModalFocusTrap(event) {
  const modal = getOpenModalElement()
  if (!modal) {
    return false
  }

  const focusableElements = getFocusableElements(modal)
  const firstElement = focusableElements[0] || modal
  const lastElement = focusableElements[focusableElements.length - 1] || modal
  const activeElement = document.activeElement

  if (!modal.contains(activeElement)) {
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

function getOpenModalElement() {
  const modal = [
    dom.filterModal,
    dom.moveModal,
    dom.smartFolderModal,
    dom.editModal,
    dom.deleteModal
  ].find((element) => element instanceof HTMLElement && !element.classList.contains('hidden'))

  return modal instanceof HTMLElement ? modal : null
}

function getFocusableElements(container) {
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter((element) => {
    if (!(element instanceof HTMLElement)) {
      return false
    }

    return !element.hasAttribute('disabled') &&
      !element.getAttribute('aria-hidden') &&
      element.getClientRects().length > 0
  })
}

function handleEditInputKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault()
    void saveEditedBookmark()
  }
}

function handleToastClick(event) {
  const dismissButton = event.target.closest('[data-dismiss-toast]')
  if (dismissButton) {
    dismissToast(dismissButton.getAttribute('data-dismiss-toast'))
    return
  }

  const actionButton = event.target.closest('[data-toast-action]')
  if (!actionButton) {
    return
  }

  const toastId = actionButton.getAttribute('data-toast-id')
  const action = actionButton.getAttribute('data-toast-action')

  dismissToast(toastId)

  if (action === 'undo-delete') {
    undoDelete()
    return
  }

  if (action === 'open-bookmark-history') {
    void openBookmarkHistoryPage()
  }
}

function toggleFolder(folderId) {
  if (!folderId) {
    return
  }

  const wasExpanded = state.expandedFolders.has(folderId)
  if (wasExpanded) {
    state.expandedFolders.delete(folderId)
  } else {
    state.expandedFolders.add(folderId)
  }

  renderMainContent()
  showViewNotice(`${wasExpanded ? '已折叠' : '已展开'}：${getFolderNoticeLabel(folderId)}`)
}

function getFolderNoticeLabel(folderId) {
  const folder = state.folderMap.get(folderId)
  return folder?.path || folder?.title || '文件夹'
}

function toggleMoveFolder(folderId) {
  if (!folderId) {
    return
  }

  if (state.moveExpandedFolders.has(folderId)) {
    state.moveExpandedFolders.delete(folderId)
  } else {
    state.moveExpandedFolders.add(folderId)
  }

  renderMoveModal()
}

function openFilterDialog() {
  if (hasBlockingPopupActionPending()) {
    return
  }
  if (shouldBlockDirtyEditClose()) {
    return
  }

  rememberDialogReturnFocus()
  state.activeMenuBookmarkId = null
  state.moveTargetBookmarkId = null
  state.editTargetBookmarkId = null
  state.confirmDeleteBookmarkId = null
  state.isFilterPickerOpen = true
  state.filterSearchQuery = ''
  render()

  window.requestAnimationFrame(() => {
    dom.filterSearchInput.focus()
  })
}

function openMoveDialog(bookmarkId) {
  if (hasBlockingPopupActionPending()) {
    return
  }
  if (shouldBlockDirtyEditClose()) {
    return
  }

  rememberDialogReturnFocus(getMenuToggleForBookmark(bookmarkId))
  state.activeMenuBookmarkId = null
  state.isFilterPickerOpen = false
  state.confirmDeleteBookmarkId = null
  state.editTargetBookmarkId = null
  state.moveTargetBookmarkId = bookmarkId
  state.moveSearchQuery = ''
  render()

  window.requestAnimationFrame(() => {
    dom.moveSearchInput.focus()
  })
}

function openEditDialog(bookmarkId) {
  if (hasBlockingPopupActionPending()) {
    return
  }
  if (shouldBlockDirtyEditClose()) {
    return
  }

  const bookmark = state.bookmarkMap.get(String(bookmarkId || ''))
  if (!bookmark) {
    return
  }

  rememberDialogReturnFocus(getMenuToggleForBookmark(bookmarkId))
  state.activeMenuBookmarkId = null
  state.isFilterPickerOpen = false
  state.moveTargetBookmarkId = null
  state.confirmDeleteBookmarkId = null
  state.editTargetBookmarkId = bookmarkId
  resetEditDraft(bookmark)
  render()

  window.requestAnimationFrame(() => {
    dom.editTitleInput.focus()
    dom.editTitleInput.select()
  })
}

function openDeleteDialog(bookmarkId) {
  if (hasBlockingPopupActionPending()) {
    return
  }
  if (shouldBlockDirtyEditClose()) {
    return
  }

  rememberDialogReturnFocus(getMenuToggleForBookmark(bookmarkId))
  state.activeMenuBookmarkId = null
  state.isFilterPickerOpen = false
  state.moveTargetBookmarkId = null
  state.editTargetBookmarkId = null
  state.confirmDeleteBookmarkId = bookmarkId
  render()

  window.requestAnimationFrame(() => {
    dom.cancelDelete.focus()
  })
}

function closeDialogs(options: { force?: boolean } | Event = {}) {
  const force = (options as { force?: boolean })?.force === true
  if (!force && (state.editSaving || hasBlockingPopupActionPending())) {
    return
  }

  if (!force && shouldBlockDirtyEditClose()) {
    return
  }

  state.isFilterPickerOpen = false
  state.filterSearchQuery = ''
  state.moveTargetBookmarkId = null
  state.moveSearchQuery = ''
  state.smartFolderPickerOpen = false
  state.smartFolderSearchQuery = ''
  state.editTargetBookmarkId = null
  state.confirmDeleteBookmarkId = null
  clearEditDraft()
  render()
  if (document.body.classList.contains('smart-active')) {
    return
  }
  restoreDialogReturnFocus()
}

function applyFolderFilter(folderId) {
  const selectedFolder = folderId ? state.folderMap.get(folderId) : null
  state.selectedFolderFilterId = folderId
  state.isFilterPickerOpen = false
  state.filterSearchQuery = ''
  state.activeMenuBookmarkId = null
  runSearch()
  render()
  showViewNotice(selectedFolder ? `已筛选：${selectedFolder.path || selectedFolder.title}` : '已显示全部文件夹')
  dom.searchInput.focus()
}

function clearFolderFilter() {
  if (!state.selectedFolderFilterId) {
    return
  }

  applyFolderFilter(null)
}

function applyInboxFolderFilter() {
  const inboxFolder = [...state.folderMap.values()].find((folder) => {
    return normalizeText(folder.title || '') === normalizeText(DEFAULT_INBOX_FOLDER_TITLE) ||
      normalizeText(folder.path || '').endsWith(normalizeText(DEFAULT_INBOX_FOLDER_TITLE))
  })

  if (!inboxFolder) {
    showToast({ type: 'info', message: 'Inbox / 待整理 尚未创建，使用快捷键收藏后会自动生成。' })
    return
  }

  applyFolderFilter(inboxFolder.id)
}

function openSmartFolderDialog() {
  if (hasBlockingPopupActionPending()) {
    return
  }
  if (shouldBlockDirtyEditClose()) {
    return
  }

  if (!isSmartClassifiableUrl(state.currentTab?.url)) {
    showToast({ type: 'error', message: '当前页面无法保存为普通网页书签。' })
    return
  }

  rememberDialogReturnFocus()
  state.isFilterPickerOpen = false
  state.moveTargetBookmarkId = null
  state.editTargetBookmarkId = null
  state.confirmDeleteBookmarkId = null
  state.smartFolderPickerOpen = true
  state.smartFolderSearchQuery = ''
  render()

  window.requestAnimationFrame(() => {
    dom.smartFolderSearchInput.focus()
  })
}

function rememberDialogReturnFocus(preferredElement = null) {
  const activeElement = document.activeElement
  popupDialogReturnFocusElement = preferredElement instanceof HTMLElement
    ? preferredElement
    : activeElement instanceof HTMLElement
      ? activeElement
      : null
}

function restoreDialogReturnFocus() {
  const returnElement = popupDialogReturnFocusElement
  popupDialogReturnFocusElement = null

  if (returnElement?.isConnected && !returnElement.hasAttribute('disabled')) {
    returnElement.focus()
    return
  }

  dom.searchInput.focus()
}

function getMenuToggleForBookmark(bookmarkId) {
  if (!bookmarkId) {
    return null
  }

  return document.querySelector<HTMLElement>(`[data-open-menu="${CSS.escape(String(bookmarkId))}"]`)
}

function resetSmartClassification() {
  state.smartRunId += 1
  state.smartStatus = 'idle'
  state.smartError = ''
  state.smartStep = 0
  state.smartProgressPercent = 0
  state.smartSuggestedTitle = ''
  state.smartSummary = ''
  state.smartContentType = ''
  state.smartTopics = []
  state.smartTags = []
  state.smartAliases = []
  state.smartConfidence = 0
  state.smartModel = ''
  state.smartExtraction = { status: '', source: '', warnings: [] }
  state.smartRecommendations = []
  state.smartSelectedRecommendationId = ''
  state.smartSaving = false
  state.smartSaved = false
  state.smartPermissionRequest = null
  renderSmartClassifier()
}

async function classifyCurrentPage({ requestMissingPermissions = false } = {}) {
  if (state.smartStatus === 'loading' || state.smartSaving) {
    return
  }

  const currentUrl = String(state.currentTab?.url || '').trim()
  if (!isSmartClassifiableUrl(currentUrl)) {
    showToast({ type: 'error', message: '当前页面无法进行智能分类。' })
    return
  }

  const runId = state.smartRunId + 1
  state.smartRunId = runId
  state.smartStatus = 'loading'
  state.smartError = ''
  state.smartStep = 1
  state.smartProgressPercent = 0
  state.smartRecommendations = []
  state.smartSelectedRecommendationId = ''
  state.smartSaved = false
  state.smartSuggestedTitle = getCurrentPageTitle()
  state.smartContentType = ''
  state.smartTopics = []
  state.smartTags = []
  state.smartAliases = []
  state.smartConfidence = 0
  state.smartModel = ''
  state.smartExtraction = { status: '', source: '', warnings: [] }
  state.smartPermissionRequest = null
  renderSmartClassifier()

  try {
    const settings = await loadAiProviderSettings()
    if (state.smartRunId !== runId) return
    validateSmartAiSettings(settings)
    await ensureSmartClassifyPermissions(settings, {
      interactive: requestMissingPermissions
    })
    if (state.smartRunId !== runId) return

    const pageContext = await buildCurrentPageContext(currentUrl, settings)
    if (state.smartRunId !== runId) return

    state.smartStep = 2
    renderSmartClassifier()
    const aiResult = await requestSmartClassification({
      settings,
      pageContext,
      currentUrl
    })
    if (state.smartRunId !== runId) return

    state.smartStep = 3
    renderSmartClassifier()
    await waitForSmartLoadingPaint()
    if (state.smartRunId !== runId) return

    const recommendations = buildSmartRecommendations(aiResult)
    state.smartSuggestedTitle = cleanSmartTitle(aiResult.title || getCurrentPageTitle())
    state.smartSummary = cleanSmartText(aiResult.summary, 360)
    state.smartContentType = cleanSmartText(aiResult.contentType, 80)
    state.smartTopics = normalizeSmartTextList(aiResult.topics, 8, 40)
    state.smartTags = normalizeBookmarkTags(aiResult.tags)
    state.smartAliases = normalizeSmartTextList(aiResult.aliases, 20, 40)
    state.smartConfidence = normalizeSmartConfidence(aiResult.confidence)
    state.smartModel = settings.model
    state.smartExtraction = buildSmartExtractionSnapshot(pageContext)
    state.smartRecommendations = recommendations
    state.smartSelectedRecommendationId = recommendations[0]?.id || ''
    state.smartStatus = 'results'
    renderSmartClassifier()
  } catch (error) {
    if (state.smartRunId !== runId) return
    if (isSmartPermissionRequiredError(error)) {
      state.smartStatus = 'permission'
      state.smartPermissionRequest = error.smartPermissionRequest
      state.smartError = error.message
      renderSmartClassifier()
      return
    }
    state.smartStatus = 'error'
    state.smartError = normalizeSmartError(error)
    renderSmartClassifier()
  }
}

async function grantSmartPermissionAndClassify() {
  if (state.smartStatus === 'loading' || state.smartSaving) {
    return
  }

  const origins = Array.isArray(state.smartPermissionRequest?.origins)
    ? [...new Set(state.smartPermissionRequest.origins)].filter(Boolean)
    : []

  if (!origins.length) {
    await classifyCurrentPage({ requestMissingPermissions: true })
    return
  }

  try {
    const granted = await requestPermissions({ origins })
    if (!granted) {
      throw createSmartPermissionRequiredError(origins, '未完成 AI 渠道授权，暂时无法智能分类。')
    }
    await classifyCurrentPage()
  } catch (error) {
    if (isSmartPermissionRequiredError(error)) {
      state.smartStatus = 'permission'
      state.smartPermissionRequest = error.smartPermissionRequest
      state.smartError = error.message
    } else {
      state.smartStatus = 'permission'
      state.smartPermissionRequest = { origins }
      state.smartError = normalizeSmartError(error)
    }
    renderSmartClassifier()
  }
}

async function saveSmartRecommendation() {
  const recommendation = state.smartRecommendations.find((item) => item.id === state.smartSelectedRecommendationId)
  if (!recommendation || state.smartSaving || state.smartSaved) {
    return
  }

  await saveCurrentPageToSmartRecommendation(recommendation)
}

async function saveCurrentPageToSmartRecommendation(recommendation) {
  if (recommendation.kind === 'new') {
    await saveCurrentPageViaWorker({
      folderPath: recommendation.path
    }, { closeModal: false })
    return
  }

  await saveCurrentPageToFolder(recommendation.folderId, { closeModal: false })
}

async function saveCurrentPageToFolder(folderId, { closeModal = true } = {}) {
  await saveCurrentPageViaWorker({ parentId: folderId }, { closeModal })
}

async function saveCurrentPageViaWorker({ parentId = '', folderPath = '' } = {}, { closeModal = true } = {}) {
  const actionTargetId = parentId || folderPath || 'current-page'
  if (state.smartSaving || isPopupActionPending('save-current-page', actionTargetId)) {
    return
  }

  let savedWithoutRefresh = false
  try {
    setPopupActionPending('save-current-page', actionTargetId, true)
    state.smartSaving = true
    state.smartSaved = false
    renderSmartSaveSurfaces()

    const currentUrl = String(state.currentTab?.url || '').trim()
    if (!isSmartClassifiableUrl(currentUrl)) {
      throw new Error('当前页面不是可保存的普通网页。')
    }

    if (!parentId && !folderPath) {
      throw new Error('未找到可保存的目标文件夹。')
    }

    const nextTitle = cleanSmartTitle(state.smartSuggestedTitle || getCurrentPageTitle())
    const existingBookmark = state.currentPageBookmarkId
      ? state.bookmarkMap.get(state.currentPageBookmarkId)
      : null

    const savedBookmark = await requestBookmarkSave({
      parentId,
      folderPath,
      bookmarkId: existingBookmark?.id || state.currentPageBookmarkId || '',
      title: nextTitle,
      url: currentUrl,
      analysis: {
        summary: state.smartSummary,
        contentType: state.smartContentType,
        topics: state.smartTopics,
        tags: state.smartTags,
        aliases: state.smartAliases,
        confidence: state.smartConfidence,
        model: state.smartModel,
        extraction: state.smartExtraction
      }
    })

    state.currentPageBookmarkId = savedBookmark.bookmarkId || state.currentPageBookmarkId
    await finishSmartSave({
      message: getSmartSaveSuccessMessage(savedBookmark, { parentId, folderPath }),
      closeModal
    })
    savedWithoutRefresh = true
  } catch (error) {
    state.smartSaving = false
    state.smartSaved = false
    showToast({
      type: 'error',
      message: error instanceof Error ? `保存失败：${error.message}` : '保存失败，请稍后重试。'
    })
  } finally {
    setPopupActionPending('save-current-page', actionTargetId, false)
    state.smartSaving = false
    if (!savedWithoutRefresh) {
      renderSmartSaveSurfaces()
    }
  }
}

function renderSmartSaveSurfaces() {
  renderSmartClassifier()
  renderSmartFolderModal()
}

async function pinCurrentPageToNewTab(bookmarkId) {
  const bookmark = state.bookmarkMap.get(String(bookmarkId || ''))
  if (!bookmark?.url || isPopupActionPending('pin-newtab', bookmark.id)) {
    return
  }

  try {
    setPopupActionPending('pin-newtab', bookmark.id, true)
    renderSmartClassifier()

    const stored = await getLocalStorage([STORAGE_KEYS.newTabWorkspaceSettings])
    const currentSettings = normalizeNewTabWorkspaceSettings(
      stored[STORAGE_KEYS.newTabWorkspaceSettings] || POPUP_DEFAULT_WORKSPACE_STORAGE,
      { validBookmarkIds: state.bookmarkMap.keys() }
    )
    const workspace = getActiveNewTabWorkspace(currentSettings)
    const nextSettings = toggleNewTabWorkspacePin(
      currentSettings,
      workspace.id,
      bookmark.id,
      { validBookmarkIds: state.bookmarkMap.keys() }
    )

    await setLocalStorage({ [STORAGE_KEYS.newTabWorkspaceSettings]: nextSettings })
    const pinned = nextSettings.workspaces
      .find((item) => item.id === workspace.id)
      ?.pinnedIds.includes(bookmark.id)
    showToast({
      type: 'success',
      message: pinned
        ? `已固定到 ${workspace.name} newtab。`
        : `已从 ${workspace.name} newtab 取消固定。`
    })
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? `固定失败：${error.message}` : '固定到 newtab 失败，请稍后重试。'
    })
  } finally {
    setPopupActionPending('pin-newtab', bookmark.id, false)
    renderSmartClassifier()
  }
}

async function finishSmartSave({ message, closeModal = true }) {
  state.smartRunId += 1
  state.smartSaving = false
  state.smartSaved = true
  state.smartStatus = 'idle'
  state.smartError = ''
  state.smartStep = 0
  state.smartProgressPercent = 0
  state.smartSuggestedTitle = ''
  state.smartSummary = ''
  state.smartContentType = ''
  state.smartTopics = []
  state.smartTags = []
  state.smartAliases = []
  state.smartConfidence = 0
  state.smartModel = ''
  state.smartExtraction = { status: '', source: '', warnings: [] }
  state.smartRecommendations = []
  state.smartSelectedRecommendationId = ''
  state.smartPermissionRequest = null
  state.activeMenuBookmarkId = null

  if (closeModal || state.smartFolderPickerOpen) {
    state.smartFolderPickerOpen = false
    state.smartFolderSearchQuery = ''
  }

  renderSmartSaveSurfaces()
  showToast({ type: 'success', message })
  showViewNotice('已保存，正在刷新书签列表')
  await refreshData({ preserveSearch: true })
  showViewNotice('已保存，书签列表已更新')
  window.requestAnimationFrame(() => {
    if (!hasOpenModal()) {
      dom.searchInput.focus()
    }
  })
}

function getSmartSaveSuccessMessage(savedBookmark, { parentId = '', folderPath = '' } = {}) {
  const folderLabel = cleanSmartText(
    folderPath ||
      state.folderMap.get(savedBookmark?.parentId || parentId)?.path ||
      state.folderMap.get(parentId)?.path ||
      '',
    48
  )
  return folderLabel ? `已保存到 ${folderLabel}` : '保存成功'
}

async function moveBookmarkToFolder(folderId) {
  const bookmark = state.moveTargetBookmarkId
    ? state.bookmarkMap.get(state.moveTargetBookmarkId)
    : null

  if (!bookmark || !folderId || isPopupActionPending('move', bookmark?.id || '')) {
    return
  }

  if (bookmark.parentId === folderId) {
    showToast({
      type: 'success',
      message: '书签已在当前文件夹中'
    })
    showViewNotice('书签已在当前文件夹中')
    return
  }

  const movedTitle = bookmark.title
  setPopupActionPending('move', bookmark.id, true)
  renderMoveModal()
  try {
    await moveBookmark(bookmark.id, folderId)
    showToast({
      type: 'success',
      message: '移动成功'
    })
    closeDialogs({ force: true })
    await refreshData({ preserveSearch: true })
    showViewNotice(`已移动：${movedTitle}`)
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? `移动失败：${error.message}` : '移动失败，请稍后重试。'
    })
  } finally {
    setPopupActionPending('move', bookmark.id, false)
    renderMoveModal()
  }
}

async function saveEditedBookmark() {
  const bookmark = state.editTargetBookmarkId
    ? state.bookmarkMap.get(state.editTargetBookmarkId)
    : null

  if (!bookmark || state.editSaving || isPopupActionPending('edit', bookmark?.id || '')) {
    return
  }

  const nextTitle = String(state.editDraftTitle || dom.editTitleInput.value).trim() || '未命名书签'
  const nextUrl = String(state.editDraftUrl || dom.editUrlInput.value).trim()

  state.editDraftDirty = isCurrentEditDraftDirty()
  if (!state.editDraftDirty) {
    renderEditDraftControls()
    return
  }

  if (!nextUrl) {
    showToast({
      type: 'error',
      message: '网址不能为空'
    })
    dom.editUrlInput.focus()
    return
  }

  try {
    new URL(nextUrl)
  } catch (error) {
    showToast({
      type: 'error',
      message: '请输入有效的网址'
    })
    dom.editUrlInput.focus()
    return
  }

  state.editSaving = true
  setPopupActionPending('edit', bookmark.id, true)
  renderEditDraftControls()

  try {
    await updateBookmark(bookmark.id, {
      title: nextTitle,
      url: nextUrl
    })
    showToast({
      type: 'success',
      message: '保存成功'
    })
    state.editSaving = false
    setPopupActionPending('edit', bookmark.id, false)
    closeDialogs({ force: true })
    await refreshData({ preserveSearch: true })
    showViewNotice(`已更新：${nextTitle}`)
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? `保存失败：${error.message}` : '保存失败，请稍后重试。'
    })
  } finally {
    state.editSaving = false
    setPopupActionPending('edit', bookmark.id, false)
    renderEditDraftControls()
  }
}

async function confirmDeleteBookmark() {
  const bookmark = state.confirmDeleteBookmarkId
    ? state.bookmarkMap.get(state.confirmDeleteBookmarkId)
    : null

  if (!bookmark || isPopupActionPending('delete', bookmark?.id || '')) {
    return
  }

  setPopupActionPending('delete', bookmark.id, true)
  renderDeleteModal()

  try {
    const recycleBin = await loadRecycleBinModule()
    state.lastDeletedBookmark = {
      title: bookmark.title,
      url: bookmark.url,
      parentId: bookmark.parentId,
      index: bookmark.index,
      recycleId: `recycle-${bookmark.id}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    }

    await recycleBin.deleteBookmarkToRecycle(bookmark.id, {
      recycleId: state.lastDeletedBookmark.recycleId,
      bookmarkId: String(bookmark.id),
      title: bookmark.title,
      url: bookmark.url,
      parentId: String(bookmark.parentId || ''),
      index: Number.isFinite(Number(bookmark.index)) ? Number(bookmark.index) : 0,
      path: bookmark.path || '',
      source: '弹窗删除',
      deletedAt: Date.now()
    })

    showToast({
      type: 'success',
      message: '删除成功',
      action: 'undo-delete',
      actionLabel: '撤销'
    })

    closeDialogs({ force: true })
    await refreshData({ preserveSearch: true })
    showViewNotice(`已删除：${bookmark.title}`)
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? `删除失败：${error.message}` : '删除失败，请稍后重试。'
    })
  } finally {
    setPopupActionPending('delete', bookmark.id, false)
    renderDeleteModal()
  }
}

async function undoDelete() {
  if (!state.lastDeletedBookmark) {
    return
  }

  const payload = state.lastDeletedBookmark
  const actionTargetId = payload.recycleId || payload.url || payload.title
  if (isPopupActionPending('undo-delete', actionTargetId)) {
    return
  }

  setPopupActionPending('undo-delete', actionTargetId, true)
  state.lastDeletedBookmark = null

  try {
    const parentId = await getRestorableParentId(payload.parentId)
    await createBookmark({
      ...payload,
      parentId
    })
    if (payload.recycleId) {
      const recycleBin = await loadRecycleBinModule()
      await recycleBin.removeRecycleEntry(payload.recycleId)
    }
    showToast({
      type: 'success',
      message: '已撤销删除'
    })
    await refreshData({ preserveSearch: true })
    showViewNotice(`已恢复：${payload.title}`)
  } catch (error) {
    state.lastDeletedBookmark = payload
    showToast({
      type: 'error',
      message: error instanceof Error ? `撤销失败：${error.message}` : '撤销失败，请稍后重试。'
    })
  } finally {
    setPopupActionPending('undo-delete', actionTargetId, false)
  }
}

async function getRestorableParentId(parentId) {
  const requestedParentId = String(parentId || '').trim()
  if (!requestedParentId) {
    return BOOKMARKS_BAR_ID
  }

  try {
    const tree = await getBookmarkTree()
    const rootNode = Array.isArray(tree) ? tree[0] : tree
    const target = findNodeById(rootNode, requestedParentId)
    return target && !target.url ? requestedParentId : BOOKMARKS_BAR_ID
  } catch {
    return BOOKMARKS_BAR_ID
  }
}

async function openBookmark(bookmarkId) {
  const bookmark = state.bookmarkMap.get(bookmarkId)

  if (!bookmark?.url || hasBlockingPopupActionPending()) {
    return
  }

  try {
    await createTab({ url: bookmark.url })
    window.close()
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? `打开失败：${error.message}` : '打开失败，请稍后重试。'
    })
  }
}

async function openBookmarkInCurrentTab(bookmarkId) {
  const bookmark = state.bookmarkMap.get(bookmarkId)
  if (!bookmark?.url || hasBlockingPopupActionPending() || isPopupActionPending('open-current-tab', bookmarkId)) {
    return
  }

  setPopupActionPending('open-current-tab', bookmarkId, true)
  try {
    await updateCurrentTabUrl(bookmark.url)
    window.close()
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? `打开失败：${error.message}` : '打开失败，请稍后重试。'
    })
  } finally {
    setPopupActionPending('open-current-tab', bookmarkId, false)
  }
}

function updateCurrentTabUrl(url) {
  return new Promise((resolve, reject) => {
    const tabId = Number(state.currentTab?.id)
    const updateProperties = { url }
    const callback = (tab) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(tab)
    }

    if (Number.isFinite(tabId)) {
      chrome.tabs.update(tabId, updateProperties, callback)
      return
    }

    chrome.tabs.update(updateProperties, callback)
  })
}

async function copyBookmarkUrl(bookmarkId) {
  const bookmark = state.bookmarkMap.get(bookmarkId)
  if (isPopupActionPending('copy-url', bookmarkId)) {
    return
  }

  if (!bookmark?.url) {
    showToast({
      type: 'error',
      message: '复制失败：书签链接不存在。'
    })
    return
  }

  setPopupActionPending('copy-url', bookmarkId, true)
  try {
    await writeClipboardText(bookmark.url)
    closeActionMenu()
    showToast({
      type: 'success',
      message: '链接已复制'
    })
    showViewNotice(`已复制链接：${bookmark.title}`)
  } catch (error) {
    closeActionMenu()
    showToast({
      type: 'error',
      message: error instanceof Error ? `复制失败：${error.message}` : '复制失败，请手动复制链接。'
    })
  } finally {
    setPopupActionPending('copy-url', bookmarkId, false)
  }
}

function writeClipboardText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }

  const textarea = document.createElement('textarea')
  textarea.value = String(text || '')
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

async function loadAiProviderSettings() {
  const stored = await getLocalStorage([STORAGE_KEYS.aiProviderSettings])
  const { normalizeAiNamingSettings } = await loadAiSettingsModule()
  return normalizeAiNamingSettings(stored[STORAGE_KEYS.aiProviderSettings])
}

function validateSmartAiSettings(settings) {
  if (!settings.baseUrl || !settings.apiKey || !settings.model) {
    throw new Error('请先到通用设置配置“自定义AI渠道”。')
  }
}

function hasConfiguredAiProviderSettings(settings) {
  return Boolean(settings.baseUrl && settings.apiKey && settings.model)
}

async function ensureSmartClassifyPermissions(settings, { interactive = false } = {}) {
  const origins = [
    getOriginPermissionPattern(settings.baseUrl)
  ].filter(Boolean)

  if (!origins.length) {
    return true
  }

  const missingOrigins = await getMissingPermissionOrigins(origins)
  if (!missingOrigins.length) {
    return true
  }

  if (!interactive) {
    throw createSmartPermissionRequiredError(missingOrigins)
  }

  const granted = await requestPermissions({ origins: missingOrigins })
  if (!granted) {
    throw createSmartPermissionRequiredError(missingOrigins, '未完成 AI 渠道授权，暂时无法智能分类。')
  }
  return true
}

async function buildCurrentPageContext(currentUrl, settings) {
  const contentExtraction = await loadContentExtractionModule()
  const timeoutMs = settings.timeoutMs
  let context = null
  const originPattern = contentExtraction.getDirectPageFetchOriginPattern(currentUrl)
  const canFetchDirectly = originPattern ? Boolean(await hasOptionalOriginPermission(originPattern)) : false
  const directFetchDecision = contentExtraction.decideDirectPageFetch(currentUrl, canFetchDirectly)

  if (!directFetchDecision.allowed) {
    context = contentExtraction.appendPageContentWarnings(
      contentExtraction.buildFallbackPageContentFromUrl(currentUrl, {
        currentTitle: getCurrentPageTitle()
      }),
      [directFetchDecision.warning]
    )
  } else {
    try {
      const response = await fetchWithSmartTimeout(currentUrl, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'follow',
        referrerPolicy: 'no-referrer'
      }, timeoutMs)
      const finalUrl = String(response.url || currentUrl || '')
      const contentType = String(response.headers.get('content-type') || '').toLowerCase()

      if (contentType.includes('text/html')) {
        const html = await response.text()
        context = contentExtraction.extractPageContentFromHtml(html, {
          url: finalUrl,
          currentTitle: getCurrentPageTitle(),
          contentType
        })
      } else {
        context = contentExtraction.buildFallbackPageContentFromUrl(finalUrl, {
          currentTitle: getCurrentPageTitle(),
          contentType
        })
      }
    } catch (error) {
      context = contentExtraction.appendPageContentWarnings(
        contentExtraction.buildFallbackPageContentFromUrl(currentUrl, {
          currentTitle: getCurrentPageTitle(),
          error
        }),
        [contentExtraction.getDirectPageFetchFailureWarning(error)]
      )
    }
  }

  if (settings.allowRemoteParsing) {
    const canUseRemoteParser = await hasOptionalOriginPermission(POPUP_JINA_READER_ORIGIN)
    if (!canUseRemoteParser) {
      return contentExtraction.normalizePageContentContext({
        ...context,
        warnings: [
          ...(context.warnings || []),
          'Jina Reader 未授权，本次已跳过远程解析。'
        ]
      })
    }

    try {
      const remoteContext = await fetchRemoteCurrentPageContext(context.finalUrl || currentUrl, timeoutMs, context, contentExtraction)
      return contentExtraction.combinePageContentContexts(context, remoteContext)
    } catch (error) {
      return contentExtraction.normalizePageContentContext({
        ...context,
        warnings: [
          ...(context.warnings || []),
          `远程解析失败：${normalizeSmartError(error)}`
        ]
      })
    }
  }

  return context
}

async function fetchRemoteCurrentPageContext(
  url,
  timeoutMs,
  fallbackContext,
  contentExtraction: typeof import('../options/sections/content-extraction.js')
) {
  const readerUrl = contentExtraction.buildJinaReaderUrl(url)
  if (!readerUrl) {
    throw new Error('远程解析 URL 无效。')
  }

  const response = await fetchWithSmartTimeout(readerUrl, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'follow',
    referrerPolicy: 'no-referrer',
    headers: {
      Accept: 'text/plain, text/markdown;q=0.9, */*;q=0.1'
    }
  }, timeoutMs)

  if (!response.ok) {
    throw new Error(`Jina Reader 返回 HTTP ${response.status}。`)
  }

  const text = await response.text()
  return contentExtraction.buildRemotePageContentFromText(text, {
    url: fallbackContext?.finalUrl || url,
    currentTitle: fallbackContext?.title || getCurrentPageTitle()
  })
}

async function requestSmartClassification({ settings, pageContext, currentUrl }) {
  const [contentExtraction, aiResponse] = await Promise.all([
    loadContentExtractionModule(),
    loadAiResponseModule()
  ])
  const endpoint = aiResponse.getAiEndpoint(settings)
  const requestBody = buildSmartAiRequestBody({
    settings,
    pageContext,
    currentUrl,
    contentExtraction
  })
  const response = await fetchWithSmartTimeout(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify(requestBody)
  }, settings.timeoutMs)
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(aiResponse.extractAiErrorMessage(payload, response.status))
  }

  const rawJsonText = settings.apiStyle === 'responses'
    ? aiResponse.extractResponsesJsonText(payload)
    : aiResponse.extractChatCompletionsJsonText(payload)

  try {
    return normalizeSmartAiResult(JSON.parse(rawJsonText))
  } catch {
    throw new Error('AI 返回了无法解析的 JSON 结果。')
  }
}

function buildSmartAiRequestBody({ settings, pageContext, currentUrl, contentExtraction }) {
  const systemPrompt = [
    '你是浏览器书签智能分类助手。',
    '你需要根据当前网页内容和用户已有书签文件夹，为当前网页推荐保存位置。',
    '如果 page_context.source_contexts 同时包含“本地抽取”和“Jina Reader”，请结合两路内容判断：本地抽取通常保留浏览器可见的 title/meta/链接上下文，Jina Reader 通常提供更干净的 Markdown 正文。',
    '必须优先推荐 existing_folders 中已经存在的文件夹；如果多个文件夹都匹配，优先选择嵌套层级最深、语义最具体的文件夹。',
    'existing_folders 数组只能填写输入中存在的 folder_path，不要编造已有文件夹。',
    'new_folder 只能作为最后的备用建议，路径要短，适合用户新建。',
    'title 要适合作为浏览器书签标题，简短清晰，不要包含无意义站点后缀。',
    'summary、content_type、topics、tags、aliases 用于本地搜索标签库：summary 概括页面内容，content_type 选择最贴近的内容类型。',
    'topics 是主题归类，可稍长；tags 是界面展示和筛选用短标签，必须短、原子、稳定。',
    'tags 规则：每个 tag 只表达一个概念；中文优先 2-6 个字，英文优先 1-3 个词；通常输出 4-8 个高价值 tag。',
    '禁止把句子、标题、描述、多个概念组合成 tag；如果包含“与、和、及、逗号或斜杠”等多个概念，请拆成多个短 tag。',
    '好的 tags 示例：["AI", "LLM", "网关", "API", "OpenAI 兼容"]；坏的 tags 示例：["一个支持 OpenAI Claude Gemini 的 API 聚合网关", "效率工具与网络技术博客"]。',
    'aliases 只输出语义别名、简称、英文名、中文名或常见叫法；不要输出拼音全拼或首字母。',
    'confidence 必须是 0 到 1 的数字。'
  ].join('\n')
  const userPrompt = JSON.stringify({
    current_page: {
      title: getCurrentPageTitle(),
      url: currentUrl,
      domain: extractDomain(currentUrl),
      page_context: contentExtraction.buildPageContextForAi(
        contentExtraction.normalizePageContentContext(pageContext),
        { mainTextLimit: 4200 }
      )
    },
    existing_folders: buildSmartFolderCandidates()
  }, null, 2)

  if (settings.apiStyle === 'chat_completions') {
    const schemaHint = '\n\n请严格按以下 JSON 格式返回结果，不要添加任何额外文本或 markdown 标记：\n' + JSON.stringify(SMART_CLASSIFY_SCHEMA, null, 2)
    return {
      model: settings.model,
      messages: [
        { role: 'system', content: systemPrompt + schemaHint },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' }
    }
  }

  return {
    model: settings.model,
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: systemPrompt }]
      },
      {
        role: 'user',
        content: [{ type: 'input_text', text: userPrompt }]
      }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'popup_smart_classification',
        strict: true,
        schema: SMART_CLASSIFY_SCHEMA
      }
    }
  }
}

function buildSmartFolderCandidates() {
  return state.allFolders
    .slice()
    .sort((left, right) => {
      return Number(right.depth || 0) - Number(left.depth || 0) || String(left.path).localeCompare(String(right.path), 'zh-Hans-CN')
    })
    .slice(0, 260)
    .map((folder) => ({
      folder_id: String(folder.id),
      folder_path: String(folder.path || folder.title || ''),
      title: String(folder.title || ''),
      depth: Number(folder.depth) || 0
    }))
}

function buildSmartRecommendations(aiResult) {
  const byFolderId = new Map()

  for (const suggestion of aiResult.existingFolders) {
    const folder = findBestExistingFolder(suggestion.folderPath)
    if (!folder) {
      continue
    }

    const previous = byFolderId.get(folder.id)
    const confidence = normalizeSmartConfidence(suggestion.confidence)
    if (!previous || confidence > previous.confidence) {
      byFolderId.set(folder.id, {
        id: `folder:${folder.id}`,
        kind: 'existing',
        folderId: folder.id,
        title: folder.title,
        path: folder.path || folder.title,
        confidence,
        reason: suggestion.reason || ''
      })
    }
  }

  const existingRecommendations = [...byFolderId.values()]
    .sort((left, right) => {
      const leftFolder = state.folderMap.get(left.folderId)
      const rightFolder = state.folderMap.get(right.folderId)
      return (
        Number(right.confidence) - Number(left.confidence) ||
        Number(rightFolder?.depth || 0) - Number(leftFolder?.depth || 0) ||
        String(left.path).localeCompare(String(right.path), 'zh-Hans-CN')
      )
    })
    .slice(0, SMART_RECOMMENDATION_LIMIT)

  if (existingRecommendations.length < SMART_RECOMMENDATION_LIMIT) {
    for (const fallback of buildLocalSmartFolderMatches()) {
      if (existingRecommendations.some((item) => item.folderId === fallback.folderId)) {
        continue
      }
      existingRecommendations.push(fallback)
      if (existingRecommendations.length >= SMART_RECOMMENDATION_LIMIT) {
        break
      }
    }
  }

  const newFolderPath = normalizeSmartFolderPath(aiResult.newFolder?.folderPath)
  const newRecommendation = newFolderPath
    ? [{
        id: 'new-folder',
        kind: 'new',
        folderId: '',
        title: getLastPathSegment(newFolderPath),
        path: newFolderPath,
        confidence: normalizeSmartConfidence(aiResult.newFolder?.confidence),
        reason: aiResult.newFolder?.reason || ''
      }]
    : []

  return [...existingRecommendations, ...newRecommendation]
}

function buildLocalSmartFolderMatches() {
  const titleText = normalizeText(getCurrentPageTitle())
  const urlText = normalizeText(state.currentTab?.url || '')
  const domainText = normalizeText(extractDomain(state.currentTab?.url || ''))
  const haystack = [titleText, urlText, domainText].filter(Boolean).join(' ')

  return state.allFolders
    .map((folder) => {
      const title = normalizeText(folder.title)
      const path = normalizeText(folder.path)
      let score = 0
      if (title && haystack.includes(title)) {
        score += 0.38
      }
      if (path && haystack.includes(path)) {
        score += 0.28
      }
      if (domainText && (title.includes(domainText) || path.includes(domainText))) {
        score += 0.22
      }
      score += Math.min(Number(folder.depth || 0), 6) * 0.025

      return {
        id: `folder:${folder.id}`,
        kind: 'existing',
        folderId: folder.id,
        title: folder.title,
        path: folder.path || folder.title,
        confidence: Math.max(0.52, Math.min(score, 0.82)),
        reason: '基于当前网页标题、域名和文件夹路径的本地补充匹配。'
      }
    })
    .filter((item) => item.confidence > 0.54)
    .sort((left, right) => {
      const leftFolder = state.folderMap.get(left.folderId)
      const rightFolder = state.folderMap.get(right.folderId)
      return (
        Number(right.confidence) - Number(left.confidence) ||
        Number(rightFolder?.depth || 0) - Number(leftFolder?.depth || 0) ||
        String(left.path).localeCompare(String(right.path), 'zh-Hans-CN')
      )
    })
}

function normalizeSmartAiResult(payload) {
  const existingFolders = Array.isArray(payload?.existing_folders)
    ? payload.existing_folders
    : []
  return {
    title: cleanSmartTitle(payload?.title || getCurrentPageTitle()),
    summary: cleanSmartText(payload?.summary, 360),
    contentType: cleanSmartText(payload?.content_type, 80),
    topics: normalizeSmartTextList(payload?.topics, 8, 40),
    tags: normalizeBookmarkTags(payload?.tags),
    aliases: normalizeSmartTextList(payload?.aliases, 20, 40),
    confidence: normalizeSmartConfidence(payload?.confidence),
    existingFolders: existingFolders
      .map((item) => ({
        folderPath: cleanSmartText(item?.folder_path, 240),
        reason: cleanSmartText(item?.reason, 180),
        confidence: normalizeSmartConfidence(item?.confidence)
      }))
      .filter((item) => item.folderPath),
    newFolder: {
      folderPath: cleanSmartText(payload?.new_folder?.folder_path, 240),
      reason: cleanSmartText(payload?.new_folder?.reason, 180),
      confidence: normalizeSmartConfidence(payload?.new_folder?.confidence)
    }
  }
}

function normalizeSmartTextList(value, limit, itemLimit) {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,，、\n]/)
      : []
  const seen = new Set()
  const output = []

  for (const item of values) {
    const text = cleanSmartText(item, itemLimit)
    const key = normalizeText(text)
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

function buildSmartExtractionSnapshot(pageContext) {
  return {
    status: cleanSmartText(pageContext?.extractionStatus, 40),
    source: cleanSmartText(pageContext?.source, 80),
    warnings: normalizeSmartTextList(pageContext?.warnings, 4, 40)
  }
}

function findBestExistingFolder(rawPath) {
  const normalizedPath = normalizeText(rawPath)
  if (!normalizedPath) {
    return null
  }

  const folders = state.allFolders.slice()
  const exactPathMatches = folders.filter((folder) => normalizeText(folder.path || folder.title) === normalizedPath)
  if (exactPathMatches.length) {
    return pickDeepestFolder(exactPathMatches)
  }

  const exactTitleMatches = folders.filter((folder) => normalizeText(folder.title) === normalizedPath)
  if (exactTitleMatches.length) {
    return pickDeepestFolder(exactTitleMatches)
  }

  const segment = normalizeText(getLastPathSegment(rawPath))
  const segmentMatches = folders.filter((folder) => normalizeText(folder.title) === segment)
  if (segmentMatches.length) {
    return pickDeepestFolder(segmentMatches)
  }

  const containsMatches = folders.filter((folder) => {
    const folderPath = normalizeText(folder.path || folder.title)
    return folderPath.includes(normalizedPath) || normalizedPath.includes(folderPath)
  })
  return containsMatches.length ? pickDeepestFolder(containsMatches) : null
}

function pickDeepestFolder(folders) {
  return folders
    .slice()
    .sort((left, right) => {
      return Number(right.depth || 0) - Number(left.depth || 0) || String(left.path).localeCompare(String(right.path), 'zh-Hans-CN')
    })[0] || null
}

async function requestPermissions(query) {
  try {
    if (await containsPermissions(query)) {
      return true
    }
  } catch {
  }

  return new Promise((resolve, reject) => {
    chrome.permissions.request(query, (granted) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(Boolean(granted))
    })
  })
}

function containsPermissions(query) {
  return new Promise((resolve, reject) => {
    chrome.permissions.contains(query, (granted) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(Boolean(granted))
    })
  })
}

async function getMissingPermissionOrigins(origins) {
  const uniqueOrigins = [...new Set(origins)].filter(Boolean)
  if (!uniqueOrigins.length) {
    return []
  }

  try {
    if (await containsPermissions({ origins: uniqueOrigins })) {
      return []
    }
  } catch (error) {
  }

  const missingOrigins = []
  for (const origin of uniqueOrigins) {
    try {
      if (!(await containsPermissions({ origins: [origin] }))) {
        missingOrigins.push(origin)
      }
    } catch (error) {
      missingOrigins.push(origin)
    }
  }
  return missingOrigins
}

async function hasOptionalOriginPermission(origin) {
  if (!origin) {
    return false
  }

  try {
    return await containsPermissions({ origins: [origin] })
  } catch (error) {
    return false
  }
}

function createSmartPermissionRequiredError(origins: unknown[], message = '需要授权 AI 渠道后才能智能分类。') {
  const error = new Error(message) as Error & {
    smartPermissionRequest?: { origins: string[] }
  }
  error.smartPermissionRequest = {
    origins: [...new Set(origins.map((origin) => String(origin || '')).filter(Boolean))]
  }
  return error
}

function isSmartPermissionRequiredError(error) {
  return Boolean((error as { smartPermissionRequest?: { origins?: string[] } })?.smartPermissionRequest?.origins)
}

function formatPermissionOrigin(origin) {
  return String(origin || '').replace(/\/\*$/, '')
}

function fetchWithSmartTimeout(url, options = {}, timeoutMs = POPUP_SMART_DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController()
  const externalSignal = (options as { signal?: AbortSignal | null }).signal
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
  }, Math.max(1000, Number(timeoutMs) || POPUP_SMART_DEFAULT_TIMEOUT_MS))

  return fetch(url, {
    ...options,
    signal: controller.signal
  }).finally(() => {
    clearTimeout(timeoutId)
    externalSignal?.removeEventListener('abort', abortCurrentFetch)
  })
}

function throwIfAborted(signal?: AbortSignal | null) {
  if (signal?.aborted) {
    throw new DOMException('操作已取消。', 'AbortError')
  }
}

function isAbortError(error) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function getOriginPermissionPattern(url) {
  try {
    const parsedUrl = new URL(String(url || '').trim())
    if (!/^https?:$/i.test(parsedUrl.protocol)) {
      return ''
    }
    return `${parsedUrl.origin}/*`
  } catch {
    return ''
  }
}

function updateActiveResultVisibility() {
  if (!state.debouncedQuery || !state.searchResults.length) {
    return
  }

  const activeResult = dom.content.querySelector<HTMLElement>(
    `[data-result-index="${state.activeResultIndex}"]`
  )
  if (!activeResult) {
    return
  }

  const maxScrollTop = Math.max(0, dom.content.scrollHeight - dom.content.clientHeight)

  if (state.activeResultIndex === 0) {
    dom.content.scrollTop = 0
    return
  }

  if (state.activeResultIndex === state.searchResults.length - 1) {
    dom.content.scrollTop = maxScrollTop
    return
  }

  const resultTop = activeResult.offsetTop
  const resultBottom = resultTop + activeResult.offsetHeight
  const viewportTop = dom.content.scrollTop
  const viewportBottom = viewportTop + dom.content.clientHeight

  if (resultTop < viewportTop) {
    dom.content.scrollTop = Math.max(0, resultTop)
    return
  }

  if (resultBottom > viewportBottom) {
    dom.content.scrollTop = Math.min(maxScrollTop, resultBottom - dom.content.clientHeight)
  }
}

function setActiveResultIndex(nextIndex) {
  if (!state.debouncedQuery || !state.searchResults.length) {
    return
  }

  const clampedIndex = Math.max(0, Math.min(nextIndex, state.searchResults.length - 1))
  if (clampedIndex === state.activeResultIndex) {
    return
  }

  const previousIndex = state.activeResultIndex
  state.activeResultIndex = clampedIndex
  updateActiveSearchResult(previousIndex, clampedIndex)
  updateActiveResultVisibility()
}

function updateActiveSearchResult(previousIndex, nextIndex) {
  const previousCard = dom.content.querySelector(`[data-result-index="${previousIndex}"]`)
  const nextCard = dom.content.querySelector(`[data-result-index="${nextIndex}"]`)

  if (!previousCard && !nextCard) {
    renderMainContent()
    return
  }

  previousCard?.classList.remove('active')
  nextCard?.classList.add('active')
}

function getCurrentTreeRoot() {
  if (state.selectedFolderFilterId) {
    return findNodeById(state.rawTreeRoot, state.selectedFolderFilterId) || state.bookmarksBarNode
  }

  return state.bookmarksBarNode
}

function getFilteredBookmarks() {
  const cacheKey = state.selectedFolderFilterId || 'all'
  if (state.filteredBookmarksCacheKey === cacheKey) {
    return state.filteredBookmarksCache
  }

  const bookmarks = state.selectedFolderFilterId
    ? state.allBookmarks.filter((bookmark) => {
        return bookmark.ancestorIds.includes(state.selectedFolderFilterId)
      })
    : state.allBookmarks

  state.filteredBookmarksCacheKey = cacheKey
  state.filteredBookmarksCache = bookmarks
  return bookmarks
}

function getSearchCacheKey(normalizedQuery) {
  return `${state.selectedFolderFilterId || 'all'}\u0000${normalizedQuery}`
}

function getNaturalSearchDateBucket() {
  return formatLocalDate(Date.now())
}

function getNaturalSearchPlanCacheKey(normalizedQuery) {
  return `${getNaturalSearchDateBucket()}\u0000${normalizedQuery}`
}

function cacheSearchResults(cacheKey, results) {
  state.searchCache.set(cacheKey, results)
}

function clearSearchCaches() {
  state.searchCache.clear()
  state.naturalSearchPlanCache.clear()
  state.filteredBookmarksCacheKey = ''
  state.filteredBookmarksCache = []
}

function yieldWork() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(resolve)
  })
}

function formatLocalDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isSmartClassifiableUrl(url) {
  return /^https?:\/\//i.test(String(url || '').trim())
}

function getCurrentPageTitle() {
  return String(state.currentTab?.title || '').trim() || '未命名网页'
}

function getSmartFallbackIconLabel(title) {
  const normalized = String(title || '').trim()
  return normalized ? normalized.slice(0, 1).toUpperCase() : 'C'
}

function getSmartLoadingLabel() {
  if (state.smartStep <= 1) {
    return '读取网页内容…'
  }
  if (state.smartStep === 2) {
    return 'AI 分析内容…'
  }
  return '匹配已有文件夹…'
}

function getSmartProgressTarget() {
  const step = Math.max(1, Math.min(state.smartStep || 1, SMART_LOADING_STEP_COUNT))
  return Math.max(10, Math.min((step / SMART_LOADING_STEP_COUNT) * 100, 100))
}

function waitForSmartLoadingPaint() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(resolve)
  })
}

function cleanSmartTitle(value) {
  const title = cleanSmartText(value, 90)
  return title || getCurrentPageTitle()
}

function cleanSmartText(value, limit = 180) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= limit) {
    return text
  }
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`
}

function normalizeSmartConfidence(value) {
  const numeric = Number(value)
  if (Number.isFinite(numeric)) {
    return Math.max(0, Math.min(numeric, 1))
  }
  return 0
}

function normalizeSmartFolderPath(value) {
  const segments = splitSmartFolderPath(value)
  return segments.join(' / ')
}

function splitSmartFolderPath(value) {
  return String(value || '')
    .split(/\s*(?:\/|>|›|»|\\)\s*/g)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .slice(0, 5)
}

function getLastPathSegment(value) {
  const segments = splitSmartFolderPath(value)
  return segments.at(-1) || cleanSmartText(value, 60) || '推荐文件夹'
}

function formatSmartFolderPath(path) {
  return formatBookmarkPath(path) || splitSmartFolderPath(path).join(' · ') || '未归档路径'
}

function getSmartFolderTargetPathLabel() {
  const selectedRecommendation = state.smartRecommendations.find((item) => item.id === state.smartSelectedRecommendationId)
  if (selectedRecommendation) {
    return `当前推荐：${formatBookmarkPath(selectedRecommendation.path) || selectedRecommendation.title || '未命名文件夹'}`
  }

  return `当前页面：${displayUrl(state.currentTab?.url || '')}`
}

function normalizeSmartError(error) {
  if (error?.name === 'AbortError') {
    return '请求超时，请稍后重试或调大通用设置中的请求超时。'
  }
  return error instanceof Error ? error.message : '智能分类失败，请稍后重试。'
}

function hasOpenModal() {
  return Boolean(
    state.isFilterPickerOpen ||
      state.moveTargetBookmarkId ||
      state.smartFolderPickerOpen ||
      state.editTargetBookmarkId ||
      state.confirmDeleteBookmarkId
  )
}

function getDefaultExpandedFolders(node) {
  if (!node || node.url) {
    return new Set()
  }

  return new Set([node.id])
}

function describeFolder(folder) {
  if (!folder) {
    return '文件夹'
  }

  const parts = []
  if (folder.folderCount) {
    parts.push(`${folder.folderCount} 个文件夹`)
  }
  if (folder.bookmarkCount) {
    parts.push(`${folder.bookmarkCount} 个书签`)
  }

  return parts.join(' · ') || '空文件夹'
}

function highlightText(text, query) {
  const safeText = String(text || '')
  const terms = getQueryTerms(normalizeQuery(query))

  if (!terms.length || !safeText) {
    return escapeHtml(safeText)
  }

  const lowerText = safeText.toLowerCase()
  const ranges = []

  for (const term of terms.sort((left, right) => right.length - left.length)) {
    let fromIndex = 0
    while (fromIndex < lowerText.length) {
      const matchIndex = lowerText.indexOf(term, fromIndex)
      if (matchIndex === -1) {
        break
      }
      ranges.push([matchIndex, matchIndex + term.length])
      fromIndex = matchIndex + term.length
    }
  }

  if (!ranges.length) {
    return escapeHtml(safeText)
  }

  ranges.sort((left, right) => left[0] - right[0])
  const mergedRanges = []

  for (const currentRange of ranges) {
    const previousRange = mergedRanges.at(-1)
    if (!previousRange || currentRange[0] > previousRange[1]) {
      mergedRanges.push([...currentRange])
      continue
    }

    previousRange[1] = Math.max(previousRange[1], currentRange[1])
  }

  let cursor = 0
  let output = ''

  for (const [start, end] of mergedRanges) {
    output += escapeHtml(safeText.slice(cursor, start))
    output += `<mark>${escapeHtml(safeText.slice(start, end))}</mark>`
    cursor = end
  }

  output += escapeHtml(safeText.slice(cursor))
  return output
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr(value) {
  return escapeHtml(value)
}

function showToast({ type = 'success', message, action = '', actionLabel = '' }) {
  const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const toast = {
    id,
    type,
    message,
    action,
    actionLabel
  }

  const nextToasts = [...state.toasts, toast]
  const overflowCount = Math.max(0, nextToasts.length - MAX_VISIBLE_TOASTS)
  if (overflowCount) {
    const removedToastIds = getOverflowToastIds(nextToasts, overflowCount)
    removedToastIds.forEach(clearToastTimer)
    state.toasts = nextToasts.filter((nextToast) => {
      return !removedToastIds.has(String(nextToast.id || ''))
    })
  } else {
    state.toasts = nextToasts
  }
  renderToasts()

  if (!state.toasts.some((visibleToast) => visibleToast.id === id)) {
    return
  }

  const timeoutId = window.setTimeout(() => {
    dismissToast(id)
  }, action === 'undo-delete' ? UNDO_WINDOW_MS : 3200)

  state.toastTimers.set(id, timeoutId)
}

function getOverflowToastIds(toasts, overflowCount) {
  const removedToastIds = new Set()
  for (const toast of toasts) {
    if (removedToastIds.size >= overflowCount) {
      break
    }
    if (toast.action) {
      continue
    }
    removedToastIds.add(String(toast.id || ''))
  }

  for (const toast of toasts) {
    if (removedToastIds.size >= overflowCount) {
      break
    }
    const toastId = String(toast.id || '')
    if (removedToastIds.has(toastId)) {
      continue
    }
    removedToastIds.add(toastId)
  }

  return removedToastIds
}

function dismissToast(toastId) {
  if (!toastId) {
    return
  }

  clearToastTimer(toastId)

  const toastElement = dom.toastRoot.querySelector(`[data-toast-id="${CSS.escape(String(toastId))}"]`)
  state.toasts = state.toasts.filter((toast) => toast.id !== toastId)
  if (toastElement instanceof HTMLElement && !toastElement.classList.contains('is-closing')) {
    void closeWithExitMotion(toastElement, 'is-closing', () => {
      toastElement.remove()
    }, 220)
    return
  }

  renderToasts()
}

function clearToastTimer(toastId) {
  const timeoutId = state.toastTimers.get(String(toastId))
  if (timeoutId) {
    clearTimeout(timeoutId)
    state.toastTimers.delete(String(toastId))
  }
}
