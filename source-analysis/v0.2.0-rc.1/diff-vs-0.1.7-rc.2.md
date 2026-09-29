# diff: dsh-v0.1.7-rc.2 → dsh-v0.2.0-rc.1（分支/标签对比详情）

> 对比命令：`git diff --stat dsh-v0.1.7-rc.2..dsh-v0.2.0-rc.1`
> 两个 tag 均位于 master 主干（`4878cdabd8 release(dsh): 0.2.0-rc.1 (#5387)`），区间为线性发布窗口。
> 规模：261 commits（167 非 merge + 94 merge）；1109 files，+20374 / −77957。
> **删除量纠偏**：−77957 行中 **−75173 来自单个文件 `docs/persistence-schema.json`**（schema 清单压缩，见 §2.9）；真实代码变更约 +20k / −2.8k。
> 分区：`packages/client` 312 files ｜ `.agents/notes` 81 ｜ `apps/web` 66 ｜ `packages/experimental` 56 ｜ `apps/desktop` 48 ｜ `packages/session` 40 ｜ `packages/util` 34 ｜ `packages/sandbox` 23 ｜ `packages/core` / `packages/api` 各 22 ｜ 其余见仓库。

---

## 1. 文件热度分布（按包）

| 包 | 变更文件数 | 主要内容 |
|---|---|---|
| `packages/client`（合计） | 312 | ui-plugin-manager 打磨（最大单面包）、ui-chat 运行状态、ui-workspace 标题语义、新包 product-analytics 与 ui-settings-session-log |
| `.agents/notes` | 81 | 架构决策记录（schedule opt-in、OTel 字节限额等新增，旧记录归档） |
| `apps/web` | 66 | e2e 扩容（plugin-manager +536 行、session-log-upload 新增 72 行）、快照对齐 |
| `packages/experimental` | 56 | ⭐ schedule-bundle 新包（+webworker-runtime 预览修复） |
| `apps/desktop` | 48 | 产品分析埋点、Windows caption/fullscreen、macOS entitlements、更新文案重写 |
| `packages/session` | 40 | session-telemetry-otel 重写（字节限额 + 共享 otel）、session-log-deepseek volatile |
| `packages/util` | 34 | values（WebKit 构造器判定）、package-manifest **未动** |
| `packages/sandbox` | 23 | Windows ACL 诊断技能（721 行 ps1 + ~900 行测试） |
| `packages/core` | 22 | ToolCallRecovery 抽取、step 失败保守恢复 |
| `packages/api` | 22 | session-controller fork 契约、remotes 装配 productAnalyticsRemote |
| `packages/host` | 21 | product-telemetry-otel 重写、directory-picker/open-in-app hidden 参数 |
| `packages/llm` | 19 | llm-deepseek 文件索引批量失效（唯一实质变更） |
| `packages/boot` | 16 | config-editor 显式 undefined 覆盖、app-boot OPTIONAL_BUNDLES +1；**plugin-manager src 零改动** |
| `packages/telemetry` | 15 | ⭐ otel 新包（~1000 行源码+测试） |

完整提交清单见仓库：`git log --no-merges dsh-v0.1.7-rc.2..dsh-v0.2.0-rc.1`（167 条）。
提交类型分布：fix 73、test 33、docs 29、feat 13、refactor 9、perf 2、其余为 merge/ci/build。

---

## 2. 逐主题 diff 说明

### 2.1 Schedule 可选 bundle 化（`41c29fa832` 主提交，PR #5179）

- 新包 `packages/experimental/schedule-bundle/`：`cordis.patch.yml` 插入 `time-context` / `schedule` / `ui-schedule` 三行（id 与原 web-app 行一致，插件侧无感）；`package.json` 带 `dsh.bundle.patch` 指向该文件。
- `packages/boot/app-boot/src/profile.ts:213`：`OPTIONAL_BUNDLES` 追加 `'@deepseek-ai/dsh-experimental-schedule-bundle'`。
- `packages/bundle/web-app/cordis.patch.yml`：删除原三行（rc.2 时已是 `disabled: true`，本版彻底移除）。
- 语义：默认组合省 4 个 tool schema + 每步一条 durable clock 消息；用户从 Plugins 页开关，或写进 profile 的 `dsh.profile.bundles`。引用三个 id 的 patch 在 bundle 未启用时得到 `patch: entry <id> not found` 警告。
- 窗口内两次 bundle 行切换尝试（`b9ace787e4`、`e42f262bc5`）被完整 revert（`6085a56eb6`、`738178f136`），终态以插行方式落地（`64a361ee44`）。

### 2.2 共享 OTel 服务（`9d36f9c1fc` + 字节限额系列）

- 新包 `packages/telemetry/otel/src/`：`event-log.ts`（按条数分批）、`session-log.ts`（224 行，byte-bounded）、`event-transport.ts` / `transport.ts`（串行 HTTP、每请求 1s 传输超时 + 1.5s watchdog、3s 关闭外限）。
- `packages/session/session-telemetry-otel/src/index.ts` 重写：自组 SDK（`LoggerProvider` / `BatchLogRecordProcessor` / `OTLPLogExporter`）全部移除，`inject` 由 `['sessions']` 变 `['sessions', 'otel']`；新增 `maxRequestBytes`（`z.number().step(1).min(1).max(4_000_000)`，base bundle 显式 `4000000`）。
- `packages/host/product-telemetry-otel/src/index.ts` 重写：`static inject = ['otel']`；关闭路径由 `Promise.race([provider.shutdown(), deadline])` 改为 `reporter.shutdown(cancellation.signal)`——到期主动 abort（`746b9eb753`）。
- `packages/bundle/base/cordis.patch.yml`：新增 `otel` 行；`exporter.url` 迁移 `harness-telemetry` → `dsh-otel-collector.deepseeksvc.com`。
- `packages/session/session-telemetry/src/index.ts`：`SessionTelemetryRecord` 新增可选 `sourceEvent?: { sessionId; envelope }`（向后兼容）。

### 2.3 productAnalytics（`b1cf871b25`, PR #5136）

- 新包 `packages/client/product-analytics/`：`src/index.ts`（`Config { enabled: Volatile<boolean>; appVersion? }`，注释 "Application-owned collection policy; no user settings surface"）、`events.ts`、`src/client/index.ts`（Remote API `enabled()` / `watchPolicy()` / `report(ProductEvent)`）。
- `packages/extensions/tool-cordis/src/api-catalog.ts`：新增 Host 服务 `productAnalytics` 与类型 `ProductEvent / ProductEventMap / OnboardingPage`；`ProductTelemetryRecord` / `ProductTelemetryScalar` 改为 `OTelEventRecord` / `OTelEventScalar` 别名（结构相同，非破坏）。
- `packages/api/remotes/src/client/index.ts`：contribution 列表首位新增 `productAnalyticsRemote`。
- `packages/bundle/web-app/cordis.patch.yml`：新增 `desktop-product-telemetry` 与 `product-analytics` 两行，`disabled: !!js "ctx.get('profileContext')?.name !== 'desktop'"`，endpoint 取 `DSH_PRODUCT_ANALYTICS_OTLP_URL`。
- 桌面端：`apps/desktop/src/main.ts` 增加 `track()` helper 与 `desktop_app_launch` 事件、`DSH_CLIENT_VERSION` 注入；新文件 `src/device-info.ts`。

### 2.4 会话可靠性：ToolCallRecovery（`6a6f350b94`、`eafd5b6068`、`8de4e51875`、`3cdbf42a1d`）

- `packages/core/session/src/repair.ts`：原 `openTurnClosers` 内联的 pending-call 追踪抽成公开类 `ToolCallRecovery`（`observe(event)` + `results()`）；`openTurnClosers`、崩溃恢复、fork seed 三处共用。`tool/result` 判定收紧：需 `surfaceOp === 'append'` 且 turn/step 匹配；对"从未 pending 的 tool/result"必须先判 `entry !== undefined`（`8de4e51875` 修复 undefined 相等误通过）。
- `packages/core/session/src/index.ts:32`：新增导出 `ToolCallRecovery`、`TOOL_NOT_STARTED`、`TOOL_OUTCOME_UNKNOWN`（旧 `interruptedTurnClosers` 保留）。
- `packages/core/agent-loop/src/agent.ts`（ReactLoopAgent）：每 step 挂 `session/event` 监听喂给 `ToolCallRecovery`；step 抛错的 catch 中先补 `session.append('tool/result', ...)` 再重抛，恢复失败包成 `AggregateError('Step failed and its pending tool results could not be recorded')`。
- `packages/core/agent-loop/src/tool-calls.ts`：调度器终态失败改为"drain 后 reject，由所属 step 记录保守恢复结果"。
- 测试：`tests/resume.spec.ts` +69、`tests/tool-calls.spec.ts` +193，均在 V4 格式上验证。**会话格式版本不变（V4），无迁移包，可回退。**

### 2.5 Session Log 上传偏好 + volatile 一等化（`7ded036fdb`, PR #5337）

- 新包 `packages/client/ui-settings-session-log/`：`settings.general.item` 注册 order 90 行（order 100 版本号行之上），通过 `configForms.get('session-log-deepseek')` 直写 Host `enabled`；`shell.overlay` 注册 `UploadToast`（保存失败提示）。
- `packages/session/session-log-deepseek/src/index.ts`：`enabled` 由 `enabled?: boolean` 改 `Volatile<boolean>`（`z.boolean().default(true).volatile()`）；`apply` 不再启动时判 `enabled !== true` 即 return，改为每次请求 `config.enabled.get()`——**改偏好下一请求生效，免重启**。校验后的 `Config` 类型中 `enabled` / `maxBytes` 由可选变必有（类型层轻微 breaking）。
- `config-catalog` 相应条目新增 `refs: Volatile (@deepseek-ai/cordis)`；同机制扩散到 `ui-chat`（`transcriptView: Volatile<...>`）与 product-analytics。

### 2.6 插件管理页打磨（`packages/client/ui-plugin-manager`，~30 commits）

- 新增 `PluginRefreshToast.tsx`（手动刷新失败 toast，slot 记录 `plugin-manager.refresh-toast`）与 `sanitize-install-input.ts`（安装输入隐私分级）。
- `manager-store.ts`：`refreshStatus: 'idle' | 'refreshing' | 'failed'`、400ms 最小 spinner、失败保留缓存卡片、`ManagerNotice` 新增 `refresh-failed` 类。
- 交互：IME 提交守卫、registry 键盘选择/焦点、安装示例按钮居中、无效输入共享焦点色、guidance 文案澄清。
- 全流程 productAnalytics 埋点：`plugin_add_button_click` / `plugin_install_click` / `install_plugin_result` / `plugin_toggle` / `confirm_uninstall_plugin`。
- 只读清单页 `ui-settings-plugin-inventory`：加载骨架屏、preset 组默认展开、enabled 态不再渲染 Tag、`cardLabel()` 生成 aria-label。
- e2e：`apps/web/tests/plugin-manager.e2e.ts` +536，新增 loading / refresh / ime-enter / plugin-install-cancel 快照。

### 2.7 UI 契约与文案语义（插件可见面）

- `packages/client/ui-workspace/src/client/contract/slots.ts:79`：`SessionRowOwnerProps.displayTitle` JSDoc 改 "persisted title, or empty when the Session has none"；`tree.ts sessionTitle()` 改 `session.title?.trim() ?? ''`；`Rows.tsx` 用 `node.title || t('session.untitled')` 兜底；`shortcuts.ts` rename 改传原始标题。
- `packages/client/ui-workspace/src/client/navigation.ts:45-53`：`UiWorkspace.forkSession` 签名 `(sessionId) => Promise<void>` → `(sessionId, onCreated?) => Promise<SessionId>`；`packages/api/session-controller/src/client/contract/sessions.ts` 的 `ISessions.fork` 同步扩展，`onCreated` 在继承标题重命名前回调。
- `packages/client/ui-conversation/src/client/contract/`：`composer-submission.ts` 新增 `MessageSubmission` / `MessageSubmissionState`；`input.ts:189,283-298` submit 契约加可选 `source` 参数与 `submission` 字段。
- `packages/client/ui-primitives/src/TextShimmer.tsx` + `.module.css`：嵌套包装 + `data-shimmer-decoration`；`ui-skill/SkillRow.tsx`、`ui-tool/bash-sample.tsx` 适配。
- `packages/client/ui-chat`：`RunningStatus.tsx` / `RunningWhaleTail.tsx`；`chat-settings.ts:32` 非 Desktop Web 默认 `detailed`（`apply.ts:149` Desktop 仍 `standard`）；legacy `'normal'` → `'detailed'`。

### 2.8 LLM / 执行面 / 桌面端

- `packages/llm/llm-deepseek/src/`：`file-store.ts` 的 `invalidate()` 改批量 generations；`upload-index.ts` 的 `remove()` 在一次文件锁重写内用 `variantId\0fileId` Set 过滤（`25e235d2c9`、`97d9115336`）；`request-files.ts` 改单次批量调用。adapter 接口、协议、默认模型**均无变化**。
- `packages/sandbox/sandbox-windows-acl/src/acl-skill.ts`（+76）：`registerAclDiagnosisSkill(ctx)` 注册内置技能（资源复制到私有 tmp 兼容 ASAR/SEA）；`sandbox-local/src/index.ts` 在 `win32 && runnerCommand === undefined` 时注入（操作者自带 runner 时不注册）。
- `packages/terminal/terminal-bash/src/config.ts:48,107`：`promptTailGraceMs`（默认 0；非 0 必须 ≥ pollIntervalMs）。
- `packages/util/native-command/src/runner.ts` 及调用方（`default-directory.ts`、`native-picker.ts`、`open-in-app/resolver.ts`）：`run()` 追加 `'hidden'` 参数（窗口可见性显式化）。
- `packages/util/values/src/index.ts`：`hasIntrinsicConstructor` 与 `Function.prototype.toString.call(Array/Object)` 自身表示比较，兼容 WebKit（`068c552b1e`）。
- `apps/desktop`：+782/−178；fullscreen IPC 广播 `darwin` → `darwin || win32`；`scripts/macos-entitlements.plist` 麦克风权限；`locale.ts` 更新文案重写；`device-info.ts`。
- `packages/experimental/webworker-runtime`：预览 Worker 恢复加载 plugin-manager 与 HMR（`805cb207be`），仅包安装类 shell 命令不可用。

### 2.9 文档与工程（`cc3c631699`、`cf6276e78d`）

- `docs/persistence-schema.json`：+3393 / **−75173**。每个 type 条目内联展开的 `schema.nodes` AST 全部移除，只保留 digest/names/sources；配套 `scripts/persistence-schema-model.ts`（+48）与 `scripts/persistence-schema-snapshot.spec.ts`（+92）按需生成。**持久化语义零变化。**
- `pnpm-workspace.yaml`：仅 `allowBuilds.koffi` 注释扩充（消费方 pin 3.1.1，Koffi 3.3.2 源码构建在 GCC 13 下失败，升级需全消费方同步）；workspaces glob 未变。
- 根 `package.json`：版本 bump + `gen-scoped-events` / `verify-scoped-events` 脚本加 `--max-old-space-size=4096`。**根依赖无大版本升级。**
- 版本策略：320 个 workspace 包统一 `0.2.0-rc.1`；内部依赖全部 `workspace:*` / `workspace:^`，发布时由 pnpm pack 改写（`scripts/release/families.ts`、`scripts/release/bump.ts`）；peer 校验入口 `packages/boot/app-boot/src/plugin-compatibility.ts:61`（`includePrerelease` semver 对运行版本）。

---

## 3. 复核命令

```bash
# 区间提交
git -C $repo log --oneline --no-merges dsh-v0.1.7-rc.2..dsh-v0.2.0-rc.1

# Schedule bundle 化
git -C $repo diff dsh-v0.1.7-rc.2..dsh-v0.2.0-rc.1 -- packages/bundle/web-app/cordis.patch.yml
git -C $repo show 41c29fa832 --stat

# peer 校验语义
git -C $repo grep -n "includePrerelease" dsh-v0.2.0-rc.1 -- packages/boot/app-boot/src/plugin-compatibility.ts

# 会话格式版本
git -C $repo grep -n "currentVersion" dsh-v0.2.0-rc.1 -- packages/session/session-format-catalog/src/generated.ts

# OTel 共享服务
git -C $repo show 9d36f9c1fc --stat
git -C $repo grep -n "createSessionLogReporter" dsh-v0.2.0-rc.1 -- packages/telemetry/otel/src
```
