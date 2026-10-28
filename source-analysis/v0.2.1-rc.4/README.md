# DSH v0.2.1-rc.3 → v0.2.1-rc.4 变更说明（更新要点）

> **数据源**: `deepseek-ai/deepseek-harness` 官方仓库
> **标签对比**: `dsh-v0.2.1-rc.3` (`1f81c047fc`) → `dsh-v0.2.1-rc.4`（提交 `504a01a957`，轻量 tag）
> **发布日期**: 2026-10-26 ｜ **性质**: 0.2.1 线第四个 rc——**纯修复车**（视图页签 tooltip 精化 + ACP stdout 纯净性两连击）
> **统计**: 369 files changed, +596 / −381；其中 **349 个文件仅 package.json 版本行**（逐行核验无非版本改动），实质文件 **20 个**
> **结构变化**: **0 新增包 / 0 删除 / 0 改名**
> **持久化契约**: `SESSION_FORMAT_VERSION` **保持 4**；**无新增持久化承认**（`docs/persistence-changes/` 零 diff）
> **插件契约**: 闸门（`plugin-compatibility.ts`/`compatibility-preflight.ts`）/ settings 核心 / vendor cordis·schemastery / `docs/capability-seams.md` / `slot-catalog.ts` / **`docs/` 整目录** **零 diff**；**官方升级指南 0 篇**；配对探针（packages|vendor|apps 全量口径）rc.3↔rc.4 **14 列逐项全等**（cf=78/gate=10/snap=262…）

---

## 一句话总结

rc.4 是 rc.3 功能车之后的**收尾修复段**，三个主题、零契约断裂：

- **View 页签 tooltip 精化**（`72624bae95`/`199ffe37ba`，PR #7183/#7342）：`ui-conversation` 头部页签的全名 tooltip 改为**仅在标签宽度估算超过 88px 单元时出现**；More 按钮 label 固定为 `session.moreViews`，**`session.moreViewsCurrent` locale 键删除**（zh/en 两处）——rc.3「导航条目自定义」车的直接后续打磨；
- **ACP stdout 保留给协议消息 ×2**（`41736cdec5` PR #7179、`cc4446eecc` PR #7168）：①`llm-deepseek-account` 模型目录诊断从 `console.info`（stdout）改 `console.error`（stderr）；②`mcp-client` 对**未宣告 `resources` 能力**的服务器，`resources/list`/`resources/templates/list` **直接返回空页、不再调 SDK**（SDK 的 fallback 会向 stdout 写 debug 行，污染 ACP 的 JSON-RPC 通道）；新增 e2e `apps/cli/tests/profiles/acp/tests/stdout.expected.e2e.ts`；
- 其余为四个包的 README 三语同步与 release bump（349 个 package.json 版本行 → runtime 字符串变 `0.2.1-rc.4`）。

---

## 版本序列定位

```
dsh-v0.2.1-rc.3   ← 上版（1f81c047fc，2026-10-23，PR #6999，导航条目自定义车）
    │
    │  ←─ 本次变更（9 commits：7 非 merge 含 release + 2 merge）
    ▼
dsh-v0.2.1-rc.4   ← 当前版（504a01a957，2026-10-26）—— 0.2.1 线尾版
    │
    ▼
dsh-v0.2.2-alpha.2 ← 下一线首 tag（f3803c9697，2026-10-28，= master tip）——见 ../v0.2.2-alpha.2/ 动态条目
```

> ⚠ 本节登记时（2026-10-28 早）origin/master tip `f3803c9697` 尚未发版；当日已发布为 **`dsh-v0.2.2-alpha.2`**（0.2.2 线无 alpha.1）。本目录分析边界止于 rc.4 tag。
> 与 rc.1 的「纯 bump」和 rc.2 的「功能补丁车」都不同，rc.4 是**行为修复车**：契约面全零，但三处运行态行为变了（见观察点）。

---

## 观察点

| # | 变更 | 影响对象 | 危险度 |
|---|------|----------|--------|
| 1 | View 页签 tooltip 只在**估算溢出**（宽字形 13px/窄 7px vs 88px 单元）时渲染；More 按钮 label 不再内嵌当前视图名，**`session.moreViewsCurrent` 键删除** | DOM 探针/e2e 以「More conversation views · {name}」文案或「每个页签恒有 tooltip」为锚的插件与脚本失配；改锚页签文本本身或 View 注册事实（More 行注册走 rc.3 的 `conversation.session.header.views.actions` 槽） | 🟡 探针层 |
| 2 | MCP 未宣告 resources 的服务器：宿主资源工具列表由「SDK 调用 → 空页 + stdout debug 行」改为**短路空页（不触服务器）** | 断言「list 触发了一次网络/进程交互」的插件测试需放宽；返回形状（`{resources: []}`/`{resourceTemplates: []}`）与 SDK fallback 相同，消费方无感 | 🟢 行为 |
| 3 | 账号目录诊断 stdout→stderr（`llm-deepseek-account`）；ACP stdout 经 e2e 固化为「仅协议消息」 | 抓取 stdout 建模录日志的脚本/插件改读 stderr；ACP 模式下 stdout 混入非 JSON 行的历史故障根治 | 🟢 修复 |
| 4 | release bump 349 个 package.json 版本行 → runtime 字符串变 `0.2.1-rc.4` | 枚举式 `engines.dsh`/peer 清单不加 rc.4 会被闸门拒载（caret `^0.2.1-alpha.1` 天然覆盖） | 🟡 元数据 |

> a.1–rc.3 全部风险表在本版仍逐条成立；#4 即 TRIM5 双清单同串枚举纪律的又一次落点。

---

## 阅读路径

- 插件要不要改：**契约面零必改 + 一项元数据枚举 + 两项探针自查**——[plugin-migration-guide.md](plugin-migration-guide.md)
- 提交明细：[diff-vs-0.2.1-rc.3.md](diff-vs-0.2.1-rc.3.md) ｜ [CHANGELOG.md](CHANGELOG.md)
- 官方升级指南：**0 篇**（`docs/upgrade-guide/` 零 diff）
- 能力缝增删：0 新增 0 删除；**槽 0 增 0 删 0 改名**
