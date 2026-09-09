# DeepSeek Harness 0.1.1 → 0.1.5 完整变更记录

> 数据源：从 https://github.com/deepseek-ai/deepseek-harness 拉取，对比标签提交。
> 总提交数：~2088 个非合并提交（0.1.1→0.1.3 约 1708 个，0.1.3→0.1.5 约 380 个）

---

## 版本节点完整序列

| 标签 | 说明 |
|------|------|
| dsh-v0.1.0-rc.7 | 早期 rc |
| dsh-v0.1.0-rc.8 | 早期 rc |
| dsh-v0.1.1-rc.1 | 初始发布 rc |
| dsh-v0.1.1-rc.2 | 初始发布 rc（本地安装版本） |
| dsh-v0.1.2-alpha.1 ~ alpha.5 | 0.1.2 系列 5 个 alpha |
| dsh-v0.1.2-rc.1 | **与 alpha.5 代码完全相同**，仅版本号变更（冻结标记） |
| dsh-v0.1.3-alpha.1 | 0.1.3 alpha |
| dsh-v0.1.3-alpha.2 | 0.1.3 最后一个 alpha |
| dsh-v0.1.5-alpha.1 | 0.1.5 唯一 alpha（未发 rc） |

> **注意**：0.1.2-rc.1 与 0.1.2-alpha.5 之间只有一个 release 提交（版本号变更），无功能代码变更。

---

## 一、0.1.1-rc.2 → 0.1.2-rc.1（1708 个非 merge 提交）

### 1. Session 格式 V2 + 持久化后端替换（核心架构变更）

| 提交 | 说明 |
|------|------|
| `feat(session)!: embed assistant streams in format v2` | V2 格式嵌入 assistant 流式内容 |
| `feat(session)!: add released format migration` | V2 格式发布迁移管线 |
| `refactor(session-format): introduce streaming migration stages` | 流式迁移阶段 |
| `feat(session): add format migration decoder pipeline` | 迁移解码管线 |
| `refactor(session-persistence)!: handle-based seam with lifecycle-owned write path` | 句柄化持久化管线 |
| `refactor(session-persistence): make format migrations one-to-one` | 一对一迁移 |
| `refactor(session-persistence): share stored read machinery` | 共享读取管线 |
| `refactor(session): remove SQLite persistence backend` | **移除 SQLite 后端**（破坏性） |
| `refactor(session-projection): compare per-step views instead of storing a dedup baseline` | 改用 per-step 视图比对 |
| `feat(session-projection): identity-gated change feed` | 变更流 |
| `feat(session-projection): unit-declared viewKey change token` | viewKey 标识 |

**影响**：旧的 SQLite 持久化被完全替换为 projection/event-sourcing 架构。旧 session 数据通过迁移管线转换。

### 2. Apiproxy → Remote 架构迁移（破坏性变更）

| 提交 | 说明 |
|------|------|
| `refactor(api): remove ApiProxy package` | **旧 apiproxy 包彻底移除** |
| `refactor(apiproxy)!: remove settings and credentials RPCs` | settings/credentials RPC 移除 |
| `refactor(apiproxy)!: remove directory-picker RPCs` | directory-picker RPC 移除 |
| `refactor(apiproxy)!: delete the goal unary domain` | goal unary 域移除 |
| `feat(api): serve settings through Remote controllers` | settings 改为 Remote |
| `feat(api): expose remaining domain remotes` | 暴露剩余域 remote |
| `refactor(api): converge the Remote failure vocabulary and client surface` | 统一 Remote 失败词汇 |
| `feat(api-gateway): unify Remote streams and events` | 统一 Remote 流和事件 |
| `refactor(connection): own RPC transport contracts` | RPC 传输合同独立 |
| `refactor(api-session-controller): route subagent calls through Remote` | subagent 调用走 Remote |

### 3. Agent 接口重构

| 提交 | 说明 |
|------|------|
| `Agent` 从 `runtime-types.ts` 移到 `types.ts` | 类型位置变更 |
| `runtime-types` 改用 `declare module` 扩展 Agent | 类型扩展方式变更 |
| `AgentOptions` 新增 `reasoningEffort?: ReasoningEffortId` | 推理力度 |
| `PreStepDecision.enter` 新增 `startsRequestSeries?: true` | 新请求系列 |
| `CallId` → `ToolCallId` 重命名 | 命名变更 |
| `refactor(agent): back Inbox with a durable projection` | Inbox 改用持久化投影 |

### 4. AgentPreset 体系全新建立（从零创建）

| 新类型 | 说明 |
|--------|------|
| `AgentPresetRow` | 预置条目 |
| `AgentPresetRoster` | 预置清单 |
| `AgentPresetDocument` | 预置内容文档 |
| `AgentPresetErrorDetailsMap` | 错误类型 (not-found/invalid/read-only/locked) |
| `PresetTrust` | 信任类型 (`system` \| `user`) |
| Session 投影新增 `agentPreset` 状态字段 | 当前预置选择 |

### 5. PluginInventory 结构扩展

| 变更 | 说明 |
|------|------|
| `PluginInventorySnapshot` 新增 `agentPresets` 字段 | 按预设分组 |
| `PresetPluginEnablement` (boolean \| 'conditional') | 有效启用状态 |
| `AgentPresetPluginRow` | 预设插件行 |
| `AgentPresetPluginGroup` | 预设插件组 |
| 插件清单按 scope 分组 + 预设切换器 | UI 重构 |

### 6. Subagent 能力扩展

| 提交 | 说明 |
|------|------|
| `feat(subagent): configure Codex provider models` | 支持 Codex |
| `feat(subagent): configure Claude Code provider models` | 支持 Claude Code |
| `feat(subagent): migrate browser control to Remote` | 浏览器控制迁移到 Remote |
| `feat(subagent): authorize selectable child models` | 可选子模型 |
| `feat(subagent): unify adjacent agent delivery on steer` | 统一相邻代理投递 |
| `feat(subagent): carry model routing through DSH SDK` | SDK 模型路由 |

### 7. Typert 协议扩展

| 新增 | 说明 |
|------|------|
| `agent: TypertLookup<Agent, SessionId>` 映射 | 代理查找 |
| `agent: TypertContext<SessionId>` 映射 | 代理上下文 |
| `TurnBoundaryProjection` 类型 | 轮次/步骤边界投影 |

### 8. Web/UI 重大更新

| 提交 | 说明 |
|------|------|
| `feat(web): show exact per-turn token usage` | 精确每轮 token 用量 |
| `feat(web): clarify Workspace Write Chinese label` | 明确 Workspace Write 中文标签 |
| `feat(web): add connection recovery indicator` | 连接恢复指示器 |
| `feat(web): surface active schedules in session views` | 活跃计划 |
| `feat(web): navigate loaded Chat Turns from a compact rail` | 紧凑导轨导航 |
| `feat(web): list active reminders in the session header` | 头部活跃提醒 |
| `feat(web): polish the input trigger menu presentation` | 输入触发菜单 |
| `feat(web): deepen composer stroke to l2, widen menu radii to 20px` | 深度视觉升级 |
| `feat(web): superellipse corners and hairline elevation strokes` | Superellipse 圆角 |
| `feat(web): require one-shot fetch approval` | 一次性 fetch 审批 |
| `feat(web): settle folder references on pick` | 文件夹引用 |
| `feat(web): add @ mention rows and cut discovery cost` | @ 提及优化 |
| `feat(web): single-build preview page and its acceptance e2e` | 预览页 |
| `feat(ui-conversation): lexical composer replaces the textarea stack` | Lexical 编辑器 |
| `feat(locale): allow external language registration` | 外部语言注册 |
| `refactor(plugin-inventory): settings-row style group headers` | 插件分组 |
| `refactor(plugin-inventory): menu-pill preset switcher` | 预设切换器 |

### 9. 其他重要变更

| 提交 | 说明 |
|------|------|
| `feat(headless): expose web fetch by default` | headless 默认暴露 web fetch |
| `feat(headless): stream reasoning progress to stderr` | headless 推理进度 |
| `refactor(profiles): make module HMR opt-in` | HMR 可选 |
| `feat(profiles): add the ACP application bundle` | ACP 应用包 |
| `feat(sdk): launch TypeScript clients through dsh profiles` | SDK TypeScript 启动 |
| `refactor(preset): bundle the shipped presets inside dsh-agent-presets` | 预置打包 |
| `feat(client): use bounded plugin combo URLs` | 插件组合 URL |
| `refactor(test): reserve snapshots for session recordings` | 快照专用 |
| `refactor(subprocess): derive native owner state` | 原生所有者 |
| `refactor(subprocess): centralize stream settlement` | 流结算集中化 |

---

## 二、0.1.3-alpha.2 → 0.1.5-alpha.1（380 个非 merge 提交）

### 1. Session V3 — 最大架构升级

| 提交 | 说明 |
|------|------|
| `feat(session): add identity V2-to-V3 migration and writer skeleton` | V2→V3 迁移骨架 |
| `feat(session-format): migrate V2 prompts into V3 system surfaces` | V2 提示词 → V3 系统表面节点 |
| `refactor(session): represent the system prompt as surface node zero` | 系统提示词 → surface node zero |
| `feat(agent-loop): append system prompt changes on capable routes` | agent-loop 追加系统提示词 |
| `fix(session): audit every historical content carrier before V3 migration` | 审计历史内容载体 |
| `fix(session): canonicalize V3 envelopes through adjacent migration` | V3 信封规范化 |
| `fix(session-format): admit audited V2 corpus payloads` | 接受审计后的 V2 语料 |
| `fix(session): retain unknown required events for vocabulary validation` | 保留未知必选事件 |

### 2. 侧边栏 & 文件资源系统 — 全新 UI

| 提交 | 说明 |
|------|------|
| `feat(sidebar): add tab navigation, injected information, and fullscreen shell` | **侧边栏完全重写** |
| `feat(sidebar-files): add lazy workspace file tree tabs` | 懒加载文件树 |
| `feat(textpreview): add paged file tabs and retained reader state` | 分页文件预览 |
| `feat(deliverables): open produced files through Sidebar resources` | 产物通过 Sidebar 打开 |
| `feat(dockkit): add reversible docking engine and pointer interactions` | 可逆停靠引擎 |
| `feat(layout): add responsive right column and width concessions` | 响应式右栏 |
| `feat(client): replace stats strip with two icon pills and stat dialogs` | Stats 条 → icon pills |
| `feat(client): portal composer menus over the sidebar` | 编辑器菜单 portal |

### 3. Electron 桌面打包

| 提交 | 说明 |
|------|------|
| `feat: electron 打包` | Electron 实现 |
| `feat: windows build & sign` | Windows 构建签名 |
| `feat: mac code sign & notarize` | Mac 签名公证 |
| `feat: optimize ipc perf` | IPC 性能优化 |
| `feat(desktop): update packaging and auto-update paths` | 自动更新路径 |
| `feat(desktop): enhance auto-update configuration` | 增强自动更新 |

### 4. Inbox 投影重构

| 提交 | 说明 |
|------|------|
| `refactor(agent): back Inbox with a durable projection` | Inbox → 持久化投影 |
| `refactor(agent): remove inbox service` | 移除旧 inbox service |
| `refactor(agent-loop): own inbox projection in loop` | inbox 投影归 agent-loop |
| `fix(session-controller): derive queues from projections` | 队列派生自投影 |
| `fix(agent): validate durable inbox reconstruction` | 验证 inbox 重建 |

### 5. Native 系统层

| 提交 | 说明 |
|------|------|
| `feat(native): add prebuilt Node-API flock support` | 预构建 Node-API flock |
| `refactor(native): rename package family to node-addon-system` | 包族重命名 |
| `refactor(native): move Landlock workspace to native/system` | Landwork 迁移 |
| `refactor(native): expose Landlock through capability subpath` | 暴露 Landlock |

### 6. 其他功能

| 提交 | 说明 |
|------|------|
| `feat(cli): create profiles from shipped templates` | 从内置模板创建 profile |
| `feat(skills): record browser GIFs with Playwright video` | Skills 浏览器 GIF |
| `feat(web): localize slash command descriptions` | 斜杠命令本地化 |
| `fix(web): strip bold markers from think summaries` | Think 摘要粗体清理 |
| `feat(agent): announce model switches` | 模型切换通知 |
| `feat(agent): emit live assistant stream frames` | 助手流帧 |

---

## 完整版本变更矩阵

| 维度 | 0.1.1-rc.2 | 0.1.2-rc.1 | 0.1.3-alpha.2 | 0.1.5-alpha.1 |
|------|-----------|-----------|--------------|--------------|
| Session 格式 | V1 (SQLite) | V2 (projection) | V2+ | V3 (surface node) |
| 持久化 | SQLite | handle-based | handle-based | V3 writer |
| Client 架构 | 单体状态机 | 控制器分离 | 控制器+Sidebar | 控制器+完整Sidebar |
| API | Apiproxy RPC | Remote | Remote | Remote |
| 子代理 | 基础 | Codex/Claude | 模型路由 | Inbox 投影 |
| Native | 基础子进程 | 原生隔离 | 子进程完善 | Node-API flock |
| 桌面 | 无 | 无 | 无 | Electron+签名+自动更新 |
| UI | 基础聊天 | 视觉升级 | 视觉升级 | Sidebar+文件树+停靠 |

---

## 插件升级路径总结

### 0.1.1-rc.2 → 0.1.2-rc.1（破坏性变更）

| 变更项 | 0.1.1-rc.2 | 0.1.2-rc.1 | 影响 |
|--------|-----------|-----------|------|
| API 调用 | Apiproxy RPC | Remote | **必须迁移所有 RPC 调用** |
| Agent 类型 | `runtime-types.ts` | `types.ts` + declare module | 导入路径变更 |
| SessionId | runtime-types 导入 | session/types 导入 | 导入路径变更 |
| AgentOptions | 无 reasoningEffort | 新增 `reasoningEffort` | 可选字段，向后兼容 |
| Preset 系统 | 无独立类型 | 全新 AgentPreset | 如使用预置需适配 |
| Session 格式 | V1 + SQLite | V2 + handle | **旧 session 需迁移** |
| CallId | `CallId` | `ToolCallId` | 需全局替换 |

### 0.1.2-rc.1 → 0.1.5-alpha.1（破坏性变更）

| 变更项 | 0.1.2-rc.1 | 0.1.5-alpha.1 | 影响 |
|--------|-----------|--------------|------|
| Session 格式 | V2 | V3 (surface node) | **会话数据需迁移** |
| 系统提示词 | 普通消息 | surface node zero | API 变更 |
| Agent 类型 | 独立接口 | 投影驱动 | 类型变更 |
| Client | 无 Sidebar | 完整 Sidebar+Dockkit | 依赖注入变更 |

---

## 三、0.1.2-rc.1 → 0.1.5 关键特性升级指南

### 1. Thinking Level（推理力度 / 推理层级）

| 维度 | 0.1.2-rc.1 | 0.1.5-alpha.1 |
|------|-----------|--------------|
| 类型 | `ReasoningEffortId`（agent-loop 配置层） | 继承不变，但扩展了 provider 级映射 |
| 位置 | `AgentOptions.reasoningEffort?: ReasoningEffortId` | 同上 + `ProviderThinkingLevel`（pi-ai adapter 新增） |
| 配置方式 | YAML: `reasoningEffort: high` | 同上，但 pi-ai provider 支持 `thinkingLevelMap` 将 level → provider-specific effort |
| Provider 层 | 无 ThinkingLevel 概念 | pi-ai adapter 新增 `providerThinkingLevel` 字段，在 replay/adapter 中保留 |

**升级要点**：
- 如果你使用默认 deepseek provider，配置方式不变（`reasoningEffort: high`）
- 如果你使用 pi-ai（Anthropic 后端），现在需要处理 `providerThinkingLevel` 字段的持久化与 replay 兼容
- pi-ai catalog 中的 `thinkingLevelMap` 将标准 level（`low`/`high`/`max`）映射到具体 provider effort 值

```yaml
# 配置不变
agents:
  - id: 'main'
    provider: deepseek
    model: deepseek-chat
    reasoningEffort: high  # 依然有效
```

---

### 2. 权限（Permission Presets / 沙箱 + 审批）

| 维度 | 0.1.2-rc.1 | 0.1.5-alpha.1 |
|------|-----------|--------------|
| 包名 | `dsh-sandbox` + `dsh-user-approval` 独立 | 新增 `dsh-permission-presets` 统一服务 |
| 控制方式 | 分别设置 sandbox mode 和 approval policy | 通过 preset 统一切换（sandbox + approval 打包） |
| 持久化 | 各自独立的事件 | 新增 `permission/preset` 事件 + `permissions` session projection |
| UI 命令 | 无统一命令 | `/permission <preset>` 命令 |
| 预设 | 无 | 内置 `workspace-write`（写+审批）和 `danger-full-access`（无审批） |

**升级要点**：
- **破坏性**：旧的两路控制被 `PermissionPresetService` 接管。如果你的插件直接调用 `setSandboxMode`/`setApprovalPolicy`，需要改为使用 `permissionPresets.set(session, name)`
- 新增 `permissions` session projection（`stateVersion: 2`），包含 `preset`/`sandbox`/`approval`/`seeded` 字段
- `CUSTOM_PRESET`（`'custom'`）保留，用于表示当前配置不匹配任何预设
- preset 选择通过 `permission/preset` 事件持久化，与实际的 sandbox/approval 变更事件分开记录
- 新增配置验证：如果配置的 `defaultPreset` 不匹配实际组合的 sandbox+approval，构造函数会抛错

```typescript
// 旧方式（不再推荐）
setSandboxMode(session, 'workspace-write')
setApprovalPolicy(session, 'ask')

// 新方式（推荐）
ctx.permissionPresets.set(session, 'workspace-write')  // 自动写入 sandbox + approval
```

---

### 3. 记忆（Memory / Session 投影）

| 维度 | 0.1.2-rc.1 | 0.1.5-alpha.1 |
|------|-----------|--------------|
| Session 格式 | V2（projection-based） | V3（surface node + surface op） |
| 持久化 | handle-based projection | V3 writer + surface node migration |
| 系统提示词 | 独立消息 | Surface node zero |
| 投影 | Inbox 投影（独立服务） | Inbox 投影归入 agent-loop，直接驱动 |
| 历史数据 | V1→V2 迁移管线 | V2→V3 迁移管线 |

**升级要点**：
- **破坏性**：Session V3 格式引入 surface node 概念。任何读取 session 数据的旧代码都需要通过 V2→V3 迁移管线转换
- 系统提示词不再是普通消息，而是 `surface node zero`。依赖系统提示词消息语义的代码需要适配
- Inbox 从独立的 `InboxService` 改为 `agent-loop` 内部的投影驱动。旧 `ctx.inbox` 服务路径不可用
- 新增 `compaction` 能力（`packages/compaction`），支持将历史消息压缩为摘要并重建
- 旧的 V1 session（SQLite）需要先经过 V1→V2 迁移再经过 V2→V3 迁移，不能直接跳到 V3

---

### 4. 会话冻结（Request Freeze / Message Immutability）

| 维度 | 0.1.2-rc.1 | 0.1.5-alpha.1 |
|------|-----------|--------------|
| 机制 | 每次请求时 `deepFreeze` 全部历史消息 | WeakSet provenance 缓存——已冻结的消息跳过遍历 |
| 包 | `agent-loop` 内嵌 | 同包，新增 `request-freeze.spec.ts`（234 行测试） |
| 性能 | 长历史会话中 `buildRequest` 占 132.9ms / 211.3ms | 优化后降至 ~67ms / ~185ms（M4 参考测量） |
| 边界条件 | 浅层冻结无法证明后代不可变 | WeakSet 仅记录完全冻结成功的消息身份 |

**升级要点**：
- 这不是用户侧配置项，而是 agent-loop 内部性能优化
- 如果你自定义了 `Agent` 实现，注意 `ReactLoopAgent` 现在拥有私有的 `WeakSet<Message>` 来缓存冻结证明
- 旧代码中 `deepFreeze` 遍历不可跳过的假设在此版本中被打破——相同 message id 不再意味着对象身份相同
- 对 compaction 场景：compaction 替换的消息失去旧的 freeze provenance，fresh loop 会重新证明
- 新的性能预算：CI 上 request-history 预算为 238ms（190ms median × 1.25 headroom）

---

### 5. Input Traffic（输入流量 / Token Meter）

| 维度 | 0.1.2-rc.1 | 0.1.5-alpha.1 |
|------|-----------|--------------|
| Token 用量 | `web` 展示每轮 token 用量 | `token-meter` 包：header breakdown + cache 分类 + compaction 幸存分类 |
| 计量精度 | 概览 | `fix(token-meter): anchor usage after admitted prompt inputs` — 精确到 prompt 准入后锚点 |
| Cache 区分 | 无 | `fix(token-meter): distinguish compact caches from parent scalar version` |
| Surface 分类 | 无 | `fix(token-meter): classify surviving prompts in surface order` |

**升级要点**：
- `token-meter` 包新增复杂的缓存分类逻辑。如果你的自定义 agent-loop 消费 token 数据，需要适配新的分类
- Compaction 后的 prompt 分类规则变更：幸存 prompt 按 surface order 分类
- `agent/request` 准入（admit）后 token meter 的锚定点发生变化
- 如果你使用了 `inferglow-github/webui/src/plugin/input-traffic` 插件，它是独立于 core 的第三方插件，不在 DSH 发行版中

> 注意：`input traffic` 在 DSH core 中没有独立包，实际对应的是 `token-meter` 计量系统。用户侧通过 Web UI 的 icon pills 和 stat dialogs 查看（`dsh-v0.1.3` 引入的 `replace the stats strip with two icon pills`）。

---

*文档生成时间：2026-09-09*

## 四、侧边栏（Sidebar）与消息轨（Turn Navigator）深度分析

> 数据来源：`packages/client/ui-sidebar/`、`packages/client/ui-chat/`、`packages/client/ui-conversation/`

### 1. 侧边栏完整功能清单

| 组件 | 功能 | 实现细节 |
|------|------|----------|
| Brand Mark | 品牌标志，展开/收起双位置显示 | `sidebar.brand.mark` slot，fish logo 兜底 |
| Brand Name | 品牌名称（本地构建版本号+dirty标记） | `sidebar.brand.name` slot |
| New Session | 带 workspace 优先链的 New Session | workspace→current→recent→blank 四级回退 |
| 折叠动画 | 150ms 滑动+淡出 | 展开内容冻结宽度→fade out→rail 淡入滑动，静态折叠无闪烁 |
| 安静滚动条 | 指针离开后保留 2s | pointermove 跟踪 + linger timer |
| Sidebar Section | 会话/Workspace 浏览 | `sidebar.workspaces` slot（由 ui-workspace 填充） |
| Settings | 底部固定设置入口 | `sidebar.settings` slot（由 ui-settings 填充） |
| Footer Actions | 页脚额外操作位 | `sidebar.footer.action` list slot，支持多个条目 |

**Slot 契约**：`packages/client/ui-sidebar/src/client/contract/slots.ts`

```typescript
// 5 个 slot，全部 scope='root', kind 为 single 或 list
'sidebar.brand.mark'         → single
'sidebar.brand.name'         → single
'sidebar.workspaces'         → single
'sidebar.settings'           → single
'sidebar.footer.action'      → list (每个 action 接收 wide: boolean)
```

**关键约束**：
- 外壳只管理几何（折叠状态机、品牌行、New Session）
- 数据内容由填充 slot 的插件自行管理（如 ui-workspace 持有会话列表、排序、搜索）
- 可替换品牌但无法替换导航控件
- Props 只有 `wide: boolean` + `expandSidebar()` 穿过外壳边界

---

### 2. 消息轨与侧边栏的关系

**完全独立。** 消息轨（TurnNavigator）是 ChatView 的内部组件，侧边栏是 `ui-sidebar` 包，两者不在同一渲染树中。

```
AppFrame (layout grid)
  ├─ Sidebar (56px rail / full column)
  │   ├─ Brand Mark + Toggle Button
  │   ├─ New Session Button
  │   ├─ Workspaces Browser (slot)
  │   ├─ Footer Actions (slot)
  │   └─ Settings (slot)
  └─ Conversation Column
      └─ ConversationRoot (data-conversation-scroll)
          ├─ Session Header (slot)
          ├─ Session Body (slot)
          │   └─ ChatView (conversation.view = 'chat')
          │       ├─ TurnNavigator       ← 消息轨（独立组件）
          │       ├─ ChatNodeList        ← 消息节点
          │       └─ ToBottomButton
          └─ ComposerStack
              └─ InputBar
```

消息轨数据：
```
railItems = mergeTurnRailItems(
  loaded: ChatSnapshot.navigation.items(),     // 当前窗口 Turn
  outline: useProjection('turnOutline')        // 完整日志 Turn 大纲
)
```

---

### 3. 消息轨插件化路径分析

**当前问题：消息轨硬编码在 ChatView 中，无 slot 暴露。**

```tsx
// ChatView.tsx 第 763 行 — 直接内联
<TurnNavigator
  items={railItems}
  activeTurn={activeTurn}
  busyTurn={busyJumpTurn}
  onNavigate={navigateToTurn}
  t={t}
/>
```

**三条可选路径**：

| 路径 | 做法 | 侵入性 | 可行度 |
|------|------|--------|--------|
| A: 新 View Tab | 注册 `conversation.view` 新 Tab，实现独立 rail | 低（不碰 ChatView） | 高 — 但和 Chat 内容不联动 |
| B: 扩展 ChatSnapshot | 在 `ConversationViewSnapshotMap` 注册新 snapshot 类型 | 中（改契约） | 中 — 数据流清晰 |
| C: 新增 slot | 在 ChatView 插入 `conversation.chat.rail` slot | 高（改 ChatView） | 低 — 改动大但最灵活 |

**路径 C 需要改造的部分**：
1. `packages/client/ui-chat/src/client/contract/slots.ts` — 扩展 ChatViewSlotProps
2. `packages/client/ui-chat/src/client/chat/ChatView.tsx` — 条件渲染 + slot 调用
3. `packages/client/ui-chat/src/client/contract/snapshot.ts` — TurnRailOwnerProps
4. 导航回调 `navigateToTurn`（含 `loadThrough` 分页）需要注入给插件

---

### 4. 折叠（Fold）与消息轨的正交关系

折叠和消息轨是**完全独立的两层**，互不感知。

**折叠机制**：`ChatNodeSeat` 内部控制

```
processWindowReady = compactTranscript 
                   && answerAnchorSeq !== null 
                   && turnClosed 
                   && !historyIncomplete

foldable = processWindowReady 
           && (processMember 
               || hasExternalProcess 
               || inlineReasoning)

processHidden = foldable && processMember && !processOpen
```

折叠数据持久化：`ChatStore.turnProcessEntries`，按 `turn + answerStep` 存 `open: boolean`。

**与消息轨的关系**：

| 行为 | 消息轨 (TurnNavigator) | 折叠 (ChatNodeSeat) |
|------|------------------------|---------------------|
| 数据来源 | `ChatSnapshot.navigation` + `turnOutline` | `ChatNode` + `ChatTurnProcessPresentation` |
| Turn 可见性 | 所有 Turn 都在轨上 | 取决于 compactTranscript 和 process 范围 |
| 状态存储 | 无（纯视图层） | `ChatStore` 持久化 |
| 交互 | 点击跳转到 Turn | 点击展开/收起 process |
| 联动 | **无联动** | **无联动** |

消息轨的 `activeTurn` 通过 `turnAtLine()` 实时计算（读取可视区域中行所在的 Turn 号），与折叠无关。

---

### 5. "默认不引入消息轨 + flag 切换"设计

你的想法在当前 DSH 架构中的可行性分析：

**现有状态**：
- 无 flag、无 slot、无条件渲染
- `TurnNavigator` 始终渲染（当 items.length < 2 时返回 null）
- `compactTranscript` 是 transcript view 模式，不是 rail 开关

**改造方案**：

```tsx
// ChatView.tsx — 条件渲染
const enableTurnRail = props.enableTurnRail !== false;

{enableTurnRail && (
  <TurnNavigator
    items={railItems}
    activeTurn={activeTurn}
    busyTurn={busyJumpTurn}
    onNavigate={navigateToTurn}
    t={t}
  />
)}

// 如果启用了自定义 rail slot，用 slot 替代
{enableTurnRail && renderSlot('conversation.chat.rail', {
  items: railItems,
  activeTurn,
  busyTurn,
  onNavigate: navigateToTurn,
  t,
})}
```

**默认行为**：
- 不传 `enableTurnRail` → `true`（兼容现有行为）
- 传 `enableTurnRail: false` → 无 rail
- 传 `enableTurnRail: true` + 注册 `conversation.chat.rail` slot → 插件 rail 覆盖内置

**需要解决的关键问题**：
1. `navigateToTurn` 回调含 `loadThrough` 分页加载，是 ChatView 闭包，插件 rail 无法直接获取
2. `activeTurn` 和 `busyTurn` 状态由 ChatView 内部控制，插件 rail 需要注入或订阅
3. `ChatViewSlotProps` 需要扩展（在 `InjectFace` 中注入 `navigateToTurn`）
4. 如果插件 rail 想与 Chat 的 compact transcript 折叠模式联动，需要额外传递 `compactTranscript` 状态

**结论**：你的设计方向是正确的，但需要把折叠和 rail 都抽象为 slot，才能保持正交。当前折叠已通过 `ChatNodeSeat` 实现条件渲染（无 slot），rail 需要新增 slot。

---

*文档生成时间：2026-09-09*
