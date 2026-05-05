import { normalizeNewTabSearchText, type NewTabSearchIndexEntry } from './content-state.js'

export type CommandPaletteItemType =
  | 'bookmark'
  | 'pin'
  | 'unpin'
  | 'workspace'
  | 'settings'
  | 'dashboard'
  | 'options'

export interface CommandPaletteWorkspace {
  id: string
  name: string
}

export interface CommandPaletteItem {
  id: string
  type: CommandPaletteItemType
  title: string
  detail: string
  keywords: string
  bookmarkId?: string
  url?: string
  workspaceId?: string
  actionHash?: string
  score: number
}

export interface BuildCommandPaletteInput {
  query: string
  searchIndex: NewTabSearchIndexEntry[]
  pinnedIds: string[]
  workspaces: CommandPaletteWorkspace[]
  activeWorkspaceId: string
  limit?: number
}

export interface KeyboardEventLike {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  defaultPrevented?: boolean
  target?: unknown
}

const DEFAULT_COMMAND_PALETTE_LIMIT = 12

export function buildCommandPaletteItems({
  query,
  searchIndex,
  pinnedIds,
  workspaces,
  activeWorkspaceId,
  limit = DEFAULT_COMMAND_PALETTE_LIMIT
}: BuildCommandPaletteInput): CommandPaletteItem[] {
  const normalizedQuery = normalizeNewTabSearchText(query)
  const pinnedSet = new Set(pinnedIds.map((id) => String(id)))
  const items: CommandPaletteItem[] = []

  for (const entry of searchIndex) {
    const bookmarkItem = createBookmarkCommand(entry)
    pushIfMatching(items, bookmarkItem, normalizedQuery)
    const pinned = pinnedSet.has(entry.id)
    pushIfMatching(items, {
      id: `${pinned ? 'unpin' : 'pin'}:${entry.id}`,
      type: pinned ? 'unpin' : 'pin',
      title: pinned ? `取消固定 ${entry.title}` : `固定 ${entry.title}`,
      detail: pinned ? '从当前场景移除 Speed Dial' : '加入当前场景 Speed Dial',
      keywords: `${entry.title} ${entry.url} ${entry.folderPath} ${pinned ? 'unpin 取消固定 移除' : 'pin 固定 speed dial 常用'}`,
      bookmarkId: entry.id,
      url: entry.url,
      score: 0
    }, normalizedQuery)
  }

  for (const workspace of workspaces) {
    const active = workspace.id === activeWorkspaceId
    pushIfMatching(items, {
      id: `workspace:${workspace.id}`,
      type: 'workspace',
      title: active ? `${workspace.name}（当前场景）` : `切换到 ${workspace.name}`,
      detail: active ? '当前 workspace' : '切换 Speed Dial 场景',
      keywords: `${workspace.id} ${workspace.name} workspace 场景 工作区 切换`,
      workspaceId: workspace.id,
      score: active ? 6 : 0
    }, normalizedQuery)
  }

  for (const command of createStaticCommands()) {
    pushIfMatching(items, command, normalizedQuery)
  }

  return items
    .sort((left, right) => left.score - right.score || getTypeRank(left.type) - getTypeRank(right.type) || left.title.localeCompare(right.title))
    .slice(0, Math.max(1, Math.min(Math.floor(limit) || DEFAULT_COMMAND_PALETTE_LIMIT, 24)))
}

export function shouldOpenCommandPaletteFromKeydown(event: KeyboardEventLike): boolean {
  if (event.defaultPrevented || event.altKey || event.shiftKey || isEditableEventTarget(event.target)) {
    return false
  }

  const key = String(event.key || '')
  return Boolean(event.metaKey || event.ctrlKey) && key.toLowerCase() === 'k'
}

export function shouldOpenDashboardFromKeydown(event: KeyboardEventLike): boolean {
  void event
  return false
}

function createBookmarkCommand(entry: NewTabSearchIndexEntry): CommandPaletteItem {
  return {
    id: `bookmark:${entry.id}`,
    type: 'bookmark',
    title: entry.title,
    detail: entry.folderPath || entry.url,
    keywords: `${entry.title} ${entry.url} ${entry.folderTitle} ${entry.folderPath}`,
    bookmarkId: entry.id,
    url: entry.url,
    score: 0
  }
}

function createStaticCommands(): CommandPaletteItem[] {
  return [
    {
      id: 'settings:newtab',
      type: 'settings',
      title: '打开新标签页设置',
      detail: '管理场景、固定入口、背景和搜索栏',
      keywords: 'settings 设置 newtab 新标签页 场景 固定入口',
      score: 0
    },
    {
      id: 'dashboard:open',
      type: 'dashboard',
      title: '打开书签仪表盘',
      detail: '进入 Curator Dashboard',
      keywords: 'dashboard 仪表盘 书签 管理',
      actionHash: '#dashboard',
      score: 0
    },
    {
      id: 'options:duplicates',
      type: 'options',
      title: '检查重复书签',
      detail: '打开重复书签检测',
      keywords: 'duplicates 重复 书签 整理 清理',
      actionHash: '#duplicates',
      score: 0
    },
    {
      id: 'options:folder-cleanup',
      type: 'options',
      title: '打开清理中心',
      detail: '整理文件夹结构、空文件夹和待归档书签',
      keywords: 'folder cleanup 文件夹 清理 空文件夹 整理 清理中心',
      actionHash: '#folder-cleanup',
      score: 0
    },
    {
      id: 'options:recycle',
      type: 'options',
      title: '打开回收站',
      detail: '查看和恢复最近删除的书签',
      keywords: 'recycle trash 回收站 删除 恢复 清理',
      actionHash: '#recycle',
      score: 0
    }
  ]
}

function pushIfMatching(items: CommandPaletteItem[], item: CommandPaletteItem, normalizedQuery: string): void {
  const score = scoreCommandPaletteItem(item, normalizedQuery)
  if (score < Number.POSITIVE_INFINITY) {
    items.push({ ...item, score })
  }
}

function scoreCommandPaletteItem(item: CommandPaletteItem, normalizedQuery: string): number {
  if (!normalizedQuery) {
    return getTypeRank(item.type) + Math.min(item.score, 10)
  }

  const title = normalizeNewTabSearchText(item.title)
  const keywords = normalizeNewTabSearchText(item.keywords)
  const terms = normalizedQuery.split(/\s+/).filter(Boolean)
  if (!terms.every((term) => title.includes(term) || keywords.includes(term))) {
    return Number.POSITIVE_INFINITY
  }

  if (title === normalizedQuery) {
    return 0
  }
  if (title.startsWith(normalizedQuery)) {
    return 1
  }
  if (title.includes(normalizedQuery)) {
    return 2
  }
  return 4 + getTypeRank(item.type)
}

function getTypeRank(type: CommandPaletteItemType): number {
  const ranks: Record<CommandPaletteItemType, number> = {
    bookmark: 0,
    pin: 1,
    unpin: 1,
    workspace: 2,
    settings: 3,
    dashboard: 4,
    options: 5
  }
  return ranks[type]
}

function isEditableEventTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') {
    return false
  }

  const candidate = target as {
    tagName?: unknown
    isContentEditable?: unknown
    getAttribute?: (name: string) => string | null
  }
  const tagName = String(candidate.tagName || '').toUpperCase()
  return tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    candidate.isContentEditable === true ||
    candidate.getAttribute?.('contenteditable') === 'true'
}
