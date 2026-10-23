# CHANGELOG — dsh-v0.2.1-rc.2 → dsh-v0.2.1-rc.3

> 提交区间：`687f282e86` → `1f81c047fc`（2026-10-23，PR #6999）。6 commits = 5 非 merge + 1 merge。
> 🔌 = 插件作者可见面。

## Features

- 🔌 `5ff29190ed` **feat(ui): add navigation entry customization**（PR #6247）
  - 新包 `packages/client/ui-entry-customization`：左侧栏面板按钮 / Conversation 头 View 页签 / 右侧栏 guide 工具卡三域的条目**钉选、隐藏、More 菜单**；region-owned pins，持久化数据免迁移。
  - slot 目录 +3：`sidebar.panellist.actions`、`conversation.session.header.views.actions`、`sidebar.right.tab.guide.actions`（More 菜单行，`kind: list`，root scope）。
  - 同 PR 进场 🔌 **New Session 空白会话复用**（note `2026-10-20-new-session-blank-reuse-by-preset`；官方升级指南 `docs/upgrade-guide/v0.2.1-rc.2/new-session-blank-reuse/`）：`ui-workspace/src/client/navigation.ts` 的 `createInWorkspace` 改为复用首个 unstarted/unarchived 空白会话（按 `projectionValues.agentPreset` 匹配；无登记 preset 的空白对任何请求合格）。
- `c48f8523f2` 🔌 **feat(llm): follow the official /models listing on the DeepSeek API-key route**（PR #6944）
  - `llm-deepseek` 新增 `listing-config.ts`（`ModelListingConfig`：`modelsTimeoutMs` 默认 5000ms、`modelsMaxAgeMs` 默认 600000ms，均 `z.number()...volatile()`）+ `ModelListingCache`/`requestModelListing`/`resolveListedCatalog`/`refuseListedModel`。
  - `llm-deepseek-api-key` 从纯内建 catalog 改为跟随官方 listing，失败回落内建；ACP stdout 保留给协议消息。

## Fixes

- `39d2903841` **fix(ui): separate navigation pins from selection and show menu icons**（PR #6883）——钉选态与选中态解耦；More/菜单项显示图标；`ui-primitives` 新增 `tooltip-placement.ts`。

## Behavior Changes

- `675164957a` **feat(analytics): track navigation entries and preset selections**（PR #6600）——`ui-agent-preset` 新增 `client/analytics.ts` 埋点（desktop-only productAnalytics 通道）；无插件 API 面。

## Release

- `d02ea370ee` release(dsh): 0.2.1-rc.3 —— 349 个 package.json 版本行 bump；代码面与功能提交外零差异。

## 零变化清单（对照探针）

- 闸门：`plugin-compatibility.ts` / `compatibility-preflight.ts` 零 diff（gate=10 与 rc.1/rc.2 全等）
- settings 核心：仅版本行；configForms 消费点 cf=78 不变
- vendor：cordis / schemastery 零 diff
- `docs/capability-seams.md`：零 diff（缝集合 0 增 0 删）
- `SESSION_FORMAT_VERSION` = 4；`docs/persistence-changes/` 无新增承认
- 槽：0 删除 / 0 改名（slot-catalog.ts 其余 diff 为 source 锚点行号漂移）

## 复核命令

```bash
git rev-list --count dsh-v0.2.1-rc.2..dsh-v0.2.1-rc.3          # 6
git diff --shortstat dsh-v0.2.1-rc.2 dsh-v0.2.1-rc.3           # 640 files, +5682/−1021
git diff --name-status dsh-v0.2.1-rc.2 dsh-v0.2.1-rc.3 -- packages/client/ui-entry-customization | Select-String '^A' | Select-Object -First 1
git diff dsh-v0.2.1-rc.2 dsh-v0.2.1-rc.3 -- packages/extensions/cordis-client-runner/src/client/slot-catalog.ts | Select-String "^\+\s+key: '"
git diff --stat dsh-v0.2.1-rc.2 dsh-v0.2.1-rc.3 -- packages/boot/app-boot/src/plugin-compatibility.ts docs/capability-seams.md vendor/   # 空
git show dsh-v0.2.1-rc.3:packages/llm/llm-deepseek/src/listing-config.ts
```
