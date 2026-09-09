# v0.1.3-alpha.2 版本分析

> 基于 tag `dsh-v0.1.3-alpha.2`，从 v0.1.2-rc.1 经 644 commits 演进

## 概述

v0.1.3 是在 0.1.2 大重构基础上的增量改进，主要变更包括 Settings 命名空间简化、Permission Presets 统一、以及多个新客户端包的引入。**注意：这是 alpha 版本，部分 API 可能在后续 rc 中变更。**

## Breaking Changes

### 1. Settings 命名空间变更

| 0.1.2 | 0.1.3 |
|-------|-------|
| `settingsNamespace('myplugin')` | 直接使用字符串 `'myplugin'` |
| `settingsNamespace()` 包装函数 | **移除** |

- `settingsNamespace()` 在 0.1.3 中不再被内部使用
- 插件应改为 `export const MY_NS = 'myplugin' as const`
- 浏览器端读取方式不变：`settingsFace.bind({ namespace: 'myplugin' })`

### 2. 客户端包新增

| 新包 | 说明 |
|------|------|
| `ui-chat` | 聊天视图（含 TurnNavigator 消息轨） |
| `ui-approval` | 审批界面 |
| `ui-schedule` | 计划调度 |
| `ui-session` | 会话管理 |
| `file-upload` | 文件上传支持 |

- `ui-chat` 是最重要的新增：包含 ChatView、TurnNavigator、ChatNodeList
- 这些包的出现意味着 UI 组件化程度提高

### 3. 移除包

| 包 | 说明 |
|----|------|
| `examples` | 示例代码包完全移除 |

## 新增能力

### Permission Presets（统一权限控制）

```typescript
// 新方式（推荐）
ctx.permissionPresets.set(session, 'workspace-write')

// 旧方式（不再推荐）
setSandboxMode(session, 'workspace-write')
setApprovalPolicy(session, 'ask')
```

- 内置预设：`workspace-write`（写+审批）和 `danger-full-access`（无审批）
- 新增 `permissions` session projection
- `/permission <preset>` 斜杠命令
- `CUSTOM_PRESET`（`'custom'`）保留用于非标准配置

### Session V2 增强

- 流式迁移阶段优化
- 一对一迁移管线
- 共享读取管线
- per-step 视图比对替代 dedup baseline

## 架构特征

| 维度 | 0.1.2-rc.1 | 0.1.3-alpha.2 |
|------|-----------|--------------|
| Session 格式 | V2 | V2+（增强） |
| Settings 命名空间 | `settingsNamespace()` | 字符串字面量 |
| 权限控制 | 分离的 sandbox + approval | Permission Presets 统一 |
| UI 组件 | 基础 | +ui-chat +ui-approval +ui-schedule |

## 插件迁移指南

### 必须做

1. **Settings 命名空间**：如果使用 `settingsNamespace()`，改为字符串字面量
2. **检查新 UI 组件冲突**：`ui-chat` 的 TurnNavigator 可能与插件自定义导航冲突

### 建议做

1. 使用 Permission Presets 替代直接设置 sandbox/approval
2. 适配 `ui-chat` 的 slot 系统（如需扩展聊天界面）

### 兼容性说明

- `settingsNamespace()` 在 0.1.3 中虽然内部不再使用，但外部调用仍可能工作（取决于是否被彻底移除）
- 建议提前迁移到字符串字面量方式，确保向前兼容

## 版本演进

```
v0.1.2-rc.1 → v0.1.3-alpha.1 → v0.1.3-alpha.2 (本文件)
                                      ↓
                               v0.1.5-alpha.1 (Sidebar 重写)
```
