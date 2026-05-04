# 仓库多维度审查报告

## 一、执行摘要

- 仓库类型：Chrome Manifest V3 书签管理扩展。
- 主要技术栈：TypeScript、Vite、@crxjs/vite-plugin、Chrome Extension APIs、Node test runner、Playwright。
- 集成分支：`integration/goal-final-polish-20260504`
- 集成 worktree：`/mnt/g/coding/worktrees/goal-final-polish-20260504`
- 基线：`main@11582da` / `v1.4.23`
- 当前集成代码状态：在 `87f4f3c` 基础上继续追加 popup 回收站 helper 预加载瘦身；报告最新提交以 `git log -1 --oneline` 为准。

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

- 集成分支补充优化 / `5a8589c`、`32d636d`、`323898b`、`4699fb9`、`d88164f`、`0e7bd5c`、`b185052`、`87f4f3c`、popup 回收站 helper 预加载瘦身提交
  - 实现思路：修复 popup 窄视口横向溢出；将 newtab 搜索重 chunk 改为按需加载，并保留轻量同步建议；将 newtab 标签索引读取改为轻量 storage normalizer；内联 newtab loading SVG 和关闭动效 helper；将回收站删除/撤销模块改为按需加载；将启动读书签树改为本页轻量 wrapper，书签移动、编辑、新建、撤销恢复等写操作通过 `bookmarks-api` 动态加载；将 popup 自然语言搜索、智能分类网页内容抽取、AI 设置归一化、AI 响应解析、Inbox 状态模块和回收站事务 helper 改为触发对应功能后再加载或通过轻量常量入口解耦，移除首屏非必要运行时预加载。
  - 影响范围：`src/popup/popup.css`、`src/popup/popup.ts`、`src/newtab/content-state.ts`、`src/newtab/newtab.ts`、相关测试。
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
- `npm test`：315/315 通过。
- `npm run check:version`：通过，版本 `1.4.23`。
- `npm run build`：通过。
- `npm run validate`：通过，覆盖 typecheck、test、check:version、build。
- focused popup 自然语言搜索测试：通过。
  - `npm run test:build && node --test .tmp-test/tests/popup-search-empty-state.test.js .tmp-test/tests/recycle.test.js .tmp-test/tests/popup-search.test.js`：31/31 通过。
  - 覆盖自然语言搜索动态 import 缓存、禁止 popup 运行时静态导入 `natural-search`/`shared/inbox`/`ai-response`/`recycle-bin`、AI plan 缓存降级、失效 AI plan 对应结果缓存清理、智能分类模块按需加载、删除事务 helper 按需加载、构建产物不预加载 `natural-search`/`content-extraction`/`ai-settings`/`inbox`/`ai-response`/`recycle-bin`、普通搜索行为。
- focused newtab 搜索测试：通过。
  - `node --test .tmp-test/tests/newtab-search-index.test.js .tmp-test/tests/newtab-content-state.test.js`：53/53 通过。
  - 覆盖轻量同步建议缓存、自然语言搜索动态 import、pinyin 动态搜索、无匹配网页搜索 fallback。
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
  - `dist/src/popup/popup.html` 未发现 `natural-search-*`、`content-extraction-*`、`ai-settings-*`、`inbox-*`、`ai-response-*`、`recycle-bin-*` modulepreload；这些模块仍作为动态 chunk 生成，或由非 popup 首屏路径按需加载。
- Playwright popup 自然语言搜索加载策略检查：通过。
  - fresh profile 打开 popup，`#popup-app-shell` 可见，无 pageerror/console error。
  - 默认打开仅加载 popup 正常功能所需资源，实际请求列表未出现 `natural-search-*`、`content-extraction-*`、`ai-settings-*`、`inbox-*`、`ai-response-*`、`recycle-bin-*`。
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
