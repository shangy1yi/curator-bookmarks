import type { FeaturedBackgroundItem } from './background-gallery.js'

export interface FeaturedBackgroundPickerListInput {
  storedItems: FeaturedBackgroundItem[]
  staticItems: FeaturedBackgroundItem[]
  favoriteIds: Iterable<string>
  selectedId: string
}

export function buildFeaturedBackgroundPickerItems({
  storedItems,
  staticItems,
  favoriteIds,
  selectedId
}: FeaturedBackgroundPickerListInput): FeaturedBackgroundItem[] {
  const favorites = new Set(Array.from(favoriteIds, (id) => String(id || '').trim()).filter(Boolean))
  const selected = String(selectedId || '').trim()
  const hasRefreshCache = storedItems.length > 0
  const items: FeaturedBackgroundItem[] = []
  const seen = new Set<string>()

  const addItems = (sourceItems: FeaturedBackgroundItem[], filter: (item: FeaturedBackgroundItem) => boolean) => {
    for (const item of sourceItems) {
      if (!item.id || seen.has(item.id) || !filter(item)) {
        continue
      }
      seen.add(item.id)
      items.push(item)
    }
  }

  addItems(storedItems, (item) => favorites.has(item.id))
  addItems(staticItems, (item) => favorites.has(item.id))
  addItems(staticItems, (item) => Boolean(selected) && item.id === selected)
  addItems(storedItems, (item) => !favorites.has(item.id))

  if (!hasRefreshCache) {
    addItems(staticItems, (item) => !favorites.has(item.id) && item.id !== selected)
  }

  return items
}
