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

test('dashboard default copy matches the bookmarks bar scope', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const dashboardSource = readProjectFile('src/options/sections/dashboard.ts')
  const dashboardPanel = optionsHtml.match(/<section[\s\S]*?id="dashboard"[\s\S]*?<\/section>/)?.[0] || ''

  assert.match(dashboardPanel, /<h1 id="dashboard-title">书签栏 <span id="dashboard-total">\(0\)<\/span><\/h1>/)
  assert.match(dashboardPanel, /<strong id="dashboard-cards-title">书签栏<\/strong>/)
  assert.match(dashboardSource, /function getDashboardScopeTitle\(folderId: string\): string/)
  assert.match(dashboardSource, /return '书签栏'/)
  assert.match(dashboardSource, /dom\.dashboardCardsTitle\.textContent = scopeTitle/)
  assert.match(dashboardSource, /const scopedCountText = `\(\$\{visibleItems\.length\}\)`/)
  assert.doesNotMatch(dashboardPanel, /全部书签/)
})

test('dashboard hidden tag count toggles by click or keyboard and closes with Escape', () => {
  const dashboardSource = readProjectFile('src/options/sections/dashboard.ts')

  assert.match(dashboardSource, /function toggleDashboardTagPopover\(tagToggle: HTMLElement\): boolean/)
  assert.match(dashboardSource, /dashboardState\.expandedTagIds\.has\(bookmarkId\)[\s\S]*?dashboardState\.expandedTagIds\.delete\(bookmarkId\)/)
  assert.match(dashboardSource, /dashboardState\.expandedTagIds\.clear\(\)[\s\S]*?dashboardState\.expandedTagIds\.add\(bookmarkId\)/)
  assert.match(dashboardSource, /if \(event\.key === 'Escape' && dashboardState\.expandedTagIds\.size\)[\s\S]*?closeDashboardTagPopover\(\)/)
  assert.match(dashboardSource, /event\.key !== 'Enter' && event\.key !== ' '/)
  assert.match(dashboardSource, /const tagToggle = target\.closest<HTMLElement>\('\[data-dashboard-toggle-tags\]'\)[\s\S]*?toggleDashboardTagPopover\(tagToggle\)/)
  assert.match(dashboardSource, /aria-expanded="\$\{expanded \? 'true' : 'false'\}"/)
  assert.match(dashboardSource, /aria-controls="dashboard-tag-popover-\$\{escapeAttr\(item\.id\)\}"/)
  assert.match(dashboardSource, /handleDashboardTagPointerOver/)
  assert.match(dashboardSource, /handleDashboardTagPointerOut/)
})

test('dashboard folder filter uses listbox option semantics instead of tree semantics', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const dashboardSource = readProjectFile('src/options/sections/dashboard.ts')
  const folderFilterElement = optionsHtml.match(/<nav[\s\S]*?id="dashboard-folder-tree"[\s\S]*?>/)?.[0] || ''

  assert.match(folderFilterElement, /role="listbox"/)
  assert.match(dashboardSource, /role="option"[\s\S]*?aria-selected="\$\{active \? 'true' : 'false'\}"/)
  assert.match(dashboardSource, /tabindex="\$\{tabIndex\}"/)
  assert.match(dashboardSource, /function handleDashboardFolderListboxKeydown/)
  assert.match(dashboardSource, /event\.key !== 'ArrowDown'[\s\S]*?event\.key !== 'End'/)
  assert.match(dashboardSource, /function focusAndApplyDashboardFolderOption/)
  assert.match(dashboardSource, /const folderId = String\(option\.getAttribute\('data-dashboard-folder-filter'\) \|\| ''\)\.trim\(\)/)
  assert.match(dashboardSource, /applyDashboardFolderFilter\(folderId\)/)
  assert.match(dashboardSource, /let pendingDashboardFolderFocusId = ''/)
  assert.match(dashboardSource, /function restorePendingDashboardFolderFocus/)
  assert.match(dashboardSource, /option\.focus\(\{ preventScroll: true \}\)/)
  assert.match(dashboardSource, /function schedulePendingDashboardFolderFocusRestore/)
  assert.doesNotMatch(folderFilterElement, /role="tree"/)
  assert.doesNotMatch(dashboardSource, /role="treeitem"/)
})
