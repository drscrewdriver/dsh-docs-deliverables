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

## 增量补充 — #5886–#6442（2026-09-12）

> 本批次新增讨论中与本子系统相关的帖子。原始全量分析见 `dsh-discussion-summary/incremental-2026-09-12/增量分析报告.md`。

### dsh web 启动性能退化　`web-startup-perf`

- **规模**: 14 篇（正文 >500 字）

| # | 标题 | 正文 | 评论 |
|---|---|---|---|
| [#6081](https://github.com/deepseek-ai/deepseek-harness/discussions/6081) | Web bundle should declare modules -> webServer activation dependency | 3485 | 3 |
| [#6391](https://github.com/deepseek-ai/deepseek-harness/discussions/6391) | [性能/根因] dsh web 启动 2.7s → 17s：0.1.5 的 feat: electron 打包 让 client-modules 全量重组合由 1 次变 8 次（附单文件隔离 | 8947 | 2 |
| [#5999](https://github.com/deepseek-ai/deepseek-harness/discussions/5999) | [0.1.5-alpha.1] 升级既有 profile 后 client combo 缺失新增 bundle 模块（ui-sidebar-* 404 / loaded without re | 3651 | 2 |
| [#6427](https://github.com/deepseek-ai/deepseek-harness/discussions/6427) | [Bug][性能] 0.1.5-rc.2 Web UI 空闲态主线程占用约 50%、布局约 144 次/秒（≈每帧一次），拖拽窗口 resize 明显卡顿 | 2678 | 2 |
| [#6196](https://github.com/deepseek-ai/deepseek-harness/discussions/6196) | [BUG] dsh web 启动到打印 URL 约 18s，其中约 9.3s 来自 client-modules 每次启动重复 8 次全量重建组合包 | 21748 | 1 |
| [#6415](https://github.com/deepseek-ai/deepseek-harness/discussions/6415) | [dsh] 非法 preset 配置 → cordis 无限 reload + ~2GB 内存泄漏（~20 分钟后 OOM），且完全静默 | 3430 | 1 |
| [#6180](https://github.com/deepseek-ai/deepseek-harness/discussions/6180) | 【Bug】0.1.5-rc.1 Web 客户端必然加载失败：dsh-client-ui-sidebar-right 对未随版本发布的 @deepseek-ai/dsh-client-ui-d | 3236 | 1 |
| [#5957](https://github.com/deepseek-ai/deepseek-harness/discussions/5957) | Feature Request: Official extension directory for user plugins with stable service injection | 2836 | 1 |
| [#6369](https://github.com/deepseek-ai/deepseek-harness/discussions/6369) | [性能] dsh web 启动 6-7s：client-modules bundle 组装逐字符扫描约 15MB 源码（附 CPU profile 数据） | 2394 | 1 |
| [#6374](https://github.com/deepseek-ai/deepseek-harness/discussions/6374) | [Bug] Served index.html missing Cache-Control: no-store — cached documents break boot after reb | 2161 | 1 |
| [#5910](https://github.com/deepseek-ai/deepseek-harness/discussions/5910) | [Bug] Commands/list Flood Pins CPU / 自持式 commands/list 洪泛占满 CPU | 14095 | 0 |
| [#6202](https://github.com/deepseek-ai/deepseek-harness/discussions/6202) | Fail soft on client-module registration mismatch: validate at dsh plugin add + isolate single-m | 4232 | 0 |

其余：#6128, #6346
