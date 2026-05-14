import {
  type IconSettings,
  getEffectiveIconTileWidthPx,
  getIconGapPx,
  getIconRowGapPx
} from './icon-settings.js'

export function getIconPreviewSignature(settings: IconSettings): string {
  return [
    settings.pageWidth,
    settings.columnGap,
    settings.rowGap,
    settings.tileWidth,
    settings.iconShellSize,
    settings.layoutMode,
    settings.columns,
    settings.showTitles ? 1 : 0,
    settings.titleLines
  ].join('|')
}

export function renderIconPreviewElement(
  preview: HTMLElement,
  summaryElement: HTMLElement | null,
  settings: IconSettings
): void {
  const previewColumnGap = Math.max(4, Math.round(getIconGapPx(settings.columnGap) * 0.34))
  const previewRowGap = Math.max(4, Math.round(getIconRowGapPx(settings.rowGap) * 0.34))
  const effectiveTileWidth = getEffectiveIconTileWidthPx(settings)
  const previewTileWidth = Math.max(48, Math.round(effectiveTileWidth * 0.42))
  const previewShellSize = Math.max(18, Math.round(settings.iconShellSize * 0.62))
  const previewColumns = settings.layoutMode === 'fixed'
    ? Math.max(2, Math.min(6, settings.columns))
    : Math.max(2, Math.min(4, Math.round(settings.pageWidth / 24)))
  const previewGridMaxWidth = previewColumns * previewTileWidth + (previewColumns - 1) * previewColumnGap
  const sampleCount = Math.max(4, Math.min(8, previewColumns * 2))
  const summary = [
    settings.layoutMode === 'fixed' ? `${settings.columns} 列固定` : '自动适配',
    `${settings.tileWidth}px 卡片`,
    `${settings.iconShellSize}px 图标区`,
    settings.showTitles ? `${settings.titleLines} 行标题` : '图标模式'
  ].join(' · ')
  const signature = getIconPreviewSignature(settings)

  preview.dataset.iconLayoutMode = settings.layoutMode
  preview.dataset.iconShowTitles = String(settings.showTitles)
  preview.style.setProperty('--preview-page-width', `${settings.pageWidth}%`)
  preview.style.setProperty('--preview-column-gap', `${previewColumnGap}px`)
  preview.style.setProperty('--preview-row-gap', `${previewRowGap}px`)
  preview.style.setProperty('--preview-tile-width', `${previewTileWidth}px`)
  preview.style.setProperty('--preview-shell-size', `${previewShellSize}px`)
  preview.style.setProperty('--preview-title-lines', String(settings.titleLines))
  preview.style.setProperty('--preview-grid-max-width', `${previewGridMaxWidth}px`)
  if (summaryElement) {
    summaryElement.textContent = summary
  }

  if (preview.dataset.iconPreviewSignature === signature && preview.firstElementChild) {
    return
  }

  const grid = document.createElement('div')
  grid.className = 'icon-live-preview-grid'
  grid.style.gridTemplateColumns = `repeat(${previewColumns}, minmax(0, 1fr))`

  const names = ['阅读', '工作台', '邮箱', '文档', '设计', '数据', '日程', '收藏']
  for (let index = 0; index < sampleCount; index++) {
    const tile = document.createElement('span')
    tile.className = 'icon-live-preview-tile'

    const shell = document.createElement('span')
    shell.className = 'icon-live-preview-shell'
    const mark = document.createElement('span')
    mark.className = 'icon-live-preview-mark'
    mark.textContent = names[index]?.slice(0, 1) || '*'
    shell.appendChild(mark)

    const title = document.createElement('span')
    title.className = 'icon-live-preview-title'
    title.textContent = names[index]

    tile.append(shell, title)
    grid.appendChild(tile)
  }

  preview.dataset.iconPreviewSignature = signature
  preview.replaceChildren(grid)
}
