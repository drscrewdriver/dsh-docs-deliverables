# DSH v0.1.7-rc.2 → v0.2.0-rc.1 变更说明（更新要点）

> **数据源**: `deepseek-ai/deepseek-harness` 官方仓库
> **标签对比**: `dsh-v0.1.7-rc.2` (`477b4f4205`) → `dsh-v0.2.0-rc.1` (`4878cdabd8`)
> **发布日期**: 2026-09-28 ｜ **发布提交**: `4878cdabd8 release(dsh): 0.2.0-rc.1`
> **发布 PR**: [#5387](https://github.com/deepseek-ai/deepseek-harness/pull/5387) `release(dsh): 0.2.0-rc.1`
> **性质**: 0.2 线首个 RC（版本号主版本位跨越 0.1 → 0.2，但**不是**架构换代），共 261 个提交（167 非 merge + 94 merge）
> **统计**: 1109 files changed, +20374 / −77957（其中 −75173 来自单个文件 `docs/persistence-schema.json` 的清单压缩，**与代码无关**；真实代码变更约 +20k/−2.8k）
> **结构变化**: `packages/` 顶层分组不变；**新增 4 个包**（`telemetry/otel`、`client/product-analytics`、`client/ui-settings-session-log`、`experimental/schedule-bundle`），无删除、无改名
> **持久化契约**: `SESSION_FORMAT_VERSION` **保持 4**，无会话格式跃迁，可完全回退
> **插件契约**: manifest / settings API / 加载器 / HMR / slot 机制**全部未动**；唯一的硬门槛是 **peer 范围强制校验把 `>=0.1.7-rc.1 <0.2.0-0` 的插件挡在新宿主之外**（见 [plugin-migration-guide.md](plugin-migration-guide.md)）

---

## 一句话总结

0.2.0-rc.1 是 **"遥测管道统一 + 默认组合裁剪 + 插件管理页打磨"** 的一次发布——0.1 线积累的架构在 0.2 首个 RC 上原样延续，主要动作是把"官方体验里什么东西默认存在"收得更紧：

- **Schedule 正式 opt-in 化**：rc.2 里 `disabled: true` 躺在 web-app bundle 中的 `time-context` / `schedule` / `ui-schedule` 三行被**整行删除**，迁入全新可选 bundle `@deepseek-ai/dsh-experimental-schedule-bundle`（`OPTIONAL_BUNDLES` +1）。默认 Web 组合不再携带 Schedule 的 tool schema 与逐步 clock 消息；引用这三个 id 的 profile patch 在 bundle 未启用时会得到 `patch: entry <id> not found` 警告；
- **OTel 上报收口为共享 Cordis 服务**：全新包 `@deepseek-ai/dsh-otel` 注册 `ctx.otel`（`createEventReporter` / `createSessionLogReporter`），`session-telemetry-otel` 与 `product-telemetry-otel` 全部改为注入使用，不再各自组装 OTel SDK；Session Log 上报改为**字节限额**（`maxRequestBytes` 上限 4,000,000），端点迁到 `dsh-otel-collector.deepseeksvc.com`，shutdown 到期**主动取消**未完成导出；
- **产品分析（productAnalytics）落地**：全新包 `@deepseek-ai/dsh-client-product-analytics` 提供 `enabled()` / `watchPolicy()` / `report()` Remote API，仅 desktop profile 挂载（普通 Web 不采集）；桌面端补 `getDeviceIdentity` 相关埋点、反馈问卷设备信息与中英更新文案重写；
- **Session Log 上传偏好进入 General 设置**：新 UI 包 `@deepseek-ai/dsh-client-ui-settings-session-log`；`session-log-deepseek.Config.enabled` 改为 `Volatile<boolean>`（**改偏好即刻生效，不再重启**）；
- **失败 step 的 pending tool result 保守恢复**：`packages/core/session/src/repair.ts` 把内联的 pending-call 追踪抽成公开类 `ToolCallRecovery`，agent-loop 在 step 抛错前先补齐未决的 `tool/result` 再重抛——同一 turn 不再出现"有 call 无 result"的悬空记录（详见 [diff-vs-0.1.7-rc.2.md](diff-vs-0.1.7-rc.2.md) §2.4）；
- **未命名 Session 标题语义变更**：`SessionRowOwnerProps.displayTitle` / `SessionNode.title` 不再兜底 project basename 或 Session id，**可能为空串**，由渲染层本地化为 `t('session.untitled')`——这是本区间唯一触及插件可见 props 的语义变化；
- **文档瘦身**：`docs/persistence-schema.json` 从内联展开的 schema AST 压缩为 digest/names/sources（−78k 行），详情改由 `scripts/persistence-schema-model.ts` 按需生成。

---

## 版本序列定位

```
dsh-v0.1.7-rc.2     ← 上版（477b4f4205，2026-09-24）
    │
    │  ←─ 本次变更（261 commits：167 非 merge + 94 merge）
    ▼
dsh-v0.2.0-rc.1     ← 当前版（4878cdabd8，2026-09-28）
```

> 0.1.7-rc.2 与 0.2.0-rc.1 之间**没有任何中间 tag**，本目录的 diff 覆盖完整区间，不存在分析空白。
> 版本号从 0.1 跨到 0.2 的直接原因是 peer 范围世代门槛：`<0.2.0-0` 挡住所有 0.2 预发布版，
> 反向亦然——这是生态强制升级的机制位，而非架构换代信号（模块级 14 篇基线沿用 0.1.7-rc.1 分析，见各篇"基线说明"）。

窗口内"先落后撤"的主线（终态为准）：

```
b9ace787e4 feat: refuse to switch a row alone when its bundle switches its rows as a whole
    └→ 6085a56eb6 Revert（bundle 整行切换的第一次尝试撤回）
e42f262bc5 feat: let a bundle list its rows without row switches
    └→ 738178f136 Revert
    └→ 终态 64a361ee44 feat(schedule): insert the Schedule rows from the bundle（可选 bundle 落地）
```

---

## 主要变更分组

| # | 变更族 | 规模 | 一句话 |
|---|--------|------|--------|
| 1 | Schedule 可选 bundle 化 | 3 包 | `time-context`/`schedule`/`ui-schedule` 从默认组合删除 → `dsh-experimental-schedule-bundle` opt-in |
| 2 | OTel 统一上报 | ⭐1 包 + 2 包重写 | `ctx.otel` 共享工厂；session/product 两个 telemetry 包瘦身为 reporter 调用方；字节限额 + 端点迁移 |
| 3 | productAnalytics | ⭐2 包 | desktop-only 产品埋点（Remote API + web-app patch 条件挂载）|
| 4 | 插件管理页打磨 | ~30 commits | 刷新失败 toast、IME 提交守卫、安装输入脱敏、键盘选择、失败保留缓存卡片、全流程埋点 |
| 5 | 会话可靠性 | core/session | `ToolCallRecovery` 抽取 + step 失败前落盘 pending tool result；WebKit JSON 构造器修复 |
| 6 | 设置体系 | 2 包 | `volatile()` 一等化扩散（session-log/chat transcriptView/product-analytics）；config-editor 支持"显式置 undefined 覆盖继承值" |
| 7 | Session Log 上传开关 | ⭐1 包 | General 设置 order 90 行 + 失败 toast；`enabled` 热更新 |
| 8 | 桌面端 | apps/desktop | 产品分析埋点、Windows caption/fullscreen、macOS 麦克风 entitlements、更新文案重写 |
| 9 | 执行面 | sandbox/terminal | Windows ACL 诊断技能内置（721 行 ps1）；terminal-bash `promptTailGraceMs` |
| 10 | LLM 层 | llm-deepseek | 文件索引批量失效（一次锁重写清掉全部 stale 映射），无接口/协议变化 |
| 11 | 创造模式指引重构 | preset + tool-cordis | persona 换 standard 同款、规则移交 skills（#4745）；渐进式 skill 结构（references/ + templates/）——专题见 [15-creator-mode-guidance.md](15-creator-mode-guidance.md) |

（⭐ = 新包。逐主题 diff 与提交号见 [diff-vs-0.1.7-rc.2.md](diff-vs-0.1.7-rc.2.md)；完整提交清单 `git log --no-merges dsh-v0.1.7-rc.2..dsh-v0.2.0-rc.1` 共 167 条。）

---

## Breaking Changes 与行为风险

**没有 API 层面的硬 breaking change**（manifest、settings、加载器、HMR、slot 全兼容），但以下条目会实际咬人，按危险程度排序：

| # | 变更 | 影响对象 | 危险度 |
|---|------|----------|--------|
| 1 | **peer 范围世代门槛**：所有 `@deepseek-ai/dsh*` peer 用 `includePrerelease` semver 对运行版本校验，`>=0.1.7-rc.1 <0.2.0-0` 不满足 `0.2.0-rc.1` | 所有 0.1.7 线插件（**安装直接被拒**，除非精确版本豁免） | 🔴 升级必经 |
| 2 | Schedule 默认不在组合中：引用 `time-context`/`schedule`/`ui-schedule` 的 patch 得到 `patch: entry <id> not found` | 依赖 `schedule_*` 工具默认存在的插件/用户 profile | 🟡 行为 |
| 3 | `displayTitle` / `SessionNode.title` 可能为空串（不再兜底） | Session 行动作 slot 的消费者 | 🟡 语义 |
| 4 | `forkSession(sessionId)` → `(sessionId, onCreated?) => Promise<SessionId>` | 实现该接口的 override 者 | 🟢 兼容扩展 |
| 5 | `SessionInput.submit` / `ComposerKeyboard.submit` 新增可选 `source` 参数、`SubmitAttempt`/`InputEvent` 新增可选 `submission` 字段 | 实现 composer 契约的插件 | 🟢 兼容扩展 |
| 6 | `TextShimmer` DOM 结构变化（嵌套包装 + `data-shimmer-decoration`） | 依赖其内部结构/自定义 CSS 的插件 UI | 🟢 局部 |
| 7 | `session-log-deepseek.Config.enabled` 由可选变为必有（类型层），且为 `Volatile<boolean>` | 直接读取该 Config 类型的代码 | 🟢 类型层 |
| 8 | OTLP 端点迁移 `harness-telemetry` → `dsh-otel-collector`（未设 `DSH_TELEMETRY_OTLP_URL` 的安装） | 自建遥测消费方 | 🟢 运维 |

> 对比：0.1.6→0.1.7 是"契约换代"（设置 + 清单 + 会话格式同时换挡）；0.1.7→0.2.0 是"世代门槛 + 组合裁剪"，
> 插件代码层只需**扩 peer 范围 + 复核 Schedule 依赖**。迁移操作手册见 [plugin-migration-guide.md](plugin-migration-guide.md)。

---

## 阅读路径

- 只想知道"我的插件要不要改"：[plugin-migration-guide.md](plugin-migration-guide.md)（约 10 分钟）
- 想知道"这 261 个提交都干了什么"：[diff-vs-0.1.7-rc.2.md](diff-vs-0.1.7-rc.2.md)
- 想按 Feature/Fix 过一遍：[CHANGELOG.md](CHANGELOG.md)
- 模块级系统性结构：本目录 14 篇编号文档（**0.1.7-rc.1 全量基线沿用**，各篇顶部"基线说明"已注明）
- 想知道"创造模式的插件指引现在长什么样、prompt 怎么瘦下来的"：[15-creator-mode-guidance.md](15-creator-mode-guidance.md)
- 跨多版本升级者：先读 [../v0.1.7-rc.1/plugin-migration-guide.md](../v0.1.7-rc.1/plugin-migration-guide.md)（0.1.6→0.1.7 的契约换代），再读本目录迁移指南
