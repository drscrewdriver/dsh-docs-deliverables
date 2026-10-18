# 插件迁移指南：v0.2.1-rc.1 → v0.2.1-rc.2

> 结论：**零必做项**。契约面（闸门 / settings / slot 结构 / 缝 / 持久化版本）零断裂，探针矩阵 13 列与 rc.1 逐项全等。唯一自查项：**同槽竞争**。

## 必做项

无。`^0.2.1-alpha.1` 与逐 rc 枚举两种 peer 写法均已天然覆盖 `0.2.1-rc.2`（同一 `0.2.1` 三元组，`includePrerelease` 命中；rc.2 非新三元组，无需改 range）。

## 建议自查（一项）

| 场景 | 检查 | 依据 |
|---|---|---|
| 你往 `conversation.input.model.label` 注入过自定义模型标签 | 官方 1017 徽章组件（`client-ui-deepseek-model-label-1017`）现在是该槽 occupant，`replaceRisk: shadows-shipped-ui`——你的注入仍生效，但与官方标签的**同屏遮蔽关系**需运行态核对（尤其给 DeepSeek Flash 打自定义标签的插件） | slot-catalog rc.1→rc.2 diff；`3c937cd0ba` |

## 行为核对（无需改码但要有感）

| 面 | 变化 | 核对动作 |
|---|---|---|
| web 搜索 | `ctx.web` 多一个 provider（`web-deepseek-api`，settings 开关后）；`tool-web` 工具名不变 | 枚举 providers 做展示/路由的插件把新键加入白名单即可，无形状变化 |
| 会话日志 | +1 同版本加性承认（deepseek-search-thinking）——开启该开关的会话可能写入新事件 | 自解析 durable 日志的插件对未知事件类型保持宽容（老规则本就要求） |
| Flash 显示名 | "追加 1017"方案已 revert，名字回正 | 依赖显示名精确匹配的测试无需改 |

## peer / 装载面速核（本段零变化）

- `engines.dsh` 判据延续 a.4 时代；拒载记录仍是 `requirements`；
- `SESSION_FORMAT_VERSION` 恒 4；settings gen-3 形状未动；vendor cordis 4.0.5 / schemastery 3.18.5（rc.1 正式线）未再 bump；
- 豁免机制 `dsh plugin allow-version` 语义不变。

## 检查清单

1. [ ] （仅同槽插件）运行态核对 `conversation.input.model.label` 与官方徽章的共存显示；
2. [ ] hosts.mjs 枚举追加 `0.2.1-rc.2` 后跑矩阵绿（装载冒烟走干净格）；
3. [ ] 其余面零动作。
