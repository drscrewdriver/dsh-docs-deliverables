# 【第 13 篇】浏览器与电脑操作：browser-use + computer-use——两个「独占命名 provider」能力族

> **版本**：v0.1.6-alpha.1（`0a15e36e7f`） ｜ 对比基线：v0.1.5-rc.2（`fb2c4b9e69`）
> 难度：🟡 进阶（能力缝 + provider 注册 + 生命周期所有权）
> **本篇为新增文档**：`packages/browser-use` 与 `packages/computer-use` 两个能力族在 `dsh-v0.1.5-rc.2` 及更早版本的仓库树中**不存在**（`git ls-tree` 两版对比可证），因此「核心概念 / 包结构 / 数据流」三节本身即为本版变更内容。
> 官方子系统文档：`docs/subsystems/browser-use.md`、`docs/subsystems/computer-use.md`（均为本版新增）

## 目录

0 引言 ｜ 1 概述 ｜ 2 核心概念 ｜ 3 包结构 ｜ 4 关键类型 ｜ 5 数据流 ｜ 6 测试覆盖 ｜ 7 与上游/下游的关系（含 `web`/`shell` 边界） ｜ **8 本版本变更要点** ｜ 9 未核实与边界

---

## 0 引言

### 0.1 版本与包范围

| 项 | 值 |
|---|---|
| 本版 tag / commit | `dsh-v0.1.6-alpha.1` / `0a15e36e7f` |
| 上版 tag / commit | `dsh-v0.1.5-rc.2` / `fb2c4b9e69` |
| `packages/browser-use` 组内包 | 1 个：`browser-use/browser-use` |
| `packages/computer-use` 组内包 | 1 个：`computer-use/computer-use` |
| 两组新增文件量 | 各 **11** 个文件（3 个组级 README + 8 个包内文件：双语 README、i18n、`package.json`、`tsconfig.json`、`src/index.ts`、`src/brand.ts`、`tests/registry.spec.ts`），合计 22 个 |
| 两组新增行数 | 合计 **+894 / -0**（纯新增，无删除；browser-use 448 行，computer-use 446 行） |
| 依赖的实验 provider | 6 个包，全部位于 `packages/experimental/` |

两组在 `packages/README.md` 中的定位（原文）：

| 组 | 定义 |
|---|---|
| `computer-use/` | `Exclusive named desktop-provider registration` |
| `browser-use/` | `Exclusive named browser-provider registration` |

### 0.2 官方文档入口

- `docs/subsystems/browser-use.md` — provider 选择与 per-Session 浏览器所有权
- `docs/subsystems/computer-use.md` — provider 选择与共享桌面限制
- `packages/browser-use/README.md`、`packages/computer-use/README.md` — 组级 README（`kind: package-group`）
- `packages/experimental/README.md` — 6 个实验 provider 的清单与 `ctx` 键

---

## 1 概述

### 1.1 一句话定位

**这两个族不提供任何工具。它们只提供「一个槽位」。**

> `dsh-browser-use` 的 README 原话：*"This package adds no model-visible tools or browser operations."*
> `dsh-computer-use` 的 README 原话：*"This package adds no model-visible tools and does not coordinate concurrent Sessions."*

真实工具、浏览器/桌面资源、观察格式与结果渲染全部归 **provider**（实验包）所有。共享服务记录的东西只有一样：**当前注册的 provider 名字**。

```text
        ┌──────────────────────────── 部署配置选择一个 ────────────────────────────┐
        │                                                                        │
   [ Playwright MCP ]   [ Chrome DevTools MCP ]   [ Stagehand native ]            │
   [ Cua Driver MCP ]   [ Cua Driver native ]                                    │
        │                      │                       │                        │
        └────── ctx.browserUse.register(name) ──┬── ctx.computerUse.register(name)
                                                │
                                  ┌─────────────┴─────────────┐
                                  │  共享服务：只存一个 name   │
                                  │  第二次注册（哪怕同名）抛错 │
                                  └───────────────────────────┘
```

### 1.2 为什么需要「只注册名字」的服务

| 问题（Agent Note `## Problem` 原文摘要） | 决策（`## Decision`） |
|---|---|
| 浏览器后端暴露的操作与观察格式各不相同；**在没有可移植消费者之前**，做一个通用浏览器动作 API 会提前约束这些实验 | 服务不包含浏览器对象、共享操作类型、dispatch 方法、资源生命周期或运行时选择器 |
| 桌面 provider 的操作、观察格式与平台能力各不相同；DSH 需要**阻止一次组合里意外启用两个 provider**，同时不承诺通用动作 API | 服务只注册一个 provider 名并返回 disposer；第二个注册无论叫什么名字都失败 |
| 会话可以隔离浏览器；附着既有已登录浏览器时必须保留其状态并阻止 provider 内并发占用 | 所有权下沉到 provider：附着在同一 provider 实例内为单 Session 独占 |

### 1.3 关键边界：**独占（exclusive）** 是什么意思

| 维度 | 行为 |
|---|---|
| 槽位数量 | **恰好一个**。`register()` 见到既有注册即 `throw` |
| 同名重复注册 | **同样失败**。测试断言 `register(MCP)` 两次会抛 `already registered`，且第二次注册的报文里带**已注册的名字**（`playwright-mcp` / `cua-driver-mcp`） |
| 释放方式 | 返回 Cordis effect disposer；provider 插件卸载时 `ctx.effect` 自动移除贡献 |
| 过期 disposer | 不能移除一个**更晚**的注册（README 明示 *"a repeated disposer cannot remove a later registration"*；测试覆盖该序列） |
| 选择方式 | **配置选择** provider；模型**不能**在运行时切换已注册后端 |
| 作用域 | 限制在**该 Cordis service 实例内**（README `Known Limitations` 明示） |

### 1.4 与「能力缝（capability seam）」的关系

仓库级约定要求能力缝由 **Service Definition / Service Provider / Consumer** 三角色组成。这两族的形态是一个**弱化但仍完整**的三角：

| 角色 | browser-use | computer-use |
|---|---|---|
| Service Definition | `BrowserUseRegistry`（`ctx.browserUse`） | `ComputerUseRegistry`（`ctx.computerUse`） |
| Service Provider | 3 个实验包各自 `inject: ['browserUse']` 并 `register()` | 2 个实验包各自 `register()` |
| Consumer | 无共享消费者——provider 自己拥有工具，走普通 tool 管线 | 同左 |

Agent Note 对此的表述是刻意的：*"No current consumer requires interchangeable action methods, so provider-owned tools retain those semantics."*

---

## 2 核心概念

| 概念 | 含义 | 出处 |
|---|---|---|
| 独占命名 provider（exclusive named provider） | 一次组合只能挂一个 provider；注册只记录名字，返回 effect disposer | `packages/browser-use/browser-use/src/index.ts`、`packages/computer-use/computer-use/src/index.ts` |
| 品牌化名字（branded name） | `BrowserUseProviderName` / `ComputerUseProviderName` 是 `Branded<'…'>`，工厂函数**不做校验也不改写** | 两包的 `src/brand.ts`（各 15 行） |
| per-Session 浏览器所有权 | 启动的浏览器属于**该次存活的 Agent 与 Session**（不只是可复用的 Session id）；跨轮次复用同一个浏览器 | `docs/subsystems/browser-use.md` |
| 附着（attach）模式 | 外部拥有的浏览器保持运行；provider 在同一实例内为**一个 Session** 独占保留，保留既有状态，拒绝另一 Session 同时附着；拆解时只断开不关闭 | 同上 |
| 共享桌面 | computer-use **不为 Session 保留桌面**；并发 Session 与独立 DSH 进程可以操作同一桌面，**由调用方协调**完整 observe/act/verify 流程 | `docs/subsystems/computer-use.md` |
| 取消不做回滚 | 「取消不能撤销已经交付的浏览器/桌面动作」在两篇子系统文档中被分别明示 | 同上 |
| 实验包（experimental） | 两组依赖的 6 个 provider 全部是 `@deepseek-ai/dsh-experimental-*`，**公开但需要显式挂载**，不在默认组合中 | `packages/experimental/README.md` |

---

## 3 包结构

### 3.1 两个能力族组

| 组 | 组 README | 组内包 | `ctx` 键 | 组内是否含实验代码 |
|---|---|---|---|---|
| `packages/browser-use` | `README.md`（`kind: package-group`） | `browser-use/` | `ctx.browserUse` | **否**（README 引用 `../experimental/README.md`） |
| `packages/computer-use` | `README.md`（`kind: package-group`） | `computer-use/` | `ctx.computerUse` | **否** |

两组的组 README 都明确：**「Choose one provider and mount the shared registration service.」**

### 3.2 注册包的文件构成（两组同构）

| 文件 | browser-use | computer-use |
|---|---|---|
| `README.md` / `README.zh.md` / `README.i18n.yaml` | 90 / 90 / 6 行 | 89 / 89 / 6 行 |
| `src/index.ts` | 48 行 | 48 行 |
| `src/brand.ts` | 15 行 | 15 行 |
| `tests/registry.spec.ts` | 50 行 | 50 行 |
| `package.json` / `tsconfig.json` | 42 / 21 行 | 42 / 21 行 |

`src/index.ts` 全貌（browser-use 版，computer-use 仅替换名字与错误文案）：

```ts
/** Owns one optional provider registration in the shared browser-use service. */
export class BrowserUseRegistry extends Service {
  private registration: BrowserUseProviderName | undefined

  constructor(ctx: Context) { super(ctx, 'browserUse') }

  /** Name of the registered provider, including while its resources are closing. */
  get providerName(): BrowserUseProviderName | undefined { return this.registration }

  register(name: BrowserUseProviderName): () => Promise<void> {
    if (this.registration !== undefined) {
      throw new Error(`browser use provider "${this.registration}" is already registered`)
    }
    return this.ctx.effect(() => {
      this.registration = name
      return () => { this.registration = undefined }
    }, 'browserUse.register()')
  }
}
```

### 3.3 依赖的实验 provider 包（6 个）

| 包目录 | npm 名 | 集成方式 | 声明的 `ctx` 键 |
|---|---|---|---|
| `experimental/browser-use-playwright-mcp` | `@deepseek-ai/dsh-experimental-browser-use-playwright-mcp` | Playwright 的浏览器控制 MCP 工具 | `ctx.browserUse` |
| `experimental/browser-use-chrome-devtools-mcp` | `@deepseek-ai/dsh-experimental-browser-use-chrome-devtools-mcp` | 经 MCP 做 Chrome DevTools 检查与控制 | `ctx.browserUse` |
| `experimental/browser-use-stagehand-native` | `@deepseek-ai/dsh-experimental-browser-use-stagehand-native` | 原生浏览器操作 + AI 辅助动作/观察/抽取 | `ctx.browserUse` |
| `experimental/browser-use-runtime` | `@deepseek-ai/dsh-experimental-browser-use-runtime` | 实验 provider 共享的 Session 级浏览器资源库（**无 `ctx` 键**） | — |
| `experimental/computer-use-cua-driver-mcp` | `@deepseek-ai/dsh-experimental-computer-use-cua-driver-mcp` | 连接已安装的 `cua-driver` 可执行文件（MCP） | `ctx.computerUse` |
| `experimental/computer-use-cua-driver-native` | `@deepseek-ai/dsh-experimental-computer-use-cua-driver-native` | 随 npm 依赖安装的平台原生运行时 | `ctx.computerUse` |

> 全部 6 个包的 `version` 字段在本版为 `0.1.6-alpha.1`。

**关键结构事实**：两个能力族包**不依赖**任何实验包。Agent Note `## Consequences` 原文：*"The browser package group has no dependency on experimental runtime code."* / *"The service remains independent of experimental packages."* 共享资源的生命周期与附着保留由 `browser-use-runtime` 拥有，方法**不**进入 browser-use 服务。

---

## 4 关键类型

两个族的类型面极小——这正是设计意图。

### 4.1 品牌化 provider 名字

```ts
/** Browser-use provider identities. @module @deepseek-ai/dsh-browser-use/brand */
import type { Branded } from '@deepseek-ai/dsh-brand'

/** Provider-owned name identifying a browser-use registration. */
export type BrowserUseProviderName = Branded<'BrowserUseProviderName'>

/** Brand a provider-owned name without changing or validating it. */
export function BrowserUseProviderName(name: string): BrowserUseProviderName {
  return name as BrowserUseProviderName
}
```

子路径导出：`@deepseek-ai/dsh-browser-use/brand`、`@deepseek-ai/dsh-computer-use/brand`。

### 4.2 服务 API

| 服务 | 类 | 成员 | 签名 |
|---|---|---|---|
| `ctx.browserUse` | `BrowserUseRegistry` | `register` | `register(name: BrowserUseProviderName): () => Promise<void>` |
| | | `providerName` | `get providerName(): BrowserUseProviderName \| undefined` |
| `ctx.computerUse` | `ComputerUseRegistry` | `register` | `register(name: ComputerUseProviderName): () => Promise<void>` |
| | | `providerName` | `get providerName(): ComputerUseProviderName \| undefined` |

`register` 的 JSDoc 契约（两份 `docs/subsystems/*.md` 的生成区逐字收录）：

> *Reserve the sole provider slot until the contribution is disposed. A second registration fails even when it repeats the current name. Providers must stop their tools and await owned work before releasing this registration.*

`providerName` 的 JSDoc：**在其资源正在关闭期间也报告该名字**——这是 provider 卸载可见性的唯一来源。

### 4.3 刻意缺席的类型

| 缺席项 | browser-use | computer-use |
|---|---|---|
| 浏览器/驱动对象 | ✅ 无 | ✅ 无 |
| 共享操作接口（动作类型 / dispatch 方法） | ✅ 无 | ✅ 无 |
| 资源生命周期管理 | ✅ 无（归 provider / `browser-use-runtime`） | ✅ 无 |
| 运行时 provider 选择器 | ✅ 无 | ✅ 无 |
| Session 锁 / 桌面预留 | 附着保留在 provider 内 | ✅ 无（需调用方协调） |
| `./invariant` 运行时不变式伴随包 | **不发布**，README 给出理由：注册表只有一个权威字段，没有可独立分叉的观察 | 同左 |

---

## 5 数据流

### 5.1 注册与释放（两族同构）

```text
provider 插件加载
  → inject: ['browserUse'] / ['computerUse']
  → register(name)
      ├─ 已有注册？→ throw `… provider "<现有名字>" is already registered`
      └─ 无 → ctx.effect(...) 返回 disposer；providerName = name

provider 关闭
  → 停止接纳工具调用
  → 关闭自有资源
  → 等待已拥有的工作结束
  → 调用 disposer 释放注册
      └─ 此后 providerName 变回 undefined，另一 provider 可注册

provider 插件卸载（未经释放）
  → Cordis effect 自动移除该贡献
```

### 5.2 browser-use 的 per-Session 资源流

```text
Agent 创建（串行 agent/created 事件）
  → MCP provider：等待一次连接 + 工具发现
      ├─ 成功 → 客户端归该 Session 所有，跨轮次保留；工具目录对 prompt 组装可见
      ├─ 失败/取消 → 拒绝创建或恢复，回滚 Agent 与其客户端资源
      └─ 附着被占用 → **本次激活永久跳过启动**，其余工作继续；不重试
  → 模型调用 provider 自有工具（走普通执行管线与 Session 日志）

Session 运行时销毁
  → 关闭其启动的浏览器资源
  → 重新加载或 fork 不继承已启动的 profile（浏览器 profile 与登录态**不**从 Session 日志恢复）
```

补充约束（`docs/subsystems/browser-use.md`）：

- 加载或重新加载 provider **不接管已经活跃的 Session**；初始化规则归 `browser-use-runtime`。
- 附着释放后，**新创建或恢复的** Agent 可以取得该附着（先前跳过的激活不重试）。
- 浏览器 MCP 连接同时暴露 MCP 的 resources 与 server instructions；针对浏览器 server 的 resource 调用使用其 Session 队列并**拒绝其他 Session**，server instructions 也只为其归属 Session 组装。

### 5.3 computer-use 的调用流

```text
模型调用 provider 工具
  → Cua Driver MCP：经 MCP server 转发到已安装的 cua-driver 可执行文件
  → Cua Driver native：在 DSH host 进程内运行 npm 原生运行时
  → 结果转换留在 dsh-mcp-client（同一回调式工具适配器也转换 native 结果）
  → 图片能力路由 + attachment store → 持久化截图；不支持图片的路由 → 既有 MCP 图片诊断

provider 拆解
  → 保留注册直到工具接纳停止、已拥有工作与资源关闭
  → 启动失败也会释放本次尝试的注册
  → MCP provider 在重连期间**保持**注册
```

**没有桌面锁**：一个已注册 provider 不为任何 Session 保留桌面。

---

## 6 测试覆盖

### 6.1 单元测试（两组各一份 `tests/registry.spec.ts`，50 行）

| 用例 | 断言内容 |
|---|---|
| `rejects a second provider and permits registration after disposal` | 初始 `providerName` 为 `undefined` → 注册 `MCP` 后等于 `MCP` → 重复注册 `MCP` 抛 `already registered` → 注册 `NATIVE` 抛含 `playwright-mcp`（computer-use 为 `cua-driver-mcp`）→ `dispose()` 后回到 `undefined` → 可注册 `NATIVE` |
| `releases a provider contribution when its plugin unloads` | 用一个 `{ name, inject, apply }` 的测试插件注册，`ctx.plugin(...)` 后 `providerName` 正确；`provider.dispose()` 后回到 `undefined`，另一个名字可以注册 |

第二例即仓库约定要求的 **HMR 安全性**（registry 贡献必须证明可释放）：dispose fiber 并观察移除。

### 6.2 录制会话快照（`snapshots/session/`）

5 个会话级快照目录，每个含 `cordis.yml`、`cordis.snapshot.yml`、`replay.override.json`、`session.v3.jsonl`、`snapshot.yml`、`system-prompt.expected.md`、`tool-schemas.expected.json`：

| 快照目录 | 额外的 fixture 文件 |
|---|---|
| `browser-use-playwright-mcp` | `provider-fixture.mjs`、`cli.js`、`catalog.json`、`package.json` |
| `browser-use-chrome-devtools-mcp` | 同上 |
| `browser-use-stagehand-native` | `native-fixture.mjs` |
| `computer-use-cua-driver-mcp` | `driver.mjs` |
| `computer-use-cua-driver-native` | `native-fixture.mjs` |

`cordis.yml` 展示的挂载形态（browser-use 侧）：

```yaml
- insert:
    - id: browser-use
      name: '@deepseek-ai/dsh-browser-use'
    - id: browser-provider-fixture
      name: './provider-fixture.mjs'
```

Cua Driver MCP 侧带 `config: { command: !!js process.execPath, args: [driver.mjs, .dsh/computer-use-fixture], reconnect: { enabled: false } }`。

### 6.3 工具目录（`docs/tool-catalog.md` 生成物）

| provider | 静态声明的工具 |
|---|---|
| `browser-use-stagehand-native` | `stagehand_act`、`stagehand_extract`、`stagehand_navigate`、`stagehand_observe`、`stagehand_screenshot`、`stagehand_tabs`；注入 `ctx.browserUse`、`ctx.agents`、`ctx.tools`、`ctx.systemPrompt`；事件 `tool/call`、`tool/result` |
| 其余 4 个 provider | **工具目录中无静态行**——MCP provider 的工具来自外部 server，因此不出现在静态生成的工具目录里 |

> 该差异是可复核的：`docs/tool-catalog.md` 中只有 `browser-use-stagehand-native` 一个本版新增 provider 有工具行。

---

## 7 与上游/下游的关系

### 7.1 边界差异：`browser-use` vs `packages/web` vs `packages/shell`

三个族都「让模型与外部世界交互」，但归属完全不同：

| 维度 | `packages/web` | `packages/shell` | `packages/browser-use` / `computer-use` |
|---|---|---|---|
| `ctx` 键 | `ctx.web` | `ctx.shell` | `ctx.browserUse` / `ctx.computerUse` |
| 角色 | 搜索/抓取的**能力缝 + 选择策略**：`ctx.web.search()` / `ctx.web.fetch()`，为每次操作选一个可用后端，统一取消、错误与结果上限 | 命令执行的**能力缝**：`ctx.shell` 跑前台命令或异步准备后台进程，profile 可选本地/沙箱化 Bash/PowerShell | **仅注册**：不含操作，不含资源，不含选择策略 |
| 是否自带模型可见工具 | 否（`dsh-tool-web` 工具加载它） | 否（`bash` / `pwsh` 工具拥有模型可见渲染与沙箱指引） | 否（provider 拥有自己的工具） |
| 是否有共享操作 API | 有（search/fetch + 统一错误词汇） | 有（请求 → `resolve(request): Spec` → 执行） | **没有**（刻意不做） |
| provider 数量 | 每操作可换后端 | 本地/沙箱等实现 | **恰好一个**（独占） |
| 资源所有权 | 无跨调用资源 | 后台进程句柄 | 浏览器（per-Session）／桌面（无保留） |

一句话：**`web` 与 `shell` 是「有共享动作词汇的能力缝」，`browser-use`/`computer-use` 是「只有一个槽位的注册点」。** 前者能被可移植消费者替换后端；后者在出现可移植消费者之前刻意不定义共享动作。

### 7.2 上下游

| 方向 | 关系 |
|---|---|
| **上游** | `packages/mcp`（`dsh-mcp-client`）拥有 MCP 结果转换与回调式工具适配器，browser/computer 的 MCP provider 与 native 结果都经它；MCP resources 与 server instructions 由 `feat(mcp): add scoped resources and server instructions`、`feat(mcp): negotiate modern protocols with the official SDK` 引入 |
| **下游** | 工具的模型可见渲染走普通 tool 管线与 Session 日志；图片走 image-offload 与 attachment store |
| **被隔离方向** | 实验包**不得**进入默认产品：本版新增的 `scripts/web-product-bundle-isolation.ts` 与 `verify-default-product-isolation` 会把 `@deepseek-ai/dsh-experimental-*` 挡在产品 bundle 之外 |
| **发布策略** | 6 个实验包全部公开（`@deepseek-ai/dsh-experimental-*` 前缀），denylist 当前为空 |

---

## 8 本版本变更要点（rc.2 → 0.1.6-alpha.1）

> 本族在 rc.2 **不存在**，因此「新增」即为变更本身。

### 8.1 引入提交

| 提交（完整哈希） | 标题 | 内容 |
|---|---|---|
| `af4ad05845219691bef9b633f91cbd96cb89772e` | `feat: add computer use with Cua Driver providers` | computer-use 服务 + 两个 Cua Driver provider |
| `e1612c2fdc951b764336cd328662d015c9770d85` | `feat(browser-use): add per-Session experimental browser backends` | browser-use 服务 + 三个浏览器 provider + `browser-use-runtime` |
| `16f97e2dfb3201d138a249ee4ce24e6ead4a25be` | `refactor(browser-use): defer DSH inference integration` | **显式推迟** DSH 推理集成 |

随后的修正与文档提交：

| 提交 | 标题 |
|---|---|
| `b84a8226bd5016e6bcd2662a96f1b4a056352e59` | `fix(browser-use): initialize MCP clients without new core APIs` |
| `6caeb505c505c73d954a1dc04abe4098c3574dce` | `fix(browser-use): await existing Agent creation lifecycle` |
| `e41511d84415b20fa9a41fd9809b80107ca5653f` | `fix(browser-use): integrate current MCP resources and snapshots` |
| `d1e32e481a93ab54092468272cd5f4c8759ac150` | `fix(browser-use): close lifecycle gaps and isolate replay fixtures` |
| `0752a09ae6b50ee8fd87a5bc71e0d0a752a90bdf` | `docs(browser-use): explain the Stagehand action timer limit` |
| `52a8f7a759eebf995f938729b459b4b51ebdd841` | `docs(browser-use): clarify conditional tool ordering` |
| `cd97419e810245decb57fcf904e62d249b850f15` | `fix(computer-use): cancel image admission and fix source snapshots` |
| `3ba5b6eb04` / `489c3ac715` | `feat(mcp): add scoped resources and server instructions` / `feat(mcp): negotiate modern protocols with the official SDK`（browser-use 的 resources/instructions 依赖） |

### 8.2 两条设计决策记录（本版新增）

| Agent Note | 核心决策 | 关键 `## Consequences` |
|---|---|---|
| `.agents/notes/implemented/architecture/2026-09-12-browser-use-provider-registration.md` | `dsh-browser-use` 拥有 `ctx.browserUse`；服务无浏览器对象、共享操作类型、dispatch 方法、资源生命周期或运行时选择器；computer-use 的注册决策**独立拥有**桌面侧 | provider 各自独立演进工具，共享服务保持「只剩名字的注册表」；三个 provider 与 runtime helper 作为实验包发布，**不在 shipped 默认中启用**；browser 组对实验运行时代码**零依赖**；附着保留只在单个 provider 实例内生效，不跨 DSH 进程或外部浏览器客户端；浏览器状态**不进入 Session 重放**；取消不撤销已交付动作 |
| `.agents/notes/implemented/architecture/2026-09-12-computer-use-provider-registration.md` | DSH 能力名为 **computer use**；**Cua Driver** 是上游实现名；服务无 provider 对象、共享操作类型、dispatch 方法、Session 锁或运行时选择器；MCP 结果转换留在 `dsh-mcp-client` | 服务与实验包独立；公开版本 allowlist 接纳两个 provider 包但**不提升其支持状态**；配置选择 provider，**切换需先卸载当前 provider**；原生平台支持与宿主权限是上游与部署方责任；macOS 光标叠加层托管与专用 Desktop 权限 UI 被**推迟**；取消只停止等待并传播到 driver，**不承诺回滚已交付的桌面输入** |

### 8.3 明确的 experimental / 未默认启用状态

| 项 | 状态 | 证据 |
|---|---|---|
| 两个能力族的服务包 | **非实验**，但**不含任何工具**，单独挂载不产生任何模型可见能力 | 两包 README 的 Model Experience 节均写 `None, as this registry only records provider names.` |
| 6 个 provider / runtime 包 | **实验**、公开、需显式激活、**默认不启用** | `packages/experimental/README.md`；`docs/subsystems/*.md`（"require explicit activation"） |
| 在 shipped profile/bundle 中的出现 | **零出现**。检索仓库内全部 `*.yml` / `*.yaml`（排除 `node_modules`）中的 `dsh-browser-use` / `dsh-computer-use`，命中仅 `pnpm-lock.yaml` 与 5 个 `snapshots/session/*/cordis.{yml,snapshot.yml}` 测试组合 | 全仓 `Select-String` 扫描 |
| 浏览器初始引擎 | Chromium（三个 provider 共同） | `docs/subsystems/browser-use.md` |
| 持久化影响 | 无。本版 `SESSION_FORMAT_VERSION` 仍为 3 | RECON §2；Agent Note 明示 *"this integration adds no persistence events or Session schema changes"* |

### 8.4 明确推迟的工作（`refactor(browser-use): defer DSH inference integration`）

browser-use 的 Agent Note 与其子系统文档一致列出的推迟项：

- DSH 模型路由（Session 模型选择）
- 凭据复用
- 底层推理请求/响应捕获
- 接入 Session 用量计费

Stagehand 使用其**固定 SDK 目录中显式配置的原生模型**；配置的 API key 与可选 header 被转发进浏览器扩展，推理在扩展内进行。返回的 SDK 数据与元数据仍作为**普通已记录的工具结果**进入 Session 日志。DSH 保留任务循环。

computer-use 侧推迟项：macOS 光标叠加层托管、专用 Desktop 权限 UI。

---

## 9 未核实与边界

| 项 | 状态 |
|---|---|
| 各 provider 的完整工具清单 | **部分核实**：`docs/tool-catalog.md` 只静态列出 `stagehand_*` 六个工具；MCP provider 的工具来自外部 server，未在仓库内枚举 |
| Cua Driver 上游的具体工具名与平台支持矩阵 | **未核实**：子系统文档明确「Provider READMEs own installation, permission, and platform limitations」，本篇未逐一读取 5 份 provider README 的工具表 |
| Stagehand native 的模型目录内容 | **未核实**：README 只说 `model.modelName` 来自「pinned Stagehand SDK catalog」，未枚举 |
| 桌面 provider 的跨进程协调 | 设计上**不存在**：一个 provider 注册不保留桌面；`docs/subsystems/computer-use.md` 明示调用方协调 |
| 浏览器附着保留的跨进程语义 | 只在**单个 provider 实例内**生效；独立 DSH 进程与外部浏览器客户端不在保留范围内 |
| 「独占」在多个 Cordis service 实例下的行为 | README 明示限制在**该 service 实例内**；未核实多实例组合下的实际行为 |
| 真实浏览器/桌面的端到端验收 | 快照为 keyless 录制回放；真实 GUI/桌面交互不在本版单元测试覆盖内 |

---

*文档生成时间: 2026-09-17*
*数据源: dsh-v0.1.6-alpha.1 (0a15e36e7f) vs dsh-v0.1.5-rc.2 (fb2c4b9e69)*
