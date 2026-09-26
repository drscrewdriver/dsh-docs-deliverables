# DSH v0.1.5-rc.2 → v0.1.6-alpha.1 变更说明（更新要点）

> **数据源**: `deepseek-ai/deepseek-harness` 官方仓库
> **标签对比**: `dsh-v0.1.5-rc.2` (`fb2c4b9e69`) → `dsh-v0.1.6-alpha.1` (`0a15e36e7f`)
> **发布日期**: 2026-09-15 ｜ **发布提交**: `ea53423b60 release(dsh): 0.1.6-alpha.1`
> **发布 PR**: [#4171](https://github.com/deepseek-ai/deepseek-harness/pull/4171) `worktree/release-dsh-0.1.6-alpha.1`
> **性质**: 常规开发主干的一个完整发布窗口（非 backport）
> **统计**: 800 commits（含 250 个 merge）｜ 3942 files changed, 784113 insertions(+), 47018 deletions(-)
> **结构变化**: `packages/` 顶层分组 50 → 52（新增 4、移除 2）；`package.json` 数量 296 → 314
> **会话格式**: `SESSION_FORMAT_VERSION` 保持 **3**（本版无结构性会话格式跃迁）

---

## 一句话总结

0.1.6-alpha.1 是 **能力面扩张 + 默认值收敛** 的一次发布：

- **新增 4 个能力族**：`ssh`（远端执行世界）、`ptc-runtime`（代码执行接缝，取代 `code-runtime`）、`browser-use`、`computer-use`；
- **退役 2 个**：`e2b` 云沙箱提供者组、`code-runtime` 组（被 PTC 命名取代）；
- **改变三个默认值**：`ralph` 工具默认关闭、Session 日志上报默认开启、DeepSeek 默认走 Messages 协议；
- **插件作者面出现首个"公共 manifest"契约**：`DshPackageManifest` / `dsh.manifestVersion` / `engines.dsh`；
- **启动解析机制换代**：profile 包解析从"磁盘软链产物"改为进程内不可变代际（`ResolutionGeneration`）；
- **GUI 侧最大增量**：侧栏终端、置顶折叠头、Mermaid 全屏查看器、归档会话恢复页。

---

## 版本序列定位

```
dsh-v0.1.5-alpha.1
    │
    ▼
dsh-v0.1.5-rc.1
    │
    ▼
dsh-v0.1.5-rc.2   ← 上版（fb2c4b9e69，2026-09-10）
    │
    │  ←─ 本次变更（800 commits，250 个 merge）
    │
dsh-v0.1.6-alpha.1 ← 当前版（0a15e36e7f，2026-09-15）
```

发布链末端（最近 5 个提交）：

```
0a15e36e7f Merge pull request #4171 …/worktree/release-dsh-0.1.6-alpha.1   ← 本 tag
ea53423b60 release(dsh): 0.1.6-alpha.1                                    ← 版本提交
64a8ba929d Merge pull request #4195 …/fix/compaction-banner-offset
c75e3d4e81 Merge pull request #1170 …/sticky-collapsible-headers
57364a8475 Merge pull request #4104 …/feat/electron-asar-runtime-resolution
```

---

## 变更总览

| # | 类别 | 变更 | 影响面 |
|---|------|------|--------|
| 1 | 新能力族 | `packages/ssh`（4 包）：远端文件系统/子进程/沙箱 | 🟡 可选启用 |
| 2 | 新能力族 | `packages/ptc-runtime`（2 包）：PTC 执行接缝 | 🔴 取代 `code-runtime` |
| 3 | 新能力族 | `packages/browser-use`（1 包）+ 3 个实验提供者 | 🟡 experimental |
| 4 | 新能力族 | `packages/computer-use`（1 包）+ 2 个 Cua Driver 提供者 | 🟡 experimental |
| 5 | 退役 | `packages/e2b`（3 包）整体移除 | 🟡 仅影响使用该提供者的部署 |
| 6 | 默认值 | `ralph` 工具在默认组合中 `disabled: true` | 🔴 默认工具目录缩短 |
| 7 | 默认值 | Session 日志上报默认 `enabled: true` | 🔴 **隐私相关** |
| 8 | 接口 | headless `--session-id` 必须指向已存在会话 | 🔴 调用方需改 |
| 9 | 协议 | DeepSeek 默认改为 Messages；Web 仍走 Chat Completions | 🟡 端点默认值变化 |
| 10 | 协议 | MCP 改用官方 SDK 协商协议版本，新增 resources/instructions | 🟢 增量 |
| 11 | 插件契约 | 公共 `DshPackageManifest`（`dsh.manifestVersion`、`engines.dsh`） | 🟡 类型改名 |
| 12 | 插件契约 | `Session.eventAt()` / `snapshotEvents()` / `ownEvents()` 标记废弃 | 🟡 禁止新增调用 |
| 13 | 架构 | profile 包解析改为不可变代际（runtime/link/dual 三模式） | 🟢 启动期内部 |
| 14 | 架构 | 插件自有消息投影（`@messageProjection`） | 🟢 扩展点 |
| 15 | 发布 | experimental 包公开发布 + 默认产物隔离闸门 | 🟡 发布面变化 |
| 16 | 文档 | 新增 `docs/persistence-changes/**` 持久化类型变更档案 | 🟢 新增体系 |
| 17 | 接口 | `ShellExecutor.start()` 与 `SandboxProvider.confine()` 由同步改为返回 Promise（后者新增 `AbortSignal`） | 🔴 执行类插件需改 |

---

## 一、新增能力族（4 组）

### 1.1 `packages/ssh` —— 一个远端执行世界

新增包组（`ssh`、`fs-ssh`、`subprocess-ssh`、`sandbox-ssh`），官方子系统文档 `docs/subsystems/ssh.md` 为本版新增。

**它不引入任何 SSH 专属模型工具**，而是**实现已有的文件系统 / 子进程 / 沙箱 API**：把 provider 指向远端，`Bash`、PTY、LSP 等消费者随执行世界一起切换。这正是仓库反复强调的"能力缝（capability seam）"设计——SSH 是一条缝的第三种实现，不是新工具。

关键设计点（`docs/subsystems/ssh.md`）：

| 主题 | 事实 |
|---|---|
| 执行坐标 | 文件系统标识、可执行文件查找、进程 cwd、沙箱工作区根、LSP 文件 URL 均指向 SSH 主机 |
| 传输 | 管理 RPC 走 helper 的 SSH exec 流；stdin/stdout/stderr/终端输出/可选 fd 7 控制流量走**各自单独认证的转发 Unix socket**，每条流有独立 SSH channel window |
| 认证归属 | 部署认证、产物校验、每流 TLS 认证由 `dsh-ssh` 负责 |
| 进程生命周期 | 进程先预留再连接流；launch 最多被接受一次 |
| 限制 | `processPathFromHostPath()` 对 SSH **不可用**；`NodePtcRuntime` 因此需要显式安装并做摘要校验的远端 bootstrap |

设计依据：`.agents/notes/implemented/architecture/2026-09-11-posix-ssh-runtime.md`。

### 1.2 `packages/ptc-runtime` —— `code-runtime` 的继任者

新增 `ptc-runtime`、`ptc-runtime-node` 两个包；**同时移除旧的 `packages/code-runtime` 组**（原含 `code-runtime`、`code-runtime-worker-thread`）。这**不是一次纯改名**：相关提交同时包含 `feat(code-runtime): execute Node programs through confined processes` 与 `refactor(ptc): align runtime packages and services with PTC naming`，即"先落地受限进程执行，再统一到 PTC 词汇"。

三条可复核的硬证据：

| 证据 | rc.2 | 0.1.6-alpha.1 |
|---|---|---|
| 提供者的隔离基底常量 | `code-runtime-worker-thread`：`readonly isolation = 'worker-thread'` | `ptc-runtime-node`：`readonly isolation = 'process'` |
| 包的 peer 依赖 | `code-runtime/package.json` 仅 peers `@deepseek-ai/cordis` | `ptc-runtime/package.json` **多出 `@deepseek-ai/dsh-sandbox`** |
| 文档 | `docs/subsystems/code-runtime.md` | 删除；改为 `docs/subsystems/ptc-runtime.md` |

即：**重命名 + 执行基底更换（worker 线程 → 沙箱约束下的受管 Node 进程）+ 能力面扩张**三件事同时发生。

官方文档 `docs/subsystems/ptc-runtime.md` 明确了契约形态：

- 能力缝通过 `ctx.ptcRuntime` 提供；
- `PtcRunRequest` 承载程序、绑定、取消与可选执行选项；provider 的 `resolve` 校验并补齐部署默认值，产出带显式目录与截止时间的 `PtcRunSpec`：
  - 省略 timeout → provider 默认值；
  - 数字 → 有上限的耗时预算；
  - `null` → 无耗时截止。
- **PTC 执行是可选的**，不属于 agent-loop 主干（spine）。

配套设计记录：`2026-09-11-sandboxed-node-ptc-runtime.md`、`2026-09-12-ptc-runtime-vocabulary.md`、`2026-07-31-ptc-runtime-python-fd3-protocol.md`。

### 1.3 `packages/browser-use` —— 模型操作网页（实验性）

新增包组 `browser-use` 与官方文档 `docs/subsystems/browser-use.md`。提交：`feat(browser-use): add per-Session experimental browser backends`、`refactor(browser-use): defer DSH inference integration`。

| 维度 | 事实 |
|---|---|
| 分工 | **DSH 拥有任务循环**；提供者（provider）提供浏览器操作，并在同一 Session 的多个 turn 之间保持浏览器状态 |
| 挂载方式 | 组合中同时挂载 `dsh-browser-use` 与**恰好一个**提供者 |
| 提供者 | `browser-use-playwright-mcp`、`browser-use-chrome-devtools-mcp`、`browser-use-stagehand-native`（均为 experimental 包，**需要显式启用**） |
| 初始引擎 | Chromium |
| 共享服务 | **只注册一个名字，并拒绝第二个提供者**（包括同名实例）；服务本身没有通用浏览器操作方法、浏览器资源或模型可控的 selector |
| Session 归属 | 浏览器属于使用它的那个 live Agent/Session；Session 运行时销毁时关闭其启动的资源；reload/fork 会得到全新浏览器状态；**登录态不随会话日志恢复** |

### 1.4 `packages/computer-use` —— 模型操作本地桌面（实验性）

新增包组 `computer-use` 与官方文档 `docs/subsystems/computer-use.md`。提交：`feat: add computer use with Cua Driver providers`。

- 共享能力名 **computer use**；**Cua Driver** 指上游实现名。
- 两个提供者：`computer-use-cua-driver-mcp`（连接已安装的 `cua-driver` 可执行文件，走 MCP）与 `computer-use-cua-driver-native`（随 npm 依赖安装的平台原生运行时）。
- 与 browser-use 相同的注册约束：**只注册一个名字并拒绝第二个提供者**；无通用桌面操作方法或模型可控 selector。
- 生命周期：提供者关闭工具与自有资源时**保留注册**；启动失败则释放；MCP 提供者在重连期间保持注册。
- 边界声明：**一个注册的提供者不为某个 Session 保留桌面**，跨 Session / 跨进程的完整"观察—动作—校验"流程由调用方协调；**已取消的调用无法撤销桌面已收到的输入**。

---

## 二、退役与移除

### 2.1 `packages/e2b` 整体移除

移除 `e2b`、`fs-e2b`、`subprocess-e2b` 三个包（设计记录：`.agents/notes/implemented/simplification/2026-09-11-remove-e2b-providers.md`）。E2B 是云沙箱 POC，本版将其从提供者矩阵中整体退役。

**对插件的影响**：任何把 provider 指向 E2B 的 profile/preset 配置都会在启动期解析失败；远端执行的正规路径改为 `packages/ssh`（POSIX 远端）或自有 provider。

### 2.2 `code-runtime` 组退役，`docs/subsystems/code-runtime.md` 删除

见 1.2。消费者需要改用 `ctx.ptcRuntime` 与 `ptc-runtime` 包。

---

## 三、默认值与行为变更（影响所有用户）

### 3.1 `ralph` 工具在默认组合中关闭 🔴

依据：`.agents/notes/implemented/simplification/2026-09-12-ralph-off-in-shipped-defaults.md`。

| 位置 | 变化 |
|---|---|
| `packages/bundle/base/cordis.patch.yml` | `tool-ralph` 行声明 `disabled: true` |
| `standard` / `ptc` / `cordis` 预设 | 各自的 `tool-ralph` 行同样 `disabled: true` |
| `minimal` 预设 | 本来就没有该行 |
| `ptc` 预设 | 额外声明 `workflow-ptc` 关闭（`ralph` 关闭后该引擎在该组合中没有消费者） |
| `packages/bundle/web-app/cordis.patch.yml` | 为自己的层重申该 disable |

设计动因值得记录：`ralph` 自己的工具描述就限制"仅用于人类显式要求的运行"，且其完成判定是**worker 自述、没有独立评估**；把这样一个工具默认发给所有会话，等于默认目录宣传了产品尚未背书的能力。

**恢复方式**（原文给出的三条路径）：
- 基于 base 的 profile：在 `$DSH_HOME/cordis.patch.yml` 或 `--patch` 文件里用 overlay 行重新启用；
- Web 会话：预设文件不接受 patch，必须把预设**复制到 `$DSH_HOME/.agent-presets` 并换一个新 id**（复用内置 id 会被内置根遮蔽）；
- 在 `ptc` 中恢复时，`tool-ralph` 与 `workflow-ptc` **两行要一起恢复**，否则注入 `ctx.workflowEngine` 无法解析。

**不变量**：包、工具契约与测试都保留；已记录过 `ralph` 调用的历史会话仍可回放与渲染（事件类型未变）。验证由 `packages/preset/agent-presets/tests/shipped-root.spec.ts`、`apps/cli/tests/web-agent-presets.e2e.ts`、`apps/web/tests/shipped-composition.e2e.ts` 固定。

### 3.2 Session 日志上报默认开启 🔴（隐私相关）

依据：`.agents/notes/implemented/architecture/2026-09-14-session-log-upload-default.md`。

- `session-log-deepseek.Config.enabled` 在**每个进程中默认 `true`**；显式写 `enabled: false` 可关闭。
- 插件**不再**检查测试运行器或快照的环境变量来决定是否上报。
- 上报内容是**完整的、未被接受的规范会话日志后缀**，包括消息文本、工具参数与结果、工作区路径与反馈，发送到解析出的 DeepSeek 端点或配置的网关。
- **不增加任何提示词 token 或模型可见内容**；请求体会显著变大；OTel 独立于此贡献，关闭 OTel 不会关闭它。
- headless 与 ACP 语料库的 base patch、以及 Web scaffold **显式关闭**上报；SDK 的文本轮录制则不带该设置，用于覆盖"默认开启"路径。

对私有部署的含义：升级到 0.1.6-alpha.1 后，**未显式关闭即有数据外发**——升级检查清单里应当有一条"确认 `session-log-deepseek.enabled` 的取值"。

### 3.3 headless `--session-id` 语义收紧 🔴

提交 `ea84ad31b6474cabbc8befe774703ee0e6119789`：

> `--session-id` now adopts only: an id with no stored Session fails before the task runs instead of creating an empty history the caller believes it is resuming.

即**该参数只用于认领一个已存在的会话**；传入一个没有存储记录的 id 会在任务执行前直接失败，而不是静默创建一个空历史。首轮应省略该参数，运行时会在开场的 `session` 事件中报告铸造出的 `session-<uuid>` 身份，由监督进程持久化并在后续每次唤醒时指名使用。

改动同时覆盖了帮助文本、README 双语对、Agent Note 双语对、生成的 config catalog、单测与 product-profile e2e。

### 3.4 DeepSeek 默认协议改为 Messages 🟡

依据：`.agents/notes/implemented/feature/2026-09-07-deepseek-messages-adapter.md`；提交 `5ca77db865`（PR #4089）与 `4af56cf808`。

- DeepSeek 适配器在**同一个 `deepseek-official` 路由与 `llm-deepseek` 设置命名空间**下服务多种协议：`common/` 共享配置、模型目录、能力解析与 Files 生命周期；`protocols/chat-completions/` 与 `protocols/messages/` 各自拥有序列化、流转换与传输。
- Cordis YAML 通过 `protocol` 选择实现，**默认 `messages`**；一方组合继承该默认。
- **Web 端始终不显示协议选择器**，且按 `feat(llm): sync V41 Messages catalog and keep Web on Chat Completions` 保持 Web 走 Chat Completions。
- 无端点覆盖时，Messages 的官方默认端点为 `https://api.deepseek.com/anthropic`；`baseURL` 与 `apiKeyEnv` 两协议共享，**没有嵌套的每协议配置映射**。
- 显式 `chat-completions` 仍受支持并保留自己的官方默认；**自定义 `baseURL` 或环境覆盖永远不会被改写成与协议匹配**（换言之：切换协议后，已有的端点覆盖必须自己支持该协议）。

### 3.5 MCP：改用官方 SDK 协商 + resources / instructions 🟢

- `2026-09-12-mcp-sdk-protocol-negotiation.md`：通过**官方 SDK** 协商现代或受支持的旧版协议修订。
- `2026-09-12-mcp-resources-and-instructions.md` + `docs/subsystems/mcp.md`（本版新增）：当服务器在调用方作用域内配置时，共享工具可发现并读取 **resources**；**server instructions 加入被记录的 system prompt**。
- `2026-09-12-mcp-resources-in-profiles.md`：profile 中配置的服务器也会激活 resource 工具。

---

## 四、架构与插件契约变更

### 4.1 profile 包解析：从磁盘软链产物到不可变代际

依据：`.agents/notes/implemented/architecture/2026-09-09-profile-resolution-generations.md`（实现位于 `app-boot/src/profile-resolution/`）。

| 维度 | 旧（≤ rc.2） | 新（0.1.6-alpha.1） |
|---|---|---|
| 桥接方式 | 启动时计算优先级，**物化为共享软链 / profile 自有链接 / 打包代理包** | 启动时计算出**一个不可变 `ResolutionGeneration`**，可安装进 Node 的 ESM 与 CJS 解析器 |
| 持久副作用 | 跨进程、跨安装持久存在，需要协调与加锁 | runtime 模式**不创建、不更新、不退役**任何链接 |
| 更新粒度 | 逐项改动现存表 | `PluginPackages.replace()` 以**一次引用替换**发布完整增量后继 |
| 失败语义 | — | 构建期读完所有必要 manifest；出错则当前代际保持不变（原子） |
| 模式 | — | `link`（普通 Node 启动器默认，保持既有文件系统行为）、`runtime`（pkg 可执行文件与 Electron Host 强制）、`dual`（内部对比路径，要求磁盘结果与代际一致） |

实现要点（原文摘录整理）：两套适配器（ESM 包装 `CascadedLoader` 的 resolve、CJS 包装 `Module._resolveFilename`）**共用同一个路由函数**，最终解析仍交给 Node（exports、条件、主文件、缓存、错误码都由 Node 负责）；**不使用 `module.registerHooks`**，也不替换 `_findPath`。每个 Harness 自有 Worker 通过构建 banner 安装同一代际；**已在运行的 Worker 保留它继承的那一代，发布后继的调用方必须重启它们**。替换已有包（升级/删除）**必须重启进程**，因为 Node 的模块映射与 CJS 缓存会保留旧模块身份。

对开发者的实际含义：**升级插件版本后需要重启进程**；runtime 模式下不再生成 `.dsh-module-fallback` 之类的可见产物。

### 4.2 公共包 manifest：插件作者的首个公共声明契约 🟡

依据：`2026-09-10-public-package-manifest.md`。包 `packages/util/package-manifest` 在 rc.2 已存在，但**其公开类型面在本版重做**：

| 项 | rc.2 | 0.1.6-alpha.1 |
|---|---|---|
| 公开入口类型 | `DshManifest` 描述 `bundle` / `profile` / `client` / **`configTrees`** / **`sessionFormatMigration`** / **`moduleFallback`** | **新增 `DshPackageManifest`**（必填 `name` + `version`）；`DshManifest` 只描述 `dsh` 下的**公共作者字段**（`bundle` / `profile` / `client`），并新增 `manifestVersion` |
| 内部字段 | 公开暴露 | `configTrees` 归镜像打包器、`sessionFormatMigration` 归目录生成器、`moduleFallback` 归启动器；**公共类型不再暴露** |
| 宿主版本声明 | 无（依赖 peerDependencies） | 顶层 `engines.dsh`（SemVer 范围，可与 `engines.node` / `engines.npm` 并列）；`dsh.manifestVersion: 1` 标识声明格式 |
| 强制力 | — | **声明式**：当前的安装器与加载器**不校验** `manifestVersion` 与 `engines.dsh` |
| 本地 profile | — | 读取方用 `Partial<DshPackageManifest>`，因为 profile 无需发布身份 |

类型定义位置：`packages/util/package-manifest/src/types.ts`；该包**只提供类型**，不提供解析器、getter、文件检查或默认值。

### 4.3 同步读取任意会话事件被废弃 🟡

依据：`2026-09-09-deprecate-synchronous-session-event-reads.md`。

`Session.eventAt()`、`Session.snapshotEvents()`、`Session.ownEvents()` 三个方法**打上 `@deprecated` JSDoc**：

- **现有逻辑可以暂不迁移**，但**禁止新增调用**；也禁止新增暴露同样同步历史访问的别名或包装。
- 理由是存储方向：一旦历史事件需要存储 I/O，运行时无法在不保留整段历史或阻塞存储的前提下维持同样的同步读保证。
- 恢复（resume）之后需要的状态应当来自**投影（projection）**或事件投递本身；按需展示历史要走**显式异步分页与渐进加载**。
- fork 等确实需要完整历史序列的少数操作仍然合法，但需要一次显式的存储读取，且不构成新增同步调用waiver 的依据。
- 测试文件（含 `scripts/**/*.spec.{ts,tsx}`）对这三个名字有 lint 例外；**生产源码的调用必须带行级 waiver**，删除调用时同步删除 waiver。

### 4.4 插件自有消息投影（`@messageProjection`）🟢

依据：`2026-09-11-plugin-owned-message-projections.md`。这是本版新增的**扩展点**，配合 `2026-09-10-image-offload-events.md` 的图片卸载事件：

- 事件的所有者插件提供一个纯函数 `SessionMessageProjection`：**一个事件类型 + 一个对前序历史的同步解释器**；它校验完整的持久化负载，并返回对既有消息的**不可变更新，保留其身份**。
- Session 侧只负责原子接受、共享的在线/离线折叠与内容生成缓存失效；**Session 中不含任何图片选择或图片投影实现**。
- `SessionEventMap` 成员上的 `@messageProjection` 标签生成"必需解释器"清单；**缺失定义会拒绝 append、seeded 创建、restore 与纯折叠**。
- 每个事件只能有一个注册所有者；通过 `ctx.sessions.registerMessageProjection()` 以 fiber 拥有的 effect 注册。移除定义会使待定的已提交决策与缓存读取失效；**替换定义需要恢复会话**。
- 离线读取方显式传入定义；**不存在进程级全局注册表，也不在 import 期注册**。

### 4.5 实验包：公开发布 + 默认产物隔离 🟡

依据：`2026-09-12-publish-all-experimental-packages.md`、`2026-09-12-experimental-publication-denylist.md`、`2026-09-12-default-product-experimental-isolation.md`。

- 实验包**默认公开**，用**私有 denylist** 保留少数不发布的例外。
- 新增静态闸门 `scripts/verify-default-product-isolation.ts`：从每个应用与 Python 运行时出发跟随 dependencies / optionalDependencies / peerDependencies，解析 workspace 与 npm 别名，识别实验包（按 npm 前缀或仓库目录），并读取运行时 import、安装态 profile bundle 列表、bundle patch、内置 agent 预设与声明的配置树；**用生产 patch 解析器加载默认 Web 层并用启动时同一个 patch 引擎组合**。
- 新增构建期闸门 `scripts/web-product-bundle-isolation.ts`：跟随 Vite 实际输出边（含懒加载 chunk、worker、CSS 依赖与 assets）。
- 发布校验 `scripts/release/verify-packed-install.ts` 跟随 `@deepseek-ai/dsh` 的安装态依赖图。
- 结论：**实验包可以公开发布，但不会加入默认安装与默认组合**。

### 4.6 权限读侧拆分：进程目录 vs 会话选择 🔴

`packages/interaction/permission-presets/src/types.ts`（两个 tag 已核对）：

| | rc.2 | 0.1.6-alpha.1 |
|---|---|---|
| 类型 | `PermissionSelect { options; currentValue }` | 拆成 **`PermissionCatalog { options }`**（**进程级**目录）+ **`PermissionSelection { currentValue }`**（会话投影） |
| 会话投影 `permissions` | `PermissionSelect` | **`PermissionSelection`**（只剩当前值） |
| 目录读取 | 从投影读 | 进程级目录：`@Remote('catalog') catalog(): PermissionCatalog` |
| 客户端组件 | `ui-conversation/…/skeleton/PermissionSelect.tsx` | 同名 `.tsx` 迁至 `ui-permission-presets/src/client/`，目录经订阅 + 世代检查获取 |

设计意图：可选预设目录是**进程级**事实（随实时贡献变化），当前选择是**会话级**事实——因此**目录变化不写会话事件**。集成方需要改为"join 会话 `currentValue` 与进程 `catalog()`"。

同时新增实验包 `packages/experimental/auto-review`（`permissionPresets.registerAuto` 发布当前会话专有的 `auto` 身份，在每次工具调用前由模型审查并按 low/medium/high 分级）——它是**实验性的，且明确不是确定性安全边界**。

### 4.7 执行缝的接口变更：两条同步 API 异步化 🔴 + 一条新增通道 🟢

本版把"准备一个可执行进程"从同步改成**可等待、可取消**，这是第三方执行类插件唯一需要改代码的地方。均已逐 tag 核对源码：

| 接口 | rc.2 | 0.1.6-alpha.1 | 提交 |
|---|---|---|---|
| `ShellExecutor.start(spec)` | `ShellProcess` | **`Promise<ShellProcess>`** | `caa69608fb refactor(sandbox): await cancellable preparation in process consumers` |
| `SandboxProvider.confine(argv, policy)` | `ConfinedArgv` | **`Promise<ConfinedArgv>`**，新增可选第三参 `signal?: AbortSignal` | 同上（提供者侧 `32de4412dc`） |
| `ctx.subprocess` 受管启动 | 仅 stdio | **新增 fd 7 双工控制通道**（`SUBPROCESS_CONTROL_FD=7` / `SUBPROCESS_CONTROL_ENV='DSH_SUBPROCESS_CONTROL'`，提交 `d8efd4f8cd`） | 🟢 增量 |

核验命令（可复现）：

```powershell
git show dsh-v0.1.5-rc.2:packages/shell/shell/src/index.ts    | Select-String 'abstract start'
git show dsh-v0.1.6-alpha.1:packages/shell/shell/src/index.ts | Select-String 'abstract start'
git show dsh-v0.1.5-rc.2:packages/sandbox/sandbox/src/index.ts    | Select-String 'confine\('
git show dsh-v0.1.6-alpha.1:packages/sandbox/sandbox/src/index.ts | Select-String 'confine\('
```

配套影响：`tool-bash` / `tool-pwsh` 改用新增的 **processJob** 路径；`ctx.subprocess` 新增 `terminalEnvironment()` 与 `SubprocessTerminalHandle.resize`，spawn 规格新增**必填** `terminalType`。设计记录 `2026-09-11-subprocess-control-pipe.md`。

---

## 五、GUI 与桌面端（本版改动最大的面）

按变更文件数：`packages/client` 512、`apps/web` 106、`apps/desktop` 77、`packages/host` 35。

### 5.1 侧栏终端

| 提交 | 内容 |
|---|---|
| `2026-09-09-web-sidebar-terminal.md` | 侧栏终端能力 |
| `feat(web): launch terminals from provider guide menus` | 从提供者指南菜单启动终端 |
| `feat(web): choose and remember terminal shells` | 选择并记住 shell |
| `feat(web): show common shells by default` | 默认展示常见 shell |
| `feat(web): follow application theme in sidebar terminals` | 终端跟随应用主题 |
| `2026-09-11-incremental-terminal-retention.md` | 终端保留策略（增量） |

### 5.2 阅读与预览

- **置顶折叠头**：`2026-08-03-web-sticky-collapsible-headers.md`、`feat(web): pin Think and compaction headers sticky while scrolling`，以及修复 `fix(web): hold a compaction summary's code banner below the pinned header`（PR #4195）。
- **Mermaid 全屏查看器**：`feat(docs): add fullscreen Mermaid diagram viewer`、`refactor(docs): simplify Mermaid fullscreen viewer controls`，设计记录 `2026-09-14-docs-mermaid-viewer.md`。
- **引用预览**：`feat(web): preview file and skill references in the sidebar`、`2026-09-10-composer-reference-previews.md`。
- **文档预览精修**：`2026-09-11-sidebar-document-preview-polish.md`；文件树跨标签保留滚动位置（`feat(sidebar-files): restore the tree's scroll position across tab switches`）。
- **连接指示器**：`2026-09-10-connection-indicator-refinements.md`、`feat(sidebar): refine the connection indicator states and styling`。

### 5.3 会话与设置

- `feat(workspace): restore archived sessions from a settings page` + `2026-09-12-session-unarchive-settings-page.md`：**从设置页恢复已归档会话**。
- `feat(web): gate agent preset selection behind a setting (#3870)`：agent 预设选择被一个设置项控制。
- `feat(web): add hours to turn duration labels`（`2026-09-09-turn-duration-hour-unit.md`）。
- `2026-09-14-chat-presentation-defaults.md`、`fix(web-diff-context)`。

### 5.4 前端结构重构与测试设施

本版对 client 做了一批**无行为变更的结构重构**，值得记录的是测试设施的换代：

| 提交 | 含义 |
|---|---|
| `refactor(conversation): extract/move main panel & content component` | 会话视图拆分为独立模块 |
| `refactor(web): isolate draft editor implementation without behavior changes` | 草稿编辑器隔离 |
| `refactor(client): remove fixture-only API residue` | 清理只服务夹具的 API 残留 |
| `refactor(client): replace browser fixture with RemoteMock` | **用 `RemoteMock` 取代浏览器夹具** |
| `feat(remote-mock): expose typed native mocks and controlled streams` | 类型化 mock 与可控流 |
| `feat(test-support): assemble real clients with native test fixtures` | 用原生测试夹具组装真实客户端 |
| `2026-09-06-client-assembly-test-line.md` | 客户端组装测试线 |

### 5.5 桌面端与打包

- `feat(desktop): run runtime host from asar`、`feat(cli): force runtime resolution in pkg builds`：**打包载体强制 runtime 解析**（见 4.1）。
- Electron Host 以 `ELECTRON_RUN_AS_NODE=1` 运行，从 ASAR 读取 dsh 树，并把可执行 ASAR 条目映射到 electron-builder 的 unpacked 树。
- `2026-09-08-desktop-bundled-runtime-and-external-plugins.md`、`2026-09-09-desktop-immediate-window-and-direct-start.md`、`2026-09-09-desktop-in-place-profile.md`、`2026-09-09-desktop-build-release-validation.md`。

---

## 六、文档与工程体系

### 6.1 新增「持久化类型变更档案」体系

本版新增 `docs/persistence-changes/**` 整棵目录，并把"持久化类型变更"变成可评审、可追溯的档案：

```
docs/persistence-changes/
├── README.md / README.zh.md / README.i18n.yaml
├── historical-formats/{v0,v1,v2}.{md,zh.md,schema.json,i18n.yaml}
├── releases/dsh-v0.0.1-rc.1 … 每个已发布 tag 一份（md + schema.json + i18n）
└── 变更条目：2026-09-11-initial / 2026-09-12-auto-review-error-metadata / 2026-09-14-image-offload
```

配套：`docs/persistence-schema.json`、`docs/cookbook/reviewing-persistence-type-changes.{md,zh.md}`，以及设计记录 `.agents/notes/implemented/process/2026-09-11-persistence-type-history.md`。

配合仓库根 `AGENTS.md` 的规则（"已发布的代际永不移动、覆盖或删除；前驱既不隐含回退也不隐含降级支持"），这套档案是**会话数据兼容性的公开账本**。

### 6.2 新增/变更的闸门脚本

| 脚本 | 状态 |
|---|---|
| `scripts/verify-default-product-isolation.ts` | 🆕 |
| `scripts/verify-repository-references.ts` | 🆕（配合 `feat: enforce maintained repository reference policy`） |
| `scripts/web-product-bundle-isolation.ts` | 🆕 |
| `scripts/verify-public-repository-links.ts` | 变更 |
| `scripts/verify-vendored-links.ts` | ❌ 删除 |
| `scripts/verify-package-readme-model-experience.ts`、`scripts/verify-md-links.ts` | 变更 |

### 6.3 新增子系统文档

`docs/subsystems/` 新增 5 篇（每篇含 `.md` / `.zh.md` / `.i18n.yaml`）：`browser-use`、`computer-use`、`ptc-runtime`、`ssh`、`mcp`；删除 `code-runtime`。

### 6.4 CI 与流程

- `2026-09-09-blacksmith-failover-leg.md`（构建机备用腿）、`2026-09-09-parallel-macos-notarization.md`（macOS 并行公证）。
- `2026-09-07-issue-policy-module-ownership.md`、`2026-09-07-selective-issue-policy-evaluation.md`、`refactor(ci): separate issue policy rules transport and lifecycle owners`。
- `2026-09-06-agent-request-freeze-evidence.md`、`2026-09-09-nontransactional-loader.md`、`2026-09-10-derived-workspace-recency.md`。

### 6.5 未落地但已立项的下一步（proposed notes）

`.agents/notes/proposed/` 在本版新增 7 篇，代表 0.1.6 之后的方向，**均未实现**：

- `2026-09-06-logical-session-storage-rebuild.md`
- `2026-09-10-session-capability-protocols.md`
- `2026-09-10-session-data-compatibility.md`
- `2026-09-10-session-developer-transition.md`
- `2026-09-10-session-refactor-faq.md`
- `2026-09-14-composer-model-and-draft-editor.md`
- `2026-09-08-desktop-uninstall-preserve-dsh-home.md`

其中前五篇构成一组**会话存储重构**提案，与本版"同步历史读取废弃"（4.3）方向一致，值得在升级前留意。

---

## 七、tag 之后的 master 变更（未发布）

> 本 tag 发布后，master 上又合入了一波**启动提速**改动（PR #4192 `worktree-bootfast2`）。
> 它们**不在本文的 tag 快照内**，详情见 [`14-post-tag-master.md`](14-post-tag-master.md)。

| 提交 | 主题 | 一句话 |
|---|---|---|
| `42286726c8` | `perf(web): defer client combo assembly` | 客户端 combo 脚本改为首次 `GET` 才拼接；source map 不再参与启动；**`fetchBundle()` 变为异步** |
| `eb8cc594b3` | `feat(util): add caller-relative lazy require` | **新增包** `@deepseek-ai/dsh-lazy-require`（314 → 315 个 `package.json`） |
| `232ab768a9` | `perf(runtime): defer optional native dependencies` | `sharp` / koffi FFI / Windows 进程检查 / 终端等可选原生依赖改为首用加载 |
| `e459e32637` | `perf(typert): materialize generated schemas on first use` | **`TypertCodec` 的 strict 变体由 `schema` 改为 `create()` 工厂** |

区间合计：130 files changed, 1272 insertions(+), 496 deletions(-)，`origin/master` = `0d1f50007f`。

---

## 八、插件作者速查

### 8.1 需要动作（🔴 / 🟡）

| 变更 | 动作 |
|---|---|
| `DshManifest` 不再暴露 `configTrees` / `sessionFormatMigration` / `moduleFallback` | 改用 `DshPackageManifest`；内部字段改用其归属实现 |
| `Session.eventAt()` / `snapshotEvents()` / `ownEvents()` 废弃 | 新代码不要调用；改用投影或异步分页读取 |
| profile 解析换代 | 升级/替换已加载包后**必须重启进程** |
| `packages/e2b` 移除 | 改用 `packages/ssh` 或自有 provider |
| `packages/code-runtime` → `packages/ptc-runtime` | 依赖与 `ctx.ptcRuntime` 调用改名；**执行基底也换了**（见 1.2） |
| `ShellExecutor.start()` / `SandboxProvider.confine()` 异步化 | 实现或调用这两处的插件加 `await`；`confine` 可传取消信号 |
| headless `--session-id` | 必须指向已存在会话；首轮省略该参数 |
| `ralph` 默认关闭 | 需要时按 3.1 的恢复配方显式启用（`ptc` 需两行同改） |
| Session 日志上报默认开启 | 私有部署需显式 `enabled: false` |

### 8.2 只是增量（🟢）

- `packages/ssh`：新增能力缝实现，不新增模型工具。
- MCP resources / server instructions：新增，不改变既有工具调用面。
- 插件自有消息投影（`@messageProjection`）：新增扩展点。
- 子进程双工控制管道、GUI 侧全部改动。

### 8.3 版本坐标提醒

- 本版**未**推进 `SESSION_FORMAT_VERSION`（仍为 **3**），`docs/session-format-status.md` 的 `latestReleasedVersion` 仍记录为 3（evidenceTag `dsh-v0.1.5-alpha.1`）。
- 所有包版本号统一升级为 `0.1.6-alpha.1`；插件若以 `@deepseek-ai/dsh-client-*` 等包做 peer 依赖，需同步放宽/对齐版本范围。

---

## 九、证据与复现

```powershell
cd E:\test\rewrite-agently\deepseek-harness

# 版本坐标
git rev-parse dsh-v0.1.5-rc.2 dsh-v0.1.6-alpha.1
git log -1 --format='%h %ad %s' --date=iso dsh-v0.1.6-alpha.1

# 规模
git rev-list --count dsh-v0.1.5-rc.2..dsh-v0.1.6-alpha.1        # 800
git log --merges --oneline dsh-v0.1.5-rc.2..dsh-v0.1.6-alpha.1 | Measure-Object   # 250
git diff --stat dsh-v0.1.5-rc.2..dsh-v0.1.6-alpha.1 | Select-Object -Last 3

# 结构变化
git ls-tree --name-only dsh-v0.1.5-rc.2 packages/
git ls-tree --name-only dsh-v0.1.6-alpha.1 packages/

# 本版新增设计记录（Agent Notes）
$o = git ls-tree -r --name-only dsh-v0.1.5-rc.2 .agents/notes/
$n = git ls-tree -r --name-only dsh-v0.1.6-alpha.1 .agents/notes/
(Compare-Object $o $n | Where-Object SideIndicator -eq '=>').InputObject
```

**主要依据文件**（均为 0.1.6-alpha.1 工作区路径）：

- `docs/subsystems/{browser-use,computer-use,ptc-runtime,ssh,mcp}.md`
- `docs/persistence-changes/`、`docs/cookbook/reviewing-persistence-type-changes.md`、`docs/persistence-schema.json`
- `packages/util/package-manifest/src/types.ts`、其 `README.md` / `README.zh.md`
- `.agents/notes/implemented/**` 中本版新增的 70+ 篇设计记录（清单见 `_analysis_output/dsh016/RECON.md`）
- `packages/README.md`（52 组权威分组表）

---

*文档生成时间: 2026-09-17*
*数据源: dsh-v0.1.6-alpha.1 (0a15e36e7f) vs dsh-v0.1.5-rc.2 (fb2c4b9e69)*
