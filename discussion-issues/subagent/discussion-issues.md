# Subagent Model Inheritance — Discussion Issues

> 来源: GitHub Discussions 子代理模型继承相关帖子，共 38 篇去重帖子（局域网API复核家族）
> 归属: `packages/subagent/subagent/` — 子代理模型选择继承链

## 症状

创建子代理时，即使明确要求使用不同模型，子代理仍继承父代理的模型配置。

## 根因

[subagent 子系统](../../official-repo/docs/subsystems/subagent.zh.md) 通过 `ctx.agentDefaultModel.currentSelection()` 在代理创建时解析模型选择。当父代理使用特定模型选择创建时，子代理继承相同选择，除非显式覆盖。继承链为：部署配置 → agentDefaultModel → `agents.create()` 中的显式选择。

## 临时方案

在 `agents.create()` 调用中显式传递所需模型：

```ts
agents.create({
  modelOptions: { provider: 'my-provider', model: 'my-model' },
  // ... other options
})
```

## 修复状态

当前无合并的修复。继承链应允许更细粒度的模型选择覆盖。



---


## 官方文档参考

- **子系统文档**：[`docs/subsystems/subagent.zh.md`](../../official-repo/docs/subsystems/subagent.zh.md)

## Problem Types by Discussion Family


## 官方文档更新记录

> 本系统无已提交 git 的官方文档变更记录（troubleshooting.zh.md 为自动生成，非官方文档，已移除）。

> 本系统共 6 种问题类型，覆盖 35 篇 bug 讨论


### 1. 会话日志损坏 (Session Log)


- **帖子数**: 19 篇

- **代表帖**: #117 — 子代理BUG

- **受影响系统**: openai

- **描述**: 使用第三方api时模型调用子代理会失败，llm-deepseek: no API key for provider route "deepseek-official"; store DEEPSEEK_API_KEY through the credentials service (the web M; ## 摘要

子代理（subagent）的模型路由继承自父代理的 `AgentOptions`（`dsh-subagent` 的 `resolveChildAgentOptions`），而 Web 会话里父代理的 `options.provider` 在**创建时被固化为默认模型选择**（`ag


- **相关讨论 ID**:

  #117, #455, #504, #1100, #1105, #1472, #1581, #2470, #2639, #2672

  #2904, #3377, #4065, #4077, #4124, #4125, #4473, #5266, #5442


---


### 2. 角色映射异常 (Role Mapping)


- **帖子数**: 6 篇

- **代表帖**: #1619 — tool-subagent 静默丢弃子代理路由覆盖（每调用 agentOptions）+ 两个面向仓库外（下游）插件的扩展点缺口 Subagent route override is sil

- **描述**: 中文： 在安装并实机验证一个第三方「子代理模型角色」插件（基于 settings 的每模型能力描述 + 每会话子代理模型固定，指引委派模型在每次 subagent 调用时携带 agentOptions: { provider, model }）的过程中，遇到了三个 harness 侧问题，值得记录。; - 复现步骤：
  1. 新建会话，初始 provider 为内置 `deepseek-official`。
  2. 在 Web 的 Models 选择器里把会话模型/提供商切换到自定义 provider（例如 `provider-A`）。
  3. 让父代理派发子代理（spawn / con


- **相关讨论 ID**:

  #1619, #3552, #3741, #4311, #4555, #4666


---


### 3. 子代理生命周期 (Subagent Lifecycle)


- **帖子数**: 5 篇

- **代表帖**: #1136 — Bug: 子代理（subagent / subagent_fork）在后台运行时全部 silent-fail，怀疑认证状态未继承

- **描述**: 父代理一次派发 4 个后台子代理，各自执行独立的代码审计任务（需要 `read` 文件 + LLM 推理分析）：; [DSH Feedback - Subagent Model Selection & Sandbox ((Bugs.docx](https://github.com/user-attachments/files/31068671/DSH.Feedback.-.Subagent.Model.Selec


- **相关讨论 ID**:

  #1136, #1312, #1358, #3666, #4371


---


### 4. 安装/依赖 (Install)


- **帖子数**: 2 篇

- **代表帖**: #2006 — Bug Report: Subagent 未正确继承父 Agent 的模型配置

- **描述**: 问题描述

当主 Agent 使用了非默认模型（如通过 agent-default-model 配置或运行时切换模型）时，通过 subagent / subagent_fork 工具创建的子 Agent 没有正确继承该模型配置。子 Agent 可能使用错误的默认模型，或者因 provider/mod; 问题描述

subagent 和 subagent_fork 工具在调用时只接受 description、prompt 和 run_in_background 三个参数，不提供 model 或 provider 参数供模型或用户在运行时指定子代理使用的模型。



当预设配置（agent.cor


- **相关讨论 ID**:

  #2006, #4193


---


### 5. 路径/文件操作 (Path/File)


- **帖子数**: 2 篇

- **代表帖**: #3986 — [Feature Request] Allow subagent to specify a different agent preset

- **描述**: 当前 DSH 的子代理（subagent）机制中，子代理必须继承父代理的 Agent Preset（预设）。这意味着在同一个会话内，无法让子代理以不同的预设身份运行。; 当前 DSH 的子代理（subagent）机制中，子代理必须继承父代理的 Agent Preset（预设）。这意味着在同一个会话内，无法让子代理以不同的预设身份运行。


- **相关讨论 ID**:

  #3986, #3987


---


### 6. 内存泄漏/OOM (Memory)


- **帖子数**: 1 篇

- **代表帖**: #4158 — [Bug] spawn 子代理路由两源拼接：provider 继承父会话、model 落全局默认，多 provider 下产生非法组合（UNKNOWN_MODEL）

- **描述**: spawn 子代理路由两源拼接：provider 继承父会话、model 落全局默认，多 provider 下产生非法组合（UNKNOWN_MODEL）



环境：dsh web，多 LLM provider 配置（llm-pi-ai 多 provider + 抽屉切换）



复现步骤：






- **相关讨论 ID**:

  #4158

---

## 增量补充 — #5886–#6442（2026-09-12）

> 本批次新增讨论中与本子系统相关的帖子。原始全量分析见 `dsh-discussion-summary/incremental-2026-09-12/增量分析报告.md`。

### Fork 会话继承父会话队列　`fork-inbox`

- **规模**: 18 篇（正文 >500 字）

| # | 标题 | 正文 | 评论 |
|---|---|---|---|
| [#6141](https://github.com/deepseek-ai/deepseek-harness/discussions/6141) | [Bug]分叉正在运行的或者发送消息但是终止运行的会话的行为和以前不一致了 | 725 | 9 |
| [#6314](https://github.com/deepseek-ai/deepseek-harness/discussions/6314) | [Bug][0.1.5-rc.x] Fork 出的会话发送新消息时重放源会话旧 prompt（A），新 prompt（B/C）永久滞留队列不执行 | 7276 | 3 |
| [#6197](https://github.com/deepseek-ai/deepseek-harness/discussions/6197) | [Bug] 分叉（fork）会继承父会话"已入队未执行"的消息并在子会话自动重跑，且没有任何干预窗口 | 8588 | 2 |
| [#6277](https://github.com/deepseek-ai/deepseek-harness/discussions/6277) | [Bug] session/fork inherits the source's pending inbox — a branch's first new message is answer | 11989 | 1 |
| [#6262](https://github.com/deepseek-ai/deepseek-harness/discussions/6262) | [Bug Report] session.fork 的 seed 多带一条 user prompt：turn/end 与下一个 turn/start 之间的事件被扫进子会话，子会话重跑父会话 | 5905 | 1 |
| [#6402](https://github.com/deepseek-ai/deepseek-harness/discussions/6402) | [Bug] 「在新对话中分支」会把分叉点之后的下一条用户消息带进新会话，并在新会话里重新执行它 | 4412 | 1 |
| [#6316](https://github.com/deepseek-ai/deepseek-harness/discussions/6316) | [Bug][0.1.5-rc.1] Cold session list titles seeded sessions with the workspace folder name until | 3402 | 1 |
| [#6022](https://github.com/deepseek-ai/deepseek-harness/discussions/6022) | [Bug] Forking a session inherits the parent's queued prompts — the child executes them on first | 1728 | 1 |
| [#6336](https://github.com/deepseek-ai/deepseek-harness/discussions/6336) | [Bug] Pending inbox queue is inherited by forked sessions, so stale prompts get re-sent 排队输入跨会话 | 8419 | 0 |
| [#6386](https://github.com/deepseek-ai/deepseek-harness/discussions/6386) | 【疑似bug】分叉子代理会话整份复制父会话日志，且列举子代理目录时会整读全文 —— 长会话上导致数 GB 内存峰值 | 7949 | 0 |
| [#6147](https://github.com/deepseek-ai/deepseek-harness/discussions/6147) | [Bug] Forked session inherits the parent's queued next message and runs it as a phantom turn | 6644 | 0 |
| [#6244](https://github.com/deepseek-ai/deepseek-harness/discussions/6244) | [bug] Forked session inherits the source session's queued (pending) input — the child's first n | 5924 | 0 |

其余：#6327, #6301, #6295, #6245, #6150, #6339
