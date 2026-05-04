import { BOOKMARKS_BAR_ID } from '../shared/constants.js'

export const DEFAULT_NEW_TAB_FOLDER_TITLE = '标签页'

export interface NewTabFolderSettings {
  selectedFolderIds: string[]
  hideFolderNames: boolean
}

export interface NewTabFolderBookmarkCounts {
  directBookmarkCount: number
  totalBookmarkCount: number
}

export const DEFAULT_FOLDER_SETTINGS: NewTabFolderSettings = {
  selectedFolderIds: [],
  hideFolderNames: false
}

export function normalizeFolderSettings(rawSettings: unknown): NewTabFolderSettings {
  if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
    return createDefaultFolderSettings()
  }

  const settings = rawSettings as Record<string, unknown>
  return {
    selectedFolderIds: normalizeFolderIds(settings.selectedFolderIds),
    hideFolderNames: settings.hideFolderNames === true
  }
}

export function normalizeFolderSettingsWithDefault(
  rawSettings: unknown,
  rootNode: chrome.bookmarks.BookmarkTreeNode | null
): NewTabFolderSettings {
  const settings = normalizeFolderSettings(rawSettings)
  if (settings.selectedFolderIds.length || hasExplicitFolderSelection(rawSettings)) {
    return settings
  }

  const defaultFolder = findDefaultNewTabSourceFolder(rootNode)
  if (!defaultFolder?.id) {
    return settings
  }

  return {
    ...settings,
    selectedFolderIds: [String(defaultFolder.id)]
  }
}

export function findDefaultNewTabSourceFolder(
  rootNode: chrome.bookmarks.BookmarkTreeNode | null
): chrome.bookmarks.BookmarkTreeNode | null {
  if (!rootNode) {
    return null
  }

  const bookmarksBar = findFolderById(rootNode, BOOKMARKS_BAR_ID)
  if (bookmarksBar && hasDirectBookmarks(bookmarksBar)) {
    return bookmarksBar
  }

  const newTabFolder = findNewTabFolder(rootNode, { requireDisplayableBookmarks: true })
  if (newTabFolder?.id) {
    return newTabFolder
  }

  if (bookmarksBar && hasDescendantBookmarks(bookmarksBar)) {
    return bookmarksBar
  }

  const topLevelFolder = findFirstNonEmptyTopLevelFolder(rootNode, bookmarksBar)
  if (topLevelFolder?.id) {
    return topLevelFolder
  }

  return null
}

export function normalizeFolderIds(value: unknown): string[] {
  const source = Array.isArray(value) ? value : []
  const seen = new Set<string>()
  const ids: string[] = []
  for (const item of source) {
    const id = String(item || '').trim()
    if (!id || seen.has(id)) {
      continue
    }
    seen.add(id)
    ids.push(id)
  }
  return ids.slice(0, 24)
}

export function findNewTabFolder(
  rootNode: chrome.bookmarks.BookmarkTreeNode | null,
  options: { requireDirectBookmarks?: boolean; requireDisplayableBookmarks?: boolean } = {}
): chrome.bookmarks.BookmarkTreeNode | null {
  const candidates: Array<{
    node: chrome.bookmarks.BookmarkTreeNode
    depth: number
    underBookmarksBar: boolean
    directBookmarksBarChild: boolean
  }> = []

  function walk(
    node: chrome.bookmarks.BookmarkTreeNode,
    ancestors: chrome.bookmarks.BookmarkTreeNode[] = []
  ): void {
    if (
      !node.url &&
      node.title === DEFAULT_NEW_TAB_FOLDER_TITLE &&
      (!options.requireDirectBookmarks || hasDirectBookmarks(node)) &&
      (!options.requireDisplayableBookmarks || hasDescendantBookmarks(node))
    ) {
      candidates.push({
        node,
        depth: ancestors.length,
        underBookmarksBar: ancestors.some((ancestor) => ancestor.id === BOOKMARKS_BAR_ID),
        directBookmarksBarChild: node.parentId === BOOKMARKS_BAR_ID
      })
    }

    for (const child of node.children || []) {
      if (!child.url) {
        walk(child, [...ancestors, node])
      }
    }
  }

  if (rootNode) {
    walk(rootNode)
  }

  candidates.sort((left, right) => {
    if (left.directBookmarksBarChild !== right.directBookmarksBarChild) {
      return left.directBookmarksBarChild ? -1 : 1
    }
    if (left.underBookmarksBar !== right.underBookmarksBar) {
      return left.underBookmarksBar ? -1 : 1
    }
    return left.depth - right.depth
  })

  return candidates[0]?.node || null
}

export function getDisplayableNewTabSourceFolders(
  sourceFolder: chrome.bookmarks.BookmarkTreeNode | null
): chrome.bookmarks.BookmarkTreeNode[] {
  if (!sourceFolder || sourceFolder.url) {
    return []
  }

  const displayableFolders: chrome.bookmarks.BookmarkTreeNode[] = []

  function walk(node: chrome.bookmarks.BookmarkTreeNode): void {
    if (hasDirectBookmarks(node)) {
      displayableFolders.push(node)
    }

    for (const child of node.children || []) {
      if (!child.url) {
        walk(child)
      }
    }
  }

  walk(sourceFolder)
  return displayableFolders.length ? displayableFolders : [sourceFolder]
}

export function getFolderBookmarkCounts(
  node: chrome.bookmarks.BookmarkTreeNode | null
): NewTabFolderBookmarkCounts {
  let directBookmarkCount = 0
  let totalBookmarkCount = 0

  function walk(currentNode: chrome.bookmarks.BookmarkTreeNode, depth: number): void {
    for (const child of currentNode.children || []) {
      if (child.url) {
        totalBookmarkCount += 1
        if (depth === 0) {
          directBookmarkCount += 1
        }
        continue
      }

      walk(child, depth + 1)
    }
  }

  if (node && !node.url) {
    walk(node, 0)
  }

  return { directBookmarkCount, totalBookmarkCount }
}

function findFolderById(
  node: chrome.bookmarks.BookmarkTreeNode | null,
  targetId: string
): chrome.bookmarks.BookmarkTreeNode | null {
  if (!node) {
    return null
  }

  if (!node.url && String(node.id) === targetId) {
    return node
  }

  for (const child of node.children || []) {
    const match = findFolderById(child, targetId)
    if (match) {
      return match
    }
  }

  return null
}

function findFirstNonEmptyTopLevelFolder(
  rootNode: chrome.bookmarks.BookmarkTreeNode,
  bookmarksBar: chrome.bookmarks.BookmarkTreeNode | null
): chrome.bookmarks.BookmarkTreeNode | null {
  const bookmarksBarChild = (bookmarksBar?.children || [])
    .find((child) => !child.url && hasDescendantBookmarks(child))
  if (bookmarksBarChild) {
    return bookmarksBarChild
  }

  return (rootNode.children || [])
    .find((child) => !child.url && hasDescendantBookmarks(child)) || null
}

function hasDirectBookmarks(node: chrome.bookmarks.BookmarkTreeNode): boolean {
  return getFolderBookmarkCounts(node).directBookmarkCount > 0
}

function hasDescendantBookmarks(node: chrome.bookmarks.BookmarkTreeNode): boolean {
  return getFolderBookmarkCounts(node).totalBookmarkCount > 0
}

function hasExplicitFolderSelection(rawSettings: unknown): boolean {
  return Boolean(
    rawSettings &&
    typeof rawSettings === 'object' &&
    !Array.isArray(rawSettings) &&
    Array.isArray((rawSettings as Record<string, unknown>).selectedFolderIds)
  )
}

function createDefaultFolderSettings(): NewTabFolderSettings {
  return {
    selectedFolderIds: [],
    hideFolderNames: DEFAULT_FOLDER_SETTINGS.hideFolderNames
  }
}
