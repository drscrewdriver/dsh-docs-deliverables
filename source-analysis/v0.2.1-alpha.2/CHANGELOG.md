# DSH v0.2.1-alpha.2 CHANGELOG（dsh-v0.2.1-alpha.1 → dsh-v0.2.1-alpha.2）

> 669 commits（512 非 merge + 157 merge）｜ 2026-10-03 ~ 2026-10-09 ｜ 发布 PR #5946（merge `d743267388`）
> 标记：⭐ 新能力面 ｜ ⚠️ 行为变化 ｜ 🔌 插件可见 ｜ 📋 有官方升级指南（`docs/upgrade-guide/v0.2.1-alpha.1/`，除注明外）
> 结构：**12 新增包 / 0 删除包 / 11 改名包**；`SESSION_FORMAT_VERSION` 保持 4，但 **新增 5 条同版本加性持久化承认**；peer 校验 / settings 核心 / vendor cordis·schemastery / HMR package-manifest 零 diff

## Packages（结构变化）

- 🔁 `packages/hooks/{hook-protocol,hooks-claude-code,hooks-codex}` → `packages/experimental/…`（`b48384223a refactor(experimental)!`：`packages/hooks/` 顶层域整体消失）
- 🔁 `packages/webhook/{webhook,webhook-github}` → `packages/experimental/…`（`packages/webhook/` 顶层域整体消失）
- 🔁 `packages/skill/skill-badge` → `packages/experimental/skill-badge`
- 🔁 `packages/workflow/tool-ralph` → `packages/experimental/tool-ralph`
- 🔁 `packages/session-query/tool-session-query` → `packages/experimental/tool-session-query`
- 🔁 `packages/terminal/tool-terminal` → `packages/experimental/tool-terminal`
- 🔁 `packages/session/session-title-all-prompts-llm` → `packages/experimental/session-title-all-prompts-llm`
- 🔁 `packages/subagent/subagent-in-process-driver` → `packages/session/working-directory`（R057 低相似度配对；实为该包语义被 working-directory 取代，见 Features §二）
- ➕ `packages/experimental/worktree` + `packages/experimental/tool-worktree` —— **`ctx.worktrees`** Git worktree 创建/进入能力（`c67a2d6fdf`）
- ➕ `packages/experimental/translator` —— **`ctx.translator`**：Google/Bing/DeepSeek Flash 匿名文本翻译（`f1250c6e36`、`b98b76c9a5`）
- ➕ `packages/experimental/cot-translation-bundle` + `packages/experimental/client-ui-cot-translation` —— **`ctx.cotTranslation`** 推理链翻译族（`cfc6be809c`）
- ➕ `packages/experimental/session-search` —— 可选会话搜索工具分类（`c2d528bb6d`）
- ➕ `packages/experimental/{ralph,terminal,session-titles,badge-skill}-bundle` —— bundle 打包件（向 profile 插普通 Host 行，`b173f3e2a2`）
- ➕ `packages/session/tool-working-directory` + `packages/session/working-directory` —— **`ctx.workingDirectory`** 会话执行目录能力缝（`79bd3d8da7`）
- ➕ `packages/ssh/ssh-helper-runtime` —— 独立 POSIX SSH helper 运行时（`d9342fcb5d`）

## Features

- 📋 ⚠️ 🔌 **refactor(subagent): 子代理激活统一化——删除前后台委派、in-process-driver 移除**（`390fbe8852`→`3d852a1cea`→`5ca7f533e1`→`c17a1fa189`→`8b43d44cc6`→`ef88d6a277`…，约 50 提交）
  `tool-subagent` 删 `backgroundMode`/`enableRunInBackground`/`run_in_background`；委派统一返 `{kind:'activation',subagentId}`；`subagent-in-process-driver` 包移除；`start()/startContinuable()`→`startActivation()`。官方指南 `subagent-activations`。
- 📋 🔌 **feat(session): Working directory 能力缝 + `{{cwd}}` 移除**（`79bd3d8da7`；连带 `4c8cb2fac6` subagent-acp 复用共享目录解析）
  `ctx.workingDirectory` 缝；移除 loop 内置 `{{cwd}}` 提示词变量与 `subagent-acp`/`subagent-dsh-sdk` 的 `cwd` 配置键；`tool-skill` `inject` 加 `workingDirectory`；`output.presentationMeta` 也在嵌套 PTC 调用中运行。官方指南 `working-directory`。持久化承认 2 条（working-directory / working-directory-attribution）。
- 📋 🔌 **refactor(experimental)!: 能力包分类迁入 + bundle 打包制 + 显式组合**（`b48384223a`〔唯一 `!`〕、`c2d528bb6d`、`dd302f718b`、`75542dd10a`；官方指南 `experimental-package-composition`）
  可选 hooks/webhook/工具/技能不再随 CLI/Python 运行时装；装包≠挂载，须先选 bundle；profile 禁自动 peer 安装。
- ⚠️ **revert(plugin): 撤回 preset 作用域 profile patch，回全局 Host 行**（`3aa1cab43a` 引入 `{preset,insert}` → `b173f3e2a2` 整体撤回）
  session-search/Ralph/persistent terminals/Codex/Claude Code bundle 改插普通 Host 行，工具进全局层，**所有 preset 含 `minimal` 可见**，切 bundle 即热更新（无需新组合代际）。
- 📋 🔌 **refactor(subagent): native bundle 贡献全局委派工具 + BundleInfo 必填字段**（官方指南 `native-subagent-bundle-tools`；`8b5527b8da`/`d7c7495e87`/`332a223d20` 官方源 bundle 安装/身份）
  `subagent-claude-code`/`subagent-codex` 选中 bundle 后注册 `tool-subagent-claude-code`/`tool-subagent-codex` 全局工具；客户端插件收必填 `BundleInfo.official` + `BundleInfo.availability`（slot `PluginPackageRef` 同样）。
- 📋 🔌 **refactor(session-title): provider 模型策略分离**（`353fe00d63`；官方双指南 `session-title-provider-strategy`/`session-title-adapters`；持久化 `2026-10-07-title-reasoning-effort`）
  `dsh-session-title-llm` 删 `registerSessionTitleLlmProvider`/`generateSessionTitleWithLlm`/`SessionTitleLlmMessageSelector` 导出；provider 直注 `ctx.sessionTitle.register()` + `executeSessionTitleLlm(...)`；标题经 `ctx.llm.prepareCall()`，适配器 `reasoning.efforts` 低→高排序；`SessionTitleProviderRequest` 加可选 `currentTitle`。
- ⭐ 🔌 **feat(translator)/feat(reasoning): 推理翻译族**（`f1250c6e36`、`b98b76c9a5`、`cfc6be809c`）
  `ctx.translator`（Google/Bing/DeepSeek Flash）、`ctx.cotTranslation`（Web band）；opt-in 机器翻译持久化。
- **refactor(llm): prepared call 显式控制与最小推理档位**（`c56fdb023e`、`ffb88d331e`、`9e36f20675`、`32a561f3a6`；`llm-pi-ai` 16 提交：`1ca5832919`/`46164dfb2b`/`ce7f8338e4`）
- ⭐ **feat(experimental): Git worktree 能力**（`c67a2d6fdf`）——`ctx.worktrees` 从 pin 本地 commit 显式创建进入。
- 📋 🔌 **feat(ssh): SSH/Node PTC 启动配置换代**（`d9342fcb5d`；官方指南 `ssh-helper-launch`）
  `dsh-ssh` 用 `launch` 取代 `node`/`bootstrapPath`/`bootstrapHash`，要求 protocol 2；`dsh-ptc-runtime-node` 同理；连接 getter → `ptcLaunch`；`cordis.yml` 与已装 helper 必须一起升级。
- 📋 ⚠️ 🔌 **fix(web): Web listener 信任面 webRuntime→webStartup**（`cb9a590c86`；官方指南 `web-listener-trust-config`）
  Web profile 不再提供 `webRuntime`、`web-runtime` 行不再有 `trustedHosts`；改 `ctx.webStartup.trustedHosts`；通配 host（`0.0.0.0`/`::`）加载即拒。
- ⭐ 🔌 **feat(ui-chat/web): reasoning 共享 slot factory + 视口作用域 flow**（`a0a9aef5ec`、`3385180b9b`）——新增 `conversation.chat.flow`、`conversation.chat.reasoning.body` 槽。
- 📋 🔌 **refactor(agent-team): 直投目标 Agent inbox**（`c772c85c17`、`a5098110cf`、`1a1b3c1896`、`5cec0b792a`；官方指南 `team-direct-inbox`；revert `43dd2bdeac`）
  移除 Team mailbox；`send_message` 只返 `{sent:true}`，无消息 ID/无 queued/失败不留存重试/重发不去重。
- **feat(session): 迁移状态前置 + 延迟前端触发迁移**（`dc22e172f4`、`a2dd724c60`、`c1df683f8c`）——展开前显示 header 迁移状态，引导迁移需求 fork 与子代理发现。
- 📋 **fix(models): DeepSeek 无凭据返空目录**（`02f5423070`；官方指南 `deepseek-model-discovery`）；**feat(desktop): test 构建 auth 弹窗需本地 opt-in**（`e8226b2a84`/`6846934b98`；指南 `desktop-test-auth-popup`）；macOS 本地无配置打包（`2604a4b13a`/`0853aeb0ee`）。
- 📋 **feat(cli): 生成 CLI help 参考 + dsh plugin help**（`75935af1d0`；官方指南 `plugin-option-placement`）——`--profile` 仅在转发 pnpm 参数前被读取。
- 📋 **fix(agent-instructions): 加载共享 agents-root AGENTS.md / 弃 per-row dshHome**（`21d0c2e29c`、`25f1672095`；官方指南 `instruction-home-override`）。
- 📋 **fix(python): 可选运行时资源显式下载 / PTC sandbox 强制 / 省略上游测试目录**（`89f35fe2e9`；官方指南 `python-ptc-sandbox`/`python-optional-resources`/`bundled-python-tests`〔rc.2 目录〕）。
- ⚠️ 🔌 **refactor(tools): 移除 mixed tool presentation**（`4359d3ee17`；官方指南 `tool-presentation-mode`）——`mode` 只接 `native`/`ptc`，`both`（含 `DSH_TOOLS_MODE=both`）被拒。

## Behavior Changes（⚠️ 非 API breaking）

- ⚠️ **新 session 创建新 Agent**（官方指南 `new-session-generations`）：Web/Desktop 不再复用工作区内空 Session；`uiWorkspace.startSession(workspaceId)` 同语义；重连用 `openWorkspace`/`connectWorkspace`。
- ⚠️ 🔌 **terminal-command-labels**（官方指南）：`dsh-client-ui-primitives` 的 `TerminalBlockLabels` 新增必需 `commandLine(line:number):string`，溢出命令行用其作可聚焦组的无障碍名。
- ⚠️ **client 字体分置**（`849e9ebd8d` text/code/terminal 独立字号）；**lightbox 舞台位下移到 Windows caption 之下**（`e127ed2d6c`）。
- 🔌 **plugin-manager/官方目录语义**（`e9a68b2484` on-demand 恢复澄清并保留包诊断；`a453218aff` 保留不可读官方目录条目；`f730199b94`/`f59c3196bf` on-demand 组合分类与 mock 事件文档）。
- ⚠️ **llm-mock-server 命名 SSE 事件**（官方指南 `mock-messages-events`）：Messages 事件名与结构化 SSE 载荷并发，只接无名 SSE 的消费者须改。

## Fixes（精选）

- **refactor(agent-loop)**: 生命周期 disposer 前置声明（`aaf01e8182`）、共享 teardown 失败聚合（`d6340cc088`）。
- **refactor(session-projection)**: 返回精确 change-feed disposer（`5578ecf655`）。
- **refactor(workspace)**: 移除废弃 mutation path parser（`43928bf03f`）。
- **refactor(watch)**: 命名 close promise、单一机制说明（`a790778e8f`）。
- **feat(voice-input)**: 菜单式输入电平选麦（`2d0360870c`）。
- **fix(client)**: 仅聚焦溢出命令文本（`88311637f8`）。
- **feat(scripts)**: 从回环 registry 服务本地构建的 Official bundle（`73d853a9ae`）。

## Docs / 工程面

- **官方升级指南 20 篇**（60 文件 ×3 语言）：`docs/upgrade-guide/v0.2.1-alpha.1/` 下 19 篇 + `docs/upgrade-guide/v0.2.0-rc.2/bundled-python-tests` 1 篇。
- **持久化承认 5 条**（同版本加性，`docs/persistence-changes/` +20 文件）：working-directory、external-subagent-catalog、ptc-operation-metadata、working-directory-attribution、title-reasoning-effort。
- **`docs/capability-seams.md`** 生成区 +4 缝/服务（`ctx.workingDirectory`/`ctx.worktrees`/`ctx.translator`/`ctx.cotTranslation`），0 删除（含 in-process-driver 消费边移除）。
- 基准/CI/vendor：`bench` 9（session 大语料续）、`ci` 11、`deps` 16（vendor 列车续，`vendor/loader` peer `node-addon-require-builtin` ^0.1.6→^0.1.9）。

## Reverted（窗口内落地后撤回）

- ↩️ `b173f3e2a2` 撤回 `3aa1cab43a` 引入的 preset 作用域 profile patch 机制（`{preset,insert}`/`{preset,id,override}` 及 app-boot 编译器/reload drain/preset 行清点等）——改回全局 Host 行。
- ↩️ `43dd2bdeac` 撤回 Agent Team 消息的新 Agent attribution（沿用既有 attribution）。
