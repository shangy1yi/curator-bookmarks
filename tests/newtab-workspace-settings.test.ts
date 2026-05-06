import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  DEFAULT_NEW_TAB_WORKSPACE_ID,
  getActiveNewTabWorkspace,
  normalizeNewTabWorkspaceSettings,
  pruneNewTabWorkspacePinnedIds,
  setActiveNewTabWorkspace,
  toggleNewTabWorkspacePin,
  updateNewTabWorkspace
} from '../src/newtab/workspace-settings.js'
import {
  normalizeNewTabWorkspaceSettings as normalizeSharedNewTabWorkspaceSettings
} from '../src/shared/newtab-workspace-settings.js'

test('normalizes to one Speed Dial workspace and migrates legacy pins', () => {
  const settings = normalizeNewTabWorkspaceSettings(null, {
    validBookmarkIds: ['1', '2', '3'],
    legacyPinnedIds: ['2', 'missing', '2', '1'],
    now: 100
  })

  assert.equal(settings.activeWorkspaceId, DEFAULT_NEW_TAB_WORKSPACE_ID)
  assert.deepEqual(settings.workspaces.map((workspace) => [workspace.id, workspace.name]), [
    ['default', 'Speed Dial']
  ])
  assert.deepEqual(settings.workspaces[0].pinnedIds, ['2', '1'])
})

test('newtab workspace settings are shared by newtab and options surfaces', () => {
  const newtabSettings = normalizeNewTabWorkspaceSettings(null, { now: 100 })
  const sharedSettings = normalizeSharedNewTabWorkspaceSettings(null, { now: 100 })

  assert.deepEqual(sharedSettings, newtabSettings)
})

test('merges legacy workspace pins when toggling Speed Dial bookmarks', () => {
  const settings = normalizeNewTabWorkspaceSettings({
    activeWorkspaceId: 'work',
    workspaces: [
      { id: 'work', name: '工作', pinnedIds: ['1'], createdAt: 1, updatedAt: 1 },
      { id: 'study', name: '学习', pinnedIds: ['2'], createdAt: 1, updatedAt: 1 }
    ]
  }, {
    validBookmarkIds: ['1', '2', '3'],
    now: 10
  })

  const pinned = toggleNewTabWorkspacePin(settings, 'work', '3', {
    validBookmarkIds: ['1', '2', '3'],
    now: 20
  })
  assert.deepEqual(pinned.workspaces, [{
    id: DEFAULT_NEW_TAB_WORKSPACE_ID,
    name: 'Speed Dial',
    pinnedIds: ['3', '1', '2'],
    createdAt: 1,
    updatedAt: 20
  }])

  const unpinned = toggleNewTabWorkspacePin(pinned, 'work', '1', {
    validBookmarkIds: ['1', '2', '3'],
    now: 30
  })
  assert.deepEqual(unpinned.workspaces[0]?.pinnedIds, ['3', '2'])
})

test('always selects the default Speed Dial workspace', () => {
  const settings = normalizeNewTabWorkspaceSettings(null)
  assert.equal(setActiveNewTabWorkspace(settings, 'study').activeWorkspaceId, 'default')
  assert.equal(setActiveNewTabWorkspace(settings, 'missing').activeWorkspaceId, 'default')
  assert.equal(getActiveNewTabWorkspace(setActiveNewTabWorkspace(settings, 'personal')).name, 'Speed Dial')
})

test('keeps the Speed Dial name and prunes invalid pinned ids', () => {
  const settings = normalizeNewTabWorkspaceSettings({
    activeWorkspaceId: 'work',
    workspaces: [
      { id: 'work', name: 'Work', pinnedIds: ['1', 'missing', '2'], createdAt: 1, updatedAt: 1 }
    ]
  }, {
    validBookmarkIds: ['1', '2', '3'],
    now: 10
  })

  const renamed = updateNewTabWorkspace(settings, 'default', {
    name: '  深度工作  ',
    pinnedIds: ['3', '3', 'missing', '1']
  }, {
    validBookmarkIds: ['1', '2', '3'],
    now: 20
  })

  assert.equal(renamed.workspaces[0]?.name, 'Speed Dial')
  assert.deepEqual(renamed.workspaces[0]?.pinnedIds, ['3', '1'])

  const pruned = pruneNewTabWorkspacePinnedIds(renamed, ['1'])
  assert.deepEqual(pruned.workspaces[0]?.pinnedIds, ['1'])
})
