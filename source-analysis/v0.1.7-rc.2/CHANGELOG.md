# DSH v0.1.7-rc.2 CHANGELOG（dsh-v0.1.7-rc.1 → dsh-v0.1.7-rc.2）

> 335 commits（224 非 merge + 111 merge）｜ 2026-09-23 ~ 2026-09-24 ｜ 发布 PR #5180
> 标记：⭐ 新包 ｜ ↩️ 窗口内落地后被 revert ｜ ⚠️ 破坏性 / 行为变化

## Features

- ⭐ **feat(llm): emit dynamic tool updates and project them per route** (`bc8c0dbf40`, PR #4844)
  工具集变更走增量更新：developer message 持久化 + `Session.toolHistory()` 折叠（`packages/core/session/src/tool-history.ts`）+ `projectToolUpdates` 按 route 投影（`packages/llm/llm/src/content.ts`）；DeepSeek 序列化为 `tool_addition`/`tool_removal` system block + `tool_reference`；beta header `mid-conversation-tool-changes-2026-07-01`；目录模型新增 `toolUpdate: 'in-history' | 'addition-only'`。配套：`f6848ee921`（保留 prompt history）、`1b0c2e5760`（保留 baseline 绑定激活）、`59318c1204`（投影语义明确 + deferred 激活）、`43048098f6`/`e221615112`/`f765a21dc7`/`ba66011fdb`（SDK/LLM 缓存复用测试）。
- ⭐ **feat(client): 可配置快捷键回归** (`91423ea1b4`, PR #5117/#5173)
  ⭐ 新包 `packages/client/shortcuts`（`@deepseek-ai/dsh-client-shortcuts`）与 `packages/client/ui-shortcuts`；Web 存储 `dsh.keybindings.v1`，Desktop 存储 `userData/keybindings.json`；桌面双键 chord；`ed3dcf54c5`（编辑体验与 sidebar hints）、`6a82709a2b`/`f6006c5547`/`d0861be2cd`（焦点/overlay/PRD 顺序修复）、`64d401c820`（版本对齐）。构建：`1e5af11d8c` shortcuts protocol 先于 main bundle。
- ⭐ **feat(client,session-controller,llm): track available models and expose account settings** (`cc478ac70a`)
  session-controller 追踪可用模型；remote events 新增 `credentials/record-updated`；`ui-model-selection` / `ui-settings-account` / `ui-settings-models` 联动。
- ⭐ **feat(agent,llm-deepseek,ui-settings-account): separate account routing and confirm sign-out** (`17825ee8c0`)
  账号路由分离；新增 `SignOutDialog`；`AccountController.hasRunningAccountTasks()`。
- ⭐ **feat(plugins): offer Auto review and keep Inspector explicitly installed** (`a3480857dd`, PR #4867)
  Auto review 成为已安装的 optional bundle（Official 组可见）；Inspector 保持显式安装；`scripts/optional-bundles.spec.ts` 校验双语元数据。
- **feat(schedule): ship Schedule in the default Web composition** (`e896737840`, PR #5011) → ↩️ 见下
- **feat(web): disable shipped schedule and time context plugins** (`cad6fef2fd`, PR #5175)
  rc.2 终态：`time-context` / `schedule` / `ui-schedule` 在 web-app bundle 中 `disabled: true`，默认会话无 `schedule_*` 工具；能力（60s fixed-rate floor、storage phase1 持久化与崩溃恢复 `7a362b263b` PR #4335）保留，需 overlay 显式启用。
- **feat(user-questions): support timed waits and late replies** (`bb19061473`, PR #4839) → ↩️ 整体 revert（`32905d5ab5`，PR #5174）；rc.2 终态 `ask_user` 与 rc.1 一致。
- **feat(desktop): hide the window on close and confirm interruptible quits** (`4745934683`, PR #5015)
  关闭即隐藏；退出前 quit-inspection IPC 确认活动任务/已武装提醒（2s 超时按有任务）；Windows 常驻托盘图标（`eec2b5fa6e`）；`5637311d5a`/`e6f135f15c`/`fbb3fb770f` 加固。
- **feat(desktop): 按请求凭据区分欠费提示及充值入口** (`2fd748edad`, #4858)
  `QuotaNoticeHost`（`packages/client/ui-chat`）；活跃 Platform 页面 hold/page 所有权语义。
- **feat(desktop): desktop onboarding** (PR #4459, `93b832f1b0`)
  设备本地账号 onboarding；强制更新 overlay 整合；recharge artwork；`f55c8d5215` 偏好写入等待。
- **feat(desktop): render local Markdown images** (`7f0a53dfb3`, #5105)
  本地图片经认证 dsh-app 文件路由解析（`ui-primitives/markdown`、`workspace-path/file-media-url`）。
- **feat(approval): localize approval explanations** (`12c9dd599e`, PR #4793)
  approval 提示本地化；ask 决策新增可选 `displayReason`（展示用），审计 reason 保持英文。
- **feat(client): archived 会话三态过滤** (`9775a95315` 等)：隐藏/全部/仅归档显式菜单；session list 图标化空状态（`2129486048`）；归档 glyph（`82b8c476e6`）。
- **feat(ui-tool): link the collapsed web fetch URL** (`61a0ed487e`, #3390)
- **feat(ui-model-selection): show a spinner while a model selection is pending** (`c87959bc44`)
- **feat(web): refine shortcut editing and sidebar hints** (`ed3dcf54c5`)
- **feat(web): unify UI materials and streamline file review** (`fdd14a0989`, PR #5030, 222 files)
- **feat(web): 由开发者模式统一控制新任务模式选择** (`a44534e274`)
- **feat(client): present compact developer tool update notices** (`7e5f906945`)
- **feat(voice-input): guide unready microphones to plugin setup** (`26b4980364`)
- **feat(i18n): key translation pairing records by heading section** (`e7def469e1`, PR #5036)
  `*.i18n.yaml` 逐节 hash；删除 `dsh-translation-pairing` merge driver。
- **feat(account): send client metadata with Platform requests** (`3970cc974f`)；**show bonus notices after visible display** (`081526aa3e`)；**align signed-out sidebar menu** (`c062c615dc`)
- **feat(client): quota notice / settings 联动**（`QuotaNoticeHost.tsx` 新组件挂接 apply/contract slots）

## Bug Fixes

### 持久化 / 会话
- **fix(atomic-write): take over a writer lock whose holder exited** (`7e7ba139fd`，PR #5165)；简化为 PID-only 记录（`910711e6c1`）；plugin-manager 等待 pnpm 残留退出操作（`1bd3df926d`，`.plugin-manager/run.json` 契约）。
- **fix(tools): keep surrogate pairs intact when capping tool output** (`dc07e5a50d`, PR #4827, #4817)——bash/pwsh/str-replace-editor 截断不再产生孤立代理（否则 Session log 被严格 JSON reader 拒绝）。
- **fix(session-query): classify live projection failures as corrupt** (`4e6a1c1073`)——`SESSION_QUERY_CORRUPT_SESSION`。
- **fix(session): retain baseline-bound tool activations** (`1b0c2e5760`)；**save default model settings in the background** (`86331673d9`)。
- **fix(agent-loop): preserve prompt history during supported tool updates** (`f6848ee921`)
- **fix(llm): keep oversized request extensions from blocking model requests** (`193f9ce413`, #5168)——单请求扩展 8 MiB 上限，超出分批/降级。
- ↩️ **fix(session): isolate source migration verifiers in processes** (`fa04034a9c`) → revert（`1197478415`）。

### 启动 / 插件
- **fix(boot): report skipped profile bundles once per start** (`c8b10a16be`)；**derive skipped bundles only from Profile.skippedBundles** (`0a6de62671`，PR #5159)——`generateConfigSchema` 删除 `binName` 参数。
- **fix(plugin-manager): offer another way when a GitHub failure already asked the mirror** (`ef516f98cf`)
- **fix(plugins): name the default install source by the registry it names** (`16af6fddc7`, #5084)
- **fix(app-boot): preserve routed resolution errors under async module hooks** (`2152881fcf`)
- **fix(preset): route profile feature enabling through cordis-plugin-development** (`e1f65ea640`)

### 账号 / 模型
- **fix(account): expire account credentials on inference HTTP 401** (`3e4119ebdb`)；**sign out on rejected inference tokens** (`37d3a31e29`)；**expire grants rejected by Platform response code** (`43f107d164`)；**expire rejected credentials and hide signed-out provider** (`f21098e9d3`)
- **fix(account): refine bonus notice lifecycle and diagnostics** (`150303ff22`)；**balance timeout 30s** (`c846fd48a3`)；**use configured Platform origin for account link** (`1098fa52ea`)；**expire account credentials on inference HTTP 401**；**deliver credential expiry notices without replay** (`8f180cf45f`)；**refresh after top-up and accept exponent balances** (`850d78b798`)；**limit automatic model selection to account login** (`9e19ca3e45`)
- **fix(models): retain API-key provider catalogs without credentials** (`8e5866e7b0`)
- **fix(ui-model-selection): own the pending selection in ModelDirectory** (`d55f434cdf`)；**prioritize account models** (`325e28bfa0`)；**handle catalog and account setup failures** (`0d2fbaad67`)
- **fix(web): 按账号 provider 识别模型编辑器** (`d183c8a8c0`)；**修复账号模型设置的 namespace 识别** (`7b86b84c2f`)

### 工具 / 文件系统 / Workspace
- ⚠️ **fix(workspace): keep the default Workspace path language-neutral** (`ff1c7d415f`)——目录名固定 `default-workspace`；`workspace.initializeDefault` 不再接受参数（破坏性 API）。
- **fix(workspace-files): list directory links through their resolved target** (`931505a9cc`, PR #4500)——Windows junction 修复。
- **fix(native-command): transport the Windows adapter as a script file** (`f35db51bee`)；**resolve packaged Windows app icons** (`d685383ee6`)
- **fix(subagent)**: catalog 递归遍历（`a4ddc28ed5`）；↩️ list_agents 描述裁剪 revert 恢复（`af371e21c0`）；catalog discovery 文档对齐（`88500a0f3a`）
- **fix(schedule): point shared session references at the selected generation** (`5c768e3c8a`)

### Auto review
- **fix(auto-review): ask the user after a denial and report reviewer failures** (`409fb145af`, PR #5150)
- **fix(auto-review): localize the approval prompt and sync docs with the ask fallback** (`0a134ef94e`)

### GUI / 桌面
- focus ring 品牌色统一系列（`08b310b5a8`、`9e7350bb8c`、`db92970146`、`9a74ba5d08`、`5a7b2e6f33`、`9fd52295fc`、`4f1a1289f5`、`b66e51e7ab`、`5a7b2e6f33`）
- **fix(desktop)**: welcome / recharge / sign-out 系列（`b8df537f07`、`f0f4bb73fc`、`5a3c316401`、`9987cae3ea`、`10b6ffec3f`、`4283f62d01`、`037bed1f41` reject running app before installer extraction、`d2a5490fa0` Windows update 明确化）
- **fix(client)**: `4d4bb4c907`/`08daf789d5`（new-session 快捷键可见性）、`8e42deafa1`（sidebar 焦点环裁剪）、`7dfad90748`（macOS 拖拽）、`aaf733c175`（搜索结果整行）、`caa4b8feca`（CSV 高亮不动默认预览）、`11c0511271`/`4cc76d04e9`（API key 输入 autofill 策略）、`e39b0c307c`（lightbox ring）
- **fix(voice-input): preserve draft focus during setup guidance** (`9a9a331963`)
- **fix(web): 将开发者工具开关更名为代码工作工具** (`1103c1a7dd`, #5149)；**clear staged preset when developer tools turn off** (`5577becafe`)；**unify document loading and spaced theme-aware pages** (`ed4445b028`)；**synchronize read-only spreadsheet scroll state** (`b9fb1cceea`)
- **fix(ui-open-in-app): open the application the control names** (`64795b4879`)；**keep an application as the default file action** (`6fa5151d8a`)
- **fix(ui-schedule): clamp saved prompts in task run records to two lines** (`955a706d33`)

## Refactoring

- **refactor(tools): trim constraint prose from tool descriptions**（PR #5109：`321a6fa740`、`8f86c22a9a`、`341023a9e7`）——首轮 tool schema 约 -1548 tokens
- **refactor(tools): drop system-prompt repeats of tool definitions**（`ab2f5d3009`）——system prompt 约 -370 tokens
- **refactor(llm): let providers resolve request authentication** (`e310916e59`)
- ⭐ **refactor(account): isolate provider authentication and preserve model selections** (`40da69ff75`)——⭐ 新包 `packages/llm/llm-deepseek-account`、`llm/llm-deepseek-api-key`
- **refactor(boot)**: skipped bundles 唯一来源；**refactor(client): unify focus ring** 相关样式收敛
- **refactor(subagent): traverse descendant catalogs recursively** (`a4ddc28ed5`)
- ⭐ **refactor**: 新包 `packages/util/code-language`（`6945da14cb` 语言表统一，tool-fs read hint 持久化为短 id `19b7de31a6`）
- **refactor(schedule): trim constraint prose from Schedule tool descriptions** (`341023a9e7`)
- **refactor(time-context)**: 默认注入改为 10 分钟间隔（PR #5133）
- **refactor(conversation): keep stop shortcut turn tracking internal** (`120cac4ea7`)

## Dependencies / Build

- **chore(deps): upgrade LibreOffice Kit to 0.1.1** (`03bd8258c3`)
- **fix(ci): preserve Wine build metadata and isolate test fixtures** (`687aa02578`)
- **fix(lockfile): drop re-resolution churn from the merge-forwards** (`b1eebbd045`)
- tsconfig：新增 shortcuts/code-language/account/default-workspace paths 别名；新增 `tsconfig.desktop-keyboard-tests.json`

## 新包清单（5 个，无删除）

| 包 | 用途 |
|---|---|
| `packages/client/shortcuts` | 快捷键核心（协议/绑定/配置/持久化） |
| `packages/client/ui-shortcuts` | 快捷键 UI 插件 |
| `packages/util/code-language` | 代码语言表统一（read hint 短 id） |
| `packages/llm/llm-deepseek-account` | 账号路由 provider（token 认证/模型发现） |
| `packages/llm/llm-deepseek-api-key` | API key 路由 provider（`x-api-key`） |

## 窗口内落地后被 revert 的主线（了解即可，勿依赖）

1. ↩️ Schedule/time-context/ui-schedule 默认启用（`e896737840` → `cad6fef2fd` 关闭）
2. ↩️ user-questions timed waits / late replies（`bb19061473` → `32905d5ab5` 整体回退）
3. ↩️ session 源迁移 verifier 进程隔离（`fa04034a9c` → `1197478415`）
4. ↩️ list_agents 描述裁剪（→ `af371e21c0` 恢复）
