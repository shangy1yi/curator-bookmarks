import { displayUrl, normalizeText } from '../../shared/text.js'
import type {
  AvailabilityResult,
  BookmarkRecord,
  NavigationAttempt,
  NavigationEvidence,
  NavigationNetworkEvidence,
  ProbeKind,
  ProbeResult
} from '../../shared/types.js'

export const FETCH_TIMEOUT_MS = 20000

const RETRYABLE_NAVIGATION_ERRORS = new Set([
  'timeout',
  'net::ERR_ABORTED',
  'net::ERR_CONNECTION_CLOSED',
  'net::ERR_CONNECTION_RESET',
  'net::ERR_CONNECTION_TIMED_OUT',
  'net::ERR_TIMED_OUT'
])

const STRONG_NAVIGATION_ERRORS = new Set([
  'timeout',
  'net::ERR_CONNECTION_CLOSED',
  'net::ERR_CONNECTION_RESET',
  'net::ERR_CONNECTION_REFUSED',
  'net::ERR_CONNECTION_TIMED_OUT',
  'net::ERR_TIMED_OUT',
  'net::ERR_NAME_NOT_RESOLVED',
  'net::ERR_ADDRESS_UNREACHABLE',
  'net::ERR_DNS_MALFORMED_RESPONSE',
  'net::ERR_DNS_SERVER_FAILED',
  'net::ERR_DNS_TIMED_OUT',
  'net::ERR_SSL_PROTOCOL_ERROR',
  'net::ERR_CERT_AUTHORITY_INVALID',
  'net::ERR_CERT_COMMON_NAME_INVALID',
  'net::ERR_SSL_VERSION_OR_CIPHER_MISMATCH'
])

const CLIENT_BLOCKING_NAVIGATION_ERRORS = new Set([
  'net::ERR_BLOCKED_BY_CLIENT',
  'runtime-message-failed',
  'tab-update-failed',
  'tab-removed'
])

const AMBIGUOUS_NAVIGATION_ERRORS = new Set([
  'net::ERR_ABORTED'
])

const TIMEOUT_NAVIGATION_ERRORS = new Set([
  'timeout',
  'net::ERR_TIMED_OUT',
  'net::ERR_CONNECTION_TIMED_OUT'
])

const RESTRICTED_STATUS_CODES = new Set([401, 403, 407, 429, 451])
const MISSING_STATUS_CODES = new Set([404, 410])
const TEMPORARY_STATUS_CODES = new Set([408, 500, 502, 503, 504, 522, 523, 524])

export function buildNavigationSuccess(
  bookmark: BookmarkRecord,
  navigationResult: NavigationAttempt,
  label: string
): AvailabilityResult {
  const finalUrl = navigationResult.finalUrl || bookmark.url
  const redirected = isRedirectedNavigation(bookmark.url, finalUrl)

  return {
    ...bookmark,
    status: redirected ? 'redirected' : 'available',
    badgeText: redirected ? '后台跳转成功' : '后台导航成功',
    finalUrl,
    detail: redirected
      ? `${label}，最终打开 ${displayUrl(finalUrl)}`
      : `${label}，后台标签页完成页面导航。`
  }
}

export function buildFailureClassification(
  bookmark: BookmarkRecord,
  attempts: NavigationAttempt[],
  probe: ProbeResult | null,
  probeEnabled: boolean
): AvailabilityResult {
  const baseResult = {
    ...bookmark,
    finalUrl: attempts.at(-1)?.finalUrl || bookmark.url
  }
  const navigationEvidence = summarizeNavigationEvidence(attempts)
  const navigationSummary = formatNavigationAttemptSummary(attempts)
  const requestProbe = classifyNavigationNetworkEvidenceFromAttempts(attempts)
  const effectiveProbe = chooseEffectiveProbe(probe, requestProbe)
  const effectiveProbeEnabled = probeEnabled || Boolean(effectiveProbe)

  if (!effectiveProbeEnabled || !effectiveProbe) {
    return {
      ...baseResult,
      status: 'review',
      badgeText: '低置信异常',
      detail: joinEvidenceDetail(
        navigationSummary,
        '未获得目标网站授权或未取得网络校验证据，暂归为低置信异常，不建议直接删除'
      )
    }
  }

  if (effectiveProbe.kind === 'ok') {
    return {
      ...baseResult,
      status: 'review',
      badgeText: '低置信异常',
      detail: joinEvidenceDetail(
        navigationSummary,
        `网络探测(${effectiveProbe.method})返回可访问，站点可能仍可用；暂归为低置信异常，建议人工确认`
      )
    }
  }

  if (effectiveProbe.kind === 'restricted') {
    return {
      ...baseResult,
      status: 'review',
      badgeText: '受限/低置信',
      detail: joinEvidenceDetail(
        navigationSummary,
        `网络探测(${effectiveProbe.method})返回 ${effectiveProbe.label}，站点可能需要登录、地区许可或反爬验证；暂归为低置信异常`
      )
    }
  }

  if (effectiveProbe.kind === 'temporary') {
    return {
      ...baseResult,
      status: 'review',
      badgeText: '临时异常',
      detail: joinEvidenceDetail(
        navigationSummary,
        `网络探测(${effectiveProbe.method})返回 ${effectiveProbe.label}，更像临时服务异常，不建议直接删除`
      )
    }
  }

  if (effectiveProbe.kind === 'missing') {
    return {
      ...baseResult,
      status: 'failed',
      badgeText: '高置信异常',
      detail: joinEvidenceDetail(
        navigationSummary,
        `网络探测(${effectiveProbe.method})返回 ${effectiveProbe.label}，较大概率是失效链接`
      )
    }
  }

  if (effectiveProbe.kind === 'network') {
    if (
      effectiveProbe.method !== '主请求' &&
      shouldClassifyAsHighConfidence(navigationEvidence, effectiveProbe.kind)
    ) {
      return {
        ...baseResult,
        status: 'failed',
        badgeText: '高置信异常',
        detail: joinEvidenceDetail(
          navigationSummary,
          `网络探测也失败：${stripEvidencePunctuation(effectiveProbe.detail)}，多层结果都指向连接层故障，已按高置信异常归类`
        )
      }
    }

    return {
      ...baseResult,
      status: 'review',
      badgeText: '低置信异常',
      detail: joinEvidenceDetail(
        navigationSummary,
        `网络探测也失败：${stripEvidencePunctuation(effectiveProbe.detail)}，证据仍不足以直接删除，暂归为低置信异常`
      )
    }
  }

  if (effectiveProbe.kind === 'unknown') {
    if (
      effectiveProbe.method !== '主请求' &&
      shouldClassifyAsHighConfidence(navigationEvidence, effectiveProbe.kind)
    ) {
      return {
        ...baseResult,
        status: 'failed',
        badgeText: '高置信异常',
        detail: joinEvidenceDetail(
          navigationSummary,
          `${stripEvidencePunctuation(effectiveProbe.detail)}，且后台导航连续给出强失败信号，已按高置信异常归类`
        )
      }
    }

    return {
      ...baseResult,
      status: 'review',
      badgeText: '低置信异常',
      detail: joinEvidenceDetail(
        navigationSummary,
        `${stripEvidencePunctuation(effectiveProbe.detail)}；证据仍不足以直接删除，暂归为低置信异常`
      )
    }
  }

  return {
    ...baseResult,
    status: 'review',
    badgeText: '低置信异常',
    detail: joinEvidenceDetail(
      navigationSummary,
      `${stripEvidencePunctuation(effectiveProbe.detail)}；暂归为低置信异常，建议人工确认`
    )
  }
}

function formatNavigationAttemptSummary(attempts: NavigationAttempt[]): string {
  return attempts
    .map((attempt, index) => {
      const label = index === 0 ? '首轮' : '重试'
      const detail = stripEvidencePunctuation(attempt.detail || '后台导航未返回明确结果')
      return `${label}：${detail}`
    })
    .join('；')
}

function joinEvidenceDetail(...fragments: string[]): string {
  const normalized = fragments
    .map((fragment) => stripEvidencePunctuation(fragment))
    .filter(Boolean)

  return normalized.length ? `${normalized.join('。')}。` : ''
}

function stripEvidencePunctuation(value: string): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[。！？.!?]+$/g, '')
}

function chooseEffectiveProbe(
  probe: ProbeResult | null,
  requestProbe: ProbeResult | null
): ProbeResult | null {
  if (!probe) {
    return requestProbe
  }

  if (!requestProbe) {
    return probe
  }

  if (['missing', 'restricted', 'temporary'].includes(requestProbe.kind)) {
    return requestProbe
  }

  if (probe.kind === 'unknown' || probe.kind === 'network') {
    return requestProbe.kind === 'unknown' || requestProbe.kind === 'network'
      ? probe
      : requestProbe
  }

  return probe
}

export function shouldRetryNavigation(result: NavigationAttempt | null | undefined): boolean {
  if (!result || result.status === 'available') {
    return false
  }

  return RETRYABLE_NAVIGATION_ERRORS.has(result.errorCode)
}

export function shouldAcceptNavigationSuccess(result: NavigationAttempt | null | undefined): boolean {
  if (!result || result.status !== 'available') {
    return false
  }

  const evidence = result.networkEvidence
  const statusCode = Number(evidence?.statusCode) || 0
  if (evidence && isUnverifiedRedirectEvidence(evidence)) {
    return false
  }

  return Boolean(evidence?.requestSent && statusCode > 0 && statusCode < 400)
}

export function summarizeNavigationEvidence(attempts: NavigationAttempt[]): NavigationEvidence {
  const errorCodes = attempts
    .map((attempt) => String(attempt?.errorCode || '').trim())
    .filter(Boolean)

  const strongFailures = errorCodes.filter((errorCode) => {
    return STRONG_NAVIGATION_ERRORS.has(errorCode)
  }).length

  return {
    errorCodes,
    strongFailures,
    repeatedStrongFailure:
      errorCodes.length >= 2 &&
      new Set(errorCodes).size === 1 &&
      STRONG_NAVIGATION_ERRORS.has(errorCodes[0]),
    onlyTimeoutErrors:
      errorCodes.length > 0 &&
      errorCodes.every((errorCode) => TIMEOUT_NAVIGATION_ERRORS.has(errorCode)),
    hasClientBlockingError: errorCodes.some((errorCode) => {
      return CLIENT_BLOCKING_NAVIGATION_ERRORS.has(errorCode)
    }),
    onlyAmbiguousErrors:
      errorCodes.length > 0 &&
      errorCodes.every((errorCode) => AMBIGUOUS_NAVIGATION_ERRORS.has(errorCode))
  }
}

export function shouldClassifyAsHighConfidence(
  navigationEvidence: NavigationEvidence | null | undefined,
  probeKind: ProbeKind | string
): boolean {
  if (
    !navigationEvidence ||
    navigationEvidence.hasClientBlockingError ||
    navigationEvidence.onlyAmbiguousErrors ||
    navigationEvidence.onlyTimeoutErrors
  ) {
    return false
  }

  if (probeKind === 'network') {
    return navigationEvidence.repeatedStrongFailure || navigationEvidence.strongFailures >= 2
  }

  if (probeKind === 'unknown') {
    return navigationEvidence.repeatedStrongFailure && navigationEvidence.strongFailures >= 2
  }

  return false
}

export function shouldFallbackToGet(statusCode: number): boolean {
  return [401, 403, 405, 429, 451, 500, 501, 502, 503, 504].includes(statusCode)
}

export function classifyProbeResponse(
  response: Pick<Response, 'ok' | 'status' | 'redirected' | 'url'>,
  method: string
): ProbeResult {
  const statusCode = response.status || 0
  const label = `HTTP ${statusCode}`

  if (response.ok) {
    return {
      kind: 'ok',
      method,
      label: response.redirected ? '探测可达并发生跳转' : '探测可达',
      detail: response.redirected
        ? `网络探测(${method})可达，且最终跳转到 ${displayUrl(response.url)}。`
        : `网络探测(${method})可达。`
    }
  }

  if (MISSING_STATUS_CODES.has(statusCode)) {
    return {
      kind: 'missing',
      method,
      label,
      detail: `网络探测(${method})返回 ${label}。`
    }
  }

  if (RESTRICTED_STATUS_CODES.has(statusCode)) {
    return {
      kind: 'restricted',
      method,
      label,
      detail: `网络探测(${method})返回 ${label}。`
    }
  }

  if (TEMPORARY_STATUS_CODES.has(statusCode)) {
    return {
      kind: 'temporary',
      method,
      label,
      detail: `网络探测(${method})返回 ${label}。`
    }
  }

  return {
    kind: 'unknown',
    method,
    label,
    detail: `网络探测(${method})返回 ${label}。`
  }
}

export function classifyNavigationNetworkEvidence(
  evidence: NavigationNetworkEvidence | null | undefined
): ProbeResult | null {
  if (!evidence) {
    return null
  }

  const method = '主请求'
  const statusCode = Number(evidence.statusCode) || 0
  const failedBeforeCompletion = Boolean(
    evidence.errorCode && !Number.isFinite(evidence.timing?.completedMs)
  )
  if (isUnverifiedRedirectEvidence(evidence)) {
    return {
      kind: 'unknown',
      method,
      label: '最终响应未确认',
      detail: formatNavigationNetworkEvidence(evidence) || '主请求发生跳转，但未确认最终页面响应。'
    }
  }

  if (failedBeforeCompletion) {
    return {
      kind: 'network',
      method,
      label: '主请求失败',
      detail: formatNavigationNetworkEvidence(evidence) || `主请求失败：${evidence.errorCode}。`
    }
  }

  if (statusCode > 0) {
    return classifyHttpStatusProbe(statusCode, method, formatNavigationNetworkEvidence(evidence))
  }

  if (evidence.errorCode) {
    return {
      kind: 'network',
      method,
      label: '主请求失败',
      detail: formatNavigationNetworkEvidence(evidence) || `主请求失败：${evidence.errorCode}。`
    }
  }

  if (evidence.requestSent) {
    return {
      kind: 'unknown',
      method,
      label: '主请求未完成',
      detail: formatNavigationNetworkEvidence(evidence) || '主请求已发出，但未收到可分类响应。'
    }
  }

  return null
}

function isUnverifiedRedirectEvidence(evidence: NavigationNetworkEvidence): boolean {
  const statusCode = Number(evidence.statusCode) || 0
  return statusCode >= 300 && statusCode < 400 && evidence.finalResponseObserved === false
}

export function classifyNavigationNetworkEvidenceFromAttempts(
  attempts: NavigationAttempt[]
): ProbeResult | null {
  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    const probe = classifyNavigationNetworkEvidence(attempts[index]?.networkEvidence)
    if (probe) {
      return probe
    }
  }

  return null
}

function classifyHttpStatusProbe(statusCode: number, method: string, detail: string): ProbeResult {
  const label = `HTTP ${statusCode}`

  if (statusCode >= 200 && statusCode < 400) {
    return {
      kind: 'ok',
      method,
      label,
      detail
    }
  }

  if (MISSING_STATUS_CODES.has(statusCode)) {
    return {
      kind: 'missing',
      method,
      label,
      detail
    }
  }

  if (RESTRICTED_STATUS_CODES.has(statusCode)) {
    return {
      kind: 'restricted',
      method,
      label,
      detail
    }
  }

  if (TEMPORARY_STATUS_CODES.has(statusCode)) {
    return {
      kind: 'temporary',
      method,
      label,
      detail
    }
  }

  return {
    kind: 'unknown',
    method,
    label,
    detail
  }
}

export function formatNavigationNetworkEvidence(
  evidence: NavigationNetworkEvidence | null | undefined
): string {
  if (!evidence) {
    return ''
  }

  const fragments = []
  if (evidence.statusCode) {
    fragments.push(`主请求返回 HTTP ${evidence.statusCode}`)
  } else if (evidence.errorCode) {
    fragments.push(`主请求失败：${evidence.errorCode}`)
  } else if (evidence.requestSent) {
    fragments.push('主请求已发出但未收到响应')
  } else {
    fragments.push('主请求未发出')
  }

  if (evidence.redirects?.length) {
    fragments.push(`重定向 ${evidence.redirects.length} 次`)
  }

  if (isUnverifiedRedirectEvidence(evidence)) {
    fragments.push('未确认最终页面响应')
  }

  const responseLatencyMs = evidence.timing?.responseLatencyMs
  const totalMs = evidence.timing?.totalMs
  if (Number.isFinite(responseLatencyMs)) {
    fragments.push(`响应头 ${Math.round(Number(responseLatencyMs))}ms`)
  }

  if (Number.isFinite(totalMs)) {
    fragments.push(`总耗时 ${Math.round(Number(totalMs))}ms`)
  }

  return `${fragments.join('，')}。`
}

export function classifyProbeError(error: unknown): ProbeResult {
  const errorName =
    error && typeof error === 'object'
      ? String((error as { name?: unknown }).name || '')
      : ''

  if (errorName === 'AbortError') {
    return {
      kind: 'unknown',
      method: 'GET',
      label: '探测超时',
      detail: `网络探测超时，超过 ${Math.round(FETCH_TIMEOUT_MS / 1000)} 秒仍未返回。`
    }
  }

  if (error instanceof TypeError) {
    return {
      kind: 'network',
      method: 'GET',
      label: '网络探测失败',
      detail: '网络探测未能建立连接。'
    }
  }

  return {
    kind: 'unknown',
    method: 'GET',
    label: '探测失败',
    detail: error instanceof Error ? error.message : '网络探测失败。'
  }
}

export function isRedirectedNavigation(originalUrl: unknown, finalUrl: unknown): boolean {
  return normalizeNavigationUrl(originalUrl) !== normalizeNavigationUrl(finalUrl)
}

export function normalizeNavigationUrl(url: unknown): string {
  try {
    const parsedUrl = new URL(String(url || ''))
    parsedUrl.hash = ''
    parsedUrl.hostname = parsedUrl.hostname.replace(/^www\./i, '').toLowerCase()
    const pathname = normalizeNavigationPathname(parsedUrl.pathname)
    const search = normalizeNavigationSearch(parsedUrl.search)
    return `${parsedUrl.hostname}${pathname}${search}`
  } catch (error) {
    return normalizeText(String(url || ''))
  }
}

function normalizeNavigationPathname(pathname: unknown): string {
  const normalizedPath = String(pathname || '/')
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '')

  return normalizedPath || '/'
}

function normalizeNavigationSearch(search: string): string {
  if (!search) {
    return ''
  }

  const params = new URLSearchParams(search)
  const normalizedPairs = [...params.entries()]
    .map(([key, value]) => [key, value])
    .sort((left, right) => {
      return left[0].localeCompare(right[0], 'en') || left[1].localeCompare(right[1], 'en')
    })

  if (!normalizedPairs.length) {
    return ''
  }

  return `?${normalizedPairs.map(([key, value]) => `${key}=${value}`).join('&')}`
}
