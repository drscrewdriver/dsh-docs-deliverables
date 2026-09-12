# Long Session Loading Failure — Discussion Issues

> 来源: GitHub Discussions 长会话加载失败相关帖子，共 44 篇去重帖子（局域网API复核家族）
> 归属: `packages/session/session-projection/` — 会话投影 V8 参数上限

## 症状

长对话后 agent 无法恢复或加载时上下文缺失。错误可能提及参数限制或"参数列表过长"。

## 根因

[会话投影系统](../../official-repo/docs/subsystems/session-projection.md) 缓存对话历史以快速恢复。当累积的 `sourceEventSeqs`（前置会话事件引用）超过 V8 参数列表上限（多数引擎约 65,535 项）时，agent 创建调用以 `RangeError` 失败。这是 Node.js/V8 的固有约束，并非 dsh bug 本身，但投影系统可设计为批量或分页事件引用以避免此问题。

> **注意**：此问题与 2026-08-30 删除 SQLite 持久化后端无关。JSONL-only 迁移（commit `4553c9d957`，[Agent Note](../../official-repo/.agents/notes/implemented/simplification/2026-08-30-jsonl-only-session-persistence.zh.md)）解决的是**存储格式冗余**（SQLite 复制 JSONL 逻辑服务，增加测试矩阵），而非 V8 参数上限。

```ts type-equiv
/**
 * A batch of source event references carried in an agent creation request.
 * When the total count exceeds the V8 parameter limit (~65535), the call
 * throws a RangeError at the JS engine boundary.
 */
type SourceEventRefs = readonly SessionEventRef[]
```

## 受影响场景

- **1000+ turn** 且频繁子代理委托的会话
- 大量 [会话投影](../../official-repo/docs/subsystems/session-projection.md) 缓存检查点的会话
- [上下文压缩](../../official-repo/docs/subsystems/compaction.zh.md) 禁用或无效后

## 临时方案

1. **启用上下文压缩** — [compaction 子系统](compaction/) 通过总结旧 turn 减少会话大小。确保 `ctx.compaction` 已挂载。
2. **创建新会话** — 对于长任务，创建新会话而非在一个会话中累积 turn。
3. **调整 V8 参数**（高级）— 以 `--max-old-space-size` 和 `--stack-size` 调整运行 Node.js。不推荐用于生产。

## 修复状态

V8 参数上限是硬运行时约束。投影系统应实现事件引用的批量或流式传输。尚无合并的修复。



---


## 官方文档参考

- **子系统文档**：[`docs/subsystems/session-projection.zh.md`](../../official-repo/docs/subsystems/session-projection.zh.md)

## Problem Types by Discussion Family


## 官方文档更新记录

> 本系统无已提交 git 的官方文档变更记录（troubleshooting.zh.md 为自动生成，非官方文档，已移除）。

> 本系统共 4 种问题类型，覆盖 43 篇 bug 讨论


### 1. 会话日志损坏 (Session Log)


- **帖子数**: 40 篇

- **代表帖**: #317 — Bug&Fix: 思考时间过长后最终输出文本会导致 Web 端卡死且刷新后历史加载失败 (RangeError: Maximum call stack size exceeded)

- **描述**: ## 问题概述



在第一轮提出问题思考了五十分钟输出结果后会导致web端卡死 表现为页面无响应 刷新后页面截图如下所示:

![screenshot](https://github.com/user-attachments/assets/dee5c0ec-df07-4a42-8ddb-a29d5; 环境：

- dsh 版本：0.1.0-rc.6

- Node.js：v24.13.0

- 系统：Windows

- 使用方式：dsh web



问题：

我让 DSH 制作一个网页游戏。任务完成后，再次打开该会话时，Web 页面显示：



history unavailable f


- **相关讨论 ID**:

  #317, #370, #501, #508, #517, #534, #548, #1224, #1299, #1883

  #2258, #2358, #2365, #2473, #2598, #2653, #2977, #3071, #3142, #3269

  #3275, #3334, #3403, #3530, #3644, #3687, #3694, #3797, #4633, #5160

  #5165, #5168, #5347, #5450, #5487, #5525, #5596, #5687, #5694, #5778


---


### 2. 网络/认证 (Network/Auth)


- **帖子数**: 1 篇

- **代表帖**: #3726 — 长会话历史记录拉取失败，模型编辑无法展示

- **描述**: <img width="590" height="27" alt="image" src="https://github.com/user-attachments/assets/cc91304a-1770-43b2-b254-a2a72bba5344" />

<img width="1612" h


- **相关讨论 ID**:

  #3726


---


### 3. 角色映射异常 (Role Mapping)


- **帖子数**: 1 篇

- **代表帖**: #2725 — [BUG_REPORT] dsh_unknown_tool delta calling

- **描述**: // 中文报告在下方

# [English-Ver][BUG] Streaming tool-call loses tool name mid-stream via DeepSeek official-API route → infinite `unknown tool ""` loop → se


- **相关讨论 ID**:

  #2725


---


### 4. 其他问题 (Other)


- **帖子数**: 1 篇

- **代表帖**: #393 — 【bug】部分会话出现历史加载失败

- **描述**: 每次都要重启DSH，很不友好。能否优化。



<img width="637" height="510" alt="Screenshot 2026-08-14 at 01 04 08" src="https://github.com/user-attachments/assets/accd94b8


- **相关讨论 ID**:

  #393

---

## 增量补充 — #5886–#6442（2026-09-12）

> 本批次新增讨论中与本子系统相关的帖子。原始全量分析见 `dsh-discussion-summary/incremental-2026-09-12/增量分析报告.md`。

### 升级后历史会话无法加载　`session-history-unreadable`

- **规模**: 26 篇（正文 >500 字）

| # | 标题 | 正文 | 评论 |
|---|---|---|---|
| [#5909](https://github.com/deepseek-ai/deepseek-harness/discussions/5909) | [Bug] Broken sessions and v0→v1→v2 Migration Failure / 会话损坏及 v0→v1→v2 迁移失败 | 14290 | 12 |
| [#6151](https://github.com/deepseek-ai/deepseek-harness/discussions/6151) | 升级到 0.1.5 后，以前的一些老会话打不开了 | 697 | 7 |
| [#5911](https://github.com/deepseek-ai/deepseek-harness/discussions/5911) | 升级 0.1.2-rc.1 导致无法使用 | 639 | 4 |
| [#6252](https://github.com/deepseek-ai/deepseek-harness/discussions/6252) | [BUG]升级到0.1.5-rc.1后原有会话无法正常读取和显示，报错提示原session中缺少surfaceOp | 108153 | 3 |
| [#6311](https://github.com/deepseek-ai/deepseek-harness/discussions/6311) | [BUG] v2→v3 会话迁移对插件自定义的 message source kind 直接拒载，导致旧会话永久无法加载 | 5395 | 3 |
| [#6393](https://github.com/deepseek-ai/deepseek-harness/discussions/6393) | [ACP] session/resume restores the agent but does not replay history; loadSession is missing, so | 3467 | 3 |
| [#6010](https://github.com/deepseek-ai/deepseek-harness/discussions/6010) | [Bug] V2→V3 迁移拒绝含"中断轮次重启"的 v2 会话：turn/start N+1 does not open expected turn N（附根因与修复） | 2458 | 3 |
| [#6324](https://github.com/deepseek-ai/deepseek-harness/discussions/6324) | [dsh-acp] ACP clients cannot rebuild a session transcript: no session/load, and session/resume  | 4306 | 2 |
| [#6152](https://github.com/deepseek-ai/deepseek-harness/discussions/6152) | Empty tool calls (name/callId empty) are persisted without validation, then fail the whole sess | 3955 | 2 |
| [#6189](https://github.com/deepseek-ai/deepseek-harness/discussions/6189) | [BUG] 0.1.5-rc.1 会话历史永久无法加载:v0→v1 拒绝已发布的 v0 形状(permission/preset 带 origin) | 3411 | 2 |
| [#5978](https://github.com/deepseek-ai/deepseek-harness/discussions/5978) | [Bug] 更新到最新 master 后，部分历史会话无法加载（v0 迁移校验过度严格） | 2050 | 2 |
| [#6236](https://github.com/deepseek-ai/deepseek-harness/discussions/6236) | sessions: one non-vocabulary turn/end abort cause makes the whole session unreadable, with no i | 7571 | 1 |

其余：#6084, #6342, #6418, #5907, #6355, #6250, #6144, #6194, #6328, #5910, #6287, #6278, #6184, #6347

### 畸形 tool-call 持久化导致会话不可恢复　`malformed-toolcall`

- **规模**: 17 篇（正文 >500 字）

| # | 标题 | 正文 | 评论 |
|---|---|---|---|
| [#6059](https://github.com/deepseek-ai/deepseek-harness/discussions/6059) | [Bug] Runaway tool-call arguments consume the full output budget before validation | 4014 | 9 |
| [#5911](https://github.com/deepseek-ai/deepseek-harness/discussions/5911) | 升级 0.1.2-rc.1 导致无法使用 | 639 | 4 |
| [#6035](https://github.com/deepseek-ai/deepseek-harness/discussions/6035) | Bug: Tool call with empty name/id → Error: unknown tool "" (UNKNOWN_TOOL) | 2166 | 3 |
| [#6152](https://github.com/deepseek-ai/deepseek-harness/discussions/6152) | Empty tool calls (name/callId empty) are persisted without validation, then fail the whole sess | 3955 | 2 |
| [#6322](https://github.com/deepseek-ai/deepseek-harness/discussions/6322) | [ACP] session/new never sends available_commands_update, so ACP clients show an empty command/s | 3167 | 2 |
| [#5983](https://github.com/deepseek-ai/deepseek-harness/discussions/5983) | [Bug] Custom providers are hidden and cannot be added in web UI (`llm-pi-ai` namespace not expo | 2386 | 2 |
| [#6015](https://github.com/deepseek-ai/deepseek-harness/discussions/6015) | [Proposal] Make sandbox escalation session-aware and ignore redundant same-mode requests | 2208 | 2 |
| [#6300](https://github.com/deepseek-ai/deepseek-harness/discussions/6300) | [Bug][0.1.5-rc.1]畸形 tool-call（空 id/name）被持久化进会话日志，导致会话永久不可恢复（每次回放 400 `missing field tool_call_ | 19659 | 1 |
| [#6218](https://github.com/deepseek-ai/deepseek-harness/discussions/6218) | Bug: reasoning-only completions are reported as successful - the EMPTY_RESPONSE guard tests ord | 10638 | 1 |
| [#6406](https://github.com/deepseek-ai/deepseek-harness/discussions/6406) | [BUG] selectCompactableRange compares a real-window token budget against heuristic node prices | 5234 | 1 |
| [#6366](https://github.com/deepseek-ai/deepseek-harness/discussions/6366) | 同一提示词四次实测：简单配置任务出现 33–50 轮「无界确认」行为（DeepSeek V4.1 + DSH） | 2266 | 1 |
| [#5910](https://github.com/deepseek-ai/deepseek-harness/discussions/5910) | [Bug] Commands/list Flood Pins CPU / 自持式 commands/list 洪泛占满 CPU | 14095 | 0 |

其余：#6216, #6295, #6068, #6127, #6351
