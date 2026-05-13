export interface TagCloudSourceItem {
  tag: string
  count: number
}

export interface TagCloudItem {
  tag: string
  count: number
  rank: number
  tier: TagCloudTier
  leftPercent: number
  topPercent: number
  fontSizePx: number
  opacity: number
  mass: number
  radiusPx: number
  collisionWidthPx: number
  collisionHeightPx: number
  collisionStrength: number
  phase: number
  flowStrength: number
  accent: boolean
  tail: boolean
}

export type TagCloudTier = 'core' | 'body' | 'mist'

export interface TagCloudOptions {
  widthPx?: number
  heightPx?: number
  maxItems?: number
}

type PlacedBox = { left: number; right: number; top: number; bottom: number; tier: TagCloudTier }

const DEFAULT_WIDTH_PX = 1680
const DEFAULT_HEIGHT_PX = 820
const MIN_FONT_PX = 7.8
const MAX_FONT_PX = 36

export function buildTagCloudItems(items: TagCloudSourceItem[], options: TagCloudOptions = {}): TagCloudItem[] {
  const normalized = items
    .map((item) => ({
      tag: String(item.tag || '').trim(),
      count: Math.max(0, Number(item.count) || 0)
    }))
    .filter((item) => item.tag)

  if (!normalized.length) {
    return []
  }

  const maxItems = Number.isFinite(Number(options.maxItems)) && Number(options.maxItems) > 0
    ? Math.floor(Number(options.maxItems))
    : normalized.length
  const visibleItems = normalized
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag, 'zh-CN'))
    .slice(0, Math.max(1, maxItems))
  const widthPx = Math.max(640, Math.floor(options.widthPx || DEFAULT_WIDTH_PX))
  const heightPx = Math.max(360, Math.floor(options.heightPx || DEFAULT_HEIGHT_PX))
  const maxCount = Math.max(...visibleItems.map((item) => item.count), 1)
  const minCount = Math.min(...visibleItems.map((item) => item.count))
  const countRange = Math.max(1, maxCount - minCount)
  const columns = Math.max(1, Math.ceil(Math.sqrt(visibleItems.length * widthPx / heightPx)))
  const rows = Math.max(1, Math.ceil(visibleItems.length / columns))
  const densityScale = getDensityScale(visibleItems.length, widthPx, heightPx)
  const draftItems = visibleItems.map((item, index) => {
    const weight = (item.count - minCount) / countRange
    const rankProgress = index / Math.max(1, visibleItems.length - 1)
    const tier = getTier(index, visibleItems.length)
    const tail = tier === 'mist'
    const fontSizePx = getFontSizePx(weight, rankProgress, tier, densityScale)
    const position = getRectangularPosition(item.tag, index, columns, rows)
    const collisionBox = estimateCollisionBox(item.tag, fontSizePx, tier)
    const radiusPx = Math.hypot(collisionBox.widthPx, collisionBox.heightPx) / 2
    const curvedWeight = Math.pow(weight, 0.58)

    return {
      tag: item.tag,
      count: item.count,
      rank: index + 1,
      tier,
      leftPercent: position.leftPercent,
      topPercent: position.topPercent,
      fontSizePx: round(fontSizePx, 1),
      opacity: round(getOpacity(curvedWeight, tier), 2),
      mass: round(getMass(fontSizePx, tier), 2),
      radiusPx: round(radiusPx, 1),
      collisionWidthPx: round(collisionBox.widthPx, 1),
      collisionHeightPx: round(collisionBox.heightPx, 1),
      collisionStrength: round(getCollisionStrength(tier), 2),
      phase: round(seededUnit(`${item.tag}:phase`) * Math.PI * 2, 4),
      flowStrength: round(getFlowStrength(tier, seededUnit(`${item.tag}:flow`)), 3),
      accent: tier === 'core' && index < Math.max(2, Math.ceil(Math.min(visibleItems.length, 120) * 0.08)),
      tail
    }
  })
  return relaxReadablePositions(draftItems, widthPx, heightPx, columns, rows)
}

function getTier(index: number, total: number): TagCloudTier {
  const coreLimit = Math.min(total, Math.max(8, Math.ceil(Math.sqrt(total) * 1.28), Math.ceil(total * 0.032)))
  const bodyLimit = Math.min(total, Math.max(coreLimit + 1, Math.ceil(total * 0.22)))
  if (index < coreLimit) {
    return 'core'
  }
  if (index < bodyLimit) {
    return 'body'
  }
  return 'mist'
}

function getFontSizePx(weight: number, rankProgress: number, tier: TagCloudTier, densityScale: number): number {
  const rankWeight = Math.pow(1 - rankProgress, 2.3)
  const usageWeight = Math.pow(weight, 0.62)
  if (tier === 'core') {
    return (15.2 + (rankWeight * 0.52 + usageWeight * 0.48) * (MAX_FONT_PX - 15.2)) * densityScale
  }
  if (tier === 'body') {
    return (9.8 + (rankWeight * 0.46 + usageWeight * 0.54) * 7.1) * densityScale
  }
  return clamp(MIN_FONT_PX, 10.6, (9.3 - rankProgress * 1.15 + Math.pow(weight, 0.65) * 1.25) * densityScale)
}

function getRectangularPosition(tag: string, index: number, columns: number, rows: number): {
  leftPercent: number
  topPercent: number
} {
  const columnHint = columns > 0 ? (index % columns) / columns : 0
  const rowHint = rows > 0 ? (Math.floor(index / Math.max(1, columns)) % rows) / rows : 0
  const x = fractional(0.5 + index * 0.61803398875 + columnHint * 0.11)
  const y = fractional(0.5 + index * 0.75487766625 + rowHint * 0.13)
  const jitterX = (seededUnit(`${tag}:x`) - 0.5) * 0.024
  const jitterY = (seededUnit(`${tag}:y`) - 0.5) * 0.024

  return {
    leftPercent: round(clamp(1.3, 98.7, (x + jitterX) * 100), 2),
    topPercent: round(clamp(1.6, 98.4, (y + jitterY) * 100), 2)
  }
}

function fractional(value: number): number {
  return value - Math.floor(value)
}

function relaxReadablePositions(
  items: TagCloudItem[],
  widthPx: number,
  heightPx: number,
  columns: number,
  rows: number
): TagCloudItem[] {
  const readable = items.filter((item) => item.tier === 'core' || item.tier === 'body')
  const placed: PlacedBox[] = []
  const relaxedItems: TagCloudItem[] = []

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    if (item.tier === 'mist') {
      relaxedItems.push(item)
      continue
    }

    const initialX = widthPx * item.leftPercent / 100
    const initialY = heightPx * item.topPercent / 100
    const candidate = findReadablePosition({
      item,
      index,
      readableCount: readable.length,
      widthPx,
      heightPx,
      columns,
      rows,
      initialX,
      initialY,
      placed
    })
    const box = getBox(candidate.x, candidate.y, item.collisionWidthPx, item.collisionHeightPx)
    placed.push({
      ...box,
      tier: item.tier
    })
    relaxedItems.push({
      ...item,
      leftPercent: round(candidate.x / widthPx * 100, 2),
      topPercent: round(candidate.y / heightPx * 100, 2)
    })
  }

  return relaxMistPositions(relaxedItems, placed, widthPx, heightPx, columns, rows)
}

function findReadablePosition({
  item,
  index,
  readableCount,
  widthPx,
  heightPx,
  columns,
  rows,
  initialX,
  initialY,
  placed
}: {
  item: TagCloudItem
  index: number
  readableCount: number
  widthPx: number
  heightPx: number
  columns: number
  rows: number
  initialX: number
  initialY: number
  placed: PlacedBox[]
}): { x: number; y: number } {
  const halfWidth = item.collisionWidthPx / 2
  const halfHeight = item.collisionHeightPx / 2
  const minX = halfWidth + 4
  const maxX = widthPx - halfWidth - 4
  const minY = halfHeight + 4
  const maxY = heightPx - halfHeight - 4
  const candidates = getReadableCandidates({
    tag: item.tag,
    index,
    readableCount,
    widthPx,
    heightPx,
    columns,
    rows,
    initialX,
    initialY
  })

  let best = {
    x: clamp(minX, maxX, initialX),
    y: clamp(minY, maxY, initialY),
    score: Number.POSITIVE_INFINITY
  }

  for (const candidate of candidates) {
    const x = clamp(minX, maxX, candidate.x)
    const y = clamp(minY, maxY, candidate.y)
    const box = getBox(x, y, item.collisionWidthPx, item.collisionHeightPx)
    const overlapScore = getReadableOverlapScore(box, placed, item.tier)
    const drift = Math.hypot(x - initialX, y - initialY) * 0.018
    const edgePenalty = getEdgePenalty(x, y, widthPx, heightPx)
    const score = overlapScore + drift + edgePenalty
    if (score < best.score) {
      best = {
        x,
        y,
        score
      }
      if (score <= 0.01) {
        break
      }
    }
  }

  return best
}

function getReadableCandidates({
  tag,
  index,
  readableCount,
  widthPx,
  heightPx,
  columns,
  rows,
  initialX,
  initialY
}: {
  tag: string
  index: number
  readableCount: number
  widthPx: number
  heightPx: number
  columns: number
  rows: number
  initialX: number
  initialY: number
}): Array<{ x: number; y: number }> {
  const candidates: Array<{ x: number; y: number }> = [{ x: initialX, y: initialY }]
  const readableColumns = Math.max(8, Math.ceil(Math.sqrt(readableCount * widthPx / heightPx)))
  const readableRows = Math.max(6, Math.ceil(readableCount / readableColumns))
  const slotIndex = permuteIndex(index, readableColumns * readableRows, tag)
  const slotX = (slotIndex % readableColumns + 0.5) / readableColumns * widthPx
  const slotY = (Math.floor(slotIndex / readableColumns) % readableRows + 0.5) / readableRows * heightPx
  candidates.push({ x: slotX, y: slotY })

  const coarseIndex = permuteIndex(index * 7 + 3, Math.max(1, columns * rows), `${tag}:coarse`)
  candidates.push({
    x: (coarseIndex % columns + 0.5) / columns * widthPx,
    y: (Math.floor(coarseIndex / columns) % rows + 0.5) / rows * heightPx
  })

  const baseStep = Math.max(18, Math.min(widthPx, heightPx) * 0.035)
  for (let ring = 1; ring <= 7; ring += 1) {
    const points = ring * 8
    const radius = baseStep * ring
    for (let point = 0; point < points; point += 1) {
      const angle = Math.PI * 2 * (point / points + seededUnit(`${tag}:candidate:${ring}`) * 0.19)
      candidates.push({
        x: initialX + Math.cos(angle) * radius,
        y: initialY + Math.sin(angle) * radius
      })
      candidates.push({
        x: slotX + Math.cos(angle + 0.37) * radius,
        y: slotY + Math.sin(angle + 0.37) * radius
      })
    }
  }

  return candidates
}

function relaxMistPositions(
  items: TagCloudItem[],
  readablePlaced: PlacedBox[],
  widthPx: number,
  heightPx: number,
  columns: number,
  rows: number
): TagCloudItem[] {
  const mistGrid = new Map<string, PlacedBox[]>()
  const cellSize = Math.max(44, Math.min(82, Math.min(widthPx, heightPx) * 0.065))

  const positionedItems = items.map((item, index) => {
    if (item.tier !== 'mist') {
      return item
    }

    const initialX = widthPx * item.leftPercent / 100
    const initialY = heightPx * item.topPercent / 100
    const candidate = findMistPosition({
      item,
      index,
      total: items.length,
      widthPx,
      heightPx,
      columns,
      rows,
      initialX,
      initialY,
      readablePlaced,
      mistGrid,
      cellSize
    })
    const box = getBox(candidate.x, candidate.y, item.collisionWidthPx, item.collisionHeightPx)
    addBoxToGrid(mistGrid, box, item.tier, cellSize)
    return {
      ...item,
      leftPercent: round(candidate.x / widthPx * 100, 2),
      topPercent: round(candidate.y / heightPx * 100, 2)
    }
  })

  return settleMistCollisions(positionedItems, widthPx, heightPx)
}

function settleMistCollisions(items: TagCloudItem[], widthPx: number, heightPx: number): TagCloudItem[] {
  const entries = items.map((item, index) => ({
    index,
    tier: item.tier,
    x: widthPx * item.leftPercent / 100,
    y: heightPx * item.topPercent / 100,
    width: item.collisionWidthPx,
    height: item.collisionHeightPx
  }))

  for (let iteration = 0; iteration < 24; iteration += 1) {
    let moved = 0
    for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
        const left = entries[leftIndex]
        const right = entries[rightIndex]
        if (left.tier !== 'mist' && right.tier !== 'mist') {
          continue
        }

        const leftBox = getEntryBox(left, left.tier === 'mist' ? 0.8 : 2.4)
        const rightBox = getEntryBox(right, right.tier === 'mist' ? 0.8 : 2.4)
        const overlapX = Math.min(leftBox.right, rightBox.right) - Math.max(leftBox.left, rightBox.left)
        const overlapY = Math.min(leftBox.bottom, rightBox.bottom) - Math.max(leftBox.top, rightBox.top)
        if (overlapX <= 0 || overlapY <= 0) {
          continue
        }

        const axisX = overlapX < overlapY
        const direction = axisX
          ? (right.x >= left.x ? 1 : -1)
          : (right.y >= left.y ? 1 : -1)
        const push = Math.min(overlapX, overlapY) + 0.35
        const leftWeight = left.tier === 'mist'
          ? (right.tier === 'mist' ? 0.5 : 1)
          : 0
        const rightWeight = right.tier === 'mist'
          ? (left.tier === 'mist' ? 0.5 : 1)
          : 0

        if (axisX) {
          left.x -= direction * push * leftWeight
          right.x += direction * push * rightWeight
        } else {
          left.y -= direction * push * leftWeight
          right.y += direction * push * rightWeight
        }
        clampEntry(left, widthPx, heightPx)
        clampEntry(right, widthPx, heightPx)
        moved += push * (leftWeight + rightWeight)
      }
    }
    if (moved < 0.25) {
      break
    }
  }

  return items.map((item, index) => {
    if (item.tier !== 'mist') {
      return item
    }
    const entry = entries[index]
    return {
      ...item,
      leftPercent: round(entry.x / widthPx * 100, 2),
      topPercent: round(entry.y / heightPx * 100, 2)
    }
  })
}

function getEntryBox(entry: {
  x: number
  y: number
  width: number
  height: number
}, padding: number): { left: number; right: number; top: number; bottom: number } {
  return {
    left: entry.x - entry.width / 2 - padding,
    right: entry.x + entry.width / 2 + padding,
    top: entry.y - entry.height / 2 - padding,
    bottom: entry.y + entry.height / 2 + padding
  }
}

function clampEntry(entry: {
  x: number
  y: number
  width: number
  height: number
}, widthPx: number, heightPx: number): void {
  const minX = Math.max(widthPx * 0.01, entry.width / 2 + 3)
  const maxX = Math.min(widthPx * 0.99, widthPx - entry.width / 2 - 3)
  const minY = Math.max(heightPx * 0.01, entry.height / 2 + 3)
  const maxY = Math.min(heightPx * 0.99, heightPx - entry.height / 2 - 3)
  entry.x = clamp(minX, maxX, entry.x)
  entry.y = clamp(minY, maxY, entry.y)
}

function findMistPosition({
  item,
  index,
  total,
  widthPx,
  heightPx,
  columns,
  rows,
  initialX,
  initialY,
  readablePlaced,
  mistGrid,
  cellSize
}: {
  item: TagCloudItem
  index: number
  total: number
  widthPx: number
  heightPx: number
  columns: number
  rows: number
  initialX: number
  initialY: number
  readablePlaced: PlacedBox[]
  mistGrid: Map<string, PlacedBox[]>
  cellSize: number
}): { x: number; y: number } {
  const halfWidth = item.collisionWidthPx / 2
  const halfHeight = item.collisionHeightPx / 2
  const minX = Math.max(widthPx * 0.01, halfWidth + 3)
  const maxX = Math.min(widthPx * 0.99, widthPx - halfWidth - 3)
  const minY = Math.max(heightPx * 0.01, halfHeight + 3)
  const maxY = Math.min(heightPx * 0.99, heightPx - halfHeight - 3)
  const candidates = getMistCandidates({
    tag: item.tag,
    index,
    total,
    widthPx,
    heightPx,
    columns,
    rows,
    initialX,
    initialY
  })

  let best = {
    x: clamp(minX, maxX, initialX),
    y: clamp(minY, maxY, initialY),
    score: Number.POSITIVE_INFINITY
  }

  for (const candidate of candidates) {
    const x = clamp(minX, maxX, candidate.x)
    const y = clamp(minY, maxY, candidate.y)
    const box = getBox(x, y, item.collisionWidthPx, item.collisionHeightPx)
    const overlapScore = getMistOverlapScore(box, readablePlaced, mistGrid, cellSize)
    const drift = Math.hypot(x - initialX, y - initialY) * 0.0025
    const edgePenalty = getEdgePenalty(x, y, widthPx, heightPx) * 0.28
    const score = overlapScore + drift + edgePenalty
    if (score < best.score) {
      best = { x, y, score }
      if (score <= 0.01) {
        break
      }
    }
  }

  return best
}

function getMistCandidates({
  tag,
  index,
  total,
  widthPx,
  heightPx,
  columns,
  rows,
  initialX,
  initialY
}: {
  tag: string
  index: number
  total: number
  widthPx: number
  heightPx: number
  columns: number
  rows: number
  initialX: number
  initialY: number
}): Array<{ x: number; y: number }> {
  const candidates: Array<{ x: number; y: number }> = [{ x: initialX, y: initialY }]
  const mistColumns = Math.max(columns, Math.ceil(Math.sqrt(total * widthPx / heightPx * 1.18)))
  const mistRows = Math.max(rows, Math.ceil(total / mistColumns))
  const slots = Math.max(1, mistColumns * mistRows)
  const cellWidth = widthPx / mistColumns
  const cellHeight = heightPx / mistRows

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const slotIndex = permuteIndex(index * (attempt * 2 + 5) + attempt * 17, slots, `${tag}:mist-slot:${attempt}`)
    const jitterX = (seededUnit(`${tag}:mist-jitter-x:${attempt}`) - 0.5) * cellWidth * 0.34
    const jitterY = (seededUnit(`${tag}:mist-jitter-y:${attempt}`) - 0.5) * cellHeight * 0.34
    candidates.push({
      x: (slotIndex % mistColumns + 0.5) * cellWidth + jitterX,
      y: (Math.floor(slotIndex / mistColumns) % mistRows + 0.5) * cellHeight + jitterY
    })
  }

  const baseStep = Math.max(16, Math.min(widthPx, heightPx) * 0.028)
  for (let ring = 1; ring <= 8; ring += 1) {
    const points = ring * 8
    const radius = baseStep * ring
    for (let point = 0; point < points; point += 1) {
      const angle = Math.PI * 2 * (point / points + seededUnit(`${tag}:mist-ring:${ring}`) * 0.23)
      candidates.push({
        x: initialX + Math.cos(angle) * radius,
        y: initialY + Math.sin(angle) * radius
      })
    }
  }

  return candidates
}

function getMistOverlapScore(
  box: { left: number; right: number; top: number; bottom: number },
  readablePlaced: PlacedBox[],
  mistGrid: Map<string, PlacedBox[]>,
  cellSize: number
): number {
  let score = 0
  for (const other of readablePlaced) {
    const expanded = inflateBox(other, other.tier === 'core' ? 4 : 2)
    const overlap = getOverlapArea(box, expanded)
    if (overlap <= 0) {
      continue
    }
    const severity = other.tier === 'core' ? 42 : 22
    score += overlap * severity
  }

  const nearbyMist = getNearbyBoxes(mistGrid, box, cellSize)
  for (const other of nearbyMist) {
    const overlap = getOverlapArea(box, other)
    if (overlap > 0) {
      score += overlap * 18
    }
    const paddedOverlap = getOverlapArea(box, inflateBox(other, 2.2))
    if (paddedOverlap > overlap) {
      score += (paddedOverlap - overlap) * 1.4
    }
  }

  return score
}

function permuteIndex(index: number, total: number, seed: string): number {
  if (total <= 1) {
    return 0
  }
  const step = Math.max(1, Math.floor(total * 0.61803398875))
  const offset = Math.floor(seededUnit(seed) * total)
  return (index * step + offset) % total
}

function getBox(x: number, y: number, width: number, height: number): {
  left: number
  right: number
  top: number
  bottom: number
} {
  return {
    left: x - width / 2,
    right: x + width / 2,
    top: y - height / 2,
    bottom: y + height / 2
  }
}

function getReadableOverlapScore(
  box: { left: number; right: number; top: number; bottom: number },
  placed: PlacedBox[],
  tier: TagCloudTier
): number {
  let score = 0
  for (const other of placed) {
    const overlapArea = getOverlapArea(box, other)
    const severity = tier === 'core' || other.tier === 'core' ? 8 : 1.8
    score += overlapArea * severity
  }
  return score
}

function addBoxToGrid(
  grid: Map<string, PlacedBox[]>,
  box: { left: number; right: number; top: number; bottom: number },
  tier: TagCloudTier,
  cellSize: number
): void {
  const placed = { ...box, tier }
  const minX = Math.floor(box.left / cellSize)
  const maxX = Math.floor(box.right / cellSize)
  const minY = Math.floor(box.top / cellSize)
  const maxY = Math.floor(box.bottom / cellSize)
  for (let gx = minX; gx <= maxX; gx += 1) {
    for (let gy = minY; gy <= maxY; gy += 1) {
      const key = `${gx}:${gy}`
      const bucket = grid.get(key) || []
      bucket.push(placed)
      grid.set(key, bucket)
    }
  }
}

function getNearbyBoxes(
  grid: Map<string, PlacedBox[]>,
  box: { left: number; right: number; top: number; bottom: number },
  cellSize: number
): PlacedBox[] {
  const nearby: PlacedBox[] = []
  const seen = new Set<PlacedBox>()
  const minX = Math.floor(box.left / cellSize)
  const maxX = Math.floor(box.right / cellSize)
  const minY = Math.floor(box.top / cellSize)
  const maxY = Math.floor(box.bottom / cellSize)
  for (let gx = minX; gx <= maxX; gx += 1) {
    for (let gy = minY; gy <= maxY; gy += 1) {
      const bucket = grid.get(`${gx}:${gy}`) || []
      for (const entry of bucket) {
        if (seen.has(entry)) {
          continue
        }
        seen.add(entry)
        nearby.push(entry)
      }
    }
  }
  return nearby
}

function inflateBox(
  box: { left: number; right: number; top: number; bottom: number },
  padding: number
): { left: number; right: number; top: number; bottom: number } {
  return {
    left: box.left - padding,
    right: box.right + padding,
    top: box.top - padding,
    bottom: box.bottom + padding
  }
}

function getOverlapArea(
  left: { left: number; right: number; top: number; bottom: number },
  right: { left: number; right: number; top: number; bottom: number }
): number {
  const overlapWidth = Math.min(left.right, right.right) - Math.max(left.left, right.left)
  const overlapHeight = Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top)
  if (overlapWidth <= 0 || overlapHeight <= 0) {
    return 0
  }
  return overlapWidth * overlapHeight
}

function getEdgePenalty(x: number, y: number, widthPx: number, heightPx: number): number {
  const left = x / widthPx
  const right = 1 - left
  const top = y / heightPx
  const bottom = 1 - top
  const nearest = Math.min(left, right, top, bottom)
  return nearest < 0.025 ? (0.025 - nearest) * 800 : 0
}

function getDensityScale(total: number, widthPx: number, heightPx: number): number {
  const areaScale = Math.sqrt((widthPx * heightPx) / Math.max(1, total * 1380))
  const countScale = Math.sqrt(980 / Math.max(1, total))
  return clamp(0.88, 1.08, Math.min(areaScale, countScale))
}

function estimateCollisionBox(tag: string, fontSizePx: number, tier: TagCloudTier): {
  widthPx: number
  heightPx: number
} {
  const chars = [...tag]
  const asciiChars = chars.filter((char) => char.charCodeAt(0) < 128).length
  const wideChars = chars.length - asciiChars
  const baseWidth = Math.max(14, asciiChars * fontSizePx * 0.64 + wideChars * fontSizePx * 1.08)
  const baseHeight = fontSizePx * 1.08
  const scale = tier === 'core' ? 1.06 : tier === 'body' ? 0.92 : 0.5
  const paddingX = tier === 'core' ? 10 : tier === 'body' ? 6 : 2
  const paddingY = tier === 'core' ? 7 : tier === 'body' ? 4 : 1.5
  return {
    widthPx: Math.max(8, (baseWidth + paddingX * 2) * scale),
    heightPx: Math.max(6, (baseHeight + paddingY * 2) * scale)
  }
}

function getOpacity(weight: number, tier: TagCloudTier): number {
  if (tier === 'core') {
    return clamp(0.72, 0.98, 0.72 + weight * 0.26)
  }
  if (tier === 'body') {
    return clamp(0.38, 0.72, 0.38 + weight * 0.28)
  }
  return clamp(0.18, 0.42, 0.18 + weight * 0.16)
}

function getMass(fontSizePx: number, tier: TagCloudTier): number {
  if (tier === 'core') {
    return clamp(1.1, 2.4, 1.08 + fontSizePx / 24)
  }
  if (tier === 'body') {
    return clamp(0.82, 1.45, 0.76 + fontSizePx / 32)
  }
  return clamp(0.46, 0.84, 0.44 + fontSizePx / 38)
}

function getCollisionStrength(tier: TagCloudTier): number {
  if (tier === 'core') {
    return 0.82
  }
  if (tier === 'body') {
    return 0.38
  }
  return 0.12
}

function getFlowStrength(tier: TagCloudTier, seed: number): number {
  if (tier === 'core') {
    return 0.54 + seed * 0.32
  }
  if (tier === 'body') {
    return 0.76 + seed * 0.46
  }
  return 1.05 + seed * 0.58
}

function seededUnit(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}
