import { STORAGE_KEYS } from './constants.js'
import { getLocalStorage } from './storage.js'
import { normalizeText } from './text.js'

export interface ContentSnapshotSettings {
  version: 1
  enabled: boolean
  autoCaptureOnBookmarkCreate: boolean
  saveFullText: boolean
  fullTextSearchEnabled: boolean
  localOnlyNoAiUpload: boolean
}

export interface ContentSnapshotRecord {
  snapshotId: string
  bookmarkId: string
  url: string
  title: string
  summary: string
  headings: string[]
  canonicalUrl: string
  finalUrl: string
  contentType: string
  source: string
  extractionStatus: string
  extractedAt: number
  hasFullText: boolean
  fullTextBytes: number
  fullTextStorage: 'none' | 'local' | 'idb'
  fullText?: string
  fullTextRef?: string
  warnings: string[]
}

export interface ContentSnapshotIndex {
  version: 1
  updatedAt: number
  records: Record<string, ContentSnapshotRecord>
}

export const DEFAULT_CONTENT_SNAPSHOT_SETTINGS: ContentSnapshotSettings = {
  version: 1,
  enabled: true,
  autoCaptureOnBookmarkCreate: true,
  saveFullText: true,
  fullTextSearchEnabled: true,
  localOnlyNoAiUpload: false
}

export function normalizeContentSnapshotSettings(raw: unknown): ContentSnapshotSettings {
  const source = normalizeContentSnapshotObject(raw)
  return {
    version: 1,
    enabled: source.enabled !== false,
    autoCaptureOnBookmarkCreate: source.autoCaptureOnBookmarkCreate !== false,
    saveFullText: source.saveFullText !== false,
    fullTextSearchEnabled: source.fullTextSearchEnabled !== false,
    localOnlyNoAiUpload: source.localOnlyNoAiUpload === true
  }
}

export function normalizeContentSnapshotIndex(raw: unknown): ContentSnapshotIndex {
  const source = normalizeContentSnapshotObject(raw)
  const rawRecords = normalizeContentSnapshotObject(source.records)
  const records: Record<string, ContentSnapshotRecord> = {}

  for (const [bookmarkId, value] of Object.entries(rawRecords)) {
    const record = normalizeContentSnapshotRecord(value)
    if (record.bookmarkId && record.snapshotId) {
      records[String(bookmarkId)] = record
    }
  }

  return {
    version: 1,
    updatedAt: Number(source.updatedAt) || 0,
    records
  }
}

export async function loadContentSnapshotSettings(): Promise<ContentSnapshotSettings> {
  const stored = await getLocalStorage([STORAGE_KEYS.contentSnapshotSettings])
  return normalizeContentSnapshotSettings(stored[STORAGE_KEYS.contentSnapshotSettings])
}

export async function loadContentSnapshotIndex(): Promise<ContentSnapshotIndex> {
  const stored = await getLocalStorage([STORAGE_KEYS.contentSnapshotIndex])
  return normalizeContentSnapshotIndex(stored[STORAGE_KEYS.contentSnapshotIndex])
}

export function buildContentSnapshotSearchText(
  record: ContentSnapshotRecord | null | undefined,
  options: { includeFullText?: boolean } = {}
): string {
  if (!record) {
    return ''
  }

  return normalizeText([
    record.summary,
    record.contentType,
    record.source,
    record.extractionStatus,
    record.finalUrl,
    record.canonicalUrl,
    ...(record.headings || []),
    options.includeFullText && record.fullTextStorage === 'local' ? record.fullText : ''
  ].join(' '))
}

export function buildContentSnapshotSearchMap(
  index: ContentSnapshotIndex,
  options: { includeFullText?: boolean } = {}
): Map<string, string> {
  const searchMap = new Map<string, string>()
  for (const record of Object.values(index.records)) {
    const text = buildContentSnapshotSearchText(record, options)
    if (text) {
      searchMap.set(record.bookmarkId, text)
    }
  }
  return searchMap
}

export function normalizeContentSnapshotRecord(raw: unknown): ContentSnapshotRecord {
  const source = normalizeContentSnapshotObject(raw)
  const fullTextStorage = ['local', 'idb'].includes(String(source.fullTextStorage))
    ? String(source.fullTextStorage) as ContentSnapshotRecord['fullTextStorage']
    : 'none'
  return {
    snapshotId: String(source.snapshotId || '').trim(),
    bookmarkId: String(source.bookmarkId || '').trim(),
    url: String(source.url || '').trim(),
    title: cleanContentSnapshotText(source.title || ''),
    summary: cleanContentSnapshotText(source.summary || ''),
    headings: normalizeContentSnapshotTextList(source.headings, 28, 120),
    canonicalUrl: String(source.canonicalUrl || '').trim(),
    finalUrl: String(source.finalUrl || '').trim(),
    contentType: cleanContentSnapshotText(source.contentType || ''),
    source: cleanContentSnapshotText(source.source || ''),
    extractionStatus: cleanContentSnapshotText(source.extractionStatus || ''),
    extractedAt: Number(source.extractedAt) || 0,
    hasFullText: source.hasFullText === true,
    fullTextBytes: Number(source.fullTextBytes) || 0,
    fullTextStorage,
    fullText: fullTextStorage === 'local' ? cleanContentSnapshotText(source.fullText || '') : undefined,
    fullTextRef: fullTextStorage === 'idb' ? String(source.fullTextRef || source.snapshotId || '').trim() : undefined,
    warnings: normalizeContentSnapshotTextList(source.warnings, 8, 160)
  }
}

export function cleanContentSnapshotText(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

export function truncateContentSnapshotText(value: unknown, limit: number): string {
  const text = cleanContentSnapshotText(value)
  return text.length > limit ? text.slice(0, limit).trim() : text
}

export function normalizeContentSnapshotTextList(values: unknown, limit: number, itemLimit: number): string[] {
  const items = Array.isArray(values) ? values : []
  const seen = new Set<string>()
  const output: string[] = []
  for (const item of items) {
    const text = truncateContentSnapshotText(item, itemLimit)
    const key = normalizeText(text)
    if (!text || seen.has(key)) {
      continue
    }
    seen.add(key)
    output.push(text)
    if (output.length >= limit) {
      break
    }
  }
  return output
}

export function normalizeContentSnapshotObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}
