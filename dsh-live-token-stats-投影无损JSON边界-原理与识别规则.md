# dsh-live-token-stats 投影无损 JSON 边界：原理、识别规则与修复模式

- 日期：2026-09-14
- 适用：DSH 0.1.5-rc.2 及同类宿主；`dsh-live-token-stats@0.4.3` 及更早
- 结论状态：已在 fork `drscrewdriver/dsh-live-token-stats` 的分支 `fix/lossless-json-state-boundary` 修复并离线验证
- 关联：`DSH-会话不可恢复-根因复现与恢复SOP-20260914.md`（现场与恢复步骤）、`_tools/dsh-session-doctor.mjs`（识别工具）

---

## 一、一句话结论

**投影状态里只要有一个字段的值是 `undefined`，整个会话在客户端就会「看不见、接不了、fork 不动、缓存不更新」——一个字段炸三层。**

根因不在宿主，也不在会话日志，而在插件折叠投影时的一个写法：

```ts
// 修复前 src/projection.ts 的 step/end 结算分支
lastSettled: {
  turn: data.turn,
  // …省略…
  actualTokens: state.active.actualTokens,   // ← 被 kill 的 step 从没收到 usage，这里是 undefined
  exact: state.active.exact,
  endTime: event.time,
}
```

`actualTokens` 在类型上是 `actualTokens?: number`，schema 上是 `.optional()`。**`.optional()` 的含义是「该键可以缺席」，不是「该键可以持有 `undefined`」**。赋值 `undefined` 让键存在且值为 `undefined`，这个对象就不再是无损 JSON。

---

## 二、失败链：为什么报错点离根因很远

宿主在两条路径上对「无损 JSON」做硬校验，两条都会被同一个字段同时打穿：

| 层 | 动作 | 校验点 | 失败表现 |
|---|---|---|---|
| 1. 插件折叠 | `apply(state, event)` 产出投影状态 | 无（插件不校验自己） | 污染就地生成 |
| 2. 宿主转发 | `ctx.emit("api-session/added", summaryFor(session))` | `assertJsonArgs` → `isJsonValue()`（`dsh-api-remotes`） | 抛 `forwarded host event "api-session/added" argument 0 is not lossless JSON data`；**客户端永远收不到这条会话** → 列表里条目消失 / 闪跳 |
| 3. 会话操作 | `session/fork` 的 create-publish | 同上 | 整体回滚；客户端侧又被 `.catch(() => {})` 吃掉（`dsh-client-ui-workspace/lib/client.js`） → **点 fork 没有任何反应** |
| 4. 投影缓存 | `session_projcache` 写整条记录 | 写前序列化校验 | 整条写失败（**不做字段级降级**）→ 缓存停在旧 seq，每次打开都从旧状态重算 |

为什么「内容还能看」：冷读走的是 JSON 序列化（`session/follow`），JSON.stringify 会自然丢弃 `undefined` 值键，所以**读内容这条路是通的**，坏的只有「列表条目推送」与「会话级操作」——现象因此非常反直觉：*能看见内容，但选项在工作区消失，也不能接续使用*。

---

## 三、判定口径：什么算「无损 JSON」

宿主 `isJsonValue()`（`@deepseek-ai/dsh-util-values`）拒绝以下值，本仓库 `_tools/lib/lossless.mjs` 与之对齐：

| 类别 | 例子 | 说明 |
|---|---|---|
| `undefined` 值 | `{ a: undefined }` | **本次事故的肇因**；键存在但值未定义 |
| 非有限数 | `NaN`、`Infinity` | 序列化后变 `null`，语义丢失 |
| 负零 | `-0` | 序列化后变 `0` |
| 稀疏数组洞 | `[1, , 3]` | 洞会被序列化成 `null` |
| 非普通原型 | `new Map()`、类实例 | 序列化后丢结构 |
| 函数 / Symbol / BigInt | `() => {}`、`Symbol()`、`1n` | 不是 JSON 类型 |
| 循环引用 | `a.self = a` | 序列化抛错 |
| 不可枚举 / Symbol 键 | `Object.defineProperty(x,'k',{enumerable:false})` | 序列化时丢失 |

注意一个易漏点：`JSON.stringify({a: undefined})` 得到 `"{}"`，**不抛错**。所以「能 stringify 成功」不等于「无损」，这正是插件作者容易误判的地方。

---

## 四、识别规则：四步判据

给任何一个 DSH 插件做体检，按以下顺序判断它是否踩了这条边界：

### 判据 1（值级，判它有没有病）
把会话日志按该插件的投影定义 `init` + `apply` 折叠一遍，对**状态**（不是 wire view）跑无损判定：

```bash
node _tools/dsh-session-doctor.mjs identify <sessionId> --all --explain
# 或只针对本插件做修复前后 A/B
DSH_LIVE_TOKEN_STATS_DIR=<插件仓库根> node _tools/dsh-livetoken-state-scan.mjs --recent 30
```

命中时会直接给出路径：`.activeStep.lastSettled.actualTokens  原因：undefined`。

### 判据 2（schema 判据，判它像不像有病）
在插件源码里搜「schema 里是 `.optional()`、代码里却按普通字段赋值」的字段：

```bash
# 找出所有可选字段名
grep -n "optional()" src/**/*.ts
# 再确认这些字段在哪里被赋值（尤其是有没有可能赋到 undefined）
grep -n "actualTokens:" src/**/*.ts
```

**规则：`.optional()` 字段只允许「条件展开」赋值，即 `...(cond ? { f: v } : {})`，禁止无条件 `f: maybeUndefined`。**

### 判据 3（idiom 误用判据，判它病得多重）
同一个文件里若**已有**正确写法，说明作者知道纪律但漏了一处，属局部缺陷；若全文件都是无条件赋值，属系统性缺陷，需要连同所有可选字段一起过。

`dsh-live-token-stats` 属前者：`:229` 与 `:192` 都是正确的条件展开写法，只有 `step/end` 结算分支漏了。

### 判据 4（反证据，剔除伪阳性）
折叠时报错、或在正常会话上也命中的投影，不算命中——那多半是**离线驱动的伪阳性**（例如核心包的不变量伴生需要真 ctx，用假 ctx 驱动必然抛错）。
判别方法：**取一个已被确认健康的会话做对照组，只有「目标 BAD、对照 ok」的字段才算命中**（`--vs` 参数即此用途）。

---

## 五、修复模式：三种写法，选第一种

| 写法 | 结果 | 是否可用 |
|---|---|---|
| 键缺席（条件展开 / 剔除 `undefined` 键） | 状态无损；客户端 `!== undefined` 判定为「无值」 | ✅ **推荐** |
| 写成 `null` | 状态无损，但客户端把 `null` 读成「有值」→ 展示错误 | ❌ 语义被改 |
| 归一成哨兵值（如 `0`） | 状态无损，但把「没有实际值」伪造成「实际值是 0」 | ❌ 数据造假 |
| 调高 `stateVersion` 重换算 | 不解决边界问题，只是让缓存失效一次 | ❌ 治标不治本 |

本次修复即第一种，落在两处：

1. `src/compact.ts`（新增）：`omitUndefined()` 剔除 `undefined` 值键；`findNonJsonPath()` 定位违规路径；`assertLosslessJson()` 开发期自检（`warn` / `throw` 两档，主机侧只告警不抛错，因为折叠跑在事件回放路径上）。
2. `src/projection.ts`：结算走 `settleStep()` 统一出口；`activeStepView()` 出口再兜一次，防止历史污染状态被转发出去。

**`stateVersion` 无需递增**：本次既没有改字段语义，也没有改折叠语义，只是不再写出一个本就不该存在的值。

---

## 六、复现与证据（A/B）

| 条件 | 命令 | 结果 |
|---|---|---|
| 装机副本 0.4.3（修复前） | `node _tools/dsh-livetoken-state-scan.mjs --recent 30 --verbose` | **6/30 会话非无损**，命中路径一律 `.activeStep.lastSettled.actualTokens`（`exact:false`，即被 kill 的 step） |
| 仓库修复版 | `DSH_LIVE_TOKEN_STATS_DIR=<仓库根> node _tools/dsh-livetoken-state-scan.mjs --recent 30` | **0/30** |
| 全量投影普查（对照法） | `node _tools/dsh-projection-state-probe.mjs --vs <健康会话> <可疑会话>` | `HIT`：仅 `dsh-live-token-stats:liveTokenStats` 一项 |

命中的 6 个会话：`8c015d04…`、`1043bbd4…`、`a395e77d…`、`a3ab8a11…`（后三个是同一事故会话的 fork 子会话）、`12f8bbbf…`、`a09d17bd…`。

**归属**：`_tools/lib/projection-owners.mjs` 扫 profile 的 node_modules 抽「投影 key → 包」索引，本事故归属 `dsh-live-token-stats`（第三方），非内置包。

---

## 七、平台侧加固建议（独立 PR，不混进本次修复）

插件侧修的是「本次这一处」，平台侧应加的是「这一类不再无声发生」：

1. **列级降级 + 显式断言**：投影状态写入/转发前，若校验失败，**按字段粒度剔除并计数告警**（warn 级别、带投影 key 与字段路径），严格模式下直接失败。
2. **红线**：不做静默剥离（剥离必须伴随可见告警）、不做字段重解释（不得把 `undefined` 自动变 `null` 或哨兵值）。
3. 转发失败时应把「是哪个投影、哪个字段」带进错误信息，而不是只报事件名——现在这条信息缺失，是本次定位成本的主要来源。

---

## 八、工具清单

| 工具 | 用途 |
|---|---|
| `_tools/dsh-session-doctor.mjs identify <sessionId> [--all] [--explain] [--discover]` | 定位非无损投影 + 违规字段 + 归属包；`--discover` 会把 profile 里**所有**声明了 `dsh` 字段的第三方插件纳入（假 ctx 驱动 `apply` 抓定义）；退出码 1 表示命中 |
| `_tools/dsh-session-doctor.mjs blast [--recent N]` | 爆炸半径：最近 N 个会话按根因分组 |
| `_tools/dsh-session-doctor.mjs visible <sessionId>` | 向宿主核对会话是否在列表里（无写入，用于对照用户侧现象） |
| `_tools/dsh-session-doctor.mjs fork <sessionId>` | 向宿主发起 fork（成功会生成子会话，谨慎） |
| `_tools/dsh-livetoken-state-scan.mjs --recent N [--verbose]` | 只折叠 `liveTokenStats` 的批量扫描，支持 `DSH_LIVE_TOKEN_STATS_DIR` 做 A/B |
| `_tools/dsh-projection-state-probe.mjs --vs <control>` | 全量投影普查，对照组剔除伪阳性 |
| `_tools/lib/lossless.mjs` | 无损 JSON 判定与违规定位（口径与宿主对齐） |
| `_tools/lib/projection-owners.mjs` | 投影 key → 归属包索引 |
| `_tools/lib/projection-defs.mjs` | 收集当前环境实际生效的投影定义 |
| `_tools/lib/host-rpc.mjs` | 宿主 `/api` RPC 客户端（自签浏览器会话 cookie） |

---

## 九、残余缺口（如实记录）

1. **历史污染会话**：日志里的污染是**当时写进内存状态**的产物，不落在会话日志里；修复插件后，只要宿主重新折叠就会得到干净状态。已污染的**投影缓存**需要隔离后重折叠（见恢复 SOP），本修复不做数据迁移。
2. **客户端 fork 的静默 catch**：`dsh-client-ui-workspace` 对 fork 失败 `.catch(() => {})`，用户拿不到任何错误提示。属平台侧问题，本次未动。
3. **缓存整条写、无字段级降级**：一个坏字段让整个缓存记录作废，代价过高。已列入平台侧加固建议。
4. **识别是静态 + 折叠双路**：`projection-owners` 的 key 抽取是正则启发式，可能漏报（标 `unknown` 而不臆测）；`--discover` 只能发现「用假 ctx 驱动 `apply` 就能抓到定义」的插件，用别的方式注册投影的插件会漏（例如实测中 `dsh-context` 未被抓到，如实计入漏报）。命中判定本身以折叠结果为准，不受此影响。
