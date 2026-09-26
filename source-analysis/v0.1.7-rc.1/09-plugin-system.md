# 【第 09 篇】插件体系：manifest · 安装 · 注册表 · 配置 · 扩展席位

> **版本**：dsh-v0.1.7-rc.1（`46a7f68b09`），对比上版 dsh-v0.1.6-alpha.1（`0a15e36e7f`）
> 难度：🟡 进阶（插件作者必读；建议先读第 01 篇与 `docs/architecture.md`）
> 包范围：横切插件生命周期 —— 主包 `packages/boot/plugin-manager`（本版新增）、`packages/extensions/`（4 包）、`packages/preset/`（3 包）、`packages/util/package-manifest`、`packages/boot/app-boot` 的插件面、`packages/host/plugin-inventory`、`packages/boot/hmr`（本版新增），以及 `packages/client/` 下 8 个与插件席位相关的包
> 上游文档：`packages/boot/plugin-manager/README.md`、`packages/util/package-manifest/README.md`、`docs/subsystems/extensions.md`、`docs/subsystems/client-modules.md`、`docs/subsystems/boot.md`、`docs/user/develop/basic/publish.md`、`docs/cookbook/adding-a-package.md#plugin-display-metadata`

## 目录

- [引言](#引言)
- [概述](#概述)
- [核心概念](#核心概念)
- [包结构](#包结构)
- [关键类型](#关键类型)
- [数据流](#数据流)
  - [一、引导式安装的状态机](#一引导式安装的状态机)
  - [二、注册表计划与失败归因](#二注册表计划与失败归因)
  - [三、manifest → 包目录 → 本地化元数据](#三manifest--包目录--本地化元数据)
  - [四、插件配置与详情页扩展席位的注册路径](#四插件配置与详情页扩展席位的注册路径)
  - [五、profile 插件宿主运行实例的解析](#五profile-插件宿主运行实例的解析)
- [测试覆盖](#测试覆盖)
- [与上下游的关系](#与上下游的关系)
- [本版本变更要点（0.1.6-alpha.1 → 0.1.7-rc.1）](#本版本变更要点016-alpha1--017-rc1)
- [插件作者可操作契约清单](#插件作者可操作契约清单)
- [附录：本版提交索引](#附录本版提交索引)
- [未核实项](#未核实项)

---

## 引言

本篇是这一版**对插件作者最重要**的一篇。原因是硬事实：在 `dsh-v0.1.6-alpha.1` → `dsh-v0.1.7-rc.1` 这个区间里，**整套插件管理能力从零落地**——不是"改进了旧的插件页"，而是新增了宿主侧服务包、Web 侧页面包、HMR 包，并让 profile 的插件管理第一次能被 CLI / Web / Agent 三条路径共用同一套事务。

三条可直接复现的判定（`git cat-file -e`，退出码 128 = 该 tag 不存在此路径）：

```
packages/boot/plugin-manager/package.json                          → 0.1.6-alpha.1 不存在
packages/client/ui-settings-plugin-manager/package.json            → 0.1.6-alpha.1 不存在
.agents/notes/implemented/architecture/2026-09-14-current-profile-plugin-management.md  → 0.1.6-alpha.1 不存在
```

也就是说本版引用的全部插件决策 note（`2026-09-14` ~ `2026-09-18` 那一批）都是**本区间新增**的，它们描述的是同一批代码。这解释了为什么这一篇的"本版本变更要点"会占很大篇幅：对读者而言，**这里几乎没有"上版行为"，只有"本版新增契约"**。

区间规模（实测）：

| 命令 | 结果 |
|---|---|
| `git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/boot/plugin-manager packages/extensions packages/preset` | **186 files changed, 13169 insertions(+), 10130 deletions(-)** |
| `git log --oneline --count` 同路径 `packages/boot/plugin-manager` | **56 commits** |
| 同上 `packages/extensions` | **469 commits**（其中绝大多数是 `api-catalog.ts` / `slot-catalog.ts` 生成物增长，见下文"未核实项"） |
| 同上 `packages/preset` | **34 commits** |
| `git diff --shortstat ... -- docs/user/develop docs/subsystems/client-modules.md docs/subsystems/client-resources.md` | 13 files changed, 64 insertions(+), 45 deletions(-) |

必须先纠正一个容易搞错的前提：**`docs/subsystems/extensions.md` 不是本版新增的**。实测 `git diff --stat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- docs/subsystems/extensions.md` **输出为空**（两 tag 都存在该文件且区间内无任何改动）。真正在本版新增的子系统页是 `docs/subsystems/boot.md`（`git cat-file -e dsh-v0.1.6-alpha.1:docs/subsystems/boot.md` → `fatal: ... exists on disk, but not in 'dsh-v0.1.6-alpha.1'`）。

---

## 概述

本版插件体系可以拆成五层，每层有唯一的权威实现位置：

| 层 | 权威位置 | 一句话职责 |
|---|---|---|
| **① manifest 契约** | `packages/util/package-manifest/src/types.ts` | 只声明类型，不解析 JSON、不写文件；各读取方自己校验 |
| **② 安装事务** | `packages/boot/plugin-manager/src/operations.ts` | CLI（`dsh plugin`）与运行中服务共用的 pnpm/Git 子进程操作 |
| **③ 安装注册表计划** | `packages/boot/plugin-manager/src/registry.ts` | 一次操作按什么顺序问哪些 registry，以及失败该归因给谁 |
| **④ 配置与扩展席位** | `packages/client/ui-plugin-manager/src/client/slot-contract.ts` | 插件把自己的配置页与详情页贡献注册到 Plugins 页 |
| **⑤ profile 宿主运行时** | `packages/boot/app-boot/src/plugin-compatibility.ts`、`profile-compatibility.ts`、`compatibility-preflight.ts` | 加载前拒绝不兼容插件；精确版本豁免独立存盘 |

这五层之间是**单向依赖**：③ 只依赖 ①②的产物（`ParsedInstallSpec`、`PluginRegistries`），④ 只通过 Remote 与 `import type` 接触 ②，⑤ 在 Loader 导入前运行、不依赖任何插件代码被求值。

本版设计上最值得记住的三句话：

1. **安装前先读 spec，安装失败要回滚文件。** 宿主用 `inspect` 把 spec 归类并查询 registry/`package.json`，七种 problem 之一返回给客户端；`installBundle` 在 pnpm 运行前快照 `package.json` + `pnpm-lock.yaml`，失败/取消/装出来的包没有 `dsh.bundle` 三者任一都回写快照。
2. **registry 是一份计划而不是一个值，且私有 registry 永不回落到公开 registry。** 这条规则由 `socket` 级的安全考虑决定（dependency confusion），并被 `registryPlan()` 实现成一个纯函数。
3. **"兼容性"在本版从声明变为强制，但强制的是 `peerDependencies`，不是 `engines.dsh`。** 这是一个常见误解点，本版官方文档也专门写明了（见下文关键类型片段 E）。

---

## 核心概念

| 术语（首次出现附英文） | 含义 | 本版状态 |
|---|---|---|
| bundle | 一个提供 `dsh.bundle.patch` 的 npm 包：它是 profile 的一"层"配置 | 契约放宽：`patch` 可为有序数组 |
| profile 插件行（row） | bundle 的 patch 里 `insert` 的 Loader 条目；可单独启停 | 本版新增"行级配置页" |
| 插件管理器（Plugin Manager） | `ctx.pluginManager`，`TypertRemoteService` 子类，同时服务 CLI / Web / Agent 工具 | **本版新增包** |
| 引导式安装（guided installation） | 先 `inspect` 校验 spec，再 `installBundle`，且安装后默认**不启用** | **本版新增流程** |
| 注册表计划（registry plan） | 一次操作按顺序要问的 registry 列表 | **本版新增** |
| 失败归因（failure attribution） | 判定失败该由 registry 负责还是由 spec 自身的主机负责 | **本版新增** |
| 扩展席位（extension slot） | Plugins 页向其他插件开放的注册位置，按"区域"而非"对象"划分 | **本版新增 3 个 detail 席位** |
| 伴随包（companion package） | 某个内建设置的页面单独成一个纯客户端包，靠 `whileServed` 挂载 | **本版新增模式** |
| 本地化包元数据（localized package metadata） | 插件在自己的 `locale/<lang>.json` 里声明 `meta.title` / `meta.description` | **本版新增** |
| 可选 bundle（optional bundle） | 随安装包发布、默认关闭、永不可移除的 bundle | **本版新增** |
| 精确版本豁免（exact-version exemption） | `compatibility.json` 里 `包名@版本 → DSH 版本列表` 的白名单 | **本版新增** |
| 宿主运行实例（host runtime instance） | profile 插件必须共享安装体里的单例包（如 `dsh-scope`） | **本版新增规则** |

---

## 包结构

### 主包：`packages/boot/plugin-manager`（本版新增，27 个文件全部为 `A`）

`git diff --name-status dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/boot/plugin-manager` 输出 **27 行，全部以 `A` 开头**（新文件：3 个 README/元数据 + `package.json` + `tsconfig.json` + 12 个 `src/` + 10 个 `tests/`），无删除、无重命名。

| 文件 | 行数 | 职责 |
|---|---|---|
| `src/index.ts` | 804 | `PluginManager` 服务类：12 个 `@Remote` 方法、Config schema、事务与回滚 |
| `src/operations.ts` | 580 | CLI/服务共用的 pnpm 与 Git 操作、`viewProfilePackage`、`readProfileRegistry`、`registryArguments` |
| `src/types.ts` | 258 | 全部对外记录类型 + 3 个 Cordis 事件声明 |
| `src/registry.ts` | 98 | `registryPlan` / `normalizeRegistry` / `attributeFailure`（**浏览器安全**，见 `./registry` 导出） |
| `src/install-spec.ts` | 91 | `parseInstallSpec`：把 spec 归入 `registry` / `path` / `git` / `tarball` |
| `src/tools.ts` | 92 | `plugin_manager` 工具（8 个 action） |
| `src/run-tree.ts` | 70 | 等待被终止的进程树真正消失 |
| `src/github-connection.ts` | 68 | 安装前的 `git ls-remote` 有界连通性检查 |
| `src/build-approval.ts` | 50 | pnpm 11 `allowBuilds` 的读取与批准 |
| `src/install-failure.ts` | 44 | `classifyInstallFailure`：日志→失败种类 |
| `src/patch.ts` | 43 | 保留注释地改写 `cordis.patch.yml` 里的 `disabled` |
| `src/failure.ts` | 29 | `ManagementFailure` 与 `incompatiblePlugin` |

测试 10 个文件（行数为实测）：

| 文件 | 行数 |
|---|---|
| `tests/manager.spec.ts` | 1396 |
| `tests/operations.spec.ts` | 821 |
| `tests/tools.spec.ts` | 248 |
| `tests/github-connection.spec.ts` | 183 |
| `tests/operations-process.spec.ts` | 141 |
| `tests/registry.spec.ts` | 117 |
| `tests/patch.spec.ts` | 84 |
| `tests/install-spec.spec.ts` | 83 |
| `tests/build-approval.spec.ts` | 69 |
| `tests/run-tree.spec.ts` | 47 |

`package.json`（107 行）的关键点：

- `"name": "@deepseek-ai/dsh-plugin-manager"`，`"version": "0.1.7-rc.1"`；
- 额外导出 `./registry`（`lib/types/registry.js`）——**这是刻意的浏览器安全入口**，让对话框与宿主遵循同一条 `registryPlan` 规则（`registry.ts:1-8` 的模块注释原文：*"This module runs in the browser too, through the package's `./registry` entry, so the dialog and the Host follow one rule."*）；
- 另有 `./types`、`./operations`、`./tools`、`./typert`、`./remote` 入口；
- `@deepseek-ai/dsh-hmr` 与 `@deepseek-ai/dsh-user-approval` 是 **optional peer**（`peerDependenciesMeta`），这是"无 HMR 的 profile 也能跑管理器"的类型级表达。

### `packages/extensions/`（4 包，本区间全部有改动）

| 包 | 角色 | ctx key | 本区间改动规模（`git diff --stat` 行数） |
|---|---|---|---|
| `tool-cordis` | 两个只读工具 | 注册到 `ctx.tools` | `src/api-catalog.ts` 1864、`src/index.ts` 489、`src/config.ts` **新增 120**、`src/present.ts` 85、`src/providers.ts` 29、`src/host.ts` **新增 20**；**删除** `src/inspect.ts`(332)、`src/prompt.ts`(107)、`src/fiber-state.ts`(31) |
| `cordis-host-runner` | 宿主半：定义注册表、沙箱化生命周期、inspect 注册表 | `ctx.dynamicCordisRunner`、`ctx.cordisInspect` | `src/index.ts` 30、`src/guard.ts` 8、`src/lifecycle.ts` 4；**删除 `src/sandbox.ts`(28)** |
| `cordis-client-runner` | 浏览器半：把浏览器半源码求值成活插件 | 浏览器 `ctx.dynamicCordisRunner` | `src/client/slot-catalog.ts` 2254、`src/client/api-catalog.ts` 190、`src/client/guard.ts` 36、`src/client/providers.ts` 32、`src/client/runtime.ts` 7；**新增** `tests/providers.client.spec.ts`(74) |
| `ui-cordis` | 浏览器面板 + 历史生命周期卡片 | 注册席位 | `src/client/CordisPanel.tsx` 44、`src/client/CordisDefineRow.tsx` 27、`src/client/CordisRunRow.tsx` 25、`src/client/index.ts` 32；**新增** `src/client/CordisPreparingRow.tsx`(30)、`tests/status-icons.client.spec.tsx`(151) |

`packages/extensions/README.md:12` 给出了本版的定位改写（本区间该文件 10 行改动）：

> The extensions group provides read-only runtime API discovery for agents, process-local runners for programmatic and browser consumers, and historical generated-plugin cards. **Creator mode installs persistent plugins through [Plugin Manager](../boot/plugin-manager/README.md).**

即：**extensions 组在这一版被"降级"为只读 + 进程内运行器 + 历史卡片**；持久化安装的所有权移交给了 plugin-manager。两个只读工具名可从 `src/index.ts` 核实：`cordis_inspect_list`（`packages/extensions/tool-cordis/src/index.ts:23`）与 `cordis_inspect_query`（同文件 `:42`）。

### `packages/preset/`（3 包，本版发生包级拆包）

`git diff --name-status -M` 显示原 `packages/preset/agent-presets` 被拆成两个包：13 个文件按重命名保留（5 个 `src/` 源文件相似度 69%–96%、6 个测试 fixture/spec 为 R100、1 个 `tsconfig.json` R081、1 个 `README.i18n.yaml` R070），其余为新增/diff 视为新增：

| 旧路径 | 新路径 | 相似度 |
|---|---|---|
| `agent-presets/src/composition-inventory.ts` | `agent-preset-registry/src/composition-inventory.ts` | R071 |
| `agent-presets/src/display.ts` | `agent-preset-registry/src/display.ts` | R080 |
| `agent-presets/src/invariant.ts` | `agent-preset-registry/src/invariant.ts` | R069 |
| `agent-presets/src/session.ts` | `agent-preset-registry/src/session.ts` | R096 |
| `agent-presets/src/types.ts` | `agent-preset-registry/src/types.ts` | R070 |
| `agent-presets/README.i18n.yaml` | `agent-preset/README.i18n.yaml` | R070 |

被丢弃的旧文件（`agent-presets` 侧全为删除）：`src/index.ts`(862)、`src/mount.ts`(424)、`src/discovery.ts`(337)、`src/authoring.ts`(191)、`src/metadata.ts`(105)、`src/preset.ts`(70)、`src/specifier.ts`(49)、`presets/{cordis,minimal,ptc,standard}/*.yml`。也就是说：**本版删掉了"目录扫描式 preset 发现"（`discovery.ts`）与"preset 作者 API"（`authoring.ts`），改为纯声明式行**。

| 包 | 职责 | ctx key | 新增文件行数 |
|---|---|---|---|
| `agent-preset-registry` | 选择、修订保留、profile 编辑 | `ctx.agentPresets` | `src/index.ts` 373、`src/mount.ts` 272、`src/definition.ts` 39、`src/preset.ts` 20；`types.ts` 43 行改动 |
| `agent-preset` | 声明式子插件与元数据 + `skills/` 目录 | — | `src/index.ts` 30、`tests/skills.spec.ts` 82、`skills/` 全部新增 |
| `persona` | 可组合 Agent 人格 | — | 仅 `README.md` 2 行、`package.json` 14 行 |

`agent-preset-registry/README.md:46` 与 `:48` 是本版 preset 的权威口径：注册表**不扫描目录、不接受 preset 路径**；"新 preset 或覆盖已发布 preset 的方式是 bundle patch —— `insert` 一行 `@deepseek-ai/dsh-agent-preset`，或者用该行 id 打 patch，然后通过 `plugin_manager` 装进 profile"。

### `packages/client/` 下与插件相关的包（8 个）

| 包 | 状态 | 本区间改动规模 |
|---|---|---|
| `ui-plugin-manager` | **本版新增**（24 个文件全 `A`） | `PluginManagerPage.tsx` 1364、`PluginManagerPage.module.css` 1292、`manager-store.ts` 1035、`locales.ts` 380、`presentation.ts` 154、`slot-contract.ts` 130、`src/client/index.ts` 108、`src/index.ts` 86、`config-ledger.ts` 77；测试 `components.client.spec.tsx` 1420、`manager-store.client.spec.ts` 1342、`registry-probe.host.spec.ts` 136、`browser-plugin.client.spec.tsx` 122、`config-ledger.client.spec.ts` 103 |
| `ui-settings-plugin-inventory` | 改动 | `PluginInventorySettingsTab.tsx` 130 行改动、`tests/components.client.spec.tsx` +325、`src/client/index.ts` 12 |
| `ui-settings-plugins` | **收缩** | 删除 `PluginCard.tsx`(110)、`ConfigurablePluginsTab.tsx`(43)、`card-form.ts`(351)、`fields.tsx`(124)、`tab-store.ts`(102)、4 张卡片组件、`stores.client.spec.ts`(1160)、`slot-contract.ts`(27)；保留 Built-in plugins 外壳 |
| `ui-settings-shell` | **本版新增** | `README.md` 78、`package.json` 65、`src/client/index.ts` 53、`ShellCard.tsx` 55、`shell-card-controller.ts` 67、`tests/apply.client.spec.ts` 122 |
| `ui-settings-agent-loop` | **本版新增** | `README.md` 78、`src/client/index.ts` 50、`AgentLoopCard.tsx` 41、`agent-loop-card-controller.ts` 63 |
| `ui-settings-subagent` | **本版新增** | `README.md` 82、`src/client/index.ts` 93、`subagent-model-selection-card-controller.ts` 356、`SubagentModelSelectionFields.tsx` 128 |
| `ui-settings-web-search` | **本版新增** | `README.md` 79、`src/client/index.ts` 60、`web-search-card-controller.ts` 190 |
| `ui-primitives` | 改动（表单套件落到这里） | `src/settings-form/form-model.ts` **新增 393**、`fields.tsx` **新增 150**、`SettingsForm.tsx` **新增 74**；测试 `settings-form-model.client.spec.ts` 319、`settings-fields.client.spec.tsx` 152、`settings-form.client.spec.tsx` 82 |

配套的两个基础设施包：

| 包 | 状态 | 关键改动 |
|---|---|---|
| `packages/client/modules` | 改动 | `src/client/entries.ts` **新增 247**、`src/client/entry-lifecycle.ts` **新增 28**、`src/client/system.ts` 318 行改动、`src/index.ts` 378 行改动、`src/client/manifest.ts` 57 行改动、`tests/entries.client.spec.ts` **新增 517** |
| `packages/client/ui-settings` | 改动 | `src/client/config-form.ts`（由 `settings-scope.ts` 重命名）158 行改动、**`whileServed` 落在 `src/client/config-form.ts:317`**、`tests/while-served.client.spec.ts` **新增 94** |

### 支撑包

| 包 | 本区间 | 关键新文件 / 行数 |
|---|---|---|
| `packages/boot/app-boot` | 43 files, +8431 / -2804 | `src/compatibility-preflight.ts`(187)、`src/package-meta.ts`(172)、`src/profile-compatibility.ts`(141)、`src/profile-plugins.ts`(127)、`src/plugin-compatibility.ts`(103)、`src/profile-context.ts`(75)、`src/profile-sanitize.ts`(34)；`src/profile.ts` 704 行改动 |
| `packages/boot/hmr` | **本版新增包**（16 files, +2627 / -460） | `src/index.ts`(590)、`src/watch-config.ts`(92)、`src/error.ts`(41) |
| `packages/host/plugin-inventory` | 改动 | `src/index.ts` 76 行改动（`readPluginInventory` 被抽出为可复用函数）、`src/types.ts` 9 行改动（新增 `meta`） |
| `packages/util/package-manifest` | 改动 | `src/types.ts` 28 行改动、`src/index.ts` 5 行改动 |
| `packages/bundle/base` | 改动 | 新增 `plugin-manager` 与 `tool-plugin-manager` 两行，以及 `hmr` 行 |
| `packages/bundle/web-app` | 改动 | `cordis.patch.yml:275-276` 注册 `ui-plugin-manager`；`:387-397` 注册 4 个伴随设置页；`:426-427` 显式禁用全局 `tool-plugin-manager` 行；`presets/cordis.patch.yml:152-154`（Creator 使用的 `cordis` preset）才把它按 `!!js "!ctx.get('profileContext')"` 启用；`presets/{ptc,standard}` 仍为 `disabled: true`；`package.json:91,140` 依赖 |

---

## 关键类型

### 片段 A：`dsh.bundle` 与 `dsh.profile` 声明（本版有 Breaking 改动）

`packages/util/package-manifest/src/types.ts:29-39`（`DshManifest`）与 `:68-78`：

```ts
/** Public author fields under `package.json.dsh`; a package may declare several roles. */
export interface DshManifest {
  /** Manifest format version, independent of the npm package and Session format versions. */
  manifestVersion?: 1
  /** Bundle metadata consumed by the profile launcher. */
  bundle?: DshBundleManifest
  /** Profile metadata consumed by the profile launcher. */
  profile?: DshProfileManifest
  /** Client module loading and build metadata. */
  client?: DshClientManifest
}

/** The configuration layer exported by a bundle package. */
export interface DshBundleManifest {
  /** One patch file path, or an ordered list applied in sequence, each relative to the declaring package root. */
  patch: string | string[]
}

/** The bundle composition declared by a profile directory. */
export interface DshProfileManifest {
  /** Ordered bundle layer list, using installed package names. */
  bundles?: string[]
}
```

两处必须注意的变更（`git diff ... -- packages/util/package-manifest/src/types.ts` 原文）：

1. `patch` 由 `string` 放宽为 `string | string[]`；解析在 `packages/boot/app-boot/src/profile.ts:58-64` 的 `bundlePatchFiles()`，非法值抛出 `dsh.bundle.patch must be a file path or a list of file paths`；绝对路径化在 `:73-75` 的 `bundlePatchPaths()`。
2. `DshProfileManifest.patchReload` 与 `export type ProfilePatchReload = 'live' | 'startup'` **被整段删除**。全仓 grep 复核：`git grep -rn "patchReload\|PatchReload" -- packages docs` 在 0.1.7-rc.1 **输出为空**；在 0.1.6-alpha.1 有 30+ 处命中（含 `app-boot/src/profile.ts:60,91,142-158,197-211,788-890,919`）。reload 生命周期改由 HMR 条目在 YAML 里决定（`packages/bundle/base/cordis.patch.yml:27-32`）：

```yaml
    # Profile configuration reloads by default; module roots are opt-in.
    - id: hmr
      name: '@deepseek-ai/dsh-hmr'
      disabled: !!js "!ctx.get('profileContext')"
      config:
        root: []
```

`packages/boot/hmr/README.md` 的口径是："The final YAML composition controls whether HMR runs"，且"Existing configurations replace the module name `@deepseek-ai/cordis-plugin-hmr` with `@deepseek-ai/dsh-hmr`"。这同时是 `docs/user/develop/framework/index.md` 在本区间唯一一处改动的原因。

### 片段 B：本版新增的插件显示元数据类型

`packages/util/package-manifest/src/types.ts:41-54`：

```ts
/** Literal text or translations indexed by lowercase language id, with a required English fallback. */
export type LocalizedText = string | { readonly en: string; readonly [locale: string]: string }

/** Validated plugin display fields and diagnostics from exported locales, manifests, or icon files. */
export interface PluginLocalizedMeta {
  /** Display title; omission preserves the consumer's technical-name fallback. */
  readonly title?: LocalizedText
  /** Display introduction after locale and package-field fallback. */
  readonly description?: LocalizedText
  /** Base64 image data URL read from the manifest's icon file; render as an image, not inline markup. */
  readonly icon?: string
  /** Unmodified local metadata diagnostic; the plugin remains manageable. */
  readonly error?: string
}
```

`DshPackageManifest` 同时新增 `icon?: string`（`:15-16`，约束为"SVG/PNG/JPEG/WebP、≤256 KiB、realpath 后必须仍在 manifest 目录内"）。

`src/index.ts` 的导出面同步变化：删除 `ProfilePatchReload`，新增 `LocalizedText` 与 `PluginLocalizedMeta`（`git diff ... -- packages/util/package-manifest/src/index.ts` 原文）。注意该包仍**只有类型导出、没有运行时导出**（`types.ts:2-5` 与 README `Known Limitations`）。

### 片段 C：安装 spec 的四形态

`packages/boot/plugin-manager/src/install-spec.ts:9-18`：

```ts
export type ParsedInstallSpec =
  | { readonly kind: 'registry'; readonly spec: string; readonly name: string; readonly range?: string }
  | { readonly kind: 'path'; readonly spec: string; readonly path: string }
  | { readonly kind: 'tarball'; readonly spec: string; readonly path?: string; readonly host?: string }
  | { readonly kind: 'git'; readonly spec: string; readonly host: string }
```

判别正则（同文件 `:20-32`）：`GIT_SHORTHAND = /^(?:github|gitlab|bitbucket|gist):/i`、`GIT_URL`、`HOSTED_REPOSITORY_URL`、`TARBALL_SPEC = /\.(?:tgz|tar\.gz)(?:#.*)?$/i`、`PACKAGE_NAME`（含 214 字符上限 `PACKAGE_NAME_MAX_LENGTH`）。

两条对作者有约束力的规则（`parseInstallSpec`，`:68-91`）：

- **本地路径必须绝对**：相对路径与 `./`、`../` 一律 `InvalidInstallSpecError('a local path must be absolute')`。理由写在 `:59-62` 的 JSDoc：*"the Host's working directory means nothing to the person typing into a browser, and a relative path resolved against the profile would point inside it"*；
- URL 只能是 git 仓库或 tarball，否则 `a URL must point at a git repository or a tarball`（`:79-82`）。

### 片段 D：`inspect` 的七种拒绝与失败种类

`packages/boot/plugin-manager/src/types.ts:157-197`（`PluginSpecInspection`）：

```ts
export type PluginInspectProblem =
  | 'invalid-spec' | 'already-installed' | 'not-found' | 'not-a-package'
  | 'not-a-bundle' | 'network' | 'unknown'
```

`types.ts:83-94` 的失败种类（10 个）：

```ts
export type PluginInstallFailureKind =
  | 'pnpm-missing' | 'timeout' | 'not-found' | 'no-matching-version' | 'network'
  | 'disk-full' | 'permission' | 'build-blocked' | 'integrity' | 'unknown'
```

分类算法只有一处，文件注释即纪律说明（`install-failure.ts:1-6`）：*"pnpm names its failures with stable `ERR_PNPM_*` codes and Node's errno names, which the run's captured tail carries whatever the locale."* 判定顺序在 `LOG_KINDS`（`:20-30`）：`timedOut` 优先返回 `timeout`、`cause.code === 'ENOENT'` 返回 `pnpm-missing`，之后按"具体码先于通用网络家族"的模式表匹配。

失败的**归因**是另一个函数（`registry.ts:92-98`）：

```ts
export function attributeFailure(kind: PluginInstallFailureKind, log: string, spec: ParsedInstallSpec): 'registry' | 'spec-host' | 'other' {
  if (!NEXT_REGISTRY_KINDS.has(kind)) return 'other'
  const host = spec.kind === 'git' || spec.kind === 'tarball' ? spec.host?.toLowerCase() : undefined
  if (host === undefined) return 'registry'
  const named = log.split('\n').some(line => ERROR_LINE.test(line) && line.toLowerCase().includes(host))
  return named ? 'spec-host' : 'registry'
}
```

`NEXT_REGISTRY_KINDS = new Set(['network', 'timeout', 'not-found', 'no-matching-version'])`（`:79`）——**只有这四类才允许换下一个 registry**。

### 片段 E：强制校验的是 `peerDependencies`，不是 `engines.dsh`

`packages/boot/app-boot/src/plugin-compatibility.ts:61-88`：

```ts
export function evaluatePluginCompatibility(
  manifest: object,
  exemptions: Readonly<Record<string, readonly string[]>> = {},
  runtimeVersion = getDshRuntimeVersion(),
): PluginCompatibility | undefined {
  runtimeVersionOf(runtimeVersion)
  const fields = objectOf(manifest, 'Plugin manifest')
  if (!Object.hasOwn(fields, 'peerDependencies')) return undefined
  const dependencies = objectOf(fields.peerDependencies, 'Plugin manifest peerDependencies')
  const peers: Record<string, string> = {}
  for (const [name, range] of Object.entries(dependencies)) {
    if (typeof range !== 'string') { /* throw */ }
    if (name !== '@deepseek-ai/dsh' && !name.startsWith('@deepseek-ai/dsh-')) continue
    const requirement = ['workspace:^', 'workspace:~', 'workspace:*'].includes(range) ? runtimeVersion : range
    if (requirement.trim() === '' || !semver.satisfies(runtimeVersion, requirement, { includePrerelease: true })) {
      peers[name] = range
    }
  }
  if (Object.keys(peers).length === 0) return undefined
  // ... keys by `${name}@${version}`, compares against exemptions, returns { exempted }
}
```

三处必须说清的事实，均有实测背书：

1. **`engines.dsh` 至今没有任何运行时读取方。** `git grep -n "engines?.dsh\|engines\.dsh\|DshEnginesManifest" -- packages apps scripts python native` 的命中只有：`packages/util/package-manifest/src/types.ts:24`（字段声明）、`:57`（接口声明）、`src/index.ts:9`（类型再导出）、以及 4 处文档。**没有任何执行路径读取它**。`packages/util/package-manifest/README.md:93` 也明确写着："Current installers and loaders do not enforce `dsh.manifestVersion` or `engines.dsh`"。
2. 同理 `dsh.manifestVersion` 的唯一出现位置是 `types.ts:32`（`manifestVersion?: 1`）加文档；`apps/desktop/scripts/*` 里的同名函数是无关的本地辅助函数。所以官方 `packages/boot/app-boot/README.md:52` 的措辞才是准的："**These checks use peer declarations, not `engines.dsh`**"。
3. 因此**插件作者要声明兼容性，必须写 `peerDependencies`**（`@deepseek-ai/dsh` 或 `@deepseek-ai/dsh-*`），写 `engines.dsh` 不产生任何效果。`workspace:^` / `workspace:~` / `workspace:*` 三种源码工作区写法会被解释为"等于当前运行时版本"。

### 片段 F：精确版本豁免的存盘契约

`packages/boot/app-boot/src/profile-compatibility.ts:10` 与 `:42-53`：

```ts
/** Independent profile metadata; neither package manifests nor Cordis patches carry grants. */
export const PROFILE_COMPATIBILITY_FILENAME = 'compatibility.json'

export interface ProfileCompatibility {
  /** Accepted exact package-name@version keys mapped to their allowed DSH versions. */
  readonly exemptions: Record<string, string[]>
  /** Human-readable problems; empty when every record was accepted. */
  readonly warnings: string[]
  /**
   * Whether the file holds nothing this reader rejected, so a grant or revocation may rewrite it.
   * A false value means writing would discard content the user must repair by hand.
   */
  readonly rewritable: boolean
}
```

三条硬约束：

- **只接受精确版本**：`isExactPluginVersion`（`:24-27`）要求 `value === parsed.version(+build)`，range、前缀、空白全拒；校验在 `validatePluginVersionExemption`（`:34-40`）。
- **必须显式接受风险**：`setProfileVersionExemption` 在 `enabled && !acceptRisk` 时抛错（`:117-119`），且 `enabled && runtimeVersion !== current` 时拒绝（`:120-123`）。
- **坏文件 fail-closed 但不阻断启动**：`readProfileCompatibility` 对不可读/不可解析返回 `{ exemptions: {}, warnings, rewritable: false }`（`:64-77`），`compatibility-preflight.ts:96-98` 注释写明"must not stop the profile from starting"。

### 片段 G：`BundleInfo` 与 `ChangeResult`（客户端与工具看到的完整面）

`packages/boot/plugin-manager/src/types.ts:46-70`：

```ts
export interface BundleInfo {
  name: string
  version?: string
  /** Local display text with available translations or literal fallbacks, or a metadata diagnostic. */
  meta?: PluginLocalizedMeta
  /** Untranslated `description` of this bundle's package manifest. */
  description?: string
  /** Selected in the profile manifest; a load error means its layer was skipped. */
  enabled: boolean
  /** Whether the profile's own dependencies hold the package; false for a bundle the dsh installation supplies. */
  installed: boolean
  /**
   * Whether the installation ships the bundle for the person to switch on: named by the launcher's `OPTIONAL_BUNDLES`,
   * held by the installation's dependencies, selected by no shipped template, and never removable.
   */
  optional: boolean
  removable: boolean
  readOnlyReason?: ReadOnlyReason
  error?: ManagementError
  rows: BundleRowInfo[]
  overrides: string[]
}
```

`types.ts:110-136` 的 `ChangeResult` 是本版新增字段最集中的类型：`application` 新增 `'cancelled'`（`:114`）、新增 `bundle?: string`（`:124`）、`pendingBuilds?: string[]`（`:126`）、`approvedBuilds?: string[]`（`:128`）、`registries?: Registry[]`（`:130`）、`failedAt?: 'registry' | 'spec-host'`（`:135`）。

`ManagementError.code` 是 12 个可本地化的拒绝码（`types.ts:22`）：

```ts
code: ReadOnlyReason | 'unknown-plugin' | 'invalid-spec' | 'ambiguous-install' | 'not-bundle'
    | 'not-removable' | 'stop-profile' | 'bundle-in-use' | 'stale-approval'
    | 'incompatible-version' | 'operation-error'
```

其中 `incompatible-version` 额外携带 `IncompatiblePlugin[]`（`types.ts:11-18,24-25`），由 `failure.ts:27-29` 从 `PluginCompatibility` 投影而来。

### 片段 H：三个宿主事件

`packages/boot/plugin-manager/src/types.ts:234-257`（声明合并）：

```ts
'plugin-manager/changed'(change: PluginChange): void          // { reason: 'plugin'|'bundle'|'install'|'remove' }
'plugin-manager/install-log'(chunk: PluginInstallLogChunk): void
'plugin-manager/install-state'(progress: PluginInstallProgress): void
```

`changed` 的 JSDoc 里有一条对消费者重要的否定说明（`:238-240`）：*"A patch generation applied outside the manager, by HMR's watcher after a CLI or hand edit, announces nothing here."* —— 也就是说**手工改 patch 不会触发这个事件**，客户端不能把它当作"profile 有变"的通用信号。

`PluginInstallProgress.phase` 的取值与尝试信息（`types.ts:199-205`）：

```ts
export interface PluginInstallProgress {
  readonly requestId: PluginInstallRequestId
  readonly phase: 'installing' | 'cancelling' | 'applying'
  /** With `installing`: the registry this attempt asks, its one-based position, and how many the installation may ask. */
  readonly attempt?: { readonly registry: Registry; readonly index: number; readonly total: number }
}
```

### 片段 I：Plugins 页向其他插件开放的 7 个席位

`packages/client/ui-plugin-manager/src/client/slot-contract.ts:75-121`（`SlotMap` 声明合并）。7 个席位分两组：

配置席位（3 个 + 1 个列表）：

| 席位 | kind | 键 | owner props |
|---|---|---|---|
| `plugins.bundle.activation` | keyed | npm 包名 | `PluginActivationOwnerProps`（`:67-73`） |
| `plugins.item` | list | — | `PluginConfigViewProps`（`:23-28`） |
| `plugins.bundle.config` | keyed | bundle 包名 | `PluginConfigViewProps` |
| `plugins.row.config` | keyed | `<包名>#<row id>` | `PluginConfigViewProps` |

详情页席位（3 个，均 list，均以"页面的 subject"渲染）：

```ts
'plugins.detail.actions': { kind: 'list'; scope: 'root'; owner: PluginDetailProps }
'plugins.detail.badge':   { kind: 'list'; scope: 'root'; owner: PluginDetailProps }
'plugins.detail.section': { kind: 'list'; scope: 'root'; owner: PluginDetailProps }
```

subject 是一个**投影**而非 store（`slot-contract.ts:54-64`）：

```ts
export type PluginsSubject =
  | { readonly kind: 'bundle'; readonly pkg: PluginPackageRef }
  | { readonly kind: 'row'; readonly pkg: PluginPackageRef; readonly row: PluginRowRef }
  | { readonly kind: 'item'; readonly id: string }
```

`PluginPackageRef`（`:41-52`）只带 `name / version? / installed / enabled / rows`，`PluginRowRef`（`:31-38`）只带 `rowId / moduleName / enabled`。文件头注释（`:1-17`）说明了这个设计的硬约束：**贡献方只做 `import type` 合并，绝不在运行时导入本包**。

页面对这些席位的实际声明在其 `children`（`packages/client/ui-plugin-manager/src/client/index.ts:90-98`），与 SlotMap 一一对应 —— 这是 `ui-slots` 的"children = 声明 + 授权"规则的落地。

### 片段 J：客户端安装状态机

`packages/client/ui-plugin-manager/src/client/manager-store.ts:149-212`：

```ts
export interface InstallState {
  readonly open: boolean
  readonly spec: string
  readonly mirrorRecovery?: boolean
  readonly registries: PluginRegistries | null
  readonly registry: RegistryChoice
  readonly registryOpen: boolean
  readonly registryError: boolean
  readonly attempts: { readonly registries: readonly Registry[]; readonly total: number } | null
  readonly phase: 'idle' | 'checking' | 'starting' | 'running' | 'cancelling' | 'applying' | 'unconfirmed' | 'unknown' | 'done' | 'failed'
  readonly requestId?: PluginInstallRequestId
  readonly inputError: InstallInputError | null
  readonly subject: InstallSubject | null
  readonly runs: readonly InstallRun[]
  readonly detailsOpen: boolean
  readonly installed: string | null
  readonly restartRequired: boolean
  readonly failure: { /* reason, code?, incompatible?, kind?, failedAt?, pendingBuilds?, uncertainty? */ } | null
  readonly approvedBuilds: readonly string[]
  readonly enabling: boolean
}

export function isInstallPending(phase: InstallState['phase']): boolean {
  return phase === 'starting' || phase === 'running' || phase === 'cancelling' || phase === 'applying' || phase === 'unconfirmed'
}
```

两个易混相位在 `:142-147` 的 JSDoc 有定义：`unconfirmed` 表示"请求仍未决"，`unknown` 表示"宿主报告无活跃请求且原始回复丢失"——**两者都不代表已取消**。`failure.uncertainty` 用 `'result' | 'cancellation' | 'acceptance'` 区分三种不确定（`:197`）。

`RegistryChoice`（`:100-106`）区分"宿主提供的 registry"与"用户手输的 URL"；`OFFICIAL_REGISTRY = { kind: 'offered', registry: null }` 是**宿主未答复前的默认显示值**（`null` = pnpm 自身配置所指的那一个）。

GitHub 恢复路径是一个纯函数（`:219-225`）：

```ts
export function githubRecoveryRegistry(install: InstallState): string | undefined {
  if (install.phase !== 'failed' || install.failure?.failedAt !== 'spec-host'
    || (install.failure.kind !== 'network' && install.failure.kind !== 'timeout')) return undefined
  const host = install.subject?.host?.toLowerCase().split(':')[0]
  if (host !== 'github.com' && !host?.endsWith('.github.com')) return undefined
  return offeredRegistries(install.registries).find((registry): registry is string =>
    registry !== null && new URL(registry).hostname === 'registry.npmmirror.com')
}
```

### 片段 K：`plugin_manager` 工具的 8 个 action

`packages/boot/plugin-manager/src/tools.ts:13` 与 `:23`：

```ts
export const inject = ['tools', 'pluginManager', 'sandboxPolicy']

// parameters.action 的 enum：
['list_plugins', 'list_bundles', 'set_plugin', 'set_bundle',
 'install_bundle', 'remove_bundle', 'list_version_exemptions', 'set_version_exemption']
```

每次执行（**包括只读的 list**）都先走沙箱升级审批（`tools.ts:38-43`）：

```ts
const policy = ctx.sandboxPolicy.resolve(exec.agent === undefined ? {} : { session: exec.agent.session })
await approveEscalation({
  requestedMode: 'danger-full-access', effectiveMode: policy.mode, subject: 'plugin management operation',
  justification: `plugin_manager ${JSON.stringify(args)}. Profile changes persist across sessions; installed Host code runs outside the workspace sandbox.`,
}, { approver: ctx.get('approval'), agent: exec.agent, callId: exec.callId, toolName: 'plugin_manager', signal: exec.signal })
```

该工具在 `packages/bundle/base/cordis.patch.yml:16-18` 里默认 `disabled: true`，`packages/bundle/web-app/cordis.patch.yml:426-427` 再次显式禁用全局行；真正启用它的是 Creator 模式所用的 `cordis` preset（`packages/bundle/web-app/presets/cordis.patch.yml:152-154`）：

```yaml
          - id: tool-plugin-manager
            name: '@deepseek-ai/dsh-plugin-manager/tools'
            disabled: !!js "!ctx.get('profileContext')"
```

即"有 profile 上下文即启用"。`presets/ptc.patch.yml:150-152` 与 `presets/standard.patch.yml:144-146` 保持 `disabled: true`。这与 note `2026-09-16-creator-persistent-plugin-management.md:19` 的"the agent tool is enabled in Creator mode and disabled by default in the base bundle and other shipped presets"完全一致。

---

## 数据流

### 一、引导式安装的状态机

权威依据：`.agents/notes/implemented/architecture/2026-09-15-guided-plugin-installation.md`（本版新增，47 行）+ `src/index.ts:461-594` + `manager-store.ts:730-960`。

**宿主侧**（`PluginManager.installBundle`）：

| 阶段 | 代码位置 | 动作 |
|---|---|---|
| ① 拒绝明显非法 | `index.ts:471-472` | `spec === '' \|\| spec.startsWith('-')` → `ManagementFailure('invalid-spec')`；已取消 → `InstallCancelledError` |
| ② 记录脚本批准 | `:473-476` | `approvedBuilds` 先落盘（`approveBuilds`），再写进 `result.approvedBuilds` |
| ③ 快照文件 | `:477` | `readRestoredFiles()` 读 `package.json` 与 `pnpm-lock.yaml`（`RESTORED_FILES`，`:79`）；不存在的文件记为 `undefined` |
| ④ GitHub 连通性检查 | `:482-496` | 仅对 `github.com` 系 git spec 跑 `git ls-remote`（`github-connection.ts:31-33`），预算 `githubConnectionTimeoutMs`；只有 `network` / `timeout` 阻止安装，其余（含认证）留给 pnpm；失败置 `failedAt: 'spec-host'` |
| ⑤ 解析计划 | `:498` | `registryPlan(options?.registry, await this.registries())` |
| ⑥ 逐 registry 运行 | `:500-522` | 每轮：`index > 0` 先 `restoreFiles`，再次检查取消，push 到 `result.registries`，`announce('installing', {registry, index: index+1, total})`，然后 `runPnpm(['add', spec, ...registryArguments(registry)])` |
| ⑦ 判定是否换下一个 | `:509-521` | `run.incompatible !== undefined` 立刻抛 `incompatible-version`（**不换 registry**）；`exitCode === 0 && !timedOut` 才算成功 break；`timedOut === true` 直接 break（**不换 registry**）；否则按 `attributeFailure` 决定 |
| ⑧ 失败处理 | `:526-535` | 读 `pendingBuilds`（读失败仅告警），然后抛 `Error(run.output)` → 被 `:549-553` 的 catch 回滚文件 |
| ⑨ 识别装出来的包 | `:536-542` | 比较前后 `dependencies`；registry 重试可能保留已保存的 range，故补一次按 spec 前缀匹配；不唯一 → `ambiguous-install` |
| ⑩ bundle 校验 | `:543-548` | 无 `dsh.bundle` → `not-bundle`；不兼容 → `incompatible-version`；随后逐个 `loadOverlayPatches` 预加载 patch 文件（**验证 patch 可读**） |
| ⑪ 应用 | `:554-563` | `control.phase = 'applying'`；`announce('applying')`；`enabled !== false` 才 `selectBundle`；包**原本就在 profile 里** → `'restart-required'`（不 reload）；否则 reload |

**关键不变式**：`applying` 之后不可停止（`cancelInstall` 在 `:588` 返回 `too-late`），因为此时 bundle 正在被选中与加载。

**客户端侧**（`manager-store.ts`）的相位与宿主相位的对应关系：

| 客户端 phase | 由什么置入 | 对应宿主 |
|---|---|---|
| `idle` | 初始 / 校验被拒后回到输入态（`:741,754,770,775`） | — |
| `checking` | `install()` 调 `inspect` 前（`:754`） | `inspect` |
| `starting` | `inspect` 接受后、带 `requestId` 发起 `installBundle`（`:791`） | 宿主 ②–⑤ |
| `running` | 收到 `install-state: installing`（`:602`） | 宿主 ⑥ |
| `cancelling` | 用户点关闭且需要确认取消（`:903`） | 宿主 `cancelling` |
| `applying` | 收到 `install-state: applying`（`:918`）或本地推断（`:862`） | 宿主 ⑪ |
| `unconfirmed` | 取消后尚未得到宿主确认（`:862`） | 宿主仍未 settle |
| `unknown` | 宿主答 `waitForInstall` 为 `null`（`:825`） | 无活跃请求 |
| `done` / `failed` | 结果按 `exitCode` 分流（`:842,848`） | `ChangeResult` |

三处"宿主确认"细节值得作者注意：

- **取消必须等宿主答复**。`cancelInstall` 只在"Git 检查或 pnpm 已退出且文件已回写"后才返回 `cancelled`（`index.ts:579-594`）；客户端在收到答复前停在 `unconfirmed`，**不把连接中断当作确认**（note 原文："an aborted RPC or a lost connection is not a confirmation"）。
- **丢应答可恢复**。`waitForInstall(requestId)`（`index.ts:574-577`）让客户端等活跃安装的结局；返回 `null` 只说明"当前没有这个请求"，**既不证明成功也不证明取消**。
- **安装默认不启用**。`installBundle` 的 `options.enabled` 默认 `true`，但**引导式对话框传 `false`**（note: "The run installs with `enabled: false`"），完成屏才提供"立即启用"，且 `installed` 字段在启用前一直保留（`manager-store.ts:176-177`）。

**失败屏的脚本审批闭环**（`build-approval.ts`）：pnpm 11 把未决依赖脚本写成 `allowBuilds.<name>: 'set this to true or false'`；`readPendingBuilds` 只挑出**非通配**（`!/[*?]/`）且值恰为该提示串的键（`:25-27`）；`approveBuilds` 只接受**仍在 pending 里**的名字，否则 `ManagementFailure('stale-approval')`（`:44-49`）；`allowBuilds` 中出现 YAML anchor/alias 一律抛错（`:20-24`）。这也解释了为什么回滚文件清单里**故意不含** `pnpm-workspace.yaml`（`index.ts:79` 只有两个文件；注释 `:529` 写明原因）。

### 二、注册表计划与失败归因

权威依据：`.agents/notes/implemented/architecture/2026-09-18-plugin-install-registries.md`（本版新增，45 行）+ `registry.ts`。

`registryPlan(requested, configured)`（`registry.ts:54-76`）的判定顺序：

1. 把配置里的首选项 + fallbacks 归一到"pnpm 比较形式"（小写 host + 尾斜杠，`normalizeRegistry` `:28-37`）；
2. `ownIsPublic = own === OFFICIAL_NPM_REGISTRY || fallbacks.includes(own)`（`:57`）——**pnpm 自身配置所指的 registry 只有被证明为公开时才可加入计划**；
3. 逐个归一化、去重（`:60-68`）；
4. 若请求的（或默认的）是 `null` 或等于 `own`，且 `own` 不公开 → **只问它一个**（`:73`）——私有 registry 永不回落到公开 registry；
5. 请求的 registry 不在配置集合里 → **只问它一个**（`:74`）；
6. 否则返回"请求的 + 集合里其余"（`:75`）。

`inspect` 侧的落地（`index.ts:376-415`）：循环 `for (const current of plan)`，每次 `viewProfilePackage(...)` 带 `--registry` 与 `--config.fetch-retries=0`（`operations.ts:565-571`），失败原因读 stdout 上的 JSON（`printedError`，`index.ts:147-155`，因为 *"pnpm prints a refusal as `{ error: { code, message } }` on stdout with nothing on stderr"*），并且**只有 `signal?.aborted !== true` 且归因为 `registry` 时才继续**（`:393`）。

`registries()`（`index.ts:324-332`）返回 `PluginRegistries`：

```ts
export interface PluginRegistries {
  readonly registry: Registry
  readonly fallbackRegistries: readonly string[]
  /** The URL pnpm's own configuration names in the profile, read from pnpm; null when it could not be read. */
  readonly resolved: string | null
}
```

`resolved` 由 `execa(pnpm, ['config','get','registry'])` 读得（`operations.ts:534-543`），只取**最后一行**（pnpm 可能先打提示语），非 http(s) 则返回 `null`。

配置默认值（`index.ts:178-187`，与 `README.md` 表格一致）：

| 字段 | 默认 |
|---|---|
| `pnpmCommand` | `pnpm` |
| `outputBytes` | `16384` |
| `lockWaitMs` | `120000` |
| `inspectTimeoutMs` | `20000`（min 1000） |
| `githubConnectionTimeoutMs` | `5000`（min 1000） |
| `idleTimeoutMs` | `600000`（min 1000） |
| `registry` | 无默认（pattern `REGISTRY_URL`），含义是"pnpm 自身配置所指" |
| `fallbackRegistries` | `[NPMMIRROR_REGISTRY]`（= `https://registry.npmmirror.com/`） |

浏览器侧另有一个独立服务 `PluginRegistryProbe`（`packages/client/ui-plugin-manager/src/index.ts:25-86`），Config 为 `registryProbeEnabled: true` / `registryProbeTimeoutMs: 1500` / `registryProbeCacheTtlMs: 300000`，用 `Promise.any` 竞争 `https://registry.npmjs.org/-/ping` 与 `https://registry.npmmirror.com/-/ping`。注意官方 note 明确写了**选择权在客户端**（`:24` 注释："Compares public registry responses on the Host; the Client owns the initial selection."）。

### 三、manifest → 包目录 → 本地化元数据

权威依据：`.agents/notes/implemented/architecture/2026-09-18-localized-package-metadata.md`（本版新增，87 行）+ `packages/boot/app-boot/src/package-meta.ts`。

`readPluginMeta(specifier, parentURL)`（`package-meta.ts:148-172`）的解析链：

1. **非包 specifier 直接跳过**：`if (barePackageName(specifier) === undefined) return undefined`（`:149`）——文件路径、`file:` URL、Windows 盘符/UNC 路径**不做兄弟资源查找**，直接没有元数据；
2. 解析 `${specifier}/locale/en.json`（`optionalResourcePath`，`:65-72`）作为**语言发现的锚点**；
3. `dictionariesOf`（`:101-122`）读取同一物理目录下的全部 `.json`，语言码取自文件名并强制小写去重，且要求"每个文件 realpath 后与英文文件同目录"（`:111-113`）；
4. 解析 `${specifier}/package.json` 作为**同地址回落**：`title` ← `name`，`description` ← `description`；title 的最终回落是**完整 Cordis 插件名**（`:155`）；
5. `icon` 单独读取并做四项校验（`iconOf`，`:21-41`）：必须是相对路径、扩展名在白名单、realpath 后在 manifest 目录内、≤256 KiB，产出 `data:<mime>;base64,...`；
6. **图标失败不影响文字**：`try { icon = ... } catch { return { ...text, error: ... } }`（`:162-166`），最外层再兜一层 `catch` 把任何异常变成 `{ error }`（`:169-171`）。

`localizedText`（`:124-133`）负责产出"带必需英文回落的语言映射"：没有任何语言提供该字段时直接返回 package 回落值；否则返回 `{ en: fallback ?? finalFallback, ...entries }`。

宿主把这份 `PluginLocalizedMeta` 挂到三个地方：`PluginInventoryEntry.meta`（`packages/host/plugin-inventory/src/types.ts:21-22`）、`AgentPresetPluginRow.meta`（`:37-38`）、`BundleInfo.meta` / `BundleRowInfo.meta`（`plugin-manager/src/types.ts:41,51`）。工具侧**刻意剥离**：`tools.ts:62-65` 在序列化前解构丢弃 `meta`（`({ meta: _meta, ...row })`），README `:44` 也明说 "The `plugin_manager` tool omits UI display metadata from list results"。

一个目录级事实（`readPluginInventory` 被抽出为可导出函数，`packages/host/plugin-inventory/src/index.ts:76+`）：entry 的 `meta` 用 `entry.parent.tree.ctx.baseUrl` 作为解析父 URL；preset 行的 `meta` 用 `ctx.baseUrl`。这决定了**哪些位置能读到元数据**。

### 四、插件配置与详情页扩展席位的注册路径

权威依据：`2026-09-16-plugin-configuration-on-the-plugins-page.md`（41 行）、`2026-09-17-plugin-detail-page-extension-slots.md`（35 行）、`2026-09-17-settings-pages-as-companion-packages.md`（40 行）。

**(a) 社区 bundle 自带配置页**：在自己的浏览器半里 `ctx.slots.inject('plugins.bundle.config' | 'plugins.row.config', ...)`，读写在 `ctx.settingsScope` 上，词典用自己的。归因方式是"**注册方在席位名和键里声明归属**"——没有 manifest 字段、没有注册元数据、不向 settings 服务索取 owner 信息。后果（note 原文）："a bundle's patch must declare the row under the id in the key"，因为 `dsh-client-modules` 把浏览器半挂在**specifier 为裸包名的那一行**上，所以 subpath 行的页面会随根行消失而不是随自己消失。

**(b) 形式机制在 `ui-primitives`**：`SettingsFormModel` + `settingsNumberField` / `settingsTextField`、`SettingsValueField` / `SettingsSecretField`、`SettingsForm` 框架。实测导出位置：`packages/client/ui-primitives/src/index.ts:62`（`SettingsSecretField, SettingsValueField`）、`:64`（`SettingsFormModel, settingsNumberField, settingsTextField`）。表单框架把文案收成 `labels`，模型收结构化的 scope，因此基线包不依赖任何插件或它的词典（note 原文）。

**(c) 伴随包的注册规则**：`packages/client/ui-settings/src/client/config-form.ts:317` 的

```ts
whileServed(namespaces: readonly string[], register: (served: ReadonlySet<string>) => () => void): () => void
```

语义是"**页面只在宿主服务其 namespace 期间存在**"：服务观察共享 describe 镜像，namespace 出现时注册、全部消失时销毁。这条规则让 4 个页面共享一条规则而不是 4 份拷贝（note 原文："so four packages share one rule instead of four copies"）。

**(d) 页面自己画标题与图标**：`slot-contract.ts` 头注释写明 *"The page draws the title, icon, and crumb itself."*（`:16`），而归一化名称格式化的规则归本地化元数据决策所有（`2026-09-18-localized-package-metadata.md`）。

**(e) 席位目录的权威副本**：这 7 个席位同时出现在 `packages/extensions/cordis-client-runner/src/client/slot-catalog.ts` 的生成目录里（实测 `plugins.bundle.activation` `:1802`、`plugins.bundle.config` `:1840`、`plugins.detail.actions` `:1880`、`plugins.detail.badge` `:1930`、`plugins.detail.section` `:1980`、`plugins.item` `:2030`、`plugins.row.config` `:2085`）。`tool-cordis` 的两个只读工具就是模型读取这份目录的入口——这也是为什么这两个 `*-catalog.ts` 在本区间各自增长了两千余行。

### 五、profile 插件宿主运行实例的解析

权威依据：`.agents/notes/implemented/architecture/2026-09-18-profile-plugin-host-runtime-instances.md`（37 行）。

**问题**：profile 安装的树外插件沿祖先 `node_modules` 链解析裸 specifier，而 profile 自己的层坐在"运行时解析拦截层"之上，于是它通过 `dependencies` 边到达的每个包都拿到**自己的一份拷贝**，而加载它的宿主保留安装体的那一份。对多数包无所谓；`@deepseek-ai/dsh-scope` 不行——它用**模块局部** `Symbol('dsh.scope')` 打标签，用模块局部表存 scope 父链与事件载体键，所有按身份比较标签的注册表（工具注册、prompt 段落、MCP 资源、scoped 事件）都会失配。note 记录了生产事故 #4573：Playwright MCP 提供商被 mount 后装了第二份 `dsh-scope`，第一个 Agent 的 MCP 工具注册到全局层，第二个 Agent 的工具同步冲突，`failOnStartupError: true` 使冲突升级为拒绝创建 Agent。

**规则**（note: Decision）：树外插件把"跨实例身份重要"的宿主运行时写进**匹配的 `peerDependencies` 与 `devDependencies`**，**绝不写进 `dependencies`**。profile 的 pnpm 设置是 `nodeLinker: hoisted` + `autoInstallPeers: false`，所以这类 peer 不会被装进 profile，导入会通过运行时解析在 `$DSH_HOME/profiles/node_modules` 的拦截层走到安装体的单一实例。

**验证位置**（实测文件存在）：`packages/experimental/browser-use-runtime/tests/shared-host-runtimes.spec.ts`（钉住该包的依赖分区）与同目录 `tests/host-runtime-duplication.spec.ts`（复现该规则防止的故障）。

**由写作侧的注意点**：note 与 `docs/user/develop/basic/publish.md` 在本区间新增了对应段落（`publish.md` 本区间 +8/-1），其中这一段是插件作者可直接照做的：

> A linked checkout keeps its own `node_modules`. Declare dsh packages whose instances the plugin must share with the host under both `peerDependencies` and `devDependencies`, as the harness packages do. […] Keep independently versioned third-party dependencies and stateless dsh utilities under `dependencies`.

---

## 测试覆盖

以下均为**实测存在的文件**（未运行测试；本任务为文档撰写，未执行 `pnpm run test:gui` 等门禁）。

### 宿主侧：`packages/boot/plugin-manager/tests/`（10 文件）

| 文件 | 行数 | 覆盖 |
|---|---|---|
| `manager.spec.ts` | 1396 | `inspect`（stub registry + 真实目录）、流式运行、停止并检查回滚文件、change 事件、逐 registry 询问、恢复文件、在 git host 与集合外 registry 停止、兼容性豁免 |
| `operations.spec.ts` | 821 | registry 查询参数、pnpm 自身 registry 的读取 |
| `tools.spec.ts` | 248 | 工具的 8 个 action 与审批路径 |
| `github-connection.spec.ts` | 183 | 用**真实 Git** 对自有 loopback transport 覆盖立即失败、超时、取消、非交互认证 |
| `operations-process.spec.ts` | 141 | 进程树等待与终止 |
| `registry.spec.ts` | 117 | 计划（含私有与未知 pnpm registry）与失败归因 |
| `patch.spec.ts` | 84 | 保留注释的 `disabled` 写入 |
| `install-spec.spec.ts` | 83 | 四种 spec 形态与分类器输入 |
| `build-approval.spec.ts` | 69 | `allowBuilds` 读写与 stale 拒绝 |
| `run-tree.spec.ts` | 47 | 进程组探活与等待边界 |

### 客户端侧：`packages/client/ui-plugin-manager/tests/`（5 文件）

| 文件 | 行数 |
|---|---|
| `components.client.spec.tsx` | 1420 |
| `manager-store.client.spec.ts` | 1342 |
| `registry-probe.host.spec.ts` | 136 |
| `browser-plugin.client.spec.tsx` | 122 |
| `config-ledger.client.spec.ts` | 103 |

按 note `2026-09-15-guided-plugin-installation.md:45-46` 的说法，这些测试覆盖 store 的相位、宿主确认的取消、安装后启用、toast 与页面四屏；`registry-probe.host.spec.ts` 覆盖新的宿主探测服务。

### e2e 车道（`apps/web/tests/`，实测 6 个文件存在）

`plugin-manager.e2e.ts`、`plugin-install-cancel.e2e.ts`、`plugin-install-approve.e2e.ts`、`plugin-install-github.e2e.ts`、`plugin-install-registry.e2e.ts`、`plugin-config.e2e.ts`。

同区间的其他相关测试（实测存在）：`packages/experimental/browser-use-runtime/tests/{shared-host-runtimes,host-runtime-duplication}.spec.ts`；`packages/client/modules/tests/entries.client.spec.ts`（517 行，本版新增）；`packages/client/ui-settings/tests/while-served.client.spec.ts`（94 行，本版新增）；`packages/client/ui-primitives/tests/settings-form-model.client.spec.ts`（319 行，本版新增）。

---

## 与上下游的关系

**上游（被本篇依赖）**

| 上游 | 关系 |
|---|---|
| `packages/util/package-manifest` | 提供 `DshPackageManifest` / `DshBundleManifest` / `PluginLocalizedMeta` 等纯类型；**无运行时导出** |
| `packages/boot/app-boot` | 提供 profile 解析（`readProfileManifest`、`resolveBundleDir`、`loadOverlayPatches`、`composeEntries`、`reconcileProfilePatches`、`OPTIONAL_BUNDLES`）、兼容性校验（`evaluatePluginCompatibility`、`getDshRuntimeVersion`）、豁免存盘（`readProfileCompatibility`、`setProfileVersionExemption`）、元数据读取（`readPluginMeta`）、导入前拦截（`prepareProfileEntries`） |
| `packages/core`（Loader） | `PluginManager.static inject = ['loader', 'profileContext']`（`index.ts:177`）；bundle 行来自 `composeEntries` over `loadOverlayPatches` |
| `packages/boot/hmr` | 事务串行化入口 `hmr.runExclusive()`（`index.ts:756-760`）；无 HMR 时 `configure()` 直接执行、`reload()` 返回 `[]`（`:762-765`） |
| `packages/client/modules` | 决定浏览器半挂在哪一行；本版新增 `entries.ts`（247 行）与 `entry-lifecycle.ts`（28 行） |

**下游（依赖本篇）**

| 下游 | 关系 |
|---|---|
| `apps/cli/src/plugin.ts` | `import { runPluginCommand, setProfileVersionExemption } from '@deepseek-ai/dsh-plugin-manager/operations'` —— CLI 与服务共用同一实现；新增子命令 `version-exemptions` / `allow-version` / `revoke-version`（`apps/cli/src/plugin.ts:13,26,34,46`） |
| `packages/bundle/base`、`packages/bundle/web-app` | 插入 `plugin-manager` 行（base `:20-22`）与 `tool-plugin-manager` 行（base `:16-18`）；web-app 层把全局 `tool-plugin-manager` 覆盖为 `disabled: true`（`:426-427`）并由 `presets/cordis.patch.yml:152-154` 启用；注册 `ui-plugin-manager` 行（web-app `:275-276`）与 4 个伴随设置页行（`:387-397`） |
| Agent 会话 | `plugin_manager` 工具在 Creator 模式启用；工具结果**不注入消息**到 Agent（README `:115`） |
| Web UI | `ui-plugin-manager` 通过 `ctx.remote.pluginManager` 与三个事件驱动页面 |
| Desktop | note `2026-09-16-creator-persistent-plugin-management.md:19` 说明 Desktop 通过 launcher 提供的 profile facts 供给自己的 pnpm 入口与 Electron Node 调用；README `:135` 记录"Desktop package operations remain owned by the Desktop shell" |

**一条容易踩的边界**（README `:131-133` 的 Known Limitations）：管理器**不能**禁用自身的管理组件、不能改另一个 profile、不能编辑 agent preset 的 composition；启动型 profile 无法移除启动当前进程所用的包，需要先停进程再用 `dsh plugin`。

---

## 本版本变更要点（0.1.6-alpha.1 → 0.1.7-rc.1）

### 1. 插件管理从零新增（最大的单点）

`packages/boot/plugin-manager`（28 新文件，`src` 12 + `tests` 10）与 `packages/client/ui-plugin-manager`（21 新文件）在本区间**同时诞生**：`git log --diff-filter=A -- packages/client/ui-plugin-manager/package.json` 唯一命中的是 `08974835d7 refactor(web): rename ui-settings-plugin-manager to ui-plugin-manager` —— 即该包在被重命名前叫 `ui-settings-plugin-manager`，而 `git cat-file -e dsh-v0.1.6-alpha.1:packages/client/ui-settings-plugin-manager/package.json` 返回 128。**结论：0.1.6-alpha.1 根本没有侧边栏 Plugins 页**；侧边栏 `sidebar.panellist` 在该 tag 下**没有任何产品注册**（`git grep "sidebar.panellist" dsh-v0.1.6-alpha.1 -- packages/client` 只命中 `ui-sidebar` 自己的契约、实现与测试，`README.md:36` 明写 "The shipped composition registers no example panel."）。

### 2. `dsh.profile.patchReload` 删除 + HMR 包改名（**Breaking**）

- 类型层：`ProfilePatchReload` 与 `DshProfileManifest.patchReload` 删除（`packages/util/package-manifest/src/types.ts`）。
- 行为层：`patchReload` 在 0.1.6 出现在 `app-boot/src/profile.ts` 的 14 处（模板默认值、校验、`initProfile` 参数、`loadProfileDirectory` 读取）；本版 `app-boot/src/profile.ts` 该 704 行改动中已无此概念。
- 替代：HMR 条目在 YAML 中控制（`packages/bundle/base/cordis.patch.yml:27-32`）。
- 包改名：`@deepseek-ai/cordis-plugin-hmr` → `@deepseek-ai/dsh-hmr`。`docs/user/develop/framework/index.md` 在本区间**唯一一处改动**就是这一行（HMR 小节）。
- 迁移动作：把 profile/patch 里的 `patchReload: live|startup` 删掉，改为对 `hmr` 行做 enable/disable 或配置 `root`。

### 3. `dsh.bundle.patch` 接受有序文件列表（**非破坏性放宽**）

`DshBundleManifest.patch: string | string[]`（`types.ts:69-72`），解析 `bundlePatchFiles`（`profile.ts:58-64`），绝对化 `bundlePatchPaths`（`:73-75`），应用顺序 = 列表顺序，且"each file's relative plugin paths resolve beside that file"（`docs/user/develop/basic/publish.md` 本区间新增句）。对应提交：`654caa4bbd feat(bundle): accept an ordered patch file list in dsh.bundle.patch (#4722)`。

### 4. 兼容性从"声明"变为"强制"，且豁免是精确版本（**Breaking for some plugins**）

- 新增 `packages/boot/app-boot/src/plugin-compatibility.ts`（103 行，全新）。
- 新增 `packages/boot/app-boot/src/profile-compatibility.ts`（141 行，全新）：`compatibility.json`、精确版本校验、`acceptRisk` 门槛、`rewritable` fail-closed。
- 新增 `packages/boot/app-boot/src/compatibility-preflight.ts`（187 行，全新）：**在 Loader 导入之前**拒绝；被拒的普通行获得 `disabled`，而"一个 native Include 若触及被拒插件则整体拒绝，因为它的文件永不被重写"（`:63-66`）。
- `ManagementError` 新增 `'incompatible-version'` 与 `incompatible?: IncompatiblePlugin[]`（`plugin-manager/src/types.ts:22-25`）。
- 新增 CLI：`dsh plugin version-exemptions` / `allow-version <pkg@ver> --dsh-version <exact> --accept-risk` / `revoke-version <pkg@ver> --dsh-version <exact>`（`apps/cli/src/plugin.ts:13,26,30,34,46`）。
- 新增工具 action：`list_version_exemptions`、`set_version_exemption`（`tools.ts:23`），且授予必须 `acceptRisk: true`。
- 再次强调：**检查对象是 `peerDependencies`，不是 `engines.dsh`**（`packages/boot/app-boot/README.md:52` 原文明说）。

### 5. 插件自有本地化显示元数据（新增作者能力）

新增 `LocalizedText` / `PluginLocalizedMeta`（`types.ts:41-54`）、`DshPackageManifest.icon`（`:15-16`）、`app-boot/src/package-meta.ts`（172 行，全新，导出 `readPluginMeta`、`resolvePluginResource`）。作者动作：在包里放 `locale/en.json`（`{ "meta": { "title", "description" } }`）并在 `exports` 中暴露 `./locale/*.json`；需要图标时在 `package.json` 声明相对 `icon`。规范入口：`docs/cookbook/adding-a-package.md#plugin-display-metadata`（实测锚点存在于 `:112`，示例在 `:116`，回落表在 `:143`）。

### 6. 详情页三个扩展席位 + 配置上移到 Plugins 页（新增扩展点）

- 新增 3 个席位（`slot-contract.ts:108,113,120`），并保留 4 个配置席位。
- 配置从 Settings 的"Plugin configuration"标签页**搬到了 Plugins 页**；`ui-settings-plugins` 只留 Built-in plugins 外壳，`settings.plugin.item` 席位退役（note `2026-09-16-plugin-configuration-on-the-plugins-page.md:21`）。
- Settings 保留**只读** inventory（`ui-settings-plugin-inventory/README.md:12`）。

### 7. 设置页作为伴随包（新增架构模式）

`ui-settings-shell` / `ui-settings-agent-loop` / `ui-settings-subagent` / `ui-settings-web-search` 四个**纯客户端包**在本区间新增（各自 `README.md` 78–82 行、`package.json` 65–66 行、`src/client/index.ts` 50–93 行、`src/index.ts` 空宿主 `apply`）。`ui-settings-plugins` 相应删除 4 张卡片、`card-form.ts`、`fields.tsx`、`tab-store.ts` 及 1160 行测试。注册规则收敛为 `whileServed`（`ui-settings/src/client/config-form.ts:317`）。附带一条细节：shell 页的 `plugins.item` id 由 `bash` 改为 `shell`，因为官方页的 `subject.id` 现在是 `plugins.detail.*` 用来分流的判别符，"id 命名的是页面编辑的能力，而不是某一个执行器家族"（note `2026-09-17-settings-pages-as-companion-packages.md:36`）。

### 8. 已发布可选 bundle（新增产品面）

`packages/boot/app-boot/src/profile.ts:184-193`：

```ts
export const OPTIONAL_BUNDLES: readonly string[] = [
  '@deepseek-ai/dsh-experimental-voice-input-bundle',
  '@deepseek-ai/dsh-experimental-agent-team-profile',
]
```

约束（note `2026-09-15-shipped-optional-bundles.md`:13）：每个都必须是 `apps/cli` 的运行时依赖且声明 `dsh.bundle.patch`，且**没有任何随附 profile 模板选中它**。管理器把这样的 bundle 报为 `optional`（`index.ts:290`）、`removable` 为假（`:291`：`installed && !Object.hasOwn(installation.dependencies, name)`）。

### 9. registry 计划与失败归因（新增能力）

见"数据流 / 二"。对应提交链：`716e2e2683` → `398a4247ae` → `cb2750019a` → `3c50bf6b6c` → `8cf07ea76c` → `d6e5b7e41a` → `3c20f401d2`。

### 10. 引导式安装与取消（新增能力）

见"数据流 / 一"。相关提交：`ac2bed35e2`（安装前检查 + 分类失败）、`bdc496cc06`（带宿主确认的取消）、`c13d21fb95`（从失败屏批准脚本）、`bc0ecae21f`（可选 bundle 默认关闭 + 引导对话框）、`57a705fa7e`（对话框关闭控件停止运行中安装）。

### 11. 客户端模块系统：rev 语义与条目生命周期（**影响 HMR 与插件产物**）

`docs/subsystems/client-modules.md` 本区间 37 行改动，`packages/client/modules/src/client/manifest.ts` 57 行改动。关键变化：

- **rev 不再哈希可执行字节**，改由"条目的 mtime、ctime、size"导出（`manifest.ts:70-73` 的新 JSDoc："Revision derived from the ordered entry revisions"），且**同一产物跨宿主重启保持相同 rev**；
- `ClientArtifactBaseline` 新增 `ctimeMs`（"包括保留 mtime 的写入"）；
- `ClientBundleRegistration` 新增 `chunk?: string`，`factory` 的参数由 `(spec: string) => unknown` 变为 `ClientBundleRequire`（带 `.async(specifier)` 用于**包内动态分块**）：`manifest.ts:308-328`；
- `ClientModuleLoader` 新增 `entries: ClientEntries` 与 `importError(id)`；`invalidate` 的语义由"一个 non-bootstrap module"改为"一个 non-bootstrap package"（因为一个包可能有多个 chunk）；
- 新增 `src/client/entries.ts`（247 行）与 `src/client/entry-lifecycle.ts`（28 行）承载这一模型。

`__ModuleLoader__` 页面全局契约本身**没有改名或换形态**：`manifest.ts:348-358` 的 `ClientModuleLoaderTarget`（`mode: 'queue' | 'live'`、`pendingQueue`、`load(registration)`、`create(options)`）与 `DshWindow.__ModuleLoader__`（`:360-366`）保持稳定；本区间 `git grep -c "__ModuleLoader__"` 从 0.1.6 的 `manifest.ts:3 / system.ts:2 / index.ts:2` 变为 `manifest.ts:3 / system.ts:3 / index.ts:2`。**结论：`__ModuleLoader__` 契约在本版没有破坏性变化**，变化发生在它**注册的 factory 形状**（新增 `chunk` 与 `require.async`）与**LoadCache 的身份单位**（entry → entry 或 package-local chunk）上。

### 12. profile 插件宿主运行实例规则（新增纪律）

见"数据流 / 五"。`docs/user/develop/basic/publish.md` 在本区间新增两段可操作说明（linked checkout 的 peer/devDependency 双写、祖先顺序与 `require.resolve(..., { paths })` 的原生语义），对应提交 `3e7af9cfbb feat(boot): resolve linked plugin peers from the running installation`。

### 13. extensions 与 preset 的职责收缩（**架构性**）

- extensions：`tool-cordis` 从"可 define/run/stop/undefine 的模型面变更工具"收缩为**两个只读工具**（`tasks`: 新增 `src/config.ts` 120 行做 Loader 树的 Config 发现，删除 `inspect.ts`/`prompt.ts`/`fiber-state.ts`）。`cordis-host-runner` 删除 `src/sandbox.ts`（28 行）。note `2026-09-16-creator-persistent-plugin-management.md:15` 明确："The model sees two read-only Cordis inspection tools. Generated-code define/run/stop/undefine and dynamic self-inspection tool APIs are absent."
- preset：删除目录扫描（`discovery.ts` 337 行）与作者 API（`authoring.ts` 191 行）、4 套随附 YAML preset（`presets/**`），改为"`@deepseek-ai/dsh-agent-preset` 行 + bundle patch"的纯声明式模型。`agent-preset-registry/README.md:46`："the registry neither scans directories nor accepts preset paths."

### 14. 官方开发者文档的区间改动（**直接决定作者动作**）

`git diff --name-status dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- docs/user/develop docs/subsystems/client-modules.md docs/subsystems/client-resources.md` → 13 files changed, +64/-45：

| 文件 | 状态 | 性质 |
|---|---|---|
| `docs/user/develop/basic/publish.md` | M（+8/-1） | 新增 `patch` 数组说明；新增 linked checkout 的 peer/devDependency 双写与解析顺序两段 |
| `docs/user/develop/practice/dynamic-cordis.md` | M（16 行） | **整篇改写**：标题由 "Extend a running agent with Cordis tools" 改为 "Configure persistent plugins from a prompt"；示例由 `pnpm dsh web --patch apps/cli/config/examples/cordis/cordis.yml` 改为"在 Creator 模式下发一条 prompt 配置 MCP server" |
| `docs/user/develop/framework/index.md` | M（2 行） | 仅 HMR 包名改名 |
| `docs/user/develop/practice/llm-adapter.md` | M（2 行） | DeepSeek 适配器描述改为 "using the Messages API" |
| `docs/subsystems/client-modules.md` | M（37 行） | rev 语义、`sourceMappingURL`、按需构建 map、`fetchBundle` 变 async、`rebuilt` 语义 |
| `docs/subsystems/client-resources.md` | M | 有改动（逐条内容未核实，见文末） |
| `docs/subsystems/extensions.md` | **无改动** | 本版新增的子系统页是 `boot.md`，不是 `extensions.md` |
| 各 `.i18n.yaml` | M | 双语配对元数据随上述改动更新 |

---

## 插件作者可操作契约清单

把本篇的证据压成"你要做什么"：

| # | 契约 | 证据位置 | 动作 |
|---|---|---|---|
| 1 | 要被识别为 bundle，必须在 `package.json` 里声明 `dsh.bundle.patch` | `packages/boot/plugin-manager/src/operations.ts:74-78`（`bundleManifest` 无 `patch` 即 `undefined`）、`packages/boot/plugin-manager/src/index.ts:545`（`not-bundle`） | 声明 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`；可传有序数组 |
| 2 | 不声明 `dsh.bundle` 的包**仍能装**，但只是普通依赖，且不会被列出/管理 | `packages/boot/plugin-manager/src/operations.ts:101-103`（打印警告并 continue）、`packages/boot/plugin-manager/src/index.ts:297-298`（仅当它已被选中才作为 `not-bundle` 列出） | 若是纯库，明确接受"不参与管理" |
| 3 | **兼容性必须写 `peerDependencies`**，`@deepseek-ai/dsh` 或 `@deepseek-ai/dsh-*` | `packages/boot/app-boot/src/plugin-compatibility.ts:75-79`；`packages/boot/app-boot/README.md:52` | 写精确/范围 peer；源码期可用 `workspace:*` |
| 4 | **`engines.dsh` 不产生任何效果** | 全仓 grep 无运行时读取方；`packages/util/package-manifest/README.md:93` | 不要指望它拦截安装 |
| 5 | 不兼容会在**安装前或导入前**被拒；要放行需精确版本豁免 + `acceptRisk` | `packages/boot/plugin-manager/src/index.ts:302,510,547,723`；`packages/boot/app-boot/src/profile-compatibility.ts:113-140` | 升级插件，或用 `dsh plugin allow-version` / `plugin_manager set_version_exemption` |
| 6 | `patch` 里每个文件的相对插件路径**解析在该文件旁** | `packages/boot/app-boot/src/profile.ts:58-75`；`docs/user/develop/basic/publish.md` 新增句 | 多文件 patch 时按文件组织相对路径 |
| 7 | 显示标题/描述放 `locale/en.json` 的 `meta`，并导出 `./locale/*.json` | `packages/boot/app-boot/src/package-meta.ts:148-172`；`docs/cookbook/adding-a-package.md:112-146` | 加 `locale/en.json` + `exports` 条目；可选 `icon` |
| 8 | 要配置页：注册 `plugins.bundle.config` / `plugins.row.config`，键为包名 / `<包名>#<row id>`，只做 `import type` | `packages/client/ui-plugin-manager/src/client/slot-contract.ts:88-102,124-130` | 用 `ctx.slots.inject(...)`；行级页要求 patch 里声明该 id 的行 |
| 9 | 要在别人的详情页插内容：注册 `plugins.detail.{actions,badge,section}`，按 `subject.kind` 自行判空 | `packages/client/ui-plugin-manager/src/client/slot-contract.ts:103-121`；`.agents/notes/implemented/architecture/2026-09-17-plugin-detail-page-extension-slots.md:13-15` | 独立用 `order` 排序；无内容时 `return null` |
| 10 | 浏览器半挂在 **specifier 为裸包名的那一行**；subpath 行的页面会随根行消失 | `.agents/notes/implemented/architecture/2026-09-16-plugin-configuration-on-the-plugins-page.md:27`；`.../2026-09-17-settings-pages-as-companion-packages.md:35` | 把配置页注册在根行 |
| 11 | 共享宿主单例必须写 `peerDependencies` + `devDependencies`，**不写 `dependencies`** | `.agents/notes/implemented/architecture/2026-09-18-profile-plugin-host-runtime-instances.md:15-17`；`docs/user/develop/basic/publish.md` 新增段 | 对 `dsh-scope`、`dsh-mcp-client` 等身份敏感的包 |
| 12 | `dsh.profile.patchReload` 已不存在；reload 由 `hmr` 行控制 | 全仓 grep 为空；`packages/bundle/base/cordis.patch.yml:27-32` | 删除该字段，改配 `hmr` |
| 13 | 动态分块（`import()`）现在能工作，且 `require.async` 由包自身提供 | `packages/client/modules/src/client/manifest.ts:308-328` | 允许包内异步 chunk，但必须自包含（不得保留同步相对 `require("./client*.js")`） |
| 14 | bundle 若含管理组件（见 `protectedModules` 名单）则受保护、不可禁用 | `packages/boot/plugin-manager/src/index.ts:66-76,744-754` | 普通插件不受影响；不要命名与名单重合的包 |

---

## 附录：本版提交索引

以下提交哈希均取自实测命令输出。

```powershell
# 主包（56 commits，此处列关键条目）
git log --oneline dsh-v0.1.6-alpha.1..dsh-v0.1.7-rc.1 -- packages/boot/plugin-manager
```

| 提交 | 主题 |
|---|---|
| `98b92b683c` | feat: add current-profile plugin manager service and Web controls |
| `d06e6b5519` | feat: coordinate profile management through dsh-hmr |
| `438c862fea` | refactor: keep profile launch context data-only and HMR backend-scoped |
| `abd765a600` | refactor(hmr): own profile reload lifecycle through YAML |
| `61665c3454` | fix(plugin-manager): clean failed installs and address critical review findings |
| `4d1adb8541` | feat(web): manage plugins over the #4182 manager from the sidebar page |
| `bc0ecae21f` | feat(plugins): ship optional bundles switched off and guide the install dialog |
| `ed32f57f88` | feat(creator): use Plugin Manager for persistent plugins |
| `470d4aae11` | fix(plugin-manager): require full access for agent tool calls |
| `716e2e2683` | feat(plugin-manager): ask configured registries in turn while one is unreachable |
| `398a4247ae` | feat(client): pick and remember the registry a plugin install asks first |
| `cb2750019a` | fix(plugin-manager): read pnpm's own registry, its stdout refusals, and lay failures where they belong |
| `3c50bf6b6c` | feat(plugin-manager): choose the first responsive public registry |
| `0edfe83573` | fix(plugin-manager): bound GitHub connection checks before installation |
| `ccaa0dc11c` | fix(plugin-manager): bound pnpm runs so a silent child cannot hold the profile lock (#4982) |
| `654caa4bbd` | feat(bundle): accept an ordered patch file list in dsh.bundle.patch (#4722) |
| `3e7af9cfbb` | feat(boot): resolve linked plugin peers from the running installation |
| `0b7cb4102b` | feat(plugins): resolve installed metadata through runtime resource exports |
| `a9f205c584` | refactor(plugins): rename PackageMeta to PluginLocalizedMeta |
| `f8240240fa` | docs(plugins): define localized display metadata and fallback rules |
| `2c67633990` | feat(plugins): enforce DSH peer compatibility with exact exemptions |
| `747c98b0db` | fix(plugins): deny incompatible bundles and clarify compatibility refusals |
| `51d70c5f5c` | feat(plugins): report incompatible versions as typed refusals |
| `a60af51e80` | release(dsh): 0.1.7-rc.1 |

```powershell
# Web 页面与席位（节选）
git log --oneline dsh-v0.1.6-alpha.1..dsh-v0.1.7-rc.1 -- packages/client/ui-plugin-manager
```

| 提交 | 主题 |
|---|---|
| `08974835d7` | refactor(web): rename ui-settings-plugin-manager to ui-plugin-manager |
| `ac2bed35e2` | feat(web): guide plugin installation with a pre-install check and classified failures |
| `bdc496cc06` | feat(web): cancel plugin installation with Host confirmation |
| `c13d21fb95` | feat(web): approve blocked install scripts from the install dialog |
| `90af3110b7` | feat(web): host plugin configuration on the Plugins page |
| `a815a7f2a9` | feat(web): open action, badge and section slots on plugin detail pages |
| `0d611ea151` | feat(web): display plugin-owned locale metadata |
| `8f0dd55c2c` | feat(plugins): render icons from package manifests (#4697) |
| `f938ebad64` | fix(web): recover lost plugin installation responses |
| `3c20f401d2` | fix(web): label beta features as experimental |
| `f64c57dbb2` | fix(plugin-manager): drop the agent exemption hint from the incompatibility reason |
| `caa0c99be1` | docs(web): follow up the review on the companion move and detail slots |

```powershell
# preset（34 commits，节选）/ extensions（469 commits）
git log --oneline dsh-v0.1.6-alpha.1..dsh-v0.1.7-rc.1 -- packages/preset
```

preset 侧的关键事实不是某一条提交，而是包级拆分：`git diff --name-status -M ... -- packages/preset` 显示 5 个源文件重命名到 `agent-preset-registry`（R069–R096），`agent-preset` 为全新包，`agent-presets` 的 `discovery.ts` / `authoring.ts` / `metadata.ts` / `presets/**` 全部删除。

### 本版新增/相关的官方 note（全部实测存在于工作区）

| note | 行数 |
|---|---|
| `.agents/notes/implemented/architecture/2026-09-14-current-profile-plugin-management.md` | 35 |
| `.agents/notes/implemented/architecture/2026-09-15-guided-plugin-installation.md` | 47 |
| `.agents/notes/implemented/architecture/2026-09-16-creator-persistent-plugin-management.md` | 31 |
| `.agents/notes/implemented/architecture/2026-09-16-plugin-configuration-on-the-plugins-page.md` | 41 |
| `.agents/notes/implemented/architecture/2026-09-17-plugin-detail-page-extension-slots.md` | 35 |
| `.agents/notes/implemented/architecture/2026-09-17-settings-pages-as-companion-packages.md` | 40 |
| `.agents/notes/implemented/architecture/2026-09-18-plugin-install-registries.md` | 45 |
| `.agents/notes/implemented/architecture/2026-09-18-profile-plugin-host-runtime-instances.md` | 37 |
| `.agents/notes/implemented/architecture/2026-09-18-localized-package-metadata.md` | 87 |
| `.agents/notes/implemented/process/2026-09-15-shipped-optional-bundles.md` | 29 |
| `.agents/notes/implemented/architecture/2026-09-09-plugin-management-in-the-web-sidebar.md` | 31（本区间新增，引用为导航依据） |
| `.agents/notes/implemented/architecture/2026-08-05-profile-plugin-bundles.md` | 35（更早的基线决策，被 09-14 扩展） |

---

## 未核实项

以下内容本篇**没有**给出结论，或只给出部分证据，按简报要求显式列出：

1. **`docs/subsystems/client-resources.md` 的逐条区间改动未核实内容。** 我核实了它在 `git diff --name-status` 中状态为 `M`（有改动），但没有读它的 diff，因此本篇不对它的变更做任何断言。
2. **`apps/web/tests/plugin-*.e2e.ts` 的断言细节未核实。** 我核实了 6 个文件存在（`plugin-config.e2e.ts`、`plugin-install-approve.e2e.ts`、`plugin-install-cancel.e2e.ts`、`plugin-install-github.e2e.ts`、`plugin-install-registry.e2e.ts`、`plugin-manager.e2e.ts`），未读其内容，因此"测试覆盖"一节只把它列为存在，不描述它断言什么。
3. **页面组件的逐屏实现细节未核实。** `PluginManagerPage.tsx`（1364 行）与 `PluginManagerPage.module.css`（1292 行）我没有逐行读；本篇关于"四屏"的表述来自官方 note 与 store 的相位类型，不是来自页面组件源码。
4. **`packages/extensions` 的 469 条提交未分类。** 我只核实了该路径在区间内的提交数，以及 `cordis-client-runner/src/client/slot-catalog.ts`（2254 行改动）与 `tool-cordis/src/api-catalog.ts`（1864 行改动）是**生成目录**增长。我**没有**逐条判断其余提交属于生成物刷新还是行为变化。
5. **`tool-cordis` / `ui-cordis` 的行为语义未逐行核实。** 我核实了包角色（`packages/extensions/README.md` 表）、两个工具名（`tool-cordis/src/index.ts:23,42`）与新增的 `src/config.ts`（120 行，Loader 树 Config 发现）文件内容的前 60 行，未读 `present.ts` / `ui-cordis` 组件的实现。
6. **`packages/boot/hmr` 的内部实现未核实。** 我核实了它是本版新增包（16 文件）、`src/index.ts` 590 行、`src/watch-config.ts` 92 行、`src/error.ts` 41 行，以及 README 的配置表；未读 `src/index.ts` 的队列实现。
7. **未运行任何测试或门禁。** 本篇所有测试相关陈述都基于文件存在与行数，**没有**执行 `pnpm run test:gui` / `test:web` / `typecheck` / `doc-sync`。因此"测试覆盖"一节的动词一律是"覆盖/存在"，不是"通过"。
8. **`docs/user/develop` 下除 README 之外的 `references/` 类文件未核实。** 我只核实了 `framework/index.md`、`basic/publish.md`、`practice/dynamic-cordis.md`、`practice/llm-adapter.md` 四个文件在 `git diff --name-status` 中为 `M` 及其实测 diff。
9. **`packages/preset/agent-preset/skills/` 的 5 个 SKILL.md 与 templates 未逐行核实。** 我核实了它们在 `git diff --name-status` 中为 `A`（新增）及行数，未读内容；`agent-preset/README.md:50` 提到 `references/packages.md` 由 `scripts/gen-plugin-packages.ts` 生成，该生成脚本我**没有**核实。
10. **`compatibility.json` 与其他 profile 文件的读写竞争细节未核实。** 我在源码中读到 `withFileLock(join(profileDir, PROFILE_COMPATIBILITY_FILENAME))`（`profile-compatibility.ts:126`）与 `diskState()` 把该文件计入变更检测（`plugin-manager/src/index.ts:794`），但没有构造并发场景验证。
