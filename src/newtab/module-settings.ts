import { STORAGE_KEYS } from '../shared/constants.js'

export type NewTabModuleSettingKey =
  | 'speedDial'
  | 'health'

export interface NewTabModuleSettings {
  version: 1
  speedDial: boolean
  health: boolean
}

export interface NewTabModuleSettingRow {
  key: NewTabModuleSettingKey
  label: string
  description: string
  enabled: boolean
}

export const NEW_TAB_MODULE_SETTINGS_STORAGE_KEY = STORAGE_KEYS.newTabModuleSettings

export const DEFAULT_NEW_TAB_MODULE_SETTINGS: NewTabModuleSettings = {
  version: 1,
  speedDial: true,
  health: true
}

export const NEW_TAB_MODULE_SETTING_META: Record<
  NewTabModuleSettingKey,
  Omit<NewTabModuleSettingRow, 'key' | 'enabled'>
> = {
  speedDial: {
    label: 'Speed Dial',
    description: '显示固定的高频书签入口。'
  },
  health: {
    label: '书签健康',
    description: '显示待整理、重复、缺少标签或摘要等轻量提醒。'
  }
}

const MODULE_SETTING_KEYS: NewTabModuleSettingKey[] = [
  'speedDial',
  'health'
]

export function normalizeNewTabModuleSettings(rawSettings: unknown): NewTabModuleSettings {
  const source = rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings)
    ? rawSettings as Record<string, unknown>
    : {}

  return {
    version: 1,
    speedDial: readCombinedSpeedDialSetting(source),
    health: readBooleanSetting(source.health, DEFAULT_NEW_TAB_MODULE_SETTINGS.health)
  }
}

export function serializeNewTabModuleSettings(rawSettings: unknown): NewTabModuleSettings {
  return normalizeNewTabModuleSettings(rawSettings)
}

export function isNewTabModuleEnabled(
  rawSettings: unknown,
  key: NewTabModuleSettingKey
): boolean {
  return normalizeNewTabModuleSettings(rawSettings)[key]
}

export function getVisibleNewTabModules(rawSettings: unknown): NewTabModuleSettingKey[] {
  const settings = normalizeNewTabModuleSettings(rawSettings)
  return MODULE_SETTING_KEYS.filter((key) => settings[key])
}

export function buildNewTabModuleSettingRows(rawSettings: unknown): NewTabModuleSettingRow[] {
  const settings = normalizeNewTabModuleSettings(rawSettings)
  return MODULE_SETTING_KEYS.map((key) => ({
    key,
    ...NEW_TAB_MODULE_SETTING_META[key],
    enabled: settings[key]
  }))
}

function readBooleanSetting(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function readCombinedSpeedDialSetting(source: Record<string, unknown>): boolean {
  const speedDial = readBooleanSetting(source.speedDial, DEFAULT_NEW_TAB_MODULE_SETTINGS.speedDial)
  const workspaces = readBooleanSetting(source.workspaces, DEFAULT_NEW_TAB_MODULE_SETTINGS.speedDial)
  return speedDial && workspaces
}
