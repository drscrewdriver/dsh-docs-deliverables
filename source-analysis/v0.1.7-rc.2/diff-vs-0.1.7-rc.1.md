# diff: dsh-v0.1.7-rc.1 → dsh-v0.1.7-rc.2（分支/标签对比详情）

> 对比命令：`git diff --stat dsh-v0.1.7-rc.1..dsh-v0.1.7-rc.2`
> 两个 tag 均位于 master 主干（非 backport 分支），区间为线性发布窗口。
> 规模：335 commits（224 非 merge + 111 merge）；3429 files，+136,313 / −24,518。
> 分区：`packages/` 1868 files +81,564 / −11,510 ｜ `docs/` 236 files +17,681 / −4,004 ｜ 其余为 lockfile、apps 快照、i18n 配套。

---

## 1. 文件热度分布（按包）

| 包 | 变更文件数 | 主要内容 |
|---|---|---|
| `packages/llm/llm-deepseek` | 30 | 动态工具更新序列化、provider 认证下放、wire 扩展限流 |
| `packages/schedule/schedule` | 29 | 工具描述精简、进入后又退出默认 composition |
| `packages/client/ui-primitives` | 23 | markdown 本地图片、focus ring、glyph（94 个公共 glyph） |
| `packages/client/shortcuts` | 22 | ⭐ 全新包 |
| `packages/client/ui-shortcuts` | 14 | ⭐ 全新包 |
| `packages/fs/tool-fs` | 14 | 截断代理对、read hint 短 id |
| `packages/boot/app-boot` | 11 | skippedBundles 单次报告、optional bundle 校验 |
| `packages/llm/llm` | 10 | `projectToolUpdates`、ToolUpdate 类型 |
| `packages/subagent/subagent` | 9 | catalog 递归遍历 |
| `packages/client/web` | 8 | composition/fixture 对齐 |
| `packages/api/session-controller` | 8 | 可用模型追踪、后台保存 |
| `packages/core/session` | 8 | `toolHistory()`（格式版本不变） |
| `packages/experimental/{inspector,auto-review}` | 8+7 | optional bundle 化、ask 兜底 |

完整提交清单见仓库：`git log --no-merges dsh-v0.1.7-rc.1..dsh-v0.1.7-rc.2`（224 条）。

## 2. 逐主题 diff 说明

### 2.1 LLM 动态工具更新（`bc8c0dbf40` 主提交，+946/−85）

- `packages/core/agent-loop/src/agent.ts`：工具集变更记为 developer message（模型能力无关）。
- `packages/core/session/src/tool-history.ts`（新逻辑）：`Session.toolHistory()` 折叠 header + updates；baseline 绑定激活在折叠时不丢失（`1b0c2e5760`）。
- `packages/llm/llm/src/content.ts`：`projectToolUpdates` 按 route 投影；`types.ts` 新增 `ToolUpdate = 'in-history' | 'addition-only'`。
- `packages/llm/llm-deepseek/src/serialize.ts`：system-role `tool_addition` / `tool_removal` block + `tool_reference`；"developer message unsupported" 分支移除。
- `packages/llm/llm-deepseek/src/messages-api.ts`：`MESSAGES_TOOL_CHANGES_BETA = 'mid-conversation-tool-changes-2026-07-01'`。
- `packages/llm/llm-deepseek/src/config.ts`：`catalogModel` 新增 `toolUpdate` 校验。
- 会话格式：新持久化 block 归入 developer message，`SESSION_FORMAT_VERSION` **仍为 4**；remote event 类型无新增。
- 测试：`agent-loop/tests/tool-updates.spec.ts`（新）、`core/session/tests/tool-history.spec.ts`（新）、`llm/tests/content.spec.ts`（+113）、`dynamic-tool-cache.e2e.ts`。

### 2.2 Provider 认证拆分（`40da69ff75` + `e310916e59`）

- 新包：`packages/llm/llm-deepseek-account`（路由 `deepseek-account`；错误码 `ACCOUNT_SIGN_IN_REQUIRED` / `ACCOUNT_TOKEN_INVALID` / `ACCOUNT_QUOTA`）与 `packages/llm/llm-deepseek-api-key`（路由 `deepseek-official`；`x-api-key`、`apiKeyEnv=DEEPSEEK_API_KEY`、`MISSING_CREDENTIAL` / `INVALID_CREDENTIAL`）。
- `packages/llm/llm-deepseek/src/{adapter,files-api,file-store,upload-index}.ts` 改为接收 provider 解析出的认证；认证决策不再在共享传输层。
- `packages/api/remotes/src/remote-events.ts`：新增 `credentials/record-updated`。
- `packages/bundle/base/cordis.patch.yml`：组合调整（account/api-key 两路由注册）。

### 2.3 凭证过期 / 登出 / 充值

- `packages/llm/llm-deepseek/src/{adapter,transport}.ts`：推理 401 → 凭证过期（`3e4119ebdb`）。
- `packages/credentials/deepseek-account{,-platform}/`：被拒 token 触发登出（只清除匹配 token 的旧凭证，`37d3a31e29`）；Platform 响应码拒绝 grant（`43f107d164`）；余额超时 30s（`c846fd48a3`）。
- `packages/api/account-controller`：`hasRunningAccountTasks()`（新 spec `signout-impact.spec.ts`）。
- `packages/client/ui-settings-account`：`SignOutDialog.tsx`、bonus-notices 重写（删 `bonus-notice-store.ts`）、登出后隐藏 provider。
- `packages/client/ui-chat/src/client/chat/QuotaNoticeHost.tsx`（新）：欠费 vs API key 无效区分，充值入口 hold/page 所有权。

### 2.4 快捷键（`91423ea1b4` revert-restore，PR #5117/#5173）

- 新包 `packages/client/shortcuts`：`binding.ts` / `configuration.ts` / `persistence.ts` / `protocol.ts`（纯协议，无 React/DOM/Electron 依赖）+ `src/client/`（registry、DOM 仲裁含 IME 保护、storage）。
- 存储：Web `dsh.keybindings.v1`（localStorage，origin-local）；Desktop `userData/keybindings.json`（v1 只读，v2 可选 `secondCode`）；override-only 持久化（缺省命令继承默认）。
- 桌面：`apps/desktop/src/keyboard.ts`（+253，原生拦截先行）、`ipc.ts`、`preload-app.ts`；`1e5af11d8c` 保证 protocol 先于 main bundle 产出（tsdown `{ hostPhase: true }`）。
- 测试：包内 11 spec、desktop `keyboard.spec.ts`（679 行）、6 个 shortcuts e2e + 双语 golden。

### 2.5 Schedule / time-context（先启后关）

- `e896737840`（PR #5011）：`packages/bundle/web-app/cordis.patch.yml` 挂载 time-context / schedule / ui-schedule；fixed-rate floor 300s→60s（decoder、create/update 校验、tool schema、client floors 同步）；storage phase1（PR #4335：任务落盘、due session 崩溃恢复）。
- `cad6fef2fd`（PR #5175）：**三行各加 `disabled: true`**；minimal-preset tool-schemas 快照删除全部 `schedule_*`（−267 行）；`374b9cc1fb` 对齐 fixtures。rc.2 终态：代码随 bundle 分发、能力保留、默认关闭。
- `341023a9e7`：Schedule 工具描述精简（仅 description，schema 不变）；PR #5133 time-context 10 分钟间隔；`955a706d33` ui-schedule records 两行截断。

### 2.6 user-questions（revert 终态）

- `bb19061473`（PR #4839）：timed wait / late reply / 双结算，曾新增 `timed-wait.ts`、`projection.ts`、`user-question-reply.schema.json`、`docs/subsystems/user-questions.md`。
- `32905d5ab5`（PR #5174）：**整体回退**。rc.2 中 `packages/interaction/user-questions/src` 只剩 `index.ts` + `types.ts`；`ask_user` 契约与 rc.1 相同。

### 2.7 核心持久化

- `packages/util/atomic-write/src/index.ts`：锁记录 PID；持有者已退出可接管（wx claim 文件认领 → 复核 PID 防复用 → 移除重试）；不接管自己进程/异主机/存活持有者记录。
- `packages/boot/plugin-manager/src/{operations,run-tree}.ts`：`.plugin-manager/run.json` 残留检测，等待或点名拒绝。
- `packages/session-query/session-query/src/observation.ts`：live projection 失败 → `SessionQueryError(..., 'SESSION_QUERY_CORRUPT_SESSION')`。
- `packages/fs/tool-str-replace-editor`、`packages/shell/tool-bash-persistent`、`packages/util/output-retention`：`truncateWithoutSplittingSurrogatePair`（最多短 1 code unit 的前缀保持截断）。
- `packages/boot/app-boot/src/profile.ts`：`Profile.skippedBundles` 唯一来源；`reportSkippedBundles` 单次报告；`generateConfigSchema` 删 `binName` 参数。

### 2.8 Auto review / 插件生态

- `packages/experimental/auto-review/src/index.ts`：denial 且 policy=`ask` 时回落用户决策；reviewer failure 显式 fail；`displayReason` 本地化契约（`packages/core/tools/src/index.ts`）。
- optional bundle 化（`a3480857dd`）：`scripts/optional-bundles.spec.ts`（新）、`verify-default-product-isolation.ts` 双重校验；auto-review `icon.svg` + 元数据进 Official 组；Inspector 保持显式安装（Playwright/Chrome DevTools MCP 因 ~85MB 依赖撤回 optional 化）。
- plugin-manager：mirror 失败后 another-way 出口（`ef516f98cf`）；默认安装源按 registry 实名（`16af6fddc7`）。

### 2.9 Workspace / 工具

- ⚠️ `ff1c7d415f`：默认目录名固定 `default-workspace`；`WorkspaceInitializeDefaultRequest` 删除（`workspace.initializeDefault` 无参）；新别名 `@deepseek-ai/dsh-api-workspace-controller/default-workspace`；显示标题走 `workspaceDisplayTitle` 本地化。
- `931505a9cc`：`list` 对最终链接跟随解析（Windows junction，`My Music` 等修复）；`read` 的 no-follow 门保留。
- `19b7de31a6` + 新包 `packages/util/code-language`：read 语言 hint 持久化为短 id；`6945da14cb` 语言表统一并扩展。
- `f35db51bee` / `d685383ee6`：native-command Windows adapter 脚本文件化（绕开 32767 字符 CreateProcess 上限）；MSIX 间接图标 `SHLoadIndirectString` 解析。

### 2.10 GUI / 桌面

- focus ring：`--dsw-alias-brand-primary` 统一，`ui-theme` 全局 `focus.css` 兜底（54 样式表、49 处声明、8 色 → 1 色）。
- 归档三态过滤：`ui-workspace/src/client/rows/WorkspaceBrowser.tsx`、`tree.ts`。
- 桌面关闭/托盘：`apps/desktop-host/src/quit-inspection.ts`（新，40 行）+ quit bypass 加固 + `tray-windows.ico`。
- 桌面 onboarding（PR #4459）：`apps/desktop/src/main.ts`、`update-overlay.ts`、`desktop-onboarding.e2e.ts`（423 行）。
- 本地 Markdown 图片：`ui-primitives/src/markdown/render.tsx`、`path-images.ts`、`workspace-path/file-media-url`。
- 其余：web fetch 折叠链接（`61a0ed487e`）、"开发者工具"→"代码工作工具"（`1103c1a7dd`）、staged preset 清理（`5577becafe`）、模式选择由开发者模式控制（`a44534e274`）、文件审查精简（`fdd14a0989`）。

### 2.11 工程体系

- `e7def469e1`（PR #5036）：`*.i18n.yaml` 按 heading-slug 逐节 hash；fenced code block + GENERATED region 不入 hash；**删除 `dsh-translation-pairing` merge driver**；`gen-config-catalog` / `gen-module-graph` / `gen-doc-graphs` 改写双语 region；活跃记录全量迁移。
- `03bd8258c3`：LibreOffice Kit 0.1.1（office-to-pdf / skill-office / desktop-host / web-app bundle）。
- tsconfig.base.json（+8 paths 别名）、tsconfig.client.json（+3 references）、新 `tsconfig.desktop-keyboard-tests.json`。

## 3. 契约面变化汇总（对外可见）

| 面 | rc.1 | rc.2 |
|---|---|---|
| `SESSION_FORMAT_VERSION` | 4 | 4（不变） |
| 插件清单契约 | rc.1 版 | 不变（无 breaking 迁移项） |
| remote events | — | + `credentials/record-updated` |
| approval ask 决策 | reason | + 可选 `displayReason`（本地化展示） |
| DeepSeek wire | — | + beta `mid-conversation-tool-changes-2026-07-01`、`tool_addition`/`tool_removal`/`tool_reference`、`catalogModel.toolUpdate` |
| 请求扩展 | 无上限 | 单请求 8 MiB 上限（可配置） |
| `workspace.initializeDefault` | 接受 name 参数 | 无参；目录名固定 `default-workspace`（破坏性） |
| fixed-rate 下限 | 300s | 60s（schedule 插件启用时；默认 disabled） |
| 默认 web composition | 无 schedule | schedule/time-context/ui-schedule 分发但 `disabled: true` |
| `ask_user` | rc.1 行为 | 相同（timed waits 被 revert） |
| 首轮 system prompt + tool schema | 7985 tokens | ≈ 6067 tokens（−1918） |
| i18n merge driver | `dsh-translation-pairing` | 已删除，逐节 hash |
| 快捷键 | 不可配置（#4886 移除后） | 可配置（Web + Desktop，双键 chord） |

## 4. 与 rc.1 文档集的对应关系

本目录 `01-14` 主题篇为 rc.1 基线（rc.2 无系统性结构变化，篇首已标注）。rc.2 增量落到主题篇的对应关系：

- 02-core-product：§2.7 持久化、§2.6 user-questions revert
- 04-llm-typer：§2.1 动态工具更新、§2.2 provider 拆分、§2.3 凭证
- 05-execution-world：§2.5 Schedule、§2.9 工具/沙盒
- 07-multi-agent：subagent catalog 递归
- 09-plugin-system：§2.8 optional bundle、plugin-manager
- 10-gui-frontend-backend：§2.4 快捷键、§2.10 GUI/桌面
- 11-protocol-sdk：§2.1 wire 契约、§2.3 表格
- 12-engineering：§2.11 工程体系
- 13-browser-computer-and-voice：voice-input setup 引导
- 14-deliverables-document-office：LibreOffice Kit 0.1.1
