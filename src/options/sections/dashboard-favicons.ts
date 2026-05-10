export const DASHBOARD_FAVICON_SIZE = 32
export const DASHBOARD_FAVICON_WARMUP_CONCURRENCY = 1
export const DASHBOARD_FAVICON_WARMUP_BATCH_SIZE = 4
export const DASHBOARD_FAVICON_WARMUP_BATCH_DELAY_MS = 160
export const DASHBOARD_FAVICON_WARMUP_OVERSCAN_ROWS = 2
export const DASHBOARD_FAVICON_CACHE_LIMIT = 2500
export const DASHBOARD_FAVICON_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
export const DASHBOARD_FAVICON_FAILURE_RETRY_MS = 24 * 60 * 60 * 1000
export const DASHBOARD_FAVICON_FETCH_VERSION = 3
export const DASHBOARD_REMOTE_FAVICON_FETCH_TIMEOUT_MS = 6000
export const DASHBOARD_REMOTE_FAVICON_MAX_BYTES = 384 * 1024
export const DASHBOARD_REMOTE_FAVICON_MAX_HTML_BYTES = 256 * 1024

export interface DashboardFaviconWarmupItem {
  id: string
  pageUrl: string
  faviconUrl: string
}

export interface DashboardFaviconCacheEntry {
  pageUrl: string
  iconUrl: string
  updatedAt: number
  failedAt?: number
  version?: number
}

export type DashboardFaviconCache = Record<string, DashboardFaviconCacheEntry>

export interface DashboardFaviconWarmupQueueOptions {
  bookmarks: readonly Pick<{ id: string; url: string }, 'id' | 'url'>[]
  faviconEndpointUrl: string
  remoteCache?: DashboardFaviconCache
  size?: number
  maxConcurrent?: number
  batchSize?: number
  batchDelayMs?: number
  waitForIdle?: (callback: () => void) => void
  loadFavicon?: (url: string, item: DashboardFaviconWarmupItem) => Promise<unknown> | unknown
  onWarm?: (item: DashboardFaviconWarmupItem) => void
  onError?: (item: DashboardFaviconWarmupItem, error: unknown) => void
}

export interface DashboardFaviconWarmupSnapshot {
  pendingCount: number
  activeCount: number
  warmedCount: number
  failedCount: number
  canceled: boolean
}

export interface DashboardFaviconWarmupQueue {
  start: () => void
  cancel: () => void
  getSnapshot: () => DashboardFaviconWarmupSnapshot
}

export interface DashboardFaviconCacheStore {
  getCache: () => DashboardFaviconCache
  upsert: (pageUrl: string, iconUrl: string, now?: number) => void
  markFailed: (pageUrl: string, now?: number) => void
}

export interface DashboardFaviconWarmOptions {
  canFetchRemote?: (pageUrl: string) => Promise<boolean> | boolean
}

export function getDashboardFaviconCacheKey(pageUrl: string): string {
  try {
    return new URL(pageUrl).href
  } catch {
    return String(pageUrl || '').trim()
  }
}

export function isDashboardSafeImageUrl(iconUrl: string): boolean {
  const normalizedUrl = String(iconUrl || '').trim()
  if (!normalizedUrl) {
    return false
  }

  if (normalizedUrl.startsWith('data:image/')) {
    return true
  }

  try {
    const parsedUrl = new URL(normalizedUrl)
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch {
    return false
  }
}

export function getDashboardCachedFaviconEntry(
  cache: DashboardFaviconCache,
  pageUrl: string,
  now = Date.now()
): DashboardFaviconCacheEntry | null {
  const key = getDashboardFaviconCacheKey(pageUrl)
  const entry = key ? cache[key] : null
  if (!entry || entry.pageUrl !== key || !entry.iconUrl) {
    return null
  }

  if (now - entry.updatedAt > DASHBOARD_FAVICON_CACHE_MAX_AGE_MS) {
    return null
  }

  return entry
}

export function shouldSkipDashboardRemoteFaviconFetch(
  cache: DashboardFaviconCache,
  pageUrl: string,
  now = Date.now()
): boolean {
  const key = getDashboardFaviconCacheKey(pageUrl)
  const entry = key ? cache[key] : null
  return shouldSkipDashboardRemoteFaviconFetchForEntry(entry, now)
}

export function hasFreshDashboardFaviconCacheEntry(
  cache: DashboardFaviconCache,
  pageUrl: string,
  now = Date.now()
): boolean {
  return Boolean(getDashboardCachedFaviconEntry(cache, pageUrl, now))
}

export function normalizeDashboardFaviconCache(
  rawCache: unknown,
  {
    now = Date.now(),
    limit = DASHBOARD_FAVICON_CACHE_LIMIT
  }: {
    now?: number
    limit?: number
  } = {}
): DashboardFaviconCache {
  if (!rawCache || typeof rawCache !== 'object' || Array.isArray(rawCache)) {
    return {}
  }

  const entries: Array<[string, DashboardFaviconCacheEntry]> = []
  for (const [rawKey, rawEntry] of Object.entries(rawCache as Record<string, unknown>)) {
    if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
      continue
    }

    const source = rawEntry as Record<string, unknown>
    const pageUrl = getDashboardFaviconCacheKey(String(source.pageUrl || rawKey || '').trim())
    if (!pageUrl) {
      continue
    }

    const updatedAt = getDashboardFiniteTimestamp(source.updatedAt, 0)
    const failedAt = getDashboardFiniteTimestamp(source.failedAt, 0)
    const iconUrl = String(source.iconUrl || '').trim()
    if (iconUrl && !isDashboardSafeImageUrl(iconUrl)) {
      continue
    }

    if (iconUrl) {
      if (
        Number(source.version) !== DASHBOARD_FAVICON_FETCH_VERSION ||
        !updatedAt ||
        now - updatedAt > DASHBOARD_FAVICON_CACHE_MAX_AGE_MS
      ) {
        continue
      }
      entries.push([pageUrl, {
        pageUrl,
        iconUrl,
        updatedAt,
        version: DASHBOARD_FAVICON_FETCH_VERSION
      }])
      continue
    }

    if (
      failedAt &&
      Number(source.version) === DASHBOARD_FAVICON_FETCH_VERSION &&
      now - failedAt <= DASHBOARD_FAVICON_FAILURE_RETRY_MS
    ) {
      entries.push([pageUrl, {
        pageUrl,
        iconUrl: '',
        updatedAt: 0,
        failedAt,
        version: DASHBOARD_FAVICON_FETCH_VERSION
      }])
    }
  }

  entries.sort((left, right) => {
    const leftTime = left[1].updatedAt || left[1].failedAt || 0
    const rightTime = right[1].updatedAt || right[1].failedAt || 0
    return rightTime - leftTime || left[0].localeCompare(right[0])
  })

  return Object.fromEntries(entries.slice(0, clampDashboardInteger(limit, 1, DASHBOARD_FAVICON_CACHE_LIMIT, DASHBOARD_FAVICON_CACHE_LIMIT)))
}

export function buildDashboardFaviconUrl(
  faviconEndpointUrl: string,
  pageUrl: string,
  {
    size = DASHBOARD_FAVICON_SIZE,
    cacheToken = ''
  }: {
    size?: number
    cacheToken?: number | string
  } = {}
): string {
  if (!faviconEndpointUrl || !pageUrl) {
    return ''
  }

  const faviconUrl = new URL(faviconEndpointUrl)
  faviconUrl.searchParams.set('pageUrl', pageUrl)
  faviconUrl.searchParams.set('size', String(clampDashboardInteger(size, 16, 128, DASHBOARD_FAVICON_SIZE)))
  faviconUrl.searchParams.set('cache', '1')
  if (cacheToken) {
    faviconUrl.searchParams.set('refresh', String(cacheToken))
  }
  return faviconUrl.toString()
}

export function buildDashboardFaviconWarmupItems({
  bookmarks,
  faviconEndpointUrl,
  remoteCache = {},
  size = DASHBOARD_FAVICON_SIZE
}: Pick<DashboardFaviconWarmupQueueOptions, 'bookmarks' | 'faviconEndpointUrl' | 'remoteCache' | 'size'>): DashboardFaviconWarmupItem[] {
  const now = Date.now()
  const seenPageUrls = new Set<string>()
  const seenOrigins = new Set<string>()
  const seenFaviconUrls = new Set<string>()
  const items: DashboardFaviconWarmupItem[] = []

  for (const bookmark of bookmarks) {
    const pageUrl = String(bookmark.url || '').trim()
    const cacheKey = getDashboardFaviconCacheKey(pageUrl)
    const cachedEntry = cacheKey ? remoteCache[cacheKey] : null
    const originKey = getDashboardFaviconOriginKey(pageUrl)
    const defaultFaviconUrl = getDashboardDefaultRemoteFaviconUrl(pageUrl)
    if (
      !pageUrl ||
      !isDashboardRemoteFaviconPageUrl(pageUrl) ||
      seenPageUrls.has(cacheKey || pageUrl) ||
      (originKey && seenOrigins.has(originKey)) ||
      (defaultFaviconUrl && seenFaviconUrls.has(defaultFaviconUrl)) ||
      shouldSkipDashboardRemoteFaviconFetchForEntry(cachedEntry, now)
    ) {
      continue
    }
    seenPageUrls.add(cacheKey || pageUrl)
    if (originKey) {
      seenOrigins.add(originKey)
    }
    if (defaultFaviconUrl) {
      seenFaviconUrls.add(defaultFaviconUrl)
    }
    items.push({
      id: String(bookmark.id || pageUrl),
      pageUrl: cacheKey || pageUrl,
      faviconUrl: buildDashboardFaviconUrl(faviconEndpointUrl, pageUrl, { size })
    })
  }

  return items
}

export function createDashboardFaviconWarmupQueue(
  options: DashboardFaviconWarmupQueueOptions
): DashboardFaviconWarmupQueue {
  const maxConcurrent = clampDashboardInteger(
    options.maxConcurrent,
    1,
    6,
    DASHBOARD_FAVICON_WARMUP_CONCURRENCY
  )
  const batchSize = clampDashboardInteger(
    options.batchSize,
    1,
    32,
    DASHBOARD_FAVICON_WARMUP_BATCH_SIZE
  )
  const batchDelayMs = clampDashboardInteger(
    options.batchDelayMs,
    0,
    2000,
    DASHBOARD_FAVICON_WARMUP_BATCH_DELAY_MS
  )
  const waitForIdle = options.waitForIdle || waitForDashboardIdle
  const loadFavicon = options.loadFavicon || preloadDashboardFavicon
  const queue = buildDashboardFaviconWarmupItems(options)
  const snapshot: DashboardFaviconWarmupSnapshot = {
    pendingCount: queue.length,
    activeCount: 0,
    warmedCount: 0,
    failedCount: 0,
    canceled: false
  }
  let started = false
  let scheduled = false
  let batchRemaining = batchSize

  const scheduleDrain = () => {
    if (!started || snapshot.canceled || scheduled) {
      return
    }
    scheduled = true
    waitForIdle(() => {
      scheduled = false
      drain()
    })
  }

  const scheduleNextBatch = () => {
    if (!started || snapshot.canceled || scheduled) {
      return
    }
    scheduled = true
    globalThis.setTimeout(() => {
      scheduled = false
      batchRemaining = batchSize
      drain()
    }, batchDelayMs)
  }

  const settle = (item: DashboardFaviconWarmupItem, error?: unknown) => {
    snapshot.activeCount = Math.max(0, snapshot.activeCount - 1)
    if (snapshot.canceled) {
      return
    }
    if (error) {
      snapshot.failedCount += 1
      options.onError?.(item, error)
    } else {
      snapshot.warmedCount += 1
      options.onWarm?.(item)
    }
    drain()
  }

  const drain = () => {
    if (!started || snapshot.canceled) {
      return
    }

    while (snapshot.activeCount < maxConcurrent && batchRemaining > 0 && queue.length > 0) {
      const item = queue.shift()
      if (!item) {
        break
      }
      snapshot.pendingCount = queue.length
      snapshot.activeCount += 1
      batchRemaining -= 1
      Promise.resolve()
        .then(() => loadFavicon(item.faviconUrl, item))
        .then(() => settle(item))
        .catch((error) => settle(item, error))
    }

    snapshot.pendingCount = queue.length
    if (queue.length <= 0 || snapshot.activeCount >= maxConcurrent) {
      return
    }
    if (batchRemaining <= 0) {
      scheduleNextBatch()
      return
    }
    scheduleDrain()
  }

  return {
    start() {
      if (started || snapshot.canceled) {
        return
      }
      started = true
      scheduleDrain()
    },
    cancel() {
      snapshot.canceled = true
      queue.length = 0
      snapshot.pendingCount = 0
    },
    getSnapshot() {
      return { ...snapshot }
    }
  }
}

export function getDashboardFaviconEndpointUrl(): string {
  if (typeof chrome === 'undefined') {
    return ''
  }

  if (chrome.runtime?.getURL) {
    return chrome.runtime.getURL('/_favicon/')
  }

  const runtimeId = chrome.runtime?.id || ''
  return runtimeId ? `chrome-extension://${runtimeId}/_favicon/` : ''
}

export function preloadDashboardFavicon(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.addEventListener('load', () => resolve(image), { once: true })
    image.addEventListener('error', () => reject(new Error('dashboard favicon warmup failed')), { once: true })
    image.setAttribute('src', url)
  })
}

export async function warmDashboardFavicon(
  chromeFaviconUrl: string,
  item: DashboardFaviconWarmupItem,
  cacheStore: DashboardFaviconCacheStore,
  options: DashboardFaviconWarmOptions = {}
): Promise<void> {
  try {
    await preloadDashboardFavicon(chromeFaviconUrl)
  } catch {}

  if (
    hasFreshDashboardFaviconCacheEntry(cacheStore.getCache(), item.pageUrl) ||
    shouldSkipDashboardRemoteFaviconFetch(cacheStore.getCache(), item.pageUrl)
  ) {
    return
  }

  const canFetchRemote = await Promise.resolve(options.canFetchRemote?.(item.pageUrl) ?? true)
  if (!canFetchRemote) {
    cacheStore.markFailed(item.pageUrl)
    return
  }

  const defaultRemoteFaviconUrl = getDashboardDefaultRemoteFaviconUrl(item.pageUrl)
  if (defaultRemoteFaviconUrl) {
    try {
      const dataUrl = await fetchDashboardFaviconAsDataUrl(defaultRemoteFaviconUrl, {
        cache: 'force-cache',
        credentials: 'omit',
        redirect: 'follow',
        referrerPolicy: 'no-referrer'
      })
      cacheStore.upsert(item.pageUrl, dataUrl)
      return
    } catch {}
  }

  try {
    const iconUrl = await discoverDashboardRemoteFavicon(item.pageUrl)
    const dataUrl = await fetchDashboardFaviconAsDataUrl(iconUrl, {
      cache: 'force-cache',
      credentials: 'omit',
      redirect: 'follow',
      referrerPolicy: 'no-referrer'
    })
    cacheStore.upsert(item.pageUrl, dataUrl)
  } catch (error) {
    cacheStore.markFailed(item.pageUrl)
    throw error
  }
}

export function clampDashboardInteger(value: unknown, min: number, max: number, fallback: number): number {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return fallback
  }
  return Math.max(min, Math.min(Math.trunc(numberValue), max))
}

function isDashboardRemoteFaviconPageUrl(pageUrl: string): boolean {
  try {
    const parsedUrl = new URL(pageUrl)
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch {
    return false
  }
}

function shouldSkipDashboardRemoteFaviconFetchForEntry(
  entry: DashboardFaviconCacheEntry | null | undefined,
  now = Date.now()
): boolean {
  if (hasFreshDashboardFaviconCacheEntryForEntry(entry, now)) {
    return true
  }

  return shouldSkipDashboardRemoteFaviconRetryForEntry(entry, now)
}

function hasFreshDashboardFaviconCacheEntryForEntry(
  entry: DashboardFaviconCacheEntry | null | undefined,
  now = Date.now()
): boolean {
  if (!entry) {
    return false
  }

  return Boolean(
    entry.iconUrl &&
    entry.version === DASHBOARD_FAVICON_FETCH_VERSION &&
    now - entry.updatedAt <= DASHBOARD_FAVICON_CACHE_MAX_AGE_MS
  )
}

function shouldSkipDashboardRemoteFaviconRetryForEntry(
  entry: DashboardFaviconCacheEntry | null | undefined,
  now = Date.now()
): boolean {
  if (!entry) {
    return false
  }

  return Boolean(
    entry.failedAt &&
    entry.version === DASHBOARD_FAVICON_FETCH_VERSION &&
    now - entry.failedAt < DASHBOARD_FAVICON_FAILURE_RETRY_MS
  )
}

function getDashboardFiniteTimestamp(value: unknown, fallback: number): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback
}

function waitForDashboardIdle(callback: () => void): void {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(() => callback(), { timeout: 500 })
    return
  }
  globalThis.setTimeout(callback, 16)
}

function getDashboardDefaultRemoteFaviconUrl(pageUrl: string): string {
  try {
    return new URL('/favicon.ico', pageUrl).href
  } catch {
    return ''
  }
}

function getDashboardFaviconOriginKey(pageUrl: string): string {
  try {
    return new URL(pageUrl).origin
  } catch {
    return ''
  }
}

async function discoverDashboardRemoteFavicon(pageUrl: string): Promise<string> {
  const pageResponse = await fetchDashboardWithTimeout(pageUrl, {
    cache: 'force-cache',
    credentials: 'omit',
    redirect: 'follow',
    referrerPolicy: 'no-referrer'
  })

  if (!pageResponse.ok) {
    return new URL('/favicon.ico', pageResponse.url || pageUrl).href
  }

  const contentType = (pageResponse.headers.get('content-type') || '').toLowerCase()
  if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    return new URL('/favicon.ico', pageResponse.url || pageUrl).href
  }

  const html = (await pageResponse.text()).slice(0, DASHBOARD_REMOTE_FAVICON_MAX_HTML_BYTES)
  return getDashboardBestFaviconCandidate(html, pageResponse.url || pageUrl) ||
    new URL('/favicon.ico', pageResponse.url || pageUrl).href
}

function getDashboardBestFaviconCandidate(html: string, baseUrl: string): string {
  const matches = [...String(html || '').matchAll(/<link\b[^>]*>/gi)]
  const candidates: Array<{ url: string; score: number }> = []

  for (const match of matches) {
    const tag = match[0] || ''
    const rel = getDashboardHtmlAttribute(tag, 'rel').toLowerCase()
    if (!rel || !/\b(?:icon|shortcut icon|apple-touch-icon|mask-icon)\b/i.test(rel)) {
      continue
    }

    const href = getDashboardHtmlAttribute(tag, 'href')
    if (!href) {
      continue
    }

    try {
      const url = new URL(decodeHtmlAttributeValue(href), baseUrl).href
      const type = getDashboardHtmlAttribute(tag, 'type').toLowerCase()
      const sizes = getDashboardHtmlAttribute(tag, 'sizes').toLowerCase()
      candidates.push({
        url,
        score: getDashboardFaviconCandidateScore({ rel, type, sizes, url })
      })
    } catch {}
  }

  candidates.sort((left, right) => right.score - left.score)
  return candidates[0]?.url || ''
}

function getDashboardHtmlAttribute(tag: string, name: string): string {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>` + '`' + `]+))`, 'i')
  const match = String(tag || '').match(pattern)
  return String(match?.[1] || match?.[2] || match?.[3] || '').trim()
}

function decodeHtmlAttributeValue(value: string): string {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function getDashboardFaviconCandidateScore({
  rel,
  type,
  sizes,
  url
}: {
  rel: string
  type: string
  sizes: string
  url: string
}): number {
  let score = 0
  if (/\bicon\b/.test(rel)) {
    score += 20
  }
  if (/\bapple-touch-icon\b/.test(rel)) {
    score += 12
  }
  if (type.includes('svg') || /\.svg(?:$|[?#])/i.test(url)) {
    score += 8
  } else if (type.includes('png') || /\.png(?:$|[?#])/i.test(url)) {
    score += 6
  } else if (type.includes('webp') || /\.webp(?:$|[?#])/i.test(url)) {
    score += 5
  } else if (/\.ico(?:$|[?#])/i.test(url)) {
    score += 3
  }

  const sizeMatch = sizes.match(/\b(\d{2,4})x(\d{2,4})\b/)
  if (sizeMatch) {
    const iconSize = Math.min(Number(sizeMatch[1]) || 0, Number(sizeMatch[2]) || 0)
    score += Math.max(0, 64 - Math.abs(iconSize - 64)) / 4
  } else if (sizes.includes('any')) {
    score += 10
  }

  return score
}

async function fetchDashboardFaviconAsDataUrl(iconUrl: string, options: RequestInit = {}): Promise<string> {
  const response = await fetchDashboardWithTimeout(iconUrl, {
    cache: 'force-cache',
    redirect: 'follow',
    referrerPolicy: 'no-referrer',
    ...options
  })
  if (!response.ok) {
    throw new Error(`favicon request failed: ${response.status}`)
  }

  const declaredLength = Number(response.headers.get('content-length') || 0)
  if (declaredLength > DASHBOARD_REMOTE_FAVICON_MAX_BYTES) {
    throw new Error('favicon is too large')
  }

  const blob = await response.blob()
  if (!blob.size || blob.size > DASHBOARD_REMOTE_FAVICON_MAX_BYTES) {
    throw new Error('favicon response is not a supported image')
  }
  const mimeType = await resolveDashboardFaviconMimeType(
    blob,
    iconUrl,
    response.headers.get('content-type') || blob.type || ''
  )
  if (!mimeType) {
    throw new Error('favicon response is not a supported image')
  }
  const typedBlob = blob.type === mimeType ? blob : blob.slice(0, blob.size, mimeType)

  return await readDashboardBlobAsDataUrl(typedBlob)
}

async function resolveDashboardFaviconMimeType(
  blob: Blob,
  iconUrl: string,
  declaredType: string
): Promise<string> {
  const normalizedType = normalizeDashboardMimeType(declaredType)
  if (normalizedType.startsWith('image/')) {
    return normalizedType
  }

  const signatureType = await inferDashboardFaviconMimeTypeFromBlob(blob)
  if (signatureType) {
    return signatureType
  }

  const extensionType = inferDashboardFaviconMimeTypeFromUrl(iconUrl)
  if (!normalizedType && extensionType) {
    return extensionType
  }

  return ''
}

function normalizeDashboardMimeType(value: string): string {
  return String(value || '').split(';')[0]?.trim().toLowerCase() || ''
}

function inferDashboardFaviconMimeTypeFromUrl(iconUrl: string): string {
  let pathname = ''
  try {
    pathname = new URL(iconUrl).pathname.toLowerCase()
  } catch {
    pathname = String(iconUrl || '').toLowerCase()
  }

  if (pathname.endsWith('.svg') || pathname.endsWith('.svgz')) {
    return 'image/svg+xml'
  }
  if (pathname.endsWith('.png')) {
    return 'image/png'
  }
  if (pathname.endsWith('.webp')) {
    return 'image/webp'
  }
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) {
    return 'image/jpeg'
  }
  if (pathname.endsWith('.gif')) {
    return 'image/gif'
  }
  if (pathname.endsWith('.ico') || pathname.endsWith('/favicon')) {
    return 'image/x-icon'
  }

  return ''
}

async function inferDashboardFaviconMimeTypeFromBlob(blob: Blob): Promise<string> {
  const buffer = await blob.slice(0, 512).arrayBuffer()
  const bytes = new Uint8Array(buffer)
  if (bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47) {
    return 'image/png'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (bytes.length >= 4 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38) {
    return 'image/gif'
  }
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) {
    return 'image/x-icon'
  }
  if (bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50) {
    return 'image/webp'
  }

  const text = new TextDecoder().decode(bytes).trimStart().slice(0, 160).toLowerCase()
  if (text.startsWith('<svg') || (text.startsWith('<?xml') && text.includes('<svg'))) {
    return 'image/svg+xml'
  }

  return ''
}

function fetchDashboardWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort()
  }, DASHBOARD_REMOTE_FAVICON_FETCH_TIMEOUT_MS)

  return fetch(url, {
    ...options,
    signal: controller.signal
  }).finally(() => {
    globalThis.clearTimeout(timeoutId)
  })
}

function readDashboardBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      const result = String(reader.result || '')
      if (result.startsWith('data:image/')) {
        resolve(result)
      } else {
        reject(new Error('favicon data url is invalid'))
      }
    }, { once: true })
    reader.addEventListener('error', () => {
      reject(reader.error || new Error('favicon read failed'))
    }, { once: true })
    reader.readAsDataURL(blob)
  })
}
