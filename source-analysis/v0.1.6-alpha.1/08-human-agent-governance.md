# 【第 08 篇】人机协作与治理：approval / permission-presets / commands / goal / plan / guard / settings / credentials（0.1.6-alpha.1）

## 引言

| 项 | 值 |
|---|---|
| 本文版本 / 对照版本 | **dsh-v0.1.6-alpha.1**（`0a15e36e7f`，tag 日期 2026-09-15） vs **dsh-v0.1.5-rc.2**（`fb2c4b9e69`） |
| 包范围 | `packages/{interaction, guard, goal, plan, settings, credentials, workspace}/`、`packages/experimental/auto-review/`；客户端面见 `packages/client/ui-{permission-presets, agent-preset, settings-unarchive-sessions, commands, tool}/` |
| 官方子系统文档 | `docs/subsystems/{approval, permission-presets, plan, goal, credentials, sandbox}.md` |

本篇覆盖"人如何参与并约束 agent"的全部机制：审批闸门、权限预设、命令平面、目标持久化、计划软引导、循环卫生、设置、凭据与工作区组织。本版的两条主线是**读侧分离**（进程目录 vs 会话选择）与**身份与文案解耦**（命令身份、Auto 身份）；此外新增了一个面向用户的实验模式「Auto review」。见第 6 节。

---

## 概述

治理与协作的十条需求：

| 编号 | 需求 | 关键实现落点 |
|---|---|---|
| R1 / R2 | 审批可问可拒（闭集结果 `allowed-once` / `rejected` / `cancelled` / `unavailable`，无应答即拒绝）+ 可审计（`approval/asked` / `approval/decided` 由 `ApprovalRequestId` 配对） | `packages/interaction/user-approval` 及其 `src/invariant.ts` |
| R3 | 预设是枢纽、旋钮是事实：预设只记录用户意图，执行读 `sandbox/mode` 与 `approval/policy` | `packages/interaction/permission-presets` |
| R4 | **读侧分离**（本版强化）：可选预设目录是**进程级**事实，当前选择是**会话级**事实 | `PermissionCatalog` vs `PermissionSelection` |
| R5 | **命令身份与文案分离**（本版新增）：稳定 `CommandDefinitionId` 取代英文描述匹配 | `packages/interaction/commands/src/brand.ts` |
| R6 / R7 | 目标可持久（`GoalRef` 的 id + revision CAS、四阶段、blocked 带原因码）+ 计划是软引导（`plan/mode` 纯折叠恢复，不强制行为） | `packages/goal/goal`；`packages/plan/plan-mode` |
| R8 | 循环卫生：重复调用提醒（advisory）+ 工具超时强制 | `packages/guard/{repeat-tool-reminder, timeout-policy}` |
| R9 | **授权给模型需显式确认**（本版新增）：实验性的、显式安装的 `auto` 身份 | `packages/experimental/auto-review` |
| R10 | **归档可逆**（本版新增）：隐藏会话可恢复，且恢复不引入未知引用 | `WorkspaceRegistry.unarchiveSession` |

**非功能底线**：失败关闭（N1）、可重放（N2）、单写路径（N3，`setApprovalPolicy` / `setSandboxMode`）、**进程事实不进会话日志**（N4，本版新增）、软引导与强制互不读写（N5）、**身份不是授权声明**（N6，本版新增）。

**边界**：plan 不强制（执行限制由 sandbox/approval 负责）；goal 是同会话目标，不是 subagent；guard 只提醒与超时，不做内容审查；Auto review **不是确定性安全边界**；UI 组件属于 `packages/client/`。

---

## 核心概念

**审批闸门与闭集结果**：审批缝的结果是**闭集**且失败关闭——无回答者、回答者异常或应答缺失一律落到 `unavailable`，调用方只有在拿到 `allowed-once` 时才放行。审批策略本身也来自日志：`ApprovalService.overrideOf(session)` 反向扫描日志里最后一条 `approval/policy`；`hasOpenTurn(session)` 同样反向扫描 `turn/start` / `turn/end` 判断是否处于开放轮次。**预设、旋钮与身份**：旋钮（`sandbox/mode` 的三种模式与 `approval/policy` 的 `ask` / `never`）是唯一的执行真相；一个预设是一个稳定键到一组旋钮 bundle 的映射（默认随附 `workspace-write` + `ask` 与 `danger-full-access` + `never`）；`custom` 是旋钮值匹配不到任何可用预设时的**派生态**，客户端可以显示它，但它**永不**是切换目标、也**永不**成为事件载荷；`auto`（本版新增）是实验性的**当前会话专有**身份，bundle 固定为 `danger-full-access` + `never`，只能由 `registerAuto(admit)` 在其 effect 生命周期内发布；**目录（catalog）与会话选择（selection）**在本版被物理分开——目录是进程级 `Remote`，选择是会话投影。

**命令身份**：注册表在**有效定义**与 descriptor 上保留一个可选的品牌 `CommandDefinitionId`。首方生产者用**自己的包名**作为身份（例如 `@deepseek-ai/dsh-command-goal`、`@deepseek-ai/dsh-plan-mode`）。作用域内同名覆盖会选中完整 descriptor，**绝不**继承被遮蔽定义的身份。

**授权层次的分类（Auto review 的风险词汇）**：

| 风险 | 例子 | 决策 |
|---|---|---|
| `low` | 普通项目内读写、分析、format/lint/test/build、非破坏性 Git，以及"本 Session 内保留的调用已确立其创建"的对象的一次精确清理 | 放行 |
| `medium` | 既存状态的不可逆删除、force push / 历史改写、生产环境读写与部署、非敏感外部写入/发送、权限/安全/系统变更 | 仅在当前人类或直系父代理给出**指名动作、确切目标与必要范围**的显式授权时放行 |
| `high` | 跨当前信任边界的敏感数据外泄及其等价的硬拒绝效果 | 拒绝，**包括被显式请求的情况** |

---

## 包结构

| 包 | 职责 | ctx 键 / 出口 |
|---|---|---|
| `packages/interaction/user-approval` | 审批缝：`ApprovalPolicy`、`overrideOf`、`setApprovalPolicy`、审计对不变式 | `ctx.approval` |
| `packages/interaction/permission-presets` | 预设表、Auto 注册钩子、`catalog` Remote、`permissions` 投影、`/permission` 命令 | `ctx.permissionPresets`；`./typert`、`./remote` |
| `packages/interaction/commands` | 命令注册表、`CommandDefinitionId`、descriptor、生命周期事件 | `ctx.commands` |
| `packages/interaction/{user-questions, tool-ask-user}` | 用户提问缝与模型侧 `ask_user_question` | `ctx.userQuestions` |
| `packages/experimental/auto-review` | **本版新增**：每次调用前的模型审查层 | 经 `permissionPresets.registerAuto` |
| `packages/guard/{repeat-tool-reminder, timeout-policy}` | 重复工具调用提醒（默认 3 / 5 / 8 次）；每工具调用超时策略 | 无服务键 |
| `packages/goal/{goal, tool-goal, command-goal, goal-round-driver}` | 同会话目标、模型工具、`/goal` 命令、自动续行 Round | `ctx.goals` |
| `packages/plan/plan-mode` | 计划模式：`/plan`、`exit_plan_mode`、软引导提示段 | `ctx.planMode` |
| `packages/{settings/{settings, settings-file}, credentials/{credentials, credentials-local, authorization}, workspace/workspace}` | 命名空间设置读写与文件后端；凭据 seam 与人引导授权；项目列表与会话归档恢复 | `ctx.settings` / `ctx.credentials` / `ctx.workspaceRegistry` |

**本版新增客户端包**：`packages/client/ui-settings-unarchive-sessions/`（设置页的归档会话分区）。

---

## 关键类型

```typescript
// ── 权限：读侧分离（本版改写）────────────────────────────────
/** 稳定选项值：配置预设键、live `auto`，或派生的 `custom`。 */
export interface PresetOption { value: string; name: string; description?: string }
/** 进程级权限目录。随 live 贡献变化，刻意与会话历史分开。 */
export interface PermissionCatalog { options: PresetOption[] }
/** 整个 `permissions` 会话投影：只含当前 durable 选择。 */
export interface PermissionSelection { currentValue: string }

declare module '@deepseek-ai/cordis' {
  interface Events {
    /** 可选目录已变化。刻意无载荷：消费者先订阅，再重读完整目录。 @mode emit */
    'permission-presets/catalog-changed'(): void
  }
}

export interface PresetSpec {                // sandbox: 三种模式；approval: 'ask' | 'never'
  sandbox: SandboxMode; approval: ApprovalPolicy; name?: string; description?: string
}

export const CUSTOM_PRESET = 'custom'   // 派生状态，不可配置
export const AUTO_PRESET = 'auto'       // 保留给 Auto review 集成

// ── 命令：身份（本版新增）────────────────────────────────────
/** 命令定义的稳定、插件自有身份，独立于名称与文案。 */
export type CommandDefinitionId = Branded<'CommandDefinitionId'>
export function CommandDefinitionId(id: string): CommandDefinitionId

// ── 权限服务面（本版新增 `catalog` 与 `registerAuto`）────────
export class PermissionPresetService extends TypertRemoteService {
  @Remote('catalog') catalog(): PermissionCatalog
  /** 为调用集成的 effect 生命周期发布固定的当前会话 Auto 预设。 */
  registerAuto(admit: () => void): () => Promise<void>
  current(session: Session): string   // 匹配不到时返回 CUSTOM_PRESET
  resolve(name: string): PresetSpec   // 未知名字抛错
  optionOf(name: string): PresetOption
  set(session: Session, name: string): void
}
```

`CommandDefinition` 与 `CommandDescriptor` 各新增一个可选字段 `readonly definitionId?: CommandDefinitionId`（"无身份类客户端行为的定义可省略"）；注册表在**有效定义**与 **descriptor** 上同时保留它。

---

## 数据流

**审批流**：工具执行需要审批 → approval 缝 mint 一个 `ApprovalRequestId` → 追加 `approval/asked` → 请求沿回答者链下行 → 追加 `approval/decided`（闭集结果）→ 调用方**只在 `allowed-once` 时**放行，其余一律拒绝并失败关闭。

**预设切换流**：`set(session, name)` → 解析预设（unknown name 抛错）→ Auto 适用时先跑**同步** `admit()` 闸门 → 追加 `permission/preset`（**仅当** `name` 尚非当前有效预设）→ 经 `setSandboxMode` / `setApprovalPolicy` 写穿旋钮（**仅当**该旋钮的有效值真的变化）。选择事件在同一轮里**先于**旋钮事件；重选当前有效预设不追加任何事件。

**Auto review 审查流**：

1. **准入**：原生调用或已启动的 PTC `tools.*` 内部调用在第一个 await 之前同步完成准入与"进入活跃审查"；外层 `run_code` 传输与 PTC 程序里的直接 Node 副作用**不在保证范围内**；
2. **取料**：审查者只用最新的 `request/header.config` 提供方/模型与随附适配器的默认 reasoning；请求由五个固定分区组成（`REVIEW_POLICY` / `ENVIRONMENT` / `PROJECT_INSTRUCTIONS` / `FILTERED_HISTORY` / `PENDING_ACTION`）；主代理的 V3 `system/message` 节点、assistant 文本/reasoning 与工具结果都被排除，当前调用必须属于 `step/start` 记录的**开放 step**，缺失 step 归属即失败关闭；
3. **判权**：人类文本定义或替换任务与限制（`source.kind === 'user'` 且带浏览器准入时写入的 `rpcId`）；直系父代理文本在这些限制内定义子任务（子代理的首个 prompt 在其既有创建描述符之后识别，后续 `agent-message` 需 `senderSessionId` 匹配 `SessionHeader.parentSession`）；项目指令只做约束；检查点只恢复有损上下文，压缩**不会**把检查点提升为已离开界面文本的人类权威；
4. **出结论与失败路径**：审查者可发出 reasoning 块后跟**恰好一个** JSON 文本块与终止 `stop`；闭集只允许 `low + allow`、`medium + allow/deny`、`high + deny`，只有 deny 可带字符串 `reason`。字段多余、成员重复、组合非法、其它块或终止方式、provider 失败**共用 Auto 的普通拒绝结果**；风险与审查轨迹**不是** durable 状态；
5. **不执行**：`AutoReviewDeniedError` / `AUTO_REVIEW_DENIED` 走普通失败渲染，主代理只看到 `Auto review rejected tool "<name>"; its body was not executed`；PTC 保留既有异常/捕获行为，捕获一次拒绝**不会**把它升格为外层失败；**没有任何被拒绝的审查会启动工具主体**。

**命令分发流**：UI 提交 → 客户端私有 `resolution.ts` 解析输入（完全匹配的注册名优先；中英文别名只选中生效会话目录里对应的首方定义；菜单 claim 用当前 locale 拼写，typed claim 保留所给拼写）→ 提交用解析出的**注册名** → 注册表执行 handler → 追加 `command/run` / `command/done`（由 `CommandId` 配对）。

**工作区排序流**：「最近更新」是当前会话摘要的**纯投影**（按 `updatedAt` 降序、会话 id 并列次序）；选中且仍为空白的 New Session 在任一基准顺序之后被强制排到最前。拖动会话会**快照全部活跃账号** → 只改浏览器本地账号 → **原子地**切到 Manual；进入 Manual 时从当前时间序冻结每个活跃账号；回到「最近更新」丢弃手动布局。

---

## 测试覆盖

| 层 | 主要证据 |
|---|---|
| 权限 / 命令 / 预设单测 | `packages/interaction/permission-presets/tests/{permission-presets, projection}.spec.ts`；`packages/interaction/commands/tests/commands.spec.ts`；`packages/preset/agent-presets/tests/{settings, remote}.spec.ts`（断言 `modeSelectionEnabled` 默认 `true`、切换后 `false`）；`packages/goal/command-goal/tests/command-goal.spec.ts` 与 `packages/plan/plan-mode/tests/plan-mode.spec.ts`（断言各自的 `definitionId`） |
| 客户端 | `packages/client/ui-permission-presets/tests/{catalog, browser-plugin}.client.spec.ts`；`packages/client/ui-agent-preset/tests/{settings-store, section-store, apply}.client.spec.*`；`packages/client/ui-tool/tests/tool-row.client.spec.tsx`；`packages/client/ui-settings-unarchive-sessions/tests/{browser-plugin, components}.client.spec.tsx` |
| Auto review | `packages/experimental/auto-review/tests/{auto-review.spec.ts, auto-review.e2e.ts}`；`apps/web/tests/{auto-review-denial.e2e.ts, auto-review-fixture.ts, auto-review-child.overlay.yml}` |
| goal / plan / 工作区 | `packages/goal/goal/tests/{goal, projection}.spec.ts`；`packages/goal/goal-round-driver/tests/goal-round-driver.spec.ts`；`packages/plan/plan-mode/tests/{plan-mode, projection}.spec.ts`；`packages/workspace/workspace/tests/workspace.spec.ts`（+60 行）；`snapshots/web/workspace-recency/` |

---

## 与上游 / 下游的关系

- **上游**：`permission-presets` 要求一个**可约束的** `ctx.shell` 执行器（带 `sandboxMode` 能力事实）与 `ctx.approval`，并依赖 `ctx.sessionProjection`；**本版新增**对 `@deepseek-ai/dsh-typert-protocol` 的依赖与 `./typert`、`./remote` 出口。`auto-review` 消费 `permissionPresets`、`tools` 与 LLM 适配层；`goal-round-driver` 消费 `ctx.goals` 与 agent idle 状态；`ui-agent-preset` 消费 `settings` 与 `agentPresets/list` Remote。
- **下游**：`packages/subagent/subagent/src/child-agent.ts` 消费 `ctx.get('permissionPresets')`（第 07 篇 T3）；`packages/client/ui-permission-presets` 消费 `catalog` Remote 与 `permissions` 投影；`ui-settings-unarchive-sessions` 消费 workspace registry。**平级**：`packages/guard` 挂在工具 waterfall 上；`packages/settings` 提供命名空间读写；`packages/credentials` 与 `authorization` 提供人引导的密钥获取；`packages/workspace` 提供会话组织。

---

## 6 本版本变更要点（rc.2 → 0.1.6-alpha.1）

> 本节占全文过半篇幅，是本文重点。所有结论都指向具体文件或 commit 哈希；无法核实的标注「未核实」。

### 6.1 主题总览

| # | 主题 | 判据 |
|---|---|---|
| T1 | **新增实验模式「Auto review」**（每次工具调用前由模型审查） | 新包 `packages/experimental/auto-review/`；`b3b7e00449`、`55e53907ab` 及 20+ 后续修复 |
| T2 | **权限读侧拆分**：进程目录 + 会话选择 | `permission-presets/src/types.ts`；`@Remote('catalog')`；`PermissionSelect` 删除 |
| T3 | **命令身份与文案解耦** + composer File 动作归属调整 | `996278e6ce` + Agent Note `2026-09-10-command-identities-and-composer-file-action.md` |
| T4 | Agent preset 选择器由设置项开关 | `c31ac4fdfe`（PR #3870） |
| T5 | 归档会话可恢复 | `5f773a0ded`、`76941d0085`；`WorkspaceRegistry.unarchiveSession` |
| T6 | 工作区排序：最近更新改为纯投影、手动顺序改为浏览器本地 | `8423b270e3`、`d19d23cf86` + Note `2026-09-10-derived-workspace-recency.md` |
| T7 / T8 | plan 命令身份独立于可选运行时；goal 自动续行订阅点迁移 | `fff1ed7aa2`、`ca827aa2ad`；`goal-round-driver/src/index.ts`：`agent/session-start` → `agent/created` |
| T9 | `settings` / `credentials` / `guard` / `user-approval` / `tool-ask-user` / `user-questions` 无功能性源码变更 | 见 6.9 |
| T10 | **CI / 发布流程**的审批审查工作流身份判定（**与产品审批无关**） | `e7b8ebedaf` + Note `2026-09-10-approval-review-workflow-identity.md` |

### 6.2 T1：Auto review（实验层）

**问题**（`2026-08-28-auto-review.md` 的 `## Problem` 要点）：完全放开让有用的项目工作不必反复批准，但它同时放行破坏性操作与敏感外泄。把审批委托给模型需要一个显式的授权策略、一份待执行动作的完整描述、以及一条"绝不执行被拒绝主体"的失败路径。共享 Full access 的执行旋钮还要求一个**独立的 durable 模式身份**，包括子代理继承旧 fork 前缀的情形。

**决策**（Note 的 `## Decision`）：

| 维度 | 内容 |
|---|---|
| 包 | `dsh-experimental-auto-review`（`packages/experimental/auto-review`），按 `2026-09-12-publish-all-experimental-packages.md` 发布 |
| 默认 Web | 保留 Read Only、Workspace Write、Full access；Auto **不在其中** |
| 身份 | 当前会话专有的 `auto`，唯一 durable 身份是 `permission/preset:auto` |
| 旋钮 | 与 Full access **完全相同**的 `danger-full-access + never`，工具定义也不变 |
| 覆盖范围 | 每次原生调用与已启动的 PTC `tools.*` 内部调用各审一次；外层 `run_code` 传输与 PTC 程序里的直接 Node 副作用**不在保证范围内** |
| 明确不做 | 无工具名豁免、无缓存授权、无重试、无可配置策略、无第二道授权检查、无手动回退；重复调用各审一次 |
| 其他组合 | headless、General settings、新建会话默认值**都排除**该集成 |

**审查请求的五个固定分区**（Note「One complete reviewer request」）：

| 分区 | 保留的输入 |
|---|---|
| `REVIEW_POLICY` | 固定的分类、来源权威与严格结果规则；allow 在 Full access 下立即执行且无后续确认 |
| `ENVIRONMENT` | 只用既有 Session header 的 `cwd` |
| `PROJECT_INSTRUCTIONS` | 可见的项目指令及其原始来源与"只做约束"的角色 |
| `FILTERED_HISTORY` | 当前压缩面上带来源的人类/直系父代理消息、检查点、图片/附件事实，以及带已记录参数的历史调用名 |
| `PENDING_ACTION` | 工具名、描述、参数 schema 与已解析参数 |

审查者**只使用最新的 `request/header.config` 提供方/模型**与随附适配器的默认 reasoning；不比较冗余路由元数据，也不复制主代理的请求。主代理的 V3 `system/message` 节点、assistant 文本/reasoning 与工具结果都被排除。当前调用必须属于 `step/start` 记录的**开放 step**，缺失 step 归属即失败关闭；未启动的兄弟调用没有历史调用事实。

**动作历史的读取方式**（Note 原文要点）：审查者从会话的**完整动作历史**构造两个 action 分区——一次授权就是 `REVIEW_POLICY` 来源规则判定为合格的那次更早调用，而重复或冲突的身份必须在日志**任意位置**可见，而不是只在最近窗口内，因此会话投影与有界读取都不足以支撑该决策。这个读取是**已弃用的同步 `snapshotEvents()`**，带行内 `typescript/no-deprecated` 豁免。

**结果与取消**：闭集对象只允许 `low + allow`、`medium + allow/deny`、`high + deny`；只有 deny 可带字符串 `reason`。字段多余、成员重复、组合非法、其它块或终止方式、provider 失败**共用普通 Auto 拒绝结果**；风险与审查轨迹**不是** durable 状态。准入与"进入活跃审查"在第一个 await 之前同步完成；卸载时关闭新选择/新审查准入，把活跃 Auto 会话经**既有预设写入器**改为 Full access（不改旋钮、不关终端），再中止并排空审查。**provider 结算之后，生命周期中止总是产生规范的派发前取消**——包括迟到的 allow、deny 或失败；调用方取消保留 ToolRuntime 的优先级。一个持久化的 Auto 会话在集成缺失或失败时**不能发布**，其日志不被重写，也不跑后台重试。

**进程目录与子代理**：权限所有者通过生成的 `permissionPresets` Remote 方法发布**一份完整的进程目录**；BFF 显式挂载它并转发一个**无载荷**的失效事件。一个浏览器目录**先订阅再读取**，同时服务两个选择器；epoch 与连接世代检查只发布胜出的完整结果。Auto 带一个上标 `EXP` 徽标；两个可见的当前会话选择器都要求实验性确认，而显式 `/permission auto` 本身已构成同意。委托侧：Auto 或 Full access 在第一个 await 之前被记录，并在 fork 播种与沙箱/审批覆盖之后追加该既有预设事件（第 07 篇 T3）。

**被否决的备选**（Note `## Alternatives considered`）：把集成做成默认或已发布（会让实验性的模型审批策略成为每个部署的一部分）；新增沙箱或审批策略取值（会把审查与执行耦合，并产生没有消费者的组合）；持久化 PTC schema 或重读注册表（会放大 durable 线格式，或审查到与程序实际收到的绑定不同的定义）；用会话事件表达目录变化（会把进程可用性指派给某个会话并要求同序列重发）；可配置策略、豁免、授权或第二道审批阶段（会削弱固定安全上限并引入第二个决策生命周期）。

**后果**（Note `## Consequences`）：Auto 增加模型延迟与 token 成本，也可能误判效果；它的完全放开执行与 PTC 程序限制使实验性确认成为必要；过滤限制了不可信指令角色，但**不能让 LLM 分类器成为确定性安全边界**。认证运行器在隔离目标上用随附工具与**恰好八次**真实审查调用（Flash 覆盖精确的会话内创建清理、未授权/已授权的既存删除、被显式请求的合成外泄；Pro 与 Vision 各自只重复 medium 那对），记录脱敏决策与外部效果，不重试、不跳例。

**相关提交**（按时间序，节选）：

| commit | 标题 | 作用 |
|---|---|---|
| `b3b7e00449` | `feat(permission): add Auto review mode` | 首个实现（126 文件）；当时包位于 `packages/interaction/auto-review` |
| `d381a3c6f4` | `feat(auto-review): enforce risk-classified review` | 风险分级 |
| `0df80cdf41` | `fix(auto-review): carry lifecycle cancellation to dispatch` | 生命周期取消传导 |
| `dae5844f93` | `fix(auto-review): scope logged calls by step` | 历史调用按 step 归属 |
| `681b0b66a9` | `fix(auto-review): align review and teardown boundaries` | 审查与拆除边界 |
| `55e53907ab` | `feat(permission): add experimental Auto review` | 包落到 `packages/experimental/auto-review`（最终位置） |
| `2505fcaf97` | `fix(auto-review): align risk policy and core certification` | 风险策略与认证对齐 |
| `e6ae1bc751` | `refactor(permission): simplify Auto review ownership` | 归属简化 |
| `1ec5f21e82` | `fix(permission): tighten Auto review validation` | 校验收紧 |
| `11c4fa1b0a` | `fix(permissions): harden auto disposal migration` | 卸载迁移加固 |
| `197161e660` | `fix(permission): simplify Auto identity and teardown` | 身份与拆除简化 |
| `64fa60d3d4` | `fix(permission): close auto review gaps` | 缺口收口 |
| `41fbde8034` | `fix(permission): revoke stale Auto choices and simplify review paths` | 撤销陈旧选择 |
| `6b19923ad5` | `fix(auto-review): clear the master integration gates` | 集成门禁 |
| `d8c54899b7` | `fix(experimental): align the Auto review package version with the release` | 版本对齐 |
| `ad93e2f602` | `fix(auto-review): preserve nested trajectory errors and optional peer` | 嵌套错误保留 |
| `2d9e3a175f` | `docs(auto-review): name delegation records explicitly` | 文档 |

**未核实**：`packages/interaction/auto-review` 早期位置与 `packages/experimental/auto-review` 之间是否存在一次性 rename commit（`git log --no-merges -M --diff-filter=R` 在本区间未检出对该路径的 rename 记录；两次都是 "add"）。

### 6.3 T2：权限读侧拆分（进程目录 + 会话选择）

| 维度 | rc.2 | 0.1.6-alpha.1 |
|---|---|---|
| 投影值类型 | `PermissionSelect { options, currentValue }` | `PermissionSelection { currentValue }` |
| 目录来源 | 随投影一起下发 | 进程级 `PermissionPresetService.catalog()`，带 `@Remote('catalog')` |
| 失效通知 | 无 | `permission-presets/catalog-changed`（**无载荷**，消费者先订阅再重读） |
| 新增 API | — | `catalog()`；`registerAuto(admit)` 返回异步 effect disposer |
| `selectFor(state)` | 存在 | 删除 |
| `set()` | 解析预设 → 写事件 → 写旋钮 | 增加"Auto 适用时先跑同步 `admit`"这一步 |
| 保留名 | `custom` | `custom` **与** `auto`（配置表中出现即加载失败） |
| `names` 语义 | 按表声明顺序列出可切换预设 | 配置预设按声明顺序，其后跟随**集成存活期间的 Auto** |
| 包出口 / 依赖 | `./src/*`、`./package.json` | 追加 `./typert`、`./remote`；依赖追加 `@deepseek-ai/dsh-typert-protocol` |
| `PermissionSelect.tsx` 客户端 | 从投影读选项 | 目录经订阅 + 世代检查获取 |

**关键不变量**：目录安装或移除**不写 Session 事件、不发投影帧、不改序列号**（Note 原文："Session projection carries current selection only, so catalog installation or removal writes no Session event or sequence"）。

**客户端相关提交**：

| commit | 标题 | 作用 |
|---|---|---|
| `fdeeacef74` | `fix(web): revoke withdrawn permission choices` | 选择器撤销被撤回的选项 |
| `e995d71a0e` | `fix(permission): keep the picker retryable after a failed catalog read` | 可用性只跟随会话投影；读失败由选择器自己的重试呈现 |
| `4a935ed8fd` | `fix(permission): drop the picker only on a catalog invalidation` | 选择器等待的那次读的结果发布**不再**关闭它 |
| `eb6373d711` | `fix(permission): tick only on a real generation change` | 重复发布同一 generation 的通知不再撤回已显示选项 |
| `14bdce3644` | `docs(permission): describe dismissal as a catalog invalidation` | 文档对齐 |
| `62dd508cb0` | `test(permission): pin the disposed guard on the invalidation tick` | 测试加固 |

### 6.4 T3：命令身份与 composer File 动作归属

Agent Note `.agents/notes/implemented/architecture/2026-09-10-command-identities-and-composer-file-action.md`。

**问题**（Note 的 `## Problem`）：把命令的英文描述与客户端字典匹配，会让**标点变化**影响本地化与插入的命令 token；一个同名覆盖也可能照抄该描述却没有实现首方命令。File 菜单项需要 composer 的**实时**附件策略（mount、lock、提交状态），单独的 command-plugin 检查无法确定这些状态。

**决策**（Note 的 `## Decision`）：

| 项 | 内容 |
|---|---|
| 身份保留 | 命令注册表在**有效定义**与 descriptor 上保留可选的品牌 `CommandDefinitionId` 作为 `definitionId` |
| 首方身份选择 | 首方生产者用**自己的包名**作为稳定身份 |
| 作用域遮蔽 | 选中完整 descriptor，**绝不**继承被遮蔽定义的身份 |
| 身份性质 | 发现元数据，不是授权声明，**不进入**命令生命周期事件 |
| 客户端解析 | 私有 `resolution.ts`：完全匹配的注册名优先；中英文别名只选中生效会话目录里对应的首方定义；菜单 claim 用当前 locale 拼写，typed claim 保留所给拼写，提交用解析出的注册名 |
| `presentation.ts` 职责 | 只拥有 sections、labels、descriptions、icons；解析辅助函数与 section 常量**不从插件入口导出** |
| File 动作归属 | 由 Conversation 经注入的命令服务注册，并由它拥有本地化标签；挂载的输入绑定文件对话框打开器与**一个**实时可用性查询 |
| 编译面 | 组装使用一个很窄的结构化 action-registration 面（因为命令 UI 消费 Conversation 的输入类型，反向的项目依赖会成环）；其注册测试对照命令插件的贡献类型 |

**后果**（Note 的 `## Consequences`）：首方生产者与客户端身份映射必须就稳定标识符达成一致，第三方定义可以省略；展示文案可以独立演进。注册表测试覆盖 descriptor 保留与遮蔽；客户端测试覆盖两种 locale 下的描述编辑、别名解析与完全匹配优先；composer 测试覆盖实时可用性、打开器替换、卸载与 action 注册销毁。

**同族提交**：

| commit | 标题 | 作用 |
|---|---|---|
| `996278e6ce` | `refactor: separate command identity and composer file action ownership` | 主体改造（52 文件，+467/−206） |
| `ca827aa2ad` | `fix(commands): refresh catalogs and use type-only export identity` | 刷新生成目录、身份改为 type-only 导出 |
| `fff1ed7aa2` | `fix(plan): keep command identity independent of optional runtime` | `plan-mode` 用 `brandString<CommandDefinitionId>` 声明身份，并补上 `@deepseek-ai/dsh-brand` 依赖 |
| `5b1bb021cf` | `feat(web): group, localize, and re-present the composer command menu` | composer 命令菜单分组/本地化/重排（119 文件） |
| `2c9eda5b6f` | `feat(client): add plan, compact, and shield glyphs for the composer menu` | 新图标 |
| `351b399639` | `feat(ui-commands): swap the feedback command icon to a paper plane` | 反馈图标 |
| `00c2c47e19` | `fix(web): key the claim hint on the command name, not the claim token` | claim 提示键改为命令名 |
| `eff482c46b` | `fix(web): stabilize composer command editing and scrolling` | composer 编辑/滚动稳定化 |
| `7910cd9e0b` | `test(web): assert the shipped feedback command identity` | 首方身份断言 |

**身份落地实例**：`packages/goal/command-goal/src/index.ts` 声明 `CommandDefinitionId('@deepseek-ai/dsh-command-goal')`，并顺手把 description 首字母大写（`'set or view…'` → `'Set or view…'`）——**描述变了、行为没变**，这正是身份与文案解耦的实证。`packages/plan/plan-mode/src/index.ts` 声明 `@deepseek-ai/dsh-plan-mode`。

### 6.5 T4：Agent preset 选择器由设置项开关

**commit**：`c31ac4fdfe feat(web): gate agent preset selection behind a setting (#3870)`。

| 维度 | rc.2 | 0.1.6-alpha.1 |
|---|---|---|
| roster Remote 返回 | `{ presets, authorable }` | 追加 `modeSelectionEnabled: boolean` |
| 存储位置 | — | `agent-presets` settings 命名空间的 `modeSelectionEnabled` 字段（schema 默认 `true`） |
| 客户端规则 | 选择器总在 | 选择器**默认显示**；设置可隐藏，**不改变**运行中或历史会话 |
| 隐藏期间 | — | Host 用**部署默认值**（随附 Web bundle 中为 `standard`）组装未指名会话 |
| 再次显示 | — | 恢复已保存的用户默认值；未保存则用部署默认值，并把该默认值带到当前空白任务 |
| 写入路径 | — | 设置分区经 `settings.update` 写 `agent-presets` 命名空间；随后由 chip controller 的 `agentPresets/select` 把生效默认值带到同一个仍为空白的会话 |
| 交互细节 | — | 隐藏丢弃待处理的暂存选择与本地菜单/失败横幅状态；标题标签保持注册并读取每个会话已记录的 preset；虚线 `cordis` 添加卡在选择器开启前禁用 |
| 失败处理 | — | 保存期间开关禁用；写入失败保留先前偏好并显示错误 |

**判据**：`packages/preset/agent-presets/src/types.ts`（`AgentPresetRoster.modeSelectionEnabled`）、`src/index.ts`（`modeSelectionEnabled: z.boolean()`、`{ base: { default, modeSelectionEnabled: true } }`、`policy.enabled`）、`packages/client/ui-agent-preset/src/client/{settings-store,seat-store,section-store}.ts`、`packages/preset/agent-presets/tests/settings.spec.ts`。

### 6.6 T5：归档会话可恢复（并修正陈旧回复）

| commit | 标题 | 关键内容 |
|---|---|---|
| `5f773a0ded` | `feat(workspace): restore archived sessions from a settings page` | 新客户端包 `packages/client/ui-settings-unarchive-sessions/`（设置页归档会话分区）+ Host 侧 `unarchiveSession`；75 文件，+1620/−49 |
| `76941d0085` | `fix(workspace): keep the newest archive set from stale replies` | 陈旧回复不再覆盖较新的归档集合 |
| `ae34320a5b` | `test(web): expect the unarchive verb and the archived-sessions nav row` | e2e 断言 |

```typescript
// packages/workspace/workspace/src/index.ts（本版新增）
unarchiveSession(sessionId: SessionId): Promise<void> {
  return this.enqueueOperation(async () => {
    // The chain slot serializes against every other registry write, so this
    // check-then-write pair cannot interleave with a concurrent archive.
    const state = this.requireState()
    if (!state.archivedSessionIds.includes(sessionId)) return
    await this.setState({
      ...state,
      archivedSessionIds: state.archivedSessionIds.filter(id => id !== sessionId),
    })
  })
}
```

**语义**：归档与取消归档都只重写 registry 的全局状态，因此"恢复"就是同一个字段的一次过滤写。取消归档**不做会话存在性探测**——从一个集合里删 id 不可能引入未知引用——而 `archiveSession` 会先校验会话既非 live 也非 persisted 时拒绝；恢复一个**未归档**的 id 会不写而直接解析。持久化域版本仍为 `workspace` v2，`archivedSessionIds` 的旧记录经 schema 默认值解析为空集。`packages/workspace/workspace/README.md` 同步改写："Archiving is one-way" 被替换为"Archive and unarchive enforce different session checks"。

### 6.7 T6：工作区最近更新与手动顺序分离

Agent Note `.agents/notes/implemented/simplification/2026-09-10-derived-workspace-recency.md`。

**问题**（Note 的 `## Problem`）：一个可被活动提升的列表，即使没有拖动也可能与它显示的
时间戳不一致——一个迟到的较旧会话会被提升到已观测到的较新会话之前；重复提交同一份完整列表会保留这个倒置。历史上的侧栏顺序决策让 Manual 与 Last updated 共用一个可编辑顺序，以在切换模式时保住位置；那个权衡不满足按时间浏览。

| 维度 | 历史做法 | 0.1.6-alpha.1 |
|---|---|---|
| 「最近更新」 | 与手动顺序共用可编辑顺序，靠 activity 提升维持位置 | **纯投影**：普通行按 `updatedAt` 降序，会话 id 作并列次序键；分组 / Ungrouped / 扁平视图同一策略 |
| 手动顺序 | 同一份共享顺序 | 只有 Manual 使用**浏览器持久化**的会话显示顺序 |
| 拖动 | 改共享顺序 | 快照所有活跃账号 → 只改浏览器本地账号 → **原子地**切到 Manual |
| 进入 Manual | — | 从当前时间序**冻结**每个活跃账号 |
| 回到「最近更新」 | — | 丢弃手动布局；再次进入 Manual 从当前时间戳重新开始 |
| 空白 New Session | — | 无论哪种基准顺序，它都**排在最前**且不能起拖；首次 prompt 后离开空白状态，Manual 随即保留既有首槽位并允许拖动 |
| 重连 | — | Manual 持久化已观测的空白位置，直到完整基线允许对账；对账保留仍在 Workspace 账号里的成员、移除已离开的、把新成员按最新在前追加到末尾 |
| 持久化键 | — | 存分组、展开与手动位置；活跃账号键被保留时移除持久化的 observed-timestamp 数据 |
| Host 关系 | — | Workspace 成员关系与 Workspace 分组顺序仍由 Host 拥有；分组拖动仍调用 Host 的重排操作 |

**判据**：`8423b270e3`、`d19d23cf86`、`11248ea949 fix(workspace): retain blank manual positions during reconnect`、`4857614be0 fix(workspace): pause current ordering in manual mode`、`3a48b62344 refactor(workspace): derive flat rows only after ordering`、`6e94ee4fb9 test(workspace): pin persisted mode ordering in Web replay`；新快照 `snapshots/web/workspace-recency/`。

### 6.8 T7 / T8：goal 与 plan 的跟随性调整

| 包 | 变化 | 证据 |
|---|---|---|
| `goal/goal-round-driver` | 订阅点 `agent/session-start` → `agent/created`（与 awaited 创建语义对齐，见第 07 篇 T4） | `packages/goal/goal-round-driver/src/index.ts` |
| `goal/command-goal` | `/goal` 声明 `CommandDefinitionId('@deepseek-ai/dsh-command-goal')`；描述首字母大写 | `packages/goal/command-goal/src/index.ts` |
| `goal/goal`、`goal/goal-round-driver`、`goal/tool-goal` | `invariant.ts` / `authority.ts` 加入 `snapshotEvents()` 弃用豁免（技术债登记） | 同上目录 |
| `plan/plan-mode` | 命令身份改为 `brandString<CommandDefinitionId>('@deepseek-ai/dsh-plan-mode')`；依赖从 `dsh-code-runtime` 改为 `dsh-ptc-runtime`，新增 `dsh-brand` | `fff1ed7aa2`、`packages/plan/plan-mode/package.json` |
| `plan/plan-mode` 测试 | `CodeRuntime` → `PtcRuntime`、`CodeRunRequest/Result` → `PtcRunRequest/Result`，并新增 `resolve(request)` 实现 | `packages/plan/plan-mode/tests/plan-mode.spec.ts` |

**plan 文档措辞变化**（`packages/plan/**/README.zh.md`）："默认关闭的 teardown" → "fail-closed teardown"；"缺少用户交互通道…调用都会失败关闭" → "都会以拒绝方式失败"。**行为语义未变**——`exit_plan_mode` 在未激活时仍保持注册，进入/离开只改变提示段；批准仍记录一个静默的待生效退出，由下一个被接受的轮内 pre-step 追加。

### 6.9 T9：无功能性源码变更的包

| 包 | diff 范围 | 结论 |
|---|---|---|
| `packages/settings` | 仅 `README*`、`package.json` 版本号 | **无源码变更**（`packages/settings/*/src` 未出现在 diff 中）；`modeSelectionEnabled` 属于 `packages/preset/agent-presets`，不属于 settings |
| `packages/credentials` | 仅 `README*`、`package.json`；测试 `c433ac7776` 加回 → `ba1e73ddf5` 回滚 | **无功能变更** |
| `packages/guard` | 仅 `README*`、`package.json` 版本号 | **无源码变更** |
| `packages/interaction/{tool-ask-user, user-questions}` | 仅 `README*`、`package.json`；`tool-ask-user` 的 README 把 `ask_user_question` 调用限制由 "Runtime-owned child agents cannot call this tool" 改为 "A live child agent owned by another agent cannot call this tool" | 文档澄清；**`src/` 未变** |
| `packages/interaction/user-approval` | `src/index.ts` +2 行、`src/invariant.ts` +1 行，全是 `snapshotEvents()` / `eventAt()` 的弃用豁免注释 | **无行为变更** |

**关于 `snapshotEvents()` 弃用豁免**：本版多处（`user-approval`、`commands`、`goal-round-driver`、`plan-mode`、`agent-team`、`workflow`、`subagent`、`auto-review`）在既有同步历史读取前加了行内 `oxlint-disable-next-line typescript/no-deprecated -- Existing Session history read; migration deferred.`。这是**技术债登记**，不是行为变化；配套提交 `37abcb74c5 chore(session): permit existing deprecated history reads`、`8f986c8da6 chore(session): scope history reader exemptions to tests`。

### 6.10 T10：CI / 发布流程变更（**非产品运行时**）

> ⚠️ 本小节与前述产品行为**无关**，专门列出以免混淆。

| 项 | 内容 | 证据 |
|---|---|---|
| 决策 | `.github/review-ownership/check-approval.mjs` 用 `workflow_run.path` **精确识别**审查事件工作流；同时要求 `pull_request_review` 运行**成功**、从 `display_title` 解析 PR 号、校验所给 PR 关联，并在评估审批前比较当前 PR head 与受审查 head | Agent Note `.agents/notes/implemented/process/2026-09-10-approval-review-workflow-identity.md`；commit `e7b8ebedaf fix(ci): identify approval review runs by workflow path` |
| 问题 | GitHub 会把 `run-name` 展开写进 `workflow_run.name`；该工作流标题含 PR 号，直接比对静态工作流名会**在刷新审批状态之前**拒绝合法审查事件 | 同 Note 的 `## Problem` |
| 被否决的备选 | 接受名称前缀（显示名不标识工作流文件，别的工作流可用同一标题）；去掉带编号的运行标题（该标题在 GitHub 返回空 `pull_requests` 数组时提供 PR 号） | 同 Note 的 `## Alternatives considered` |
| 测试 | `.github/review-ownership/check-approval.test.mjs` 覆盖带编号的运行名、非法源路径与事件、失败的运行、非法标题、被超越的 head | 同 Note |
| 归属 | 该 Note 属 `process` 类，明确是 **CI/发布流程**决策；它与 `packages/interaction/user-approval`（产品审批缝）**没有**代码或语义关联 | Note 的 Status 与路径 |

**其余 CI 侧变更**（同属流程类）：`9bae613128 ci: add an opt-in canary value to the CI pool failover switches`、`c171a7a9a2 fix(coverage): canonicalize partition locations before the blob merge`、`e46cb49103 fix(ci): derive Windows standby store from workspace volume`。

### 6.11 破坏性与兼容性影响

| 变更 | 影响 | 说明 |
|---|---|---|
| `PermissionSelect` 类型删除 | ⚠️ 高（面向集成方） | 读 `permissions` 投影的消费者必须改为"join 会话 `currentValue` 与进程 `catalog()`" |
| `PermissionPresetService.selectFor(state)` 移除 | ⚠️ 中 | 替换为 `catalog()` 与 `permissions` 投影 |
| `permissionPresets` 新增 typert Remote 出口；配置表禁止 `auto`；投影只含 `currentValue` | ⚠️ 中 | 包出口与依赖变化，组合需挂载转发方（BFF 显式挂载并转发无载荷失效事件）；配置名为 `auto` 的预设会在加载时抛错；客户端不再能从投影里枚举选项 |
| `CommandDefinitionId` 为可选字段；Agent preset picker 默认可见但可关闭 | ⚠️ 低 | 第三方定义可省略身份（省略者不参与基于身份的客户端行为）；关闭 picker 后新建会话用部署默认值组装 |
| `GoalRef` / `plan/mode` / `goal/change` / `approval/*` 事件类型；`SESSION_FORMAT_VERSION` | ✅ 无变化 | 未出现在本版事件类型 diff 中；仍为 3 |

### 6.12 本版新增 / 变更文件清单（治理相关）

**新增**

| 路径 | 说明 |
|---|---|
| `packages/experimental/auto-review/{README*, cordis.patch.yml, package.json, src/index.ts, tests/auto-review.{spec.ts, e2e.ts}, tsconfig.json}` | Auto review 实验层 |
| `packages/client/ui-settings-unarchive-sessions/**` | 设置页归档会话分区（含 `ArchivedSessionsSection.tsx` 与 2 个客户端测试） |
| `snapshots/web/auto-review-denial/{session.v3.jsonl, snapshot.yml, ui.expected.md}`、`snapshots/web/workspace-recency/snapshot.yml` | Auto 拒绝与排序分离的 Web 录制证据 |

**源码级改写**

| 路径 | 规模 | 说明 |
|---|---|---|
| `packages/interaction/permission-presets/src/{index.ts, types.ts, invariant.ts}` | 205 / 37 / 6 行变更 | `catalog` / `registerAuto` / Auto 身份 / `set()` 准入；目录与选择拆分 + `catalog-changed` 事件；配合新投影 |
| `packages/interaction/permission-presets/package.json` | 18 行变更 | 新增 `./typert`、`./remote` 出口与 `dsh-typert-protocol` 依赖 |
| `packages/interaction/commands/src/{brand.ts, index.ts, types.ts}` | 15 / 7 / 4 行 | `CommandDefinitionId` 与 descriptor 保留 |
| `packages/plan/plan-mode/src/index.ts`、`packages/goal/command-goal/src/index.ts` | 各 4 行 | 命令身份；前者还含运行时改名 |
| `packages/workspace/workspace/src/index.ts` | +23 行 | `unarchiveSession` |
| `packages/guard/**/README*`、`packages/credentials/**/README*`、`packages/settings/**/README*` | 仅文档 | 见 6.9 |

### 6.13 可复现的证据命令

```powershell
$r = 'E:\test\rewrite-agently\deepseek-harness'
# T2 读侧拆分 / T3 命令身份 / T4 preset 开关
git -C $r diff dsh-v0.1.5-rc.2..dsh-v0.1.6-alpha.1 -- packages/interaction/permission-presets/src/types.ts
git -C $r show dsh-v0.1.6-alpha.1:packages/interaction/permission-presets/package.json | Select-String 'typert|remote'
git -C $r show dsh-v0.1.6-alpha.1:packages/interaction/commands/src/brand.ts
git -C $r diff dsh-v0.1.5-rc.2..dsh-v0.1.6-alpha.1 -- packages/preset/agent-presets/src packages/client/ui-agent-preset/src
# T5 归档恢复 / T9 哪些包只有文档变化 / T10 那是 CI 而非产品行为
git -C $r diff dsh-v0.1.5-rc.2..dsh-v0.1.6-alpha.1 -- packages/workspace/workspace/src/index.ts
git -C $r diff --stat dsh-v0.1.5-rc.2..dsh-v0.1.6-alpha.1 -- packages/settings packages/credentials packages/guard
git -C $r show --name-status --format='%s' e7b8ebedaf
```

---

*文档生成时间: 2026-09-17*
*数据源: dsh-v0.1.6-alpha.1 (0a15e36e7f) vs dsh-v0.1.5-rc.2 (fb2c4b9e69)*
