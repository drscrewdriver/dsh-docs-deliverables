# dsh-bash-terminal 插件兼容性分析报告

> **分析日期**：2026-09-12
> **分析目标**：评估 dsh-bash-terminal 从 v0.2.3（DSH 0.1.0-rc.6）升级到 DSH 0.1.2-rc.1 的可行性
> **源码位置**：`E:\test\rewrite-agently\reffer-dsh-plugins\refer-dsh-bash-terminal\package\`（v0.3.15）
> **历史版本源码**：`E:\test\rewrite-agently\reffer-dsh-plugins\refer-dsh-bash-terminal-v023\package\`（v0.2.3）

---

## 一、插件基本信息

| 属性 | 值 |
|---|---|
| 包名 | `dsh-bash-terminal` |
| GitHub | `github.com/MAXeaglet/dsh-bash-terminal` |
| npm | `dsh-bash-terminal`（作者 MAXeaglet） |
| 功能 | 注册 `shell` 工具 + `terminal` 交互式 PTY，支持 PowerShell / Git Bash / WSL |
| 核心依赖 | `@deepseek-ai/schemastery`、`node-pty`（v0.3.15 新增） |

## 二、npm 版本历史

| 版本 | 发布日期 | peerDep 版本 | 关键变化 |
|---|---|---|---|
| v0.2.3 | 2026-08-13 | `^0.1.0-rc.6` | 首版，用 `dsh-client-runtime`，无 `node-pty` |
| v0.3.11 | 2026-08-14 | `^0.1.0-rc.6` | 同上 |
| v0.3.14 | 2026-08-14 | `^0.1.0-rc.6` | 同上 |
| v0.3.15 | 2026-09-11 | `^0.1.5-rc.1` | 大改：`dsh-client-runtime` → `dsh-client-store`，新增 `dsh-sandbox`、`node-pty` |

**结论**：插件最早为 DSH 0.1.0-rc.6 编写，经历了三个阶段：

```
0.1.0-rc.6 能用 → 0.1.2 架构重构 break → 0.1.5 重新适配
```

## 三、DSH 版本演进与模块变化

### 3.1 模块存在性对比（本插件直接相关）

| 模块 | 0.1.0-rc.6 | 0.1.2-rc.1 | 0.1.5-rc.1 | 本插件是否使用 |
|---|---|---|---|---|
| `@deepseek-ai/dsh-tools` | ✅ 独立包 | ✅ 独立包 | ✅ 独立包 | ✅ defineTool |
| `@deepseek-ai/dsh-settings` | ✅ 独立包 | ✅ 独立包（导出变更） | ✅ 独立包 | ✅ settings.register |
| `@deepseek-ai/dsh-shell` | ✅ 独立包 | ✅ 独立包 | ✅ 独立包 | ✅ parseExitStatus |
| `@deepseek-ai/dsh-llm` | ✅ 独立包 | ✅ 独立包 | ✅ 独立包 | ✅ HarnessError |
| `@deepseek-ai/dsh-timeout` | ✅ 独立包 | ✅ 独立包 | ✅ 独立包 | ✅ deadline/timeoutOf |
| `@deepseek-ai/dsh-sandbox` | ✅ 可用（隐式） | ✅ 可用 | ✅ 独立包（显式peerDep） | ✅ ESCALATION_TARGETS |
| `@deepseek-ai/dsh-client-runtime` | ✅ 存在 | ❌ **移除** | ❌ 不存在 | ✅ client import |
| `@deepseek-ai/dsh-client-store` | ❌ 不存在 | ✅ **新增** | ✅ 存在 | ✅ 替代 runtime |

### 3.2 完整模块可用性矩阵（跨插件参考）

> 以下为 DSH 全部 28 个模块的三版本档可用性，供评估其他插件时参考。
> 详细的跨插件对比请查阅 → [dsh-version-migration-guide.md](dsh-version-migration-guide.md)

**客户端模块**：

| 模块 | 0.1.1- | 0.1.2+ | 0.1.5+ |
|------|--------|--------|--------|
| `dsh-client-runtime` | ✅ | ❌ 移除 | ❌ |
| `dsh-client-store` | ❌ | ✅ 新增 | ✅ |
| `dsh-client-ui-conversation` | ✅ | ✅ | ✅ |
| `dsh-client-ui-primitives` | ✅ | ✅ | ✅ |
| `dsh-client-ui-slots` | ✅ | ✅ | ✅ |
| `dsh-client-ui-chat` | ❌ | ✅ 新增 | ✅ |
| `dsh-client-ui-renderer` | ❌ | ✅ 新增 | ✅ |
| `dsh-client-ui-session` | ❌ | ✅ 新增 | ✅ |
| `dsh-client-locale` | ✅ | ✅ | ✅ |
| `dsh-client-connection` | ❌ | ❌ | ✅ 新增 |
| `dsh-session` | ❌ | ✅ 新增 | ✅ |
| `dsh-api-session-controller` | ❌ | ✅ 新增 | ✅ |

**服务端模块**：

| 模块 | 0.1.1- | 0.1.2+ | 0.1.5+ |
|------|--------|--------|--------|
| `dsh-tools` | ✅ | ✅ | ✅ |
| `dsh-settings` | ✅ | ✅ | ✅ |
| `dsh-shell` | ✅ | ✅ | ✅ |
| `dsh-llm` | ✅ | ✅ | ✅ |
| `dsh-timeout` | ✅ | ✅ | ✅ |
| `dsh-sandbox` | ✅隐式 | ✅ | ✅显式 |
| `dsh-session-projection` | ❌ | ❌ | ✅ 新增 |
| `dsh-session-stats` | ❌ | ❌ | ✅ 新增 |
| `dsh-token-meter` | ❌ | ❌ | ✅ 新增 |
| `dsh-agent` | ✅ | ✅ | ✅ |
| `dsh-compaction` | ✅ | ✅ | ✅ |
| `dsh-jobs` | ✅ | ✅ | ✅ |
| `cordis` | ^4.0.1 | ^4.0.2 | ^4.0.2 |

### 3.2 Settings API 演进

| 版本 | `settingsNamespace()` | `ctx.settings.register()` | `ctx.settings.installSection()` |
|---|---|---|---|
| 0.1.0-rc.6 | ✅ 可用 | ✅ 可用 | ❌ 不存在 |
| 0.1.2-rc.1 | ❌ **被移除** | ✅ 保留 | ✅ 新增 |
| 0.1.5-rc.1 | ❌ 不存在 | ✅ 保留 | ✅ 保留 |

## 四、v0.2.3 → 0.1.2-rc.1 适配分析

### 4.1 v0.2.3 的全部 import

**Host 端（lib/index.js）：**

```js
import { defineTool, TOOL_ABORTED } from "@deepseek-ai/dsh-tools";
import { ESCALATION_TARGETS, approveEscalation, ... } from "@deepseek-ai/dsh-sandbox";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";          // ← 受影响
import { HarnessError } from "@deepseek-ai/dsh-llm";
import { parseExitStatus } from "@deepseek-ai/dsh-shell";
import { deadline, timeoutOf, ... } from "@deepseek-ai/dsh-timeout";
```

**Client 端（src/client.jsx）：**

```js
import { defineStore } from "@deepseek-ai/dsh-client-runtime/client";   // ← 受影响
```

### 4.2 逐项对照 0.1.2 Breaking Changes

| 0.1.2 变更 | v0.2.3 是否用到 | 影响 | 修复难度 |
|---|---|---|---|
| **① `settingsNamespace()` 被移除** | ✅ 用到了（1 处 import + 1 处调用） | 🔴 高 | 低（1 处替换） |
| **② `dsh-client-runtime` → `dsh-client-store`** | ✅ 用到了（1 处 import + 1 处 peerDep + 1 处 inject） | 🔴 高 | 低（3 处替换） |
| ③ `CallId` → `ToolCallId` | ❌ 未用到 | 无 | — |
| ④ Apiproxy → Remote | ❌ 未用到（不走 RPC） | 无 | — |
| ⑤ Session V2 格式 | ❌ 未用到（不读 session 数据） | 无 | — |

### 4.3 具体修复方案

#### 修复 1：`settingsNamespace()` 被移除（1 处）

**文件**：`lib/index.js`

```js
// 旧（v0.2.3）— 第 22 行 import，第 416 行调用
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
const settingsScope = ctx.settings.register(
    settingsNamespace(SETTINGS_NAMESPACE),
    z.object({ defaultShell: z.union(SHELLS.map((s) => z.const(s))).default(defaultShell) }),
    { base: { defaultShell } }
);

// 新（0.1.2 适配）— 直接传字符串命名空间
// 删除 import { settingsNamespace } from "@deepseek-ai/dsh-settings";
const settingsScope = ctx.settings.register(
    SETTINGS_NAMESPACE,   // 直接传 "bash-terminal"
    z.object({ defaultShell: z.union(SHELLS.map((s) => z.const(s))).default(defaultShell) }),
    { base: { defaultShell } }
);
```

**原理**：0.1.2 的 `ctx.settings.register()` 直接接受字符串命名空间，不再需要 `settingsNamespace()` 包装。

#### 修复 2：`dsh-client-runtime` → `dsh-client-store`（3 处）

**文件 1**：`src/client.jsx` 第 5 行

```js
// 旧
import { defineStore } from "@deepseek-ai/dsh-client-runtime/client";
// 新
import { defineStore } from "@deepseek-ai/dsh-client-store/client";
```

**文件 2**：`package.json` peerDependencies

```json
// 旧
"@deepseek-ai/dsh-client-runtime": "^0.1.0-rc.6",
// 新
"@deepseek-ai/dsh-client-store": "^0.1.2-rc.1",
```

**文件 3**：`package.json` dsh.client.inject

```json
// 旧
"inject": ["@deepseek-ai/dsh-client-runtime", ...]
// 新
"inject": ["@deepseek-ai/dsh-client-store", ...]
```

### 4.4 风险评估

| 维度 | 评估 |
|---|---|
| 改动量 | **极小** — 2 个问题，4 处文本替换 |
| 侵入性 | **低** — 不改业务逻辑，只改 import 路径和 API 调用方式 |
| 测试复杂度 | **低** — 改完验证设置面板和 shell 工具是否正常 |
| 回归风险 | **低** — 0.1.2 保留了 `ctx.settings.register()` |

## 五、v0.2.3 → v0.3.15（0.1.5）的变化对比

### 5.1 v0.2.3 vs v0.3.15 直接对比

| 变化 | v0.2.3 | v0.3.15 |
|---|---|---|
| peerDep 版本 | `^0.1.0-rc.6` | `^0.1.5-rc.1` |
| Client 包 | `dsh-client-runtime` | `dsh-client-store` |
| Settings 用法 | `settingsNamespace()` 包装 | 直接字符串 + `settingsScope.get()` |
| Sandbox | 隐式依赖 | 显式 peerDep `dsh-sandbox` |
| PTY 支持 | 无 | `node-pty` 依赖 + `terminal.js`（交互式终端） |
| cordis.patch.yml | 无 | 有（bundle 挂载声明） |
| `settings.describe()` | 不需要 | 0.1.5 动态枚举，不再有 namespace 白名单 |

### 5.2 从 0.1.2 适配版升级到 0.1.5 的增量变更

如果你已经完成了 v0.2.3 → 0.1.2 的适配（第四节），升级到 0.1.5 还需要额外处理：

| # | 变更项 | 具体操作 | 影响 |
|---|--------|----------|------|
| 1 | dsh-sandbox 显式化 | `package.json` peerDependencies 添加 `"@deepseek-ai/dsh-sandbox": "^0.1.5-rc.1"` | 🟢 1 处 |
| 2 | cordis.patch.yml | 新增 bundle 挂载声明文件 | 🟢 1 个新文件 |
| 3 | node-pty 依赖 | `npm install node-pty` + `terminal.js` 交互式终端实现 | 🟡 新功能模块 |
| 4 | settings.describe() | 0.1.5 动态枚举，需适配设置面板渲染逻辑 | 🟡 视实现复杂度 |

**推荐路径**：直接使用 v0.3.15（已是完整 0.1.5 适配版本），而非在 0.1.2 适配版上增量修改。

### 5.3 跨版本适配难度总结

| 迁移路径 | 难度 | 改动点 | 推荐策略 |
|----------|------|--------|----------|
| v0.2.3 → 0.1.2 | 🟢 **极低** | 4 处 | 手动适配（第四节方案） |
| v0.2.3 → 0.1.5 | 🟡 **低** | 8 处 | 直接用 v0.3.15 |
| 0.1.2 适配版 → 0.1.5 | 🟡 **低** | 4 处增量 | 升级到 v0.3.15 |

## 六、结论与建议

### 适配 0.1.2-rc.1

**可行性：极高。** 只需 4 处文本替换，不涉及业务逻辑变更。

### 适配 0.1.5-rc.1+

**可行性：高。** 需要额外处理 `dsh-sandbox` 显式依赖和 `node-pty` 交互式终端功能，但 v0.3.15 已经是完整的 0.1.5 适配版本，可直接使用。

### 关于 MSYS2 扩展

在适配过程中可一并加入 MSYS2 作为第 4 个终端选项，改动量约 50 行：

1. `candidateMsys2Paths()` — 检测 `C:\msys64\usr\bin\bash.exe`
2. `buildArgv()` 加 `case "msys2"`
3. `SHELL_DESCRIPTIONS` 加 MSYS2 描述
4. `confineSpawn()` 中 MSYS2 与 Git Bash 同理（unconfined）
5. `SHELLS` 数组加 `"msys2"`

---

## 八、相关资源

| 资源 | 路径 | 说明 |
|------|------|------|
| **统一迁移指南** | [dsh-version-migration-guide.md](dsh-version-migration-guide.md) | 跨插件版本迁移矩阵与决策树 |
| dsh-better-display 分析 | [dsh-better-display-analysis.md](../reffer-dsh-plugins/dsh-better-display-analysis.md) | 另一插件的 0.1.2 适配参考 |
| dsh-agent-teams 分析 | [dsh-agent-teams-analysis.md](../reffer-dsh-plugins/dsh-agent-teams-analysis.md) | 子代理 API 变更详解 |
| 版本迁移矩阵场景 | `scenes/work/DSH插件版本迁移矩阵.md` | 记忆系统索引入口 |

---

*本报告基于 DSH 0.1.2-rc.1 和 0.1.5-alpha.1 changelog、plugin-framework 兼容性指南、以及 npm 版本历史分析生成。*
