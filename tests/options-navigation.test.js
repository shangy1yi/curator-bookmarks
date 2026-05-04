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

test('recycle bin is the last item in bookmark management navigation', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const start = optionsHtml.indexOf('id="options-bookmark-nav-label"')
  const end = optionsHtml.indexOf('id="options-ai-nav-label"')

  assert.ok(start > -1)
  assert.ok(end > start)

  const bookmarkNav = optionsHtml.slice(start, end)
  const links = [...bookmarkNav.matchAll(/data-section-link="([^"]+)"/g)].map((match) => match[1])

  assert.equal(links.at(-1), 'recycle')
})

test('smart analysis section uses the renamed Chinese entry copy', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const constants = readProjectFile('src/options/shared-options/constants.ts')

  assert.match(optionsHtml, /data-section-link="ai">书签智能分析</)
  assert.match(optionsHtml, /<h1 id="ai-title">书签智能分析<\/h1>/)
  assert.match(optionsHtml, /id="ai-config-link"[^>]*>配置 API Key<\/a>/)
  assert.match(constants, /title: '书签智能分析'/)
  assert.doesNotMatch(optionsHtml, /标签与命名建议/)
  assert.doesNotMatch(constants, /标签与命名建议/)
})

test('options dashboard entry keeps the settings-page dashboard instead of redirecting to newtab', () => {
  const optionsHtml = readProjectFile('src/options/options.html')
  const optionsSource = readProjectFile('src/options/options.ts')
  const dashboardSource = readProjectFile('src/options/sections/dashboard.ts')

  const dashboardEntry = optionsHtml.match(/<a\s+class="options-dashboard-entry"[\s\S]*?<\/a>/)?.[0] || ''
  const dashboardPanel = optionsHtml.match(/<section[\s\S]*?id="dashboard"[\s\S]*?<\/section>/)?.[0] || ''
  assert.match(dashboardEntry, /href="#dashboard"/)
  assert.match(dashboardEntry, /data-section-link="dashboard"/)
  assert.doesNotMatch(dashboardEntry, /newtab\.html#dashboard/)
  assert.doesNotMatch(dashboardEntry, /data-dashboard-entry/)

  assert.match(dashboardPanel, /class="options-panel dashboard-panel"/)
  assert.match(dashboardPanel, /data-section-panel="dashboard"/)
  assert.match(dashboardPanel, /data-dashboard-action="exit-dashboard"/)
  assert.match(optionsSource, /document\.body\.classList\.toggle\('dashboard-fullscreen-active', key === 'dashboard'\)/)
  assert.match(optionsSource, /options-dashboard-embed/)
  assert.match(optionsSource, /let activeSectionKey = ''/)
  assert.match(optionsSource, /previousSectionKey !== 'dashboard' && key === 'dashboard'[\s\S]*?prepareDashboardSectionEntry\(\)/)
  assert.match(optionsSource, /curator:newtab-dashboard-close/)
  assert.match(optionsSource, /curator:newtab-dashboard-ready/)
  assert.match(optionsSource, /notifyNewTabDashboardReady/)
  assert.match(optionsSource, /newTabDashboardReadyPosted/)
  assert.match(optionsSource, /hydrateAvailabilityCatalog\(\{ analyzeFolderCleanup: !IS_OPTIONS_DASHBOARD_EMBED_MODE \}\)/)
  assert.match(optionsSource, /postMessage/)
  assert.match(dashboardSource, /action === 'exit-dashboard'[\s\S]*callbacks\.exitDashboard\(\)/)
  assert.match(dashboardSource, /callbacks\.exitDashboard[\s\S]*window\.location\.hash = '#general'/)
  assert.doesNotMatch(optionsSource, /NEWTAB_DASHBOARD_PATH|openNewTabDashboard|handleDashboardEntryClick/)
})

test('options shell keeps brand and sidebar fixed while the main settings area scrolls', () => {
  const optionsCss = readProjectFile('src/options/options.css')
  const shellRule = getCssRuleBody(optionsCss, '.options-shell')

  assert.match(optionsCss, /--options-sidebar-width:\s*244px/)
  assert.match(optionsCss, /--options-brand-height:\s*86px/)
  assert.match(optionsCss, /--options-main-gutter:\s*clamp\(28px,\s*5vw,\s*88px\)/)
  assert.match(optionsCss, /--options-sidebar-gap:\s*18px/)
  assert.match(shellRule, /display:\s*grid/)
  assert.match(shellRule, /grid-template-columns:\s*var\(--options-sidebar-width\)\s+minmax\(0,\s*1fr\)/)
  assert.match(shellRule, /justify-content:\s*stretch/)
  assert.match(shellRule, /height:\s*100vh/)
  assert.match(shellRule, /padding:\s*0/)
  assert.match(shellRule, /overflow:\s*hidden/)
  assert.doesNotMatch(shellRule, /justify-content:\s*center/)
  assert.match(optionsCss, /\.options-header\s*\{[\s\S]*?position:\s*sticky[\s\S]*?top:\s*0[\s\S]*?width:\s*100%[\s\S]*?min-height:\s*var\(--options-brand-height\)[\s\S]*?padding:\s*14px\s+16px\s+0/)
  assert.match(optionsCss, /\.options-brand\s*\{[\s\S]*?padding:\s*6px\s+0/)
  assert.match(optionsCss, /\.options-brand-eyebrow\s*\{[\s\S]*?font-size:\s*9px[\s\S]*?white-space:\s*nowrap/)
  assert.match(optionsCss, /\.options-brand-copy strong\s*\{[\s\S]*?font-size:\s*17px[\s\S]*?white-space:\s*nowrap/)
  assert.match(optionsCss, /\.options-layout\s*\{[\s\S]*?grid-template-columns:\s*var\(--options-sidebar-width\)\s+minmax\(0,\s*1fr\)[\s\S]*?gap:\s*0[\s\S]*?height:\s*100%[\s\S]*?pointer-events:\s*none/)
  assert.match(optionsCss, /\.options-sidebar\s*\{[\s\S]*?position:\s*sticky[\s\S]*?top:\s*calc\(var\(--options-brand-height\) \+ var\(--options-sidebar-gap\)\)[\s\S]*?max-height:\s*calc\(100vh - var\(--options-brand-height\) - var\(--options-sidebar-gap\) - 24px\)[\s\S]*?margin-top:\s*var\(--options-sidebar-gap\)[\s\S]*?pointer-events:\s*auto/)
  assert.match(optionsCss, /\.options-nav\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)[\s\S]*?justify-content:\s*stretch/)
  assert.match(optionsCss, /\.options-main\s*\{[\s\S]*?height:\s*100%[\s\S]*?overflow:\s*auto[\s\S]*?padding:\s*24px\s+var\(--options-main-gutter\)\s+56px[\s\S]*?pointer-events:\s*auto[\s\S]*?scrollbar-gutter:\s*stable/)
  assert.match(optionsCss, /\.options-main\s*>\s*\.options-panel\s*\{[\s\S]*?width:\s*min\(100%,\s*var\(--options-content-max-width\)\)[\s\S]*?margin-inline:\s*auto/)
  assert.match(optionsCss, /--options-content-max-width:\s*1120px/)
})

test('options shell uses an explicit outer scroll container on narrow screens', () => {
  const optionsCss = readProjectFile('src/options/options.css')

  assert.match(optionsCss, /@media \(max-width:\s*920px\)\s*\{[\s\S]*?html\s*\{[\s\S]*?height:\s*100%[\s\S]*?overflow:\s*hidden[\s\S]*?body\s*\{[\s\S]*?min-height:\s*100dvh[\s\S]*?overflow:\s*hidden/)
  assert.match(optionsCss, /@media \(max-width:\s*920px\)\s*\{[\s\S]*?\.options-shell\s*\{[\s\S]*?display:\s*block[\s\S]*?height:\s*100dvh[\s\S]*?max-height:\s*100dvh[\s\S]*?overflow-x:\s*hidden[\s\S]*?overflow-y:\s*auto[\s\S]*?overscroll-behavior:\s*contain/)
  assert.match(optionsCss, /@media \(max-width:\s*920px\)\s*\{[\s\S]*?\.options-sidebar\s*\{[\s\S]*?margin-top:\s*0/)
  assert.match(optionsCss, /@media \(max-width:\s*920px\)\s*\{[\s\S]*?\.options-sidebar\s*\{[\s\S]*?grid-column:\s*1[\s\S]*?grid-row:\s*1/)
  assert.match(optionsCss, /@media \(max-width:\s*920px\)\s*\{[\s\S]*?\.options-nav\s*\{[\s\S]*?grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(148px,\s*1fr\)\)/)
  assert.match(optionsCss, /@media \(max-width:\s*920px\)\s*\{[\s\S]*?\.options-nav-link,[\s\S]*?\.options-nav-group-trigger\s*\{[\s\S]*?min-height:\s*38px[\s\S]*?width:\s*100%/)
  assert.match(optionsCss, /@media \(max-width:\s*920px\)\s*\{[\s\S]*?\.options-nav-group-trigger,[\s\S]*?\.options-nav-subitem,[\s\S]*?\.options-dashboard-entry\s*\{[\s\S]*?writing-mode:\s*horizontal-tb/)
  assert.match(optionsCss, /@media \(max-width:\s*920px\)\s*\{[\s\S]*?\.options-main\s*\{[\s\S]*?height:\s*auto[\s\S]*?overflow:\s*visible/)
  assert.match(optionsCss, /@media \(max-width:\s*920px\)\s*\{[\s\S]*?\.options-main\s*\{[\s\S]*?grid-column:\s*1[\s\S]*?grid-row:\s*2/)
  assert.match(optionsCss, /@media \(max-width:\s*920px\)\s*\{[\s\S]*?\.options-main\s*>\s*\.options-panel\s*\{[\s\S]*?width:\s*100%[\s\S]*?margin-inline:\s*0/)
  assert.doesNotMatch(optionsCss, /@media \(max-width:\s*920px\)[\s\S]*?\.options-shell\s*\{[^}]*overflow:\s*visible/)
  assert.match(optionsCss, /\.dashboard-fullscreen-active\s+\.options-shell\s*\{[\s\S]*?height:\s*100vh[\s\S]*?overflow:\s*hidden/)
})

test('dashboard fullscreen and embedded mode reset the options shell scroll layout', () => {
  const optionsCss = readProjectFile('src/options/options.css')

  assert.match(optionsCss, /\.dashboard-fullscreen-active\s+\.options-shell\s*\{[\s\S]*?display:\s*block[\s\S]*?height:\s*100vh[\s\S]*?overflow:\s*hidden/)
  assert.match(optionsCss, /\.dashboard-fullscreen-active\s+\.options-layout\s*\{[\s\S]*?display:\s*block[\s\S]*?height:\s*100vh[\s\S]*?pointer-events:\s*auto/)
  assert.match(optionsCss, /\.dashboard-fullscreen-active\s+\.options-main\s*\{[\s\S]*?height:\s*100vh[\s\S]*?overflow:\s*hidden[\s\S]*?padding:\s*0/)
  assert.match(optionsCss, /\.dashboard-fullscreen-active\s+\.options-main\s*>\s*\.options-panel\s*\{[\s\S]*?width:\s*100%[\s\S]*?max-width:\s*none[\s\S]*?margin-inline:\s*0/)
  assert.match(optionsCss, /\.options-dashboard-embed\.dashboard-fullscreen-active\s+\.options-shell,\s*\.options-dashboard-embed\.dashboard-fullscreen-active\s+\.options-layout,\s*\.options-dashboard-embed\.dashboard-fullscreen-active\s+\.options-main,\s*\.options-dashboard-embed\.dashboard-fullscreen-active\s+\.dashboard-panel\s*\{[\s\S]*?background:\s*transparent/)
})
