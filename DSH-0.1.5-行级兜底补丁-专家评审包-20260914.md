# DSH 0.1.5 行级兜底补丁 — 专家评审包（第 2 轮，2026-09-14）

> 目的：把"待评审对象 + 判定依据 + 已知缺口 + 需要被挑战的问题"打包成一份自足材料，
> 供外部专家级 LLM 在一个回合内完成可信评审，无需重建全部背景。
> 第 1 轮评审结论为 **needs_revision**（三条同类相邻通路未覆盖），本轮为修订后重审。
> 本文件只做**评审引导**；权威证据在 `findings.md`、`spec.md`、`checklist.md`、根因 SOP。

---

## 1. 评审对象（精确坐标）

| 项 | 值 |
|---|---|
| 上游仓库（本地克隆） | `E:\test\rewrite-agently\dsh-repo` |
| 补丁分支 | `fix/session-projection-row-containment`（仅本地，未推送） |
| 基点 | `legacy/dsh-v0.1.5-rc.2` = `fb2c4b9e69` |
| **提交（终态，第 2 轮）** | **`dc4f3684c053dabdd50da3940e010ae18f8d1b02`** |
| 第 1 轮提交（已被 amend 取代） | `215dcf3b36`（7 文件，+149/−13） |
| 补丁文件 | `dsh-docs-deliverables\0001-fix-session-contain-non-JSON-projection-values-at-ev.patch`（37.1 KB，LF，`git format-patch` 产物） |
| 上游 master（对照） | `c291e7961a`（= 0.1.5 已发布线，`git worktree` 实测 `git apply --check` → **exit 0**） |
| 改动规模 | **11 文件，+338 / −23** |
| 运行版本（本机实际） | DSH `0.1.2-rc.1`（**注意：补丁目标线是 0.1.5，两者为不同 line**） |

改动文件清单：

```
.agents/notes/implemented/architecture/2026-09-14-session-projection-row-containment.i18n.yaml  |   6 ++
.agents/notes/implemented/architecture/2026-09-14-session-projection-row-containment.md         |  38 +++
.agents/notes/implemented/architecture/2026-09-14-session-projection-row-containment.zh.md      |  38 +++
packages/api/session-controller/src/control.ts                                                 |  24 ++-
packages/api/session-controller/src/history.ts                                                 |  17 ++-
packages/api/session-controller/src/list.ts                                                    |  23 ++-
packages/api/session-controller/src/projection-values.ts            (新增)                      |  37 +++
packages/api/session-controller/tests/session-projections.host.spec.ts                          | 111 ++++
packages/api/session-controller/tsconfig.host.json                                             |   1 +
packages/session/session-projection-cache/src/index.ts                                          |  23 ++-
packages/session/session-projection-cache/tests/cache.spec.ts                                   |  43 ++-
```

---

## 2. 被修的问题（一句话 + 两条失败模式）

**一个插件的一个字段越出"无损 JSON"集合，就会让"承载它的通路"失败或腐化**，
而该字段本身只是**派生数据**（投影快照），不是会话日志内容。

四条通路、两种失败模式（全部已取证）：

| 通路 | 序列化 | 失败模式 |
|---|---|---|
| 检查点记录写入（`SessionProjectionCache.put()`） | `snapshotJsonValue` 校验 | **整条抛错**；写入 fail-soft ⇒ 缓存冻结在旧水位（实测 `lag=129`） |
| 转发的宿主事件 `api-session/added` | `assertJsonArgs` 校验 | **整条抛错** ⇒ 客户端永远收不到该会话的列表条目 |
| 控制流 baseline / 变更帧（`session/control`） | `JSON.stringify`，**无 JSON 校验** | **静默腐化**：`Map → {}`，无任何告警 |
| `session/follow` 快照的 projections 块 | 同上 | **静默腐化**，同上 |

故障链（已复现）：`dsh-live-token-stats@0.4.3` 的 `liveTokenStats` 折叠把 `state.active.actualTokens`
（步骤被杀、无 usage 时为 `undefined`）复制进 `lastSettled` → state / wire view 不是无损 JSON
→ ①检查点整条写失败 ②`api-session/added` 整条抛错 → 列表行重连后消失、fork 的失败被 `.catch(() => {})` 吞掉。

**共同错误前提**（第 1 轮评审新发现，本轮已修）：四条通路都假定"经过单元 `viewSchema` 的值就是 JSON 安全的"。
`viewSchema` 是 **Zod 校验**，它接受 `Map`、`Date`、以及含 `undefined` 值的对象；
`SessionProjectionValues` 类型虽声明 JSON 安全，却无法约束**本编译面之外**贡献的值。

---

## 3. 补丁做了什么（每条通路在自己粒度上降级）

原则：**只收敛失败粒度，不归一化、不改写值、不改严格度、不碰会话日志。**

### 边界 A — 检查点写入 `SessionProjectionCache.put()`

```ts
private async put(id: SessionId, identity: CheckpointIdentity, rows: ProjectionCheckpoint): Promise<void> {
  const detached: Record<string, unknown> = {}
  for (const [key, row] of Object.entries(rows)) {
    const value = snapshotJsonValue(row)
    if (value === undefined) {
      this.ctx.logger.warn(
        `session projection cache: omitted projection row "${key}" for "${id}" (its state violates the plain-JSON contract); that key refolds on the next cold read`,
      )
      continue
    }
    detached[key] = value
  }
  await this.requireTable().put(id, { identity, rows: detached as CheckpointRecord['rows'] })
}
```

- 原来：`snapshotJsonValue(rows)` **整条**校验，失败即 `throw TypeError`（调用侧 `flushSoft` 仅 `warn`）。
- 现在：**逐行**校验；非法行省略 + 一条具名 warn；其余行照常落同一水位。
- 依据：`restoreFloor` 本就把"缺失行"当作该 key 的**重折底线**，语义由缓存自己定义，不需要新概念。

### 边界 B — 唯一的列级规则 `losslessProjectionValues()`（新增模块）

```ts
export function losslessProjectionValues(
  values: Readonly<Record<string, unknown>>,
  onDropped: (key: string) => void,
): SessionProjectionValues {
  const kept: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values)) {
    if (isJsonValue(value)) { kept[key] = value; continue }
    onDropped(key)
  }
  return kept as SessionProjectionValues   // 每个存活项都过了 isJsonValue，即 SessionProjectionValue 契约
}
```

**三条 wire 通路都只经由它取值**（这是第 1 轮评审要求的"失败域收窄完整"）：

1. `ApiSessionList.projectionsFor()`（列表提示 + `api-session/added` 载荷）—— 第 1 轮已有，本轮改为复用。
2. `SessionControlController.projectionBaseline()`（控制流 baseline）—— **本轮新增**，warn 前缀 `session-controller.control`。
3. `history.ts` `projectionBlock()`（`session/follow` 快照）—— **本轮新增**，warn 前缀 `session-controller.history`。

### 边界 C — 控制流变更帧在广播前丢弃（本轮新增）

```ts
ctx.sessionProjections.onChanged((session, key, value, seq) => {
  if (!isJsonValue(value)) {
    ctx.logger.warn(
      `session-controller.control: projection "${key}" of "${session.id}" is not lossless JSON; skipping its frame`,
    )
    return
  }
  this.broadcast({ type: 'projection', sessionId: session.id, key, value: value as JsonValue, seq })
  ...
})
```

- 依据：客户端**无法正确接收**的帧，绝不作为被污染的帧发出去（`JSON.stringify` 会把 `Map` 变成 `{}`）。
  丢掉该帧后客户端保留旧值，与缓存"陈旧但绝不错"的语义一致。
- 顺带消除一个潜在抛错点：`key === 'inbox'` 时的 `queueItemsFromInbox(value as InboxState)` 不再可能在坏值上抛。

### 四条共同遵守

- `isJsonValue` 严格度**未改**；`api-remotes.assertJsonArgs` 拒绝语义**未改**；会话日志**未动**；对外签名**未变**。
- 不写 `null` 兜底：客户端判的是 `lastSettled.actualTokens !== void 0`，**缺失键才是"没有统计"的正确语义**，`null` 会被 `formatInt(null)` 误读。
- 每次省略/跳过都有 warn（key + session id + 所在通路），不做静默掩盖。

---

## 4. 测试与门禁（第 2 轮实跑，全绿）

环境：`dsh-repo` 已 `pnpm install --ignore-scripts`，在 `dc4f3684c0` 上执行。

| 门禁 | 命令 | 结果 |
|---|---|---|
| 聚焦单测（边界 A） | `pnpm vitest run packages/session/session-projection-cache/tests/cache.spec.ts` | **26/26 通过** |
| 聚焦单测（边界 B/C） | `pnpm vitest run packages/api/session-controller/tests/session-projections.host.spec.ts` | **28/28 通过** |
| 邻域单测（7 文件） | 上二 + `session-list-blank` / `control-queue` / `control-jobs` / `session-history-journal` / `controller` | **98/98 通过** |
| 改动包+邻域**全量目录**（5 包） | `pnpm vitest run packages/api/session-controller packages/session/session-projection-cache packages/session/session-projection packages/session-query packages/api/gateway` | **64 文件 / 1422 passed, 1 skipped**（连跑 5 次） |
| **全量单测（改动后）** | `pnpm run test` | 1198 文件：**28 failed / 1159 passed / 11 skipped**；用例 **62 failed / 20744 passed / 95 skipped**（484.5s） |
| **全量单测（未打补丁基线）** | 同上，先把 7 个可执行改动文件回退到 `fb2c4b9e69` | 1198 文件：**22 failed / 1165 passed / 11 skipped**；用例 **65 failed / 20735 passed / 95 skipped**（475.3s） |
| **覆盖率（改动文件）** | `pnpm vitest run --coverage --coverage.include=…` 跑 5 个相关包全量 spec | `projection-values.ts` **100/100/100/100**（7/7 行、2/2 分支、1/1 函数）；`control.ts` / `history.ts` / `list.ts` 均 **100** |
| **覆盖率（全仓门禁）** | `pnpm run test:coverage` | **未产出终判**：插桩使耗时 ~3.5×（1690s），40 文件 / 82 用例先因超时类失败中止；我的两个 spec 在该轮均 ✓ |
| 宿主类型 | `pnpm exec tsc -b tsconfig.host.json` | exit 0 |
| 宿主构建 | `pnpm run build:lib:host` | exit 0（其它门禁的前置） |
| 客户端类型 | `pnpm exec tsc -b tsconfig.client.json` | exit 0 |
| Lint | `pnpm exec tsx scripts/run-oxlint.ts .` | **0 warnings / 0 errors**，3508 文件，90 规则，63.7s |
| Agent Note 格式 / 分类 | `verify-agent-note-format` / `verify-agent-note-classification` | 326 notes 通过 / 通过 |
| 文档换行 / 链接 | `verify-md-wrap` / `verify-md-links` | 1579 / 1572 通过 |
| 翻译配对 | `verify-translation-pairing` | **790 对通过** |
| 文档测试 | `pnpm run test:docs` | **16 passed / 0 failed / 0 skipped**，45.5s |
| 包依赖 / 导出 JSDoc | `verify-package-dependencies` / `verify-export-jsdoc` | 60 packages / 通过 |
| tsconfig 别名 | `gen-tsconfig-paths.ts --check` | "package aliases are current" |

**一次环境性假阴性（已排除）**：未构建时直接跑 client tsc 与 lint 会失败（763 条 type-aware 报错，位置全在未改动包）；
`build:lib:host` 之后全绿 ⇒ 与补丁无关。

**一次真实的构建门禁拦截（已修）**：新模块 `src/projection-values.ts` 首次 `tsc -b tsconfig.host.json` 报
`TS6307: … is not listed within the file list of project` —— 该包 host 面用显式 `files` 列表，本轮已把新文件登记进去。

### 新增用例的双向证明（反证矩阵）

每条新用例都在**一个真实变体**上被观察到失败，再在终态上通过：

| 变体（临时回退的部分） | 观察到的失败 |
|---|---|
| `control.ts` / `history.ts` / `list.ts` 回退到第 1 轮提交 | host spec `2 failed`：`omits a non-lossless cell from the tail block…`、`omits one non-lossless cell from the baseline` |
| 仅移除控制流变更帧的 `isJsonValue` 守卫 | host spec `1 failed`：`skips a non-JSON projection change frame…`，断言输出 `expected [ 'test/last-user', 'test/lossy' ]`（即坏帧确实被广播了） |
| `list.ts` 与 `session-projection-cache/src/index.ts` 回退到**未打补丁的基点** `fb2c4b9e69` | cache spec `2 failed` + host spec `2 failed`：`write() checkpoints a never-dirty session and omits only the non-JSON unit row`、`still advances the record when every registered row violates…`、`leaves the column out entirely when every cached cell is not lossless JSON`、`omits one non-lossless cell while keeping the row…` |

即：**第 2 轮新增的 6 条用例（5 条 host + 1 条 cache）各自都有可复现的失败配置**（不是只在"改完之后恰好通过"）。

---

### 全量测试：与未打补丁基线逐项比对

全量 `pnpm run test` 在本机并非全绿（Windows + 16 worker 竞争 + 缺少 codex 可选二进制），因此**只有与基线比对才能说明增量**。同机同环境跑了两次：

| 运行 | 文件 | 用例 |
|---|---|---|
| 改动后 `dc4f3684c0` | 28 failed / 1159 passed / 11 skipped | 62 failed / 20744 passed / 95 skipped |
| 未打补丁 `fb2c4b9e69`（7 个可执行文件回退） | 22 failed / 1165 passed / 11 skipped | 65 failed / 20735 passed / 95 skipped |

- **用例总数差 = +6**（20901 对 20895，skipped 均为 95）＝ 恰好是本轮新增的 6 条用例，无其它测试被影响。
- **共同失败 32 条**（两次都失败的稳定环境基线）；只在改动后失败 22 条、只在基线失败 12 条 —— **双向**差异正是 flake 特征。
- **两个方向的差集里都没有任何一条落在被改动包**（`session-controller` / `session-projection-cache` / `session-projection` / `session-query` / `api/gateway`）。
- 失败类别：5s 超时（改动后 32 处 / 基线 19 处，最慢的一次 import 1736s）、缺可选依赖 `@openai/codex-win32-x64`（7）、Windows ACL `CreateProcessAsUserW failed (Win32 2)`（6）、codex app-server 流关闭（5）、inspector/UI 渲染类 —— 全部位于本补丁未触及的包。
- 相邻证据：改动包+邻域的 64 个 spec 连跑 5 次全绿，其中一次冷态（清空 `node_modules/.vite`）也全绿；唯一一次瞬态失败（`cache.spec.ts > flushes when the in-turn event count…`）发生在最慢的一次冷跑，且该用例是**既有**用例、文件顺序在我的新增用例之前，无法由本补丁影响。

即：**全量套件没有暴露任何与本补丁相关的新增失败**；反过来，它也没能给出"全绿"结论，这一点如实披露。

---

## 5. 已知缺口与残余风险（诚实披露）

1. **全量单测不是全绿**（改动后 62 失败 / 基线 65 失败，均为 Windows/超时/缺可选依赖类，且不含被改动包）——见上表；本机无法给出"全绿"基线，CI 才是权威。覆盖率门禁（`pnpm run test:coverage`）因插桩后超时先行中止，未取得终判；但**被改动文件的 per-file 100% 已单独核验通过**。
2. **未做真机端到端验机**：补丁面向 0.1.5，本机运行 0.1.2-rc.1；装机与验证按约定由用户执行（AI 边界外）。
3. **未跑完整 `pnpm run doc-sync` 聚合**，只跑了全部相关单项门禁（全绿）。全仓 `pnpm run typecheck` 已跑，exit 0。
4. **持续坏行 ⇒ 冷读延迟代价（已量化）**：被省略的行把 `restoreFloor` 拉到最小值 **0**，因此下一次冷读要从**日志起点**重读；被省略的 key 从 init 重折，其余 key 仍以各自缓存行为种子。未加抑制/告警升级机制。
5. **产出方插件未修**：`dsh-live-token-stats` 仍会把 `undefined` 复制进 `lastSettled`，该列在列表与 stream 帧中**持续缺席**（数据可用性下降，但不阻断会话）。插件侧 `compact()` 出口清理属独立交付（Phase 3），尚未开始。
6. **无宿主内守卫**：没有"越界即断言"的 invariant 伴生；检测目前靠离线探针（Phase 7 未完成）。
7. **upstream 未提交 PR**：补丁已推送到 fork `drscrewdriver/deepseek-harness` 的分支 `fix/session-projection-row-containment`（`dc4f3684c0`），PR 待用户发起：https://github.com/drscrewdriver/deepseek-harness/pull/new/fix/session-projection-row-containment 。上游对"仅收敛失败粒度"的最小 PR 的接受度仍未知。
8. **`isJsonValue` 仍是布尔而非类型谓词**：因此 `losslessProjectionValues` 末尾保留**一处**断言（第 1 轮评审指出 4 处，现收敛为 1 处，并已在注释中说明依据）。把 `isJsonValue` 改成类型谓词会改变上游契约，属超出本补丁范围的选择。

---

## 6. 第 1 轮评审结论与逐条回应

第 1 轮判定 **needs_revision**：方向正确、已覆盖的两条边界实现无误，但"失败域收窄不完整"。
以下逐条回应（**全部结论均已在源码上独立复核，未直接采信评审文字**）：

| # | 第 1 轮要求 | 状态 | 证据 |
|---|---|---|---|
| 1 | `control.ts:projectionBaseline()` 逐列过滤 + warn | ✅ 已做 | `snapshot()` 确为 live fold（`session-projection/src/index.ts:338`，JSDoc 明写 "missing cells fold lazily"），故该通路确实可携带非 JSON 值 |
| 2 | `control.ts` `onChanged` 广播前校验 | ✅ 已做 | 发射点 `index.ts:689` 只做 `wire.viewSchema.parse(views[1])`，无 JSON 校验 |
| 3 | `history.ts:projectionBlock()` 同模式过滤 | ✅ 已做 | `observeSession` 的 live 分支直接 `sessionProjections.snapshot(session)`（`observation.ts:284`）；`prepared` 分支经 `hydratePrepared` 仍可能重折出坏值 |
| 4 | 修正 `control.ts:98` / `history.ts:298` 误导性注释 | ✅ 已做 | 两处注释改为明写 "`viewSchema` 不是 JSON 校验"；Agent Note 记录了该认知修正 |
| 5 | 补两个边界用例（全行非法 / 全列非法） | ✅ 已做 | `cache.spec.ts` 全行非法 ⇒ 记录仍以空 rows 落盘；host spec 全列非法 ⇒ 行存活且无 `projections` 列 |
| 6 | Agent Note Consequences 记录 stream 静默腐化风险 | ✅ 已做 | Note 改以"四条通路"叙述，Problem 明写 `Map → {}`，Consequences 增补 `restoreFloor → 0` 的代价精度 |

同时确认第 1 轮的**其余判断**（未触发返工，但已逐条核对）：

- `parseRemoteStreamServerMessage` 确实不校验 `value`（`stream-protocol.ts:294` 只查键名与 id），
  服务端 `stream-server.ts:183` 的唯一序列化是 `JSON.stringify` ⇒ "静默腐化"成立。
- `restoreFloor` 取所有注册 key 的 `Math.min`，缺失行 `need = 0` ⇒ 第 1 轮对"全会话重读"的修正成立，已写入 Note。
- `SessionProjectionValue = JsonValue`（`types.ts:611`）⇒ 断言对象正确；`isJsonValue` 为布尔函数 ⇒ 断言无法消除，已在注释中说明。
- 全通路清单已系统扫描（`sessionProjections.snapshot(` / `.cachedSnapshot(` / `.hydratePrepared(` / `.viewCheckpoint(` /
  `.onChanged(` / `projections.values` 六个检索面）⇒ **不存在第 5 条通路**；`agent.ts:508` 与 `skill-catalog.ts:47`
  只读取 `agentPreset` 主机状态，不是承载通路。

---

## 7. 请评审者重点挑战的问题（第 2 轮）

1. **粒度选择**：省略"行/列"、丢弃"帧"是否都是正确粒度？是否有比"省略"更该做的动作（退旧值 / 写 `null` / 整条失败 + 更响告警 / 直接 crash 以尽早暴露）？丢弃变更帧会不会让客户端**永久**停在旧值（第 1 轮判为"有界风险，仅当产出方持续坏且客户端永不重新 follow"——是否同意）？
2. **静默性**：三条通路各一条 warn 是否足以避免"掩盖缺陷"？是否需要计数器/指标/可选 strict？若需要，应放在补丁里还是留给上游？
3. **`asOfSeq` 语义**：省略一格而保留注册表切点，下游（列表、其他消费者）会不会把它当成"该列就是没有"从而永久缓存缺失？
4. **`restoreFloor` 一致性**：把"行缺席"当作"该 key 的重折底线"是否与真实实现一致（含多 key、部分 key、predecessor/分支场景）？会不会影响 `settled` 判定与后续 `--verify` 的 `unsettled` 列表？
5. **类型断言**：`detached as CheckpointRecord['rows']` 与 `kept as SessionProjectionValues` 两处是否掩盖了真实类型不匹配？是否应把 `isJsonValue` 改为类型谓词（会触碰上游契约，需论证）？
6. **失败域是否真的收窄完整**：是否还有第 5 条通路（请给出反例），或某个通路在**其他阶段**（如 `cachedPredecessorTitle`、`session/page`、RPC 结果路径）仍会被同一类输入击穿？
7. **测试充分性**：两个边界用例（全行非法 / 全列非法）与三条新通路的用例是否真正双向（见 §4 反证矩阵）？还缺哪些（如"同一 record 内多行混合合法/非法"、"warn 文案被断言"、"`prepared` 分支的坏值"）？
8. **契约合规**：列表提示"部分契约"是否被本次省略**越界使用**（扩大成"允许任意缺失"）？控制流 baseline 与 follow 块的契约是否同样支持"少一格"？Agent Note 的 Decision/Consequences 是否如实承认了这一扩张？
9. **版本策略**：只改 0.1.5 线、legacy 分支仅承载同一收敛补丁（YAGNI）是否合理？补丁在 `c291e7961a` 上可干净落地，是否应直接对 master 出 PR 而非对 tag 分支？
10. **替代方案**：是否存在更小/更正确的替代（只改插件 / 只在客户端容错 / 只在转发层 strip / 在注册表 `viewCell` 出口统一校验）？为什么本方案优于它们，或者并不优于？
11. **反例构造**：请尝试构造一个"补丁之后仍会丢失会话可用性、或仍会静默腐化投影值"的真实输入（越界值出现在别的字段/别的阶段）。若构造成功，请给出可复现路径。

---

## 8. 建议的判定标准

- **pass**：同意"各通路按各自粒度降级"是当前最优的最小改动；缺口清单如实且不构成阻断；无需结构性返工。
- **needs_revision**：给出**具体**需改的点（文件 + 行为 + 期望），且说明为何现有实现不成立。
- **reject**：指出方案在语义上根本错误（例如确诊"省略行会破坏缓存不变量"或"某条通路不是真正失败点"），并给出可复现证据。

评审请尽量落到**可证伪的具体断言**（"若 X，则 Y 会失败"），而不是风格偏好。

---

## 9. 相关材料索引

| 材料 | 路径 |
|---|---|
| 根因复现与恢复 SOP（含 I1/I2/I3 三层判据） | `dsh-docs-deliverables\DSH-会话不可恢复-根因复现与恢复SOP-20260914.md` |
| 计划包（spec / checklist / tasks / findings） | `.agents\plans\dsh-session-log-robustness\` |
| 上游必要性论证（八条）与官方态度取证 | `.agents\plans\dsh-session-log-robustness\findings.md`（Agent A/C/E） |
| 补丁本体（第 2 轮） | `dsh-docs-deliverables\0001-fix-session-contain-non-JSON-projection-values-at-ev.patch` |
| 离线行级检测探针 | `_tools\dsh-projection-state-probe.mjs` |
| 检查点修复/校验工具 | `_tools\dsh-projcache-repair.mjs` |
| 真机 RPC 探针（可复现 fork 失败） | `_tools\dsh-host-rpc-probe.mjs` |
