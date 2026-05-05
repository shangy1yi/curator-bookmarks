import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import { shouldReuseBookmarkForSave } from '../src/service-worker/save-guards.js'
import { normalizeBookmarkSaveUrl } from '../src/shared/bookmark-save-url.js'

function readProjectFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

test('normalizes bookmark save urls for equivalent current-page variants', () => {
  assert.equal(
    normalizeBookmarkSaveUrl('HTTPS://www.Example.com/Docs/#Intro'),
    'example.com/docs'
  )
  assert.equal(
    normalizeBookmarkSaveUrl('https://example.com/docs///#section'),
    'example.com/docs'
  )
  assert.equal(
    normalizeBookmarkSaveUrl('https://www.example.com/'),
    'example.com/'
  )
  assert.equal(
    normalizeBookmarkSaveUrl('www.Example.com/Docs/#Intro'),
    'example.com/docs'
  )
})

test('popup smart save only reuses a bookmark id when save urls still match', () => {
  assert.equal(
    shouldReuseBookmarkForSave('https://example.com/docs#intro', 'https://example.com/docs'),
    true
  )
  assert.equal(
    shouldReuseBookmarkForSave('https://www.Example.com/Docs/#intro', 'https://example.com/docs'),
    true
  )
  assert.equal(
    shouldReuseBookmarkForSave('https://example.com/docs/', 'https://www.example.com/docs#top'),
    true
  )
  assert.equal(
    shouldReuseBookmarkForSave('https://example.com/old', 'https://example.com/current'),
    false
  )
  assert.equal(
    shouldReuseBookmarkForSave('https://example.com/docs?view=old', 'https://example.com/docs?view=current'),
    false
  )
  assert.equal(shouldReuseBookmarkForSave('', 'https://example.com/current'), false)
})

test('popup current-page matching uses the shared bookmark save url normalizer', () => {
  const source = readProjectFile('src/popup/popup.ts')

  assert.match(source, /from '\.\.\/shared\/bookmark-save-url\.js'/)
  assert.match(source, /const normalizedCurrentUrl = normalizeBookmarkSaveUrl\(currentUrl\)/)
  assert.match(source, /bookmark\.duplicateKey === normalizedCurrentUrl/)
})

test('auto analyze queue reuses a tree snapshot within one processing pass', () => {
  const source = readProjectFile('src/service-worker/service-worker.ts')

  assert.match(source, /interface AutoAnalyzeTreeContext/)
  assert.match(source, /let autoAnalyzeTreeContext: AutoAnalyzeTreeContext \| null = null/)
  assert.match(source, /await runAutoAnalysisForBookmark\(entry, await getAutoAnalyzeTreeContext\(\)\)/)
  assert.match(source, /function invalidateAutoAnalyzeTreeContext\(\)/)
  assert.match(source, /if \(moved\) \{[\s\S]*?invalidateAutoAnalyzeTreeContext\(\)/)
})

test('auto analyze queue failure schedules wake from remaining queue state', () => {
  const source = readProjectFile('src/service-worker/service-worker.ts')
  const failureBody = source.match(/async function markAutoAnalyzeQueueEntryFailed[\s\S]*?\n}\n\nasync function removeAutoAnalyzeQueueEntry/)?.[0] || ''

  assert.match(failureBody, /const nextQueue = await updateAutoAnalyzeQueue/)
  assert.match(failureBody, /scheduleNextAutoAnalyzeQueueWake\(nextQueue\)/)
  assert.doesNotMatch(failureBody, /scheduleAutoAnalyzeQueueAlarm\(AUTO_ANALYZE_QUEUE_RETRY_MS\)/)
})

test('availability background navigation closes at DOM readiness before page preload warnings', () => {
  const source = readProjectFile('src/service-worker/service-worker.ts')
  const domReadyBody = source.match(
    /chrome\.webNavigation\.onDOMContentLoaded\.addListener\(\(details\) => \{[\s\S]*?\n\}\)\n\nchrome\.webNavigation\.onErrorOccurred/
  )?.[0] || ''

  assert.match(domReadyBody, /getPendingState\(details\)/)
  assert.match(domReadyBody, /isAboutBlank\(details\.url\)/)
  assert.match(domReadyBody, /finalizeNavigationCheck\(details\.tabId/)
  assert.match(domReadyBody, /后台标签页已完成 DOM 就绪检测/)
  assert.match(source, /chrome\.webNavigation\.onCompleted\.addListener/)
})

test('runtime notification messages are created by the service worker', () => {
  const source = readProjectFile('src/service-worker/service-worker.ts')
  const messagesSource = readProjectFile('src/shared/messages.ts')

  assert.match(messagesSource, /export interface RuntimeNotificationMessage/)
  assert.match(source, /\| RuntimeNotificationMessage/)
  assert.match(source, /if \(message\?\.type === 'notification:create'\)/)
  assert.match(source, /showRuntimeNotification\(message\)/)
  assert.match(source, /function showRuntimeNotification\(message: RuntimeNotificationMessage\)/)
  assert.match(source, /chrome\.notifications\.create\(notificationId,[\s\S]*?iconUrl: 'src\/assets\/icon128\.png'/)
})
