# DSH 0.2.2-alpha.2 动态登记（缝隙全量分析待做）

> **数据源**: `deepseek-ai/DeepSeek-Harness` tag `dsh-v0.2.2-alpha.2`（`f3803c9697`，即当前 origin/master tip）
> **发布日期**: git tag 2026-10-28 02:17 +08（release commit "release(dsh): 0.2.2-alpha.2" #7437）；npm `@deepseek-ai/dsh@0.2.2-alpha.2` 2026-10-27T19:10Z，宿主 dist-tag **`alpha`** 指向它
> **性质**: 0.2.2 线**第一个已发布 tag**——换代级大段，**本条目只是动态登记，逐主题四件套未做**
> **统计**: 树级对比 7242 files，+311,085 / −695,790（tag 树全量可得，此数可信）；**commit 数在浅克隆下不可考**（`rev-list` 的 2153/1565 为 graft 假象——`git log` 实际仅见 release 提交本身，需补全历史后再聚类）；巨量删除构成未核实，见下
> **⚠ 勘误（"两个 alpha"）**: `dsh-v0.2.2-alpha.1` tag **不存在于 git**，npm versions 亦**无 0.2.2-alpha.1**——alpha.1 未对外发布（编号可能内部跳过或撤回），线尾版直接是 alpha.2。

---

## 首批断裂面探针（2026-10-28，仅形状级，未逐主题展开）

| 面 | rc.4 → a.2 状态 |
|---|---|
| 兼容性闸门（`plugin-compatibility.ts` / `compatibility-preflight.ts`） | **零 diff**（engines.dsh 时代延续；0.2.2 宿主对插件装载行为与 rc.4 同判据） |
| `docs/capability-seams.md` | **+50/−5**——新缝族进门：`ctx.actionCards`、`ctx.forge` / `ctx.forgePanel` / `ctx.forgeSession`、`ctx.liveshareShares`、`ctx.pluginRecommendations`、`ctx.cuaAccess`、`ctx.headlessStartup`（另 ctx.ptcRuntime/ctx.tools 段有改动，性质待析） |
| `SESSION_FORMAT_VERSION` | **保持 4**（a.2 types.ts 实测） |
| 包结构 | **≥26 个新包 package.json**：forge 族（`experimental/forge(-github/-session/-bundle)`、`client-ui-forge`）、liveshare 族、action-cards 族、subagent-oar/tool-subagent-oar、recommendations 族（creation/plugin/personalized）、`core/tool-executor-native` + `core/tool-executor-ptc`（**tool executor 拆分**）、`session/message-quotes`、`util/file-drag`、`util/official-bundles`、`util/plugin-detail`、`deliverables/deliverable-file-references`、`test-support/tool-testkit` |
| `docs/upgrade-guide/` | **+39 个指南目录**：大头为 **v0.2.1-rc.2/×31 集中补挂**（pi-ai 目录/协议重放、conditional-tools、tool-executor-plugins、node-24、headless-policy-composition、cua 四件套、persistent-terminal-controls、session-store-writes、web-fetch-private-destinations 等）、v0.2.1-rc.3/×6（independent-session-forks、session-follow-activation、ptc-caller-cancellation 等）、**v0.2.1-rc.4/model-listing-refresh**（rc.4 时代指南此时才落地）、v0.2.1-a.2/a.4 各 2、rc.1×2 |
| 宿主 npm dist-tag 格局 | `latest`=0.2.1-rc.2（宿主线 latest 停在 rc.2）、`next`=0.2.1-rc.4、`alpha`=0.2.2-alpha.2 |

## 对插件作者的即时含义

1. **装载判据未变**：闸门零 diff → 本批 19 仓补的 `0.2.1-rc.4` 枚举串在 0.2.2-alpha.2 宿主上**同样拒载**（精确枚举无 0.2.2 项）——这是设计行为：未测宿主不放行；是否跟进 0.2.2 线，等缝隙分析后按仓裁定。
2. **指南库暴增 39 篇**：`official-repo/` docs 镜像（基线 rc.3）与 `source-analysis` 各 rc 段的"指南 N 篇"口径均基于 rc.3/rc.4 时点 docs/——rc.2/rc.3 时代大量指南是 **a.2 时点补挂**的，此前分析（rc.3=指南 1 篇、rc.4=0 篇）对**当时 docs 快照**成立、不需回改，但后续引用指南数时应注明时点。
3. **0.2.2 主题族**（forge / liveshare / action-cards / oar / recommendations / tool-executor 拆分 / message-quotes / file-drag）全部为实验包，与自有插件现契约面无已知交集——待逐主题核。

## 未核实项（全量分析时补）

1. −695,790 行删除的构成（推测大头为 `snapshots/web` 再生成与 docs 生成物，未逐目录核）。
2. 26 新包 vs 可能的删/改名包全集（仅统计了 `^A`，未列 `^D`/`^R`）。
3. `ctx.ptcRuntime` / `ctx.tools` 段 ±行是否为断裂（还是文档随包结构改写）。
4. 全量 commit 清单与主题聚类（Features/Fixes/Reverted 分组）——**需先 `git fetch --unshallow`/加深历史**，浅边界下 log 不真。
5. slot 目录增删（未跑 slot-catalog diff——seams +50 行预示 slot 面大概率也有增量）。
6. vendor cordis 侧变化幅度（loader/resolve.ts +75、timer/index.ts +38 已在首批探针中可见，属 0.2.2 段）。

## 复核命令

```bash
git fetch origin tag dsh-v0.2.2-alpha.2 --depth=100
git rev-list --count dsh-v0.2.1-rc.4..dsh-v0.2.2-alpha.2   # 浅克隆下为 graft 假数，不可信
# 可信探针是树级：git diff --shortstat / --name-status（tag 树完整）
git diff --shortstat dsh-v0.2.1-rc.4 dsh-v0.2.2-alpha.2                # 7242 files
git diff --stat dsh-v0.2.1-rc.4 dsh-v0.2.2-alpha.2 -- packages/boot/app-boot/src/plugin-compatibility.ts docs/capability-seams.md
git show dsh-v0.2.2-alpha.2:packages/core/session/src/types.ts | grep SESSION_FORMAT_VERSION
git ls-remote --tags origin | grep 0.2.2        # 仅 alpha.2，无 alpha.1
curl -s https://registry.npmjs.org/@deepseek-ai%2Fdsh | jq '.["dist-tags"], .versions["0.2.2-alpha.1"]'   # alpha=0.2.2-alpha.2；alpha.1=null
```
