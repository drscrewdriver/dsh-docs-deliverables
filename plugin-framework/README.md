# Plugin Framework

DSH 插件开发框架文档。涵盖标准文件结构、版本分发策略、兼容性指南、awesome-dsh-plugin 市场投稿。

## 文档目录

| 文件 | 主题 | 适用场景 |
|------|------|----------|
| [file-structure.md](file-structure.md) | 标准插件文件结构 | 新建插件时的文件组成参考 |
| [distribution-strategy.md](distribution-strategy.md) | 版本分发策略 | 同一 npm 包名适配不同 DSH 版本 |
| [compatibility-guide.md](compatibility-guide.md) | 兼容性指南 | peerDeps、breaking changes、升级路径 |
| [submission-guide.md](submission-guide.md) | awesome-dsh-plugin 投稿 | 向市场提交插件的完整步骤 |

## 快速开始

1. **新建插件**: 参照 [file-structure.md](file-structure.md) 创建项目骨架
2. **配置兼容性**: 参照 [compatibility-guide.md](compatibility-guide.md) 设置 `dsh.plugin.json` + peerDeps
3. **版本策略**: 参照 [distribution-strategy.md](distribution-strategy.md) 规划双版本分发
4. **发布市场**: 参照 [submission-guide.md](submission-guide.md) 向 awesome-dsh-plugin 投稿

## 核心概念

- **JS-based 插件**: `host/index.ts` + `client.ts` — 推荐方式
- **TS-based 插件**: 全 TypeScript 项目 — 需额外 `tsdown` 构建
- **dsh.plugin.json**: 插件清单文件，定义 id、engines、components 等
- **双版本分发**: 同一 npm 包名，不同版本号适配不同 DSH 版本范围
- **screenshots.json**: awesome-dsh-plugin 市场卡片展示图片清单

## 与源码解析的关系

插件框架文档与 `source-analysis/` 中的模块详解互补：
- `source-analysis/` 侧重 DSH 内部架构和模块实现
- `plugin-framework/` 侧重外部插件开发者的使用接口

两者的连接点：
- [01-vendor-cordis.md](../source-analysis/v0.1.0-rc.5/01-vendor-cordis.md) — Cordis 框架层（插件运行时基础）
- [03-shell-capabilities.md](../source-analysis/v0.1.0-rc.5/03-shell-capabilities.md) — Shell 能力缝（插件扩展点）
- [07-multi-agent.md](../source-analysis/v0.1.0-rc.5/07-multi-agent.md) — 多智能体（AgentTeams 插件开发）
