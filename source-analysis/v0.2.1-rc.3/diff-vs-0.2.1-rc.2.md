# diff-vs-0.2.1-rc.2 — 逐主题差异明细

> 基准：`dsh-v0.2.1-rc.2`（`687f282e86`）→ `dsh-v0.2.1-rc.3`（`1f81c047fc`）。640 files +5682/−1021。
> 变更热度分布（二级目录）：packages/client 182 / snapshots/web 71 / packages/experimental 47 / packages/llm 42 / apps/web 26 / packages/session 21（全部仅版本行）/ .agents/notes 15。

## 1. 导航条目自定义（#6247，`5ff29190ed`）

- **新包** `packages/client/ui-entry-customization/`：`src/client/EntryMenuContent.tsx` + `EntryMenu.module.css` + `locales.ts`（en/zh 语料；9 语 rollout 是否齐全待核——本地仅见 en/zh locale 文件，见未核实项）；host 侧 `src/index.ts` 为**空 companion**（`export function apply(): void {}`），主体全在 client 半包。
- **三域改造**：`ui-sidebar/src/client/panel-pins.ts`（新）、`ui-conversation/src/client/view-pins.ts`（新）、`ui-sidebar-right/src/client/tabs/guide/guide-pins.ts` + `GuideMoreIcon.tsx`（新）——region-owned pins，各域自持钉选/隐藏状态。
- **slot-catalog +3 槽**（`packages/extensions/cordis-client-runner/src/client/slot-catalog.ts`，+188/−26，其余为 source 锚点行号漂移）：
  - `sidebar.panellist.actions`
  - `conversation.session.header.views.actions` —— "Rows of the View tab row's More menu; the header shows More only while this list has registrations."
  - `sidebar.right.tab.guide.actions`
- **设计依据**：`.agents/notes/implemented/architecture/2026-10-14-plugin-entry-customization.md`——明确"不改 slot 框架（ui-slots/ui-renderer）、不加新 Cordis 服务、ui-layout 不动、client 包间只共享类型"。
- e2e：`apps/web/tests/entry-customization.e2e.ts`（新）。

## 2. New Session 空白会话复用（同 PR 进场）

- 实现落点：`packages/client/ui-workspace/src/client/navigation.ts`（`createInWorkspace`）。
- 语义：New Session（Web/Desktop）与无选项 `uiWorkspace.startSession(workspaceId)`、`openWorkspace`、`connectWorkspace` 复用工作区内**首个 unstarted、未归档**空白会话；Host 将其切到默认 preset；无合格空白才新建。点名 `{ agentPreset }` 的请求跳过登记他 preset（`projectionValues.agentPreset`）的空白。
- 注意：**复用的空白保留其创建时的 preset 组成**——New Session 不再保证"当前 preset 定义"（官方指南 Migration §1：改 preset 定义后需重启 Host 或用新组词的会话）。
- 官方指南：`docs/upgrade-guide/v0.2.1-rc.2/new-session-blank-reuse/`（本区间唯一指南；目录按迁移源版本命名，非"rc.3 才有"）。
- note：`.agents/notes/implemented/architecture/2026-10-20-new-session-blank-reuse-by-preset.md`。
- e2e 更新：`apps/web/tests/agent-preset-selection.e2e.ts`、`shortcuts-workspace.e2e.ts`、`workspace-management.e2e.ts`。

## 3. DeepSeek 模型跟随官方 /models（#6944，`c48f8523f2`）

- `packages/llm/llm-deepseek/`（+1227/−21，含测试）：新 `src/listing-config.ts`——`ModelListingConfig { modelsTimeoutMs: Volatile<number>, modelsMaxAgeMs: Volatile<number> }`，schema `z.number()...default(5_000/600_000).volatile()`（**additive volatile 配置键，挂 route Config**）。
- `packages/llm/llm-deepseek-api-key/src/index.ts`（+86/10）：引入 `ModelListingCache`/`requestModelListing`/`resolveListedCatalog`/`refuseListedModel`；连接事实 = 协议设置 + 随凭证解析出的 catalog；"可选模型 = 配置 catalog 或跟随 listing 的可 offering 部分"；listing 失败回落内建目录；网络 I/O 前按 id 拒绝（`refusals`）。
- 插件面影响：不新增缝/工具名；但 **DeepSeek 模型可用性开始受网络 listing 影响**（首用等待上限 `modelsTimeoutMs`）。

## 4. 钉选与选中解耦 + 埋点（#6883 / #6600）

- `39d2903841`：`ui-conversation` 头部分离 pins/selection（`header-styles.client.spec.ts`、`skeleton.client.spec.tsx` +172）；`ui-primitives` 新 `src/tooltip-placement.ts` + 菜单锚宽测试。
- `675164957a`：`ui-agent-preset/src/client/analytics.ts`（新）+ `apply.client.spec.ts`（+252）；导航条目与 preset 选择埋点，走 desktop-only productAnalytics；`ui-workspace` 侧 `ui-agent-preset` 导出面微扩。

## 5. 零变化面（逐条复核）

| 面 | 结论 |
|---|---|
| `plugin-compatibility.ts` / `compatibility-preflight.ts` | 零 diff（engines.dsh 时代延续） |
| settings 核心 / `settings.yaml` 面 | 仅版本行 |
| vendor cordis / schemastery | 零 diff |
| `docs/capability-seams.md` | 零 diff（0 缝增删） |
| `SESSION_FORMAT_VERSION` | 4（`packages/core/session/src/types.ts` 零 diff） |
| `docs/persistence-changes/` | 无新增承认 |
| 槽删除/改名 | 0（仅 +3） |
| packages/session、packages/api、packages/experimental | 全部仅 package.json 版本行 |

## 未核实项

1. `ui-entry-customization` 的 locale 是否按 9 语 rollout 齐全（tar 内只见 en/zh，未逐 tag 全量扫）。
2. 三新槽的 `declaredBy`/occupants 注册细节与 `replaceRisk` 值（slot-catalog diff 只 grep 了 key 行）。
3. productAnalytics 事件名清单（未逐事件核对，仅确认代码落点）。

## 复核命令

```bash
git diff --numstat dsh-v0.2.1-rc.2 dsh-v0.2.1-rc.3 | sort -rn | head -15
git show dsh-v0.2.1-rc.3:packages/client/ui-entry-customization/src/index.ts
git show dsh-v0.2.1-rc.3:docs/upgrade-guide/v0.2.1-rc.2/new-session-blank-reuse/guide.md
git diff dsh-v0.2.1-rc.2 dsh-v0.2.1-rc.3 -- packages/client/ui-workspace/src/client/navigation.ts
git diff dsh-v0.2.1-rc.2 dsh-v0.2.1-rc.3 -- packages/llm/llm-deepseek-api-key/src/index.ts
git grep -l "evaluatePluginCompatibility" dsh-v0.2.1-rc.3 -- packages   # 10（与 rc.1/rc.2 同）
```
