# v0.1.6 插件迁移深度指南

> **版本对比**: `dsh-v0.1.5-rc.2` (`fb2c4b9e69`) → `dsh-v0.1.6-alpha.1` (`0a15e36e7f`)
> **面向读者**: 已发布或正在维护 DSH 插件的作者、profile/preset 维护者、私有部署方
> **结论先行**: 本版**没有新的会话格式（Session format）跃迁**（`SESSION_FORMAT_VERSION` 仍为 3），
> 但有 **4 项需要插件作者或部署方动手的契约变化**、**3 项影响所有用户的默认值变化**，
> 以及 **4 个可用作扩展点的新能力族**。

---

## 变更分级速览

| 级别 | 变更 | 谁需要动手 |
|---|---|---|
| 🔴 必须 | profile 包解析改为进程内代际，**升级/替换已加载包后必须重启进程** | 所有插件开发者 |
| 🔴 必须 | headless `--session-id` 只认领已存在会话 | CLI/SDK 调用方 |
| 🔴 必须 | 升级后 `pkg` / Electron 载体强制 runtime 解析，不再物化链接 | 打包分发方 |
| 🔴 必须 | `ShellExecutor.start()` / `SandboxProvider.confine()` 改为返回 Promise | 执行类插件 |
| 🔴 必须 | 权限读侧拆分：`PermissionSelect` 类型被 `PermissionCatalog` + `PermissionSelection` 取代 | 读取 `permissions` 投影的集成方 |
| 🟡 建议 | `DshManifest` 公开面收窄，改用 `DshPackageManifest` | 引用了 manifest 类型的插件 |
| 🟡 建议 | 同步会话事件读取三个方法废弃 | 读取会话历史的插件 |
| 🟡 建议 | `packages/e2b` 移除、`code-runtime` → `ptc-runtime` 改名 | 依赖这两组的插件/配置 |
| 🟡 注意 | Session 日志上报默认开启 | 私有部署方（隐私） |
| 🟡 注意 | `ralph` 默认关闭 | 依赖默认工具目录的组合 |
| 🟢 增量 | MCP resources / instructions、ssh、browser-use、computer-use、消息投影 | 需要新能力时 |

---

## 一、公共包 manifest：从 `DshManifest` 到 `DshPackageManifest`

**依据**：`packages/util/package-manifest/src/types.ts`、该包 `README.md` / `README.zh.md`、Agent Note `.agents/notes/implemented/architecture/2026-09-10-public-package-manifest.md`。

### 1.1 rc.2 的形态

`packages/util/package-manifest` 包在 rc.2 **已经存在**，但其公开类型 `DshManifest` 一次性描述了 `bundle`、`profile`、`client`，**以及三个内部字段**：

```
DshManifest（rc.2）
├── bundle?
├── profile?
├── client?
├── configTrees?              ← 实验性镜像打包器拥有
├── sessionFormatMigration?   ← 工作区目录生成器拥有
└── moduleFallback?           ← 启动器生成
```

### 1.2 0.1.6-alpha.1 的形态

```ts
import type { DshClientManifest, DshPackageManifest } from '@deepseek-ai/dsh-package-manifest'

const client: DshClientManifest = { platform: 'web' }
const manifest: DshPackageManifest = {
  name: 'example-dsh-plugin',
  version: '1.0.0',
  engines: { node: '>=24', dsh: '0.1.5-alpha.1' },
  dsh: {
    manifestVersion: 1,
    bundle: { patch: './cordis.patch.yml' },
    client,
  },
}
```

（示例取自该包 `README.md` 的公开用法章节。）

| 类型 | 描述范围 |
|---|---|
| `DshPackageManifest` | **新增**。DSH 使用的 package.json 字段，`name` 与 `version` 必填；**不是完整的 npm schema** |
| `DshManifest` | 仅描述 `dsh` 下的**公共作者字段**：`manifestVersion` / `bundle` / `profile` / `client` |
| `DshEnginesManifest` | 顶层 `engines`：`dsh` / `node` / `npm` 均为可选字符串，允许其它 engine 名 |
| `DshBundleManifest` | `patch`（相对声明包根的补丁路径） |
| `DshProfileManifest` | `bundles`（有序 bundle 层）、`patchReload`（`'live' \| 'startup'`） |
| `DshClientManifest` | `platform`、`inject`、`immediately`、`external` |

### 1.3 迁移动作

| 你的代码 | 迁移后 |
|---|---|
| `import type { DshManifest }` 并读取 `configTrees` | 这些字段已不在公共类型中；改用其**归属实现**（镜像打包器 / 目录生成器 / 启动器） |
| `import type { DshManifest }` 并读取 `bundle` / `profile` / `client` | 可继续用 `DshManifest`，但建议外层用 `DshPackageManifest` 描述整个 package.json |
| 本地 profile（不发布） | 读取方用 `Partial<DshPackageManifest>`，因为 profile 无需发布身份 |
| 想声明宿主兼容性 | 用**顶层** `engines.dsh`（SemVer 范围，可为精确预发布版本），与 `engines.node` / `engines.npm` 并列 |

### 1.4 两个必须知道的"非强制"事实

> **兼容性是声明式的。** 当前的安装器与加载器**不校验** `dsh.manifestVersion`，也**不校验** `engines.dsh`——声明一个范围不会拒绝不兼容宿主，也不会校验 SemVer 语法。

> **该包只提供类型。** 不提供解析器、getter 辅助、文件检查或默认值；每个消费者自己负责 JSON 解析、字段校验与默认值解析。

---

## 二、读取面收窄：会话事件与权限目录

**依据**：`.agents/notes/implemented/architecture/2026-09-09-deprecate-synchronous-session-event-reads.md`。

### 2.1 被废弃的三个方法

| 方法 | 状态 |
|---|---|
| `Session.eventAt()` | `@deprecated` |
| `Session.snapshotEvents()` | `@deprecated` |
| `Session.ownEvents()` | `@deprecated` |

**规则**：

- 现有逻辑**可以暂不迁移**；
- **禁止新增调用**；
- **禁止新增**暴露同样同步历史访问的**别名或包装**。

### 2.2 为什么（这是存储方向的必然结果）

同步访问任意事件位置，要求**完整的会话事件序列常驻内存**。而存储方向恰好相反：一旦历史事件需要存储 I/O，运行时无法在不保留整段历史、或不阻塞于存储的前提下，维持同样的同步读保证。即便新调用只读一个旧事件，也在加深这个依赖；resume 之后反复扫描历史，会让普通领域逻辑依赖历史存储，而不是它真正需要的状态。

### 2.3 迁移写法

| 场景 | 迁移方向 |
|---|---|
| resume 之后需要的状态 | 用**投影（projection）**；恢复期重建该状态，之后从新提交的事件增量维护 |
| 处理"当前事件" | 处理投递给你的当前事件，而不是回看历史 |
| 按需展示历史内容 | **显式异步分页 + 渐进加载**，每次读取限定在请求的窗口内 |
| fork 等确实需要完整历史序列的操作 | 仍然合法，但需要**一次显式的存储读取**；这**不构成**新增同步调用的豁免 |

### 2.4 lint 规则（容易踩）

- 测试文件（含 `scripts/**/*.spec.{ts,tsx}`）对 `snapshotEvents` / `eventAt` / `ownEvents` **这三个名字**有例外；
- **其它**废弃名字在测试里仍然是错误；
- 生产源码中的调用必须带**行级 waiver** 并注明是延后迁移还是废弃读取器之间的委托；删除调用时**同步删除 waiver**——把 waiver 复制到新的生产调用是违规。

### 2.5 权限读侧拆分：`PermissionSelect` 类型被删除 🔴

本版把"可选预设目录"（**进程级**事实）与"当前选择"（**会话级**事实）从同一个类型里拆开（已核对 `packages/interaction/permission-presets/src/types.ts` 两个 tag）：

| | rc.2 | 0.1.6-alpha.1 |
|---|---|---|
| 类型 | `PermissionSelect { options: PresetOption[]; currentValue: string }` | 拆成 **`PermissionCatalog { options }`**（进程级目录）与 **`PermissionSelection { currentValue }`**（会话投影） |
| 会话投影 `permissions` | `PermissionSelect` | **`PermissionSelection`（只剩 `currentValue`）** |
| 目录获取 | 从投影里读选项 | 走进程级目录：`@Remote('catalog') catalog(): PermissionCatalog` |
| 客户端组件 | `ui-conversation/…/skeleton/PermissionSelect.tsx` | 同名 `.tsx` **迁到** `ui-permission-presets/src/client/PermissionSelect.tsx`（从会话骨架移出） |

**为什么重要**：目录随实时贡献变化，与 Session 历史**故意分离**——目录变化**不写会话事件**。

**迁移动作**：任何读取 `permissions` 投影拿"可选预设列表"的集成方，必须改为"**join** 会话的 `currentValue` 与进程的 `catalog()`"；旧 `PermissionSelect` 类型已不存在。

---

## 三、profile 包解析代际：重启语义变了

**依据**：`.agents/notes/implemented/architecture/2026-09-09-profile-resolution-generations.md`；实现位于 `packages/boot/app-boot/src/profile-resolution/`。

### 3.1 机制对比

| 维度 | rc.2 | 0.1.6-alpha.1 |
|---|---|---|
| 桥接实现 | 启动时算优先级 → **物化为**共享软链 / profile 自有链接 / 打包代理包 | 启动时算出**一个不可变 `ResolutionGeneration`**，可安装进 Node 的 ESM 与 CJS 解析器 |
| 磁盘副作用 | 跨进程、跨安装持久；需要协调与加锁 | **runtime 模式不创建、不更新、不退役任何链接** |
| 元数据暴露 | 生成的代理 manifest 会暴露给元数据读取器 | runtime 模式不再产生这些文件 |
| 更新方式 | 逐项改动现存表 | `PluginPackages.replace()` **一次引用替换**发布完整增量后继 |
| 失败语义 | — | 构建期读完所有必要 manifest；出错则**当前代际保持不变**（原子） |

### 3.2 三种模式

| 模式 | 谁在用 | 行为 |
|---|---|---|
| `link` | 普通 Node 启动器（**缺省**） | 保持既有文件系统物化行为 |
| `runtime` | **pkg 可执行文件、Electron Host** | 只在进程内安装，不落盘 |
| `dual` | 内部对比路径 | 要求 Node 的磁盘结果与代际一致，不一致即失败 |

### 3.3 对插件作者的实际约束 ⚠️

1. **升级、替换或删除一个已加载的包，必须重启进程。** 原文明确：Node 的 ESM Module Map、CJS 缓存、既有对象引用与运行中的 Worker 都可能保留旧的模块身份；代际替换**不承诺卸载模块**。
2. **代际替换只接受增量（additive）。** 任何改变既有包目录或版本的候选代际都会被拒绝。
3. 已运行的 Worker 保留它继承的那一代；**发布后继代际的调用方必须重启这些 Worker**。
4. runtime 模式下，`dsh-module-fallback` / 共享 fallback 这类**旧磁盘产物会被当作"虚拟插入位置"跳过**——它们对老进程、link-only 启动与回滚仍然可用，但不参与 runtime 模式的选择。

### 3.4 已知实现边界（原文明列）

- 保证覆盖安装后该线程内 Node 默认的 `import`、`import()`、`import.meta.resolve`、`require`、`require.resolve`；
- **不覆盖**已链接的模块、自定义 `vm` linker、非 Node 的不透明导入方、第三方 Worker；
- 不使用 `module.registerHooks`，也不替换 `Module._findPath`；最终解析仍交由 Node（exports、条件、主文件、子路径、扩展名、原生缓存、错误码）。

---

## 四、执行面契约变更：PTC 改名 + 两条同步 API 异步化

### 4.1 包级变化

| rc.2 | 0.1.6-alpha.1 |
|---|---|
| `packages/code-runtime/code-runtime` | `packages/ptc-runtime/ptc-runtime` |
| `packages/code-runtime/code-runtime-worker-thread` | `packages/ptc-runtime/ptc-runtime-node` |
| `docs/subsystems/code-runtime.md` | `docs/subsystems/ptc-runtime.md`（本版新增） |

相关提交序列（说明这**不只是改名**）：

```
feat(code-runtime): execute Node programs through confined processes
refactor(code-runtime): name the Node runtime provider
feat(code-runtime): complete sandboxed Node execution and Session fixtures
refactor(ptc): align runtime packages and services with PTC naming
```

### 4.2 契约形态（`docs/subsystems/ptc-runtime.md`）

- 能力缝通过 **`ctx.ptcRuntime`** 提供；
- `PtcRunRequest` 承载程序源码、绑定、取消与可选执行选项；provider 的 `resolve` **校验受支持的选项并应用部署默认值**，产出带显式目录与截止时间的 `PtcRunSpec`；
- 超时语义：**省略 → provider 默认**；**数字 → 有上限的耗时预算**；**`null` → 无耗时截止**；
- **PTC 执行是可选的，不属于 agent-loop 主干（spine）**；
- 新增控制面：`feat(ptc): expose per-program timeout and sandbox approval controls`（按程序的超时与沙箱审批控制）、`feat(ptc): present provider execution guidance in logged program schema`（在被记录的程序 schema 中呈现提供者执行指引）。

### 4.3 迁移动作

| 你的代码/配置 | 迁移后 |
|---|---|
| `dependencies` 指向 `@deepseek-ai/dsh-code-runtime*` | 改为 `@deepseek-ai/dsh-ptc-runtime*` |
| 通过旧服务名获取运行时 | 改用 `ctx.ptcRuntime` |
| 依赖 `docs/subsystems/code-runtime.md` 作为参照 | 改读 `docs/subsystems/ptc-runtime.md` |
| 工作流（workflow）内自行搭建沙箱 | 本版起 workflow 复用 PTC 沙箱（`2026-09-13-workflow-ptc-sandbox-reuse.md`） |

**"不只是改名"的三条硬证据**（均可用 `git show <tag>:<path>` 复核）：

| 证据 | rc.2 | 0.1.6-alpha.1 |
|---|---|---|
| 提供者的隔离基底常量 | `code-runtime-worker-thread`：`readonly isolation = 'worker-thread'` | `ptc-runtime-node`：`readonly isolation = 'process'` |
| 包的 peer 依赖 | `code-runtime/package.json` 仅 peers `@deepseek-ai/cordis` | `ptc-runtime/package.json` **多出 `@deepseek-ai/dsh-sandbox`** |
| 执行基底 | 隔离 Node worker 线程 | 受沙箱约束的**受管 Node 进程**（Agent Note `2026-09-11-sandboxed-node-ptc-runtime.md` 自述 supersedes 其 worker-based realization） |

类型面同时扩张：`CodeRunRequest`（`program` / `bindings` / `signal`）→ `PtcRunRequest`（**新增 `cwd` / `timeoutMs: number \| null` / `sandboxPolicy`**），新增 `PtcRunSpec` 与 `PtcRunSandbox`，失败种类 6 → 8（新增 `protocol`、`sandbox-unavailable`）。

### 4.4 `ShellExecutor.start()` 与 `SandboxProvider.confine()` 异步化 🔴

**这是本版对第三方执行类插件唯一需要改代码的破坏性变更**（提交 `caa69608fb`，提供者侧 `32de4412dc`）：

| 接口 | rc.2 | 0.1.6-alpha.1 |
|---|---|---|
| `ShellExecutor.start(spec)` | `ShellProcess` | **`Promise<ShellProcess>`** |
| `SandboxProvider.confine(argv, policy)` | `ConfinedArgv` | **`Promise<ConfinedArgv>`**，新增可选第三参 `signal?: AbortSignal` |

核验：

```powershell
git show dsh-v0.1.5-rc.2:packages/shell/shell/src/index.ts    | Select-String 'abstract start'
git show dsh-v0.1.6-alpha.1:packages/shell/shell/src/index.ts | Select-String 'abstract start'
git show dsh-v0.1.5-rc.2:packages/sandbox/sandbox/src/index.ts    | Select-String 'confine\('
git show dsh-v0.1.6-alpha.1:packages/sandbox/sandbox/src/index.ts | Select-String 'confine\('
```

**迁移动作**：

1. 实现 `ShellExecutor` 或 `SandboxProvider` 的插件：把方法改为 `async`，返回值包成 Promise；
2. 调用 `ctx.shell.start(...)` 的插件：加 `await`；
3. 调用 `ctx.sandbox.confine(...)` 的插件：加 `await`，并按需把取消信号作为第三个参数传入；
4. 顺带注意：`spawn` 规格新增**必填** `terminalType`；`ctx.subprocess` 新增 `terminalEnvironment()` 与 `SubprocessTerminalHandle.resize`。

### 4.5 子进程双工控制通道 🟢

受管启动（managed launch）现在携带一条**双工控制管道**，为进程控制提供独立于普通 stdio 的通道：`SUBPROCESS_CONTROL_FD=7`、`SUBPROCESS_CONTROL_ENV='DSH_SUBPROCESS_CONTROL'`（提交 `d8efd4f8cd`，设计记录 `2026-09-11-subprocess-control-pipe.md`）。这是增量能力，不破坏既有 stdio 使用方式。

---

## 五、E2B 退役

**依据**：`.agents/notes/implemented/simplification/2026-09-11-remove-e2b-providers.md`；提交 `refactor(e2b): retire remote execution providers`。

| 移除的包 |
|---|
| `packages/e2b/e2b` |
| `packages/e2b/fs-e2b` |
| `packages/e2b/subprocess-e2b` |

**影响**：任何把 provider 指向 E2B 的 profile / preset 配置会在启动期解析失败（配置中的引用不存在）。远端执行的正规替代路径是本版新增的 **`packages/ssh`**，或自建 provider。

---

## 六、MCP：官方 SDK 协商 + resources + instructions

**依据**：`docs/subsystems/mcp.md`（本版新增）、`.agents/notes/implemented/feature/2026-09-12-mcp-sdk-protocol-negotiation.md`、`2026-09-12-mcp-resources-and-instructions.md`、`2026-09-12-mcp-resources-in-profiles.md`。

| 变更 | 内容 |
|---|---|
| 协议协商 | 改用**官方 SDK** 协商现代或受支持的旧版协议修订 |
| Resources | 当服务器配置在调用方作用域内时，共享工具可**发现并读取 resources** |
| Instructions | **server instructions 加入被记录的 system prompt** |
| Profile 集成 | profile 中配置的服务器同样激活 resource 工具 |

对插件作者的含义：

- MCP 工具仍然是**普通 harness 工具**——带取消、权限检查、被记录的结果与受支持的图片输出；
- **资源与指令有作用域**：作用域外的 Session 既不能执行这些请求，也收不到该服务器的 instructions；
- 协议协商由 SDK 承担，插件不需要自己实现版本握手（`dsh-mcp-client` 拥有服务器配置）。

---

## 七、DeepSeek 默认协议改为 Messages

**依据**：`.agents/notes/implemented/feature/2026-09-07-deepseek-messages-adapter.md`；提交 `5ca77db865`（PR #4089）、`4af56cf808`。

### 7.1 结构

同一个 `deepseek-official` 路由与 `llm-deepseek` 设置命名空间下同时服务两种协议：

```
packages/llm/llm-deepseek/
├── common/                    # 配置、模型目录、能力解析、Files 生命周期（共享）
└── protocols/
    ├── chat-completions/      # 序列化、流转换、传输
    └── messages/              # 同上
```

Cordis YAML 通过 `protocol` 选择实现，**默认 `messages`**；一方组合（含 Web）继承该默认。

### 7.2 部署方必须知道的四点

1. **Web 端不显示协议选择器**，并按 `feat(llm): sync V41 Messages catalog and keep Web on Chat Completions` **保持 Web 走 Chat Completions**。
2. `baseURL` 与 `apiKeyEnv` **两协议共享**，没有嵌套的每协议配置映射。
3. 无端点覆盖时，Messages 的官方默认端点是 `https://api.deepseek.com/anthropic`。
4. ⚠️ **自定义 `baseURL` 或环境覆盖永远不会被改写成与协议匹配**——切换协议后，**已有的端点覆盖必须自己支持所选协议**。

### 7.3 插件侧提示

- 协议变更**保留 provider id 与已保存的模型选择**（用户不需要重新选模型）；
- 助手内容块（assistant blocks）仍是唯一持久化的模型可见内容，协议回放元数据以版本化 `ReplayEnvelope` 承载，**不引入新的会话格式**；
- 不可用的回放元数据遵循既有的**回放降级规则**：省略签名并告警，同时保留持久化内容。

---

## 八、默认值与默认行为变化

### 8.1 `ralph` 默认关闭 🔴

**依据**：`.agents/notes/implemented/simplification/2026-09-12-ralph-off-in-shipped-defaults.md`。

| 位置 | 变化 |
|---|---|
| `packages/bundle/base/cordis.patch.yml` | `tool-ralph` 行 `disabled: true` |
| `standard` / `ptc` / `cordis` 预设 | 同上 |
| `ptc` 预设 | **额外** `workflow-ptc` 也 disabled（`ralph` 关闭后该引擎在 `ptc` 中没有消费者） |
| `packages/bundle/web-app/cordis.patch.yml` | 为自己的层重申该 disable |
| `minimal` 预设 | 原本就没有该行 |

**恢复配方**（三选一，视你的平面而定）：

1. 基于 base 的 profile：在 `$DSH_HOME/cordis.patch.yml` 或 `--patch` 文件里用 overlay 行重新启用；
2. Web 会话：预设文件**不接受 patch**，必须把预设复制到 `$DSH_HOME/.agent-presets` 并**换一个新 id**（复用内置 id 会被内置根遮蔽，且 `copy()` 会拒绝已被任何根提供的 id）；
3. `ptc` 中恢复：`tool-ralph` 与 `workflow-ptc` **两行必须一起恢复**，因为 `tool-ralph` 注入 `ctx.workflowEngine`。

**不变量**：包、工具契约与测试都保留；**已记录过 `ralph` 调用的历史会话仍可回放与渲染**。

### 8.2 Session 日志上报默认开启 🔴（隐私）

**依据**：`.agents/notes/implemented/architecture/2026-09-14-session-log-upload-default.md`。

- `session-log-deepseek.Config.enabled` **默认 `true`**（每个进程）；显式 `enabled: false` 关闭；
- 插件**不再检查测试运行器/快照的环境变量**来决定是否上报；
- 上报内容是**完整的、未被接受的规范会话日志后缀**，含消息文本、工具参数与结果、工作区路径与反馈，发往解析出的 DeepSeek 端点或配置网关；
- **不增加提示词 token 或模型可见内容**；请求体会显著变大；
- **OTel 独立于此贡献**——关闭 OTel 不会关闭它。

**升级检查清单**：私有部署应显式确认 `session-log-deepseek.enabled` 的取值（headless 与 ACP 语料库 base patch、Web scaffold 均已显式关闭）。

### 8.3 headless `--session-id` 只认领已存在会话 🔴

提交 `ea84ad31b6474cabbc8befe774703ee0e6119789`：

```
feat(headless): require --session-id to name an existing Session
```

- 传入一个**没有存储记录**的 id，会在**任务执行前直接失败**，而不是创建一个空历史让调用方误以为在恢复；
- 首轮应**省略**该参数；运行时在开场的 `session` 事件中报告铸造出的 `session-<uuid>` 身份，由监督进程持久化，并在之后每次唤醒时指名使用。

---

## 九、新能力族的提供者注册契约（可用于你的插件）

三个新能力族都不是"新工具"，而是**新的能力缝 / 注册点**。若你想提供实现，契约如下。

### 9.1 browser-use

- 服务：**`ctx.browserUse`**；`register` 接受**一个由提供者拥有的名字**并返回 effect disposer；
- **第二次注册无论名字都会失败**；
- **服务本身不含**浏览器对象、共享操作类型、dispatch 方法、资源生命周期或运行时选择器；
- 浏览器资源属于**确切的 live Agent 与 Session**（不只是可复用的 Session id）；调用跨 turn 保留状态；运行时销毁会关闭已启动的资源；**reload / fork 不继承已启动的 profile**；
- attachment（附着已有浏览器）会**在该提供者实例内为一个 Session 独占**该外部浏览器；清理时断开**但不关闭**外部浏览器。

### 9.2 computer-use

- 服务：**`ctx.computerUse`**；同样**只注册一个名字、第二次注册失败**；
- 服务不含提供者对象、共享操作类型、dispatch 方法、**Session 锁**或运行时选择器；
- 提供者 teardown **保留注册**直到工具准入停止且自有工作与资源关闭；
- **一个提供者注册不拥有"观察—动作—校验"工作流**，跨 Session 协调由调用方负责；
- 取消只停止等待并传播到 driver，**不承诺回滚已经送达的桌面输入**。

### 9.3 ssh

- 实现**已有的**文件系统 / 子进程 / 沙箱 API，**不引入 SSH 专属模型工具**；
- 传输分两条：管理 RPC 走 helper 的 SSH exec 流；stdin/stdout/stderr/终端输出/可选 fd 7 控制流量走**各自单独认证的转发 Unix socket**，每条流有独立 channel window；
- `processPathFromHostPath()` 对 SSH **不可用**——安装在远端不等于任意宿主路径可移植；`NodePtcRuntime` 因此需要**显式安装并摘要校验**的远端 bootstrap。

---

## 十、新扩展点：插件自有消息投影

**依据**：`.agents/notes/implemented/architecture/2026-09-11-plugin-owned-message-projections.md`、`2026-09-10-image-offload-events.md`。

这是本版**新增的扩展点**：如果某个事件会**派生地改变消息内容**（图片卸载是第一个用例），该事件的所有者插件提供：

```text
SessionMessageProjection = 一个事件类型 + 一个对前序历史的同步解释器
```

规则：

| 规则 | 内容 |
|---|---|
| 纯函数 | 解释器校验**完整的持久化负载**，返回对既有消息的**不可变更新，保留其身份** |
| 核心不参与 | Session 只负责原子接受、共享的在线/离线折叠、内容生成缓存失效；**Session 中不含任何图片选择或投影实现** |
| 必需性 | `SessionEventMap` 成员上的 `@messageProjection` 标签生成"必需解释器"清单；**缺失定义会拒绝 append、seeded 创建、restore 与纯折叠** |
| 单一所有者 | 每个事件**一个**注册所有者，经 fiber 拥有的 `ctx.sessions.registerMessageProjection()` effect 注册 |
| 生命周期 | 移除定义会使待定的已提交决策与命中该定义的缓存读取失效；**替换定义需要恢复会话** |
| 无全局态 | **不存在进程级全局注册表，也不在 import 期注册**；离线读取方显式传入定义 |
| 互斥 | 一个投影事件**不能同时**声明 surface operation |

---

## 十一、Breaking Changes 汇总

### v0.1.5-rc.2 → v0.1.6-alpha.1

| # | 变更 | 级别 | 迁移动作 |
|---|---|---|---|
| 1 | `DshManifest` 不再暴露 `configTrees` / `sessionFormatMigration` / `moduleFallback` | 🟡 | 改用 `DshPackageManifest`；内部字段改用归属实现 |
| 2 | `Session.eventAt()` / `snapshotEvents()` / `ownEvents()` 废弃 | 🟡 | 新代码禁止调用；改用投影或异步分页 |
| 3 | profile 解析代际化 | 🔴 | 升级/替换已加载包后**重启进程** |
| 4 | pkg / Electron 载体强制 runtime 解析 | 🔴 | 打包分发方不再依赖物化链接；确认远端/ASAR 路径解析 |
| 5 | `packages/e2b`（3 包）移除 | 🟡 | 改用 `packages/ssh` 或自有 provider |
| 6 | `packages/code-runtime` → `packages/ptc-runtime` | 🟡 | 依赖名与服务名（`ctx.ptcRuntime`）同步改名 |
| 7 | `ralph` 默认关闭 | 🟡 | 按 8.1 配方显式启用（`ptc` 需两行同改） |
| 8 | Session 日志上报默认开启 | 🟡 | 私有部署显式 `enabled: false` |
| 9 | headless `--session-id` 语义收紧 | 🔴 | 只传已存在 id；首轮省略 |
| 10 | DeepSeek 默认协议变为 Messages | 🟡 | 端点覆盖必须支持所选协议 |
| 11 | 实验包默认公开发布 + 默认产物隔离闸门 | 🟡 | 依赖实验包的产品需确认隔离闸门通过 |
| 12 | `ShellExecutor.start()` → `Promise<ShellProcess>` | 🔴 | 实现或调用处加 `async` / `await` |
| 13 | `SandboxProvider.confine()` → `Promise<ConfinedArgv>`（新增 `signal?`） | 🔴 | 实现或调用处加 `await`，按需传取消信号 |
| 14 | `PermissionSelect` 类型删除，拆为 `PermissionCatalog`（进程级）+ `PermissionSelection`（会话投影） | 🔴 | 读 `permissions` 投影的集成方改为 join 会话 `currentValue` 与进程 `catalog()`（第 2.5 节） |

### 明确**没有**变化的部分

| 项 | 状态 |
|---|---|
| `SESSION_FORMAT_VERSION` | **3**（未变） |
| `docs/session-format-status.md` 的 `latestReleasedVersion` | **3**（evidenceTag `dsh-v0.1.5-alpha.1`，未变） |
| MCP 工具调用面 | 兼容（协议协商由官方 SDK 承担） |
| 已记录的 `ralph` 会话回放 | 仍可回放与渲染 |

---

## 十二、升级检查清单

- [ ] 依赖里是否出现 `dsh-code-runtime*` 或 `dsh-e2b*`？→ 按第四、五节改名/替换
- [ ] 是否 `import type { DshManifest }` 并读取内部字段？→ 按第一节迁移
- [ ] 是否有新的 `eventAt()` / `snapshotEvents()` / `ownEvents()` 调用？→ 改用投影或异步分页
- [ ] 是否有生产代码遗留的废弃调用 waiver？→ 删除调用时同步删 waiver
- [ ] 是否有在运行时替换/升级插件包的工作流？→ 必须重启进程（Worker 也要重启）
- [ ] 是否实现/调用了 `ShellExecutor.start()` 或 `SandboxProvider.confine()`？→ 加 `await`（第 4.4 节）
- [ ] 传给 `ctx.subprocess` 的 spawn 规格是否补上了**必填** `terminalType`？
- [ ] 是否读取 `permissions` 投影拿可选预设列表？→ 改为 join 会话 `currentValue` + 进程 `catalog()`
- [ ] 组合/预设里是否引用了 `tool-ralph` 的默认存在？→ 按 8.1 显式启用
- [ ] 私有部署是否确认 `session-log-deepseek.enabled`？
- [ ] 调用 headless 的监督进程是否遵循"首轮省略 `--session-id`、后续指名"？
- [ ] 自定义 DeepSeek `baseURL` 是否支持新默认协议（Messages）？
- [ ] 是否有把 MCP resources/instructions 的可见范围当作全局的假设？→ 它们有作用域

---

## 十三、延伸阅读

| 主题 | 位置 |
|---|---|
| 本版完整变更要点 | [`CHANGELOG.md`](CHANGELOG.md) |
| 架构总览与包规模变化 | [`architecture-overview.md`](architecture-overview.md) |
| 各模块增量 | `01-cordis-framework.md` … `13-browser-and-computer-use.md` |
| 官方子系统文档（新增） | `docs/subsystems/{ssh,ptc-runtime,browser-use,computer-use,mcp}.md` |
| ⚠️ tag 之后 master 的未发布变更 | [`14-post-tag-master.md`](14-post-tag-master.md)（含 `fetchBundle()` 变异步、typert `create()` 工厂、新增 `dsh-lazy-require`） |
| 持久化类型变更档案 | `docs/persistence-changes/`、`docs/cookbook/reviewing-persistence-type-changes.md` |
| 包分组权威表 | `packages/README.md`（52 组） |
| 本版新增设计记录清单 | `E:\test\rewrite-agently\_analysis_output\dsh016\RECON.md` |

---

*文档生成时间: 2026-09-17*
*数据源: dsh-v0.1.6-alpha.1 (0a15e36e7f) vs dsh-v0.1.5-rc.2 (fb2c4b9e69)*
