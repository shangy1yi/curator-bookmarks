import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

import { getDashboardSelectionLabel } from '../src/options/sections/dashboard.js'

function readProjectFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

test('dashboard selection checkbox label includes the bookmark title and path context', () => {
  const label = getDashboardSelectionLabel({
    title: 'React 表格教程',
    path: '书签栏 / 前端 / React',
    url: 'https://example.com/react-table'
  })

  assert.match(label, /选择书签/)
  assert.match(label, /React 表格教程/)
  assert.match(label, /书签栏 \/ 前端 \/ React/)
})

test('dashboard selection checkbox label falls back to URL context when path is missing', () => {
  const label = getDashboardSelectionLabel({
    title: 'OpenAI Docs',
    path: '',
    url: 'https://platform.openai.com/docs/'
  })

  assert.match(label, /OpenAI Docs/)
  assert.match(label, /platform\.openai\.com\/docs/)
})

test('dashboard selection checkbox renders the specific accessible name', () => {
  const dashboardSource = readProjectFile('src/options/sections/dashboard.ts')

  assert.match(dashboardSource, /const selectionLabel = getDashboardSelectionLabel\(item\)/)
  assert.match(dashboardSource, /<input[\s\S]*?type="checkbox"[\s\S]*?aria-label="\$\{escapeAttr\(selectionLabel\)\}"/)
  assert.match(dashboardSource, /<span class="sr-only">\$\{escapeHtml\(selectionLabel\)\}<\/span>/)
  assert.doesNotMatch(dashboardSource, /<span class="sr-only">选择<\/span>/)
})

test('dashboard cards expose keyboard-triggerable move and delete actions', () => {
  const dashboardSource = readProjectFile('src/options/sections/dashboard.ts')

  assert.match(dashboardSource, /data-dashboard-action="move-one"[\s\S]*?>移动<\/button>/)
  assert.match(dashboardSource, /data-dashboard-action="delete-one"[\s\S]*?>删除<\/button>/)
  assert.match(dashboardSource, /action === 'delete-one'[\s\S]*?deleteDashboardBookmarkFromCard/)
  assert.match(dashboardSource, /async function deleteDashboardBookmarkFromCard/)
})

test('dashboard folder filter uses listbox option semantics instead of tree semantics', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const dashboardSource = readProjectFile('src/options/sections/dashboard.ts')
  const folderFilterElement = optionsHtml.match(/<nav[\s\S]*?id="dashboard-folder-tree"[\s\S]*?>/)?.[0] || ''

  assert.match(folderFilterElement, /role="listbox"/)
  assert.match(dashboardSource, /role="option"[\s\S]*?aria-selected="\$\{active \? 'true' : 'false'\}"/)
  assert.doesNotMatch(folderFilterElement, /role="tree"/)
  assert.doesNotMatch(dashboardSource, /role="treeitem"/)
})
