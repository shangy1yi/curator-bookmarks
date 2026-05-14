export type SettingsDrawerSection = 'source' | 'appearance' | 'search' | 'modules' | 'advanced'

export type SettingsGroupControlSyncAction =
  | 'folder'
  | 'background'
  | 'featuredBackgroundDisplay'
  | 'search'
  | 'modules'
  | 'general'
  | 'icon'
  | 'time'

export function normalizeSettingsDrawerSection(value: unknown): SettingsDrawerSection {
  const section = String(value || '')
  return section === 'appearance' ||
    section === 'search' ||
    section === 'modules' ||
    section === 'advanced'
    ? section
    : 'source'
}

export function getSettingsGroupControlSyncActions(
  group: unknown
): SettingsGroupControlSyncAction[] {
  switch (normalizeSettingsDrawerSection(group)) {
    case 'appearance':
      return ['background', 'featuredBackgroundDisplay', 'icon', 'time']
    case 'search':
      return ['search']
    case 'modules':
      return ['modules']
    case 'advanced':
      return ['general']
    case 'source':
    default:
      return ['folder']
  }
}
