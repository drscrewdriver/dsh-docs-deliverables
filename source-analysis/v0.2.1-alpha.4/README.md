# DSH v0.2.1-alpha.3 → v0.2.1-alpha.4 变更说明（更新要点）

> **数据源**: `deepseek-ai/deepseek-harness` 官方仓库（经回环 HTTP 代理拉取 tag）
> **标签对比**: `dsh-v0.2.1-alpha.3` (`2fbf4359b8`) → `dsh-v0.2.1-alpha.4`（提交 `86a402200d`）
> **发布日期**: 2026-10-15 ｜ **发布 PR**: [#6301](https://github.com/deepseek-ai/deepseek-harness/pull/6301)
> **性质**: 0.2.1 线第四个 alpha，**一次「兼容性闸门换代（engines.dsh 优先）+ 插件市场（plugin-market）能力族进场」** 的中小跨度发布，共 89 个提交（64 非 merge + 25 merge）
> **统计**: 831 files changed, +22232 / −2044
> **结构变化**: **5 新增包 / 0 删除 / 0 改名**——`boot/plugin-market`、`client/ui-plugin-market`、`experimental/plugin-market-bundle`、`util/plugin-market-index`、`apps/plugin-market-generator`（市场全家桶）
> **持久化契约**: `SESSION_FORMAT_VERSION` **保持 4**；本段 **0 条新持久化承认**
> **插件契约**: ⚠️ **兼容性闸门本段动了**——`plugin-compatibility.ts`（+68 diff 行）改 **`engines.dsh` 优先判定**，`PluginCompatibility.peers` **改名 `requirements`**；`compatibility-preflight.ts` ±4 跟随；settings 核心 / vendor cordis·schemastery 内容零 diff；slot 目录 +63/−8（**+1 槽 `plugins.tab`**）；新能力缝 **`ctx.pluginMarket`**；新门禁 **package 源码禁 module-scope await**

---

## 一句话总结

0.2.1-alpha.4 是 **"装机兼容性判定换轨 + 官方插件市场成套落地"** 的一次发布：

- **兼容性闸门换代**（指南 `plugin-engines-dsh`，`packages/boot/app-boot/src/plugin-compatibility.ts`）：
  1. 包自带 **`engines.dsh` range 单独决定兼容性**，`@deepseek-ai/dsh*` peers **被忽略**；仅当无 `engines.dsh` 时才回落 peer 规则；
  2. `workspace:` 值**只在 peers 有效**；出现在 `engines.dsh` 里判不兼容；
  3. `engines` 非对象或 `engines.dsh` 非字符串 → **manifest 不可读，直接拒载**；
  4. 拒载记录形状改名：`IncompatiblePlugin.peers` 与 app-boot `PluginCompatibility.peers` → **`requirements`**（键为 `engines.dsh` 或 peer 包名）；
- **插件市场能力族**（5 新包 + **`ctx.pluginMarket`** 缝 + **`plugins.tab`** 槽）：`plugin-market`（boot 半：拉取并校验用户配置的索引源，安装走 plugin manager）+ `ui-plugin-market`（Discover 页签）+ `plugin-market-bundle`（Custom plugin markets bundle）+ `plugin-market-index`（索引 schema）+ `apps/plugin-market-generator`（参考索引生成器，`14abe9543c` commander 解析）；`3de3a977e0` 加 bundle 与 Discover 页；`ab3bb74550` 携带插件源仓库；`ed92c867ed` Discover 安装命名插件与版本；`b227127d62` Installed 页签与 More 收纳；
- **宿主换代防呆**（client-modules）：`f52abc04fa` **不应用来自其他宿主 release 的插件更新**；`a7a40f93d9` 解析图前先比对 host release；`7c9e54b3ef` host release 变化时提示重载；
- **新门禁：禁 module-scope await**（`b77cc1c0f2 feat(gates)`）：语法感知扫描 `packages/*/*/**src`，被 import 的模块不得在模块顶层挂起（仅 shebang/bin 可执行文件豁免）——对插件作者同样成立（宿主构建/自检工具链同款规则）；
- **模型推理档位编辑**（models scope）：`f61d9982f8` 自定义 API 模型可编辑 reasoning levels；`b542292bf9` 从 pi-ai schema 读推理档位；`a0a04158f8` reasoning 编辑跟随模型并镜像 pi-ai 拒绝；`7d654c9d8a` 去掉 switched-off 提示；
- **工具退出胶囊**（ui-tool）：`00f897b048` 命令退出以中性 inline capsule 呈现；`97a833471f` 预留 inline 空间；`95e76236bf`/`39d3849452` exit badge 隔离与 Host exit 解析；
- 其余：`subagent-codex` 接受 `partial_answer` 消息相位（`08d57291ad`）并修正 payload 取"选定答案"（`e480bda8d2`）；插件内置功能预览标准化（`e527c04663`/`c1269a8f75`/`ade9979185` 双语内置 SVG 限制）；agent-team 可用性 prompt 简化（`a04b8ef7e2`）；telemetry 桌面环境缓存（`4dee41f4bc`）；desktop 安装器重试/审批汇总（`14819e2eb4`/`24d73cae8d`）；web slash 命令原子 chip（`98d93db18f`）；subprocess-local Linux 容器兼容（systemd <254 native scope，`0fffa2432a` 等 6 条）。

---

## 版本序列定位

```
dsh-v0.2.1-alpha.3   ← 上版（2fbf4359b8，2026-10-14，PR #6234）
    │
    │  ←─ 本次变更（89 commits：64 非 merge + 25 merge，1 天）
    ▼
dsh-v0.2.1-alpha.4   ← 当前版（86a402200d，2026-10-15，PR #6301）
```

> **规模对比**：a.3 是 852 提交/14 篇指南；a.4 是 89 提交/**1 篇**指南——量回落，但那 1 篇恰好落在**所有插件都要过的兼容性闸门**上：`engines.dsh` 优先判定改变了 0.2.1 线 peer range 的写法口径（此前"peer 枚举六连"可以兜住一切，此后**声明了 `engines.dsh` 的包它单独说了算**）。

---

## 主要变更分组

| # | 变更族 | 规模 | 一句话 |
|---|--------|------|--------|
| 1 | **兼容性闸门换代** | 1 核心 commit | `engines.dsh` 优先、peers 仅回退；`peers→requirements` 改名；`workspace:` 在 engines.dsh 非法 |
| 2 | **插件市场族** | 10+ commits / 5 新包 | `ctx.pluginMarket` + `plugins.tab`；Discover 页签/源仓库/索引生成器 |
| 3 | **宿主换代防呆** | 3 commits | 拒绝跨 host release 的插件更新；图解析前比对；release 变化提示重载 |
| 4 | **门禁加固** | 2 commits | 禁 module-scope await；experimental 包纳入发布依赖策略检查（`22c51728ed`） |
| 5 | **模型/推理档位** | 4 commits | 自定义模型 reasoning levels 编辑；pi-ai schema 对齐 |
| 6 | **UI 工具呈现** | 4 commits | 命令退出 inline capsule；exit badge 隔离 |
| 7 | **Codex 子代理** | 2 commits | `partial_answer` 相位；payload 取选定答案 |
| 8 | **desktop/部署** | ~10 commits | 安装器锁重试、审批汇总、上传目的地对齐 |
| 9 | **subprocess-local** | 6 commits | systemd <254 兼容、每 provider 一次探测、缓存 scope 恢复命名 |

---

## Breaking Changes 与行为风险

**`SESSION_FORMAT_VERSION` 保持 4，0 新持久化承认；settings 核心 / vendor cordis·schemastery 内容零 diff。** 但**兼容性闸门是全体插件的必经面**，本版危险度对"声明面"是最高的：

### 官方升级指南级 breaking

| # | 变更 | 影响对象 | 危险度 |
|---|------|----------|--------|
| 1 | **`engines.dsh` 优先判定**：自带该 range 的包，peers 不再参与放宽/收紧；range 必须覆盖每一个要支持的 DSH 版本 | 所有声明 `engines.dsh` 的插件/bundle（0.2.1 线此前几乎无人声明——声明即换轨） | 🔴 有必做项 |
| 2 | **`engines` 形状闸**：非对象 `engines` 或非字符串 `engines.dsh` → manifest 不可读、**拒载** | `engines` 写了数组/字符串/带 null 键的老包 | 🔴 引用即炸 |
| 3 | **`IncompatiblePlugin.peers`→`requirements`**（含 app-boot `PluginCompatibility` 同名字段）；拒载提示文本变化 | 读拒载记录做展示/断言的插件与测试 | 🔴 改名即炸 |
| 4 | **`workspace:` 值在 `engines.dsh` 非法**（判不兼容；仅 peers 中有效） | 从 monorepo 复制 engines.dsh 写 `workspace:*` 的作者 | 🔴 引用即炸 |

### 非指南级观察点

| # | 变更 | 影响对象 | 危险度 |
|---|------|----------|--------|
| 5 | 禁 module-scope await 门禁（shebang/bin 豁免） | 宿主同源工具链自检；被宿主 CI 收录的投稿包 | 🟡 打包即闸 |
| 6 | 跨 host release 的插件更新被拒（`no plugin update from another host release`） | 灰度升级/混版 profile 的更新流 | 🟡 行为 |
| 7 | 新槽 `plugins.tab` + 新缝 `ctx.pluginMarket`（0 删除 0 改名） | 市场/展示类插件（机会面） | 🟢 增量 |
| 8 | experimental 包纳入 published dependency policy 检查 | mine-dsh-plugins 同款实验目录构建 | 🟡 门禁 |
| 8b | `client/hmr` 新增 **PageTransport** 载体（shell 自持页面传输时装入，如 worker preview 隧道；页面全局 `__DSH_TRANSPORT__.fetch` + eventsource-parser） | 自定义宿主页面传输的 shell 级集成（普通插件不触及） | 🟡 新内部面 |
| 9 | slot-catalog 文档面 +63/−8（除 `plugins.tab` 外为描述刷新） | 依 catalog 定位注入面的读者 | 🟢 文档 |

> a.1–a.3 风险表在本版仍逐条成立。0.2.1 线合并处方见 `plugin-framework/v0.2.1-migration.md`。

---

## 阅读路径

- 插件要不要改：[plugin-migration-guide.md](plugin-migration-guide.md)（结论：**没写 `engines.dsh` 的多数包零改；写了的必须重核 range 覆盖 + 字段改名跟随；读拒载记录的改 `requirements`**）
- 提交明细：[diff-vs-0.2.1-alpha.3.md](diff-vs-0.2.1-alpha.3.md) ｜ [CHANGELOG.md](CHANGELOG.md)
- 官方升级指南 1 篇：`docs/upgrade-guide/v0.2.1-alpha.3/plugin-engines-dsh/`
- 能力缝增删：`ctx.pluginMarket` +1，0 删除
