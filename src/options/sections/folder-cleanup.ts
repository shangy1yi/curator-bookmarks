import { STORAGE_KEYS } from '../../shared/constants.js'
import { createAutoBackupBeforeDangerousOperation } from '../../shared/backup.js'
import { createBookmark, getBookmarkTree, moveBookmark, removeBookmarkTree } from '../../shared/bookmarks-api.js'
import type { BookmarkTagIndex } from '../../shared/bookmark-tags.js'
import { setLocalStorage } from '../../shared/storage.js'
import {
  analyzeFolderCleanup,
  createFolderCleanupSplitUndo,
  normalizeFolderCleanupSplitUndo,
  type FolderCleanupOperationKind,
  type FolderCleanupSplitUndo,
  type FolderCleanupSplitUndoMove,
  type FolderCleanupSuggestion
} from '../../shared/folder-cleanup.js'
import { availabilityState, aiNamingState, folderCleanupState, managerState } from '../shared-options/state.js'
import { dom } from '../shared-options/dom.js'
import { escapeHtml, escapeAttr } from '../shared-options/html.js'
import { formatDateTime, isInteractionLocked } from '../shared-options/utils.js'

interface FolderCleanupCallbacks {
  confirm: (options?: {
    title?: string
    copy?: string
    confirmLabel?: string
    cancelLabel?: string
    tone?: string
    label?: string
  }) => Promise<boolean>
  hydrateAvailabilityCatalog: (options?: {
    preserveResults?: boolean
    analyzeFolderCleanup?: boolean
  }) => Promise<void>
  renderAvailabilitySection: () => void
}

const KIND_LABELS = {
  'empty-folder': '空文件夹',
  'deep-single-bookmark': '深层单书签',
  'single-path-chain': '单一路径',
  'same-name-folders': '同名合并',
  'large-folder-split': '超大拆分'
}

const OPERATION_BACKUP_KIND = {
  delete: 'folder-cleanup-delete',
  move: 'folder-cleanup-move',
  merge: 'folder-cleanup-merge',
  split: 'folder-cleanup-move',
  preview: 'folder-cleanup-move'
} as const

export function hydrateFolderCleanupState(rawState) {
  if (!rawState || typeof rawState !== 'object') {
    return
  }

  folderCleanupState.lastAnalyzedAt = Number(rawState.lastAnalyzedAt) || 0
  folderCleanupState.statusMessage = String(rawState.statusMessage || '').trim()
  folderCleanupState.lastSplitUndo = normalizeFolderCleanupSplitUndo(rawState.lastSplitUndo)
}

export async function analyzeFolderCleanupSuggestions(callbacks: FolderCleanupCallbacks) {
  if (!folderCleanupState.rootNode || folderCleanupState.running || folderCleanupState.executing) {
    return
  }

  await runFolderCleanupAnalysis(callbacks, { refreshCatalog: false })
}

export async function rescanFolderCleanupSuggestions(callbacks: FolderCleanupCallbacks) {
  if (folderCleanupState.running || folderCleanupState.executing) {
    return
  }

  await runFolderCleanupAnalysis(callbacks, { refreshCatalog: true })
}

async function runFolderCleanupAnalysis(
  callbacks: FolderCleanupCallbacks,
  options: { refreshCatalog: boolean }
) {
  if (!options.refreshCatalog && !folderCleanupState.rootNode) {
    return
  }

  folderCleanupState.running = true
  folderCleanupState.statusMessage = options.refreshCatalog
    ? '正在重新读取 Chrome 书签树…'
    : '正在扫描文件夹结构…'
  renderFolderCleanupSection(callbacks)

  try {
    if (options.refreshCatalog) {
      await callbacks.hydrateAvailabilityCatalog({
        preserveResults: true,
        analyzeFolderCleanup: false
      })
      folderCleanupState.executedSuggestionIds.clear()
    }

    if (!folderCleanupState.rootNode) {
      folderCleanupState.suggestions = []
      folderCleanupState.lastAnalyzedAt = 0
      folderCleanupState.statusMessage = '暂未读取到书签树，请稍后重试。'
      await persistFolderCleanupState()
      return
    }

    folderCleanupState.suggestions = analyzeFolderCleanup(folderCleanupState.rootNode, {
      tagIndex: aiNamingState.tagIndex as BookmarkTagIndex,
      reservedFolderTitles: getReservedFolderCleanupTitles()
    })
    folderCleanupState.lastAnalyzedAt = Date.now()
    folderCleanupState.statusMessage = folderCleanupState.suggestions.length
      ? `已生成 ${folderCleanupState.suggestions.length} 条建议。`
      : '未发现需要清理的文件夹。'
    await persistFolderCleanupState()
  } catch (error) {
    folderCleanupState.statusMessage = error instanceof Error
      ? `文件夹扫描失败：${error.message}`
      : '文件夹扫描失败，请刷新页面后重试。'
  } finally {
    folderCleanupState.running = false
    renderFolderCleanupSection(callbacks)
  }
}

export function renderFolderCleanupSection(callbacks: FolderCleanupCallbacks) {
  if (!dom.folderCleanupResults) {
    return
  }

  const suggestions = folderCleanupState.suggestions.filter((suggestion) => (
    !folderCleanupState.executedSuggestionIds.has(suggestion.id)
  ))
  const summary = summarizeSuggestions(suggestions)
  const locked = isInteractionLocked() || folderCleanupState.running || folderCleanupState.executing

  setText(dom.folderCleanupSummaryTotal, String(suggestions.length))
  setText(dom.folderCleanupSummaryEmpty, String(summary.empty))
  setText(dom.folderCleanupSummaryDeep, String(summary.deep))
  setText(dom.folderCleanupSummarySameName, String(summary.sameName))
  setText(dom.folderCleanupSummaryLarge, String(summary.large))
  setText(dom.folderCleanupCount, `${suggestions.length} 条建议`)

  if (dom.folderCleanupStatus) {
    dom.folderCleanupStatus.className = `options-chip ${folderCleanupState.running ? 'warning' : suggestions.length ? 'success' : 'muted'}`
    dom.folderCleanupStatus.textContent = getStatusText(suggestions.length)
  }

  if (dom.folderCleanupAnalyze) {
    dom.folderCleanupAnalyze.disabled = locked || availabilityState.catalogLoading
    dom.folderCleanupAnalyze.textContent = folderCleanupState.running ? '扫描中…' : '重新扫描'
  }

  if (dom.folderCleanupResultsSubtitle) {
    dom.folderCleanupResultsSubtitle.textContent = folderCleanupState.lastAnalyzedAt
      ? `上次扫描：${formatDateTime(folderCleanupState.lastAnalyzedAt)}。删除、合并、移动和拆分都会先确认并触发自动备份 hook；拆分会记录本次撤销信息。`
      : '所有建议默认只预览，不会自动修改书签。'
  }

  if (availabilityState.catalogLoading) {
    dom.folderCleanupResults.innerHTML = '<div class="detect-empty">正在读取书签树，请稍候…</div>'
    return
  }

  if (!folderCleanupState.rootNode) {
    dom.folderCleanupResults.innerHTML = '<div class="detect-empty">暂未读取到书签树，请刷新页面后重试。</div>'
    return
  }

  const splitUndoNotice = folderCleanupState.lastSplitUndo
    ? buildSplitUndoNotice(folderCleanupState.lastSplitUndo, locked)
    : ''

  if (!suggestions.length) {
    dom.folderCleanupResults.innerHTML = splitUndoNotice ||
      `<div class="detect-empty">${escapeHtml(folderCleanupState.statusMessage || '当前未发现需要清理的文件夹。')}</div>`
    return
  }

  dom.folderCleanupResults.innerHTML = `${splitUndoNotice}${suggestions.map((suggestion) => buildSuggestionCard(suggestion, locked)).join('')}`
}

export async function handleFolderCleanupClick(event: Event, callbacks: FolderCleanupCallbacks) {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  const actionButton = target.closest('[data-folder-cleanup-action]') as HTMLElement | null
  const undoButton = target.closest('[data-folder-cleanup-undo-split]') as HTMLElement | null
  if (undoButton) {
    await handleSplitUndoClick(callbacks)
    return
  }

  if (!actionButton || folderCleanupState.running || folderCleanupState.executing || isInteractionLocked()) {
    return
  }

  const suggestionId = String(actionButton.getAttribute('data-folder-cleanup-action') || '')
  const suggestion = folderCleanupState.suggestions.find((item) => item.id === suggestionId)
  if (!suggestion || !suggestion.canExecute) {
    return
  }

  const confirmed = await callbacks.confirm({
    title: getConfirmTitle(suggestion),
    copy: getConfirmCopy(suggestion),
    confirmLabel: getConfirmLabel(suggestion.operation),
    tone: suggestion.severity === 'danger' ? 'danger' : 'warning',
    label: '文件夹清理'
  })
  if (!confirmed) {
    return
  }

  await executeFolderCleanupSuggestion(suggestion, callbacks)
}

async function executeFolderCleanupSuggestion(
  suggestion: FolderCleanupSuggestion,
  callbacks: FolderCleanupCallbacks
) {
  folderCleanupState.executing = true
  folderCleanupState.statusMessage = '正在执行清理操作…'
  renderFolderCleanupSection(callbacks)

  let splitUndo: FolderCleanupSplitUndo | null = null

  try {
    await createAutoBackupBeforeDangerousOperation({
      kind: OPERATION_BACKUP_KIND[suggestion.operation],
      source: 'options',
      reason: suggestion.title,
      targetBookmarkIds: suggestion.bookmarkIds,
      targetFolderIds: suggestion.folderIds,
      estimatedChangeCount: Math.max(suggestion.bookmarkIds.length, suggestion.folderIds.length)
    })

    if (suggestion.operation === 'delete') {
      await deleteFolders(suggestion.folderIds)
    } else if (suggestion.operation === 'move') {
      await moveBookmarksAndRemoveFolders(suggestion)
    } else if (suggestion.operation === 'merge') {
      await mergeFolders(suggestion)
    } else if (suggestion.operation === 'split') {
      splitUndo = await splitLargeFolder(suggestion)
    }

    if (splitUndo) {
      folderCleanupState.lastSplitUndo = splitUndo
    }
    folderCleanupState.executedSuggestionIds.add(suggestion.id)
    folderCleanupState.statusMessage = splitUndo
      ? '拆分已完成，已记录本次移动；可在建议区撤销本次拆分。'
      : '清理操作已完成。'
    await callbacks.hydrateAvailabilityCatalog({ preserveResults: true })
    if (folderCleanupState.rootNode) {
      folderCleanupState.suggestions = analyzeFolderCleanup(folderCleanupState.rootNode, {
        tagIndex: aiNamingState.tagIndex as BookmarkTagIndex,
        reservedFolderTitles: getReservedFolderCleanupTitles()
      })
      folderCleanupState.lastAnalyzedAt = Date.now()
      await persistFolderCleanupState()
    }
  } catch (error) {
    folderCleanupState.statusMessage = error instanceof Error
      ? `清理失败：${error.message}`
      : '清理失败，请刷新页面后重试。'
  } finally {
    folderCleanupState.executing = false
    callbacks.renderAvailabilitySection()
  }
}

async function deleteFolders(folderIds: string[]) {
  for (const folderId of sortFolderIdsDeepFirst(folderIds)) {
    await removeBookmarkTree(folderId)
  }
}

async function moveBookmarksAndRemoveFolders(suggestion: FolderCleanupSuggestion) {
  const targetFolderId = String(suggestion.targetFolderId || '').trim()
  if (!targetFolderId) {
    throw new Error('缺少移动目标文件夹。')
  }

  for (const bookmarkId of suggestion.bookmarkIds) {
    await moveBookmark(bookmarkId, targetFolderId)
  }
  await deleteFolders(suggestion.folderIds)
}

async function mergeFolders(suggestion: FolderCleanupSuggestion) {
  const targetFolderId = String(suggestion.targetFolderId || '').trim()
  if (!targetFolderId) {
    throw new Error('缺少合并目标文件夹。')
  }

  const sourceFolderIds = suggestion.folderIds.filter((folderId) => folderId !== targetFolderId)
  for (const bookmarkId of suggestion.bookmarkIds) {
    await moveBookmark(bookmarkId, targetFolderId)
  }
  await deleteFolders(sourceFolderIds)
}

async function splitLargeFolder(suggestion: FolderCleanupSuggestion) {
  const targetFolderId = String(suggestion.targetFolderId || suggestion.primaryFolderId || '').trim()
  if (!targetFolderId || !suggestion.splitGroups?.length) {
    throw new Error('缺少拆分目标。')
  }

  const createdFolderIds: string[] = []
  try {
    for (const group of suggestion.splitGroups) {
      const folder = await createBookmark({
        parentId: targetFolderId,
        title: sanitizeFolderTitle(group.label)
      })
      createdFolderIds.push(String(folder.id))
    }
  } catch (error) {
    await deleteFolders(createdFolderIds).catch(() => undefined)
    throw error
  }

  const splitUndo = createFolderCleanupSplitUndo(suggestion, createdFolderIds)
  if (!splitUndo) {
    await deleteFolders(createdFolderIds)
    throw new Error('无法记录拆分前位置，已停止拆分。')
  }

  folderCleanupState.lastSplitUndo = splitUndo
  await persistFolderCleanupState()

  for (const [groupIndex, group] of suggestion.splitGroups.entries()) {
    const folderId = createdFolderIds[groupIndex]
    for (const bookmarkId of group.bookmarkIds) {
      await moveBookmark(bookmarkId, folderId)
    }
  }

  return splitUndo
}

async function handleSplitUndoClick(callbacks: FolderCleanupCallbacks) {
  if (folderCleanupState.running || folderCleanupState.executing || isInteractionLocked()) {
    return
  }

  const splitUndo = folderCleanupState.lastSplitUndo
  if (!splitUndo) {
    return
  }

  const confirmed = await callbacks.confirm({
    title: '撤销本次拆分？',
    copy: [
      `将把 ${splitUndo.moves.length} 个书签移回拆分前的位置，并删除本次新建的 ${splitUndo.createdFolderIds.length} 个拆分文件夹。`,
      '撤销前会先调用自动备份 hook；如果新建文件夹里已有额外内容，会保留该文件夹避免误删。'
    ].join('\n'),
    confirmLabel: '撤销本次拆分',
    tone: 'warning',
    label: '文件夹清理'
  })
  if (!confirmed) {
    return
  }

  await undoFolderCleanupSplit(splitUndo, callbacks)
}

async function undoFolderCleanupSplit(
  splitUndo: FolderCleanupSplitUndo,
  callbacks: FolderCleanupCallbacks
) {
  folderCleanupState.executing = true
  folderCleanupState.statusMessage = '正在撤销本次拆分…'
  renderFolderCleanupSection(callbacks)

  try {
    await createAutoBackupBeforeDangerousOperation({
      kind: 'folder-cleanup-move',
      source: 'options',
      reason: `撤销拆分：${splitUndo.title}`,
      targetBookmarkIds: splitUndo.moves.map((move) => move.bookmarkId),
      targetFolderIds: [splitUndo.targetFolderId, ...splitUndo.createdFolderIds].filter(Boolean),
      estimatedChangeCount: splitUndo.moves.length + splitUndo.createdFolderIds.length
    })

    for (const move of sortSplitUndoMoves(splitUndo.moves)) {
      await restoreSplitUndoMove(move)
    }

    const retainedFolderCount = await removeEmptySplitFolders(splitUndo.createdFolderIds)
    folderCleanupState.lastSplitUndo = null
    folderCleanupState.executedSuggestionIds.delete(splitUndo.suggestionId)
    folderCleanupState.statusMessage = retainedFolderCount
      ? `已撤销本次拆分；${retainedFolderCount} 个新建文件夹仍有额外内容，已保留。`
      : '已撤销本次拆分，书签已移回拆分前位置。'

    await callbacks.hydrateAvailabilityCatalog({ preserveResults: true })
    if (folderCleanupState.rootNode) {
      folderCleanupState.suggestions = analyzeFolderCleanup(folderCleanupState.rootNode, {
        tagIndex: aiNamingState.tagIndex as BookmarkTagIndex,
        reservedFolderTitles: getReservedFolderCleanupTitles()
      })
      folderCleanupState.lastAnalyzedAt = Date.now()
    }
    await persistFolderCleanupState()
  } catch (error) {
    folderCleanupState.statusMessage = error instanceof Error
      ? `撤销拆分失败：${error.message}`
      : '撤销拆分失败，请稍后重试。'
  } finally {
    folderCleanupState.executing = false
    callbacks.renderAvailabilitySection()
    renderFolderCleanupSection(callbacks)
  }
}

async function restoreSplitUndoMove(move: FolderCleanupSplitUndoMove) {
  if (!move.fromParentId) {
    throw new Error(`书签 ${move.bookmarkId} 缺少原父级，无法撤销。`)
  }

  if (Number.isFinite(move.fromIndex)) {
    try {
      await moveBookmark(move.bookmarkId, move.fromParentId, move.fromIndex)
      return
    } catch {
      await moveBookmark(move.bookmarkId, move.fromParentId)
      return
    }
  }

  await moveBookmark(move.bookmarkId, move.fromParentId)
}

function sortSplitUndoMoves(moves: FolderCleanupSplitUndoMove[]): FolderCleanupSplitUndoMove[] {
  return moves.slice().sort((left, right) => (
    String(left.fromParentId).localeCompare(String(right.fromParentId), 'zh-CN') ||
    (Number(left.fromIndex) || 0) - (Number(right.fromIndex) || 0)
  ))
}

async function removeEmptySplitFolders(folderIds: string[]): Promise<number> {
  const roots = await getBookmarkTree()
  let retainedFolderCount = 0

  for (const folderId of folderIds) {
    const node = findBookmarkTreeNode(roots, folderId)
    if (!node) {
      continue
    }
    if (node.url || (node.children || []).length > 0) {
      retainedFolderCount += 1
      continue
    }
    await removeBookmarkTree(folderId)
  }

  return retainedFolderCount
}

function findBookmarkTreeNode(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  targetId: string
): chrome.bookmarks.BookmarkTreeNode | null {
  const queue = nodes.slice()
  while (queue.length) {
    const node = queue.shift()
    if (!node) {
      continue
    }
    if (String(node.id) === String(targetId)) {
      return node
    }
    queue.push(...(node.children || []))
  }
  return null
}

function buildSplitUndoNotice(splitUndo: FolderCleanupSplitUndo, locked: boolean): string {
  const undoLabel = getFolderCleanupSplitUndoActionLabel('撤销本次拆分', splitUndo)

  return `
    <article class="detect-result-card folder-cleanup-undo-card">
      <div class="detect-result-head">
        <span class="options-chip warning">可撤销拆分</span>
        <div class="detect-result-actions">
          <button
            class="detect-result-action"
            type="button"
            data-folder-cleanup-undo-split="${escapeAttr(splitUndo.id)}"
            aria-label="${escapeAttr(undoLabel)}"
            ${locked ? 'disabled' : ''}
          >撤销本次拆分</button>
        </div>
      </div>
      <div class="detect-result-copy">
        <strong>${escapeHtml(splitUndo.title)}</strong>
        <p class="detect-result-detail">已记录 ${splitUndo.moves.length} 个书签的拆分前位置。撤销会先确认并触发自动备份 hook，然后移回书签并删除本次新建的空拆分文件夹。</p>
      </div>
    </article>
  `
}

export function getFolderCleanupSuggestionActionLabel(
  action: string,
  suggestion: Pick<FolderCleanupSuggestion, 'title' | 'summary'>
): string {
  const context = getFolderCleanupActionContext(suggestion?.title || suggestion?.summary, '未命名清理建议')
  return `${action}：${context}`
}

export function getFolderCleanupSplitUndoActionLabel(
  action: string,
  splitUndo: Pick<FolderCleanupSplitUndo, 'title' | 'moves'>
): string {
  const context = getFolderCleanupActionContext(splitUndo?.title, '拆分超大文件夹')
  const moveCount = Array.isArray(splitUndo?.moves) ? splitUndo.moves.length : 0
  return `${action}：${context}${moveCount ? `，${moveCount} 个书签` : ''}`
}

function getFolderCleanupActionContext(value: unknown, fallback: string): string {
  const normalized = String(value || fallback)
    .replace(/\s+/g, ' ')
    .trim()
  const safeValue = normalized.length > 48
    ? `${normalized.slice(0, 47).trim()}…`
    : normalized

  return safeValue || fallback
}

function buildSuggestionCard(suggestion: FolderCleanupSuggestion, locked: boolean): string {
  const previewOpen = folderCleanupState.selectedSuggestionId === suggestion.id
  const operationCopy = getOperationCopy(suggestion)
  const previewLabel = getFolderCleanupSuggestionActionLabel(
    previewOpen ? '收起文件夹清理预览' : '查看文件夹清理预览',
    suggestion
  )
  const operationLabel = getFolderCleanupSuggestionActionLabel(operationCopy, suggestion)
  const splitPreview = suggestion.splitGroups?.length
    ? `<div class="folder-cleanup-split-preview">${suggestion.splitGroups.map((group) => `
        <span class="options-chip muted">${escapeHtml(group.label)} · ${group.count}</span>
      `).join('')}</div>`
    : ''
  const bookmarkPreview = suggestion.bookmarks.length
    ? `<p class="detect-result-detail">涉及书签：${escapeHtml(suggestion.bookmarks.slice(0, 4).map((bookmark) => bookmark.title).join('、'))}${suggestion.bookmarks.length > 4 ? '…' : ''}</p>`
    : ''

  return `
    <article class="detect-result-card folder-cleanup-card">
      <div class="detect-result-head">
        <span class="options-chip ${suggestion.severity === 'danger' ? 'danger' : suggestion.severity === 'warning' ? 'warning' : 'muted'}">${escapeHtml(KIND_LABELS[suggestion.kind])}</span>
        <div class="detect-result-actions">
          <button
            class="detect-result-action"
            type="button"
            data-folder-cleanup-preview="${escapeAttr(suggestion.id)}"
            aria-label="${escapeAttr(previewLabel)}"
          >${previewOpen ? '收起预览' : '查看预览'}</button>
          <button
            class="detect-result-action ${suggestion.severity === 'danger' ? 'danger' : ''}"
            type="button"
            data-folder-cleanup-action="${escapeAttr(suggestion.id)}"
            aria-label="${escapeAttr(operationLabel)}"
            ${locked || !suggestion.canExecute ? 'disabled' : ''}
          >${escapeHtml(operationCopy)}</button>
        </div>
      </div>
      <div class="detect-result-copy">
        <strong>${escapeHtml(suggestion.title)}</strong>
        <p class="detect-result-path">${escapeHtml(suggestion.summary)}</p>
        <p class="detect-result-detail">${escapeHtml(suggestion.reason)}</p>
        ${bookmarkPreview}
        ${splitPreview}
        <div class="folder-cleanup-preview ${previewOpen ? '' : 'hidden'}">
          ${suggestion.folders.map((folder) => `
            <div class="folder-cleanup-preview-row">
              <strong>${escapeHtml(folder.path || folder.title)}</strong>
              <span>${folder.descendantBookmarkCount} 个书签 · ${folder.depth} 层</span>
            </div>
          `).join('')}
        </div>
      </div>
    </article>
  `
}

export function handleFolderCleanupPreviewClick(event: Event, callbacks: FolderCleanupCallbacks) {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  const previewButton = target.closest('[data-folder-cleanup-preview]') as HTMLElement | null
  if (!previewButton) {
    return
  }

  const suggestionId = String(previewButton.getAttribute('data-folder-cleanup-preview') || '')
  folderCleanupState.selectedSuggestionId =
    folderCleanupState.selectedSuggestionId === suggestionId ? '' : suggestionId
  renderFolderCleanupSection(callbacks)
}

function summarizeSuggestions(suggestions: FolderCleanupSuggestion[]) {
  return {
    empty: suggestions.filter((suggestion) => suggestion.kind === 'empty-folder').length,
    deep: suggestions.filter((suggestion) => suggestion.kind === 'deep-single-bookmark' || suggestion.kind === 'single-path-chain').length,
    sameName: suggestions.filter((suggestion) => suggestion.kind === 'same-name-folders').length,
    large: suggestions.filter((suggestion) => suggestion.kind === 'large-folder-split').length
  }
}

function getStatusText(visibleSuggestionCount: number): string {
  if (folderCleanupState.running) {
    return '扫描中'
  }
  if (folderCleanupState.executing) {
    return '执行中'
  }
  if (folderCleanupState.lastAnalyzedAt) {
    return visibleSuggestionCount ? '有建议' : '已扫描'
  }
  return visibleSuggestionCount ? '有建议' : '未扫描'
}

function getReservedFolderCleanupTitles(): string[] {
  const inboxTitle = String(managerState.inboxSettings?.folderTitle || '').trim()
  return inboxTitle ? [inboxTitle] : []
}

function getOperationCopy(suggestion: FolderCleanupSuggestion): string {
  if (!suggestion.canExecute) {
    return '仅预览'
  }
  if (suggestion.operation === 'delete') {
    return '确认删除'
  }
  if (suggestion.operation === 'merge') {
    return '确认合并'
  }
  if (suggestion.operation === 'split') {
    return '确认拆分'
  }
  return '确认移动'
}

function getConfirmLabel(operation: FolderCleanupOperationKind): string {
  if (operation === 'delete') {
    return '删除文件夹'
  }
  if (operation === 'merge') {
    return '合并文件夹'
  }
  if (operation === 'split') {
    return '拆分文件夹'
  }
  return '移动书签'
}

function getConfirmTitle(suggestion: FolderCleanupSuggestion): string {
  return `确认${getConfirmLabel(suggestion.operation)}？`
}

function getConfirmCopy(suggestion: FolderCleanupSuggestion): string {
  const target = suggestion.targetFolderId
    ? suggestion.folders.find((folder) => folder.id === suggestion.targetFolderId)?.path || '目标文件夹'
    : ''
  const splitUndoCopy = suggestion.operation === 'split'
    ? '拆分完成后会显示“撤销本次拆分”，可把本次移动的书签移回拆分前位置。'
    : ''
  return [
    suggestion.summary,
    target ? `目标：${target}` : '',
    `涉及 ${suggestion.folderIds.length} 个文件夹、${suggestion.bookmarkIds.length} 个书签。执行前会调用自动备份 hook。`,
    splitUndoCopy
  ].filter(Boolean).join('\n')
}

function sortFolderIdsDeepFirst(folderIds: string[]): string[] {
  const depthById = new Map(folderCleanupState.suggestions
    .flatMap((suggestion) => suggestion.folders)
    .map((folder) => [folder.id, folder.depth]))

  return folderIds.slice().sort((left, right) => (
    (depthById.get(right) || 0) - (depthById.get(left) || 0)
  ))
}

async function persistFolderCleanupState() {
  await setLocalStorage({
    [STORAGE_KEYS.folderCleanupState]: {
      version: 1,
      lastAnalyzedAt: folderCleanupState.lastAnalyzedAt,
      statusMessage: folderCleanupState.statusMessage,
      lastSplitUndo: folderCleanupState.lastSplitUndo
    }
  })
}

function sanitizeFolderTitle(title: string): string {
  return String(title || '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || '拆分分组'
}

function setText(element, value: string) {
  if (element) {
    element.textContent = value
  }
}
