# 设置席位 TDD 钉死规约（settings-seat pinning）

> **当前依据**：宿主 `dsh-v0.1.7-rc.1`（`46a7f68b09`）实测
> **历史依据**：`dsh-v0.1.5-rc.2` / `dsh-v0.1.6-alpha.1`（见 [§5 历史席位表](#5-历史席位表仅作考古)）
> **适用对象**：任何带客户端设置面板 / 设置卡的 dsh 插件
> **⚠️ 0.1.7 重大变更**：`settings.installSection()` 已**彻底删除**；`settings.plugin.item` 席位**已移除**。旧版本文档中基于这两者的做法**全部失效**——详见 [v0.1.7-migration.md §1](v0.1.7-migration.md)。

## 为什么需要钉死

DSH 客户端设置面板的注入槽位随版本演变（`settings.section` 直挂 → `settings.plugin.item` 卡片 → `settings.plugins.tab` 独立页 → 0.1.7 移除 `plugin.item`），且**多个槽位同时被宿主声明**。实战中连续出现三类回归：

| 事故 | 根因 | 后果 |
|---|---|---|
| dsh-thinking-levels 2.0.0-beta.3 | 误信"0.1.5 移除了 `settings.plugin.item`"，同时注册 tab + item 两个槽位 | 设置里出现**两张相同面板**（配置列表一张卡 + 独立 tab） |
| dsh-context-compression-improved 0.1.0 | `inject` 只留 `['slots']`，apply 内懒取 `settingsScope`，取不到即早退 | 激活竞态下**三个设置入口全部消失** |
| dsh-context-compression-improved（修复后） | 保留 section 直挂 + 插件 tab 双注册 | 又出现双入口 |
| **（0.1.7 新增风险）任何仍调 `installSection` 的插件** | **该 API 已从宿主删除** | **设置入口静默消失，且不报错** |

根因共性：**席位选择是隐式知识，散落在注册代码里，没有任何测试守护**。本规约把它变成显式契约。

---

## 1. 0.1.7 席位表（现行，唯一权威）

0.1.7 的席位声明权威位置是 **`packages/client/ui-settings/src/client/contract/slots.ts`**：

```ts
'settings.section':     { kind: 'list'; scope: 'root'; owner: SettingsSectionOwnerProps }      // :57
'settings.plugins.tab': { kind: 'list'; scope: 'root'; owner: SettingsPluginsTabOwnerProps }  // :66
```

实测席位存活情况（`git grep -c '<slot>' <tag> -- packages` 命中的文件数）：

| 席位 | 0.1.5-rc.2 | 0.1.6-alpha.1 | **0.1.7-rc.1** | 状态 |
|---|---|---|---|---|
| `settings.plugin.item` | 13 | 13 | **1**（仅剩 `ui-settings-models/src/client/slot-contract.ts` 的一处历史注释） | 🔴 **已移除** |
| `settings.plugins.tab` | 9 | 9 | **8** | ✅ 仍在 |
| `settings.section` | 21 | 21 | **21** | ✅ 仍在 |
| `settings.onboarding` | 14 | 14 | **14** | ✅ 仍在（三版未变） |
| `settings.models.provider-card` | 8 | 8 | **8** | ✅ 仍在（三版未变） |
| `settings.models.sign-in` / `settings.models.footer` | 有 | 有 | 有 | ✅ 仍在 |

`packages/client/ui-settings/README.md` 的分工原文：

> The shell (`sidebar.settings` occupant, navigation, chrome) lives in ui-settings-general; **feature pages register `settings.section` contributions**; the **Plugins section hosts `settings.plugins.tab` pages**; onboarding steps register `settings.onboarding`.

### 1.1 席位选择决策（0.1.7）

| 你的场景 | 建议 |
|---|---|
| **小型配置**（几个开关/输入框） | **不注册席位**——把字段标为 `Volatile<T>`（见 [§2](#2-volatile-字段声明)），由宿主 schema 派生表单承载 |
| **需要自定义布局的插件页** | `settings.plugins.tab`（list，独立 tab，宿主"插件"分区承载标签栏） |
| **需要顶层导航独立分节** | `settings.section`（list） |
| **引导步骤** | `settings.onboarding` |
| **Models 分区内扩展** | `settings.models.provider-card`（keyed，按 `settingsNs` 派发）/ `.sign-in`（single）/ `.footer`（list） |

> **`settings.plugin.item` 的替代**：官方没有为它提供对应席位。0.1.7 的设计意图是让"普通配置"**不再需要注册任何席位**，而是由 Config 的 `.volatile()` 声明 + 宿主表单自动承载。只有需要**自定义呈现**时才注册 tab / section。

### 1.2 席位注册必须用 `ctx.slots.inject`

官方 `ui-settings-plugin-inventory` 的写法（`src/client/index.ts:56-57`）是标准范式：

```ts
ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
  name: 'settings.plugins.tab',
  // …options
}))
```

其 README 说明了原因（原文要点）：注册使用 `ctx.slots.inject()`，因此能跟随**标签 slot 的延迟声明、重新声明、本地化变化与 teardown**，而无需 import 分区拥有方。

---

## 2. `.volatile()` 字段声明

**这是 0.1.7 新增的机制**（实测：0.1.6-alpha.1 中 `git grep -c '\.volatile(' ... -- packages` 命中 **0** 个文件）。

Settings 的表单**只暴露 `.volatile()` 字段**。写法（取自 `packages/llm/llm-deepseek/src/config.ts` 的真实官方实现）：

```ts
import type { Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

export interface Config {
  /** 凭证引用（环境变量名），按请求解析；默认 DEEPSEEK_API_KEY。 */
  apiKeyEnv: Volatile<string>
  /** 端点 base；回退到可信环境层的 $DEEPSEEK_BASE_URL，再到公共 API。 */
  baseURL: Volatile<string | undefined>
  /** 默认思考强度（默认 high）；off 按请求禁用 thinking。 */
  reasoningEffort: Volatile<'off' | 'low' | 'high' | 'max' | undefined>
  /** 默认单请求输出上限（默认 256,000）；模型自身上限与显式请求值优先。 */
  maxTokens: Volatile<number>
}
```

消费侧纪律：**在操作时读取引用**，不要把 volatile 值在 `apply` 时快照进长期闭包（note 原文："consumers read their references during operations"）。判定可用 `isVolatile`（`@deepseek-ai/cosmokit`）。

---

## 3. 规约五条（0.1.7 版）

1. **一个面板一个席位**。同一设置面板只注册一个槽；多席位注册必然重复渲染。**0.1.7 起还多一条硬约束**：服务端 `settings.configure()` 对**同一 fiber 重复调用直接抛错**（`Settings presentation is already configured for this plugin instance`）——重复注册从"重复渲染"升级为"加载期报错"。
2. **席位选择即产品决策**，写进注册处注释与钉死测试。按 [§1.1](#11-席位选择决策017) 决策表选择；**优先考虑"不注册席位 + `.volatile()`"**。
3. **服务获取分级**：
   - shell 常备服务（`slots` / `locale`）与 **`settings` 一律用可选 `ctx.inject([...], child => …)` 子上下文**，在子上下文内做 `effect`；**禁用 apply 内 `ctx.get()` 懒取 + 缺席早退**——那是激活竞态，损失是全部入口静默消失，比挂起更糟。
   - 可选服务（缺席是合法状态）才允许 `ctx.get()` + 功能级降级。
4. **TDD 钉死**：每个插件写一份 seat-pin 契约测试（模板见 [§4](#4-钉死测试模板)），断言：声明式 inject 清单、注入的槽名与**次数**、注册 options（id/order/label/locale/inject 面）、组件身份、**禁止出现的槽名**，以及（0.1.7 新增）**`settings.configure` 的调用次数与 `auto` 取值**。CI 红灯 = 席位漂移。
5. **版本迁移 = 注册代码 + 钉死测试同一次修改**。新 DSH 版本改变席位契约时，**先在真实宿主源码固定席位声明文件**（0.1.7 是 `packages/client/ui-settings/src/client/contract/slots.ts`），再同步改这两处；测试文件头部注明当前依据的宿主 tag。

---

## 4. 钉死测试模板

### 4.1 客户端席位（沿用，加 0.1.7 断言）

桩驱动 `apply(ctx)`，捕获全部 `slots.inject` / `slots.register`（工厂可能是同步或 generator，两者都要兜住）：

```ts
function collectRegistrations() {
  const declared: string[] = []
  const registrations: { slot: string; options: Record<string, unknown>; component: unknown }[] = []
  const settingsConfigured: { auto: unknown; owner: unknown }[] = []
  const ctx = {
    effect: (build: () => unknown) => { void build(); return () => {} },
    locale: { register: () => () => {}, bind: () => (key: string) => key },
    settingsScope: { bind: () => ({}) },
    // 0.1.7：可选 settings 子上下文
    inject: (names: string[], factory: (child: unknown) => void) => {
      if (names.includes('settings')) {
        factory({
          effect: (build: () => unknown) => { void build(); return () => {} },
          settings: {
            configure: (presentation: { auto?: unknown }, owner: unknown) => {
              settingsConfigured.push({ auto: presentation.auto, owner })
              return () => {}
            },
          },
        })
      }
    },
    slots: {
      inject: (slot: string, factory: () => (() => void) | Generator<() => void>) => {
        declared.push(slot)
        const result = factory()
        const steps: Iterable<() => void> =
          typeof (result as IteratorObject)?.[Symbol.iterator] === 'function'
            ? (result as Generator<() => void>)
            : [result as () => void]
        for (const step of steps) { void step }
        return () => {}
      },
      register: (options: Record<string, unknown>, component: unknown) => {
        registrations.push({ slot: String(options['name']), options, component })
        return () => {}
      },
    },
  }
  apply(ctx as never)
  return { declared, registrations, settingsConfigured }
}
```

五类断言：

```ts
it('declares the services apply consumes', () => {
  expect(inject).toEqual(['slots', 'locale'])
})
it('injects exactly the pinned seats', () => {
  // 0.1.7：settings.plugin.item 已移除，绝不能出现在这里
  expect(declared).toEqual(['settings.plugins.tab', 'conversation.input.right'])
})
it('pins the options identity', () => {
  const { options, component } = registrations.find(r => r.slot === 'settings.plugins.tab')!
  expect(options['id']).toBe('thinking-levels')
  expect(component).toBe(ThinkingLevelsCard)
})
it('never mints the seats this plugin rejected', () => {
  expect(declared).not.toContain('settings.plugin.item')   // 0.1.7 已移除，注册它等于静默失效
  expect(declared).not.toContain('settings.section')
})
it('configures its settings presentation exactly once, opting out of the auto form', () => {
  expect(settingsConfigured).toHaveLength(1)
  expect(settingsConfigured[0]!.auto).toBe(false)
})
```

### 4.2 服务端呈现策略（0.1.7 新增）

```ts
it('claims the settings presentation from an optional child context', () => {
  const { settingsConfigured } = collectRegistrations()
  expect(settingsConfigured).toHaveLength(1)          // 不是 0（漏注册）、也不是 2（重复注册会抛错）
  expect(settingsConfigured[0]!.auto).toBe(false)     // 自带页面
})
```

> **为什么这条测试有价值**：`settings.installSection` 被删除后，漏迁移的插件**不会报错**——它只是不再出现在设置页里。这条断言把"静默失效"变成"CI 红灯"。

---

## 5. 历史席位表（仅作考古）

以下为 0.1.5-rc.2 / 0.1.6-alpha.1 的席位事实，**在 0.1.7 上不再成立**，保留用于理解既有插件的注册代码：

宿主 `ui-settings-plugins` 在 0.1.5-rc.2 与 0.1.6-alpha.1 上**同时声明**三个槽：

- `settings.plugins.tab`（list；`id`=tab 键、`order`、`label`()）——独立 tab 页
- `settings.plugin.item`（keyed；`key`=命名空间，Desktop 变体读 `id`）——内置"配置"tab 里的卡片列表 → **0.1.7 已移除**
- `settings.section`（list）——设置左侧导航的顶层独立分节

当时的一个重要澄清（仍然有效的方法论）：**"0.1.5 把 item 改名为 tab、旧名注册抛错"是误判**——旧名当时仍声明，双注册不抛错而是**重复渲染**；抛错只发生在注册宿主从未声明的槽。

### 5.1 参考实现（历史）

| 插件 | 当时的席位决策 | 0.1.7 处置 |
|---|---|---|
| dsh-thinking-levels | `settings.plugin.item` 单卡片（小型配置） | 🔴 **必须迁移**：改用 `.volatile()` 派生表单，或改 `settings.plugins.tab` |
| dsh-perm-gate | `settings.plugins.tab` 独立页（大型面板） | ✅ 席位仍在，仅需核对钉死测试 |
| dsh-context-compression-improved | `settings.section` 顶层分节（完整面板） | ✅ 席位仍在，仅需核对钉死测试 |

---

## 6. 排障速查（0.1.7 版）

| 症状 | 首查 | 次查 |
|---|---|---|
| 设置入口全消失 + Console 无 apply 日志 | 声明式 `inject` 在等待未提供的服务（检查 `inject` 清单） | — |
| 设置入口全消失 + apply 日志正常 | 🔴 **是否仍在调 `settings.installSection`**（0.1.7 已删除，静默失效） | 是否漏了 `settings.configure` 子上下文 effect |
| 设置表单里**没有你的字段** | 字段是否标了 `Volatile<T>`（未标则不进表单） | 该 entry 是否已有覆盖（覆盖会钉住旧值） |
| apply 日志有、入口消失 | 注册层问题：查懒取早退 `console.warn` | 注册了已移除的槽名（`settings.plugin.item`） |
| 入口**重复** | 多席位双注册，跑 seat-pin 测试定位多出的槽 | — |
| **加载期抛错** `Settings presentation is already configured` | 同一 fiber 调了两次 `configure` 并发了 | 是否把 `configure` 放在了会被多次求值的位置 |

---

## 7. 复核命令

```powershell
$repo = 'E:\test\rewrite-agently\deepseek-harness'

# 席位存活（0.1.7 应为：plugin.item=1(仅注释) / plugins.tab=8 / section=21）
foreach ($slot in @('settings.plugin.item','settings.plugins.tab','settings.section')) {
  "$slot : " + (git -C $repo grep -c $slot dsh-v0.1.7-rc.1 -- packages | Measure-Object).Count
}

# 席位声明权威位置
git -C $repo show dsh-v0.1.7-rc.1:packages/client/ui-settings/src/client/contract/slots.ts

# 服务端呈现 API
git -C $repo grep -n 'configure(presentation' dsh-v0.1.7-rc.1 -- packages/settings/settings/src/index.ts

# .volatile() 是本版新增（0.1.6 应为 0）
foreach ($t in @('dsh-v0.1.6-alpha.1','dsh-v0.1.7-rc.1')) {
  "$t : " + (git -C $repo grep -c '\.volatile\(' $t -- packages | Measure-Object).Count
}

# 客户端配置读写新 API（0.1.6 应为 0）
foreach ($t in @('dsh-v0.1.6-alpha.1','dsh-v0.1.7-rc.1')) {
  "$t : " + (git -C $repo grep -c 'configForms' $t -- packages | Measure-Object).Count
}

# installSection 已删除（0.1.5/0.1.6=15，0.1.7=0）
foreach ($t in @('dsh-v0.1.5-rc.2','dsh-v0.1.6-alpha.1','dsh-v0.1.7-rc.1')) {
  "$t : " + (git -C $repo grep -c 'installSection' $t -- packages | Measure-Object).Count
}
```

---

*本规约 2026-09-25 按 `dsh-v0.1.7-rc.1` 校准。迁移动作见 [v0.1.7-migration.md §1–§2](v0.1.7-migration.md)；通道与注入纪律见 [compatibility-guide.md §16A](compatibility-guide.md)。*
