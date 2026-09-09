# dsh-std（标准预设）与 RFC 生态关系分析

> 数据来源：dsh-discussion-cache raw/ + meta-discussion-verified.json + GitHub B站视频  
> 分析时间：2026-09

## 一、概念澄清：dsh-std 是什么？

**dsh-std** 是社区对 **Standard Preset（标准预设）** 的简称，官方仓库名为 `dsh-anchored-standard`（作者 xiaobright）。

### 1.1 核心定义

DSH 内置了两种 agent preset：
- **Minimal preset** — 仅挂载 `bash` + `str_replace_editor`（2个工具）
- **Standard preset** — 挂载全部 25 个工具 + 约 30,000 字符的 schema + agent-instructions

dsh-anchored-standard 提出的**两阶段引导策略**：
1. 第一轮请求：使用 Minimal preset（上下文窗口小，~50% token 节省）
2. 从第二轮起：自动 promote 到 Standard preset 完整工具集

B站视频标题：*"dsh-std 协定核弹来袭，免维护 Adapter 保你插件长生不老永远不死！"*

### 1.2 为什么叫"协定/核弹"？

因为 Standard preset 的 `agent-instructions` 对每个工具生成了约 1,200 字符的指令，25 个工具合计约 30,000 字符。这些指令在**每个 session 的首次请求**中全部以 cache-miss 形式发出，DeepSeek V4 Flash 的 cache-miss 价格是 hit 的 50 倍。

实测数据（dsh-lean #2469）：
| 任务 | cache-miss tokens | 会话成本 |
|------|-------------------|----------|
| 默认 Standard | 8,600 ~ 11,538 | 基线 |
| leaner（关闭未调用工具） | 4,912 ~ 7,470 | -24% ~ -43% |

**dsh-std 的本质是 token 效率优化方案，而非互操作标准。**

## 二、RFC 与 dsh-std 的关系图谱

### 2.1 直接相关 RFC

| RFC # | 标题 | 关系 |
|-------|------|------|
| **#2714** | 互操作标准 v0.15 | **最核心交叉点**：引用 Standard preset 作为能力声明的事实标准 |
| **#2698** | 确认 dsh preset add URL / 预设一键安装协议 | **直接涉及**：讨论 preset 安装协议标准 |
| **#2269** | 插件开发规范 STANDARD.md | **同词源**：使用"STANDARD"命名，讨论插件仓库如何写才能被市场收录 |
| **#2276** | Ecosystem primitives: discoverability + identity + sync | **间接相关**：讨论插件发现，涉及 Standard preset 的能力暴露 |
| **#2884** | Agent as 24×7 Background Service | **间接相关**：涉及 Standard preset 的 tool 注册冲突 |
| **#4909** | Lifecycle handoff contract | **间接相关**：涉及 Standard preset 的子 agent 生命周期 |

### 2.2 核心交叉：RFC #2714 与 dsh-std

RFC #2714（互操作标准 v0.15）引用了 dsh-anchored-standard 的实践：

```
来源: community#23 + community#24 (v0.1) + Draft RFC 0002/0003/0004
参考: dsh-community-fabric 中的 4 篇 Draft RFC
```

RFC #2714 主张：
- 每个插件应该有一份**静态 manifest** 声明"是谁、需要什么"
- 类似 Chrome 扩展的 manifest + 权限声明 + 统一 API
- 覆盖 3,809 个社区仓库的版本兼容问题

**dsh-anchored-standard 的做法恰恰是 RFC #2714 的"社区事实标准"实践：**
- 用 `preset/agent` 配置定义 Minimal → Standard 的引导流程
- 用 `context-gate` 行控制首请求的上下文
- 用 `@deepseek-ai/dsh-tool-*` 作为能力声明

### 2.3 间接相关 RFC

| RFC # | 关系说明 |
|-------|----------|
| **#3055** | 直接 bug：Standard preset + persistent shell 挂载冲突（"tool bash is already registered"） |
| **#1569** | 直接 bug：rc.6 Standard preset 每个 registration 与部署层冲突 |
| **#2320** | dsh-anchored-subagent 扩展：subagent 也使用 Minimal-first 引导 |
| **#3986** | Feature Request：subagent 应支持指定独立 preset |
| **#2071** | 实测：Standard preset 的 skill catalog 每请求消耗 ~28 token/skill |
| **#2469** | dsh-lean：通过禁用 Standard 中未调用工具节省 24-43% token |

## 三、关键分歧：互操作标准 vs 预设优化

### 3.1 问题域不同

```
RFC #2714（互操作标准）
├─ 跨组件：GUI vs Web UI vs TUI vs CLI 的 manifest 一致性
├─ 跨插件：3,809 个仓库的 version 兼容
├─ 跨社区：社区自治的标准 vs 官方标准
└─ 面向：插件生态

dsh-std（预设优化）
├─ 单组件：agent 首请求的 token 效率
├─ 单预设：Minimal → Standard 两阶段引导
├─ 单实例：一个 DSH 进程的上下文窗口
└─ 面向：单个 agent 的性能优化
```

**两者解决的是不同层面的问题。** RFC #2714 关注"插件之间如何协作"，dsh-std 关注"单个 agent 如何更省钱"。

### 3.2 事实冲突

| 维度 | dsh-std 的做法 | RFC #2714 的期望 |
|------|---------------|-----------------|
| 标准来源 | 社区项目 xiaobright | 社区共识（从 community#23 迭代） |
| 标准化对象 | preset 挂载配置 | 插件 manifest + capability |
| 版本化 | 依赖 DSH 版本号（rc.6/rc.7 挂载失败） | 独立于 DSH 版本的 manifest |
| 治理方式 | GitHub issue/PR | 社区自治 Draft RFC |

**RFC #2714 希望建立独立于 DSH 版本的互操作标准，但 dsh-anchored-standard 的实现强耦合于 DSH 内置 preset 的挂载机制。** rc.6/rc.7 的挂载破坏就是证据。

## 四、dsh-std 生态全景

通过 cache 搜索，识别出 5 个相关社区项目：

| 项目 | 作者 | 定位 | GitHub |
|------|------|------|--------|
| dsh-anchored-standard | xiaobright | 两阶段引导：Minimal → Standard | xiaobright/dsh-anchored-standard |
| dsh-anchored-subagent | GY-Bai | subagent 同样 Minimal-first 引导 | GY-Bai/dsh-anchored-subagent |
| dsh-adapter-feishu | AtinyFurina | 飞书 WebSocket 适配器 | AtinyFurina/dsh-adapter-feishu |
| dsh-lean | sjh9714 | 禁用未调用工具节省 token | sjh9714/dsh-lean |
| dsh-all-warmup | brunhildzhou | 全局无感预热层 | brunhildzhou/dsh-all-warmup |

### 4.1 已知的挂载 bug

| # | 标题 | 严重性 |
|---|------|--------|
| #1569 | rc.6 Standard preset 每个 registration 与部署层冲突 | **P0** — 无法创建 session |
| #3055 | Standard + persistent shell 工具名冲突 | P1 — preset 作者需手动 workround |
| #1079 | Editing preset composition 破坏新 session | P1 |
| #4542 | rc.2 symlinked preset 目录被跳过 + inspect 重复注册 | P2 |
| #4170 | Web bundle 暴露空 agent preset roster | P2 |

## 五、结论与建议

### 5.1 核心关系总结

```
                    DSH RFC 生态                     dsh-std / 预设生态
                    (互操作/治理/标准)                  (性能优化/token 效率)
                         |                                    |
    ┌────────────────────┴────────────────────┐    ┌──────────┴──────────┐
    │ RFC #2714 互操作标准 v0.15              │    │ dsh-anchored-standard │
    │ RFC #3192 CHA2A 身份认证                │    │ dsh-anchored-subagent │
    │ RFC #2454 任务演化                      │    │ dsh-lean              │
    │ RFC #2269 插件开发规范 STANDARD.md      │    │ dsh-adapter-feishu    │
    │                                         │    │ dsh-all-warmup        │
    └─────────────────────────────────────────┘    └─────────────────────┘
                         |                                    |
                    ─── 交叉点：RFC #2714 引用 Standard preset ──┘
                         |
                    ─── 事实冲突：dsh-std 强耦合 DSH 版本 ──┘
```

### 5.2 关键发现

1. **dsh-std ≠ RFC 标准**：dsh-anchored-standard 是社区性能优化方案，不是 RFC 意义上的互操作标准
2. **RFC #2714 是真正的互操作标准提案**：其 v0.15 已从 community#23 迭代，参考了 dsh-std 等实践
3. **RFC #2269 与 dsh-std 同词源**：都用了"STANDARD"命名，但 #2269 讨论插件仓库如何被市场收录，与 dsh-std 的 preset 优化无关
4. **挂载 bug 频发暴露 DSH preset 系统的不成熟**：rc.6 → rc.7 多次破坏 preset 挂载，说明底层挂载机制尚未稳定
5. **社区自发标准化 vs 官方标准**：RFC #2714 试图建立独立于 DSH 版本的互操作标准，但 dsh-std 的实践证明社区标准仍需依赖 DSH 内置能力

### 5.3 建议

- **RFC #2714 应该明确定义 Standard preset 的 manifest 格式**，使预设也能被社区标准覆盖
- **DSH 官方应发布 stable preset composition API**，避免 rc.x 版本反复破坏
- **subagent preset 独立指定**（RFC #3986）应作为高优先级 feature 纳入
- **挂载冲突的诊断信息**（RFC #3055 Ask 1）应作为 p0 bug 修复
