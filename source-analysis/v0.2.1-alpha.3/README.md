# DSH v0.2.1-alpha.2 → v0.2.1-alpha.3 变更说明（更新要点）

> **数据源**: `deepseek-ai/deepseek-harness` 官方仓库（经回环 HTTP 代理拉取 tag）
> **标签对比**: `dsh-v0.2.1-alpha.2` (`d743267388`) → `dsh-v0.2.1-alpha.3`（提交 `2fbf4359b8`）
> **发布日期**: 2026-10-14 ｜ **发布 PR**: [#6234](https://github.com/deepseek-ai/deepseek-harness/pull/6234)（merge `worktree/release-dsh-0.2.1-alpha.3`）
> **性质**: 0.2.1 线第三个 alpha，**一次「Remote 访问 RBAC 落地 + CUA 桌面操作大扩容 + JSONL/JobId/子代理 preset 三处契约换代 + 客户端契约符号成批换代」** 的大跨度发布，共 852 个提交（673 非 merge + 179 merge）
> **统计**: 3311 files changed, +120978 / −16632
> **结构变化**: `packages/`+`apps/` **5 新增 / 0 删除 / 0 改名**——`api/remote-access`（RBAC）、`client/ui-secret-mask`（凭据遮蔽）、`context/harness-dev-context`（开发上下文 bundle）、`experimental/cua` + `experimental/cua-macos`（桌面操作双包，204 提交的绝对主力主题）
> **持久化契约**: `SESSION_FORMAT_VERSION` **保持 4**（四版逐字节同值）；窗口内新增 **2 条同版本加性承认**（`docs/persistence-changes/2026-09-30-job-session-lifecycle`、`2026-10-13-user-rpc-principal`，均 `decision: same-version`），并新增 `historical-formats/` 档案目录
> **插件契约**: **兼容性闸门 / settings 核心 / vendor cordis·schemastery 内容零 diff**（cordis `4.0.5-alpha.1→alpha.2`、schemastery `3.18.5-alpha.1→alpha.2` 仅版本号；a.4 才动闸门）；但 **slot 目录大规模换代（+627/−179）**——5 新槽 / 1 改名（`conversation.message.images` → `conversation.chat.message.images` 家族）；**JSONL 持久化包改插件命名空间导出（无默认导出）**、**JobId 换 `<kind>-<short-uuid>` 形态**、**子代理 `persona`/`toolFilter` 配置删除改 `agentPreset`**、`installBundle` 对已装包报 `already-installed`，并且**本版首次成批删除客户端具名导出**（`projectUserText`/`RenderMessageImages`/`OperatorPeer` 等，见下"定义类缝隙符号级扫描"）——官方升级指南 **14 篇**（目录代际滞后：3 篇挂 `v0.2.1-alpha.1/`、10 篇挂 `v0.2.1-alpha.2/`、1 篇挂 `v0.2.0-rc.2/`）

---

## 一句话总结

0.2.1-alpha.3 是 **"Remote 方法级 RBAC 进门 + 桌面操作（CUA）成建制 + 三处官方指南级契约换代（JSONL 导入形态 / JobId 身份 / 子代理 preset 组装）+ 客户端 UI 契约符号换代"** 的一次发布——a.2 伤的是"编排 API 与 provider 面"，本版伤的是**持久化消费者、后台 job 消费者、子代理配置方、多用户 Remote 访问面与 import 客户端契约具名符号的插件**：

- **Remote 访问 RBAC**（新缝 `ctx.remoteAccess`，`packages/api/remote-access`）：非 owner Peer 可调哪些 Remote 方法/事件由业务注册的 role-based policy 决定（`d7bd68ee7a`）；typert **Remote 定义统一为惰性 method info**（`efdaa86fb8 refactor(typert)`）并声明方法/事件资源（`9c6374909b`）；endpoint 资源解析 + 列表按访问过滤（`2640d3df82`）；非 owner 用户消息源记录 principal（`d6e408d957`，持久化承认 `user-rpc-principal`）；client 侧新增 remote access hooks（`b967475c66`）；撤销时丢弃缓冲事件（`529706d163`）；
- **JSONL 持久化换插件形态**（指南 `jsonl-persistence-plugin`）：`@deepseek-ai/dsh-session-persistence-jsonl` **只有命名导出 `name`/`Config`/`apply`，无默认导出**——默认导入、直接构造、继承、`instanceof`、类类型标注全部受影响；动态导入不再取 `.default`；服务类型标注改用 `dsh-session-persistence` 的 `SessionPersistence`；
- **JobId 换代**（指南 `job-id-identity`，持久化承认 `job-session-lifecycle`）：注册表返回 **`<kind>-<short-uuid>`**（16 位小写十六进制），不再 `<kind>-N`；生命周期记录**删除 `executionId`**；`JobExecutionId` 导入移除；`job/registered`/`job/settled` 用同一 `JobId` 配对；
- **子代理 preset 组装**（指南 `subagent-preset-composition`）：`dsh-tool-subagent` **拒绝 `persona` 与 `toolFilter` 配置**；`SubagentStartRequest` 与能力声明同步删两字段；spawn 改 `agentPreset` 选 preset、`allowedAgentPresets` 对父模型开放多选；fork 继承父 preset 不可独立改；`standard`/`ptc`/`cordis` 委派工具**不再隐藏 `schedule_*`**；
- **CUA 桌面操作成建制**（204 提交，新包 `experimental/cua` + `cua-macos`）：共享执行层与 macOS 原生 provider 分离（`f65cb889b8`/`c36a40656b`）、跨 Agent 连接共享原生 helper（`1e67f8da60`）、截图元数据由协议 schema 派生（`688137b0a2`）、像素映射 + 可选相对坐标（`5658751da0`）、系统指针显式 hover 与悬停跨观察保持（`17c253ce7e`/`fd3868adc6`）、无激活恢复窗口并拒绝陈旧坐标（`a83cebc4cf`）；
- **客户端契约符号换代（定义类缝隙，符号级扫描确认，grep 全仓无残影）**：`@deepseek-ai/dsh-client-connection` **删 `OperatorPeer` 导出**（`operator-peer.ts` 整文件消失）；`ui-primitives` user-text **删 `projectUserText()`/`UserTextReferences`，代之以 `UserTextRun`/`ReferenceChip` 组件**；`ui-conversation` 契约 **删 `RenderMessageImages`**（代以 `MessageImagesOwnerProps`/`MessageImagesContentInput` + slot key `conversation.images.content`）；`ui-chat` 契约删 `TURN_PROCESS_INDEPENDENT_KINDS`；`api/terminal-controller` 删 `TerminalAttachmentId`；`app-boot` index 收口 `readProfilePatches/resolveTelemetryPatch/addHarnessSourceSection/HARNESS_SOURCE_SECTION`（`ProfileContext` 等移 `profile-context.ts`）；**images 槽拆分**：`conversation.message.images` 消失 → `conversation.chat.message.images` + `conversation.chat.user.images`；新增 `conversation.hero.options`、`conversation.user.text.node`、`workspace.toast` 三槽；
- **插件安装/热替换语义收紧**（指南 `plugin-install-over-installed`）：HMR 运行中对已安装包再 `installBundle(spec)` → **pnpm 前失败**，返 `application:'failed'` + `error.code:'already-installed'`；升级须 `removeBundle` → `installBundle`；配套 `879ad372ac` HMR 在 profile 重组期替换包文件已变的插件；
- **凭据优先级反转**（指南 `stored-credentials-precedence`）：`.credentials.yaml` 存储条目**优先于导出的同名环境变量**（此前相反）；随附 `headless` profile 禁用凭据存储/authorization/DeepSeek account（要旧行为须显式恢复 patch）；
- **非页面 Connection 默认 `interactions:'none'`**（指南 `operator-connect`）：不开 `$events`、无 `$on()`/`$stream()`；要回答转发交互须显式 `interactions=answer`；API operator 隔离不改浏览器身份（`0f7ac58213`）；
- **账号与模型面**（3 篇指南）：DeepSeek 账号路由**不再收 `models` 目录**（残留字段加载即停），改账号 `GET /models` 列表 + `modelOverrides`；`DeepSeekAccount.watch(signal)` 默认不推送 Platform 身份变化（须 `watch(signal, true)`）；pi-ai Azure 路由更名 `azure-openai-responses`→`azure`；pi-ai 命名凭据路线缺凭据时隐藏模型目录；
- 其余：`ui-secret-mask` 新包（发送用户文本中的凭据遮蔽，`a93958c7d0`）、`harness-dev-context` + `ctx.webApp` 缝（web 行公告单一 GUI URL）、`--from-default-profile` 改为**替换已存在 profile**（含 node_modules/patch 全删）、桌面字号快捷键占用组合键、sdk-minimal 增 `read_image` + 自动压缩、custom primary-runtime Python 别名须直指 sibling 解释器、Web 响应式页头与终端双工输入、badge skill 内置功能预览。

---

## 版本序列定位

```
dsh-v0.2.1-alpha.2   ← 上版（d743267388，2026-10-09，PR #5946）
    │
    │  ←─ 本次变更（852 commits：673 非 merge + 179 merge，5 天）
    ▼
dsh-v0.2.1-alpha.3   ← 当前版（2fbf4359b8，2026-10-14，PR #6234）
```

> a.2 → a.3 之间无中间 tag。模块级基线沿用 0.2.0-rc.1 分析，本目录不重复编号文档——逐主题证据见 [diff-vs-0.2.1-alpha.2.md](diff-vs-0.2.1-alpha.2.md)。
> **规模对比**：a.1 是 266 提交 / 4 篇指南；a.2 是 669 提交 / 20 篇指南；a.3 是 852 提交 / 14 篇指南——指南密度回落，但**三处契约换代 + 一批客户端导出符号删除都落在"必须动代码"一侧**，本版是 0.2.1 线"具名导出成批消失"的开端。

---

## 主要变更分组

| # | 变更族 | 规模 | 一句话 |
|---|--------|------|--------|
| 1 | **Remote 访问 RBAC** | ~30 commits | 新包 `api/remote-access` + 新缝 `ctx.remoteAccess`；typert Remote 统一定义 + 方法/事件资源声明；principal 入消息源；client hooks；撤销丢缓冲 |
| 2 | **CUA 桌面操作** | 204 commits | 新包 `experimental/cua` + `cua-macos`；像素映射/相对坐标、系统指针 hover、无激活恢复、共享原生 helper |
| 3 | **客户端契约换代** | ~30 commits | 删 `OperatorPeer`/`projectUserText`/`UserTextReferences`/`RenderMessageImages`/`TURN_PROCESS_INDEPENDENT_KINDS`/`TerminalAttachmentId`；images 槽拆分；+5 新槽 |
| 4 | **持久化/PTC 打磨** | 76 commits | JSONL 命名空间插件化 + listing 并发上限（`6aa157a05a`）；PTC replay 记录 job 生命周期；工作区文件资源声明 |
| 5 | **JobId 换代** | ~11 commits | `<kind>-<short-uuid>`；删 `executionId`；wait 语义与文档修正（`61fa9c0bab`）；持久化承认 `job-session-lifecycle` |
| 6 | **子代理 preset 组装** | ~7 commits | `persona`/`toolFilter` 拒绝；`agentPreset` + `allowedAgentPresets`；fork 继承；spawn 选/恢复 preset（`a9afe76200`）；头带排序（`a6207eae63`） |
| 7 | **Web/桌面 UI** | 62+20 commits | 响应式页头（窄宽 reflow）、字号快捷键联调、终端双工输入、侧栏水位折叠、移动端键盘默认收起、新会话选项槽（`3f1d5dfcfa`） |
| 8 | **凭据与账号** | ~15 commits | 存储凭据优先（`5249d9a4ce`）+ `ui-secret-mask` 新包；DeepSeek 账号 watch/目录/隐藏三连；`credentials-local` 未知键宽容（`8e413612c8`） |
| 9 | **插件管理/HMR** | ~8 commits | `already-installed` 拒绝；重组期替换（`879ad372ac`）；config watcher 排除无关文件（`be7d58308c`）；badge 内置功能预览（`7fcaf07051`） |
| 10 | **LLM/pi-ai** | ~25 commits | pi-ai 1.1.0 + Azure 更名（`d79f13a4d7`）；带凭据路由凭据前隐藏模型；账号列表加载日志（`3a0f4976ad`） |
| 11 | **CLI/部署** | ~10 commits | `--from-default-profile` 替换语义；desktop 保留包手工 dispatch（`60084a5b59`）/COS 审批流（`d156ee31a0`）；worktree `GIT_NO_LAZY_FETCH`（`b0414b8a98`） |
| 12 | **SDK** | ~5 commits | 显式持久化 session resume（`0bec9479ae`）+ resume 确认简化（`b1d5671038`）；JSONL 导入形态跟改（`98229a47ea`） |
| 13 | **门禁/vendor** | ~20 commits | vendor 列车（cordis 4.0.5-alpha.2 等，`7c8cbea696`）；Agent Teams 可禁 interrupt 工具（`ecafa412ac`）；agent-team 快照刷新 |

（逐主题 diff 与提交号见 [diff-vs-0.2.1-alpha.2.md](diff-vs-0.2.1-alpha.2.md)。）

---

## Breaking Changes 与行为风险

**兼容性闸门（`plugin-compatibility.ts`）、settings 核心、vendor cordis/schemastery 内容、HMR `package-manifest.ts` 本段零 diff；`SESSION_FORMAT_VERSION` 保持 4。** 危险度按"是否要求插件/配置动手"分级：

### 官方升级指南级 breaking（必做或引用即炸）

| # | 变更 | 影响对象 | 危险度 |
|---|------|----------|--------|
| 1 | **JSONL 持久化插件化**：`dsh-session-persistence-jsonl` 无默认导出；直接构造/继承/`instanceof`/类类型标注失效 | 自己构造持久化类或默认导入的消费代码 | 🔴 有必做项 |
| 2 | **JobId 换代**：`<kind>-N` → `<kind>-<short-uuid>`；生命周期记录删 `executionId`；`JobExecutionId` 导出移除 | 解析 job id 形状、按 kind+序号拼 id、消费 SDK 生命周期事件对的插件 | 🔴 有必做项 |
| 3 | **子代理 `persona`/`toolFilter` 拒绝**：配置键删除，`SubagentStartRequest`/能力声明同步删；spawn 改 `agentPreset` | 写过这两键的 profile patch/自定义 preset；程序化调用方 | 🔴 有必做项 |
| 4 | **`installBundle` 对已安装包报 `already-installed`**（HMR 运行时）；穷尽 switch `ManagementError['code']` 需补分支 | 包装插件安装 API 的自动化；agent `plugin_manager` 工具消费者 | 🔴 引用即失败 |
| 5 | **凭据优先级反转**：存储 `refs` > 导出环境变量；`headless` 默认禁存储 | 依赖 env 覆盖存储凭据的部署；headless 自动化 | 🔴 行为换代 |
| 6 | **非页面 Connection 默认 `interactions:'none'`**：`$events`/`$on()`/`$stream()` 不再提供 | 用 SDK/CLI 建 Connection 并订阅事件的插件与脚本 | 🔴 有必做项 |
| 7 | **user-text API 换代**：`projectUserText()`/`UserTextReferences` 删除，改 `UserTextRun`/`ReferenceChip` 组件 | 自渲染用户消息引用的客户端插件 | 🔴 有必做项 |
| 8 | **images 契约换代**：`RenderMessageImages` 删；槽 `conversation.message.images` → `conversation.chat.message.images` + `conversation.chat.user.images` | 注入 images 槽/读契约类型的客户端插件 | 🔴 有必做项 |
| 9 | **DeepSeek 账号路由不再收 `models` 目录**：残留字段**加载即停**；改 `modelOverrides`；`watch` 默认不通知 Platform 身份变化 | 自注册 DeepSeek 账号路由/watch 身份变化的插件；profile patch | 🔴 引用即失败 |
| 10 | **pi-ai Azure 路由更名** `azure-openai-responses`→`azure` | 路由 id 硬编码的配置与选型 | 🔴 引用才炸 |
| 11 | **`--from-default-profile` 替换已存在 profile**（原为拒绝） | 重复执行该命令的脚本/快捷方式 | 🟡 脚本行为 |
| 12 | **桌面字号快捷键占用组合键** | 曾注册同组合自定义快捷键的插件 | 🟡 冲突才有感 |
| 13 | **custom primary-runtime Python 解释器别名须支持目录迁移**（指南 `primary-runtime-python-aliases`） | 自定义 runtime payload | 🟡 引用才炸 |
| 14 | **sdk-minimal 默认清单加 `read_image` + 自动压缩** | 锁定旧默认清单行为的集成 | 🟢 默认组合变化 |

### 非指南级观察点

| # | 变更 | 影响对象 | 危险度 |
|---|------|----------|--------|
| 15 | slot 目录换代：**+5 槽**（`conversation.chat.message.images`/`conversation.chat.user.images`/`conversation.hero.options`/`conversation.user.text.node`/`workspace.toast`）、**−1 槽**（`conversation.message.images` 改名进 chat 家族） | 注入旧 `conversation.message.images` 的客户端插件（注入名失效不报错、渲染消失） | 🔴 槽名换代 |
| 16 | `connection` 删 `OperatorPeer` 导出（`operator-peer.ts` 消失）；`terminal-controller` 删 `TerminalAttachmentId`；`ui-chat` 契约删 `TURN_PROCESS_INDEPENDENT_KINDS`（注意：符号扫描曾报的 `WorkspaceTypertGenerator` 删除系**误报**——其实现移 `workspace.ts` 后仍由 index 再导出，无断裂） | 深引这些具名符号的插件/测试 | 🔴 引用才炸 |
| 17 | `app-boot` index 收口：`readProfilePatches`/`resolveTelemetryPatch`/`addHarnessSourceSection`/`HARNESS_SOURCE_SECTION` 不再自 index 导出 | 引 app-boot 内部面的脚本 | 🟡 内部面 |
| 18 | 新缝 `ctx.remoteAccess`（core）与 `ctx.webApp`（web-app bundle 行） | 只增不改，无迁移义务 | 🟢 增量 |
| 19 | typert Remote 定义统一 + 惰性 method info（`efdaa86fb8`）；`Remote/RemoteScope/TypertCodec` 形状换代 | 用 typert 声明 Remote 的一方：随 RBAC 需要改形状 | 🟡 有则核 |
| 20 | CUA 双包（`experimental/cua`/`cua-macos`）与 `ctx.computerUse` 扩容 | 消费桌面操作 API 的插件 | 🟢 增量 |
| 21 | `ui-secret-mask` 发送文本凭据遮蔽；导出格式常量与方法 | 展示用户原文的 UI 插件（视觉口径变化） | 🟢 行为 |
| 22 | HMR 重组期替换包文件已变的插件（`879ad372ac`） | 覆盖安装流程（配合 #4） | 🟢 改善 |
| 23 | 持久化 2 条同版本加性承认（job-session-lifecycle / user-rpc-principal）；`historical-formats/` 档案目录 | 旧构建读含新事件日志会被拒（老规则不变） | 🟡 读取侧 |
| 24 | vendor 列车：cordis 4.0.5-alpha.2 / schemastery 3.18.5-alpha.2（仅版本号 bump） | 钉死 vendor 版本的策略 | 🟢 版本层 |
| 24b | `boot/hmr` 内部重构（`src/index.ts`/`module-files.ts`/`watch-config.ts` +测试，本段 settings/hmr 目录 19 files +2027/−83 的主体）：watcher 排除无关文件、重组期替换等宿主内部面——未触及插件契约（settings src 与 `package-manifest.ts` 确实零 diff） | 依赖 HMR 重载时序的覆盖安装流 | 🟡 内部面 |

> **a.1/a.2 的风险表在本版仍逐条成立**，本版是其上叠加。升级 0.1.7→0.2.x 总迁移仍以 `plugin-framework/v0.2.0-migration.md` 为主文档；0.2.1 线逐段见各版本目录。

---

## 阅读路径

- 只想知道"我的插件要不要改"：[plugin-migration-guide.md](plugin-migration-guide.md)（结论：**JSONL 持久化消费 / JobId 解析 / 子代理 persona-toolFilter 配置 / installBundle 自动化 / interactions 订阅 / 客户端契约符号（user-text·images·OperatorPeer）六类有必做项**；纯 settings/skill/locale/peer 面多数插件零改）
- 想知道"这 852 个提交都干了什么"：[diff-vs-0.2.1-alpha.2.md](diff-vs-0.2.1-alpha.2.md)
- 按 Feature/Fix 过一遍：[CHANGELOG.md](CHANGELOG.md)
- 官方升级指南 14 篇（目录代际滞后挂 a.1/a.2/rc.2 名下）：`docs/upgrade-guide/`，逐篇要点已并入上方 Breaking 表
- 能力缝增删：`ctx.remoteAccess` + `ctx.webApp`，0 删除
