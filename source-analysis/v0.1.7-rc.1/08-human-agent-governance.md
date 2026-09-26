# 【第 08 篇】packages/interaction · guard · settings · skill · plan · goal：人机协作与治理

> **版本**：dsh-v0.1.7-rc.1（`46a7f68b09`），对比上版 dsh-v0.1.6-alpha.1（`0a15e36e7f`）
> 难度：🟡 进阶（建议先读 v0.1.6-alpha.1 的第 02 篇、第 06 篇，以及本版 `docs/subsystems/settings.md`）
> 包范围：`deepseek-harness/packages/` 下 **26 个包**（`interaction` 5 · `guard` 2 · `settings` 1 · `skill` 6 · `plan` 1 · `goal` 4 · `hooks` 3 · `todo` 1 · `identity` 1 · `feedback` 2）
> 上游文档：`docs/subsystems/approval.md`、`permission-presets.md`、`user-questions.md`、`settings.md`、`skills.md`、`plan.md`、`goal.md`、`slots.md`、`scope.md`、`todo.md`、`feedback.md`

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
- [附录：本版提交索引](#附录本版提交索引)

---

## 引言

本文覆盖 DSH 中**「谁可以做什么、以及谁被问到什么」**这一整条治理链：人机交互（`interaction`）、循环与工具守卫（`guard`）、插件配置服务（`settings`）、技能装载（`skill`）、计划协作（`plan`）、会话目标（`goal`）、第三方 Hook 桥（`hooks`）、待办（`todo`）、匿名身份（`identity`）、人类反馈（`feedback`）。

本版这一区域的量化基线（命令见下文「包结构」小节，均已实测）：

| 项 | 值 |
|---|---|
| 文件变更（10 个包组合计） | **122 files changed，+4332 / -4630** |
| 变更构成 | 79 modified、27 added、14 deleted、2 renamed |
| 非 merge 提交数 | **24**（`git log --oneline --no-merges dsh-v0.1.6-alpha.1..dsh-v0.1.7-rc.1 -- <10 组路径>`） |
| 净增包 | **+2**（`packages/skill/skill-office`、`packages/skill/tool-workspace-dependencies`） |
| 净删包 | **-1**（`packages/settings/settings-file` 整包删除） |
| 包总数 | 该 10 组在 rc.1 共 26 个包（`git ls-tree --name-only dsh-v0.1.7-rc.1 packages/<group>/`，排除 README 后核实） |

本版这一区域有三个**结构性**变化，其余多为跟随性修补：

1. **`settings` 服务被整体重写**——从「命名空间注册表 + 独立文档 Provider」变为「从插件 Config schema 投影出的表单」。`packages/settings/settings-file` 整包删除，服务类从 `SettingsProvider` 改名为 `SettingsForms`，`installSection` 这条注册契约在新树中**已无任何引用**（`grep installSection docs/` → No matches；`grep SettingsProvider|SettingsScope|SettingsRegisterOptions|SettingsSectionHooks|SettingsUpdateSource packages/**/*.ts` → No matches）。
2. **消息来源归属（producer-owned message sources）在治理插件上落地**——`guard/repeat-tool-reminder`、`plan/plan-mode`、`goal/tool-goal`、`hooks-claude-code`、`hooks-codex`、`interaction/user-approval` 六个包把 `{ kind: 'plugin', plugin: '<name>' }` 换成 `MessageSourceMap` 声明合并出的 `{ kind: '<producer>' } & ContextFormed`。
3. **`skill` 包组净增两个包**——`skill-office`（Office 三件套技能 + 结构校验器）与 `tool-workspace-dependencies`（解释器路径查询工具），合计新增 2627 行。

同时必须如实说明三处**任务书中被指为「本版重点」但我核实后不成立或未落地**的点，详见[本版本变更要点](#本版本变更要点016-alpha1--017-rc1)：

- `docs/subsystems/approval.md` 在整个区间内**零改动**（两个 tag 下 blob 哈希同为 `656325aa44`）。
- `docs/subsystems/plan.md`、`goal.md`、`scope.md`、`todo.md`、`feedback.md` 同样**零改动**。
- note `2026-09-19-retire-prompt-registry-change-event.md` 的状态是 **`proposed`**，且 `system-prompt/change` 事件在 rc.1 源码中**依然存在**——该提案在区间内**未落地**。

---

## 概述

这 26 个包共同定义「人机协作与治理」。按职责分成五层：

- **授权层**：`interaction/user-approval` 是授权缝（capability seam）的 Service Definition（`ctx.approval`），`interaction/permission-presets` 把沙箱模式与审批策略打包成可命名预设，`guard/repeat-tool-reminder` 与 `guard/timeout-policy` 在循环与工具调用的两个切点上施加约束。第 05 篇的 `sandbox` 提供执行侧强制力，本篇只写治理侧策略。
- **提问层**：`interaction/user-questions`（`ctx.userQuestions`）是「向人类提问」的通用缝，`interaction/tool-ask-user` 把它暴露成模型可调用的 `ask_user_question` 工具，`plan/plan-mode` 是它的第一个具名消费者（`plan-review` intent）。
- **装载层**：`skill/skill`（`ctx.skills`）合并各 Provider 的技能目录，`skill-filesystem`、`skill-badge`、`skill-office` 是 Provider，`skill/tool-skill` 是 Consumer（拥有模型可见的 `skill` 工具与会话目录），`skill/tool-workspace-dependencies` 是配套工具。
- **承诺层**：`goal/goal` 与会话目标事件、`goal/goal-round-driver`（自动续轮驱动）、`goal/tool-goal`（`goal` 工具）、`goal/command-goal`（`/aegis-goal` 一类命令）、`todo/tool-todo`（`todo_write`）。
- **记录与配置层**：`settings/settings` 提供插件配置表单服务，`identity/anonymous-user-id` 提供遥测/反馈相关性的匿名标识，`feedback/command-feedback` 与 `feedback/message-feedback` 记录人类反馈，`hooks/hook-protocol` 与 `hooks-claude-code`、`hooks-codex` 把外部编码代理的 Hook 协议桥进 DSH 的事件切点。

一句话概括本版：**「权限的存储位置从 settings.yaml 搬回了插件 Config」**，以及**「插件的消息归属从统一 plugin 包装变成按生产者声明」**。

---

## 核心概念

| 术语（首次出现附英文） | 含义 | 本版是否受影响 |
|---|---|---|
| 授权缝（approval seam） | `ctx.approval` 的 Service Definition / Provider / Consumer 三角色；本版无文档变化 | 未变 |
| 审批策略（`ApprovalPolicy`） | `'ask'`（走 answerer 瀑布）或 `'never'`（直接 `rejected`），按会话折叠 | 未变 |
| 审批结果（`ApprovalOutcome`） | 闭合枚举 `allowed-once` / `rejected` / `cancelled` / `unavailable`；调用方对后三者 fail closed | 未变 |
| 权限预设（permission preset） | 沙箱模式 + 审批策略的命名组合；`custom`/`auto` 为保留名 | **默认预设的存储与下发方式变更** |
| 用户提问意图（`AskUserQuestionIntent`） | 提问附带的可选决策标签（本版唯一标签为 `plan-review`） | **新增可选字段 `callId`** |
| 计划评审（plan review） | `exit_plan_mode` 提交的计划进入 `userQuestions.ask()` 等待人类裁决 | 携带来源工具调用 id |
| 持久计划卡（persistent plan card） | 计划文档以交付物形式常驻会话尾部，可回读 | **本版新增**（宿主契约 + 客户端渲染） |
| 易变配置引用（volatile config reference） | 标记 `.volatile()` 的字段返回稳定引用，改写触发 Loader 就地更新而非重挂 | **本版成为配置表单的基础** |
| 配置表单（Config form） | 由插件 `static Config` 的 volatile 字段投影出的可编辑表面 | **本版重写** |
| 表单命名空间（`SettingsNamespace`） | 本版语义变更为「active profile 中某条唯一 plugin entry 的 id」（不再是「注册出来的逻辑段名」） | **语义变更** |
| 生产者自有消息来源（producer-owned source） | `kind` 即生产者身份，经 `MessageSourceMap` 声明合并贡献 | **本版在治理插件上落地** |
| 技能（skill） | 模型/用户按需装载的可复用指令；可选，不是会话事件 | **新增 Office 三件套 Provider** |
| 捆绑等级（bundled rank） | Provider 贡献技能的优先级层；`skill-office` 用 `BUNDLED_SKILL_RANK` | 未变 |
| Hook 切点（hook point） | `hooks-claude-code` / `hooks-codex` 映射外部代理事件的挂载点 | 未变 |
| 目标轮（goal round） | `goal-round-driver` 用一个保留位（reservation）驱动一次自动续轮 | 只读参数收窄 |
| 匿名用户 id | 遥测与反馈相关性使用的稳定假名标识 | 仅版本与依赖范围 |

---

## 包结构

包清单与改动规模全部来自实测命令：

```text
git ls-tree --name-only dsh-v0.1.7-rc.1 packages/<group>/
git diff --shortstat   dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/<group>
git diff --name-only   dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/<pkg>
```

**注意一个可直接复核的口径差异**：按 10 个包组**分别**求文件数之和是 **124**，而把 10 条路径放在**同一条** `git diff` 里得到的是 **122**。原因是 git 默认开启重命名检测（`diff.renames=true`）：`packages/settings/settings-file/README.i18n.yaml`（R055）与 `.../tsconfig.json`（R072）在合并 diff 中被识别为「重命名到 `packages/skill/skill-office/`」，于是各记 1 条而非 2 条。**这两个重命名是检测假象，不是真正的包迁移**——`skill-office` 是由 `fa518ecd89 feat(desktop): enable standalone Office skills` 新建的包，与 `settings-file` 无业务关系。引用总量时应使用合并口径 **122**。

| 包 | 职责 | 本版改动规模（文件数 \| +/−） |
|---|---|---|
| `interaction/commands` | 插件自有的人类命令注册表 | 2 \| +21 / -21（仅 `package.json` 与一处测试断言） |
| `interaction/permission-presets` | 沙箱 + 审批预设；`ctx.permissionPresets` | 9 \| +84 / -98（`src/index.ts`、`src/types.ts`、两个 spec、`tsconfig.json`） |
| `interaction/tool-ask-user` | 模型侧 `ask_user_question` 工具 | 1 \| +11 / -11（**仅 `package.json`**） |
| `interaction/user-approval` | `ctx.approval` 授权缝 | 3 \| +27 / -20（`src/index.ts` 加 `MessageSourceMap` 声明） |
| `interaction/user-questions` | `ctx.userQuestions` 提问缝 | 5 \| +18 / -11（`src/types.ts` 加 `callId`） |
| `guard/repeat-tool-reminder` | 重复工具调用提醒（`pre-step` / `post-tool` 决策） | 3 \| +39 / -26（`src/index.ts` 换生产者来源） |
| `guard/timeout-policy` | 单次工具调用超时策略 | 1 \| +9 / -9（**仅 `package.json`**） |
| `settings/settings` | 配置表单服务；`ctx.settings` | 21 \| +1037 / -2285（`src/index.ts` 893 → **431 行**） |
| `settings/settings-file` | 旧版 YAML/JSON 文档 Provider | **整包删除：11 个文件，合计 1783 行** |
| `skill/skill` | 技能注册表 Service Definition | 1 \| +9 / -9（**仅 `package.json`**） |
| `skill/skill-badge` | 官方徽章 Provider | 1 \| +5 / -5（**仅 `package.json`**） |
| `skill/skill-filesystem` | 文件系统技能发现 Provider | 3 \| +13 / -12（新增 `watch()` 覆写、`as unknown` 清零） |
| `skill/skill-office` | **新增**：Office 三件套技能 Provider + 结构校验脚本 | 15 \| **+1593 / -0** |
| `skill/tool-skill` | 模型可见 `skill` 工具 | 2 \| +35 / -20（`package.json` + spec） |
| `skill/tool-workspace-dependencies` | **新增**：工作区依赖/解释器路径工具 | 7 \| **+1034 / -0** |
| `plan/plan-mode` | 计划模式与计划评审 | 7 \| +44 / -34（`src/index.ts` 加 `callId` 与来源迁移） |
| `goal/command-goal` | 目标命令 | 1 \| +15 / -15（**仅 `package.json`**） |
| `goal/goal` | 目标事件与投影服务 | 3 \| +47 / -31（`package.json` + 两个 spec） |
| `goal/goal-round-driver` | 目标轮驱动 | 3 \| +30 / -23（参数由 `ContentBlock[]` 收窄为 `readonly ContentBlock[]`） |
| `goal/tool-goal` | `goal` 工具 | 3 \| +39 / -27（`src/index.ts` 换生产者来源） |
| `hooks/hook-protocol` | Hook 协议执行器 | 3 \| +33 / -21（`bash.run` → `bash.execute(...).result()`） |
| `hooks/hooks-claude-code` | Claude Code Hook 桥 | 4 \| +66 / -52 |
| `hooks/hooks-codex` | Codex Hook 桥 | 4 \| +56 / -42 |
| `todo/tool-todo` | `todo_write` 工具 | 2 \| +22 / -22（**仅 `package.json` + 一处测试断言**） |
| `identity/anonymous-user-id` | 匿名用户标识 | 1 \| +7 / -7（**仅 `package.json`**） |
| `feedback/command-feedback` | 会话反馈事件与命令 | 1 \| +16 / -16（**仅 `package.json`**） |
| `feedback/message-feedback` | 助手消息评分与备注 | 1 \| +19 / -19（**仅 `package.json`**） |

包组汇总（分别实测）：

| 包组 | 文件 | 增 | 删 |
|---|---|---|---|
| `interaction` | 20 | +161 | -161 |
| `guard` | 4 | +48 | -35 |
| `settings` | 35 | +1058 | -4101 |
| `skill` | 32 | +2697 | -50 |
| `plan` | 7 | +44 | -34 |
| `goal` | 10 | +131 | -96 |
| `hooks` | 11 | +155 | -115 |
| `todo` | 2 | +22 | -22 |
| `identity` | 1 | +7 | -7 |
| `feedback` | 2 | +35 | -35 |

删除的 14 个文件（`git diff --diff-filter=D --name-only ... -- packages/settings` 加总）：

```text
packages/settings/settings-file/README.i18n.yaml
packages/settings/settings-file/README.md
packages/settings/settings-file/README.zh.md
packages/settings/settings-file/package.json
packages/settings/settings-file/src/index.ts                 (371 行)
packages/settings/settings-file/tests/concurrency.spec.ts     (97 行)
packages/settings/settings-file/tests/loader-composition.spec.ts (145 行)
packages/settings/settings-file/tests/local.spec.ts           (438 行)
packages/settings/settings-file/tests/lock-race.spec.ts       (125 行)
packages/settings/settings-file/tests/watcher.spec.ts         (224 行)
packages/settings/settings-file/tsconfig.json
packages/settings/settings/src/invariant.ts                   (48 行)
packages/settings/settings/tests/invariant.spec.ts            (52 行)
packages/settings/settings/tests/memory.ts                    (54 行)
packages/settings/settings/tests/settings.spec.ts             (1058 行)
packages/settings/settings/tsdown.config.ts                   (25 行)
```

> 上表共 16 行，其中 `settings-file/README.i18n.yaml` 与 `settings-file/tsconfig.json` 在**合并口径**下被计为 R（重命名），所以「14 deleted」与这里列出的 16 个路径并不矛盾：14 = 16 − 2。这一点请以 `git diff --name-status`（默认开启重命名检测）为准复核。

---

## 关键类型

**片段 A：`ctx.settings` 的服务面（本版重写后的全部公开方法）**

```ts
// packages/settings/settings/src/index.ts:223-431
export class SettingsForms extends Service {
  static inject = ['configEditor', 'profileContext']
  private revisions = new Map<string, { raw: string | undefined; revision: number; ns: SettingsNamespace; autoGenerate: boolean }>()
  private closed = false
  private scheduled = false
  private readonly presentations = new Map<Fiber, { auto?: boolean }>()

  constructor(private readonly ownerContext: Context) {
    super(ownerContext, 'settings')
    const ctx = ownerContext
    ctx.effect(() => () => { this.closed = true })
    ctx.on('app-boot/config-reload', () => { this.invalidate() })
    void ctx.root.loader.await().then(() => this.importLegacyDocument()).catch((error: unknown) => { ctx.logger.error(error) })
  }

  /** Register the calling plugin instance's page policy without changing its Config. */
  configure(presentation: { auto?: boolean }, owner: Fiber = this.ctx.fiber): () => void

  /** Whether the active profile accepts form edits. */
  get writable(): boolean { return true }
  /** Current profile patch shown by the native configuration editor. */
  get documentPath(): string { return this.ownerContext.configEditor.documentPath }
  prepareDocument(): Promise<string>

  /** Read active plugin schemas and their live values. */
  describe(options?: SettingsDescribeOptions): SettingsDescriptor[]

  /** Merge editable fields into an entry's config. */
  async update(ns: string, patch: object, expectedRevision?: number): Promise<void>
  /** Reset all live fields, then set the supplied fields; ordinary config is preserved. */
  async replace(ns: string, section: object, expectedRevision?: number): Promise<void>
  /** Apply field edits without restating redacted secrets; unsetting an array index removes its element. */
  async mutate(ns: string, ops: readonly SettingsPathOp[], expectedRevision?: number): Promise<void>
}
export default SettingsForms
```

三条旧方法的**签名与语义**在本版收窄，可直接对照 `docs/subsystems/settings.md` 的生成区段（该文档同区间内由 **405 行压缩到 155 行**）：

| 旧 | 新 | 变化 |
|---|---|---|
| `register(ns, schema, options): SettingsScope<T>` | 删除 | 插件不再注册命名空间；`static Config` 就是 schema |
| `installSection(owner, ns, schema, entry, hooks)` | 删除 | 全树零引用（grep 已核实） |
| `get(ns): unknown` | 删除 | 业务插件直接读自己的 `config.field.get()` |
| `update/replace/mutate(ns, ...)` 的 `ns` 类型为 `SettingsNamespace`（品牌串，经 `SettingsNamespaceInput` 校验 kebab-case） | `ns: string`（= profile entry id） | 校验对象从「命名空间命名法」变成「active profile 中确实存在该 entry」 |
| `descriptor.applies: 'live' \| 'restart'` | `applies: 'live'`（字面量） | `SettingsApplies` 类型与 `restart` 语义一并删除 |

**片段 B：表单描述符与路径编辑（对 wire 的契约）**

```ts
// packages/settings/settings/src/index.ts:19-36
export interface SettingsDescriptor {
  ns: SettingsNamespace
  /** Whether the UI may generate a page when no custom page exists. */
  autoGenerate: boolean
  schema: unknown
  value: unknown
  revision: number
  base?: unknown
  user?: unknown
  applies: 'live'
  secrets?: RedactedSecret[]
}

/** Wire readers always request secret redaction. */
export interface SettingsDescribeOptions {
  redactSecrets?: boolean
}
```

```ts
// packages/settings/settings/src/index.ts:81-83 —— 路径编辑存在的理由写在类型 JSDoc 里
export type SettingsPathOp =
  | { op: 'set'; path: readonly string[]; value: unknown }
  | { op: 'unset'; path: readonly string[] }
```

```ts
// packages/settings/settings/src/types.ts:17-45（wire 视图，JsonValue 替代 unknown）
export interface SettingsNamespaceView {
  autoGenerate: boolean
  ns: string
  schema: JsonValue
  value: JsonValue
  base?: JsonValue
  user?: JsonValue
  applies: 'live'
  secrets: SettingsSecretView[]
  revision: number
}
```

**片段 C：volatile 判定与表单投影（本版新增文件 `src/schema.ts`，79 行）**

```ts
// packages/settings/settings/src/schema.ts:10-17
export function plainConfig(value: unknown): unknown {
  if (isVolatile(value)) return plainConfig(value.get())
  if (Array.isArray(value)) return value.map(plainConfig)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, plainConfig(child)]))
  }
  return value
}

// packages/settings/settings/src/schema.ts:37-47
export function volatileForm(schema: z): z | undefined {
  if (schema.meta.volatile) return plainSchema(schema)
  if (schema.type === 'object') {
    const dict = Object.fromEntries(Object.entries(schema.dict ?? {}).flatMap(([key, child]) => {
      const field = volatileForm(child)
      return field === undefined ? [] : [[key, field]]
    }))
    return Object.keys(dict).length === 0 ? undefined : z.object(dict)
  }
  return undefined
}

// packages/settings/settings/src/schema.ts:74-79
export function isVolatilePath(schema: z, path: readonly string[]): boolean {
  if (schema.meta.volatile) return true
  const [key, ...rest] = path
  const child = key === undefined ? undefined : schema.dict?.[key]
  return child !== undefined && isVolatilePath(child, rest)
}
```

**片段 D：生产者自有消息来源（本版治理区的横切变更）**

以 `packages/interaction/user-approval/src/index.ts:11-18` 为例，六个包使用完全同构的写法：

```ts
import type { ContextFormed } from '@deepseek-ai/dsh-llm'
declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'user-approval': { kind: 'user-approval' } & ContextFormed
  }
}
```

`MessageSourceMap` 的定义在 `packages/llm/llm/src/message.ts:110`，`ContextFormed` 在同文件 `:86`：

```ts
// packages/llm/llm/src/message.ts:86 / :110 / :136
export type ContextFormed = /* …上下文成形字段（form/summary 等）… */
export interface MessageSourceMap { /* 各生产者声明合并 */ }
export type MessageSource = MessageSourceMap[keyof MessageSourceMap]
```

各包替换前后的字面量：

| 包 | 文件:行 | 旧 | 新 |
|---|---|---|---|
| `guard/repeat-tool-reminder` | `src/index.ts:57-63` | `{ kind: 'plugin', plugin: 'repeat-tool-reminder' }` | `{ kind: 'repeat-tool-reminder' }` |
| `plan/plan-mode` | `src/index.ts:464-467` | `{ kind: 'plugin', plugin: 'plan-mode', form: 'notice', summary: text }` | `{ kind: 'plan-mode', form: 'notice', summary: text }` |
| `goal/tool-goal` | `src/index.ts:330-336` | `{ kind: 'plugin', plugin: 'tool-goal', … }` | `{ kind: 'tool-goal', … }` |
| `hooks/hooks-claude-code` | `src/index.ts:89-92, 198, 281` | `PLUGIN_SOURCE = { kind: 'plugin', plugin: 'hooks-claude-code' }` | `CONTEXT_SOURCE = { kind: 'hooks-claude-code' }` |
| `hooks/hooks-codex` | `src/index.ts:75-78, 183, 274` | `{ kind: 'plugin', plugin: 'hooks-codex' }` | `{ kind: 'hooks-codex' }` |
| `interaction/user-approval` | `src/index.ts:190-193` | `{ kind: 'plugin', plugin: 'user-approval' }` | `{ kind: 'user-approval' }` |

**片段 E：提问意图新增 `callId`（唯一跨包的类型扩展）**

```ts
// packages/interaction/user-questions/src/types.ts:22-33（逐字，含原作者 JSDoc）
export type AskUserQuestionIntent = {
  /** A plan submitted for review: `detail` is the plan markdown `ask()` requires, and the decision approves or declines it. */
  kind: 'plan-review'
  /**
   * The option label that approves the plan; every other option declines it.
   * Named rather than positional so no UI infers the verdict from option order.
   * An `approve` naming no option of its own question is rejected at `ask()`.
   */
  approve: string
  /** Logged tool invocation whose arguments contain the reviewed plan. */
  callId?: ToolCallId
}
```

唯一的写入方在 `packages/plan/plan-mode/src/index.ts:318-321`：

```ts
intent: { kind: 'plan-review', approve: APPROVE_LABEL, callId: exec.callId },
```

**片段 F：权限预设的默认值下发（`types.ts` 新增三字段）**

```ts
// packages/interaction/permission-presets/src/types.ts:25-33
export interface PermissionCatalog {
  /** Every currently selectable preset, in contribution order. */
  options: PresetOption[]
  /** Configured presets eligible as defaults for future sessions. */
  defaultOptions: PresetOption[]
  /** Effective default when the Config field is omitted. */
  defaultPreset: string
}
```

对应的 Config 与 schema 变更（`src/index.ts:159-194`）：

```ts
export interface Config {
  presets: Record<string, PresetSpec>              // 由可选变为必填（schema 已给 default）
  defaultPreset: Volatile<string | undefined>      // 由普通可选字段变为易变引用
}

static Config = z.object({
  presets: z.dict(/* … */).default({ /* read-only / workspace-write / danger-full-access 三项 */ }),
  defaultPreset: z.string().volatile(),
})
```

新的读取路径（`src/index.ts:225-227`）——**读不再是常量，而是每次求值**：

```ts
this.defaultSettings = () => {
  const defaultPreset = config.defaultPreset.get() ?? inferredDefault
  if (!Object.hasOwn(this.presets, defaultPreset)) throw new Error(`permission: unknown default preset "${defaultPreset}"`)
  return { defaultPreset }
}
```

**片段 G：`skill-office` 的 Provider 契约（本版新增，97 行）**

```ts
// packages/skill/skill-office/src/index.ts:13 / :32-35 / :76-96
const SKILL_NAMES = ['office-docx', 'office-pptx', 'office-xlsx'] as const

export const name = 'skill-office'
export const inject = ['skills']

const candidates: SkillCandidate[] = SKILL_NAMES.map((skillName) => {
  const directory = join(assetRoot, skillName)
  const path = join(directory, 'SKILL.md')
  const { description } = parseSkill(readFileSync(path, 'utf8'), path)
  return {
    name: skillName, description,
    invocation: { modelInvocable: true, userInvocable: true },
    provider: 'dsh-office', source: 'bundled', rank: BUNDLED_SKILL_RANK,
    resourceBase: { kind: 'directory', path: directory }, locator: path,
  }
})
```

---

## 数据流

### 1. 审批（本版仅消息来源变化，链路本身未动）

```text
工具/沙箱消费者 → ctx.approval.request(ApprovalRequest{ callId, … })
  → 读会话审批策略（会话内最后一条 approval/policy 事件，否则服务 config）
     ├─ 'never'  → 直接 rejected（不派发任何 answerer）
     └─ 'ask'    → approval/request waterfall → 人类 answerer / ACP 一次性机器决策
  → ApprovalOutcome（allowed-once | rejected | cancelled | unavailable）
  → 追加 approval/asked + approval/decided 审计对
  → 调用方对非 allowed-once 一律 fail closed
```

本版唯一变化：策略变更提示消息的 `source` 由 `{ kind: 'plugin', plugin: 'user-approval' }` 改为 `{ kind: 'user-approval' }`（`src/index.ts:190-193`）。权威文档 `docs/subsystems/approval.md` 在区间内哈希未变。

### 2. 配置表单（本版重写的核心链路）

```text
Loader 载入 active profile 的 entry
  → entry.fiber.runtime.Config（schemastery，含 .volatile() 标记）
  → SettingsForms.describe()
       schema(entry) → volatileForm(schema)         // 只保留 volatile 字段
       plainConfig(entry.fiber.config)              // 剥掉运行时引用
       projectForm(form, …)                         // 压成表单可见字段
       redactSecrets(form, value)                   // role('secret') 出队，只留 {path,set}
       revision = 单调计数（raw JSON 变化才 +1）
       → 变化时 emit 'settings/document-updated'(ns, revision)
  → 客户端表单（第 09/10 篇）经 ctx.remote.settings 读取
  → 写：update / replace / mutate(ns, ops, expectedRevision)
       write() 校验：entry 存在 → schema 存在 → form 存在
                     → 每个 path 必须落在 volatile 节点下
                     → validatePaths 拒绝任何非 volatile 字段
                     → strip(raw, form) 把非 volatile 字段原样保留
                     → mergeLayers(strip(raw), next)
       → configEditor.edit(entry, …)  落进 active profile 的 Cordis patch
       → describe() 刷新
```

同时供旧版迁移：构造函数在 `ctx.root.loader.await()` 之后调用 `importLegacyDocument()`，把 harness home 里遗留的 `settings.yaml` 先重命名为 `.imported` 再逐段导入（`LEGACY_SECTION_ENTRIES` 把 `ui-developer-tools` 映射到 `ui-settings`、`ui-onboarding` 映射到 `ui-settings-general`、`shell` 映射到平台对应的 shell executor entry）。

### 3. 计划评审与持久计划卡（宿主侧契约）

```text
Agent 在 plan mode 调 exit_plan_mode(plan_markdown)
  → PlanModeController 经 ctx.userQuestions.ask() 提问
       intent = { kind: 'plan-review', approve: APPROVE_LABEL, callId: exec.callId }
  → 人类在 UI 作答（Approve / Request changes / 关闭）
       ├─ Approve      → 计划成为已裁决评审（等待位结算）
       └─ Request changes → 取消等待，把反馈交回 composer
  → 无论裁决结果如何，工具调用参数（完整 Markdown）都留在原生调用或 PTC 派发日志中
  → 已提交的计划积累为「计划卡」，与文件交付共处同一 Turn 尾部列表
  → callId 让卡片能按完整会话地址 + 调用 id 重新打开同一份已提交计划
```

宿主侧只有两处改动：`intent.callId`（`plan-mode/src/index.ts:318-321`）与提示消息来源迁移（`:464-467`）。`packages/plan/plan-mode/README.md` 新增一句话说明该 id 的用途。**卡片渲染、侧栏导航、临时地址、自动打开等全部语义属客户端，本文不展开**（见 note `2026-09-17-persistent-plan-cards.md` 的 Decision 段）。

### 4. 技能装载（本版新增 Office 路径）

```text
skill/tool-skill（Consumer）持有模型可见的 skill 工具与会话目录
  ← ctx.skills（Service Definition）合并各 Provider 的目录
       ├─ skill-filesystem  → 项目/自定义/用户目录发现
       ├─ skill-badge       → 官方徽章
       └─ skill-office      → 三个捆绑 Office 技能（BUNDLED_SKILL_RANK）
              apply() 校验 assetRoot 必须是绝对目录且含 scripts/check_office.py
              officeRuntime(config) 生成绝对路径说明块，注入到 get() 返回的指令尾部
              config.cli === false → 明确声明「本部署禁用 LibreOffice Kit」
```

`skill-office` 的 `Config` 三个字段（`assetRoot` / `node` / `cli`）都是部署可变项，符合仓库「不得硬编码可调项」的约定；`node` 在 SEA / Electron 下缺失会**明确抛错**而不是静默降级。

### 5. Hook 桥（本版跟随 shell `execute()` 收敛）

```text
外部代理事件 → hooks-claude-code / hooks-codex 映射到 DSH 切点
  → 合并结果 MergedHookOutcome
  → contextFrom(merged) 造出 createUserMessage({ content, source: CONTEXT_SOURCE })
  → 注入 / 前置 / agent.steer
hook-protocol.runHook() 执行外部命令：
  旧：bash.run(bash.resolve(request))
  新：(await bash.execute(bash.resolve(request))).result()
```

---

## 测试覆盖

本区域的测试文件全部位于各包 `tests/` 下（仓库约定：测试不进 `src/`）。本版测试改动按包实测：

| 包 | 测试改动 |
|---|---|
| `settings/settings` | **测试几乎全换**：删除 `settings.spec.ts`（1058 行）、`invariant.spec.ts`、`memory.ts`；新增 `configuration.spec.ts`（331 行）、`configuration-fixture.ts`（57）、`editor-failures.spec.ts`（31）、`live-config.ts`（57）、`profile-composition.ts`（39）、`schema.spec.ts`（39）；`redact.spec.ts` 扩到 109 行 |
| `settings/settings-file` | 5 个 spec 随包删除（concurrency / loader-composition / local / lock-race / watcher，合计 1029 行） |
| `interaction/permission-presets` | `permission-presets.spec.ts` 与 `projection.spec.ts` 改造成使用共享的 `liveConfig()` 与 `omitsGeneratedPage()` 助手（跨包引用 `packages/settings/settings/tests/live-config.ts`） |
| `skill/skill-office` | 新增 `skill-office.spec.ts`（191）、`checkers.spec.ts`（14）、`check_office_test.py`（278）、`xlsx-validation.e2e.ts`（236）、fixture `encrypted.xlsx`（224 B） |
| `skill/tool-workspace-dependencies` | 新增 `tool-workspace-dependencies.spec.ts`（427 行） |
| `goal/goal` | 两个 spec 各加一段 `declare module '@deepseek-ai/dsh-llm' { interface MessageSourceMap { 'test': …; 'ordinary-user-message': … } }`，并把来源字面量改成生产者形式 |
| `goal/goal-round-driver` / `goal/tool-goal` | 断言跟随 `readonly ContentBlock[]` 与来源变更调整 |
| `hooks/*` | `coverage-cases.ts` 批量把 `source: { kind: 'plugin', plugin: 'policy' }` 改为 `{ kind: 'policy' }`，并把 `message.content[0].isError` / `content[0].content` 改为 `message.isError` / `message.content`（工具结果扁平化） |
| `todo/tool-todo`、`plan/plan-mode` | 同上的 `message.isError` 断言迁移；`plan-mode.spec.ts` 新增 `callId: \`call-exit-${callCounter}\`` 断言 |

关键的**行为回归**由新助手直接钉住：

```ts
// packages/settings/settings/tests/live-config.ts:42-56
export async function omitsGeneratedPage(mount: (ctx: Context) => Fiber | Promise<Fiber>): Promise<void> {
  const ctx = new Context()
  const release = vi.fn()
  const configure = vi.fn(() => release)
  ctx.provide('settings', { configure } as never)
  const fiber = await mount(ctx)
  await ctx.fiber.await()
  expect(configure).toHaveBeenCalledOnce()
  const [policy, owner] = configure.mock.calls[0] as unknown[]
  expect(policy).toEqual({ auto: false })
  expect(Object.is(owner, fiber)).toBe(true)
```

`liveConfig(ctx, plugin)` 则把插件挂在真正的 `Loader` entry 后面，用 `entry.update({ config })` 改配置——与 profile reconciliation 走同一条更新路径，因此它检验的是「volatile 字段就地生效」而不是人为构造的状态。

**未核实**：本版 `skill-office` 的 `tests/xlsx-validation.e2e.ts` 与各浏览器/录制场景（`apps/web/tests/*.e2e.ts`、`snapshots/`）我未逐行阅读，只核实了文件存在与行数。跨包 e2e 的真实执行结果本文不作断言。

---

## 与上下游的关系

**上游（本区域依赖谁）**

| 上游 | 用法 |
|---|---|
| `packages/core/scope`、`session`、`agent`、`tools` | 授权与提问服务的会话/作用域基元；`plan-mode` 的 `SessionProjection` |
| `packages/llm/llm` | `createUserMessage`、`MessageSourceMap`、`ContextFormed`、`ToolCallId` |
| `packages/core/system-prompt` | 授权策略快照进入 cache-safe runtime-context |
| `vendor/loader` + `vendor/cosmokit` | `.volatile()` 的 schema 面与 `isVolatile()`；`loader/volatile-update` 通知 |
| `packages/boot/config-editor` | **本版新增**：`SettingsForms` 的持久化与 `documentPath` 提供方（`static inject = ['configEditor', 'profileContext']`） |
| `packages/boot/app-boot` | `app-boot/config-reload` 触发 `invalidate()`；live-config inspect provider 依赖 app-boot 导出 projector |
| `packages/shell/dsh-shell-env` | `DSH_PROFILE` / `DSH_PROFILE_DIR` 保留内置键（creator skills 直接依赖） |

**下游（谁依赖本区域）**

| 下游 | 用法 |
|---|---|
| `packages/api/settings-controller` | wire 层：`describe({ redactSecrets: true })`，把服务拒绝分类成 `settings/conflict` / `settings/rejected`；本版随服务重写从 516 行删除降到 108 行新增 |
| `packages/client/ui-settings`、`ui-settings-general`、`ui-permission-presets`、`ui-agent-preset`、`ui-settings-*` | 消费 `ctx.remote.settings`；`ui-permission-presets` 用 `catalog.defaultOptions` 渲染默认预设选择器，写 `mutate(ns, [{ op: 'set', path: ['defaultPreset'], value }])` |
| `packages/sandbox/sandbox-policy`、`packages/shell/tool-bash` | 消费 `ctx.approval` 的闭合结果 |
| `packages/experimental/auto-review` | 通过 `PermissionPresetService.Config` 类型直接构造测试配置（本版改为 `NonNullable<Parameters<typeof Config>[0]>`） |
| `packages/extensions/tool-cordis` | 生成 `api-catalog.ts`，内含 `PermissionCatalog`、`SettingsDescribeValue` 等声明，是本版跨包 API 变化的静态证据 |
| `packages/preset/agent-preset` | creator skills 的宿主（`skills/` 子目录，本版全部新增 15 文件 / 831 行） |

**明确划给其它篇的部分**（本文只写宿主侧契约，不越界）：

- 计划卡的渲染、侧栏导航、`conversation.chat.turnTail` 列表、临时地址语义 → **第 10 篇（客户端）**。
- 设置页作为伴随包（`ui-settings-shell` / `-agent-loop` / `-subagent` / `-web-search`、`settingsScope.whileServed`）→ **第 09 篇**（note `2026-09-17-settings-pages-as-companion-packages.md`）。
- profile 自有的 live configuration（`2026-09-19-profile-owned-live-configuration.md`）与 `Config.listConfigs` inspect provider（`2026-09-21-live-config-inspect-provider.md`）→ **第 01 篇**；本文只在「与审批/设置的交叉」处点名。
- 生产归因审批权重、作者审批记分等**流程治理** → **第 12 篇**。

---

## 本版本变更要点（0.1.6-alpha.1 → 0.1.7-rc.1）

### 1. 权限与审批：文档零改动，代码只动「消息来源」

任务书要求核实「官方 `docs/subsystems/approval.md`、`permission-presets.md` 的区间变更」。实测结论如下。

**`docs/subsystems/approval.md`：区间内零改动。** 判定方式不是看 diff 文本为空，而是比对 blob：

```text
git rev-parse dsh-v0.1.6-alpha.1:docs/subsystems/approval.md
  → 656325aa446321253817be3ffeaef658a7c975c4
git rev-parse dsh-v0.1.7-rc.1:docs/subsystems/approval.md
  → 656325aa446321253817be3ffeaef658a7c975c4
```

`docs/subsystems/approval.md` 在 rc.1 仍是 170 行，内容（`ctx.approval` 的 dispatch 服务、`approval/request` waterfall、`approval/asked`/`approval/decided` 审计对、`ask`/`never` 每会话策略、`ApprovalOutcome` 闭合枚举）与基线逐字相同。因此本篇**不能**声称审批语义在本版有变化。

**`docs/subsystems/permission-presets.md`：2 行改动**，正是 `Config` 两个字段的签名：

```diff
-  presets?: Record<string, PresetSpec>
+  presets: Record<string, PresetSpec>
-  defaultPreset?: string
+  defaultPreset: Volatile<string | undefined>
```

**`packages/interaction/user-approval`：代码改动只有一处**——策略变更提示消息的 `source`（`src/index.ts:190-193`）从 plugin 包装换成 `{ kind: 'user-approval' }`，并在文件头加 `MessageSourceMap` 声明。为此新增的 `import type { ContextFormed }` 与 `declare module` 共 7 行。**授权判定、waterfall、审计事件、fail-closed 语义一行未改**。

**`packages/interaction/permission-presets`：本版是行为变更，不是版本号刷新。** 三件事：

1. **默认预设的存储位置迁移**。旧版通过 `ctx.settings.installSection(ctx, PERMISSION_SETTINGS_NAMESPACE='permission', settingsSchema, baseSettings, hooks)` 把 `defaultPreset` 注册成 `settings.yaml` 里的 `permission` 段，并用 `z.union(presetChoices).required()` 枚举合法值。新版整段删除，`PERMISSION_SETTINGS_NAMESPACE` 导出消失，改用插件**自己的 Config 字段** `defaultPreset: z.string().volatile()`：

```diff
-    this.defaultSettings = () => baseSettings
-    const settingsSchema: z<PermissionSettings> = z.object({
-      defaultPreset: z.union(presetChoices).required(),
-    })
-    ctx.inject(['settings'], (settingsCtx) => {
-      settingsCtx.settings.installSection(ctx, PERMISSION_SETTINGS_NAMESPACE, settingsSchema, baseSettings, { … })
-    })
+    this.defaultSettings = () => {
+      const defaultPreset = config.defaultPreset.get() ?? inferredDefault
+      if (!Object.hasOwn(this.presets, defaultPreset)) throw new Error(`permission: unknown default preset "${defaultPreset}"`)
+      return { defaultPreset }
+    }
```

2. **失败时机改变**（可从测试 diff 直接读出）。旧版在注册 settings 段时拒绝非法默认值；新版**允许**写入非法值，但**读取时抛错**，直到被修正：

```diff
-  it('rejects a stored default outside the configured preset table', async () => {
+  it('fails to read a stored default outside the configured preset table until it is repaired', async () => {
-    await expect(ctx.settings.update(PERMISSION_SETTINGS_NAMESPACE, { defaultPreset: AUTO_PRESET })).rejects.toThrow()
+    await configurations.get(ctx)!.update({ defaultPreset: AUTO_PRESET })
+    expect(() => ctx.permissionPresets.defaultPreset).toThrow(/unknown default preset/)
+    await configurations.get(ctx)!.update({ defaultPreset: 'workspace-write' })
```

3. **新增 `catalog` 远端字段**承担原本由 schema union 承担的「合法选项枚举」职责：`defaultOptions`（所有配置预设，可作未来会话默认）与 `defaultPreset`（当前有效默认）。客户端随后用 `remote.settings.mutate('permission-presets', [{ op: 'set', path: ['defaultPreset'], value }])` 写回（`packages/client/ui-permission-presets/src/client/settings-store.ts:126`）。

4. **页面归属声明**：服务构造时新增一行

```ts
ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)) })
```

含义是「本插件自带配置页，不要让 settings 自动生成一张」。这与 note `2026-09-17-settings-pages-as-companion-packages.md` 和 README 第 39 行的说明一致。

**`packages/guard` 的改动**（任务点名）：

- `guard/repeat-tool-reminder`：`PLUGIN_SOURCE` 常量改名 `REMINDER_SOURCE` 并换成生产者来源（`src/index.ts:57-63`），注入处的 `{ ...REMINDER_SOURCE, form: 'notice', summary: … }` 相应更新。**阈值、计数、预览裁剪逻辑未动**。
- `guard/timeout-policy`：**仅 `package.json`**（版本号与 `workspace:^` → `workspace:*` / `workspace:~` 的范围调整）。没有任何行为改动。
- `packages/guard/README.md`：区间内零改动。

**一处我发现但未被本版修掉的文档不一致**（标注为**观察**，非结论）：`docs/subsystems/permission-presets.md:49` 仍写「Auto … never enters the `permission.defaultPreset` settings schema」。而 `permission` 段与 `installSection` 在本版已从代码中完全移除，`packages/interaction/permission-presets/README.md` 的在同区间也把该限制条目改写为「Configured defaults must name a configured preset — removing a referenced preset requires changing `defaultPreset` in the same Config edit」。子系统文档这一句是**本版遗漏更新的残留引用**，我已确认它在该区间内没有随代码一起改动（`docs/subsystems/permission-presets.md` 区间内仅 2 行改动，即上面的 Config 块）。

### 2. 用户提问（user-questions）

`docs/subsystems/user-questions.md` 区间内 **+2 行**，就是 `AskUserQuestionIntent` 新增 `callId?: ToolCallId` 的字段与 JSDoc：

```diff
+  /** Logged tool invocation whose arguments contain the reviewed plan. */
+  callId?: ToolCallId
```

`packages/interaction/user-questions` 共 5 个文件变化：`src/types.ts` 加 3 行（含 `import type { ToolCallId } from '@deepseek-ai/dsh-llm/brand'`），`README.md` / `README.zh.md` / `README.i18n.yaml` 各加一句「The optional plan-review `callId` identifies the logged tool invocation for document navigation. It does not change the answer or its validation.」，`package.json` 版本与依赖范围。

**关键契约不变**，且这点有文档背书：`docs/subsystems/user-questions.md:151` 的 `async ask(request: AskUserQuestionRequest): Promise<AskUserQuestionAnswer>` 签名在区间内未改动，`:25` 的校验规则（`approve` 必须命名本问题自己的某个选项；intent 只能挂在带 `detail` 的问题上）也未改动。`interaction/tool-ask-user` 在本版**只改了 `package.json` 11 行**——工具 schema 完全没变。

因此正确的表述是：**`callId` 是纯附加的展示/导航用元数据，不参与校验、不改变答案结构**。

### 3. 持久计划卡：`packages/plan` 的宿主侧契约

note `2026-09-17-persistent-plan-cards.md`（`Status: implemented`，由 `f6428a164e feat(web): keep submitted plans in chat and open them in sidebar` 引入）描述的整体决策是客户端重活。属于本文范围的宿主侧只有两点：

1. **评审意图携带来源调用 id**：`plan-mode/src/index.ts:318-321` 把 `exec.callId` 塞进 `intent`。这让客户端能在评审关闭后，用「完整会话地址 + 调用 id」重新定位到那次 `exit_plan_mode` 的**完整工具参数**。
2. **不新增会话事件、不落盘第二份文档**。note 的 Alternatives 段明确否决了「写 Markdown 文件或把文档持久化进 sidebar layout」，理由是「工具参数已经拥有精确的已提交文本」（`The tool arguments already own the exact submitted text`），并保留 `2026-07-22-plan-specific-collaboration-state.md` 作为所有权权威。我核对了 `plan-mode/src/index.ts` 的区间 diff：**没有新增任何 `session.append(...)`**，与 note 一致。
3. `packages/plan/plan-mode/README.md` 新增一行宿主侧说明：「The review intent carries the originating tool-call id, so the Web client can reopen the same submitted plan after the review closes. The complete Markdown remains in the existing native call or PTC dispatch log.」

`docs/subsystems/plan.md` 区间内**零改动**（未列入 `git diff --name-status ... -- docs/subsystems` 的输出），所以本版**没有**在官方子系统文档层面记录计划卡。这是 note 与 docs 之间的一个覆盖缺口，值得在阅读时注意。

### 4. creator skills 渐进披露：实现不在 `packages/skill`，在 `packages/preset/agent-preset`

任务书写「creator skills 渐进披露（note `2026-09-21-creator-skills-progressive-disclosure.md`）：`packages/skill` 的改动」。**这条对应关系不成立**，我必须明确纠正，因为它会误导读者去 `packages/skill` 里找一个不存在的改动。

实测证据：

- note 由 `b13bbc027c feat(agent-preset): progressive creator skills and profile shell facts (#4836)` 新增——提交主题就是 `agent-preset`。
- note 提到的三个技能（`cordis-plugin-development`、`editing-cordis-compositions`、`cordis-composition-reference`）在 rc.1 的实际路径是：

```text
packages/preset/agent-preset/skills/cordis-composition-reference/SKILL.md
packages/preset/agent-preset/skills/cordis-composition-reference/references/packages.md
packages/preset/agent-preset/skills/cordis-plugin-development/SKILL.md
packages/preset/agent-preset/skills/cordis-plugin-development/references/{host-plugin,mcp-bundle,practices,ui-plugin,verification}.md
packages/preset/agent-preset/skills/cordis-plugin-development/templates/decoration/{client.js,cordis.patch.yml,index.js,package.json}
packages/preset/agent-preset/skills/cordis-plugin-development/templates/mcp/{cordis.patch.yml,package.json}
packages/preset/agent-preset/skills/editing-cordis-compositions/SKILL.md
```

`git diff --name-status … -- packages/preset/agent-preset/skills` 显示**全部 15 个文件都是 A（新增）**，合计 +831 行——也就是说这套技能目录是**在本区间内从零建立的**。

- note 的第二半（`DSH_PROFILE` / `DSH_PROFILE_DIR` 作为保留内置键）落地在 `packages/shell/dsh-shell-env`，实测到 `const DSH_PROFILE_KEY = \`${DSH_ENV_PREFIX}PROFILE\` as const` 与 `DSH_PROFILE_DIR_KEY`，并有「contributor 不得声称保留内置键，否则插件加载明确报错」的规则。
- `packages/skill` 在本区间的改动与 creator skills **无关**：`skill`、`skill-badge` 只有 `package.json`；`skill-filesystem` 只做 `as unknown` 清零与测试夹具补 `watch()` 覆写；`tool-skill` 只有 `package.json` 与 spec。

**`docs/subsystems/skills.md` 的区间变更**则确实只有 2 行，且内容是把 `skill-office` 补进 Provider 清单：

```diff
-The [skill capability family](...) includes ... the optional packaged badge provider ([dsh-skill-badge](...)), and the Consumer ...
+The [skill capability family](...) includes ... optional packaged providers ([dsh-skill-badge](...) and [dsh-skill-office](...)), and the Consumer ...

-Source: [..., `skill-badge/src/index.ts`], and [`skill/tool-skill/src/index.ts`](...).
+Source: [..., `skill-badge/src/index.ts`], [`skill/skill-office/src/index.ts`](...), and [`skill/tool-skill/src/index.ts`](...).
```

所以本文对 creator skills 的准确写法是：**决策已实现，但实现面在 `packages/preset/agent-preset/skills/`（15 个新增文件）与 `packages/shell/dsh-shell-env`，不在 `packages/skill`；它对 `docs/subsystems/skills.md` 的影响仅为 2 行。**

### 5. 开发者工具设置：`packages/settings` 只提供机制，不定义开关

任务书要求核实 note `2026-09-17-developer-tools-settings.md` 与 `2026-09-20-developer-tools-default-on.md` 与 `packages/settings` 的关系。实测结论：

- 这两个 note 的改动面是**客户端与 Host schema 的偏好声明**，提交分别是 `cdaafbc456 feat(client): add shared developer tools setting` 与 `4f0ee6b105 fix(settings): defer developer features until host preference resolves`——都**不在**本文的 26 个包内。
- `packages/settings/settings` 在本版提供的是**通用机制**，即「任意插件的 volatile Config 字段都能被投影成表单」；`ui-developer-tools.enabled` 只是这套机制的一个使用者。note 里「The Host schema defaults `ui-developer-tools.enabled` to `true`」中的「Host schema」是**被投影的插件 Config schema**，其默认值由该插件自己声明、由 `SettingsForms.describe()` 读 `entry.fiber.config` 得到——设置服务不持有任何默认值。
- 有一处**机制性证据**支持这条边界：`LEGACY_SECTION_ENTRIES` 明确把旧的 `ui-developer-tools` 段映射到 `ui-settings` entry（`src/index.ts:201-206`）。这正是「旧 settings.yaml 段 → 新 Config 字段」迁移表，说明开发者工具偏好在本版**从 settings 文档搬进了插件 Config**，与本篇主线（settings 服务重写）同源。
- note `2026-09-17-developer-tools-settings.md` 自己声明「This preference is presentation policy, not Host authorization」——与本篇的授权层（approval / sandbox）**无授权耦合**，只是同处「治理」叙事。

**`docs/subsystems/settings.md`** 是本版改动最剧烈的子系统文档：`1 file changed, 42 insertions(+), 292 deletions(-)`，标题从 `# User Settings` 改成 `# Plugin Configuration Forms`，删掉了 Identity / Registration / Owner scope / Descriptors / Change commits / Native document operations 六节，新增 Identity and values / Edits 两节。核心句子可直接引用：

```text
The [settings service](../../packages/settings/settings/README.md) projects volatile Config fields from active profile entries.
The [configuration editor](../../packages/boot/config-editor/README.md) persists edits through Cordis patches.
Business consumers read `.get()` on their own Config references.
```

生成区段的类名也从 `SettingsProvider`（abstract seam）变为 `SettingsForms`，方法集合收缩为 `configure` / `prepareDocument` / `describe` / `update` / `replace` / `mutate`。`settings/document-updated` 事件保留，但语义被显式降级：「It is a UI notification; consumers use `loader/volatile-update` only when they need to refresh registration facts.」

### 6. live configuration 与审批的交叉

note `2026-09-21-live-config-inspect-provider.md` 的决策面是 `@deepseek-ai/dsh-tool-cordis/host` 注册 `Config` inspect provider、删除 `Builtin` provider，**主体归第 01 篇**。与本篇（以及审批）的交叉点只有三处，简述如下：

1. **同一套 volatile 协议**。note `2026-09-18-volatile-config-references.md` 定义的 `.volatile()` → Loader 就地提交、`loader/volatile-update` 通知，是 `SettingsForms` 能「改配置不重挂插件」的前提。`schema.ts` 用 `isVolatile(value)`（来自 `@deepseek-ai/cosmokit`）剥引用，`isVolatilePath()` 在写路径上拒绝任何非 volatile 字段。
2. **审批插件是这条链路的直接受益者**。`permission-presets` 的 `defaultPreset` 变成 volatile 后，改默认预设不再需要重挂服务、不再会丢弃正在运行的 effects——这正是 note `2026-09-18-volatile-config-references.md` Problem 段描述的痛点（「Replacing an entire plugin to change a value also disposes its services and effects」）。所以「权限默认值可在设置页即时修改且不打断会话」是本版可验证的行为改进。
3. **审批本身没有被 inspect provider 触及**。`Config.listConfigs` 只列 Loader 树中的 entry；运行时创建的 Agent preset 树不在其中（note 明确说明）。审批策略的会话级覆盖仍走 `approval/policy` 事件，与配置表单是两条独立写路径。

**未核实**：note `2026-09-21-live-config-inspect-provider.md` 声称的 provider 行为我只核实了 note 文本与 `SettingsForms` 的对应关系，未逐行阅读 `packages/extensions/tool-cordis` 的 Host 半边实现。

### 7. 「删除 prompt registry change event」：提案未落地

任务书把 note `2026-09-19-retire-prompt-registry-change-event.md` 列为本版重点。核实结果与预期相反：

- 该 note 位于 **`.agents/notes/proposed/simplification/`**，文件头是 **`Status: proposed`**（不是 `implemented/`）。它由 `cf75d1d099 docs: refine simplification discovery and add nine proposals` 引入——一个**纯文档提案提交**，同批还有 `2026-09-19-config-only-hmr.md`、`2026-09-19-provider-only-instruction-reads.md` 等 9 条提案。
- `system-prompt/change` 事件在 rc.1 **依然存在**：

```text
packages/core/system-prompt/src/index.ts:37   'system-prompt/change'(): void
packages/core/system-prompt/src/index.ts:417  () => { this.ctx.emit('system-prompt/change') },
packages/core/system-prompt/src/index.ts:450  * `system-prompt/change`.
```

对照基线（`git show dsh-v0.1.6-alpha.1:packages/core/system-prompt/src/index.ts`）为 `:37` / `:418` / `:451`——行号仅整体位移 1 行，事件声明与发射点**都在**。

因此正确结论是：**该简化项在本版未被实施**，`packages/core/system-prompt`（不在本文包范围内）保持原状。若后续版本要落地，note 的 Acceptance criteria 提供了可执行清单（移除声明/发射点/生成清单/通知测试，并把 `ScopedLayers` 构造的 notification 回调改为可选）。

### 8. 生产归因审批权重与作者审批记分：流程治理，指向第 12 篇

这两条 note 属 **`.agents/notes/implemented/process/`**，改的是 `.github/review-ownership/` 下的 CI 审批策略，**与本文 26 个包无代码关系**。按任务要求简述并指向第 12 篇：

- `2026-09-11-production-blame-approval-weight.md`：一点审批按 `min(2, 1 + 4 × ownedLines / totalLines)` 缩放（0% → 1 分，12.5% → 1.5 分，≥25% → 2 分）；分类与 blame 都用 merge base；新增行无先前所有者，不进分母；比较前不取整。Verification 段列出的三份测试是 `.github/review-ownership/check-approval.test.mjs`、`blame-ownership.test.mjs`、`test_blame_production.py`。
- `2026-09-16-author-approval-credit.md`：作者每合入一个 PR 得 0.011 分，100 个 PR 封顶 1.1 分；历史查询在 100 个匹配 PR 处停止；作者信用单独不足以过线（91 个 PR + 一次普通审批刚好达标，90 个只有 1.99 分）。

两篇 note 的 `Status` 都是 `implemented`，权威文档是 `.github/review-ownership/README.md`。**未核实**：我未打开该 README 或三份测试脚本逐行核对数值实现。

### 9. goal / todo / identity / feedback / hooks 的区间改动

这一组基本是**跟随性变更**，但每一处都值得记录，因为它们暴露了本版两条横切改动的传播半径。

**(a) `goal` 包组：来源迁移 + 只读参数收窄**

- `goal/tool-goal`：`src/index.ts` 加 `MessageSourceMap` 声明（`'tool-goal'`），把 wrapup 上下文的来源从 `{ kind: 'plugin', plugin: 'tool-goal', form: 'notice', … }` 换成 `{ kind: 'tool-goal', form: 'notice', … }`。
- `goal/goal-round-driver`：两处函数参数从 `ContentBlock[]` 收窄为 `readonly ContentBlock[]`（`sameQueued` 与内部 `validReservation`）。这是纯粹的**只读承诺**强化，让「驱动只比较、不修改队列内容」在类型上成立。没有行为变化。
- `goal/goal`：`src/` 无改动，只有 `package.json` 与两个 spec（新增 `'test'` / `'ordinary-user-message'` 两个测试专用来源声明，并把回放校验用例里的来源字面量改成生产者形式）。
- `goal/command-goal`：仅 `package.json`。

**(b) `todo` / `identity` / `feedback`：只有版本与依赖范围**

| 包 | 实质改动 | 说明 |
|---|---|---|
| `todo/tool-todo` | 无 | `tests/integration.spec.ts` 一处断言从 `data.message.content[0].isError` 改为 `data.message.isError`（工具结果扁平化） |
| `identity/anonymous-user-id` | 无 | 仅 `package.json`（+7 / -7） |
| `feedback/command-feedback` | 无 | 仅 `package.json`（+16 / -16） |
| `feedback/message-feedback` | 无 | 仅 `package.json`（+19 / -19） |

这四个包的「改动」全部是 `workspace:^` → `workspace:*`（内部 DSH 包）/ `workspace:~`（vendor 与 native）的范围统一，由 `37372101b5 build: pin internal DSH workspace dependencies` 与 `4e6028a604 build: use tilde ranges for vendor and native workspaces` 两个 build 提交驱动。这解释了为什么本篇多个包的 diff 呈现「增删完全对称」的形态——那是版本号与依赖范围的行级替换。

**(c) `hooks` 包组：两处独立改动**

1. **生产者来源迁移**（横切改动）：`hooks-claude-code` / `hooks-codex` 的 `PLUGIN_SOURCE` 改名为 `CONTEXT_SOURCE` 并换成 `{ kind: 'hooks-claude-code' }` / `{ kind: 'hooks-codex' }`，三处注入点（`contextFrom`、Stop hook 的 `agent.steer`）随之更新。两个包的 `tests/coverage-cases.ts` 也把 `{ kind: 'plugin', plugin: 'policy' }` 改成 `{ kind: 'policy' }`。
2. **Hook 执行器跟随 shell `execute()` 收敛**：

```diff
-export async function runHook(bash: ShellExecutor, …)
+export async function runHook(bash: Pick<ShellExecutor, 'resolve' | 'execute'>, …)
-    const result = await bash.run(bash.resolve(request))
+    const result = await (await bash.execute(bash.resolve(request))).result()
```

参数类型从整个 `ShellExecutor` 收窄为它实际需要的两个方法——这是「只声明真正使用的能力」的写法。行为上对应 `d6bebc5783 feat(shell): converge on execute() and promote timed-out commands to jobs`（该提交同时引入了 `bb20149360 refactor(shell): register foreground commands as jobs at start and drop the promotion protocol`）。

**未核实**：`packages/shell` 的 `execute()`/`result()` 契约与超时提权语义（归第 05/06 篇），本文只核实了 hooks 侧的调用点与类型签名。

### 10. 官方 `docs/subsystems/*` 的区间变更清单（针对本文相关页面）

以 `git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- docs/subsystems/<name>.md` 逐页实测：

| 页面 | 区间变更 | 是否在本文范围 |
|---|---|---|
| `approval.md` | **NOCHANGE**（blob `656325aa44` 两端相同） | ✅ 本文 |
| `permission-presets.md` | 1 file, +2 / -2 | ✅ 本文 |
| `user-questions.md` | 1 file, **+2 / -0** | ✅ 本文 |
| `settings.md` | 1 file, +42 / **-292** | ✅ 本文 |
| `skills.md` | 1 file, +2 / -2 | ✅ 本文 |
| `plan.md` | **NOCHANGE** | ✅ 本文（覆盖缺口，见第 3 节） |
| `goal.md` | **NOCHANGE** | ✅ 本文 |
| `slots.md` | 1 file, +25 / -12 | 客户端槽位（第 09/10 篇） |
| `scope.md` | **NOCHANGE** | ✅ 本文 |
| `todo.md` | **NOCHANGE** | ✅ 本文 |
| `feedback.md` | **NOCHANGE** | ✅ 本文 |
| `session-projection.md` | 1 file, +21 / -19 | 第 02 篇 |
| `hooks.md` / `identity.md` / `guard.md` / `interaction.md` / `skill.md` / `plan-mode.md` | **不存在该页面**（`git cat-file -e` 非零退出） | — |

两点需要**明确标注为不存在**，以免读者误以为漏读：

1. `docs/subsystems/slots.md` 的 12 行净变化是**客户端槽位系统**的（`plugins.bundle.config`、`plugins.bundle.activation`、`conversation.input.activity` 三个新槽、`session-provider` 继承语义改写、槽位树新增 `conversation.plan-review.actions` 与 `shell.leading`）。其中 `conversation.plan-review.actions` 与 `conversation.approval.detail` 并列挂在 `conversation.composer` 下——这是本版计划评审 UI 的**槽位落点**，是本文主题在客户端侧的投影，但渲染归第 10 篇。
2. 该 10 个包组**没有**专属的 `docs/subsystems/*.md` 页面。`git ls-tree --name-only dsh-v0.1.7-rc.1 docs/subsystems` 的输出里不存在 `guard.md`、`interaction.md`、`identity.md`、`hooks.md`、`plan-mode.md`、`skill.md`（注意 `skills.md` 存在，是技能族的页面）。因此本文对 `guard`、`identity`、`feedback`（有 `feedback.md`，但区间无改动）、`hooks` 这几个包的描述，第一手依据是包内 README 与源码，而非子系统文档。

---

## 附录：本版提交索引

`git log --oneline --no-merges dsh-v0.1.6-alpha.1..dsh-v0.1.7-rc.1 -- <10 组路径>` 共 **24** 条。按对本文主题的作用分组：

**结构性改动**

| 提交 | 主题 |
|---|---|
| `601d6761e4` | `feat(settings): project volatile Config through profile-backed forms (#4587)` — settings 服务重写 + `permission-presets` 迁移 |
| `fb79a944f5` | `refactor(llm): separate durable producer sources from request inputs` — `MessageSourceMap` 落地到 guard/plan/goal/hooks/user-approval |
| `fa518ecd89` | `feat(desktop): enable standalone Office skills` — 新建 `skill-office` |
| `6e49ccad18` | `feat(skill): extract the workspace-dependencies tool into a package` — 新建 `tool-workspace-dependencies` |
| `f6428a164e` | `feat(web): keep submitted plans in chat and open them in sidebar` — 持久计划卡（宿主侧只有 `callId`） |
| `d6bebc5783` | `feat(shell): converge on execute() and promote timed-out commands to jobs` — `hook-protocol` 执行器跟随 |

**`skill`/Office 线的后续修补**

| 提交 | 主题 |
|---|---|
| `5e25475857` | `fix(office): use bundled LibreOffice Kit 0.1.0 CLI across deployments (#4902)` |
| `37983d9298` | `feat(sdk): bundle shared Office authoring resources` |
| `b51e64d70e` | `refactor(skill): flatten primary runtime version metadata` |
| `4d34cd87dd` | `fix(skill): address shared runtime review findings` |
| `87cd0d8eb9` | `fix(skill): validate workspace dependency entry types` |
| `8fad9ccd8c` | `feat(skill): complete shared Office runtime builds for SDK carriers` |
| `82ab876331` | `fix(office): validate strict and corrupt OOXML` |

**横切清理与测试跟随**

| 提交 | 主题 |
|---|---|
| `580bdc7258` | `refactor: remove redundant unknown casts` — `skill-filesystem` 的 `as unknown` 清零 |
| `3085139699` | `test(runtime): align fixtures with current type-safety gates` |
| `f4a32dbd0a` | `refactor(llm): flatten tool results and validate native V4 sessions` — 测试里的 `message.content[0].isError` → `message.isError` |
| `cf9213ca5f` | `fix(sidebar): finalize resource auto-refresh behavior and tests` |
| `bb20149360` | `refactor(shell): register foreground commands as jobs at start and drop the promotion protocol` |

**构建/发布**

| 提交 | 主题 |
|---|---|
| `37372101b5` | `build: pin internal DSH workspace dependencies` |
| `4e6028a604` | `build: use tilde ranges for vendor and native workspaces` |
| `112ce776ac` | `release(dsh): 0.1.7-alpha.1` |
| `10ea83bcc3` | `release(dsh): 0.1.7-alpha.2` |
| `6b1808f432` | `release(dsh): 0.1.6-alpha.2` |
| `a60af51e80` | `release(dsh): 0.1.7-rc.1` |

**区间外但为本篇提供上游决策的 note（由其它提交引入，包路径不在本文范围）**

| note | 引入提交 | 与本文的关系 |
|---|---|---|
| `implemented/architecture/2026-09-09-producer-owned-message-sources.md` | `fb79a944f5` | `MessageSourceMap` 的决策权威；本文第 1/9 节的依据 |
| `implemented/architecture/2026-09-18-volatile-config-references.md` | `3f7016a422` | `.volatile()` 语义权威；`SettingsForms` 的前提 |
| `implemented/feature/2026-09-15-bundled-office-skills.md` | `fa518ecd89` | `skill-office` 的决策记录 |
| `implemented/architecture/2026-09-17-settings-pages-as-companion-packages.md` | `93e67201dd` | `configure({ auto: false })` 的用途；归第 09 篇 |
| `implemented/architecture/2026-09-21-creator-skills-progressive-disclosure.md` | `b13bbc027c` | 实现在 `packages/preset/agent-preset/skills/`（15 个新增文件） |
| `implemented/architecture/2026-09-21-live-config-inspect-provider.md` | `8c146d978f` | 归第 01 篇；本文只写交叉 |
| `implemented/feature/2026-09-17-developer-tools-settings.md` | `cdaafbc456` | 偏好声明在客户端与 Host schema；设置服务只提供机制 |
| `implemented/feature/2026-09-20-developer-tools-default-on.md` | `4f0ee6b105` | 同上，覆盖前一 note 的默认值选择 |
| `implemented/architecture/2026-09-16-user-terminal-permissions.md` | `ab695ef4cf` | 用户终端不走 Agent 沙箱与审批；同为「授权边界」叙事 |
| `implemented/simplification/2026-09-15-host-only-remote-input-validation.md` | `7c74636892` | 仅宿主侧远端输入校验 |
| `implemented/process/2026-09-11-production-blame-approval-weight.md` | `cef92ed40b` | 流程治理 → 第 12 篇 |
| `implemented/process/2026-09-16-author-approval-credit.md` | `c7e7e8bc18` | 流程治理 → 第 12 篇 |
| `proposed/simplification/2026-09-19-retire-prompt-registry-change-event.md` | `cf75d1d099` | **未落地**；事件在 rc.1 仍存在 |

### note `2026-09-15-host-only-remote-input-validation.md` 的补充说明

这条 note（`Status: implemented`，由 `7c74636892 perf(api-gateway): avoid duplicate client input parsing` 引入）属「远端输入校验只做一次」的性能决策，**改动面在 Client Remote 与 Host Gateway，不在本文 26 个包内**。之所以被派给本篇，可能是因为它与审批走同一条 Remote 通路。与本篇唯一相关的两点：

1. Host Gateway 在**查表与业务调用之前**完成严格输入校验，非法 JavaScript 调用者拿到 `gateway/input-invalid`。审批请求若经 Remote 传入，其字段校验由宿主侧把关。
2. note 明确了一条**安全后果**，值得治理视角记录：「Undeclared object properties may cross the trusted carrier before the Host codec removes them, so callers that derive requests from untrusted or secret-bearing objects must construct the declared DTO rather than relying on Client parsing as a redaction step.」即**客户端解析不再能当作脱敏手段**。注意这与设置服务的 `redactSecrets` 不是一回事：`SettingsForms.describe({ redactSecrets: true })` 是**服务自己**在返回前剥掉 `role('secret')` 字段并在 `secrets: [{path, set}]` 里只报存在性，这是独立且仍然强制的机制（`packages/api/settings-controller/src/index.ts:103` 的远端读一律传 `redactSecrets: true`）。

### 本文标注为「未核实」的项（汇总）

1. **客户端与 e2e 侧**：`packages/client/ui-*` 的表单渲染、计划卡渲染、`apps/web/tests/*.e2e.ts`、`snapshots/` 的实际执行结果与录制会话语义，本文只核实文件存在、行数与它在文中被引用的接口名，未逐行阅读，也不对其通过与否作断言。
2. **`packages/preset/agent-preset/skills/*` 的技能文本内容**：我只核实了 15 个文件全部为区间内新增、合计 831 行，未阅读各 `SKILL.md` / `references/*` 的具体指令，因此不评价「首屏约 3.9 KB、每个 recipe 1–3 KB」等 note 中给出的体量数字。
3. **`packages/core/system-prompt` 与 `packages/llm/llm` 的实现细节**（`MessageSourceMap` 的完整成员、`ContextFormed` 字段清单、`system-prompt/change` 的发射时机、V3→V4 迁移表）：我只核实了 `MessageSourceMap` 定义位于 `packages/llm/llm/src/message.ts:110`、`ContextFormed` 位于 `:86`，以及 `system-prompt/change` 在两端都存在；其完整类型面归第 02/06 篇。
4. **`packages/shell` 的 `execute()` / `result()` / 超时提权语义**：归第 05/06 篇；本文只核实 hooks 侧签名收窄与调用点改写。
5. **`.github/review-ownership/README.md` 与三份审批权重测试脚本**：未打开，第 8 节的数值全部转述自 note 文本。
6. **`skill-office` 的 `assets/scripts/check_office.py`（279 行）与 `tests/check_office_test.py`（278 行）的具体校验规则**：我只核实了 `skill-office/src/index.ts` 对 `scripts/check_office.py` 的存在性校验（`:72-74`），未审读校验脚本本体，故不评价 note 中「Transitional/Strict 命名空间识别、合并单元格列数、公式计数不蕴含重算」等清单的实现程度。
7. **`tool-workspace-dependencies` 的 `parsePrimaryRuntime` / `installPrimaryRuntime` 行为**：本文只核实了导出符号清单与包规模（7 文件 / +1034 行），未逐行阅读该 277 行实现。
8. **`permission-presets` 的 `AUTO_PRESET` 与客户端 locale 契约**：本文只核实了 `registerAuto` 在源码中的存在与 note/README 的表述一致性，未阅读 `ui-permission-presets` 的字典实现。

### 一句话结论

本版这一区域的主线不是「新增治理能力」，而是**治理状态的所有权归位**：权限默认值从 `settings.yaml` 的 `permission` 段搬回 `permission-presets` 自己的 `Config`（借道 `.volatile()`），配置编辑从「插件注册命名空间 + 独立文档 Provider」变成「从 Config schema 投影表单」，插件注入的消息归属从共享的 `plugin` 包装变成按生产者声明。`approval.md` 与 `plan.md` 的零改动、以及 `settings.md` 的 −292 行，共同说明这是一次**减法式重构**而非功能扩张；`skill` 包组新增的 2627 行（Office 与工作区依赖）是同期唯一的净新增能力。
