import {
  BOOKMARKS_BAR_ID,
  RECYCLE_BIN_LIMIT
} from '../../shared/constants.js'
import { createBookmark } from '../../shared/bookmarks-api.js'
import {
  appendRecycleEntries,
  deleteBookmarkToRecycle,
  loadRecycleBinEntries,
  mergeRecycleEntries,
  removeRecycleEntries,
  type RecycleEntry
} from '../../shared/recycle-bin.js'
import { createAutoBackupBeforeDangerousOperation, type DangerousOperationKind } from '../../shared/backup.js'
import { displayUrl } from '../../shared/text.js'
import { availabilityState, managerState } from '../shared-options/state.js'
import { dom } from '../shared-options/dom.js'
import { escapeHtml, escapeAttr } from '../shared-options/html.js'
import { syncSelectionSet, formatDateTime } from '../shared-options/utils.js'

export function normalizeRecycleBin(rawEntries) {
  if (!Array.isArray(rawEntries)) {
    return []
  }

  return rawEntries
    .map((entry) => {
      return {
        recycleId: String(entry?.recycleId || '').trim(),
        bookmarkId: String(entry?.bookmarkId || '').trim(),
        title: String(entry?.title || '未命名书签').trim() || '未命名书签',
        url: String(entry?.url || '').trim(),
        parentId: String(entry?.parentId || '').trim(),
        index: Number.isFinite(Number(entry?.index)) ? Number(entry.index) : 0,
        path: String(entry?.path || '').trim(),
        source: String(entry?.source || '删除').trim() || '删除',
        deletedAt: Number(entry?.deletedAt) || Date.now()
      }
    })
    .filter((entry) => entry.recycleId && entry.url)
    .sort((left, right) => right.deletedAt - left.deletedAt)
}

export function getRecycleEntryActionLabel(action, entry) {
  const title = String(entry?.title || displayUrl(entry?.url) || '未命名书签')
    .replace(/\s+/g, ' ')
    .trim()
  const safeTitle = title.length > 48 ? `${title.slice(0, 47).trim()}…` : title

  return `${action}：${safeTitle || '未命名书签'}`
}

export async function saveRecycleBin() {
  const nextEntries = mergeRecycleEntries(managerState.recycleBin as RecycleEntry[])
  managerState.recycleBin = nextEntries
  await appendRecycleEntries(nextEntries)
  await refreshRecycleBinState()
}

function buildRecycleEntry(bookmark, source) {
  return {
    recycleId: `recycle-${bookmark.id}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    bookmarkId: String(bookmark.id),
    title: bookmark.title || '未命名书签',
    url: bookmark.url,
    parentId: String(bookmark.parentId || ''),
    index: Number.isFinite(Number(bookmark.index)) ? Number(bookmark.index) : 0,
    path: bookmark.path || '',
    source,
    deletedAt: Date.now()
  }
}

export function renderRecycleSection(callbacks) {
  if (!dom.recycleResults) {
    return
  }

  syncSelectionSet(
    managerState.selectedRecycleIds,
    new Set(managerState.recycleBin.map((entry) => String(entry.recycleId)))
  )

  dom.recycleCount.textContent = `${managerState.recycleBin.length} 条回收站条目`
  dom.recycleSelectionGroup.classList.toggle('hidden', managerState.selectedRecycleIds.size === 0)
  dom.recycleSelectionCount.textContent = `${managerState.selectedRecycleIds.size} 条已选择`
  dom.recycleRestoreSelection.disabled = availabilityState.deleting || managerState.selectedRecycleIds.size === 0
  dom.recycleClearSelected.disabled = availabilityState.deleting || managerState.selectedRecycleIds.size === 0
  dom.recycleSelectAll.disabled = managerState.recycleBin.length === 0
  dom.recycleClearAll.disabled = managerState.recycleBin.length === 0 || availabilityState.deleting

  if (!managerState.recycleBin.length) {
    dom.recycleResults.innerHTML = '<div class="detect-empty">回收站当前为空。</div>'
    return
  }

  dom.recycleResults.innerHTML = managerState.recycleBin
    .map((entry) => buildRecycleEntryCard(entry))
    .join('')
}

function buildRecycleEntryCard(entry) {
  const selected = managerState.selectedRecycleIds.has(String(entry.recycleId))
  const selectionLabel = getRecycleEntryActionLabel('选择回收站书签', entry)
  const restoreLabel = getRecycleEntryActionLabel('恢复书签', entry)
  const clearLabel = getRecycleEntryActionLabel('清除回收站记录', entry)

  return `
    <article class="detect-result-card ${selected ? 'selected' : ''}">
      <div class="detect-result-head">
        <div class="detect-result-head-left">
          <label class="detect-result-check">
            <input
              type="checkbox"
              data-recycle-select="true"
              data-recycle-id="${escapeAttr(entry.recycleId)}"
              aria-label="${escapeAttr(selectionLabel)}"
              ${selected ? 'checked' : ''}
              ${availabilityState.deleting ? 'disabled' : ''}
            >
            <span>选择</span>
          </label>
          <span class="options-chip muted">回收站</span>
        </div>
        <div class="detect-result-actions">
          <button
            class="detect-result-action"
            type="button"
            data-recycle-restore="${escapeAttr(entry.recycleId)}"
            aria-label="${escapeAttr(restoreLabel)}"
            ${availabilityState.deleting ? 'disabled' : ''}
          >
            恢复书签
          </button>
          <button
            class="detect-result-action danger"
            type="button"
            data-recycle-clear="${escapeAttr(entry.recycleId)}"
            aria-label="${escapeAttr(clearLabel)}"
            ${availabilityState.deleting ? 'disabled' : ''}
          >
            清除
          </button>
        </div>
      </div>
      <div class="detect-result-copy">
        <strong>${escapeHtml(entry.title || '未命名书签')}</strong>
        <div class="detect-result-url">${escapeHtml(displayUrl(entry.url))}</div>
        <div class="detect-result-detail">来源：${escapeHtml(entry.source || '删除')} · 删除于 ${escapeHtml(formatDateTime(entry.deletedAt))}</div>
        <div class="detect-result-path" title="${escapeAttr(entry.path || '未归档路径')}">${escapeHtml(entry.path || '未归档路径')}</div>
      </div>
    </article>
  `
}

export function handleRecycleResultsClick(event, callbacks) {
  const selectionInput = event.target.closest('input[data-recycle-select]')
  if (selectionInput) {
    const recycleId = String(selectionInput.getAttribute('data-recycle-id') || '').trim()
    if (selectionInput.checked) {
      managerState.selectedRecycleIds.add(recycleId)
    } else {
      managerState.selectedRecycleIds.delete(recycleId)
    }
    callbacks.renderAvailabilitySection()
    return
  }

  const clearButton = event.target.closest('[data-recycle-clear]')
  if (clearButton && !availabilityState.deleting) {
    clearRecycleEntriesByIds(
      [String(clearButton.getAttribute('data-recycle-clear') || '').trim()],
      callbacks
    )
    return
  }

  const restoreButton = event.target.closest('[data-recycle-restore]')
  if (!restoreButton || availabilityState.deleting) {
    return
  }

  restoreRecycleEntriesByIds(
    [String(restoreButton.getAttribute('data-recycle-restore') || '').trim()],
    callbacks
  )
}

export function clearRecycleSelection(callbacks) {
  managerState.selectedRecycleIds.clear()
  callbacks.renderAvailabilitySection()
}

async function clearRecycleEntriesByIds(recycleIds, callbacks) {
  const targetSet = new Set<string>(recycleIds.map((id) => String(id)).filter(Boolean))
  const targetEntries = managerState.recycleBin.filter((entry) => {
    return targetSet.has(String(entry.recycleId))
  })

  if (!targetEntries.length || availabilityState.deleting) {
    return
  }

  const confirmed = callbacks.confirm
    ? await callbacks.confirm({
        title: targetEntries.length === 1
          ? '清除这条回收站记录？'
          : `清除 ${targetEntries.length} 条回收站记录？`,
        copy: '这只会从扩展回收站中移除记录，之后无法再从扩展内恢复；不会再次修改 Chrome 书签。',
        confirmLabel: '清除记录',
        label: '清除回收站记录',
        tone: 'danger'
      })
    : true
  if (!confirmed) {
    return
  }

  managerState.recycleBin = managerState.recycleBin.filter((entry) => {
    return !targetSet.has(String(entry.recycleId))
  })
  for (const recycleId of targetSet) {
    managerState.selectedRecycleIds.delete(recycleId)
  }
  await removeRecycleEntries([...targetSet])
  await refreshRecycleBinState()
  availabilityState.lastError = targetEntries.length === 1
    ? '已清除 1 条回收站记录。'
    : `已清除 ${targetEntries.length} 条回收站记录。`
  callbacks.renderAvailabilitySection()
}

export function selectAllRecycleEntries(callbacks) {
  managerState.selectedRecycleIds = new Set(
    managerState.recycleBin.map((entry) => String(entry.recycleId))
  )
  callbacks.renderAvailabilitySection()
}

export async function restoreSelectedRecycleEntries(callbacks) {
  if (!managerState.selectedRecycleIds.size || availabilityState.deleting) {
    return
  }

  await restoreRecycleEntriesByIds([...managerState.selectedRecycleIds], callbacks)
  clearRecycleSelection(callbacks)
}

export async function clearSelectedRecycleEntries(callbacks) {
  if (!managerState.selectedRecycleIds.size || availabilityState.deleting) {
    return
  }

  await clearRecycleEntriesByIds([...managerState.selectedRecycleIds], callbacks)
}

async function restoreRecycleEntriesByIds(recycleIds, callbacks) {
  const targetSet = new Set(recycleIds.map((id) => String(id)).filter(Boolean))
  const targetEntries = managerState.recycleBin.filter((entry) => {
    return targetSet.has(String(entry.recycleId))
  })

  if (!targetEntries.length) {
    return
  }

  availabilityState.deleting = true
  availabilityState.lastError = ''
  callbacks.renderAvailabilitySection()

  const restoredIds = []
  let restoreError = null

  try {
    for (const entry of targetEntries) {
      const fallbackParentId = availabilityState.folderMap.has(String(entry.parentId))
        ? entry.parentId
        : BOOKMARKS_BAR_ID

      await createBookmark({
        parentId: fallbackParentId,
        index: Number.isFinite(entry.index) ? entry.index : undefined,
        title: entry.title,
        url: entry.url
      })
      restoredIds.push(String(entry.recycleId))
    }
  } catch (error) {
    restoreError = error
  } finally {
    availabilityState.deleting = false

    if (restoredIds.length) {
      const restoredSet = new Set(restoredIds)
      managerState.recycleBin = managerState.recycleBin.filter((entry) => {
        return !restoredSet.has(String(entry.recycleId))
      })
      await removeRecycleEntries(restoredIds)
      await refreshRecycleBinState()
      await callbacks.hydrateAvailabilityCatalog({ preserveResults: true })
    }

    if (restoreError) {
      availabilityState.lastError =
        restoreError instanceof Error
          ? `恢复过程中断，已恢复 ${restoredIds.length} 条：${restoreError.message}`
          : `恢复过程中断，已恢复 ${restoredIds.length} 条。`
    } else {
      availabilityState.lastError = `已从回收站恢复 ${restoredIds.length} 条书签。`
    }

    callbacks.renderAvailabilitySection()
  }
}

export async function clearRecycleBin(callbacks) {
  if (!managerState.recycleBin.length || availabilityState.deleting) {
    return
  }

  const confirmed = callbacks.confirm
    ? await callbacks.confirm({
        title: `清空 ${managerState.recycleBin.length} 条回收站记录？`,
        copy: '这些回收站记录会被永久移除，之后无法再从扩展内恢复。',
        confirmLabel: '清空回收站',
        label: '清空回收站',
        tone: 'danger'
      })
    : true
  if (!confirmed) {
    return
  }

  const recycleIds = managerState.recycleBin.map((entry) => String(entry.recycleId))
  managerState.recycleBin = []
  await removeRecycleEntries(recycleIds)
  await refreshRecycleBinState()
  clearRecycleSelection(callbacks)
  availabilityState.lastError = '已清空回收站记录。'
  callbacks.renderAvailabilitySection()
}

export async function deleteBookmarksToRecycle(bookmarkIds: unknown[], source: string, callbacks: any) {
  const uniqueIds = [...new Set(bookmarkIds.map((id) => String(id)).filter(Boolean))]
  if (!uniqueIds.length) {
    return
  }

  availabilityState.deleting = true
  availabilityState.lastError = ''
  callbacks.renderAvailabilitySection()

  const removedIds = []
  const recycleEntries = []
  let removalError = null

  try {
    await createAutoBackupBeforeDangerousOperation({
      kind: inferDeleteBackupKind(source),
      source: 'options',
      reason: source || '删除书签前自动备份',
      targetBookmarkIds: uniqueIds,
      estimatedChangeCount: uniqueIds.length
    })

    for (const bookmarkId of uniqueIds) {
      const bookmark = callbacks.getBookmarkRecord(bookmarkId)
      if (!bookmark?.url) {
        continue
      }

      const recycleEntry = buildRecycleEntry(bookmark, source)
      await deleteBookmarkToRecycle(bookmarkId, recycleEntry)
      removedIds.push(bookmarkId)
      recycleEntries.push(recycleEntry)
    }
  } catch (error) {
    removalError = error
  } finally {
    if (removedIds.length) {
      managerState.recycleBin = mergeRecycleEntries(
        recycleEntries as RecycleEntry[],
        managerState.recycleBin as RecycleEntry[]
      )
      await refreshRecycleBinState()
      callbacks.removeDeletedResultsFromState(removedIds)
      await callbacks.hydrateAvailabilityCatalog({ preserveResults: true })
      await callbacks.saveRedirectCache()
    }

    availabilityState.deleting = false
    availabilityState.deleteModalOpen = false

    if (removalError) {
      availabilityState.lastError =
        removalError instanceof Error
          ? `删除过程中断，已删除 ${removedIds.length} 条：${removalError.message}`
          : `删除过程中断，已删除 ${removedIds.length} 条。`
    } else if (removedIds.length) {
      availabilityState.lastError = `已删除 ${removedIds.length} 条书签，并移入回收站。可在左侧“回收站”查看并恢复。`
    }

    callbacks.renderAvailabilitySection()
  }
}

export async function refreshRecycleBinState(): Promise<void> {
  managerState.recycleBin = normalizeRecycleBin(await loadRecycleBinEntries())
  managerState.recycleBin = managerState.recycleBin.slice(0, RECYCLE_BIN_LIMIT)
}

function inferDeleteBackupKind(source: string): DangerousOperationKind {
  if (/重复/.test(source)) {
    return 'duplicate-cleanup'
  }
  if (/异常|坏链|高置信/.test(source)) {
    return 'availability-cleanup'
  }
  return 'batch-delete'
}
