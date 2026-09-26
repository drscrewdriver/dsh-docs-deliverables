# Source Analysis

DeepSeek Harness 源码深度解析。按版本快照组织，每个版本包含架构分析、Breaking Changes、插件迁移指南。

## 版本矩阵

| 版本 | 目录 | 提交数 | 重要性 | 内容 |
|------|------|--------|--------|------|
| v0.1.0-rc.5 | `v0.1.0-rc.5/` | — | ⭐⭐⭐ | 14 篇：架构总览 + 12 模块详解 + 开发模板 |
| v0.1.0-rc.7 | `v0.1.0-rc.7/` | — | ⭐ | 首个可用 tag，与 rc.5 架构一致 |
| v0.1.1-rc.2 | `v0.1.1-rc.2/` | +207 | ⭐⭐ | 首个稳定版，增量改进 |
| v0.1.2-rc.1 | `v0.1.2-rc.1/` | +1735 | ⭐⭐⭐⭐⭐ | **大重构**：Session V2、runtime→store、Apiproxy→Remote |
| v0.1.3-alpha.2 | `v0.1.3-alpha.2/` | +644 | ⭐⭐⭐ | Settings 命名空间变更、Permission Presets |
| v0.1.5-alpha.1 | `v0.1.5-alpha.1/` | +563 | ⭐⭐⭐⭐⭐ | **Sidebar 重写**、Session V3、Electron 桌面、Token Meter 扩展、Permission Presets 统一、LLM Adapter 7 方法、子代理目录 |
| v0.1.5-rc.1 | `v0.1.5-rc.1/` | +140 | ⭐⭐⭐⭐⭐ | 反馈对话框 + 产物卡片 + 文档预览 + 共享图标 |
| v0.1.5-rc.2 | `v0.1.5-rc.2/` | +2 | ⭐⭐ | 反馈对称化 + 交付物 UI 精化（backport） |
| v0.1.6-alpha.1 | `v0.1.6-alpha.1/` | +800 | ⭐⭐⭐⭐⭐ | **四个新能力族**（ssh / ptc-runtime / browser-use / computer-use）、e2b 与 code-runtime 退役、三个默认值收敛、公共包 manifest、profile 解析代际化、侧栏终端 |
| v0.1.7-rc.1 | `v0.1.7-rc.1/` | +2504 | ⭐⭐⭐⭐⭐ | **会话格式 V4**、**设置机制换代**（`installSection` 删除 + `.volatile()` + `settings.yaml` 移除）、**插件清单契约换代**（patch 数组化、`patchReload` 移除、peer 范围强制、本地化显示元数据）、`deliverables` 与 `document` 两个新顶层包组、语音输入族 |

> **未覆盖的中间版本**：`dsh-v0.1.5-rc.3`（3 commits）、`dsh-v0.1.6-alpha.2`（887）、`dsh-v0.1.7-alpha.1`（1299）、`dsh-v0.1.7-alpha.2`（162）、`dsh-v0.1.7-rc.2`（346）尚无独立目录。`0.1.7-rc.1` 的文档已把 `0.1.6-alpha.1 → 0.1.7-rc.1` 的 2504 commits 全部纳入（区间包含上述中间版本），因此**不存在分析空白**；`rc.2` 在其之后，未纳入。

> 版本变更详情（0.1.1→0.1.5 完整提交级记录）参见 [dsh-015-notes.md](../dsh-015-notes.md)。

## 关键 Breaking Changes 速查

| 版本跳跃 | 影响级别 | 核心变更 |
|----------|---------|----------|
| rc.7 → 0.1.1 | 🟢 低 | 无 breaking changes |
| 0.1.1 → 0.1.2 | 🔴 高 | client/runtime→store、Session V2、Apiproxy→Remote、CallId→ToolCallId |
| 0.1.2 → 0.1.3 | 🟡 中 | settingsNamespace()→字符串、Permission Presets |
| 0.1.3 → 0.1.5 | 🔴 高 | Session V3 surface node、Sidebar 完全重写、Inbox 投影重构、Token Meter 扩展、Permission Presets 统一、LLM Adapter 7 方法 |
| 0.1.5-rc.1 → rc.2 | 🟡 中 | `toggle`→`retract` 接口变更、Like 也走对话框、图标数据化 |
| 0.1.5-rc.2 → 0.1.6-alpha.1 | 🔴 高 | `packages/e2b` 与 `code-runtime` 退役、`DshManifest` 公开面收窄、会话事件同步读取废弃、profile 解析代际化（**升级包后必须重启**）、`ralph` 默认关闭、Session 日志上报默认开启、headless `--session-id` 语义收紧、DeepSeek 默认协议改 Messages |
| 0.1.6-alpha.1 → 0.1.7-rc.1 | 🔴 高 | **`settings.installSection()` 删除**（无垫片）、**`settings.plugin.item` 席位移除**、**`$DSH_HOME/settings.yaml` 移除**、**`@deepseek-ai/dsh*` peer 范围强制校验**（不是 `engines.dsh`）、`dsh.profile.patchReload` 移除、HMR 包改名 `cordis-plugin-hmr` → `dsh-hmr`、**会话格式 V3 → V4（不可回退）**、`agent-team-web-profile` 整包删除、DeepSeek 彻底 Messages-only（存量 `protocol` 键硬失败） |

## 推荐阅读路径

### 按版本递进（推荐）

1. **v0.1.0-rc.5** — 架构基础（12 篇模块详解）
2. **v0.1.2-rc.1** — 第一次大重构（Breaking Changes 最多）
3. **v0.1.5-alpha.1** — 第二次大重构（Sidebar + Session V3）
4. **v0.1.6-alpha.1** — 第三次扩张（能力族矩阵 + 默认值收敛 + 启动代际化）
5. **v0.1.7-rc.1** — 第四次（**契约换代**：设置 + 插件清单 + 会话格式同时换挡）

### 按角色

| 角色 | 推荐路径 |
|------|----------|
| **新插件开发者** | rc.5 架构总览 → 0.1.2 CHANGELOG → 0.1.5 CHANGELOG → 0.1.6 CHANGELOG → **0.1.7 CHANGELOG + 0.1.7 迁移指南** |
| **已有插件迁移** | 对应版本 CHANGELOG 的"插件迁移指南"小节；**跨两版者先读 [0.1.7-rc.1/diff-vs-0.1.5-rc.2.md](v0.1.7-rc.1/diff-vs-0.1.5-rc.2.md)** |
| **架构研究者** | rc.5 全部 14 篇 → dsh-015-notes.md → 0.1.6 的 `14-post-tag-master.md` → **0.1.7 的 `09-plugin-system.md`（插件体系全链）+ `06-memory.md`（V4 持久化）** |
| **运维/部署** | **0.1.7 的 `CHANGELOG.md` §八「升级影响速查」+ `plugin-migration-guide.md` §九「升级检查清单」** |

## v0.1.0-rc.5 详细目录

| # | 文件 | 主题 | 核心概念 |
|---|------|------|----------|
| 01 | [01-vendor-cordis.md](v0.1.0-rc.5/01-vendor-cordis.md) | Cordis 框架层 | Service、Context、生命周期 |
| 02 | [02-core-product.md](v0.1.0-rc.5/02-core-product.md) | Core 产品主干 | 产品架构、核心流程 |
| 03 | [03-shell-capabilities.md](v0.1.0-rc.5/03-shell-capabilities.md) | Shell 能力缝 | shell 与 core 的衔接 |
| 04 | [04-llm-typer.md](v0.1.0-rc.5/04-llm-typer.md) | LLM 与 Typer | LLM 集成、类型系统 |
| 05 | [05-execution-world.md](v0.1.0-rc.5/05-execution-world.md) | 执行世界 | 会话管理、执行环境 |
| 06 | [06-memory.md](v0.1.0-rc.5/06-memory.md) | 记忆系统 | 记忆存储、检索、L1-L3 架构 |
| 07 | [07-multi-agent.md](v0.1.0-rc.5/07-multi-agent.md) | 多智能体 | AgentTeams、子代理、协作 |
| 08 | [08-human-agent-governance.md](v0.1.0-rc.5/08-human-agent-governance.md) | 人机协作与治理 | 治理框架、安全机制 |
| 09 | [09-cli-boot.md](v0.1.0-rc.5/09-cli-boot.md) | CLI 与 Boot | 命令行接口、启动流程 |
| 10 | [10-gui-frontend-backend.md](v0.1.0-rc.5/10-gui-frontend-backend.md) | GUI 前后端 | Web UI 架构、前后端通信 |
| 11 | [11-protocol-sdk.md](v0.1.0-rc.5/11-protocol-sdk.md) | 协议与 SDK | 通信协议、SDK 设计 |
| 12 | [12-engineering.md](v0.1.0-rc.5/12-engineering.md) | 工程体系 | 构建、测试、发布 |
| — | [architecture-overview.md](v0.1.0-rc.5/architecture-overview.md) | 架构总览 | 全局架构图、模块关系 |
| — | [module-template.md](v0.1.0-rc.5/module-template.md) | 模块详解模板 | 文章编写规范 |

## v0.1.5-rc.2 详细目录

| # | 文件 | 主题 | 核心概念 |
|---|------|------|----------|
| 01 | [01-cordis-framework.md](v0.1.5-rc.2/01-cordis-framework.md) | Cordis 框架层 | Service、Context、生命周期 |
| 02 | [02-core-product.md](v0.1.5-rc.2/02-core-product.md) | Core 产品主干 | 产品架构、核心流程 |
| 03 | [03-shell-capabilities.md](v0.1.5-rc.2/03-shell-capabilities.md) | Shell 能力缝 | shell 与 core 的衔接 |
| 04 | [04-llm-typer.md](v0.1.5-rc.2/04-llm-typer.md) | LLM 与 Typer | LLM 集成、类型系统 |
| 05 | [05-execution-world.md](v0.1.5-rc.2/05-execution-world.md) | 执行世界 | fs/sandbox/code-runtime |
| 06 | [06-memory.md](v0.1.5-rc.2/06-memory.md) | 记忆系统 | Session V3、compaction |
| 07 | [07-multi-agent.md](v0.1.5-rc.2/07-multi-agent.md) | 多智能体 | 子代理目录、模型路由 |
| 08 | [08-human-agent-governance.md](v0.1.5-rc.2/08-human-agent-governance.md) | 人机协作与治理 | 治理框架、安全机制 |
| 10 | [10-gui-frontend-backend.md](v0.1.5-rc.2/10-gui-frontend-backend.md) | GUI 前后端 | Web UI、Sidebar 重写 |
| 11 | [11-protocol-sdk.md](v0.1.5-rc.2/11-protocol-sdk.md) | 协议与 SDK | SDK、ACP、MCP |
| 12 | [12-engineering.md](v0.1.5-rc.2/12-engineering.md) | 工程体系 | 构建、测试、发布 |
| — | [plugin-migration-guide.md](v0.1.5-rc.2/plugin-migration-guide.md) | **插件迁移深度指南** | **Token/Permission/Inbox/Adapter 全面迁移** |
| — | [architecture-overview.md](v0.1.5-rc.2/architecture-overview.md) | 架构总览 | 全局架构图、模块关系 |
| — | [changelog-alpha1-rc1.md](v0.1.5-rc.1/changelog-alpha1-rc1.md) | Alpha.1→RC.1 变更 | 反馈对话框、产物卡片 |
| — | [changelog-rc1-rc2.md](v0.1.5-rc.2/changelog-rc1-rc2.md) | RC.1→RC.2 变更 | 反馈对称化、UI 精化 |

## v0.1.6-alpha.1 详细目录

> 快照基准：tag `dsh-v0.1.6-alpha.1` (`0a15e36e7f`)，对比上版 `dsh-v0.1.5-rc.2` (`fb2c4b9e69`)，800 commits。

| # | 文件 | 主题 | 本版核心 |
|---|------|------|----------|
| 01 | [01-cordis-framework.md](v0.1.6-alpha.1/01-cordis-framework.md) | Cordis 框架层 / 启动 | profile 解析不可变代际、启动失败分级、原生缓存归 addon |
| 02 | [02-core-product.md](v0.1.6-alpha.1/02-core-product.md) | Core 产品主干 | `agent/created` 改 serial、会话历史同步读取废弃、`ctx.ptcRuntime` 更名 |
| 03 | [03-shell-capabilities.md](v0.1.6-alpha.1/03-shell-capabilities.md) | Shell / 子进程 / 终端 | **新增 `packages/ssh`**、子进程双工控制管道、侧栏终端 |
| 04 | [04-llm-typer.md](v0.1.6-alpha.1/04-llm-typer.md) | LLM 能力族与 Typert | **DeepSeek 默认 Messages**、V41 目录、图片 token 网格投影 |
| 05 | [05-execution-world.md](v0.1.6-alpha.1/05-execution-world.md) | 执行世界 | **`code-runtime` → `ptc-runtime`**、受限 Node 执行、沙箱取消语义 |
| 06 | [06-memory.md](v0.1.6-alpha.1/06-memory.md) | 记忆与会话落地 | **持久化类型变更档案体系**、`compaction-image-offload`、图片卸载事件 |
| 07 | [07-multi-agent.md](v0.1.6-alpha.1/07-multi-agent.md) | 多智能体 | `ralph` 默认关闭、workflow 复用 PTC 沙箱、子代理创建语义 |
| 08 | [08-human-agent-governance.md](v0.1.6-alpha.1/08-human-agent-governance.md) | 人机协作与治理 | 命令身份拆分、权限修复、预设门控 |
| 10 | [10-gui-frontend-backend.md](v0.1.6-alpha.1/10-gui-frontend-backend.md) | GUI 前后端与桌面端 | 侧栏终端、置顶折叠头、Mermaid 全屏、归档会话恢复、`RemoteMock` |
| 11 | [11-protocol-sdk.md](v0.1.6-alpha.1/11-protocol-sdk.md) | 协议与 SDK | **MCP 官方 SDK 协商 + resources/instructions**、headless 机器可读运行面 |
| 12 | [12-engineering.md](v0.1.6-alpha.1/12-engineering.md) | 工程体系与发布 | 实验包公开发布与默认隔离闸门、持久化档案文档体系 |
| 13 | [13-browser-and-computer-use.md](v0.1.6-alpha.1/13-browser-and-computer-use.md) | **浏览器与桌面交互（新能力族）** | `ctx.browserUse` / `ctx.computerUse` 独占具名注册 |
| — | [CHANGELOG.md](v0.1.6-alpha.1/CHANGELOG.md) | **本版变更要点** | 4 新能力族 / 2 退役 / 3 默认值 / 契约变更 |
| — | [plugin-migration-guide.md](v0.1.6-alpha.1/plugin-migration-guide.md) | **插件迁移深度指南** | manifest、会话历史、解析代际、PTC 改名、E2B 退役、升级清单 |
| — | [architecture-overview.md](v0.1.6-alpha.1/architecture-overview.md) | 架构总览 | 52 组包结构、文件树、版本演进对比 |
| — | [14-post-tag-master.md](v0.1.6-alpha.1/14-post-tag-master.md) | **tag 之后的 master（未发布）** | `worktree-bootfast2` 启动提速波；快照漂移点 |

## v0.1.7-rc.1 详细目录

> 快照基准：tag `dsh-v0.1.7-rc.1` (`46a7f68b09`，2026-09-23)，对比上版 `dsh-v0.1.6-alpha.1` (`0a15e36e7f`)，**2504 commits（843 merge）｜6083 files ｜+475,425 / −133,742**。
> 顶层包组 52 → **54**；`package.json` 315 → **344**；`SESSION_FORMAT_VERSION` 3 → **4**。

| # | 文件 | 主题 | 本版核心 |
|---|------|------|----------|
| 01 | [01-cordis-framework.md](v0.1.7-rc.1/01-cordis-framework.md) | Cordis 框架层 / 启动 / profile | app-boot 拆包（新增 `dsh-hmr` / `dsh-config-editor` / `dsh-plugin-manager`）、解析后端改名（`ProfileResolutionGeneration` → `RuntimeResolution`）、profile 自有 live 配置、`--dump-config-schema` |
| 02 | [02-core-product.md](v0.1.7-rc.1/02-core-product.md) | Core 产品主干 | 一等 tool role 消息、生产者自有 source（core 内 5 处改写）、`developer/message` + `headerSeq` 全链校验、fork 放宽与 `forked`、`projectContent` + `deferLoading` |
| 03 | [03-shell-capabilities.md](v0.1.7-rc.1/03-shell-capabilities.md) | Shell / 子进程 / 终端 / SSH | **`run()` 与 `start()` 收敛为唯一 `execute()`**、前台超时提升为后台 job、用户终端权限模型、持久 pwsh 受控提示符、终端活动观察缝 |
| 04 | [04-llm-typer.md](v0.1.7-rc.1/04-llm-typer.md) | LLM 能力族与 Typert | **DeepSeek 彻底 Messages-only**（protocols 目录消失、`protocol` 键抛错）、`inputModalities` 与运行时图像能力闸门、Remote 双向流类型、凭证新包 |
| 05 | [05-execution-world.md](v0.1.7-rc.1/05-execution-world.md) | 执行世界与隔离 | **Windows ACL 强制完整性隔离**、sandbox same-mode、jobs 缝大规模收敛、spill 改 token 预算（`maxInlineBytes` → `maxInlineTokens`）、`fs.watch` 新能力 |
| 06 | [06-memory.md](v0.1.7-rc.1/06-memory.md) | 会话落地与记忆 | **V4 打开即自动迁移**（读 open 内存 `prepared`、写 open 发布后继）、native V4 关系校验（新增 `relationships.ts`）、projection cache 双重身份、compaction 预算化 |
| 07 | [07-multi-agent.md](v0.1.7-rc.1/07-multi-agent.md) | 多智能体 | Agent Teams 单一 bundle（**删除 `agent-team-web-profile`，非改名**）、子代理目录改父目录直读、可续期容量（默认 8 / 深度 1，不排队）、workflow 后台运行 |
| 08 | [08-human-agent-governance.md](v0.1.7-rc.1/08-human-agent-governance.md) | 人机协作与治理 | settings 服务整体重写（`SettingsProvider` → `SettingsForms`，`settings-file` 整包删除）、权限默认值迁回 Config、`user-questions` 加 `callId`、6 个治理插件统一 `MessageSourceMap` |
| 09 | [09-plugin-system.md](v0.1.7-rc.1/09-plugin-system.md) | **插件体系（全链）** | **整套插件管理本区间从零落地**（引导式安装状态机、安装源注册表、7 个席位、4 个伴随包）、**`engines.dsh` 无运行时读取方**、`peerDependencies` 强制校验、`patchReload` 删除 |
| 10 | [10-gui-frontend-backend.md](v0.1.7-rc.1/10-gui-frontend-backend.md) | GUI 与桌面端 | `packages/client` 53 → **59** 包、会话行菜单**扩展席位 API**、`client-modules` rev 改 mtime/ctime/size、`readBytes` 改 `Uint8Array`、桌面九项（强制更新 / NSIS / caption / vibrancy / webview / 崩溃报告） |
| 11 | [11-protocol-sdk.md](v0.1.7-rc.1/11-protocol-sdk.md) | 协议、远端与 SDK | **远端双工流**（`item`/`end` 帧、`streamInboxBytes` 默认 262144、`gateway/uplink-overflow`）、宿主独占远端输入校验、二进制工作区传输、路由门 `verify-client-route-resolution` |
| 12 | [12-engineering.md](v0.1.7-rc.1/12-engineering.md) | 工程体系、持久化评审与遥测 | 文档即契约（英文 md 167 → 176、三语 blob 哈希）、`persistence-review.ts` + inventory format 2 + `finalized/v4.json`、`no-unknown-casts` 基线 561 条目、五条新增静态门 |
| 13 | [13-browser-computer-and-voice.md](v0.1.7-rc.1/13-browser-computer-and-voice.md) | 浏览器 · 桌面操作 · 语音 | **语音输入族 5 包（全新，SenseVoice）**、`ctx.speechToText` / `ctx.speechController`、无人值守浏览器与终端回收、桌面浏览器 webview |
| 14 | [14-deliverables-document-office.md](v0.1.7-rc.1/14-deliverables-document-office.md) | 交付物与 Office 文档栈 | `deliverables` 与 `document` 两个**新顶层包组**；**`tool-present` 是搬家不是新写**（digest 未变）、真正新增是 `workspace-changes`、Office「每平台一个引擎」 |
| — | [CHANGELOG.md](v0.1.7-rc.1/CHANGELOG.md) | **本版变更要点** | 26 项变更总表 + 8 大节详解（持久化 / 插件契约 / 设置 / 新能力族 / GUI / 文档 / 工程 / 升级速查） |
| — | [plugin-migration-guide.md](v0.1.7-rc.1/plugin-migration-guide.md) | **插件迁移深度指南** | 6 项破坏性变更的证据链、迁移动作表、10 步检查清单、可复核命令 |
| — | [diff-vs-0.1.5-rc.2.md](v0.1.7-rc.1/diff-vs-0.1.5-rc.2.md) | **跨两版累积差异（0.1.5-rc.2 → 0.1.7-rc.1）** | 3304 commits 累积视角；6 张三版对照表（清单 / 设置 / 会话 / 启动 / 客户端 / 执行世界）；13 项破坏性变更按优先级排序 |
| — | [architecture-overview.md](v0.1.7-rc.1/architecture-overview.md) | 架构总览 | 54 组包结构、分层图、治理体系、版本演进三版对比、下钻路线图 |

> **本版有三个"反直觉"结论必须记住**：
> 1. **兼容性校验读 `peerDependencies`，不是 `engines.dsh`**（后者至今无运行时读取方）；
> 2. **`tool-present` 不是本版新写的**（仅从 `packages/fs` 搬家，持久化 digest 未变）；
> 3. **`agent-team-web-profile` 是整包删除而非改名**（0.1.6 时两包并存），会留下"既有 profile 启动即失败"的缺口。

## 原始来源

- 源码快照: `deepseek-harness/` 各 tag 检出（**当前 HEAD = `dsh-v0.1.7-rc.2`（`477b4f4205`）**）
- Git tags: `dsh-v0.1.0-rc.7` ~ `dsh-v0.1.7-rc.2`（远端已拉到）
- **跨版本综述**: `roadmap-0.1.5-to-0.1.7-rc.2.md`（0.1.5 → 0.1.6 → 0.1.7-rc.2 三阶段必要性总述）；`v0.1.7-rc.2/` 为最新增量目录
- 侦察底稿: `_analysis_output/dsh016/RECON.md`（0.1.5-rc.2 → 0.1.6-alpha.1）、**`_analysis_output/dsh017/`**（`BRIEF.md` 写作规范 + `notes-added.txt` 区间新增 note 全清单 + `notes-index.txt`）
- 原始文章: `详解/ 第01-12篇`
- 项目文档: `项目架构总览.md`、`模块详解模板.md`

### 本轮（v0.1.7-rc.1）的核实口径

- 所有数字来自对 `deepseek-harness` 检出的**实测命令**（`git diff --shortstat` / `--name-status` / `git rev-list --count` / `git ls-tree`），命令清单内联在各篇文末。
- 官方一手材料优先级：`docs/subsystems/*`（子系统权威页）> `docs/persistence-changes/*`（持久化契约 + schema）> `.agents/notes/implemented/*`（设计依据）> 包 README > 代码。
- **`implemented/` 与 `proposed/` 严格区分**：本轮共发现 6 篇被误当作已落地的 `proposed` note（`config-only-hmr`、`python-sdk-directional-client`、`shell-env-key-declarations`、`retire-prompt-registry-change-event`、`omit-fs-payload-invariant`、`trim-session-query-convenience-api`），均已在对应篇目显式标注为提案。
- **行数统计口径**：本机 shell 实为 Windows PowerShell 5.1，`Get-Content | Measure-Object -Line` 与 `(Get-Content).Count` 读取含非 ASCII 的 UTF-8 无 BOM 文件会少算行数；请用 `[System.IO.File]::ReadAllLines($p).Count` 或 `git diff --numstat`。
- 各篇文末均设有"未核实项"清单；`12-engineering.md` 的未核实项经二次补做后从 6 条收窄到 4 条。

---

*最后更新: 2026-09-26（新增 v0.1.7-rc.2 分析目录与跨版本综述 roadmap-0.1.5-to-0.1.7-rc.2.md）*
