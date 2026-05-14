import { STORAGE_KEYS } from '../shared/constants.js'

export type NewTabModuleSettingKey =
  | 'speedDial'

export interface NewTabModuleSettings {
  version: 1
  speedDial: boolean
  order: NewTabModuleSettingKey[]
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
  order: ['speedDial']
}

export const NEW_TAB_MODULE_SETTING_META: Record<
  NewTabModuleSettingKey,
  Omit<NewTabModuleSettingRow, 'key' | 'enabled'>
> = {
  speedDial: {
    label: 'Speed Dial',
    description: '显示固定的高频书签入口。'
  }
}

const MODULE_SETTING_KEYS: NewTabModuleSettingKey[] = [
  'speedDial'
]

export function normalizeNewTabModuleSettings(rawSettings: unknown): NewTabModuleSettings {
  const source = rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings)
    ? rawSettings as Record<string, unknown>
    : {}

  return {
    version: 1,
    speedDial: readCombinedSpeedDialSetting(source),
    order: normalizeModuleOrder(source.order)
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
  return settings.order.filter((key) => settings[key])
}

export function buildNewTabModuleSettingRows(rawSettings: unknown): NewTabModuleSettingRow[] {
  const settings = normalizeNewTabModuleSettings(rawSettings)
  return settings.order.map((key) => ({
    key,
    ...NEW_TAB_MODULE_SETTING_META[key],
    enabled: settings[key]
  }))
}

export function moveNewTabModuleSetting(
  rawSettings: unknown,
  key: NewTabModuleSettingKey,
  direction: -1 | 1
): NewTabModuleSettings {
  const settings = normalizeNewTabModuleSettings(rawSettings)
  const fromIndex = settings.order.indexOf(key)
  const toIndex = fromIndex + direction
  if (fromIndex < 0 || toIndex < 0 || toIndex >= settings.order.length) {
    return settings
  }

  const order = settings.order.slice()
  const [item] = order.splice(fromIndex, 1)
  order.splice(toIndex, 0, item)
  return {
    ...settings,
    order
  }
}

function readBooleanSetting(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function readCombinedSpeedDialSetting(source: Record<string, unknown>): boolean {
  const speedDial = readBooleanSetting(source.speedDial, DEFAULT_NEW_TAB_MODULE_SETTINGS.speedDial)
  const workspaces = readBooleanSetting(source.workspaces, DEFAULT_NEW_TAB_MODULE_SETTINGS.speedDial)
  return speedDial && workspaces
}

function normalizeModuleOrder(value: unknown): NewTabModuleSettingKey[] {
  const order: NewTabModuleSettingKey[] = []
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isNewTabModuleSettingKey(item) && !order.includes(item)) {
        order.push(item)
      }
    }
  }

  for (const key of MODULE_SETTING_KEYS) {
    if (!order.includes(key)) {
      order.push(key)
    }
  }
  return order
}

function isNewTabModuleSettingKey(value: unknown): value is NewTabModuleSettingKey {
  return typeof value === 'string' && (MODULE_SETTING_KEYS as string[]).includes(value)
}
