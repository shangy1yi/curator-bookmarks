const INSTANT_WALLPAPER_KEY = 'curatorNewTabInstantWallpaper'
const INSTANT_WALLPAPER_TARGET_KEY = 'curatorNewTabInstantWallpaperTarget'
const INSTANT_WALLPAPER_MAX_DIMENSION = 320
const INSTANT_WALLPAPER_QUALITY = 0.54
const DEFAULT_INSTANT_WALLPAPER_PLACEHOLDER = '#101013'

export interface InstantWallpaperRecord {
  signature: string
  dataUrl: string
  backgroundSize: string
  backgroundPosition: string
  placeholderColor: string
  updatedAt: number
  ready: boolean
}

export interface InstantWallpaperTargetRecord {
  signature: string
  imageUrl: string
  previewUrl: string
  backgroundSize: string
  backgroundPosition: string
  placeholderColor: string
  cacheRequired: boolean
  cacheReady: boolean
  updatedAt: number
}

export interface InstantWallpaperDataUrlOptions {
  maxDimension?: number
  quality?: number
}

export function readInstantWallpaper(): InstantWallpaperRecord | null {
  try {
    return normalizeInstantWallpaper(localStorage.getItem(INSTANT_WALLPAPER_KEY))
  } catch {
    return null
  }
}

export function saveInstantWallpaper(record: InstantWallpaperRecord): boolean {
  if (!record.signature || !record.dataUrl) {
    return false
  }

  try {
    localStorage.setItem(INSTANT_WALLPAPER_KEY, JSON.stringify({
      ...record,
      placeholderColor: normalizeInstantWallpaperColor(record.placeholderColor),
      ready: record.ready !== false
    }))
    return true
  } catch {
    try {
      localStorage.removeItem(INSTANT_WALLPAPER_KEY)
      localStorage.setItem(INSTANT_WALLPAPER_KEY, JSON.stringify({
        ...record,
        placeholderColor: normalizeInstantWallpaperColor(record.placeholderColor),
        ready: record.ready !== false
      }))
      return true
    } catch {
      // Synchronous startup cache is best-effort; IndexedDB remains the durable cache.
    }
    return false
  }
}

export function readInstantWallpaperTarget(): InstantWallpaperTargetRecord | null {
  try {
    return normalizeInstantWallpaperTarget(localStorage.getItem(INSTANT_WALLPAPER_TARGET_KEY))
  } catch {
    return null
  }
}

export function saveInstantWallpaperTarget(record: InstantWallpaperTargetRecord): void {
  if (!record.signature) {
    return
  }

  try {
    localStorage.setItem(INSTANT_WALLPAPER_TARGET_KEY, JSON.stringify({
      ...record,
      placeholderColor: normalizeInstantWallpaperColor(record.placeholderColor),
      cacheRequired: record.cacheRequired === true,
      cacheReady: record.cacheReady === true
    }))
  } catch {
    // Startup target mirror is best-effort; chrome.storage remains the durable source.
  }
}

export function clearInstantWallpaperTarget(): void {
  try {
    localStorage.removeItem(INSTANT_WALLPAPER_TARGET_KEY)
  } catch {
    // Best-effort cleanup.
  }
}

export function clearInstantWallpaper(): void {
  try {
    localStorage.removeItem(INSTANT_WALLPAPER_KEY)
  } catch {
    // Best-effort cleanup.
  }
}

export function normalizeInstantWallpaper(rawValue: unknown): InstantWallpaperRecord | null {
  if (typeof rawValue !== 'string' || !rawValue) {
    return null
  }

  try {
    const record = JSON.parse(rawValue) as Partial<InstantWallpaperRecord>
    const signature = String(record.signature || '')
    const dataUrl = String(record.dataUrl || '')
    if (!signature || !dataUrl.startsWith('data:image/')) {
      return null
    }
    return {
      signature,
      dataUrl,
      backgroundSize: String(record.backgroundSize || 'cover'),
      backgroundPosition: String(record.backgroundPosition || 'center'),
      placeholderColor: normalizeInstantWallpaperColor(record.placeholderColor),
      updatedAt: Number(record.updatedAt) || 0,
      ready: record.ready !== false
    }
  } catch {
    return null
  }
}

export function normalizeInstantWallpaperTarget(rawValue: unknown): InstantWallpaperTargetRecord | null {
  if (typeof rawValue !== 'string' || !rawValue) {
    return null
  }

  try {
    const record = JSON.parse(rawValue) as Partial<InstantWallpaperTargetRecord>
    const signature = String(record.signature || '')
    if (!signature) {
      return null
    }
    return {
      signature,
      imageUrl: String(record.imageUrl || ''),
      previewUrl: String(record.previewUrl || ''),
      backgroundSize: String(record.backgroundSize || 'cover'),
      backgroundPosition: String(record.backgroundPosition || 'center'),
      placeholderColor: normalizeInstantWallpaperColor(record.placeholderColor),
      cacheRequired: record.cacheRequired === true,
      cacheReady: record.cacheReady === true,
      updatedAt: Number(record.updatedAt) || 0
    }
  } catch {
    return null
  }
}

export async function createInstantWallpaperDataUrl(
  blob: Blob,
  options: InstantWallpaperDataUrlOptions = {}
): Promise<string> {
  if (blob.type.toLowerCase() === 'image/gif') {
    return ''
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    return ''
  }

  try {
    const sourceMaxDimension = Math.max(bitmap.width, bitmap.height)
    if (!sourceMaxDimension) {
      return ''
    }
    const maxDimension = normalizeInstantWallpaperMaxDimension(options.maxDimension)
    const quality = normalizeInstantWallpaperQuality(options.quality)
    const scale = Math.min(1, maxDimension / sourceMaxDimension)
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale))
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const context = canvas.getContext('2d')
    if (!context) {
      return ''
    }
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    bitmap.close()
  }
}

function normalizeInstantWallpaperMaxDimension(value: unknown): number {
  const dimension = Math.round(Number(value))
  if (Number.isFinite(dimension) && dimension >= 64) {
    return Math.min(512, dimension)
  }
  return INSTANT_WALLPAPER_MAX_DIMENSION
}

function normalizeInstantWallpaperQuality(value: unknown): number {
  const quality = Number(value)
  if (Number.isFinite(quality) && quality > 0) {
    return Math.min(0.86, Math.max(0.32, quality))
  }
  return INSTANT_WALLPAPER_QUALITY
}

export function normalizeInstantWallpaperColor(value: unknown): string {
  const color = String(value || '').trim()
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color
  }
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
  }
  return DEFAULT_INSTANT_WALLPAPER_PLACEHOLDER
}

export function getInstantWallpaperFallbackColor(): string {
  return DEFAULT_INSTANT_WALLPAPER_PLACEHOLDER
}
