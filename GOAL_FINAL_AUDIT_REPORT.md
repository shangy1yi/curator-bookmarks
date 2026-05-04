# 仓库多维度审查报告

## 一、执行摘要

- 仓库类型：Chrome Manifest V3 书签管理扩展。
- 主要技术栈：TypeScript、Vite、@crxjs/vite-plugin、Chrome Extension APIs、Node test runner、Playwright。
- 集成分支：`integration/goal-final-polish-20260504`
- 集成 worktree：`/mnt/g/coding/worktrees/goal-final-polish-20260504`
- 基线：`main@11582da` / `v1.4.23`
- 当前集成代码状态：在 `a21eac8` 基础上继续追加 options 移动目标文件夹 picker listbox 语义与键盘导航修正；报告最新提交以 `git log -1 --oneline` 为准。

本轮采用多 agent 分支审查与修复流程，覆盖性能、UI、功能、人性化体验、构建安全五个可合并改动方向。主工作区 `/mnt/g/coding/chromebookmark` 保持在 `main@11582da`，未合并到 `main`。

## 二、严重问题总览

- [中] 性能：popup/options 首屏加载超大 `icon4096.jpg`
  - 位置：`src/popup/popup.html`、`src/options/options.html`
  - 影响：增加扩展页面首屏资源体积，尤其影响 popup 打开速度。
  - 建议：改用 `icon128.png` 并增加测试防止回退。
  - 处理：已完成，popup/options 品牌图使用 `../assets/icon128.png`。

- [中] 性能：newtab 书签变更事件直接触发全量刷新
  - 位置：`src/newtab/newtab.ts` / `handleBookmarksChanged`
  - 影响：连续编辑、移动、同步书签时可能造成重复渲染与搜索索引重建。
  - 建议：合并短时间内的变更事件，并避免刷新并发。
  - 处理：已完成，新增 `BOOKMARK_CHANGE_REFRESH_DEBOUNCE_MS`、`scheduleBookmarkChangeRefresh`、`flushBookmarkChangeRefresh`。

- [中] 性能：AI 快照单条保存后重建全量全文搜索 map
  - 位置：`src/options/options.ts`
  - 影响：大量快照保存时放大 IndexedDB/local storage 读取和 map 重建成本。
  - 建议：只更新被保存书签对应的 search text entry。
  - 处理：已完成，新增单条 search text entry 更新路径和回归测试。

- [中] 性能：newtab 首屏预加载 popup 搜索重 chunk
  - 位置：`src/newtab/content-state.ts`、`src/newtab/newtab.ts`
  - 影响：newtab 初始 HTML 曾预加载 `natural-search`、`search`/`search-index`、`content-snapshots` 等搜索相关 chunk，其中搜索 chunk 约 312KB，普通打开新标签页也要承担成本；非首屏必要的 loader、动效、回收站和书签写操作模块也会扩大初始加载面。
  - 建议：保留轻量同步书签建议，pinyin、自然语言、复杂 popup 搜索能力和低频操作模块改为用户触发后按需加载。
  - 处理：已完成，普通关键词命中不加载搜索重 chunk；无轻量命中或明显自然语言查询时再按需加载；`dot-matrix-loader`、`motion`、`recycle-bin`、`bookmarks-api` 不再作为 newtab 普通打开/普通搜索路径的业务 chunk。

- [低] 性能：popup 默认打开预加载自然语言搜索 chunk
  - 位置：`src/popup/popup.ts`
  - 影响：popup 默认关闭自然语言搜索，但首屏 HTML 仍会预加载 `natural-search-*`，增加普通打开成本。
  - 建议：保留搜索主路径，只有用户启用语义搜索并发起查询时再加载自然语言解析模块。
  - 处理：已完成，`natural-search` 改为缓存的动态 import；默认打开 popup 的 Playwright 网络请求未出现 `natural-search-*`。

- [低] 性能：popup 默认打开预加载智能分类专用 AI chunk
  - 位置：`src/popup/popup.ts`
  - 影响：普通打开 popup 即使只搜索/管理书签，也会预加载 `content-extraction-*`、`ai-settings-*` 等智能分类专用模块。
  - 建议：AI 设置归一化、网页内容抽取和 AI prompt 上下文构建只在用户触发智能分类时按需加载。
  - 处理：已完成，`content-extraction` 和 `ai-settings` 改为缓存的动态 import；构建后 popup 默认 `modulepreload` 不再包含这两个 chunk。

- [低] 性能：popup 默认打开预加载低频 Inbox/AI 响应 helper
  - 位置：`src/popup/popup.ts`、`src/shared/inbox.ts`
  - 影响：普通打开 popup 会为了 Inbox 标题常量预加载完整 Inbox 状态模块，也会预加载只在 AI 请求结果解析时使用的 `ai-response-*` helper。
  - 建议：把 Inbox 标题常量放入轻量共享常量入口；AI 响应解析 helper 改为自然语言 AI 改写或智能分类请求触发后再加载。
  - 处理：已完成，popup 默认 `modulepreload` 不再包含 `inbox-*` 或 `ai-response-*`。

- [低] 性能：popup 默认打开预加载回收站 helper
  - 位置：`src/popup/popup.ts`
  - 影响：普通打开 popup 和普通搜索不会删除书签，但首屏仍会预加载 `recycle-bin-*`。
  - 建议：删除确认和撤销删除路径触发后再加载回收站事务 helper。
  - 处理：已完成，popup 默认 `modulepreload` 不再包含 `recycle-bin-*`。

- [低] 性能：popup 默认打开预加载完整内容快照存储模块
  - 位置：`src/popup/search.ts`、`src/popup/search-index.ts`、`src/shared/content-snapshots.ts`
  - 影响：popup 首屏只需要内容快照设置、索引 normalizer 和轻量搜索文本，但静态依赖完整 `content-snapshots` 会把 IndexedDB 全文读取、保存、删除等低频能力带入首屏预加载。
  - 建议：拆出轻量内容快照搜索入口；只有全文 warmup 或保存/删除快照时再加载完整存储模块。
  - 处理：已完成，popup 默认 `modulepreload` 不再包含完整 `content-snapshots-*`，只保留首屏搜索需要的轻量 `content-snapshot-search-*`。

- [低] 性能/功能：自动分析失败后可能安排无意义队列唤醒
  - 位置：`src/service-worker/service-worker.ts` / `markAutoAnalyzeQueueEntryFailed`
  - 影响：队列条目达到最大重试次数被移除，或下一条剩余任务有更晚 `nextRunAt` 时，仍固定按 `AUTO_ANALYZE_QUEUE_RETRY_MS` 创建闹钟，造成 service worker 无意义唤醒。
  - 建议：失败写回后基于更新后的剩余队列重新计算下一次唤醒。
  - 处理：已完成，`markAutoAnalyzeQueueEntryFailed` 使用 `scheduleNextAutoAnalyzeQueueWake(nextQueue)`。

- [高] 功能：标签索引并发写入可能覆盖字段
  - 位置：`src/shared/bookmark-tags.ts`
  - 影响：手动标签保存、AI 标签保存、清理标签并发时可能丢字段。
  - 建议：所有写路径统一通过 `updateBookmarkTagIndex` 串行更新。
  - 处理：已完成，`saveManualBookmarkTags`、`clearManualBookmarkTags` 等写路径统一串行化。

- [高] 功能：无 HTTP 主请求证据时将导航成功误判为 available
  - 位置：`src/options/sections/classifier.ts` / `shouldAcceptNavigationSuccess`
  - 影响：部分错误页、拦截页、无响应证据页面可能被标为可用。
  - 建议：导航成功必须有 main request 证据，且 HTTP status 小于 400。
  - 处理：已完成，`shouldAcceptNavigationSuccess` 要求 `requestSent && statusCode > 0 && statusCode < 400`。

- [中] UI：newtab dashboard overlay 缺少失败状态和父层关闭路径
  - 位置：`src/newtab/newtab.html`、`src/newtab/newtab.ts`
  - 影响：iframe 加载失败或超时会让用户停在加载层。
  - 建议：增加关闭按钮、超时 fallback、返回和重试操作。
  - 处理：已完成，增加 `newtab-dashboard-close`、`newtab-dashboard-fallback`、12 秒加载超时。

- [中] UI/可访问性：popup 模态打开时背景仍可能被辅助技术或键盘路径访问
  - 位置：`src/popup/popup.ts`
  - 影响：模态状态下焦点和语义上下文不够清晰。
  - 建议：模态打开时让背景 app shell `inert` 并设置 `aria-hidden`。
  - 处理：已完成，新增 `syncPopupAppShellModalState`。

- [低] UI/可访问性：popup 书签操作菜单按钮名称重复
  - 位置：`src/popup/popup.ts` / `renderBookmarkRow`、`renderSearchResults`
  - 影响：屏幕阅读器用户在书签树或搜索结果中连续浏览菜单按钮时，只会听到重复的“打开操作菜单”，难以判断按钮对应哪条书签。
  - 建议：操作菜单按钮的 `aria-label` 包含当前书签标题。
  - 处理：已完成，菜单按钮现在使用 `打开 ${title} 的操作菜单`，并限制标题长度与 HTML 属性转义。

- [低] UI/可访问性：popup 书签操作菜单缺少触发按钮方向键入口和关闭回焦
  - 位置：`src/popup/popup.ts` / `handleContentClick`、`handleDocumentKeydown`
  - 影响：菜单项已有方向键导航，但键盘焦点停在菜单触发按钮时不能用 ArrowDown/ArrowUp 直接进入菜单；Escape 关闭后也没有明确回到触发按钮。
  - 建议：复用统一打开函数，触发按钮支持 ArrowDown/ArrowUp 打开并聚焦首尾菜单项；Escape 或再次点击关闭菜单后回焦到对应触发按钮。
  - 处理：已完成，popup 书签操作菜单支持触发按钮方向键入口，并在 Escape 或再次点击关闭时恢复焦点。

- [低] UI/可访问性：popup 筛选文件夹 listbox 缺少方向键导航
  - 位置：`src/popup/popup.ts` / `renderFilterFolderList`、`handleFilterListClick`
  - 影响：筛选文件夹弹窗已有 listbox/option 语义，但键盘用户需要按 Tab 逐项进入候选文件夹，筛选后也缺少稳定的当前选项焦点。
  - 建议：搜索框支持 ArrowDown/ArrowUp 进入首尾候选项；列表内支持 ArrowUp/ArrowDown/Home/End/Escape，候选项使用 roving `tabIndex`。
  - 处理：已完成，popup 筛选文件夹列表支持方向键进入、循环移动、Home/End 跳转和 Escape 回到搜索框。

- [低] UI/可访问性：options 范围筛选文件夹 listbox 缺少方向键导航
  - 位置：`src/options/options.ts` / `renderScopeModal`、`handleScopeFolderResultsClick`
  - 影响：可用性检测、历史记录和书签智能分析共用的范围筛选弹窗已有 listbox/option 语义，但键盘用户需要连续 Tab 浏览候选文件夹。
  - 建议：搜索框支持 ArrowDown/ArrowUp 进入首尾候选项；列表内支持 ArrowUp/ArrowDown/Home/End/Escape，候选项使用 roving `tabIndex`，并保留“全部书签”选项。
  - 处理：已完成，options 范围筛选文件夹列表支持方向键进入、循环移动、Home/End 跳转和 Escape 回到搜索框。

- [低] UI/可访问性：options AI 模型 picker listbox 缺少方向键导航
  - 位置：`src/options/options.ts` / `renderAiModelPickerModal`、`handleAiModelPickerResultsClick`
  - 影响：AI 模型选择弹窗已有 listbox/option 语义，但键盘用户需要连续 Tab 浏览模型卡片，搜索后当前候选模型焦点不稳定。
  - 建议：搜索框支持 ArrowDown/ArrowUp 进入首尾候选模型；列表内支持 ArrowUp/ArrowDown/Home/End/Escape，候选项使用 roving `tabIndex`。
  - 处理：已完成，AI 模型 picker 支持方向键进入、循环移动、Home/End 跳转和 Escape 回到搜索框。

- [低] UI/可访问性：options 移动目标文件夹 picker 缺少 listbox 语义与方向键导航
  - 位置：`src/options/options.html` / `move-folder-results`、`src/options/options.ts` / `renderMoveModal`、`handleMoveFolderResultsClick`
  - 影响：批量移动和 Dashboard 单条移动共用的目标文件夹列表只是一组按钮，辅助技术无法稳定识别为候选列表，键盘用户也需要连续 Tab 浏览目标文件夹。
  - 建议：结果容器声明为 listbox，目标文件夹按钮声明为 option；搜索框支持 ArrowDown/ArrowUp 进入首尾候选项，列表内支持 ArrowUp/ArrowDown/Home/End/Escape 和 roving `tabIndex`。
  - 处理：已完成，移动目标文件夹 picker 支持 listbox/option 语义、方向键进入、循环移动、Home/End 跳转和 Escape 回到搜索框。

- [低] UI/可访问性：Dashboard 卡片动作按钮名称缺少书签上下文
  - 位置：`src/options/sections/dashboard.ts` / `buildDashboardCard`
  - 影响：Dashboard 卡片列表中“打开、复制、修改标签、移动、删除”按钮重复出现，辅助技术用户浏览按钮列表时难以判断动作对应哪条书签。
  - 建议：为每个卡片动作按钮补充包含书签标题的 `aria-label`。
  - 处理：已完成，卡片动作按钮现在使用 `打开书签：${title}`、`删除书签：${title}` 等上下文化名称。

- [低] UI/可访问性：回收站条目操作按钮名称缺少书签上下文
  - 位置：`src/options/sections/recycle.ts` / `buildRecycleEntryCard`
  - 影响：回收站列表中“选择、恢复书签、清除”控件重复出现，辅助技术用户难以确认当前操作对应哪条已删除书签。
  - 建议：选择框、恢复按钮和清除按钮的 `aria-label` 包含回收站条目的书签标题。
  - 处理：已完成，回收站条目控件现在使用 `选择回收站书签：${title}`、`恢复书签：${title}`、`清除回收站记录：${title}`。

- [低] UI/可访问性：重定向结果动作按钮名称缺少书签上下文
  - 位置：`src/options/sections/redirects.ts` / `buildRedirectResultCard`
  - 影响：重定向结果列表中“选择、更新为最终 URL、打开最终链接”控件重复出现，辅助技术用户难以确认写入或打开的是哪条书签。
  - 建议：选择、更新和打开最终链接控件的 `aria-label` 包含当前书签标题。
  - 处理：已完成，重定向结果控件现在使用 `选择重定向书签：${title}`、`更新为最终 URL：${title}`、`打开最终链接：${title}`。

- [低] UI/可访问性：书签智能分析结果动作按钮名称缺少书签上下文
  - 位置：`src/options/options.ts` / `buildAiNamingResultCard`
  - 影响：智能分析结果列表中“选择、打开页面、应用建议、移动至推荐文件夹”控件重复出现，辅助技术用户难以确认应用或移动的是哪条书签。
  - 建议：选择、打开、应用和移动控件的 `aria-label` 包含当前书签标题。
  - 处理：已完成，智能分析结果控件现在使用 `选择书签智能分析建议：${title}`、`应用书签智能分析建议：${title}`、`移动至推荐文件夹：${title}` 等上下文化名称。

- [低] UI/可访问性：重复书签逐条勾选缺少书签上下文
  - 位置：`src/options/sections/duplicates.ts` / `buildDuplicateItemCard`
  - 影响：重复书签列表中每条副本都显示“移入回收站”勾选项，辅助技术用户难以确认当前勾选的是哪条副本。
  - 建议：逐条勾选框的 `aria-label` 包含书签标题和路径。
  - 处理：已完成，重复书签勾选框现在使用 `移入回收站：${title}，位置：${path}`。

- [低] UI/可访问性：忽略规则删除按钮名称缺少规则上下文
  - 位置：`src/options/sections/ignore.ts` / `buildIgnoreRuleCard`
  - 影响：书签、域名、文件夹三类忽略规则中重复出现“删除规则”按钮，辅助技术用户难以确认将删除哪条规则。
  - 建议：删除按钮的 `aria-label` 包含当前忽略规则名称、文件夹路径或域名。
  - 处理：已完成，删除按钮现在使用 `删除忽略规则：${rule}`，并限制长规则名称朗读长度。

- [低] UI/可访问性：文件夹清理建议动作按钮名称缺少建议上下文
  - 位置：`src/options/sections/folder-cleanup.ts` / `buildSuggestionCard`、`buildSplitUndoNotice`
  - 影响：文件夹清理列表中“查看预览、确认删除/合并/拆分/移动、撤销本次拆分”等按钮重复出现，辅助技术用户难以确认操作对象。
  - 建议：预览、执行和撤销按钮的 `aria-label` 包含当前清理建议标题或拆分撤销书签数量。
  - 处理：已完成，文件夹清理动作按钮现在使用 `动作：${suggestion}` 或 `撤销本次拆分：${title}，${count} 个书签`。

- [低] UI/可访问性：可用性检测结果卡动作按钮名称缺少书签上下文
  - 位置：`src/options/options.ts` / `buildAvailabilityDisplayCard`、`getAvailabilityConfidenceMoveAction`
  - 影响：异常结果卡中“选择、打开链接、移入高置信异常、移回低置信异常”等控件重复出现，辅助技术用户难以确认操作对应哪条书签。
  - 建议：选择、打开和置信分区移动控件的 `aria-label` 包含当前书签标题和路径。
  - 处理：已完成，可用性检测结果控件现在使用 `动作：${title}，位置：${path}`。

- [低] UI/可访问性：newtab 候选文件夹搜索框缺少稳定可访问名称
  - 位置：`src/newtab/newtab.html` / `folder-candidate-search`
  - 影响：搜索框主要依赖 placeholder，辅助技术不一定稳定识别其用途，也没有显式声明控制候选列表。
  - 建议：为搜索框添加稳定 `aria-label`，并通过 `aria-controls` 关联候选文件夹列表。
  - 处理：已完成，候选文件夹搜索框现在暴露 `aria-label="搜索候选文件夹"` 和 `aria-controls="folder-candidate-list"`。

- [低] UI/可访问性：newtab 主搜索输入缺少 combobox 角色
  - 位置：`src/newtab/newtab.ts` / `createSearchWidget`
  - 影响：主搜索输入已经控制书签建议 listbox，但缺少 `role="combobox"`，辅助技术可能无法稳定识别“输入框 + 建议列表”的组合控件。
  - 建议：为主搜索输入添加 `role="combobox"`，保留现有 `aria-autocomplete`、`aria-controls`、`aria-expanded` 和 `aria-activedescendant` 管理。
  - 处理：已完成，主搜索输入现在暴露 combobox 语义并继续关联 `newtab-search-suggestions`。

- [低] UI/可访问性：newtab 搜索引擎菜单缺少菜单键盘导航
  - 位置：`src/newtab/newtab.ts` / `createSearchWidget`
  - 影响：搜索引擎切换菜单已有 menu/menuitemradio 语义，但打开后焦点未进入菜单项，也缺少方向键、Home/End、Escape 行为，键盘用户切换搜索引擎不够顺手。
  - 建议：打开菜单时聚焦当前或首尾菜单项；菜单内补齐 ArrowUp/ArrowDown/Home/End 移动焦点和 Escape 关闭并回焦触发按钮。
  - 处理：已完成，搜索引擎菜单支持方向键打开、菜单项焦点循环、Home/End 跳转和 Escape 回焦。

- [低] UI/可访问性：newtab 候选文件夹 listbox 缺少方向键导航
  - 位置：`src/newtab/newtab.ts` / `bindFolderSettingsEvents`、`createFolderCandidateControls`
  - 影响：候选文件夹列表已有 listbox/option 语义，但键盘用户需要按 Tab 逐个进入候选项，筛选后或选择后也缺少稳定的当前选项焦点。
  - 建议：为搜索框和候选列表补齐 ArrowUp/ArrowDown/Home/End/Escape；候选项使用 roving `tabIndex`，选择后保留滚动并回焦当前候选项。
  - 处理：已完成，候选文件夹列表支持方向键进入、循环移动、Home/End 跳转、Escape 回到搜索框，并在选择后恢复当前候选项焦点。

- [中] 体验：newtab 首次默认来源不适合“书签栏只有子文件夹”的真实书签结构
  - 位置：`src/newtab/folder-settings.ts`
  - 影响：用户明明有书签，但 newtab 首次打开可能显示空内容。
  - 建议：没有显式选择时聚合书签栏子文件夹，保证首次可见内容。
  - 处理：已完成，默认来源会聚合书签栏子文件夹并保留显式空选择语义。

- [低] 体验：newtab 搜索无匹配时反馈不足
  - 位置：`src/newtab/newtab.ts`
  - 影响：用户不知道 Enter 会执行网页搜索，匹配书签时快捷键语义也不明显。
  - 建议：有书签匹配时提示 Enter/Cmd 或 Ctrl+Enter 行为；无匹配时提供网页搜索 fallback。
  - 处理：已完成，新增搜索提示和无匹配网页搜索按钮。

## 三、性能审查结果

1. 首屏图标资源过大
   - 问题位置：`src/popup/popup.html`、`src/options/options.html`
   - 问题描述：扩展 UI 品牌图使用过大图标，资源体积与实际显示尺寸不匹配。
   - 影响范围：popup 打开、options 初次加载。
   - 严重程度：中
   - 推荐优化方向：换用小尺寸图标资源。
   - 是否需要 benchmark 或 profile 验证：低风险资源替换，构建产物和静态测试足够；可在 Chrome Performance 中进一步看首屏资源。
   - 处理状态：已修复。

2. newtab 书签变更全量刷新过于频繁
   - 问题位置：`src/newtab/newtab.ts` / `handleBookmarksChanged`
   - 问题描述：连续书签变更直接触发全量刷新，可能导致重复 DOM 更新和索引重建。
   - 影响范围：书签拖拽、移动、同步、批量整理。
   - 严重程度：中
   - 推荐优化方向：debounce/coalesce 刷新，避免并发 refresh。
   - 是否需要 benchmark 或 profile 验证：建议用大量书签和批量移动场景 profile。
   - 处理状态：已修复。

3. AI 快照索引更新放大
   - 问题位置：`src/options/options.ts`
   - 问题描述：单条快照保存触发全量全文 search map 重建。
   - 影响范围：大量网页快照、智能分析、Dashboard 搜索。
   - 严重程度：中
   - 推荐优化方向：按 bookmark id 增量更新 search text entry。
   - 是否需要 benchmark 或 profile 验证：建议用 1000+ 快照 profile；当前已有回归测试覆盖。
   - 处理状态：已修复。

4. newtab 首屏预加载搜索重 chunk
   - 问题位置：`src/newtab/content-state.ts`、`src/newtab/newtab.ts`
   - 问题描述：newtab 为搜索建议静态依赖 popup 搜索索引和自然语言搜索，导致 Vite 在 `dist/src/newtab/newtab.html` 中注入 `search-*`、`natural-search-*`、`content-snapshots-*` 等 `modulepreload`。
   - 影响范围：每次打开 newtab 的首屏加载，即使用户没有使用搜索。
   - 严重程度：中
   - 推荐优化方向：拆分轻量本地索引和重搜索能力；标题、URL、文件夹、标签、摘要等轻量匹配保持同步，pinyin/自然语言/复杂 popup 搜索通过动态 import 按需加载。
   - 是否需要 benchmark 或 profile 验证：建议后续用 Chrome Performance/Network 对真实书签规模做冷启动对比；当前已用构建产物和 Playwright 网络请求确认首屏不再加载搜索重 chunk。
   - 处理状态：已修复。

5. popup 默认打开预加载自然语言搜索 chunk
   - 问题位置：`src/popup/popup.ts`
   - 问题描述：popup 默认 `naturalSearchEnabled` 为 false，但运行时静态导入 `./natural-search.js`，导致 Vite 在 `dist/src/popup/popup.html` 注入 `natural-search-*` modulepreload。
   - 影响范围：每次打开 popup，即使用户只使用普通关键词搜索。
   - 严重程度：低
   - 推荐优化方向：将自然语言计划构建、日期过滤、结果合并和 AI plan 归一化改为语义搜索触发后的动态 import；保留状态标签所需的轻量本地格式化。
   - 是否需要 benchmark 或 profile 验证：当前通过构建产物和 Playwright 网络请求验证；后续可用 Chrome Performance 对真实书签规模做冷启动对比。
   - 处理状态：已修复。

6. popup 默认打开预加载智能分类专用 AI chunk
   - 问题位置：`src/popup/popup.ts`
   - 问题描述：popup 静态依赖 AI 设置归一化和网页内容抽取模块，导致默认 HTML 预加载 `content-extraction-*`、`ai-settings-*`，但这些能力只在智能分类路径使用。
   - 影响范围：每次打开 popup，即使用户只做普通书签搜索、筛选、移动、编辑。
   - 严重程度：低
   - 推荐优化方向：将 `content-extraction` 和 `ai-settings` 模块改为智能分类触发后动态 import；在 popup 内保留极小的默认超时和 Jina Reader origin 常量，避免仅为常量拉起大模块。
   - 是否需要 benchmark 或 profile 验证：当前通过构建产物验证；后续可用 Chrome Performance 对 popup 冷启动做实测。
   - 处理状态：已修复。

7. popup 默认打开预加载低频 Inbox/AI 响应 helper
   - 问题位置：`src/popup/popup.ts`、`src/shared/inbox.ts`
   - 问题描述：popup 为显示固定 Inbox 筛选标题静态导入完整 Inbox 模块，同时静态导入仅在 AI 响应解析时使用的 helper，导致默认 HTML 继续预加载 `inbox-*` 和 `ai-response-*`。
   - 影响范围：每次打开 popup，即使用户只查看、搜索或管理本地书签。
   - 严重程度：低
   - 推荐优化方向：将 Inbox 标题常量提升到轻量 `shared/constants`；AI 响应 helper 通过缓存动态 import 在实际 AI 请求路径加载。
   - 是否需要 benchmark 或 profile 验证：当前通过构建产物和 focused tests 验证；后续可用 Chrome Performance 对 popup 冷启动做实测。
   - 处理状态：已修复。

8. popup 默认打开预加载回收站 helper
   - 问题位置：`src/popup/popup.ts`
   - 问题描述：删除书签和撤销删除才需要回收站事务模块，但 popup 静态导入会让默认 HTML 预加载 `recycle-bin-*`。
   - 影响范围：每次打开 popup，即使用户只浏览、搜索或打开书签。
   - 严重程度：低
   - 推荐优化方向：保留原有删除事务语义，将 `deleteBookmarkToRecycle` 和 `removeRecycleEntry` 改为删除动作触发后通过缓存动态 import 加载。
   - 是否需要 benchmark 或 profile 验证：当前通过构建产物和 focused tests 验证；后续可用 Chrome Performance 对 popup 冷启动做实测。
   - 处理状态：已修复。

9. popup 默认打开预加载完整内容快照存储模块
   - 问题位置：`src/popup/search.ts`、`src/popup/search-index.ts`、`src/shared/content-snapshots.ts`
   - 问题描述：popup 首屏需要内容快照的轻量搜索文本和索引元数据，但完整 `content-snapshots` 模块还包含 IndexedDB 全文读写、快照保存、删除和测试 hook，普通打开不需要这些能力。
   - 影响范围：每次打开 popup 和普通本地搜索。
   - 严重程度：低
   - 推荐优化方向：新增轻量 `content-snapshot-search` 模块承载类型、normalizer 和 search text formatter；完整 `content-snapshots` 仅在全文 warmup、options 或 service worker 保存/删除路径使用。
   - 是否需要 benchmark 或 profile 验证：当前通过构建产物、focused tests 和 `npm run validate` 验证；后续可用 Chrome Performance 对 popup 冷启动做实测。
   - 处理状态：已修复。

10. 自动分析失败后可能安排无意义队列唤醒
   - 问题位置：`src/service-worker/service-worker.ts` / `markAutoAnalyzeQueueEntryFailed`
   - 问题描述：失败重试写回队列后，旧实现始终调用 `scheduleAutoAnalyzeQueueAlarm(AUTO_ANALYZE_QUEUE_RETRY_MS)`，没有考虑失败条目可能已达到最大次数被移除，也没有按剩余队列中最早 `nextRunAt` 调度。
   - 影响范围：自动书签分析失败或临时网络/AI 错误场景。
   - 严重程度：低
   - 推荐优化方向：复用 `scheduleNextAutoAnalyzeQueueWake`，用更新后的队列决定是否清除闹钟或安排准确的下一次唤醒。
   - 是否需要 benchmark 或 profile 验证：无需 benchmark；已用 focused test 和全量验证覆盖。
   - 处理状态：已修复。

## 四、UI 审查结果

1. dashboard overlay 加载失败无出口
   - 页面/组件位置：newtab dashboard overlay
   - 现象描述：iframe 加载失败或超时时，用户缺少明确返回或重试路径。
   - 对用户的影响：可能误以为扩展卡死。
   - 严重程度：中
   - 推荐改进方案：添加关闭按钮、超时 fallback、重试与返回按钮。
   - 处理状态：已修复。

2. Dashboard “书签栏”口径不一致
   - 页面/组件位置：options dashboard
   - 现象描述：默认文案和实际来源聚合逻辑不完全一致。
   - 对用户的影响：用户难以理解当前看到的是书签栏还是全部书签。
   - 严重程度：低
   - 推荐改进方案：统一默认 copy 和统计口径。
   - 处理状态：已修复。

3. 隐藏标签 `+N` 可交互性不足
   - 页面/组件位置：options dashboard 标签展示
   - 现象描述：隐藏标签缺少完整 click/keyboard 展开关闭路径。
   - 对用户的影响：键盘用户和辅助技术用户难以查看全部标签。
   - 严重程度：中
   - 推荐改进方案：支持 click、Enter、Space、Escape。
   - 处理状态：已修复。

4. popup 模态背景未 inert
   - 页面/组件位置：popup modal
   - 现象描述：模态打开时背景 app shell 没有完整不可交互语义。
   - 对用户的影响：焦点和辅助技术上下文可能穿透。
   - 严重程度：中
   - 推荐改进方案：模态打开时背景设置 `inert` 和 `aria-hidden`。
   - 处理状态：已修复。

5. popup 独立窄视口存在横向溢出
   - 页面/组件位置：popup 根布局
   - 现象描述：390px 窄视口运行时检查发现 popup 根宽仍固定 430px，产生 40px 横向溢出。
   - 对用户的影响：在独立页面、窄屏调试或非标准容器中出现裁切和横向滚动。
   - 严重程度：低
   - 推荐改进方案：保留扩展 popup 的 430px 理想宽度，但允许根宽收缩到 `100vw`。
   - 处理状态：已修复，`html, body` 使用 `width: min(430px, 100vw)`，并新增回归测试。

6. popup 书签操作菜单按钮可访问名称重复
   - 页面/组件位置：popup 书签树与搜索结果操作菜单
   - 现象描述：每条书签的菜单按钮都暴露相同 `aria-label="打开操作菜单"`。
   - 对用户的影响：辅助技术用户无法仅凭按钮名称判断菜单属于哪条书签。
   - 严重程度：低
   - 推荐改进方案：把书签标题纳入菜单按钮可访问名称，并对标题做长度限制和属性转义。
   - 处理状态：已修复。

7. popup 书签操作菜单缺少触发按钮方向键入口和关闭回焦
   - 页面/组件位置：popup 书签树与搜索结果操作菜单
   - 现象描述：菜单项支持方向键移动，但触发按钮不能通过 ArrowDown/ArrowUp 直接进入菜单，Escape 关闭后也没有明确恢复到触发按钮。
   - 对用户的影响：键盘用户在连续处理书签时，需要额外 Tab 定位菜单项，关闭菜单后容易丢失当前书签上下文。
   - 严重程度：低
   - 推荐改进方案：抽出统一打开函数；触发按钮支持 ArrowDown/ArrowUp 打开并聚焦首尾项；Escape 或再次点击关闭时回焦到对应触发按钮。
   - 处理状态：已修复。

8. popup 筛选文件夹 listbox 缺少方向键导航
   - 页面/组件位置：popup 筛选文件夹弹窗
   - 现象描述：筛选文件夹结果列表声明为 listbox/option，但选项缺少 roving focus 和方向键/Home/End/Escape 行为。
   - 对用户的影响：键盘用户筛选文件夹时需要连续 Tab 才能浏览候选项，筛选后当前候选项上下文不稳定。
   - 严重程度：低
   - 推荐改进方案：搜索框支持方向键进入首尾候选项；列表支持方向键循环、Home/End 跳转、Escape 回到搜索框。
   - 处理状态：已修复。

9. options 范围筛选文件夹 listbox 缺少方向键导航
   - 页面/组件位置：options 可用性检测/历史记录/书签智能分析范围筛选弹窗
   - 现象描述：范围筛选结果列表声明为 listbox/option，但选项缺少 roving focus 和方向键/Home/End/Escape 行为。
   - 对用户的影响：键盘用户切换检测或分析范围时，需要连续 Tab 浏览文件夹候选项；搜索后当前候选项上下文不稳定。
   - 严重程度：低
   - 推荐改进方案：搜索框支持方向键进入首尾候选项；列表支持方向键循环、Home/End 跳转、Escape 回到搜索框，并保留“全部书签”选项。
   - 处理状态：已修复。

10. options AI 模型 picker listbox 缺少方向键导航
   - 页面/组件位置：options AI 模型选择弹窗
   - 现象描述：AI 模型结果列表声明为 listbox/option，但模型卡片缺少 roving focus 和方向键/Home/End/Escape 行为。
   - 对用户的影响：键盘用户筛选或切换模型时，需要连续 Tab 浏览候选模型；搜索后当前候选模型上下文不稳定。
   - 严重程度：低
   - 推荐改进方案：搜索框支持方向键进入首尾候选模型；列表支持方向键循环、Home/End 跳转、Escape 回到搜索框。
   - 处理状态：已修复。

11. options 移动目标文件夹 picker 缺少 listbox 语义与方向键导航
   - 页面/组件位置：options 批量移动/Dashboard 单条移动目标文件夹弹窗
   - 现象描述：目标文件夹结果列表是视觉候选列表，但容器缺少 listbox 语义，候选按钮缺少 option 语义、roving focus 和方向键/Home/End/Escape 行为。
   - 对用户的影响：辅助技术用户难以识别当前区域是“选择目标文件夹”的候选列表；键盘用户需要连续 Tab 浏览目标文件夹。
   - 严重程度：低
   - 推荐改进方案：结果容器声明为 listbox，目标文件夹按钮声明为 option；搜索框支持方向键进入列表，列表内支持方向键循环、Home/End 跳转和 Escape 回搜索框。
   - 处理状态：已修复。

12. Dashboard 卡片动作按钮可访问名称重复
   - 页面/组件位置：options dashboard 书签卡片
   - 现象描述：每张卡片底部都重复显示“打开、复制、修改标签、移动、删除”等动作按钮，按钮名称本身没有书签标题上下文。
   - 对用户的影响：辅助技术用户按按钮维度浏览时，需要额外回读卡片内容才能确认操作对象，删除和移动类动作尤其容易误操作。
   - 严重程度：低
   - 推荐改进方案：为卡片动作按钮生成“动作 + 书签标题”的可访问名称，长标题截断，保留原有视觉文案。
   - 处理状态：已修复。

13. 回收站条目操作按钮可访问名称重复
   - 页面/组件位置：options 回收站条目列表
   - 现象描述：每条回收站记录都重复暴露“选择、恢复书签、清除”控件名称。
   - 对用户的影响：辅助技术用户在恢复或清除前需要额外回读条目内容确认对象，批量清理时更容易误操作。
   - 严重程度：低
   - 推荐改进方案：为选择、恢复、清除控件生成“动作 + 书签标题”的可访问名称，长标题截断。
   - 处理状态：已修复。

14. 重定向结果动作按钮可访问名称重复
   - 页面/组件位置：options 重定向结果列表
   - 现象描述：每条重定向结果都重复暴露“选择、更新为最终 URL、打开最终链接”控件名称。
   - 对用户的影响：辅助技术用户在批量更新或单条写入前需要额外回读条目内容确认对象，容易把重定向 URL 写到非预期书签。
   - 严重程度：低
   - 推荐改进方案：为选择、更新和打开最终链接控件生成“动作 + 书签标题”的可访问名称，长标题截断。
   - 处理状态：已修复。

15. 书签智能分析结果动作按钮可访问名称重复
   - 页面/组件位置：options 书签智能分析结果列表
   - 现象描述：每条 AI 建议都重复暴露“选择、打开页面、应用建议、移动至推荐文件夹”等控件名称。
   - 对用户的影响：辅助技术用户在批量应用或单条移动前需要额外回读条目内容确认对象，容易把建议应用到非预期书签。
   - 严重程度：低
   - 推荐改进方案：为选择、打开、应用和移动控件生成“动作 + 书签标题”的可访问名称，长标题截断。
   - 处理状态：已修复。

16. 重复书签逐条勾选可访问名称重复
   - 页面/组件位置：options 重复书签检测结果
   - 现象描述：每条重复副本都重复暴露“移入回收站”勾选项。
   - 对用户的影响：辅助技术用户逐条调整保留/移入回收站策略时，需要额外回读标题和路径确认对象。
   - 严重程度：低
   - 推荐改进方案：为勾选项生成包含书签标题和路径的可访问名称，长标题截断。
   - 处理状态：已修复。

17. 忽略规则删除按钮可访问名称重复
   - 页面/组件位置：options 忽略规则列表
   - 现象描述：书签、域名、文件夹三类规则里的删除按钮都重复暴露“删除规则”。
   - 对用户的影响：辅助技术用户在清理多条忽略规则时，需要额外回读卡片内容确认删除对象。
   - 严重程度：低
   - 推荐改进方案：为删除按钮生成“删除忽略规则 + 规则名称/路径/域名”的可访问名称，长文本截断。
   - 处理状态：已修复。

18. 文件夹清理建议动作按钮可访问名称重复
   - 页面/组件位置：options 文件夹清理建议列表
   - 现象描述：每张建议卡重复暴露“查看预览、确认删除/合并/拆分/移动”，拆分撤销卡也只暴露“撤销本次拆分”。
   - 对用户的影响：辅助技术用户在执行破坏性清理或撤销拆分前，需要额外回读卡片内容确认对象。
   - 严重程度：低
   - 推荐改进方案：为预览、执行和撤销按钮生成“动作 + 建议标题/拆分数量”的可访问名称，长文本截断。
   - 处理状态：已修复。

19. 可用性检测结果卡动作按钮可访问名称重复
   - 页面/组件位置：options 可用性检测异常结果列表
   - 现象描述：低置信和高置信异常卡片里重复暴露“选择、打开链接、移入高置信异常、移回低置信异常”。
   - 对用户的影响：辅助技术用户在批量选择、打开确认或调整置信分区时，需要额外回读卡片内容确认对象。
   - 严重程度：低
   - 推荐改进方案：为选择、打开和置信分区移动控件生成“动作 + 书签标题 + 路径”的可访问名称，长文本截断。
   - 处理状态：已修复。

20. newtab 候选文件夹搜索框可访问名称不稳定
   - 页面/组件位置：newtab 设置抽屉 / 文件夹来源候选列表
   - 现象描述：候选文件夹搜索框只通过 placeholder 提示用途，没有稳定 `aria-label`，也没有显式关联候选列表。
   - 对用户的影响：辅助技术用户进入文件夹来源选择时，可能难以判断该输入框的作用和结果列表关系。
   - 严重程度：低
   - 推荐改进方案：为输入框添加稳定名称，并用 `aria-controls` 指向 `folder-candidate-list`。
   - 处理状态：已修复。

21. newtab 主搜索输入缺少 combobox 角色
   - 页面/组件位置：newtab 主搜索框
   - 现象描述：搜索输入已有自动补全和候选列表状态，但没有显式 `role="combobox"`。
   - 对用户的影响：辅助技术可能只把它当作普通搜索输入，无法稳定感知候选列表语义。
   - 严重程度：低
   - 推荐改进方案：补充 combobox 角色，并静态约束它继续控制 `newtab-search-suggestions` listbox。
   - 处理状态：已修复。

22. newtab 搜索引擎菜单缺少完整键盘导航
   - 页面/组件位置：newtab 主搜索框 / 搜索引擎切换菜单
   - 现象描述：菜单已有 `role="menu"` 和 `menuitemradio`，但打开后不会把焦点送入菜单项，也没有方向键、Home/End 和 Escape 的菜单行为。
   - 对用户的影响：键盘用户需要额外 Tab 才能进入菜单，切换搜索引擎的路径不符合常见菜单控件预期。
   - 严重程度：低
   - 推荐改进方案：触发按钮支持 ArrowDown/ArrowUp 打开菜单并聚焦首尾项；菜单内支持 ArrowUp/ArrowDown/Home/End 移动焦点，Escape 关闭并回焦按钮。
   - 处理状态：已修复。

23. newtab 候选文件夹 listbox 缺少方向键导航
   - 页面/组件位置：newtab 设置抽屉 / 文件夹来源候选列表
   - 现象描述：候选文件夹列表声明为多选 listbox，但选项缺少 roving focus 和方向键/Home/End/Escape 行为。
   - 对用户的影响：键盘用户筛选和选择来源文件夹时，需要在多个候选项之间连续 Tab，选择后也可能丢失当前候选项上下文。
   - 严重程度：低
   - 推荐改进方案：搜索框支持方向键进入首尾候选项；候选列表支持方向键循环、Home/End 跳转、Escape 回到搜索框，并在选择后回焦当前候选项。
   - 处理状态：已修复。

## 五、功能审查结果

1. 标签索引写入并发覆盖
   - 文件路径 + 相关逻辑：`src/shared/bookmark-tags.ts` / 标签保存、清理、删除
   - 问题描述：不同标签写路径如果直接读改写，可能覆盖彼此字段。
   - 复现路径或触发条件：AI 标签保存和手动标签编辑同时发生。
   - 可能后果：丢失手动标签、AI 标签或索引记录。
   - 严重程度：高
   - 推荐修复方向：统一使用串行更新函数，基于当前最新索引生成 next state。
   - 处理状态：已修复。

2. 导航成功误判
   - 文件路径 + 相关逻辑：`src/options/sections/classifier.ts` / `shouldAcceptNavigationSuccess`
   - 问题描述：缺少 main request/status 证据时仍可能接受 available。
   - 复现路径或触发条件：导航层报告成功但网络证据缺失或失败。
   - 可能后果：坏链被误标为可用。
   - 严重程度：高
   - 推荐修复方向：要求 `requestSent` 和真实 2xx/3xx HTTP status。
   - 处理状态：已修复。

3. 恢复/编辑场景触发不必要自动分析
   - 文件路径 + 相关逻辑：popup/newtab 添加与分析状态链路
   - 问题描述：恢复或局部编辑路径需要避免误触发不相关分析反馈。
   - 复现路径或触发条件：恢复书签、快照-only 完成、popup 自动分析状态。
   - 可能后果：用户看到与当前操作不匹配的状态提示。
   - 严重程度：中
   - 推荐修复方向：保留 snapshot-only 静默完成和底部状态语义。
   - 处理状态：现有回归测试通过，未在本轮发现新异常。

## 六、人性化体验审查结果

1. newtab 首次来源选择不够自适应
   - 用户场景：用户书签栏只有分类文件夹，没有直属书签。
   - 当前体验问题：默认来源可能看起来为空。
   - 为什么会造成困扰：用户认为扩展没有读取到自己的书签。
   - 推荐改进方式：默认聚合可显示的书签栏子文件夹；显式空选择仍保留。
   - 优先级：P1
   - 处理状态：已修复。

2. newtab 来源候选缺少“直属/合计”说明
   - 用户场景：用户选择新标签页来源文件夹。
   - 当前体验问题：只显示单一数量，无法判断子文件夹是否计入。
   - 为什么会造成困扰：用户可能误选空父文件夹或误解展示范围。
   - 推荐改进方式：显示“直属 N / 合计 M”。
   - 优先级：P2
   - 处理状态：已修复。

3. 搜索无匹配时缺少可行动反馈
   - 用户场景：用户在 newtab 输入关键词但没有本地书签匹配。
   - 当前体验问题：不知道下一步是调整关键词还是网页搜索。
   - 为什么会造成困扰：搜索体验像“断路”。
   - 推荐改进方式：无匹配时显示网页搜索 fallback；有匹配时明确快捷键。
   - 优先级：P2
   - 处理状态：已修复。

4. Dashboard iframe 失败状态缺少恢复动作
   - 用户场景：用户从 newtab 打开视觉化管理。
   - 当前体验问题：加载超时或失败时缺少可行动错误状态。
   - 为什么会造成困扰：用户无法判断是否应等待、返回还是重试。
   - 推荐改进方式：提供返回和重试动作。
   - 优先级：P1
   - 处理状态：已修复。

## 七、子任务拆分与集成记录

- `agent/goal-final-build-security` / `fbb6f0f`
  - 实现思路：通过 package overrides 修复 CRX/Vite 依赖链 audit 风险。
  - 影响范围：`package.json`、`package-lock.json`
  - 测试方式：`npm audit --json`、`npm run validate`

- `agent/goal-final-functional-core` / `5ceba09`
  - 实现思路：标签索引写入串行化，导航成功接受条件收紧。
  - 影响范围：`src/shared/bookmark-tags.ts`、`src/options/sections/classifier.ts`
  - 测试方式：`npm test`、`npm run typecheck`

- `agent/goal-final-performance-polish` / `7961377`
  - 实现思路：替换首屏大图标，合并 newtab 书签刷新，增量更新快照搜索索引。
  - 影响范围：popup/options/newtab/options 快照路径。
  - 测试方式：`npm test`、`npm run typecheck`

- `agent/goal-final-newtab-experience` / `1452a65`
  - 实现思路：优化 newtab 首次来源、来源统计和搜索 fallback。
  - 影响范围：`src/newtab/folder-settings.ts`、`src/newtab/newtab.ts`
  - 测试方式：focused tests、`npm test`、`npm run typecheck`

- `agent/goal-final-ui-a11y` / `2f27854`
  - 实现思路：dashboard overlay 失败兜底、popup modal inert、Dashboard 标签键盘交互。
  - 影响范围：newtab/options/popup UI 与可访问性。
  - 测试方式：`npm test`、`npm run typecheck`

- 集成分支补充优化 / `5a8589c`、`32d636d`、`323898b`、`4699fb9`、`d88164f`、`0e7bd5c`、`b185052`、`87f4f3c`、`d4cb535`、`e33821c`、`71770a7`、`3e1e935`、`77b58d9`、`f43c79b`、`53c771d`、`66bbf0d`、`c634fcb`、`1ac5063`、`15fc795`、`a83c2a8`、`33b2a3a`、`0903ab3`、`500624a`、`a9cbde5`、`77ac5c6`、`3cf2451`、`1a48e09`、`a21eac8`、本提交
  - 实现思路：修复 popup 窄视口横向溢出；将 newtab 搜索重 chunk 改为按需加载，并保留轻量同步建议；将 newtab 标签索引读取改为轻量 storage normalizer；内联 newtab loading SVG 和关闭动效 helper；将回收站删除/撤销模块改为按需加载；将启动读书签树改为本页轻量 wrapper，书签移动、编辑、新建、撤销恢复等写操作通过 `bookmarks-api` 动态加载；将 popup 自然语言搜索、智能分类网页内容抽取、AI 设置归一化、AI 响应解析、Inbox 状态模块、回收站事务 helper 和完整内容快照存储模块改为触发对应功能后再加载或通过轻量常量/搜索入口解耦；自动分析失败后按剩余队列重新计算下一次唤醒，移除首屏和后台队列的非必要运行成本；popup 书签树和搜索结果的操作菜单按钮使用书签标题生成可访问名称；popup 书签操作菜单支持触发按钮方向键入口和关闭回焦；popup 筛选文件夹 listbox 补齐 roving focus 和方向键导航；options 范围筛选文件夹 listbox 补齐 roving focus 和方向键导航；options AI 模型 picker listbox 补齐 roving focus 和方向键导航；options 移动目标文件夹 picker 补齐 listbox/option 语义与方向键导航；Dashboard 卡片打开、复制、改标签、移动、删除动作加入书签标题上下文；回收站选择、恢复和清除控件加入书签标题上下文；重定向结果选择、更新和打开最终链接控件加入书签标题上下文；书签智能分析结果的选择、打开、应用和移动控件加入书签标题上下文；重复书签逐条移入回收站勾选项加入标题和路径上下文；忽略规则删除按钮加入规则名称、路径或域名上下文；文件夹清理预览、执行和拆分撤销按钮加入建议标题和移动数量上下文；可用性检测结果选择、打开和置信分区移动控件加入书签标题与路径上下文；newtab 候选文件夹搜索框加入稳定名称和候选列表关联；newtab 主搜索输入补充 combobox 语义；newtab 搜索引擎菜单补齐键盘焦点与方向键导航；newtab 候选文件夹 listbox 补齐 roving focus 和方向键导航，避免重复或无上下文控件名称。
  - 影响范围：`src/popup/popup.css`、`src/popup/popup.ts`、`src/newtab/content-state.ts`、`src/newtab/newtab.ts`、`src/newtab/newtab.html`、`src/options/options.ts`、`src/options/sections/dashboard.ts`、`src/options/sections/recycle.ts`、`src/options/sections/redirects.ts`、`src/options/sections/duplicates.ts`、`src/options/sections/ignore.ts`、`src/options/sections/folder-cleanup.ts`、相关测试。
  - 测试方式：focused tests、`npm test`、`npm run validate`、Playwright 产物/搜索冒烟。

- 集成分支合并提交：
  - `a4f74ba` merge build-security
  - `ca10295` merge functional-core
  - `fa40369` merge performance-polish
  - `db755dd` merge newtab-experience
  - `2408ac4` merge ui-a11y

## 八、验证记录

- `npm audit --json`：0 vulnerabilities。
- `npm run typecheck`：通过。
- `npm run lint`：通过；当前脚本等价于 `npm run typecheck`。
- `npm test`：334/334 通过。
- `npm run check:version`：通过，版本 `1.4.23`。
- `npm run build`：通过。
- `npm run validate`：通过，覆盖 typecheck、test、check:version、build。
- focused popup 自然语言搜索测试：通过。
  - `npm run test:build && node --test .tmp-test/tests/popup-search-empty-state.test.js .tmp-test/tests/popup-search-index.test.js .tmp-test/tests/content-snapshots.test.js .tmp-test/tests/popup-search.test.js`：39/39 通过。
  - 覆盖自然语言搜索动态 import 缓存、禁止 popup 运行时静态导入 `natural-search`/`shared/inbox`/`ai-response`/`recycle-bin`/完整 `content-snapshots`、AI plan 缓存降级、失效 AI plan 对应结果缓存清理、智能分类模块按需加载、删除事务 helper 按需加载、内容快照全文 warmup 按需加载、构建产物不预加载 `natural-search`/`content-extraction`/`ai-settings`/`inbox`/`ai-response`/`recycle-bin`/完整 `content-snapshots`、普通搜索行为。
- focused newtab 搜索测试：通过。
  - `node --test .tmp-test/tests/newtab-search-index.test.js .tmp-test/tests/newtab-content-state.test.js`：55/55 通过。
  - 覆盖轻量同步建议缓存、自然语言搜索动态 import、pinyin 动态搜索、无匹配网页搜索 fallback、候选文件夹搜索框稳定可访问名称、候选文件夹 listbox 键盘导航、主搜索 combobox 语义和搜索引擎菜单键盘导航。
- focused service worker 队列测试：通过。
  - `npm run test:build && node --test .tmp-test/tests/service-worker-save-guards.test.js .tmp-test/tests/ai-settings.test.js`：9/9 通过。
  - 覆盖自动分析队列复用树快照、失败后按剩余队列状态重新安排唤醒、AI 设置序列化。
- focused popup 可访问性测试：通过。
  - `npm run test:build && node --test .tmp-test/tests/popup-search-layout.test.js .tmp-test/tests/popup-search-empty-state.test.js`：23/23 通过。
  - 覆盖 popup 书签操作菜单按钮的书签特定可访问名称、菜单触发按钮方向键入口与关闭回焦、筛选文件夹 listbox 键盘导航、模态 inert、搜索/模态焦点和空状态。
- focused Dashboard 可访问性测试：通过。
  - `npm run test:build && node --test .tmp-test/tests/dashboard-selection-a11y.test.js .tmp-test/tests/options-management-ui.test.js`：36/36 通过。
  - 覆盖 Dashboard 选择框、隐藏标签弹层、文件夹筛选 listbox，以及卡片动作按钮的书签特定可访问名称。
- focused options 范围筛选可访问性测试：通过。
  - `npm run test:build && node --test .tmp-test/tests/options-management-ui.test.js`：31/31 通过。
  - 覆盖 options 范围筛选文件夹 listbox 的方向键入口、roving `tabIndex` 和 Escape 回搜索框。
- focused AI 模型 picker 可访问性测试：通过。
  - `npm run test:build && node --test .tmp-test/tests/options-management-ui.test.js`：32/32 通过。
  - 覆盖 AI 模型 picker listbox 的方向键入口、roving `tabIndex` 和 Escape 回搜索框。
- focused 移动目标文件夹 picker 可访问性测试：通过。
  - `npm run test:build && node --test .tmp-test/tests/options-management-ui.test.js`：33/33 通过。
  - 覆盖移动目标文件夹 picker 的 listbox/option 语义、方向键入口、roving `tabIndex` 和 Escape 回搜索框。
- focused 回收站可访问性测试：通过。
  - `npm run test:build && node --test .tmp-test/tests/recycle.test.js .tmp-test/tests/options-management-ui.test.js`：35/35 通过。
  - 覆盖回收站条目选择、恢复和清除控件的书签特定可访问名称，以及回收站存储序列化和回滚路径。
- focused options 管理 UI 测试：通过。
  - `npm run test:build && node --test .tmp-test/tests/options-management-ui.test.js`：31/31 通过。
  - 覆盖可用性检测结果选择/打开/置信分区移动控件、重定向结果选择/更新/打开最终链接控件、书签智能分析结果选择/打开/应用/移动控件、重复书签逐条移入回收站勾选项的书签特定可访问名称，以及现有 Dashboard、可用性检测和导航 UI 静态约束。
- focused 忽略规则可访问性测试：通过。
  - `npm run test:build && node --test .tmp-test/tests/ignore.test.js`：4/4 通过。
  - 覆盖忽略规则删除按钮的规则特定可访问名称，以及书签、文件夹、域名三类规则上下文和长文本截断。
- focused 文件夹清理可访问性测试：通过。
  - `npm run test:build && node --test .tmp-test/tests/folder-cleanup.test.js`：8/8 通过。
  - 覆盖文件夹清理建议预览、执行和拆分撤销按钮的建议特定可访问名称，以及长文本截断和撤销移动数量上下文。
- Playwright 扩展冒烟：通过。
  - 实际加载 `dist` 扩展。
  - newtab：`#newtab-root` 可见，无 pageerror/console error。
  - options dashboard：`#dashboard` 可见，无 pageerror/console error。
  - popup：`#popup-app-shell` 可见，无 pageerror/console error。
- Playwright 关键交互验证：通过。
  - newtab 搜索无本地匹配时显示“未找到书签，按 Enter 用 Google 搜索”fallback。
  - newtab dashboard overlay 可打开并关闭，`aria-hidden` 和 `hidden` 状态同步。
  - popup 筛选模态打开时 `#popup-app-shell` 设置 `inert` 和 `aria-hidden="true"`，关闭后恢复。
- dist 产物引用完整性：通过。
  - `manifest.json` 中 action、newtab、background、icons 引用均存在。
  - `newtab.html`、`options.html`、`popup.html` 共 21 个本地 `src`/`href` 资源引用均存在。
- Playwright 跨视口检查：通过。
  - 1280x900 和 390x844 下，newtab、options dashboard、popup 根节点均可见。
  - 修复后 popup 在 390px 窄视口下 `scrollWidth === clientWidth`，无横向溢出。
- Playwright newtab 搜索加载策略检查：通过。
  - fresh profile 打开 newtab 无 pageerror/console error。
  - 普通关键词命中本地书签时，搜索建议可见，且仅加载 `newtab` 主 chunk、`modulepreload-polyfill`、`storage`、CSS 和 favicon，未加载 `bookmarks-api-*`、`dot-matrix-loader-*`、`motion-*`、`recycle-bin-*`、`bookmark-tags-*`、`search-*`、`natural-search-*`、`content-snapshots-*`。
  - 无本地匹配时网页搜索 fallback 可见，无 pageerror/console error。
- dist modulepreload 检查：通过。
  - `dist/src/newtab/newtab.html` 只预加载 Vite 运行时 `modulepreload-polyfill-*` 和启动存储读取所需的 `storage-*`。
  - 未发现 newtab 首屏 `modulepreload` 预加载 `bookmarks-api-*`、`dot-matrix-loader-*`、`motion-*`、`recycle-bin-*`、`bookmark-tags-*`、`search-*`、`natural-search-*` 或 `content-snapshots-*`。
  - `dist/src/popup/popup.html` 未发现 `natural-search-*`、`content-extraction-*`、`ai-settings-*`、`inbox-*`、`ai-response-*`、`recycle-bin-*`、完整 `content-snapshots-*` modulepreload；普通搜索需要的轻量 `content-snapshot-search-*` 保留在首屏。
- Playwright popup 自然语言搜索加载策略检查：通过。
  - fresh profile 打开 popup，`#popup-app-shell` 可见，无 pageerror/console error。
  - 默认打开仅加载 popup 正常功能所需资源，实际请求列表未出现 `natural-search-*`、`content-extraction-*`、`ai-settings-*`、`inbox-*`、`ai-response-*`、`recycle-bin-*`、完整 `content-snapshots-*`。
- Playwright 可访问名称检查：通过。
  - newtab、options dashboard、popup 中可见交互控件均有可访问名称。
  - 未发现可见的无名 `button`、`a[href]`、`input`、`select`、`textarea` 或 `role="button"` 控件。
- 安全静态审查：通过。
  - 构建后的 newtab/options/popup HTML 未发现 `http(s)` 外部 `src`/`href` 资源引用。
  - 未发现 `eval`、`new Function`、`document.write`、`srcdoc` 等高风险动态执行模式。
  - 对动态 `innerHTML` 的插值点进行了抽样审查，未发现未转义用户内容直接注入的新问题。

## 九、优化了哪些项目

- 构建依赖 audit 风险清零。
- popup/options 首屏图标资源减重。
- newtab 大列表书签变更刷新合并。
- AI 快照 search map 单条增量更新。
- 标签索引写入串行化，降低并发丢字段风险。
- 导航成功判定收紧，降低坏链误判。
- newtab 首次默认来源更贴近真实书签结构。
- newtab 搜索无匹配时提供网页搜索 fallback。
- dashboard overlay 增加关闭、超时、失败、重试状态。
- dashboard 标签隐藏展开支持鼠标和键盘。
- popup 模态背景 inert，改善可访问性。
- popup 书签树和搜索结果的操作菜单按钮加入书签标题，避免重复可访问名称。
- popup 书签操作菜单支持 ArrowDown/ArrowUp 从触发按钮进入菜单，并在 Escape 或再次点击关闭后回到对应触发按钮。
- popup 筛选文件夹 listbox 支持方向键进入、循环移动、Home/End 跳转和 Escape 回搜索框，改善键盘筛选文件夹体验。
- options 范围筛选文件夹 listbox 支持方向键进入、循环移动、Home/End 跳转和 Escape 回搜索框，改善检测/历史/AI 分析范围切换体验。
- options AI 模型 picker listbox 支持方向键进入、循环移动、Home/End 跳转和 Escape 回搜索框，改善键盘筛选和切换模型体验。
- options 移动目标文件夹 picker 补充 listbox/option 语义，并支持方向键进入、循环移动、Home/End 跳转和 Escape 回搜索框，改善批量移动和单条移动目标选择体验。
- Dashboard 卡片动作按钮加入书签标题上下文，降低批量浏览和移动/删除时的误操作风险。
- 回收站条目选择、恢复、清除控件加入书签标题上下文，降低恢复或永久清除时的误操作风险。
- 重定向结果选择、更新、打开最终链接控件加入书签标题上下文，降低最终 URL 写入时的误操作风险。
- 书签智能分析结果选择、打开、应用、移动控件加入书签标题上下文，降低应用 AI 建议或移动书签时的误操作风险。
- 重复书签逐条移入回收站勾选项加入标题和路径上下文，降低逐条调整保留策略时的误操作风险。
- 忽略规则删除按钮加入规则名称、文件夹路径或域名上下文，降低清理多条忽略规则时的误删风险。
- 文件夹清理建议的预览、执行和拆分撤销按钮加入建议标题与移动数量上下文，降低执行清理或撤销拆分时的误操作风险。
- 可用性检测异常结果卡的选择、打开链接、移入高置信和移回低置信按钮加入书签标题与路径上下文，降低批量处理坏链时的误操作风险。
- newtab 候选文件夹搜索框加入稳定可访问名称并关联候选列表，改善文件夹来源设置的辅助技术体验。
- newtab 主搜索输入补充 combobox 语义，让书签建议 listbox 更容易被辅助技术识别。
- newtab 搜索引擎菜单支持方向键打开、菜单项焦点循环、Home/End 跳转和 Escape 回焦，改善键盘切换搜索引擎体验。
- newtab 候选文件夹 listbox 支持方向键进入、循环移动、Home/End 跳转、Escape 回搜索框和选择后回焦，改善键盘选择来源文件夹体验。
- popup 根布局支持窄视口收缩，避免独立页面或窄屏容器横向溢出。
- newtab 搜索保留轻量同步建议，将 pinyin、自然语言、复杂 popup 搜索 chunk 改为按需加载，降低普通打开新标签页和普通关键词搜索的初始资源成本。
- newtab 标签索引读取改为本页轻量 normalizer，避免仅为读取标签数据而首屏加载完整 `bookmark-tags` 模块。
- newtab loading SVG、关闭动效和回收站操作拆离首屏依赖，避免普通打开和普通搜索预加载 `dot-matrix-loader`、`motion`、`recycle-bin`。
- newtab 启动读书签树使用本页轻量 wrapper，书签写操作按需加载 `bookmarks-api`，避免普通打开和普通搜索预加载低频写操作模块。
- popup 自然语言搜索模块改为按需加载，避免用户只做普通搜索或默认打开 popup 时预加载 `natural-search`。
- popup AI plan 失效降级到本地解析时会同步清理旧自然语言搜索结果缓存，避免“本地解析”文案复用旧 AI 查询结果。
- popup 智能分类的网页内容抽取和 AI 设置归一化改为按需加载，避免默认打开 popup 时预加载 `content-extraction` 和 `ai-settings`。
- popup Inbox 筛选标题改走轻量常量入口，AI 响应 helper 改为请求触发后按需加载，避免默认打开 popup 时预加载 `inbox` 和 `ai-response`。
- popup 回收站事务 helper 改为删除/撤销删除触发后按需加载，避免默认打开 popup 时预加载 `recycle-bin`。
- popup 内容快照搜索拆出轻量入口，完整快照存储和 IndexedDB 全文读取模块改为全文 warmup 或保存/删除路径按需加载，避免默认打开 popup 时预加载完整 `content-snapshots`。
- 自动分析队列失败后按剩余队列重新计算下一次唤醒，避免失败条目已移除时仍固定创建重试闹钟。

## 十、创新了什么功能

- newtab 来源候选展示“直属 N / 合计 M”，让用户理解父文件夹和子文件夹展示范围。
- newtab 搜索同时支持本地书签优先和无匹配网页搜索 fallback。
- newtab 搜索采用分层加载：轻量建议即时响应，复杂语义/pinyin 能力在必要时再加载。
- newtab dashboard iframe 增加可恢复失败状态，用户可返回或重试。
- 首次使用时自动聚合书签栏子文件夹，减少用户手动配置成本。

## 十一、需要手动测试的重点

- Chrome 加载 `/mnt/g/coding/worktrees/goal-final-polish-20260504/dist` 后，打开 newtab，确认默认书签来源符合你的真实书签结构。
- newtab 搜索：
  - 有书签匹配时 Enter 打开书签。
  - Cmd/Ctrl+Enter 执行网页搜索。
  - 无书签匹配时网页搜索 fallback 可点击。
- newtab dashboard：
  - 打开、关闭、返回焦点。
  - 加载慢或失败时是否出现 fallback。
  - 重试和返回按钮是否符合预期。
- popup：
  - 搜索、筛选、移动、编辑、删除。
  - 模态打开时背景不可交互，关闭后恢复。
- options dashboard：
  - 标签 `+N` 展开、Escape 关闭。
  - 文件夹侧栏、搜索、批量选择、移动/删除。
- 可用性检测：
  - HTTP 失败页不应再被误判为 available。
  - 正常 2xx/3xx 页面仍应通过。

## 十二、完成审计

- 已在 `G:\coding\worktrees` 对应 WSL 路径 `/mnt/g/coding/worktrees` 下创建独立 worktree：满足。
- 已组织多 agent/多分支审查并提交：满足。
- 四个维度审查报告：满足，本报告覆盖性能、UI、功能、人性化体验。
- 按审查问题优化处理：满足，核心高/中风险问题已修复并测试。
- 每个 agent 独立 worktree 工作并提交：满足。
- 逐个合并 agent 分支并解决冲突：满足。
- 运行完整测试、lint、typecheck、build：满足。
- 不合并到 `main`：满足，主工作区仍在 `main@11582da`。
- 停止后汇报优化项、创新功能、手动测试重点：满足，本报告第九至十一节覆盖。
- “1000 次以上或者 8 小时以上审查与修复”：未声称满足；当前可验证 goal 计时未达到 8 小时，也没有可信证据证明 1000 次独立审查/修复循环。该项属于计量型硬要求，除非继续耗时到 8 小时或用户确认豁免，否则不能作为已完成项。
