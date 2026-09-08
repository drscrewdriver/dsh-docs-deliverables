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

