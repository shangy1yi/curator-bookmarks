export type FeaturedBackgroundProvider = 'nasa' | 'met' | 'wikimedia'

export interface FeaturedBackgroundItem {
  id: string
  title: string
  provider: FeaturedBackgroundProvider
  imageUrl: string
  sourceUrl: string
  credit: string
  license: string
  accentColor: string
  dynamic?: boolean
  width?: number
  height?: number
}

const DAILY_FEATURED_BACKGROUND_OPTION_COUNT = 24

export const FEATURED_BACKGROUND_ITEMS: FeaturedBackgroundItem[] = [
  {
    id: 'met-wheat-field-with-cypresses',
    title: 'Wheat Field with Cypresses',
    provider: 'met',
    imageUrl: 'https://images.metmuseum.org/CRDImages/ep/original/DP-42549-001.jpg',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/436535',
    credit: 'The Metropolitan Museum of Art',
    license: 'Open Access / Public Domain',
    accentColor: '#18200f'
  },
  {
    id: 'wikimedia-water-lilies-monet',
    title: 'Water Lilies',
    provider: 'wikimedia',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Claude_Monet_-_Water_Lilies_-_Google_Art_Project.jpg/1920px-Claude_Monet_-_Water_Lilies_-_Google_Art_Project.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Claude_Monet_-_Water_Lilies_-_Google_Art_Project.jpg',
    credit: 'Wikimedia Commons',
    license: 'Public domain',
    accentColor: '#18251d'
  },
  {
    id: 'nasa-apollo-earthrise',
    title: 'Earthrise',
    provider: 'nasa',
    imageUrl: 'https://images-assets.nasa.gov/image/as11-40-5874/as11-40-5874~orig.jpg',
    sourceUrl: 'https://images.nasa.gov/details/as11-40-5874',
    credit: 'NASA Image and Video Library',
    license: 'NASA image',
    accentColor: '#080b10'
  },
  {
    id: 'met-venice-from-the-porch',
    title: 'Venice, from the Porch of Madonna della Salute',
    provider: 'met',
    imageUrl: 'https://images.metmuseum.org/CRDImages/ep/original/DP169568.jpg',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/437853',
    credit: 'The Metropolitan Museum of Art',
    license: 'Open Access / Public Domain',
    accentColor: '#24313b'
  },
  {
    id: 'wikimedia-among-sierra-nevada',
    title: 'Among the Sierra Nevada, California',
    provider: 'wikimedia',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Albert_Bierstadt_-_Among_the_Sierra_Nevada%2C_California_-_Google_Art_Project.jpg/1920px-Albert_Bierstadt_-_Among_the_Sierra_Nevada%2C_California_-_Google_Art_Project.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Albert_Bierstadt_-_Among_the_Sierra_Nevada,_California_-_Google_Art_Project.jpg',
    credit: 'Wikimedia Commons',
    license: 'Public domain',
    accentColor: '#1c2417'
  },
  {
    id: 'nasa-andromeda-infrared',
    title: 'The Infrared Face of the Andromeda Galaxy',
    provider: 'nasa',
    imageUrl: 'https://images-assets.nasa.gov/image/PIA26276/PIA26276~large.jpg',
    sourceUrl: 'https://images.nasa.gov/details/PIA26276',
    credit: 'NASA/JPL-Caltech',
    license: 'NASA image',
    accentColor: '#06060c'
  },
  {
    id: 'met-sunflowers',
    title: 'Sunflowers',
    provider: 'met',
    imageUrl: 'https://images.metmuseum.org/CRDImages/ep/original/DP-41223-001.jpg',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/436524',
    credit: 'The Metropolitan Museum of Art',
    license: 'Open Access / Public Domain',
    accentColor: '#2f250d'
  },
  {
    id: 'wikimedia-starry-night',
    title: 'The Starry Night',
    provider: 'wikimedia',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Vincent_van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/1920px-Vincent_van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Vincent_van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg',
    credit: 'Wikimedia Commons',
    license: 'Public domain',
    accentColor: '#0a1527'
  },
  {
    id: 'nasa-eagle-nebula-wise',
    title: 'The Eagle Nebula Observed by WISE',
    provider: 'nasa',
    imageUrl: 'https://images-assets.nasa.gov/image/PIA25433/PIA25433~large.jpg',
    sourceUrl: 'https://images.nasa.gov/details/PIA25433',
    credit: 'NASA/JPL-Caltech/UCLA',
    license: 'NASA image',
    accentColor: '#080711'
  },
  {
    id: 'met-cypresses',
    title: 'Cypresses',
    provider: 'met',
    imageUrl: 'https://images.metmuseum.org/CRDImages/ep/original/DP130999.jpg',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/437980',
    credit: 'The Metropolitan Museum of Art',
    license: 'Open Access / Public Domain',
    accentColor: '#152219'
  },
  {
    id: 'wikimedia-great-wave',
    title: 'The Great Wave off Kanagawa',
    provider: 'wikimedia',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/The_Great_Wave_off_Kanagawa.jpg/1920px-The_Great_Wave_off_Kanagawa.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:The_Great_Wave_off_Kanagawa.jpg',
    credit: 'Wikimedia Commons',
    license: 'Public domain',
    accentColor: '#122536'
  },
  {
    id: 'nasa-earth-limb-aurora',
    title: "View of the Earth's Limb with an Aurora",
    provider: 'nasa',
    imageUrl: 'https://images-assets.nasa.gov/image/iss058e005282/iss058e005282~orig.jpg',
    sourceUrl: 'https://images.nasa.gov/details/iss058e005282',
    credit: 'NASA',
    license: 'NASA image',
    accentColor: '#050b10'
  },
  {
    id: 'met-irises',
    title: 'Irises',
    provider: 'met',
    imageUrl: 'https://images.metmuseum.org/CRDImages/ep/original/DP346474.jpg',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/436528',
    credit: 'The Metropolitan Museum of Art',
    license: 'Open Access / Public Domain',
    accentColor: '#172415'
  },
  {
    id: 'wikimedia-cotopaxi',
    title: 'Cotopaxi',
    provider: 'wikimedia',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Frederic_Edwin_Church_-_Cotopaxi_-_Google_Art_Project.jpg/1920px-Frederic_Edwin_Church_-_Cotopaxi_-_Google_Art_Project.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Frederic_Edwin_Church_-_Cotopaxi_-_Google_Art_Project.jpg',
    credit: 'Wikimedia Commons',
    license: 'Public domain',
    accentColor: '#29120b'
  },
  {
    id: 'nasa-mars-landscape-curiosity',
    title: 'Curiosity Captures Mars Landscape',
    provider: 'nasa',
    imageUrl: 'https://images-assets.nasa.gov/image/PIA26632/PIA26632~large.jpg',
    sourceUrl: 'https://images.nasa.gov/details/PIA26632',
    credit: 'NASA/JPL-Caltech/MSSS',
    license: 'NASA image',
    accentColor: '#21100b'
  },
  {
    id: 'met-monet-family-garden',
    title: 'The Monet Family in Their Garden at Argenteuil',
    provider: 'met',
    imageUrl: 'https://images.metmuseum.org/CRDImages/ep/original/DP-25465-001.jpg',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/436965',
    credit: 'The Metropolitan Museum of Art',
    license: 'Open Access / Public Domain',
    accentColor: '#1f2718'
  },
  {
    id: 'wikimedia-fighting-temeraire',
    title: 'The Fighting Temeraire',
    provider: 'wikimedia',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/The_Fighting_Temeraire%2C_JMW_Turner%2C_National_Gallery.jpg/1920px-The_Fighting_Temeraire%2C_JMW_Turner%2C_National_Gallery.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:The_Fighting_Temeraire,_JMW_Turner,_National_Gallery.jpg',
    credit: 'Wikimedia Commons',
    license: 'Public domain',
    accentColor: '#2d2116'
  },
  {
    id: 'nasa-dust-devil-on-mars',
    title: 'Dust Devil on Mars',
    provider: 'nasa',
    imageUrl: 'https://images-assets.nasa.gov/image/PIA03149/PIA03149~orig.jpg',
    sourceUrl: 'https://images.nasa.gov/details/PIA03149',
    credit: 'NASA/JPL/Malin Space Science Systems',
    license: 'NASA image',
    accentColor: '#24120d'
  },
  {
    id: 'met-bouquet-flowers',
    title: 'Bouquet of Flowers in a Vase',
    provider: 'met',
    imageUrl: 'https://images.metmuseum.org/CRDImages/ep/original/DT7098.jpg',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/436525',
    credit: 'The Metropolitan Museum of Art',
    license: 'Open Access / Public Domain',
    accentColor: '#25190f'
  },
  {
    id: 'wikimedia-impression-sunrise',
    title: 'Impression, Sunrise',
    provider: 'wikimedia',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Monet_-_Impression%2C_Sunrise.jpg/1920px-Monet_-_Impression%2C_Sunrise.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Monet_-_Impression,_Sunrise.jpg',
    credit: 'Wikimedia Commons',
    license: 'Public domain',
    accentColor: '#26323a'
  },
  {
    id: 'nasa-jupiter-southern-hemisphere',
    title: "Jupiter's Southern Hemisphere",
    provider: 'nasa',
    imageUrl: 'https://images-assets.nasa.gov/image/PIA21615/PIA21615~orig.jpg',
    sourceUrl: 'https://images.nasa.gov/details/PIA21615',
    credit: 'NASA/JPL-Caltech/SwRI/MSSS',
    license: 'NASA image',
    accentColor: '#20120c'
  },
  {
    id: 'met-young-woman-water-pitcher',
    title: 'Young Woman with a Water Pitcher',
    provider: 'met',
    imageUrl: 'https://images.metmuseum.org/CRDImages/ep/original/DP353257.jpg',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/437881',
    credit: 'The Metropolitan Museum of Art',
    license: 'Open Access / Public Domain',
    accentColor: '#1d241e'
  },
  {
    id: 'wikimedia-wanderer-sea-fog',
    title: 'Wanderer above the Sea of Fog',
    provider: 'wikimedia',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b9/Caspar_David_Friedrich_-_Wanderer_above_the_sea_of_fog.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Caspar_David_Friedrich_-_Wanderer_above_the_sea_of_fog.jpg',
    credit: 'Wikimedia Commons',
    license: 'Public domain',
    accentColor: '#252a2d'
  },
  {
    id: 'nasa-aurora-borealis-blankets-earth',
    title: 'The Aurora Borealis Blankets the Earth',
    provider: 'nasa',
    imageUrl: 'https://images-assets.nasa.gov/image/iss072e159172/iss072e159172~large.jpg',
    sourceUrl: 'https://images.nasa.gov/details/iss072e159172',
    credit: 'NASA',
    license: 'NASA image',
    accentColor: '#04090c'
  },
  {
    id: 'met-dance-class',
    title: 'The Dance Class',
    provider: 'met',
    imageUrl: 'https://images.metmuseum.org/CRDImages/ep/original/DP-20101-001.jpg',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/438817',
    credit: 'The Metropolitan Museum of Art',
    license: 'Open Access / Public Domain',
    accentColor: '#292116'
  },
  {
    id: 'wikimedia-great-day-wrath',
    title: 'The Great Day of His Wrath',
    provider: 'wikimedia',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/50/John_Martin_-_The_Great_Day_of_His_Wrath_-_Google_Art_Project.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:John_Martin_-_The_Great_Day_of_His_Wrath_-_Google_Art_Project.jpg',
    credit: 'Wikimedia Commons',
    license: 'Public domain',
    accentColor: '#250d08'
  },
  {
    id: 'nasa-orion-nebula-infrared',
    title: 'Orion Nebula in Infrared',
    provider: 'nasa',
    imageUrl: 'https://images-assets.nasa.gov/image/PIA25434/PIA25434~large.jpg',
    sourceUrl: 'https://images.nasa.gov/details/PIA25434',
    credit: 'NASA/JPL-Caltech/UCLA',
    license: 'NASA image',
    accentColor: '#090712'
  },
  {
    id: 'met-la-berceuse',
    title: 'La Berceuse',
    provider: 'met',
    imageUrl: 'https://images.metmuseum.org/CRDImages/ep/original/DP-19279-001.jpg',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/437984',
    credit: 'The Metropolitan Museum of Art',
    license: 'Open Access / Public Domain',
    accentColor: '#2d2110'
  },
  {
    id: 'wikimedia-snow-storm-steamboat',
    title: 'Snow Storm: Steam-Boat off a Harbour\'s Mouth',
    provider: 'wikimedia',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/J.M.W._Turner_%E2%80%93_Snow_Storm_-_Steam-Boat_off_a_Harbour%27s_Mouth.jpg/1920px-J.M.W._Turner_%E2%80%93_Snow_Storm_-_Steam-Boat_off_a_Harbour%27s_Mouth.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:J.M.W._Turner_%E2%80%93_Snow_Storm_-_Steam-Boat_off_a_Harbour%27s_Mouth.jpg',
    credit: 'Wikimedia Commons',
    license: 'Public domain',
    accentColor: '#25282b'
  },
  {
    id: 'nasa-mars-cerberus-fossae',
    title: 'Cerberus Fossae Trough on Mars',
    provider: 'nasa',
    imageUrl: 'https://images-assets.nasa.gov/image/PIA12348/PIA12348~orig.jpg',
    sourceUrl: 'https://images.nasa.gov/details/PIA12348',
    credit: 'NASA/JPL-Caltech/University of Arizona',
    license: 'NASA image',
    accentColor: '#25130d'
  },
  {
    id: 'met-rembrandt-self-portrait',
    title: 'Self-Portrait',
    provider: 'met',
    imageUrl: 'https://images.metmuseum.org/CRDImages/ep/original/DP-16323-001.jpg',
    sourceUrl: 'https://www.metmuseum.org/art/collection/search/437397',
    credit: 'The Metropolitan Museum of Art',
    license: 'Open Access / Public Domain',
    accentColor: '#1e1510'
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
  const normalizedSeed = String(seed || '')
  const dailyIndex = getDailyFeaturedBackgroundIndex(normalizedSeed, count)
  const index = dailyIndex ?? Math.abs(hashFeaturedBackgroundSeed(normalizedSeed)) % count
  return FEATURED_BACKGROUND_ITEMS[index] || getDefaultFeaturedBackgroundItem()
}

export function getFeaturedBackgroundItemsForDate(
  seed: unknown = Date.now(),
  count = DAILY_FEATURED_BACKGROUND_OPTION_COUNT
): FeaturedBackgroundItem[] {
  const total = FEATURED_BACKGROUND_ITEMS.length
  if (total <= 0) {
    return []
  }

  const normalizedSeed = String(seed || '')
  const dailyIndex = getDailyFeaturedBackgroundIndex(normalizedSeed, total)
  const startIndex = dailyIndex ?? Math.abs(hashFeaturedBackgroundSeed(normalizedSeed)) % total
  const optionCount = Math.min(Math.max(1, Math.floor(count)), total)
  return Array.from({ length: optionCount }, (_, offset) => {
    const index = (startIndex + offset) % total
    return FEATURED_BACKGROUND_ITEMS[index] || getDefaultFeaturedBackgroundItem()
  })
}

function getDailyFeaturedBackgroundIndex(seed: string, count: number): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(seed)
  if (!match || count <= 0) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const timestamp = Date.UTC(year, month - 1, day)
  if (!Number.isFinite(timestamp)) {
    return null
  }

  return Math.floor(timestamp / 86400000) % count
}

function hashFeaturedBackgroundSeed(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash | 0
}
