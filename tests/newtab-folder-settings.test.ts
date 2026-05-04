import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  findDefaultNewTabSourceFolder,
  findNewTabFolder,
  getDisplayableNewTabSourceFolders,
  getFolderBookmarkCounts,
  normalizeFolderIds,
  normalizeFolderSettingsWithDefault
} from '../src/newtab/folder-settings.js'

const rootNode: chrome.bookmarks.BookmarkTreeNode = {
  id: '0',
  title: '',
  children: [
    {
      id: '1',
      parentId: '0',
      title: '书签栏',
      children: [
        {
          id: '10',
          parentId: '1',
          title: '标签页',
          children: [
            {
              id: '11',
              parentId: '10',
              title: 'React',
              url: 'https://react.dev/'
            }
          ]
        },
        {
          id: '20',
          parentId: '1',
          title: '资料',
          children: [
            {
              id: '21',
              parentId: '20',
              title: '标签页',
              children: []
            }
          ]
        }
      ]
    }
  ]
}

test('new tab folder settings choose the bookmarks bar when it already has direct bookmarks', () => {
  const rootWithBookmarksBarItems: chrome.bookmarks.BookmarkTreeNode = {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        parentId: '0',
        title: '书签栏',
        children: [
          {
            id: '100',
            parentId: '1',
            title: 'MDN',
            url: 'https://developer.mozilla.org/'
          },
          {
            id: '10',
            parentId: '1',
            title: '标签页',
            children: [
              {
                id: '11',
                parentId: '10',
                title: 'React',
                url: 'https://react.dev/'
              }
            ]
          }
        ]
      }
    ]
  }

  assert.equal(findDefaultNewTabSourceFolder(rootWithBookmarksBarItems)?.id, '1')
  assert.deepEqual(
    normalizeFolderSettingsWithDefault(undefined, rootWithBookmarksBarItems),
    {
      selectedFolderIds: ['1'],
      hideFolderNames: false
    }
  )
})

test('new tab folder settings fall back to a non-empty 标签页 folder before explicit source selection exists', () => {
  assert.deepEqual(
    normalizeFolderSettingsWithDefault(undefined, rootNode),
    {
      selectedFolderIds: ['10'],
      hideFolderNames: false
    }
  )
})

test('new tab folder settings preserve explicit empty source selection', () => {
  assert.deepEqual(
    normalizeFolderSettingsWithDefault({ selectedFolderIds: [], hideFolderNames: true }, rootNode),
    {
      selectedFolderIds: [],
      hideFolderNames: true
    }
  )
})

test('new tab folder settings aggregate the bookmarks bar when no 标签页 source is displayable', () => {
  const rootWithBookmarksBarFolder: chrome.bookmarks.BookmarkTreeNode = {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        parentId: '0',
        title: '书签栏',
        children: [
          {
            id: '10',
            parentId: '1',
            title: '标签页',
            children: []
          },
          {
            id: '20',
            parentId: '1',
            title: '工作',
            children: [
              {
                id: '21',
                parentId: '20',
                title: 'Docs',
                url: 'https://example.com/docs'
              }
            ]
          }
        ]
      },
      {
        id: '2',
        parentId: '0',
        title: '其他书签',
        children: [
          {
            id: '30',
            parentId: '2',
            title: 'Other',
            url: 'https://example.com/other'
          }
        ]
      }
    ]
  }

  assert.equal(findDefaultNewTabSourceFolder(rootWithBookmarksBarFolder)?.id, '1')
  assert.deepEqual(
    normalizeFolderSettingsWithDefault(undefined, rootWithBookmarksBarFolder),
    {
      selectedFolderIds: ['1'],
      hideFolderNames: false
    }
  )
  assert.deepEqual(
    getDisplayableNewTabSourceFolders(rootWithBookmarksBarFolder.children?.[0] || null).map((folder) => folder.id),
    ['20']
  )
})

test('new tab folder settings keep first-use bookmarks visible when bookmarks bar only has nested bookmarks', () => {
  const rootWithNestedBookmarksBarItems: chrome.bookmarks.BookmarkTreeNode = {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        parentId: '0',
        title: '书签栏',
        children: [
          {
            id: '10',
            parentId: '1',
            title: '前端',
            children: [
              {
                id: '11',
                parentId: '10',
                title: 'React',
                url: 'https://react.dev/'
              }
            ]
          },
          {
            id: '20',
            parentId: '1',
            title: '工具',
            children: [
              {
                id: '21',
                parentId: '20',
                title: 'MDN',
                url: 'https://developer.mozilla.org/'
              },
              {
                id: '22',
                parentId: '20',
                title: 'CSS',
                url: 'https://web.dev/learn/css'
              }
            ]
          }
        ]
      }
    ]
  }
  const bookmarksBar = rootWithNestedBookmarksBarItems.children?.[0] || null

  assert.equal(findDefaultNewTabSourceFolder(rootWithNestedBookmarksBarItems)?.id, '1')
  assert.deepEqual(
    normalizeFolderSettingsWithDefault(undefined, rootWithNestedBookmarksBarItems),
    {
      selectedFolderIds: ['1'],
      hideFolderNames: false
    }
  )
  assert.deepEqual(
    getDisplayableNewTabSourceFolders(bookmarksBar).map((folder) => folder.id),
    ['10', '20']
  )
  assert.deepEqual(getFolderBookmarkCounts(bookmarksBar), {
    directBookmarkCount: 0,
    totalBookmarkCount: 3
  })
})

test('new tab folder settings fall back to another non-empty root folder after bookmarks bar options', () => {
  const rootWithOtherTopLevelFolder: chrome.bookmarks.BookmarkTreeNode = {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        parentId: '0',
        title: '书签栏',
        children: [
          {
            id: '10',
            parentId: '1',
            title: '标签页',
            children: []
          }
        ]
      },
      {
        id: '2',
        parentId: '0',
        title: '其他书签',
        children: [
          {
            id: '20',
            parentId: '2',
            title: 'Docs',
            url: 'https://example.com/docs'
          }
        ]
      }
    ]
  }

  assert.equal(findDefaultNewTabSourceFolder(rootWithOtherTopLevelFolder)?.id, '2')
  assert.deepEqual(
    normalizeFolderSettingsWithDefault(undefined, rootWithOtherTopLevelFolder),
    {
      selectedFolderIds: ['2'],
      hideFolderNames: false
    }
  )
})

test('new tab folder settings preserve unavailable explicit selections for missing-folder recovery UI', () => {
  assert.deepEqual(
    normalizeFolderSettingsWithDefault({ selectedFolderIds: ['999', '999', ' '] }, rootNode),
    {
      selectedFolderIds: ['999'],
      hideFolderNames: false
    }
  )
})

test('new tab folder lookup prefers the direct bookmarks bar 标签页 folder', () => {
  assert.equal(findNewTabFolder(rootNode)?.id, '10')
})

test('new tab folder id normalization trims, dedupes, and caps source ids', () => {
  const ids = normalizeFolderIds([
    ' a ',
    'a',
    '',
    ...Array.from({ length: 30 }, (_, index) => `folder-${index}`)
  ])

  assert.equal(ids[0], 'a')
  assert.equal(ids.length, 24)
  assert.equal(ids.at(-1), 'folder-22')
})
