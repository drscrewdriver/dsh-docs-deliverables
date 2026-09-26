# 【第 12 篇】工程体系：文档即契约、持久化评审、发布与遥测

> **版本**：dsh-v0.1.7-rc.1（`46a7f68b09`），对比上版 dsh-v0.1.6-alpha.1（`0a15e36e7f`）
> 难度：🟡 进阶（横切面文档，建议先读第 01 篇与 `docs/architecture.md`）
> 包范围：横切工程面，不按目录。覆盖 `scripts/`、`docs/`、`.agents/notes/`、`snapshots/`、`benchmarks/`、`packages/test-support/`、`packages/runtime-diagnostics/`、`packages/util/`、`packages/experimental/*`（遥测与发布隔离）、`packages/guard/`（门禁相关性判定）
> 上游文档：`docs/AGENTS.md`、`docs/testing.md`、`docs/development.md`、`docs/i18n/README.md`、`docs/i18n/terminology.md`、`docs/persistence-changes/README.md`、`docs/cookbook/reviewing-persistence-type-changes.md`、`docs/subsystems/product-telemetry.md`、`docs/subsystems/session-telemetry.md`

## 目录

- [引言](#引言)
- [概述](#概述)
- [核心概念](#核心概念)
- [包结构](#包结构)
- [关键类型](#关键类型)
- [数据流](#数据流)
- [测试覆盖](#测试覆盖)
- [与上下游的关系](#与上下游的关系)
- [本版本变更要点（0.1.6-alpha.1 → 0.1.7-rc.1）](#本版本变更要点016-alpha1--017-rc1)
  - [12.1 文档即契约：167 → 176 篇与三语配对](#121-文档即契约167--176-篇与三语配对)
  - [12.2 持久化 schema 评审流程与 finalized 检查点](#122-持久化-schema-评审流程与-finalized-检查点)
  - [12.3 workspace release ranges：发布版本区间治理](#123-workspace-release-ranges发布版本区间治理)
  - [12.4 bounded pnpm runs：用静默界而非时长界兜住锁](#124-bounded-pnpm-runs用静默界而非时长界兜住锁)
  - [12.5 no-unknown-casts：lint/类型纪律](#125-no-unknown-castslint类型纪律)
  - [12.6 证据驱动的精简调研](#126-证据驱动的精简调研)
  - [12.7 产品遥测：新增 seam 与 Session 遥测的语义修正](#127-产品遥测新增-seam-与-session-遥测的语义修正)
  - [12.8 桌面发布：版本即入参、签名分期与缓存、COS 上传](#128-桌面发布版本即入参签名分期与缓存cos-上传)
  - [12.9 依赖治理与 experimental 隔离闸门](#129-依赖治理与-experimental-隔离闸门)
  - [12.10 测试体系：快照分区、门禁挂载与并发预算](#1210-测试体系快照分区门禁挂载与并发预算)
  - [12.11 流程治理三件套：权重、委派、作者信用](#1211-流程治理三件套权重委派作者信用)
  - [12.12 本版未变更项与未核实项](#1212-本版未变更项与未核实项)
- [附录：本版工程面提交索引](#附录本版工程面提交索引)

---

## 引言

前 11 篇按包组切分 DSH 的运行时。本篇处理的是**没有被任何包组拥有、却决定了每个包能不能改动**的那一层：文档契约、持久化变更评审、发布区间、门禁脚本、遥测边界与测试基础设施。

它不是"周边杂项"。在 DSH 里这层承担着三个硬约束：

1. **文档是契约，不是说明**。`docs/subsystems/*.md` 里的 `ts type-equiv` 代码块会被 `verify-type-equiv` 与源码逐字比对，`ts cordis-catalog` 区块由生成器产出并被 `verify-cordis-catalog` 校验新鲜度。改类型不改文档，CI 就是红的。
2. **持久化变更必须被显式确认**。`SESSION_FORMAT_VERSION` 在本版由 3 升到 4（见第 01 篇），而这套机制真正的重心不在版本号本身，而在"每一次结构变更都要留下可复核的承认记录"。
3. **发布面与实验面必须物理隔离**。`packages/experimental/*` 默认公开发布，但发布包与 apps 不得依赖它——这条规则由闸门脚本而不是靠人记住。

本篇的量化基线（实跑命令，见文首环境）：

```text
git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- docs scripts snapshots \
  benchmarks packages/test-support packages/runtime-diagnostics packages/util
  → 867 files changed, 204098 insertions(+), 49942 deletions(-)
```

拆到单目录：

| 路径 | 文件数 | 增 | 删 |
|---|---:|---:|---:|
| `docs/` | 227 | +175364 | −41542 |
| `scripts/` | 153 | +13507 | −3552 |
| `snapshots/` | 342 | +11223 | −3995 |
| `benchmarks/` | 12 | +66 | −47 |
| `packages/test-support/` | 68 | +2152 | −647 |
| `packages/runtime-diagnostics/` | 4 | +8 | −8 |
| `packages/util/` | 61 | +1778 | −151 |
| `packages/guard/` | 4 | +48 | −35 |
| `packages/experimental/` | 243 | +9791 | −2734 |
| `.agents/notes/` | 841 | +18708 | −2314 |

`docs/` 的 175364 行增量的主体是**生成物**（`persistence-catalog.md`、`module-graph.md`、`tool-catalog.md`、`config-catalog.md` 与 `subsystems/*.md` 的 `cordis-surface` 区块），不是人手写的散文。这一点在阅读后续数字时必须记住：`docs/` 的 diff 规模衡量的是**被追平的契约表面积**，不是写作量。

---

## 概述

把工程面拆成六条互相咬合的链：

- **契约链（docs/）**：源类型 → 子系统页 `type-equiv` 粘贴 → 生成目录 → 站点投影。每一环都有独立新鲜度闸门。
- **配对链（i18n）**：`foo.md` + `foo.zh.md` + `foo.i18n.yaml` 三兄弟文件；`.i18n.yaml` 记录两侧 git blob 哈希。
- **变更链（persistence-changes/）**：源注解 → 抽取图 → 指纹 → 分类器 → 承认记录 → finalized 检查点。
- **发布链（release）**：区间策略（`workspace:*` / `workspace:~`）→ 打包面替换 → 版本入参化 → 签名 → 上传。
- **门禁链（scripts/ + run-gates.ts）**：静态门 / 主门 / hygiene / doc-sync 四种 profile，把上面四条链的检查挂到 CI 与本地。
- **观测链（telemetry）**：产品遥测（`ctx.productTelemetry`）与 Session 遥测（`ctx.sessionTelemetry`）两条独立 seam，各由自己的消费者决定发什么。

本篇的一句话结论：**本版工程面的主线不是"加了多少检查"，而是把每一处原先靠"人记得"的约定换成一条可机械复核的规则**——文档配对换成哈希、持久化变更换成指纹+检查点、依赖区间换成受检的 `workspace:` 前缀、`unknown` 断言换成基线清单、pnpm 卡死换成静默界。少数几处是反方向的（第 12.6 节记录了一次**没有**证明收益的改进），这同样值得沉淀。

---

## 核心概念

| 术语（首次出现附英文） | 含义 | 本版是否受影响 |
|---|---|---|
| 契约型文档（contract document） | 内容被闸门逐字校验的文档：`ts type-equiv` 粘贴、`ts cordis-catalog` 生成区、目录表 | 未变机制，表面积扩大 |
| 配对契约（pairing contract） | `foo.md` / `foo.zh.md` / `foo.i18n.yaml` 三文件同目录；`.i18n.yaml` 记两侧 blob 哈希 | 未变；新增 194 个 `.i18n.yaml` |
| 结构指纹（structural fingerprint） | 持久化类型的结构摘要，不含注释、源位置、别名 | **本版引入 format 2 与独立指纹域** |
| 承认记录（acknowledgement record） | `docs/persistence-changes/<date>-<slug>.md` + `.schema.json`，声明每个受影响 root 的兼容性判定 | 未变；新增 3 条 |
| finalized 检查点（finalization checkpoint） | `docs/persistence-changes/finalized/vN.json`，冻结已接受基线的 root 判定与记录语义哈希 | **本版新增** |
| 发布区间（release range） | 工作区依赖的前缀策略：DSH 目标 `workspace:*`，vendor/native 目标 `workspace:~` | **本版确立并加闸门** |
| 静默界（silence bound） | 以"捕获输出静默时长"而非"总时长"判定 pnpm 卡死 | **本版新增** |
| 语法指纹（syntax fingerprint） | 断言语句 token 序列的 SHA-256，排除注释与空白 | **本版新增** |
| 门禁 profile（gate profile） | `run-gates.ts` 的模式名：`ci-static` / `ci-primary` / `hygiene` / `check-all` / `doc-sync` / `doc-quick` | 未变；新增门被挂入既有 profile |
| 默认产品隔离（default-product isolation） | 发布包与 apps 不得依赖 experimental 包，含传递安装与运行时导入 | 未变机制；包数 16 → 20 |

---

## 包结构

本篇横切，因此"包结构"给出的是**参与工程面的目录与包组清单**，不是单个包。

| 单元 | 职责 | 本版改动规模 |
|---|---|---|
| `docs/`（顶层 30 篇 + `subsystems/` 63 篇 + `persistence-changes/` + `cookbook/` + `i18n/` + `user/` + `postmortem/`） | 契约型文档、双语配对、变更记录 | 530 → **562** 文件；英文 md 167 → **176** |
| `scripts/` | 闸门与生成器 | 顶层条目 250 → **285**；新增 47 个文件、删除 0 |
| `.agents/notes/` | 决策记录（`implemented/` / `proposed/` / `archived/`），每篇带 `.zh.md` + `.i18n.yaml` | 英文 note 1030 → **1182**；三兄弟文件合计 **3539**；区间新增 165 篇 |
| `.agents/skills/` | 可复用工作流 | 13 → **15**（新增 `agent-experience`、`dsh-client-ui-ux`） |
| `snapshots/` | 顶层会话驱动快照（`acp` / `sdk` / `session` / `web`） | 342 files, +11223 / −3995；`snapshot.yml` 177 → **199** |
| `benchmarks/` | 性能门（`agent-continuation`、`long-session-browser`、`session-open`、`terminal-io`） | 12 files, +66 / −47，无新增目录 |
| `packages/test-support/` | 测试基础设施，7 个包 | 68 files, +2152 / −647；仅 `session-snapshot` 有实质改动 |
| `packages/runtime-diagnostics/` | 运行时不变式（`invariants`） | 4 files, +8 / −8（仅版本与元数据） |
| `packages/util/` | 零依赖工具，15 → **16** 个包 | 61 files, +1778 / −151；新增 `lazy-require` |
| `packages/guard/` | 循环/工具守卫（`repeat-tool-reminder`、`timeout-policy`） | 4 files, +48 / −35（**产品行为，非工程门禁**，见 12.12） |
| `packages/experimental/` | 预稳定原型，16 → **20** 个包 | 243 files, +9791 / −2734；新增语音族 5 包、**删除** `agent-team-web-profile`（非改名，见 12.12） |
| `packages/host/product-telemetry-otel/` | **本版新增**：产品遥测发送端 | 8 文件，`src/index.ts` 171 行 |
| `packages/session/session-telemetry*` / `session-log-deepseek/` | Session 遥测 seam 与上报后端 | 合计 16 files, +864 / −55 |

---

## 关键类型

**片段 A：产品遥测记录（`docs/subsystems/product-telemetry.md:20-31`，源 `packages/host/product-telemetry-otel/src/index.ts`）**

```ts type-equiv
/** Explicitly selected analytics fields; object values may contain scalars only. */
interface ProductTelemetryRecord {
  /** Product/DA-owned event name. */
  eventName: string
  /** Human-readable summary; never a prompt, response, credential, or file contents. */
  body: string
  /** Event occurrence time in Unix milliseconds. Observation time is assigned on enqueue. */
  timestamp: number
  /** OTel severity; omitted values use INFO. */
  severityNumber?: SeverityNumber
  /** Business fields selected by the caller; no automatic device or account identity. */
  attributes?: Record<string, ProductTelemetryScalar | Record<string, ProductTelemetryScalar>>
}
```

同页 `:15` 定义其标量域 `type ProductTelemetryScalar = string | number | boolean`；`:56` 给出唯一服务方法 `emit(record: ProductTelemetryRecord): void`。文档正文（`:5`）明确一条边界：**"No Session data or identifiers are collected automatically."**

**片段 B：持久化评审的报告类型（`scripts/persistence-review.ts:11-30`）**

```ts
/** One structural observation, shared across its containing roots. */
export interface PersistenceReviewEvidence {
  readonly kind: string
  readonly field?: string
  readonly before: string | null
  readonly after: string | null
  readonly locations: readonly { readonly root: string; readonly path: string }[]
}

/** Human explanations cannot override the unchanged classifier results carried per root. */
export interface PersistenceReview {
  readonly schemaVersion: 1
  readonly roots: readonly {
    readonly root: string
    readonly before: string | null
    readonly after: string | null
    readonly changes: readonly PersistenceTypeChange[]
  }[]
  readonly evidence: readonly PersistenceReviewEvidence[]
  readonly unchangedTypes: number
}
```

第二条注释是本版评审设计的关键约束：**人类可读的解释不能覆盖分类器结果**，两者在报告里分节并列。

**片段 C：发布区间的判定（`scripts/check-workspace-constraints.ts:587-601`）**

```ts
export function checkWorkspaceProtocol(manifests: readonly WorkspaceManifest[]): string[] {
  const members = new Set(manifests.map(entry => entry.manifest.name).filter(name => name !== undefined))
  const vendors = new Set(manifests.filter(entry => entry.dir.startsWith('vendor/')
    || entry.dir === 'native/system' || entry.dir.startsWith('native/system/packages/')).map(entry => entry.manifest.name))
  const errors: string[] = []
  for (const { dir, manifest } of manifests) {
    for (const section of dependencySections) {
      for (const [name, range] of Object.entries(manifest[section] ?? {})) {
        if (!members.has(name)) continue
        const expected = name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-')
          ? 'workspace:*'
          : vendors.has(name) ? 'workspace:~' : undefined
        if (expected !== undefined ? range === expected : range.startsWith('workspace:')) continue
        errors.push(`${manifest.name ?? dir}: ${section}.${name} must use ${expected ?? 'the workspace: protocol'}, got ${range}`)
      }
    }
  }
```

注意判定维度是**依赖目标**而不是消费方目录（`:582-583` 的注释明确写出 "Dependency targets determine the range, regardless of the consuming manifest's name or directory"）。

**片段 D：`unknown` 断言基线（`scripts/verify-no-unknown-casts.ts:10-13, 21-33`）**

```ts
const baselinePath = 'scripts/no-unknown-casts.baseline.json'

/** Existing assertion counts, keyed by repository path and syntax fingerprint. */
export type UnknownCastBaseline = Record<string, Record<string, number>>

/** SHA-256 of the assertion's syntax tokens, excluding comments and whitespace. */
function syntaxFingerprint(node: ts.Node, source: ts.SourceFile): string {
  // ...
  return createHash('sha256').update(JSON.stringify(tokens)).digest('hex')
}
```

基线文件实测规模：2293 行 / 125639 字节，**561 个文件条目、1460 处断言计数**（用 `ConvertFrom-Json` 逐层求和测得）。

---

## 数据流

工程面的六条链在本版的实际走向：

```text
[1] 契约链
  src/*.ts  ──paste──▶ docs/subsystems/*.md ```ts type-equiv```  ──verify-type-equiv──▶ CI
  src/*.ts  ──gen────▶ docs/*-catalog.md / cordis-surface 区块 ──verify-*-catalog──▶ CI
                      └─ gen-persistence-catalog.ts / gen-plugin-packages.ts（本版新增）

[2] 配对链
  foo.md ──edit──▶ foo.zh.md（同 PR，术语引导单遍）
         └─verify-translation-pairing --write <pair>──▶ foo.i18n.yaml（两侧 blob 哈希）
  合并冲突 ──▶ dsh-translation-pairing merge driver（结构签名不符即 fail-closed）

[3] 变更链（本版新增 finalized 检查点）
  src 注解 @persistenceSource / @persistenceAttribution / @persistenceReserved
    └─▶ persistence-changes.ts 抽取结构图（format 1 或 2）
        └─▶ digest + classifyPersistenceChange
            ├─▶ docs/persistence-changes/<date>-<slug>.{md,zh.md,i18n.yaml,schema.json}
            ├─▶ docs/persistence-catalog.md / docs/persistence-schema.json
            └─▶ docs/persistence-changes/finalized/vN.json   ← 本版新增冻结点
  PR 评审旁路：persistence-review --before base.json --after docs/persistence-schema.json [--json]
              （只读；解释性证据与权威分类器结果分节）

[4] 发布链
  package.json 依赖区间 ──check-workspace-constraints──▶ workspace:* / workspace:~
    └─▶ pnpm pack 替换为具体版本（cordis ~4.0.3、node-addon-system ~0.1.2）
        └─▶ --build-version <v>|auto ──extraMetadata──▶ electron-builder
            └─▶ 签名（硬件签名与时间戳分离）──▶ COS SDK 上传 ──▶ desktop-v<version> tag

[5] 门禁链
  scripts/run-gates.ts <profile>
    ├─ ci-static / ci-primary / ci-linux-primary ──▶ ciSharedStaticGates() + sharedHygieneGates()
    ├─ hygiene / check-all ──▶ 本地等价
    └─ doc-sync / doc-quick ──▶ 文档专属门

[6] 观测链
  productTelemetry.emit(record) ──▶ OTLP/HTTP（SDK 负责批与重试；入队同步不确认投递）
  sessionTelemetry（sharing 披露 + capture/onDemand）──▶ 后端
    └─ 本版修正：fork 后缀语义、includeHistory 覆盖继承的 fork 历史
```

---

## 测试覆盖

工程面自身的测试分四类：

**1. 闸门脚本的 spec**。`scripts/` 下的每个门几乎都有同名 `.spec.ts`，与门一起演进。本版新增的验证器全部带 spec：

| 新增脚本 | spec | 行数 |
|---|---|---:|
| `scripts/verify-no-unknown-casts.ts` | `scripts/verify-no-unknown-casts.spec.ts` | 186 / — |
| `scripts/persistence-review.ts` | `scripts/persistence-review.spec.ts` | 230 / — |
| `scripts/verify-package-meta.ts` | `scripts/verify-package-meta.spec.ts` | — / — |
| `scripts/verify-client-route-resolution.ts` | `scripts/verify-client-route-resolution.spec.ts` | — / — |
| `scripts/verify-v3-event-vocabulary.ts` | `scripts/verify-v3-event-vocabulary.spec.ts` | — / — |
| `scripts/verify-package-paths.ts`（重写） | `scripts/verify-package-paths.spec.ts`（新增） | — / — |

（`scripts/AGENTS.md` 要求"test every admitted/excluded form that changes their detection boundary"，因此这些 spec 的存在本身是门禁可信度的前提。）

**2. 门禁 runner 的挂载**。新门不是孤立脚本，而是注册进 `scripts/run-gates.ts`（1659 行）的 gate 列表。实测挂载点：

```text
scripts/run-gates.ts:344  pnpmScript('default-product-isolation', 'verify-default-product-isolation', ...)
scripts/run-gates.ts:350  pnpmScript('package-meta', 'verify-package-meta', { label: 'package metadata' })
scripts/run-gates.ts:365  pnpmScript('client-route-resolution', 'verify-client-route-resolution', ...)
scripts/run-gates.ts:367  pnpmScript('no-unknown-casts', 'verify-no-unknown-casts', { label: 'no new unknown casts' })
```

其中 `:358-369` 的 `sharedHygieneGates()` 同时被 `ciSharedStaticGates()`（`:352`）与本地 `hygiene` / `check-all` profile 引用，所以 `no-unknown-casts` 与 `client-route-resolution` **一次注册同时进 CI 静态门与本地门**。

**3. 快照分区**。`snapshots/` 由 `vitest.snapshot.config.ts` 驱动（replay/record/refresh 三态），Web 侧由 `vitest.web.config.ts` 驱动。本版 `docs/testing.md` 把 Web 门的一句话改写为：**先构建 plugin CSS，再在 Chromium 中比较全部 session 驱动的 `snapshots/web/` 与 UI-only 的 `apps/web/tests/expected/`，模型/推理选择器另跑 WebKit**。`snapshots/snapshot.yml` 场景数 177 → 199。

**4. 单元测试的 setup 链**。`vitest.config.ts` 的 `setupFiles` 本版增加第三个：

```text
['./scripts/test-proxy-environment.ts', './scripts/test-invariants.ts', './scripts/test-dom-environment.ts']
```

该数组在默认 lane、`jsdom` lane（:180）与 `process-bound` lane（:195）三处同步出现，即新 setup 覆盖全部 lane。`scripts/test-dom-environment.ts` 是本版新增文件。

覆盖率门（per-file 100% on `packages/*/*/src`）本版有两次有意义的调整：**新增豁免** `packages/client/ui-sidebar-browser/src/client/electron/**`（Electron guest 行为等原生 harness）、`packages/experimental/client-ui-voice-input/src/client/index.ts`（由 `voice-input.e2e.ts` 覆盖构建产物）；**移除豁免** `packages/client/modules/src/client/system.ts`、`packages/client/hmr/src/client/index.ts`——即这两个文件的覆盖债务在本版被真实还清，而不是继续挂账。

---

## 与上下游的关系

**上游（本篇依赖谁）**

- 第 01 篇（`packages/core/`）与第 05 篇（`packages/session/`）：`SESSION_FORMAT_VERSION` 3 → 4 是 `persistence-changes` 机制的输入事件；`docs/persistence-changes/finalized/v4.json` 就是为它建立的冻结点。
- 任何改动 `docs/subsystems/*.md` 中 `type-equiv` 粘贴的包：契约链的上游是源类型。
- `packages/host/product-telemetry-otel/` 依赖 `packages/host/` 组；`packages/session/session-telemetry*/` 依赖 Session 事件流。

**下游（谁依赖本篇）**

- **CI 与本地开发循环**：`run-gates.ts` 的 profile 决定了每个 PR 必须过哪些检查。新增门若未挂入 profile 等于不存在。
- **发布流程**：`check-workspace-constraints` 的区间策略直接决定 `pnpm pack` 产出的 `package.json` 里写什么版本区间，因此间接决定下游消费者能升到哪个小版本。
- **桌面应用**：`--build-version` 入参化后，`apps/desktop/` 的打包、feed 与上传校验共读同一个值；manifest 不再被改写。
- **插件作者**：`packages/experimental/AGENTS.md` 的发布隔离规则决定了实验性能力能否被正式产品引用；`no-unknown-casts` 决定了新增类型转换的写法。

**边界**：本篇不解释任何运行时语义；运行时不变量归 `packages/runtime-diagnostics/`，工具管线归第 04 篇。工程面**不**改变产品行为——本版唯一的例外在 12.7（Session 遥测的 fork 语义修正），它同时改变行为与文档，因此两边必须同 PR。

---

## 本版本变更要点（0.1.6-alpha.1 → 0.1.7-rc.1）

### 12.1 文档即契约：167 → 176 篇与三语配对

**核心数字（实测）**

```text
docs/ 英文 md（*.md 且非 *.zh.md）:  167 → 176   (+9)
docs/ 全部文件:                      530 → 562   (+32)
docs/subsystems/ 英文 md:             58 →  63   (+5)
仓库 *.i18n.yaml:                   1549 → 1743  (+194)
仓库 *.zh.md:                       1552 → 1746  (+194)
```

`+9` 与 `+32` 的关系值得拆开看，因为它精确刻画了"一篇新文档 = 4 个文件"的配对成本：

| 新增文件 | 数量 |
|---|---:|
| `docs/subsystems/{boot,deliverables,office-to-pdf,product-telemetry,voice-input}.md` | 5 |
| `docs/persistence-changes/{2026-09-14-workspace-changes-event,2026-09-16-session-format-v4,2026-09-20-unknown-child-catalog}.md` | 3 |
| `docs/persistence-changes/historical-formats/v3.md` | 1 |
| **英文 md 小计** | **9** |

其余 23 个文件是这 9 篇的 `.zh.md` 兄弟（9）与 `.i18n.yaml` 一致性记录（9），外加 `docs/persistence-changes/finalized/v4.json`（1）与 3 条变更记录的 `.schema.json`（3）、`historical-formats/v3.schema.json`（1）。

**`docs/` 区间内没有删除任何文件**（`git diff --name-status --diff-filter=D ... -- docs/` 返回空）。这在 2504 commits 的区间里是一个强信号：文档面只增不删，废弃靠"改内容 + 改指向"完成，不靠删文件。

**三语机制的实际形态**：所谓"三语"是**三兄弟文件**，不是三份翻译。`docs/i18n/README.md` 的配对契约规定：

- 英文 `foo.md`、中文 `foo.zh.md`、一致性记录 `foo.i18n.yaml` **同目录**，无 locale 子目录、无独立翻译仓库、无内联双语文件；
- `.i18n.yaml` 存两侧的**完整 git blob 哈希**（不是 commit 哈希），因此"一致性"是纯内容比较，可在同一 PR 内计算（`git hash-object foo.md`）；
- 重新确认一致性必须**显式点名 pair**：`pnpm run verify-translation-pairing --write <pair>`；`--write --all` 是显式的全量形式，即"那个 yaml diff 就是可复核的确认动作"；
- 闸门的自我限定被文档写在明面上：**"a green gate means the pair was confirmed consistent at these exact contents, not that the confirmation was sound."** 哈希与结构能查，语义是否等价仍归评审。

**`docs/AGENTS.md` 的区间变更（1 增 1 删，逐字）**：

```diff
-- **Every non-trivial change includes at least one Agent Note in the same PR.** Update the owning note or add one; only mechanical/local edits are exempt ([scope](...)).
++ **Apply the Agent Note creation criteria.** Mechanical/local edits are exempt, including local UI changes; keep existing owning notes accurate ([scope](...)).
```

这条改动的方向很明确：从"每个非平凡改动都必须写 note"（一个按 PR 计数的配额规则）改为"按 note 的创建标准判断"（一个按内容判断的规则），并**显式把本地 UI 改动列为豁免**。根 `AGENTS.md` 的对应条目同步为 "Create Agent Notes only for durable decision rationale; mechanical/local edits are exempt, including local UI changes"。

**`docs/i18n/terminology.md` 的区间变更（3 增 3 删）**——术语表的纪律性在这里可见：

| 词条 | 变更 |
|---|---|
| `subagent` | 备注列新增：文档正文保留英文；**中文 UI 中译作「子智能体」，不使用「子代理」** |
| `model provider` | 中文由「模型提供方」改为**「模型提供商」**，并注明：模型设置页文案、用户指南 providers 与 `ui-settings-models` README 用「提供商」；llm seam 的**开发者文档**沿用「提供方」 |
| `provider` | 备注列澄清：泛指提供方（搜索、检查、settings 文件、subagent 等）；模型厂商或网关见 `model provider` 行 |

即同一个英文词在**用户面**与**开发者面**用不同中文，且这个分裂被写进术语表而不是留给译者判断。术语表当前 203 行。

**`docs/development.md` 的区间变更（14 增 1 删）**：新增 `### Application commands` 小节，把 Web 与 Desktop 的命令对写清——`start:*` 启动既有构建产物，`dev:*` 先构建再启动；Web 额外保持 client bundle 随源码重建。同时改写 `dev:web` 的语义：**它现在先跑完整构建**，`--skip-build` 才复用既有产物树。这使 `docs/architecture.md` 的 `verify-application-entrypoints` 说明同步扩到"root `start:web` 和 `dev:web` scripts"。

**`docs/testing.md` 的区间变更（1 增 1 删）**：Web 浏览器快照层的描述被重写为"先构建 plugin CSS，再比较全部 session 驱动与 UI-only 输出，模型/推理选择器另跑 WebKit"，并把 CI 的只读约束表述收敛为 "CI enforces read-only `DSH_SNAPSHOT=replay`"。

**文档预算闸门的变化**：`scripts/doc-budgets.manifest.json` 只改一行——`docs/architecture.md` 上限 2400 → **2410**。按 `docs/AGENTS.md` 的规则，提上限必须在 PR 里论证"内容确实需要空间"，因此这一行 diff 是"architecture.md 本版净增 11 行且无处可搬"的机械证据。

---

### 12.2 持久化 schema 评审流程与 finalized 检查点

这是本版工程面**最值得沉淀**的一处，由官方 note `.agents/notes/implemented/process/2026-09-17-persistence-schema-review.md`（20 行）与 `docs/cookbook/reviewing-persistence-type-changes.md`（+11 / −1）共同定义。

**问题（note 的 Problem 段，逐字要点）**：结构指纹能标出"某个持久化类型变了"，但**指纹本身无法解释一处共享变更，也无法区分"已声明的读取方承诺"与"对运行时行为的假设"**；此外，由 union 位置与遍历路径派生的名字会因无关兄弟节点被加入而改变，掩盖了评审真正要看的字段。

**决策要点（note 的 Decision 段）**

1. **inventory format 2** 在受影响属性旁记录受支持的兼容性元数据：绑定名、policy 版本、字面 discriminator、unknown-kind 保留承诺、qualified attribution kind 集合。
2. **带 policy 的图使用独立的指纹域**；未绑定 policy 的图保留 format-1 归一化与指纹。**inventory 版本描述 schema 工具，与 Session 格式版本无关**——这是一条重要的解耦，避免两套版本号互相拖动。
3. 抽取器**只在 core 拥有的源声明处接受显式 source binding**，且每处使用都要求字面 user/developer role；producer 注解限定完整的 wire-kind 组。
4. **分类器只在两侧已保存 schema 携带相匹配的承诺时**，才允许一个 qualified 的新 attribution kind 走 `same-version`。
5. `@persistenceReserved` 让"读取方禁止该字段名"的 optional `never` 属性被显式保留；只接受**无参数**注解，且拒绝把它变成必填或赋值 JSON 的映射用法。
6. **内容命名与源位置退化为描述性元数据**，结构摘要负责标识类型并提供 catalog 锚点。

**新增的只读评审命令**（note 的 Decision 段末 + cookbook 的新增段落）：

```sh
pnpm --silent run persistence-review --before .artifacts/base.schema.json --after docs/persistence-schema.json
```

实现在 `scripts/persistence-review.ts`（230 行），参数在 `:216` 用 `node:util` 的 `parseArgs` 声明，`strict: true`、`allowPositionals: false`，可选 `--json`。行为约束（逐条来自 note）：

- 按 digest 匹配未变 schema；**变更的 union 备选只在字面 discriminator 能唯一标识时才配对**；
- 歧义备选保留为独立的增/删，**不从相似字段推断重命名**——note 的 Alternatives 段明确拒绝 "Infer renames from similar fields"，理由是多个备选可能共享同一 discriminator 或结构相似，"把不受支持的对应关系呈现为事实"更糟；
- 共享结构证据列出每个受影响 root；**独立的分类器诊断段保留权威结论**，解释性输出不能放松分类器；
- 历史机制（`2026-09-11-persistence-type-history.md`）继续拥有"承认与版本要求"这一职责。

这也是本版 `scripts/` 新增文件中最大的一族：`persistence-review.{ts,spec.ts}`、`persistence-source-annotations.ts`（81 行）、`persistence-source-policy.ts`（69 行）、`persistence-finalization.ts`（172 行）、`persistence-developer.spec.ts`、`persistence-epoch-header.spec.ts`、`historical-schema-region.ts`。

**finalized 检查点（`docs/persistence-changes/finalized/v4.json`，本版新增）**

`docs/persistence-changes/README.md` 的区间 diff 新增一段，定义了机制：

- `finalized/vN.json` 记录**一份已接受的兼容性基线的完整 root 分类与 digest，以及其已接受记录的语义哈希**；
- 保护范围：**当前 V4 schema 仍可兼容演进，检查点保护已接受的机器声明与 after schema，即使 writer 版本前进**；记录哈希**排除散文、别名与源位置**；
- 捕获方式：维护者用 `createPersistenceFinalizationCheckpoint`（`scripts/persistence-finalization.ts`）捕获约定格式，写入一个**新的**版本命名检查点（不替换既有），并推进配对的 `latestFinalizedVersion`；该 helper 要求当前 schema 与完整已承认历史一致；
- 限制被写进文档而非省略：**"Verification checks retained checkpoint hashes; it does not prove that the checkpoints and their authority record were never edited together."** ——检查点防的是无意的漂移，不是同谋篡改。

`v4.json` 实测开头（`schemaVersion: 1`、`sessionFormatVersion: 4`，root 条目含 `JsonlHeaderLine`、`SessionEventEnvelope`、`SessionHeader` 及各 `event:*` 的 `digest` 与 `surface` 标志）：

```json
{
  "schemaVersion": 1,
  "sessionFormatVersion": 4,
  "roots": {
    "JsonlHeaderLine": { "kind": "header", "digest": "18ee62b8900a4c3d046700f05d7a4d49d6cab2a660a020c87481d1603dd8bd4f" },
    "SessionEventEnvelope": { "kind": "envelope", "digest": "5776e5553ff2dfe3f5bc202dbb1e7c9f93e35a531aebb7764c23b2b6153b2ccc" }
  }
}
```

**历史格式体系的一处更正**：任务描述称 `docs/persistence-changes/historical-formats/` 是"本版新建"。**核实结果：该目录在 0.1.6 已存在并含 v0/v1/v2**（`git ls-tree -r dsh-v0.1.6-alpha.1 docs/persistence-changes/historical-formats/` 返回 README + v0/v1/v2 各 4 个文件）。本版只**新增 v3** 一族（`v3.{md,zh.md,i18n.yaml,schema.json}`）。该目录的生成索引 diff 给出本版变化的确切形态：

```diff
-| 3 | Current checkout | [Current catalog](../../persistence-catalog.md) | [JSON](../../persistence-schema.json) | 60 / 468 |
+| 3 | PR #4320 | [V3](v3.md) | [JSON](v3.schema.json) | 60 / 467 |
+| 4 | Current checkout | [Current catalog](../../persistence-catalog.md) | [JSON](../../persistence-schema.json) | 62 / 587 |
```

即 v3 从"当前"降为"历史"（60 types / 467 keys），v4 成为当前（62 / 587），v3 被钉在 PR #4320。README 同步新增一句："V3 captures the verified inventory before the V4 writer change in PR #4320."

**兼容性规则表的两条新增判定**（`docs/persistence-changes/README.md`，本版新增行）：

| 变更 | 判定 |
|---|---|
| 普通事件新增一个**更高的数值 `data.version`**，同时保留全部旧 payload 备选不变 | `same-version` |
| 向 user/developer source slot 新增一个**显式 qualified** 的 attribution kind，且前后 schema 携带相同的受支持 policy | `same-version` |

对应的散文约束亦被写入：可加"必填、非负整数且高于所有既有 payload version"的新备选，读取方**必须保留对旧 payload 的支持**；在同一版本上加变体、丢弃旧版本、改动 Session header 或 envelope 仍属破坏性。旧版读取方**可以拒绝**新的 payload version。

---

### 12.3 workspace release ranges：发布版本区间治理

note：`.agents/notes/implemented/process/2026-09-22-workspace-release-ranges.md`（14 行）。

**问题**：DSH 包共享一个产品发布，但 Cordis、其 vendored 库与 Node Addon System 有各自的发布节奏；消费者需要拿到它们的 patch 更新，**但不该自动接受新的 minor**。

**决策（逐条）**：

- 每个 workspace 消费者：**DSH 目标用 `workspace:*`**，**`vendor/` 下与 `native/system` 包族的目标用 `workspace:~`**；
- 覆盖范围明确列全：根工具、apps、peer、devDependencies、native 入口的 optional 平台依赖；**"Directory placement never exempts a consumer."**
- 打包时的替换是可验证的：`workspace:~` 变成目标包当前版本——Cordis 在 `4.0.3` 时替换为 `~4.0.3`，Node Addon System 在 `0.1.2` 时为 `~0.1.2`；**DSH 引用保持精确**；
- 该策略是 `2026-08-10-npm-release-sequences.md` 与 `2026-08-26-published-dependency-faces.md` 的精化，两者的独立发布族与依赖分区分类不变。

**被拒绝的两个备选**（note 的 Alternatives 段）：caret vendor 区间（对 Cordis 这类稳定包，caret 同样会引入后续 minor）；vendor/native 的精确区间（每次 patch 都要求改消费者声明）。

**闸门与代价**：workspace gate 拒绝 **DSH 的 tilde 区间**以及 **vendor/native 的 caret 或精确区间**；packed-manifest 测试检查实际产出的版本。判定实现即片段 C（`scripts/check-workspace-constraints.ts:587-601`），其注释解释了为什么必须用协议而不是手写区间：

> A hand-written range says nothing about the version the workspace actually carries, and `pnpm pack` leaves it alone: `^0.0.1` published from version `0.0.2` names a version that does not exist.

**实测的机械证据**：`check-workspace-constraints.ts` 本版 **111 行改动**；根 `package.json` 的 12 条 `devDependencies` 由 `workspace:^` 改为 `workspace:*`（并新增 `@deepseek-ai/dsh-mcp-client`）；`packages/guard/timeout-policy/package.json` 这类单包也整体迁移，且其 `@deepseek-ai/cordis` 走 `workspace:~` 而 DSH 三兄弟走 `workspace:*`——正是策略的教科书形态：

```diff
   "peerDependencies": {
-    "@deepseek-ai/dsh-llm": "workspace:^",
-    "@deepseek-ai/dsh-timeout": "workspace:^",
-    "@deepseek-ai/dsh-tools": "workspace:^",
-    "@deepseek-ai/cordis": "workspace:^"
+    "@deepseek-ai/dsh-llm": "workspace:*",
+    "@deepseek-ai/dsh-timeout": "workspace:*",
+    "@deepseek-ai/dsh-tools": "workspace:*",
+    "@deepseek-ai/cordis": "workspace:~"
   },
```

`docs/rescope.md` 的一句也随之改写：从"Dependency ranges. Renaming changes dependency keys without changing ranges. Workspace manifests use `workspace:^` for repository-owned runtime dependencies..." 变为指回 `AGENTS.md#conventions` 的区间规则——**把事实收敛到一个家**，符合 `docs/AGENTS.md` 的 "one home per fact"。

配套新增门 `verify-package-meta`（`scripts/verify-package-meta.ts`，本版 218 行新增）作为 `package-meta` 挂进 `ciSharedStaticGates()`（`run-gates.ts:350`），它检查的是 workspace 成员的包元数据一致性。

---

### 12.4 bounded pnpm runs：用静默界而非时长界兜住锁

note：`.agents/notes/implemented/bug-fix/2026-09-23-bounded-pnpm-runs.md`（37 行，归 `implemented/bug-fix/`）。这是本版唯一一篇把工程工具链缺陷写成产品级修复的 note。

**故障现场（note 的 Problem 段，含具体数字）**：一个 `dsh web` 进程在 pnpm 子进程打印 `Done in 2s` 之后，**把 `~/.dsh/profiles/web/package.json.lock` 持有了 22 分钟**；子进程从未退出，操作在等一个永不到来的结束，锁从不释放，进程内后续每个管理调用都排在它后面。根因定位到 pnpm 11.13.0：它**一次性**消费 worker-pool 的 teardown，之后惰性重建池，且只在销毁时 unref worker，于是池让父进程活着——**仓库侧无法修复**。

第二条通往同一结局的路径被单列：一个继承了 pnpm stdout/stderr 的 lifecycle script 在 pnpm 退出后**继续持有管道**，等 EOF 的读者永远等不到，锁在读者等待期间一直被持有。

**决策（note 的 Decision 段，逐条）**：

| # | 规则 | 关键数值 |
|---|---|---|
| 1 | **运行在进程退出时完成，而不是管道结束时**；操作 await 原始 child 的 `exit` 事件，并与 execa 的 promise 竞速 | — |
| 2 | 管道随后在**固定 grace period** 内排空，超时后由本操作关闭 | **2000 ms** |
| 3 | 只有**这次排空**导致的关闭被忽略；此前已发生的读取失败仍作为运行失败浮出，日志记录尾部被截断 | — |
| 4 | 捕获输出静默超过 `idleTimeoutMs` 即终止，报 `timedOut` 并附自身退出状态，且**不再向下一 registry 询问** | 默认 **600000 ms** |
| 5 | 被终止的运行**无论信号留下的退出状态如何都归类 `timeout`**；安装/移除报失败而非成功，半写的 manifest 被还原而非激活 | — |
| 6 | 终止会停掉**整棵进程树**并等它消失后才还原 profile、释放锁；`killDescendants` 覆盖每条 kill 路径含取消；**只对捕获型运行传入**，继承终端的运行保留调用方的进程组 | — |
| 7 | `dsh plugin` 继承调用方终端、不做捕获，因此**没有静默界**，操作员保留中断能力 | — |

**为什么是静默界而不是时长界**（note 专设一段回答）：捕获型运行十分钟不打印任何东西就是卡住（pnpm 会写自己的进度和脚本输出）；而总时长界会杀掉合法工作——**非 TTY 的 pnpm 在构建脚本结束时才打印其输出，慢机器上的 native 构建静默编译的时间会长于任何我们能论证的固定预算**。默认值 600000 ms 给已批准的构建"维护者预期最慢静默期的十倍"。这个论证的形态值得注意：它拒绝了一个更简单但会破坏合法工作的规则。

**测试证据（note 的 Testing 表，四份 spec，均在 `packages/boot/plugin-manager/tests/`）**：

| 证据 | 覆盖行为 |
|---|---|
| `operations.spec.ts` | 静默界终止、捕获信号后退出 0 的运行、持管道上的有界排空、仍能穿透截断浮出的读取失败、非 Error 的拒绝原因、截断提示 |
| `operations-process.spec.ts` | 真实后代：比进程活得久的管道仍能排空；卡住运行的树在操作返回前被停止，其脚本本该写的标记从未出现 |
| `run-tree.spec.ts` | 平台进程组首领决策、各平台探测目标、等待上界 |
| `manager.spec.ts` | 退出 0 却被终止的运行还原 manifest、报 `timeout`、不被激活；被终止的移除报失败 |

note 同时显式标注了平台缺口：**真实进程用例只覆盖 POSIX**——Windows 无法构造"父进程之后仍持有继承管道的后代"，而排空本身与平台无关；跳过这些用例后，mock 用例在 Windows 上仍能守住 per-file 覆盖率门。

**债务标注（note 的 Consequences 段）**：该上界是第三方缺陷的 workaround（**issue #4981, PR #4982**），一旦 pnpm 在命令返回前拆掉 worker pool 就不再需要。另有一条诚实的代价记录：静默但健康的 native 构建若超过默认值会被杀掉并归类 `timeout`，编译此类依赖的 profile 应调高 `idleTimeoutMs`——**用更慢的卡死检测换容忍度**。

**与根 `package.json` 的一处区分**：本版 devDependencies 新增 `"pnpm": "11.7.0"`（精确 pin）。这与 note 中触发故障的 pnpm **11.13.0** 是两个不同的事实，不应合并叙述；仓库 pin 的是工具链版本，note 记录的是外部实现的一个缺陷版本。

---

### 12.5 no-unknown-casts：lint/类型纪律

note：`.agents/notes/implemented/process/2026-09-19-no-unknown-casts.md`（18 行）。

**问题**：经由 `unknown` 的断言移除了 TypeScript 对"原值"与"后续断言类型"之间的兼容性检查——生产代码可以隐藏错误的接口，测试可以声称一个不完整的 fixture 满足某服务。已有的用法里也有合法的加宽（如无类型解析结果），而那类场景**可以用显式 `unknown` 声明替代**。

**决策要点**：

- **禁止新增直接断言到 `unknown`**，覆盖一方 JavaScript 与 TypeScript，**包括 tests、fixtures、benchmarks、scripts**；
- 覆盖 `as unknown` 与 `<unknown>` 两种语法，**包括带括号的目标类型，以及含直接 `unknown` 成员的 union 目标**；
- **`unknown` 声明仍然合法**：外部数据可以 `const value: unknown = JSON.parse(text)` 进入，并在使用前到达其声明的 parser；
- 类型化的进程内值仍保留既有的"禁止不必要的运行时校验"规则。

**检查器**（note 指向 `scripts/verify-no-unknown-casts.ts`，命令 `pnpm run verify-no-unknown-casts`）：

- 用 **TypeScript 语法树**而非文本搜索——Alternatives 段明确拒绝了文本方案，理由是注释与字符串可能包含该短语，而 token 之间的空白、注释与尖括号语法又能把真实断言藏起来；
- 扫描 tracked 源文件与未被 ignore 的 untracked 源文件；vendored 源与冻结的 archived Agent Notes 保留其归属豁免；
- 忽略注释、字符串与 `unknown` 的**声明**。

**基线纪律（本版最值得学的一条）**：

- 既有断言以"仓库相对路径 + 断言语法 token 的 SHA-256 + 出现次数"精确记账；
- **基线编辑只能删条目或降计数**；评审必须拒绝新增文件、新指纹与计数上升；
- 基线之外的新增或变更断言、以及失效的基线条目都会让检查失败；
- **一个文件级豁免或一个计数预算都无法授权替换性债务**；
- `--prune` 机械地删条目或降计数，并在存在新违规时**拒绝写入**；
- **不存在任何添加新例外的命令**。

实测基线规模：`scripts/no-unknown-casts.baseline.json` 2293 行 / 125639 字节 / **561 个文件条目 / 1460 处计数**。检查器 186 行。

**挂载**：gate id `no-unknown-casts`，注册在 `scripts/run-gates.ts:367` 的 `sharedHygieneGates()` 内，因此同时进入 `ciSharedStaticGates()`（进而 `ciPrimaryGates()`）与本地 `hygiene` / `check-all`。

**代价（Consequences 段，逐字要点）**：owner 在改变或搬迁某断言的形态前必须先解决它；**操作数的任何 token 变化——包括标识符重命名、引号、尾逗号或括号编辑——都会让指纹失效**，即使运行时行为没变；只有格式化空白与注释不改变记录的 token；移除断言后还必须 prune 其基线条目，以免过时豁免悄悄堆积。

**范围限定（note 自己写出）**：通过此检查只证明"不存在未列出的、指向 `unknown` 的直接断言"（含被 union 中直接 `unknown` 成员吸收的目标）；它**不**证明一般类型安全，也**不**解析类型别名或交叉类型；JSDoc `@type` 断言、`unknown[]`、`Promise<unknown>` 等**容器类型在该语法规则之外**；把断言换成 `any`、另一个未检查断言，或一个只是隐藏转换的 helper，**都不解决底层类型问题**。

根 `AGENTS.md` 的对应约定条目同步加入：**"No new assertions to `unknown`"**，并指回该 note。

---

### 12.6 证据驱动的精简调研

note：`.agents/notes/implemented/process/2026-09-19-evidence-led-simplification-surveys.md`（37 行）。这一篇的价值在于**它报告了一个否定的结论**。

**先澄清一处包归属**：note 指向的 `.agents/skills/dsh-find-simplifications/SKILL.md` **在 0.1.6 已存在**（`git ls-tree --name-only dsh-v0.1.6-alpha.1 .agents/skills/` 含 `dsh-find-simplifications`），本版是**修订**而非新建。`.agents/skills/` 本版 13 → 15，新增的是 `agent-experience` 与 `dsh-client-ui-ux` 两个目录，与精简调研无关。

**问题**：unused-symbol 搜索会漏掉"能工作但实现成本高于所需结果"的行为，也会把没有固定仓库调用者的公共扩展 API 误判为死代码；此前的精简 skill 还把发现流程与冗长的归档程序混在一起、在消费者示例里遗漏了 application 与 Python 路径、并给出了缺少**必填 `Alternatives considered` 段**的提案大纲。

**决策要点**：

- skill 追踪**完整的 producer→outcome 路径**，追问"哪些区分会改变消费者动作"，考虑**显式缩减受支持行为**，并寻找"可由一次权威读取替换的维护副本"；
- 把**组合可用性与部署策略分离**；把被移除的配置、生命周期、测试与文档**与源代码一起计入**；
- 生产使用改变**所需的取舍证据**，"它不自动否决提案，也不授权实施"；
- 参与消费者追踪的对象被逐一列出：动态插件发现、已安装消费者、生成的运行时资产、profiles、applications 与 Python；
- 保留项（约束而非障碍）：受保护的适配器与持久化设计、已发布数据、信任边界、独立不变式观测、同步发布、取消、静默释放；
- 入口点把决策标准与一份**可选的历史参考**（`references/historical-patterns.md`）分开；归档机制留在其既有 owner；提案骨架使用规范标题。

**历史证据（note 的 Historical evidence 段）**：作者抽样了 100 篇英文 implemented 或 archived 精简 note 中的 **26 篇（11 implemented + 15 archived）**；**全部 9 篇被拒的精简 note 都提供了反例**。抽样覆盖 producerless 变体、惰性请求旋钮、显式输入、公共投影、派生数据、共享组合、生命周期归属与依赖替换；note 自己声明"它是**有目的的，不是随机或穷尽的**"。冻结比较输入的规模被精确记录：基线入口 **2222** 个空白分隔词、修订入口 **1372**、其参考 **897**，并给出三个 SHA-256 值。

**受控对比（note 的 Bounded survey evidence 段）**——这是本版流程类 note 中方法学最严谨的一处：

- 源快照为 **master after #4618**；每个 arm 使用全新 agent、相同继承模型与推理强度、相同 owner 域、时间上限、每域至多 4 份提交；其他输出对发现型 agent 隐藏；
- runtime 域覆盖 `core`、`session`、`session-query`、`api`、`sdk`、Python；execution 域覆盖 `shell`、`subprocess`、`terminal`、`jobs`、`fs`、`mcp`、`boot`；
- 第三个匹配域（`llm`、`compaction`、`context`、`skill`、`extensions`）是初始 runtime 结果**之后**加入的，使用更短的相同上限，**与最初声明的两域对比分开**；研究在这三个域后停止；
- 盲法被如实报告：skill 作者在隔离于当前候选的情况下从历史 note 推导修订；协调者在修订运行前收到了**意外的早期基线提示**，但在修订运行前**未改动地**接受了独立作者的修订；候选包对独立评审者隐藏 arm 标签；**协调者的整合不是盲的**；
- 冻结输入的三个 SHA-256 被完整列出。

结果表（note 原表，逐字数字）：

| Version | Domain | Cap | Submitted | Durable as submitted | Durable after refinement | Local | Deferred | Elapsed |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Baseline | Runtime | 12m | 3 | 1 | 2 | 0 | 0 | 6m 30s |
| Baseline | Execution | 12m | 3 | 3 | 0 | 0 | 0 | 8m 40s |
| Revised | Runtime | 12m | 2 | 1 | 0 | 1 | 0 | 5m 05s |
| Revised | Execution | 12m | 3 | 2 | 0 | 1 | 0 | 8m 19s |
| Baseline | Model/context, exploratory | 10m | 2 | 2 | 0 | 0 | 0 | 6m 02s |
| Revised | Model/context, exploratory | 10m | 2 | 0 | 0 | 1 | 1 | 7m 51s |

**结论（note 自己写出，没有粉饰）**：基线产出 6 个"按提交即持久"的提案与 2 个精化后的提案；修订版产出 3 个持久提案与 3 个本地清理，另有 1 个行为缩减提案被推迟。**"This sample does not show higher durable-proposal yield from the revision."** 修订版展示出的收益是**互补发现与显式分类**，更强的并集包含两个版本的发现。

note 也把局限性写全：每版本/域只有一次发现运行，无随机顺序与重复，相同上限内实际耗时不等，评审主观；源缩减是**估计**而非已实施的 diff；这些结果**既不建立统计优越性，也不建立可复现的加速或穷尽覆盖**。

**一条被拒绝的提案**同样被留档：把自动 Session-reference 尺寸改为固定字节默认值被推迟，因为当前预算决策（`../bug-fix/2026-09-05-session-reference-model-budget.md`）是"在大模型上丢失了有用上下文"，而尽力而为的 spill 检索**不能替代**内联上下文；**提案的删除清单是准确的，但仅此不足以推翻当前要求**。

本版 `.agents/notes/implemented/simplification/` 新增 6 篇，与 process 桶的这篇互为上下文。

---

### 12.7 产品遥测：新增 seam 与 Session 遥测的语义修正

本版遥测面有两个独立事件，**必须分开叙述**。

**（A）新增产品遥测 seam：`docs/subsystems/product-telemetry.md` + `packages/host/product-telemetry-otel/`**

`packages/host/product-telemetry-otel/` **在 0.1.6 不存在**（`git ls-tree --name-only dsh-v0.1.6-alpha.1 packages/host/ | Select-String telemetry` 返回空），是本版全新包。8 个文件：

| 文件 | 规模 |
|---|---:|
| `src/index.ts` | 171 行 |
| `README.md` / `README.zh.md` | 各 108 行 |
| `tests/telemetry.spec.ts` | 203 行 |
| `tests/loader-composition.e2e.ts` | 23 行 |
| `tests/fixtures/{driver.ts, telemetry.patch.yml}` | 43 / 15 行 |
| `package.json` / `tsconfig.json` / `README.i18n.yaml` | 48 / 21 / 6 行 |

文档 `docs/subsystems/product-telemetry.md`（60 行，含生成的 `cordis-surface` 区块）定义的边界：

- plugin **通过 OTLP/HTTP** 发送**显式选定**的分析事件；
- `productTelemetry` 服务**只拥有提交**；**产品消费者拥有"事件何时发生"与"哪些字段被批准"**；
- **"No Session data or identifiers are collected automatically."**
- **入队是同步的且不确认投递**（"Enqueue is synchronous and does not acknowledge delivery"），**SDK 拥有批处理与重试**，本地诊断报告导出失败；
- `ProductTelemetryRecord` 的 `body` 字段 JSDoc 写明"never a prompt, response, credential, or file contents"，`attributes` 写明"no automatic device or account identity"；
- `ctx.productTelemetry` 的类注释："Mounting alone sends nothing; the owning fiber drains it on unload."
- `emit` 的 JSDoc 再次强调："Queue admission and shutdown completion are not collector or warehouse acknowledgements."

即这是一条**默认什么都不发**的 seam：挂载不发送、无自动身份、无自动 Session 数据、投递不确认。

**（B）Session 遥测的区间变更：3 增 3 删，全部是语义修正，不是默认值变更**

`docs/subsystems/session-telemetry.md`（210 行）本版 diff **恰好 3 增 3 删**。逐条：

1. `:14` 附近，`SessionTelemetrySeverity` 的 JSDoc：`the tool-result block's isError` → **`the tool message's isError`**（术语与 v4 的 tool message 结构对齐）；
2. `:58` 附近，投递语义段被扩展：

```diff
-Every canonical session event ... passes through whole as one ordered ledger record. ... A new Session object starts at its lifecycle boundary unless the backend selects `includeHistory`; re-adopting the same object resumes after its handoff cursor.
+Every canonical session event ... passes through whole as one ordered ledger record. ... A new fork starts at its child-owned suffix, including the inherited marker and fork closers; restored Sessions start after their stored prefix, including restored forks. The backend can select `includeHistory` to include the complete prefix; re-adopting the same object resumes after its handoff cursor.
```

3. `:83`，`SessionTelemetryCaptureOptions.includeHistory` 的 JSDoc：

```diff
-  /** Include stored history before this lifecycle; defaults to false. */
+  /** Include inherited fork history and stored history from earlier lifecycles; defaults to false. */
```

**关于"0.1.6 曾把 Session 日志上报默认开启，本版是否变化"的核实结论**：**未变化**。判断依据是机械而非印象——该文档的 `## The sharing disclosure` 段（`:60`）与 `SessionTelemetryRecord` / `SessionTelemetryCaptureOptions` 的类型定义段在本版 diff 中**未被触及**；唯一涉及 `defaults to false` 的那一行是 `includeHistory` 的语义**扩宽**（从"本生命周期之前的已存历史"扩到"继承的 fork 历史 + 更早生命周期的已存历史"），**默认值仍为 `false`**，`capture` 仍 `defaults to live`。因此本版改变的是"fork 与 restored Session 的投递起点"，**不是**"是否默认上报"。

配套的包级改动（实测）：`packages/session/session-telemetry/` 7 文件 +112 / −21（`src/coordinator.ts` 13 行、`src/index.ts` 2 行、`tests/telemetry.spec.ts` +96 行 → 新增测试正是覆盖 fork/restore 起点）；`packages/session/session-telemetry-otel/`（`package.json` 50 行、`tests/otel.spec.ts` 17 行）；`packages/session/session-log-deepseek/`（`package.json` 40 行、`src/index.ts` 1 行、`tests/feedback-composition.spec.ts` 12 行、**`tests/upload.spec.ts` +53 行**）。三个包合计 16 文件 +864 / −55。

---

### 12.8 桌面发布：版本即入参、签名分期与缓存、COS 上传

桌面发布是本版 note 密度最高的主题。**先用 diff-filter 确认归属**：以下 8 篇全部出现在区间新增清单 `_analysis_output/dsh017/notes-added.txt` 中，即**均为本版新增**，无一篇是既有 note 的改写：

| note | 桶 | 行数 |
|---|---|---:|
| `2026-09-16-desktop-release-version-derivation.md` | `implemented/process` | 15 |
| `2026-09-21-desktop-build-version-as-input.md` | `implemented/process` | 19 |
| `2026-09-17-windows-signature-completion.md` | `implemented/process` | — |
| `2026-09-17-windows-runtime-signature-cache.md` | `implemented/process` | — |
| `2026-09-16-desktop-cos-upload-transport.md` | `implemented/architecture` | 22 |
| `2026-09-14-desktop-installed-update-journal.md` | `implemented/testing` | 15 |
| `2026-09-14-desktop-installed-update-materials.md` | `implemented/testing` | 25 |
| `2026-09-10-desktop-local-updater-qualification.md` | `implemented/testing` | 26 |

**（1）版本派生与"版本即入参"——两条 note 构成一次自我推翻**

`2026-09-16-desktop-release-version-derivation.md` 先解决"测试构建该叫什么"：**保留完整的 dsh 基版本**用于生产，并从该基版本派生带日期与序号的测试版本；派生版本**作为参数传给打包**而不是写进 manifest，且从 dsh 基版本派生，使另一个测试发布无法追加第二个日期后缀。它同时拒绝了三件事：把 alpha/beta/rc 换成 nightly（会丢弃基版本 prerelease 并可排序到其后续发布之上，阻止更新到目标版本线）、随 prerelease 标识改名 feed（已安装客户端会继续查既有 feed 而错过替换发布）、以及**启用降级来修复编号错误的发布**（全局降级允许会改变普通更新安全性；受影响的安装用手动安装器，仅修正 feed 无法迁移它们）。

`2026-09-21-desktop-build-version-as-input.md` 接着解决"这个名字住在哪"。它记录了入参化之前的实际代价，数字精确：

> Publishing one meant running `release:dsh` to rewrite the version in every release-family manifest and the lockfile — **295 files** — because packaging, the update feed, and upload validation each read the version from the checkout. Those edits are never committed, so a test build left the working tree dirty...

以及两个"事后不可恢复"的事实：交给同事或推到测试 feed 的构建**从任何 tag 都不可达**，其来源构建树不是一次 checkout，因此**没有任何东西把安装器连回它的源码**；生产发布同样只记录在 bucket 里。

决策：`--build-version` 命名版本，`--build-version auto` 提议当天的下一个序号，该值经 **`extraMetadata`**、更新 feed 与上传校验作为**同一个输入**抵达 electron-builder；**manifest 保留产品版本，因此没有任何打包运行修改 tracked 文件**。版本规则本身不变（生产发 dsh 基版本；prerelease 基版本取 `.YYYYMMDD.index`；stable 基版本取 `-test.YYYYMMDD.index`）。校验用 `semver` 自身，因为 `electron-updater` 用 `semver.gt` 对比 feed 版本与已安装的 `app.getVersion()`。

该 note **显式声明它取代了前一篇的两项要求**（"This supersedes two requirements of that note."）：release-family manifest 不再被改写；且 shell 版本不再等于内嵌 runtime 版本。每个产物在 manifest 中记录 **`dshBuildCommit`** 与 **`dshBuildDirty`**；生产上传在产物公开后把打包 commit 打上 **`desktop-v<version>`** tag，并且**报告供手工运行的命令，而不是让一个已经完成的上传失败**；来自被修改 checkout 的构建**不打 tag**；测试与本地构建**刻意不打 tag**（每次测试构建都打 tag 会让 `desktop-v*` 失去寻找发布的能力）。

被拒备选里有一条反映了工程判断的优先级：**"Keep rewriting manifests and revert afterwards." → "The dirty tree is the defect, and a revert races anything else reading the workspace."**

**（2）Windows 签名：分期与缓存**

`2026-09-17-windows-signature-completion.md` 的问题陈述是一句精准的诊断：**合并的 SignTool 命令会把时间戳失败报成签名失败**——重试它会重复硬件访问，而把每个时间戳错误都当作不确定的私钥结果又需要管理员恢复。

决策：**先签一份私有 PE 副本且不带时间戳**；只有执行成功且 Windows 验证了配置的主签名之后才释放硬件互锁；硬件或主验证失败**保留互锁**，**没有任何路径自动恢复它**；不支持附加签名。随后对冻结的已签名文件的**新鲜副本**打时间戳且不携带签名凭证；只有正常失败或警告退出才允许再次尝试——**至多三次调用，延迟 1 秒与 2 秒**；启动失败、终止不确定、存储变更与验证失败立即停止；预检的**总 60 秒**截止包含这些操作，且**不保证三次完整子进程截止**。写回比对要求"移除未签名签名属性后**完整归一化字节相等**"，理由是"证书相等本身无法排除同一证书签名的不同内容"。

`2026-09-17-windows-runtime-signature-cache.md` 给出一组可直接引用的实测数字：

- 缓存键为"原始内容 + 公共证书 + SignTool 字节 + 签名脚本字节 + 缓存格式"（6 项）；
- 公钥检查按 **32 个文件**一批分组、至多 **4 个进程**；要求每个请求路径都有唯一有序结果；
- 恢复用有界 worker 池：**4 个 worker 为可配置默认值**；
- 热缓存实验（134 个 primary-runtime 文件 + 228 个 application 文件）：**1 worker 226.18 s → 4 worker 63.22 s → 8 worker 42.18 s**，但 8 worker **CPU 增加 25.5%、峰值提交内存 387 → 631 MiB**；
- 完整 Windows x64 构建冷/热对比：**硬件调用 379 → 17**，**耗时 37:03 → 13:45**，**362 个 runtime 条目全部命中**；缓存恢复耗时 **132 秒（含 130 秒的当前信任验证）**；
- 独立的受控 native 文件改动产生 **miss/hit/miss 与两次硬件调用**，且 note 明确它"测的是失效，不是依赖版本升级"。

note 同时给出 Risks 段（本地磁盘占用、依赖构建账号控制文件与记录、**不是面向不可信远程缓存的发行格式**、缓存命中**不授权**清除签名互锁或重试失败的令牌操作）。

配套新增脚本：`scripts/primary-runtime/{prepare.ts, prepare.spec.ts, lock.json, smoke.py}`，并在根 `package.json` 注册 `"prepare:primary-runtime": "tsx scripts/primary-runtime/prepare.ts"`；`scripts/release/process.spec.ts` 亦为新增。

**（3）上传通道：从 S3 客户端换到腾讯 COS SDK**

`2026-09-16-desktop-cos-upload-transport.md` 的问题描述是"我们拥有的那一部分导致了不可解释的元数据"：此前用 **AWS S3 客户端指向腾讯 COS 端点**，其默认校验和配置可能以 `Content-Encoding: aws-chunked` 发送流式请求 trailer；这个标记 S3 会在存储前移除，但兼容路径可能把它留作对象元数据。note 记录的现象与**同时给出限定**：一次用户可见的应用下载在响应头之后立即失败于 HTTP/2 `RST_STREAM`，而同一连接上的相邻下载完成，且被报告携带该标记的对象分段下载失败——"没有任一观察能确定唯一原因，但上传传输是本仓库拥有的部分，而**CDN 提供源请求从未产生的元数据，本身就是一个值得在继续追查前先消除的缺陷**"。

决策：`apps/desktop/scripts/desktop-cos.ts` 用官方 `cos-nodejs-sdk-v5` 构建每个 Desktop COS 客户端——HTTPS、**无 keep-alive、不跟随重定向、不切换备份主机、不做时钟偏移修正、900 秒不活动超时**；`upload-target.ts` 与 `installed-update-cos.ts` 从该工厂取客户端；**`@aws-sdk/client-s3` 不再是 Desktop 依赖**。

**（4）已安装更新的取证隔离**

- `installed-update-journal`：Desktop 主入口接受可选的**绝对路径** `DSH_DESKTOP_UPDATE_JOURNAL_DIR`；资格验证包必须在版本间保留同一外部目录；每个进程**独占创建一个 JSONL 文件**并在继续前刷入白名单化的状态与动作记录；用已安装版本、PID、序号与 UTC 时间标识记录；**原始错误、URL、请求头与聊天内容被省略**；已知错误 token 产生固定分类而非复制诊断——这是一条隐私边界的设计（"Raw updater diagnostics can contain private URLs or credentials."）。
- `installed-update-materials`：一次已安装更新走查需要两个递增版本与共享的应用标识；复用普通发布路径会把测试元数据暴露给无关客户端，而把测试状态存在安装目录内会在替换中丢失证据；**一次成功的复制并不能证明存在已签名的安装器**。
- `local-updater-qualification`：Windows 本地资格命令在 Electron 内运行构建出的生产协调器，使用真实 `ElectronHttpExecutor` 与 `NsisUpdater`；隔离的应用适配器提供测试版本与私有更新配置；loopback 服务器提供 Nightly YAML、强制策略与惰性二进制字节；安装器、外部浏览器与剪贴板调用被替换为观测；**发布者验证只在这份私有 fixture 配置中缺席，绝不在生产配置中缺席**。

---

### 12.9 依赖治理与 experimental 隔离闸门

**（1）依赖目录与模块图的区间变更**

| 文件 | 区间变更 | 说明 |
|---|---|---|
| `docs/dependency-catalog.json` | +2 / −2 | 唯一实质变更：`@deepseek-ai/dsh-agent-presets` → **`@deepseek-ai/dsh-agent-preset-registry`**（同时改 `location`） |
| `docs/module-graph.md` | +248 / −154 | 新增 `pkg_lazy_require`、`pkg_skill_office`、`pkg_tool_workspace_dependencies`、`pkg_api_account_controller`、`pkg_api_job_controller`、`pkg_config_editor`、`pkg_hmr`、`pkg_plugin_manager`、`pkg_client_ui_plugin_manager` 等节点；`pkg_tool_present` 从 `group_fs` 迁出 |
| `docs/rescope.md` | +1 / −1 | 区间规则从"`workspace:^`"改为指回 `AGENTS.md#conventions` |

`module-graph.md` 的节点增减是**生成物**，其规模反映了本版包组的实际扩张（52 → 54 顶层包组，新增 `deliverables`、`document`）。

**（2）experimental 发布隔离闸门：延续而非新建**

任务描述问"`packages/experimental` 的发布隔离闸门是否延续"。**核实结论：延续，且本版被加强。** 证据：

- **策略 owner 未变**：`.agents/notes/implemented/process/2026-09-12-experimental-publication-denylist.md` 仍被 `packages/experimental/README.md` 与 `packages/experimental/AGENTS.md` 同时引用为发布策略的 owner；
- **包前缀规则未变**：`packages/experimental/AGENTS.md` 规定每个包使用 `@deepseek-ai/dsh-experimental-*` 前缀并默认加入 dsh 发布族（省略 `private`、设 `publishConfig.access: public`），**只有 `scripts/experimental-package-policy.ts` 中 `PRIVATE_EXPERIMENTAL_PACKAGE_DIRECTORIES` 列出的目录保持 private**；
- **隔离规则未变且覆盖更广**："Release packages and apps outside this group must not name experimental packages in `dependencies`, `optionalDependencies`, or `peerDependencies`"，并明确 **Default-product isolation 也检查传递安装、运行时导入与随包组合（shipped compositions）**；
- **包数 16 → 20**，新增的语音族 5 包（`api-speech-to-text`、`speech-to-text`、`speech-to-text-sensevoice`、`client-ui-voice-input`、`voice-input-bundle`）全部落在这套规则下；`agent-team-web-profile` 被**整包删除**（8 文件 / −303），其 `ui-agent-team` 行并入既有的 `agent-team-profile`——**这不是改名**（0.1.6 时两包并存），且留下"仍选择已删 bundle 的 profile 启动即失败"的升级缺口（详见第 07 篇）；
- **闸门本版被改**：`scripts/verify-default-product-isolation.ts` **72 行改动**，gate id `default-product-isolation` 位于 `run-gates.ts:344` 的 `ciSharedStaticGates()`，属**静态 CI 主门**；
- **实验状态不放松任何要求**：`packages/experimental/AGENTS.md` 明写"Experimental status does not relax engineering, security, documentation, lifecycle, testing, invariant, or snapshot requirements"，且"Publishing an experimental package does not promote it or add a stability promise."

**（3）包组规模变化（实测）**

| 包组 | 0.1.6 | 0.1.7 |
|---|---:|---:|
| `packages/experimental/` | 16 | **20** |
| `packages/util/` | 15 | **16**（新增 `lazy-require`） |
| `packages/test-support/` | 7 | 7 |
| 全局 `package.json`（含根） | 315 | **344** |

`packages/util/lazy-require/` 是本版唯一新增 util 包（`src/index.ts`、`tests/index.spec.ts`、`tests/fixtures/value.cjs`、`package.json`、`tsconfig.json` 与三兄弟 README）。

---

### 12.10 测试体系：快照分区、门禁挂载与并发预算

**（1）`docs/testing.md`：1 增 1 删**

Web 浏览器快照层的整句被替换（见 12.1 的引述）。实质变化有三：明确**先构建 plugin CSS**；把比较范围写成"全部 session 驱动的 `snapshots/web/` 与 UI-only 的 `apps/web/tests/expected/`"（旧文把两者分开陈述）；**模型/推理选择器另跑 WebKit**（旧文只提 Chromium）。

**（2）vitest 配置：三个文件有改动，六个未变**

```text
vitest.config.ts          | 16 ++++++++++------
vitest.snapshot.config.ts | 12 +++++++++---
vitest.e2e.config.ts      |  4 ++--
vitest.shared.ts / vitest.expected.config.ts / vitest.web.config.ts /
vitest.bench.config.ts / vitest.web-stress.config.ts / vitest.web.perf.config.ts  → 无改动
```

`vitest.config.ts` 四处实质变更：

1. `testIncludes` 的 apps 通配由 `*.spec.ts` 扩为 **`*.spec.{ts,tsx}`**（允许 app 层出现 client component spec）；
2. `setupFiles` 追加 **`./scripts/test-dom-environment.ts`**，且三处 lane 定义同步；
3. 覆盖率**新增豁免** `packages/client/ui-sidebar-browser/src/client/electron/**`（注释：Electron guest 集成保留其单测，per-file 覆盖推迟到原生 Electron harness 能覆盖 guest 行为）；
4. 覆盖率**新增豁免** `packages/experimental/client-ui-voice-input/src/client/index.ts`（注释：voice 入口也导入生成的 Remote 定义，`voice-input.e2e.ts` 覆盖构建产物，源码测试覆盖 `mountVoiceInput`）；并**移除** `packages/client/modules/src/client/system.ts` 与 `packages/client/hmr/src/client/index.ts` 两条旧豁免。

`vitest.snapshot.config.ts` 引入一个**独立的文件级 worker 预算**：

```ts
const snapshotMaxWorkers = process.env.DSH_SNAPSHOT_MAX_WORKERS
  ? positiveIntFromEnv('DSH_SNAPSHOT_MAX_WORKERS', availableParallelism())
  : undefined
// ...
fileParallelism: (process.env.DSH_SNAPSHOT || 'replay') === 'replay'
  && (snapshotMaxWorkers ?? snapshotMaxConcurrency) > 1,
maxConcurrency: snapshotMaxConcurrency,
...snapshotMaxWorkers === undefined ? {} : { maxWorkers: snapshotMaxWorkers },
```

即把原先耦合的"文件并行"与"文件内并发"拆成两个预算：`DSH_SNAPSHOT_MAX_WORKERS` 控制文件级 worker，`DSH_SNAPSHOT_MAX_CONCURRENCY`（既有）控制文件内并发；**未给 worker 覆盖时，文件内并发为 1 即完全串行**。note 的注释保留了原设计意图：record 与 refresh 保持串行，因为 record 按场景消耗真实 API 配额，而 refresh 要从磁盘上的 fixture 回收易变值，并发写者会破坏期望输出。

`vitest.e2e.config.ts` 把 include 从"仅 `apps/cli`"扩为**显式的 Node app owner 列表**：

```diff
-    // apps/cli only, not apps/*: apps/web/tests/*.e2e.ts needs the built
+    // Explicit Node app owners only: apps/web/tests/*.e2e.ts needs the built
     // frontend dist and runs under vitest.web.config.ts (the test:web job).
-    include: ['packages/*/*/tests/**/*.e2e.ts', 'apps/cli/tests/**/*.e2e.ts'],
+    include: ['packages/*/*/tests/**/*.e2e.ts', 'apps/cli/tests/**/*.e2e.ts', 'apps/desktop/tests/**/*.e2e.ts'],
```

**（3）快照规模**

```text
git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- snapshots
  → 342 files changed, 11223 insertions(+), 3995 deletions(-)
```

按变更类型：**新增 144 个文件、删除 3 个**。`snapshots/snapshot.yml` 场景数 **177 → 199**。`snapshots/AGENTS.md` 有 1 增 1 删（快照归属规则的一句调整）。四个顶层子目录 `acp` / `sdk` / `session` / `web` 保持不变。

**（4）测试基础设施**

`packages/test-support/` 68 files +2152 / −647，7 个包无增删。实质改动集中在 `session-snapshot`（11 文件 +249 / −50）：`src/normalize.ts` 51 行、`src/suite.ts` 40 行、`src/manifest.ts` 6 行、`tests/normalize.spec.ts` +84、`tests/suite.spec.ts` +36，并新增 fixture `tests/fixtures/subagent-activation-limit.ts`（23 行）。`packages/test-support/README.md` 本身**未变**。

`scripts/` 侧新增的测试支撑：`scripts/test-dom-environment.ts`、`scripts/volatile-config.{fixture.ts,spec.ts}`、`scripts/loader-config-diff.spec.ts`、`scripts/loader-volatile-update.spec.ts`、`scripts/request-input-types.spec.ts`。

**（5）基准**

`benchmarks/` 12 files +66 / −47，全部为 `M`（无增删），涉及 `agent-continuation/*`（4 文件）、`long-session-browser/*`（5 文件含三兄弟 README）、`session-open/session-open.worker.ts`、`terminal-io/terminal-io.worker.ts`、`benchmarks/package.json`。`long-session-browser` 的 README 三兄弟被改动，说明该基准的**说明契约**随之更新。

---

### 12.11 流程治理三件套：权重、委派、作者信用

三篇 note 全部为本版新增，且构成一套完整的评审计分规则：

| note | 行数 | 核心规则 |
|---|---:|---|
| `2026-09-11-production-blame-approval-weight.md` | 18 | 一票 approval 按 **`min(2, 1 + 4 × ownedLines / totalLines)`** 缩放，分母是**变更的旧生产行** |
| `2026-09-15-pr-approval-delegation.md` | 17 | PR 会话评论中 `/delegate @username` |
| `2026-09-16-author-approval-credit.md` | 13 | 每个已合并 PR **0.011 分**，**100 个 PR 后封顶 1.1 分** |

**权重 note 的要点**：0% 所有权给 1 分，12.5% 给 1.5 分，**25% 及以上给 2 分**；分数在与 2 分成功阈值比较前**不取整**；merge base 同时提供分类与 blame；**新增行没有先前 owner，不贡献行**；空分母不产生加成。被拒备选里两条尤其说明取舍：硬阈值（线性加权能区分 25% 以下的部分所有权）、目录级所有权（"改动目录里别处的代码不构成对所审行的所有权"）。note 还给出可复核的本地测量：PR **#3969** 与 **#3977** 分别计 **73 / 535** 条旧生产行、跨 **4 / 14** 个文件；三次本地运行 **0.31–0.32 s** 与 **0.87–0.93 s**；一次批量作者查询每 PR 约加 1 秒；同主机上 master 的全新单分支 bare clone **47 秒**——并声明"这些是主机观测，不是 CI 时间保证"。

**委派 note 的要点**：`/delegate @username` 写在 PR 会话评论；每个合格发送者的分数**按其权重、跟随被指名人有效 approval 一次**；**仅作用于该 PR**，仅限非 PR 作者的有写权限账号之间；**收到的分数不可再转授**；命令通过 GitHub 驳回发送者先前的 approval 与 change request；最新存活的合格命令（按创建顺序）决定接收者；**编辑过的命令要求最后编辑者匹配作者不可变账号 ID**；自委派或随后提交的 review 恢复发送者自己的决定；等时间戳偏向 review。

**作者信用 note 的要点与它唯一拒绝的备选**：拒绝"在 150 个 PR 时保持 0.6 分封顶"，理由是**该上限无法与普通一分的 review 组合达到要求**；新规则下**一次无所有权加成的普通 approval 在 91 个已合并 PR 时达标，90 个只有 1.99 分**。

**机械证据**：根 `package.json` 的 `test:approval-policy` 由跑 1 个测试文件扩为 3 个：

```diff
-"test:approval-policy": "node --test .github/review-ownership/check-approval.test.mjs",
+"test:approval-policy": "node --test .github/review-ownership/check-approval.test.mjs .github/review-ownership/blame-ownership.test.mjs .github/review-ownership/author-weight.test.mjs",
```

该命令被 `run-gates.ts:353` 注册为 gate `approval-policy`（label "Weighted approval policy"），位于 `ciSharedStaticGates()`。三篇 note 各自声明的测试覆盖分别为：策略测试（阈值、零分母、阻塞、共享测量、失败归因）、作者测试（批量、账号聚合、不完整响应）、Git 集成测试（merge base、重命名、删除、混合注释行、排除项、浅历史、不 checkout PR 代码的抓取）——分别落在 `check-approval.test.mjs`、`blame-ownership.test.mjs`、`test_blame_production.py`。

---

### 12.12 本版未变更项与未核实项

**明确未变更（实测空 diff）**

| 对象 | 核实方式 |
|---|---|
| `docs/defensive-patterns.md` | `git diff --shortstat ... -- docs/defensive-patterns.md` 无输出 |
| `docs/glossary.md` | 同上，无输出 |
| `docs/graph-atlas.md` | 同上，无输出 |
| `docs/agent-lifecycle.md` | 同上，无输出 |
| `vitest.shared.ts`、`vitest.expected.config.ts`、`vitest.web.config.ts`、`vitest.bench.config.ts`、`vitest.web-stress.config.ts`、`vitest.web.perf.config.ts` | `git diff --stat` 未列出 |
| `packages/test-support/README.md` | `git diff --stat` 无输出 |
| `docs/cookbook/` 无新增文件 | `--diff-filter=A` 返回空；目录条目 33 → 33 |
| `docs/` 无删除文件 | `--diff-filter=D` 返回空 |
| `benchmarks/` 无增删文件 | `git diff --name-status` 全为 `M` |

**机制未变但表面积扩大**：`.i18n.yaml`（+194）、`.zh.md`（+194）、英文 note（+152）、`snapshots/snapshot.yml`（+22）的增长都是"既有规则继续被更多文件遵守"，而不是规则本身变更。

**发现并更正的一处任务描述**：任务描述称 `docs/persistence-changes/historical-formats/` 为"本版新建"。实测**该目录在 0.1.6 已存在并含 v0/v1/v2**；本版只新增 v3 一族（4 个文件）。见 12.2。

**关于 `packages/guard` 的判定**：本版 `packages/guard/` 的 4 文件 +48 / −35 **与工程门禁无关**，属产品行为：

- `packages/guard/repeat-tool-reminder/`：`src/index.ts` 把注入提醒的 source 从 `{ kind: 'plugin', plugin: 'repeat-tool-reminder' }` 改为 `{ kind: 'repeat-tool-reminder' }`，并新增 `declare module '@deepseek-ai/dsh-llm'` 的 `MessageSourceMap` 条目（`'repeat-tool-reminder': { kind: 'repeat-tool-reminder' } & ContextFormed`）；JSDoc 从"stamped on every reminder"改写为"producer source"。这是**消息来源分类**的变更，属 v4 持久化语义族。
- `packages/guard/timeout-policy/package.json`：**唯一与工程面相关**的改动——`workspace:^` → `workspace:*` / `workspace:~`，即 12.3 的发布区间迁移，无版本语义以外的变化。

因此本篇把 `guard` 记为"**经核实与本版工程门禁无实质关系**"，而不是罗列一个非工程改动。

**补做核实（两项原「未核实」已结清）**

**(a) `packages/runtime-diagnostics/` 的 +8 / −8 不是纯版本同步，含一处实质重命名。**

```text
git diff dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/runtime-diagnostics/
```

逐行结果：4 个文件的实际构成是

| 文件 | 改动性质 |
|---|---|
| `invariants/README.md` | **语义**：配套不变式表中 `dsh-agent-presets` → **`dsh-agent-preset-registry`** |
| `invariants/README.zh.md` | 同上（中文侧同一行同步改名） |
| `invariants/README.i18n.yaml` | **派生**：因两侧 README 被编辑而重录 blob 哈希（`3841ca14…` / `913a72bc…` → `edb51231…` / `1e2216a3…`） |
| `invariants/package.json` | **混合**：`version` `0.1.6-alpha.1` → `0.1.7-rc.1`；`@deepseek-ai/cordis` 与 `@deepseek-ai/schemastery` 由 `workspace:^` → **`workspace:~`**（二者均在 `vendor/`，符合 12.3 的区间规则） |

即 **2 个文件是实质内容修订、1 个是它的派生物、1 个是版本号 + 发布区间**。该重命名与 12.9 中 `docs/dependency-catalog.json` 观测到的 `dsh-agent-presets` → `dsh-agent-preset-registry` **互相印证**——同一个包在两处互相独立的记录里被同时改名。

**(b) `packages/host/product-telemetry-otel/` 不被任何 shipped profile 挂载；「谁挂载了它」的答案是「没有」。**

```text
git grep -n "product-telemetry" dsh-v0.1.7-rc.1   # 排除该包自身目录后
→ 命中全部落在这些非组合面：
  生成文档 docs/{capability-seams,config-catalog,module-graph}.md、docs/subsystems/README.md、
  docs/subsystems/product-telemetry.i18n.yaml、packages/host/README.md、pnpm-lock.yaml、
  scripts/{gen-cordis-catalog,gen-doc-graphs,type-equiv.manifest.json,
           verify-package-readme-model-experience}.ts、tsconfig.host.json、
  packages/preset/agent-preset/skills/cordis-composition-reference/references/packages.md

git grep -l -i "producttelemetry|product-telemetry-otel" dsh-v0.1.7-rc.1 -- "*.yml" "*.yaml"
→ 只有 3 个文件：
  packages/host/product-telemetry-otel/README.i18n.yaml（自身的配对记录）
  packages/host/product-telemetry-otel/tests/fixtures/telemetry.patch.yml（自身的测试 fixture）
  pnpm-lock.yaml
```

**结论：全部 `cordis.yml` / `cordis.patch.yml`——含 `packages/bundle/{base,web-app,headless,sdk-app,sdk-minimal,acp-app}/cordis.patch.yml`、`apps/cli/**` 与各 snapshot/fixture 配置——以及 `apps/*` 中，没有任何一处挂载 `@deepseek-ai/dsh-host-product-telemetry-otel`。** 该包在本版以"可加载但未被组合"的形态发布：**结构性默认不发**，只有操作者用 profile patch 显式加行才会存在。

交叉证据：`docs/capability-seams.md:606`（表头在 `:566`，列为 `| ctx key | Role | Owner | Implementations | Direct consumers | Companion plugins | Note |`）该行是

```text
| `ctx.productTelemetry` | `service` | [`host-product-telemetry-otel`](...) | - | - | - | Exports explicitly submitted analytics events through OTLP/HTTP; mounting alone collects nothing. |
```

即 **Implementations / Direct consumers / Companion plugins 三列全为 `-`**：无实现者、无消费者、无配套插件。

一处需要防误读的旁证：`packages/preset/agent-preset/skills/cordis-composition-reference/references/packages.md:253` 给该包标 `yes`，但该表表头（文件开头）已声明 **`Config` 列标记的是"该包的行接受 `config` 映射"**，不是"是否被组合挂载"——故此 `yes` **不构成挂载证据**。

**与 `session-telemetry` 的对照（本版两条遥测 seam 的装配状态相反）**：`session-telemetry-otel` **确实被 `packages/bundle/base/cordis.patch.yml:204-210` 挂载**，且行内给出出厂默认：

```yaml
    - id: session-telemetry-otel
      name: '@deepseek-ai/dsh-session-telemetry-otel'
      config:
        mode: !!js process.env.DSH_TELEMETRY_MODE || 'FEEDBACK_ONLY'
        shutdownTimeoutMillis: 3000
        exporter:
          url: !!js process.env.DSH_TELEMETRY_OTLP_URL ?? 'https://harness-telemetry.deepseeksvc.com/v1/logs'
```

同文件 `:187-199` 的注释另给出两条本篇先前未记录的事实：**退出开关的语义是"任何非空 `DSH_TELEMETRY_DISABLED`（含 `'0'`/`'false'`）即退出"，且 config 无法禁用一个行，只有启动器能把它 patch 成 disabled**；**导出携带 `$DSH_HOME/.anonymous-user-id`（随机 UUID，删除该文件即重置身份）作为 Resource 的 `user.id`**。

据此，12.7 的结论可以收紧为一句：**产品遥测在组合层根本未被挂载（结构性默认不发），而 Session OTel 遥测在 base bundle 中确实挂载并以 `FEEDBACK_ONLY` 为出厂默认——两者的"默认"不在同一层，不可互相类推。**

**仍未核实项（显式声明）**

1. **`docs/` 生成物与源的一致性**——`module-graph.md`、`persistence-catalog.md`、`tool-catalog.md`、各 `cordis-surface` 区块均未在本机重跑生成器验证新鲜度（需完整 `pnpm install` + 构建）。本篇只报告 `git diff` 观测到的差异规模，**不声称生成物与源一致**。
2. **桌面的实测数字**——12.8 中所有秒数、硬件调用次数、内存与 CPU 百分比均**转引 note 原文**，未在本机复现（需 Windows 签名硬件令牌、真实 COS bucket 与 Electron 打包链）。
3. **`docs/i18n/terminology.md` 之外的双语配对健康度**——未逐对检查 1743 个 `.i18n.yaml` 的哈希是否与其两侧当前内容一致（需跑 `pnpm run verify-translation-pairing`）。
4. **`.agents/skills/` 两个新增 skill 的内容**——只确认 `agent-experience` 与 `dsh-client-ui-ux` 的 `SKILL.md` 为新增，**未阅读其内容**，因此不评价它们与本篇主题的关系。

---

## 附录：本版工程面提交索引

以下为按主题归集的**文件级索引**，所有路径均在本版快照中实际存在（`git cat-file -e dsh-v0.1.7-rc.1:<path>` 通过）。

**A. 新增的官方文档（9 篇英文 + 兄弟文件）**

```text
docs/subsystems/boot.md
docs/subsystems/deliverables.md
docs/subsystems/office-to-pdf.md
docs/subsystems/product-telemetry.md
docs/subsystems/voice-input.md
docs/persistence-changes/2026-09-14-workspace-changes-event.md
docs/persistence-changes/2026-09-16-session-format-v4.md
docs/persistence-changes/2026-09-20-unknown-child-catalog.md
docs/persistence-changes/historical-formats/v3.md
docs/persistence-changes/finalized/v4.json          （生成物，非 md）
```

**B. 新增的闸门与生成器脚本（`scripts/`，本版共 +47 / −0 文件）**

```text
scripts/verify-no-unknown-casts.ts        (186 行)   scripts/no-unknown-casts.baseline.json (2293 行 / 561 条目 / 1460 计数)
scripts/verify-package-meta.ts                       scripts/verify-package-paths.spec.ts
scripts/verify-client-route-resolution.ts            scripts/verify-v3-event-vocabulary.ts
scripts/persistence-review.ts             (230 行)   scripts/persistence-review.spec.ts
scripts/persistence-source-annotations.ts (81 行)    scripts/persistence-source-policy.ts (69 行)
scripts/persistence-finalization.ts       (172 行)   scripts/persistence-developer.spec.ts
scripts/persistence-epoch-header.spec.ts             scripts/historical-schema-region.ts
scripts/test-dom-environment.ts                      scripts/gen-plugin-packages.ts
scripts/primary-runtime/prepare.ts                   scripts/primary-runtime/prepare.spec.ts
scripts/release/process.spec.ts                      scripts/volatile-config.fixture.ts
scripts/migrate-sessions-to-v4.ts                    scripts/migration-failure-summary.ts
scripts/loader-config-diff.spec.ts                   scripts/loader-volatile-update.spec.ts
scripts/request-input-types.spec.ts                  scripts/libreoffice-packages.mjs
```

**C. 被改动的闸门**

```text
scripts/check-workspace-constraints.ts   (+111/-...)  → 片段 C 的区间判定
scripts/verify-default-product-isolation.ts (+72)     → experimental 隔离
scripts/verify-package-dependencies.ts      (+59)
scripts/run-gates.ts:344,350,365,367                   → 新门挂载点
scripts/doc-budgets.manifest.json                      → docs/architecture.md 2400 → 2410
```

**D. 新增的包**

```text
packages/host/product-telemetry-otel/    （8 文件；src/index.ts 171 行）
packages/util/lazy-require/              （8 文件）
packages/experimental/{api-speech-to-text,speech-to-text,speech-to-text-sensevoice,
                       client-ui-voice-input,voice-input-bundle}/
```

**E. 本版新增的关键 note（按桶）**

```text
implemented/process/2026-09-17-persistence-schema-review.md              (20 行)
implemented/process/2026-09-22-workspace-release-ranges.md               (14 行)
implemented/bug-fix/2026-09-23-bounded-pnpm-runs.md                      (37 行)
implemented/process/2026-09-19-no-unknown-casts.md                       (18 行)
implemented/process/2026-09-19-evidence-led-simplification-surveys.md    (37 行)
implemented/process/2026-09-11-production-blame-approval-weight.md       (18 行)
implemented/process/2026-09-15-pr-approval-delegation.md                 (17 行)
implemented/process/2026-09-16-author-approval-credit.md                 (13 行)
implemented/process/2026-09-16-desktop-release-version-derivation.md     (15 行)
implemented/process/2026-09-21-desktop-build-version-as-input.md         (19 行)
implemented/process/2026-09-17-windows-signature-completion.md
implemented/process/2026-09-17-windows-runtime-signature-cache.md
implemented/architecture/2026-09-16-desktop-cos-upload-transport.md      (22 行)
implemented/testing/2026-09-10-desktop-local-updater-qualification.md    (26 行)
implemented/testing/2026-09-14-desktop-installed-update-journal.md       (15 行)
implemented/testing/2026-09-14-desktop-installed-update-materials.md     (25 行)
```

**F. 区间内新增 note 的桶分布（全 165 篇，来自 `_analysis_output/dsh017/notes-added.txt`）**

| 桶 | 数量 |
|---|---:|
| `implemented/architecture` | 59 |
| `implemented/feature` | 41 |
| `implemented/bug-fix` | 24 |
| `implemented/process` | 12 |
| `proposed/simplification` | 10 |
| `implemented/simplification` | 6 |
| `archived/*` | 7 |
| `implemented/testing` | 3 |
| `proposed/feature` | 3 |
| **合计** | **165** |

**G. 复现本篇全部数字的命令骨架**

```powershell
# 基线
git diff --stat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- docs scripts snapshots benchmarks packages/test-support packages/runtime-diagnostics packages/util
# 单目录
git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- <path>
# 文档计数
(git ls-tree -r --name-only dsh-v0.1.7-rc.1 docs/ | Where-Object { $_ -like '*.md' -and $_ -notlike '*.zh.md' }).Count
# 新增/删除清单
git diff --name-status --diff-filter=A dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- <path>
# 门禁挂载
Select-String -Path scripts/run-gates.ts -Pattern 'no-unknown-casts|verify-package-meta|default-product-isolation'
```

---

*本篇为 v0.1.7-rc.1 源码解析系列第 12 篇。所有数字均来自本机对 `E:\test\rewrite-agently\deepseek-harness`（已 checkout 到 `dsh-v0.1.7-rc.1`）的实测；转引 note 原文的数字已在 12.12 显式标注。*
