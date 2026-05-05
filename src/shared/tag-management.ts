import {
  getEffectiveBookmarkTags,
  normalizeBookmarkTagIndex,
  normalizeBookmarkTags,
  type BookmarkTagIndex,
  type BookmarkTagRecord
} from './bookmark-tags.js'

export interface BookmarkTagUsageExample {
  bookmarkId: string
  title: string
  url: string
  path: string
}

export interface BookmarkTagUsageStat {
  tag: string
  normalizedTag: string
  count: number
  manualCount: number
  aiCount: number
  latestUpdatedAt: number
  examples: BookmarkTagUsageExample[]
}

export interface BookmarkTagManagementResult {
  index: BookmarkTagIndex
  affectedRecords: number
  removedRecords: number
}

export interface BookmarkTagManagementOptions {
  now?: number
}

const TAG_USAGE_EXAMPLE_LIMIT = 3

export function buildBookmarkTagUsageStats(
  index: unknown,
  options: { exampleLimit?: number } = {}
): BookmarkTagUsageStat[] {
  const normalized = normalizeBookmarkTagIndex(index)
  const stats = new Map<string, BookmarkTagUsageStat>()
  const exampleLimit = Math.max(0, Math.floor(options.exampleLimit ?? TAG_USAGE_EXAMPLE_LIMIT))

  for (const record of Object.values(normalized.records)) {
    const manualTags = normalizeBookmarkTags(record.manualTags)
    const effectiveTags = getEffectiveBookmarkTags(record)
    const aiTags = normalizeBookmarkTags(record.tags)
    const tags = effectiveTags.length ? effectiveTags : aiTags

    for (const tag of tags) {
      const normalizedTag = normalizeManagedTag(tag)
      if (!normalizedTag) {
        continue
      }

      const stat = stats.get(normalizedTag) || {
        tag,
        normalizedTag,
        count: 0,
        manualCount: 0,
        aiCount: 0,
        latestUpdatedAt: 0,
        examples: []
      }
      stat.count += 1
      if (manualTags.some((manualTag) => normalizeManagedTag(manualTag) === normalizedTag)) {
        stat.manualCount += 1
      } else {
        stat.aiCount += 1
      }
      stat.latestUpdatedAt = Math.max(stat.latestUpdatedAt, Number(record.updatedAt) || 0)
      if (stat.examples.length < exampleLimit) {
        stat.examples.push(createTagUsageExample(record))
      }
      stats.set(normalizedTag, stat)
    }
  }

  return [...stats.values()].sort((left, right) =>
    right.count - left.count ||
    right.latestUpdatedAt - left.latestUpdatedAt ||
    left.tag.localeCompare(right.tag, 'zh-CN')
  )
}

export function renameBookmarkTag(
  index: unknown,
  fromTag: unknown,
  toTag: unknown,
  options: BookmarkTagManagementOptions = {}
): BookmarkTagManagementResult {
  const sourceTag = normalizeManagedTag(fromTag)
  const targetTags = normalizeBookmarkTags([toTag], 1)
  const targetTag = targetTags[0] || ''
  const targetKey = normalizeManagedTag(targetTag)

  if (!sourceTag || !targetKey) {
    return {
      index: normalizeBookmarkTagIndex(index),
      affectedRecords: 0,
      removedRecords: 0
    }
  }

  return transformBookmarkTagIndex(index, options, (record) => {
    const nextManualTags = replaceTagValues(record.manualTags, sourceTag, targetTag)
    const nextAiTags = replaceTagValues(record.tags, sourceTag, targetTag)
    return {
      ...record,
      manualTags: nextManualTags.length ? nextManualTags : undefined,
      tags: nextAiTags
    }
  })
}

export function mergeBookmarkTags(
  index: unknown,
  fromTags: unknown[],
  toTag: unknown,
  options: BookmarkTagManagementOptions = {}
): BookmarkTagManagementResult {
  const sourceTags = new Set(fromTags.map(normalizeManagedTag).filter(Boolean))
  const targetTags = normalizeBookmarkTags([toTag], 1)
  const targetTag = targetTags[0] || ''
  const targetKey = normalizeManagedTag(targetTag)

  if (!sourceTags.size || !targetKey) {
    return {
      index: normalizeBookmarkTagIndex(index),
      affectedRecords: 0,
      removedRecords: 0
    }
  }
  sourceTags.delete(targetKey)
  if (!sourceTags.size) {
    return {
      index: normalizeBookmarkTagIndex(index),
      affectedRecords: 0,
      removedRecords: 0
    }
  }

  return transformBookmarkTagIndex(index, options, (record) => {
    const nextManualTags = mergeTagValues(record.manualTags, sourceTags, targetTag)
    const nextAiTags = mergeTagValues(record.tags, sourceTags, targetTag)
    return {
      ...record,
      manualTags: nextManualTags.length ? nextManualTags : undefined,
      tags: nextAiTags
    }
  })
}

export function deleteBookmarkTags(
  index: unknown,
  tags: unknown[],
  options: BookmarkTagManagementOptions = {}
): BookmarkTagManagementResult {
  const targetTags = new Set(tags.map(normalizeManagedTag).filter(Boolean))
  if (!targetTags.size) {
    return {
      index: normalizeBookmarkTagIndex(index),
      affectedRecords: 0,
      removedRecords: 0
    }
  }

  return transformBookmarkTagIndex(index, options, (record) => {
    const nextManualTags = removeTagValues(record.manualTags, targetTags)
    const nextAiTags = removeTagValues(record.tags, targetTags)
    return {
      ...record,
      manualTags: nextManualTags.length ? nextManualTags : undefined,
      tags: nextAiTags
    }
  })
}

export function pruneEmptyBookmarkTagRecords(
  index: unknown,
  options: BookmarkTagManagementOptions = {}
): BookmarkTagManagementResult {
  return transformBookmarkTagIndex(index, options, (record) => ({
    ...record,
    manualTags: normalizeBookmarkTags(record.manualTags).length
      ? normalizeBookmarkTags(record.manualTags)
      : undefined,
    tags: normalizeBookmarkTags(record.tags)
  }))
}

function transformBookmarkTagIndex(
  index: unknown,
  options: BookmarkTagManagementOptions,
  transform: (record: BookmarkTagRecord) => BookmarkTagRecord
): BookmarkTagManagementResult {
  const normalized = normalizeBookmarkTagIndex(index)
  const records: Record<string, BookmarkTagRecord> = {}
  const now = Number.isFinite(Number(options.now)) && Number(options.now) > 0
    ? Number(options.now)
    : Date.now()
  let affectedRecords = 0
  let removedRecords = 0

  for (const record of Object.values(normalized.records)) {
    const nextRecord = transform(record)
    const changed = !areTagListsEquivalent(record.manualTags, nextRecord.manualTags) ||
      !areTagListsEquivalent(record.tags, nextRecord.tags)
    const normalizedRecord = normalizeBookmarkTagIndex({
      records: {
        [record.bookmarkId]: {
          ...nextRecord,
          updatedAt: changed ? now : nextRecord.updatedAt
        }
      }
    }).records[record.bookmarkId]

    if (!normalizedRecord) {
      removedRecords += 1
      affectedRecords += changed ? 1 : 0
      continue
    }

    if (
      hasManagedTagRecordData(normalizedRecord) ||
      normalizedRecord.summary ||
      normalizedRecord.contentType ||
      normalizedRecord.topics.length ||
      normalizedRecord.aliases.length
    ) {
      records[normalizedRecord.bookmarkId] = normalizedRecord
      affectedRecords += changed ? 1 : 0
    } else {
      removedRecords += 1
      affectedRecords += changed ? 1 : 0
    }
  }

  return {
    index: {
      version: 1,
      updatedAt: affectedRecords || removedRecords ? now : normalized.updatedAt,
      records
    },
    affectedRecords,
    removedRecords
  }
}

function replaceTagValues(rawTags: unknown, fromTag: string, toTag: string): string[] {
  const tags = normalizeBookmarkTags(rawTags)
  return normalizeBookmarkTags(tags.map((tag) =>
    normalizeManagedTag(tag) === fromTag ? toTag : tag
  ))
}

function mergeTagValues(rawTags: unknown, fromTags: Set<string>, toTag: string): string[] {
  const tags = normalizeBookmarkTags(rawTags)
  let matched = false
  const kept: string[] = []
  for (const tag of tags) {
    if (fromTags.has(normalizeManagedTag(tag))) {
      matched = true
      continue
    }
    kept.push(tag)
  }
  if (matched) {
    kept.push(toTag)
  }
  return normalizeBookmarkTags(kept)
}

function removeTagValues(rawTags: unknown, targetTags: Set<string>): string[] {
  return normalizeBookmarkTags(rawTags).filter((tag) => !targetTags.has(normalizeManagedTag(tag)))
}

function hasManagedTagRecordData(record: BookmarkTagRecord): boolean {
  return Boolean(normalizeBookmarkTags(record.manualTags).length || normalizeBookmarkTags(record.tags).length)
}

function areTagListsEquivalent(left: unknown, right: unknown): boolean {
  const leftTags = normalizeBookmarkTags(left)
  const rightTags = normalizeBookmarkTags(right)
  return leftTags.length === rightTags.length &&
    leftTags.every((tag, index) => tag === rightTags[index])
}

function normalizeManagedTag(value: unknown): string {
  return normalizeBookmarkTags([value], 1)[0]?.toLocaleLowerCase() || ''
}

function createTagUsageExample(record: BookmarkTagRecord): BookmarkTagUsageExample {
  return {
    bookmarkId: record.bookmarkId,
    title: record.title,
    url: record.url,
    path: record.path
  }
}

