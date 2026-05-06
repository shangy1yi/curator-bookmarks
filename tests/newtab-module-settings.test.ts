import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  DEFAULT_NEW_TAB_MODULE_SETTINGS,
  NEW_TAB_MODULE_SETTINGS_STORAGE_KEY,
  buildNewTabModuleSettingRows,
  getVisibleNewTabModules,
  isNewTabModuleEnabled,
  normalizeNewTabModuleSettings,
  serializeNewTabModuleSettings
} from '../src/newtab/module-settings.js'
import { STORAGE_KEYS } from '../src/shared/constants.js'

test('normalizes newtab module settings with explicit display switches', () => {
  assert.deepEqual(normalizeNewTabModuleSettings(null), DEFAULT_NEW_TAB_MODULE_SETTINGS)

  const settings = normalizeNewTabModuleSettings({
    version: 99,
    speedDial: false,
    workspaces: true,
    health: false,
    commandHints: 'no',
    privacyNotice: false
  })

  assert.deepEqual(settings, {
    version: 1,
    speedDial: false,
    health: false
  })
  assert.deepEqual(serializeNewTabModuleSettings(settings), settings)
})

test('merges legacy Speed Dial and Workspace switches into one module setting', () => {
  assert.equal(normalizeNewTabModuleSettings({ speedDial: true, workspaces: true }).speedDial, true)
  assert.equal(normalizeNewTabModuleSettings({ speedDial: true, workspaces: false }).speedDial, false)
  assert.equal(normalizeNewTabModuleSettings({ speedDial: false, workspaces: true }).speedDial, false)
})

test('exposes stable module setting rows and visible module order', () => {
  const rows = buildNewTabModuleSettingRows({
    speedDial: false,
    health: false
  })

  assert.deepEqual(rows.map((row) => row.key), [
    'speedDial',
    'health'
  ])
  assert.equal(rows[0].label, 'Speed Dial')
  assert.equal(rows[0].enabled, false)
  assert.equal(rows[1].enabled, false)
  assert.deepEqual(getVisibleNewTabModules({
    speedDial: false,
    health: false
  }), [])
  assert.equal(isNewTabModuleEnabled({ health: false }, 'health'), false)
  assert.equal(isNewTabModuleEnabled({ health: false }, 'speedDial'), true)
})

test('exposes the module settings storage key', () => {
  assert.equal(NEW_TAB_MODULE_SETTINGS_STORAGE_KEY, STORAGE_KEYS.newTabModuleSettings)
})
