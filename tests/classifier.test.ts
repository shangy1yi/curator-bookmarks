import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildFailureClassification,
  buildNavigationSuccess,
  classifyNavigationNetworkEvidence,
  classifyProbeError,
  classifyProbeResponse,
  formatNavigationNetworkEvidence,
  isRedirectedNavigation,
  normalizeNavigationUrl,
  shouldAcceptNavigationSuccess,
  shouldClassifyAsHighConfidence,
  shouldFallbackToGet,
  shouldRetryNavigation,
  summarizeNavigationEvidence
} from '../src/options/sections/classifier.js'

const bookmark = {
  id: '1',
  title: 'Example',
  url: 'https://example.com/docs',
  displayUrl: 'example.com/docs',
  normalizedTitle: 'example',
  normalizedUrl: 'example.com/docs',
  duplicateKey: 'example.com/docs',
  path: 'Bookmarks Bar',
  domain: 'example.com',
  parentId: '10',
  ancestorIds: ['10'],
  index: 0,
  dateAdded: 1
}

function navigationAttempt(errorCode: string, status: 'available' | 'failed' = 'failed') {
  return {
    status,
    finalUrl: bookmark.url,
    detail: errorCode ? `后台导航失败：${errorCode}` : '后台导航成功',
    errorCode
  }
}

function probeResponse(status: number, ok = false) {
  return {
    ok,
    status,
    redirected: false,
    url: bookmark.url
  }
}

function networkEvidence(statusCode: number, overrides = {}) {
  return {
    requestSent: true,
    requestId: 'request-1',
    method: 'GET',
    requestedUrl: bookmark.url,
    finalUrl: bookmark.url,
    statusCode,
    redirects: [],
    timing: {
      requestStartMs: 100,
      responseStartMs: 180,
      completedMs: 240,
      responseLatencyMs: 80,
      totalMs: 140
    },
    ...overrides
  }
}

test('normalizes navigation URLs without protocol, www, hash or query ordering differences', () => {
  assert.equal(
    normalizeNavigationUrl('https://www.Example.com/docs/?b=2&a=1#intro'),
    'example.com/docs?a=1&b=2'
  )
  assert.equal(
    isRedirectedNavigation(
      'http://www.example.com/docs/?b=2&a=1#old',
      'https://example.com/docs?a=1&b=2#new'
    ),
    false
  )
  assert.equal(isRedirectedNavigation('https://example.com/docs', 'https://example.com/new'), true)
})

test('builds navigation success results and marks real redirects', () => {
  const available = buildNavigationSuccess(
    bookmark,
    {
      status: 'available',
      finalUrl: 'https://example.com/docs#loaded',
      detail: '',
      errorCode: ''
    },
    '首轮后台导航成功'
  )
  assert.equal(available.status, 'available')

  const redirected = buildNavigationSuccess(
    bookmark,
    {
      status: 'available',
      finalUrl: 'https://example.com/new-docs',
      detail: '',
      errorCode: ''
    },
    '首轮后台导航成功'
  )
  assert.equal(redirected.status, 'redirected')
  assert.equal(redirected.finalUrl, 'https://example.com/new-docs')
})

test('identifies retryable navigation failures', () => {
  assert.equal(shouldRetryNavigation(navigationAttempt('timeout')), true)
  assert.equal(shouldRetryNavigation(navigationAttempt('net::ERR_ABORTED')), true)
  assert.equal(shouldRetryNavigation(navigationAttempt('net::ERR_NAME_NOT_RESOLVED')), false)
  assert.equal(shouldRetryNavigation(navigationAttempt('', 'available')), false)
})

test('accepts navigation success only when main request is not an HTTP failure', () => {
  assert.equal(shouldAcceptNavigationSuccess(navigationAttempt('', 'available')), false)
  assert.equal(
    shouldAcceptNavigationSuccess({
      ...navigationAttempt('', 'available'),
      networkEvidence: networkEvidence(200)
    }),
    true
  )
  assert.equal(
    shouldAcceptNavigationSuccess({
      ...navigationAttempt('', 'available'),
      networkEvidence: networkEvidence(404)
    }),
    false
  )
  assert.equal(
    shouldAcceptNavigationSuccess({
      ...navigationAttempt('', 'available'),
      networkEvidence: networkEvidence(302, {
        finalUrl: 'https://example.net/login',
        finalResponseObserved: false,
        redirects: [
          {
            url: bookmark.url,
            redirectUrl: 'https://example.net/login',
            statusCode: 302
          }
        ]
      })
    }),
    false
  )
  assert.equal(
    shouldAcceptNavigationSuccess({
      ...navigationAttempt('', 'available'),
      finalUrl: 'https://example.net/login',
      networkEvidence: networkEvidence(302, {
        statusUrl: bookmark.url,
        finalUrl: 'https://example.net/login',
        finalResponseObserved: false,
        redirects: [
          {
            url: bookmark.url,
            redirectUrl: 'https://example.net/login',
            statusCode: 302
          }
        ]
      })
    }),
    false
  )
})

test('classifies HTTP probe responses', () => {
  assert.deepEqual(
    classifyProbeResponse({ ok: true, status: 200, redirected: false, url: 'https://example.com/docs' }, 'GET'),
    {
      kind: 'ok',
      method: 'GET',
      label: '探测可达',
      detail: '网络探测(GET)可达。'
    }
  )
  assert.equal(classifyProbeResponse(probeResponse(404), 'GET').kind, 'missing')
  assert.equal(classifyProbeResponse(probeResponse(403), 'HEAD').kind, 'restricted')
  assert.equal(classifyProbeResponse(probeResponse(503), 'GET').kind, 'temporary')
  assert.equal(classifyProbeResponse(probeResponse(418), 'GET').kind, 'unknown')
})

test('classifies main-frame network evidence and formats timings', () => {
  const missingProbe = classifyNavigationNetworkEvidence(networkEvidence(404))
  assert.equal(missingProbe?.kind, 'missing')
  assert.equal(missingProbe?.label, 'HTTP 404')
  assert.ok(/主请求返回 HTTP 404/.test(missingProbe?.detail || ''))
  assert.ok(/响应头 80ms/.test(missingProbe?.detail || ''))
  assert.ok(/总耗时 140ms/.test(missingProbe?.detail || ''))

  assert.equal(classifyNavigationNetworkEvidence(networkEvidence(403))?.kind, 'restricted')
  assert.equal(classifyNavigationNetworkEvidence(networkEvidence(503))?.kind, 'temporary')
  assert.equal(classifyNavigationNetworkEvidence(networkEvidence(204))?.kind, 'ok')
  assert.equal(
    classifyNavigationNetworkEvidence({
      ...networkEvidence(0),
      statusCode: undefined,
      errorCode: 'net::ERR_NAME_NOT_RESOLVED'
    })?.kind,
    'network'
  )
  assert.equal(
    formatNavigationNetworkEvidence({
      ...networkEvidence(301),
      finalResponseObserved: false,
      redirects: [
        {
          url: bookmark.url,
          redirectUrl: 'https://example.com/new',
          statusCode: 301,
          elapsedMs: 20
        }
      ]
    }),
    '主请求返回 HTTP 301，重定向 1 次，未确认最终页面响应，响应头 80ms，总耗时 140ms。'
  )
  const unverifiedRedirectProbe = classifyNavigationNetworkEvidence({
    ...networkEvidence(302),
    finalUrl: 'https://example.net/login',
    finalResponseObserved: false,
    redirects: [
      {
        url: bookmark.url,
        redirectUrl: 'https://example.net/login',
        statusCode: 302
      }
    ]
  })
  assert.equal(unverifiedRedirectProbe?.kind, 'unknown')
  assert.equal(unverifiedRedirectProbe?.label, '最终响应未确认')
})

test('knows when HEAD should fall back to GET', () => {
  assert.equal(shouldFallbackToGet(403), true)
  assert.equal(shouldFallbackToGet(405), true)
  assert.equal(shouldFallbackToGet(404), false)
  assert.equal(shouldFallbackToGet(200), false)
})

test('summarizes navigation evidence for high-confidence decisions', () => {
  const evidence = summarizeNavigationEvidence([
    { status: 'failed', errorCode: 'net::ERR_CONNECTION_RESET', detail: '', finalUrl: bookmark.url },
    { status: 'failed', errorCode: 'net::ERR_CONNECTION_RESET', detail: '', finalUrl: bookmark.url }
  ])

  assert.equal(evidence.repeatedStrongFailure, true)
  assert.equal(shouldClassifyAsHighConfidence(evidence, 'network'), true)

  const timeoutEvidence = summarizeNavigationEvidence([
    { status: 'failed', errorCode: 'timeout', detail: '', finalUrl: bookmark.url }
  ])
  assert.equal(shouldClassifyAsHighConfidence(timeoutEvidence, 'network'), false)
})

test('builds failure classifications from navigation and probe evidence', () => {
  const attempts = [navigationAttempt('net::ERR_NAME_NOT_RESOLVED')]

  assert.equal(
    buildFailureClassification(bookmark, attempts, null, false).status,
    'review'
  )
  assert.equal(
    buildFailureClassification(bookmark, attempts, { kind: 'missing', method: 'GET', label: 'HTTP 404', detail: '' }, true).status,
    'failed'
  )
  assert.equal(
    buildFailureClassification(bookmark, attempts, { kind: 'ok', method: 'GET', label: '探测可达', detail: '' }, true).status,
    'review'
  )
  assert.equal(
    buildFailureClassification(
      bookmark,
      [{ ...navigationAttempt('', 'available'), detail: '后台标签页已完成页面导航。' }],
      { kind: 'ok', method: 'GET', label: '探测可达', detail: '网络探测(GET)可达。' },
      true
    ).detail,
    '首轮：后台标签页已完成页面导航。网络探测(GET)返回可访问，站点可能仍可用；暂归为低置信异常，建议人工确认。'
  )
  assert.doesNotMatch(
    buildFailureClassification(
      bookmark,
      [{ ...navigationAttempt('', 'available'), detail: '后台标签页已完成页面导航。' }],
      { kind: 'ok', method: 'GET', label: '探测可达', detail: '网络探测(GET)可达。' },
      true
    ).detail,
    /。。|。但/
  )

  assert.equal(
    buildFailureClassification(
      bookmark,
      [{ ...navigationAttempt('', 'available'), networkEvidence: networkEvidence(404) }],
      { kind: 'ok', method: 'GET', label: '探测可达', detail: '网络探测(GET)可达。' },
      true
    ).status,
    'failed'
  )
})

test('classifies fetch probe errors', () => {
  assert.equal(classifyProbeError(new DOMException('timeout', 'AbortError')).kind, 'unknown')
  assert.equal(classifyProbeError(new TypeError('failed to fetch')).kind, 'network')
  assert.equal(classifyProbeError(new Error('custom failure')).kind, 'unknown')
})
