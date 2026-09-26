# DSH `v0.1.5-rc.2` → `v0.1.7-rc.1` 跨版差异分析

> **数据源**: `deepseek-ai/deepseek-harness` 官方仓库
> **两端坐标**:
> - 起点 `dsh-v0.1.5-rc.2` = `fb2c4b9e69`（2026-09-10，本机曾安装的运行时）
> - 终点 `dsh-v0.1.7-rc.1` = `46a7f68b0922371ce7144b668b90e377d8e799f4`（2026-09-23）
> **跨度**: 3304 commits（含 1093 个 merge）｜ 7872 files changed, **+1,206,215 / -127,437**
> **中间版本**: `0.1.5-rc.3`(3) → `0.1.6-alpha.1`(800) → `0.1.6-alpha.2`(887) → `0.1.7-alpha.1`(1299) → `0.1.7-alpha.2`(162) → `0.1.7-rc.1`(156)
> **用途**: 直接跨两版升级（0.1.5-rc.2 → 0.1.7-rc.1）时，本文给出**累积**影响面；单版增量见 [v0.1.6-alpha.1 的 CHANGELOG](../v0.1.6-alpha.1/CHANGELOG.md) 与本文档的 [v0.1.7 CHANGELOG](CHANGELOG.md)

---

## 一句话总结

从 `0.1.5-rc.2` 到 `0.1.7-rc.1` 是**两次连续的架构级跃迁**：

1. **0.1.6（800 commits）＝ 能力面扩张 + 默认值收敛**：新增 `ssh` / `ptc-runtime` / `browser-use` / `computer-use` 四个能力族，退役 `e2b` 与 `code-runtime`，把 profile 解析换成不可变代际，引入公共包 manifest，改掉三个默认值；
2. **0.1.7（2504 commits）＝ 契约换代 + 交付物一等化**：会话格式跃迁到 V4，设置机制从"独立设置库 + 席位 API"整体换成"profile 自有的 Cordis Config 易失字段"，插件清单再收窄并开始**强制校验 `@deepseek-ai/dsh*` 的 peer 范围**（`engines.dsh` 仍不校验），新增 `deliverables` 与 `document` 两个顶层包组。

**对插件作者而言，跨两版升级一次性要处理 6 项破坏性变更**（见 §4）；其中最有杀伤力的是 `settings.installSection()` 的**彻底删除**——它没有兼容垫片。

---

## 一、规模与结构对比

| 指标 | `0.1.5-rc.2` | `0.1.6-alpha.1` | `0.1.7-rc.1` |
|---|---|---|---|
| 提交坐标 | `fb2c4b9e69` | `0a15e36e7f` | `46a7f68b09` |
| 发布日期 | 2026-09-10 | 2026-09-15 | 2026-09-23 |
| `packages/` 顶层分组 | 50 | 52 | **54** |
| `package.json` 数量 | 297 | 315 | **344** |
| `docs/` 英文 md | — | 167 | **176** |
| `SESSION_FORMAT_VERSION` | **3** | **3** | **4** |
| 区间 commits | — | +800 | +2504 |
| 区间 files changed | — | 3942 | 6083 |
| 区间 insertions | — | +784,113 | +475,425 |

> 说明：`0.1.6-alpha.1` 一行的"区间"指 `0.1.5-rc.2 → 0.1.6-alpha.1`；`0.1.7-rc.1` 一行的"区间"指 `0.1.6-alpha.1 → 0.1.7-rc.1`。两端直连的累积值为 7872 文件 / +1,206,215 / -127,437。

### 1.1 变更密度分布（`0.1.5-rc.2` → `0.1.7-rc.1` 累积）

| 区域 | 变更文件数 |
|---|---|
| `packages/client` | 1602 |
| `.agents/notes` | 1163 |
| `apps/desktop` | 414 |
| `packages/experimental` | 333 |
| `apps/web` | 320 |
| `snapshots/session` | 299 |
| `packages/api` | 212 |
| `packages/session` | 194 |
| `snapshots/web` | 175 |
| `docs/persistence-changes` | 155 |
| `docs/subsystems` | 151 |
| `packages/llm` | 132 |
| `packages/core` | 113 |
| `packages/subagent` | 102 |

两个结论直接可读：**桌面端（`apps/desktop` 414）从"附带"变成主力**；**文档与持久化契约（`docs/persistence-changes` 155 + `.agents/notes` 1163）已成体系**，不再是副产品。

---

## 二、包拓扑变化（累积）

### 2.1 新增与退役

```powershell
# 新增
git -C <repo> ls-tree -d --name-only dsh-v0.1.7-rc.1:packages  →  54 个分组
# 对比 0.1.5-rc.2 的 50 个分组
```

| 变化 | 包组 | 引入版本 | 内容 |
|---|---|---|---|
| ➕ 新增 | `ssh` | 0.1.6 | `ssh`、`fs-ssh`、`subprocess-ssh`、`sandbox-ssh`（4 包） |
| ➕ 新增 | `ptc-runtime` | 0.1.6 | `ptc-runtime`、`ptc-runtime-node`（2 包） |
| ➕ 新增 | `browser-use` | 0.1.6 | 1 包 + 实验提供者 |
| ➕ 新增 | `computer-use` | 0.1.6 | 1 包 + Cua Driver 提供者 |
| ➕ 新增 | `deliverables` | **0.1.7** | `tool-present`、`workspace-changes`（2 包） |
| ➕ 新增 | `document` | **0.1.7** | `office-to-pdf`（1 包） |
| ➖ 退役 | `e2b` | 0.1.6 | 3 包整体移除 |
| ➖ 退役 | `code-runtime` | 0.1.6 | 被 `ptc-runtime` 命名取代（**且执行基底从 worker 线程改为沙箱约束下的受管进程**） |

### 2.2 实验面（`packages/experimental`）演化

| 版本 | 包数 | 变化 |
|---|---|---|
| `0.1.5-rc.2` | — | — |
| `0.1.6-alpha.1` | 16 | 含 `agent-team-web-profile` 等 |
| `0.1.7-rc.1` | **20** | **删除** `agent-team-web-profile`（Web-only 层，8 文件 −303；其 `ui-agent-team` 行并入既有的 `agent-team-profile`——**非改名，两包原本并存**）；新增语音族 5 包：`api-speech-to-text`、`speech-to-text`、`speech-to-text-sensevoice`、`client-ui-voice-input`、`voice-input-bundle` |

---

## 三、关键契约三版对照

### 3.1 插件清单（`package.json` 的 `dsh` 字段）

| 契约项 | `0.1.5-rc.2` | `0.1.6-alpha.1` | `0.1.7-rc.1` |
|---|---|---|---|
| 包级公开类型 | 无（仅 `DshManifest`） | `DshPackageManifest` 新增 | `DshPackageManifest` + `DshEnginesManifest` + `LocalizedText` + `PluginLocalizedMeta` |
| `DshManifest` 公开字段 | `bundle` / `profile` / `client` + `configTrees` + `sessionFormatMigration` + `moduleFallback` | 收窄为 `manifestVersion` / `bundle` / `profile` / `client` | 同上（三个内部字段在公开类型中**彻底消失**） |
| `dsh.bundle.patch` | `string` | `string` | **`string \| string[]`**（PR #4722） |
| `dsh.profile` | `bundles?` + **`patchReload?`** | `bundles?` + `patchReload?` | **仅 `bundles?`**（`patchReload` 与 `ProfilePatchReload` 均删除） |
| DSH 兼容性校验 | 无 | 引入 `DshEnginesManifest`（**声明式，不校验**） | **`peerDependencies` 中 `@deepseek-ai/dsh*` 强制校验** + 精确版本豁免；**`engines.dsh` 迄今仍不校验** |
| 客户端清单 | `platform`/`inject`/`immediately`/`external` | 同 | **同（四字段未变）** |
| 本地化显示 | 无 | 无 | **`locale/<lang>.json` 的 `meta.title`/`meta.description`** |
| `icon` 约束 | — | — | SVG/PNG/JPEG/WebP，相对清单目录，**≤256 KiB**，realpath 后须仍在目录内 |

### 3.2 设置契约

| 契约项 | `0.1.5-rc.2` | `0.1.6-alpha.1` | `0.1.7-rc.1` |
|---|---|---|---|
| 席位注册 API | `settings.installSection(owner, ns, schema, entry, hooks)`（15 处） | 同（15 处） | **已删除（0 处）** |
| 新 API | — | — | `settings.configure(presentation, owner)` |
| 重复注册 | 未定义 | 未定义 | **抛错**：`Settings presentation is already configured for this plugin instance` |
| 可热改字段声明 | 独立设置 schema | 独立设置 schema | **Config `.volatile()`**（0.1.6 时该 API **完全不存在**） |
| 权威存储 | `$DSH_HOME/settings.yaml` | 同 | **活动 profile 的 `cordis.patch.yml`** |
| 旧文件 | 长期存在 | 长期存在 | 一次性导入为 `settings.yaml.imported` |
| 跨 profile 共享设置 | 支持 | 支持 | **不支持**（须显式共享 Cordis 层） |
| 命名空间 | `SettingsNamespace` 字符串 | 同 | **无 namespace 概念**，按 profile entry id 识别 |

### 3.3 会话与持久化

| 契约项 | `0.1.5-rc.2` | `0.1.6-alpha.1` | `0.1.7-rc.1` |
|---|---|---|---|
| `SESSION_FORMAT_VERSION` | 3 | 3 | **4** |
| 迁移包 | v0→v1、v1→v2、v2→v3 | 同 | **+ v3→v4** |
| 工具结果表示 | content-block 联合内 `tool-result` | 同（已标注废弃方向） | **tool-role 消息**：必需 `toolCallId`、可选 `isError` |
| source 归因 | 已发布插件包装器 | 同 | **生产者自有 source** + 冻结重命名表 |
| `turn/end.reason` | — | — | **新增 `forked`** |
| `developer/message` | 无 | 无 | **新增事件**（绑定历史 `request/header`；无 shipped profile 发出） |
| `request/header.system` | — | — | **记为禁止**（forbidden） |
| 同步会话历史读取 | `eventAt()` / `snapshotEvents()` / `ownEvents()` 可用 | **标注 `@deprecated`**，新调用被 lint 阻断 | 延续废弃状态 |
| 持久化契约体系 | 无 | 新增 `docs/persistence-changes/**` | + `historical-formats/` 体系 + `finalized/v4.json` 检查点 |
| 已发布格式记录 | — | — | writer **V4**，但 `latestReleasedVersion: 3`（evidenceTag `dsh-v0.1.5-alpha.1`） |

### 3.4 启动、profile 与 HMR

| 契约项 | `0.1.5-rc.2` | `0.1.6-alpha.1` | `0.1.7-rc.1` |
|---|---|---|---|
| profile 包解析 | 磁盘软链产物 | **进程内不可变代际**（`ResolutionGeneration`，runtime/link/dual 三模式） | 延续 + 新增**查找序规则**（祖先顺序、更近物理包先胜、不校验 peer 版本范围） |
| 应用启动约束 | — | — | **只有 `dsh` profile 能启动受支持 Node 应用**；`scripts/verify-application-entrypoints.ts` 强制 |
| HMR 包名 | `@deepseek-ai/cordis-plugin-hmr` | 同 | **`@deepseek-ai/dsh-hmr`** |
| 热重载开关 | `dsh.profile.patchReload` | 同 | **YAML 内的 `dsh-hmr` 行** |
| Plugin Manager | 独立 | 独立 | **进入 `dsh-base`**，CLI 与 Desktop 共享 profile 写锁 |
| 配置诊断 | `--dump-default-config` / `--dump-config` | 同 | **+ `--dump-config-schema`** |
| 插件图形安装 | CLI 命令为主 | 同 | **引导式安装 + 安装源注册表 + 插件详情页扩展席位** |

### 3.5 客户端模块

| 契约项 | `0.1.5-rc.2` | `0.1.6-alpha.1` | `0.1.7-rc.1` |
|---|---|---|---|
| 行 rev 派生 | 内容哈希（脚本字节 + source map） | 同 | **mtime / ctime / size 派生**，不哈希字节 |
| 跨 Host 重启 rev | 变化 | 变化 | **保持稳定** |
| source map | 随脚本参与 | 同 | **首次 map `GET` 惰性读取 + 缓存**，map 体由首次 GET 固定 |
| `artifactBaseline` 字段 | `path`/`mtimeMs`/`size` | 同 | **+ `ctimeMs`** |
| registry 读面 | `graph()` / `clientPath()` / `artifactBaseline()` | 同 | **+ `fetchBundle()`** |
| `WebBootEntry.url` | combo endpoint | 同 | **文档相对** |

### 3.6 执行世界与沙箱

| 契约项 | `0.1.5-rc.2` | `0.1.6-alpha.1` | `0.1.7-rc.1` |
|---|---|---|---|
| 代码执行接缝 | `ctx.codeRuntime`（worker 线程） | **`ctx.ptcRuntime`**（沙箱约束下的受管 Node 进程） | 延续 |
| 远端执行 | 无 | **`packages/ssh`**（实现既有 fs/subprocess/sandbox API） | 延续 |
| Windows 隔离 | — | — | **ACL 强制完整性隔离** |
| `ShellExecutor.start()` | 同步 | **返回 Promise** | 延续 |
| `SandboxProvider.confine()` | 同步 | **返回 Promise + `AbortSignal`** | 延续 + **same-mode** |

---

## 四、跨两版必须处理的破坏性变更（6 项）

按处理优先级排序。级别含义：🔴 不改会坏；🟡 建议改；🟢 纯增量。

| # | 级别 | 变更 | 引入版本 | 不改的后果 |
|---|---|---|---|---|
| 1 | 🔴 | `settings.installSection()` 删除，改 `configure({ auto }, fiber)` | 0.1.7 | **设置表单/设置页直接失效**，无报错提示 |
| 2 | 🔴 | `$DSH_HOME/settings.yaml` 移除 | 0.1.7 | 写入的配置**不再被读取**（文件会被改名为 `.imported`） |
| 3 | 🔴 | `@deepseek-ai/dsh*` peer 范围强制校验（**不是 `engines.dsh`**） | 0.1.7 | 插件被拒装/拒启动，错误码 `incompatible-version` |
| 4 | 🔴 | `dsh.profile.patchReload` 移除 | 0.1.7 | 自写 profile 的热重载**静默失效** |
| 5 | 🔴 | HMR 包改名 `cordis-plugin-hmr` → `dsh-hmr` | 0.1.7 | 组合加载失败（模块找不到） |
| 6 | 🔴 | 会话格式 V3 → V4 | 0.1.7 | 旧插件若直读 `session.jsonl` 会**读不到新数据**；且**不可回退** |
| 7 | 🟡 | `ctx.codeRuntime` → `ctx.ptcRuntime`；`e2b` 包组移除 | 0.1.6 | 引用旧服务名的插件激活失败 |
| 8 | 🟡 | `ShellExecutor.start()` / `SandboxProvider.confine()` 转 Promise | 0.1.6 | 执行类插件类型错误或时序错乱 |
| 9 | 🟡 | `ralph` 默认关闭；Session 日志上报默认开启；DeepSeek 默认 Messages | 0.1.6 | 默认工具目录变短；隐私面变化 |
| 10 | 🟡 | 同步会话历史读取三方法 `@deprecated` | 0.1.6 | 新调用被 lint 阻断 |
| 11 | 🟡 | `DshManifest` 公开面两轮收窄 | 0.1.6 / 0.1.7 | 引用内部字段的类型错误 |
| 12 | 🟡 | headless `--session-id` 必须指向已存在会话 | 0.1.6 | 调用方报错 |
| 13 | 🟡 | 客户端模块 rev 语义变化 | 0.1.7 | 自建缓存失效逻辑误判 |

---

## 五、能力面累积扩张（相对 `0.1.5-rc.2`）

### 5.1 新增能力缝（`docs/capability-seams.md` 生成区实测）

| 服务 | 引入版本 | 描述 |
|---|---|---|
| `ctx.ptcRuntime` | 0.1.6 | PTC 执行接缝（取代 `ctx.codeRuntime`） |
| `ctx.browserUse` | 0.1.6 | 浏览器交互 |
| `ctx.computerUse` | 0.1.6 | 桌面交互 |
| `ctx.agentTeams` | 0.1.6 | 实验性协调缝（durable roster / task board / mailbox） |
| `ctx.officeToPdf` | **0.1.7** | Office 转 PDF 转换 |
| `ctx.workspaceChanges` | **0.1.7** | 每轮变更文件摘要 |
| `ctx.speechToText` | **0.1.7** | 实验性语音识别提供者 |
| `ctx.speechController` | **0.1.7** | 实验性转写 Remote |
| `ctx.pluginManager` | **0.1.7** | 当前 profile 的插件与 bundle 管理 |
| `ctx.pluginRegistryProbe` | **0.1.7** | 宿主注册表响应比对 |
| `ctx.configEditor` | **0.1.7** | profile 配置编辑 |
| `ctx.hmr` | **0.1.7** | 串行化的模块与配置重载 |
| `ctx.profileContext` | **0.1.7** | 启动器自有 profile 数据 |
| `ctx.connection` | **0.1.7** | 已认证的浏览器传输 |
| `ctx.productTelemetry` | **0.1.7** | 产品使用事件发送 |
| `ctx.deepseekAccount` | **0.1.7** | DeepSeek 账号 |
| `ctx.jobController` | **0.1.7** | 宿主作业 Remote 控制器 |

### 5.2 新工具/交付物面

| 能力 | 引入版本 | 说明 |
|---|---|---|
| `present`（`tool-present`） | 0.1.7 | 交付物呈现；`packages/deliverables` 顶层包组 |
| 每轮变更文件卡 / 变更文件 diff 预览 | 0.1.7 | `workspace-changes` + 客户端卡片 |
| 持久计划卡 | 0.1.7 | `packages/plan` |
| Office 预览与转换 | 0.1.6 → 0.1.7 | 0.1.6 起 `local-office-preview`；0.1.7 收敛为 `document/office-to-pdf` + 共享 Office 运行时 |
| 语音输入 | 0.1.7 | 实验面 5 包 |

### 5.3 产品面（GUI / 桌面）累积增量

| 主题 | 引入版本 |
|---|---|
| 侧栏终端、置顶折叠头、Mermaid 全屏、归档会话恢复 | 0.1.6 |
| 侧栏工作区层级、侧栏浏览器、文件/目录自动刷新、保留标签布局 | 0.1.7 |
| 会话钉住与侧栏归档、状态点视觉语言、紧凑半透明菜单面 | 0.1.7 |
| Electron 桌面打包与更新、欢迎窗材质、就地 profile | 0.1.6 |
| 强制更新（API + 客户端）、Windows 原生安装器页、Windows 标题栏、macOS vibrancy | 0.1.7 |
| 桌面浏览器 webview、致命诊断与崩溃报告、桌面主运行时 | 0.1.7 |

---

## 六、默认值与隐私面变化（跨两版累计）

| 项 | `0.1.5-rc.2` | `0.1.7-rc.1` | 引入版本 |
|---|---|---|---|
| `ralph` 工具 | 默认启用 | **默认关闭** | 0.1.6 |
| Session 日志上报 | 默认关闭 | **默认开启** | 0.1.6 |
| DeepSeek 协议 | Chat Completions 默认 | **Messages 默认**；0.1.7 进一步收敛为 **Messages-only** | 0.1.6 / 0.1.7 |
| headless `--session-id` | 可新建 | **必须指向已存在会话** | 0.1.6 |
| `dsh <name>` 简写 | 无 | **支持**（`dsh web` = `--profile web`） | 0.1.7 |
| 开发者工具 | 默认关闭 | **默认开启** | 0.1.7 |
| 默认工作区 | 无明确规则 | **新增 `default-workspace`** | 0.1.7 |
| Plugin Manager 位置 | 独立行 | **进入 `dsh-base`** | 0.1.7 |

---

## 七、文档体系累积演化

```powershell
# 英文 md 计数（排除 .zh.md）
git -C <repo> ls-tree -r --name-only <tag>:docs | Where-Object { $_ -like '*.md' -and $_ -notlike '*.zh.md' }
```

| 项 | `0.1.6-alpha.1` | `0.1.7-rc.1` |
|---|---|---|
| 英文 md 总数 | 167 | **176** |
| 新增子系统页 | — | `boot`、`deliverables`、`office-to-pdf`、`product-telemetry`、`voice-input` |
| `docs/persistence-changes/` | 初建 | + `historical-formats/` 体系、`finalized/v4.json` |
| 三语契约 | en / zh / `.i18n.yaml` | 同，且门禁更严（`doc-sync` / `test:docs` / `verify-doc-budgets` / `verify-type-equiv`） |

区间内新增英文 Agent Note（`--diff-filter=A`）：

| 区间 | 新增 note（英文） | 分类 |
|---|---|---|
| `0.1.5-rc.2 → 0.1.6-alpha.1` | — | （已由 v0.1.6 文档覆盖） |
| `0.1.6-alpha.1 → 0.1.7-rc.1` | **165** | 架构 62 / 功能 45 / 缺陷 26 / 精简 16 / 流程 13 / 测试 3 |
| 两版累积（`.agents/notes` 变更文件） | 1163（含 `.zh.md` 与 `.i18n.yaml`） | — |

---

## 八、升级路径建议

### 8.1 一次性跨版升级（推荐给自有部署）

若你的部署与插件集同时升到 `0.1.7-rc.1`，按以下顺序做：

1. **先备份 `$DSH_HOME`**（含 `profiles/`、`settings.yaml`、各会话目录）。会话迁移**不可回退**。
2. **改代码**：处理 §4 的 13 项（前 6 项必做）。
3. **改 profile**：删 `patchReload`；确认 `dsh-hmr` 行的启用状态符合预期。
4. **改 YAML**：`@deepseek-ai/cordis-plugin-hmr` → `@deepseek-ai/dsh-hmr`。
5. **静态核对**：`dsh --profile <p> --dump-config` 看层是否完整；`--dump-config-schema` 看插件 schema 是否被正确导入。
6. **首次启动**：观察是否出现 `incompatible-version` 拒绝；观察是否生成 `settings.yaml.imported`；确认会话目录出现 `session.v4.jsonl`。
7. **复核设置**：打开设置页确认插件表单仍在（这一步能立刻暴露 `installSection` 未迁移的问题）。

### 8.2 分两跳升级（更易定位问题）

如果问题难以定位，可以分两跳，两跳的破坏面是清晰的：

| 跳 | 破坏面 |
|---|---|
| `0.1.5-rc.2` → `0.1.6-alpha.1` | `ctx.codeRuntime` → `ctx.ptcRuntime`、`e2b` 退役、执行类接口转 Promise、三个默认值、会话历史同步读取废弃、headless `--session-id` |
| `0.1.6-alpha.1` → `0.1.7-rc.1` | 设置席位 API 与 `settings.yaml`、`@deepseek-ai/dsh*` peer 范围强制、`patchReload`、HMR 改名、会话格式 V4、清单收窄 |

**注意**：0.1.6 那一跳**不涉及会话格式跃迁**（writer 仍是 3），因此中途停车不会造成格式迁移；V4 迁移只在装上 0.1.7 后第一次写入时发生。这让"分两跳"在持久化上是安全的。

---

## 九、可复核命令清单

```powershell
$repo = 'E:\test\rewrite-agently\deepseek-harness'

# 累积规模
git -C $repo rev-list --count dsh-v0.1.5-rc.2..dsh-v0.1.7-rc.1        # 3304
git -C $repo rev-list --merges --count dsh-v0.1.5-rc.2..dsh-v0.1.7-rc.1  # 1093
git -C $repo diff --shortstat dsh-v0.1.5-rc.2 dsh-v0.1.7-rc.1

# 包拓扑
git -C $repo ls-tree -d --name-only dsh-v0.1.5-rc.2:packages
git -C $repo ls-tree -d --name-only dsh-v0.1.7-rc.1:packages
git -C $repo ls-tree -d --name-only dsh-v0.1.7-rc.1:packages/experimental

# 会话格式三版
foreach ($t in @('dsh-v0.1.5-rc.2','dsh-v0.1.6-alpha.1','dsh-v0.1.7-rc.1')) {
  git -C $repo grep -n 'SESSION_FORMAT_VERSION = ' $t -- packages/core/session/src/types.ts
}

# 席位 API 三版（预期 15 / 15 / 0）
foreach ($t in @('dsh-v0.1.5-rc.2','dsh-v0.1.6-alpha.1','dsh-v0.1.7-rc.1')) {
  "$t : " + (git -C $repo grep -c 'installSection' $t -- packages | Measure-Object).Count
}

# .volatile() 三版（预期 0 / 0 / 多处）
foreach ($t in @('dsh-v0.1.5-rc.2','dsh-v0.1.6-alpha.1','dsh-v0.1.7-rc.1')) {
  "$t : " + (git -C $repo grep -c '\.volatile\(' $t -- packages | Measure-Object).Count
}

# 清单类型三版
foreach ($t in @('dsh-v0.1.5-rc.2','dsh-v0.1.6-alpha.1','dsh-v0.1.7-rc.1')) {
  git -C $repo show "${t}:packages/util/package-manifest/src/types.ts" | Select-String 'patch'
}

# 包清单数量三版
foreach ($t in @('dsh-v0.1.5-rc.2','dsh-v0.1.6-alpha.1','dsh-v0.1.7-rc.1')) {
  "$t : " + (git -C $repo ls-tree -r --name-only $t | Select-String 'package\.json$').Count
}
```

---

*本文档为跨两版累积视角。单版增量：[v0.1.6-alpha.1 变更说明](../v0.1.6-alpha.1/CHANGELOG.md)、[v0.1.7-rc.1 变更说明](CHANGELOG.md)。*
*迁移动作清单：[v0.1.7 插件迁移深度指南](plugin-migration-guide.md)。*
