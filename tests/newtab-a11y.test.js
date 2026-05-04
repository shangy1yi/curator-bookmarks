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
  assert.match(newtabSource, /function restoreDashboardFocus\(\): void/)
})
