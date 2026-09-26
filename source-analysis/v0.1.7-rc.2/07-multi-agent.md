# 【第 07 篇】packages/subagent · workflow · schedule · experimental/agent-team*：多智能体

> **基线说明**：本篇为 v0.1.7-rc.1 全量分析基线，rc.2 未改动本篇覆盖的系统性结构。v0.1.7-rc.2 的增量变更（约 335 个提交）请见同目录 `README.md` 与 `diff-vs-0.1.7-rc.1.md`。

> **版本**：dsh-v0.1.7-rc.1（`46a7f68b09`，2026-09-23），对比上版 dsh-v0.1.6-alpha.1（`0a15e36e7f`，2026-09-15）
> 难度：🟡 进阶（§6.6 可续期激活容量一节为 🔴 高难）
> 包范围：`deepseek-harness/packages/subagent/`（10 包）、`packages/workflow/`（4 包）、`packages/schedule/`（1 包）、`packages/experimental/` 下 agent-team 相关 4 包（另 1 包在本版被删除）
> 上游文档：`docs/subsystems/subagent.md`、`agent-team.md`、`workflow.md`、`schedule.md`、`slots.md`
> 证据口径：本文所有数字均来自 `E:\test\rewrite-agently\deepseek-harness` 检出的 `git diff` / `git log` 实测，命令见 §6.14

## 目录

- [引言](#引言)
- [概述](#概述)
- [核心概念](#核心概念)
- [包结构](#包结构)
- [关键类型](#关键类型)
- [数据流](#数据流)
- [测试覆盖](#测试覆盖)
- [与上下游的关系](#与上下游的关系)
- [本版本变更要点（0.1.6-alpha.1 → 0.1.7-rc.1）](#本版本变更要点016-alpha1--017-rc1)
- [附录：本版提交索引](#附录本版提交索引)

---

## 引言

本篇覆盖 DSH 里"把活分出去"的四个包组：

- **`packages/subagent/`**（10 包）：委托能力缝 `ctx.subagents` 的定义、七个提供者实现、两个模型可见工具；
- **`packages/workflow/`**（4 包）：编排能力缝 `ctx.workflowEngine` 的定义、唯一引擎 `workflow-ptc`、模型工具 `tool-workflow` 与固定脚本迭代 `tool-ralph`；
- **`packages/schedule/`**（1 包）：会话内定时跟进；
- **`packages/experimental/`** 下的 Agent Teams 四件套：`agent-team`（服务）、`agent-team-profile`（bundle）、`tool-agent-team`（模型工具）、`client-ui-agent-team`（Web UI）。

本版（0.1.6-alpha.1 → 0.1.7-rc.1）这四个包组的合计改动规模（实测）：

| 包组 | 文件 | 新增行 | 删除行 |
|---|---|---|---|
| `packages/subagent` | 75 | +1813 | −1852 |
| `packages/workflow` | 11 | +625 | −129 |
| `packages/schedule` | 12 | +274 | −41 |
| `packages/experimental` agent-team 五路径 | 58 | +2011 | −2258 |
| **合计** | **156** | **+4723** | **−4280** |

注意：上表的行数被一项**跨全仓的机械变更**显著抬高——本版把工作区依赖范围从 `workspace:^` 统一改为 `workspace:*`（Cordis/vendor/native 用 `workspace:~`），见 commit `37372101b5 build: pin internal DSH workspace dependencies` 与 `4e6028a604 build: use tilde ranges for vendor and native workspaces`。在 `packages/subagent` 中，纯粹只改版本号与依赖范围的包占了 7 个（`subagent-acp`、`subagent-claude-code`、`subagent-codex`、`subagent-dsh-sdk`、`subagent-fork-in-process`、`subagent-spawn-in-process`，以及 `workflow/workflow`、`workflow/workflow-ptc`、`workflow/tool-ralph`）。**读本版 diff 时必须先扣掉这一层噪声**：真正的语义变更集中在 `subagent/subagent`、`tool-subagent`、`tool-subagent-control`、`tool-workflow`、`schedule/schedule` 与 Agent Teams 四个包。

本版这一族的主题可以一句话概括：**把"发现"从"读遍全仓"收回成"读父会话自己的目录"，同时给可续期子代理装上真容量上限，并让 Agent Teams 收敛成一次开关。**

本版引用的新增 Agent Note（全部落在区间内，来源 `_analysis_output/dsh017/notes-added.txt`）：

| Note | 主题 |
|---|---|
| `architecture/2026-09-18-agent-teams-single-bundle.md` | Agent Teams 单 bundle |
| `architecture/2026-09-18-declarative-agent-presets.md` | 声明式 agent preset 与保留修订 |
| `architecture/2026-09-18-volatile-config-references.md` | 易变配置引用（`Volatile<T>`） |
| `architecture/2026-09-01-parent-owned-subagent-catalog.md` | 父会话拥有的子代理目录 |
| `simplification/2026-09-16-subagent-catalog-membership-only.md` | 目录只记成员，不记模型 |
| `simplification/2026-09-15-model-agent-availability-and-team-targets.md` | 可用性词汇与 Team target |
| `simplification/2026-09-08-web-subagent-catalog-projections.md` | Web 侧消费共享投影 |
| `feature/2026-09-15-continuable-activation-capacity.md` | 共享可续期激活容量 |
| `feature/2026-09-16-shared-subagent-settings-card.md` | 共享子代理设置卡 |
| `feature/2026-09-01-workflow-run-in-background.md` | workflow 后台运行 |
| `feature/2026-09-21-archive-stops-running-session-work.md` | 归档前停止在跑的活 |
| `bug-fix/2026-09-19-session-local-subagent-migration.md` | 按需迁移历史子代理目录 |

> **对上版梳理的一处纠正**：上版（0.1.6-alpha.1）把 `packages/preset/agent-presets` 当作组合门禁的测试落点；本版该包已被拆成 `packages/preset/agent-preset` 与 `packages/preset/agent-preset-registry`，`agent-presets` 整包删除（见 §6.7）。preset 包组本身属于 preset 章节的写作范围，本篇只讨论它对 subagent 的接缝影响。

---

## 概述

DSH 的主干（第 02 篇）驱动**一个** Agent。真实任务需要"把活分出去"，于是有四个递进的场景：

1. **并行调研**——开几个子代理各查一块，主代理汇总（`ctx.subagents`）；
2. **可继续追问**——子代理不是一次性黑盒，父代理能对它追问、打断、枚举（continuable children）；
3. **编排脚本**——主代理写一段 JS，脚本自己扇出一批子代理、收集结果、返回单个 JSON 值（`ctx.workflowEngine`）；
4. **定时跟进**——会话自己在未来某个时刻给自己发一条消息（`schedule`）。

外加一条实验性的横切能力：**Agent Teams**——一个 Lead 加若干 teammate 的持久名册、邮箱与共享任务板。

本版这一族承担的十条需求（R1–R8 编号沿用上版，便于跨版本对照；R9/R10 为本版新建）：

| 编号 | 需求 | 关键实现落点 | 本版状态 |
|---|---|---|---|
| R1 / R2 | 委托可插拔 + 能力显式声明（超出即拒绝，绝不接受后忽略） | `SubagentCapabilities` | 保持 |
| R3 | 可继续会话：`send_message` / `interrupt_agent` / `list_agents` | `continuation.ts`、`continuation-activation.ts` | **强化**：容量上限 + 状态词汇收敛 |
| R4 | 模型可写编排：脚本经引擎运行，`meta`/`args` 是纯 JSON 且先校验后求值 | `workflow/src/runtime-types.ts` | 保持 |
| R5 | 后台统一管控（`ctx.jobs` + `job_*` 工具） | `JobKindMap` | **扩展**：`workflow` 成为第三种 `kind` |
| R6 | 子代理目录枚举 | `catalog.ts`、`list-children.ts` | **重构**：改为父目录直读 |
| R7 | 权限沿委托链显式继承 | `child-agent.ts` | 保持（本版未动） |
| R8 | 编排受宿主安全策略约束 | `workflow-ptc` | 保持（本版仅元数据变更） |
| **R9** | **有界并发：可续期子代理的真容量上限** | `ActivationPool`、`Config.maxActiveSubagents` | 🆕 本版新建 |
| **R10** | **归档一个会话不得把在跑的活留在暗处** | `workspace/session-activity` / `session-stop` 接缝 | 🆕 本版新建 |

**非功能底线**：血缘贯通、有界扇出、结算经父 inbox 通知、父子会话独立落盘、能力不符启动前拒绝、引擎可替换而脚本语义不变。

**边界**：subagent 与 workflow 都是可选能力，不在 agent-loop spine 内；`schedule` 只在会话内投递，不跨会话、不发外部通知；Agent Teams 是 `experimental/` 下的实验包，无稳定性承诺。

---

## 核心概念

| 术语（首次出现附英文） | 含义 | 本版是否受影响 |
|---|---|---|
| 能力缝（capability seam） | Service Definition / Service Provider / Consumer 三角色，必须完整 | 保持 |
| one-shot / continuable | 一次性子代理跑完结算；可续期子代理保留会话，父代理可追问、打断、枚举 | 保持 |
| 激活（Activation） | 一个可续期子代理子代理的**驻留纪元**：直接持有 `AgentHandle`，独占一个子锁与一条邮箱 | **新增容量语义** |
| 容量池（ActivationPool） | 进程内的槽位池，沿**不间断的**可续期父子链按引用共享 | **本版新建** |
| 父目录（parent catalog） | `subagent/catalog` 事件与 `subagentCatalog` 投影：父会话自己记录直接子节点成员资格 | 本版成为**直读**的权威 |
| 成员制（membership-only） | 目录只记身份、创建时间、模式、标签，不记模型/提供者 | **本版新增约束** |
| `unknown` 模式 | 历史子节点描述符不可读时，目录行标 `mode: 'unknown'`：成员可见但不宣称可续期 | **本版新增** |
| 投影 wire 视图（wire view） | 投影定义里对客户端暴露的 schema + 视图函数 | `agentTeam` 本版**首次获得** wire 视图 |
| 易变配置（volatile config） | Schemastery `.volatile()` 声明的字段：值可原地更新而不重挂载插件 | **本版新增机制** |
| 归档准入（archive admission） | 归档会话前询问各提供方"这个会话还有什么在跑"的瀑布/并行接缝 | **本版新增** |
| bundle | 一个可选插件包，其运行期内容主要是 `cordis.patch.yml` | Agent Teams 收敛为单 bundle |

**三条缝在本篇的形态**：

- `ctx.subagents`——**按名注册多个提供者**并存（与 bash 只允许一个执行器不同），因为委托对象的选择是部署形态问题；
- `ctx.workflowEngine`——**单实现**，第二个引擎替换第一个，加载第二个直接抛错；
- `ctx.jobs`——抽象类，`bash`/`pwsh`/`pty`/`subagent`/`workflow` 各自用声明合并往 `JobKindMap` 里加自己的 `kind`。

**新增的第四条**：`workspace/session-activity`（waterfall）+ `workspace/session-stop`（parallel）不是能力缝而是**归属接缝**——workspace 包不认识 agent / job / subagent / schedule 任何词汇，每个提供方自己用声明合并把家族名加进 `SessionActivityKindMap`。

---

## 包结构

### subagent 组（10 包）

| 包 | 职责 | 本版改动规模（文件 / +行 / −行） |
|---|---|---|
| `subagent/subagent` | 委托缝定义、能力描述符、continuable 编排、目录事件与投影 | 32 / +1363 / −1372 |
| `subagent/subagent-acp` | 经 ACP 协议驱动外部 agent | 5 / +35 / −34（仅版本与范围） |
| `subagent/subagent-claude-code` | Claude Code 子进程提供者 | 1 / +26 / −26（仅版本与范围） |
| `subagent/subagent-codex` | Codex 子进程提供者 | 2 / +28 / −28（仅版本与范围） |
| `subagent/subagent-dsh-sdk` | 经 DSH SDK 驱动子进程 | 5 / +40 / −39（仅版本与范围） |
| `subagent/subagent-fork-in-process` | fork 式进程内提供者（继承父已完成轮次前缀） | 3 / +21 / −21（仅版本与范围） |
| `subagent/subagent-in-process-driver` | 进程内驱动（两个提供者共用） | 6 / +48 / −41 |
| `subagent/subagent-spawn-in-process` | 新建式子会话提供者 | 2 / +22 / −22（仅版本与范围） |
| `subagent/tool-subagent` | 模型可见的 `subagent` 工具 + 模型选择设置 | 11 / +144 / −178 |
| `subagent/tool-subagent-control` | 全局控制工具 `send_message` / `interrupt_agent` / `list_agents` | 8 / +86 / −91 |

### workflow 组（4 包）

| 包 | 职责 | 本版改动规模 |
|---|---|---|
| `workflow/workflow` | 缝定义：`ctx.workflowEngine`、run 词汇、`workflow/*` 事件 | 1 / +13 / −13（仅版本与范围） |
| `workflow/workflow-ptc` | 唯一引擎：VM + helpers 跑在共享的沙箱化 Node PTC 进程内 | 1 / +37 / −37（仅版本与范围） |
| `workflow/tool-workflow` | 模型可见的 `workflow` 工具 | 8 / +551 / −55 |
| `workflow/tool-ralph` | 固定脚本的 fresh-agent 迭代循环 | 1 / +24 / −24（仅版本与范围） |

> **重要负面结论**：本版 `workflow-ptc` 的**源码零变更**——`git diff --stat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/workflow/workflow-ptc` 只有 `package.json` 一个文件、+37/−37 行，且全部是版本号与 `workspace:^` → `workspace:*` / `workspace:~` 的替换。"流程复用 PTC 沙箱"这一决策的实现（`PtcRuntime`、`timeoutMs: null`、单绑定调用排空、控制管道延迟关闭）**在本版保持原样**，其决策记录 `architecture/2026-09-13-workflow-ptc-sandbox-reuse.md` 也**不在**本区间新增清单里（它属于上一版 0.1.6-alpha.1 的成果）。

### schedule 组（1 包）

| 包 | 职责 | 本版改动规模 |
|---|---|---|
| `schedule/schedule` | 会话内定时跟进：创建 / 列出 / 删除，到点以普通 follow-up 消息投递 | 12 / +274 / −41 |

### experimental 组（Agent Teams，本版 4 包 + 删除 1 包）

| 包 | 职责 | 本版改动规模 |
|---|---|---|
| `experimental/agent-team` | Team 服务：名册、邮箱、任务板、生命周期、`agentTeam` 投影 | 19 / +566 / −321 |
| `experimental/agent-team-profile` | **单一 bundle**：Team 服务 + 工具 + Web UI | 9 / +81 / −21 |
| `experimental/agent-team-web-profile` | **本版删除**（原本只挂 `ui-agent-team` 行的 Web-only 层） | 8 / — / −303 |
| `experimental/tool-agent-team` | Team 作用域的模型工具（`spawn_teammate` 等） | 8 / +214 / −101 |
| `experimental/client-ui-agent-team` | Web 名册、任务板、teammate 会话导航 | 14 / +1150 / −1512 |

`packages/experimental/` 在 rc.1 共 **20 个包目录**（`git ls-tree --name-only HEAD packages/experimental/` 共 24 项，扣除 `AGENTS.md` 与三个 `README*`）。

---

## 关键类型

### 片段 A：可续期容量与深度（本版新增的 Host 配置）

```ts
// packages/subagent/subagent/src/index.ts:191-204
/** Host configuration for continuable subagent capacity. */
export interface Config {
  /** Maximum live children sharing uninterrupted continuable parent links; defaults to 8. */
  maxActiveSubagents: Volatile<number>
  /** Default delegation depth for tools without an explicit limit; defaults to 1. */
  maxDepth: Volatile<number>
}

/** Named provider registry with one-shot runs, durable discovery, and continuable-child operations. */
export class SubagentRuntime extends TypertRemoteService {
  static Config = z.object({
    maxDepth: z.number().step(1).min(0).max(Number.MAX_SAFE_INTEGER).default(1).volatile(),
    maxActiveSubagents: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(8).volatile(),
  })
```

`Volatile<T>` 让这两个值可以**原地更新**；每次委托读取当前值：

深度解析入口是 `resolveMaxDepth(configured?: number | 'provider-managed'): number | undefined`（`index.ts:244-249`）：`'provider-managed'` 返回 `undefined`，显式数字原样返回，省略时读当前的 `config.maxDepth` 并过 `assertSubagentMaxDepth`。容量在注册表里被**订位**：`const releaseSlot = pool.reserve(this.maxActiveSubagents())`（`continuation-activation.ts:489`）。

### 片段 B：父目录事件的两个载荷版本

```ts
// packages/subagent/subagent/src/catalog.ts:20-35（节选）
/** Catalog payload version emitted by live child creation. */
export const SUBAGENT_CATALOG_VERSION = 0

type KnownCatalogMode =
  | { readonly mode: 'one-shot'; readonly label?: string }
  | { readonly mode: 'continuable'; readonly label: string }

/** Parent catalog v0 records known modes; v1 also retains children with unknown mode. */
export type SubagentCatalogEvent =
  & { readonly childId: SessionId; readonly childCreatedAt: number }
  & (
    | ({ readonly version: 0 } & KnownCatalogMode)
    | ({ readonly version: 1 } & (KnownCatalogMode | { readonly mode: 'unknown'; readonly label?: string }))
  )
```

投影状态版本从 2 升到 3（`catalog.ts:133`）；未知模式只出现在 v1 —— 校验器由 one-shot 载荷 `extend` 而来：`const unknownCatalogSchema = oneShotCatalogSchema.extend({ version: z.literal(1), mode: z.literal('unknown') })`（`catalog.ts:68`）。

### 片段 C：目录行的客户端直读词汇

```ts
// packages/subagent/subagent/src/control-types.ts:24-47（节选）
/** Shared child fields for complete-descendant listing. */
export type SubagentCatalogRow = {
  readonly id: SessionId
  readonly activity: 'running' | 'inactive'
} & ({ readonly mode: 'one-shot'; readonly label?: string }
   | { readonly mode: 'continuable'; readonly label: string })

export type SubagentListEntry =
  | SubagentCatalogRow & { readonly kind: 'child'; readonly hasChildren: boolean }
  | { readonly kind: 'diagnostic'; readonly id: SessionId
      readonly reason: 'corrupt' | 'unsupported' | 'unavailable' }
```

本版**删除**了 `SubagentCatalog` 接口（`entries` + `parentAvailable`）与 `@Remote('list') remoteExportList`，并把远程错误码 `subagent/projections-unavailable` 一并删除（`control-types.ts` 的 `RemoteErrorDetailsMap` 现在只有 `subagent/zone-invalid`、`subagent/attachment-invalid`、`subagent/delivery-unavailable`）。

### 片段 D：归档准入的新家族声明

```ts
// packages/subagent/subagent/src/control-types.ts:122-127
declare module '@deepseek-ai/dsh-workspace/types' {
  interface SessionActivityKindMap {
    /** A subagent session delegated from this session (at any depth) is inside a turn. */
    subagent: true
  }
}
```

### 片段 E：Team 的客户端可见投影（本版首次有 wire 视图）

```ts
// packages/experimental/agent-team/src/types.ts:99-125
/** One durable roster row published through the `agentTeam` Session projection. */
export interface TeamMemberProjection {
  readonly id: SessionId
  readonly name: string
  readonly role: 'lead' | 'teammate'
  /** Durable lifecycle; the Lead row is always `active`. Turn activity comes from Session status. */
  readonly phase: TeamMemberPhase
  readonly error?: string
}

export interface TeamProjection {
  readonly members: TeamMemberProjection[]
  readonly tasks: TeamTaskView[]
  readonly failure?: string
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** Durable roster and non-deleted task board of the Team rooted at the projected Session. */
    agentTeam: TeamProjection
  }
}
```

投影定义的 `stateVersion` 从 3 升到 4，并首次带 `wire`：

```ts
// packages/experimental/agent-team/src/projection.ts:386-394
export const teamProjectionDefinition = {
  key: 'agentTeam',
  stateVersion: 4,
  stateSchema: teamProjectionEntrySchema,
  init: header => emptyTeamState(header.id),
  apply: applyProjectionEvent,
  wire: { viewSchema: teamProjectionSchema, view: teamProjectionView },
} satisfies ProjectionDefinition<'agentTeam', TeamProjectionState>
```

### 片段 F：workflow 后台运行的判别式输出

输出 schema 是一个 `oneOf` 判别式联合（`index.ts` 的 `output.schema`）：`kind: 'background'` 分支必填 `jobId` + `runId`；`kind: 'foreground'` 分支必填 `runId` + `agentsStarted` + `result`，两个分支都 `additionalProperties: false`。

`workflow` 通过声明合并加入 `JobKindMap`（`index.ts:34-38`）：

```ts
declare module '@deepseek-ai/dsh-jobs' {
  interface JobKindMap { workflow: 'workflow' }
}
```

---

## 数据流

### 委托流（本版改变了"发现"这一支）

```
模型调用 subagent 工具
  └─ tool-subagent 解析 maxDepth：config.maxDepth 未给 → ctx.subagents.resolveMaxDepth(undefined)
       └─ 读 Host 设置（Volatile，默认 1）→ assertSubagentMaxDepth
  └─ ctx.subagents.start(provider, request)
       └─ 进程内提供者创建子 Agent（parent 必填，depth = 父 + 1）
       └─ 依次向子会话日志追加 sandbox/mode、approval/policy、permission/preset、subagent/descriptor
       └─ 向**父会话**追加 subagent/catalog（v0；one-shot 在 provider 返回后，continuable 在初始 inbox 接纳后）
  └─ 结算时以 user/message 注入父 inbox
```

**可续期这一支**（本版新增容量订位）：

```
send_message / spawn_continuable
  └─ ContinuableActivationRegistry.materializeTracked(...)
       ├─ 沿不间断的 continuable 父子链解析池（pool）
       ├─ pool.reserve(maxActiveSubagents())   ← 槽位在解构出 Agent 之前就订下
       ├─ 创建或冷恢复子 Agent
       └─ 句柄处置 → 释放槽位 → 通知父结算
     容量耗尽 → SubagentError 'ACTIVATION_LIMIT_REACHED'
     浏览器侧 → Remote 错误 'subagent/delivery-unavailable'
```

### 发现流（本版最大变化）

**旧（0.1.6）**：`listChildren(parentId)` 把 `ctx.sessions` 与持久层合并成一个 live-preferred 语料，按 `header.parentSession === parentId && header.origin === 'subagent'` 过滤，再对每个候选走三级阶梯（注册表水位缓存 → 投影检查点缓存 → 冷观察）解析 mode/label。

**新（0.1.7-rc.1）**：

```
listChildren(parentSessionId, signal?)        // packages/subagent/subagent/src/list-children.ts
  ├─ ctx.get('sessionQuery') 缺 → SubagentError 'SUBAGENT_CONTROL_QUERY_UNAVAILABLE'
  ├─ query.observeSession(parentSessionId, { signal })   // 一次 live-preferred 观察，成功或失败都释放
  ├─ parent.projections?.values.subagentCatalog 缺 → SubagentError 'SUBAGENT_CONTROL_PROJECTIONS_UNAVAILABLE'
  └─ 直接返回父目录行（父事件顺序）——不读任何子日志

listDescendants(rootSessionId, signal?)       // 仍然遍历完整 Session 语料
  └─ 普通会话与 one-shot 子节点仍是遍历节点，所以它们下面的 continuable 后代仍被发现
  └─ 身份解析用注册的 subagent 投影；hasChildren 需要完整语料
```

### 归档准入流（本版新增）

```
archiveSession(sessionId)                      // 不带 stopActivity
  └─ workspace/session-activity (waterfall) → 各提供方依次补自己的家族项
       ├─ Agent 注册表 → kind: 'turn'
       ├─ job 接缝 → kind: 'job'
       ├─ SubagentRuntime → kind: 'subagent'（每个在跑后代一项，label 取描述符）
       └─ Schedule 插件 → kind: 'schedule'（每条活跃提醒一项，label 取 prompt）
  └─ 非空 → WorkspaceActiveSessionError → API 映射 'workspace/session-active'

archiveSession(sessionId, { stopActivity: true })
  ├─ 先写归档集（pre-step 门读的就是它）
  └─ workspace/session-stop (parallel) → 各提供方按自己的语义停下
       ├─ SubagentRuntime → child.cancel({ kind: 'parent' })，逐个 try，一个失败只记警告
       └─ Schedule → 在自己的事务队列里按 schedule_delete 工具同款 durable delete 删掉每条活跃提醒
```

### workflow 后台流（本版新增）

```
workflow 工具调用（args.run_in_background === true）
  └─ ctx.get('jobs') 缺 → 抛错并点名缺哪个组合件
  └─ jobs.start({ kind: 'workflow', label: meta.name, owner: parent.id, run: … })
       ├─ 在 job starter 内 ctx.workflowEngine.start(...)——不带 exec.signal
       ├─ mirror.start(run.id, job)：订阅 workflow/phase、workflow/log、成员生命周期，写进 job 的 log 通道
       └─ done = run.result.then(dispose → mirror.stop → jobOutcomeOf)
              completed → { status: 'completed', detail: '<n> agents', result: <渲染值> }
              cancelled → { status: 'killed' }
              error     → { status: 'failed', detail: <脚本错误> }
  └─ 立即返回 { kind: 'background', jobId, runId }
```

**取消路径**：前台由 `exec.signal` 桥接到 `run.cancel()`；后台**不接工具步 signal**——`job_kill`、job 列表的停止控件、owner 拆除才是取消入口（源码注释：`No pre-abort check here, unlike bash/pwsh`）。

---

## 测试覆盖

本版新增/修改的测试文件（实测 `git diff --stat`，仅列本篇范围）：

| 层 | 主要证据 |
|---|---|
| 单元（新增文件） | `packages/subagent/subagent/tests/archive-admission.spec.ts`（+182） |
| 单元（大幅改写） | `packages/subagent/subagent/tests/list-children.spec.ts`（+392 / −965，随父目录直读整体重写）、`tests/control.spec.ts`（+37 / −93）、`tests/continuation.spec.ts`（+255 / −10）、`tests/timing-projection.spec.ts`（35）、`tests/catalog.spec.ts`（+17） |
| 单元（设置） | `packages/subagent/tool-subagent/tests/model-selection-settings.spec.ts`（113） |
| 单元（Agent Teams） | `packages/experimental/agent-team/tests/projection-events.spec.ts`（+244）、`tests/team.spec.ts`（78）、`tests/persistence.spec.ts`（6）、`tests/built-lib.e2e.ts`（14） |
| 单元（schedule） | `packages/schedule/schedule/tests/plugin.spec.ts`（+108）、`tests/runtime.spec.ts`（30） |
| 工具层 | `packages/subagent/tool-subagent-control/tests/list-agents.spec.ts`（58）、`tests/tool-subagent-control.spec.ts`（14）、`packages/experimental/tool-agent-team/tests/tool-team.spec.ts`（176）、`packages/workflow/tool-workflow/tests/tool-workflow.spec.ts`（+243） |
| bundle 门禁 | `packages/experimental/agent-team-profile/tests/profile.spec.ts`（8）：解析 `cordis.patch.yml`，断言四个 disable 行与三个 insert 行的 id/name/config |
| 组合快照 | **新增** `snapshots/sdk/subagent-activation-limit/`（`cordis.yml` + `cordis.snapshot.yml` + `replay.override.json` + 两个 session jsonl）、**新增** `snapshots/session/team-targets/`（含 757 行的 `tool-schemas.expected.json` 与 36 行 `system-prompt.expected.md`） |
| Web 快照 | `snapshots/web/subagent-conversation/*`（8 个 expected 变更）、`snapshots/web/workflow-run/{ui,ui-live}.expected.md` |

测试改动总量（上列 26 个文件）：**+1816 / −1330**。

新增快照的用途（按 Note 与目录名对应）：

- `snapshots/sdk/subagent-activation-limit/`——容量策略的录制证据：Note `2026-09-15-continuable-activation-capacity.md` 的 `## Verification` 明确写"一次 keyless SDK-profile 快照记录先成功创建后台子代理、随后在超额时给出工具诊断，而第一个子代理仍存活"。
- `snapshots/session/team-targets/`——Team 工具返回 `target` 而非 UUID 的模型输出固定，对应 Note `2026-09-15-model-agent-availability-and-team-targets.md` 的 `## Consequences`。

---

## 与上下游的关系

**上游依赖（本篇所消费的服务）**：

- `ctx.subagents` 消费 `ctx.sessions` / `ctx.sessionPersistence` / `ctx.sessionProjections` / `ctx.sessionQuery` / `ctx.agentPresetRegistry`（type-only，可选）/ `ctx.agents`；本版**新增** type-only 依赖 `@deepseek-ai/dsh-workspace`（只为 `SessionActivityKindMap` 与 `workspace/session-*` 事件类型），并在 `package.json` 里登记为 `peerDependenciesMeta.optional`。
- `workflow-ptc` 消费 `ctx.ptcRuntime`、`ctx.sandboxPolicy`、`ctx.subagents`。
- `tool-workflow` 在本版**新增** `ctx.jobs` 的可选消费（`ctx.get('jobs')`，缺失时 `run_in_background` 报错点名组合件）。
- `schedule/schedule` 消费 `ctx.agents` / `ctx.sessions` / `ctx.tools` / `ctx.sessionPersistence`，本版新增 `ctx.sessionProjections`（可选）与 workspace 事件类型。

**下游消费者**：

- `tool-subagent` / `tool-subagent-control` / `tool-workflow` / `tool-ralph` / `tool-agent-team` 注册进 `ctx.tools`（第 02 篇的守卫管线）。
- `client-ui-subagent`、`client-ui-settings-subagent`、`client-ui-agent-team`、`client-ui-workflow-run` 消费共享投影与 Remote 结果（客户端细节归第 10 篇）。

**平级与跨组**：

- `packages/jobs` 被 shell（后台 bash/pwsh/pty）与 subagent、workflow 共用；本版 `workflow` 成为第三种 `kind`。
- `packages/workspace` 是归档准入的接缝所有者：workspace 包**不认识** agent / job / subagent / schedule 的词汇，四个提供方各自往 `SessionActivityKindMap` 里合并自己的家族名（Note `2026-09-21-archive-stops-running-session-work.md` 的 `## Alternatives considered` 明确说明这条方向是为了避免 workspace 反向依赖 agent 注册表形成环）。
- `packages/preset`（`agent-preset`、`agent-preset-registry`）在 preset 章节详述；本篇只覆盖 subagent 侧的接缝：`child-agent.ts:29` 的 type-only import 与 `package.json` 的 peer 改名（见 §6.7）。

---

## 本版本变更要点（0.1.6-alpha.1 → 0.1.7-rc.1）

> 本节占全文过半篇幅，是本文重点。所有结论都指向具体文件或 commit 哈希；无法核实的点集中列在 §6.13。

### 6.1 主题总览

| # | 主题 | 主判据 | 用户可见性 |
|---|---|---|---|
| T1 | **Agent Teams 收敛为单一 bundle** | 删除 `agent-team-web-profile`（−303），`agent-team-profile` 加 `ui-agent-team` 行 | ⚠️ 高（含升级兼容缺口） |
| T2 | **子代理目录改为父目录直读** | `list-children.ts` 重写；`SubagentListEntry` 拆型；`remoteExportList` 删除 | ⚠️ 中（服务层 API 变更） |
| T3 | **历史子代理按需迁移 + `unknown` 模式** | `subagent/catalog` 载荷 v0/v1；投影 stateVersion 2→3 | ⚠️ 低（老读者会拒绝 v1） |
| T4 | **可用性词汇收敛 + Team target** | `idle` 从 4 处联合类型消失；Team 工具返回 `target` | ⚠️ 中（模型可见 schema 变更） |
| T5 | **可续期激活容量** | `Config.maxActiveSubagents`（默认 8）、`ActivationPool` | ⚠️ 中（超额会拒绝） |
| T6 | **声明式 preset + 易变配置 + 共享设置卡** | `agent-presets` 拆包；`.volatile()`；`ui-settings-subagent` 单页单保存 | ⚠️ 中（组合层改名） |
| T7 | **workflow 后台运行** | `run_in_background`；输出 schema 变判别式联合；`JobKindMap.workflow` | ⚠️ 中（模型可见） |
| T8 | **schedule 归档准入** | `workspace/session-activity` / `session-stop` | ⚠️ 中（归档会拒绝/删除提醒） |
| T9 | **`ralph` 现状核实：仍默认关闭** | `packages/bundle/base/cordis.patch.yml:446-448` `disabled: true` | ✅ 无变化 |
| T10 | 机械噪声：workspace 依赖范围统一 | 9 个包只有 `package.json` 变更 | ✅ 无行为变化 |

### 6.2 T1：Agent Teams 收敛为单一 bundle

**Note**：`.agents/notes/implemented/architecture/2026-09-18-agent-teams-single-bundle.md`
**主提交**：`9f21d7842a fix(agent-team): enable tools and Web UI with one bundle`（52 文件，+130 / −434）

**问题**（Note `## Problem` 原文要点）：分开的 Agent Teams 与 Agent Teams Web 两个开关，要求用户自己发现"工具和它的浏览器控件需要同时选中"。包拆分的代价是把组合细节暴露在插件页上，却没有帮用户选出不同的 Team 能力。

**决策**（Note `## Decision` 原文要点）：

- `@deepseek-ai/dsh-experimental-agent-team-profile` **在一个可选 bundle 里**同时承载 Team 服务、工具与浏览器 UI；
- 它的 patch **保留原行 id** `agent-team`、`tool-agent-team`、`ui-agent-team`，所以 profile patch 仍可单独配置某一行；
- UI 包有一个**惰性 Host 入口**：浏览器入口只在 Web Client 里挂载，headless 不启动 Web server；
- `@deepseek-ai/dsh-experimental-agent-team-web-profile` **从工作区和发布族中消失**；
- 插件页只暴露**一个** Team 选择，默认关闭。

**⚠️ 对任务简报的一处必要澄清**：这**不是**把包 `agent-team-web-profile` 改名为 `agent-team-profile`。实测 `git ls-tree dsh-v0.1.6-alpha.1 packages/experimental/` 显示 **0.1.6-alpha.1 时两个包同时存在**：

| 包 | 0.1.6-alpha.1 时的角色 | 0.1.7-rc.1 |
|---|---|---|
| `experimental/agent-team-profile` | Host 侧层：只 insert `agent-team` 与 `tool-agent-team` 两行；描述 "Experimental profile bundle enabling Agent Teams over dsh-base" | **改写为唯一 bundle**：追加 `ui-agent-team` 行、加 `icon`/`locale`、依赖里加入 `client-ui-agent-team` |
| `experimental/agent-team-web-profile` | Web-only 层：patch 只有一条 `insert: - id: ui-agent-team`；依赖只有 `client-ui-agent-team` | **整包删除**（8 文件，−303） |

所以准确表述是：**Web-only 层被删除，它的唯一一行并入既有的 Host 层 bundle**。名字看起来"从 web-profile 变成 profile"，是因为改动后只剩 `agent-team-profile` 这一个包。

**文件级证据**：

| 变化 | 路径 / 内容 |
|---|---|
| 删除 | `packages/experimental/agent-team-web-profile/{README.md,README.zh.md,README.i18n.yaml,package.json,cordis.patch.yml,src/index.ts,tests/profile.spec.ts,tsconfig.json}` |
| 改写 | `packages/experimental/agent-team-profile/cordis.patch.yml`（33 行）：保留 4 条 `disabled: true`（`tool-subagent-control`、`tool-subagent-list-agents`、`tool-subagent`、`tool-subagent-fork`），保留 `agent-team`（`maxMembers: 8` 等五个上限）与 `tool-agent-team`（`freshProvider: spawn`、`forkProvider: fork`），**新增** `ui-agent-team` 行 |
| 新增资产 | `agent-team-profile/{icon.svg, locale/en.json, locale/zh.json}`；`package.json` 新增 `icon` 字段、`./locale/*.json` 导出与 `files` 条目 |
| 文档 | `packages/experimental/README.md` 表格删掉 `agent-team-web-profile` 一行，把 `agent-team-profile` 的角色改为 "Agent Teams collaboration, tools, and Web UI bundle"（同时新增 5 个语音族包，属其他章节） |
| 门禁 | `agent-team-profile/tests/profile.spec.ts` 断言 manifest 依赖恰好包含三个包，并断言 patch 里 `ui-agent-team` 的 `name` |

**升级兼容缺口**（Note `## Consequences` 原文要点，值得单独强调）：**仍选择被删除 Web bundle 的既有 profile 会在启动时失败**——包解析不到。Bundle 组合不提供对已保存选择的自动改写；兼容处理被明确留在本决策之外。新 README 给出的手工修法是："在既有 profile 的 `package.json` 里保留 `agent-team-profile`、删掉 `agent-team-web-profile` 条目"。用户级 patch 针对 `ui-agent-team` 行的覆盖仍然生效。

**被否决的备选**：保留两个开关并解释依赖关系（一次功能仍要两次选择，单选任一个都得到不完整的浏览器体验）；在通用 profile loader 或插件管理器里合并条目（会让共享加载/呈现代码拥有特定功能的组合知识）。

**未覆盖**：Note `## Verification` 自陈"这些场景不覆盖升级一个仍选择已删除 Web bundle 的 profile"。

### 6.3 T2：子代理目录改为父目录直读

**Notes**：`architecture/2026-09-01-parent-owned-subagent-catalog.md`、`simplification/2026-09-16-subagent-catalog-membership-only.md`、`simplification/2026-09-08-web-subagent-catalog-projections.md`
**主提交**：`e55093b47d feat(subagent): migrate direct catalog consumers to parent projections`（208 文件，+2394 / −2929）

**问题**（2026-09-01 Note 的 `## Problem`）：直接子节点发现曾经从**全局 Session 语料 + 每个被选中子节点的日志**重建目录。而创建时就已经知道直接父、子 id、模式与标签——把仓库级枚举与子日志读取叠在一个已拥有的事实上，既重复又让浏览器刷新的成本取决于无关会话。

**决策要点**：

- 父会话自己的**必需** `subagent/catalog` 事件是直接子节点发现的持久权威；每个事件是一条成功创建事实，含 `childId`、`childCreatedAt`、模式与随模式变化的标签；
- 远程一次性运行没有本地 Session，因此**不在**该目录内；
- 创建只发布成功事实：one-shot 在 provider 返回本地子节点后、返回调用方前追加；continuable 在初始 inbox 接纳后、返回子 id 前追加；接纳或追加失败则创建失败并释放激活，**没有补偿事件或回滚协议**；
- 存储委托给 `dsh-chunked-list`（64 条一块的持久栈），追加最多复制头块、O(1)；物化按最旧到最新遍历，O(D)；
- 并发创建按**目录追加成功**排序，与子时间戳和 id 无关；
- fork 隔离用投影初始化拿到的 `Session.inheritedEventCount`：折叠器忽略低于该偏移的 `subagent/catalog` 事件。

**本版在此基础上做的**（`e55093b47d`）：

| 维度 | 0.1.6-alpha.1 | 0.1.7-rc.1 |
|---|---|---|
| `listChildren(parentSessionId, signal?)` 返回型 | `Promise<SubagentListEntry[]>` | `Promise<SubagentCatalogEntry[]>` |
| 读路径 | live-preferred 合并语料 + 三级身份阶梯（注册表水位 → 投影检查点缓存 → 冷观察） | 一次 `query.observeSession(parent)`，读 `parent.projections.values.subagentCatalog` |
| 缺依赖时的错误 | `SUBAGENT_CONTROL_PROJECTIONS_UNAVAILABLE` / `SUBAGENT_CONTROL_SESSION_STORE_UNAVAILABLE` | `SUBAGENT_CONTROL_QUERY_UNAVAILABLE`（无 `ctx.sessionQuery`）/ `SUBAGENT_CONTROL_PROJECTIONS_UNAVAILABLE`（无该投影） |
| 诊断行 | `listChildren` 也会产出 `kind: 'diagnostic'` | 诊断**只在** `listDescendants` 的完整语料路径出现 |
| 远程服务方法 | `@Remote('list') remoteExportList(parentSessionId, signal)` → `SubagentCatalog` | **删除**；Web 侧改读共享投影 |
| `hasChildren` 位置 | `SubagentListEntry` 的公共字段 | 移到 `kind: 'child'` 分支上（只有完整语料枚举才计算） |
| 投影缓存读取 | `cache.cachedSnapshot(header, SessionLogOffset(0), ['subagent'])` | `cache.cachedSnapshot(header, ['subagent'])`（偏移推断交给缓存本身） |

**客户端语义变化**（`simplification/2026-09-08-web-subagent-catalog-projections.md`）：Client 只保留标准 per-Session 投影 store 作为成员来源；初始 `session.projections` 读返回一次 live-preferred 观察的完整基线（值与序列游标）；初始基线与实时控制帧共用同一序列排序，所以旧响应不会覆盖新值；该端点**不激活 Agent、不采样子活动**。该 Note 明确取代了 `feature/2026-07-27-web-subagent-conversations.md` 里专用的成员刷新机制。

**成员制的含义**（`simplification/2026-09-16-subagent-catalog-membership-only.md` 的 `## Decision`）：目录事件与投影**只保留**子身份、创建时间、模式与标签。`establishCatalogChild(parent, childHeader, descriptor)` 只接收发布成员资格所需的值（`catalog.ts:143-149`）。这个 Note **只**取代 2026-09-01 Note 中"创建时模型元数据"那一项选择；后者对成功发布、事件顺序、fork 隔离、投影归属仍然有效。

**为什么不要创建时模型元数据**（同 Note 的 `## Alternatives considered`）：可选字段依然需要持久 schema、缓存失效、生产者与回放期望；而发现与导航消费者根本不读这些值，创建配置也不能证明"哪个模型服务了某次请求"——真需要的话，消费者可以独立观察子会话已有的 `modelSelection` 投影。

### 6.4 T3：历史子代理按需迁移与 `unknown` 模式

**Note**：`bug-fix/2026-09-19-session-local-subagent-migration.md`
**主提交**：`a9985b49ae fix(session): migrate historical subagents only when opened`（143 文件，+607 / −680）、`f984683956 fix(subagent): store unknown mode in the existing catalog event`、`a978ad1994 fix(subagent): version unknown catalog payloads locally`

**问题**（Note `## Problem`）：打开一个历史父会话需要来自其直接子节点的发现事实。而某个子节点体损坏、描述符非法，或同一个 root 下别处有不可读 header，都可能让父会话的 V4 准备失败，从而隐藏本来可读的历史。

**决策要点**：

- 打开 A 时通过 header 发现候选 B 会话、读它们自己的描述符，并**补全 A 的目录**；历史子读取走 V0–V3 目录语义，当前子读取走原生校验；
- 这些读取**不**准备 B 自己的目录、也不发布 B 的后继；单独打开 B 时才做 B 的迁移与目录准备；
- JSONL 把不可读/不支持的 header 从发现中略去；子体或描述符字段失败产生一条带子路径的警告，**保留该子 header 的身份**；
- 如果父目录缺少完整条目，迁移**追加**一条 `subagent/catalog`，投影成 `mode: 'unknown'`，与健康兄弟并列；既有完整条目保持权威；
- 取消与源一致性失败仍然中止操作；已检查过的子修订（含解码失败）在复用与发布前重新校验，避免修复后静默复用陈旧证据。

**载荷版本（本版关键设计点）**：

| 项 | 值 |
|---|---|
| `SUBAGENT_CATALOG_VERSION` | `0`（"live child creation 发出的版本"） |
| v0 允许的模式 | `one-shot`、`continuable` |
| v1 额外允许 | `unknown`（`label?`） |
| 读取器 | 支持两者（`version: z.union([z.literal(0), z.literal(1)])`） |
| 写入者 | 健康创建与完整历史事实仍写 v0；`unknown` 迁移事实写 v1 |
| `subagentCatalog` 投影 `stateVersion` | **2 → 3** |
| `subagentTiming` 投影 `stateVersion` | **2 → 3**（新增 `lastTurnCompleted?: boolean`） |
| `subagent`（身份）投影 `stateVersion` | 2（未变） |

**代价**（Note `## Consequences` 原文要点）：**老读取器会拒绝新的载荷版本**。"unknown 条目发布后不会自动重写；单独打开该子节点会重试它的日志，并根据实际描述符决定浏览能力，或报告子本地错误。"

**文档同步**：`docs/subsystems/subagent.md` 在 `subagentCatalog` 段落追加一句——"Historical children with unavailable descriptors have `mode: 'unknown'`; their header identity remains discoverable without granting continuation capabilities."——并新增 `SubagentCatalogEntry` / `SubagentCatalogState` / `SubagentCatalogRow` 三者分工说明段。

### 6.5 T4：可用性词汇收敛与 Team target

**Note**：`simplification/2026-09-15-model-agent-availability-and-team-targets.md`
**主提交**：`507e0e6dfe fix: expose Team targets and simplify model agent statuses`（83 文件，+1316 / −271）、`b9e59cbaee refactor: unify Team availability in the service`（25 文件，+63 / −64）、`cda99db4c0 docs: align remaining agent availability prose with the shipped vocabulary`

**问题**（Note `## Problem`）：Team 操作接受成员**名字**，但返回名字与 Session UUID 两种寻址方式，等于邀请模型去选一个用不了的地址；同时"已加载但在轮次之间"与"只在存储里"有不同内部状态，可要继续工作所需的模型动作却相同。

**决策要点**：

1. **Team 工具适配器从既有的成员名返回 `target`，并在创建与列表结果里省略成员 Session ID**；消息、打断、任务指派都消费同一个名字。任务 `ownerName`、任务 id、消息 id 保持原义。内部服务、Web 视图与持久 Team 记录**保留** Session 身份。
2. **普通 subagent 工具结果与 Team 服务视图把"已加载但在轮次之间"和"只在存储里"统一投影为 `inactive`**；只有正在执行轮次才是 `running`。Team 另外保留 `provisioning` 与 `failed` 用于成员创建；普通 subagent 的诊断行保留它们各自的读失败原因。打断返回的 previousStatus 用同一规则投影。可用性**不**报告任务结果或等待依赖。

**代码落点**：

| 文件 | 变化 |
|---|---|
| `experimental/tool-agent-team/src/index.ts` | `MEMBER_VIEW_SCHEMA` 里 `id`+`name` 两个必填字段 → 单个 `target`；`status` 枚举 `['running','idle','inactive','provisioning','failed']` → `['running','inactive','provisioning','failed']`；新增 `modelMember()` 把 `name` 提为 `target` 并丢弃 `id`；`spawn_teammate` 返回 `{ member: modelMember(result.member) }`；`list_agents` 对结果 `.map(modelMember)`；`interrupt_agent` 的 `previousStatus` 枚举同步 |
| `experimental/agent-team/src/roster.ts` | 新增模块级 `function availability(agent: Agent \| undefined): 'running' \| 'inactive'`；`TeamMemberView.status` 的三处赋值（Lead 行、teammate 行、`interrupt` 的 previousStatus）改用它 |
| `experimental/agent-team/src/types.ts` | `TeamMemberView.status` 联合类型去掉 `'idle'` |
| `subagent/tool-subagent-control/src/list-agents.ts` | `statusOf()` 从 `'running' \| 'idle' \| 'ready'` 降为 `'running' \| 'inactive'`；`list_agents` 的工具 description 与 output schema 的 `status` 枚举同步；诊断行说明改为"only in `descendants` scope" |
| `docs/subsystems/agent-team.md` | "Runtime `running`/`idle`/`inactive` status" → "Roster `running`/`inactive` status"；Steer 段落改为"a running target receives it at the nearest step boundary; an inactive target starts a turn if loaded or cold-resumes otherwise"；`interrupt` 签名同步 |
| `docs/subsystems/subagent.md` | `list_agents` 契约段重写；新增一句"reports current activity as `running` or `inactive`. These values do not describe task completion or guarantee that `send_message` will succeed." |

**对模型可见文本的连带影响**：`tool-subagent` 的 continuable 分支描述把 "starts a turn while it is idle" 改为 "starts or resumes a turn while it is inactive"；`tool-agent-team` 的 `send_message` 描述从"an idle target starts a turn; an inactive teammate cold-resumes"改为"an inactive target starts or resumes a turn"。

**teammate 初始提醒扩写**（同提交族 `6ec97fa124 fix(agent-team): tell teammates how to message the lead`、`a79e3a2a5f fix(agent-team): explain teammate discovery and messaging`、`d257fa4af7 fix(agent-team): limit the reminder to the lead identity`）：`spawn_teammate` 给子代理的 prompt 前置块从单行扩为多行，明确 Lead 名为 `lead`、用 `list_agents({})` 找队友、用 `send_message({ target: "lead", … })` 找 Lead。

**被否决的备选**（Note `## Alternatives considered`）：现在就给普通 subagent 加稳定名字（需要一个持久命名策略与"历史无名字子节点"的显式处理，与本次目标独立）；合并内部运行态（驻留状态决定投递是启动已加载 Agent 还是从存储恢复；底层 Agent 状态与注册表存在性保留这个区分）。

**后果**：模型可以把 Team 结果里的 `target` 直接复制进适用操作；它们失去了成员 UUID 与驻留细节——Team 寻址不需要它们。**普通 subagent 与 Team 的寻址方式仍然不同，直到有单独的命名决策。**

### 6.6 T5：可续期激活容量（本版最实质的机制新增）

**Note**：`feature/2026-09-15-continuable-activation-capacity.md`
**主提交链**：`16620a3a70 feat(subagent): cap live continuable activations per root at 16` → `d7f9d3a773 fix(subagent): default to eight live continuable children` → `845115d0f8 feat(subagent): edit delegation limits in plugin settings` → `a69bcf3636 feat(subagent): own editable delegation limits in the backend` → `0eed02d447 fix(subagent): map capacity refusal and clarify one-shot scope`

**问题**（Note `## Problem` 原文）：深度限制约束嵌套，却允许**很宽**的并发委托；后台 Job 的限制**覆盖不到**可续期子代理；而生命周期创建配额会让早先子代理完成之后的后续工作无法开展。

**决策要点（逐条对应源码）**：

| 要点 | 源码位置 |
|---|---|
| 服务配置 `maxActiveSubagents`，默认 **8** | `subagent/src/index.ts:203`（`z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(8).volatile()`） |
| 每个**存活且不可续期**的父拥有一个进程内池，沿**不间断的**可续期父子链按引用共享；池主自己被排除 | `continuation-activation.ts` 的 `class ActivationPool` |
| one-shot 运行与外部提供者工作**不进**这个池 | 同上；Note `## Decision` 明示 |
| one-shot 中间父为它的可续期子**另起一个池**；跨 one-shot 的容量继承被推迟 | 同上 |
| 激活注册表在**新建或冷恢复产出 Agent 之前**就订下唯一槽位 | `continuation-activation.ts:489` `pool.reserve(this.maxActiveSubagents())` |
| 物化过程在激活拿到槽位前拥有回滚；未发布的回滚与失败的物化都可以安全释放同一 token | Note `## Decision` |
| 句柄处置 → 释放 → 通知父结算（这个顺序是契约） | Note `## Decision` |
| 发送给已有激活**复用**它的槽位 | 同上 |
| 池查找、接纳、释放是摊还常数时间；一个弱 root map 不持有死掉的 root Agent；每个池只持有已占用的 token | 同上 |
| **不**新增 Session 目录扫描、树遍历、持久计数器或公开容量查询 API | 同上 |

**Host 设置与解析顺序**（这是本版"设置"故事的核心）：

- Host 在**自己的组合之上**注册 `subagent` 设置段；**每次订位都读当前容量**，所以调低上限**永不驱逐**驻留子代理、也不重建它们的注册表；
- 委托工具**每次尝试**都从同一段解析省略的深度；显式的数字策略与 `provider-managed` 策略优先；
- GUI 同时暂存两个数字，并通过既有的 revision-fenced 设置路径把各自重置为组合值。

**实现的落点**是 `Volatile<T>`（见 §6.7）：`Config.maxDepth` 与 `Config.maxActiveSubagents` 都是易变字段，`SubagentContinuationManager` 的构造函数新增第三个参数 `maxActiveSubagents: () => number`，由 `SubagentRuntime` 传 `() => this.config.maxActiveSubagents.get()`（`subagent/src/index.ts:221`、`continuation.ts:88-93`）。

**失败语义**：

| 场景 | 结果 |
|---|---|
| 新建或冷恢复时池满 | `SubagentError`，code `ACTIVATION_LIMIT_REACHED`（`continuation-activation.ts:50`） |
| 浏览器发起的 prompt 遇到冷恢复满额 | Remote 错误 `subagent/delivery-unavailable`（`control.ts:88` 做映射） |
| 排队等待容量？ | **不排队** |

**为什么不排队**（Note `## Alternatives considered` 原文要点）：**等待容量会在每个槽位都属于一个正在等后代的父时死锁**。满池改为用一个可操作的诊断拒绝，而不是保留排队的激活请求。

**为什么不用累积计数**：累积子节点数是一种**独立的成本策略**，且在工作完成后不释放容量；统计模型请求数会漏掉等待中的父、排队的 inbox 工作、重建与清理，而这些都占用资源。

**后果**（Note `## Consequences`）：带待处理 inbox 工作或拥有后代的空闲激活**仍然占槽**；冷恢复可能因容量失败，尽管历史子节点存在；槽位不施加 token 或累积支出预算，也不跨多个 harness 进程协调。

**验证**：`snapshots/sdk/subagent-activation-limit/` 是新增的 keyless 录制证据（首个后台子代理成功创建，随后超额时给出工具诊断，首个仍存活）。单元覆盖在 `tests/continuation.spec.ts`（+265）——实测该文件含 6 处 `ACTIVATION_LIMIT_REACHED` 断言。

**深度默认值的连带变更**：`tool-subagent` 的 `maxDepth` 从 `z.…default(3)` 改为**无默认**；省略时读 Host 设置（默认 **1**）。提交 `04a3c30a04 fix(subagent): default delegation depth to one`（13 文件，+22 / −22）。

```ts
// packages/subagent/tool-subagent/src/index.ts:130（本版）
maxDepth: z.union([z.natural().max(Number.MAX_SAFE_INTEGER), z.const('provider-managed' as const)]),
// packages/subagent/tool-subagent/src/index.ts:330（本版）
if (ctx.subagents.resolveMaxDepth(config.maxDepth) !== undefined && !subagentProvider.capabilities.depthLimit) { … }
```

### 6.7 T6：声明式 preset、易变配置与共享设置卡

这一节的三件事互相咬合：preset 需要设置来持久化，设置需要易变配置来原地生效，而 UI 需要把两个命名空间收进一页。

#### 6.7.1 声明式 agent preset

**Note**：`architecture/2026-09-18-declarative-agent-presets.md`
**主提交**：`d1e22a7e24 feat(preset): declare Agent compositions in profile YAML (#4569)`（294 文件，+4107 / −11908）

**问题**（Note `## Problem`）：preset 目录重复了 Cordis 的配置所有权；各自独立的发现、元数据、复制与编辑 API 无法用普通 profile patch 表达同一套组合；同时在保存时处置一个定义，还必须保住仍在运行的 Agent 所用的插件。

**决策要点**：

- `dsh-agent-preset-registry` 拥有选择与**运行期修订**；`dsh-agent-preset` 用普通 Cordis YAML 声明身份、展示元数据与子插件列表；
- 定义**急切激活**；激活失败仍留在名册里，并拒绝新的绑定，但**不阻止应用启动**；
- 注册表拥有每个修订的 scope 与 Loader 树；Agent 把自己的 scope 链到被选中的修订，**子代理继承父代理的精确修订**；更新会退休旧修订，Agent 与临时冷读取器保持引用直到处置；
- Session 数据继续记录 **preset 身份**；重启时把该身份对当前配置解析，缺定义则拒绝；
- 旧的**可执行**修订是进程本地的，不序列化。

**对 subagent 的直接接缝**：

| 项 | 0.1.6-alpha.1 | 0.1.7-rc.1 |
|---|---|---|
| peer 依赖名 | `@deepseek-ai/dsh-agent-presets` | `@deepseek-ai/dsh-agent-preset-registry` |
| `child-agent.ts` 顶部 | type-only import 让 `ctx.get('agentPresets')` 解析到服务 | 同机制，模块名改为 `@deepseek-ai/dsh-agent-preset-registry`（`child-agent.ts:29`） |
| 子代理组合 | `parent.ctx.get('agentPresets')?.composedPreset(parent.ctx)` | 同名 API 保留（`child-agent.ts:145`） |
| 子代理 scope 组合 | `childCtx.get('agentPresets')?.composeFrom(childCtx, parent.ctx)` | 保留（`child-agent.ts:205`） |
| `SessionHeader.agentPreset` | 既有字段 | 保留（`list-children.ts:385` 仍在 header 投影字段列表里） |

包组的拆分规模（preset 章节详述，此处仅给量化）：`packages/preset/agent-presets`（0.1.6）→ 删除；`packages/preset/agent-preset`（新，name `@deepseek-ai/dsh-agent-preset`）与 `packages/preset/agent-preset-registry`（新，name `@deepseek-ai/dsh-agent-preset-registry`）。三路径合计 91 文件，+2911 / −7438。

**被否决的备选**（Note `## Alternatives considered`）：让目录 preset 与声明并存（两个可写来源会争同一个身份，需要优先级、迁移与编辑规则）；让每个声明插件拥有自己的活子插件树（编辑期间的 Loader 处置会从运行中的 Agent 手里收回工具）；只在首次选择时加载（延迟诊断、增加待首次使用状态）；为一个坏 preset 拒绝应用启动（失败的可选能力集应能在 Web 里修）。

#### 6.7.2 易变配置引用

**Note**：`architecture/2026-09-18-volatile-config-references.md`
**主提交**：`601d6761e4 feat(settings): project volatile Config through profile-backed forms (#4587)`（498 文件，+5950 / −9349）

**问题**（Note `## Problem`）：为了改一个值而替换整个插件，会一并处置它的服务与 effect；而单独搞一套设置订阅又要求每个消费者再实现一个实时配置来源。

**决策要点**：

- Schemastery 用 `.volatile()` 声明活字段，**保留节点类型与表单元数据**，但返回指向不可变快照的**稳定引用**；Cosmokit 拥有共享协议；
- Loader 用 schema 声明的易变路径算原始配置差异，并为后续激活保留原始配置；
- **只有易变变更保留实例**；普通字段变更走既有的重挂载生命周期，且**不会**更新旧引用；
- 一个实例本地的 `loader/volatile-update` 事件在完整候选校验通过、所有引用提交之后报告路径；它用普通 `emit`，监听器完成**不是**配置提交条件；
- 引用可以保留，**但值只能为一个操作捕获**；
- 语义上这是"为 schema 驱动的设置表单提供字段类型、默认值、角色与实时更新声明"——但 Note 明确说**自动表单生成与迁移是另一项工作**。

**对本篇的直接后果**：`SubagentRuntime.Config` 与 `SubagentModelSelectionConfig.Config` 都改成易变字段。后者的变化尤其大——它**删掉**了整段 `ctx.inject(['settings'], …)` + `installSection` 的注册代码与 `SUBAGENT_MODEL_SELECTION_SETTINGS_NAMESPACE`/`…_SCHEMA` 两个导出：

| 维度 | 0.1.6-alpha.1 | 0.1.7-rc.1 |
|---|---|---|
| 命名空间常量 | `export const SUBAGENT_MODEL_SELECTION_SETTINGS_NAMESPACE = 'subagent-model-selection'`（`model-selection-settings.ts:20`） | **删除**（客户端改为自己拼 `SUBAGENT_MODEL_SELECTION_NS = 'subagent-model-selection-settings'`） |
| Schema 导出 | `export const SUBAGENT_MODEL_SELECTION_SETTINGS_SCHEMA` | **删除** |
| 设置注册 | 在构造函数里 `ctx.inject(['settings'], …) installSection(...)` | **删除**；改为读 `this.config.enabled.get()` / `this.config.allowedModels.get()` |
| `Config` 字段 | `enabled?: boolean`、`allowedModels?: AllowedModelRoute[]`（可选） | `enabled: Volatile<boolean>`、`allowedModels: Volatile<AllowedModelRoute[]>`（必填、易变） |
| 校验 | 私有 `validate()`，在构造与 `setSource` 时各调一次 | `current()` 内联校验（`assertAllowedModelRoutes` + 启用即需非空路由） |

#### 6.7.3 共享子代理设置卡

**Note**：`feature/2026-09-16-shared-subagent-settings-card.md`
**主提交**：`ea2651b86b feat(web): unify Subagent settings UI`（30 文件，+802 / −282）

**问题**（Note `## Problem`）：委托限制与模型授权描述的是同一个 Subagent 工作流，但分成两张设置卡，用户得分别找、分别保存。

**决策要点**（Note `## Decision`）：一页 Subagent 分组委托限制与模型选择，**一个保存按钮**；离开页面丢弃两份草稿；两个既有控制器**各自保留**自己的草稿、校验与命名空间写入；任一草稿非法或冲突则**阻止保存**；保存期间两个分区都禁用；两者都成功落地后页面保持打开；失败的分区保留草稿以便重试；限制说明放在字段标签旁的 information 按钮后面，带具体深度示例与计数规则；校验错误保持可见，以免展开说明反而藏住被阻塞的保存。

**插件注册面**：**任一**命名空间被服务时注册**一个** `plugins.item` 条目；组件只渲染可用的分区。

**唯一的那一个 `plugins.item` 注册**（`packages/client/ui-settings-subagent/src/client/index.ts`）：

```ts
// 节选
export const SUBAGENT_NS = 'subagent'
// SUBAGENT_MODEL_SELECTION_NS = 'subagent-model-selection-settings'
export const inject = ['slots', 'locale', 'remote', 'remote.session', 'configForms']
…
const limits = new SubagentLimitsCardController(ctx.configForms.get(SUBAGENT_NS))
const models = new SubagentModelSelectionCardController(ctx.configForms.get(SUBAGENT_MODEL_SELECTION_NS), ctx)
ctx.effect(() => ctx.configForms.whileServed([SUBAGENT_NS, SUBAGENT_MODEL_SELECTION_NS], () =>
  ctx.slots.inject('plugins.item', () => ctx.slots.register({
    name: 'plugins.item', id: 'subagent', order: 30, … }, SubagentCard))), 'ui-settings-subagent: page')
```

限制卡把 `maxDepth` 的最小值定为 0、`maxActiveSubagents` 的最小值定为 1，并要求安全整数（`subagent-limits-card-controller.ts` 的 `limitField`）。

**客户端细节归第 10 篇**：本节只到"Host 命名空间 + 注册面 + 草稿归属"这一层；组件结构、store、槽位声明与样式属于 GUI 章节。

**被否决的备选**：保留分开的卡（独立控件掩盖了委托策略与模型授权之间的关系，还要两次保存手势）；合并 Host 命名空间（UI 分组不需要改持久设置、命名空间修订或这些策略各自生效的时点）。

#### 6.7.4 界面侧的连带条目

`docs/subsystems/slots.md` 是区间内 **schedule.md / workflow.md 之外唯一**被改的本文相关子系统页（+25 / −12），其变更与设置页/插件页的结构调整有关：新增 `plugins.bundle.config`、`plugins.bundle.activation`、`conversation.input.activity` 三个槽位说明；`scope` 语义从"跟随当前选择"改为"继承外层 Provider 绑定"；`SessionProvider` 段落改写为"无 `session` prop 时继承外层绑定；显式 `SessionReference` 或 `undefined` 只覆盖该子树"；`useSessions` 行旁新增 `useSessionStatus`、`useSessionRetainInfo`。

### 6.8 T7：workflow 后台运行

**Note**：`feature/2026-09-01-workflow-run-in-background.md`
**主提交**：`12957a106e feat(workflow): run_in_background registers the run as an observed job`（168 文件，+1065 / −357）、`b0cf8cc1d9 fix(tool-workflow): narrate background runs on the log channel`、`58d4050cb6 docs(tool-workflow): state why the background branch has no pre-abort check`、`8537b8d5bb refactor(shell,workflow): produce into the job record instead of ctx.activities`

**问题**（Note `## Problem`）：一次 `workflow` 调用会把父轮次**锁死**到整个脚本结算——一次长编排（对数百文件的审计扇出）在整个墙钟时间里挟持模型，既不能继续工作，也没有给人类的实时进度，取消是唯一出口。其它长跑执行面（bash、pwsh、一次性子代理）都已经有 `run_in_background` 通往 `ctx.jobs`。

**决策要点（对应源码）**：

| 要点 | 源码位置 |
|---|---|
| 新增 `run_in_background: true`，在 `enableRunInBackground`（默认 on）成立时既暴露也接受 | `tool-workflow/src/index.ts` 的 `Config` 与 `parameters` |
| 调用注册为 **owned `kind: 'workflow'` job**，立即返回 `{ kind: 'background', jobId, runId }` | `startBackgroundRun()` |
| **运行属于 job，不属于工具步**：引擎 run 在 job starter 内启动，**不带 `exec.signal`** | `startBackgroundRun()` 源码注释与实现 |
| 取消路径 = `job_kill` + job 列表停止控件 + owner 拆除，三者都把 reason 转进 `run.cancel` | 同上 |
| **同步**的引擎拒绝（meta/parse 失败）从 starter 冒出去，于是什么都不注册，模型看到普通的可纠正错误 | 同上（源码注释原文） |
| 结算即 job 的结算：`done` 由 `run.result` 链出 → 处置（处置失败只警告，绝不 reject 进注册表）→ 停镜像 → 映射停止原因 | `jobOutcomeOf()` |
| `completed` 把与前台相同的渲染值放在 `JobOutcome.result` | `jobOutcomeOf()` |
| `cancelled` 结算 `killed`，细节留给注册表的 kill-reason 合并 | 同上 |
| `error` 以脚本失败消息结算 `failed` | 同上 |
| **record 镜像取代被删除的 activity 镜像**：`src/record.ts` 每插件订阅一次 `workflow/phase`、`workflow/log`、成员生命周期，写进被跟踪 run 的 `JobHandle`，走 `log` 通道，所以模型的 `job_output` 永不渲染它们；`updateProgress` 跟踪当前 phase | `record.ts`（64 行，全文见上文 §数据流） |
| 输出 schema 变 `kind` 判别式联合（`background` \| `foreground`），前台信封对称地加上 `kind: 'foreground'` | `output.schema` |
| `workflow` 用声明合并加入 `JobKindMap` | `index.ts:34-38` |

**工具描述的动态收尾**：`DESCRIPTION` 常量被拆成 `FOREGROUND_ONLY_CLOSING`（`enableRunInBackground === false` 时）与 `BACKGROUND_CLOSING`（默认），后者的原文是 "The run executes in the foreground by default: this call returns when the whole script finishes. Set `run_in_background: true` for a long run: the call returns a job id immediately, the run keeps orchestrating in the background, and its return value arrives with the job's completion notice (check on it with `job_output`, stop it with `job_kill`)."

**为什么不把 `exec.signal` 桥进后台 run**（Note `## Alternatives considered`）：返回的工具步的 abort（轮次取消）会杀掉模型刚刚有意分离出去的工作；bash 的后台路线已经立下先例——只有注册表能取消。

**为什么不给工具加 start/poll API**：那会为同一个生产者重复 `job_output`/`job_kill`，并让 run 落在 owner 拆除与会话头列表之外。

**已知限制**（`tool-workflow/README.md` 的 `## Known Limitations and Deferred Work`）：

- 后台 run **不向模型报告中间值**——结算前 `job_output` 只返回状态，返回值在完成时整体到达；
- **还没有录制会话场景回放后台 run**（单元与真实引擎组合套件覆盖了该路径；快照树只钉住 schema 与提示文本）；
- 引擎侧的"后台 start/poll"本身仍被推迟——`workflow/README.md` 的同一小节仍写着 "Foreground collection only … background start/poll, spill handles, and detached collection are deferred"。**这不是文档过期**：后台是 `tool-workflow` 用 job 注册表实现的，`ctx.workflowEngine` 的契约没变。

### 6.9 T8：schedule 的归档准入

**Note**：`feature/2026-09-21-archive-stops-running-session-work.md`
**主提交**：`cbae324bfa feat(workspace): stop a Session's running work before archiving it (#4765)`（109 文件，+2763 / −300）

**问题**（Note `## Problem`）：归档曾经是**纯可见性写入**——`WorkspaceRegistry.archiveSession` 只把 id 加进注册表全局归档集，别的什么都不做。在一个轮次中间归档的会话会**在看不见的地方继续跑**：agent、它的工具子进程、它的模型请求都继续到完成；而归档行刻意不显示状态点，所以没有任何东西告诉用户还有 agent 在花 token。后台子代理、owned job 或到点的提醒同样可以在隐藏会话里继续工作或开新轮次。

**决策要点**（与 schedule 有关的部分）：

- **默认拒绝**：`archiveSession(sessionId)` 对非空活动回答抛 `WorkspaceActiveSessionError`，API 映射为 `workspace/session-active`，details 带家族、条目 id 与标签；
- **请求即停，在写入之后**：`archiveSession(sessionId, { stopActivity: true })` 跳过活动检查、写归档，然后派发停止事件。停止**被发出但从不等待结算**，所以 Remote 在每个提供方的请求发出后就返回；
- **每个提供方只拥有自己已有的词汇**。

**schedule 侧的实现**（`packages/schedule/schedule/src/index.ts`，148 行）：

```ts
// 节选（index.ts:83-112）
ctx.effect(() => {
  const stopActivity = ctx.on('workspace/session-activity', async ({ sessionId }, next) => {
    const reminders = activeReminders(sessionId)
    const rest = await next()
    if (reminders === undefined || reminders.active.length === 0) return rest
    const own: SessionActivity = {
      kind: 'schedule',
      items: reminders.active.map(record => ({ id: record.id, label: record.prompt })),
    }
    return [own, ...rest]
  })
  const stopStop = ctx.on('workspace/session-stop', async ({ sessionId }) => {
    const owned = activeReminders(sessionId)
    if (owned === undefined) return
    const { agent } = owned
    await runScheduleTransaction(agent, async () => {
      await flushSchedulePersistence(ctx, agent.session)
      const active = activeReminders(sessionId)?.active ?? []
      if (active.length === 0) return
      for (const record of active) {
        agent.session.append('schedule/change', { version: 1, operation: 'delete', id: record.id })
      }
      runtimes.get(agent)?.runtime.requestDrive()
      await flushSchedulePersistence(ctx, agent.session)
    })
  })
  return () => { stopStop(); stopActivity() }
}, 'schedule.archiveAdmission()')
```

**要点**：

- 存档从 owner **自己的活日志折叠**回答，**不读投影注册表**（那是 Client 视图）；
- `ScheduleRuntime.activeRecords()` 是本版新增方法（`runtime.ts:114-116`）：`if (this.stopping || this.faulted) return undefined; return this.readFolded()?.active`；
- 停止是**管理删除**，走与 `schedule_delete` 工具**相同**的事务队列与两道持久化屏障；
- 没有活 agent、或活 agent 但没有 owned runtime（插件加载前发布、或 runtime 已停/已故障）的会话**什么都不报告**，也就没什么可停——因为没有任何东西被武装到会触发。

**用户可见语义**（`schedule/schedule/README.md` 本版新增一句）："Archiving a live session with active reminders is refused until they stop, and choosing to stop them deletes every active reminder; unarchiving does not bring them back."

**残渣**（Note `## Consequences` 明确列出）：注册表**先写归档再派发停止**，所以"归档写入"与"Schedule 插件的删除屏障"之间崩溃，会留下一个已归档但提醒仍被记录的会话；下次反归档会像从没请求过停止一样把它们显示回来。

**⚠️ 文档落差**：本版**没有**改动 `docs/subsystems/schedule.md`（实测 `git diff --stat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- docs/subsystems/schedule.md` 为空，`git log … -- docs/subsystems/schedule.md` 在该区间也返回空）。这条接缝的记录只存在于 **包 README**（`packages/schedule/schedule/README.md`，+3 / −1）与 Note 里。同样地，`docs/subsystems/workflow.md` 在本版**未变**（277 行，diff 为空），而 `tool-workflow/README.md` 被大改（+21 / −8）——所以"workflow 后台运行"只有包 README + Note 级记录，**没有**子系统页级记录。

### 6.10 T9：`ralph` 现状核实（结论：仍默认关闭）

任务要求核实"`ralph` 默认关闭在 0.1.6 之后的现状（本版是否变化）"。实测结论：**未变化**。

| 证据 | 结果 |
|---|---|
| `packages/bundle/base/cordis.patch.yml:439-450` | 仍是 `- id: tool-ralph` / `name: '@deepseek-ai/dsh-tool-ralph'` / **`disabled: true`**，行内注释仍是"Off by default: the tool description restricts `ralph` to runs the human explicitly asked for…"，并保留 overlay 恢复配方 |
| `git diff --stat … -- packages/workflow/tool-ralph` | 1 文件、+24 / −24，全部是 `package.json` 的版本号与依赖范围 |
| `git log --oneline dsh-v0.1.6-alpha.1..dsh-v0.1.7-rc.1 --no-merges -- packages/workflow` | 只见 release/build 提交触及 `tool-ralph`，无功能提交 |
| `packages/bundle/web-app/cordis.patch.yml:523-525` | 仍在重述该 disable（`validatePresetPlaneSeparation` 收集行 id 时不看 `disabled`，所以这行必须留） |
| 上一版的随附 preset 行（`standard` / `ptc` / `cordis` 各自的 `tool-ralph` disable） | 本版未回退（无相关提交）；`ptc` 的 `workflow-ptc` disable 亦未变 |

**连带结论**：`workflow-ptc` 在本版（含 `ptc` preset 中被 disable 的那一行）**没有源码变更**，所以 §6.8 的后台能力只作用于 `standard`/`cordis` 等仍挂 `tool-workflow` 的组合。

### 6.11 T10 与其他变更

#### 6.11.1 Agent Teams Web 面板改由 `agentTeam` 投影驱动

**主提交**：`1dc518f217 feat(agent-team): drive the Web Team panel from the agentTeam projection`（29 文件，+773 / −615）、`df7fa8945c refactor(agent-team): narrow projection fields and task views`（19 文件，+49 / −69）、`2aa3a469db fix(agent-team): consume shared projections without panel loads`、`843e1b97af fix(agent-team): scope projection reads and address review feedback`、`d08aac9db2 fix(agent-team): read current projections through standard hooks`

**Host 侧变化**：

| 维度 | 0.1.6-alpha.1 | 0.1.7-rc.1 |
|---|---|---|
| `TeamService` 基类 | `TypertRemoteService` | **`Service`** |
| 远程方法 | `@Remote('view') remoteView`、`@Remote('createTask')`、`@Remote('updateTask')` | **三者全删** |
| 客户端类型 | `TeamView`（`members` + `tasks`）、`TeamTaskMutationResult` | **全删**，改为 `TeamMemberProjection` / `TeamProjection` / `TeamTaskView` |
| `agentTeam` 投影 | `stateVersion: 3`，**无 wire**（Host-only） | `stateVersion: 4`，**首次带 `wire: { viewSchema, view }`** |
| 投影 `apply` | 原地修改 state 再返回同一对象 | 纯函数，返回新 state 对象；`replaceAt()` 辅助函数只复制被触碰的集合 |
| 视图缓存 | — | `WeakMap<members, WeakMap<tasks, TeamProjection>>`：仅邮箱状态变化时**复用上一个视图引用**，因此 live drive **不发布**任何帧 |
| 任务视图派生 | `TeamTaskBoard` 的私有方法 `taskView()` | 抽成 `src/task-view.ts`（62 行）的 `projectTaskView()` / `taskReady()`，任务板与客户端投影共用 |
| 客户端入口 | `TeamService` 的 `./remote` 导出 + `./client` 再导出请求/视图/变更结果类型 | `./client` 只导出浏览器安全的 `TeamMemberPhase`、`TeamMemberProjection`、`TeamMemberView`、`TeamProjection`、`TeamTaskId`、`TeamTaskStatus`、`TeamTaskView` |

**新增的 Known Limitation**（`agent-team/README.md`）："**Whole-view broadcasts** —— 每次名册或任务变化都会把完整名册与非删除任务板（含描述）发给每个已连接的浏览器，即使它正在看别的 Session。"这正是 `WeakMap` 缓存**不能**救的那一半。

**`docs/subsystems/agent-team.md`** 同步新增 `<a id="web-projection"></a> ## Web projection` 小节（含三个 `type-equiv` 代码块）、把 `## Replay` 小节里的 `foldTeam()` 改为 `agentTeam` 投影（`foldTeam` 在 0.1.6 的**代码里就已不存在**——`git grep foldTeam dsh-v0.1.6-alpha.1 -- packages/experimental` 无结果，是文档滞后符号，本版顺手改正）、并删掉三个已删除 `@Remote` 方法的契约块。

#### 6.11.2 subagent 的归档准入

**新增文件**：`packages/subagent/subagent/src/archive-admission.ts`（90 行，`installSubagentArchiveAdmission(ctx)`）

```ts
// 节选（archive-admission.ts:23-39）
ctx.on('workspace/session-activity', async ({ sessionId }, next) => {
  const running = runningDescendants(ctx, sessionId)
  const rest = await next()
  if (running.length === 0) return rest
  const own: SessionActivity = { kind: 'subagent', items: await Promise.all(running.map(child => describe(ctx, child))) }
  return [own, ...rest]
})
ctx.on('workspace/session-stop', ({ sessionId }) => {
  for (const child of runningDescendants(ctx, sessionId)) {
    try { child.cancel({ kind: 'parent' }) } catch (error: unknown) {
      // One child refusing its cancel must not keep its siblings running for an archived parent.
      ctx.logger.warn(`subagent: cancelling "${child.id}" for an archived Session failed: ${String(error)}`)
    }
  }
})
```

**关键设计点**（源码 JSDoc 原文要点）：

- `runningDescendants` 按**持久血缘**找：`agent.session.header.parentSession` 存在且 `origin === 'subagent'`，任意深度；
- **fork 共享血缘字段但不带 origin，所以 fork 永远不会"持有"它的来源**；
- 血缘按数据读，所以损坏成环的 header 链每个节点只访问一次（`visited` 集 + BFS）；
- label 走 `foldSubagentDescriptor`，需要 `ctx.sessionQuery`；没有查询服务或描述符不可读时，条目只给 id（`describe()`）。

**注册点**：`SubagentRuntime` 构造函数里 `ctx.inject(['agents'], (agentsCtx) => { installSubagentArchiveAdmission(agentsCtx) })`，构造函数注释说明"this runtime is the owner that knows which live children descend from a Session and how a parent stops them"。

**测试**：`packages/subagent/subagent/tests/archive-admission.spec.ts`（新增，182 行）。

#### 6.11.3 只读 `ContentBlock[]` 收紧

三个公共面把 `ContentBlock[]` 收紧为 `readonly ContentBlock[]`：

| 类型 | 文件 |
|---|---|
| `SubagentResult.output` | `subagent/subagent/src/types.ts:278` |
| `SubagentRunEndInfo.lastAssistantMessage` | `subagent/subagent/src/types.ts:116` |
| `ActivationTerminal.output` | `subagent/subagent/src/lifecycle.ts:36` |

`docs/subsystems/subagent.md` 的 `SubagentResult` 代码块同步。这是**类型层收紧，无运行时行为变化**。

`lifecycle.ts` 另有一处 `v8 ignore` 注释扩写（从 3 行到 4 行），解释 `forked` 只出现在构造函数种子历史里，而该函数读的是 epoch 拥有的后缀。

#### 6.11.4 schedule 的其余变更

`runtime.ts` 新增 `MessageSourceMap['schedule']` 声明合并（`{ kind: 'schedule' } & ContextFormed`，`:9-14`）与 `ScheduleRuntime.activeRecords()`（`:114-116`），并把 `ScheduleRecord` 加入类型导入；`projection.ts` 移除两处 `as unknown as` 断言（改用直接类型断言，配合 `process/2026-09-19-no-unknown-casts.md`）；`index.ts` 把 `runtimes` map 的 value 从 `OwnerCleanup` 改为 `{ runtime, cleanup }`，以便活动查询拿到 runtime 本身。

#### 6.11.5 机械变更：workspace 依赖范围统一

`packages/subagent` 中的 6 个提供者包（`subagent-acp`、`-claude-code`、`-codex`、`-dsh-sdk`、`-fork-in-process`、`-spawn-in-process`）与 `workflow/workflow`、`workflow/workflow-ptc`、`workflow/tool-ralph` 在本版**只有 `package.json` 变更**，内容是把 `workspace:^` 换成 `workspace:*`（Cordis/vendor/native 换 `workspace:~`）。`subagent-in-process-driver` 多出的 7 行净增来自 `tests/preset-inheritance.spec.ts` 的 import 改名（`@deepseek-ai/dsh-agent-presets` → `@deepseek-ai/dsh-agent-preset-registry`）。

判据：`37372101b5 build: pin internal DSH workspace dependencies`、`4e6028a604 build: use tilde ranges for vendor and native workspaces`，对应规则文档 `.agents/notes/implemented/process/2026-09-22-workspace-release-ranges.md`（**该 Note 不在本区间新增清单里**，说明它是本版发布前的既有规则）。

#### 6.11.6 `agent-team` 的 Session V4 内容接纳（Team 侧）

Team 投影对 mailbox 里的内容块做了收紧与放宽两件事，记录在 `agent-team/README.md` 本版新增的两段：

- **收紧**：原生 V4 的 Team 事件与检查点接纳会**拒绝已退休的 `tool-result` 内容**，使它进不了 mailbox 状态；历史转换属于 Session 格式迁移，Team 投影**不做**旧包装转换。相关提交 `4d9c4e7a12 fix(session): reject retired tool results in V4 Team checkpoints`、`88897a16c6 refactor(session): separate Team opaque JSON preservation from migration`。
- **放宽**：mailbox 投影与检查点接纳**保留**已接纳内容里所有已解码的 JSON 字段（在本地声明的校验器之外），**包括自有 `__proto__` 键**；本地字段检查覆盖 `text`、`reasoning`、`image`、`tool-call`，已接纳的未知标签保持不透明。实现从 `z.object({type: z.string().min(1)}).loose().refine(...)` 改为 `z.custom<ContentBlock>(...)` 直接按引用保留未知 JSON 对象（`projection.ts:60-66`）。相关提交 `1e6630a856 fix(agent-team): preserve opaque JSON through mailbox projections`、`50d38688be docs(agent-team): state the local content validation scope precisely`。
- 检查点版本：Team 投影缓存 **version 4** 会从更早的缓存版本按 Session 日志重建；**Session 格式版本本身未变**（0.1.6 → 0.1.7 区间内 `SESSION_FORMAT_VERSION` 由 3 升到 4 属于 Session 章节，Team 只是这个格式的接纳方之一）。

### 6.12 破坏性与兼容性影响

| 变更 | 影响 | 说明与证据 |
|---|---|---|
| `agent-team-web-profile` 包被删除 | ⚠️ **高** | 仍选择该包的既有 profile **启动即失败**（包解析不到）；bundle 组合不自动改写已保存选择（Note `## Consequences`） |
| Team UI 行从 Web 层迁入主 bundle | ⚠️ 中 | `ui-agent-team` 行的 id 与 `name` 都不变，但承载它的包从 `agent-team-web-profile` 变成 `agent-team-profile`；针对 `ui-agent-team` 的用户 patch 仍然生效 |
| `SubagentRuntime.listChildren` 返回类型变更 | ⚠️ 中 | `Promise<SubagentListEntry[]>` → `Promise<SubagentCatalogEntry[]>`；`kind` 判别只存在于 `listDescendants` 那一侧 |
| `@Remote('list') remoteExportList` 与 `SubagentCatalog` 删除 | ⚠️ 中 | 远程错误码 `subagent/projections-unavailable` 一并删除；Web 侧改读共享投影 |
| `subagent/catalog` 载荷新增 v1 | ⚠️ 低 | **老读取器会拒绝 v1**；`subagentCatalog` 投影 stateVersion 2→3、`subagentTiming` 2→3 会触发缓存重建 |
| `list_agents` 的 `status` 枚举 `running\|idle\|ready` → `running\|inactive` | ⚠️ 中 | 模型可见的 output schema 与工具描述同时变；`ready`/`idle` 的区分消失 |
| Team 工具返回 `target` 而非 `id`+`name` | ⚠️ 中 | `spawn_teammate`、`list_agents` 的输出 schema 变；`interrupt_agent` 的 `previousStatus` 枚举同步收紧 |
| `maxActiveSubagents` 默认 8 生效 | ⚠️ 中 | 第 9 个并发可续期子代理被拒 `ACTIVATION_LIMIT_REACHED`；浏览器消息得 `subagent/delivery-unavailable` |
| `tool-subagent.maxDepth` 默认 3 → 读 Host 设置（默认 1） | ⚠️ 中 | 未显式配置 `maxDepth` 的部署，委托深度从 3 降到 1 |
| `SubagentModelSelectionConfig` 不再注册设置段 | ⚠️ 中 | `SUBAGENT_MODEL_SELECTION_SETTINGS_NAMESPACE` / `…_SCHEMA` 两个导出删除；设置段由组合 + `.volatile()` 提供 |
| `workflow` 输出 schema 变判别式联合 | ⚠️ 中 | 前台成功信封多了 `kind: 'foreground'`；模型可见文本随之变 |
| `workflow` 注册 `JobKindMap.workflow` | ⚠️ 低 | 需要 `ctx.jobs` 与一个服务调用方的控制器；缺失时后台调用报错点名组合件 |
| 归档带活跃提醒的会话被拒 / 停止会删除全部提醒 | ⚠️ 中 | `schedule` 行为变化；反归档**不**恢复 |
| Team 事件不再接纳 `tool-result` 内容 | ⚠️ 低 | 历史转换归 Session 格式迁移；Team 不做旧包装转换 |
| preset 包组拆分（`agent-presets` → `agent-preset` + `agent-preset-registry`） | ⚠️ 中 | subagent 的 peer 依赖名同步变更；组合层的 `name:` 需同步改名（preset 章节详述） |
| 提供者包与 `workflow-ptc` 只有 `package.json` 变更 | ✅ 无 | 版本号 + `workspace:` 范围 |

### 6.13 未核实项

以下条目在本版区间内**未能**用现有证据核实，如实列出：

1. **`agent-team-web-profile` 删除后的官方升级路径**：Note 明确把"兼容处理"排除在本决策之外，且 `## Verification` 自陈测试**不覆盖**升级仍选择该包的 profile。本版**没有**找到任何迁移脚本、启动期改写或错误提示辅助。**未核实**是否存在仓库外的发布说明。
2. **`docs/subsystems/agent-team.md` 的 Web projection 小节是否另有 zh 版本同步**：本文只核对了英文页的 diff（+52 / −28）。`agent-team.zh.md` 是否同步更新**未核实**（i18n 镜像属于文档流水线，不在本任务范围）。
3. **`slots.md` 中 `plugins.bundle.config` / `plugins.bundle.activation` 的归属包**：本文核实到 `docs/subsystems/slots.md` 新增了这三个槽位说明，但**未**逐一核实它们分别由哪个包声明（从命名推断属 `ui-plugin-manager` 家族，**未核实**）。该细节属第 10 篇范围。
4. **`snapshots/session/team-targets/` 的 757 行 `tool-schemas.expected.json` 覆盖了哪几个工具**：只核实到文件存在与行数，**未**逐条比对它钉住的工具清单。
5. **`tool-subagent` 的旧 `subagent-model-selection` 命名空间与新的 `subagent-model-selection-settings` 命名空间是否指向同一份存储**：本版客户端常量从 `'subagent-model-selection'` 改为 `'subagent-model-selection-settings'`，而 Host 侧 `SUBAGENT_MODEL_SELECTION_SETTINGS_NAMESPACE` 被删除。两者是否在设置文档里落到同一路径、旧用户值是否被继承，**未核实**（需要读 `ctx.configForms` / settings 文档的键推导规则，属第 10 篇与 settings 章节）。
6. **`agent-team` 的 Team 投影 `stateVersion: 4` 的 3→4 差异细节**：只核实到版本号变化与"缓存从更早版本按 Session 日志重建"这一句，**未**核实重建过程中的具体字段迁移步骤。
7. **`workflow-ptc` 是否有非 `package.json` 的间接影响**：`git diff --stat` 只显示 `package.json`；但 `tool-workflow` 的后台路径依赖引擎的 `run.result` / `dispose()` 语义未变，这一点**未**通过运行测试验证，只做了静态阅读。
8. **`packages/experimental` 语音族五包**（`api-speech-to-text`、`speech-to-text`、`speech-to-text-sensevoice`、`client-ui-voice-input`、`voice-input-bundle`）：它们在本区间新增且出现在 `packages/experimental/README.md` 的同一处 diff 里，但**不属于**本篇包范围（多智能体），本文不展开，也**未**核实其内容。

### 6.14 可复现的证据命令

```powershell
$r = 'E:\test\rewrite-agently\deepseek-harness'
# 量化基线
git -C $r diff --stat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/subagent packages/workflow packages/schedule packages/experimental
git -C $r log --oneline dsh-v0.1.6-alpha.1..dsh-v0.1.7-rc.1 -- packages/subagent
# T1：single bundle（确认 0.1.6 时两个包并存，web-profile 被删而非改名）
git -C $r ls-tree --name-only dsh-v0.1.6-alpha.1 packages/experimental/ | Select-String 'agent-team'
git -C $r ls-tree --name-only HEAD packages/experimental/ | Select-String 'agent-team'
git -C $r show dsh-v0.1.6-alpha.1:packages/experimental/agent-team-web-profile/cordis.patch.yml
# T2/T3：父目录直读 + 载荷版本
git -C $r diff dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/subagent/subagent/src/catalog.ts packages/subagent/subagent/src/list-children.ts packages/subagent/subagent/src/control-types.ts
git -C $r show HEAD:packages/subagent/subagent/src/catalog.ts | Select-String 'stateVersion|unknownCatalogSchema'
# T5：容量
git -C $r show HEAD:packages/subagent/subagent/src/index.ts | Select-String 'maxActiveSubagents|resolveMaxDepth' -Context 0,3
git -C $r grep -n ACTIVATION_LIMIT_REACHED HEAD -- packages
# T7：workflow 后台
git -C $r diff dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/workflow/tool-workflow/src/index.ts
# T9：ralph 仍关闭 / workflow-ptc 无源码变更
git -C $r show HEAD:packages/bundle/base/cordis.patch.yml | Select-String 'tool-ralph' -Context 0,4
git -C $r diff --stat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/workflow/workflow-ptc packages/workflow/tool-ralph
# 文档落差：schedule.md / workflow.md 在本版未变
git -C $r diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- docs/subsystems/schedule.md docs/subsystems/workflow.md
```

---

## 附录：本版提交索引

### A.1 本篇相关的关键提交（按主题分组）

**已核实日期与规模的提交**（逐条 `git show --no-patch --format='%h %ad %s'` + `git show --stat`）：

| commit | 日期 | 标题 | 规模 | 主题 |
|---|---|---|---|---|
| `9f21d7842a` | 2026-09-17 | `fix(agent-team): enable tools and Web UI with one bundle` | 52 文件，+130/−434 | T1 |
| `e55093b47d` | 2026-09-16 | `feat(subagent): migrate direct catalog consumers to parent projections` | 208 文件，+2394/−2929 | T2 |
| `a9985b49ae` | 2026-09-19 | `fix(session): migrate historical subagents only when opened` | 143 文件，+607/−680 | T3 |
| `f984683956` | 2026-09-20 | `fix(subagent): store unknown mode in the existing catalog event` | 43 文件，+635/−696 | T3 |
| `a978ad1994` | 2026-09-20 | `fix(subagent): version unknown catalog payloads locally` | 38 文件，+1047/−584 | T3 |
| `507e0e6dfe` | 2026-09-15 | `fix: expose Team targets and simplify model agent statuses` | 83 文件，+1316/−271 | T4 |
| `b9e59cbaee` | 2026-09-15 | `refactor: unify Team availability in the service` | 25 文件，+63/−64 | T4 |
| `16620a3a70` | 2026-09-15 | `feat(subagent): cap live continuable activations per root at 16` | 31 文件，+1351/−23 | T5 |
| `d7f9d3a773` | 2026-09-16 | `fix(subagent): default to eight live continuable children` | 11 文件，+17/−17 | T5 |
| `0eed02d447` | 2026-09-16 | `fix(subagent): map capacity refusal and clarify one-shot scope` | 19 文件，+29/−24 | T5 |
| `845115d0f8` | 2026-09-16 | `feat(subagent): edit delegation limits in plugin settings` | 46 文件，+610/−75 | T5 |
| `a69bcf3636` | 2026-09-16 | `feat(subagent): own editable delegation limits in the backend` | 34 文件，+223/−60 | T5 |
| `04a3c30a04` | 2026-09-17 | `fix(subagent): default delegation depth to one` | 13 文件，+22/−22 | T5 |
| `ea2651b86b` | 2026-09-16 | `feat(web): unify Subagent settings UI` | 30 文件，+802/−282 | T6.3 |
| `d1e22a7e24` | 2026-09-21 | `feat(preset): declare Agent compositions in profile YAML (#4569)` | 294 文件，+4107/−11908 | T6.1 |
| `601d6761e4` | 2026-09-21 | `feat(settings): project volatile Config through profile-backed forms (#4587)` | 498 文件，+5950/−9349 | T6.2 |
| `12957a106e` | 2026-09-01 | `feat(workflow): run_in_background registers the run as an observed job` | 168 文件，+1065/−357 | T7 |
| `cbae324bfa` | 2026-09-21 | `feat(workspace): stop a Session's running work before archiving it (#4765)` | 109 文件，+2763/−300 | T8 |
| `1dc518f217` | 2026-09-21 | `feat(agent-team): drive the Web Team panel from the agentTeam projection` | 29 文件，+773/−615 | §6.11.1 |
| `df7fa8945c` | 2026-09-23 | `refactor(agent-team): narrow projection fields and task views` | 19 文件，+49/−69 | §6.11.1 |

**同族提交**（短哈希与标题取自 `git log --oneline`；日期与规模**未**逐条核实）：

- **T1 / T3（bundle 与历史迁移）**：`19e6e7b81b` verify browser activation and document bundle composition；`bc0ecae21f` ship optional bundles switched off and guide the install dialog；`17a52a8fe3` retain unreadable children in migrated catalogs；`f44b78a622` complete parent catalogs while isolating child failures
- **T4（Team target 与词汇措辞）**：`cda99db4c0` align remaining agent availability prose；`6ec97fa124` tell teammates how to message the lead；`a79e3a2a5f` explain teammate discovery and messaging；`d257fa4af7` limit the reminder to the lead identity
- **T5 / T6（容量与设置合流）**：`2d94201ef1` merge: integrate subagent capacity settings into session-log-v4；`fae11e6dc1` Merge master into PR 4317 and adapt Subagent configuration page
- **T7（后台运行收尾）**：`b0cf8cc1d9` narrate background runs on the log channel；`58d4050cb6` state why the background branch has no pre-abort check；`8537b8d5bb` produce into the job record instead of ctx.activities；`4a79310339` optional live-output observation seam with a web viewer
- **§6.11.1（Team 面板投影化）**：`2aa3a469db` consume shared projections without panel loads；`843e1b97af` scope projection reads and address review feedback；`d08aac9db2` read current projections through standard hooks；`749f05e9fa` refresh projections when opening the panel；`700b636508` limit baseline loading fix to the panel；`3bf6d738f1` keep late activation on normal reconnect path；`9095678c8c` address remaining projection review comments
- **§6.11.6（V4 Team 内容接纳）**：`1e6630a856` preserve opaque JSON through mailbox projections；`4d9c4e7a12` reject retired tool results in V4 Team checkpoints；`88897a16c6` separate Team opaque JSON preservation from migration
- **§6.11.4 / §6.11.5（清理与机械变更）**：`580bdc7258` remove redundant unknown casts；`37372101b5` pin internal DSH workspace dependencies；`4e6028a604` use tilde ranges for vendor and native workspaces
- **GUI（第 10 篇范围）**：`2b44a4b657` preserve Team hover pinning and responsive task expansion；`86e3e0e448` refine the Team header panel interactions and adaptive header；`2ea753960c` align Team card elevation and preset header expectations

所有哈希均可由 `git -C $r show <hash>` 复核。
### A.2 本版区间内与本篇相关的 release / 汇总提交

| commit | 标题 |
|---|---|
| `a60af51e80` | `release(dsh): 0.1.7-rc.1` |
| `10ea83bcc3` | `release(dsh): 0.1.7-alpha.2` |
| `112ce776ac` | `release(dsh): 0.1.7-alpha.1` |
| `6b1808f432` | `release(dsh): 0.1.6-alpha.2` |

### A.3 本版新增 / 删除文件清单（本篇范围）

**新增**

| 路径 | 规模 | 说明 |
|---|---|---|
| `packages/subagent/subagent/src/archive-admission.ts` | 90 行 | subagent 家族的归档准入 |
| `packages/subagent/subagent/tests/archive-admission.spec.ts` | 182 行 | 上述的单元覆盖 |
| `packages/workflow/tool-workflow/src/record.ts` | 64 行 | 后台 run 的活进度镜像 |
| `packages/experimental/agent-team/src/task-view.ts` | 62 行 | 任务视图的纯派生（任务板 + 客户端投影共用） |
| `packages/experimental/agent-team-profile/icon.svg` | 12 行 | 插件页图标（`package.json.icon`） |
| `packages/experimental/agent-team-profile/locale/{en,zh}.json` | 6 行各 | bundle 文案 |
| `snapshots/sdk/subagent-activation-limit/` | 8 文件 | 容量的 keyless 录制证据（含 `system-prompt.1.expected.md` 与 `tool-schemas.1.expected.json`） |
| `snapshots/session/team-targets/` | 6 文件 | Team target 词汇的模型输出固定（含 757 行 `tool-schemas.expected.json`） |

**删除**

| 路径 | 规模 |
|---|---|
| `packages/experimental/agent-team-web-profile/` | 8 文件，−303 行 |
| `packages/preset/agent-presets/`（preset 章节） | 见 §6.7.1 |

### A.4 与本篇相关的被改动文档

| 文档 | 区间改动 |
|---|---|
| `docs/subsystems/subagent.md` | +27 / −38（762 行 @ rc.1） |
| `docs/subsystems/agent-team.md` | +52 / −28（231 行 @ rc.1） |
| `docs/subsystems/slots.md` | +25 / −12 |
| `docs/subsystems/workflow.md` | **无改动**（277 行） |
| `docs/subsystems/schedule.md` | **无改动**（192 行） |
| `packages/subagent/subagent/README.md` | +21 / −6（新增"Delegation settings"与"Continuable capacity"两节） |
| `packages/workflow/tool-workflow/README.md` | +21 / −8（新增"Background runs"与"Background lifecycle"两节） |
| `packages/experimental/agent-team/README.md` | +14 / −6（新增浏览器投影节、整视图广播限制） |
| `packages/experimental/agent-team-profile/README.md` | +17 / −5（改为单 bundle 叙述 + 升级手工修法） |
| `packages/schedule/schedule/README.md` | +3 / −1（归档语义一句） |
| `packages/experimental/README.md` | +6 / −2（表格增删） |

---

*文档生成时间: 2026-09-25*
*数据源: dsh-v0.1.7-rc.1 (46a7f68b09) vs dsh-v0.1.6-alpha.1 (0a15e36e7f)*
