# 插件迁移指南：v0.2.1-alpha.4 → v0.2.1-alpha.5

> 结论：**仅账号通知消费方有必做项**；其余插件零改。闸门/装载/会话面与 a.4 完全一致。

## 必做项（引用即需收窄）

1. **`AccountBonusNotification` 消费方**：
   - 用 `campaign`/`amount`/`currency`/`grantedAt` 前**先做运行时类型收窄**（现在是可选 `JsonValue`，不保证存在或格式）；
   - 解析 `expiresAt`：空串按**永不过期**处理；
   - `orderId` 原样回传确认，不要再按 UUID 校验；
   - `title` 缺省时用客户端默认标题；
   - 测试夹具更新：非 UUID 标识、空过期时间的通知必须可展示可确认。

## 可选增量（无需迁移）

- 新槽 `conversation.input.model.label`：可注入/改写输入区模型名展示（provider-aware）。
- 斜杠菜单随 plugin manager 变更自动刷新：自定义斜杠项的插件不用再自监听。

## 检查清单

1. [ ] grep `getUnnotifiedBonuses` / `AccountBonusNotification`；
2. [ ] 目标宿主矩阵补 `0.2.1-alpha.5`，装载冒烟（预期与 a.4 行为一致）。
