# v0.1.0-rc.7 版本分析

> 基于 tag `dsh-v0.1.0-rc.7`，54 个 packages

## 概述

v0.1.0-rc.7 是 DSH 最早可用的 git tag，代表了插件系统的初始稳定形态。已有的 14 篇源码解析文章基于 v0.1.0-rc.5 源码快照，与 rc.7 的核心架构一致。

## 架构特征

| 维度 | 状态 |
|------|------|
| Session 格式 | V1 (SQLite 持久化) |
| API 层 | Apiproxy RPC |
| 客户端包 | `@deepseek-ai/dsh-client-runtime` |
| Settings | 无独立包，内嵌于 client |
| 插件清单 | 无 `dsh.plugin.json` 标准 |
| UI 框架 | 基础聊天界面，无 Sidebar |

## 包结构

- **54 个 packages**，核心分布在 `packages/core/`、`packages/client/`、`packages/interaction/`
- 客户端：`client/runtime`（SlotRegistry + SessionRuntime）、`client/web`、`client/web-react`
- UI 组件：`ui-conversation`、`ui-sidebar`（基础版）、`ui-settings`、`ui-slots`
- 无 `ui-chat`（0.1.2 新增）、无 `ui-dockkit`（0.1.5 新增）

## 与 v0.1.0-rc.5 文章的关系

| 文章 | 基于 rc.5 | 与 rc.7 差异 |
|------|-----------|-------------|
| 01-vendor-cordis | ✅ | Cordis 框架层无变化 |
| 02-core-product | ✅ | 产品主干一致 |
| 03-shell-capabilities | ✅ | Shell 能力缝一致 |
| 05-execution-world | ✅ | Session V1 + SQLite 一致 |
| 10-gui-frontend-backend | ✅ | 基础聊天 UI 一致 |

**结论**：rc.5→rc.7 之间无架构级变更，文章内容对 rc.7 依然准确。

## 插件开发要点

- 使用 `@deepseek-ai/dsh-client-runtime` 作为客户端依赖
- Settings 通过 `ctx.settings.register()` 注册（无 `installSection`）
- 命名空间使用 `settingsNamespace()` 包装
- Slot 系统已存在，使用 keyed 注册
- 无 `dsh.plugin.json` 清单文件（后续版本引入）

## 版本演进

```
v0.1.0-rc.5 (文章基础) → v0.1.0-rc.7 (本文件) → v0.1.0-rc.8 → v0.1.1-rc.1 → v0.1.1-rc.2
```
