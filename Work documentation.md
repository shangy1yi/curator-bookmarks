# Curator Bookmark Extension Modernization Work Documentation

## Workflow Baseline

- 集成 worktree：`/mnt/g/coding/worktrees/curator-extension-modernization-20260506`
- 集成分支：`integration/extension-modernization-20260506`
- 基线：`main` at `dc0a035`
- 旧分支说明：仓库中已存在旧的 `integration/extension-modernization` 和多个 `agent/extension-modernization-*` 分支，且旧 worktree 记录已失效；本轮按任务要求没有沿用旧 worktree 或旧提交链，而是从当前 `main` 新建唯一集成分支。
- main 合并状态：否。任务结束时停留在集成分支，等待用户手动测试和明确批准。

## Repository Review

### 当前扩展架构概述

- Manifest V3 Chrome extension，入口位于 `src/manifest.json`。
- 主要界面包含 `popup`、`newtab`、`options/settings` 三个页面，后台由 `src/service-worker/service-worker.ts` 负责消息、快捷键、书签保存、可用性检测和自动分析队列。
- 共享能力集中在 `src/shared/*`，包括书签树提取、标签索引、备份恢复、内容快照、回收站、搜索查询解析、storage 包装和消息协议。
- 构建链为 Vite + `@crxjs/vite-plugin` + TypeScript，验证脚本包含 `npm run typecheck`、`npm test`、`npm run build`、`npm run validate`。

### 当前 popup 实现概述

- `src/popup/popup.html` 提供品牌区、文件夹筛选、搜索框、自然语言搜索开关、结果区、当前页面智能分类和多个 modal。
- `src/popup/popup.ts` 负责加载 Chrome 书签树、构建本地索引、处理搜索、移动、编辑、删除、当前页保存、智能分类、权限请求和 toast。
- `src/popup/search.ts` 已支持标题、URL、路径、标签、摘要、别名、拼音、结构化语法、时间过滤、近似匹配、合作式搜索。
- 现有缺口：保存搜索的底层模型存在，但 popup UI 被测试明确禁止；当前页保存/编辑状态可进一步缩短路径；搜索结果快捷操作还可增强。

### 当前 newtab 实现概述

- `src/newtab/newtab.html` 接管 Chrome 新标签页，包含背景、设置抽屉、书签来源、工作区、speed dial、搜索、健康模块和仪表盘入口。
- `src/newtab/newtab.ts` 是主要 UI 集成点，配套模型文件包括 `content-state.ts`、`speed-dial.ts`、`workspace-settings.ts`、`bookmark-health.ts`、`command-palette.ts`、`module-settings.ts` 等。
- 现有缺口：命令面板模型存在，但首屏入口和可见工作流仍可更明确；newtab 与 popup/settings 的跨场景能力可以更一致。

### 当前 settings/options 实现概述

- `src/options/options.html` 使用侧栏信息架构，当前包含通用设置、数据与备份、可用性检测、检测历史、重定向、忽略规则、重复书签、文件夹清理、回收站、AI 分析、自动分析历史、书签仪表盘。
- `src/options/options.ts` 聚合大量 section 模块并负责状态、事件和渲染。
- 已有备份恢复、AI 设置、内容快照、Inbox、可用性、重复检测和文件夹清理。
- 现有缺口：隐私/权限透明没有独立中心；标签管理目前散落在仪表盘单条编辑中，没有全局重命名、合并、删除和频率视图。

### 当前数据模型和索引机制概述

- `BookmarkRecord` 由书签树提取，含 title、url、duplicateKey、domain、path、ancestorIds、parentId、dateAdded。
- `BookmarkTagIndex` 存储 AI/manual 标签、摘要、contentType、topics、aliases、confidence 和 source，写入有队列和配额检查。
- `ContentSnapshotIndex` 用于本地内容摘要和可选正文索引，popup 支持轻量索引与延迟 full text warmup。
- `SavedSearchIndex` 已在 `src/shared/search-query.ts` 定义并持久化到 `STORAGE_KEYS.savedSearches`，但尚未被可见 UI 完整使用。
- newtab 有 workspace、speed dial、module settings、activity、favicon cache 等独立设置。

### 当前权限和隐私处理概述

- 权限：`activeTab`、`alarms`、`bookmarks`、`favicon`、`notifications`、`storage`、`webNavigation`、`webRequest`；host permissions 为 `http://*/*` 与 `https://*/*`。
- AI 设置说明 API Key 本地保存，远程解析 Jina Reader 有提示；内容快照可本地保存。
- 可用性检测依赖后台导航和 webRequest 证据。
- 缺口：权限用途、不会劫持搜索、不会上传书签、AI 何时联网、数据删除/导出边界需要集中、可验证的用户入口。

## Issue Lists

### 功能问题清单

- Saved search 数据模型存在但用户在 popup/dashboard 中无法明显使用。
- 标签索引存在但缺少全局标签管理中心，用户难以批量重命名、合并、删除和发现未使用标签。
- 当前页面保存状态和快速操作可以进一步降低路径成本。
- newtab 命令能力和工作区/pinned 能力已有基础，但高阶入口不够显性。
- 备份恢复能力存在，但需要在隐私/权限说明中更清楚地解释可恢复范围和 API Key 处理。

### UI 美观度问题清单

- popup 的高频搜索区与当前页面动作之间可以更聚合，减少用户在智能分类、保存、搜索之间切换的割裂感。
- options 的功能很多，隐私、标签、备份、AI、newtab 设置需要更强的分组和摘要式入口。
- newtab 首屏已有现代视觉，但命令入口、健康提醒和固定入口的关系可以更清楚。
- 空状态、错误态、降级态已有部分覆盖，但新增能力必须补齐。

### 性能问题清单

- popup 不能在首屏同步读取 full text；已有轻量索引和延迟 warmup，需要保持。
- newtab 不能在首屏同步执行重型健康分析；应复用已有本地数据和延迟渲染。
- tag management 的全局统计如果直接在 options 首屏运行可能变重，应只在对应 section 打开时计算。
- service worker 唤醒应避免为纯 UI 设置做额外后台任务。

### UX 问题清单

- 新用户难以快速理解哪些数据本地保存、哪些能力会联网。
- 高级用户缺少“保存常用查询”和跨场景复用查询的路径。
- 标签作为组织方式的生命周期不完整。
- 当前页已收藏时，下一步操作应更明确：打开所在文件夹、编辑标签/摘要/别名、pin 到 newtab。

## External Research

### 调研方式

- 使用的命令 / 工具：web search；`curl -L --max-time 20 -I https://raindrop.io/?lang=en`；`curl -L --max-time 20 -I https://developer.chrome.com/docs/extensions/reference/api/storage`；`curl -L --max-time 20 -I https://docs.omnivore.app/using/search.html`；`curl -L --max-time 20 -I https://snipext.com/`
- 是否成功联网：是
- 如果失败，失败原因：无

### 调研来源

- 来源名称：Chrome Extensions Storage API docs
- URL：https://developer.chrome.com/docs/extensions/reference/api/storage
- 产品类型：Chrome extension 官方最佳实践
- 观察到的功能：`storage.local`、`storage.sync`、`storage.session`、配额和访问级别。
- 用户需求或痛点：扩展设置和本地数据需要稳定持久化，同时要理解配额和敏感数据暴露面。
- 可借鉴点：继续使用本地优先 storage；对大正文使用更合适的存储层；隐私中心解释各类数据保存位置。
- 不适合本项目的点：不把用户书签同步到远端服务作为默认能力。

- 来源名称：Chrome Extensions Manifest V3 service worker lifecycle docs
- URL：https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
- 产品类型：Chrome extension 官方最佳实践
- 观察到的功能：MV3 service worker 非常驻，事件驱动，需持久化状态。
- 用户需求或痛点：后台任务不能依赖长期内存状态。
- 可借鉴点：自动分析队列、命令意图和检测结果继续持久化到 storage；新增能力尽量不要求常驻后台。
- 不适合本项目的点：不引入长连接或远程保活来维持后台状态。

- 来源名称：Chrome Extensions Bookmarks API docs
- URL：https://developer.chrome.com/docs/extensions/reference/api/bookmarks
- 产品类型：Chrome extension 官方 API
- 观察到的功能：读写、创建、移动、删除、搜索书签树。
- 用户需求或痛点：所有整理功能都必须围绕 Chrome 书签真实数据，不应构造脱离浏览器的影子库。
- 可借鉴点：保存、移动、清理、文件夹选择、去重继续基于 bookmarks API。
- 不适合本项目的点：不替换 Chrome 书签系统为独立云端库。

- 来源名称：Chrome Extensions Permissions docs
- URL：https://developer.chrome.com/docs/extensions/reference/api/permissions
- 产品类型：Chrome extension 官方 API
- 观察到的功能：权限请求、检查和可选 host permission。
- 用户需求或痛点：用户需要知道为何请求网页访问或 AI 服务访问。
- 可借鉴点：隐私/权限中心列出权限用途、联网触发条件和可关闭项。
- 不适合本项目的点：不为了便利扩大权限而不解释用途。

- 来源名称：Raindrop.io
- URL：https://raindrop.io/
- 产品类型：bookmark manager / personal library
- 观察到的功能：收藏、集合、标签、搜索、全文、重复和损坏链接管理、跨设备。
- 用户需求或痛点：用户需要长期维护大量链接，并通过标签、集合和搜索重新发现内容。
- 可借鉴点：保存搜索、标签管理、健康清理、内容摘要索引。
- 不适合本项目的点：默认云同步和账号体系不适合当前本地优先扩展定位。

- 来源名称：Toby
- URL：https://www.gettoby.com/
- 产品类型：tabs/bookmarks workspace
- 观察到的功能：以 collection / workspace 管理链接入口。
- 用户需求或痛点：用户想按工作场景快速恢复上下文。
- 可借鉴点：newtab workspace、固定入口和命令面板应服务书签工作场景。
- 不适合本项目的点：不把扩展转成泛 tab session dashboard。

- 来源名称：Bookmark Sidebar
- URL：https://chromewebstore.google.com/
- 产品类型：Chrome bookmark manager extension
- 观察到的功能：侧边栏快速浏览、搜索、编辑、文件夹导航。
- 用户需求或痛点：用户需要轻量入口快速打开和管理书签。
- 可借鉴点：popup 应继续强化快速搜索、当前页状态和单击操作。
- 不适合本项目的点：不增加侧边栏权限和新入口作为本轮核心。

- 来源名称：SuperSorter
- URL：https://chromewebstore.google.com/
- 产品类型：bookmark cleanup extension
- 观察到的功能：排序、去重、清理空文件夹。
- 用户需求或痛点：长期书签库会重复、失效、结构混乱。
- 可借鉴点：健康中心、重复候选、未分类、缺少标签/摘要、最近新增未整理。
- 不适合本项目的点：不默认自动大规模改动书签；批量操作必须可确认、可回滚。

- 来源名称：Pocket / Omnivore / Pinboard / Anybox 类产品
- URL：https://getpocket.com/；https://docs.omnivore.app/；https://pinboard.in/；https://anybox.app/
- 产品类型：read-it-later / link collector / personal library
- 观察到的功能：快速保存、标签、全文搜索、备注、导入导出、隐私选项。
- 用户需求或痛点：保存成本低，但后续找回和理解内容是核心价值。
- 可借鉴点：摘要、别名、标签、保存后下一步建议、导入导出和隐私说明。
- 不适合本项目的点：不增加阅读器、社交推荐、广告或远程账户。

- 来源名称：Speed Dial 2 / Infinity New Tab / Anori / Tabliss / Bonjourr / Momentum / NelliTab 类 newtab 产品
- URL：https://chromewebstore.google.com/；https://anori.app/
- 产品类型：visual bookmark / speed dial / new tab dashboard
- 观察到的功能：快速入口、视觉网格、工作区、搜索栏、背景、模块配置。
- 用户需求或痛点：newtab 是高频入口，但装饰不能牺牲速度和隐私。
- 可借鉴点：固定书签、工作区、轻量命令入口、模块开关、健康摘要。
- 不适合本项目的点：不做泛效率面板、天气新闻和与书签无关的 widget。

### Chrome 书签用户需求归纳

- 快速保存：一键保存当前页，检测重复，保存后可编辑标签、摘要、别名和目标文件夹。
- 快速搜索：标题、URL、路径、标签、摘要、别名、时间、站点、类型都应纳入本地搜索。
- 标签和分类：需要低成本添加标签，长期需要重命名、合并、删除和发现未使用标签。
- 去重和清理：需要重复、未分类、缺少元数据、疑似失效和近期未整理入口。
- newtab 快速入口：需要固定入口、工作区、书签搜索和轻量健康摘要。
- popup 轻量入口：打开即搜，当前页状态明显，键盘可完成打开/保存/编辑。
- 导入导出/备份：试用和迁移前需要可回滚保障，API Key 等敏感字段必须明确不导出。
- 隐私和权限：用户关心是否上传书签、是否修改搜索引擎、是否追踪、AI 何时联网。
- 性能：大书签库下搜索和首屏必须快，重型分析必须延迟、缓存或只在用户进入管理区后执行。
- 同步和跨设备：很多产品提供云同步，但本项目应保留本地优先，未来可考虑可选导出/导入而不是默认云端。

### 对本项目的启发

- Curator 已经具备很多底层能力，最有价值的是把“已有模型”产品化成用户看得见的闭环。
- 本轮不需要引入重依赖或远程服务，应该扩展本地数据、设置入口和跨界面工作流。
- 隐私透明和权限说明本身是核心产品能力，不只是文档。

### 最终采纳的方向

- 保存搜索 UI 与跨场景查询复用。
- 标签管理中心。
- 当前页面快速操作增强。
- newtab 命令/工作台入口增强。
- 书签健康与清理摘要升级。
- 隐私与权限透明中心。
- 导入导出说明和备份恢复体验补强。

### 明确不采纳的方向与原因

- 默认云同步：违背本地优先定位。
- 广告、追踪、推荐流：违背隐私和书签管理核心。
- 泛 dashboard widget：会偏离书签管理，不符合任务约束。
- 搜索时实时 AI：会拖慢核心路径且带来隐私风险。
- 大规模自动整理无确认：风险高，必须保留确认和回滚。

## Innovation Opportunities

1. Popup 保存搜索：将常用结构化搜索保存为 chips/列表，一键复用。
2. Dashboard 保存搜索复用：管理页可读取相同 saved search 数据。
3. Popup 当前页状态卡：展示已收藏/未收藏、所在文件夹、快速编辑、pin 到 newtab。
4. Popup 快速标签/摘要/别名编辑：不进入 options 即可补齐元数据。
5. 全局标签管理中心：频率、重命名、合并、删除、未使用清理。
6. 标签建议：基于现有标签、域名和路径生成本地建议。
7. 书签健康摘要：重复、未分类、缺少标签/摘要/别名、最近未整理。
8. Newtab command palette：聚合搜索书签、打开设置、打开清理中心、保存当前页入口。
9. Newtab 工作区强化：固定入口按场景隔离并在 settings 可管理。
10. 隐私与权限中心：解释本地数据、权限、AI 联网、Jina Reader、备份红action。
11. 备份恢复预览增强：更明确地告诉用户恢复范围和敏感字段处理。
12. 性能分层索引：首屏轻索引，用户搜索时再按需 warm full text。
13. 保存后下一步建议：保存成功后提示添加标签、查看所在文件夹、打开 Inbox。
14. 搜索空结果建议：提示结构化语法、清除筛选、进入全局管理。
15. 批量整理 checklist：把重复/未分类/缺少元数据转成任务列表。

## Selected Deliverables

### 1. Popup 保存搜索与搜索工作流增强

- 用户价值：常用搜索如 `site:github.com 最近 2 周` 可一键复用。
- 与书签管理核心关系：直接提升找书签效率。
- 实现范围：popup UI、state、dom、saved search load/save/delete、空状态、错误提示、测试。
- 验收标准：popup 中可保存当前查询、选择已保存查询、删除查询；底层 limit 和 scope 正常；不会拖慢首次打开。

### 2. Popup 当前页面快速操作增强

- 用户价值：知道当前页面是否已收藏，并能快速保存、编辑元数据、pin 到 newtab。
- 与书签管理核心关系：降低保存和整理成本。
- 实现范围：popup 当前页卡片、保存状态、快速操作按钮、与 speed dial storage/message 互通。
- 验收标准：未收藏显示保存路径；已收藏显示路径和操作；错误态可理解。

### 3. 全局标签管理中心

- 用户价值：集中治理标签，解决标签堆积和命名不一致。
- 与书签管理核心关系：标签是检索和组织核心。
- 实现范围：shared tag utilities、options 新 section、标签统计、重命名、合并、删除、测试。
- 验收标准：可以按频率查看标签；可重命名/合并/删除；空状态清晰；大库统计只在 section 打开时计算。

### 4. Newtab 命令工作台增强

- 用户价值：在新标签页用键盘快速搜索书签、打开清理中心、进入设置或调用固定入口。
- 与书签管理核心关系：newtab 作为高频书签入口。
- 实现范围：newtab command palette UI、快捷键、状态、空态、测试。
- 验收标准：可通过 Ctrl/Cmd+K 或入口打开；命令项和书签项可键盘导航；不会遮挡设置抽屉。

### 5. 书签健康与清理摘要升级

- 用户价值：快速知道书签库哪些部分值得整理。
- 与书签管理核心关系：长期维护书签库。
- 实现范围：newtab/options 健康摘要或清理 checklist，复用 duplicate/folder/tag/snapshot 数据。
- 验收标准：展示重复、未分类、缺少标签/摘要、最近未整理；点击进入对应设置区；空态明确。

### 6. 隐私与权限透明中心

- 用户价值：知道扩展不会劫持搜索、不上传书签、AI 何时联网、权限用途和数据删除方式。
- 与书签管理核心关系：本地优先和可信赖是产品核心定位。
- 实现范围：options 新 section、manifest 权限解释、AI/Jina/backup/storage 数据说明、关闭或跳转入口。
- 验收标准：侧栏可进入；列出所有权限用途；说明不会修改默认搜索引擎/启动页；说明 API Key 不导出；有数据管理入口。

### 7. 备份恢复和导入导出说明补强

- 用户价值：试用和大批量整理前更放心。
- 与书签管理核心关系：降低迁移和整理风险。
- 实现范围：backup section copy/UI 状态增强，必要测试。
- 验收标准：恢复模式、敏感字段、newtab 设置、标签索引和 Chrome 书签恢复范围清晰。

## Subtasks

- Agent A：产品审查、架构审查、外部调研、`Work documentation.md` 初稿和集成规划。
- Agent B：Popup 保存搜索与当前页面快速操作。
- Agent C：搜索、索引、标签管理共享能力。
- Agent D：Options 标签管理中心、隐私权限中心、备份说明。
- Agent E：Newtab 命令工作台和健康摘要 UI。
- Agent F：性能、测试、工程质量和最终验证。

## Agent Plan

- 每个 agent 使用独立 worktree 和独立 `agent/extension-modernization-20260506-*` 分支。
- 每个 agent 只提交自己的改动，不合并到 main。
- 集成顺序：shared/search/tag foundations -> popup -> options/privacy/tag -> newtab -> performance/test polish。
- 每次合并后更新本文档 `Integration Log`。
- 如果合并后发现实现问题，回到对应 worktree 修复并提交，再继续集成。

## Risks And Rollback

- 风险：popup 首屏变慢。回滚策略：移除首屏同步加载，保留 lazy load 和轻量索引。
- 风险：options 文件已很大，新增 section 可能加剧复杂度。回滚策略：把可复用逻辑放入 `src/shared` 或 `src/options/sections`。
- 风险：标签批量编辑误伤用户数据。回滚策略：操作前确认，复用 backup hook，测试 normalization。
- 风险：newtab command palette 与设置抽屉/仪表盘 overlay 冲突。回滚策略：保持互斥状态和 inert/aria 约束。
- 风险：隐私中心文案与实际权限不一致。回滚策略：最终审计 manifest、settings、AI 和 backup 实现逐条对齐。

## Integration Log

## Agent: agent/extension-modernization-20260506-shared

### 负责范围

- 共享标签管理纯函数和对应测试。
- 搜索与 saved search 基础审查，确认现有 `src/shared/search-query.ts` 已具备 normalize/save/delete/scope 的可复用模型。

### 修复或优化的原有功能

- 将标签统计、重命名、合并、删除和空记录清理从 UI 操作中抽象成可测试的共享能力。

### 新增功能 / 核心能力增强

- 新增 `buildBookmarkTagUsageStats`：生成标签使用次数、manual/AI 来源计数、最近更新时间和示例书签。
- 新增 `renameBookmarkTag`、`mergeBookmarkTags`、`deleteBookmarkTags`、`pruneEmptyBookmarkTagRecords`：支持全局标签治理中心。

### UI / UX 改进

- 本分支不直接改 UI；为 options 标签管理中心提供稳定数据模型。

### 性能改进

- 标签统计是纯函数，供 settings 对应 section 按需调用，避免 popup/newtab 首屏承担全局标签扫描。

### 隐私 / 权限 / 数据安全影响

- 不新增权限，不联网，不引入依赖。所有操作只处理本地 `BookmarkTagIndex`。
- 保持 manualTags 优先语义，避免 AI 标签覆盖用户手动标签。

### 影响范围

- 涉及文件：`src/shared/tag-management.ts`、`tests/tag-management.test.ts`、`Work documentation.md`
- 涉及模块：共享标签索引、options 标签管理中心的后续数据基础。

### 实现思路

- 复用 `normalizeBookmarkTagIndex`、`normalizeBookmarkTags` 和 `getEffectiveBookmarkTags`。
- 批量操作返回新的 index、影响记录数和被清理记录数，由 UI 再决定是否保存。

### 测试方式

- 已运行：`npm install`
- 已运行：`npm run test:build && node --test .tmp-test/tests/search-query.test.js .tmp-test/tests/bookmark-tags.test.js .tmp-test/tests/tag-management.test.js`

### 已知风险

- UI 集成时仍需在保存前做确认，尤其是删除和合并标签。

### Integration Log: planning

- 合并时间：2026-05-06
- 合并结果：成功
- 冲突文件：无
- 冲突解决方式：无
- 合并后验证：`git status --short --branch` 确认只新增 `Work documentation.md`
- 是否需要回到 agent worktree 修复：否
