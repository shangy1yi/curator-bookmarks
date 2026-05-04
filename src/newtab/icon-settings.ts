const ICON_PAGE_WIDTH_REFERENCE_PX = 1920

export const ICON_LAYOUT_PRESETS = {
  compact: {
    tileWidth: 148,
    iconShellSize: 28,
    pageWidth: 72,
    columnGap: 6,
    rowGap: 8,
    folderGap: 16,
    layoutMode: 'auto',
    columns: 5,
    showTitles: true,
    titleLines: 1
  },
  comfortable: {
    tileWidth: 184,
    iconShellSize: 32,
    pageWidth: 78,
    columnGap: 10,
    rowGap: 10,
    folderGap: 20,
    layoutMode: 'auto',
    columns: 4,
    showTitles: true,
    titleLines: 1
  },
  spacious: {
    tileWidth: 224,
    iconShellSize: 36,
    pageWidth: 84,
    columnGap: 14,
    rowGap: 14,
    folderGap: 26,
    layoutMode: 'auto',
    columns: 3,
    showTitles: true,
    titleLines: 2
  }
} as const

export type IconLayoutPresetKey = keyof typeof ICON_LAYOUT_PRESETS
export type IconLayoutMode = 'auto' | 'fixed'

export interface IconSettings {
  pageWidth: number
  columnGap: number
  rowGap: number
  folderGap: number
  tileWidth: number
  iconShellSize: number
  preset: string
  layoutMode: IconLayoutMode
  columns: number
  showTitles: boolean
  titleLines: number
  verticalCenter: boolean
}

type IconPresetValues = Omit<IconSettings, 'preset' | 'verticalCenter'>

export const ICON_PRESET_META: Record<IconLayoutPresetKey, {
  name: string
  desc: string
  detail: string
  cols: number
  rows: number
}> = {
  compact: { name: '紧凑', desc: '148px · 28px', detail: '高频访问 · 单行卡片', cols: 4, rows: 3 },
  comfortable: { name: '均衡', desc: '184px · 32px', detail: '日常桌面 · 标准卡片', cols: 3, rows: 3 },
  spacious: { name: '展示', desc: '224px · 36px', detail: '大屏展示 · 双行卡片', cols: 2, rows: 3 }
}

export const DEFAULT_ICON_SETTINGS: IconSettings = {
  pageWidth: 78,
  columnGap: 10,
  rowGap: 10,
  folderGap: 20,
  tileWidth: 184,
  iconShellSize: 32,
  preset: 'comfortable',
  layoutMode: 'auto',
  columns: 4,
  showTitles: true,
  titleLines: 1,
  verticalCenter: false
}

const SUPPORTED_LAYOUT_MODES = new Set(['auto', 'fixed'])

export function normalizeIconSettings(rawSettings: unknown): IconSettings {
  const settings = rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings)
    ? rawSettings as Record<string, unknown>
    : {}
  const legacySpacing = settings.spacing

  const pageWidth = clampNumber(settings.pageWidth, 16, 100, DEFAULT_ICON_SETTINGS.pageWidth)
  const columnGap = clampNumber(
    settings.columnGap ?? legacySpacing,
    0,
    100,
    DEFAULT_ICON_SETTINGS.columnGap
  )
  const rowGap = clampNumber(
    settings.rowGap ?? legacySpacing,
    0,
    100,
    DEFAULT_ICON_SETTINGS.rowGap
  )
  const folderGap = clampNumber(settings.folderGap, 0, 120, DEFAULT_ICON_SETTINGS.folderGap)
  const tileWidth = clampNumber(settings.tileWidth, 132, 260, DEFAULT_ICON_SETTINGS.tileWidth)
  const iconShellSize = clampNumber(settings.iconShellSize, 24, 48, DEFAULT_ICON_SETTINGS.iconShellSize)
  const layoutMode = SUPPORTED_LAYOUT_MODES.has(String(settings.layoutMode))
    ? String(settings.layoutMode) as IconLayoutMode
    : DEFAULT_ICON_SETTINGS.layoutMode
  const columns = clampNumber(settings.columns, 2, 8, DEFAULT_ICON_SETTINGS.columns)
  const showTitles = typeof settings.showTitles === 'boolean'
    ? settings.showTitles
    : DEFAULT_ICON_SETTINGS.showTitles
  const titleLines = clampNumber(settings.titleLines, 1, 2, DEFAULT_ICON_SETTINGS.titleLines)
  const verticalCenter = typeof settings.verticalCenter === 'boolean'
    ? settings.verticalCenter
    : DEFAULT_ICON_SETTINGS.verticalCenter

  const preset = detectPresetFromValues({
    pageWidth,
    columnGap,
    rowGap,
    folderGap,
    tileWidth,
    iconShellSize,
    layoutMode,
    columns,
    showTitles,
    titleLines
  })

  return {
    pageWidth,
    columnGap,
    rowGap,
    folderGap,
    tileWidth,
    iconShellSize,
    preset,
    layoutMode,
    columns,
    showTitles,
    titleLines,
    verticalCenter
  }
}

export function detectPresetFromValues(settings: IconPresetValues): string {
  for (const [key, preset] of Object.entries(ICON_LAYOUT_PRESETS)) {
    if (
      settings.pageWidth === preset.pageWidth &&
      settings.columnGap === preset.columnGap &&
      settings.rowGap === preset.rowGap &&
      settings.folderGap === preset.folderGap &&
      settings.tileWidth === preset.tileWidth &&
      settings.iconShellSize === preset.iconShellSize &&
      settings.layoutMode === preset.layoutMode &&
      settings.columns === preset.columns &&
      settings.showTitles === preset.showTitles &&
      settings.titleLines === preset.titleLines
    ) {
      return key
    }
  }
  return 'custom'
}

export function getIconPageWidthPx(pageWidth: number): number {
  return Math.round((clampNumber(pageWidth, 16, 100, DEFAULT_ICON_SETTINGS.pageWidth) / 100) * ICON_PAGE_WIDTH_REFERENCE_PX)
}

export function getIconGapPx(spacing: number): number {
  return clampNumber(14 + spacing, 14, 114, 32)
}

export function getIconRowGapPx(spacing: number): number {
  return clampNumber(2 + spacing, 2, 102, 20)
}

export function getFolderGapPx(folderGap: number): number {
  return clampNumber(folderGap, 0, 120, DEFAULT_ICON_SETTINGS.folderGap)
}

export function getFixedIconGridWidthPx(settings: IconSettings): number {
  const columns = clampNumber(settings.columns, 2, 8, DEFAULT_ICON_SETTINGS.columns)
  const gap = getIconGapPx(settings.columnGap)
  const tileWidth = getEffectiveIconTileWidthPx(settings)
  return Math.round(columns * tileWidth + Math.max(columns - 1, 0) * gap)
}

export function getResponsiveFixedIconColumns(
  settings: IconSettings,
  viewportWidth: number
): number {
  const requestedColumns = clampNumber(settings.columns, 2, 8, DEFAULT_ICON_SETTINGS.columns)
  if (settings.layoutMode !== 'fixed') {
    return requestedColumns
  }

  const safeViewportWidth = Math.max(320, Math.round(Number(viewportWidth) || 0))
  const horizontalShellPadding = Math.max(48, Math.min(safeViewportWidth * 0.1, 144))
  const tileWidth = getEffectiveIconTileWidthPx(settings)
  const fixedGridWidth = getFixedIconGridWidthPx(settings)
  const availablePageWidth = Math.max(
    tileWidth,
    Math.min(
      Math.max(getIconPageWidthPx(settings.pageWidth), fixedGridWidth),
      safeViewportWidth - horizontalShellPadding
    )
  )
  const gap = getIconGapPx(settings.columnGap)
  const maxColumns = Math.max(
    1,
    Math.floor((availablePageWidth + gap) / (tileWidth + gap))
  )

  return Math.max(1, Math.min(requestedColumns, maxColumns))
}

export function getEffectiveIconTileWidthPx(settings: IconSettings): number {
  if (settings.showTitles) {
    return settings.tileWidth
  }

  return Math.max(settings.iconShellSize + 20, Math.round(settings.iconShellSize * 1.72))
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Math.round(Number(value))
  if (!Number.isFinite(numeric)) {
    return fallback
  }
  return Math.max(min, Math.min(max, numeric))
}
