# 0.1.7 设置面适配共性总结（从适配历史提炼）

> 2026-09-26 · 基于 `dsh-v0.1.7-rc.1` → `rc.2` 的多插件实机适配历史提炼。
> 适配样本：`dsh-perm-gate@4.2.0-beta.2`（范式 B 首个存活的第三方设置面）、`DSH-better-sidebar`（范式 A）、`dsh-thinking-levels@3.3.0`、`dsh-session-guard@3.2.1`、`dsh-context-compression-improved`、`dsh-tidychat`（0.1.2 时代历史样本）。
> 定位：三篇详档之上的**共性提炼**——[v0.1.7-migration.md](v0.1.7-migration.md)（API 对照）、[settings-seat-017-recipes.md](settings-seat-017-recipes.md)（两范式实证）、[settings-seat-pinning.md](settings-seat-pinning.md)（TDD 钉死规约）。
> 历史参照：0.1.2-alpha.2 的 `dsh-settings` 导出移除（[compatibility-guide.md](compatibility-guide.md)）。

---

## 0. 六条共性（结论先行）

1. **席位只减不增，且删除无垫片**。每代宿主都在收敛席位：0.1.2 收敛导出函数，0.1.5 收敛 `plugin.item` 卡片，0.1.7 同时删掉 `installSection` API 与 `settings.plugin.item` 槽位，`SettingsScope` 服务在 rc.2 也被移除。**被删的 API 不会报错提示你迁移，只会让设置入口静默消失**。
2. **键的语义收归 entry id**。旧时代的自定 namespace 字符串（`permissive` 之类）在 0.1.7 不是键；`settings.plugins.tab` 的 `id`、`configForms.get()` 的参数，都必须与 `cordis.patch.yml` 的 `id:` 严格一致。
3. **权威存储从全局单例迁到 profile 声明**。`$DSH_HOME/settings.yaml` 已死，权威存储是活动 profile 的 `cordis.patch.yml`；插件侧通过 `settings.configure({ auto }, fiber)` 声明策略而非安装席位。
4. **数据面单通道**：客户端只能经 `ctx.configForms.get(<自己的 entry id>)` 读写自己的配置；设置 RPC 域不向配置客户端服务第三方 namespace，跨 entry 写必须走宿主半。
5. **"适配完成"有两个独立半场**：席位注册成功 ≠ 面板可用。组件崩（引用了 rc.2 改名导出）与数据不可用（form 快照 unavailable）表现都是"空白"，取证手段完全不同。
6. **隐式知识必须钉成测试**。历次回归（双面板、三入口消失、双入口）根因都是席位选择散落在注册代码里没有守护——用 TDD 钉死席位表是唯一可靠防回归手段。

---

## 1. 历代设置面断点对照（看清"收敛"方向）

| 代际 | 注册 API | 席位/槽位 | 权威存储 | 数据读取 |
|---|---|---|---|---|
| 0.1.0-rc.7 / 0.1.1 | `ctx.settings.register` | settings.section 直挂 | settings 文件 | 插件自读 |
| 0.1.2 ~ 0.1.5 | `ctx.settings.installSection(owner, ns, schema, entry, hooks)`（0.1.2 新增） | `settings.plugin.item` 卡片 | `$DSH_HOME/settings.yaml` | settingsScope.bind({namespace}) |
| 0.1.6-alpha.1 | installSection（仍可用） | item 卡片 + plugins.tab 并存 | settings.yaml | settingsScope |
| **0.1.7-rc.1/rc.2** | **`settings.configure({ auto }, fiber)`**（installSection 删除，无垫片） | **仅 `settings.section` 与 `settings.plugins.tab`**（item 删除） | **profile `cordis.patch.yml`** | **`ctx.configForms.get(entry id)`**（SettingsScope 删除） |

方向性结论：**API 越来越少、键越来越统一、存储越来越声明式**。为旧 API 写的兼容垫片（如 tidychat 时代的 installSection/register 回退）在 0.1.7 已全部失效——**回退链的终点必须定期重审**。

## 2. 0.1.7 适配的通用流程（六步，任何插件通用）

1. **判定受影响面**：搜代码里 `installSection` / `settingsScope` / `settings.plugin.item` / `$DSH_HOME/settings.yaml`，命中任意一个即需适配（见 [v0.1.7-migration.md 快速判定表](v0.1.7-migration.md)）。
2. **选席位**：设置项少 → 范式 B（`settings.plugins.tab`，挂在「插件」节下）；自成一体的大面板 → 范式 A（`settings.section` 顶级节）。**只注册一个席位**，双注册必出双面板。
3. **统一键为 entry id**：`cordis.patch.yml` 的 `id:` = tab `id` = `configForms.get()` 参数，三处一字不差。
4. **换数据通道**：`inject` 数组声明 `['slots', 'locale', 'configForms']`，组件数据全从 form 快照取，写经 `set/unset/mutate`；删掉一切 `settingsScope` 引用（rc.2 已删导出，编译期即失败——这是好事）。
5. **宿主半声明策略**：`ctx.inject(['settings'], ...)` 子 fiber 内 `settings.configure({ auto: false|true }, ctx.fiber)`；同 fiber 重复配置会抛错。
6. **双半场取证**：面板空白时先分型——console 有 `Element type invalid` 类报错 → 构建引用了 rc.2 改名导出，查 [v0.1.7-migration.md §11](v0.1.7-migration.md)；无报错只剩标题 → `configForms` 快照 unavailable，查 profile entry 行与 entry id 一致性。

## 3. 从事故史提炼的三条防回归纪律

| 历史事故 | 根因 | 纪律 |
|---|---|---|
| thinking-levels 双面板（tab + item 并存） | 误信过期情报，双席位注册 | **席位表唯一权威**：`packages/client/ui-settings/src/client/contract/slots.ts`，适配前先读当前 tag 的该文件，不凭记忆 |
| context-compression 三入口消失 | `inject` 只留 `['slots']`，懒取 settingsScope 竞态早退 | **服务依赖在 inject 数组显式声明**，不做 apply 内懒取 |
| tidychat 在 0.1.2 加载失败 | import 了被删导出 | **对 `@deepseek-ai/dsh*` 的每个 import 做运行时存在性检测 + 静默降级**，宿主删除 API 时插件仍能加载（只是设置面消失） |
| （0.1.7 通用）安装面静默消失 | 仍调 installSection，宿主不报错 | **冒烟清单固定三查**：席位可见、面板可渲染、读写往返成功——三绿才算适配完成 |

## 4. rc.1 → rc.2 的设置面增量（不要漏）

- `SettingsScope` 导出移除：编译期断，先修这个再做其余（见 [v0.1.7-migration.md §11](v0.1.7-migration.md)）。
- rc.2 图标/导出改名若干：构建引用 rc.1 内部导出的会在 rc.2 渲染崩溃（"组件崩"型空白的最大来源）。
- 本地 workspace overrides / devDeps 没随宿主升 → "本地 typecheck 红、远端正常（或反之）"分裂；**发布前必须在目标宿主 tag 的实机上跑一遍三查**。
- 宿主侧新增（非插件必做但相关）：Auto review 设置卡走范式 B 实装；optional bundle 需双语 title/description/icon 元数据（`scripts/optional-bundles.spec.ts` 硬校验）。

## 5. 详档索引

| 文档 | 内容 |
|---|---|
| [v0.1.7-migration.md](v0.1.7-migration.md) | 六项必改的 API 对照与逐条改法，含 §11 rc.2 实证补遗 |
| [settings-seat-017-recipes.md](settings-seat-017-recipes.md) | 范式 A/B 完整代码样本、坑与取证 |
| [settings-seat-pinning.md](settings-seat-pinning.md) | 0.1.7 席位表唯一权威 + TDD 钉死规约 + 事故史 |
| [compatibility-guide.md](compatibility-guide.md) | 0.1.2 时代的历史回退模式（方法论仍有参考价值，具体 API 已失效） |
| [upgrade-pitfalls.md](upgrade-pitfalls.md) | 历代升级坑清单（含 settings 孤儿 key、外部编辑互踩） |
