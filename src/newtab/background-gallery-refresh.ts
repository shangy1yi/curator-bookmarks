import type { FeaturedBackgroundItem } from './background-gallery.js'

const FEATURED_REFRESH_TARGET_COUNT = 24
const FEATURED_BACKGROUND_1080P_MIN_LONG_EDGE = 1920
const FEATURED_BACKGROUND_1080P_MIN_SHORT_EDGE = 1080
const FEATURED_BACKGROUND_HIGH_MIN_LONG_EDGE = 2560
const FEATURED_BACKGROUND_HIGH_MIN_SHORT_EDGE = 1440
const NASA_SEARCH_URL =
  'https://images-api.nasa.gov/search?media_type=image&q=galaxy%20nebula%20earth%20mars%20jupiter&page_size=18'
const MET_SEARCH_URL =
  'https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&isPublicDomain=true&q=landscape'
const COMMONS_SEARCH_URL =
  'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=art%20landscape%20painting%20public%20domain&gsrlimit=18&prop=imageinfo&iiprop=url|user|mime|size&iiurlwidth=1920&format=json&origin=*'

export interface FeaturedGalleryRefreshState {
  existingItems: FeaturedBackgroundItem[]
  favoriteIds: Iterable<string>
  fetchedItems: FeaturedBackgroundItem[]
}

export function getFeaturedBackgroundResolutionLabel(item: Pick<FeaturedBackgroundItem, 'width' | 'height'>): string {
  const width = Number(item.width)
  const height = Number(item.height)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return ''
  }
  return `${Math.round(width)} x ${Math.round(height)}`
}

export interface FeaturedGalleryFetchClient {
  fetchJson: (url: string) => Promise<unknown>
  getImageSize?: (url: string) => Promise<{ width: number; height: number } | null>
}

export interface FeaturedGalleryRefreshOptions {
  allow1080p?: boolean
}

export const FEATURED_BACKGROUND_REFRESH_ORIGINS = [
  'https://images-api.nasa.gov/*',
  'https://images-assets.nasa.gov/*',
  'https://collectionapi.metmuseum.org/*',
  'https://images.metmuseum.org/*',
  'https://commons.wikimedia.org/*',
  'https://upload.wikimedia.org/*'
]

export async function fetchFreshFeaturedBackgroundItems(
  client: FeaturedGalleryFetchClient,
  options: FeaturedGalleryRefreshOptions = {}
): Promise<FeaturedBackgroundItem[]> {
  const [nasaItems, metItems, wikimediaItems] = await Promise.all([
    fetchNasaFeaturedItems(client, options).catch(() => []),
    fetchMetFeaturedItems(client, options).catch(() => []),
    fetchWikimediaFeaturedItems(client, options).catch(() => [])
  ])

  return dedupeFeaturedItems([
    ...nasaItems,
    ...metItems,
    ...wikimediaItems
  ]).slice(0, FEATURED_REFRESH_TARGET_COUNT)
}

export function mergeFeaturedGalleryRefresh({
  existingItems,
  favoriteIds,
  fetchedItems
}: FeaturedGalleryRefreshState): FeaturedBackgroundItem[] {
  const favorites = new Set(Array.from(favoriteIds, (id) => String(id || '').trim()).filter(Boolean))
  const previousNonFavoriteIds = new Set(
    existingItems
      .map((item) => String(item.id || '').trim())
      .filter((id) => id && !favorites.has(id))
  )
  const merged: FeaturedBackgroundItem[] = []
  const seen = new Set<string>()

  function addItem(item: FeaturedBackgroundItem | null | undefined, options: { allowPreviousNonFavorite?: boolean } = {}): void {
    const id = String(item?.id || '').trim()
    if (!item || !id || seen.has(id) || (!options.allowPreviousNonFavorite && previousNonFavoriteIds.has(id))) {
      return
    }
    seen.add(id)
    merged.push(item)
  }

  for (const item of existingItems) {
    if (favorites.has(item.id)) {
      addItem(item, { allowPreviousNonFavorite: true })
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
  return options.allow1080p
    ? {
        minLongEdge: FEATURED_BACKGROUND_1080P_MIN_LONG_EDGE,
        minShortEdge: FEATURED_BACKGROUND_1080P_MIN_SHORT_EDGE
      }
    : {
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
  const search = await client.fetchJson(NASA_SEARCH_URL)
  const items = getObject(search).collection
  const rawCollectionItems = getObject(items).items
  const collectionItems = Array.isArray(rawCollectionItems) ? rawCollectionItems : []
  const results: FeaturedBackgroundItem[] = []

  for (const rawItem of collectionItems.slice(0, 18)) {
    const item = getObject(rawItem)
    const data = Array.isArray(item.data) ? getObject(item.data[0]) : {}
    const nasaId = String(data.nasa_id || '').trim()
    const title = String(data.title || nasaId || 'NASA Image').trim()
    const assetUrl = String(item.href || '').trim()
    if (!nasaId || !assetUrl) {
      continue
    }

    const assetList = await client.fetchJson(assetUrl).catch(() => null)
    const imageUrl = selectNasaHighResolutionImageUrl(assetList)
    const imageSize = imageUrl ? await getHighResolutionImageSize(client, imageUrl, options) : null
    if (!imageUrl || !imageSize) {
      continue
    }

    results.push({
      id: `nasa-${slugifyId(nasaId)}`,
      title,
      provider: 'nasa',
      imageUrl,
      sourceUrl: `https://images.nasa.gov/details/${encodeURIComponent(nasaId)}`,
      credit: String(data.secondary_creator || data.center || 'NASA Image and Video Library').trim(),
      license: 'NASA image',
      accentColor: '#05080d',
      dynamic: true,
      width: imageSize.width,
      height: imageSize.height
    })
  }

  return results
}

function selectNasaHighResolutionImageUrl(assetList: unknown): string {
  const urls = Array.isArray(assetList) ? assetList.map((value) => String(value || '').trim()) : []
  const candidates = urls
    .filter((url) => /\.(?:jpe?g|png|webp)(?:$|[?#])/i.test(url))
    .filter((url) => !/~thumb\.|~small\./i.test(url))
  const preferred = candidates.find((url) => /~orig\./i.test(url)) ||
    candidates.find((url) => /~large\./i.test(url)) ||
    candidates[0]
  return preferred || ''
}

async function fetchMetFeaturedItems(
  client: FeaturedGalleryFetchClient,
  options: FeaturedGalleryRefreshOptions
): Promise<FeaturedBackgroundItem[]> {
  const search = await client.fetchJson(MET_SEARCH_URL)
  const rawObjectIds = getObject(search).objectIDs
  const objectIds = Array.isArray(rawObjectIds) ? rawObjectIds : []
  const ids = objectIds
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0)
    .slice(0, 18)
  const results: FeaturedBackgroundItem[] = []

  for (const objectId of ids) {
    const objectUrl = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectId}`
    const rawObject = await client.fetchJson(objectUrl).catch(() => null)
    const item = await normalizeMetFeaturedItem(client, rawObject, options)
    if (item) {
      results.push(item)
    }
  }

  return results
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
  const imageSize = await getHighResolutionImageSize(client, imageUrl, options)
  if (!imageSize) {
    return null
  }

  const title = String(object.title || `The Met ${objectId}`).trim()
  const artist = String(object.artistDisplayName || '').trim()
  return {
    id: `met-${objectId}`,
    title,
    provider: 'met',
    imageUrl,
    sourceUrl: String(object.objectURL || `https://www.metmuseum.org/art/collection/search/${objectId}`).trim(),
    credit: artist ? `The Metropolitan Museum of Art / ${artist}` : 'The Metropolitan Museum of Art',
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
  const raw = await client.fetchJson(COMMONS_SEARCH_URL)
  const pages = getObject(getObject(raw).query).pages
  const results: FeaturedBackgroundItem[] = []
  if (!pages || typeof pages !== 'object' || Array.isArray(pages)) {
    return results
  }

  for (const page of Object.values(pages)) {
    const item = normalizeWikimediaFeaturedItem(page, options)
    if (item) {
      results.push(item)
    }
  }
  return results
}

function normalizeWikimediaFeaturedItem(
  rawPage: unknown,
  options: FeaturedGalleryRefreshOptions
): FeaturedBackgroundItem | null {
  const page = getObject(rawPage)
  const imageInfo = Array.isArray(page.imageinfo) ? getObject(page.imageinfo[0]) : {}
  const imageUrl = String(imageInfo.thumburl || imageInfo.url || '').trim()
  const mime = String(imageInfo.mime || '').toLowerCase()
  const width = Number(imageInfo.thumbwidth || imageInfo.width)
  const height = Number(imageInfo.thumbheight || imageInfo.height)
  const threshold = getFeaturedBackgroundResolutionThreshold(options)
  if (!imageUrl ||
    mime.includes('svg') ||
    !isHighResolutionFeaturedBackground(width, height, threshold.minLongEdge, threshold.minShortEdge)) {
    return null
  }

  const rawPageTitle = String(page.title || '').trim()
  const rawTitle = rawPageTitle.replace(/^File:/i, '').trim()
  const title = rawTitle || 'Wikimedia Commons'
  return {
    id: `wikimedia-${slugifyId(rawPageTitle || title)}`,
    title: cleanDisplayTitle(title),
    provider: 'wikimedia',
    imageUrl,
    sourceUrl: String(imageInfo.descriptionurl || '').trim() || `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(page.title || ''))}`,
    credit: String(imageInfo.user || 'Wikimedia Commons').trim(),
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
