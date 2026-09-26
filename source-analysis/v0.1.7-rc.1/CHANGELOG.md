# DSH v0.1.6-alpha.1 → v0.1.7-rc.1 变更说明（更新要点）

> **数据源**: `deepseek-ai/deepseek-harness` 官方仓库
> **标签对比**: `dsh-v0.1.6-alpha.1` (`0a15e36e7f`) → `dsh-v0.1.7-rc.1` (`46a7f68b0922371ce7144b668b90e377d8e799f4`)
> **发布日期**: 2026-09-23 ｜ **发布提交**: `a60af51e80 release(dsh): 0.1.7-rc.1`
> **发布 PR**: [#5073](https://github.com/deepseek-ai/deepseek-harness/pull/5073) `rel/dsh-0.1.7-rc.1`
> **性质**: 常规开发主干的一个完整发布窗口（非 backport），中间经过 `0.1.6-alpha.2` → `0.1.7-alpha.1` → `0.1.7-alpha.2`
> **统计**: 2504 commits（含 843 个 merge）｜ 6083 files changed, 475425 insertions(+), 133742 deletions(-)
> **结构变化**: `packages/` 顶层分组 52 → 54（新增 `deliverables`、`document`，无移除）；`package.json` 数量 315 → 344
> **会话格式**: `SESSION_FORMAT_VERSION` **3 → 4**（`packages/core/session/src/types.ts:89`）——本版最重的持久化跃迁

---

## 一句话总结

0.1.7-rc.1 是 **插件契约换代 + 交付物成为一等能力族 + 文档升格为契约体系** 的一次发布：

- **插件清单契约换代**：`dsh.bundle.patch` 接受有序文件列表；`dsh.profile.patchReload` 被移除；**`@deepseek-ai/dsh*` 的 `peerDependencies` 范围**开始被安装期与启动期强制校验（**`engines.dsh` 仍不被读取**），并提供精确版本豁免；
- **设置机制换代**：全局 `$DSH_HOME/settings.yaml` 被移除，设置改为 **profile 自有的 Cordis Config 易失字段**（`.volatile()`）；插件的 `installSection` 席位 API **整个消失**，替换为 `settings.configure({ auto }, fiber)`；
- **会话格式跃迁到 V4**：tool role 结果成为一等消息、生产者自有 source 取代插件包装器、新增 `developer/message` 事件、`turn/end.reason` 新增 `forked`；
- **两个全新顶层能力族**：`packages/deliverables`（`tool-present`、`workspace-changes`）与 `packages/document`（`office-to-pdf`）；
- **实验面新增语音输入族**（5 个包，SenseVoice 提供者）；
- **文档体系升格**：官方 `docs/` 新增 5 篇子系统文档与 `persistence-changes/historical-formats/` 体系，英文 md 167 → 176，三语（en / zh / `.i18n.yaml`）同步为硬门禁。

---

## 版本序列定位

```
dsh-v0.1.6-alpha.1  ← 上版（0a15e36e7f，2026-09-15）
    │
    │  ←─ 本次变更（2504 commits，843 个 merge）
    │      ├── dsh-v0.1.6-alpha.2   (887 commits)
    │      ├── dsh-v0.1.7-alpha.1   (1299 commits)
    │      ├── dsh-v0.1.7-alpha.2   (162 commits)
    │      └── dsh-v0.1.7-rc.1      (156 commits)
    ▼
dsh-v0.1.7-rc.1     ← 当前版（46a7f68b09，2026-09-23）
```

分段提交量（`git rev-list --count <from>..<to>` 实测）：

| 区间 | commits |
|---|---|
| `0.1.5-rc.2` → `0.1.5-rc.3` | 3 |
| `0.1.5-rc.3` → `0.1.6-alpha.1` | 800 |
| `0.1.6-alpha.1` → `0.1.6-alpha.2` | 887 |
| `0.1.6-alpha.2` → `0.1.7-alpha.1` | 1299 |
| `0.1.7-alpha.1` → `0.1.7-alpha.2` | 162 |
| `0.1.7-alpha.2` → `0.1.7-rc.1` | 156 |
| `0.1.7-rc.1` → `0.1.7-rc.2` | 346（本版之后，未纳入本文） |

发布链末端：

```
46a7f68b09 Merge pull request #5073 …/rel/dsh-0.1.7-rc.1   ← 本 tag
a60af51e80 release(dsh): 0.1.7-rc.1                        ← 版本提交（353 个 package.json 版本号 +1）
```

区间内共有 5 个 `release(dsh)` 版本提交（`git log --grep='release(dsh)'`）：`0.1.6-alpha.2`、`0.1.7-alpha.1`、`0.1.7-alpha.2`、`0.1.7-rc.1`（另一条 `0.1.6-alpha.1.20260916.1` 为 .1 补丁序列）。

---

## 变更总览

| # | 类别 | 变更 | 影响面 |
|---|------|------|--------|
| 1 | 持久化 | `SESSION_FORMAT_VERSION` 3 → 4：tool role 结果一等化 | 🔴 **旧版拒载新格式，不可回退** |
| 2 | 持久化 | 生产者自有 source 取代已发布插件包装器 | 🔴 依赖 source 字段的插件需迁移 |
| 3 | 持久化 | 新增 `developer/message` 事件（绑定历史 request/header） | 🟡 新事件类型，无 shipped profile 发出 |
| 4 | 持久化 | `turn/end.reason` 新增 `forked` | 🟢 增量 |
| 5 | 插件契约 | `dsh.bundle.patch` 接受 `string \| string[]`（有序文件列表） | 🟢 增量，PR #4722 |
| 6 | 插件契约 | `dsh.profile.patchReload` **移除**，改由 YAML 内 `dsh-hmr` 行控制 | 🔴 自行写 profile 清单者需改 |
| 7 | 插件契约 | **`@deepseek-ai/dsh*` 的 `peerDependencies` 范围**在安装期/启动期强制校验（**`engines.dsh` 仍不被读取**） | 🔴 peer 范围写错将在安装或启动被拒 |
| 8 | 插件契约 | 新增版本豁免：`version-exemptions` / `allow-version` / `revoke-version` | 🟡 逃生通道 |
| 9 | 插件契约 | `DshManifest` 公开面再收窄：内部字段移出公开类型 | 🟡 类型改名 |
| 10 | 插件契约 | 新增 `DshPackageManifest` / `DshEnginesManifest` / `LocalizedText` / `PluginLocalizedMeta` | 🟡 新公开类型 |
| 11 | 插件契约 | 插件自有本地化显示元数据（`locale/<lang>.json` 的 `meta`） | 🟢 新能力 |
| 12 | 设置 | `$DSH_HOME/settings.yaml` **移除**，一次性导入为 `settings.yaml.imported` | 🔴 **配置文件消失** |
| 13 | 设置 | `settings.installSection()` **移除**，替换为 `configure({ auto }, fiber)` | 🔴 **插件席位 API 换代** |
| 14 | 设置 | 可热改字段改用 Config `.volatile()` 声明 | 🔴 插件需声明才有表单 |
| 15 | 启动/HMR | HMR 包改名 `@deepseek-ai/cordis-plugin-hmr` → `@deepseek-ai/dsh-hmr` | 🔴 引用旧名即加载失败 |
| 16 | 启动/HMR | HMR 由 profile `patchReload` 开关改为 YAML 行开关 | 🔴 行为归属变化 |
| 17 | 启动 | 新增 `--dump-config-schema`（导出 entry/patch 的 JSON Schema） | 🟢 新诊断能力 |
| 18 | 启动 | Plugin Manager 进入 `dsh-base`，CLI 与 Desktop 共享 profile 写锁 | 🟡 组合变化 |
| 19 | 客户端 | 客户端模块 rev 改为 mtime/ctime/size 派生（跨 Host 重启稳定） | 🟡 缓存语义变化 |
| 20 | 客户端 | combo source map 改为首次 `GET` 惰性读取并缓存 | 🟢 内部 |
| 21 | 新能力族 | `packages/deliverables`：`workspace-changes`（**全新**）+ `tool-present`（**从 `packages/fs` 搬迁**） | 🟢 新增 |
| 22 | 新能力族 | `packages/document`：`office-to-pdf` | 🟢 新增 |
| 23 | 新能力族 | 语音输入族 5 包（experimental，SenseVoice） | 🟡 实验面 |
| 24 | 能力缝 | 新增 `ctx.officeToPdf` / `ctx.speechToText` / `ctx.workspaceChanges` / `ctx.pluginManager` / `ctx.configEditor` / `ctx.productTelemetry` / `ctx.profileContext` / `ctx.connection` / `ctx.deepseekAccount` 等缝 | 🟢 扩展面 |
| 25 | 文档 | `docs/` 新增 5 篇子系统文档 + `historical-formats/` 体系 | 🟢 新增体系 |
| 26 | 治理 | 持久化 schema 评审流程、release ranges、no-unknown-casts 等纪律 | 🟢 工程纪律 |

---

## 一、持久化：会话格式 V4（本版最重）

`SESSION_FORMAT_VERSION` 从 `3` 升到 `4`，声明文件为 `docs/persistence-changes/2026-09-16-session-format-v4.md`（含 `schemaVersion: 1` 的机器可读 YAML 声明，逐 root 列出变更前后指纹）。

### 1.1 十四个 root 的变更清单

声明中 `decision: version-bump` 的 root 共 14 项，其中**一项是全新事件**（`previous: null`）：

| root | previous | 说明 |
|---|---|---|
| `SessionHeader` | `2026-09-11-initial` | 版本号 3 → 4 |
| `event:agent/inbox/spliced` | `2026-09-14-image-offload` | 内嵌共享 `Message`/`ContentBlock` |
| `event:assistant/attempt` | `2026-09-14-image-offload` | 同上 |
| `event:assistant/message` | `2026-09-14-image-offload` | 同上 |
| `event:compaction/summary` | `2026-09-14-image-offload` | 同上 |
| **`event:developer/message`** | **`null`** | **本版新增事件** |
| `event:request/header` | `2026-09-11-initial` | 同时把退役 `system` 键记为禁止 |
| `event:session/title-llm-request` | `2026-09-14-image-offload` | 内嵌共享声明 |
| `event:system/message` | `2026-09-14-image-offload` | 内嵌共享声明 |
| `event:team/message/queued` | `2026-09-14-image-offload` | 内嵌共享声明 |
| `event:tool/ptc-dispatch` | `2026-09-14-image-offload` | 内嵌共享声明 |
| `event:tool/result` | `2026-09-14-image-offload` | 内嵌共享声明 |
| `event:turn/end` | `2026-09-14-image-offload` | 新增 `forked` reason |
| `event:user/message` | `2026-09-14-image-offload` | 内嵌共享声明 |

官方给出的解释是：**tool-role 声明变更会连带影响十个事件 root**，因为 inbox 条目、消息事件、compaction 摘要、标题请求、团队消息与 PTC 派发都内嵌了共享的 `Message` / `ContentBlock` 声明——从该联合中移除 `tool-result` 并特化消息角色，会改变这些可达 schema，但并未新增十套独立事件协议。

### 1.2 四项语义变更

1. **tool role 结果一等化**：`tool-result` 从 content-block 联合中移除；工具结果携带**必需的 `toolCallId`** 与**可选的 `isError`**，成为 tool-role 消息。V3→V4 迁移把已发布的 user-role 工具结果提升为 tool-role 消息；迁移保留每一条被接纳的 source 事件与继承的 cut。
2. **生产者自有 source**：取代已发布的插件包装器。V3→V4 边持有**冻结的重命名表与冲突规则**，保留 source 字段与事件坐标；未知生产者归因保留其自有 JSON 属性。PTC 生产者写 `source.kind: 'ptc-mode'`，迁移边保留 `tools-code-mode` 与 `tools-ptc` 作为历史插件查找键并映射到该当前 kind。
3. **`developer/message` 新事件**：保留原 role 且要求一个未关闭的 step。每次 addition 存储 `toolName`；`developer/message.headerSeq` 指向**更早的、恰好含一份完整匹配 `ToolSchema` 的已知 `request/header`**。仅移除型与其它 developer 消息省略 `headerSeq`。原生与 Session 接纳会拒绝缺失/前向/非 header/未知 header/歧义/不完整定义/退役内联定义等形态。**官方明确：当前无任何 shipped profile 发出 developer 记录**，provider 序列化、自动发出与 UI 支持均仍延后。
4. **`turn/end.reason` 新增 `forked`**：精确 cut 的 fork 在继承标记之后追加子代理自有 error 结果与收尾；V4 接纳带确定性分支专用 ID 与措辞的 checked not-started fork 结果。

### 1.3 迁移与代际规则

- 迁移包：`packages/session/session-format-v3-to-v4/`（**本版新增**；0.1.5-rc.2 时只存在 v0→v1、v1→v2、v2→v3）。
- 代际原则不变（继承 0.1.6 的已发布格式迁移决策）：只允许**新增版本命名的后继文件**，绝不重命名/覆盖/删除已提交代际；前代不蕴含回退或降级支持。
- **读 open** 在内存中准备结果、不发布后继；**写 open** 先编码、校验，再把当前版本的命名后继**独占发布**在未改动的前代文件旁。
- V3 reader **拒绝**更新的代际。
- 历史 body 恢复需要**显式的子证据集**（无子可用时也要给空集）；缺失/多重/未知版本的子描述符跳过该子回填；身份、时间戳或模式冲突则**拒绝迁移且不发布**。
- 交付代际检查防止历史 acknowledgement 变成活动的 V4 watermark。

### 1.4 版本状态：writer 已 V4，但"已发布格式"记录仍是 V3

`docs/session-format-status.md`（本版新增 `latestFinalizedVersion: 4` 与 `latestReleasedVersion: 3, evidenceTag: dsh-v0.1.5-alpha.1` 两个机器可读块）：

```yaml session-format-finalization
latestFinalizedVersion: 4
```
```yaml session-format-release
latestReleasedVersion: 3
evidenceTag: dsh-v0.1.5-alpha.1
```

含义（官方原文要点）：**V4 已有被接受的兼容基线**（检查点 `docs/persistence-changes/finalized/v4.json`），但**发布记录仍指向 V3**；文末要求"在把更高版本判定为未发布之前，先确认没有任何已发布版本推进过该记录"。文档同时声明：alpha / beta / rc 级产品发布**即已建立已发布会话格式义务**，GitHub 的 prerelease 标记**不会**让持久化用户数据变得可丢弃。

> **运营含义**：从 `0.1.5-rc.2`（writer V3）升级到 `0.1.7-rc.1`（writer V4）会触发 **V3 → V4 就地迁移**——打开即迁移，写出 `session.v4.jsonl` 后继，前代保留且不再被写入。降级回 V3 writer **不受支持**。

---

## 二、插件契约换代（本篇对插件作者最要紧）

### 2.1 `dsh.bundle.patch` 接受有序文件列表

提交 `654caa4bbd feat(bundle): accept an ordered patch file list in dsh.bundle.patch (#4722)`。

类型变化（`packages/util/package-manifest/src/types.ts`）：

```ts
// 0.1.6-alpha.1
export interface DshBundleManifest {
  /** Patch file path relative to the declaring package root. */
  patch: string
}

// 0.1.7-rc.1
export interface DshBundleManifest {
  /** One patch file path, or an ordered list applied in sequence, each relative to the declaring package root. */
  patch: string | string[]
}
```

官方 `docs/user/develop/basic/publish.md` 新增说明：`patch` 也接受有序文件列表，例如 `["./base.patch.yml", "./web.patch.yml"]`；启动器按该顺序把它们作为**一个层**应用，每个文件的相对插件路径**在该文件旁解析**。

### 2.2 `dsh.profile.patchReload` 被移除

| 项 | 0.1.6-alpha.1 | 0.1.7-rc.1 |
|---|---|---|
| `DshProfileManifest.patchReload` | 存在（`'live' \| 'startup'`） | **不存在** |
| `ProfilePatchReload` 类型 | 存在 | **已删除** |
| `apps/cli/README.md` 是否提及 | 是 | 否 |

`apps/cli/README.md` 的新表述（diff 实测）：profile 目录包含 `package.json`（树外插件依赖 + `dsh.profile` 的 `bundles` 有序列表）与 `cordis.patch.yml`；**`dsh-hmr` 在 YAML 中启用时才监视 profile 清单、profile 补丁与 home 补丁**，再通过**一次串行化 reload** 重组所有层；无 HMR 时改动在重启后生效。

`docs/architecture.md` 同步给出默认值：base 启用 config-only `dsh-hmr`；headless、SDK、ACP **禁用**；`sdk-minimal` 完全省略；profile 补丁可覆盖这些默认值。

### 2.3 DSH peer 范围开始强制校验（**注意：不是 `engines.dsh`**）

`apps/cli/README.md` 新增（diff 实测）：

> Installation and profile startup enforce declared **DSH peer ranges** against the same runtime version shown by `dsh --version`. Incompatible plugins require an explicitly acknowledged exact-version exemption.

**关键辨析**：这里的 "DSH peer ranges" 指 **`peerDependencies` 中 `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` 的范围**，**不是** `engines.dsh`。逐行读源码可确认（`packages/boot/app-boot/src/plugin-compatibility.ts:61-88`）：

| 行 | 事实 |
|---|---|
| `:68` | **无 `peerDependencies` 字段 → 直接判定兼容**（早退），根本不看 `engines` |
| `:69` | 只解析 `peerDependencies` 对象 |
| `:75` | 只取名字为 `@deepseek-ai/dsh` 或以 `@deepseek-ai/dsh-` 开头的条目 |
| `:76` | `workspace:^` / `workspace:~` / `workspace:*` 三种协议被解释为**当前运行时版本** |
| `:77` | 用 `semver.satisfies(runtime, requirement, { includePrerelease: true })`——**预发布版本参与匹配**；空范围或不满足即记为不兼容 |
| `:84-87` | 豁免键为 `name@version` → **精确运行时版本数组**（即插件版本与运行时版本**双钉**） |
| 全文 | **`engines.dsh` 一次都没有被读取** |

因此 `DshEnginesManifest` 的 JSDoc 措辞（"Runtime requirements; DSH compatibility is declarative **until a reader enforces it**"）在本版**依然成立**——该 reader 尚未出现。**官方原文亦直证这一点**：

- `packages/boot/app-boot/README.md:52`：`Before a profile imports a plugin, DSH checks its \`peerDependencies\` on \`@deepseek-ai/dsh\` and \`@deepseek-ai/dsh-*\`…`（明说是 peer 声明，不是 engines）
- `packages/util/package-manifest/README.md:93`：`**Compatibility is declarative.** Current installers and loaders do not enforce \`dsh.manifestVersion\` or \`engines.dsh\`…`

运维实践上应当把兼容性声明写在 **`peerDependencies`**，而不是 `engines.dsh`。

`:77` 的 `includePrerelease: true` 还有一个副作用值得注意：本次校验**显式接纳预发布版本**，因此形如 `>=0.1.5-rc.2 <0.2.0` 的范围在本校验路径下**能**匹配 `0.1.7-rc.1`（strict semver 默认行为则不能）。但其它解析路径（例如 pnpm 自身的 peer 解析）不一定同样宽松，所以 `-0` 上界后缀技巧仍有其适用面，见 `plugin-framework/distribution-strategy.md` §六。

`packages/boot/plugin-manager/README.md` 的 `### Version compatibility and exemptions` 小节给出精确命令与错误形态：

- `dsh plugin --profile <profile> version-exemptions`
- `dsh plugin --profile <profile> allow-version <package@version> --dsh-version <runtime> --accept-risk`
- `dsh plugin --profile <profile> revoke-version <package@version> --dsh-version <runtime>`
- 授予豁免前会**打印风险警告**再保存。
- 兼容性拒绝携带 `incompatible-version` 代码，并逐包给出 `name`、`version`、`runtimeVersion` 与未满足的 `peers`；每个界面各自渲染该记录。Web 页面走自己的 locale 字典措辞；**CLI 拒绝会打印确切的 `allow-version` 命令**。
- 源码侧另有可复核细节（来自第 01 篇的独立核实）：准入发生在 `prepareProfilePatches` / `prepareProfileEntries`，被拒行的 `disabled=true`（group 同时 `group=false`）；**原生 Include 若抵达被拒插件则整条被拒**；豁免持久化在 `profiles/<name>/compatibility.json`，畸形文件 → `rewritable:false` 只读但不阻止启动。

### 2.4 清单公开面收窄 + 新公开类型

`packages/util/package-manifest/src/types.ts` 在区间内从 104 行重写为 94 行，公开面变化：

| 变化 | 内容 |
|---|---|
| **移出公开类型** | `DshConfigTreeDeclaration`（`configTrees`）、`DshSessionFormatMigrationManifest`（`sessionFormatMigration`）、`DshModuleFallbackManifest`（`moduleFallback`）三者从 `DshManifest` 与文件中消失 |
| **新增** | `DshPackageManifest`（`name`/`version`/`description`/`icon`/`private`/`dependencies`/`peerDependencies`/`engines`/`dsh`） |
| **新增** | `DshEnginesManifest`（`dsh`/`node`/`npm` + 索引签名） |
| **新增** | `LocalizedText`、`PluginLocalizedMeta`（`title`/`description`/`icon`/`error`） |
| **改变** | `DshBundleManifest.patch: string` → `string \| string[]` |
| **不变** | `DshClientManifest`（`platform`/`inject`/`immediately`/`external`）四字段原样保留 |

`icon` 的硬约束（类型 JSDoc 原文）：SVG / PNG / JPEG / WebP，相对该清单所在目录，**最大 256 KiB**，且经 realpath 解析后必须仍在该目录内。

### 2.5 插件自有本地化显示元数据（新能力）

依据 `.agents/notes/implemented/architecture/2026-09-18-localized-package-metadata.md`（本版新增 note，Status: implemented）：

插件在自己的 `locale/<language>.json`（从 `locale/en.json` 起）中提供可选的 `meta.title` 与 `meta.description`：

```json
{
  "meta": {
    "title": "File Search",
    "description": "Search files in your workspace."
  }
}
```

关键契约：

| 主题 | 事实 |
|---|---|
| 资源地址 | 由**配置里的 Cordis 插件名**决定，经 Node 模块解析按 profile 与 package exports 选文件，**不评估插件代码** |
| 导出声明 | 需要 `./locale/*.json`（子路径插件为 `./<sub>/locale/*.json`） |
| JS 路径插件 | `./plugins/search.js` 这类**纯文件地址不做同级资源查找**，配置路径本身即最终标题回退 |
| 发现规则 | Host 解析 `en.json`，在同目录发现各语言文件名，用同一插件 specifier 与 parent URL 解析每个资源 |
| 回退链（title） | `meta.title` → `<plugin specifier>/package.json` 的非空 `name` → 完整配置 Cordis 插件名 |
| 回退链（description） | `meta.description` → 同级 package.json 的非空 `description` → 无描述 |
| 错误语义 | 缺资源/缺字段走回退；**非法 locale 字段或畸形文件报诊断而非静默回退**，且插件仍可管理 |
| 禁用插件 | 无需激活即可读取（这是该设计的核心动机之一） |
| 缓存 | **按请求读取，无元数据缓存** |

动机（note 的 Problem 段）：一个 npm 包可以导出多个用途不同的插件，包级介绍无法分别描述；且"仅在激活时注册介绍"会让**被禁用或加载失败的插件没有显示文本**。

### 2.6 Profile 解析查找序（新权威规则）

`docs/user/develop/basic/publish.md` 在区间内新增三段（diff 实测，+7/-1），确立 peer 与软链的查找语义：

- 软链检出的包**保留自己的 `node_modules`**。插件必须与宿主共享实例的 dsh 包，要**同时**声明在 `peerDependencies` 与 `devDependencies`——peer 供运行中的 dsh 解析使用宿主安装的副本，devDependency 供类型检查与独立测试。
- 普通软链导入遵循 **Node 祖先顺序**，检查每个目录**当前的** peer 声明；**更近的物理包先于更高的 peer 声明胜出**。
- 软链目标**可以没有 `package.json`**；祖先 peer 仍然生效，即使该清单旁没有物理 `node_modules`。
- 显式 `require.resolve(..., { paths })` **永远是原生行为**，包括 profile 内部路径。
- 这些规则由 npm、Desktop 与源码启动**共享**；它们**不会**使已加载模块失效，也**不校验 peer 版本范围**。
- 链接一个宽泛检出**不会**把 peer 拦截应用到运行安装自身的包目录；目标留在 profile 内（含 pnpm store）的链接仍属 profile 自有安装内容，而非外部软链根。

设计依据 note：`.agents/notes/implemented/architecture/2026-09-19-profile-resolution-lookup-order.md`。

### 2.7 新诊断：`--dump-config-schema`

`apps/cli/README.md` 新增：`--dump-config-schema` **导入组合树声明的插件 schema**，打印 entry 与 patch 的 JSON Schema（而非配置值）；官方提示在检查不可信插件前先读 [schema-dump safety and scope](https://github.com/deepseek-ai/deepseek-harness/blob/main/apps/cli/reference/README.md#config-schema-dump)。

依据 note：`.agents/notes/implemented/feature/2026-09-20-config-schema-dump-validation-policy.md`。

### 2.8 HMR 包改名

`docs/user/develop/framework/index.md`（区间 diff，1 行改动）：

```
-With `@deepseek-ai/cordis-plugin-hmr` loaded from `cordis.yml`, …
+With `@deepseek-ai/dsh-hmr` loaded from `cordis.yml`, …
```

相关提交：`d06e6b5519 feat: coordinate profile management through dsh-hmr`。**任何在 `cordis.yml` 里引用旧包名的插件/组合都会加载失败。**

---

## 三、设置机制换代（插件席位 API 消失）

依据 `.agents/notes/implemented/architecture/2026-09-19-profile-owned-live-configuration.md`（本版新增，Status: implemented）与 `packages/settings/settings/README.md`。

### 3.1 三条硬事实

| 项 | 证据 |
|---|---|
| `settings.installSection` **整个消失** | `git grep -c installSection <tag> -- packages`：`0.1.5-rc.2` = 15 处、`0.1.6-alpha.1` = 15 处、**`0.1.7-rc.1` = 0 处** |
| 新 API 为 `settings.configure(presentation, owner)` | `packages/settings/settings/src/index.ts:266` |
| `$DSH_HOME/settings.yaml` 被移除 | note 原文："The removed `$DSH_HOME/settings.yaml` is imported once into the active profile…"；包 README 同述 |

### 3.2 新设置契约

`packages/settings/settings/README.md` 的 Summary 原文（要点）：**通过 Config 派生的表单检查并编辑插件声明的 `.volatile()` 字段**；表单按 **profile entry id** 标识每个插件，保留 secret 值，拒绝陈旧写入；变更经**活动 profile 的 Cordis 补丁**持久化。

服务方法签名（`packages/settings/settings/src/index.ts:266`）：

```ts
configure(presentation: { auto?: boolean }, owner: Fiber = this.ctx.fiber): () => void
```

行为要点：同一 fiber **重复配置直接抛错**——`throw new Error('Settings presentation is already configured for this plugin instance')`（同文件 `:268`）。返回 disposer。

**自带设置页的插件的标准写法**（官方源码中的一致模式，例如 `packages/client/ui-theme/src/index.ts:40`、`packages/core/agent-default-model/src/index.ts:58`）：

```ts
ctx.inject(['settings'], (child) => {
  child.effect(() => child.settings.configure({ auto: false }, ctx.fiber))
})
```

语义：`auto` 默认 true，表示客户端按 schema 自动生成页面（包 README 注明"no shipped client does so yet"）；`auto: false` 表示**插件自带页面**，注册动作必须作为 effect 放在 `apply` 内的**可选 `ctx.inject(['settings'], …)` 子上下文**中。该子上下文命名了策略所属的插件 fiber，因此**晚加载或被替换的 Settings 服务能拾取该策略**，而业务插件在没有 Settings 时照常运行；该策略不移除配置读写。

### 3.3 `.volatile()` 是本版全新机制

`git grep -c '\.volatile(' <tag> -- packages`：**`0.1.6-alpha.1` = 0 处**（完全不存在），`0.1.7-rc.1` 广泛使用，例如：

| 包 | 文件 | `.volatile(` 出现次数 |
|---|---|---|
| `llm/llm-deepseek` | `src/config.ts` | 19 |
| `boot/app-boot` | `tests/schemastery-json-schema.spec.ts` | 8 |
| `core/agent-default-model` | `src/index.ts` | 3 |
| `client/ui-chat` | `src/index.ts` | 3 |
| `settings/settings` | `tests/configuration.spec.ts` | 6 |
| `experimental/speech-to-text` | `src/index.ts` | 2 |
| `preset/agent-preset-registry` | `src/index.ts` | 2 |
| `client/ui-theme` | `src/index.ts` | 2 |
| `interaction/permission-presets`、`core/agent-loop`、`client/locale`、`client/ui-conversation`、`client/ui-settings-general`、`client/ui-settings`、`llm/llm-pi-ai` 等 | — | 各 1 |

**设置表单只暴露 `.volatile()` 字段**；未声明的普通配置仍只能通过 Cordis 配置文件编辑。

### 3.4 `settings.yaml` 的一次性导入

note 与包 README 给出一致的导入规则：在 Settings 启动后 **Loader 已 settle 每个 entry** 时执行一次；section id 即 entry id，并含三条映射——`ui-developer-tools` → `ui-settings`、`ui-onboarding` → `ui-settings-general`、`shell` → 该平台的 shell executor entry；文件在**首次写入前**改名为 `settings.yaml.imported`，因此导入**永不重复**；被运行组合拒绝的 section 记日志并只留在改名后的文件里。端到端覆盖见 `apps/web/tests/settings-import.e2e.ts`。

### 3.5 写覆盖语义（易踩的坑）

note 明确列出：Cordis config patch **替换整条 entry 的 config**。编辑会保留普通字段与未编辑的 secret（含原始配置表达式）；字段级 reset 恢复当前继承值；整条 entry reset 则移除 config 覆盖以便继承后续 bundle 变更。**但其它编辑会把 entry 的完整 config 存进 profile 行**——写时组合出的普通字段**加上每一个 volatile 字段**；此后 bundle 对这些字段的改**动不会到达该 profile**，除非移除该 entry 的 config 覆盖。

官方在 shipped bundles 中列举了四个会被"钉住"的实例：默认预设变更后的 `permission.presets`、预设选择后的 `agent-presets`、并行度编辑后的 `agent-loop.agents`、Web Search 编辑后的 `web-search-deepseek.apiKeyEnv`。且**客户端会把该行的每一个 volatile 字段都标记为已覆盖，而不只是被编辑的那个**。

官方明确这是当前实现的限制，而非疏忽："Narrowing a write to the edited fields needs merge semantics for patch `config`, which Include does not provide."

---

## 四、新增能力族

### 4.1 `packages/deliverables`（全新顶层包组；**但 `tool-present` 是搬家不是新写**）

`git ls-tree -d --name-only dsh-v0.1.6-alpha.1:packages` 中不存在 `deliverables`，本版新增该组，含两个包：

| 包 | 服务 | 本版性质 |
|---|---|---|
| `deliverables/tool-present` | — | ⚠️ **搬迁**：0.1.6 已在 `packages/fs/tool-present/`，本版由 `f800ea46e5` 做 `{fs => deliverables}/tool-present/` 重命名。四个文件（README / README.zh / `src/index.ts` / `src/types.ts`）**内容零改动**，仅 `package.json` 2 行（`repository.directory`） |
| `deliverables/workspace-changes` | `ctx.workspaceChanges`（"Host per-turn changed-file summaries"） | ✅ **本版真正全新** |

两条必须辨析的结论：

1. **`deliverables/presented` 事件不是本版新增的持久化根**——`tool-present/src/types.ts` 与 0.1.6 **逐字节相同**，该事件的 digest（`13d3d180…`）未变。该包本版唯一的语义改动是**工具描述重写**（+5/−4）。持久化目录 `docs/persistence-catalog.md` 在 0.1.6 已含该根。
2. **真正全新的持久化根是 `workspace/changes`**（由 `workspace-changes` 包引入），其声明文件 `docs/persistence-changes/2026-09-14-workspace-changes-event.md` 记 `decision: same-version`、digest `e308ccf8…`、`surface: false`。**注意**：`SESSION_FORMAT_VERSION` 3→4 是由 `2026-09-16-session-format-v4` 驱动的**另一项**变更，与 `workspace/changes` 无关——不要混为一谈。

官方新增子系统文档 `docs/subsystems/deliverables.md`（本版新增，178 行）。

### 4.2 `packages/document`（全新顶层包组）

| 包 | 服务 | 官方服务描述 |
|---|---|---|
| `document/office-to-pdf` | `ctx.officeToPdf` | "Office to PDF conversion" |

官方新增子系统文档 `docs/subsystems/office-to-pdf.md`（本版新增）。

### 4.3 语音输入族（experimental，5 个新包）

`packages/experimental` 从 16 包增至 20 包。新增：`api-speech-to-text`、`speech-to-text`、`speech-to-text-sensevoice`、`client-ui-voice-input`、`voice-input-bundle`；同时**删除** `agent-team-web-profile`（8 文件 / −303）。

> **注意：这不是"改名"**。`git ls-tree dsh-v0.1.6-alpha.1 packages/experimental/` 显示 0.1.6 时 **两个包同时存在**：`agent-team-profile`（Host 层，只 insert `agent-team` + `tool-agent-team`）与 `agent-team-web-profile`（Web-only 层，只 insert `ui-agent-team`）。本版**整包删除**后者，把它唯一那行 `ui-agent-team` 并入既有的前者（同时加 icon / locale）。
>
> **遗留升级兼容缺口**（note `## Consequences` 原文要点，且其 `## Verification` 自陈测试**不覆盖**该场景）：**仍选择已删除 Web bundle 的既有 profile 会在启动时失败**（包解析不到）。bundle 组合**不提供**对已保存选择的自动改写，兼容处理被明确排除在该决策之外；官方新 README 给的手工修法是"在既有 profile 的 `package.json` 里保留 `agent-team-profile`、删掉 `agent-team-web-profile` 条目"。用户级 patch 针对 `ui-agent-team` 行的覆盖仍然生效（该行的 id 与 name 都没变，只是承载它的包变了）。

新服务缝（`docs/capability-seams.md` 生成区）：

| 服务 | 包 | 描述 |
|---|---|---|
| `ctx.speechToText` | `experimental-speech-to-text`（+ `-sensevoice` 提供者） | "Experimental speech recognition providers" |
| `ctx.speechController` | `experimental-api-speech-to-text` | "Experimental transcription Remote" |

官方新增子系统文档 `docs/subsystems/voice-input.md`（本版新增），设计依据 note `2026-09-16-experimental-voice-input.md`。

### 4.4 其他新增能力缝（`docs/capability-seams.md` 生成区）

| 服务 | 所属包 | 描述 |
|---|---|---|
| `ctx.pluginManager` | `plugin-manager` | "Current-profile plugin and bundle management" |
| `ctx.pluginRegistryProbe` | `client-ui-plugin-manager` | "Host registry response comparison" |
| `ctx.configEditor` | `config-editor` | "Profile configuration edits" |
| `ctx.hmr` | `hmr` | "Serialized module and configuration reloads" |
| `ctx.profileContext` | `app-boot` | "Launcher-owned profile data" |
| `ctx.connection` | `client-connection` | "Authenticated browser transport" |
| `ctx.productTelemetry` | `host-product-telemetry-otel` | "Product usage event sender" |
| `ctx.deepseekAccount` | `deepseek-account`（+ `-platform`） | "DeepSeek account" |
| `ctx.jobController` | `api-job-controller` | "Host job Remote controller" |
| `ctx.agentPresets` | `agent-preset-registry` | — |
| `ctx.skills` | `skill-office` | — |

### 4.5 产品遥测（新子系统文档；**未被任何 profile 挂载**）

官方新增 `docs/subsystems/product-telemetry.md`，与 `packages/host/product-telemetry-otel` 包及 `ctx.productTelemetry` 缝对应。

**关键的组合层事实**（经独立核实）：该包**不被任何 shipped 组合挂载**。全树 `cordis.yml` / `cordis.patch.yml`（含 `packages/bundle/{base,web-app,headless,sdk-app,sdk-minimal,acp-app}/cordis.patch.yml`、`apps/cli/**`）**无一处引用** `@deepseek-ai/dsh-host-product-telemetry-otel`；`docs/capability-seams.md:606` 该行的 Implementations / Direct consumers / Companion plugins **三列全为 `-`**。即：它本版以"**可加载但未被组合**"的形态发布——结构性默认不发，需操作者用 profile patch 显式加行才存在。

**不要与 Session 遥测混淆**：`session-telemetry-otel` **确实挂载**于 `packages/bundle/base/cordis.patch.yml:204-210`，出厂默认 `mode: !!js process.env.DSH_TELEMETRY_MODE || 'FEEDBACK_ONLY'`，默认 endpoint `https://harness-telemetry.deepseeksvc.com/v1/logs`。同文件 `:187-199` 另有两条事实：`DSH_TELEMETRY_DISABLED` 的**任何非空值（含 `'0'` / `'false'`）即退出**，且 **config 无法禁用一行，只有启动器能 patch 成 disabled**；导出携带 `$DSH_HOME/.anonymous-user-id`（随机 UUID，删文件即重置）作为 Resource `user.id`。两者的"默认"**不在同一层，不可互相类推**。

---

## 五、客户端与桌面

### 5.1 客户端模块 rev 语义变化

官方 `docs/subsystems/client-modules.md` 在区间内改动 +22/-15，两处关键变更：

1. **rev 派生方式**：由"内容寻址（哈希插件脚本字节 + 源码映射）"改为**由 entry 的 mtime、ctime 与 size 派生**，**不哈希可执行字节**。官方明示其收益："The same artifacts retain their revisions across Host restarts."
2. **源码映射惰性化**：启动、index 渲染、脚本 `GET`、`HEAD` **都不再读取 map 文件**；**首次 map `GET`** 才读取并校验、组装一份 Indexed Source Map v3 并缓存该响应体；map 体**由首次 `GET` 固定**。
3. `ClientArtifactBaseline` 新增字段 `ctimeMs`（"Bundle status-change time in milliseconds, including writes that preserve mtime"）。
4. `WebBootEntry.url` 明确为**文档相对**（"relative to the document, so the browser resolves it under whatever mount served the page"）。
5. `ClientModuleRegistry` 新增 `fetchBundle()`（"resolves the same lazy response used by the HTTP route"）；`rebuilt(id)` 先由文件系统元数据派生 revision，**只有 revision 变化才读新字节**并重组图。

### 5.2 GUI 侧主要增量（依据新增 note 清单）

| 主题 | note（`.agents/notes/implemented/feature/`） |
|---|---|
| 侧栏工作区层级 | `2026-09-15-sidebar-workspace-hierarchy.md` |
| 侧栏浏览器 | `2026-09-16-sidebar-browser.md` |
| 侧栏文件/目录自动刷新 | `2026-09-17-sidebar-file-and-directory-auto-refresh.md` |
| 侧栏保留标签布局 | `2026-09-20-sidebar-retained-tab-layout.md` |
| 会话钉住与侧栏归档 | `2026-09-18-session-pin-and-sidebar-archive.md` |
| 状态点视觉语言 | `2026-09-17-state-dot-visual-language.md` |
| 紧凑半透明菜单面 | `2026-09-17-compact-translucent-menu-surfaces.md` |
| Windows 桌面标题栏 | `2026-09-16-windows-desktop-titlebar.md` |
| macOS 隐藏标题栏与 vibrancy | `2026-09-13-macos-hidden-titlebar-vibrancy.md` |
| 桌面浏览器 webview | `2026-09-20-desktop-browser-webview.md` |
| 桌面主运行时 | `2026-09-14-desktop-primary-runtime.md` |

（各条的实现细节见第 10 篇；此处仅列本版新增的决定记录，均需 `--diff-filter=A` 判定为新增。）

### 5.3 桌面端部署形态（`docs/architecture.md` 新增段落）

官方新增的 Desktop 段落确立：Electron 应用在**签名资源**中携带**精确的 dsh 生产运行时**，独占保留的 `$DSH_HOME/profiles/desktop`；共享 profile 助手初始化其文件、协调已装 bundle、解析安装与 bundle 依赖，**不替换 pnpm 拥有的包**；CLI 与 Desktop 共享产品数据，但可执行包、激活选择与锁文件各自独立；**公共 CLI 不能管理 Desktop 的 profile**。Host 以 Electron Node 模式启动，Node IPC 承载 boot 注入、就绪、致命错误与关闭；Desktop 默认端口 **19387**。

同时新增"应用启动"段落，确立**只有 `dsh` profile 能启动受支持的 Node 应用**，并有 `scripts/verify-application-entrypoints.ts` 作为机器门禁（把每个 package bin、可执行源码、根 demo 与根 `start:web`/`dev:web` 脚本归入显式类别，拒绝绕过 `dsh` 的 Node 应用路径）。

---

## 六、文档体系升格

### 6.1 规模与新增页

| 指标 | 0.1.6-alpha.1 | 0.1.7-rc.1 |
|---|---|---|
| `docs/` 英文 md 总数 | 167 | **176** |
| `docs/subsystems/` 页面 | — | 60+（含下列 5 篇新增） |

区间内 **新增**（`--diff-filter=A`）的文档页：

| 文件 | 主题 |
|---|---|
| `docs/subsystems/boot.md` | 启动 |
| `docs/subsystems/deliverables.md` | 交付物 |
| `docs/subsystems/office-to-pdf.md` | Office 转 PDF |
| `docs/subsystems/product-telemetry.md` | 产品遥测 |
| `docs/subsystems/voice-input.md` | 语音输入 |
| `docs/persistence-changes/2026-09-14-workspace-changes-event.md` | 持久化变更 |
| `docs/persistence-changes/2026-09-16-session-format-v4.md` | 持久化变更（V4） |
| `docs/persistence-changes/2026-09-20-unknown-child-catalog.md` | 持久化变更 |
| `docs/persistence-changes/historical-formats/v3.md` | **历史格式：新增 V3 一族**（体系本身 0.1.6 已建，含 v0/v1/v2） |

### 6.2 三语契约与门禁

`docs/AGENTS.md` 定义了"一个事实一个家"的分层税制（Root AGENTS.md / 子树 AGENTS.md / architecture.md / subsystems / Agent Notes / postmortem / persistence history / cookbook / user / Package README / 生成参考 / Skills），并配套 `pnpm run doc-sync`、`pnpm run test:docs`、`verify-doc-budgets`、`verify-md-wrap`、`verify-md-links`、`verify-type-equiv`、`verify-client-ui-i18n` 等门禁。区间内 `docs/AGENTS.md`、`docs/i18n/terminology.md`、`docs/development.md`、`docs/testing.md` 均有改动。

### 6.3 Agent Note 纪律

区间内新增英文 note **165 篇**（`--diff-filter=A`，另有同名 `.zh.md` 与 `.i18n.yaml` 兄弟文件）：架构 62、功能 45、缺陷修复 26、精简 16、流程 13、测试 3。归档策略明确：`archived/` 为冻结历史，**永不编辑、也不作为当前权威**。

---

## 七、工程与流程纪律（区间内新增 note）

| note | 类别 | 主题 |
|---|---|---|
| `2026-09-17-persistence-schema-review.md` | process | 持久化 schema 评审流程 |
| `2026-09-22-workspace-release-ranges.md` | process | workspace 依赖版本区间（DSH 用 `workspace:*`、vendor/native 用 `workspace:~`） |
| `2026-09-23-bounded-pnpm-runs.md` | bug-fix | 受限 pnpm 执行 |
| `2026-09-19-no-unknown-casts.md` | process | 禁止新增到 `unknown` 的断言 |
| `2026-09-19-evidence-led-simplification-surveys.md` | process | 证据驱动的精简调研 |
| `2026-09-01-workflow-run-in-background.md` | feature | workflow 后台运行 |
| `2026-08-26-human-job-kill.md` | feature | 人工终止作业 |
| `2026-09-16-desktop-release-version-derivation.md` | process | 桌面发布版本派生 |
| `2026-09-21-desktop-build-version-as-input.md` | process | 桌面构建版本作为输入 |
| `2026-09-17-windows-signature-completion.md` | process | Windows 签名完成 |
| `2026-09-17-windows-runtime-signature-cache.md` | process | Windows 运行时签名缓存 |
| `2026-09-16-desktop-cos-upload-transport.md` | architecture | 桌面上传传输 |
| `2026-09-15-pr-approval-delegation.md` | process | PR 审批委派 |
| `2026-09-11-production-blame-approval-weight.md` | process | 生产归因审批权重 |
| `2026-09-16-author-approval-credit.md` | process | 作者审批记分 |

---

## 八、升级影响速查（0.1.6-alpha.1 → 0.1.7-rc.1）

| 你会遇到什么 | 原因 | 处置 |
|---|---|---|
| 插件设置页/表单一夜消失 | `installSection` 已移除 | 改用 `ctx.inject(['settings'], child => child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)))`，并把可热改字段标为 `.volatile()` |
| 插件被拒装或启动失败，代码 `incompatible-version` | `@deepseek-ai/dsh*` 的 `peerDependencies` 范围开始强制校验（**不是 `engines.dsh`**） | 修正 `peerDependencies` 范围，或用 `allow-version … --accept-risk` 显式豁免 |
| 自写 profile 清单里的 `patchReload` 无效果 | 该字段已移除 | 删掉该键，改由 YAML 内的 `dsh-hmr` 行控制热重载 |
| `cordis.yml` 里 `@deepseek-ai/cordis-plugin-hmr` 找不到 | HMR 包已改名 | 改为 `@deepseek-ai/dsh-hmr` |
| 旧会话打开后生成新文件、旧版 DSH 再也打不开 | session writer 已 V4 | 预期行为；不要期望降级（官方不支持回退） |
| `$DSH_HOME/settings.yaml` 不见了 | 设置迁入 profile | 找 `settings.yaml.imported`；新的设置值在 profile 的 `cordis.patch.yml` |
| 改了 bundle 默认值但 profile 仍是旧值 | config patch 替换整条 entry config | 移除该 entry 的 config 覆盖，或手动改 profile 行 |
| 需要多文件补丁层 | `dsh.bundle.patch` 现支持数组 | 用 `["./base.patch.yml", "./web.patch.yml"]` |

---

## 附录：可复核命令清单

```powershell
# 版本坐标
git -C E:\test\rewrite-agently\deepseek-harness rev-parse dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1
git -C E:\test\rewrite-agently\deepseek-harness rev-list --count dsh-v0.1.6-alpha.1..dsh-v0.1.7-rc.1
git -C E:\test\rewrite-agently\deepseek-harness diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1

# 包组与清单规模
git -C E:\test\rewrite-agently\deepseek-harness ls-tree -d --name-only dsh-v0.1.7-rc.1:packages
git -C E:\test\rewrite-agently\deepseek-harness ls-tree -r --name-only dsh-v0.1.7-rc.1 | Select-String 'package\.json$'

# 会话格式
git -C E:\test\rewrite-agently\deepseek-harness grep -n 'SESSION_FORMAT_VERSION = ' dsh-v0.1.7-rc.1 -- packages/core/session/src/types.ts
git -C E:\test\rewrite-agently\deepseek-harness ls-tree -d --name-only dsh-v0.1.7-rc.1:packages/session

# 席位 API 换代（预期：前两版 15 / 本版 0）
foreach ($t in @('dsh-v0.1.5-rc.2','dsh-v0.1.6-alpha.1','dsh-v0.1.7-rc.1')) {
  "$t : " + (git -C E:\test\rewrite-agently\deepseek-harness grep -c 'installSection' $t -- packages | Measure-Object).Count
}

# 插件清单契约
git -C E:\test\rewrite-agently\deepseek-harness diff dsh-v0.1.5-rc.2 dsh-v0.1.7-rc.1 -- packages/util/package-manifest/src/types.ts
git -C E:\test\rewrite-agently\deepseek-harness log --oneline dsh-v0.1.6-alpha.1..dsh-v0.1.7-rc.1 --grep='patch file list' -i

# 新增文档与 note
git -C E:\test\rewrite-agently\deepseek-harness diff --name-status --diff-filter=A dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- docs
git -C E:\test\rewrite-agently\deepseek-harness diff --name-status --diff-filter=A dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- .agents/notes
```

---

*本文档由 `deepseek-harness` 仓库 `dsh-v0.1.6-alpha.1` → `dsh-v0.1.7-rc.1` 实测差异生成。*
*跨版累积差异（`0.1.5-rc.2` → `0.1.7-rc.1`）见 [diff-vs-0.1.5-rc.2.md](diff-vs-0.1.5-rc.2.md)。*
