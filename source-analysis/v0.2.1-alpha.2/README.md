# DSH v0.2.1-alpha.1 → v0.2.1-alpha.2 变更说明（更新要点）

> **数据源**: `deepseek-ai/deepseek-harness` 官方仓库
> **标签对比**: `dsh-v0.2.1-alpha.1` (`5badb15009`) → `dsh-v0.2.1-alpha.2`（tag 对象 `6851e49628`，解引用提交 `d743267388`）
> **发布日期**: 2026-10-09 ｜ **发布提交**: `d743267388 release(dsh): 0.2.1-alpha.2`（merge commit，body `release(dsh): 0.2.1-alpha.2`）
> **发布 PR**: [#5946](https://github.com/deepseek-ai/deepseek-harness/pull/5946)（merge `worktree/release-0.2.1-alpha.2`）
> **性质**: 0.2.1 线第二个 alpha，**一次"能力面大重组 + 子代理激活换代 + 官方升级指南爆发（20 篇）"** 的大跨度发布，共 669 个提交（512 非 merge + 157 merge）
> **统计**: 3226 files changed, +114987 / −28177
> **结构变化**: `packages/`+`apps/` **12 新增 / 0 删除 / 11 改名**——改名几乎全是"把能力包搬进 `packages/experimental/`"（`hooks/`、`webhook/` 两个顶层域整体消失，另有 `skill-badge`/`tool-ralph`/`tool-session-query`/`tool-terminal`/`session-title-all-prompts-llm` 迁入）；新增集中在 experimental 下的一批 **bundle 打包件**（`ralph-bundle`/`terminal-bundle`/`session-titles-bundle`/`cot-translation-bundle`/`badge-skill-bundle`）与**翻译/worktree/session-search 能力族**；`subagent-in-process-driver` 经 R057 低相似度改名落到 `session/working-directory`
> **持久化契约**: `SESSION_FORMAT_VERSION` **保持 4**（`packages/core/session/src/types.ts:89`，两版同值）；但窗口内新增 **5 条同版本加性持久化承认**（`docs/persistence-changes/` +20 文件：working-directory、external-subagent-catalog、ptc-operation-metadata、working-directory-attribution、title-reasoning-effort），`decision: same-version`——事件词表扩张不改结构，但**旧构建读取含新事件的日志会被拒**
> **插件契约**: peer 兼容性校验（`plugin-compatibility.ts`）、settings 核心（仅版本号 bump）、vendor `cordis`/`schemastery`、HMR `package-manifest.ts` **零 diff**；但 **slot 目录新增 2 槽 + 重挂**、**tool-skill 消费新 `ctx.workingDirectory`**、**package-meta 图标解析加固**（`realModuleFile`）——且 **20 篇官方升级指南里有 10 篇直接改插件可见面**（subagent 激活 / session-title provider 导出 / BundleInfo 必填字段 / TerminalBlockLabels / tool presentation mode…）

---

## 一句话总结

0.2.1-alpha.2 是 **"子代理委派换成统一 activation + 能力包大搬迁进 experimental + 官方升级指南破纪录（20 篇）"** 的一次发布——与 a1"核心契约面原封不动"相反，本版**核心 peer/manifest/settings/加载器仍零 diff，但围绕"插件能拿到什么数据形状、往哪个槽注入、prompt 里还有没有 `{{cwd}}`"动了一刀**：

- **子代理激活统一化**（`subagent-activations` 指南）：`@deepseek-ai/dsh-tool-subagent` **删除 `backgroundMode`/`enableRunInBackground`/模型参数 `run_in_background`**；每次委派统一返回 `{ kind: 'activation', subagentId }`，前台结果与 `{ kind: 'background', jobId }` 双双消失，子代理结果不再经 `job_output`/`job_kill` 收集；**已发布包 `@deepseek-ai/dsh-subagent-in-process-driver` 移除**，宿主代码 `start()`/`startContinuable()` → `startActivation()`；
- **Working directory 成为能力缝**（`working-directory` 指南 + `ctx.workingDirectory` 缝）：新增 `packages/session/working-directory` + `tool-working-directory`；**loop 内置 `{{cwd}}` 提示词变量被移除**，`dsh-subagent-acp`/`dsh-subagent-dsh-sdk` 的 `cwd` 配置键删除——自定义 prompt 模板残留 `{{cwd}}` 会在发请求前失败；Session 执行目录作为必需 user context 提供，与原始 `Session.header.cwd` 分开持久化；`output.presentationMeta` 现在也在嵌套 PTC 调用里运行；
- **能力包大重组 + bundle 打包制**（`b48384223a refactor(experimental)!: classify optional packages and move prototypes`，唯一带 `!` 的破坏性提交 + `experimental-package-composition` 指南）：可选 hooks / webhooks / 工具 / 技能的包**不再随 CLI/Python 运行时装载**，安装与组合相互独立（装包不等于挂载，必须先选 bundle）；`dsh-hooks-claude-code`/`dsh-hook-protocol`/`dsh-webhook`/`dsh-webhook-github`/`dsh-skill-badge`/`dsh-tool-ralph`/`dsh-tool-session-query`/`dsh-tool-terminal` 等整体迁入 `packages/experimental/`；新 bundle 层（`ralph-bundle`/`terminal-bundle`/`session-titles-bundle`/`cot-translation-bundle`/`badge-skill-bundle`）向 profile 插入**普通 Host 行**，其工具注册进全局工具层、**所有 preset（含 `minimal`）可见**；窗口内 `b173f3e2a2` **撤回了 a1→a2 中途加的 `{preset, insert}` profile patch 机制**，回退到"全局 Host 行 + bundle 开关即热更新"；
- **Session 标题 provider 换代**（`session-title-provider-strategy` + `session-title-adapters` 指南）：`@deepseek-ai/dsh-session-title-llm` **不再导出 `registerSessionTitleLlmProvider`/`generateSessionTitleWithLlm`/`SessionTitleLlmMessageSelector`**；`SessionTitleLlmConfig` 只剩执行控制（`maxInputBytes`/`maxOutputTokens`/`timeoutMs`/可选 `provider`·`model`），`targetWords`·`targetCjkCharacters` 归各 provider 自己的 Config；provider 直接 `ctx.sessionTitle.register()` 并调 `executeSessionTitleLlm(...)`；标题走 `ctx.llm.prepareCall()`，自定义适配器须把可选推理强度**从低到高**排列；
- **子代理 bundle 头一次把"委派工具"作为 Host 全局工具贡献**（`native-subagent-bundle-tools` 指南）：`dsh-subagent-claude-code`/`dsh-subagent-codex` 保留包名/行 ID/配置/原生认证，但选中 bundle 后额外注册 `tool-subagent-claude-code`/`tool-subagent-codex` 全局工具；插件客户端**收到新增的必填 `BundleInfo.official` 与 `BundleInfo.availability` 字段**（slot 的 `PluginPackageRef` 同样收到）；
- **UI 槽位扩张 + 重挂**（`slot-catalog.ts` +109/−25）：新增 `conversation.chat.flow`、`conversation.chat.reasoning.body` 两槽；`conversation.chat.node`、`conversation.input.activity` 的 `declaredBy` 从 `conversation.view` 改挂到新的 `conversation.chat.flow`——注入这些槽的客户端插件需注意容器换了父；
- 其余：推理翻译族（`translator` Google/Bing/DeepSeek Flash + `cot-translation-bundle` + `client-ui-cot-translation`）、Git worktree 能力（`worktree`/`tool-worktree`）、SSH protocol-2 helper 换代（`ssh-helper-launch`，`dsh-ssh` 用 `launch` 取代 `node`/`bootstrapPath`/`bootstrapHash`）、tool presentation `both` 档被拒（`tool-presentation-mode`）、Web 监听信任面从 `webRuntime` 迁到 `webStartup` 且拒绝通配 host（`web-listener-trust-config`）、Agent Teams 直投目标 inbox（`team-direct-inbox`，`send_message` 只返回 `{sent:true}`）、TerminalBlock 溢出命令行需 `commandLine()` 无障碍名（`terminal-command-labels`）、Python PTC 强制 sandbox（`python-ptc-sandbox`）、DeepSeek 无凭据返空目录（`deepseek-model-discovery`）、Session 迁移状态前置展示。

---

## 版本序列定位

```
dsh-v0.2.0-rc.2      ← 基线（639ed01539，2026-09-29）
    │
    ▼
dsh-v0.2.1-alpha.1   ← 上版（5badb15009，2026-10-03，PR #5648）
    │
    │  ←─ 本次变更（669 commits：512 非 merge + 157 merge）
    ▼
dsh-v0.2.1-alpha.2   ← 当前版（tag d743267388，2026-10-09，PR #5946）—— 0.2.1 线第二个 alpha
```

> **rc.2 → a1 → a2 三连无空白**：a1 与 a2 之间**没有中间 tag**，本目录的 diff 覆盖 a1→a2 完整区间（6 天，669 提交），不存在分析空白。
> 模块级基线沿用 0.2.0-rc.1 分析（其本身沿用 0.1.7-rc.1），本目录不重复 14 篇编号文档——逐主题证据见 [diff-vs-0.2.1-alpha.1.md](diff-vs-0.2.1-alpha.1.md)。
> **规模对比**：a1 是 266 提交 / 4 篇升级指南；a2 是 669 提交 / 20 篇升级指南——a2 跨度约为 a1 的 2.5 倍，官方 breaking 记述密度翻了 5 倍，是 0.2.1 线目前最"伤插件迁移"的一次 alpha。

窗口内"先加后撤"的主线：**preset 作用域 profile patch**——窗口中段 `3aa1cab43a feat(plugin): compose optional bundles inside agent presets` 引入 `{preset, insert}` / `{preset, id, override}` 机制，随即被 `b173f3e2a2 revert(plugin): drop preset-scoped profile patches; ship optional tools as global Host rows` 整体撤回，回到"bundle 插普通 Host 行、工具进全局层、切 bundle 即热更新"。终态比 a1 多出的是 bundle 打包制与全局工具可见性，少了的是刚加的 preset patch 概念。

---

## 主要变更分组

| # | 变更族 | 规模 | 一句话 |
|---|--------|------|--------|
| 1 | **子代理激活统一化** | ~50 commits | `tool-subagent` 删 `backgroundMode`/`run_in_background`；委派统一返 `{kind:'activation',subagentId}`；`subagent-in-process-driver` 移除；`start()/startContinuable()`→`startActivation()`；外部 catalog 按 mode 表示 |
| 2 | **Working directory 能力缝** | ~15 commits | 新 `session/working-directory` + `tool-working-directory`；`ctx.workingDirectory` 缝；移除 loop `{{cwd}}` 与 subagent-acp/sdk 的 `cwd` 配置键；目录归属与持久化 |
| 3 | **能力包重组 + bundle 打包制** | ~25 commits | `b48384223a refactor(experimental)!` 迁原型进 experimental；hooks/webhook/skill-badge/tool-ralph/tool-session-query/tool-terminal 搬家；新增 5 个 `*-bundle`；`b173f3e2a2` 撤回 preset patch，回全局 Host 行 |
| 4 | **Session 标题 provider 换代** | ~14 commits | `session-title-provider-strategy`/`adapters` 两指南；`dsh-session-title-llm` 砍三个导出；推理强度低→高排序；`title-reasoning-effort` 持久化；`session-title-all-prompts-llm` 迁 experimental |
| 5 | **LLM 准备调用 / 推理档位** | ~28 commits | `c56fdb023e` prepared calls 显式控制；`ffb88d331e` 呼叫准备期解析最小推理；`9e36f20675` 报路由档位下限；`llm-pi-ai` 16 提交（系统消息放置、会话 prompt/工具更新） |
| 6 | **推理翻译族** | ~10 commits | 新包 `translator`（Google/Bing/DeepSeek Flash）+ `cot-translation-bundle` + `client-ui-cot-translation`；`ctx.translator`/`ctx.cotTranslation` 两 service；机器翻译持久化 |
| 7 | **Client UI 槽位与迁移 UX** | ~30 commits | slot 目录 +2（`conversation.chat.flow`/`reasoning.body`）+ 重挂；Session header 迁移状态前置、延迟前端触发迁移；字体分置、lightbox 舞台位、trajectory 时序；可选 session-search 工具分类 |
| 8 | **Git worktree + SSH helper 换代** | ~10 commits | 新 `worktree`/`tool-worktree` 能力（pin 本地 commit 创建进入）；`d9342fcb5d` SSH 独立 POSIX helper runtime；`ssh-helper-launch`：`dsh-ssh`/`ptc-runtime-node` 用 `launch` 取代 `node/bootstrapPath/bootstrapHash`，要求 protocol 2 |
| 9 | **Agent Teams 直投 inbox** | ~7 commits | `c772c85c17`/`a5098110cf` 移除 Team mailbox、直发目标 Agent inbox；`send_message` 只返 `{sent:true}`，无 ID/无 queued/无去重 |
| 10 | **Web/Desktop/部署/CLI 工程** | ~40 commits | `web-listener-trust-config`：`webRuntime`→`webStartup`、拒通配 host；桌面 test 构建 auth 弹窗需本地 opt-in；macOS 无配置本地打包；`dsh plugin --profile` 位置规则；CLI help 参考生成 |
| 11 | **Python 运行时 / PTC sandbox** | ~10 commits | `python-ptc-sandbox`：`ptc-runtime-python` 要求 `sandbox`+`sandboxPolicy`；`python-optional-resources`：Office/authoring 轮子显式下载；`bundled-python-tests`：省略 NumPy/pandas 上游测试目录 |
| 12 | **持久化迁移 UX / 格式承认** | ~10 commits | V4 内 5 条同版本加性承认；`dc22e172f4`/`a2dd724c60` 展开前显示 header 迁移状态、延迟前端触发迁移；`c1df683f8c` 迁移需求 fork 引导 |
| 13 | **门禁 / 测试 / 基准 / vendor** | ~35 commits | `bench` 9（session 大语料续）、`ci` 11、`deps` 16（vendor 列车续，loader peer `node-addon-require-builtin` ^0.1.6→^0.1.9）；mock-server 命名 SSE 事件；verify 门收紧 |

（逐主题 diff 与提交号见 [diff-vs-0.2.1-alpha.1.md](diff-vs-0.2.1-alpha.1.md)；完整提交清单 `git log --no-merges dsh-v0.2.1-alpha.1..dsh-v0.2.1-alpha.2` 共 512 条。）

---

## Breaking Changes 与行为风险

**核心 API 契约的"闸门面"零 diff：peer 校验（`plugin-compatibility.ts`）、settings 核心（仅版本号 bump）、加载器 vendor `cordis`/`schemastery`、HMR `package-manifest.ts` 未动；`SESSION_FORMAT_VERSION` 保持 4。** 与 a1"零必做"不同，本版**官方 20 篇升级指南**中有 **10 篇触及插件可见面**（详见 [plugin-migration-guide.md](plugin-migration-guide.md)）。危险度按"是否要求插件/配置动手"分级：

### 官方升级指南级 breaking（插件/配置可见，必做或引用即炸）

| # | 变更 | 影响对象 | 危险度 |
|---|------|----------|--------|
| 1 | **subagent 激活换代**：`tool-subagent` 删 `backgroundMode`/`enableRunInBackground`/`run_in_background`，只返 `{kind:'activation'}`；`subagent-in-process-driver` 包移除；`ctx.subagents.start()/startContinuable()`→`startActivation()` | 用后台/前台 Job 语义委派子代理的编排插件；直接调 subagent 服务 API 的宿主代码 | 🔴 有必做项 |
| 2 | **session-title provider 换代**：`dsh-session-title-llm` 不再导出 `registerSessionTitleLlmProvider`/`generateSessionTitleWithLlm`/`SessionTitleLlmMessageSelector`；config 拆分；provider 改直注 `ctx.sessionTitle.register()` + `executeSessionTitleLlm()` | 自研 session-title provider 插件；`tsc` import 被删符号即编译不过 | 🔴 有必做项 |
| 3 | **BundleInfo 新增必填字段**：客户端插件收到 `BundleInfo.official` 与 `BundleInfo.availability`（slot `PluginPackageRef` 同样）；构造方/精确校验器必须含新字段 | 读 bundle 卡片/详情槽的客户端插件；对 `BundleInfo` 做精确断言的测试 | 🔴 有必做项 |
| 4 | **`{{cwd}}` 提示词变量移除**：自定义 prompt 模板保留未解析 `{{cwd}}` 时模型请求前失败；`subagent-acp`/`subagent-dsh-sdk` 的 `config.cwd` 键移除，子代理目录改由 `ctx.workingDirectory`/启动请求 `cwd` 提供 | 在 home/profile/`personaSuffix`/preset `suffix` 里写过 `{{cwd}}` 的插件与 profile patch | 🔴 有必做项 |
| 5 | **tool presentation `both` 档被拒**：`dsh-tools`/`dsh-agent-tool-presentation` 的 `mode` 只接 `native`/`ptc`；`DSH_TOOLS_MODE=both` 失效 | 设过 `both` 的 profile patch / 环境注入 | 🟡 引用才炸 |
| 6 | **Web 监听信任面换代**：Web profile 不再提供 `webRuntime` 服务、`web-runtime` 行不再有 `trustedHosts`；改用 `webStartup`；通配 host（`0.0.0.0`/`::`）加载即拒 | 注入 `webRuntime` 或读 `ctx.webRuntime.trustedHosts` 的 profile/overlay/patch；远程访问部署 | 🔴 引用即失败 |
| 7 | **SSH / Node PTC 启动配置换代**：`dsh-ssh` 用 `launch` 取代 `node`/`bootstrapPath`/`bootstrapHash` 并要求 protocol 2；`dsh-ptc-runtime-node` 同理；连接 `nodeExecutable`/`bootstrapPath` getter→`ptcLaunch` | 自定义 SSH 组合的 `cordis.yml` + 已装 helper（须一起升级） | 🔴 有必做项 |
| 8 | **TerminalBlock 需 `commandLine()`**：`dsh-client-ui-primitives` 的 `TerminalBlockLabels` 新增必需 `commandLine(line:number):string` | 自渲染 `TerminalBlock` 的自定义 UI 插件 | 🔴 有必做项 |
| 9 | **Python PTC 强制 sandbox**：`dsh-experimental-ptc-runtime-python` 要求 `sandbox`+`sandboxPolicy`，无法建立约束时 `sandbox-unavailable` 失败 | Python PTC 组合；曾依赖"直接文件操作不受限"的流程 | 🟡 引用才炸 |
| 10 | **可选包显式安装/组合**：hooks/webhook/工具/技能不再随运行时装；装包≠挂载，须先选 bundle；profile 禁用自动 peer 安装 | 依赖 hook 桥/webhook/可选工具的 profile；曾靠 CLI 示例直引的 GitHub review 配置 | 🟡 有手工项 |

### 非指南级观察点

| # | 变更 | 影响对象 | 危险度 |
|---|------|----------|--------|
| 11 | Agent Teams `send_message` 只返 `{sent:true}`（无消息 ID/无 queued/失败不留存重试/显式重发不去重） | 消费 `tool-agent-team` 返回值做后续处理的编排 | 🟡 返回形状变化 |
| 12 | slot 目录新增 `conversation.chat.flow`/`conversation.chat.reasoning.body`；`conversation.chat.node`/`conversation.input.activity` 的 `declaredBy` 改挂 `conversation.chat.flow` | 注入上述既有槽的客户端插件（容器父级变化，注入本身不报错但渲染上下文移位） | 🟡 id 语义移位 |
| 13 | `session-title` 自定义适配器须把 `reasoning.efforts` 按低→高排列；仅经 `llm/stream` 中间件提供标题路由的组合必须注册 adapter | 自研 llm adapter / 标题路由插件 | 🟡 有则改 |
| 14 | `dsh plugin --profile` 只在转发 pnpm 参数之前被读取；写在 pnpm 命令之后的 `--profile`/`-h` 原样转给 pnpm | 包装 `dsh plugin` 的脚本/自动化 | 🟡 脚本 |
| 15 | `llm-mock-server` 在每条 SSE 旁发命名 Messages 事件；只接无名 SSE 的消费方须改事件处理 | 用 mock server 的测试消费者 | 🟢 测试面 |
| 16 | `agent-instructions` 行不再接 `dshHome`，指令加载恒取 `$DSH_HOME`/`~/.dsh`；残留键被忽略 | 给 `agent-instructions` 打 `dshHome` override 的 profile patch | 🟢 静默忽略 |
| 17 | DeepSeek 无凭据返空目录（Desktop/Web 隐藏 DeepSeek 组）；桌面 test 构建 auth 弹窗默认关闭；Web public listener 拒通配 | 部署/登录流程；非插件 API | 🟢 行为 |
| 18 | 新 session 创建新 Session+Agent（不再复用工作区内空 Session）；`uiWorkspace.startSession` 同语义 | 依赖"复用空会话"假设的客户端集成 | 🟢 行为 |
| 19 | vendor 列车续（loader peer `node-addon-require-builtin` ^0.1.6→^0.1.9）；`dsh-ssh` 独立 POSIX helper runtime | 直依赖 vendor 版本的锁定策略 | 🟢 版本层 |

> **a1 的 9 条风险表在本版仍逐条成立**（subpath 显示面换代 / invariants 移除 / schedule-bundle 退役 / 插件解析刷新语义…）；本版是**在其上叠加** a1→a2 的 20 条新指南，不回收 a1 的任何处方。升级 0.1.7→0.2.x 的总迁移仍以 `plugin-framework/v0.2.0-migration.md` 为主文档。

---

## 阅读路径

- 只想知道"我的插件要不要改"：[plugin-migration-guide.md](plugin-migration-guide.md)（结论：**比 a1 严得多——subagent 编排 / session-title provider / 读 BundleInfo 的客户端 / 自渲染 TerminalBlock / SSH-PTC 组合 / 写过 `{{cwd}}` 的模板 有必做项**；纯 settings/skill/locale/peer 面多数插件仍可零改）
- 想知道"这 669 个提交都干了什么"：[diff-vs-0.2.1-alpha.1.md](diff-vs-0.2.1-alpha.1.md)
- 想按 Feature/Fix 过一遍：[CHANGELOG.md](CHANGELOG.md)
- 官方升级指南 20 篇：`docs/upgrade-guide/v0.2.1-alpha.1/`（19 篇）+ `docs/upgrade-guide/v0.2.0-rc.2/bundled-python-tests`（1 篇），逐篇要点已并入上方 Breaking 表与 [diff-vs-0.2.1-alpha.1.md](diff-vs-0.2.1-alpha.1.md) §升级指南
- 能力缝增删（§21.9 口径）：`docs/capability-seams.md` 生成区 +4（`ctx.workingDirectory`/`ctx.worktrees`/`ctx.translator`/`ctx.cotTranslation`），0 删除
