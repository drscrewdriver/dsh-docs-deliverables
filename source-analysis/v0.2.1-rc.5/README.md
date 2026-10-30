# DSH v0.2.1-rc.4 → v0.2.1-rc.5 变更说明（更新要点）

> **数据源**: `deepseek-ai/deepseek-harness` 官方仓库
> **标签对比**: `dsh-v0.2.1-rc.4` (`504a01a957`) → `dsh-v0.2.1-rc.5`（提交 `b830ec950f`，轻量 tag，PR #7572 合并）
> **发布日期**: 2026-10-29（npm `@deepseek-ai/dsh` 0.2.1-rc.5 挂 latest）｜ **性质**: 0.2.1 线第五个 rc——**契约换代车**（reasoning body slot 面向作者 breaking）
> **统计**: 368 files changed, +529 / −399；其中 **349 个文件仅 `package.json` 版本行**（monorepo 全推），实质文件 **19 个**（含 3 篇 guide + 3 语 README + 13 源文件/测试）
> **提交数口径**: 浅克隆下 commit 数因 graft 假象不可考（同 0.2.2-alpha.2 教训），以 diff 文件数为准
> **结构变化**: **0 新增包 / 0 删除 / 0 改名**；新增 1 个内部模块 `packages/client/ui-chat/src/client/reasoning-text.ts`
> **持久化契约**: `SESSION_FORMAT_VERSION` **保持 4**；`docs/persistence-changes/` 零 diff
> **插件契约**: 闸门（`plugin-compatibility.ts`/`compatibility-preflight.ts`）**零 diff**（gate=5↔5 两侧同）；settings 核心 / vendor cordis·schemastery / `docs/capability-seams.md` / `slot-catalog.ts` key 集合 / `docs/upgrade-guide/` 目录树 **零 diff**；**官方升级指南 1 篇**（`v0.2.1-rc.4/reasoning-body-props/`，目录按迁移源命名，非 rc.5 目录）
> **⚡ 唯一作者面向断裂面**: slot `conversation.chat.reasoning.body` 的 owner props `ReasoningBodyOwnerProps` **新增必填字段 `rawText: string`**；同时 `text` 字段**语义反转**（从"原始模型输出"→"Chat 处理后展示文本"）——依赖旧语义把 `text` 当 raw 用（正则、字数、复制原文）的自定义 reasoning renderer **行为静默漂移**

---

## 一句话总结

rc.5 是 rc.4 修复车之后的**契约精化段**，一个主题、一处作者面向 breaking：

- **Reasoning Body Slot 双轨文本化**（PR #7572 车）：`conversation.chat.reasoning.body` slot 的 `ReasoningBodyOwnerProps` 加 `rawText`（模型原始输出）并**语义反转** `text`（Chat 已处理展示文本，走新增内部助手 `reasoningText()` 剥离 `**` 标记等）；官方 cot-translation 只改了 JSDoc 未改码（因为它本就是"翻译展示文本"消费方）；`ReasoningContentInput`（`conversation.chat.reasoning.content` Factory 输入）**不再 extends `ReasoningBodyOwnerProps`**，字段独立化为 `{ text, running, labels? }`；
- **契约面**：闸门两文件零 diff、capability-seams 零 diff、slot-catalog key 集合零增删（只更新 `conversation.chat.reasoning.body` 条目的 summary/doc/ownerProps 描述与其他 slot 的行号位移）；
- 其余为 `ui-chat` 三语 README 同步 + release bump（349 个 `package.json` 版本行 → runtime 字符串变 `0.2.1-rc.5`）。

---

## 版本序列定位

```
dsh-v0.2.1-rc.3      ← 上上版（1f81c047fc，2026-10-23，导航条目自定义车）
    │
    ▼
dsh-v0.2.1-rc.4      ← 上版（504a01a957，2026-10-26，纯修复车，契约面零 diff）
    │
    │  ←─ 本次变更（浅克隆下 commit 数不可考；以 diff 文件数 368 为准）
    ▼
dsh-v0.2.1-rc.5      ← 当前版（b830ec950f，2026-10-29）—— **0.2.1 线尾版**（PR #7572 合并，reasoning body slot 换代车）
    │
    │  （与 0.2.2 线并行分叉，非直连）
    ▼
dsh-v0.2.2-alpha.2   ← 0.2.2 线首 tag（f3803c9697，2026-10-27，= master tip 于登记当时）——见 ../v0.2.2-alpha.2/ 动态条目
```

> ⚠ 时间线要点：**0.2.2-alpha.2（10-27）先于 rc.5（10-29）发布**——两条线并行推进，rc.5 不是 0.2.2-alpha.2 之后 master 的顺延，而是 0.2.1 release branch 的补丁车。0.2.1 线尾版从原口径 rc.4 **推进至 rc.5**。
> 与 rc.3 的「slot+3 但结构不变」、rc.4 的「纯修复零契约断裂」都不同，rc.5 是**契约精化车**：闸门仍零 diff、capability-seams 仍零 diff，但 slot 的 owner props 结构变了（一处作者面向 breaking，见 §插件适配）。

---

## 主题清单

### 主题一 · Reasoning Body Slot 双轨文本化（唯一作者面向 breaking）

**变更文件**（14 个源文件/测试，全部围绕此主题）：
- 契约面：
  - `packages/client/ui-chat/src/client/contract/slots.ts` — `ReasoningBodyOwnerProps` 新增 `rawText: string`（required），`text` 语义反转（`Complete or streaming model output` → `Reasoning text prepared for display`）；`ReasoningContentInput` **不再 extends `ReasoningBodyOwnerProps`**，独立字段化为 `{ text, running, labels? }`
  - `packages/extensions/cordis-client-runner/src/client/slot-catalog.ts` — slot 目录中 `conversation.chat.reasoning.body` 条目的 summary/doc/ownerProps 同步；其他 slot 因 slots.ts 行号位移导致 source 锚点更新（444→447 等，非 key 增删）
- 实现面：
  - `packages/client/ui-chat/src/client/reasoning-text.ts` — **新增文件**，导出 `reasoningText(raw: string): { text, hidden }`，供 Chat 内部把 raw 转成展示文本（当前实现：剥离 `**` 双星标记 + 空态标记）
  - `packages/client/ui-chat/src/client/chat/ReasoningRow.tsx` — 消费点参数改名 `text` → `rawText`，内部先 `reasoningText(rawText)` 得到展示 `text` 和 `hidden` 标记，然后再传给 body slot；`DefaultReasoningBody` 传给 Content Factory 的是处理后的 text
  - `packages/client/ui-chat/src/client/chat/ReasoningContent.tsx` — JSDoc 从 "original reasoning" 改 "display-ready reasoning"（内容 Factory 签名不变，仍是 `{ text, running, labels? }`）
  - `packages/client/ui-chat/src/client/conversation-nodes/process-activity.ts` — 会话节点分派链路适配新字段名
  - `packages/experimental/client-ui-cot-translation/src/client/TranslationBody.tsx` — **官方迁移示范：只改 JSDoc**（`@param props - original reasoning` → `@param props - display-ready reasoning`），代码 `props.text` 消费点不变（因其本就是"展示文本翻译"消费方，语义反转后仍可用）
- 测试面：
  - `packages/client/ui-chat/tests/reasoning-row.client.spec.tsx` / `reasoning-content.client.spec.tsx` / `reasoning-component-fixture.tsx` — 新字段测试
  - `packages/client/ui-chat/tests/reasoning-text.client.spec.ts` — **新增文件**，测 `reasoningText()`
  - `packages/experimental/client-ui-cot-translation/tests/translation-body.client.spec.tsx` — cot 迁移回归
  - `apps/web/tests/reasoning-preview.e2e.ts` — web e2e 冒烟
- 文档面：
  - `packages/client/ui-chat/README.md` / `README.zh.md` / `README.i18n.yaml` — 三语同步：Body Slot 描述从"offers the original reasoning text"改"offers the original `rawText`, display-ready `text`, and streaming state"；"preserve access to the original text" → "preserve access to the untranslated text"
  - `docs/upgrade-guide/v0.2.1-rc.4/reasoning-body-props/guide.md` / `guide.zh.md` / `guide.i18n.yaml` — **官方升级指南 1 篇**（3 语）

**判据要点**（作者读这一条即可）：
- 不注入 `conversation.chat.reasoning.body` slot 的插件：代码零改动
- 注入且**将 `text` 用作原始模型输出**（正则匹配、字数统计、原文复制、以 raw 作为翻译源）：**必须切 `rawText`**，否则行为静默漂移（不报错但语义变化）
- 注入且**将 `text` 用作展示文本**（原样渲染 Markdown、渲染到 DOM）：可继续用 `text`；官方 cot-translation 属此类
- 依赖 `ReasoningContentInput` 曾继承 `ReasoningBodyOwnerProps` 结构做泛型约束：需去掉继承假设，改按 `{ text, running, labels? }` 显式声明
- 元数据枚举：`engines.dsh` 精确枚举或 peer 精确枚举清单**必须加 `0.2.1-rc.5` 行否则拒载**；caret `^0.2.1-alpha.1` 免动（同三元组）

---

### 主题二 · 契约面零 diff 复核

以下面在 rc.4↔rc.5 两侧**逐项全等**（已实测或 grep 命中数一致）：

| 面 | 判据 | 结果 |
|---|---|---|
| 闸门文件 | `git diff --stat dsh-v0.2.1-rc.4 dsh-v0.2.1-rc.5 -- plugin-compatibility.ts compatibility-preflight.ts` | 空（零 diff） |
| gate 命中数 | `git grep -l -E 'plugin-compatibility\|compatibility-preflight' <tag> -- packages` | rc.4=5，rc.5=5（同） |
| Capability seams | `git diff --stat ... capability-seams*` | 空 |
| SESSION_FORMAT_VERSION | `git grep 'SESSION_FORMAT_VERSION\s*=\s*[0-9]'` | 两侧仍 4（grep 只命中历史 release notes） |
| slot-catalog key 集合 | diff 后 `key:` 行零增删（只有 doc/summary/ownerProps/source 更新） | 零增删 |
| persistence 承认 | `docs/persistence-changes/` | 零 diff |

---

## 未验证项（诚实标注）

1. **提交数**：浅克隆 graft 假象下不可考（同 0.2.2-alpha.2 处理），本次分析**不给出具体 commit 数**；如需精确请补 `git fetch --unshallow` 后复核。
2. **`reasoningText()` 内部语义**：本轮只读到调用点和 JSDoc，未逐行读该助手实现——若插件依赖具体剥离规则（`**` 之外的其他形态），需自查 `packages/client/ui-chat/src/client/reasoning-text.ts` 源码。
3. **14 列配对探针**：本次仅实测 gate 一列（两侧=5），余下 12 列（iss/inst/scope/cf/vol/dpc/card/rowcfg/detail/allowver/loc/snap/edsh）在 rc.4→rc.5 无相关面 diff 前提下预期逐项全等，**未逐列跑**——host-matrix probe_matrix rc.5 行按"沿用 rc.4 数值 + 显式标注未逐列实测"填入。
4. **UI 侧行为回归**：`hidden` 标记（`text.trim() === '' && text !== rawText`）触发条件是否覆盖所有历史空态渲染分支——官方测试 `reasoning-row.client.spec.tsx` 已跑通，但第三方 renderer 若依赖旧的"raw 就是 text"假设可能在特殊模型输出格式（如空 reasoning block）下漂移。

---

## 相关索引

- **diff 明细** → [diff-vs-0.2.1-rc.4.md](./diff-vs-0.2.1-rc.4.md)
- **提交摘要** → [CHANGELOG.md](./CHANGELOG.md)
- **插件迁移** → [plugin-migration-guide.md](./plugin-migration-guide.md)
- **升级指南原文**（官方） → `docs/upgrade-guide/v0.2.1-rc.4/reasoning-body-props/guide.md`（tag `dsh-v0.2.1-rc.5`）
- **版本速查** → [../README.md](../README.md) 版本矩阵与 breaking 速查
- **跨线主迁移文档** → [../../plugin-framework/v0.2.1-migration.md](../../plugin-framework/v0.2.1-migration.md) §1 rc.5 段
- **skill 台账** → `dsh-docs-deliverables-skill` 的 `host-matrix.yaml` `dsh-0.2.1-rc.5` 卡片与 `version-delta-ledger.md` `VD-020-021-09`
