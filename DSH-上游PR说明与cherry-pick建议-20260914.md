# 上游 PR 说明与 cherry-pick 建议（2026-09-14）

> 用途：①记录"同步 upstream master 之后我们的改动是否仍成立"的核验结论；②提供可直接粘贴的上游 PR/Issue 正文（英文主稿 + 中文对照）；③在上游不接受 PR 时，给出让维护者 cherry-pick 的说明与命令。

---

## 1. 同步后的状态核验（改动仍然成立）

分支在 2026-09-14 由用户把 `deepseek-ai:master` 合并进 `fix/session-projection-row-containment`，本地已快进到远端：

| 项 | 值 |
|---|---|
| 分支 HEAD | `3e6cf80a4e`（`Merge branch 'deepseek-ai:master' into fix/session-projection-row-containment`） |
| 合并第二父 | `c291e7961a` = 当前 upstream master（也是 `fork/master`） |
| 补丁提交（可 cherry-pick 单元） | **`dc4f3684c0`**（单提交，非 merge） |
| 分支相对 master 的差异 | **恰好 11 个文件，+338 / −23** —— 与合并前逐字节一致 |
| 上游是否动过我碰的文件 | 是（同一包内 `history.ts` +1 行，`types.ts`/`commands.ts`/`index.ts`/`skill-catalog.ts` 各 +1~2 行）—— **合并无冲突**，我的改动原样保留 |

合并后的树上重跑门禁（全部通过）：

| 门禁 | 结果 |
|---|---|
| 改动包+邻域全量 spec（5 包） | **65 文件 / 1426 passed, 1 skipped** |
| `tsc -b tsconfig.host.json` | exit 0 |
| `pnpm run build:lib:host` | exit 0 |
| `tsc -b tsconfig.client.json` | exit 0 |
| `run-oxlint.ts .` | **0 warnings / 0 errors**（3572 文件，90 规则，60.7s） |
| Agent Note 格式 / 分类 | 344 notes 通过 / 通过 |
| 翻译配对 | **809 对**通过 |
| md 换行 / 链接 | 1617 / 1610 通过 |
| 改动文件 per-file 覆盖率 | `projection-values.ts` **100**（7/7 行、2/2 分支、1/1 函数）；`control.ts` / `history.ts` / `list.ts` 均 **100** |

结论：**改动在同步后完全成立**，且因为分支现在包含 master，PR 可直接合并（无 rebase 需求）。

---

## 2. 如何介绍我们的增强（英文主稿，可直接粘贴）

> 建议用途：作为 PR 描述，或作为 Issue 正文（若维护者更希望先讨论再收）。

**Title:** `fix(session): contain non-JSON projection values at every carrier`

**Summary**

A projection unit whose state or wire value is not lossless JSON currently fails — or silently corrupts — the whole carrier that delivers it. One such field from one installed plugin made an otherwise healthy Session unusable: `session/fork` rolled back and the session's row disappeared from the listing on reconnect, while the transcript stayed readable through a different path.

**Root cause**

Projection definitions validate their value with a Zod `viewSchema`, which is not a JSON check: it accepts a `Map`, a `Date`, or an object holding an `undefined`-valued key. Four carriers then mishandle such a value in two different ways:

| Carrier | Serialization | Failure |
|---|---|---|
| `SessionProjectionCache.put()` (checkpoint record) | `snapshotJsonValue` validation | throws; the write is fail-soft, so every row of that session stays at the previous cut (observed: 129 events of lag) |
| forwarded host event `api-session/added` | `assertJsonArgs` validation | throws, so the Client never receives the session |
| `session/control` baseline and change frames | `JSON.stringify`, **no JSON check** | silently corrupts (`Map` → `{}`) |
| `session/follow` snapshot projections block | same | silently corrupts |

Observed trigger: a step that ends without usage leaves `state.active.actualTokens` undefined, and a stats plugin copies it into `lastSettled`, so the wire value is `{"activeStep":{"lastSettled":{"actualTokens":undefined}}}`. Six sessions on one machine hit this; the session logs themselves stayed fully readable.

**What this changes**

- `SessionProjectionCache.put()` detaches and validates each row separately; a row that is not losslessly serializable is omitted with one warning naming the key and session — an absent row is already that key's refold floor through `restoreFloor` — and the remaining rows land on the same cut.
- A new `losslessProjectionValues()` owns the cell rule for every wire carrier: the listing hints, the control baseline, and the `session/follow` projections block each keep only the cells `isJsonValue` accepts and warn per dropped key.
- The control change feed drops a frame whose value is not lossless JSON instead of broadcasting one the Client can only receive corrupted.
- `asOfSeq` stays the registry's cut in every carrier, so an omission can only overstate staleness; `isJsonValue` keeps its strictness; nothing normalizes, strips, or reinterprets a business value, and no Session log is touched.

**What this does not do**

- It does not fix producers: a persistently offending unit keeps losing its own cell or row, and costs that key a full-log replay on the next cold read. Producer-side correctness stays a separate obligation.
- It adds no strict mode, counter, or metric — that is a policy choice better made by you.
- It does not relax the forwarded-event rejection, does not change the Client, and does not change any wire type.

**Verification**

- Focused specs: `session-projection-cache/tests/cache.spec.ts` 26/26, `api/session-controller/tests/session-projections.host.spec.ts` 28/28; the 5 touched/neighbour packages' full spec set: 65 files / 1426 passed.
- Every new case fails in a real variant without its guard (temporary reverts of the sources), so the guard is proven bidirectional rather than merely green.
- Coverage: the new module is at 100% lines/branches/functions, and the three modified files stay at 100%.
- The commit carries the required Agent Note (bilingual pair + i18n record).

**Why the platform rather than the producer**

Projection units are an open set, while the consequence of one bad field is session-level unavailability. The carriers already define the needed semantics: the projection cache is documented as a fold shortcut that is "as stale as their rows, never wrong", the listing hints are documented as partial ("missing cells and cache rows are never materialized here"), and `restoreFloor` already reads an absent row as that key's refold floor. The read side is already tolerant in exactly this way — `viewCheckpoint` leaves a key absent for a mismatched, malformed, or absent row, and `hydratePrepared` retries from the exact log because "cached rows are disposable derived data" — while the write side had no such tolerance. This change completes that existing asymmetry instead of introducing a new policy.

**On the "trust typed same-process boundaries" rule**

`AGENTS.md` says not to add runtime validation for values a static interface requires, and to validate at parser/config, queued, model/tool JSON, durable/file, worker, process, and wire boundaries instead. That rule is why this gap survived: the registry is same-process and its units are typed. It does not apply to the output side of these values, because (a) the producer set is open — third-party plugins, which no static interface can close — and (b) the values leave through durable and wire boundaries (the persisted checkpoint record, a forwarded host event, and two Remote stream items). What was missing is not another validation layer but the right failure granularity at boundaries that are already required to validate.

---

## 3. 中文对照（供内部复核或中文 Issue）

**标题：** `fix(session): 在每一条通路上收敛非 JSON 投影值`

**摘要**

当某个投影单元的状态或 wire 值不是无损 JSON 时，**承载它的整条通路**会失败或**静默腐化**。某个已安装插件的一个字段就让一个本来健康的会话不可用：`session/fork` 回滚、重连后列表行消失，而正文仍能通过另一条路径读到。

**根因**

投影定义用 Zod `viewSchema` 校验取值，而 Zod 校验不是 JSON 校验：它接受 `Map`、`Date`、以及含 `undefined` 值的对象。于是四条通路以两种方式处理失当（表同上）：检查点写入与转发事件**整条抛错**；`session/control` 的 baseline/变更帧与 `session/follow` 快照块因为只做 `JSON.stringify`（**没有 JSON 校验**）而**静默腐化**（`Map` 变成 `{}`）。

触发实例：步骤在没有 usage 的情况下结束，`state.active.actualTokens` 为 `undefined`，统计插件把它复制进 `lastSettled`，wire 值即 `{"activeStep":{"lastSettled":{"actualTokens":undefined}}}`。单机 6 条会话命中；会话日志本身仍完全可读。

**改了什么**（同英文四条）与**没改什么**（不修生产方、不加 strict/计数器、不放宽转发拒绝、不动客户端与 wire 类型）。

**为什么由平台承担**：投影单元是开放集合，而一个坏字段的代价是会话级不可用；四条通路早已各自定义了所需语义（缓存是"至多陈旧、绝不错"的折叠捷径；列表提示按契约就是部分；`restoreFloor` 本就把缺失行当作该 key 的重折底线）。

---

## 4. 若上游不接受 PR：如何建议维护者 cherry-pick

**一句话主张**：这是一个**单提交、零契约变更、可 3-way 干净落地**的最小收敛补丁，维护者可以在不回我们的分支、不给 review 成本的前提下直接拾取。

**给对方的三条命令（任选其一）**

```sh
# 1) 直接 cherry-pick 单个提交（推荐；-x 记录来源）
git cherry-pick -x dc4f3684c053dabdd50da3940e010ae18f8d1b02

# 2) 用补丁文件（离线可用，附带完整 commit message）
git am 0001-fix-session-contain-non-JSON-projection-values-at-ev.patch

# 2b) 或用"以 master 为上下文"的 diff（不含 commit message，用 git apply）
git apply fix-session-projection-values-on-master.diff

# 3) 合并我们的分支（分支已包含 master，无 rebase 需求）
git remote add drscrewdriver ssh://git@github.com/drscrewdriver/deepseek-harness.git
git fetch drscrewdriver fix/session-projection-row-containment
git merge drscrewdriver/fix/session-projection-row-containment
```

两个补丁产物都在 `dsh-docs-deliverables/`：`0001-…patch`（`git format-patch` 产物，带 message）与 `fix-session-projection-values-on-master.diff`（`git diff c291e7961a 3e6cf80a4e --output=…` 产物，上下文取自 master）。**两者都已在 `c291e7961a` 的干净 worktree 上实测 `git apply --check` → exit 0**。

**为什么 cherry-pick 是安全的（可核对的事实，而非承诺）**

- **单提交**：`dc4f3684c0` 是非 merge 提交；分支上的 merge 提交只是把 master 并进来，cherry-pick 不需要它。
- **零契约变更**：不改任何对外类型、事件、RPC 名或会话格式；`isJsonValue` 严格度、`api-remotes` 的拒绝语义、会话日志全部未动。
- **无隐藏依赖**：只依赖已有的 `@deepseek-ai/dsh-util-values`（已是该包 peerDependency）与两个既有内部符号（`snapshotJsonValue`、`restoreFloor` 语义）。
- **可落地性已实测**：在 `c291e7961a`（当前 master）上 `git apply --check` → exit 0；本次 upstream master 合并进分支也是**零冲突**，且合并后分支相对 master 的差异仍恰好是这 11 个文件。
- **自证**：同 PR 附 Agent Note（双语 + i18n 记录）与 6 条新用例；每条新用例都在"移除守卫"的真实变体上被观察到失败（双向证明）。
- **可回退**：改动集中在 2 个包、4 个源文件；`git revert` 单提交即可完全移除，无数据副作用（不迁移、不清洗、不改历史数据）。

**回退/共存说明**

- 若维护者只想要其中一半：`SessionProjectionCache.put()` 的行级收敛与 wire 侧的列级收敛彼此独立，可拆成两个提交分别拾取（需要我出拆分补丁就说）。
- 若维护者更倾向"整条失败 + 更响告警"的取向：请告知，我可以把 warn 换成结构化计数/strict 开关——这是策略选择，我们此前按最小改动取舍。

**我们这边会做的配套**

- 分支会持续保持基于 master 可合并（不引入额外改动、不改写已推送提交的历史）。
- 生产方缺陷（把 `undefined` 复制进 wire 值的那个插件）由我们在插件侧独立修复，**不混进本补丁**。

---

## 5. 预设质疑与回答（评审/维护者常问）

| 质疑 | 回答 |
|---|---|
| 为什么不修插件就行？ | 生产方是开放集合；且 stream 通路的腐化对任何插件都会发生。平台在此承担的是"承载方式"，不是"业务值"。 |
| 省略会不会掩盖缺陷？ | 每次省略都带 key + 会话 id + 通路名告警；定位信号在日志里。strict/计数属于上游策略，未在补丁里替上游决定。 |
| 为什么不用 `null` 兜底？ | 客户端判的是 `!== void 0`，缺失键才是"无统计"的正确语义；`null` 会被当成"有值"渲染。 |
| 会不会影响历史数据？ | 不迁移、不清洗、不改日志；只影响此后写入的派生快照，且省略的行按既有 `restoreFloor` 语义重折。 |
| 性能代价？ | 持续坏行会让该会话冷读时从日志起点重读（floor → 0），这是"省略行"的已知代价，已在 Agent Note 的 Consequences 中量化披露。 |
| 为什么在 stream 上"丢帧"而不是发出去？ | 客户端无法正确接收的帧只能被腐化接收；丢帧后客户端保留旧值，与缓存"至多陈旧、绝不错"一致。 |
