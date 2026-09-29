# PR 草稿：修复投影状态写出 `undefined` 值字段导致会话不可用

- 目标仓库：`better-er/dsh-live-token-stats`
- 来源：`drscrewdriver/dsh-live-token-stats` @ `fix/lossless-json-state-boundary`（提交 `48e8517`）
- 基线：`main` = `e6c46ee`（v0.4.3）
- 建议版本：0.4.4（**未发布**，等上游确认后再动 tag）

---

## 标题

`fix: 投影状态不再写出 undefined 值字段，守住无损 JSON 边界`

## 问题现象（用户侧）

用 DSH 0.1.5-rc.2 跑一段时间后，部分会话出现：

- 会话在工作区侧栏的**列表里消失或闪跳**，但内容其实还在；
- 用直接链接打开**内容是能看到的**，但**不允许接续使用**；
- 会话行的 **fork 按钮点了没有任何反应**（无报错、无提示）；
- 该会话的**投影缓存长时间停在旧 seq**，每次打开都从旧状态重算。

## 根因

被 kill / 中断的 step 从没收到官方 `usage`，结算时 `state.active.actualTokens` 是 `undefined`。而 `step/end` 分支把该字段**无条件**复制进 `lastSettled`：

```ts
actualTokens: state.active.actualTokens,   // undefined 时键存在、值为 undefined
```

`actualTokens?: number` / `.optional()` 的含义是「该键可以缺席」，不是「该键可以持有 `undefined`」。产出对象因此不是无损 JSON，一个字段同时打穿三层：

1. **宿主转发**：`ctx.emit("api-session/added", summaryFor(session))` 经 `assertJsonArgs` 的 `isJsonValue()` 校验失败 →
   `forwarded host event "api-session/added" argument 0 is not lossless JSON data`
   → 客户端永远收不到这条会话 → 列表里条目消失 / 闪跳。
2. **会话操作**：`session/fork` 的 create-publish 同步失败并整体回滚；客户端侧该失败又被 `.catch(() => {})` 吞掉 → 点 fork 无反应。
3. **投影缓存**：`session_projcache` 按**整条记录**写、不做字段级降级 → 整条写失败，缓存停在旧 seq。

内容之所以仍可读：冷读走 `session/follow` 的 JSON 序列化，`JSON.stringify` 会自然丢弃 `undefined` 值键。所以现象是反直觉的「能看见内容，但不能接续使用」。

## 修复

**原则：`undefined` 值字段一律改为「键缺席」。不用 `null`（客户端以 `!== undefined` 判定有无实际值，`null` 会被读成「有值」），不用哨兵值（伪造数据）。**

- 新增 `src/compact.ts`：
  - `omitUndefined()`：剔除值为 `undefined` 的键；**无变化时返回原引用**，保持 `apply` 的「无变化即同引用」语义；
  - `findNonJsonPath()`：与宿主 `isJsonValue()` 同口径的违规定位（`undefined`、非有限数、`-0`、稀疏数组洞、非普通原型、函数 / Symbol / BigInt、循环引用、不可枚举 / Symbol 键）；
  - `assertLosslessJson()`：开发期自检，`off` / `warn` / `throw` 三档。主机侧接现有 `debug` 开关走 `warn`（带违规字段路径、按指纹去重），**不抛错**——折叠跑在事件回放路径上，抛错会让整个投影单元失效。
- `src/projection.ts`：
  - `step/end` 结算统一走新的 `settleStep()`；
  - `activeStepView()` 出口再过一次无损边界，防止历史污染状态被转发出去。
- `src/live-stream.ts`：`debug` 开关同时打开投影无损自检。
- `tests/lossless.spec.ts`：12 个用例（无 usage 结算、`turn/end` 中断、日志结尾停在 open step、整段重放逐前缀校验、`viewSchema` 往返、历史污染状态的出口清理、断言档位）。

## 兼容性

- **不递增 `stateVersion`**：未改字段语义，也未改折叠语义，只是不再写出一个本就不该存在的值。
- **无需迁移历史数据**：污染只存在于内存态与缓存里，不在会话日志中；宿主重新折叠即得干净状态。
- 客户端行为不变：`actualTokens` 缺席时 `LiveTokenStatsLine.tsx` 的 `!== undefined` 判定本就视作「无实际值」，正是修复后的形状。

## 验证

仓库内（离线折叠真实日志，走 DSH 真实读取链路）：

| 条件 | 命令 | 结果 |
|---|---|---|
| v0.4.3 | `node _tools/dsh-livetoken-state-scan.mjs --recent 30` | **6/30** 会话投影状态非无损，命中路径一律 `.activeStep.lastSettled.actualTokens`（`exact:false`） |
| 本分支 | `DSH_LIVE_TOKEN_STATS_DIR=<repo> node _tools/dsh-livetoken-state-scan.mjs --recent 30` | **0/30** |
| 全量投影普查（带对照组） | `node _tools/dsh-projection-state-probe.mjs --vs <健康会话> <可疑会话>` | `HIT`：仅 `liveTokenStats` 一项，其余投影均 ok |

仓库内测试：`npx vitest run` → **100 passed**（含新增 12 个无损用例）；`npx tsc -b` 退出码 0；`pnpm build` 成功。

## 变更文件

```
CHANGELOG.md          （新增）
src/compact.ts        （新增）
src/projection.ts     （结算走 settleStep；view 出口兜底）
src/live-stream.ts    （debug 打开无损自检）
tests/lossless.spec.ts（新增，12 用例）
```

## 给上游的可选讨论点

1. 是否接受 `assertLosslessJson` 这类**自检**进包（默认 `off`，零成本）？
2. 平台侧是否考虑**列级降级 + 显式断言**（失败时按字段粒度剔除并计数告警，严格模式失败）？本 PR 只修本插件这一处，未改宿主。
3. 宿主转发失败信息目前只报事件名，不含「哪个投影、哪个字段」，定位成本很高，建议补上——**这不是本 PR 的范围**，仅供参考。
