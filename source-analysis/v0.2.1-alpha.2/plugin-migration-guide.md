# v0.2.1-alpha.2 插件迁移指南（0.2.1-alpha.1 → 0.2.1-alpha.2，可操作版）

> 对比基线：`dsh-v0.2.1-alpha.1`（`5badb15009`，2026-10-03，PR #5648）→ `dsh-v0.2.1-alpha.2`（tag `d743267388`，2026-10-09，PR #5946），669 commits（512 非 merge）。
> 逐 diff、提交号、复核命令见 [diff-vs-0.2.1-alpha.1.md](diff-vs-0.2.1-alpha.1.md)。
> **从 0.1.7 线直接升 0.2.x 的插件：主迁移文档仍是 [../../plugin-framework/v0.2.0-migration.md](../../plugin-framework/v0.2.0-migration.md)，本指南只回答"0.2.1-alpha.2 相比 alpha.1 多了什么"。**
> 官方在本窗口新增 **20 篇升级指南**（19 篇 `docs/upgrade-guide/v0.2.1-alpha.1/` + rc.2 目录 1 篇），本指南必做项与其中插件相关的 10 篇对应。

---

## 〇、先说结论

**核心闸门契约仍零 diff：peer 校验（`plugin-compatibility.ts`）、settings 核心（仅版本号 bump）、加载器 vendor `cordis`/`schemastery`、HMR `package-manifest.ts` 未动；`SESSION_FORMAT_VERSION` 保持 4。** peer 范围 `>=0.2.0-rc.1 <0.3.0-0` 天然覆盖 0.2.1-alpha.2，**不装/不改 peer 不会被拒载**。

但**与 a1"多数插件零必做"不同，本版破坏面显著变宽**——一次 alpha 里塞了 10 篇插件可见升级指南。**纯 settings / locale 显示 / 简单 tool 贡献 / 只读 `ctx.skills` 的插件仍可零改**；但只要落进下表任一行，就有必做项：

| 你的插件/环境属于 | 必做项 | 官方指南 |
|---|---|---|
| **委派子代理 / 调 subagent 服务 API** | 去掉 `backgroundMode`/`enableRunInBackground`/`run_in_background`；消费 `{kind:'activation',subagentId}`（不再拿前台/`{kind:'background'}` 结果、不再 `job_output`/`job_kill`）；`start()/startContinuable()`→`startActivation()` | `subagent-activations` 🔴 |
| **自研 session-title provider** | `dsh-session-title-llm` 三导出没了——改 `ctx.sessionTitle.register()` + `executeSessionTitleLlm(...)`；`targetWords`/`targetCjkCharacters` 移进你的 Config；`tsc` 过一遍被删符号 | `session-title-provider-strategy` 🔴 |
| **读 bundle 卡片 / 详情槽的客户端插件** | 若精确构造/校验 `BundleInfo` 或 slot `PluginPackageRef`，必须补新增必填 `official`、`availability`；只读旧字段的方无需改 | `native-subagent-bundle-tools` 🔴 |
| **prompt 模板里写过 `{{cwd}}`** | 从 home/profile/`personaSuffix`/preset `suffix` 删掉含 `{{cwd}}` 的目录语句；`subagent-acp`/`subagent-dsh-sdk` profile patch 里的 `config.cwd` 删除，子代理目录改启动请求传 `cwd` 或先调 `working_directory({cd})` | `working-directory` 🔴 |
| **自渲染 `TerminalBlock` 的 UI 插件** | `TerminalBlockLabels` 必须提供 `commandLine(line:number):string` | `terminal-command-labels` 🔴 |
| **自定义 SSH 组合 / 嵌 PTC-Node** | `dsh-ssh` 的 `node`/`bootstrapPath`/`bootstrapHash`→`launch`（且要求 SSH proto 2）；`dsh-ptc-runtime-node` 的 `nodeExecutable`/`bootstrapPath`→`launch`；`cordis.yml` 与已装 helper 同步升级 | `ssh-helper-launch` 🔴 |
| **注入 `webRuntime` / 读 `ctx.webRuntime.trustedHosts`** | 改 `webStartup`；监听 host 必须是本机某一具体 IPv4/IPv6，通配 `0.0.0.0`/`::` 加载即拒 | `web-listener-trust-config` 🔴（引用即失败） |
| **依赖 hook 桥 / webhook / 可选工具技能** | 这些包迁进 `packages/experimental/`，**不再随运行时装**；显式装包+所需 peer（profile 禁自动 peer），选 bundle 后才可覆盖其行 | `experimental-package-composition` 🟡 |
| **用过 tool presentation `both` / 打过 agent-instructions `dshHome`** | `both`→选 `native`/`ptc`；agent-instructions 的 `dshHome` override 删除（残留被忽略） | `tool-presentation-mode`/`instruction-home-override` 🟡 |
| **消费 `tool-agent-team` 的 `send_message` 返回值** | 只返 `{sent:true}`，别依赖消息 ID / queued 状态 / 自动重试去重 | `team-direct-inbox` 🟡 |
| 都不是 | 零必做；浏览 §三观察点 | — |

> **a1 的三类必做（subpath 显示面 / invariants 引用 / schedule-bundle 用户）在本版逐条原样成立**——见 [../v0.2.1-alpha.1/plugin-migration-guide.md](../v0.2.1-alpha.1/plugin-migration-guide.md)，不重复。

---

## 一、必做项详解（按插件可见度排序）

### 1. subagent 激活换代 🔴

`@deepseek-ai/dsh-tool-subagent` 配置层删 `backgroundMode`/`enableRunInBackground`，模型层删参数 `run_in_background`。所有委派在智能体接受后统一返回 `{ kind:'activation', subagentId }`，由父级完成通知交付最终答案。

- 结果消费方：**删掉对 `{kind:'foreground'}` / `{kind:'background', jobId}` 的分支**，改读 `subagentId`、收完成通知；
- 停止/续聊：用 `interrupt_agent` 停当前执行、`send_message` 仅对本地子级；**不再经 `job_output`/`job_kill`**；
- 宿主直调方：`ctx.subagents.start()`/`startContinuable()` → **`startActivation()`**；`@deepseek-ai/dsh-subagent-in-process-driver` **包已移除**（R057 语义并入 `packages/session/working-directory`），依赖它的代码须改引本地 provider `prepareContinuable()`。

### 2. session-title provider 换代 🔴

`@deepseek-ai/dsh-session-title-llm` **不再导出** `registerSessionTitleLlmProvider` / `generateSessionTitleWithLlm` / `SessionTitleLlmMessageSelector`。迁移：`registerSessionTitleLlmProvider(...)` → 直接 `ctx.sessionTitle.register({id, automatic, generate})`；`generate(request)` 里自构建 system/input，调 `executeSessionTitleLlm(ctx, config, request, providerId, {system, input, messageSeqs, selectReasoningEffort})`，拒绝 `tool-calls`/`max-tokens` 终态，从文本块派生标题；需要保留已接纳标题时读 `request.currentTitle`。`SessionTitleLlmConfig` 只剩执行控制（`maxInputBytes`/`maxOutputTokens`/`timeoutMs`/`provider`·`model`），`targetWords`/`targetCjkCharacters` 归你的 Config。

### 3. BundleInfo / PluginPackageRef 新增必填字段 🔴

native subagent bundle 头一次把委派工具作为 Host 全局工具贡献（`tool-subagent-claude-code`/`tool-subagent-codex`，所有 preset 含 `minimal` 可见）。客户端插件收到的 `BundleInfo` 现**必带** `official`（项目维护标识）与 `availability`（`installation`|`profile`|`missing`，注意 `installed` 仍指 profile 依赖声明）；slot 的 `PluginPackageRef` 同样。**只读旧字段的渲染方无需改；精确构造方/校验器必须含新字段**（否则 TS 或断言失败）。可选 `installTarget` 标所提供版本与注册表/本地链接 spec。

### 4. `{{cwd}}` 移除与 working-directory 缝 🔴

loop 内置 `{{cwd}}` 提示词变量删除；残留未解析 `{{cwd}}` 的自定义模板会**在模型请求发出前失败**。目录上下文改由 `ctx.workingDirectory`（`packages/session/working-directory`）以必需 user context 提供，与原始 `Session.header.cwd` 分开持久化。子代理目录：profile patch 里 ACP/DSH-SDK provider 行的 `config.cwd` 删除，为单个子代理选目录改在启动请求传 `cwd`，或先 `working_directory({cd:"/abs"})` 再启动。**仅读原始项目/权限根才用 `Session.header.cwd`；当前目录操作走 working-directory 服务。**

### 5. TerminalBlock 需 `commandLine()` / SSH-PTC 启动换代 / webRuntime→webStartup 🔴

- `@deepseek-ai/dsh-client-ui-primitives` 的 `TerminalBlockLabels` 新增必需 `commandLine(line:number):string`——溢出命令行用它作可键盘聚焦组的无障碍名（贴合行不新增 Tab stop）。
- SSH：`dsh-ssh` 顶层 `node`/`bootstrapPath`/`bootstrapHash` → `launch`，要求 protocol 2；`dsh-ptc-runtime-node` `nodeExecutable`/`bootstrapPath` → `launch`；连接 getter → `ptcLaunch`。`cordis.yml` 与已装 helper 必须一起更新。
- Web：`webRuntime` 服务/`web-runtime` 行的 `trustedHosts` 由 `webStartup` 取代；注入 `webRuntime` 的 patch 会等待一个永不挂载的服务；host 须为本机具体地址。

---

## 二、a1 指南条目的本版状态

| a1 条目 | 本版状态 |
|---|---|
| peer 世代门槛（`<0.2.0-0` 挡安装） | ✅ 原样成立（`plugin-compatibility.ts` 零 diff）；`>=0.2.0-rc.1 <0.3.0-0` 覆盖 0.2.1-alpha.2 |
| subpath 插件读 `<subpath>/package.json` 换代 | ✅ 原样成立；本版 `package-meta.ts` 仅加固图标/locale 解析（`realModuleFile` 处理 legacy 软链），显示面契约不变 |
| runtime invariants 移除 | ✅ 原样成立（引用才炸） |
| schedule-bundle 退役 / preset 贡献制 | ♻️ **被本版再改写**——bundle 打包制扩到 ralph/terminal/session-titles/cot-translation/badge-skill，且 `b173f3e2a2` 撤回 preset-scoped patch，改回**全局 Host 行**；preset 作用域 profile patch 概念作废 |
| 插件运行时解析刷新 / HMR 过期 | ✅ 原样成立（`package-manifest.ts` 本版零 diff） |
| composer stats dock 拆分（activity/usage） | ✅ 原样成立 |

---

## 三、观察点（非必做）

### 1. slot 目录扩张 + 重挂 🟡（注入既有 chat 槽的客户端插件）

`slot-catalog.ts` 新增 `conversation.chat.flow`（reasoning 内容共享 slot factory 的容器）、`conversation.chat.reasoning.body`。**既有 `conversation.chat.node`、`conversation.input.activity` 的 `declaredBy` 从 `conversation.view` 改挂到 `conversation.chat.flow`**——注入这两个槽的插件不会报错，但其容器父级变了，若你依赖 `conversation.view` 挂载时机来推断这些槽的存在，改看 `conversation.chat.flow`。

### 2. 能力包搬家影响 require 路径 🟡

`hooks`/`webhook`/`skill-badge`/`tool-ralph`/`tool-session-query`/`tool-terminal`/`session-title-all-prompts-llm` 迁入 `packages/experimental/`——**包名（`@deepseek-ai/dsh-*`）不变**，profile 里按包名引用不受影响；但任何按**磁盘路径**（`packages/hooks/...`、`packages/webhook/...`）import 或做 workspace 协议引用的开发链/脚本须改路径。

### 3. CLI 与门禁层 🟢

- `dsh plugin` 的 `--profile` 只在转发给 pnpm 的参数**之前**被识别；写在 pnpm 命令之后的 `--profile`/`-h` 原样转给 pnpm——包装脚本注意位置；
- 新 session 建新 Agent（`startSession` 语义），依赖"复用空会话"的客户端集成须改；
- `llm-mock-server` 发命名 Messages SSE 事件——只接无名 SSE 的测试消费者要改；
- DeepSeek 无凭据返空目录、桌面 test 构建 auth 弹窗默认关——非插件 API，部署/登录注意；
- vendor `loader` peer `node-addon-require-builtin` ^0.1.6→^0.1.9——直依赖 vendor 版本的锁定策略核对。

### 4. 持久化降级风险 🟡（若你的工具链读 Session JSONL）

5 条同版本加性承认不改 `SESSION_FORMAT_VERSION`（仍 4），但新增事件（如 `event:working-directory/change`）"**读取时必需**"——**a1 或更早构建读到 a2 写出的含新事件日志会拒绝**。跨版本共享 Session 存储/回放/导出的插件（如记忆/搜索/审计类）若自建 JSONL 解析器，须容忍新事件词表。

---

## 四、升级检查清单（alpha.1 → alpha.2 增量部分）

| # | 事项 | 级别 |
|---|------|------|
| 1 | 委派子代理 / 调 subagent API：删后台前台分支、改 `startActivation()`、移除 in-process-driver 依赖 | 🔴 有则必做 |
| 2 | session-title provider：改 `ctx.sessionTitle.register()`+`executeSessionTitleLlm()`；`tsc` 过被删导出 | 🔴 有则必做 |
| 3 | 读 bundle 卡片/详情槽：`BundleInfo`/`PluginPackageRef` 补 `official`/`availability` | 🔴 有则必做 |
| 4 | prompt 模板/subagent 配置：清 `{{cwd}}` 与 `config.cwd`；目录改走 working-directory | 🔴 有则必做 |
| 5 | 自渲染 TerminalBlock：补 `commandLine()` | 🔴 有则必做 |
| 6 | 自定义 SSH/Node-PTC 组合、注入 webRuntime：改 `launch` / `webStartup` | 🔴 有则必做 |
| 7 | 依赖 hooks/webhook/可选工具技能：显式装包+peer、选 bundle；按路径 import 的开发链改 experimental | 🟡 有则改 |
| 8 | tool presentation `both`、agent-instructions `dshHome`、消费 agent-team `send_message` 返回值 | 🟡 有则改 |
| 9 | 注入 `conversation.chat.node`/`input.activity` 的插件：核对 `conversation.chat.flow` 新父容器 | 🟡 有则测 |
| 10 | peer 范围 `>=0.2.0-rc.1 <0.3.0-0` **无需修改** | 🟢 无动作 |

---

## 五、对 mine-dsh-plugins 自家仓的实际影响（逐仓三档）

> 判据基于本目录已核到的破坏面 + 各仓职责；标 ⚠️ 的需实测确认。未逐一 `tsc`/运行的写「未核实」。

| 仓 | 落点 | 档位 | 依据 |
|---|---|---|---|
| dsh-session-guard / dsh-session-steward | 读 Session JSONL、子代理编排 | 🔴 必改/必测 | working-directory/external-subagent-catalog 新事件（降级拒绝）；subagent 激活语义 |
| dsh-prime-memory / dsh-prime-memory-flh-base / dsh-memory-palace | 自建 Session 解析/回放 | 🟡 建议改 | 5 条同版本加性持久化承认，解析器须容忍新事件词表（§三.4） |
| dsh-session-search | 会话搜索 | 🟡 建议改 | 宿主新增 `packages/experimental/session-search`（`c2d528bb6d`），功能重叠需去重/让位 |
| dsh-thinking-levels | 推理档位 | 🟡 建议改 | LLM prepared call 显式控制 + 路由档位下限（`c56fdb023e`/`9e36f20675`）；适配器档位低→高约束 |
| dsh-bash-terminal-ts / dsh-terminal 类 | TerminalBlock 渲染 | 🔴 必改（若自渲染） | `TerminalBlockLabels.commandLine()` 必需（§一.5） |
| dsh-context-compression-improved | compaction/session header | 🟡 建议改 | header 迁移状态前置、延迟前端触发迁移（`dc22e172f4`/`a2dd724c60`） |
| dsh-tidy-display / dsh-tidychat / dsh-arrowkey-nav / dsh-transition-webui | 注入 chat/input 槽 | 🟡 建议改 | `conversation.chat.node`/`input.activity` 重挂 `conversation.chat.flow`（§三.1）；未核实各仓实际注入点 |
| dsh-live-token-stats | composer stats dock | 🟢 无影响 | a1 的 activity/usage 拆分本版原样成立，无新增变化 |
| dsh-preset-manager | preset/patch 管理 | 🔴 必改（若用了 preset-scoped patch） | `b173f3e2a2` 撤回 `{preset,insert}` 机制，改全局 Host 行 |
| dsh-perm-gate / dsh-seatbelt-sandbox | sandbox/policy | 🟡 建议改 | Python PTC 强制 sandbox+sandboxPolicy（`python-ptc-sandbox`）；权限面本身未动 |
| dsh-mcp-registry / dsh-free-search / dsh-media-lens / dsh-video-read | 工具/skill provider/附件 | 🟢 无影响 | `ctx.skills` provider 接口形状不变；tool 契约未变（未逐仓核实对 `dsh-tools.mode` 的引用） |
| dsh-date-wrapper / dsh-auto-paste / dsh-paste-dock / dsh-paste-to-path / dsh-input-traffic | 输入/粘贴/时间 | 🟢 无影响 | 不碰本版破坏面；peer/manifest/settings 零 diff |
| dsh-brief-sidebar / dsh-canvas-tsx-sidebar | sidebar/canvas 槽 | 🟢 无影响 | sidebar 槽未增删；canvas 依赖的槽未变 |
| dsh-synapse / dsh-search-index | 事件/索引 | 🟡 建议测 | subagent 激活返回形状变化；新事件词表 |
| dsh-tidy-display / dsh-patch-edit-plus | 文本/代码字体面 | 🟢 无影响 | 849e9ebd8d 字体分置为宿主设置项，非插件契约 |
| awesome-dsh-plugin / drscrewdriver-profile / github-profile | 投稿/profile 清单 | 🟡 建议核对 | 若 profile 里引 hooks/webhook/可选包，需按 experimental-package-composition 补显式安装+bundle 选择 |

---

## 六、可复核命令

```bash
repo=E:/test/rewrite-agently/deepseek-harness
R1=dsh-v0.2.1-alpha.1; R2=dsh-v0.2.1-alpha.2

# 核心契约零 diff（预期空/仅版本号）
git -C $repo diff $R1..$R2 -- packages/boot/app-boot/src/plugin-compatibility.ts   # peer 校验未动
git -C $repo diff $R1..$R2 -- vendor/cordis/ vendor/schemastery/                    # 加载器 schema 未动
git -C $repo diff $R1..$R2 -- packages/settings/                                    # 仅 version bump
git -C $repo diff $R1..$R2 -- packages/boot/hmr/src/package-manifest.ts             # a1 过期机制未续改
git -C $repo grep -n "SESSION_FORMAT_VERSION = " "$R2^{commit}" -- packages/core    # 仍为 4

# 结构重组
git -C $repo diff --name-status -M --diff-filter=ADR $R1..$R2 -- packages/ apps/ | Select-String package.json$
git -C $repo show b48384223a --stat --format='%h %s' | Select-Object -First 5       # 唯一 ! 破坏性提交

# 插件可见破坏面指南
git -C $repo show "$R2^{commit}:docs/upgrade-guide/v0.2.1-alpha.1/subagent-activations/guide.md"
git -C $repo show "$R2^{commit}:docs/upgrade-guide/v0.2.1-alpha.1/session-title-provider-strategy/guide.md"
git -C $repo show "$R2^{commit}:docs/upgrade-guide/v0.2.1-alpha.1/native-subagent-bundle-tools/guide.md"
git -C $repo show "$R2^{commit}:docs/upgrade-guide/v0.2.1-alpha.1/working-directory/guide.md"

# 槽面 / 技能面
git -C $repo diff $R1..$R2 -- packages/extensions/cordis-client-runner/src/client/slot-catalog.ts | Select-String "key:" 
git -C $repo diff $R1..$R2 -- packages/skill/tool-skill/src/index.ts | Select-String "workingDirectory"   # provider 接口未变、消费者改缝

# 能力缝增删（§21.9 口径）
git -C $repo diff $R1..$R2 -- docs/capability-seams.md | Select-String "^\+.*ctx\.(workingDirectory|worktrees|translator|cotTranslation)"

# 持久化承认（5 条）
git -C $repo diff --name-status --diff-filter=A $R1..$R2 -- docs/persistence-changes/
git -C $repo show "$R2^{commit}:docs/persistence-changes/2026-09-13-working-directory.md" | Select-String "Compatibility" -Context 0,3

# 升级指南 20 篇索引
git -C $repo diff --name-status --diff-filter=A $R1..$R2 -- docs/upgrade-guide/
```
