# 插件多语言适配指南（zh / en 内置 + ja / ko 等第三语言）

> **适用**：DSH `0.1.2-rc.1` ~ `0.1.5-rc.x` 的 Web 客户端插件。
> **数据源（权威源，非推断）**：`@deepseek-ai/dsh-client-locale` 类型声明（本机 `~/.dsh/profiles/node_modules/@deepseek-ai/dsh-client-locale` = `0.1.2-rc.1`；`dsh` CLI 内嵌副本同版）+ `mine-dsh-plugins/*` 五个插件的实际代码。
> **配套**：[client-ui-extension-seams.md](client-ui-extension-seams.md)（接缝实证）、[dsh-plugin-template/](dsh-plugin-template/)（骨架）。

---

## 0. 先记住一件事：这是**两件独立的事**

插件要"支持日语/韩语"，必须同时满足两个条件，缺一个都不生效：

| # | 谁负责 | 做什么 | 不做的后果 |
|---|--------|--------|-----------|
| ① | **你的插件** | 把字典按语言拆开并 `ctx.locale.register` 注册 | 选到 ja/ko 时显示英文（回退链）或直接显示 key |
| ② | **语言包插件** | 用 `ctx.locale.addLanguage({id:'ja',...})` 把 ja/ko 放进可选语言目录 | **字典已装载但用户根本选不到 ja/ko**（stock DSH 的 `LOCALE_IDS` 只有 `["zh","en"]`） |

> **本仓库现状实证**：`dsh-perm-gate` 与 `dsh-thinking-levels` 都已经 ship 了 zh/en/ja/ko **四语**字典，但在未装语言包的 stock DSH 上，设置页 Language 行只有 中文 / English —— `dsh-perm-gate/AGENTS.md` 原文记录了这条：
> "official DSH `LOCALE_IDS` is `["zh","en"]`, so `ctx.locale.register` accepts only `{ zh, en }` — the `ja` / `ko` dictionaries ship but cannot be selected on stock DSH."
>
> 装上 `@huanlin/dsh-plugin-better-locale`（19 语言语言包，含 ja/ko）之后，ja/ko 变成可选语言，**你的插件无需改一行代码**，已注册的字典立刻生效。

---

## 1. 体系契约（照抄上游类型声明，不要按经验猜）

来自 `dsh-client-locale` 的 `LocaleRuntime`：

| 成员 | 签名 | 关键约束 |
|------|------|----------|
| `LOCALE_IDS` | `readonly ["zh","en"]` | **内置**语言只有两个；`BuiltInLocaleId = 'zh' \| 'en'` |
| `LocaleId` | `string` | 开放类型：语言包插件可注册任意 BCP 47 风格 tag |
| `register(ns, dicts)` | `(ns, Record<BuiltInLocaleId, Dict>) => disposer` | **类型化重载**。ns 必须已被合并进 `LocaleNamespaceMap`；**每个内置 locale 都必须提供**（双语均衡，注册时强制）；`(ns, locale)` 重复注册 **throw**（一个命名空间一个占用者） |
| `register(ns, locale, dict)` | `(string, string, Dict) => disposer` | **单语非类型化重载**，供语言包贡献与合并表外命名空间使用；`locale` 不是 BCP 47 风格 tag 即 throw |
| `bind(ns)` | `(ns) => Translate` | 返回的引用**每命名空间稳定**（重复 bind 返回同一函数），可安全塞进 inject 面而不破坏 memo |
| `addLanguage(input)` | `({id, label, fallback}) => disposer` | 语言包专用：把一个可选语言加入共享目录。`fallback` **必须已注册**且整条 fallback 链**必须终止于 `en`**；id 被占用 / fallback 未知 / 成环 → throw。返回**幂等 disposer**；移除当前激活语言时回退但不清理已存偏好 |
| `setLocale(id)` | `(id) => void` | 未知 id **throw** |
| `getSnapshot` / `subscribe` | LocaleFace | uSES 安全；**注册字典也会 bump revision**，所以已挂载的 outlet 能拾取"迟到的字典"（懒加载 / 异步语言包可行） |

**查找链（决定"漏译会长什么样"）**：

```
active locale → 该语言的 fallback 链（在 entry 命名空间内）
              → 同一条链再走一遍共享 `common` 命名空间
              → 仍miss → 显示 key 本身
```

即：**漏译不会显示空白，会显示 key 字符串** —— 这反而是最好的漏译自检信号。

---

## 2. 插件侧适配：五步

### Step 1 — 字典文件：zh 是 key 集真源

单文件四语（`dsh-perm-gate` / `dsh-thinking-levels` 的做法，key 集小、同步成本低）：

```ts
/** `dsh-perm-gate` client dictionaries (zh / en / ja / ko). */
export const NS = 'dsh-perm-gate'

/** 键集真源：zh。 */
export const zh = { 'card.title': '自动审查', /* ... */ }

/** 其余语言镜像 zh 的键集 —— 缺键 / 多键都是**编译错误**。 */
export const en: Record<keyof typeof zh, string> = { /* ... */ }
export const ja: Record<keyof typeof zh, string> = { /* ... */ }
export const ko: Record<keyof typeof zh, string> = { /* ... */ }
```

多文件分语言（`DSH-better-sidebar` 的 21 词典做法，key 集上百）：`locales.ts`（zh+en 双块）+ `locales-ja.ts` / `locales-ko.ts` …，靠 `tests/locales.spec.ts` 断言"第三方词典键集与 zh 相等"当门禁。

> **底线两条**：① zh 是唯一真源；② 其余语言必须带 `Record<keyof typeof zh, string>` 类型标注（或测试门禁），否则漏译只会静默回退英文，永远发现不了。

### Step 2 — 注册（`ctx.effect` + disposer，HMR 安全）

```ts
export const inject = ['slots', 'locale']   // 只声明**必有**服务

export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    const disposers = [
      ctx.locale.register(NS, { zh, en }),   // 类型化：zh/en 必须成对
      ctx.locale.register(NS, 'ja', ja),     // 单语重载：第三语言
      ctx.locale.register(NS, 'ko', ko),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }, '<your-plugin>: dictionaries')
}
```

`dsh-thinking-levels/src/client/index.ts:35-42` 就是这样写的，其注释把语义说得很清楚：

> `register(ns, dicts)` is typed to the built-in locale ids (`zh` / `en` only); the shipped `ja` / `ko` dictionaries go through the single-locale overload, so they are installed and ready **once DSH publishes those ids**.

**必须走 `ctx.effect`**：`register` 返回幂等 disposer，但重复 `(ns, locale)` 注册会 throw —— 不走 effect 的话，HMR / 二次 apply 直接崩。

### Step 3 — 取 t + 让文案实时跟随

```ts
const t = ctx.locale.bind(NS)              // 稳定引用，可反复调用

ctx.slots.register({
  name: 'settings.plugins.tab',
  id: PLUGIN_NS,
  order: 50,
  label: () => t('card.title'),            // ← 传**函数**，切语言时重算
  locale: NS,                              // ← 让宿主注入的 t seat 也落到你的域
}, Card)
```

- `label` 传**字符串** = 切语言后不更新；传 `() => t(...)` 才实时。
- `locale: NS` 是你卡片内 `inject` 面里 `t` 的来源域（`dsh-perm-gate/src/client/index.ts:114-127`）。

### Step 4 — 类型合并（类型化重载的前置条件）

第三方命名空间不在 DSH 的合并表里，必须自己声明，否则 `register(ns, {zh,en})` 与 `bind(ns)` 的类型都对不上：

```ts
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'dsh-perm-gate': PermissiveKey          // 你的 key union
  }
}
```

（`dsh-perm-gate/src/client/index.ts:37-40`、`dsh-thinking-levels/src/types/contracts.d.ts:22`、`dsh-input-traffic/src/types/contracts.d.ts:75` 均此法。）

### Step 5 — 跨版本 / 跨环境守卫（可选但推荐）

客户端**声明式注入可选服务缺失会让 `apply` 永久挂起、UI 静默消失**（见 [README.md](README.md) v0.1.5 适配重点）。要兼容极老宿主或不确定 locale 服务是否存在时，用懒取 + 能力探测：

> ⚠️ 2026-09-17 校准：`locale` 在 ≥0.1.2 全线是 shell 常备服务（由 dsh-client-locale 提供）——主流场景**直接声明式 `inject = [..., 'locale']`** 即可，懒取只在"确认目标宿主可能根本不提供 locale"的极端兼容场景使用（懒取本身有激活竞态风险，见 [settings-seat-pinning.md](settings-seat-pinning.md)）。

```ts
const locale = ctx.get('locale') as { register?: (...) => () => void } | undefined
if (locale !== undefined && typeof locale.register === 'function') {
  ctx.effect(() => locale.register(NS, { zh, en }), '<plugin>: dictionaries')
}
```

`dsh-session-steward/src/client/index.ts:127`、`dsh-session-search-toggle/src/client/index.ts:563` 采用此法。

---

## 3. 语言包侧：让 ja/ko 变成"可选语言"

只有当你要**自己提供可选语言**（而不是只翻译自己的插件）时才需要这一步：

```ts
ctx.effect(() => ctx.locale.addLanguage({
  id: 'ja',
  label: '日本語',          // 用该语言自己书写
  fallback: 'en',           // 必须已注册，且链必须终止于 en
}), '<plugin>: ja language')
```

- 返回的是**幂等 disposer**，交给 `ctx.effect` 即可正确回收（卸载当前激活语言 → 回退，但不清理已存偏好）。
- `id` 被占用 / `fallback` 未知 / 成链成环 → **throw**，失败是响亮的。

**推荐路径：直接装 `@huanlin/dsh-plugin-better-locale`**（v0.4.3，19 语言 ja/ko/fr/de/…，链到 en，DSH ≥ `0.1.5-rc.1`）。它做的事就是替所有人调用 `addLanguage` + 注册 DSH 内置命名空间字典。

> ⚠️ **已废弃的老做法，不要再用**：`better-sidebar` 0.1.x 时代靠 monkey-patch `LocaleRuntime.prototype.lookup` + 借用 DSH 英文槽位 + 自建 "Language override" 设置行（localStorage 持久化、仅在 DSH=en 时生效）。DSH `v0.1.2-alpha.1` 把这一切原生化后，该设置行与 `ctx.betterLocale` 服务都被上游删除。新插件一律走 `addLanguage` + `register`。

---

## 4. 边界与已知坑

| 坑 | 事实 | 应对 |
|----|------|------|
| **第三方文案不被语言包覆盖** | better-locale 明确声明"Third-party plugins are out of scope by design"：它只翻 DSH 内置命名空间（当前 39 ns / 1233 keys × 19 语） | 你的插件**必须自带**字典；别指望语言包替你翻 |
| **JA/KO 词典在 stock DSH 上不可选** | `LOCALE_IDS = ["zh","en"]` | 文档里如实写清（`dsh-perm-gate` 的 README 四语版均带此兼容性说明） |
| 双语不均衡 | 类型化 `register(ns, dicts)` 要求**每个内置 locale 都在** | zh/en 永远成对 ship |
| 重复注册 | 同 `(ns, locale)` 第二次注册 **throw** | 一律包 `ctx.effect` 并返回 disposer |
| 静态 label | 传字符串的 `label` 不跟随切换 | 一律 `label: () => t('key')` |
| 变体语言 | 繁中/地区变体应表达为 **fallback 链**（`zh-TW → zh → en`），不是字典内容 | 用 `addLanguage` 的 `fallback` 字段 |
| 客户端 bundle 纯度 | value-import `@deepseek-ai/*` 会破纯度门 | 只 `import type`；协作走 cordis 服务与 slot |
| 依赖他插件内部 i18n | 官方指南 §10：**不得**依赖 better-sidebar 内部 `t()` | 只依赖 `ctx.locale` 公开服务 |

---

## 5. 验证清单（可执行，别只看代码）

- [ ] **编译期**：随便删掉 en/ja/ko 里一个 key → `pnpm typecheck` / `npm run typecheck` 必须变红（`Record<keyof typeof zh, string>`）。
- [ ] **注册期**：`ctx.locale.register` 的每个 disposer 都在 `ctx.effect` 里；重复 apply 不抛 `(ns, locale)` 重复注册错误。
- [ ] **运行期（有语言包）**：设置 → General → **Language** 选 日本語 / 한국어 → 你的设置卡片、slot tab label、notice 文案**全部**实时切换（无需刷新）。
- [ ] **运行期（无语言包）**：Language 行只有 中文 / English；你的 zh/en 文案正常；ja/ko 不可选 —— 这是**预期**，不是 bug。
- [ ] **漏译**：故意留一个缺 key（绕过类型检查）→ 界面显示 **key 字符串本身**（说明回退链走到了终点），不是空白。
- [ ] **回收**：卸载插件 / HMR 后无残留文案与报错。

---

## 6. 本仓库实证索引（可直接抄的样本）

| 插件 | 语言 | 注册方式 | 备注 |
|------|------|----------|------|
| `mine-dsh-plugins/dsh-perm-gate` | zh / en / ja / ko（`locales.ts:10/127/244/361`） | `register(NS, {zh,en})` 单条 + `bind(NS)`；ja/ko 字典 ship 但当前不注册进运行期 | AGENTS.md 明记 stock DSH 不可选；README/INSTALL/CHANGELOG 四语 |
| `mine-dsh-plugins/dsh-thinking-levels` | zh / en / ja / ko（`locales.ts:7/76/145/214`） | **三条注册**：`{zh,en}` + `'ja'` + `'ko'`，全在 `ctx.effect` 内 | 注释即本指南 Step 2 的原始出处 |
| `mine-dsh-plugins/dsh-session-steward` | zh / en | `ctx.get('locale')` + `typeof` 守卫 | 跨版本/跨环境安全样本 |
| `mine-dsh-plugins/dsh-session-search-toggle` | zh / en | 同上（`:563`） | |
| `mine-dsh-plugins/dsh-input-traffic` | zh / en | `ctx.effect(() => ctx.locale.register(NS, {zh,en}), …)`（`:82`） | 直接注入式样本 |
| `mine-dsh-plugins/dsh-context-compression-improved` | zh / en | `locale.register(NS, {zh,en})`（`packages/selector/src/client/index.ts:89`） | monorepo 子包样本 |
| `mine-dsh-plugins/dsh-canvas-tsx-sidebar` | zh / en | 只有 `locales.ts` 的 bundle 形状 | 未做第三语言 |
| 外部：`@huanlin/dsh-plugin-better-locale` | 19 语（含 ja/ko） | `addLanguage` + `register(ns, locale, dict)` | 语言包侧标准样本，AGPL-3.0 |
| 外部：`DSH-better-sidebar` | zh/en + 19 第三语言分文件（`locales-*.ts`） | 分文件词典 + 键集相等测试门禁 | 大 key 集的分文件样本 |

---

## 7. 一句话决策树

```
我要让自己的插件支持 ja/ko？
├─ 只是"我的文案跟着语言走" → 做 Step 1~4（自带字典 + 注册），并告知用户需装语言包
├─ 还要"让用户能选到 ja/ko"  → 额外做第 3 节（addLanguage），或直接让用户装 better-locale
└─ 想给别人提供第三种语言覆盖 → 参考 better-locale 的架构（addLanguage + 校验链 + 编译期 drift 门禁）
```

---

## 8. 第三件事（0.1.7 新增）：插件**显示**元数据 `meta`

> 来源：`.agents/notes/implemented/architecture/2026-09-18-localized-package-metadata.md`（`dsh-v0.1.7-rc.1` 新增，Status: implemented）
> 与前面两件事的区别：§0 讲的是**你的界面文案**，第 3 节讲的是**用户能否选到某语言**，本节讲的是**插件管理页/设置页里那个插件叫什么**。

### 8.1 要解决的问题

一个 npm 包可以导出多个用途不同的插件，包级 `description` 无法分别描述它们；而"仅在激活时注册介绍"会让**被禁用或加载失败的插件没有显示文本**。0.1.7 因此引入插件自有的显示元数据。

### 8.2 契约

在每个语言资源里加一个 `meta` 块：

```json
{
  "meta": {
    "title": "File Search",
    "description": "Search files in your workspace."
  }
}
```

并声明资源导出（子路径插件为 `./<sub>/locale/*.json`）：

```json
{
  "exports": {
    "./locale/*.json": "./locale/*.json"
  }
}
```

| 主题 | 契约 |
|---|---|
| 资源地址 | 由**配置里的 Cordis 插件名**决定，经 Node 模块解析按 profile 与 package exports 选文件——**不评估插件代码** |
| 语言发现 | Host 解析 `en.json`，在同目录发现各语言文件名，用**同一插件 specifier 与 parent URL** 解析每个资源；语言标识**大小写不敏感**，**重复被拒**；`meta` 字段须为非空字符串 |
| title 回退 | `meta.title` → `<plugin specifier>/package.json` 的非空 `name` → 完整配置 Cordis 插件名 |
| description 回退 | `meta.description` → 同级 package.json 的非空 `description` → 无描述 |
| 字段独立 | 两个字段**各自独立回退** |
| 子路径插件 | **不继承**所属包的介绍（回退只在同一地址内进行） |
| 纯 JS 路径插件 | `./plugins/search.js` 这类**跳过同级资源查找**，配置路径本身即最终标题回退；**不提供**兄弟目录的 locale 元数据，也不读邻近 package.json |
| 文件路径 / file URL | Windows 盘符路径与 UNC 路径同样跳过资源解析并返回无元数据；**文件地址本身不算元数据错误** |
| 禁用插件 | **无需激活即可读取**（这是该设计的核心动机） |
| 错误语义 | 缺资源 / 缺字段走回退；**非法 locale 字段或畸形文件报诊断而非静默回退**，且插件**仍可管理** |
| 缓存 | **按请求读取，无元数据缓存** |
| 不适用面 | 远端预览**不下载**远端包内容做翻译；模型工具结果**排除**多语言 UI 字典；Session 事件不变 |

### 8.3 与插件管理页的两条显示规则

- `Plugin Manager` 在已装 bundle 卡片与详情、组件列表、组件配置详情上使用该元数据，并**保留完整技术名回退**。
- `Settings` 的插件清单同样使用它，但会把**字面包名 / 模块名回退**缩短（去掉 npm scope 与 Cordis/DSH 前缀）；**翻译过的标题保持原样**，且完整模块名、entry id、搜索身份与操作目标**不变**。
- 一行配置页**仅在该插件没有显示描述时**才用其注册的 `summary` 视图。

### 8.4 发布注意（最容易翻车的一条）

note 的 Consequences 段明确：**漏掉语言文件或漏声明导出，会让发布后元数据不可用**——而本地开发时往往看起来正常。因此验证必须同时覆盖两项：

1. **解析**（本地 `dsh --profile <p> --dump-config` 后打开插件管理页，确认标题/简介与语言切换）；
2. **打包进包的文件**（`npm pack` / `pnpm pack` 后检查 `locale/*.json` 是否真的在 tarball 里、`exports` 是否可解析）。

把它加进 §5 的验证清单：

- [ ] **显示元数据（0.1.7+）**：`locale/en.json` 含 `meta.title`/`meta.description`，`./locale/*.json` 已在 `exports` 声明；打包后 `locale/` 确实在 tarball 内。
- [ ] **禁用态可读**：禁用该插件后，插件管理页**仍**显示其标题与简介（不是技术名）。
- [ ] **回落行为**：删除 `meta` 后，标题回退到 package.json 的 `name`，再回退到完整 Cordis 插件名——三级依次可观察。

---

*文档生成时间：2026-09-15（§8 于 2026-09-25 按 `dsh-v0.1.7-rc.1` 增补）*
*数据源：`@deepseek-ai/dsh-client-locale@0.1.2-rc.1` 类型声明（`LocaleRuntime` / `locale-settings`）、`@huanlin/dsh-plugin-better-locale@0.4.3` README、本仓库 `mine-dsh-plugins/*` 源码*
