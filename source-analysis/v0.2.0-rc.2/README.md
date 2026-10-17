# DSH v0.2.0-rc.1 → v0.2.0-rc.2 变更说明（更新要点）

> **数据源**: `deepseek-ai/deepseek-harness` 官方仓库
> **标签对比**: `dsh-v0.2.0-rc.1` (`4878cdabd8`) → `dsh-v0.2.0-rc.2` (`639ed01539`)
> **发布日期**: 2026-09-29 ｜ **发布提交**: `c1b47e41fc release(dsh): 0.2.0-rc.2`
> **发布 PR**: [#5479](https://github.com/deepseek-ai/deepseek-harness/pull/5479)（merge `worktree/release-dsh-0.2.0-rc.2`）
> **性质**: 0.2 线第二个 RC，纯增量打磨，共 187 个提交（140 非 merge + 47 merge）
> **统计**: 1022 files changed, +33253 / −6141（大头在 `user-questions` 族 +6.5k、web 测试/快照、`docs/persistence-schema.json` 重新生成 +36k）
> **结构变化**: `packages/` 无新增、无删除、无改名（与 rc.1 的 4 个新包相比显著收敛）
> **持久化契约**: `SESSION_FORMAT_VERSION` **保持 4**；新增一条 same-version 持久化承认 `2026-09-21-user-question-reply`（`user/message` 等 4 个 root 的新消息 source 资格，纯增量，旧日志继续有效）
> **插件契约**: manifest / settings API / 加载器 / HMR / slot / **peer 兼容性校验**（`plugin-compatibility.ts` 零 diff）**全部未动**；rc.1 迁移指南的动作清单在 rc.2 上**原样适用、无新增必做项**

---

## 一句话总结

0.2.0-rc.2 是 **"人机交互补全 + 桌面自管理 + 性能与文案收尾"** 的一次发布——rc.1 确立的契约面原封不动，主要动作是补齐提问阻塞模型的死角、让桌面端能自管 CLI 与插件、以及一批 UI/性能打磨：

- **`ask_user_question` 支持计时提问（two settlements）**：`tool-ask-user` Cordis 行新增 `Config { mode: 'legacy' | 'timed', timeout?: number }`（默认 `legacy` + 120s）。`mode: 'timed'` 切到 `askTimed()`：前台瀑布流超时返回 pending（`ASK_TIMED_OUT`），用户**迟到**的回答走业务 RPC `answer(agent, callId, answer)` → `agent.steer()` 注入一条 durable user 消息，source 标 `{ kind: 'user-question-reply', callId, outcome: 'answered' }`；`userQuestions` projection 从既有 Session 事件重建问题状态（含 PTC 子调用的 pending 识别）。需要一条 **same-version 持久化承认**（`2026-09-21-user-question-reply`），不新增事件类型、不动会话头；
- **桌面端管理 dsh CLI 命令**（PR #5288）：原生菜单提供 bundled CLI 的安装 / 修复 / 回滚，PATH 目录只暴露 `dsh`；CLI 注册从安装流程内联改为**安装后菜单动作**；Windows 控制台信号（Ctrl-Break）送达 CLI 处理器；启动时**读取用户登录 shell 环境**（PR #5393）；
- **Windows ACL 拒绝单次运行完成诊断+修复**（PR #5432）：`sandbox-windows-acl` 技能把"诊断→报告→请求修复"收敛为一次运行，修复结果对照目标对象自身的 ACE 校验，报告截断后保持可读；
- **模型选择器重做**：composer 模型菜单新增**模糊搜索**（胶囊形输入框 + 圆弧匹配）、分组排序统一 + **粘性分组头**（`ui-primitives` 新增 `MenuGroup`；`ui-commands` 新增 `option-groups.ts`；`ui-model-selection` 新增 `provider-order.ts`）；粘性检测**不做 layout 读**（`perf`）；
- **长会话渲染 + 鲸鱼动画降开销**（PR #5456）：鲸鱼图片构建期内联进 CSS（不再走运行时请求），长会话 transcript 渲染与输入开销降低，可访问性保持；
- **Schedule 到期提醒改"框架化用户消息"**（PR #5137）：one-shot 与 recurring 两条投递路径共用 `SCHEDULED_MESSAGE_FRAMING`，开头统一一行 "This is a scheduled message from the user"——消息自证来源，括号标记与 JSON 编码动态字段不变，prompt 仍无法伪造框架行；
- **设置页解禁**（PR #5449）：切换默认预设与 Creator 入口不再受"代码工作工具"开关限制；
- **侧栏文件树打开工作区**（PR #5314）：文件夹行新增打开按钮，复用 path-based open-in-app 动作；新终端菜单每个 shell 只列一次；
- **cordis Client inspect 查询收口**（PR #5409）：查询有界（`clientInspectTimeoutMs`）+ 失败保留 + 离线跳过，不再无限等待；
- **pi-ai 升级 0.87.1**（PR #5445）：模型目录升级，Mistral 纳入兼容性类型检查，允许空 compatibility guard 成员；
- **插件管理页文案**（PR #5410）：明确"升级 = 重装兼容版本"，shipped bundle 与不兼容升级分开措辞。

---

## 版本序列定位

```
dsh-v0.2.0-rc.1     ← 上版（4878cdabd8，2026-09-28）
    │
    │  ←─ 本次变更（187 commits：140 非 merge + 47 merge）
    ▼
dsh-v0.2.0-rc.2     ← 当前版（639ed01539，2026-09-29）
```

> rc.1 与 rc.2 之间**没有中间 tag**，本目录的 diff 覆盖完整区间，不存在分析空白。
> 模块级 14 篇基线沿用 0.2.0-rc.1 分析（其本身沿用 0.1.7-rc.1），本目录不再重复 14 篇编号文档——
> rc.2 没有触及任何模块的结构性结论，逐主题证据见 [diff-vs-0.2.0-rc.1.md](diff-vs-0.2.0-rc.1.md)。

窗口内"先落后撤"的主线：无。`f50b6db1c1` revert 的是测试辅助代码（Unicode control helper），非功能主线。

---

## 主要变更分组

| # | 变更族 | 规模 | 一句话 |
|---|--------|------|--------|
| 1 | 计时提问 + 迟到回复 | ~20 commits，+6.5k | `tool-ask-user` `mode: 'timed'`；`askTimed()` 两段结算；`userQuestions` projection；same-version 持久化承认 |
| 2 | 桌面 CLI 命令管理 | ~20 commits | 原生菜单装/修/回滚 `dsh` 命令；PATH 目录只暴露 `dsh`；安装后菜单动作化；登录 shell 环境注入 |
| 3 | Windows ACL 单次运行修复 | ~15 commits | 一次运行完成诊断+修复；按对象自身 ACE 校验；报告截断可读 |
| 4 | 模型选择器重做 | ~12 commits | 模糊搜索 + 粘性分组头 + 分组排序统一；`MenuGroup` 新原语 |
| 5 | 长会话/鲸鱼动画性能 | ~5 commits | 图片 CSS 内联；长会话渲染降开销 |
| 6 | 侧栏打开工作区 | ~4 commits | 文件树文件夹"打开"按钮；shell 去重 |
| 7 | Schedule 提醒框架化 | 1 feat + docs | 共用 `SCHEDULED_MESSAGE_FRAMING` 起始行 |
| 8 | 设置页解禁 | ~2 commits | 预设切换 / Creator 入口脱离代码工作工具开关 |
| 9 | LLM 层 | ~4 commits | pi-ai 0.87.1；Mistral 类型检查；空 guard 成员 |
| 10 | cordis inspect 收口 | ~3 commits | 查询限时 `clientInspectTimeoutMs` + 失败保留 + 离线跳过 |
| 11 | 插件管理页文案 | ~3 commits | "升级 = 重装"；bundle 与不兼容升级分开措辞 |
| 12 | pwsh / shell 提醒 | ~6 commits | ASCII 填充完成行；readiness timeline 测试；删除/移动前核对 resolved path 提醒 |

（逐主题 diff 与提交号见 [diff-vs-0.2.0-rc.1.md](diff-vs-0.2.0-rc.1.md)；完整提交清单 `git log --no-merges dsh-v0.2.0-rc.1..dsh-v0.2.0-rc.2` 共 140 条。）

---

## Breaking Changes 与行为风险

**没有 API 层面的 breaking change，也没有 rc.1 之外的任何新增必做项。** 以下条目是行为/语义层面的观察点：

| # | 变更 | 影响对象 | 危险度 |
|---|------|----------|--------|
| 1 | `ask_user_question` 新增 `mode: 'timed'` 行配置（**默认仍 `legacy`**，不启用则行为与 rc.1 完全一致） | 显式启用 timed 模式的 profile/插件 | 🟢 opt-in |
| 2 | Schedule 到期提醒的首行框架文案变化（"This is a scheduled message from the user"） | 解析/断言 reminder 消息文本的脚本或 e2e | 🟢 文本层 |
| 3 | cordis Client inspect 查询从"无限等待"改为有界 + 离线跳过 | 依赖 inspect 长挂起的调试流程 | 🟢 行为 |
| 4 | pi-ai 0.87.1 模型目录升级（unsupported-image 覆盖面重录） | 直接消费模型目录快照的测试 | 🟢 测试层 |
| 5 | 插件管理页升级引导文案改为"重装以升级" | 引导用户的文档/截图 | 🟢 文案层 |

> rc.1 的 8 条风险表（peer 世代门槛 / Schedule 默认移除 / `displayTitle` 空串等）在 rc.2 上**逐条原样成立**，见
> [v0.2.0-rc.1/README.md](../v0.2.0-rc.1/README.md) 与 [plugin-migration-guide.md](plugin-migration-guide.md)。

---

## 阅读路径

- 只想知道"我的插件要不要改"：[plugin-migration-guide.md](plugin-migration-guide.md)（结论：**rc.1 的清单照做即可，无新增**）
- 想知道"这 187 个提交都干了什么"：[diff-vs-0.2.0-rc.1.md](diff-vs-0.2.0-rc.1.md)
- 想按 Feature/Fix 过一遍：[CHANGELOG.md](CHANGELOG.md)
- 计时提问的完整设计（两段结算 / projection / 竞态）：仓库内 `.agents/notes/implemented/architecture/2026-09-19-timed-user-question-two-settlements.md` 与 `docs/persistence-changes/2026-09-21-user-question-reply.md`
