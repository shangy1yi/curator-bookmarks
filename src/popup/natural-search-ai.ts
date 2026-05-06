import { STORAGE_KEYS } from '../shared/constants.js'
import {
  extractAiErrorMessage,
  extractChatCompletionsJsonText,
  extractResponsesJsonText,
  getAiEndpoint
} from '../shared/ai-response.js'
import { getLocalStorage } from '../shared/storage.js'
import {
  normalizeNaturalSearchAiPlan,
  type NaturalSearchPlan
} from './natural-search.js'

const NATURAL_SEARCH_AI_DEFAULT_TIMEOUT_MS = 30000

let aiSettingsModulePromise: Promise<typeof import('../options/sections/ai-settings.js')> | null = null

export const NATURAL_SEARCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['queries', 'keywords', 'excluded_terms', 'date_range', 'explanation'],
  properties: {
    queries: {
      type: 'array',
      maxItems: 5,
      items: { type: 'string', maxLength: 80 }
    },
    keywords: {
      type: 'array',
      maxItems: 12,
      items: { type: 'string', maxLength: 40 }
    },
    excluded_terms: {
      type: 'array',
      maxItems: 8,
      items: { type: 'string', maxLength: 40 }
    },
    date_range: {
      type: 'object',
      additionalProperties: false,
      required: ['from', 'to', 'label'],
      properties: {
        from: { type: 'string', maxLength: 10 },
        to: { type: 'string', maxLength: 10 },
        label: { type: 'string', maxLength: 40 }
      }
    },
    explanation: { type: 'string', maxLength: 120 }
  }
} as const

type AiNamingSettings = ReturnType<typeof import('../options/sections/ai-settings.js').normalizeAiNamingSettings>

interface NaturalSearchAiRequest {
  query: string
  localPlan: NaturalSearchPlan
  settings: AiNamingSettings
  signal?: AbortSignal | null
}

function loadAiSettingsModule(): Promise<typeof import('../options/sections/ai-settings.js')> {
  aiSettingsModulePromise ||= import('../options/sections/ai-settings.js')
  return aiSettingsModulePromise
}

export async function loadNaturalSearchAiProviderSettings(): Promise<AiNamingSettings> {
  const stored = await getLocalStorage([STORAGE_KEYS.aiProviderSettings])
  const { normalizeAiNamingSettings } = await loadAiSettingsModule()
  return normalizeAiNamingSettings(stored[STORAGE_KEYS.aiProviderSettings])
}

export function hasConfiguredNaturalSearchAiProvider(settings: AiNamingSettings): boolean {
  return Boolean(settings.baseUrl && settings.apiKey && settings.model)
}

export function validateNaturalSearchAiProvider(settings: AiNamingSettings): void {
  if (!hasConfiguredNaturalSearchAiProvider(settings)) {
    throw new Error('请先到通用设置配置“自定义AI渠道”。')
  }
}

export async function ensureNaturalSearchAiPermissions(
  settings: AiNamingSettings,
  { interactive = false }: { interactive?: boolean } = {}
): Promise<boolean> {
  const origins = [getOriginPermissionPattern(settings.baseUrl)].filter(Boolean)
  if (!origins.length) {
    return true
  }

  const missingOrigins = await getMissingPermissionOrigins(origins)
  if (!missingOrigins.length) {
    return true
  }

  if (!interactive) {
    throw createNaturalSearchPermissionRequiredError(missingOrigins)
  }

  const granted = await requestPermissions({ origins: missingOrigins })
  if (!granted) {
    throw createNaturalSearchPermissionRequiredError(missingOrigins, '未完成 AI 渠道授权，暂时无法自然语言搜索。')
  }
  return true
}

export async function requestNaturalSearchAiPlan({
  query,
  localPlan,
  settings,
  signal = null
}: NaturalSearchAiRequest): Promise<NaturalSearchPlan> {
  throwIfAborted(signal)
  validateNaturalSearchAiProvider(settings)
  await ensureNaturalSearchAiPermissions(settings, { interactive: false })

  throwIfAborted(signal)
  const endpoint = getAiEndpoint(settings)
  const requestBody = buildNaturalSearchRequestBody({ settings, query, localPlan })
  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify(requestBody),
    signal
  }, settings.timeoutMs)
  throwIfAborted(signal)
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(extractAiErrorMessage(payload, response.status))
  }

  const rawJsonText = settings.apiStyle === 'responses'
    ? extractResponsesJsonText(payload)
    : extractChatCompletionsJsonText(payload)

  try {
    return normalizeNaturalSearchAiPlan(JSON.parse(rawJsonText), localPlan)
  } catch {
    throw new Error('AI 返回了无法解析的自然语言搜索结果。')
  }
}

export function normalizeNaturalSearchAiError(error: unknown): string {
  if (isNaturalSearchPermissionRequiredError(error)) {
    return 'AI 渠道未授权，已使用本地自然语言解析。'
  }

  const message = error instanceof Error ? error.message : ''
  if (!message) {
    return 'AI 解析不可用，已使用本地自然语言解析。'
  }

  if (message.includes('请先到通用设置')) {
    return '未配置 AI 渠道，已使用本地自然语言解析。'
  }

  return `AI 解析不可用，已使用本地解析：${truncateNaturalSearchText(message, 72)}`
}

export function isNaturalSearchAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function buildNaturalSearchRequestBody({
  settings,
  query,
  localPlan
}: {
  settings: AiNamingSettings
  query: string
  localPlan: NaturalSearchPlan
}) {
  const today = formatLocalDate(Date.now())
  const exampleDateRange = getPreviousWeekDateRange()
  const systemPrompt = [
    '你是浏览器书签搜索查询理解器。',
    '你的任务是把用户自然语言改写为本地书签搜索关键词，不要回答用户问题。',
    '输出要适合在标题、URL、文件夹路径、AI 标签、主题、别名和摘要中做文本匹配。',
    '保留产品名、框架名、库名、站点名和专有名词；去掉“帮我找、那个、收藏的、书签”等意图词。',
    '为中文和英文同义表达补充少量高价值关键词，例如“表格教程”可包含 table、grid、tutorial、guide。',
    '如果用户明确排除某类内容，把排除词放入 excluded_terms。',
    'date_range 只有在用户明确提到时间时填写；from 和 to 使用 YYYY-MM-DD，to 是不包含的结束日期；没有时间条件时三个字段都返回空字符串。',
    '不要编造用户没有表达的具体网站、作者或标题。'
  ].join('\n')
  const userPrompt = JSON.stringify({
    today,
    raw_query: query,
    local_interpretation: {
      queries: localPlan.queries,
      date_range: localPlan.dateRange
        ? {
            from: formatLocalDate(localPlan.dateRange.from),
            to: formatLocalDate(localPlan.dateRange.to),
            label: localPlan.dateRange.label
          }
        : { from: '', to: '', label: '' }
    },
    examples: [
      {
        input: '帮我找上周收藏的那个 React 表格教程',
        output: {
          queries: ['react 表格 教程 table grid tutorial guide', 'react table tutorial'],
          keywords: ['react', '表格', '教程', 'table', 'grid', 'tutorial'],
          excluded_terms: [],
          date_range: exampleDateRange
            ? {
                from: formatLocalDate(exampleDateRange.from),
                to: formatLocalDate(exampleDateRange.to),
                label: exampleDateRange.label
              }
            : { from: '', to: '', label: '' },
          explanation: '按上周收藏和 React 表格教程关键词匹配'
        }
      }
    ]
  }, null, 2)

  if (settings.apiStyle === 'chat_completions') {
    const schemaHint = '\n\n请严格按以下 JSON 格式返回结果，不要添加任何额外文本或 markdown 标记：\n' + JSON.stringify(NATURAL_SEARCH_SCHEMA, null, 2)
    return {
      model: settings.model,
      messages: [
        { role: 'system', content: systemPrompt + schemaHint },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' }
    }
  }

  return {
    model: settings.model,
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: systemPrompt }]
      },
      {
        role: 'user',
        content: [{ type: 'input_text', text: userPrompt }]
      }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'popup_natural_language_search',
        strict: true,
        schema: NATURAL_SEARCH_SCHEMA
      }
    }
  }
}

function getPreviousWeekDateRange(): NaturalSearchPlan['dateRange'] {
  const now = new Date()
  const day = now.getDay()
  const daysFromMonday = (day + 6) % 7
  const thisWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday)
  thisWeekStart.setHours(0, 0, 0, 0)
  const previousWeekStart = thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000
  return {
    from: previousWeekStart,
    to: thisWeekStart.getTime(),
    label: '上周收藏'
  }
}

function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = NATURAL_SEARCH_AI_DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const externalSignal = options.signal
  const abortCurrentFetch = () => {
    controller.abort()
  }

  if (externalSignal?.aborted) {
    controller.abort()
  } else {
    externalSignal?.addEventListener('abort', abortCurrentFetch, { once: true })
  }

  const timeoutId = globalThis.setTimeout(() => {
    controller.abort()
  }, Math.max(1000, Number(timeoutMs) || NATURAL_SEARCH_AI_DEFAULT_TIMEOUT_MS))

  return fetch(url, {
    ...options,
    signal: controller.signal
  }).finally(() => {
    globalThis.clearTimeout(timeoutId)
    externalSignal?.removeEventListener('abort', abortCurrentFetch)
  })
}

function throwIfAborted(signal?: AbortSignal | null): void {
  if (signal?.aborted) {
    throw new DOMException('操作已取消。', 'AbortError')
  }
}

function getOriginPermissionPattern(url: unknown): string {
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

function requestPermissions(query: chrome.permissions.Permissions): Promise<boolean> {
  return new Promise((resolve, reject) => {
    chrome.permissions.request(query, (granted) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(Boolean(granted))
    })
  })
}

function containsPermissions(query: chrome.permissions.Permissions): Promise<boolean> {
  return new Promise((resolve, reject) => {
    chrome.permissions.contains(query, (granted) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(Boolean(granted))
    })
  })
}

async function getMissingPermissionOrigins(origins: string[]): Promise<string[]> {
  const uniqueOrigins = [...new Set(origins)].filter(Boolean)
  if (!uniqueOrigins.length) {
    return []
  }

  try {
    if (await containsPermissions({ origins: uniqueOrigins })) {
      return []
    }
  } catch {
  }

  const missingOrigins: string[] = []
  for (const origin of uniqueOrigins) {
    try {
      if (!(await containsPermissions({ origins: [origin] }))) {
        missingOrigins.push(origin)
      }
    } catch {
      missingOrigins.push(origin)
    }
  }
  return missingOrigins
}

function createNaturalSearchPermissionRequiredError(
  origins: unknown[],
  message = '需要授权 AI 渠道后才能自然语言搜索。'
): Error & { naturalSearchPermissionRequest?: { origins: string[] } } {
  const error = new Error(message) as Error & {
    naturalSearchPermissionRequest?: { origins: string[] }
  }
  error.naturalSearchPermissionRequest = {
    origins: [...new Set(origins.map((origin) => String(origin || '')).filter(Boolean))]
  }
  return error
}

function isNaturalSearchPermissionRequiredError(error: unknown): boolean {
  return Boolean((error as { naturalSearchPermissionRequest?: { origins?: string[] } })?.naturalSearchPermissionRequest?.origins)
}

function formatLocalDate(value: unknown): string {
  const date = new Date(Number(value))
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function truncateNaturalSearchText(value: unknown, limit = 180): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= limit) {
    return text
  }
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`
}
