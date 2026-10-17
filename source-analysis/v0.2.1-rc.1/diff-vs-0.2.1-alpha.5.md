# DSH v0.2.1-alpha.5 → v0.2.1-rc.1 逐主题差异

> 4 commits ｜ 355 files +355/−355 ｜ `1517a4dbca` → `1600d8a1e1`

## 唯一主题：版本 bump

- `git diff --name-only` 过滤 `package.json` 后**为空集**——355 个文件全部是各 `apps/*/package.json` 与 `packages/*/package.json`（及根）的 `version` 行 `0.2.1-alpha.5` → `0.2.1-rc.1`。
- 代码、文档、配置、快照、锁文件：**零变化**。

## 核对面（与 a.5 全等）

| 面 | 结论 |
|---|---|
| `plugin-compatibility.ts`（engines.dsh 双段判据） | 逐字节相同 |
| slot 目录（含 `conversation.input.model.label`、`plugins.tab`） | 相同 |
| `SESSION_FORMAT_VERSION` | 4 |
| 持久化承认清单 | 与 a.5 相同（无新增） |
| 能力缝（`ctx.remoteAccess`/`ctx.webApp`/`ctx.pluginMarket`…） | 相同 |
| 官方升级指南目录 | 相同（最后入账：`v0.2.1-alpha.4/account-notification-fields`） |

## 复核命令

```bash
git log --format='%h %s' dsh-v0.2.1-alpha.5..dsh-v0.2.1-rc.1
git diff --stat dsh-v0.2.1-alpha.5 dsh-v0.2.1-rc.1 -- . ":(exclude)*package.json"   # 空
```
