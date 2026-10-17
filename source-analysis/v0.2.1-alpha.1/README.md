# DSH v0.2.0-rc.2 → v0.2.1-alpha.1 变更说明（更新要点）

> **数据源**: `deepseek-ai/deepseek-harness` 官方仓库
> **标签对比**: `dsh-v0.2.0-rc.2` (`639ed01539`) → `dsh-v0.2.1-alpha.1` (`5badb15009`)
> **发布日期**: 2026-10-03 ｜ **发布提交**: `ec48669f48 release(dsh): 0.2.1-alpha.1`
> **发布 PR**: [#5648](https://github.com/deepseek-ai/deepseek-harness/pull/5648)（merge `worktree/release-dsh-0.2.1-alpha.1`）
> **性质**: 0.2.1 线首个 alpha，**三条契约面收缩/换代 + 一个新能力族 + 插件生命周期行为升级**，共 266 个提交（201 非 merge + 65 merge）
> **统计**: 4190 files changed, +51032 / −32761
> **结构变化**: `packages/` **4 新增 / 1 删除 / 1 改名**——新增 `schedule/tool-schedule`、`experimental/claude-code-mods`、`experimental/client-ui-claude-code-mods`、`experimental/session-inspector`；删除 `runtime-diagnostics/invariants`；`experimental/schedule-bundle` 改名（R065）为 `experimental/inspector-profile`（schedule bundle 正式退役，目录易主）
> **持久化契约**: `SESSION_FORMAT_VERSION` **保持 4**；窗口内**无新增持久化承认**（`docs/persistence-changes/` 零新增）
> **插件契约**: peer 兼容性校验（`plugin-compatibility.ts`）、manifest schema、settings 核心（`plugin-config`）、加载器**零 diff**；但 **HMR 新增包配置过期机制**（`packages/boot/hmr/src/package-manifest.ts` +330 行，行为升级）、**子路径插件显示面换代**（不再读 `<subpath>/package.json`）、**runtime invariants 全家删除**、**schedule bundle 退役改 preset 贡献制**——四条都有官方升级指南（`docs/upgrade-guide/v0.2.0-rc.2/`）

---

## 一句话总结

0.2.1-alpha.1 是 **"Schedule 换挂载方式 + Claude Code mods 进门 + 插件运行时解析活过来"** 的一次发布——core 契约面（peer 校验 / manifest / settings / 会话 V4）原封不动，但围绕"包与插件的安装/显示/挂载"动了一次的中等规模手术：

- **Schedule 生态重组**（三条官方升级指南之首）：rc.1 引入的 opt-in bundle `@deepseek-ai/dsh-experimental-schedule-bundle` **退役**；`@deepseek-ai/dsh-web-app` 改为在**每个 Web profile** 直接挂载 `schedule` + `ui-schedule`，`standard`/`cordis`/`ptc` preset 各自声明时钟行（`time-context`）与四个 `schedule_*` 工具（经新包 **`@deepseek-ai/dsh-tool-schedule`**，preset 作用域按需挂载，`minimal` 两者皆无）；子代理被 **`toolFilter.deny`** 挡在四个提醒工具之外，service 层对 subagent 路由持有的 Session 返回结构化拒绝；加载 profile 时自动从 `dsh.profile.bundles` 摘除旧 bundle 并重写 `package.json`，存量任务与投递记录原地保留。**顶层对 `time-context` 的 override 不再命中任何行**（时钟行归 preset 所有），必须删除；
- **Claude Code mods 桥**（新能力族，experimental）：`@deepseek-ai/dsh-experimental-claude-code-mods` 用 `defineMod` 把 Anthropic Claude Code 的 mods（`register(on, options)` 钩子模型）原样跑成 DSH 插件——`session.start` / `prompt.submit`（改写/丢弃）/ `tool.call`（observe/deny/改写结果）/ `ui.render`（提示符上方 band）等事件映射到 Cordis 瀑布流，`$` 门面（`$.tool.call` / `$.http.fetch` / `$.state` / `$.ui` / `$.command.register`）按 Claude Code 语义提供，工具名别名表（`Bash↔bash`、`Task↔subagent`…）+ `toolAliases` 扩展；配套 `client-ui-claude-code-mods` 把 band 投到 Web。官方定位是**接口兼容性演示**（未覆盖的事件在加载时点名警告）；
- **插件运行时解析刷新 + HMR 包配置过期**（设计记录 `2026-09-30-profile-package-refresh-and-manifest-invalidation`）：此前 runtime resolution **只在启动时构建**，GUI 装包/启停后新代际不发布——私有依赖找不到、bare 插件不可见；现在 Plugin Manager 在 install/enable/disable/remove 的固定点位调用 `pluginPackages.refresh()`（覆盖安装仍 restart-required）；HMR 侧新增 `PackageManifests.invalidate()`：变更的 `package.json`（node_modules 外）使包配置过期——读数走新文件、ESM `ResolveCache` 与 CJS `_pathCache` 清空、**纯配置型 manifest 不再触发模块重载**、以 JSON 模块加载的 package.json 仍走普通重载。`node_modules` 内替换/同路径重装仍需重启；
- **runtime invariants 全家删除**（官方指南之三）：`@deepseek-ai/dsh-invariants` 包、`InvariantRegistry` 等四个符号、各包 `./invariant` 子路径导出、`sdk-minimal` profile 的 5 个 invariant 行全部移除；四个发射器（`credentials/reference-updated` 等）改为**包容并日志记录**监听器失败（含 `code: 'INVARIANT'`），不再 rethrow——依赖 rethrow 的插件必须自建上报通道；
- **子路径插件显示面换代**（官方指南之四）：`my-plugins/search` 这类 subpath **不再读 `<subpath>/package.json`**——标题/简介只来自 `locale/*.json` 的 meta，图标来自导出的 `<subpath>/icon` 资源；包根插件保留 `package.json` 文案与 `icon` 字段，缺省时可用导出的 `./icon` 供图；`verify-package-meta` 拒绝解析到 build 产物的 manifest 导出；
- **Session 检查器族**（experimental）：新包 `session-inspector`（虚拟化 raw Session log + Chat 节点表、流式 delta 行、内嵌 Chrome DevTools）与改名易主的 `inspector-profile`（可选 Web profile 层：侧栏检查器 + 底部 Node Inspector + Host fetch 捕获，默认关闭）；
- **Web preset 与 Coding Tools 解耦收尾**：关闭代码工作工具后 `standard`/`creator` preset 仍可用（`3c26fdd204`），单任务 Creator 入口放行、advanced preset 过滤、未应用 coding preset 清理——把 rc.2"设置页解禁"补成完整闭环；
- **composer stats pills dock 拆分**：单个 `stats` dock 条目拆为 `activity`（次数/速度/时间弹窗）与 `usage`（tokens/缓存命中）两条——**插件可按 id 替换一枚 pill** 而不必重写整行（对 dsh-live-token-stats 这类插件是直接相关的缝）；
- 其余：客户端会话 prompt 初始化与结构化草稿保留、文档预览渲染 YAML frontmatter 字段、root 作用域 bottom content slot、Session 列表时间切片与流式工具参数增量优化（配套 `benchmarks/session-corpus` 大语料基准）、Web 公网部署（配置化 public URL + `docs/user/guide/public-deployments.md`）、桌面端默认 OS 分配端口、发布系统支持隔离 npm channels（vendor 列车进入 alpha 通道：cordis 4.0.5-alpha.1 等）。

---

## 版本序列定位

```
dsh-v0.2.0-rc.2     ← 上版（639ed01539，2026-09-29）
    │
    │  ←─ 本次变更（266 commits：201 非 merge + 65 merge）
    ▼
dsh-v0.2.1-alpha.1  ← 当前版（5badb15009，2026-10-03）—— 0.2.1 线首个 alpha
```

> rc.2 与 0.2.1-alpha.1 之间**没有中间 tag**，本目录的 diff 覆盖完整区间，不存在分析空白。
> 模块级 14 篇基线沿用 0.2.0-rc.1 分析（其本身沿用 0.1.7-rc.1），本目录不重复 14 篇编号文档——
> 逐主题证据见 [diff-vs-0.2.0-rc.2.md](diff-vs-0.2.0-rc.2.md)。

窗口内"先落后撤"的主线：**schedule-bundle 走完了一个完整的来回**——0.1.7-rc.2 时代 Schedule 在默认组合 → 0.2.0-rc.1 裁剪为 opt-in bundle → 0.2.1-alpha.1 bundle 退役、改由 Web 组合 + preset 贡献制挂载。终点形态比起点多出 preset 作用域控制（`minimal` 无提醒工具）与子代理拒绝语义。

---

## 主要变更分组

| # | 变更族 | 规模 | 一句话 |
|---|--------|------|--------|
| 1 | **Schedule 换挂载制** | ~25 commits | bundle 退役；web-app 全 profile 挂载 `schedule`/`ui-schedule`；preset 声明 `time-context` + `tool-schedule` 四工具；子代理 `toolFilter.deny` + service 结构化拒绝 |
| 2 | **Claude Code mods 桥** | ~25 commits | `defineMod` 把 mods 跑成 DSH 插件；hooks→Cordis 映射、`$` 门面、提示符上方 band + Web band、工具别名表 |
| 3 | **运行时解析刷新 + HMR 包配置过期** | ~20 commits | Plugin Manager 固定点位 `refresh()`；`PackageManifests.invalidate()`；纯配置 manifest 不触发模块重载 |
| 4 | **invariants 全家删除** | ~5 commits | 包/符号/子路径导出/sdk-minimal 5 行移除；四发射器包容监听失败 |
| 5 | **显示资源契约收敛** | ~10 commits | subpath 走 `<subpath>/icon` + locale meta；bundle 图标导出；`verify-package-meta` 拒 build 产物 manifest；bundle sources 排除凭据/别名 |
| 6 | **Session 检查器族** | ~10 commits | `session-inspector`（raw log/Chat 节点表 + DevTools 内嵌）+ `inspector-profile`（可选 profile 层） |
| 7 | Web preset ↔ Coding Tools 解耦 | ~10 commits | 关 coding tools 后 standard/creator preset 可用；preset 清理与过滤闭环 |
| 8 | 客户端 UI | ~15 commits | stats pills 拆 `activity`/`usage` 两 dock 条目；frontmatter 字段预览；root bottom slot；Session Tab 生命周期；goal 多行编辑 |
| 9 | 性能 | ~15 commits | Session 列表 time-slice/yield；流式工具参数增量优化；`benchmarks/session-corpus` 大语料 list/search/fork 基准 |
| 10 | Web/桌面 | ~10 commits | 公网 public URL 广播；登录无响应提示与错误码；桌面默认 OS 分配端口 |
| 11 | 客户端 prompt/草稿 | ~8 commits | 会话 prompt 初始化 + 结构化草稿保留；词lexicon 初始化时序 |
| 12 | 发布/工程 | ~15 commits | 隔离 npm channels；vendor alpha 列车（cordis 4.0.5-alpha.1 等 9 包）；tsdown 钉 native config loader；Node 无 type-stripping 拒绝启动 |

（逐主题 diff 与提交号见 [diff-vs-0.2.0-rc.2.md](diff-vs-0.2.0-rc.2.md)；完整提交清单 `git log --no-merges dsh-v0.2.0-rc.2..dsh-v0.2.1-alpha.1` 共 201 条。）

---

## Breaking Changes 与行为风险

**核心 API 契约（peer 校验 / manifest schema / settings API / 加载器 / slot / 会话格式 V4）零 diff；无新增持久化承认。** 但以下四条是**官方发布升级指南**的实打实变化（都在 `docs/upgrade-guide/v0.2.0-rc.2/`）：

| # | 变更 | 影响对象 | 危险度 |
|---|------|----------|--------|
| 1 | **schedule-bundle 退役**：`dsh.profile.bundles` 里的 `@deepseek-ai/dsh-experimental-schedule-bundle` 在加载 profile 时被自动摘除并重写 `package.json`；`schedule`/`ui-schedule` 改由 Web 组合挂载，`time-context` 与四工具改由 preset 声明；**顶层 `time-context` override 不再命中**（`patch: entry not found`） | 用 bundle 开过 Automation tasks 的 profile；对 `time-context` 顶层打 patch 的用户 | 🟡 自动迁移但有手工项 |
| 2 | **子路径插件不再读 `<subpath>/package.json`**：标题/简介只认 `locale/*.json` meta，图标只认导出的 `<subpath>/icon`；导出 subpath `package.json` 的包显示面退化（匿名行） | 以多插件单包（subpath）方式分发的插件作者 | 🔴 有必做项 |
| 3 | **runtime invariants 移除**：`cordis.yml`/patch/overlay 里引用 `@deepseek-ai/dsh-invariants`、`*/invariant` 子路径或 5 个 sdk-minimal invariant id 的行**加载失败**（`patch: entry not found` / module not found）；四个发射器不再 rethrow `INVARIANT` 失败 | 显式挂载 invariant 行的 profile；依赖 rethrow 语义的代码 | 🟡 引用才炸 |
| 4 | **插件运行时解析刷新语义**：install/enable/disable/remove 后 runtime resolution 即时发布（HMR 在场时 disable/remove 即时生效）；**覆盖安装仍 `restart-required`**；无 HMR 时停用的启动 bundle 插件继续跑且后续包操作不发布移除 | 依赖"装完必须重启"旧假设的自动化脚本；对 GUI 装包后立即寻址私有依赖的流程 | 🟢 行为放宽 |

非指南级的观察点：

| # | 变更 | 影响对象 | 危险度 |
|---|------|----------|--------|
| 5 | composer stats dock 条目 `stats` → `activity` + `usage` 拆分 | 按 id 替换/隐藏 stats 行的客户端插件（dsh-live-token-stats 族） | 🟡 id 变化 |
| 6 | HMR 纯配置型 manifest 变更**不再触发插件模块重载**；以 JSON 模块引用的 package.json 才走普通重载 | 依赖"改 package.json 即重载"开发循环的插件作者 | 🟢 行为澄清 |
| 7 | `verify-package-meta` 拒绝解析到 build 产物的 manifest 导出（`f8a274b76e`）；skills 模板要求 display metadata + icons（`310c5ae151`） | CI 里跑 verify-package-meta 的包；skills/插件模板维护者 | 🟢 门禁收紧 |
| 8 | 桌面端默认监听 OS 分配端口（`ecd9bf9273`）；Web 公网部署需显式配置 public URL（`a7c3ad99bc`） | 固定端口假设的部署脚本；远程访问配置 | 🟢 行为 |
| 9 | vendor 列车进 alpha 通道（cordis 4.0.5-alpha.1 / schemastery 3.18.5-alpha.1 等，`71086449e2`）；发布系统支持隔离 npm channels（`185b9c59e7`） | 直依赖 vendor 包版本的插件锁定策略 | 🟢 版本层 |

> rc.1 的 8 条风险表（peer 世代门槛 / `displayTitle` 空串 / `ctx.otel` 等）在本版**逐条原样成立**；其中"Schedule 默认组合移除（opt-in bundle）"一条被本版**取代**——bundle 没了，挂载方式换代，见 [plugin-migration-guide.md](plugin-migration-guide.md) §二。

---

## 阅读路径

- 只想知道"我的插件要不要改"：[plugin-migration-guide.md](plugin-migration-guide.md)（结论：**多数插件零修改；subpath 分发 / invariant 引用 / schedule bundle 用户有必做项**）
- 想知道"这 266 个提交都干了什么"：[diff-vs-0.2.0-rc.2.md](diff-vs-0.2.0-rc.2.md)
- 想按 Feature/Fix 过一遍：[CHANGELOG.md](CHANGELOG.md)
- mods 桥的完整设计：仓库内 `packages/experimental/claude-code-mods/README.md`（hooks 事件表 + `$` 门面清单）与 `docs/subsystems/claude-code-mods.md`（与 Claude Code 的逐项差异）
- 运行时解析刷新设计：`.agents/notes/implemented/architecture/2026-09-30-profile-package-refresh-and-manifest-invalidation.md`
- 官方升级指南（本版新增 4 篇，均在 `docs/upgrade-guide/v0.2.0-rc.2/`）：`schedule-bundle-retired` / `subpath-plugin-display-manifest` / `remove-runtime-invariants` / `account-sign-in-errors`
