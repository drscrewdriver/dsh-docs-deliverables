# DSH v0.2.1-alpha.1 CHANGELOG（dsh-v0.2.0-rc.2 → dsh-v0.2.1-alpha.1）

> 266 commits（201 非 merge + 65 merge）｜ 2026-09-29 ~ 2026-10-03 ｜ 发布 PR #5648
> 标记：⭐ 新能力面 ｜ ⚠️ 行为变化 ｜ 🔌 插件可见 ｜ 📋 有官方升级指南（`docs/upgrade-guide/v0.2.0-rc.2/`）
> 结构：**4 新增包 / 1 删除包 / 1 改名包**；`SESSION_FORMAT_VERSION` 保持 4；peer 兼容性校验 / manifest schema / settings 核心 / 加载器零 diff

## Packages（结构变化）

- ➕ `packages/schedule/tool-schedule` —— **`@deepseek-ai/dsh-tool-schedule`**：preset 作用域提醒四工具（`schedule_create/list/update/delete`），Host `ctx.schedule` 服务的模型侧消费者（`6c1a590a4c`）
- ➕ `packages/experimental/claude-code-mods` —— **`@deepseek-ai/dsh-experimental-claude-code-mods`**：Claude Code mods 桥（`35873604ad`）
- ➕ `packages/experimental/client-ui-claude-code-mods` —— mods 的 Web band（`0b87f74cd3`）
- ➕ `packages/experimental/session-inspector` —— raw Session log / Chat 节点检查器（`38c45638a2`）
- 🔁 `packages/experimental/schedule-bundle` → `packages/experimental/inspector-profile`（R065 改名易主：schedule bundle 退役，目录复用为检查器 profile 层）
- ➖ `packages/runtime-diagnostics/invariants` —— runtime invariant 注册表包删除（`f028f25667`）

## Features

- 📋 ⚠️ 🔌 **feat(schedule): Schedule 换挂载制——bundle 退役、Web 组合挂载、preset 贡献工具**
  `c6dd905972`（Web 组合搭载 Schedule service + 任务页）→ `656adfc986`（time-context 由使用它的 preset 挂载）→ `6c1a590a4c`（提醒工具改由 preset 作用域包 `tool-schedule` 贡献）→ `62aa32c6fe`（运行时闭环收尾）→ `9633724b40`（app-boot 从 profile manifest 摘除退役 bundle）。`standard`/`cordis`/`ptc` preset 声明时钟行 + 四工具；`minimal` 两者皆无；官方指南 `schedule-bundle-retired`。
- 🔌 **feat(schedule): 子代理拒绝语义**（`699f1a8dc1` 委派子代理被拒提醒工具；`96c421d985` service 拒绝 subagent 路由持有的 Session；`1b1b09e1fb` caller 限制下沉到 tool 层；`500295b2bd` 拒绝经 update result 返回；`59c8bbbd6d` 编辑器里点名拒绝原因；`a0b3f536fe`/`08125dd330` 测试与文案、`8c23bab422` Cordis 目录再生成）。preset 侧落地为 subagent 工具的 `toolFilter.deny` 四工具（standard.patch.yml）。
- ⭐ **feat(experimental): Claude Code mods 桥**（`35873604ad` mods bridge → `f1715c67ec` mods 即 DSH 插件、撤回持久化变更 → `57126d8baf` AbovePrompt band 经 Remote 暴露 → `0b87f74cd3` Web band → `2db0c83e86` 兼容性页 + README + 目录 → `233032b8f4`/`600034d653` 评审加固 → `56f2f48669` 发丝边框与引擎事件清单；`54fa38795f` 去 unknown casts；`ca83aecbc8`/`6e948732d1` Windows 稳定化）
  `defineMod(register)` 产出 Cordis 插件；hooks：`session.start` / `prompt.submit`（改写/附加上下文/丢弃）/ `turn.start` / `tool.call`（observe/deny/应答/改写结果与 isError）/ `turn.complete` / `command.run` / `ui.render`（band）/ `session.end` / `<namespace>.<method>`；`$` 门面（`$.tool.call`/`$.http.fetch`/`$.state`/`$.ui`/`$.command.register`/`$.process.run`）；工具别名 `Bash↔bash`、`Task↔subagent`、`AskUserQuestion↔ask_user_question` 等 + `toolAliases` 扩展。官方示例移植 Anthropic 三篇 mods（Token Weather/Blast Radius/Replay Theater）。
- ⭐ 🔌 **feat(inspector): Session 检查器族**（`38c45638a2` raw-log + grouped-chat 诊断 → `732dd913cf` 内嵌 Chrome DevTools（钉版本 npm 源编译，`ad22e6c80f`）+ 可选诊断捆绑 → `dcdf631ca2` raw JSON 默认展开；`inspector-profile` 可选 Web profile 层：侧栏检查器 + 底部 NodeJS Inspector + Host fetch 捕获，Plugin Manager 默认关闭）
- 📋 🔌 **fix→契约(upgrade): 子路径插件显示面换代**（官方指南 `subpath-plugin-display-manifest`）
  `8339f16c1d` 只为包根插件读 package.json；`d9a40155c1` 文档定型 `<subpath>/icon` 规则；`ecedbbc2e6` 复用 locale 元数据并导出 bundle 图标；`f30aec98b6` 包显示资源保留给 bundle；`d12257c959` 保住 manifest 图标优先级；`f8a274b76e` 诊断点名声明 manifest + `verify-package-meta` 拒绝解析到 build 产物的 manifest 导出。
- 🔌 **fix(plugin-manager)/feat: 运行时解析刷新**（`869afc493d` 刷新运行时包解析；`abf8b760ec` 保住 live resolution 映射；设计记录 `2026-09-30-profile-package-refresh-and-manifest-invalidation`：install/enable/disable/remove 固定点位 `pluginPackages.refresh()`，覆盖安装 `restart-required`）
- ⚠️ **fix(hmr): 包配置过期 + 一串身份/刷新修复**（`6fe4a2e184` 失效变更包 manifest（新 `package-manifest.ts` +330 行）→ `d7d2e5fd4e` 刷新 CommonJS 请求不逐出模块 → `b1c5f861b6` manifest 变更间保住已加载入口身份 → `a59beb8ae3` Office resolution 下保住 manifest 刷新 → `980b410340` 保住原生 manifest 行为；`4eb53e63ff` CI 补 HMR 边角 + `93b469a5e1` webworker 严格真值断言）。纯配置型 manifest 不再触发模块重载。
- **feat(web): 公网部署支持**（`a7c3ad99bc` 广播配置化 public application URL，PR #3972；新文档 `docs/user/guide/public-deployments.md`；`f3168f2be4` 登录无响应时提示检查网络；`dff4dfbe75` 桌面接受登录无响应错误码并补升级说明）
- **feat(client): 会话 prompt 初始化 + 结构化草稿保留**（`e400349e3a` 主提交；`e6783c20fc` 词 lexicon 在缓存输入壳后初始化；`2c93df5620` 收窄 prompt 输入并推迟 skill 高亮；`236ab7acbd` 双语文档）
- 🔌 **feat(skills): 模板资源校验 + 显示元数据要求**（`176e961c33` 校验嵌套模板导出资源；`310c5ae151` 要求 display metadata + icons；`71fd3cf2b5` 图标优先级与原生诊断测试；`2f7ed5fced` 资源校验归 package-meta 门）
- **feat(client): 文档预览渲染 YAML frontmatter 字段**（`0cad3a0137`；`39c614a143` 首行 frontmatter 检测 + 忠实呈现原 YAML；`2ca5f648c3` 钉住首行检测）
- **feat(web): preset 与 Coding Tools 解耦**（`3c26fdd204` 关 coding tools 后 standard/creator preset 仍可用；`6200ffe8c7` 单任务 Creator 入口放行；`d396f17f17` 设置里过滤 advanced preset；`9073ea1941`/`5d7a1f14e4`/`f3946dc39a` 关工具时清理/保留/重置隐藏 preset；`68eb79d9e1` preset 设置更新与空 choices）
- **feat(layout): root 作用域 bottom content slot**（`88341c2a9f`）——客户端布局新增根级底部内容缝。
- **feat(release): 隔离 npm channels**（`185b9c59e7` 支持；`a809d9289d` preflight 不依赖 latest；`c1dee0e6f6` 手动发布工作流允许 inputs）；**vendor alpha 列车**（`71086449e2`：cordis 4.0.5-alpha.1、cosmokit 1.8.6-alpha.1、group 1.0.5-alpha.1、hmr 1.0.20-alpha.1、include 1.0.10-alpha.1、loader 1.0.6-alpha.1、logger-console 1.0.5-alpha.1、schemastery 3.18.5-alpha.1、timer 1.1.7-alpha.1）。
- **feat(web): 流式工具参数准备期呈现**（`2ba4144a7e` preparation 期展示解析后的工具参数；配套共享懒视图文档 `35aebdca70`）

## Behavior Changes（⚠️ 非 API breaking）

- 📋 ⚠️ 🔌 **schedule-bundle 退役**：加载 profile 自动摘除 `dsh.profile.bundles` 条目并重写 `package.json`（其余字段保留）；存量任务/投递记录原地保留；**顶层 `time-context` override 不再命中任何行**（时钟行归 preset），必须删除（官方指南迁移步骤 2）。
- 📋 ⚠️ **runtime invariants 移除的连带语义**：`credentials/reference-updated`、`credentials/record-updated`、`authorization/settled`、`llm/adapters-updated` 四发射器**包容并日志记录**监听器失败（含 `code: 'INVARIANT'`），不再 rethrow——依赖 rethrow 的插件必须自建上报（官方指南迁移步骤 3）。
- ⚠️ 🔌 **composer stats dock 条目拆分**（`2190082866`）：`stats` 一条拆为 `activity`（次数/速度/时间弹窗）+ `usage`（tokens/缓存命中）——插件可按 id 替换单枚 pill；渲染结果不变。
- ⚠️ **桌面默认监听 OS 分配端口**（`ecd9bf9273`）——固定端口假设失效。
- ⚠️ **Node 无 TypeScript type-stripping 拒绝启动**（`f3013b2d8d`）；构建钉 native config loader（`500614c0d5`、`c71cd255ac`）。
- ⚠️ **LibreOffice Kit 0.1.5**（`d0916a8f90`、`541fcec02f` SDK CLI smoke 适配）。
- 🔌 **插件管理页语义补全**（`bab69fbec5` pnpm 装了旧版时点名确切 spec；`43c5f1e924` 单 registry 场景才解释另一安装版本；`00b363074a` 无包持有的选择可移除；`0bd1492940` 版本提示里写明供应链政策/风险/补救）。
- ⚠️ **UI goal/queue 细化**（`3843225471` 目标 objective 多行编辑；`b88b6c248d` 滚动条重绑 + Enter 守卫加固；`b1a69a9b9c` disarmed 目标标"已暂停"；`66e101821c` 排队消息与目标共用内联编辑器；`9a8d21dfe7` 取消停靠的 goal round 撤回）。
- **shell/工具提示**（`b5d7123351` 未校验 shell escalation 字段文档化；`fce0a41da8` bash 行保持可展开（Host 认可的 escalation 字段）；`c74f39b4dc` diff 卡撤掉 Client 侧 escalation 校验；`4166dbd140` 参数生成顺序引导；`a63d8979fa` PTC 示例对齐参数顺序）。

## Fixes（精选）

- **perf(api)**: Session 列表时间切片（`4402fa47e4`）+ 摘要间让出（`ecc01b54a4`）；**perf(web)**: 流式工具参数增量优化收尾（`91818992b0`、`a33bd1a80b`、`cd759d8a09`）；sealed deltas 与 Unicode 摘要边界（`b7f06692b6`）。
- **perf(bench)**: `benchmarks/session-corpus` 大语料基准（`d70efffb63` list/search/fork；`ed8a2a9163`/`92a65cbb65` 双 CPU 校准；`e806d9cb97` 托管 CI 预算；`2778be7375` 评审收尾；`811940168a` p99 fork 钉位）。
- **fix(plugins)**: bundle sources 排除凭据与影子副本（`6d1e12b237`）、保留别名与完整用户信息（`9b79f97010`）。
- **fix(client-modules)**: 工厂只认领自己注入的样式（`aa5334f1e0`）；失败工厂的未标记样式清除（`015349e4ad`）。
- **fix(sidebar)**: Session Tab 生命周期与 pane 本地页保持（`8463abc59d`）。
- **fix(web)**: 文件输入尺寸跨工具阶段保留（`f80df0426c`）+ 常驻化（`d0cc135751`）+ 流式内容尺寸标签缩短（`83f9dcac8f`）。
- **fix(subprocess)**: 可执行错误按 name 比较（`f37f19ab43`）；**fix(file-upload)**: 回执按会话实例隔离（`aa2ae5c779`）。
- **fix(ui-schedule)**: 关联 Session 焦点与禁用 tooltip（`d8f38c4ad6`）；链接 Session 行与 Records 页改名（`5586cfef7e`）；时钟标放大 2px（`7d88fc9b2b`）。
- **fix(client)**: StateDot 动画重启后重钉 loader（`4b9d8ad6f7`）；remotes 移除冗余 session runtime 依赖（`e6c6ec668f`）。

## Docs / 工程面

- **官方升级指南 4 篇**（`docs/upgrade-guide/v0.2.0-rc.2/`）：`schedule-bundle-retired` / `subpath-plugin-display-manifest` / `remove-runtime-invariants` / `account-sign-in-errors`（双语）。
- **设计记录**：`2026-09-30-profile-package-refresh-and-manifest-invalidation`（运行时解析刷新 + HMR 包配置过期，含接口替换表与 Future Work）。
- **新包文档**：`tool-schedule` / `claude-code-mods` / `client-ui-claude-code-mods` / `session-inspector` / `inspector-profile` README（中英）+ `docs/subsystems/claude-code-mods.md` 兼容性差异页。
- **笔记体系整理**：`a1db5f13e8` 归档已完成决策、`bbf599483e` 规范 legacy implemented 元数据、`c7f66d13a6` 裁冗余（archived/ 下 40+ 篇 `.i18n.yaml` 归档）。
- **测试基建**：mods 测试套件经 Vitest config 提供（`536bb5840f`、`a161070a76`、`34f52880b0`）；headless 快照记录 mods 组合（`f87c957624`）；HMR 依赖遍历中运行时移除覆盖（`1273855237`）；typert-loader 异步断言轮询化（`23527f0df2`）；会话 projection cache fixture checkpoint 等待（`05e2d90042`）。
- 持久化/配置目录再生成：`b7a6568c29`（图 + persistence catalog）、`7794021892`（mods bridge 配置目录）、`f18d1911c6`（removeBundle 契约 Cordis 目录）。**无新增持久化承认**。

## Reverted（窗口内落地后撤回）

- ↩️ `f1715c67ec` 内含 mods 持久化变更的撤回（mods 即插件路线下不再需要专属持久化）。
