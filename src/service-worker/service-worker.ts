import type {
  NavigationCancelMessage,
  NavigationCheckMessage,
  NavigationCheckResult
} from '../shared/messages.js'
import type { NavigationNetworkEvidence } from '../shared/types.js'

interface PendingCheckState {
  tabId: number
  checkId: string
  requestedUrl: string
  lastUrl: string
  navigationStarted: boolean
  settled: boolean
  timeoutId: number
  networkEvidence: NavigationNetworkEvidence | null
  webRequestListeners: WebRequestListenerSet | null
  resolve: (result: NavigationCheckResult) => void
}

interface WebRequestListenerSet {
  beforeRequest: (details: chrome.webRequest.WebRequestBodyDetails) => void
  beforeRedirect: (details: chrome.webRequest.WebRedirectionResponseDetails) => void
  headersReceived: (details: chrome.webRequest.WebResponseHeadersDetails) => void
  completed: (details: chrome.webRequest.WebResponseCacheDetails) => void
  errorOccurred: (details: chrome.webRequest.WebResponseErrorDetails) => void
}

const pendingChecks = new Map<number, PendingCheckState>()
const pendingCheckIds = new Map<string, number>()

chrome.runtime.onMessage.addListener((message: NavigationCheckMessage | NavigationCancelMessage, _sender, sendResponse) => {
  if (message?.type === 'availability:cancel') {
    cancelNavigationCheck(message.checkId)
    sendResponse({ ok: true })
    return undefined
  }

  if (message?.type !== 'availability:navigate') {
    return undefined
  }

  performNavigationCheck({
    url: message.url,
    timeoutMs: message.timeoutMs,
    checkId: message.checkId
  })
    .then((result) => {
      sendResponse({ ok: true, result })
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : '后台导航检测失败。'
      })
    })

  return true
})

chrome.webNavigation.onCommitted.addListener((details) => {
  const state = getPendingState(details)
  if (!state) {
    return
  }

  if (isAboutBlank(details.url)) {
    return
  }

  state.navigationStarted = true
  state.lastUrl = details.url
})

chrome.webNavigation.onCompleted.addListener((details) => {
  const state = getPendingState(details)
  if (!state) {
    return
  }

  if (!state.navigationStarted && isAboutBlank(details.url)) {
    return
  }

  finalizeNavigationCheck(details.tabId, {
    status: 'available',
    finalUrl: details.url || state.lastUrl || state.requestedUrl,
    detail: '后台标签页已完成页面导航。',
    errorCode: ''
  })
})

chrome.webNavigation.onErrorOccurred.addListener((details) => {
  const state = getPendingState(details)
  if (!state) {
    return
  }

  if (!state.navigationStarted && isAboutBlank(details.url)) {
    return
  }

  finalizeNavigationCheck(details.tabId, {
    status: 'failed',
    finalUrl: state.lastUrl || details.url || state.requestedUrl,
    detail: `后台导航失败：${details.error}`,
    errorCode: details.error
  })
})

chrome.tabs.onRemoved.addListener((tabId) => {
  const state = pendingChecks.get(tabId)
  if (!state) {
    return
  }

  finalizeNavigationCheck(
    tabId,
    {
      status: 'failed',
      finalUrl: state.lastUrl || state.requestedUrl,
      detail: '后台检测标签页被关闭。',
      errorCode: 'tab-removed'
    },
    { skipClose: true }
  )
})

async function performNavigationCheck({
  url,
  timeoutMs,
  checkId
}: {
  url: string
  timeoutMs?: number
  checkId?: string
}): Promise<NavigationCheckResult> {
  if (!/^https?:\/\//i.test(String(url || ''))) {
    throw new Error('仅支持检测 http/https 书签。')
  }

  const effectiveTimeout = normalizeTimeout(timeoutMs)
  const tab = await createTab({
    url: 'about:blank',
    active: false
  })

  if (!tab?.id) {
    throw new Error('后台检测标签页创建失败。')
  }

  return new Promise<NavigationCheckResult>((resolve) => {
    const state: PendingCheckState = {
      tabId: tab.id!,
      checkId: String(checkId || ''),
      requestedUrl: url,
      lastUrl: url,
      navigationStarted: false,
      settled: false,
      timeoutId: 0,
      networkEvidence: null,
      webRequestListeners: null,
      resolve
    }

    pendingChecks.set(tab.id!, state)
    if (state.checkId) {
      pendingCheckIds.set(state.checkId, tab.id!)
    }

    state.timeoutId = self.setTimeout(() => {
      finalizeNavigationCheck(tab.id!, {
        status: 'failed',
        finalUrl: state.lastUrl || state.requestedUrl,
        detail: `后台导航超时，超过 ${Math.round(effectiveTimeout / 1000)} 秒仍未完成页面加载。`,
        errorCode: 'timeout'
      })
    }, effectiveTimeout)

    startNavigationWithNetworkObserver(state, url).catch((error) => {
      finalizeNavigationCheck(tab.id!, {
        status: 'failed',
        finalUrl: url,
        detail: error instanceof Error ? error.message : '后台导航启动失败。',
        errorCode: 'tab-update-failed'
      })
    })
  })
}

async function startNavigationWithNetworkObserver(state: PendingCheckState, url: string): Promise<void> {
  await attachWebRequestListeners(state)
  if (state.settled) {
    return
  }

  await updateTab(state.tabId, { url })
}

async function attachWebRequestListeners(state: PendingCheckState): Promise<void> {
  const originPattern = getOriginPermissionPattern(state.requestedUrl)
  if (!originPattern || !(await containsHostPermission(originPattern)) || state.settled) {
    return
  }

  const filter: chrome.webRequest.RequestFilter = {
    urls: [originPattern],
    tabId: state.tabId,
    types: ['main_frame']
  }
  const listeners = createWebRequestListeners(state)

  try {
    chrome.webRequest.onBeforeRequest.addListener(listeners.beforeRequest, filter)
    chrome.webRequest.onBeforeRedirect.addListener(listeners.beforeRedirect, filter)
    chrome.webRequest.onHeadersReceived.addListener(listeners.headersReceived, filter)
    chrome.webRequest.onCompleted.addListener(listeners.completed, filter)
    chrome.webRequest.onErrorOccurred.addListener(listeners.errorOccurred, filter)
    state.webRequestListeners = listeners
  } catch {
    removeWebRequestListeners(listeners)
  }
}

function createWebRequestListeners(state: PendingCheckState): WebRequestListenerSet {
  return {
    beforeRequest(details) {
      if (state.settled) {
        return
      }

      getOrCreateNetworkEvidence(state, details)
    },
    beforeRedirect(details) {
      if (state.settled) {
        return
      }

      const evidence = getOrCreateNetworkEvidence(state, details)
      const elapsedMs = getElapsedMs(evidence.timing.requestStartMs, details.timeStamp)
      evidence.redirects.push({
        url: details.url,
        redirectUrl: details.redirectUrl,
        statusCode: Number(details.statusCode) || 0,
        ...(Number.isFinite(elapsedMs) ? { elapsedMs } : {})
      })
      evidence.statusCode = Number(details.statusCode) || evidence.statusCode
      evidence.statusLine = details.statusLine || evidence.statusLine
      evidence.finalUrl = details.redirectUrl || evidence.finalUrl
      evidence.fromCache = Boolean(details.fromCache)
    },
    headersReceived(details) {
      if (state.settled) {
        return
      }

      const evidence = getOrCreateNetworkEvidence(state, details)
      evidence.statusCode = Number(details.statusCode) || evidence.statusCode
      evidence.statusLine = details.statusLine || evidence.statusLine
      evidence.finalUrl = details.url || evidence.finalUrl
      if (!Number.isFinite(evidence.timing.responseStartMs)) {
        evidence.timing.responseStartMs = details.timeStamp
      }
      evidence.timing.responseLatencyMs = getElapsedMs(evidence.timing.requestStartMs, evidence.timing.responseStartMs)
    },
    completed(details) {
      if (state.settled) {
        return
      }

      const evidence = getOrCreateNetworkEvidence(state, details)
      evidence.statusCode = Number(details.statusCode) || evidence.statusCode
      evidence.finalUrl = details.url || evidence.finalUrl
      evidence.fromCache = Boolean(details.fromCache)
      evidence.timing.completedMs = details.timeStamp
      evidence.timing.totalMs = getElapsedMs(evidence.timing.requestStartMs, evidence.timing.completedMs)
    },
    errorOccurred(details) {
      if (state.settled) {
        return
      }

      const evidence = getOrCreateNetworkEvidence(state, details)
      evidence.errorCode = details.error || evidence.errorCode
      evidence.finalUrl = details.url || evidence.finalUrl
      evidence.timing.failedMs = details.timeStamp
      evidence.timing.totalMs = getElapsedMs(evidence.timing.requestStartMs, evidence.timing.failedMs)
    }
  }
}

function detachWebRequestListeners(state: PendingCheckState): void {
  if (!state.webRequestListeners) {
    return
  }

  removeWebRequestListeners(state.webRequestListeners)
  state.webRequestListeners = null
}

function removeWebRequestListeners(listeners: WebRequestListenerSet): void {
  chrome.webRequest.onBeforeRequest.removeListener(listeners.beforeRequest)
  chrome.webRequest.onBeforeRedirect.removeListener(listeners.beforeRedirect)
  chrome.webRequest.onHeadersReceived.removeListener(listeners.headersReceived)
  chrome.webRequest.onCompleted.removeListener(listeners.completed)
  chrome.webRequest.onErrorOccurred.removeListener(listeners.errorOccurred)
}

function containsHostPermission(originPattern: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.contains({ origins: [originPattern] }, (granted) => {
      const error = chrome.runtime.lastError
      resolve(!error && Boolean(granted))
    })
  })
}

function getOriginPermissionPattern(url: string): string {
  try {
    const parsedUrl = new URL(String(url || '').trim())
    if (!/^https?:$/i.test(parsedUrl.protocol)) {
      return ''
    }

    return `${parsedUrl.origin}/*`
  } catch {
    return ''
  }
}

function cancelNavigationCheck(checkId: string): void {
  const tabId = pendingCheckIds.get(String(checkId || ''))
  if (!tabId) {
    return
  }

  const state = pendingChecks.get(tabId)
  finalizeNavigationCheck(tabId, {
    status: 'failed',
    finalUrl: state?.lastUrl || state?.requestedUrl || '',
    detail: '后台导航检测已取消。',
    errorCode: 'cancelled'
  })
}

function getPendingState(
  details: { frameId: number; tabId: number } | null | undefined
): PendingCheckState | null {
  if (!details || details.frameId !== 0) {
    return null
  }

  return pendingChecks.get(details.tabId) || null
}

function finalizeNavigationCheck(
  tabId: number,
  result: NavigationCheckResult,
  { skipClose = false }: { skipClose?: boolean } = {}
): void {
  const state = pendingChecks.get(tabId)
  if (!state || state.settled) {
    return
  }

  state.settled = true
  detachWebRequestListeners(state)
  pendingChecks.delete(tabId)
  if (state.checkId) {
    pendingCheckIds.delete(state.checkId)
  }

  if (state.timeoutId) {
    clearTimeout(state.timeoutId)
  }

  if (!skipClose) {
    closeTab(tabId).catch(() => {})
  }

  state.resolve(attachNetworkEvidence(state, result))
}

function isAboutBlank(url: string | undefined): boolean {
  return String(url || '').startsWith('about:blank')
}

function getOrCreateNetworkEvidence(
  state: PendingCheckState,
  details: {
    requestId?: string
    method?: string
    url?: string
    timeStamp?: number
  }
): NavigationNetworkEvidence {
  if (!state.networkEvidence) {
    state.networkEvidence = {
      requestSent: true,
      requestId: details.requestId,
      method: details.method,
      requestedUrl: state.requestedUrl,
      finalUrl: details.url || state.lastUrl || state.requestedUrl,
      redirects: [],
      timing: {
        requestStartMs: normalizeTimestamp(details.timeStamp)
      }
    }
    return state.networkEvidence
  }

  state.networkEvidence.requestSent = true
  state.networkEvidence.requestId = details.requestId || state.networkEvidence.requestId
  state.networkEvidence.method = details.method || state.networkEvidence.method
  state.networkEvidence.finalUrl = details.url || state.networkEvidence.finalUrl
  if (!Number.isFinite(state.networkEvidence.timing.requestStartMs)) {
    state.networkEvidence.timing.requestStartMs = normalizeTimestamp(details.timeStamp)
  }

  return state.networkEvidence
}

function attachNetworkEvidence(
  state: PendingCheckState,
  result: NavigationCheckResult
): NavigationCheckResult {
  const evidence = cloneNetworkEvidence(state.networkEvidence)
  if (!evidence) {
    return result
  }

  evidence.finalUrl = evidence.finalUrl || result.finalUrl || state.lastUrl || state.requestedUrl
  return {
    ...result,
    finalUrl: result.finalUrl || evidence.finalUrl || state.lastUrl || state.requestedUrl,
    networkEvidence: evidence
  }
}

function cloneNetworkEvidence(
  evidence: NavigationNetworkEvidence | null
): NavigationNetworkEvidence | null {
  if (!evidence) {
    return null
  }

  return {
    ...evidence,
    redirects: evidence.redirects.map((redirect) => ({ ...redirect })),
    timing: { ...evidence.timing }
  }
}

function normalizeTimestamp(value: unknown): number | undefined {
  const timestamp = Number(value)
  return Number.isFinite(timestamp) ? timestamp : undefined
}

function getElapsedMs(startMs: unknown, endMs: unknown): number | undefined {
  const start = Number(startMs)
  const end = Number(endMs)
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return undefined
  }

  return Math.max(0, end - start)
}

function normalizeTimeout(value: unknown): number {
  const timeout = Number(value)
  if (!Number.isFinite(timeout) || timeout <= 0) {
    return 15000
  }

  return Math.max(timeout, 1000)
}

function createTab(properties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.create(properties, (tab) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(tab)
    })
  })
}

function updateTab(
  tabId: number,
  properties: chrome.tabs.UpdateProperties
): Promise<chrome.tabs.Tab | undefined> {
  return new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, properties, (tab) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(tab)
    })
  })
}

function closeTab(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.tabs.remove(tabId, () => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve()
    })
  })
}
