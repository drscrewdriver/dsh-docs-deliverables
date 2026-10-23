# DSH v0.2.1-rc.2 → v0.2.1-rc.3 变更说明（更新要点）

> **数据源**: `deepseek-ai/deepseek-harness` 官方仓库
> **标签对比**: `dsh-v0.2.1-rc.2` (`687f282e86`) → `dsh-v0.2.1-rc.3`（提交 `1f81c047fc`，= 当前 origin/master tip）
> **发布日期**: 2026-10-23 ｜ **发布 PR**: [#6999](https://github.com/deepseek-ai/deepseek-harness/pull/6999)（release 提交 `d02ea370ee`）
> **性质**: 0.2.1 线第三个 rc——**导航条目自定义进门 + New Session 空会话复用 + DeepSeek 模型跟随官方 /models**，6 个提交（5 非 merge 含 release + 1 merge）
> **统计**: 640 files changed, +5682 / −1021（大头为 ui-entry-customization 新包与其测试、llm listing 实现与测试、web snapshot）
> **结构变化**: **1 新增包 / 0 删除 / 0 改名**——`packages/client/ui-entry-customization`（host 侧 companion 为空 `apply()`，主体在 client 半包）
> **持久化契约**: `SESSION_FORMAT_VERSION` **保持 4**；**无新增持久化承认**
> **插件契约**: 闸门（`plugin-compatibility.ts`/`compatibility-preflight.ts`）/ settings 核心 / vendor cordis·schemastery / `docs/capability-seams.md` 缝集合**零 diff**（探针 gate=10 / cf=78 与 rc.1/rc.2 同值）；**slot 目录 +3 新增 0 删除**（三域 More 菜单行）；官方升级指南 **1 篇**（`new-session-blank-reuse`，挂在 `v0.2.1-rc.2/` 目录下）

---

## 一句话总结

rc.3 是「导航条目自定义」功能车，但**带了一篇官方升级指南**，插件作者视角有一项必做自查：

- **导航条目自定义**（`5ff29190ed` feat(ui)，PR #6247）：左侧栏面板按钮（`sidebar.panellist`）、Conversation 头 View 页签（`conversation.view`）、右侧栏 guide 工具卡三域的插件条目**用户可钉选/隐藏/收进 More 菜单**——新增 3 个 `*.actions` 槽承载 More 行；条目可见性从此"用户说了算"，插件的图标/名称展示质量直接影响可发现性；
- **New Session 空会话复用**（同一 PR 进场；note `2026-10-20-new-session-blank-reuse-by-preset`；官方指南 `v0.2.1-rc.2/new-session-blank-reuse`）：`uiWorkspace.startSession(workspaceId)` 无选项调用与 `openWorkspace`/`connectWorkspace` 从"每次新建 Session+Agent"改为**按 preset 复用首个未开始、未归档的空白会话**（复用时切默认 preset；点名 preset 的请求跳过登记他 preset 的空白）——依赖"每次调用得到全新 Agent"的集成受影响；
- **DeepSeek API-key 路由跟随官方 /models**（`c48f8523f2`，PR #6944）：`llm-deepseek-api-key` 内建目录改为跟随官方 listing（`ModelListingCache` + 失败回落），新增 2 个 **additive volatile** 配置键 `modelsTimeoutMs`（默认 5000）/`modelsMaxAgeMs`（默认 600000，后台刷新年龄）；
- 其余为 #6883（导航钉选与选中态解耦 + 菜单图标）、#6600（导航条目与 preset 选择的 productAnalytics 埋点）。

---

## 版本序列定位

```
dsh-v0.2.1-rc.2   ← 上版（687f282e86，2026-10-17，PR #6408，两小功能包零断裂）
    │
    │  ←─ 本次变更（6 commits：5 非 merge + 1 merge）
    ▼
dsh-v0.2.1-rc.3   ← 当前版（1f81c047fc，2026-10-23，PR #6999）—— 0.2.1 线最新
```

> 与 rc.2 同为"最小段"，但性质回到 rc.1 前：rc.2 零指南零必做，rc.3 **有 1 篇官方升级指南**（blank-reuse 语义变化），且是 a.5 预留显示面之外**首次单版 +3 槽**。

---

## 观察点

| # | 变更 | 影响对象 | 危险度 |
|---|------|----------|--------|
| 1 | `startSession`/`openWorkspace`/`connectWorkspace` 空白会话复用（官方指南 1 篇；签名不变、语义变） | 依赖"每次调用全新 Agent/会话"的 client 集成：草稿接管、preset 组成时机、测试夹具都会感知；需排他传 `{ agentPreset }` | 🟡 行为换代 |
| 2 | slot 目录 **+3**（`conversation.session.header.views.actions` / `sidebar.panellist.actions` / `sidebar.right.tab.guide.actions`，0 删除 0 改名） | 想占 More 菜单行的插件可注册；同域条目现可被用户隐藏 | 🟢 增量 + 🟡 可见性让渡 |
| 3 | DeepSeek API-key 路由模型目录改跟随官方 `/models`（内建目录退居回落；新 volatile 键 `modelsTimeoutMs`/`modelsMaxAgeMs`） | 断言内建 catalog 形状/模型可用性的插件与脚本：模型面开始受网络 listing 影响（首用等待 ≤5s） | 🟡 行为 |
| 4 | 导航钉选与选中态解耦 + 菜单图标（#6883）；条目/preset 埋点（#6600） | 无 API 面；依赖旧钉选语义的 e2e 断言需复核 | 🟢 行为 |
| 5 | release bump 349 个 package.json 版本行 → runtime 字符串变 `0.2.1-rc.3` | 枚举式 `engines.dsh`/peer 清单不加 rc.3 会被闸门拒载（caret `^0.2.1-alpha.1` 天然覆盖） | 🟡 元数据 |

> a.1–rc.2 全部风险表在本版仍逐条成立；#5 即 TRIM5 双清单同串枚举纪律的又一次落点。

---

## 阅读路径

- 插件要不要改：**契约面零必改 + 一项语义自查**——[plugin-migration-guide.md](plugin-migration-guide.md)
- 提交明细：[diff-vs-0.2.1-rc.2.md](diff-vs-0.2.1-rc.2.md) ｜ [CHANGELOG.md](CHANGELOG.md)
- 官方升级指南：**1 篇**（`docs/upgrade-guide/v0.2.1-rc.2/new-session-blank-reuse/`，目录按"从哪个版本迁移"命名）
- 能力缝增删：0 新增 0 删除；**槽 +3 / 0 删除**
