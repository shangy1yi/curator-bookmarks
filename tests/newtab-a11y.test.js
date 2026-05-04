import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

function readProjectFile(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

test('newtab root is not a page-wide live region', () => {
  const newtabHtml = readProjectFile('src/newtab/newtab.html')
  const rootMatch = newtabHtml.match(/<div id="newtab-root"[^>]*>/)

  assert.ok(rootMatch)
  assert.doesNotMatch(rootMatch[0], /aria-live=/)
})

test('newtab keeps local polite status regions for short feedback', () => {
  const newtabHtml = readProjectFile('src/newtab/newtab.html')
  const newtabSource = readProjectFile('src/newtab/newtab.ts')

  assert.match(newtabHtml, /id="settings-save-status"[\s\S]*aria-live="polite"/)
  assert.match(newtabSource, /toast\.setAttribute\('role', 'status'\)/)
  assert.match(newtabSource, /toast\.setAttribute\('aria-live', 'polite'\)/)
  assert.match(newtabSource, /function getBookmarkActionLabelContext\(bookmark/)
  assert.match(newtabSource, /title\.length > 48 \? `\$\{title\.slice\(0, 47\)\.trim\(\)\}…` : title/)
  assert.match(newtabSource, /undo\.setAttribute\('aria-label', `撤销删除：\$\{bookmarkLabel\}`\)/)
  assert.match(newtabSource, /recycle\.setAttribute\('aria-label', `打开回收站查看：\$\{bookmarkLabel\}`\)/)
})

test('newtab bookmark edit menu actions expose bookmark-specific labels', () => {
  const newtabSource = readProjectFile('src/newtab/newtab.ts')

  assert.match(newtabSource, /const bookmarkLabel = getBookmarkActionLabelContext\(bookmark\)/)
  assert.match(newtabSource, /const pinLabel = isActiveMenuBookmarkPinned\(\) \? '取消固定书签' : '固定书签到常用'/)
  assert.match(newtabSource, /const deleteLabel = state\.pendingDeleteBookmarkId === String\(bookmark\.id\) \? '确认删除书签' : '删除书签'/)
  assert.match(newtabSource, /actionId: 'toggle-pin', ariaLabel: `\$\{pinLabel\}：\$\{bookmarkLabel\}`/)
  assert.match(newtabSource, /actionId: 'copy-url',[\s\S]*?ariaLabel: `复制书签链接：\$\{bookmarkLabel\}`/)
  assert.match(newtabSource, /actionId: 'delete-bookmark', variant: 'danger', ariaLabel: `\$\{deleteLabel\}：\$\{bookmarkLabel\}`/)
  assert.match(newtabSource, /actionId: 'refresh-icon',[\s\S]*?ariaLabel: `刷新书签图标：\$\{bookmarkLabel\}`/)
  assert.match(newtabSource, /actionId: 'save-bookmark',[\s\S]*?ariaLabel: `保存书签更改：\$\{bookmarkLabel\}`/)
  assert.match(newtabSource, /ariaLabel = label/)
  assert.match(newtabSource, /button\.setAttribute\('aria-label', ariaLabel\)/)
})

test('newtab folder candidate picker exposes named listbox semantics', () => {
  const newtabHtml = readProjectFile('src/newtab/newtab.html')
  const searchInput = newtabHtml.match(/<input[\s\S]*?id="folder-candidate-search"[\s\S]*?>/)?.[0] || ''
  const candidateList = newtabHtml.match(/<div[\s\S]*?id="folder-candidate-list"[\s\S]*?>/)?.[0] || ''

  assert.match(searchInput, /aria-label="搜索候选文件夹"/)
  assert.match(searchInput, /aria-controls="folder-candidate-list"/)
  assert.match(candidateList, /role="listbox"/)
  assert.match(candidateList, /aria-label="候选文件夹列表"/)
  assert.match(candidateList, /aria-multiselectable="true"/)
})

test('newtab settings native controls expose stable accessible names', () => {
  const newtabHtml = readProjectFile('src/newtab/newtab.html')
  const labelledControls = [
    ['background-type', '背景类型'],
    ['background-url', '背景图片链接'],
    ['background-mask-blur', '背景蒙版模糊程度'],
    ['background-mask-style', '背景蒙版样式'],
    ['icon-page-width', '书签卡片页面宽度'],
    ['icon-tile-width', '书签卡片宽度'],
    ['icon-shell-size', '书签图标区域尺寸'],
    ['icon-column-gap', '书签卡片横向间距'],
    ['icon-row-gap', '书签卡片行距'],
    ['icon-folder-gap', '书签文件夹间距'],
    ['icon-columns', '书签卡片固定列数'],
    ['time-display-mode', '时间显示内容'],
    ['time-time-zone', '时区'],
    ['time-date-format', '日期格式'],
    ['time-density', '时间布局密度'],
    ['time-clock-size', '时间字号'],
    ['search-engine', '默认搜索引擎'],
    ['search-placeholder', '搜索栏占位符文本'],
    ['search-width', '搜索栏宽度'],
    ['search-height', '搜索栏高度'],
    ['search-offset-y', '搜索栏上下位置'],
    ['search-background', '搜索栏背景透明度']
  ]

  for (const [id, label] of labelledControls) {
    const control = newtabHtml.match(new RegExp(`<(?:input|select)[\\s\\S]*?id="${id}"[\\s\\S]*?>`))?.[0] || ''
    assert.ok(control, `missing control ${id}`)
    assert.match(control, new RegExp(`aria-label="${label}"`))
  }
})

test('newtab wallpaper startup motion respects reduced-motion preference', () => {
  const newtabCss = readProjectFile('src/newtab/newtab.css')

  assert.match(newtabCss, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(newtabCss, /transition: none !important/)
  assert.match(newtabCss, /html:not\(\.loading-wallpaper\) \.newtab-shell/)
  assert.match(newtabCss, /\.newtab-background-video/)
})

test('newtab dashboard overlay has modal dialog semantics and managed focus', () => {
  const newtabHtml = readProjectFile('src/newtab/newtab.html')
  const newtabSource = readProjectFile('src/newtab/newtab.ts')
  const overlayMatch = newtabHtml.match(/<section[\s\S]*?id="newtab-dashboard-overlay"[\s\S]*?>/)
  const frameMatch = newtabHtml.match(/<iframe[\s\S]*?id="newtab-dashboard-frame"[\s\S]*?>/)

  assert.ok(overlayMatch)
  assert.match(overlayMatch[0], /role="dialog"/)
  assert.match(overlayMatch[0], /aria-modal="true"/)
  assert.match(overlayMatch[0], /aria-hidden="true"/)
  assert.match(overlayMatch[0], /tabindex="-1"/)
  assert.ok(frameMatch)
  assert.match(frameMatch[0], /tabindex="0"/)

  assert.match(newtabSource, /dashboardReturnFocusTarget/)
  assert.match(newtabSource, /function focusDashboardOverlay\(\): void/)
  assert.match(newtabSource, /dashboardOverlay\?\.focus\(\)/)
  assert.match(newtabSource, /dashboardFrame\.focus\(\)/)
  assert.match(newtabSource, /function trapDashboardOverlayFocus\(event: KeyboardEvent\): boolean/)
  assert.match(newtabSource, /event\.key === 'Tab' && trapDashboardOverlayFocus\(event\)/)
  assert.match(newtabSource, /dashboardOverlay\.contains\(activeElement\)/)
  assert.match(newtabSource, /function restoreDashboardFocus\(\): void/)
})
