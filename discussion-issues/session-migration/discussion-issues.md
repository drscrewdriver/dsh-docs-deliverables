# Session Format Migration Failure — Discussion Issues

> 来源: GitHub Discussions #5886–#6442 会话格式迁移相关帖子，共 42 篇去重帖子
> 归属: `packages/core/session-format-v0-to-v1` / `session-format-v1-to-v2` / `session-format-v2-to-v3` — 会话日志格式迁移链
> 增量批次: #5886–#6442（2026-09-12 拉取）

## 症状

- 升级到 0.1.5-alpha.1 / 0.1.5-rc.1 后，历史会话在侧边栏显示「历史加载失败」
- 日志报 `SessionFormatUnsupportedMigrationError` 或 `source v0 artifact remains unchanged`
- 受影响会话**永久**无法打开，无产品内恢复路径

## 根因

1. **整份拒载语义**：迁移器只要遇到**一条**不合规记录，就拒绝**整份**日志。触发字段往往只是第三方插件当年写入的一个无实际用途的可选字段。
2. **版本号单独判定**：`session-format-v0-to-v1` 对任意 v0 `subagent/descriptor` 仅按 `version` 数字判定；`SUBAGENT_DESCRIPTOR_VERSION` 在 #2663（2026-08-24 合并）之前一直是 2，因此该日期之前的所有发布版写出的都是 version 2，全部被拒。
3. **轮次连续性假设**：v2→v3 迁移要求 `turn/start N+1` 开期望的 `turn N`；被用户 steer 跳过的 `turn/end`、或「中断轮次重启」场景下缺少 `legacyInterruptedTurnRestart: true` 的会话会被整体拒绝。
4. **已发布形状被拒**：0.1.5-rc.1 拒绝了**已发布过**的 v0 形状（如 `permission`/`preset` 带 `origin` 字段、`turn/end` abort cause 多一个成员），而这些形状是真实历史版本写出的。

## 临时方案

1. **降级读取**：暂时回退到迁移前的版本读取会话（不可写），或等官方补丁。
2. **保留原始日志**：在修复前**不要**让新版本重写日志——迁移失败时源文件保持不变（`source v0 artifact remains unchanged`），这是目前唯一的保命属性。

## 修复状态

根因位于会话格式迁移包。永久修复方向：迁移器改为「逐条容忍 + 显式隔离」而非整份拒载；对已发布 v0 形状做白名单而非全等校验；提供产品内恢复入口（降级读取 / 跳过不合规记录 / 导出可读副本）。

---

## 官方文档参考

- **持久化目录**：[persistence-catalog.zh.md](../../official-repo/docs/persistence-catalog.zh.md) — 会话事件与迁移版本清单
- **子系统**：[subsystems/session.zh.md](../../official-repo/docs/subsystems/session.zh.md) — 会话服务与格式版本

## Problem Types by Discussion Family

> 本系统共 2 种问题类型，覆盖 42 篇讨论

### 1. 整份日志拒载 (Whole-log Refusal)

- **帖子数**: 24 篇
- **代表帖**: #5909 — [Bug] Broken sessions and v0→v1→v2 Migration Failure / 会话损坏及 v0→v1→v2 迁移失败
- **相关讨论 ID**:

  #5909, #5978, #6010, #6045, #6048, #6128, #6137, #6144, #6162, #6189
  #6194, #6228, #6236, #6237, #6278, #6284, #6287, #6297, #6311, #6315
  #6348, #6355, #6358, #6407

---

### 2. 历史形状校验过严 (Over-strict Legacy Shape)

- **帖子数**: 29 篇
- **代表帖**: #5909 — [Bug] Broken sessions and v0→v1→v2 Migration Failure / 会话损坏及 v0→v1→v2 迁移失败
- **相关讨论 ID**:

  #5907, #5909, #5910, #5911, #5978, #5979, #6010, #6084, #6101, #6144
  #6151, #6152, #6175, #6184, #6189, #6194, #6236, #6250, #6252, #6278
  #6287, #6311, #6324, #6328, #6342, #6347, #6355, #6393, #6418

---
