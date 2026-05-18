import type { FeaturedBackgroundItem } from './background-gallery.js'
import {
  isFeaturedBackgroundStyleSuitable,
} from './featured-background-style.js'

const FEATURED_REFRESH_TARGET_COUNT = 24
const FEATURED_REFRESH_SOURCE_LIMIT = 36
const FEATURED_REFRESH_CONCURRENCY = 8
const NASA_SEARCH_PAGE_SIZE = 18
const NASA_SEARCH_PAGE_VARIANTS = 4
const FEATURED_BACKGROUND_HIGH_MIN_LONG_EDGE = 2560
const FEATURED_BACKGROUND_HIGH_MIN_SHORT_EDGE = 1440
const NASA_SEARCH_QUERIES = [
  'nasa nebula galaxy Hubble featured image',
  'aurora earth horizon moon stars photograph',
  'nasa space telescope galaxy nebula',
  'mars landscape earth horizon photograph',
  'saturn jupiter planet space photograph'
]
const MET_SEARCH_QUERIES = [
  'landscape photograph',
  'aurora photograph',
  'night sky photograph',
  'mountain photograph',
  'ocean photograph',
  'sunrise photograph'
]
const COMMONS_SEARCH_QUERIES = [
  'landscape photograph featured picture public domain',
  'aurora photograph featured picture public domain',
  'night sky photograph featured picture public domain',
  'mountain photograph featured picture public domain',
  'ocean photograph featured picture public domain'
]
const COMMONS_SEARCH_LIMIT = 40

export interface FeaturedGalleryRefreshState {
  existingItems: FeaturedBackgroundItem[]
  favoriteIds: Iterable<string>
  fetchedItems: FeaturedBackgroundItem[]
}

export interface FeaturedGalleryFetchClient {
  fetchJson: (url: string) => Promise<unknown>
  getImageSize?: (url: string) => Promise<{ width: number; height: number } | null>
}

export interface FeaturedGalleryRefreshOptions {
  refreshSeed?: unknown
}

export const FEATURED_BACKGROUND_REFRESH_ORIGINS = [
  'https://images-api.nasa.gov/*',
  'https://images-assets.nasa.gov/*',
  'https://collectionapi.metmuseum.org/*',
  'https://images.metmuseum.org/*',
  'https://commons.wikimedia.org/*',
  'https://upload.wikimedia.org/*'
]

export function getFeaturedBackgroundResolutionLabel(item: Pick<FeaturedBackgroundItem, 'width' | 'height'>): string {
  const width = Number(item.width)
  const height = Number(item.height)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return ''
  }
  return `${Math.round(width)} x ${Math.round(height)}`
}

export async function fetchFreshFeaturedBackgroundItems(
  client: FeaturedGalleryFetchClient,
  options: FeaturedGalleryRefreshOptions = {}
): Promise<FeaturedBackgroundItem[]> {
  const [nasaItems, metItems, wikimediaItems] = await Promise.all([
    fetchNasaFeaturedItems(client, options).catch(() => []),
    fetchMetFeaturedItems(client, options).catch(() => []),
    fetchWikimediaFeaturedItems(client, options).catch(() => [])
  ])

  const seed = normalizeFeaturedRefreshSeed(options.refreshSeed)
  const merged = rotateFeaturedCandidates(
    dedupeFeaturedItems([
      ...nasaItems,
      ...metItems,
      ...wikimediaItems
    ]),
    seed
  )
  return merged.slice(0, FEATURED_REFRESH_TARGET_COUNT)
}

export function mergeFeaturedGalleryRefresh({
  existingItems,
  favoriteIds,
  fetchedItems
}: FeaturedGalleryRefreshState): FeaturedBackgroundItem[] {
  const favorites = new Set(Array.from(favoriteIds, (id) => String(id || '').trim()).filter(Boolean))
  const merged: FeaturedBackgroundItem[] = []
  const seen = new Set<string>()

  function addItem(item: FeaturedBackgroundItem | null | undefined): void {
    const id = String(item?.id || '').trim()
    if (!item || !id || seen.has(id)) {
      return
    }
    seen.add(id)
    merged.push(item)
  }

  for (const item of existingItems) {
    if (favorites.has(item.id)) {
      addItem(item)
    }
  }
  for (const item of fetchedItems) {
    if (favorites.has(item.id)) {
      addItem(item)
    }
  }
  for (const item of fetchedItems) {
    addItem(item)
  }

  return merged
}

export function isHighResolutionFeaturedBackground(
  width: unknown,
  height: unknown,
  minLongEdge = 1920,
  minShortEdge = 1080
): boolean {
  const numericWidth = Number(width)
  const numericHeight = Number(height)
  if (!Number.isFinite(numericWidth) || !Number.isFinite(numericHeight)) {
    return false
  }

  const longEdge = Math.max(numericWidth, numericHeight)
  const shortEdge = Math.min(numericWidth, numericHeight)
  return longEdge >= minLongEdge && shortEdge >= minShortEdge
}

export function getFeaturedBackgroundResolutionThreshold(
  options: FeaturedGalleryRefreshOptions = {}
): { minLongEdge: number; minShortEdge: number } {
  void options
  return {
    minLongEdge: FEATURED_BACKGROUND_HIGH_MIN_LONG_EDGE,
    minShortEdge: FEATURED_BACKGROUND_HIGH_MIN_SHORT_EDGE
  }
}

export function getFeaturedBackgroundRefreshRequestOrigins(): string[] {
  return FEATURED_BACKGROUND_REFRESH_ORIGINS
}

async function fetchNasaFeaturedItems(
  client: FeaturedGalleryFetchClient,
  options: FeaturedGalleryRefreshOptions
): Promise<FeaturedBackgroundItem[]> {
  const seed = normalizeFeaturedRefreshSeed(options.refreshSeed)
  const searchResults = await Promise.all(NASA_SEARCH_QUERIES.map((query, index) => {
    const page = 1 + ((seed + index) % NASA_SEARCH_PAGE_VARIANTS)
    const url = `https://images-api.nasa.gov/search?media_type=image&q=${encodeURIComponent(query)}&page_size=${NASA_SEARCH_PAGE_SIZE}&page=${page}`
    return client.fetchJson(url).catch(() => null)
  }))
  const collectionItems = searchResults.flatMap((search) => {
    const items = getObject(search).collection
    const rawCollectionItems = getObject(items).items
    return Array.isArray(rawCollectionItems) ? rawCollectionItems : []
  })
  const candidates = rotateFeaturedCandidates(
    dedupeFeaturedItems(
      collectionItems
        .map(normalizeNasaCandidate)
        .filter(Boolean) as FeaturedBackgroundItem[]
    ),
    seed
  )
  const hydrated = await mapWithConcurrency(candidates.slice(0, FEATURED_REFRESH_SOURCE_LIMIT), FEATURED_REFRESH_CONCURRENCY, async (candidate) => {
    const assetList = await client.fetchJson(candidate.imageUrl).catch(() => null)
    const imageUrl = selectNasaHighResolutionImageUrl(assetList)
    const imageSize = imageUrl ? await getHighResolutionImageSize(client, imageUrl, options) : null
    const fallbackSize = imageUrl ? getNasaFallbackSize(assetList, options) : null
    const size = imageSize || fallbackSize
    if (!imageUrl || !size) {
      return null
    }
    return {
      ...candidate,
      imageUrl,
      width: size.width,
      height: size.height
    }
  })
  return hydrated.filter(Boolean) as FeaturedBackgroundItem[]
}

function normalizeNasaCandidate(rawItem: unknown): FeaturedBackgroundItem | null {
  const item = getObject(rawItem)
  const data = Array.isArray(item.data) ? getObject(item.data[0]) : {}
  const nasaId = String(data.nasa_id || '').trim()
  const title = String(data.title || nasaId || 'NASA Image').trim()
  const assetUrl = String(item.href || '').trim()
  const credit = String(data.secondary_creator || data.center || 'NASA Image and Video Library').trim()
  if (!nasaId || !assetUrl || !isFeaturedBackgroundStyleSuitable({ title, credit, provider: 'nasa' })) {
    return null
  }
  return {
    id: `nasa-${slugifyId(nasaId)}`,
    title,
    provider: 'nasa',
    imageUrl: assetUrl,
    sourceUrl: `https://images.nasa.gov/details/${encodeURIComponent(nasaId)}`,
    credit,
    license: 'NASA image',
    accentColor: '#05080d',
    dynamic: true
  }
}

function selectNasaHighResolutionImageUrl(assetList: unknown): string {
  const urls = Array.isArray(assetList) ? assetList.map((value) => String(value || '').trim()) : []
  const candidates = urls
    .filter((url) => /\.(?:jpe?g|png|webp)(?:$|[?#])/i.test(url))
    .filter((url) => !/~thumb\.|~small\./i.test(url))
  const preferred = candidates.find((url) => /~orig\./i.test(url)) ||
    candidates.find((url) => /~large\./i.test(url))
  return preferred || ''
}

async function fetchMetFeaturedItems(
  client: FeaturedGalleryFetchClient,
  options: FeaturedGalleryRefreshOptions
): Promise<FeaturedBackgroundItem[]> {
  const seed = normalizeFeaturedRefreshSeed(options.refreshSeed)
  const searchResults = await Promise.all(MET_SEARCH_QUERIES.map((query) => {
    const url = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&isPublicDomain=true&q=${encodeURIComponent(query)}`
    return client.fetchJson(url).catch(() => null)
  }))
  const objectIds = rotateFeaturedNumbers(
    uniqueNumbers(
      searchResults.flatMap((search) => {
        const rawObjectIds = getObject(search).objectIDs
        return Array.isArray(rawObjectIds) ? rawObjectIds : []
      })
    ),
    seed
  ).slice(0, FEATURED_REFRESH_SOURCE_LIMIT)
  const items = await mapWithConcurrency(objectIds, FEATURED_REFRESH_CONCURRENCY, async (objectId) => {
    const objectUrl = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectId}`
    const rawObject = await client.fetchJson(objectUrl).catch(() => null)
    return normalizeMetFeaturedItem(client, rawObject, options)
  })
  return items.filter(Boolean) as FeaturedBackgroundItem[]
}

async function normalizeMetFeaturedItem(
  client: FeaturedGalleryFetchClient,
  rawObject: unknown,
  options: FeaturedGalleryRefreshOptions
): Promise<FeaturedBackgroundItem | null> {
  const object = getObject(rawObject)
  const objectId = Number(object.objectID)
  const imageUrl = String(object.primaryImage || '').trim()
  if (!Number.isFinite(objectId) || object.isPublicDomain !== true || !imageUrl) {
    return null
  }
  const title = String(object.title || `The Met ${objectId}`).trim()
  const artist = String(object.artistDisplayName || '').trim()
  const credit = artist ? `The Metropolitan Museum of Art / ${artist}` : 'The Metropolitan Museum of Art'
  if (!isFeaturedBackgroundStyleSuitable({
    title,
    credit,
    provider: 'met',
    metadata: [String(object.department || ''), String(object.classification || ''), String(object.medium || '')]
  })) {
    return null
  }
  const imageSize = await getHighResolutionImageSize(client, imageUrl, options)
  if (!imageSize) {
    return null
  }
  return {
    id: `met-${objectId}`,
    title,
    provider: 'met',
    imageUrl,
    sourceUrl: String(object.objectURL || `https://www.metmuseum.org/art/collection/search/${objectId}`).trim(),
    credit,
    license: 'Open Access / Public Domain',
    accentColor: '#171b12',
    dynamic: true,
    width: imageSize.width,
    height: imageSize.height
  }
}

async function fetchWikimediaFeaturedItems(
  client: FeaturedGalleryFetchClient,
  options: FeaturedGalleryRefreshOptions
): Promise<FeaturedBackgroundItem[]> {
  const seed = normalizeFeaturedRefreshSeed(options.refreshSeed)
  const searchResults = await Promise.all(COMMONS_SEARCH_QUERIES.map((query) => {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}&gsrlimit=${COMMONS_SEARCH_LIMIT}&prop=imageinfo&iiprop=url|user|mime|size&iiurlwidth=1920&format=json&origin=*`
    return client.fetchJson(url).catch(() => null)
  }))
  const pages = rotateFeaturedCandidates(
    dedupeFeaturedItems(
      searchResults.flatMap((raw) => {
        const query = getObject(raw).query
        const rawPages = getObject(query).pages
        if (!rawPages || typeof rawPages !== 'object' || Array.isArray(rawPages)) {
          return []
        }
        return Object.values(rawPages)
          .map((page) => normalizeWikimediaFeaturedItem(page, options))
          .filter(Boolean) as FeaturedBackgroundItem[]
      })
    ),
    seed
  )
  return pages.slice(0, FEATURED_REFRESH_SOURCE_LIMIT)
}

function normalizeWikimediaFeaturedItem(
  rawPage: unknown,
  options: FeaturedGalleryRefreshOptions
): FeaturedBackgroundItem | null {
  const page = getObject(rawPage)
  const imageInfo = Array.isArray(page.imageinfo) ? getObject(page.imageinfo[0]) : {}
  const imageUrl = String(imageInfo.url || '').trim()
  const mime = String(imageInfo.mime || '').toLowerCase()
  const width = Number(imageInfo.width || imageInfo.thumbwidth)
  const height = Number(imageInfo.height || imageInfo.thumbheight)
  const threshold = getFeaturedBackgroundResolutionThreshold(options)
  if (!imageUrl ||
    mime.includes('svg') ||
    !isHighResolutionFeaturedBackground(width, height, threshold.minLongEdge, threshold.minShortEdge)) {
    return null
  }

  const rawPageTitle = String(page.title || '').trim()
  const rawTitle = rawPageTitle.replace(/^File:/i, '').trim()
  const title = cleanDisplayTitle(rawTitle || 'Wikimedia Commons')
  const credit = String(imageInfo.user || 'Wikimedia Commons').trim()
  if (!isFeaturedBackgroundStyleSuitable({
    title,
    credit,
    provider: 'wikimedia',
    metadata: [rawPageTitle, String(imageInfo.descriptionurl || '')]
  })) {
    return null
  }
  return {
    id: `wikimedia-${slugifyId(rawPageTitle || title)}`,
    title,
    provider: 'wikimedia',
    imageUrl,
    sourceUrl: String(imageInfo.descriptionurl || '').trim() || `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(page.title || ''))}`,
    credit,
    license: 'Public domain / Wikimedia Commons',
    accentColor: '#101820',
    dynamic: true,
    width,
    height
  }
}

async function getHighResolutionImageSize(
  client: FeaturedGalleryFetchClient,
  imageUrl: string,
  options: FeaturedGalleryRefreshOptions
): Promise<{ width: number; height: number } | null> {
  if (!client.getImageSize) {
    return null
  }

  const threshold = getFeaturedBackgroundResolutionThreshold(options)
  const size = await client.getImageSize(imageUrl).catch(() => null)
  if (!size ||
    !isHighResolutionFeaturedBackground(size.width, size.height, threshold.minLongEdge, threshold.minShortEdge)) {
    return null
  }
  return size
}

function getNasaFallbackSize(assetList: unknown, options: FeaturedGalleryRefreshOptions): { width: number; height: number } | null {
  const urls = Array.isArray(assetList) ? assetList.map((value) => String(value || '').trim()) : []
  const preferred = urls.find((url) => /~orig\./i.test(url)) ||
    urls.find((url) => /~large\./i.test(url)) ||
    ''
  if (!preferred) {
    return null
  }
  const threshold = getFeaturedBackgroundResolutionThreshold(options)
  if (/~orig\./i.test(preferred)) {
    return {
      width: threshold.minLongEdge + 1200,
      height: threshold.minShortEdge + 900
    }
  }
  if (/~large\./i.test(preferred)) {
    return {
      width: Math.max(threshold.minLongEdge, 2560),
      height: Math.max(threshold.minShortEdge, 1440)
    }
  }
  return {
    width: Math.max(threshold.minLongEdge, 2048),
    height: Math.max(threshold.minShortEdge, 1152)
  }
}

function normalizeFeaturedRefreshSeed(seed: unknown): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return Math.abs(Math.floor(seed))
  }
  const text = String(seed || '').trim()
  if (!text) {
    return Math.abs(Date.now())
  }
  return Math.abs(hashFeaturedBackgroundSeed(text))
}

function rotateFeaturedCandidates<T>(items: T[], seed: number): T[] {
  if (items.length <= 1) {
    return items
  }
  const start = seed % items.length
  return items.slice(start).concat(items.slice(0, start))
}

function rotateFeaturedNumbers(items: number[], seed: number): number[] {
  if (items.length <= 1) {
    return items
  }
  const start = seed % items.length
  return items.slice(start).concat(items.slice(0, start))
}

function uniqueNumbers(items: unknown[]): number[] {
  const seen = new Set<number>()
  const results: number[] = []
  for (const item of items) {
    const value = Number(item)
    if (!Number.isFinite(value) || value <= 0 || seen.has(value)) {
      continue
    }
    seen.add(value)
    results.push(value)
  }
  return results
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workerCount = Math.max(1, Math.min(Math.floor(concurrency), items.length))
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

function dedupeFeaturedItems(items: FeaturedBackgroundItem[]): FeaturedBackgroundItem[] {
  const seen = new Set<string>()
  const deduped: FeaturedBackgroundItem[] = []
  for (const item of items) {
    const key = `${item.id}|${item.imageUrl}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    deduped.push(item)
  }
  return deduped
}

function hashFeaturedBackgroundSeed(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash | 0
}

function getObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function slugifyId(value: unknown): string {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'item'
}

function cleanDisplayTitle(value: string): string {
  return value
    .replace(/\.(?:jpe?g|png|webp)$/i, '')
    .replace(/_/g, ' ')
    .trim()
}
