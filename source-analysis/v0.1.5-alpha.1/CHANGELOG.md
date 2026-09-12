# v0.1.5-alpha.1 版本分析

> 基于 tag `dsh-v0.1.5-alpha.1`，从 v0.1.3-alpha.2 经 563 commits 演进
> Session V3 + Sidebar 完全重写 + Electron 桌面打包

## 概述

v0.1.5 是 DSH 的第二次重大架构升级。Session 格式从 V2 升级到 V3（surface node 架构），侧边栏完全重写（新增 dockkit 停靠引擎、文件树、右栏、文件预览），并引入 Electron 桌面打包。**这是插件开发者的又一次重大适配周期。**

## Breaking Changes

### 1. Session V3 — surface node 架构

| 维度 | V2 (0.1.2/0.1.3) | V3 (0.1.5) |
|------|-------------------|-----------|
| 系统提示词 | 普通消息 | `surface node zero` |
| 格式 | projection-based | surface node + surface op |
| 迁移 | V1→V2 | V2→V3（需先 V1→V2→V3） |
| 持久化 | handle-based | V3 writer |

- 系统提示词不再是普通消息，而是 `surface node zero`
- 任何读取 session 数据的旧代码都需要通过 V2→V3 迁移管线
- 旧 V1 session 需要经过 V1→V2→V3 两步迁移
- 新增 `compaction` 能力（`packages/compaction`）

### 2. Sidebar 完全重写

**新增客户端包：**

| 包 | 说明 |
|----|------|
| `ui-dockkit` | 可逆停靠引擎 + 指针交互 |
| `ui-sidebar-files` | 懒加载工作区文件树 |
| `ui-sidebar-right` | 响应式右栏 |
| `ui-sidebar-textpreview` | 分页文件预览 + 保留阅读状态 |
| `resources` | 资源管理 |

**Sidebar Slot 契约（5 个 slot）：**

```typescript
'sidebar.brand.mark'         → single   // 品牌标志
'sidebar.brand.name'         → single   // 品牌名称
'sidebar.workspaces'         → single   // 工作区浏览器
'sidebar.settings'           → single   // 设置入口
'sidebar.footer.action'      → list     // 页脚操作（接收 wide: boolean）
```

**关键约束：**
- 外壳只管理几何（折叠状态机、品牌行、New Session）
- 数据内容由填充 slot 的插件自行管理
- 可替换品牌但无法替换导航控件
- Props 只有 `wide: boolean` + `expandSidebar()` 穿过外壳边界

### 3. 消息轨（TurnNavigator）

- 硬编码在 `ChatView` 中，**无 slot 暴露**
- 数据来源：`ChatSnapshot.navigation` + `turnOutline`
- 与 Sidebar 完全独立（不同渲染树）
- 插件如需自定义消息轨，需通过 View Tab 或扩展 ChatSnapshot

### 4. Inbox 投影重构

| 0.1.3 | 0.1.5 |
|-------|-------|
| `InboxService`（独立服务） | agent-loop 内部投影 |
| `ctx.inbox` 可用 | 旧路径不可用 |

### 5. Token Meter API 扩展

`ctx.tokenMeter` 从 3 方法扩展到 **7 方法**，引入结构化 `TokenMeasurement`：

| 方法 | 0.1.3 | 0.1.5 |
|------|-------|-------|
| `estimateMessage()` | ✅ | ✅（保留） |
| `measure(session, requestHeader?)` | — | 🆕（核心新增） |
| `estimateContentBlock()` | — | 🆕 |
| `estimateToolResult()` | — | 🆕 |

**TokenMeasurement 结构化字段**：
- `logRevision`：已消费事件数
- `baseline`：基线类型（`usage` / `estimated`）
- `surfaceDeltaTokens`：surface 相对基线的 token 差值
- `totalTokens`：请求+响应总压力
- `surfaceTokens`：Surface 路由定价的 token 总数
- `nodes`：按位置排列的 `TokenSurfaceNode[]`（含路由定价 + 启发式双精度）

> **破坏性**：**无**。新方法有默认实现，旧 API 保留。

### 6. Permission Presets 统一服务

v0.1.5 加固了 v0.1.3 引入的 `dsh-permission-presets`：

| 维度 | ≤ 0.1.2 | ≥ 0.1.3（0.1.5 加固） |
|------|---------|----------------------|
| 沙箱控制 | `setSandboxMode()` | `ctx.permissionPresets.set()` |
| 审批策略 | `setApprovalPolicy()` | `ctx.permissionPresets.set()`（绑定在 preset 内） |
| 当前状态 | 分别查询 | `current(session)` 返回预设名 |
| 预设表 | 无 | `workspace-write` / `danger-full-access` |

**`permission/preset` 事件**：预设切换写入 log-only 事件，不出现在模型 transcript。

> **破坏性**：**部分**。直接调用 `setSandboxMode` / `setApprovalPolicy` 的插件需迁移到 `ctx.permissionPresets`。

### 7. LLM Adapter 扩展

`LlmAdapter` 从 3 方法扩展到 **7 方法**：

| 方法 | 0.1.3 | 0.1.5 | 说明 |
|------|-------|-------|------|
| `stream()` | ✅ | ✅ | 保留 |
| `resolveModel()` | ✅ | ✅ | 保留 |
| `listModels()` | ✅ | ✅ | 保留 |
| `providerInfo()` | — | 🆕 | 提供商品牌信息 |
| `providerRetryPolicy()` | — | 🆕 | 提供商级重试策略 |
| `imageRequestPricing()` | — | 🆕 | 图像计费信息 |
| `prepareCall()` | — | 🆕 | **HMR 安全隔离** |

**`ReplayEnvelope` 结构化**：`replayState: unknown` → `ReplayEnvelope { response, blocks }`。

> **破坏性**：**无**。新增方法有默认实现，不强制。

### 8. 子代理目录与模型路由

v0.1.5 新增子代理两大能力：

| 能力 | 说明 |
|------|------|
| 子代理目录 | `subagent/catalog` 事件 + 投影，支持 `listChildren()` / `listDescendants()` |
| 模型路由 | `AgentOptions`（provider/model/reasoningEffort） + 路由预检 `preflightChildLlmRoute` |

## 新增能力

### Electron 桌面打包

- Windows 构建签名
- Mac 签名公证
- IPC 性能优化
- 自动更新配置

### Native 系统层

- 预构建 Node-API flock 支持
- 包族重命名为 `node-addon-system`
- Landlock workspace 迁移到 `native/system`

### Web/UI 更新

- Stats 条 → icon pills + stat dialogs
- 编辑器菜单 portal over sidebar
- 响应式右栏 + 宽度让步
- 斜杠命令本地化
- Think 摘要粗体清理
- 模型切换通知
- 助手流帧

### 其他

- CLI 从内置模板创建 profile
- Skills 浏览器 GIF 录制（Playwright video）
- 会话冻结性能优化（WeakSet provenance 缓存）

## 架构特征

| 维度 | 0.1.3-alpha.2 | 0.1.5-alpha.1 |
|------|--------------|--------------|
| Session 格式 | V2+ | V3 (surface node) |
| 持久化 | handle-based | V3 writer |
| Client 架构 | 控制器+Sidebar | 控制器+完整 Sidebar+Dockkit |
| API | Remote | Remote (+ Typert 装饰器) |
| Token Meter | 启发式估算 | 结构化 TokenMeasurement |
| Permission | 独立 sandbox/approval | 统一 Permission Presets |
| Inbox | InboxService 独立 | agent-loop 投影 |
| LLM Adapter | 3 方法 | 7 方法 (+prepareCall) |
| 子代理 | 基础编排 | 目录 + 模型路由 |
| Native | 子进程完善 | Node-API flock |
| 桌面 | 无 | Electron+签名+自动更新 |
| UI | 基础+ui-chat | Sidebar 重写+文件树+停靠 |

## 插件迁移指南

### 必须做

1. **Session 数据读取**：适配 V3 surface node 格式（系统提示词 → surface node zero）
2. **Inbox 服务**：如果使用 `ctx.inbox`，改为通过 `Agent.inbox` 投影访问
3. **权限控制**：如果直接调用 `setSandboxMode` / `setApprovalPolicy`，改为 `ctx.permissionPresets.set()`
4. **Sidebar 插件**：检查是否与新的 dockkit 停靠引擎冲突，适配 5 个 slot 契约

### 建议做

1. **Token 计量**：使用 `ctx.tokenMeter.measure()` 替代启发式估算，获取更精确计费
2. **LLM Adapter**：如果编写新适配器，实现 `providerInfo()`、`prepareCall()` 等新方法
3. **Sidebar Slot**：使用新的 5 个 slot 注册系统，不使用旧的 DOM 锚点
4. 使用新的 Sidebar slot 系统（`sidebar.footer.action` 等）
5. 适配 `ui-chat` 的 ChatView slot（如需扩展聊天界面）
6. 评估 Electron 桌面打包对插件的影响
7. 使用 `listChildren()` 枚举子代理状态（如需要）

### 兼容性说明

- V3 迁移是自动的（内置 V2→V3 迁移管线），但插件如直接读取 session 数据需手动适配
- Sidebar 重写后，旧的 Sidebar 插件可能需要重新适配 slot 契约
- 消息轨（TurnNavigator）无 slot，插件无法直接替换
- Token Meter 新增方法不破坏旧代码，`measure()` 提供更高精度计量
- Permission Presets 加固了预设切换一致性，`custom` 状态为保留字
- LLM Adapter 新增 4 方法有默认实现，现有适配器无需立即实现
- 子代理目录和模型路由为新增能力，不破坏现有代码

### 深度文档

| 主题 | 引导指南 | 技术细节 |
|------|---------|---------|
| Token Meter | [v0.1.5-migration.md#第二章](../../plugin-framework/v0.1.5-migration.md#二token-meter-api-扩展) | [plugin-migration-guide.md#第一节](../v0.1.5-rc.2/plugin-migration-guide.md#一token-meter-api-深度分析) |
| Permission Presets | [v0.1.5-migration.md#第三章](../../plugin-framework/v0.1.5-migration.md#三permission-presets-统一服务) | [plugin-migration-guide.md#第二节](../v0.1.5-rc.2/plugin-migration-guide.md#二permission-presets-深度分析) |
| Inbox 投影 | [v0.1.5-migration.md#第四章](../../plugin-framework/v0.1.5-migration.md#四inbox-投影重构) | [plugin-migration-guide.md#第三节](../v0.1.5-rc.2/plugin-migration-guide.md#三inbox-投影重构深度分析) |
| LLM Adapter | [v0.1.5-migration.md#第五章](../../plugin-framework/v0.1.5-migration.md#五llm-adapter-扩展) | [plugin-migration-guide.md#第四节](../v0.1.5-rc.2/plugin-migration-guide.md#四llm-adapter-深度分析) |

## 版本演进

```
v0.1.3-alpha.2 → v0.1.5-alpha.1 (本文件)
                     ↓
              未来 rc 版本（待发布）
```
