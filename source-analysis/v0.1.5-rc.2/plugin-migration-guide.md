# v0.1.5 插件迁移深度指南

> **版本**：v0.1.5-rc.2
> **数据源**：`deepseek-ai/deepseek-harness` 仓库 `dsh-v0.1.5-alpha.1` ~ `dsh-v0.1.5-rc.2`
> **适用对象**：插件开发者、适配器作者、需要深入理解 API 变更的工程人员

---

## 一、Token Meter API 深度分析

### 1.1 架构演进

#### v0.1.0-rc.5 的 Token 计量

v0.1.0-rc.5 的 token 计量是**启发式估算**：

```typescript
// v0.1.0-rc.5（简化）
interface TokenMeter {
  estimateMessage(message: Message): number
  // 仅一个方法，基于固定启发式规则估算 token 数
}
```

启发式规则的特点：
- 不区分模型/路由
- 不区分请求端与响应端
- 不区分 surface 与 history
- 无法处理图像 token 的精确定价

#### v0.1.5-rc.2 的 Token 计量

v0.1.5-rc.2 的 token 计量升级为**结构化测量**：

```typescript
// v0.1.5-rc.2
interface TokenMeter {
  // 保留
  estimateMessage(message: Message): number

  // 新增 — 核心测量 API
  measure(session: Session, requestHeader?: EpochHeader): TokenMeasurement

  // 新增 — 细粒度估算
  estimateContentBlock(block: ContentBlock): number
  estimateToolResult(result: ToolResult): number
}
```

`TokenMeasurement` 的结构化字段：

```typescript
interface TokenMeasurement {
  /** 已消费的事件数量 */
  readonly logRevision: SessionLogOffset
  /** 基线锚点类型：usage（来自上次成功调用的 provider usage）或 estimated（启发式） */
  readonly baseline: TokenMeasurementBaseline
  /** 当前 surface 相对于基线的带符号差值 */
  readonly surfaceDeltaTokens: number
  /** 当前请求+响应总压力（非负） */
  readonly totalTokens: number
  /** Surface 路由定价的请求 token 总数 */
  readonly surfaceTokens: number
  /** Surface 节点（按位置顺序） */
  readonly nodes: readonly TokenSurfaceNode[]
}

interface TokenSurfaceNode {
  /** 表面事件的 seq 号 */
  readonly seq: SessionSeq
  /** 路由定价的 token 数（含图像视觉 token） */
  readonly tokens: number
  /** 固定启发式的 token 数（与路由无关） */
  readonly heuristicTokens: number
}
```

### 1.2 定价模型详解

v0.1.5 的 token 定价支持**两种精度**：

| 定价方式 | 来源 | 精度 | 适用场景 |
|---------|------|------|---------|
| 路由定价 | 适配器声明的 `imageRequestPricing()` | 精确 | 图像内容 |
| 启发式定价 | 固定规则估算 | 近似 | 文本内容 |

**定价算法流程**：

```
1. 读取 session 的 durable tail
2. 根据有效请求头确定路由的 provider/model
3. 对每个 surface node：
   a. 如果是图像块 → 使用路由声明的视觉 token 定价
   b. 如果是文本块 → 使用固定启发式定价
4. 比较上次成功调用的 provider usage 作为 baseline
5. 计算 surfaceDeltaTokens = 当前 surface − baseline
```

**基线类型**：

- `baseline.kind === 'usage'`：上次成功调用的 provider usage 可复用
- `baseline.kind === 'estimated'`：无可用 baseline，需要对完整 envelope 重新定价

### 1.3 插件适配场景

#### 场景 1：计费插件

```typescript
// 使用 measure() 获取精确 token 消耗
function trackTokenCost(session: Session) {
  const measurement = ctx.tokenMeter.measure(session)
  
  // 按路由定价计费
  const routePricedCost = calculateCost(
    measurement.surfaceTokens,
    measurement.baseline // 获取路由的定价策略
  )
  
  // 可选：使用启发式定价做备用
  const heuristicCost = calculateCost(
    measurement.nodes.reduce((sum, n) => sum + n.heuristicTokens, 0),
    { kind: 'estimated' }
  )
  
  return { routePricedCost, heuristicCost, measurement }
}
```

#### 场景 2：压缩触发插件

```typescript
// 使用 totalTokens 作为压缩触发指标
function shouldCompact(session: Session, threshold: number): boolean {
  const measurement = ctx.tokenMeter.measure(session)
  return measurement.totalTokens >= threshold
}
```

#### 场景 3：缓存失效检测

```typescript
// 使用 surfaceDeltaTokens 检测 surface 变化
function isCacheInvalidated(session: Session, prevMeasurement: TokenMeasurement): boolean {
  const currMeasurement = ctx.tokenMeter.measure(session)
  // deltaTokens 超过阈值表示 surface 显著变化
  return Math.abs(currMeasurement.surfaceDeltaTokens) > 1000
}
```

---

## 二、Permission Presets 深度分析

### 2.1 架构演进

#### v0.1.0-rc.5 ~ v0.1.2 的权限模型

旧模型是**两个独立的 knob**：

```typescript
// 旧模型 — 两个独立 knob
interface SandboxModeService {
  setSandboxMode(session: Session, mode: SandboxMode): void
  getSandboxMode(session: Session): SandboxMode
}

interface ApprovalPolicyService {
  setApprovalPolicy(session: Session, policy: ApprovalPolicy): void
  getApprovalPolicy(session: Session): ApprovalPolicy
}
```

问题：
- 两个 knob 需要**分别设置**，不一致导致安全风险
- 无法做**预设切换**（用户一次操作需要写两个值）
- `custom` 状态（未匹配预设的组合）无法向用户展示

#### v0.1.3 引入 Permission Presets

v0.1.3 引入了统一预设层：

```typescript
interface PermissionPresetService {
  // 预设表解析
  resolve(name: string): PresetSpec
  
  // 构建客户端选项
  optionOf(name: string): PresetOption
  
  // 切换预设
  set(session: Session, name: string): void
  
  // 查询当前预设
  current(session: Session): string
  
  // 构建选择选项
  selectFor(state: KnobState): PermissionSelect
}
```

#### v0.1.5 的加固

v0.1.5 在 v0.1.3 基础上做了以下加固：

1. **`custom` 状态保护**：`custom` 为保留字，`resolve('custom')` 抛出异常
2. **一致性校验**：`set()` 只写入值变化的 knob，避免冗余事件
3. **投影折叠**：`permissions` 投影折叠 `permission/preset` + `sandbox/mode` + `approval/policy` 三个事件
4. **冷恢复支持**：投影包含 `session/end-seed` 边界，冷恢复后可正确重建

### 2.2 事件序列

预设切换的事件序列：

```
1. permission/preset    ← 用户意图（log-only，不出现在模型 transcript）
2. sandbox/mode         ← 底层 knob 更新（如果值变化了）
3. approval/policy      ← 底层 knob 更新（如果值变化了）
```

**关键点**：`permission/preset` 是 log-only 的用户意图记录。它不出现在模型 transcript 中，只用于 `current()` 恢复用户的预设选择。

### 2.3 插件适配场景

#### 场景 1：预设感知插件

```typescript
// 根据当前预设调整行为
function getPresetAwareBehavior(session: Session) {
  const preset = ctx.permissionPresets.current(session)
  
  switch (preset) {
    case 'workspace-write':
      // 需要审批的模式，走审批流程
      return { mode: 'with-approval' }
    case 'danger-full-access':
      // 无审批模式，直接执行
      return { mode: 'bypass-approval' }
    case 'custom':
      // 自定义组合，需要精确判断
      return { mode: 'inspect-each-knob' }
  }
}
```

#### 场景 2：预设变更监听

```typescript
// 监听预设变更事件
ctx.on('permission/preset', (event) => {
  const { preset } = event.data
  console.log(`预设切换: ${preset}`)
  
  // 重新评估插件行为
  updatePluginBehavior(preset)
})
```

#### 场景 3：自定义预设注册

```typescript
// 在插件配置中注册自定义预设
interface PluginConfig {
  presets?: {
    'read-only-strict': PresetSpec  // 只读 + 全部审批
    'sandbox-safe': PresetSpec      // workspace-write + never（仅安全操作）
  }
}

// PresetSpec 声明
interface PresetSpec {
  sandbox: SandboxMode       // 'read-only' | 'workspace-write' | 'danger-full-access'
  approval: ApprovalPolicy   // 'ask' | 'auto-approve' | 'never'
  name?: string
  description?: string
}
```

---

## 三、Inbox 投影重构深度分析

### 3.1 架构变更对比

#### v0.1.4 及更早

```
┌──────────────────────────────────────┐
│           Host Context               │
│                                      │
│  ┌─────────────┐    ┌──────────────┐ │
│  │ InboxService │───→│ 消息数组     │ │
│  └─────────────┘    └──────────────┘ │
│                                      │
│  ctx.inbox.getItems()  ← 直接访问    │
│  ctx.inbox.enqueue()   ← 直接修改    │
└──────────────────────────────────────┘
```

问题：
- `InboxService` 是独立服务，与 agent-loop 解耦过度
- 消息状态不是 session 日志的投影，无法回放
- 多线程/多代理场景下存在竞态

#### v0.1.5

```
┌──────────────────────────────────────┐
│           Agent Loop                  │
│                                      │
│  ┌─────────────┐    ┌──────────────┐ │
│  │ agent-loop   │───→│ InboxState   │ │
│  │ 投影系统      │    │ (投影视图)    │ │
│  └─────────────┘    └──────────────┘ │
│                                      │
│  Agent.inbox.items  ← 只读投影       │
│  Agent.inbox.onChange()  ← 订阅      │
│  session.append()     ← 消息入队     │
└──────────────────────────────────────┘
```

关键变化：
1. **InboxState 是只读投影**：由 agent-loop 基于 session 日志派生
2. **消息入队走 session 事件**：不再直接操作 inbox
3. **可回放**：inbox 状态可以从 session 日志重建

### 3.2 事件类型

| 事件类型 | 生产者 | 消费者 | 说明 |
|---------|--------|--------|------|
| `agent/inbox/spliced` | session.append() | InboxState 投影 | 消息插入/移除 |
| `agent/inbox/processed` | agent-loop | 外部监听器 | 消息被处理 |

### 3.3 插件迁移代码示例

#### 场景 1：UI 插件 — 显示待处理消息

```typescript
// v0.1.5 新写法
import type { Agent, InboxState } from '@deepseek-ai/dsh-agent'

function MyInboxPlugin(ctx: Context) {
  const agent = ctx.get('agent') as Agent
  
  // 读取待处理消息
  const items = agent.inbox.items
  
  // 订阅变化
  const unsub = agent.inbox.onChange(() => {
    renderInbox(agent.inbox.items)
  })
  
  ctx.effect(() => unsub)
}
```

#### 场景 2：自动化插件 — 入队任务

```typescript
// 旧写法（v0.1.4 及更早）
ctx.inbox.enqueue({ text: 'Run tests', source: 'automation' })

// 新写法（v0.1.5）
session.append({
  type: 'user/message',
  data: {
    content: [{ type: 'text', text: 'Run tests' }],
    source: { kind: 'plugin', form: 'instructions' },
    surfaceOp: { op: 'append' }
  }
})
```

#### 场景 3：Hook 插件 — 拦截入队消息

```typescript
// 监听 agent/inbox/spliced 事件
ctx.on('agent/inbox/spliced', (event) => {
  const { inserted, removed, kind } = event.data
  
  // 新插入的消息
  for (const item of inserted) {
    if (isSensitive(item.text)) {
      // 拦截敏感消息
      blockMessage(item.id)
    }
  }
})
```

---

## 四、LLM Adapter 深度分析

### 4.1 适配器方法扩展

#### v0.1.0-rc.5 的 LlmAdapter

```typescript
abstract class LlmAdapter {
  abstract stream(options: GenerateOptions): AsyncIterable<StreamChunk>
  abstract resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo>
  abstract listModels(provider: string): Promise<readonly LlmModelInfo[]>
  // 共 3 个方法
}
```

#### v0.1.5-rc.2 的 LlmAdapter

```typescript
abstract class LlmAdapter {
  // 保留
  abstract stream(options: GenerateOptions): AsyncIterable<StreamChunk>
  abstract resolveModel(provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo>
  abstract listModels(provider: string): Promise<readonly LlmModelInfo[]>
  
  // 新增（都有默认实现）
  providerInfo(provider: string): LlmProviderInfo { ... }
  providerRetryPolicy(provider: string): ResolvedRetryPolicy | undefined { ... }
  imageRequestPricing(provider: string, model: string): LlmImageRequestPricing | undefined { ... }
  prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<PreparedAdapterCall> { ... }
  // 共 7 个方法
}
```

### 4.2 PreparedCall — HMR 安全

这是 v0.1.5 最关键的适配器变更。

**问题**：在 HMR（热模块替换）期间，适配器实例被替换。如果旧实例正在流式传输新请求可能发送到新实例，导致数据损坏。

**解决方案**：`prepareCall()` 将模型解析和流式分发绑定到同一注册世代。

```typescript
// 内部实现逻辑（简化）
async prepareCall(provider: string, model: string, signal?: AbortSignal) {
  // 1. 获取当前适配器实例的世代标记
  const generation = this.currentGeneration
  
  // 2. 解析模型（使用当前世代的配置）
  const modelConfig = await this.resolveModelInternal(provider, model)
  
  // 3. 绑定到当前世代
  return {
    readonly adapter: this,            // 当前世代
    readonly modelConfig,              // 已解析的配置
    execute(signal: AbortSignal) {     // 一次性执行
      // 验证世代未变
      if (this.currentGeneration !== generation) {
        throw new Error('HMR: adapter generation changed')
      }
      return this.streamInternal({ ...modelConfig, signal })
    }
  }
}
```

### 4.3 适配器迁移指南

#### 场景 1：你维护一个 LLM 适配器

**建议的实现顺序**：

1. `providerInfo()` — 最低工作量，提升 UI 体验
2. `providerRetryPolicy()` — 提升可靠性
3. `imageRequestPricing()` — 支持多模态
4. `prepareCall()` — **高优先级**，确保 HMR 安全

```typescript
// 完整适配器示例（v0.1.5）
class MyLlmAdapter extends LlmAdapter {
  private currentGeneration = 0
  
  // 保留原有方法
  async stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    // ... 流式实现
  }
  
  async resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    // ... 模型解析
  }
  
  async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    // ... 模型列表
  }
  
  // 新增方法
  providerInfo(provider: string): LlmProviderInfo {
    return {
      displayName: 'My Provider',
      url: 'https://my-provider.example.com'
    }
  }
  
  providerRetryPolicy(provider: string): ResolvedRetryPolicy | undefined {
    return {
      mode: 'normal',
      maxRetries: 3,
      backoff: { type: 'exponential', initialDelayMs: 500, maxDelayMs: 15000 }
    }
  }
  
  imageRequestPricing(provider: string, model: string): LlmImageRequestPricing | undefined {
    return {
      visualTokensPerImage: 256,
      textTokensPerImage: 0
    }
  }
  
  async prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<PreparedAdapterCall> {
    const generation = this.currentGeneration
    const modelConfig = await this.resolveModelInternal(provider, model)
    
    return {
      readonly adapter: this,
      readonly modelConfig,
      async execute(signal: AbortSignal) {
        if (this.currentGeneration !== generation) {
          throw new Error('HMR safety: adapter generation changed during prepare')
        }
        return this.streamInternal({ ...modelConfig, signal })
      }
    }
  }
}
```

#### 场景 2：你使用 `ReplayEnvelope`

v0.1.5 将 `replayState: unknown` 升级为结构化类型：

```typescript
// v0.1.0-rc.5（旧）
interface AssistantProvenance {
  replayState: unknown  // 任意类型，无法静态分析
}

// v0.1.5-rc.2（新）
interface ReplayEnvelope {
  response: unknown       // 响应级适配器私有元数据
  blocks?: readonly unknown[]  // 逐块元数据（与发出的块数对齐）
}

// 迁移示例
function processReplayState(provenance: AssistantProvenance) {
  // ❌ 旧写法
  const oldState = provenance.replayState as any
  const rawResponse = oldState.response
  
  // ✅ 新写法
  const envelope = provenance.replayState as ReplayEnvelope
  const rawResponse = envelope.response
  const blockMetadata = envelope.blocks  // 按顺序对齐
}
```

---

## 五、Sidebar Slot 深度分析

### 5.1 旧版 vs 新版 Sidebar

#### v0.1.4 及更早

```
┌─────────────────────────────┐
│         Sidebar             │
│  ┌───────────────────────┐  │
│  │ Brand + Navigation    │  │
│  ├───────────────────────┤  │
│  │ Plugin Content Area   │  │ ← 插件自由渲染
│  │ (无 slot 约束)        │  │
│  ├───────────────────────┤  │
│  │ Footer                │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

问题：
- 插件可以任意插入内容，布局不可预测
- 没有统一的几何管理
- 不支持响应式布局（wide/narrow）

#### v0.1.5

```
┌─────────────────────────────┐
│         Sidebar             │
│  sidebar.brand.mark         │ ← slot 1（single）
│  sidebar.brand.name         │ ← slot 2（single）
│  sidebar.workspaces         │ ← slot 3（single）
│  sidebar.settings           │ ← slot 4（single）
│  ─────────────────────────  │ ← 几何分隔线
│  sidebar.footer.action      │ ← slot 5（list，接收 wide: boolean）
└─────────────────────────────┘
```

### 5.2 Slot 类型

| 类型 | 行为 | 适用场景 |
|------|------|---------|
| `single` | 只接受一个注册 | 品牌、导航等全局元素 |
| `list` | 接受多个注册 | 页脚操作、插件菜单 |

### 5.3 插件迁移示例

```typescript
// v0.1.5 Sidebar 插件注册

// 注册到 footer action（list 类型）
ctx.slots.inject('sidebar.footer.action', () =>
  ctx.slots.register(
    {
      name: 'sidebar.footer.action',
      key: 'myplugin-action',
      order: 100,
      inject: () => ({}),
    },
    // 接收 wide 参数
    function MyFooterAction({ wide }: { wide: boolean }) {
      return (
        <div className={wide ? 'footer-wide' : 'footer-compact'}>
          <MyActionComponent />
        </div>
      )
    }
  )
)
```

---

## 六、Session V3 深度分析

### 6.1 格式对比

#### V2 格式

```
events:
  - seq: 1, type: 'user/message', surfaceOp: { op: 'append' }
  - seq: 2, type: 'assistant/message', surfaceOp: { op: 'append' }
  - seq: 3, type: 'compaction/summary', ...
```

- 所有消息都是独立的 `surfaceOp: append`
- 系统提示词是第一条普通消息

#### V3 格式

```
events:
  - seq: 0, type: 'user/message', surfaceOp: { op: 'zero' }  ← surface node zero（系统提示词）
  - seq: 1, type: 'user/message', surfaceOp: { op: 'append' }
  - seq: 2, type: 'assistant/message', surfaceOp: { op: 'append' }
  - seq: 3, type: 'compaction/summary', surfaceOp: { op: 'replace', start: 1, end: 1 }
```

关键变化：
1. **surface node zero**：系统提示词不再是普通消息，而是 surface 的零号节点
2. **compaction 替换**：使用 `surfaceOp: { op: 'replace', start, end }` 替换 surface 范围

### 6.2 插件适配

#### 场景 1：读取系统提示词

```typescript
// ❌ 旧写法 — 假设第一条消息是系统提示词
function readSystemPromptV2(events: SessionEvent[]) {
  const first = events.find(e => e.type === 'user/message')
  return first?.data?.content
}

// ✅ 新写法 — 识别 surface node zero
function readSystemPromptV3(events: SessionEvent[]) {
  const zeroNode = events.find(e =>
    e.type === 'user/message' &&
    e.data.surfaceOp?.op === 'zero'
  )
  return zeroNode?.data?.content
}
```

#### 场景 2：兼容 V2/V3

```typescript
// 跨版本兼容
function readSystemPrompt(events: SessionEvent[]) {
  // V3: 找 surface node zero
  const zeroNode = events.find(e =>
    e.type === 'user/message' &&
    e.data.surfaceOp?.op === 'zero'
  )
  if (zeroNode) return zeroNode.data.content
  
  // V2 fallback: 找第一条消息
  const first = events.find(e => e.type === 'user/message')
  return first?.data?.content
}
```

---

## 七、子代理目录深度分析

### 7.1 目录事件机制

v0.1.5 在子代理创建时自动追加 `subagent/catalog` 事件：

```typescript
// subagent/catalog 事件
interface SubagentCatalogEvent {
  type: 'subagent/catalog'
  data: {
    childId: string
    mode: 'one-shot' | 'continuable'
    label?: string
    createdAt: number
  }
}
```

该事件通过 Session 投影折叠为 `SubagentCatalogEntry[]`，供 `listChildren()` / `listDescendants()` 读取。

### 7.2 冷恢复

v0.1.5 的目录持久化到 session 日志中：

```
冷恢复流程：
  1. 加载 session.jsonl
  2. 读取所有 subagent/catalog 事件
  3. 重建 SubagentCatalogEntry[]
  4. 投影为 listChildren() 的可见列表
```

---

## 八、Breaking Changes 汇总

### v0.1.0-rc.5 → v0.1.5-rc.2

| 变更 | 影响级别 | 破坏性 | 迁移必要性 |
|------|---------|--------|-----------|
| `ctx.inbox` → `Agent.inbox` | 🔴 高 | ✅ 是 | 必须 |
| Session V3 surface node | 🟡 中 | ✅ 是 | 仅直接读日志的插件 |
| Permission Presets 统一 | 🟡 中 | ⚠️ 部分 | 仅直接调用底层 API 的插件 |
| Token Meter 扩展 | 🟢 低 | ❌ 否 | 可选 |
| LLM Adapter 扩展 | 🟢 低 | ❌ 否 | 可选 |
| Sidebar Slot 重写 | 🟡 中 | ✅ 是 | 仅 Sidebar 插件 |
| JobRegistry 抽象化 | 🟡 中 | ✅ 是 | 仅直接实例化的插件 |

---

## 九、延伸阅读

**官方权威来源**：

- [subsystems/permission-presets.md](../deepseek-harness/docs/subsystems/permission-presets.md) — 权限预设完整契约
- [subsystems/token-meter.md](../deepseek-harness/docs/subsystems/token-meter.md) — Token Meter 服务定义
- [source-analysis/v0.1.5-rc.2/02-core-product.md](02-core-product.md) — 核心产品（含 InboxState）
- [source-analysis/v0.1.5-rc.2/04-llm-typer.md](04-llm-typer.md) — LLM 适配器与 Typert
- [source-analysis/v0.1.5-rc.2/07-multi-agent.md](07-multi-agent.md) — 多智能体（子代理目录）
- [source-analysis/v0.1.5-rc.2/10-gui-frontend-backend.md](10-gui-frontend-backend.md) — GUI 前后端（Sidebar）
- [source-analysis/v0.1.5-rc.1/changelog-alpha1-rc1.md](changelog-alpha1-rc1.md) — Alpha.1→RC.1 变更
- [source-analysis/v0.1.5-rc.2/changelog-rc1-rc2.md](changelog-rc1-rc2.md) — RC.1→RC.2 变更

**决策记录**：

- `.agents/notes/implemented/feature/2026-07-06-sandbox.md` — 沙箱切换设计
- `.agents/notes/implemented/architecture/2026-06-13-capability-seams.md` — 能力缝架构

---

*文档生成时间：2026-09-11*
*数据源：`deepseek-ai/deepseek-harness` 仓库标签 `dsh-v0.1.5-alpha.1` ~ `dsh-v0.1.5-rc.2`*
