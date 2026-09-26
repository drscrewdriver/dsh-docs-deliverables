# 0.1.7 设置席位的两个实证范式与运维坑（perm-gate / better-sidebar 校准）

> 2026-09-26 · 基于 `dsh-v0.1.7-rc.1/rc.2` 远端实机验证 + 已跑通的参考实现。
> 定位：[v0.1.7-migration.md](v0.1.7-migration.md) §1（设置席位）的**实战补充**——那边讲"API 对照"，这里讲"照哪个抄、坑在哪、怎么取证"。
> 参考实现：`dsh-perm-gate@4.2.0-beta.2`（范式 B）、`DSH-better-sidebar`（范式 A）、`dsh-thinking-levels@3.3.0` + `dsh-session-guard@3.2.1`（§3 插件族共用节，实机验证）。

---

## 0. 结论先行

1. **0.1.7 设置面只有两条活路**：顶级设置节 `settings.section`（范式 A）、「插件」节内 tab `settings.plugins.tab`（范式 B）。`settings.plugin.item` 已删，`installSection` 已删。
2. **数据层只有一条活路**：客户端 `ctx.configForms.get(<自己的 entry id>)`。旧 `settingsScope` 服务已删，且**设置 RPC 域不向配置客户端服务第三方 namespace**（better-sidebar 源码注释原话）→ 客户端只能读写**自己 entry** 的配置，跨 entry 写必须走宿主半。
3. 两条范式都已实机验证：范式 B（perm-gate 的「自动审查」tab）是 0.1.7rc 上**首个存活的第三方设置面**；范式 A（better-sidebar 的「Side card」节、context-compression 的「上下文压缩」节）为官方生态参照。
4. **席位正常 ≠ 面板正常**。席位换了、数据源没换 → 面板注册成功但渲染空白。注意甄别两类"空白"：**组件崩**（console 有 Element type invalid 等报错，多半是构建引用了 rc.2 改名的导出，见 [v0.1.7-migration.md §11](v0.1.7-migration.md)）vs **数据不可用**（无报错、只剩标题，`configForms` 快照 unavailable，查 profile entry 行）。
5. **本地构建环境 ≠ 发布产物**：compat 分支的 workspace overrides / devDeps 若没随宿主版本升级，会出现"本地 typecheck 满屏红、远端运行正常（或反之）"的分裂（见 [v0.1.7-migration.md §11.5](v0.1.7-migration.md)）。

---

## 1. 范式 B —— `settings.plugins.tab`（插件节内 tab）

**样本**：`dsh-perm-gate@4.2.0-beta.2`，`lib/client.js`（tarball 实证）。

```ts
export const inject = ['slots', 'locale', 'configForms']

// PERMISSIVE_NS 必须与 cordis.patch.yml 的 id: 严格一致（entry id，不是自定 namespace）
const PERMISSIVE_NS = 'dsh-perm-gate'

ctx.slots.inject('settings.plugins.tab', function* () {
  yield ctx.slots.register({
    name: 'settings.plugins.tab',
    id: PERMISSIVE_NS,          // 全局唯一
    order: 50,
    label: () => t('card.title'),
    locale: NS,
    inject: () => ({ scope: ctx.configForms.get(PERMISSIVE_NS) }),
  }, MyCard)
})
```

适用：插件自己的设置项不多、想挂在「内置插件 → 插件设置」页下。
要点：

- `id` 用 entry id。旧 `settingsScope.bind({ namespace })` 的自定字符串（如 `permissive`）在 0.1.7 **不是键**，用错拿不到数据。
- 卡组件数据全从 `inject` 传入的 form 快照取；写经 form 的 `set/unset/mutate`。
- 席位是 `list` kind：多个插件各自注册 = **平级多个 tab**，不是嵌套。

## 2. 范式 A —— `settings.section`（设置壳顶级节）

**样本**：`DSH-better-sidebar`，`src/client/index.tsx:448`。

```ts
ctx.slots.inject('settings.section', () => ctx.slots.register({
  name: 'settings.section',
  id: 'better-sidebar',
  order: 100,                    // 排在官方节之后
  label: () => t('settingsNav'),
  inject: () => ({ store: sidebarStore, service }),
}, SideCardSection))
```

适用：设置面复杂（分组/选择器/规则编辑器），需要整页空间。
要点：

- **图标坑**：0.1.7 壳对外部 section 一律渲染通用齿轮（`index.tsx:433` 注释）；better-sidebar 用 CSS 标记自己的导航行绕过，disposer 负责 HMR/禁用时清理。单节可直接接受齿轮。
- **写路径**：better-sidebar 没走 `configForms` 而走自建 fenced RPC（host 半在进程内调 settings seam，理由即 §0 第 2 条：RPC 域不服务第三方 namespace 的**跨端写**）。两种都行，但 fenced 路线要求宿主半自建 RPC 域，成本高——自有插件默认 `configForms`，仅当写路径确需绕过 RPC 时才抄 better-sidebar。
- 0.1.7 自动「插件设置」表单页只投影 entry 的 **volatile Config 字段**，且同样受 RPC 域限制——第三方插件的 Config 不标 `.volatile()` 时该页拿不到内容，这不是 bug，是设计。

## 3. 插件族共用入口：顶级 section + 内部 tab 栏（✅ 已实机验证）

> 2026-09-26 验证：远端 0.1.7rc 实机出现「起子插件设置」顶级节，tab 栏正常。
> 参考实现：持有方 `dsh-thinking-levels@3.3.0`；贡献方 `dsh-session-guard@3.2.1`、
> `dsh-search-index@0.5.2`、`dsh-session-steward@0.4.2`、`dsh-input-traffic@0.5.2`（只读卡）、
> `dsh-bash-terminal-ts@0.6.2`、`dsh-browser-cdp@0.17.3`。
> 官方同款机制：`ui-settings-plugins`（Plugins 设置节）就是这样实现的——
> section entry 声明子席位，组件渲染 tab 栏。

`settings.plugins.tab` 是 list 席位，"共享母节点"不能靠重复注册（会得到平级 tab）。正解是**三件套**：

### 3.1 持有方：注册 section 并声明子席位

```ts
// entry 级 register 即支持 children（"Declaring is claiming"）；
// 声明了 children 的组件必须消费 renderSlot（编译期检查）
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'dsh-family.tab': { kind: 'list'; scope: 'root' }
  }
}

ctx.slots.inject('settings.section', function* () {
  yield ctx.slots.register({
    name: 'settings.section',
    id: 'dsh-family',
    order: 40,
    label: () => t('family.title'),
    locale: NS,
    inject: sectionInjected,                                  // 卡片数据面 + tab 账本
    children: { 'dsh-family.tab': { kind: 'list', scope: 'root' } },
  }, FamilySettingsSection)
})
```

### 3.2 持有方组件：账本 + tab 栏（照 `ui-settings-plugins` 原样）

```ts
// 账本 = HostObservable：缓存到 ledger/locale revision 变化才重算（uSES 要稳定快照）
let tabsVersion = -1; let tabsRevision = -1; let tabs: FamilyTabEntry[] = []
const sectionInjected = () => ({
  scope: ctx.configForms.get('dsh-thinking-levels'),          // 自家卡的数据
  hooks: { tabs: {
    getSnapshot: () => {
      const v = ctx.slots.getVersion('dsh-family.tab')
      const r = ctx.locale.getSnapshot().revision
      if (v !== tabsVersion || r !== tabsRevision) {
        tabsVersion = v; tabsRevision = r
        tabs = ctx.slots.entries('dsh-family.tab')
          .map(e => ({ id: e.options.id ?? '', order: e.options.order ?? 0,
                       label: resolveLabel(e.options.label) }))
          .sort((a, b) => a.order - b.order)
      }
      return tabs
    },
    subscribe: (listener) => {
      const a = ctx.slots.subscribe('dsh-family.tab', listener)
      const b = ctx.locale.subscribe(listener)
      return () => { a(); b() }
    },
  } },
})

// 组件内：自家卡固定第一个 tab；活动 tab 用 only 过滤单挂
rows = [{ id: OWN, … }, ...useTabs(v => v)]
active === OWN ? <OwnCard/> : renderSlot('dsh-family.tab', {}, { only: active, fallback: null })
```

### 3.3 贡献方：一行 inject，不探测

```ts
export const inject = ['slots', 'locale', 'configForms']

ctx.slots.inject('dsh-family.tab', () => ctx.slots.register({
  name: 'dsh-family.tab',
  id: 'session-guard',          // entry id
  order: 20,
  label: '会话守护门禁',         // 必填：tab 栏文字读账本 label（string 或 thunk）
  locale: 'session-guard',
  inject: () => ({ scope: ctx.configForms.get('session-guard') }),
}, MyCard))
```

### 3.4 归位拓扑定稿（2026-09-26）

- **独立顶级节**：perm-gate（「自动审查门」，order 30，自 `settings.plugins.tab` 迁出）、
  context-compression（上下文压缩）、prime-memory（记忆）——复杂整页面各自成节。
- **family 收编**：轻量设置卡一律贡献 `dsh-family.tab`；input-traffic 的 HideEnterRow 是
  行为覆盖，留在 General 页（覆盖 ≠ 设置面，两者不可混）。
- **sidebar 类**（brief/canvas/docx/opensheet/pptx-sidebar）不参与 0.1.7 设置面。

### 3.5 降级语义（实测纠正此前的错误结论）

**`ctx.slots.inject` 不需要软探测。** 实证（`ui-renderer/src/client/registry.ts:209`）：

- `inject` 返回 **idempotent disposer**（不是 Promise）；
- 声明已存在 → 回调同步执行；不存在 → 经 `subscribeDeclaration` **静默等待**，控制器挂在调用方 fiber 上，插件卸载自动取消；
- 声明永远缺席 ≠ 客户端半挂起——**cordis 的 pending 只针对 inject 数组里的服务名**，slot 等待不阻塞 apply；
- 持有方缺席的实际后果仅是：贡献方的设置卡静默缺席，其余功能照常。文档里注明这一依赖即可。

### 3.6 类型坑：ui-slots 的类型图在 workspace 外解析不可靠

`export * from './renderer.ts'` 链在 harness workspace 之外常整体失效（`HostObservable` / `InjectFace` / `PropsRuntime` / `PropsRenderSlots` / `resolveSlotLabel` 全部 TS2305，尽管 .d.ts 里都在）。两个处理：

1. 补 `@deepseek-ai/dsh-client-store` devDep——ui-slots 的类型链 import 它，缺了会拖垮整条星型导出（`PropsLocale` 等直接声明不受影响，可用于定位）；
2. 仍不可用时，照 `scope-face` 模式**本地声明结构化镜像**（只需要 `getSnapshot/subscribe`、`renderSlot(key, owner?, opts?)`、label 解包这几个形状），运行时不受影响。

## 4. 运维坑与取证手册（本轮实机踩出）

0. **包装 observable 必须缓存 getSnapshot（React #185）**：`useSyncExternalStore` 要求快照**引用稳定**——每次调用返回新字面量 → 无限重渲染 → 生产环境报 `Minified React error #185`（Maximum update depth exceeded），席位边界把整个 entry 撤下（`slot entry crashed in 'settings.section'`）。宿主原生 `ConfigForm.getSnapshot()` 是缓存的，但自建适配层（如 configForms → 旧 scope 形状的包装器）极易在这里重建对象。**修法**：以底层快照的对象身份为缓存键，仅当身份变化才重算投影（实证：context-compression 0.6.3，回归测试钉死该契约）。本地测试抓不到——mock 快照恰好是稳定对象，这类契约要显式断言 `getSnapshot() === getSnapshot()`。

1. **"pending (waiting for service: settingsScope)" 的取证**：该句只能由插件自身 `inject` 数组触发。对嫌疑包跑 `grep -c settingsScope <包>/lib/client.js`：发布版应为 0。若为 0 仍报 pending → **机器上跑的不是这个构建**（版本装旧 / 镜像同步延迟 / dist-tag 漂移），用 `Get-FileHash` 对比发布 tarball 哈希定案。
2. **dist-tag 陷阱**：`latest` 可能仍指向 0.1.5 旧线（本轮 4 个包如此）。任何按 `latest` 或旧版本范围安装的机器都会装到含死 API 的构建。0.1.7 适配发布后必须**同时校准 `dsh-0.1.7` dist-tag 与 `latest`**，安装一律钉确切版本。
3. **beta 版可重发**：`x.y.z-beta.n` 允许 unpublish 重发（72h 内），同版本号可能对应两种内容——取证时以**文件哈希**为准，不信版本号。
4. **软读是合法回退**：`ctx.get('settingsScope')?.bind(...) ?? configForms?.get(...)` 这类软探测不会 pend（search-index / session-steward 即此写法）；只有硬 inject 数组里的服务名才阻塞 apply。slot 的 `ctx.slots.inject` 也不阻塞（§3.4）。
5. **改完必须重建产物**：`lib/`/`dist/` 里的死调用会随 npm 包发布；发布后跑一次 tarball 全量 grep（`settingsScope|installSection|settings\.plugin\.item`）作发布门禁。注意**注释里的死字符串也算命中**——门禁要求"无代码行 CALL"，仅注释残留要么清理重发，要么在门禁口径里明示豁免。
6. **发布 registry**：默认 registry 若是 npmmirror 一律发布失败（need auth），须 `--registry https://registry.npmjs.org` 或包内 `publishConfig.registry` 钉死；**发布后 CDN 元数据有 1–2 分钟传播延迟**，紧跟着的 `npm view`/`npm pack` 可能 ETARGET——校验 dist-tag 用 `curl https://registry.npmjs.org/<pkg>` 直读 packument。
7. **远端取证三步**（"面板显示异常"类问题）：① `node_modules/<pkg>/package.json` 的 version 是否等于发布版；② profile 的 `cordis.patch.yml` 里该插件 entry 行（承载 Config 的 `-bundle` 行在不在、有无旧 id 残留）；③ 设置页 F12 console 报错。客户端侧 `configForms.get()` **永不抛错**——未知 entry 返回 `unavailable` 快照，组件通常静默返回 null（页面只剩标题），所以"页面在但内容空"≠ 客户端崩，优先查 ②。
8. **list 席位贡献方的 `label` thunk 里禁止触碰 `ctx.*`（实机炸过，search-index 0.5.3）**：持有方在**自己的渲染期**对每个贡献条目求值 `label()`，此时 thunk 闭包里的 `ctx.locale` 是**贡献方插件的 accessor**——若贡献方模块 `inject` 未声明该服务，cordis 抛 `cannot get property "locale" without inject`，异常从持有方 `useSyncExternalStore` 的 getSnapshot 冒出，**整个 tabs 投影全灭**（现象：section 只剩持有方自己的卡，贡献 tab 一个不见，报错却指向 label/resolveLabel，与 family 机制无字面关联，极易误判成"没生效/旧构建"）。铁律：label 闭包要么是纯字典查找（bash-terminal 的 `zhDictTitle`、browser-cdp 的 `wt`），要么在 apply 期**急切捕获**翻译器（`const t = ctx.locale.bind(NS)`；bind 返回活绑定，仍跟随语言切换，input-traffic/search-index 即此修法）。防御侧：持有方 `resolveLabel` 必须 try/catch 降级到 entry id（thinking-levels 3.3.1），单个坏贡献方不许炸整个 ledger。

## 5. 判定速查

| 你要什么 | 0.1.7 做法 |
|---|---|
| 挂在「插件设置」页下的一个 tab | 范式 B（§1），照 perm-gate |
| 设置壳左栏自己的顶级节 | 范式 A（§2），照 better-sidebar |
| 让 Config 字段自动出现在官方表单页 | Config 加 `.volatile()`，无需任何注册代码 |
| 多个自家插件共用一个设置入口 | §3：顶级 section 声明子席位 + tab 栏（已实机验证，照 thinking-levels 3.3.0 + 六贡献方） |
| 官方 General 页的偏好行 | `settings.general.item`（0.1.7 存续）；仅当行是**行为覆盖**（null 渲染压行）时同样用它——覆盖不是设置面，勿混入 family |
| 客户端读/写配置 | `ctx.configForms.get(<自己 entry id>)`，仅限自己 entry |
| 跨 entry / 跨端写配置 | 宿主半（fenced RPC 或 host 服务），客户端无路 |
| 客户端卡片的值类型 | 快照 `value` 是**存储文档**（volatile 引用已被解包）——客户端按普通值读，别用 `Volatile<T>` 联合类型 |
