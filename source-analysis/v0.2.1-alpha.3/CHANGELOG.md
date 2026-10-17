# DSH v0.2.1-alpha.3 CHANGELOG（dsh-v0.2.1-alpha.2 → dsh-v0.2.1-alpha.3）

> 852 commits（673 非 merge + 179 merge）｜ 2026-10-09 ~ 2026-10-14 ｜ 发布 PR #6234（merge `2fbf4359b8`）
> 标记：⭐ 新能力面 ｜ ⚠️ 行为变化 ｜ 🔌 插件可见 ｜ 📋 有官方升级指南（目录代际滞后：挂 `docs/upgrade-guide/v0.2.1-alpha.1|alpha.2|v0.2.0-rc.2/`）
> 结构：**5 新增包 / 0 删除包 / 0 改名包**；`SESSION_FORMAT_VERSION` 保持 4，**新增 2 条同版本加性持久化承认**；兼容性闸门 / settings 核心 / vendor cordis·schemastery 零 diff（**闸门换代发生在 a.4**）

## Packages（结构变化）

- ➕ `packages/api/remote-access` —— **`ctx.remoteAccess`** Remote 方法/事件访问控制（RBAC policy 注册、列表过滤、按 Peer 快照流，`d7bd68ee7a`）
- ➕ `packages/client/ui-secret-mask` —— 发送用户文本中的凭据遮蔽（`a93958c7d0`；格式常量/懒表/掩码/扫描器分模块 `1681948e3f`）
- ➕ `packages/context/harness-dev-context` —— 开发上下文 bundle（消费 `ctx.webApp` 公告的 GUI URL）
- ➕ `packages/experimental/cua` + `packages/experimental/cua-macos` —— 桌面操作（Computer Use）双包（像素映射 `5658751da0`、AppKit hover `17c253ce7e`、共享原生 helper `1e67f8da60`）

## Features

- 📋 🔌 ⚠️ **feat(remote-access): Remote 方法级 RBAC + principal 链**（`d7bd68ee7a` rbac policies / `9c6374909b` typert 资源声明 / `efdaa86fb8` Remote 统一定义惰性 method info / `2640d3df82` endpoint 资源解析与列表过滤 / `d6e408d957` 非 owner principal 入消息源 / `f6316536ea` explicit peers 携带 caller principal / `b967475c66` client hooks / `10672c4c24` Peer interaction scope 整合 / `529706d163` 撤销丢缓冲+搜索过滤）
  新能力缝 `ctx.remoteAccess`（core）；持久化承认 `2026-10-13-user-rpc-principal`（same-version）。官方指南 `operator-connect`（非页面 Connection 默认 `interactions:'none'`，无 `$events/$on/$stream`；答转发须 `interactions=answer`）。
- 📋 ⚠️ 🔌 **fix(session-persistence-jsonl): JSONL 持久化改插件命名空间导出**（`dfca3c3c6f` 命名空间化 / `22d0bd19a3` 保留默认导入过渡 → 终态无默认导出 / `4d9047be2d` provider-triggered teardown 保资源 / `6aa157a05a` listing 共享并发上限 / `98229a47ea` SDK resume 测试跟改）
  `import * as JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'`；直接构造/继承/`instanceof`/类标注失效；服务类型用 `SessionPersistence`。官方指南 `jsonl-persistence-plugin`。
- 📋 ⚠️ 🔌 **fix(jobs): JobId 换 `<kind>-<short-uuid>`**（`e493fd40dc` 短 UUID 可见 id / `61fa9c0bab` wait 迁移文档修正 / `ae0da9482d` PTC replay 记录生命周期 / `932a19b0f9` Web 测试用返回 id / `6ce8654ff6` 小结果上限下保留后台 job id）
  生命周期记录去 `executionId`；`job/registered`/`job/settled` 同 `JobId` 配对；持久化承认 `2026-09-30-job-session-lifecycle`（same-version）。官方指南 `job-id-identity`。
- 📋 ⚠️ 🔌 **feat(subagent): spawn 改 `agentPreset` 组装**（`a9afe76200` 选择/恢复 spawned preset / `a6207eae63` 头带排序 preset·catalog·后台任务）
  `dsh-tool-subagent` 拒绝 `persona`/`toolFilter`；`SubagentStartRequest` 与能力声明删两字段；fork 继承父 preset；`standard`/`ptc`/`cordis` 不再隐藏 `schedule_*`。官方指南 `subagent-preset-composition`。
- 📋 🔌 **fix(plugin-manager): HMR 下重复安装拒绝 `already-installed`**（配套 `879ad372ac` feat(hmr): 重组期替换包文件已变的插件；`be7d58308c` watcher 排除无关文件）
  `installBundle(spec)` 命中已安装包在 pnpm 前失败、`application:'failed'`；升级流程改 `removeBundle`→`installBundle`；`ManagementError['code']` 穷尽 switch 需补分支。官方指南 `plugin-install-over-installed`。
- 📋 ⚠️ **fix(credentials): 存储凭据优先于导出环境变量**（`5249d9a4ce`；`8e413612c8`/`004aa05085` credentials-local 宽容化）
  `.credentials.yaml refs` > env > `.env`；`headless` 随附 profile 禁存储/authorization/DeepSeek account（恢复 patch 见 bundle README）。官方指南 `stored-credentials-precedence`。
- ⭐ 🔌 **feat(cua): 桌面操作成建制**（`5658751da0` 像素映射+可选相对坐标 / `17c253ce7e` AppKit 显式 hover / `fdbe2bce47` 悬停跨观察保持 / `fd3868adc6` 移动指针前揭示备用 UI / `a83cebc4cf` 无激活恢复窗口+拒陈旧坐标 / `1e67f8da60` 跨 Agent 连接共享 helper / `7257181b9e` AX 按需展开 / `705a96eefe` 截图阶段 trace）
- ⭐ 🔌 **feat(ui-secret-mask): 发送文本凭据遮蔽**（`a93958c7d0`；`94d4007bfd` 导出格式常量与方法文档化）
- 📋 ⚠️ **feat(models/pi-ai): Azure 更名 + 凭据前隐藏模型**（`d79f13a4d7` adopt pi-ai 1.1.0；指南 `pi-ai-azure-provider`〔`azure-openai-responses`→`azure`〕/ `pi-ai-model-discovery`〔带凭据路由凭据配置前隐藏模型〕；`20f99ffb0c` DeepSeek providers 等连接、I/O 前拒模型）
- 📋 ⚠️ **feat(account): DeepSeek 账号三连**（指南 `deepseek-account-identity-watch`〔watch 默认不通知 Platform 身份变化〕/ `deepseek-account-model-catalog`〔路由不收 models 目录，单模型走 `modelOverrides`〕；`3a0f4976ad` 账号列表加载日志）
- 📋 ⚠️ **feat(web): 桌面字号快捷键联动**（`0c6968b649` 桌面字号联动调整 / `8096e18504` 会话字号快捷键；指南 `desktop-font-size-shortcuts`——占用原可自定义组合键）
- 📋 **feat(preset): sdk-minimal 图像读取与压缩**（`444692d1ca`/`f15091a922` read_image / `5b784ecbc3` 自动+手动压缩；指南 `sdk-minimal-image-compaction`）
- 📋 **fix(cli): `--from-default-profile` 替换已存在 profile**（指南 `from-default-profile-replaces-target`——每次执行用模板全新副本替换目标目录）
- 📋 **fix(runtime): custom primary-runtime Python 解释器别名支持目录迁移**（指南 `primary-runtime-python-aliases`，挂 rc.2 目录）
- ⭐ 🔌 **feat(ui-conversation/web): 槽位扩张与图片家族**（`3f1d5dfcfa` New Session options 槽 → `conversation.hero.options`；`conversation.chat.message.images`/`conversation.chat.user.images`/`conversation.user.text.node`/`workspace.toast` 入目录；`conversation.message.images` 改名进 chat 家族；`533299e6ab` Definition 可认领目标事件）
- ⭐ **feat(web): 响应式与双工**（`89c4652add` 自动化任务页头 / `ee558c82d7` Plugins 页头窄宽 reflow / `5379996fcb` 终端输入走双工流 / `5a52b980e5` 移动端键盘默认收起 / `ebe725081c` 响应式 client UI 标准入 skills）
- **feat(sdk): 显式持久化 session resume**（`0bec9479ae`；`b1d5671038` 确认简化）
- **feat(plugin-manager): badge skill 内置功能预览**（`7fcaf07051`；预览决策记录 `aac50c7923`）
- **feat(agent-team): 可禁用 interrupt 工具**（`ecafa412ac`）；**feat(desktop): 保留包手工 dispatch / COS 审批发布**（`60084a5b59`、`d156ee31a0`、`fbe2bce47` 渠道分离 `db…`）
- **feat(ui-workspace): 侧栏会话水位折叠**（`7df3c41ec9`）；**fix(worktree): `GIT_NO_LAZY_FETCH` 关懒取**（`b0414b8a98`）

## Behavior Changes（⚠️ 非 API breaking）

- ⚠️ 🔌 **Web 登录 DeepSeek 账号开放**（`8ee22c3668`）；认证浏览器偏好持久化到 Host（`23c29d067a`）。
- ⚠️ **新 UI 面**：`workspace.toast` 槽、composer 图片附件槽进 chat 家族（用户消息/助手消息分轨）。
- ⚠️ **prompt 经济学**：子代理回合结束而非 sleep、read 走行区间（`7a881e944a`）。

## Fixes（精选）

- **fix(cua)**: 悬停用持久系统指针移动（`8a7f941112`）、共享捕获取消与连接清理（`6539baeda5`）。
- **fix(session)**: JSONL 保留默认导入过渡（`22d0bd19a3`）。
- **fix(hmr)**: config watcher 排除无关文件（`be7d58308c`）。
- **fix(ui-chat)**: 工作详情折叠时序持久化（`61112eab8f`）。
- **fix(web)**: 只 join 最新 Workspace 连接并恢复已登出 preset（`3c1e357132`）。

## Docs / 工程面

- **官方升级指南 14 篇**（目录代际滞后：3 篇 `v0.2.1-alpha.1/`〔job-id-identity / jsonl-persistence-plugin / subagent-preset-composition〕+ 10 篇 `v0.2.1-alpha.2/` + 1 篇 `v0.2.0-rc.2/`〔primary-runtime-python-aliases〕）。
- **持久化承认 2 条**（same-version 加性）：`2026-09-30-job-session-lifecycle`、`2026-10-13-user-rpc-principal`；新增 `docs/persistence-changes/historical-formats/` 档案目录。
- **能力缝**：`ctx.remoteAccess`（core）、`ctx.webApp`（web-app bundle 行），0 删除。
- **slot 目录** +627/−179：+5 槽（chat.message.images / chat.user.images / hero.options / user.text.node / workspace.toast）、−1 槽（conversation.message.images 改名）。
- vendor 列车：cordis 4.0.5-alpha.2、schemastery 3.18.5-alpha.2、hmr 1.0.20-alpha.2、loader 1.0.6-alpha.2 等（`7c8cbea696`）。

## Reverted（窗口内落地后撤回）

- （无独立撤回提交；注意 `22d0bd19a3` 曾保留 JSONL 默认导入过渡，终态 `dfca3c3c6f` 收敛为命名空间导出——迁移以指南为准。）

## 复核命令

```bash
git rev-list --no-merges --count dsh-v0.2.1-alpha.2..dsh-v0.2.1-alpha.3   # 673
git diff --shortstat dsh-v0.2.1-alpha.2 dsh-v0.2.1-alpha.3                # 3311 files +120978/−16632
git diff --name-status dsh-v0.2.1-alpha.2 dsh-v0.2.1-alpha.3 -- 'packages/**/package.json' | Select-String '^A'   # 5 新包
git diff dsh-v0.2.1-alpha.2 dsh-v0.2.1-alpha.3 -- packages/extensions/cordis-client-runner/src/client/slot-catalog.ts | Select-String "^[+-]\s+key: '"
git show dsh-v0.2.1-alpha.3:packages/core/session/src/types.ts | Select-String SESSION_FORMAT_VERSION   # 保持 4
```
