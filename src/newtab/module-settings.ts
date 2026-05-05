import { STORAGE_KEYS } from '../shared/constants.js'

export type NewTabModuleSettingKey =
  | 'speedDial'
  | 'workspaces'
  | 'health'
  | 'commandHints'
  | 'privacyNotice'

export interface NewTabModuleSettings {
  version: 1
  speedDial: boolean
  workspaces: boolean
  health: boolean
  commandHints: boolean
  privacyNotice: boolean
}

export interface NewTabModuleSettingRow {
  key: NewTabModuleSettingKey
  label: string
  description: string
  enabled: boolean
}

export interface NewTabPrivacyNotice {
  title: string
  summary: string
  bullets: string[]
  guarantees: {
    localFirst: true
    tracksBrowsing: false
    sellsData: false
    modifiesDefaultSearchEngine: false
    requiresHistoryPermission: false
  }
}

export const NEW_TAB_MODULE_SETTINGS_STORAGE_KEY = STORAGE_KEYS.newTabModuleSettings

export const DEFAULT_NEW_TAB_MODULE_SETTINGS: NewTabModuleSettings = {
  version: 1,
  speedDial: true,
  workspaces: true,
  health: true,
  commandHints: true,
  privacyNotice: true
}

export const NEW_TAB_MODULE_SETTING_META: Record<
  NewTabModuleSettingKey,
  Omit<NewTabModuleSettingRow, 'key' | 'enabled'>
> = {
  speedDial: {
    label: 'Speed Dial',
    description: '显示当前场景下固定的高频书签入口。'
  },
  workspaces: {
    label: 'Workspace',
    description: '显示工作、学习、个人等场景切换入口。'
  },
  health: {
    label: '书签健康',
    description: '显示待整理、重复、缺少标签或摘要等轻量提醒。'
  },
  commandHints: {
    label: '快捷提示',
    description: '显示命令面板、搜索和整理入口的轻量提示。'
  },
  privacyNotice: {
    label: '隐私说明',
    description: '显示本地优先和权限边界说明。'
  }
}

const MODULE_SETTING_KEYS: NewTabModuleSettingKey[] = [
  'speedDial',
  'workspaces',
  'health',
  'commandHints',
  'privacyNotice'
]

export function normalizeNewTabModuleSettings(rawSettings: unknown): NewTabModuleSettings {
  const source = rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings)
    ? rawSettings as Record<string, unknown>
    : {}

  return {
    version: 1,
    speedDial: readBooleanSetting(source.speedDial, DEFAULT_NEW_TAB_MODULE_SETTINGS.speedDial),
    workspaces: readBooleanSetting(source.workspaces, DEFAULT_NEW_TAB_MODULE_SETTINGS.workspaces),
    health: readBooleanSetting(source.health, DEFAULT_NEW_TAB_MODULE_SETTINGS.health),
    commandHints: readBooleanSetting(source.commandHints, DEFAULT_NEW_TAB_MODULE_SETTINGS.commandHints),
    privacyNotice: readBooleanSetting(source.privacyNotice, DEFAULT_NEW_TAB_MODULE_SETTINGS.privacyNotice)
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

export function buildNewTabPrivacyNotice(): NewTabPrivacyNotice {
  return {
    title: '隐私与权限',
    summary: 'Curator 新标签页模块只使用本地书签数据和扩展自己的本地状态，不把健康提醒建立在浏览历史或远程扫描上。',
    bullets: [
      '本地优先：模块设置、固定入口、健康提醒和活动记录保存在浏览器本地扩展存储中。',
      '不追踪：不读取浏览历史，也不会跨网站跟踪你的访问行为。',
      '不出售数据：不出售、出租或共享你的书签数据用于广告或画像。',
      '不修改默认搜索引擎：新标签页搜索只在 Curator 页面内生效，不改 Chrome 默认搜索引擎或启动页。',
      '不新增 history 权限：书签健康提醒只使用书签、标签索引、摘要索引和 Curator 自己的新标签页活动记录。'
    ],
    guarantees: {
      localFirst: true,
      tracksBrowsing: false,
      sellsData: false,
      modifiesDefaultSearchEngine: false,
      requiresHistoryPermission: false
    }
  }
}

export function buildNewTabPrivacyNoticeText(): string {
  const notice = buildNewTabPrivacyNotice()
  return [
    notice.title,
    notice.summary,
    ...notice.bullets
  ].join('\n')
}

function readBooleanSetting(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}
