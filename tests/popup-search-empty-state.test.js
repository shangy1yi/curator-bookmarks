import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

function readProjectFile(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const popupSource = readProjectFile('src/popup/popup.ts')
const popupStateSource = readProjectFile('src/popup/state.ts')
const popupHtml = readProjectFile('src/popup/popup.html')
const popupCss = readProjectFile('src/popup/popup.css')
const naturalSearchAiSource = readProjectFile('src/popup/natural-search-ai.ts')

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

test('popup exposes saved search controls without eager dashboard work', () => {
  assert.match(popupHtml, /id="saved-searches"[^>]+aria-label="已保存搜索"/)
  assert.match(popupSource, /loadSavedSearchIndex/)
  assert.match(popupSource, /getSavedSearchesForScope\(state\.savedSearches, 'popup'\)/)
  assert.match(popupSource, /data-saved-search-action="save-current"/)
  assert.match(popupSource, /data-saved-search-action="apply"/)
  assert.match(popupSource, /data-saved-search-action="delete"/)
  assert.match(popupSource, /void hydrateSavedSearches\(\)/)
  assert.doesNotMatch(popupSource, /^import\s+(?!type)(?:[^\n]|\n(?!import\b))*from\s+['"]\.\.\/options\//m)
})

test('popup current page card has bookmark-aware quick actions', () => {
  assert.match(popupSource, /state\.currentPageBookmarkId = matchedBookmark\?\.id \|\| null/)
  assert.match(popupStateSource, /bookmarkDuplicateKeyMap: Map<string, PopupSearchBookmark>/)
  assert.match(popupSource, /state\.bookmarkDuplicateKeyMap = buildPopupBookmarkDuplicateKeyMap\(indexedBookmarks\)/)
  assert.match(popupSource, /state\.bookmarkDuplicateKeyMap\.get\(normalizedCurrentUrl\)/)
  assert.doesNotMatch(popupSource, /state\.allBookmarks\.find\(\(bookmark\) => bookmark\.duplicateKey === normalizedCurrentUrl\)/)
  assert.match(popupSource, /已收藏 ·/)
  assert.match(popupSource, /未收藏 · 可快速保存到文件夹/)
  assert.match(popupSource, /data-current-page-action="open-folder"/)
  assert.match(popupSource, /data-current-page-action="edit"/)
  assert.match(popupSource, /data-current-page-action="pin-newtab"/)
  assert.match(popupSource, /data-current-page-action="save"/)
  assert.match(popupSource, /normalizeNewTabWorkspaceSettings/)
  assert.match(popupSource, /toggleNewTabWorkspacePin/)
})

test('popup empty search state does not render the boxed plus mark', () => {
  assert.doesNotMatch(popupCss, /\.empty-search-state::before/)
  assert.doesNotMatch(popupCss, /#empty-state\.state-panel:not\(\.hidden\)::before/)
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
  assert.match(popupSource, /loadNaturalSearchAiModule/)
  assert.match(naturalSearchAiSource, /function hasConfiguredNaturalSearchAiProvider/)
  assert.match(popupSource, /if \(!naturalSearchAi\.hasConfiguredNaturalSearchAiProvider\(settings\)\)[\s\S]*?return localPlan/)
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
  assert.match(popupSource, /if \(naturalSearchAi\.hasConfiguredNaturalSearchAiProvider\(settings\)\)[\s\S]*?return \{ plan: cachedPlan, canReuseResults: true \}/)
  assert.match(popupSource, /state\.naturalSearchPlanCache\.delete\(planCacheKey\)/)
  assert.match(popupSource, /return \{ plan: localPlan, canReuseResults: false \}/)
  assert.match(popupSource, /state\.searchCache\.delete\(cacheKey\)/)
  assert.match(popupSource, /未配置 AI 渠道，已使用本地解析。/)
})

test('popup natural search aborts stale AI requests when the query or mode changes', () => {
  assert.match(popupStateSource, /naturalSearchAbortController: AbortController \| null/)
  assert.match(popupSource, /function abortNaturalSearchRequest\(\)/)
  assert.match(popupSource, /state\.naturalSearchAbortController\?\.abort\(\)/)
  assert.match(popupSource, /const controller = new AbortController\(\)[\s\S]*?state\.naturalSearchAbortController = controller/)
  assert.match(popupSource, /abortNaturalSearchRequest\(\)[\s\S]*?state\.naturalSearchEnabled = enabled/)
  assert.match(popupSource, /if \(!normalizedQuery\)[\s\S]*?abortNaturalSearchRequest\(\)[\s\S]*?return/)
  assert.match(popupSource, /if \(state\.naturalSearchEnabled\)[\s\S]*?runNaturalSearch\(query, normalizedQuery, runId\)[\s\S]*?return[\s\S]*?abortNaturalSearchRequest\(\)/)
  assert.match(popupSource, /resolveNaturalSearchPlan\(query, normalizedQuery, naturalSearch, \{[\s\S]*?signal: controller\.signal/)
  assert.match(popupSource, /naturalSearchAi\.requestNaturalSearchAiPlan\(\{[\s\S]*?signal: options\.signal/)
  assert.match(naturalSearchAiSource, /export async function requestNaturalSearchAiPlan\(\{[\s\S]*?signal = null[\s\S]*?\}: NaturalSearchAiRequest/)
  assert.match(naturalSearchAiSource, /fetchWithTimeout\(endpoint,[\s\S]*?signal/)
  assert.match(naturalSearchAiSource, /function fetchWithTimeout\([\s\S]*?externalSignal/)
  assert.match(popupSource, /function fetchWithSmartTimeout\(url, options = \{\}, timeoutMs = POPUP_SMART_DEFAULT_TIMEOUT_MS\)[\s\S]*?externalSignal/)
  assert.match(popupSource, /isAbortError\(error\)/)
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
  assert.match(popupSource, /const \[contentExtraction, aiResponse\] = await Promise\.all\([\s\S]*?const endpoint = aiResponse\.getAiEndpoint\(settings\)/)
  assert.match(naturalSearchAiSource, /from '\.\.\/shared\/ai-response\.js'/)
  assert.match(naturalSearchAiSource, /const endpoint = getAiEndpoint\(settings\)/)
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

test('popup full text snapshot warmup is triggered by real searches instead of startup', () => {
  assert.doesNotMatch(popupSource, /schedulePopupSnapshotFullTextWarmup\(extracted\.bookmarks,\s*tagIndex\)/)
  assert.match(popupSource, /function maybeWarmPopupSnapshotFullTextForSearch\(\)/)
  assert.match(
    popupSource,
    /if \([\s\S]*?state\.searchSnapshotFullTextReady[\s\S]*?state\.searchSnapshotFullTextPending[\s\S]*?!state\.debouncedQuery\.trim\(\)[\s\S]*?\)/
  )
  assert.match(
    popupSource,
    /if \(!normalizedQuery\)[\s\S]*?return[\s\S]*?maybeWarmPopupSnapshotFullTextForSearch\(\)[\s\S]*?if \(state\.naturalSearchEnabled\)/
  )
  assert.match(popupSource, /state\.searchTagIndex = tagIndex/)
  assert.match(popupSource, /state\.searchSnapshotFullTextRunId \+= 1/)
  assert.match(popupSource, /bookmarks: state\.allBookmarks/)
  assert.match(popupSource, /tagIndex: state\.searchTagIndex/)
})

test('popup search caches expire and filtered bookmark arrays release when search is cleared', () => {
  assert.match(popupStateSource, /const SEARCH_CACHE_TTL_MS = 5 \* 60 \* 1000/)
  assert.match(popupStateSource, /searchCache: createMemoryCache<string, PopupSearchResult\[\]>\(\{[\s\S]*?ttlMs: SEARCH_CACHE_TTL_MS/)
  assert.match(popupStateSource, /naturalSearchPlanCache: createMemoryCache<string, NaturalSearchPlan>\(\{[\s\S]*?ttlMs: SEARCH_CACHE_TTL_MS/)
  assert.match(
    popupSource,
    /if \(!normalizedQuery\) \{[\s\S]*?state\.filteredBookmarksCacheKey = ''[\s\S]*?state\.filteredBookmarksCache = \[\][\s\S]*?abortNaturalSearchRequest\(\)[\s\S]*?return/
  )
  assert.match(popupSource, /window\.addEventListener\('pagehide', cleanupPopupRuntime\)/)
  assert.match(popupSource, /function cleanupPopupRuntime\(\)/)
  assert.match(popupSource, /chrome\.storage\?\.onChanged\?\.removeListener\?\.\(handleAutoAnalyzeStorageChanged\)/)
  assert.match(popupSource, /state\.contentRenderHtml = ''/)
  assert.match(popupSource, /state\.toastTimers\.clear\(\)/)
  assert.match(popupSource, /clearSearchCaches\(\)/)
})

test('popup smart loading progress uses transform without layout reads', () => {
  assert.match(popupSource, /style="--smart-progress-scale: \$\{startProgress \/ 100\}"/)
  assert.match(popupSource, /function renderSmartLoadingState\(\)/)
  assert.match(popupSource, /const existingCard = dom\.smartClassifier\.querySelector<HTMLElement>\('\.smart-loading-card'\)/)
  assert.match(popupSource, /progressBar\.dataset\.smartProgressTarget = String\(progress\)/)
  assert.match(popupSource, /progressBar\.style\.setProperty\('--smart-progress-scale', String\(targetProgress \/ 100\)\)/)
  assert.doesNotMatch(popupSource, /function readSmartProgressPercent/)
  assert.doesNotMatch(popupSource, /getBoundingClientRect\(\)\.width \/ trackWidth/)
  assert.match(popupCss, /transform: scaleX\(var\(--smart-progress-scale, 0\)\)/)
  assert.match(popupCss, /will-change: transform/)
  assert.doesNotMatch(popupCss, /transition: width 760ms/)
})

test('popup folder pickers expose option and treeitem semantics', () => {
  assert.match(popupHtml, /id="folder-breadcrumbs"[^>]+aria-label="当前文件夹路径"/)
  const filterSearchInput = popupHtml.match(/<input[\s\S]*?id="filter-search-input"[\s\S]*?>/)?.[0] || ''
  assert.match(filterSearchInput, /aria-label="搜索筛选文件夹"/)
  assert.match(filterSearchInput, /aria-controls="filter-folder-list"/)
  const moveSearchInput = popupHtml.match(/<input[\s\S]*?id="move-search-input"[\s\S]*?>/)?.[0] || ''
  assert.match(moveSearchInput, /aria-label="搜索移动目标文件夹"/)
  assert.match(moveSearchInput, /aria-controls="move-folder-list"/)
  const smartFolderSearchInput = popupHtml.match(/<input[\s\S]*?id="smart-folder-search-input"[\s\S]*?>/)?.[0] || ''
  assert.match(smartFolderSearchInput, /aria-label="搜索保存目标文件夹"/)
  assert.match(smartFolderSearchInput, /aria-controls="smart-folder-list"/)
  assert.match(popupHtml, /id="filter-folder-list"[^>]+role="listbox"[^>]+aria-label="筛选文件夹候选列表"/)
  assert.match(popupHtml, /id="move-folder-list"[^>]+role="tree"[^>]+aria-label="移动目标文件夹"/)
  assert.match(popupHtml, /id="smart-folder-list"[^>]+role="tree"[^>]+aria-label="保存目标文件夹"/)
  assert.match(popupSource, /data-folder-breadcrumb-id="\$\{escapeAttr\(segment\.id\)\}"/)
  assert.match(popupSource, /aria-current="page"/)
  assert.match(popupSource, /function handlePopupBreadcrumbClick/)
  assert.match(popupSource, /class="filter-option \$\{isSelected \? 'selected' : ''\}"[\s\S]*?role="option"[\s\S]*?aria-selected="\$\{isSelected \? 'true' : 'false'\}"/)
  assert.match(popupSource, /function getPopupFolderToggleLabel\(action, folderPath\)/)
  assert.match(popupSource, /return `\$\{action\}：\$\{target \|\| '未命名文件夹'\}`/)
  assert.match(popupSource, /const toggleLabel = getPopupFolderToggleLabel\([\s\S]*?formatFolderPath\(folderInfo, state\.folderMap\)[\s\S]*?\)/)
  assert.match(popupSource, /const toggleLabel = getPopupFolderToggleLabel\(isExpanded \? '折叠文件夹' : '展开文件夹', folderPath\)/)
  assert.match(popupSource, /data-toggle-folder="\$\{escapeAttr\(node\.id\)\}"[\s\S]*?aria-label="\$\{escapeAttr\(toggleLabel\)\}"/)
  assert.match(popupSource, /data-toggle-move-folder="\$\{escapeAttr\(node\.id\)\}"[\s\S]*?aria-label="\$\{escapeAttr\(toggleLabel\)\}"/)
  assert.match(popupSource, /data-toggle-smart-folder="\$\{escapeAttr\(node\.id\)\}"[\s\S]*?aria-label="\$\{escapeAttr\(toggleLabel\)\}"/)
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
