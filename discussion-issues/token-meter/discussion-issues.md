# Performance Regression (Token Meter) — Discussion Issues

> 来源: GitHub Discussions 性能退化相关帖子，共 3 篇去重帖子（局域网API复核家族）
> 归属: `packages/core/token-meter/` — Token 计量二次方复杂度

## 症状

Token 计数随对话长度增加呈指数级变慢。

## 根因

[token 计量子系统](../../official-repo/docs/subsystems/token-meter.md) 实现使用二次时间算法进行重放测量。每次新 token 检查需扫描整个消耗日志，总复杂度随会话长度增长为 O(n^2)。

## 临时方案

启用上下文压缩以保持会话长度可控。对于长任务，定期创建新会话。

## 修复状态

尚无合并的修复。token 计量应考虑线性时间重放算法优化。



---


## 官方文档参考

- **子系统文档**：[`docs/subsystems/token-meter.zh.md`](../../official-repo/docs/subsystems/token-meter.zh.md)

## Problem Types by Discussion Family


## 官方文档更新记录

> 本系统无已提交 git 的官方文档变更记录（troubleshooting.zh.md 为自动生成，非官方文档，已移除）。

> 本系统共 1 种问题类型，覆盖 3 篇 bug 讨论


### 1. 会话日志损坏 (Session Log)


- **帖子数**: 3 篇

- **代表帖**: #238 — [性能问题] TokenMeter 在每个会话事件后重建完整快照，导致二次方级性能退化

- **描述**: - Session 每次 append 都会使快照失效：[session/index.ts (line 559)](/E:/githubProjects/deepseek-harness/packages/core/session/src/index.ts:559)

- TokenMeter 在状; **长会话（大量 `assistant/chunk`）下 TokenMeter 产生 O(n²) 退化**：每次 `session.append` 都会使 `session.events` 快照失效（`eventsSnapshot = undefined`），而 TokenMeter 的 `se


- **相关讨论 ID**:

  #238, #928, #3923


---

