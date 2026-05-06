export const DEFAULT_SPEED_DIAL_LIMIT = 12

export interface SpeedDialBookmarkLike {
  id: string
  title?: string
  url?: string
  dateAdded?: number
}

export interface SpeedDialItem {
  id: string
  title: string
  url: string
  domain: string
  fallbackLabel: string
  detail: string
  pinnedOrder: number
}

export interface BuildSpeedDialInput {
  pinnedIds: string[]
  bookmarks: SpeedDialBookmarkLike[] | Map<string, SpeedDialBookmarkLike>
  limit?: number
}

export interface SpeedDialEmptyState {
  title: string
  detail: string
}

export function buildSpeedDialItems({
  pinnedIds,
  bookmarks,
  limit = DEFAULT_SPEED_DIAL_LIMIT
}: BuildSpeedDialInput): SpeedDialItem[] {
  const bookmarkMap = bookmarks instanceof Map
    ? bookmarks
    : new Map(bookmarks.map((bookmark) => [String(bookmark.id), bookmark]))
  const maxItems = Math.max(0, Math.min(Math.floor(limit) || DEFAULT_SPEED_DIAL_LIMIT, 24))
  const items: SpeedDialItem[] = []
  const seen = new Set<string>()

  for (const rawId of pinnedIds || []) {
    const id = String(rawId || '').trim()
    if (!id || seen.has(id)) {
      continue
    }
    seen.add(id)
    const bookmark = bookmarkMap.get(id)
    if (!bookmark?.url) {
      continue
    }

    const item = createSpeedDialItem(bookmark, items.length)
    if (item) {
      items.push(item)
    }
    if (items.length >= maxItems) {
      break
    }
  }

  return items
}

export function createSpeedDialEmptyState(): SpeedDialEmptyState {
  return {
    title: 'Speed Dial 还没有固定书签',
    detail: '从书签卡片菜单固定常用链接后，它们会出现在这里。'
  }
}

export function getSpeedDialPinActionCopy(isPinned: boolean): {
  label: string
  status: string
  ariaLabel: string
} {
  return isPinned
    ? {
        label: '取消固定',
        status: '已从 Speed Dial 取消固定',
        ariaLabel: '从 Speed Dial 取消固定书签'
      }
    : {
        label: '固定到 Speed Dial',
        status: '已固定到 Speed Dial',
        ariaLabel: '固定书签到 Speed Dial'
      }
}

export function isSpeedDialBookmarkPinned(pinnedIds: string[], bookmarkId: string): boolean {
  const id = String(bookmarkId || '').trim()
  return Boolean(id && pinnedIds.includes(id))
}

function createSpeedDialItem(bookmark: SpeedDialBookmarkLike, pinnedOrder: number): SpeedDialItem | null {
  const id = String(bookmark.id || '').trim()
  const url = String(bookmark.url || '').trim()
  if (!id || !url) {
    return null
  }

  const title = String(bookmark.title || '').trim() || formatSpeedDialUrl(url)
  const domain = getSpeedDialDomain(url)
  return {
    id,
    title,
    url,
    domain,
    fallbackLabel: getSpeedDialFallbackLabel(title, domain),
    detail: domain || formatSpeedDialUrl(url),
    pinnedOrder
  }
}

function getSpeedDialDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

function formatSpeedDialUrl(url: string): string {
  try {
    const parsedUrl = new URL(url)
    const pathname = parsedUrl.pathname === '/' ? '' : parsedUrl.pathname
    return `${parsedUrl.hostname}${pathname}`
  } catch {
    return url.replace(/^https?:\/\//i, '')
  }
}

function getSpeedDialFallbackLabel(title: string, domain: string): string {
  const source = title || domain || '?'
  const first = Array.from(source.trim())[0] || '?'
  return first.toUpperCase()
}
