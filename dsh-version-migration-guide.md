# DSH 插件版本迁移统一指南

> **版本**：v1.0 | **创建时间**：2026-09-12T15:00:00+08:00
> **定位**：跨插件、跨版本的统一迁移参考，串联各插件专项分析报告
> **数据来源**：7 个插件仓库的实际适配经验 + DSH 源码 API 审计

---

## 一、三档版本速查

```
0.1.1- 档                0.1.2+ 档                0.1.5+ 档
(0.1.0-rc.6~0.1.1-rc.2)  (0.1.2-rc.1)             (0.1.5-rc.1~rc.2)
    │                        │                        │
    │  dsh-client-runtime    │  dsh-client-store      │  connection.rpc.intercept
    │  settingsNamespace()   │  settingsNamespace ❌   │  /api/ 前缀
    │  registerContinuable   │  startContinuable      │  dsh-sandbox 显式
    │  conversationEvents    │  uiConversation        │  sessionProjections
    └────────────────────────┴────────────────────────┴──────────────────────→
```

---

## 二、模块可用性矩阵（完整版）

### 2.1 客户端模块

| 模块 | 0.1.1- | 0.1.2+ | 0.1.5+ | 变更说明 |
|------|--------|--------|--------|----------|
| `dsh-client-runtime` | ✅ | ❌ **移除** | ❌ | 0.1.2 重命名为 client-store |
| `dsh-client-store` | ❌ | ✅ **新增** | ✅ | 替代 client-runtime |
| `dsh-client-ui-conversation` | ✅ | ✅ | ✅ | 版本号跟随主版本 |
| `dsh-client-ui-primitives` | ✅ | ✅ | ✅ | |
| `dsh-client-ui-slots` | ✅ | ✅ | ✅ | |
| `dsh-client-ui-chat` | ❌ | ✅ **新增** | ✅ | 0.1.2 新增 |
| `dsh-client-ui-renderer` | ❌ | ✅ **新增** | ✅ | 0.1.2 新增 |
| `dsh-client-ui-session` | ❌ | ✅ **新增** | ✅ | 0.1.2 新增 |
| `dsh-client-ui-commands` | ✅ | ✅ | ✅ | shuind 使用 |
| `dsh-client-ui-settings` | ✅ | ✅ | ✅ | bash-terminal 使用 |
| `dsh-client-ui-settings-plugins` | ✅ | ✅ | ✅ | shuind 使用 |
| `dsh-client-locale` | ✅ | ✅ | ✅ | |
| `dsh-client-connection` | ❌ | ❌ | ✅ **新增** | 0.1.5 RPC 基础 |
| `dsh-session` | ❌ | ✅ **新增** | ✅ | 会话类型定义 |
| `dsh-api-session-controller` | ❌ | ✅ **新增** | ✅ | 会话控制器 |
| `dsh-util-workspace-path` | ❌ | ✅ **新增** | ✅ | |

### 2.2 服务端/核心模块

| 模块 | 0.1.1- | 0.1.2+ | 0.1.5+ | 变更说明 |
|------|--------|--------|--------|----------|
| `dsh-tools` | ✅ | ✅ | ✅ | defineTool 等 |
| `dsh-settings` | ✅ | ✅(导出变) | ✅ | 0.1.2 移除 settingsNamespace |
| `dsh-shell` | ✅ | ✅ | ✅ | |
| `dsh-llm` | ✅ | ✅ | ✅ | |
| `dsh-timeout` | ✅ | ✅ | ✅ | |
| `dsh-sandbox` | ✅隐式 | ✅ | ✅**显式peerDep** | 0.1.5 升为显式 |
| `dsh-sandbox-policy` | ✅隐式 | ✅ | ✅ | |
| `dsh-session-projection` | ❌ | ❌ | ✅**新增** | 实时流 |
| `dsh-session-stats` | ❌ | ❌ | ✅**新增** | 统计聚合 |
| `dsh-token-meter` | ❌ | ❌ | ✅**新增** | Token 计量 |
| `dsh-agent` | ✅ | ✅ | ✅ | |
| `dsh-compaction` | ✅ | ✅ | ✅ | |
| `dsh-jobs` | ✅ | ✅ | ✅ | |
| `dsh-terminal` | ✅ | ✅ | ✅ | |
| `dsh-subprocess` | ✅ | ✅ | ✅ | |
| `dsh-fs` | ✅ | ✅ | ✅ | |
| `cordis` | ^4.0.1 | ^4.0.2 | ^4.0.2 | |

---

## 三、API 变更矩阵

### 3.1 0.1.1- → 0.1.2+（6 项 Breaking Change）

| # | 变更项 | 旧 API | 新 API | 影响范围 | 修复难度 |
|---|--------|--------|--------|----------|----------|
| 1 | 客户端 Store | `dsh-client-runtime` | `dsh-client-store` | 所有客户端插件 | 🟢 1-2 处 import |
| 2 | Settings 命名空间 | `settingsNamespace()` 包装 | 直接传字符串 | 设置面板插件 | 🟢 1 处替换 |
| 3 | 子代理创建 | `registerContinuableSetup()` | `startContinuable()` | 子代理插件 | 🟢 1 处替换 |
| 4 | 客户端事件 | `conversationEvents` | `uiConversation` | 对话事件监听 | 🟢 1 处替换 |
| 5 | inject 列表 | 2 项 | +3 项(conversation,remote,remote.session) | 所有客户端插件 | 🟡 1 处 package.json |
| 6 | 新增包 | — | +6 个客户端包 | 依赖声明 | 🟡 peerDep 更新 |

### 3.2 0.1.2+ → 0.1.5+（4 项 Breaking Change）

| # | 变更项 | 旧 API | 新 API | 影响范围 | 修复难度 |
|---|--------|--------|--------|----------|----------|
| 1 | RPC 通道 | `webServer.register()` | `connection.rpc.intercept()` | RPC 通信插件 | 🟡 1-3 处替换 |
| 2 | 客户端 API 前缀 | `/endpoint` | `/api/endpoint` | HTTP 调用插件 | 🟢 1-5 处前缀 |
| 3 | sandbox 显式化 | 隐式可用 | 显式 peerDep 声明 | 沙箱插件 | 🟢 1 处 package.json |
| 4 | 会话投影 | — | 新增 sessionProjections/sessionStats | 实时流插件 | 🟡 新功能引入 |

---

## 四、插件适配难度横向对比

> 仓库地址已通过 GitHub 平台搜索核对确认（2026-09-12）。

| 插件 | 仓库 | engines.dsh | 0.1.1→0.1.2 | 0.1.2→0.1.5 | 0.1.1→0.1.5 | inject 中的客户端包 | 专项报告 |
|------|------|------------|-------------|-------------|-------------|-------------------|----------|
| dsh-bash-terminal | [MAXeaglet/dsh-bash-terminal](https://github.com/MAXeaglet/dsh-bash-terminal) | ^0.1.5-rc.1 | 🟢极低(4处) | 🟡低(4处) | 🟢低(8处) | dsh-client-store | [bash-terminal-analysis](dsh-bash-terminal-analysis.md) |
| dsh-better-display | [aa2246740/dsh-better-display](https://github.com/aa2246740/dsh-better-display) | — | 🟡中(10+处) | 🟡中(8+处) | 🟠高(20+处) | dsh-client-store(0.1.2分支) | [better-display-analysis](../reffer-dsh-plugins/dsh-better-display-analysis.md) |
| dsh-live-token-stats | [better-er/dsh-live-token-stats](https://github.com/better-er/dsh-live-token-stats) | — | 🟡中(6处) | 🟡低(3处) | 🟠高(12处) | dsh-client-runtime(0.1.2) | 见下方 §4.1 |
| dsh-agent-teams | [NanmiCoder/dsh-agent-teams](https://github.com/NanmiCoder/dsh-agent-teams) | — | 🟢极低(2处) | 🟢低(1处) | 🟢低(3处) | dsh-client-runtime→uiConversation | [agent-teams-analysis](../reffer-dsh-plugins/dsh-agent-teams-analysis.md) |
| dsh-input-traffic | [drscrewdriver/dsh-input-traffic](https://github.com/drscrewdriver/dsh-input-traffic) | `>=0.1.2-alpha.1` | ✅已适配 | ✅ | ✅ | locale + ui-conversation | — |
| dsh-thinking-levels | [drscrewdriver/dsh-thinking-levels](https://github.com/drscrewdriver/dsh-thinking-levels) | `>=0.1.2-alpha.1` | ✅已适配 | ✅ | ✅ | locale + ui-renderer + ui-slots + ui-settings | — |
| dsh-perm-gate | [drscrewdriver/dsh-perm-gate](https://github.com/drscrewdriver/dsh-perm-gate) | `>=0.1.2-alpha.1` | ✅已适配 | ⚠️需适配 | ⚠️ | locale + ui-renderer + ui-settings + ui-slots | — |
| dsh-session-guard | [drscrewdriver/dsh-session-guard](https://github.com/drscrewdriver/dsh-session-guard) | `>=0.1.0-rc.7` | ✅已适配 | ✅ | ✅ | locale + ui-settings + ui-renderer | — |
| **dsh-tidychat** | [BananaSoldier01/dsh-tidychat](https://github.com/BananaSoldier01/dsh-tidychat) | **无声明** | **❌需迁移(3处)** | ⚠️需验证 | ⚠️ | **dsh-client-runtime**(需改) | 见下方 §4.2 |
| bainianlaoyao/codex | [bainianlaoyao/dsh-codex-harness](https://github.com/bainianlaoyao/dsh-codex-harness) | — | ✅已适配 | ✅已适配 | ✅双版本 | — | — |
| shuind/codex | [shuind/dsh-codex-harness](https://github.com/shuind/dsh-codex-harness) | `>=0.1.0-rc.8` | ✅已适配 | ⚠️需修复 | 🟡中(3处) | — | — |
| apply-patch | [JohnXu22786/apply-patch](https://github.com/JohnXu22786/apply-patch) | — | ✅零依赖 | ⚠️ctx.fs | 🟡低(2处) | — | — |

**结论**：12 个插件中，仅 dsh-tidychat 需做 0.1.1→0.1.2 客户端包迁移（dsh-client-runtime → dsh-client-store，3处替换）。perm-gate 需 0.1.5 适配（permissionPresets）。

### 4.1 dsh-live-token-stats RPC 迁移专项

**核心变更**：`webServer.register` → `connection.rpc.intercept`

```diff
// 旧（0.1.2+）
- ctx.webServer.register('live-token-stats', handler);

// 新（0.1.5+）
+ ctx.connection.rpc.intercept('live-token-stats', handler);
```

**客户端调用路径变更**：
```diff
- fetch('/live-token-stats/stream')
+ fetch('/api/live-token-stats/stream')
```

**适配分支**：`feature/dsh-015-compat`（提交 `d257475`）
**涉及文件**：`rpc-channel.ts`（重写）、`LiveTokenStatsLine.tsx`、`client/index.ts`、测试

### 4.2 dsh-tidychat v0.2.10 feature 分支变更

**分支**：`feat/rail-mirror-and-dots`（upstream/main + 6 commits，PR to upstream）

**新增配置项**：

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `hideOfficialNav` | boolean | false | 接管官方右缘消息轨（DSH 0.1.2+ 隐藏原生 TurnNavigator） |
| `navSide` | enum | 'left' | 定位条贴边：left（左缘）/ right（右缘镜像） |
| `navStyle` | enum | 'bar' | 定位条样式：bar（横线）/ dot（圆点） |
| `navRing` | boolean | false | 定位条外圈：当前轮/悬停轮外描 1px 强调色 |

**接管官方消息轨实现**：
- CSS 三重锚定：`[class*="_slot"]:has(> nav[class*="_frame"])` + `[style*="--turn-natural-position"]`
- 根属性门控：`data-tidychat-hide-official-nav`，4 个调用点（启动/设置订阅/扫描兜底/卸载清理）
- 隐藏而非卸载：宿主未提供原生开关，JS 删节点会破坏 React 协调

**消息轨取数路径变更**（跨版本通用）：
- 旧：`snapshot.chat.nodes`（仅 0.1.5+）
- 新：`session.eventSource.getSnapshot().entries`（0.1.2 ~ 0.1.5 通用）
- 用户轮判定：`type === 'user/message'` + `data.source.kind === 'user'`

### 4.4 类型优化 workaround（跨版本兼容策略）

**策略**：保留旧依赖名 + 跳过类型检查 + 双回退 API，实现同一代码跨 0.1.0-rc.7 ~ 0.1.5+ 运行。

| 维度 | 做法 | 目的 |
|------|------|------|
| inject 列表 | 保留 `dsh-client-runtime`（旧包名） | 0.1.1 能解析（0.1.2+ 通过 alias 兼容） |
| tsconfig | `skipLibCheck: true` + `strict: false` | 跳过 DSH 类型声明严格检查 |
| 代码 | 多处 `as any` 强转 | 绕过 settingsCtx/surfaceOp/window 类型 |
| settings API | `installSection` / `register` 双回退 | v0.2.7+ 自动适配 0.1.0-rc.7 ~ 0.1.2-rc.1 |
| 折叠锚点 | `data-chat-turn` + `data-chat-anchor-key` | v0.2.8+ 旧版 DSH 回退解析 turn 号 |

**dsh-tidychat 的 0.1.2 适配（如需正式迁移）**：

```diff
// package.json dsh.client.inject
- ["@deepseek-ai/dsh-client-runtime", "@deepseek-ai/dsh-client-ui-settings"]
+ ["@deepseek-ai/dsh-client-store", "@deepseek-ai/dsh-client-ui-settings"]

// package.json devDependencies
- "@deepseek-ai/dsh-client-runtime": "^0.1.0-rc.7"
+ "@deepseek-ai/dsh-client-store": ">=0.1.2-alpha.1"

// src/client/index.ts
- import { defineStore } from '@deepseek-ai/dsh-client-runtime/client'
+ import { defineStore } from '@deepseek-ai/dsh-client-store/client'
```

---

## 五、迁移决策树

### 5.1 确定版本档

```
当前 DSH 版本？
├── ≤ 0.1.1-rc.2 → 0.1.1- 档
├── 0.1.2-rc.1   → 0.1.2+ 档
└── ≥ 0.1.5-rc.1 → 0.1.5+ 档
```

### 5.2 定位失败原因

```
插件加载失败？
├── Cannot find module 'dsh-client-runtime' → 需迁移到 client-store（0.1.2+）
├── settingsNamespace is not a function → 直接传字符串（0.1.2+）
├── registerContinuableSetup is not a function → 改用 startContinuable（0.1.2+）
├── webServer.register is not a function → 改用 connection.rpc.intercept（0.1.5+）
├── cannot get property webServer without inject → inject 声明不完整（0.1.5+）
├── 组件不显示 → 检查 inject 列表是否包含新包
└── TypeError/其他 → 查看专项报告
```

### 5.3 选择适配策略

```
有 compat 分支？
├── 有 → checkout compat 分支（推荐）
└── 没有 → 检查 peerDep
    ├── 覆盖当前版本 → 直接安装
    └── 不覆盖 → 手动适配
        ├── ≤4 处 → 🟢 直接改
        ├── 5-10 处 → 🟡 建适配分支
        └── >10 处 → 🟠 评估是否升级 DSH
```

---

## 六、各插件专项报告索引

| 插件 | 报告路径 | 覆盖内容 |
|------|----------|----------|
| dsh-bash-terminal | `dsh-docs-deliverables/dsh-bash-terminal-analysis.md` | v0.2.3→0.1.2 适配、4处修复方案 |
| dsh-better-display | `reffer-dsh-plugins/dsh-better-display-analysis.md` | 版本演进时间线、compat分支、安装步骤 |
| dsh-agent-teams | `reffer-dsh-plugins/dsh-agent-teams-analysis.md` | 根因分析、2项修复方案、GitHub Issues |
| dsh-live-token-stats | 本文件 §4.1 + 场景 `DSH-0.1.5-实时流分析接口适配.md` | RPC迁移、流拦截方案 |
| bainianlaoyao/codex | 本文件 §4 | peerDep双版本声明 |
| shuind/codex | 本文件 §4 | session快照修复 |
| apply-patch | 本文件 §4 | 零依赖、ctx.fs检查 |

---

## 七、已有文件矩阵补全索引

本指南创建后，以下已有 deliverable 文件已同步补全依赖与能力接口矩阵：

| 文件 | 补全内容 | 原有内容 |
|------|----------|----------|
| `dsh-015-notes.md` §插件侧模块可用性矩阵 | 客户端16模块+服务端18模块+能力接口8项 | 原有 DSH 内部变更矩阵（session/持久化/UI） |
| `plugin-framework/distribution-strategy.md` §1.1 | 客户端依赖5模块+服务端接口6项 | 原有4行版本对照表 |
| `dsh-bash-terminal-analysis.md` §3.2 | 完整28模块三版本档矩阵 | 原有8模块对比 |
| `dsh-better-display-analysis.md` §9 | 跨版本适配难度分级 | 原有仅0.1.2 compat分析 |
| `dsh-agent-teams-analysis.md` §8-9 | 适配难度+inject变更 | 原有仅根因分析 |

---

## 八、场景文件交叉引用

| 场景 | 路径 | 定位 |
|------|------|------|
| DSH插件版本迁移矩阵 | `scenes/work/DSH插件版本迁移矩阵.md` | 记忆系统索引入口 |
| DSH插件-参考代码评估与机制选型SOP | `scenes/work/DSH插件-参考代码评估与机制选型SOP.md` | 评估方法论 |
| DSH-0.1.5-实时流分析接口适配 | `scenes/work/DSH-0.1.5-实时流分析接口适配.md` | 0.1.5 RPC迁移细节 |

---

*本指南整合自 7 个插件仓库的实际适配经验，随 DSH 版本迭代持续更新。*
