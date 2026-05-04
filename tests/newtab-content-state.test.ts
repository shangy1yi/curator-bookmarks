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
      { id: '2', reason: 'opened', badge: '开' }
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

test('newtab settings expose one combined quick access switch', () => {
  const html = readProjectFile('src/newtab/newtab.html')

  assert.match(html, /显示常用和最近/)
  assert.match(html, /id="general-show-quick-access"/)
  assert.doesNotMatch(html, /id="general-show-frequent"/)
  assert.doesNotMatch(html, /id="general-show-recent"/)
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
  assert.match(dashboardTrigger, />\s*书签仪表盘\s*<\/span>/)
  assert.match(dashboardOverlay, /\bhidden\b/)
  assert.match(dashboardOverlay, /role="dialog"/)
  assert.match(dashboardOverlay, /aria-modal="true"/)
  assert.match(dashboardOverlay, /aria-hidden="true"/)
  assert.match(dashboardOverlay, /tabindex="-1"/)
  assert.match(dashboardOverlay, /data-dashboard-ready="false"/)
  assert.match(html, /class="newtab-dashboard-loading"/)
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
  assert.match(script, /curator:newtab-dashboard-ready/)
  assert.match(script, /dashboardFrameReady/)
  assert.match(script, /dashboardOverlay\.dataset\.dashboardReady/)
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
  assert.match(script, /此文件夹还没有书签。你可以先添加一个书签，或改用已有的非空来源。/)
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

test('newtab settings drawer layout responds to drawer width', () => {
  const css = readProjectFile('src/newtab/newtab.css')
  const script = readProjectFile('src/newtab/newtab.ts')

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

test('newtab dashboard glass layer only styles the iframe shell', () => {
  const newtabCss = readProjectFile('src/newtab/newtab.css')
  const optionsCss = readProjectFile('src/options/options.css')

  assert.match(newtabCss, /\.newtab-dashboard-overlay\s*\{[\s\S]*?position:\s*fixed/)
  assert.match(newtabCss, /\.newtab-dashboard-overlay\s*\{[\s\S]*?inset:\s*0/)
  assert.match(newtabCss, /\.newtab-dashboard-overlay\s*\{[\s\S]*?align-items:\s*stretch/)
  assert.match(newtabCss, /\.newtab-dashboard-overlay\s*\{[\s\S]*?justify-items:\s*stretch/)
  assert.match(newtabCss, /\.newtab-dashboard-overlay\s*\{[\s\S]*?padding:\s*0/)
  assert.match(newtabCss, /\.newtab-dashboard-overlay\[hidden\]\s*\{[\s\S]*?display:\s*none/)
  assert.match(newtabCss, /\.newtab-dashboard-surface\s*\{[\s\S]*?width:\s*100dvw/)
  assert.match(newtabCss, /\.newtab-dashboard-surface\s*\{[\s\S]*?height:\s*100dvh/)
  assert.match(newtabCss, /\.newtab-dashboard-surface\s*\{[\s\S]*?border-radius:\s*0/)
  assert.match(newtabCss, /\.newtab-dashboard-surface\s*\{[\s\S]*?backdrop-filter:\s*blur\(/)
  assert.match(newtabCss, /\.newtab-dashboard-loading\s*\{[\s\S]*?position:\s*absolute/)
  assert.match(newtabCss, /\.newtab-dashboard-loading-card\s*\{[\s\S]*?backdrop-filter:\s*blur\(/)
  assert.match(newtabCss, /\.newtab-dashboard-frame\s*\{[\s\S]*?opacity:\s*0/)
  assert.match(newtabCss, /\.newtab-dashboard-frame\s*\{[\s\S]*?visibility:\s*hidden/)
  assert.match(newtabCss, /\.newtab-dashboard-overlay\[data-dashboard-ready="true"\]\s+\.newtab-dashboard-frame\s*\{[\s\S]*?opacity:\s*1/)
  assert.match(newtabCss, /\.newtab-dashboard-overlay\[data-dashboard-ready="true"\]\s+\.newtab-dashboard-loading\s*\{[\s\S]*?opacity:\s*0/)
  assert.match(newtabCss, /\.dashboard-trigger\s*\{[\s\S]*?min-width:\s*124px/)
  assert.match(newtabCss, /\.dashboard-trigger span\s*\{[\s\S]*?white-space:\s*nowrap/)
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
