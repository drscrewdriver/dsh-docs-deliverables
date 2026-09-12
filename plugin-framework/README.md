# Plugin Framework

DSH 插件开发框架文档。涵盖标准文件结构、版本分发策略、兼容性指南、v0.1.5 迁移指南、awesome-dsh-plugin 投稿。

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
| [compatibility-guide.md](compatibility-guide.md) | 兼容性指南 | peerDeps、breaking changes、升级路径 |
| **[v0.1.5-migration.md](v0.1.5-migration.md)** | **v0.1.5 迁移指南** | **Token/Permission/Inbox/Adapter 全面迁移** |
| [submission-guide.md](submission-guide.md) | awesome-dsh-plugin 投稿 | 向市场提交插件的完整步骤 |

## 快速开始（文档阅读顺序）

1. **先看骨架**：[dsh-plugin-template/](dsh-plugin-template/) — 复制即用，包含所有标准文件
2. **配置兼容性**：参照 [compatibility-guide.md](compatibility-guide.md) 设置 `dsh.plugin.json` + peerDeps
3. **版本策略**：参照 [distribution-strategy.md](distribution-strategy.md) 规划双版本分发
4. **v0.1.5 迁移**：参照 [v0.1.5-migration.md](v0.1.5-migration.md) 完成 Token/Permission/Inbox/Adapter 适配
5. **发布市场**：参照 [submission-guide.md](submission-guide.md) 向 awesome-dsh-plugin 投稿

## 核心概念

- **JS-based 插件**: `host/index.ts` + `client.ts` — 推荐方式
- **TS-based 插件**: 全 TypeScript 项目 — 需额外 `tsc` + `build-client.mjs` 构建
- **dsh.plugin.json**: 插件清单文件，定义 id、engines、components 等
- **dsh.bundle manifest**: `package.json` 中的 `dsh:` 字段（必需，投稿 CI 检查）
- **cordis.patch.yml**: cordis bundle patch，声明插件身份（纯 insert）
- **双版本分发**: 同一 npm 包名，不同版本号适配不同 DSH 版本范围
- **screenshots.json**: awesome-dsh-plugin 市场卡片展示图片清单

## v0.1.5 适配重点

DSH v0.1.5 是第二次重大架构升级，插件开发者需要关注以下四个核心变更：

| 变更 | 影响级别 | 详情 |
|------|---------|------|
| Token Meter API 扩展 | 🟡 中 | `measure()` 新增，`TokenMeasurement` 结构化 |
| Permission Presets 统一服务 | 🟡 中 | `ctx.permissionPresets.set()` 替代 `setSandboxMode` |
| Inbox 从服务到投影 | 🔴 高 | `ctx.inbox` 移除，改为 `Agent.inbox` 投影 |
| LLM Adapter 扩展 | 🟢 低 | 4 个新方法，默认实现不强制 |

> **快速上手**：[v0.1.5-migration.md](v0.1.5-migration.md) 提供了完整的迁移步骤、代码示例和检查清单。

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
