# Plugin Framework

DSH 插件开发框架文档。涵盖标准文件结构、版本分发策略、兼容性指南、v0.1.5 / v0.1.7 迁移指南、awesome-dsh-plugin 投稿。

> **⚠️ 2026-09-25 重要更新（`dsh-v0.1.7-rc.1`）**：本版有 **6 项必须动手的破坏性变更**，其中 `settings.installSection()` 已从宿主**完全删除**（无兼容垫片），`settings.plugin.item` 席位已移除，`$DSH_HOME/settings.yaml` 已移除，且**兼容性校验读的是 `peerDependencies` 而不是 `engines.dsh`**。若你在 0.1.5/0.1.6 上维护插件，请**先读 [v0.1.7-migration.md](v0.1.7-migration.md)**。

## ⭐ 标准插件骨架（快速开始）

> **`dsh-plugin-template/`** — 可直接复制的完整插件脚手架，已包含全部标准文件结构、跨版本兼容模式、构建脚本。

```bash
# 1. 复制骨架
cp -r dsh-plugin-template /path/to/your-plugin

# 2. 替换占位符
#    - package.json → name, repository, dsh.bundle.patch id
#    - dsh.plugin.json → id, name, description
#    - cordis.patch.yml → id, name
#    - src/client/index.ts → 你的业务逻辑
#    - README → 你的描述

# 3. 安装依赖 + 构建
cd your-plugin
npm install
npm run build

# 4. 安装到 DSH
dsh plugin --profile web add /path/to/your-plugin
```

骨架已实现：
- ✅ `dsh.bundle` manifest + `cordis.patch.yml`（投稿 B.2 要求）
- ✅ `peerDependencies` 预留位（投稿 B.3 要求，按需填入 `@deepseek-ai/*`）
- ✅ 跨版本 settings API（installSection / register 回退）
- ✅ `__ModuleLoader__` 客户端 bundle 构建
- ✅ 标准目录结构（file-structure.md TS 为主模式）

---

## 文档目录

| 文件 | 主题 | 适用场景 |
|------|------|----------|
| [file-structure.md](file-structure.md) | 标准插件文件结构 | 新建插件时的文件组成参考 |
| [distribution-strategy.md](distribution-strategy.md) | 版本分发策略 | 同一 npm 包名适配不同 DSH 版本 |
| **[version-line-sync.md](version-line-sync.md)** | **多版本线同步（兼容分支治理）** | **主线前进、兼容线落后的定期同步：先量 merge 成本与独有价值，再选树对齐；把两线差异写成脚本 + 断言，用钉死的 SHA 当基线** |
| [compatibility-guide.md](compatibility-guide.md) | 兼容性指南 | peerDeps、breaking changes、升级路径；**§二十一 = v0.1.6/0.1.7 源码实证速查** |
| **[v0.1.7-migration.md](v0.1.7-migration.md)** | **v0.1.7 迁移指南（可操作版）** | **设置席位 API 换代（`installSection` 删除 → `configure`）、peer 范围强制（`engines.dsh` 无效）、`settings.yaml` 移除、`patchReload` 移除、HMR 改名、会话 V4、本地化显示元数据** |
| **[v0.1.5-migration.md](v0.1.5-migration.md)** | **v0.1.5 迁移指南**（历史） | **Token/Permission/Inbox/Adapter 全面迁移**；其设置席位部分已被 v0.1.7 取代 |
| **[v0.1.5-migration-addendum.md](v0.1.5-migration-addendum.md)** | **v0.1.5 迁移补充（实战校准）** | **插件启动 await、firehose seed 盲区、设置席位单注册、peer 预发布陷阱、宿主 LLM 目录接缝** |
| **[settings-seat-017-recipes.md](settings-seat-017-recipes.md)** | **0.1.7 设置席位实证范式（perm-gate / better-sidebar 校准）** | **`settings.plugins.tab` 与 `settings.section` 两个已实机验证的注册范式、`configForms` 只写自己 entry 的硬约束、插件族共用入口设计、"pending waiting for service" 取证手册、dist-tag 发布纪律** |
| **[settings-seat-pinning.md](settings-seat-pinning.md)** | **设置席位 TDD 钉死规约（0.1.7 已重写）** | **0.1.7 席位表（`plugin.item` 已移除）+ `.volatile()` 字段声明 + `configure` 呈现策略 + seat-pin 契约测试；含 0.1.5/0.1.6 历史席位表供考古** |
| [upgrade-pitfalls.md](upgrade-pitfalls.md) | 升级适配陷阱（讨论区实证 + 源码实证） | 升级后排障：会话拒载、RPC 405、client combo 缓存；**§八 = 0.1.7 十类新陷阱（以静默失效为主）** |
| [settings-adaptation-common-patterns.md](settings-adaptation-common-patterns.md) | **0.1.7 设置面适配共性总结（六条共性 + 六步流程 + 防回归纪律）** | **0.1.7 设置面适配的总览入口与自查清单** |
| [client-ui-extension-seams.md](client-ui-extension-seams.md) | 客户端 UI 扩展接缝（源码实证） | 贡献自定义权限档位时的图标缺失、选中态文字回退、风险确认不触发 |
| **[plugin-install-and-client-seams.md](plugin-install-and-client-seams.md)** | **「装了但不显示」的四层注册链（源码实证）** | **包已放进 node_modules、profile 的 cordis.patch.yml 也写了 `- id:`，插件却毫无踪影且不报错：④ 层里最静默的是 `dsh.profile.bundles`（只有 `dsh plugin add` 会自动维护）——附 `--dump-config` 离线验证法与客户端 `__ModuleLoader__` 三条硬契约** |
| **[command-registration-audit/](command-registration-audit/)** | **客户端命令注册契约检查（案例复盘 + 检查工具）** | **`/` 菜单里命令集体消失、控制台 `contribution.description is not a function`：注册期零校验 → 候选期抛错 → source 级降级。含 L1 静态 + L2 沙箱双层检查器与 16 条自测** |
| **[i18n-multilingual-guide.md](i18n-multilingual-guide.md)** | **多语言适配（zh/en 内置 + ja/ko 第三语言）** | **插件要支持日语/韩语：字典拆分、`locale.register` 注册、`addLanguage` 语言包、HMR 回收与验证清单** |
| [submission-guide.md](submission-guide.md) | awesome-dsh-plugin 投稿 | 向市场提交插件的完整步骤 |

## 快速开始（文档阅读顺序）

1. **先看骨架**：[dsh-plugin-template/](dsh-plugin-template/) — 复制即用，包含所有标准文件
2. **配置兼容性**：参照 [compatibility-guide.md](compatibility-guide.md) 设置 `package.json` 的 `dsh` 字段 + peerDeps（**注意：DSH 不读 `dsh.plugin.json`，见下方「清单事实纠正」**）
3. **版本策略**：参照 [distribution-strategy.md](distribution-strategy.md) 规划双版本分发
4. **维护兼容分支**：兼容线落后于主线需要同步时，参照 [version-line-sync.md](version-line-sync.md)（先量成本再选做法；把差异声明化）
4.5. **v0.1.7 迁移（当前版本线）**：参照 [v0.1.7-migration.md](v0.1.7-migration.md) 处理设置席位换代、peer 强制校验、`settings.yaml` 移除、`patchReload` 移除、HMR 改名与会话 V4；带设置面板的插件再对照 [settings-seat-017-recipes.md](settings-seat-017-recipes.md) 选范式（`settings.plugins.tab` 或 `settings.section`）并核对本轮实机坑
5. **v0.1.5 迁移（历史）**：参照 [v0.1.5-migration.md](v0.1.5-migration.md) 完成 Token/Permission/Inbox/Adapter 适配，再用 [v0.1.5-migration-addendum.md](v0.1.5-migration-addendum.md) 复核正文未覆盖的实战项
5.5. **设置席位钉死**：带设置面板的插件按 [settings-seat-pinning.md](settings-seat-pinning.md) 做"单席位 + seat-pin 契约测试"（**0.1.7 席位表已重写**）
6. **升级排障**：升级后行为异常时查 [upgrade-pitfalls.md](upgrade-pitfalls.md)（**§八 = 0.1.7 新陷阱** + 排障决策树）
6.5. **安装后没反应**：装了却看不到、又不报错时查 [plugin-install-and-client-seams.md](plugin-install-and-client-seams.md) —— 先 `dsh --profile <p> --dump-config` 确认 `dsh.profile.bundles` 这一层（手动安装最常漏它），再核客户端 `__ModuleLoader__` 契约
7. **做多语言**：要让插件的 ja/ko 文案跟随语言切换，参照 [i18n-multilingual-guide.md](i18n-multilingual-guide.md)
8. **发布市场**：参照 [submission-guide.md](submission-guide.md) 向 awesome-dsh-plugin 投稿
9. **注册命令后自检**：插件注册了 `/` 命令时，用 [command-registration-audit/](command-registration-audit/) 的工具扫一遍——`description` 必须是函数，写错会让**整个命令菜单**静默消失

## 核心概念

- **JS-based 插件**: `host/index.ts` + `client.ts` — 推荐方式
- **TS-based 插件**: 全 TypeScript 项目 — 需额外 `tsc` + `build-client.mjs` 构建
- **`package.json` 的 `dsh` 字段**: **DSH 唯一读取的插件清单**（`dsh.bundle.patch` / `dsh.profile.bundles` / `dsh.client` / `dsh.manifestVersion`）
- **`dsh.plugin.json`**: ⚠️ **DSH 运行时/启动器不读它**（见下方「清单事实纠正」）；本仓库模板仍附带该文件，属投稿侧约定
- **cordis.patch.yml**: cordis bundle patch，声明插件身份（纯 insert）
- **双版本分发**: 同一 npm 包名，不同版本号适配不同 DSH 版本范围
- **screenshots.json**: awesome-dsh-plugin 市场卡片展示图片清单

### ⚠️ 清单事实纠正（2026-09-25 实测）

实测命令：`git grep -l 'dsh\.plugin\.json' <tag>`，在 `dsh-v0.1.5-rc.2`、`dsh-v0.1.6-alpha.1`、`dsh-v0.1.7-rc.1` 三个 tag 上**命中均为 0**（全仓，含 `docs/`、`packages/`、`scripts/`、`apps/`、`website/`）。

| 结论 | 依据 |
|---|---|
| **DSH 不读 `dsh.plugin.json`** | 上游三版全仓零引用 |
| DSH 读取的是 **`package.json` 的 `dsh` 字段** | 官方 `docs/user/develop/basic/publish.md`：bundle manifest 声明 `dsh.bundle`，profile manifest 声明 `dsh.profile`；类型见 `packages/util/package-manifest/src/types.ts` 的 `DshManifest` |
| **版本校验读 `peerDependencies`，不是 `engines.dsh`，更不是 `dsh.plugin.json`** | `packages/boot/app-boot/src/plugin-compatibility.ts:61-88`；官方原文 `packages/boot/app-boot/README.md:52`「These checks use peer declarations, not `engines.dsh`」、`packages/util/package-manifest/README.md:93`「do not enforce `dsh.manifestVersion` or `engines.dsh`」 |

**因此**：`submission-guide.md` 中「`dsh.plugin.json → engines.dsh` 用于 DSH 运行时版本校验」的表述**不准确**（该文已就地加注）。把 `engines.dsh` 写对仍有文档/市场价值，但**准入效果来自 `peerDependencies`**。保留 `dsh.plugin.json` 不影响加载（多余文件不会报错），但**不要指望它产生任何运行时效果**。

## v0.1.5 适配重点

DSH v0.1.5 是第二次重大架构升级，插件开发者需要关注以下四个核心变更：

| 变更 | 影响级别 | 详情 |
|------|---------|------|
| Token Meter API 扩展 | 🟡 中 | `measure()` 新增，`TokenMeasurement` 结构化 |
| Permission Presets 统一服务 | 🟡 中 | `ctx.permissionPresets.set()` 替代 `setSandboxMode` |
| Inbox 从服务到投影 | 🔴 高 | `ctx.inbox` 移除，改为 `Agent.inbox` 投影 |
| LLM Adapter 扩展 | 🟢 低 | 4 个新方法，默认实现不强制 |
| **RPC 通道重构** | 🔴 高 | handle 通道 405 静默失效、/api interceptor 单槽——**改自持 webServer 路由**，见 [compatibility-guide.md §16A](compatibility-guide.md) 与 [upgrade-pitfalls.md §2.1](upgrade-pitfalls.md) |
| **webServer 调用方授权** | 🔴 高 | 走 RPC/HTTP 通道的插件入口须 `inject=[...,'webServer']`，缺失 = 宿主 fatal |
| **客户端服务注入纪律** | 🟡 中 | shell 常备服务（slots/locale/settingsScope）**声明式 inject**；仅可选服务懒取降级——懒取常备服务 = 激活竞态、设置入口全消失；声明可选服务 = 永久挂起。判别标准见 [settings-seat-pinning.md](settings-seat-pinning.md) |

> **快速上手**：[v0.1.5-migration.md](v0.1.5-migration.md) 提供了完整的迁移步骤、代码示例和检查清单。
> **RPC/HTTP 通道插件**：直接读 [compatibility-guide.md §16A](compatibility-guide.md)（实操级方案，2026-09-13 实战增补）。

## 投稿 Checklist 速查

投稿 awesome-dsh-plugin 前，确认以下要求全部满足：

- [ ] `dsh.bundle` manifest 在 `package.json` 中声明（B.2）
- [ ] `cordis.patch.yml` 存在且为纯 insert
- [ ] `@deepseek-ai/*` 声明为 `optional peerDependencies`（B.3）
- [ ] GitHub 仓库添加 `dsh-plugin` topic
- [ ] README 包含安装说明 + 版本兼容矩阵
- [ ] 仓库年龄 ≥ 1 天
- [ ] 有真实可运行代码（非占位仓）

详细步骤见 [submission-guide.md](submission-guide.md)。

## 与源码解析的关系

插件框架文档与 `source-analysis/` 中的模块详解互补：
- `source-analysis/` 侧重 DSH 内部架构和模块实现
- `plugin-framework/` 侧重外部插件开发者的使用接口

v0.1.5 的插件迁移深度指南参见：[source-analysis/v0.1.5-rc.2/plugin-migration-guide.md](../source-analysis/v0.1.5-rc.2/plugin-migration-guide.md)

---

*文档生成时间：2026-09-12*
*数据源：`deepseek-ai/deepseek-harness` 仓库 `dsh-v0.1.5-alpha.1` ~ `dsh-v0.1.5-rc.2`*
