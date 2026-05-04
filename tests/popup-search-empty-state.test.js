import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

function readProjectFile(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const popupSource = readProjectFile('src/popup/popup.ts')
const popupHtml = readProjectFile('src/popup/popup.html')

test('popup natural search entry is understandable without relying on AI-only text', () => {
  assert.doesNotMatch(popupHtml, new RegExp('>\\s*AI\\s*</button>'))
  assert.match(popupHtml, new RegExp('>\\s*语义\\s*</button>'))
  assert.match(popupSource, /return 'AI'/)
})

test('popup empty search state offers actionable recovery controls', () => {
  assert.match(popupSource, /function renderEmptySearchState/)
  assert.match(popupSource, /data-empty-action="clear-query"/)
  assert.match(popupSource, /data-empty-action="clear-filter"/)
  assert.match(popupSource, /data-empty-action="show-all"/)
  assert.match(popupSource, /data-empty-action="toggle-natural"/)
  assert.match(popupSource, /dom\.emptyState\.addEventListener\('click', handleContentClick\)/)
  assert.match(popupSource, /handleEmptySearchAction/)
})

test('popup natural search allows local parsing without AI setup', () => {
  assert.match(popupSource, /naturalSearchSetupRequired/)
  assert.match(popupSource, /function renderNaturalSearchSetupState/)
  assert.doesNotMatch(popupSource, /state\.naturalSearchEnabled = false[\s\S]{0,240}state\.naturalSearchSetupRequired = true/)
  assert.match(popupSource, /未配置 AI 渠道，已使用本地解析。/)
  assert.match(popupSource, /正在使用本地解析/)
  assert.match(popupSource, /无需配置 AI 渠道/)
  assert.match(popupSource, /data-empty-action="open-ai-settings"/)
  assert.match(popupSource, /配置 AI 增强/)
  assert.match(popupSource, /function hasConfiguredAiProviderSettings/)
  assert.match(popupSource, /if \(!hasConfiguredAiProviderSettings\(settings\)\)[\s\S]*?return localPlan/)
  assert.match(popupSource, /openSettingsPage\('ai-provider'\)/)
})

test('popup natural search does not reuse stale AI plans without provider setup', () => {
  assert.match(popupSource, /function resolveCachedNaturalSearchPlan\(query, planCacheKey\): Promise<NaturalSearchPlan>/)
  assert.match(popupSource, /const cachedPlan = await resolveCachedNaturalSearchPlan\(query, planCacheKey\)/)
  assert.match(popupSource, /if \(!cachedPlan \|\| cachedPlan\.source !== 'ai'\)[\s\S]*?return localPlan/)
  assert.match(popupSource, /if \(hasConfiguredAiProviderSettings\(settings\)\)[\s\S]*?return cachedPlan/)
  assert.match(popupSource, /state\.naturalSearchPlanCache\.delete\(planCacheKey\)/)
  assert.match(popupSource, /未配置 AI 渠道，已使用本地解析。/)
})

test('popup folder pickers expose option and treeitem semantics', () => {
  assert.match(popupHtml, /id="folder-breadcrumbs"[^>]+aria-label="当前文件夹路径"/)
  assert.match(popupSource, /data-folder-breadcrumb-id="\$\{escapeAttr\(segment\.id\)\}"/)
  assert.match(popupSource, /aria-current="page"/)
  assert.match(popupSource, /function handlePopupBreadcrumbClick/)
  assert.match(popupSource, /class="filter-option \$\{isSelected \? 'selected' : ''\}"[\s\S]*?role="option"[\s\S]*?aria-selected="\$\{isSelected \? 'true' : 'false'\}"/)
  assert.match(popupSource, /data-toggle-move-folder="\$\{escapeAttr\(node\.id\)\}"[\s\S]*?role="treeitem"[\s\S]*?aria-level="\$\{depth \+ 1\}"[\s\S]*?aria-expanded="\$\{childFolders\.length \? String\(isExpanded\) : 'false'\}"/)
  assert.match(popupSource, /role="treeitem"[\s\S]*?aria-level="\$\{depth \+ 1\}"[\s\S]*?aria-selected="\$\{isCurrentFolder \? 'true' : 'false'\}"[\s\S]*?data-select-folder="\$\{escapeAttr\(node\.id\)\}"/)
  assert.match(popupSource, /role="treeitem"[\s\S]*?aria-level="\$\{depth \+ 1\}"[\s\S]*?aria-selected="false"[\s\S]*?data-smart-select-folder="\$\{escapeAttr\(node\.id\)\}"/)
})
