import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  analyzeFolderCleanup,
  createFolderCleanupSplitUndo
} from '../src/shared/folder-cleanup.js'
import {
  getFolderCleanupSplitUndoActionLabel,
  getFolderCleanupSuggestionActionLabel
} from '../src/options/sections/folder-cleanup.js'

function readProjectFile(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function folder(id, title, children = []) {
  return {
    id,
    title,
    children
  }
}

function bookmark(id, title, url, parentId = '', index = 0) {
  return {
    id,
    title,
    url,
    parentId,
    index
  }
}

test('detects empty folders and deep single-bookmark folders', () => {
  const tree = folder('0', '', [
    folder('1', '书签栏', [
      folder('10', '空文件夹'),
      folder('20', '工具', [
        folder('21', '开发', [
          folder('22', '前端', [
            folder('23', 'React', [
              bookmark('100', 'React 教程', 'https://react.dev/learn')
            ])
          ])
        ])
      ])
    ])
  ])

  const suggestions = analyzeFolderCleanup(tree)

  assert.ok(suggestions.some((item) => item.kind === 'empty-folder' && item.primaryFolderId === '10'))
  assert.ok(suggestions.some((item) => item.kind === 'deep-single-bookmark' && item.primaryFolderId === '23'))
})

test('detects same-name folders and large folder split groups', () => {
  const largeBookmarks = Array.from({ length: 42 }, (_, index) => {
    const host = index < 21 ? 'docs.example.com' : 'blog.example.org'
    return bookmark(`large-${index}`, `页面 ${index}`, `https://${host}/page-${index}`, '40', index)
  })
  const tree = folder('0', '', [
    folder('1', '书签栏', [
      folder('30', '教程', [
        bookmark('101', 'A', 'https://a.example.com')
      ]),
      folder('31', '教程', [
        bookmark('102', 'B', 'https://b.example.com')
      ]),
      folder('40', '资料库', largeBookmarks)
    ])
  ])

  const suggestions = analyzeFolderCleanup(tree)
  const sameName = suggestions.find((item) => item.kind === 'same-name-folders')
  const large = suggestions.find((item) => item.kind === 'large-folder-split')

  assert.equal(sameName?.operation, 'merge')
  assert.equal(large?.operation, 'split')
  assert.ok((large?.splitGroups || []).length >= 2)
})

test('records enough split undo data to move bookmarks back to original positions', () => {
  const largeBookmarks = Array.from({ length: 42 }, (_, index) => {
    const host = index < 21 ? 'docs.example.com' : 'blog.example.org'
    return bookmark(`large-${index}`, `页面 ${index}`, `https://${host}/page-${index}`, '40', index)
  })
  const tree = folder('0', '', [
    folder('1', '书签栏', [
      folder('40', '资料库', largeBookmarks)
    ])
  ])

  const large = analyzeFolderCleanup(tree).find((item) => item.kind === 'large-folder-split')
  assert.equal(large?.operation, 'split')

  const undo = createFolderCleanupSplitUndo(large, ['split-docs', 'split-blog'], 123456)
  const largeZeroGroupIndex = large?.splitGroups?.findIndex((group) => group.bookmarkIds.includes('large-0')) ?? -1

  assert.equal(undo?.suggestionId, large?.id)
  assert.deepEqual(undo?.createdFolderIds, ['split-docs', 'split-blog'])
  assert.equal(undo?.moves.length, large?.bookmarkIds.length)
  assert.deepEqual(
    undo?.moves.find((move) => move.bookmarkId === 'large-0'),
    {
      bookmarkId: 'large-0',
      fromParentId: '40',
      fromIndex: 0,
      toFolderId: undo?.createdFolderIds[largeZeroGroupIndex]
    }
  )
})

test('excludes chrome default roots and plugin inbox from cleanup suggestions', () => {
  const bookmarksBarBookmarks = Array.from({ length: 45 }, (_, index) => (
    bookmark(`bar-${index}`, `书签栏页面 ${index}`, `https://bar-${index}.example.com`)
  ))
  const tree = folder('0', '', [
    folder('1', '书签栏', [
      ...bookmarksBarBookmarks,
      folder('90', 'Inbox / 待整理', [
        folder('91', '临时空文件夹')
      ]),
      folder('92', '普通空文件夹')
    ]),
    folder('2', '其他书签')
  ])

  const suggestions = analyzeFolderCleanup(tree)

  assert.equal(suggestions.some((item) => item.primaryFolderId === '1'), false)
  assert.equal(suggestions.some((item) => item.primaryFolderId === '2'), false)
  assert.equal(suggestions.some((item) => item.folderIds.includes('90') || item.folderIds.includes('91')), false)
  assert.ok(suggestions.some((item) => item.kind === 'empty-folder' && item.primaryFolderId === '92'))
})

test('folder cleanup rescan refreshes the bookmark tree before analyzing', async () => {
  const storageWrites = []
  globalThis.chrome = {
    runtime: { lastError: null },
    storage: {
      local: {
        set(payload, callback) {
          storageWrites.push(payload)
          globalThis.chrome.runtime.lastError = null
          callback()
        }
      }
    }
  }

  const { rescanFolderCleanupSuggestions } = await import('../src/options/sections/folder-cleanup.js')
  const { folderCleanupState } = await import('../src/options/shared-options/state.js')
  const oldTree = folder('0', '', [
    folder('1', '书签栏', [
      folder('old-empty', '旧空文件夹')
    ])
  ])
  const freshTree = folder('0', '', [
    folder('1', '书签栏', [
      folder('fresh-empty', '新空文件夹')
    ])
  ])
  const hydrateOptions = []

  folderCleanupState.rootNode = oldTree
  folderCleanupState.suggestions = analyzeFolderCleanup(oldTree)

  await rescanFolderCleanupSuggestions({
    confirm: async () => true,
    hydrateAvailabilityCatalog: async (options) => {
      hydrateOptions.push(options)
      folderCleanupState.rootNode = freshTree
    },
    renderAvailabilitySection() {}
  })

  assert.equal(hydrateOptions.length, 1)
  assert.deepEqual(hydrateOptions[0], {
    preserveResults: true,
    analyzeFolderCleanup: false
  })
  assert.equal(folderCleanupState.suggestions.some((item) => item.primaryFolderId === 'old-empty'), false)
  assert.equal(folderCleanupState.suggestions.some((item) => item.primaryFolderId === 'fresh-empty'), true)
  assert.equal(storageWrites.length > 0, true)
})

test('folder cleanup action labels include suggestion context', () => {
  const previewLabel = getFolderCleanupSuggestionActionLabel('查看文件夹清理预览', {
    title: '删除空文件夹：旧资料',
    summary: '该文件夹没有书签和子文件夹。'
  })
  const executeLabel = getFolderCleanupSuggestionActionLabel('确认拆分', {
    title: '拆分超大文件夹：资料库',
    summary: '共有 42 个书签。'
  })
  const longLabel = getFolderCleanupSuggestionActionLabel('确认合并', {
    title: '合并同名文件夹：'.repeat(12),
    summary: ''
  })

  assert.equal(previewLabel, '查看文件夹清理预览：删除空文件夹：旧资料')
  assert.equal(executeLabel, '确认拆分：拆分超大文件夹：资料库')
  assert.match(longLabel, /…$/)
})

test('folder cleanup split undo labels include title and move count', () => {
  const label = getFolderCleanupSplitUndoActionLabel('撤销本次拆分', {
    title: '拆分超大文件夹：资料库',
    moves: [
      { bookmarkId: 'one', fromParentId: '40', toFolderId: 'new-1' },
      { bookmarkId: 'two', fromParentId: '40', toFolderId: 'new-2' }
    ]
  })

  assert.equal(label, '撤销本次拆分：拆分超大文件夹：资料库，2 个书签')
})

test('folder cleanup controls render context-specific action labels', () => {
  const source = readProjectFile('src/options/sections/folder-cleanup.ts')

  assert.match(source, /const undoLabel = getFolderCleanupSplitUndoActionLabel\('撤销本次拆分', splitUndo\)/)
  assert.match(source, /data-folder-cleanup-undo-split="\$\{escapeAttr\(splitUndo\.id\)\}"[\s\S]*?aria-label="\$\{escapeAttr\(undoLabel\)\}"/)
  assert.match(source, /const previewLabel = getFolderCleanupSuggestionActionLabel\([\s\S]*?查看文件夹清理预览/)
  assert.match(source, /const operationLabel = getFolderCleanupSuggestionActionLabel\(operationCopy, suggestion\)/)
  assert.match(source, /data-folder-cleanup-preview="\$\{escapeAttr\(suggestion\.id\)\}"[\s\S]*?aria-label="\$\{escapeAttr\(previewLabel\)\}"/)
  assert.match(source, /data-folder-cleanup-action="\$\{escapeAttr\(suggestion\.id\)\}"[\s\S]*?aria-label="\$\{escapeAttr\(operationLabel\)\}"/)
})
