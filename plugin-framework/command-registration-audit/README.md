# DSH 客户端命令注册类型异常 — 案例复盘与检查工具

> 事故：`dsh-free-search@0.4.24` 把 `CommandContribution.description` 写成**字符串**，
> 导致 `/` 斜杠菜单里**所有命令一起消失**。
> 本文记录根因链、证据、影响面、复现方式，以及为这个 bug 类专门设计的检查工具。

---

## 一页速查表

| 项 | 内容 |
|---|---|
| **现象** | 控制台 `[ui-input-trigger] source "command" candidates failed: TypeError: contribution.description is not a function`；`/` 菜单里所有命令消失 |
| **根因** | 插件把 `description` 注册成**字符串**，契约要求 `() => string` |
| **抛出点** | `dsh-client-ui-commands/lib/client.js:651` → `description: contribution.description()` |
| **为什么注册时不报错** | `register()` 只查重名，**零类型校验**，contribution 原样入库 |
| **为什么影响面是"全部命令"** | 异常冒泡成 **source 级**失败，reducer 把整个 `command` 分组移除；分组清空即关菜单 |
| **正确写法** | `description: () => "…"`（函数）；`available` 必须是函数；`ui.kind` ∈ `popupSelect \| action` |
| **错误写法** | `description: "…"`；`description: SOME_CONST`（常量间接）；漏 `available` |
| **检查工具** | `tools/dsh-command-contract-audit.mjs`（L1 静态 + L2 运行时沙箱，双层） |
| **自测** | `node tools/selftest.mjs` → 16 passed |
| **当前状态** | `dsh-free-search@0.4.28`，与 npm 发布包 **sha256 逐字节一致**，L1/L2 均 0 findings |

---

## 1. 现象

浏览器控制台输出两行：

```
plugins/??@deepseek-…=f6c0f9c1836a:85673 [ui-input-trigger] source "command" candidates failed:
  TypeError: contribution.description is not a function
    at CommandUiRuntime.candidates (plugins/??@deepseek-…:86793:33)
```

伴随的用户可见症状：**在输入框敲 `/`，命令菜单是空的**（或只剩非命令来源的分组）。

注意力的坑：报错点在 `ui-commands` 与 `ui-input-trigger` 这两个**官方包**里，
而真正的缺陷在**第三方插件**的注册数据里。只看堆栈会误判为宿主 bug。

---

## 2. 根因：四步链

### 第 1 步 — 注册期：没有任何校验

`dsh-client-ui-commands/lib/client.js:553-565`

```js
register(contribution) {
  const dispose = this.ctx.effect(() => {
    const { contributions } = this.live;
    if (contributions.has(contribution.name))
      throw new Error(`ui-commands: duplicate contribution for /${contribution.name}`);
    contributions.set(contribution.name, contribution);   // ← 原样入库
    return () => { contributions.delete(contribution.name); };
  }, "command.register()");
  return () => { dispose(); };
}
```

只查重名。`description` 是字符串还是函数，**此刻完全看不出来**。
缺陷被静默接受，一直到用户第一次敲 `/` 才爆。

### 第 2 步 — 候选合成期：才去调用它

`dsh-client-ui-commands/lib/client.js:634-655`

```js
async candidates(session, req) {
  const list = await this.directory.ensureReady(session.sessionId, req.signal);
  const rows = [];
  const seen = new Set();
  for (const c of list) { … }                              // 宿主命令
  for (const contribution of this.live.contributions.values()) {
    if (!contribution.available(session)) continue;         // ← 也必须是函数
    if (seen.has(contribution.name))
      throw new Error(`ui-commands: contribution /${contribution.name} collides with a host command`);
    rows.push({
      name: contribution.name,
      description: contribution.description()              // ← 651 行，字符串这里炸
    });
  }
  return rankByName(rows.filter(…), req.query);
}
```

`candidates()` 是 `async`，所以同步 `TypeError` 变成 **rejected promise**，
不会当场冒泡到 UI 层，而是交给了下层触发器。

### 第 3 步 — 触发器：降级为"整个 source 失败"

`dsh-client-ui-input-trigger/lib/client.js:662-691`

```js
fetchCandidates(hit, roster) {
  …
  for (const source of roster) source.candidates(projection, { … }).then(
    (items) => { … this.reduce({ type: "source-settled", generation, source: source.name, items }); },
    (error) => {
      if (controller.signal.aborted) return;
      console.error(`[ui-input-trigger] source "${source.name}" candidates failed:`, error);  // 684
      this.reduce({ type: "source-failed", generation, source: source.name });
    });
}
```

**粒度是 source，不是 candidate。** 一个 contribution 抛异常，
整个 `command` source 被判失败——它无法区分"某一条坏了"和"这一路全坏了"。

### 第 4 步 — reducer：删掉整组，空了就关菜单

`dsh-client-ui-input-trigger/lib/client.js:227-238`

```js
case "source-failed": {
  if (!state.open || ev.generation !== state.generation) return state;
  if (!state.groups.some((g) => g.source === ev.source)) return state;
  const groups = state.groups.filter((g) => g.source !== ev.source);   // ← 整组移除
  if (groups.length === 0 || allReadyEmpty(groups)) return closed(state);  // ← 空则关菜单
  …
}
```

### 完整链

```
插件 description 写成字符串
        │
        ▼
register()  零校验，静默入库                       ← 缺陷被接受
        │
        ▼
用户敲 "/" → candidates()
        │  contribution.description() 同步抛 TypeError
        ▼
async 函数 → rejected promise
        │
        ▼
fetchCandidates 的 rejection handler
        │  console.error(...)                        ← 唯一线索，仅一行日志
        ▼
reduce({ type: "source-failed", source: "command" })
        │
        ▼
reducer 把整个 "command" 分组 filter 掉
        │
        ▼
groups 为空 → closed(state) → 菜单空白
```

---

## 3. 契约：正确写法

来源：`dsh-client-ui-commands/lib/types/client/contract.d.ts`

```ts
export interface CommandContribution {
  /** 命令名，不含前导斜杠；跨 contribution 唯一 */
  readonly name: string;
  /** 候选请求时解析本地化菜单文案 —— 必须是函数 */
  readonly description: () => string;          // ← :62
  /** 能力过滤，每次候选都用新投影调用一次 */
  available(session: ClientSessionContext): boolean;
  /** UI 行为 */
  readonly ui: CommandUiSpec;
}

export interface CommandDecoration {           // ← :77-84
  readonly name: string;                       //   注意：没有 description！
  available(session: ClientSessionContext): boolean;
  readonly ui: CommandUiSpec;
}

export type CommandUiSpec =
  | { kind: 'popupSelect'; options(s, signal): Promise<readonly SelectOption[]>; onSelect(o, s): void | Promise<void> }
  | { kind: 'action';      run(session): void };
```

| 字段 | 要求 | 常见错误 |
|---|---|---|
| `name` | 非空字符串，跨 contribution 唯一 | 与宿主命令重名（会在候选合成期 throw） |
| `description` | **函数**，返回 string | ❌ 直接写字符串；❌ 写常量/变量间接传字符串 |
| `available` | 函数，返回 boolean | ❌ 省略（`candidates()` 无条件调用它） |
| `ui.kind` | `'popupSelect'` 或 `'action'` | ❌ 拼错；❌ 缺 `ui` |
| `popupSelect` | 必须有 `options` + `onSelect` | ❌ 只写 `options` |
| `action` | 必须有 `run` | ❌ 写 `onSelect` |
| `decorate()` | **不得**带 `description` | ⚠️ 冗余字段，通常意味着本想用 `register()` |

对照本案例：

```js
// ❌ 0.4.24 —— 崩溃
command.register({
  name: "free-search-engine",
  description: "切换搜索引擎 / Switch web search engine",
  available: () => true,
  ui: { kind: "popupSelect", options: async () => [...], onSelect: async (o) => {...} },
});

// ✅ 0.4.25+ —— 只多了两个字符
command.register({
  name: "free-search-engine",
  description: () => "切换搜索引擎 / Switch web search engine",
  available: () => true,
  ui: { kind: "popupSelect", options: async () => [...], onSelect: async (o) => {...} },
});
```

上游在 0.4.25 的修复处留了注释（0.4.28 中位于 `lib/client.js:1055-1057`）：

```js
// description 必须传函数：ui-commands 读回的是 contribution.description()，
// 传字符串会抛 TypeError: contribution.description is not a function；该异常
// 会让整份 "/" 候选列表一起失败，菜单空白、其他命令也一起点不到。
```

---

## 4. 证据链

### 版本对比（npm 发布包 vs 本地安装）

| 版本 | `description` 写法 | 结果 |
|---|---|---|
| `0.4.24` | `description: "…"`（字符串） | ❌ 触发本事故 |
| `0.4.25` | `description: () => "…"` | ✅ 上游正式修复 |
| `0.4.28` | `description: () => "…"`（`lib/client.js:1063`） | ✅ 本地当前版本 |

### 本地安装完整性校验（2026-09-18 实测）

```
sha256 本地   : 86752BB91A1DB50AA25B39D0B06B3F33D7D351CF99CFDB1B0EC502C0CA0DDE6E
sha256 上游   : 86752BB91A1DB50AA25B39D0B06B3F33D7D351CF99CFDB1B0EC502C0CA0DDE6E
profile 依赖  : "dsh-free-search": "^0.4.28"
```

→ 本地文件与 npm 发布包**逐字节一致**，不存在手工补丁残留。
（排查期间曾对 `node_modules` 做过一次手工热修作为临时规避；
现已由正规升级覆盖，`node_modules` 中无未版本化改动。）

### 该插件注册了什么

`dsh-free-search/lib/client.js`（0.4.28）：

| 位置 | 注册内容 | 类型 |
|---|---|---|
| `:1041-1052` | `settings.plugin.item`（key `free-search`） | 设置页插槽，**不是命令** |
| `:1058-1085` | **命令 `/free-search-engine`** | `commandUi.register()`，`ui.kind = "popupSelect"` |

`/free-search-engine` 的语义：输入 `/` 选中后弹出引擎列表，
点选即写入 provider 配置（走自建 bridge `/api/dsh-free-search-settings`）。
`options()` 返回 12 个引擎条目，`onSelect()` 执行 `bridgeMutate({ ns, ops:[{op:"set", path:["provider"], value: option.id}] })`。

全 profile 范围内，**它是唯一的第三方 popupSelect 贡献**。

### 时间线

| 时间 | 事件 |
|---|---|
| `2026-09-10T07:22:49.943Z` | 市场安装 `dsh-free-search`（`log.ndjson`: `exit=0 hot=false`） |
| `2026/9/18 05:53:18` | DSH web 进程启动（PID 22228），加载 0.4.24 缺陷版 |
| （期间） | 用户敲 `/` → 复现本异常 |
| `2026/9/18 06:20:25` | 手工热修 `lib/client.js`（临时规避） |
| `2026/9/18 06:42:00` | 升级到 `0.4.28` 并重启宿主（PID 18208） → **修复生效** |

---

## 5. 为什么"磁盘已修好"浏览器还报错

这是本次排查里最容易误判的一环。两个独立机制叠加：

**① 进程不重启 = 旧代码还在跑。**
DSH 客户端插件的生命周期约束：**插件更新只在宿主启动期生效**，没有热加载。

**② 浏览器按内容哈希做了不可变缓存。**
`dsh-client-modules/lib/index.js`：

```js
const rev = revision ?? framedHash("combo", [sourceBytes, sourceMap]);   // :302 内容哈希
…
"cache-control": IMMUTABLE_CACHE                                          // :866
```

`/plugins/??<ids>&rev=<hash>` 的 `rev` 由**文件内容**决定。服务端每次请求确实
`readFileSync`，但浏览器把带 `rev` 的 URL 当作**永久可缓存**——
内容一变，URL 就变，缓存才会失效。

所以：**手工改文件既不改已服务的 `rev`，也不触发 HMR**。
`dsh-client-hmr` 常驻但对文件系统改动无感，只在 `pnpm run dev:web` 真正重建
客户端 bundle 时才动作。改完必须**重启宿主 + 浏览器硬刷新（Ctrl+Shift+R）**，
普通 F5 会命中强缓存。

---

## 6. 影响面

`/` 触发器上共有 3 个 source：

| source | 提供方 | order |
|---|---|---|
| `command` | `@deepseek-ai/dsh-client-ui-commands` | 默认 |
| `context` | `dsh-context` | 1 |
| `skill` | `@deepseek-ai/dsh-client-ui-skill` | 2 |

失败的是 `command` 这一路，它是**宿主命令 + 全部客户端 contribution 的合并出口**。
所以症状不是"free-search 那条命令没了"，而是：

- 所有内置斜杠命令（`/compact`、`/plan`、`/goal`、`/permission`…）消失
- 所有第三方客户端命令消失
- 只剩 `context` / `skill` 两个分组（若它们本身没内容，菜单就是空白）

且**没有任何用户可见提示**——只有一行 `console.error`。
这是本 bug 最恶劣的地方：**故障模式是静默的全量降级**。

---

## 7. 复现与验证

**复现**（不需要真的装 0.4.24）：工具自带的 fixture 就是触发体。

```powershell
cd E:\test\rewrite-agently\dsh-docs-deliverables\plugin-framework\command-registration-audit
node tools\selftest.mjs
```

`fixtures\bad-string-description` 精确复刻 0.4.24 的注册数据。

**验证当前环境是否干净**：

```powershell
node tools\dsh-command-contract-audit.mjs --profile web --include-official
```

期望：`RESULT: PASS`（或仅剩 `RUNTIME_PROBE_INCONCLUSIVE` 这类"无法证明"的警告），
`dsh-free-search` 一行 `L1:1 sites/0 findings  L2:1 registrations/0 findings`。

---

## 8. 现状与修复

- ✅ 本地已是 `dsh-free-search@0.4.28`，与 npm 发布包 sha256 一致
- ✅ 宿主已重启（`2026/9/18 6:42:00`），新 bundle 生效
- ✅ 工具扫描：`dsh-free-search` L1/L2 均 0 findings
- ✅ 5 个官方 `commandUi` 消费方 L2 全部可运行，0 error

**需要用户手动确认的一步**：浏览器硬刷新（`Ctrl+Shift+R`）。
Agent 不代执行宿主重启与浏览器硬刷新。

---

## 9. 检查工具

见 [`AUDIT-TOOL.md`](./AUDIT-TOOL.md)。

```powershell
node tools\dsh-command-contract-audit.mjs --profile web --include-official
node tools\dsh-command-contract-audit.mjs --roots <node_modules 路径> [--json]
node tools\selftest.mjs
```

---

## 10. 防范清单

**插件作者**

1. `description` 永远写箭头函数，别写字符串——哪怕它看起来"只是个常量"。
2. 用 TypeScript，让 `CommandContribution` 的类型检查挡在前面；
   本 bug 在 TS 下是**编译期错误**。
3. 注册前自检：`typeof description === 'function'`，`typeof available === 'function'`。
4. 把 `tools/dsh-command-contract-audit.mjs` 挂进发布前流程。

**使用方（装机后）**

1. 新装/升级插件后，跑一次 `dsh-command-contract-audit --profile <name>`。
2. 记住生效三步：**卸载重装 → 重启宿主 → 浏览器硬刷新**。
3. 看到 `[ui-input-trigger] source "…" candidates failed` 时，
   别只看堆栈最上层——**去查那个 source 挂了哪些第三方 contribution**。

**宿主（可作为上游改进建议）**

1. `register()` 里加廉价断言：`description`/`available` 非函数直接 throw，
   让缺陷在**注册期**暴露（带插件名），而不是在用户敲 `/` 时。
2. `candidates()` 逐条 try/catch，让"一条坏"降级为"一条不显示"，
   而不是整个 source 失败。
3. `ui-input-trigger` 的 `source-failed` 目前只 `console.error`；
   建议同时向 UI 暴露一个"某来源加载失败"的可诊断信号。
