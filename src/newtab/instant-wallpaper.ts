const INSTANT_WALLPAPER_KEY = 'curatorNewTabInstantWallpaper'
const INSTANT_WALLPAPER_TARGET_KEY = 'curatorNewTabInstantWallpaperTarget'
const INSTANT_WALLPAPER_MAX_DIMENSION = 512
const INSTANT_WALLPAPER_QUALITY = 0.62

export interface InstantWallpaperRecord {
  signature: string
  dataUrl: string
  backgroundSize: string
  backgroundPosition: string
  updatedAt: number
}

export interface InstantWallpaperTargetRecord {
  signature: string
  imageUrl: string
  backgroundSize: string
  backgroundPosition: string
  placeholderColor: string
  updatedAt: number
}

export function readInstantWallpaper(): InstantWallpaperRecord | null {
  try {
    return normalizeInstantWallpaper(localStorage.getItem(INSTANT_WALLPAPER_KEY))
  } catch {
    return null
  }
}

export function saveInstantWallpaper(record: InstantWallpaperRecord): void {
  if (!record.signature || !record.dataUrl) {
    return
  }

  try {
    localStorage.setItem(INSTANT_WALLPAPER_KEY, JSON.stringify(record))
  } catch {
    // Synchronous startup cache is best-effort; IndexedDB remains the durable cache.
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
    localStorage.setItem(INSTANT_WALLPAPER_TARGET_KEY, JSON.stringify(record))
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
      updatedAt: Number(record.updatedAt) || 0
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
      backgroundSize: String(record.backgroundSize || 'cover'),
      backgroundPosition: String(record.backgroundPosition || 'center'),
      placeholderColor: String(record.placeholderColor || '#000000'),
      updatedAt: Number(record.updatedAt) || 0
    }
  } catch {
    return null
  }
}

export async function createInstantWallpaperDataUrl(blob: Blob): Promise<string> {
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
    const scale = Math.min(1, INSTANT_WALLPAPER_MAX_DIMENSION / sourceMaxDimension)
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
    return canvas.toDataURL('image/jpeg', INSTANT_WALLPAPER_QUALITY)
  } finally {
    bitmap.close()
  }
}
