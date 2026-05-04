import {
  AI_NAMING_DEFAULT_BASE_URL,
  AI_NAMING_DEFAULT_MODEL,
  AI_NAMING_DEFAULT_TIMEOUT_MS,
  AI_NAMING_DEFAULT_BATCH_SIZE
} from './constants.js'
import { getDefaultInboxSettings } from '../../shared/inbox.js'
import {
  DEFAULT_CONTENT_SNAPSHOT_SETTINGS,
  type ContentSnapshotIndex,
  type ContentSnapshotSettings
} from '../../shared/content-snapshots.js'
import type { FolderCleanupSplitUndo } from '../../shared/folder-cleanup.js'

export function createEmptyIgnoreRules() {
  return {
    bookmarks: [],
    domains: [],
    folders: [],
    bookmarkIds: new Set(),
    domainValues: new Set(),
    folderIds: new Set()
  }
}

export function createEmptyRedirectCache() {
  return {
    savedAt: 0,
    scope: normalizeHistoryRunScope(),
    results: []
  }
}

export function createDefaultAiNamingSettings() {
  return {
    baseUrl: AI_NAMING_DEFAULT_BASE_URL,
    apiKey: '',
    model: AI_NAMING_DEFAULT_MODEL,
    customModels: [],
    fetchedModels: [],
    apiStyle: 'responses',
    timeoutMs: AI_NAMING_DEFAULT_TIMEOUT_MS,
    batchSize: AI_NAMING_DEFAULT_BATCH_SIZE,
    autoSelectHighConfidence: true,
    allowRemoteParsing: false,
    autoAnalyzeBookmarks: false,
    systemPrompt: ''
  }
}

export function normalizeHistoryRunScope(scope = null) {
  if (!scope || typeof scope !== 'object') {
    return {
      key: 'all',
      type: 'all',
      folderId: '',
      label: '全部书签'
    }
  }

  const type = String(scope.type || 'all').trim() === 'folder' ? 'folder' : 'all'
  const folderId = type === 'folder' ? String(scope.folderId || '').trim() : ''
  const key = type === 'folder' && folderId ? `folder:${folderId}` : 'all'

  return {
    key,
    type,
    folderId,
    label: String(scope.label || (key === 'all' ? '全部书签' : '指定文件夹')).trim() || '全部书签'
  }
}

export type DashboardViewMode = 'cards'
export type DashboardSortKey = 'date-desc' | 'date-asc' | 'title-asc' | 'domain-asc'

export const availabilityState = {
  catalogLoading: true,
  permissionPending: true,
  requestingPermission: false,
  storageLoading: true,
  probePermissionGranted: false,
  currentRunProbeEnabled: false,
  running: false,
  retestingSelection: false,
  retestSelectionTotal: 0,
  retestSelectionCompleted: 0,
  retestSelectionProbeEnabled: false,
  paused: false,
  stopRequested: false,
  deleting: false,
  deleteModalOpen: false,
  scopeFolderId: '',
  bookmarks: [],
  allBookmarks: [],
  allFolders: [],
  bookmarkMap: new Map(),
  folderMap: new Map(),
  runQueue: [],
  deletedBookmarkIds: new Set(),
  abortController: null as AbortController | null,
  activeNavigationCheckIds: new Set<string>(),
  requestOrigins: [],
  totalBookmarks: 0,
  eligibleBookmarks: 0,
  checkedBookmarks: 0,
  availableCount: 0,
  redirectedCount: 0,
  reviewCount: 0,
  failedCount: 0,
  ignoredCount: 0,
  skippedCount: 0,
  runStartedAt: 0,
  reviewResults: [],
  failedResults: [],
  reviewResultsPage: 1,
  failedResultsPage: 1,
  redirectResults: [],
  availabilityFilter: 'all',
  lastCompletedAt: 0,
  lastRunOutcome: '',
  lastError: '',
  runnerStatusCopy: '',
  settingsOpen: false,
  settingsStatus: '',
  settingsStatusTone: 'muted',
  settings: {
    concurrency: 2,
    navigationTimeoutMs: 30000
  }
}

export const managerState = {
  ignoreRules: createEmptyIgnoreRules(),
  historyRuns: [],
  bookmarkAddHistory: [],
  redirectCache: createEmptyRedirectCache(),
  pendingAvailabilitySnapshot: null,
  previousHistoryMap: new Map(),
  historyLastRunAt: 0,
  historyRecoveredResults: [],
  historyNewCount: 0,
  historyPersistentCount: 0,
  suppressedResults: [],
  currentHistoryEntries: [],
  duplicateGroups: [],
  duplicateStrategyStatus: '',
  recycleBin: [],
  selectedAvailabilityIds: new Set(),
  selectedRedirectIds: new Set(),
  redirectResultsPage: 1,
  selectedDuplicateIds: new Set(),
  selectedRecycleIds: new Set(),
  historyLogsCollapsed: false,
  scopeModalOpen: false,
  scopeModalSource: 'availability',
  scopeSearchQuery: '',
  scopeFolderActiveId: null as string | null,
  moveModalOpen: false,
  moveSearchQuery: '',
  moveSelectionSource: 'availability',
  moveDashboardBookmarkId: '',
  aiModelModalOpen: false,
  aiModelPickerModalOpen: false,
  aiModelPickerSearchQuery: '',
  aiModelPickerActiveId: '',
  confirmModalOpen: false,
  confirmModalTone: 'danger',
  confirmModalLabel: '确认',
  confirmModalTitle: '确认操作？',
  confirmModalCopy: '请确认是否继续。',
  confirmModalConfirmLabel: '确认',
  confirmModalCancelLabel: '取消',
  aiRevealApiKey: false,
  shortcutCommands: [] as chrome.commands.Command[],
  shortcutStatus: 'loading',
  shortcutStatusTone: 'muted',
  inboxSettings: getDefaultInboxSettings(),
  inboxSettingsStatus: ''
}

export const dashboardState = {
  viewMode: 'cards' as DashboardViewMode,
  query: '',
  folderId: '',
  domain: '',
  month: '',
  sortKey: 'date-desc' as DashboardSortKey,
  selectedIds: new Set<string>(),
  expandedTagIds: new Set<string>(),
  tagEditorBookmarkId: '',
  tagEditorDraft: '',
  tagEditorStatus: '',
  tagEditorSaving: false,
  tagEditorBusyAction: '',
  tagEditorReturnFocusId: '',
  copyFeedbackId: '',
  statusMessage: ''
}

export const contentSnapshotState = {
  settings: { ...DEFAULT_CONTENT_SNAPSHOT_SETTINGS } as ContentSnapshotSettings,
  index: { version: 1, updatedAt: 0, records: {} } as ContentSnapshotIndex,
  searchTextMap: new Map<string, string>(),
  searchTextMapIncludesFullText: false,
  searchTextMapLoadingFullText: false,
  searchTextMapFullTextRetryCount: 0,
  searchTextMapFullTextRetryTimer: 0,
  statusMessage: '',
  aiRunSavedCount: 0,
  aiRunFailedCount: 0
}

export const folderCleanupState = {
  rootNode: null as chrome.bookmarks.BookmarkTreeNode | null,
  suggestions: [] as any[],
  selectedSuggestionId: '',
  statusMessage: '',
  lastAnalyzedAt: 0,
  running: false,
  executing: false,
  executedSuggestionIds: new Set<string>(),
  lastSplitUndo: null as FolderCleanupSplitUndo | null
}

export const aiNamingState = {
  scopeFolderId: '',
  bookmarks: [],
  requestOrigins: [],
  paused: false,
  pauseResolvers: [],
  filterStatus: 'all',
  filterConfidence: 'all',
  filterQuery: '',
  resultsPage: 1,
  expandedTagResultIds: new Set(),
  pendingMoveResultIds: new Set(),
  pendingMoveSelection: false,
  settingsDirty: false,
  testingConnection: false,
  fetchingModels: false,
  lastFetchModelsAt: 0,
  lastFetchModelsError: '',
  lastFetchModelsCount: 0,
  running: false,
  stopRequested: false,
  applying: false,
  requestingPermission: false,
  permissionGranted: false,
  remoteParserPermissionGranted: false,
  runStartedAt: 0,
  checkedBookmarks: 0,
  eligibleBookmarks: 0,
  suggestedCount: 0,
  manualReviewCount: 0,
  unchangedCount: 0,
  highConfidenceCount: 0,
  mediumConfidenceCount: 0,
  lowConfidenceCount: 0,
  failedCount: 0,
  results: [],
  selectedResultIds: new Set(),
  tagIndex: {
    version: 1,
    updatedAt: 0,
    records: {}
  },
  tagDataStatus: '',
  lastConnectivityTestAt: 0,
  lastConnectivityTestStatus: '',
  lastConnectivityTestMessage: '',
  lastCompletedAt: 0,
  lastError: ''
}

export const aiNamingManagerState = {
  settings: createDefaultAiNamingSettings()
}

export const backupRestoreState = {
  fileName: '',
  backup: null,
  preview: null,
  restoring: false,
  status: ''
}
