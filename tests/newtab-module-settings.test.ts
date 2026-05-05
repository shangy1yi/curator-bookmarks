import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  DEFAULT_NEW_TAB_MODULE_SETTINGS,
  NEW_TAB_MODULE_SETTINGS_STORAGE_KEY,
  buildNewTabModuleSettingRows,
  buildNewTabPrivacyNotice,
  buildNewTabPrivacyNoticeText,
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
    workspaces: true,
    health: false,
    commandHints: true,
    privacyNotice: false
  })
  assert.deepEqual(serializeNewTabModuleSettings(settings), settings)
})

test('exposes stable module setting rows and visible module order', () => {
  const rows = buildNewTabModuleSettingRows({
    speedDial: false,
    health: false
  })

  assert.deepEqual(rows.map((row) => row.key), [
    'speedDial',
    'workspaces',
    'health',
    'commandHints',
    'privacyNotice'
  ])
  assert.equal(rows[0].label, 'Speed Dial')
  assert.equal(rows[0].enabled, false)
  assert.equal(rows[2].enabled, false)
  assert.deepEqual(getVisibleNewTabModules({
    speedDial: false,
    health: false
  }), ['workspaces', 'commandHints', 'privacyNotice'])
  assert.equal(isNewTabModuleEnabled({ health: false }, 'health'), false)
  assert.equal(isNewTabModuleEnabled({ health: false }, 'speedDial'), true)
})

test('privacy notice states local-first and permission boundaries', () => {
  const notice = buildNewTabPrivacyNotice()
  const text = buildNewTabPrivacyNoticeText()

  assert.equal(NEW_TAB_MODULE_SETTINGS_STORAGE_KEY, STORAGE_KEYS.newTabModuleSettings)
  assert.equal(notice.guarantees.localFirst, true)
  assert.equal(notice.guarantees.tracksBrowsing, false)
  assert.equal(notice.guarantees.sellsData, false)
  assert.equal(notice.guarantees.modifiesDefaultSearchEngine, false)
  assert.equal(notice.guarantees.requiresHistoryPermission, false)
  assert.match(text, /本地优先/)
  assert.match(text, /不追踪/)
  assert.match(text, /不出售数据/)
  assert.match(text, /不修改默认搜索引擎/)
  assert.match(text, /不新增 history 权限/)
})
