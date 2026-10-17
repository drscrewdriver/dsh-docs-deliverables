# DSH v0.2.1-alpha.4 → v0.2.1-alpha.5 变更说明（更新要点）

> **数据源**: `deepseek-ai/deepseek-harness` 官方仓库（经回环 HTTP 代理拉取 tag）
> **标签对比**: `dsh-v0.2.1-alpha.4` (`86a402200d`) → `dsh-v0.2.1-alpha.5`（提交 `1517a4dbca`）
> **发布日期**: 2026-10-16 ｜ **发布 PR**: [#6327](https://github.com/deepseek-ai/deepseek-harness/pull/6327)
> **性质**: 0.2.1 线第五个 alpha，**一次「账号通知形状放宽 + PTC 指令组装回正」** 的小跨度发布，共 36 个提交（25 非 merge + 11 merge）
> **统计**: 586 files changed, +3129 / −1117（大量为版本 bump 与快照刷新）
> **结构变化**: **0 新增 / 0 删除 / 0 改名包**
> **持久化契约**: `SESSION_FORMAT_VERSION` **保持 4**；**0 条新持久化承认**
> **插件契约**: 兼容性闸门 / settings 核心 / vendor **零 diff**；slot 目录 +43/−0（**+1 槽 `conversation.input.model.label`**，无删除）；官方升级指南 **1 篇**（`v0.2.1-alpha.4/account-notification-fields`）——定义类变更集中在 **`AccountBonusNotification` 形状放宽**

---

## 一句话总结

0.2.1-alpha.5 是 rc.1 前的收尾 alpha，破坏面小但有一处**公共类型定义换代**：

- **账号通知形状放宽**（指南 `account-notification-fields`，`2dcd031a8e`/`1f312b6282`/`6ac5c103db`/`da6c16747e`）：公开类型 `AccountBonusNotification`（`DeepSeekAccount.getUnnotifiedBonuses()` 与 remote `account/getUnnotifiedBonuses` 返回）中 **`campaign`/`amount`/`currency`/`grantedAt` 降级为可选、未校验的 `JsonValue` 元数据**；通知保留 `orderId`/`message`/`expiresAt` 并**新增可选 `title`**；**空 `expiresAt` = 永不过期**；`orderId` 接受任意字符串（不再要求 UUID）；多通知层叠展示；
- **PTC 指令组装回正**（`839bd5131d refactor(tools)` + `d6adc5d9b9 fix(prompts)`）：PTC instructions **以 compose 方式拼装、不再做 prose 替换**；恢复兼容的 PTC guidance 与 SDK persona——此前依赖"宿主指令原文形状"的 prompt 侧插件应重核（行为面而非 API 面）；
- **模型标签槽**（`919aa5f400 feat(web)`）：新槽 **`conversation.input.model.label`**（provider-aware 模型标签），配套修复菜单位置/视口裁剪（`1b385d6e2a`/`c78f3fd33d`/`8953554b5e`）；
- **slash 菜单跟插件管理联动**（`6910cd6e9c fix(ui-skill)`）：plugin manager 变更后 slash 菜单即时刷新（a.4 `plugins.tab` 生态补齐）；`ba392ae0e7 docs(ui-skill)` 记录插件变更留下的 catalog 缺口；
- 工程面：desktop 发布链（无版本 COS 桶 `b8f8abc5d6`、Windows 打包默认签名 `af66022ace`、Task Scheduler 监管 runner `cfa52b0bac`、debug 发布早拒 `5e23825f15`）；sdk 缓存 E2E 重试（`c34a107428`）；web 终端发现按会话共享（`0ae278b935`）；**cordis rc.11 分段 vendor 升级计划落档**（`c0bf2ac81d docs(cordis)`，为 rc.1 vendor 正式线铺路）。

---

## 版本序列定位

```
dsh-v0.2.1-alpha.4   ← 上版（86a402200d，2026-10-15，PR #6301）
    │
    │  ←─ 本次变更（36 commits：25 非 merge + 11 merge，1 天）
    ▼
dsh-v0.2.1-alpha.5   ← 当前版（1517a4dbca，2026-10-16，PR #6327）
```

> **规模对比**：a.5 是 0.2.1 线最小 alpha——1 篇指南、1 个新槽、0 包结构变化；但 `AccountBonusNotification` 的元数据"可选 + 未校验"化是**公共 API 返回形状的放宽承诺撤回**，消费方必须做存在性收窄。

---

## Breaking Changes 与行为风险

**闸门/settings 核心/vendor/slot 删除面全零；`SESSION_FORMAT_VERSION` 保持 4。**

### 官方升级指南级 breaking

| # | 变更 | 影响对象 | 危险度 |
|---|------|----------|--------|
| 1 | **`AccountBonusNotification` 形状放宽**：`campaign/amount/currency/grantedAt` 可选且类型为 `JsonValue`（不再保证格式）；`orderId` 非 UUID 也可能出现；空 `expiresAt` 语义=永不过期 | 消费账号福利通知的插件/展示层；对旧形状做严格断言的测试与 fixture | 🔴 有必做项 |

### 非指南级观察点

| # | 变更 | 影响对象 | 危险度 |
|---|------|----------|--------|
| 2 | PTC instructions compose 化 + SDK persona/PTC guidance 回正 | 依赖宿主 prompt 原文形状的注入类插件（cci/memory 注入缝） | 🟡 有则核 |
| 3 | 新槽 `conversation.input.model.label`（+43/−0，0 删除） | 模型标签展示（机会面） | 🟢 增量 |
| 4 | slash 菜单随 plugin manager 变更刷新 | 依赖菜单缓存时序的插件 | 🟢 改善 |
| 5 | Windows 打包默认签名 / debug 发布早拒 / 无版本 COS 桶 | 自建发布链的部署 | 🟢 部署面 |

> a.1–a.4 风险表在本版仍逐条成立（尤其 a.4 `engines.dsh` 判据）。

---

## 阅读路径

- 插件要不要改：[plugin-migration-guide.md](plugin-migration-guide.md)（结论：**只有消费账号福利通知的形状敏感方有必做项**；其余多数插件零改）
- 提交明细：[diff-vs-0.2.1-alpha.4.md](diff-vs-0.2.1-alpha.4.md) ｜ [CHANGELOG.md](CHANGELOG.md)
- 官方升级指南 1 篇：`docs/upgrade-guide/v0.2.1-alpha.4/account-notification-fields/`
- 能力缝增删：0 新增 0 删除（slot +1）
