# DSH社区RFC现状分析报告

> 数据来源：元讨论验证集 `meta-discussion-verified.json`，去重后 **57** 篇标准契约RFC

> 时间跨度：2026-08-13 ~ 2026-09-07

> 总讨论活跃度：**141** 条评论 | **1596** 总得分


## 一、RFC系列图谱

社区RFC运动呈现明显的系列化特征——同一规范被拆分为多个独立分册迭代。

| 系列 | 篇数 | 总评论 | 活跃度 | 状态评估 |
|------|------|--------|--------|----------|
| 独立RFC | 16 | 42 | 🔥 42条评论 | 活跃 |
| 任务演化系列 | 1 | 22 | 🔥 22条评论 | 活跃 |
| CHA2A_身份认证系列 | 3 | 21 | 🔥 21条评论 | 活跃 |
| 互操作标准系列 | 3 | 10 | 🔥 10条评论 | 活跃 |
| 发布生命周期系列 | 5 | 10 | 🔥 10条评论 | 活跃 |
| Agent后台服务系列 | 1 | 10 | 🔥 10条评论 | 活跃 |
| 确定性执行边界系列 | 1 | 9 | 🔥 9条评论 | 活跃 |
| 协作契约系列 | 1 | 5 | 📋 5条评论 | 低互动 |
| 会话持久化系列 | 1 | 3 | 📋 3条评论 | 低互动 |
| 预设安装协议系列 | 1 | 2 | ❄️ 2条评论 | 低互动 |
| 协议层挂载系列 | 2 | 1 | ❄️ 1条评论 | 冷启动 |
| 资源渲染系列 | 1 | 1 | ❄️ 1条评论 | 冷启动 |
| ASR/TTS能力缝系列 | 1 | 1 | ❄️ 1条评论 | 冷启动 |
| 子代理策略系列 | 1 | 1 | ❄️ 1条评论 | 冷启动 |
| 429恢复契约系列 | 1 | 1 | ❄️ 1条评论 | 冷启动 |
| UI主题注册系列 | 1 | 1 | ❄️ 1条评论 | 冷启动 |
| 文件观察契约系列 | 1 | 1 | ❄️ 1条评论 | 冷启动 |
| Typert协议识别系列 | 2 | 0 | ❄️ 0条评论 | 未启动 |
| 引擎字段系列 | 1 | 0 | ❄️ 0条评论 | 未启动 |
| Seam稳定性系列 | 1 | 0 | ❄️ 0条评论 | 未启动 |
| Dragon-engine系列 | 1 | 0 | ❄️ 0条评论 | 未启动 |
| FIDO2审批系列 | 1 | 0 | ❄️ 0条评论 | 未启动 |
| SDK Wire系列 | 1 | 0 | ❄️ 0条评论 | 未启动 |
| LLM幻觉对策系列 | 1 | 0 | ❄️ 0条评论 | 未启动 |
| Trust Layer系列 | 1 | 0 | ❄️ 0条评论 | 未启动 |
| MCP工作区配置系列 | 1 | 0 | ❄️ 0条评论 | 未启动 |
| ACP模型系列 | 1 | 0 | ❄️ 0条评论 | 未启动 |
| 命令命名空间系列 | 1 | 0 | ❄️ 0条评论 | 未启动 |
| 评测隔离系列 | 1 | 0 | ❄️ 0条评论 | 未启动 |
| 跨对话引用系列 | 1 | 0 | ❄️ 0条评论 | 未启动 |
| 权限披露系列 | 1 | 0 | ❄️ 0条评论 | 未启动 |
| 拖拽MIME契约系列 | 1 | 0 | ❄️ 0条评论 | 未启动 |

## 二、活跃RFC排行 Top 15

| # | 标题 | 评论数 | 日期 | 系列 |
|---|------|--------|------|------|
| #2269 | [插件生态] 提案：市场识别层插件开发规范 STANDARD.md——仓库怎么写才能被市场正确收录/安装（欢迎社区讨论） | 29 | 2026-08-16 | 独立RFC |
| #2454 | Proposal: task-conditioned Harness evolution with evaluable  | 22 | 2026-08-16 | 任务演化系列 |
| #3192 | [提案讨论] CHA2A：智能体生态身份与来源认证规范（draft）——四层标识 × 分层签名 × 认证等级 | 21 | 2026-08-18 | CHA2A_身份认证系列 |
| #2884 | RFC: Agent as a 24×7 Background Service — Key Pool, Sandbox  | 10 | 2026-08-17 | Agent后台服务系列 |
| #5286 | [Ecosystem] Should deterministic execution boundaries be a f | 9 | 2026-09-01 | 确定性执行边界系列 |
| #2714 | [RFC] dsh 社区插件互操作标准 v0.15 —— Manifest、Capability 协商与事件契约（社区讨 | 6 | 2026-08-17 | 互操作标准系列 |
| #4909 | [Architecture] Lifecycle handoff contract is missing — paren | 6 | 2026-08-28 | 发布生命周期系列 |
| #3400 | [建议] 任务卡在下载/安装时无法停止：不可中断的工具使 cancel 无法生效（协作式契约无强制力） [Suggest | 5 | 2026-08-19 | 协作契约系列 |
| #2717 | 建议：提供官方插件更新生命周期与“重启扩展服务”能力 | 4 | 2026-08-17 | 发布生命周期系列 |
| #2276 | [RFC] Ecosystem primitives: plugin discoverability, an optio | 4 | 2026-08-16 | 独立RFC |
| #3937 | RFC: Local-first work continuity layer as a SessionPersisten | 3 | 2026-08-22 | 会话持久化系列 |
| #5565 | MCP client rejects content-only tool results (missing struct | 3 | 2026-09-03 | 互操作标准系列 |
| #5230 | v0.1.2-alpha.1 插件生态反馈：恳请保留 subagent 扩展点（plugin dev 视角） | 3 | 2026-08-31 | 独立RFC |
| #2698 | 请确认 dsh preset add URL / 预设一键安装协议契约 | 2 | 2026-08-17 | 预设安装协议系列 |
| #3665 | dsh-capmark-gate: hold an agent to a declared capability man | 2 | 2026-08-20 | 独立RFC |

## 三、高互动RFC深度分析（≥10条评论）

### #2269 — [插件生态] 提案：市场识别层插件开发规范 STANDARD.md——仓库怎么写才能被市场正确收录/安装（欢迎社区讨论）

- **系列**: 独立RFC

- **评论数**: 29 🔥活跃

- **得分**: 56 | **正文长度**: 1786字符

- **日期**: 2026-08-16 | **类别**: Ideas

- **状态**: 已获多轮讨论，持续推进


### #2454 — Proposal: task-conditioned Harness evolution with evaluable Plugin Packs

- **系列**: 任务演化系列

- **评论数**: 22 🔥活跃

- **得分**: 26 | **正文长度**: 19334字符

- **日期**: 2026-08-16 | **类别**: Ideas

- **状态**: 已获多轮讨论，持续推进


### #3192 — [提案讨论] CHA2A：智能体生态身份与来源认证规范（draft）——四层标识 × 分层签名 × 认证等级

- **系列**: CHA2A_身份认证系列

- **评论数**: 21 🔥活跃

- **得分**: 59 | **正文长度**: 11810字符

- **日期**: 2026-08-18 | **类别**: Ideas

- **状态**: 已获多轮讨论，持续推进


### #2884 — RFC: Agent as a 24×7 Background Service — Key Pool, Sandbox Awareness, Self-Evolution

- **系列**: Agent后台服务系列

- **评论数**: 10 📋推进中

- **得分**: 24 | **正文长度**: 10190字符

- **日期**: 2026-08-17 | **类别**: Ideas

- **状态**: 已启动讨论，有待深化


## 四、未启动RFC清单（零评论，pure draft）

共 **31** 篇RFC尚未引发任何讨论：

| # | 标题 | 系列 | 得分 |
|---|------|------|------|
| #3592 | [提案讨论] CHA2A · 系列分册：验证互信——机器可读测试证据（Evidence Record） | CHA2A_身份认证系列 | 46 |
| #5598 | # RFC: CCP 协议能力发现层 — 让 DSH Agent 通过信任向量搜索、评估、调用外部能力 | 独立RFC | 43 |
| #3622 | [提案讨论] CHA2A · 系列分册：智能体身份协议（Agent Identity） | CHA2A_身份认证系列 | 41 |
| #5327 | Proposal: URL-loadable DSH Bundles via a stable subscription | 独立RFC | 32 |
| #5040 | [RFC] 解决文件版本令牌因“仅查看”而误报冲突的问题——支持基于内容 hash 的可选策略 | 独立RFC | 32 |
| #2088 | Proposal: add real-host release lifecycle validation to the  | 发布生命周期系列 | 32 |
| #5695 | Proposal: recognize official Typert protocol metadata in thi | Typert协议识别系列 | 28 |
| #2259 | [Proposal] propagate the repo-declared engines field into pu | 引擎字段系列 | 28 |
| #5618 | Proposal: recognize the published Typert protocol in externa | Typert协议识别系列 | 27 |
| #288 | Seam-stability annotations for early adopters | Seam稳定性系列 | 27 |
| #4543 | Proposal: first-class bundle-to-bundle dependencies (in-box  | 独立RFC | 24 |
| #2486 | RFC: verified upstream patch queue — 42 cherry-pick-ready fi | 发布生命周期系列 | 24 |
| #4888 | RFC: dragon-engine V2.5 asset mirror + 4 Cordis packages | Dragon-engine系列 | 22 |
| #3474 | # 提议：把"治理护栏"做成 Harness 的一层可选插件 — PDSS 实践建议与试用邀请 | 独立RFC | 21 |
| #2222 | 人机边界不可伪造：DSH 审批的 FIDO2 带外门 + 策略格立法 / Unforgeable human appro | FIDO2审批系列 | 20 |
| #3061 | SDK wire: support embedded-host interactions and causal prom | SDK Wire系列 | 19 |
| #5875 | [RFC] Native Headless & Container Support: --no-auth, config | 独立RFC | 18 |
| #4128 | [Offer] Protocol-layer mount (optional) | 协议层挂载系列 | 18 |
| #1403 | 多插件架构会放大 LLM 幻觉吗？——拆解三条放大路径与对策 | LLM幻觉对策系列 | 18 |
| #1365 | DSH Trust Layer: four privacy-minimal observability plugins | Trust Layer系列 | 18 |
| #941 | [RFC] Workspace-scoped configuration and runtime state for M | MCP工作区配置系列 | 18 |
| #5498 | optional verifiable "birth certificate" for DSH plugin relea | 发布生命周期系列 | 17 |
| #3314 | Standard ACP session model selection from the adapter catalo | ACP模型系列 | 17 |
| #1101 | Idea: plugin-namespaced slash commands (/plugin:command) | 命令命名空间系列 | 17 |
| #5192 | Expose atomic Session and conversation-view navigation for W | 独立RFC | 16 |
| #2047 | RFC: Kernel X-Ray as a foundation for automatic AMDGPU kerne | 独立RFC | 16 |
| #1604 | DeepSeek Harness with 1,000 MCP tools: should every schema s | 独立RFC | 16 |
| #492 | [RFC] 增加评测隔离模式：当前 workspace 缺少读取隔离能力 | 评测隔离系列 | 16 |
| #383 | [RFC] 跨对话引用：先挂现成工具，不要为 GUI 开基座 | 跨对话引用系列 | 16 |
| #5636 | How should DeepSeek Harness plugins disclose and manage perm | 权限披露系列 | 15 |
| #2580 | 提议:把插件文件拖入对话的拖拽 MIME(application/x-dsh-path)收为壳级契约 | 拖拽MIME契约系列 | 15 |

## 五、冷启动RFC（1-2条评论）

共 **13** 篇RFC仅获1-2条评论，热度待提升：

| # | 标题 | 评论 | 系列 |
|---|------|------|------|
| #5098 | [Proposal] Read-only protocol-layer mount of TDCA governance | 1 | 协议层挂载系列 |
| #2910 | RFC：统一资源渲染层 —— 可插拔的富输出渲染器 seam（对标 Jupyter Notebook） | 1 | 资源渲染系列 |
| #2431 | Proposal: standard ASR / TTS / avatar-media capability seams | 1 | ASR/TTS能力缝系列 |
| #4001 | [Contribution] examples: add computer-use MCP interoperabili | 1 | 互操作标准系列 |
| #4818 | 三方插件生态实践三件套：QQ 渠道 PR 栈 + 渠道视图参考实现 + RFC-0001 | 1 | 独立RFC |
| #2639 | [RFC] Re-resolve continuable child policy on each new activa | 1 | 子代理策略系列 |
| #5174 | [RFC] 让 Agent 以确定性的方式观察 DSH Runtime | 1 | 独立RFC |
| #3852 | RFC: 429 恢复是一条跨五层的缺陷链——#3128 必须晚于 #892 落地 | 1 | 429恢复契约系列 |
| #3166 | ui-theme: stable third-party theme manifest and listing API | 1 | UI主题注册系列 |
| #3153 | FS_NOT_OBSERVED fires on every first edit of a bash-inspecte | 1 | 文件观察契约系列 |
| #2698 | 请确认 dsh preset add URL / 预设一键安装协议契约 | 2 | 预设安装协议系列 |
| #3665 | dsh-capmark-gate: hold an agent to a declared capability man | 2 | 独立RFC |
| #4322 | 提案：为插件提供工作区域与唯一原生会话伴随栏 | 2 | 独立RFC |

## 六、RFC演进时间线

- **2026-08-13**: 3 篇RFC
- **2026-08-14**: 5 篇RFC
- **2026-08-15**: 2 篇RFC
- **2026-08-16**: 7 篇RFC
- **2026-08-17**: 7 篇RFC
- **2026-08-18**: 4 篇RFC
- **2026-08-19**: 2 篇RFC
- **2026-08-20**: 4 篇RFC
- **2026-08-21**: 1 篇RFC
- **2026-08-22**: 2 篇RFC
- **2026-08-23**: 1 篇RFC
- **2026-08-24**: 1 篇RFC
- **2026-08-25**: 1 篇RFC
- **2026-08-28**: 3 篇RFC
- **2026-08-29**: 1 篇RFC
- **2026-08-30**: 1 篇RFC
- **2026-08-31**: 3 篇RFC
- **2026-09-01**: 2 篇RFC
- **2026-09-03**: 2 篇RFC
- **2026-09-04**: 3 篇RFC
- **2026-09-05**: 1 篇RFC
- **2026-09-07**: 1 篇RFC

## 七、关键发现

### 1. CHA2A身份认证系列 — 最完善的规范体系

- **3** 篇RFC构成完整的身份认证规范体系

- 总互动：**21** 条评论

- 分册结构：主规范(#3192, 21评) → 身份协议(#3622, 0评) → 证据记录(#3592, 0评)

- 状态：主RFC活跃推进中，分册仍为draft


### 2. 互操作标准系列 — 持续迭代

- **3** 篇RFC

- 总互动：**10** 条评论

- 包含v0.15版本的互操作规范(#2714, 6评)

- 配套生命周期讨论(#2717, 4评)

- 状态：持续迭代中


### 3. 社区协议层挂载 — 跨生态治理尝试

- **2** 篇关于TDCA/协议层挂载的RFC

- 状态：draft阶段，互动有限


### 4. 生态基础设施类RFC群

- **4** 篇基础设施规范RFC

- 总互动：**0** 条评论

- 大部分处于draft阶段，社区有构建基础设施的明确需求


### 5. 独立RFC（无系列归属）

- **26** 篇独立RFC，各自为战

- 缺乏系列协同，社区共识难以凝聚


### 6. 活跃度分布

- 零评论(draft)：31 篇 (54%)

- 低互动(1-2评)：13 篇 (23%)

- 中等活跃(3-9评)：9 篇

- 高活跃(≥10评)：4 篇

- 活跃RFC占比仅 7%，多数规范仍处于draft阶段

