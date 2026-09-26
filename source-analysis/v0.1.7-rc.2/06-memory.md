# 【第 06 篇】packages/session · storage · compaction · session-query · context：会话落地与记忆

> **基线说明**：本篇为 v0.1.7-rc.1 全量分析基线，rc.2 未改动本篇覆盖的系统性结构。v0.1.7-rc.2 的增量变更（约 335 个提交）请见同目录 `README.md` 与 `diff-vs-0.1.7-rc.1.md`。

> **版本**：dsh-v0.1.7-rc.1（`46a7f68b09`），对比上版 dsh-v0.1.6-alpha.1（`0a15e36e7f`）
> 难度：🔴 深度（本版最重的一篇；建议先读第 02 篇的 `packages/core/session` 部分与 `docs/subsystems/session.md`）
> 包范围：`deepseek-harness/packages/session/`（**20 个包，本版新增 1 个**）、`packages/storage/`（4）、`packages/compaction/`（5）、`packages/session-query/`（4）、`packages/context/`（6）；另把 `packages/core/session/`（1 包，格式版本常量的所有者）纳入本篇分析范围
> 上游文档：`docs/subsystems/session.md`、`persistence.md`、`session-projection.md`、`session-reference.md`、`session-telemetry.md`、`compaction.md`、`storage.md`、`session-query.md`；`docs/session-format-status.md`、`docs/persistence-catalog.md`、`docs/persistence-changes/**`、`docs/cookbook/adding-a-session-format-version.md`、`docs/cookbook/reviewing-persistence-type-changes.md`

## 目录

- [引言](#引言) · [概述](#概述) · [核心概念](#核心概念) · [包结构](#包结构) · [关键类型](#关键类型) · [数据流](#数据流) · [测试覆盖](#测试覆盖) · [与上下游的关系](#与上下游的关系)
- [本版本变更要点](#本版本变更要点016-alpha1--017-rc1)：[1 会话格式 V4](#1-会话格式-v4本版最重的跃迁) · [2 native 读校验](#2-native-v4-读校验跨事件关系强制通过) · [3 检查点 JSON 无损化](#3-projection-checkpoint-json-无损化) · [4 投影缓存身份](#4-projection-cachelisting-identity-与-cachedsequenced-两档行) · [5 归因策略](#5-持久化归属策略attribution-policy与-source-换代) · [6 workspace/changes](#6-工作区变更事件workspacechanges) · [7 unknown child catalog](#7-unknown-child-catalog未知模式子会话的保留) · [8 会话本地子代理迁移](#8-会话本地子代理迁移只迁移被打开的那一个) · [9 空白会话](#9-进程本地空白会话blank-session-复用) · [10 打开读协调](#10-会话打开读协调open-read-coordination) · [11 钉住与归档](#11-会话钉住与侧栏归档仅宿主侧语义) · [12 compaction](#12-compaction输出预留与-headroom-预算) · [13 session-query](#13-session-query便利-api-精简仍是-proposed) · [14 context](#14-context-包组session-reference-的-displaytitle-与-source-换代) · [15 storage](#15-storage-包组仅版本号与一处-unknown-断言清除) · [16 文档区间](#16-官方文档区间变更) · [17 未核实项](#17-未核实项)
- [附录：本版记忆侧提交索引](#附录本版记忆侧提交索引)

---

## 引言

本篇覆盖六个包组，它们共用同一个真相源——`packages/core/session` 的追加式事件日志（append-only event log）。本版与前几版最大的不同是：**日志的格式本身换代了**。

量化基线（全部可复核，命令见文末附录）：

```text
git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- \
  packages/session packages/storage packages/compaction \
  packages/session-query packages/context packages/core/session
→ 248 files changed, 10927 insertions(+), 1844 deletions(-)
```

| 包组 | 文件变更 | 增/删 | 区间提交数 | 本版主题 |
|---|---|---|---|---|
| `packages/session` | 135 | +8495 / −815 | 52 | V4 迁移边、catalog、投影缓存、JSONL 发布 |
| `packages/core/session` | 21 | +971 / −314 | 21 | `SESSION_FORMAT_VERSION` 3→4、`firstLifecycleSeq`、fork seed |
| `packages/compaction` | 28 | +561 / −231 | 18 | 压力预算重算（headroom / 输出预留） |
| `packages/session-query` | 28 | +463 / −206 | 23 | `SessionPersistence.identity` 接入、tool-result 抽取移除 |
| `packages/context` | 31 | +413 / −254 | 56 | `displayTitle`、source 换代、`FILE_REFERENCE_PROMPT` |
| `packages/storage` | 5 | +24 / −24 | 7 | **仅版本号与一处断言**（无功能性变更） |

本版坐标（来源 `BRIEF.md` 且已用 `git rev-parse` 复核）：

| 项 | 值 |
|---|---|
| 本版 tag | `dsh-v0.1.7-rc.1` = `46a7f68b0922371ce7144b668b90e377d8e799f4`（2026-09-23） |
| 上版 tag | `dsh-v0.1.6-alpha.1` = `0a15e36e7f`（2026-09-15） |
| `SESSION_FORMAT_VERSION` | **3 → 4**（`packages/core/session/src/types.ts:89`） |
| `latestFinalizedVersion` | **4**（`docs/session-format-status.md:32`） |
| `latestReleasedVersion` | **3**，`evidenceTag: dsh-v0.1.5-alpha.1`（`docs/session-format-status.md:45-46`） |
| projection cache 域版本 | `version: 7`，`compatibleVersions: [3, 4, 5, 6]`（**未变**，`session-projection-cache/src/spec.ts:103-104`） |

**一句话总结本版记忆侧**：`SESSION_FORMAT_VERSION` 从 3 跃迁到 4——工具结果成为一等 tool-role 消息、生产者自有 source 取代通用 `plugin` 包装器、新增 `developer/message` 表面事件、`turn/end.reason` 新增 `forked`；同时在读侧补齐了三条**必须与格式变更同批落地**的强制校验（native 跨事件关系、投影检查点 JSON 无损、catalog 未知模式），并把"格式代际"从单一 writer 常量扩展为 **writer / finalized baseline / released** 三元状态。

---

## 概述

五个包组在 0.1.6-alpha.1 之前的职责划分仍然成立，本版没有推翻：

- **R1 持久可恢复**：`packages/session` 提供 `SessionPersistence` 缝与 JSONL 后端（`session-persistence-jsonl`），崩溃后恢复并保持事件平衡；
- **R2 持久化不引入平行事件类型**：持久化只搬运既有 `SessionEvent`，不发明新语义；
- **R3 检索有界**：`packages/session-query` 全部只读（含 SQLite FTS 后端与 `tool-session-query`）；
- **R4 上下文可压缩**：`packages/compaction` 是可选能力缝，把旧范围摘要化并以 `user/message` + `surfaceOp: replace` 替换；
- **R5 格式代际不可回退**：`session-format-catalog` 把 V0→V4 每个相邻边（adjacent edge）冻结为独立代际，前代文件**永不移动、覆盖或删除**。

本版在五条之上追加**第六个需求**：

- **R6 格式变更必须自带读侧强制校验**。官方 note `2026-09-17-native-v4-read-validation.md:9-11` 把理由写得很直白：一个事件可以在满足自身 TypeScript 声明与消息规则的同时**与更早的持久事件矛盾**（"A tool result without an advertised call and a checkpoint naming another compaction both contain locally valid fields"）。若接纳这种矛盾，后续读者就要依赖已损坏的关系，而**发布后再收紧接纳会把已写入的历史卡死**。所以"表示变更"与"强制接纳"必须同批。

因此本版记忆侧的变更可归为三类：**表示换代（V4）**、**读侧强制化**（native 关系校验 / 无损 JSON / catalog 版本接纳）、**读路径性能与身份修正**（投影缓存 listing 身份、打开读协调、子代理按需迁移）。

---

## 核心概念

| 术语（首次出现附英文） | 含义 | 本版是否受影响 |
|---|---|---|
| 会话格式版本（Session format version） | 由 `SESSION_FORMAT_VERSION`（代码内唯一手工维护的 writer 数字）声明的落盘结构代际 | **3 → 4** |
| writer / finalized baseline / released | 三元状态：本地代码写的版本 / 已获接受的兼容基线 / 已被产品发布记录确认的版本 | **本版首次三分**（finalized 4 / released 3） |
| 相邻迁移边（adjacent migration edge） | 只允许 N→N+1 的转换包；每个已发布代际不可移动、覆盖、删除 | 新增 V3→V4 边 |
| 发布代际词汇表（released generation） | `RELEASED_V3_EVENT_TYPES` 这类**冻结**的历史事件名集合，不随当前 writer 增减 | 本版新增（58 项） |
| tool-role 消息 | 一等 `role: 'tool'` 消息，携带必需 `toolCallId` 与可选 `isError`；不再是 user 消息里的 `tool-result` 块 | **本版新增表示** |
| 生产者自有 source（producer-owned source） | 各生产者在自己模块里声明 `MessageSourceMap` 条目；不再有共享的 `{ kind: 'plugin', plugin }` 兜底 | **本版新增** |
| developer 消息 | 承载增量工具增删（`tool-addition` / `tool-removal`）的新表面事件 | **本版新增** |
| fork seed（分叉种子） | 由 `buildForkSeed` 构造的子会话初始日志：继承前缀 + 继承标记 + 子自有收尾事件 | **本版重构** |
| 生命周期身份（lifecycle identity） | 仅凭 header 即可见证的缓存记录身份：`formatVersion + createdAt + cwd + isSeeded` | **本版新增，与 fold 身份分离** |
| fold 身份 | 生命周期身份 + `inheritedEventCount`（精确继承切点）；只有持有 Session 或 body 的调用方才能提供 | 语义不变，用途显式化 |
| cached / sequenced 行 | 客户端投影值仓库的两档行：seq 是否在本连接内可比 | **本版新增 `kind` 字段** |
| 归因策略（attribution policy） | 生产者声明某 literal wire kind 为"仅归因"，读者缺该生产者时也须原样保留内容与 JSON 元数据 | **本版新增机制** |
| 保留字段（reserved field） | 读侧按名拒绝的 JSON 属性：声明为可选 `never` 并标 `@persistenceReserved` | **本版新增机制** |
| payload version | 普通事件 payload 上可选的非负整数 `data.version`，允许旧读者拒载新值 | **本版新增兼容档位** |
| 压力预算 / headroom | compaction 触发阈值不再只看整窗比例，还要扣除路由输出预留与 `headroomTokens` | **本版重算** |

---

## 包结构

### `packages/session/`（20 包）

`git ls-tree --name-only dsh-v0.1.6-alpha.1 packages/session/` 排除三个 README 文件后为 **19 个包**；本版为 **20 个包**，唯一新增的是 `session-format-v3-to-v4`。

| 包 | 职责 | 本版改动规模（源文件 / 测试） |
|---|---|---|
| `session-format-v3-to-v4` | **本版新增**。V3→V4 迁移边 + native V4 接纳规则 | `src/` **17 文件**：`relationships.ts` 385、`migration.ts` 175、`validation.ts` 130、`developer.ts` 113、`tool-role.ts` 112、`sources.ts` 106、`content.ts` 95、`facts.ts` 92、`extension-identities.ts` 79、`codec.ts` 75、`retired-syntax.ts` 75、`references.ts` 68、`system-message.ts` 64、`message-sources.ts` 42、`fork-result.ts` 40、`index.ts`、`testing/validation.ts`；`tests/` **20 文件** |
| `session-format-catalog` | 静态迁移清单装配 | 新增 `src/children.ts`(19)、`src/historical.ts`(21)；`src/generated.ts` 38 行变更；新增测试 `children.spec.ts`(38)、`developer-history.spec.ts`(121) |
| `session-persistence-jsonl` | JSONL 后端：读写、发布、租约、压缩 | 新增 `src/catalog-migration.ts`(92)；`src/index.ts` 172、`src/generation.ts` 37、`src/format.ts` 8 行变更；测试 **+7 文件**（新文件 `catalog-migration.spec.ts` 447、`native-developer-admission.spec.ts` 114、`v3-restart-migration.spec.ts` 99、`current-event-admission.spec.ts` 88、`native-source-admission.spec.ts` 80、`catalog-migration.perf.ts` 77、`retired-content-admission.spec.ts` 57；`migration-refusal.spec.ts` 384 行变更）；**删除** `tests/v3-event-admission.spec.ts`(151) |
| `session-projection-cache` | 零 I/O 列投影读 + fold 检查点 | `src/index.ts` 136、`src/spec.ts` 11 行变更；`cache.spec.ts` 140、`fixtures.spec.ts` 97 行变更；新增 fixture `v7-opaque-session-doc.json`(76) |
| `session-persistence` | 持久化缝（Service Definition） | `src/index.ts` 新增 3 行（`identity`） |
| `session-telemetry` / `-otel` | 出站遥测缝 | `src/coordinator.ts` 13、`src/index.ts` 2 行变更；`telemetry.spec.ts` 96 行变更 |
| `session-format` | 格式协议类型与注册 | `src/json.ts` 2 行变更 |
| `session-format-v0-to-v1` / `-v1-to-v2` / `-v2-to-v3` | 已发布历史边（冻结） | 各 1–2 行（`codec.ts` 各 1；`v2-to-v3/tests/catalog.ts` +21） |
| `session-log-deepseek` | 交付代际上报 | `src/index.ts` +1（`developer/message` 分类）；`upload.spec.ts` 53 行变更 |
| `session-checkpoint-policy` | 检查点策略 | 仅版本号（`crash-recovery.e2e.ts` 4 行） |
| `session-title` / `-llm` / `-first-prompt-llm` / `-all-prompts-llm` | 标题生成族（`session-title-llm/src/index.ts` 9 行变更，属 source 换代连带） | 版本号 + 测试调用点 |
| `session-projection`、`session-stats`、`session-turn-outline` | 投影缝、统计、轮次大纲 | 版本号为主（`projection.spec.ts` 9 行） |

### 其余四组

| 包 | 本版改动规模 |
|---|---|
| `compaction/compaction-basic` | `src/config.ts` 58、`src/index.ts` 24、`src/types.ts` 12、`src/summarizer.ts` 11 行变更；`compaction-basic.spec.ts` 266 行变更 |
| `compaction/compaction` | `src/checkpoint.ts` 6、`src/index.ts` 7、`src/invariant.ts` 5 行变更 |
| `compaction/compaction-image-offload` | `src/image-offload.ts` −2、`src/project-message.ts` −3（移除 `tool-result` 分支） |
| `compaction/compaction-tool-result-pruner` | `src/index.ts` 10 行变更（改读 `message.content`） |
| `compaction/command-compact` | 仅版本号 |
| `session-query/session-query` | `src/observation.ts`（`persistenceIdentity`）、`src/extraction.ts` −2（移除 `tool-result` 分支） |
| `session-query/session-query-sqlite` / `tool-session-query` | 版本号 + 测试 |
| `session-query/session-log-export` | 新增 `src/routes.ts`；客户端文件多处 |
| `context/session-reference` | `src/index.ts`（`projectedLabels`）、`src/types.ts`（`displayTitle`）、`src/projection.ts`（`developer/message` 分支） |
| `context/tmux-context` | `src/index.ts`（`@persistenceAttribution` + `bash.execute` 迁移） |
| `context/agent-instructions` | `src/state.ts` 1 行（source 换代） |
| `context/file-reference` / `-local` | `FILE_REFERENCE_PROMPT` 改写 |
| `context/time-context` | `src/index.ts`、`src/invariant.ts`（source 换代与 shell 缝连带） |
| `storage/storage` / `-domain` / `-json` / `-sqlite` | 版本号与 workspace 依赖范围；`storage-sqlite/src/unit.ts` 1 行 |

---

## 关键类型

**片段 A：writer 常量与新的 turn 结束原因（`packages/core/session/src/types.ts`）**

```ts
// packages/core/session/src/types.ts:89
export const SESSION_FORMAT_VERSION = 4
// packages/core/session/src/types.ts:219-229（TurnEndReasonMap 末尾）
  interrupted: { kind: 'interrupted' }
  /**
   * Fork-seed construction closed a turn that was still open at the fork
   * boundary in the source session. Only fork seeds carry this marker — the
   * loop never emits it — and the source events before the boundary remain
   * intact in the child.
   */
  forked: { kind: 'forked' }
```

**片段 B：保留字段与新增 developer 事件（同文件）**

```ts
// packages/core/session/src/types.ts:244-251
export interface EpochHeader {
  adapterDefaults?: LlmCallConfigAdapterDefaults
  /** Assembled tool schemas; absent for a tool-less request. */
  tools?: ToolSchema[]
  /** Retired request text; system prompts belong to system/message events.
   * @persistenceReserved
   */
  system?: never
}
// packages/core/session/src/types.ts:308-317
  'user/message': UserMessage
  /** An incremental agent session change admitted at the named turn and step. */
  'developer/message': {
    turn: number
    step: number
    message: DeveloperMessage
    /** Earlier request/header defining every tool addition; required exactly when additions are present. */
    headerSeq?: SessionSeq
  }
// packages/core/session/src/types.ts:439-444
export type SurfaceEventType =
  | 'system/message'
  | 'developer/message'
  | 'user/message'
  | 'assistant/message'
  | 'tool/result'
```

`SurfaceEventType` 从 4 类变为 5 类。

**片段 C：消息表示换代（`packages/llm/llm/src/message.ts`；声明所有者不在本篇包范围内，但 V4 字段语义由它定义）**

```ts
// packages/llm/llm/src/message.ts:138-148
interface MessageBase {
  /** Stable identity preserved across every representation boundary. */
  readonly id: MessageId
  /** Exact model-facing blocks. */
  readonly content: readonly ContentBlock[]
  /** Required source fields supplied by the producer.
   * @persistenceSource user developer
   */
  readonly source: MessageSource
}
// packages/llm/llm/src/message.ts:172-180
/** A first-class tool-role message carrying the result of one tool invocation. */
export interface ToolResultMessage extends MessageBase {
  readonly role: 'tool'
  readonly source: ToolMessageSource
  /** Provider-issued id of the tool call this message answers. */
  readonly toolCallId: ToolCallId
  /** Whether the tool invocation failed. */
  readonly isError?: boolean
}
// packages/llm/llm/src/message.ts:187-193
export interface MessageRoleMap {
  system: SystemMessage
  developer: DeveloperMessage
  user: UserMessage
  assistant: AssistantMessage
  tool: ToolResultMessage
}
```

`MessageSourceMap` 里旧的 `plugin: { kind: 'plugin'; plugin: string } & ContextFormed` 条目被删除（`git diff` 显示为 `-`），新增 `'system-prompt': SystemPromptMessageSource`。

**片段 D：fork seed 与生命周期偏移（`packages/core/session/src/fork.ts` 本版新增；`src/index.ts`）**

```ts
// packages/core/session/src/fork.ts:21-29
export function buildForkSeed(events: readonly SessionEvent[], boundary: SessionSeqType): SessionEvent[] {
  const prefix = events.slice(0, boundary + 1)
  prefix.push({
    type: 'session/end-seed', seq: SessionSeq(boundary + 1),
    time: events[boundary]!.time,
    data: { inherited: true },
  })
  return prefix.concat(openTurnClosers(prefix, { kind: 'forked' }))
}
// packages/core/session/src/index.ts:485 / :492 / :612
  readonly firstLiveSeq: SessionLogOffset
  readonly firstLifecycleSeq: SessionLogOffset
  this.firstLifecycleSeq = mode === 'snapshot' && this.header.isSeeded ? inheritedEventCount : this.firstLiveSeq
```

配套收尾构造在 `packages/core/session/src/repair.ts`：`openTurnClosers`(:63) 通用，`interruptedTurnClosers`(:175) 保留崩溃恢复的整数后缀语义。`firstLiveSeq` 语义收窄为"构造种子长度，且不含构造期追加的标记"；`firstLifecycleSeq` 是本版新增的**采集起点**：新 fork 从子自有种子标记与收尾事件开始，恢复会话从完整已存前缀之后开始。

**片段 E：迁移边的入口契约（`packages/session/session-format-v3-to-v4/src/migration.ts`）**

```ts
// :15-27
export const sessionFormatV3ToV4 = defineSessionFormatMigration({
  name: '@deepseek-ai/dsh-session-format-v3-to-v4',
  fromVersion: 3,
  toVersion: 4,
  migrateHeader(header) { assertReleasedV3Header(header); return { ...header, version: 4 } },
  createStage() {
    throw new SessionFormatUnsupportedMigrationError('V3 catalog migration requires explicit historical child facts, including an empty array for a parent without children')
  },
  validateTargetHeader: assertReleasedV4Header,
})
// :34-39
export function createSessionFormatV3ToV4(children: readonly SessionFormatJsonValue[]): SessionFormatMigration {
  return defineSessionFormatMigration({ ...sessionFormatV3ToV4, createStage: input => new ReleasedV3ToV4Stage(input, children) })
}
```

**片段 F：投影缓存的两级身份与去参数化（`packages/session/session-projection-cache/src/index.ts`）**

```ts
// :38-56
type LifecycleIdentity = Omit<CurrentCheckpointIdentity, 'inheritedEventCount'>
type CurrentCheckpointIdentity = CheckpointIdentity & {
  formatVersion: number
  isSeeded: boolean
  // …（另有 createdAt / cwd / inheritedEventCount，见 spec.ts）
}
// :161 / :186 —— 旧版两方法都要求 inheritedEventCount: SessionLogOffset，本版去掉
cachedSnapshot(meta: SessionHeader, keys?: readonly (keyof SessionProjectionMap)[]): ProjectionSnapshot | undefined
cachedPredecessorTitle(meta: SessionHeader): ProjectionSnapshot | undefined
```

**片段 G：检查点值的无损校验（`session-projection-cache/src/spec.ts:29-34`；旧版是 `val: z.json()`）**

```ts
export const checkpointRow = z.object({
  ver: z.number().int().nonnegative(),
  seq: z.number().int().gte(-1).transform((value): SessionSeqCursor =>
    value === -1 ? -1 : SessionSeq(value)),
  val: z.custom<JsonValue>(isJsonValue, { message: 'checkpoint state must be losslessly JSON-serializable' }),
})
```

**片段 H：持久化实例身份（`packages/session/session-persistence/src/index.ts:137`）**

```ts
export abstract class SessionPersistence extends Service {
  /** Process-local instance identity, stable through Context proxies and distinct after service replacement. */
  readonly identity: symbol = Symbol('sessionPersistence')
  // …
}
```

**片段 I：压缩压力预算（`packages/compaction/compaction-basic/src/config.ts`）**

```ts
// :75-77
const headroomTokens = config.headroomTokens ?? 65_536
const maxTokens = config.maxTokens ?? headroomTokens
assertPositiveInteger('BasicCompactionConfig.maxTokens (explicit or from headroomTokens)', maxTokens)
// :187-192（resolveCompactSpec 内）
const messageBudgetTokens = contextWindow - reservedCompletionTokens
const pressureBudgetTokens = messageBudgetTokens - policy.headroomTokens
const thresholdTokens = Math.floor(Math.min(contextWindow * policy.thresholdRatio, pressureBudgetTokens))
const retainTokens = policy.retainTokens === undefined
  ? Math.floor(messageBudgetTokens * policy.retainRatio) : policy.retainTokens
```

**片段 J：压缩检查点 source 换代（`packages/compaction/compaction/src/checkpoint.ts`；旧版为 `{ kind: 'plugin', plugin: 'compact' }`，且谓词返回 `boolean`）**

```ts
// :19 / :49-51
const COMPACT_CHECKPOINT_MARKER = Object.freeze({ kind: 'compact-checkpoint' } as const)
export function isCompactCheckpointSource(source: MessageSource): source is CompactionCheckpointSource {
  return source.kind === 'compact-checkpoint'
}
```

**片段 K：catalog 装配的两个新入口**

```ts
// packages/session/session-format-catalog/src/children.ts:13-18
export function createSessionFormatCatalogWithChildren(children: readonly SessionFormatJsonValue[]): SessionFormatCatalog {
  const migration = createSessionFormatV3ToV4(children)
  return createSessionFormatCatalog({
    ...sessionFormatCatalogOptions,
    migrations: sessionFormatCatalogOptions.migrations.map(edge => edge === sessionFormatV3ToV4 ? migration : edge),
  })
}
// packages/session/session-format-catalog/src/historical.ts:9-21（摘要）
/** V0–V3 decoding for historical child identity; never publishes or completes parent catalogs. */
export const historicalSessionFormatCatalog = createSessionFormatCatalog({
  currentVersion: 3,
  codecs: [releasedV0SessionFormatCodec, releasedV1SessionFormatCodec, releasedV2SessionFormatCodec, releasedV3SessionFormatCodec],
  currentEncoder: releasedV3SessionFormatCodec,
  migrations: [sessionFormatV0ToV1, sessionFormatV1ToV2, sessionFormatV2ToV3],
  restoreCurrent: artifact => restoreReleasedV3Artifact(artifact, RELEASED_V3_EVENT_TYPES),
  // …
})
```

`historicalSessionFormatCatalog` 的 `currentVersion: 3` 是**有意的**：它只用于读取历史子会话的发现事实，**永不发布、永不补全父 catalog**。

---

## 数据流

### D1. 打开一个历史（V3）会话

```text
SessionPersistence.open(id, { forWrite })
  ├─ findLog(id)                          选择物理代际文件（文件名 version 后缀）
  ├─ requireStoredLog(id)
  │    └─ SessionLogScanner（session-persistence-jsonl/src/format.ts）
  │         ├─ assertV4RowAdmission(decoded, KNOWN_SESSION_EVENT_TYPES)   ← :493，先于可恢复尾巴抑制
  │         ├─ restore.decodeRow(row) × N
  │         └─ finish(): assertReleasedV4Relationships(artifact, KNOWN)   ← :468
  ├─ read 模式  → status: 'prepared'（内存中的 V4 产物，不落盘）           ← index.ts:373
  └─ write 模式 → publishStoredMigration(id, prepared)                    ← index.ts:387
                   └─ 再次 validateRelatedSources()（子会话物理修订未变） ← generation.ts:906 / :981
                      然后写 V4 后继文件，前代文件保持字节不变
```

**读打开不写盘**，写打开才发布后继；`validateRelatedSources` 在准备返回前与发布前**各校验一次**（`PrepareJsonlMigrationOptions` 新字段注释："Revalidate related source facts before preparation returns and immediately before publication"）。

### D2. 列出一个冷会话（零 I/O 投影读）

```text
session.list
 └─ session-controller list.ts::projectionsFor(header)
      └─ sessionProjectionCache.cachedSnapshot(header, keys?)
           ├─ lifecycleIdentityOf(header)          ← :405，只用 header 四字段
           ├─ table.get(header.id)                  ← 单键查表
           ├─ currentLifecycleMatches(record.identity, expected)
           └─ viewRecord(record, keys)              ← asOfSeq = 所有被服务行的最低水位
      └─ 退回 cachedPredecessorTitle(header)（跨格式边的 title-only 例外）
 └─ 响应中该 block 带 kind: 'cached'
     → 客户端 ProjectionValueStore.applyCached(values)（无条件替换 cached 行，忽略 sequenced 行）
     → 会话被真正打开时 seed(baseline) 先丢弃所有 cached 行，再写入 sequenced 基线
```

### D3. 历史父会话的 catalog 补全

```text
打开父会话 A（V4 准备）
 └─ prepareCatalogFacts(parentId, sources, compression, signal)   ← catalog-migration.ts:31
      ├─ 对每个直接子 B：stat（记录 dev/ino/size/mtimeNs/ctimeNs 见证）
      ├─ readDecodedJsonlSource(B, version, …)
      │     ├─ version ≤ 3 → historicalSessionFormatCatalog（V0–V3，currentVersion: 3）
      │     └─ version ≥ 4 → sessionFormatCatalog（native）
      ├─ 头部一致性校验（id/createdAt/parentSession/origin/cwd/isSeeded/delegationDepth/agentPreset）
      │     └─ 不一致 → JsonlGenerationSourceChangedError（拒绝发布）
      ├─ historicalChildCatalogSource(artifact) → 事实（descriptor 计数 + 首个 payload）
      └─ 失败 → 记录占位（descriptorCount: 0, descriptor: null），继续处理其余子会话
 └─ createSessionFormatCatalogWithChildren(facts) → V3→V4 阶段按 [第 7 节] 判定表决定 mode
```

### D4. 自动压力压缩的判定

```text
BasicCompactionEngine 自动路径（compaction-basic/src/index.ts:304-317）
 ├─ llm.resolveModelInfo(provider, model) → { context, defaultMaxTokens }
 ├─ reservedCompletionTokens(agent, info.defaultMaxTokens)
 │     = session.requestHeader()?.config.maxTokens ?? adapterDefault ?? 0
 ├─ resolveCompactSpec(policy, contextWindow, reservedCompletionTokens)
 │     ├─ messageBudget  = contextWindow − reservedCompletionTokens
 │     ├─ pressureBudget = messageBudget − headroomTokens（默认 65536）
 │     ├─ thresholdTokens = floor(min(contextWindow × thresholdRatio, pressureBudget))
 │     └─ retainTokens    = retainRatio 时按 messageBudget 缩放
 └─ measurement.totalTokens < spec.thresholdTokens → 不压缩
```

### D5. 归档一个正在运行的会话（宿主侧）

```text
WorkspaceRegistry.archiveSession(sessionId)                     ← 默认拒绝
 └─ workspace/session-activity（waterfall）询问各 provider：turn / job / subagent / schedule
 └─ 非空 → WorkspaceActiveSessionError → Remote 映射 workspace/session-active
archiveSession(sessionId, { stopActivity: true })               ← 用户确认后
 ├─ 跳过活性检查，先写归档集（pre-step gate 读的就是它）
 ├─ workspace/session-stop（parallel）分发停止请求，不等待结算
 │    ├─ agent.cancel({ kind: 'user' })（无 keepInbox）
 │    ├─ job kill / subagent cancel（持久 lineage、任意深度、never a fork）
 │    └─ schedule：作为管理删除，走同一事务队列
 └─ API Session Controller 的 agent/pre-step 拒绝归档会话（或其后代）的 step → 循环以 blocked 结束
```

---

## 测试覆盖

统计方式：`git ls-files <group> | Where-Object { $_ -match '\.(spec|e2e|test)\.tsx?$' }`，行数用 `Get-Content -ReadCount 0`。

| 包组 | 测试文件 | 测试代码行 | 本版重点新增 |
|---|---|---|---|
| `packages/session` | 96 | 28535 | `session-format-v3-to-v4/tests/` **20 个新文件**（`tool-role.spec.ts` 458、`developer.spec.ts` 302、`migration.spec.ts` 220、`relationships.spec.ts` 218、`content.spec.ts` 208、`validation.spec.ts` 188、`catalog-completion.spec.ts` 179、`codec.spec.ts` 162、`interrupted-turn.spec.ts` 160、`fork.spec.ts` 154 等）；新文件 `catalog-migration.spec.ts` 447、`native-developer-admission.spec.ts` 114、`v3-restart-migration.spec.ts` 99，另有 `migration-refusal.spec.ts` 384 行变更 |
| `packages/core/session` | 17 | 6203 | 新文件 `tests/developer-header.spec.ts`(109)；`tests/fork.spec.ts` 296、`tests/repair.spec.ts` 149、`tests/surface.spec.ts` 87 行变更 |
| `packages/compaction` | 13 | 6404 | `compaction-basic.spec.ts` 266、`image-offload.spec.ts` 61、`manual-compaction.spec.ts` 52 行变更 |
| `packages/session-query` | 17 | 9148 | `session-log-export` 的 `routes.ts` 与客户端改动、`sqlite.spec.ts`、`tracing.spec.ts` |
| `packages/context` | 12 | 8365 | `session-reference.spec.ts`、`tmux-context.spec.ts`、`time-context.spec.ts` |
| `packages/storage` | 5 | 1373 | 无功能性测试变更 |
| **合计** | **160** | **60028** | — |

官方在 V4 变更文档里给出的验证口径（`docs/persistence-changes/2026-09-16-session-format-v4.md:106-115`）可直接引用："the focused Session, agent-loop, Session Controller, V4, chat-view, and compaction suites passed 1,523 tests across 63 files after integration of exact-cut forks"；"the focused Session, V4 and request-input suite passes 884 tests across 38 files, with 100% statements, branches, functions and lines for the complete V3-to-V4 package and Session surface"；"the producer-source and request-input checks pass 447 tests across 12 files … reports four changed roots and 447 unchanged type fingerprints"。

> 上述数字来自官方发布说明，本篇未在本地复跑测试，**未核实**其可重复性。

---

## 与上下游的关系

| 方向 | 对象 | 关系 |
|---|---|---|
| 上游 | `packages/core/session` | 定义 `SessionEventMap`、`SESSION_FORMAT_VERSION`、`Session`；本篇所有格式语义由它声明，且它自身也在范围内（+971/−314） |
| 上游 | `packages/llm/llm` | 定义 `MessageBase` / `MessageRoleMap` / `MessageSourceMap`；V4 的 tool role 与 producer source 由它声明 |
| 上游 | `packages/storage/storage-domain` | 提供 schema 校验的 KV 域；`session_projcache` 域建在它之上 |
| 下游 | `packages/api/session-controller` | 消费 `session.projections`、`session.list`、`SessionPersistence.identity`；本版新增 `projections` 与 `workspacePathApplications` Remote |
| 下游 | `packages/subagent/subagent` | 消费 `subagent/catalog` 投影（含新增 `unknown` 模式）；`list-children.ts` 用 `cachedSnapshot` 的 body fallback 判定 seq 归属 |
| 下游 | `packages/client/*` | 消费 `SessionProjectionHints.kind`（`cached` / `sequenced`）决定写入路径 |
| 下游 | `packages/deliverables/workspace-changes` | 唯一写入 `workspace/changes` 事件的插件；Web changed-files 卡片是唯一消费者 |
| 下游 | `packages/core/agent-loop` | 通过 `agent/pre-step` 与 `turn/end` 参与归档 gate 与 fork 收尾 |
| 同级 | `packages/attachment`、`packages/spill` | 与日志耦合但**本篇不在包范围**（BRIEF 指定范围不含这两组） |

---

## 本版本变更要点（0.1.6-alpha.1 → 0.1.7-rc.1）

### 1. 会话格式 V4：本版最重的跃迁

#### 1.1 声明与范围

声明文件 `docs/persistence-changes/2026-09-16-session-format-v4.md`（120 行）以 `schemaVersion: 1` 的机器可读 YAML 逐 root 列出前后指纹。**共 14 个 root**，全部 `decision: version-bump`（`:28-84`）：

| root | 前一记录 | 本版后指纹（前 12 位） | root | 前一记录 | 本版后指纹（前 12 位） |
|---|---|---|---|---|---|
| `SessionHeader` | `2026-09-11-initial` | `1a3440e35773` | `event:session/title-llm-request` | `2026-09-14-image-offload` | `fa8f7d3ebf08` |
| `event:agent/inbox/spliced` | `2026-09-14-image-offload` | `1506a9b82249` | `event:system/message` | `2026-09-14-image-offload` | `69081694be23` |
| `event:assistant/attempt` | `2026-09-14-image-offload` | `15d5dfdd822a` | `event:team/message/queued` | `2026-09-14-image-offload` | `21fb6a90d506` |
| `event:assistant/message` | `2026-09-14-image-offload` | `1033093edd0d` | `event:tool/ptc-dispatch` | `2026-09-14-image-offload` | `100f6dca1468` |
| `event:compaction/summary` | `2026-09-14-image-offload` | `e2f9a41e0989` | `event:tool/result` | `2026-09-14-image-offload` | `7c9f44e90a00` |
| `event:developer/message` | **null（新 root）** | `eef4ef54dc7a` | `event:turn/end` | `2026-09-14-image-offload` | `0f8512903d94` |
| `event:request/header` | `2026-09-11-initial` | `4208123b50df` | `event:user/message` | `2026-09-14-image-offload` | `3a72db3d87a0` |

官方的解释（`:90`）值得抄录：tool-role 声明**之所以改动十个事件 root，是因为 inbox 条目、message 事件、compaction 摘要、标题请求、team 消息与 PTC dispatch 都内嵌了共享的 `Message` 或 `ContentBlock` 声明**——移除 `tool-result` 出联合并特化消息角色会改变这些可达 schema，"without adding ten independent event protocols"。`turn/end` 单独记录 `forked` 原因；`SessionHeader` 记录版本递增。

产物规模：`2026-09-16-session-format-v4.schema.json` **16212 行 / 373 KB**；`finalized/v4.json` **379 行 / 12.8 KB**；`historical-formats/v3.md` **5634 行**；`historical-formats/v3.schema.json` **61307 行 / 1402.7 KB**；重新生成的 `docs/persistence-catalog.md` **5542 行 / 332.6 KB**（`+5186 / −3110`）。

#### 1.2 确切字段/语义差异（V3 → V4）

以下每条都可对照官方 `2026-09-16-session-format-v4.md` 的 Compatibility 段与迁移包 `README.md` 的规格表。

**(a) tool 结果表示**

| V3 | V4 |
|---|---|
| `tool/result.data.message.role: 'user'` | `role: 'tool'` |
| `data.message.content[0]` 是 `{ type: 'tool-result', toolCallId, content, isError? }` | 包装器**消失**：`data.message.toolCallId`（必需）、`data.message.content`（直接数组，可为空）、可选 `data.message.isError` |
| `tool-result` 属于 `ContentBlock` 联合成员 | `tool-result` **离开** content-block 联合；在其它被解释位置出现即**拒载** |
| `data.error` 允许当且仅当 tool-result 块 `isError: true` | `data.error` 允许当且仅当**消息**有 `isError: true` |

迁移实现见 `session-format-v3-to-v4/src/tool-role.ts` 的 `liftToolResult`（要求非空 message id、`source: { kind: 'tool', callId }` 且 callId 非空、恰好一个指名同一 call 的 `tool-result` 块、块 content 必须是数组、可选 `isError` 必须是 boolean）。包装器独有字段变为 `plugin:result:<原字段>`，外层消息除 `id`/`role`/`source`/`content` 外的字段变为 `plugin:message:<原字段>`；`__proto__` 与 `constructor` 自有数据保持完整。

**(b) 生产者自有 source**

`MessageSourceMap` 删除 `plugin: { kind: 'plugin'; plugin: string } & ContextFormed`。V3→V4 边持有**冻结的重命名表**（迁移包 `README.md:122-132`）：

| V3 精确 `plugin` | V4 `kind` |
|---|---|
| `compact` | `compact-checkpoint` |
| `tools-code-mode`、`tools-ptc` | `ptc-mode` |
| `dsh-compaction-basic` | `compact-basic` |
| `@deepseek-ai/dsh-system-prompt`（system 角色 / 其它角色） | `system-prompt` / `runtime-context` |
| 25 个同名一方生产者（`agent-instructions`、`session-reference`、`team-message`、`goal`、`skill-invocation`、`skill-catalog`、`coordinator`、`subagent-report`、`subagent-settled`、`webhook`、`agent-message`、`model-selection`、`plan-mode`、`time-context`、`tmux-context`、`user-approval`、`repeat-tool-reminder`、`tool-cordis`、`cordis-host-runner`、`tool-goal`、`tool-jobs`、`hooks-codex`、`hooks-claude-code`、`schedule`、`dsh-session-title-llm`） | 原 plugin 字符串本身 |
| 其它任意 plugin 名 | `plugin:` + 完整原名 |

直接 source kind（含未知与已带前缀的 kind）**保留原 kind 与全部自有 JSON 字段**。规则明确："There is no recursive source search."

**(c) 新增 developer 事件**

`developer/message` 是**新的表面事件**（5 类之一），承载 `tool-addition` / `tool-removal` 块。约束（迁移包 `README.md:256-262`）：事件必须 `turn` / `step` 为正数、role 为 `developer`、message id 非空、content 是数组；每个增删块必须有非空 `toolName`，且 **addition 拒绝任何自有内联 `tool` 字段**（即使它本来只是可选 JSON 元数据）；**含 addition 的事件必须有 `headerSeq`**，它指向一个更早的、已知的 `request/header`，该 header 必须恰好含一个完整匹配的 `ToolSchema`（有 string `description` 与 object `parameters`），缺失/前向/类型错/未知/歧义/不完整定义一律拒绝；不含 addition 的事件必须**省略** `headerSeq`；同名替换、重启、fork、表面替换与压缩**保留记录的历史 schema 身份**，不查询最新 header 或当前 registry；可选的 `deferLoading` 标记与 addition 历史**互相独立**；"No shipped profile emits developer records"——provider 序列化、自动发射与 UI 支持**仍为延期项**。

**(d) `turn/end.reason` 新增 `forked`**

只有 fork seed 构造会写 `{ kind: 'forked' }`，循环永不发射。精确 cut 的 fork 在继承标记**之后**追加子代理自有的 error 结果与收尾；V4 接纳带确定性分支专用 ID（`forked-tool-result-<callId>-<seq>`）与措辞的 checked not-started fork 结果，措辞**不被归一化**为崩溃恢复文本。已开始的 fork 调用用 `TOOL_OUTCOME_UNKNOWN` 结果并保留其记录的 start 引用。两类都必须按生命周期规则结算一个已广播的调用。

**(e) `request/header.header.system` 保留**

`EpochHeader` 新增 `system?: never` 并标 `@persistenceReserved`。官方口径（`:96`）："This declaration captures the existing native-reader refusal without changing stored data or prompt reconstruction; later permitting a value requires a version bump instead of being classified as an ordinary optional-field addition." 这条与本版新增的通用机制相关——`docs/persistence-changes/README.md` 本版新增："When a reader rejects a JSON property by name, declare the property as optional `never` and mark it with argument-free `@persistenceReserved`. The extractor retains the forbidden field, so allowing a JSON value later requires an existing-field type change. Required or JSON-valued properties cannot carry this marker."

#### 1.3 迁移策略：自动迁移，不是拒载

**结论：V3 源文件是"打开即自动迁移"，不是拒载。**

| 场景 | 行为 | 证据 |
|---|---|---|
| 读打开 V3 文件 | 在**内存**中产出 V4 产物（`status: 'prepared'`），**不落盘** | `session-persistence-jsonl/src/index.ts:373` |
| 写打开 V3 文件 | 先 `publishStoredMigration`（`:387`），同目录写出 V4 **后继**，前代字节不变 | 同上；v4 声明 `:94`："Write opens revalidate child membership and revisions before publishing the current successor beside unchanged predecessor files." |
| V0–V2 输入 | 先经各自已有边升到 V3，再走 V3→V4 | 迁移包 `README.md:69` |
| 已在 V4 的文件 | 不重跑 V3→V4；native 校验返回**同一 artifact**，不合成 catalog 条目、fork 结果或修复字段 | 迁移包 `README.md:209` |
| 冲突身份 / 时间戳 / 模式 | **拒绝迁移，不发布** | v4 声明 `:94`："conflicting identities, timestamps, or modes refuse migration without publication." |
| 子会话日志不可读 / 描述符字段非法 | **不拒绝父会话**：JSONL 隔离该子会话、保留其 header 身份，父 catalog 追加 unknown 模式条目 | note `2026-09-19-session-local-subagent-migration.md:15` |
| 源在准备后被改动 | `JsonlGenerationSourceChangedError` 拒绝发布 | `generation.ts` 的 `validateRelatedSources` 两处调用 |

一个容易踩的坑：**V3 body 恢复必须显式提供子证据集**。`createStage()` 无参数时直接抛 `SessionFormatUnsupportedMigrationError`（`migration.ts:23-25`），"an empty array explicitly declares no children"（迁移包 `README.md:51`）。

#### 1.4 读写兼容窗口

| 读者 → 日志 | V0–V3 日志 | V4 日志 |
|---|---|---|
| V4 writer（本版） | ✅ 经相邻边链迁移 | ✅ native 接纳 |
| V3 writer（0.1.6-alpha.1 及更早） | ✅ 原样 | ❌ **拒绝**（"V3 readers refuse the newer generation"，v4 声明 `:94`） |
| 旧读者（V0–V2） | 各自代际内 | ❌ 拒绝 |
| 降级 | — | ❌ **官方不支持回退** |

格式参考文档体系（`docs/persistence-changes/historical-formats/README.md`）覆盖"每一个从 0 到 checkout writer 的整数"；本版新增 `v3.*` 三件套。`v3.md:28` 记录了 V3 快照的来源："The source is the initial tree of PR #4320 on `release/session-log-v4`, recorded by the empty commit dated 2026-09-16 and titled `chore(session): initialize V4 release integration PR`."——即**V4 writer 变更之前的 V3 完整清单**。

#### 1.5 版本状态：writer 已 V4，但"已发布格式"仍是 V3

本版把"格式代际"从一个常量拆成**三个独立权威**（`docs/session-format-status.md`，本版 +20 行）：

```yaml
# docs/session-format-status.md:31-33（本版新增段）
latestFinalizedVersion: 4
# docs/session-format-status.md:44-46
latestReleasedVersion: 3
evidenceTag: dsh-v0.1.5-alpha.1
```

- **Checkout writer**：`SESSION_FORMAT_VERSION`（代码内唯一手工维护的当前 writer 数字）；`scripts/gen-session-format-catalog.ts` 推导 codec 顺序并检查相邻边能到达它。文档明确："A package version, codec export name, fixture filename, or projection-cache version is not the writer authority."
- **Finalized baseline**：`latestFinalizedVersion: 4` + 检查点 `docs/persistence-changes/finalized/v4.json`（379 行，含每个 root 的 kind/digest 与已接受记录的语义哈希）。"Finalization does not freeze every future V4 addition and does not assert publication."
- **Release record**：`latestReleasedVersion: 3`，证据 tag `dsh-v0.1.5-alpha.1`。

运营含义（官方明示，`:24`）："An alpha, beta, or release-candidate product publication establishes released Session-format obligations. GitHub's prerelease flag does not make persisted user data disposable. A missing release record is not evidence of non-publication." 由此推出两条实际结论：从 writer V3（0.1.5-rc.2 / 0.1.6-alpha.1）升到 V4 会触发 **V3 → V4 就地迁移**（打开即迁移，写出 V4 后继，前代保留且不再被写入）；**降级不受支持**——回到 V3 writer 会拒载 V4 文件。

本版还新增了 `finalized/vN.json` 的机制说明（`docs/persistence-changes/README.md`）："`finalized/vN.json` records the complete root classifications/digests of an accepted compatibility baseline and semantic hashes of its accepted records." 维护者通过 `scripts/persistence-finalization.ts` 的 `createPersistenceFinalizationCheckpoint` 捕获，"writes a new version-named checkpoint without replacing an earlier one"。

同一 README 的兼容规则表本版新增两行 `same-version` 档位：给普通事件加更高的数字 `data.version` 并保留**所有**旧 payload 备选不变；给 user/developer source 槽加**显式限定**的归因 kind 且前后 schema 携带同一受支持策略。`version-bump` 门槛写死为"Make an optional property required, add a required property, change an existing type, or remove/rename a property or event"与"Change the Session header or event envelope"。

#### 1.6 V3 词汇表冻结与一次性迁移脚本

`docs/cookbook/adding-a-session-format-version.md` 本版新增两节：

- **Final V3 event vocabulary before V4 publication**：在 V4 尚未发布而 master 仍可能新增合法 V3 事件类型的窗口内，每次 master 集成后要用 `pnpm run verify-v3-event-vocabulary --source-ref "$(git rev-parse --verify 'origin/master^{commit}')"` 对比迁移包持有的 `RELEASED_V3_EVENT_TYPES`。该集合实测 **58 项**（`session-format-v3-to-v4/src/extension-identities.ts:8`），带 `jscpd:ignore-start` 与模块注释 "This historical list must not inherit additions or removals from the current Session event list." 单独加名字**不构成**完整迁移。
- **Developer V4 corpus trial**：一次性脚本 `pnpm run migrate:sessions-to-v4`（`scripts/migrate-sessions-to-v4.ts`），默认根 `~/.dsh/sessions`；并发 `--jobs`（默认 CPU 数、上限 16）；每个历史会话走正常加锁、校验、发布路径，V4 会话只读打开；**不发模型请求**，也不改转换或拒绝规则。报告写到系统临时目录（`migration.log` 与 `summary.json`），任何失败返回非零退出码。并发转换可能使父会话的子证据失效，**只有** source-change 错误会在首轮全部结束后做一次串行重试。

### 2. native V4 读校验（跨事件关系强制通过）

note：`.agents/notes/implemented/architecture/2026-09-17-native-v4-read-validation.md`（33 行）。

**问题**（`:9-11`）：tool-role 结果无法通过已发布的 V3 user-role 表示来校验而不投影掉当前字段；而"一个事件满足自身 TypeScript 声明与消息规则"**不等于**"与更早的持久事件不矛盾"。若接纳矛盾，后续读者就要依赖已损坏的关系，而发布后再收紧会把已写入的历史卡死。

**决定**（`:15`）：V4 格式 restorer 与当前 JSONL scanner **共用同一个强制的跨事件关系通过（mandatory cross-event relationship pass）**，在暴露已恢复 artifact 或 storage handle 之前运行。校验内容：turn/step 顺序；已广播的 tool call 与结算；PTC 父子关系与结算身份；retry 链与请求 provider；人类消息的标题引用；command 完成引用；compaction 归属与当前 span；受保护的 system 头部。

关键实现事实（`:15-19`）："The installed event set controls semantic interpretation"（已安装事件集控制语义解释，含 compaction 预通过与标题引用）；"Unknown ignorable records retain their payloads and original positions; known records remain validated even when marked ignorable."；JSON 参数比较**检查自有属性**（Node 与 worker 都是），继承的原型成员不能充当记录字段；未完成的尾巴可以保留开着的 turn / step / tool call / compaction，而**收尾事件必须结算它关闭的关系**；继承的未完成 compaction 以 `session/end-seed` 标记结束，**不约束子会话的生命周期**；修复消息身份在更早迁移改变序列坐标后**保留其历史数字后缀**。

落地位置：

| 位置 | 行为 |
|---|---|
| `session-persistence-jsonl/src/format.ts:493` | `assertV4RowAdmission(decoded, KNOWN_SESSION_EVENT_TYPES)`——**先于**可恢复尾巴抑制，独立于严格解码器状态 |
| `session-persistence-jsonl/src/format.ts:468` | `SessionLogScanner.finish()` 内 `assertReleasedV4Relationships(artifact, KNOWN_SESSION_EVENT_TYPES)` |
| `session-format-v3-to-v4/src/relationships.ts`（385 行，本版新增） | 代际自有的关系校验实现 |

**被替代方案**（`:27-29`）：把 V4 投影回冻结的 V3 校验视图（会把当前接纳耦合到已退役表示，并诱使新字段在投影中消失）；依赖可选的运行时 invariant（脱离的读者与恢复路径可能不安装诊断伴生包——"A required relationship must be checked before publication or consumption of the restored Session."）。

### 3. projection checkpoint JSON 无损化

note：`.agents/notes/implemented/architecture/2026-09-19-lossless-projection-checkpoint-json.md`（24 行）。

**问题**（`:9`）：投影检查点可以包含不透明的扩展数据与消息元数据。一个名为 `__proto__` 的 JSON 键是**普通记录数据**。Zod 的 JSON 解析器在重建对象时会丢掉这个自有键，于是"重新打开一个合法检查点得到的投影状态"会与"重放会话日志得到的状态"**不一致**。

**决定**（`:13`）：检查点值 schema 改用 `dsh-util-values` 的既有谓词 `isJsonValue`。它强制与检查点写入方 `snapshotJsonValue` **相同的无损 JSON 规则**，但不重建合法对象。storage-domain 的表值是**不可变借出记录**，校验器不提供防御性拷贝保证。实现即 `session-projection-cache/src/spec.ts:33`。

**被替代方案**（`:17-18`）：保留 `z.json()`（对象重建会移除合法自有键，导致"校验成功但仍改变值"）；用 `snapshotJsonValue` 校验并克隆（保住键但会拷贝本已不可变的存储值——只读谓词才符合 storage-domain 的借出值契约）。

**影响面**（`:22-24`）：域读取保留检查点值里的**每一个合法自有键**，含嵌套的 `__proto__` 与 `constructor`；**domain 版本不变**——存储的 JSON 表示未变，本改动修正的是它的读取方（实测 `spec.ts:103-104` 前后都是 `version: 7` / `compatibleVersions: [3, 4, 5, 6]`）；**Session 格式版本与历史代际不变**；回归覆盖用**真实写入方**产出的合成 fixture 打开、写入、关闭、经 `StorageDomain` 重开（新增 `tests/fixtures/v7-opaque-session-doc.json`，76 行）。边界：投影自己的 `stateSchema` 仍拥有它的 hydration 值；承载不透明字段的投影**必须使用能保留键的校验**。

### 4. projection cache：listing identity 与 cached/sequenced 两档行

note：`.agents/notes/implemented/architecture/2026-09-19-projection-cache-listing-identity-and-cached-rows.md`（166 行，本版最长的架构 note）。

#### 4.1 缺陷与机制

**现象**（`:9`）：Host 进程重启后，每个 fork 出来的会话（`SessionHeader.isSeeded === true`）在侧栏列表里**没有标题**，`@` 引用补全只显示 session id，列表排序退化为创建时间；打开一次即恢复全部。note 记录了一次真实测量：某开发机 241 条 projcache 记录中有 44 条是 seeded，44 条**都带合法 `title` 行**，而列表**一条都没读**。**这不是缓存损坏、也不是版本不匹配**（`:11`）：记录 domain version 7、`identity.formatVersion` 4，两者都是当前值；缺陷在读路径。

**机制**（`:15-25`）：缓存记录绑定**生命周期身份** `formatVersion + createdAt + cwd + isSeeded + inheritedEventCount`，由 `identityMatches` 做**全等**匹配；自 #3346 起 `inheritedEventCount` **不再出现在逻辑 header 中**（header 只保留 `isSeeded` 位，精确 cut 跟随 body）；自 Session 格式 v2（#3398）起物理 header 行**也不再存 `seedLength`**，读者从 body 中 `session/end-seed { inherited: true }` 标记的 seq 推导 cut。因此**纯 header 读无法获得 cut**：JSONL 后端的 `fromHeaderLine` 对 header-only 读**硬编码 `inheritedEventCount: 0`**，而 `SessionPersistenceSnapshot` 只携带 header、revision 与可选 eventCount。三个 header-only 缓存消费者都长出了同一道 guard：

| 消费者 | guard | 回退 | 后果 |
|---|---|---|---|
| `packages/api/session-controller/src/list.ts` `projectionsFor` | `header.isSeeded ? undefined : cachedSnapshot(header, 0) ?? cachedPredecessorTitle(header, 0)` | 无 | 无标题、无 `sessionListMetadata`；blank 回退 `false`，排序回退 `createdAt` |
| `packages/context/session-reference/src/index.ts` `projectedLabels` | 同上 | 无 | `@` 补全按 id 标注；标题不可搜 |
| `packages/subagent/subagent/src/list-children.ts` `resolveColdIdentity` | 同上 | `observeSession` 读 body | 结果正确，但每个 seeded 子会话多一次 body 读 |

时间线上的三个推手：guard 落地（#3346，2026-09-01）时 `list.ts` 还有 `probeSmallCold`（命中缓存失败且日志 ≤ `DEFAULT_COLD_BLANK_PROBE_MAX_BYTES = 1024` 字节时读 body），但它只为空白会话检测、从不适用于普通 fork；#3400（2026-09-03）移除它；**#4320（2026-09-19）把 fork 变成一等特性**（`packages/core/session/src/fork.ts`，任意 seq 分叉），于是每个 fork 都是 `isSeeded: true` 且带精确 cut，seeded 会话从个位数变成几十个，重启后全部变冷，缺陷一次性显形。

#### 4.2 决定：两个读面，只在 fold 面比对 cut

| 读面 | 身份 | 谁能提供 | 方法 |
|---|---|---|---|
| 只读列表面 | 生命周期身份：`formatVersion + createdAt + cwd + isSeeded`，全部来自 header | 任何 header-only 调用方 | `cachedSnapshot(header, keys?)`、`cachedPredecessorTitle(header)` |
| fold 面 | 生命周期身份 + `inheritedEventCount` | 持有 Session 或其 body 的调用方 | `hydratePrepared`、`write`、`coldSnapshot`，都经 `recordFor` |

两个只读方法**不再接受 cut 参数**；`inheritedEventCount` 仍写入每条记录，fold 面仍全等比对。note 给出的四条论证（`:62-65`）：(1) 在一个 `formatVersion` 内，日志的 cut 由 `(id, createdAt, cwd, isSeeded)` **决定**——它在 fork 创建时固定，只有改变基数的格式迁移才能改动它，而那种迁移必然抬升 `formatVersion`，**cut 是生命周期的派生事实而非独立坐标**；(2) 只读面此前实际行为是未 seeded 调用方传常量 0（构造上恒真）、seeded 调用方**从不调用**，cut 从未与任何真实事实比对过，移除它**不改变拒绝集**；(3) 只读面**从不 seed、从不回写**，其输出是存储记录的纯函数；(4) 唯一新增暴露是"四字段全等但 cut 不同"的记录，**系统无法产生它**——只有手工拷贝会话目录并编辑文件才行，即便如此列表也只显示该记录的值直到会话被打开，且不会有任何东西进入 fold。

消费者改动（`:69-73`）：`list.ts` 与 `session-reference` 去掉 `isSeeded` 分支与 `SessionLogOffset(0)`；`list-children.ts` 只跟随签名，`!header.isSeeded` guard 与 body 回退**保留**——因为它需要 cut 来把 seq 分类为继承或自有，那是 fold 语义。

#### 4.3 客户端行分档：`cached` vs `sequenced`

客户端每个会话恰有一个 `ProjectionValueStore`（`manager.projectionStores`），列表 block、打开时的历史首页基线、控制基线、推送帧、重命名结果**全部写入同一个对象**，`useProjection` 读它。旧规则是"所有写入者平等，higher-seq-wins"，于是**seq 等于或高于基线 cut 的列表提示会存活**；而列表提示的 seq 来自磁盘记录，崩溃修复截断后它可能**数值上高于**已连接游标——恰好是"缓存错、连接对"的情形。"Comparing seqs against a hint is the wrong tool."（`:45`）

| 行 | 含义 | 携带 |
|---|---|---|
| `cached` | 无 Session 时从持久检查点查看；其 seq **与本连接不可比** | 仅 `value` |
| `sequenced` | Host 在本连接内为该 Session 计算；seq 共享一个空间 | `value` + `seq` |

| 写入 | 对 `cached` 行 | 对 `sequenced` 行 |
|---|---|---|
| `applyCached(values)` | 替换 | **忽略** |
| `seed(baseline)` | 先丢弃所有 `cached` 行，再写 block；省略的键在 `seq <= cut` 下清除 | higher-seq-wins |
| `apply(key, value, seq)` | 替换 | higher-seq-wins |

写入者分类（`:98-104`）：`session.list` 响应里每个 summary 的 `projections` block 按其 `kind` 路由（冷会话 `cached`，活会话 `sequenced`）；`api-session/added` 的 summary block（实践上 `sequenced`）；历史首页 `projections.seed` → `sequenced`；控制基线（仅活会话）→ `sequenced`；`refreshProjections` 结果 → `sequenced`；推送帧 → `sequenced`；重命名成功后的 `title` → `sequenced`。`seed` 与 `apply` 签名不变；`asOfSeq` 保留**各来源自己的水位**语义。

**被替代方案**（`:125-137`）中值得记住的两条：把 cut 写回物理 header 行（代价是 V4 刚落地就再来一次格式代际，且反转 #3346 的决定——被拒）；用 `asOfSeq: -1` 哨兵代替 `kind`（一个字段承载两种含义，PR review 复现了回归——延迟到达的、cut 更低的控制基线覆盖了更新的列表值——被拒）。行名从 `hint` / `authoritative` 改成 `cached` / `sequenced`，因为"规则的依据是 seq 可比性，不是信任"。

#### 4.4 代价与测试

**买到的**（`:141-146`）：重启后 fork 会话立刻显示标题、`sessionListMetadata`（blank、lastPromptAt）与其它缓存 wire 值，并按最后提示时间排序；`@` 补全能按标题显示并搜索 fork；连接数据**无条件**替换列表提示，与 seq 顺序无关；缓存身份的两级有了名字——生命周期身份回答"这是不是同一份日志"，fold 身份回答"这份记录能不能续一次 fold"。

**付出的**（`:148-154`）：`cachedSnapshot` 与 `cachedPredecessorTitle` 签名变更（3 个调用方跟随）；`SessionProjectionHints` 新增**必需**字段 `kind`（每个列表 summary 生产者与每个构造它的测试 fixture 都要带）；四字段相同但 cut 不同的手工记录会在列表显示到会话被打开；基线省略的键会连同其提示一起清除（例如 Host 未挂载 `schedule` 时，列表提示的 schedule 标记在会话打开后消失）；旧记录（domain v4/v5，缺 `isSeeded` 与 `inheritedEventCount`）对 seeded 会话仍会 miss，直到会话被打开并重写成 v7 记录。

**测试**（`:158-166`）：`session-projection-cache/tests/cache.spec.ts`（seeded 冷 header 经 `cachedSnapshot(header)` 拿到所有版本匹配行；未 seeded header 被拒绝服务同一 id 的 seeded 记录；`coldSnapshot` cut 匹配时续行、不匹配时重折全日志、未 seeded 非零 cut 抛错；`cachedPredecessorTitle(header)` 只从更旧 `formatVersion` 的 seeded 记录服务 `title`；不同水位的行构成一个 block，其 `asOfSeq` 取最低行）；`session-controller/tests/session-cold.host.spec.ts`（seeded 冷 summary 带 `kind: 'cached'`、`title`、`sessionListMetadata`，`updatedAt` 取 `lastPromptAt`，查询了缓存且**未读 body**）；`session-projections.host.spec.ts`（经 `sessions.fork` 造真 fork → checkpoint 入 projcache → 释放整个 Context → 在同一存储根上重启 Host → 仅凭 header 从 `session.list` 读到 `kind: 'cached'` 的 `title` 与 `sessionListMetadata`，`inspect` 与 `open` **从未被调用**）。`session-projection-cache/README.md` 也同步改写（4 行），把三个方法明确分成 "read-only face" 与 "fold face"（`coldSnapshot` 归入 fold 面）。

### 5. 持久化归属策略（attribution policy）与 source 换代

note：`.agents/notes/implemented/architecture/2026-09-17-persistence-attribution-policy.md`（35 行）。

**问题**（`:9`）：生产者自有的消息 source 会**传递性**出现在多个持久事件类型里；新增一个归因 kind 即使读者在没有该生产者时也能原样保留其字段，仍会改变这些事件的联合指纹。另一方面，**仅用于请求**（request-only）的 prompt 不需要持久身份，但把它们构造成 Session 消息就会给联合增加不必要的 source 备选。

**决定**（`:13`）：core 持有的 user-message source 属性**绑定**已记录的兼容策略；生产者可以单独**限定**自己的 literal wire kind 为"仅归因"。两个已保存 schema 都必须携带兼容的策略状态，一个被限定的新增才能拿到 same-version 分类。既存备选仍做结构比较；缺策略、未限定的新增、移除、以及既有语义组的改动**保持严格分类**。固定的 system / model / tool source 字段不参与。

落地机制（`docs/persistence-changes/README.md` 本版新增段）：抽取器接受显式的 `@persistenceSource` 绑定（core 持有的 source 属性，literal user 或 developer 角色）——**不从无注解类型推断**；生产者用 `@persistenceAttribution` 限定其 `MessageSourceMap` 条目；限定承诺两件事——未知 kind 及其 JSON 元数据在**缺该生产者**时也能存活读取，且该 kind **不施加**校验、重放或权限要求；生产者**可以**检查自己的 kind 以恢复重复抑制，其他读者必须保留并按记录派生消息而不做那个投影；记录下来的 schema 保留绑定、策略版本、literal `kind` 判别式、保留承诺与已限定 kind 集合；**inventory format 2** 存这些承诺，无绑定策略的抽取保持 format 1；**Session 格式版本相互独立**，两个被比较的快照必须携带兼容的策略状态。

实例（`packages/context/tmux-context/src/index.ts:28-34`）：

```ts
declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    /** Location attribution; readers preserve the content without this producer.
     * Its projection uses the kind to avoid repeated injection.
     * @persistenceAttribution
     */
    'tmux-context': { kind: 'tmux-context' } & ContextFormed
  }
}
```

其自身投影用该 kind 避免重复注入（`index.ts:236-238` 把旧的 `source.kind !== 'plugin' || source.plugin !== name` 改成 `source.kind !== name`），而**没有**该生产者的读者保留记录内容与全部 source JSON 属性。

**`RequestMessage` 拆分**（note `:17`）：它现在接受一个持久 `Message` **或**一个仅用户侧的 `RequestUserInput`（有 content、无 `id`、无 `source`）。LLM 服务与 provider 序列化器接受两者；**Session 写入、Agent 投递与持久化的标题请求输入要求持久消息**。Auto Review 的外层 prompt 与 compaction 摘要器的最终指令改用 request-only 输入，保留其内容与冻结语义；**调用方不会得到隐式持久转换**。最终化的 V4 acknowledgement 记录 user-source 策略并**移除那两个 request-only source 注册**（note `:19`）；这**不**授予"移除已接受变体"的通用例外。

连带落地（本版实测）：

| 位置 | 变化 |
|---|---|
| `packages/context/agent-instructions/src/state.ts:96` | `source: { kind: 'plugin', plugin: name }` → `source: { kind: name, form: 'instructions', changes: [] }` |
| `packages/compaction/compaction/src/checkpoint.ts:19` | `{ kind: 'plugin', plugin: 'compact' }` → `{ kind: 'compact-checkpoint' }` |
| `packages/compaction/compaction/src/index.ts:25-31` | 为 `MessageSourceMap` 声明合并 `'compact-checkpoint'` |
| `packages/session/session-log-deepseek/src/index.ts:80` | 交付上报的 switch 新增 `case 'developer/message':` |
| `packages/context/session-reference/src/projection.ts:54` | 会话投影 switch 新增 `case 'developer/message':`（与 `system/message` / `tool/result` 一起 no-op） |

### 6. 工作区变更事件（workspace/changes）

声明：`docs/persistence-changes/2026-09-14-workspace-changes-event.md`（48 行）。

```yaml
changes:
  - root: "event:workspace/changes"
    previous: null          # 新 root
    after: "e308ccf867a5398e316e0af8cb6ce238a8d33a63b9b384c8250a686786285f72"
    decision: same-version  # 同版本内新增 root
```

- 它是**只记录日志（log-only）**的事件，payload 形状为 `'workspace/changes': { turn: number }`（`docs/persistence-catalog.md:1279`），记录顶层 turn 改动了哪些文件；
- **不进入模型可见面**："The event is appended only by the Web bundle's workspace-changes plugin and is never model-visible; the Web changed-files card is its only consumer and reads the latest event per turn."（`:38`）
- 旧日志不含该事件因而仍然合法；**早于它出现的读者会拒载携带它的日志**——因为 `SessionEventMap` 成员默认"读时必需"，除非事件带 envelope 的 `ignorable: true`（`:38`）；
- 已加入 `KNOWN_SESSION_EVENT_TYPES`（`packages/core/session/src/known-event-types.ts` 本版 +2 行，另一行为 `developer/message`）；
- 验证口径（`:43`）：`pnpm exec vitest run packages/deliverables/workspace-changes packages/client/ui-deliverables` → 165 tests passed；`snapshots/web/changed-files-turn` 通过 Web profile 重放该记录事件。

> 事件的生产者包 `packages/deliverables/workspace-changes` 与消费者属第 10 篇范围；本篇只记录它对**会话日志格式**的贡献。

### 7. unknown child catalog：未知模式子会话的保留

声明：`docs/persistence-changes/2026-09-20-unknown-child-catalog.md`（48 行）。

```yaml
changes:
  - root: "event:subagent/catalog"
    previous: "2026-09-11-initial"
    after: "3abae7324356f155cb42450c00b806d134ec93bd6439d2063b8d724162d58604"
    decision: same-version
```

这是本版新增的 "payload version" 兼容档位的**首个用户**：**Catalog payload v0 不变**；**payload v1 新增 `unknown` 模式**；当前读者接受 v0 与 v1；完整事实仍用 v0；**迁移为未知子会话发出 v1**；现有日志无需重写，**Session header 保持 V4**；**旧读者拒绝 v1**。分类器规则（`docs/persistence-changes/README.md` 本版新增）："The classifier allows higher event payload versions only when all old payload alternatives remain unchanged; same-version widening and removal of old readers stay breaking."

迁移侧的判定表（迁移包 `README.md:143-151`）：

| 可用证据 | 迁移决定 |
|---|---|
| 一个 version 1 描述符 | 要求 string provider 与 label；推导 `mode: 'continuable'` |
| 一个 version 2 或 3 描述符 | 要求 string provider；按 catalog 规则用其 mode 与可选 label |
| 零描述符，或不支持的描述符版本 | 保留既有父条目；否则追加 unknown 模式成员 |
| 多于一个自有描述符 | 保留既有父条目且不比对 mode/label；否则追加 unknown 模式成员 |
| 已有自有父条目 | 保留它与其 extension；在恰好一个受支持自有描述符可用时要求子创建时间与 mode/label 匹配 |
| 缺自有父条目且有完整受支持证据 | 追加 version-0 catalog 事实（子 id、创建时间、mode、可选 label） |
| 缺自有父条目且无完整证据 | 追加 version-1 `subagent/catalog`，带 header 身份与 unknown 模式，**不发明 label** |

辅助事实的收集契约（`historicalChildCatalogSource()`）：子必须 `origin: 'subagent'` 且有直接父；补充事实要求 `childId`、非负安全整数 `childCreatedAt` 与 `descriptorCount`、以及一个 `descriptor` 属性（无描述符表示为 null）；可选 `sourcePath` 保留给诊断。重复自有子 id 被拒绝。未知模式条目**保留 header 身份而不宣称有受支持的子描述符**。阶段只在**最终继承 cut 之后**考虑父 catalog 记录——每个继承标记都会丢弃更早的 catalog 候选且不解释其 payload；缺失条目在所有源事件之后追加，按创建时间再子 id 排序，使用稠密的新 seq，时间为最终源事件的时间（空日志则用 header 创建时间）。它们**既不进入模型表面、也不改变继承计数**。

### 8. 会话本地子代理迁移：只迁移被打开的那一个

note：`.agents/notes/implemented/bug-fix/2026-09-19-session-local-subagent-migration.md`（33 行）。

**问题**（`:9`）：打开一个历史父会话需要来自其直接子会话的发现事实。子会话 body 损坏、描述符非法、或同一 root 下别处有不可读 header，都可能**拒绝父会话的 V4 准备**，从而隐藏本来可读的历史。

**决定**（`:13`）：打开 A 时通过 header 发现候选 B 会话、读它们**自己的**描述符，并补全 A 的 catalog。历史子读用 V0–V3 catalog；当前子读用 native 校验。**这些读既不准备 B 自己的 catalog，也不发布 B 的后继**——打开 B 才单独执行 B 的迁移与 catalog 准备。前端发现保留其父 catalog 来源。未知模式行仍可浏览；`list_agents` 仍只选择已知的可续子会话。

JSONL 的具体行为（`:15`）：**不可读或不支持的 header 从发现中省略**；子 body 或描述符字段失败 → 产生带子路径的 warning，并**保留子 header 身份**；父缺完整条目时，迁移追加 `subagent/catalog`，投影为 `mode: 'unknown'`，与健康兄弟并列；既有完整条目仍权威；取消与来源一致性失败仍中止操作；被检查的子修订（**包括解码失败的**）在复用与发布前**重新校验**，使修复不能静默复用陈旧证据；已发布前代**保持字节相同**。

这条 note **部分取代**了 `2026-08-31-released-session-format-migrations.md` 的子失败传播规则与 `2026-09-19-v3-incomplete-child-catalog-evidence.md`（`:17`）；它们的格式转换、描述符基数、冲突校验与不可变发布规则仍有效。后者的核心结论是"The V3→V4 migration appends a complete missing parent catalog entry only when exactly one supported own child descriptor supplies its discovery fields."，其中一条值得记住的否定结论（`:21`）：**不能**取"第一个或最后一个描述符"——`foldSubagentDescriptor()` 在建立 provider 的 exactly-once 规则下取第一个，身份投影取最后一个以覆盖继承身份，多个自有记录**违反该规则**，所以回填要求"恰好一个自有记录"，而不是在这些消费者策略之间做选择。

测试口径（`:33`）：raw 与压缩路径覆盖 catalog 补全、子本地错误、来源变更与修复、未变的子代际、以及**延后的子 catalog 准备**；随包发布的 Web 迁移快照检查"父 catalog 带一个损坏兄弟"的情形，然后独立打开子会话；其新增的历史子会话把语料预算从十个角色抬到十一个，guard 拒绝第十二个。

### 9. 进程本地空白会话（blank session 复用）

note：`.agents/notes/implemented/architecture/2026-09-17-process-local-blank-sessions.md`（35 行）。

**问题**（`:9`）：两个共享 Session 存储的 Host 在打开同一 Workspace 时可能选中**同一个空白会话**。空白会话已经拥有活 Agent、接受斜杠命令，且可能在创建检查点后**握有 writer 锁**。未被持有的持久空白会话还携带在 Host 重启后仍然有用的命令设置。

**决定**（`:13`）：Session catalog **包含持久化的空白会话**；**启动恢复**选择保存的空白会话，**普通 Workspace 导航**按 catalog 顺序选第一个合格的非归档成员；**显式 id 的 `session.create`** 恢复该会话并在打开历史**之前**获取其 writer；**只有 `session/writer-held` 触发新建**，其它错误向上传播；同一 Client 内并发的 Workspace 连接**共享**该获取与回退，后续导航取消待决的启动选择；Agent 在其整个生命周期内保留已获取的句柄——"Checking ownership and releasing a probe lock would leave a race before resume."；**不把 PID 或进程身份写入持久数据或 Remote schema**。

**被替代方案**（`:19-27`）：纯客户端草稿（斜杠命令与会话级插件在第一次 prompt 前就需要真会话）；释放活空白会话的 writer 锁（"Blank means no `turn/start`, not no events"——活 Agent 仍可追加命令与配置事件）；隐藏所有冷空白会话；持久化创建者 PID（内核层面的 writer 所有权已经在仲裁获取，PID 复用与陈旧创建者记录不增加任何权威）。

**后果**（`:31`）：一个 Host 可以复用**自己的**活空白会话，或回收一个无主的持久空白会话（连同其斜杠状态）；不同 Host 创建不同的空白；**被持有的选中空白会导致新创建，即使还有别的空白空闲**——导航不会去搜另一个候选；不新增清理；从两个 Host 打开同一已建立会话仍可能遇到 writer 争用；未知投影提示仍可见但**不做冷 body 扫描**；非争用的获取失败会中止 New Session，且**目前只报告到 console**，隐藏空白在该流程里没有恢复动作。

### 10. 会话打开读协调（open-read coordination）

note：`.agents/notes/implemented/bug-fix/2026-09-20-session-open-read-coordination.md`（88 行，本版最长的 bug-fix note）。

#### 10.1 问题

打开历史会话时，`session.follow`、composer catalog 预热、以及**带 Agent 参数的 RPC**可能并发访问同一冷日志（`:9`）：`skills/list`（自己就要完整观察）、`commands/list`、`goals/get`、`fileReferences/list`、`sessionReferenceResolver/candidates`（后四者在参数解析期经 Agent 查找发起 resume）。不等待历史打开快照的辅助请求会与主对话**争抢**读取、解析与投影计算，而不是复用已完成结果。

第二个问题（`:11`）：复用已完成观察时，Cordis **对同一服务的不同访问可能返回不同代理对象**；比较 `ctx.get('sessionPersistence')` 返回的对象引用会把同一个底层服务误判为不同实例。但完全移除实例身份检查也不安全，因为**持久化 revision 只在对应服务实例与会话身份内可比**。

第三个问题（`:13`）：子代理导航混合两种需求——在已知地址显示对话，以及发现其父/后代 catalog。在经既有父子地址导航**之前**刷新父投影会增加前置工作，并可能**拒绝**一个在 Client catalog 缓存缺失时 Host 本可校验并打开的地址。

#### 10.2 三个决定

**(a) 用服务自有的 Symbol 标识缓存生产者**（`:17-21`）。`SessionPersistence.identity` 是 `Symbol('sessionPersistence')`，每服务实例创建一次（实测 `session-persistence/src/index.ts:137`）。代理访问保留该值，替换服务实例则得到不同值。已准备的观察缓存同时比对 Session id、`persistence.identity` 与 `stat().revision`；同实例同 revision 才复用已完成的准备。该身份**只存在于进程内**，不进入 Session header、事件或持久文件。既有缓存容量、租约、live 优先与 revision 失效语义不变。注意边界："This fix does not merge Promises for unfinished cold reads; stable identity prevents false invalidation after completion, not duplicate concurrent work across all callers." 实现即 `session-query/src/observation.ts:57`：`PreparedEntry.persistence: SessionPersistence` → `persistenceIdentity: symbol`，`cachedEntry` 签名随之改为收 symbol（`:204`、`:211`）。

**(b) 辅助 RPC 等待当前对话的首次打开成功**（`:23-36`）。Client 在**实际 RPC 调用点**使用既有的 `sessions.using()`，而不是只延迟预热钩子：

| Client 消费者 | 等待后调用的 RPC | 临时引用来源 |
|---|---|---|
| Skill catalog | `skills/list` | `skillCatalog` |
| Command catalog | `commands/list` | `commandCatalog` |
| Goal 激活状态 | `goals/get` | `goalActivation` |
| `@` 文件与会话候选 | `fileReferences/list`、`sessionReferenceResolver/candidates` | 共享 `referenceCandidates` |

`sessions.using()` 先等 `reference.ready`，再等操作返回的 Promise，最后释放引用。**`ready` 意味着首次 `Session.open()` 尝试已结算，而不是成功**；这些消费者还要求 `openState === 'open'`，打开失败后不发任何辅助 RPC。Goal 读者额外检查其捕获的绑定未被替换，并记录被拒绝的读**而不清除**已有显示状态。每个操作先检查目标是否已有 Client 绑定，使后台预热不会重新打开已关闭的会话。Skills 保留共享 catalog 请求自己的取消信号；`@` 查询用当前候选请求的信号做历史等待与两个 RPC。未加引号的 `@` 查询在等待后**仍并发**取文件与会话，带引号的路径仍只查文件。Commands 与 Goals **不获得新的取消协议**。这些引用只保留 Client 数据与 follow 流，不授予新的 Host Agent 权限，也不禁止打开快照之后的正常 Agent resume。

**(c) 对话用 follow；catalog 分支保留显式读**（`:38-45`）。主对话的打开 `follow` 快照已携带该会话的完整投影基线；共享投影值后续变更会通知订阅者，因此切换会话或打开菜单**不需要**再读同一基线。主视图导航**不**单独刷新所选会话的投影；恢复保存的子代理地址**不**预取其父；侧栏**直接**从其完整父子地址保留目标子会话，不把父 catalog 读当作打开对话的前提；header 下拉的 `changeOpen` 只改呈现状态、不刷新 `rootSessionId`，子展开与失败读重试在 UI 回调名 `refreshProjection` 下保留显式刷新，底层 `sessions.refreshProjections` API **未改名**；Team 导航用既有 Lead 与 roster 成员 id 直接打开 `{ parentSessionId, childSessionId, mode: 'continuable' }`，既不刷新父 catalog，也不要求目标存在于 Client catalog 中。**已知地址不免除授权检查**（`:47`）：打开子历史时，Host 仍检查目标自己的 header parent 与 origin，以及它自己 `subagent` 投影中的 mode 与描述符所有权。

#### 10.3 实现范围与已知缺口

**明确不在范围内**（`:51-55`）：Session 格式、迁移、Host 观察的 `all | none` 策略、`session.projections` 的响应字段均未变；**没有**全局冷读 singleflight，Agent 查找**没有**被普遍替换为只读查找；`SessionManager.handleConnected()` 仍会批量刷新先前请求过的 catalog，本决定**不保证**重连时只冷读一次；工具侧 `listDescendants` 在缓存未命中时仍可读子会话，Client 展开子节点仍可能冷读该节点；`@` 会话候选仍枚举 header 并从活投影或投影缓存取名字、未命中回退 id，既有排序、默认上限 50 与直接子代理分组不变，发现过程**不递归**遍历 `subagentCatalog`。

**验证与已知缺口**（`:79-81`）：本地在一次导航到长历史主会话时，用户观察到重复的 `readColdSessionLog` 调用在临时计时器与调用栈下收敛为一次，并验证了直接队友导航——"This result describes that operation's cold-read helper invocation count, not every underlying file I/O, every reconnect scenario, or a single unit of end-to-end cost."；**完整改动没有 gate、行为测试或装配后 Web 快照验证结果**；既有测试只有部分回调改名，仍包含旧的 fixture 名、root 菜单打开的刷新预期、侧栏父刷新前置条件、以及 Team 对缺失 catalog 的拒绝。"These are known verification gaps, not passing checks." 还有一个具体覆盖缺口（`:75`）：缺失的 header root catalog 仍是缺口——若它属于一个未打开的父会话且没有其它来源提供该 catalog，**只打开下拉菜单不会取到它**，当前 UI 可能继续显示加载提示。

### 11. 会话钉住与侧栏归档（仅宿主侧语义）

> 客户端 UI 部分归第 10 篇；本节只写**宿主侧会话状态语义**，即落到持久化与 registry 的部分。

note：`.agents/notes/implemented/feature/2026-09-18-session-pin-and-sidebar-archive.md`（79 行）。

**宿主侧持久化契约**（`:15`、`:45`）：`dsh-workspace` registry 以 **Session id 数组**存储 registry-global 的钉住集与归档集（`pinnedSessionIds` / `archivedSessionIds`），并提供持久的 `pinSession` / `unpinSession`；pin 数组**最近钉住的 id 在最前**；**钉住与归档互斥**——归档在**同一次持久写入**中丢弃该会话的 pin，钉住一个已归档会话以 `WorkspaceArchivedSessionPinError` 失败；Workspace KV、Remote 值与 Client 快照都以 Session id 数组存归档与钉住成员关系，**没有对象包装、没有 pin 时间戳**，缺失集合默认空，**不接受对象形式的 pin 条目**；**钉住与恢复都不改变 Workspace domain 版本，也不改变 Session-log 格式**，且都不编辑会话日志。

`WorkspaceRegistry.unarchiveSession` 在**与归档及其它 registry 写入相同的串行操作链**上移除一个 id；**缺席的 id 是幂等 no-op**（无持久写入、无通知）；**unarchive 不做会话存在性探测**——"removing an id cannot introduce an unknown referent"，因此即使某个条目的会话已经消失也能移除而不列举持久化；Remote 返回**完整归档集**，既有 `archived` increment 把同一状态带给其它 Client；Client 只在它仍是最新归档集请求时安装 unary reply——更新的请求、follow increment 或替换基线会取代它；写失败保持集合不变，侧栏记录拒绝并保留该行——除了"运行中工作"的拒绝，它会打开 stop-and-archive 确认对话框。

**归档与运行中工作**（note `2026-09-21-archive-stops-running-session-work.md`，41 行）：

旧行为是"纯可见性写入"（`:9`）：`WorkspaceRegistry.archiveSession` 只把 id 加进归档集，于是一个在 turn 中途被归档的会话**继续在看不见的地方运行**——agent、其工具子进程与模型请求都跑到结束，而归档行**故意不显示状态点**，所以没有任何东西告诉用户 agent 还在花 token。后台子代理、被拥有的 job、或到期提醒同样可以继续工作或在隐藏会话里开新 turn；Web 表面**从不**销毁 Agent，所以暴露一直持续到 Host 进程退出。

新决定（`:13-19`）：

- registry 拥有规则并声明**一个能力缝**：`workspace/session-activity`（waterfall）询问 provider 该会话仍在跑什么；`workspace/session-stop`（parallel）请求它们停止。provider 像任何插件一样在 root 上注册监听器，因此 **workspace 包不认识 agent / job / schedule 词汇**。`SessionActivityKindMap` 在 workspace 包内是空的：每个 provider 从它两个 face 都导入的模块合并自己的族（Agent registry 的 `turn`、`job`、`subagent`、`schedule`），渲染这些的消费者导入那些模块来处理自己的 case，并对任何其它键落到通用行；
- **默认拒绝**：`archiveSession(sessionId)` 对非空活性回答以 `WorkspaceActiveSessionError` 拒绝，API 映射为 `workspace/session-active`，其 details 携带各族与条目 id/label。"A caller that did not ask to stop work never hides it, whichever client or SDK it is."；
- **请求时停止，且在写入之后**：`archiveSession(sessionId, { stopActivity: true })` 跳过活性检查、写归档、**然后**派发停止事件——"the durable archive set is what the pre-step gate reads"，所以停止诱发的每个唤醒（被取消子会话的结算、排队的 follow-up）**已经被阻断**。停止被发出且**从不等待结算**，Remote 在每个 provider 的请求都发出后立即返回，用户的行使立刻隐藏；停止失败是**记日志的 warning，不是撤销归档的理由**；
- **停止就是用户的停止**：Agent registry 用 `agent.cancel({ kind: 'user' })` 取消 turn（停止按钮的路径，所以被中止的工具调用结算为 `tool/result`、turn 以 `aborted` 结束，但**没有**按钮的 `keepInbox`，所以排队输入被丢弃并记录一次 inbox splice）；job registry 缝杀掉被拥有的 job（由它的构造器为每个实现安装，经抽象 `list` 与 `kill`）；Subagent runtime 取消正在运行的子代理后代（持久 lineage、subagent origin、任意深度、**永不是 fork**），如其父所为；Schedule 插件在其事务队列中把每个活动提醒作为管理删除删掉——与 `schedule_delete` 工具记录的**同一次持久变更**、在同样的两个持久屏障之间。每个请求**各自被隔离**，一个抛错的子会话或 job 不会让其它继续运行；
- **归档意味着没有模型 step**：API Session Controller 的 `agent/pre-step` 监听器拒绝为已归档会话（或其子代理后代）提议的 step，循环以 `blocked` 结束且不发请求。这关掉了"迟到的唤醒投递（子代理结算、排队 follow-up、活性回答与写入之间启动的 turn）会跑一个隐藏 turn"的窗口，并让一个忽略 cancel 的子会话无法为一个没人看得见的父会话工作；取消归档会为整条 lineage 解除该 gate。

**为何 gate 不能搬进 `dsh-workspace`**（`:33`）：owners 现在依赖它的类型，所以 workspace 包若依赖 Agent 事件词汇就会成环。

**已接受的残留**（`:39`）：写入优先顺序与 gate 带来两个残留——(1) 归档写入与 Schedule 插件删除屏障之间崩溃，会留下一个归档会话**其提醒仍被记录**；取消归档会把它们重新显示出来，就像从未请求过停止；(2) 冷归档会话**不报告提醒**，而一个恢复其 Agent 的操作（重命名、换模型、队列编辑——这些操作寻址会话而**不取消归档**）会**重新武装**它们：一个到期的一次性提醒随后把 follow-up 派发进一个被 gate 以 `blocked` 结束的 turn，因此那一次发生被消耗掉且没有模型 step，取消归档后也不重放。同 note 还附了同类产品调研（`:41`）：Codex 与 Kimi Code 先停后归档；Claude Code 通过让远端会话缺写来停止；Reasonix 与 MiniMax 拒绝忙碌会话（MiniMax 在一个有界 cancel 之后）；Pi 没有归档但在每次会话切换前中止；OpenCode 既不拒绝也不停止。**每个会停止的产品都走它自己的普通 cancel 路径，以便日志正常结束。**

### 12. compaction：输出预留与 headroom 预算

先回答直接问题：**`docs/subsystems/compaction.md` 在本区间完全没有改动**（`git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- docs/subsystems/compaction.md` 无输出）。压缩**策略**（摘要替换 + `surfaceOp: replace`）未变；新的是**压力预算算法**与**检查点 source 表示**。

#### 12.1 压力预算重算

区间内的提交序列（`git log --oneline dsh-v0.1.6-alpha.1..dsh-v0.1.7-rc.1 -- packages/compaction`）：

```text
0fadb08fbd fix(compaction): gate pressure on the message budget, not the whole window
a1cebebd40 refactor(compaction): drop the spec's reservedCompletionTokens field
b02b20d713 fix(compaction): pin output caps and cover proactive reserve replay
555b664b08 fix(compaction): reserve configurable 64K pressure headroom
9b016b6425 refactor(compaction): require an explicit output reservation
ec7030afd3 fix(compaction): default summary output cap to headroom
```

最终形态（`compaction-basic/src/config.ts`）：

| 项 | 旧 | 新 |
|---|---|---|
| 触发阈值 | `floor(contextWindow × thresholdRatio)` | `floor(min(contextWindow × thresholdRatio, messageBudget − headroomTokens))` |
| 保留预算（ratio 模式） | `floor(contextWindow × retainRatio)` | `floor(messageBudget × retainRatio)` |
| `messageBudget` | 不存在 | `contextWindow − reservedCompletionTokens` |
| 新配置字段 `headroomTokens` | 不存在 | 非负整数，默认 `65_536`；可按 model policy 覆盖 |
| `maxTokens` 默认 | `8192` | **`headroomTokens`**（即显式或默认的 65536） |
| 摘要输出预留 | 无 | `reservedCompletionTokens(agent, defaultMaxTokens)` = `session.requestHeader()?.config.maxTokens ?? adapterDefault ?? 0` |

新增两条 fail-loud 诊断（`TargetPressureConfigError`）：`messageBudgetTokens <= 0` 时提示"reserves N completion tokens of its M-token context window, leaving no message budget; configure the adapter model's contextWindow above the effective request maxTokens"；`pressureBudgetTokens <= 0` 时提示要么降低有效请求 `maxTokens`、要么降低 compaction `headroomTokens`、要么配置更大的 adapter contextWindow。`ResolvedCompactSpec` 本版显式排除 `headroomTokens` 并新增 `contextWindow` 注释（"Adapter-declared full window; token budgets below exclude reserved output tokens."）。`compaction-basic/tests/compaction-basic.spec.ts` 本版 266 行变更，是除 V4 迁移包外本区间单文件测试增幅最大的一处。

#### 12.2 检查点 source 换代

`compaction/src/checkpoint.ts` 的标记从 `{ kind: 'plugin', plugin: 'compact' }` 改为 `{ kind: 'compact-checkpoint' }`，`isCompactCheckpointSource` 同时**升级为类型谓词**。连带改动：`compaction/src/index.ts` 为 `MessageSourceMap` 声明合并 `'compact-checkpoint'` 并重新导出类型；`compaction/src/invariant.ts` 的 `validateCheckpoint` 签名从收 `event: SessionEvent<'user/message'>` 并在内部 `as` 断言 source，改为直接收 `source: CompactionCheckpointSource`，去掉了 `as typeof event.data.source & Partial<...>` 这类断言；V3→V4 的冻结重命名表把 V3 的 `plugin: 'compact'` 映射到 `compact-checkpoint`。

#### 12.3 tool-result 展平的连带

`tool-result` 离开 content-block 联合后，所有遍历 content 的代码都要改：

| 位置 | 变化 |
|---|---|
| `compaction-tool-result-pruner/src/index.ts:148-155` | 从 `original.content[0]`（tool-result 块）取 `result.content` 改为直接修剪 `original.content`；替换消息从 `content: [{ ...result, content }]` 改为 `content` |
| `compaction-image-offload/src/image-offload.ts:37` | **删除** `else if (block.type === 'tool-result') { visit(block.content) }` |
| `compaction-image-offload/src/project-message.ts:27` | **删除**对应的 `tool-result` 投影分支 |
| `session-query/session-query/src/extraction.ts:78` | **删除** `case 'tool-result': return block.content.flatMap(blockText)` |

### 13. session-query：便利 API 精简仍是 proposed

BRIEF 指定的 note `.agents/notes/proposed/simplification/2026-09-19-trim-session-query-convenience-api.md` 位于 **`proposed/`** 目录（不是 `implemented/`），而**代码证实它未落地**。

note 的提议（`:15`）是移除 `SessionQueryEngine` 的四个方法 `readSession`、`readTitle`、`readTitleSnapshot`、`listEvents`，加上未引用的 `SessionLogSnapshot` 结果类型与 `eventRecords`，理由是它们"without executing first-party product callers"，约占 80 行源定义。

**实测复核**（`packages/session-query/session-query/src/index.ts`，本版该文件**根本不在变更列表里**）：`readSession`(:184)、`readTitle`(:220)、`readTitleSnapshot`(:233)、`listEvents`(:269) 四个被提议移除的方法**全部仍在**；`readTitleSnapshots`(:251)、`filterEvents`(:280)、`readSurface`(:310)、`observeSession`(:140) 亦在。`git diff --name-status` 对本组只列出 `src/extraction.ts`、`src/observation.ts` 与 tests/package.json——`src/index.ts` 未改。

**结论：本条是 proposed，未实施。** 唯一相关的实际改动是：`observation.ts` 接入 `SessionPersistence.identity`（见 [第 10 节 (a)](#102-三个决定)），对应提交 `6fef0f0af9 fix(session-query): stabilize persistence cache identity`；以及 `extraction.ts` 移除 `tool-result` 文本抽取分支（见 [12.3](#123-tool-result-展平的连带)），其保留注释说明了这一决定："ContentBlockMap is merge-extensible. Unknown blocks do not become searchable merely because their payload happens to contain strings." `docs/subsystems/session-query.md` 在本区间**无改动**（与 proposed 状态一致）。

### 14. context 包组：session-reference 的 displayTitle 与 source 换代

#### 14.1 `SessionReferenceCandidate.displayTitle`

`packages/context/session-reference/src/types.ts` 新增可选字段：

```ts
/** Display and canonical-mention text, preferring a subagent's durable creation label over {@link label}. */
displayTitle?: string
```

配套改动（`src/index.ts`）：`projectedTitle(record): string | undefined` 被替换为 `projectedLabels(record): { label: string; displayTitle: string }`；读投影时同时取 `['title', 'subagent']`（活会话走 `sessionProjections.snapshot`，冷会话走 `sessionProjectionCache.cachedSnapshot(record.header, ['title', 'subagent'])`）；**去掉了 `if (record.header.isSeeded) return undefined` 的 guard**——这正是 [第 4 节](#4-projection-cachelisting-identity-与-cachedsequenced-两档行)那条缺陷在 `@` 补全上的表现；过滤条件新增 `displayTitle` 参与大小写不敏感的 substring 匹配；`mentions()` 的 canonical mention 改为优先用 `displayTitle`。`src/projection.ts` 的会话投影 switch 新增 `case 'developer/message':`；`src/index.ts` 新增 `import type {} from '@deepseek-ai/dsh-subagent'`（为了 `subagent` 投影键的类型合并），并移除 `SessionLogOffset` import。

官方文档同步：`docs/subsystems/session-reference.md`（13 行变更）把 `listCandidates` 的 `@param query` 从 "session-id/cwd/title substring" 改为 "session-id/cwd/title/display-title substring"，`@returns` 从 "candidates labeled by latest title or, when absent, session id" 改为 "candidates with canonical mention labels and presentation titles"。

#### 14.2 其余 context 改动

| 包 | 改动 |
|---|---|
| `agent-instructions` | `src/state.ts:96` 的 source 换代：`{ kind: 'plugin', plugin: name }` → `{ kind: name, form: 'instructions', changes: [] }` |
| `tmux-context` | 新增 `@persistenceAttribution` 声明（见第 5 节）；`src/index.ts:134` 把 `bash.run(...)` 改为 `(await bash.execute(bash.resolve({ command, signal }))).result()`（shell 缝接口异步化，属第 03 篇主题）；投影判定改用 `event.data.source.kind !== name` |
| `file-reference` | `FILE_REFERENCE_PROMPT` 改写：从"Tokens prefixed with @ are workspace paths the user explicitly referenced, relative to the workspace root."改为"Tokens prefixed with @ are paths the user explicitly referenced. Relative paths resolve from the workspace root; absolute paths identify files or directories on the host."——**模型可见文本变更** |
| `time-context` | `src/index.ts`、`src/invariant.ts` 随 source 换代与 shell 缝调整；测试 3 文件 |

> `FILE_REFERENCE_PROMPT` 是模型可见文本，按仓库规则（"Model-visible ⟺ logged"）其变更需与记录会话快照配套；本版 `context` 组测试改动覆盖 `time-context` 与 `session-reference`，**未核实**该 prompt 是否另有专门快照用例。

### 15. storage 包组：仅版本号与一处 unknown 断言清除

`packages/storage` 本区间 **5 个文件、+24 / −24**，全部是：`storage/package.json`、`storage-domain/package.json`、`storage-json/package.json`、`storage-sqlite/package.json` 的版本号 `0.1.6-alpha.1` → `0.1.7-rc.1` 与 workspace 依赖范围（DSH 包 `workspace:^` → `workspace:*`；vendor/native `workspace:~`）；以及 `storage-sqlite/src/unit.ts:72` 的 `as unknown as Array<{ key: string; value: string }>` → `as Array<{ key: string; value: string }>`。

**没有功能性变更**。这一条本身值得记录，因为它确认了"检查点 JSON 无损化"修正的是**读取方的校验器**（在 `session-projection-cache`），而不是 storage-domain 的实现——与 note `2026-09-19-lossless-projection-checkpoint-json.md:24` 的说法一致（"The domain version remains unchanged because the stored JSON representation is unchanged; this corrects its reader."）。

### 16. 官方文档区间变更

`git diff --stat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- docs/subsystems docs/cookbook docs/persistence-changes docs/persistence-catalog.md docs/session-format-status.md` → **151 files changed, +99899 / −5211**。本篇相关的页面：

| 文档 | 变更行数 | 要点 |
|---|---|---|
| `docs/session-format-status.md` | 20 | 新增 **Finalization record** 段（`latestFinalizedVersion: 4`）与首 V4 发布前的 V3 词汇表检查要求 |
| `docs/subsystems/session.md` | 141 | `UserMessage extends MessageBase`；新增 `developer/message` 与 `headerSeq`；`EpochHeader.system?: never`；`turn/end.reason` 新增 `forked`；`SurfaceEventType` 增一类；`session/end-seed` 语义改为 `buildForkSeed` 拥有；`firstLifecycleSeq`；`Session.fork` 改为"exact event prefix"；新增 `projections` 与 `workspacePathApplications` Remote |
| `docs/subsystems/session-projection.md` | 40 | `cachedSnapshot` / `cachedPredecessorTitle` 签名与 JSDoc 重写（去掉 cut 参数、去掉 `asOfSeq: -1` 哨兵）；"whole-value event rule" 改写为"complete read model + 单位自有 `apply` 拥有重放" |
| `docs/subsystems/session-reference.md` | 13 | `displayTitle` 字段与 `listCandidates` 契约 |
| `docs/subsystems/session-telemetry.md` | 6 | "tool-result block's `isError`" → "tool message's `isError`"；新增 fork 后缀起点与 `includeHistory` 的继承语义 |
| `docs/subsystems/persistence.md` | 2（+2/−2） | `CreateSessionOptions.inheritedEventCount` 的 JSDoc：构造器在 cut 处追加子自有标记，"unless the seed already includes it followed by child-owned fork closers" |
| `docs/subsystems/compaction.md`、`storage.md`、`session-query.md` | **0** | 无改动 |
| `docs/persistence-catalog.md` | +5186 / −3110 | 重新生成的类型指纹目录（5542 行）；新增 root `event:developer/message`（`:37`）、`event:workspace/changes`（`:81`）、source kind `"compact-checkpoint"`（`:1546`） |
| `docs/cookbook/adding-a-session-format-version.md` | 52 | 新增 `final-v3-vocabulary` 与 `v4-corpus-trial` 两节；"accepted target-format meanings remain stable"；native writer 输出作为转换 oracle |
| `docs/cookbook/reviewing-persistence-type-changes.md` | 12 | 新增只读对比命令 `pnpm --silent run persistence-review --before <base> --after docs/persistence-schema.json`；新增 `@persistenceReserved` 规则；"Check the accepted baseline first. Preserve its locked records." |
| `docs/persistence-changes/README.md` | 20 | `finalized/vN.json` 机制；两条新 `same-version` 档位；payload version 规则；归因策略与 inventory format 2；reserved-field 规则 |
| `2026-09-16-session-format-v4.md` + `.schema.json` | 120 + 16212 | V4 声明与完整 after schema |
| `2026-09-20-unknown-child-catalog.md` + `.schema.json` | 48 + 250 | unknown 模式声明 |
| `2026-09-14-workspace-changes-event.md` + `.schema.json` | 48 + 72 | 工作区变更事件声明 |
| `persistence-changes/finalized/v4.json` | 379 | 已接受兼容基线检查点 |
| `persistence-changes/historical-formats/v3.md` / `v3.schema.json` | 5634 / 61307 | V3 历史格式参考（本版新增） |
| `docs/architecture.md` | 11 | 与记忆侧相关的只有一句："Manage background jobs \| register on `ctx.jobs`; `job_*` tools read or stop jobs"（作业语义从"收集或停止"改为"读取或停止"） |

### 17. 未核实项

| # | 项 | 原因 |
|---|---|---|
| 1 | 官方 V4 文档给出的测试数字（1,523 tests / 63 files、884 tests / 38 files、447 tests / 12 files、351 tests 与 100% coverage） | 本篇未在本地运行测试套件；数字来自 `docs/persistence-changes/2026-09-16-session-format-v4.md:106-115`，属**转引** |
| 2 | V3→V4 迁移边的实际拒绝率与真实用户语料表现 | 需要真实会话语料；note 提到 `scripts/migrate-sessions-to-v4.ts` 可产出 `summary.json`，但本篇未运行该脚本 |
| 3 | `2026-09-14-workspace-changes-event.md:43` 的"165 tests passed"与快照名 `snapshots/web/changed-files-turn` | 未复跑 |
| 4 | `FILE_REFERENCE_PROMPT` 变更是否有专门的记录会话快照覆盖 | 只核到 `packages/context` 的测试文件变更清单，未逐个检查快照语料 |
| 5 | `workspace/session-activity` 与 `workspace/session-stop` 两个 seam 的**实现包**（Agent registry / job registry / Subagent runtime / Schedule 插件各自的 provider 注册点） | 属 `packages/workspace`、`packages/agent`、`packages/jobs`、`packages/schedule`，不在本篇包范围内；本篇只核实了 note 与 `dsh-workspace` 侧的声明 |
| 6 | `session-format-v3-to-v4/src/relationships.ts`（385 行）的**逐条**校验实现是否与迁移包 README 的表 100% 对齐 | 本篇核到 README 的规格表与文件存在性、行数；未逐行比对代码 |
| 7 | `docs/subsystems/session-projection.md` 里"whole-value event rule"改写的完整动机 | 该页 diff 显示规则被改写为"complete read model + 单位自有 `apply` 拥有重放"，但本篇未找到对应的独立 note；只能确认文档文本变化本身 |
| 8 | `packages/session/session-title-llm/src/index.ts` 那 9 行改动的具体内容 | 未逐行读取该 diff；从同类改动推断为 source 换代（`dsh-session-title-llm` 自有 kind），**未确认** |
| 9 | `session-log-export` 新增 `src/routes.ts` 与交付代际守卫的关系 | 该包属 session-query 组但主要是导出/客户端功能，本篇未展开 |
| 10 | v0.1.6-alpha.1 时期 `packages/session` 包数在旧文档中记为 21，而本篇 `git ls-tree` 实测为 19 | 差异来源未查明（可能是旧文档计入了 README 条目或计数口径不同）；本篇采用 `git ls-tree --name-only <tag> packages/session/` 排除 README 文件的实测口径，**不在本篇修正旧文档** |

---

## 附录：本版记忆侧提交索引

以下命令可完整复现本篇所有量化结论（PowerShell，workdir 为 `E:\test\rewrite-agently\deepseek-harness`）：

```powershell
# 1. 总基线
git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- `
  packages/session packages/storage packages/compaction `
  packages/session-query packages/context packages/core/session
# → 248 files changed, 10927 insertions(+), 1844 deletions(-)

# 2. 分组基线
foreach ($p in @('packages/session','packages/storage','packages/compaction',
                 'packages/session-query','packages/context','packages/core/session')) {
  $s = git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- $p
  $l = (git log --oneline dsh-v0.1.6-alpha.1..dsh-v0.1.7-rc.1 -- $p | Measure-Object).Count
  "$p :: $s :: commits=$l"
}

# 3. 包清单与新增包 / 4. 格式版本常量 / 5. 新增与删除文件
git ls-tree --name-only dsh-v0.1.6-alpha.1 packages/session/
git ls-tree --name-only dsh-v0.1.7-rc.1 packages/session/
git show dsh-v0.1.6-alpha.1:packages/core/session/src/types.ts | Select-String 'SESSION_FORMAT_VERSION'
Select-String -Path packages/core/session/src/types.ts -Pattern 'SESSION_FORMAT_VERSION'
git diff --name-status dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- `
  packages/session packages/session-query packages/context packages/storage |
  Where-Object { $_ -match '^[AD]' }
```

**V4 表示与迁移边（`packages/session`、`packages/core/session`）**

```text
669b724a78 feat(session): add the V4 integration format and retain V3 replay inputs
1d1ae1a5af fix(session): migrate historical subagent catalogs to V4
8696ec6cef feat(session): fork exact event prefixes with synthetic tail results
f4a32dbd0a refactor(llm): flatten tool results and validate native V4 sessions
fb79a944f5 refactor(llm): separate durable producer sources from request inputs
b88afa8a72 fix(ptc): name persisted producer attribution ptc-mode
e0bd7e1960 feat(session): add developer changes using historical tool schemas
0112eaf3a8 feat(session): finalize the accepted V4 compatibility baseline
cbb4df8750 fix(session): refuse retired tool-result content during V4 admission
5152c097bb docs(session): catalog every V3-to-V4 transformation and refusal
bf29247fad fix(session): namespace historical V3 extensions with plugin prefixes
28b209867f fix(session): preserve historical stream-start extension field names
11ef33b336 fix(session): reject unknown required V3 events before target interpretation
fc74dbf4ea fix(session): limit delivery migration checks to the V4 target
d5a109c60f fix(session): preserve direct V3 source kinds during wrapper conversion
c6f6aa3293 fix(session): preserve V3 tool-schema metadata keys
ad83cce36a fix(session): repair missing turn ends during V3 migration (#4689)
```

**catalog、子代理迁移与投影缓存**

```text
a9985b49ae fix(session): migrate historical subagents only when opened
f44b78a622 fix(session): complete parent catalogs while isolating child failures
ade7035fd8 fix(session): preserve parents with incomplete child catalog evidence
17a52a8fe3 fix(subagent): retain unreadable children in migrated catalogs
f984683956 fix(subagent): store unknown mode in the existing catalog event
a978ad1994 fix(subagent): version unknown catalog payloads locally
e838401a9b docs(session): state incomplete catalog evidence limits
696aa5f97c docs(session): describe retained source kinds by historical admission
86ca9de07e fix(session): read cold seeded rows from the projection cache by header
1b51a1ad2d fix(session): label list projection blocks with their sequence space
df0145271d fix(session): preserve opaque checkpoint keys on domain reopen
cc970738d8 docs(session): scope checkpoint JSON preservation to domain reads
d7e523b8b8 perf(session): traverse stored JSON arrays by index
e134ba8765 fix(session): format unvalidated row fields explicitly in diagnostics
```

**读协调、source 与杂项**

```text
6fef0f0af9 fix(session-query): stabilize persistence cache identity
e44efedeb0 fix(session): isolate corrupt compressed headers during discovery
0c44e5461d fix(session): restrict attachment discovery to declared event content
d5302e33f8 refactor(session): separate attachment carrier policy from V4 migration
580bdc7258 refactor: remove redundant unknown casts
d088572e11 fix(session): declare persistence identity for Typert analysis
7e42e8aa65 fix(release): align V4 migration package with master version
370e1efcdb test(session-reference): use declared plugin sources in V4 fixtures
34a43129a6 fix(session-reference): preserve title fallback
52a4a5bdb3 fix(composer): preserve batches and quoted directory references
bb20149360 refactor(shell): register foreground commands as jobs at start and drop the promotion protocol
```

**compaction**

```text
0fadb08fbd fix(compaction): gate pressure on the message budget, not the whole window
a1cebebd40 refactor(compaction): drop the spec's reservedCompletionTokens field
b02b20d713 fix(compaction): pin output caps and cover proactive reserve replay
555b664b08 fix(compaction): reserve configurable 64K pressure headroom
9b016b6425 refactor(compaction): require an explicit output reservation
ec7030afd3 fix(compaction): default summary output cap to headroom
```

**release / build（落在每个包上）**：`37372101b5` pin internal DSH workspace dependencies；`4e6028a604` use tilde ranges for vendor and native workspaces；`112ce776ac` / `10ea83bcc3` / `a60af51e80` release 0.1.7-alpha.1 / alpha.2 / rc.1。

### 本版相关的 note 索引（`--diff-filter=A` 判定为新增）

| note | 目录 | 行数 |
|---|---|---|
| `2026-09-17-native-v4-read-validation.md` | `implemented/architecture/` | 33 |
| `2026-09-17-persistence-attribution-policy.md` | `implemented/architecture/` | 35 |
| `2026-09-17-process-local-blank-sessions.md` | `implemented/architecture/` | 35 |
| `2026-09-19-lossless-projection-checkpoint-json.md` | `implemented/architecture/` | 24 |
| `2026-09-19-projection-cache-listing-identity-and-cached-rows.md` | `implemented/architecture/` | 166 |
| `2026-09-19-v3-incomplete-child-catalog-evidence.md` | `implemented/bug-fix/` | 29 |
| `2026-09-19-session-local-subagent-migration.md` | `implemented/bug-fix/` | 33 |
| `2026-09-20-session-open-read-coordination.md` | `implemented/bug-fix/` | 88 |
| `2026-09-18-session-pin-and-sidebar-archive.md` | `implemented/feature/` | 79 |
| `2026-09-21-archive-stops-running-session-work.md` | `implemented/feature/` | 41 |
| `2026-09-19-trim-session-query-convenience-api.md` | **`proposed/simplification/`** | 35 |

> 最后一条位于 `proposed/`，代码证实未实施（见 [第 13 节](#13-session-query便利-api-精简仍是-proposed)）。
