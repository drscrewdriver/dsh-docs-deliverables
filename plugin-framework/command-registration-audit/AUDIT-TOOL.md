# 工具设计：`dsh-command-contract-audit`

> 目标：把"`register()` 时静默、敲 `/` 时才炸"这一类**客户端命令注册契约缺陷**
> 提前到发布前 / 装机后暴露，并给出可定位到行号的报告。

- 主程序：`tools/dsh-command-contract-audit.mjs`（单文件，零依赖，Node ≥ 20）
- 自测：`tools/selftest.mjs` → `16 passed`
- 案例复盘：[`README.md`](./README.md)

---

## 1. 为什么不能只做静态检查，也不能只做运行时检查

| 方案 | 能做什么 | 致命短板 |
|---|---|---|
| 纯静态（正则/AST） | 快、无副作用、能定位行号 | `description: SOME_CONST` 无法判定；压缩/包装/间接赋值一律漏 |
| 纯运行时（真装真跑） | 权威 | 要起宿主、要浏览器、要人工点 `/`，无法进 CI |
| **双层（本工具）** | 静态定位 + 沙箱实证 | 需要维护 mock，存在 `INCONCLUSIVE` 语义 |

因此设计成两层，**各自输出 findings，互不掩盖**：

- **L1 静态扫描** — 在源码文本上定位 `register()/decorate()` 对象字面量，
  分类 `description` / `available` / `ui.kind` 的**字面形态**。
- **L2 运行时探针** — 在 `node:vm` 沙箱里加载真实 client bundle，
  用**录制型 `ctx`** 真的跑一遍 `apply(ctx)`，校验**捕获到的 contribution 对象**。

L2 不是"再检查一遍"，而是**唯一能穿透间接赋值的那一层**：

```
bad-const-description  fixture
  L1 → WARN  DESCRIPTION_NOT_OBVIOUSLY_FUNCTION   （只能存疑）
  L2 → ERROR …`description` is string…            （给出结论）
```

---

## 2. L1：静态扫描

### 2.1 词法层

自带一个字符串/模板/注释/正则感知的扫描器，不依赖 acorn 等外部解析器：

| 函数 | 作用 |
|---|---|
| `skipNonCode` | 跳过注释 / 字符串 / 模板 / 正则（**会消费字面量**） |
| `skipWsAndComments` | 只跳空白与注释（**不消费字面量**）—— 见下方"踩过的坑" |
| `matchBalanced` | 括号配对，返回闭合符后一位 |
| `readValueEnd` | 从值起点走到深度 0 的 `,` 或闭合符 |
| `parseTopLevelProps` | 解析对象字面量的**顶层**属性 `{key, raw}` |
| `readObjectAt` | 取 `{…}` 对象体（自动剥掉 `(...)` 包裹） |

### 2.2 定位注册点

```js
/([A-Za-z_$][\w$]*)\s*\.\s*(register|decorate)\s*\(/g
```

再判断"这看起来是不是 command 注册"，满足任一即为是：

1. 接收者是 `commandUi`；
2. 接收者绑定自 `...get("commandUi")`（含 `const { commandUi } = ctx` 解构）；
3. 参数对象含 `ui: { kind: "popupSelect" | "action" }`。

第 3 条是兜底，用来覆盖静态推导不出接收者的写法。

### 2.3 值分类

`classifyValue(raw)` → `function | string-literal | template | identifier | number | literal | other | missing`

- `(` 开头时，要找到配对 `)` 再看后面是不是 `=>`——否则 `("x")` 会被误判成箭头函数。
- 模板串含 `${}` 归为 `template`（**运行时才知道结果**），不含则归 `string-literal`。

---

## 3. L2：运行时沙箱探针

### 3.1 加载路径

DSH client bundle 的统一外壳：

```js
window.__ModuleLoader__.load({
  id: "dsh-free-search",
  factory: (require) => { var module = {exports:{}}; var exports = module.exports; …; return module.exports; },
});
```

所以沙箱只需：

```js
const entries = [];
const sandbox = buildSandbox(entries);          // window.__ModuleLoader__.load 收集条目
vm.runInContext(src, vm.createContext(sandbox), { filename, timeout: 10000 });
const exportsObj = entries[0].factory(makeRequireShim());   // 真跑工厂
exportsObj.apply(makeCtx('apply'));                          // 真跑 apply
```

### 3.2 录制型 `ctx`

`makeCtx()` 返回的代理里，`get("commandUi")` 命中**录制器**：

```js
const recorder = {
  register(c) { records.push({ api: 'register', v: c }); return () => {}; },
  decorate(d) { records.push({ api: 'decorate', v: d }); return () => {}; },
};
```

关键点：

- `ctx.effect(fn, label)` **立即执行** `fn` —— 插件普遍把注册写在 effect 里；
- `ctx.inject(deps, cb)` **立即以子作用域调用** `cb` —— 候选注册路径必须走到；
- `ctx.slots.inject(name, cb)` 立即调用 `cb`；
- 其余未知成员返回"魔法值"（见 3.3）。

同时记录 `exports.inject`：若插件声明依赖 `commandUi` 却一条注册都没捕获到，
报 `note`（注册可能发生在懒加载/组件内部）——**不假装通过**。

### 3.3 魔法值（`magicFor`）

沙箱里真实依赖一律不可用，用一个代理顶替：

- 可调用（`apply`）、可 `new`（`construct`）；
- 任意属性访问返回同族魔法值，**按路径缓存保证 `a.b === a.b`**；
- **`then` 必须返回 `undefined`**，否则 `await` 会挂死；
- `Symbol.iterator` 返回无限生成器，让 `const [a, b] = magic` 不抛；
- `Symbol.toPrimitive` 返回 `() => 0`；
- `getPrototypeOf` 返回 `magicProto()` —— **这一条是关键**，见下。

### 3.4 两个真实踩过的坑（都写在工具注释里了）

**坑 1 —— `skipWsAndComments` 不能消费字符串。**
最初它复用 `skipNonCode`，于是解析 `name: "free-search-engine"` 时，
跳到值起点后又被"跳过字符串"逻辑直接吞掉，`raw` 变成空串，
所有字符串值都读成 `missing`。修法：拆成两个函数，语义分开。

**坑 2 —— esbuild 的 `__toESM` 会把魔法值掏空。**
官方 bundle 里有：

```js
let react = require("react");
react = __toESM(react, 1);
```

而 `__toESM` 的实现是
`Object.create(Object.getPrototypeOf(mod))` + 只拷贝 **own** 可枚举属性。
魔法值是一个**函数**，own 属性只有 `length/name/prototype`，
于是 `react.memo` 变成 `undefined` → `(0, react.memo) is not a function`，
整包探针作废（表现为 `RUNTIME_PROBE_INCONCLUSIVE`）。

修法：给魔法值加 `getPrototypeOf` trap，返回一个"什么属性都有"的
`magicProto()`。这样 `Object.create(magicProto)` 出来的对象，
属性查找会沿原型链落到魔法原型上，具名导出就活下来了。

> 结论：L2 的成败几乎全在 mock 的**诚实度**。mock 撒的谎会变成假阳性，
> 所以每个断言都先做 `isMagic()` 判定——**拿不到真值就报"未证明"，绝不当成"合规"。**

### 3.5 假阳性防护

`MAGIC_TAG`（`Symbol.for('dsh.command-audit.magic')`）给每个魔法值打标记，
`isMagic(v)` 一句话判定。校验时：

| 断言 | 遇到魔法值 |
|---|---|
| `description()` 返回非 string | → `WARN` "real localizer unavailable, type unproven"，**不是 error** |
| `options()` 返回非数组 | → `WARN` "shape unproven"，**不是 error** |
| `available()` 返回非 boolean | 静默跳过（不产生噪音） |

真实例证：官方 `dsh-client-ui-model-selection` 的
`description: () => t("command.description")`，
`t` 来自 `locale.bind()`，在沙箱里是魔法值 → 报 WARN 而非误判 ERROR。

---

## 4. 检查项清单

### L1（静态）

| 级别 | 代码 | 触发条件 |
|---|---|---|
| ERROR | `MISSING_DESCRIPTION` | `register()` 对象无 `description` |
| ERROR | `DESCRIPTION_IS_STRING` | `description` 是字符串字面量 / 无插值模板串 |
| WARN | `DESCRIPTION_NOT_OBVIOUSLY_FUNCTION` | 分类为 `identifier`/`other` —— 静态不可判定 |
| ERROR | `MISSING_AVAILABLE` | `register()` 或 `decorate()` 对象无 `available` |
| WARN | `AVAILABLE_NOT_FUNCTION` | `available` 非函数形态 |
| WARN | `DECORATION_HAS_DESCRIPTION` | `decorate()` 带了 `description`（该字段不属于 `CommandDecoration`） |
| ERROR | `MISSING_UI` | 无 `ui` 字段 |
| ERROR | `BAD_UI_KIND` | `ui.kind` 缺失或不在 `{popupSelect, action}` |
| ERROR | `POPUPSELECT_MISSING_OPTIONS` / `_ONSELECT` | `kind: popupSelect` 缺回调 |
| ERROR | `ACTION_MISSING_RUN` | `kind: action` 缺 `run` |

### L2（运行时，在**捕获到的对象**上）

| 级别 | 代码 | 触发条件 |
|---|---|---|
| ERROR | `RUNTIME_REGISTER` / `RUNTIME_DECORATE` | 名称非字符串、`description` 非函数、`available` 非函数、`ui` 非法、`description()`/`available()` 抛错、`options()` 解析后非数组、`SelectOption` 缺 `id`/`label`、未知选项键 |
| WARN | `RUNTIME_REGISTER` / `RUNTIME_DECORATE` | 魔法值导致"未证明"；`decorate()` 带 `description`；`options()` 在 mock 下 rejected |
| WARN | `RUNTIME_PROBE_INCONCLUSIVE` | 工厂/`apply` 抛错、无 `__ModuleLoader__`、无 `apply` —— **工具自己的失败，如实上报** |

---

## 5. 发现流程

```
--roots / --profile
        │
        ▼
枚举 node_modules 下的包（含 @scope/name）
        │  package.json 可读？
        ▼
resolveClientEntry()
        │  候选：exports["./client"] 的 default/import/require（**排除 .d.ts**）
        │        lib/client.js → dist/client.js → client.js
        │  逐个读，**优先返回含 __ModuleLoader__ 的那一个**
        ▼
含 __ModuleLoader__ ？ ── 否 ──▶ 不是 client bundle，跳过
        │ 是
        ▼
.dsh-market/state.json 的 disabled 列表？ ── 是 ──▶ 跳过（并说明原因）
        │ 否
        ▼
含 "commandUi" ？ ── 否 ──▶ 跳过（并说明原因）
        │ 是
        ▼
L1 静态扫描 ──▶ L2 沙箱探针 ──▶ 汇总
```

`.d.ts` 排除 + `__ModuleLoader__` 优先这两条是**必需的**：
官方包 `exports["./client"]` 是 `{ types: "…/index.d.ts", default: "…/client.js" }`，
按 `Object.values` 顺序取第一个存在文件会命中 `.d.ts`，导致官方插件全部扫不到
（实测：修前 0 discovered，修后 55 discovered）。

---

## 6. 输出与退出码

- 人类可读报告（默认）：扫描摘要 + 每个包的 L1/L2 计数 + 逐条 findings（含 `文件:行号`）。
- `--json`：结构化报告，字段 `summary / scanned / skipped / findings`，供 CI 消费。
- `--verbose`：额外列出每个被跳过的包及原因（**跳过必须有理由**，否则"没报错"没有意义）。

| 退出码 | 含义 |
|---|---|
| `0` | 无 ERROR（可能有 WARN） |
| `1` | 至少一条 ERROR |
| `2` | 用法 / 环境错误（找不到 profile、fatal） |

---

## 7. 用法

```powershell
# 默认：扫描所有 ~/.dsh/profiles/<name>
node tools\dsh-command-contract-audit.mjs

# 只扫 web profile
node tools\dsh-command-contract-audit.mjs --profile web

# 叠加官方内置 @deepseek-ai 客户端插件
node tools\dsh-command-contract-audit.mjs --profile web --include-official

# 扫任意 node_modules 根目录
node tools\dsh-command-contract-audit.mjs --roots "C:\path\to\node_modules"

# 只看某个包
node tools\dsh-command-contract-audit.mjs --profile web --only dsh-free-search

# 跳过运行时探针（快，但漏间接赋值）
node tools\dsh-command-contract-audit.mjs --static-only

# CI 用
node tools\dsh-command-contract-audit.mjs --profile web --json
```

---

## 8. 自测

```powershell
node tools\selftest.mjs
```

4 个 fixture，覆盖三层含义：

| fixture | 用途 | 期望 |
|---|---|---|
| `good-function-description` | 正确写法（复刻 0.4.28） | **0 error / 0 warn**（无假阳性） |
| `bad-string-description` | 复刻 0.4.24 原案 | L1 `DESCRIPTION_IS_STRING` + L2 error |
| `bad-const-description` | 常量间接 | L1 **无 error**（仅 WARN）+ L2 error ← **分层价值的证明** |
| `bad-decorate-description` | `decorate()` 误用 | L1 `MISSING_AVAILABLE` + `DECORATION_HAS_DESCRIPTION` |

实测结果：`16 passed, 0 failed`。

---

## 9. 已知边界

1. **L2 是尽力而为的沙箱**，不是真实浏览器。真实依赖不可用，
   依赖运行时数据的 `options()` 会 rejected（记为 WARN，属正常）。
2. **`INCONCLUSIVE` 不等于通过。** 它明确表示"工具没能证明"。
   报告里必须区分"0 findings"和"没跑起来"。
3. **不认识动态注册。** 若插件在组件渲染时才 `register()`，
   `apply()` 阶段捕获不到，工具会输出 `note:` 提示人工确认。
4. **魔法值缓存无上限**（按属性路径增长）。扫描数十个包无压力；
   若要扫上千包需换成有界缓存。
5. **不替代 TypeScript。** 用 TS 的插件在编译期就能挡住本类 bug；
   本工具面向的是**没有类型检查的产物**（已发布的 JS bundle、他人插件）。
6. **L1 的正则启发式**（尤其是正则字面量判定）可能对极端代码失手，
   此时 L2 是安全网。

---

## 10. 建议接入点

| 场景 | 命令 |
|---|---|
| 插件发布前（本仓 CI） | `--roots ./node_modules --json`，`exit 1` 阻断 |
| 装机后自检 | `--profile web --include-official` |
| 排查 `/` 菜单异常 | `--profile web --verbose`，先看 `commandUi` 消费方 |
| 上游回归防护 | 把 fixture 集纳入宿主仓库的单测 |
