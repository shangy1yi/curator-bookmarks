import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

import {
  buildNewTabPortalOverview,
  buildNewTabSourceNavigationItems,
  collectPortalBookmarkSourceItems,
  getNewTabSourceAnchorId,
  getPortalQuickAccessItems,
  resolvePortalPanelLayout,
  getAdaptiveSearchOffsetBounds,
  getAdaptiveSearchWidthBounds,
  getVerticalCenterCollisionOffset
} from '../src/newtab/content-state.js'

function readProjectFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function getCssRuleBody(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))
  return match?.[1] || ''
}

function getCssRuleBodies(css: string, selector: string): string[] {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return [...css.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'g'))].map((match) => match[1] || '')
}

function getFunctionBody(source: string, functionName: string): string {
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

test('does not offset vertically centered icons when utility stack has enough clearance', () => {
  assert.equal(getVerticalCenterCollisionOffset({
    utilityBottom: 120,
    contentTop: 132
  }), 0)
})

test('offsets vertically centered icons only enough to clear the utility stack', () => {
  assert.equal(getVerticalCenterCollisionOffset({
    utilityBottom: 160,
    contentTop: 140
  }), 32)
})

test('supports custom minimum clearance for compact viewports', () => {
  assert.equal(getVerticalCenterCollisionOffset({
    utilityBottom: 160,
    contentTop: 140,
    minimumGap: 4
  }), 24)
})

test('adaptive newtab search offset expands into real empty layout space', () => {
  assert.deepEqual(getAdaptiveSearchOffsetBounds({
    currentOffsetY: 0,
    searchTop: 100,
    searchBottom: 134,
    viewportTop: 20,
    viewportBottom: 720,
    previousModuleBottom: 74,
    primaryContentTop: 430
  }), {
    min: -14,
    max: 240
  })
})

test('adaptive newtab search offset keeps the input between neighboring modules', () => {
  assert.deepEqual(getAdaptiveSearchOffsetBounds({
    currentOffsetY: 40,
    searchTop: 140,
    searchBottom: 174,
    viewportTop: 20,
    viewportBottom: 420,
    previousModuleBottom: 132,
    primaryContentTop: 210
  }), {
    min: 44,
    max: 64
  })
})

test('adaptive newtab search offset clamps saved positions away from centered bookmarks', () => {
  assert.deepEqual(getAdaptiveSearchOffsetBounds({
    currentOffsetY: 160,
    searchTop: 260,
    searchBottom: 294,
    viewportTop: 20,
    viewportBottom: 720,
    previousModuleBottom: 74,
    primaryContentTop: 230
  }), {
    min: -14,
    max: 84
  })
})

test('adaptive newtab search offset keeps a usable range in overconstrained layouts', () => {
  assert.deepEqual(getAdaptiveSearchOffsetBounds({
    currentOffsetY: 80,
    searchTop: 190,
    searchBottom: 224,
    viewportTop: 20,
    viewportBottom: 230,
    previousModuleBottom: 210,
    primaryContentTop: 205
  }), {
    min: 68,
    max: 92
  })
})

test('adaptive newtab search width removes dead range past the available slot width', () => {
  assert.deepEqual(getAdaptiveSearchWidthBounds({
    viewportWidth: 1280,
    containerWidth: 540
  }), {
    min: 16,
    max: 42
  })
})

test('adaptive newtab search width keeps enough range for the minimum pixel width', () => {
  assert.deepEqual(getAdaptiveSearchWidthBounds({
    viewportWidth: 390,
    containerWidth: 180
  }), {
    min: 16,
    max: 57
  })
})

test('builds a compact newtab portal overview from folders and activity', () => {
  const now = new Date('2026-05-02T10:30:00+08:00').getTime()
  const today = new Date('2026-05-02T09:00:00+08:00').getTime()
  const yesterday = new Date('2026-05-01T20:00:00+08:00').getTime()

  const overview = buildNewTabPortalOverview({
    now,
    sections: [
      {
        title: '工作',
        path: '书签栏 / 工作',
        bookmarks: [
          { id: '1', title: 'React', url: 'https://example.com/react', dateAdded: today },
          { id: '2', title: 'Docs', url: 'https://example.com/docs', dateAdded: yesterday }
        ]
      },
      {
        title: '设计',
        path: '书签栏 / 设计',
        bookmarks: [
          { id: '3', title: 'Tokens', url: 'https://example.com/tokens', dateAdded: today }
        ]
      }
    ],
    activityRecords: {
      1: { bookmarkId: '1', openCount: 2, lastOpenedAt: today },
      2: { bookmarkId: '2', openCount: 1, lastOpenedAt: yesterday },
      9: { bookmarkId: '9', openCount: 4, lastOpenedAt: today }
    }
  })

  assert.deepEqual(overview, {
    bookmarkCount: 3,
    folderCount: 2,
    openedTodayCount: 1,
    addedTodayCount: 2
  })
})

test('selects portal quick access items without duplicating frequent and recent entries', () => {
  const now = new Date('2026-05-02T10:30:00+08:00').getTime()
  const oneHourAgo = now - 60 * 60 * 1000
  const twoHoursAgo = now - 2 * 60 * 60 * 1000
  const yesterday = now - 24 * 60 * 60 * 1000

  const quickAccess = getPortalQuickAccessItems({
    now,
    itemLimit: 2,
    showFrequent: true,
    showRecent: true,
    pinnedIds: ['3', 'missing'],
    bookmarks: [
      { id: '1', title: 'React', url: 'https://example.com/react', dateAdded: yesterday },
      { id: '2', title: 'Docs', url: 'https://example.com/docs', dateAdded: twoHoursAgo },
      { id: '3', title: 'Tokens', url: 'https://example.com/tokens', dateAdded: oneHourAgo },
      { id: '4', title: 'Empty', url: '' }
    ],
    records: {
      1: { bookmarkId: '1', openCount: 5, lastOpenedAt: yesterday },
      2: { bookmarkId: '2', openCount: 1, lastOpenedAt: oneHourAgo },
      3: { bookmarkId: '3', openCount: 3, lastOpenedAt: twoHoursAgo },
      4: { bookmarkId: '4', openCount: 8, lastOpenedAt: oneHourAgo }
    }
  })

  assert.deepEqual(
    quickAccess.frequentItems.map((item) => ({
      id: item.id,
      reason: item.reason,
      badge: item.badge,
      detail: item.detail
    })),
    [
      { id: '3', reason: 'pinned', badge: '固', detail: '已固定' },
      { id: '1', reason: 'frequent', badge: '常', detail: '打开 5 次' }
    ]
  )
  assert.deepEqual(
    quickAccess.recentItems.map((item) => ({
      id: item.id,
      reason: item.reason,
      badge: item.badge
    })),
    [
      { id: '2', reason: 'added', badge: '新' }
    ]
  )
})

test('newtab recent quick access excludes recently opened bookmarks', () => {
  const now = new Date('2026-05-02T10:30:00+08:00').getTime()
  const oneHourAgo = now - 60 * 60 * 1000
  const twoHoursAgo = now - 2 * 60 * 60 * 1000
  const yesterday = now - 24 * 60 * 60 * 1000

  const quickAccess = getPortalQuickAccessItems({
    now,
    itemLimit: 2,
    showFrequent: false,
    showRecent: true,
    pinnedIds: [],
    bookmarks: [
      { id: '1', title: 'Opened Only', url: 'https://example.com/opened', dateAdded: yesterday },
      { id: '2', title: 'Newer Added', url: 'https://example.com/newer', dateAdded: oneHourAgo },
      { id: '3', title: 'Older Added', url: 'https://example.com/older', dateAdded: twoHoursAgo }
    ],
    records: {
      1: { bookmarkId: '1', openCount: 12, lastOpenedAt: now },
      3: { bookmarkId: '3', openCount: 1, lastOpenedAt: oneHourAgo }
    }
  })

  assert.deepEqual(
    quickAccess.recentItems.map((item) => ({
      id: item.id,
      reason: item.reason,
      badge: item.badge
    })),
    [
      { id: '2', reason: 'added', badge: '新' },
      { id: '3', reason: 'added', badge: '新' }
    ]
  )
})

test('builds portal quick access from the full bookmark tree, not only visible sections', () => {
  const now = new Date('2026-05-02T10:30:00+08:00').getTime()
  const visibleTime = now - 3 * 60 * 60 * 1000
  const hiddenTime = now - 60 * 60 * 1000
  const bookmarks = collectPortalBookmarkSourceItems({
    id: '0',
    title: '',
    children: [
      {
        id: '10',
        title: '标签页',
        children: [
          { id: '11', title: 'Visible', url: 'https://example.com/visible', dateAdded: visibleTime }
        ]
      },
      {
        id: '20',
        title: '其他书签',
        children: [
          { id: '21', title: 'Hidden', url: 'https://example.com/hidden', dateAdded: hiddenTime }
        ]
      }
    ]
  })

  const quickAccess = getPortalQuickAccessItems({
    now,
    itemLimit: 2,
    showFrequent: false,
    showRecent: true,
    pinnedIds: [],
    bookmarks,
    records: {}
  })

  assert.deepEqual(
    quickAccess.recentItems.map((item) => item.id),
    ['21', '11']
  )
})

test('resolves portal layout from overview and quick access visibility', () => {
  assert.equal(resolvePortalPanelLayout({
    showOverview: true,
    hasOverviewSignal: true,
    hasQuickAccess: true
  }), 'full')
  assert.equal(resolvePortalPanelLayout({
    showOverview: true,
    hasOverviewSignal: true,
    hasQuickAccess: false
  }), 'overview-only')
  assert.equal(resolvePortalPanelLayout({
    showOverview: false,
    hasOverviewSignal: true,
    hasQuickAccess: true
  }), 'quick-only')
  assert.equal(resolvePortalPanelLayout({
    showOverview: false,
    hasOverviewSignal: true,
    hasQuickAccess: false
  }), 'hidden')
})

test('newtab settings expose one combined local quick access switch', () => {
  const html = readProjectFile('src/newtab/newtab.html')

  assert.match(html, /显示 Curator 常用和新近添加/)
  assert.match(html, /仅基于当前来源内的固定、本页打开记录和添加时间，不读取浏览历史。/)
  assert.match(html, /id="general-show-quick-access"/)
  assert.doesNotMatch(html, /id="general-show-frequent"/)
  assert.doesNotMatch(html, /id="general-show-recent"/)
})

test('newtab modernized bookmark modules are visible and settings-controlled', () => {
  const html = readProjectFile('src/newtab/newtab.html')
  const script = readProjectFile('src/newtab/newtab.ts')
  const css = readProjectFile('src/newtab/newtab.css')

  assert.match(html, /id="settings-workspaces-title"/)
  assert.match(html, /id="workspace-settings-list"/)
  assert.match(html, /id="newtab-speed-dial-setting"/)
  assert.match(html, /id="newtab-health-setting"/)
  assert.doesNotMatch(html, /模块与隐私/)
  assert.doesNotMatch(html, /快捷提示/)
  assert.doesNotMatch(html, /隐私说明/)
  assert.match(script, /STORAGE_KEYS\.newTabWorkspaceSettings/)
  assert.match(script, /STORAGE_KEYS\.newTabModuleSettings/)
  assert.match(script, /createWorkspaceSwitcher\(\)/)
  assert.match(script, /createSpeedDialPanel\(\)/)
  assert.match(script, /createBookmarkHealthPanel\(\)/)
  assert.match(script, /createCommandPaletteOverlay\(\)/)
  assert.match(css, /\.newtab-speed-dial,[\s\S]*?\.newtab-bookmark-health\s*\{/)
  assert.match(css, /\.newtab-command-palette\s*\{/)
  assert.doesNotMatch(script, /createCommandHintBar\(\)/)
})

test('newtab pinning uses active workspace instead of legacy activity pins', () => {
  const script = readProjectFile('src/newtab/newtab.ts')
  const toggleBody = getFunctionBody(script, 'toggleActiveMenuBookmarkPin')
  const quickAccessBody = getFunctionBody(script, 'createQuickAccessPanel')

  assert.match(toggleBody, /toggleNewTabWorkspacePin\(/)
  assert.match(toggleBody, /await saveNewTabWorkspaceSettings\(\)/)
  assert.doesNotMatch(toggleBody, /await saveNewTabActivity\(\)/)
  assert.match(quickAccessBody, /pinnedIds:\s*getActiveWorkspacePinnedIds\(\)/)
})

test('newtab general settings expose bookmark new tab opening independently from search', () => {
  const html = readProjectFile('src/newtab/newtab.html')
  const source = readProjectFile('src/newtab/newtab.ts')

  assert.match(html, /id="general-open-bookmarks-new-tab"/)
  assert.match(html, /新标签页打开/)
  assert.match(source, /openBookmarksInNewTab:\s*false/)
  assert.match(source, /document\s*\n\s*\.getElementById\('general-open-bookmarks-new-tab'\)/)
  assert.match(source, /openBookmarksInNewTab:\s*settings\.openBookmarksInNewTab === true/)
  assert.match(source, /state\.generalSettings\.openBookmarksInNewTab/)
  assert.match(source, /window\.open\(url,\s*'_blank',\s*'noopener'\)/)
})

test('newtab search settings use Google as the default engine without duplicate default entry', () => {
  const html = readProjectFile('src/newtab/newtab.html')
  const source = readProjectFile('src/newtab/newtab.ts')

  assert.doesNotMatch(html, /value="default"/)
  assert.doesNotMatch(html, /data-search-engine-toggle="default"/)
  assert.match(source, /engine:\s*'google'\s+as SearchEngineId/)
})

test('newtab search background opacity exposes a wide direct alpha range', () => {
  const html = readProjectFile('src/newtab/newtab.html')
  const css = readProjectFile('src/newtab/newtab.css')
  const source = readProjectFile('src/newtab/newtab.ts')
  const backgroundInput = html.match(/<input[^>]+id="search-background"[^>]*>/)?.[0] || ''

  assert.match(backgroundInput, /min="0"/)
  assert.match(backgroundInput, /max="92"/)
  assert.match(source, /background:\s*clampNumber\(settings\.background,\s*0,\s*92,\s*DEFAULT_SEARCH_SETTINGS\.background\)/)
  assert.match(css, /background:\s*rgba\(8,\s*8,\s*9,\s*var\(--search-bg-alpha\)\)/)
  assert.doesNotMatch(css, /var\(--search-bg-alpha\)\s*\+\s*0\.24/)
})

test('newtab search vertical offset uses adaptive runtime bounds', () => {
  const html = readProjectFile('src/newtab/newtab.html')
  const css = readProjectFile('src/newtab/newtab.css')
  const source = readProjectFile('src/newtab/newtab.ts')
  const offsetInput = html.match(/<input[^>]+id="search-offset-y"[^>]*>/)?.[0] || ''

  assert.match(offsetInput, /min="-240"/)
  assert.match(offsetInput, /max="240"/)
  assert.match(css, /margin-top:\s*var\(--search-offset-y\)/)
  assert.doesNotMatch(css, /margin-top:\s*max\(var\(--search-offset-y\)/)
  assert.doesNotMatch(getCssRuleBody(css, '.newtab-search-slot'), /transition:\s*margin-top/)
  assert.match(source, /getAdaptiveSearchOffsetBounds\(/)
  assert.match(source, /getAdaptiveSearchWidthBounds\(/)
  assert.match(source, /offsetY:\s*clampNumber\(\s*settings\.offsetY,\s*SEARCH_OFFSET_ABSOLUTE_MIN,\s*SEARCH_OFFSET_ABSOLUTE_MAX,\s*DEFAULT_SEARCH_SETTINGS\.offsetY\s*\)/)
  assert.match(source, /document\.getElementById\('search-offset-y'\)\?\.addEventListener\('input', handleSearchSettingsPreview\)/)
  assert.match(source, /function applySearchSettingsLive\(\): void/)
  assert.match(source, /slot\?\.style\.setProperty\('--search-offset-y'/)
  assert.match(source, /function scheduleSearchSettingsSettle\(\): void/)
  assert.match(source, /document\.getElementById\('search-offset-y'\)\?\.addEventListener\('change', handleSearchSettingsCommit\)/)
  assert.match(source, /widthInput\.max\s*=\s*String\(bounds\.max\)/)
  assert.match(source, /offsetYInput\.min\s*=\s*String\(bounds\.min\)/)
  assert.match(source, /offsetYInput\.max\s*=\s*String\(bounds\.max\)/)
  const previewBody = source.match(/function handleSearchSettingsPreview\(\): void \{([\s\S]*?)\n\}/)?.[1] || ''
  assert.doesNotMatch(previewBody, /scheduleRender/)
})

test('newtab search width setting controls the actual form and overlay width', () => {
  const css = readProjectFile('src/newtab/newtab.css')
  const html = readProjectFile('src/newtab/newtab.html')
  const source = readProjectFile('src/newtab/newtab.ts')

  assert.match(source, /width:\s*34/)
  assert.match(html, /id="search-width-value"[^>]*>34vw<\/output>/)
  assert.match(html, /id="search-width"[^>]*value="34"/)
  assert.match(css, /--search-width:\s*34vw/)
  assert.match(css, /--search-effective-width:\s*min\(max\(220px,\s*var\(--search-width\)\),\s*100%\)/)
  assert.match(css, /\.newtab-search-slot\s*\{[\s\S]*?width:\s*100%/)
  assert.match(css, /\.newtab-search\s*\{[\s\S]*?width:\s*var\(--search-effective-width\)/)
  assert.match(css, /\.newtab-search-suggestions-panel\s*\{[\s\S]*?width:\s*var\(--search-effective-width\)/)
  assert.match(css, /\.newtab-search-engine-menu\s*\{[\s\S]*?var\(--search-effective-width\)/)
  assert.doesNotMatch(css, /min\(max\(220px,\s*var\(--search-width\)\),\s*540px,\s*100%\)/)
  assert.doesNotMatch(css, /min\(860px,\s*100%\)/)
})

test('newtab exposes a lazy options dashboard iframe route', () => {
  const html = readProjectFile('src/newtab/newtab.html')
  const script = readProjectFile('src/newtab/newtab.ts')
  const dashboardTrigger = html.match(/<a[\s\S]*?id="newtab-dashboard-trigger"[\s\S]*?<\/a>/)?.[0] || ''
  const dashboardOverlay = html.match(/<[a-z]+[\s\S]*?id="newtab-dashboard-overlay"[\s\S]*?>/)?.[0] || ''
  const dashboardFrame = html.match(/<iframe[\s\S]*?id="newtab-dashboard-frame"[\s\S]*?>/)?.[0] || ''

  assert.match(dashboardTrigger, /href="#dashboard"/)
  assert.match(dashboardTrigger, /aria-controls="newtab-dashboard-overlay"/)
  assert.match(dashboardTrigger, />\s*打开书签仪表盘\s*<\/span>/)
  assert.match(dashboardOverlay, /\bhidden\b/)
  assert.match(dashboardOverlay, /role="dialog"/)
  assert.match(dashboardOverlay, /aria-modal="true"/)
  assert.match(dashboardOverlay, /aria-hidden="true"/)
  assert.match(dashboardOverlay, /tabindex="-1"/)
  assert.match(dashboardOverlay, /data-dashboard-ready="false"/)
  assert.match(dashboardOverlay, /data-dashboard-error="false"/)
  assert.doesNotMatch(html, /id="newtab-dashboard-close"/)
  assert.match(html, /class="newtab-dashboard-loading"/)
  assert.match(html, /id="newtab-dashboard-fallback"/)
  assert.match(html, /role="alert"/)
  assert.match(html, /data-dashboard-fallback-action="return"[\s\S]*?>返回新标签页<\/button>/)
  assert.match(html, /data-dashboard-fallback-action="retry"[\s\S]*?>重试<\/button>/)
  assert.match(dashboardFrame, /loading="lazy"/)
  assert.match(dashboardFrame, /title="书签仪表盘"/)
  assert.match(dashboardFrame, /tabindex="0"/)
  assert.doesNotMatch(html, /data-newtab-dashboard-root/)

  assert.ok(
    /NEWTAB_DASHBOARD_EMBED_PATH/.test(script) ||
      /options\.html\?embed=newtab-dashboard#dashboard/.test(script),
    'newtab should point the iframe at the embedded options dashboard route'
  )
  assert.match(script, /chrome\.runtime\.getURL\(/)
  assert.match(script, /window\.location\.hash === '#dashboard'/)
  assert.match(script, /addEventListener\(['"]message['"][\s\S]*curator:newtab-dashboard-close/)
  assert.doesNotMatch(script, /dashboardClose\?\.addEventListener\('click', closeDashboardRoute\)/)
  assert.match(script, /curator:newtab-dashboard-ready/)
  assert.match(script, /dashboardFrameReady/)
  assert.match(script, /DASHBOARD_FRAME_READY_TIMEOUT_MS/)
  assert.match(script, /scheduleDashboardFrameReadyTimeout/)
  assert.match(script, /setDashboardFrameError\('书签仪表盘加载耗时过长。你可以返回新标签页，或重试打开仪表盘。'\)/)
  assert.match(script, /data-dashboard-fallback-action/)
  assert.match(script, /function retryDashboardFrame\(\): void/)
  assert.match(script, /dashboardFrame\.removeAttribute\('src'\)/)
  assert.match(script, /dashboardOverlay\.dataset\.dashboardReady/)
  assert.match(script, /dashboardOverlay\.dataset\.dashboardError/)
  assert.match(script, /dashboardReturnFocusTarget/)
  assert.match(script, /function focusDashboardOverlay\(\): void/)
  assert.match(script, /dashboardFrame\.focus\(\)/)
  assert.match(script, /function restoreDashboardFocus\(\): void/)

  for (const pattern of [
    /buildDashboardPanel/,
    /createDashboardBookmarkCard/,
    /renderDashboardFolderSidebar/,
    /applyDashboardFolderFilter/,
    /renderDashboardCardWindow/,
    /dashboard-performance/,
    /createDashboardFaviconWarmupQueue/,
    /getDashboardVirtualWindow/,
    /buildDashboardModel/,
    /filterDashboardItems/,
    /sortDashboardItems/
  ]) {
    assert.doesNotMatch(script, pattern)
  }
})

test('newtab explains empty folder source selection without changing bookmarks', () => {
  const html = readProjectFile('src/newtab/newtab.html')
  const contentState = readProjectFile('src/newtab/content-state.ts')
  const script = readProjectFile('src/newtab/newtab.ts')

  assert.match(html, /id="folder-selected-list"/)
  assert.match(contentState, /当前没有显示来源/)
  assert.match(contentState, /没有找到可直接展示的非空文件夹。你可以选择已有来源，或新建专用文件夹后添加书签。/)
  assert.match(contentState, /选择现有来源/)
  assert.match(script, /未选择来源文件夹。选择来源只会决定新标签页显示哪些书签，不会移动、删除或重排原有书签。/)
  assert.match(script, /removeLabel = `从新标签页移除/)
  assert.match(script, /不会删除书签/)
})

test('newtab does not duplicate options dashboard markup or card semantics', () => {
  const html = readProjectFile('src/newtab/newtab.html')
  const script = readProjectFile('src/newtab/newtab.ts')

  assert.doesNotMatch(html, /class="options-panel dashboard-panel"/)
  assert.doesNotMatch(html, /id="newtab-dashboard"[\s\S]*data-newtab-dashboard-root/)

  for (const className of [
    'options-section-label',
    'options-group dashboard-toolbar',
    'options-search dashboard-search',
    'options-search-input',
    'options-button secondary small',
    'dashboard-panel',
    'dashboard-title-row',
    'dashboard-toolbar',
    'dashboard-content-layout',
    'dashboard-folder-sidebar',
    'dashboard-folder-tree',
    'dashboard-search',
    'dashboard-card-grid',
    'dashboard-bookmark-card'
  ]) {
    assert.doesNotMatch(script, new RegExp(className))
  }

  assert.doesNotMatch(script, /Visual Bookmark Management/)
  assert.doesNotMatch(script, /全部书签/)
  assert.doesNotMatch(script, /detect-result-open/)
  assert.doesNotMatch(script, /detect-result-action/)
})

test('newtab boots with a wallpaper loading guard before app content is shown', () => {
  const html = readProjectFile('src/newtab/newtab.html')
  const css = readProjectFile('src/newtab/newtab.css')
  const script = readProjectFile('src/newtab/newtab.ts')

  assert.match(html, /<html lang="zh-CN" class="loading-wallpaper newtab-booting">/)
  assert.match(css, /--wallpaper-placeholder-bg: #000000/)
  assert.match(css, /html\.loading-wallpaper \.newtab-shell/)
  assert.match(css, /visibility: hidden/)
  assert.match(script, /const backgroundPreloadPromise = preloadBackgroundSettings\(\)/)
  assert.match(script, /function markWallpaperReady\(\): void/)
  assert.match(script, /classList\.remove\('loading-wallpaper', 'newtab-booting'\)/)
})

test('newtab waits for local wallpaper media readiness before revealing the startup view', () => {
  const script = readProjectFile('src/newtab/newtab.ts')

  assert.match(script, /waitForBackgroundImageReady\(objectUrl, applyToken\)/)
  assert.match(script, /waitForBackgroundVideoReady\(video, applyToken\)/)
  assert.match(script, /loadedmetadata/)
  assert.match(script, /canplay/)
  assert.match(script, /markWallpaperPending\(\)/)
  assert.match(script, /markWallpaperReady\(\)/)
})

test('newtab url wallpaper loading does not block the main view', () => {
  const script = readProjectFile('src/newtab/newtab.ts')

  assert.match(
    script,
    /if \(settings\.type === 'urls'\) \{[\s\S]*?markWallpaperReady\(\)[\s\S]*?void applyUrlBackgroundImage\(imageUrl, applyToken, mediaSignature\)/
  )
  assert.doesNotMatch(
    script,
    /if \(settings\.type === 'urls'\) \{[\s\S]*?await applyUrlBackgroundImage\(imageUrl, applyToken, mediaSignature\)/
  )
  assert.match(script, /preserveCurrentUntilReady: true/)
  assert.match(script, /waitForBackgroundImageReady\(imageUrl, applyToken\)/)
})

test('newtab wallpaper startup fallback stays silent in extension errors', () => {
  const script = readProjectFile('src/newtab/newtab.ts')

  assert.doesNotMatch(script, /console\.(?:warn|error)\([^)]*启动等待窗口/)
  assert.doesNotMatch(script, /console\.error\(error\)/)
})

test('newtab folder headers expose scoped quick-add controls', () => {
  const script = readProjectFile('src/newtab/newtab.ts')
  const css = readProjectFile('src/newtab/newtab.css')

  assert.match(script, /addFolderId: ''/)
  assert.match(script, /data-add-bookmark-folder-id/)
  assert.match(script, /function openAddBookmarkMenuForElement/)
  assert.match(script, /const folderId = state\.addFolderId \|\| await ensureNewTabFolder\(\)/)
  assert.match(script, /headerRow\.append\(header, createFolderAddButton\(section\)\)/)
  assert.match(css, /\.folder-section-header-row/)
  assert.match(css, /\.folder-section-add/)
})

test('newtab empty folder state offers actionable next steps', () => {
  const script = readProjectFile('src/newtab/newtab.ts')
  const css = readProjectFile('src/newtab/newtab.css')

  assert.match(script, /function createEmptyFolderState\(section: NewTabFolderSection\): HTMLElement/)
  assert.match(script, /此文件夹还没有书签。你可以先添加一个书签，或改用已有的非空来源；选择来源只改变展示，不会移动或删除书签。/)
  assert.match(script, /addButton\.dataset\.addBookmarkFolderId = section\.id/)
  assert.match(script, /添加书签到这里/)
  assert.match(script, /选择现有来源/)
  assert.match(script, /sourceButton\.addEventListener\('click', openFolderSourceSettings\)/)
  assert.match(css, /\.bookmark-folder-empty-state/)
  assert.match(css, /\.bookmark-folder-empty-actions/)
})

test('builds compact source navigation data with stable anchors and bookmark counts', () => {
  assert.deepEqual(
    buildNewTabSourceNavigationItems([
      {
        id: '10',
        title: '工作',
        path: '书签栏 / 工作',
        bookmarks: [
          { id: '11', title: 'Docs', url: 'https://example.com/docs' },
          { id: '12', title: 'Folder' }
        ]
      },
      {
        id: 'folder:design',
        title: '',
        path: '',
        bookmarks: [
          { id: '21', title: 'Tokens', url: 'https://example.com/tokens' }
        ]
      },
      {
        id: ' ',
        title: '无效',
        path: '无效',
        bookmarks: []
      }
    ]),
    [
      {
        id: '10',
        anchorId: 'newtab-source-10',
        title: '工作',
        path: '书签栏 / 工作',
        bookmarkCount: 1
      },
      {
        id: 'folder:design',
        anchorId: 'newtab-source-folder-design',
        title: '未命名文件夹',
        path: '未命名文件夹',
        bookmarkCount: 1
      }
    ]
  )
})

test('newtab exposes source navigation anchors and a folder source setting switch', () => {
  const html = readProjectFile('src/newtab/newtab.html')
  const script = readProjectFile('src/newtab/newtab.ts')
  const css = readProjectFile('src/newtab/newtab.css')

  assert.equal(getNewTabSourceAnchorId('folder:design'), 'newtab-source-folder-design')
  assert.match(html, /id="folder-show-source-navigation"/)
  assert.match(script, /buildNewTabSourceNavigationItems/)
  assert.match(script, /sectionNode\.id = getNewTabSourceAnchorId\(section\.id\)/)
  assert.match(script, /dataset\.sourceNavigationTarget/)
  assert.match(css, /\.source-navigation/)
})

test('newtab folder candidate search exposes a stable accessible name', () => {
  const html = readProjectFile('src/newtab/newtab.html')
  const script = readProjectFile('src/newtab/newtab.ts')
  const searchInput = html.match(/<input[\s\S]*?id="folder-candidate-search"[\s\S]*?>/)?.[0] || ''
  const candidateList = html.match(/<div[\s\S]*?id="folder-candidate-list"[\s\S]*?>/)?.[0] || ''

  assert.match(searchInput, /type="search"/)
  assert.match(searchInput, /aria-label="搜索候选文件夹"/)
  assert.match(searchInput, /aria-controls="folder-candidate-list"/)
  assert.match(candidateList, /role="listbox"/)
  assert.match(candidateList, /aria-multiselectable="true"/)
  assert.match(script, /folderCandidateActiveId: ''/)
  assert.match(script, /handleFolderCandidateSearchKeydown/)
  assert.match(script, /handleFolderCandidateListKeydown/)
  assert.match(script, /addEventListener\('focusin', handleFolderCandidateFocus\)/)
  assert.match(script, /function focusFolderCandidateOption\(direction: 1 \| -1 \| 'first' \| 'last'\)/)
  assert.match(script, /event\.key !== 'Home'[\s\S]*?event\.key !== 'End'[\s\S]*?event\.key !== 'Escape'/)
  assert.match(script, /document\.getElementById\('folder-candidate-search'\)\?\.focus\(\)/)
  assert.match(script, /button\.tabIndex = folder\.id === activeId \? 0 : -1/)
  assert.match(script, /focusFolderCandidateOptionById\(focusCandidateId \|\| state\.folderCandidateActiveId\)/)
})

test('newtab settings drawer layout responds to drawer width', () => {
  const html = readProjectFile('src/newtab/newtab.html')
  const css = readProjectFile('src/newtab/newtab.css')
  const script = readProjectFile('src/newtab/newtab.ts')
  const drawer = html.match(/<aside[\s\S]*?id="newtab-settings-drawer"[\s\S]*?>/)?.[0] || ''

  assert.match(drawer, /aria-hidden="true"/)
  assert.match(drawer, /\sinert(?:\s|>)/)
  assert.match(css, /container:\s*settings-drawer\s*\/\s*inline-size/)
  assert.match(css, /@container settings-drawer \(max-width: 380px\)/)
  assert.match(css, /\.search-engine-setting-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/)
  assert.match(css, /\.search-engine-toggle-grid\s*\{[\s\S]*width:\s*100%/)
  assert.doesNotMatch(css, /width:\s*min\(360px,\s*42vw\)/)
  assert.match(css, /--preview-grid-max-width/)
  assert.match(script, /--preview-grid-max-width/)
  assert.match(script, /grid\.style\.gridTemplateColumns = `repeat\(\$\{previewColumns\}, minmax\(0, 1fr\)\)`/)
  assert.doesNotMatch(script, /grid\.style\.gridTemplateColumns = `repeat\(\$\{previewColumns\}, minmax\(0, var\(--preview-tile-width\)\)\)`/)
})

test('newtab settings drawer is inert while closed', () => {
  const script = readProjectFile('src/newtab/newtab.ts')

  assert.match(script, /settingsDrawer\?\.removeAttribute\('inert'\)/)
  assert.match(script, /settingsDrawer\?\.setAttribute\('inert', ''\)/)
  assert.match(script, /settingsDrawer\?\.setAttribute\('aria-hidden', 'false'\)[\s\S]*?settingsDrawer\?\.removeAttribute\('inert'\)/)
  assert.match(script, /settingsDrawer\?\.setAttribute\('aria-hidden', 'true'\)[\s\S]*?settingsDrawer\?\.setAttribute\('inert', ''\)/)
  assert.match(script, /function setSettingsModalBackgroundInert\(inert: boolean\): void/)
  assert.match(script, /root,[\s\S]*settingsTrigger instanceof HTMLElement[\s\S]*dashboardTrigger instanceof HTMLElement/)
  assert.match(script, /element\.setAttribute\('inert', ''\)[\s\S]*?element\.setAttribute\('aria-hidden', 'true'\)/)
  assert.match(script, /element\.removeAttribute\('inert'\)[\s\S]*?element\.removeAttribute\('aria-hidden'\)/)
  assert.match(script, /document\.body\.classList\.add\('settings-open'\)[\s\S]*?setSettingsModalBackgroundInert\(true\)/)
  assert.match(script, /document\.body\.classList\.remove\('settings-open'\)[\s\S]*?setSettingsModalBackgroundInert\(false\)/)
})

test('newtab advanced icon layout exposes a default reset control', () => {
  const html = readProjectFile('src/newtab/newtab.html')
  const script = readProjectFile('src/newtab/newtab.ts')
  const css = readProjectFile('src/newtab/newtab.css')

  assert.match(html, /id="icon-reset-defaults"[\s\S]*恢复默认布局/)
  assert.match(script, /getElementById\('icon-reset-defaults'\)\?\.addEventListener\('click', resetIconSettingsToDefaults\)/)
  assert.match(script, /function resetIconSettingsToDefaults\(\): void/)
  assert.match(script, /normalizeIconSettings\(DEFAULT_ICON_SETTINGS\)/)
  assert.match(css, /\.icon-reset-defaults/)
})

test('newtab fixed icon layout clamps columns and keeps compact grids fluid', () => {
  const script = readProjectFile('src/newtab/newtab.ts')
  const css = readProjectFile('src/newtab/newtab.css')
  const responsiveColumnsBody = getFunctionBody(script, 'getResponsiveIconColumns')
  const fixedCompactRule = css.match(
    /\.newtab-content\[data-icon-layout-mode="fixed"\]\s+\.bookmark-grid\s*\{[\s\S]*?max-width:\s*min\(var\(--icon-fixed-grid-width\),\s*100%\)[\s\S]*?grid-template-columns:\s*repeat\(var\(--icon-columns\),\s*minmax\(0,\s*1fr\)\)[\s\S]*?\}/
  )?.[0] || ''
  const fixedContentRule = getCssRuleBody(css, '.newtab-content[data-icon-layout-mode="fixed"]')

  assert.match(script, /getResponsiveFixedIconColumns/)
  assert.match(responsiveColumnsBody, /document\.documentElement\.clientWidth \|\| window\.innerWidth \|\| 1280/)
  assert.match(fixedContentRule, /width:\s*min\(max\(var\(--icon-page-width\),\s*var\(--icon-fixed-grid-width\)\),\s*100%\)/)
  assert.match(fixedCompactRule, /width:\s*100%/)
  assert.match(fixedCompactRule, /column-gap:\s*min\(var\(--icon-column-gap\),\s*18px\)/)
})

test('newtab folder reorder reports save outcome, rolls back failed saves, and suppresses pointercancel clicks', () => {
  const script = readProjectFile('src/newtab/newtab.ts')
  const css = readProjectFile('src/newtab/newtab.css')
  const finishBody = getFunctionBody(script, 'finishFolderDrag')

  assert.match(script, /folderReorderStatus: ''/)
  assert.match(script, /folderDragOriginalSections: \[\] as NewTabFolderSection\[\]/)
  assert.match(script, /window\.addEventListener\('pointercancel', \(\) => \{[\s\S]*?cancelFolderDrag\(\{ keepSuppressClick: true \}\)/)
  assert.match(finishBody, /try \{[\s\S]*?await saveFolderSettings\(\)[\s\S]*?setFolderReorderStatus\('文件夹顺序已保存。', 'success'\)/)
  assert.match(finishBody, /catch \(error\) \{[\s\S]*?selectedFolderIds: originalOrderIds[\s\S]*?restoreFolderDragOrder\(originalOrderIds, originalSections\)/)
  assert.match(finishBody, /文件夹顺序保存失败，已恢复到拖拽前顺序。/)
  assert.match(script, /function cancelFolderDrag\(\{ keepSuppressClick = false \} = \{\}\): void \{[\s\S]*?restoreFolderDragOrder\(originalOrderIds, originalSections\)/)
  assert.match(script, /function restoreFolderDragOrder\(/)
  assert.match(script, /status\.dataset\.tone = state\.bookmarkReorderError \? 'error' : state\.folderReorderStatusTone/)
  assert.match(css, /\.bookmark-reorder-status\[data-tone="success"\]/)
  assert.match(css, /\.bookmark-reorder-status\[data-tone="error"\]/)
})

test('newtab settings rows avoid per-option divider lines', () => {
  const css = readProjectFile('src/newtab/newtab.css')
  const sectionDividerRule = getCssRuleBody(css, '.settings-section + .settings-section')

  assert.match(sectionDividerRule, /border-top:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.1\)/)
  assert.match(sectionDividerRule, /padding-top:\s*24px/)
  assert.doesNotMatch(getCssRuleBody(css, '.setting-row'), /border-bottom:/)
  assert.equal(getCssRuleBody(css, '.setting-row:last-child'), '')
  assert.doesNotMatch(getCssRuleBody(css, '.icon-live-preview-panel'), /border-bottom:/)
  assert.doesNotMatch(getCssRuleBody(css, '.icon-preset-row'), /border-bottom:/)
})

test('newtab settings switch rows stay aligned with their labels', () => {
  const css = readProjectFile('src/newtab/newtab.css')
  const switchRowRules = getCssRuleBodies(css, '.setting-row:has(.setting-switch)')
  const switchRules = getCssRuleBodies(css, '.setting-row:has(.setting-switch) .setting-switch')

  assert.equal(switchRowRules.length, 3)
  assert.equal(switchRules.length, 3)
  for (const rule of switchRowRules) {
    assert.match(rule, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto/)
    assert.match(rule, /align-items:\s*center/)
  }
  for (const rule of switchRules) {
    assert.match(rule, /align-self:\s*center/)
    assert.match(rule, /justify-self:\s*end/)
  }
})

test('newtab settings section titles are visually prominent', () => {
  const css = readProjectFile('src/newtab/newtab.css')
  const sectionTitleRule = getCssRuleBody(css, '.settings-section h2')

  assert.match(sectionTitleRule, /font-size:\s*13px/)
  assert.match(sectionTitleRule, /font-weight:\s*760/)
  assert.match(sectionTitleRule, /color:\s*rgba\(245,\s*245,\s*247,\s*0\.78\)/)
})

test('newtab settings drawer labels avoid truncating explanatory copy', () => {
  const css = readProjectFile('src/newtab/newtab.css')
  const sectionTitleRule = getCssRuleBody(css, '.settings-section h2')
  const labelRule = getCssRuleBody(css, '.setting-label-stack > span')
  const descriptionRules = getCssRuleBodies(css, '.setting-label-stack small')
  const descriptionRule = descriptionRules.find((rule) => /white-space:\s*normal/.test(rule)) || ''

  assert.match(sectionTitleRule, /-webkit-line-clamp:\s*2/)
  assert.match(sectionTitleRule, /overflow-wrap:\s*anywhere/)
  assert.match(labelRule, /-webkit-line-clamp:\s*2/)
  assert.doesNotMatch(labelRule, /white-space:\s*nowrap/)
  assert.match(descriptionRule, /white-space:\s*normal/)
  assert.match(descriptionRule, /display:\s*block/)
  assert.doesNotMatch(descriptionRule, /text-overflow:\s*ellipsis/)
  assert.doesNotMatch(descriptionRule, /white-space:\s*nowrap/)
})

test('newtab dashboard glass layer only styles the iframe shell', () => {
  const newtabCss = readProjectFile('src/newtab/newtab.css')
  const optionsCss = readProjectFile('src/options/options.css')

  assert.match(newtabCss, /\.newtab-dashboard-overlay\s*\{[\s\S]*?position:\s*fixed/)
  assert.match(newtabCss, /\.newtab-dashboard-overlay\s*\{[\s\S]*?inset:\s*0/)
  assert.match(newtabCss, /\.newtab-dashboard-overlay\s*\{[\s\S]*?align-items:\s*stretch/)
  assert.match(newtabCss, /\.newtab-dashboard-overlay\s*\{[\s\S]*?justify-items:\s*stretch/)
  assert.match(newtabCss, /\.newtab-dashboard-overlay\s*\{[\s\S]*?padding:\s*0/)
  assert.match(newtabCss, /\.newtab-dashboard-overlay\[hidden\]\s*\{[\s\S]*?display:\s*none/)
  assert.doesNotMatch(newtabCss, /\.newtab-dashboard-close\s*\{/)
  assert.match(newtabCss, /\.newtab-dashboard-surface\s*\{[\s\S]*?width:\s*100dvw/)
  assert.match(newtabCss, /\.newtab-dashboard-surface\s*\{[\s\S]*?height:\s*100dvh/)
  assert.match(newtabCss, /\.newtab-dashboard-surface\s*\{[\s\S]*?border-radius:\s*0/)
  assert.match(newtabCss, /\.newtab-dashboard-surface\s*\{[\s\S]*?backdrop-filter:\s*blur\(/)
  assert.match(newtabCss, /\.newtab-dashboard-loading\s*\{[\s\S]*?position:\s*absolute/)
  assert.match(newtabCss, /\.newtab-dashboard-loading-card\s*\{[\s\S]*?backdrop-filter:\s*blur\(/)
  assert.match(newtabCss, /\.newtab-dashboard-fallback\s*\{[\s\S]*?position:\s*absolute/)
  assert.match(newtabCss, /\.newtab-dashboard-fallback\[hidden\]\s*\{[\s\S]*?display:\s*none/)
  assert.match(newtabCss, /\.newtab-dashboard-overlay\[data-dashboard-error="true"\]\s+\.newtab-dashboard-loading\s*\{[\s\S]*?opacity:\s*0/)
  assert.match(newtabCss, /\.newtab-dashboard-frame\s*\{[\s\S]*?opacity:\s*0/)
  assert.match(newtabCss, /\.newtab-dashboard-frame\s*\{[\s\S]*?visibility:\s*hidden/)
  assert.match(newtabCss, /\.newtab-dashboard-overlay\[data-dashboard-ready="true"\]\s+\.newtab-dashboard-frame\s*\{[\s\S]*?opacity:\s*1/)
  assert.match(newtabCss, /\.newtab-dashboard-overlay\[data-dashboard-ready="true"\]\s+\.newtab-dashboard-loading\s*\{[\s\S]*?opacity:\s*0/)
  assert.match(newtabCss, /\.dashboard-trigger\s*\{[\s\S]*?width:\s*40px[\s\S]*?min-width:\s*40px[\s\S]*?padding:\s*0/)
  assert.match(newtabCss, /\.dashboard-trigger span\s*\{[\s\S]*?clip-path:\s*inset\(50%\)[\s\S]*?white-space:\s*nowrap/)
  assert.match(newtabCss, /@media \(prefers-reduced-motion: reduce\)/)

  assert.doesNotMatch(
    newtabCss,
    /\.newtab-dashboard-surface\s+\.(?:dashboard-|options-|detect-)/
  )
  assert.doesNotMatch(
    newtabCss,
    /@media [^{]+\{[\s\S]*?\.newtab-dashboard-surface\s+\.dashboard-(?:title-row|toolbar|card-grid|bookmark-card)/
  )
  assert.doesNotMatch(
    newtabCss,
    /\.newtab-dashboard-surface\s+\.dashboard-(?:content-layout|folder-sidebar|folder-tree)/
  )
  assert.doesNotMatch(optionsCss, /newtab-dashboard-(?:overlay|surface|frame)/)
})

test('newtab compact viewport preserves dashboard trigger label while clearing the utility stack', () => {
  const newtabCss = readProjectFile('src/newtab/newtab.css')
  const compactRule = newtabCss.match(/@media \(max-width:\s*680px\)\s*\{[\s\S]*?^}/m)?.[0] || ''

  assert.match(compactRule, /\.newtab-shell\s*\{[\s\S]*?padding:\s*76px\s+18px\s+32px/)
  assert.match(compactRule, /\.settings-trigger-zone\s*\{[\s\S]*?width:\s*170px/)
  assert.match(compactRule, /\.dashboard-trigger\s*\{[\s\S]*?min-width:\s*112px[\s\S]*?padding:\s*0\s+10px/)
  assert.match(compactRule, /\.dashboard-trigger span\s*\{[\s\S]*?font-size:\s*11px/)
  assert.doesNotMatch(compactRule, /\.dashboard-trigger\s*\{[\s\S]*?width:\s*40px/)
  assert.doesNotMatch(compactRule, /\.dashboard-trigger span\s*\{[\s\S]*?clip-path:\s*inset\(50%\)/)
})

test('newtab bookmark tiles match the frosted overview card surface', () => {
  const newtabCss = readProjectFile('src/newtab/newtab.css')
  const tileRule = getCssRuleBody(newtabCss, '.bookmark-tile')
  const hoverRule = getCssRuleBody(newtabCss, '.bookmark-tile:hover,\n.bookmark-tile:focus-visible')

  assert.match(tileRule, /border-radius:\s*8px/)
  assert.match(tileRule, /background:\s*rgba\(8,\s*8,\s*9,\s*var\(--bookmark-card-bg-alpha\)\)/)
  assert.match(tileRule, /box-shadow:\s*inset\s+0\s+1px\s+0\s+rgba\(255,\s*255,\s*255,\s*0\.035\)/)
  assert.match(tileRule, /backdrop-filter:\s*blur\(16px\)/)
  assert.doesNotMatch(tileRule, /linear-gradient/)
  assert.match(hoverRule, /background:\s*rgba\(8,\s*8,\s*9,\s*var\(--bookmark-card-hover-alpha\)\)/)
  assert.doesNotMatch(hoverRule, /box-shadow:\s*0\s+10px/)
})

test('newtab large bookmark lists render tiles incrementally', () => {
  const script = readProjectFile('src/newtab/newtab.ts')

  assert.match(script, /const BOOKMARK_TILE_INITIAL_RENDER_LIMIT = 160/)
  assert.match(script, /const BOOKMARK_TILE_RENDER_CHUNK_SIZE = 80/)
  assert.match(script, /let bookmarkTileRenderVersion = 0/)
  assert.match(script, /function appendBookmarkTilesInChunks/)
  assert.match(script, /function scheduleBookmarkTileChunkRender/)
  assert.match(script, /window\.requestAnimationFrame\(\(\) =>/)
  assert.match(script, /renderVersion !== bookmarkTileRenderVersion \|\| !list\.isConnected/)
  assert.match(script, /list\.dataset\.incrementalRender = 'true'/)
  assert.doesNotMatch(script, /for \(const bookmark of section\.bookmarks\) \{[\s\S]*?list\.appendChild\(createBookmarkTile/)
})

test('newtab bookmark suggestions are debounced and cached', () => {
  const script = readProjectFile('src/newtab/newtab.ts')
  const contentState = readProjectFile('src/newtab/content-state.ts')

  assert.match(script, /const SEARCH_SUGGESTION_DEBOUNCE_MS = 80/)
  assert.match(script, /const SEARCH_SUGGESTION_CACHE_LIMIT = 24/)
  assert.match(script, /const scheduleSuggestionsRender = \(\{ preserveActive = false, immediate = false \} = \{\}\) =>/)
  assert.match(script, /window\.setTimeout\(\(\) => \{[\s\S]*?renderCurrentSuggestions\(\)/)
  assert.match(script, /const searchSuggestionCache = new Map<string, SearchBookmarkSuggestion\[\]>\(\)/)
  assert.match(script, /const naturalSearchSuggestionCache = new Map<string, Promise<SearchBookmarkSuggestion\[\]>>\(\)/)
  assert.match(script, /function getSearchSuggestionCacheKey/)
  assert.match(script, /normalizeNewTabSearchText\(query\)/)
  assert.match(script, /searchSuggestionCache\.clear\(\)/)
  assert.match(script, /naturalSearchSuggestionCache\.clear\(\)/)
  assert.match(script, /getNaturalSearchBookmarkSuggestions\(query\)\.then/)
  assert.match(script, /function shouldLoadNaturalSearchSuggestions/)
  assert.match(script, /if \(!shouldLoadNaturalSearchSuggestions\(query, directSuggestions\)\) \{[\s\S]*?return[\s\S]*?\}/)
  assert.match(contentState, /await import\('\.\.\/popup\/natural-search\.js'\)/)
  assert.match(contentState, /await import\('\.\.\/popup\/search\.js'\)/)
  assert.doesNotMatch(contentState, /^import\s+(?!type)[^\n]*['"]\.\.\/popup\/natural-search\.js['"]/m)
  assert.doesNotMatch(contentState, /^import\s+(?!type)[^\n]*['"]\.\.\/popup\/search(?:-index)?\.js['"]/m)
  assert.doesNotMatch(contentState, /^import\s+(?!type)[^\n]*['"]\.\.\/shared\/dot-matrix-loader\.js['"]/m)
  assert.doesNotMatch(script, /^import\s+(?!type)[^\n]*['"]\.\.\/shared\/motion\.js['"]/m)
  assert.doesNotMatch(script, /^import\s+(?!type)[^\n]*['"]\.\.\/shared\/recycle-bin\.js['"]/m)
  assert.doesNotMatch(script, /^import\s+(?!type)[^\n]*['"]\.\.\/shared\/bookmarks-api\.js['"]/m)
  assert.doesNotMatch(script, /^import\s+(?!type)[^\n]*['"]\.\.\/shared\/bookmark-tags\.js['"]/m)
  assert.doesNotMatch(script, /input\.addEventListener\('input', \(\) => \{[\s\S]*?renderSuggestions\(\)/)
})

test('newtab bookmark change events are coalesced before full refresh', () => {
  const script = readProjectFile('src/newtab/newtab.ts')

  assert.match(script, /const BOOKMARK_CHANGE_REFRESH_DEBOUNCE_MS = 120/)
  assert.match(script, /let bookmarkChangeRefreshTimer = 0/)
  assert.match(script, /let bookmarkChangeRefreshInFlight = false/)
  assert.match(script, /let bookmarkChangeRefreshQueued = false/)
  assert.match(script, /function scheduleBookmarkChangeRefresh\(\): void/)
  assert.match(script, /function flushBookmarkChangeRefresh\(\): Promise<void>/)
  assert.match(getFunctionBody(script, 'handleBookmarksChanged'), /scheduleBookmarkChangeRefresh\(\)/)
  assert.doesNotMatch(getFunctionBody(script, 'handleBookmarksChanged'), /refreshNewTab\(\)/)
  assert.match(getFunctionBody(script, 'scheduleBookmarkChangeRefresh'), /window\.setTimeout/)
  assert.match(getFunctionBody(script, 'flushBookmarkChangeRefresh'), /await refreshNewTab\(\)/)
})

test('newtab source candidates distinguish direct and total bookmark counts', () => {
  const script = readProjectFile('src/newtab/newtab.ts')

  assert.match(script, /interface NewTabFolderCandidate[\s\S]*directBookmarkCount: number[\s\S]*totalBookmarkCount: number/)
  assert.match(script, /function formatFolderCandidateCountSummary\(folder: NewTabFolderCandidate\): string/)
  assert.match(script, /直属 \$\{folder\.directBookmarkCount\} \/ 合计 \$\{folder\.totalBookmarkCount\}/)
  assert.match(script, /badge\.textContent = selected \? '已选' : String\(folder\.totalBookmarkCount\)/)
  assert.doesNotMatch(script, /badge\.textContent = selected \? '已选' : `\$\{folder\.bookmarkCount\}`/)
})

test('newtab folder candidate cards keep long text inside their frame', () => {
  const css = readProjectFile('src/newtab/newtab.css')
  const sourcePanelRule = getCssRuleBody(css, '.folder-source-panel')
  const candidateListRule = getCssRuleBodies(css, '.folder-candidate-list').join('\n')
  const cardRules = getCssRuleBodies(css, '.folder-candidate-card').join('\n')
  const focusRules = getCssRuleBodies(css, '.folder-candidate-card:focus-visible').join('\n')
  const copyRules = getCssRuleBodies(css, '.folder-candidate-copy').join('\n')
  const titleRule = getCssRuleBody(css, '.folder-candidate-copy strong')
  const metaRule = getCssRuleBody(css, '.folder-candidate-copy span')
  const badgeRule = getCssRuleBody(css, '.folder-candidate-badge')

  assert.match(sourcePanelRule, /min-width:\s*0/)
  assert.match(candidateListRule, /min-width:\s*0/)
  assert.match(cardRules, /min-width:\s*0/)
  assert.match(cardRules, /max-width:\s*100%/)
  assert.match(cardRules, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*max-content/)
  assert.match(cardRules, /overflow:\s*hidden/)
  assert.match(cardRules, /white-space:\s*normal/)
  assert.match(copyRules, /max-width:\s*100%/)
  assert.match(copyRules, /min-width:\s*0/)
  assert.match(titleRule, /display:\s*block/)
  assert.match(titleRule, /max-width:\s*100%/)
  assert.match(titleRule, /white-space:\s*normal/)
  assert.match(titleRule, /overflow-wrap:\s*anywhere/)
  assert.match(titleRule, /word-break:\s*break-word/)
  assert.match(metaRule, /display:\s*block/)
  assert.match(metaRule, /max-width:\s*100%/)
  assert.match(metaRule, /white-space:\s*normal/)
  assert.match(metaRule, /overflow-wrap:\s*anywhere/)
  assert.match(metaRule, /word-break:\s*break-word/)
  assert.match(badgeRule, /align-self:\s*start/)
  assert.match(focusRules, /box-shadow:\s*0 0 0 2px rgba\(245,\s*245,\s*247,\s*0\.16\)/)
})

test('newtab search and quick access stay scoped to selected source folders', () => {
  const script = readProjectFile('src/newtab/newtab.ts')

  assert.match(script, /bookmarks:\s*state\.bookmarks/)
  assert.match(script, /bookmarks:\s*getVisibleBookmarkRecords\(\)/)
  assert.match(script, /function getVisibleBookmarkRecords\(\): BookmarkRecord\[\]/)
  assert.match(script, /folderData\.bookmarkMap\.get\(bookmarkId\)/)
  assert.doesNotMatch(script, /bookmarks:\s*state\.allBookmarks,[\s\S]*?pinnedIds: state\.activity\.pinnedIds/)
  assert.doesNotMatch(script, /bookmarks:\s*state\.folderData\?\.bookmarks \|\| extractBookmarkData\(state\.rootNode\)\.bookmarks/)
})

test('newtab source selection rolls back when folder settings fail to save', () => {
  const script = readProjectFile('src/newtab/newtab.ts')
  const updateSelectedFoldersBody = script.match(
    /async function updateSelectedFolders\([\s\S]*?\n\}\n\nasync function/
  )?.[0] || ''

  assert.ok(updateSelectedFoldersBody, 'updateSelectedFolders should exist')
  assert.match(updateSelectedFoldersBody, /const previousSettings = state\.folderSettings/)
  assert.match(updateSelectedFoldersBody, /const previousSections = \[\.\.\.state\.folderSections\]/)
  assert.match(updateSelectedFoldersBody, /try \{[\s\S]*?await saveFolderSettings\(\)/)
  assert.match(updateSelectedFoldersBody, /catch \(error\) \{[\s\S]*?state\.folderSettings = previousSettings/)
  assert.match(updateSelectedFoldersBody, /state\.folderSections = previousSections/)
  assert.match(updateSelectedFoldersBody, /setSettingsSaveStatus\('error', '来源保存失败，已恢复到上次已保存状态'\)/)
})

test('newtab avoids heavy startup and navigation work on the main path', () => {
  const script = readProjectFile('src/newtab/newtab.ts')
  const refreshBody = getFunctionBody(script, 'refreshNewTab')
  const preloadBody = getFunctionBody(script, 'preloadBackgroundSettings')
  const snapshotBody = getFunctionBody(script, 'normalizeNewTabContentSnapshotRecord')
  const navigationBody = getFunctionBody(script, 'bindBookmarkNavigation')
  const iconCommitBody = getFunctionBody(script, 'commitIconSettings')
  const iconLiveBody = getFunctionBody(script, 'applyIconSettingsLive')

  assert.match(script, /const FAVICON_ACCENT_EXTRACTION_INITIAL_BUDGET = 48/)
  assert.match(script, /renderIndex < FAVICON_ACCENT_EXTRACTION_INITIAL_BUDGET/)
  assert.match(refreshBody, /backgroundPreloadPromise/)
  assert.doesNotMatch(refreshBody, /STORAGE_KEYS\.newTabBackgroundSettings/)
  assert.match(preloadBody, /return state\.backgroundSettings/)
  assert.doesNotMatch(preloadBody, /await applyBackgroundSettings\(\)/)
  assert.match(snapshotBody, /fullText:\s*undefined/)
  assert.doesNotMatch(snapshotBody, /normalizeNewTabSnapshotText\(source\.fullText\)/)
  assert.match(navigationBody, /void recordBookmarkOpen\(bookmark\)[\s\S]*?window\.location\.assign\(url\)/)
  assert.doesNotMatch(navigationBody, /recordBookmarkOpen\(bookmark\)\.finally/)
  assert.match(iconCommitBody, /applyIconSettingsLive\(\)/)
  assert.doesNotMatch(iconCommitBody, /scheduleRender\(\{ updateClock: true \}\)/)
  assert.match(iconLiveBody, /content\.style\.setProperty\('--icon-page-width'/)
  assert.match(iconLiveBody, /content\.dataset\.iconLayoutMode = state\.iconSettings\.layoutMode/)
  assert.match(iconLiveBody, /page\.dataset\.iconVerticalCenter = String\(state\.iconSettings\.verticalCenter\)/)
})

test('newtab global keyboard search shortcut avoids hijacking normal typing', () => {
  const script = readProjectFile('src/newtab/newtab.ts')
  const keydownBody = getFunctionBody(script, 'handleDocumentKeydown')
  const shouldFocusBody = getFunctionBody(script, 'shouldFocusSearchFromKeydown')

  assert.match(shouldFocusBody, /return event\.key === '\/'/)
  assert.doesNotMatch(shouldFocusBody, /event\.key\.length === 1 && Boolean\(event\.key\.trim\(\)\)/)
  assert.match(keydownBody, /if \(event\.key === '\/'\) \{[\s\S]*?input\.select\(\)[\s\S]*?return/)
  assert.match(keydownBody, /if \(event\.key\.length === 1\) \{[\s\S]*?input\.value = event\.key/)
})

test('newtab portal overview stays quiet without today signals', () => {
  const script = readProjectFile('src/newtab/newtab.ts')
  const hasSignalBody = getFunctionBody(script, 'hasPortalOverviewSignal')
  const statsBody = getFunctionBody(script, 'createPortalStats')

  assert.match(hasSignalBody, /overview\.openedTodayCount > 0 \|\| overview\.addedTodayCount > 0/)
  assert.doesNotMatch(hasSignalBody, /overview\.bookmarkCount > 0/)
  assert.doesNotMatch(hasSignalBody, /overview\.folderCount > 0/)
  assert.match(statsBody, /const stats: HTMLElement\[\] = \[\]/)
  assert.doesNotMatch(statsBody, /createPortalStat\('书签', overview\.bookmarkCount\)/)
  assert.doesNotMatch(statsBody, /createPortalStat\('来源', overview\.folderCount\)/)
})

test('newtab save errors explain temporary state instead of implying persistence', () => {
  const script = readProjectFile('src/newtab/newtab.ts')
  const saveBody = getFunctionBody(script, 'saveSettingsWithFeedback')

  assert.match(saveBody, /保存失败，本次调整仅临时生效；刷新后会恢复到上次已保存状态/)
})

test('newtab search suggestions wait for arrow navigation before selecting a bookmark', () => {
  const script = readProjectFile('src/newtab/newtab.ts')

  assert.match(script, /let activeSuggestionIndex = -1/)
  assert.match(script, /activeSuggestionIndex = preserveActive && previousActiveIndex >= 0[\s\S]*\? Math\.min\(previousActiveIndex, searchSuggestions\.length - 1\)[\s\S]*: -1/)
  assert.match(script, /activeSuggestionIndex = activeSuggestionIndex < 0[\s\S]*\? \(direction > 0 \? 0 : searchSuggestions\.length - 1\)/)
  assert.match(script, /suggestionsHint\.textContent = `按 ↓ 选择书签，选中后 Enter 打开；Cmd\/Ctrl\+Enter 用 \$\{getSearchEngineDisplayName\(\)\} 搜索网页`/)
  assert.doesNotMatch(script, /activeSuggestionIndex = preserveActive[^\n]*\n\s*\? [^\n]*\n\s*: 0/)
})

test('newtab search suggestions explain bookmark enter behavior and empty web search fallback', () => {
  const script = readProjectFile('src/newtab/newtab.ts')
  const css = readProjectFile('src/newtab/newtab.css')

  assert.match(script, /input\.setAttribute\('role', 'combobox'\)/)
  assert.match(script, /input\.setAttribute\('aria-autocomplete', 'list'\)/)
  assert.match(script, /input\.setAttribute\('aria-controls', 'newtab-search-suggestions'\)/)
  assert.match(script, /suggestions\.setAttribute\('role', 'listbox'\)/)
  assert.match(script, /suggestionsHint\.className = 'newtab-search-hint'/)
  assert.match(script, /suggestionsHint\.setAttribute\('role', 'status'\)/)
  assert.match(script, /suggestionsHint\.setAttribute\('aria-live', 'polite'\)/)
  assert.match(script, /createSearchWebFallbackButton\(trimmedQuery\)/)
  assert.match(script, /未找到书签；按 Enter 仅在本页用 \$\{getSearchEngineDisplayName\(\)\} 搜索网页/)
  assert.match(script, /suggestionsHint\.textContent = `按 ↓ 选择书签，选中后 Enter 打开；Cmd\/Ctrl\+Enter 用 \$\{getSearchEngineDisplayName\(\)\} 搜索网页`/)
  assert.match(script, /button\.addEventListener\('click', \(\) => \{[\s\S]*?submitSearch\(query\)/)
  assert.match(css, /\.newtab-search-hint\s*\{/)
  assert.match(css, /\.newtab-search-web-hint\s*\{/)
})

test('newtab search engine menu supports menu radio keyboard navigation', () => {
  const script = readProjectFile('src/newtab/newtab.ts')

  assert.match(script, /engineButton\.setAttribute\('aria-haspopup', 'menu'\)/)
  assert.match(script, /menu\.setAttribute\('role', 'menu'\)/)
  assert.match(script, /item\.setAttribute\('role', 'menuitemradio'\)/)
  assert.match(script, /item\.setAttribute\('aria-checked', String\(engineId === state\.searchSettings\.engine\)\)/)
  assert.match(script, /item\.tabIndex = -1/)
  assert.match(script, /const focusEngineMenuItem = \(menu: HTMLElement, direction: 1 \| -1 \| 'first' \| 'last'\)/)
  assert.match(script, /engineButton\.addEventListener\('keydown', \(event\) => \{[\s\S]*?event\.key !== 'ArrowDown'[\s\S]*?event\.key !== 'ArrowUp'[\s\S]*?renderEngineMenu\(event\.key === 'ArrowDown' \? 'first' : 'last'\)/)
  assert.match(script, /menu\.addEventListener\('keydown', \(event\) => \{[\s\S]*?event\.key !== 'Home'[\s\S]*?event\.key !== 'End'[\s\S]*?event\.key !== 'Escape'/)
  assert.match(script, /if \(event\.key === 'Escape'\) \{[\s\S]*?closeEngineMenu\(\{ restoreFocus: true \}\)/)
  assert.match(script, /focusEngineMenuItem\(menu, event\.key === 'ArrowDown' \? 1 : -1\)/)
})
