# v0.1.7 插件迁移深度指南

> **基线说明**：本篇为 v0.1.7-rc.1 全量分析基线，rc.2 未改动本篇覆盖的系统性结构。v0.1.7-rc.2 的增量变更（约 335 个提交）请见同目录 `README.md` 与 `diff-vs-0.1.7-rc.1.md`。

> **版本对比**: `dsh-v0.1.6-alpha.1` (`0a15e36e7f`) → `dsh-v0.1.7-rc.1` (`46a7f68b09`)
> **面向读者**: 已发布或正在维护 DSH 插件的作者、profile / preset 维护者、私有部署方
> **结论先行**: 本版**有会话格式跃迁**（`SESSION_FORMAT_VERSION` **3 → 4**），
> 且有 **4 项必须动手的插件作者面契约变更**（设置席位 API 消失、`@deepseek-ai/dsh*` peer 范围开始强制、`patchReload` 移除、HMR 包改名），
> 以及 **2 个可用作扩展点的新能力族**（`deliverables`、`document`）。
>
> **最危险的一条**：`settings.installSection()` 已从代码库中**完全消失**（0.1.5-rc.2 与 0.1.6-alpha.1 各 15 处引用，本版 **0 处**）——它没有任何兼容垫片。

---

## 变更分级速览

| 级别 | 变更 | 谁需要动手 |
|---|---|---|
| 🔴 必须 | `settings.installSection()` 移除，改用 `configure({ auto }, fiber)` | **所有带设置表单/设置页的插件** |
| 🔴 必须 | `@deepseek-ai/dsh*` 的 peer 范围开始被安装期/启动期强制校验（**`engines.dsh` 仍不校验**） | 声明了 DSH peer 依赖的插件 |
| 🔴 必须 | `dsh.profile.patchReload` 移除 | 手写 profile 清单的部署方 |
| 🔴 必须 | HMR 包改名：`@deepseek-ai/cordis-plugin-hmr` → `@deepseek-ai/dsh-hmr` | 在 YAML 中引用 HMR 行的组合 |
| 🔴 必须 | 会话格式 V3 → V4（writer 升级，旧版拒载新格式） | **所有持久化部署**（不可回退） |
| 🔴 必须 | `$DSH_HOME/settings.yaml` 移除，设置迁入 profile | 依赖该文件做配置注入的部署 |
| 🟡 建议 | 可热改字段改用 Config `.volatile()` 声明 | 希望设置页出现表单的插件 |
| 🟡 建议 | `DshManifest` 公开面再收窄（三个内部字段移出） | 引用这些类型字段的插件 |
| 🟡 注意 | 客户端模块 rev 改为 mtime/ctime/size 派生 | 依赖 rev 语义做缓存失效的插件 |
| 🟢 增量 | `dsh.bundle.patch` 接受有序文件列表 | 想拆多文件补丁层的作者 |
| 🟢 增量 | 插件自有本地化显示元数据（`locale/<lang>.json` 的 `meta`） | 想要多语言插件标题/简介的作者 |
| 🟢 增量 | `--dump-config-schema`、版本豁免三命令 | 排障与新能力 |
| 🟢 增量 | `deliverables` / `document` / 语音输入族 / 新能力缝 | 需要新能力时 |

---

## 一、设置席位 API 换代（最高优先级）

**依据**：`.agents/notes/implemented/architecture/2026-09-19-profile-owned-live-configuration.md`（本版新增，Status: implemented）、`packages/settings/settings/README.md`、`packages/settings/settings/src/index.ts`。

### 1.1 证据：旧的席位 API 已被整体删除

```powershell
foreach ($t in @('dsh-v0.1.5-rc.2','dsh-v0.1.6-alpha.1','dsh-v0.1.7-rc.1')) {
  "$t : " + (git -C <repo> grep -c 'installSection' $t -- packages | Measure-Object).Count
}
```

实测结果：

| tag | `installSection` 命中文件数 |
|---|---|
| `dsh-v0.1.5-rc.2` | 15 |
| `dsh-v0.1.6-alpha.1` | 15 |
| **`dsh-v0.1.7-rc.1`** | **0** |

0.1.6-alpha.1 中的真实调用形态（现已被删除）：

```ts
// packages/core/agent-default-model/src/index.ts:77（0.1.6-alpha.1）
settingsCtx.settings.installSection(ctx, AGENT_DEFAULT_MODEL_SETTINGS_NAMESPACE, AGENT_DEFAULT_MODEL_SETTINGS_SCHEMA, entry, { … })
// packages/llm/llm-deepseek/src/index.ts:148（0.1.6-alpha.1）
settingsCtx.settings.installSection(ctx, NS, Config, config, { … })
```

同时 `.configure(` 的命中面从 4 处增至 **24 处**。

### 1.2 新契约

服务方法（`packages/settings/settings/src/index.ts:266`）：

```ts
configure(presentation: { auto?: boolean }, owner: Fiber = this.ctx.fiber): () => void
```

- 返回 disposer；
- **同一 fiber 重复配置直接抛错**：`throw new Error('Settings presentation is already configured for this plugin instance')`（同文件 `:268`）。

**自带设置页的插件**采用下面这一模式（官方源码中的一致写法，例如 `packages/client/ui-theme/src/index.ts:40`、`packages/client/ui-settings/src/index.ts:24`、`packages/core/agent-default-model/src/index.ts:58`）：

```ts
ctx.inject(['settings'], (child) => {
  child.effect(() => child.settings.configure({ auto: false }, ctx.fiber))
})
```

语义要点（`packages/settings/settings/README.md`）：

| 项 | 事实 |
|---|---|
| `auto` 默认 | `true`——客户端按 schema 自动生成页面；包 README 注明 "no shipped client does so yet" |
| `auto: false` | 插件自带页面，注册即"认领"该插件的呈现策略 |
| 注册位置 | 必须是 `apply` 内的**可选 `ctx.inject(['settings'], …)` 子上下文**中的 effect |
| 为何用可选注入 | 该子上下文命名了策略所属的插件 fiber；因而**晚加载或被替换的 Settings 服务能拾取该策略**，而业务插件在**没有 Settings 时照常运行** |
| 边界 | 该策略**不移除配置读写**；业务插件仍直接读自己的 Config |

### 1.3 迁移动作

| 你的代码（≤0.1.6） | 迁移后（0.1.7+） |
|---|---|
| `settings.installSection(owner, ns, schema, entry, hooks)` | 删除该调用；把可热改字段改为 Config 上的 `.volatile()` 声明；需要自带页面时加 `configure({ auto: false }, fiber)` 子上下文 effect |
| 依赖 `SettingsSectionHooks` 的 `onChange` 之类的钩子 | 不再存在；消费者**在操作时读取自己的 Config 引用**（note 原文："consumers read their references during operations"） |
| 用 namespace 字符串区分设置分组 | namespace 概念消失；表单按 **profile entry id** 识别插件，同一插件的两个实例靠**不同的 profile entry id** 区分 |
| 依赖 `$DSH_HOME/settings.yaml` 注入默认值 | 该文件已移除（见 §二） |

> **注意**：旧的"一个面板一个席位 + seat-pin 契约测试"的**思路仍然成立**（`configure` 对同一 fiber 重复注册会抛错，这比 `installSection` 的静默覆盖更严格），但我方 `plugin-framework/settings-seat-pinning.md` 中记录的 API 名与失败模式**已全部过期**，须按本节改写。

---

## 二、`$DSH_HOME/settings.yaml` 移除

**依据**：同 §一 的 note 与 `packages/settings/settings/README.md`。

### 2.1 事实

- 设置的权威存储改为**活动 profile 的 Cordis 补丁**（`cordis.patch.yml`）。
- 旧文件在 Settings 启动且 **Loader 已 settle 每个 entry** 后**一次性导入**：section id 即 entry id，含三条固定映射：

| `settings.yaml` 中的 section | 导入到 |
|---|---|
| `ui-developer-tools` | `ui-settings` |
| `ui-onboarding` | `ui-settings-general` |
| `shell` | 该平台的 shell executor entry |

- 文件在**首次写入前**改名为 `settings.yaml.imported`，因此导入**永不重复**；被运行组合拒绝的 section 记日志，且**只留在改名后的文件里**。
- 端到端覆盖：`apps/web/tests/settings-import.e2e.ts`（断言原文件不存在、`.imported` 内含导入值）。

### 2.2 迁移动作

| 你的做法 | 迁移后 |
|---|---|
| 部署脚本写 `$DSH_HOME/settings.yaml` | 改为写目标 profile 的 `cordis.patch.yml`（按 entry id 定位行） |
| 期望设置在多个 profile 间共享 | **不再可能**：note 明确"persisted form values are profile-specific"；要共享偏好必须引入**显式的共享 Cordis 层**并定义写目标 |
| 依赖旧文件长期存在 | 它会被改名；不要在自动化里断言 `settings.yaml` 存在 |

---

## 三、`@deepseek-ai/dsh*` 的 peer 范围开始强制校验（**不是 `engines.dsh`**）

**依据**：`apps/cli/README.md`（区间 diff）、`packages/boot/app-boot/src/plugin-compatibility.ts:61-88`、`packages/boot/app-boot/README.md:52`、`packages/util/package-manifest/README.md:93`、`packages/boot/plugin-manager/README.md` 的 `### Version compatibility and exemptions`。

### 3.1 事实：强制对象是 `peerDependencies`，不是 `engines.dsh`

`apps/cli/README.md` 在区间内新增：

> Installation and profile startup enforce declared DSH peer ranges against the same runtime version shown by `dsh --version`. Incompatible plugins require an explicitly acknowledged exact-version exemption.

**这里有个极易读错的点**："DSH peer ranges" 指的是 **`peerDependencies` 中 `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` 的范围**，**不是** `engines.dsh`。逐行读源码即可确认（`packages/boot/app-boot/src/plugin-compatibility.ts`，函数 `evaluatePluginCompatibility`）：

| 行 | 事实 |
|---|---|
| `:68` | **无 `peerDependencies` 字段 → 直接判定兼容并返回**（早退）；根本不看 `engines` |
| `:69` | 只解析 `peerDependencies` 对象 |
| `:75` | 只取名字为 `@deepseek-ai/dsh` 或以 `@deepseek-ai/dsh-` 开头的条目，其余 peer 一律跳过 |
| `:76` | `workspace:^` / `workspace:~` / `workspace:*` 三种协议被解释为**当前运行时版本** |
| `:77` | 判定式为 `semver.satisfies(runtime, requirement, { includePrerelease: true })`；空范围或不满足即记为不兼容 |
| `:84-87` | 豁免键为 `name@version` → **精确运行时版本数组**（插件版本与运行时版本**双钉**） |
| 全文 | **`engines.dsh` 一次都没有被读取** |

**官方文档原文亦直接证实**：

- `packages/boot/app-boot/README.md:52`：`Before a profile imports a plugin, DSH checks its \`peerDependencies\` on \`@deepseek-ai/dsh\` and \`@deepseek-ai/dsh-*\`…`
- `packages/util/package-manifest/README.md:93`：`**Compatibility is declarative.** Current installers and loaders do not enforce \`dsh.manifestVersion\` or \`engines.dsh\`…`

因此结论是：**`engines.dsh` 在本版仍是纯声明，不产生任何准入效果**；要获得（或避免）这份准入校验，必须操作 `peerDependencies`。

> **`:77` 的 `includePrerelease: true` 有一个反直觉副作用**：本校验路径**显式接纳预发布版本**，所以 `>=0.1.5-rc.2 <0.2.0` 这类范围在**本校验**下**能**匹配 `0.1.7-rc.1`（strict semver 默认行为则不能）。但其它解析路径（例如 pnpm 自身的 peer 解析）未必同样宽松，故 `-0` 上界后缀技巧仍有适用面，见 `plugin-framework/distribution-strategy.md` §六。

### 3.2 拒绝的形态与豁免命令

- 兼容性拒绝携带错误码 **`incompatible-version`**；
- 逐包给出 `name`、`version`、`runtimeVersion` 与未满足的 `peers`；
- **每个界面各自渲染该记录**：Web 页面走自己的 locale 字典措辞，**CLI 拒绝会打印确切的 `allow-version` 命令**；
- 三条 CLI 命令：

```sh
dsh plugin --profile <profile> version-exemptions
dsh plugin --profile <profile> allow-version <package@version> --dsh-version <runtime> --accept-risk
dsh plugin --profile <profile> revoke-version <package@version> --dsh-version <runtime>
```

授予豁免前**打印风险警告**再保存。官方建议"用工具或 CLI 授予豁免后重试原操作"。

### 3.3 迁移动作

| 你的插件 | 迁移动作 |
|---|---|
| **没有** `@deepseek-ai/dsh*` 的 peer 依赖 | 不受该校验约束（`:68` 早退）。但若你与宿主共享单例（如 `dsh-scope`、`dsh-mcp-client`），**必须**写进 `peerDependencies` **且** `devDependencies`——这是解析正确性的要求，不只是兼容性 |
| 有 `@deepseek-ai/dsh*` peer 但范围写错 | 修正范围为能被目标 `dsh --version` 满足的形式；`workspace:*` / `^` / `~` 会被视为"当前运行时" |
| `engines.dsh` 写得很严 | **不影响准入**（不被读取）；但作为市场信号仍建议写对。真要表达兼容性约束，请落在 `peerDependencies` |
| 确实需要跨版本强制安装 | 用 `allow-version … --accept-risk`，并接受官方提示的风险（**精确版本豁免**：插件版本与运行时版本都要精确匹配，不是范围豁免） |
| 需要撤销 | `revoke-version <package@version> --dsh-version <runtime>` |

---

## 四、`dsh.profile.patchReload` 移除 + HMR 包改名

**依据**：`apps/cli/README.md` 与 `docs/user/develop/framework/index.md` 的区间 diff、`packages/util/package-manifest/src/types.ts`、`docs/architecture.md`。

### 4.1 `patchReload` 已不存在

类型层对比（`packages/util/package-manifest/src/types.ts`）：

```ts
// 0.1.6-alpha.1 —— 存在
export interface DshProfileManifest {
  bundles?: string[]
  /** User patch lifecycle; omitted means `live` for custom profiles. */
  patchReload?: ProfilePatchReload
}
export type ProfilePatchReload = 'live' | 'startup'

// 0.1.7-rc.1 —— 两者均已删除
export interface DshProfileManifest {
  /** Ordered bundle layer list, using installed package names. */
  bundles?: string[]
}
```

`apps/cli/README.md` 的新表述（diff 实测）：

> A profile directory holds a `package.json` (out-of-tree plugin dependencies plus the profile manifest `dsh.profile` with its ordered `bundles` list) and a `cordis.patch.yml` (the user's own patch layer). **`dsh-hmr`, when enabled in YAML, watches the profile manifest and both profile and home patch files, then recomposes all layers through one serialized reload.** Without HMR, changes apply on restart.

`docs/architecture.md` 给出各 shipped profile 的默认值：**base 启用 config-only `dsh-hmr`**；headless、SDK、ACP **禁用**；`sdk-minimal` **完全省略**；profile 补丁可覆盖这些默认值。

### 4.2 HMR 包改名

`docs/user/develop/framework/index.md` 区间 diff 全文只有一行：

```diff
-With `@deepseek-ai/cordis-plugin-hmr` loaded from `cordis.yml`, editing a plugin source file triggers:
+With `@deepseek-ai/dsh-hmr` loaded from `cordis.yml`, editing a plugin source file triggers:
```

相关提交：`d06e6b5519 feat: coordinate profile management through dsh-hmr`。

### 4.3 迁移动作

| 你的组合/清单 | 迁移动作 |
|---|---|
| `dsh.profile.patchReload: live` 或 `'startup'` | 删除该键；要热重载就在 YAML 里启用 `dsh-hmr` 行 |
| `cordis.yml` 里写 `@deepseek-ai/cordis-plugin-hmr` | 改为 `@deepseek-ai/dsh-hmr`（否则加载失败） |
| 依赖 profile 与 home 补丁的监视行为 | 该行为现在**归属 `dsh-hmr`**；未启用 HMR 时改动只在重启后生效 |
| sdk / acp / headless profile | 它们**默认禁用** HMR，请不要假设补丁会被热应用 |

---

## 五、会话格式 V3 → V4（不可回退）

**依据**：`docs/persistence-changes/2026-09-16-session-format-v4.md`、`docs/session-format-status.md`、`packages/session/session-format-v3-to-v4/`。

### 5.1 结论

| 项 | 值 |
|---|---|
| writer（代码常量） | `SESSION_FORMAT_VERSION = 4`（`packages/core/session/src/types.ts:89`） |
| 已敲定兼容基线 | `latestFinalizedVersion: 4`（检查点 `docs/persistence-changes/finalized/v4.json`） |
| **发布记录** | `latestReleasedVersion: 3`，`evidenceTag: dsh-v0.1.5-alpha.1` |
| 迁移包 | `packages/session/session-format-v3-to-v4/`（**本版新增**） |
| 代际规则 | 只新增版本命名的后继；**绝不**重命名/覆盖/删除已提交代际 |
| 回退 | **不受支持**；V3 reader **拒绝**更新的代际 |

> 官方在 `docs/session-format-status.md` 中明确：alpha / beta / rc 级发布**即已建立已发布会话格式义务**，GitHub 的 prerelease 标记**不会**让持久化用户数据变得可丢弃。因此不要把"rc"理解为"数据可丢"。

### 5.2 触发时机与文件后果

- **读 open**：在内存中准备迁移结果，**不发布**后继文件。
- **写 open**：先编码、校验，再把当前版本的命名后继**独占发布**在未改动的前代文件旁。
- 结果：你的会话目录里会出现新的 `session.v4.jsonl[.zstd]`，**前代文件保持原样且不再被写入**。
- 文件名规则（`docs/architecture.md`）：JSONL v0 用 `session.jsonl[.zstd]`；**v1 及之后用 `session.vN.jsonl[.zstd]`**；已提交的代际路径**永不重命名、替换或删除**。

### 5.3 迁移动作（插件作者）

| 你的插件做什么 | 迁移动作 |
|---|---|
| 直接读写 `session.jsonl` | **停止**这样做的假设：v4 写入 `session.v4.jsonl`。正确做法是通过 `SessionPersistence`（`create`/`open`/`stat`/`list`/`export`）或 `ctx.sessions` |
| 解析 content-block 联合并处理 `tool-result` | `tool-result` **已从该联合移除**；工具结果成为 tool-role 消息，带**必需 `toolCallId`** 与**可选 `isError`** |
| 依赖已发布的插件 source 包装器 | 生产者自有 source 取代之；V3→V4 边持**冻结的重命名表与冲突规则**。PTC 生产者写 `source.kind: 'ptc-mode'`（历史 `tools-code-mode` / `tools-ptc` 仍作查找键被映射） |
| 消费 `turn/end` | `reason` 新增 `forked`；精确 cut 的 fork 会在继承标记后追加子代理自有 error 结果与收尾 |
| 想发自定义 developer 记录 | 本版**官方明确无任何 shipped profile 发出 developer 记录**，provider 序列化、自动发出与 UI 支持**仍延后**；不要基于它构建功能 |
| 依赖 `request/header` 的 `system` 键 | 该键已被**记为禁止**（forbidden）；这是记录既有原生 reader 的拒绝行为，日后若要允许取值必须版本跃迁 |

### 5.4 内嵌共享声明导致 10 个事件 root 连带变更

官方解释：inbox 条目、消息事件、compaction 摘要、标题请求、团队消息与 PTC 派发都内嵌了共享的 `Message` / `ContentBlock` 声明；**从该联合移除 `tool-result` 并特化消息角色，会改变这些可达 schema，但并未新增十套独立事件协议**。

受影响的 root（共 14 项 version-bump，其中 1 项为全新增事件，10 项由共享声明连带）：

```
SessionHeader, event:agent/inbox/spliced, event:assistant/attempt, event:assistant/message,
event:compaction/summary, event:developer/message（新增）, event:request/header,
event:session/title-llm-request, event:system/message, event:team/message/queued,
event:tool/ptc-dispatch, event:tool/result, event:turn/end, event:user/message
```

---

## 六、插件清单契约的三个增量

### 6.1 `dsh.bundle.patch` 接受有序文件列表

提交 `654caa4bbd feat(bundle): accept an ordered patch file list in dsh.bundle.patch (#4722)`。

```ts
export interface DshBundleManifest {
  /** One patch file path, or an ordered list applied in sequence, each relative to the declaring package root. */
  patch: string | string[]
}
```

官方 `docs/user/develop/basic/publish.md` 新增说明：列表形式如 `["./base.patch.yml", "./web.patch.yml"]`，启动器按序把它们作为**一个层**应用，**每个文件的相对插件路径在该文件旁解析**。

**迁移动作**：无需改动（`string` 仍合法）；想拆分补丁层时改用数组，并注意"一个层"与"路径在各文件旁解析"两条语义。

### 6.2 `DshManifest` 公开面再收窄

`packages/util/package-manifest/src/types.ts` 在区间内从 104 行重写为 94 行。**从公开类型中消失**的字段（0.1.6 时仍公开列出）：

| 消失的字段 | 原归属说明 |
|---|---|
| `configTrees`（`DshConfigTreeDeclaration`） | 实验性镜像打包器拥有 |
| `sessionFormatMigration`（`DshSessionFormatMigrationManifest`） | workspace 目录生成器拥有 |
| `moduleFallback`（`DshModuleFallbackManifest`） | 启动器生成，标注 `@internal` |

**保留并新增**的公开面：`DshManifest`（`manifestVersion?` / `bundle?` / `profile?` / `client?`）、`DshBundleManifest`、`DshProfileManifest`（仅 `bundles`）、`DshClientManifest`（四字段不变）；新增 `DshPackageManifest`、`DshEnginesManifest`、`LocalizedText`、`PluginLocalizedMeta`。

**迁移动作**：若你的插件读取上述三个字段，改为依赖其**归属实现**；`bundle` / `profile` / `client` 用法不变。

`icon` 的硬约束（类型 JSDoc 原文）：SVG / PNG / JPEG / WebP，相对该清单所在目录，**最大 256 KiB**，且经 realpath 解析后必须仍在该目录内。

### 6.3 插件自有本地化显示元数据（可直接用）

**依据**：`.agents/notes/implemented/architecture/2026-09-18-localized-package-metadata.md`。

在 `locale/<language>.json`（从 `locale/en.json` 起）中提供可选 `meta`：

```json
{ "meta": { "title": "File Search", "description": "Search files in your workspace." } }
```

| 主题 | 契约 |
|---|---|
| 资源导出 | 需声明 `./locale/*.json`；子路径插件为 `./<sub>/locale/*.json` |
| 地址来源 | 由**配置里的 Cordis 插件名**决定（不评估插件代码）；**纯 JS 文件路径不做同级查找**，配置路径即最终标题回退 |
| 语言发现 | Host 解析 `en.json`，在同目录发现其它语言文件；语言标识大小写不敏感，**重复被拒**；英文字段须非空字符串 |
| title 回退 | `meta.title` → 同级 package.json 的非空 `name` → 完整配置 Cordis 插件名 |
| description 回退 | `meta.description` → 同级 package.json 的非空 `description` → 无描述 |
| 子路径插件 | **不继承**所属包的介绍 |
| 错误语义 | 缺资源/缺字段走回退；**非法 locale 字段或畸形文件报诊断而非静默回退**，插件仍可管理 |
| 禁用插件 | 无需激活即可读取 |
| 缓存 | **按请求读取，无元数据缓存** |
| 不适用 | 远端预览**不下载**远端包内容做翻译；模型工具结果**排除**多语言 UI 字典；Session 事件不变 |

**发布注意**（note 的 Consequences 段）：漏掉语言文件或漏声明导出，会让**发布后**元数据不可用——验证须同时覆盖**解析**与**打包进包的文件**两项。

---

## 七、客户端模块 rev 语义变化

**依据**：`docs/subsystems/client-modules.md` 区间 diff（+22/-15）。

| 项 | 0.1.6-alpha.1 | 0.1.7-rc.1 |
|---|---|---|
| 行 rev 派生 | 内容寻址：哈希插件脚本字节 + indexed source map | **由 entry 的 mtime、ctime 与 size 派生**，不哈希可执行字节 |
| 跨 Host 重启 | rev 会变 | **相同产物保持相同 rev**（官方明示为收益） |
| source map 读取 | 随脚本一起参与 | **启动 / index 渲染 / 脚本 GET / HEAD 都不读**；首次 map `GET` 才读取、校验、组装 Indexed Source Map v3 并缓存；**map 体由首次 GET 固定** |
| `WebBootEntry.url` | revisioned single-resource combo endpoint | **文档相对**（"relative to the document"） |
| `ClientArtifactBaseline` | `path` / `mtimeMs` / `size` | 新增 `ctimeMs`（"including writes that preserve mtime"） |
| registry 读面 | — | 新增 `fetchBundle()`（复用 HTTP 路由的同一惰性响应）；`rebuilt(id)` **先由文件系统元数据派生 revision，只有 revision 变化才读新字节** |

**迁移动作**：如果你的插件或工具链**自行计算/缓存**客户端 bundle rev（例如自建 SSR 或预加载清单），不要再假设 rev 与字节内容一一对应；改用 `ctx.clientModules.graph()` / `fetchBundle()` 读取权威值。共享文件系统 mtime/ctime 的构建产物（例如内容未变但被重新写入）现在会**保持同一 rev**。

---

## 八、新能力与扩展点（可选采用）

| 能力 | 包 / 服务 | 官方文档 |
|---|---|---|
| 交付物呈现 | `packages/deliverables/tool-present` | `docs/subsystems/deliverables.md`（本版新增） |
| 每轮变更文件摘要 | `deliverables/workspace-changes` → `ctx.workspaceChanges` | 同上 + `docs/persistence-changes/2026-09-14-workspace-changes-event.md` |
| Office → PDF 转换 | `document/office-to-pdf` → `ctx.officeToPdf` | `docs/subsystems/office-to-pdf.md`（本版新增） |
| 语音输入（实验） | `experimental/voice-input-bundle`、`speech-to-text*`、`client-ui-voice-input` → `ctx.speechToText` / `ctx.speechController` | `docs/subsystems/voice-input.md`（本版新增） |
| 产品遥测 | `host-product-telemetry-otel` → `ctx.productTelemetry` | `docs/subsystems/product-telemetry.md`（本版新增） |
| 插件管理缝 | `plugin-manager` → `ctx.pluginManager`；`client-ui-plugin-manager` → `ctx.pluginRegistryProbe` | `docs/subsystems/` + `packages/boot/plugin-manager/README.md` |
| 配置编辑缝 | `config-editor` → `ctx.configEditor` | `docs/subsystems/settings.md` |
| HMR 缝 | `hmr` → `ctx.hmr`（"Serialized module and configuration reloads"） | `packages/boot/hmr/README.md` |
| 浏览器/桌面操作 | 既有 `ctx.browserUse` / `ctx.computerUse` 沿革 | `docs/subsystems/browser-use.md`、`computer-use.md` |

新诊断命令：

```sh
dsh --profile <profile> --dump-config-schema   # 打印 entry 与 patch 的 JSON Schema（导入组合树声明的插件 schema）
```

> 官方提示：在用 `--dump-config-schema` 检查**不可信插件**前，先读 `apps/cli/reference/README.md#config-schema-dump` 的安全与范围说明。

---

## 九、升级检查清单

按顺序逐项确认：

1. [ ] **设置**：搜索代码中的 `installSection`（应为 0 处），改为 `configure({ auto: false }, ctx.fiber)` 子上下文 effect；把可热改字段标为 `.volatile()`。
2. [ ] **`@deepseek-ai/dsh*` peer 范围**：确认范围可被目标 `dsh --version` 满足（`workspace:*`/`^`/`~` 视为当前运行时）；与宿主共享单例的包**必须同时写 `peerDependencies` 与 `devDependencies`**；需要时用 `allow-version … --accept-risk` 并记录原因。注意 `engines.dsh` **不参与**该校验。
3. [ ] **profile 清单**：删除 `patchReload`；要热重载就在 YAML 启用 `dsh-hmr`。
4. [ ] **HMR 引用**：把 `@deepseek-ai/cordis-plugin-hmr` 改为 `@deepseek-ai/dsh-hmr`。
5. [ ] **设置文件**：确认部署脚本不再写 `$DSH_HOME/settings.yaml`；迁移值到 profile 补丁。
6. [ ] **会话**：确认插件不直接读写 `session.jsonl`；接受 V3→V4 就地迁移与不可回退。
7. [ ] **tool 结果**：处理 `tool-result` 退出 content-block 联合；适配 `toolCallId` / `isError`。
8. [ ] **`turn/end.reason`**：处理新增的 `forked`。
9. [ ] **source 字段**：改用生产者自有 source；确认 PTC 为 `ptc-mode`。
10. [ ] **清单类型**：停止引用 `configTrees` / `sessionFormatMigration` / `moduleFallback`。
11. [ ] **本地化显示**（可选）：加 `locale/en.json` 的 `meta` 与 `./locale/*.json` 导出。
12. [ ] **补丁层**（可选）：需要时改用 `patch: [..]` 数组。
13. [ ] **客户端 rev**（可选）：改读 `ctx.clientModules` 权威值。
14. [ ] **验证**：`dsh --profile <p> --dump-config` 核对层；`--dump-config-schema` 核对 schema；启动一次并确认无 `incompatible-version` 拒绝。

---

## 十、可复核命令

```powershell
$repo = 'E:\test\rewrite-agently\deepseek-harness'

# 席位 API 换代（预期 15 / 15 / 0）
foreach ($t in @('dsh-v0.1.5-rc.2','dsh-v0.1.6-alpha.1','dsh-v0.1.7-rc.1')) {
  "$t : " + (git -C $repo grep -c 'installSection' $t -- packages | Measure-Object).Count
}

# 新席位 API 签名
git -C $repo grep -n 'configure(presentation' dsh-v0.1.7-rc.1 -- packages/settings/settings/src/index.ts

# patchReload 删除
git -C $repo diff dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/util/package-manifest/src/types.ts

# HMR 改名
git -C $repo diff dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- docs/user/develop/framework/index.md

# patch 数组化
git -C $repo log --oneline dsh-v0.1.6-alpha.1..dsh-v0.1.7-rc.1 --grep='patch file list' -i

# 会话格式
git -C $repo grep -n 'SESSION_FORMAT_VERSION = ' dsh-v0.1.7-rc.1 -- packages/core/session/src/types.ts
git -C $repo ls-tree -d --name-only dsh-v0.1.7-rc.1:packages/session | Select-String 'session-format'

# 设置文件导入的 e2e 证据
git -C $repo show dsh-v0.1.7-rc.1:apps/web/tests/settings-import.e2e.ts

# 本地化显示元数据
git -C $repo show dsh-v0.1.7-rc.1:.agents/notes/implemented/architecture/2026-09-18-localized-package-metadata.md

# 版本豁免
git -C $repo grep -n 'version-exemptions' dsh-v0.1.7-rc.1 -- packages/boot/plugin-manager/README.md
```

---

*本文档基于 `dsh-v0.1.6-alpha.1` → `dsh-v0.1.7-rc.1` 的实测差异。变更要点总表见 [CHANGELOG.md](CHANGELOG.md)；跨两版累积差异见 [diff-vs-0.1.5-rc.2.md](diff-vs-0.1.5-rc.2.md)。*
