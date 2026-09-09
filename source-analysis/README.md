# Source Analysis

DeepSeek Harness 源码深度解析。按版本快照组织，每个版本包含架构分析、Breaking Changes、插件迁移指南。

## 版本矩阵

| 版本 | 目录 | 提交数 | 重要性 | 内容 |
|------|------|--------|--------|------|
| v0.1.0-rc.5 | `v0.1.0-rc.5/` | — | ⭐⭐⭐ | 14 篇：架构总览 + 12 模块详解 + 开发模板 |
| v0.1.0-rc.7 | `v0.1.0-rc.7/` | — | ⭐ | 首个可用 tag，与 rc.5 架构一致 |
| v0.1.1-rc.2 | `v0.1.1-rc.2/` | +207 | ⭐⭐ | 首个稳定版，增量改进 |
| v0.1.2-rc.1 | `v0.1.2-rc.1/` | +1735 | ⭐⭐⭐⭐⭐ | **大重构**：Session V2、runtime→store、Apiproxy→Remote |
| v0.1.3-alpha.2 | `v0.1.3-alpha.2/` | +644 | ⭐⭐⭐ | Settings 命名空间变更、Permission Presets |
| v0.1.5-alpha.1 | `v0.1.5-alpha.1/` | +563 | ⭐⭐⭐⭐ | **Sidebar 重写**、Session V3、Electron 桌面 |

> 版本变更详情（0.1.1→0.1.5 完整提交级记录）参见 [dsh-015-notes.md](../dsh-015-notes.md)。

## 关键 Breaking Changes 速查

| 版本跳跃 | 影响级别 | 核心变更 |
|----------|---------|----------|
| rc.7 → 0.1.1 | 🟢 低 | 无 breaking changes |
| 0.1.1 → 0.1.2 | 🔴 高 | client/runtime→store、Session V2、Apiproxy→Remote、CallId→ToolCallId |
| 0.1.2 → 0.1.3 | 🟡 中 | settingsNamespace()→字符串、Permission Presets |
| 0.1.3 → 0.1.5 | 🔴 高 | Session V3 surface node、Sidebar 完全重写、Inbox 投影重构 |

## 推荐阅读路径

### 按版本递进（推荐）

1. **v0.1.0-rc.5** — 架构基础（12 篇模块详解）
2. **v0.1.2-rc.1** — 第一次大重构（Breaking Changes 最多）
3. **v0.1.5-alpha.1** — 第二次大重构（Sidebar + Session V3）

### 按角色

| 角色 | 推荐路径 |
|------|----------|
| **新插件开发者** | rc.5 架构总览 → 0.1.2 CHANGELOG → 0.1.5 CHANGELOG |
| **已有插件迁移** | 对应版本 CHANGELOG 的"插件迁移指南"小节 |
| **架构研究者** | rc.5 全部 14 篇 → dsh-015-notes.md |

## v0.1.0-rc.5 详细目录

| # | 文件 | 主题 | 核心概念 |
|---|------|------|----------|
| 01 | [01-vendor-cordis.md](v0.1.0-rc.5/01-vendor-cordis.md) | Cordis 框架层 | Service、Context、生命周期 |
| 02 | [02-core-product.md](v0.1.0-rc.5/02-core-product.md) | Core 产品主干 | 产品架构、核心流程 |
| 03 | [03-shell-capabilities.md](v0.1.0-rc.5/03-shell-capabilities.md) | Shell 能力缝 | shell 与 core 的衔接 |
| 04 | [04-llm-typer.md](v0.1.0-rc.5/04-llm-typer.md) | LLM 与 Typer | LLM 集成、类型系统 |
| 05 | [05-execution-world.md](v0.1.0-rc.5/05-execution-world.md) | 执行世界 | 会话管理、执行环境 |
| 06 | [06-memory.md](v0.1.0-rc.5/06-memory.md) | 记忆系统 | 记忆存储、检索、L1-L3 架构 |
| 07 | [07-multi-agent.md](v0.1.0-rc.5/07-multi-agent.md) | 多智能体 | AgentTeams、子代理、协作 |
| 08 | [08-human-agent-governance.md](v0.1.0-rc.5/08-human-agent-governance.md) | 人机协作与治理 | 治理框架、安全机制 |
| 09 | [09-cli-boot.md](v0.1.0-rc.5/09-cli-boot.md) | CLI 与 Boot | 命令行接口、启动流程 |
| 10 | [10-gui-frontend-backend.md](v0.1.0-rc.5/10-gui-frontend-backend.md) | GUI 前后端 | Web UI 架构、前后端通信 |
| 11 | [11-protocol-sdk.md](v0.1.0-rc.5/11-protocol-sdk.md) | 协议与 SDK | 通信协议、SDK 设计 |
| 12 | [12-engineering.md](v0.1.0-rc.5/12-engineering.md) | 工程体系 | 构建、测试、发布 |
| — | [architecture-overview.md](v0.1.0-rc.5/architecture-overview.md) | 架构总览 | 全局架构图、模块关系 |
| — | [module-template.md](v0.1.0-rc.5/module-template.md) | 模块详解模板 | 文章编写规范 |

## 原始来源

- 源码快照: `deepseek-harness/ v0.1.0-rc.5`
- Git tags: `dsh-v0.1.0-rc.7` ~ `dsh-v0.1.5-alpha.1`
- 原始文章: `详解/ 第01-12篇`
- 项目文档: `项目架构总览.md`、`模块详解模板.md`
