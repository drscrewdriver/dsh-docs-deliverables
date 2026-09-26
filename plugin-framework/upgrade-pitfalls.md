# DSH 插件升级适配陷阱（讨论区实证）

> 适用场景：DSH 升级（尤其 0.1.2 → 0.1.5）后插件行为异常或导致宿主异常。
> 数据源：`deepseek-harness` 讨论区 #5886–#6442 增量分析（2026-09-12），每条均附原始讨论链接。
> 与 [compatibility-guide.md](compatibility-guide.md)（API 层适配）互补，本文聚焦**实际踩坑案例**。

---

## 一、会话数据写入类陷阱（最严重）

### 1.1 插件自定义 message source kind 会导致旧会话永久拒载 🔴

- [#6311](https://github.com/deepseek-ai/deepseek-harness/discussions/6311)：v2→v3 会话迁移对**插件自定义的 message source kind 直接拒载**，导致旧会话永久无法加载。
- [#6101](https://github.com/deepseek-ai/deepseek-harness/discussions/6101)：`cannot safely transform unclassified message source`。

**插件侧规避**：
- 不要向会话日志写入自定义 source kind；如必须标记插件产生的消息，使用**现有标准 kind + 元数据字段**。
- 升级 DSH 前，若插件写过自定义 source，先在旧版本导出/清理相关会话。

### 1.2 插件写入的 marker（null turn/step）会永久破坏 /compact

- [#5920](https://github.com/deepseek-ai/deepseek-harness/discussions/5920)：插件写入 turn/step 为 null 的 marker 后，`/compact` 永远失败。

**规避**：插件向会话写任何事件/标记时，必须携带合法的 turn/step 定位；写入前校验当前 session offset。

### 1.3 会话迁移链（v0→v1→v2→v3）整体拒载问题（宿主侧，但影响插件用户）

- [#5909](https://github.com/deepseek-ai/deepseek-harness/discussions/5909)、[#6045](https://github.com/deepseek-ai/deepseek-harness/discussions/6045)、[#6010](https://github.com/deepseek-ai/deepseek-harness/discussions/6010)、[#6189](https://github.com/deepseek-ai/deepseek-harness/discussions/6189)、[#6297](https://github.com/deepseek-ai/deepseek-harness/discussions/6297)、[#6282](https://github.com/deepseek-ai/deepseek-harness/discussions/6282)：单条不合规历史记录即拒绝**整份**日志；`subagent/descriptor` 仅按 version 数字判定；`turn/start N+1` 校验过严；`header.isSeeded` 类型全等校验拒绝 0.1.2-rc.1 写出的会话。

**对插件作者的含义**：用户升级后大量"会话打不开"的报障**不一定是插件导致**，排查时先看是否复现于禁用插件的干净 profile。

---

## 二、插件通道与生命周期陷阱

### 2.1 connection.rpc 通道在 0.1.5 上不可用（405 / 单槽抢占）🔴

> 2026-09-13 实战复盘（dsh-prime-memory 0.1.1-rc.2 → 0.1.5 适配，三轮实测）。
> 这是 0.1.5 插件迁移中**最深的坑**：官方文档样例的 `intercept` 签名是错的，
> 且 405 的真正出路不是文档说的 `intercept`，而是**插件自持 webServer 路由**。

- [#6337](https://github.com/deepseek-ai/deepseek-harness/discussions/6337)：调用 `connection.rpc.handle()` 的插件通道静默失效（HTTP 405）。
- [#6227](https://github.com/deepseek-ai/deepseek-harness/discussions/6227)：`dsh-client-connection@0.1.5-rc.1` 的 `register()` 在未声明 webServer 时崩溃。

**源码级事实**（`@deepseek-ai/dsh-client-connection@0.1.5-rc.2` 实测）：

1. **`rpc.handle(channel, handler)`** 注册 webServer prefix 路由，但该路由在 0.1.5
   的 webServer 分发层静默 405（POST 打进去拿不到 handler）——注册成功 ≠ 可用。
2. **`rpc.intercept(channel, matches, handler)`** 的 channel **只接受 `'/api'`**（传别的直接抛
   `invalid shared RPC channel`）；且 `/api` 的 interceptor 槽是**单槽**——另一个插件已注册时
   抛 `already has an interceptor`。0.1.2-rc.1 与 0.1.5-rc.2 都是单槽（0.1.1-rc.2 反而有
   fallback 链）。先注册的插件（如 dsh-live-token-stats 这类已做 0.1.5 适配的）会独占槽位，
   后注册方抛错——若你的注册包在 try/catch 里，失败是**静默的**，客户端所有请求 404/405。
3. **正确做法（better-sidebar main 分支验证过）**：完全不经过 connection.rpc，直接在插件
   自己的 fiber 上 `ctx.webServer.register({ kind: 'prefix', path: '/your/api', handler(req, res) })`
   自持路由 + 自有信封；客户端用原生 `fetch('/your/api/<method>')`。webServer 精确/
   prefix 路由按路径 key 多插件共存，无槽位竞争。鉴权只需 loopback fence（DNS-rebinding
   防护，connection 不导出其实现，可从 better-sidebar `src/trust-fence.ts` 抄）。

**适配**：
- 0.1.5+ 目标版本：直接采用自持 webServer 路由方案，不要用 `handle` 也不要抢 `intercept`；
- 必须兼容 0.1.1/0.1.2 的：host 半按 `connection.rpc.intercept` → `handle` 顺序运行时回退，
  client 半按 `/api` → 自定义通道顺序重试并记忆（参考 dsh-prime-memory compat/0.1.5 分支）；
- 通道往返必须实测：`dsh plugin add` 成功、宿主无报错 ≠ RPC 可用（405 是请求期才暴露的）。

### 2.2 webServer 授权缺失是**致命崩溃**，运行时检测救不了

- [#5926](https://github.com/deepseek-ai/deepseek-harness/discussions/5926)：插件注册 HTTP channel 时 `cannot get property 'webServer'`，connection 无法启动。
- [#5889](https://github.com/deepseek-ai/deepseek-harness/discussions/5889)：rpc 通道注册访问未声明的 `owner.webServer`（附一行修复）。

**实战修正**（2026-09-13）：0.1.5 起 `connection.rpc.handle()` 的路由登记按**调用方 fiber** 校验
webServer 授权，缺失时抛 `cannot get property "webServer" without inject` 并**拖垮整个宿主启动**
（`dsh: fatal load failure`），不是可降级错误。唯一解法是在插件入口**声明式注入**：

```ts
// src/index.ts —— 0.1.5 上走 RPC/HTTP 通道的插件必须声明
export const inject = ['llm', 'tools', 'connection', 'webServer']
```

`connection` 与 `webServer` 在 0.1.1-rc.2 ~ 0.1.5 均存在，旧版多声明无害。注册逻辑外仍应包
try/catch（把授权模型再变化时的崩溃降级为功能不可用），但不要指望"运行时 `ctx.get` 探测 +
缺失跳过"能救——服务代理存在，抛错发生在**属性访问/方法调用**时。

### 2.3 客户端半声明式注入缺失服务 → apply 永久挂起，UI 全静默消失 🟡

**实战发现**（2026-09-13，无讨论区编号）：客户端入口 `export const inject = ['slots', 'connection']`
中，若 `connection` 在该宿主上缺席（版本差异）或晚到，cordis 让 **apply 永久等待**——
不报错、不崩溃，表现为输入栏 pill / 设置面板**全部不渲染**。极难排查（Console 无任何输出）。

**正确姿势**（2026-09-17 校准：区分**常备服务**与**可选服务**，两个方向都会翻车）：
- shell 常备服务（`slots`/`locale`/`settingsScope`）**声明式 inject**——懒取它们会引入激活竞态：settings 客户端晚于本插件激活时 `ctx.get` 返回 undefined，早退后设置入口全静默消失（dsh-context-compression-improved 0.1.0 实录）；
- 可选服务（`connection` 等，缺席是合法状态）调用点懒取：`const conn = ctx.get('connection')`，缺席时功能降级；
- 客户端 apply 入口加一行 `console.info('[plugin-id] client apply')` 诊断点——
  UI 不显示时第一步先看这行有没有出，出 = 注册层问题，不出 = 加载/注入层问题；
- 席位注册配 seat-pin 契约测试钉死（[settings-seat-pinning.md](settings-seat-pinning.md)）。

**辅助判别**：slot 槽名是否变更（如设置面板席位随版本演变：`settings.section` 直挂 / `settings.plugin.item` keyed 卡片 / `settings.plugins.tab` 独立页——0.1.5 三槽均声明，**单席位**注册）属注册层问题，与注入挂起同症状，用诊断日志区分。

### 2.4 改写 cordis.patch.yml 触发热重载，静默销毁在途回合

- [#6298](https://github.com/deepseek-ai/deepseek-harness/discussions/6298)：开发期改写 `cordis.patch.yml` 触发热重载，所有存活会话的在途回合被静默 aborted/disposed。

**规避**：开发期热重载仅用于 UI 调试；涉及 host 半配置变更时提醒用户会话会被中断。

### 2.5 profile 内出现第二份核心包 → Symbol/instanceof 跨实例失效

- [#6416](https://github.com/deepseek-ai/deepseek-harness/discussions/6416)：profile 内出现第二份核心包时 Symbol/instanceof 跨实例失效，工具派发崩溃（`reading 'prepare'`）。

**规避**：插件**绝不要**打包/携带 `@deepseek-ai/*` 核心包副本，一律声明为 peerDependencies（`optional`）。

---

### 2.6 路由注册成功与否无法从代码判断：用 401/404 差分实测 🔴

**实战发现**（2026-09-14，`dsh-context-compression-improved` @ `feat/ctx-preset-v2`，宿主 0.1.2-rc.1）：
源码里 `ctx.inject([...], c => { c.webServer.register({ kind: 'exact', path, handler }) })` 写得完全正确，
**但运行时该路由从未注册**——客户端拿不到数据，UI 静默无候选，源码层面完全看不出问题。
（与 §2.1「注册成功 ≠ 可用」同族：那条是"注册了但被静默吞"，这条是"根本没注册上"。）

**为什么 401 会骗人**：未注册的 `/api/...` 会落到 SPA 鉴权门
（`dsh-client-connection/lib/index.js:419` `writeUnauthorized()`，正文 `dsh web authentication required; reopen the URL printed by dsh web.`），
返回 **401 —— 与"缺凭据"同码不同因**。已注册的路由在鉴权门**之前**被匹配。于是有可复用判据：

| 请求（裸 HTTP，无凭据） | 实测 | 判据 |
| --- | --- | --- |
| 同宿主同刻的**真实注册**路由（对照，如 `/api/dsh-perm-gate/receiver`） | `200` | 对照组 |
| `/api/<任意乱码>` | `401` | 基线：未注册 |
| 被测路由 | `401` | ⇒ **未注册**（与乱码无法区分） |
| `/endpoint/<任意>` | `404` | 旧前缀在本宿主不存在 |

**判据用法**：用裸 HTTP 客户端取**同一时刻**的真实路由与乱码路由做三方对照。
被测路径与乱码同码 ⇒ 未注册；与真实路由同码 ⇒ 已注册。**不需要宿主日志**，可在任何插件上原样复用。

**硬性要求（把静默失败变成可定位失败）**：
- 服务缺失时**必须 warn**（含缺失服务名），禁止 `if (webServer === undefined) return` 式静默返回；
- 注册后**自证**：断言 disposer 数量并打印已注册路径；
- 客户端 `fetch` 只认 `response.ok`，401/404 一律被当成"服务不存在"吞掉——**不要在客户端侧推断服务端状态**；
- `export const inject = [...]` 区分两类：shell 常备服务（slots/locale/settingsScope）声明式，可选服务懒取（与 §2.2/§2.3 同源纪律；两向误用都会全静默消失，见 §2.3 正确姿势）。

**前缀**：客户端 API 前缀随宿主世代变化（0.1.1/0.1.2 = `/endpoint`，0.1.5+ = `/api`）。
实测 0.1.2-rc.1 宿主上 `/endpoint/*` **恒 404**——"两条前缀都注册、客户端依次尝试"是安全的，
但要清楚旧前缀那条在当前宿主是**纯无效往返**。

**单测盲区**：把数据源当 mock 注入的组件用例**永远测不到"路由未注册"这一层**（实测 5 条用例全绿而真机不可用）。
必须补宿主侧守门（注册返回值断言）或负向用例。

**根因案例与可照做的复现脚本**：见 `../DSH-ccp-estimator卡片-路由静默未注册与保存感知-20260914.md` §2/§4（本文只留通用规则）。

## 三、客户端 bundle 陷阱（0.1.5 升级高发）

### 3.1 升级后 client combo 陈旧，插件树整体不激活

- [#5999](https://github.com/deepseek-ai/deepseek-harness/discussions/5999)：升级既有 profile 后 client combo 缺失新增 bundle 模块（`ui-sidebar-*` 404 / loaded without registering），全部 client 插件不激活。
- [#6081](https://github.com/deepseek-ai/deepseek-harness/discussions/6081)：Web bundle 应声明模块 → webServer 激活依赖（提案）。
- [#6374](https://github.com/deepseek-ai/deepseek-harness/discussions/6374)：served index.html 缺 `Cache-Control: no-store`，重建后缓存的文档破坏 boot。

**插件侧规避**：用户报障"升级后插件全部消失"时，先让用户**强制刷新浏览器**（清缓存）再排查；插件 README 的排障章节应写明这一点。

### 3.2 bundle 内 eagerly-evaluated 依赖会中止整个插件加载

- [#6362](https://github.com/deepseek-ai/deepseek-harness/discussions/6362)：Chromium < 122 下，`ui-sidebar-documentpreview` 中的 eagerly-evaluated pdf.js 中止插件加载，Web shell 无法启动。
- [#6180](https://github.com/deepseek-ai/deepseek-harness/discussions/6180)：`dsh-client-ui-sidebar-right` 对未随版本发布的 `dsh-client-ui-dockkit` 有 43 处硬引，Web 客户端必然加载失败。

**规避**：
- 重依赖（pdf.js、molstar 等）做**懒加载**（动态 `import()`），不要在模块顶层求值。
- 不硬引用未随当前 DSH 版本发布的新包；新包用运行时检测 + 降级。

### 3.3 dsh-client-store 曾缺 Zustand/Immer 运行时依赖

- [#6082](https://github.com/deepseek-ai/deepseek-harness/discussions/6082)：0.1.5-alpha.2 发布的 `dsh-client-store` 遗漏 Zustand/Immer 运行时依赖。

**规避**：插件如直接依赖 store 生态库，在自己的 peerDependencies 中显式声明，不要假设宿主包传递依赖完整。

---

## 四、配置与升级流程陷阱

### 4.1 配置字段重命名无迁移（官方前车之鉴）

- [#5915](https://github.com/deepseek-ai/deepseek-harness/discussions/5915)、[#6342](https://github.com/deepseek-ai/deepseek-harness/discussions/6342)：官方 `dsh-persona` 在 0.1.5-rc.1 把 `config.text` 重命名为 `prefix`，无迁移提示，用户预设无法挂载、无法创建新会话。
- [#6415](https://github.com/deepseek-ai/deepseek-harness/discussions/6415)：非法 preset 配置 → cordis 无限 reload + ~2GB 内存泄漏后 OOM，且完全静默。

**插件侧规范**：
- 配置字段重命名必须**双读兼容**（读新字段，回退旧字段），至少保留一个大版本的过渡期。
- 对非法/缺失配置**响亮报错**，不要进入无限重载或静默降级。

### 4.2 Node < 24 静默失败（import.meta.main 守卫）

- [#6124](https://github.com/deepseek-ai/deepseek-harness/discussions/6124)：DSH 0.1.5-rc.1 在 Node < 24 上完全静默失败（`import.meta.main` 守卫 + 未声明 engines）。
- [#6373](https://github.com/deepseek-ai/deepseek-harness/discussions/6373)：`pnpm run build` 在 tsx 下静默不做任何事（`import.meta.main` 守卫永不为 true）。

**插件侧规范**：
- 插件构建脚本如果用 tsx/`import.meta.main` 模式，入口改为显式 `main()` 调用，不用 main 守卫。
- `package.json` 声明 `engines.node`（DSH 0.1.5 要求 Node ≥ 24）。

### 4.3 社区升级流程实践（可直接引用）

- [#6137](https://github.com/deepseek-ai/deepseek-harness/discussions/6137)（[ybl2020/dsh-upgrade](https://github.com/ybl2020/dsh-upgrade)）：推荐四阶段升级流程——**升级前评估 → 审核放行 → 升级 → 验证**，附 7 个实测坑。

**建议给用户的升级顺序**：
1. 备份 profile（含 sessions 目录）
2. 干净 profile 启动新版 DSH，确认宿主本身可用
3. 逐个装回插件并验证
4. 遇到"会话打不开"先区分：禁用插件复现？→ 宿主迁移问题；仅启用某插件复现？→ 插件问题（回到 §1/§2 排查）

---

### 4.4 多线维护期的工程陷阱（dsh-perm-gate 三线实证）

维护 main/legacy/compat 多条长期分支的插件，升级适配期特有的坑（2026-09-14 session-sweep 三线同步实战）：

- **修复合并在功能里一起跨线移植。** 目标线可能缺源线工作区里的未提交修复——实证：main 的已提交 HEAD 缺一个 import（修复只在工作区），切出的分支 typecheck 直接挂；而 compat/0.1.5 线早已自带该修复。移植前先确认目标线与源线的该文件 diff。
- **观察宿主自有存储的插件：解析失败 = 本轮跳过。** 依赖宿主数据文件（如 `~/.dsh/storages/workspace.json`，格式带 `unit.version`）的插件，升级后格式可能漂移；只读 + 容错解析 + fail-open，宿主改格式时插件自动降级而不是炸掉（详见 [compatibility-guide.md](compatibility-guide.md) §18）。
- **同一条修复不要在 N 条线各写一遍。** 逐线 cherry-pick/移植并各线独立跑测试（各线测试数不同是正常的，如 273/278/279），禁止"在一条线上验证，假定其余线同样成立"。

## 五、其他插件相关已知问题速查

| # | 问题 | 影响的插件场景 |
|---|---|---|
| [#6157](https://github.com/deepseek-ai/deepseek-harness/discussions/6157) | 插件 slash-command 输出在空白会话的首次动作时不可见 | 提供 slash command 的插件 |
| [#6166](https://github.com/deepseek-ai/deepseek-harness/discussions/6166) | 空白会话切换到已加载 preset 时丢失 subagent 工具 | 依赖 subagent 工具的插件 |
| [#5926](https://github.com/deepseek-ai/deepseek-harness/discussions/5926) | 第三方插件注册 HTTP channel → connection 启动失败 | RPC/HTTP 通道插件 |
| [#6162](https://github.com/deepseek-ai/deepseek-harness/discussions/6162) | 会话接续后，后台子代理完成报告仍投递给旧会话，父会话不在册时静默丢弃 | 后台子代理类插件 |
| [#6219](https://github.com/deepseek-ai/deepseek-harness/discussions/6219) | 会话 token 计数不含 teammates（低估 2.3×） | 基于 `ctx.tokenMeter` 做计费/统计的插件 |
| [#5887](https://github.com/deepseek-ai/deepseek-harness/discussions/5887) | `dsh-client-ui-settings-plugins` 子项配置卡片消失 | 注册 settings 卡片的插件 |
| [#5954](https://github.com/deepseek-ai/deepseek-harness/discussions/5954) | settings 里引用的孤儿模型使 llm-pi-ai 整体激活失败（静默） | 写 settings 命名空间的插件 |
| [#6221](https://github.com/deepseek-ai/deepseek-harness/discussions/6221) | settings 写入会删除外部编辑加入的同命名空间新 key | 直接写 settings 文件的插件 |

---

## 六、排障决策树

```
DSH 升级后插件异常
├─ 所有插件都不激活 / client 404
│   → §3.1 强制刷新浏览器 + 清缓存（client combo 陈旧）
├─ 旧会话打不开
│   ├─ 禁用全部插件后复现 → 宿主迁移链问题（§1.3），等官方修复/降级
│   └─ 仅某插件启用时复现 → §1.1 / §1.2（插件写入了非法 source/marker）
├─ 插件加载即崩 / 宿主 fatal load failure
│   → §2.2（webServer 授权缺失）、§3.2（eager 依赖 / 硬引用未发布包）、§2.5（重复核心包）
├─ 插件 UI 全部不渲染但无报错
│   → §2.3（客户端声明式注入挂起）——apply 加诊断日志区分加载层/注册层 → slot 槽名变更
├─ 插件 RPC / HTTP 通道不通（注册成功但 404/405，或被其他插件抢占）
│   → §2.1（自持 webServer 路由方案 + handle/intercept 三层真相）
├─ 用户预设 / 配置挂载失败
│   → §4.1（字段重命名无迁移，双读兼容）
└─ 构建脚本 / 进程静默不做事
    → §4.2（import.meta.main 守卫 + Node 版本）
```


## 七、0.1.5 实测新增陷阱（dsh-context-compression-improved 适配实证）

> 以下条目来自一个 compaction 深度插件（直接依赖 tokenMeter/session/surface 写路径）从 0.1.1-rc.2 → 0.1.5-rc.2 的完整适配实测（2026-09-14），全部在本机复现并验证修复。

### 7.1 `await ctx.plugin(X)` 不再等待插件就绪 🔴

- **症状**：`await ctx.plugin(TokenMeter)` 后 `ctx.get('tokenMeter')` 仍为 `undefined`，后续服务调用全是 `Cannot read properties of undefined (reading 'measure' / 'pruneSession')`，且无任何报错。
- **原因**：cordis 语义变化——`await ctx.plugin(X)` 只等 fiber 创建，不等插件 apply 完成；必须显式 `ctx.plugin(X).await()`。
- **修复**：测试与脚本中所有插件挂载一律 `.await()`；宿主入口里顺序敏感的挂载同样处理。
- **连带**：TokenMeter 声明 `static inject = ['sessionProjections']`，挂载前必须先 `ctx.plugin(SessionProjectionRegistry).await()`，否则 service 永远不落地（静默）。`mountAgentLoopTestDependencies` 已内置该 registry，再手动挂一份会报 `service "sessionProjections" has been registered`。

### 7.2 Session V3 seed-reopen 不进 firehose：Native auto-compact 审计/监听丢失 🔴

- **症状**：官方 compaction-basic 明明提交了 `compaction/summary`（`snapshotEvents()` 里能看到），但插件的 `ctx.on('session/event')` 监听从不触发。
- **原因**：0.1.5 的 Native auto-compact 通过**会话 seed-reopen** 落盘——压缩后日志作为构造 seed 重开 Session，而文档明确 "constructor seeds do not emit"（seed 事件不发 firehose）。
- **修复**：不能只依赖 firehose，在可靠边界扫描快照补发：`pruneSession()` 入口、pre-step 钩子 `next()` **之后**（compaction-basic 的 auto-compact 发生在插件 pre-step 处理之后）、turn-stopping；按 manifest seq 去重。
- **推论**：任何依赖"每个事件都过一遍 firehose"的插件（审计、索引、投影）在 0.1.5 都要补快照扫描路径。

### 7.3 strict semver 预发布规则：`0.1.5-rc.2` 不满足 `>=0.1.1-rc.2 <0.2.0` 🔴

- **症状**：`pnpm add` 报 `No matching version found for @deepseek-ai/dsh-invariants@>=0.1.5 <0.2.0-0`（该范围是 pnpm 对多个 peer 声明求交后的渲染），而 registry 明明有 0.1.5-rc.2。
- **原因**：npm semver 规定预发布版本只匹配"同一 [major,minor,patch] 元组上带预发布比较器"的范围。`>=0.1.1-rc.2` 的元组是 (0,1,1)，`0.1.5-rc.2` 的元组是 (0,1,5) → 不匹配。旧写法在 0.1.1-rc.2 是当期版本时恰好能用，宿主升到 0.1.5 即失效，并与官方包的 `^0.1.5-rc.2` 求交为空。
- **修复**：跨 rc 线 peer 一律带 `-0` 上界后缀：`">=0.1.5-rc.2 <0.2.0-0"`（`<0.2.0-0` 排除 0.2.0 预发布、放行 0.1.x 全部预发布）。已适配插件（dsh-input-traffic、dsh-thinking-levels 等）均用此写法。
- **注意**：`engines.dsh` 同理，用 `>=0.1.5-alpha.1 <0.2.0-0`。

### 7.4 `core.autocrlf=true` 静默损坏字节钉死资产 🟡

- **症状**：tokenizer golden 测试集体失败：`DeepSeek tokenizer asset tokenizer.json failed SHA-256 verification`，实际 6,634,504 字节 vs 钉死的 6,367,146（差值 = 行数，正好是 LF→CRLF 的量）。
- **原因**：仓库无 `.gitattributes` 且 `core.autocrlf=true`——checkout 往返把 LF 转 CRLF，fail-closed 的 SHA-256 校验拒绝。blob 本身是好的，只是工作区字节变了；且 blob id 未变时 `git checkout <ref> -- path` 不会重写 stat 匹配的文件，需先删再检。
- **修复**：`.gitattributes` 对资产目录声明 `-text`（如 `packages/runtime/assets/** -text`），然后强制重检资产。
- **推论**：任何"字节完整性校验"资产（tokenizer、wasm、模型清单）的仓库都应把资产标记为不做行尾转换，并把 `.gitattributes` 纳入发布前检查。

### 7.5 临时 consumer 被祖先 pnpm workspace 吸收 🟡

- **症状**：e2e 在 `%TEMP%` 下建 consumer 目录做 `pnpm add`，包装进了 `C:\Users\<user>\node_modules\.pnpm`；若用户主目录恰有 `package.json` + `pnpm-workspace.yaml`（很常见），pnpm 工作区向上吸收把整个安装落到 consumer 之外，插件内"产物必须解析自 consumer"的守卫全部失败。
- **修复**：consumer 里写入独立 `pnpm-workspace.yaml`（`packages: ['.']`）阻断向上吸收；排障时先查祖先链上的 workspace 配置。

### 7.6 Windows 本机跑 CI 向测试的环境差异 🟢

- POSIX mode 断言（`stat().mode & 0o777` 期望 `0o700`）在 NTFS 上永远返回 `0o666`（chmod 忽略权限位）——用 `process.platform !== 'win32'` 门控。
- 依赖文件 mtime 精度的测试（whole-second 戳碰撞/升级窗口）在 Windows 抖动、单独重跑可过；CI（Linux）稳定。
- 测试内 `spawn('npm', ...)` 在 Windows 报 ENOENT，需 `shell: process.platform === 'win32'`。

### 7.7 0.1.5 API 变更速查（写路径/客户端，详见 compatibility-guide §二十）

- surface 替换：`{ op: 'replace', start, end }` → `{ op: 'replace', startSeq, endSeq }`（值需 `SessionSeq()` 品牌化）；**但** `compaction/prune` 事件的持久化数据仍是 `shadowedRange: { start, end }`（字段名不变、值品牌化）——两处不对称，别一起改。
- `agentLoop.create()` 返回 `Promise<Agent>`，要 `await`。
- `settingsNamespace()` 包装函数删除，命名空间为运行时校验的普通字符串。
- 官方包 peer 闭包暴涨：0.1.5 拆出 `dsh-session-projection`、`dsh-session-persistence`、`dsh-atomic-write`、`dsh-home-paths`、`dsh-sandbox`、`dsh-user-approval`、`dsh-llm-retry` 等，e2e/mock registry 清单必须覆盖，否则 consumer 解析失败。

---

## 八、0.1.6 / 0.1.7 实测新增陷阱（源码实证，2026-09-25 校准）

> 来源：`deepseek-harness` 检出 `dsh-v0.1.7-rc.1`（`46a7f68b09`）对 `dsh-v0.1.6-alpha.1` 的逐行差异核实。
> 与 [compatibility-guide.md](compatibility-guide.md) §二十一、[v0.1.7-migration.md](v0.1.7-migration.md) 配合阅读。
> **本节的共同特征：失败形态大多是「静默」——这正是它们值得单列的原因。**

### 8.1 `settings.installSection()` 被删除：设置入口静默消失 🔴

- **症状**：升级到 0.1.7 后，插件功能一切正常，但**设置页里再也找不到它的表单/页面**；Console **无任何报错**，apply 日志正常。
- **原因**：`settings.installSection(...)` 已从宿主**彻底删除**（0.1.5-rc.2 与 0.1.6-alpha.1 各 15 处引用 → 0.1.7 **0 处**）。它**没有兼容垫片**，旧调用在不同版本上表现为：≤0.1.6 生效；0.1.7 上不再是函数（或被静默忽略），入口随之消失。
- **定位**：在插件源码里搜 `installSection`（应为 0 处）；再搜 `configure(`（应为 1 处，且位于 `ctx.inject(['settings'], …)` 子上下文的 effect 内）。
- **修复**：改用

  ```ts
  ctx.inject(['settings'], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber))
  })
  ```
- **连带必做**：把需要热改的字段在 Config 上声明为 `Volatile<T>`——否则即使注册成功，**表单里也不会出现这些字段**（表单只暴露 `.volatile()` 字段）。`.volatile()` 在 0.1.6 完全不存在（实测 0 个文件），是本版新机制。

### 8.2 `settings.plugin.item` 席位被移除：注册不报错，只是不再显示 🔴

- **症状**：插件仍注册 `settings.plugin.item`，无报错，但内置"配置"列表里没有它的卡片。
- **原因**：该席位在 0.1.7 **已移除**（0.1.5/0.1.6 = 13 个文件，0.1.7 = **1**，且仅剩 `ui-settings-models/src/client/slot-contract.ts` 的一处历史注释）。存活的是 `settings.plugins.tab`（8）与 `settings.section`（21）。
- **修复**：小型配置优先**不注册席位**，改用 `.volatile()` 让宿主 schema 派生表单；需要自定义布局则改 `settings.plugins.tab`。
- **钉死**：seat-pin 测试里加 `expect(declared).not.toContain('settings.plugin.item')`。见 [settings-seat-pinning.md](settings-seat-pinning.md)。

### 8.3 `settings.yaml` 被移除：写入的值不再被读取 🔴

- **症状**：升级后按老办法往 `$DSH_HOME/settings.yaml` 写配置，**完全不生效**；文件在首次写入后被改名为 `settings.yaml.imported`。
- **原因**：全局设置文档已移除，设置权威迁到**活动 profile 的 `cordis.patch.yml`**。旧文件只在 Settings 启动且 Loader settle 所有 entry 时**一次性导入**（section id 即 entry id，另有三条映射 `ui-developer-tools`→`ui-settings`、`ui-onboarding`→`ui-settings-general`、`shell`→平台 executor entry），随后改名，**导入永不重复**。
- **额外风险**：被运行组合拒绝的 section **只留在改名后的文件里**（仅记日志）——如果你的旧配置"看起来还在"却"不生效"，先查 `.imported` 里有没有它。
- **修复**：改在目标 profile 的 `cordis.patch.yml` 里按 entry id 写；自动化脚本删除对 `settings.yaml` 存在的断言。**跨 profile 共享设置已不再可能**（持久化的表单值是 profile 专用的）。

### 8.4 兼容性拒装/拒启：报 `incompatible-version`，但校验的不是 `engines.dsh` 🔴

- **症状**：安装或启动时报 `incompatible-version`，但你的 `engines.dsh` 明明写得很宽松。
- **原因**：校验读的是 **`peerDependencies`** 中 `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` 的范围（`packages/boot/app-boot/src/plugin-compatibility.ts:61-88`），与 `engines.dsh` **无关**。官方原文：`app-boot/README.md:52`「These checks use peer declarations, not `engines.dsh`」、`package-manifest/README.md:93`「do not enforce `dsh.manifestVersion` or `engines.dsh`」。
- **易踩点**：
  - `workspace:^` / `workspace:~` / `workspace:*` 被解释为**当前运行时版本**（`:76`）；
  - 该校验 **`includePrerelease: true`**（`:77`），所以 `>=0.1.5-rc.2 <0.2.0` 在此路径下**能**匹配 `0.1.7-rc.1`——别据此推断 pnpm 也这么宽松；
  - 无 `peerDependencies` 字段者**直接判兼容**（`:68` 早退）。
- **修复**：把兼容性约束写进 `peerDependencies`（与宿主共享单例的包**必须同行再写一份进 `devDependencies`**）；确需跨版本强制安装时用精确版本豁免：

  ```sh
  dsh plugin --profile <p> allow-version <pkg@ver> --dsh-version <runtime> --accept-risk
  ```
- **注意**：豁免是**插件版本 + 运行时版本双精确**，不是范围豁免；`version-exemptions` 可查、`revoke-version` 可撤。

### 8.5 `dsh.profile.patchReload` 被移除：热重载静默失效 🔴

- **症状**：自写 profile 清单里的 `patchReload` 不再起作用，补丁改动只在重启后生效（或完全不生效）。
- **原因**：`DshProfileManifest.patchReload` 与 `ProfilePatchReload` 类型**整段删除**。热重载改由 **YAML 内的 `dsh-hmr` 行**控制：base 启用 config-only `dsh-hmr`，`headless` / `sdk` / `acp` **禁用**，`sdk-minimal` **完全省略**；profile 补丁可覆盖这些默认值。
- **修复**：从 profile 的 `package.json` 删掉 `patchReload` 键；需要热重载就在 YAML 启用 `dsh-hmr` 行；不要在 headless / SDK / ACP profile 上假设补丁会被热应用。

### 8.6 HMR 包改名：模块找不到 🔴

- **症状**：升级后组合加载失败，报找不到模块。
- **原因**：`@deepseek-ai/cordis-plugin-hmr` → **`@deepseek-ai/dsh-hmr`**（官方 `docs/user/develop/framework/index.md` 区间 diff 只有这一行；提交 `d06e6b5519`）。
- **修复**：把所有 `cordis.yml` / `cordis.patch.yml` 中的旧包名换成新包名。

### 8.7 会话格式 V4：旧插件读不到新数据，且**不可回退** 🔴

- **症状**：插件直接读 `session.jsonl` 时读不到最新会话；或解析工具结果时字段缺失。
- **原因**：`SESSION_FORMAT_VERSION` **3 → 4**。写入的是 `session.vN.jsonl` 命名（v0 例外为 `session.jsonl`）；V4 中 `tool-result` 退出 content-block 联合，工具结果成为 **tool-role 消息**（必需 `toolCallId`、可选 `isError`）；生产者自有 source 取代插件包装器；`turn/end.reason` 新增 `forked`。
- **不可回退**：V3 reader **拒绝**更新的代际，官方**不支持降级**。且官方明确 rc 级发布**即已建立已发布格式义务**——"prerelease" 不意味着数据可丢。
- **修复**：不要直接读写会话文件；改用 `SessionPersistence`（`create`/`open`/`stat`/`list`/`export`）或 `ctx.sessions`。处理 tool 结果时改按 tool-role 消息与 `toolCallId`/`isError` 读取。
- **顺带**：若你的插件曾写过自定义 message source kind，请先读 §1.1——那类做法在旧版就会导致会话永久拒载，在 V4 上后果更重。

### 8.8 `agent-team-web-profile` 被整包删除：既有 profile 启动即失败 🔴

- **症状**：升级后某个 profile **启动失败**，报包解析不到。
- **原因**：`packages/experimental/agent-team-web-profile` 被**整包删除**（8 文件 / −303）。**这不是改名**——0.1.6 时 `agent-team-profile`（Host 层）与 `agent-team-web-profile`（Web-only 层）**两者并存**；本版删除后者，把它唯一那行 `ui-agent-team` 并入前者。
- **官方立场**：bundle 组合**不提供**对已保存选择的自动改写；note 的 `## Consequences` 明确把兼容处理排除在该决策之外，其 `## Verification` 也自陈**不覆盖**升级场景。
- **修复**（官方 README 给出的手工修法）：在既有 profile 的 `package.json` 里**保留 `agent-team-profile`、删掉 `agent-team-web-profile` 条目**。用户级 patch 针对 `ui-agent-team` 行的覆盖仍然生效（该行的 id 与 name 都没变）。

### 8.9 存量 LLM 配置硬失败：DeepSeek 彻底 Messages-only 🔴

- **症状**：升级后 LLM 相关配置直接抛错，而不是回退到默认协议。
- **原因**：`packages/llm/llm-deepseek/src/protocols/` 目录（上版含 `chat-completions/`）**已不存在**；源码检索 `chat-completions` 系列 **0 命中**；`config.ts:215-217` 对传入 `protocol` 键**直接抛 `protocol is not configurable`**。`DEFAULT_MODELS` 也从 4 个减到 2 个（`deepseek-flash`、`deepseek-v4-pro`）。
- **修复**：删除 cordis 配置中所有 `protocol:` 键（出货配置本就不含它）；核对你引用的模型 id 仍在 `DEFAULT_MODELS` 内。

### 8.10 配置覆盖会"钉住"volatile 字段：改了默认值也传不到用户 🟡

- **症状**：新版插件把某个 volatile 字段的默认值改了，但**编辑过设置的用户**仍看到旧值。
- **原因**：Cordis config patch **替换整条 entry 的 config**。用户一旦通过表单编辑，**整条 entry 的完整 config 会被写进 profile 行**——写时组合出的普通字段加上**每一个** volatile 字段。此后 bundle 对这些字段的改动**不会到达该 profile**，除非移除该 entry 的 config 覆盖。官方在 shipped bundles 中列举的真实实例：`permission.presets`、`agent-presets`、`agent-loop.agents`、`web-search-deepseek.apiKeyEnv`；且**客户端会把该行每个 volatile 字段都标为"已覆盖"**，不只被编辑的那个。
- **官方定的性**：这是当前限制（"Narrowing a write to the edited fields needs merge semantics for patch `config`, which Include does not provide."）。
- **规避**：把"改默认值"设计成对用户可见的 reset 引导；或在插件侧对旧覆盖值做显式兼容读取。

### 8.11 客户端模块 rev 语义变化：自建缓存会误判 🟡

- **症状**：自建 SSR/预加载清单的插件发现"内容没变但 rev 变了"或反之。
- **原因**：行 rev 从**内容哈希**（脚本字节 + source map）改为 **mtime / ctime / size 派生**，**不哈希字节**；官方明示收益是"相同产物跨 Host 重启保持相同 rev"。`artifactBaseline` 新增 `ctimeMs`（覆盖"写入但保留 mtime"的情形）；source map 改为**首次 `GET` 惰性读取并缓存**，map 体由首次 GET 固定。
- **修复**：不要再假设 rev 与字节内容一一对应；改读 `ctx.clientModules.graph()` 或新增的 `fetchBundle()`。

### 8.12 统计与排障口径（本机方法论，非 DSH 变更）🟢

- **本机 `pwsh` 实为 Windows PowerShell 5.1**（`$PSVersionTable.PSVersion` 实测 5.1.26100.x）：`Get-Content | Measure-Object -Line` 与 `(Get-Content).Count` 读取**含非 ASCII 的 UTF-8 无 BOM** 文件会**少算行数**（实测同一份 933 行文档被算成 752 行）。统计行数请用 `[System.IO.File]::ReadAllLines($p).Count` 或 `git diff --numstat`。
- **在仓库根使用 `Get-ChildItem -Recurse`** 会跟进 `vendor/`、`node_modules` 符号链接并超时；改用 `grep` 工具或限定目录。
- **枚举包时不要用磁盘目录**：`packages/experimental` 磁盘枚举实测返回 **21** 项（多出的 `agent-team-web-profile` 只有 `lib/` 与 `node_modules/`，**无 `src/`、无 `package.json`**，是构建残留），而 tag 树查询是 **20** 项。**以 `git ls-tree -d <tag>:packages/<group>` 为准。**

---

*生成时间：2026-09-13　|　数据源：`dsh-discussion-summary/incremental-2026-09-12/`（#5886–#6442，544 篇增量讨论）*
*2026-09-13 增补：§2.1–§2.3 源码级复盘与修正方案来自 dsh-prime-memory 0.1.1-rc.2→0.1.5 适配实战（三轮实测，参考 better-sidebar main 已验证实现）。*
*2026-09-14 增补：§七 来自 dsh-context-compression-improved compat/0.1.5 分支适配实测（compaction 深度插件；firehose/seed-reopen、semver 预发布规则、cordis `.await()` 语义三类新坑）。*
