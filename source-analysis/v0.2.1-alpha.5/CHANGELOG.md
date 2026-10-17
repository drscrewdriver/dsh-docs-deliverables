# DSH v0.2.1-alpha.5 CHANGELOG（dsh-v0.2.1-alpha.4 → dsh-v0.2.1-alpha.5）

> 36 commits（25 非 merge + 11 merge）｜ 2026-10-15 ~ 2026-10-16 ｜ 发布 PR #6327（merge `1517a4dbca`）
> 结构：**0 新增 / 0 删除 / 0 改名包**；`SESSION_FORMAT_VERSION` 保持 4，无新承认；闸门/settings 零 diff

## Features

- 📋 🔌 **feat(account): 通用通知字段 + 多通知层叠**（`2dcd031a8e` 支持通用通知字段和多通知层叠展示；修复链：`6ac5c103db` 空标题与过期队首、`1f312b6282` 保留未校验元数据、`da6c16747e` 不同高度卡片平滑过渡、`474d7b7989` 类型依赖图同步、`00a1155f5a` lint）
  `AccountBonusNotification`：`campaign`/`amount`/`currency`/`grantedAt` → 可选 `JsonValue` 未校验；`orderId` 任意字符串；空串 `expiresAt` = 永不过期；新增可选 `title`。官方指南 `account-notification-fields`（挂 `v0.2.1-alpha.4/` 目录）。
- ⭐ 🔌 **feat(web): provider-aware 模型标签槽**（`919aa5f400` 新槽 `conversation.input.model.label`；`f87c08950a` memoize providers；`1b385d6e2a` 菜单定位局部化；`c78f3fd33d` 视口内收敛）
- ⚠️ 🔌 **refactor(tools): PTC 指令组合化**（`839bd5131d` compose without prose replacement；`d6adc5d9b9` 恢复兼容 PTC guidance 与 SDK persona）
- **feat(desktop): 发布工程**（`b8f8abc5d6` 行政性无版本 COS 桶、`af66022ace` Windows 打包默认签名、`5e23825f15` debug 发布早拒 + runner 监督、`cfa52b0bac` Task Scheduler 监督 Windows 打包 runner）

## Fixes（精选）

- **fix(ui-skill)**: plugin manager 变更后刷新斜杠菜单（`6910cd6e9c`；目录缺口记录 `ba392ae0e7`）。
- **fix(web)**: 终端发现按会话共享（`0ae278b935`）；折叠右侧栏裁剪防 PageUp 移框（`8953554b5e`）。
- **test(sdk)**: 缓存 E2E 重试设置并暴露 provider 失败（`c34a107428`）。
- **test(web)**: 钉日期夹具下时钟距离/页面计时（`4cea5c36d2`、`81803f7ca5`）。

## Docs / 工程面

- 官方升级指南 **1 篇**：`v0.2.1-alpha.4/account-notification-fields`（三语）。
- slot 目录 +43/−0：新槽 `conversation.input.model.label`。
- **cordis rc.11 vendor 升级 = staged 计划**（`c0bf2ac81d` docs，仅规划未落地——勿当现状引用）。

## 复核命令

```bash
git rev-list --no-merges --count dsh-v0.2.1-alpha.4..dsh-v0.2.1-alpha.5   # 25
git log --no-merges --format='%h %s' dsh-v0.2.1-alpha.4..dsh-v0.2.1-alpha.5
git diff dsh-v0.2.1-alpha.4 dsh-v0.2.1-alpha.5 -- packages/extensions/cordis-client-runner/src/client/slot-catalog.ts
```
