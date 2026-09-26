# 【第 03 篇】Shell / 子进程 / 终端 / SSH —— 命令执行的四条缝与一个新包组

> **版本**：dsh-v0.1.6-alpha.1（commit `0a15e36e7f`）｜**上版**：dsh-v0.1.5-rc.2（commit `fb2c4b9e69`）
> 难度：🟡 进阶（建议先读第 01、02 篇）
> 覆盖目录：`packages/shell/`、`packages/subprocess/`、`packages/terminal/`、`packages/ssh/`
> 事实来源：本地只读仓库 `E:\test\rewrite-agently\deepseek-harness`（HEAD 已在 tag `dsh-v0.1.6-alpha.1`）

## 目录

- [0 引言](#0-引言)
- [1 概述](#1-概述)
- [2 核心概念](#2-核心概念)
- [3 包结构](#3-包结构)
- [4 关键类型](#4-关键类型)
- [5 数据流](#5-数据流)
- [6 测试覆盖](#6-测试覆盖)
- [7 与上游/下游的关系](#7-与上下游的关系)
- [8 本版本变更要点（rc.2 → 0.1.6-alpha.1）](#8-本版本变更要点rc2--016-alpha1)

---

## 0 引言

本文覆盖 DSH 的"执行侧"四个包组：一次性命令（shell）、裸进程与终端原语（subprocess）、持久 PTY 会话（terminal），以及本版新增的远程执行世界（ssh）。

| 包组 | 目录 | 官方子系统文档 | 本版状态 |
|---|---|---|---|
| shell | `packages/shell/` | `docs/subsystems/shell.md` | 修改（服务接口语义变更） |
| subprocess | `packages/subprocess/` | `docs/subsystems/subprocess.md` | 修改（控制通道、终端环境事实、resize） |
| terminal | `packages/terminal/` | `docs/subsystems/terminal.md` | 实现修改；**子系统文档本身未改动** |
| ssh | `packages/ssh/` | `docs/subsystems/ssh.md` | **新增包组** |
| （已移除）e2b | `packages/e2b/` | — | **整体移除** |

「terminal 子系统文档未改动」的依据：`git -C <repo> diff --name-status dsh-v0.1.5-rc.2..dsh-v0.1.6-alpha.1 -- docs/subsystems` 的输出不含 `terminal.md`，而 `shell.md`、`subprocess.md`、`sandbox.md` 以 `M` 出现，`ssh.md` 以 `A` 出现。

各组的改动量（`git diff --shortstat`）：`packages/ssh` 63 files / +7105；`packages/subprocess` 51 files / +1859 / -447；`packages/shell` 76 files / +1324 / -609；`packages/terminal` 22 files / +517 / -88；`packages/sandbox` 38 files / +600 / -176。

决策记录索引（`.agents/notes/implemented/`）：`architecture/2026-09-11-posix-ssh-runtime.md`、`architecture/2026-09-11-subprocess-control-pipe.md`、`simplification/2026-09-11-remove-e2b-providers.md`、`bug-fix/2026-09-11-incremental-terminal-retention.md`、`feature/2026-09-09-web-sidebar-terminal.md`、`bug-fix/2026-09-12-linux-scope-direct-kill-settlement.md`。

---

## 1 概述

四条缝 + 一条新增能力（角色引自 `docs/capability-seams.md`）：

| 服务 | ctx 键 | 角色 | 提供者 | 消费者 |
|---|---|---|---|---|
| 命令执行 | `ctx.shell` | `seam` | `bash-local`、`bash-sandbox`、`pwsh-local` | `tool-bash`、`tool-pwsh`、`hooks-claude-code`、`hooks-codex` |
| 裸进程 | `ctx.subprocess` | `seam` | `subprocess-local`、**`subprocess-ssh`** | `bash-local`、`bash-sandbox`、`terminal-bash`、`lsp-stdio`、`subagent-acp`、`subagent-codex`、`subagent-claude-code` |
| 持久终端 | `ctx.terminals` | `seam` | `terminal-bash` | `tool-terminal` |
| 远程连接 | `ctx.ssh` | `core`（新增） | — | `fs-ssh`、`subprocess-ssh`、`sandbox-ssh` |

三条既有缝的分工没有变化：一次性命令走 shell、持续会话走 terminal、裸进程走 subprocess。本版新增的是**同一套缝的远程实现**——`packages/ssh` 替换本地提供者，而不是引入新的模型工具（`docs/subsystems/ssh.md` 第 5 行："it introduces no SSH-specific model tools"）。

---

## 2 核心概念

| 术语 | 英文 | 含义 |
|---|---|---|
| 能力缝 | capability seam | Service Definition + Service Provider + Consumer 三件套（`docs/capability-seams.md`） |
| 请求 / 规格分离 | request / spec split | 可选字段由实现方 `resolve(request)` 显式补全为 spec，`run()` 不兜默认值 |
| 托管环境 | `DSH_*` managed environment | 宿主托管的 `DSH_` 前缀环境事实；`DSH_ENV_PREFIX` 定义于 `packages/subprocess/subprocess/src/types.ts` |
| 托管进程范围 | managed range | 提供者负责的进程树/会话范围；"直接进程退出"与"范围静默"是两件独立事实 |
| 控制通道 | control pipe | 本版新增：`stdio.control: 'pipe'` 请求的独立字节双工通道，落在 fd 7 |
| 可取消的准备 | cancellable preparation | 本版新增：沙箱包裹与执行器启动前的准备阶段可被 `AbortSignal` 取消 |
| 执行世界 | execution world | 文件提供者与进程提供者共享的同一套路径/进程坐标 |

---

## 3 包结构

**`packages/shell/`**：`shell`（服务定义）、`bash-local`、`bash-sandbox`、`pwsh-local`、`pwsh-sandbox`、`shell-env`、`tool-bash`、`tool-bash-persistent`、`tool-pwsh`、`tool-pwsh-persistent`。

**`packages/subprocess/`**：`subprocess`（本版新增 `./control` 子路径导出）、`subprocess-local`（本版新增 `control-spawn.ts`、`output.ts`）、`win32-process`（本版新增 `control-stdio.ts`）。

**`packages/terminal/`**：`terminal`（`src/index.ts` 与 `src/types.ts` 本版**无改动**）、`terminal-bash`（本版重写 `src/session.ts` 的保留缓冲）、`tool-terminal`。

**`packages/ssh/`（本版新增）**：`ssh`（连接、helper 身份与传输生命周期，`ctx.ssh`）、`fs-ssh`（远程文件身份与受守卫的原子变更，注册到 `ctx.fs`）、`subprocess-ssh`（可执行文件查找、进程、控制流与终端，注册到 `ctx.subprocess`）、`sandbox-ssh`（远程文件效果约束与 enforcement 事实，注册到 `ctx.sandbox`）。四个包的 `version` 字段在 0.1.6-alpha.1 中均为 `0.1.6-alpha.1`。

---

## 4 关键类型

**shell 缝**（`packages/shell/shell/src/index.ts`）：

```ts
abstract class ShellExecutor extends Service {
  abstract resolve(request: ShellExecRequest): ShellExecSpec
  abstract run(spec: ShellExecSpec): Promise<ShellRunResult>
  abstract start(spec: ShellExecSpec): Promise<ShellProcess>   // 本版：由 ShellProcess 改为 Promise<ShellProcess>
}
```

`ShellRunResult` 的 `exitCode: number | null` 与 `signal: NodeJS.Signals | null` 在本版补注："准备阶段过期也返回 null"。

**subprocess 缝**（`packages/subprocess/subprocess/src/types.ts`）本版新增/修改的成员：

| 成员 | 形态 |
|---|---|
| `SubprocessStdio.control` / `SubprocessHandle.control` | `control?: 'pipe'` / `readonly control: Duplex \| undefined` |
| `SubprocessTerminalEnvironment` | `{ platform: 'posix' \| 'windows'; defaultShell?: string }` |
| `SubprocessTerminalSpawnSpec.terminalType` | `terminalType: string`（新增必填） |
| `SubprocessTerminalHandle.resize` | `resize(cols, rows): Promise<void>` |
| `SubprocessRuntime.terminalEnvironment` | `abstract terminalEnvironment(signal?): Promise<SubprocessTerminalEnvironment>` |
| `SubprocessExecutableNotFoundError` | 新增导出类 |

**控制通道协议**（`packages/subprocess/subprocess/src/control.ts`，新增）：

```ts
export const SUBPROCESS_CONTROL_FD = 7
export const SUBPROCESS_CONTROL_ENV = 'DSH_SUBPROCESS_CONTROL'
export function openInheritedControlChannel(): Duplex
```

**SSH 连接**（`packages/ssh/ssh/src/index.ts`）：

```ts
declare class SshConnection extends Service {
  static Config: schema<Config>
  readonly ready: Promise<Hello>
  get nodeExecutable(): string
  get bootstrapPath(): string
  async request<T>(method, params, result, signal?, wait?): Promise<T>
  async connectStream(endpoint, signal?): Promise<Socket>
  dispose(): Promise<void>
}
```

`Config` 字段与默认值（`packages/ssh/ssh/README.md`）：`host`/`node`/`helper`/`helperHash`/`workspace` 必填；`requestTimeoutMs` 30000、`maxFrameBytes` 67108864、`maxPending` 128、`leaseMs` 30000；`bootstrapPath`/`bootstrapHash` 成对可选。

---

## 5 数据流

**前台命令（本地）**：`模型 → ctx.tools → tool-bash → ctx.shell.resolve() → spec → bash-local.run(spec) → ctx.subprocess.spawn() → ShellRunResult → tool/result`。

**前台命令（沙箱，本版语义变化最大）**：`bash-sandbox.run(spec)` 调用 `runArgv(spec, async signal => ctx.sandbox.confine(argv, policy, signal))`；准备阶段被同一个 deadline 取消时返回 `spawnRequested: false` 的结果而**不 spawn**，准备成功则把 argv 交给 `ctx.subprocess.spawn()`。`runArgv` 现返回 `{ result, spawnRequested }`（`packages/shell/bash-local/src/index.ts`）。

**后台命令**：`tool-bash` → `ctx.jobs.start()` 准入（同步）→ `processJob(signal => ctx.shell.start(ctx.shell.resolve({ ...request, signal })), render)`；准入之后才进行异步准备，取消会中止准备并 join 迟到的进程句柄。`processJob` 与 `processOutcome` 定义于 `packages/shell/tool-bash/src/background.ts`。

**SSH 远程**：部署侧 OpenSSH alias → `dsh-ssh` 校验 helper 摘要 → `ctx.ssh` 就绪 → `fs-ssh`/`subprocess-ssh`/`sandbox-ssh` 分别注册到 `ctx.fs`/`ctx.subprocess`/`ctx.sandbox`；每条程序流使用独立 SSH channel 与 256-bit TLS-PSK 认证的转发 Unix socket。

---

## 6 测试覆盖

`tests/` 目录下文件数（`git ls-tree -r --name-only <tag> <group>` 后按 `/tests/` 过滤计数）：

| 包组 | rc.2 | 0.1.6-alpha.1 | 增量 |
|---|---|---|---|
| `packages/ssh` | 0 | 29 | +29（全新） |
| `packages/shell` | 25 | 31 | +6 |
| `packages/subprocess` | 23 | 27 | +4 |
| `packages/sandbox` | 25 | 27 | +2 |
| `packages/terminal` | 9 | 10 | +1 |
| `packages/fs` | 25 | 25 | 0 |

值得注意的新增测试：`bash-sandbox` 与 `pwsh-sandbox` 各有一个 `tests/foreground-timeout.spec.ts`（各 157 行，配 `async-confinement-failure.ts`、`pending-confinement.ts` 两个 fixture），覆盖"准备阶段超时"这一新语义；`tool-bash` 与 `tool-pwsh` 各有 `tests/background-start.spec.ts`（各 116 行）覆盖异步准备的后台启动；`packages/subprocess` 新增三处控制通道测试；`packages/terminal/terminal-bash/tests/session-buffer.spec.ts`（295 行）覆盖增量保留缓冲的字节/行交互、消费、代理对切分与 4 MiB 保留；`packages/ssh/ssh/tests/live.e2e.ts`（304 行）需要显式配置的一次性远程工作区。`benchmarks/terminal-io/` 为本版新增基准目录（rc.2 的 `benchmarks/` 下无 `terminal` 匹配项）。

---

## 7 与上游/下游的关系

- **上游**：`ctx.shell` 的实现经 `ctx.subprocess` spawn 进程；`bash-sandbox`/`pwsh-sandbox` 额外消费 `ctx.sandbox` 与 `ctx.sandboxPolicy`；`subprocess-ssh` 消费 `ctx.ssh`；`ctx.sandbox` 在本版由同步 `confine` 改为异步，影响所有消费者。
- **下游**：`tool-bash`/`tool-pwsh` 注册进 `ctx.tools`；后台进程经 `ctx.jobs`；`terminal-bash` 注册进 `ctx.terminals`，`tool-terminal` 是模型面消费者。
- **模型可见面**：本版 `bash`/`pwsh`/terminal 工具的 schema 未见对应 SSH 参数；SSH 通过替换提供者进入部署，不新增模型工具。

---

## 8 本版本变更要点（rc.2 → 0.1.6-alpha.1）

### 8.1 新增 `packages/ssh` 包组（4 个包，+7105 行）

#### 8.1.1 关键提交（`git log --no-merges dsh-v0.1.5-rc.2..dsh-v0.1.6-alpha.1 -- packages/ssh`）

| commit | 标题 |
|---|---|
| `4fb0fdac68` | `feat(ssh): checkpoint POSIX helper and remote providers` |
| `72226bd061` | `feat(ssh): authenticate streams and join remote process cleanup` |
| `c6e531e45b` | `refactor(ssh): retain TLS ownership of raw socket errors` |
| `d951a49038` | `fix(ssh): preserve remote filenames in file URLs` |
| `1c5a201af8` | `fix(ssh): reject timeouts above the native timer range` |
| `969e968e0e` | `fix(ssh): disable signal-triggered helper inspection` |
| `abb7c6a49d` | `fix(ssh): join transport cleanup and preserve collected output` |
| `561bfc3bbb` | `fix(ssh): join authenticated stream teardown and validate package closure` |
| `b5fd914306` | `test(ssh): isolate backend availability from helper dispatch` |
| `7673f90d18` | `docs(ssh): define trusted runtime installation prerequisites` |
| `c886f26b91` | `docs(ssh): record the administrative timer range` |
| `d3fa7030ef` | `fix(ssh): retain failed results and join all process cleanup` |
| `ac43c2656f` | `fix(ssh): propagate output closure and bound exit observations` |
| `28c4daa66c` | `fix(ssh): keep completion cleanup under release ownership` |
| `e892c1abf5` | `test(ssh): preserve stream reads across supported Node versions` |
| `83d121c8c0` | `docs(ptc): align runtime terminology and naming decision links` |
| `7c9bb5914c` | `refactor(ptc): align runtime packages and services with PTC naming` |
| `33d89aee77` | `feat(web): choose and remember terminal shells` |

#### 8.1.2 `ssh` 包的文件构成（0.1.6-alpha.1）

| 文件 | 行数 | 角色 |
|---|---|---|
| `packages/ssh/ssh/src/index.ts` | 294 | `SshConnection` 服务：就绪校验、管理 RPC、流转发、disposal |
| `packages/ssh/ssh/src/helper.ts` | 253 | 远端 helper 侧实现 |
| `packages/ssh/ssh/src/helper-processes.ts` | 441 | 远端进程与受管范围 |
| `packages/ssh/ssh/src/protocol.ts` | 235 | 管理 RPC 协议 |
| `packages/ssh/ssh/src/helper-entry.ts` | 17 | helper 入口 |
| `packages/ssh/ssh/src/schemas.ts` | 85 | 请求/响应校验 |
| `packages/ssh/ssh/src/stream-security.ts` | 47 | 流端点的 TLS-PSK 认证 |

`tests/` 下共 22 个文件（21 个 spec/e2e + 1 个 fixture `tests/fixtures/helper.ts`）：`collection`、`connection-disposal`、`helper-boundaries`、`helper-cleanup-join`、`helper-failure-settlement`、`helper-finalization`、`helper-lifecycle`、`helper-processes`、`helper-runtime`、`identifiers`、`inspector-signal`、`live.e2e`、`management-capacity`、`protocol`、`protocol-boundaries`、`protocol-disposal`、`startup-behavior`、`stream-capability`、`stream-lifetime`、`stream-rebind`、`stream-timeout`。

「配套测试 22 个」与「`packages/ssh` 共计 29 个 tests 文件」的差额来自另外三个包：`fs-ssh` 1 个、`sandbox-ssh` 1 个、`subprocess-ssh` 5 个。

#### 8.1.3 设计要点（引自 `.agents/notes/implemented/architecture/2026-09-11-posix-ssh-runtime.md` 的 `## Decision`）

1. 部署方拥有的 OpenSSH alias 把本地 Harness 连到已安装的 POSIX helper；文件、子进程、沙箱提供者共享该 helper，Harness 保留 Cordis 对象、模型传输、权限、回调与会话持久化。
2. **约束是异步且可取消的**：运行中的 helper 在子进程提供者收到字面 argv 之前，通过其加载的沙箱提供者解析每条策略。`ShellExecutor.start()` 在准备之后 resolve 一个 `Promise<ShellProcess>`；通用 job 准入仍是同步的，工具自有的 `JobHooks` 在预检之后开始异步 shell 准备、取消挂起的准备并 join 迟到的进程句柄。
3. 私有管理 RPC 与每条程序流使用**独立的 SSH channel**；远端预留在 payload 开始前创建所请求的流端点。stdout/stderr 不能承载管理回复，暂停一条输出通道不会消耗 fd 7 的流控窗口。
4. 每条流通过私有管理 RPC 获得一把全新的 **256-bit TLS 预共享密钥**；TLS 1.2 `PSK-AES256-GCM-SHA384` 认证两端并在流发布前保护后续字节，密钥**从不作为流前导传输**。取消在包裹之后移交给 TLS 包装器；清理先关闭包装器再关闭底层 socket，使原生 TLS 读取不会比其传输活得更久。
5. 收集的 stdout/stderr 通过只更新输出观察的 handler 携带**有界尾部快照**；捕获在快照等待传输期间继续。
6. 就绪校验安装 helper 的摘要，并在配置 PTC 时校验安装的 Node bootstrap 摘要——**这些检查钉住预期部署产物，不认证恶意的远端操作系统**。
7. helper 以 `--disable-sigusr1` 启动，避免同用户进程通过 `SIGUSR1` 打开其 Node 调试器。
8. 路径规范化属于文件所在之处：共享策略解析器保留绝对执行世界拼写，实施约束的提供者在自己文件系统上解析符号链接与 `..`。**SSH 不提供 host-path 投影**，因此 Node 执行需要显式安装的远端 bootstrap。
9. 连接丢失使挂起操作失效，**不重连、不重放**；helper EOF、信号与心跳租约启动远端原生清理。客户端不能把租约到期转成"观察到成功终止"——被中断的变更或启动可能有未知结果。

#### 8.1.4 明确排除的范围（同 Note 的 `## Consequences`）

- 初始组合范围是 **POSIX headless 与自定义 profile**；假定宿主文件系统的 Web workspace 消费者需要各自集成。
- 网络限制、进程可见性隔离、敌意宿主证明、持久远端句柄与自动产物供给**不在本提供者族内**。
- 持久远端重连需要独立的操作身份与恢复设计，**不能复用断连后的活回调句柄**（`## Deferred work`）。

#### 8.1.5 三个配对提供者

| 包 | 源文件 | 测试文件 | 行数 |
|---|---|---|---|
| `fs-ssh` | `src/index.ts`（107 行） | `tests/provider.spec.ts`（197 行） | — |
| `subprocess-ssh` | `src/index.ts`（344 行） | 5 个 spec（`lifecycle`、`process-behavior`、`shell-discovery`、`stream-wait-lifecycle`、`terminal-behavior`） | 57+295+58+190+211 |
| `sandbox-ssh` | `src/index.ts`（33 行） | `tests/provider.spec.ts`（89 行） | — |

`sandbox-ssh` 只有 33 行源码——它是"把远程本地沙箱提供者的 full/partial 披露与平台限制原样透出"的薄适配层（`2026-09-11-posix-ssh-runtime.md`："File-effect confinement delegates to the remote local sandbox provider and retains its full/partial disclosure and platform limitations."）。

### 8.2 子进程控制管道（fd 7）

#### 8.2.1 是什么

`SubprocessStdio` 新增可选 `control: 'pipe'`，`SubprocessHandle` 暴露 `control: Duplex | undefined`；目标进程通过 `@deepseek-ai/dsh-subprocess/control` 的 `openInheritedControlChannel()` 打开 fd 7。发布包因此新增了 `./control` 子路径导出。

#### 8.2.2 为什么（`2026-09-11-subprocess-control-pipe.md` 的 `## Problem`）

> "A managed Node program can write arbitrary bytes to stdout and stderr. A host protocol sharing either stream cannot distinguish those bytes from program diagnostics without restricting ordinary Node behavior. Windows process wrappers also require explicit descriptor inheritance before the child runtime allocates its own descriptors."

#### 8.2.3 平台差异与继承规则

| 平台 | 行为 |
|---|---|
| POSIX | 启动器跨 exec 保留 fd 7 |
| Windows（普通 Job 与受限令牌启动器） | 把管道放在 CRT 启动描述符表的 7 号槽，保留标准句柄，payload 中 3–6 号槽保持关闭 |
| 两侧共同 | 使用 Node 的 `overlapped` stdio 处置（POSIX 等于 `pipe`，Windows 创建 `FILE_FLAG_OVERLAPPED` 句柄），读写可独立推进，包括子进程在宿主发送任何内容之前先发消息 |
| 两侧共同 | 每个包装器在移交所有权之后关闭自己的载体；句柄继承只在进程创建前后启用 |

#### 8.2.4 边界与后果

- 该通道**不授予任何宿主能力**：子进程仍不可信，每个宿主工具请求都需要常规派发与审批检查。
- subprocess 服务**不解释控制消息、不为调用方缓冲**——有界分帧、消息校验、背压与端点关闭由消费者拥有。
- 提供者独立跟踪未关闭的控制端点（含其受管范围退出之后），disposal 在尝试范围拆除之后关闭剩余端点。

#### 8.2.5 被否决的替代方案（同 Note 的 `## Alternatives considered`）

在 stdout 上分帧会依赖拦截程序输出（原生代码可产出任意字节）；同步 Windows 管道会让阻塞读阻止同一句柄上的并发写，父先回声掩盖该死锁；复用 Node IPC 会把 payload 请求耦合到 Windows 监督者的管理协议；Windows 上延迟替换 fd 7 可能覆盖内部描述符；每平台使用不同描述符号只增加 bootstrap 分支而不减少原生启动工作。

#### 8.2.6 实现落点

- `packages/subprocess/subprocess-local/src/control-spawn.ts`（新增 35 行）：`controlPipe(child, control)` 从 Node stdio 元组读第 7 槽；`controlEnvironment(env, control)` 拒绝调用方伪造 `DSH_SUBPROCESS_CONTROL`，并在请求时打上标记。
- `packages/subprocess/win32-process/src/control-stdio.ts`（新增 47 行）：Windows 侧载体。
- `packages/subprocess/subprocess-local/src/output.ts`（新增 212 行）：从 `spawn.ts` 抽出的 `OutputCollector`、私有 spill 目录（`0700`，`mkdtempSync(join(tmpdir(), 'dsh-subprocess-'))`）与 `prepareManagedProcessBinding`；`spawn.ts` 因此净减约 200 行。
- 后续收敛提交：`83a45679df`（Windows overlapped 载体）、`838da1d07e`（调用方控制流与进程静默分离）、`562e7f364e`（disposal 等待控制端点关闭）。

### 8.3 沙箱准备改为异步可取消

#### 8.3.1 接口变更

```diff
- abstract confine(argv: readonly string[], policy: SandboxPolicy): ConfinedArgv
+ abstract confine(argv: readonly string[], policy: SandboxPolicy, signal?: AbortSignal): Promise<ConfinedArgv>
```

**归因**：`git log -S` 确认该改动由 `caa69608fb refactor(sandbox): await cancellable preparation in process consumers` 引入；同族的 `32de4412dc refactor(sandbox): await cancellable process preparation` 先处理提供者侧。

#### 8.3.2 文档措辞变化（`docs/subsystems/sandbox.md`）

| | 措辞 |
|---|---|
| rc.2 | "`ctx.sandbox.confine(argv, policy)` returns a `ConfinedArgv` or throws `SandboxUnavailableError` with code `SANDBOX_UNAVAILABLE` when no usable backend exists." |
| 0.1.6 | "`await ctx.sandbox.confine(argv, policy, signal)` resolves policy paths and returns a `ConfinedArgv` from the execution world, or rejects with `SandboxUnavailableError` and code `SANDBOX_UNAVAILABLE` when no usable backend exists. The optional signal cancels resolution before launch." |

#### 8.3.3 连带改动清单（逐文件核对）

| 文件 | 变化 |
|---|---|
| `packages/sandbox/sandbox/src/index.ts` | `confine` 改 `Promise`；新增 `export { classifyRunnerFailure, isRunnerSpawnFailure, matchesSignature } from './diagnostics.ts'` |
| `packages/sandbox/sandbox-local/src/index.ts` | `confine` 声明为 `async`，入口 `signal?.throwIfAborted()`，内部对 `policy.workspaceRoot` 做 `canonicalPath`，返回 `Promise.resolve<ConfinedArgv>(...)` |
| `packages/sandbox/sandbox-policy/src/index.ts` | `resolveWorkspaceRoot` 不再 canonicalize，改为要求绝对执行世界拼写（否则抛 `sandbox-policy: workspace root must be an absolute execution-world path`） |
| `packages/shell/bash-sandbox/src/index.ts` | `confine` 调用移入 `runArgv` 的异步准备回调；`start` 改为 `async` 并直接 `await this.confine(..., spec.signal)` |
| `packages/shell/pwsh-sandbox/src/index.ts` | 31 行同步调整 |
| `packages/sandbox/sandbox-windows-acl/src/index.ts` / `runner.ts` / `spawn.ts` | 10 / 5 / 2 行调整 |

**注意**：本版 `sandbox-policy` 的 `resolveWorkspaceRoot` 只做"必须绝对"的校验，不再做文件系统解析——这是"策略解析器保留执行世界拼写、实施约束的提供者在自己宿主上解析"这一分工的直接体现。

### 8.4 `ShellExecutor.start()` 由同步改为返回 Promise

#### 8.4.1 变更

```diff
- abstract start(spec: ShellExecSpec): ShellProcess
+ abstract start(spec: ShellExecSpec): Promise<ShellProcess>
```

**归因**：同样是 `caa69608fb`；紧随其后的 `73e38e1758 fix(shell): include confinement preparation in foreground deadlines` 把准备阶段纳入前台 deadline。

#### 8.4.2 语义（`packages/shell/shell/src/index.ts` 的新 JSDoc）

> "`start` resolves after launch preparation; cancellation or setup failure rejects before publishing a handle. No timeout applies to background processes. Once published, `done` settles at process close and never rejects; subprocess provider failures settle as `killed` with the error on stderr."

`docs/subsystems/shell.md` 的 Background processes 一节随之改写为"`start()` resolves with a handle after asynchronous launch preparation; cancellation or preparation failure rejects before publication"。

#### 8.4.3 兼容性影响

| 受影响方 | 变化 |
|---|---|
| `bash-local` / `pwsh-local` | `start` 改为 `async`，内部 `Promise.resolve(this.startArgv(...))`；`startArgv` 入口新增 `spec.signal?.throwIfAborted()` |
| `bash-sandbox` / `pwsh-sandbox` | `start` 改为 `override async`，先 `await this.confine(..., spec.signal)` 再 `startArgv` |
| `tool-bash` / `tool-pwsh` | 改用 `processJob(signal => ctx.shell.start(ctx.shell.resolve({ ...request, signal })), render)` |
| 自定义执行器 | 必须改签名，否则编译失败——这是本版对第三方插件的唯一破坏性接口变更 |

#### 8.4.4 `ShellRunResult` 的语义补丁

`exitCode` 与 `signal` 的 JSDoc 改为"准备阶段过期也返回 null"，`timedOut` 因此可以描述"命令从未启动"。`bash-local` 的 `runArgv` 在准备超时时返回：

```ts
{ spawnRequested: false,
  result: { exitCode: null, signal: null, timedOut: true, aborted: false,
            timeoutMs: spec.timeoutMs,
            stdout: { text: '', truncated: false }, stderr: { text: '', truncated: false } } }
```

`bash-sandbox` 在 `spawnRequested === false` 时**不**附加沙箱事实（因为约束从未建立）。

### 8.5 终端：增量保留、终端环境事实与 Web 侧栏终端

#### 8.5.1 `terminal-bash` 的保留缓冲重写

**提交**：`cea837e065 perf(terminal-bash): retain scrollback incrementally`、`68f9708e02 fix(terminal-bash): bound retained storage and status reads`；决策记录 `.agents/notes/implemented/bug-fix/2026-09-11-incremental-terminal-retention.md`。

**问题**：持久终端输出在每个 PTY 回调上都要过 scrollback 与未读发送的字节上限，重建整个保留字符串使回调代价随保留输出增长——4 MiB scrollback 窗口下即便每次只有小块输入也很可观。

**方案要点**（`packages/terminal/terminal-bash/src/session.ts`）：私有 `BoundedTextBuffer` 改为保留字符串链表 + 头偏移 + 聚合 UTF-8 字节数与换行数；新增 `COALESCED_CHUNK_UNITS = 4096` 的尾部聚合；新增 `truncated` / `isEmpty` getter 供发送结算与启动轮询在不组装 scrollback 的情况下检查状态；输入经 UTF-16 复制以在脱离被丢弃控制文本的同时保留孤立代理项。

**本机参考测量**（引自该 Note 的 `### Local reference measurements`；Apple M5 Pro / macOS arm64 / Node v26.5.0，五次新 worker，单位毫秒）：

| 场景 | 旧（eager）样本 | 新（incremental）样本 |
|---|---|---|
| 128 KiB 稳态 / 摄入 | 232.164, 234.564, 219.511, 219.615, 221.434 | 10.493, 10.474, 9.917, 10.524, 10.327 |
| 128 KiB 稳态 / 完成 | 245.365, 247.826, 233.322, 232.854, 234.926 | 19.600, 19.991, 19.290, 20.049, 19.773 |
| 4 MiB 稳态 / 摄入 | 4159.780, 4271.184, 4179.700, 4223.583, 4128.541 | 8.752, 8.584, 8.808, 8.582, 10.073 |
| 5 MiB 发送 / 完成 | 5297.536, 5181.298, 5182.416, 5234.920, 5211.802 | 89.475, 83.310, 88.491, 89.440, 89.339 |

这些是**该 Agent Note 记录的作者本机测量值**，非本机复现结果。该 Note 另记录了真 PTY 诊断：`node -e 'process.stdout.write("x".repeat(5*1024*1024))'` 经构建后的本地 subprocess 提供者，基线样本 106962.523 ms，最终候选样本 249.007 ms。

#### 8.5.2 终端环境事实与 resize

`ctx.subprocess` 新增 `terminalEnvironment(signal?)` 与 `SubprocessTerminalEnvironment`（`platform` + 可选 `defaultShell`），终端句柄新增 `resize(cols, rows)`，终端 spawn 规格新增必填 `terminalType`。`docs/subsystems/subprocess.md` 明确这些事实**来自提供者而非 Web 服务器或浏览器**，并说明 `resolveExecutable` 负责校验 shell 候选、`SubprocessExecutableNotFoundError` 标识可执行文件缺失。

归因：`git log -S "terminalEnvironment"` 命中 `e15a9b1bec feat(web): add interactive sidebar terminals` 与 `0a525601a7 fix(web): harden sidebar terminal lifecycle and recovery`。

#### 8.5.3 Web 侧栏终端

**提交**：`e15a9b1bec`、`0a525601a7`、`33d89aee77 feat(web): choose and remember terminal shells`（后者同时改动 `packages/ssh`，因为 shell 发现走提供者的执行环境）。

**要点**（引自 `2026-09-09-web-sidebar-terminal.md`）：

| 主题 | 结论 |
|---|---|
| 归属 | `api-terminal-controller` 按 Session 拥有用户终端并暴露 `terminal` Remote 命名空间；`ui-sidebar-terminal` 注册右侧栏标签页，使用 xterm.js 与 FitAddon |
| shell 选择 | 发现校验配置候选，**执行默认值优先**；创建只接受当前已发现的路径；浏览器把最后选中的 shell 路径记在源作用域 localStorage 中，不可用时回退当前默认 |
| 沙箱 | 终端进程使用组合的 subprocess 提供者与会话沙箱策略；**变更沙箱模式需要先关闭保留的终端** |
| 生命周期 | 切换标签/会话、折叠、浮动、全屏与浏览器断连都**保留进程**；组件清理与 `TabDomain.signal` 只解除浏览器侧工作 |
| 关闭语义 | 关闭与替换同步移除标签、后台运行清理；Client 先在终端专用 localStorage 键下记录未完成的关闭请求，成功则移除，启动时重试残留请求 |
| 模型隔离 | 终端输出**不产生模型输入、Agent 工具结果或会话事件** |
| 恢复 | 会话 header 挂载时 Client 查询 `terminal.list` 并把 Host 保留的终端打开为新标签；Host 重启不恢复进程 |
| 主题 | 应用主题提供终端默认色；body 读取已解析的 CSS token，只在其变化时更新 xterm |

### 8.6 E2B 组移除及其对 shell/subprocess 的残留影响

**提交**：`c49db8bc8c refactor(e2b): retire remote execution providers`；决策记录 `.agents/notes/implemented/simplification/2026-09-11-remove-e2b-providers.md`。

**移除内容**：`packages/e2b/e2b`、`packages/e2b/fs-e2b`、`packages/e2b/subprocess-e2b`、组 README 与 i18n 文件——`git ls-tree --name-only dsh-v0.1.5-rc.2 packages/e2b/` 的完整列表在 0.1.6 中无对应项。

**移除理由**（同 Note 的 `## Problem`）：PTC 的 Node 约束需要与任意程序 stdin/stdout/stderr **分离的双向控制流量**；被钉住的 `e2b@2.29.1` SDK 只暴露标准进程流与 PTY 输出，没有额外的描述符传输。在 VM 内创建描述符不会把它暴露给 Harness 宿主；桥接它需要独立进度、有界保留、通道关闭、启动发布、命令身份、取消与断连清理——那会把实验变成一个独立的远程传输项目。

**本次逐项核查的残留接口变化**：

| 检查项 | 结论 |
|---|---|
| `ctx.e2b` 服务 | 从 `docs/subsystems/subprocess.md` 的生成式 Cordis 目录中删除（整段 `ctx.e2b — E2BRuntime` 被移除） |
| `ctx.subprocess` / `ctx.fs` 的提供者列表 | `subprocess-e2b` 被删、位置由 `subprocess-ssh` 接替；`fs-e2b` 被删、位置由 `fs-ssh` 接替 |
| 终端异步契约 | **保留**——该 Note 明确 "Terminal allocation, writes, foreground inspection and signalling retain their Promise contracts"，且 "The shared asynchronous interface and its cancellation/ordering tests remain useful independently of E2B" |
| 新增的 `resize` | 由 Web 侧栏终端引入（`e15a9b1bec`），**不是** E2B 的替代品 |
| `packages/shell` 内对 e2b 的引用 | 本版 `packages/shell` 的 76 个变更文件中未出现 e2b 相关删除；该组的非 merge 提交日志无 e2b 标题 |
| PTC 侧 | 该 Note 明确 E2B 退役**不改变 PTC 执行**，也不改变共享的文件、子进程与终端接口 |

**重新引入的条件**（同 Note 的 `## Reintroduction conditions`）：远端提供者需要具体执行用例，以及共享文件/进程坐标、策略强制、有界传输保留、独立控制进度、精确通道关闭与受管取消的证据；源与构建后的组合必须演练这些行为；**连接丢失不能成为重放可能已执行程序或宣称未观察到的清理成功的理由**。

**未核实**：本次未逐字节确认仓库全部文件中不存在任何 e2b 字符串残留；该 Note 的 Verification 节声称移除清单未发现存活的 E2B 包、workflow、import、依赖或目录项。

### 8.7 其它值得记录的修正

| commit | 标题 | 说明 |
|---|---|---|
| `aaa02a3970` | `fix(subprocess): settle a Linux scope left active with no processes` | Linux scope 无进程却仍 active 时的结算 |
| `b79a227cec` | `fix(subprocess): preserve Linux cancellation before bootstrap consumption` | bootstrap 消费请求前的取消 |
| `4c024cf252` | `fix: preserve early process cancellation and sample stream markers promptly` | 早期取消与流标记采样 |
| `dafff8e51c` | `fix(subprocess): settle consumed empty scopes before exit notification` | 已消费空范围的退出通知次序 |
| `18a1955b7e` | `fix(ci): handle scope termination races and cyclic process snapshots` | 范围终止竞态 |
| `c07df5aa65` | `fix(subprocess): confirm direct SIGKILL after group delivery` | 组投递后再确认直接 PID 的 SIGKILL |
| `71334b9c78` | `fix(subprocess): preserve direct outcomes on signal failure` | 信号失败不吞掉直接进程结果 |
| `6c3c3064c3` | `refactor: align instruction and job helper symbols` | 同时触及 shell / terminal / subprocess 的符号对齐 |
| `0eb87a4590` | `test: fix upload expectations and exited process cleanup` | subprocess 侧测试稳定性 |

`packages/subprocess/subprocess-local/src/linux-scope.ts` 有 186 行变动：新增 `LinuxScopeStartup` 类（含 `terminationSignals` 与 `resolveOutcome`），`DirectRange.signal()` 改为返回布尔值并新增 `DirectRange.settled`，`SystemdScopeOwner` 新增 `terminationRequested` 与 `directKillSettlement`。对应决策记录 `.agents/notes/implemented/bug-fix/2026-09-12-linux-scope-direct-kill-settlement.md` 的结算规则：成功的进程组 `SIGKILL` 只证明"至少投递给一个成员"，直接 PID 仍需自己的信号确认或不存在证明；在直接结算等待之后才重新观察范围。

### 8.8 本版新增文件清单（`git diff --name-status --diff-filter=A`，权威列表）

上述三个既有组在本版共新增 16 个文件（另加 `packages/ssh` 整组的 63 个全新文件），且**没有任何文件被删除**（`--diff-filter=D` 结果为空）——删除集中在 `packages/e2b`、`packages/code-runtime`、`packages/workflow`，不属于本篇范围。

| 路径 | 说明 |
|---|---|
| `packages/subprocess/subprocess/src/control.ts`、`tests/control.spec.ts`、`tsdown.config.ts` | fd 7 协议、服务层测试、新增 `./control` 导出面的打包配置 |
| `packages/subprocess/subprocess-local/src/control-spawn.ts`、`src/output.ts`、`tests/control.spec.ts` | 父侧管道建立与标记戳写；`OutputCollector` 与私有 spill 目录；本地控制通道测试 |
| `packages/subprocess/subprocess-local/tests/fixtures/{control-child,hold-linux-bootstrap}.ts` | 两个新 fixture |
| `packages/subprocess/win32-process/src/control-stdio.ts` | Windows 侧描述符槽位装载 |
| `packages/shell/{bash-sandbox,pwsh-sandbox}/tests/foreground-timeout.spec.ts`（各 157 行） | 前台 deadline 覆盖准备阶段 |
| `packages/shell/bash-sandbox/tests/fixtures/{async-confinement-failure,pending-confinement}.ts` | 两个新 fixture |
| `packages/shell/{tool-bash,tool-pwsh}/tests/background-start.spec.ts`（各 116 行） | 后台异步启动 |
| `packages/terminal/terminal-bash/tests/session-buffer.spec.ts`（295 行） | 增量保留缓冲 |
| `packages/ssh/**`（63 个文件） | 整个包组：4 个 `package.json`、24 个 README/i18n、22 个 `ssh/ssh/tests` 文件等 |

**易误判的三个文件**（本次核查确认它们在 rc.2 已存在，本版为修改而非新增）：`packages/shell/tool-bash/src/background.ts`（`M`，新增 `processJob`）、`packages/subprocess/subprocess-local/tests/native-containment.spec.ts`（`M`）、`packages/subprocess/win32-process/tests/ordinary-process.spec.ts`（`M`）。

*文档生成时间: 2026-09-17*
*数据源: dsh-v0.1.6-alpha.1 (0a15e36e7f) vs dsh-v0.1.5-rc.2 (fb2c4b9e69)*
