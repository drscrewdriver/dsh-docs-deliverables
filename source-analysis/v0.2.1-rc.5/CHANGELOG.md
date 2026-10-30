# CHANGELOG — dsh-v0.2.1-rc.4 → dsh-v0.2.1-rc.5

> 提交区间：`504a01a957` → `b830ec950f`（2026-10-29，PR #7572 合并 release 车）。**浅克隆 graft 下 commit 数不可考**——以 diff 文件数（368）为准，同 0.2.2-alpha.2 处理。
> 🔌 = 插件作者可见面。本版 **1 处 Features/Breaking**（reasoning body slot 契约换代），**无 Fixes 主题**。

## Features / Breaking（作者面向）

- 🔌 `b830ec950f`（PR #7572 release-dsh-0.2.1-rc.5 车） **feat(ui-chat): expose raw + display-ready reasoning to Body Slot**
  - `packages/client/ui-chat/src/client/contract/slots.ts`：`ReasoningBodyOwnerProps` **新增 required 字段 `rawText: string`**（模型完整或流式原始输出）；**`text` 字段语义反转**——从"Complete or streaming reasoning text"改为"Reasoning text prepared for display"（Chat 内部预处理：`reasoningText()` 仅对 `<signature>` 开头签名块剥离/置空，其余原样透传；`**` 剥离仅发生在折叠摘要层不影响 body text，2026-10-31 重核）
  - `packages/client/ui-chat/src/client/contract/slots.ts`：`ReasoningContentInput` **不再 `extends ReasoningBodyOwnerProps`**——独立声明 `{ text: string; running: boolean; labels?: MarkdownLabels }`；`conversation.chat.reasoning.content` Factory 签名不变
  - `packages/client/ui-chat/src/client/reasoning-text.ts`（**新增文件**）：`reasoningText(raw: string): string`——Chat 内部展示文本预处理助手（仅处理 `<signature>` 签名块：闭合→返正文；未闭合/前缀流式态→置空；非 `<` 前缀原样透传）；`hidden` 在调用侧 `ReasoningRow` 计算：`text !== rawText && text.trim() === ''`（处理过后为空但原文非空 → 整块隐藏）
  - `packages/client/ui-chat/src/client/chat/ReasoningRow.tsx`：`ReasoningRow` 消费点形参 `text` → `rawText`；`useMemo` 中先算 `reasoningText(rawText)` 得 `text`/`hidden` 再向下传；`DefaultReasoningBody` 向 Content Factory 传的是处理后的 `text`
  - `packages/client/ui-chat/src/client/chat/ReasoningContent.tsx`：`DefaultReasoningBody` JSDoc 从 "original reasoning" 改 "display-ready reasoning"（内容 Factory 签名保持 `{ text, running, labels? }`）
  - `packages/client/ui-chat/src/client/conversation-nodes/process-activity.ts`：会话节点分派链路适配新字段名（`text` → `rawText`）
  - `packages/extensions/cordis-client-runner/src/client/slot-catalog.ts`：`conversation.chat.reasoning.body` 条目 `summary`/`doc`/`ownerProps` 三处口径同步；其他 slot `source:` 锚点行号位移（+6，非 key 变化）；**key 集合零增删**
  - `packages/experimental/client-ui-cot-translation/src/client/TranslationBody.tsx`：**官方迁移示范**——`TranslationBodyProps` 类型走 `PropsRuntime<'conversation.chat.reasoning.body'>` 自动带上新 `rawText` 字段；实际代码 `props.text` 消费点**未改**（cot 本就是"翻译展示文本"消费方，语义反转后仍可用）；JSDoc `@param props - original reasoning` → `display-ready reasoning`
  - `packages/client/ui-chat/README.md` / `README.zh.md` / `README.i18n.yaml`：三语同步——Body Slot 描述从"offers the original reasoning text and streaming state"改"offers the original `rawText`, display-ready `text`, and streaming state"；"Display extensions must preserve access to the original text" → "preserve access to the **untranslated** text"
- 📖 `b830ec950f`（伴生） **docs(upgrade-guide): reasoning-body-props**
  - `docs/upgrade-guide/v0.2.1-rc.4/reasoning-body-props/guide.md` / `guide.zh.md` / `guide.i18n.yaml`（**目录按迁移源命名 = rc.4**，非 rc.5 目录，同 rc.3 「New Session 空白复用」指南命名规律）
  - 三步迁移：①普通渲染 / 翻译请求 / 未翻译视图继续读 `text`；②需要完整模型输出的扩展改读 `rawText`；③把选定的 `text`（或其翻译）传给 Content Factory，不重复 Chat 的展示处理

## 测试与回归（作者不感知）

- `packages/client/ui-chat/tests/reasoning-row.client.spec.tsx` — 更新，覆盖 `rawText`+`text` 双轨语义
- `packages/client/ui-chat/tests/reasoning-content.client.spec.tsx` — 更新，Content Factory 输入独立性验证
- `packages/client/ui-chat/tests/reasoning-component-fixture.tsx` — 更新，夹具字段同步
- `packages/client/ui-chat/tests/reasoning-text.client.spec.ts` — **新增文件**，测 `reasoningText()` 助手
- `packages/experimental/client-ui-cot-translation/tests/translation-body.client.spec.tsx` — 更新，cot 迁移回归
- `apps/web/tests/reasoning-preview.e2e.ts` — 更新，web 侧 e2e 冒烟

## Release

- `b830ec950f` release(dsh): 0.2.1-rc.5 —— 349 个 `package.json` 版本行 bump（monorepo 全推）；runtime 字符串变 `0.2.1-rc.5`；代码面与 Features 提交外零差异。

## 零变化清单（对照探针）

- **闸门**：`plugin-compatibility.ts` / `compatibility-preflight.ts` 零 diff；`git grep -l -E 'plugin-compatibility|compatibility-preflight' <tag> -- packages` 两侧命中数=5（同）
- **settings 核心**：仅 `packages/settings/settings/package.json` 版本行
- **vendor**：cordis / schemastery 零 diff
- **`docs/capability-seams.md`**：**零 diff**（缝集合 0 增 0 删）
- **`SESSION_FORMAT_VERSION` = 4**（`packages/core/session/src/types.ts` 零 diff）；`docs/persistence-changes/` 无新增承认
- **slot 目录 key 集合**：`slot-catalog.ts` 无 `key:` 行增删——只 `conversation.chat.reasoning.body` 条目 doc/summary/ownerProps 三处口径换 + 其他 slot `source:` 锚点位移；rc.3 的 +3 槽（sidebar.panellist.actions 等）原样
- **包结构**：0 新增 / 0 删除 / 0 改名（`packages/client/ui-chat/src/client/reasoning-text.ts` 是包内新文件，非新包）
- **`docs/upgrade-guide/` 目录树**：无新增目录（rc.3/rc.4 段目录不变），仅在既有 `v0.2.1-rc.4/` 目录下新增 `reasoning-body-props/` 一份 guide

## 未逐列实测项

- **14 列配对探针**：本次仅实测 gate 一列（两侧=5，同 rc.4 host-matrix 值）；余下 13 列（iss/inst/scope/cf/vol/dpc/card/rowcfg/detail/allowver/loc/snap/edsh）在 rc.4→rc.5 无相关面 diff（闸门/seams/settings 核心/vendor 全零）前提下**预期逐项全等 rc.4 值**——`host-matrix.yaml` `probe_matrix` rc.5 行按"沿用 rc.4 数值 + 显式标注未逐列实测"填入。若后续 rc.6 或 alpha 段引发质疑，需回补 `git fetch --unshallow` 后逐列跑一次。

## 复核命令

```bash
# 规模与差异
git diff --shortstat dsh-v0.2.1-rc.4 dsh-v0.2.1-rc.5              # 368 files, +529/−399
git diff --name-only dsh-v0.2.1-rc.4 dsh-v0.2.1-rc.5 | wc -l      # 368（含 349 package.json）
git diff --name-only dsh-v0.2.1-rc.4 dsh-v0.2.1-rc.5 \
  | grep -v package.json | grep -v pnpm-lock.yaml                 # 19 实质文件

# 契约面零 diff
git diff --stat dsh-v0.2.1-rc.4 dsh-v0.2.1-rc.5 \
  -- packages/boot/app-boot/src/plugin-compatibility.ts \
     packages/boot/app-boot/src/compatibility-preflight.ts \
     docs/capability-seams.md docs/persistence-changes/ vendor/    # 空

# 唯一作者面向断裂面
git show dsh-v0.2.1-rc.5:packages/client/ui-chat/src/client/contract/slots.ts \
  | sed -n '75,95p'                                                # ReasoningBodyOwnerProps 新形态
git diff dsh-v0.2.1-rc.4 dsh-v0.2.1-rc.5 \
  -- packages/client/ui-chat/src/client/contract/slots.ts          # rawText 新增 + ContentInput 脱钩

# 官方迁移示范
git show dsh-v0.2.1-rc.5:docs/upgrade-guide/v0.2.1-rc.4/reasoning-body-props/guide.md
git show dsh-v0.2.1-rc.5:packages/experimental/client-ui-cot-translation/src/client/TranslationBody.tsx \
  | sed -n '20,30p'                                                # JSDoc 已改，代码未动

# 尾版与 npm 侧
git ls-remote --tags origin | grep rc.5                            # b830ec950f（轻量 tag）
curl -s https://registry.npmjs.org/@deepseek-ai/dsh \
  | jq '.time["0.2.1-rc.5"], .dist-tags'                           # 2026-10-29 14:15:23，latest 挂 rc.5
```
