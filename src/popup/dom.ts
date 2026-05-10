import { requireElement } from '../shared/dom.js'

type PopupDomElement =
  HTMLElement & {
    disabled: boolean
    value: string
    placeholder: string
    focus: () => void
    select: () => void
  }

export type PopupDomRefs = Record<string, PopupDomElement>

export const dom = {} as PopupDomRefs

function byId(id: string): PopupDomElement {
  return requireElement<PopupDomElement>(id)
}

export function cacheDom(): void {
  dom.appShell = byId('popup-app-shell')
  dom.heroSubtitle = byId('hero-subtitle')
  dom.openSettings = byId('open-settings')
  dom.autoAnalyzeStatus = byId('auto-analyze-status')
  dom.searchInput = byId('search-input')
  dom.naturalSearchToggle = byId('natural-search-toggle')
  dom.clearSearch = byId('clear-search')
  dom.searchHelpToggle = byId('search-help-toggle')
  dom.searchHelpPopover = byId('search-help-popover')
  dom.searchChips = byId('search-chips')
  dom.savedSearches = byId('saved-searches')
  dom.viewCaption = byId('view-caption')
  dom.folderFilterTrigger = byId('folder-filter-trigger')
  dom.folderFilterTriggerText = byId('folder-filter-trigger-text')
  dom.clearFolderFilter = byId('clear-folder-filter')
  dom.folderBreadcrumbs = byId('folder-breadcrumbs')
  dom.errorBanner = byId('error-banner')
  dom.smartClassifier = byId('smart-classifier')
  dom.smartFooter = byId('smart-footer')
  dom.smartTotal = byId('smart-total')
  dom.smartFooterSettings = byId('smart-footer-settings')
  dom.loadingState = byId('loading-state')
  dom.emptyState = byId('empty-state')
  dom.content = byId('content')
  dom.modalBackdrop = byId('modal-backdrop')
  dom.filterModal = byId('filter-modal')
  dom.filterSearchInput = byId('filter-search-input')
  dom.filterFolderList = byId('filter-folder-list')
  dom.closeFilterModal = byId('close-filter-modal')
  dom.moveModal = byId('move-modal')
  dom.moveBookmarkTitle = byId('move-bookmark-title')
  dom.moveBookmarkPath = byId('move-bookmark-path')
  dom.moveSearchInput = byId('move-search-input')
  dom.moveFolderList = byId('move-folder-list')
  dom.closeMoveModal = byId('close-move-modal')
  dom.smartFolderModal = byId('smart-folder-modal')
  dom.smartFolderPageTitle = byId('smart-folder-page-title')
  dom.smartFolderPageUrl = byId('smart-folder-page-url')
  dom.smartFolderSearchInput = byId('smart-folder-search-input')
  dom.smartFolderList = byId('smart-folder-list')
  dom.closeSmartFolderModal = byId('close-smart-folder-modal')
  dom.aiProviderPromptModal = byId('ai-provider-prompt-modal')
  dom.closeAiProviderPrompt = byId('close-ai-provider-prompt')
  dom.cancelAiProviderPrompt = byId('cancel-ai-provider-prompt')
  dom.openAiProviderSettings = byId('open-ai-provider-settings')
  dom.editModal = byId('edit-modal')
  dom.editBookmarkPath = byId('edit-bookmark-path')
  dom.editTitleInput = byId('edit-title-input')
  dom.editUrlInput = byId('edit-url-input')
  dom.closeEditModal = byId('close-edit-modal')
  dom.cancelEdit = byId('cancel-edit')
  dom.saveEdit = byId('save-edit')
  dom.deleteModal = byId('delete-modal')
  dom.deleteBookmarkTitle = byId('delete-bookmark-title')
  dom.deleteBookmarkPath = byId('delete-bookmark-path')
  dom.cancelDelete = byId('cancel-delete')
  dom.confirmDelete = byId('confirm-delete')
  dom.toastRoot = byId('toast-root')
}
