import { displayUrl } from '../../shared/text.js'
import { getEffectiveBookmarkTags } from '../../shared/bookmark-tags.js'
import { availabilityState, aiNamingState, contentSnapshotState, managerState } from '../shared-options/state.js'
import { dom } from '../shared-options/dom.js'
import { escapeHtml, escapeAttr } from '../shared-options/html.js'
import {
  isInteractionLocked,
  compareByPathTitle,
  syncSelectionSet
} from '../shared-options/utils.js'
import { deleteBookmarksToRecycle } from './recycle.js'

const DUPLICATE_STRATEGY_LABELS = {
  recommended: '按推荐选择',
  newest: '保留最新',
  oldest: '保留最早',
  'shorter-path': '保留路径最短',
  tagged: '保留有标签',
  'newtab-source': '保留新标签页来源',
  recent: '保留最近访问',
  'scope-or-shorter': '保留当前范围',
  folder: '保留指定文件夹'
}

export interface BuildDuplicateGroupsOptions {
  excludedFolderIds?: Iterable<string>
}

export function buildDuplicateGroups(bookmarks, options: BuildDuplicateGroupsOptions = {}) {
  const groupMap = new Map()
  const excludedFolderIds = new Set(
    [...(options.excludedFolderIds || [])]
      .map((folderId) => String(folderId || '').trim())
      .filter(Boolean)
  )

  for (const bookmark of bookmarks) {
    if (!bookmark?.url) {
      continue
    }

    if (isBookmarkInExcludedFolder(bookmark, excludedFolderIds)) {
      continue
    }

    const duplicateKey = String(bookmark.duplicateKey || '').trim()
    if (!duplicateKey) {
      continue
    }

    if (!groupMap.has(duplicateKey)) {
      groupMap.set(duplicateKey, [])
    }

    groupMap.get(duplicateKey).push(bookmark)
  }

  return [...groupMap.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => buildDuplicateGroupModel(key, items))
    .sort((left, right) => {
      return (
        right.riskWeight - left.riskWeight ||
        right.items.length - left.items.length ||
        left.displayUrl.localeCompare(right.displayUrl, 'zh-CN')
      )
    })
}

function isBookmarkInExcludedFolder(bookmark, excludedFolderIds: Set<string>): boolean {
  if (!excludedFolderIds.size) {
    return false
  }

  const parentId = String(bookmark.parentId || '').trim()
  if (parentId && excludedFolderIds.has(parentId)) {
    return true
  }

  const ancestorIds = Array.isArray(bookmark.ancestorIds) ? bookmark.ancestorIds : []
  return ancestorIds.some((folderId) => excludedFolderIds.has(String(folderId || '').trim()))
}

function buildDuplicateGroupModel(key, items) {
  const sortedItems = items.slice().sort(compareDuplicateItemsByNewest)
  const rankedItems = rankDuplicateGroupItems(sortedItems)
  const folders = collectDuplicateFolders(sortedItems)
  const isCrossFolder = folders.length > 1
  const titleKeys = new Set(sortedItems.map((item) => normalizeDuplicateTitle(item.title)))
  const hasTitleVariants = titleKeys.size > 1
  const recommendation = buildDuplicateRecommendation({
    latestItem: rankedItems.latestItem,
    oldestItem: rankedItems.oldestItem,
    shorterPathItem: rankedItems.shorterPathItem,
    fullerTitleItem: rankedItems.fullerTitleItem,
    taggedItem: rankedItems.taggedItem,
    newTabSourceItem: rankedItems.newTabSourceItem,
    recentItem: rankedItems.recentItem,
    isCrossFolder,
    hasTitleVariants
  })

  return {
    id: `duplicate-${hashDuplicateKey(key)}`,
    key,
    displayUrl: displayUrl(sortedItems[0].url),
    items: sortedItems,
    folders,
    isCrossFolder,
    hasTitleVariants,
    risk: isCrossFolder || hasTitleVariants ? 'high' : 'low',
    riskWeight: (isCrossFolder ? 2 : 0) + (hasTitleVariants ? 1 : 0),
    latestItemId: String(rankedItems.latestItem?.id || ''),
    oldestItemId: String(rankedItems.oldestItem?.id || ''),
    shorterPathItemId: String(rankedItems.shorterPathItem?.id || ''),
    fullerTitleItemId: String(rankedItems.fullerTitleItem?.id || ''),
    taggedItemId: hasDuplicateTagSignal(rankedItems.taggedItem) ? String(rankedItems.taggedItem?.id || '') : '',
    newTabSourceItemId: hasNewTabSourceSignal(rankedItems.newTabSourceItem) ? String(rankedItems.newTabSourceItem?.id || '') : '',
    recentItemId: hasRecentActivitySignal(rankedItems.recentItem) ? String(rankedItems.recentItem?.id || '') : '',
    recommendedKeepId: String(recommendation.item?.id || ''),
    recommendation
  }
}

function rankDuplicateGroupItems(sortedItems) {
  const [firstItem] = sortedItems
  const ranked = {
    latestItem: firstItem || null,
    oldestItem: firstItem || null,
    shorterPathItem: firstItem || null,
    fullerTitleItem: firstItem || null,
    taggedItem: firstItem || null,
    newTabSourceItem: firstItem || null,
    recentItem: firstItem || null
  }

  for (const item of sortedItems) {
    if (compareDuplicateItemsByOldest(item, ranked.oldestItem) < 0) {
      ranked.oldestItem = item
    }
    if (compareDuplicateItemsByShorterPath(item, ranked.shorterPathItem) < 0) {
      ranked.shorterPathItem = item
    }
    if (compareDuplicateItemsByFullerTitle(item, ranked.fullerTitleItem) < 0) {
      ranked.fullerTitleItem = item
    }
    if (compareDuplicateItemsByTagSignal(item, ranked.taggedItem) < 0) {
      ranked.taggedItem = item
    }
    if (compareDuplicateItemsByNewTabSource(item, ranked.newTabSourceItem) < 0) {
      ranked.newTabSourceItem = item
    }
    if (compareDuplicateItemsByRecentActivity(item, ranked.recentItem) < 0) {
      ranked.recentItem = item
    }
  }

  return ranked
}

function collectDuplicateFolders(items) {
  const seenFolders = new Set()
  const folders = []

  for (const item of items) {
    const folderId = String(item.parentId || '')
    if (seenFolders.has(folderId)) {
      continue
    }

    seenFolders.add(folderId)
    folders.push({
      id: folderId,
      title: availabilityState.folderMap.get(folderId)?.title || item.path || '文件夹',
      path: availabilityState.folderMap.get(folderId)?.path || item.path || '未归档路径'
    })
  }

  return folders.sort((left, right) => {
    return String(left.path || left.title).localeCompare(String(right.path || right.title), 'zh-CN')
  })
}

function buildDuplicateRecommendation({
  latestItem,
  oldestItem,
  shorterPathItem,
  fullerTitleItem,
  taggedItem,
  newTabSourceItem,
  recentItem,
  isCrossFolder,
  hasTitleVariants
}) {
  if (hasDuplicateTagSignal(taggedItem)) {
    const tagReason = getDuplicateTagRecommendationReason(taggedItem)
    return {
      kind: tagReason.kind,
      label: tagReason.label,
      item: taggedItem,
      reason: tagReason.reason
    }
  }

  if (hasNewTabSourceSignal(newTabSourceItem)) {
    return {
      kind: 'newtab-source',
      label: '新标签页来源',
      item: newTabSourceItem,
      reason: '该副本位于新标签页展示来源中，优先保留可避免破坏新标签页入口。'
    }
  }

  if (hasRecentActivitySignal(recentItem)) {
    return {
      kind: 'recent',
      label: '最近访问',
      item: recentItem,
      reason: '该副本最近在新标签页打开过，优先保留仍在使用的副本。'
    }
  }

  if (hasTitleVariants && fullerTitleItem) {
    return {
      kind: 'fuller-title',
      label: '标题更完整',
      item: fullerTitleItem,
      reason: '同一 URL 存在不同标题，优先保留标题信息更完整的副本。'
    }
  }

  if (isCrossFolder && shorterPathItem) {
    return {
      kind: 'shorter-path',
      label: '路径更短',
      item: shorterPathItem,
      reason: '跨文件夹重复，优先保留路径更短、层级更清晰的副本。'
    }
  }

  return {
    kind: 'latest',
    label: '最新',
    item: latestItem || oldestItem,
    reason: '没有更强的使用信号时，默认保留最近添加的副本。'
  }
}

export function renderDuplicateSection() {
  if (!dom.duplicateGroups) {
    return
  }

  const validIds = new Set(
    managerState.duplicateGroups.flatMap((group) => group.items.map((item) => String(item.id)))
  )
  syncSelectionSet(managerState.selectedDuplicateIds, validIds)

  const summary = getDuplicateSummary()
  const selectionStats = getDuplicateSelectionStats()
  const visibleGroups = managerState.duplicateGroups

  renderDuplicateSummary(summary)
  renderDuplicateSelectionState(selectionStats)
  renderDuplicateStrategyControls(visibleGroups)

  dom.duplicateGroupCount.textContent = `${managerState.duplicateGroups.length} 组重复`

  if (dom.duplicateResultsSubtitle) {
    const candidateCount = visibleGroups.reduce((count, group) => count + Math.max(0, group.items.length - 1), 0)
    dom.duplicateResultsSubtitle.textContent = selectionStats.deleteCount > 0
      ? `已选 ${selectionStats.deleteCount} 条待移入回收站；确认前可继续调整勾选。`
      : `${visibleGroups.length} 组重复。可按推荐选择，或逐条勾选要移入回收站的副本；建议最多处理 ${candidateCount} 条。`
  }

  const inlineActionBar = buildDuplicateInlineActionBar(selectionStats)

  if (!availabilityState.catalogLoading && !managerState.duplicateGroups.length) {
    dom.duplicateGroups.innerHTML = '<div class="detect-empty">当前未发现重复书签。</div>'
    return
  }

  dom.duplicateGroups.innerHTML = managerState.duplicateGroups.length
    ? `${inlineActionBar}${visibleGroups.map((group) => buildDuplicateGroupCard(group)).join('')}`
    : '<div class="detect-empty">正在分析重复书签。</div>'
}

function renderDuplicateSummary(summary) {
  setDomText(dom.duplicateSummaryGroups, String(summary.totalGroups))
  setDomText(dom.duplicateSummaryCandidates, String(summary.deleteCandidates))
  setDomText(dom.duplicateSummaryCrossFolder, String(summary.crossFolderGroups))
  setDomText(dom.duplicateSummaryTitleVariants, String(summary.titleVariantGroups))
  setDomText(dom.duplicateSummaryHighRisk, String(summary.highRiskGroups))
  setDomText(dom.duplicateSummarySelected, String(summary.selectedItems))
}

function renderDuplicateSelectionState(selectionStats) {
  dom.duplicateSelectionGroup.classList.add('hidden')
  dom.duplicateSelectionCount.textContent = `${selectionStats.deleteCount} 条待移入回收站`

  if (dom.duplicateSelectionImpact) {
    dom.duplicateSelectionImpact.textContent =
      `将移入回收站 ${selectionStats.deleteCount} 条，保留 ${selectionStats.keepCount} 条，涉及 ${selectionStats.groupCount} 组。`
  }

  if (dom.duplicateSelectionWarning) {
    const unsafe = selectionStats.unsafeGroupCount > 0
    dom.duplicateSelectionWarning.classList.toggle('hidden', !unsafe)
    dom.duplicateSelectionWarning.textContent = unsafe
      ? `${selectionStats.unsafeGroupCount} 组重复已被全选；每组至少保留 1 条后才能移入回收站。`
      : ''
  }

  dom.duplicateDeleteSelection.disabled =
    isInteractionLocked() || selectionStats.deleteCount === 0 || selectionStats.unsafeGroupCount > 0
}

function buildDuplicateInlineActionBar(selectionStats) {
  if (!selectionStats.deleteCount) {
    return ''
  }

  const locked = isInteractionLocked()
  const unsafe = selectionStats.unsafeGroupCount > 0
  const deleteDisabled = locked || unsafe
  const warning = unsafe
    ? `<p class="duplicate-docked-selection-warning">${selectionStats.unsafeGroupCount} 组已全选；每组至少保留 1 条后才能移入回收站。</p>`
    : ''

  return `
    <div class="duplicate-docked-selection" role="region" aria-label="已选重复书签操作">
      <div class="duplicate-docked-selection-copy">
        <strong>已选 ${selectionStats.deleteCount} 条待移入回收站</strong>
        <p>将保留 ${selectionStats.keepCount} 条，涉及 ${selectionStats.groupCount} 组；确认前不会处理。</p>
        ${warning}
      </div>
      <div class="duplicate-docked-selection-actions">
        <button
          class="options-button secondary small"
          type="button"
          data-duplicate-clear-selection="true"
          ${locked ? 'disabled' : ''}
        >
          清空选择
        </button>
        <button
          class="options-button danger small"
          type="button"
          data-duplicate-delete-selection="true"
          ${deleteDisabled ? 'disabled' : ''}
        >
          移入回收站
        </button>
      </div>
    </div>
  `
}

function renderDuplicateStrategyControls(visibleGroups) {
  if (dom.duplicateStrategyControls) {
    const disabled = isInteractionLocked() || visibleGroups.length === 0
    for (const button of dom.duplicateStrategyControls.querySelectorAll<HTMLButtonElement>('[data-duplicate-strategy]')) {
      const strategy = normalizeDuplicateStrategy(button.getAttribute('data-duplicate-strategy'))
      const visible = strategy !== 'folder' && strategy !== 'scope-or-shorter'
      button.classList.toggle('hidden', !visible)
      button.setAttribute('aria-hidden', visible ? 'false' : 'true')
      button.textContent = strategy === 'recommended' ? '按推荐选择当前结果' : DUPLICATE_STRATEGY_LABELS[strategy]
      button.disabled = disabled || !visible
    }
  }

  if (dom.duplicateStrategyStatus) {
    dom.duplicateStrategyStatus.textContent =
      managerState.duplicateStrategyStatus || '先选择待移入回收站的副本，再确认处理。'
  }
}

function buildDuplicateGroupCard(group) {
  const locked = isInteractionLocked()
  const selectedCount = getDuplicateGroupSelectedCount(group)
  const keepCount = Math.max(0, group.items.length - selectedCount)
  const recommendedItem = getDuplicateGroupItem(group, group.recommendedKeepId) || group.items[0]
  const recommendedDeleteCount = Math.max(0, group.items.length - 1)
  const currentSelectionCopy = selectedCount > 0
    ? `已选 ${selectedCount} 条待移入回收站，保留 ${keepCount} 条。`
    : `按推荐可选择 ${recommendedDeleteCount} 条移入回收站，保留 1 条。`

  return `
    <article class="detect-result-card duplicate-group-card ${group.risk === 'high' ? 'high-risk' : 'low-risk'}">
      <div class="duplicate-group-header">
        <div class="duplicate-group-copy">
          <div class="duplicate-group-title-row">
            <strong title="${escapeAttr(group.displayUrl)}">${escapeHtml(group.displayUrl)}</strong>
            <div class="duplicate-group-tags">
              ${buildDuplicateGroupChips(group)}
            </div>
          </div>
          <p class="detect-results-subtitle">
            ${group.items.length} 条重复 · ${group.folders.length} 个文件夹 · ${currentSelectionCopy}
          </p>
        </div>
      </div>
      <div class="duplicate-recommendation">
        <div class="duplicate-recommendation-copy">
          <span class="options-chip success">推荐保留</span>
          <strong>${escapeHtml(recommendedItem?.title || '未命名书签')}</strong>
          <p>${escapeHtml(group.recommendation.reason)} 按推荐会选择 ${recommendedDeleteCount} 条移入回收站；也可逐条勾选。</p>
          <div class="duplicate-recommendation-signals" aria-label="推荐依据">
            ${buildDuplicateRecommendationSignals(group)}
          </div>
        </div>
        <div class="duplicate-group-actions">
          <button
            class="options-button secondary small duplicate-accept-suggestion"
            type="button"
            data-duplicate-keep-strategy="recommended"
            data-duplicate-group-id="${escapeAttr(group.id)}"
            ${locked ? 'disabled' : ''}
          >
            按推荐选择
          </button>
          <button
            class="options-button secondary small"
            type="button"
            data-duplicate-keep-strategy="newest"
            data-duplicate-group-id="${escapeAttr(group.id)}"
            ${locked ? 'disabled' : ''}
          >
            保留最新
          </button>
          <button
            class="options-button secondary small"
            type="button"
            data-duplicate-keep-strategy="shorter-path"
            data-duplicate-group-id="${escapeAttr(group.id)}"
            ${locked ? 'disabled' : ''}
          >
            保留路径最短
          </button>
        </div>
      </div>
      <div class="duplicate-item-list">
        ${group.items.map((item) => buildDuplicateItemCard(item, group)).join('')}
      </div>
    </article>
  `
}

function buildDuplicateRecommendationSignals(group) {
  const signals = [
    ['最新', group.latestItemId],
    ['最早', group.oldestItemId],
    ['路径最短', group.shorterPathItemId],
    ['有标签/摘要', group.taggedItemId],
    ['新标签页来源', group.newTabSourceItemId],
    ['最近访问', group.recentItemId]
  ]

  return signals
    .filter(([, bookmarkId]) => Boolean(bookmarkId))
    .map(([label, bookmarkId]) => {
      const active = String(bookmarkId) === String(group.recommendedKeepId)
      return `<span class="options-chip ${active ? 'success' : 'muted'}">${escapeHtml(label)}</span>`
    })
    .join('')
}

function buildDuplicateGroupChips(group) {
  const chips = [
    group.isCrossFolder
      ? ['warning', '跨文件夹']
      : ['muted', '同文件夹'],
    group.hasTitleVariants
      ? ['warning', '标题不同']
      : ['muted', '标题一致'],
    group.risk === 'high'
      ? ['danger', '高风险']
      : ['success', '低风险']
  ]

  return chips
    .map(([tone, label]) => `<span class="options-chip ${tone}">${escapeHtml(label)}</span>`)
    .join('')
}

function buildDuplicateItemCard(item, group) {
  const itemId = String(item.id)
  const selected = managerState.selectedDuplicateIds.has(itemId)
  const recommended = itemId === String(group.recommendedKeepId)
  const selectionLabel = getDuplicateItemSelectionLabel(item)
  const classes = [
    'duplicate-item-row',
    selected ? 'selected pending-delete' : '',
    recommended ? 'recommended-keep' : ''
  ].filter(Boolean).join(' ')

  return `
    <div class="${classes}">
      <label class="detect-result-check">
        <input
          type="checkbox"
          data-duplicate-select="true"
          data-bookmark-id="${escapeAttr(item.id)}"
          aria-label="${escapeAttr(selectionLabel)}"
          ${selected ? 'checked' : ''}
          ${isInteractionLocked() ? 'disabled' : ''}
        >
        <span>移入回收站</span>
      </label>
      <div class="duplicate-item-copy">
        <div class="duplicate-item-meta">
          <strong title="${escapeAttr(item.title || '未命名书签')}">${escapeHtml(item.title || '未命名书签')}</strong>
          <div class="duplicate-item-badges">
            ${buildDuplicateItemBadges(item, group)}
          </div>
        </div>
        <div class="detect-result-url">${escapeHtml(displayUrl(item.url))}</div>
        <div class="detect-result-detail">添加于 ${escapeHtml(formatDuplicateDate(item.dateAdded))}</div>
        <div class="detect-result-path" title="${escapeAttr(item.path || '未归档路径')}">${escapeHtml(item.path || '未归档路径')}</div>
      </div>
    </div>
  `
}

function getDuplicateItemSelectionLabel(item) {
  const title = String(item?.title || displayUrl(item?.url) || '未命名书签')
    .replace(/\s+/g, ' ')
    .trim()
  const safeTitle = title.length > 48 ? `${title.slice(0, 47).trim()}…` : title
  const path = String(item?.path || '').replace(/\s+/g, ' ').trim()

  return path
    ? `移入回收站：${safeTitle || '未命名书签'}，位置：${path}`
    : `移入回收站：${safeTitle || '未命名书签'}`
}

function buildDuplicateItemBadges(item, group) {
  const itemId = String(item.id)
  const badges = []

  if (managerState.selectedDuplicateIds.has(itemId)) {
    badges.push(['danger', '待移入回收站'])
  } else if (itemId === String(group.recommendedKeepId)) {
    badges.push(['success', '推荐保留'])
  }

  if (itemId === String(group.latestItemId)) {
    badges.push(['muted', '最新'])
  }
  if (itemId === String(group.oldestItemId)) {
    badges.push(['muted', '最早'])
  }
  if (itemId === String(group.shorterPathItemId)) {
    badges.push(['muted', '路径更短'])
  }
  if (itemId === String(group.fullerTitleItemId) && group.hasTitleVariants) {
    badges.push(['muted', '标题更完整'])
  }
  if (itemId === String(group.taggedItemId)) {
    badges.push(['muted', getDuplicateTagBadgeLabel(item)])
  }
  if (itemId === String(group.newTabSourceItemId)) {
    badges.push(['muted', '新标签页来源'])
  }
  if (itemId === String(group.recentItemId)) {
    badges.push(['muted', '最近访问'])
  }
  if (isBookmarkInCurrentDuplicateScope(item)) {
    badges.push(['muted', '当前范围'])
  }

  const seen = new Set()
  return badges
    .filter(([, label]) => {
      if (seen.has(label)) {
        return false
      }
      seen.add(label)
      return true
    })
    .map(([tone, label]) => `<span class="options-chip ${tone}">${escapeHtml(label)}</span>`)
    .join('')
}

export function handleDuplicateGroupsClick(event, callbacks) {
  if (!(event.target instanceof Element)) {
    return
  }

  const inlineClearButton = event.target.closest('[data-duplicate-clear-selection]')
  if (inlineClearButton && !isInteractionLocked()) {
    clearDuplicateSelection(callbacks)
    return
  }

  const inlineDeleteButton = event.target.closest('[data-duplicate-delete-selection]')
  if (inlineDeleteButton && !isInteractionLocked()) {
    void deleteSelectedDuplicates(callbacks)
    return
  }

  const selectionInput = event.target.closest('input[data-duplicate-select]')
  if (selectionInput) {
    const bookmarkId = String(selectionInput.getAttribute('data-bookmark-id') || '').trim()
    if (selectionInput.checked) {
      managerState.selectedDuplicateIds.add(bookmarkId)
    } else {
      managerState.selectedDuplicateIds.delete(bookmarkId)
    }
    managerState.duplicateStrategyStatus = '已手动调整选择。'
    callbacks.renderAvailabilitySection()
    return
  }

  const strategyButton = event.target.closest('[data-duplicate-keep-strategy]')
  if (strategyButton && !isInteractionLocked()) {
    const groupId = String(strategyButton.getAttribute('data-duplicate-group-id') || '').trim()
    const strategy = normalizeDuplicateStrategy(strategyButton.getAttribute('data-duplicate-keep-strategy'))
    const result = selectDuplicateGroupByStrategy(groupId, strategy)
    setDuplicateStrategyStatus(result, DUPLICATE_STRATEGY_LABELS[strategy])
    callbacks.renderAvailabilitySection()
    return
  }

  const keepFolderButton = event.target.closest('[data-duplicate-keep-folder]')
  if (!keepFolderButton || isInteractionLocked()) {
    return
  }

  const groupId = String(keepFolderButton.getAttribute('data-duplicate-keep-folder') || '').trim()
  const select =
    event.currentTarget instanceof Element
      ? event.currentTarget.querySelector(`[data-duplicate-folder-select="${CSS.escape(groupId)}"]`)
      : null
  const folderId = String(select?.value || '').trim()
  if (!groupId || !folderId) {
    return
  }

  const result = selectDuplicateGroupFolder(groupId, folderId)
  setDuplicateStrategyStatus(result, DUPLICATE_STRATEGY_LABELS.folder)
  callbacks.renderAvailabilitySection()
}

export function handleDuplicateToolbarClick(event, callbacks) {
  if (!(event.target instanceof Element)) {
    return
  }

  const strategyButton = event.target.closest('[data-duplicate-strategy]')
  if (strategyButton && !isInteractionLocked()) {
    const strategy = normalizeDuplicateStrategy(strategyButton.getAttribute('data-duplicate-strategy'))
    const result = selectDuplicateGroupsByStrategy(strategy, managerState.duplicateGroups)
    setDuplicateStrategyStatus(result, DUPLICATE_STRATEGY_LABELS[strategy])
    callbacks.renderAvailabilitySection()
  }
}

export function clearDuplicateSelection(callbacks) {
  managerState.selectedDuplicateIds.clear()
  managerState.duplicateStrategyStatus = ''
  callbacks.renderAvailabilitySection()
}

export async function deleteSelectedDuplicates(callbacks) {
  const selectionStats = getDuplicateSelectionStats()
  if (isInteractionLocked() || !selectionStats.deleteCount) {
    return
  }

  if (selectionStats.unsafeGroupCount > 0) {
    availabilityState.lastError = '重复书签回收已拦截：每组至少需要保留 1 条。'
    callbacks.renderAvailabilitySection()
    return
  }

  const targetIds = getSelectedDuplicateIds()
  const confirmed = callbacks.confirm
    ? await callbacks.confirm({
        title: `移入回收站 ${targetIds.length} 条重复书签？`,
        copy: `这些重复项会从 Chrome 书签中移除并进入扩展回收站；本次会保留 ${selectionStats.keepCount} 条。`,
        confirmLabel: '移入回收站',
        label: '移入回收站',
        tone: 'danger'
      })
    : true
  if (!confirmed) {
    return
  }

  await deleteBookmarksToRecycle(
    targetIds,
    `重复书签批量清理：移入回收站 ${targetIds.length} 条，保留 ${selectionStats.keepCount} 条`,
    callbacks.recycleCallbacks
  )
  clearDuplicateSelection(callbacks)
}

function getDuplicateSummary() {
  const groups = managerState.duplicateGroups
  const selectionStats = getDuplicateSelectionStats(groups)

  return {
    totalGroups: groups.length,
    deleteCandidates: groups.reduce((count, group) => count + Math.max(0, group.items.length - 1), 0),
    crossFolderGroups: groups.filter((group) => group.isCrossFolder).length,
    sameFolderGroups: groups.filter((group) => !group.isCrossFolder).length,
    titleVariantGroups: groups.filter((group) => group.hasTitleVariants).length,
    highRiskGroups: groups.filter((group) => group.risk === 'high').length,
    lowRiskGroups: groups.filter((group) => group.risk === 'low').length,
    selectedItems: selectionStats.deleteCount
  }
}

function getDuplicateSelectionStats(groups = managerState.duplicateGroups) {
  let deleteCount = 0
  let keepCount = 0
  let groupCount = 0
  let unsafeGroupCount = 0

  for (const group of groups) {
    const selectedInGroup = group.items.filter((item) => {
      return managerState.selectedDuplicateIds.has(String(item.id))
    }).length

    if (!selectedInGroup) {
      continue
    }

    const keptInGroup = group.items.length - selectedInGroup
    groupCount += 1
    deleteCount += selectedInGroup
    keepCount += Math.max(0, keptInGroup)

    if (keptInGroup <= 0) {
      unsafeGroupCount += 1
    }
  }

  return {
    deleteCount,
    keepCount,
    groupCount,
    unsafeGroupCount
  }
}

function getDuplicateGroupSelectedCount(group) {
  return group.items.filter((item) => managerState.selectedDuplicateIds.has(String(item.id))).length
}

function selectDuplicateGroupsByStrategy(strategy, groups) {
  const result = {
    groupCount: 0,
    deleteCount: 0,
    keepCount: 0
  }

  for (const group of groups) {
    const groupResult = selectDuplicateGroupByStrategy(group.id, strategy)
    if (!groupResult.groupCount) {
      continue
    }

    result.groupCount += groupResult.groupCount
    result.deleteCount += groupResult.deleteCount
    result.keepCount += groupResult.keepCount
  }

  return result
}

function selectDuplicateGroupByStrategy(groupId, strategy) {
  const group = managerState.duplicateGroups.find((entry) => entry.id === groupId)
  if (!group || group.items.length <= 1) {
    return { groupCount: 0, deleteCount: 0, keepCount: 0 }
  }

  const keepItem = getDuplicateKeepItem(group, strategy)
  return selectDuplicateGroupKeepItem(group, keepItem)
}

function selectDuplicateGroupFolder(groupId, folderId) {
  const group = managerState.duplicateGroups.find((entry) => entry.id === groupId)
  if (!group || group.items.length <= 1) {
    return { groupCount: 0, deleteCount: 0, keepCount: 0 }
  }

  const matchingItems = group.items
    .filter((item) => String(item.parentId) === String(folderId))
    .sort(compareDuplicateItemsByNewest)

  if (!matchingItems.length) {
    return { groupCount: 0, deleteCount: 0, keepCount: 0 }
  }

  return selectDuplicateGroupKeepItem(group, matchingItems[0])
}

function selectDuplicateGroupKeepItem(group, keepItem) {
  const keepId = String(keepItem?.id || '')
  if (!keepId) {
    return { groupCount: 0, deleteCount: 0, keepCount: 0 }
  }

  for (const item of group.items) {
    managerState.selectedDuplicateIds.delete(String(item.id))
  }

  let deleteCount = 0
  for (const item of group.items) {
    const itemId = String(item.id)
    if (itemId === keepId) {
      continue
    }

    managerState.selectedDuplicateIds.add(itemId)
    deleteCount += 1
  }

  return {
    groupCount: 1,
    deleteCount,
    keepCount: Math.max(0, group.items.length - deleteCount)
  }
}

function getDuplicateKeepItem(group, strategy) {
  const normalizedStrategy = normalizeDuplicateStrategy(strategy)

  if (normalizedStrategy === 'newest') {
    return getDuplicateGroupItem(group, group.latestItemId) || group.items[0]
  }

  if (normalizedStrategy === 'oldest') {
    return getDuplicateGroupItem(group, group.oldestItemId) || group.items[group.items.length - 1]
  }

  if (normalizedStrategy === 'shorter-path') {
    return getDuplicateGroupItem(group, group.shorterPathItemId) || group.items[0]
  }

  if (normalizedStrategy === 'tagged') {
    return getDuplicateGroupItem(group, group.taggedItemId) ||
      getDuplicateGroupItem(group, group.recommendedKeepId) ||
      group.items[0]
  }

  if (normalizedStrategy === 'newtab-source') {
    return getDuplicateGroupItem(group, group.newTabSourceItemId) ||
      getDuplicateGroupItem(group, group.recommendedKeepId) ||
      group.items[0]
  }

  if (normalizedStrategy === 'recent') {
    return getDuplicateGroupItem(group, group.recentItemId) ||
      getDuplicateGroupItem(group, group.recommendedKeepId) ||
      group.items[0]
  }

  if (normalizedStrategy === 'scope-or-shorter') {
    const scopeItem = getCurrentScopeDuplicateItem(group)
    if (scopeItem) {
      return scopeItem
    }

    return getDuplicateGroupItem(group, group.shorterPathItemId) || group.items[0]
  }

  return getDuplicateGroupItem(group, group.recommendedKeepId) || group.items[0]
}

function getCurrentScopeDuplicateItem(group) {
  const scopedItems = group.items
    .filter((item) => isBookmarkInCurrentDuplicateScope(item))
    .sort(compareDuplicateItemsByNewest)

  return scopedItems[0] || null
}

function getDuplicateGroupItem(group, bookmarkId) {
  const normalizedId = String(bookmarkId || '')
  return group.items.find((item) => String(item.id) === normalizedId) || null
}

function setDuplicateStrategyStatus(result, strategyLabel) {
  if (!result.groupCount) {
    managerState.duplicateStrategyStatus = '当前范围没有可应用的重复分组。'
    return
  }

  managerState.duplicateStrategyStatus =
    `${strategyLabel}：已选择 ${result.deleteCount} 条待移入回收站，保留 ${result.keepCount} 条。`
}

function getSelectedDuplicateIds() {
  const ids = []
  const seen = new Set()

  for (const group of managerState.duplicateGroups) {
    for (const item of group.items) {
      const itemId = String(item.id)
      if (!managerState.selectedDuplicateIds.has(itemId) || seen.has(itemId)) {
        continue
      }

      ids.push(itemId)
      seen.add(itemId)
    }
  }

  return ids
}

function normalizeDuplicateStrategy(strategy) {
  const normalized = String(strategy || 'recommended').trim()
  return Object.prototype.hasOwnProperty.call(DUPLICATE_STRATEGY_LABELS, normalized)
    ? normalized
    : 'recommended'
}

function compareDuplicateItemsByNewest(left, right) {
  return (
    (Number(right.dateAdded) || 0) - (Number(left.dateAdded) || 0) ||
    compareByPathTitle(left, right)
  )
}

function compareDuplicateItemsByOldest(left, right) {
  return (
    (Number(left.dateAdded) || 0) - (Number(right.dateAdded) || 0) ||
    compareByPathTitle(left, right)
  )
}

function compareDuplicateItemsByShorterPath(left, right) {
  return (
    getDuplicatePathDepth(left) - getDuplicatePathDepth(right) ||
    getDuplicatePathLength(left) - getDuplicatePathLength(right) ||
    compareDuplicateItemsByNewest(left, right)
  )
}

function compareDuplicateItemsByFullerTitle(left, right) {
  return (
    getDuplicateTitleScore(right) - getDuplicateTitleScore(left) ||
    compareDuplicateItemsByNewest(left, right)
  )
}

function compareDuplicateItemsByTagSignal(left, right) {
  return (
    getDuplicateTagSignalScore(right) - getDuplicateTagSignalScore(left) ||
    compareDuplicateItemsByNewest(left, right)
  )
}

function compareDuplicateItemsByNewTabSource(left, right) {
  return (
    Number(hasNewTabSourceSignal(right)) - Number(hasNewTabSourceSignal(left)) ||
    compareDuplicateItemsByNewest(left, right)
  )
}

function compareDuplicateItemsByRecentActivity(left, right) {
  return (
    getDuplicateLastOpenedAt(right) - getDuplicateLastOpenedAt(left) ||
    compareDuplicateItemsByNewest(left, right)
  )
}

function getDuplicatePathDepth(item) {
  return String(item.path || '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean).length
}

function getDuplicatePathLength(item) {
  return String(item.path || '').trim().length || Number.MAX_SAFE_INTEGER
}

function getDuplicateTitleScore(item) {
  const title = String(item?.title || '').trim()
  if (!title || /^untitled$/i.test(title) || title === '未命名书签') {
    return 0
  }

  return title.replace(/\s+/g, '').length
}

function normalizeDuplicateTitle(title) {
  const normalized = String(title || '').trim().replace(/\s+/g, ' ').toLowerCase()
  return normalized || '(empty)'
}

function isBookmarkInCurrentDuplicateScope(item) {
  const scopeFolderId = String(availabilityState.scopeFolderId || '').trim()
  if (!scopeFolderId) {
    return false
  }

  const ancestorIds = Array.isArray(item.ancestorIds) ? item.ancestorIds.map((id) => String(id)) : []
  return String(item.parentId || '') === scopeFolderId || ancestorIds.includes(scopeFolderId)
}

function hasDuplicateTagSignal(item) {
  return getDuplicateTagSignalScore(item) > 0
}

function getDuplicateTagSignalScore(item) {
  const bookmarkId = String(item?.id || '')
  if (!bookmarkId) {
    return 0
  }

  const tagRecord = aiNamingState.tagIndex?.records?.[bookmarkId] || null
  const snapshotRecord = contentSnapshotState.index?.records?.[bookmarkId] || null
  let score = 0
  if (tagRecord?.manualTags?.length) {
    score += 60
  }
  if (getEffectiveBookmarkTags(tagRecord).length) {
    score += 32
  }
  if (String(tagRecord?.summary || '').trim()) {
    score += 18
  }
  if (snapshotRecord?.summary || snapshotRecord?.hasFullText) {
    score += 12
  }
  return score
}

function getDuplicateTagRecommendationReason(item) {
  const bookmarkId = String(item?.id || '')
  const tagRecord = aiNamingState.tagIndex?.records?.[bookmarkId] || null
  const snapshotRecord = contentSnapshotState.index?.records?.[bookmarkId] || null
  if (tagRecord?.manualTags?.length) {
    return {
      kind: 'manual-tags',
      label: '有手动标签',
      reason: '该副本带有手动标签，包含人工整理信息，优先保留。'
    }
  }
  if (getEffectiveBookmarkTags(tagRecord).length) {
    return {
      kind: 'ai-tags',
      label: '有标签',
      reason: '该副本已有标签数据，保留后可继续用于 Dashboard 检索和筛选。'
    }
  }
  if (String(tagRecord?.summary || '').trim() || snapshotRecord?.summary || snapshotRecord?.hasFullText) {
    return {
      kind: 'summary',
      label: '有摘要',
      reason: '该副本已有 AI 摘要或网页内容快照，保留后不会丢失分析上下文。'
    }
  }

  return {
    kind: 'tagged',
    label: '有整理信息',
    reason: '该副本已有整理数据，优先保留。'
  }
}

function getDuplicateTagBadgeLabel(item) {
  return getDuplicateTagRecommendationReason(item).label
}

function hasNewTabSourceSignal(item) {
  return isBookmarkInNewTabSource(item)
}

function isBookmarkInNewTabSource(item) {
  const path = String(item?.path || '')
  const folder = availabilityState.folderMap.get(String(item?.parentId || ''))
  return isNewTabSourcePath(path) || isNewTabSourcePath(folder?.path || folder?.title || '')
}

function isNewTabSourcePath(path) {
  return String(path || '')
    .split('/')
    .map((part) => part.trim())
    .some((part) => part === '标签页')
}

function hasRecentActivitySignal(item) {
  return getDuplicateLastOpenedAt(item) > 0
}

function getDuplicateLastOpenedAt(item) {
  const activity = item && typeof item === 'object'
    ? (item.activity || item.newTabActivity || item.activityRecord)
    : null
  if (activity && typeof activity === 'object') {
    return Number(activity.lastOpenedAt) || 0
  }

  const bookmarkId = String(item?.id || '')
  const activityRecords = (availabilityState as any).newTabActivity?.records ||
    (managerState as any).newTabActivity?.records ||
    null
  if (activityRecords && typeof activityRecords === 'object') {
    return Number(activityRecords[bookmarkId]?.lastOpenedAt) || 0
  }

  return 0
}

function formatDuplicateDate(timestamp) {
  const value = Number(timestamp)
  if (!Number.isFinite(value) || value <= 0) {
    return '未知时间'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(value)
}

function hashDuplicateKey(value) {
  let hash = 0
  const input = String(value || '')
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0
  }

  return Math.abs(hash).toString(36)
}

function setDomText(element, text) {
  if (element) {
    element.textContent = text
  }
}
