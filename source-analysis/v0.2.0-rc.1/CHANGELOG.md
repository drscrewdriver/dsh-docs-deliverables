# DSH v0.2.0-rc.1 CHANGELOG（dsh-v0.1.7-rc.2 → dsh-v0.2.0-rc.1）

> 261 commits（167 非 merge + 94 merge）｜ 2026-09-24 ~ 2026-09-28 ｜ 发布 PR #5387
> 标记：⭐ 新包 ｜ ↩️ 窗口内落地后被 revert ｜ ⚠️ 破坏性 / 行为变化

## Features

- ⭐ **feat(schedule): ship the Schedule switch as an optional bundle** (`41c29fa832`, PR #5179)
  ⭐ 新包 `packages/experimental/schedule-bundle`（`@deepseek-ai/dsh-experimental-schedule-bundle`），`dsh.bundle.patch: ./cordis.patch.yml` 插入 `time-context` / `schedule` / `ui-schedule` 三行；登记进 `packages/boot/app-boot/src/profile.ts` 的 `OPTIONAL_BUNDLES`。配套 `packages/bundle/web-app/cordis.patch.yml` **删除**默认三行（终态 `64a361ee44`）。决策记录：`.agents/notes/implemented/architecture/2026-09-24-schedule-opt-in-optional-bundle.md`。
- ⭐ **refactor(telemetry): share reporting through a Cordis OTel service** (`9d36f9c1fc`)
  ⭐ 新包 `packages/telemetry/otel`（`@deepseek-ai/dsh-otel`）注册 `ctx.otel`：`createEventReporter(options)`（按条数分批）与 `createSessionLogReporter(options)`（字节限额分批）；`packages/bundle/base/cordis.patch.yml` 新增 `otel` 行。
- ⭐ **feat(desktop): collect product analytics through OTel** (`b1cf871b25`, PR #5136)
  ⭐ 新包 `packages/client/product-analytics`（`@deepseek-ai/dsh-client-product-analytics`）：Remote API `enabled()` / `watchPolicy()` / `report(ProductEvent)`；web-app patch 新增 `desktop-product-telemetry` 与 `product-analytics` 两行，`disabled: profileContext?.name !== 'desktop'`（仅桌面 profile 启用，普通 Web 不采集）。配套 `5d1beb324e` / `32ade298b5` / `9f7ef18c03`（live policy 与提交上下文集中化）。
- ⭐ **feat(web): add Session Log upload preference in General settings** (`7ded036fdb`, PR #5337)
  ⭐ 新包 `packages/client/ui-settings-session-log`（`@deepseek-ai/dsh-client-ui-settings-session-log`）：`settings.general.item` order 90 行（"Upload Session Log when using the official model API"），直写 Host `session-log-deepseek.enabled`；`shell.overlay` 注册 `UploadToast`。配套 `session-log-deepseek.Config.enabled` 改 `Volatile<boolean>`（**下一请求即生效，免重启**）。
- **feat(session): conservative recovery of pending tool results on step failure**（`6a6f350b94`、`eafd5b6068`、`8de4e51875`、`3cdbf42a1d`）
  `packages/core/session/src/repair.ts` 抽出公开类 `ToolCallRecovery`（`observe(event)` + `results()`），`openTurnClosers`、崩溃恢复、fork seed 三处共用；`packages/core/agent-loop/src/agent.ts` 在 step 抛错的 catch 中先 `session.append('tool/result', ...)` 补齐未决结果再重抛，恢复失败包成 `AggregateError('Step failed and its pending tool results could not be recorded')`；调度器终态失败从"保留已记录 call、不伪造结果"改为"drain 后 reject，由所属 step 记录保守恢复结果"（`tool-calls.ts`）。会话格式仍为 V4。
- **feat(client): 运行状态可视**（`fa3d555cd8`、`cae515d504`、`e9e03abf95`）
  `packages/client/ui-chat` 新增 `RunningStatus.tsx` / `RunningWhaleTail.tsx`：Session 运行时在 transcript 下方显示鲸尾动画 + 运行状态条。
- **feat(client): unify process row shimmer** (`ae9a455bfd`)
  `ui-primitives/TextShimmer` 重构为通用 shimmer 包装组件（嵌套包装 + `data-shimmer-decoration` 标记），skill/tool/进程行复用。
- **feat(terminal): bound the wait for a seen prompt marker's printable tail**（`3693c2b402`、`76a2b7a799`、`21638c5631`）
  `packages/terminal/terminal-bash/src/config.ts` 新增 `promptTailGraceMs`（默认 0 = 不延长；非 0 必须 ≥ pollIntervalMs）；session 实现"看到 prompt marker 但 printable tail 未到"时的有界额外等待。
- **feat(desktop): Windows caption/fullscreen 与更新体验**
  fullscreen IPC 广播从 darwin-only 扩展到 `darwin || win32`（`1aea67a755`、`3adf561295`）；macOS 新增麦克风 entitlements（`846afdfaa6`、`728d56156c`）；`src/locale.ts` 更新文案 130 行中英重写；`src/device-info.ts`（反馈问卷附带的机器描述）。
- **feat(ui-settings-account): 联系我们上下文升级**（`contact-url.ts`）：新增 `uid` / `deviceInfo`，`app_version` 改 `harness_version` + `device_info`。
- **feat(web): Session Log OTLP 字节限额**（`7b8c7dfff2`、`3dd52bfd9b`、`9d36f9c1fc`）
  `session-telemetry-otel` 新增 `maxRequestBytes`（上限 4,000,000）；大会话前缀拆成多次串行 HTTP 请求；每请求 1s 传输超时 + 1.5s watchdog、3s 关闭外限。决策记录：`.agents/notes/implemented/architecture/2026-09-25-session-log-otel-byte-limits.md`。

## Behavior Changes（⚠️ 非 API breaking，但会实际咬人）

- ⚠️ **Schedule 从默认组合消失**：`packages/bundle/web-app/cordis.patch.yml` 删除 `time-context` / `schedule` / `ui-schedule`；引用这三个 id 的 profile patch / `--patch` overlay 在 bundle 未启用时得到 `patch: entry <id> not found` 警告。新装 Web 默认无 `schedule_*` 工具、无 Automation tasks 页、无逐步 durable clock 消息；存量任务数据保留在 Schedule 域。
- ⚠️ **`displayTitle` 兜底语义移除**（`bcf0ba45cb`、`a4ac7e9eb3`）：`SessionRowOwnerProps.displayTitle` 与 `SessionNode.title`（`tree.ts sessionTitle()`）由 "persisted title, project basename, or Session id" 改为 "persisted title, or empty when the Session has none"；渲染层 `Rows.tsx` 用 `node.title || t('session.untitled')` 兜底。rename 快捷键入口改传原始标题（可能为空串）。
- ⚠️ **`forkSession` 签名扩展**（`packages/api/session-controller`、`ui-workspace/navigation.ts`）：`(sessionId) => Promise<void>` → `(sessionId, onCreated?) => Promise<SessionId>`，`onCreated` 在可选的继承标题重命名**之前**回调子会话 id。对调用者兼容，对实现者是接口变更。
- ⚠️ **composer 提交契约扩展**（`ui-conversation/contract/composer-submission.ts` 新增）：`SessionInput.submit(mode?, source?)`、`ComposerKeyboard.submit(mode, source?)`、`InputEvent 'enter'`、`SubmitAttempt.submission` 均为可选新增；新增 `MessageSubmission` / `MessageSubmissionState` 类型。
- ⚠️ **Chat work-details 默认值**（`47db27a730`、`a03e63d1e3`、`b066690f70`）：非 Desktop Web 的默认 `transcriptView` 从 `standard` 改 `detailed`（legacy `'normal'` 映射 `'detailed'`）；schema 去掉 `.default()`，`transcriptView` 变可选，缺失值 defer 到客户端默认；Desktop 客户端仍按 `standard`（`apply.ts`：`'dshDesktop' in globalThis ? 'standard' : DEFAULT_TRANSCRIPT_VIEW_MODE`）。
- ⚠️ **OTLP 端点迁移**：base bundle `session-telemetry-otel.exporter.url` 由 `https://harness-telemetry.deepseeksvc.com/v1/logs` 改为 `https://dsh-otel-collector.deepseeksvc.com/v1/logs`（未设 `DSH_TELEMETRY_OTLP_URL` 的安装改发新 collector）。
- ⚠️ **`session-log-deepseek.Config.enabled` 类型收紧**：由可选变为必有（`z.boolean().default(true).volatile()`），且为 `Volatile<boolean>`——直接读取该 Config 类型的代码需适配。
- **WebKit JSON 兼容**（`068c552b1e`、`269768a823`、`9925ba721d`）：`packages/util/values/src/index.ts` 的 `hasIntrinsicConstructor` 由硬编码 V8 构造器文本改为与 `Function.prototype.toString.call(Array/Object)` 自身表示比较，兼容 JavaScriptCore/WebKit；session JSON 校验路径受益。

## Fixes（精选）

- **fix(llm-deepseek): remove every stale DeepSeek file mapping in one index update**（`25e235d2c9`、`97d9115336`）
  `DeepSeekFileStore.invalidate()` 与 `DeepSeekUploadIndex.remove()` 由单条改批量（一次文件锁重写内完成过滤），修复"只删第一条 stale 映射"的 bug；`RequestFiles.retry()` 同步改单次批量调用。
- **fix(telemetry): cancel product exports at shutdown deadline**（`746b9eb753`）
  `product-telemetry-otel` 改注入 `ctx.otel` 后，`shutdownTimeoutMillis` 语义变为 "Drain deadline; expiry cancels pending exports"——到期主动 abort 取消未完成导出，不再只是放弃等待。
- **fix(webworker): open config files and load plugin manager in the preview**（`805cb207be`）
  Web 预览 Worker 恢复加载 plugin-manager 与 HMR 两服务，Creator 模式的 `tool-plugin-manager` 不再等不到服务、Plugins 页有 profile 可管（仅包安装类 shell 命令不可用）。
- **fix(settings): config-editor 识别"显式置 undefined 覆盖继承配置"**（`3e6c104445`、`f2af03539b`）
  `configuration()` 用 `composeEntries` 计算合成 inherited 值，支持 `insert === undefined && Object.hasOwn(patch, 'config')` 的显式清空语义；未覆盖 entry 复用组合，设置页性能优化。
- **fix(sandbox): Windows ACL 诊断**（`1d56bd5628`、`5bab07157f`、`b876f825c7`、`d2d755077b`）
  新增 `packages/sandbox/sandbox-windows-acl/src/acl-skill.ts`：把打包的 `diagnose-windows-sandbox-acl`（SKILL.md + 721 行 ps1）注册为内置技能（`LocalSandboxProvider` 在 `win32 && runnerCommand === undefined` 时注入）；normalized roots 内修复继承 ACE、失败不再继续并保留诊断报告、denial 后请求诊断升级。
- **fix(plugin-manager tests): Git 环境隔离**（`1c0234e7b1`）：新增 `tests/git-environment.ts`，隔离宿主 `GIT_CONFIG_COUNT` 等环境变量；operations spec 修复 run-record 读取竞态。
- **fix(client/plugin-manager): 刷新失败反馈**（`PluginRefreshToast.tsx` 新增，挂 `shell.overlay` id `plugin-manager.refresh-toast`）；`manager-store.ts` 新增 `refreshStatus: 'idle' | 'refreshing' | 'failed'`、400ms 最小 spinner、失败时保留缓存卡片。
- **fix(client/plugin-manager): 安装输入隐私分级**（`sanitize-install-input.ts` 新增）+ IME 提交守卫、registry 键盘选择/焦点、无效输入共享焦点色（`16c30ed6ba`、`f057cc37c4`、`69b55fb53b`、`eb9efc6265`、`473fd15101`）。
- **fix(boot): 跨平台 pnpm 锁定 koffi 3.1.1**（`aee3c39ee7`、`c6e4c77a12`；`pnpm-workspace.yaml` 注释说明 GCC 13 构建失败原因，升级需全消费方同步）。

## Docs / 工程面

- **refactor: compact persistence schema type inventory**（`cc3c631699`、`cf6276e78d`）：`docs/persistence-schema.json` 从内联 schema AST 压缩为 digest/names/sources（单文件 −78,492 行，占全区间删除量的 96%）；详情改由 `scripts/persistence-schema-model.ts` + `scripts/persistence-schema-snapshot.spec.ts` 按需生成。**非语义变更。**
- 新增 `docs/subsystems/otel.md` / `.zh.md`：`ctx.otel` 共享工厂文档；`docs/subsystems/product-telemetry.md` 半重写（类型改 `OTelEventRecord` 别名 + `ctx.productAnalytics`）；`docs/subsystems/schedule.md` 两处改为 optional bundle 表述；`docs/config-catalog.md` 重新生成（4 个新包条目 + volatile/maxRequestBytes/promptTailGraceMs）。
- 插件开发技能文档更新：`.agents/agent-preset/skills/cordis-plugin-development/`（SKILL.md、practices、user-actions；`1f847565ba`、`c795996b5d`）。

## Reverted（窗口内落地后撤回，终态不含）

- ↩️ `b9ace787e4` "refuse to switch a row alone when its bundle switches its rows as a whole"（revert `6085a56eb6`）
- ↩️ `e42f262bc5` "let a bundle list its rows without row switches"（revert `738178f136`）
  两者净效果为零，bundle 行切换最终以 optional bundle 插行方式落地（`64a361ee44`）。
