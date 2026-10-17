# DSH v0.2.1-alpha.2 → v0.2.1-alpha.3 逐主题差异

> 852 commits（673 非 merge + 179 merge）｜ 3311 files +120978/−16632 ｜ `dsh-v0.2.1-alpha.2`（`d743267388`）→ `dsh-v0.2.1-alpha.3`（`2fbf4359b8`）

## 文件热度（Top，按目录聚合）

| 目录 | 增量 | 主题归属 |
|---|---|---|
| `packages/experimental/cua-macos` | +13231/−0（91 files） | §CUA |
| `docs/persistence-changes/2026-10-13-user-rpc-principal.schema.json` | +11559/−0 | §RBAC 持久化承认 |
| `.agents/notes/implemented` | +6294/−410（204 files） | 设计依据（各主题） |
| `apps/web/tests` | +4967/−405 | §Web |
| `snapshots/session/cua-native` | +4195/−0 | §CUA 快照 |
| `packages/experimental/cua` | +3567/−0（21 files） | §CUA |
| `packages/typert/generator` | +3060/−305（24 files） | §RBAC/Remote 定义 |
| `packages/client/ui-chat` | +2975/−763（79 files） | §槽位/图片家族 |
| `packages/api/gateway` | +2720/−182 | §RBAC Peer 通道 |
| `packages/ptc-runtime/ptc-runtime-node` | +2380/−153 | §PTC |
| `packages/api/remote-access` | +2213/−0（16 files） | §RBAC 新包 |
| `packages/client/ui-conversation` | +2086/−93 | §槽位 |
| `packages/boot/hmr` | +1996/−78 | §插件安装/HMR |
| `packages/client/ui-secret-mask` | +1857/−0 | §遮蔽新包 |
| `snapshots/session/subagent-agent-preset` | +1527/−0 | §子代理 preset |

---

## §1 Remote 访问 RBAC（新缝 `ctx.remoteAccess`）

- **新包 `packages/api/remote-access`**：`d7bd68ee7a` role-based policies 闸门非 owner 调用与事件；`529706d163` 撤销时丢弃缓冲事件、过滤搜索、声明 workspace file 资源。
- **typert**：`9c6374909b` 声明 remote method 与 event 资源；`efdaa86fb8` Remote 定义统一 + 惰性 method info（generator +3060/−305）。
- **API 面**：`2640d3df82` endpoint 资源解析 + 列表按访问过滤；`d6e408d957` session-controller 在非 owner 用户消息源上记录 principal（持久化承认 `2026-10-13-user-rpc-principal`，same-version）；`f6316536ea` client-connection 在 explicit peers 上携带 caller principals。
- **Connection**：`0f7ac58213` API operator 隔离不改浏览器身份（指南 `operator-connect`：非页面 Connection 默认 `interactions:'none'`——不开 `$events`、无 `$on()`/`$stream()`；答转发用 `interactions=answer`；launch token 经 `GET /connect?token=…&interactions=none` 手动重定向）。
- **client**：`b967475c66` remote access hooks；`10672c4c24` Peer interaction scope 与 Remote access 整合。

## §2 CUA 桌面操作（204 提交，双新包）

- `packages/experimental/cua`（跨平台层）+ `packages/experimental/cua-macos`（AppKit 原生 helper，+13231 行）。
- 关键提交：`5658751da0` 截图像素映射 + 可选相对坐标；`17c253ce7e` AppKit tracking 显式系统指针 hover；`fd3868adc6` 移动指针前揭示备用 hover UI；`fdbe2bce47` 悬停跨观察与弹层交互保持；`a83cebc4cf` 无激活恢复窗口 + 拒绝陈旧坐标；`1e67f8da60` 跨 Agent 连接共享原生 helper；`705a96eefe` 截图阶段 trace 与失败诊断保留；`7257181b9e` AX 信息按需展开；`8a7f941112` 悬停用持久系统指针移动。
- 快照：`snapshots/session/cua-native` +4195。

## §3 JSONL 持久化插件化（指南 `jsonl-persistence-plugin`）

- `dfca3c3c6f` 命名空间导出（`name`/`Config`/`apply`，**无默认导出**）；`22d0bd19a3` 中间过渡保留默认导入（终态以指南为准）；`4d9047be2d` provider-triggered teardown 前保留监听器与句柄；`6aa157a05a` listing 共享并发上限；`98229a47ea` SDK resume 测试跟改。
- 影响：默认导入 / 直接构造 / 继承 / `instanceof` / 类类型标注；`sessionPersistence` 服务 API、YAML 配置、存储文件**不变**。

## §4 JobId 换代（指南 `job-id-identity`，持久化承认 `job-session-lifecycle`）

- `e493fd40dc` 可见 id 改 `<kind>-<short-uuid>`（16 位小写十六进制）；生命周期记录**不再携带 `executionId`**；`JobExecutionId` 导出移除。
- `61fa9c0bab` job wait 迁移文档修正（`job_output` 等待设 `wait: true`）；`ae0da9482d` PTC replay 记录持久生命周期；`6ce8654ff6` 小结果上限下保留后台 job id；`932a19b0f9`/`4837be0d55` 测试跟改。

## §5 子代理 preset 组装（指南 `subagent-preset-composition`）

- `dsh-tool-subagent` 拒绝 `persona`/`toolFilter`；`SubagentStartRequest` 与提供方能力声明删两字段；spawn 走 `agentPreset`（`a9afe76200` 选择/恢复 spawned preset），`allowedAgentPresets` 向父模型开放多选；fork 继承父 preset。
- `standard`/`ptc`/`cordis` 委派工具不再隐藏 `schedule_*`；历史子 Session descriptor 恢复时仍应用旧 persona 与工具限制（快照 `snapshots/session/subagent-agent-preset` +1527）。
- `a6207eae63` UI 头带排序：preset → subagent catalog → 后台任务。

## §6 插件安装与 HMR（指南 `plugin-install-over-installed`）

- `pluginManager.installBundle(spec)` 命中已安装包 → pnpm 前失败 `application:'failed'` + `error.code:'already-installed'`（registry 名/本地目录/git/tarball spec 同口径；重复安装同 spec 也不再报 `changed:false`）。
- `879ad372ac` HMR 在 profile 重组期替换包文件已变的插件；`be7d58308c` config watcher 排除无关文件。`packages/boot/hmr` +1996/−78。

## §7 凭据与账号

- `5249d9a4ce` **存储凭据 > 导出环境变量**（`.env` 仍最后；指南 `stored-credentials-precedence`；headless 随附 profile 禁存储/authorization/DeepSeek account，恢复 patch 见 `packages/bundle/headless/README`）。
- `8e413612c8`/`004aa05085` `credentials-local` 未知顶层键带警告忽略、外部大整数保精确。
- `a93958c7d0` 新包 `client/ui-secret-mask`：发送用户文本凭据遮蔽；`1681948e3f` 分模块（formats/lazy tables/masks/scanner）；`94d4007bfd` 导出格式常量与方法。
- DeepSeek 账号：指南 `deepseek-account-identity-watch`（watch 默认不通知 Platform 身份变化，订阅需显式启用）、`deepseek-account-model-catalog`（账号路由不收 models 目录，单模型 `modelOverrides`）；`3a0f4976ad` 列表加载日志；`20f99ffb0c` providers 等连接、I/O 前拒模型。

## §8 槽位目录（+627/−179）

- **新增 5**：`conversation.chat.message.images`、`conversation.chat.user.images`（图片附件入 chat 家族、用户/助手分轨）、`conversation.user.text.node`、`conversation.hero.options`（New Session options，`3f1d5dfcfa`）、`workspace.toast`。
- **移除 1**：`conversation.message.images`（改名换代——注入旧名的客户端静默失效）。
- `533299e6ab` Definition 可在其目标上认领 event；`packages/client/ui-slots/src/index.ts` +4。

## §9 Web / 桌面 UI

- 响应式：`89c4652add` 自动化任务页头、`ee558c82d7` Plugins 页头窄宽 reflow、`ebe725081c` 响应式标准入 skills、`5a52b980e5` 移动端键盘默认收起。
- 字号：`0c6968b649` 桌面字号联动、`8096e18504` 会话字号快捷键（指南 `desktop-font-size-shortcuts`）。
- 终端：`5379996fcb` Web 终端输入走双工流。
- 侧栏：`7df3c41ec9` 单调水位折叠会话。
- 桌面发布：`60084a5b59` 保留包手工 dispatch、`d156ee31a0` 渠道分离 + 审批前确认、COS 审批工作流（`apps/desktop/scripts` +1817/−153）。

## §10 LLM / pi-ai

- `d79f13a4d7` adopt pi-ai 1.1.0 + Azure provider 更名（指南 `pi-ai-azure-provider`：路由 `azure-openai-responses`→`azure`）。
- 指南 `pi-ai-model-discovery`：指定凭据的 pi-ai 路由在凭据配置前隐藏模型。

## §11 CLI / SDK / 其它

- `--from-default-profile` 替换语义（指南 `from-default-profile-replaces-target`）。
- `0bec9479ae` SDK 显式持久化 session resume；`b1d5671038` resume 确认简化。
- `7fcaf07051` plugin-manager 为 badge skill 显示内置功能预览（`aac50c7923` 决策记录）。
- `ecafa412ac` Agent Teams 可禁用 interrupt 工具；`b0414b8a98` worktree `GIT_NO_LAZY_FETCH`。
- 指南 `sdk-minimal-image-compaction`（`444692d1ca`/`f15091a922`/`5b784ecbc3`）；`primary-runtime-python-aliases`（挂 rc.2 目录）。

## §12 零断裂面（显式核对）

| 面 | 结论 |
|---|---|
| `plugin-compatibility.ts` | **零 diff**（a.4 才换代） |
| settings 核心 / `configForms` | 零 diff |
| vendor `cordis` / `schemastery` API 面 | 无断代（版本列车 `7c8cbea696`：cordis 4.0.5-alpha.2 等） |
| `SESSION_FORMAT_VERSION` | 保持 4；+2 同版本加性承认 |
| HMR `package-manifest.ts` | 零 diff |

## 复核命令

```powershell
[Console]::OutputEncoding=[Text.Encoding]::UTF8
git log --no-merges --format='%h %s' dsh-v0.2.1-alpha.2..dsh-v0.2.1-alpha.3
git diff --numstat dsh-v0.2.1-alpha.2 dsh-v0.2.1-alpha.3
git diff dsh-v0.2.1-alpha.2 dsh-v0.2.1-alpha.3 -- packages/extensions/cordis-client-runner/src/client/slot-catalog.ts
git diff --name-only dsh-v0.2.1-alpha.2 dsh-v0.2.1-alpha.3 -- docs/upgrade-guide
```
