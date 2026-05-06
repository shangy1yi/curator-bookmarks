import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  FEATURED_BACKGROUND_ITEMS,
  getDefaultFeaturedBackgroundItem,
  getFeaturedBackgroundItemById,
  selectFeaturedBackgroundItem
} from '../src/newtab/background-gallery.js'

test('featured newtab gallery ships stable multi-source image records', () => {
  assert.ok(FEATURED_BACKGROUND_ITEMS.length >= 12)
  assert.equal(getDefaultFeaturedBackgroundItem(), FEATURED_BACKGROUND_ITEMS[0])
  assert.deepEqual(
    new Set(FEATURED_BACKGROUND_ITEMS.map((item) => item.provider)),
    new Set(['nasa', 'rijksmuseum', 'met', 'smithsonian'])
  )

  const ids = new Set<string>()
  for (const item of FEATURED_BACKGROUND_ITEMS) {
    assert.match(item.id, /^(nasa|rijksmuseum|met|smithsonian)-/)
    assert.match(item.imageUrl, /^https:\/\//)
    assert.match(item.sourceUrl, /^https:\/\//)
    assert.ok(item.title)
    assert.ok(item.credit)
    assert.ok(item.license)
    assert.match(item.accentColor, /^#[\da-f]{6}$/i)
    assert.equal(ids.has(item.id), false)
    ids.add(item.id)
  }

  assert.ok(FEATURED_BACKGROUND_ITEMS.filter((item) => item.provider === 'nasa').every((item) => item.imageUrl.includes('~orig.jpg')))
  assert.ok(FEATURED_BACKGROUND_ITEMS.some((item) => item.imageUrl.includes('images.metmuseum.org/CRDImages/')))
  assert.ok(FEATURED_BACKGROUND_ITEMS.some((item) => item.imageUrl.includes('ids.si.edu/ids/deliveryService')))
  assert.ok(FEATURED_BACKGROUND_ITEMS.some((item) => item.imageUrl.includes('iiif.micr.io/')))
})

test('featured newtab gallery can resolve explicit and daily items', () => {
  const firstItem = FEATURED_BACKGROUND_ITEMS[0]
  assert.equal(getFeaturedBackgroundItemById(firstItem.id), firstItem)
  assert.equal(getFeaturedBackgroundItemById('missing'), null)

  assert.equal(selectFeaturedBackgroundItem('2026-05-06'), selectFeaturedBackgroundItem('2026-05-06'))
  assert.ok(FEATURED_BACKGROUND_ITEMS.includes(selectFeaturedBackgroundItem('2026-05-07')))
})
