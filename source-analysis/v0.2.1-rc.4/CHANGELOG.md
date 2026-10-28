# CHANGELOG — dsh-v0.2.1-rc.3 → dsh-v0.2.1-rc.4

> 提交区间：`1f81c047fc` → `504a01a957`（2026-10-26，轻量 tag）。9 commits = 7 非 merge（含 release）+ 2 merge。
> 🔌 = 插件作者可见面。本版**无 Features**——纯 Fixes 车。

## Fixes

- 🔌 `72624bae95` **fix(ui): show view tab tooltip only for overflowing labels**（PR #7183，分支提交 `c38265a00e`）
  - `ui-conversation/src/client/skeleton/ConversationSession.tsx`：新增 `ViewTabLabel` + `labelNeedsTooltip()`——按字形宽度估算（全角 13px / 其余 7px，对照 `.tabLabel` max-width 88px），**仅估算溢出才挂全名 Tooltip**；短标签页签不再有 tooltip。
  - `skeleton.client.spec.tsx` 同步更新；README 三语口径改「Each tab label estimates its text width from the glyphs」。
- 🔌 `199ffe37ba` **fix(ui): keep the more views tooltip fixed**（PR #7342）
  - More 按钮 label 固定为 `session.moreViews`，**不再内嵌当前折叠视图名**；locale 键 `session.moreViewsCurrent`（zh/en 两处）**删除**。README 口径改「The More button highlights when the active View is folded」。
- 🔌 `41736cdec5` **fix(acp): keep account catalog diagnostics off stdout**（PR #7179，merge `f425304f7b`；伴生测试 `940aafcadb` test(acp) shared cleanup）
  - `llm-deepseek-account/src/index.ts`：catalog 诊断回调 `info:` 由 `console.info`（stdout）改 `console.error`（stderr）——「ACP reserves stdout for protocol messages, including during successful catalog loads」；`provider.spec.ts` 同步。
- 🔌 `cc4446eecc` **fix(mcp): keep resource-listing diagnostics off ACP stdout**（PR #7168，merge `cb7f0878e4`）
  - `mcp-client/src/connection.ts`：`startConnection` 的 `resources/list`/`resources/templates/list` 分支先查 `generation.getServerCapabilities()?.resources`；**未宣告则直接返回 `{resources: []}` / `{resourceTemplates: []}`，不调 SDK**（SDK 对未宣告能力的 fallback 会 `console.debug` 写 stdout，破坏 ACP JSON-RPC）。
  - 新增 e2e `apps/cli/tests/profiles/acp/tests/stdout.expected.e2e.ts`（ACP stdout 纯净性固化）。
  - `mcp-client`/`mcp-resources` README 三语同步：未宣告 resources 的服务器「MCP client returns empty resource and template lists **without contacting the server**」。

## Release

- `504a01a957` release(dsh): 0.2.1-rc.4 —— 349 个 package.json 版本行 bump（逐行核验**无非版本行改动**）；代码面与 Fixes 提交外零差异。

## 零变化清单（对照探针，2026-10-28 实测）

- 闸门：`plugin-compatibility.ts` / `compatibility-preflight.ts` 零 diff（gate=10 与 rc.1–rc.3 全等）
- settings 核心：仅 `packages/settings/settings/package.json` 版本行；configForms 消费点 cf=78 不变
- vendor：cordis / schemastery 零 diff
- `docs/capability-seams.md`：**零 diff**（缝集合 0 增 0 删）；**`docs/` 整目录零 diff**
- `docs/upgrade-guide/`：零 diff（本段官方指南 **0 篇**）
- `SESSION_FORMAT_VERSION` = 4（`packages/core/session/src/types.ts` 零 diff）；`docs/persistence-changes/` 无新增承认
- 槽：`slot-catalog.ts` 零 diff——0 增 / 0 删 / 0 改名（rc.3 的 +3 槽原样）
- 包结构：0 新增 / 0 删除 / 0 改名
- 配对探针（packages|vendor|apps 全量口径）rc.3↔rc.4 **14 列逐项全等**（iss=0/inst=3/scope=0/cf=78/vol=1/gate=10/dpc=2/card=1/rowcfg=11/detail=9/allowver=9/loc=12/snap=262/edsh=27）

## 复核命令

```bash
git rev-list --count dsh-v0.2.1-rc.3..dsh-v0.2.1-rc.4          # 9
git diff --shortstat dsh-v0.2.1-rc.3 dsh-v0.2.1-rc.4           # 369 files, +596/−381
git diff --name-status dsh-v0.2.1-rc.3 dsh-v0.2.1-rc.4 | grep -v package.json   # 20 个实质文件
git diff -U0 dsh-v0.2.1-rc.3 dsh-v0.2.1-rc.4 -- "*package.json" | grep "^[+-]" | grep -v "version"   # 空（纯版本行）
git diff --stat dsh-v0.2.1-rc.3 dsh-v0.2.1-rc.4 -- packages/boot/app-boot/src/plugin-compatibility.ts docs/ vendor/   # 空
git show dsh-v0.2.1-rc.4:packages/mcp/mcp-client/src/connection.ts | grep -n "listable"
git ls-remote --tags origin | grep rc.4                         # 504a01a957（轻量 tag，无 ^{}  peeled 行）
```
