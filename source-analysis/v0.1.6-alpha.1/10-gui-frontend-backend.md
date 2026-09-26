# 【第 10 篇】GUI 前后端：apps/web + host + client——浏览器到主机的桥梁（v0.1.6-alpha.1）

> **版本**：v0.1.6-alpha.1（`0a15e36e7f`） ｜ 对比基线：v0.1.5-rc.2（`fb2c4b9e69`）
> 难度：🟢 入门（只讲架构组织与版本增量，不抠渲染细节）
> 前置阅读：`第09篇-应用层cli与boot.md`
> 版本坐标：发布提交 `ea53423b60 release(dsh): 0.1.6-alpha.1`，tag 日期 2026-09-15 10:42:33 +0800

## 目录

0 引言 ｜ 1 概述 ｜ 2 核心概念 ｜ 3 包结构 ｜ 4 关键类型 ｜ 5 数据流 ｜ 6 测试覆盖 ｜ 7 与上游/下游的关系 ｜ **8 本版本变更要点（rc.2 → 0.1.6-alpha.1）** ｜ 9 变更速查表 ｜ 10 未核实与边界

---

## 0 引言

### 0.1 本篇范围与规模

| 目录 | 本版变更文件数 | 本版插入/删除 |
|---|---|---|
| `packages/client` | **512**（其中 202 位于 `src/`） | +13988 / -10419 |
| `apps/web` | **106** | +10212 / -455 |
| `apps/desktop` | **77** | +4612 / -2238 |
| `packages/host` | 35 | +139 / -97 |
| `apps/desktop-host` | 2 | +44 / -23 |

`packages/client` 是本版**改动最大的单个目录**（RECON 记录 512 文件）。

### 0.2 官方子系统文档

- `docs/subsystems/web-server.md` — HTTP 载体：`WebRouteKind`/`WebRoute`、匹配顺序、可认领的 fallback 席位、index taps
- `docs/subsystems/terminal.md` — 持久终端 id、backend/session 契约、send readiness、有界读、owner 可见快照
- `docs/web-styling.md` — 样式规范（`--dsw-*` 令牌体系）
- `packages/client/README.md` / `packages/host/README.md` — 浏览器半区与主机半区包清单

> 本版**没有**新增 GUI 专属的 `docs/subsystems/*` 页面；上述两页的索引行在 `docs/subsystems/README.md` 中本版已存在。

---

## 1 概述

### 1.1 一句话结构

GUI 仍是「**一个纯载体 + 两座桥 + 三层浏览器端**」：

```text
浏览器端（packages/client，53 个包目录）
  apps/web 入口 AppWebEntry（本版未改，仍 6 行）
    → 对象层 runtime（Connection / SessionManager，无 React）
    → 渲染机制 web-react（slot 渲染器 + SessionProvider）
    → 展示组件 ui-*（纯 props）

主机端（packages/host，8 个包目录）
  webserver：纯 node:http 载体（本版 src 零改动，被下列插件注册路由）
  apiproxy：/api 桥（Typert RPC）      SSE：事件流      frontend-static：SPA dist 服务
  浏览器 ↔ 主机：RPC + SSE；webserver 自身不知道任何 harness 概念
```

### 1.2 本版最重要的结构性事实

| 事实 | 证据 |
|---|---|
| **主机半区源码基本冻结**：8 个 `packages/host` 包中唯一改动的 `src/` 文件是 `packages/host/directory-picker-auto/src/index.ts`（把 `ctx.loader.remove()` 改为「先取 fiber、`dispose()`、`remove()`、再 `await`」，并等待新建 fiber） | `git diff --name-only dsh-v0.1.5-rc.2..dsh-v0.1.6-alpha.1 -- packages/host` |
| **`packages/host` 包数量未变**（8） | `git ls-tree -d --name-only <tag> packages/host/` |
| **入口薄壳未变**：`apps/web/src/main.ts` 两版逐字节相同 | `git show <tag>:apps/web/src/main.ts` |
| **浏览器半区包目录 51 → 53**，新增 `ui-sidebar-terminal`、`ui-settings-unarchive-sessions` | `git ls-tree -d --name-only packages/client/` 对比 |
| 新增 `packages/api/terminal-controller`（Host 侧）、`packages/test-support/remote-mock`（测试侧） | 包目录对比 + `package.json` 的 `name` |
| `SESSION_FORMAT_VERSION` 保持 3；本版 GUI 改动未触发持久化格式变更 | RECON §2；`2026-09-12-session-unarchive-settings-page.md` 明示 "No frame type, persisted field, or `SESSION_FORMAT_VERSION` change accompanies the verb" |

### 1.3 一句话总结本版

> **载体不动、入口不动；变化全部落在浏览器半区与 Electron 应用层。** 侧栏从「只读预览」长成「可交互终端 + 引用预览 + 归档恢复」的工作面；测试线从「手搭 bench」换成「真实 roster + RemoteMock」；并新增一道把实验包挡在产品 bundle 之外的构建闸门。

---

## 2 核心概念

| 概念 | 含义 | 本版是否变 |
|---|---|---|
| 载体（carrier） | `dsh-host-webserver` 是纯 `node:http` 载体，不知道任何 harness 概念，功能路由全部由插件注册 | 未变（`src/` 零改动） |
| slot | `ctx.slots.register({ name, children?, store?, inject? }, Component)`：UI 插件注册/渲染协议 | 未变（`ui-slots` 仅 4 个文件变更，属随版更新） |
| 三层分离 | 对象层（`runtime`，无 React）／渲染机制（`web-react`）／展示组件（`ui-*`，纯 props） | 未变；两个新 `ui-*` 包仍遵循分层 |
| Remote 命名空间 | 浏览器经 Typert 调用 Host 的 `<namespace>/<method>`；本版新增 `terminal` | **新增**（`packages/api/terminal-controller`） |
| 实验包隔离 | 默认产品不得依赖 `@deepseek-ai/dsh-experimental-*`；本版做成**构建期闸门** | **新增闸门** |
| 客户端组装测试线 | 用真实 `web` roster 启动客户端，只替换 Connection 的传输层 | **新增测试层** |
| 纯展示原则 | UI 是渲染器；模型可见的新输入仍必须是会话事件 | 未变 |

---

## 3 包结构

### 3.1 包目录数量

| 区域 | v0.1.5-rc.2 | v0.1.6-alpha.1 | 变化 |
|---|---|---|---|
| `packages/client` 包目录 | 51 | **53** | +2 |
| `packages/host` 包目录 | 8 | 8 | 0 |
| `apps/` | 4（cli / web / desktop / desktop-host） | 4 | 0 |

### 3.2 本版新增的客户端包

| 包名 | 目录 | 文件数 | 职责 |
|---|---|---|---|
| `@deepseek-ai/dsh-client-ui-sidebar-terminal` | `packages/client/ui-sidebar-terminal` | 29 | 右侧栏原生终端页签、xterm 渲染、FitAddon 尺寸、清理与恢复 UI、主题与光标配色 |
| `@deepseek-ai/dsh-client-ui-settings-unarchive-sessions` | `packages/client/ui-settings-unarchive-sessions` | 14 | 设置页中的「归档会话」列表与恢复动作 |

`ui-sidebar-terminal` 的 29 个文件中含 7 个测试（`apply` / `cleanup` / `recovery` / `terminal-body` / `terminal-cursor` / `terminal-guide` / `terminal-theme`），以及 `src/client/` 下的 `terminal-cursor.ts`、`terminal-theme.ts`、`locales.ts`、`face.ts`。

### 3.3 本版新增的非客户端包（GUI 的直接下游）

| 包名 | 目录 | 角色 |
|---|---|---|
| `@deepseek-ai/dsh-api-terminal-controller` | `packages/api/terminal-controller` | Host 侧终端控制器：拥有按 Session 划分的用户终端，暴露 `terminal` Remote 命名空间；`src/` 含 `index.ts`、`shells.ts`、`stream.ts`、`terminal.ts`、`types.ts`、`close-requests.ts` |
| `@deepseek-ai/dsh-remote-mock` | `packages/test-support/remote-mock` | 按端点名应答 Remote 流量的测试替身 |
| （既有包新增深导入） | `packages/test-support/client-runtime` | 本版新增 `src/assembly/` 整客户端测试层 |

### 3.4 改动量最大的既有客户端包（文件数）

`ui-conversation` 48、`ui-sidebar-documentpreview` 31、`ui-chat` 28、`ui-trajectory` 26、`ui-primitives` 22、`ui-sidebar-right`／`ui-agent-preset`／`ui-commands`／`ui-tool` 各 17、`ui-workspace` 15、`ui-permission-presets` 14、`connection` 12、`ui-input-trigger`／`ui-sidebar-files` 各 10。

---

## 4 关键类型

本版 GUI 相关的新增类型集中在终端链路，全部来自 `packages/api/terminal-controller/src/types.ts`（本版新文件）：

```ts
/** A terminal identity scoped to one Session and one Host lifetime. */
export type WebTerminalId = Branded<'WebTerminalId'>
/** An attachment allowed to write and resize one terminal. */
export type TerminalAttachmentId = Branded<'TerminalAttachmentId'>

/** An executable shell verified in the subprocess provider's execution environment. */
export interface TerminalShell { readonly path: string; readonly args: readonly string[]; readonly name: string }

/** Working directory and limits shared by new and restored terminals. */
export interface TerminalEnvironment {
  readonly cwd: string; readonly maxInputBytes: number
  readonly maxCols: number; readonly maxRows: number; readonly scrollback: number
}

/** Host-owned terminal state; process exit never creates a replacement shell. */
export interface WebTerminalInfo {
  readonly id: WebTerminalId; readonly title: string; readonly shell: TerminalShell
  readonly cols: number; readonly rows: number
  readonly state: 'running' | 'exited' | 'failed'
  readonly exitCode: number | null; readonly error?: string; readonly controllerId?: TerminalAttachmentId
}

/** Every attachment begins with a complete bounded screen, then ordered output. */
export type TerminalFrame =
  | { readonly type: 'snapshot'; readonly sequence: number; readonly screen: string; readonly info: WebTerminalInfo }
  | { readonly type: 'output'; readonly sequence: number; readonly data: string }
  | { readonly type: 'state'; readonly info: WebTerminalInfo }
```

同文件还以声明合并向 `RemoteErrorDetailsMap` 注册两个错误细节键：

| 错误键 | 载荷 | 语义 |
|---|---|---|
| `terminal/control-unavailable` | `{ reason: 'read-only' \| 'not-running' }` | 输入或 resize 被拒绝，但**不**使输出附着失效 |
| `terminal/limit-reached` | `{ limit: number }` | 保留屏幕与待分配终端耗尽了该 Session 的终端配额 |

其余 GUI 类型（`WebRoute`/`WebRouteKind`、slot 类型链）在本版**未变**——`packages/host` 全组 `src/` 除 `directory-picker-auto` 外无改动可证。

---

## 5 数据流

### 5.1 侧栏终端：浏览器 ↔ 主机

`ui-sidebar-terminal` →（`connection` 的 Remote 流）→ `api/terminal-controller` → `subprocess provider`，顺序为：

1. `terminal.discover` 列出候选 shell（执行环境默认项优先），Host 只接受当前已发现的路径，仅发现不分配进程；
2. 选择菜单项即记录路径（origin 作用域 localStorage）并立刻打开新终端；
3. `terminal.create({ id, shellPath, cols, rows })` 拉起 PTY，同一「Session + open id」重复 create **不会**分配第二个进程；
4. 每个附着以一份**有界完整屏幕快照**开始（`TerminalFrame.snapshot`），随后是有序增量（`output`）与状态帧（`state`）；
5. `terminal.write` 串行化；`snapshot` 与 `output` 共用一个操作队列。

关键约束（源自 `2026-09-09-web-sidebar-terminal.md`）：

| 约束 | 内容 |
|---|---|
| 进程保活 | 折叠、切页签/会话、浮动、全屏、浏览器断连都**保留**进程；只有用户显式关闭才回收 |
| 恢复语义 | 重新加载恢复的是「Host 保留的终端」，**不是**上次的侧栏布局；Host 重启不恢复进程 |
| 独占写 | 只有最新附着可写输入与改尺寸；其余附着只读；显式接管可从另一页面恢复写权 |
| 关闭意图持久化 | 关闭请求先写入终端专用 localStorage 键，成功才删除；启动时重试残留请求 |
| 无模型可见输入 | 终端输出不产生模型输入、Agent 工具结果或 Session 事件 |

### 5.2 归档会话恢复：一条新 Remote 动词

`ui-settings-unarchive-sessions` → `WorkspaceController` 的 `@Remote('unarchiveSession')` → `WorkspaceRegistry` 的幂等 check-then-write（同一操作链内，丢失竞态即 no-op）→ 回传**完整** `WorkspaceArchiveValue`，复用既有 `{ type:'archived', archivedSessionIds }` 增量，无新帧类型。

要点：恢复**不做**会话存在性探测（移除引用不会引入未知引用，因此 Session 已消失的条目仍可恢复）；归档集仍是唯一被改写的持久状态；`workspace` domain version、Session log、Workspace accounting 槽位都不动。

---

## 6 测试覆盖

### 6.1 本版新增的 `apps/web/tests` 文件

| 文件 | 对应能力 |
|---|---|
| `sidebar-terminal.e2e.ts` + `fixtures/sidebar-terminal.patch.yml` + `expected/sidebar-terminal/*.expected.md`（6 份：colors / guide / limit / running / shell-menu / theme） | 侧栏终端 |
| `session-unarchive.e2e.ts` / `diff-context.e2e.ts` / `ptc-escalation.e2e.ts` / `workspace-recency.e2e.ts` / `default-product-isolation.e2e.ts` | 归档恢复 / 上下文 diff / PTC 提权 / 工作区最近性 / 实验包隔离负控 |
| `deepseek-messages-chat.e2e.ts` / `deepseek-messages-settings.e2e.ts` + `expected/deepseek-messages-settings/*` | Messages 协议默认化后的 GUI 回放 |
| `assembled-remote.ts` / `assembled-remote.spec.ts` / `fixtures/assembled-remote.fixture.json` | 整客户端组装测试线 |
| `auto-review-denial.e2e.ts` / `auto-review-fixture.ts` / `auto-review-child.overlay.yml` | Auto review |

### 6.2 三层测试线（本版定型）

| 层 | 载体与说明 |
|---|---|
| 整客户端 | `client-runtime` 的 `src/assembly/`：从 bundle 读真实 roster → 只替换 Connection 传输 → 走生产 `bootClient` / `mountClient` |
| 组装态浏览器用例 | `apps/web/tests` 在 `AppWebEntry` 启动前经 `__DSH_TRANSPORT__` 安装 `RemoteMock` |
| 真实 Host | `launchWebScaffold()`：走真实 HTTP/WebSocket |

成本（Agent Note 原文）：整 `web` roster 冷启动约 5 秒、热启动远低于 1 秒；三行依赖锥约每用例 20 毫秒。

---

## 7 与上游/下游的关系

| 方向 | 关系 |
|---|---|
| **上游** | `webserver` 被 `frontend-static`（认领 fallback 席位）、`apiproxy`、`plugin-inventory` 消费；`packages/boot` 提供 profile 解析与启动严格性（本版 `feat(boot): add profile resolution modes`、`feat(boot): distinguish required startup failures`） |
| **下游** | `packages/api/terminal-controller` 是侧栏终端的 Host 端；`packages/terminal/*`（本版 44 文件、+4165/-88）提供 PTY 语义；`packages/subprocess/*` 提供执行环境 |
| **平级 / 闸门** | `apps/cli` 的 pkg 构建与 `apps/desktop-host` 共享产物；`scripts/web-product-bundle-isolation.ts` + `bundle-input-isolation.ts` 横跨 `packages/client`（tsdown 客户端预设）与 `apps/web`（Vite 产物图） |

---

## 8 本版本变更要点（rc.2 → 0.1.6-alpha.1）

### 8.1 侧栏终端（本版最大新功能）

| 提交 | 内容 |
|---|---|
| `e15a9b1bec` | `feat(web): add interactive sidebar terminals`（首次引入） |
| `4012092d24` | `feat(web): launch terminals from provider guide menus` |
| `33d89aee77` / `37e5d8c4aa` | `feat(web): choose and remember terminal shells` + 启动前记忆 shell 选择的修复 |
| `249c8d1565` | `feat(web): show common shells by default` |
| `1daed09185` / `80043785c4` | `feat(web): follow application theme in sidebar terminals` + 颜色与光标对比度修复 |
| `0a525601a7` / `d28625c6d5` / `11b2114786` | 生命周期与恢复加固、跨 Host/侧栏生命周期恢复快照、启动器控件对齐 |
| `578e1e428f` / `0a0563cc9b` | 光标主题绑定测试、保留终端 fixture |

**扩展点**：`sidebar.right.tab.guide.entry` 是一个**键控 slot**，按当前 provider id 分派——替换内置 provider 的扩展同时接管其 guide 渲染。条目 slot 允许出现「shell 菜单」，而不必替换整个 guide 或在按钮里嵌套按钮。

**主题绑定**：应用主题提供终端默认色；body 读取解析后的 CSS 令牌，**仅当这些颜色变化时**才更新 xterm。公开的 OSC 解析观察者把索引色/默认色覆盖与 DSH 默认值**分开保留**，reset 时先移除对应覆盖再恢复当前主题。DOM 光标读每次渲染后的实际单元格背景色，经作用域 CSS 变量取对比填充色，因此光标移动不会重置调色板。

**与 Agent 终端的差异**：Agent 的持久终端工具控制提示符并等待语义结果；人类终端需要原始键盘输入、常规 shell 配置与全屏。两者不共享注册表，只共享 subprocess 能力。

### 8.2 置顶折叠头（sticky collapsible headers）

| 提交 | 内容 |
|---|---|
| `67271a921b` | `feat(web): pin Think and compaction headers sticky while scrolling` |
| `b416ac99e4` | `fix(web): hold a compaction summary's code banner below the pinned header` |

| 维度 | 内容 |
|---|---|
| 问题 | Web Think 行（`.thinkBody`）与 compaction 标记（`.compactionBody`）是仅有的两个**不封顶**块，长正文会把自身的折叠开关顶出视口 |
| 方案 | 打开时 disclosure header 相对共享会话滚动容器 `[data-conversation-scroll]` 做 `position: sticky; top: 0`；**折叠时回到普通流**，随页面滚走 |
| 层级 | Think 用 `z-index: 1`；compaction header 用 `z-index: 7`（其正文渲染 markdown，代码块 banner 自身占 `z-index: 6`），并新增组件内测量 `--dsh-compaction-header-height` 同时供开关高度与 banner 偏移使用 |
| 悬停 | 钉住期间把 hover 填充改为不透明令牌 `--dsw-alias-interactive-bg-hover-solid` 并去掉圆角，避免滚动正文透出 |
| 性质 | **纯 CSS**：无计时器、无订阅、无持久状态、无 DOM 结构变化、无传输流量 |

作用域限定：Think 规则在 `packages/client/ui-chat/src/client/chat/ReasoningRow.module.css`，compaction 规则在 `MessageItem.module.css`（用 `:has()` 以「正文存在」判定打开态）。封顶的工具行保持原行为，避免一屏堆叠多个置顶头。

### 8.3 Mermaid 全屏查看器

| 提交 | 内容 |
|---|---|
| `b0ec8cef32` | `feat(docs): add fullscreen Mermaid diagram viewer` |
| `ece25ff8e6` / `cd0cc91382` / `91f6733096` | 控件简化 / 滚轮缩放锚定指针 / 可访问标题对齐 |

**归属澄清**：该能力位于 **`website/.vitepress/theme/`**（`index.ts` + `mermaid-viewer.ts`）与 `website/tests/mermaid-viewer.spec.ts`，属于**文档站主题**，不是 `apps/web` 产品 UI。

| 维度 | 内容 |
|---|---|
| 交互 | 每个渲染后的 Mermaid SVG 加角标全屏图标；原生 modal dialog 提供 inert 背景与 Escape 关闭；浮动工具条含缩放控件、当前比例与 fit；键盘焦点循环遍历五个按钮 |
| 渲染 | 复制 SVG 到 **shadow root**，使 Mermaid 内嵌选择器与 fragment ID 只作用于副本；Panzoom 变换一个视口尺寸画布，初始与每次 resize 都 fit 整图且不超过自然尺寸 |
| 生命周期 | 路由、语言、主题、源 SVG 替换都会关闭当前视图；资源归挂载中的主题所有 |
| 已知缺口 | Agent Note 明示：**DOM 测试 mock 了 Panzoom，不执行浏览器布局**；原生 modal 行为、SVG marker、指针锚定缩放、画布拖拽、主题配色与窄屏几何需要真实浏览器验证，录制的演示**不是**自动化回归 |
| 新依赖 | 站点新增 Panzoom 直接依赖 |

### 8.4 归档会话恢复页

| 提交 | 内容 |
|---|---|
| `5f773a0ded` | `feat(workspace): restore archived sessions from a settings page` |
| `ae34320a5b` / `76941d0085` | 导航行与 unarchive 动词测试 / 陈旧应答不覆盖最新归档集 |

| 维度 | 内容 |
|---|---|
| 新包 | `@deepseek-ai/dsh-client-ui-settings-unarchive-sessions` |
| 注册 | 一个本地化 `settings.section` 贡献，id `archived-sessions`，nav order 25；并入既有 Settings 导航（General / Models / Plugins） |
| 页面行为 | 归档集 × 已加载会话摘要求交；最新归档在前；显示所属 Workspace 标题或未分组标签 + 相对最后活动时间；按标题或 Workspace 名过滤；每行一个 Unarchive 动作 |
| 缺失条目 | 摘要未加载的归档 id **不产生行**，页面因此报「集合不可用」而非「空归档」；被拒绝的写记入 console 诊断并保留该行以便重试 |
| 幂等 | 重复恢复与「从未归档」的 id 都不写盘、不发变更 |
| 无新帧类型 | 复用既有 `{ type: 'archived', archivedSessionIds }` 完整集增量；远端应答只有在仍是最新请求时才安装 |

### 8.5 composer 引用预览

提交：`11d6bd05f3`（`feat(web): preview file and skill references in the sidebar`）、`ca2a9017ef`（已交付文件链接预览）、`597f0f8f1f`（引用高度与基线对齐）。

| 维度 | 内容 |
|---|---|
| 归属 | `ui-input-trigger`（源）拥有可选引用激活；`ui-conversation`（composer）共享引用 hover 样式；`ui-chat`（Chat 目标）打开文件路径 |
| 行为 | 文件芯片与技能 token 各有编辑语义，但都有可识别预览手势；**点击不序列化、不提交草稿**；无效芯片、选择手势与不可用源目标保留编辑器处理 |
| 技能 | 技能发现保留胜出 provider 的**可选** instruction-file 路径，避免加载正文或按技能名/目录约定猜测；虚拟技能仍可调用，只是没有文件预览 |
| 无持久化 | 预览路径是瞬态发现数据，绝不写入 Session 消息；技能插件用其既有的**按 Session 目录缓存**使其失效，未命中的点击等待共享目录抓取并保留其 Session 地址 |

### 8.6 连接指示器

提交：`626fa816a5`（`feat(sidebar): refine the connection indicator states and styling`）、`11ca8020cd`（单一重连标签 + 按可见性确认恢复）、`16e986548e` / `b044e45438`（测试与浏览器快照钉桩）。

| 维度 | rc.2 行为 | 0.1.6-alpha.1 行为 |
|---|---|---|
| 断线 pill | hover/focus 才把标签换成 **Reconnect now**，因此每种状态都要预留最宽标签的宽度 | **静态**显示重试图标（`IconRefreshOutline14`）+ 断线文案；hover 换标签与隐藏的宽度预留 span 全部删除 |
| 连接中 / 抖动 | 感叹号图标；亚秒级重试让 connecting pill 闪入闪出 | 旋转弧线 spinner；壳层持有 `CONNECTING_MIN_VISIBLE_MS`（800ms）最短可见时长 |
| 过渡 / 恢复确认 | 无过渡 | 外观与移除 150ms 淡入淡出（`prefers-reduced-motion` 关闭全部动画）；`RECOVERY_CONFIRMATION_MS`（2 秒）从恢复 pill **可见时**开始计时 |
| 标签 | — | 手动与自动重试读同一标签（`ConnectionController.emitState` 去重连续 `connecting`，壳层无法观测重试边界） |
| API 破坏 | — | `ConnectionIndicator` 的 `reconnectLabel` prop 与宽度预留 span 从 pre-stable API **移除**；唯一消费者 `ui-settings-general` 同提交更新 |

### 8.7 文档预览精修与文件树滚动位置

| 提交 | 内容 |
|---|---|
| `f210305689` / `adbe7e6395` / `f51addaa0d` | 图片适配、二进制与加载态精修 / PDF 页占位改用 skeleton 令牌 / 评审反馈修正 |
| `004dceed5e` | `feat(sidebar-files): restore the tree's scroll position across tab switches` |

| 缺陷（issue #3974） | 修复 |
|---|---|
| 图片按固有 CSS 像素渲染，宽图溢出并强制横向滚动 | 图片框随滚动器宽度 + 12px 内边距；图片 `max-width: 100%` + 8px 圆角；小图保持固有尺寸并居中 |
| viewer 下拉总追加纯文本回退，位图/PDF 也提供不可读的 "Plain text" | `DocumentPreviewDefinition` 新增可选 `binaryExtensions`；`register` 拒绝不在 `extensions` 中的项；`binaryDocumentPath` 判定后缀是否二进制，预览 owner 据此跳过纯文本回退；仅当有 ≥2 个候选时才渲染 viewer 菜单 |
| 无可渲染器的二进制容器落进纯文本读取器并报读错误 | owner 侧清单 `document/unviewable.ts` 给出**空状态**（路径头 + 文件类型图标 + 一行 `unsupportedFile`），且**从不发起读**；任何渲染器注册都优先于它 |
| 每个渲染器各自的加载文案与位置 | 统一 `LoadingIndicator`：仅图标、文案走 `aria-label`，渲染器文案统一 "Reading…"，等待期一律居中；未渲染的 PDF 页用 `--dsw-alias-bg-skeleton` 上的静态 3:4 占位块，无 spinner、无 shimmer |
| PDF 页被双重内缩压窄 | 移除 PDF body 与页内缩，页铺满窗格宽度 |
| 切换侧栏页签让文件树回到滚动顶部 | 树 store 新增 `scrollTop` 与 `scrolled` action；body 本地跟踪偏移，**仅在卸载时**提交一次（且仅当 owner signal 仍存活），重挂载时在 layout effect 中恢复 |

### 8.8 架构性重构

| 提交 | 内容 | 性质 |
|---|---|---|
| `0220ec4989` / `2477554471` / `f4dbec93df` | conversation 的 main panel / content / default views「先抽取组件」 | 机械拆分 |
| `8f5b1d71e3` / `0db88bd58d` / `41915703cc` | 三者各自「搬到独立模块」 | 模块搬迁 |
| `b5abe6cf29` / `218db70b75` | `refactor(web): isolate draft editor implementation without behavior changes` + 两阶段隔离设计文档 | **明确声明无行为变化** |
| `c0e8252afe` / `5541ae0d2d` | 移除仅 fixture 使用的 API 残留、把浏览器 fixture 换成 `RemoteMock` | 清理与测试线替换 |
| `3d6fa12a6d` / `f74ca1e266` / `627c0f741e` | `remote-mock` 类型化原生 mock 与控制流、流句柄中止修复、用原生 fixture 组装真实客户端 | 新测试基建 |
| `48d83eca66` / `c1504a2aa6` / `a475a65bed` | 共享 boot 与 transport 集成点、解析所属 Loader 实例、隔离客户端实例 | 生产导出为测试层让路 + 多实例隔离 |
| `eb2cb668a5` | `test(web): run fixture browser cases through Host` | 测试改走真实 Host |

**为测试层新增的产品导出**（Agent Note `2026-09-06-client-assembly-test-line.md` 明确列出）：

| 包 | 新增导出 |
|---|---|
| `client/connection` | `ClientTransportHooks.rpc?` 接受已解码的进程内载体，`fetch` 变可选；`installConnection(ctx, options)` |
| `client/hmr` / `client/modules` | `tearDownEntryFiber(entry)` / `parseDshClient`、`exactPackageSpecifier` |
| `client/web` | `bootClient`、`mountClient`（从 `AppWebEntry.run()` 抽出，`run()` 改为调用它们） |
| `api/gateway` | `carrierFailure`、`cancelledFailure` |

已知重复点（Agent Note 自陈）：`WEB_PROFILE_BUNDLES` 中的两个 `web` bundle 名与 launcher 的 `PROFILE_TEMPLATES.web` 重复，**没有任何检查把两者关联**，模板变更须手工同步。

### 8.9 桌面端与打包

| 提交 | 内容 |
|---|---|
| `fa7d5519f5` | `feat(desktop): run runtime host from asar` |
| `c917a4e0bd` | `feat(cli): force runtime resolution in pkg builds` |

`apps/desktop-host/src/index.ts` 的签名变化（完整 diff 可复核）：

```ts
export async function runDesktopHost(
  runtimeDir: string,          // 新增：Electron 应用提供的不可变 dsh 包目录
  projectDir: string,          // 活动/暂存的 Electron 桌面 profile
  writeResponse: (frame: Buffer) => Promise<void>,
  options: { allowLinkedPackages?: boolean } = {},
): Promise<DesktopHostController>
```

配套变化：`desktopPatches` → `desktopComposition`（返回 `{ installAnchor, profile, patches }`，越界校验从「只在 profile 内」放宽为「profile **或** runtime 内」）；新增 `createProfileResolutionGeneration()` 并把结果经 `await hostCtx.plugin(PluginPackages, { generation })` 以 runtime 模式装进 Node 解析器；`dshVersion` 与 `assetHandler` 改读 `runtimeDir`；CLI 参数变为 `npm start <runtimeDir> <projectDir> [--allow-linked-profile]`。

本版新增/更新的桌面决策记录（`apps/desktop` 77 文件的理由来源）：

- `2026-09-08-desktop-bundled-runtime-and-external-plugins` — 构建期一次性物化生产依赖图经 `extraResources/dsh` 分发；Electron 壳留在 ASAR；Host 与插件通过目录符号链接（Windows 用 junction）共享同一模块实例。
- `2026-09-09-desktop-immediate-window-and-direct-start` — Electron **先**建带本地 loading 页的主窗口，再做 profile 协调与 Host 启动；取消分阶段健康检查，直接启动真实 Host。
- `2026-09-09-desktop-in-place-profile` — 就地修改当前 profile，取消暂存 profile、激活日志、目录交换恢复与自动回滚；`desktop-packages-pending` 标记驱动重试。
- `2026-09-09-desktop-build-release-validation` — 描述符校验归**打包**所有；启动期不再仅因描述符不一致就拒绝。
- `2026-09-09-profile-resolution-generations` — launcher 默认 link 模式，打包可执行文件与 Electron Host 选 runtime 模式；`PluginPackages.replace()` 以一次引用替换发布完整可加后继。

### 8.10 chat 呈现默认值与 diff 上下文

| 提交 | 内容 |
|---|---|
| `3db1085da2` / `251ef01acf` / `24a4c88859` | 恢复 reasoning 默认折叠 / 撤销历史首 token 时间恢复 / 结算与重载计时测试 |
| `242410cf4b` / `f50309b5d9` / `53786d6415` | 上下文 diff 卡片渲染实际变更 / 限制比较工作量 / 回放测试 |
| `c31ac4fdfe` | `feat(web): gate agent preset selection behind a setting (#3870)` |

**chat 呈现**（Agent Note `2026-09-14-chat-presentation-defaults.md`）：Chat 每条 reasoning 行**默认折叠**，并保留读者的手动展开选择穿越后续输出与结算；结算时退役观察到的实时 chunk、从持久事件重建 reply 节点，**不从内嵌流恢复首 token 时间**——因此完成轮次的 TTFT 与解码速度在实时结算后与重开历史后**都不可用**。Trajectory 检查保留其展开默认值、录制计时、JSON 控件与 PTC 代码检查器；该决策「部分取代」Chat 呈现新增项，保留两份 note 各自理由。

**diff 卡片**（Agent Note `2026-09-14-web-diff-context.md`）：

| 维度 | 内容 |
|---|---|
| 问题 | 文件系统结果元数据携带的 before/after 片段**含未变化上下文**；把整段当作删除/新增会错误标注共享行并虚增计数 |
| 方案 / 超限回退 | Web primitive 用维护中的 `diff` 库派生行级补丁，`maxEditLength: 256`；每个精确变更含最多三行中性上下文，远距离变更分成独立 hunk，共享上下文不计入任何一方总数；每片段超过 256 增删即停止搜索，把完整旧/新片段按**粗粒度整体替换**渲染（共享行计入显示、复制与计数） |
| 归属 / 代价 | 仍是 Client 呈现，属 `2026-08-23-client-derived-tool-presentation.md` 决策之下，不改持久化元数据与公开 props；浏览器构建**包含 `diff`**，界限限制的是编辑图搜索而非墙钟时长 |
| 测量（本机 macOS ARM64 / Node 26.5.0，ms） | 完整替换 10000 行：无界 6492/6778/6787 → 有界 5.25/4.66/4.19；交替重复行：3383 → 10.26/7.46/5.52；100 处稀疏替换：8.19/4.58/4.01 → 7.58/4.26/4.13（100 处全部保留） |

### 8.11 新增闸门：Web 产品 bundle 隔离

- **提交**：`8f14f98a1a ci(web): verify composed profiles, live registries, and bundle inputs`
- **脚本**：`scripts/web-product-bundle-isolation.ts`（`WebProductBundleIsolation`）+ `scripts/bundle-input-isolation.ts`（`BundleInputIsolation`）
- **动机**（Agent Note `2026-09-12-default-product-experimental-isolation.md`）：公开 npm 可用性**不等于**该包属于默认产品；直接查 manifest 会漏掉依赖别名、传递安装路径、仅开发期声明的运行时导入，以及**由配置加载的插件**。发布 smoke 会把所有 tarball 一起装，因此消费者目录里出现实验包并不能说明默认产品需要它。
- **机制**：`BundleInputIsolation.assertInput` 拒绝任何 npm 前缀为 `@deepseek-ai/dsh-experimental-*` 或物理位于 `packages/experimental` 的输入；`WebProductBundleIsolation.verify` 从**实际 Vite 输出的 `index.html`** 出发，沿 chunk、动态导入、worker、CSS 依赖与资产边遍历，要求每个可达输入都有非实验归属与构建输入记录。
- **失败即断言**：缺模块记录、缺资产原始文件、缺 CSS transform 输入、`index.html` 无可达模块等都直接 throw；**Web 构建失败就不可能产生成功的完整客户端构建记录**。
- **姊妹检查**：`verify-default-product-isolation`（静态 CI + package hygiene）、`apps/cli` 的 Host 启动 smoke、`apps/web/tests/default-product-isolation.e2e.ts`（Chromium 侧读真实 Client Loader/registry/模块缓存）。
- **与发布策略区分**：实验包**发布**策略由 `scripts/experimental-package-policy.ts` 的 `PRIVATE_EXPERIMENTAL_PACKAGE_DIRECTORIES` 独立拥有；该 denylist 目前为空，即所有当前实验包都发布。

---

## 9 变更速查表

| 面 | rc.2 | 0.1.6-alpha.1 | 量级 |
|---|---|---|---|
| 客户端包目录 / Host 包目录 | 51 / 8 | 53 / 8 | +2 / 冻结（Host `src` 仅 `directory-picker-auto/src/index.ts` 改动） |
| 浏览器入口 | 6 行 | 6 行（逐字节相同） | 0 |
| 侧栏终端 | 无 | `ui-sidebar-terminal` + `api/terminal-controller` + `terminal` Remote 命名空间 | 新能力 |
| 归档恢复 | 只能手工改 domain state | 设置页 + `unarchiveSession` 动词 | 新能力 |
| 引用预览 | 无 | 文件芯片与技能 token 可预览到右侧栏 | 新能力 |
| 连接指示器 | hover 换标签 + 宽度预留 | 静态重试图标 + 800ms 最短可见 + 150ms 淡入淡出 | 破坏性 API 变更 |
| 文档预览 / 文件树 | 图片溢出、纯文本回退污染、多套加载态；切页签回顶部 | 宽度自适应 + `binaryExtensions` + 统一 loading + 空状态；卸载时提交偏移、重挂载恢复 | 精修 |
| 整客户端测试 | 手搭 bench | 真实 roster + `RemoteMock` | 测试架构变更 |
| 实验包隔离 | 无构建期检查 | `web-product-bundle-isolation` + `bundle-input-isolation` | 新闸门 |
| Mermaid 全屏 | 无 | 站点主题内置查看器（shadow root + Panzoom） | 新能力（文档站） |
| 桌面运行时 | profile 内解析 | runtime（asar）+ profile 双目录，runtime 模式解析 generation | 架构变更 |

## 10 未核实与边界

- `packages/client` 512 个变更文件的逐文件归属：仅核对 §3.4 的按包文件数与 §8 引用的具体提交，**未逐文件核对**。
- 本版 `ui-*` 插件总数（rc.2 文档所称 47）：**未核实**。本版 `git ls-tree -d` 得 53 个客户端包目录，与 rc.2 文档口径不同源，计数标准可能不一致，本篇不沿用旧口径。
- Mermaid 查看器的真实浏览器回归：Agent Note 自陈为**覆盖缺口**（DOM 测试 mock Panzoom，不执行布局；录制的演示不是自动化回归）。
- 侧栏终端 Host 重启后进程恢复：非缺口而是设计——Host 重启不恢复进程，重新加载只恢复 Host 保留的终端。
- 桌面端签名/公证/GUI 装机验收：Agent Note 归**发布环境**资格项，单元 fixture 不能替代。

---

*文档生成时间: 2026-09-17*
*数据源: dsh-v0.1.6-alpha.1 (0a15e36e7f) vs dsh-v0.1.5-rc.2 (fb2c4b9e69)*
