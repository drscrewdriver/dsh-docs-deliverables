# 【第 01 篇】packages/boot · preset · bundle · host · context：启动、profile 解析与实时配置

> **基线说明**：本篇为 v0.1.7-rc.1 全量分析基线（v0.1.7-rc.2 与 v0.2.0-rc.1 均未改动本篇覆盖的系统性结构）。v0.2.0-rc.1 的增量变更（约 261 个提交）请见同目录 `README.md` 与 `diff-vs-0.1.7-rc.2.md`。

> **版本**：dsh-v0.1.7-rc.1（`46a7f68b09`），对比上版 dsh-v0.1.6-alpha.1（`0a15e36e7f`）
> 难度：🟡 进阶
> 包范围：`deepseek-harness/packages/boot/`（5）、`packages/preset/`（3）、`packages/bundle/`（6）、`packages/host/`（9）、`packages/context/`（6）、`packages/extensions/`（4），共 33 个包
> 上游文档：`docs/subsystems/boot.md`（本版新增）、`docs/architecture.md`、`docs/config-catalog.md`、`docs/cordis-primer.md`、`docs/cordis-api/inherited.md`、`docs/module-graph.md`

## 目录

- [引言](#引言)
- [概述](#概述)
- [核心概念](#核心概念)
- [包结构](#包结构)
- [关键类型](#关键类型)
- [数据流](#数据流)
- [测试覆盖](#测试覆盖)
- [与上下游的关系](#与上下游的关系)
- [本版本变更要点（0.1.6-alpha.1 → 0.1.7-rc.1）](#本版本变更要点016-alpha1--017-rc1)
- [附录：本版提交索引](#附录本版提交索引)

---

## 引言

本篇覆盖「应用如何被装配起来」这一层：从 `dsh` 启动器读环境、算 patch 层、装载 Loader 树，到运行期改配置、装插件、热重载，再到把 Host 侧能力（目录选择、前端静态资源、插件清单、产品遥测）与请求上下文（Agent 指令、文件引用、时间、tmux）接到组合里，最后是运行期自省与自改的 `packages/extensions`。

它是全系列 14 篇里**唯一以「装配」为主语**的一篇：其它篇讲能力（core、shell、llm…），本篇讲这些能力**怎样被选进来、按什么顺序叠、什么时候可以被换掉**。

本版这一层发生了**结构性重排**，而不是增量修补。量化基线（本节所有数字均由 `git diff --shortstat` / `git diff --name-only` 实测）：

| 项 | 值 |
|---|---|
| 本篇六个包组合计 | **371 files changed, +26839 / −13413** |
| `packages/boot` | 93 files, **+16785 / −2454**（本篇最大增量） |
| `packages/preset` | 98 files, **+2944 / −7487**（净删除最多） |
| `packages/extensions` | 61 files, +4307 / −2643 |
| `packages/bundle` | 41 files, +1289 / −344 |
| `packages/host` | 47 files, +1101 / −231 |
| `packages/context` | 31 files, +413 / −254 |
| 含 merge 的提交数（按路径） | boot **120**、bundle **148**、context **56**、extensions **469**、preset **34**、host **31** |

三条主线决定了本篇的写法：

1. **app-boot 被拆成 5 个包**。0.1.6 的 `packages/boot/` 只有 `app-boot` 与 `cmdline`；本版新增 `hmr`（从 app-boot 的 `watch-config.ts` 与内嵌 HMR 逻辑拆出，重命名为 `@deepseek-ai/dsh-hmr`）、`config-editor`、`plugin-manager`。app-boot 从「一个大库」退化为「装配库 + 4 个协作插件」。实测 `git diff --name-status --diff-filter=A` 在 `packages/boot` 下给出 **70 个新增文件、0 删除、2 个 rename**。
2. **profile 解析从「模式化」收敛为「唯一后端」**。0.1.6 的 `ProfileResolutionGeneration` / `ProfileResolutionMode`（`'link' | 'dual' | 'runtime'`）/ `ProfileResolutionBehavior`（`'enforce' | 'verify'`）在本版全部消失，替换为 `RuntimeResolution` 与 `installRuntimeInterception()`。这不是改名——三个符号在 HEAD 上 `git grep` 结果为空。
3. **配置从「第二个存储」变成「profile 自己的 patch 层」**。`$DSH_HOME/settings.yaml` 这一级被移除，Live Config 表单直接写 profile 的 `cordis.patch.yml`，并通过 `configEditor` 服务与 HMR 队列串行化。

同时必须指出一项**与本篇任务描述相反**的核实结果：本篇被指派的重点之一是「config-only HMR（HMR 收敛到只处理配置）」。实测该 note 位于 **`.agents/notes/proposed/simplification/2026-09-19-config-only-hmr.md`，状态为 `proposed`，未实现**。`packages/boot/hmr/src/index.ts` 仍保留模块替换全部实现（`getLinked()`、`getOuterStack()`、`hmr/change`、`hmr/reload`），`docs/subsystems/boot.md` 的生成区仍列出这些事件。详见 [8.4 节](#84-config-only-hmr未实现proposed-状态)。

---

## 概述

本篇的六个包组各自回答一个不同的问题：

- **`packages/boot`**：进程怎样启动、profile 怎样被找到、模块怎样被解析、配置怎样被改。5 个包，职责如下：
  - `app-boot` —— 库。环境分层、config path 解析、profile 与 bundle 组合、runtime resolution 构造与装载、patch 组合、`--dump-config` 渲染、config schema 收集、DSH peer 兼容性预检、启动失败审计。
  - `cmdline` —— 库。让应用自己拥有命令行参数、`--help` 与退出码。
  - `hmr` —— 插件。`ctx.hmr`，把一个串行队列同时用在「模块替换」「Include 刷新」「profile 配置重载」上。
  - `config-editor` —— 插件。`ctx.configEditor`，把完整 raw config 通过普通 Loader 路径持久化并协调。
  - `plugin-manager` —— 插件。`ctx.pluginManager`，profile 的插件启停、组合包选择、pnpm 安装/卸载、注册表探测、版本豁免。
- **`packages/preset`**：Agent 的能力组合怎样被声明与选举。本版从「目录式 preset」变为「声明式 preset」：`agent-preset`（声明身份、展示元数据与子插件列表）+ `agent-preset-registry`（选举、修订保留、profile 编辑）+ `persona`。
- **`packages/bundle`**：可安装的 patch 层。6 个组合包（`acp-app`、`base`、`headless`、`sdk-app`、`sdk-minimal`、`web-app`）。本版 `base` 成为「HMR + 配置编辑 + 插件管理」的挂载点，`web-app` 承接了原先散落在 preset 包里的 Agent preset 声明。
- **`packages/host`**：GUI 宿主侧能力。9 个包，本版新增 `product-telemetry-otel`。
- **`packages/context`**：请求上下文贡献者。6 个包，本版无增删包，改动集中在 `session-reference` 与 `time-context`。
- **`packages/extensions`**：运行期自省与自改。4 个包，本版发生**能力收缩**：`tool-cordis` 从 7 个模型可见工具缩到 **2 个只读工具**。

一句话概括本版：**启动层被拆包、解析后端被收敛、配置被收归 profile、模型侧的自改工具被撤下，改由 Plugin Manager 承担持久化安装。**

---

## 核心概念

| 术语（首次出现附英文） | 含义 | 本版是否受影响 |
|---|---|---|
| profile | `$DSH_HOME/profiles/<name>` 目录：`package.json`（`dsh.profile.bundles` 有序列表）+ `cordis.patch.yml` | 未变；但 `patchReload` 字段被移除 |
| bundle | 声明 `dsh.bundle.patch` 的 npm 包，作为一层 patch 参与组合 | `patch` 可为字符串或**有序文件列表**（新增） |
| patch layer（补丁层） | 按序叠加：每个 bundle → profile 自己的 patch → home 级 patch → `--patch` overlay | 未变 |
| runtime resolution（运行时解析表） | profile 启动时算一次、不可变的包表，通过 Node 内部 ESM/CJS resolver 生效 | **重命名 + 唯一化**（原 `ProfileResolutionGeneration`） |
| 拦截层（interception layer） | `$DSH_HOME/profiles/node_modules`：runtime resolution 的每个包名「占据」这里的同名包目录位 | 未变（0.1.6 引入） |
| linked root（外链根） | profile 的 `node_modules/<pkg>` 指向 profiles 树外的真实目录；其下 importer 在每个祖先位按 peer 声明参与拦截 | 0.1.6 note 定义；本版实现收敛 |
| volatile（易失引用） | schema 用 `.volatile()` 声明的字段：返回不可变快照的稳定引用，值可只取一次 | 0.1.6 末引入，本版全面接入表单 |
| Live Config（实时配置） | 插件在 Cordis `Config` 里声明的全部可配置值；消费方在操作时读引用 | **本版成为唯一配置真源** |
| 兼容性豁免（version exemption） | `profiles/<name>/compatibility.json` 里 `package@version → [DSH 版本]` 的精确授权 | **本版新增** |
| Inspect Provider | Host 侧只读查询注册表 `ctx.cordisInspect`，按 id 注册、方法带 input/output schema | 本版新增 `Config` provider，移除 Host `Builtin` |
| required entry（必需条目） | 启动审计里「失败即整体失败」的条目集合 | 未变（列表见 app-boot README） |

---

## 包结构

### `packages/boot/`（5 包）

| 包 | 职责 | 本版改动规模（`--stat` 实测） |
|---|---|---|
| `app-boot` | 装配库：环境分层、profile/bundle 组合、runtime resolution、patch 组合、dump、schema、兼容性预检 | `src/index.ts` 1064 行、`src/profile.ts` 724 行、`src/profile-resolution/resolver.ts` 923 行；新增 `src/compatibility-preflight.ts`(187)、`config-schema/`(7 文件)、`package-meta.ts`(172)、`plugin-compatibility.ts`(103)、`profile-compatibility.ts`(141)、`profile-context.ts`(75)、`profile-plugins.ts`(127)、`profile-sanitize.ts`(34) |
| `cmdline` | 应用自有 flag 与退出码 | 仅 `package.json`（12 行）；无 `src` 语义变更 |
| `config-editor` | **新增包**。`ctx.configEditor`，profile 配置持久化 | 全新增：`src/index.ts` 145 行、`README.md` 79 行、`package.json` 54 行 |
| `hmr` | **新增包**。`ctx.hmr`，模块与配置重载串行队列 | 全新增：`src/index.ts` 590 行、`src/watch-config.ts`（自 app-boot rename，R086）、`src/error.ts` 41 行；tests 共 5 个 spec |
| `plugin-manager` | **新增包**。`ctx.pluginManager`，profile 插件/组合包管理 | 全新增：`src/index.ts` 804 行、`src/operations.ts` 580 行、`src/types.ts` 258 行、`src/registry.ts` 98 行、`src/tools.ts` 92 行、`src/install-spec.ts` 91 行、`src/github-connection.ts` 68 行、`src/run-tree.ts` 70 行、`src/patch.ts` 43 行、`src/build-approval.ts` 50 行、`src/failure.ts` 29 行、`src/install-failure.ts` 44 行 |

包版本对照（`packages/boot/README.md` 表格，本版新增三行）：

| 包 | ctx key |
|---|---|
| `app-boot` | （bin 的库） |
| `cmdline` | `cmdlineArgs`, `appExit` |
| `hmr` | `hmr` |
| `config-editor` | `configEditor` |
| `plugin-manager` | `pluginManager` |

### `packages/preset/`（3 包）

| 包 | 职责 | 本版改动 |
|---|---|---|
| `agent-preset-registry` | **新增包**（自 `agent-presets` 拆出）。选举、修订保留、profile 编辑 | `src/index.ts`、`src/definition.ts`、`src/mount.ts`、`src/preset.ts` 新增；`composition-inventory.ts`(R071)、`display.ts`(R080)、`invariant.ts`(R069)、`session.ts`(R096)、`types.ts`(R070) 自 `agent-presets` 迁入 |
| `agent-preset` | **新增包**（自 `agent-presets` 拆出）。声明式 identity / 展示元数据 / 子插件列表；随包携带 3 个 skill | `src/index.ts`(新增)、`skills/cordis-composition-reference/`、`skills/cordis-plugin-development/`（含 4 个 references + 4 个模板）、`skills/editing-cordis-compositions/`；`tests/skills.spec.ts` |
| `persona` | 可组合的 Agent persona 行 | 仅 README 与 `package.json`（14 行）；无 `src` 变更 |

**被删除的包**：`agent-presets`（`README.md`、`README.zh.md`、`package.json`、`presets/{cordis,minimal,ptc,standard}/` 及其 `agent.cordis.yml` / `preset.yml` 全部 `D`），实测删除 42 个文件、rename 14 个。

### `packages/bundle/`（6 包）

| 包 | 职责 | 本版改动规模 |
|---|---|---|
| `base` | 基础组合：HMR、配置编辑、插件管理、settings、credentials 等 | `cordis.patch.yml` 42 行、`package.json` 184 行、`tsconfig.json` 6 行 |
| `web-app` | Web 组合 | `cordis.patch.yml` 111 行、`package.json` 240 行；**新增 `presets/`（4 个 patch 文件）**、`tests/document-preview.spec.ts`、`tests/document-conversion.e2e.ts`、`tests/browser-defaults.spec.ts` |
| `headless` | headless 组合 | `cordis.patch.yml` 3 行、`package.json` 46 行、`src/index.ts` 4 行、`src/json-stream.ts` 12 行 |
| `sdk-app` | SDK 组合 | `cordis.patch.yml` 19 行、`package.json` 18 行 |
| `acp-app` | ACP 组合 | `cordis.patch.yml` 3 行、`package.json` 12 行 |
| `sdk-minimal` | 独立最小组合 | 仅 `package.json` 62 行 |

### `packages/host/`（9 包）

| 包 | 本版改动规模 |
|---|---|
| `directory-picker` / `-auto` / `-browse` / `-native` | `package.json` 级别（36/10/10/6 行）；`directory-picker-native/src/win32-dialog-bindings.ts` 4 行 |
| `frontend-static` | `src/index.ts` 7 行、`tests/` 15 行 |
| `open-in-app` | `src/icons.ts` 52 行、`src/index.ts` 16 行、`src/resolver.ts` 32 行、`src/shared.ts` 26 行 |
| `plugin-inventory` | `src/index.ts` 76 行、`src/types.ts` 9 行、`tests/inventory.spec.ts` 120 行、`tsconfig.json` 8 行 |
| `product-telemetry-otel` | **新增包**（10 个文件）：`src/index.ts` 171 行、README 108 行、`tests/telemetry.spec.ts` 203 行、`tests/loader-composition.e2e.ts` |
| `webserver` | `src/index.ts` 3 行、`src/injections.ts` 2 行 |

### `packages/context/`（6 包）

| 包 | 本版改动规模 |
|---|---|
| `agent-instructions` | `package.json` 52 行、`src/state.ts` 2 行、`tests/` 39 行 |
| `file-reference` | `src/index.ts` 2 行 |
| `file-reference-local` | `package.json` 24 行（无 `src` 变更） |
| `session-reference` | `src/index.ts` 57 行、`src/projection.ts` 1 行、`src/types.ts` 2 行、`tests/session-reference.spec.ts` 161 行、`tsconfig.json` 3 行 |
| `time-context` | `src/index.ts` 11 行、`src/invariant.ts` 10 行、tests 共 61 行 |
| `tmux-context` | `src/index.ts` 18 行、`tests/` 34 行 |

无新增、无删除包。

### `packages/extensions/`（4 包）

| 包 | 本版改动规模 |
|---|---|
| `tool-cordis` | `src/api-catalog.ts` 1864 行、`src/index.ts` 489 行（**大幅缩小**）、`src/present.ts` 85 行；**新增** `src/config.ts`(120)、`src/host.ts`(20)、`tests/config.spec.ts`、`tests/host.spec.ts`；**删除** `src/fiber-state.ts`、`src/inspect.ts`(332 行)、`src/prompt.ts`(107 行) |
| `cordis-host-runner` | `src/index.ts` 30 行、`src/guard.ts` 8 行、`src/lifecycle.ts` 4 行；**删除** `src/sandbox.ts` 28 行、导出 `HOST_BUILTIN_INSPECTION` |
| `cordis-client-runner` | `src/client/slot-catalog.ts` 2254 行（生成物）、`src/client/api-catalog.ts` 190 行、`src/client/guard.ts` 36 行、`src/client/providers.ts` 32 行；新增 `tests/providers.client.spec.ts` |
| `ui-cordis` | `src/client/CordisPanel.tsx` 44 行、`CordisPanel.module.css` 38 行、`CordisDefineRow.tsx` 27 行、`CordisRunRow.tsx` 25 行；新增 `src/client/CordisPreparingRow.tsx`、`tests/status-icons.client.spec.tsx` |

---

## 关键类型

### 片段 A：`RuntimeResolution` —— 不可变运行时解析表

```ts
// packages/boot/app-boot/src/profile.ts:103-139
/** One package the runtime resolution supplies at the interception layer. */
export interface RuntimeResolutionEntry {
  /** Bare package name. */
  readonly name: string
  /** Package directory selected by the existing dependency traversal. */
  readonly packageDir: string
  /** Selected package version when its manifest declares one. */
  readonly version: string | undefined
  /** Manifest whose dependency edge selected this package. */
  readonly declarer: string
  /** Whether every profile or only the active profile receives this entry. */
  readonly scope: 'installation' | 'profile'
}

/**
 * A profile node_modules entry linked to a directory outside the shared profiles tree and the active profile.
 * Importers below `realPath` use Node's real ancestor chain, with peer mappings read at each node_modules position.
 */
export interface LinkedRoot {
  readonly name: string
  readonly realPath: string
}

/** Complete immutable package table for one profile launch. */
export interface RuntimeResolution {
  /** Directory containing every profile; its node_modules is the interception layer. */
  readonly profilesDir: string
  /** Active profile directory, when profile-scope entries were included. */
  readonly profileDir: string | undefined
  /** Profile-declared packages installed in the profile's own node_modules. */
  readonly localPackageNames: readonly string[]
  /** Installation-scope entries followed by profile-scope entries in precedence order. */
  readonly entries: readonly RuntimeResolutionEntry[]
  /** Active profile links to external directories, sorted by name. */
  readonly linkedRoots: readonly LinkedRoot[]
}
```

**本版相对 0.1.6 的差异（逐符号核对）**：

| 0.1.6 符号 | 本版状态 |
|---|---|
| `ProfileResolutionGeneration` | 重命名为 `RuntimeResolution`（`git grep` 确认旧名在 HEAD 无残留） |
| `ProfileResolutionEntry` | 重命名为 `RuntimeResolutionEntry` |
| `ProfileResolutionMode = 'link' \| 'dual' \| 'runtime'` | **删除**（无替代） |
| `ProfileResolutionBehavior = 'enforce' \| 'verify'` | **删除**（无替代） |
| `createProfileResolutionGeneration()` | 重命名为 `createRuntimeResolution()`，并返回 `Promise<RuntimeResolution>` |
| `healProfilesModuleFallback()`、`ProfileModuleFallbackOptions` | **删除**，由 `removeLinkProjections(dir)` 取代 |
| `DEFAULT_PROFILE_PATCH_RELOAD`、`ProfileTemplate.patchReload` | **删除**，由 YAML 里的 `hmr` 行控制 |
| `LinkedRoot` | **新增**字段 `linkedRoots` 与类型 |

### 片段 B：`installRuntimeInterception` —— 唯一的解析后端

```ts
// packages/boot/app-boot/src/profile-resolution/resolver.ts:117-136
/** Active interception in one Node isolate. */
export interface RuntimeInterception {
  /**
   * Locate a bare package without requiring one of its exports.
   * A package subpath selects its package directory without resolving or validating the requested file.
   * @param specifier - bare package or package-subpath specifier.
   * @param parentURL - file URL whose lookup order applies.
   * @returns selected package directory, or undefined when it is absent.
   */
  packageDir(specifier: string, parentURL: string): string | undefined
  /**
   * Atomically publish a complete successor and fresh caches. Linked roots may be added or removed.
   * Removed roots stop intercepting uncovered directories; existing modules and Node caches remain intact.
   * @param successor - fully constructed generation retaining existing package mappings and local names.
   * @throws when the profile scope or existing mappings change, local names are removed or override
   * existing mappings, or a previously published link name selects a different real directory.
   */
  replace(successor: RuntimeResolution): void
  /** Restore the native resolver methods. Interceptions dispose in reverse order. */
  dispose(): void
}
```

```ts
// packages/boot/app-boot/src/profile-resolution/resolver.ts:693-700
/**
 * Install one runtime resolution as the interception on Node's default ESM and CommonJS resolvers.
 * @param resolution - complete package table and profile scope.
 * @returns an interception that publishes a successor or restores the native methods.
 */
export function installRuntimeInterception(
  resolution: RuntimeResolution,
): RuntimeInterception {
```

0.1.6 的对应函数是 `installProfileResolution(generation, behavior = 'enforce')` 与 `registerWorkerResolution(generation, behavior = 'enforce')`。本版删掉 `behavior` 形参，函数名改为 `installRuntimeInterception`——**不存在「验证已物化后端」的第二种语义**。

### 片段 C：`ConfigEditor` —— 配置写入的唯一入口

```ts
// packages/boot/config-editor/src/index.ts:25-44
/** Persist complete raw configs and apply them through the normal Loader path. */
export class ConfigEditor extends Service {
  static inject = ['loader', 'profileContext']

  constructor(private readonly ownerContext: Context) {
    super(ownerContext, 'configEditor')
  }

  /** The profile patch edited by this service. */
  get documentPath(): string { return this.ownerContext.profileContext.patchPath }

  /** Addressable profile rows; nested Includes have independent configuration ownership.
   * @returns Active entries with unique profile patch ids.
   */
  entries(): Entry[] {
    const candidates = [...this.ownerContext.loader.entries()].filter(entry => entry.parent.tree.ctx.fiber.entry?.id === 'include')
    const counts = new Map<string, number>()
    for (const entry of candidates) counts.set(entry.options.id, (counts.get(entry.options.id) ?? 0) + 1)
    return candidates.filter(entry => counts.get(entry.options.id) === 1)
  }
```

写入路径的三个关键决定（读自 `edit()` 实现）：

1. 整段写入包在 `withFileLock(join(profileContext.dir, 'package.json'))` 内；
2. 若 `ctx.get('hmr')` 存在，整段再包一层 `hmr.runExclusive(run)`；HMR 缺席时直接执行 —— 即**配置写入与自动重载共用同一个队列**；
3. 校验有效值必须等于写盘值：`if (!isDeepStrictEqual(effective?.config ?? {}, next)) throw new Error('Configuration for "..." is overridden by a home patch or command-line overlay')`；`reconcileProfilePatches` 失败时回滚文件（`writeFileAtomic(path, before, { mode: 0o600 })`）。

### 片段 D：`PluginManager` 的远程接口

`docs/subsystems/boot.md` 的生成区（`scripts/gen-cordis-catalog.ts`，由 `pnpm run verify-cordis-catalog` 校验新鲜度）给出 12 个 `@Remote` 方法：`listVersionExemptions`、`setVersionExemption`、`listPlugins`、`listBundles`、`registries`、`inspect`、`setPluginEnabled`、`setBundleEnabled`、`installBundle`、`waitForInstall`、`cancelInstall`、`removeBundle`。核心结果类型：

```ts
// packages/boot/plugin-manager/src/types.ts:110-136
/** Persisted change and independently observed application outcome. */
export interface ChangeResult {
  changed: boolean
  /** `cancelled` is an installation the caller stopped, its files restored. */
  application: 'applied' | 'restart-required' | 'overridden' | 'failed' | 'cancelled'
  /** Last attempted step; successful installation can proceed to enablement. */
  stage: 'install' | 'enable' | 'remove'
  target: string
  enabled?: boolean
  error?: ManagementError
  /** Pre-existing inactive entries the operation left as they were. */
  warnings?: string[]
  packageResult?: PackageResult
  /** The bundle an installation added, once pnpm and the bundle check accepted it. */
  bundle?: string
  pendingBuilds?: string[]
  approvedBuilds?: string[]
  registries?: Registry[]
  failedAt?: 'registry' | 'spec-host'
}
```

`changed`（磁盘改动）与 `application`（运行期生效）**独立报告**是本版的设计要点：CLI 与 Web 都按这两条轴分别呈现。

### 片段 E：DSH peer 兼容性判定

```ts
// packages/boot/app-boot/src/plugin-compatibility.ts:61-88（节选）
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
    if (typeof range !== 'string') {
      throw new Error(`Plugin manifest peerDependencies[${JSON.stringify(name)}] must be a string`)
    }
    if (name !== '@deepseek-ai/dsh' && !name.startsWith('@deepseek-ai/dsh-')) continue
    const requirement = ['workspace:^', 'workspace:~', 'workspace:*'].includes(range) ? runtimeVersion : range
    if (requirement.trim() === '' || !semver.satisfies(runtimeVersion, requirement, { includePrerelease: true })) {
      peers[name] = range
    }
  }
  ...
}
```

`ProfileCompatibility`（`profile-compatibility.ts:43-53`）带第三个字段 `rewritable`：文件里有任何被拒绝的记录时为 `false`，此后的授权/撤销**拒绝写入**，要求用户手工修复，而不是覆盖其内容。

### 片段 F：`prepareProfilePatches` / `prepareProfileEntries` —— 准入发生在 DSH 拥有的组合边界

```ts
// packages/boot/app-boot/src/compatibility-preflight.ts:180-187
export function prepareProfilePatches(
  ctx: Context, patches: PatchOptions[], parentURL: string, binName = 'dsh',
): PatchOptions[] {
  if (ctx.get('profileContext') === undefined) return patches
  const entries = applyEntryPatches([], patches, patchWarning(ctx))
  const rows = prepareProfileEntries(ctx, entries, parentURL, binName)
  return rows.length === 0 ? [] : [{ insert: rows }]
}
```

被拒行获得的形态由 `deny()` 决定（`compatibility-preflight.ts:114-118`）：`row.disabled = true`，且若 `row.group` 为真则同时置 `row.group = false`。原生 Include 若「抵达」了被拒插件，则**整个 Include 被拒**（其文件不会被重写）：

```ts
// packages/boot/app-boot/src/compatibility-preflight.ts:160-163
const children = applyEntryPatches(data as EntryOptions[], config.patches, patchWarning(ctx))
return check(children, pathToFileURL(filename).href)
  ? `its included file ${filename} reaches an incompatible plugin, and that file is never rewritten`
  : undefined
```

---

## 数据流

### 1. 启动：从 argv 到运行中的 Loader 树

```text
dsh <cmd> --profile <name>
  │
  ├─ app-boot: resolveConfigPath(cordis.yml)  ── DSH_SNAPSHOT=replay 时换 cordis.snapshot.yml
  ├─ app-boot: loadLayeredEnv()               ── 调用目录 .env 高于 Home .env，均低于继承环境
  ├─ app-boot: installFailLoud('dsh')         ── unhandled rejection / uncaught exception → 释放终端 → exit 1
  │
  ├─ profile.ts: resolveProfileDir(name)                      → $DSH_HOME/profiles/<name>
  ├─ profile.ts: loadProfileDirectory()                       → Profile{ layers[], patches[] }
  │     └─ bundlePatchFiles()/bundlePatchPaths()              → 每层有序 patch 文件列表
  │     └─ removeLinkProjections(dir)                         ── 一次性清理 0.1.5 link 后端写入的软链
  ├─ profile.ts: createRuntimeResolution({ installAnchor, profile, home })
  │     ├─ collectInstallationScopePackages()  BFS: dependencies → peerDependencies（首个命中者拥有该名）
  │     ├─ collectProfileScopePackages()       选中 bundle 携带、闭包未拥有的包（不覆盖既有名）
  │     ├─ installedProfilePackageNames()      profile 直连依赖里已装好的名字（省一次目录探测）
  │     └─ linkedProfileRoots()                指向 profiles 树外与 active profile 之外的软链根
  │     → Object.freeze(RuntimeResolution)
  ├─ resolver.ts: installRuntimeInterception(resolution)      → 包裹 ESM resolve/resolveSync + CJS _resolveFilename
  ├─ service.ts: PluginPackages(resolution)                   → ctx.pluginPackages（packageOf / metaOf）
  ├─ compatibility-preflight.ts: prepareProfilePatches()       → 准入：不兼容行置 disabled
  ├─ profile-context.ts: readProfilePatches()                 → bundle 层 → profile patch → home patch → overlays
  └─ Loader: mountRootInclude / cordis:group / cordis:include  → 逐行 import、boot
        └─ 结算后审计：必需条目失败 → StartupError（先 dispose 再 reject）
```

`createRuntimeResolution()` 有一个易被忽略的细节（`profile.ts:422-423`）：

```ts
// The Promise return type is the pre-stable API; construction has no asynchronous step.
return await Promise.resolve(Object.freeze({ ... }))
```

即：**构造全程同步**，`async` 只是为未来留出的接口形状。所有字段与每个 entry 都被 `Object.freeze` —— 这是「不可变代际」的实现方式。

### 2. 模块解析：命中拦截层时的分支

以 `$DSH_HOME/profiles/web/node_modules/my-plugin/index.js` 为 importer，note 定义的五级祖先链为：

```text
① <profile>/node_modules/<pkg>/node_modules
② <profile>/node_modules
③ $DSH_HOME/profiles/node_modules      ← 拦截层
④ $DSH_HOME/node_modules
⑤ /node_modules
```

代码结构对应：

- 每级「拦截层」由 `computeProfileLayer(dir, active)` 固定三个位置（`resolver.ts:189-197`）：`localPrefix`（层以下的物理内容）、`nativeAfter`（层自身物理目录的 manifest 锚点）、`after`（层以上的锚点）。
- `findInterceptionLayer(path, resolution)`（`resolver.ts:200-208`）判定 importer 属于哪个层：profiles 树内 → `profile` 层；linked root 内且不在 installation 作用域内 → `linked` 层；否则 **不参与**（直接交还 Node）。
- `ResolutionRoute` 是三分支（`resolver.ts:57-60`）：`interception`（层内有该条目，从条目的 `declarer` 继续）、`native-after-interception`（层内无名目，从 `parent` 恢复 Node 链）、`native`（完全不拦截）。

**本版新增的行为**（note `2026-09-19-profile-resolution-lookup-order.md` 第 3 节）：对 linked root，**每个**祖先 `D/node_modules` 位应用一条规则——若 `D/package.json` 的 `peerDependencies` 声明了某名字且 runtime resolution 供应该名字，则该位用运行中的包；否则用物理候选。更近的物理候选优先于更远的 peer 声明。`readPeerNames(directory)`（`resolver.ts:211-222`）**每次解析都读**（不 memoize），清单不可读则视为无 peer（由 Node 报自己的诊断）。

note 给出的动机是模块身份而非路径整洁（`2026-09-18-profile-plugin-host-runtime-instances.md`）：`@deepseek-ai/dsh-scope` 用模块内 `Symbol('dsh.scope')` 打标签，两份实例会写读不通的标签，导致第一个 Agent 的 MCP 工具注册到进程全局层、第二个 Agent 的工具同步冲突、`failOnStartupError: true` 把冲突变成 Agent 创建失败（issue #4573）。**版本对齐不能修复**，因为重复存在于任何版本。

### 3. 改配置：从表单到 running fiber

```text
Client 表单 / agent 工具
  → ctx.configEditor.edit(entry, change)
       ├─ hmr.runExclusive(...)                              ← 与自动重载共用队列
       ├─ withFileLock(<profile>/package.json)
       ├─ readProfilePatches() + reconcileProfilePatches()    ← 先收敛到当前真实状态
       ├─ 复核 entry 仍在 entries() 内且 fiber.state === ACTIVE
       ├─ fiber.ctx.waterfall(fiber, 'internal/config', next, () => next)
       ├─ resolveConfig(fiber.runtime, resolved)              ← 原生 schema 校验
       ├─ YAML Document 编辑（保留 !!js 表达式，见下）
       ├─ 有效值一致性检查（home patch / CLI overlay 更高级 → 拒绝）
       ├─ writeFileAtomic(<profile>/cordis.patch.yml, mode 0o600)
       └─ reconcileProfilePatches(root, patches, 'dsh', [entryId])
             ├─ 成功 → Loader 结算 → emit 'app-boot/config-reload'
             └─ 失败 → 回滚文件 + 用旧 patches 再收敛 + throw
```

`!!js` 表达式的往返保真是显式实现的（`config-editor/src/index.ts:99-122`）：读盘时用自定义 tag 把 `tag:yaml.org,2002:js` 解析成字符串保留，写盘前再 `visit` 一遍，把 `{ __jsExpr: "..." }` 单键 map 还原成带 `!!js` tag 的 `Scalar`。

### 4. volatile 更新：不重挂的配置变更

`2026-09-18-volatile-config-references.md` 描述的路径在本版是配置表单的底座：

```text
schema 字段声明 .volatile()  →  返回不可变快照的稳定引用
   ↓
Entry.update → Loader 用 schema 声明的 volatile 路径做 raw diff
   ↓
raw diff 无普通变更、但 raw config 不同
   → 通过 fiber 的 internal/config 钩子解析并校验候选
   → 比较普通有效值；仍相等则提交引用
   → emit 'loader/volatile-update'（仅派发给所属 fiber）
```

要点：**只有 volatile 变更保留实例**；普通字段变更仍走既有 remount 生命周期，且**不更新旧引用**。引用可长期保留，但值只能为一次操作而取。`docs/cordis-api/inherited.md` 在本版新增了这一事件（`vendor/loader/src/index.ts:34`）与 `internal/config` waterfall（`vendor/cordis/src/events.ts:339`）。同时该文件**删除了 `ctx.hmr` 的 vendor 条目** —— HMR 从 vendored 包迁到 DSH 自己的 `packages/boot/hmr`。

### 5. 装插件：从 spec 到生效

```text
installBundle(spec, { enabled=true, requestId, approvedBuilds, registry })
  ├─ install-spec.ts: 解析 spec 形态（registry | path | git | tarball）
  ├─ 兼容性预检（命名了包时，在 pnpm 之前）
  │     ├─ 本地路径 → 读自身 package.json
  │     └─ registry spec → pnpm registry 查询所选版本及其 peer 声明
  │     不兼容 → throw ManagementFailure('incompatible-version', [ ... ])，不下载、不跑构建脚本
  ├─ github-connection.ts: checkGithubConnection()  仅 github.com 的 git spec
  │     git -c credential.helper= ls-remote -- <repo> HEAD
  │     GIT_TERMINAL_PROMPT=0, GIT_ASKPASS='', SSH_ASKPASS_REQUIRE=never, 超时 githubConnectionTimeoutMs(5000)
  │     只有网络失败/超时停止安装；认证与传输回退仍归 pnpm
  ├─ registry.ts: registryPlan(requested, configured)  → 依次要问的注册表
  ├─ pnpm add --registry ...（每次尝试之间恢复 profile 文件）
  │     失败分类 → NEXT_REGISTRY_KINDS = {network, timeout, not-found, no-matching-version} 才转下一个
  │     attributeFailure() 判定 failedAt: 'registry' | 'spec-host'
  ├─ 应用 bundle 层（applying 阶段不可取消 → cancelInstall 返回 'too-late'）
  └─ emit 'plugin-manager/changed' / install-log / install-state
```

`registryPlan()`（`registry.ts:54-76`）的私有注册表保护是关键不变式：**请求的注册表不在配置集合内时，只问它一个**——私有注册表永不回落到公共注册表。

---

## 测试覆盖

| 包组 | `tests/*.spec.ts*` | `tests/*.e2e.ts` | 本版关键新增/扩张 |
|---|---|---|---|
| `packages/boot` | 36 | 0 | `app-boot/tests/profile-resolution.spec.ts` 2098 行改动（本篇最大测试面）、**新增** `linked-resolution-matrix.spec.ts`(644)、`config-schema.spec.ts`(608)、`schemastery-json-schema.spec.ts`(564)、`package-meta.spec.ts`(435)、`compatibility-preflight.spec.ts`(365)、`plugin-compatibility.spec.ts`(178)、`profile-compatibility.spec.ts`(132)、`profile-plugins.spec.ts`(125)、`profile-sanitize.spec.ts`(95)、`config-pattern.spec.ts`(52)；`plugin-manager/tests/manager.spec.ts`(1396)、`operations.spec.ts`(821)、`tools.spec.ts`(248)、`github-connection.spec.ts`(183)；`hmr/tests/` 5 个 spec 共约 1000 行 |
| `packages/preset` | 8 | 0 | `agent-preset-registry/tests/mount.spec.ts`、`registry.spec.ts`、`invariant.spec.ts`、`composition-inventory.spec.ts`；`agent-preset/tests/skills.spec.ts` |
| `packages/bundle` | 15 | 1 | `web-app/tests/document-preview.spec.ts`(133)、`browser-defaults.spec.ts`(41)、`document-conversion.e2e.ts`(76) |
| `packages/host` | 17 | 2 | `product-telemetry-otel/tests/telemetry.spec.ts`(203) + `loader-composition.e2e.ts`；`plugin-inventory/tests/inventory.spec.ts`(120) |
| `packages/context` | 10 | 2 | `session-reference/tests/session-reference.spec.ts`(161) |
| `packages/extensions` | 19 | 0 | `tool-cordis/tests/config.spec.ts`(128)、`host.spec.ts`(35)；`ui-cordis/tests/status-icons.client.spec.tsx`(151)；`cordis-client-runner/tests/providers.client.spec.ts`(74) |

核验方式（note 声明的验证面，本版未逐条运行）：

- `profile-resolution.spec.ts`：表驱动矩阵——importer 取 profile 根与 profile 内插件；包名覆盖 installation 条目、bundle-only 条目、表外名字；①②③④ 四层的全部存在组合，②③ 各取真实目录与指向他处的软链两种形态；每个单元格断言 ESM import、CJS require、`require.resolve`、`packageDir` 四种形式落进同一目录。
- `linked-resolution-matrix.spec.ts`：构造独立的 native / intercepted / reference 三份目录做差分对照，只让 reference 副本把合格 peer 位替换成指向 runtime 包的链接，再让 Node 解析；覆盖单包与 pnpm monorepo、缺失 manifest、缺失 `node_modules`、畸形 peer 声明、React、作用域外 helper、遗留子路径续查。断言比较包选择、存在路径、错误码与**模块身份**。
- `apps/cli/tests/profiles/headless/tests/profile-resolution.ts`：真实 CLI 启动测试，覆盖 src 与 lib 启动、普通布局与 npm-link 布局、以及指向无 manifest 的 `src` 目录的链接。

**未核实**：上表测试数字来自 `git diff --stat` 的增删行数，未逐文件统计最终行数；「36/8/15/17/10/19 个 spec」为 `Get-ChildItem` 在 `tests/` 下的计数，未展开到每个包的断言数量。note 中引用的 `.spec.ts` 断言内容本人**未逐条运行**（仓库未在本会话构建）。

---

## 与上下游的关系

| 方向 | 关系 |
|---|---|
| 上游（被谁消费） | `apps/cli` 是 `app-boot` + `cmdline` 的唯一产品消费者；`packages/bundle/*` 的 patch 文件被 app-boot 读取；`packages/client/ui-plugin-manager` 通过 `PluginRegistryProbe`（源码位于 `packages/client/ui-plugin-manager/src/index.ts`，**不在本篇包范围内**）与 Host 侧 manager 协作；`packages/api/workspace-controller` 消费 `PluginManager` 的 profile 事实（Desktop 的 pnpm invocation） |
| 下游（消费谁） | `app-boot` 依赖 `@deepseek-ai/cordis` 的 Loader/Include/Group、`dsh-home-paths`、`dsh-package-manifest`、`dsh-launch-environment`、`dsh-atomic-write`；`hmr` 依赖 chokidar + picomatch + Loader 的 ModuleLoader；`plugin-manager` 依赖 `dsh-subprocess`（`scrubbedParentEnv`）与 execa |
| 横向（同层协作） | `plugin-manager` → `hmr`（配置写入进 HMR 队列）；`config-editor` → `hmr`（`runExclusive`）+ `app-boot`（`reconcileProfilePatches`）；`hmr` → `app-boot`（`readProfileManifest` / `readProfilePatches` / `reconcileProfilePatches` / `PROFILE_PATCH_FILENAME`）；`packages/host/plugin-inventory` 的类型被 `plugin-manager` 复用（`PluginEntryId` re-export） |
| 边界声明 | `docs/subsystems/boot.md` 由 `packages/boot/README.md` 声明为本子系统的英文权威页；`packages/boot/README.md` 的包表在包组页声明子系统归属 |

一个值得留意的**类型依赖倒置**：`plugin-manager/src/types.ts:5` 从 `@deepseek-ai/dsh-host-plugin-inventory/types` re-export `PluginEntryId`，即 boot 组反向依赖 host 组的一个类型。这不是本版新增（0.1.6 已有 `dsh-plugin-inventory`），但本版把该文件名从 `agent-presets` 改为 `agent-preset-registry`，同一文件同时新增 `import type {} from '@deepseek-ai/dsh-app-boot'`。

---

## 本版本变更要点（0.1.6-alpha.1 → 0.1.7-rc.1）

### 8.1 变更总览

| 维度 | 0.1.6-alpha.1 | 0.1.7-rc.1 | 性质 |
|---|---|---|---|
| `packages/boot` 包数 | 2 | **5** | 结构性 |
| `packages/preset` 包数 | 2 | **3** | 结构性 |
| `packages/host` 包数 | 8 | **9** | 新增 |
| 其它三组包数 | 6 / 6 / 4 | 6 / 6 / 4 | 不变 |
| 解析后端 | `ProfileResolutionMode` 三值（含 link/dual 遗留类型）+ `Behavior` 两值 | 单一 `installRuntimeInterception` | **收敛** |
| 解析表类型名 | `ProfileResolutionGeneration` | `RuntimeResolution` | 重命名 |
| 配置真源 | `$DSH_HOME/settings.yaml`（第二存储）+ profile patch | 仅 profile patch（`configEditor`） | **收敛** |
| HMR 承载 | vendored `@deepseek-ai/cordis-plugin-hmr` | 自研 `@deepseek-ai/dsh-hmr` | 换实现 |
| HMR 是否只管配置 | — | **否**（模块替换保留；note 仍为 proposed） | **未变** |
| `tool-cordis` 模型可见工具 | 7 个（含 define/run/stop/undefine） | **2 个只读** | **能力收缩** |
| Host `Builtin` inspect provider | 存在 | **移除** | 能力收缩 |
| 插件版本兼容 | 无检查 | peer 预检 + `compatibility.json` 精确豁免 | 新增 |
| `docs/subsystems/boot.md` | 不存在 | **322 行新增** | 新增 |

`docs/` 侧的量化对照：`docs/architecture.md` 20 行、`docs/config-catalog.md` **+910 行**（生成物）、`docs/module-graph.md` 402 行、`docs/cordis-api/inherited.md` 31 行、`docs/subsystems/README.md` 5 行、`docs/subsystems/boot.md` 322 行（新增）。**`docs/cordis-primer.md` 在区间内无任何 diff**（`git diff` 输出为空）——本版没有修改 Cordis 入门语义。

### 8.2 profile 解析查找顺序：note 落地与代际演进

**note 位置**：`.agents/notes/implemented/architecture/2026-09-19-profile-resolution-lookup-order.md`（182 行，本区间新增，`A` 状态）。

它解决的问题是**可陈述性**：0.1.6 的实现「为每个包名隐藏整个 `$DSH_HOME/profiles/node_modules` 层，并为历史目录布局保留专门识别代码」，导致「没人能判断某个解析结果是否预期」。

本版确立的单句规则（note 原文语义）：

> 普通模块请求保持 Node 的祖先 `node_modules` 顺序；在 profile 内，runtime resolution 的条目在 `$DSH_HOME/profiles/node_modules` 占据它们的包位。对位于已记录外链目录中的 importer，每个候选 `D/node_modules` 应用一条规则：`D/package.json` 的 `peerDependencies` 声明且 runtime resolution 具备的名字，在该位使用 runtime 包；否则 Node 尝试该处的物理包。更近的候选先于更远的 peer 声明。显式 CommonJS `paths` 永远绕过拦截。

**代际（generations）如何演进**——`2026-09-09-profile-resolution-generations.md` 是 0.1.6 已有的 note（不在本区间新增清单），本版被 `M`（修改），改动集中在**名称**：

- `createProfileResolutionGeneration` → `createRuntimeResolution`
- `ProfileResolutionGeneration` → `RuntimeResolution`
- `installProfileResolution` + `behavior` → `installRuntimeInterception`（无 behavior）

不变的是代际语义（`#immutable-generations` 锚点仍在）：拦截持有唯一的 `current` 代际；每次同步解析捕获一次引用；构造在发布前读完所需 manifest，出错则当前代际不变；发布只替换一个引用；选择缓存与包元数据缓存**属于**代际，发布后继只让旧代际不可达，不逐条改写。linked root 成员在代际内不可变，后继可增删根而无需重启；重新加回同名同目标允许，同名**不同目标**被拒（Node 缓存了真实路径）。

**本版实际删除的遗留机制**（可在代码中直接复核）：

| 0.1.6 机制 | 本版处置 | 证据 |
|---|---|---|
| `.dsh-module-fallback` 目录 + `PROFILE_MODULE_FALLBACK_DIR` 常量 | 降级为 `profile.ts:241` 的 `LINK_PROJECTION_DIR` 私有常量，只在 `removeLinkProjections()` 里用于**一次性清理** | `legacy-links.ts` 从 6 个导出缩到 1 个（`realModuleDirectory`） |
| `healProfilesModuleFallback()` | 删除；改为 `removeLinkProjections(dir)` | 旧名 `git grep` 为空 |
| `canonicalLinkPath()` / `symlinkPointsTo()` / `isPackagedExecutable()` 导出 | 删除或私有化 | HEAD 的 `legacy-links.ts` 仅 20 行 |
| link / dual 后端与 verify 模式 | 类型与形参均删除 | `ProfileResolutionMode` / `ProfileResolutionBehavior` `git grep` 为空 |

`removeLinkProjections()` 的作用域刻意收窄（`profile.ts:243-258` 注释）：**只**断开 profile 的 `node_modules` 下目标落在 `<profile>/.dsh-module-fallback/node_modules` 内的软链，然后删除该目录；pnpm 安装的包与其它软链一律保留。

### 8.3 profile 自有的 live 配置与易失引用

**note**：`.agents/notes/implemented/architecture/2026-09-19-profile-owned-live-configuration.md`（29 行，新增）与 `2026-09-18-volatile-config-references.md`（33 行，新增）。

两者的分工：前者管**写哪里**，后者管**引用何时有效**。

**写哪里（profile-owned）**：

- 插件把每个可配置值声明在 Cordis `Config` 里；可免重挂变更的字段用 `.volatile()`；消费方在操作时读引用。
- Settings 只**枚举**这些字段供表单使用，**从不提供业务配置**。
- profile 编辑器写 `cordis.patch.yml`，走**普通 Loader 协调路径**。
- 表单写入目标是 active profile；home patch 与命令行 overlay 仍是更高优先级部署输入，**会被它们遮蔽的编辑在持久化之前就失败**（对应 `config-editor/src/index.ts:127-129` 的 `isDeepStrictEqual` 检查）。
- Cordis 的 config patch **替换整个 entry 的 config**。所以「一个字段重置」恢复当前继承值；「整条 entry 重置」删除其 config override 以便后续 bundle 变更被继承；其余编辑会把**当时组合出的普通字段 + 每个 volatile 字段**整份存进 profile 行。note 明列了四个落地例子：`permission.presets`、`agent-presets`、`agent-loop.agents`、`web-search-deepseek.apiKeyEnv`。
- 被移除的 `$DSH_HOME/settings.yaml` **一次性导入** active profile：section id 即 entry id，另有 `ui-developer-tools → ui-settings`、`ui-onboarding → ui-settings-general`、`shell → 平台 shell executor entry` 三条映射；导入后文件改名为 `settings.yaml.imported`，保证不重复。

**引用何时易失（volatile）**：

- Schemastery 用 `.volatile()` 声明 live 字段，**保留节点类型与表单元数据**，同时返回指向不可变快照的稳定引用。
- 一般比较把两个 volatile 引用视为相等；Loader 用 schema 声明的 volatile 路径计算 raw config 差异。
- 当 raw diff 无普通变更但 raw config 不同：Loader 通过 fiber 的 `internal/config` 钩子解析校验候选，比较普通有效值，仍匹配才提交引用并通知所属 fiber。
- **只有 volatile 变更保留实例**；普通字段变更走既有 remount，**不更新旧引用**。
- 通知事件是**实例局部**的 `loader/volatile-update`，用普通 `emit`，监听器完成**不是**配置提交条件。
- 约束：schema 拒绝在动态容器内出现独立 volatile 引用（整个对象/数组可以是 volatile 值）；不可读的候选留在 raw config 里，运行中的引用不变直到下一次激活。
- `config-editor` 的 `edit()` 正是沿这条路径校验：`fiber.ctx.waterfall(fiber, 'internal/config', next, () => next)` 后接 `resolveConfig(fiber.runtime, resolved)`。

### 8.4 config-only HMR：**未实现**（proposed 状态）

**这是本篇必须纠正的一处任务描述偏差。**

| 检查项 | 实测结果 |
|---|---|
| note 路径 | `.agents/notes/proposed/simplification/2026-09-19-config-only-hmr.md` |
| note 状态 | `Status: proposed`（**不是** `implemented`） |
| 本区间是否新增 | 是（在 `notes-added.txt` 中，但位于 `proposed/` 目录） |
| `hmr/src/index.ts` 是否仍有模块替换 | **是**。文件头注释与实现保留 `ModuleLoader`、`ModuleJob`、`loadDependencies()`、模块缓存替换与回滚 |
| `getLinked()` 是否还在 | **是**。`docs/subsystems/boot.md` 生成区仍列出 `getLinked(url): Promise<string[]>` |
| `hmr/change` / `hmr/reload` 事件是否还在 | **是**。`hmr/src/index.ts:25-36` 仍声明并派发 |
| `hmr/error.ts`（import-error formatter）是否还在 | **是**，41 行，且有 `tests/error.spec.ts` |
| `packages/boot/hmr/README.md` 是否承诺模块替换 | **是**：「Reload plugin source and configuration while an application is running」 |

proposed note 拟做的事（保留 `watchConfig` / `runExclusive` / 精确 patch+manifest 监视 / 就绪协调 / 串行刷新 / 释放排空；移除模块 watcher 与派发、依赖图分析、模块缓存与 fiber 替换恢复、`baseDir`、`getOuterStack`、`getLinked`、`hmr/change`、`hmr/reload`、`error.ts`，约 400 行源码 + 372 行专用测试）**在本版均未执行**。

**本版 HMR 真正的变化是「承载更换 + 配置默认开启」**：

- 包从 vendored `@deepseek-ai/cordis-plugin-hmr` 换成自研 `@deepseek-ai/dsh-hmr`。`vendor/hmr/` 仍存在于仓库（`Test-Path vendor\hmr` 为 True），但 base bundle 使用的是 `@deepseek-ai/dsh-hmr`，且 `docs/cordis-api/inherited.md` 删除了 `ctx.hmr` 的 vendor 条目。
- `packages/boot/hmr/LICENSE` 新增，README 明说模块替换实现**派生自 `@cordisjs/plugin-hmr` 1.0.15**，保留其 MIT license。
- base bundle 的 `hmr` 行从 `disabled: true` + `root: ['.']` 改为 `disabled: !!js "!ctx.get('profileContext')"` + `root: []`。语义变化是：**有 profileContext 的启动默认开启 HMR，但默认只做配置重载**（`root: []` 关闭模块监视）；模块监视需在 profile patch 里显式写 `root: ["."]` 并 `disabled: false`。
- `docs/architecture.md` 对应改写为：「YAML controls HMR: base enables config-only `dsh-hmr`; headless, SDK and ACP disable it; `sdk-minimal` omits it.」

**因此本篇的准确表述是：HMR 的默认行为收敛到配置，但这不是「config-only HMR」note 的实现，而是 base bundle 里 `root: []` 这一行默认值 + 换包的结果；note 描述的删码不在本版。**

### 8.5 live config inspect provider

**note**：`.agents/notes/implemented/architecture/2026-09-21-live-config-inspect-provider.md`（25 行，新增，`implemented`）。

问题：Creator 模式 Agent 要为已安装插件写 `config:` 行，但没有任何运行时 Config schema 来源；CLI 的 `--dump-config-schema` 从运行中的 session 够不到；`Builtin` Host inspect provider 宣传的是模型已无法定义的动态 Host half 的沙箱符号。

决策落地（逐条可在代码核对）：

| note 主张 | 实现证据 |
|---|---|
| `@deepseek-ai/dsh-tool-cordis/host` 注册一个 `Config` provider，**不**注册 `Builtin` | `src/host.ts` 全文 20 行，只把 `hostInspectProviders(ctx)` 逐个 `register`；`src/providers.ts:40-81` 返回 `Service` / `Event` / `Config` / `Tool` 四个；`Builtin` 在整个 `packages/extensions` 中只剩 `cordis-client-runner/src/client/providers.ts:95`（**Client** 侧，note 明说 Client `Builtin` 不变） |
| `Config.listConfigs` 读 live Loader 树；无输入返回每个 entry 的 id/name/状态；有 entry id 则投**该 entry 的原生 Config** 成一份自包含 JSON Schema | `src/config.ts:98-119`：无 `entry` 走分页目录（`offset`/`limit` 1..100，默认 25，带 `total` 与 `nextOffset`）；有 `entry` 走 `createConfigProjector()` + `LOADER_EXPRESSION_SCHEMA` |
| inactive entry 报告 `inactive` 且无 schema | `src/config.ts:16` 的 `ConfigStatus` 含 `inactive`；`liveConfig()` 在 `fiber === undefined \|\| fiber.uid === null \|\| entry.disabled` 时返回 `inactive` |
| 不用 boot-free collector，因为运行中的 profile 已持有模块解析拦截且禁止重叠 | `collect.ts` 的 collector 与 `queryLiveConfig` 是两条路径；`config-schema/index.ts` 导出 `generateConfigSchema` 供 CLI，`projector.ts` 的 `createConfigProjector` 供 Host 单条投影 |

`ConfigStatus` 完整枚举是 `'schema' | 'absent' | 'unsupported' | 'tree' | 'inactive'`（`src/config.ts:16`），其中 `tree` 指 `cordis:group` / `cordis:include` 这类「config 是子条目列表而非插件 Config」的 Loader carrier。`queryLiveConfig` 还会附加 `packageDir`（entry 所属包目录，来自 `ctx.pluginPackages.packageOf`）。

### 8.6 默认工作区：note 已实现，但**实现不在本篇包范围内**

**note**：`.agents/notes/implemented/feature/2026-09-20-default-workspace.md`（33 行，新增，`implemented`）。本人在 HEAD 上核实了实现位置，结论如下 —— 这是本篇的**一次边界纠正**：

| note 主张 | 实际落点 | 是否属于本篇包范围 |
|---|---|---|
| Workspace registry 拥有资格判定与目录准备 | `packages/workspace/workspace/src/index.ts`（254 行改动） | **否** |
| Host controller 解析 Documents 位置 | `packages/api/workspace-controller/src/default-directory.ts`（`defaultWorkspaceDirectory()` / `validateDocumentsDirectory()`） | **否** |
| Client 在启动时按语言解析初始目录名与标题 | `packages/client/ui-workspace/src/client/locales.ts`、`navigation.ts` | **否** |
| 装配后的启动、重载、首次发送与 picker 路径验证 | `apps/web/tests/default-workspace.e2e.ts` | **否** |

`packages/host` 的 9 个包里**没有任何一个**参与该特性；`packages/boot` 也不参与（`loadProfileDirectory` 只处理 profile 目录）。所以：

- 该 note 是 **implemented，已核实**；
- 它与本篇的关系是**上游装配契约的消费者语义**（启动要等 Workspace 与 Session 基线齐备），但**代码归属不在本篇**，正确归属应是 workspace / api / client 组；
- 本人**未**核对该 note 的运行时行为（例如「hidden/archived Session 也计入首次使用判定」），仅核对了实现文件位置与 note 状态。

### 8.7 config schema dump 校验策略

**note**：`.agents/notes/implemented/feature/2026-09-20-config-schema-dump-validation-policy.md`（31 行，新增）。

三条被冻结的策略（对应实现可见于 `apps/cli/reference/README.md` 的 `#config-schema-dump` 段与本篇 app-boot README 的「Inspecting plugin configuration schemas」）：

1. **部分投影退出码 1**。`x-cordis.complete` 为 false，且只要存在任何 error 诊断、任何 `partial`/`unsupported`/`error` entry，或**一个插件名映射到多个 Config 定义**，CLI 就退出 1——**即使 stdout 里是一份有效且有用的 schema**。退出码回答的是「这份文档能否替代原生校验」，不是「是否产出了输出」。调用方若只要 schema，读 stdout 并忽略退出码；`x-cordis` 下的诊断会在它影响的每个 entry 上点名限制。
2. **发现是「声明导向」且包含 disabled 行**。collector 走 Loader 会收到的每一行（含被字面量或表达式禁用的行）并 import 其模块，因此**一个被禁用行的 import 或 include 失败会让一个本可启动的 profile 判定为 incomplete**。唯一例外跟随 Loader：不带 `group: true` 的 disabled group/include 从不创建子级，其缺失的 carrier config 记为空树。
3. **加宽而非模拟原生变更**。凡是原生解析可能在校验读取之前改写输入的地方（容器回写适配值、字典键重命名、宽松回落、惰性元数据传播到共享节点），投影**保留可得的声明细节并附一个不受限的替代分支**、记录一条 limitation，**从不模拟该变更**。加宽的作用域按机制限定：只有容器会回写适配值，因此作为更早 union 分支的裸 primitive transform 仍保留 `anyOf`。

替代方案均被否决并记录：退出 0 + 仅警告（消费方会把近似文档当权威）、跳过 disabled 行（会随 `disabled` 开关改变 `configRef` 目标）、为祖先禁用的子级做宽松变体（需要并行的 `entryList`/`entry` 规则集）、在投影里模拟原生变更（transform 回调是插件代码，dump 不该执行）。

**本版相关实现规模**：`app-boot/src/config-schema/` 7 个新文件（`collect.ts` 249、`projector.ts` 455、`document.ts` 169、`types.ts` 95、`pattern.ts` 62、`index.ts` 39、`native.ts` 16），测试 `config-schema.spec.ts` 608 行 + `schemastery-json-schema.spec.ts` 564 行 + `config-pattern.spec.ts` 52 行。`docs/config-catalog.md` 的 **+910 行**主要是这份投影的产物。

### 8.8 app-boot 拆包与导出面变化

`packages/boot/app-boot/src/index.ts` 的导出面（逐一对照 0.1.6 与 HEAD 的 `export { ... } from './profile.ts'` 块）：

**删除的导出**：`createProfileResolutionGeneration`、`healProfilesModuleFallback`、`DEFAULT_PROFILE_PATCH_RELOAD`、`ProfileModuleFallbackOptions`、`ProfileResolutionEntry`、`ProfileResolutionGeneration`、`ProfileResolutionMode`。

**新增的导出**（按职责分组）：

| 组 | 新增导出 |
|---|---|
| 解析表 | `createRuntimeResolution`、`RuntimeResolution`、`RuntimeResolutionEntry`、`RuntimeResolutionOptions`、`LinkedRoot`、`removeLinkProjections` |
| profile 元数据 | `ProfileContext`、`ProfilePnpmInvocation`、`readProfilePatches`、`resolveTelemetryPatch`、`readPluginMeta` |
| profile 依赖 | `readProfilePlugins`、`reconcileProfilePlugins`、`writeProfileBundles`、`ProfilePluginLocation`、`ProfilePluginDependency`、`ProfilePluginInventory`、`ProfilePluginReconciliation`、`OPTIONAL_BUNDLES` |
| 兼容性 | `getDshRuntimeVersion`、`evaluatePluginCompatibility`、`pluginCompatibilityWarning`、`PluginCompatibility`、`prepareProfileEntries`、`prepareProfilePatches` |
| 版本豁免 | `PROFILE_COMPATIBILITY_FILENAME`、`readProfileCompatibility`、`readProfileVersionExemptions`、`setProfileVersionExemption`、`ProfileCompatibility` |
| 配置 schema | `generateConfigSchema`、`ConfigSchemaDump`、`NativeConfigSchema`、`createConfigProjector`、`LOADER_EXPRESSION_SCHEMA`、`ConfigProjection`、`isNativeConfigSchema` |
| 恢复 | `sanitizeProfile` |

**新增的 `src/` 文件**（`--diff-filter=A` 实测 23 个）：`compatibility-preflight.ts`、`config-schema/{collect,document,index,native,pattern,projector,types}.ts`、`package-meta.ts`、`plugin-compatibility.ts`、`profile-compatibility.ts`、`profile-context.ts`、`profile-plugins.ts`、`profile-sanitize.ts`。`src/watch-config.ts` 被 rename 到 `packages/boot/hmr/`（R086）。

`ProfileContext` 的字段（`profile-context.ts:15-32`）是拆包后的关键契约：`name`、`packageManager?`（`ProfilePnpmInvocation`，打包应用用自带运行时替代 PATH 可执行文件）、`dir`、`patchPath`、`installAnchor`、`cwd`、`home`、`startedBundles`、`overlays`、`telemetryDisabledEnv`。注释明确「Current profile facts; **scheduling and mutation belong to their callers**」——这是 `hmr` / `config-editor` / `plugin-manager` 三个包能独立存在的前提。

`resolveTelemetryPatch(disabledEnv, hasRow)` 的语义值得单记：`DSH_TELEMETRY_DISABLED` 的**任意非空值**（包括 `'0'` / `'false'`）都关闭遥测 —— 隐私开关宁可「误关」也不「误开」，且组合里没有遥测行时不生成 patch。

### 8.9 DSH peer 兼容性预检与精确版本豁免（新增能力）

这是本版 boot 层最实质的新增能力，跨 `app-boot` 与 `plugin-manager` 两个包。

**判定规则**（`plugin-compatibility.ts`）：

- 只检查 `peerDependencies` 里名为 `@deepseek-ai/dsh` 或 `@deepseek-ai/dsh-*` 的项；**不看 `engines.dsh`**；
- 每个声明的 range 都必须匹配 `getDshRuntimeVersion()` 返回的**单一**运行版本；
- 预发布版本参与匹配（`includePrerelease: true`）；
- 源码工作区的 `workspace:^` / `workspace:~` / `workspace:*` 指代同一运行版本；其它无效 range 判为不兼容；
- 缺失 DSH peer **不施加约束**；
- 该检查**不是**针对恶意包代码的沙箱（README 原文）。

**准入时机**（`compatibility-preflight.ts`）：只在 DSH 自己拥有的组合边界判定；被拒行在**启动器自己那份组合副本**里被拒，profile patch 层、依赖清单、bundle 列表都不变。`prepareProfilePatches` 在启动器**空 profile 根**之上组合，且在 root Include 已挂载时、以及每次 profile 重组合时运行，因此被拒插件**永不 import 其模块**。`prepareProfileEntries` 对 preset 的行做同样的事。

**豁免存储**：`profiles/<name>/compatibility.json`（`PROFILE_COMPATIBILITY_FILENAME`），`package-name@version → [精确 DSH 版本]`。选择独立文件而非写进 `package.json` 的理由（README）：授权写入绝不触碰依赖清单、bundle 列表或 Cordis patch 文件。文件缺失 = 无豁免；**畸形文件不阻止启动**：读取器接受的记录仍生效，每条被拒记录在 stderr 上报在插件拒绝信息旁边，此后文件被视为**只读**（`rewritable: false`），授权/撤销会拒绝并要求用户手工修复，而不是覆盖其内容。

**与「安装时拒绝」的分工**（`plugin-manager/README.md#version-compatibility-and-exemptions`）：

- 命名了包的安装命令（`add`，或带 spec 的 `install`）**在 pnpm 运行前**检查：本地路径读自身 `package.json`；registry spec 经 pnpm registry 查询所选版本及其 peer 声明。不兼容 → pnpm 不运行、不下载、不跑构建脚本；调用方随请求提交的构建授权**已先记录**且保留。
- git 或 tarball spec 需要拉取本身，**安装后**才判定：随后恢复 profile manifest 与 lockfile、按恢复后的 lockfile 重装（profile 原本没有 lockfile 时按恢复后的 manifest 重装且不新建），并报告恢复是否成功；已授权的构建脚本副作用可能残留。
- 运行未改动的依赖**永不**阻止无关操作：它保持安装、该次运行给出点名警告、profile 启动时拒绝它。
- 授权需要显式 `acceptRisk: true`；`setVersionExemption` 的 JSDoc 写明「Required true for grants after the user accepts possible crashes and data loss」。撤销可以移除历史 runtime 授权。
- CLI 暴露 `dsh plugin --profile <profile> version-exemptions`、`allow-version <package@version> --dsh-version <runtime> --accept-risk`、`revoke-version <package@version> --dsh-version <runtime>`。
- 拒绝以 **`incompatible-version`** 错误码携带每个被拒包的 `name`、`version`、`runtimeVersion`、未满足的 `peers`（`types.ts:22-24`、`index.ts:302/510/547/723`）。

### 8.10 plugin-manager 的其余改动（属本篇范围，不越界深写）

按 `git log` 的时间顺序，本区间内该包主要提交为：`98b92b683c`（新增 current-profile manager 服务）、`4d1adb8541`（Web 侧管理页）、`ffffac3cba`（安装前批准被拦截的依赖构建）、`a5dea502a6`（审阅修正 + 移除 agent notices）、`716e2e2683`（不可达注册表时依次改问）、`cb2750019a`（读 pnpm 自己的 registry、其 stdout 拒绝、失败归位）、`f938ebad64`（恢复丢失的安装响应 → `waitForInstall`）、`27207bfedb`（确定性停止首次运行前的安装）、`de662ee010`（跳过失败的 profile bundle 并保留恢复手段）、`8cf07ea76c`（初次查找时保留已记住的注册表）、`3c50bf6b6c`（选择第一个有响应的公共注册表）、`0edfe83573` + `75d74a055e`（安装前的 GitHub 连接检查与认证回退）、`ccaa0dc11c`（**给 pnpm 运行加上界，避免静默子进程持锁**）、`2c67633990` / `747c98b0db` / `51d70c5f5c`（DSH peer 兼容性与类型化拒绝）。

其中三项有独立的设计记录：

| 主题 | note / 文档 | 实现落点 |
|---|---|---|
| 注册表次序与私有注册表保护 | `2026-09-18-plugin-install-registries.md` | `src/registry.ts` 的 `registryPlan()` / `attributeFailure()`；`NEXT_REGISTRY_KINDS = {network, timeout, not-found, no-matching-version}` |
| 构建脚本批准 | README「When pnpm 11 blocks dependency scripts」段 | `src/build-approval.ts`(50)、`InstallBundleOptions.approvedBuilds`、`ChangeResult.pendingBuilds` / `approvedBuilds` |
| 有界的 pnpm 运行 | 提交 `ccaa0dc11c`（标题即证据） | `ChangeResult.packageResult` 的 `timedOut`；`docs/subsystems/boot.md`：被终止的运行**一律**归类 `timeout`，无论信号留下什么退出状态，因此安装与卸载报告失败而非成功，也不再改问下一个注册表 |

`github-connection.ts` 的实现细节（`src/github-connection.ts:44-53`）：`git -c credential.helper= ls-remote -- <repo> HEAD`，环境固定 `LC_ALL=C`、`GIT_TERMINAL_PROMPT=0`、`GIT_ASKPASS=''`、`SSH_ASKPASS=''`、`SSH_ASKPASS_REQUIRE=never`，`stdin: 'ignore'`，`killDescendants: true` + `killSignal: 'SIGKILL'`，超时由 `githubConnectionTimeoutMs`（默认 5000）界定。**只有网络失败与超时停止安装**；认证、仓库查找等失败留给 pnpm，包括其 HTTPS→SSH 回退。

`docs/subsystems/boot.md`（本版新增的官方子系统页）是这套接口的权威清单，含 12 个 `@Remote` 方法、`app-boot/*` 与 `hmr/*` 与 `plugin-manager/*` 事件、以及 `ctx.profileContext` / `ctx.pluginRegistryProbe`。注意其中 `ctx.pluginRegistryProbe` 的来源写的是 `packages/client/ui-plugin-manager/src/index.ts` —— **属 client 组，不在本篇包范围**，本篇只在数据流里提及其存在。

### 8.11 preset 组：从目录式到声明式

**note**：`2026-09-18-declarative-agent-presets.md`（本区间新增，`implemented`）。

| 维度 | 0.1.6 | 0.1.7-rc.1 |
|---|---|---|
| 声明载体 | `packages/preset/agent-presets/presets/<id>/{preset.yml, agent.cordis.yml}` 目录树 | `@deepseek-ai/dsh-agent-preset` 的 `config.plugins`，即**普通 Cordis YAML 行** |
| 包数 | 2（`agent-presets`、`persona`） | 3（`agent-preset-registry`、`agent-preset`、`persona`） |
| 具体 preset 声明所在 | preset 包内 | `packages/bundle/web-app/presets/{cordis,minimal,ptc,standard}.patch.yml`（**新增 4 个文件**） |
| 发现/元数据/复制/编辑 | `discovery.ts`(337)、`metadata.ts`(105)、`authoring.ts`(191)、`specifier.ts`(49) 等 | 删除；由 `agent-preset-registry` 的 `definition.ts` / `preset.ts` 承担 |
| 修订保留 | 无（目录即定义） | registry 持有每个修订的 scope 与 Loader 树；Agent 把自己的 scope 链到所选修订，子级继承父级的**确切修订**；更新时旧修订退役，Agent 与临时冷读者保留引用直到销毁，最后一次释放才 dispose 退役树 |

note 记录的关键取舍：**修订保留是为了让「保存时销毁定义」不撤销运行中 Agent 的工具**。替代方案「让每个声明插件持有自己的 live 子级树」被否，因为 Loader 在编辑期间 dispose 会撤销运行中 Agent 的工具。第二个取舍是**急切激活**（eager）：懒加载会推迟诊断并引入 pending-first-use 状态；本版接受急切激活，坏定义留在 roster 里、拒绝新的绑定，但**不阻止应用启动**。

`packages/preset/README.md` 的三行包表（本版重写）：`agent-preset-registry`（选举、修订保留与 profile 编辑，`ctx.agentPresets`）、`agent-preset`（声明式子插件与元数据，无 ctx key）、`persona`（可组合 Agent persona）。

**归属注意**：Agent preset 的**运行时装载**（`prepareProfileEntries` 对 preset 行的准入、registry 拥有的子 Loader 树）跨 preset 与 app-boot 两个包；本篇只写 app-boot 侧的准入契约，preset 内部的 scope 链与修订生命周期留在 preset 篇（若有）。

### 8.12 bundle 组：有序 patch 列表、base 新行、web-app presets

**`dsh.bundle.patch` 接受有序文件列表**（提交 `654caa4bbd feat(bundle): accept an ordered patch file list in dsh.bundle.patch (#4722)`）：

```ts
// packages/boot/app-boot/src/profile.ts:58-75
export function bundlePatchFiles(bundle: DshBundleManifest): string[] {
  const declared = typeof bundle.patch === 'string' ? [bundle.patch] : bundle.patch
  if (!Array.isArray(declared) || !declared.every(file => typeof file === 'string')) {
    throw new Error('dsh.bundle.patch must be a file path or a list of file paths')
  }
  return declared
}

export function bundlePatchPaths(packageDir: string, bundle: DshBundleManifest): string[] {
  return bundlePatchFiles(bundle).map(file => join(packageDir, file))
}
```

`ProfileLayer.patches` 是**每个文件解析后的 patch 列表按应用顺序拼接**的结果（`profile.ts:85-86` 的 JSDoc）。

**base bundle 的关键改动**（`git diff packages/bundle/base/cordis.patch.yml`，42 行）：

| 行 | 0.1.6 | 0.1.7-rc.1 |
|---|---|---|
| `hmr` | `name: '@deepseek-ai/cordis-plugin-hmr'`，`disabled: true`，`root: ['.']` | `name: '@deepseek-ai/dsh-hmr'`，`disabled: !!js "!ctx.get('profileContext')"`，`root: []` |
| `plugin-manager` | 无 | **新增** `@deepseek-ai/dsh-plugin-manager`，`disabled: !!js "!ctx.get('profileContext')"` |
| `tool-plugin-manager` | 无 | **新增** `@deepseek-ai/dsh-plugin-manager/tools`，`disabled: true` |
| `config-editor` | 无 | **新增** `@deepseek-ai/dsh-config-editor`，`disabled: !!js "!ctx.get('profileContext')"` |
| `settings` | `name: '@deepseek-ai/dsh-settings-file'` | `name: '@deepseek-ai/dsh-settings'`，加 `disabled: !!js "!ctx.get('profileContext')"` |
| `spill-policy` | `maxInlineBytes: 50000` | `maxInlineTokens: 12500` |

（`authorization`、`deepseek-account` 两行也是本版新增，但它们属于 settings/credentials 篇，本篇只记录该 patch 文件确实被改。）

**`web-app` 的 presets 目录**：4 个新增 patch 文件（`cordis.patch.yml` 8089 B、`minimal.patch.yml` 3184 B、`ptc.patch.yml` 7697 B、`standard.patch.yml` 7511 B），承接原先 `packages/preset/agent-presets/presets/*/agent.cordis.yml` 的内容。以 `minimal.patch.yml` 为例，它插入一条 `id: preset-minimal` / `name: '@deepseek-ai/dsh-agent-preset'` 的声明，`config` 里是 `id`、`order` 与 `plugins` 列表（例如 `persona` 行与 `persistent-shell` group）。注释写明：**Web 编辑器保存的编辑会按 id 从 profile patch 覆盖该行的 `config.plugins`**。

### 8.13 host 组

| 变更 | 证据 |
|---|---|
| **新增 `product-telemetry-otel`** | 10 个新文件；`src/index.ts` 171 行；README 明说「Mounting the plugin collects nothing automatically; applications explicitly submit each event」，并要求 `DSH_APP_VERSION` 在启动器环境中设置（schema 拒绝缺失版本）；默认 endpoint `https://dsh-otel-collector.deepseeksvc.com/v1/logs` |
| `plugin-inventory` 支持展示元数据 | `src/index.ts` 新增 `pluginEntryId()` 的**导出**（原先为私有）；`list()` 的返回类型注释加入 "with optional display metadata"；文件头 import 从 `dsh-agent-presets` 改为 `dsh-agent-preset-registry` |
| `open-in-app` 跨平台文件关联 | `src/resolver.ts` 32 行、`src/icons.ts` 52 行、`src/shared.ts` 26 行；相关提交 `a1545a9bf5 feat: share file associations across macOS Windows and Linux`、`95611fbc63 fix(native-command): encode the Explorer target so a comma stays in the path` |
| `frontend-static` 从文档目录服务资源 | `src/index.ts` 7 行；对应提交 `eeb9b03465 feat(web): serve the shell, API and plugin resources from the document directory`、`29182514ed fix(web): resolve feature routes from the document directory and gate browser routes` |
| `webserver` 极小改动 | `src/index.ts` 3 行、`src/injections.ts` 2 行 |

**未核实**：`product-telemetry-otel` 的批处理、压缩选项与关闭时限细节本人只读了 README 前 45 行与 `src/index.ts` 的行数，**未通读 171 行源码**；OTLP/HTTP 传输的具体契约需以该包 README 的后续章节为准。

### 8.14 context 组

无新增、无删除包，改动集中两处：

**`session-reference`**（`src/index.ts` 57 行、`tests/` 161 行）：候选列表从「标题或 id」扩展为**规范提及标签 + 展示标题**双字段 —— `listCandidates()` 的返回项新增 `displayTitle`，过滤条件同时匹配 `label` 与 `displayTitle`。文件头新增 `import type {} from '@deepseek-ai/dsh-subagent'`，说明展示标题来自 `dsh-subagent` 的投影。原 `projectedTitle()` 改名为 `projectedLabels()`，其 JSDoc 从「The title a session's projections can answer without reading its log」改为「The mention label and display title ...」。同一 JSDoc 保留了关键约束：**折叠标题要付出整条日志的代价，而该调用位于 `@` 补全的每一次按键之下**，所以只读投影。

**`time-context`**：`src/index.ts` 11 行、`src/invariant.ts` 10 行、4 个测试文件共 61 行。

其余：`agent-instructions` 的 `src/state.ts` 2 行、`file-reference/src/index.ts` 2 行、`file-reference-local` 与 `agent-instructions` 的 `package.json` 为版本/依赖对齐（52 / 24 行）。

**未核实**：`agent-instructions` 与 `tmux-context` 的语义变更本人只看了 `--stat`，未读 diff 正文。

### 8.15 extensions 组：模型侧自改能力收缩

这是本篇除 boot 拆包之外最显著的**能力**变化，且有独立设计记录 `2026-09-16-creator-persistent-plugin-management.md`（本区间新增）。

| 维度 | 0.1.6 | 0.1.7-rc.1 |
|---|---|---|
| `tool-cordis` 模型可见工具 | **7 个**：`cordis_inspect_list`、`cordis_inspect_query`、`cordis_inspect_self`、define、run、stop、undefine | **2 个**：`cordis_inspect_list`、`cordis_inspect_query` |
| `inject` | `['tools', 'systemPrompt', 'dynamicCordisRunner', 'cordisInspect']` | `['tools', 'cordisInspect']` |
| system prompt 段 | `ctx.systemPrompt.section({ name: 'tool:cordis', ... CORDIS_SYSTEM_PROMPT })` | 无（`src/prompt.ts` 107 行删除） |
| Host provider 注册 | 在每个 `tool-cordis` 行内注册 | 迁到独立的 `/host` 入口（`src/host.ts`，`inject = ['cordisInspect', 'tools']`），**每进程一次** |
| 持久化安装 | define/run 生成进程内动态包，重启消失 | `install_bundle` 装真实组合包，跨会话存活 |
| `HOST_BUILTIN_INSPECTION` | 从 `cordis-host-runner` 导出 | 导出删除，`src/sandbox.ts` 删除 |

`2026-09-16-creator-persistent-plugin-management.md` 的决策原文要点：Creator 模式启用既有的 `plugin_manager` 工具；Agent 以工作区文件形式编写包与 Loader YAML patch，再通过 `install_bundle` 安装。MCP 连接是只用配置的组合包（插入已安装的 `dsh-mcp-client`）；UI 组合包包含一个 Host 行与一个 Client 产物。**整个管理工具要求 `danger-full-access` 或单次审批**：profile 变更能以宿主用户权限加载代码并影响其它会话；每次执行（**包括清单读取**）都先过共享的沙箱升级助手与审批服务。授权**不改变会话权限**，但其 profile 变更会持久化。

同时保留的边界（同 note）：「既有 runtime 与 Client 消费者保留其服务；历史 session 卡片仍可读。」即 `cordis-host-runner` / `cordis-client-runner` 的 runner 写 API **未删**，供程序化与浏览器消费者使用；删除它们需要与那些消费者一起替换。

**`cordis-host-runner` 的另一处行为变更**：失败投递给 Agent 的消息从「自主检视并重试」改为「**向用户报告失败**」。三处文本同向改动（`src/index.ts`）：

- `Cordis ${mode} ${identity} failed after the runner returned ${status}` —— 把 `cordis_run` 这个名字从模型可见文本里去掉；
- `Inspect the failed Package, correct it on the same Plugin when needed, and retry the activation autonomously.` → `Report the failure to the user; the definition can be managed through the Cordis panel.`
- Client 渲染失败与 guard 拒绝同样改为「向用户报告」。

消息来源标签也从 `{ kind: 'plugin', plugin: 'cordis-host-runner' }` 改为 `{ kind: 'cordis-host-runner' }`，通过在 `@deepseek-ai/dsh-llm` 的 `MessageSourceMap` 上做声明合并实现（`src/index.ts:12-16`）。**这个声明合并顺序有个坑**：它插在 `import { createUserMessage }` 之后、`import { TypertRemoteService }` 之前，即模块导入语句被声明块分隔。

### 8.16 官方文档在区间内的变更

| 文档 | 变更 | 说明 |
|---|---|---|
| `docs/subsystems/boot.md` | **+322 行，新增** | 标题为 "Profile management"，含 `## Management records` 手写段 + 约 300 行的 `BEGIN GENERATED cordis-surface` 生成区。它是 `packages/boot/README.md` 声明的子系统英文权威页，并在 `docs/subsystems/README.md` 的表格中新增一行："boot.md — Current-profile plugin management and launcher reload coordination" |
| `docs/architecture.md` | 20 行 | 关键改写：profile 段的 `patchReload` 表述改成「YAML controls HMR」；新增「Base includes Plugin Manager for Web and agents」 |
| `docs/config-catalog.md` | **+910 行** | 生成物；增量主要来自 config schema 投影与新增包的 Config |
| `docs/module-graph.md` | 402 行 | 生成物；包含 `2026-09-18-profile-plugin-host-runtime-instances` note 提到的 peer 边 |
| `docs/cordis-api/inherited.md` | 31 行 | 新增 `internal/config` waterfall（`vendor/cordis/src/events.ts:339`）与 `loader/volatile-update`（`vendor/loader/src/index.ts:34`）；**删除 `ctx.hmr`** 与 `hmr/change`/`hmr/reload` 的 vendor 条目；行号整体位移（cordis events 从 328 起变为 331 起，loader 从 23 起变为 25 起） |
| `docs/cordis-primer.md` | **无 diff** | 本版未改 Cordis 入门语义 |
| `docs/subsystems/README.md` | 5 行 | 新增 `boot.md`、`deliverables.md`、`office-to-pdf.md`、`voice-input.md`、`product-telemetry.md` 五行索引 |

上表 `docs/subsystems/boot.md` 的 note 结构落点核对（`docs/subsystems/boot.md:5-19` 手写段）：`PluginEntryId`（调用方从 `listPlugins` 取得，而非自行构造 patch id）、`PluginInfo`（模块身份、生效启用状态、fiber phase、可选展示 `meta`，外加唯一 `patchId` 或 `readOnlyReason`）、`BundleInfo`（包名、可选安装版本、所选启用状态、可移除性与可选解析错误）、`InstallBundleOptions.enabled` 默认 true、`PluginRegistries`（配置的首选注册表 + `null` 表示 pnpm 自己配置命名的那个 + fallbacks + `resolved`）、`ChangeResult.changed` 与 `application` 的独立语义、以及 `failedAt` 区分「到不了所问注册表」与「到不了 git/tarball 的拉取主机」。

### 8.17 迁移与兼容性影响

对外部插件开发者与 profile 维护者，本版有如下硬性影响：

1. **HMR 模块名变更**：`@deepseek-ai/cordis-plugin-hmr` → `@deepseek-ai/dsh-hmr`。`packages/boot/hmr/README.md` 明说「Existing configurations replace the module name」，且 `hmr` service key、`baseDir`、`config`、`getLinked()`、`getOuterStack()`、`hmr/change`、`hmr/reload` **全部保留** —— 所以这是一次模块名替换，不是 API 破坏。
2. **`ProfileTemplate.patchReload` 字段消失**：任何读取 `DEFAULT_PROFILE_PATCH_RELOAD` 或遍历 `PROFILE_TEMPLATES[name].patchReload` 的代码必须改写。0.1.6 里这两者存在（`package-manifest` 导出 `ProfilePatchReload` 类型，五个 shipped 模板分别标 `'startup'`/`'live'`/`'startup'`×3，`DEFAULT_PROFILE_PATCH_RELOAD = 'live'`）；本版 `PROFILE_TEMPLATES` 只剩 `bundles`（`profile.ts:158-174`），`DEFAULT_PROFILE_PATCH_RELOAD` 已在 HEAD 上无处出现。
3. **`RuntimeResolution*` 重命名**：外部消费者（若有）需把 `ProfileResolutionGeneration` → `RuntimeResolution`、`ProfileResolutionEntry` → `RuntimeResolutionEntry`；`createProfileResolutionGeneration()` → `createRuntimeResolution()`（返回 Promise）；`installProfileResolution(g, behavior)` → `installRuntimeInterception(r)`。
4. **不兼容插件默认被拒**：任何 `peerDependencies` 里声明了不匹配 `@deepseek-ai/dsh*` range 的已装插件，**profile 启动时**该行会被置 `disabled: true`；要恢复需 `dsh plugin allow-version <pkg@ver> --dsh-version <runtime> --accept-risk`，或修好插件的 peer 声明。`engines.dsh` 不参与判定。
5. **`compatibility.json` 是新的 profile 文件**：应纳入 profile 备份/迁移范围；畸形文件会进入只读状态（可启动，但授权/撤销拒绝）。
6. **`tool-cordis` 的生成式工具消失**：依赖 `cordis_define` / `cordis_run` 等工具名的工作流必须改为写工作区文件 + `plugin_manager install_bundle`。历史 session 卡片仍可读（note 明说 retired-tools 覆盖 + 历史卡片测试）。
7. **`@deepseek-ai/dsh-settings-file` → `@deepseek-ai/dsh-settings`**，且 `$DSH_HOME/settings.yaml` 一次性导入后改名为 `settings.yaml.imported`。任何直接读写 `settings.yaml` 的外部工具会失效。
8. **`dsh.bundle.patch` 现在是「字符串或字符串列表」**：字符串形式完全兼容。
9. **`spill-policy.maxInlineBytes: 50000` → `maxInlineTokens: 12500`**：单位从字节变成 token，量级不可直接换算；有覆盖该字段的 profile patch 需要改字段名。

### 8.18 未核实项（显式清单）

| # | 事项 | 原因 |
|---|---|---|
| 1 | **config-only HMR 的实现** | 该 note 为 `proposed`；已在 8.4 节逐项核实「未实现」，但若上游在 rc.1 之后的提交中落地，本篇不覆盖 |
| 2 | 「默认工作区」特性的**运行时行为** | 已核实 note 状态为 implemented 与实现文件位置；但 `packages/workspace/workspace/src/index.ts`(254 行改动)、`packages/api/workspace-controller/src/default-directory.ts`、`apps/web/tests/default-workspace.e2e.ts` 的正文未读（均在本篇包范围外） |
| 3 | `docs/config-catalog.md` 的 +910 行**内容** | 只核实了行数与它是生成物；未逐段阅读 |
| 4 | `product-telemetry-otel` 的传输契约 | 只读 README 前 45 行 + 文件清单；`src/index.ts`(171 行) 未通读 |
| 5 | `agent-instructions` / `tmux-context` / `file-reference*` 的语义变更 | 只看 `--stat`，未读 diff 正文 |
| 6 | 测试断言的实际通过情况 | 本会话未构建仓库、未运行 `pnpm run test`；所有测试相关表述均来自 `--stat` 行数与 note 中声明的验证面 |
| 7 | `packages/extensions` 的 469 个提交中，哪些直接改动本篇 4 个包 | 469 是该路径下含 merge 的总提交数；本篇只列了与 4 个包语义相关的提交，未逐一分类 |
| 8 | `ctx.pluginRegistryProbe` 的实现 | 源码在 `packages/client/ui-plugin-manager/src/index.ts`，属 client 组，超出本篇范围 |
| 9 | `packages/boot/cmdline` 是否有 `src` 语义变更 | `--stat` 只显示 `package.json` 12 行（多为依赖对齐），未读该文件确认 |

---

## 附录：本版提交索引

以下按包组列出本区间内（`dsh-v0.1.6-alpha.1..dsh-v0.1.7-rc.1`，时间取自 `git log --date=short`）与本篇语义直接相关的提交。带 `release(dsh):` 前缀的行是版本发布点，用于定位区间内的中间版本。

### `packages/boot`

```text
51d70c5f5c 2026-09-23 feat(plugins): report incompatible versions as typed refusals
747c98b0db 2026-09-23 fix(plugins): deny incompatible bundles and clarify compatibility refusals
2c67633990 2026-09-23 feat(plugins): enforce DSH peer compatibility with exact exemptions
ccaa0dc11c 2026-09-23 fix(plugin-manager): bound pnpm runs so a silent child cannot hold the profile lock (#4982)
75d74a055e 2026-09-22 fix(plugin-manager): preserve authentication fallback during GitHub checks
0edfe83573 2026-09-22 fix(plugin-manager): bound GitHub connection checks before installation
37372101b5 2026-09-22 build: pin internal DSH workspace dependencies
3c50bf6b6c 2026-09-22 feat(plugin-manager): choose the first responsive public registry
8cf07ea76c 2026-09-22 fix(plugin-manager): preserve remembered registries during initial lookup
9f9a50e553 2026-09-22 feat(app-boot): treat uncaught exceptions as fatal through installFailLoud
601d6761e4 2026-09-21 feat(settings): project volatile Config through profile-backed forms (#4587)
4eb26f0e71 2026-09-21 feat(cli): export JSON Schema for Cordis configuration (#4705)
3e7af9cfbb 2026-09-21 feat(boot): resolve linked plugin peers from the running installation
27207bfedb 2026-09-18 test(plugin-manager): stop an install before its first run deterministically
15e07d2721 2026-09-19 refactor(boot): rename the profile resolution generation to the runtime resolution
02fec3209e 2026-09-18 fix(boot): remove link-backend profile projections on profile load
de662ee010 2026-09-18 fix(boot): skip failed profile bundles and retain recovery controls (#4516)
716e2e2683 2026-09-18 feat(plugin-manager): ask configured registries in turn while one is unreachable
a5dea502a6 2026-09-15 fix(plugin-manager): address approval review and remove agent notices
ffffac3cba 2026-09-15 fix(plugin-manager): approve blocked dependency builds before retrying
4d1adb8541 2026-09-15 feat(web): manage plugins over the #4182 manager from the sidebar page
abd765a600 2026-09-15 refactor(hmr): own profile reload lifecycle through YAML
d06e6b5519 2026-09-14 feat: coordinate profile management through dsh-hmr
98b92b683c 2026-09-14 feat: add current-profile plugin manager service and Web controls
```

（区间内 `packages/boot` 共 120 个含 merge 的提交；上表是语义相关子集。区间内中间版本：`0.1.6-alpha.2` → `0.1.7-alpha.1` → `0.1.7-alpha.2` → `0.1.7-rc.1`。）

### `packages/preset`

```text
d1e22a7e24 2026-09-21 feat(preset): declare Agent compositions in profile YAML (#4569)
a9f205c584 2026-09-19 refactor(plugins): rename PackageMeta to PluginLocalizedMeta
3863992e67 2026-09-19 Merge pull request #4571 from deepseek-harness/worktree-pluginlocale
```

（共 34 个含 merge 的提交；表内为结构性与语义性提交。）

### `packages/bundle`

```text
5e25475857 2026-09-23 fix(office): use bundled LibreOffice Kit 0.1.0 CLI across deployments (#4902)
654caa4bbd 2026-09-20 feat(bundle): accept an ordered patch file list in dsh.bundle.patch (#4722)
d0ddf939f0 2026-09-21 refactor(office): transfer PDFs as multipart bytes (#4830)
601d6761e4 2026-09-21 feat(settings): project volatile Config through profile-backed forms (#4587)
d1e22a7e24 2026-09-21 feat(preset): declare Agent compositions in profile YAML (#4569)
```

（共 148 个含 merge 的提交。`web-app/presets/*.patch.yml` 的 4 个新增文件由 `d1e22a7e24` 引入。）

### `packages/host`

```text
38596d5c70 2026-09-23 Merge pull request #4876 from deepseek-harness/fix/windows-open-through-explorer
95611fbc63 2026-09-22 fix(native-command): encode the Explorer target so a comma stays in the path
68e43b173e 2026-09-22 fix(native-command): open Windows paths through the shell's resolution
535cb4aae3 2026-09-21 fix(telemetry): isolate collector transport and address review
910d52f717 2026-09-21 feat(telemetry): add explicit product event OTLP exporter
ecf6acfb15 2026-09-19 feat(api): support binary fields in Remote results
a1545a9bf5 2026-09-20 feat: share file associations across macOS Windows and Linux
b689c724d1 2026-09-20 docs: describe cross-platform file opening and pin desktop browser fixtures
a9f205c584 2026-09-19 refactor(plugins): rename PackageMeta to PluginLocalizedMeta
0b7cb4102b 2026-09-19 feat(plugins): resolve installed metadata through runtime resource exports
f8240240fa 2026-09-19 docs(plugins): define localized display metadata and fallback rules
eeb9b03465 2026-09-17 feat(web): serve the shell, API and plugin resources from the document directory
29182514ed 2026-09-17 fix(web): resolve feature routes from the document directory and gate browser routes
```

（共 31 个含 merge 的提交。）

### `packages/extensions`

```text
4aba48ec03 2026-09-21 fix(cordis): register Host inspect providers once per process (#4742)
e8c146d978 2026-09-21 feat(tool-cordis): inspect live plugin Config schemas (#4834)
0b7cb4102b 2026-09-19 feat(plugins): resolve installed metadata through runtime resource exports
```

以及 note 记录的实现提交来源：

```text
.agents/notes/implemented/architecture/2026-09-16-creator-persistent-plugin-management.md
.agents/notes/implemented/architecture/2026-09-21-live-config-inspect-provider.md
```

（共 469 个含 merge 的提交 —— 该数字包含大量与本篇 4 个包无关的改动，例如 client 侧生成物 `slot-catalog.ts` 与 `api-catalog.ts` 的反复再生成；上表只列语义相关提交。）

### `packages/context`

```text
ecf6acfb15 2026-09-19 feat(api): support binary fields in Remote results
```

（共 56 个含 merge 的提交；本组无新增/删除包，改动集中于 `session-reference` 的双字段标签与 `time-context` 的小幅调整，未在 `git log` 的输出中形成独立标题性提交。）

### 复核命令（读者可自行重放本篇所有数字）

```powershell
# 量化基线
git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/boot
git diff --stat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/boot
git diff --name-status --diff-filter=A dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/boot
git log --oneline dsh-v0.1.6-alpha.1..dsh-v0.1.7-rc.1 -- packages/boot

# 六个包组的合计
git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- `
  packages/boot packages/preset packages/bundle packages/host packages/context packages/extensions

# 符号删除/重命名
git grep -n "ProfileResolutionGeneration|ProfileResolutionMode|ProfileResolutionBehavior" HEAD -- packages/boot

# HMR 是否仍含模块替换（config-only HMR 未实现的证据）
Select-String -Path packages/boot/hmr/src/index.ts -Pattern "hmr/change|hmr/reload|getLinked"
Get-Content .agents/notes/proposed/simplification/2026-09-19-config-only-hmr.md -TotalCount 4

# 默认工作区落在哪（越界证据）
git grep -ln "defaultWorkspace|prepareDefault" HEAD -- packages apps
```
