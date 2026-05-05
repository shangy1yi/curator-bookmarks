import type { FolderRecord } from '../shared/types.js'
import { createMemoryCache, type MemoryCache } from '../shared/cache.js'
import type { BookmarkTagIndex } from '../shared/bookmark-tags.js'
import type { SavedSearchIndex } from '../shared/search-query.js'
import type { NaturalSearchPlan } from './natural-search.js'
import type { PopupSearchIndexSnapshotState } from './search-index.js'
import type { PopupSearchBookmark, PopupSearchResult } from './search.js'

const SEARCH_CACHE_LIMIT = 40

export interface PopupSmartRecommendation {
  id: string
  kind: string
  folderId?: string
  title: string
  path: string
  reason: string
  confidence: number
  [key: string]: unknown
}

export interface PopupDeletedBookmark {
  title: string
  url: string
  parentId: string
  index: number
  recycleId: string
}

export interface PopupToast {
  id?: string
  type: string
  message: string
  action?: string
  actionLabel?: string
  [key: string]: unknown
}

export interface PopupAutoAnalyzeStatus {
  status: string
  bookmarkId: string
  title: string
  url: string
  folderPath: string
  confidence: number
  error: string
  detail: string
  attempts: number
  maxAttempts: number
  badgeVisible: boolean
  createdAt: number
  updatedAt: number
  expiresAt: number
}

export interface PopupState {
  isLoading: boolean
  loadError: string
  rawTreeRoot: chrome.bookmarks.BookmarkTreeNode | null
  bookmarksBarNode: chrome.bookmarks.BookmarkTreeNode | null
  allBookmarks: PopupSearchBookmark[]
  allFolders: FolderRecord[]
  bookmarkMap: Map<string, PopupSearchBookmark>
  folderMap: Map<string, FolderRecord>
  expandedFolders: Set<string>
  moveExpandedFolders: Set<string>
  searchQuery: string
  debouncedQuery: string
  selectedFolderFilterId: string | null
  viewNoticeMessage: string
  viewNoticeTimer: number | null
  isFilterPickerOpen: boolean
  filterSearchQuery: string
  filterFolderActiveId: string
  searchResults: PopupSearchResult[]
  activeResultIndex: number
  searchTimer: number | null
  searchRunId: number
  searchPending: boolean
  searchCache: MemoryCache<string, PopupSearchResult[]>
  savedSearches: SavedSearchIndex | null
  savedSearchesLoaded: boolean
  savedSearchesError: string
  searchTagIndex: BookmarkTagIndex | null
  searchSnapshotState: PopupSearchIndexSnapshotState | null
  searchSnapshotFullTextReady: boolean
  searchSnapshotFullTextPending: boolean
  searchSnapshotFullTextRunId: number
  naturalSearchEnabled: boolean
  naturalSearchSetupRequired: boolean
  naturalSearchPending: boolean
  naturalSearchError: string
  naturalSearchPlan: NaturalSearchPlan | null
  naturalSearchAbortController: AbortController | null
  naturalSearchPlanCache: MemoryCache<string, NaturalSearchPlan>
  searchHighlightQuery: string
  filteredBookmarksCacheKey: string
  filteredBookmarksCache: PopupSearchBookmark[]
  contentRenderHtml: string
  activeMenuBookmarkId: string | null
  moveTargetBookmarkId: string | null
  moveSearchQuery: string
  editTargetBookmarkId: string | null
  editDraftBookmarkId: string
  editDraftTitle: string
  editDraftUrl: string
  editDraftDirty: boolean
  editDiscardArmed: boolean
  editDiscardTimer: number | null
  editSaving: boolean
  confirmDeleteBookmarkId: string | null
  pendingActionIds: Set<string>
  currentTab: chrome.tabs.Tab | null
  currentPageBookmarkId: string | null
  smartStatus: string
  smartError: string
  smartStep: number
  smartProgressPercent: number
  smartSuggestedTitle: string
  smartSummary: string
  smartContentType: string
  smartTopics: string[]
  smartTags: string[]
  smartAliases: string[]
  smartConfidence: number
  smartModel: string
  smartExtraction: { status: string; source: string; warnings: string[] }
  smartRecommendations: PopupSmartRecommendation[]
  smartSelectedRecommendationId: string
  smartFolderPickerOpen: boolean
  smartFolderSearchQuery: string
  smartSaving: boolean
  smartSaved: boolean
  smartRunId: number
  smartPermissionRequest: { origins?: string[] } | null
  autoAnalyzeStatus: PopupAutoAnalyzeStatus | null
  lastDeletedBookmark: PopupDeletedBookmark | null
  toasts: PopupToast[]
  toastTimers: Map<string, number>
}

export const state: PopupState = {
  isLoading: true,
  loadError: '',
  rawTreeRoot: null,
  bookmarksBarNode: null,
  allBookmarks: [],
  allFolders: [],
  bookmarkMap: new Map(),
  folderMap: new Map(),
  expandedFolders: new Set(),
  moveExpandedFolders: new Set(),
  searchQuery: '',
  debouncedQuery: '',
  selectedFolderFilterId: null,
  viewNoticeMessage: '',
  viewNoticeTimer: null,
  isFilterPickerOpen: false,
  filterSearchQuery: '',
  filterFolderActiveId: '',
  searchResults: [],
  activeResultIndex: 0,
  searchTimer: null,
  searchRunId: 0,
  searchPending: false,
  searchCache: createMemoryCache<string, PopupSearchResult[]>({
    maxEntries: SEARCH_CACHE_LIMIT,
    version: 'popup-search-v1'
  }),
  savedSearches: null,
  savedSearchesLoaded: false,
  savedSearchesError: '',
  searchTagIndex: null,
  searchSnapshotState: null,
  searchSnapshotFullTextReady: false,
  searchSnapshotFullTextPending: false,
  searchSnapshotFullTextRunId: 0,
  naturalSearchEnabled: false,
  naturalSearchSetupRequired: false,
  naturalSearchPending: false,
  naturalSearchError: '',
  naturalSearchPlan: null,
  naturalSearchAbortController: null,
  naturalSearchPlanCache: createMemoryCache<string, NaturalSearchPlan>({
    maxEntries: SEARCH_CACHE_LIMIT,
    version: 'popup-natural-search-plan-v1'
  }),
  searchHighlightQuery: '',
  filteredBookmarksCacheKey: '',
  filteredBookmarksCache: [],
  contentRenderHtml: '',
  activeMenuBookmarkId: null,
  moveTargetBookmarkId: null,
  moveSearchQuery: '',
  editTargetBookmarkId: null,
  editDraftBookmarkId: '',
  editDraftTitle: '',
  editDraftUrl: '',
  editDraftDirty: false,
  editDiscardArmed: false,
  editDiscardTimer: null,
  editSaving: false,
  confirmDeleteBookmarkId: null,
  pendingActionIds: new Set(),
  currentTab: null,
  currentPageBookmarkId: null,
  smartStatus: 'idle',
  smartError: '',
  smartStep: 0,
  smartProgressPercent: 0,
  smartSuggestedTitle: '',
  smartSummary: '',
  smartContentType: '',
  smartTopics: [],
  smartTags: [],
  smartAliases: [],
  smartConfidence: 0,
  smartModel: '',
  smartExtraction: { status: '', source: '', warnings: [] },
  smartRecommendations: [],
  smartSelectedRecommendationId: '',
  smartFolderPickerOpen: false,
  smartFolderSearchQuery: '',
  smartSaving: false,
  smartSaved: false,
  smartRunId: 0,
  smartPermissionRequest: null,
  autoAnalyzeStatus: null,
  lastDeletedBookmark: null,
  toasts: [],
  toastTimers: new Map()
}
