# 【第 07 篇】多智能体：subagent / workflow / jobs——把任务分出去（0.1.6-alpha.1）

## 引言

| 项 | 值 |
|---|---|
| 本文版本 / 对照版本 | **dsh-v0.1.6-alpha.1**（`0a15e36e7f`，tag 日期 2026-09-15） vs **dsh-v0.1.5-rc.2**（`fb2c4b9e69`） |
| 包范围 | `packages/{subagent, workflow, jobs, webhook}/`、`packages/experimental/{agent-team, agent-team-profile, agent-team-web-profile, tool-agent-team, client-ui-agent-team}/` |
| 官方子系统文档 | `docs/subsystems/{subagent, workflow, jobs, webhook}.md`（四篇均在本版被改写） |

三个能力组各回答一个问题：**subagent**（把任务委托给子代理）、**workflow**（让模型写脚本来批量编排子代理）、**jobs**（通用后台任务运行时，前两者的后台机制共用）。AgentTeams 是实验性的多成员团队协作层，复用同一套委托与消息机制。本版最重要的两件事都不在类型层面，而在**执行底座**与**默认组合**：workflow 引擎从 worker 线程换成 PTC 沙箱进程；`ralph` 工具在所有默认组合中被关闭。见第 6 节。

---

## 概述

第 02 篇的循环驱动**一个** Agent。真实任务常常需要"把活分出去"，于是有四个场景：

1. **并行调研**——开几个子代理各查一块，主代理汇总；
2. **后台运行**——长任务在后台跑，完成后通知，父代理不轮询；
3. **编排脚本**——主代理写一段 JS，脚本启动一批子代理、收集结果、合并返回；
4. **职责链治理**——子代理不能靠"父代理把权限悄悄放大"来工作；继承的权限必须显式、可回放。

八条需求贯穿本篇：

| 编号 | 需求 | 关键实现落点 |
|---|---|---|
| R1 / R2 | 委托可插拔（按名注册多个提供者）+ 能力显式声明（超出即 `UNSUPPORTED_CAPABILITY`，绝不接受后忽略） | `SubagentCapabilities` |
| R3 | 可继续会话：`send_message` / `interrupt_agent` / `list_agents`；"可继续"= `prepareContinuable` 方法存在 | `continuation.ts` |
| R4 | 模型可写编排：脚本经引擎运行，`meta`/`args` 是纯 JSON 且先校验后求值 | `workflow/src/runtime-types.ts` |
| R5 / R6 | 后台统一管控（`ctx.jobs` + `job_*` 三工具）+ 子代理目录（`subagent/catalog` 投影枚举） | `JobKindMap`；`catalog.ts`、`list-children.ts` |
| R7 | **权限沿委托链显式继承**（本版强化）：在首个 await 前捕获，作为事件写入子会话日志 | `child-agent.ts` |
| R8 | **编排脚本受宿主安全策略约束**（本版强化）：OS 文件约束 + 托管进程清理由既有沙箱执行器负责 | `workflow-ptc/src/index.ts` |

**非功能底线**：血缘贯通（N1）、有界扇出（N2，`maxTotalAgents` 脚本不可观察不可改写）、结算经 `agent.inject` 通知（N3）、父子会话独立落盘（N4）、能力不符启动前拒绝（N5）、权限身份持久化（N6，本版新增）、引擎可替换而脚本语义不变（N7，本版新增）。

**边界**：subagent 与 workflow 都是可选能力，不在 agent-loop spine 内；workflow 不自建进程启动器（复用 PTC）；定时跟进属于 `schedule` 组；同会话目标属于 `goal`（第 08 篇）；webhook 不排队、不重试、不去重。

---

## 核心概念

**能力缝（capability seam）**由 **Service Definition / Service Provider / Consumer** 三个角色组成，且必须完整。本篇三条缝：subagent（`ctx.subagents`，按名注册**多个**提供者）、workflow（`ctx.workflowEngine`，**单实现**——第二个引擎替换第一个）、jobs（`ctx.jobs`，抽象类）。这与 bash 缝的关键差别在于：bash 一个上下文只允许一个执行器，而 subagent 的多提供者必须并存，因为委托对象的选择是部署形态问题。各角色对应关系见下一节的包结构表。

**其他核心术语**：

- **one-shot / continuable**：一次性子代理跑完结算；可继续子代理保留会话，父代理可追问、打断、枚举。
- **运行时**：本版把编排脚本的执行底座从 `node:worker_threads`（每 run 一个 worker，VM 在 worker 内）换成 **PTC 的 Node 进程**（`PtcRuntime`）。VM 与 helpers 仍存在，但进程级文件策略由 PTC 拥有。
- **有界扇出**：`maxConcurrentAgents` / `maxTotalAgents` / `maxItemsPerCall` / `syncTimeoutMs` 是 VM 的**协作式**上限，官方明确说明"它不是安全边界，这些计数器也不是宿主强制的安全配额"。
- **权限身份**：`auto` / `danger-full-access` 沿委托链继承；`Read Only` 与 `Workspace Write` 只继承沙箱覆盖 + `approval: never`。
- **AgentTeams**：实验性多成员协作层，成员上限、邮箱、任务板由 `TeamService` 拥有；本版起 Team profile 关闭直接 subagent 工具。

---

## 包结构

| 包 | 路径 | 职责 |
|---|---|---|
| 委托缝定义 | `packages/subagent/subagent` | `ctx.subagents`、能力描述符、continuable 编排、目录事件与投影 |
| 提供者实现 | `subagent-{spawn-in-process, in-process-driver, fork-in-process, acp, codex, claude-code, dsh-sdk}` | 新建子会话、fork 延续、经协议或子进程驱动外部 agent |
| 模型工具 | `subagent/tool-subagent`、`subagent/tool-subagent-control` | `subagent` 工具；`send_message` / `interrupt_agent` 全局控制 |
| 编排缝定义 / 引擎 / 消费者 | `packages/workflow/{workflow, workflow-ptc, tool-workflow, tool-ralph}` | `ctx.workflowEngine` 与事件词汇；**本版新增** VM+helpers 跑在 PTC 进程内；编排工具与 fixed-script 迭代 |
| 后台运行时 | `packages/jobs/{jobs, jobs-local, tool-jobs}` | `ctx.jobs`、`job_kill` / `job_list` / `job_output` |
| webhook 入口 | `packages/webhook/{webhook, webhook-github}` | 认证投递 → 普通会话 |
| 团队协作（实验） | `packages/experimental/agent-team*`、`tool-agent-team`、`client-ui-agent-team` | 团队名册、邮箱、任务板与模型工具 |

**本版删除**：`packages/workflow/workflow-worker-thread/`（README×2、`src/{host,protocol,session,worker}.ts`、4 个测试、`tsdown.config.ts`）。

---

## 关键类型

```typescript
// ── 委托侧 ──────────────────────────────────────────────────
interface SubagentCapabilities {          // 静态能力描述符，与请求选项一一对应
  readonly agentOptions: boolean; readonly outputSchema: boolean; readonly depthLimit: boolean
  readonly toolFilter: boolean; readonly persona: boolean
}

interface SubagentStartRequest {
  readonly prompt: ContentBlock[]; readonly parent: Agent; readonly signal: AbortSignal
  readonly agentOptions?: AgentOptions; readonly outputSchema?: ObjectJsonSchema
  readonly maxDepth?: number; readonly toolFilter?: ToolRestriction; readonly persona?: string
}

/** 委托边界上播种到子会话日志的策略。 */
interface DelegatedPolicyOverrides {
  /** 本版新增：父会话当前处于 Auto 或 Full access 时的共享 bundle 预设身份。 */
  readonly permissionPreset: 'auto' | 'danger-full-access' | undefined
  readonly sandboxMode: SandboxMode | undefined
  readonly approvalPolicy: ApprovalPolicy | undefined
}

// ── 编排侧 ──────────────────────────────────────────────────
interface WorkflowStartRequest {
  script: string; meta: WorkflowMeta; args?: unknown
  subagentProvider?: string; maxTotalAgents?: number; parent: Agent; signal?: AbortSignal
}

interface WorkflowRun {
  readonly result: Promise<WorkflowResult>   // 永不 reject；失败以 stopReason 表达
  cancel(reason?: string): void
  dispose(): Promise<void>                   // 取消 + await 脚本与子节点清理
}

/** workflow-ptc 的 VM 协作式上限（非安全边界）。 */
interface WorkerLimits {
  maxConcurrentAgents: number; maxTotalAgents: number    // 已解析并发上限；单 run agent() 总数
  maxItemsPerCall: number; syncTimeoutMs: number         // 单次 parallel/pipeline 条目数；初始同步切片
}

// ── 后台侧 ──────────────────────────────────────────────────
type JobKind = 'bash' | 'subagent'          // JobKindMap 声明的两种 kind
abstract class JobRegistry extends Service {  // start / list / read / kill / wait / onJobDone / attachController
  abstract kill(id: JobId, caller?: Agent, reason?: string): 'requested' | 'already-finished'
}
```

---

## 数据流

**委托流（含本版新增的权限捕获点）**：模型调用 `subagent` 工具 → `tool-subagent` **在首个 await 之前**捕获 `DelegatedPolicyOverrides` → `ctx.subagents.start()` → 进程内提供者创建子 Agent（`parent` 必填，depth = 父 + 1）→ 依次向子会话日志追加 `sandbox/mode`、`approval/policy`、**`permission/preset`（本版新增，仅 Auto/Full access）** 与 `subagent/catalog` → 返回 `started subagent <id>`；子代理结算时以 `user/message` 注入父 inbox（只含非空文本块，本版收敛）。

**编排流（本版换底座）**：

1. `tool-workflow` 把脚本、`meta`、`args`、`parent` 交给 `ctx.workflowEngine.start()`；
2. `PtcWorkflowEngine` **同步**校验：`validateMeta` → `assertBodyParses`（拒绝 `export const meta` 与不可解析体）→ 解析 provider 路由 → 解析 `maxTotalAgents`（per-run 覆盖必须 ≤ 引擎上限）；随后构造 `WorkerInit`，并解析调用会话的**常驻文件策略与 cwd**；
3. run 在一个 PTC Node 进程内创建 VM 与 helpers；guest 经 `WorkflowGuestHost` 五个 JSON 绑定回调宿主；`agent()` → `startChild` → `ctx.subagents` 派生子代理，结果经 `childResult` 回传；
4. 进度每次只走一个绑定调用：首批同步发出，后续按序排队并在子销毁与最终结果前**排空**；
5. 取消时立即中止 PTC 进程与共享 signal，适配器 await 待定 start 与子销毁；`workflow/end` 在结果结算时恰好发一次。

**后台流**：后台 bash 与后台子代理各自申请 job → `ctx.jobs.start(spec)` → 父代理继续工作 → 完成时以 `user/message` 注入父 inbox（N3）→ 模型用 `job_output` / `job_list` / `job_kill` 管控。

---

## 测试覆盖

| 层 | 主要证据 |
|---|---|
| 单元 | `packages/subagent/subagent/tests/{continuation-messages.spec.ts, continuation-messages-adapter.spec.ts, continuation-inheritance.spec.ts, list-children.spec.ts}`；`packages/workflow/workflow-ptc/tests/{workflow-ptc.spec.ts, guest.spec.ts, host.spec.ts, meta.spec.ts, realm.spec.ts, integration.spec.ts}` |
| 边界 / 兼容 / 构建产物 | `workflow-ptc/tests/{source-runtime.compat.spec.ts, egress.spec.ts, setup.ts, built-runtime.e2e.ts}` |
| 组合门禁 | `packages/preset/agent-presets/tests/shipped-root.spec.ts`（钉住每个含 `tool-ralph` 的 preset 都禁用、`ptc` 禁用 `workflow-ptc`） |
| e2e / 录制会话 | `apps/cli/tests/web-agent-presets.e2e.ts`、`apps/web/tests/shipped-composition.e2e.ts`、`snapshots/session/{ralph-loop, workflow-confinement, ptc-python-turn}`、`snapshots/sdk/{subagent-continuable, subagent-mixed, serial-created}` |

录制语料整体以 `DSH_SNAPSHOT=refresh pnpm run test:snapshot` 刷新；`snapshots/session/ralph-loop` 用**自有 composition** 重新打开 `tool-ralph`，保住唯一一条该工具的录制证据。

---

## 与上游 / 下游的关系

- **上游**：subagent 消费 `ctx.sessions` / `ctx.sessionPersistence` / `ctx.sessionProjections` / `ctx.agentPresets`，**本版新增**消费 `ctx.permissionPresets`、`ctx.sandboxPolicy`、`ctx.approval`；`workflow-ptc` 消费 `ctx.ptcRuntime`、`ctx.sandboxPolicy`、`ctx.subagents`，并要求 `ctx.ptcRuntime.language === 'typescript'`；外部产品提供者经 `ctx.subprocess` 启动子进程。
- **下游**：`tool-workflow` / `tool-ralph` / `tool-subagent` 注册进 `ctx.tools`（第 02 篇守卫管线）；`tool-subagent-control` 提供全局控制工具。
- **平级**：`packages/jobs` 被 shell（后台 bash）与 subagent 共用；`packages/webhook` 是"外部事件 → 会话"的入口，不经过委托通道；`packages/experimental/auto-review`（第 08 篇）通过既有的委托权限捕获把 `auto` 身份传给子会话。

---

## 6 本版本变更要点（rc.2 → 0.1.6-alpha.1）

> 本节占全文过半篇幅，是本文重点。所有结论都指向具体文件或 commit 哈希；无法核实的标注「未核实」。

### 6.1 主题总览

| # | 主题 | 判据 |
|---|---|---|
| T1 | **workflow 引擎换底座**：worker 线程 → PTC 沙箱进程 | `workflow-worker-thread` 目录删除、`workflow-ptc` 新增；`35af8698c2` |
| T2 | **`ralph` 在默认组合中关闭**（影响所有用户） | `73985344cd` + Agent Note `2026-09-12-ralph-off-in-shipped-defaults.md` |
| T3 | 子代理权限身份沿委托链显式继承 | `child-agent.ts` 的 `permissionPreset`；`c7fbe079f0` |
| T4 | 子代理创建语义变为 awaited | `9b7a8ccc9f`、`aeb13413c7` + Note `2026-09-09-awaited-agent-creation.md` |
| T5 | 子代理结算通知只保留纯文本 | `29debb8b24` |
| T6 | jobs 符号全面对齐为 Job 词汇（无行为变化） | `6c3c3064c3` |
| T7 | AgentTeams 系列修复（成员上限、身份提醒、工具裁剪） | `bfa6cc01aa`、`41196ae591`、`4491da1374`、`b76fe343fe`、`291b890a1a` |
| T8 | webhook 仅措辞变化，无功能变更 | `packages/webhook/webhook/src/*` 三文件各 1 行 |

### 6.2 T1：workflow 引擎换底座（worker 线程 → PTC 沙箱）

**问题**（引自 `.agents/notes/implemented/architecture/2026-09-13-workflow-ptc-sandbox-reuse.md` 的 `## Problem`）：worker 线程把脚本执行移出宿主事件循环，但逃出 VM 的代码可以使用宿主进程的**文件权限**运行 Node。PTC 已经拥有一个带 OS 文件约束、隔离程序状态、有界输出与控制流量、托管清理的 Node 进程实现；再维护第二个启动器就是重复这些职责。

**决策**（同 Note 的 `## Decision` 要点）：

- `dsh-workflow-ptc` 通过共享的 Node `PtcRuntime` 实现 `WorkflowEngine`；每个 run 的 VM 与 workflow helpers 保持在**一个 PTC 进程**内；
- 宿主绑定把 guest 连到配置的 subagent provider 与 workflow 观察者；宿主提供调用 Agent，并解析其 Session 的**常驻文件策略与 cwd**；
- VM 定义 helper API、协作式并发、总 agent 上限与条目上限——**它不是安全边界**；
- 工作流执行传 `timeoutMs: null`，显式关闭 Node 运行时的 elapsed timer（一次工作流可能 await 一长串子代理）；省略或传数值的 PTC 请求保留配置默认值与上限，`run_code` 继续只接受正数覆盖；调用方 abort signal（含外层工具 deadline）仍然取消工作流；
- 取消立即中止 PTC 进程与待定/活动子代理共享的 signal；适配器 await 待定 start 与子销毁，**含在取消之后才发布的子节点**；不新增工作流清理定时器，也不做 guest 取消确认；
- 被否决的备选：保留 worker 线程执行、为 workflow 另建子进程运行时、用直接 Node API 取代 VM、把 PTC 的数值 deadline 施加到工作流上（各条的代价见 Note 的 `## Alternatives considered`）。

**文件级证据**：

| 变化 | 路径 |
|---|---|
| 删除 | `packages/workflow/workflow-worker-thread/`（`src/host.ts` −625、`src/protocol.ts` −101、`src/session.ts` −201、`src/worker.ts`、README×2、4 个测试、`tsdown.config.ts`） |
| 新增 | `packages/workflow/workflow-ptc/src/{index,host,guest,guest-types,guest-source,meta,realm,runtime,types}.ts`；README.md / README.zh.md 各 170 行 |
| 新增测试 | `tests/{guest.spec.ts, host.spec.ts, egress.spec.ts, built-runtime.e2e.ts, setup.ts, source-runtime.compat.spec.ts}` |
| 重命名 | `workflow-worker-thread/tests/workflow-worker-thread.spec.ts` → `workflow-ptc/tests/workflow-ptc.spec.ts`（相似度 57%，差异化行数 750） |

**引擎配置与校验**（`packages/workflow/workflow-ptc/src/index.ts`）：

| 字段 | 默认值 | 说明 |
|---|---|---|
| `provider` | `'spawn'` | 子代理提供者名；解析失败抛 `WorkflowError('AGENT_START')` |
| `maxConcurrentAgents` | `0` → 自动 `min(16, max(1, availableParallelism() - 2))` | 并发 `agent()` 上限 |
| `maxTotalAgents` | `1000` | 单 run 总子代理数；per-run 覆盖超过上限即 `INVALID_ARGUMENT` |
| `maxItemsPerCall` | `4096` | 单次 `parallel()` / `pipeline()` 接受的条目数 |
| `syncTimeoutMs` | `5000` | 脚本初始同步切片的 VM 超时 |

`static inject = ['subagents', 'ptcRuntime', 'sandboxPolicy']`；构造函数要求 `ctx.ptcRuntime.language === 'typescript'`，否则抛错。

**guest 与宿主之间的五个 JSON 绑定**（`packages/workflow/workflow-ptc/src/guest-types.ts`，`WorkflowGuestHost`）：

| 绑定 | 方向 | 职责 |
|---|---|---|
| `begin(input)` | guest → host | 读取已校验的脚本与输入（`WorkerInit`） |
| `startChild(request)` | guest → host | 经配置的 subagent provider 发布子代理，返回宿主分配的 `{ callId, childId }` |
| `childResult(request)` | guest → host | 观察已发布子节点的终态；基础设施故障才 reject |
| `disposeChild(request)` | guest → host | 汇合单个已发布子节点的销毁 |
| `progress(events)` | guest → host | 按序发布一批进度（phase / log / agent-start / agent-end） |

**进程引导的关闭顺序**：Node 引导在发出终止帧之后**保持控制管道打开**，直到宿主关闭它——未 await 的绑定回复可能仍在途中，子侧过早关闭会让一次 `EPIPE` 与已经完成的程序赛跑。

**取消与进度语义**：取消不等待协作式脚本进度（适配器只等子节点清理）；因此一个不履行自身生命周期契约的 subagent provider 会拖长销毁。PTC 停止程序后，其调用方仍负责已经在途的宿主绑定。子结果等待在取消时停止，而子销毁仍会被 await。

**语义不变的部分**（Note 的 `## Consequences`）：脚本仍用同一套 hooks 与结果信封；没有引入新的权威进度账本，也没有引入宿主侧子节点数量配额。`WorkflowStartRequest` / `WorkflowResult` / `WorkflowRun` 的**字段集合未变**——变的是文档措辞：`packages/workflow/workflow/src/types.ts` 把"grace force-settle, worker death"改为"cancellation or process failure"；`runtime-types.ts` 把 `dispose()` 的"bounded settlement"改为"script and child cleanup"；`workflow/src/index.ts` 的 `workflow/agent-end` JSDoc 与 `WorkflowEngine` 契约段落同步改写；`docs/subsystems/workflow.md` 把 Service Provider 描述从"`node:worker_threads` 引擎"改为"通过共享 Node PTC 进程运行时执行 VM 与 helpers"，并把 `WorkflowRun` 一节的"引擎有界 grace 内强制结算"改为"PTC 引擎没有整体 elapsed deadline，取消时立即中止托管进程"。

**相关提交**：

| commit | 标题 | 作用 |
|---|---|---|
| `35af8698c2` | `fix(workflow): execute orchestration in the sandboxed PTC runtime` | 主改造；158 文件，+2987/−3192 |
| `7e8d42d122` | `test(workflow): await host child starts before cancellation` | 消除取消路径竞态 |
| `aa4c46edeb` | `fix(boot): drop stale workflow worker dependency` | 从 `workflow-ptc/package.json` 去掉陈旧依赖 |
| `34f80b8e6e` | `fix(workflow): close lifecycle and CI integration gaps` | 生命周期与 CI 集成收口 |

**未核实**：`workflow-ptc` 在 0.1.6-alpha.1 中除 base 与三个 preset 之外是否还被其他默认组合挂载（base、`standard`、`cordis`、`ptc` 的 `name:` 均已核实在本版改名）。

### 6.3 T2：`ralph` 在默认组合中关闭

**判据**：commit `73985344cd feat(presets): disable ralph in the default compositions`；Agent Note `.agents/notes/implemented/simplification/2026-09-12-ralph-off-in-shipped-defaults.md`。

**问题**（Note `## Problem` 要点）：`ralph` 跑一个固定的前台 fresh-agent 循环，它**自己的模型可见描述**就把用途限制在"直系人类明确要求"的运行；其 README 记录完成是 worker 自述、无独立评估器，且循环没有后台收集、恢复检查点或调度器。而它此前在 `packages/bundle/base/cordis.patch.yml` 与四个随附 preset 中的**三个**里默认启用——默认会话因此携带一个"描述里叫模型别用它"的工具，默认 profile 的目录也宣告了 Harness 尚未背书的能力。

**决策**（Note `## Decision` 要点）：

| 位置 | 变更 |
|---|---|
| `packages/bundle/base/cordis.patch.yml` | `tool-ralph` 行 `disabled: true`，行内注释给出 overlay 恢复配方（`$DSH_HOME/cordis.patch.yml` 或 `--patch <file>`） |
| `packages/preset/agent-presets/presets/standard/agent.cordis.yml` | `tool-ralph` 行 `disabled: true` |
| `packages/preset/agent-presets/presets/cordis/agent.cordis.yml` | 同上 |
| `packages/preset/agent-presets/presets/ptc/agent.cordis.yml` | `tool-ralph` **与** `workflow-ptc` 两行都 `disabled: true` |
| `packages/preset/agent-presets/presets/minimal/` | 本来就没有该行 |
| `packages/bundle/web-app/cordis.patch.yml` | 重述该 disable |
| `snapshots/session/ralph-loop/` | 新增自有的 `ralph` composition，重新打开该行以保住证据 |

**为什么 Web 层要重述**：`scripts/verify-cordis-config.ts` 的 `validatePresetPlaneSeparation` 收集已声明的行 id 时**不考虑 `disabled`**，删掉那一行会让 `tool-ralph` 回到 Web 宿主平面并与每个 preset 的同名行冲突。

**为什么 `ptc` 要禁两行**：该 preset 在丢掉通用 `tool-workflow` 之后只为 `ralph` 保留引擎；禁用 `ralph` 会让引擎在该组合中没有消费者，而"保留一个没有消费者的提供者"被 `packages/AGENTS.md` 拒绝。

**恢复路径按平面不同**：base-backed profile 用 overlay 行取消 disable；preset 文件**不吃 patch**，需要把 preset 复制到一个**新 id** 下再删掉 `disabled`——复用随附 id 的副本会被随附 root 遮蔽（重复 id 由随附 root 获胜，`copy()` 也拒绝任何 root 已提供的 id）。在 `ptc` 里，副本必须同时删掉工具行与引擎行的 `disabled`，因为 `tool-ralph` 注入 `ctx.workflowEngine`。

**被否决的备选**（Note `## Alternatives considered`）：新增第五个随附 preset（preset 一经存在就对每个用户可见，无法表达"默认关闭"；且 preset 层没有 patch 语义）；删除该行而不是禁用（删除后的行对用户自有组合也不可达，因为 patch 只能翻转**已存在**行的 `disabled`）；只在 Web preset 里降级（会让 headless/sdk/acp/自定义 base-backed profile 继续随附一个默认 Web 面拒绝的工具）；把 goal 工具一起降级（goal 是受支持的长任务路径，`ralph` 的描述本身就把普通长任务指向它）；在 `ptc` 里保留引擎（会留下无消费者的提供者）；把 opt-in 配方写进 `docs/`（配方按平面不同、各三行，行注释即可就地呈现）。

**后果**（Note `## Consequences` 要点）：默认 Web / headless / sdk / acp / 自定义 base-backed 会话都不再提供 `ralph`，`standard` / `ptc` / `cordis` 三个 preset 同样；恢复需要编辑 composition，因此该能力是 **opt-in** 而非"仅仅被劝阻"。已经记录了 `ralph` 调用的既有会话仍可回放与渲染——包已安装、事件类型未变。

**验证**（Note `## Verification` 要点）：`packages/preset/agent-presets/tests/shipped-root.spec.ts` 钉住四条断言（每个携带 `tool-ralph` 的 preset 都禁用它；`minimal` 名单没有该行；`ptc` 禁用 `workflow-ptc`；`standard` 与 `cordis` 为自己的 `workflow` 工具保留引擎）。`apps/cli/tests/web-agent-presets.e2e.ts` 与 `apps/web/tests/shipped-composition.e2e.ts` 钉住确切的默认与 PTC 工具目录。`snapshots/sdk/**/tool-schemas.expected.json` 每个文件减少 20 行（部分 40 行）、`system-prompt.expected.md` 减少 2~14 行；`DSH_SNAPSHOT=refresh` 之外，6 个 sidecar 手工整理（4 个属 `pwsh-tool-turn` 家族、本机跳过；2 个属 `snapshots/web/schedule-catalog`，没有执行中的测试写读它们）。

**同族提交**：`d49192b6ac docs(presets): name the new id in the ralph restore recipe`、`c7d2e99b8e docs(presets): state the web-app disable in the present tense`。

### 6.4 T3：子代理权限身份沿委托链继承

| 维度 | rc.2 | 0.1.6-alpha.1 | 证据 |
|---|---|---|---|
| `DelegatedPolicyOverrides` | `sandboxMode` + `approvalPolicy` | 新增 `permissionPreset` | `packages/subagent/subagent/src/child-agent.ts` |
| 类型依赖 | type-only merge `sandboxPolicy` / `approval` | 追加 type-only `ctx.get('permissionPresets')` 与 `permission/preset` payload | 同文件顶部 |
| 子日志写入 | `sandbox/mode`、`approval/policy` | 追加 `childSession.append('permission/preset', { preset })` | 同文件 |
| 继承范围 | — | 仅 `auto` 与 `danger-full-access`；仅在 in-process DSH 路径，用于替换 fork 遗留的同 bundle 旧值 | JSDoc |

**语义**：捕获必须**同步**发生在子代理 start 的第一次 await **之前**——"父代理之后切换权限"属于父代理的未来，不属于这个子代理。审批策略无论父代理如何一律钉为 `'never'`。Read Only 与 Workspace Write 仍只继承沙箱覆盖 + `approval: never`，因此未匹配的 bundle 保持 `custom`。**Auto 子会话的每次调用独立复审**，使用既有的 `parentSession`、创建 prompt 与已认证的人类/直系父代理消息；不新增委托记录、回执、Header 字段、描述符字段或 Session 格式变更（`docs/subsystems/subagent.md` 新增的 "In-process backends: permission, depth, and seed" 小节）。

```typescript
// packages/subagent/subagent/src/child-agent.ts
export function captureDelegatedPolicyOverrides(parent: Agent): DelegatedPolicyOverrides {
  const preset = parent.ctx.get('permissionPresets')?.current(parent.session)
  return {
    permissionPreset: preset === 'auto' || preset === 'danger-full-access' ? preset : undefined,
    sandboxMode: parent.ctx.get('sandboxPolicy')?.overrideOf(parent.session),
    approvalPolicy: parent.ctx.get('approval') === undefined ? undefined : 'never',
  }
}
```

**父类编译面变化**：`packages/subagent/subagent/package.json` 本版新增 `@deepseek-ai/dsh-permission-presets` 依赖与 `tsconfig.json` 里的对应引用；`child-agent.ts` 顶部新增一条 type-only import，用于让 `ctx.get('permissionPresets')` 解析到服务并 merge `permission/preset` 事件 payload——**仍是文档化的 `ctx.get` 机会式消费，不是硬依赖**。

**新增测试证据**：`packages/subagent/subagent/tests/continuation-inheritance.spec.ts`（+73 行）与 `packages/subagent/subagent-in-process-driver/tests/inheritance.spec.ts`（+60 行）覆盖继承路径；`snapshots/sdk/subagent-fork-in-process/session.1.v2.jsonl` 与 `snapshots/sdk/subagent-mixed/session.2.v2.jsonl` 各增 1 行，记录新的事件。

**相关提交**：`c7fbe079f0 fix: align delegated preset snapshots`（同提交还改了 `packages/experimental/auto-review/package.json` 与若干 SDK 快照）。

### 6.5 T4：子代理创建语义变为 awaited

Agent Note `.agents/notes/implemented/architecture/2026-09-09-awaited-agent-creation.md`。

| 维度 | rc.2 | 0.1.6-alpha.1 |
|---|---|---|
| `AgentRegistry.announce` | `announce(agent): void` | `announce(agent, source: SessionStartSource, signal?: AbortSignal): Promise<void>` |
| `AgentRegistry.register` | `register(agent): () => void`，内部直接调用 announce | `register(agent): ReturnType<Context['effect']>`，内部 `await this.announce(agent, 'startup')` |
| `agent/created` | 创建通知 | **串行初始化事件**：每个 listener 完成后下一个才开始；抛错或 reject 会让创建失败并跳过后续 listener |

**判据**：`packages/core/agent/src/index.ts` 在两个 tag 上的签名差异；提交 `9b7a8ccc9f`、`aeb13413c7`；新快照 `snapshots/sdk/serial-created/`。

**对多智能体的直接影响**：`packages/subagent/tool-subagent/src/index.ts` 的 `installScoped` 从返回 `void` 改为返回 `ReturnType<Context['inject']> | undefined`，并在 `scopedInstalls.get(candidate)` 命中时把既有 fiber 返回——调用方现在可以 await 装配完成。goal / plan / AgentTeams 的多个测试同步改为 `await ctx.agents.register(agent)` 与 `await agents.announce(agent, 'startup')`。

**后果**（Note `## Consequences`）：创建延迟包含异步插件与 SessionStart 工作；初始化失败变成调用方可见的创建失败；取消依赖 listener 协作式收敛；已投递的通知无法撤回，回滚需与销毁通知配对。

### 6.6 T5：结算通知只保留纯文本

**commit**：`29debb8b24 fix(subagent): keep settlement notices text-only`（同族：`b86b89da94 docs(subagent): align settlement notice descriptions`、`1d26330415 test(subagent): reuse Messages fixtures and clarify notice contracts`）。

| 维度 | rc.2 | 0.1.6-alpha.1 |
|---|---|---|
| 通知内容 | `terminal.output` 全量 | `terminal.output` 中的**非空文本块** |
| 空输出 | `It left no closing message.` | 一个非空文本块都不剩时才是它 |
| 转换位置 | — | 本地转换，SDK/UI 消费者仍保留完整子输出 |
| 新增测试 | — | `tests/continuation-messages-adapter.spec.ts`（+129）、`tests/continuation-messages.spec.ts`（+57） |

原因（代码注释原文要点）：父代理提供者把这份通知当**用户消息**接收，可能拒绝非文本的 assistant 块。`docs/subsystems/subagent.md` 同步改写为 "carrying the nonempty text blocks from its final assistant output, or `It left no closing message.` when none remain"。

### 6.7 T6：jobs 符号对齐（无行为变化）

**commit**：`6c3c3064c3 refactor: align instruction and job helper symbols`（22 文件，337 插入 / 337 删除——纯重命名规模）。

| rc.2 名称 | 0.1.6 名称 | 文件 |
|---|---|---|
| `DEFAULT_MAX_CONCURRENT_TASKS_PER_OWNER` | `DEFAULT_MAX_CONCURRENT_JOBS_PER_OWNER` | `packages/jobs/jobs-local/src/index.ts` |
| `interface TrackedTask` | `interface TrackedJob` | 同上 |
| `activeTaskCount()` | `activeJobCount()` | 同上 |
| `PUBLIC_TASK_SCHEMA` | `PUBLIC_JOB_SCHEMA` | `packages/jobs/tool-jobs/src/index.ts` |
| `presentTaskCall()` | `presentJobCall()` | 同上 |
| `finalizeTaskContent` | `finalizeJobContent` | 同上 |

**不变**：`DEFAULT_MAX_CONCURRENT_JOBS_PER_OWNER = 10`；`packages/jobs/jobs/src/` 完全未改；工具描述、schema 字段与错误文案（`background job limit reached for this owner (limit: …)`）未改。同提交还触及 `packages/terminal/tool-terminal/src/index.ts`、`packages/shell/tool-{bash,pwsh}/tests/*`、`packages/subagent/tool-subagent/tests/*` 与 `scripts/gen-tool-catalog.ts`。`docs/subsystems/jobs.md` 标题由 `# Background Task Runtime` 改为 `# Background Job Runtime`。

### 6.8 T7：AgentTeams 系列修复（实验包）

| commit | 标题 | 实质变化 |
|---|---|---|
| `bfa6cc01aa` | `fix(agent-team): raise default teammate limit to 16` | `packages/experimental/agent-team/src/index.ts`：`DEFAULT_MAX_MEMBERS` 从 `8` 改为 `16` |
| `41196ae591` | `fix(agent-team): disable direct subagent tools in Team profiles` | Team profile 的 `cordis.patch.yml`（−13 行）改为关闭直接 subagent 工具；更新 profile 测试与 CLI headless e2e |
| `4491da1374` | `fix(agent-team): include identity only in the initial task` | 成员身份只出现在初始任务里 |
| `b76fe343fe` | `fix(agent-team): keep member identity in durable reminders` | 身份改为通过持久提醒保持 |
| `291b890a1a` | `fix(agent-team): append durable identity reminders after fork history` | 身份提醒追加在 fork 历史之后 |
| `5731647698` | `test(agent-team): follow the DeepSeek protocol module move` | 测试跟随协议模块迁移 |
| `d769e2d157` | `docs(agent-team): regenerate the message dependency graph` | 重新生成消息依赖图 |

**`tool-agent-team` 源码变化**（`packages/experimental/tool-agent-team/src/index.ts`）：`team:policy` 提示段从"每次渲染时拼接成员 role/name/id 的函数"改为静态 `POLICY` 文本（身份改由初始任务 + 持久提醒承载）；`team_create` 派生的子代理 prompt 前置一段 `<system-reminder>You are teammate "…".</system-reminder>`。

**订阅点变化**：`packages/experimental/agent-team/src/index.ts` 的恢复订阅从 `agent/session-start` 改为 `agent/created`（与 T4 的串行初始化语义对齐）。

**弃用豁免**：本版多处（`agent-team/src/mailbox.ts`、`roster.ts`、`goal-round-driver`、`user-approval`、`commands`、`plan-mode`、`workflow`、`subagent`）在既有同步历史读取前加了行内 `oxlint-disable-next-line typescript/no-deprecated -- Existing Session history read; migration deferred.`。这是**跨组的技术债登记**，不是行为变化（配套 `37abcb74c5`、`8f986c8da6`）。

### 6.9 T8：webhook 无功能变更

| 文件 | 变化 |
|---|---|
| `packages/webhook/webhook/src/brand.ts` | 注释："Session provenance" → "Session message sources" |
| `packages/webhook/webhook/src/session.ts` | `@param delivery` JSDoc："used for provenance" → "recorded in the message source" |
| `packages/webhook/webhook/src/types.ts` | `deliveryId` JSDoc："exposed as provenance" → "exposed in message sources" |

其余 webhook 变更全部是 README/i18n 重译与措辞对齐。`docs/subsystems/webhook.md` 的语义未变：仍是无队列、无重试、无去重、无执行状态、无崩溃重放；`WebhookRuleId` / `WebhookSourceId` / `WebhookDeliveryId` 仍是不透明字符串，投递 id 只是记录提供方标识。

### 6.10 破坏性与兼容性影响

| 变更 | 影响 | 说明 |
|---|---|---|
| 默认组合不再挂载 `tool-ralph` | ⚠️ 高（用户可见） | 所有默认 base-backed 会话与 `standard`/`ptc`/`cordis` preset；恢复需改 composition |
| `ptc` preset 不再挂载 `workflow-ptc` | ⚠️ 中 | 恢复 `ralph` 时必须同时恢复引擎 |
| `ctx.workflowEngine` 的 Provider 包名变更 | ⚠️ 中 | `dsh-workflow-worker-thread` → `dsh-workflow-ptc`；cordis 组合的 `name:` 必须同步改名 |
| `AgentRegistry.announce` 签名变更 | ⚠️ 中 | `announce(agent, source, signal?)` 返回 `Promise<void>`；`register()` 返回 effect disposer 且内部 await |
| `workflow-ptc` 要求 typescript 语言档的 PTC 运行时 | ⚠️ 中 | 缺 `ctx.ptcRuntime` 或语言档不符时在加载/构造期抛错 |
| 结算通知只含文本块 | ⚠️ 低 | 父代理看到的通知变窄；SDK/UI 消费者不受影响 |
| 委托新增 `permission/preset` 子会话事件 | ⚠️ 低 | 事件类型是既有类型；`SESSION_FORMAT_VERSION` 仍为 3 |
| jobs 符号重命名 | ⚠️ 低 | 被重命名的都是包内私有符号与局部常量 |
| AgentTeams 默认成员上限 8 → 16 | ⚠️ 低 | 实验包；只影响默认值 |

### 6.11 需求覆盖变化表

| 需求 | rc.2 | 0.1.6-alpha.1 |
|---|---|---|
| R1 委托可插拔 | ✅ | ✅ 保持 |
| R2 能力显式声明 | ✅ | ✅ 保持 |
| R3 可继续会话 | ✅ | ✅ 保持 + 结算通知收敛为文本 |
| R4 模型可写编排 | ✅（worker 线程） | ✅（PTC 沙箱进程，脚本语义不变） |
| R5 后台统一管控 | ✅ | ✅ 保持（符号对齐） |
| R6 子代理目录 | ✅ | ✅ 保持 |
| R7 权限显式继承 | — | 🆕 建立 |
| R8 编排受宿主安全策略约束 | 部分（仅 VM 隔离） | 🆕 OS 文件策略 + 托管进程清理 |
| N7 引擎可替换而语义不变 | — | 🆕 建立 |

### 6.12 本版新增 / 删除 / 改名文件清单（多智能体相关）

**删除**

| 路径 | 说明 |
|---|---|
| `packages/workflow/workflow-worker-thread/README.md`、`README.zh.md` | 各 −183 行 |
| `packages/workflow/workflow-worker-thread/src/host.ts` | −625 |
| `packages/workflow/workflow-worker-thread/src/protocol.ts` | −101 |
| `packages/workflow/workflow-worker-thread/src/session.ts` | −201 |
| `packages/workflow/workflow-worker-thread/src/worker.ts` | −14 |
| `packages/workflow/workflow-worker-thread/tests/{built-worker.e2e.ts, egress.spec.ts, session.spec.ts, source-worker.compat.spec.ts}` | −67 / −31 / −508 / −48 |
| `packages/workflow/workflow-worker-thread/tsdown.config.ts` | −29 |

**新增**

| 路径 | 规模 | 说明 |
|---|---|---|
| `packages/workflow/workflow-ptc/README.md`、`README.zh.md` | 各 170 行 | 引擎契约 |
| `packages/workflow/workflow-ptc/src/host.ts` | +306 | 宿主绑定、子代理生命周期、取消与排空 |
| `packages/workflow/workflow-ptc/src/guest.ts`、`guest-types.ts`、`guest-source.ts` | +75 / +59 / +4 | VM helpers、JSON 回调词汇、guest 源码装配 |
| `packages/workflow/workflow-ptc/tests/{guest.spec.ts, host.spec.ts, setup.ts, egress.spec.ts, built-runtime.e2e.ts, source-runtime.compat.spec.ts}` | +353 / +179 / +52 / +42 / +81 / +61 | 单元 / 桩 / 出口约束 / 构建产物 / 源运行兼容 |
| `packages/workflow/workflow-ptc/tsconfig.json`、`tsdown.config.ts` | +9 / +12 | 编译面与打包面 |
| `packages/subagent/subagent/tests/continuation-messages-adapter.spec.ts` | +106 | 结算通知适配 |
| `snapshots/session/workflow-confinement/` | 新增场景 | 沙箱约束的录制证据 |

**改名（组合层）**

| 位置 | rc.2 | 0.1.6 |
|---|---|---|
| `packages/bundle/base/cordis.patch.yml`、三个 preset 的 `agent.cordis.yml`、`packages/bundle/web-app/cordis.patch.yml`、`presets/cordis/skills/editing-cordis-compositions/SKILL.md` | `- id: workflow-worker-thread` / `name: '@deepseek-ai/dsh-workflow-worker-thread'` | `- id: workflow-ptc` / `name: '@deepseek-ai/dsh-workflow-ptc'`（base 同层新增 `ptc-runtime` 行；web-app 只改 id） |

### 6.13 可复现的证据命令

```powershell
$r = 'E:\test\rewrite-agently\deepseek-harness'
# T1 引擎换底座 / T2 默认组合关闭 ralph
git -C $r diff --name-status dsh-v0.1.5-rc.2..dsh-v0.1.6-alpha.1 -- packages/workflow | Select-String 'workflow-ptc|worker-thread'
git -C $r show dsh-v0.1.6-alpha.1:packages/bundle/base/cordis.patch.yml | Select-String 'tool-ralph' -Context 0,4
# T3 权限继承 / T4 awaited 创建
git -C $r diff dsh-v0.1.5-rc.2..dsh-v0.1.6-alpha.1 -- packages/subagent/subagent/src/child-agent.ts
git -C $r show dsh-v0.1.6-alpha.1:packages/core/agent/src/index.ts | Select-String 'announce\(agent'
# T6 jobs 只做符号对齐 / T8 webhook 只有注释变化
git -C $r diff --stat dsh-v0.1.5-rc.2..dsh-v0.1.6-alpha.1 -- packages/jobs packages/webhook/webhook/src
```

---

*文档生成时间: 2026-09-17*
*数据源: dsh-v0.1.6-alpha.1 (0a15e36e7f) vs dsh-v0.1.5-rc.2 (fb2c4b9e69)*
