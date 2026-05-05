export const BOOKMARKS_BAR_ID = '1'
export const OTHER_BOOKMARKS_ID = '2'
export const ROOT_ID = '0'
export const NEWTAB_ADD_SPEED_DIAL_MESSAGE_TYPE = 'curator:newtab-add-speed-dial'

export interface NewTabAddSpeedDialMessage {
  type: typeof NEWTAB_ADD_SPEED_DIAL_MESSAGE_TYPE
  bookmarkId: string
}

export const STORAGE_KEYS = {
  ignoreRules: 'curatorBookmarkIgnoreRules',
  detectionHistory: 'curatorBookmarkDetectionHistory',
  bookmarkAddHistory: 'curatorBookmarkAddHistory',
  autoAnalyzeQueue: 'curatorBookmarkAutoAnalyzeQueue',
  autoAnalyzeStatus: 'curatorBookmarkAutoAnalyzeStatus',
  pendingAutoAnalyzeNotice: 'curatorBookmarkPendingAutoAnalyzeNotice',
  pendingAvailabilityResults: 'curatorBookmarkPendingAvailabilityResults',
  newTabCustomIcons: 'curatorBookmarkNewTabCustomIcons',
  newTabBackgroundSettings: 'curatorBookmarkNewTabBackgroundSettings',
  newTabSearchSettings: 'curatorBookmarkNewTabSearchSettings',
  newTabIconSettings: 'curatorBookmarkNewTabIconSettings',
  newTabFaviconAccentCache: 'curatorBookmarkNewTabFaviconAccentCache',
  newTabTimeSettings: 'curatorBookmarkNewTabTimeSettings',
  newTabGeneralSettings: 'curatorBookmarkNewTabGeneralSettings',
  newTabFolderSettings: 'curatorBookmarkNewTabFolderSettings',
  newTabWorkspaceSettings: 'curatorBookmarkNewTabWorkspaceSettings',
  newTabModuleSettings: 'curatorBookmarkNewTabModuleSettings',
  newTabActivity: 'curatorBookmarkNewTabActivity',
  popupCommandIntent: 'curatorBookmarkPopupCommandIntent',
  popupPreferences: 'curatorBookmarkPopupPreferences',
  redirectCache: 'curatorBookmarkRedirectCache',
  availabilitySettings: 'curatorBookmarkAvailabilitySettings',
  recycleBin: 'curatorBookmarkRecycleBin',
  aiProviderSettings: 'curatorBookmarkAiNamingSettings',
  bookmarkTagIndex: 'curatorBookmarkTagIndex',
  backupSettings: 'curatorBookmarkBackupSettings',
  autoBackupIndex: 'curatorBookmarkAutoBackupIndex',
  folderCleanupState: 'curatorBookmarkFolderCleanupState',
  inboxState: 'curatorBookmarkInboxState',
  inboxSettings: 'curatorBookmarkInboxSettings',
  contentSnapshotSettings: 'curatorBookmarkContentSnapshotSettings',
  contentSnapshotIndex: 'curatorBookmarkContentSnapshotIndex',
  savedSearches: 'curatorBookmarkSavedSearches'
} as const

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

export const BOOKMARK_ADD_HISTORY_LIMIT = 200
export const RECYCLE_BIN_LIMIT = 200
export const UNDO_WINDOW_MS = 5000
export const AUTO_ANALYZE_STATUS_ACTIVE_EXPIRE_MS = 10 * 60 * 1000
export const AUTO_ANALYZE_STATUS_FINAL_EXPIRE_MS = 5 * 60 * 1000
export const POPUP_COMMAND_INTENT_TTL_MS = 45 * 1000
export const COMMAND_FEEDBACK_BADGE_TTL_MS = 3000
export const AUTO_BACKUP_RETENTION_LIMIT = 5
export const CONTENT_SNAPSHOT_LOCAL_TEXT_LIMIT = 20 * 1024
export const SAVED_SEARCH_LIMIT = 30
export const INBOX_AUTO_MOVE_MIN_CONFIDENCE = 0.72
export const DEFAULT_INBOX_FOLDER_TITLE = 'Inbox / 待整理'
