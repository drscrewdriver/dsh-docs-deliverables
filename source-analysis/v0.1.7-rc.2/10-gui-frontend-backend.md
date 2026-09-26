# 【第 10 篇】packages/client · web · apps/web · apps/desktop：GUI 与桌面端

> **基线说明**：本篇为 v0.1.7-rc.1 全量分析基线，rc.2 未改动本篇覆盖的系统性结构。v0.1.7-rc.2 的增量变更（约 335 个提交）请见同目录 `README.md` 与 `diff-vs-0.1.7-rc.1.md`。

> **版本**：dsh-v0.1.7-rc.1（`46a7f68b09`），对比上版 dsh-v0.1.6-alpha.1（`0a15e36e7f`）
> 难度：🟡 进阶
> 包范围：`deepseek-harness/packages/client/` 下 59 包、`packages/web/` 下 6 包、`apps/web`、`apps/desktop`、`apps/desktop-host`
> 上游文档：`docs/subsystems/web-client.md`、`web-server.md`、`slots.md`、`sidebar-right.md`、`conversation.md`、`client-modules.md`、`client-resources.md`、`voice-input.md`、`docs/web-styling.md`

## 目录

- [引言](#引言)
- [概述](#概述)
- [核心概念](#核心概念)
- [包结构](#包结构)
- [关键类型](#关键类型)
- [数据流](#数据流)
- [测试覆盖](#测试覆盖)
- [与上下游的关系](#与上下游的关系)
- [本版本变更要点（0.1.6-alpha.1 → 0.1.7-rc.1）](#本版本变更要点016-alpha1--017-rc1)
- [附录：本版提交与 Note 索引](#附录本版提交与-note-索引)

---

## 引言

本篇覆盖 DSH 的**浏览器前端与桌面端**：`packages/client/`（59 个客户端包）、`packages/web/`（6 个 Web 工具/检索包）、`apps/web`（Vite 前端宿主）、`apps/desktop`（Electron 主进程 + 渲染器）、`apps/desktop-host`（Electron 内的私有 Node 宿主进程）。

这是本版**变更量最大的区域**。用 `git diff --stat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1` 建立量化基线，五个目录合计 **2261 个文件变更、+135679 / -32153 行**：

| 范围 | 文件数 | 新增行 | 删除行 | 区间提交数 |
|---|---|---|---|---|
| `packages/client` | 1521 | +88034 | -22735 | 1149 |
| `apps/web` | 300 | +14094 | -4130 | 808 |
| `apps/desktop` | 414 | +32879 | -4268 | 324 |
| `apps/desktop-host` | 12 | +550 | -833 | 43 |
| `packages/web` | 14 | +122 | -187 | 12 |
| **合计** | **2261** | **+135679** | **-32153** | — |

（命令：`git diff --stat|--numstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- <path>`；
提交数：`git log --oneline dsh-v0.1.6-alpha.1..dsh-v0.1.7-rc.1 -- <path> | Measure-Object -Line`。）

`packages/client` 的 1521 个变更文件按状态拆分为 **A 528 / M 930 / D 37 / R 26**（`git diff --name-status ... | Group-Object { $_.Substring(0,1) }`）。包集合本身从 **53 个** 增至 **59 个**（`git ls-tree -d --name-only <tag> packages/client/ | Measure-Object -Line`）：

- **新增 7 包**：`ui-plugin-manager`、`ui-sidebar-browser`、`ui-settings-account`、`ui-settings-agent-loop`、`ui-settings-shell`、`ui-settings-subagent`、`ui-settings-web-search`；
- **删除 1 包**：`ui-settings-unarchive-sessions`（在 rc.1 中 `git ls-tree -r --name-only dsh-v0.1.7-rc.1 packages/client/ui-settings-unarchive-sessions` 返回空；磁盘上残留的 `lib/`、`node_modules/` 是未跟踪的构建产物）。

---

## 概述

客户端栈是"**宿主权威、客户端投影、渲染纯展示**"的三层结构（`packages/client/AGENTS.md` 的 "Layering red lines"）：

1. **数据对象层（React-free）**：`client/connection` 管传输世代，`api/session-controller/client` 管 `ClientSessions → SessionManager → Session`，`api/workspace-controller/client` 管 Workspace 状态，`client/store` 提供快照 store 引擎。store 产物是裸 observable，不带 hook。
2. **渲染机件层**：`ui-renderer` + `ui-slots` 承担全部 ctx→React 集成（slot 渲染/outlet、`SessionProvider`、uSES 适配器）。
3. **展示组件层**：各 UI 插件包的 `src/client/`，纯 props；业务逻辑不得渗入。

本版客户端可归纳为**五条主线**：

1. **侧栏（right Sidebar）从"预览器"升级为"可停靠浏览器工作台"**——新增 `ui-sidebar-browser` 包、`keepMounted` 保活语义、稳定 tab 挂载布局、按需文件/目录监听与自动刷新（4 篇 Agent Note）。
2. **会话引用（SessionReference）取代全局"当前会话"**——`ClientSessions` 从"投影选中列表状态"改为"持有引用与来源计数、不选全局当前会话"（`2026-09-15-client-session-references`）。
3. **会话分组成为框架级扩展点**——`ctx.uiConversation.groups.register()` + `ConversationGroupDefinition`（`2026-09-21-conversation-build-groups`）。
4. **会话行操作开放为客户端插件席位**——`ui-workspace` 把"…"菜单与悬停按钮降级为两个 `list` slot，自己的 `pin/rename/fork/archive` 也按插件路径注册（`2026-09-17-session-row-menu-actions-slot`）。
5. **桌面端进入"可发布产品"阶段**——强制更新、Windows 原生安装器页、Windows/macOS 自定义标题栏、主运行时载荷、Electron webview 浏览器、致命诊断与崩溃报告（9 篇 Agent Note）。

同时，官方子系统文档在区间内同步更新：`web-client.md`（+12/-9）、`web-server.md`（+72/-0）、`slots.md`（+25/-12）、`sidebar-right.md`（+18/-12）、`conversation.md`（+33/-6）、`client-modules.md`（+22/-15）、`client-resources.md`（+2/-1）、`web-styling.md`（+2/-1）。**`docs/subsystems/web.md` 在区间内无变更**（`git diff --name-only` 返回空）——这点与任务简报中"web.md 的区间变更"的预设不符，特此更正。

---

## 核心概念

| 术语（首次出现附英文） | 含义 | 本版是否受影响 |
|---|---|---|
| Slot（席位） | 父级声明的扩展位置；祖先声明子 slot，其他插件注册进该位置 | 未变（新增两个具体席位） |
| Component Factory（组件工厂） | 与 Slot **所有权方向相反**的可复用装配：定义方声明工厂，任意父级渲染 occurrence 并自选局部 Component | **本版新增** |
| `SessionReference` | 对"一次使用、一个确切世代"的所有权句柄，暴露 `sessionId`/`binding`/`ready`/`release()`/[Symbol.dispose] | **本版新增** |
| `SessionTarget` | 已知 `SessionId` 或持久化直系父 `SubagentAddress`；只标识要获取什么，不拥有任何东西 | **本版新增** |
| reference source（引用来源） | 消费方自定义的使用标签（如 `mainView`、`sidebarView`、`gateway`）；是使用标签，不是第二个会话地址 | **本版新增** |
| `retainedBy` | 会话列表行上的只读投影：来源键 → 正引用计数 | **本版新增** |
| Group Definition（分组定义） | 业务包注册的、以**已物化 Node** 为输入的分组规则；拥有成员、切分、摘要与增量缓存 | **本版新增** |
| `NodeReference` / `GroupReference` | 根序列中的两种引用；均为 branded key，靠 `kind` 区分 | **本版新增** |
| `keepMounted` | tab type 定义上的可选惰性保活：首次显示时创建 body，隐藏后存活至 occurrence/provider 结束 | **本版新增** |
| `retained page`（保活页） | 隐藏/切换/停靠期间 DOM 祖先保持连接且不变的内容 | **本版新增** |
| `ArchivedFilter` | 侧栏归档过滤：默认隐藏 / 显示 / 仅归档 | **本版新增** |
| 强制更新（mandatory update） | 独立于业务流量的策略轮询；`40005` 建立阻断，仅"有效新 no-force 响应"可解除 | **本版新增** |
| 崩溃报告（crash report） | 致命失败落盘的 owner-only 文件，含 source/版本/完整 inspected error/控制台尾部 | **本版新增** |

---

## 包结构

### packages/client（59 包，按功能域归类）

下表按职责域合并，不做逐包流水账。改动量列取自 `git diff --numstat` 的 `+add/-del`（0 表示本包在本版区间内无变更，或仅有版本号变更）。

| 功能域 | 包 | 职责 | 本版改动规模 |
|---|---|---|---|
| **传输与引导** | `connection` | `/api` 载体、信任校验、精确 Fetch 路由、连接世代、请求 URL 解析 | +801/-82 |
| | `modules` | 客户端模块图、combo 脚本/源映射路由、`ClientModuleRegistry` | +2041/-241 |
| | `hmr` | 运行图快照推送与重建通知 | +245/-222 |
| | `web` | `PLATFORM_MODULES` 静态基线、Vite 入口种子 | +249/-35 |
| | `store` | 快照 store 引擎（`defineStore`/`createSnapshotStore`/`shallowEqual`） | +5/-6 |
| | `resources` | `ctx.resources`、`useResource`、资源协议→值映射 | +22/-14 |
| | `file-upload` | 上传 worker 与 Fetch 载体 | +52/-54 |
| | `locale` | 客户端本地化字典装载 | +476/-135 |
| **Slot / 渲染机件** | `ui-slots` | `SlotMap`、`SlotFactoryMap`、`registerFactory`、`useFactorySlot` | +713/-71 |
| | `ui-renderer` | slot 渲染器/outlet、`SessionProvider`、uSES 适配、occ 记账 | +1868/-314 |
| | `ui-layout` | AppFrame、列布局、`shell.leading`/`shell.overlay` 窗口 chrome | +507/-69 |
| | `ui-theme` | `--dsw-*` 令牌、菜单材质、上升面规范 | +666/-244 |
| | `ui-primitives` | 无 Cordis 依赖的基础控件目录（本版新增 `SegmentedControl` 等） | +8270/-1675 |
| **Session / 对话数据** | `ui-session` | Session scope 适配器；`useSessions`/`useSessionStatus`/`useSessionRetainInfo`/`useProjection` | +736/-288 |
| | `ui-conversation` | 事件/视图/**分组**注册表、assembler、Location 索引、GroupStore | +4323/-1353 |
| | `ui-chat` | Chat 目标包：turn rail 虚拟化、阅读/导航 owner、分组业务规则 | +9746/-2605 |
| | `ui-trajectory` | Trajectory 目标包 | +507/-286 |
| | `ui-subagent` | 子代理目录、`subagentchat` 资源与共享 Conversation Factory | +1341/-666 |
| **输入与提交面** | `ui-input-trigger` | 输入触发控制器（`/`、`@` 等） | +266/-92 |
| | `ui-commands` | 斜杠命令面板 | +355/-179 |
| | `ui-attachment` | 附件编辑与展示 | +223/-216 |
| | `ui-reference` | 引用 chip | +229/-46 |
| | `ui-model-selection` | 模型/推理强度选择 | +579/-156 |
| | `ui-permission-presets` | 权限预设 | +118/-176 |
| | `ui-user-questions` | 人机问答 | +212/-158 |
| | `ui-approval` | 审批面板 | +27/-27 |
| **右侧栏与文档** | `ui-sidebar` | 左导航栏（本版含 macOS 顶部条、折叠宽度） | +723/-74 |
| | `ui-sidebar-right` | 停靠面、tab type 契约、`ctx.sidebarRight` 导航、undo/menu | +1455/-228 |
| | `ui-dockkit` | 分屏/浮动布局引擎与纯 planner | +791/-240 |
| | `ui-sidebar-documentpreview` | `text` tab：文档预览、渲染器注册表、自动刷新 | +8045/-862 |
| | `ui-sidebar-files` | `files` tab：按需列目录树 + 目录级 watch | +1300/-242 |
| | `ui-sidebar-browser` | **新包**：`browser` tab、iframe/Electron 双载体 | +3491/-0 |
| | `ui-sidebar-terminal` | `terminal` tab | +248/-183 |
| | `ui-open-in-app` | 用默认应用/文件管理器打开（两个新 slot 的填充者） | +1321/-456 |
| **工作区与导航** | `ui-workspace` | Workspace 浏览、行操作 slot 列表、pin/archive/fork/rename | +6756/-1432 |
| | `ui-directory-picker-browse` | 页内目录选择器 | +20/-20 |
| | `ui-directory-picker-native` | 原生目录选择器 | +129/-32 |
| **工具与结果呈现** | `ui-tool` | 工具卡片、结果呈现、Cordis 视图 | +3005/-609 |
| | `ui-deliverables` | 交付物卡片 | +3027/-698 |
| | `ui-plan` | 计划 chip 与审阅 | +1319/-68 |
| | `ui-jobs` | 后台作业列表与输出面板 | +1339/-318 |
| | `ui-schedule` | 定时任务呈现 | +46/-55 |
| | `ui-goal` | 目标呈现 | +176/-60 |
| | `ui-workflow-run` | Workflow 运行视图 | +117/-79 |
| | `ui-skill` | Skill 呈现 | +244/-83 |
| | `ui-message-feedback` | 消息反馈 | +77/-53 |
| **插件与配置** | `ui-plugin-manager` | **新包**：侧栏 Plugins 面板（安装/启停/重试/组合） | +8283/-0 |
| | `ui-settings` | 设置骨架、诊断视图与开发者工具偏好 | +631/-222 |
| | `ui-settings-plugins` | "Built-in plugins" 设置区：**只拥有导航入口与 tab 行**，每个 tab 由别的插件注册（本版删掉全部配置卡片） | +123/-4447 |
| | `ui-settings-plugin-inventory` | 插件清单 | +505/-91 |
| | `ui-settings-models` | 模型设置 | +1572/-597 |
| | `ui-settings-general` | 通用设置（本版新增版本号显示） | +971/-201 |
| | `ui-settings-agent-loop` | **新包**：agent-loop 设置页 | +720/-0 |
| | `ui-settings-shell` | **新包**：shell 执行器设置页 | +870/-0 |
| | `ui-settings-subagent` | **新包**：子代理委派设置页 | +2460/-0 |
| | `ui-settings-web-search` | **新包**：DeepSeek Web 搜索设置页 | +1100/-0 |
| | `ui-settings-account` | **新包**：DeepSeek 登录与 Platform 账单入口 | +2334/-0 |
| | `ui-agent-preset` | Agent 预设编辑 | +1867/-2736 |
| | `ui-brand-official` | 官方品牌资源 | +6/-6 |
| ~~`ui-settings-unarchive-sessions`~~ | **本版删除**（14 文件 / -906 行），职责并入侧栏 `ArchivedFilter` 与行操作 | -906 |

### packages/web（6 包）

| 包 | 职责 | 本版改动规模 |
|---|---|---|
| `web` | Web 检索/抓取的服务定义与服务面 | +6/-6（仅 `package.json`） |
| `tool-web` | `web_search` / `web_fetch` 工具 | +22/-21（`package.json`）+ 测试微调 |
| `web-fetch-http` | HTTP 抓取提供者 | +10/-10（仅 `package.json`） |
| `web-search-deepseek` | DeepSeek 搜索提供者（**本版是唯一有源码变更的包**） | `src/index.ts` +28/-34、`tests/settings.spec.ts` +6/-63、`tsconfig.json` -3、README 双语各 ±4 |
| `web-search-exa` | Exa 搜索提供者 | 仅 `package.json` |
| `web-search-perplexity` | Perplexity 搜索提供者 | 仅 `package.json` |

该组本版实质动作是**为新增的 `ui-settings-web-search` 客户端设置页让路**：`web-search-deepseek` 的 `tests/settings.spec.ts` 删掉 63 行（设置 UI 断言迁往客户端包），`tsconfig.json` 删除 3 行。

### apps/

| 应用 | 标识 | 职责 | 本版改动规模 |
|---|---|---|---|
| `apps/web` | `@deepseek-ai/dsh-web-frontend` | Vite 前端宿主，`src/main.ts` / `preview.ts` / `node-module-stub.ts`；注入 `window.__DSH_BOOT__` | 300 文件 +14094/-4130（新增 e2e 场景为主） |
| `apps/desktop` | `@deepseek-ai/dsh-desktop` | Electron 主进程 + preload 群（11 个 preload）+ 欢迎窗 + 更新协调器 + 强制更新窗 + NSIS 安装器 + 原生 helper | 414 文件 +32879/-4268 |
| `apps/desktop-host` | `@deepseek-ai/dsh-desktop-host` | "Private Node-mode host process for the Electron desktop application" | 12 文件 +550/-833（净收缩） |

`apps/desktop/src` 本版新增/关键文件（`Get-ChildItem apps/desktop/src`）：
`mandatory-update-policy.ts`、`mandatory-update-window.ts`、`mandatory-update-ipc.ts`、
`crash-report.ts`、`fatal-recovery.ts`、`browser-guests.ts`、`windows-layout.ts`、`platform-view.ts`、
`update-coordinator.ts`、`update-journal.ts`、`update-http-executor.ts`、`update-attention.ts`、
preload 侧：`preload-app.ts`、`preload-browser.ts`、`preload-mandatory.ts`、`preload-mandatory-overlay.ts`、
`preload-menu.ts`、`preload-platform.ts`、`preload-platform-account.ts`、`preload-theme.ts`、
`preload-update-dialog.ts`、`preload-welcome.ts`、`preload-windows.ts`。

`apps/desktop-host` 本版**净删除 833 行**：`src/wire.ts` 删除 184 行、`config/desktop.cordis.patch.yml` 删除 34 行、`src/index.ts` +82/-590；同时新增 `src/office-engine.ts`(+44)、`src/office.ts`(+38)、`src/platform-session.ts`(+36)、`src/update-tasks.ts`(+51) 与三个对应 spec。这对应 `2026-09-19-remove-desktop-profile-core-cleanup`（把 desktop profile 的 core 清理移出 desktop-host）。

---

## 关键类型

### A. 会话引用的所有权 API

`2026-09-15-client-session-references` 引入的核心类型。官方 `docs/subsystems/web-client.md` 本版把 `ClientSessions` 的描述从"owns Session scopes … projects the selected list state"改为"owns references, source counts, Session scopes … **projects catalog state without selecting a global current Session**"。

```ts
// 语义摘自 .agents/notes/implemented/architecture/2026-09-15-client-session-references.md
interface SessionRetainOptions {
  source: SessionReferenceSource   // 必填；消费方自定义，可声明合并扩展
  signal?: AbortSignal             // 可选
}

type SessionTarget = SessionId | SubagentAddress   // 已知 id，或持久化直系父地址

interface SessionReference {
  readonly sessionId: SessionId
  readonly binding: SessionBinding          // release / 世代销毁后读取即失败
  ready: Promise<SessionBinding>            // 共享首次历史打开；解析即"该次 open() 已结算"
  release(): void                           // 幂等
  [Symbol.dispose](): void                  // using 语法释放
}
```

| API | 结果与调用方义务 |
|---|---|
| `sessions.retain(target, options)` | 返回 `SessionReference`，**立即返回**；调用方拥有引用直到 release |
| `sessions.using<T>(target, options, operation)` | 等 `reference.ready` → 执行 `operation(reference)` → 释放 → 返回结果 |
| `sessions.sessionOf(ctx)` | 返回匹配的活 Session face 或 `undefined`；已结束的 Context 不解析为同 id 替代品 |
| `sessions.retainInfo(id)` | `SessionRetainInfo { referenceCount, retainedBy }`；跨同 id 世代替换稳定 |
| `useSessionRetainInfo(sessionId, selector)` / `useSessionRetainInfo(selector)` | `ui-session` 暴露的两个形态；未绑定 scope 时后者给 absence |

`retainedBy` 是**只读投影**：`{ mainView: 1, gateway: 2 }` 表示主视图与两个 Host 调用共持 3 个引用；释放主视图引用只移除 `mainView`。`current` 标记等价于"`mainView` 来源计数为正"。这些计数**既不持久化也不发往 Host**。

统一 UI 状态由 `ui-session` 的 React-free `sessionStatus` 源提供（`useSessionStatus`），它把三个独立事实**并列**而非折叠为互斥阶段：

| 字段 | 值 | 语义 |
|---|---|---|
| `running` | `boolean \| undefined` | 最新已知运行事实；**基线缺失不等于确认空闲** |
| `pendingInteraction` | `SessionPendingInteraction \| undefined` | 有效的域属主请求 |
| `completionUnread` | `boolean` | 已观察到停止但未确认的 UI 提醒 |

完成提醒的更新规则（同 Note）：初始 idle 基线**不**产生提醒；观察到 running 清除旧提醒；running→idle 且**无 mainView 所有权**时才置位；取得 mainView 所有权清除提醒，无关来源的 retain 不清除；释放 mainView 不为人事前的停止制造提醒。

### B. 会话行操作席位（客户端插件扩展点）

这是本版给插件作者的**最直接可用的客户端席位**。`ui-workspace` 在 `sidebar.workspaces` 注册下声明两个 root 作用域的 `list` slot，源码位于 `packages/client/ui-workspace/src/client/index.ts:255-278`：

```ts
children: {
  'sidebar.workspaces.directoryFlow': { kind: 'single', scope: 'root' },
  // 每个行条目通过该行渲染 occurrence 绑定的 hook 读取菜单开合状态
  'sidebar.workspaces.session.menu.item': {
    kind: 'list', scope: 'root', inject: { hooks: { menuOpenState: menuOpenStateFactory } },
  },
  'sidebar.workspaces.session.row.action': { kind: 'list', scope: 'root' },
},
```

出厂条目走**与插件完全相同的路径**注册（同文件）：

```ts
ctx.slots.inject('sidebar.workspaces.session.menu.item', function* () {
  yield ctx.slots.register({ name: '…menu.item', id: 'pin',     order: 100, locale: NS, inject: pinInjected },     PinSessionMenuItem)
  yield ctx.slots.register({ name: '…menu.item', id: 'rename',  order: 200, locale: NS, inject: renameInjected },  RenameSessionMenuItem)
  yield ctx.slots.register({ name: '…menu.item', id: 'fork',    order: 300, locale: NS, inject: forkInjected },    ForkSessionMenuItem)
  yield ctx.slots.register({ name: '…menu.item', id: 'archive', order: 400, locale: NS, inject: archiveInjected }, ArchiveSessionMenuItem)
})
ctx.slots.inject('sidebar.workspaces.session.row.action', function* () {
  yield ctx.slots.register({ name: '…row.action', id: 'archive', order: 100, … }, ArchiveSessionRowButton)
  yield ctx.slots.register({ name: '…row.action', id: 'pin',     order: 200, … }, PinSessionRowButton)
})
```

契约（`packages/client/ui-workspace/src/client/contract/slots.ts:133-148`）：

| slot | 基数/作用域 | owner props | slot 级注入 |
|---|---|---|---|
| `sidebar.workspaces.session.menu.item` | `list` / `root` | `SessionRowOwnerProps` = `{ sessionId, displayTitle }` | `hookContext: MenuOpenState` + `inject.hooks.menuOpenState` |
| `sidebar.workspaces.session.row.action` | `list` / `root` | `SessionRowOwnerProps` | 无 |

**确切注册 API**（`packages/client/ui-workspace/README.md:143-154`）：

```ts
export const inject = ['slots', 'locale']

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'acme-session-actions: dictionaries')
  ctx.slots.inject('sidebar.workspaces.session.menu.item', () => ctx.slots.register({
    name: 'sidebar.workspaces.session.menu.item',
    id: 'acme.export-session',   // 建议包名命名空间
    order: 500,                  // 出厂 archive=400，故落在其后
    locale: NS,
    inject: (): ExportRowInjected => ({ exportSession }),
  }, ExportRow))
}
```

三条约束必须记牢（同 README）：

1. `ctx.slots.inject()` **是必需的**，即便 owner 通常在场——它等待声明、在声明折叠时移除贡献、恢复后重注册；裸 `slots.register` 进未声明 slot 是错误。
2. 条目**只收到** `{ sessionId, displayTitle }`，其余全部自持：它通过自己 `inject` face 注入的 hook（如 `usePinned`/`useArchived`）读取所需 Host 状态，并**自行决定可见性**（pin 在归档行不渲染，因为 Host 保证两集合互斥）。
3. 菜单行必须渲染一个 `role="menuitem"` 的 `<button>` 并通过注入的 `useMenuOpenState()` 关闭菜单；`Menu` 的键盘游走、子菜单互斥与焦点回归**读 DOM**，因此任何符合该角色的按钮自动加入。悬停按钮渲染一个图标按钮即可，点击已隔离在按钮条内，无需阻止冒泡。

序位语义：列表按 `order` 升序渲染；以另一个 `priority` 复用出厂 `id` 会通过注册表的普通 cell 规则**遮蔽**该动作；没有独立的"扩展分组"，分组起始就是条目自己的 `separatorBefore`。

### C. Component Factory 与本地席位

`registerFactory()` / `renderFactorySlot()` / `useFactorySlot()` 由 `ui-slots` + `ui-renderer` 提供（`packages/client/ui-slots/src/index.ts`）。本版新增，`git log --diff-filter=A -1 -- .agents/notes/implemented/architecture/2026-09-10-component-factories-and-local-slots.md` → `c094b663fb feat(client): add reusable component factories`（2026-09-17），且 `git merge-base --is-ancestor c094b663fb dsh-v0.1.6-alpha.1` 退出码为 1（基线不含此提交）。**注意**：文件名日期 `2026-09-10` 早于其落地提交日期，故不能据文件名判断归属版本。

```ts
// packages/client/ui-slots/src/index.ts:36-45（SlotFactoryDef，声明合并进 SlotFactoryMap）
interface SlotFactoryDef {
  scope: SlotScope
  props?: object
  children?: ChildrenDecl
  store?: StoreDecl
  inject?: object
  locale?: keyof LocaleNamespaceMap & string
  slots?: Record<string, { scope: SlotScope; props?: object }>   // 调用方可选的局部 Component
}
```

| 属性 | 普通 Slot | Component Factory |
|---|---|---|
| 首次声明 | 父级声明子 slot | 定义方声明 Factory |
| 后续操作 | 子级注册进父位置 | 父级渲染 occurrence |
| 静态权威 | `SlotMap` 描述位置 | `SlotFactoryMap` 描述完整定义 |
| 活定义 | 多个条目可占 cell | 一个名字只有一个活定义 |
| 父级输入 | `renderSlot()` owner + keyed props | `renderFactorySlot()` occurrence props |
| 父级自选 Component | 注册表路由选条目 | 调用方为每个局部 slot 选一个 Component |
| 后代扩展点 | 条目自有的普通 `children` | 定义自有的普通 `children` |

本版首个落地用例（同 Note "First shipped use"）：`ui-conversation` 注册 **optional-Session** 的 `conversation.content` Factory，包住共享 body 与 Composer；其 strict-Session 的 `views` 局部位默认渲染既有的 `conversation.session` Slot，另一个 occurrence 可换一个视图 Component 而**不挂载主 Conversation Header**。`packages/client/ui-conversation/src/client/apply.ts:269` 是注册点。

类型与运行时强制（同 Note）：类型链拒绝未知 Factory 名、缺失/多余 occurrence props、与 `SlotMap` 不一致的子声明、与 `SlotFactoryMap` 不一致的定义字段、嵌套 store 工厂、未知局部名、不兼容的被选 Component，以及 input/registration/injection/scope props 的所有权重叠。运行时检查覆盖动态装配与纯 JS 调用方。

### D. 会话分组协议

`ctx.uiConversation.groups.register(definition)`（`docs/subsystems/conversation.md` 新增 `<a id="group-definitions">` 节）：

| 类型 | 含义 |
|---|---|
| `ConversationGroupDefinition<Node, State, Data>` | `create()` 初始化 Session 局部 State；`update(context, input)` 返回下一 State；`buildGroups(context)` 返回待发布输出或 `null`。replace 输入要求 entries + 完整 group 替换 |
| `ConversationGroupInput<Node>` | `replace` 给目标顺序、时间线与**同步**的 `readNode`/`readTurn`/`readPosition` 读取器；`apply` 追加 projected `previous/current` Node 变更、生命周期 `changedTurns` 与 `changedTurnOrders`。**读取器只在同步调用期间有效，不得存入 State** |
| `GroupNodePosition` | 所属 Turn（若存在）+ 直接前/后可见 Node key；邻居信息保住了仅靠 Turn key 列表会丢掉的打断 |
| `NodeReference` / `GroupReference` | branded `NodeKey`/`GroupKey`，靠 `kind` 区分；Node 引用可选 `groupPart`，省略即整 Node |
| `GroupSnapshot<Data>` | 不可变的 group key、业务数据、有序 Node 引用；**组不能嵌套，也不拥有源 Node 数据** |
| `GroupUpdate<Data>` | `entries` 替换完整根序列（仅 apply 输入可省略以保留）；replace 输入要求 entries 与 `groups.replace` 同时给出 |
| `ConversationGroupDataMap` | 声明合并的目标→数据类型关联，注册与 `views.grouped(target)` 共用；未声明的目标没有 group payload 类型 |
| `ConversationGroupedView<Data>` | 稳定的根 `entries` 与 keyed `groupSource(key)`；被移除的组读作 `undefined` |

实现文件（`docs/subsystems/conversation.md` 与 Note 一致）：

| 层/文件 | 职责 |
|---|---|
| `packages/client/ui-conversation/src/client/contract/groups.ts` | Group 定义、输入、引用、更新、类型化数据映射与读取器 |
| `packages/client/ui-conversation/src/client/contract/conversation.ts` | 可选 Builder `groupInput`/`publish` 与 snapshot-store grouped reader |
| `packages/client/ui-conversation/src/client/conversation/group-registry.ts` | 目标唯一性、类型化注册、effect/disposer 生命周期 |
| `packages/client/ui-conversation/src/client/conversation/assembly.ts` | `UiConversation.groups` 与既有 binding 重建通知 |
| `packages/client/ui-conversation/src/client/conversation/assembler.ts` | 首次激活与普通 flush 的共同派发、context 所有权、安装与发布 |
| `packages/client/ui-conversation/src/client/conversation/location-index.ts` | 累积 changed Turns（含纯生命周期与 Location 数据写） |
| `packages/client/ui-conversation/src/client/conversation/group-store.ts` | 原子引用校验、keyed source、数组复用、局部发布 |
| `packages/client/ui-chat/src/client/conversation-nodes/chat-snapshot-builder.ts` | 记录 projected Node 增量、目标位置、changed Turn order；提供索引读取器并延迟源通知 |
| `packages/client/ui-chat/src/client/chat/ChatGroupSeat.tsx` | 稳定 group 父级、组内订阅、嵌套 Node seat |
| `packages/client/ui-chat/src/client/chat/ChatNodeSeat.tsx` | 既有 Node source/renderer、`groupPart` 转发、part 独立锚点 |

`GroupStore` 在改动前校验**整个提交结果**：根 Group 引用与记录一一对应、所有被引用 Node 存在、每个 `(NodeKey, groupPart)` 至多占一个根或成员位置；整 Node 不能与其任一 part 共存；重复 upsert、重复 remove、同时 upsert/remove 同一个组都失败。仅数据变更的 upsert 保留根与成员数组、不读 Node、只通知变化的 group source。

装配顺序（`docs/subsystems/conversation.md` 新增段与 Note "Assembly order and lifecycle" 一致）：物化 Location 数据与 Node → 更新 Builder → 调用 Group Definition → 校验并安装分组 → 发布所有受影响目标与 Location source。分组阶段**复用既有的发布节拍**，不新增定时器或事件订阅。

### E. 侧栏保活布局与 tab type 契约

`docs/subsystems/sidebar-right.md` 的 tab type 字段本版新增 `keepMounted`：

| 字段 | 含义 |
|---|---|
| `keepMounted` | 可选惰性保活：访问过的 body 跨隐藏、Session 切换与停靠存活；由**所属 View** 持有 Session 引用。策略不持久化，也不选择存储分区 |

`SidebarRightTabDefinition.keepMounted` 由 Desktop Browser 启用；其他类型仍按可见性挂载 body。`2026-09-20-sidebar-retained-tab-layout` 的布局归属：

- `DockLayout` 用**稳定 tab 兄弟**渲染侧栏的一或两个水平 pane；既有递归 `DockSurface` 与独立 `FloatLayer` 保留，布局引擎与序列化格式不变。
- 每个 tab 拥有稳定的 Grid cell、frame、Header 容器与 Body 容器；显式 Grid 列决定停靠位置，Flex 决定 Header/Body 高度。**浮动把同一 frame 改为 `position: fixed`，不改父级、不替换 Body。**
- 浮动 frame 的零尺寸 Grid cell 在 float 层建立层叠上下文；CSS `order` 表达浮动深度，DOM 顺序仍按 tab 身份排序（避免浮层数增长越过菜单/模态层）。
- 保留比较（同 Note "Retention versus recovery"）：切 tab = 隐藏旧 cell/显示目标已有 body；分屏/重排/换 pane = 改逻辑位置与 Grid 指派，**不移动 Body**；浮动/回停靠/抬升 = 改同一 frame 的 CSS 模式或 cell 绘制序；折叠侧栏 = 隐藏停靠 cell，前台浮层仍可见；**Session A → B → A = 隐藏/重显 A 的原树，而不是加载其保存 URL**。

---

## 数据流

官方 `docs/subsystems/web-client.md` 本版更新的路径表：

| 路径 | 序列 |
|---|---|
| 持久化会话显示 | Host Session log → packed Remote `follow`/`page` 历史 → Client `SessionEventLikeEntry` 窗口 → Conversation Contexts → 目标快照（`chat`/`trajectory`/其他注册目标）→ Slot 视图 → React |
| 瞬态会话控制 | Host control baseline → Remote snapshot stream → **`SessionManager` projection stores**（本版删去 queue/job store 字样）→ Session 与 list 快照 → 标准 hook → 组件 |
| 后台作业 | Host job registry → `job.list`/`job.follow` → `ClientJobs` roster 与输出视图 → 作业列表与面板 |
| Workspace 状态 | Host Workspace 基线与增量 → `ClientWorkspaceModel` → `ctx.workspaces.list` → `useWorkspaces` → 侧栏/hero/导航条目 |
| scoped 交互 | Host Cordis waterfall → API Remotes `$events` → `ctx.remote.$on()` on Session Context → 属主 UI 包 → 结果或 `next()` |
| 用户命令 | 组件回调 → 注册 inject face 或 Slot owner → `ctx.sessions`/`ctx.workspaces`/生成的 scoped Remote → Host Controller → 权威更新 → stream 或 event 投影回 Client |

### 侧栏文件/目录的按需监听与自动刷新

`2026-09-17-sidebar-file-and-directory-auto-refresh`（259 行，本版最长的客户端 Note）定义了完整数据流：

```text
Client: watch(path)  ──►  Host: WorkspaceFileScope 解析 Session 上下文
                             │  stat(path) 判定当前类型（Client 不提供 file/dir 类型）
                             ▼
                          OS watch（本地 Chokidar / 远端复用既有 Remote stream 载体）
                             │  ready 帧 → Client 执行初始或重连 stat()/list()
                             │  change 帧 → { absolutePath, version } 或 { absolutePath, absent: true }
                             │  watch 失败 → workspace-file/watch-unsupported
                             ▼
Client: ChangeFeed / SessionFeed / Follower（按 Session + 目标路径做键控流）
                             ▼
Document Preview：Resource 发布新元数据 → 预览调用自身既有 reload
Files：目录节点树，每个打开节点只加载并 watch 其直接子项
```

关键决策（均引自该 Note）：

- **文件与目录共用 OS 监听与既有 Remote 流传输，但消费方式不同**：Document Preview 跟随当前文件；Files 走目录节点树，**只加载并订阅已展开的子树层级**，不遍历未打开的后代。
- **折叠目录即释放该目录及其隐藏后代的 watch**；重新展开重新订阅与读取，**旧缓存不被当作当前**。
- 通知只携带元数据或失效标记；内容仍走既有文件读取器，目录内容仍走 `list()`。
- 本地 Chokidar 用 OS 事件，**默认不轮询整个 Workspace、不递归扫描全部后代**。
- 两个面板都保留手动刷新与自动刷新能力，但**暂时隐藏自动刷新图标按钮**；状态与切换逻辑保留，新 Tab 默认启用。隐藏控件不停止监听或自动刷新。
- `FileSystem.watch(target, changed, signal)` 是单目标声明：文件观察自身，目录观察其直接条目；就绪后 resolve 一个异步 close 函数。基类实现以 `FS_IO_ERROR` 拒绝，因此不理解 watch 的 provider 不声明任何东西、也不新增 FS 错误码。
- **目录失效不能只看目录 mtime**：直接子项的 size 或 type 变化也会改变 `list()` 输出，故相关子项事件使该层失效。
- 监听保持文件读取的访问规则；既有预览可经所选 FS 读取 Workspace 外的部分路径，**不应对这些文件强加目录树包含关系**。

### Web 特性路由与路由门

`2026-09-17-web-feature-routes-and-route-gate`：

```text
绝对注册键（Host 面，不变）          浏览器形态（相对文档）
─────────────────────────────       ─────────────────────────
OPEN_IN_APP_*_PATH          →       OPEN_IN_APP_*_ROUTE
PRESENT_*_PATH              →       PRESENT_*_ROUTE
CHANGED_FILES_PATH / CHANGES_*_PATH → CHANGES_*_ROUTE
SESSION_LOG_EXPORT_PATH     →       SESSION_LOG_EXPORT_ROUTE
FILE_UPLOAD_PATH            →       FILE_UPLOAD_ROUTE
```

- 浏览器代码只寻址 `*_ROUTE` 形态；页面安装的 Fetch 形状载体（`FileUploadFetch`、`RpcFetch`）接收该相对路由并**按自身 base 解析**。
- 只有两个消费者需要绝对 URL 并针对 `document.baseURI` 解析：**上传 worker**（自身 base 是 `blob:` URL）与 **markdown 图片词表**（只发出绝对 `http(s)`/`blob`/`data` 目标）。
- 门禁 `verify-client-route-resolution`（`scripts/verify-client-route-resolution.ts`，已注册进 `package.json`，随 `hygiene` 与 CI 静态检查运行，覆盖客户端编译面编译的每个浏览器源）治理：请求目标（请求构造器第一参数、fetch 形状调用、动态 import）、被赋值的资源属性、JSX `src`/`href` 属性；拒绝根绝对/协议相对/绝对 app 路由（`api`、`plugins`、`open-in-app` 前缀），以及针对 `location` 读取解析的相对 app 路由。共享的 `*_PATH`/`*_ENDPOINT` 键被用作请求目标时必须剥离。同一趟还检查浏览器引用的 Host 生产者：带根绝对 app 路由的 `url`/`src`/`href` 字段被拒绝，而路由键与响应表键保持绝对且不在范围内。

### 客户端模块图（combo 脚本与 HMR）

`docs/subsystems/client-modules.md` 本版有一处实质性重写：**修订号来源从"内容哈希"改为"文件系统元数据"**。

| 项 | 上版 | 本版 |
|---|---|---|
| 行 `rev` 初始来源 | 进程 nonce + 序号（不哈希每个插件产物） | 条目的 **mtime + ctime + size**；不哈希可执行字节；同一产物跨 Host 重启保持修订号 |
| HMR 后行修订 | 新 bundle + 可用源映射的哈希 | 仅当**修订号变化**才读取新字节并重组合图 |
| combo map 读取时机 | 启动期参与 | **启动、索引渲染、脚本 `GET`/`HEAD` 都不读 map**；首次 map `GET` 才读取校验、合成 Indexed Source Map v3 并缓存 |
| `ClientArtifactBaseline` | `path`/`mtimeMs`/`size` | 增加 **`ctimeMs`**（含保持 mtime 的写入） |
| `fetchBundle()` | 同步 `Response` | **`async fetchBundle(request): Promise<Response>`**；每个 body 首次 `GET` 时构建一次，脚本构造永不读 map |
| `rebuilt(id)` | 重新哈希 bundle + 源映射 | 从文件系统元数据推导修订；**mtime/ctime/size 未变则保持图且不读 bundle** |
| HMR 角色 | 仅开发期（生产图省略 HMR 行） | `dsh-client-hmr` 在**出货的 Web 组合**中投递实时图快照；Host 立即转发既有图变更通知，重连发当前完整图 |

`2026-09-22-fatal-diagnostics-and-crash-reports` 追加了引导健壮性：`ClientModuleSystem.arrive` 中**传输失败**（脚本 `error` 事件，什么都没执行）在同一 URL 上重试一次，且被该批所有等待行共享；**加载成功但未注册行**的脚本绝不重执行（批按序注册包且 `register()` 拒绝重复）。每个仍缺失的行随后加载自己的单资源 combo URL 作为回退；失败的批 URL 被记住以便后续行跳过，而单资源 URL 跨 import 保持可重试。

---

## 测试覆盖

客户端测试体系是三层 + 车道映射（`.agents/notes/implemented/process/2026-07-20-gui-testing-system.md`，`packages/client/AGENTS.md` 复述）：

| 层级 | 范围 | 命令 |
|---|---|---|
| L1 GUI | 客户端套件 + Host 侧 GUI 包（无浏览器、无服务器） | `pnpm run test:gui` |
| L2 Web e2e | 重建前端 dist 后跑浏览器冒烟对 + 无 key 回放 e2e 场景 | `DSH_SNAPSHOT=replay pnpm run test:web` |
| L3 覆盖率 | `packages/*/*/src` **逐文件 100%** CI 门禁 | `pnpm run test:coverage` |

本版新增/扩张的测试面（`git diff --numstat` 领先者，均在 `apps/web/tests/`）：

| 文件 | 规模 | 覆盖对象 |
|---|---|---|
| `document-preview.e2e.ts` | +1160/-31 | 文档预览与自动刷新（本版最大 e2e） |
| `changed-files-turn.e2e.ts` | +731/-0 | 变更文件卡片 |
| `plugin-manager.e2e.ts` | +433/-0 | 侧栏 Plugins 面板 |
| `client-plugin-live.e2e.ts` | +312/-0 | 动态客户端插件装载 |
| `thinking-markdown.e2e.ts` | +304/-0 | Compact Thinking Markdown |
| `idle-submission-handoff.e2e.ts` | +275/-0 | 空闲提交交接 |
| `session-archive-active.e2e.ts` | +253/-0 | 归档过滤 |
| `server-restart.e2e.ts` | +236/-0 | Host 重启后客户端恢复（对应元数据修订号稳定性） |
| `chat-scroll-contract.e2e.ts` | +251/-22 | 真实滚动与未加载 turn 落点 |
| `fork-mid-turn.e2e.ts` | +191/-0 | 轮中 fork |

包级单测的关键新增（按 Note 的"Verification"节复核）：

- `packages/client/ui-conversation/tests/conversation-group-store.client.spec.ts`、`conversation-groups.client.spec.ts`、`conversation-assembler.client.spec.ts`；
- `packages/client/ui-chat/tests/chat-node-source.client.spec.ts`、`chat-view.client.spec.tsx`、`chat-viewport.client.spec.ts`、`turn-navigator.client.spec.tsx`；
- `packages/client/ui-renderer/tests/factory-slots.client.spec.tsx`（**新增 693 行**），`packages/client/ui-slots/tests/type-chain.client.spec.tsx`（+117/-2）；
- `packages/client/ui-sidebar-browser/tests/` 共 **12 个 `.spec.*`**（`browser-controller`、`browser-navigation`、`electron-lifecycle`、`electron-frame`、`workspace`、`url` 等）外加一个 `electron-harness.client.ts` 夹具；
- `packages/api/session-controller/tests/session.client.spec.ts` 覆盖原子 prepend 发布（含 live 投递、失败与替换）；
- `packages/client/ui-workspace/tests/` 的 `session-actions.client.spec.tsx`、`rename-assembly.client.spec.tsx`、`apply.client.spec.ts`、`rows.client.spec.tsx` 把 `menu.item` 与 `row.action` 两个席位的合成纳入断言。

明确**未被验证**的部分（照抄各 Note 的"未核实/无验证"表述，不得当作已证）：

- `2026-09-20-sidebar-retained-tab-layout`："用户手动接受了一次重建后的 Electron 冷启动；**未录制 GIF**。针对 guest 身份、表单与历史保留、多浮层绘制序、缩放、裁剪、drop 提示、焦点与平台窗口控件的**专用真 Electron 证据仍与这些单测分离**。"
- `2026-09-16-sidebar-browser`："手动冷启动恢复与跨插件卸载的 checkpoint 保留**尚无运行时验证**。"
- `2026-09-21-conversation-build-groups`："这些行为检查**不建立量化延迟或内存改善**"，且"真实的分组拆分、合并、首成员变化与分页修复**可能改变身份**"。

---

## 与上下游的关系

**上游（本区域依赖）**

- `packages/api/session-controller` 与 `packages/api/workspace-controller` 的 Client 面：本版 `ClientSessions` 语义变更（引用/来源计数取代选中列表投影）直接来自 `2026-09-15-client-session-references`；`ClientWorkspaceModel` 新增 **`pinned` 增量**（`docs/subsystems/web-client.md`：增量集合变为 `upsert`/`remove`/`order`/`archived`/`pinned`）。
- `packages/api/workspace-files`：本版 `readBytes` 从"base64 字符串窗口"改为**原生 `Uint8Array`**，签名由 `readBytes(path, { offset?, length? })` 变为 `readBytes(path, { range?, baseFile? })`，并新增 `changes(path)` 单目标监听（`docs/subsystems/sidebar-right.md`）。这直接支撑文档预览的 HTML 相对资源解析（`baseFile`）与浏览器二进制 RPC 传输。
- `packages/api/session-controller/src/client/sessions/session.ts` 的 `Session.loadThrough`：本版"**一次历史跳转只发布一次**"——保留已接受页与私有分页游标直到共享目标被覆盖或加载结束，反转一次、展平一次，然后发布**一次有序 prepend**。
- `packages/client/connection`：本版官方 `web-server.md` 新增 `ctx.connection`（`HostConnectionHandle`）服务目录节，含 `createSharedFetchHandler(channel: '/api')`、`requestRejection`、`admit`、`authorizeIndex(request, response)`、`authenticatedUrl(baseUrl)` 与 `connection/request` waterfall 事件（源 `packages/client/connection/src/index.ts`、`src/rpc.ts`）。`web-client.md` 把其职责从"request correlation"改为"**request URL resolution**, correlation, …"。

**下游（本区域支撑）**

- `packages/extensions/cordis-client-runner` 的生成式 **Client Slot 目录**（`src/client/slot-catalog.ts`）把两个会话行席位登记为可发现扩展点，并给出 `cordis-client-runner` 闭包版示例（不能用 `MenuItemButton`，直接用 `React.createElement` 渲染 `role="menuitem"` 按钮，经同一 `useMenuOpenState` 关闭菜单）。
- `packages/bundle/web-app`：新客户端包必须在其 `cordis.patch.yml` 占一行、并在其 `package.json` 声明依赖（`packages/client/AGENTS.md` 的新包清单第 2 条）。
- 桌面端与 Web 共享客户端代码：`docs/subsystems/web-client.md` 本版新增"Web and desktop share the developer-tool preference"（`packages/client/ui-settings/README.md`），它控制诊断视图、新会话预设选择、变更文件卡片与内置 HTML 预览策略，**不改变 Session 记录**。
- 语音输入（`docs/subsystems/voice-input.md` **本版新增，+164 行**）与 `packages/experimental` 的语音族（`api-speech-to-text`、`speech-to-text`、`speech-to-text-sensevoice`、`client-ui-voice-input`、`voice-input-bundle`）耦合于 Composer；这些包在 `packages/experimental`，**不在本篇包范围内**，仅此交叉引用。

---

## 本版本变更要点（0.1.6-alpha.1 → 0.1.7-rc.1）

### 归属核实（先做，避免把老特性当新版）

用 `git diff --name-status dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- <note>` 逐个核实。任务简报点名的 23 篇 Note 中，**22 篇状态为 `A`（本版新增）**；唯一例外是：

| Note | 状态 | 结论 |
|---|---|---|
| `2026-09-08-desktop-uninstall-preserve-dsh-home.md` | `A`（implemented）+ `D`（proposed） | 基线版本它**已在** `.agents/notes/proposed/feature/` 下（`git cat-file -e dsh-v0.1.6-alpha.1:.agents/notes/proposed/feature/…` 退出 0）；本版只是把它从 `proposed/` **提升到 `implemented/` 并改写**。因此它是"提案落地"而非全新提案，措辞上不应说成"本版首次提出"。 |
| `2026-09-10-component-factories-and-local-slots.md` | `A` | **确为本版新增**。虽然文件名日期为 09-10，但落地提交为 `c094b663fb`（2026-09-17），且该提交不是 `dsh-v0.1.6-alpha.1` 的祖先。任务简报中"若为 M 则不是本版新增"的假设不成立（状态是 A）。 |

区间内 `.agents/notes/**` 新增英文 Note 共 **165 篇**（`git diff --name-status --diff-filter=A ... | Where-Object { $_ -notmatch '\.zh\.md|\.i18n\.yaml' }` 计数），分布：`implemented/architecture` 59、`implemented/feature` 41、`implemented/bug-fix` 24、`implemented/process` 12、`implemented/simplification` 6、`implemented/testing` 3、`proposed/*` 13、`archived/*` 7。

### 主线 1：侧栏升级为工作台

| 主题 | Note | 要点 |
|---|---|---|
| 工作区层级 | `2026-09-15-sidebar-workspace-hierarchy` | 侧栏**默认仍是兄弟 Workspace 分节**；`View options → Group by` 选 **Workspace Tree** 才从注册路径推导递归层级。模式存于既有浏览器本地 viewing store。每个 Workspace 挂在其**最近严格祖先**下；路径相等不产生自父级；比较尊重目录分隔符与 Host 大小写拼写，**不解析符号链接别名**；兄弟保持 Host 顺序。新增目录仍注册为普通 Workspace 并直接打开其 Session；父 Workspace 保留自己的 Session 与标准行操作，子 Workspace 排在其 Session 之前。折叠状态同时控制子 Workspace 与父的 Session 行，**祖先在无显式偏好时默认展开**；显式折叠也会隐藏当前 Session。Workspace 拖动只在兄弟间；后代 drop 目标委派给最近兼容祖先；搜索导航展开所有祖先。 |
| 侧栏浏览器 | `2026-09-16-sidebar-browser` | 新包 `@deepseek-ai/dsh-client-ui-sidebar-browser` 注册**多实例** `browser` 右侧栏 tab type；`SidebarRightTabParamsMap.browser` 接受可选初始 URL。`MarkdownDelegateProvider` 给嵌套 markdown 锚点一个可选 owner 回调处理普通 HTTP(S) 激活，**保留原生 modified-click**；Chat 在该类型已注册时用 URL 打开新 `browser` tab，否则用系统浏览器，**Markdown 渲染器不 import Browser 特性**。地址解析器接受 `http:`/`https:`（含 loopback），无 scheme 的主机名升级为 HTTPS；**拒绝**内嵌凭证、本应用 origin、格式错误地址、`file:` 与所有其他 scheme。Web 载体是 iframe，默认策略 `sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"`；**最右工具栏开关可为该 tab occurrence 移除 sandbox 属性，模式不持久化且激活时渲染警告**。Web 导航状态四态：`empty`/`loading`/`known`/`unknown`——`unknown`（第二个及之后的 iframe `load`）时 Back/Forward **必须禁用**，因为 iframe 不暴露跨源 `canGoBack`/`canGoForward`。包**不做** Host 侧 URL 探测或代理。 |
| 文件/目录自动刷新 | `2026-09-17-sidebar-file-and-directory-auto-refresh` | 见"数据流"节。 |
| 保留标签布局 | `2026-09-20-sidebar-retained-tab-layout` | 见"关键类型 E"。背景：Electron 44 的 `WebViewElement.disconnectedCallback` 会分离并重置其 guest，因此**保留 React key 或缓存元素引用都无法补偿被断开的祖先**。 |
| 布局持久化与 provider 恢复 | `2026-09-14-sidebar-layout-provider-recovery` | 侧栏为每个 Session 持久化**经验证的当前布局快照**与身份计数器；Client store 把 undo 历史留在内存（重载即重置，避免持久数据随历史交互增长）。恢复在渲染 body **之前**恢复布局与 tab 身份，含资源 pin；provider 自行恢复内容，侧栏**没有 terminal 专用状态或重连逻辑**。 |

### 主线 2：会话引用与统一状态

`2026-09-15-client-session-references`（135 行）。问题陈述直指要害："Session catalog、活 Client 对象、视图与异步操作**生命周期各不相同**；catalog 成员资格不建立持续使用；借来的 binding 无法保护异步工作，也无法区分同 id 的相继客户端世代；一个全局 current Session 会让独立绑定的组件作用到另一个视图的 Session 上。"

本版给出的机制（细节见"关键类型 A"）：

- `SessionTarget` 标识要获取什么、**不拥有任何东西**；Controller 无需预载父 catalog 即可解析显式地址，而 Host 在打开历史时校验其父、子与模式。
- `SessionReference` 拥有"一次使用、一个确切世代"；`release()` 幂等；release 或世代销毁后读 `binding` 失败。
- 并发获取**共享同一次初始历史打开**，但得到各自独立的引用与就绪等待；一个等待者被取消**不会**取消另一个属主的共享打开。
- 来源（source）键由消费方定义、可声明合并扩展；**没有**运行时来源注册协议，也**没有**默认主视图来源。来源是使用标签，不是第二个会话地址或操作许可。
- `useSessionStatus` 取代 `useSessionPendingInteraction` + `useCompletedSessionIds` 两个 hook（`docs/subsystems/slots.md` 的"standard props"表把 `useSessions, useSessionPendingInteraction` 改为 `useSessions, useSessionStatus, useSessionRetainInfo`）。
- `SessionProvider` 的语义变更（同 `slots.md`）：不再是"绑定当前 Session 身份并在身份变化时重挂 body"，而是**无 `session` prop 时继承外层绑定；显式 `SessionReference` 或 `undefined` 只覆盖该子树；Provider 不为整个 body 加 key**。strict `session` 条目在绑定世代变化时重挂；空 `session-maybe` 条目**首次采用绑定时不重挂**，之后世代变化或回到 absence 才重挂。
- 本 Note **部分取代** `2026-07-25-web-client-session-scope-and-provide-channel` 中"列表选中作用域生命周期"的部分；后者在显式 Provider 所有权下保留 blank-Session 与采纳理由。

### 主线 3：会话行操作席位（插件扩展点）

`2026-09-17-session-row-menu-actions-slot`（35 行）。问题：会话行的"…"菜单与悬停按钮原是 `ui-workspace` 拥有的**封闭列表**——浏览器按行状态构造菜单 `items`、自己渲染 pin/archive 按钮、把每个动词通过回调穿树，连同动词所需的 toast 与 rename 对话框。**客户端插件可以加自己的侧栏控件，但不能在出厂动作旁加一个动作**，除非改属主包或复制菜单交互。

本版把两者降级为 root 作用域的 `list` slot，属主自己也按插件路径注册（源码与确切 API 见"关键类型 B"）。被否决的方案值得一记：

- **在 `Menu` 与行组件之间加 React context**——被否，因为"业务组件看到零个 React context"（`packages/client/AGENTS.md`）；Menu→行是父→子关系，其控制应走 slot 通道。
- **属主提供行能力**（把 `pinned`/`archived` 与 `pin`/`archive`/`rename`/`fork` 回调传给条目）——被否，因为"这些不是菜单的能力；每个动作的行为是它自己的"。
- **在出厂行之下追加一个专用 slot**——被否，那会把出厂行变成插件只能跟随的特权组，并为一个有序列表引入第二条渲染路径。

后果：`WorkspaceBrowser` 不再穿动作回调、不再渲染 toast、不再承载 rename 对话框；`Menu` 长出了 `children`，`items`/`onSelect` 变为可选；`shell.overlay` 增加两个 `ui-workspace` 条目。归档提示**直接应用"显示归档"过滤**，不再经由视图选项菜单。

配套的 `2026-09-18-session-pin-and-sidebar-archive`（79 行）补齐了数据面：`dsh-workspace` 注册表以 Session id 数组存**注册表级**的 `pinnedSessionIds` / `archivedSessionIds`，配持久化 `pinSession`/`unpinSession`；pin 数组最新在前；**pin 与 archive 互斥**——归档在同一次持久写入中丢弃 pin，而对已归档会话 pin 会以 `WorkspaceArchivedSessionPinError` 失败。每个浏览器本地 account 有**一条完整 Session 序列**（含 pinned 与 archived 成员），Workspace 成员资格界定该 account 边界。补充（supplementation）是**内存投影，不是自动存储迁移**；过滤本身永不重写 Session 位置。这样归档行保留其排序槽位、灰显、且在恢复前不能打开。

### 主线 4：对话分组与聊天导航性能

**对话构建分组**（`2026-09-21-conversation-build-groups`，客户端侧，174 行）。核心判断："**业务分组属于注册的 Definition**"——成员、切分、回复、steering、重试、摘要与缓存失效必须待在一起；Builder 与 assembler 只做通用工作（提供输入、派发 Definition、校验引用、复用身份、发布），**永不构造具体分组类**。协议细节见"关键类型 D"。

关键否决方案（同 Note）：

- 在 Builder 里硬编码 Chat 过程投影器 → 目标聚合器仍然拥有业务规则。
- 给既有事件 Definition 加 `buildGroups` 而不加新输入 → 回调名不提供跨 Node 输入、生命周期变化或重建语义。
- 在 Group Definition 里重放原始事件 → 重复 Assistant/Tool/Message 解释，且可能与 Builder 的最终可见顺序分歧。
- `ConversationViewDefinition.buildLayout` → 把目标工厂扩成业务布局回调，而不是注册一个不同的业务 Definition。
- 每个 Group 一个事件 Context → 边界依赖**前序可见内容**，不是一个自带分组起始身份的事件。
- 依赖图 / ViewItem 类 / 工厂 / 嵌套分组 / 策略叠加 → 本阶段一个目标输入 + 一个非嵌套分组输出已够。
- 在 Expanded 模式移除 group wrapper → 改变父级会重挂成员，**即便 key 保住**。

代价（同 Note "Consequences"）：这是一次**显式框架扩展**（新输入协议、注册表、context、发布阶段、读取器），"不只是又一个回调"；结构变化仍会在可见顺序上重建目标位置索引；内容变更不重建。Node 顺序与可见性**只有一个属主（Builder）**，分组不得在基础设施里独立排序原始事件或重新推断成员。

**聊天导航性能**（`2026-09-18-chat-navigation-performance`）。长会话暴露三项独立成本，本版分三位属主处理，**不合并为一个 controller**（合并会掩盖"哪些操作需要 DOM 几何、哪些只应用阅读或分页策略"）：

| 面向 | 实现 | 变化 |
|---|---|---|
| Turn rail | `packages/client/ui-chat/src/client/chat/TurnNavigator.tsx`，TanStack React Virtual 固定 10px 间距 | 只有可见范围、overscan 与聚焦 mark 及其邻居保持挂载；**turn 元数据仍全量常驻——这是 rail 虚拟化，不是 transcript 虚拟化**。用 ResizeObserver 视口尺寸 + 固定 item 尺寸，偏移计算对缓存几何做钳制并调用受支持的 `scrollBy`，**避开 `scrollToIndex` 的基于 DOM 的最大偏移计算**。 |
| Transcript 导航 | `use-chat-viewport.ts`（DOM 读、钳制写、原生事件、turn 锚点）/ `use-chat-reading.ts`（follow-tail 策略、语义恢复、采样阅读器移动）/ `use-chat-navigation.ts`（已加载或未加载跳转、分页锚点、替换任务、回退）/ `use-chat-scroll.ts`（提交输入与协调） | 两层；viewport 返回**实际落点**与可用的 turn/语义位置事实，阅读策略消费这些事实而**不再做一次 hit test**；viewport 忽略自身未变的滚动回声与嵌套 rail 的事件。定时器与动画帧完成**直接调用属主**而不是递增 React tick 状态。 |
| 历史跳跃发布 | `packages/api/session-controller/src/client/sessions/session.ts` 的 `Session.loadThrough` | 保留已接受页与私有分页游标直到共享目标被覆盖或加载结束；反转一次、展平一次，**发布一次有序 prepend**。后续分页失败只发布已成功的**前缀一次**；stream/window 替换丢弃过期缓冲页。单页 `loadOlder` 仍立即生效。 |

该 Note 明确给出的是**工作量计数估计，不是计时测量**：`rail DOM 与 React mark 遍历 O(T) → O(V)`；活跃 turn 索引查找 `线性 O(T) → Map 期望 O(1)`；历史驱动的线性索引遍历 `O(P·W0 + B·P²) → O(W0 + B·P)` + `O(B·P)` 缓冲展平；历史驱动排序 `每增长窗口重复排序 → 一次末窗排序`；历史 prepend 发布次数 `P → 1`。并提供两个反夸大说明：**10,000 turn / 约 50 挂载 mark ≈ 少 99.5% 的 rail mark，"不是 200× 端到端加速"**；20 个等长分页、初始窗口可忽略时，整趟线性访问 `210B` 条 vs 一趟 `20B`，"约 10.5× 更少的工作量"。

### 主线 5：视觉语言与材质

| 主题 | Note | 要点 |
|---|---|---|
| 状态点 | `2026-09-17-state-dot-visual-language` | `StateDot` 原本混用两种绘制语言（已结算态是半透明光晕 + 实心核，`ongoing` 是八格像素追逐）。本版统一：`idle`/`done`/`warning`/`error` 为既有 10px 布局槽内的**单个实心 6px 圆、无光晕**；`idle` 用中性 `--dsw-alias-state-idle-primary`，`done` 保持成功绿、`warning` 琥珀、`error` 红。`ongoing` 是**唯一的非圆点成员**：默认边距 14px，25% 不透明度完整环 + 灰色弧（tertiary label 令牌），字形 1.5s 连续旋转、弧在 **12↔24 dash unit** 间往返且两端 offset 为零（避免浏览器在循环边界重置出第二个圆周运动）；reduced-motion 环境保留中间态静态弧。显式 size 覆盖、`data-state`、`aria-hidden` 行为不变。 |
| 紧凑半透明菜单面 | `2026-09-17-compact-translucent-menu-surfaces` | `ui-theme` 定义 `--dsw-specific-menu`（浅/深半透明填充）与 `--dsw-menu-backdrop-filter: blur(40px) saturate(150%)`。每个绘制该菜单填充的上升面同时应用该滤镜、`border: 0`，并取带可重绑细描边的 elevation 阴影。**含 fixed 定位覆盖层的表面必须把填充与滤镜画在孤立的背景伪元素上**——否则被 filter 的祖先会改变那些覆盖层的包含块。紧凑基线：16px 外圆角、3px 边框内距、34px 普通行、13px 主文本/20px 行高、6px 图标文本间距、8px 行圆角。全局 WebKit 滚动条宽 5px；composer 菜单用 6px 可拖轨 + 2px 可见滑块覆盖。 |

配套 `docs/web-styling.md` 新增一条上升面规则，并把可点击链接的图标从 `LinkIcon` 改为 **`LinkIconMedium`**——"对知名外部主机使用该站点自己的标记而非地球图标"；同时新增 Compact Thinking Markdown 的"tertiary 文本色 + 静止点线下划线"（`2026-09-17-thinking-markdown`）。

### 主线 6：Web 特性路由与子代理目录

- **特性路由与路由门**（`2026-09-17-web-feature-routes-and-route-gate`）：见"数据流"节。触发原因写得很实在——"在剥离前缀的代理下，那些请求**全部落空**"，且"没有任何东西阻止新的浏览器面引用再次把 bundle 绑定到某个挂载点"。
- **Web 子代理目录投影精简**（`2026-09-08-web-subagent-catalog-projections`）：父 catalog 投影**已经**通过 Session control stream 发布完整成员资格；独立 catalog-change 事件、重复 RPC 读与第二份成员缓存是重复投递。本版让 Client **只在标准的 per-Session 投影 store 里保留目录成员资格**：初始 `session.projections` 读返回**一次 live-preferred Session 观察**得到的完整投影基线，端点接受任意 Session id、无 catalog 专用依赖或校验；同一观察同时提供值与序列游标，故较老的响应不能覆盖较新的值。打开会话使用其 follow 基线、**不再调度第二次投影读**；未打开的目录分支仍走显式读。特征消费方从 `projectionsBySession` 选 `subagentCatalog`，行活跃度由 Session 列表基线与状态事件派生。该决策**取代** `2026-07-27-web-subagent-conversations` 中专用的成员刷新机制，后者在导航、控制与呈现决策上仍有效。
- 配套 `2026-09-16-subagent-catalog-membership-only` 进一步把**模型配置移出**子代理目录：catalog 事件与投影只保留子身份、创建时间、模式与标签；`establishCatalogChild(parent, childHeader, descriptor)` **只接收发布成员资格所需的值**。该决策仅取代 `2026-09-01-parent-owned-subagent-catalog` 中的"创建模型元数据"选择。

### 主线 6.5：插件管理从设置迁到侧栏

`2026-09-09-plugin-management-in-the-web-sidebar`（本版新增）+ `ui-plugin-manager`（**新包，+8283 行**）共同完成一次职责搬迁：

| 项 | 上版 | 本版 |
|---|---|---|
| 配置入口 | 设置里的 **Plugin configuration** tab，为每个受支持插件渲染一张可展开卡片 | 侧栏 **Plugins 面板**：`ui-plugin-manager` 注册一个 `sidebar.panellist` 条目与它打开的 `main` 面板 |
| 设置里的 Plugins 区 | "feature-owned tabs + configurable host-plane plugin cards + `settings.plugin.item` 扩展点" | **"Built-in plugins"**：只是一个壳——拥有导航入口与 tab 行；**其中每个 tab 都由别的插件注册**，出货的只读清单贡献其中一个 tab |
| 管理能力 | 无（只有配置） | 安装、启用、禁用、重试、组合已安装的插件包；显示安装输出、确认卸载 |

证据：`packages/client/ui-settings-plugins/README.md` 的 front-matter `description` 在本版从 `"Plugins settings section for the dsh web client: feature-owned tabs, the configurable host-plane plugin cards, and the settings.plugin.item extension point."` 改为 `"Built-in plugins settings section for the dsh web client: the Settings navigation entry and the tab chrome that feature-owned tabs register into."`；其 `src/client/` 下 `AgentLoopCard.tsx`、`BashCard.tsx`、`WebSearchCard.tsx`、`SubagentModelSelectionCard.tsx`、`card-form.ts`(351 行)、`fields.tsx`、`tab-store.ts` 等 20 余个文件被删除，同时**新增**了五个插件专属设置包承接这些卡片：`ui-settings-agent-loop`、`ui-settings-shell`、`ui-settings-subagent`、`ui-settings-web-search`（以及 `ui-settings-plugin-inventory` 承接只读清单）。

`docs/subsystems/slots.md` 的出货席位树同步反映这次改动：

```diff
 │        ├─ settings.models.provider-card
 │        ├─ settings.models.footer
 │        └─ settings.plugins.tab
-│           └─ settings.plugin.item
 ├─ main
+│  ├─ plugins.item
+│  ├─ plugins.bundle.config
+│  ├─ plugins.row.config
+│  ├─ plugins.detail.actions
+│  ├─ plugins.detail.badge
+│  ├─ plugins.detail.section
 │  └─ main.conversation
```

安装结果的所有权规则（Note 原文要点）：管理器 controller 把 `listBundles` 与 `listPlugins` 合成**每个 bundle 一个视图**，从清单的 `managementAvailable` 决定可用性，并在管理操作后、`plugin-manager/changed` 时、重连时刷新，安装进度挂在所属 job 下。**安装结果属于一个请求**：对话框为每次安装或重试生成新的 request id 并按该 id 过滤 Host 进度、日志与响应；取消确认可能先于原 add 响应到达，因此**那个响应不能结算后续重试**。取消使用管理器显式的 cleanup 确认——**本地 RPC 取消与连接丢失都不意味着 pnpm 已停止**；应用阶段会关闭取消窗口。

### 主线 6.6：席位树与本版新增席位

`docs/subsystems/slots.md` 本版新增的开头一段列出三个 shipped 席位：

> `plugins.bundle.config` supplies bundle detail configuration, keyed by npm package name. `plugins.bundle.activation` renders optional guidance after user-requested enablement, with owner callbacks to dismiss or open that bundle's details. `conversation.input.activity` supplies one action between the model selector and Send, with toolbar expansion released on unmount.

席位树 diff 的其余变化（均可用 `git diff dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- docs/subsystems/slots.md` 复核）：

| 变化 | 内容 |
|---|---|
| 新增 | `sidebar.workspaces.session.menu.item`、`sidebar.workspaces.session.row.action`（在 `sidebar.workspaces` 之下） |
| 新增 | `conversation.header` 包裹层，内含 `conversation.header.leading` 与既有的 `conversation.session.header.*` 四席 |
| 新增 | `conversation.composer` 下 `conversation.plan-review.actions` |
| 新增 | 根级 `shell.leading` |
| 删除 | `settings.plugin.item` |
| 语义收紧 | `session-maybe` 从"跟随当前选择但无 Session 也可渲染"改为"**继承外层 Provider 绑定**，但无绑定也可渲染"；`session` 从"要求已解析的 Session 绑定"改为"要求已解析的**外层 Provider** 绑定" |

`SessionProvider` 的席位级语义也随之改写（同 `slots.md`）：`PropsRenderSlots` 里的 `SessionProvider` 现在在条目声明 **`session` 或 `session-maybe`** 子席位时出现；无 `session` prop 时继承外层绑定，显式 `SessionReference` 或 `undefined` 只覆盖该子树；**Provider 不为整个 body 加 key**。

### 主线 7：桌面端（Electron）

**改动规模**：`apps/desktop` 414 文件 +32879/-4268（324 提交），是本篇区域内绝对量最大者。源码增长集中在 `src/main.ts`（+924/-320，本文件最大单笔）、`src/mandatory-update-window.ts`（+307/-0）、`installer/pages.nsh`（+375/-0）、`installer/window-frame.cpp`（+295/-0）、`renderer/welcome.css`（+340/-0）、`scripts/installed-update-qualification.ts`（+278/-0）、`installer/extract-report.h`（+327/-0）。测试侧 `tests/main-startup.spec.ts` 单文件 +1513/-149。

| 主题 | Note（均已核实为 `A`） | 要点 |
|---|---|---|
| 强制更新 API（提案） | `proposed/feature/2026-09-08-desktop-mandatory-update-api`（107 行） | `GET /api/v0/check_client_update?scenario=launch`，桌面必带 7 个 header：`x-client-platform`(`desktop-win`\|`desktop-mac`)、`x-client-version`（完整 SemVer，保留 prerelease）、`x-client-bundle-id`（如 `com.deepseek.dsh`）、`x-client-locale`、`x-client-arch`（Windows `x64`；macOS `x64`\|`arm64`）、`x-client-update-channel`（初期恒为 `nightly`）、`x-client-bundled-dsh-version`。无强制更新 → `code:0`；强制更新 → **`code:40005`（响应体 code，不是 HTTP 状态）**，用**扁平化** `data.show_content.title/detail` + `data.desktop_app_link`（HTTPS，须满足客户端 allowlist），**无 `alt_app`/`biz_data` 包装**。初期**不加** `mode`/`force_update`/`show_key`/`target_version`/按钮文案/updater 元数据。缺必填 header、非法 SemVer、不支持的平台/架构/通道组合返回显式参数错误，**不得**伪装成 no-force 成功（因为成功会清除已有阻断）。**Status: proposed**（后端集成进行中，本地 fixture 不构成服务证据）。 |
| 强制更新客户端 | `feature/2026-09-11-desktop-mandatory-update-client`（67 行） | 三项硬约束：①**打包时嵌入**配置与应用身份，打包应用**忽略环境覆盖**；打包要求在选择 updater 部署的策略 origin 之后才能准备产物或签名；只有未打包开发可省略策略配置。②"**扁平的 `40005` 独立于可选的标题、详情与下载页字段建立阻断**"；本地化兜底文案与重试动作仍可用，缺失或未批准的页面不提供；传输/JSON/业务码/HTTP 失败**不能**清除已知阻断，**只有有效的新 no-force 响应能清除**。③同版本离线持久化**未实现**，因其产品行为未定。Windows 把 shell-origin 对话框嵌在主文档的 caption 之下，使最大化与缩放有**单一原生属主**（第二个原生窗口导致可见的不同步缩放，issue #4566）；macOS 用 shell 自有的模态 + 独立 sandboxed preload，主进程校验其确切文档 URL 与 WebContents 身份。Esc 与普通 updater 提示**不能**关闭阻断。 |
| Windows 安装器页 | `architecture/2026-09-10-windows-native-installer-pages` | 经 electron-builder 的 NSIS include 增加自定义欢迎/进度/完成页，**stock 脚本仍负责安装与卸载器生成**；自定义全脚本会绕过 electron-builder 的独立卸载器签名路径，故不适用。用 **x86 Win32/GDI+ helper** 保留 DWM 阴影并在 UI 线程绘制安装进度，同时 stock 安装 worker 运行。安装是**按用户**的。欢迎页离开校验读当前 edit 控件（鼠标与键盘导航都覆盖）；去抖的行内提示**不是**安装权威。运行中进程检查按受影响的 exe 路径匹配，其他安装保持独立。 |
| Windows 标题栏 | `feature/2026-09-16-windows-desktop-titlebar` | Electron 隐藏标题栏 + **原生 window-controls overlay**；只有其本地应用 preload 发布 `data-windows-titlebar`，共享布局/侧栏/全屏面板规则都要求该标记。**移除独立的原生菜单行**：应用 preload 在孤立 shadow root 里挂载本地化的 Application 与 Edit caption 条目，主进程为经校验的请求打开原生 popup 菜单。Edit 保留 Windows 原生命令集与显式 locale 自有标签。渲染器消息**只接受主窗口主框架**。侧栏回调提供 caption 导航而不引入第二个导航 store；折叠态的 New Session 控件位于侧栏开关与菜单之间。 |
| macOS 隐藏标题栏与 vibrancy | `feature/2026-09-13-macos-hidden-titlebar-vibrancy`（51 行） | 主窗口在 darwin 上 `titleBarStyle:'hiddenInset'`、`trafficLightPosition:{x:16,y:18}`、`vibrancy:'sidebar'`、**`visualEffectState:'active'`**（`'followWindow'` 在失焦时把侧栏洗淡）、透明 `backgroundColor`。所有 web 侧调整以 `html[data-platform='darwin']` 为键（只有桌面 preload 设置 `document.documentElement.dataset.platform = process.platform`）。**透明度链**：darwin 上 `html`/`body`（ui-web base.css）与 AppFrame 透明，中列绘不透明 `--dsw-alias-bg-base`，侧栏列绘侧栏填充的 `color-mix` 半透明色调。**原生主题同步**：ui-theme boot 脚本与 ui-layout `ThemePresenter` 发布 `html[data-ds-theme-source]`（`light`/`dark`/`system`），app preload 观察后经 `dsh-desktop:native-theme-set` 转发，主进程校验值并赋 `nativeTheme.themeSource`——**发布偏好而不是解析后的配色，从而在偏好为 `system` 时保留跟随 OS**。**侧栏顶条**：darwin 上 52px 顶条让开红绿灯并承载折叠开关；折叠时**整列隐藏**（`computeColumns` 接受显式 `collapsedWidth`，AppFrame 在 darwin 桌面传 0），而非其他平台保留的 56px rail。**拖拽区**：Electron 按窗口几何的 DOM 顺序计算，故 `-webkit-app-region: drag` 只声明在两个白名单样式表内。 |
| 桌面主运行时 | `feature/2026-09-14-desktop-primary-runtime`（43 行） | 桌面把 Python、Node.js、pnpm、数据处理库与 Office 创作库作为**一个绑定发布的载荷**；路径查询工具把载荷从应用资源安装到固定的 Harness-home 目录并返回绝对路径与捆绑 Python 分发包版本。**版本报告排除用户新增的包**，不改 PATH/环境变量/包管理器配置。应用版本、顶层解释器与包管理器版本、Python 分发映射与锁定输入摘要存放在 **`runtime.json`**（不是目录名）。安装发布一份完成的 staged 副本并在替换成功前保留旧目录。macOS **只给独立 Node 可执行文件**授予 `com.apple.security.cs.allow-jit`——无该 entitlement 的 hardened-runtime 签名会阻止 V8 分配代码区。 |
| 桌面 webview 浏览器 | `feature/2026-09-20-desktop-browser-webview`（59 行） | Desktop 用 `<webview>`（`ElectronWebViewImpl`），Web 保留其 opt-in iframe 载体。**存储属主**：`DesktopBrowserGuests` 为每个规范化 CWD account 分配随机、**非持久**的 Electron partition；Client 用 Host 规范化的 `WorkspaceView.path`（不是 Workspace 记录 UUID），因此在同一目录重建 Workspace 不改变其存储 account 键。同 CWD 的 DSH Session 共享 account；无解析 Workspace 的 Session 保持单独隔离。**关闭 tab 释放其 guest，不释放 account 的 cookie/storage**。cookie/localStorage/IndexedDB/Service Worker/cache 属 partition（跨窗口重建存活，**不跨应用退出持久**）；DOM/原生历史/sessionStorage 属页面。该包有**独立的 Host 与 Client 编译程序**：Desktop 与 Host 聚合只引用 `tsconfig.host.json`，Client 聚合引用 `tsconfig.client.json`，包根 tsconfig 是 solution-only。 |
| 致命诊断与崩溃报告 | `architecture/2026-09-22-fatal-diagnostics-and-crash-reports`（61 行） | 起因是两次现场故障只能靠致命恢复对话框的截图诊断，而对话框只显示最后八行、并**承诺完整诊断在 Electron 控制台里——打包安装永远看不到那个控制台**。四个决定：①`dsh-app-boot` 的 `installFailLoud` 为 `'uncaughtException'` 注册与 `'unhandledRejection'` 相同的处理器：写一条带标签的 `util.inspect` 诊断到 stderr、在既有超时下 await surface 的 release hook、**exit 1**；控制权**永不**回到失败操作（"只有抛出点知道哪些状态是完整的"；一个在更新中途抛出的 `'data'` 监听器**已经丢了一个 chunk 并半设了自己的字段**，恢复会把可见崩溃变成静默错误输出）。`util.inspect` 取代 `err.stack`，因为 `node:fs` 错误的 `code`/`syscall`/`path` 与 `cause` 链是 stack 行省略的可枚举属性。②**spill 文件在每一步都是 best-effort**：`spillAll` 包住打开或追加的**每一个**文件系统失败，丢弃该 spill、经属主 logger 报告一次（`SpillOptions.onFailure`），内存尾部继续收集；**被移除的目录不重建**（该设计的安全性建立在"本进程一次性创建的随机名"上）。③**致命桌面失败先在对话框之前写崩溃报告**：每个 `reportFatal` 调用者命名自己的 source（`host`/`web-boot`/`renderer`/`main`）；`DesktopFatalRecovery.report` 最多 await `writeCrashReport` 一秒，然后对话框把文件路径单列一行；报告位于 `app.getPath('logs')`、平台允许时 owner-only、启动保留最新十份；**关机期间的致命失败写报告但不弹对话框**。④**批脚本失败是逐行问题，不是引导失败**：见"数据流"节。该 Note **部分取代** `2026-09-15-desktop-native-fatal-recovery` 的"对话框指向 Electron 控制台"部分，后者的对话框属主、按钮集与 profile 恢复仍有效。 |
| 原生致命恢复 | `architecture/2026-09-15-desktop-native-fatal-recovery` | Electron 每应用进程拥有**一个**原生致命对话框；显式创建主窗口、文档加载、preload、渲染器、Web 初始化与后端失败都进入该路径。**第一次报告在 await 对话框之前就宣告呈现权**，后续报告留在日志里。对话框把首条诊断限制为**最后八行**、完整细节限制为 **1,200 UTF-16 代码单元**（含截断通知、报告路径与重装建议），因为原生对话框不能滚动。提供退出 / 重启 / **禁用第三方 bundle 后整体重启**三个动作；恢复在 Host 关闭后于既有 profile 锁下调用共享的 app-boot `sanitizeProfile`——它恢复调用方提供的 bundle 并把 profile patch 重命名为唯一备份，**不解析它、不要求运行时初始化、不删除已安装文件**。**没有** elapsed-time 启发式把慢启动判为致命；Desktop **没有** profile 重置或紧急恢复文档。 |
| 卸载保留 DSH home | `feature/2026-09-08-desktop-uninstall-preserve-dsh-home`（**由 proposed 提升**） | Windows 卸载**同时移除** Electron user-data 目录、`%APPDATA%` 产品目录与 updater 缓存，**永不触碰 Harness home**。**没有自定义卸载器页面**；静默卸载移除相同数据。以 `--updated` 或 `/KEEP_APP_DATA` 启动的卸载器会保留数据，覆盖 electron-builder 的原地更新与"从另一目录替换旧安装"两种情形，因此更新保留 UI 偏好。作为 Windows 环境变量发布的 `DSH_HOME` 保护每个与之重叠的目标；**原生 helper 看不到只在 shell profile 里配置的 home**。移除经 `window-frame.dll` 里的原生 helper 执行：拒绝受保护 Windows 文件夹、拒绝与安装目录或受保护 home 重叠的路径、遍历期间持有目录句柄（listing 访问）使目录不能被改名或替换、**不进入目标就 unlink 重解析点**、清除只读属性、遇锁定文件后**继续删除兄弟项**。要求固定本地驱动器，链接根或祖先保持原地。失败留下残留且**不阻止也不报告卸载**。 |

### 主线 8：客户端模块与构建卫生

- **修订号稳定性**（`b1921cf56d fix(client): keep artifact revisions stable across server restarts`）对应 `client-modules.md` 的"初始发布与 HMR 都从条目的 **mtime、ctime、size** 推导 `rev`，不哈希可执行字节；同一产物跨 Host 重启保持修订号"。`apps/web/tests/server-restart.e2e.ts`（+236/-0）是它的 e2e 证据。
- **内容寻址→修订号寻址的措辞统一**：`WebBootEntry.url` 的 JSDoc 从"Revisioned single-resource combo endpoint used by HMR"改为"Revisioned single-resource combo reference used by HMR. **It is relative to the document**, so the browser resolves it under whatever mount served the page."
- **路由门进 CI**：`package.json` 新增 `"verify-client-route-resolution": "tsx scripts/verify-client-route-resolution.ts"`，随 `hygiene`（`scripts/run-gates.ts hygiene`）运行。

---

## 附录：本版提交与 Note 索引

### A. 关键 Note 全清单（本版新增，英文路径）

客户端侧（`.agents/notes/implemented/`）：

| 日期 | slug | 目录 | 行数 |
|---|---|---|---|
| 2026-09-10 | `component-factories-and-local-slots` | architecture | 105 |
| 2026-09-14 | `sidebar-layout-provider-recovery` | architecture | 35 |
| 2026-09-15 | `client-session-references` | architecture | 226 |
| 2026-09-15 | `sidebar-workspace-hierarchy` | feature | 31 |
| 2026-09-16 | `open-in-default-app-for-sidebar-files` | feature | 29 |
| 2026-09-16 | `sidebar-browser` | feature | 74 |
| 2026-09-16 | `subagent-catalog-membership-only` | simplification | 25 |
| 2026-09-17 | `compact-translucent-menu-surfaces` | feature | 29 |
| 2026-09-17 | `sidebar-file-and-directory-auto-refresh` | feature | 259 |
| 2026-09-17 | `session-row-menu-actions-slot` | architecture | 35 |
| 2026-09-17 | `state-dot-visual-language` | feature | 31 |
| 2026-09-17 | `web-feature-routes-and-route-gate` | architecture | 31 |
| 2026-09-18 | `chat-navigation-performance` | architecture | 61 |
| 2026-09-18 | `session-pin-and-sidebar-archive` | feature | 79 |
| 2026-09-20 | `sidebar-retained-tab-layout` | architecture | 82 |
| 2026-09-21 | `conversation-build-groups` | architecture | 174 |
| 2026-09-08 | `web-subagent-catalog-projections` | simplification | 31 |

桌面侧：

| 日期 | slug | 目录 | 行数 |
|---|---|---|---|
| 2026-09-08 | `desktop-uninstall-preserve-dsh-home`（*由 proposed 提升*） | feature | 39 |
| 2026-09-10 | `windows-native-installer-pages` | architecture | 31 |
| 2026-09-11 | `desktop-mandatory-update-client` | feature | 67 |
| 2026-09-13 | `macos-hidden-titlebar-vibrancy` | feature | 51 |
| 2026-09-14 | `desktop-primary-runtime` | feature | 43 |
| 2026-09-15 | `desktop-native-fatal-recovery` | architecture | 29 |
| 2026-09-16 | `windows-desktop-titlebar` | feature | 29 |
| 2026-09-20 | `desktop-browser-webview` | feature | 59 |
| 2026-09-22 | `fatal-diagnostics-and-crash-reports` | architecture | 61 |
| 2026-09-08 | `desktop-mandatory-update-api` | **proposed**/feature | 148 |

同区间其它相关新增 Note（未在主线展开，供交叉检索）：
`architecture/2026-09-09-plugin-management-in-the-web-sidebar`、`architecture/2026-09-10-desktop-web-wrapper`、
`architecture/2026-09-11-desktop-electron-node-runtime`、`architecture/2026-09-11-windows-directory-installation`、
`architecture/2026-09-16-desktop-cos-upload-transport`、`process/2026-09-16-desktop-release-version-derivation`、
`process/2026-09-17-windows-runtime-signature-cache`、`process/2026-09-17-windows-signature-completion`、
`process/2026-09-21-desktop-build-version-as-input`、`testing/2026-09-10-desktop-local-updater-qualification`、
`testing/2026-09-14-desktop-installed-update-journal`、`testing/2026-09-14-desktop-installed-update-materials`、
`simplification/2026-09-19-remove-desktop-profile-core-cleanup`、
`bug-fix/2026-09-16-desktop-window-menus`、`bug-fix/2026-09-20-windows-embedded-mandatory-update`、
`bug-fix/2026-09-22-windows-open-through-shell-resolution`。

### B. 代表性提交

| 提交 | 说明 |
|---|---|
| `c094b663fb` | `feat(client): add reusable component factories` |
| `21586fe28c` | `feat(client): compose session row actions from slot lists` |
| `e5a72d73df` | `feat(client): add extensible session menu actions` |
| `c890269a19` | `feat(client): add definition-owned conversation groups` |
| `1b3b56c8f1` | `feat(client): render stable conversation group references` |
| `a67ad91237` | `feat(client): expose indexed positions to group definitions` |
| `b3549ee455` | `fix(client): preserve grouped chat navigation and view lifecycle` |
| `fa3e5cbaf6` | `fix(client): preserve state across Session reference updates` |
| `cf9213ca5f` | `fix(sidebar): finalize resource auto-refresh behavior and tests` |
| `5ec3368285` | `fix(web): address Workspace tree review feedback` |
| `b1921cf56d` | `fix(client): keep artifact revisions stable across server restarts` |
| `afde35880f` | `feat(client-modules): recover from a failed batch script and record import errors` |
| `8e93da68f3` | `test(web): pin route-gate violations by line and match feature routes exactly` |
| `31e6b3f150` | `fix(client): rotate every ongoing StateDot loader in phase (#4737)` |
| `a7d457349f` | `docs(client): record the conversation grouping foundation` |
| `c22b226b18` | `fix: address review threads on the fatal-diagnostics PR` |
| `7b2094d04d` | `fix(desktop): keep the Host's original diagnostic in startup crash reports` |
| `94bc5b25b8` | `test(desktop): cover webview and sidebar retention lifetimes` |
| `d72f85a0ad` | `fix(desktop): paint an opaque base while minimized to cover the vibrancy reattach gap` |
| `1566f3f5ad` | `fix(desktop): round the Windows app icon corners further` |

### C. 复核用命令

```powershell
# 量化基线（工作目录 E:\test\rewrite-agently\deepseek-harness）
git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/client
git diff --stat     dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/client packages/web apps/web apps/desktop apps/desktop-host
git diff --name-status dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/client | Group-Object { $_.Substring(0,1) }

# 包集合变化
git ls-tree -d --name-only dsh-v0.1.6-alpha.1 packages/client/ | Measure-Object -Line
git ls-tree -d --name-only dsh-v0.1.7-rc.1    packages/client/ | Measure-Object -Line

# Note 归属
git diff --name-status dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- "*2026-09-10-component-factories-and-local-slots.md"
git log --diff-filter=A -1 -- .agents/notes/implemented/architecture/2026-09-10-component-factories-and-local-slots.md
git merge-base --is-ancestor c094b663fb dsh-v0.1.6-alpha.1 ; $LASTEXITCODE

# 席位源码
Select-String -Path packages/client/ui-workspace/src/client/index.ts -Pattern "sidebar.workspaces.session.(menu.item|row.action)"
```

### D. 未核实项（显式声明）

1. **`docs/subsystems/web.md` 的"区间变更"不存在**——`git diff --name-only dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- docs/subsystems/web.md` 返回空。任务简报假设它有变更，实测为无。
2. **`2026-09-18-chat-navigation-performance` 的性能数字是理论工作量估计**，Note 自身声明"these are work-count estimates, not timing measurements"，且明确否认 200× 端到端加速。本文照抄其口径，**未**独立复现任何测量。
3. **`ui-plugin-manager` 的 +8283 行中不含 `.e2e` 场景本身**；该包源码行数与 `apps/web/tests/plugin-manager.e2e.ts`(+433) 的关系未逐文件核对。
4. **`packages/client/ui-settings-unarchive-sessions` 的删除提交未定位到单一 commit**（本版有 37 个 D 文件、26 个 R 文件，未逐一归属）。
5. **`apps/desktop` 324 个提交未逐条审阅**，本篇的桌面结论全部来自上表 Note 与 `git diff --numstat` 的领先文件，不是提交级遍历。
6. **磁盘上 `packages/client/ui-settings-unarchive-sessions/` 目录仍存在**，但只含未跟踪的 `lib/` 与 `node_modules/`；`git ls-tree -r dsh-v0.1.7-rc.1` 对该路径返回空。
7. **`docs/subsystems/voice-input.md` 的 +164 行内容细节未展开**——其实现包在 `packages/experimental`，超出本篇包范围。
