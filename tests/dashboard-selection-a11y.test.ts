import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

import {
  applyNewTabSpeedDialStateMessage,
  createNewTabToggleSpeedDialMessage,
  getDashboardFaviconFallbackUrl,
  getDashboardCardActionLabel,
  getDashboardSelectionLabel,
  isNewTabDashboardEmbed
} from '../src/options/sections/dashboard.js'
import {
  NEWTAB_SPEED_DIAL_STATE_MESSAGE_TYPE,
  NEWTAB_TOGGLE_SPEED_DIAL_MESSAGE_TYPE
} from '../src/shared/constants.js'

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

test('dashboard card action labels include bookmark context', () => {
  const label = getDashboardCardActionLabel('删除书签', {
    title: 'React 表格教程',
    url: 'https://example.com/react-table'
  })
  const fallbackLabel = getDashboardCardActionLabel('打开书签', {
    title: '',
    url: 'https://platform.openai.com/docs/'
  })
  const longLabel = getDashboardCardActionLabel('移动书签', {
    title: '这是一个非常长的书签标题，用于验证 Dashboard 卡片动作按钮可访问名称会被合理截断并且不会在按钮列表里占用过多朗读长度',
    url: 'https://example.com/long-title'
  })

  assert.equal(label, '删除书签：React 表格教程')
  assert.equal(fallbackLabel, '打开书签：platform.openai.com/docs')
  assert.ok(longLabel.length < 60)
  assert.match(longLabel, /…$/)
})

test('dashboard cards render bookmark-specific action labels', () => {
  const dashboardSource = readProjectFile('src/options/sections/dashboard.ts')

  assert.match(dashboardSource, /const openLabel = getDashboardCardActionLabel\('打开书签', item\)/)
  assert.match(dashboardSource, /const copyActionLabel = getDashboardCardActionLabel\('复制书签链接', item\)/)
  assert.match(dashboardSource, /const editTagsLabel = getDashboardCardActionLabel\('修改书签标签', item\)/)
  assert.match(dashboardSource, /const moveLabel = getDashboardCardActionLabel\('移动书签', item\)/)
  assert.match(dashboardSource, /const deleteLabel = getDashboardCardActionLabel\('删除书签', item\)/)
  assert.match(dashboardSource, /const speedDialPinned = dashboardState\.speedDialPinnedIds\.has\(String\(item\.id\)\)/)
  assert.match(dashboardSource, /const speedDialActionLabel = getDashboardCardActionLabel\(speedDialTooltip, item\)/)
  assert.match(dashboardSource, /renderDashboardCardAction\(\{[\s\S]*?icon: 'open'[\s\S]*?label: openLabel[\s\S]*?tooltip: '打开书签'/)
  assert.match(dashboardSource, /renderDashboardCardAction\(\{[\s\S]*?icon: 'copy'[\s\S]*?label: copyActionLabel[\s\S]*?tooltip: copyLabel === '已复制' \? '已复制' : '复制链接'/)
  assert.match(dashboardSource, /renderDashboardCardAction\(\{[\s\S]*?icon: 'tag'[\s\S]*?label: editTagsLabel[\s\S]*?tooltip: '修改标签'/)
  assert.match(dashboardSource, /data-dashboard-action="toggle-speed-dial"[\s\S]*?aria-pressed="\$\{speedDialPinned \? 'true' : 'false'\}"/)
  assert.match(dashboardSource, /className: `detect-result-action dashboard-speed-dial-action \$\{speedDialPinned \? 'active' : ''\}`/)
  assert.match(dashboardSource, /renderDashboardCardAction\(\{[\s\S]*?icon: 'move'[\s\S]*?label: moveLabel[\s\S]*?tooltip: '移动书签'/)
  assert.match(dashboardSource, /renderDashboardCardAction\(\{[\s\S]*?icon: 'delete'[\s\S]*?label: deleteLabel[\s\S]*?tooltip: '删除书签'/)
  assert.match(dashboardSource, /<span class="sr-only">\$\{safeText\}<\/span>/)
  assert.match(dashboardSource, /data-dashboard-tooltip="\$\{safeTooltip\}"/)
  assert.doesNotMatch(dashboardSource, />添加进 Speed Dial<\/button>/)
})

test('dashboard Speed Dial action uses the shared newtab toggle message contract', () => {
  const dashboardSource = readProjectFile('src/options/sections/dashboard.ts')
  const constantsSource = readProjectFile('src/shared/constants.ts')

  assert.equal(NEWTAB_TOGGLE_SPEED_DIAL_MESSAGE_TYPE, 'curator:newtab-toggle-speed-dial')
  assert.equal(NEWTAB_SPEED_DIAL_STATE_MESSAGE_TYPE, 'curator:newtab-speed-dial-state')
  assert.deepEqual(createNewTabToggleSpeedDialMessage('  b1  '), {
    type: 'curator:newtab-toggle-speed-dial',
    bookmarkId: 'b1'
  })
  assert.equal(applyNewTabSpeedDialStateMessage({
    type: 'curator:newtab-speed-dial-state',
    pinnedIds: [' b1 ', '', 'b2']
  }), true)
  const invalidSpeedDialStateMessage = {
    type: 'curator:unknown',
    pinnedIds: ['b1']
  }
  assert.equal(applyNewTabSpeedDialStateMessage(invalidSpeedDialStateMessage), false)
  assert.equal(isNewTabDashboardEmbed('?embed=newtab-dashboard'), true)
  assert.equal(isNewTabDashboardEmbed('?embed=options'), false)
  assert.match(constantsSource, /export interface NewTabToggleSpeedDialMessage[\s\S]*?type: typeof NEWTAB_TOGGLE_SPEED_DIAL_MESSAGE_TYPE[\s\S]*?bookmarkId: string/)
  assert.match(constantsSource, /export interface NewTabSpeedDialStateMessage[\s\S]*?type: typeof NEWTAB_SPEED_DIAL_STATE_MESSAGE_TYPE[\s\S]*?pinnedIds: string\[\]/)
  assert.match(dashboardSource, /function applyNewTabSpeedDialStateMessage\(/)
  assert.match(dashboardSource, /action === 'toggle-speed-dial'[\s\S]*?toggleDashboardBookmarkSpeedDial\(bookmarkId\)/)
  assert.match(dashboardSource, /function toggleDashboardBookmarkSpeedDial\(bookmarkId: string\): void/)
  assert.match(dashboardSource, /window\.parent\.postMessage\(createNewTabToggleSpeedDialMessage\(safeBookmarkId\), window\.location\.origin\)/)
  assert.match(dashboardSource, /dashboardState\.speedDialPinnedIds\.has\(safeBookmarkId\)/)
  assert.match(dashboardSource, /setDashboardStatus\('请在新标签页打开仪表盘后添加到 Speed Dial。'\)/)
})

test('dashboard cards use stable Chrome favicon URLs without swapping visible sources', () => {
  const dashboardSource = readProjectFile('src/options/sections/dashboard.ts')
  const optionsSource = readProjectFile('src/options/options.ts')

  assert.match(dashboardSource, /export function getDashboardFaviconFallbackUrl\(url: string\): string/)
  assert.match(dashboardSource, /chrome-extension:\/\/\$\{runtimeId\}\/_favicon\/\?pageUrl=\$\{encodeURIComponent\(url\)\}&size=32/)
  assert.match(dashboardSource, /data-dashboard-favicon-source="chrome"/)
  assert.match(dashboardSource, /data-dashboard-favicon-page-url="\$\{escapeAttr\(item\.url\)\}"/)
  assert.match(dashboardSource, /function handleDashboardFaviconError\(image: HTMLImageElement, _callbacks: DashboardCallbacks\): void/)
  assert.match(dashboardSource, /function handleDashboardFaviconError\([\s\S]*?image\.remove\(\)/)
  assert.doesNotMatch(dashboardSource, /\/favicon\.ico/)
  assert.doesNotMatch(dashboardSource, /image\.src\s*=/)
  assert.match(optionsSource, /handleDashboardError\(event, dashboardCallbacks\), true/)
  assert.match(optionsSource, /getFaviconFallbackUrl: getDashboardFaviconFallbackUrl/)

  const originalChrome = globalThis.chrome
  globalThis.chrome = {
    ...originalChrome,
    runtime: {
      ...originalChrome?.runtime,
      id: 'extension-id'
    }
  } as typeof chrome
  try {
    assert.equal(
      getDashboardFaviconFallbackUrl('https://example.com/docs'),
      'chrome-extension://extension-id/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2Fdocs&size=32'
    )
  } finally {
    if (originalChrome === undefined) {
      delete globalThis.chrome
    } else {
      globalThis.chrome = originalChrome
    }
  }
})

test('dashboard cards expose keyboard-triggerable move and delete actions', () => {
  const dashboardSource = readProjectFile('src/options/sections/dashboard.ts')

  assert.match(dashboardSource, /data-dashboard-action="move-one"[\s\S]*?text: '移动'/)
  assert.match(dashboardSource, /data-dashboard-action="delete-one"[\s\S]*?text: '删除'/)
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
