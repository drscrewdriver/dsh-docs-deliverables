# diff-vs-0.2.1-rc.4 — 逐主题差异明细

> 基准：`dsh-v0.2.1-rc.4`（`504a01a957`）→ `dsh-v0.2.1-rc.5`（`b830ec950f`）。368 files +529/−399，其中 **349 个仅 `package.json` 版本行**（monorepo 全推），实质文件 **19 个**（含 3 篇 upgrade-guide + 3 语 ui-chat README + 13 源文件/测试）。
> 变更热度分布（实质 19 文件）：`packages/client/ui-chat` 12（contract/slots +3、chat 组件 +3、reasoning-text +1 新增、tests +4、README +3 语）、`packages/experimental/client-ui-cot-translation` 2（源码 +1、测试 +1）、`packages/extensions/cordis-client-runner` 1（slot-catalog）、`docs/upgrade-guide/v0.2.1-rc.4/reasoning-body-props/` 3、`apps/web/tests` 1。

---

## 1. Reasoning Body Slot 双轨文本化（PR #7572 车 · 唯一作者面向 breaking）

### 1.1 契约面（`packages/client/ui-chat/src/client/contract/slots.ts`）

`ReasoningBodyOwnerProps`（对应 slot `conversation.chat.reasoning.body`）——**字段级 breaking**：

```diff
-/** Original model-provided reasoning offered to the expanded Body Slot. */
+/** Original and display-ready reasoning offered to the expanded Body Slot. */
 export interface ReasoningBodyOwnerProps {
-  /** Complete or streaming reasoning text. */
+  /** Complete or streaming model output. */
+  readonly rawText: string
+  /** Reasoning text prepared for display. */
   readonly text: string
   /** Whether the reasoning tail is still streaming. */
   readonly running: boolean
 }
```

- **新增 required 字段** `rawText: string`——模型完整/流式原始输出（未处理）
- **`text` 字段语义反转**——从"原始 reasoning text"改为"Chat 已处理展示文本"（`prepared for display`）
- **`running` 保持**——流式尾标记，无变化

`ReasoningContentInput`（对应 slot `conversation.chat.reasoning.content` Factory 输入）——**结构脱钩**：

```diff
-export interface ReasoningContentInput extends ReasoningBodyOwnerProps {
+export interface ReasoningContentInput {
+  /** Caller-selected Markdown. */
+  readonly text: string
+  /** Whether the supplied text is still streaming. */
+  readonly running: boolean
   /** Localized Markdown controls, used unchanged when supplied; omission uses Chat's defaults. */
   readonly labels?: MarkdownLabels
 }
```

- **不再 `extends ReasoningBodyOwnerProps`**——独立声明三字段 `{ text, running, labels? }`
- 语义层：Factory 输入现在明确是"调用方选择的 Markdown"，不再隐含"原始模型输出"
- 副作用：**若插件把 `ReasoningContentInput` 当 `ReasoningBodyOwnerProps` 的 superset/subset 做泛型约束**（如 `<T extends ReasoningContentInput>(x: ReasoningBodyOwnerProps): T`）会类型不通——因 `rawText` 从 ContentInput 消失了

`conversation.chat.reasoning.body` slot 的 JSDoc 侧同步：

```diff
-     * Expanded reasoning body with the unchanged model text. ...
-     * Contributions must preserve access to the original text.
+     * Expanded reasoning body with raw and display-ready text. ...
+     * Contributions must preserve access to untranslated display text.
```

**判定**：**API 形状 breaking + 语义反转并存**。旧代码只要读 `text` 且不引用 `rawText`，类型上仍能通过（新增必填字段在 consumer 侧无破坏，owner 侧生产 rawText 是 Chat 内部事），但**行为漂移**：`text` 值不再是模型原始输出而是 Chat 处理后的展示文本。若插件用 `text` 做正则/字数/原文复制——静默错位。

### 1.2 实现面（`packages/client/ui-chat`）

- **`packages/client/ui-chat/src/client/reasoning-text.ts`（新增文件）**——`reasoningText(raw: string): { text: string; hidden: boolean }`：Chat 内部展示文本预处理助手；`hidden` 标记 = `text !== raw && text.trim() === ''`（处理过后为空但原文非空 → 隐藏整块）
- **`packages/client/ui-chat/src/client/chat/ReasoningRow.tsx`**（+10/−4 大致规模）：
  - `ReasoningRow` 形参解构改名 `text` → `text: rawText`
  - 新增 `const { text, hidden } = useMemo(() => { const t = reasoningText(rawText); return { text: t, hidden: t.text !== rawText && t.text.trim() === '' } }, [rawText])`
  - 向下传 Body Slot：`{ rawText, text, running }`（三字段）
- **`packages/client/ui-chat/src/client/chat/ReasoningContent.tsx`**（+1/−1 JSDoc）：`DefaultReasoningBody` JSDoc `@param props - original reasoning` → `display-ready reasoning`；代码签名 `{ text, running, renderFactorySlot }` 不变；内部把 `text`（已处理）传给 Content Factory
- **`packages/client/ui-chat/src/client/conversation-nodes/process-activity.ts`**：会话节点分派链适配新字段名（`text` 变量语义切换，可能重命名局部变量或改读取路径）
- **测试**：
  - `reasoning-row.client.spec.tsx` / `reasoning-content.client.spec.tsx` / `reasoning-component-fixture.tsx` 更新
  - **新增** `reasoning-text.client.spec.ts`——测 `reasoningText()` 助手

### 1.3 消费端示范（`packages/experimental/client-ui-cot-translation`）

**官方迁移示范——只改 JSDoc，代码不动**：

```diff
 /**
  * Render translated reasoning, retaining the complete original until a failed request is retried.
- * @param props - original reasoning, translation preferences, and cancellation-aware callback.
+ * @param props - display-ready reasoning, translation preferences, and cancellation-aware callback.
  */
 export function TranslationBody(props: TranslationBodyProps) {
```

`TranslationBodyProps = PropsRuntime<'conversation.chat.reasoning.body'>`——类型走 slot 契约，`rawText` 字段自动加入；实际消费点仍是 `props.text`，未改。

**判定**：cot 是**语义反转的兼容消费方**（翻译目标本就是展示文本），可继续用 `text`；但这**不代表所有插件都能这么办**——凡把 `text` 当原始模型输出用的插件（如：正则匹配 `<thinking>` 标签、精确字数统计、原文复制按钮、以 raw 为源做二次翻译）都必须切 `rawText`。

### 1.4 slot 目录（`packages/extensions/cordis-client-runner/src/client/slot-catalog.ts`）

- **`conversation.chat.reasoning.body` 条目**：`summary`/`doc`/`ownerProps` 三处字符串同步（对应 §1.1 契约变化）
- **其他 slot 条目**：仅 `source:` 行号位移（+6）——因 `slots.ts` 头文件加行/接口字段扩展；涉及的 key：`conversation.chat.assistant-actions`（441→447）、`conversation.chat.commandview`（423→429）、`conversation.chat.flow`（390→396）、`conversation.chat.message.images`（415→421）、`conversation.chat.node`（402→408）、`conversation.chat.reasoning.body`（429→435）、`conversation.chat.turnTail`（435→441）、`conversation.chat.user.images`（417→423）、`shell.quota-notice`（449→455）
- **key 集合零增删**：`git diff ... | grep -E '^\+.*key:'` 与 `^-.*key:` 都为空

**判定**：非 breaking——slot catalog 是宿主元数据，插件通过 `PropsRuntime<slotKey>` 自动派生，行号位移不影响 API。

### 1.5 三语 README（`packages/client/ui-chat/README.md` 等）

- 「offers the original reasoning text and streaming state」 → 「offers the original `rawText`, display-ready `text`, and streaming state」
- 「preserve access to the original text」 → 「preserve access to the **untranslated** text」
- 中文版同步；`README.i18n.yaml` 三语元数据同步

### 1.6 升级指南（`docs/upgrade-guide/v0.2.1-rc.4/reasoning-body-props/`）

- **目录命名规律**：按迁移源版本命名 `v0.2.1-rc.4`，非目标版本 `v0.2.1-rc.5`——同 rc.3「New Session 空白复用」指南放在 `v0.2.1-rc.2/` 目录下的规律；作者检索时需知道这个反直觉约定
- 三步迁移建议：
  1. 继续读 `text` 处理普通渲染 / 翻译请求 / 未翻译视图
  2. 需要完整模型输出的扩展改读 `rawText`
  3. 把选定 `text`（或其翻译）传给 Content Factory，不重复 Chat 的展示处理

---

## 2. release bump（`b830ec950f`）

- 349 个 `package.json` 版本行 → runtime 字符串 `0.2.1-rc.5`；同三元组（0.2.1），caret `^0.2.1-alpha.1` 天然命中，**枚举式清单需加行**。

---

## 3. 零变化面（逐条复核）

| 面 | 结论 |
|---|---|
| `plugin-compatibility.ts` / `compatibility-preflight.ts` | 零 diff（engines.dsh 时代延续；两侧命中数=5） |
| settings 核心 / configForms 消费点 | 仅版本行 |
| vendor cordis / schemastery | 零 diff |
| `docs/capability-seams.md` | 零 diff（0 缝增删；缝集合与 rc.4 全等） |
| `slot-catalog.ts` key 集合 | 零增删（只有 doc/summary/ownerProps/source 更新） |
| `SESSION_FORMAT_VERSION` | 4（`packages/core/session/src/types.ts` 零 diff） |
| `docs/persistence-changes/` | 无新增承认 |
| 包结构 | 0 新增 / 0 删除 / 0 改名（`reasoning-text.ts` 是包内新文件） |
| 除 ui-chat / cot-translation / cordis-client-runner / apps/web-tests 之外的所有包 | 仅 `package.json` 版本行 |
| core / llm / api / mcp / sandbox / session / preset / plan / lsp / schedule / extensions（除 cordis-client-runner） / experimental（除 cot-translation） | 仅版本 bump |

---

## 4. 影响面清单（谁会被 rc.5 打到）

| 消费点 | 是否受影响 | 说明 |
|---|---|---|
| 不注入 `conversation.chat.reasoning.body` slot | ❌ 不受影响 | 代码零改动；只需元数据枚举加 rc.5 行避免拒载 |
| 注入 body slot 且把 `text` 直接原样渲染 Markdown / DOM | ⚠️ 语义变化但通常无行为差 | 现 `text` 已是展示文本，官方已做过 `**` 剥离等预处理；渲染效果通常一致或更好；若依赖旧 `text` 是"raw"来做后续处理需注意 |
| 注入 body slot 且把 `text` 当**原始模型输出**（正则/字数/复制/二次翻译源） | ✅ **行为静默漂移** | 必须切 `rawText`——否则拿到的是 Chat 处理后文本 |
| 依赖 `ReasoningContentInput extends ReasoningBodyOwnerProps` 做泛型约束 | ✅ **类型不通** | ContentInput 脱钩，需显式声明 `{ text, running, labels? }` |
| 官方 cot-translation（本包） | ⚠️ JSDoc 更新，代码不动 | 展示文本翻译消费方，语义反转兼容 |
| 依赖 `slot-catalog.ts` 内部行号锚点 | ⚠️ 位移 +6 | 若插件用 `source:` 字段做二次锚定（少见），需 rebase |
| 元数据 `engines.dsh` / peer 精确枚举清单 | ✅ **必须加 rc.5 行** | 否则闸门拒载（engines.dsh 单独裁决规则，自 a.4 起生效） |
| caret `^0.2.1-alpha.1` | ❌ 免动 | 同三元组，prerelease 命中规则下天然覆盖 rc.5 |

---

## 5. 与 rc.3 / rc.4 对比（rc.2 车→rc.3 车→rc.4 车→rc.5 车 演进）

| 段 | 规模 | 指南 | 作者面向 breaking | 类型 |
|---|---|---|---|---|
| rc.2 | 2 新包 | 0 | 无（seam 层零；但内部 `searchProviderId` volatile 化=静默失效） | 功能补丁车 |
| rc.3 | 640 files | 1 | 无 API breaking，但 `startSession` 语义变（每次新建→按 preset 复用空白） | 导航条目自定义车 |
| rc.4 | 369 files | 0 | 无（tooltip/ACP stdout 都是宿主内部行为） | 纯修复车 |
| **rc.5** | **368 files** | **1** | **有**（`ReasoningBodyOwnerProps.rawText` 新增 + `text` 语义反转 + `ReasoningContentInput` 脱钩） | **契约精化车** |

**结论**：rc.5 的**作者面向 breaking 程度高于 rc.3/rc.4**——rc.3 的 `startSession` 语义变只影响特定调用方（依赖"每次新建"的集成），rc.4 是零 API 断裂；rc.5 直接改了一个 session-scoped slot 的 owner props 结构，任何注入 `conversation.chat.reasoning.body` 且把 `text` 当 raw 用的插件都会被静默打到。
