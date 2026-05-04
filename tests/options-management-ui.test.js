import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

function readProjectFile(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function getCssRuleBody(css, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))
  return match?.[1] || ''
}

function getVerticalPadding(rule) {
  const match = rule.match(/padding:\s*([0-9.]+)px\s+(?:clamp\([^)]*\)|[^\s;]+)(?:\s+([0-9.]+)px)?\s*;/)
  assert.ok(match, 'rule should define vertical padding in px')
  return {
    top: Number(match[1]),
    bottom: Number(match[2] || match[1])
  }
}

function getFunctionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`)
  assert.ok(start >= 0, `${functionName} should exist`)
  const bodyStart = source.indexOf('{', start)
  assert.ok(bodyStart >= 0, `${functionName} should have a body`)
  let depth = 0
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index]
    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return source.slice(bodyStart + 1, index)
      }
    }
  }
  assert.fail(`${functionName} body should close`)
}

test('options folder listbox options expose role and aria-selected state', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const optionsSource = readProjectFile('src/options/options.ts')

  assert.match(optionsHtml, /id="scope-folder-results"[^>]+role="listbox"[^>]+aria-label="筛选文件夹"/)
  assert.match(optionsSource, /class="scope-folder-card \$\{allSelected \? 'current' : ''\}"[\s\S]*?role="option"[\s\S]*?aria-selected="\$\{allSelected \? 'true' : 'false'\}"/)
  assert.match(optionsSource, /class="scope-folder-card \$\{isCurrent \? 'current' : ''\}"[\s\S]*?role="option"[\s\S]*?aria-selected="\$\{isCurrent \? 'true' : 'false'\}"/)
})

test('dashboard exposes a persistent folder sidebar with cached DOM refs', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const domSource = readProjectFile('src/options/shared-options/dom.ts')
  const dashboardPanel = optionsHtml.match(/<section[\s\S]*?id="dashboard"[\s\S]*?>/)?.[0] || ''
  const sidebarElement = optionsHtml.match(/<[^>]+id="dashboard-folder-sidebar"[^>]*>/)?.[0] || ''
  const folderFilterElement = optionsHtml.match(/<nav[\s\S]*?id="dashboard-folder-tree"[\s\S]*?>/)?.[0] || ''

  assert.match(dashboardPanel, /data-dashboard-ready="false"/)
  assert.match(optionsHtml, /class="dashboard-loading-screen"/)
  assert.match(sidebarElement, /aria-label="书签文件夹"/)
  assert.match(folderFilterElement, /role="listbox"/)
  assert.match(folderFilterElement, /aria-label="按文件夹筛选书签"/)
  assert.doesNotMatch(folderFilterElement, /role="tree"/)
  assert.match(domSource, /dashboardFolderSidebar\s*=\s*byId\('dashboard-folder-sidebar'\)/)
  assert.match(domSource, /dashboardFolderTree\s*=\s*byId\('dashboard-folder-tree'\)/)
})

test('dashboard renders a clickable folder sidebar filter with bookmark counts', () => {
  const dashboardSource = readProjectFile('src/options/sections/dashboard.ts')
  const renderSidebarReferences = dashboardSource.match(/renderDashboardFolderSidebar\(/g) || []

  assert.match(dashboardSource, /function renderDashboardFolderSidebar/)
  assert.ok(renderSidebarReferences.length >= 2, 'dashboard sidebar renderer should be invoked by the section render path')
  assert.match(dashboardSource, /dashboardFolderTree[\s\S]*data-dashboard-folder-filter/)
  assert.match(dashboardSource, /applyDashboardFolderFilter\(/)
  assert.match(dashboardSource, /getDashboardEffectiveFolderId/)
  assert.match(dashboardSource, /BOOKMARKS_BAR_ID/)
  assert.match(dashboardSource, /bookmarkCount/)
  assert.match(dashboardSource, /个书签/)
  assert.match(dashboardSource, /getCachedDashboardFolderBookmarkCounts/)
  assert.match(dashboardSource, /getCachedDashboardFolderSidebarMarkup/)
  assert.match(dashboardSource, /(?:active|current)/)
  assert.match(dashboardSource, /role="option"[\s\S]*?aria-selected="\$\{active \? 'true' : 'false'\}"/)
  assert.doesNotMatch(dashboardSource, /role="treeitem"/)
  assert.doesNotMatch(dashboardSource, /aria-pressed="\$\{active \? 'true' : 'false'\}"/)
  assert.doesNotMatch(dashboardSource, /title:\s*'全部书签'/)
})

test('content snapshot full text search map is not awaited during initial options hydration', () => {
  const optionsSource = readProjectFile('src/options/options.ts')
  const hydrateBody = optionsSource.match(/async function hydratePersistentState\(\) \{([\s\S]*?)async function saveAiNamingSettings/)?.[1] || ''
  const initialMapAssignment = hydrateBody.match(/contentSnapshotState\.searchTextMap = ([\s\S]*?)\n    contentSnapshotState\.searchTextMapIncludesFullText/)?.[1] || ''

  assert.match(optionsSource, /scheduleContentSnapshotFullTextSearchMapHydration/)
  assert.match(initialMapAssignment, /buildContentSnapshotSearchMap\(/)
  assert.doesNotMatch(initialMapAssignment, /await buildContentSnapshotSearchMapWithFullText/)
  assert.match(optionsSource, /requestIdleCallback/)
  assert.match(optionsSource, /CONTENT_SNAPSHOT_FULL_TEXT_RETRY_LIMIT\s*=\s*2/)
  assert.match(optionsSource, /function scheduleContentSnapshotFullTextSearchMapRetry/)
  assert.match(optionsSource, /contentSnapshotState\.searchTextMapFullTextRetryCount \+= 1/)
  assert.match(optionsSource, /function resetContentSnapshotFullTextSearchMapRetry/)
  assert.match(optionsSource, /hydrateContentSnapshotFullTextSearchMap/)
  assert.match(readProjectFile('src/options/sections/dashboard.ts'), /ensureDashboardFullTextSearchMapForQuery/)
})

test('AI snapshot saves update only the changed search text entry', () => {
  const optionsSource = readProjectFile('src/options/options.ts')
  const saveBody = getFunctionBody(optionsSource, 'saveContentSnapshotForAiPreparedItem')
  const updateBody = getFunctionBody(optionsSource, 'updateContentSnapshotSearchTextForRecord')

  assert.match(saveBody, /updateContentSnapshotSearchTextForRecord\(record\)/)
  assert.doesNotMatch(saveBody, /buildContentSnapshotSearchMapWithFullText/)
  assert.match(updateBody, /buildContentSnapshotSearchText\(record/)
  assert.match(updateBody, /new Map\(contentSnapshotState\.searchTextMap\)/)
  assert.match(updateBody, /scheduleContentSnapshotFullTextSearchMapHydration\(\)/)
})

test('popup and options brand use small extension icon assets', () => {
  const popupHtml = readProjectFile('src/popup/popup.html')
  const optionsHtml = readProjectFile('src/options/options.html')

  assert.match(popupHtml, /src="\.\.\/assets\/icon128\.png"/)
  assert.match(optionsHtml, /src="\.\.\/assets\/icon128\.png"/)
  assert.doesNotMatch(popupHtml, /icon4096\.jpg/)
  assert.doesNotMatch(optionsHtml, /icon4096\.jpg/)
})

test('dashboard virtual grid computes bounded windows for large card lists', async () => {
  const {
    computeDashboardVirtualWindow,
    getDashboardVirtualColumnCount,
    getDashboardVirtualRenderedCount
  } = await import('../src/options/sections/dashboard.js')

  assert.equal(getDashboardVirtualColumnCount(1040), 3)
  assert.equal(getDashboardVirtualColumnCount(1240), 4)

  const firstWindow = computeDashboardVirtualWindow({
    itemCount: 10000,
    contentWidth: 1040,
    containerHeight: 560,
    scrollTop: 0,
    cardHeight: 176,
    gap: 10,
    minCardWidth: 300,
    overscanRows: 4
  })

  assert.equal(firstWindow.columnCount, 3)
  assert.equal(firstWindow.startIndex, 0)
  assert.ok(
    getDashboardVirtualRenderedCount(firstWindow) <= 90,
    'initial dashboard window should render only visible rows plus overscan'
  )
  assert.ok(firstWindow.totalHeight > 600000)

  const scrolledWindow = computeDashboardVirtualWindow({
    itemCount: 10000,
    contentWidth: 1040,
    containerHeight: 560,
    scrollTop: 3720,
    cardHeight: 176,
    gap: 10,
    minCardWidth: 300,
    overscanRows: 4
  })

  assert.ok(scrolledWindow.startIndex > 0)
  assert.ok(scrolledWindow.offsetY > 0)
  assert.ok(
    getDashboardVirtualRenderedCount(scrolledWindow) <= 90,
    'scrolled dashboard window should keep DOM card count bounded'
  )
})

test('dashboard search toolbar omits duplicate result count and placeholder copy', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const domSource = readProjectFile('src/options/shared-options/dom.ts')
  const dashboardSource = readProjectFile('src/options/sections/dashboard.ts')
  const queryInput = optionsHtml.match(/<input[^>]+id="dashboard-query"[^>]*>/)?.[0] || ''

  assert.match(queryInput, /placeholder=""/)
  assert.doesNotMatch(optionsHtml, /id="dashboard-result-count"/)
  assert.doesNotMatch(domSource, /dashboardResultCount/)
  assert.doesNotMatch(dashboardSource, /dashboardResultCount/)
})

test('dashboard search help documents quoted filters and spaced operators', () => {
  const optionsHtml = readProjectFile('src/options/options.html')

  assert.match(optionsHtml, /site:github\.com 或 site: github\.com/)
  assert.match(optionsHtml, /folder:&quot;前端 资料&quot;/)
  assert.match(optionsHtml, /最近 2 周、昨天、上个月/)
  assert.match(optionsHtml, /-"短视频"/)
})

test('dashboard search input reuses the animated bottom focus indicator', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const optionsCss = readProjectFile('src/options/options.css')

  assert.match(optionsHtml, /<span class="dashboard-search-input-field">\s*<input id="dashboard-query"/)
  assert.match(optionsCss, /\.dashboard-search-input-field\s*\{[\s\S]*?--accent-color:\s*#a3e583[\s\S]*?position:\s*relative/)
  assert.match(optionsCss, /\.dashboard-search-input-field::before,\s*\.dashboard-search-input-field::after\s*\{[\s\S]*?bottom:\s*-1px/)
  assert.match(optionsCss, /\.dashboard-search-input-field::after\s*\{[\s\S]*?transform:\s*scaleX\(0\)/)
  assert.match(optionsCss, /\.dashboard-search-input-field:focus-within::after\s*\{[\s\S]*?transform:\s*scaleX\(1\)/)
  assert.doesNotMatch(optionsCss, /\.dashboard-search::after\s*\{/)
})

test('dashboard folder sidebar layout and active styles are defined', () => {
  const optionsCss = readProjectFile('src/options/options.css')

  assert.match(optionsCss, /\.dashboard-content-layout\s*\{/)
  assert.match(optionsCss, /\.dashboard-folder-sidebar\s*\{/)
  assert.match(optionsCss, /\.dashboard-folder-tree\s*\{/)
  assert.match(optionsCss, /\.dashboard-folder-tree[^{}]*\.(?:active|current)\s*\{/)
  assert.match(optionsCss, /\.dashboard-panel\[data-dashboard-ready="false"\]\s+\.dashboard-loading-screen\s*\{[\s\S]*?opacity:\s*1/)
  assert.match(optionsCss, /\.dashboard-panel\[data-dashboard-ready="false"\]\s+\.dashboard-results-group\s*\{[\s\S]*?opacity:\s*0[\s\S]*?visibility:\s*hidden/)
  assert.match(optionsCss, /\.dashboard-bookmark-card::before\s*\{[\s\S]*?background:\s*[\s\S]*?rgba\(18,\s*18,\s*20,\s*0\.42\)/)
  assert.doesNotMatch(optionsCss, /\.dashboard-card-grid\.is-scrolling\s+\.dashboard-bookmark-card::before/)
  assert.match(optionsCss, /\.dashboard-card-grid\.is-virtualized\s*\{[\s\S]*?overflow-anchor:\s*none/)
  assert.match(optionsCss, /\.dashboard-card-grid\s*\{[\s\S]*?scrollbar-gutter:\s*stable/)
  assert.match(
    optionsCss,
    /\.dashboard-fullscreen-active\s+\.dashboard-card-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(300px,\s*100%\),\s*1fr\)\)/
  )
  assert.match(
    optionsCss,
    /\.dashboard-fullscreen-active\s+\.dashboard-content-layout\s*\{[\s\S]*?(?:display:\s*(?:grid|flex)|grid-template-columns:)/
  )
  assert.match(
    optionsCss,
    /\.dashboard-fullscreen-active\s+\.dashboard-content-layout\s*\{[\s\S]*?(?:align-items:\s*stretch|min-height:\s*0|height:\s*100%)/
  )
})

test('dashboard fullscreen uses the compact top spacing for panel and toolbar', () => {
  const optionsCss = readProjectFile('src/options/options.css')
  const fullscreenPanelRule = getCssRuleBody(optionsCss, '.dashboard-fullscreen-active .dashboard-panel')
  const fullscreenToolbarRule = getCssRuleBody(optionsCss, '.dashboard-fullscreen-active .dashboard-toolbar')
  const panelPadding = getVerticalPadding(fullscreenPanelRule)

  assert.ok(fullscreenPanelRule, 'fullscreen dashboard panel rule should exist')
  assert.ok(fullscreenToolbarRule, 'fullscreen dashboard toolbar rule should exist')
  assert.doesNotMatch(fullscreenPanelRule, /padding:\s*26px\s+clamp\(24px,\s*3\.4vw,\s*54px\)\s+30px/)
  assert.doesNotMatch(fullscreenToolbarRule, /padding:\s*12px\s+0\s+10px/)
  assert.ok(panelPadding.top < 26, 'fullscreen dashboard panel top padding should be tighter than the old value')
  assert.match(
    optionsCss,
    /\.dashboard-fullscreen-active\s+\.dashboard-panel\s*\{[\s\S]*?display:\s*grid[\s\S]*?grid-template-areas:\s*[\s\S]*"dashboard-label"[\s\S]*"dashboard-title"[\s\S]*"dashboard-toolbar"[\s\S]*"dashboard-selection"[\s\S]*"dashboard-results"[\s\S]*?grid-template-rows:\s*auto\s+auto\s+auto\s+auto\s+minmax\(0,\s*1fr\)/
  )
  assert.match(
    optionsCss,
    /\.dashboard-fullscreen-active\s+\.dashboard-panel\s*>\s*\.detect-selection-group\s*\{[\s\S]*?grid-area:\s*dashboard-selection[\s\S]*?z-index:\s*2/
  )
  assert.match(
    optionsCss,
    /\.dashboard-fullscreen-active\s+\.dashboard-panel\s*>\s*\.dashboard-results-group\s*\{[\s\S]*?grid-area:\s*dashboard-results[\s\S]*?min-height:\s*0/
  )
  assert.match(
    optionsCss,
    /\.dashboard-fullscreen-active\s+\.dashboard-panel\s+\.dashboard-toolbar\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*640px\)[\s\S]*?justify-content:\s*center[\s\S]*?width:\s*min\(100%,\s*820px\)[\s\S]*?margin:\s*8px\s+auto\s+0/
  )
  assert.doesNotMatch(optionsCss, /\.dashboard-fullscreen-active\s+\.dashboard-panel\s+\.dashboard-toolbar\s*\{[\s\S]*?margin:\s*-52px/)
  assert.match(
    optionsCss,
    /\.dashboard-fullscreen-active\s+\.dashboard-panel\s+\.detect-selection-group\s*\{[\s\S]*?width:\s*min\(100%,\s*820px\)[\s\S]*?backdrop-filter:\s*blur/
  )
})

test('dashboard selection bar expands without display jump', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const optionsCss = readProjectFile('src/options/options.css')
  const selectionElement = optionsHtml.match(/<div[^>]+id="dashboard-selection-group"[^>]*>/)?.[0] || ''
  const collapsedRule = getCssRuleBody(optionsCss, '.dashboard-panel #dashboard-selection-group')
  const hiddenRule = getCssRuleBody(optionsCss, '.dashboard-panel #dashboard-selection-group.hidden')
  const expandedRule = getCssRuleBody(optionsCss, '.dashboard-panel #dashboard-selection-group:not(.hidden)')
  const notReadyRule = getCssRuleBody(optionsCss, '.dashboard-panel[data-dashboard-ready="false"] #dashboard-selection-group')

  assert.match(selectionElement, /class="options-group detect-selection-group hidden"/)
  assert.match(collapsedRule, /max-height:\s*0/)
  assert.match(collapsedRule, /margin-top:\s*0/)
  assert.match(collapsedRule, /overflow:\s*clip/)
  assert.match(collapsedRule, /border-color:\s*transparent/)
  assert.match(collapsedRule, /border-width:\s*0/)
  assert.match(collapsedRule, /transition:[\s\S]*max-height[\s\S]*margin-top[\s\S]*padding-top[\s\S]*opacity[\s\S]*transform/)
  assert.match(hiddenRule, /display:\s*block\s*!important/)
  assert.match(hiddenRule, /visibility:\s*hidden/)
  assert.match(expandedRule, /max-height:\s*260px/)
  assert.match(expandedRule, /border-width:\s*1px/)
  assert.match(expandedRule, /margin-top:\s*8px/)
  assert.match(expandedRule, /opacity:\s*1/)
  assert.match(notReadyRule, /visibility:\s*hidden/)
  assert.doesNotMatch(expandedRule, /animation:\s*options-reveal-enter/)
})

test('dashboard large selection motion uses transform instead of layout animation', () => {
  const optionsCss = readProjectFile('src/options/options.css')
  const shiftingRule = getCssRuleBody(optionsCss, '.dashboard-card-region.is-selection-motion-shifting')
  const settlingRule = getCssRuleBody(optionsCss, '.dashboard-card-region.is-selection-motion-settling')
  const compositeRule = getCssRuleBody(optionsCss, '.dashboard-panel[data-dashboard-selection-motion="composite"] #dashboard-selection-group')

  assert.match(shiftingRule, /transform:\s*translate3d\(0,\s*var\(--dashboard-selection-motion-shift,\s*0\),\s*0\)/)
  assert.match(shiftingRule, /transition:\s*none/)
  assert.match(shiftingRule, /will-change:\s*transform/)
  assert.match(settlingRule, /transition:\s*transform\s+260ms/)
  assert.match(settlingRule, /will-change:\s*transform/)
  assert.doesNotMatch(compositeRule, /max-height/)
  assert.doesNotMatch(compositeRule, /margin-top/)
  assert.match(compositeRule, /transition:[\s\S]*opacity[\s\S]*transform/)
})

test('dashboard tag editor and tag popover have dialog semantics and keyboard path', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const dashboardSource = readProjectFile('src/options/sections/dashboard.ts')
  const optionsSource = readProjectFile('src/options/options.ts')

  assert.match(optionsHtml, /id="dashboard-tag-editor"[^>]+role="dialog"[^>]+aria-modal="false"/)
  assert.match(optionsHtml, /id="dashboard-tag-editor"[^>]+aria-describedby="dashboard-tag-editor-help dashboard-tag-editor-status"/)
  assert.match(optionsHtml, /id="dashboard-tag-editor-status"[^>]+role="status"[^>]+aria-live="polite"[^>]+aria-atomic="true"/)
  assert.match(dashboardSource, /dashboard-tag-popover[^`]+role="dialog"[^`]+aria-modal="false"/)
  assert.match(dashboardSource, /export function handleDashboardKeydown/)
  assert.match(dashboardSource, /event\.key === 'Escape'[\s\S]*?closeDashboardTagEditor\(\)/)
  assert.match(dashboardSource, /event\.key === 'Enter'[\s\S]*?saveDashboardTagEditor\(\)/)
  assert.match(dashboardSource, /restoreDashboardTagEditorFocus/)
  assert.match(optionsSource, /addEventListener\('keydown', handleDashboardKeydown\)/)
  assert.doesNotMatch(getFunctionBody(dashboardSource, 'handleDashboardDocumentFocusIn'), /closeDashboardTagEditor\(\)/)
})

test('dashboard folder filtering exposes clickable breadcrumbs', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const dashboardSource = readProjectFile('src/options/sections/dashboard.ts')

  assert.match(optionsHtml, /id="dashboard-folder-breadcrumbs"[^>]+aria-label="当前 Dashboard 文件夹路径"/)
  assert.match(dashboardSource, /function renderDashboardFolderBreadcrumbs/)
  assert.match(dashboardSource, /data-dashboard-folder-filter="\$\{escapeAttr\(segment\.id\)\}"/)
  assert.match(dashboardSource, /aria-current="page"/)
  assert.match(dashboardSource, /function applyDashboardFolderFilter/)
  assert.match(dashboardSource, /data-dashboard-folder-filter="\$\{escapeAttr\(item\.parentId \|\| ''\)\}"/)
  assert.doesNotMatch(dashboardSource, />全部书签<\/button>/)
})

test('availability, redirect and AI result lists render paginated controls', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const optionsSource = readProjectFile('src/options/options.ts')
  const redirectsSource = readProjectFile('src/options/sections/redirects.ts')

  for (const id of [
    'availability-review-pagination',
    'availability-failed-pagination',
    'ai-results-pagination',
    'redirect-pagination'
  ]) {
    assert.match(optionsHtml, new RegExp(`id="${id}"`))
  }

  assert.match(optionsSource, /const RESULTS_PAGE_SIZE = 25/)
  assert.match(optionsSource, /getPaginatedResults\('availability-review', panelResults\)/)
  assert.match(optionsSource, /getPaginatedResults\('availability-failed', panelResults\)/)
  assert.match(optionsSource, /getPaginatedResults\('ai-results', visibleResults\)/)
  assert.match(redirectsSource, /const REDIRECT_RESULTS_PAGE_SIZE = 25/)
  assert.match(redirectsSource, /getRedirectPageResults\(redirectResults\)/)
})

test('duplicate decisions expose explicit keep strategies and recycle wording', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const duplicateSource = readProjectFile('src/options/sections/duplicates.ts')

  assert.match(optionsHtml, /data-duplicate-strategy="recommended"/)
  assert.match(optionsHtml, /data-duplicate-strategy="newest"/)
  assert.match(optionsHtml, /data-duplicate-strategy="oldest"/)
  assert.match(optionsHtml, /data-duplicate-strategy="shorter-path"/)
  assert.match(optionsHtml, /data-duplicate-strategy="tagged"/)
  assert.match(optionsHtml, /data-duplicate-strategy="newtab-source"/)
  assert.match(optionsHtml, /data-duplicate-strategy="recent"/)
  assert.match(duplicateSource, /duplicate-recommendation-signals/)
  assert.match(duplicateSource, /有手动标签/)
  assert.match(duplicateSource, /新标签页来源/)
  assert.match(duplicateSource, /最近访问/)
  assert.doesNotMatch(duplicateSource, />\\s*删除所选\\s*</)
})

test('broken-link guidance explains confidence levels and redirect handling', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const optionsSource = readProjectFile('src/options/options.ts')
  const redirectsSource = readProjectFile('src/options/sections/redirects.ts')

  assert.match(optionsHtml, /决策面板/)
  assert.match(optionsHtml, /高置信/)
  assert.match(optionsHtml, /低置信 \/ 待确认/)
  assert.match(optionsHtml, /重定向/)
  assert.match(optionsSource, /getAvailabilityResultRecommendation/)
  assert.match(redirectsSource, /更新前会重新读取书签/)
})

test('availability results expose decision filters and single-item ignore actions', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const optionsSource = readProjectFile('src/options/options.ts')

  for (const filter of [
    'all',
    'failed',
    'review',
    'redirected',
    'new',
    'persistent',
    'recovered',
    'ignored'
  ]) {
    assert.match(optionsHtml, new RegExp(`data-availability-filter="${filter}"`))
  }

  assert.match(optionsHtml, /availability-decision-new/)
  assert.match(optionsHtml, /availability-decision-persistent/)
  assert.match(optionsHtml, /availability-decision-recovered/)
  assert.match(optionsHtml, /availability-decision-ignored/)
  assert.match(optionsSource, /data-availability-result-action="\$\{escapeAttr\(action\)\}"/)
  assert.match(optionsSource, /ignoreSingleAvailabilityResult/)
  assert.match(optionsSource, /addAvailabilityIgnoreRule/)
  assert.match(optionsSource, /本次隐藏/)
  assert.match(optionsSource, /忽略此书签/)
  assert.match(optionsSource, /忽略此域名/)
  assert.match(optionsSource, /忽略此文件夹/)
  assert.match(optionsSource, /以后不再检测/)
  assert.match(optionsSource, /getAvailabilityEvidenceSummary/)
  assert.match(optionsSource, /连续异常/)
})

test('availability decision panel replaces duplicate summary metric cards', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const optionsSource = readProjectFile('src/options/options.ts')

  assert.match(optionsHtml, /class="availability-decision-panel"/)
  assert.match(optionsHtml, /class="availability-decision-panel"[\s\S]*?class="decision-progress-row"[\s\S]*?id="availability-progress-text"[\s\S]*?id="availability-progress-bar"[\s\S]*?id="availability-status-copy"/)
  assert.doesNotMatch(optionsHtml, /id="availability-total"/)
  assert.doesNotMatch(optionsHtml, /id="availability-eligible"/)
  assert.doesNotMatch(optionsHtml, /id="availability-available"/)
  assert.doesNotMatch(optionsHtml, /id="availability-skipped"/)
  assert.doesNotMatch(optionsHtml, /class="detect-progress-card"[\s\S]*?id="availability-progress-text"/)
  assert.doesNotMatch(optionsSource, /dom\.availabilityTotal/)
  assert.doesNotMatch(optionsSource, /dom\.availabilityEligible/)
  assert.doesNotMatch(optionsSource, /dom\.availabilitySkipped/)
})

test('availability duration ticks independently while a run is active', () => {
  const optionsSource = readProjectFile('src/options/options.ts')

  assert.match(optionsSource, /let availabilityDurationTimer = 0/)
  assert.match(optionsSource, /window\.setInterval\(updateAvailabilityDurationDisplay, 1000\)/)
  assert.match(optionsSource, /syncAvailabilityDurationTimer\(\)/)
  assert.match(optionsSource, /clearAvailabilityDurationTimer\(\)/)
})

test('availability toolbar exposes detection settings instead of summary copy', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const optionsSource = readProjectFile('src/options/options.ts')
  const domSource = readProjectFile('src/options/shared-options/dom.ts')

  assert.doesNotMatch(optionsHtml, /availability-copy-summary|复制摘要|复制概览/)
  assert.match(optionsHtml, /id="availability-settings-trigger"[^>]*>[\s\S]*?检测设置/)
  assert.match(optionsHtml, /id="availability-settings-popover"[^>]+role="dialog"/)
  assert.match(optionsHtml, /id="availability-concurrency-input"/)
  assert.match(optionsHtml, /id="availability-timeout-input"/)
  assert.match(domSource, /availabilitySettingsTrigger/)
  assert.match(optionsSource, /saveAvailabilitySettingsFromDom/)
  assert.match(optionsSource, /STORAGE_KEYS\.availabilitySettings/)
})

test('availability management links are grouped under a collapsible sidebar title', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const optionsSource = readProjectFile('src/options/options.ts')
  const optionsCss = readProjectFile('src/options/options.css')

  assert.match(optionsHtml, /data-nav-group="availability-tools"/)
  assert.match(optionsHtml, /data-nav-group-trigger="availability-tools"[\s\S]*?可用性管理/)
  assert.match(optionsHtml, /aria-expanded="false"/)
  assert.match(optionsHtml, /id="availability-tools-nav"[\s\S]*?hidden/)
  assert.match(optionsHtml, /data-nav-group-panel="availability-tools"[\s\S]*?data-section-link="availability"[\s\S]*?data-section-link="history"[\s\S]*?data-section-link="redirects"[\s\S]*?data-section-link="ignore"/)
  assert.match(optionsSource, /COLLAPSIBLE_NAV_GROUP_SECTIONS/)
  assert.match(optionsSource, /new Set\(\['availability', 'history', 'redirects', 'ignore'\]\)/)
  assert.match(optionsSource, /function syncCollapsibleNavGroups/)
  assert.match(optionsSource, /function handleCollapsibleNavGroupClick/)
  assert.match(optionsCss, /\.options-nav-sublist/)
  assert.match(optionsCss, /\.options-nav-group-caret/)
})

test('smart bookmark analysis uses the decision panel summary layout', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const optionsSource = readProjectFile('src/options/options.ts')
  const domSource = readProjectFile('src/options/shared-options/dom.ts')
  const optionsCss = readProjectFile('src/options/options.css')

  assert.match(optionsHtml, /class="availability-decision-panel ai-decision-panel"[^>]+aria-label="书签智能分析决策概览"/)
  assert.match(optionsHtml, /id="ai-decision-status"[^>]*>未开始/)
  assert.match(optionsHtml, /class="availability-decision-panel ai-decision-panel"[\s\S]*?class="decision-progress-row"[\s\S]*?id="ai-progress-text"[\s\S]*?id="ai-progress-bar"[\s\S]*?id="ai-progress-copy"/)
  assert.match(optionsHtml, /class="availability-decision-grid ai-decision-grid"[\s\S]*?id="ai-eligible"[\s\S]*?id="ai-suggested"[\s\S]*?id="ai-manual-review"[\s\S]*?id="ai-unchanged"[\s\S]*?id="ai-high-confidence"[\s\S]*?id="ai-medium-confidence"[\s\S]*?id="ai-low-confidence"[\s\S]*?id="ai-failed"/)
  assert.doesNotMatch(optionsHtml, /<article class="summary-card metric-card[\s\S]*?id="ai-eligible"/)
  assert.doesNotMatch(optionsHtml, /class="detect-progress-card"[\s\S]*?id="ai-progress-text"/)
  assert.match(domSource, /aiDecisionStatus/)
  assert.match(optionsSource, /let aiNamingDurationTimer = 0/)
  assert.match(optionsSource, /function getAiNamingDurationLabel/)
  assert.match(optionsSource, /dom\.aiDecisionStatus\.textContent = getAiNamingDurationLabel\(\)/)
  assert.match(optionsSource, /window\.setInterval\(updateAiNamingDurationDisplay, 1000\)/)
  assert.match(optionsSource, /syncAiNamingDurationTimer\(\)/)
  assert.match(optionsSource, /clearAiNamingDurationTimer\(\)/)
  assert.match(optionsCss, /\.ai-decision-grid/)
})

test('smart bookmark analysis result actions expose bookmark-specific labels', () => {
  const optionsSource = readProjectFile('src/options/options.ts')

  assert.match(optionsSource, /function getAiNamingResultActionLabel\(action, result\)/)
  assert.match(optionsSource, /const selectionLabel = getAiNamingResultActionLabel\([\s\S]*?选择书签智能分析建议/)
  assert.match(optionsSource, /const openLabel = getAiNamingResultActionLabel\('打开书签页面', result\)/)
  assert.match(optionsSource, /const applyLabel = getAiNamingResultActionLabel\('应用书签智能分析建议', result\)/)
  assert.match(optionsSource, /const moveLabel = getAiNamingResultActionLabel\('移动至推荐文件夹', result\)/)
  assert.match(optionsSource, /data-ai-select="\$\{escapeAttr\(result\.id\)\}"[\s\S]*?aria-label="\$\{escapeAttr\(selectionLabel\)\}"/)
  assert.match(optionsSource, /data-ai-move-recommended="\$\{escapeAttr\(result\.id\)\}"[\s\S]*?aria-label="\$\{escapeAttr\(moveLabel\)\}"/)
  assert.match(optionsSource, /<a class="detect-result-open"[\s\S]*?aria-label="\$\{escapeAttr\(openLabel\)\}"/)
  assert.match(optionsSource, /data-ai-apply="\$\{escapeAttr\(result\.id\)\}"[\s\S]*?aria-label="\$\{escapeAttr\(applyLabel\)\}"/)
})

test('availability checks use adaptive runner with user settings', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const optionsSource = readProjectFile('src/options/options.ts')
  const runnerSource = readProjectFile('src/options/sections/availability-runner.ts')

  assert.match(optionsSource, /createAvailabilityRunScheduler/)
  assert.match(optionsSource, /buildAvailabilityProfileFromUserSettings\(availabilityState\.settings\)/)
  assert.match(optionsSource, /runAvailabilityQueue/)
  assert.match(optionsSource, /inspectBookmarkAvailability\(bookmark, \{ probeEnabled, scheduler \}\)/)
  assert.match(optionsSource, /fetchWithTimeout\(url, 'HEAD', timeoutMs\)/)
  assert.match(runnerSource, /domainConcurrency: 1/)
  assert.match(runnerSource, /statusCode === 429/)
  assert.doesNotMatch(optionsHtml, /availability-speed-profile|速度档位/)
})

test('redirect update rereads current bookmarks and skips stale source URLs', () => {
  const redirectsSource = readProjectFile('src/options/sections/redirects.ts')

  assert.match(redirectsSource, /getBookmarkTree/)
  assert.match(redirectsSource, /extractBookmarkData\(rootNode\)\.bookmarks/)
  assert.match(redirectsSource, /latestBookmarkMap\.get\(String\(result\.id\)\)/)
  assert.match(redirectsSource, /String\(latestBookmark\.url\) !== String\(result\.url \|\| ''\)/)
  assert.match(redirectsSource, /await updateBookmark\(result\.id, \{ url: finalUrl \}\)/)
})

test('redirect result actions expose bookmark-specific labels', () => {
  const redirectsSource = readProjectFile('src/options/sections/redirects.ts')

  assert.match(redirectsSource, /function getRedirectResultActionLabel\(action, result\)/)
  assert.match(redirectsSource, /const selectionLabel = getRedirectResultActionLabel\('选择重定向书签', result\)/)
  assert.match(redirectsSource, /const updateLabel = getRedirectResultActionLabel\('更新为最终 URL', result\)/)
  assert.match(redirectsSource, /const openFinalLabel = getRedirectResultActionLabel\('打开最终链接', result\)/)
  assert.match(redirectsSource, /data-bookmark-id="\$\{escapeAttr\(result\.id\)\}"[\s\S]*?aria-label="\$\{escapeAttr\(selectionLabel\)\}"/)
  assert.match(redirectsSource, /data-redirect-update="\$\{escapeAttr\(result\.id\)\}"[\s\S]*?aria-label="\$\{escapeAttr\(updateLabel\)\}"/)
  assert.match(redirectsSource, /<a class="detect-result-open"[\s\S]*?aria-label="\$\{escapeAttr\(openFinalLabel\)\}"/)
})
