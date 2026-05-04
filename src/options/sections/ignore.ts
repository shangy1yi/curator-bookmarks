import { STORAGE_KEYS } from '../../shared/constants.js'
import { setLocalStorage } from '../../shared/storage.js'
import { displayUrl } from '../../shared/text.js'
import {
  managerState,
  createEmptyIgnoreRules
} from '../shared-options/state.js'
import { dom } from '../shared-options/dom.js'
import { escapeHtml, escapeAttr } from '../shared-options/html.js'

export function normalizeIgnoreRules(rawRules) {
  const normalized = createEmptyIgnoreRules()
  const source = rawRules && typeof rawRules === 'object' ? rawRules : {}

  normalized.bookmarks = normalizeBookmarkIgnoreRules(source.bookmarks)
  normalized.domains = normalizeDomainIgnoreRules(source.domains)
  normalized.folders = normalizeFolderIgnoreRules(source.folders)
  normalized.bookmarkIds = new Set(normalized.bookmarks.map((rule) => rule.bookmarkId))
  normalized.domainValues = new Set(normalized.domains.map((rule) => rule.domain))
  normalized.folderIds = new Set(normalized.folders.map((rule) => rule.folderId))

  return normalized
}

function normalizeBookmarkIgnoreRules(rules) {
  if (!Array.isArray(rules)) {
    return []
  }

  return rules
    .map((rule) => {
      return {
        bookmarkId: String(rule?.bookmarkId || '').trim(),
        title: String(rule?.title || '未命名书签').trim() || '未命名书签',
        url: String(rule?.url || '').trim(),
        createdAt: Number(rule?.createdAt) || Date.now()
      }
    })
    .filter((rule) => rule.bookmarkId)
}

function normalizeDomainIgnoreRules(rules) {
  if (!Array.isArray(rules)) {
    return []
  }

  return rules
    .map((rule) => {
      return {
        domain: String(rule?.domain || '').trim().toLowerCase(),
        createdAt: Number(rule?.createdAt) || Date.now()
      }
    })
    .filter((rule) => rule.domain)
}

function normalizeFolderIgnoreRules(rules) {
  if (!Array.isArray(rules)) {
    return []
  }

  return rules
    .map((rule) => {
      return {
        folderId: String(rule?.folderId || '').trim(),
        title: String(rule?.title || '未命名文件夹').trim() || '未命名文件夹',
        path: String(rule?.path || '').trim(),
        createdAt: Number(rule?.createdAt) || Date.now()
      }
    })
    .filter((rule) => rule.folderId)
}

export function serializeIgnoreRules(ignoreRules) {
  return {
    bookmarks: ignoreRules.bookmarks.map((rule) => ({
      bookmarkId: rule.bookmarkId,
      title: rule.title,
      url: rule.url,
      createdAt: rule.createdAt
    })),
    domains: ignoreRules.domains.map((rule) => ({
      domain: rule.domain,
      createdAt: rule.createdAt
    })),
    folders: ignoreRules.folders.map((rule) => ({
      folderId: rule.folderId,
      title: rule.title,
      path: rule.path,
      createdAt: rule.createdAt
    }))
  }
}

export async function saveIgnoreRules() {
  await setLocalStorage({
    [STORAGE_KEYS.ignoreRules]: serializeIgnoreRules(managerState.ignoreRules)
  })
}

export function matchesIgnoreRules(result) {
  if (!result) {
    return false
  }

  if (managerState.ignoreRules.bookmarkIds.has(String(result.id))) {
    return true
  }

  if (result.domain && managerState.ignoreRules.domainValues.has(String(result.domain))) {
    return true
  }

  return (result.ancestorIds || []).some((folderId) => {
    return managerState.ignoreRules.folderIds.has(String(folderId))
  })
}

export function renderIgnoreSection() {
  if (!dom.ignoreBookmarkRules) {
    return
  }

  dom.ignoreBookmarkCount.textContent = String(managerState.ignoreRules.bookmarks.length)
  dom.ignoreDomainCount.textContent = String(managerState.ignoreRules.domains.length)
  dom.ignoreFolderCount.textContent = String(managerState.ignoreRules.folders.length)

  renderIgnoreRuleList(dom.ignoreBookmarkRules, managerState.ignoreRules.bookmarks, 'bookmark')
  renderIgnoreRuleList(dom.ignoreDomainRules, managerState.ignoreRules.domains, 'domain')
  renderIgnoreRuleList(dom.ignoreFolderRules, managerState.ignoreRules.folders, 'folder')
}

function renderIgnoreRuleList(container, rules, kind) {
  if (!container) {
    return
  }

  if (!rules.length) {
    container.innerHTML = '<div class="detect-empty">当前没有这类忽略规则。</div>'
    return
  }

  container.innerHTML = rules
    .slice()
    .sort((left, right) => (Number(right.createdAt) || 0) - (Number(left.createdAt) || 0))
    .map((rule) => buildIgnoreRuleCard(rule, kind))
    .join('')
}

export function getIgnoreRuleActionLabel(action, rule, kind) {
  const title = kind === 'bookmark'
    ? rule?.title || displayUrl(rule?.url)
    : kind === 'folder'
      ? rule?.path || rule?.title
      : rule?.domain
  const normalizedTitle = String(title || '未命名规则')
    .replace(/\s+/g, ' ')
    .trim()
  const safeTitle = normalizedTitle.length > 48
    ? `${normalizedTitle.slice(0, 47).trim()}…`
    : normalizedTitle

  return `${action}：${safeTitle || '未命名规则'}`
}

function buildIgnoreRuleCard(rule, kind) {
  const title = kind === 'bookmark'
    ? rule.title
    : kind === 'folder'
      ? rule.title
      : rule.domain
  const detail = kind === 'bookmark'
    ? displayUrl(rule.url)
    : kind === 'folder'
      ? rule.path || rule.title
      : '按域名忽略'
  const ruleId = kind === 'bookmark'
    ? rule.bookmarkId
    : kind === 'folder'
      ? rule.folderId
      : rule.domain
  const deleteLabel = getIgnoreRuleActionLabel('删除忽略规则', rule, kind)

  return `
    <article class="detect-result-card compact">
      <div class="detect-result-head">
        <div class="detect-result-head-left">
          <span class="options-chip muted">忽略规则</span>
        </div>
        <div class="detect-result-actions">
          <button
            class="detect-result-action"
            type="button"
            data-ignore-remove="${escapeAttr(kind)}"
            data-ignore-id="${escapeAttr(ruleId)}"
            aria-label="${escapeAttr(deleteLabel)}"
          >
            删除规则
          </button>
        </div>
      </div>
      <div class="detect-result-copy">
        <strong>${escapeHtml(title || '未命名规则')}</strong>
        <div class="detect-result-detail">${escapeHtml(detail || '')}</div>
      </div>
    </article>
  `
}

export function handleIgnoreRulesClick(event, callbacks) {
  const removeButton = event.target.closest('[data-ignore-remove]')
  if (!removeButton) {
    return
  }

  const kind = String(removeButton.getAttribute('data-ignore-remove') || '').trim()
  const ruleId = String(removeButton.getAttribute('data-ignore-id') || '').trim()
  if (!kind || !ruleId) {
    return
  }

  removeIgnoreRule(kind, ruleId, callbacks)
}

async function removeIgnoreRule(kind, ruleId, callbacks) {
  if (kind === 'bookmark') {
    managerState.ignoreRules.bookmarks = managerState.ignoreRules.bookmarks.filter((rule) => {
      return String(rule.bookmarkId) !== ruleId
    })
    managerState.ignoreRules.bookmarkIds.delete(ruleId)
  }

  if (kind === 'domain') {
    managerState.ignoreRules.domains = managerState.ignoreRules.domains.filter((rule) => {
      return String(rule.domain) !== ruleId
    })
    managerState.ignoreRules.domainValues.delete(ruleId)
  }

  if (kind === 'folder') {
    managerState.ignoreRules.folders = managerState.ignoreRules.folders.filter((rule) => {
      return String(rule.folderId) !== ruleId
    })
    managerState.ignoreRules.folderIds.delete(ruleId)
  }

  await saveIgnoreRules()
  callbacks?.onIgnoreRulesChanged?.()
}

export async function clearIgnoreRules(kind, callbacks) {
  const meta = {
    bookmark: {
      label: '书签',
      count: managerState.ignoreRules.bookmarks.length
    },
    domain: {
      label: '域名',
      count: managerState.ignoreRules.domains.length
    },
    folder: {
      label: '文件夹',
      count: managerState.ignoreRules.folders.length
    }
  }[kind]

  if (!meta?.count) {
    return
  }

  const confirmed = callbacks?.confirm
    ? await callbacks.confirm({
        title: `清空 ${meta.count} 条${meta.label}忽略规则？`,
        copy: '清空后，对应异常会重新出现在后续检测结果中。已保存的书签不会被删除。',
        confirmLabel: '清空规则',
        label: '清空规则',
        tone: 'warning'
      })
    : true
  if (!confirmed) {
    return
  }

  if (kind === 'bookmark') {
    managerState.ignoreRules.bookmarks = []
    managerState.ignoreRules.bookmarkIds = new Set()
  }

  if (kind === 'domain') {
    managerState.ignoreRules.domains = []
    managerState.ignoreRules.domainValues = new Set()
  }

  if (kind === 'folder') {
    managerState.ignoreRules.folders = []
    managerState.ignoreRules.folderIds = new Set()
  }

  await saveIgnoreRules()
  callbacks?.onIgnoreRulesChanged?.()
}
