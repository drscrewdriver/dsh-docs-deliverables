# 插件迁移指南 — 0.2.1-rc.4 → 0.2.1-rc.5

> 结论：**一处元数据枚举 + 一处 slot 契约迁移（仅命中者动）**。rc.1/rc.2/rc.3/rc.4 迁移清单照原样成立；未注入 `conversation.chat.reasoning.body` slot 的插件代码零改动。

---

## 一、必做项

### M1. 元数据枚举补 `0.2.1-rc.5`（仅枚举式写法）

engines.dsh 时代（≥a.4）闸门对声明了 `engines.dsh` 的包按该键**单独裁决**：

- **枚举式清单**（逐版本字符串精确匹配）：**必须加 `0.2.1-rc.5` 行**，否则在 rc.5 宿主上拒载——落点为 `scripts/hosts.mjs` 单一事实源 + `sync-hosts.mjs --write` 的双清单同串纪律（`package.json` peers / `dsh.plugin.json` / `README.md`）
- **caret 写法 `^0.2.1-alpha.1`**：rc.5 同三元组（0.2.1），天然覆盖，无需动（`includePrerelease: true`）

复核：`node scripts/sync-hosts.mjs`（校验模式）+ 装机后 `dsh plugin list` 无 `IncompatiblePlugin`。

### M2. `conversation.chat.reasoning.body` slot 消费迁移（**仅命中者**）

**判定命中**：`grep -R "conversation.chat.reasoning.body" your-plugin/src`。命中即需要走下面 M2.a/b；未命中直接跳过 M2。

#### M2.a — 语义自查：`props.text` 用途

`text` 字段语义反转：从"原始模型输出"→"Chat 处理后展示文本"（`reasoningText()` 预处理，例如剥离 `**` 双星）。

| 你的 `text` 用途 | 迁移动作 |
|---|---|
| 直接渲染 Markdown / 塞进 DOM | 无动作——继续用 `text` 就是最新口径（官方 cot-translation 属此类） |
| 正则匹配原始模型标记（如 `<thinking>` / `**`） | **切 `rawText`**——`text` 已被 Chat 剥离 |
| 精确字数统计 / token 估算 | **切 `rawText`**——`text` 是展示版长度不等价 |
| 原文复制按钮 / 导出/分享 | **切 `rawText`**——用户预期复制的是原始输出 |
| 以 raw 为源做二次翻译 / 后处理 | **切 `rawText`**——除非你希望 Chat 预处理过后再翻 |

#### M2.b — 类型层：`ReasoningContentInput` 脱钩

`ReasoningContentInput` 不再 `extends ReasoningBodyOwnerProps`。若你曾依赖这条继承链做泛型约束：

```ts
// 反例（rc.5 起类型不通）
function factory<T extends ReasoningContentInput>(props: ReasoningBodyOwnerProps): T {
  return props;  // ❌ rawText 在 ContentInput 上不存在
}
```

改法：显式声明 Content Factory 输入 `{ text, running, labels? }`，Body Slot 消费者独立按新 `ReasoningBodyOwnerProps`（三字段）处理。

---

## 二、自查项（不必改但需知会）

### S1. Body Slot 官方 owner props 三字段化

- 旧：`{ text, running }`（`text` = raw）
- 新：`{ rawText, text, running }`（`rawText` = raw；`text` = 展示）

宿主内部 `ReasoningRow.tsx` 现先算 `reasoningText(rawText)` 得 `{ text, hidden }`，`hidden` 是"处理过后为空但原文非空"的整块隐藏标记；owner 向 slot 传三字段。**自定义 renderer 若曾按两字段解构 `props`**，rc.5 起会拿到额外 `rawText`，通常无害；若有严格 prop schema 校验（如 zod object strict 模式），需要把 `rawText` 加入白名单，否则会 reject。

### S2. `conversation.chat.reasoning.content` Factory 签名不变

Factory 输入仍是 `{ text, running, labels? }`（不新增 `rawText`）——Chat 的 `DefaultReasoningBody` 把处理后的 `text` 转交 Factory，第三方 wrapper 若继续调该 Factory 传的也应是展示版 `text`（或其翻译）。**别把 `rawText` 传给 Factory**——那会绕过 Chat 的预处理链路（如 `**` 剥离）。

### S3. 语言包文案锚

- 三语 README 从「preserve access to the **original text**」改「preserve access to the **untranslated text**」——若你的插件文案镜像了这条口径（少见），同步
- slot summary「Expanded reasoning body with the unchanged model text.」 → 「Expanded reasoning body with raw and display-ready text.」——若你的 UI 直接展示了 slot summary 原文，会自动跟随宿主

---

## 三、不受影响面（可放心）

- **闸门**：`plugin-compatibility.ts` / `compatibility-preflight.ts` 零 diff——engines.dsh 单独裁决、`requirements` 字段名、拒载记录形状与 rc.4 完全一致
- **Capability seams**：`docs/capability-seams.md` 零 diff——`ctx.*` 集合与 rc.4 全等
- **slot-catalog key 集合**：0 增删；rc.3 的 `sidebar.panellist.actions` / `conversation.session.header.views.actions` / `sidebar.right.tab.guide.actions` 三槽原样
- **SESSION_FORMAT_VERSION** = 4——历史会话文件读取无影响
- **settings 核心 / vendor cordis·schemastery**：零 diff
- **不注入 reasoning.body slot 的插件**：M2/M2.a/M2.b 全部跳过，只剩 M1 元数据枚举（若为枚举式）

---

## 四、迁移决策速查

| 场景 | 建议动作 |
|---|---|
| caret `^0.2.1-alpha.1` + 不注入 reasoning.body | **零改动** |
| caret `^0.2.1-alpha.1` + 注入 reasoning.body + `text` 只做展示 | **零改动**（可择期加 `rawText` 备用于新功能） |
| caret `^0.2.1-alpha.1` + 注入 reasoning.body + `text` 用作 raw | **改 M2.a 一处切 `rawText`** |
| 枚举式清单 + 不注入 reasoning.body | 只加 rc.5 行 |
| 枚举式清单 + 注入 reasoning.body 消费 `text` 当 raw | 加 rc.5 行 + M2.a + M2.b |
| 严格 prop schema 校验注入 body slot（zod strict 类） | M2.a + 加 `rawText` 到白名单 |

---

## 五、发版门禁自检补充（在 rc.4 V1-V6 基础上的差量）

rc.4 那版「契约面零 diff」→ V1-V6 全套照旧的结论**不适用 rc.5**——rc.5 有 slot 契约换代：

- **V-新1（slot 消费扫描）**：`grep -R 'conversation\.chat\.reasoning\.body' packages/*/src` 命中即走 M2.a/b；无命中记 V-新1=PASS
- **V-新2（Content Factory 泛型链）**：`grep -R 'ReasoningContentInput\|ReasoningBodyOwnerProps' packages/*/src` 命中且用了继承约束 → 走 M2.b
- **V-新3（严格 props schema）**：`grep -R 'z\.object.*strict\(\)' packages/*/src` 与 `ctx.slots.inject('conversation.chat.reasoning.body'` 交集 → 加 `rawText` 白名单

其余 V1-V6 与 rc.4 一致（同串枚举、双清单同步、engines.dsh 单独裁决、装机冒烟）。

---

## 六、复核命令模板

```bash
# 命中自查
grep -R "conversation\.chat\.reasoning\.body" packages/*/src
grep -R "ReasoningContentInput\|ReasoningBodyOwnerProps" packages/*/src

# 迁移前/后对照（宿主源码）
git show dsh-v0.2.1-rc.4:packages/client/ui-chat/src/client/contract/slots.ts \
  | sed -n '75,95p'
git show dsh-v0.2.1-rc.5:packages/client/ui-chat/src/client/contract/slots.ts \
  | sed -n '75,95p'

# 元数据同步与验证
node scripts/sync-hosts.mjs --write
node scripts/sync-hosts.mjs                    # 校验模式，退出码 0 = 一致

# 装机冒烟（desktop profile）
dsh plugin list | grep -i incompatible         # 期望空
```
