export const DEFAULT_NEW_TAB_WORKSPACE_ID = 'default'
export const MAX_NEW_TAB_WORKSPACES = 8
export const MAX_WORKSPACE_PINNED_BOOKMARKS = 16

export interface NewTabWorkspace {
  id: string
  name: string
  pinnedIds: string[]
  createdAt: number
  updatedAt: number
}

export interface NewTabWorkspaceSettings {
  activeWorkspaceId: string
  workspaces: NewTabWorkspace[]
}

export interface NormalizeWorkspaceSettingsOptions {
  validBookmarkIds?: Iterable<string>
  legacyPinnedIds?: unknown
  now?: number
}

export interface WorkspaceMutationOptions {
  validBookmarkIds?: Iterable<string>
  now?: number
}

export const DEFAULT_NEW_TAB_WORKSPACES: NewTabWorkspace[] = [
  {
    id: DEFAULT_NEW_TAB_WORKSPACE_ID,
    name: '默认',
    pinnedIds: [],
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'work',
    name: '工作',
    pinnedIds: [],
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'study',
    name: '学习',
    pinnedIds: [],
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'personal',
    name: '个人',
    pinnedIds: [],
    createdAt: 0,
    updatedAt: 0
  }
]

export function normalizeNewTabWorkspaceSettings(
  rawSettings: unknown,
  {
    validBookmarkIds,
    legacyPinnedIds,
    now = Date.now()
  }: NormalizeWorkspaceSettingsOptions = {}
): NewTabWorkspaceSettings {
  const validIds = createValidIdSet(validBookmarkIds)
  const source = rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings)
    ? rawSettings as Record<string, unknown>
    : {}
  const rawWorkspaces = Array.isArray(source.workspaces)
    ? source.workspaces
    : []
  const fallbackLegacyPins = normalizeWorkspacePinnedIds(legacyPinnedIds, validIds)
  const normalizedWorkspaces: NewTabWorkspace[] = []
  const seenIds = new Set<string>()

  for (const workspace of rawWorkspaces) {
    const normalized = normalizeWorkspace(workspace, validIds, now)
    if (!normalized || seenIds.has(normalized.id)) {
      continue
    }
    seenIds.add(normalized.id)
    normalizedWorkspaces.push(normalized)
    if (normalizedWorkspaces.length >= MAX_NEW_TAB_WORKSPACES) {
      break
    }
  }

  for (const workspace of DEFAULT_NEW_TAB_WORKSPACES) {
    if (seenIds.has(workspace.id)) {
      continue
    }
    seenIds.add(workspace.id)
    normalizedWorkspaces.push({
      ...workspace,
      pinnedIds: workspace.id === DEFAULT_NEW_TAB_WORKSPACE_ID ? fallbackLegacyPins : [],
      createdAt: now,
      updatedAt: now
    })
  }

  const activeWorkspaceId = normalizeWorkspaceId(source.activeWorkspaceId)
  const resolvedActiveId = normalizedWorkspaces.some((workspace) => workspace.id === activeWorkspaceId)
    ? activeWorkspaceId
    : DEFAULT_NEW_TAB_WORKSPACE_ID

  return {
    activeWorkspaceId: resolvedActiveId,
    workspaces: normalizedWorkspaces.slice(0, MAX_NEW_TAB_WORKSPACES)
  }
}

export function getActiveNewTabWorkspace(settings: NewTabWorkspaceSettings): NewTabWorkspace {
  return settings.workspaces.find((workspace) => workspace.id === settings.activeWorkspaceId) ||
    settings.workspaces[0] ||
    normalizeNewTabWorkspaceSettings(null).workspaces[0]
}

export function setActiveNewTabWorkspace(
  settings: NewTabWorkspaceSettings,
  workspaceId: string
): NewTabWorkspaceSettings {
  const id = normalizeWorkspaceId(workspaceId)
  if (!settings.workspaces.some((workspace) => workspace.id === id)) {
    return settings
  }

  return {
    ...settings,
    activeWorkspaceId: id
  }
}

export function toggleNewTabWorkspacePin(
  settings: NewTabWorkspaceSettings,
  workspaceId: string,
  bookmarkId: string,
  {
    validBookmarkIds,
    now = Date.now()
  }: WorkspaceMutationOptions = {}
): NewTabWorkspaceSettings {
  const validIds = createValidIdSet(validBookmarkIds)
  const targetWorkspaceId = normalizeWorkspaceId(workspaceId) || settings.activeWorkspaceId
  const targetBookmarkId = normalizeBookmarkId(bookmarkId)
  if (!targetBookmarkId || (validIds && !validIds.has(targetBookmarkId))) {
    return settings
  }

  let changed = false
  const workspaces = settings.workspaces.map((workspace) => {
    if (workspace.id !== targetWorkspaceId) {
      return workspace
    }

    const pinned = workspace.pinnedIds.includes(targetBookmarkId)
    changed = true
    return {
      ...workspace,
      pinnedIds: pinned
        ? workspace.pinnedIds.filter((id) => id !== targetBookmarkId)
        : [targetBookmarkId, ...workspace.pinnedIds.filter((id) => id !== targetBookmarkId)]
          .slice(0, MAX_WORKSPACE_PINNED_BOOKMARKS),
      updatedAt: now
    }
  })

  return changed
    ? { ...settings, workspaces }
    : settings
}

export function updateNewTabWorkspace(
  settings: NewTabWorkspaceSettings,
  workspaceId: string,
  updates: Partial<Pick<NewTabWorkspace, 'name' | 'pinnedIds'>>,
  {
    validBookmarkIds,
    now = Date.now()
  }: WorkspaceMutationOptions = {}
): NewTabWorkspaceSettings {
  const id = normalizeWorkspaceId(workspaceId)
  if (!id) {
    return settings
  }

  const validIds = createValidIdSet(validBookmarkIds)
  let changed = false
  const workspaces = settings.workspaces.map((workspace) => {
    if (workspace.id !== id) {
      return workspace
    }

    changed = true
    return {
      ...workspace,
      name: normalizeWorkspaceName(updates.name ?? workspace.name, workspace.name),
      pinnedIds: Array.isArray(updates.pinnedIds)
        ? normalizeWorkspacePinnedIds(updates.pinnedIds, validIds)
        : workspace.pinnedIds,
      updatedAt: now
    }
  })

  return changed
    ? { ...settings, workspaces }
    : settings
}

export function pruneNewTabWorkspacePinnedIds(
  settings: NewTabWorkspaceSettings,
  validBookmarkIds: Iterable<string>
): NewTabWorkspaceSettings {
  const validIds = createValidIdSet(validBookmarkIds)
  if (!validIds) {
    return settings
  }

  let changed = false
  const workspaces = settings.workspaces.map((workspace) => {
    const pinnedIds = normalizeWorkspacePinnedIds(workspace.pinnedIds, validIds)
    if (pinnedIds.length === workspace.pinnedIds.length) {
      return workspace
    }
    changed = true
    return { ...workspace, pinnedIds }
  })

  return changed
    ? { ...settings, workspaces }
    : settings
}

function normalizeWorkspace(rawWorkspace: unknown, validIds: Set<string> | null, now: number): NewTabWorkspace | null {
  const source = rawWorkspace && typeof rawWorkspace === 'object' && !Array.isArray(rawWorkspace)
    ? rawWorkspace as Record<string, unknown>
    : {}
  const id = normalizeWorkspaceId(source.id)
  if (!id) {
    return null
  }

  const fallback = DEFAULT_NEW_TAB_WORKSPACES.find((workspace) => workspace.id === id)
  const createdAt = normalizeTimestamp(source.createdAt) || now
  return {
    id,
    name: normalizeWorkspaceName(source.name, fallback?.name || '场景'),
    pinnedIds: normalizeWorkspacePinnedIds(source.pinnedIds, validIds),
    createdAt,
    updatedAt: normalizeTimestamp(source.updatedAt) || createdAt
  }
}

function normalizeWorkspacePinnedIds(value: unknown, validIds: Set<string> | null): string[] {
  const values = Array.isArray(value) ? value : []
  const output: string[] = []
  const seen = new Set<string>()

  for (const item of values) {
    const id = normalizeBookmarkId(item)
    if (!id || seen.has(id) || (validIds && !validIds.has(id))) {
      continue
    }
    seen.add(id)
    output.push(id)
    if (output.length >= MAX_WORKSPACE_PINNED_BOOKMARKS) {
      break
    }
  }

  return output
}

function normalizeWorkspaceId(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

function normalizeBookmarkId(value: unknown): string {
  return String(value || '').trim()
}

function normalizeWorkspaceName(value: unknown, fallback: string): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 18) || fallback
}

function normalizeTimestamp(value: unknown): number {
  const timestamp = Number(value)
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0
}

function createValidIdSet(ids: Iterable<string> | undefined): Set<string> | null {
  if (!ids) {
    return null
  }

  const validIds = new Set<string>()
  for (const id of ids) {
    const normalizedId = normalizeBookmarkId(id)
    if (normalizedId) {
      validIds.add(normalizedId)
    }
  }
  return validIds
}
