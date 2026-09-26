# DeepSeek Harness 项目架构总览（v0.1.7-rc.1）

> **快照基准**：tag `dsh-v0.1.7-rc.1` = `46a7f68b0922371ce7144b668b90e377d8e799f4`（2026-09-23）
> **对比上版**：`dsh-v0.1.6-alpha.1` = `0a15e36e7f`（2026-09-15），2504 commits
> **跨版基线**：`dsh-v0.1.5-rc.2` = `fb2c4b9e69`（2026-09-10），3304 commits
> **权威上游文档**：`docs/architecture.md`（本版改动 +348/-182，含 3 个文件）

---

## 项目身份卡片

| 项 | 值 |
|---|---|
| 项目名 | DeepSeek Harness（`@deepseek-ai/dsh-root`） |
| 版本 | `0.1.7-rc.1` |
| 框架基座 | Cordis（vendored，`vendor/` 为 pinned 源码副本，`private: true`） |
| 包命名 | `@deepseek-ai/dsh-<name>`，`packages/<group>/<pkg>/` |
| 模块制式 | ESM 全局（`"type": "module"`） |
| Node 要求 | `^22.19 \|\| >=24` |
| 包管理器 | pnpm workspaces |
| 顶层包分组 | **54**（上版 52） |
| `package.json` 总数 | **344**（上版 315；跨版基线 297） |
| 应用 | `apps/cli`、`apps/web`、`apps/desktop`、`apps/desktop-host` |
| 会话格式 writer | `SESSION_FORMAT_VERSION = 4` |
| 已发布会话格式记录 | `latestReleasedVersion: 3`（evidenceTag `dsh-v0.1.5-alpha.1`） |
| 文档英文 md | 176 篇（上版 167） |
| 语言 | 文档三语：en / zh / `.i18n.yaml` |

---

## 一、总览文件树

```
deepseek-harness/
├── .agents/                 # Agent 工作流与决定记录
│   ├── notes/               #   Agent Notes（RFC 式决定记录）
│   │   ├── implemented/     #     已落地（描述当前事实，现在时）
│   │   ├── proposed/        #     提案（尚未落地）
│   │   ├── rejected/        #     已否决
│   │   └── archived/        #     冻结历史（永不编辑、不作当前权威）
│   └── skills/              #   可复用工作流与专项判定标准
├── .artifacts/              # 构建/发布中间产物
├── .claude/                 # 第三方 Agent 适配
├── .dsh-build/              # 本地构建输出
├── apps/
│   ├── cli/                 # 唯一受支持的 Node 应用启动器
│   ├── web/                 # Web 应用（Vite 入口 + 浏览器测试）
│   ├── desktop/             # Electron 桌面应用（携带精确 dsh 生产运行时）
│   └── desktop-host/        # 私有 Desktop Host（Electron Node 模式）
├── benchmarks/              # 性能门禁
├── docs/                    # 文档（176 篇英文 md，三语配对）
│   ├── subsystems/          #   每子系统一页参考（60+ 页）
│   ├── persistence-changes/ #   持久化类型变更 acknowledgement + schema
│   │   ├── finalized/       #     已敲定兼容基线检查点（v4.json）
│   │   └── historical-formats/  # 历史格式 schema（v0/v1/v2 起于 0.1.6，本版 +v3）
│   ├── cookbook/            #   编号步骤的 how-to
│   ├── cordis-api/          #   Cordis 核心 API（生成）
│   ├── cordis-tutorial/     #   Cordis 教程
│   ├── postmortem/          #   事故复盘（唯一允许叙事体的层）
│   ├── user/                #   产品面向指南（文档站发布）
│   └── i18n/                #   三语术语与配对工作流
├── native/                  # @deepseek-ai/node-addon-system 源码
├── packages/                # 54 个分组（见 §2.2）
├── patches/                 # 依赖补丁
├── python/                  # Python SDK / runtime
├── scripts/                 # 门禁与生成器
├── snapshots/               # keyless 录制会话回放（acp / sdk / session / web）
├── vendor/                  # 供应商源码副本（pinned）
└── website/                 # VitePress 文档投影
```

---

## 二、文件简洁对照表

### 2.1 顶层目录对照

| 目录 | 职责 | 本版变化 |
|---|---|---|
| `packages/` | 全部 DSH 包（54 分组 / 344 个 package.json） | 新增 2 分组、29 个 package.json |
| `apps/` | 四个可执行应用 | `desktop` 变更 414 处，成为主力 |
| `docs/` | 文档即契约 | +9 篇 md（含 5 篇子系统页） |
| `.agents/notes/` | 决定记录 | 区间新增 165 篇英文 note |
| `snapshots/` | keyless 回放 | `session` 变更 149 处、`web` 154 处 |
| `python/` | Python SDK / runtime | 有改动：`sdk-runtime` 安装期资源校验 + Office sidecar + `node:sea` 引导；**`python/sdk/src` 零改动**（"定向客户端" note 仍是 `proposed`，见第 11 篇 §11.9.1） |
| `native/` | Node addon 源码 | 有改动 |
| `scripts/` | 门禁与生成器 | 有改动（如 `verify-application-entrypoints.ts`） |
| `website/` | VitePress 投影 | 有改动 |

### 2.2 `packages/` 分组对照（54 组）

分组与官方定位（取自仓库根 `AGENTS.md` 的 Repository layout），括号内为本版包数：

| 分组 | 官方定位 | 包数 |
|---|---|---|
| `core` | agent / session API | 8 |
| `api` | remote BFF | 9 |
| `typert` | type graphs | 4 |
| `llm` | model providers | 7 |
| `shell` | command execution | 10 |
| `subprocess` | child-process management | 3 |
| `ssh` | SSH execution providers | 4 |
| `terminal` | persistent terminals | 3 |
| `ptc-runtime` | PTC execution | 2 |
| `sandbox` | process confinement | 4 |
| **`deliverables`** | **turn deliverables**（本版新增） | **2** |
| `fs` | filesystem access | 7 |
| `lsp` | language servers | 3 |
| `skill` | skill loading | 6 |
| `web` | search / fetch tools | 6 |
| `computer-use` | computer interaction | 1 |
| `browser-use` | browser interaction | 1 |
| `compaction` | context compaction | 5 |
| `context` | request context | 6 |
| `subagent` | delegated agents | 10 |
| `jobs` | background jobs | 3 |
| `bundle` | profile bundles | 6 |
| `workflow` | workflow execution | 4 |
| `webhook` | webhook ingress | 2 |
| `todo` | todo_write tool | 1 |
| `plan` | logged planning | 1 |
| `goal` | session goals | 4 |
| `schedule` | scheduled follow-ups | 1 |
| `preset` | agent composition | 3 |
| `guard` | loop / tool guards | 2 |
| `extensions` | runtime self-modification | 4 |
| `hooks` | Claude Code / Codex bridges | 3 |
| `session` | durable sessions | 20 |
| `session-query` | browsing / search / export | 4 |
| `attachment` | binary attachments | 2 |
| `spill` | output spill | 3 |
| `storage` | non-session storage | 4 |
| `workspace` | workspace entities | 1 |
| `feedback` | human feedback | 2 |
| `identity` | anonymous identity | 1 |
| `settings` | user settings | 1 |
| `credentials` | credentials / authorization | 5 |
| `acp` | automation-only ACP | 1 |
| `interaction` | human interaction | 5 |
| `boot` | application boot | 5 |
| `sdk` | JSON-RPC SDK | 3 |
| `host` | GUI host | 9 |
| `client` | GUI client | **59** |
| `mcp` | external tools | 2 |
| **`document`** | **document conversion**（本版新增） | **1** |
| `experimental` | pre-stable prototypes；默认公开，显式例外为私有 | **20** |
| `test-support` | test infrastructure | 7 |
| `runtime-diagnostics` | runtime invariants | 1 |
| `util` | zero-dependency utilities | 16 |

> **`client` 59 包是本版绝对重心**（跨版累积变更 1602 处）。GUI 侧的分组内包数远多于其他分组，是因为客户端把每个 UI 关注点（`ui-chat`、`ui-theme`、`ui-settings-*`、`ui-sidebar-*`……）都拆成独立可替换包。

### 2.3 依赖纪律（本版再次收紧）

本版新增/强调的边界规则（均有 note 或门禁背书）：

| 规则 | 依据 |
|---|---|
| workspace 依赖分段：DSH 包用 `workspace:*`，vendor/native 用 `workspace:~` | note `2026-09-22-workspace-release-ranges.md` |
| 禁止新增到 `unknown` 的断言（`as unknown` / `<unknown>`）；只允许保持或降低既有基线 | note `2026-09-19-no-unknown-casts.md` |
| 只有 `dsh` profile 能启动受支持的 Node 应用；package bin / demo / SDK argv 逃逸被禁止 | `docs/architecture.md` + `scripts/verify-application-entrypoints.ts` |
| 扩展要求 DSH peer 版本范围被声明**并被强制校验** | `apps/cli/README.md` |
| `Source plane` 与 `artifact plane` 永不混用 | 仓库 `AGENTS.md` |
| 空 `catch` 必须点名错误与原因，且 `try` 只允许一条语句 | 仓库 `AGENTS.md` |

---

## 三、文字详解

### 3.1 项目定位（未变）

DeepSeek Harness 是**全插件（all-plugin）的 Cordis agent harness**：产品模型的每一部分——模型适配器、工具注册表、会话日志、乃至 agent 循环本身——都是插件，因此每一项都可从配置中替换。**没有特权内核可以打补丁**：扩展 dsh 的方式是在其他插件旁挂载一个插件，而注册是**可逆 effect**，插件卸载时自动回卷。

本版官方 `docs/architecture.md` 保留并强化了这一表述，并在开头新增一句指引：**"Read this before changing anything under `packages/`"**。

### 3.2 分层架构（自底向上，本版修订）

```
┌──────────────────────────────────────────────────────────────────────┐
│ 应用层                                                                │
│  dsh CLI（唯一受支持的 Node 应用启动器）                              │
│  Web（packages/web + apps/web + packages/client 59 包）               │
│  Desktop（Electron，携带精确 dsh 生产运行时，独占 profiles/desktop）   │
│  ACP / SDK（stdio 服务，长连接内不可热替换服务）                       │
├──────────────────────────────────────────────────────────────────────┤
│ 组合层                                                                │
│  profile（$DSH_HOME/profiles/<name>）：dsh.profile.bundles 有序列表   │
│  bundle：dsh.bundle.patch（本版起可为有序文件列表）                    │
│  层序：各 bundle → profile 补丁 → home 补丁 → --patch overlay         │
├──────────────────────────────────────────────────────────────────────┤
│ 接缝层（capability seams）                                            │
│  Service Definition / Service Provider / Consumer 三角色              │
│  本版新增：officeToPdf / workspaceChanges / speechToText /            │
│           speechController / pluginManager / pluginRegistryProbe /    │
│           configEditor / hmr / profileContext / connection /          │
│           productTelemetry / deepseekAccount / jobController          │
├──────────────────────────────────────────────────────────────────────┤
│ 主干层                                                                │
│  core（agent / session / tools / system-prompt / scope）              │
│  session（20 包，含 v0→v1 … v3→v4 逐级迁移边）                        │
│  llm（7 包，Messages-only 收敛）                                      │
├──────────────────────────────────────────────────────────────────────┤
│ 执行世界层                                                            │
│  fs / shell / subprocess / terminal / ssh / ptc-runtime / sandbox     │
│  本版新增：Windows ACL 强制完整性隔离、sandbox same-mode              │
├──────────────────────────────────────────────────────────────────────┤
│ 框架层                                                                │
│  vendor/（pinned Cordis 源码副本）                                    │
└──────────────────────────────────────────────────────────────────────┘
```

**本版对分层的两处结构性修订**（`docs/architecture.md` 新增段落原文要点）：

1. **应用启动被明确收口**：官方新增 "Application launch" 段，规定"Supported Node applications launch through named `dsh` profiles"，并列举 shipped profiles 为 `web`、`headless`、`sdk`、`sdk-minimal`、`acp`；明确 **vendored CLI、仅构建/仅测试的可执行文件、进程内直接挂载插件以及私有浏览器 WebWorker 预览都不是 Harness 应用启动器**。
2. **桌面端被升为一等部署形态**：官方新增 "Desktop application" 段，规定 Electron 应用在**签名资源**中携带精确 dsh 生产运行时、独占保留的 `$DSH_HOME/profiles/desktop`，且**公共 CLI 不能管理 Desktop 的 profile**。

### 3.3 工程治理体系（本版显著加强）

本版最值得单独提出的是**文档与持久化契约的体系化**：

| 机制 | 载体 | 本版变化 |
|---|---|---|
| 一个事实一个家（分层税制） | `docs/AGENTS.md` | 修订；明确 12 个层的职责与"不属于本层"的内容 |
| 持久化类型变更 acknowledgement | `docs/persistence-changes/*.md` + `.schema.json` | 新增 3 篇 + `historical-formats/` 体系 + `finalized/v4.json` |
| 会话格式版本与发布状态 | `docs/session-format-status.md` | 新增 `latestFinalizedVersion: 4`（发布记录仍为 3） |
| 决定记录（RFC 式） | `.agents/notes/**` | 区间新增 165 篇英文 note + 对应 zh / i18n |
| 文档门禁 | `pnpm run doc-sync` / `test:docs` | 含 `verify-doc-budgets`、`verify-md-wrap`、`verify-md-links`、`verify-type-equiv`、`verify-client-ui-i18n` |
| 应用启动门禁 | `scripts/verify-application-entrypoints.ts` | 把每个 package bin、可执行源码、根 demo 与根 `start:web`/`dev:web` 归入显式类别 |
| 许可证/来源纪律 | 禁止在维护文件中出现真实 commit 标识与不允许的组织 URL | 仓库 `docs/AGENTS.md` |

### 3.4 值得注意的设计约束（本版新增）

| 约束 | 原文要点 | 影响 |
|---|---|---|
| **公开面收窄优先于兼容垫片** | `DshManifest` 连续两版收窄：0.1.6 引入 `DshPackageManifest`，0.1.7 把 `configTrees` / `sessionFormatMigration` / `moduleFallback` 从公开类型移出 | 内部机制**不承诺**外部可依赖 |
| **`@deepseek-ai/dsh*` peer 范围从声明变强制** | 安装期/启动期 reader 已存在（`packages/boot/app-boot/src/plugin-compatibility.ts`）；**`engines.dsh` 仍不被读取**（`app-boot/README.md:52`、`package-manifest/README.md:93` 原文直证） | DSH 兼容性要声明在 `peerDependencies`，而不是 `engines` |
| **配置取代独立设置库** | "One owner": Loader 已解析的 Config 同时承担校验、默认值、持久化与通知 | 消灭"第二份真相"（两套 schema / 默认值 / 持久化 / 通知） |
| **`Model-visible ⟺ logged` 仍是硬不变量** | 任何到达模型请求的内容都必须可从会话日志重建；运行时 invariant 断言它 | 插件新增模型可见输入**必须**新增会话事件 |
| **注册即 effect** | 每个 contribution 走 `ctx.effect()` / `ctx.on()`；`register()` 返回 disposer | HMR 安全性的基础 |

### 3.5 v0.1.7-rc.1 版本特性

按影响面排序的四条主线：

1. **持久化跃迁 V4**：`SESSION_FORMAT_VERSION` 3 → 4；tool role 结果一等化（必需 `toolCallId`、可选 `isError`）；生产者自有 source 取代已发布插件包装器；新增 `developer/message` 事件；`turn/end.reason` 新增 `forked`。迁移包 `packages/session/session-format-v3-to-v4/` 为本版新增。
2. **插件契约换代**：`dsh.bundle.patch` 支持有序文件列表（PR #4722）；`dsh.profile.patchReload` 移除；**`@deepseek-ai/dsh*` 的 peer 范围**强制校验 + `version-exemptions`/`allow-version`/`revoke-version`（`engines.dsh` 仍不校验）；插件自有本地化显示元数据（`locale/<lang>.json` 的 `meta`）。
3. **设置机制换代**：全局 `$DSH_HOME/settings.yaml` 移除（一次性导入为 `.imported`）；`settings.installSection()` **彻底删除**（0.1.5-rc.2 与 0.1.6-alpha.1 各 15 处引用，本版 0 处）；改为 Config `.volatile()` 字段 + `settings.configure({ auto }, fiber)`。
4. **两个新顶层能力族 + 一个实验族**：`packages/deliverables`（`tool-present`、`workspace-changes`）、`packages/document`（`office-to-pdf`）、语音输入 5 包（experimental）。

### 3.6 版本演进对比

| 维度 | `0.1.5-rc.2` | `0.1.6-alpha.1` | `0.1.7-rc.1` |
|---|---|---|---|
| 包分组 | 50 | 52 | **54** |
| `package.json` | 297 | 315 | **344** |
| `SESSION_FORMAT_VERSION` | 3 | 3 | **4** |
| 新增能力族 | — | ssh / ptc-runtime / browser-use / computer-use | **deliverables / document** + 语音（实验） |
| 退役 | — | e2b / code-runtime | — |
| 设置机制 | 独立设置库 + `installSection` | 同 | **Config 驱动 + `configure`** |
| 会话格式迁移包 | v0→v1 / v1→v2 / v2→v3 | 同 | **+ v3→v4** |
| 插件清单 | `patch: string` | + `DshPackageManifest` | **`patch: string \| string[]`**、`@deepseek-ai/dsh*` peer 强制、本地化显示 |
| HMR 包名 | `cordis-plugin-hmr` | 同 | **`dsh-hmr`** |
| profile 热重载 | `patchReload` | 同 | **YAML 内 `dsh-hmr` 行** |
| 客户端模块 rev | 内容哈希 | 同 | **mtime/ctime/size** |
| 文档英文 md | — | 167 | **176** |
| 桌面端 | 附带 | 打包与更新 | **强制更新 / 安装器 / webview / 崩溃报告** |

### 3.7 本版"下一步"信号（proposed，未实现）

`.agents/notes/proposed/` 中的条目**不是当前权威**，但可作为下一版走向的前瞻信号。本版区间内 `proposed/simplification` 变更 30 处、`proposed/feature` 14 处，其中与本版主线直接相关的是：

| note | 状态 | 主题 |
|---|---|---|
| `.agents/notes/proposed/simplification/2026-09-19-config-only-hmr.md` | **proposed（未实现）** | 把 HMR 进一步收敛为"仅配置"。**注意**：`docs/architecture.md` 已描述 base 启用 config-only `dsh-hmr` 的**行为**，但该 note 本身仍是提案，不要把提案内容当作已落地事实 |

> **读法提醒**：判断某个 note 是否已落地，唯一可靠方式是看它位于哪个目录（`implemented/` vs `proposed/`），而不是看它是否在新版本区间内被修改。

---

## 附录：下钻路线图

| 你想了解 | 去哪一篇 |
|---|---|
| 启动器、profile 解析、实时配置 | `01-cordis-framework.md` |
| agent 循环、tool role 消息、tool-call 三阶段（**实为客户端侧**，第 02 篇含边界澄清） | `02-core-product.md` |
| shell / 子进程 / 终端 / SSH | `03-shell-capabilities.md` |
| LLM 适配器、Messages-only、typert、凭证 | `04-llm-typer.md` |
| fs / sandbox / ptc-runtime / spill / jobs | `05-execution-world.md` |
| 会话格式 V4、projection、compaction | `06-memory.md` |
| 子代理、Agent Teams、workflow | `07-multi-agent.md` |
| 审批、权限、设置、技能、计划 | `08-human-agent-governance.md` |
| **插件清单、安装、注册表、扩展席位** | **`09-plugin-system.md`** |
| GUI 与桌面端 | `10-gui-frontend-backend.md` |
| 协议、远端双工流、SDK、MCP | `11-protocol-sdk.md` |
| 文档体系、持久化评审、发布、遥测 | `12-engineering.md` |
| 浏览器 / 桌面操作 / 语音 | `13-browser-computer-and-voice.md` |
| **交付物与 Office 文档栈** | **`14-deliverables-document-office.md`** |
| 跨两版累积差异 | `diff-vs-0.1.5-rc.2.md` |
| 变更要点总表 | `CHANGELOG.md` |
| 迁移动作清单 | `plugin-migration-guide.md` |

---

*本文档基于 `dsh-v0.1.7-rc.1` 检出快照与官方 `docs/architecture.md`、仓库根 `AGENTS.md`、`docs/AGENTS.md` 编写。*
