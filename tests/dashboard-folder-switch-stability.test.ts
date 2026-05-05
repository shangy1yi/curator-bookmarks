import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import {
  shouldRevealDashboardPanelAfterRender,
  shouldResetDashboardPanelRevealForSectionEntry,
  shouldResetDashboardPanelRevealForRender,
  shouldResetDashboardVirtualScrollForFilterChange
} from '../src/options/sections/dashboard.js'

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

test('dashboard section entry resets reveal before showing cached cards', () => {
  assert.equal(
    shouldResetDashboardPanelRevealForSectionEntry({
      previousSectionKey: 'general',
      nextSectionKey: 'dashboard'
    }),
    true
  )
  assert.equal(
    shouldResetDashboardPanelRevealForSectionEntry({
      previousSectionKey: 'dashboard',
      nextSectionKey: 'dashboard'
    }),
    false
  )
  assert.equal(
    shouldResetDashboardPanelRevealForSectionEntry({
      previousSectionKey: 'dashboard',
      nextSectionKey: 'general'
    }),
    false
  )
})

test('dashboard folder switches do not reset the ready panel reveal', () => {
  assert.equal(
    shouldResetDashboardPanelRevealForRender({ catalogLoading: false, viewReady: true }),
    false
  )
  assert.equal(
    shouldResetDashboardPanelRevealForRender({ catalogLoading: false, viewReady: false }),
    false
  )
  assert.equal(
    shouldResetDashboardPanelRevealForRender({ catalogLoading: true, viewReady: true }),
    true
  )
})

test('dashboard folder switch update state masks partially rendered cards', () => {
  const testDir = dirname(fileURLToPath(import.meta.url))
  const cssPath = resolve(testDir, '../../src/options/options.css')
  const css = readFileSync(cssPath, 'utf8')
  const updatingRule = css.match(/\.dashboard-card-grid\.is-updating\s*\{[\s\S]*?\n\}/)?.[0] || ''

  assert.doesNotMatch(updatingRule, /content-visibility/)
  assert.doesNotMatch(updatingRule, /overflow:\s*hidden/)
  assert.match(updatingRule, /overflow-x:\s*hidden/)
  assert.match(updatingRule, /overflow-y:\s*auto/)
  assert.match(css, /\.dashboard-card-grid\s*\{[\s\S]*?scrollbar-gutter:\s*stable/)
  assert.match(css, /\.dashboard-card-grid\.is-updating\s*>\s*\*\s*\{[\s\S]*?opacity:\s*0/)
  assert.match(css, /\.dashboard-card-grid\.is-updating::before/)
  assert.doesNotMatch(css, /\.dashboard-card-grid\.is-updating::after/)
  assert.doesNotMatch(css, /正在更新视图/)
  assert.match(css, /\.dashboard-update-overlay\s*\{[\s\S]*?position:\s*absolute[\s\S]*?pointer-events:\s*none/)
  assert.match(css, /\.dashboard-update-indicator\s*\{[\s\S]*?width:\s*54px[\s\S]*?border-radius:\s*16px/)
  assert.match(css, /\.dashboard-update-dot-loader\s*\{[\s\S]*?width:\s*30px[\s\S]*?height:\s*30px/)
})

test('dashboard folder switch chrome keeps text layout stable', () => {
  const testDir = dirname(fileURLToPath(import.meta.url))
  const cssPath = resolve(testDir, '../../src/options/options.css')
  const css = readFileSync(cssPath, 'utf8')
  const titleActionsRule = css.match(/\.dashboard-title-actions\s*\{[\s\S]*?\n\}/)?.[0] || ''
  const statusRule = css.match(/#dashboard-status\s*\{[\s\S]*?\n\}/)?.[0] || ''
  const breadcrumbRule = css.match(/\.dashboard-folder-breadcrumb-list\s*\{[\s\S]*?\n\}/)?.[0] || ''

  assert.match(titleActionsRule, /grid-template-columns:\s*minmax\(0,\s*var\(--dashboard-status-width\)\)\s+auto/)
  assert.match(statusRule, /width:\s*var\(--dashboard-status-width\)/)
  assert.match(statusRule, /overflow:\s*hidden/)
  assert.match(statusRule, /text-overflow:\s*ellipsis/)
  assert.match(statusRule, /white-space:\s*nowrap/)
  assert.match(css, /#dashboard-status:empty\s*\{[\s\S]*?visibility:\s*hidden/)
  assert.match(css, /\.dashboard-folder-breadcrumbs\s*\{[\s\S]*?min-height:\s*22px/)
  assert.match(breadcrumbRule, /flex-wrap:\s*nowrap/)
  assert.match(breadcrumbRule, /overflow:\s*hidden/)
  assert.match(css, /\.dashboard-folder-breadcrumb-list\s+li:last-child\s*\{[\s\S]*?flex:\s*1\s+1\s+auto/)
})

test('dashboard initial reveal waits for the latest committed card render', () => {
  assert.equal(
    shouldRevealDashboardPanelAfterRender({
      catalogLoading: true,
      viewReady: false,
      revealFramePending: false,
      latestRenderVersion: 1,
      revealRenderVersion: 1,
      committedRenderVersion: 1
    }),
    false,
    'catalog loading must keep the initial dashboard hidden'
  )

  assert.equal(
    shouldRevealDashboardPanelAfterRender({
      catalogLoading: false,
      viewReady: false,
      revealFramePending: false,
      latestRenderVersion: 2,
      revealRenderVersion: 2,
      committedRenderVersion: 1
    }),
    false,
    'dashboard must not reveal before the card grid commits'
  )

  assert.equal(
    shouldRevealDashboardPanelAfterRender({
      catalogLoading: false,
      viewReady: false,
      revealFramePending: false,
      latestRenderVersion: 3,
      revealRenderVersion: 2,
      committedRenderVersion: 2
    }),
    false,
    'stale reveal frames must not expose a previous partial render'
  )

  assert.equal(
    shouldRevealDashboardPanelAfterRender({
      catalogLoading: false,
      viewReady: false,
      revealFramePending: false,
      latestRenderVersion: 3,
      revealRenderVersion: 3,
      committedRenderVersion: 3
    }),
    true,
    'dashboard can reveal only after the current card render has committed'
  )
})

test('dashboard initial loading state hides real cards instead of only fading them', () => {
  const testDir = dirname(fileURLToPath(import.meta.url))
  const cssPath = resolve(testDir, '../../src/options/options.css')
  const css = readFileSync(cssPath, 'utf8')
  const notReadyRule = css.match(
    /\.dashboard-panel\[data-dashboard-ready="false"\]\s+\.dashboard-title-row,[\s\S]*?\.dashboard-panel\[data-dashboard-ready="false"\]\s+\.dashboard-results-group\s*\{[\s\S]*?\n\}/
  )?.[0] || ''

  assert.match(notReadyRule, /opacity:\s*0/)
  assert.match(notReadyRule, /visibility:\s*hidden/)
  assert.match(notReadyRule, /pointer-events:\s*none/)
})

test('dashboard folder filter changes preserve virtual scroll reset state', () => {
  assert.equal(
    shouldResetDashboardVirtualScrollForFilterChange({
      previousKey: 'query\u0001domain\u0001month\u0001date-desc',
      nextKey: 'query\u0001domain\u0001month\u0001date-desc',
      reason: 'folder'
    }),
    false
  )
  assert.equal(
    shouldResetDashboardVirtualScrollForFilterChange({
      previousKey: 'query\u0001domain\u0001month\u0001date-desc',
      nextKey: 'query\u0001folder-2\u0001domain\u0001month\u0001date-desc',
      reason: 'folder'
    }),
    false
  )
  assert.equal(
    shouldResetDashboardVirtualScrollForFilterChange({
      previousKey: '',
      nextKey: 'new-query\u0001folder-2\u0001domain\u0001month\u0001date-desc',
      reason: 'query'
    }),
    true
  )
})

test('dashboard resize observer masks stale virtual cards before rerender', () => {
  const testDir = dirname(fileURLToPath(import.meta.url))
  const sourcePath = resolve(testDir, '../../src/options/sections/dashboard.ts')
  const source = readFileSync(sourcePath, 'utf8')
  const resizeHandlerBody = source.match(
    /function handleDashboardVirtualResize\(\): void\s*\{([\s\S]*?)\n\}\n\nfunction scheduleDashboardVirtualResize/
  )?.[1] || ''
  const resizeSchedulerBody = source.match(
    /function scheduleDashboardVirtualResize\([\s\S]*?\n\}\n\nfunction commitDashboardVirtualResize/
  )?.[0] || ''
  const resizeCommitBody = source.match(
    /function commitDashboardVirtualResize\([\s\S]*?\n\}\n\nfunction beginDashboardSelectionCompositeMotion/
  )?.[0] || ''

  assert.match(source, /new ResizeObserver\(handleDashboardVirtualResize\)/)
  assert.match(resizeHandlerBody, /dashboardSelectionCompositeMotionActive/)
  assert.match(resizeHandlerBody, /dashboardVirtualResizeDeferredForSelection\s*=\s*true/)
  assert.match(resizeHandlerBody, /scheduleDashboardVirtualResize\(\)/)
  assert.doesNotMatch(resizeHandlerBody, /beginStableDashboardResultsUpdate\(\)/)
  assert.doesNotMatch(resizeHandlerBody, /resetDashboardVirtualRenderCache/)
  assert.doesNotMatch(resizeHandlerBody, /scheduleDashboardVirtualRender\(\)/)
  assert.match(resizeSchedulerBody, /window\.requestAnimationFrame/)
  assert.match(resizeSchedulerBody, /commitDashboardVirtualResize\(\{\s*showMask\s*\}\)/)
  assert.doesNotMatch(resizeSchedulerBody, /resetDashboardVirtualRenderCache/)
  assert.doesNotMatch(resizeSchedulerBody, /scheduleDashboardVirtualRender\(\)/)
  assert.match(resizeCommitBody, /beginStableDashboardResultsUpdate\(\)/)
  assert.match(resizeCommitBody, /resetDashboardVirtualRenderCache\(\{\s*preserveItems:\s*true\s*\}\)/)
  assert.match(resizeCommitBody, /renderDashboardCards\(virtualState\.items\)/)
  assert.doesNotMatch(resizeCommitBody, /scheduleDashboardVirtualRender\(\)/)
})

test('dashboard stable update overlay uses the shared dot matrix loader', () => {
  const testDir = dirname(fileURLToPath(import.meta.url))
  const sourcePath = resolve(testDir, '../../src/options/sections/dashboard.ts')
  const domPath = resolve(testDir, '../../src/options/shared-options/dom.ts')
  const source = readFileSync(sourcePath, 'utf8')
  const domSource = readFileSync(domPath, 'utf8')

  assert.match(domSource, /dashboardCardRegion\s*=\s*byId\('dashboard-card-region'\)/)
  assert.match(source, /function showDashboardResultsUpdateOverlay\(\)/)
  assert.match(source, /dom\.dashboardCardRegion/)
  assert.match(source, /renderDotMatrixLoader\(\{\s*variant:\s*'spiral',\s*className:\s*'dashboard-update-dot-loader'\s*\}\)/)
  assert.match(source, /overlay\.setAttribute\('aria-hidden',\s*'true'\)/)
  assert.match(source, /function hideDashboardResultsUpdateOverlay\(\)[\s\S]*?dashboardResultsUpdateOverlay\?\.remove\(\)/)
})

test('dashboard selection motion reuses the transform path for every list size', () => {
  const testDir = dirname(fileURLToPath(import.meta.url))
  const sourcePath = resolve(testDir, '../../src/options/sections/dashboard.ts')
  const source = readFileSync(sourcePath, 'utf8')
  const finishMotionBody = source.match(
    /function finishDashboardSelectionCompositeMotion\([\s\S]*?\n\}\n\nfunction handleDashboardVirtualScroll/
  )?.[0] || ''

  assert.match(source, /const DASHBOARD_SELECTION_MOTION_MS\s*=\s*260/)
  assert.match(source, /function shouldUseDashboardSelectionCompositeMotion\(\): boolean\s*\{[\s\S]*?return\s+true/)
  assert.match(source, /const useCompositeMotion\s*=\s*shouldUseDashboardSelectionCompositeMotion\(\)/)
  assert.match(source, /data-dashboard-selection-motion[\s\S]*?useCompositeMotion\s*\?\s*'composite'\s*:\s*'layout'/)
  assert.match(source, /function transitionDashboardSelectionBarVisibility\([\s\S]*?getBoundingClientRect\(\)\.top[\s\S]*?beginDashboardSelectionCompositeMotion\(\)[\s\S]*?classList\.toggle\('hidden',\s*shouldHideSelection\)[\s\S]*?animateDashboardSelectionCardRegionShift/)
  assert.match(finishMotionBody, /dashboardVirtualResizeDeferredForSelection/)
  assert.match(finishMotionBody, /commitDashboardVirtualResize\(\{\s*showMask:\s*false,\s*preserveRenderedWindow:\s*true\s*\}\)/)
  assert.doesNotMatch(finishMotionBody, /resetDashboardVirtualRenderCache\(\{\s*preserveItems:\s*true\s*\}\)/)
  assert.doesNotMatch(finishMotionBody, /scheduleDashboardVirtualRender\(\)/)
  assert.doesNotMatch(finishMotionBody, /beginStableDashboardResultsUpdate\(\)/)

  const resizeBody = source.match(
    /function commitDashboardVirtualResize\([\s\S]*?\n\}\n\nfunction beginDashboardSelectionCompositeMotion/
  )?.[0] || ''
  assert.match(resizeBody, /if\s*\(preserveRenderedWindow\)\s*\{[\s\S]*?updateDashboardVirtualMetrics\(\)[\s\S]*?return/)
  assert.doesNotMatch(
    resizeBody.match(/if\s*\(preserveRenderedWindow\)\s*\{[\s\S]*?return/)?.[0] || '',
    /renderDashboardCards\(|resetDashboardVirtualRenderCache\(/
  )
})

test('dashboard selection inputs avoid duplicate click and input rerenders', () => {
  const testDir = dirname(fileURLToPath(import.meta.url))
  const sourcePath = resolve(testDir, '../../src/options/sections/dashboard.ts')
  const source = readFileSync(sourcePath, 'utf8')
  const selectionInputHelperBody = getFunctionBody(source, 'applyDashboardSelectionInputState')
  const selectionSyncBody = getFunctionBody(source, 'syncDashboardSelectionOnly')
  const inputHandlerBody = getFunctionBody(source, 'handleDashboardInput')
  const clickHandlerBody = getFunctionBody(source, 'handleDashboardClick')
  const selectVisibleBody = getFunctionBody(source, 'selectVisibleDashboardItems')
  const virtualStateKeyBody = getFunctionBody(source, 'getDashboardVirtualRenderStateKey')

  assert.match(selectionInputHelperBody, /isChecked\s*===\s*isSelected/)
  assert.match(selectionInputHelperBody, /return\s+false/)
  assert.match(inputHandlerBody, /if\s*\(applyDashboardSelectionInputState\(target as HTMLInputElement\)\)\s*\{\s*syncDashboardSelectionOnly\(\)/)
  assert.match(clickHandlerBody, /if\s*\(applyDashboardSelectionInputState\(selectionInput\)\)\s*\{\s*syncDashboardSelectionOnly\(\)/)
  assert.match(clickHandlerBody, /dashboardState\.selectedIds\.clear\(\)[\s\S]*?syncDashboardSelectionOnly\(\)/)
  assert.match(selectVisibleBody, /if\s*\(changed\)\s*\{\s*syncDashboardSelectionOnly\(\)/)
  assert.match(selectionSyncBody, /renderDashboardSelectionBar\(visibleItems\)/)
  assert.match(selectionSyncBody, /querySelectorAll<HTMLElement>\('\[data-dashboard-card\]'\)/)
  assert.match(selectionSyncBody, /card\.classList\.toggle\('selected',\s*selected\)/)
  assert.match(selectionSyncBody, /querySelector<HTMLInputElement>\('input\[data-dashboard-select\]'\)/)
  assert.match(selectionSyncBody, /input\.checked\s*=\s*selected/)
  assert.doesNotMatch(selectionSyncBody, /innerHTML/)
  assert.doesNotMatch(selectionSyncBody, /renderDashboardCards\(/)
  assert.doesNotMatch(selectionSyncBody, /renderDashboardSection\(/)
  assert.doesNotMatch(virtualStateKeyBody, /selectedIds/)
})
