# dsh-v0.2.1-alpha.1 → dsh-v0.2.1-alpha.2 逐主题 diff 证据

> 区间：`5badb15009` → `d743267388`（tag 对象 `6851e49628`），669 commits（512 非 merge + 157 merge），3226 files changed, +114987/−28177。
> 本文件按变更族给出提交号与关键证据；结论版见 [README.md](README.md)，插件视角见 [plugin-migration-guide.md](plugin-migration-guide.md)。
> **提交类型分布**（512 非 merge）：fix 193 · test 153 · docs 58 · refactor 36 · feat 27 · chore 17 · perf 8 · build 4 · ci 3 · revert 2 · release 1 · style 1。唯一带 `!` 的破坏性提交：`b48384223a`。

## 〇、结构与契约基线（先立判据）

```bash
# 提交规模
git -C <repo> rev-parse dsh-v0.2.1-alpha.1              # 5badb15009（lightweight，指向 merge #5648）
git -C <repo> rev-parse "dsh-v0.2.1-alpha.2^{commit}"   # d743267388（annotated tag 6851e49628 解引用）
git -C <repo> log -1 --format='%h %ad %s' --date=short "dsh-v0.2.1-alpha.2^{commit}"  # d743267388 2026-10-09 Merge pull request #5946 ...
git -C <repo> log -1 --format='%b' d743267388           # release(dsh): 0.2.1-alpha.2
git -C <repo> diff --shortstat dsh-v0.2.1-alpha.1..dsh-v0.2.1-alpha.2   # 3226 files, +114987/−28177

# 持久化契约：SESSION_FORMAT_VERSION 两版同值 4
git -C <repo> grep -n "SESSION_FORMAT_VERSION = " "dsh-v0.2.1-alpha.2^{commit}" -- packages/core   # packages/core/session/src/types.ts:89 = 4

# 插件契约面（预期：前 5 项为空/仅版本号，slot 与 skill 非空）
git -C <repo> diff dsh-v0.2.1-alpha.1..dsh-v0.2.1-alpha.2 -- packages/boot/app-boot/src/plugin-compatibility.ts   # 空 = peer 校验未动
git -C <repo> diff dsh-v0.2.1-alpha.1..dsh-v0.2.1-alpha.2 -- vendor/cordis/ vendor/schemastery/                    # 空
git -C <repo> diff dsh-v0.2.1-alpha.1..dsh-v0.2.1-alpha.2 -- packages/boot/hmr/src/package-manifest.ts             # 空 = a1 过期机制未续改
git -C <repo> diff dsh-v0.2.1-alpha.1..dsh-v0.2.1-alpha.2 -- packages/settings/                                    # 仅 "version": alpha.1→alpha.2
```

契约面实测 diff 汇总：

| 面 | 路径 | 实测 |
|---|---|---|
| peer 闸门 | `packages/boot/app-boot/src/plugin-compatibility.ts` | **零 diff** ✅ |
| locale/图标装载 | `packages/boot/app-boot/src/package-meta.ts` | +5/−4：`realpathSync`→`realModuleFile`（新 `profile-resolution/legacy-links.ts` 导出），图标/locale 解析对 legacy 软链加固，接口形状不变 |
| settings 核心 | `packages/settings/` | 仅 `packages/settings/settings/package.json` 版本号 bump ✅ |
| 加载器 vendor | `vendor/cordis/`、`vendor/schemastery/` | **零 diff** ✅ |
| 加载器 vendor | `vendor/loader/` | peer `node-addon-require-builtin` `^0.1.6`→`^0.1.9`（版本层） |
| 槽位面 | `packages/extensions/cordis-client-runner/src/client/slot-catalog.ts` | **+109/−25**：新增 `conversation.chat.flow`、`conversation.chat.reasoning.body` 两槽；`conversation.chat.node`/`conversation.input.activity` 的 `declaredBy` 从 `conversation.view` 改挂 `conversation.chat.flow`；无删除槽 |
| 技能面 | `packages/skill/` | +101/−507：`skill-badge` 子包迁往 experimental（旧路径 D）；`tool-skill/src/index.ts` `inject` 加 `workingDirectory`、cwd 改 `ctx.workingDirectory.ensure()`；**`ctx.skills` provider 接口形状不变** |
| HMR 过期机制 | `packages/boot/hmr/src/package-manifest.ts` | **零 diff** ✅（a1 新增机制本版未续改） |

## 一、结构与包重组（12 新增 / 0 删除 / 11 改名）

```bash
git -C <repo> diff --name-status -M --diff-filter=ADR dsh-v0.2.1-alpha.1..dsh-v0.2.1-alpha.2 -- packages/ apps/ | Select-String "package.json$"
```

**改名（迁入 experimental，使 `packages/hooks/`、`packages/webhook/` 两顶层域整体消失）：**

```
R092  packages/hooks/hook-protocol                → packages/experimental/hook-protocol
R083  packages/hooks/hooks-claude-code            → packages/experimental/hooks-claude-code
R084  packages/hooks/hooks-codex                  → packages/experimental/hooks-codex
R096  packages/webhook/webhook                    → packages/experimental/webhook
R085  packages/webhook/webhook-github             → packages/experimental/webhook-github
R091  packages/skill/skill-badge                  → packages/experimental/skill-badge
R092  packages/workflow/tool-ralph                → packages/experimental/tool-ralph
R095  packages/session-query/tool-session-query   → packages/experimental/tool-session-query
R087  packages/terminal/tool-terminal             → packages/experimental/tool-terminal
R089  packages/session/session-title-all-prompts-llm → packages/experimental/session-title-all-prompts-llm
R057  packages/subagent/subagent-in-process-driver → packages/session/working-directory   # 低相似度配对，见 §二
```

**新增（12）：** experimental 下 `badge-skill-bundle`、`client-ui-cot-translation`、`cot-translation-bundle`、`ralph-bundle`、`session-search`、`session-titles-bundle`、`terminal-bundle`、`tool-worktree`、`translator`、`worktree`（10），加 `packages/session/tool-working-directory`、`packages/ssh/ssh-helper-runtime`（2）。

驱动提交：`b48384223a refactor(experimental)!: classify optional packages and move prototypes`（唯一 `!`）、`c2d528bb6d refactor(experimental): classify optional session search tools`、`dd302f718b`/`75542dd10a feat(session): catalogue/append experimental plugin records`。

## 二、子代理激活统一化（~50 commits，`subagent` scope 47）

主线（时间序，`git log --oneline --no-merges A..B -- packages/subagent`）：

```
390fbe8852 refactor(subagent): merge orchestration and activation ownership
3d852a1cea refactor(subagent): unify local and external activation lifecycles
5ca7f533e1 refactor(subagent): own external runs without activation drivers
c17a1fa189 refactor(subagent): represent external catalog entries by mode
8b43d44cc6 refactor(subagent): limit discovery to parent-delivery children
ef88d6a277 refactor(subagent): deliver activation results after teardown
f3a69dff00 refactor(subagent): remove redundant state and settle local results after descendants
4565dafc58 refactor(subagent): default base fork delegation to continuable
1e00ab89a7 refactor(subagent): keep catalog entries as creation facts
a008c6adae refactor(subagent): keep input delivery local to activation drivers
4c8cb2fac6 refactor(subagent-acp): reuse shared working directory resolution
```

**证据（激活语义换代）**：官方指南 `docs/upgrade-guide/v0.2.1-alpha.1/subagent-activations/guide.md`——`@deepseek-ai/dsh-tool-subagent` 移除 `backgroundMode`、`enableRunInBackground`、模型参数 `run_in_background`；每次委派接受子 agent 后返 `{ kind:'activation', subagentId }`，前台结果与 `{ kind:'background', jobId }` 移除，`job_output`/`job_kill` 不再收集子代理；`@deepseek-ai/dsh-subagent-in-process-driver` **包移除**，`start()`/`startContinuable()` → `startActivation()`。

## 三、Working directory 能力缝（~15 commits）

```
79bd3d8da7 feat(session): centralize working directories and directory context
c67a2d6fdf feat(experimental): create and enter retained Git worktrees     # worktree 与其联动，见 §七
```

**新缝（`docs/capability-seams.md`）**：`ctx.workingDirectory`（`packages/session/working-directory`，`seam`），消费者 `tool-working-directory`、`tool-fs`、`tool-bash`、`tool-pwsh`、`subagent`、`sdk-jsonrpc-server`；`ctx.worktrees`（`experimental-worktree`，消费者 `tool-worktree`）。

**持久化承认**：`docs/persistence-changes/2026-09-13-working-directory.md`（`event:working-directory/change`，`decision: same-version`，兼容语："older builds that do not know working-directory/change refuse logs containing it"）、`2026-10-05-working-directory-attribution.md`（producer-owned notice attribution）。

**证据（`{{cwd}}` 移除）**：官方指南 `working-directory/guide.md`——移除 loop 内置 `{{cwd}}` 变量与 `dsh-subagent-acp`/`dsh-subagent-dsh-sdk` 的 `cwd` 配置键；`output.presentationMeta` 现在也在嵌套 PTC 调用中运行；`tool-skill/src/index.ts` `inject` 加 `workingDirectory`，`{cwd: agent.session.header.cwd}` → `{cwd: await ctx.workingDirectory.ensure(agent, signal)}`（`packages/skill/tool-skill/src/index.ts@alpha.2`）。

## 四、Session 标题 provider 换代（~14 commits，`session-title` scope 14）

```
353fe00d63 refactor(session-title): separate provider model strategies
```

**证据**：官方双指南 `session-title-provider-strategy`（`dsh-session-title-llm` 删 `registerSessionTitleLlmProvider`/`generateSessionTitleWithLlm`/`SessionTitleLlmMessageSelector` 导出；`SessionTitleLlmConfig` 收缩；provider 直注 `ctx.sessionTitle.register()` + `executeSessionTitleLlm(ctx,config,request,providerId,{system,input,messageSeqs,selectReasoningEffort})`；`SessionTitleProviderRequest` 加可选 `currentTitle`）+ `session-title-adapters`（标题经 `ctx.llm.prepareCall()` 准备；自定义适配器 `reasoning.efforts` 须低→高排列）。持久化：`2026-10-07-title-reasoning-effort.md`。`session-title-all-prompts-llm` 迁 experimental。

## 五、LLM 准备调用 / 推理档位（~28 commits，`llm` 12 + `llm-pi-ai` 16）

```
c56fdb023e refactor(llm): configure prepared calls with explicit controls
ffb88d331e feat(llm): resolve minimum reasoning during call preparation
9e36f20675 refactor(llm): report a route's floor effort and let the caller select it
32a561f3a6 refactor(llm): request minimal reasoning without naming a caller purpose
1ca5832919 feat(llm): support pi-ai conversation prompt and tool updates
46164dfb2b refactor(llm-pi-ai): delegate system message placement to pi-ai
ce7f8338e4 refactor(llm-pi-ai): minimize context conversion changes
```

与 session-title-adapters 咬合：`prepareCall()` 输入契约稳定，档位排序成为新约束。`tool-presentation-mode` 指南属本组连带：`dsh-tools`/`dsh-agent-tool-presentation` 的 `mode` 只接 `native`/`ptc`，`both` 被拒（含 `DSH_TOOLS_MODE=both`），驱动 `4359d3ee17 refactor(tools): remove mixed tool presentation`。

## 六、推理翻译族（~10 commits，`translator` scope 5）

```
f1250c6e36 feat(translator): add anonymous Google and Bing translation service
b98b76c9a5 feat(translator): add opt-in native DeepSeek Flash translation
cfc6be809c feat(reasoning): persist opt-in machine translations
```

新包：`packages/experimental/translator`（`ctx.translator` service，匿名文本翻译）、`client-ui-cot-translation`（`ctx.cotTranslation` Remote）、`cot-translation-bundle`。`docs/capability-seams.md`：`ctx.cotTranslation`、`ctx.translator` 两 service 边新增。

## 七、Git worktree + SSH helper 换代（~10 commits）

```
c67a2d6fdf feat(experimental): create and enter retained Git worktrees    # packages/experimental/worktree + tool-worktree
d9342fcb5d feat(ssh): package standalone POSIX helper runtimes            # packages/ssh/ssh-helper-runtime
```

**证据**：官方指南 `ssh-helper-launch`——`dsh-ssh` 用 `launch` 取代顶层 `node`/`bootstrapPath`/`bootstrapHash`，要求 SSH protocol 2；`dsh-ptc-runtime-node` 用 `launch` 取代 `nodeExecutable`/`bootstrapPath`；连接 getter → `ptcLaunch`；`cordis.yml` 与已装 helper 必须一起升级。worktree 缝 `ctx.worktrees`（`seam`，`experimental-worktree`）。

## 八、Client UI 槽位与迁移 UX（~30 commits，`web` 36 + `ui-chat` 9 + `client` 9 交叠）

```
a0a9aef5ec feat(ui-chat): add independent collapse timing and viewport-scoped flow
3385180b9b refactor(web): compose reasoning content through a shared slot factory
dc22e172f4 feat(session): show header migration status before expansion
a2dd724c60 feat(session): expose format status and defer frontend-triggered migration
c1df683f8c feat(client): guide migration-required forks and subagent discovery
849e9ebd8d feat(client): configure text, code, and terminal fonts and sizes independently
e127ed2d6c refactor(client): position the lightbox in a stage below the Windows caption
543834a9f4 refactor(web): simplify trajectory timing types
```

**槽面证据**：`slot-catalog.ts` 新增 `conversation.chat.flow`（reasoning 内容经共享 slot factory 组合的容器）、`conversation.chat.reasoning.body`；`conversation.chat.node`/`conversation.input.activity` 的 `declaredBy` 由 `conversation.view` 改挂 `conversation.chat.flow`。`terminal-command-labels` 指南：`dsh-client-ui-primitives` 的 `TerminalBlockLabels` 新增必需 `commandLine(line:number):string`。

## 九、Agent Teams 直投 inbox（~7 commits，`agent-team` scope 7）

```
c772c85c17 refactor(agent-team): send directly through Agent inbox steering
a5098110cf refactor(agent-team): stop delivering historical mailbox records
1a1b3c1896 refactor(agent-team): unify admitted operation tracking
5cec0b792a fix(agent-team): omit message IDs from send tool results
```

**证据**：`team-direct-inbox` 指南——移除 Team mailbox，直发目标 Agent inbox；`send_message` 只返 `{ "sent": true }`，不暴露消息 ID、无 `accepted`/`queued`，失败不留存重试、显式重发不去重。revert `43dd2bdeac revert: keep existing Agent attribution for Team messages`。

## 十、能力包组合制 + bundle 全局工具 + preset patch 撤回（~25 commits）

```
3aa1cab43a feat(plugin): compose optional bundles inside agent presets
8a9767c25e feat(plugin): validate optional bundle lifecycles and session output
b173f3e2a2 revert(plugin): drop preset-scoped profile patches; ship optional tools as global Host rows   # 撤回上一行
8ed0b530ed feat(plugins): offer official bundles through on-demand installation
f730199b94 test(plugin): classify on-demand composition and document mock events
332a223d20 / d7c7495e87 / 8b5527b8da / e9a68b2484 / a453218aff fix(plugins): 官方源 bundle 安装/身份/恢复/诊断/目录条目
```

**证据**：`b173f3e2a2` body——移除 `{preset, insert}`/`{preset, id, override}` profile patch（连带 app-boot 编译器、reload drain、config-editor 过滤、plugin-manager preset 行清点、agent-preset-registry 行身份）；session-search/Ralph/persistent terminals/Codex/Claude Code bundle 改插普通 Host 行，工具注册进全局工具层，**所有 preset 含 `minimal` 可见**，切 bundle 无需新组合代际即热更新。`native-subagent-bundle-tools` 指南：客户端插件收必填 `BundleInfo.official` + `BundleInfo.availability`。`experimental-package-composition` 指南：可选 hooks/webhook/工具/技能不再随运行时装；装包≠挂载，须先选 bundle；profile 禁自动 peer 安装。

## 十一、Web / Desktop / CLI / 部署工程（~40 commits，`desktop` 15 + `cli` 5 + `scripts` 8）

```
cb9a590c86 Support concrete Web listener bind addresses          # web-listener-trust-config：webRuntime→webStartup，拒通配 host
02f5423070 fix(models): hide unconfigured DeepSeek models and unavailable selections   # deepseek-model-discovery
e8226b2a84 / 6846934b98 fix(desktop): require local opt-in for test authentication popups   # desktop-test-auth-popup
2604a4b13a / 0853aeb0ee feat(desktop): local macOS packaging configuration-free / unsigned DMG
75935af1d0 feat(cli): generate the CLI help reference and add dsh plugin help          # plugin-option-placement
21d0c2e29c / 25f1672095 feat+refactor(agent-instructions): load shared agents-root AGENTS.md / drop per-row dshHome   # instruction-home-override
```

`instruction-home-override` 指南：`agent-instructions` 行不再接 `dshHome`，恒取 `$DSH_HOME`/`~/.dsh`，残留键被忽略。

## 十二、Python 运行时 / PTC sandbox（~10 commits，`python` 5）

```
89f35fe2e9 fix: download optional Python runtime resources explicitly    # python-optional-resources
```

三指南：`python-ptc-sandbox`（`dsh-experimental-ptc-runtime-python` 要求 `sandbox`+`sandboxPolicy`，无法约束时 `sandbox-unavailable`；`PtcRunResult.sandbox` 报约束）、`python-optional-resources`（Office/authoring 轮子显式下载，SDK 启动不自动下）、`bundled-python-tests`（rc.2 目录补入：省略 NumPy/pandas 上游测试目录，`numpy.testing`/`pandas.testing` 仍在）。

## 十三、持久化承认（5 条，同版本加性）

```bash
git -C <repo> diff --name-status --diff-filter=A dsh-v0.2.1-alpha.1..dsh-v0.2.1-alpha.2 -- docs/persistence-changes/   # 20 文件 = 5 条 × 4
```

| 变更 id | 语义 | 兼容 |
|---|---|---|
| `2026-09-13-working-directory` | 加 `event:working-directory/change` 持久事件 | 旧构建拒绝含该事件的日志（**降级风险**） |
| `2026-09-19-external-subagent-catalog` | 父 catalog 条目加 external mode（无本地 Session 的子级） | same-version |
| `2026-10-05-ptc-operation-metadata` | 嵌套 PTC 工具结果加纯展示元数据（操作期目录/文件目标） | same-version |
| `2026-10-05-working-directory-attribution` | producer-owned working-directory notice 归属 | same-version |
| `2026-10-07-title-reasoning-effort` | 记录辅助标题请求所选推理强度 | same-version |

## 十四、门禁 / 测试 / 基准 / vendor（~35 commits，`bench` 9 + `ci` 11 + `deps` 16）

- `mock-messages-events` 指南：`dsh-llm-mock-server` 在每条 SSE 旁发命名 Messages 事件（`f730199b94` 关联），只接无名 SSE 的消费者须改。
- vendor 列车续（`deps` 16）；`vendor/loader/` peer `node-addon-require-builtin` `^0.1.6`→`^0.1.9`。
- `plugins` scope 21 里含 plugin-market/on-demand 官方 bundle 安装的门禁与恢复。

## 升级指南全集索引（`docs/upgrade-guide/`，本窗口 +60 文件 = 20 篇 × 3）

| 目录 | 指南 | 破坏性核心 |
|---|---|---|
| v0.2.1-alpha.1/ | `subagent-activations` | tool-subagent 删后台/前台，包移除，startActivation |
| v0.2.1-alpha.1/ | `session-title-provider-strategy` | llm 包三导出删除 |
| v0.2.1-alpha.1/ | `session-title-adapters` | prepareCall 标题路由，档位低→高 |
| v0.2.1-alpha.1/ | `native-subagent-bundle-tools` | BundleInfo.official/availability 必填 |
| v0.2.1-alpha.1/ | `working-directory` | `{{cwd}}` 移除，subagent cwd 键移除，presentationMeta 嵌套 |
| v0.2.1-alpha.1/ | `tool-presentation-mode` | mode 只 native/ptc，both 拒 |
| v0.2.1-alpha.1/ | `web-listener-trust-config` | webRuntime→webStartup，拒通配 host |
| v0.2.1-alpha.1/ | `ssh-helper-launch` | dsh-ssh/ptc-runtime-node launch，proto2 |
| v0.2.1-alpha.1/ | `terminal-command-labels` | TerminalBlockLabels 需 commandLine() |
| v0.2.1-alpha.1/ | `team-direct-inbox` | send_message 只返 {sent:true} |
| v0.2.1-alpha.1/ | `experimental-package-composition` | 可选包显式安装/组合，禁自动 peer |
| v0.2.1-alpha.1/ | `python-ptc-sandbox` | ptc-runtime-python 要求 sandbox+sandboxPolicy |
| v0.2.1-alpha.1/ | `instruction-home-override` | agent-instructions 行弃 dshHome |
| v0.2.1-alpha.1/ | `plugin-option-placement` | dsh plugin --profile 位置规则 |
| v0.2.1-alpha.1/ | `mock-messages-events` | mock-server 命名 SSE 事件 |
| v0.2.1-alpha.1/ | `new-session-generations` | 新会话建新 Agent |
| v0.2.1-alpha.1/ | `deepseek-model-discovery` | 无凭据返空目录 |
| v0.2.1-alpha.1/ | `desktop-test-auth-popup` | test 构建 auth 弹窗默认关 |
| v0.2.1-alpha.1/ | `python-optional-resources` | Office/authoring 轮子显式下载 |
| v0.2.0-rc.2/ | `bundled-python-tests` | NumPy/pandas 测试目录省略 |

## 完整提交清单

```bash
git -C <repo> log --oneline --no-merges dsh-v0.2.1-alpha.1..dsh-v0.2.1-alpha.2   # 512 条
git -C <repo> log --oneline --merges      dsh-v0.2.1-alpha.1..dsh-v0.2.1-alpha.2  # 157 条
git -C <repo> diff --stat dsh-v0.2.1-alpha.1..dsh-v0.2.1-alpha.2 | tail -1         # 3226 files, +114987/−28177
```
