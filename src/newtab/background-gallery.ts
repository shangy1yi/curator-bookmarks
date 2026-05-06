export type FeaturedBackgroundProvider = 'nasa' | 'rijksmuseum' | 'met' | 'smithsonian'

export interface FeaturedBackgroundItem {
  id: string
  title: string
  provider: FeaturedBackgroundProvider
  imageUrl: string
  sourceUrl: string
  credit: string
  license: string
  accentColor: string
}

export const FEATURED_BACKGROUND_ITEMS: FeaturedBackgroundItem[] = [
  {
    id: 'nasa-carina-nebula',
    title: 'Carina Nebula',
    provider: 'nasa',
    imageUrl: 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e000039/GSFC_20171208_Archive_e000039~orig.jpg',
    sourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e000039',
    credit: 'NASA, ESA, N. Smith (University of California, Berkeley), and The Hubble Heritage Team',
    license: 'NASA image',
    accentColor: '#05060c'
  },
  {
    id: 'nasa-dumbbell-nebula',
    title: 'Weighing in on the Dumbbell Nebula',
    provider: 'nasa',
    imageUrl: 'https://images-assets.nasa.gov/image/PIA14417/PIA14417~orig.jpg',
    sourceUrl: 'https://images.nasa.gov/details/PIA14417',
    credit: 'NASA/JPL-Caltech/Harvard-Smithsonian CfA',
    license: 'NASA image',
    accentColor: '#08050b'
  },
  {
    id: 'nasa-hunting-dog-galaxy',
    title: "Hubble's Hunting Dog Galaxy",
    provider: 'nasa',
    imageUrl: 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e000017/GSFC_20171208_Archive_e000017~orig.jpg',
    sourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e000017',
    credit: 'NASA, ESA, and the Hubble Heritage Team (STScI/AURA)',
    license: 'NASA image',
    accentColor: '#03050a'
  },
  {
    id: 'nasa-pillars-of-creation',
    title: 'Pillars of Creation',
    provider: 'nasa',
    imageUrl: 'https://images-assets.nasa.gov/image/PIA23122/PIA23122~orig.jpg',
    sourceUrl: 'https://images.nasa.gov/details/PIA23122',
    credit: 'NASA, ESA, and the Hubble Heritage Team',
    license: 'NASA image',
    accentColor: '#060507'
  },
  {
    id: 'nasa-blue-marble',
    title: 'Blue Marble',
    provider: 'nasa',
    imageUrl: 'https://images-assets.nasa.gov/image/as11-40-5874/as11-40-5874~orig.jpg',
    sourceUrl: 'https://images.nasa.gov/details/as11-40-5874',
    credit: 'NASA',
    license: 'NASA image',
    accentColor: '#03101d'
  },
  {
    id: 'nasa-earth-at-night',
    title: 'Earth at Night',
    provider: 'nasa',
    imageUrl: 'https://images-assets.nasa.gov/image/iss040e090540/iss040e090540~orig.jpg',
    sourceUrl: 'https://images.nasa.gov/details/iss040e090540',
    credit: 'NASA',
    license: 'NASA image',
    accentColor: '#020409'
  },
  {
    id: 'met-forest-winter-sunset',
    title: 'The Forest in Winter at Sunset',
    provider: 'met',
    imageUrl: 'https://images.metmuseum.org/CRDImages/ep/original/DP-31520-001.jpg',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/438816',
    credit: 'The Met Open Access, Theodore Rousseau',
    license: 'Public Domain',
    accentColor: '#120f0b'
  },
  {
    id: 'met-six-jewel-rivers',
    title: 'Six Jewel Rivers from Various Provinces',
    provider: 'met',
    imageUrl: 'https://images.metmuseum.org/CRDImages/as/original/DP-13180-023.jpg',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/53449',
    credit: 'The Met Open Access, Utagawa Hiroshige',
    license: 'Public Domain',
    accentColor: '#14100c'
  },
  {
    id: 'smithsonian-lake-okanagan',
    title: 'View of Lake Okanagan, British Columbia',
    provider: 'smithsonian',
    imageUrl: 'https://ids.si.edu/ids/deliveryService?id=NMAAHC-2012_161ab_003-000001&max=3000',
    sourceUrl: 'https://www.si.edu/object/view-lake-okanagan-british-columbia:nmaahc_2012.161ab',
    credit: 'Smithsonian Open Access, Grafton Tyler Brown',
    license: 'CC0',
    accentColor: '#0d120d'
  },
  {
    id: 'smithsonian-garden-of-eden',
    title: 'The Garden of Eden',
    provider: 'smithsonian',
    imageUrl: 'https://ids.si.edu/ids/deliveryService?id=NMAAHC-2014_299_003&max=3000',
    sourceUrl: 'https://www.si.edu/object/garden-eden:nmaahc_2014.299',
    credit: 'Smithsonian Open Access',
    license: 'CC0',
    accentColor: '#081006'
  },
  {
    id: 'rijksmuseum-mountain-landscape',
    title: 'Mountain Landscape',
    provider: 'rijksmuseum',
    imageUrl: 'https://iiif.micr.io/sVXyJ/full/2560,/0/default.jpg',
    sourceUrl: 'https://www.rijksmuseum.nl/en/collection/RP-F-1995-53',
    credit: 'Rijksmuseum, anonymous photographer',
    license: 'Public Domain',
    accentColor: '#12100c'
  },
  {
    id: 'rijksmuseum-the-milkmaid',
    title: 'The Milkmaid',
    provider: 'rijksmuseum',
    imageUrl: 'https://iiif.micr.io/QkOGy/full/2560,/0/default.jpg',
    sourceUrl: 'https://www.rijksmuseum.nl/en/collection/SK-A-2344',
    credit: 'Rijksmuseum, Johannes Vermeer',
    license: 'Public Domain',
    accentColor: '#100d08'
  }
]

export function getFeaturedBackgroundItemById(id: unknown): FeaturedBackgroundItem | null {
  const normalizedId = String(id || '').trim()
  return FEATURED_BACKGROUND_ITEMS.find((item) => item.id === normalizedId) || null
}

export function getDefaultFeaturedBackgroundItem(): FeaturedBackgroundItem {
  return FEATURED_BACKGROUND_ITEMS[0]
}

export function selectFeaturedBackgroundItem(seed: unknown = Date.now()): FeaturedBackgroundItem {
  const count = FEATURED_BACKGROUND_ITEMS.length
  const index = Math.abs(hashFeaturedBackgroundSeed(String(seed || ''))) % count
  return FEATURED_BACKGROUND_ITEMS[index] || getDefaultFeaturedBackgroundItem()
}

function hashFeaturedBackgroundSeed(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash | 0
}
