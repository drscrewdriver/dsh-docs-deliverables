# DSH v0.1.7-rc.1 → v0.1.7-rc.2 变更说明（更新要点）

> **数据源**: `deepseek-ai/deepseek-harness` 官方仓库
> **标签对比**: `dsh-v0.1.7-rc.1` (`46a7f68b09`) → `dsh-v0.1.7-rc.2` (`477b4f4205`)
> **发布日期**: 2026-09-24 ｜ **发布提交**: `787b746b80 release(dsh): 0.1.7-rc.2`
> **发布 PR**: [#5180](https://github.com/deepseek-ai/deepseek-harness/pull/5180) `rel/dsh-0.1.7-rc.2`
> **性质**: 同一 RC 窗口内的增量发布（非 backport），共 335 个提交（224 非 merge + 111 merge）
> **统计**: 3429 files changed, 136313 insertions(+), 24518 deletions(-)（其中 `packages/` 1868 files +81564/-11510，`docs/` 236 files +17681/-4004，其余为 lockfile / 测试快照 / i18n 配套）
> **结构变化**: `packages/` 顶层分组不变（54 组）；子级**新增 5 个包**（`client/shortcuts`、`client/ui-shortcuts`、`util/code-language`、`llm/llm-deepseek-account`、`llm/llm-deepseek-api-key`），无删除
> **持久化契约**: `SESSION_FORMAT_VERSION` **保持 4**，无会话格式跃迁；插件清单契约与 rc.1 一致，无 breaking 插件迁移项

---

## 一句话总结

0.1.7-rc.2 是 **账号体系拆分成 providers + 中途动态工具更新（beta wire 特性）+ 可配置快捷键回归** 的一次发布，同时撤销了 rc 窗口内两条激进主线（Schedule 默认启用、user-questions 定时等待）：

- **账号/凭证体系换代**：DeepSeek provider 拆分为 `llm-deepseek-account` 与 `llm-deepseek-api-key` 两个包，认证解析下放到 provider（`e310916e59`）；推理 401 / Platform 拒绝码使凭证过期并登出；登出前确认并检查在跑账号任务；欠费/余额到期通知与充值入口（QuotaNoticeHost）；
- **LLM 中途动态工具更新**（`bc8c0dbf40`，beta `mid-conversation-tool-changes-2026-07-01`）：工具集变更以 `tool_addition` / `tool_removal` system block + `tool_reference` 增量下发，替代整表重写；`Session.toolHistory()` 折叠投影，`ToolUpdate = 'in-history' | 'addition-only'` 按 route 投影；
- **快捷键系统回归**（PR #5117/#5173）：新包 `@deepseek-ai/dsh-client-shortcuts`（Web `dsh.keybindings.v1` localStorage / Desktop `userData/keybindings.json`，双键 chord），桌面端 shortcuts protocol 先于 main bundle 产出；
- **两条主线撤销**：Schedule/time-context/ui-schedule 虽随 web-app bundle 分发但 `disabled: true`（PR #5175），默认会话无 `schedule_*` 工具；user-questions 的 timed waits / late replies 特性整体 revert（PR #5174）；
- **prompt 经济学**：工具描述精简 + system prompt 去重，标准 preset 首轮（system prompt + tool schema）约减少 **1918 tokens**（1548 + 370）；
- **持久化健壮性**：atomic-write 接管持有者已退出的写锁（PR #5165）；工具输出截断保住 UTF-16 代理对（PR #4827）；live projection 失败归类为 `SESSION_QUERY_CORRUPT_SESSION`；
- **Auto review 兜底**：reviewer 拒绝后回落到 ask 用户（`displayReason` 本地化契约），reviewer 自身故障显式报错；Auto review 成为"已安装"的 optional bundle。

---

## 版本序列定位

```
dsh-v0.1.7-rc.1     ← 上版（46a7f68b09，2026-09-23）
    │
    │  ←─ 本次变更（335 commits：224 非 merge + 111 merge）
    ▼
dsh-v0.1.7-rc.2     ← 当前版（477b4f4205，2026-09-24）
```

上下文链（部分主线在窗口内"先落后撤"，rc.2 终态为准）：

```
e896737840 feat(schedule): ship Schedule in the default Web composition
    └→ cad6fef2fd feat(web): disable shipped schedule and time context plugins（rc.2 终态：disabled）
bb19061473 feat(user-questions): support timed waits and late replies
    └→ 32905d5ab5 Revert "feat: reconcile timed questions with legacy default"（rc.2 终态：回退）
```

---

## 主要变更分组

### 1. 账号 / 凭证 / Platform（最大主题）

- **Provider 认证拆分**（`40da69ff75` + `e310916e59`）：`packages/llm/llm-deepseek` 只保留共享 Messages 传输/协议；`llm-deepseek-account`（路由 `deepseek-account`，token 认证、错误码 `ACCOUNT_SIGN_IN_REQUIRED` / `ACCOUNT_TOKEN_INVALID` / `ACCOUNT_QUOTA`）与 `llm-deepseek-api-key`（路由 `deepseek-official`，`x-api-key`、`apiKeyEnv` 默认 `DEEPSEEK_API_KEY`、缺钥 `MISSING_CREDENTIAL`）各自实现认证解析。模型目录与凭证解耦——API-key provider 无凭证仍返回目录（`8e5866e7b0`）。
- **凭证过期与登出**：推理 HTTP 401 使账号凭证过期（`3e4119ebdb`）；被拒 token 触发登出且只清除匹配请求 token 的旧凭证（`37d3a31e29`）；Platform 响应码拒绝使 grant 过期（`43f107d164`）；登出后隐藏 provider 入口（`f21098e9d3`）。
- **登出确认**：`SignOutDialog` + `AccountController.hasRunningAccountTasks()`（`17825ee8c0`，新增 `packages/api/account-controller/tests/signout-impact.spec.ts`）。
- **欠费/到期提示**：`QuotaNoticeHost`（`ui-chat`）区分"账号欠费（给充值入口）"与"API key 无效"（`2fd748edad`，#4858）；bonus notice 生命周期重写（`150303ff22`）；余额请求超时 30s（`c846fd48a3`）；Platform 请求附带 client metadata（`3970cc974f`）。

### 2. 模型体系

- 可用模型追踪与账号设置暴露（`cc478ac70a`）：remote events 新增 **`credentials/record-updated`** 转发事件；自动选模型仅限账号登录（`9e19ca3e45`）；账号模型排前（`325e28bfa0`）；ModelDirectory 自持 pending 状态 + spinner（`d55f434cdf`、`c87959bc44`）；默认模型设置改为后台异步保存（`86331673d9`）。

### 3. LLM：中途动态工具更新（beta）

- 核心提交 `bc8c0dbf40`（+946/-85）：agent-loop 把工具变更记为 developer message；`packages/core/session/src/tool-history.ts` 新增 `Session.toolHistory()`（折叠 header + updates，保留 baseline 绑定激活 `1b0c2e5760`）；`packages/llm/llm/src/content.ts` 新增 `projectToolUpdates` 按 route 投影；`ToolUpdate = 'in-history' | 'addition-only'` 进入 DeepSeek `catalogModel.toolUpdate` 校验。
- DeepSeek 序列化：system-role `tool_addition` / `tool_removal` block，工具用 `tool_reference` 引用，支持 `deferLoading`；beta header 常量 `MESSAGES_TOOL_CHANGES_BETA = 'mid-conversation-tool-changes-2026-07-01'`（`packages/llm/llm-deepseek/src/messages-api.ts`）。
- **请求扩展限流**（`193f9ce413`，#5168）：单请求扩展负载上限 8 MiB（可配置），超出部分随后续请求发送；无法序列化时降级为基础请求并记录被省略字段（决策记录 `docs/decisions/implemented/feature/2026-09-24-bounded-session-log-upload`）。

### 4. Prompt 精简（无 schema 变化，纯文本）

- 工具描述裁剪（PR #5109 系列：`321a6fa740`、`341023a9e7`、`8f86c22a9a`）：约束性叙述移入参数描述，Bash/pwsh/fs 共用 `dsh-sandbox` 的 `sandbox_permissions` 描述——**-1548 tokens**。
- system prompt 去重（`ab2f5d3009`）：工具 guidance 只保留工具定义未覆盖的内容——**-370 tokens**。
- 注意：`list_agents` 的描述裁剪被 revert 恢复（`af371e21c0`）。

### 5. Schedule（先启后关，终态：默认关闭）

- `e896737840`（PR #5011）：Schedule + time-context + ui-schedule 进入默认 Web composition，fixed-rate 下限 300s→60s，任务落盘与到期 session 崩溃恢复（PR #4335 storage phase1）。
- `cad6fef2fd`（PR #5175）：**rc.2 终态回关**——`packages/bundle/web-app/cordis.patch.yml` 三项均 `disabled: true`，`schedule_*` 工具不再出现在默认会话 tool schema；代码仍随 bundle 分发，需用户 overlay 显式开启；60s floor 与 storage 能力保留。
- time-context 默认注入改为 10 分钟间隔（PR #5133）；ui-schedule 运行记录 prompt 两行截断 + Expand（`955a706d33`）。

### 6. user-questions：定时等待特性整体撤销

- `bb19061473`（PR #4839）实现 timed waits / late replies / 双结算（含持久化 schema `2026-09-21-user-question-reply.schema.json`）；随后 PR #5174 整体 revert（`32905d5ab5`）。rc.2 终态：`ask_user` 契约与 rc.1 相同。

### 7. 快捷键系统回归（新包）

- 新包 `packages/client/shortcuts`（`@deepseek-ai/dsh-client-shortcuts`）：`src/binding.ts`（物理键/平台 profile）、`configuration.ts`（命令目录与默认组合校验）、`persistence.ts`（单写者协调、revision/conflict 语义）、`protocol.ts`（纯协议导出，供 Desktop main 共享）；浏览器端插件在 `src/client/`（registry/DOM 仲裁含 IME 保护/storage）。
- 存储：Web 为 origin-local `dsh.keybindings.v1` localStorage；Desktop 为设备级 `userData/keybindings.json`（schema v1 只读，v2 支持可选 `secondCode`）；macOS/Windows 支持双键 chord。
- 桌面集成：`apps/desktop/src/keyboard.ts`（+253 行原生拦截）、build 顺序保证 shortcuts protocol 先于 main bundle（`1e5af11d8c`）；Web 各 UI 插件经 `ctx.shortcuts` 注册命令；6 个 shortcuts e2e + 双语 golden。

### 8. 核心持久化健壮性

- **写锁接管**（PR #5165）：`packages/util/atomic-write` 锁记录携带 PID；竞争者发现本机 PID 已消失的记录可接管重试（`7e7ba139fd`，后简化为 PID-only 记录 `910711e6c1`）；plugin-manager 新增 `.plugin-manager/run.json` 运行记录，对 pnpm 残留操作等待或拒绝（`1bd3df926d`）。
- **代理对截断**（PR #4827）：bash/pwsh 持久 shell 与 str-replace-editor 的输出截断改用 `truncateWithoutSplittingSurrogatePair`，不再留下孤立高代理（否则严格 JSON reader 拒绝 Session log 并阻塞后续请求）。
- **corrupt 分类**（`4e6a1c1073`）：`session-query` 的 `read()` 将 live projection 失败包装为 `SESSION_QUERY_CORRUPT_SESSION`。
- **skipped bundles 报告一次**（PR #5159）：`Profile.skippedBundles` 统一来源，`reportSkippedBundles` 每次启动只打印一次；`generateConfigSchema` 不再读 profile manifest（删 `binName` 参数）。
- 源迁移 verifier 进程隔离落地后 revert（`fa04034a9c` → `1197478415`），rc.2 无此行为。

### 9. 插件生态 / Auto review

- **Auto review 成为"已安装"的 optional bundle**（`a3480857dd`，PR #4867）：插件管理器 Official 组可见；Inspector 保持显式安装；新增 `scripts/optional-bundles.spec.ts`（双语 title/description/icon 校验）。
- **ask 兜底**（PR #5150）：reviewer 拒绝且 approval policy 为 `ask` 时返回用户决策；reviewer 故障以具体错误 fail 而非伪装为 denial（`409fb145af`）；ask 决策新增可选 **`displayReason`** 供本地化展示，审计 reason 保持英文（`0a134ef94e`；approval 本地化主线 `12c9dd599e`，#4793）。
- plugin-manager：GitHub 安装失败且已试 mirror 后提供"换个方式"出口（`ef516f98cf`）；默认安装源按 registry 实名显示（`16af6fddc7`，#5084）；profile feature 启用走 `cordis-plugin-development` 技能指引（`e1f65ea640`）。

### 10. Workspace / 工具 / 文件系统

- **默认 workspace 语言中立**（`ff1c7d415f`，破坏性 API）：目录名固定 `default-workspace`；`WorkspaceInitializeDefaultRequest` 删除、`workspace.initializeDefault` 不再接受参数；显示标题走 `workspaceDisplayTitle` 本地化；新别名 `@deepseek-ai/dsh-api-workspace-controller/default-workspace`。
- **Windows 目录 junction**（`931505a9cc`，PR #4500）：`list` 跟随最终链接解析并要求目标在 workspace root 内（修复 `My Music` 等被误拒）。
- 工具输出 read 语言 hint 持久化为短 id（`19b7de31a6`）；语言表统一到新包 `packages/util/code-language`（`6945da14cb`）。
- native-command：Windows adapter 改为脚本文件传输（规避 32767 字符命令行上限，`f35db51bee`）；MSIX 应用图标间接引用解析（`d685383ee6`）。
- subagent catalog 递归遍历（`a4ddc28ed5`，嵌套目录后代 agent 可达）。

### 11. GUI / 桌面

- **focus ring 品牌色统一**：54 个样式表 8 种 ring 颜色收敛到 `--dsw-alias-brand-primary`，`ui-theme` 新增全局 `focus.css` 兜底。
- 会话归档过滤改为显式三态菜单（隐藏/全部/仅归档，`9775a95315`）；session list 图标化空状态（`2129486048`）；折叠 web fetch URL 可点击（`61a0ed487e`，#3390）；"开发者工具"更名"代码工作工具"（`1103c1a7dd`，#5149）；新任务模式选择由开发者模式统一控制（`a44534e274`）；开发者工具关闭时清除 staged preset（`5577becafe`）；文件审查界面精简（`fdd14a0989`，222 文件）。
- **桌面关闭行为**（PR #5015）：关主窗口改为隐藏（页面/Host 继续运行），退出前经 quit-inspection IPC 确认可中断任务（2 秒超时按有任务处理）；Windows 常驻托盘图标（`4745934683` 等）。
- 桌面 onboarding（PR #4459）：设备本地账号 onboarding + 充值 artwork + 共享 modal 焦点所有权；本地 Markdown 图片经认证文件路由渲染（`7f0a53dfb3`，#5105）。

### 12. 工程体系

- **i18n translation pairing 按 heading section 键控**（`e7def469e1`，PR #5036）：`*.i18n.yaml` 从整文件 blob hash 改为按 heading-slug 逐节 hash；fenced code block 与 GENERATED region 不入 hash；**删除 `dsh-translation-pairing` merge driver**。
- LibreOffice Kit 升级 0.1.1（`03bd8258c3`，`office-to-pdf` / `skill-office` / desktop-host / web-app bundle）。
- tsconfig：新增 shortcuts / code-language / account provider / default-workspace 等 paths 别名；新增 `tsconfig.desktop-keyboard-tests.json`。
- Wine CI 元数据保留与 fixture 隔离（`687aa02578`）。

---

## 升级注意事项

1. **无会话格式 / 插件契约跃迁**：`SESSION_FORMAT_VERSION` 仍为 4，rc.1 的会话数据与插件无需迁移；`plugin-migration-guide.md` 基线结论继续有效。
2. **`workspace.initializeDefault` API 破坏性变化**：不再接受请求参数，目录名固定 `default-workspace`（`ff1c7d415f`）——影响直接调用该 controller API 的代码，不影响终端用户。
3. **Schedule 默认关闭**：依赖默认 `schedule_*` 工具的测试/工作流需要在 overlay 中显式启用 schedule / time-context / ui-schedule。
4. **user-questions 定时等待不存在**：rc 窗口期间出现过的 timed-wait 契约（如 question reply schema）已被 revert，勿基于其开发。
5. **动态工具更新是 beta wire 特性**：依赖 `mid-conversation-tool-changes-2026-07-01` beta header，模型目录需声明 `toolUpdate` 能力（`in-history` | `addition-only`）。
6. **i18n 贡献流程变化**：`dsh-translation-pairing` merge driver 已删除，`*.i18n.yaml` 变为逐节 hash。

> 本目录文档结构说明：`README.md` / `CHANGELOG.md` / `diff-vs-0.1.7-rc.1.md` 为 rc.2 增量全量分析；`01-14` 主题篇与 `architecture-overview.md` / `plugin-migration-guide.md` 沿用 rc.1 基线（rc.2 未发生系统性结构变化），篇首已标注。
