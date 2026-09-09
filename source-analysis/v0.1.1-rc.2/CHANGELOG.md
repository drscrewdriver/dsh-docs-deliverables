# v0.1.1-rc.2 版本分析

> 基于 tag `dsh-v0.1.1-rc.2`，从 v0.1.0-rc.7 经 207 commits 演进

## 概述

v0.1.1-rc.2 是 DSH 首个"稳定"发布版本（本地安装版本）。相对于 rc.7，主要是增量改进，无架构级 breaking changes。

## 变更摘要

### 新增能力

| 变更 | 说明 |
|------|------|
| `experimental` 包 | 新增实验性功能包 |
| LLM pi-ai 兼容性修复 | pin compat field types，拒绝空值 |

### Breaking Changes

无。rc.7→0.1.1-rc.2 之间仅有 1 个标记为 breaking 的提交（`fix` 级别），且是 LLM adapter 内部修复，不影响插件 API。

### 包结构变化

- 新增 `packages/experimental/`（实验性功能）
- 其余包结构不变

## 架构特征

| 维度 | 状态 |
|------|------|
| Session 格式 | V1 (SQLite 持久化) |
| API 层 | Apiproxy RPC |
| 客户端包 | `@deepseek-ai/dsh-client-runtime` |
| Settings | `ctx.settings.register()` |
| 插件清单 | 无 `dsh.plugin.json` |

## 插件开发要点

- 与 v0.1.0-rc.7 完全兼容
- 插件 API 无变化
- 可安全从 rc.7 升级

## 版本演进

```
v0.1.0-rc.7 → v0.1.0-rc.8 → v0.1.1-rc.1 → v0.1.1-rc.2 (本文件)
                                                      ↓
                                               v0.1.2-alpha.1 (大重构开始)
```
