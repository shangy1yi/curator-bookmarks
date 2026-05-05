import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

function readProjectFile(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

test('popup search block renders lightweight saved search controls', () => {
  const popupHtml = readProjectFile('src/popup/popup.html')
  const popupDom = readProjectFile('src/popup/dom.ts')
  const popupSource = readProjectFile('src/popup/popup.ts')

  assert.match(popupHtml, /id="saved-searches" class="saved-searches hidden"/)
  assert.match(popupDom, /dom\.savedSearches = byId\('saved-searches'\)/)
  assert.match(popupSource, /function renderSavedSearches\(\)/)
  assert.match(popupSource, /data-saved-search-action="save-current"/)
  assert.match(popupSource, /data-saved-search-action="apply"/)
  assert.match(popupSource, /data-saved-search-action="delete"/)
  assert.match(popupSource, /void hydrateSavedSearches\(\)/)
})

test('popup search help documents quoted filters and spaced operators', () => {
  const popupHtml = readProjectFile('src/popup/popup.html')
  const popupSource = readProjectFile('src/popup/popup.ts')

  assert.match(popupHtml, /site:github\.com 或 site: github\.com/)
  assert.match(popupHtml, /folder:&quot;前端 资料&quot;/)
  assert.match(popupHtml, /最近 2 周、昨天、上个月/)
  assert.match(popupHtml, /-&quot;短视频&quot;/)
  assert.match(popupSource, /site:github\.com、folder:"前端 资料"、最近 2 周、-视频/)
})

test('popup auto analyze status renders at the bottom of the main layout', () => {
  const popupHtml = readProjectFile('src/popup/popup.html')
  const contentIndex = popupHtml.indexOf('<section class="content-shell">')
  const statusIndex = popupHtml.indexOf('id="auto-analyze-status"')
  const footerIndex = popupHtml.indexOf('<footer id="smart-footer"')

  assert.ok(contentIndex > -1)
  assert.ok(statusIndex > contentIndex)
  assert.ok(footerIndex > statusIndex)
})

test('auto analyze completion does not create popup toast notices', () => {
  const popupSource = readProjectFile('src/popup/popup.ts')
  const serviceWorkerSource = readProjectFile('src/service-worker/service-worker.ts')

  assert.match(popupSource, /async function hydrateAutoAnalyzeStatus/)
  assert.doesNotMatch(popupSource, /showPendingAutoAnalyzeNotice|pendingNoticeChange|已添加到 \$\{folderPath\}/)
  assert.doesNotMatch(serviceWorkerSource, /persistPendingAutoAnalyzeNotice/)
})

test('snapshot-only auto analysis completion stays silent in popup and action badge', () => {
  const serviceWorkerSource = readProjectFile('src/service-worker/service-worker.ts')

  assert.doesNotMatch(serviceWorkerSource, /网页快照已保存到本地/)
  assert.doesNotMatch(serviceWorkerSource, /网页快照已仅保存到本地/)
  assert.match(
    serviceWorkerSource,
    /if \(!shouldUploadToAi\) \{[\s\S]*?await clearAutoAnalyzeStatusForBookmark\(bookmarkId\)[\s\S]*?return[\s\S]*?\}/
  )
})

test('popup search and modal inputs keep visible keyboard focus rings', () => {
  const popupCss = readProjectFile('src/popup/popup.css')

  assert.match(
    popupCss,
    /\.search-shell:focus-within\s*\{[\s\S]*?box-shadow:\s*[\s\S]*?0 0 0 2px rgba\(255,\s*255,\s*255,\s*0\.2\)[\s\S]*?0 0 0 4px rgba\(0,\s*0,\s*0,\s*0\.48\)/
  )
  assert.match(
    popupCss,
    /\.modal-search:focus-within\s*\{[\s\S]*?0 0 0 2px rgba\(255,\s*255,\s*255,\s*0\.24\)[\s\S]*?0 0 0 4px rgba\(0,\s*0,\s*0,\s*0\.54\)/
  )
  assert.match(
    popupCss,
    /\.modal-card:focus-visible,\s*\.modal-input:focus-visible\s*\{[\s\S]*?outline:\s*2px solid rgba\(245,\s*245,\s*247,\s*0\.86\)/
  )
})

test('popup modals make the background app shell inert while open', () => {
  const popupHtml = readProjectFile('src/popup/popup.html')
  const popupDom = readProjectFile('src/popup/dom.ts')
  const popupSource = readProjectFile('src/popup/popup.ts')

  assert.match(popupHtml, /<main id="popup-app-shell" class="app-shell">/)
  assert.match(popupDom, /dom\.appShell = byId\('popup-app-shell'\)/)
  assert.match(popupSource, /function syncPopupAppShellModalState\(hasOpenModal\)/)
  assert.match(popupSource, /syncPopupAppShellModalState\(hasOpenModal\)/)
  assert.match(popupSource, /dom\.appShell\.setAttribute\('aria-hidden', 'true'\)[\s\S]*?dom\.appShell\.setAttribute\('inert', ''\)/)
  assert.match(popupSource, /dom\.appShell\.setAttribute\('aria-hidden', 'false'\)[\s\S]*?dom\.appShell\.removeAttribute\('inert'\)/)
  assert.match(popupSource, /element\.getClientRects\(\)\.length > 0/)
  assert.doesNotMatch(popupSource, /element\.offsetParent !== null/)
})

test('popup bookmark action menus expose bookmark-specific labels', () => {
  const popupSource = readProjectFile('src/popup/popup.ts')

  assert.match(popupSource, /function getBookmarkActionMenuLabel\(bookmark\)/)
  assert.match(popupSource, /return `打开 \$\{title\} 的操作菜单`/)
  assert.match(popupSource, /function getBookmarkActionLabel\(action, bookmarkId\)/)
  assert.match(popupSource, /const bookmark = state\.bookmarkMap\.get\(String\(bookmarkId \|\| ''\)\)/)
  assert.match(popupSource, /return `\$\{action\}：\$\{title \|\| '未命名书签'\}`/)
  assert.match(popupSource, /const menuLabel = getBookmarkActionMenuLabel\(bookmark\)/)
  assert.match(popupSource, /aria-label="\$\{escapeAttr\(menuLabel\)\}"/)
  assert.match(popupSource, /const editLabel = getBookmarkActionLabel\('编辑书签', bookmarkId\)/)
  assert.match(popupSource, /const copyLabel = getBookmarkActionLabel\('复制书签链接', bookmarkId\)/)
  assert.match(popupSource, /const openLabel = getBookmarkActionLabel\('当前页打开书签', bookmarkId\)/)
  assert.match(popupSource, /const moveLabel = getBookmarkActionLabel\('移动书签', bookmarkId\)/)
  assert.match(popupSource, /const deleteLabel = getBookmarkActionLabel\('删除书签', bookmarkId\)/)
  assert.match(popupSource, /data-menu-action="edit"[\s\S]*?aria-label="\$\{escapeAttr\(editLabel\)\}"/)
  assert.match(popupSource, /data-menu-action="copy-url"[\s\S]*?aria-label="\$\{escapeAttr\(copyLabel\)\}"/)
  assert.match(popupSource, /data-menu-action="open-current-tab"[\s\S]*?aria-label="\$\{escapeAttr\(openLabel\)\}"/)
  assert.match(popupSource, /data-menu-action="move"[\s\S]*?aria-label="\$\{escapeAttr\(moveLabel\)\}"/)
  assert.match(popupSource, /data-menu-action="delete"[\s\S]*?aria-label="\$\{escapeAttr\(deleteLabel\)\}"/)
  assert.doesNotMatch(popupSource, /aria-label="打开操作菜单"/)
})

test('popup bookmark action menu restores focus and supports trigger arrow keys', () => {
  const popupSource = readProjectFile('src/popup/popup.ts')

  assert.match(popupSource, /function openActionMenuFromToggle\(bookmarkId, \{ focusLast = false \} = \{\}\)/)
  assert.match(popupSource, /focusActionMenuItem\(focusLast \? getActionMenuItems\(\)\.length - 1 : 0\)/)
  assert.match(popupSource, /function closeActionMenu\(\{ restoreFocus = false, focusBookmarkId = state\.activeMenuBookmarkId \} = \{\}\)/)
  assert.match(popupSource, /getMenuToggleForBookmark\(returnBookmarkId\)\?\.focus\(\)/)
  assert.match(popupSource, /closeActionMenu\(\{ restoreFocus: true \}\)/)
  assert.match(popupSource, /function handleActionMenuToggleKeydown\(event\)/)
  assert.match(popupSource, /event\.key !== 'ArrowDown' && event\.key !== 'ArrowUp'/)
  assert.match(popupSource, /openActionMenuFromToggle\(bookmarkId, \{ focusLast: event\.key === 'ArrowUp' \}\)/)
})

test('popup shell keeps a stable action popup width', () => {
  const popupCss = readProjectFile('src/popup/popup.css')
  const rootSizeRule = popupCss.match(/html,\s*body\s*\{[\s\S]*?\n\}/)?.[0] || ''

  assert.match(rootSizeRule, /width:\s*430px/)
  assert.match(rootSizeRule, /min-width:\s*430px/)
  assert.match(rootSizeRule, /max-width:\s*430px/)
  assert.doesNotMatch(rootSizeRule, /width:\s*min\(430px,\s*100vw\)/)
})
