# 【第 02 篇】packages/core/：产品主干（agent · session · tools · system-prompt · scope）

> **基线说明**：本篇为 v0.1.7-rc.1 全量分析基线，rc.2 未改动本篇覆盖的系统性结构。v0.1.7-rc.2 的增量变更（约 335 个提交）请见同目录 `README.md` 与 `diff-vs-0.1.7-rc.1.md`。

> **版本**：dsh-v0.1.7-rc.1（`46a7f68b09`），对比上版 dsh-v0.1.6-alpha.1（`0a15e36e7f`）
> 难度：🟡 进阶（建议先读 v0.1.6-alpha.1 的第 02 篇与 `docs/architecture.md`）
> 包范围：`deepseek-harness/packages/core/` 下 8 个包（agent、agent-loop、session、tools、system-prompt、scope、agent-default-model、agent-tool-presentation）
> 上游文档：`docs/subsystems/core.md`、`docs/subsystems/session.md`、`docs/subsystems/tools.md`、`docs/subsystems/conversation.md`、`docs/tool-execution-pipeline.md`、`docs/event-producer-consumer.md`
> 相关 note：`2026-09-15-first-class-tool-role-messages.md`、`2026-09-17-developer-session-changes.md`、`2026-09-17-native-v4-read-validation.md`、`2026-09-09-producer-owned-message-sources.md`、`2026-09-18-volatile-config-references.md`、`2026-09-21-archive-stops-running-session-work.md`、`2026-08-18-arbitrary-seq-session-fork.md`、`2026-09-21-conversation-build-groups.md`、`2026-09-22-tool-call-three-phases.md`

## 目录

- [引言](#引言)
- [概述](#概述)
- [核心概念](#核心概念)
- [包结构](#包结构)
- [关键类型](#关键类型)
- [数据流](#数据流)
- [测试覆盖](#测试覆盖)
- [与上游/下游的关系](#与上下游的关系)
- [本版本变更要点（0.1.6-alpha.1 → 0.1.7-rc.1）](#本版本变更要点016-alpha1--017-rc1)
- [附录：本版核心包提交索引](#附录本版核心包提交索引)

---

## 引言

本文覆盖 `deepseek-harness/packages/core/`：它是**每个组合都必须启动的主干**（官方表述 "the packages every composition boots"，见 `docs/subsystems/core.md` 标题段）。本版区间内 `packages/core` 的改动规模（`git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/core` 实测）：

```
91 files changed, 2134 insertions(+), 1038 deletions(-)
```

按文件性质拆分（同一命令的 `--name-only` 结果按路径过滤实测）：

| 文件类别 | 数量 | 说明 |
|---|---|---|
| `*/src/**` | 23 | 生产源码 |
| `*/tests/**` | 39 | 测试与 fixture |
| 其余（`package.json` / `README*` / `tsconfig.json`） | 29 | 清单、契约文档、编译面 |

新增文件 4 个、删除文件 0 个（`git diff --name-status` 实测）：

- `packages/core/agent/src/archive-admission.ts`（新增）
- `packages/core/agent/tests/archive-admission.spec.ts`（新增）
- `packages/core/session/src/fork.ts`（新增）
- `packages/core/session/tests/developer-header.spec.ts`（新增）

区间内 `packages/core` 的提交数：**68**（`git log --oneline dsh-v0.1.6-alpha.1..dsh-v0.1.7-rc.1 -- packages/core` 实测行数），其中含大量 merge 提交；附录列出全量清单。

本版已确认的坐标：

| 项 | 值 | 证据 |
|---|---|---|
| 本版 tag | `dsh-v0.1.7-rc.1` = `46a7f68b09`（2026-09-23） | BRIEF §1（已核实，不重复推导） |
| 上版 tag | `dsh-v0.1.6-alpha.1` = `0a15e36e7f`（2026-09-15） | BRIEF §1 |
| 8 个包版本号 | 全部 `0.1.6-alpha.1` → `0.1.7-rc.1` | 各包 `package.json` diff（例如 `packages/core/scope/package.json`） |
| `SESSION_FORMAT_VERSION` | **3 → 4** | `packages/core/session/src/types.ts:89`（`= 4`）；旧值见 `git show dsh-v0.1.6-alpha.1:packages/core/session/src/types.ts` 的 `= 3` |

一句话概括本版 Core 的三个主题：

1. **表示层换代**——会话格式 V4 落地：`tool/result` 从「user 角色里的 `tool-result` 内容块」变成一等 `role: 'tool'` 消息，消息 source 从合成的 `{ kind: 'plugin', plugin: … }` 包装换成生产者自有的 `kind`；
2. **语义放宽**——fork 从「只允许在已关闭 turn 边界切」变成「任意精确事件前缀 + 合成收尾」（新增 `forked` turn 结束原因）；`developer/message` 以历史 `request/header` 为工具定义权威；
3. **所有权收敛**——inbox 投影注册从 `ReactLoopInbox` 构造器上移到 `AgentLoop` 服务；`agent-loop` / `agent-default-model` 的 settings 段被 volatile Config 引用取代；`agent` 包接管 Workspace 归档准入。

---

## 概述

`packages/core/` 提供 Agent 的四个面：

- **记忆**：`session` 的追加式事件日志（append-only event log）是唯一真相源（single source of truth）；模型历史由 `deriveMessages()` 派生，不另存消息数组。
- **手脚**：`tools` 是工具调用的唯一入口，调用必经守卫管线（guard pipeline）；本版在管线中插入了一个新的定义方阶段 `projectContent`。
- **大脑**：`agent` 声明 `Agent` 接口与注册表，`agent-loop` 是其唯一默认实现，驱动一次 turn 的完整编排。
- **外壳**：`scope` 提供作用域基元（scoped dispatch / scoped effects），`system-prompt` 负责请求前缀与工具 schema 的组装，`agent-default-model` 与 `agent-tool-presentation` 是较小的默认值 / 呈现包。

本版 Core 的三条主线可以再拆成七项可核实的变化（详见「本版本变更要点」）：

1. `tool/result` 的持久化表示与角色映射改为一等 tool role；
2. `MessageSourceMap` 取代合成的 `plugin` 包装 kind；
3. `system/message` 的 source 从 `{kind:'plugin', plugin:…}` 收紧为 `kind: 'system-prompt'`；
4. 新增 `developer/message` 事件与 `ToolSchema.deferLoading` / `ToolAdditionBlock` 表示；
5. fork 放宽为精确前缀切分，新增 `forked` 结束原因与 `buildForkSeed`；
6. `Session.firstLifecycleSeq` 新增，`session/end-seed` 的写入者扩大到 `buildForkSeed`；
7. 配置层 volatile 化、inbox 投影归属上移、归档准入能力缝接入 `agent` 包。

### 关于本版三篇重点 note 的包归属（重要边界澄清）

任务要求「逐一核实并展开」的三篇 note 中，**有两篇的决策与实现完全落在 client 侧，`packages/core` 内没有对应代码改动**。这一点经实测确认，不是省略：

| note | 实现位置 | `packages/core` 内是否有对应改动 | 核实方式 |
|---|---|---|---|
| `2026-09-22-tool-call-three-phases.md` | `packages/client/ui-chat/src/client/conversation-nodes/tool.ts`、`packages/client/ui-conversation/src/client/contract/records.ts` | **无**（`preparing` 在 `packages/core` 全树只命中两处无关测试字符串 `'cancelled while preparing'`） | `grep -r "preparing" packages/core` 实测 |
| `2026-09-21-conversation-build-groups.md` | `packages/client/ui-conversation/src/client/contract/groups.ts` 等 | **无**（簇的创建「adds neither Session events nor an execution lifecycle」，note 原文） | note 正文 + `docs/subsystems/conversation.md` 新节 |
| `2026-09-15-first-class-tool-role-messages.md` | `packages/core/session` + `packages/llm/llm` + `packages/session/session-format-v3-to-v4` | **有**（`SESSION_FORMAT_VERSION` 3→4、角色映射、source 校验、合成结果构造） | 见「关键类型」与「本版本变更要点」 |

因此本文对前两篇的处理方式是：**给出 core 侧的接口边界与不变量**（core 提供了什么、没有提供什么），把实现细节标注为「本包范围外」并给出文件路径，而不是编造 core 内的对应改动。

---

## 核心概念

| 术语（首次出现附英文） | 含义 | 本版是否受影响 |
|---|---|---|
| turn / step | turn 是一次完整交互轮；step 是轮内一次「模型请求 + 其触发的工具执行」 | 未变 |
| 事件溯源（event sourcing） | 一切状态由追加日志派生，无第二份真相 | 未变 |
| surface（模型可见面） | 由 `surfaceOp` 折叠出的消息节点序列 | **扩展**：`developer/message` 加入 |
| `SurfaceEventType` | 能进入模型可见面的消息型事件子集 | **4 类 → 5 类** |
| `MessageRoleMap` | 持久化会话消息按 role 的封闭映射 | **5 个 role，`tool` 为一等** |
| `MessageSourceMap` | 消息来源的可合并扩展（merge-extensible）映射；每个生产者在自己的模块里声明 `kind` | **取代 `plugin` 包装** |
| 生产者自有来源（producer-owned source） | `kind` 直接标识生产者，保留上下文形态字段 | **本版新增语义** |
| `developer/message` | 按会话顺序记录的增量 agent 会话变更（当前为工具增删） | **本版新增事件** |
| `headerSeq` | `developer/message` 指向更早 `request/header` 的引用，作为工具添加的 schema 权威 | **本版新增** |
| `deferLoading` | `ToolSchema` 上的「延迟加载定义」标记，与工具添加记录相互独立 | **本版新增** |
| `projectContent` | 工具定义方在 `tools/post-execute` 之前安装「执行期准备好的内容」的回调 | **本版新增阶段** |
| volatile 配置引用（volatile config reference） | schemastery `.volatile()` 声明的稳定引用，指向不可变快照；只改 volatile 字段不重挂插件 | **本版引入 core 消费方** |
| 归档准入（archive admission） | Workspace 注册表在隐藏 Session 前询问「还有什么在跑」，并要求其停止的能力缝 | **本版接入 `agent`** |
| inbox 投影（inbox projection） | 把 `agent/inbox/spliced` 折叠为待处理输入的纯投影 | **注册所有权上移** |
| token 预算内的多模态保留（multimodal retention） | 在 token 预算内按序保留工具文本与图像 | 与 core 有关（`tool/result` 承载图像），**细节归第 06 篇** |

---

## 包结构

`packages/core/` 在 `dsh-v0.1.7-rc.1` 下为 8 个包（`Get-ChildItem packages\core -Directory` 实测）。下表「本版改动规模」全部来自 `git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/core/<pkg>` 的逐包实测值：

| 包 | 职责 | 文件数 | +行 | -行 |
|---|---|---|---|---|
| `agent` | `Agent` 接口、`AgentRegistry`、`agent/*` 事件、模型选择安装、消费工作折叠、**归档准入** | 12 | 199 | 35 |
| `agent-loop` | 默认循环实现（`ReactLoopAgent`）、inbox、runtime-context 投影、工具调用调度 | 29 | 616 | 394 |
| `session` | `Session`、`SessionStore`、事件类型表、surface 折叠、repair/fork | 21 | 971 | 314 |
| `tools` | 工具注册表与执行管线、PTC 传输、schema 定义 | 11 | 216 | 81 |
| `system-prompt` | prompt 分段组装与 `{{variable}}` 插值 | 3 | 13 | 13 |
| `scope` | 作用域事件与 scoped dispatch | 2 | 6 | 6 |
| `agent-default-model` | 默认模型选择（本版改为 volatile Config + configEditor） | 7 | 92 | 174 |
| `agent-tool-presentation` | 工具呈现默认值 | 6 | 21 | 21 |
| **合计** | | **91** | **2134** | **1038** |

逐包要点（均来自本文实测的 `git diff`）：

- **`session`（+971/-314，最大绝对改动）**：`src/types.ts` 49 行、`src/index.ts` 133 行、`src/surface.ts` 92 行、`src/repair.ts` 88 行、`src/fork.ts` 新增 30 行、`src/invariant.ts` 6 行、`src/known-event-types.ts` 2 行；测试侧 `tests/fork.spec.ts` 296 行、`tests/repair.spec.ts` 149 行、`tests/developer-header.spec.ts` 新增 109 行、`tests/surface.spec.ts` 87 行。
- **`agent-loop`（+616/-394）**：`src/index.ts` 70 行、`src/agent.ts` 37 行、`src/runtime-context.ts` 21 行、`src/inbox.ts` 7 行、`src/tool-calls.ts` 2 行；测试侧 `tests/contract-regressions.spec.ts` 197 行、`tests/settings.spec.ts` 105 行、`tests/cancel.spec.ts` 99 行、`tests/loop.spec.ts` 93 行、`tests/interception.spec.ts` 70 行。
- **`tools`（+216/-81）**：`src/index.ts` 32 行、`src/schema.ts` 19 行、`src/ptc.ts` 9 行；测试侧 `tests/tools.spec.ts` 133 行。
- **`agent`（+199/-35）**：`src/archive-admission.ts` 新增 38 行、`src/index.ts` 13 行、`src/model-selection.ts` 11 行、`src/consumed-work.ts` 9 行、`src/types.ts` 9 行；测试侧 `tests/archive-admission.spec.ts` 新增 92 行。
- **`agent-default-model`（+92/-174，唯一净删除包）**：删除了整套 settings 命名空间 / schema / 存储类型，改为 volatile Config 引用。
- **`system-prompt`（+13/-13）**：仅两处——移除 `TOOL_CORDIS` 段位、schema 投影透传 `deferLoading`。
- **`scope`（+6/-6）**：仅 `package.json` 依赖范围改写（`workspace:^` → `workspace:*` / `workspace:~`）与一处测试里的 `as unknown as` 清理，**无生产语义改动**。
- **`agent-tool-presentation`（+21/-21）**：仅一处注释中的包名更正（`dsh-agent-presets` → `dsh-agent-preset-registry`）与版本号。

### 生产源码逐文件清单（23 个文件，`git diff --stat` 实测）

下表「改动行数」取自 `git diff --stat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/core` 的该文件列（增 + 删合计）；「性质」列区分新增文件与既有文件改写。23 个文件全部列出，无省略：

| 包 | 文件 | 改动行数 | 性质 |
|---|---|---|---|
| `agent` | `src/archive-admission.ts` | 38 | **新增** |
| `agent` | `src/index.ts` | 13 | 改写（安装归档准入） |
| `agent` | `src/model-selection.ts` | 11 | 改写（source kind） |
| `agent` | `src/consumed-work.ts` | 9 | 改写（`forked` 注释） |
| `agent` | `src/types.ts` | 9 | 改写（`SessionActivityKindMap` 合并声明） |
| `agent-loop` | `src/index.ts` | 70 | 改写（inbox 注册、volatile Config、删 settings） |
| `agent-loop` | `src/agent.ts` | 37 | 改写（`abortedCancelCause`） |
| `agent-loop` | `src/runtime-context.ts` | 21 | 改写（`runtime-context` source） |
| `agent-loop` | `src/inbox.ts` | 7 | 改写（构造器不再注册投影） |
| `agent-loop` | `src/tool-calls.ts` | 2 | 改写（读 volatile 引用） |
| `session` | `src/index.ts` | 133 | 改写（角色映射、消息形状校验、fork、`firstLifecycleSeq`） |
| `session` | `src/surface.ts` | 92 | 改写（`developer/message` 校验、tool-result 替换等价性、error 位置） |
| `session` | `src/repair.ts` | 88 | 改写（cause 参数化、一等 tool role 合成结果） |
| `session` | `src/types.ts` | 49 | 改写（版本号、`developer/message`、`forked`、`system?: never`） |
| `session` | `src/fork.ts` | 30 | **新增** |
| `session` | `src/invariant.ts` | 6 | 改写（`developer/message` 开 step 约束、`isError` 位置） |
| `session` | `src/known-event-types.ts` | 2 | 改写（新增两个已知事件类型） |
| `tools` | `src/index.ts` | 32 | 改写（`projectContent` 阶段、`deferLoading` 白名单） |
| `tools` | `src/schema.ts` | 19 | 改写（`defineTool` 两个新选项） |
| `tools` | `src/ptc.ts` | 9 | 改写（`ptc-mode` source） |
| `agent-default-model` | `src/index.ts` | 82 | 改写（settings → volatile Config + configEditor） |
| `system-prompt` | `src/index.ts` | 4 | 改写（删 `TOOL_CORDIS` 段位、透传 `deferLoading`） |
| `agent-tool-presentation` | `src/index.ts` | 2 | 改写（注释包名） |

**`packages/core/scope` 在 `src/` 下没有任何改动**——该包的 2 个改动文件是 `package.json`（依赖范围）与 `tests/scope.spec.ts`（`as unknown as` 清理），与 AGENTS.md 的 `no-unknown-casts` 规则同批落地。这一点值得单独记录：本版 `scope` 虽被列入 core 的 8 包范围，但**生产语义零变更**。

四类「新增文件」的职责一句话概括：

| 新增文件 | 职责 |
|---|---|
| `packages/core/session/src/fork.ts` | `buildForkSeed(events, boundary)`：复制精确前缀、放置 inherited 标记、追加 `forked` 收尾 |
| `packages/core/session/tests/developer-header.spec.ts` | `headerSeq` 历史 header 绑定的正例与拒绝用例 |
| `packages/core/agent/src/archive-admission.ts` | `installTurnArchiveAdmission`：`turn` 家族申报 + user-cause 取消 |
| `packages/core/agent/tests/archive-admission.spec.ts` | 上述行为的行为断言 |

---

## 关键类型

### 片段 A：消息表示——一等 tool role（`packages/llm/llm/src/message.ts`）

本版把「一条共享 `Message` + 角色特化」重构为「共享 `MessageBase` + 封闭的 `MessageRoleMap`」：

```ts
// packages/llm/llm/src/message.ts

/** Where a message (or injected content) came from, in the harness's own
 * vocabulary. Merge-extensible sum type — each producer declares its own
 * `kind` in its own module; there is no shared catch-all `plugin` kind. */
export interface MessageSourceMap {          // :110
  user: { kind: 'user' }
  model: ModelMessageSource
  tool: ToolMessageSource
  'system-prompt': SystemPromptMessageSource
}

/** Shared immutable fields of every conversation message. */
interface MessageBase {                       // :139
  readonly id: MessageId
  readonly content: readonly ContentBlock[]
  /** @persistenceSource user developer */
  readonly source: MessageSource
}

export interface SystemMessage extends MessageBase { readonly role: 'system'; … }      // :151
export interface DeveloperMessage extends MessageBase { readonly role: 'developer' }   // :157
export interface UserMessage extends MessageBase { readonly role: 'user' }             // :162
export interface AssistantMessage extends MessageBase { readonly role: 'assistant'; … }// :167

/** A first-class tool-role message carrying the result of one tool invocation. */
export interface ToolResultMessage extends MessageBase {   // :173
  readonly role: 'tool'
  readonly source: ToolMessageSource
  readonly toolCallId: ToolCallId    // :177
  readonly isError?: boolean         // :179
}

export interface MessageRoleMap {   // :187 —— 封闭：每个模型可见 role 必须有持久化事件与适配器投影
  system: SystemMessage
  developer: DeveloperMessage
  user: UserMessage
  assistant: AssistantMessage
  tool: ToolResultMessage
}
export type Message = MessageRoleMap[keyof MessageRoleMap]   // :196
```

关键点：`isError` 与 `toolCallId` 从内容块（`content[0].isError` / `content[0].toolCallId`）上移到消息顶层。旧形态可由 `docs/subsystems/session.md` 的本版 diff 直接对照：`interface UserMessage extends Message` → `interface UserMessage extends MessageBase`。

### 片段 B：`SurfaceEventType`——4 类扩为 5 类（`packages/core/session/src/types.ts`）

```ts
// packages/core/session/src/types.ts:441 起（联合内 'developer/message' 位于 :441）
export type SurfaceEventType =
  | 'system/message'
  | 'developer/message'    // :441 本版新增
  | 'user/message'
  | 'assistant/message'
  | 'tool/result'
```

运行时白名单与类型同步扩展：`packages/core/session/src/surface.ts:52` 把 `'developer/message'` 加入 `SURFACE_EVENT_TYPES`；`deriveEventMessage()`（`surface.ts:145`）把 `developer/message` 与 `system/message`、`assistant/message` 归为「空内容则投影为 no message」的一类。角色映射表实测：

```ts
// packages/core/session/src/index.ts:325
const MESSAGE_ROLE_BY_TYPE: Record<SurfaceEventType, Message['role']> = {
  'system/message': 'system',
  'developer/message': 'developer',   // :327
  'user/message': 'user',
  'assistant/message': 'assistant',
  'tool/result': 'tool',              // :330 —— 上版此处为 'user'
}
```

`git show dsh-v0.1.6-alpha.1:packages/core/session/src/index.ts` 实测旧值为 `'tool/result': 'user'`。旧版校验要求 `content.length === 1` 且 `content[0].type === 'tool-result'` 且 `content[0].toolCallId === source.callId`；本版只剩最后一条等式，改为读消息顶层字段（`packages/core/session/src/index.ts` 的 `assertMessageEventShape`）。

### 片段 C：`tool/result` 事件与合成 fork 结果（`packages/core/session/src/repair.ts`）

```ts
// packages/core/session/src/repair.ts

/** Why an open tail turn is closed: `interrupted` 是崩溃恢复，`forked` 是 fork 在源 turn 内切分。 */
export type OpenTurnCloseCause = { readonly kind: 'interrupted' } | { readonly kind: 'forked' }  // :32

/** 合成错误工具结果的模型可见措辞，按 cause 分派。 */
const CLOSER_TEXT = { interrupted: { started, notStarted }, forked: { started, notStarted } } as const  // :35

export function openTurnClosers(events, cause: OpenTurnCloseCause): SessionEvent[]   // :63
    // 合成 message 现在是一等 tool role：
    //   id: `${cause.kind}-tool-result-${callId}-${seq}`   （上版前缀为 `interrupted-tool-result-`）
    //   role: 'tool'                                        // :131
    //   toolCallId: callId, isError: true
    //   content: [{ type: 'text', text }]                   （上版为 [{ type:'tool-result', … }] 包装）
    // 末尾追加 turn/end，reason 为 { kind: cause.kind }

/** 崩溃恢复入口：只由持久化路径调用。 */
export function interruptedTurnClosers(events): SessionEvent[]   // :175 → openTurnClosers(events, { kind: 'interrupted' })
```

`repair.ts` 的模块头注释也重写了：从「崩溃恢复」扩展为「两个生产者共享同一机制」——崩溃恢复关闭被中断的持久化日志，fork seed 构造关闭切在源 open turn 内的前缀。

### 片段 D：`developer/message`（`packages/core/session/src/types.ts:311`）

```ts
// packages/core/session/src/types.ts
'developer/message': {                       // :311
  turn: number
  step: number
  message: DeveloperMessage                  // :314
  /** Earlier request/header defining every tool addition; required exactly when additions are present. */
  headerSeq?: SessionSeq
}
```

配套约束分散在三处，均为实测：

- **事件级校验**（`packages/core/session/src/surface.ts:180-201`）：`developer/message` 与 `role === 'developer'` 必须同时出现；`tool-addition` / `tool-removal` 内容块只允许出现在 developer 角色；`tool-addition` 必须带非空 `toolName` 且禁止内联 `tool` 定义；`headerSeq` 的存在性必须与「是否存在 addition」精确一致。
- **跨事件引用校验**（`packages/core/session/src/surface.ts:374` `assertDeveloperHeader`，调用点 `:528`）：`headerSeq` 必须指向更早的 `request/header`（`headerSeq >= event.seq` 或非 header 事件即抛错），且每个 addition 的 `toolName` 在该 header 的 `tools` 里必须恰好命中 1 个定义，该定义需有字符串 `description` 与对象 `parameters`，若带 `deferLoading` 则必须为 `true`。
- **不变量companion**（`packages/core/session/src/invariant.ts:107`）：`developer/message` 必须落在已打开的 step 内（`requireOpenStep`）。

对应的设计记录是 `2026-09-17-developer-session-changes.md`；持久化契约是 `docs/persistence-changes/2026-09-16-session-format-v4.md`（其 Declaration 列为 `event:developer/message`，`previous: null`）。

### 片段 E：`EpochHeader.system` 退役键保留（`packages/core/session/src/types.ts:248`）

```ts
// packages/core/session/src/types.ts
  /** Retired request text; system prompts belong to system/message events.
   * @persistenceReserved
   */
  system?: never              // :250
```

以 `never` 形式保留旧键，是为了让「未来允许取值」构成一次禁止字段的变更（需要格式版本号跃迁），而不是一次普通的可选字段追加。`2026-09-17-native-v4-read-validation.md` 与 `docs/persistence-changes/2026-09-16-session-format-v4.md` 均记录了这一意图；本版 `docs/session-format-status.md` 的 diff 也新增了 Finalization record（`latestFinalizedVersion: 4`）。

### 片段 F：fork 与 `firstLifecycleSeq`（`packages/core/session/src/fork.ts`、`src/index.ts`）

新增的 `fork.ts` 全文 30 行，核心是两个动作：

```ts
// packages/core/session/src/fork.ts
export function buildForkSeed(events: readonly SessionEvent[], boundary: SessionSeqType): SessionEvent[] {
  const prefix = events.slice(0, boundary + 1)
  prefix.push({
    type: 'session/end-seed', seq: SessionSeq(boundary + 1),
    time: events[boundary]!.time,
    data: { inherited: true },
  })
  return prefix.concat(openTurnClosers(prefix, { kind: 'forked' }))
}
```

即：**先**在继承切点放 `session/end-seed { inherited: true }` 标记，**再**追加合成的 fork 收尾事件——标记不在日志末尾，这一点被 `session/end-seed` 的 JSDoc 与 `Session` 构造器共同承认。

`SessionStore.fork()` 相应改写（`packages/core/session/src/index.ts:1245`）：`inheritedEventCount` 现在只计「复制的源事件数」（`resolved + 1`），不含合成收尾；`SessionForkErrorCode` 中 **`'OPEN_TURN'` 被删除**（上版 5 个错误码，本版 4 个）。

新增字段：

```ts
// packages/core/session/src/index.ts
readonly firstLifecycleSeq: SessionLogOffset        // :492
// :612 赋值：mode === 'snapshot' && header.isSeeded ? inheritedEventCount : firstLiveSeq
```

语义是「**为这个对象生命周期产生的第一个事件**」：新 fork 包含自己的 seed 标记与收尾事件，恢复的 Session 从完整已存前缀之后开始。它与既有的 `firstLiveSeq`（构造器 seed 长度）在本版必然不同——因为 seed 里已经预置了子代自有事件。实测的下游消费者是 `packages/session/session-telemetry/src/coordinator.ts:152`：`const start = session.firstLifecycleSeq`，用作遥测交付游标。

`session/end-seed` 的合法写入者因此从「仅 `Session` 构造器」扩大为「`Session` 构造器与 `buildForkSeed`」（`types.ts:404-410` 注释、`docs/subsystems/session.md:733`）。

### 片段 G：工具定义的 `projectContent` 与 `deferLoading`（`packages/core/tools`）

```ts
// packages/core/tools/src/index.ts
export interface ToolDefinition extends ToolSchema {
  execute(args: unknown, exec: ToolRunContext): Promise<unknown>
  /** Install execution-prepared content before `tools/post-execute` policies. … */
  projectContent?(exec: Readonly<ToolExecution>, result: Readonly<ToolExecutionResult>): ContentBlock[] | undefined   // :246
  finalizeContent?(…)                        // 既有：最后一公里内容变换
}
```

实现侧（同文件）：`contentProjectors` WeakMap（`:831`）在调用开始时快照回调（`:1436` 捕获、`:1447` 写入，`collapsed` 调用不装投影），并在 `finalizeScheduledExecution()` 里于 `postExecute` **之前**执行一次（`:1642-1643`）：

```ts
const project = this.contentProjectors.get(exec)
this.contentProjectors.delete(exec)
const content = project?.(exec, result)
const projected = content === undefined ? result : this.markCanonical(exec, this.materializeFinalResult({ ...result, content }))
const postResult = await this.postExecute(exec, projected)
```

`defineTool()` 侧新增两个选项（`packages/core/tools/src/schema.ts`）：`deferLoading?: true`（`:499-500`）、`projectContent?`（`:522`），并在构造结果上透传（`:595` 的 `deferLoading`、`:603-604` 的 `tool.projectContent`）。

schema 投影是显式白名单，`deferLoading` 现在被允许进入模型面：

```ts
// packages/core/tools/src/index.ts:1282
const { name, description, parameters, deferLoading } = definition
…
  ...deferLoading === true ? { deferLoading } : {},     // :1291
```

类型定义在 `packages/llm/llm/src/types.ts:461`（`ToolSchema`）与 `:467`（`deferLoading?: true`）。`system-prompt` 组装时同样透传（`packages/core/system-prompt/src/index.ts:586`、`:590`），确保「定义登记 → 注册表投影 → prompt 组装」三段一致。

### 片段 H：`agent/created` 仍是 serial，本版新增归档准入（`packages/core/agent`）

`packages/core/agent/src/runtime-types.ts` **在本版区间内没有任何改动**（`git diff --name-status` 未列出该文件），因此 0.1.6 引入的 `serial` 分发在本版保持不变。官方 `docs/subsystems/core.md:782` 仍为 `#### agent/created — serial`，声明行 `:800`：

```ts
'mode serial'
'agent/created'(this: Scoped<Agent>, payload: { agent: Agent; source: SessionStartSource; signal?: AbortSignal }): undefined | Promise<undefined>
```

本版与 `agent/created` 相关的两处真实变化：

1. **消费者集合变化**（官方生成表 `docs/event-producer-consumer.md:13`）：生产者位置仍为 `packages/core/agent/src/runtime-types.ts:261`，但消费方清单新增 `session-controller`、移除 `agent-presets`。实测证据：`packages/api/session-controller/src/index.ts:178` 有 `ctx.on('agent/created', publishAgentAvailability)`；`packages/preset` 全树 grep `agent/created` **无命中**。**（该增删是否由同一 PR 有意完成——未核实）**
2. **SDK fixture 的来源改写**（`packages/core/agent-loop/tests/fixtures/serial-created.mjs`）：`source: { kind: 'plugin', plugin: name }` → `` source: { kind: `plugin:${name}` } ``，随生产者自有来源规则更新，`serial` 的顺序断言未变（第二个监听器仍以 `ready` 弱集合校验「创建监听器按序运行」）。

新增的归档准入（`packages/core/agent/src/archive-admission.ts`，38 行）：

```ts
ctx.on('workspace/session-activity', async ({ sessionId }, next) => {
  const running = lookup(sessionId)?.status === 'running'
  const rest = await next()
  if (!running) return rest
  return [{ kind: 'turn' }, ...rest]              // 运行中则申报 turn 家族
})
ctx.on('workspace/session-stop', ({ sessionId }) => {
  const agent = lookup(sessionId)
  if (agent?.status === 'running') agent.cancel({ kind: 'user' })   // 用户停止的路径，但不带 keepInbox
})
```

安装点是 `AgentRegistry` 构造器（`packages/core/agent/src/index.ts:282`，模块导入 `:15`），因此对注册表发布的**每个** Agent 生效。类型侧通过声明合并把 `turn` 并入 `SessionActivityKindMap`（`packages/core/agent/src/types.ts:21-23`），并新增一条对 `@deepseek-ai/dsh-workspace/types` 的**仅类型**依赖。设计记录：`2026-09-21-archive-stops-running-session-work.md`。

### 旧版对照：`git show dsh-v0.1.6-alpha.1:<path>` 原文

为了让「表示层换代」可被独立复核，下面把三处最关键的旧实现逐字引出（来自 `git diff` 的 `-` 侧，等价于上版文件内容），与本版并列：

**旧：`packages/core/session/src/index.ts` —— 角色映射与消息形状校验**

```ts
const MESSAGE_ROLE_BY_TYPE: Record<SurfaceEventType, Message['role']> = {
  'system/message': 'system',
  'user/message': 'user',
  'assistant/message': 'assistant',
  'tool/result': 'user',          // ← 本版改为 'tool'
}

function isMessageEventType(type: unknown): type is SurfaceEventType {
  return type === 'system/message' || type === 'user/message'
    || type === 'assistant/message' || type === 'tool/result'
    // ← 本版加入 'developer/message'
}
```

旧版对 `system/message` 的来源要求：

```ts
  if (type === 'system/message') {
    if (sourceRecord['kind'] !== 'plugin' || typeof sourceRecord['plugin'] !== 'string'
      || sourceRecord['plugin'] === '') {
      throw new Error(`${subject} message must have plugin source`)
    }
    return
    // ← 本版：sourceRecord['kind'] !== 'system-prompt' → "message must have system-prompt source"
  }
```

旧版对 `tool/result` 的形状要求（三层嵌套：消息 → 内容块 → 内容块内的 `content` 数组）：

```ts
  const content = messageRecord['content'] as unknown[]
  const block = content[0]
  if (content.length !== 1 || typeof block !== 'object' || block === null
    || (block as Record<string, unknown>)['type'] !== 'tool-result'
    || !Array.isArray((block as Record<string, unknown>)['content'])) {
    throw new Error(`${subject} message must contain one tool-result block`)
  }
  if ((block as Record<string, unknown>)['toolCallId'] !== sourceRecord['callId']) {
    throw new Error(`${subject} message has mismatched tool call ids`)
  }
  // ← 本版只保留最后一条等式，且改读 messageRecord['toolCallId']
```

**旧：`packages/core/session/src/repair.ts` —— 合成错误结果的三层包装**

```ts
    const message: ToolResultMessage = deepFreeze({
      id: brandString<MessageId>(`interrupted-tool-result-${callId}-${seq}`),
      role: 'user',                                       // ← 本版 'tool'
      source: { kind: 'tool', callId },
      content: [{
        type: 'tool-result',                              // ← 本版该包装消失
        toolCallId: callId,
        isError: true,                                    // ← 本版上移到消息顶层
        content: [{ type: 'text', text: started ? … : … }],
      }],
    })
```

**旧：`packages/core/session/src/index.ts` —— fork 的 `OPEN_TURN` 拒绝**

```ts
  const events = session.snapshotEvents(SessionLogOffset(0), SessionLogOffset(boundary + 1))
  const lastTurnBoundary = events
    .findLast(event => event.type === 'turn/start' || event.type === 'turn/end')
  if (lastTurnBoundary?.type === 'turn/start') {
    throw new SessionForkError(
      `fork boundary ${boundary} in session "${session.id}" ends inside open turn ${lastTurnBoundary.data.turn}`,
      'OPEN_TURN',
    )
  }
  return events
  // ← 本版：_forkBoundary 只返回 boundary（连续 seq 校验），OPEN_TURN 错误码整体删除，
  //    开 turn 由 buildForkSeed 的 forked 收尾处理
```

**旧：`packages/core/session/src/types.ts` —— `firstLiveSeq` 的职责描述**

旧 JSDoc 把 `firstLiveSeq` 描述为「本进程追加的第一个 seq」，并要求消费者「定位最后一个 `session/end-seed` 而不是这个 seq 本身」。本版把该职责拆成两个字段（`firstLiveSeq` = 构造器 seed 长度；`firstLifecycleSeq` = 本生命周期第一个事件），因为 fork seed 里现在预置了子代自有事件，单一字段无法同时表达两个事实。

### 上版 vs 本版：surface 面一览

| 维度 | 上版（0.1.6-alpha.1） | 本版（0.1.7-rc.1） | 证据 |
|---|---|---|---|
| surface 事件类型数 | 4 | **5** | `types.ts:441` |
| tool 结果角色 | `user` | **`tool`** | `index.ts:330` vs 上版 |
| tool 结果形状 | 消息 → `tool-result` 块 → 内层 `content` | **消息顶层 `content` + `toolCallId` + `isError`** | `llm/message.ts:173-180` |
| 消息来源表示 | `{ kind: 'plugin', plugin: '<name>' }` | **生产者自有 `kind`** | `llm/message.ts:110-115` |
| `system/message` source | `kind: 'plugin'` + 非空 `plugin` | **`kind: 'system-prompt'`** | `index.ts:364` |
| `turn/end` 原因 | 含 `interrupted`（仅崩溃恢复合成） | **新增 `forked`** | `types.ts:228` |
| fork 边界约束 | 必须结束于已关闭 turn 之外 | **任意精确前缀 + 合成收尾** | `fork.ts`、`index.ts:1245` |
| `Session` 生命周期偏移 | 仅 `firstLiveSeq` | **新增 `firstLifecycleSeq`** | `index.ts:492` |
| inbox 投影注册点 | 每个 `ReactLoopInbox` 构造器 | **`AgentLoop` 构造器一次** | `agent-loop/src/index.ts:365` |
| `maxParallelToolCalls` | settings 段（可热改） | **volatile Config 引用** | `index.ts:297`、`tool-calls.ts:132` |
| 默认模型选择持久化 | `settings.installSection` | **`configEditor.edit(entry, …)`** | `agent-default-model/src/index.ts` |
| 归档运行中的 Session | 仅加入归档集，继续跑 | **拒绝或按请求停止（`turn` 家族）** | `archive-admission.ts` |
| 管线阶段 | …… → `post-execute` → `finalizeContent` | **插入 `projectContent`** | `tools/index.ts:1642`、`docs/tool-execution-pipeline.md` |

---

## 数据流

### 1. 一条消息从追加到模型可见

```
Session.append(type, data, surfaceIntent)
  ├─ validateSessionEventData(type, data)            // session/src/surface.ts:170 —— 事件本地校验
  │    ├─ developer/message：role 配对、tool-change 块、headerSeq 存在性
  │    └─ tool/result：data.error 仅在 message.isError === true 时允许
  ├─ planSurfaceEvent(event, events, baseSeq, projections)   // surface.ts:520 附近
  │    ├─ validateSurfaceMetadata(event)
  │    └─ assertDeveloperHeader(event, events, baseSeq)      // surface.ts:528 —— 跨事件引用
  └─ 进入日志 → foldSurface() 生成 projectedMessages
                          ↓
Session.deriveMessages()
  按 MESSAGE_ROLE_BY_TYPE（session/src/index.ts:325）取回每个 surface 事件的角色，
  空 content 的 system / developer / assistant 节点投影为「无 wire 消息」但保留 surface 位置。
```

本版在这条链上的三段变化：`developer/message` 成为第 5 个 surface 类型；`tool/result` 的角色从 `user` 变 `tool`；`system/message` 的来源被收紧为 `kind: 'system-prompt'`（`packages/core/session/src/index.ts:364`，上版要求 `kind:'plugin'` + 非空 `plugin`）。

### 1b. 五类 surface 事件的派生对照

`deriveEventMessage()`（`packages/core/session/src/surface.ts:145`）对每个 surface 事件给出「派生出的 LLM 消息或 null」。下表把五类的本版行为与空内容行为并排列出：

| 事件类型 | 角色 | 来源（`source.kind`） | 空 `content` 时 | 备注 |
|---|---|---|---|---|
| `system/message` | `system` | `system-prompt`（strong，必须匹配） | **投影为 no message**，但保留 surface 位置（节点 0 受保护） | `index.ts:364` 强制来源 |
| `developer/message` | `developer` | 生产者自有（同一 recorded 归属策略） | **投影为 no message**，保留表面位置、不遮蔽受保护的系统头 | note `2026-09-17-developer-session-changes.md` |
| `user/message` | `user` | 任意生产者 | 原样投影（`return event.data`） | 唯一不检查空内容的类型 |
| `assistant/message` | `assistant` | `ModelMessageSource`（provider/model 必填） | **投影为 no message**（存在只为承载 usage） | 内嵌 provider 流，禁止 `sourceEventSeqs` |
| `tool/result` | **`tool`** | `ToolMessageSource`（`kind: 'tool'` + `callId`） | 原样投影（携带 `toolCallId` / 可选 `isError`） | 本版从 user 角色迁移过来 |

`data.error` 的准入条件随之统一为「消息顶层 `isError === true`」：`surface.ts` 的 `validateSessionEventData` 与 `invariant.ts:142` 两处共同执行。旧版读的是 `message.content[0].isError`。

### 1c. 追加管线的拒绝点（本版新增两处）

`Session.append()` 的拒绝是 **fail-loud 且不留痕**（`packages/core/session/src/README.md`：Rejected appends do not change the log, derived state, or event feed）。本版在这个链上新增了两类拒绝：

| 拒绝点 | 触发条件 | 位置 |
|---|---|---|
| `developer/message` 与 `role: 'developer'` 不同时出现 | 事件类型与消息角色配对错误 | `surface.ts:180-182` |
| 非 developer 消息携带 `tool-addition` / `tool-removal` 内容块 | 工具变更块出现在错误角色 | `surface.ts:183-187` |
| `tool-addition` / `tool-removal` 缺非空 `toolName` | 变更块必须标识工具名 | `surface.ts:192-194` |
| `tool-addition` 带内联 `tool` 定义 | 定义必须由历史 header 提供，不得内联 | `surface.ts:197` |
| `headerSeq` 与 addition 存在性不一致 | `hasAdditions !== (headerSeq !== undefined)` | `surface.ts:200-202` |
| `headerSeq` 指向自身或未来、或指向非 `request/header` 事件 | 引用必须是**更早**的 header | `surface.ts:384-386` |
| addition 的 `toolName` 在目标 header 中命中数 ≠ 1 | 拒绝缺席、歧义 | `surface.ts:389-392` |
| 命中定义的 `description` / `parameters` 不完整 | 历史 header 必须携带完整定义 | `surface.ts:393-396` |
| `deferLoading` 存在但不为 `true` | 保留字段语义收窄 | `surface.ts:397-399` |
| `tool/result` 的 `data.error` 但消息 `isError` 不为 `true` | 失败元数据与消息矛盾 | `surface.ts:220-223` |

这些拒绝点的共同设计意图（note `2026-09-17-developer-session-changes.md`）：**不解释未知的可忽略记录，不丢弃无关 JSON 元数据，但对已知数据的畸形形态硬拒绝**——这与 `2026-09-17-native-v4-read-validation.md` 的「Physical framing alone does not establish semantic validity」是同一原则在 Session 准入层的落点。

### 2. 一次 turn 内的工具结果（含合成结果）

```
runGroup()（agent-loop/src/tool-calls.ts）
  ├─ maxParallelToolCalls = ctx.agentLoop.config.maxParallelToolCalls.get()   // :132 —— 本版：volatile 引用取值
  ├─ 每个 call 记 tool/call 事件（session/src/types.ts:361：turn, step, callId, name, arguments）
  └─ 执行管线（tools）：
       tools/pre-execute → guards → tools/execute
         → projectContent（本版新增，索引 :1642）
         → tools/post-execute → finalizeContent → tools/result
  → tool/result 事件（session/src/types.ts:375）携带一等 ToolResultMessage
```

日志尾部未闭合时的两条收尾路径共用 `openTurnClosers`（`repair.ts:63`）：

```
崩溃恢复：interruptedTurnClosers(events)  → cause = interrupted   // repair.ts:175
fork 切分：buildForkSeed(events, bound)   → cause = forked        // fork.ts
两者都：未匹配的 call 补 error 结果（role 'tool'、isError true、
         id 前缀 = cause.kind）→ 补 step/end → 补 turn/end{ reason: { kind: cause.kind } }
```

`turn/end` 的原因映射因此新增 `forked`（`packages/core/session/src/types.ts:228`）。`packages/core/agent/src/consumed-work.ts` 的 `default` 分支注释也随之更新，说明 `forked` 只存在于构造器 seed 历史中（生产调用方折叠的是操作自有后缀）。

### 3. fork 数据流

```
SessionStore.fork(source, boundary, childSessionId)       // session/src/index.ts ~:1231
  ├─ _forkBoundary(sessionId, events, boundary)           // 只做「连续 seq 存在性」校验（OPEN_TURN 已删除）
  ├─ buildForkSeed(events, resolved)                      // → 前缀 + inherited 标记 + forked 收尾
  └─ create(childSessionId, { seed, inheritedEventCount: resolved + 1, meta: { parentSession, … } })
        └─ Session 构造器（index.ts ~:600）
             markedSeed = log[inheritedEventCount].type === 'session/end-seed' && data.inherited === true
             ├─ snapshot 且 isSeeded 且 seed ≠ 前缀 且 !markedSeed → 抛错（信息已放宽为「等于前缀**或**标记切点」）
             ├─ 切点之后若还有第二个 inherited 标记 → 抛错（必须标识最后一个）
             └─ firstLifecycleSeq = isSeeded ? inheritedEventCount : firstLiveSeq
```

### 4. 取消原因写入 `turn/end`

`agent-loop` 本版新增 `abortedCancelCause(signal)`（`packages/core/agent-loop/src/agent.ts:79`）：只在 signal 已 aborted 时读取 `signal.reason`，并**只复制** `turn/end` 会记录的字段（`user` / `parent` / `disposed` / `hook` 的 `reason`），避免把 Node fetch 附加到原因对象上的 `stack` 写进日志。三处调用点由原来的 `signal.reason as AgentCancelCause` 强转改为该函数。

### 5. inbox 投影的所有权移动

```
上版：ReactLoopInbox 构造器内 this.projections.register(inboxProjectionDefinition)   // 每个 Agent 一次
本版：AgentLoop 构造器内 ctx.sessionProjections.register(inboxProjectionDefinition)  // agent-loop/src/index.ts:365
      ReactLoopInbox 构造器变为空体，只使用共享投影
```

官方表述随之更新（`docs/subsystems/core.md` 本版 diff）：投影 cell 在**没有任何 Agent 存在时**也可服务冷消费者。相关提交：`cbf9fbc29e refactor(agent-loop): remove duplicate Inbox projection registration`、`0ed47fe860 fix(agent-loop): preserve standalone inbox registration`、`4b0af96838 refactor(agent): back Inbox with a durable projection`。

### 6. 归档准入

```
archiveSession(sessionId)                                // packages/workspace
  → dispatch 'workspace/session-activity'（waterfall）
      → agent 包：Agent 在跑则追加 { kind: 'turn' }      // archive-admission.ts:29-34
  → 非空 → WorkspaceActiveSessionError → API 映射为 workspace/session-active
archiveSession(sessionId, { stopActivity: true })
  → 先写归档集 → dispatch 'workspace/session-stop'（parallel）
      → agent 包：agent.cancel({ kind: 'user' })         // archive-admission.ts:35-38
```

**归档准入的完整语义（含 job / subagent / schedule 家族、API 侧 pre-step 闸门）不属于本文范围**，请见 Workspace 与 API 篇；本文只负责 `agent` 包提供的 `turn` 家族。

---

## 测试覆盖

`packages/core` 本版测试文件改动 39 个（`--name-only` 过滤 `tests/` 实测）；新增测试文件 2 个。下表按包列出可核实的关键信号：

| 包 | 新增/重点测试 | 覆盖的可核实行为 |
|---|---|---|
| `session` | `tests/developer-header.spec.ts`（新，109 行） | `headerSeq` 历史 header 绑定、addition/removal 组合、非法引用拒绝 |
| `session` | `tests/fork.spec.ts`（296 行改动） | 精确前缀 fork、合成 forked 收尾、嵌套继承切点 |
| `session` | `tests/repair.spec.ts`（149 行改动） | 合成结果的多模态/角色新形态、已关闭 step 不被修补 |
| `session` | `tests/surface.spec.ts`（87 行）、`tests/invariant.spec.ts`（44 行）、`tests/sequence-types.spec.ts`（17 行）、`tests/canonical-envelopes.spec.ts`（23 行）、`tests/session.spec.ts`（76 行）、`tests/derived-cache.spec.ts`（10 行）、`tests/properties.spec.ts`（4 行） | 角色映射、source 收紧、`firstLifecycleSeq`、surface 折叠 |
| `agent` | `tests/archive-admission.spec.ts`（新，92 行） | `turn` 家族申报与 user-cause 取消 |
| `agent-loop` | `tests/contract-regressions.spec.ts`（197 行） | 新增 `describe('forked tool history reaches the next model request')`，断言「mid-turn fork seed 之下 agent 作为 resume 越过合成 forked 收尾继续」 |
| `agent-loop` | `tests/cancel.spec.ts`（99 行） | 新增断言：取消的 turn 在 abort reason 带上 JSON 无法承载的自有属性时仍能正确闭合 |
| `agent-loop` | `tests/settings.spec.ts`（105 行，净减）、`tests/config-session-id.spec.ts`、`tests/inbox.spec.ts`、`tests/loop.spec.ts`（93 行）、`tests/interception.spec.ts`（70 行） | settings 段删除后的配置行为、inbox 投影归属、序列化创建 |
| `tools` | `tests/tools.spec.ts`（133 行）、`tests/ptc.spec.ts`（22 行）、`tests/json-schema.spec.ts`（4 行）、`tests/gen-tool-catalog.spec.ts`（8 行） | `projectContent` 在 post-execute 之前生效、`deferLoading` 白名单投影 |
| `system-prompt` | `tests/system-prompt.spec.ts`（2 行） | schema 透传 `deferLoading` |
| `scope` | `tests/scope.spec.ts`（2 行） | 仅 `as unknown as` 清理 |
| `agent-default-model` | `tests/agent-default-model.spec.ts`（121 行，净减） | settings 段删除后的 `currentSelection()` / `saveSelection()` |
| `agent-tool-presentation` | `tests/agent-tool-presentation.spec.ts`（2 行） | 注释包名更正 |

### 测试文件逐包清单（39 个文件，`git diff --stat` 实测）

| 包 | 测试文件（改动行数） | 小计 |
|---|---|---|
| `agent-loop` | `agent.spec.ts`(24)、`cancel.spec.ts`(99)、`config-session-id.spec.ts`(14)、`contract-regressions.spec.ts`(197)、`coverage-edges.spec.ts`(11)、`inbox.spec.ts`(18)、`interception.spec.ts`(70)、`invariant.spec.ts`(9)、`loop.spec.ts`(93)、`properties.spec.ts`(2)、`request-reconstruction.spec.ts`(23)、`resume.spec.ts`(9)、`runtime-context.spec.ts`(16)、`scope-lifecycle.spec.ts`(14)、`settings.spec.ts`(105)、`system-prompt-admission.spec.ts`(14)、`system-prompt-projection.spec.ts`(21)、`tool-calls.spec.ts`(59)、`fixtures/serial-created.mjs`(2) | 19 |
| `session` | `fork.spec.ts`(296)、`repair.spec.ts`(149)、`developer-header.spec.ts`(109，**新增**)、`surface.spec.ts`(87)、`session.spec.ts`(76)、`invariant.spec.ts`(44)、`canonical-envelopes.spec.ts`(23)、`sequence-types.spec.ts`(17)、`derived-cache.spec.ts`(10)、`properties.spec.ts`(4) | 10 |
| `tools` | `tools.spec.ts`(133)、`ptc.spec.ts`(22)、`gen-tool-catalog.spec.ts`(8)、`json-schema.spec.ts`(4) | 4 |
| `agent` | `archive-admission.spec.ts`(92，**新增**)、`model-selection.spec.ts`(2) | 2 |
| `agent-default-model` | `agent-default-model.spec.ts`(121) | 1 |
| `system-prompt` | `system-prompt.spec.ts`(2) | 1 |
| `scope` | `scope.spec.ts`(2) | 1 |
| `agent-tool-presentation` | `agent-tool-presentation.spec.ts`(2) | 1 |
| **合计** | | **39** |

两点值得注意的分布特征（均为上表数字的直接推论，不是推测）：

1. **测试改动集中在三个包**：`agent-loop`（19 个文件）与 `session`（10 个文件）合计 29 个，占 39 个测试文件的 74%；这与「本版语义变化集中在 session 表示层与 loop 的所有权/配置」一致。
2. **`fork.spec.ts`(296) 是单文件最大改动**，超过任何生产源码文件——`session/src/index.ts`(133) 与 `session/src/surface.ts`(92) 之和。这说明 fork 放宽的验证成本主要落在组合场景上（精确前缀、合成收尾、嵌套继承切点、生产 profile 的重放），而不是单个函数。
3. **`scope` 与 `agent-tool-presentation` 的测试改动各 2 行**，都只是编译期清理或注释包名，无行为断言变化——可作为「本版 8 包中这 2 包无生产语义变化」的交叉证据。

测试总量与通过情况：本文**未核实**（未在本机运行 `pnpm run test`；BRIEF 要求的证据纪律是「给出实测的 diff 数字与真实路径」，不要求执行测试）。`docs/persistence-changes/2026-09-16-session-format-v4.md` 的 Verification 节记录了该项变更自身的测试声明（例如「884 tests across 38 files，V3-to-V4 包与 Session surface 四项覆盖率 100%」），可作为**上游自述证据**，本文未独立复核。

---

## 与上游/下游的关系

### 上游（本包依赖）

| 依赖 | 本版关系 |
|---|---|
| `packages/llm/llm` | 提供 `MessageBase` / `MessageRoleMap` / `MessageSourceMap`（`src/message.ts:110-196`）与 `ToolSchema.deferLoading`（`src/types.ts:461-467`）。`session` 与 `tools` 均为其消费者。 |
| `packages/session/session-format-v3-to-v4` | V3→V4 迁移边：抬升 user 角色 tool-result 包装、按冻结重命名表转换 source kind、拒绝嵌套包装。note `2026-09-15-first-class-tool-role-messages.md:15` 明确「conversion specification owns exact preservation and refusal rules」，本文不重复。 |
| `packages/session/session-projection` | `agent-loop` 依赖的 `ProjectionDefinition` / `SessionProjectionRegistry`；inbox 投影归属变更即发生在这条缝上。 |
| `packages/workspace/workspace` | 本版新增反向类型依赖：`agent` 声明 `SessionActivityKindMap.turn` 并监听 `workspace/session-activity` / `workspace/session-stop`。 |
| `packages/llm/llm` / `packages/settings` / `packages/config-editor` | `agent-loop` 与 `agent-default-model` 的配置来源：本版从 `settings.installSection` 改为 volatile Config 引用 + `configEditor.edit(entry, …)`。 |

### 下游（消费本包）

| 消费方 | 本版关系 |
|---|---|
| `packages/api/session-controller` | 本版新增 `agent/created` 监听（`src/index.ts:178`，发布可用性）；`docs/event-producer-consumer.md` 的 `agent/created` 消费方清单同步变化。 |
| `packages/client/*`（ui-conversation / ui-chat / ui-tool / ui-trajectory） | 消费 `tool/call` / `tool/result` 事件与 `assistant/*` 流；三阶段（`preparing`/`start`/`result`）与 build groups 都在这一侧实现。**core 不新增准备阶段事件**（见下）。 |
| `packages/compaction/*` | 消费 surface 替换与 `tool/result` 内容；多模态保留细节归第 06 篇。 |
| `packages/session/session-telemetry` | 本版改为读 `Session.firstLifecycleSeq`（`src/coordinator.ts:152`）。 |
| TypeScript / Python SDK + 快照 | AGENTS.md 要求 `SessionEventMap` / agent-loop 变更同步更新两套 SDK 期望输出；本版 `serial-created.mjs` fixture 的来源改写即为此类同步的直接证据。 |

### 关于「工具调用三阶段」的 core 侧边界（重点）

note `2026-09-22-tool-call-three-phases.md` 把一次工具调用拆成三个阶段，其**确切边界与类型**如下（源码实测，均在 `packages/client`）：

```ts
// packages/client/ui-conversation/src/client/contract/records.ts
interface ToolCallHead {                     // :261
  callId: string; parentCallId?: string; name: string
  turn: number; step: number; time: number; subCalls: readonly ToolCallBlock[]
}
/** A named model call whose arguments are not yet available to tool views. */
export interface PreparingToolCall extends ToolCallHead { readonly phase: 'preparing' }   // :275-277
/** A dispatched tool call with complete arguments and no result yet. */
export interface StartedToolCall  extends ToolCallHead { readonly phase: 'start'; readonly argsRaw: string }  // :280-283
export type RunningToolCall = PreparingToolCall | StartedToolCall      // :286
/** One preparing, dispatched, or settled call, recursively owning its child calls. */
export type ToolCallBlock = RunningToolCall | ToolResultNode           // :289
```

三阶段的证据来源（对应 note 的表格）：

| 阶段 | 创建/更新证据 | core 侧承载 |
|---|---|---|
| `preparing` | 带 call id 与 tool name 的 live delta（`assistant/live-chunk` 的 `chunk.type === 'tool-call-delta'` 且 `chunk.name` 非空，见 `packages/client/ui-chat/src/client/conversation-nodes/tool.ts:41-49`） | **无持久化事件**。`assistant/live-chunk` 不在 `packages/core/session/src/types.ts` 的事件表中（实测 grep 无命中），它是 Client-only 瞬时事件。 |
| `start` | 持久 `tool/call` | `packages/core/session/src/types.ts:361`（`turn, step, callId, name, arguments`） |
| `result` | 持久 `tool/result` | `packages/core/session/src/types.ts:375`（一等 `ToolResultMessage`） |

渲染态另有一套枚举，与阶段名不同：`ToolRowState = 'preparing' | 'running' | 'ok' | 'error' | 'stopped'`（`packages/client/ui-tool/src/client/tool/models/tool-call-model.ts:18`）；`preparing` 行不可展开，其原始参数前缀通过 `useToolCallArgumentsPartial` 从**既有 Step 的原始流**读取，不引入第二个累加器（`packages/client/ui-tool/src/client/tool/tool-call-arguments-partial.ts:13-25`，契约在 `src/client/contract/slots.ts:49`）。

note 的边界结论（原文要点，本文逐条核对过正文）：准备阶段的展示**不改变**模型请求、工具分发时机、Session 事件或持久化格式；空参数字符串不代替已分发调用；历史页不回放准备阶段（历史只有 `start → result`）；组装器在流退役时重选 start 并从剩余 Match 重算 State。这些都不构成 core 侧的类型或事件变更——**core 侧本版对这条链没有任何改动**，正是该决策「不新增持久化表示」的直接体现（note 的 Alternatives 明确拒绝了 "Persist or replay preparing"）。

### 关于「conversation build groups」的 core 侧边界

note `2026-09-21-conversation-build-groups.md` 引入的是 client 的 `ConversationGroupDefinition` 注册面（`ctx.uiConversation.groups.register(...)`）、`NodeReference` / `GroupReference`、`GroupSnapshot`、`GroupStore` 与装配顺序。note 原文的 Consequences 第一条即声明「这是一个显式的框架扩展：新增输入协议、注册表、上下文、发布阶段与读取器」，但它扩的是 **Conversation** 框架，不是 Session。实测：

- `packages/core` 内无 `group` / `GroupSnapshot` / `groupPart` 相关新增（`packages/core` 的 23 个 src 改动文件清单中没有任何 group 相关文件）；
- note 与 `docs/subsystems/conversation.md` 均明确「Group creation adds neither Session events nor an execution lifecycle」；
- 官方 `docs/subsystems/conversation.md` 本版新增 `## Group Definitions` 节（+33/-6 行），全部属 Conversation 参考页。

因此对 core 主干而言，本项的结论是：**core 提供的 `tool/call` / `tool/result` / `assistant/message` 事件与 Node 可见性不变量未变，分组是纯 client 派生，不落日志**。这与 AGENTS.md 的「Model-visible ⟺ logged」及「web 层是纯呈现」两条规则一致。

### 兼容性影响小结（消费 `packages/core` 时必须同步改动的点）

下表把本版的破坏性接口变更按「谁需要改」整理出来，每行都给可复核的证据位置。这是从 package README 与 note 的契约陈述归纳出的**迁移清单**，不构成对第三方消费者的兼容承诺（DSH 自身的公开 API 是 pre-stable，见根 `AGENTS.md`）。

| 受影响方 | 必须改动 | 证据 |
|---|---|---|
| 读 `tool/result` 消息内容的消费者 | 从 `message.content[0].content` / `content[0].isError` 改读消息顶层 `content` / `isError`；从 `content[0].toolCallId` 改读 `message.toolCallId` | `packages/llm/llm/src/message.ts:173-180`；`packages/core/session/README.md` 的 tool-result error 段改写 |
| 断言「`tool/result` 是 user 消息」的消费者 | 改为 `role: 'tool'` | `packages/core/session/src/index.ts:330` |
| 构造注入消息的插件 | 不得再写 `{ kind: 'plugin', plugin: '<name>' }`；改为在自己的模块里向 `MessageSourceMap` 合并声明 `kind` | `packages/llm/llm/src/message.ts:106`（「no shared catch-all `plugin` kind」）；core 内 5 处改写见变更要点 §2 |
| 依赖 `Session.fork()` 抛 `OPEN_TURN` 的调用方 | 该错误码已删除；改为处理「open tail 被 `forked` 收尾」的情形 | `packages/core/session/src/index.ts` 的 `SessionForkErrorCode`（4 个码）；`fork.ts` |
| 依赖 `inheritedEventCount === seed.length` 的调用方 | `inheritedEventCount` 现在只计复制的源事件，seed 还含标记与收尾 | `packages/core/session/src/index.ts:1245` 的 `resolved + 1` |
| 以 `firstLiveSeq` 作为「本生命周期起点」的消费者 | 改用 `firstLifecycleSeq` | `packages/core/session/src/index.ts:492`；`packages/session/session-telemetry/src/coordinator.ts:152` 是已迁移范例 |
| 读 `ctx.agentLoop.config.maxParallelToolCalls` 的消费者 | 类型由 `number` 变为 `Volatile<number>`，须 `.get()` | `packages/core/agent-loop/src/index.ts:297`；`src/tool-calls.ts:132` |
| 依赖 `agent-loop` / `agent-default-model` settings 段的部署 | 两个命名空间与 schema 已删除，改为 volatile Config + configEditor | `packages/core/agent-default-model/README.md`（18 行改动，改写配置来源段） |
| 依赖「每个 Agent 各注册一次 inbox 投影」的消费者 | 投影现在由 `AgentLoop` 注册一次，Agent 卸载后仍可服务冷读 | `packages/core/agent-loop/src/index.ts:365`；`packages/core/agent-loop/README.md` 的 Turn and step flow 段改写 |
| 实现自定义 tool 的插件 | 可选新增 `projectContent`；若要在模型请求中延迟加载定义，可声明 `deferLoading: true` | `packages/core/tools/src/schema.ts:499`、`:522`；`packages/core/tools/src/index.ts:246` |
| 监听 `agent/created` 的消费者 | 事件语义与 `serial` 分发未变；但消费方集合变化（新增 `session-controller`）意味着可用性发布的新时机 | `docs/event-producer-consumer.md:13`；`packages/api/session-controller/src/index.ts:178` |
| provider 适配器 | 需把一等 tool 角色映射到各 provider 的 tool-result 表示；**上游自述** DeepSeek 协议与 pi-ai 对 developer 历史与 `deferLoading` 请求抛错 | note `2026-09-15-first-class-tool-role-messages.md` Consequences；note `2026-09-17-developer-session-changes.md` Consequences（**该抛错行为本文未在源码中复核**） |

**不需要改动**的部分同样重要，避免过度迁移：

- `agent/created` 的分发模式（`serial`）与 `payload` 形状未变（`runtime-types.ts` 本版零改动）；
- `tool/call` 事件的字段未变（`turn` / `step` / `callId` / `name` / `arguments`，`types.ts:361`）；
- `assistant/message` 的内嵌流、`assistant/attempt` 的诊断用途、`sourceEventSeqs` 的推导语义未变；
- `surfaceOp` 的 replace 语义与节点 0 的保护规则未变（本版只扩大了参与者集合）；
- client 侧的三阶段与分组**不需要 core 配合改动**——它们不新增事件、不改持久化格式。

### 本篇与其它篇的分工边界

| 内容 | 归属 |
|---|---|
| `session` 的事件类型/角色/来源/surface 语义、fork 与 repair 的**接口与事件表示** | **本篇** |
| 存储层（JSONL / SQLite / zstd 物理帧）、V3→V4 迁移包的完整保留与拒绝规则、`docs/persistence-changes/` 的 schema 与检查点机制 | 第 06 篇（持久化与 compaction） |
| compaction 的预算、图像卸载（image-offload）、多模态保留算法 | 第 06 篇 |
| `packages/preset` 的 preset registry 重构（`AgentPresets` → `AgentPresetRegistry`） | preset / 组合篇 |
| Conversation 框架的 Node / Group 装配、Chat 的三阶段呈现 | client 篇 |
| Workspace 归档准入的完整语义（`job` / `subagent` / `schedule` 家族、API pre-step 闸门） | Workspace / API 篇 |

---

## 本版本变更要点（0.1.6-alpha.1 → 0.1.7-rc.1）

### 1. 会话格式 V4：一等 tool role 消息（note `2026-09-15-first-class-tool-role-messages.md`）

- **版本号**：`packages/core/session/src/types.ts:89`，`3` → `4`。
- **表示**：`tool/result` 事件的消息由「user 角色 + 单个 `tool-result` 内容块」变为 `ToolResultMessage`（`role: 'tool'`，顶层 `toolCallId` + 可选 `isError`，`packages/llm/llm/src/message.ts:173-180`）。
- **校验**：角色映射 `'tool/result': 'tool'`（`session/src/index.ts:330`）；`assertMessageEventShape` 不再要求内容块形状，只做 `message.toolCallId === source.callId`；`data.error` 的存在性改为以 `message.isError === true` 为条件（`session/src/surface.ts` 的 `validateSessionEventData`、`session/src/invariant.ts:142`）。
- **surface 替换等价性**：`assertToolResultRewrite` 的对比基准从 `content[0].content = null` 改为 `content: null`（`session/src/surface.ts`）。
- **合成结果**：崩溃恢复与 fork 收尾产出的错误结果同样升为一等 tool role（`session/src/repair.ts:131`）。
- **迁移**：V3→V4 迁移边只抬升**恰好一个**已发布包装，拒绝嵌套包装，保留源代际；当前 V4 解码为 native-only（note 原文：「Current V4 decoding is native-only; wrapper rows are accepted only by the adjacent migration edge」）。
- **角色表封闭**：`MessageRoleMap` 封闭，模型可见 role 必须有持久化事件与适配器投影（`packages/llm/llm/src/message.ts:182-193` 注释）。

### 2. 生产者自有消息来源（note `2026-09-09-producer-owned-message-sources.md`）

`kind` 直接标识生产者，合成包装 `{ kind: 'plugin', plugin: '<producer>' }` 退役。本版 core 侧的实际改写点（全部实测）：

| 位置 | 旧 | 新 |
|---|---|---|
| `packages/core/session/src/index.ts:364`（system/message 校验） | `kind === 'plugin'` + 非空 `plugin` | `kind === 'system-prompt'` |
| `packages/core/agent-loop/src/runtime-context.ts:19` | `const SOURCE = '@deepseek-ai/dsh-system-prompt'` | `const SOURCE = 'runtime-context'` |
| `packages/core/agent/src/model-selection.ts:16-17` | `{ kind: 'plugin', plugin: 'model-selection', form: 'notice' }` | `kind: 'model-selection'`（`MessageSourceMap` 合并声明），`:56` 使用 |
| `packages/core/tools/src/index.ts` 声明 | — | `MessageSourceMap['tool-registry']` 合并声明 |
| `packages/core/tools/src/ptc.ts:12-14`、`:642` | `{ kind: 'plugin', plugin: 'tools-ptc' }` | `{ kind: 'ptc-mode' }` |
| 未知生产者（`tests/fixtures/serial-created.mjs`） | `{ kind: 'plugin', plugin: name }` | `` { kind: `plugin:${name}` } `` |

V3→V4 冻结重命名表还包含 `tools-code-mode` / `tools-ptc` → `ptc-mode`、`compact` → `compact-checkpoint`、`dsh-compaction-basic` → `compact-basic`。**这些映射的完整表格与冲突规则归迁移包，本文未逐条复核。**

### 3. `developer/message`：用历史工具 schema 记录增量会话变更

- **事件**：`packages/core/session/src/types.ts:311`；加入 `KNOWN_SESSION_EVENT_TYPES`（`src/known-event-types.ts` 新增 `'developer/message'`，同批新增 `'workspace/changes'`）；加入 `SurfaceEventType`（`types.ts:441`）与 `SURFACE_EVENT_TYPES`（`surface.ts:52`）。
- **语义**：只存 `toolName`，由 `headerSeq` 指向更早的完整 `request/header`；一个事件的所有 addition 绑定同一 header 修订；`removal` 不需要 header 引用。note `2026-09-17-developer-session-changes.md`。
- **校验**：见片段 D。
- **保留字段**：`ToolAdditionBlock.tool` 声明为可选 `never` + `@persistenceReserved`——使「未来允许取值」构成格式跃迁而不是可选字段追加。
- **与 `deferLoading` 解耦**：`ToolSchema.deferLoading`（`packages/llm/llm/src/types.ts:467`）独立于 addition 历史；构造、注册表投影、prompt 组装三段均保留该标记（`packages/core/tools/src/schema.ts:499/595`、`packages/core/tools/src/index.ts:1282/1291`、`packages/core/system-prompt/src/index.ts:586/590`）。
- **交付边界**：本版「无已发布 profile 产生 developer 记录」，provider 序列化、自动发射与 UI 支持均延后（note Consequences 与 `docs/persistence-changes/2026-09-16-session-format-v4.md` 一致）。**上游文档明确 Chat 与 Trajectory 对 developer 事件抛错——本文未在 client 源码中复核该抛错。**

### 4. fork 语义放宽与 `forked` 结束原因

- **任意精确前缀**：`SessionStore.fork()` 不再要求「前缀结束于 open turn 之外」，`SessionForkErrorCode` 删除 `'OPEN_TURN'`（`packages/core/session/src/index.ts` 的类型定义处；`_forkSeed` → `_forkBoundary`）。
- **合成收尾**：新增 `buildForkSeed`（`src/fork.ts`）＝ 复制前缀 + `session/end-seed{inherited:true}` + `openTurnClosers(prefix, { kind: 'forked' })`。
- **新结束原因**：`TurnEndReasonMap.forked`（`types.ts:228`）；`consumed-work.ts` 的 default 分支注释说明它只出现在构造器 seed 历史中。
- **措辞分派**：`CLOSER_TEXT` 按 cause 分派（`repair.ts:35`），fork 版措辞明确「父会话可能在 fork 点之后执行过该调用」，因此只对只读或幂等操作直接重试。
- **计数语义**：`inheritedEventCount` 只计复制的源事件，不含合成收尾（`index.ts:1245`）。
- **`session/end-seed` 合法写入者扩大**为构造器与 `buildForkSeed`；构造器对「seed 已自带来标记」的情形放宽校验，并拒绝「切点之后还有第二个 inherited 标记」（`index.ts` 构造器段）。
- **设计记录**：`2026-08-18-arbitrary-seq-session-fork.md`；`packages/core/session/README.md` 的 Known Limitations 从「`fork()` cuts only at stable boundaries」改写为「Live-source Store API」并指向 Host 观察路径。

### 5. `Session.firstLifecycleSeq`

新增只读字段（`index.ts:492`，赋值 `:612`），语义为「本对象生命周期产生的第一个事件」。与 `firstLiveSeq` 的分工：后者是构造器 seed 长度（进程内事实），前者把 fork seed 里预置的子代自有事件算作本生命周期。下游 `session-telemetry` 改为以它为遥测游标起点（`coordinator.ts:152`）。

### 6. inbox 投影注册上移到 `AgentLoop`

`ReactLoopInbox` 构造器不再注册投影，改由 `AgentLoop` 构造器注册一次（`agent-loop/src/index.ts:365`）。官方表述（`docs/subsystems/core.md`）：投影 cell 在**没有 Agent 存在时**也能服务冷消费者，冷读不再依赖任何 Agent 实例。相关提交见附录中 inbox 系列。

### 7. 配置层：settings 段 → volatile Config 引用

`agent-loop` 删除 `AGENT_LOOP_SETTINGS_NAMESPACE` / `AgentLoopSettings` / `AGENT_LOOP_SETTINGS_SCHEMA` 与 `resolveMaxParallelToolCalls`，`Config.maxParallelToolCalls` 改为 `Volatile<number>`（`src/index.ts:297`，schema `:335`），读取点改为 `ctx.agentLoop.config.maxParallelToolCalls.get()`（`src/tool-calls.ts:132`）；`agents` 保持启动期配置。`agent-default-model` 删除整套 settings 命名空间 / schema / `AgentDefaultModelSettings`，三个 Config 字段改为 `Volatile<string>`（`reasoningEffort` 允许 `undefined`），`saveSelection()` 改为 `configEditor.edit(entry, …)`。

净效果：`agent-default-model` 是本版唯一净删除的 core 包（+92/-174）。设计记录：`2026-09-18-volatile-config-references.md`、`2026-09-19-profile-owned-live-configuration.md`。

### 8. 归档准入接入 `agent` 包

新增 `archive-admission.ts` 与 `SessionActivityKindMap.turn` 合并声明；`AgentRegistry` 构造器安装两个监听器（`src/index.ts:282`）。停止路径用 `agent.cancel({ kind: 'user' })`（用户停止路径）但**不带** `keepInbox`，因此排队输入被丢弃并留下一条 inbox splice 记录；不做等待结算。本文已核实的范围止于 `agent` 包这一侧。

### 9. 工具执行管线新增 `projectContent` 阶段

阶段顺序由 `docs/tool-execution-pipeline.md` 更新为：`tools/pre-execute` → guards → `tools/execute` → **`projectContent`** → `tools/post-execute` → `finalizeContent` → `tools/result`。mermaid 图新增节点 `project`，并把 `denied` 与 `around` 两条边接到 `project → post`，`project` 抛错走 `normalized`。`docs/subsystems/tools.md` 的 `ToolDefinition` 契约段同步补入 `projectContent`，并在白名单句子里加入该字段（不得泄漏进模型请求）。

实现要点（`packages/core/tools/src/index.ts`）：回调在调用开始时捕获（`:1436`），`collapsed` 调用不装投影（`:1447`），在 post-execute 之前执行一次并删除 WeakMap 条目（`:1642-1643`）；**策略替换仍然权威**，绕过 post-execute 的管线失败跳过投影。

### 10. 取消原因拷贝，避免把传输层附加属性写进日志

新增 `abortedCancelCause()`（`agent-loop/src/agent.ts:79`），三处调用点从强转改为该函数。官方 `packages/core/agent-loop/README.md` 的 Failure and cancellation 节新增说明：Node fetch 会在原因对象上赋 `stack`，`Session.append` 会记录它或因其不可 JSON 化而拒绝，因此取消时复制一份。`docs/subsystems/core.md` 的 Cancellation 段相应改写（「exposes that same object as the runtime-only `AbortSignal.reason`」→「records a fresh `AgentCancelCause`」的措辞调整见 `agent-loop/README.md`）。

### 11. `agent/created` serial 分发的本版后续

- **代码不变**：`packages/core/agent/src/runtime-types.ts` 未出现在本版 diff 中；官方 `docs/subsystems/core.md:782` 仍为 `agent/created — serial`。
- **消费方变化**：`docs/event-producer-consumer.md:13` 的消费方清单新增 `session-controller`（已核实源码 `packages/api/session-controller/src/index.ts:178`）、移除 `agent-presets`（已核实 `packages/preset` 全树无 `agent/created` 监听）。**其成因未核实。**
- **fixture 同步**：`packages/core/agent-loop/tests/fixtures/serial-created.mjs` 的来源改写（`plugin:${name}`），顺序断言未变。
- **序列化创建的语义保留**：`docs/subsystems/core.md:671`、`:702`、`:712` 的 serial 描述（创建监听器失败即 reject、移除与销毁等待 serial 监听器完成）在本版无变化。

### 12. 官方文档变更清单（本版区间实测）

| 文档 | +行 | -行 | 核心内容 |
|---|---|---|---|
| `docs/subsystems/core.md` | 64 | 215 | Inbox 投影归属改写；`AgentDefaultModelConfig` 契约改写（settings → config editor）；生成的 cordis-surface 中 `agentPresets` 类从 `AgentPresets` 改为 `AgentPresetRegistry`、来源包 `packages/preset/agent-presets` → `packages/preset/agent-preset-registry`（属 `packages/preset`，非本包组） |
| `docs/subsystems/session.md` | 92 | 49 | `developer/message` 事件、`SurfaceEventType` 5 类、`EpochHeader.system?: never`、`tool/result` 一等 tool role、`forked` 原因、`fork()` 契约与 `SessionStore.fork` JSDoc、`firstLifecycleSeq`；cordis 面新增 `workspacePathApplications` / `projections` 等（非本包组） |
| `docs/subsystems/tools.md` | 12 | 2 | `ToolDefinition.projectContent` 契约与管线顺序 |
| `docs/subsystems/conversation.md` | 33 | 6 | 新增 `## Group Definitions` 节；Context 的 start/update 语义改写（durable 与 transient 均可作 start） |
| `docs/subsystems/system-prompt.md` | 0 | 0 | **区间内无变更**（`--name-status` 无输出） |
| `docs/subsystems/scope.md` | 0 | 0 | **区间内无变更** |
| `docs/tool-execution-pipeline.md` | 6 | 3 | 新增 `projectContent` 节点与三处边 |
| `docs/tool-catalog.md` | 115 | 203 | 生成表刷新；core 相关行 `@deepseek-ai/dsh-tools` 的 `run_code` 行**未变**；新增 `plugin_manager`、`load_workspace_dependencies` 行，`tool-cordis` 行从 7 个工具缩为 2 个只读工具（属 `packages/extensions`，**未核实其源码**） |
| `docs/event-producer-consumer.md` | 52 | 41 | `agent/created` 消费方变化；`agent/turn-stopping` 新增 `workspace-changes`；多处行号漂移；新增 `workspace/session-activity` / `workspace/session-stop`（`:85`、`:86`） |
| `docs/session-format-status.md` | 17 | 3 | 新增 Finalization record（`latestFinalizedVersion: 4`）与首发布前的 V3 词表检查说明 |

### 13. 与本文相邻但不属本文的变化

- `ab102138c8 fix: retain ordered tool text and images within a token budget`、`94728ebd23`、`c5ca36387b` 等提交：多模态工具结果的 token 预算内保留。`tool/result` 的**表示**变化属本文（一等 tool role + 图像仍在 `content` 里），**compaction 侧的保留算法与预算策略归第 06 篇**，本文不展开。
- `f4a32dbd0a refactor(llm): flatten tool results and validate native V4 sessions`、`fb79a944f5 refactor(llm): separate durable producer sources from request inputs`、`29f7e7bdf5 fix(session): reserve retired system text in request-header schemas`：跨 `llm` 与 `session` 的改动，本文只覆盖 core 一侧的可见结果，`llm` 侧内部实现未逐一核实。
- V3→V4 迁移包（`packages/session/session-format-v3-to-v4`）的完整保留 / 拒绝规则、`docs/persistence-changes/` 的 schema 与 `finalized/v4.json` 检查点机制：**归持久化与迁移篇**。

---

## 附录：本版核心包提交索引

`git log --oneline dsh-v0.1.6-alpha.1..dsh-v0.1.7-rc.1 -- packages/core`（68 条，含 merge；顺序为 git 默认的逆时间序）：

```
a60af51e80 release(dsh): 0.1.7-rc.1
10ea83bcc3 release(dsh): 0.1.7-alpha.2
4e6028a604 build: use tilde ranges for vendor and native workspaces
37372101b5 build: pin internal DSH workspace dependencies
c5ca36387b Merge remote-tracking branch 'origin/master' into fix/4775-multimodal-tool-retention
112ce776ac release(dsh): 0.1.7-alpha.1
94728ebd23 fix: repair multimodal retention CI resolution and coverage
4137d1d628 Merge remote-tracking branch 'origin/master' into fix/4775-multimodal-tool-retention
cbae324bfa feat(workspace): stop a Session's running work before archiving it (#4765)
601d6761e4 feat(settings): project volatile Config through profile-backed forms (#4587)
4694540e2a Merge remote-tracking branch 'origin/master' into fix/4775-multimodal-tool-retention
ab102138c8 fix: retain ordered tool text and images within a token budget
d1e22a7e24 feat(preset): declare Agent compositions in profile YAML (#4569)
2e99e6021d Merge remote-tracking branch 'origin/master' into xtr/normalize-agent-cancel-cause
7520fe94e1 refactor(preset): 精简创造模式的 system prompt (#4745)
3773c4f85b docs(agent-loop): correct the owning cancellation note
35f3abf1fa fix(agent-loop): copy the cancel cause before logging turn/end
f25957d442 Merge remote-tracking branch 'origin/master' into feat/workspace-dependencies-package
580bdc7258 refactor: remove redundant unknown casts
d5a109c60f fix(session): preserve direct V3 source kinds during wrapper conversion
bf29247fad fix(session): namespace historical V3 extensions with plugin prefixes
e0bd7e1960 feat(session): add developer changes using historical tool schemas
b88afa8a72 fix(ptc): name persisted producer attribution ptc-mode
fb79a944f5 refactor(llm): separate durable producer sources from request inputs
29f7e7bdf5 fix(session): reserve retired system text in request-header schemas
f4a32dbd0a refactor(llm): flatten tool results and validate native V4 sessions
c95d045fdc docs(session): correct fork seed marker ownership
3ebd70020c Merge origin/master into feat/workspace-dependencies-package
d66b21894c merge: integrate latest master into session-log-v4
6b1808f432 release(dsh): 0.1.6-alpha.2
8fad9ccd8c feat(skill): complete shared Office runtime builds for SDK carriers
038c36b138 merge: update master integration with released fork support
0a1e2691ab merge: integrate master into session-log-v4
8696ec6cef feat(session): fork exact event prefixes with synthetic tail results
c63da07322 Merge remote-tracking branch 'origin/master' into worktree/code-diff-card
ed32f57f88 feat(creator): use Plugin Manager for persistent plugins
669b724a78 feat(session): add the V4 integration format and retain V3 replay inputs
664190c6f9 Merge remote-tracking branch 'origin/master' into worktree/code-diff-card
9f219e48a9 Merge remote-tracking branch 'origin/master' into worktree/code-diff-card
992a932a16 Merge remote-tracking branch 'origin/master' into xtr/durable-inbox-web-recovery
1ea80b7b69 Merge remote-tracking branch 'origin/master' into worktree/code-diff-card
86497c479c Merge remote-tracking branch 'origin/master' into turtle/plugin-manager
d06e6b5519 feat: coordinate profile management through dsh-hmr
e5ac976e4b Merge remote-tracking branch 'origin/master' into worktree/code-diff-card
cbf9fbc29e refactor(agent-loop): remove duplicate Inbox projection registration
cf4ba60b47 Merge remote-tracking branch 'origin/master' into xtr/durable-inbox-web-recovery
49f601e902 Merge remote-tracking branch 'origin/master' into xtr/durable-inbox-web-recovery
8a52d27a93 Merge remote-tracking branch 'origin/master' into worktree/code-diff-card
a27cfb9bd3 Merge remote-tracking branch 'origin/master' into worktree/code-diff-card
3c632ebf66 Merge remote-tracking branch 'origin/master' into worktree/code-diff-card
f937f4e23b feat(web): record turn file changes with git snapshots and render the changed-files card
0ed47fe860 fix(agent-loop): preserve standalone inbox registration
28548ba1c7 Merge remote-tracking branch 'origin/master' into xtr/durable-inbox-web-recovery
72f2e71070 fix(web): reconcile durable inbox recovery with master
cb999713d1 Merge latest master into xtr/durable-inbox-web-recovery
e5a5401228 Merge remote-tracking branch 'origin/master' into xtr/durable-inbox-recovery
5b9b7c59dd fix(session-controller): derive queues from projections
fb3f3ff162 fix(agent): validate durable inbox reconstruction
6912c41a08 Merge remote-tracking branch 'origin/master' into dshw/pr-deepseek-harness-deepseek-harness-2672
e46a2499df Merge remote-tracking branch 'origin/master' into xtr/durable-inbox-recovery
9deabe717f Merge remote-tracking branch 'origin/master' into xtr/durable-inbox-recovery
71a179a305 Merge remote-tracking branch 'origin/master' into dshw/pr-deepseek-harness-deepseek-harness-2672
b9d6314853 Merge origin/master into xtr/durable-inbox-recovery
09fab78863 test: trim unrelated inbox changes
4d5ccf39ef refactor(agent): remove inbox service
5609922d27 Merge remote-tracking branch 'origin/master' into dshw/pr-deepseek-harness-deepseek-harness-2672
9b0d77b930 Merge remote-tracking branch 'origin/master' into dshw/pr-deepseek-harness-deepseek-harness-2672
4b0af96838 refactor(agent): back Inbox with a durable projection
```

按主题归并（同一提交可能横跨多包，划分以提交标题为准）：

| 主题 | 提交 |
|---|---|
| V4 格式与 tool role | `669b724a78`、`f4a32dbd0a`、`29f7e7bdf5` |
| 生产者自有来源 | `fb79a944f5`、`b88afa8a72`、`bf29247fad`、`d5a109c60f` |
| developer 事件与 deferLoading | `e0bd7e1960` |
| fork 精确前缀 | `8696ec6cef`、`c95d045fdc`、`038c36b138` |
| inbox 投影归属 | `4b0af96838`、`4d5ccf39ef`、`09fab78863`、`fb3f3ff162`、`0ed47fe860`、`cbf9fbc29e`、`5b9b7c59dd` |
| 归档停止运行中的工作 | `cbae324bfa` |
| volatile 配置 | `601d6761e4`、`d06e6b5519` |
| 取消原因拷贝 | `35f3abf1fa`、`3773c4f85b` |
| 多模态保留（细节归第 06 篇） | `ab102138c8`、`94728ebd23`、`c5ca36387b` |
| 工作区依赖范围 | `37372101b5`、`4e6028a604` |
| 发布提交 | `6b1808f432`、`112ce776ac`、`10ea83bcc3`、`a60af51e80` |

### 未核实项汇总

1. **未运行测试**：本文所有测试结论均为「diff 规模 + 新增用例标题」层面，未执行 `pnpm run test` / `test:coverage`，因此不声明任何通过率或覆盖率。
2. **`agent/created` 消费方增删的成因**未核实（只核实了「`session-controller` 有监听」「`packages/preset` 无监听」两侧事实）。
3. **client 侧实现细节**（三阶段的完整装配逻辑与退役重算、build groups 的 `GroupStore` 原子校验与装配 9 步）未逐行核实；本文只核对了 note 原文结论与类型定义所在文件/行号。被引用的 note 路径为 `.agents/notes/implemented/architecture/2026-09-22-tool-call-three-phases.md` 与 `.../2026-09-21-conversation-build-groups.md`。
4. **V3→V4 迁移包**（`packages/session/session-format-v3-to-v4`）的冻结重命名表全表、嵌套包装拒绝规则、历史扩展字段 `plugin:message:` / `plugin:result:` 的命名细节未逐条复核；`docs/persistence-changes/2026-09-16-session-format-v4.md` 的 Verification 数字为上游自述，未独立验证。
5. **`docs/tool-catalog.md` 中 `dsh-tool-cordis` 工具集收缩**（7 → 2）与 `plugin_manager` / `load_workspace_dependencies` 新增行，属 `packages/extensions` / `packages/deliverables` 等其它包组，本文未核实其源码。
6. **`system-prompt` 移除 `TOOL_CORDIS: 2500` 段位**的原因未核实（仅核实删除本身：`packages/core/system-prompt/src/index.ts:145` 为 `TOOL_GOAL: 2400`，`:146` 直接是 `TOOL_WORKFLOW: 2600`）。
7. **`agent-loop` 的 `settings.spec.ts` 净减 105 行**：未逐行核对被删除的断言清单。
8. **本文未覆盖**：持久化层与 compaction 的迁移/预算细节（第 06 篇）、`packages/preset` 的 preset registry 重构（非本包组）、Workspace / API 侧归档准入的完整语义。
