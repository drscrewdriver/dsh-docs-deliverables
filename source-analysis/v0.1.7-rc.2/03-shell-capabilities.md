# 【第 03 篇】packages/shell · subprocess · terminal · ssh：命令执行缝

> **基线说明**：本篇为 v0.1.7-rc.1 全量分析基线，rc.2 未改动本篇覆盖的系统性结构。v0.1.7-rc.2 的增量变更（约 335 个提交）请见同目录 `README.md` 与 `diff-vs-0.1.7-rc.1.md`。

> **版本**：dsh-v0.1.7-rc.1（`46a7f68b09`），对比上版 dsh-v0.1.6-alpha.1（`0a15e36e7f`）
> 难度：🟡 进阶（建议先读第 01、02 篇，以及 v0.1.6-alpha.1 的第 03 篇）
> 包范围：`deepseek-harness/packages/shell/` 下 10 个包、`packages/subprocess/` 下 3 个、`packages/terminal/` 下 3 个、`packages/ssh/` 下 4 个（合计 20 个包）
> 上游文档：`docs/subsystems/shell.md`、`subprocess.md`、`terminal.md`、`ssh.md`、`sandbox.md`（仅 shell 相关部分）
> 证据纪律：本文所有数字、路径、行号、提交号均在本地检出 `E:\test\rewrite-agently\deepseek-harness`（已 checkout 到 `dsh-v0.1.7-rc.1`）上实测；未能核实的项显式标注「未核实」

## 目录

- [1 引言](#1-引言) · [2 概述](#2-概述) · [3 核心概念](#3-核心概念) · [4 包结构](#4-包结构) · [5 关键类型](#5-关键类型)
- [6 数据流](#6-数据流) · [7 测试覆盖](#7-测试覆盖) · [8 与上游/下游的关系](#8-与上下游的关系)
- [9 本版本变更要点（0.1.6-alpha.1 → 0.1.7-rc.1）](#9-本版本变更要点016-alpha1--017-rc1)
  - [9.1 `run()` + `start()` 收敛为单一 `execute()`](#91-run--start-收敛为单一-execute) · [9.2 前台命令注册为 job](#92-前台命令注册为-job超时不再杀掉工作) · [9.3 执行器配置改为 Volatile](#93-执行器配置改为-volatileshell_settings_namespace-从源码中移除)
  - [9.4 终端活动观察](#94-终端活动观察shellactivity--inspectactivity) · [9.5 用户终端权限模型](#95-用户终端权限模型本版语义反转最大的一项) · [9.6 持久 pwsh 保留后端受控提示符](#96-持久-pwsh-保留后端受控提示符)
  - [9.7 Windows 子进程控制台可见性](#97-windows-子进程控制台可见性) · [9.8 shell 环境变量键声明收敛](#98-shell-环境变量键声明收敛仍为提案未实现) · [9.9 spill 失败容器化与延迟加载](#99-spill-失败不再杀死宿主与可选原生依赖的延迟加载)
  - [9.10 `packages/ssh` 本版演进](#910-packagesssh-自-016-新增后的本版演进) · [9.11 官方子系统文档变更](#911-官方子系统文档的区间变更) · [9.12 其它修正](#912-其它值得记录的修正)
- [10 未核实与存疑清单](#10-未核实与存疑清单)
- [附录 A 本版提交索引](#附录-a-本版提交索引) · [附录 B 本版新增文件清单](#附录-b-本版新增文件清单)

---

## 1 引言

本文覆盖 DSH 的"执行侧"四个包组：一次性命令（`packages/shell`）、裸进程与终端原语（`packages/subprocess`）、持久 PTY 会话（`packages/terminal`），以及自 0.1.6-alpha.1 新增的远程执行世界（`packages/ssh`）。

本版不是"新增包组"式的扩张版本，而是**执行缝本身的重构版本**：`ctx.shell` 的两个执行方法 `run()` / `start()` 被删除，替换为唯一的 `execute()`；前台与后台不再是两条 spawn 路径，而是同一个进程句柄的两种投影。这一改动连带改写了 `docs/subsystems/shell.md` 的服务契约、`bash`/`pwsh` 两个模型的工具语义、以及 `packages/shell` 下 6 个包的实现。

### 1.1 量化基线

命令：`git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- <path>`

| 包组 | 变更文件 | 新增行 | 删除行 |
|---|---|---|---|
| `packages/shell` | 85 | +4534 | -1845 |
| `packages/subprocess` | 52 | +1269 | -232 |
| `packages/terminal` | 14 | +189 | -81 |
| `packages/ssh` | 20 | +136 | -79 |
| **合计** | **171** | **+6128** | **-2237** |

（合计与 `git diff --stat` 尾行一致：`171 files changed, 6128 insertions(+), 2237 deletions(-)`。）

官方子系统文档在同一区间的变更很小：

| 文档 | 状态 | 规模 |
|---|---|---|
| `docs/subsystems/shell.md` | `M` | 契约段与生成式 Cordis 目录随 `execute()` 改写 |
| `docs/subsystems/subprocess.md` | `M` | 新增 `inspectActivity()`、`shellActivity` 说明段 |
| `docs/subsystems/sandbox.md` | `M` | 1 行（Windows ACL partial 边界措辞） |
| `docs/subsystems/terminal.md` | **未改动** | — |
| `docs/subsystems/ssh.md` | **未改动** | — |

`docs/subsystems` 三个文件的合计为 `3 files changed, 32 insertions(+), 23 deletions(-)`（命令：`git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- docs/subsystems/shell.md docs/subsystems/subprocess.md docs/subsystems/terminal.md docs/subsystems/ssh.md docs/subsystems/sandbox.md`）。

### 1.2 提交基线

| 包组 | 区间内提交数（含 merge） | 非 merge 提交数 |
|---|---|---|
| `packages/shell` | 101 | 49 |
| `packages/subprocess` | 23 | 17 |
| `packages/terminal` | 34 | 11 |
| `packages/ssh` | 13 | 12 |

`packages/shell` 的非 merge 提交数（49）远高于其文件数（85），说明本版 shell 组经历了密集的评审往返——决策记录本身记录了这一点：`2026-08-26-shell-execute-projection-and-jobs-at-start.md` 的 `## Problem` 末段与 `## Alternatives considered` 明确记载"promotion offer 协议在评审中被否决"，对应提交 `d6bebc5783` 先实现、`bb20149360` 再推翻。

### 1.3 包版本

四个包组共 20 个包的 `version` 字段在本版**全部**为 `0.1.7-rc.1`（逐包读取 `package.json` 核实）。`packages/ssh` 的 4 个包自 0.1.6-alpha.1 引入后，本版只做版本推进与机械适配。

---

## 2 概述

四条缝 + 一个新增能力载体（角色引自 `docs/capability-seams.md`）：

| 服务 | ctx 键 | 角色 | 提供者 | 消费者 |
|---|---|---|---|---|
| 命令执行 | `ctx.shell` | seam | `bash-local`、`bash-sandbox`、`pwsh-local`、`pwsh-sandbox` | `tool-bash`、`tool-pwsh`、hooks 桥、tmux 上下文、webworker 沙箱栈 |
| 裸进程 / 终端原语 | `ctx.subprocess` | seam | `subprocess-local`、`subprocess-ssh` | shell 执行器族、`terminal-bash`、`lsp-stdio`、`subagent-acp`、`api-terminal-controller` |
| 持久 PTY 会话 | `ctx.terminals` | seam | `terminal-bash` | `tool-terminal`、`tool-bash-persistent`、`tool-pwsh-persistent` |
| 远程连接 | `ctx.ssh` | core | — | `fs-ssh`、`subprocess-ssh`、`sandbox-ssh` |

（`ctx.shell` 的消费者清单引自 `.agents/notes/implemented/feature/2026-08-26-shell-execute-projection-and-jobs-at-start.md` 的 `## Consequences` 首条："the tools, the hook runner, tmux-context, and the webworker sandbox stack now speak `execute()`"。）

本版的三个主题可以一句话概括：

1. **一条执行路径**——`resolve()` + `execute()`，`run()`/`start()` 删除；前台是"调用者 await 了什么"，不是 spawn 方式的区别；
2. **超时不杀工作**——前台命令从第一秒就是一个 job；超时只是"停止阻塞本轮"，命令作为它本来就是的那个 job 继续跑；
3. **终端从"猜"变成"观察"**——`inspectActivity()` 让宿主能区分 idle / busy / unknown，用户终端同时从"继承 Agent 沙箱"改为"以系统用户权限直连 subprocess 提供者"。

---

## 3 核心概念

| 术语 | 英文 | 含义 | 本版状态 |
|---|---|---|---|
| 能力缝 | capability seam | Service Definition + Service Provider + Consumer 三件套 | 未变 |
| 请求 / 规格分离 | request / spec split | 可选字段由实现方 `resolve(request)` 显式补全为 spec | 未变，但 `resolve` 的目标从 `run`/`start` 改为 `execute` |
| 执行句柄 | execution handle | `execute(spec)` 返回的 `ShellExecution`：既是活进程，又带前台投影 | **本版新增/替换** |
| 前台投影 | foreground projection | `ShellExecution.result()`，按需创建并记忆化 | **本版新增** |
| 到期策略 | expiry policy | `ShellExpiryPolicy = 'kill' \| 'none'` | **本版新增** |
| 独立观察者读取 | observed readers | `ShellProcess.observed`，非消费式 offset reader，与消费式 `readOutput()` 并存 | **本版新增** |
| 启动即注册 | jobs-at-start | 组合了 job registry 时，前台命令在启动时就是 job | **本版新增** |
| 提升 | promotion | 前台命令超出等待窗口后作为 job 继续，调用返回 `kind: 'promoted'` | **本版新增** |
| 终端活动观察 | terminal activity | `SubprocessTerminalActivity = { state: 'idle' \| 'busy' \| 'unknown'; revision }` | **本版新增** |
| 受控提示符 | controlled prompt | `dsh> `（`packages/terminal/terminal-bash/src/sanitize.ts:9`） | 未变；本版明确唯一归属 |
| 托管范围 | managed range | 提供者负责的进程树 / 会话范围 | 未变；本版新增任务计数与完整性事实 |
| 凭据擦洗 | credential scrub | `scrubbedParentEnv`，按变量名启发式剔除密钥 | 未变 |
| 系统用户权限 | system-user permissions | 用户终端以执行环境系统用户身份运行，不经 Agent 沙箱与审批 | **本版新增（语义反转）** |
| 延迟 require | lazy require | `@deepseek-ai/dsh-lazy-require`：CJS 兼容宿主依赖按需加载 | **本版新增包 + 本组 3 个消费者** |

---

## 4 包结构

### 4.1 `packages/shell/`（10 个包）

| 包 | 职责 | 本版改动规模（`git diff --stat`） |
|---|---|---|
| `shell` | 服务定义：`ShellExecutor`、请求/规格/结果词汇 | `src/index.ts` 60 行、`src/types.ts` 68 行、`README.md` 27 行、`tests/service.spec.ts` 43 行、`package.json` 16 行 |
| `bash-local` | POSIX 默认执行器（`bash -c`） | `src/index.ts` 302 行、`tests/executor.spec.ts` 242 行、`tests/settings.spec.ts` 129 行 |
| `pwsh-local` | Windows 默认执行器 | `src/index.ts` 314 行、`tests/executor.spec.ts` 268 行、`tests/settings.spec.ts` 135 行 |
| `bash-sandbox` | POSIX 约束执行器 | `src/index.ts` 101 行、`tests/sandbox.spec.ts` 156 行、`tests/partial-landlock.spec.ts` 57 行 |
| `pwsh-sandbox` | Windows 约束执行器 | `src/index.ts` 99 行、`tests/sandbox.spec.ts` 92 行 |
| `shell-env` | `ctx.shellEnv`：托管 `DSH_*` 注册表 | `src/index.ts` 11 行、`tests/shell-env.spec.ts` 15 行、`tsconfig.json` +3 |
| `tool-bash` | 模型面 `bash` 工具 | `src/index.ts` 491 行、**新增** `tests/background.spec.ts`（502 行）、`src/background.ts` 92 行、`src/render.ts` 55 行 |
| `tool-pwsh` | 模型面 `pwsh` 工具 | `src/index.ts` 556 行、**新增** `tests/background.spec.ts`（566 行）、`src/background.ts` 93 行 |
| `tool-bash-persistent` | 持久 bash 工具 | `src/index.ts` 14 行、`tests/tools.spec.ts` 165 行 |
| `tool-pwsh-persistent` | 持久 pwsh 工具 | `src/index.ts` 59 行、`tests/tools.spec.ts` 207 行、`tests/loader-composition.spec.ts` 28 行 |

现行源码规模（行数，`Get-Content ... .Count` 实测）：`shell/src/index.ts` 96、`shell/src/types.ts` 238、`bash-local/src/index.ts` 403、`pwsh-local/src/index.ts` 449（另有 `resolve.ts` 79）、`bash-sandbox/src/index.ts` 191（`helpers.ts` 14）、`pwsh-sandbox/src/index.ts` 199（`helpers.ts` 120）、`shell-env/src/index.ts` 211、`tool-bash/src/index.ts` 576（`render.ts` 128、`background.ts` 129）、`tool-pwsh/src/index.ts` 627（`render.ts` 140、`background.ts` 132）、`tool-bash-persistent/src/index.ts` 483、`tool-pwsh-persistent/src/index.ts` 497。

### 4.2 `packages/subprocess/`（3 个包）

| 包 | 职责 | 本版改动规模 |
|---|---|---|
| `subprocess` | 服务定义：`SubprocessRuntime`、spawn 规格、句柄、终端原语 | `src/types.ts` 15 行、`src/index.ts` 1 行、`tests/service.spec.ts` 1 行 |
| `subprocess-local` | 本地提供者：平台受管范围、spill、node-pty | `src/output.ts` 157 行、**新增** `src/shell-activity.ts`（131 行）、`src/terminal.ts` 56 行、`src/index.ts` 51 行、`src/process-inspector.ts` 38 行、`src/spawn.ts` 16 行、`src/linux-scope.ts` 9 行、`src/managed-owner.ts` 5 行 |
| `win32-process` | Win32 原生 FFI（Koffi）：Job、受限令牌、控制描述符 | `src/ffi.ts` 114 行、`src/process.ts` 21 行、**新增** `src/koffi.ts`（10 行）、`src/abi.ts` 4 行 |

### 4.3 `packages/terminal/`（3 个包）

| 包 | 职责 | 本版改动规模 |
|---|---|---|
| `terminal` | 服务定义：`ctx.terminals`、后端与发送契约 | `tests/service.spec.ts` 4 行（仅为 `unknown` 断言改写）、`package.json` 18 行 |
| `terminal-bash` | 本地 PTY 后端：就绪推断、scrollback、受控提示符 | `src/index.ts` 24 行、`src/session.ts` 6 行、`tests/index.spec.ts` 37 行、`tsconfig.json` +3 |
| `tool-terminal` | 模型面终端工具 | `src/index.ts` 17 行、**新增** `src/background.ts`（31 行）、`package.json` 58 行 |

### 4.4 `packages/ssh/`（4 个包）

| 包 | 职责 | 本版改动规模 |
|---|---|---|
| `ssh` | 连接、helper 身份、传输生命周期（`ctx.ssh`） | `src/helper-processes.ts` 25 行、`src/helper.ts` 4 行、`src/schemas.ts` 3 行、`tests/helper-processes.spec.ts` 22 行、`README.md` +2 |
| `fs-ssh` | 远程文件身份与受守卫的原子变更（`ctx.fs`） | `tests/provider.spec.ts` +7、`README.md` +1（watch 不支持） |
| `subprocess-ssh` | 远程可执行查找、进程、控制流与终端（`ctx.subprocess`） | `src/index.ts` 9 行、`tests/shell-discovery.spec.ts` 3 行、`README.md` +2 |
| `sandbox-ssh` | 远程文件效果约束与 enforcement 事实（`ctx.sandbox`） | 仅 `package.json` 16 行（版本 + 依赖范围） |

**没有一个文件被删除**：`git diff --name-status dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/shell packages/subprocess packages/terminal packages/ssh` 的 `D`/`R` 行为空，只有 8 个 `A`（见附录 B）。

---

## 5 关键类型

### 5.1 `ShellExecutor`：只剩两个抽象方法

`packages/shell/shell/src/index.ts:64–93`：

```ts
export abstract class ShellExecutor extends Service {
  // …
  /** 把实现方默认值与上限应用到请求上。 */
  abstract resolve(request: ShellExecRequest): ShellExecSpec

  /**
   * Prepare and spawn the command under its resolved deadline.
   * @returns the prepared handle, including its result projection;
   *   preparation timeout yields an already-settled handle with no output.
   * @throws on preparation failure or caller cancellation before process publication.
   */
  abstract execute(spec: ShellExecSpec): Promise<ShellExecution>
}
```

类级 JSDoc（同文件 `execute` 之前的段落，`docs/subsystems/shell.md` 的生成式目录同步收录）原文：

> `execute` resolves with the process handle after preparation. "Foreground" is a property of what the caller awaits, not of the spawn — a caller that awaits `ShellExecution.result` ran the command in the foreground; one that keeps the handle ran it in the background. A caller that waits only for a while runs the command under `onExpiry: 'none'` and bounds its own wait; the handle stays valid after the caller stops waiting.

### 5.2 到期策略与执行句柄

`packages/shell/shell/src/types.ts:53`：

```ts
export type ShellExpiryPolicy = 'kill' | 'none'
```

同文件 `:111–116`（`ShellExecSpec` 新增必填字段）：

```ts
export interface ShellExecSpec {
  command: string
  workdir: string
  timeoutMs: number
  /** Deadline policy at `timeoutMs` expiry (`resolve` defaults it to `'kill'`). */
  onExpiry: ShellExpiryPolicy
  // …
}
```

同文件 `:226–237`：

```ts
export interface ShellExecution extends ShellProcess {
  /**
   * Foreground projection: settles when the process closes, with split
   * collected streams and first-cause `timedOut`/`aborted` classification.
   * Rejects only for infrastructure failures (a spawn that never produced a
   * process); nonzero exits, timeout kills, and abort kills resolve with a
   * descriptive result. Created on demand and memoized — callers that never
   * invoke it (background producers) never observe the rejection either; the
   * handle's `done`/read path carries the spawn-failure story for them.
   */
  result(): Promise<ShellRunResult>
}
```

### 5.3 独立观察者读取

`packages/shell/shell/src/types.ts:23–29`：

```ts
export interface ShellObservedStreams {
  /** Offset reader over captured stdout. */
  stdout: SubprocessOutputReader
  /** Offset reader over captured stderr (the spawn-failure note after a rejected spawn). */
  stderr: SubprocessOutputReader
}
```

`ShellProcess` 上新增 `observed: ShellObservedStreams`（同文件 `:214`）。语义：与消费式 `readOutput()` 游标读同一批捕获字节，但各自持有 offset，互不"偷取"字节（`docs/subsystems/shell.md` 的 `observed` JSDoc）。

### 5.4 执行器的前台/后台双投影实现

`packages/shell/bash-local/src/index.ts`：

| 行号 | 内容 |
|---|---|
| `:187` | `async execute(spec: ShellExecSpec): Promise<ShellExecution>` |
| `:201` | `protected async executeArgv(` |
| `:204` | `onStarted?: (process: ShellExecution) => void,` |
| `:213` | `if (spec.onExpiry === 'kill') {` |
| `:370` | `result: (): Promise<ShellRunResult> => {`（记忆化投影） |
| `:387` | `if (!preparationTimedOut) onStarted?.(proc)` |

两臂的 deadline 接线（`executeArgv`，`'kill'` 与 `'none'`）：

```ts
// 'kill' 臂：一条融合 deadline 同时驱动 spawn 信号与首因分类
const d = deadline(spec.signal, spec.timeoutMs, 'BASH_TIMEOUT')
spawnSignal = d.signal
classify = () => {
  const timedOut = timeoutOf(d.signal, 'BASH_TIMEOUT') !== undefined
  return { timedOut, aborted: d.signal.aborted && !timedOut }
}
disarm = () => { d[Symbol.dispose]() }
// else 臂（'none'）：无 deadline，调用者靠 kill() 或 spec.signal 停止
```

沙箱执行器不再覆写 `start` 与 `run`，而是覆写单一 `execute` 并在**同一个句柄实例**上就地装饰 `result()`（`packages/shell/bash-sandbox/src/index.ts` 的 `private static decorateResult`，注释原文："The handle keeps its identity (never wrapped in a second object) because the per-process facts and `onProcessDone` key on the exact instance."）。`pwsh-sandbox` 同形（`packages/shell/pwsh-sandbox/src/index.ts`）。

### 5.5 工具侧的 job 注册与提升

`packages/shell/tool-bash/src/index.ts`：

| 行号 | 内容 |
|---|---|
| `:292` | `const bashTool = (jobs: JobRegistry \| undefined): ToolDefinition => {` |
| `:296` | `const startJob = (registry: JobRegistry, args: BashToolArgs, exec: ToolExecution, spec: ShellExecSpec): StartedJob => {` |
| `:299` | `const id = registry.start({ kind: 'bash', … })` |
| `:326` | `const waitOnJob = async (registry, attached, exec, spec) => {` |
| `:343` | `view = await registry.wait(attached.id, timeoutMs, owner, exec.signal)` |
| `:374` | `kind: 'promoted' as const,` |
| `:385` | `registry.remove(attached.id, owner)` |
| `:566–573` | `foregroundOnly` / `ctx.inject(['jobs'], …)` 注册切换 |

提升分支的返回结构（`:373–380`，节选）：

```ts
return {
  kind: 'promoted' as const,
  jobId: attached.id,
  timeoutMs,
  output: renderJobRead(
    ringDelta(read.chunks), read.lossy, read.job.output.spillPaths ?? [], attached.process()?.sandbox, escalationModes,
  ),
}
```

模型面文本（`packages/shell/tool-bash/src/render.ts:81–83`）：

```
[still running after <timeoutMs>ms; moved to background job <jobId>]
The command keeps running in the background. You will be notified when it finishes; read newer output with job_output, stop it with job_kill.
```

外部 kill 的原因行（同文件 `:56`）：`[stopped: ${result.stopped}]`。

`tool-pwsh` 是逐例镜像：`src/index.ts:315`（`execute`）、`:345`/`:351`（`wait`）、`:382`（`promoted`）、`:393`（`remove`）、`src/render.ts` 的 `renderPwshPromoted`。

### 5.6 job 适配层

`packages/shell/tool-bash/src/background.ts`（129 行）：

| 行号 | 导出 | 作用 |
|---|---|---|
| `:44` | `processOutcome(proc, escalationModes)` | settled 进程 → job 终态词汇（`killed` + signal detail / `completed` + exit code，附沙箱事实） |
| `:67` | `processSources(() => proc)` | 把 `observed` 两条流交给 registry 作为 pull source |
| `:86` | `ringDelta(chunks)` | 一次消费式 registry 读还原成工具渲染的进程读（stdout 在前，stderr 归入 `[stderr]` 段） |
| `:99` | `processJob(start, outcome)` | 同步返回 `JobHooks`；准入后才异步准备，取消会 abort 准备并 `kill()` 迟到句柄 |

### 5.7 终端活动观察（subprocess 缝）

`packages/subprocess/subprocess/src/types.ts`：

| 行号 | 内容 |
|---|---|
| `:228` | `shellActivity?: boolean \| undefined`（`SubprocessTerminalSpawnSpec` 新增可选字段） |
| `:244–248` | `export interface SubprocessTerminalActivity { state: 'idle' \| 'busy' \| 'unknown'; revision: number }` |
| `:284` | `inspectActivity(): Promise<SubprocessTerminalActivity>`（`SubprocessTerminalHandle` 新增方法） |

本地实现 `packages/subprocess/subprocess-local/src/terminal.ts:166`（`async inspectActivity()`）：只有"正向提示符证据 + 无前台/后台/停止的后代"才判 idle；`this.quiescent` 后直接 idle；进程表扫描不完整、根身份不匹配、异常一律 `unknown`。输入与前台信号会先失效提示符证据（`:143` `write` 前、`:197` `signalForeground` 前调用 `this.shellActivity?.invalidate()`）。

私有生命周期文件 `packages/subprocess/subprocess-local/src/shell-activity.ts`：

| 行号 | 内容 |
|---|---|
| `:10` | `export class ShellActivity`（`invalidate()` / `inspect(pid)` / `dispose()`） |
| `:60` | `export function prepareShellActivity(spec, env, platform)` |
| `:63` | 仅当 `spec.shellActivity === true && platform !== 'win32' && argv.length === 2 && argv[1] === '-i'` 才生效 |
| `:65` | 仅 `bash` / `zsh` |

`ssh` 侧把同一能力透传为 RPC：`packages/ssh/ssh/src/schemas.ts:53`（请求字段 `shellActivity`）与 `:88`（`terminalActivitySchema`）；`packages/ssh/ssh/src/helper-processes.ts:340`（操作集合扩为 `'write' | 'inspect' | 'activity' | 'signal'`）、`:345`（`if (operation === 'activity') return terminal.inspectActivity()`）；`packages/ssh/subprocess-ssh/src/index.ts` 的 `inspectActivity: () => ssh.request('terminal.activity', …)`。

### 5.8 shell 环境注册表新增内置键

`packages/shell/shell-env/src/index.ts`：新增 `DSH_PROFILE_KEY` / `DSH_PROFILE_DIR_KEY` 两个保留键，并在 `collect()` 中从 `ctx.get('profileContext')` 读取：

```ts
const profile = this.ctx.get('profileContext')
if (profile !== undefined) {
  values[DSH_PROFILE_KEY] = profile.name
  values[DSH_PROFILE_DIR_KEY] = profile.dir
}
```

同文件新增 `import type {} from '@deepseek-ai/dsh-app-boot'`，注释说明其用途："Declares `Context.profileContext`, the launcher-provided profile the built-ins read."

---

## 6 数据流

### 6.1 前台本地命令

```
模型 → ctx.tools → tool-bash → ctx.shell.resolve(request) → ShellExecSpec
     → ctx.shell.execute(spec) → ShellExecution
     → （组合了 jobs 时）registry.start(...) 准入，starter 内 execute()
     → await registry.wait(id, timeoutMs, owner, exec.signal)
     ├─ 窗口内 settle → registry.remove(id) → await process.result() → 前台结果
     └─ 窗口外仍 running → kind: 'promoted' + 一次消费式 ring 读 seed
```

无 registry 时走退化路径：`ctx.shell.execute(ctx.shell.resolve({ ...request, signal }))`，`tool-bash/src/index.ts:547`、`tool-pwsh/src/index.ts:563`。

### 6.2 前台沙箱命令

`bash-sandbox.execute(spec)` → `LocalBashExecutor.executeArgv(spec, prepare, onStarted)`：

- `prepare(signal)` 内部 `await this.confine(spec.command, { ...policy, mode }, signal)`，成功后 `confined = prepared` 并返回 `prepared.argv`；
- `onStarted(process)` 在**句柄可结算之前同步**把 per-process 沙箱事实写入 `this.processFacts`；
- `decorateResult` 在 `result()` 上追加沙箱事实、runner 失败 → `SandboxUnavailableError`、denial 分类。

准备期间超时不再返回 `spawnRequested: false` 的旧结构，而是返回**已结算的 timed-out 句柄**（`onExpiry: 'kill'`）或抛错（取消/准备失败）。

### 6.3 后台命令

`tool-bash` 的 `run_in_background: true` → `registry.start()` 同步准入 → `processJob(signal => ctx.shell.execute({ ...spec, signal }), outcome)`：准入后异步准备，`cancel(reason)` 记录原因、abort 准备、`proc?.kill()`；`processSources` 把 `observed` 交给 registry 的泵，Web 客户端与模型的 `job_output` 各自通过独立游标消费同一批字节。

### 6.4 持久终端会话

`tool-terminal`（后台发送）在本版把 `readOutput: () => renderSendRead(operation.readOutput())` 换成 registry pull source（`packages/terminal/tool-terminal/src/background.ts:22` 的 `sendSource`），并把 `jobs.start({ owner })` 改为 `owner: owner.id`。原因是后端发送读取器本身没有 offset——每次调用交出"自上次以来到达的内容"——所以 source 自行按已交付字节数维护单调 offset（同文件 `:24–29`）。

### 6.5 持久 pwsh 的启动与提示符

```
tool-pwsh-persistent → ctx.terminals.spawn(owner, request)
  → terminal-bash spawn()：spawnTerminal → createSession → startupSession
     → 方言 pwsh：写入 ENCODING_PREAMBLE + PWSH_PROMPT_SETUP（terminal-bash/src/index.ts:135）
     → 只接受 waitReason === 'stdin_read' 作为就绪（:143）
  → 会话返回时提示符函数已由后端安装
→ 工具侧不再发送自己的初始化 send
```

命令结算路径本版从"提示符文本比对"改为"缝自身的信号"：`tool-pwsh-persistent/src/index.ts` 的 `if (result.waitReason === 'stdin_read')` 分支取代了原来的 `promptCompleted(result)`（视口以 `SHELL_PROMPT` 结尾）。

### 6.6 SSH 远程

部署侧 OpenSSH alias → `dsh-ssh` 校验 helper 摘要 → `ctx.ssh` 就绪 → `fs-ssh` / `subprocess-ssh` / `sandbox-ssh` 分别注册到 `ctx.fs` / `ctx.subprocess` / `ctx.sandbox`。本版在远程进程层新增：

- spill 失败经 `logSpillFailure(ctx.logger, 'ssh helper')` 上报（`packages/ssh/ssh/src/helper-processes.ts:104`），远端调用方随后收到"无 spill 路径的尾部"；
- 选择 `shellActivity` 的终端在根进程退出后**保留预留**（`:197`、`:326`），activity RPC 仍可达；显式终止才等待静默并记录完成结果；
- 新 RPC `terminal.activity` 与 `terminalActivitySchema` 校验。

---

## 7 测试覆盖

`tests/` 目录下文件数（`git ls-tree -r --name-only <tag> <group>` 后按 `/tests/` 过滤计数）：

| 包组 | 0.1.6-alpha.1 | 0.1.7-rc.1 | 增量 |
|---|---|---|---|
| `packages/shell` | 31 | 33 | +2 |
| `packages/subprocess` | 27 | 30 | +3 |
| `packages/terminal` | 10 | 10 | 0 |
| `packages/ssh` | 29 | 29 | 0 |

新增测试文件（本版完整 `A` 清单中的测试项）：

| 文件 | 行数 | 覆盖对象 |
|---|---|---|
| `packages/shell/tool-bash/tests/background.spec.ts` | 502 | 启动即注册、提升、`owned promotion`、`[stopped: …]`、准入饱和回退 |
| `packages/shell/tool-pwsh/tests/background.spec.ts` | 566 | 上述场景的 pwsh 镜像 |
| `packages/subprocess/subprocess-local/tests/shell-activity.spec.ts` | 115 | 活动状态与 revision |
| `packages/subprocess/subprocess-local/tests/shell-activity-files.spec.ts` | 81 | 私有生命周期文件 |
| `packages/subprocess/win32-process/tests/fixtures/console-state.ts` | 7 | 控制台可见性 fixture |

与之配套的存量测试改动值得注意：`bash-local`/`pwsh-local` 的 `tests/executor.spec.ts` 各 +242/+268 行，而 `tests/settings.spec.ts` 各 **-129/-135 行缩减**（`129 +--` / `135 +---` 在 `git diff --stat` 中呈净删）——与 9.3 节的设置命名空间移除直接对应。

其他可核实的测试面证据（引自决策记录文本，未在本机执行）：

- `2026-08-26-shell-execute-projection-and-jobs-at-start.md` 的 `## Testing` 明确列出"a real `printf …; sleep 30` with `timeoutMs: 250` is listed as `bash-1` while the call waits, returns the still-running text with the early output, and its next `job_output` read repeats nothing"；
- `2026-09-21-persistent-pwsh-keeps-controlled-prompt.md` 的 `## Consequences` 记录了回归检测方式：loader-composition 套件记录每次 send 的 `waitReason`，要求至少 6 次 `stdin_read` 且无 `inferred_idle`；恢复被删的提示符覆写会使该断言在 30 s 后以 `expected 0 to be greater than or equal to 6` 失败；
- `2026-09-16-windows-subprocess-console-visibility.md` 的 `## Consequences`：`Native Windows tests inspect console visibility in a descendant and in both ACL modes`，并说明"Session recordings cannot observe native console windows"，因此该回归由 Windows 原生测试而非浏览器截图拥有。

---

## 8 与上游/下游的关系

- **上游**：`ctx.shell` 实现经 `ctx.subprocess` spawn / spawnTerminal；`bash-sandbox` / `pwsh-sandbox` 额外消费 `ctx.sandbox` 与 `ctx.sandboxPolicy`；`subprocess-ssh` 消费 `ctx.ssh`；`shell-env` 本版新增消费 `ctx.profileContext`（由 `dsh-app-boot` 声明）。
- **下游**：`tool-bash` / `tool-pwsh` 注册进 `ctx.tools`；后台与前台命令都经 `ctx.jobs`（可选）；`terminal-bash` 注册进 `ctx.terminals`，`tool-terminal` 与两个 persistent 工具是消费者。
- **跨组耦合**：`ssh` 的 helper 进程侧直接复用 `@deepseek-ai/dsh-subprocess-local/output` 的 `OutputCollector` / `logSpillFailure` / `prepareManagedProcessBinding`（`packages/ssh/ssh/src/helper-processes.ts` 的 import 行）。这是本地提供者向远程 helper 暴露的内部导出面，属既有设计（0.1.6 已如此），本版只是把构造函数签名从 `(maxBytes, maxSpillBytes, label, spillDir)` 改为 `(maxBytes, label, spillOptions?)`，三处调用点同步改写。
- **模型可见面**：`bash` / `pwsh` 的 schema 与描述文本取决于 registry 是否存在（`run_in_background` 与提升指引只在持有 registry 时出现）；结果联合新增 `promoted` 臂，前台臂新增可选 `stopped` 原因。决策记录明示"the PTC system-prompt snapshots re-recorded with it"。
- **不在本篇范围**：GUI 侧栏终端 UI（`packages/client/ui-sidebar-terminal`）归第 10 篇；用户终端的 Remote 控制器与保留/回收逻辑（`packages/api/terminal-controller`）归 GUI/API 篇，本文只在 9.5 节说明其**权限模型**并给出该包的位置。

---

## 9 本版本变更要点（0.1.6-alpha.1 → 0.1.7-rc.1）

### 9.1 `run()` + `start()` 收敛为单一 `execute()`

#### 9.1.1 问题（引自 `.agents/notes/implemented/feature/2026-08-26-shell-execute-projection-and-jobs-at-start.md` 的 `## Problem`）

> "A bash command that outran its foreground timeout was killed, discarding the work — the single most common way a long build or install failed under the agent. Fixing that inside the old seam was structurally awkward: `ctx.shell` had two execution methods, `run()` (deadline fused in, promise-only, no handle to keep) and `start()` (handle, no deadline), so 'keep this already-running foreground command' had no expression."

同一节还记录了另一层问题："The two methods had also drifted: different stdout budgets, a documented 'start ignores timeoutMs' wart, and sync-vs-async spawn-failure behavior that differed per path."

#### 9.1.2 答案：`start()` 那一步**并未平息**，而是被删除

问题"`ShellExecutor.start()` 在 0.1.6 改为返回 Promise 之后的后续影响是否已平息"的核实结论是：**没有平息，而是走得更远**。本版 `packages/shell/shell/src/index.ts` 中已不存在 `run` 与 `start` 两个抽象方法（`:84` 只剩 `resolve`，`:93` 只剩 `execute`），`docs/subsystems/shell.md` 的生成式 Cordis 目录同步只列出 `resolve` / `execute`。

净变化（`git diff dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/shell/shell/src/index.ts`）：

```diff
-  abstract run(spec: ShellExecSpec): Promise<ShellRunResult>
-  abstract start(spec: ShellExecSpec): Promise<ShellProcess>
+  abstract execute(spec: ShellExecSpec): Promise<ShellExecution>
```

**归因**：`d6bebc5783 feat(shell): converge on execute() and promote timed-out commands to jobs`（`git log -S "abstract execute(spec: ShellExecSpec)" dsh-v0.1.6-alpha.1..dsh-v0.1.7-rc.1 -- packages/shell` 的唯一命中）。

#### 9.1.3 两次收敛：`onExpiry: 'offer'` 被评审推翻

这是本版最值得记录的工程细节：**同一改动在同一区间内被实现了两次**。

| 阶段 | 提交 | 形态 |
|---|---|---|
| 初版 | `d6bebc5783` | `onExpiry: 'offer'` + `ShellExecution.promotion` + `ShellPromotionOffer`，工具必须在 deadline 处**同步**应答 |
| 终版 | `bb20149360 refactor(shell): register foreground commands as jobs at start and drop the promotion protocol` | 删除 offer 协议；`ShellExpiryPolicy` 收敛为 `'kill' \| 'none'`；前台命令**启动时**注册 job |

`git log -S "onExpiry" -- packages/shell` 在区间内命中 4 个提交，其中 `a444460ad4 fix(shell): never offer cancelled work from the offer arm` 是"offer 臂"存在过的直接证据（该提交标题在当前源码中已无对应实现——`offer` 不是 `ShellExpiryPolicy` 的成员，见 `packages/shell/shell/src/types.ts:53`）。

决策记录对否决理由的原文（`## Alternatives considered`）：

> "A promotion offer on the seam (`onExpiry: 'offer'`, `ShellExecution.promotion`, `ShellPromotionOffer` with a synchronous `accept()`/`decline()` answer) — the version this PR first shipped. Rejected in review because the deferred registration was the only reason for the protocol."

#### 9.1.4 连带删除的"疣"

| 旧行为 | 本版 |
|---|---|
| `start()` 忽略 `timeoutMs`（JSDoc 明文"background processes have no executor timeout"） | 单一 `onExpiry` 策略；`'none'` 不装定时器，`timeoutMs` 仅回显进 `ShellRunResult.timeoutMs` |
| 前台用 `spec.stdoutMaxBytes`、后台与 stderr 用执行器自身 cap | `spec.stdoutMaxBytes` 对**每次执行的 stdout** 生效；stderr 仍用执行器自身 cap |
| 同步 spawn throw 逃逸给调用者（`start` 路径）；异步 rejection settle 成 `killed` | 两者统一：句柄 settle 成 `killed`（note 落在读取路径），`result()` 以**原始错误对象**reject（identity 保留） |
| 准备阶段超时返回 `{ spawnRequested: false, result: … }` | 返回已结算的 timed-out 句柄（无输出） |

`bash-local` 的 `executeArgv` 现在显式包含同步 spawn throw 的容器化：

```ts
let running: SubprocessHandle | undefined
let syncSpawnError: { error: unknown } | undefined
try {
  if (!preparationTimedOut) {
    running = this.ctx.subprocess.spawn(this.spawnSpec(spec, argv, spec.stdoutMaxBytes, spawnSignal))
  }
} catch (error) {
  syncSpawnError = { error }
}
```

#### 9.1.5 一个新增的语义细节：`kill()` 之后的 rejection

`29418faf62 fix(shell): settle a live handle's post-termination rejection as its outcome` 带来的行为（源码注释原文，`packages/shell/bash-local/src/index.ts` 的 `done` rejection 分支）：

> "A live handle whose rejection follows this execution's own termination — `kill()` or the spawn signal's abort — reports its terminal outcome: a provider that terminated the range before the target started has no exit to report and rejects with the cancellation reason instead. … A synchronous spawn throw never produced a handle and stays a failure."

`docs/subsystems/shell.md` 把这句压缩成契约："a live handle whose rejection follows the execution's own `kill()` or abort settles as its terminal outcome instead"（该句在本版 `packages/shell/shell/README.md:101`）。

### 9.2 前台命令注册为 job：超时不再杀掉工作

#### 9.2.1 机制

`tool-bash` 的两个配置字段共同决定后台面：`enableRunInBackground`（interface `:43`、schemastery 默认 `:57`、读取 `:233`）与 `promoteOnTimeout`（interface `:52`、默认 `:58`），二者在 `:236` 合成为是否允许提升：

```ts
const promoteOnTimeout = (config.promoteOnTimeout ?? true) && backgroundEnabled
```

`tool-bash` / `tool-pwsh` 在 `ctx.inject(['jobs'], …)` 中把工具定义换成 job-backed 版本，registry 卸载时换回 foreground-only 版本（`tool-bash/src/index.ts:566–573`）：

```ts
let foregroundOnly = ctx.get('jobs') === undefined ? ctx.tools.register(bashTool(undefined)) : undefined
ctx.inject(['jobs'], (jobCtx) => {
  foregroundOnly?.()
  foregroundOnly = undefined
  const unregister = ctx.tools.register(bashTool(jobCtx.jobs))
  return () => {
    unregister()
    if (ctx.fiber.state === FiberState.ACTIVE) foregroundOnly = ctx.tools.register(bashTool(undefined))
  }
})
```

#### 9.2.2 三条路径

| 情形 | 行为 |
|---|---|
| 窗口内 settle | `registry.remove(id, owner)`，模型看不到 id；`await process.result()` 返回普通前台结果 |
| 窗口外仍 running 且进程已发布 | 返回 `kind: 'promoted'` + 一次消费式 ring 读 seed；模型读到 `[still running after <ms>; moved to background job <id>]` |
| 窗口到期但**准备**仍未完成（`attached.process() === undefined`） | `stop('timed out during preparation')`，返回结算的 timed-out 前台结果（`:351–367`） |
| 调用被取消 | `stop('tool call aborted')` 后抛 `toolAborted()`（`:344–350`） |
| 准入被拒 / `promoteOnTimeout: false` / 无 registry | 退回执行器自己的 `'kill'` deadline（决策记录 `## Decision`："Registration is best-effort"） |

#### 9.2.3 关键不变量："超时什么都不交接"

决策记录 `## Decision` 原文：

> "Nothing changes hands at the timeout: not the process, not the abort signal, not the output. The tool never passes its own signal to the process; cancelling the call kills the job, and a kill from outside the call (the human's stop control, a parallel `job_kill`) reaches the process through the job's `cancel` hook."

源码里这一点的落点是 `startJob` 的 `cancel`（`tool-bash/src/index.ts:316–319`）把外部原因存进 `stopped`，前台结果据此渲染 `[stopped: …]`（`render.ts:56`）。

#### 9.2.4 与 `ctx.jobs` 的接口面变化

本版工具侧不再向 registry 传 `readOutput`，改为传 `output: JobOutputSource[]`（pull source）。`tool-terminal` 的最小改动最能说明这一机械替换（`packages/terminal/tool-terminal/src/index.ts`）：

```diff
-          owner,
+          owner: owner.id,
           outputLimitBytes: maxResultBytes,
+          output: [sendSource(() => operation)],
           run: () => {
-            const operation = ctx.terminals.startSend(owner, id, request)
+            const started = ctx.terminals.startSend(owner, id, request)
+            operation = started
             return {
               cancel: () => { cancelRequested = true; started.cancel() },
               done: started.done.then(…),
-              readOutput: () => renderSendRead(operation.readOutput()),
             }
           },
```

`owner` → `owner.id` 的改写同族提交为 `8bcd6f7519 refactor(jobs): rename visibleTo/VisibleJobs to forCaller/CallerJobs` 与 `10d76fbd03 refactor(producers): subagent and terminal jobs use session owners, results, and pull sources`。

#### 9.2.5 人类 kill 与完成通知

`51f74910ae feat(jobs): human job kill with an unclaimed terminal report` 引入 `job.kill` Remote 与两段式停止控件。相关决策记录 `.agents/notes/implemented/feature/2026-08-26-human-job-kill.md` 的 `## Decision` 第 2 条说明 kill 原因如何并入终态 detail：

> "A recorded kill reason merges into a `killed` settlement's detail — producer facts first (`signal: SIGTERM; cancelled by the user`)."

该 note 顶部 `Update:` 行同时说明 `reported` 选项已被 `2026-09-03-jobs-seam-consolidation.md` 取代——即这一带的 job 接口在本区间内还经历了第二次收敛（属 jobs 篇范围）。

### 9.3 执行器配置改为 Volatile：`SHELL_SETTINGS_NAMESPACE` 从源码中移除

**归因**：`601d6761e4 feat(settings): project volatile Config through profile-backed forms (#4587)`（`git log -S "SHELL_SETTINGS_NAMESPACE" dsh-v0.1.6-alpha.1..dsh-v0.1.7-rc.1 -- packages/shell` 的唯一命中）。

| 项 | 0.1.6-alpha.1 | 0.1.7-rc.1 |
|---|---|---|
| 常量 `SHELL_SETTINGS_NAMESPACE` | `packages/shell/shell/src/index.ts:21` 导出 | **源码中已无任何出现**（全仓 `git grep`（排除 `.agents/` 与两处 README）exit 1；仅 README 与归档 note 仍提及） |
| `bash-local` / `pwsh-local` 的 import | `import { SHELL_SETTINGS_NAMESPACE, ShellExecutor } from '@deepseek-ai/dsh-shell'` | `import { ShellExecutor } from '@deepseek-ai/dsh-shell'` |
| 设置分区安装 | `settingsCtx.settings.installSection(ctx, SHELL_SETTINGS_NAMESPACE, Config, entry, { validate, setSource, onChange })` | 整段删除；`git grep -ln installSection -- packages/shell packages/settings` 无命中 |
| `Config` 字段形态 | 普通可选值 + schemastery 默认值 | `Volatile<T>`，`cwd` 为 `Volatile<string \| undefined>` |
| 读取方式 | `private source: () => ResolvedConfig` + `get config()` | `constructor(ctx, readonly config: Config)`，逐处 `this.config.<field>.get()` |
| 校验时机 | 写设置时拒绝（`validate` 回调） | 每命令开始时拒绝（`resolve()` 首行 `assertServiceableBashConfig(this.config)`） |
| `tsconfig.json` | 引用 `../../settings/settings` | 引用删除（`bash-local/tsconfig.json` `-3` 行） |

JSDoc 措辞随之改写（`packages/shell/bash-local/src/index.ts`）：

```diff
- * fit, so a stored value is refused where it is written instead of failing at
- * the next command.
+ * fit, so a stored value that cannot be used fails at the next command.
```

**注意**：`packages/shell/shell/README.md:97` 仍在描述 `SHELL_SETTINGS_NAMESPACE`（"is exported here rather than by a provider because it names the capability"），但该常量已不在源码中。这是**文档与代码的漂移**，本次核查确认其存在，未确认其是有意保留的历史说明还是遗漏。

### 9.4 终端活动观察：`shellActivity` / `inspectActivity()`

#### 9.4.1 动机

`.agents/notes/implemented/feature/2026-09-14-unattended-browser-terminal-reclamation.md` 的 `## Problem`：

> "A browser can disappear without closing its terminal tabs. Keeping every abandoned terminal retains shells, descendant processes and screen buffers indefinitely. Output subscriptions do not identify abandonment: hidden tabs and inactive Sessions legitimately stop following the screen."

`## Alternatives considered` 里明确否决了从静默/低 CPU/前台身份推断 idle：

> "Silent builds, sleeping jobs, shell builtins and commands waiting for input can satisfy these signals without completing. Positive lifecycle evidence and owned-job observations are both required."

#### 9.4.2 实现三层

| 层 | 落点 | 事实 |
|---|---|---|
| 缝 | `packages/subprocess/subprocess/src/types.ts:228`（`shellActivity` 请求）、`:244`（`SubprocessTerminalActivity`）、`:284`（`inspectActivity`） | 可选 opt-in；`state` + `revision` |
| 本地提供者 | `packages/subprocess/subprocess-local/src/shell-activity.ts`（131 行）、`src/terminal.ts:166`、`src/process-inspector.ts`（新增 `ProcessSnapshot.complete`、`numericEntries` 返回 `undefined` 而非 `[]`）、`src/linux-scope.ts:202`（`SystemdScopeOwner.inspectTaskCount()`）、`src/managed-owner.ts`（`inspectTaskCount?()`） | bash ≥ 4.4 与 zsh 的私有生命周期文件；`/proc` 不可读 → **抛错**（不是空范围）；Linux 额外要求 systemd scope 内恰好 1 个 task |
| 远程提供者 | `packages/ssh/ssh/src/schemas.ts:53/:88`、`src/helper-processes.ts:340/:345`、`packages/ssh/subprocess-ssh/src/index.ts` | 同能力经 `terminal.activity` RPC 透出 |

`linux-scope.ts` 新增方法的原文：

```ts
inspectTaskCount(): number | undefined {
  const result = this.runSync(this.systemctl, [
    '--user', 'show', '--property=LoadState', '--property=ActiveState', '--property=TasksCurrent', this.unit,
  ], { encoding: 'utf8', env: managerEnvironment(), timeout: SYSTEMCTL_TIMEOUT_MS })
  if (result.error !== undefined || result.status !== 0 || typeof result.stdout !== 'string') return undefined
  const state = this.parseUnitState(result.stdout)
  return state.loadState === 'loaded' && state.activeState === 'active' ? state.tasksCurrent : undefined
}
```

#### 9.4.3 保守的 unknown 面

`packages/subprocess/subprocess-local/README.md` 的 `### Running terminal sessions` 新增段落列出的 unknown 情形（逐字引自该 README）：

> "Other shells, Windows, custom arguments and sandbox-wrapped executables remain usable with unknown activity."

同 README 新增的限制条目：

> "**A removed spill directory is not recreated** — the private per-process directory is created once; after an external cleaner removes it, every later spill in that process degrades to the in-memory tail with an `error` log until the host restarts."

#### 9.4.4 与用户终端的关系

`packages/api/terminal-controller/src/index.ts` 的 `spawnTerminal` 请求带 `shellActivity: true`——即 **Web 侧栏终端是这一能力的第一个（也是当前唯一的）生产消费者**。该包不在本篇包范围内，此处只标注连接点。

### 9.5 用户终端权限模型（本版语义反转最大的一项）

#### 9.5.1 决策（引自 `.agents/notes/implemented/architecture/2026-09-16-user-terminal-permissions.md` 的 `## Decision`）

> "The Web sidebar terminal runs directly through the Session's subprocess provider with the execution environment's system-user permissions. It neither confines the shell through the Agent sandbox nor requests Agent approval. Operating-system permissions, container isolation and the provider's credential-environment scrubbing continue to apply. Session identity owns access, process cleanup and the initial directory; sandbox policy supplies only the configured directory fallback when the Session has no cwd."

关键配套结论（同 note）：

| 项 | 结论 |
|---|---|
| Agent 权限变更 | "Agent permission changes leave user terminals running." |
| Agent 自有 shell / terminal 工具 | "retain their own sandbox enforcement" |
| 模型隔离 | "User terminal input and output create no model input or Session events." |
| 取代范围 | "supersedes only the shared sandbox policy and mode-switch restriction" 于 `2026-09-09-web-sidebar-terminal.md` |
| 被否决的替代方案 | 继承 Agent 权限；新增独立的终端权限选择器（"adds policy state and process-restart semantics without a current requirement"） |
| 后果 | 能执行系统用户可写的 workspace 外写入；**不**授予 root、**不**脱出容器 |

#### 9.5.2 实现（`packages/api/terminal-controller`，不在本篇包范围）

**归因**：`ab695ef4cf feat(web): give user terminals system-user permissions`。该提交改动的关键段落：

```diff
-  static inject = ['subprocess', 'sandboxPolicy', 'sessionProjections', 'typert']
+  static inject = ['subprocess', 'sandboxPolicy', 'typert']
```

```diff
-    ctx.on('internal/dispatch', (_mode, eventName, args) => {
-      // sandbox/mode 事件到达且该 Session 有终端时抛
-      // 'Close browser terminals before changing the Session sandbox mode'
-    }, { global: true })
```

即：本版**删除了**"有终端打开则禁止切换沙箱模式"的拦截，并在 `spawn()` 中移除 `sandbox.confine(...)` 包裹与 `sandbox` 服务查找。目录探测从 `sandboxPolicy.resolve({ session }).workspaceRoot` 改为 `agent.session.header.cwd ?? sandboxPolicy.workspaceRoot`。

README 措辞变化（`packages/api/terminal-controller/README.md`）：

| | 措辞 |
|---|---|
| 0.1.6 | "The Session workspace supplies the initial directory; its sandbox policy also applies to the terminal." / "An open or pending terminal prevents changing that Session's sandbox mode." |
| 0.1.7-rc.1 | "User terminals run with the execution environment's system-user permissions, independently of the Agent's sandbox mode and approval policy. Operating-system and container restrictions still apply; DSH does not elevate the user." / "Changing the Session's sandbox mode leaves user terminals running with the same permissions." |

#### 9.5.3 本篇范围内可核实的连带事实

- `packages/terminal/*` 三个包**没有**任何权限相关代码改动（本版权限逻辑完全落在 controller 与 subprocess 提供者的调用方式上，不在 terminal 包内）。
- `packages/subprocess/*` 本版也没有新增权限参数；用户终端与 Agent 命令共用同一个 `ctx.subprocess` 提供者，"权限差异"体现为**是否经过 `ctx.sandbox.confine`**，而不是提供者侧的新开关。
- `packages/terminal-bash/src/index.ts:100–109` 的 `spawnArgv` 仍保留按 `policy.mode` 走 `ctx.sandbox.confine` 的能力（`if (policy.mode === 'danger-full-access') return argv`），即**模型面持久终端**仍受沙箱约束；用户终端的"不约束"是通过不走该后端/不传策略实现的（该调用点在 `packages/api/terminal-controller` 的 `spawnTerminal` 直连路径上，本版已删去 confine 步骤）。

**未核实**：用户终端的 `spawnTerminal` 路径上 subprocess 提供者侧的 `selectContainmentMode('terminal')` 是否会因缺少沙箱策略而产生额外包裹（`packages/api/terminal-controller` 只传 `argv`/`cwd`/`env`/`shellActivity`，未见 `sandboxPolicy` 字段入通道）。本次未逐行确认 Web 组合中 `ctx.subprocess` 的 containment 选择路径。

### 9.6 持久 pwsh 保留后端受控提示符

#### 9.6.1 问题（引自 `.agents/notes/implemented/bug-fix/2026-09-21-persistent-pwsh-keeps-controlled-prompt.md` 的 `## Problem`）

> "`dsh-tool-pwsh-persistent` initialized its shell with a `prompt` function of its own (`'__DSH_PERSISTENT_PWSH_PROMPT__ '`), overwriting the `prompt` that `dsh-terminal-bash` installs in its pwsh startup sequence. The backend's prompt readiness requires the printable tail after the OSC `133;D` marker to exactly equal the controlled `dsh> ` prompt, so after initialization no send could settle through it and every send paid the silence tier plus handoff grace."

同 note 给出的实测（Windows、生产默认值、真实 Loader 组合）：

| | 第 1 次调用（spawn + 初始化 + 命令） | 第 2/3/4 次（热调用） |
|---|---|---|
| 修复前 | 8493 ms | 3722 / 3832 / 3759 ms |
| 修复后 | 1340 ms | 255 / 251 / 241 ms |

> 这些是**该 note 记录的作者本机测量值**，非本机复现结果。

#### 9.6.2 归属核实（本机逐项确认）

| 事实 | 0.1.6-alpha.1 | 0.1.7-rc.1 |
|---|---|---|
| `terminal-bash` 导出 `PWSH_PROMPT_SETUP` | 存在（`git show dsh-v0.1.6-alpha.1:packages/terminal/terminal-bash/src/index.ts:97`） | 仍存在（`packages/terminal/terminal-bash/src/index.ts:97`） |
| 工具侧私有 `SHELL_PROMPT` | 存在（`git show dsh-v0.1.6-alpha.1:packages/shell/tool-pwsh-persistent/src/index.ts:20`） | **删除** |
| 工具侧自有 `PWSH_PROMPT_SETUP` | 存在（同文件 `:261`） | **删除** |
| `git grep -c PWSH_PROMPT_SETUP -- packages/shell` | — | 无命中（exit 1） |

即：**提示符常量从"两份、两个所有者"收敛为"一份、后端唯一所有者"**。这与决策记录的 `## Decision` 一致：

> "The tool no longer installs a prompt. `dsh-terminal-bash` owns the pwsh `prompt` function, installs it during `spawn`, and returns the session only after that startup reached `stdin_read` readiness."

#### 9.6.3 结算信号从"文本比对"改为"缝自己的信号"

`packages/shell/tool-pwsh-persistent/src/index.ts` 的净变化：

| 旧 | 新 |
|---|---|
| `promptCompleted(result)`：视口以 `SHELL_PROMPT`（或其 `\r\n`/`\n` 变体）结尾 | `if (result.waitReason === 'stdin_read')` |
| `stripPrompt(text)`：循环剥离尾部提示符 | `trimTrailingNewline(text)`：只去一个尾换行 |
| `partialOutput` 里 `replaceAll(SHELL_PROMPT, '')` | 一并删除 |

源码注释解释了这一替换的行为含义：

> "The shell reads stdin again (its prompt, or a foreground child's own read) without having printed the end marker — an interrupt, a replaced shell, or an interactive child. Return what was captured instead of spinning until the command deadline."

#### 9.6.4 已知残留

决策记录的 `## Consequences` 末段：

> "A model command that redefines `prompt` still removes the readiness marker and degrades later sends to the silence tier: the backend installs its prompt once at startup and cannot re-assert it."

同 note 的 `## Alternatives considered` 否决了"逐提示符重装"（"PowerShell has no per-prompt hook outside the `prompt` function itself"），因此该残留被记为 documented limitation。

#### 9.6.5 同族的取消结算修正

`9d4fa54c2d fix(shell): settle persistent shell cancellation without throwing its reason` 使两个 persistent 工具在取消路径上不再 `throwIfAborted()`，而是返回空串并把 ABORTED 交给 ToolRuntime 发布。`tool-bash-persistent` 与 `tool-pwsh-persistent` 得到**逐字相同**的三处改动：

```diff
-  const id = await shells.get(owner, commandDeadline.signal)
+  let id: TerminalSessionId
+  try {
+    id = await shells.get(owner, commandDeadline.signal)
+  } catch (error: unknown) {
+    // Initialization owns rollback; only this caller's cancellation becomes ABORTED.
+    if (upstream.aborted && error === upstream.reason) return ''
+    throw error
+  }
```

```diff
-      commandDeadline.signal.throwIfAborted()
+      // ToolRuntime publishes ABORTED after this cancelled invocation settles.
+      return ''
```

```diff
-        exec.signal.throwIfAborted()
+        if (exec.signal.aborted) return '' // ToolRuntime publishes ABORTED after settlement.
```

### 9.7 Windows 子进程控制台可见性

**归因**：`f8b1309fe5 fix(subprocess): hide Windows shell console windows at creation`；决策记录 `.agents/notes/implemented/bug-fix/2026-09-16-windows-subprocess-console-visibility.md`。

#### 9.7.1 问题（引自 `## Problem`）

> "PTC runtime and shell calls share the Windows subprocess provider. Its ordinary Job runner omits window hiding, and native targets supply standard handles without a startup visibility flag. Desktop execution can therefore flash console windows for short-lived commands."

#### 9.7.2 两层改动（逐行核实）

| 层 | 文件:行 | 内容 |
|---|---|---|
| Node 侧运行器 | `packages/subprocess/subprocess-local/src/spawn.ts:122` | `windowsHide: true` |
| Native ABI 常量 | `packages/subprocess/win32-process/src/abi.ts:6` / `:8` | `STARTF_USESHOWWINDOW = 0x00000001` / `SW_HIDE = 0` |
| Native 普通进程 | `packages/subprocess/win32-process/src/process.ts:232–233` | `dwFlags: abi.STARTF_USESTDHANDLES \| abi.STARTF_USESHOWWINDOW` + `wShowWindow: abi.SW_HIDE` |
| Native 受限令牌 / Job 进程 | 同文件 `:455–456` | 同上（注释："Preserve console inheritance: CREATE_NO_WINDOW can fail restricted-token DLL initialization."） |

`StartupInfoInput` 新增必填字段 `wShowWindow: number`（`packages/subprocess/win32-process/src/ffi.ts` 的接口定义）。

#### 9.7.3 边界与"不承诺"（引自 `## Decision` / `## Consequences`）

> "No operation hides an existing parent console or promises to suppress windows explicitly opened by the command."
> "A missing console is valid; the tests do not require one to exist."
> "Session recordings cannot observe native console windows and their transcripts are unchanged."

被否决的替代方案（`## Alternatives considered`）：只隐藏外层运行器（原生目标创建独立于 Node 启动选项）；给每个进程都去掉控制台（受限令牌 + 控制台隔离标志有记录的 DLL 初始化失败）；PowerShell 启动后再隐藏（窗口可在脚本执行前变可见）。

### 9.8 shell 环境变量键声明收敛：仍为提案，未实现

任务要求核实 `.agents/notes/proposed/simplification/2026-09-19-shell-env-key-declarations.md`。**核实结论：该 note 在本版仍是 `Status: proposed`，其提议的内容未落地。**

证据：

1. 文件位于 `.agents/notes/proposed/simplification/`（未归档进 `implemented/`）；
2. 该 note 提议删除的对象在本版依然存在：
   - `BashEnvVariable` / `BashEnvVariableInfo` 类型仍在 `packages/shell/shell-env/src/index.ts`（`export interface BashEnvVariableInfo extends BashEnvVariable`）；
   - `list()` 仍在服务定义中：`docs/subsystems/shell.md` 的生成式 `ctx.shellEnv` 目录仍列出 `list(): BashEnvVariableInfo[]`，JSDoc 为 "Enumerate plugin-contributed variables without executing their resolvers."；
   - `packages/shell/shell-env/README.md:130` 的限制条目仍在："**`list()` enumerates plugin-contributed variables only**"；
3. 本版 `shell-env/src/index.ts` 的 11 行新增是**另一件事**：`DSH_PROFILE` / `DSH_PROFILE_DIR` 两个新保留键与 `ctx.get('profileContext')` 读取（见 5.8 节），归因于 `b13bbc027c feat(agent-preset): progressive creator skills and profile shell facts (#4836)`。

该 note 的 `## Risks` 自陈了保留 `list()` 的代价："Model-written and external plugins can already discover and call `list()`. They lose enumeration without resolver execution and must change contributor declarations."；其 `## Acceptance criteria` 首条要求实现前"Recheck fixed callers, recordings, generic inspection, and current product requirements"。

**未核实**：无法判断该提案的落地计划（note 无目标版本，仓库内也无对应 PR 痕迹）。

### 9.9 spill 失败不再杀死宿主，与可选原生依赖的延迟加载

#### 9.9.1 spill 失败容器化

**归因**：`cfa84ed4e3 fix(subprocess-local): contain spill file failures instead of killing the host`（另有 `cafb9b93b4`、`c22b226b18` 两轮评审修正）。

| 项 | 变化 |
|---|---|
| `OutputCollector` 构造签名 | `(maxBytes, maxSpillBytes, label, spillDir)` → `(maxBytes, label, spill?)`，`spill` 为 `{ maxBytes, dir, onFailure }` |
| 失败行为 | `spillAll` 的全部文件系统操作包进 `try/catch`：丢弃 spill、**报一次**、继续收集内存尾部 |
| 原因 | `push()` 运行在流的 `'data'` 监听器里，"where a thrown error would become an uncaught exception" |
| 上报通道 | 新增 `SpillFailureReporter`；`logSpillFailure(logger, owner)` 产出带 `code`/`syscall`/`path` 的 `error` 日志；无 logger 的裸调用者退化为 stderr 一行 |
| 目录语义 | 私有目录**只创建一次、不再重建**；被外部临时文件清理器删除后，ENOENT 走同一降级路径 |
| 路径发布时机 | 先 `openSync(file, 'wx', 0o600)` 成功再发布 `this.spillFile`，使 `discardSpill` 绝不会 unlink 不属于本进程创建的路径 |

调用点同步改写（三处）：`subprocess-local/src/spawn.ts` 的 `bindManagedProcess`、`subprocess-local/src/index.ts` 的 `reportSpillFailure`（`logSpillFailure(this.ctx.logger, 'subprocess-local')`）、`ssh/ssh/src/helper-processes.ts:104`（`logSpillFailure(ctx.logger, 'ssh helper')`）。

#### 9.9.2 可选原生依赖延迟加载

**归因**：`232ab768a9 perf(runtime): defer optional native dependencies`，并由新包 `@deepseek-ai/dsh-lazy-require`（`packages/util/lazy-require/`，`eb8cc594b3 feat(util): add caller-relative lazy require` 新增）提供原语。

本组三个消费者：

| 文件 | 替换 |
|---|---|
| `packages/subprocess/subprocess-local/src/index.ts` | `import * as nodePty from 'node-pty'` → `import type * as NodePty from 'node-pty'` + `const requireNodePty = createLazyRequire<typeof NodePty>('node-pty', import.meta.url)`，调用处 `requireNodePty().spawn(...)` |
| `packages/subprocess/win32-process/src/koffi.ts`（新增 10 行） | `export const requireKoffi = createLazyRequire<Koffi>('koffi', import.meta.url)`；`ffi.ts` 把模块级 `koffi.struct(...)`/ABI 校验整体移入 `win32Types()` 惰性缓存 |
| `packages/terminal/terminal-bash/src/session.ts` | `createRequire(import.meta.url)('@xterm/headless')` → `const requireHeadless = createLazyRequire<typeof import('@xterm/headless')>('@xterm/headless', import.meta.url)`，在 `LocalPtySession` 构造函数内解构 |

值得注意的副作用：`win32-process/src/ffi.ts` 的 ABI 布局校验（`STARTUPINFOW.size !== abi.STARTUPINFOW_SIZE`）从模块加载期推迟到首次原生操作，被 `/* v8 ignore start … stop */` 包裹；`process.ts` 中 `koffi.free/alloc/encode/decode` 全部改为 `requireKoffi().*`。

### 9.10 `packages/ssh` 自 0.1.6 新增后的本版演进

`git log --oneline dsh-v0.1.6-alpha.1..dsh-v0.1.7-rc.1 -- packages/ssh`（13 条，其中 12 条非 merge）显示：**没有一条 SSH 专属的架构或功能提交**。改动全部由其他主题的提交顺带带入。

| 提交 | 对本组的作用 |
|---|---|
| `cfa84ed4e3 fix(subprocess-local): contain spill file failures instead of killing the host` | helper 进程侧改用 `SpillFailureReporter`；`OutputCollector` 新签名同步（`helper-processes.ts:224` 附近） |
| `cafb9b93b4 fix: address adversarial review of the fatal-diagnostics branch` | 同上族 |
| `b25c5ad82e feat(web): restore sidebar layouts and reclaim unattended terminals` | `shellActivity` 透传 + `terminal.activity` RPC + 根退出后保留预留 |
| `983b89f9a5 refactor(fs): default unsupported file watching` / `4f55590aea` / `cf9213ca5f` | `fs-ssh` 明示不支持 `watch()`（README 新增限制条目） |
| `37372101b5` / `4e6028a604` | workspace 依赖范围统一（`workspace:^` → DSH 内部 `workspace:*`、vendor/native `workspace:~`） |
| 三个 release 提交 | 版本推进 |

具体源码改动（共 3 个文件、32 行）：

1. `ssh/src/helper-processes.ts`
   - `reportSpillFailure = logSpillFailure(ctx.logger, 'ssh helper')`（构造函数内）
   - `OutputCollector` 调用点适配新签名，并按 `mode.spill === undefined` 决定是否传 spill 选项
   - `terminal()` 的操作联合新增 `'activity'`
   - `shellActivity === true` 的终端在**根进程退出后不终止后代**（`:197`），显式终止路径改为"等 quiescence 后再 `rememberCompleted`"（`:326`）
2. `ssh/src/helper.ts`：方法派发新增 `terminal.activity` 分支
3. `ssh/src/schemas.ts`：`spawnSchema.terminal` 新增 `shellActivity: z.boolean().optional()`；新增 `terminalActivitySchema`

`fs-ssh/README.md:70` 新增的限制条目原文：

> "Filesystem watching is unsupported: the provider keeps no `watch()` override, so the base `FS_IO_ERROR` rejection applies without polling or opening a local watcher for a remote path. Ordinary reads and consumer-owned manual refresh remain available."

**明确排除范围**（沿用 0.1.6 的 `2026-09-11-posix-ssh-runtime.md`，本版未改动该 note）：连接丢失不重连、不重放；持久远端重连需独立的操作身份与恢复设计。

### 9.11 官方子系统文档的区间变更

`docs/subsystems/shell.md`（`M`）的三处实质变化：

| 位置 | 变化 |
|---|---|
| `ShellExecRequest` | 新增 `onExpiry`；`signal` 的 JSDoc 补充"treat a signal that is already aborted as fired" |
| `ShellExecSpec` | 新增必填 `onExpiry`；`timeoutMs` 的说明从"`start` 忽略它"改为"`'none'` 下不装定时器，仅回显"；`stdoutMaxBytes` 从"仅前台"改为"每次执行的 stdout" |
| `ShellProcess` | 新增 `observed` 成员 |
| 生成式 Cordis 目录 | `abstract run` / `abstract start` 两段删除，替换为单一 `abstract execute`；类级语义段整体重写 |

`docs/subsystems/subprocess.md`（`M`）的两处：

- 终端段把句柄操作清单补上 `inspectActivity`，并新增一句"optional allocation cancellation and shell activity observation"；
- 新增独立段落解释 `inspectActivity()` 的 `state` / `revision` 语义，并把"provider-specific support and conservative unknown cases"指向 `packages/subprocess/subprocess-local/README.md#running-terminal-sessions`（该锚点由本版新增）。

`docs/subsystems/sandbox.md`（`M`，1 行）：

| | 措辞 |
|---|---|
| 0.1.6 | "Older Landlock ABIs and the Windows ACL runner's Everyone/hard-link boundaries are current partial cases." |
| 0.1.7-rc.1 | "Older Landlock ABIs and the Windows ACL runner's hard-link, unconfined-read, and AppContainer-ACL boundaries are current partial cases." |

（该行归因于 `3d5ba3b83f fix(sandbox): scope the delete deny to containers, clearing the review round`，属 sandbox 篇范围，此处仅记录区间事实。）

`docs/subsystems/terminal.md` 与 `docs/subsystems/ssh.md` 在区间内**未改动**（`git diff --name-status` 不含二者）。但 `terminal.md` 描述的 `ctx.terminals` 契约在本版确有实现改动（`terminal-bash` 启动清理重构），说明该文档对该次改动不敏感。

### 9.12 其它值得记录的修正

| 提交 | 标题 | 对本组的说明 |
|---|---|---|
| `bb20149360` | `refactor(shell): register foreground commands as jobs at start and drop the promotion protocol` | 见 9.1.3 / 9.2 |
| `29418faf62` | `fix(shell): settle a live handle's post-termination rejection as its outcome` | 见 9.1.5 |
| `3a03d68891` | `fix(shell): serve a background spawn failure on the observed stderr stream` | 后台 spawn 失败说明改由 `observed.stderr` 承载（`ShellObservedStreams` 的动机） |
| `51d1df5c4d` / `f2f696c358` | `test(pwsh-local)/test(bash-sandbox): expect the spawn-failure note on the observed stderr stream` / `expect the merged provider-failure note for a synchronous ENOEXEC` | 上述行为的测试钉桩 |
| `053d302210` | `refactor(shell tools): hand the job registry pull sources and terminal outcomes` | 见 9.2.4 |
| `80bbdba617` | `fix(jobs): restore the dropped-output notice with its spill files for the model` | 丢弃输出的 `spillPaths` 回到模型可见面（`tool-bash/src/background.ts` 的 `read.job.output.spillPaths`） |
| `a444460ad4` | `fix(shell): never offer cancelled work from the offer arm` | offer 臂时代的修正，当前实现已无对应代码 |
| `9fe106693c` / `d8c993a622` / `600b780b97` | 三处文档/JSDoc 对齐 | `docs(shell): describe timeout promotion through the job ring, not ctx.activities` 等 |
| `8cf9c0eded` | `fix(bash): allow blank justification without escalation (#4662)` | 模型面文本：无 `sandbox_permissions` 时 `justification` 可省略/空白（`tool-bash/README.md:68`） |
| `61c548e200` / `aea150a17e` | `fix(sandbox): accept repeated effective permission modes` + 测试 | 重复请求当前模式不需审批 |
| `e30f0c7774` | `test(terminal): check descendant quiescence instead of PID removal` | 终端清理断言改为后代静默 |
| `580bdc7258` | `refactor: remove redundant unknown casts` | 与本仓 `2026-09-19-no-unknown-casts.md` 规则同族；本组体现为 `terminal/tests/service.spec.ts` 的两处 `as unknown` → `: unknown` 声明 |
| `1ccef293fa` / `cc872a39b9` / `149ed69912` | Windows Job fixture 清理归属、owned exit listener、配置 ZDOTDIR 而无 zsh | subprocess 测试稳定性 |
| `b7632168cc` / `4b1db738f5` / `d23fdf8ab7` / `592dfd8854` | 4 个 CI/测试提交 | 覆盖 executor 超时 kill、offer 到期套件移植、owned promotion 路径 |
| `4a79310339` / `69d8b6e7ea` / `053979cdec` | `feat(activity): optional live-output observation seam with a web viewer` 等 3 条 activity 提交 | `ctx.activities` 的实时输出观察缝（属 jobs/activity 篇） |
| `8537b8d5bb` | `refactor(shell,workflow): produce into the job record instead of ctx.activities` | shell 工具的产出目标从 `ctx.activities` 改为 job record |
| `37372101b5` / `4e6028a604` | `build: pin internal DSH workspace dependencies` / `build: use tilde ranges for vendor and native workspaces` | 本组 20 个 `package.json` 大量 `+/-` 行的**主因**，非功能变更 |

---

## 10 未核实与存疑清单

| 项 | 状态 | 原因 |
|---|---|---|
| `packages/shell/shell/README.md:97` 仍描述已删除的 `SHELL_SETTINGS_NAMESPACE` | **已核实漂移存在，未核实意图** | 源码全仓无该标识符（排除 `.agents/` 与两份 README）；无法判断是有意保留的历史说明还是遗漏 |
| 用户终端在 Web 组合中的 subprocess containment 选择路径 | **未核实** | `packages/api/terminal-controller/src/index.ts` 的 `spawnTerminal` 调用未传沙箱策略字段；本次未逐行追踪 Web 组合下 `selectContainmentMode('terminal')` 的判定输入 |
| `2026-09-19-shell-env-key-declarations.md` 提案的落地计划 | **未核实** | note 为 `proposed`，无目标版本、无对应 PR 痕迹 |
| `2026-09-21-persistent-pwsh-keeps-controlled-prompt.md` 的性能数字 | **引自 note，未在本机复现** | 8493→1340 ms 等为 note 记录的作者本机测量（Windows / 生产默认值 / 真实 Loader 组合） |
| `2026-08-26-shell-execute-projection-and-jobs-at-start.md` 的 `## Testing` 断言清单 | **引自 note，未逐条执行** | 本次未运行 `pnpm run test`（构建/测试需完整工作区依赖，超出本次分析范围） |
| `docs/subsystems/terminal.md` / `ssh.md` 未随实现改动 | **已核实未改动，未核实是否有意** | `git diff --name-status` 确认二者不在变更清单；文档与实现是否存在漂移未逐段核对 |
| 本版 `packages/terminal/terminal/src/index.ts` 是否真的零改动 | **已核实** | `git diff --stat` 未列出该文件，仅 `tests/service.spec.ts` + `package.json` 变化 |

---

## 附录 A 本版提交索引

### A.1 `packages/shell`（非 merge，49 条，按时间倒序）

| commit | 标题 |
|---|---|
| `b13bbc027c` | `feat(agent-preset): progressive creator skills and profile shell facts (#4836)` |
| `601d6761e4` | `feat(settings): project volatile Config through profile-backed forms (#4587)` |
| `74f4c438de` | `test(pty): pin the pwsh fast path by settle reason` |
| `97545d9c8f` | `fix(pty): keep the controlled prompt so persistent pwsh settles fast` |
| `bb20149360` | `refactor(shell): register foreground commands as jobs at start and drop the promotion protocol` |
| `8cf9c0eded` | `fix(bash): allow blank justification without escalation (#4662)` |
| `d8c993a622` | `docs(shell): clarify queued cancellation regression coverage` |
| `8771607f8b` | `test: cover sidebar fork and persistent shell cancellation regressions` |
| `9d4fa54c2d` | `fix(shell): settle persistent shell cancellation without throwing its reason` |
| `3d5ba3b83f` | `fix(sandbox): scope the delete deny to containers, clearing the review round` |
| `70cacfdcaa` | `test(shell): cover cancellation before reading failed launch results` |
| `fb79a944f5` | `refactor(llm): separate durable producer sources from request inputs` |
| `f4a32dbd0a` | `refactor(llm): flatten tool results and validate native V4 sessions` |
| `1a7308fbaa` | `test(shell): synchronize background process completion` |
| `6b1808f432` | `release(dsh): 0.1.6-alpha.2` |
| `aea150a17e` | `test(pwsh): align repeated sandbox mode expectations` |
| `61c548e200` | `fix(sandbox): accept repeated effective permission modes` |
| `4b1db738f5` | `test(bash): control promotion deadline after output readiness` |
| `3df99217dc` | `refactor(jobs): restore direct calls and align remote names` |
| `29418faf62` | `fix(shell): settle a live handle's post-termination rejection as its outcome` |
| `f2f696c358` | `test(bash-sandbox): expect the merged provider-failure note for a synchronous ENOEXEC` |
| `51d1df5c4d` | `test(pwsh-local): expect the spawn-failure note on the observed stderr stream` |
| `8bcd6f7519` | `refactor(jobs): rename visibleTo/VisibleJobs to forCaller/CallerJobs` |
| `a444460ad4` | `fix(shell): never offer cancelled work from the offer arm` |
| `600b780b97` | `chore(shell): align the pwsh mirror comments and the promotion read JSDoc` |
| `9fe106693c` | `docs(shell): describe timeout promotion through the job ring, not ctx.activities` |
| `3a03d68891` | `fix(shell): serve a background spawn failure on the observed stderr stream` |
| `80bbdba617` | `fix(jobs): restore the dropped-output notice with its spill files for the model` |
| `b7632168cc` | `test(tool-pwsh): pin the integration suite to the executor's timeout kill` |
| `053d302210` | `refactor(shell tools): hand the job registry pull sources and terminal outcomes` |
| `b48c05d117` | `refactor(jobs): type the producer face by the record declaration, tidy review residue` |
| `761282724b` | `fix(jobs): constant pump waits, quiescent client disposal, record flag on the roster` |
| `a5af861041` | `fix(ci): finish the background-workflow snapshot fallout` |
| `d23fdf8ab7` | `test(ci): port the offer-expiry executor suite to pwsh-local` |
| `592dfd8854` | `test(ci): cover the owned promotion paths` |
| `3c79e71cdc` | `docs(i18n): mirror the record refactor across the bilingual pairs` |
| `8537b8d5bb` | `refactor(shell,workflow): produce into the job record instead of ctx.activities` |
| `053979cdec` | `test(activity): cover the owner arm and the pwsh outer observation catch` |
| `d6bebc5783` | `feat(shell): converge on execute() and promote timed-out commands to jobs` |
| `51f74910ae` | `feat(jobs): human job kill with an unclaimed terminal report` |
| `47ee13dd74` | `fix(ci): repair the four failures the master merge left behind` |
| `69d8b6e7ea` | `fix(activity): bind observation cleanup to its generation and settle before mapping the outcome` |
| `4a79310339` | `feat(activity): optional live-output observation seam with a web viewer` |

（另有 52 条 merge 提交未列出。）

### A.2 `packages/subprocess`（非 merge，17 条）

（四个包组共有的 3 个 release 提交与 2 个 workspace 范围 build 提交在本组同样出现，下表不再重复列出。）

| commit | 标题 |
|---|---|
| `c22b226b18` | `fix: address review threads on the fatal-diagnostics PR` |
| `cafb9b93b4` | `fix: address adversarial review of the fatal-diagnostics branch` |
| `cfa84ed4e3` | `fix(subprocess-local): contain spill file failures instead of killing the host` |
| `580bdc7258` | `refactor: remove redundant unknown casts` |
| `1ccef293fa` | `fix(tests): keep Windows Job fixture cleanup with its owner` |
| `f8b1309fe5` | `fix(subprocess): hide Windows shell console windows at creation` |
| `cc872a39b9` | `test(subprocess): verify owned exit listeners on disposal` |
| `149ed69912` | `test(subprocess-local): cover configured ZDOTDIR without zsh` |
| `281723bed8` | `fix(web): isolate terminal bindings and validate saved layouts` |
| `232ab768a9` | `perf(runtime): defer optional native dependencies` |
| `b25c5ad82e` | `feat(web): restore sidebar layouts and reclaim unattended terminals` |

### A.3 `packages/terminal`（非 merge，11 条）

| commit | 标题 |
|---|---|
| `e30f0c7774` | `test(terminal): check descendant quiescence instead of PID removal` |
| `580bdc7258` | `refactor: remove redundant unknown casts` |
| `232ab768a9` | `perf(runtime): defer optional native dependencies` |
| `b25c5ad82e` | `feat(web): restore sidebar layouts and reclaim unattended terminals` |
| `10d76fbd03` | `refactor(producers): subagent and terminal jobs use session owners, results, and pull sources` |

（另有 23 条 merge 提交未列出；release/build 提交同上。）

### A.4 `packages/ssh`（非 merge，12 条）

| commit | 标题 |
|---|---|
| `cafb9b93b4` | `fix: address adversarial review of the fatal-diagnostics branch` |
| `cfa84ed4e3` | `fix(subprocess-local): contain spill file failures instead of killing the host` |
| `983b89f9a5` | `refactor(fs): default unsupported file watching` |
| `4f55590aea` | `fix(sidebar): correct automatic refresh and watch lifecycles` |
| `cf9213ca5f` | `fix(sidebar): finalize resource auto-refresh behavior and tests` |
| `b25c5ad82e` | `feat(web): restore sidebar layouts and reclaim unattended terminals` |

（另有 1 条 merge 提交未列出；release/build 提交同上。）

### A.5 本版相关决策记录（`.agents/notes/`）

| 路径 | 状态 | 与本文的关系 |
|---|---|---|
| `implemented/feature/2026-08-26-shell-execute-projection-and-jobs-at-start.md` | implemented | 9.1 / 9.2 的权威依据 |
| `implemented/feature/2026-08-26-shell-execute-projection-and-jobs-at-start.zh.md` | — | 中文对照 |
| `implemented/feature/2026-08-26-human-job-kill.md` | implemented | 9.2.5 |
| `implemented/architecture/2026-09-16-user-terminal-permissions.md` | implemented | 9.5 的权威依据 |
| `implemented/bug-fix/2026-09-21-persistent-pwsh-keeps-controlled-prompt.md` | implemented | 9.6 的权威依据 |
| `implemented/bug-fix/2026-09-16-windows-subprocess-console-visibility.md` | implemented | 9.7 的权威依据 |
| `.agents/notes/proposed/simplification/2026-09-19-shell-env-key-declarations.md` | **proposed（本版未实现）** | 9.8 |
| `implemented/feature/2026-09-14-unattended-browser-terminal-reclamation.md` | implemented | 9.4 的权威依据 |
| `implemented/architecture/2026-09-03-jobs-seam-consolidation.md` | implemented | 9.2.4 / 9.2.5 的上位 note（jobs 篇） |
| `implemented/architecture/2026-09-11-posix-ssh-runtime.md` | implemented（0.1.6 引入，本版未改） | 9.10 的范围界定 |

> 上表首行的物理路径为 `.agents/notes/proposed/simplification/2026-09-19-shell-env-key-declarations.md`；`git ls-files` 确认其**不在** `implemented/` 之下。

---

## 附录 B 本版新增文件清单

命令：`git diff --name-status dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/shell packages/subprocess packages/terminal packages/ssh`，过滤 `^A`。共 **8** 个新增文件，**0** 个删除、**0** 个重命名。

| 路径 | 行数 | 说明 |
|---|---|---|
| `packages/shell/tool-bash/tests/background.spec.ts` | 502 | job-at-start / 提升 / `[stopped: …]` 的工具级测试 |
| `packages/shell/tool-pwsh/tests/background.spec.ts` | 566 | 上述场景的 pwsh 镜像 |
| `packages/subprocess/subprocess-local/src/shell-activity.ts` | 131 | bash/zsh 私有生命周期记录与 `ShellActivity` |
| `packages/subprocess/subprocess-local/tests/shell-activity.spec.ts` | 115 | 活动状态与 revision |
| `packages/subprocess/subprocess-local/tests/shell-activity-files.spec.ts` | 81 | 私有生命周期文件 |
| `packages/subprocess/win32-process/src/koffi.ts` | 10 | 进程域内 Koffi 的惰性加载器 |
| `packages/subprocess/win32-process/tests/fixtures/console-state.ts` | 7 | 控制台可见性 fixture |
| `packages/terminal/tool-terminal/src/background.ts` | 31 | 终端后台发送的 registry pull source |

---

*文档生成时间：2026-09-25*
*数据源：dsh-v0.1.7-rc.1（`46a7f68b0922371ce7144b668b90e377d8e799f4`）vs dsh-v0.1.6-alpha.1（`0a15e36e7f`）*
*本地检出：`E:\test\rewrite-agently\deepseek-harness`（HEAD = `dsh-v0.1.7-rc.1`）*
