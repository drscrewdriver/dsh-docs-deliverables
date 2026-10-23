# DSH v0.2.1-rc.1 → v0.2.1-rc.2 变更说明（更新要点）

> **数据源**: `deepseek-ai/deepseek-harness` 官方仓库
> **标签对比**: `dsh-v0.2.1-rc.1` (`1600d8a1e1`) → `dsh-v0.2.1-rc.2`（提交 `687f282e86`，= 当前 origin/master tip）
> **发布日期**: 2026-10-16 ｜ **发布 PR**: [#6408](https://github.com/deepseek-ai/deepseek-harness/pull/6408)（release 提交 `d1b9c04067`）
> **性质**: 0.2.1 线第二个 rc——**两个独立小功能进场**（DeepSeek Search/Fetch API + Flash 1017 标签），9 个提交（5 非 merge + 4 merge）
> **统计**: 456 files changed, +4921 / −845（大头为 web 能力族实现与其测试/snapshot）
> **结构变化**: **2 新增包 / 0 删除 / 0 改名**——`packages/web/web-deepseek-api`、`packages/client/ui-deepseek-model-label-1017`
> **持久化契约**: `SESSION_FORMAT_VERSION` **保持 4**（types.ts 零 diff）；新增 **1 条同版本加性承认**（`docs/persistence-changes/2026-10-13-deepseek-search-thinking`）
> **插件契约**: **零断裂**——闸门（`plugin-compatibility.ts`/`compatibility-preflight.ts`）/ settings 核心 / vendor cordis·schemastery / slot 目录结构 / `docs/capability-seams.md` 缝集合**全部零 diff 或纯增量**；探针矩阵 rc.1↔rc.2 **13 列逐项全等**（cf=78 / gate=10 / loc=12 / snap=261…）；升级指南 **0 篇**

---

## 一句话总结

0.2.1-rc.2 是 rc.1 后的功能补丁车，插件作者视角**无任何必做项**：

- **DeepSeek Search / Fetch API**（`fda98dadd2 feat(web): add DeepSeek Search and Fetch APIs behind a settings switch`，PR #6103）：新包 `packages/web/web-deepseek-api`——**不开新缝**，作为 provider 注册进既有 `ctx.web` 缝（与 `web-search-exa`/`web-search-perplexity`/`web-search-deepseek`/`web-fetch-http` 同族并列，`tool-web` 继续持有模型侧稳定工具名）；整族能力藏在 settings 开关后；配套持久化承认 `deepseek-search-thinking`（搜索推理过程入会话日志，同版本加性）；
- **DeepSeek Flash「1017」临时标签**（`3c937cd0ba` + `7d844abc87`→revert `32efe36a4e`）：新包 `packages/client/ui-deepseek-model-label-1017`——先试"改 bundled 显示名追加 1017"随即 **revert**，改为独立组件占用 a.5 新槽 `conversation.input.model.label`（该槽 occupants 从 `[]` 变为 `['client-ui-deepseek-model-label-1017 DeepSeekModelLabel']`，`replaceRisk` 从 `none` 升 `shadows-shipped-ui`）——**这正是 a.5 预留 provider-aware 模型标签槽的第一个官方消费者**；
- 其余为 web/client/experimental 目录的实现与测试扩散（top dirs：client 92 / experimental 47 / web 35 files），无契约面。

---

## 版本序列定位

```
dsh-v0.2.1-rc.1   ← 上版（1600d8a1e1，2026-10-16，PR #6387，纯 bump）
    │
    │  ←─ 本次变更（9 commits：5 非 merge + 4 merge）
    ▼
dsh-v0.2.1-rc.2   ← 当前版（687f282e86 = origin/master tip，PR #6408）—— 0.2.1 线最新
```

> rc.1→rc.2 与 a.5→rc.1 同为最小段，但性质不同：rc.1 是零内容 bump，rc.2 带**两个真实功能包**进场——好在全部走"既有缝 provider + 既有槽 occupants"路径，未触碰任何契约面。

---

## 观察点

| # | 变更 | 影响对象 | 危险度 |
|---|------|----------|--------|
| 1 | `ctx.web` 新增 provider `web-deepseek-api`（settings 开关后）；`tool-web` 稳定工具名不变；**但 search/fetch provider 钉选机制换代**（见 #5） | 消费 `ctx.web`/web 搜索工具的插件：seam 形状无变化，但接管 provider 钉选的方式变了 | 🟡 内部机制 |
| 2 | `conversation.input.model.label` 槽出现**官方 occupant**（1017 徽章，`replaceRisk: shadows-shipped-ui`） | 同槽自挂模型标签的插件：注入仍生效但与官方徽章互相遮蔽可见性需自查 | 🟡 同槽竞争 |
| 3 | 持久化承认 +1（deepseek-search-thinking，同版本加性） | 旧构建读含新事件日志被拒（老规则不变） | 🟡 读取侧 |
| 4 | "改 bundled 显示名"方案落地即 revert（`32efe36a4e`）——模型展示名保持原样 | 依赖显示名的断言/脚本不受影响 | 🟢 行为 |
| 5 | **`packages/web/web/src/index.ts`：`searchProvider`/`fetchProvider` 由构造期快照的 `readonly string`（private `searchProviderId`/`fetchProviderId`）改为 `Volatile<string\|undefined>`（`z.string().volatile()`），改在调用点 `config.*.get()` 实时读** | 依赖内存赋值/构造注入接管 search/fetch provider 的插件**静默失效**——需改用 `settings.mutate` 持久钉选 | 🔴 行为换代 |

> a.1–rc.1 全部风险表在本版仍逐条成立；本版契约面零叠加，但 #5 为**内部实现换代**（不在 seam/tool-name 断裂面，故旧「零断裂」结论仅适用于形状层）。VERIFIED：`git diff dsh-v0.2.1-rc.1 dsh-v0.2.1-rc.2 -- packages/web/web/src/index.ts`。

---

## 阅读路径

- 插件要不要改：**契约面零必做**——[plugin-migration-guide.md](plugin-migration-guide.md) 结论为"零必做 + 一个同槽自查项"；**例外**：接管 `ctx.web` search/fetch provider 钉选的插件需从内存赋值/构造注入改为 `settings.mutate`（观察点 #5，内部机制换代非契约断裂）
- 提交明细：[diff-vs-0.2.1-rc.1.md](diff-vs-0.2.1-rc.1.md) ｜ [CHANGELOG.md](CHANGELOG.md)
- 官方升级指南：**0 篇**
- 能力缝增删：0 新增 0 删除（`ctx.web` providers +1）
