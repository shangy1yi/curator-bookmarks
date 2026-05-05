# Curator Newtab Modernization Work Documentation

## Objective

把 Curator 的 `src/newtab/newtab.html`、`src/newtab/newtab.ts`、`src/newtab/newtab.css` 以及 newtab settings 迭代成更现代、功能完整、快速、以书签管理为核心的 Chrome 新标签页体验。当前分支只作为集成分支使用，不合并到 `main`。

## Working Branch

- 集成 worktree：`/mnt/g/coding/worktrees/integration-newtab-modernization`
- 集成分支：`integration/newtab-modernization`
- 基准提交：`56ca598 Merge goal newtab completion`
- main 合并状态：未合并到 `main`，等待人工测试和明确批准。

## External Research

### 调研方式

- 使用的命令 / 工具：
  - `curl -L -sS --max-time 20 https://developer.chrome.com/docs/extensions/develop/ui/override-chrome-pages`
  - `curl -L -sS --max-time 20 https://developer.chrome.com/docs/extensions/reference/permissions-list`
  - `curl -L -sS --max-time 20 https://github.com/joelshepherd/tabliss`
  - `curl -L -sS --max-time 20 https://github.com/victrme/Bonjourr`
  - Web search: Anori、Momentum、Speed Dial 2、NelliTab、Chrome extension newtab docs
- 是否成功联网：是
- 如果失败，失败原因：无

### 调研来源

- 来源名称：Chrome Extensions - Override Chrome pages
  - URL：https://developer.chrome.com/docs/extensions/develop/ui/override-chrome-pages
  - 观察到的功能：Chrome 支持通过 `chrome_url_overrides.newtab` 替换新标签页；新标签页首次焦点仍在地址栏；页面需要自己的标题；避免同步访问数据库等阻塞路径。
  - 可借鉴点：Curator newtab 应保持轻量首屏、显式标题、不要依赖默认聚焦搜索框，不做会让用户误以为是 Chrome 默认页面的伪装。
  - 不适合本项目的点：官方示例只给 override 基础，不提供书签产品信息架构。
- 来源名称：Chrome Extensions - Permissions
  - URL：https://developer.chrome.com/docs/extensions/reference/permissions-list
  - 观察到的功能：`bookmarks` 权限会提示可读写书签；`history` 权限会触发浏览历史警告；`storage` 用于扩展存储；`favicon` 用于图标。
  - 可借鉴点：本轮不新增 `history` 权限；最近访问只使用 Curator 自己的 `newTabActivity`；设置中明确解释权限和本地数据。
  - 不适合本项目的点：不为“最近关闭/浏览历史”新增敏感权限。
- 来源名称：Speed Dial 2 - Organizing Bookmarks into Groups
  - URL：https://www.speeddial2.com/help/creating-groups
  - 观察到的功能：Speed Dial 用 group tab 分组、支持创建、切换、重命名、拖拽排序。
  - 可借鉴点：Curator 应提供 workspace / 场景切换，把固定书签按工作、学习、个人等场景组织。
  - 不适合本项目的点：不复制云同步/共享 group 等偏服务端能力。
- 来源名称：Anori
  - URL：https://anori.app/
  - 观察到的功能：多 widget、文件夹、主题、书签、任务、笔记、最近关闭等，并在需要敏感能力时再请求权限。
  - 可借鉴点：模块化新标签页、按用户意图启用功能、敏感能力解释清楚。
  - 不适合本项目的点：天气、RSS、日历等泛 dashboard 能力不应成为本轮重点。
- 来源名称：Momentum Help Center - About Momentum
  - URL：https://get.momentumdash.help/hc/en-us/articles/115007780748-About-Momentum
  - 观察到的功能：搜索、链接、任务、每日焦点、设置控制显示/隐藏和搜索 provider。
  - 可借鉴点：保留“快速进入”和“少干扰”的第一屏；设置需要能控制主要模块。
  - 不适合本项目的点：每日照片、语录、天气、任务集成不直接服务书签管理。
- 来源名称：Tabliss GitHub
  - URL：https://github.com/joelshepherd/tabliss
  - 观察到的功能：可定制、跨浏览器、以美观简洁为核心。
  - 可借鉴点：视觉克制、模块不要压过首屏主要入口。
  - 不适合本项目的点：不能只做美观自定义而缺少书签整理能力。
- 来源名称：Bonjourr GitHub
  - URL：https://github.com/victrme/Bonjourr
  - 观察到的功能：极简 startpage / homepage，主题和背景突出。
  - 可借鉴点：设置抽屉应让用户快速理解视觉变化，避免复杂配置压垮首屏。
  - 不适合本项目的点：本项目不应转成壁纸/aesthetic 产品。
- 来源名称：NelliTab 概览
  - URL：https://get.alternative.to/nellitab/overview
  - 观察到的功能：展示书签、top sites、history、downloads、本地图标缓存、拖拽、主题和图标尺寸自定义。
  - 可借鉴点：基于书签文件夹和本地图标缓存做快速入口；健康/整理入口要轻量。
  - 不适合本项目的点：不新增 history/downloads 面板，避免偏离书签管理核心和增加权限压力。

### 竞品功能归纳

- 快速访问：Speed Dial 类产品用固定入口、分组、拖拽排序和空状态引导降低打开成本。
- 搜索：现代 newtab 通常把搜索框置于首屏，但不能劫持默认搜索引擎；书签产品应优先搜索书签、路径、标签、摘要。
- 自定义：成熟产品提供主题、布局、显示/隐藏模块、图标大小和背景设置。
- 书签组织：以文件夹、workspace、常用、最近新增、待整理和重复候选等集合帮助用户理解书签。
- 生产力组件：Momentum / Anori 的任务、笔记、天气可以提升黏性，但本项目必须只保留与书签处理直接相关的轻量能力。
- 隐私和权限：权限说明需要透明；敏感功能应 opt-in；不要新增浏览历史权限来做“继续访问”。
- 性能：Chrome 官方明确要求避免同步数据库访问；NelliTab 的本地图标缓存说明 newtab 首屏应避免远程依赖。

### 对本项目的启发

- 把“固定书签”从隐藏在右键菜单里的能力提升为首屏 Speed Dial。
- 用 workspace 解决不同场景入口混杂问题，同时保持数据仍在 `chrome.storage.local`。
- 用本地轻量统计做书签健康提醒，不在首屏做网络扫描。
- 用命令面板增强键盘入口，复用已有 search index，避免新增重依赖。
- 在 settings 中增加隐私/权限透明区和主要新模块控制项。

### 最终采纳的方向

- 书签 Speed Dial / Pinned Bookmarks：首屏固定入口、空状态、取消固定、从搜索结果/命令面板固定。
- Workspace / 场景模式：工作、学习、个人等场景，每个 workspace 维护独立 pinned bookmarks。
- 本地书签搜索增强和命令面板：键盘搜索、打开、固定/取消固定、切换 workspace、进入整理页。
- 书签健康 / 整理提醒：未整理、重复候选、缺少标签/摘要、最近新增未处理，使用本地缓存和已有数据。
- newtab settings 增强：模块显示/隐藏、workspace 管理、隐私和权限透明说明。

### 明确不采纳的方向与原因

- 天气、Gmail、Spotify、语录、纯任务管理：不直接服务书签管理，会把 Curator 做成泛 dashboard。
- 新增 `history` 权限做浏览历史：权限成本高，和本地优先/隐私透明目标冲突。
- 云同步/共享 Speed Dial group：需要远程账号或服务，不符合本轮本地优先边界。
- 重型网页健康扫描放在 newtab 首屏：会拖慢新标签页，应保留到 options 里的可控检测流程。

## 第一阶段：审查与规划

### 1. 当前 newtab 实现概述

- `src/manifest.json` 通过 `chrome_url_overrides.newtab` 指向 `src/newtab/newtab.html`。
- `src/newtab/newtab.html` 包含设置抽屉、dashboard iframe overlay 和 `#newtab-root`。
- `src/newtab/newtab.ts` 是主要运行时入口，负责读取 Chrome 书签树、storage 设置、背景媒体、搜索索引、favicon 缓存、拖拽、右键菜单、删除回收站和活动记录。
- `src/newtab/content-state.ts` 承担可测试的纯函数：搜索索引、portal overview、quick access、状态视图、布局边界。
- 当前 newtab 已支持书签来源、多文件夹展示、搜索建议、pinyin/自然语言搜索复用、时间模块、背景设置、卡片布局、右键编辑/复制/删除/固定、favicon accent 缓存、dashboard iframe。

### 2. 当前 newtab settings 实现概述

- settings 作为 `newtab.html` 内的右侧 drawer，不是单独 options 页面。
- 当前设置分为通用、书签来源、背景、书签卡片、时间和日期、搜索栏。
- 设置持久化使用 `chrome.storage.local`，主要 key 在 `src/shared/constants.ts` 的 `STORAGE_KEYS`。
- 保存反馈由 `saveSettingsWithFeedback()` 和 `settings-save-status` 处理。
- 已有 trust note 说明搜索栏不修改 Chrome 默认搜索引擎或启动页。

### 3. 功能问题清单

- 固定书签能力存在，但首屏没有独立 Speed Dial 管理区，用户不一定发现。
- `newTabActivity.pinnedIds` 是全局列表，无法按工作/学习/个人场景分离。
- 今日门户只展示今日打开/新增和常用/新近，缺少可行动的整理提醒。
- 搜索建议可以打开书签，但不能直接固定、切换工作区、进入整理工具。
- settings 没有 workspace 管理，也没有对新增模块的集中显示控制。
- 隐私和权限说明分散，缺少“本地存储了什么、不会做什么”的透明区。

### 4. UI 美观度问题清单

- 首屏仍偏“书签文件夹网格 + 小型 portal”，缺少现代 dashboard 的清晰主次结构。
- 常用/新近入口偏窄，固定入口和文件夹入口没有形成清晰层级。
- 设置抽屉已经很长，新功能需要避免继续堆叠成低可读性表单。
- 缺少 workspace segmented control、整理卡片、命令面板等用户能一眼理解的现代交互。

### 5. 性能问题清单

- `refreshNewTab()` 会读取完整书签树和多个 storage key，新增功能必须复用现有读取结果。
- 搜索索引和自然搜索已有缓存，命令面板应复用 `preparedSearchIndex`，不能新建重型索引。
- 书签健康统计只能基于本地书签数据、tag index、snapshot index 和 duplicateKey 做轻量计算。
- 首屏不应引入额外远程资源、网络请求或大依赖。

### 6. UX 问题清单

- 用户不知道如何把重要书签固定到 newtab，右键菜单发现成本高。
- 不同场景书签混在一起，打开新标签页时缺少上下文切换。
- 搜索框没有显式说明“先搜书签，再搜网页”，空结果时缺少整理或固定建议。
- 整理能力主要在 options，newtab 缺少轻量入口和提醒。
- 设置变化需要更明确地映射到首屏模块。

### 7. 可创新机会点

- Workspace / 场景模式，按工作、学习、个人分离固定入口。
- 首屏 Speed Dial 模块，展示当前 workspace 的 pinned bookmarks。
- 从搜索结果或命令面板直接 pin/unpin。
- Command palette，支持打开书签、切换 workspace、进入设置/整理页。
- Bookmark Health 模块，展示未整理、重复候选、缺少标签/摘要、最近新增未处理。
- Settings 中的模块开关和 workspace 管理。
- Privacy & Permissions 透明面板，说明本地优先、不劫持搜索、不新增 history。
- 搜索空状态建议，引导固定、切换 workspace 或打开整理页。
- 最近新增待处理队列，绑定 Inbox / 待整理概念。
- 布局预设，把复杂卡片参数收敛成更直观的工作台/极简/紧凑模式。

### 8. 最终选择落地的新功能

- Workspace / 场景模式。
- 首屏 Speed Dial / Pinned Bookmarks。
- Command palette / 快捷操作。
- Bookmark Health / 整理提醒。
- Settings 模块化和隐私透明增强。

### 9. 每个新功能的用户价值

- Workspace：用户按场景保留不同常用入口，打开 newtab 更快进入当前任务。
- Speed Dial：最重要书签直接可见，不再依赖文件夹滚动或右键隐藏能力。
- Command palette：键盘用户可以快速搜索、打开、固定、切换场景和进入整理工具。
- Bookmark Health：把 Curator 的整理价值带到 newtab，让用户知道下一步该处理什么。
- Settings 增强：用户能控制新能力、理解隐私边界，并快速恢复自己喜欢的布局。

### 10. 每个新功能与书签管理核心的关系

- Workspace 和 Speed Dial 都直接组织书签入口。
- Command palette 以书签搜索和书签操作为核心，不替代浏览器搜索。
- Bookmark Health 基于书签重复、标签、摘要、Inbox/待整理等管理信号。
- Settings 增强只服务 newtab 书签入口效率和透明控制。

### 11. 每个新功能的实现范围

- 新增 storage key：workspace 设置、newtab 模块设置、健康缓存或轻量设置。
- 更新 `newtab.html`：settings 新增 workspace、模块、隐私区。
- 更新 `newtab.ts`：状态、渲染、事件、持久化、命令面板、健康统计。
- 更新 `newtab.css`：workspace tabs、Speed Dial、health cards、command palette、settings 新段落样式。
- 更新纯函数和测试：尽量把 workspace/health 计算放在 `content-state.ts` 或新的轻量 helper，补充单元测试。

### 12. 每个新功能的验收标准

- Workspace：首屏可切换 workspace；settings 可查看/管理；每个 workspace 保留独立 pinnedIds；默认 workspace 有合理空状态。
- Speed Dial：首屏明显展示固定书签；可从书签菜单/命令面板固定和取消；空状态提供添加路径；不会显示失效 bookmark id。
- Command palette：快捷键可打开；支持输入过滤书签和命令；键盘上下选择、Enter 执行、Esc 关闭；不会劫持普通输入。
- Bookmark Health：首屏显示轻量整理提醒；能跳转 options 对应页面；不使用新增网络请求或 history 权限。
- Settings：新增模块均有开关或说明；隐私区明确本地优先、不追踪、不修改默认搜索引擎；保存反馈有效。

### 13. 子任务拆分

- Agent A：workspace 数据结构、首屏切换器、settings workspace 管理。
- Agent B：Speed Dial 可见模块、pin/unpin UX、空状态。
- Agent C：Command palette、搜索/命令键盘 UX。
- Agent D：Bookmark Health、整理提醒、options 深链入口。
- Agent E：settings 模块控制、隐私透明、视觉整合。
- Integration：合并、冲突解决、文档同步、完整验证。

### 14. Agent 分工计划

- 每个 agent 使用独立 worktree 和独立分支，路径位于 `/mnt/g/coding/worktrees`。
- 每个 agent 只在自己的 worktree 中提交。
- 所有 agent 分支逐个合并到 `integration/newtab-modernization`。
- 合并后必须追加 Integration Log，记录冲突和验证。
- 若发现实现问题，回到对应 agent worktree 修复后重新合并。

### 15. 风险和回滚方案

- 风险：`newtab.ts` 是大文件，多 agent 同时修改容易冲突。
  - 方案：尽量把纯计算拆到 `content-state.ts`，集成时逐个 merge，冲突手工保留所有功能。
- 风险：新增模块拖慢首屏。
  - 方案：复用已读取的书签树、tag index、snapshot index 和 activity；不新增远程请求；命令面板按需渲染。
- 风险：settings 过长。
  - 方案：采用折叠式或分组式设置卡片，控制模块开关和说明密度。
- 风险：Chrome 权限引发用户误解。
  - 方案：不新增权限；在 settings 透明说明现有权限用途。
- 回滚：每个 agent 分支独立提交；集成分支可以用 `git revert -m 1 <merge>` 回退单个 agent merge，或在对应 agent 分支修复后重新合并。

## Implementation Progress

- 2026-05-05：创建全新 integration worktree 与分支；完成现有代码审查和外部调研；创建本文档初版。

## Agent: agent/newtab-workspaces

### 负责范围

- Workspace / 场景模式的数据结构、默认场景、独立 pinned bookmark 列表和旧 pinned 数据迁移。

### 修复或优化的原有功能

- 将旧的全局 `newTabActivity.pinnedIds` 迁移为默认 workspace 的 pinned 列表，后续 UI 可按场景隔离。

### 新增功能

- 新增 `newTabWorkspaceSettings` storage key。
- 新增默认 `默认 / 工作 / 学习 / 个人` workspace。
- 新增 workspace normalize、active workspace 切换、pin/unpin、rename/update 和无效 id 清理纯函数。

### UI / UX 改进

- 本分支提供 UI 接入所需数据基础，首屏切换器由集成分支接入。

### 性能改进

- 纯函数只基于已读取的 storage 和 bookmark id set 计算，不新增网络请求或 Chrome 权限。

### 影响范围

- 涉及文件：`src/shared/constants.ts`、`src/newtab/workspace-settings.ts`、`tests/newtab-workspace-settings.test.ts`。
- 涉及模块：newtab storage settings、workspace pinned bookmarks。

### 实现思路

- 用固定默认 workspace 保证空状态可预测。
- 通过 `validBookmarkIds` 过滤失效 pinned id，避免首屏展示不存在的书签。
- 将所有修改做成不可变返回，方便后续 UI 状态更新和测试。

### 测试方式

- 已运行：`node -e "require('node:fs').rmSync('.tmp-test', { recursive: true, force: true })" && ./node_modules/.bin/tsc -p tsconfig.test.json && node --test .tmp-test/tests/newtab-workspace-settings.test.js`，4 项通过。
- 手动测试建议：在 newtab settings 切换 workspace 后固定不同书签，刷新后确认各场景 pinned 列表互不影响。

### 已知风险

- 当前分支不含 UI 接入；需要 integration 分支把 settings 和首屏切换器接上。

## Integration Log: agent/newtab-workspaces

- 合并时间：2026-05-05
- 合并结果：成功
- 冲突文件：无
- 冲突解决方式：无需解决
- 合并后验证：暂未运行；等待所有 agent 分支合并后统一运行。
- 是否需要回到 agent worktree 修复：否
