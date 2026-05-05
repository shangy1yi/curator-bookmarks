import type { BookmarkTagIndex, BookmarkTagRecord } from '../../shared/bookmark-tags.js'
import { getEffectiveBookmarkTags, normalizeBookmarkTagIndex, normalizeBookmarkTags } from '../../shared/bookmark-tags.js'
import type { BookmarkRecord } from '../../shared/types.js'
import { escapeAttr, escapeHtml } from '../shared-options/html.js'
import { dom } from '../shared-options/dom.js'

export interface TagUsageStat {
  tag: string
  count: number
  manualCount: number
  aiCount: number
  latestUpdatedAt: number
  bookmarks: BookmarkTagRecord[]
}

export interface TagManagementSummary {
  totalTags: number
  taggedBookmarks: number
  manualTags: number
  stats: TagUsageStat[]
}

export function buildTagUsageSummary(index: BookmarkTagIndex, bookmarks: BookmarkRecord[] = []): TagManagementSummary {
  const normalized = normalizeBookmarkTagIndex(index)
  const bookmarkIds = new Set(bookmarks.map((bookmark) => bookmark.id))
  const statsByKey = new Map<string, TagUsageStat>()
  let taggedBookmarks = 0

  for (const record of Object.values(normalized.records)) {
    if (bookmarkIds.size && !bookmarkIds.has(record.bookmarkId)) {
      continue
    }

    const effectiveTags = getEffectiveBookmarkTags(record)
    if (!effectiveTags.length) {
      continue
    }

    taggedBookmarks += 1
    const manualTagKeys = new Set(normalizeBookmarkTags(record.manualTags).map((tag) => tag.toLowerCase()))

    for (const tag of effectiveTags) {
      const key = tag.toLowerCase()
      const existing = statsByKey.get(key) || {
        tag,
        count: 0,
        manualCount: 0,
        aiCount: 0,
        latestUpdatedAt: 0,
        bookmarks: []
      }
      existing.count += 1
      if (manualTagKeys.has(key)) {
        existing.manualCount += 1
      } else {
        existing.aiCount += 1
      }
      existing.latestUpdatedAt = Math.max(existing.latestUpdatedAt, Number(record.updatedAt) || 0)
      existing.bookmarks.push(record)
      statsByKey.set(key, existing)
    }
  }

  const stats = [...statsByKey.values()].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count
    }
    return left.tag.localeCompare(right.tag, 'zh-CN')
  })

  return {
    totalTags: stats.length,
    taggedBookmarks,
    manualTags: stats.filter((stat) => stat.manualCount > 0).length,
    stats
  }
}

export function renameTagInIndex(index: BookmarkTagIndex, sourceTag: string, targetTag: string): BookmarkTagIndex {
  const source = normalizeBookmarkTags([sourceTag], 1)[0] || ''
  const target = normalizeBookmarkTags([targetTag], 1)[0] || ''
  if (!source || !target) {
    throw new Error('请输入要重命名的标签和新标签名。')
  }
  if (source.toLowerCase() === target.toLowerCase()) {
    throw new Error('新标签名与原标签相同。')
  }

  return transformTagIndex(index, source, (tags) => {
    return normalizeBookmarkTags(tags.map((tag) => tag.toLowerCase() === source.toLowerCase() ? target : tag))
  })
}

export function deleteTagFromIndex(index: BookmarkTagIndex, sourceTag: string): BookmarkTagIndex {
  const source = normalizeBookmarkTags([sourceTag], 1)[0] || ''
  if (!source) {
    throw new Error('请输入要删除的标签。')
  }

  return transformTagIndex(index, source, (tags) => {
    return tags.filter((tag) => tag.toLowerCase() !== source.toLowerCase())
  })
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

function renderTagUsageCard(stat: TagUsageStat): string {
  const examples = stat.bookmarks.slice(0, 3).map((record) => {
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

function transformTagIndex(
  index: BookmarkTagIndex,
  sourceTag: string,
  transform: (tags: string[]) => string[]
): BookmarkTagIndex {
  const normalized = normalizeBookmarkTagIndex(index)
  const sourceKey = sourceTag.toLowerCase()
  let changed = 0
  const records: BookmarkTagIndex['records'] = {}

  for (const [bookmarkId, record] of Object.entries(normalized.records)) {
    const manualTags = normalizeBookmarkTags(record.manualTags)
    const generatedTags = normalizeBookmarkTags(record.tags)
    const manualHasSource = manualTags.some((tag) => tag.toLowerCase() === sourceKey)
    const generatedHasSource = generatedTags.some((tag) => tag.toLowerCase() === sourceKey)

    if (!manualHasSource && !generatedHasSource) {
      records[bookmarkId] = record
      continue
    }

    changed += 1
    records[bookmarkId] = {
      ...record,
      tags: generatedHasSource ? transform(generatedTags) : generatedTags,
      manualTags: manualTags.length || manualHasSource ? transform(manualTags) : record.manualTags,
      manualUpdatedAt: manualHasSource ? Date.now() : record.manualUpdatedAt,
      updatedAt: Date.now()
    }

    if (!records[bookmarkId].manualTags?.length) {
      delete records[bookmarkId].manualTags
      delete records[bookmarkId].manualUpdatedAt
    }
  }

  if (!changed) {
    throw new Error(`没有找到标签「${sourceTag}」。`)
  }

  return normalizeBookmarkTagIndex({
    ...normalized,
    updatedAt: Date.now(),
    records
  })
}
