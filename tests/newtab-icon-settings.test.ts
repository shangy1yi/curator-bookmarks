import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEFAULT_ICON_SETTINGS,
  ICON_LAYOUT_PRESETS,
  detectPresetFromValues,
  getEffectiveIconTileWidthPx,
  getFixedIconGridWidthPx,
  getFolderGapPx,
  getIconGapPx,
  getIconRowGapPx,
  getResponsiveFixedIconColumns,
  normalizeIconSettings
} from '../src/newtab/icon-settings.js'

test('normalizes legacy icon settings and fills new layout defaults', () => {
  assert.deepEqual(
    normalizeIconSettings({
      pageWidth: 70,
      spacing: 12,
      tileWidth: 168,
      iconShellSize: 34,
      preset: 'custom'
    }),
    {
      ...DEFAULT_ICON_SETTINGS,
      pageWidth: 70,
      columnGap: 12,
      rowGap: 12,
      folderGap: DEFAULT_ICON_SETTINGS.folderGap,
      tileWidth: 168,
      iconShellSize: 34,
      verticalCenter: false,
      preset: 'custom'
    }
  )
})

test('bounds invalid icon setting values', () => {
  const settings = normalizeIconSettings({
    pageWidth: 999,
    columnGap: -8,
    rowGap: 999,
    folderGap: 999,
    tileWidth: 2,
    iconShellSize: 999,
    layoutMode: 'fixed',
    columns: 99,
    verticalCenter: true,
    showTitles: false,
    titleLines: 9,
    preset: 'unknown'
  })

  assert.equal(settings.pageWidth, 100)
  assert.equal(settings.columnGap, 0)
  assert.equal(settings.rowGap, 100)
  assert.equal(settings.folderGap, 120)
  assert.equal(settings.tileWidth, 132)
  assert.equal(settings.iconShellSize, 48)
  assert.equal(settings.layoutMode, 'fixed')
  assert.equal(settings.columns, 8)
  assert.equal(settings.verticalCenter, true)
  assert.equal(settings.showTitles, false)
  assert.equal(settings.titleLines, 2)
  assert.equal(settings.preset, 'custom')
})

test('detects preset values including new schema fields', () => {
  const comfortable = normalizeIconSettings({
    ...ICON_LAYOUT_PRESETS.comfortable,
    preset: ''
  })
  assert.equal(comfortable.preset, 'comfortable')

  const verticallyCentered = normalizeIconSettings({
    ...ICON_LAYOUT_PRESETS.comfortable,
    verticalCenter: true
  })
  assert.equal(verticallyCentered.preset, 'comfortable')
  assert.equal(verticallyCentered.verticalCenter, true)

  assert.equal(
    detectPresetFromValues({
      ...ICON_LAYOUT_PRESETS.compact,
      showTitles: false
    }),
    'custom'
  )
})

test('treats stale preset names as custom when values no longer match', () => {
  const settings = normalizeIconSettings({
    ...ICON_LAYOUT_PRESETS.compact,
    columns: 6,
    titleLines: 2,
    preset: 'compact'
  })

  assert.equal(settings.preset, 'custom')
})

test('computes fixed grid width from columns, tile width and gap', () => {
  const settings = normalizeIconSettings({
    layoutMode: 'fixed',
    columns: 4,
    tileWidth: 180,
    columnGap: 6
  })
  assert.equal(getIconGapPx(6), 20)
  assert.equal(getIconRowGapPx(0), 2)
  assert.equal(getFolderGapPx(999), 120)
  assert.equal(getFixedIconGridWidthPx(settings), 780)
})

test('shrinks effective tile width when card titles are hidden', () => {
  const settings = normalizeIconSettings({
    tileWidth: 220,
    iconShellSize: 32,
    showTitles: false
  })

  assert.equal(getEffectiveIconTileWidthPx(settings), 55)
})

test('clamps fixed icon columns to fit narrow viewports without changing desktop columns', () => {
  const settings = normalizeIconSettings({
    layoutMode: 'fixed',
    columns: 8,
    tileWidth: 184,
    columnGap: 10,
    pageWidth: 78
  })

  assert.equal(getResponsiveFixedIconColumns(settings, 1920), 8)
  assert.equal(getResponsiveFixedIconColumns(settings, 820), 3)
  assert.equal(getResponsiveFixedIconColumns(settings, 390), 1)
})

test('leaves auto layout column setting unchanged for responsive calculation', () => {
  const settings = normalizeIconSettings({
    layoutMode: 'auto',
    columns: 7
  })

  assert.equal(getResponsiveFixedIconColumns(settings, 390), 7)
})
