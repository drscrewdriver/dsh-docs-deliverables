# DeepSeek Harness 项目架构总览（v0.1.6-alpha.1）

> 生成日期：2026-09-17 ｜ 分析对象：`E:\test\rewrite-agently\deepseek-harness`（tag `dsh-v0.1.6-alpha.1` = `0a15e36e7f`）
> 说明：本文档为"总览层"。与 rc.2 版总览的差异集中在 **包规模、分组增删、新能力族与工程闸门**，其余稳定事实沿用。

---

## 项目身份卡片

| 项 | 内容 |
|---|---|
| 名称 | DeepSeek Harness（`dsh`） |
| 出品方 | DeepSeek AI |
| 定位 | 开源 Agent 运行时框架（harness） |
| 核心理念 | **一切皆插件**：模型适配器、工具注册表、会话日志、Agent 主循环都是平级插件，可从配置层面整体替换 |
| 底层框架 | 内置（vendored）的 Cordis 插件框架 |
| 版本 / 许可 | v0.1.6-alpha.1（developer preview）/ MIT |
| 技术栈 | TypeScript（strict，全仓 ESM）、pnpm workspace、Node ^22.19 \|\| >=24、Vite + React（前端）、Python（SDK）、Cordis |
| 规模 | **52 个包分组** ｜ 314 个 `package.json` ｜ 4 个应用 |
| 会话格式 | `SESSION_FORMAT_VERSION = 3`（本版**未**跃迁） |
| 本版主要变更 | 新增 ssh / ptc-runtime / browser-use / computer-use 四个能力族；退役 e2b 与 code-runtime；三个默认值收敛 |

**与上一版（v0.1.5-rc.2）的坐标对比**

| 维度 | v0.1.5-rc.2 | v0.1.6-alpha.1 |
|---|---|---|
| tag commit | `fb2c4b9e69` | `0a15e36e7f` |
| 包分组 | 50 | 52（+4 / −2） |
| `package.json` 数 | 296 | 314 |
| `scripts/` 顶层条目 | 214 | 250 |
| GitHub workflows | 21 | 20 |
| `docs/subsystems/*.md`（英文篇数） | 54 | 58 |
| 提交数（相对上一版） | — | 800（含 250 merge） |

> 说明：以下文件树已排除 `node_modules/`、`.git/`、`lib/`（构建产物）等噪声目录；`packages/` 下每个包的标准布局为 `src/ + tests/ + package.json + tsconfig.json + tsdown.config.ts + README.md`，不再逐包展开。

---

## 一、总览文件树

```
E:\test\rewrite-agently\deepseek-harness\          # ★ 项目本体（pnpm monorepo）
├── apps\                                # 应用层（4 个，本版无增删）
│   ├── cli\                             #   dsh 命令行入口（profile 引导）
│   ├── web\                             #   Web GUI 前端（Vite + React）
│   ├── desktop\                         #   Electron 桌面端
│   └── desktop-host\                    #   桌面端主机服务
├── packages\                            # ★ 核心库：52 个分组
│   ├── core\                            #   产品 API 主干（agent / agent-loop / session / system-prompt / tools / scope）
│   ├── api\ typert\                     #   远程 BFF + 类型图
│   ├── llm\                             #   LLM 能力族（本版默认协议切换为 Messages）
│   ├── host\ client\                    #   Web GUI 服务端半区 / 浏览器半区（ui-* 插件）
│   ├── session\ session-query\          #   会话持久化数据面 + 检索
│   ├── subprocess\ ssh\ sandbox\        #   进程 / ★新增远端执行世界 / 进程约束
│   ├── shell\ terminal\ ptc-runtime\    #   Bash / 持久 PTY / ★PTC 执行（取代 code-runtime）
│   ├── fs\ lsp\ skill\ web\             #   文件系统 / 语言服务器 / Skill / Web 能力族
│   ├── computer-use\ browser-use\       #   ★新增：桌面交互 / 浏览器交互（仅注册点名）
│   ├── interaction\ guard\              #   人机协作 / 循环卫生
│   ├── compaction\ context\             #   上下文压缩 / 模型可见请求上下文
│   ├── subagent\ jobs\ workflow\ webhook\  # 多智能体面
│   ├── goal\ plan\ preset\ todo\ schedule\  # 目标 / 计划 / 预设 / todo / 定时
│   ├── bundle\ boot\ extensions\ hooks\ #   profile 层 / 启动胶水 / 自修改 / hook 桥
│   ├── mcp\ acp\ sdk\                   #   MCP / ACP / 进程外 SDK
│   ├── attachment\ spill\ feedback\ identity\ settings\ credentials\ storage\ workspace\
│   ├── experimental\ test-support\ runtime-diagnostics\ util\
│   └── README.md                        #   52 组权威分组表
├── vendor\                              # ★ 内置 Cordis 框架源码（本版无结构变化）
├── python\                              # Python SDK + 内置运行时
├── native\                              # 原生模块（Landlock 沙箱 node addon）
├── docs\                                # ★ 文档体系（本版新增持久化档案体系）
│   ├── subsystems\                      #   58 篇子系统参考（本版新增 5 篇、删除 1 篇）
│   ├── persistence-changes\             #   ★新增：持久化类型变更档案（含 JSON Schema 与历史格式）
│   ├── cookbook\                        #   操作指南（新增「评审持久化类型变更」）
│   ├── config-catalog.md tool-catalog.md module-graph.md 等  # 生成式目录（CI 保鲜检查）
│   └── persistence-schema.json  dependency-catalog.json     # ★新增生成物
├── scripts\                             # ★ 仓库闸门与生成器（250 个顶层条目）
│   ├── run-gates.ts                     #   CI 闸门编排入口
│   ├── verify-default-product-isolation.ts   # ★新增：默认产物与实验包隔离
│   ├── web-product-bundle-isolation.ts       # ★新增：Web 产物 Vite 边跟随
│   ├── verify-repository-references.ts       # ★新增：维护型仓库引用政策
│   └── release\                         #   发布流水线
├── snapshots\                           # 键无关的录制回放语料（acp / sdk / session / web）
├── website\                             # VitePress 双语文档站
├── .agents\notes\                       # ★ 设计决策记录（本版新增 70+ 篇）
│   ├── implemented\                     #   已落地：architecture / feature / bug-fix / process / simplification / testing
│   ├── proposed\                        #   ★新增 7 篇：会话存储重构等下一步方向
│   └── archived\                        #   冻结历史
├── .github\                             # CI/CD 与 issue 管理机器人（20 个 workflow）
├── benchmarks\ patches\                 # 性能基准 / pnpm patch
└── 根配置文件                            # package.json, pnpm-workspace.yaml, tsconfig*.json,
                                      #   vitest*.config.ts, tsdown.config.ts, lefthook.yml, AGENTS.md…
```

---

## 二、文件简洁对照表

### 2.1 顶层目录对照

| 目录 | 角色 | 本版变化 |
|---|---|---|
| `apps/` | 应用层 | 无增删（cli / web / desktop / desktop-host） |
| `packages/` | 核心库 | **50 → 52 组**；新增 ssh、ptc-runtime、browser-use、computer-use；移除 e2b、code-runtime |
| `vendor/` | 框架层 | 包集合不变（12 个条目），但**源码有实质改动**：13 files, +169/−542（净删除 373 行），集中在 `loader`（`config/entry.ts`、`group.ts`、`tree.ts`）与 `hmr`、`include` |
| `python/` | Python 生态 | SDK 投影需与 TS 侧保持一致（仓库规则） |
| `native/` | 原生层 | 无结构变化 |
| `docs/` | 文档层 | **新增 `persistence-changes/` 整棵目录**、`persistence-schema.json`、`dependency-catalog.json` |
| `scripts/` | 工具层 | 214 → 250 顶层条目；新增 3 个隔离/引用闸门，删除 `verify-vendored-links.ts` |
| `snapshots/` | 回放语料 | 本版为多个行为变化重录/手工整理 sidecar |
| `website/` | 文档站 | VitePress 双语站点 |
| `.agents/` | Agent 协作 | **新增 70+ 篇设计记录**（其中 7 篇为 proposed） |
| `.github/` | 工程化 | 21 → 20 个 workflow |

### 2.2 `packages/` 分组对照（52 组）

分组表以 `packages/README.md`（本版为权威来源）为准：

| 分组 | 角色 |
|---|---|
| `core/` | 产品 API 主干：会话、提示词、工具、agent 服务与具体循环 |
| `api/` | 远程 BFF 组装与 Typert RPC 网关 |
| `typert/` | 类型图生成、产物加载与运行时注册表 |
| `goal/` `schedule/` `feedback/` `identity/` | 同会话目标 / 会话内定时跟进 / 人类反馈 / 匿名身份 |
| `llm/` | LLM 能力族：抽象服务 + 提供者适配器 |
| `subprocess/` | 子进程能力族：Service Definition + 本地进程树提供者 |
| **`ssh/`** | **★新增**：POSIX 远端连接，配对的文件系统 / 子进程 / 沙箱提供者 |
| `shell/` | Bash 能力族：执行器缝、本地实现、面向模型的工具 |
| `terminal/` | 持久 PTY 能力族：按所有者作用域的会话 |
| **`ptc-runtime/`** | **★新增**：PTC 执行能力族（Service Definition + 受限 Node 提供者 + PTC 模式消费者） |
| **`computer-use/`** | **★新增**：独占式具名桌面提供者注册 |
| **`browser-use/`** | **★新增**：独占式具名浏览器提供者注册 |
| `sandbox/` | 进程约束缝：bwrap / Landlock / Seatbelt 后端 |
| `fs/` `lsp/` `skill/` `compaction/` `context/` | 文件系统 / 语言服务器 / Skill / 压缩 / 模型可见请求上下文 |
| `subagent/` `jobs/` `experimental/` `workflow/` `webhook/` `web/` | 子代理 / 后台任务 / 预稳定原型 / 工作流 / Webhook 入口 / Web 能力族 |
| `attachment/` `spill/` `todo/` `plan/` `preset/` `guard/` `bundle/` `extensions/` `mcp/` `hooks/` | 附件 / 输出溢出 / todo 工具 / 计划 / 预设 / 守卫 / profile 层 / 运行时自修改 / MCP / hook 桥 |
| `session/` `session-query/` | 持久会话数据面 / 会话检索族 |
| `settings/` `credentials/` `storage/` `workspace/` | 设置 / 凭据 / 非会话存储 / 工作区实体 |
| `sdk/` `acp/` `interaction/` `boot/` `host/` `client/` | 进程外 SDK / 仅自动化的 ACP 服务端 / 人机协作面 / 启动胶水 / GUI 服务端 / GUI 浏览器端 |
| `test-support/` `runtime-diagnostics/` `util/` | 测试设施 / 运行时诊断 / 零依赖工具 |

**发布期望**（`packages/README.md`）：多数分组是产品稳定 API；例外是 `experimental/`（无稳定性或支持承诺），以及 `test-support/`、`runtime-diagnostics/`、`util/`（支持性、较低兼容期望）。

### 2.3 依赖纪律（本版再次被强调）

> **扩展插件依赖 Service Definition，绝不依赖具体提供者。** `dsh-agent-loop` 可替换；UI、hook 与工具插件使用 `dsh-agent`。组合 bundle 可以依赖主干插件。能力缝在角色独立演进时分离 Service Definition / Service Provider / Consumer。

---

## 三、文字详解

### 3.1 项目定位（未变）

DeepSeek Harness 是 DeepSeek AI 开源的 **Agent 运行时**：把"模型 + 工具 + 记忆 + 沙箱 + 界面"组装成可运行 Agent 产品的框架。它没有"特权内核"——模型适配器、工具注册表、会话日志、Agent 主循环都是平级的 Cordis 插件，因此每个部件都可以用配置文件（`cordis.yml` patch 层）替换或叠加。

### 3.2 分层架构（自底向上，本版修订）

1. **框架层 `vendor/`**：Cordis 及其基础库以源码快照形式内置并重命名为 `@deepseek-ai/` 作用域。包集合本版未变，但 `loader` 的配置层（`config/entry.ts`、`group.ts`、`tree.ts`）与 `hmr`、`include` 有**净删除**的实质改动（13 files, +169/−542），对应"Loader 事务性回退被撤销"这条设计决策。
2. **核心库 `packages/`**：**52 组**。`core/` 仍是产品 API 主干——`dsh-session` 维护追加式会话事件日志（"模型可见 ⟺ 已记录"）；`dsh-agent-loop` 实现 turn/step 驱动循环；`dsh-tools` 提供带作用域、带守卫的工具执行管线。
3. **能力缝扩展**：本版把能力缝的"执行世界"从 3 种实现扩展到更完整的矩阵——
   - 进程与文件：`subprocess`（本地）、**`ssh`（远端，本版新增）**；
   - 代码执行：**`ptc-runtime`（本版取代 `code-runtime`）**，`e2b` 退役；
   - 人机之外的"设备交互"：**`browser-use` / `computer-use`（本版新增）**，两者的共享服务**只注册一个名字、拒绝第二个提供者**，且**不提供通用操作 API**。
4. **应用层 `apps/`**：4 个应用无增删；本版的重要变化在**启动解析机制**（见 3.5）。
5. **支撑层**：`python/`、`native/`、`snapshots/`（键无关回放语料）、`patches/`。

### 3.3 工程治理体系（本版显著加强）

- **文档即纪律**：`docs/` 维持严格层级（architecture → subsystems → cookbook → postmortem），大部分目录表由 `scripts/gen-*.ts` 从源码生成，CI 用 `verify-*.ts` 保证不漂移。本版新增 **`docs/persistence-changes/`**——把"持久化类型变更"变成逐条带 JSON Schema 与双语配对的公开档案，并配 `docs/cookbook/reviewing-persistence-type-changes.md`。
- **闸门脚本**：`scripts/` 顶层条目 214 → 250。本版新增三道结构性闸门：
  - `verify-default-product-isolation.ts`——从每个应用与 Python 运行时跟随依赖、解析别名、识别实验包，并读取运行时 import、安装态 bundle 列表、bundle patch、内置预设与声明的配置树，**用生产 patch 解析器与启动时同一个 patch 引擎**组合出有效行；
  - `web-product-bundle-isolation.ts`——跟随 Vite 实际输出边（含懒加载 chunk、worker、CSS 依赖与 assets）；
  - `verify-repository-references.ts`——维护型仓库引用政策。
- **Agent 原生开发**：`.agents/notes/` 本版新增 70+ 篇设计记录（含 7 篇 proposed），规格是"每条设计决策都要有 Problem / Decision / Alternatives considered / Consequences / Verification"。
- **CI/CD**：20 个 workflow（较上版少 1），含并行 macOS 公证与构建机备用腿等本版改动。

### 3.4 值得注意的设计约束（本版新增两条）

- **ESM 全仓**、**注册即副作用**（一切贡献经 `ctx.effect()` / `ctx.on()`，注册返回 disposer）、**快照测试文化**——三条沿用。
- 🆕 **会话历史不得被同步读取**：`Session.eventAt()` / `snapshotEvents()` / `ownEvents()` 已废弃，新代码禁止调用（细节见迁移指南）。
- 🆕 **包元数据的公共面与内部面分离**：`configTrees` / `sessionFormatMigration` / `moduleFallback` 属内部机制，不出现在公共 manifest 类型里。

### 3.5 v0.1.6-alpha.1 版本特性

本版是**能力面扩张 + 默认值收敛**。四个要点：

#### 3.5.1 新增四个能力族

| 能力族 | 形态 | 是否默认启用 |
|---|---|---|
| `ssh` | 用一条部署自有的 OpenSSH 连接提供**一个远端文件系统/进程世界**；实现**已有**的 fs / subprocess / sandbox API，**不引入 SSH 专属模型工具** | 否（需挂载提供者） |
| `ptc-runtime` | PTC 执行能力缝（`ctx.ptcRuntime`）；**取代 `code-runtime`** | 否（PTC 执行是可选的，不属于主干） |
| `browser-use` | 模型通过配置的后端**检查与操作网页**；DSH 拥有任务循环，提供者提供浏览器操作并在同一 Session 的多个 turn 之间保持浏览器状态 | 否（提供者为 experimental，需显式启用） |
| `computer-use` | 模型通过配置的提供者**观察与操作本地桌面**；上游实现名 **Cua Driver** | 否（同上） |

#### 3.5.2 包解析换代：不可变代际

profile 启动改为计算**一个不可变 `ResolutionGeneration`**，由同一个依赖遍历同时供给磁盘模块 fallback 与运行时解析；三种模式（`link` 默认 / `runtime` 由 pkg 与 Electron 强制 / `dual` 内部对比）。runtime 模式**不创建、不更新、不退役任何链接**，代际替换**只接受增量**且**只换一次引用**。

#### 3.5.3 三个默认值收敛

| 默认值 | 变化 | 依据 |
|---|---|---|
| `ralph` 工具 | 默认组合中 `disabled: true`（base + standard/ptc/cordis 预设；`ptc` 同时关闭 `workflow-ptc`） | `2026-09-12-ralph-off-in-shipped-defaults.md` |
| Session 日志上报 | `session-log-deepseek.Config.enabled` **默认 true** | `2026-09-14-session-log-upload-default.md` |
| DeepSeek 协议 | Cordis YAML `protocol` **默认 `messages`**；Web 仍走 Chat Completions | `2026-09-07-deepseek-messages-adapter.md` |

#### 3.5.4 GUI 面

侧栏终端（可启动、可选并记住 shell、跟随主题）、置顶折叠头、Mermaid 全屏查看器、归档会话恢复页、composer 引用预览、连接指示器精修；客户端侧另有 `RemoteMock` 取代浏览器夹具等无行为变更的结构重构。桌面端从 ASAR 运行运行时宿主。

### 3.6 版本演进对比

| 维度 | v0.1.0-rc.5 | v0.1.5-rc.2 | v0.1.6-alpha.1 |
|---|---|---|---|
| 应用层 | 2 个 | 4 个 | 4 个（无增删） |
| 包分组 | 49 组 | 50 组 | **52 组** |
| `package.json` 数 | 219 | 296 | **314** |
| `scripts/` 顶层条目 | ~100 | 214 | **250** |
| 会话格式版本 | 2 | 3 | **3（未变）** |
| 执行世界 | 本地 + E2B POC | 本地 + E2B POC | **本地 + SSH + PTC**（E2B 退役） |
| 设备交互 | 无 | 无 | **browser-use / computer-use** |
| profile 解析 | 磁盘物化 | 磁盘物化 | **不可变代际（runtime 模式不落盘）** |
| Agent 设计记录 | — | — | **新增 70+ 篇** |

---

## 四、本版"下一步"信号（proposed，未实现）

`.agents/notes/proposed/` 本版新增 7 篇，其中 5 篇构成一组**会话存储重构**提案，与本版"同步历史读取废弃"的方向一致：

| 提案 | 主题 |
|---|---|
| `2026-09-06-logical-session-storage-rebuild.md` | 逻辑会话存储重建 |
| `2026-09-10-session-capability-protocols.md` | 会话能力协议 |
| `2026-09-10-session-data-compatibility.md` | 会话数据兼容性 |
| `2026-09-10-session-developer-transition.md` | 会话开发者过渡 |
| `2026-09-10-session-refactor-faq.md` | 会话重构 FAQ |
| `2026-09-14-composer-model-and-draft-editor.md` | composer 模型与草稿编辑器 |
| `2026-09-08-desktop-uninstall-preserve-dsh-home.md` | 桌面端卸载保留 `DSH_HOME` |

> 阅读时不应当把这些当作已交付能力——它们只是**已立项的方向**。

---

## 附录：下钻路线图

本版模块文档与 rc.2 保持同一套编号（01–08、10–12），并新增一篇覆盖本版全新的两个能力族：

| # | 文件 | 主题 |
|---|---|---|
| 01 | [01-cordis-framework.md](01-cordis-framework.md) | Cordis 框架层 / 启动与 profile 解析 |
| 02 | [02-core-product.md](02-core-product.md) | Core 产品主干 |
| 03 | [03-shell-capabilities.md](03-shell-capabilities.md) | Shell / 子进程 / 终端 / SSH |
| 04 | [04-llm-typer.md](04-llm-typer.md) | LLM 能力族与 Typert |
| 05 | [05-execution-world.md](05-execution-world.md) | 执行世界（沙箱 / PTC / fs） |
| 06 | [06-memory.md](06-memory.md) | 会话落地、持久化档案与压缩 |
| 07 | [07-multi-agent.md](07-multi-agent.md) | 多智能体 |
| 08 | [08-human-agent-governance.md](08-human-agent-governance.md) | 人机协作与治理 |
| 10 | [10-gui-frontend-backend.md](10-gui-frontend-backend.md) | GUI 前后端与桌面端 |
| 11 | [11-protocol-sdk.md](11-protocol-sdk.md) | 协议与 SDK（含 MCP） |
| 12 | [12-engineering.md](12-engineering.md) | 工程体系与发布 |
| 13 | [13-browser-and-computer-use.md](13-browser-and-computer-use.md) | **新增能力族：浏览器与桌面交互** |
| — | [CHANGELOG.md](CHANGELOG.md) | **本版变更要点（rc.2 → 0.1.6-alpha.1）** |
| — | [plugin-migration-guide.md](plugin-migration-guide.md) | 插件迁移深度指南 |
| 14 | [14-post-tag-master.md](14-post-tag-master.md) | **tag 之后 master 的启动提速波（未发布，快照漂移点）** |

---

*文档生成时间：2026-09-17*
*数据源：dsh-v0.1.6-alpha.1 (0a15e36e7f) vs dsh-v0.1.5-rc.2 (fb2c4b9e69)*
