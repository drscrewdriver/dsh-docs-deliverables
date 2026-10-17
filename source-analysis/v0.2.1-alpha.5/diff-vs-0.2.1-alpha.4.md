# DSH v0.2.1-alpha.4 → v0.2.1-alpha.5 逐主题差异

> 36 commits（25 非 merge + 11 merge）｜ 586 files +3129/−1117 ｜ `86a402200d` → `1517a4dbca`

## §1 账号通知契约放宽（指南 `account-notification-fields`）

- 公开类型 `AccountBonusNotification`：`campaign`/`amount`/`currency`/`grantedAt` → **可选 `JsonValue`、不校验**；`orderId` 任意字符串（原要求 UUID）；`expiresAt` 空串 = **永不过期**；新增可选 `title`。
- 实现链：`2dcd031a8e`（通用字段+多通知层叠）→ `6ac5c103db`（空标题/过期队首）→ `1f312b6282`（保留未校验元数据）→ `da6c16747e`（高度过渡）→ `474d7b7989`（类型依赖图）→ `00a1155f5a`（lint）。
- 消费面：`DeepSeekAccount.getUnnotifiedBonuses()` 与 remote `account/getUnnotifiedBonuses`。

## §2 模型标签槽（纯增量）

- `919aa5f400` 新槽 `conversation.input.model.label`（provider-aware）；`f87c08950a` memoize；`1b385d6e2a` 定位局部化；`c78f3fd33d` 视口内收敛。slot-catalog +43/−0。

## §3 PTC 指令组合化

- `839bd5131d` PTC instructions 组合而不替换 prose；`d6adc5d9b9` 恢复兼容 PTC guidance 与 SDK persona——对 prompt 形状敏感的插件注意系统提示词组装方式变化。

## §4 斜杠菜单联动 / Web 小修

- `6910cd6e9c` plugin manager 变更 → 斜杠菜单刷新（`ba392ae0e7` 记录 ui-skill 目录缺口）；`0ae278b935` 终端发现按会话共享；`8953554b5e` 折叠右栏裁剪。

## §5 桌面发布工程（非插件面）

- `b8f8abc5d6` 无版本 COS 桶、`af66022ace` Windows 默认签名、`5e23825f15` debug 早拒、`cfa52b0bac` Task Scheduler 监督。

## §6 零断裂面（显式核对）

| 面 | 结论 |
|---|---|
| `plugin-compatibility.ts`（a.4 换代后） | 零 diff |
| settings 核心 / `configForms` | 零 diff |
| `SESSION_FORMAT_VERSION` | 保持 4；无新承认 |
| 包结构 | 0 增/删/改名 |
| cordis vendor | **未升级**（`c0bf2ac81d` 仅 staged 计划） |

## 复核命令

```bash
git log --no-merges --format='%h %s' dsh-v0.2.1-alpha.4..dsh-v0.2.1-alpha.5
git diff dsh-v0.2.1-alpha.4 dsh-v0.2.1-alpha.5 -- packages/api/account-controller packages/client/ui-chat
```
