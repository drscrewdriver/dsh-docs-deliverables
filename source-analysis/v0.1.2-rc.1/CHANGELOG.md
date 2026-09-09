# v0.1.2-rc.1 版本分析

> 基于 tag `dsh-v0.1.2-rc.1`，从 v0.1.1-rc.2 经 1735 commits 演进
> 这是 DSH 历史上最大的一次架构重构

## 概述

v0.1.2 是 DSH 的第一次重大架构重写。Session 格式从 V1 升级到 V2，持久化从 SQLite 切换到 projection/event-sourcing，客户端包从 `dsh-client-runtime` 重命名为 `dsh-client-store`，API 层从 Apiproxy RPC 迁移到 Remote。**几乎所有插件都需要适配。**

## Breaking Changes（插件必须适配）

### 1. 客户端包重命名

| 旧包 | 新包 | 影响 |
|------|------|------|
| `@deepseek-ai/dsh-client-runtime` | `@deepseek-ai/dsh-client-store` | **所有客户端 bundle 必须更换导入路径** |

- 包描述从 "Client core services: SlotRegistry, SessionRuntime" 变为 "React-free observable and snapshot-store contracts"
- 内部实现从 SlotRegistry 迁移到 Zustand/Immer 引擎
- 这是 dual-version 分发的根本原因

### 2. Session 格式 V2

| 维度 | V1 (0.1.1) | V2 (0.1.2) |
|------|-----------|-----------|
| 持久化 | SQLite | handle-based projection |
| 格式 | 独立消息存储 | 嵌入 assistant 流式内容 |
| 迁移 | 无需 | 内置 V1→V2 迁移管线 |

- 旧 session 数据通过迁移管线自动转换
- 插件如读取 session 数据，需适配 V2 格式

### 3. API 层：Apiproxy → Remote

| 旧 API | 新 API | 影响 |
|--------|--------|------|
| `Apiproxy RPC` | `Remote` | **所有 RPC 调用必须迁移** |
| settings RPC | `ctx.settings.installSection()` | settings 注册方式变更 |
| credentials RPC | Remote controllers | 凭证管理变更 |
| directory-picker RPC | Remote | 目录选择变更 |

### 4. Agent 接口重构

| 变更 | 说明 |
|------|------|
| `CallId` → `ToolCallId` | 全局重命名，需批量替换 |
| `AgentOptions.reasoningEffort` | 新增可选字段（向后兼容） |
| Agent 类型位置 | 从 `runtime-types.ts` 移到 `types.ts` |
| `runtime-types` 改用 `declare module` | 类型扩展方式变更 |

### 5. Settings API 变更

| 0.1.1 | 0.1.2 |
|-------|-------|
| 无 `installSection` | 新增 `ctx.settings.installSection()` |
| `ctx.settings.register()` | 保留，但推荐用 `installSection` |
| `settingsNamespace()` | 保留 |

- `installSection` 在 0.1.2 中出现 21 处引用
- 旧 `register()` 仍可用，但语义不同

## 新增能力

### AgentPreset 体系（从零创建）

- `AgentPresetRow` / `AgentPresetRoster` / `AgentPresetDocument`
- `PresetTrust` (`system` | `user`)
- Session 投影新增 `agentPreset` 状态字段
- 插件清单按 scope 分组 + 预设切换器

### Subagent 能力扩展

- 支持 Codex 和 Claude Code provider
- 浏览器控制迁移到 Remote
- 可选子模型授权
- SDK 模型路由

### Web/UI 更新

- 精确每轮 token 用量显示
- 连接恢复指示器
- Lexical 编辑器替代 textarea
- 外部语言注册
- Superellipse 圆角视觉升级

### 新增包

| 包 | 说明 |
|----|------|
| `webhook` | Webhook 支持 |

### 移除包

| 包 | 说明 |
|----|------|
| `examples` | 示例代码（移至文档） |

## 架构特征

| 维度 | 0.1.1-rc.2 | 0.1.2-rc.1 |
|------|-----------|-----------|
| Session 格式 | V1 (SQLite) | V2 (projection) |
| 持久化 | SQLite | handle-based |
| Client 架构 | 单体状态机 | 控制器分离 |
| API | Apiproxy RPC | Remote |
| 子代理 | 基础 | Codex/Claude |
| Settings | register | installSection + register |

## 插件迁移指南

### 必须做

1. **更换客户端依赖**：`dsh-client-runtime` → `dsh-client-store`
2. **替换 `CallId`**：全局搜索替换为 `ToolCallId`
3. **更新 settings 注册**：优先使用 `installSection`，回退 `register`
4. **检查 session 数据读取**：适配 V2 格式

### 建议做

1. 使用 `dsh.plugin.json` 清单文件
2. 适配 AgentPreset 体系（如使用预置功能）
3. 更新导入路径（Agent 类型从 `runtime-types` → `types`）

### 兼容性矩阵

| 插件类型 | 需要适配 | 说明 |
|----------|---------|------|
| 纯 host 逻辑 | 低 | 检查 settings API |
| 纯 client bundle | **高** | 必须更换包名 |
| 混合 host+client | **高** | 两者都需要 |
| 使用 session 数据 | **高** | V2 格式变更 |
| 使用 RPC 调用 | **高** | Remote 迁移 |

## 版本演进

```
v0.1.1-rc.2 (旧架构) ──→ v0.1.2-alpha.1 (重构开始)
                              ↓
                         v0.1.2-alpha.2 (runtime→store)
                              ↓
                         v0.1.2-rc.1 (本文件，稳定版)
                              ↓
                         v0.1.3-alpha.1 (settings 变更)
```
