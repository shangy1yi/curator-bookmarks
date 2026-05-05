import type { NavigationNetworkEvidence, NavigationStatus } from './types.js'
import type { BookmarkTagAnalysisInput } from './bookmark-tags.js'

export interface NavigationCheckMessage {
  type: 'availability:navigate'
  url: string
  timeoutMs?: number
  checkId?: string
}

export interface NavigationCancelMessage {
  type: 'availability:cancel'
  checkId: string
}

export interface BookmarkSaveMessage {
  type: 'bookmark:save'
  url: string
  title: string
  parentId?: string
  folderPath?: string
  bookmarkId?: string
  analysis?: BookmarkTagAnalysisInput
}

export interface InboxUndoLastMoveMessage {
  type: 'inbox:undo-last-move'
}

export interface RuntimeNotificationMessage {
  type: 'notification:create'
  notificationId: string
  title: string
  message: string
  contextMessage?: string
  priority?: number
  requireInteraction?: boolean
  silent?: boolean
}

export interface NavigationCheckResult {
  status: NavigationStatus
  finalUrl: string
  detail: string
  errorCode: string
  networkEvidence?: NavigationNetworkEvidence
}

export interface BookmarkSaveResult {
  bookmarkId: string
  parentId: string
  title: string
  url: string
  created: boolean
}

export interface InboxUndoLastMoveResult {
  bookmarkId: string
  parentId: string
  title: string
}

interface RuntimeMessageResponse<TResult = unknown> {
  ok: boolean
  result?: TResult
  error?: string
}

export function requestNavigationCheck(
  url: string,
  timeoutMs?: number,
  checkId?: string
): Promise<NavigationCheckResult> {
  const message: NavigationCheckMessage = { type: 'availability:navigate', url, timeoutMs, checkId }
  return sendRuntimeMessage<NavigationCheckResult>(message)
}

export function cancelNavigationCheck(checkId: string): Promise<void> {
  const message: NavigationCancelMessage = { type: 'availability:cancel', checkId }
  return sendRuntimeMessage<void>(message)
}

export function requestBookmarkSave(payload: Omit<BookmarkSaveMessage, 'type'>): Promise<BookmarkSaveResult> {
  const message: BookmarkSaveMessage = { type: 'bookmark:save', ...payload }
  return sendRuntimeMessage<BookmarkSaveResult>(message)
}

export function requestInboxUndoLastMove(): Promise<InboxUndoLastMoveResult> {
  const message: InboxUndoLastMoveMessage = { type: 'inbox:undo-last-move' }
  return sendRuntimeMessage<InboxUndoLastMoveResult>(message)
}

export function requestRuntimeNotification(
  payload: Omit<RuntimeNotificationMessage, 'type'>
): Promise<void> {
  const message: RuntimeNotificationMessage = { type: 'notification:create', ...payload }
  return sendRuntimeMessage<void>(message)
}

function sendRuntimeMessage<TResult>(message: unknown): Promise<TResult> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: RuntimeMessageResponse<TResult>) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      if (!response?.ok) {
        reject(new Error(response?.error || '后台操作失败。'))
        return
      }

      resolve(response.result as TResult)
    })
  })
}
