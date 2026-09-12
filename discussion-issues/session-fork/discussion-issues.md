# Session Fork & Inbox Inheritance — Discussion Issues

> 来源: GitHub Discussions #5886–#6442 分叉与队列继承相关帖子，共 18 篇去重帖子
> 归属: `packages/core/session` — `session.fork` seed 切割与 pending inbox 归属
> 增量批次: #5886–#6442（2026-09-12 拉取）

## 症状

- 分叉出的会话发送新消息时，**重放源会话的旧 prompt（A）**，新 prompt（B/C）永久滞留在队列不执行
- 子会话自动重跑父会话的下一条任务，且没有任何干预窗口
- 分叉子代理会话整份复制父会话日志，列举子代理目录时整读全文，长会话上导致数 GB 内存峰值

## 根因

1. **seed 切割边界**：`session.fork` 从边界 `turn/end` 向前走到下一个 `turn/start`，把两者之间**已入队未执行**的 `agent/inbox/spliced` 事件一并复制进子会话。
2. **队列归属未重置**：pending inbox 队列随分叉被继承，子会话因此持有父会话的未决输入。
3. **日志整体复制**：子代理会话复制父会话日志而非引用，目录列举时整读全文。

## 临时方案

1. 分叉后先在子会话中发送一条空操作消息消耗掉继承的队列，再执行真实任务。
2. 对长会话避免使用分叉子代理；改用新建会话 + 显式上下文传递。

## 修复状态

根因位于 `session.fork` 的 seed 切割逻辑。修复方向：fork 时显式清空 pending inbox，或在 seed 切割时排除 `agent/inbox/*` 事件族。

---

## 官方文档参考

- **事件生产者消费者**：[event-producer-consumer.zh.md](../../official-repo/docs/event-producer-consumer.zh.md) — 事件族与顺序契约
- **子系统**：[subsystems/session.zh.md](../../official-repo/docs/subsystems/session.zh.md) — 会话服务

## Problem Types by Discussion Family

> 本系统共 1 种问题类型，覆盖 18 篇讨论

### 1. 队列跨会话泄漏 (Inbox Leak on Fork)

- **帖子数**: 18 篇
- **代表帖**: #6141 — [Bug]分叉正在运行的或者发送消息但是终止运行的会话的行为和以前不一致了
- **相关讨论 ID**:

  #6022, #6141, #6147, #6150, #6197, #6244, #6245, #6262, #6277, #6295
  #6301, #6314, #6316, #6327, #6336, #6339, #6386, #6402

---
