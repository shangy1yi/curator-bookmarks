import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
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
  assert.match(popupSource, /let naturalSearchModulePromise: Promise<typeof import\('\.\/natural-search\.js'\)> \| null = null/)
  assert.match(popupSource, /naturalSearchModulePromise \|\|= import\('\.\/natural-search\.js'\)/)
  assert.doesNotMatch(popupSource, /^import\s+(?!type)(?:[^\n]|\n(?!import\b))*from\s+['"]\.\/natural-search\.js['"]/m)
  assert.match(popupSource, /naturalSearch: typeof import\('\.\/natural-search\.js'\)[\s\S]*?\): Promise<NaturalSearchPlan>/)
  assert.match(popupSource, /const naturalSearch = await loadNaturalSearchModule\(\)/)
  assert.match(popupSource, /const cachedPlanResult = await resolveCachedNaturalSearchPlan\(query, planCacheKey, naturalSearch\)/)
  assert.match(popupSource, /if \(cachedPlanResult\.canReuseResults\)[\s\S]*?state\.searchResults = cachedResults\.slice/)
  assert.match(popupSource, /Promise<\{ plan: NaturalSearchPlan; canReuseResults: boolean \}>/)
  assert.match(popupSource, /if \(!cachedPlan \|\| cachedPlan\.source !== 'ai'\)[\s\S]*?return \{ plan: localPlan, canReuseResults: true \}/)
  assert.match(popupSource, /if \(hasConfiguredAiProviderSettings\(settings\)\)[\s\S]*?return \{ plan: cachedPlan, canReuseResults: true \}/)
  assert.match(popupSource, /state\.naturalSearchPlanCache\.delete\(planCacheKey\)/)
  assert.match(popupSource, /return \{ plan: localPlan, canReuseResults: false \}/)
  assert.match(popupSource, /state\.searchCache\.delete\(cacheKey\)/)
  assert.match(popupSource, /未配置 AI 渠道，已使用本地解析。/)
})

test('built popup html does not preload natural search chunk', { skip: !existsSync(resolve(process.cwd(), 'dist/src/popup/popup.html')) }, () => {
  const builtPopupHtml = readProjectFile('dist/src/popup/popup.html')
  assert.doesNotMatch(builtPopupHtml, /<link[^>]+rel="modulepreload"[^>]+natural-search/i)
  assert.doesNotMatch(builtPopupHtml, /<link[^>]+natural-search[^>]+rel="modulepreload"/i)
})

test('popup smart page extraction is lazy loaded for classification only', () => {
  assert.match(popupSource, /let contentExtractionModulePromise: Promise<typeof import\('\.\.\/options\/sections\/content-extraction\.js'\)> \| null = null/)
  assert.match(popupSource, /contentExtractionModulePromise \|\|= import\('\.\.\/options\/sections\/content-extraction\.js'\)/)
  assert.doesNotMatch(popupSource, /^import\s+(?!type)(?:[^\n]|\n(?!import\b))*from\s+['"]\.\.\/options\/sections\/content-extraction\.js['"]/m)
  assert.match(popupSource, /async function buildCurrentPageContext\(currentUrl, settings\)[\s\S]*?const contentExtraction = await loadContentExtractionModule\(\)/)
  assert.match(popupSource, /async function requestSmartClassification\(\{ settings, pageContext, currentUrl \}\)[\s\S]*?const \[contentExtraction, aiResponse\] = await Promise\.all\(/)
  assert.match(popupSource, /contentExtraction\.buildPageContextForAi\([\s\S]*?contentExtraction\.normalizePageContentContext\(pageContext\)/)
})

test('popup AI settings normalizer is lazy loaded only when AI features need settings', () => {
  assert.match(popupSource, /let aiSettingsModulePromise: Promise<typeof import\('\.\.\/options\/sections\/ai-settings\.js'\)> \| null = null/)
  assert.match(popupSource, /aiSettingsModulePromise \|\|= import\('\.\.\/options\/sections\/ai-settings\.js'\)/)
  assert.doesNotMatch(popupSource, /^import\s+(?!type)(?:[^\n]|\n(?!import\b))*from\s+['"]\.\.\/options\/sections\/ai-settings\.js['"]/m)
  assert.doesNotMatch(popupSource, /^import\s+(?!type)(?:[^\n]|\n(?!import\b))*from\s+['"]\.\.\/options\/shared-options\/constants\.js['"]/m)
  assert.match(popupSource, /const \{ normalizeAiNamingSettings \} = await loadAiSettingsModule\(\)/)
  assert.match(popupSource, /const POPUP_SMART_DEFAULT_TIMEOUT_MS = 30000/)
  assert.match(popupSource, /const POPUP_JINA_READER_ORIGIN = 'https:\/\/r\.jina\.ai\/\*'/)
})

test('popup AI response helpers are lazy loaded only when AI requests run', () => {
  assert.match(popupSource, /let aiResponseModulePromise: Promise<typeof import\('\.\.\/shared\/ai-response\.js'\)> \| null = null/)
  assert.match(popupSource, /aiResponseModulePromise \|\|= import\('\.\.\/shared\/ai-response\.js'\)/)
  assert.doesNotMatch(popupSource, /^import\s+(?!type)(?:[^\n]|\n(?!import\b))*from\s+['"]\.\.\/shared\/ai-response\.js['"]/m)
  assert.match(popupSource, /const aiResponse = await loadAiResponseModule\(\)[\s\S]*?aiResponse\.getAiEndpoint\(settings\)/)
  assert.match(popupSource, /Promise\.all\(\[[\s\S]*?loadContentExtractionModule\(\),[\s\S]*?loadAiResponseModule\(\)[\s\S]*?\]\)/)
  assert.match(popupSource, /aiResponse\.extractAiErrorMessage\(payload, response\.status\)/)
})

test('built popup html does not preload smart page extraction chunk', { skip: !existsSync(resolve(process.cwd(), 'dist/src/popup/popup.html')) }, () => {
  const builtPopupHtml = readProjectFile('dist/src/popup/popup.html')
  assert.doesNotMatch(builtPopupHtml, /<link[^>]+rel="modulepreload"[^>]+content-extraction/i)
  assert.doesNotMatch(builtPopupHtml, /<link[^>]+content-extraction[^>]+rel="modulepreload"/i)
  assert.doesNotMatch(builtPopupHtml, /<link[^>]+rel="modulepreload"[^>]+ai-settings/i)
  assert.doesNotMatch(builtPopupHtml, /<link[^>]+ai-settings[^>]+rel="modulepreload"/i)
  assert.doesNotMatch(builtPopupHtml, /<link[^>]+rel="modulepreload"[^>]+ai-response/i)
  assert.doesNotMatch(builtPopupHtml, /<link[^>]+ai-response[^>]+rel="modulepreload"/i)
})

test('popup inbox filter title does not preload inbox state module', { skip: !existsSync(resolve(process.cwd(), 'dist/src/popup/popup.html')) }, () => {
  const builtPopupHtml = readProjectFile('dist/src/popup/popup.html')
  assert.doesNotMatch(popupSource, /^import\s+(?!type)(?:[^\n]|\n(?!import\b))*from\s+['"]\.\.\/shared\/inbox\.js['"]/m)
  assert.doesNotMatch(builtPopupHtml, /<link[^>]+rel="modulepreload"[^>]+inbox/i)
  assert.doesNotMatch(builtPopupHtml, /<link[^>]+inbox[^>]+rel="modulepreload"/i)
})

test('popup recycle bin helpers load only after delete actions', { skip: !existsSync(resolve(process.cwd(), 'dist/src/popup/popup.html')) }, () => {
  const builtPopupHtml = readProjectFile('dist/src/popup/popup.html')
  assert.match(popupSource, /let recycleBinModulePromise: Promise<typeof import\('\.\.\/shared\/recycle-bin\.js'\)> \| null = null/)
  assert.match(popupSource, /recycleBinModulePromise \|\|= import\('\.\.\/shared\/recycle-bin\.js'\)/)
  assert.doesNotMatch(popupSource, /^import\s+(?!type)(?:[^\n]|\n(?!import\b))*from\s+['"]\.\.\/shared\/recycle-bin\.js['"]/m)
  assert.match(popupSource, /const recycleBin = await loadRecycleBinModule\(\)[\s\S]*?recycleBin\.deleteBookmarkToRecycle/)
  assert.match(popupSource, /const recycleBin = await loadRecycleBinModule\(\)[\s\S]*?recycleBin\.removeRecycleEntry/)
  assert.doesNotMatch(builtPopupHtml, /<link[^>]+rel="modulepreload"[^>]+recycle-bin/i)
  assert.doesNotMatch(builtPopupHtml, /<link[^>]+recycle-bin[^>]+rel="modulepreload"/i)
})

test('popup startup uses light snapshot search metadata instead of full snapshot storage module', { skip: !existsSync(resolve(process.cwd(), 'dist/src/popup/popup.html')) }, () => {
  const searchSource = readProjectFile('src/popup/search.ts')
  const searchIndexSource = readProjectFile('src/popup/search-index.ts')
  const builtPopupHtml = readProjectFile('dist/src/popup/popup.html')

  assert.match(searchSource, /from '\.\.\/shared\/content-snapshot-search\.js'/)
  assert.match(searchIndexSource, /from '\.\.\/shared\/content-snapshot-search\.js'/)
  assert.match(searchIndexSource, /await import\('\.\.\/shared\/content-snapshots\.js'\)/)
  assert.doesNotMatch(searchSource, /^import\s+(?!type)(?:[^\n]|\n(?!import\b))*from\s+['"]\.\.\/shared\/content-snapshots\.js['"]/m)
  assert.doesNotMatch(builtPopupHtml, /<link[^>]+rel="modulepreload"[^>]+content-snapshots/i)
  assert.doesNotMatch(builtPopupHtml, /<link[^>]+content-snapshots[^>]+rel="modulepreload"/i)
})

test('popup folder pickers expose option and treeitem semantics', () => {
  assert.match(popupHtml, /id="folder-breadcrumbs"[^>]+aria-label="当前文件夹路径"/)
  assert.match(popupHtml, /id="filter-folder-list"[^>]+role="listbox"[^>]+aria-label="筛选文件夹候选列表"/)
  assert.match(popupHtml, /id="move-folder-list"[^>]+role="tree"[^>]+aria-label="移动目标文件夹"/)
  assert.match(popupHtml, /id="smart-folder-list"[^>]+role="tree"[^>]+aria-label="保存目标文件夹"/)
  assert.match(popupSource, /data-folder-breadcrumb-id="\$\{escapeAttr\(segment\.id\)\}"/)
  assert.match(popupSource, /aria-current="page"/)
  assert.match(popupSource, /function handlePopupBreadcrumbClick/)
  assert.match(popupSource, /class="filter-option \$\{isSelected \? 'selected' : ''\}"[\s\S]*?role="option"[\s\S]*?aria-selected="\$\{isSelected \? 'true' : 'false'\}"/)
  assert.match(popupSource, /filterFolderActiveId/)
  assert.match(popupSource, /dom\.filterFolderList\.addEventListener\('keydown', handleFilterListKeydown\)/)
  assert.match(popupSource, /dom\.filterSearchInput\.addEventListener\('keydown', handleFilterSearchKeydown\)/)
  assert.match(popupSource, /function handleFilterListKeydown\(event\)/)
  assert.match(popupSource, /event\.key !== 'Home'[\s\S]*?event\.key !== 'End'[\s\S]*?event\.key !== 'Escape'/)
  assert.match(popupSource, /dom\.filterSearchInput\.focus\(\)/)
  assert.match(popupSource, /tabindex="\$\{isActive \? '0' : '-1'\}"/)
  assert.match(popupSource, /data-toggle-move-folder="\$\{escapeAttr\(node\.id\)\}"[\s\S]*?role="treeitem"[\s\S]*?aria-level="\$\{depth \+ 1\}"[\s\S]*?aria-expanded="\$\{childFolders\.length \? String\(isExpanded\) : 'false'\}"/)
  assert.match(popupSource, /role="treeitem"[\s\S]*?aria-level="\$\{depth \+ 1\}"[\s\S]*?aria-selected="\$\{isCurrentFolder \? 'true' : 'false'\}"[\s\S]*?data-select-folder="\$\{escapeAttr\(node\.id\)\}"/)
  assert.match(popupSource, /role="treeitem"[\s\S]*?aria-level="\$\{depth \+ 1\}"[\s\S]*?aria-selected="false"[\s\S]*?data-smart-select-folder="\$\{escapeAttr\(node\.id\)\}"/)
})
