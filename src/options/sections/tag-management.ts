import type { BookmarkTagIndex } from '../../shared/bookmark-tags.js'
import { getEffectiveBookmarkTags, normalizeBookmarkTagIndex } from '../../shared/bookmark-tags.js'
import {
  buildBookmarkTagUsageStats,
  deleteBookmarkTags,
  renameBookmarkTag,
  type BookmarkTagUsageStat
} from '../../shared/tag-management.js'
import type { BookmarkRecord } from '../../shared/types.js'
import { escapeAttr, escapeHtml } from '../shared-options/html.js'
import { dom } from '../shared-options/dom.js'

export interface TagManagementSummary {
  totalTags: number
  taggedBookmarks: number
  manualTags: number
  stats: BookmarkTagUsageStat[]
}

export function buildTagUsageSummary(index: BookmarkTagIndex, bookmarks: BookmarkRecord[] = []): TagManagementSummary {
  const normalized = normalizeBookmarkTagIndex(index)
  const bookmarkIds = new Set(bookmarks.map((bookmark) => bookmark.id))
  const scopedIndex = bookmarkIds.size
    ? normalizeBookmarkTagIndex({
      ...normalized,
      records: Object.fromEntries(
        Object.entries(normalized.records).filter(([bookmarkId]) => bookmarkIds.has(bookmarkId))
      )
    })
    : normalized
  const stats = buildBookmarkTagUsageStats(scopedIndex)

  return {
    totalTags: stats.length,
    taggedBookmarks: Object.values(scopedIndex.records)
      .filter((record) => getEffectiveBookmarkTags(record).length > 0).length,
    manualTags: stats.filter((stat) => stat.manualCount > 0).length,
    stats
  }
}

export function renameTagInIndex(index: BookmarkTagIndex, sourceTag: string, targetTag: string): BookmarkTagIndex {
  const result = renameBookmarkTag(index, sourceTag, targetTag)
  if (!String(sourceTag || '').trim() || !String(targetTag || '').trim()) {
    throw new Error('请输入要重命名的标签和新标签名。')
  }
  if (String(sourceTag).trim().toLowerCase() === String(targetTag).trim().toLowerCase()) {
    throw new Error('新标签名与原标签相同。')
  }
  if (!result.affectedRecords) {
    throw new Error(`没有找到标签「${sourceTag}」。`)
  }
  return result.index
}

export function deleteTagFromIndex(index: BookmarkTagIndex, sourceTag: string): BookmarkTagIndex {
  if (!String(sourceTag || '').trim()) {
    throw new Error('请输入要删除的标签。')
  }
  const result = deleteBookmarkTags(index, [sourceTag])
  if (!result.affectedRecords) {
    throw new Error(`没有找到标签「${sourceTag}」。`)
  }
  return result.index
}

export function renderTagManagementSection({
  index,
  bookmarks,
  status = '',
  loading = false
}: {
  index: BookmarkTagIndex
  bookmarks: BookmarkRecord[]
  status?: string
  loading?: boolean
}): void {
  if (!dom.tagManagementResults) {
    return
  }

  const summary = buildTagUsageSummary(index, bookmarks)
  dom.tagManagementTotal.textContent = `${summary.totalTags} 个标签`
  dom.tagManagementTaggedBookmarks.textContent = `${summary.taggedBookmarks} 条书签`
  dom.tagManagementManual.textContent = `${summary.manualTags} 个手动标签`
  dom.tagManagementStatus.textContent = status || (loading ? '正在读取标签统计...' : '')

  if (dom.tagManagementRefresh) {
    dom.tagManagementRefresh.disabled = loading
  }
  if (dom.tagManagementRename) {
    dom.tagManagementRename.disabled = loading || summary.totalTags === 0
  }
  if (dom.tagManagementDelete) {
    dom.tagManagementDelete.disabled = loading || summary.totalTags === 0
  }

  if (!summary.totalTags) {
    dom.tagManagementResults.innerHTML = `
      <div class="detect-empty">
        还没有可管理的标签。先在 popup、书签仪表盘或智能分析里添加标签，之后这里会显示使用频率和整理操作。
      </div>
    `
    return
  }

  dom.tagManagementResults.innerHTML = summary.stats.slice(0, 80).map((stat) => renderTagUsageCard(stat)).join('')
}

function renderTagUsageCard(stat: BookmarkTagUsageStat): string {
  const examples = stat.examples.slice(0, 3).map((record) => {
    const title = record.title || record.url || record.bookmarkId
    return `<li>${escapeHtml(title)}</li>`
  }).join('')
  const latest = stat.latestUpdatedAt ? new Date(stat.latestUpdatedAt).toLocaleString('zh-CN') : '未知'

  return `
    <article class="tag-management-card">
      <div class="tag-management-card-main">
        <button class="tag-management-chip" type="button" data-tag-fill="${escapeAttr(stat.tag)}" aria-label="选择标签 ${escapeAttr(stat.tag)}">
          ${escapeHtml(stat.tag)}
        </button>
        <div class="tag-management-card-copy">
          <strong>${stat.count} 次使用</strong>
          <p>手动 ${stat.manualCount} · AI ${stat.aiCount} · 最近更新 ${escapeHtml(latest)}</p>
        </div>
      </div>
      <ul class="tag-management-examples" aria-label="${escapeAttr(stat.tag)} 标签示例书签">
        ${examples || '<li>暂无示例书签</li>'}
      </ul>
    </article>
  `
}
