export interface PopupEditBookmarkDraftBookmark {
  title?: string
  url?: string
  parentId?: string
}

export interface PopupEditBookmarkDraftInput {
  bookmark: PopupEditBookmarkDraftBookmark | null | undefined
  draftTitle: string
  draftUrl: string
  draftParentId: string
}

export interface PopupEditBookmarkDraftState {
  dirty: boolean
  titleChanged: boolean
  urlChanged: boolean
  parentChanged: boolean
}

export interface PopupEditBookmarkSavePlan extends PopupEditBookmarkDraftState {
  updateChanges: { title: string; url: string } | null
  parentId: string
}

export function getPopupEditBookmarkDraftState(
  input: PopupEditBookmarkDraftInput
): PopupEditBookmarkDraftState {
  const bookmark = input.bookmark
  if (!bookmark) {
    return {
      dirty: false,
      titleChanged: false,
      urlChanged: false,
      parentChanged: false
    }
  }

  const titleChanged = String(input.draftTitle || '') !== String(bookmark.title || '')
  const urlChanged = String(input.draftUrl || '') !== String(bookmark.url || '')
  const parentChanged = normalizeParentId(input.draftParentId) !== normalizeParentId(bookmark.parentId)

  return {
    dirty: titleChanged || urlChanged || parentChanged,
    titleChanged,
    urlChanged,
    parentChanged
  }
}

export function getPopupEditBookmarkSavePlan(
  input: PopupEditBookmarkDraftInput
): PopupEditBookmarkSavePlan {
  const state = getPopupEditBookmarkDraftState(input)
  const title = String(input.draftTitle || '').trim() || '未命名书签'
  const url = String(input.draftUrl || '').trim()
  const parentId = normalizeParentId(input.draftParentId)

  return {
    ...state,
    updateChanges: state.titleChanged || state.urlChanged ? { title, url } : null,
    parentId
  }
}

function normalizeParentId(parentId: unknown): string {
  return String(parentId || '').trim()
}
