import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { NewTabSearchIndexEntry } from '../src/newtab/content-state.js'
import {
  buildCommandPaletteItems,
  shouldOpenDashboardFromKeydown,
  shouldOpenCommandPaletteFromKeydown
} from '../src/newtab/command-palette.js'

function entry(overrides: Partial<NewTabSearchIndexEntry>): NewTabSearchIndexEntry {
  const title = overrides.title || 'React Docs'
  const url = overrides.url || 'https://react.dev/'
  return {
    id: overrides.id || title,
    title,
    url,
    folderTitle: overrides.folderTitle || 'Work',
    folderPath: overrides.folderPath || 'Bookmarks / Work',
    normalizedTitle: title.toLowerCase(),
    normalizedUrl: url,
    normalizedFolderTitle: 'work',
    normalizedSearchText: `${title} ${url}`.toLowerCase(),
    order: overrides.order || 0
  }
}

test('builds command palette bookmark, pin and workspace actions', () => {
  const items = buildCommandPaletteItems({
    query: 'react',
    searchIndex: [
      entry({ id: 'react', title: 'React Docs' }),
      entry({ id: 'vue', title: 'Vue Guide', url: 'https://vuejs.org/' })
    ],
    pinnedIds: ['react'],
    workspaces: [
      { id: 'work', name: '工作' },
      { id: 'study', name: '学习' }
    ],
    activeWorkspaceId: 'work',
    limit: 10
  })

  assert.deepEqual(items.map((item) => [item.type, item.id]), [
    ['bookmark', 'bookmark:react'],
    ['unpin', 'unpin:react']
  ])
})

test('finds workspace and cleanup commands with Chinese keywords', () => {
  const workspace = buildCommandPaletteItems({
    query: '学习',
    searchIndex: [],
    pinnedIds: [],
    workspaces: [{ id: 'study', name: '学习' }],
    activeWorkspaceId: 'work'
  })
  assert.equal(workspace[0]?.id, 'workspace:study')

  const cleanup = buildCommandPaletteItems({
    query: '重复',
    searchIndex: [],
    pinnedIds: [],
    workspaces: [],
    activeWorkspaceId: ''
  })
  assert.equal(cleanup[0]?.id, 'options:duplicates')
})

test('dashboard shortcut is no longer bound to Cmd or Ctrl K', () => {
  assert.equal(shouldOpenDashboardFromKeydown({ key: 'k', metaKey: true }), false)
  assert.equal(shouldOpenDashboardFromKeydown({ key: 'k', ctrlKey: true }), false)
  assert.equal(shouldOpenDashboardFromKeydown({ key: 'k', metaKey: true, target: { isContentEditable: true } }), false)
  assert.equal(shouldOpenDashboardFromKeydown({ key: 'k', ctrlKey: true, altKey: true }), false)
})

test('command palette shortcut uses Cmd or Ctrl K and avoids editable targets', () => {
  assert.equal(shouldOpenCommandPaletteFromKeydown({ key: 'k', metaKey: true }), true)
  assert.equal(shouldOpenCommandPaletteFromKeydown({ key: 'k', ctrlKey: true }), true)
  assert.equal(shouldOpenCommandPaletteFromKeydown({ key: '/' }), false)
  assert.equal(shouldOpenCommandPaletteFromKeydown({ key: '/', target: { tagName: 'INPUT' } }), false)
  assert.equal(shouldOpenCommandPaletteFromKeydown({ key: 'k', metaKey: true, target: { isContentEditable: true } }), false)
  assert.equal(shouldOpenCommandPaletteFromKeydown({ key: '/', altKey: true }), false)
})
