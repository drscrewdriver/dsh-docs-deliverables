# 【第 05 篇】执行世界：fs / sandbox / subprocess / ptc-runtime / native —— 从 code-runtime 到 PTC 运行时

> **版本**：dsh-v0.1.6-alpha.1（commit `0a15e36e7f`）｜**上版**：dsh-v0.1.5-rc.2（commit `fb2c4b9e69`）
> 难度：🟡 进阶（建议先读第 02、03 篇）
> 前置阅读：`v0.1.5-rc.2/05-execution-world.md`
> 覆盖目录：`packages/fs/`、`packages/sandbox/`、`packages/subprocess/`、`packages/ptc-runtime/`、`native/`
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

"执行世界"指文件提供者与进程提供者共享的同一套路径与进程坐标。第 03 篇讲执行侧的四条缝，本篇讲它们脚下的世界：文件身份与原子变更、进程的文件效果约束、进程树与输出捕获、模型编写的程序如何在这个世界里跑起来，以及承载平台能力的原生模块。

| 包组 | 目录 | 官方子系统文档 | 本版状态 |
|---|---|---|---|
| fs | `packages/fs/` | `docs/subsystems/filesystem.md` | 实现修改；**子系统文档本身未改动** |
| sandbox | `packages/sandbox/` | `docs/subsystems/sandbox.md` | 修改（`confine` 接口变更 + 新增诊断模块） |
| subprocess | `packages/subprocess/` | `docs/subsystems/subprocess.md` | 修改（控制通道、终端环境事实、输出模块） |
| ptc-runtime | `packages/ptc-runtime/` | `docs/subsystems/ptc-runtime.md` | **新增包组**（取代 `packages/code-runtime/`） |
| workflow | `packages/workflow/` | `docs/subsystems/workflow.md` | 修改（引擎实现换成 `workflow-ptc`） |
| native | `native/system/` | `native/README.md` | 修改（打包脚本与测试） |
| （已移除）code-runtime | `packages/code-runtime/` | `docs/subsystems/code-runtime.md`（**已删除**） | **整体移除** |

「filesystem 子系统文档未改动」的依据：`git -C <repo> diff dsh-v0.1.5-rc.2..dsh-v0.1.6-alpha.1 -- docs/subsystems/filesystem.md` **无输出**。

各组改动量（`git diff --shortstat`）：`ptc-runtime` + `code-runtime` 58 files / +3174 / -2625；`subprocess` 51 files / +1859 / -447；`sandbox` 38 files / +600 / -176；`fs` 45 files / +223 / -123；`workflow` 59 files / +1939 / -2932；`native` 19 files / +251 / -52。

决策记录索引（`.agents/notes/implemented/`）：`architecture/2026-09-11-sandboxed-node-ptc-runtime.md`、`architecture/2026-09-12-ptc-runtime-vocabulary.md`、`architecture/2026-07-31-ptc-runtime-python-fd3-protocol.md`、`architecture/2026-09-11-subprocess-control-pipe.md`、`architecture/2026-09-13-workflow-ptc-sandbox-reuse.md`、`simplification/2026-09-11-remove-e2b-providers.md`、`bug-fix/2026-09-12-linux-scope-direct-kill-settlement.md`。

---

## 1 概述

本版对执行世界的改动可以概括成三句话：

1. **代码执行缝改名并换了基底**：`ctx.codeRuntime` 成为 `ctx.ptcRuntime`；TypeScript 后端从"隔离的 Node worker 线程"变成"受沙箱约束的全新 Node 进程"。
2. **准备阶段变成一等公民**：`ctx.sandbox.confine` 与执行器启动都变成异步可取消的准备，且与前台的 deadline 共用同一个信号。
3. **远程世界换人**：E2B 组整体移除，`packages/ssh` 提供同坐标系的远程文件/进程/沙箱提供者；`filesystem.md` 的契约因此没有改动。

| 服务 | ctx 键 | 角色 | 实现 | 消费者 |
|---|---|---|---|---|
| 文件系统 | `ctx.fs` | `seam` | `fs-local`、`fs-sandbox`、**`fs-ssh`** | `tool-fs` |
| 进程约束 | `ctx.sandbox` | `seam` | `sandbox-local`、**`sandbox-ssh`** | `bash-sandbox`、`pwsh-sandbox`、`terminal-bash`、`ptc-runtime-node` |
| 进程树 | `ctx.subprocess` | `seam` | `subprocess-local`、**`subprocess-ssh`** | 见第 03 篇 |
| 程序执行 | **`ctx.ptcRuntime`** | `seam` | **`ptc-runtime-node`**、`experimental-ptc-runtime-python` | `tools`、**`workflow-ptc`** |
| 沙箱策略 | `ctx.sandboxPolicy` | `core` | `sandbox-policy` | `bash-sandbox`、`fs-sandbox`、`terminal-bash`、`ptc-runtime-node` |

---

## 2 核心概念

| 术语 | 英文 | 含义 |
|---|---|---|
| 不透明目标身份 | opaque target identity | `FsTargetKey` 是 branded id；消费者不得解析或假设它是本地绝对路径 |
| 执行世界拼写 | execution-world spelling | 本版用词：策略解析器保留绝对执行世界拼写，**由实施约束的提供者在自己宿主上解析符号链接与 `..`** |
| 文件效果模式 | file-effect mode | `SandboxMode`：`read-only` / `workspace-write` / `danger-full-access` |
| 强制完成度 | enforcement completeness | `SandboxEnforcement`：`full` / `partial`；partial 不得被当作 full |
| 运行器失败 | runner failure | 启用了约束的 runner 自身启动失败（命令从未执行），与"命令被隔离拒绝"是两件事 |
| PTC | program-to-call | 模型写一段程序，通过宿主提供的异步绑定调用工具，只返回打印输出与完成值 |
| 运行规格 | `PtcRunSpec` | 本版新增：`resolve(request)` 补全后的目录、deadline 与 authority，`run(spec)` 不再兜默认值 |
| 沙箱事实 | `PtcRunSandbox` | 本版新增：与程序结果**正交**的文件模式 / 观察到的拒绝 / 强制完成度 |

---

## 3 包结构

**`packages/fs/`**：`fs`（`ctx.fs` 契约：执行世界路径、有界文本 I/O、带可选版本守卫的原子变更）、`fs-local`、`fs-sandbox`、`fs-observation-policy`（先读后写策略，`fs/*` 事件门）、`tool-fs`、`tool-fs-search`、`tool-present`、`tool-str-replace-editor`。`packages/fs/README.md` 的措辞从 "Eight packages plus the remote sibling `fs-e2b`" 改为 "Eight packages play the filesystem roles"——**远程后端不再挂在本组**。

| 包组 | 本版新增 / 重点文件 |
|---|---|
| `packages/sandbox/` | `sandbox` 新增 `src/diagnostics.ts` 与 `tests/diagnostics.spec.ts`；`sandbox-windows-acl` 新增 `tests/control.spec.ts`；另有 `sandbox-local`（Linux bwrap/Landlock、macOS Seatbelt、Windows ACL 受限令牌）与 `sandbox-policy` |
| `packages/subprocess/` | `subprocess`、`subprocess-local`、`win32-process`——本版细节见第 03 篇 |
| `native/system/` | `scripts/pack-release.mjs`（102 行变动）、`test/release-packing.test.js`（新增 151 行）、`docs/packaging.md`（+2 行）与各 `package.json` 版本号 |

**`packages/ptc-runtime/`（本版新增）**：`ptc-runtime/` 定义 PTC 运行时做什么——针对宿主绑定运行一段程序、报告打印内容与返回值，服务键 `ctx.ptcRuntime`；`ptc-runtime-node/` 在受已解析沙箱策略约束的全新受管 Node 进程中执行 TypeScript，注册 `ctx.ptcRuntime`；`experimental/ptc-runtime-python/` 是实验性 Python 后端，拥有 Node 宿主与 CPython 子进程之间的 fd-3 线协议。

`ptc-runtime-node` 的 `package.json` 声明 `exports["./process"]` → `lib/process.js` 与 `lib/types/process-entry.d.ts`，即**程序侧的独立入口**。

---

## 4 关键类型

**PTC 执行缝**（`packages/ptc-runtime/ptc-runtime/src/types.ts`）：

```ts
interface PtcRunRequest {
  program: string
  bindings: PtcBindingNamespace[]
  cwd?: string
  timeoutMs?: number | null      // 省略 = 提供者默认；null = 无 elapsed deadline
  sandboxPolicy?: SandboxExecutionPolicy
  signal?: AbortSignal
}
interface PtcRunSpec extends PtcRunRequest { cwd: string; timeoutMs: number | null }
interface PtcRunSandbox { mode: SandboxMode; denied: boolean; enforcement?: SandboxEnforcement }
interface PtcRunResult { sandbox?: PtcRunSandbox; value?: PtcJsonValue; logs: string[]; error?: PtcRunFailure }
```

失败分类由 rc.2 的 6 种扩到 8 种：新增 `'protocol'`（程序发送了非法或超预算的控制流量）与 `'sandbox-unavailable'`（所需约束无法建立）。服务定义（`packages/ptc-runtime/ptc-runtime/src/index.ts`）新增三个 getter（`executionInstructions`、`sandboxMode`、`timeout`）并把 `run(request)` 拆成 `resolve(request): PtcRunSpec` + `run(spec): Promise<PtcRunResult>`。

**sandbox 缝**（`packages/sandbox/sandbox/src/index.ts`）：

```ts
abstract confine(argv: readonly string[], policy: SandboxPolicy, signal?: AbortSignal): Promise<ConfinedArgv>
export { classifyRunnerFailure, isRunnerSpawnFailure, matchesSignature } from './diagnostics.ts'
```

**fs 的路径拼写**（`packages/fs/fs-local/src/fsio.ts`）：新增导出 `localDisplayPath(cwd, path): string`；`realpath` 改用 `promisify(realpathCallback.native)`。

**`ptc-runtime-node` 的配置默认值**（`src/index.ts`）：`timeoutMs` 120000、`maxTimeoutMs` 600000、`maxOutputBytes` 67108864、`maxOldGenerationSizeMb` 512、`maxMessageBytes` 134217728、`maxPendingCalls` 128、`graceMs` 3000；描述符 `language = 'typescript'`、`isolation = 'process'`、`sandboxMode` 取自 `ctx.sandboxPolicy.defaultMode`。

---

## 5 数据流

**一次 `run_code`**：

```
模型 → ctx.tools（mode: ptc / both）→ run_code 工具
  → ctx.ptcRuntime.resolve(request) → PtcRunSpec（cwd / timeoutMs / sandboxPolicy 已补全）
  → ptc-runtime-node.run(spec)
       ├─ 解析沙箱策略 → ctx.sandbox.confine(argv, policy, signal) → ConfinedArgv
       ├─ ctx.subprocess.spawn(spec + stdio.control: 'pipe') → 受管 Node 进程
       ├─ fd 7 控制通道：宿主 ↔ 程序的绑定调用与输出账本
       └─ 程序结束/超时/取消/协议失败 → 受管进程 owner 关闭执行
  → PtcRunResult { sandbox, value, logs, error }
```

三条不可动摇的规则（引自 `2026-09-11-sandboxed-node-ptc-runtime.md`）：文件模式/拒绝/完成度**与程序结果分开**放在 `PtcRunResult.sandbox`（程序成功不证明强制完整）；模型代码可写控制通道，**其字节始终不可信**（宿主对帧、排队写、挂起调用与未完成参数字节设界，派发前校验调用身份与绑定白名单）；**拒绝或传输失败从不自动重放可能已产生副作用的程序**。

**时间预算的三种输入**：省略 → 提供者默认（120s）并受 `maxTimeoutMs`（600s）封顶；数值 → 正有限数并被 resolver 封顶；`null` → 无 elapsed deadline（受信服务消费者可用；模型面 `run_code` 只接受正数值覆盖）。

**沙箱包裹（本地）**：`ctx.sandbox.confine(argv, policy, signal)` → `sandbox-local` 入口 `signal?.throwIfAborted()` → `policy = { ...policy, workspaceRoot: canonicalPath(policy.workspaceRoot) }` → 选择 runner → `ConfinedArgv { argv, enforcement, denialSignatures, runnerFailureRules }`。`ctx.sandboxPolicy` 侧在 `resolveWorkspaceRoot` 中**不再 canonicalize**，只要求绝对路径。

---

## 6 测试覆盖

| 包组 | rc.2 | 0.1.6-alpha.1 | 增量 |
|---|---|---|---|
| `packages/ptc-runtime` | 0 | 16 | +16（全新） |
| `packages/sandbox` | 25 | 27 | +2 |
| `packages/subprocess` | 23 | 27 | +4 |
| `packages/fs` | 25 | 25 | 0 |
| `packages/workflow` | 15 | 17 | +2 |

重点新增/改写的测试文件（`git diff --stat` 变更行数）：

| 文件 | 行数 | 覆盖 |
|---|---|---|
| `packages/ptc-runtime/ptc-runtime-node/tests/host-failures.spec.ts` | 515（新增） | 宿主绑定失败分类与结算 |
| `packages/ptc-runtime/ptc-runtime-node/tests/runtime.spec.ts` | 306（新增） | 运行时分派 |
| `packages/ptc-runtime/ptc-runtime-node/tests/channel.spec.ts` | 166（新增） | 控制通道分帧与有界写 |
| `packages/ptc-runtime/ptc-runtime-node/tests/process-main.spec.ts` | 143（新增） | 子进程入口 |
| `packages/sandbox/sandbox/tests/diagnostics.spec.ts` | 144（新增） | 运行器失败归因 |
| `packages/sandbox/sandbox-windows-acl/tests/control.spec.ts` | 73（新增） | 控制通道在受限令牌路径下的继承 |
| `packages/subprocess/subprocess-local/tests/linux-scope.spec.ts` | 488（修改） | Linux scope 结算 |
| `packages/fs/fs-local/tests/fsio.spec.ts` | 62（修改） | 路径拼写与物理穿越 |

`packages/fs` 的测试文件数未变——测试内容被改写而非新增。

---

## 7 与上游/下游的关系

- **上游**：`sandbox-local` 依赖 `native/`（`@deepseek-ai/node-addon-system` 的 `landlock-run` 等原生模块）；`ptc-runtime-node` 消费 `ctx.fs`（宿主文件映射）与 `ctx.subprocess`（进程生命周期）。
- **下游**：`ctx.ptcRuntime` 的消费者是 `tools`（PTC 呈现）与 `workflow-ptc`（工作流编排）；`ctx.fs` 的消费者是 `tool-fs`；`ctx.sandbox` 的消费者含第 03 篇的 shell 执行器与 `terminal-bash`。
- **`ctx.ptcRuntime` 的依赖边变化**（`docs/capability-seams.md`）：旧的 `svc_codeRuntime --> pkg_tools` 一行被替换为 `svc_ptcRuntime --> pkg_tools` 与 `svc_ptcRuntime --> pkg_workflow_ptc` 两行。

---

## 8 本版本变更要点（rc.2 → 0.1.6-alpha.1）

### 8.1 关键结论：`code-runtime` 不是纯重命名，能力边界同时变了

**结论**：从 `packages/code-runtime` 到 `packages/ptc-runtime` 的变化是**"命名迁移 + 执行基底更换 + 能力面扩张"三件事同时发生**。只把它读成 rename 会漏掉全部重要信息。下面给出五条互相独立的证据。

#### 8.1.1 证据 A：路径迁移（`git diff --name-status -M`）

| 相似度 | 旧路径 | 新路径 |
|---|---|---|
| R056 / R054 | `packages/code-runtime/README.i18n.yaml`、`.../code-runtime/README.i18n.yaml` | 对应的 `packages/ptc-runtime/` 下同名文件 |
| R066 | `packages/code-runtime/code-runtime/src/index.ts` | `packages/ptc-runtime/ptc-runtime/src/index.ts` |
| R060 | `packages/code-runtime/code-runtime/src/types.ts` | `packages/ptc-runtime/ptc-runtime/src/types.ts` |
| R059 / R084 | `.../code-runtime/package.json`、`tsconfig.json` | `.../ptc-runtime/package.json`、`tsconfig.json` |
| R098 / R067 | `.../code-runtime/tests/reserved.spec.ts`、`tests/service.spec.ts` | 同名新路径 |
| R091 / R088 / R094 / R053 / R065 / R053 | `.../code-runtime-worker-thread/src/{bootstrap.ts, worker-json.ts, output-json.ts, protocol.ts}`、`tsconfig.json`、`README.i18n.yaml` | `.../ptc-runtime-node/src/{bootstrap.ts, json-wire.ts, output-json.ts, protocol.ts}`、`tsconfig.json`、`README.i18n.yaml` |
| R092 / R095 / R085 / R068 | `.../code-runtime-worker-thread/tests/{bootstrap.spec.ts, output-json.spec.ts, worker-json.spec.ts, built-lib.e2e.ts}` | `.../ptc-runtime-node/tests/{bootstrap.spec.ts, output-json.spec.ts, json-wire.spec.ts, built-lib.e2e.ts}` |

**删除且无对应物**（`--diff-filter=D`，13 个文件，括号内为删除行数）：组 README 两份（52/52）、`code-runtime/README.{md,zh.md}`（144/144）、`code-runtime-worker-thread/README.{md,zh.md}`（156/156）、`.../package.json`（49）、`.../src/index.ts`（**561**）、`.../src/worker.ts`（14）、`.../tests/runtime.spec.ts`（**902**）、`.../tests/budget.spec.ts`（95）、`.../tests/source-worker.compat.spec.ts`（39）、`.../tsdown.config.ts`（29）。

**新增且无来源**（`--diff-filter=A`，`ptc-runtime-node` 部分，括号内为新增行数）：`src/index.ts`（**357**）、`src/channel.ts`（140）、`src/process.ts`（90）、`src/output-ledger.ts`（66）、`src/bindings.ts`（51）、`src/launch.ts`（38）、`src/output-stream.ts`（29）、`src/process-entry.ts`（5）、`src/environment.ts`（4）、`package.json`（61）、两份 README（155/155），以及 `tests/` 下 10 个新文件（`host-failures` 515、`runtime` 306、`channel` 166、`process-main` 143、`process` 50、`launch` 25、`output-stream` 35、`output-ledger` 26、`bindings` 23、`setup` 23）。

**读法**：worker 线程的执行内核（`src/index.ts` 561 行 + `src/worker.ts`）被整段删除，替换成一组新增的受管进程内核（`index`/`process`/`channel`/`launch`/`output-ledger`/`output-stream`/`process-entry`/`environment`）。只有 `bootstrap`、`protocol`、`output-json` 与两个 `tsconfig`/`README.i18n.yaml` 作为**文本相似的重命名**保留下来——即与宿主无关的部件被保留，与执行基底强耦合的部件被重写。

#### 8.1.2 证据 B：README 的措辞（`git show <tag>:<path>`）

| 维度 | rc.2 `packages/code-runtime/README.md` | 0.1.6 `packages/ptc-runtime/README.md` |
|---|---|---|
| 组标题 | `code-runtime/ — code-execution capability family` | `ptc-runtime/ — PTC execution capability family` |
| front-matter description | "Package map for the code-execution capability family" | "Package map for the PTC execution capability family" |
| TypeScript 后端 | "execution in an **isolated Node worker**" | "execution in a **fresh Node process under the configured sandbox policy**" |
| 服务键 | `ctx.codeRuntime` | `ctx.ptcRuntime` |
| 子系统文档 | `docs/subsystems/code-runtime.md` | `docs/subsystems/ptc-runtime.md` |
| Python 后端路径 | `experimental/code-runtime-python` | `experimental/ptc-runtime-python` |

`docs/subsystems` 的 name-status 同时显示 `D docs/subsystems/code-runtime.md`、`D docs/subsystems/code-runtime.zh.md` 与 `A docs/subsystems/ptc-runtime.md`、`A docs/subsystems/ptc-runtime.{zh.md,i18n.yaml}`。

#### 8.1.3 证据 C：公共类型差异

| 维度 | rc.2（`CodeRun*`） | 0.1.6（`PtcRun*`） |
|---|---|---|
| 请求字段 | `program`、`bindings`、`signal` | 增加 `cwd?`、`timeoutMs?: number \| null`、`sandboxPolicy?` |
| 规格类型 | **无** | 新增 `PtcRunSpec`（`cwd: string`、`timeoutMs: number \| null`） |
| 服务方法 | `run(request)` | `resolve(request)` + `run(spec)` |
| 结果字段 | `value`、`logs`、`error` | 增加 `sandbox?: PtcRunSandbox` |
| 失败种类 | 6 种 | 8 种（+`protocol`、+`sandbox-unavailable`） |
| 服务 getter | `language`、`isolation` | 增加 `executionInstructions`、`sandboxMode`、`timeout` |
| 绑定词汇 | `CodeBindingNamespace` 等 | 改名 `PtcBindingNamespace` 等（`RESERVED_BINDING_GLOBALS`、`RESERVED_ERROR_MEMBERS`、`DUNDER_MEMBER`、`PORTABLE_RESERVED_WORDS` 四个导出**内容未变**） |

#### 8.1.4 证据 D：依赖变化

`packages/ptc-runtime/ptc-runtime/package.json` 的 `peerDependencies` 比 rc.2 的 `packages/code-runtime/code-runtime/package.json` **多出 `@deepseek-ai/dsh-sandbox`**（`devDependencies` 同步）。这是"执行缝开始直接认识沙箱"的机械证据——rc.2 的 code-runtime 缝不依赖 sandbox。

#### 8.1.5 证据 E：决策记录的自述

`.agents/notes/implemented/architecture/2026-09-11-sandboxed-node-ptc-runtime.md` 的 `## Problem`：

> "A Node worker isolates JavaScript state but does not apply the calling Session's OS sandbox policy. Model code can import filesystem and subprocess APIs directly, bypassing the tool-policy path even when nested `tools.*` calls receive the correct checks. Terminating the worker also does not establish that its child processes have stopped."

同节说明该决策 "supersedes its worker-based execution, trust and budget realization while preserving those consumer rules"——被保留的消费者规则是：注册表呈现、生成的绑定、派发日志与一次性结算（仍归 PTC foundation 所有）。

#### 8.1.6 能力边界变化对照表

| 能力 | rc.2 | 0.1.6 |
|---|---|---|
| 隔离基底 | Node worker 线程（提供者 `readonly isolation = 'worker-thread'`） | 受管 Node 进程（提供者 `readonly isolation = 'process'`） |
| 操作系统文件约束 | 无 | 经 `ctx.sandbox.confine` 施加 |
| 进程树生命周期 | worker 终止 | 归 `ctx.subprocess` 的受管进程 owner 所有 |
| 工作目录 | 不参与 | `cwd` 成为请求字段与解析后规格的必填项 |
| 时间预算 | 实现自有配置，请求不可调 | `timeoutMs` 可省略 / 可数值 / 可为 `null`（三方语义） |
| 与宿主的额外通道 | 无（键控 worker 消息） | fd 7 双工控制通道（与 stdout/stderr 分离） |
| sandbox 事实 | 无 | `PtcRunResult.sandbox` |
| 代码执行缝的消费者 | 仅 `tools` | `tools` + `workflow-ptc` |

（`isolation` 取值来自 `git show dsh-v0.1.5-rc.2:packages/code-runtime/code-runtime-worker-thread/src/index.ts` 与 `packages/ptc-runtime/ptc-runtime-node/src/index.ts`。）

#### 8.1.7 命名治理

`.agents/notes/implemented/architecture/2026-09-12-ptc-runtime-vocabulary.md` 记录了命名决策：

- 执行能力统一使用 `ptc-runtime` 包族、`PtcRuntime` 类型与 `ctx.ptcRuntime`；profile 入口标识符、内部 bootstrap 选择器、编译器引用、包导出与生成式目录使用同一套名字。
- **不提供兼容包或第二处服务注册**；理由是 API 处于 pre-stable 且仓库内每个消费者一起迁移，别名会保留重复的包与服务身份并使后续发现含糊。
- 模型面的 `run_code` 操作名、其 `code` 源参数与稳定失败身份**保留描述性名称**；通用源码术语、错误码、外部项目名与 URL、历史迁移标识符与已封存的 Agent Note 保留原拼写。

#### 8.1.8 执行与资源上限（`2026-09-11-sandboxed-node-ptc-runtime.md` 的 `## Decision` / `### Resource limits`）

**进程模型**：每个程序跑在一个全新的 Node 进程里；宿主解析执行选择、经与 Bash **相同的 `ctx.sandbox` 提供者**约束启动、把进程生命周期交给 `ctx.subprocess`。子进程使用空模型环境 + 宿主提供的异步绑定；提供者内部**不再保留 worker 或持久内核**。

**时间**：默认 deadline 120 秒、默认上限 600 秒；受信服务消费者可请求 `timeoutMs: null` 关闭计时器（该能力由 `workflow-ptc` 使用）。deadline **包含运行时建立与嵌套工具/审批等待**，而清理可能让调用方等待超出该 deadline。V8 老生代内存、序列化外层输出与控制流量各有独立的配置上限。

**明确不声称的事**：堆上限**不含**原生分配与后代内存；elapsed time **不是**进程树 CPU 预算；`process` 描述符与额外控制管道**都不声称**多租户隔离。Python 后端保留既有执行实现与配置的墙钟 deadline，其 resolver 接受 cwd 但**拒绝显式文件策略或 per-call timeout 覆盖**——能力描述符从不静默授予不受支持的防护。拒绝或传输失败**从不自动重放**一个可能已产生副作用的程序。

#### 8.1.9 被推迟的设计（同 Note 的 `## Deferred timeout design`）

原文列出的开放问题：审批等待是否消耗程序预算；顺序执行的长工具如何组合；是否需要独立的总生命期兜底；哪些进程树 CPU/RSS 上限可以被一致地强制；持久内核还需要 Session 日志层面的保留状态表示。该节明确这些开放问题**不会静默地暂停或延长已发布的 elapsed 计时器**。

### 8.2 `ptc-runtime-node` 的构成与依赖

#### 8.2.1 源文件角色（`packages/ptc-runtime/ptc-runtime-node/README.md`）

| 文件 | 角色 |
|---|---|
| `src/index.ts` | 配置、解析、策略、绑定与受管执行（357 新增行） |
| `src/launch.ts` | 可执行文件/bootstrap 参数与执行世界资产映射 |
| `src/process.ts` | 子进程握手、环境清理与程序生命周期 |
| `src/bootstrap.ts`（R091）、`src/json-wire.ts`（R088，旧名 `worker-json.ts`）、`src/output-json.ts`（R094）、`src/protocol.ts`（R053） | 自 rc.2 重命名保留的四个部件：程序求值、JSON 线协议、输出 JSON、协议 |
| `src/channel.ts`、`src/output-ledger.ts` | 新增：分帧/有界写/协议失败，外层结果的宿主侧记账 |
| `src/bindings.ts`、`src/environment.ts`、`src/output-stream.ts`、`src/process-entry.ts` | 新增，无 rc.2 对应物 |

该 README 同时声明：**不发布运行时 invariant 伴随模块**——分帧与进程清理由跨进程边界强制，而不是通过独立同进程观察。

#### 8.2.2 依赖（`packages/ptc-runtime/ptc-runtime-node/package.json`）

- `peerDependencies`：`@deepseek-ai/cordis`、`dsh-ptc-runtime`、`dsh-session`、`dsh-timeout`、`dsh-fs`、`dsh-subprocess`、`dsh-sandbox`、`dsh-sandbox-policy`。
- `dependencies`：`@deepseek-ai/dsh-util-values`、`@deepseek-ai/schemastery`；`devDependencies` 额外含 `dsh-fs-local`、`dsh-subprocess-local`、`dsh-session-projection`、`dsh-sandbox-local`。
- `exports`：`.`（主入口）与 `./process`（程序侧入口）；`files` 含 `lib/process.js`。

**读法**：peer 列表里同时出现 `dsh-fs`、`dsh-subprocess`、`dsh-sandbox`、`dsh-sandbox-policy` 四个执行世界服务——这正是"执行缝从纯内嵌 worker 变成执行世界公民"的依赖面证据。

### 8.3 sandbox：异步可取消的准备 + 诊断模块

#### 8.3.1 `confine` 由同步改为异步

```diff
- abstract confine(argv: readonly string[], policy: SandboxPolicy): ConfinedArgv
+ abstract confine(argv: readonly string[], policy: SandboxPolicy, signal?: AbortSignal): Promise<ConfinedArgv>
```

**归因**：`git log -S` 确认由 `caa69608fb refactor(sandbox): await cancellable preparation in process consumers` 引入；同族的 `32de4412dc refactor(sandbox): await cancellable process preparation` 先处理提供者侧。

`docs/subsystems/sandbox.md` 的对应改写：

> "`await ctx.sandbox.confine(argv, policy, signal)` resolves policy paths and returns a `ConfinedArgv` from the execution world, or rejects with `SandboxUnavailableError` and code `SANDBOX_UNAVAILABLE` when no usable backend exists. The optional signal cancels resolution before launch."

#### 8.3.2 连带改动清单（逐文件核对）

| 文件 | 变化 | 变更行数 |
|---|---|---|
| `packages/sandbox/sandbox/src/index.ts` | `confine` 改 `Promise`；新增 `export { classifyRunnerFailure, isRunnerSpawnFailure, matchesSignature } from './diagnostics.ts'` | 5 |
| `packages/sandbox/sandbox-local/src/index.ts` | `confine` 声明为 `async`，入口 `signal?.throwIfAborted()`，内部对 `policy.workspaceRoot` 做 `canonicalPath`，返回 `Promise.resolve<ConfinedArgv>(...)` | 25 |
| `packages/sandbox/sandbox-policy/src/index.ts` | `resolveWorkspaceRoot` 不再 canonicalize，改为要求绝对执行世界拼写（否则抛 `sandbox-policy: workspace root must be an absolute execution-world path`） | 11 |
| `packages/sandbox/sandbox-windows-acl/src/index.ts` / `runner.ts` / `spawn.ts` | 适配异步与源码加载钉定 | 10 / 5 / 2 |
| `packages/shell/bash-sandbox/src/index.ts`、`pwsh-sandbox/src/index.ts` | 消费者适配（见第 03 篇 §8.3） | 31 / 31 |

**注意**：本版 `sandbox-policy` 的 `resolveWorkspaceRoot` 只做"必须绝对"的校验，不再做文件系统解析——这是"策略解析器保留执行世界拼写、实施约束的提供者在自己宿主上解析"这一分工的直接体现，也是 SSH 远程世界能复用同一策略解析器的前提。

#### 8.3.3 新增诊断模块 `packages/sandbox/sandbox/src/diagnostics.ts`

由 `75ed8da3e0 feat(code-runtime): execute Node programs through confined processes` 引入，把"运行器自身失败"的判定从提供者里抽成三个纯函数：

| 符号 | 作用 |
|---|---|
| `isRunnerSpawnFailure(error, runnerProgram, workdir)` | 只把 `EACCES`/`ENOENT` 且错误路径等于 `argv[0]`（并独立排除调用方 cwd 不可用）的 spawn 失败归因为可执行文件解析/权限问题；工作目录在分类时检查而非与 spawn 原子，源码注释说明并发路径替换"可能改变归因，但不会放行未受约束的执行" |
| `classifyRunnerFailure(exitCode, stderr, rules)` | 按后端提供的 `RunnerFailureRule[]` 判定非零退出是否匹配致命签名；先剔除 informational 行，并忽略空白签名 |
| `matchesSignature(exitCode, stderr, signatures)` | 非零退出 + 大小写不敏感 stderr 签名匹配 |

同一提交让 `sandbox-local` 的 Windows ACL 拒绝签名**追加** `'operation not permitted'`（原为 `'access is denied'`、`'access to the path'`、`'permission denied'`），以识别 Node `EPERM` 形式的拒绝（后续由 `b35a3b29eb` 再加固）。

### 8.4 fs：路径拼写与物理穿越

相关提交：`4c7b6902e3 fix(fs): share native path rooting between resolve and lstat`、`573f525c33 fix(fs): preserve native Windows drive-relative path resolution`、`58b67dcb5a fix(fs): preserve physical traversal in directory entry paths`、`0a7a69ec54 test(fs): exercise byte reads with a live cancellation signal`。

实现要点（`packages/fs/fs-local/src/fsio.ts`，31 行变动）：

- 新增导出 `localDisplayPath(cwd, path)`：POSIX 上含 `..` 段时保留物理拼写，否则 `resolve(cwd, path)`；`win32` 统一 `resolve(cwd, path)`（源码注释：Windows 在文件系统查找前会归一化父目录段）。
- `realpath` 从 `node:fs/promises` 版本改用 `promisify(realpathCallback.native)`。
- `resolveLocalTarget` 在向上寻找最近存在的祖先时新增拒绝：缺失段包含 `..` 时抛出 `FS_NOT_FOUND`，文案 `cannot resolve "<displayPath>": parent traversal crosses a missing directory`，并带 `/* v8 ignore next -- POSIX rejects this traversal; ... */`。
- `resolveListedChildTarget` 与 `listDirectory` 的错误路径改用 `localDisplayPath` 而非 `join`。

**`packages/fs` 的 `--diff-filter=A/D` 均为空**——本版没有一个文件被新增或删除，只有内容改写。这解释了为什么 `docs/subsystems/filesystem.md` 一行未改：缝的契约没有动。

### 8.5 工作流复用 PTC 沙箱：`workflow-worker-thread` → `workflow-ptc`

**提交**：`35af8698c2 fix(workflow): execute orchestration in the sandboxed PTC runtime`、`34f80b8e6e fix(workflow): close lifecycle and CI integration gaps`。

**包替换的机械证据**：`git diff --name-status`（默认启用重命名检测）对 `packages/workflow` 的结果是 **`workflow-worker-thread` 的 13 个文件全部 `D`、`workflow-ptc` 的 15 个文件全部 `A`，没有任何 `R`**——两个包在文本上**不相似**，是重写而非搬迁。

- 删除的源文件：`src/host.ts`、`src/protocol.ts`、`src/session.ts`、`src/worker.ts`；删除的测试：`tests/built-worker.e2e.ts`、`tests/egress.spec.ts`、`tests/session.spec.ts`、`tests/source-worker.compat.spec.ts`。
- 新增的源文件：`src/host.ts`、`src/guest.ts`、`src/guest-source.ts`、`src/guest-types.ts`；新增的测试：`tests/built-runtime.e2e.ts`、`tests/egress.spec.ts`、`tests/guest.spec.ts`、`tests/host.spec.ts`、`tests/source-runtime.compat.spec.ts`、`tests/setup.ts`。
- 两侧都有 README 两份与 `tsdown.config.ts`。

包名为 `@deepseek-ai/dsh-workflow-ptc`，版本 `0.1.6-alpha.1`，描述 "Workflow orchestration in the shared sandboxed Node PTC runtime"。

**决策要点**（引自 `2026-09-13-workflow-ptc-sandbox-reuse.md`）：

- **进程模型**：每次运行把既有 VM 与 workflow helpers 放在**一个 PTC 进程**里；宿主绑定把 guest 连到配置的 subagent 提供者与 workflow 观察者。
- **边界声明**：VM 定义 helper API 与协作式并发、总 agent 上限与 item 上限；**它不是安全边界，那些计数器不是宿主强制的安全配额**。文件强制、V8 堆上限、输出与控制上限、受管进程清理仍归 PTC 及其 sandbox/subprocess 提供者。
- **时间预算**：传 `timeoutMs: null` 显式禁用 elapsed 计时器；初版 VM 切片保留自己的同步超时；调用方 abort 信号（含外层工具 deadline）仍取消工作流。
- **取消**：立即中止 PTC 进程与子 agent 共享的信号；适配器等待挂起启动与子进程清理（含取消后才发布的子进程）；**没有额外的 workflow 清理计时器或 guest 取消确认**。
- **进度与收尾**：一次一个绑定调用，首批同步启动、后续事件按序排队并在子进程清理与最终结果之前排空（防止普通日志突发耗尽 PTC 的 pending-call 上限）；Node bootstrap 在发送终止帧之后**保持控制管道打开**直到宿主关闭它——未 await 的绑定回复可能仍在途，子侧提前关闭会让 `EPIPE` 与已完成的程序竞争。

`docs/subsystems/workflow.md` 的措辞因此从 "The Service Provider is [dsh-workflow-worker-thread] (a `node:worker_threads` engine — one worker per run, the script's vm context inside it)" 改为 "[dsh-workflow-ptc] executes the VM and helpers through the shared Node PTC process runtime under the calling Session's file policy"；`WorkflowRun` 一节从"引擎在有限宽限内强制结算并终止 worker"改为"PTC 引擎没有总体 elapsed deadline，取消时立即中止受管进程；disposal 按其提供者契约等待进程与子进程清理，没有独立的工作流清理 deadline"。

`packages/workflow/README.md` 的 Summary 同步改写，并把配置目录链接从 `#deepseek-aidsh-workflow-worker-thread` 改为 `#deepseek-aidsh-workflow-ptc`。

### 8.6 E2B 移除对本组的影响

**提交**：`c49db8bc8c refactor(e2b): retire remote execution providers`。

| 检查项 | 结论 |
|---|---|
| `packages/e2b/*` | `e2b`、`fs-e2b`、`subprocess-e2b` 三个包整体不存在于 0.1.6 |
| `docs/subsystems/filesystem.md` | **未改动**——远程后端替换不需要改缝契约 |
| `packages/fs/README.md` | 删除 `fs-e2b` 一行；"portable execution world" 链接说明从 "why the E2B backend shares the remote execution world" 改为 "why filesystem and subprocess providers share one execution world" |
| `docs/capability-seams.md` | `ctx.fs` / `ctx.subprocess` 的实现列删去 e2b 项并加入 ssh 项；`ctx.e2b` 整行移除 |
| PTC 侧 | 该 Note 明确 E2B 退役**不改变 PTC 执行**，也不改变共享的文件、子进程与终端接口；"Direct Node confinement and validation of program-authored control traffic require their own implementation and evidence" |

**重新引入的条件**（同 Note 的 `## Reintroduction conditions`）：远端提供者需要具体执行用例，以及共享文件/进程坐标、策略强制、有界传输保留、独立控制进度、精确通道关闭与受管取消的证据；源与构建后的组合必须演练这些行为；**连接丢失不能成为重放可能已执行程序或宣称未观察到的清理成功的理由**。

**未核实**：本次未逐字节确认仓库全部文件中不存在任何 e2b 字符串残留；该 Note 的 Verification 节声称移除清单未发现存活的 E2B 包、workflow、import、依赖或目录项。

### 8.7 原生与 Windows ACL 路径的钉定

| commit | 标题 | 说明 |
|---|---|---|
| `5bebc7c504` | `fix(sandbox): resolve source preload independently of command cwd` | Windows ACL runner 的源码入口不再依赖命令 cwd |
| `b35a3b29eb` | `fix(sandbox): pin ACL source resolution and recognize Node denials` | 追加 `operation not permitted` 拒绝签名，并钉定源码解析 |
| `b905d399df` | `Fix offline reference checks and preserve native pack inputs` | `native/system/scripts/pack-release.mjs` |
| `6b651380a7` | `feat: enforce maintained repository reference policy` | 影响范围含 `native/` |

`sandbox-local` 的 `windowsAclRunnerArgv` 在本版把开发态加载从 `[node, '--import', 'tsx/esm', sourceEntry]` 改为通过 `import.meta.resolve('tsx/esm/api')` 动态注册并显式传入 `tsconfig.base.json`：

```ts
const sourceConfig = fileURLToPath(new URL('../../../../tsconfig.base.json', import.meta.url))
const registration = `import { register } from ${JSON.stringify(import.meta.resolve('tsx/esm/api'))}; register({ tsconfig: ${JSON.stringify(sourceConfig)} });`
return [process.execPath, '--import', `data:text/javascript,${encodeURIComponent(registration)}`, sourceEntry]
```

源码注释解释：把 source loader 与 TypeScript 路径钉到本安装，**独立于目标 cwd 或环境覆盖**。

`native/` 侧的本版新增文件只有 `native/system/test/release-packing.test.js`（151 行）；`--diff-filter=D` 为空。

### 8.8 模型面 schema 变化：`run_code`

`docs/tool-catalog.md` 的 `run_code` 条目在本版由 2 个属性扩到 5 个：

| 属性 | rc.2 | 0.1.6 |
|---|---|---|
| `code`（string，必填） | ✅ | ✅ |
| `description`（string，必填） | ✅ | ✅ |
| `timeoutMs`（number） | — | ✅ "Positive elapsed-time budget in milliseconds, capped by the deployment maximum." |
| `sandbox_permissions`（enum `workspace-write` \| `danger-full-access`） | — | ✅ "Wider sandbox mode for this complete program execution; requires justification and approval." |
| `justification`（string） | — | ✅ "Reason this complete program needs wider access, shown to the user for approval." |

`required` 仍为 `["code", "description"]`。对应的提交是 `a248cc4e64 feat(ptc): expose per-program timeout and sandbox approval controls` 与 `2a08bf6ab9 feat(ptc): present provider execution guidance in logged program schema`。

依赖列同样改名：`ctx.codeRuntime (execution time)` → `ctx.ptcRuntime (execution time)`。

### 8.9 其它修正

`packages/subprocess` 本版另有五条结算类修正：`aaa02a3970`（Linux scope 无进程却仍 active 时的结算）、`c07df5aa65`（组投递后再确认直接 PID 的 SIGKILL）、`71334b9c78`（信号失败不吞掉直接进程结果）、`b79a227cec`（bootstrap 消费请求前的取消）、`4c024cf252`（早期取消与流标记采样）。`packages/sandbox/sandbox-policy/src/invariant.ts` 新增一行 `// oxlint-disable-next-line typescript/no-deprecated -- Existing Session history read; migration deferred.`，把既有的 `session.snapshotEvents()` 读取显式标注为待迁移（对应 `37abcb74c5` / `8f986c8da6` 两条 chore 提交）；`fa7d5519f5 feat(desktop): run runtime host from asar` 也触及 `packages/fs`。

`packages/subprocess/subprocess-local/src/linux-scope.ts` 的 186 行变动与对应决策记录见第 03 篇 §8.7；其结算规则的核心是：成功的进程组 `SIGKILL` 只证明"至少投递给一个成员"，直接 PID 仍需自己的信号确认或不存在证明。

### 8.10 新增/删除文件总览

`packages/fs`、`sandbox-local`、`sandbox-policy`、`subprocess` 在本版**没有任何文件新增或删除**（`--diff-filter=A/D` 均为空）——改动全部发生在既有文件内部，与"缝契约不变、只换实现"的定位一致。

新增 45 个文件集中在四处：`packages/ptc-runtime/**`（组 README 2 个 + `ptc-runtime` 组 README 2 个 + `ptc-runtime-node` 的 9 个源文件、10 个测试、`tsdown.config.ts`/`package.json`/2 个 README）、`packages/sandbox/sandbox/src/diagnostics.ts` 与 `tests/diagnostics.spec.ts`、`packages/sandbox/sandbox-windows-acl/tests/control.spec.ts`、`packages/workflow/workflow-ptc/**`（4 个源文件、6 个测试、`tsdown.config.ts`、2 个 README）与 `native/system/test/release-packing.test.js`。

删除 24 个文件：`packages/code-runtime/**` 13 个（见 8.1.1）+ `packages/workflow/workflow-worker-thread/**` 11 个（见 8.5）。

---

*文档生成时间: 2026-09-17*
*数据源: dsh-v0.1.6-alpha.1 (0a15e36e7f) vs dsh-v0.1.5-rc.2 (fb2c4b9e69)*
