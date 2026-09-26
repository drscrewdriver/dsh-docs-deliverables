# DSH 插件兼容性适配指南

> 适用场景：你的插件需要跨 DSH 版本兼容（0.1.0-rc.7 ~ 0.1.5-alpha.1+）。
> 基于 `dsh-tidychat` 实际适配经验 + 各版本 CHANGELOG 分析整理。

---

## 一、问题背景

DSH 在 **0.1.2-alpha.1 → 0.1.2-alpha.2** 之间对 `dsh-settings` 包做了 breaking change：

| 变更项 | 0.1.0-rc.7 / 0.1.1-rc.x | 0.1.2-alpha.2+ / 0.1.2-rc.1 |
|---|---|---|
| `dsh-settings` 导出的函数 | `installSettingsSection`、`settingsNamespace` | **被移除** |
| 宿主注册 settings 的方式 | 从 `dsh-settings` 导入函数后调用 | `ctx.settings.installSection(owner, ns, schema, entry, hooks)` |

**结果**：0.1.2+ 的 DSH 中，直接 `import { installSettingsSection } from '@deepseek-ai/dsh-settings'` 会报 `Failed to load plugins`，因为导出符号不存在。

---

## 二、核心适配模式：运行时检测 + 双 API 回退

### 2.1 原理

两种注册 API 在所有目标版本（0.1.0-rc.7 ~ 0.1.2-rc.1）中都存在**至少一个**可用路径：

| DSH 版本 | `ctx.settings.installSection` | `ctx.settings.register` |
|---|---|---|
| **0.1.0-rc.7 / 0.1.1-rc.x** | ❌ 不存在 | ✅ 存在 |
| **0.1.2-alpha.2+ / 0.1.2-rc.1** | ✅ 存在 | ✅ 也存在（保留） |

**关键发现**：`register` 方法在**所有目标版本**中都存在，`installSection` 只在 0.1.2+ 出现。因此策略是：

1. **优先** `installSection`（0.1.2+ 的新行为，保持语义一致）
2. **回退** `register`（所有旧版本都能用）
3. **静默跳过**（极端情况，两者都不存在时插件仍不崩溃）

### 2.2 示例代码：settings 注册

#### ❌ 旧写法（仅兼容 0.1.0-rc.7 ~ 0.1.2-rc.1 的早期，0.1.2+ 会报错）

```typescript
// src/index.ts
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from 'schemastery'

export const MY_NS = settingsNamespace('myplugin')

export const Config: z<MyConfig> = z.object({
  enabled: z.boolean().default(true),
})

export function apply(ctx: any): void {
  // 在 0.1.2+ 中，installSettingsSection 不存在 → 模块加载失败
  installSettingsSection(ctx, MY_NS, Config, {}, {
    setSource: () => {},
    onChange: () => {},
  })
}
```

#### ✅ 新写法（兼容所有版本：0.1.0-rc.7 ~ 0.1.2-rc.1）

```typescript
// src/index.ts
import type { Context } from '@deepseek-ai/cordis'
import z from 'schemastery'

// v0.1.3-alpha.1 起 settings 用小写连字符字符串命名空间，
// 不再需要 settingsNamespace() 包装。
export const MY_NS = 'myplugin' as const

export const Config: z<MyConfig> = z.object({
  enabled: z.boolean().default(true),
})

export const inject: string[] = []

export function apply(ctx: Context, config?: MyConfig): void {
  // 通过 cordis inject 拿到宿主的 settings 模块
  ctx.inject(['settings'], (settingsCtx: any) => {
    const settings = settingsCtx.settings

    // 优先使用 0.1.2+ 的新 API
    if (typeof settings?.installSection === 'function') {
      settings.installSection(ctx, MY_NS, Config, config ?? {}, {
        setSource: () => {},
        onChange: () => {},
      })
    }
    // 回退到所有版本都存在的旧 API
    else if (typeof settings?.register === 'function') {
      settings.register(MY_NS, Config, { base: config ?? {} })
    }
    // 静默跳过：极端旧版本无 register，插件仍能加载，只是没有 settings 面板
  })
}
```

### 2.3 行为对比

| 方面 | `installSection`（0.1.2+） | `register`（所有版本） |
|---|---|---|
| 参数签名 | `(owner, ns, schema, entry, hooks)` | `(ns, schema, { base })` |
| 命名空间 | 字符串字面量 `'myplugin'` | 字符串字面量 `'myplugin'` |
| 默认配置 | `entry` 参数传入 | `{ base: entry }` 传入 |
| hooks | `{ setSource, onChange }` | 不适用 |

> **注意**：`register` 不需要 `setSource`/`onChange`，它只传入 `{ base }`。插件实际读取配置走的是浏览器半的 `settingsScope.bind({ namespace })`。

---

## 三、命名空间注册方式的变化

### 3.1 旧版：通过 `settingsNamespace()` 包装

```typescript
// 0.1.0-rc.7 ~ 0.1.1-rc.x 的旧写法
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

export const MY_NS = settingsNamespace('myplugin')
// → MY_NS 是一个 Symbol 或特殊对象，内部编码命名空间字符串
```

### 3.2 新版：直接使用字符串字面量

```typescript
// v0.1.3-alpha.1 起，settings 模块改用字符串命名空间
export const MY_NS = 'myplugin' as const
```

**两者在浏览器半读取时等价**：

```typescript
// 浏览器半（client/index.ts）— 两种写法读取方式不变
const settingsFace = ctx.get('webUiSettings') ?? ctx.get('settingsScope')
const settingsScope = settingsFace?.bind({ namespace: 'myplugin' })
// namespace 传的是原始字符串，新旧 host 半都能正确路由
```

---

## 四、slot 注册兼容

DSH 的 slot 系统在 0.1.0-rc.7 起已由 list 改为 keyed，这一变更在 v0.2.6 中已验证稳定：

### 4.1 settings 面板插件卡片

```typescript
// 注册到 settings.plugin.item keyed 槽（所有目标版本）
ctx.slots.inject('settings.plugin.item', () =>
  ctx.slots.register(
    {
      name: 'settings.plugin.item',
      key: 'myplugin',       // keyed 槽用 key，不用 id
      order: 100,
      inject: () => ({}),
    },
    MySettingsCard,          // React 组件
  ),
)
```

### 4.2 会话头插槽

```typescript
// 注册到 conversation.session.header.utilities（所有目标版本）
ctx.slots.inject('conversation.session.header.utilities', () =>
  ctx.slots.register(
    {
      name: 'conversation.session.header.utilities',
      id: 'myplugin-nav',    // 组件实例 id
      order: 100,
    },
    MyNavComponent,
  ),
)
```

> **注意**：`key` 用于命名空间级分发（settings 面板），`id` 用于组件实例标识。两者不混用。

---

## 五、DOM 锚点兼容

DSH 的 DOM 属性契约在所有目标版本中保持稳定。你的插件应基于**语义属性**定位，而非编译期 hash 类名：

```typescript
// 所有目标版本一致的 DOM 锚点
const CONVERSATION_SCROLL = '[data-conversation-scroll]'    // 滚动容器
const ANCHOR_KEY = '[data-chat-anchor-key]'                  // 消息锚点
const FLOW_KIND = (el: Element) => el.getAttribute('data-chat-flow-kind')
const VARIANT_THINK = '[data-variant="think"]'               // 思考块
const COMPOSER_CARD = '[data-composer-card]'                 // 输入框

// 示例：定位滚动容器
const findScrollContainer = () => document.querySelector('[data-conversation-scroll]')

// 示例：获取会话容器内所有锚点行
const scopedRows = (selector: string): Element[] => {
  const container = findScrollContainer()
  return Array.from((container ?? document).querySelectorAll(selector))
}
```

### 新增的 flow-kind 类型（0.1.2+ 可能出现）

| `data-chat-flow-kind` | 说明 | 处理建议 |
|---|---|---|
| `user` | 用户消息 | 保留，导航锚点 |
| `think` | 思考块（含 `data-variant="think"`） | 折叠 |
| `tool-call` | 工具调用 | 折叠 |
| `assistant-step` | 助手步骤 | 区分有无正文 |
| `turn-tail` | 回合尾部计时 | 提取用时信息 |
| `model-retry` | 已重试模型请求 | **0.1.2+ 新增**，应归入折叠 |
| `context` | 上下文注入 | 折叠或隐藏 |

---

## 六、语义色 Token 兼容

DSH 的语义色 token 在所有目标版本中保持一致：

```css
/* ✅ 使用语义 token，不硬编码颜色 */

/* 正文/辅助文字色 */
color: var(--dsw-alias-label-primary, #222);
color: var(--dsw-alias-label-secondary, #666);
color: var(--dsw-alias-label-tertiary, #999);
color: var(--dsw-alias-label-caption, rgba(127,127,127,0.5));

/* 背景层 */
background: var(--dsw-alias-bg-layer-3, #fff);

/* 边框 */
border-color: var(--dsw-alias-border-l2, rgba(128,128,128,0.3));

/* 品牌/强调色 */
color: var(--dsw-alias-state-business-primary, #3b82f6);
```

> **原则**：所有颜色通过 `var(--dsw-alias-*, fallback)` 引用，不做 `prefers-color-scheme` 或 `body[data-ds-dark-theme]` 硬编码检测。

---

## 七、资源清理（plugin lifecycle）

所有副作用必须在 `ctx.effect` 内登记，插件卸载时自动清理：

```typescript
export function apply(ctx: any): void {
  const disposers: Array<() => void> = []

  // 登记一次性资源
  const track = (dispose: () => void): (() => void) => {
    disposers.push(dispose)
    return () => {
      const i = disposers.indexOf(dispose)
      if (i >= 0) disposers.splice(i, 1)
    }
  }

  // 在插件卸载时统一清理
  ctx.effect(() => () => {
    for (const d of disposers.splice(0)) {
      try { d() } catch { /* ignore */ }
    }
  })

  // 示例：MutationObserver
  const obs = new MutationObserver(callback)
  const disposer = track(() => obs.disconnect())

  // 示例：CSS style 注入（卸载时移除）
  ctx.effect(() => {
    const tag = document.createElement('style')
    tag.textContent = CSS
    document.head.appendChild(tag)
    return () => tag.remove()
  })

  // 示例：MutationObserver 观察主题变化 → 清理时移除
  ctx.effect(() => {
    const themeObs = new MutationObserver(() => { recomputeTheme() })
    themeObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme'],
    })
    return () => {
      themeObs.disconnect()
      // 清理写入 :root 的临时 CSS 变量，不污染宿主
      document.documentElement.style.removeProperty('--myplugin-theme-color')
    }
  })
}
```

---

## 八、默认值调整建议

当你的插件功能可能与 DSH 0.1.2+ 原生功能冲突时，**将冲突功能的默认值改为 `false`**：

```typescript
export const Config: z<MyConfig> = z.object({
  // 如果你的折叠逻辑与 DSH 0.1.2 原生折叠冲突 → 默认 false
  fold: z.boolean().default(false),

  // 如果你的自动加载与 DSH 0.1.2 原生加载冲突 → 默认 false
  autoLoad: z.boolean().default(false),

  // 如果你的导航条与 DSH 0.1.2 原生 TurnNavigator 冲突 → 默认 false
  navigator: z.boolean().default(false),

  // 没有冲突的功能保持默认 true
  highlight: z.boolean().default(true),
})
```

用户仍可在「设置 → 插件配置」面板中手动开启，但首次安装不会与官方功能打架。

---

## 九、完整模板

将以上模式整合为一个可直接复用的模板：

```typescript
// src/index.ts — Host 半
import type { Context } from '@deepseek-ai/cordis'
import z from 'schemastery'

export const PLUGIN_NS = 'myplugin' as const

export interface MyConfig {
  enabled?: boolean
  featureA?: boolean
  featureB?: boolean
}

export const Config: z<MyConfig> = z.object({
  enabled: z.boolean().default(true),
  featureA: z.boolean().default(false),   // 与 0.1.2+ 原生冲突
  featureB: z.boolean().default(true),
})

export const inject: string[] = []

export function apply(ctx: Context, config?: MyConfig): void {
  // ===== Settings 注册：运行时检测 API =====
  ctx.inject(['settings'], (settingsCtx: any) => {
    const settings = settingsCtx.settings
    if (typeof settings?.installSection === 'function') {
      settings.installSection(ctx, PLUGIN_NS, Config, config ?? {}, {
        setSource: () => {},
        onChange: () => {},
      })
    } else if (typeof settings?.register === 'function') {
      settings.register(PLUGIN_NS, Config, { base: config ?? {} })
    }
  })
}
```

```typescript
// src/client/index.ts — Browser 半
import * as React from 'react'

export const inject = ['slots', 'sessions'] as const

export function apply(ctx: any): void {
  // CSS 注入（自动清理）
  ctx.effect(() => {
    const tag = document.createElement('style')
    tag.textContent = CSS
    document.head.appendChild(tag)
    return () => tag.remove()
  })

  // Settings 读取 + 订阅（即时生效）
  const config: MyConfig = { enabled: true, featureA: false, featureB: true }
  let settingsScope: any = null
  const settingsFace = ctx.get('webUiSettings') ?? ctx.get('settingsScope')
  if (settingsFace !== undefined && typeof settingsFace.bind === 'function') {
    try { settingsScope = settingsFace.bind({ namespace: PLUGIN_NS }) } catch { settingsScope = null }
  }

  if (settingsScope !== null) {
    // 读快照
    try {
      const snap = settingsScope.getSnapshot()
      if (snap?.status === 'ready' && snap.value) {
        config.enabled = snap.value.enabled ?? true
        config.featureA = snap.value.featureA ?? false
        config.featureB = snap.value.featureB ?? true
      }
    } catch { /* keep defaults */ }

    // 订阅变更
    ctx.effect(() => {
      let unsub: () => void = () => {}
      try { unsub = settingsScope.subscribe(() => { /* 重新读配置 + 重渲染 */ }) } catch { /* ignore */ }
      return () => { try { unsub() } catch { /* ignore */ } }
    })
  }

  // Slot 注册：settings 面板卡片
  ctx.slots.inject('settings.plugin.item', () =>
    ctx.slots.register(
      { name: 'settings.plugin.item', key: PLUGIN_NS, order: 100, inject: () => ({}) },
      MySettingsCard,
    ),
  )
}
```

---

## 十、验证清单

部署前逐项检查：

- [ ] Host 半使用 `ctx.inject(['settings'], ...)` + `installSection`/`register` 双 API 回退
- [ ] Host 半不使用 `import { ... } from '@deepseek-ai/dsh-settings'`
- [ ] 命名空间使用字符串字面量 `'myplugin'`，不经过 `settingsNamespace()`
- [ ] 功能默认值已评估与 0.1.2+ 原生功能的冲突，冲突项设为 `false`
- [ ] 所有 DOM 操作基于 `data-*` 语义属性，不依赖编译期 hash 类名
- [ ] 所有副作用通过 `ctx.effect` 登记，支持清理
- [ ] CSS 变量全部使用 `--dsw-alias-*` 语义 token
- [ ] 卸载时清理所有临时 CSS 变量（`style.removeProperty`）
- [ ] 在 DSH 0.1.1-rc.x 和 0.1.2-rc.1 上各验证一次
- [ ] README 顶部版本适配表格已更新（含 settings API 和冲突功能说明）

---

## 十一、v0.1.3+ Settings 命名空间变更

### 11.1 变更内容

v0.1.3-alpha.1 起，`settingsNamespace()` 包装函数被移除，改用字符串字面量：

```typescript
// ❌ 旧写法（0.1.0-rc.7 ~ 0.1.2-rc.1）
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
export const MY_NS = settingsNamespace('myplugin')

// ✅ 新写法（0.1.3+）
export const MY_NS = 'myplugin' as const
```

### 11.2 兼容性处理

```typescript
// 跨版本兼容：优先字符串，回退 settingsNamespace
export const MY_NS: string = (() => {
  // 0.1.3+ 直接用字符串
  return 'myplugin'
})()
```

实际上，字符串字面量在所有版本中都能工作（浏览器端读取时只看 namespace 字符串），所以**直接迁移到字符串方式即可**。

---

## 十二、v0.1.3+ Permission Presets

### 12.1 变更内容

v0.1.3 新增 `dsh-permission-presets` 统一服务，替代分离的 sandbox + approval 控制：

```typescript
// ❌ 旧方式（0.1.2 及更早）
setSandboxMode(session, 'workspace-write')
setApprovalPolicy(session, 'ask')

// ✅ 新方式（0.1.3+）
ctx.permissionPresets.set(session, 'workspace-write')
```

### 12.2 对插件的影响

- 如果你的插件直接调用 `setSandboxMode`/`setApprovalPolicy`，需要适配
- 如果你的插件不涉及权限控制，无需变更
- 内置预设：`workspace-write`（写+审批）和 `danger-full-access`（无审批）

---

## 十三、v0.1.5+ Session V3 与 Sidebar 重写

### 13.1 Session V3 — surface node 架构

v0.1.5 将 Session 格式从 V2 升级到 V3：

| 维度 | V2 (0.1.2/0.1.3) | V3 (0.1.5) |
|------|-------------------|-----------|
| 系统提示词 | 普通消息 | `surface node zero` |
| 格式 | projection-based | surface node + surface op |
| Inbox | `InboxService` 独立服务 | agent-loop 内部投影 |
| 压缩方式 | shadowed range | surface node 替换 |

**插件影响**：
- 如果你的插件读取 session 数据，需适配 V3 格式（内置自动迁移）
- 如果使用 `ctx.inbox`，需改为订阅 agent-loop 投影
- 如果依赖系统提示词消息语义，需适配 surface node zero
- 🔴 **如果插件向会话写入自定义 message source kind，v2→v3 迁移会直接拒载旧会话**（[#6311](https://github.com/deepseek-ai/deepseek-harness/discussions/6311)）；写入 null turn/step 的 marker 会永久破坏 `/compact`（[#5920](https://github.com/deepseek-ai/deepseek-harness/discussions/5920)）。规避方式与完整陷阱清单见 [upgrade-pitfalls.md](upgrade-pitfalls.md) §一

### 13.2 Sidebar 完全重写

v0.1.5 的 Sidebar 引入了 dockkit 停靠引擎和 5 个 slot：

```typescript
'sidebar.brand.mark'         → single   // 品牌标志
'sidebar.brand.name'         → single   // 品牌名称
'sidebar.workspaces'         → single   // 工作区浏览器
'sidebar.settings'           → single   // 设置入口
'sidebar.footer.action'      → list     // 页脚操作
```

**插件影响**：
- 旧的 Sidebar 插件可能需要重新适配 slot 契约
- 新增 `ui-dockkit`、`ui-sidebar-files`、`ui-sidebar-right`、`ui-sidebar-textpreview` 包
- 消息轨（TurnNavigator）硬编码在 ChatView 中，**无 slot 暴露**

---

## 十四、v0.1.5+ Token Meter API 扩展

### 14.1 变更内容

`ctx.tokenMeter` 从 **3 方法扩展到 7 方法**，新增 `measure()` 等 4 个方法：

| 方法 | 0.1.0-rc.5 | 0.1.5-rc.2 |
|------|-----------|-----------|
| `estimateMessage(message)` | ✅ | ✅ |
| `measure(session, requestHeader?)` | — | 🆕 |
| `estimateContentBlock(block)` | — | 🆕 |
| `estimateToolResult(result)` | — | 🆕 |

> **破坏性**：**无**。旧方法保留，新方法有默认实现。

### 14.2 `TokenMeasurement` 类型

```typescript
interface TokenMeasurement {
  readonly logRevision: SessionLogOffset
  readonly baseline: TokenMeasurementBaseline
  readonly surfaceDeltaTokens: number
  readonly totalTokens: number
  readonly surfaceTokens: number
  readonly nodes: readonly TokenSurfaceNode[]
}
```

### 14.3 迁移路径

```typescript
// ✅ 如果你只需要精确 token 计量 — 使用 measure()
const measurement = ctx.tokenMeter.measure(session)
const cost = calculateCost(measurement.surfaceTokens, measurement.baseline)

// ✅ 如果你需要检测 surface 变化（缓存失效）
const delta = currMeasurement.surfaceDeltaTokens
if (Math.abs(delta) > threshold) { /* cache invalidated */ }

// 旧写法仍可用
const oldEstimate = ctx.tokenMeter.estimateMessage(message) // ✅ 保留
```

---

## 十五、v0.1.5+ LLM Adapter 扩展

### 15.1 变更内容

`LlmAdapter` 从 3 方法扩展到 **7 方法**：

| 方法 | 0.1.0-rc.5 | 0.1.5-rc.2 | 说明 |
|------|-----------|-----------|------|
| `stream()` | ✅ | ✅ | 保留 |
| `resolveModel()` | ✅ | ✅ | 保留 |
| `listModels()` | ✅ | ✅ | 保留 |
| `providerInfo()` | — | 🆕 | 提供商品牌信息 |
| `providerRetryPolicy()` | — | 🆕 | 提供商级重试策略 |
| `imageRequestPricing()` | — | 🆕 | 图像计费信息 |
| `prepareCall()` | — | 🆕 | **HMR 安全隔离** |

> **破坏性**：**无**。新增方法都有默认实现，现有适配器无需立即实现。

### 15.2 `prepareCall()` — HMR 安全

将模型解析与流式分发绑定到同一注册世代，防止 HMR 期间的错配：

```typescript
// v0.1.5 — 推荐实现
async prepareCall(provider: string, model: string, signal?: AbortSignal) {
  const generation = this.currentGeneration
  const modelConfig = await this.resolveModelInternal(provider, model)
  
  return {
    readonly adapter: this,
    readonly modelConfig,
    execute(signal: AbortSignal) {
      if (this.currentGeneration !== generation) {
        throw new Error('HMR safety: adapter generation changed')
      }
      return this.streamInternal({ ...modelConfig, signal })
    }
  }
}
```

### 15.3 `ReplayEnvelope` 结构化

```typescript
// v0.1.0-rc.5
interface AssistantProvenance { replayState: unknown }

// v0.1.5-rc.2
interface ReplayEnvelope {
  response: unknown       // 响应级适配器私有元数据
  blocks?: readonly unknown[]  // 逐块元数据（与发出的块数对齐）
}
```

---

## 十六、v0.1.5+ 子代理目录与模型路由

### 16.1 新增能力

| 能力 | 说明 |
|------|------|
| 子代理目录 | 子代理创建时追加 `subagent/catalog` 事件，投影为可枚举列表 |
| 模型路由 | 每个子代理可独立指定 `provider`/`model`/`reasoningEffort` |
| 路由预检 | 子代理启动前预检 LLM 路由可用性 |

### 16.2 使用示例

```typescript
// 枚举子代理
const children = listChildren(parentAgent)
for (const child of children) {
  console.log(`${child.childId}: ${child.mode} — ${child.status}`)
}

// 子代理模型路由
const result = await startWorkflow({
  agentOptions: {
    provider: 'deepseek-official',
    model: 'deepseek-v3',
    reasoningEffort: 'max'
  }
})
```

---

## 十六A、插件 RPC/HTTP 通道实操(0.1.1 ~ 0.1.5)⚠️

> 2026-09-13 增补,来自 dsh-prime-memory 三轮实测 + better-sidebar main 已验证实现 + 0.1.5-rc.2 源码核读。
> 本节取代 v0.1.5-migration.md / dsh-version-migration-guide.md 中"迁到 `connection.rpc.intercept`"的旧路线。

### 16A.1 三条通道的源码级真相

| 通道 | 0.1.1-rc.2 | 0.1.2-rc.1 | 0.1.5-rc.2 | 结论 |
|------|-----------|-----------|-----------|------|
| `connection.rpc.handle('/channel')` | ✅ 可用 | ✅ 可用 | ❌ **注册成功但请求 405**(#6337) | 不能用于 0.1.5 |
| `connection.rpc.intercept('/api', matches, handler)` | ✅(带 fallback 链) | ✅ **单槽** | ✅ **单槽** | 单槽 = 他插件先注册则你抛错 |
| `ctx.webServer.register(prefix 路由)` | ✅ | ✅ | ✅ **按路径 key 多插件共存** | **推荐,全版本可用** |

关键细节(源码实锤):
- `intercept` 的 channel **只接受 `'/api'`**,传其他值抛 `invalid shared RPC channel`;
- interceptor 单槽:第二个注册者抛 `already has an interceptor`,且失败常被 try/catch 吞成静默回退;
- `handle` 的第三参 options 在 0.1.2-rc.1 已不存在(0.1.1-rc.2 有);
- `/api` 共享通道的请求**先过精确路由(fetchRoutes)再过 interceptor**——精确路由按路径 key 存 Map,可多插件共存;
- 0.1.5 起 webServer 授权按**调用方 fiber** 校验:插件入口必须 `inject = [..., 'connection', 'webServer']`,否则宿主 `fatal load failure`(见 upgrade-pitfalls §2.2)。

### 16A.2 推荐方案:自持 webServer 路由(0.1.1 ~ 0.1.5 全兼容)

Host 半(`src/index.ts`):

```ts
// 0.1.5 按调用方 fiber 校验 webServer 授权,必须声明
export const inject = ['llm', 'tools', 'systemPrompt', 'connection', 'webServer']

export function apply(ctx: Context, config: Config) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/your-plugin/api',
    handler: async (req, res) => {
      // ① loopback fence(DNS-rebinding 防护;connection 不导出实现,可抄 better-sidebar src/trust-fence.ts)
      if (!fence(req)) return writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
      // ② method 校验(自有 405 语义,别依赖分发层)
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } })
      // ③ 路径取方法名 → 分发 → 自有信封 {ok,value}|{ok,error}
      const method = pathname.slice('/your-plugin/api/'.length)
      writeJson(res, 200, await dispatch(method, await readJsonBody(req)))
    },
  }), 'your-plugin: api routes')
}
```

Client 半(不依赖 connection 服务,原生 fetch):

```ts
const res = await fetch(`/your-plugin/api/${method}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
})
if (!res.ok) throw new Error(`transport failure: HTTP ${res.status}`)
return await res.json()   // {ok,value}|{ok,error}
```

要点:
- **信封自有**,不要照抄 connection 的 client-request/server-response 信封(那是 intercept/handle 通道的协议,自持路由没必要);
- **fence 只做 DNS-rebinding 防护**(Host 须 loopback),不做用户鉴权;面板类数据可接受,机密字段在响应前必须脱敏;
- webServer 服务可能晚于插件就绪:探测 + `internal/service` 迁移监听重挂(模式同 settings 注册);
- 注册外面包 try/catch,把授权模型再变化降级为"面板不可用"而非宿主崩溃。

### 16A.3 兼容旧版(0.1.1/0.1.2)的回退顺序

必须在 0.1.1/0.1.2 上同时工作的插件,host 半按序回退:

1. `connection.fetch.register` 精确路由(若存在)——0.1.5 上也能用且不占 interceptor 槽;
2. `connection.rpc.intercept('/api', matches, handler)`——0.1.1-rc.2 起存在,但 0.1.2+ 单槽;
3. `connection.rpc.handle('/channel', handler)`——0.1.1/0.1.2 可用,0.1.5 上 405(仅兜旧)。

client 半按 `['/api', '/自定义通道']` 顺序重试并记忆成功通道(信封内业务错误 ok:false 不触发重试,只有传输层 throw 才换通道)。

### 16A.4 客户端声明式注入纪律（区分常备服务与可选服务）

```ts
// ❌ 错误:connection 是可选服务,部分宿主缺席/晚到 → apply 永久等待,UI 全静默消失、零报错
export const inject = ['slots', 'connection']

// ✅ 正确:shell 常备服务声明式注入(官方模式,0.1.5-rc.2 实测正常);可选服务懒取降级
export const inject = ['slots', 'locale', 'settingsScope']   // 设置 UI 必需的常备服务
export function apply(ctx) {
  const conn = ctx.get('connection')   // 可选服务:可能 undefined,功能级降级
  console.info('[your-plugin] client apply')   // 诊断点:UI 不显示时先看这行
}
```

**⚠️ 两个方向都会翻车，别矫枉过正**（2026-09-17 实测校准）：

- 把**常备服务**（`slots`/`locale`/`settingsScope`）也改成 apply 内 `ctx.get()` 懒取 → 激活竞态：settings 客户端晚于本插件激活时 `ctx.get` 返回 undefined，早退后**全部设置入口静默消失**（dsh-context-compression-improved 0.1.0 实录）。常备服务不存在"缺席"的合法状态——它们由设置 shell 提供，声明式等待即可；
- 把**可选服务**写进声明式 inject → 缺席宿主上 apply 永久挂起，同样全静默。

判别标准：缺席是否为合法状态。是 → 懒取降级；否 → 声明式。席位注册无论哪种都配 seat-pin 契约测试（[settings-seat-pinning.md](settings-seat-pinning.md)）。

判别口诀:**UI 不渲染且 Console 无 apply 日志 = 加载/注入层问题(声明式 inject 等待未提供服务,查 inject 清单;或懒取早退,查 warn);有日志但没渲染 = slot 注册层问题**(如 0.1.2+ 设置卡片注册到 `settings.plugin.item`(keyed 命名空间)或 `settings.plugins.tab`/`settings.section`——**单席位**,双注册在 0.1.5 上是重复渲染而非互补回退)。

### 16A.5 其他易误判点

- `package.json` 的 `dsh.client.inject` 清单写了不存在的包名**不会**导致加载失败(宿主 `arriveGraphRow` 对不存在的依赖静默跳过)——按 bundle 实际 require 的包声明即可;
- slot 注册失败(未声明槽/单槽被占)会在**插件激活期抛错**,所以每个 `slots.inject/register` 独立 try/catch,防止一处失败拖垮全部注册;
- fiber 重启(fiber 重挂/HMR)后 webServer/settings 注册的"already registered"类错误:进程内缓存 scope + 服务实例判活(`internal/service` 事件携带新实例)重挂,参考 compatibility-guide §2 的 settings 模式同款思路。

## 十七、深度文档索引

v0.1.5 的每个变更维度都有更深入的文档，供需要详细了解技术细节的开发者参考：

| 主题 | 插件框架总览 | 源码分析（技术细节） |
|------|-------------|---------------------|
| **Token Meter** | 本章（第十四章） | [Token Meter 深度指南](../source-analysis/v0.1.5-rc.2/plugin-migration-guide.md#一token-meter-api-深度分析) |
| **Permission Presets** | 本章（第三章 + 第十五章） | [Permission Presets 深度指南](../source-analysis/v0.1.5-rc.2/plugin-migration-guide.md#二permission-presets-深度分析) |
| **Inbox 投影** | 本章（第四章） | [Inbox 投影深度指南](../source-analysis/v0.1.5-rc.2/plugin-migration-guide.md#三inbox-投影重构深度分析) |
| **LLM Adapter** | 本章（第十五章） | [LLM Adapter 深度指南](../source-analysis/v0.1.5-rc.2/plugin-migration-guide.md#四llm-adapter-深度分析) |
| **Sidebar Slot** | 本章（第十三章） | [Sidebar Slot 深度指南](../source-analysis/v0.1.5-rc.2/plugin-migration-guide.md#五sidebar-slot-深度分析) |
| **Session V3** | 本章（第十三章） | [Session V3 深度指南](../source-analysis/v0.1.5-rc.2/plugin-migration-guide.md#六session-v3-深度分析) |
| **子代理目录** | 本章（第十六章） | [子代理目录深度指南](../source-analysis/v0.1.5-rc.2/plugin-migration-guide.md#七子代理目录深度分析) |

> **推荐阅读顺序**：插件框架总览 → [v0.1.5-migration.md](v0.1.5-migration.md)（引导性指南）→ [plugin-migration-guide.md](../source-analysis/v0.1.5-rc.2/plugin-migration-guide.md)（技术细节）

---

## 十八、宿主工作区存储的只读观察与插件数据生命周期清理

> 来源：dsh-perm-gate session sweep 专项（2026-09-14，main/legacy/compat 三线实证）。
> 解决的问题：插件按 session 落盘的数据（审计事件、快照、缓存），在宿主侧 session 被归档或删除后成为永久孤儿。

### 18.1 workspace.json 的结构事实（DSH 宿主自有存储，实测 v2 格式）

路径 `~/.dsh/storages/workspace.json`（`$DSH_HOME/storages/workspace.json`）：

```jsonc
{
  "unit": { "name": "workspace", "version": 2 },
  "global": {
    "workspaceIds": ["<uuid>"],
    "archivedSessionIds": ["session-<uuid>"]      // 已归档 session
  },
  "tables": {
    "workspaces": {
      "<uuid>": {
        "path": "E:\...", "title": "...",
        "sessionIds": ["session-<uuid>"],          // 该工作区的活跃 session
        "createdAt": "...", "updatedAt": "..."
      }
    }
  }
}
```

**归类规则**：活跃 = 所有 `tables.workspaces[*].sessionIds` 的并集；归档 = `global.archivedSessionIds`；**不存在 = 两者皆无**（session 被彻底删除，无法从该文件枚举，只能以"插件侧持有的 sessionId ∉ 活跃且 ∉ 归档"反推）。所有 id 带 `session-` 前缀，跨源比较前统一剥除。

### 18.2 观察模式的三条铁律

1. **只读**。该文件由宿主高频重写（mtime 持续变化），插件绝不写入；`JSON.parse` 失败（撕裂读）= 本轮跳过，下轮重扫，fail-open、不重试不阻塞。
2. **不可归属的数据永不删**。`sessionId` 为空、行/文件解析失败的数据一律保留（dsh-perm-gate 的 `snapshotMatchesSession` 早已确立同一语义：无 sessionId 的 legacy 快照永不匹配过滤）。
3. **fail-open 收尾**。任何 I/O 错误只 `console.warn` 一行、放弃本轮；清理是 best-effort，永远不能影响门控/功能主路径。

### 18.3 清理实现要点（JSONL + 目录快照的通用做法）

```typescript
// events.jsonl：读全量 → 过滤 → 仅当确有删除时原子替换
const tmp = `${eventsFile}.sweep-tmp`
writeFileSync(tmp, kept.join('
') + '
', 'utf8')
renameSync(tmp, eventsFile)   // 同步 I/O：与插件自身的 appendFileSync 同进程单线程，无交错窗口

// snapshots/<eventId>.json：逐文件读内嵌 sessionId 判定后 rmSync
```

适用判断：先分清哪些插件数据是"按 session 归属"（审计流、快照、会话级缓存），哪些是跨 session 共享的（如按 `tool|category` 键学习的数据——不随 session 清理），后者清了会让功能回退（如回到"每次都问"）。

### 18.4 插件后台定时任务模式

```typescript
if (config.sessionSweep !== false) {          // 功能开关：false 时连定时器都不创建
  const sweepOnce = (): void => { /* fail-open 清理 */ }
  const first = setTimeout(sweepOnce, 0)      // 启动首扫：不拖慢 apply()
  const hourly = setInterval(sweepOnce, 60 * 60 * 1000)
  hourly.unref?.()                            // 不阻止宿主进程退出
  ctx.effect(() => () => {
    clearTimeout(first)
    clearInterval(hourly)                     // 插件卸载/重载不泄漏
  }, 'my-plugin: session sweep')
}
```

三条缺一不可：`unref`（定时器不钉住进程）、`ctx.effect` 注销（重载不叠加定时器）、开关关闭时零定时器（可用测试钉住："关闭后数据不被清理且 dispose 不抛"）。

---

## 十九、apply() 的最小 mock 集成测试配方

> 脱离宿主端到端验证 apply() 接线（定时器、路由注册、disposer），无需启动 DSH。
> 完整范例：dsh-perm-gate `test/session-sweep-apply.spec.ts`（main/legacy/compat 三线同款）。

apply() 的 ctx 消费面通常只有四个方法，最小 mock 即可覆盖：

```typescript
function mockCtx() {
  const disposers: Array<() => void> = []
  return {
    ctx: {
      effect(fn: () => () => void): void { disposers.push(fn()) },
      get(): undefined { return undefined },                     // 服务探测走 fallback
      inject(_deps: readonly string[], _fn: (a: never) => void): void {
        // 不回调 = 模拟 settings/approval 等 host 服务缺席 → 插件自动 stand down
      },
      on(_name: string, _listener: (...args: never[]) => unknown): void {},
    },
    dispose: () => disposers.forEach((d) => d()),
  }
}

// 三段式：写夹具 → apply() → await 让 setTimeout(0) 首扫落地 → 断言
const { ctx, dispose } = mockCtx()
apply(ctx as never, { dshHome: dir, workspaceStoreFile: store } as never)
await new Promise((r) => setTimeout(r, 20))    // 让启动首扫这类 setTimeout(0) 任务跑完
// ...断言夹具数据被清理、活跃数据原样
expect(() => dispose()).not.toThrow()          // 注销路径不抛
```

注意：`inject` **不回调**（而非回调时传 undefined）才是"服务缺席"的正确模拟——插件的 `ctx.inject(['settings'], cb)` 在服务不存在时本就不执行 cb；强行回调反而会触发插件内部不一致路径。测试夹具一律 `mkdtempSync(tmpdir())`，绝不指向真机 `~/.dsh` 数据。

---

## 附录：版本兼容性速查

```
DSH 版本                          settings API                      客户端包              Session    关键变化
─────────────────────────────────────────────────────────────────────────────────────────────────────────────
0.1.0-rc.7 ~ 0.1.1-rc.x          register ✅                        dsh-client-runtime    V1        基础架构
0.1.2-alpha.2+ / 0.1.2-rc.1      installSection ✅                  dsh-client-store      V2        大重构
0.1.3-alpha.1+                    字符串命名空间                      dsh-client-store      V2+       Permission Presets
0.1.5-alpha.1+                    字符串命名空间                      dsh-client-store      V3        Sidebar 重写 + Electron
0.1.6-alpha.1                     installSection ✅（未变）           dsh-client-store      V3        四能力族 + 公共 manifest + 解析代际
0.1.7-rc.1                       configure ✅ / installSection ❌    dsh-client-store      **V4**    设置换代 + peer 强制 + 席位收窄
```

> **0.1.7 一行的三个「不计入兼容期」提醒**：`installSection` **已删除**（无垫片）；`settings.plugin.item` 席位**已移除**；`$DSH_HOME/settings.yaml` **已移除**。三项都属"不改就静默失效"类型，详见 §二十一。

> **参考**：`dsh-tidychat` v0.2.6 → v0.2.7 实际适配提交：
> - 折叠重做：`652a1f1`（model-retry 处理）
> - v0.2.6：`22620d8`（折叠/分隔线重做 + 定位条暂缓）
> - v0.2.7：`19c6a2d`（settings API 向后兼容）
> - README 适配矩阵：`ea43d88`

## 二十、v0.1.5 客户端与运行时 API 变更速查（实测实证）

> 来源：dsh-context-compression-improved compat/0.1.5 分支适配实测（2026-09-14）。逐条均在本机复现并有对应修复。与 upgrade-pitfalls.md §七 配合阅读。

### 12.1 客户端包迁移（0.1.2 起的破坏性重构，0.1.5 收尾）

- `@deepseek-ai/dsh-client-runtime` 已删除（npm 止步 0.1.1-rc.2），客户端栈为 `dsh-client-store`。inject 列表、peerDependencies、`import ... from '.../client'` 三处都要迁。
- **类型来源全部换位**：
  - `ClientContext` → `import type { Context as ClientContext } from '@deepseek-ai/cordis'`（0.1.5 各 client 包内部就是这么定义的）。
  - `SettingsScope` / `SettingsScopeSnapshot` → `@deepseek-ai/dsh-client-ui-settings/client`。
  - 会话 hooks（`useSessions` 等）不再由 runtime 提供：`@deepseek-ai/dsh-client-ui-session/client` 通过 `declare module '@deepseek-ai/dsh-client-ui-slots'` 合并进 `GlobalStandardProps`——**必须 type-only 引入该包**增强才生效，且 inject 清单要加 `dsh-client-ui-session`。
- **`ctx.slots` 不再有公开类型包**（原 dsh-client-runtime 挂载）：runtime 仍在，按官方 dsh-plugin-template 的方式自行声明模块扩充（`interface Context { slots: SlotsService }`，register 用 `Pick<SlotCore, 'register'>` 保住重载检查，`inject(slot, register)` 手写）。

### 12.2 客户端行为降级：`agentPreset` 不再暴露给浏览器

- 0.1.5 的 `SessionSummary` 浏览器摘要不再携带 `agentPreset`（`SessionWireHeader` 有但不下发），客户端无法判断当前会话是否 Minimal preset。
- 依赖它做 UI 门控的插件只能降级：选择器保持可选 + CHANGELOG 记录。不要试图从 projection 里找——`SessionProjectionMap` 里没有 preset。

### 12.3 运行时 API 变更（0.1.1-rc.2 → 0.1.5-rc.2 实测清单）

| 变更 | 旧 → 新 | 破坏性 |
|---|---|---|
| surface 替换操作 | `{ op: 'replace', start, end }` → `{ op: 'replace', startSeq, endSeq }`（`SessionSeq()` 品牌化） | 🔴 类型级 |
| `compaction/prune` 数据 | `shadowedRange: { start, end }` 字段名不变，值品牌化 | 🟡 |
| `agentLoop.create()` | 返回 `Promise<Agent>` | 🟡 |
| `session.events` | 移除，用 `snapshotEvents()` | 🟡（已有双路径层则免） |
| `dsh-llm` 的 `CallId` | 改名 `ToolCallId` | 🟡 |
| `settingsNamespace()` | 删除，命名空间为运行时校验的普通字符串 | 🟡 |
| SystemPrompt 配置 | `persona` → `personaPrefix` | 🟡 |
| AgentPresets 配置 | `includeShippedRoot` 成为必填 boolean | 🟡 |
| cordis 插件启动 | `await ctx.plugin(X)` 不再等待就绪，必须 `.await()` | 🔴（见 pitfalls §7.1） |
| firehose 覆盖 | seed-reopen 事件不进 `session/event`（Native auto-compact 即此路径） | 🔴（见 pitfalls §7.2） |
| `session.firstLiveSeq` | 替代 `header.seedLength`（数值型，0 = 无 seed） | 🟢 |
| peer 范围写法 | 必须 `>=0.1.5-rc.2 <0.2.0-0`（semver 预发布规则，见 pitfalls §7.3） | 🔴 |

### 12.4 e2e / 测试基建适配要点

- mock registry 的官方包清单从根 `devDependencies` 动态生成（覆盖 0.1.5 拆分后的完整 peer 闭包），不要手抄固定列表。
- consumer 临时目录写入独立 `pnpm-workspace.yaml`，阻断祖先工作区吸收（pitfalls §7.5）。
- 测试内插件挂载全部 `.await()`；`mountAgentLoopTestDependencies` 已含 SessionProjectionRegistry，勿重复挂。
- `.gitattributes` 标记字节钉死资产 `-text`，防 autocrlf 损坏 SHA-256 校验（pitfalls §7.4）。

---

## 二十一、v0.1.6 / v0.1.7 兼容性变更速查（源码实证）

> 来源：`deepseek-harness` 检出 `dsh-v0.1.7-rc.1`（`46a7f68b09`）对 `dsh-v0.1.6-alpha.1`（`0a15e36e7f`）与 `dsh-v0.1.5-rc.2`（`fb2c4b9e69`）的实测差异。
> 与 [upgrade-pitfalls.md](upgrade-pitfalls.md) §八、[v0.1.7-migration.md](v0.1.7-migration.md) 配合阅读。

### 21.1 一句话分级

| 级别 | 变更 | 谁必须动手 |
|---|---|---|
| 🔴 | `settings.installSection()` **删除**（0.1.5/0.1.6 各 15 处引用 → 0.1.7 **0 处**） | 所有带设置表单/设置页的插件 |
| 🔴 | `settings.plugin.item` 席位**移除**（13 → 13 → **1**，仅剩一处历史注释） | 注册该席位的插件 |
| 🔴 | `$DSH_HOME/settings.yaml` **移除**（一次性导入为 `settings.yaml.imported`） | 依赖该文件的部署 |
| 🔴 | `@deepseek-ai/dsh*` 的 **peer 范围强制校验**（**不是 `engines.dsh`**） | 声明了 DSH peer 的插件 |
| 🔴 | `dsh.profile.patchReload` **移除** | 手写 profile 清单者 |
| 🔴 | HMR 包改名 `cordis-plugin-hmr` → **`dsh-hmr`** | 在 YAML 引用 HMR 行的组合 |
| 🔴 | 会话格式 **V3 → V4**（不可回退） | 直接读写会话的插件 |
| 🔴 | `agent-team-web-profile` **整包删除**（非改名） | 选择该 bundle 的既有 profile |
| 🟡 | 可热改字段需声明 `Volatile<T>` | 希望设置页出现表单的插件 |
| 🟡 | `DshManifest` 公开面再收窄（3 个内部字段移出） | 引用 `configTrees` / `sessionFormatMigration` / `moduleFallback` 的插件 |
| 🟡 | 客户端模块 rev 改为 mtime/ctime/size | 自建 rev 缓存的插件/工具链 |
| 🟢 | `dsh.bundle.patch` 支持有序文件列表 | 可选 |
| 🟢 | 插件显示元数据 `locale/<lang>.json` 的 `meta` | 可选 |

### 21.2 设置：从"独立设置库 + 席位"到"Config 派生"

| 项 | ≤0.1.6 | 0.1.7 |
|---|---|---|
| 席位注册 | `settings.installSection(owner, ns, schema, entry, hooks)` | **`settings.configure(presentation, owner)`**（`:266`） |
| 重复注册 | 未定义 | **抛错** `Settings presentation is already configured for this plugin instance`（`:268`） |
| 命名空间 | `SettingsNamespace` 字符串 | **无概念**，按 profile entry id 识别 |
| 热改字段 | 独立 settings schema | **Config `.volatile()`**（0.1.6 时该 API 完全不存在） |
| 权威存储 | `$DSH_HOME/settings.yaml` | 活动 profile 的 `cordis.patch.yml` |
| 跨 profile 共享 | 支持 | **不支持** |

标准写法（官方各包一致）：

```ts
ctx.inject(['settings'], (child) => {
  child.effect(() => child.settings.configure({ auto: false }, ctx.fiber))
})
```

客户端读写配置的新 API 是 **`ctx.configForms`**（0.1.7 全新，实测 0 → 0 → **67** 个文件引用）：`ctx.configForms.get(entryId)` 取可接受值与共享写队列；`ctx.configForms.describe()` 做跨命名空间读取。提交时带上编辑前读到的 revision；冲突保留草稿。

### 21.3 席位存活表（0.1.7 现行）

| 席位 | 0.1.5/0.1.6 | 0.1.7 |
|---|---|---|
| `settings.plugin.item` | 13 | **1（仅历史注释）→ 已移除** |
| `settings.plugins.tab` | 9 | **8 → 仍在** |
| `settings.section` | 21 | **21 → 仍在** |
| `settings.onboarding` | 14 | 14 → 仍在 |
| `settings.models.provider-card` | 8 | 8 → 仍在 |

声明权威位置：`packages/client/ui-settings/src/client/contract/slots.ts`（`settings.section` 在 `:57`、`settings.plugins.tab` 在 `:66`）。详见 [settings-seat-pinning.md](settings-seat-pinning.md)。

### 21.4 peer 范围强制校验（**不是 `engines.dsh`**）

`apps/cli/README.md`（区间新增）：安装期与 profile 启动期都会校验声明的 DSH peer 范围，比对 `dsh --version` 所示运行时。

**但校验对象是 `peerDependencies`**（`packages/boot/app-boot/src/plugin-compatibility.ts:68-87`）：

- `:68` 无 `peerDependencies` 字段 → 直接判定兼容；
- `:75` 只取 `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*`；
- `:76` `workspace:^` / `:~` / `:*` 视为当前运行时版本；
- `:77` `semver.satisfies(..., { includePrerelease: true })`；
- `:84-87` 豁免键 `name@version` → 精确运行时版本数组。

**官方原文直证 `engines.dsh` 不参与**：

- `packages/boot/app-boot/README.md:52`：`Before a profile imports a plugin, DSH checks its peerDependencies on @deepseek-ai/dsh and @deepseek-ai/dsh-*…`
- `packages/util/package-manifest/README.md:93`：`Compatibility is declarative. Current installers and loaders do not enforce dsh.manifestVersion or engines.dsh…`

拒绝形态：错误码 **`incompatible-version`**，逐包给 `name`/`version`/`runtimeVersion`/未满足 `peers`；CLI 会打印确切的 `allow-version` 命令。豁免三命令：`version-exemptions` / `allow-version <pkg@ver> --dsh-version <runtime> --accept-risk` / `revoke-version <pkg@ver> --dsh-version <runtime>`（授予前打印风险警告）。

> `:77` 的 `includePrerelease: true` 意味着该校验**接纳预发布**，`>=0.1.5-rc.2 <0.2.0` 在此路径下**能**匹配 `0.1.7-rc.1`。但 pnpm 自身解析未必同样宽松，跨 rc 线仍建议 `-0` 上界（§附录与 pitfalls §7.3）。

### 21.5 清单类型（`packages/util/package-manifest/src/types.ts`）

| 变化 | 内容 |
|---|---|
| `dsh.bundle.patch` | `string` → **`string \| string[]`**（PR #4722；列表按序作为**一个层**应用，各文件相对路径**在该文件旁**解析） |
| `dsh.profile.patchReload` | **删除**（连同 `ProfilePatchReload` 类型） |
| 移出公开类型 | `configTrees` / `sessionFormatMigration` / `moduleFallback` |
| 新增类型 | `DshPackageManifest`、`DshEnginesManifest`、`LocalizedText`、`PluginLocalizedMeta` |
| `icon` 约束 | SVG/PNG/JPEG/WebP，相对清单目录，**≤256 KiB**，realpath 后须仍在目录内 |

### 21.6 客户端模块 rev 语义

| 项 | ≤0.1.6 | 0.1.7 |
|---|---|---|
| 行 rev 派生 | 内容哈希（脚本字节 + source map） | **mtime / ctime / size**，不哈希字节 |
| 跨 Host 重启 | rev 变化 | **保持稳定** |
| source map | 随脚本参与 | **首次 map `GET` 惰性读取并缓存**，map 体由首次 GET 固定 |
| `artifactBaseline` | `path`/`mtimeMs`/`size` | **+ `ctimeMs`** |
| registry 读面 | `graph()`/`clientPath()`/`artifactBaseline()` | **+ `fetchBundle()`** |
| `__ModuleLoader__` | — | **契约无破坏性变化**；其注册的 factory 新增 `chunk?` 与 `require.async` |

### 21.7 会话格式 V3 → V4

`SESSION_FORMAT_VERSION` 3 → 4（`packages/core/session/src/types.ts:89`）。四项语义变更：tool role 结果一等化（必需 `toolCallId`、可选 `isError`，`tool-result` 退出 content-block 联合）；生产者自有 source 取代插件包装器；新增 `developer/message` 事件；`turn/end.reason` 新增 `forked`。迁移包 `packages/session/session-format-v3-to-v4/` 本版新增。

**运营要点**：writer 已是 4，但 `docs/session-format-status.md` 的发布记录仍是 **3**（evidenceTag `dsh-v0.1.5-alpha.1`）；官方明确 rc 级发布**即已建立已发布格式义务**。读 open 在内存中迁移、写 open 才发布版本命名后继；**V3 reader 拒绝更新的代际，且不支持降级**。

### 21.8 LLM 与内容模型的连带变更（影响读写消息的插件）

- **DeepSeek 彻底 Messages-only**：`packages/llm/llm-deepseek/src/protocols/` 目录**已不存在**（上版含 `chat-completions/` 5 文件）；源码检索 `chat-completions` 系列 0 命中；`config.ts:215-217` 对传入 `protocol` 键**直接抛错**。因此**用户侧存量 `protocol: chat-completions` 配置会硬失败**，不是静默降级。
- `DEFAULT_MODELS` 从上版 4 个减到 2 个（`deepseek-flash`、`deepseek-v4-pro`）。
- `ContentBlockMap` 的 `'tool-result'` 被 `'tool-addition'` / `'tool-removal'` 取代；`MessageSourceMap` 取消 `plugin` 兜底 kind（改用生产者自有声明合并）。
- `packages/llm/llm/src/content.ts` 与 `token-meter` 同步删除所有 `tool-result` 递归遍历分支。
- 多模态保留改为 token 制：`maxInlineTokens` 默认 **12500**（原 `maxInlineBytes` 50000）。

### 21.9 能力缝增删（`docs/capability-seams.md` 生成区实测）

**本版删除**两条缝边：`svc_settings --> pkg_llm_deepseek` 与 `svc_settings --> pkg_llm_pi_ai`（两个 LLM 适配器不再经 settings 服务）。

**本版新增**：`ctx.officeToPdf`、`ctx.workspaceChanges`、`ctx.speechToText`、`ctx.speechController`、`ctx.pluginManager`、`ctx.pluginRegistryProbe`、`ctx.configEditor`、`ctx.hmr`、`ctx.profileContext`、`ctx.connection`、`ctx.productTelemetry`、`ctx.deepseekAccount`、`ctx.jobController`。

> **注意 `ctx.productTelemetry` 未被任何 shipped profile 挂载**（全树 `cordis.yml` / `cordis.patch.yml` 无引用；`docs/capability-seams.md:606` 的 implementations/consumers/companion 三列全为 `-`）。它与 `session-telemetry-otel`（**确实挂载于 `packages/bundle/base/cordis.patch.yml:204-210`**，默认 `FEEDBACK_ONLY`）不在同一层，不可互相类推。

### 21.10 升级自检命令

```powershell
$repo = 'E:\test\rewrite-agently\deepseek-harness'

# 1) 席位 API 换代（预期 15 / 15 / 0）
foreach ($t in @('dsh-v0.1.5-rc.2','dsh-v0.1.6-alpha.1','dsh-v0.1.7-rc.1')) {
  "$t : " + (git -C $repo grep -c 'installSection' $t -- packages | Measure-Object).Count
}

# 2) .volatile() 是本版新增（预期 0 / 0 / 多处）
foreach ($t in @('dsh-v0.1.5-rc.2','dsh-v0.1.6-alpha.1','dsh-v0.1.7-rc.1')) {
  "$t : " + (git -C $repo grep -c '\.volatile\(' $t -- packages | Measure-Object).Count
}

# 3) 席位存活（预期 plugin.item=1 注释 / plugins.tab=8 / section=21）
foreach ($s in @('settings.plugin.item','settings.plugins.tab','settings.section')) {
  "$s : " + (git -C $repo grep -c $s dsh-v0.1.7-rc.1 -- packages | Measure-Object).Count
}

# 4) peer 校验读什么（应只见 peerDependencies，不见 engines）
git -C $repo show dsh-v0.1.7-rc.1:packages/boot/app-boot/src/plugin-compatibility.ts

# 5) 会话格式（预期 3 / 3 / 4）
foreach ($t in @('dsh-v0.1.5-rc.2','dsh-v0.1.6-alpha.1','dsh-v0.1.7-rc.1')) {
  git -C $repo grep -n 'SESSION_FORMAT_VERSION = ' $t -- packages/core/session/src/types.ts
}
```

> **统计口径提醒**：本机 shell 实为 **Windows PowerShell 5.1**，`Get-Content | Measure-Object -Line` 与 `(Get-Content).Count` 读取**含非 ASCII 的 UTF-8 无 BOM** 文件时会**少算行数**。统计行数请改用 `[System.IO.File]::ReadAllLines($p).Count` 或 `git diff --numstat`。另：在仓库根使用 `Get-ChildItem -Recurse` 会跟进 `vendor/`、`node_modules` 符号链接并超时，应改用 `grep` 工具或限定目录。
