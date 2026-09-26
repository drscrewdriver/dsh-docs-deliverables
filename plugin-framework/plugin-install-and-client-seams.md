# DSH 插件「装了但不显示」：四层注册链与客户端接缝

> **适用场景**：插件包已经复制进 profile 的 `node_modules/`，profile 的 `cordis.patch.yml` 里也写了 `- id: <plugin>`，但侧栏 / 预览里毫无踪影，**且控制台一声不响**。
> **数据源**（DSH 0.1.5-rc.2 源码实证）：
> - `@deepseek-ai/dsh/lib/plugin-Ddi42qoW.js` —— `dsh plugin` 的 CLI 语义与 `reconcilePlugins()`
> - `@deepseek-ai/dsh/lib/profile-boot-Dk-7KqJc.js` —— 层叠顺序（bundles → profile patch → overlay）
> - `@deepseek-ai/dsh-client-modules/lib/index.js` —— 客户端模块扫描（`resolveMeta` / `locatePkgJson`）
> **实证插件**：`dsh-csv-sidebar` 0.1.0（装了两处、依然不加载）→ 0.2.0（修复并静态验证通过）。

---

## 一、结论速查

一个外部插件要真正生效，要连续通过**四层**。缺任何一层，表现各不相同——**唯一完全静默的是第 ② 层**。

| # | 层 | 由谁维护 | 缺失时的表现 |
|---|----|---------|-------------|
| ① | 包内容在 `profiles/<p>/node_modules/<pkg>/` | pnpm（`dsh plugin add`）或手动复制 | 宿主解析不到包名 → **启动报错**（这层会响） |
| ② | 包名在 profile `package.json` 的 **`dsh.profile.bundles`** | **`dsh plugin add` 自动维护**；手动安装必须自己加 | 插件的 `cordis.patch.yml` **根本不参与合成** → **完全静默** |
| ③ | 插件包内 `cordis.patch.yml` 的 `insert` 行 | 插件作者（包内提供） | 无行可插 |
| ④ | profile `cordis.patch.yml` 的 `- id: <plugin>` | 用户 / CLI | 行插入了，但保持 bundle 层的默认状态 |

> **最容易搞混的一点**：`- id: <plugin>` + `disabled: false` 是「**配置已经存在的那一行**」，**不是「插入一行」**。行只能由 bundle 层（②+③）插入。
> 所以「我在 profile 的 cordis.patch.yml 里写了 `- id: dsh-csv-sidebar, disabled: false`」**完全不构成安装**——它只是给一个尚不存在的行写配置，是一个静默空操作。

---

## 二、第 ② 层是唯一完全静默的一层（本次根因）

### 2.1 层叠顺序（profile-boot 注释原文）

```
# each bundle in package.json's dsh.profile.bundles, then cordis.patch.yml, then any
# --patch overlays
```

profile 的 `cordis.yml` 是一个**空数组**；整棵树由「bundle 层的 patch」依次叠加而成。**没有进 `bundles` 的包，其 `cordis.patch.yml` 永远不会被读**。

### 2.2 `dsh plugin add` 为什么能行

`runPlugin()` = 在 profile 目录跑一次 `pnpm <args>`，然后调 `reconcilePlugins(before, dir)`：

```js
// plugin-Ddi42qoW.js :: reconcilePlugins()
for (const packageName of dependencies) {
  const isBundle = exportsPatch(packageName, profileDir)   // 该依赖是否声明 dsh.bundle.patch
  if (isBundle && !plugins.includes(packageName)) {
    plugins.push(packageName)                              // ← 追加进 dsh.profile.bundles
    changed = true
  }
  ...
}
if (changed) writeProfileManifest(profileDir, after)
```

即：**`dsh plugin add <spec>` = pnpm add + 「把新依赖里声明了 `dsh.bundle` 的名字追加进 `bundles`」**。

### 2.3 手动复制为什么一定会漏

手动复制只做了「① 放文件」和「③ 包内自带 patch」，没有改 `dependencies`，于是 `reconcilePlugins` 从没跑过，`bundles` 里也没有名字。**结果：不加载、不报错、没有任何提示。**

### 2.4 一个反直觉但有用的推论

`reconcilePlugins` 的**移除**分支要求 `wasDependency === true`：

```js
const wasDependency = beforeDeps.has(packageName) || dependencySet.has(packageName)
if (wasDependency && !stillBundle) { plugins.splice(...) }   // 非依赖 → 永不被移除
```

所以「**只加进 `bundles`、不进 `dependencies`**」是一个**稳定**状态：后续 `dsh plugin add/update` 不会把它摘掉。
本机先例：profile 的 `bundles` 里有 `dsh-synapse` 而 `dependencies` 里没有它，插件照常工作。

---

## 三、装完先验证，再重启（不启动任何服务）

DSH 自带一个离线合成命令，**不用启动宿主**就能看到最终树：

```powershell
dsh --profile web --dump-config | Select-String -Pattern '<plugin>'
```

实测（2026-09-22，`dsh-csv-sidebar` 修好 bundles 之后）：

```
# == dsh-csv-sidebar, patched by C:\Users\joshua\.dsh\profiles\web\cordis.patch.yml
- id: dsh-csv-sidebar
  name: dsh-csv-sidebar
  disabled: false
```

- 看到这三行 = ②③④ 全部就位（行已插入 + profile 补丁已生效）→ 此时**重启 DSH** 即可。
- **看不到 = 第 ② 层没生效**（无论 profile 的 `cordis.patch.yml` 里写了什么）。

> 重启是必须的：profile bundle 与客户端模块表都在**启动时**合成，仅刷新浏览器页面不够。

---

## 四、客户端那一半：另外三条硬契约

宿主行插进去了，插件仍然可能「在侧栏里不存在」。`dsh-client-modules` 的扫描逻辑（`resolveMeta`）定死了三个条件：

### 4.1 客户端模块表扫的是**宿主 Loader 的 entries**，不是 `node_modules`

`index.js` 模块注释：*"scans the host Loader's entries for packages declaring `dsh.client`"*；`resolveMeta(loaderName, baseUrl)` 对**每一行**去定位它挂载的包清单。
→ **第 ②/③ 层没生效的插件，其客户端半边连被扫描的机会都没有。**

### 4.2 清单必须具备 `dsh.client.platform: 'web'` 与 `exports["./client"]`

```js
const decl = parseDshClient(packageName, pkg.dsh?.client)
if (decl === void 0 || decl.platform !== 'web') return null            // 静默跳过
const clientRel = clientExportOf(packageName, pkg.exports)
if (clientRel === void 0) throw new Error(`${packageName} declares dsh.client but exports no "./client" bundle`)
```

两个分支的差别值得记住：**平台不是 web → 静默跳过**；**声明了 `dsh.client` 却没有 `exports["./client"]` → 直接抛错**。前者会让你继续猜，后者至少会喊。

```json
"exports": { ".": {...}, "./client": { "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" } },
"dsh": { "bundle": { "patch": "./cordis.patch.yml" },
         "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-locale"] } }
```

### 4.3 产物必须是 `__ModuleLoader__` 的 CJS 闭包

DSH 的客户端模块系统**不消费 ES module**。它求值一段脚本，脚本调用

```js
window.__ModuleLoader__.load({ id: '<package name>', factory: (require) => { ... return module.exports } })
```

工厂返回的对象必须带 **`apply`**（以及可选的 **`inject`**）。写成 `export function activate()` 的 ESM bundle，会在模块表阶段被**整体丢弃**——同样没有任何报错。

> **不要用「读代码/看文件名」来验证这件事。** 构建期真加载一次更便宜：`node:vm` + 桩 `window.__ModuleLoader__` + 可用的 `require`，断言 `load()` 被调用、`id` 等于包名、`factory()` 返回的对象带 `apply`/`inject`。参考实现：`dsh-csv-sidebar/scripts/build.mjs`（构建门禁的一部分）。

### 4.4 侧栏 UI 的正确接缝

| 想做的事 | 正确接缝 | 错误写法 |
|---|---|---|
| 加一个侧栏页 | `ctx.betterSidebar.registerTab({ id, title, icon, order, single, component })` | `ctx.sessionProjections.register({ key, badge, component })` —— 那是**宿主侧投影注册表**，不是侧栏 UI |
| 让某类文件以自己的方式预览（GUI 的「文件预览」清单） | `ctx.betterSidebar.registerFileViewer({ id, exts, priority, fetchStrategy, component })` | 同上 |
| 依赖的服务 | `export const inject = ['betterSidebar', 'locale']` 声明式注入 | `ctx.get('x')` 懒取常备服务（激活竞态） |
| 一切安装项 | `ctx.effect(fn, label)`，靠返回的 disposer 回收 | 裸挂载（HMR/禁用即泄漏） |

`fetchStrategy` 决定宿主怎么给你文件：`'fsRead'` 让宿主读文本并自带工作区路径围栏，`'mediaUrl'` 给 URL，`'custom'` 让你自己 `load()`。**能交给宿主的就不要自己读**——围栏在宿主侧。

---

## 五、两条安装路径（二选一，勿重复注册）

### 路径 A：官方 CLI（推荐，会自动维护 ①②）

```powershell
dsh plugin --profile <profile> add <path-to-plugin | .tgz | registry-name>
```

跑完请**再 dump 一次**确认名字进了 `bundles`。

### 路径 B：手动（三步，缺一不可）

1. 复制包到 `~/.dsh/profiles/<profile>/node_modules/<pkg>/`
2. 把 `"<pkg>"` 加进该 profile `package.json` 的 **`dsh.profile.bundles`** ← **最容易漏、漏了完全静默**
3. 把插件包内 `cordis.patch.yml` 的 `insert` 行追加到 profile 的 `cordis.patch.yml`

### 与源码解析的关系

`--dump-config` 输出的是**宿主侧** cordis 树；客户端模块表不在其中（它在启动时按 §4 的规则另算）。两者一起才是「插件真的活了」。

---

## 六、插件作者检查清单

- [ ] `package.json` 有 `dsh.bundle.patch` **和** `dsh.client.platform: 'web'`，且 `exports["./client"]` 指向真实存在的 bundle
- [ ] 客户端产物是 `window.__ModuleLoader__.load({ id: 包名, factory })` 的 CJS 闭包，工厂导出 `apply` + `inject`
- [ ] 构建脚本**真加载一次**产物并断言 `apply`/`inject`（不要靠 grep 通过验收）
- [ ] 一切都走 `ctx.effect()`；`inject` 声明式声明 shell 常备服务
- [ ] 侧栏 UI 走 `betterSidebar.registerTab / registerFileViewer`，不用 `sessionProjections`
- [ ] `peerDependencies` 上限写 `<0.2.0-0`（预发布 semver 陷阱）
- [ ] 包内 `cordis.patch.yml` 的注释里写清**手动安装是三步**，并给出 `--dump-config` 验证命令
- [ ] README 的安装章节与包内注释口径一致（否则下一个人照 README 做，就会精确复现本次故障）
