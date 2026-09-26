# 【第 14 篇】packages/deliverables · document：交付物与 Office 文档栈

> **版本**：dsh-v0.1.7-rc.1（`46a7f68b09`），对比上版 dsh-v0.1.6-alpha.1（`0a15e36e7f`）
> 难度：🟡 进阶（建议先读本系列第 02 篇产品主干与 `docs/architecture.md` 的 capability seam 一节）
> 包范围：`deepseek-harness/packages/deliverables/` 下 2 个包（`tool-present`、`workspace-changes`）+ `deepseek-harness/packages/document/` 下 1 个包（`office-to-pdf`）；两个包组均为本版全新顶层包组
> 上游文档：`docs/subsystems/deliverables.md`、`docs/subsystems/office-to-pdf.md`、`docs/persistence-changes/2026-09-14-workspace-changes-event.md`

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
- [附录：本版提交索引](#附录本版提交索引)

---

## 引言

本版新增了两个顶层包组：`packages/deliverables/`（2 包）与 `packages/document/`（1 包）。这是 0.1.7-rc.1 相对 0.1.6-alpha.1 在包组层面**唯二**的结构性新增——BRIEF.md 记录的 52 → 54 可以在本仓库直接复核：

```powershell
# workdir = E:\test\rewrite-agently\deepseek-harness
$a = git ls-tree -d --name-only dsh-v0.1.6-alpha.1:packages   # 52 项
$b = git ls-tree -d --name-only dsh-v0.1.7-rc.1:packages      # 54 项
Compare-Object $a $b
```

实测输出（SideIndicator `=>` 表示只在 0.1.7 侧存在）：

| InputObject | SideIndicator |
|---|---|
| `deliverables` | `=>` |
| `document` | `=>` |

**没有移除项**。两个包组在 0.1.6 基线里不仅没有包，连顶层目录都不存在——这一点必须用 `git cat-file` 而不是 `Test-Path` 钉死，因为磁盘上就是本版快照：

```powershell
git cat-file -e dsh-v0.1.6-alpha.1:packages/deliverables/tool-present/package.json
# fatal: path 'packages/deliverables/tool-present/package.json' exists on disk, but not in 'dsh-v0.1.6-alpha.1'  (exit 1)

git ls-tree -d --name-only dsh-v0.1.6-alpha.1:packages/document
# fatal: Not a valid object name dsh-v0.1.6-alpha.1:packages/document  (exit 1)
```

**但"新包组"不等于"新能力"。** 本篇最重要的一条纠偏结论是：

- `deliverables/presented` 事件与 `present` 工具在 **0.1.6 就已存在**，本版只是把包从 `packages/fs/tool-present/` 原样搬进新包组，外加一次 tool description 重写（见 §本版本变更要点）；
- 真正全新的只有 **`workspace-changes` 包及其 `workspace/changes` 事件**（0.1.6 的 `docs/persistence-catalog.md` 里查不到该根）；
- `packages/document/office-to-pdf` 是本版把 0.1.6 区间内若干次 Office 改造收敛后的**唯一** Host 转换包，其前身设计（`document-render` 三包 + `native/libreoffice-wasm`）在本版已不复存在，只留在本版区间内新建又被冻结的 3 篇 archived note 里。

本文按"交付物（deliverables）→ Office 文档（document）→ 相邻能力（skill-office / 运行时）"的顺序展开，最后给出逐条核实的变更清单与本版提交索引。

---

## 概述

两个包组回答的是两个完全不同的问题，放在同一篇里是因为它们在**产品面上互相引用**（`present` 的 tool description 专门点名 Office 文档；`skill-office` 的交付段落指向 `tool-present`），但在**架构面上没有任何依赖**：

| 维度 | `packages/deliverables/` | `packages/document/` |
|---|---|---|
| 回答的问题 | 一轮 turn 交给用户什么 | Office 文件怎么在 Host 上变成 PDF |
| 对外形态 | 1 个模型可见工具 + 2 个 log-only 事件 + 1 个 Host 服务 | 1 个 capability seam（`ctx.officeToPdf`），无工具、无事件 |
| 模型可见性 | `present` 的 schema 与结果文本可见；两个事件不可见 | 完全不可见（"creates no model-facing tool or Session event"） |
| 持久化 | `deliverables/presented`（本版前已有）、`workspace/changes`（**本版新增**） | 无（源字节与 PDF 字节都不进 Session 存储） |
| 客户端消费者 | `packages/client/ui-deliverables` | `packages/client/ui-sidebar-documentpreview`（Office preview） |
| 主要外部依赖 | git 可执行文件（`workspace-changes`）、`diff@^9` | `@deepseek-ai/libreoffice-kit@^0.1.0` |
| 本版改动规模 | 33 files, +3559 | 18 files, +2188 |

三条主线可以概括本版这两个包组：

1. **交付物面从"工具包"升格为"子系统"**——`tool-present` 与全新的 `workspace-changes` 合并进 `packages/deliverables/`，配一篇官方子系统文档 `docs/subsystems/deliverables.md`，把"模型声明交付"与"宿主观测改动"统一成 deliverable 这一概念。
2. **改动摘要的持久化策略被刻意做窄**——`workspace/changes` 事件只带 `turn` 号；摘要、快照树、整文件副本全部只活在当前 Host 进程内，Session 释放即消失。官方选择"卡片与其内容同生共死"，而不是让日志里留一张永远打不开的卡。
3. **Office 转换从"自研 WASM"转向"外部 kit + 每平台一个引擎"**——本版区间内先立（`document-render` 三包 + `native/libreoffice-wasm`）后废（archived 于 2026-09-11），最终收敛为 `packages/document/office-to-pdf` + 独立发布的 `@deepseek-ai/libreoffice-kit`。

---

## 核心概念

| 术语（首次出现附英文） | 含义 | 本版是否受影响 |
|---|---|---|
| 交付物（deliverable） | 一轮 turn 交给用户的东西的总称：模型用 `present` 显式声明的文件 + 该轮实际改动的文件 | **本版新增概念**（官方子系统文档 `docs/subsystems/deliverables.md`） |
| 声明交付（presented file） | `present` 工具记录的 `{ path, description? }`；不拷贝内容，用户打开的是源文件当前状态 | 本版仅搬迁 + 描述重写 |
| 改动文件（changed file） | `workspace-changes` 观测到的一轮内被改动的文件，带加/减行数 | **本版新增** |
| turn / top-level turn | 一次完整交互轮；`workspace-changes` 只记录**非 subagent 来源**的顶层 turn | 未变 |
| log-only 事件 | 只进 Session 日志、不产生模型历史的持久化事件（`surface: false`） | 两个事件均属此类 |
| 能力缝（capability seam） | Service Definition / Provider / Consumer 三角色；本篇 `ctx.officeToPdf` 与 `ctx.workspaceChanges` 各是一条 | **本版新增 2 条** |
| 引擎代（generation） | `OfficeToPdfGeneration`，provider 生命周期品牌；引擎/字体/配置替换即换代，旧缓存全部失效 | **本版新增** |
| 内容身份（content identity） | `OfficeToPdfKey` = `generation:sha256(extension\0bytes)`；消费者不得解析 | **本版新增** |
| 有界准入（bounded admission） | 在**读源字节之前**就用元数据占位：队列长度、读者数、源字节预留、并发转换数四道闸 | **本版新增** |
| 整文件副本（whole-file capture） | git 快照覆盖不到的路径，用 turn 内首末两次整文件拷贝做比较；按字节 SHA-1 命名，同内容只存一份 | **本版新增** |
| gitlink / submodule | 嵌套仓库与子模块在快照里记为 gitlink，不下降其内部改动 | **本版新增** |
| 平台引擎选择 | 从 kit 的 `optionalDependencies` 里选一个：声明了 `libreoffice-kit-${platform}-${arch}` 就必须用原生包，否则用共享 WASM 包；**缺失即安装不完整，绝不回退到 WASM** | **本版新增策略** |

> 术语纠偏：任务简报里提到的"Office **三引擎**"在 0.1.7-rc.1 源码与文档中**没有对应表述**。实际模型是"**每平台一个引擎**"（native 或 Node WASM 二选一）。可核实的引擎包身份共 5 个 + 1 个 API 入口，见 §本版本变更要点 的"引擎与运行时"条。

---

## 包结构

### 两个新包组的组成

`packages/deliverables/` 磁盘实测 33 个文件、`packages/document/` 18 个文件（`Get-ChildItem -Recurse -File` 计数），与 `git diff --shortstat` 的新增数完全一致，说明两个包组是**纯新增**：

```powershell
git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/deliverables   # 33 files changed, 3559 insertions(+)
git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/document       # 18 files changed, 2188 insertions(+)
```

| 包 | 职责 | ctx key / 出口 | 本版改动规模 |
|---|---|---|---|
| `deliverables/tool-present` | 通过 `present` 工具把已存在的文件声明为最终交付物 | 注册到 `ctx.tools` | 9 files, +685 |
| `deliverables/workspace-changes` | 汇总每个顶层 turn 的改动文件（git 快照 + 整文件副本），并服务每文件的前后比较 | 提供 `ctx.workspaceChanges`；监听 `session/event`；追加 `workspace/changes` | 21 files, +2768 |
| `document/office-to-pdf` | 已授权 Office 字节 → 完整 PDF，内部含队列、缓存与引擎适配 | 提供 `ctx.officeToPdf`；导出 `./remote`、`./typert` | 15 files, +2082 |

两个包组各带一份组 README 三件套（`README.md` / `README.zh.md` / `README.i18n.yaml`），两组共 6 个文件。于是文件数对得上：`33 = 9 (tool-present) + 21 (workspace-changes) + 3 (组 README)`，`18 = 15 (office-to-pdf) + 3 (组 README)`。

### 源文件规模（逐文件实测行数）

`packages/deliverables/tool-present/src/`：

| 文件 | 行数 | 内容 |
|---|---|---|
| `index.ts` | 109 | `name` / `Config` / `inject` / `apply` 函数式插件；`defineTool` 注册 + `tools/result` 事件挂接 |
| `types.ts` | 17 | 纯类型入口：`PresentedFile` + `SessionEventMap` 声明合并，不引入 Host 运行时 |

`packages/deliverables/workspace-changes/src/`：

| 文件 | 行数 | 内容 |
|---|---|---|
| `index.ts` | 165 | 插件装配、Config 校验、git 解析（含 macOS stub 探测）、事件监听、服务提供 |
| `types.ts` | 115 | `WorkspaceChangedFile` / `Summary` / `DiffHunk` / `WorkspaceFileDiff` / `WorkspaceChanges` + 两个声明合并 |
| `recorder.ts` | 404 | `TurnRecorder`：快照、捕获、比较、摘要落位、dispose |
| `git.ts` | 279 | `GitRunner` + `locateGitWorkspace` / `snapshotTree` / `treeBlob` / `blobText` / `diffTrees` / `gitlinkPaths` / `ignoredPaths` |
| `capture.ts` | 112 | `captureFile` / `sameCapture` / `mutationPath`（哪些工具算变更工具） |
| `paths.ts` | 109 | `displayPathOf` / `durablePathOf` / `compareDisplay` / `isTemporaryPath` / `temporaryRoots` / `canonicalPath` |
| `compare.ts` | 66 | `compareText`：`diff` 包的 `structuredPatch`（context 3 + timeout） |
| `numstat.ts` | 52 | `parseNumstat`：解析 `diff-tree --numstat -z` 输出（含异常文件名） |

`packages/document/office-to-pdf/src/`：

| 文件 | 行数 | 内容 |
|---|---|---|
| `index.ts` | 280 | `OfficeToPdf` 类、完整 `Config`（19 个字段）、`convert()`、两个 `@Remote` 方法、`convertBytes`（私有 scratch 目录 + kit converter） |
| `queue.ts` | 233 | `ConversionQueue`：准入、job/reader 模型、摘要共享、LRU 内容缓存与别名表 |
| `types.ts` | 58 | `OfficeExtension` / `Priority` / `Request` / `Result` / `ErrorCode` / `RenderedDocumentBytes` + Remote 错误细节合并 |
| `identity.ts` | 31 | 三个 branded 类型与工厂：`OfficeSourceKey` / `OfficeToPdfGeneration` / `OfficeToPdfKey` |
| `errors.ts` | 15 | `OfficeToPdfError`（分类错误码 + 引擎 cause） |
| `output.ts` | 39 | `readPdf`：有界、可取消地读回生成的 PDF |

### `packages/experimental/` 里有没有 Office 包？

**没有。** 这是任务点里需要明确否证的一项。实测：

```powershell
git ls-tree -d --name-only dsh-v0.1.7-rc.1:packages/experimental
```

20 个包（`agent-team`、`agent-team-profile`、`api-speech-to-text`、`auto-review`、`browser-use-*`、`client-ui-agent-team`、`client-ui-voice-input`、`computer-use-*`、`inspector`、`ptc-runtime-python`、`speech-to-text`、`speech-to-text-sensevoice`、`tool-agent-team`、`voice-input-bundle`、`webworker-packer`、`webworker-runtime`），**没有任何 `office-*` / `libreoffice-*` 包名**。与 0.1.6 相比，experimental 的新增是语音族 5 包 + `agent-team-profile`，Office 不在其中。

> **磁盘与 tag 的一处不一致（已排查）**：磁盘上 `Get-ChildItem -Directory packages/experimental` 返回 **21** 项，比 tag 树多一个 `agent-team-web-profile`。核实结果是**构建残留**而非本版包：该目录下只有 `lib/`（编译产物）、`node_modules/`、`lib/types/*.d.ts`，**没有 `src/`、没有 `package.json`**；`git status --porcelain` 干净、`git check-ignore` 不命中（git 不追踪空跟踪语义的纯产物目录）。它是 0.1.6 中 `agent-team-web-profile` → `agent-team-profile` 改名后遗留的产物目录，正是 `pnpm run clean` 声称要清除的 "safe residue from deleted packages"。**凡本篇声称"磁盘即本版快照"，均以 `git ls-tree`/`git cat-file` 对 tag 树的查询为准**，不依赖目录枚举。

Office 唯一与 experimental 的接触点在 `webworker-runtime` 的**外部包替身**里：

| 文件 | 内容 |
|---|---|
| `packages/experimental/webworker-runtime/src/node/external_packages/libreoffice-kit.ts`（12 行） | `createConverter()` 直接 reject，`code: 'unavailable'`，注释写明 "Office conversion requires a Node Host; the browser preview carries no engine assets" |
| `.../external_packages/replaced-externals.ts` | 把 `'@deepseek-ai/libreoffice-kit'` 列入被替换的外部包 |
| `.../node/builtins.ts:51,93` | `import * as libreofficeKit from './external_packages/libreoffice-kit.ts'` 并注册到替换表 |
| `packages/experimental/webworker-runtime/README.md:58` | 明确记载"浏览器镜像排除 kit 及其引擎依赖，Office preview 报告转换不可用" |

也就是说：浏览器 only 的预览路径**保留 Host provider 可加载**（以便普通 Office 错误呈现），但**不携带任何 Node Worker、原生 helper 或 WASM 转换资源**。

### Office 相关的、不在本篇包范围内的新包

本版同时新增了两个与 Office 直接相关、但归属其他包组的包。它们不在 `packages/deliverables` / `packages/document` 的包范围内，本篇按"相邻能力"处理，**不展开为独立篇章**（若本系列另有 skill 篇应以那篇为准）：

| 包 | 包组 | 本版规模 | 关系 |
|---|---|---|---|
| `packages/skill/skill-office` | `skill`（**本版新增包**） | README 106 行 + `assets/office-{docx,pptx,xlsx}/SKILL.md` + `assets/scripts/check_office.py`(279 行) + `src/index.ts`(97 行) + 4 个测试文件 | Office 创作侧：3 个 bundled skill + 标准库 OOXML 结构检查器 |
| `packages/skill/tool-workspace-dependencies` | `skill`（**本版新增包**） | README 128 行 + `src/index.ts`(277 行) + 429 行测试 | `load_workspace_dependencies` 工具：清单校验、解释器路径、安装与模型查询 |

`packages/skill` 全组本版 32 files, +2697/-50；其新增目录用同一命令复核：

```powershell
$a = git ls-tree -d --name-only dsh-v0.1.6-alpha.1:packages/skill   # skill, skill-badge, skill-filesystem, tool-skill
$b = git ls-tree -d --name-only dsh-v0.1.7-rc.1:packages/skill
Compare-Object $a $b   # => skill-office, tool-workspace-dependencies
```

---

## 关键类型

以下片段全部逐字取自本版磁盘文件（行号已复核），未做改写。

**片段 A：`PresentedFile` 与 `deliverables/presented` 事件**——`packages/deliverables/tool-present/src/types.ts`

```ts
/** A declared filesystem file whose current contents remain at its source path. */
export interface PresentedFile {
  /** Original absolute path or path relative to the Session working directory. */
  path: string
  /** Optional description supplied by the model. */
  description?: string
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /** Declared filesystem files from a successful final present result, including nested calls. */
    'deliverables/presented': { turn: number; callId: ToolCallId; files: PresentedFile[] }
  }
}
```

该文件在本版与 0.1.6 的 `packages/fs/tool-present/src/types.ts` **逐字节相同**（`git diff <0.1.6 路径> <0.1.7 路径>` 输出为空）。所以 `deliverables/presented` 是本版**继承**的持久化根，不是新增——0.1.6 的 `docs/persistence-catalog.md` 已含 `event:deliverables/presented`（digest `13d3d180f977bf78081d487ffa0ecb75857349bcab29a5a3fb48189fca2a6176`），本版 digest 未变。

**片段 B：`WorkspaceChangedFile` / `WorkspaceChangesSummary`**——`packages/deliverables/workspace-changes/src/types.ts:4-40`

```ts
export interface WorkspaceChangedFile {
  path: string
  display: string
  added: number
  deleted: number
  binary?: true
  oversized?: true
}

export interface WorkspaceChangesSummary {
  turn: number
  cwd: string
  files: WorkspaceChangedFile[]
  total: number
  added: number
  deleted: number
  snapshot?: { before: string; after: string }
}
```

`added` / `deleted` 在 `binary` 或 `oversized` 时为 0；`total` / `added` / `deleted` 是**完整统计**（含被 `maxFiles` 截掉的项），而 `files` 只是前 `maxFiles` 项。`display` 是排序键兼标签：工作目录内相对路径、仓库上层用 `../`、home 下用 `~`、其余用绝对路径，且**始终用斜杠**（Windows 上 `path` 保留本机分隔符、`display` 强制 `/`）。

**片段 C：比较结果三态**——`packages/deliverables/workspace-changes/src/types.ts:56-76`

```ts
export type WorkspaceFileDiff =
  | {
    kind: 'text'
    path: string
    display: string
    before: boolean
    after: boolean
    hunks: WorkspaceDiffHunk[]
    coarse: boolean
  }
  | { kind: 'binary'; path: string; display: string }
  | { kind: 'oversized'; path: string; display: string }
```

`coarse: true` 表示行比较超出 `diffTimeoutMs` 后退化为"一份替换全部行的 hunk"。hunk 结构见同文件 42-54 行的 `WorkspaceDiffHunk`（`oldStart` / `oldLines` / `newStart` / `newLines` / `lines`，每行保留 `+` / `-` / 空格前缀）。

**片段 D：`WorkspaceChanges` 服务与事件**——`packages/deliverables/workspace-changes/src/types.ts:78-115`

```ts
export interface WorkspaceChanges {
  summary(sessionId: SessionId, seq: number): WorkspaceChangesSummary | undefined
  diff(sessionId: SessionId, seq: number, index: number, signal: AbortSignal): Promise<WorkspaceFileDiff | undefined>
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'workspace/changes': { turn: number }
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    workspaceChanges: WorkspaceChanges
  }
}
```

`summary` 是**同步**的，`diff` 是异步且可取消的。两者都以 `(sessionId, seq)` 为键——即"哪条事件宣布的"，而不是 turn 号。

**片段 E：Office 转换的请求与结果**——`packages/document/office-to-pdf/src/types.ts:8-51`

```ts
export type OfficeExtension = 'doc' | 'docx' | 'xls' | 'xlsx' | 'ppt' | 'pptx'
export type OfficeToPdfPriority = 'foreground' | 'background'

export interface OfficeToPdfRequest {
  readonly extension: OfficeExtension
  readonly priority: OfficeToPdfPriority
  readonly source: {
    readonly key: OfficeSourceKey
    readonly version: string
    readonly bytes?: number
    read(signal: AbortSignal, maxBytes: number): Promise<{ readonly bytes: Uint8Array; readonly version: string }>
  }
}

export interface OfficeToPdfResult {
  readonly pdf: Uint8Array
  readonly missingFonts: string[]
  readonly cacheKey: OfficeToPdfKey
  readonly generation: OfficeToPdfGeneration
}

export type OfficeToPdfErrorCode =
  | 'input-too-large' | 'output-too-large' | 'invalid-document' | 'unsupported-format'
  | 'invalid-output' | 'timeout' | 'unavailable' | 'failed' | 'busy' | 'source-changed'
```

注意 `read()` 的 JSDoc 明确要求："**不要在排队中的生产请求里捕获已缓冲的输入**"——延迟读是准入设计的一部分，不是可选优化。`bytes` 省略时预留 provider 的整个输入上限。

**片段 F：Remote 错误映射与 PDF 结果**——`packages/document/office-to-pdf/src/types.ts:47-57`

```ts
export interface RenderedDocumentBytes extends WorkspaceFileBytes {
  readonly missingFonts: string[]
  readonly generation: OfficeToPdfGeneration
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    'document-render/failed': { readonly reason: OfficeToPdfErrorCode }
  }
}
```

**片段 G：三个 branded 身份**——`packages/document/office-to-pdf/src/identity.ts`

`OfficeSourceKey`（调用方编码的已授权定位符）、`OfficeToPdfGeneration`（provider 生命周期，`randomUUID()` 生成）、`OfficeToPdfKey`（`generation:sha256` 内容身份）。官方子系统文档对该类型的约束是"neither opaque value is parsed by consumers"。

**片段 H：`OfficeToPdf` 的两个 Remote 方法**——`packages/document/office-to-pdf/src/index.ts:159-175`（同时是官方子系统文档 `office-to-pdf.md` 的生成源）

```ts
@Remote
async render(
  workspaceFileScope: WorkspaceFileScope, path: string, priority: OfficeToPdfPriority, signal: AbortSignal,
): Promise<RenderedDocumentBytes>

@Remote('generation')
getGeneration(signal: AbortSignal): OfficeToPdfGeneration { signal.throwIfAborted(); return this.generation }
```

`render` 是**二进制 Remote**：`RenderedDocumentBytes` 继承 `WorkspaceFileBytes`，PDF 经 Typert 二进制结果投影 + Connection multipart 分帧到达客户端，客户端拿到一个 `ArrayBuffer` 支撑的 `Uint8Array`（无 base64、无二次解码缓冲）。

**片段 I：`Config` 默认值**——`packages/document/office-to-pdf/src/index.ts:73-93`（官方 `docs/config-catalog.md` 的 `@deepseek-ai/dsh-office-to-pdf` 段落即由该类生成）

| 字段 | 默认值 | 含义 |
|---|---|---|
| `maxConcurrentConversions` | `2` | 同时活跃的转换数；排队者仍可取消 |
| `maxQueuedJobs` | `8` | 仅含元数据、等待源准入的 job 上限 |
| `maxReaders` | `32` | 未完成读者上限 |
| `maxSourceBytes` | `104857600`（100 MiB） | 已准入源读 + 转换的预留字节总量 |
| `maxBackgroundConversions` | `1` | 并发后台 job；`0` 拒绝投机工作 |
| `maxCachedEntries` | `8` | 保留的内容寻址 PDF 数 |
| `maxCachedBytes` | `134217728`（128 MiB） | 保留 PDF 字节上限 |
| `maxSourceEntries` | `64` | 源版本别名上限 |
| `timeoutMs` | `60000` | 转换截止时间（**不含 DSH 排队时间**） |
| `maxInputBytes` | `52428800`（50 MiB） | 源字节上限 |
| `maxOutputBytes` | `104857600`（100 MiB） | 完整 PDF 上限 |
| `maxImageResolution` | `192` | 导出光栅图 DPI（覆盖 kit 的 144） |
| `maxArchiveEntries` | `10000` | OOXML ZIP 条目上限 |
| `maxUncompressedBytes` | `262144000`（250 MiB） | OOXML 声明的解压总字节上限 |
| `fontDirectories` | 未设置 | 绝对字体根；省略用 kit 平台默认 |
| `fontFallbacks` | 未设置 | 有序字族偏好组；每组至少 2 个含非空白字符的名字 |
| `maxFontFiles` | `20000` | 每个 converter 索引的物理字体文件上限 |
| `maxFontFileBytes` | `268435456`（256 MiB） | 单个字体文件上限 |
| `maxLoadedFontBytes` | `536870912`（512 MiB） | 一次转换加载的原始字体字节上限 |

两处构造期硬校验（`index.ts:117-118`）：`fontDirectories` 必须是绝对路径；`maxSourceBytes` 必须 ≥ `maxInputBytes`。违反即插件加载失败（fail loud）。

**片段 J：`workspace-changes` 的 `Config`**——`packages/deliverables/workspace-changes/src/index.ts:50-56`

| 字段 | 默认值 | 含义 |
|---|---|---|
| `timeoutMs` | `30000` | 单条 git 命令超时；超过即放弃该 turn 的记录 |
| `outputMaxBytes` | `8388608`（8 MiB） | 单条 git 命令保留的输出字节；更大的 diff 列表放弃记录 |
| `maxFiles` | `500` | 单份摘要携带的文件上限；`total` 仍报完整数 |
| `maxFileBytes` | `2097152`（2 MiB） | 可被整文件捕获、或可从快照读取用于比较的字节上限 |
| `diffTimeoutMs` | `100` | 行比较超时；超时退化为整文件替换 |

五个字段全部在 `apply()` 入口做 `Number.isSafeInteger(value) && value >= 1` 校验（`index.ts:95-100`），非法即抛错。`tool-present` 同构：`maxFiles` 默认 `8`，非正整数即抛错（`tool-present/src/index.ts:34-36`）。

---

## 数据流

### 流 1：`present` 的声明 → 事件 → 客户端

```
模型调用 present({ files: [{ path, description? }] })
  │
  ├─ exec.agent 必须存在，否则抛 'present requires an agent Session'
  ├─ ctx.sessionProjections.stateOf(session, 'turnBoundary') 必须存在且 openTurnStartSeq !== null
  ├─ 1 <= files.length <= config.maxFiles（默认 8）
  ├─ session.header.cwd 必须存在
  ├─ 每个路径：ctx.fs.lstat → 非普通文件则拒绝
  │            ctx.fs.resolve → ctx.fs.stat → undefined 则抛 FsError('FS_NOT_FOUND')
  ├─ exec.signal.throwIfAborted()
  └─ pending.set(exec, { session, turn: boundary.lastTurn, files })   // 只挂起，不落盘
       │
       ▼
  tools/result 事件（成功且 !result.isError）
  └─ session.append('deliverables/presented', { turn, callId, files })
```

关键语义（可由源码逐条复核）：

- **只记路径，不读内容**：`present` 全程只用 `lstat` / `stat` / `resolve`，从不 `read`。官方 README 明确"records paths and optional descriptions without copying file contents"。
- **挂起表是 `WeakMap<ToolExecution, …>`**（`index.ts:37`），键是执行对象本身。因此**阻塞结果不发布**（`result.isError` 直接 return），**外层程序失败不撤销已完成的嵌套声明**——因为嵌套调用的 `tools/result` 已经先到达。
- **同作用域同名替身不能代发**："Each plugin instance records only calls it executed"，即另一个实例的 `pending` 表里没有该 `ToolExecution`。
- **事件不携带 SessionId**。客户端侧因此规定：继承历史里的相对路径按**当前查看的 Session** 工作目录解析（`tool-present` README 与 `2026-09-08-present-workspace-source-files.md` 都记载了这条）。
- **required-on-read**：`deliverables/presented` 不标 `ignorable`，不认识它的旧读者会拒绝整个日志——静默丢失交付声明会改变重建/分叉历史，因此不接受。

### 流 2：`workspace-changes` 的快照 / 捕获 / 服务

```
session/event = turn/start
  └─ eligible(session)? origin !== 'subagent' && (delegationDepth ?? 0) === 0
       └─ 是 → TurnRecorder.start(turn)，把 baseline 任务入队：
            rev-parse --show-toplevel --absolute-git-dir --git-path objects
            → 在 Session 私有临时对象目录里 add --all --ignore-errors（临时 index 由仓库 index 播种）
            → write-tree 得到 before tree id

tools/pre-execute（waterfall）
  ├─ recorder.capture(exec.name, exec.arguments)   // 记录 mutation 路径
  └─ await recorder.settled()                      // 等 baseline 队列排空后才 next()
       └─ 之后 write / edit / 可变的 str_replace_editor 才真正执行

agent/turn-stopping（serial）
  └─ recorder.stopping(turn)：第二次快照 + diff-tree -r -M --numstat
       + check-ignore 分类被捕获路径 + 未覆盖路径的第二次拷贝与行比较
       + session.append('workspace/changes', { turn })
       + 把 summary 与每个列出文件的两个内容源（快照树中的路径 or 磁盘副本）挂在事件 seq 下

turn/end
  └─ 仅当上次记录之后又有工具结果落定 → 再次记录（覆盖 abort / fail / steer 的 turn）

客户端读：
  workspaceChanges.summary(sessionId, seq) → WorkspaceChangesSummary | undefined
  workspaceChanges.diff(sessionId, seq, index, signal)
       ├─ 快照侧：ls-tree -l 定位并取大小，cat-file blob 在 maxFileBytes 内读取
       ├─ 副本侧：从磁盘读
       └─ 两侧走同一个 compareText(…, diffTimeoutMs)
```

若干必须点名的行为，全部可由 README / note / 源码复核：

| 行为 | 事实 | 证据 |
|---|---|---|
| 私有对象目录 | 命令带 `GIT_OBJECT_DIRECTORY=<Session 临时目录>` 与 `GIT_ALTERNATE_OBJECT_DIRECTORIES=<仓库 objects>`；仓库自己的 index / objects / work tree / refs 不变 | `git.ts:139`、`git.ts:162-168` |
| 环境擦洗 | `GIT_CONFIG_COUNT=0`（因为凭证擦洗会删掉 `GIT_CONFIG_KEY_n`）、`GIT_TERMINAL_PROMPT=0`、`GIT_OPTIONAL_LOCKS=0`、`LC_ALL=C` | `git.ts:68-69` |
| 用户未提交改动不进摘要 | 快照用临时 index **由仓库 index 播种**，所以基线包含用户既有的已暂存/未暂存改动 | note `2026-09-11-turn-changed-files-card.md` |
| 嵌套仓库不下降 | `ls-files --stage` 找 gitlink，其内部改动不出现在摘要 | `git.ts:251-268` |
| 无仓库 / 无 git | 不拍快照，只列 file-tool 编辑，工作目录即 workspace；**shell 编辑缺失** | `index.ts:119-129`、README §Known Limitations |
| macOS 特例 | `/usr/bin/git` 只剩 Xcode stub 时视为不可用（会弹安装器），探测 `xcode-select -p` | `index.ts:71-85` |
| 临时目录排除 | `/tmp` 与平台临时目录下的路径被排除，除非位于工作目录内 | `paths.ts:72`、README |
| 末行换行差异 | 只有末行换行不同 → 比较视为未变；但 git 仍会计该行 | README §Use this package |
| 生命期 | 摘要 / 快照树 / 副本只活在当前 Host 进程的该 Session 内，`session/disposed` 与插件处置时清空并删目录（`index.ts:104-113,152`） | README §Known Limitations 第 1 条 |

`session/event`、`session/disposed`、`agent/turn-stopping`、`tools/pre-execute` 四个挂接点与官方生成的 `docs/event-producer-consumer.md` 完全一致（该文件把 `workspace-changes` 列为这四个事件的接收方）。

### 流 3：`officeToPdf.convert()`（in-process）

```
调用方提交 OfficeToPdfRequest（已授权 key/version + 可选 bytes + 延迟 read）
  │
  ├─ disposed? → OfficeToPdfError('unavailable')
  ├─ source.bytes > maxInputBytes? → 'input-too-large'
  ├─ 别名表命中已就绪 PDF？ → 提升 LRU 位置，返回 copy()（独立 pdf 缓冲 + 独立 missingFonts 数组）
  ├─ readers >= (background ? maxReaders - 1 : maxReaders)? → 'busy'
  ├─ background && maxBackgroundConversions === 0? → 'busy'
  ├─ 队列满（>= maxQueuedJobs）且请求是前台 → 逐出队首后台 job 腾位；否则 'busy'
  ├─ 建立 / 复用 job（若 jobs 队列已满则排队；前台读者会把 job 提升为前台）
  └─ drain() 逐格启动：源字节预留满足 + 后台配额满足 + 队列中无前台等待
       │
       ▼
  execute(job)：
    input = await source.read(signal, reserved)        // 准入之后才读
    input.version !== request.version → 'source-changed'
    input.bytes.byteLength > reserved → 'input-too-large'
    digest = sha256(extension \0 bytes)；key = `${generation}:${digest}`
    命中 ready → finish；命中在跑的同 digest job → 合并读者与源
    否则 convert()（kit converter 写私有临时目录 → render → readPdf）
    retain(result)（entry/byte 双限 LRU）→ finish（写别名表，按 maxSourceEntries 修剪）
```

要点：

- **读源之前就完整准入**。未知大小按 `maxInputBytes` 预留；已授权 stat 大小按该大小预留。读到第 `maxBytes + 1` 字节（溢出哨兵）即 `input-too-large`。
- **缓存身份是内容摘要 + 引擎代 + 扩展名**，不是路径。所以两个不同已授权路径只要字节一致就共享转换（`queue.spec.ts` 有专门用例）。别名表（source→key）是按 `key, version, extension` 序列化后的源定位符，用来在**授权后**避免重复读取已知内容。
- **取消隔离**：读者各自独立取消；只有**最后一个**读者离开或 provider 处置时，才 abort 共享 job。取消释放读者名额，但**活跃容量要等到真实读/转换清理落定才归还**。
- **返回给调用方的字节是独立副本**（`copy()` 做 `Uint8Array.from` 与数组浅拷贝），provider 处置后仍然有效。
- **前台/后台调度**：`foreground` 为请求式预览/QA，`background` 为投机预热。前台等待时后台不入场；队列中最后一个前台读者离开会让被提升的后台 job 降回后台优先级并允许立即开工；前台准入可逐出排队中的投机 job；后台并发数为 0 时，投机读者在**入队/加入运行中 job 之前**即被拒绝，但已完成的别名命中仍可用。
- **临时目录**：`mkdtemp(join(tmpdir(), 'dsh-office-to-pdf-'))`，输入 `source.<ext>` 以 `flag: 'wx', mode: 0o600` 写入，输出 `converted.pdf` 用 `readPdf(outputPath, maxOutputBytes, signal)` 读回，`finally` 里递归删除。

### 流 4：`officeToPdf.render()`（Remote）

```
客户端 → officeToPdf.render(workspaceFileScope, path, priority, signal)
  ├─ 扩展名白名单：doc/docx/xls/xlsx/ppt/pptx，否则 'unsupported-format'
  ├─ ctx.get('workspaceFiles') 与 ctx.get('fs') 必须存在，否则 'unavailable'
  ├─ files.readBytes(scope, path, { range: { offset: 0, length: 1 } }, signal)   // 访问探针
  ├─ source = files.stat(scope, path, signal)
  ├─ assertUnchanged(探针) → absolutePath 或 version 变了即 'source-changed'
  ├─ convert({ extension, priority, source: { key, version, bytes?, read } }, signal)
  │    └─ read 内部：fs.resolve → fs.stat → assertUnchanged → fs.readBytes(target, …, maxBytes)
  │         FS_TOO_LARGE → 复核 version 后抛 'input-too-large'
  │         读完后再 files.stat 复核 version
  └─ 成功：返回 { absolutePath, version, offset: 0, eof: true, bytes, data, missingFonts, generation }
       │
       ▼
  Typert 二进制结果投影 → Connection multipart attachment
       └─ 客户端还原为 ArrayBuffer 支撑的 Uint8Array

失败语义：
  调用方取消 → RemoteError('gateway/cancelled')
  OfficeToPdfError → RemoteError('document-render/failed', { reason: code })   // 不带引擎诊断
  其它 → 原样抛出
```

`api/remotes` 挂载生成描述符的方式已核实：`packages/api/remotes/src/client/index.ts:8` 导入 `@deepseek-ai/dsh-office-to-pdf/remote`，`:180` 加入 Remote 列表，`:43` 重新导出类型；`package.json:99` 声明依赖。`render` 的**每次**预览读都会在查缓存前重核渲染代、源授权与版本；连接重置与插件处置会取消请求并清空缓存字节。

---

## 测试覆盖

### 文件与规模

| 包 | 测试文件 | 行数 |
|---|---|---|
| `tool-present` | `tests/present.spec.ts` | 195 |
| | `tests/built-errors.e2e.ts` | 58 |
| `workspace-changes` | `tests/plugin.spec.ts` | 531 |
| | `tests/git.spec.ts` | 245 |
| | `tests/support.ts` | 84 |
| | `tests/loader-composition.spec.ts` | 82 |
| | `tests/paths.spec.ts` | 70 |
| | `tests/capture.spec.ts` | 66 |
| | `tests/compare.spec.ts` | 42 |
| | `tests/numstat.spec.ts` | 35 |
| `office-to-pdf` | `tests/queue.spec.ts` | 562 |
| | `tests/provider.spec.ts` | 275 |
| | `tests/remote.spec.ts` | 215 |
| | `tests/output.spec.ts` | 64 |

### 断言覆盖的主题（从 describe/it 标题实测提取）

`workspace-changes` 的 `plugin.spec.ts` 分三段 describe：`workspace-changes in a repository`（L55）、`without a repository`（L330）、`without git`（L481）。`git.spec.ts` 覆盖 `GitRunner`、快照与 diff、仓库边界情形、`treeBlob`/`blobText`、`TurnRecorder`。`loader-composition.spec.ts` 是**真 Loader 组合**测试（`describe('real Loader composition')`），符合 `packages/AGENTS.md` 对"产品可见插件必须有非单元的真组合测试"的要求。

`office-to-pdf` 的 `queue.spec.ts` 是本篇最大的单个测试（562 行），用例标题直接对应队列语义：源元数据先于读取共享 / 内容跨路径共享 / 前台加入提升排队预热且不重复读源 / 为前台逐出排队投机并限定元数据队列 / 禁用的预热在**读源之前**被拒 / 预留前台容量同时限制并发预热 / 取消的引擎工作真正落定前保留预留容量 / 限定共享读者并在取消后保留其他读者 / 摘要共享读者在原始源读者离开后仍存活 / 拒绝源版本变化与超限读且不转换不保留 / 未知 stat 大小预留输入上限 / LRU 与别名上限独立 / 失败与超预算 PDF 不保留 / 逐出 LRU PDF 的全部别名 / 扩展名与引擎代分离内容身份 / 最后一个读者名额留给前台 / 已就绪 PDF 在读者名额占满时仍可服务 / 排队前台阻塞取消后启动后台 / 降级预热计入后台并发 / 处置与调用方取消分类独立。`provider.spec.ts` 覆盖 kit 字体默认、配置限额透传 + converter 复用 + scratch 清理、超限输入在分配 converter 前被拒、kit 工厂失败后重试初始化、取消排队者不影响他人转换、活跃 converter 上限与续跑、处置期间 join 初始化、相对字体目录与源容量校验、converter 处置失败聚合上报。`remote.spec.ts` 覆盖授权失败不启动转换、未知源大小保持缺省、源元数据仍可读但内容访问被拒时拒绝缓存 PDF、检查读访问期间源被替换、扩展名前置拒绝、取消与迟到读、卸载时取消并 join、渲染代暴露与 busy 前置拒绝、排队源增长分类为 changed 且不增加读预留、身份未变时的尺寸失败分类。

### e2e / 组合 / 快照

| 层次 | 文件 | 内容 |
|---|---|---|
| Loader 组合 | `packages/bundle/web-app/tests/document-preview.spec.ts`（133 行，本版新增） | Office 转换服务与共享 Document Preview 入口的装配 |
| 转换 e2e | `packages/bundle/web-app/tests/document-conversion.e2e.ts`（76 行，本版新增，含 fixture `document-conversion.docx` 869 B） | 真转换烟测（前台请求） |
| 浏览器场景 | `apps/web/tests/document-preview.e2e.ts` | multipart attachment + PDF Worker 的组装验证 |
| 会话快照 | `snapshots/web/changed-files-turn` | 回放 `workspace/changes` 记录事件，其中含一个被仓库忽略的新建文件 |
| 会话快照 | `snapshots/web/present-svg` | `present` 的 SVG 交付场景：文件、交付事件、卡片 |
| 技能 e2e | `packages/skill/skill-office/tests/xlsx-validation.e2e.ts`（236 行）、`check_office_test.py`（278 行） | OOXML 结构检查器 |

### 测试计数：本机不可复现（显式声明）

官方持久化变更记录给出过一次实测数字：

> `pnpm exec vitest run packages/deliverables/workspace-changes packages/client/ui-deliverables`: **165 tests passed**；`snapshots/web/changed-files-turn` replays the recorded event through the Web profile.
> —— `docs/persistence-changes/2026-09-14-workspace-changes-event.md:43`

**本文未能在本机复现该数字。** 实测过程与失败原因：

1. `pnpm exec vitest run packages/deliverables packages/document/office-to-pdf` → `pnpm` 触发依赖状态检查并尝试重装，因无 TTY 报 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` 退出，**未执行任何测试**。为不破坏工作区，未设置 `CI=true` 强制重装。
2. 直接调用 `node_modules/.bin/vitest run packages/deliverables packages/document/office-to-pdf` → 12 个测试文件里 5 个通过、7 个失败：`Cannot find package 'chokidar' imported from packages/fs/fs-local/src/index.ts`，另有 `recorder.ts` 的导入解析失败。结论是**该检出的 `node_modules` 不完整**，测试环境不可用。

因此：本篇所有"测试通过数"只能引用官方记录并标注来源；`165 tests passed` 这个数字**未经本文独立验证**。用例标题与文件行数来自磁盘实测，可直接复核。

---

## 与上下游的关系

### 上游（本版两个包组依赖的能力）

| 上游 | `tool-present` | `workspace-changes` | `office-to-pdf` |
|---|---|---|---|
| `core/tools`（`ctx.tools`） | ✅ 注册 `present`，用 `defineTool` / `ToolExecution` | ✅（`tools/pre-execute` 挂接） | — |
| `fs/fs`（`ctx.fs`） | ✅ `lstat` / `resolve` / `stat` | — | ✅（Remote 路径读源） |
| `session/session-projection` | ✅ `turnBoundary` 投影取 openTurnStartSeq / lastTurn | — | — |
| `core/session`（`ctx.session`） | ✅ `session.append` | ✅ 同上（追加 `workspace/changes`） | — |
| `core/agent` | ✅ `exec.agent.session` | ✅ `agent/turn-stopping` | — |
| `subprocess/subprocess` | — | ✅ `resolveExecutable('git')` / `spawn` | — |
| `api/workspace-files` | — | — | ✅ `WorkspaceFileScope` / `WorkspaceFileStat` / `readBytes` / `stat` |
| `typert/typert-protocol` | — | — | ✅ `Remote` / `RemoteError` / `TypertRemoteService` |
| `util/brand` | — | — | ✅ 三个 branded 身份 |
| 外部 npm | `schemastery` | `schemastery`、`diff@^9.0.0` | `@deepseek-ai/libreoffice-kit@^0.1.0`、`schemastery`、`zod@^4.4.3` |

`docs/module-graph.md` 给出的依赖边与本表一致：`tool-present` → `agent` / `fs` / `llm` / `session` / `session-projection` / `tools`；`workspace-changes` → `agent` / `session` / `subprocess` / `tools`；`office-to-pdf` 无同仓库依赖（仅 `cordis` peer）。

### 下游（谁在消费）

| 下游 | 消费什么 | 本版规模 |
|---|---|---|
| `packages/client/ui-deliverables` | 交付卡片、改动文件卡、turn review tab、源文件开启路由 | 45 files, +3027/-698（含新增 `ChangedFiles.tsx`、`FileDiff.tsx`、`ReviewTab.tsx`、`changes.ts`、`review-store.ts`、`host-read-store.ts`，删除 `ProducedFiles.tsx/.module.css`） |
| `packages/client/ui-sidebar-documentpreview` | Office preview：扩展名选择、PDF 复用、缺字体提示 | 155 files, +8045/-862 |
| `packages/bundle/web-app` | 挂载 `office-to-pdf`、`workspace-changes`、`ui-deliverables`、`tool-present`（预设内） | 14 files, +1018/-136（`packages/bundle` 全组 41 files, +1289/-344） |
| `packages/api/remotes` | 挂载 `officeToPdf` 的生成 Remote 描述符 | — |
| `apps/desktop-host` | `@deepseek-ai/libreoffice-kit@^0.1.0` 依赖 | — |
| `packages/skill/skill-office` | 反向引用 `present`（交付段落） | 新增包 |

Web bundle 的具体挂载点（`packages/bundle/web-app/cordis.patch.yml` 实测）：

```yaml
    - id: office-to-pdf
      name: '@deepseek-ai/dsh-office-to-pdf'

    - id: workspace-changes
      name: '@deepseek-ai/dsh-workspace-changes'
```

`tool-present` 不在 bundle 的 cordis.patch.yml 里，而在预设补丁中（`git grep tool-present` 命中的是 `presets/cordis.patch.yml`、`presets/ptc.patch.yml`、`presets/standard.patch.yml`），与 `tool-present` README 的"`standard`、`ptc`、`cordis` 预设挂载本插件"一致。`workspace-changes` 的 README 则写明"**只有 shipped Web bundle 挂载本插件**"，因此 headless / SDK / ACP 日志不含该事件。

预设的三处行号（0.1.6 的 `packages/preset/agent-presets/presets/{cordis,ptc,standard}/agent.cordis.yml` 亦有）说明 `present` 的挂载位置在本版未变。

### 与 `docs/subsystems/attachment.md`、`session-reference.md` 的关系（负结论）

任务要求覆盖这两篇中与交付物/文档相关的部分。**实测结论是：没有相关内容。**

```powershell
Select-String -Path docs/subsystems/attachment.md -Pattern 'present|deliverab|Office|document'
Select-String -Path docs/subsystems/session-reference.md -Pattern 'present|deliverab|workspace/changes|Office'
```

- `attachment.md` 的命中只有 3 处，全部是 "Present only when normalization reduced the image"（字段存在性描述）与生成段落里的 "paired document paths" 之类的**子串假阳性**，与 `present` 工具、deliverables 无任何关系。attachment 子系统管的是模型请求里的图像身份与元数据（`AttachmentId` / `AttachmentStore`），与"交付给用户的文件"是两条不同的轴。
- `session-reference.md` 的命中只有 "latest Session title when present" 与 "presentation titles" 两处，同样是与 `present` 工具无关的子串。该子系统管的是跨 Session 引用（`SessionReference` / `SessionTarget` / retain/release），不涉及交付物。

也就是说，`deliverables` 子系统文档里那句"the files the model declared through the `present` tool … and the files the turn changed"构成了交付物概念的**唯一权威定义点**，没有散落到 attachment 或 session-reference。真正相关的是另一篇：`docs/persistence-changes/2026-09-14-workspace-changes-event.md`（持久化契约）与 `docs/persistence-catalog.md` 的两个 log-only 根。

### 客户端路由的横向约束

`deliverables` 的浏览器侧路由受本版另一项决定约束：`2026-09-14-web-document-relative-app-routes.md` 规定"特性包自己的路由（open-in-app、**deliverables**、session-log export、uploads、markdown media）通过各自的 `*_ROUTE` 常量遵循同一文档相对规则"。即交付卡的开启路由是**相对文档**的（`api/...`），而服务端路由键仍是绝对路径名。这条把交付物的客户端实现与 Web 壳的挂载方式绑在了一起，改动交付路由时必须同时看该 note。

### 与相邻 Office 能力的边界

| 能力 | 归属 | 边界 |
|---|---|---|
| Office → PDF 转换 | 本篇 `packages/document/office-to-pdf` | 只做转换；不搜索系统 LibreOffice、不在运行时下载引擎、不做持久 PDF 缓存、不做面向模型的渲染 |
| Office 本地预览 UI | 第 10 篇（`packages/client/ui-sidebar-documentpreview`） | 扩展名选择、PDF 复用、缺字体提示；每次预览读都重核渲染代/授权/版本 |
| Office 创作（docx/pptx/xlsx 指令 + 结构检查） | `packages/skill/skill-office`（相邻新包） | 提供指令与 Python 标准库检查器，不安装解释器、不判定渲染保真 |
| Office 渲染 CLI（选页/选区渲染、转换、重算） | `@deepseek-ai/libreoffice-kit` 的 `lib/cli.js` + 相邻 skill 的 `cli` 配置 | kit 仓库拥有；`skill-office` 只暴露绝对路径并注入 `Installed LibreOffice Kit` 段 |
| 浏览器 only 预览 | `packages/experimental/webworker-runtime` | 用不可用替身替换 kit 入口，排除引擎依赖树 |
| 交付声明 | `packages/deliverables/tool-present` | 只记路径；不保留交付版本（持久化版本与 copy-on-write 明确 deferred） |
| 改动卡片 | `packages/deliverables/workspace-changes` + `client/ui-deliverables` | 宿主只服务、客户端只渲染；两个事件都不进模型 |

---

## 本版本变更要点（0.1.6-alpha.1 → 0.1.7-rc.1）

### 总览

```powershell
git diff --stat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/deliverables packages/document packages/experimental
# 294 files changed, 15538 insertions(+), 2734 deletions(-)
#   其中 packages/deliverables 33 files / +3559（纯新增）
#        packages/document     18 files / +2188（纯新增）
#        packages/experimental 243 files / 其余改动（语音族新增 + agent-team 重构；无 Office 包）
```

提交数（含 release / build 提交）：

| 路径 | 提交数（含 merge） | 提交数（`--no-merges`） |
|---|---|---|
| `packages/deliverables` | 22 | **20** |
| `packages/document` | 23 | **22** |

两个计数都不大，且其中 4–5 条是 release / build 噪声（`release(dsh): …`、`build: …`），真正承载语义的是下面逐条列出的少数几条。

### 变更 1：`deliverables` 与 `document` 成为新顶层包组

包组索引同步更新了两处，且**精确程度不同**（`git diff dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- AGENTS.md packages/README.md` 实测）：

| 文件 | 新增行 | 内容 |
|---|---|---|
| `AGENTS.md:28` | 1 行 | `deliverables/         turn deliverables`（**只加了 `deliverables/`，没有 `document/`**） |
| `packages/README.md:47` | 1 行 | `\| [`deliverables/`](deliverables/README.md) \| Turn deliverables: explicit file delivery and recorded workspace changes \|` |
| `packages/README.md:59` | 1 行 | `\| [`document/`](document/README.md) \| Shared Host Office-to-PDF conversion \|` |

即 `AGENTS.md` 的仓库布局清单**漏掉了 `document/`**——这不是本文的推断，而是磁盘现状：在该文件里搜 `document/` 无任何命中。分组提交 `f800ea46e5` 的 stat 里也确实只有 `AGENTS.md \| 1 +`。

### 变更 2（**关键纠偏**）：`present` 工具不是本版新增，而是原样搬迁 + 描述重写

0.1.6 时该包位于 `packages/fs/tool-present/`：

```powershell
git ls-tree -r --name-only dsh-v0.1.6-alpha.1:packages | Select-String 'tool-present'
# fs/tool-present/{README.md,README.zh.md,README.i18n.yaml,package.json,src/index.ts,src/types.ts,
#                  tests/built-errors.e2e.ts,tests/present.spec.ts,tsconfig.json}
```

搬迁提交 `f800ea46e5 refactor(deliverables): group tool-present and workspace-changes under packages/deliverables` 的 rename 明细显示这是**零内容改动**的移动：

```
.../{fs => deliverables}/tool-present/README.md    |   0
.../{fs => deliverables}/tool-present/README.zh.md |   0
.../{fs => deliverables}/tool-present/package.json |   2 +-
.../{fs => deliverables}/tool-present/src/index.ts |   0
.../{fs => deliverables}/tool-present/src/types.ts |   0
```

`package.json` 的 2 行改动只是 `repository.directory` 字段。全区间 diff 实测：

```powershell
git diff --stat dsh-v0.1.6-alpha.1:packages/fs/tool-present dsh-v0.1.7-rc.1:packages/deliverables/tool-present
# 7 files changed, 34 insertions(+), 33 deletions(-)
```

其中 `src/index.ts` 唯一的语义改动是 tool description 全文重写（+5/-4）：

| | 0.1.6（旧） | 0.1.7-rc.1（新） |
|---|---|---|
| 定位 | "Declare existing files … **you must call present** after writing it and before your final response, including files created through Bash or code execution" | "Declare **selected** existing files … Use present when the user needs a separate file deliverable, **especially Office documents, spreadsheets, and slide decks**" |
| 触发条件 | 强制：用户要的输出就必须调用 | 收敛：能用最终回复呈现就不必调用；"creating or editing a file does not by itself require present" |
| 数量指引 | 无 | "Usually select the 1-2 most important deliverables … **at most 4 files in a single present call**" |
| 移除句 | "Mentioning its path in your reply does not replace this call." | 已删除 |

归因（`git log -S` 实测）：`28fbe7433d fix: guide selective file presentation through prompts` 引入 "especially Office documents"；`223385954d fix: recommend at most four files per presentation` 引入 "at most 4 files"。另有 `63c1e04b93 fix: keep file access available across presentation clients` 触及同包。

注意：description 里的 "at most 4 files" 是**给模型的建议**，与配置字段 `maxFiles`（默认 **8**，硬校验）是两回事。两者并存并非笔误——一个是提示，一个是拒绝阈值。

同时 `deliverables/presented` 事件 digest 在本版**未变**（本版与 0.1.6 的 `docs/persistence-catalog.md` 都是 `13d3d180…`），`src/types.ts` 逐字节相同。因此本版**没有**为 `present` 引入新的持久化变更记录。

### 变更 3：`workspace-changes` 包与 `workspace/changes` 事件是真正的新增

```powershell
git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/deliverables/workspace-changes
# 21 files changed, 2768 insertions(+)

git show dsh-v0.1.6-alpha.1:docs/persistence-catalog.md | Select-String 'workspace/changes'
# （无输出）
```

持久化契约记录：`docs/persistence-changes/2026-09-14-workspace-changes-event.md`

```yaml
schemaVersion: 1
id: 2026-09-14-workspace-changes-event
baseline: false
changes:
  - root: "event:workspace/changes"
    previous: null
    after: "e308ccf867a5398e316e0af8cb6ce238a8d33a63b9b384c8250a686786285f72"
    decision: same-version
```

同目录 `.schema.json` 记录的根属性为 `"surface": false`（log-only）。该文档的 Compatibility 段明确：**这是同一 Session format 版本内的新根**，旧日志合法，而早于它的读者会拒绝携带该事件的日志（因为 required-on-read）。本版 `SESSION_FORMAT_VERSION` 从 3 变为 4（`packages/core/session/src/types.ts`，实测两侧分别为 `3` 与 `4`），但该升级是由 `2026-09-16-session-format-v4` 记录的另一项变更驱动，**不是**由 `workspace/changes` 驱动——后者的 decision 明确写作 `same-version`。这是一对容易被误连的事实，务必分清。

`workspace-changes` 的提交序列（`--no-merges`，去掉 release/build 噪声后）勾勒出这条能力是如何逐块长成的：

| 提交 | 主题 |
|---|---|
| `f800ea46e5` | 把 `tool-present`（及当时的 workspace-changes）归入 `packages/deliverables` |
| `fa8938d202` | 简化路径 helper、hunk 分类与卡片状态 |
| `722008aeeb` | 补上包组门禁要求的子系统页 |
| `dde4dccbd2` | 让改动摘要**按 Session 生命期留在 Host** |
| `c48f4203d9` | 支持**无 git 仓库**时的 file-tool 编辑摘要 |
| `da6e3f9edf` | 追加行只算一次新增 |
| `c8bc10440b` | 被服务摘要的评审轮次修订 |
| `a79b97ecca` | 从卡片比较每个改动文件（引入 `diff` 路由） |
| `2440937459` | oversized 成对列出、限定捕获读、经符号链接祖先解析路径 |
| `974d0271c0` | 通过静态门禁与 Windows 测试 |
| `4233590de6` | 忽略被擦洗的环境 Git 配置 |

### 变更 4：交付面从"卡片"演进到"turn review tab"

`2026-09-11-turn-changed-files-card.md`（**本版新增**）建立了改动卡片；`2026-09-15-changed-file-diff-preview.md`（**本版新增**，标题 "Turn review tab"）在四天后把它推进为可看 diff 的评审页。两条 note 构成一组"四天内的两次决定"，且第二次明确改写第一次的若干实现选择：

| 维度 | 09-11 卡片决定 | 09-15 评审页决定 |
|---|---|---|
| 行点击行为 | 打开文件**当前内容**（Sidebar 或桌面应用） | 打开该 turn 的 `changes-review` tab，落在该文件 |
| 未覆盖路径的比较来源 | 起初是"文件工具持久化的 hunk 求和" | 改为**整文件副本**的比较（明确对标 Codex 的 `apply_patch` turn diff tracker） |
| 计数语义 | 求和（重复编辑会重复计数） | 首末两次拷贝之差（重复编辑只算一次） |
| 新增类型 | — | `WorkspaceChangedFile.oversized`、`WorkspaceChanges.diff`、`WorkspaceDiffHunk`、`WorkspaceFileDiff` |
| 新增边界 | — | `maxFileBytes`（拷贝与快照 blob 读的上限）、`diffTimeoutMs`（100 ms，超时退化为整文件替换并标 `coarse`） |
| 日志 | 只带 turn 号 | 不变（"The Session log is unchanged"） |

09-15 note 自己写明："The persisted hunks and the argument-derived hunks are no longer read by the recorder."——即这条演进**删除了**一个实现路径，而不是叠加。

被服务内容的暴露面也在这次变更里被显式接受并记录进两份 README：比较路由会把列出文件的**完整文本**发给浏览器，包括被忽略文件、工作目录之上的仓库文件、工作区之外的文件；而摘要路由只给路径与计数。官方给出的理由是"用户授权了那些编辑"。

### 变更 5：官方新增两篇子系统文档

```powershell
git diff --name-status --diff-filter=A dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- docs
```

与本篇相关的全新增条目：

| 文件 | 说明 |
|---|---|
| `docs/subsystems/deliverables.md`（178 行） | `PresentedFile` / `WorkspaceChangedFile` / `WorkspaceChangesSummary` / `WorkspaceDiffHunk` / `WorkspaceFileDiff` / `WorkspaceChanges` 的类型等价粘贴 + cordis-surface 生成段 |
| `docs/subsystems/office-to-pdf.md`（87 行） | Ownership 表、请求/结果语义、preview reads、引擎选择与限额 + cordis-surface 生成段 |
| `docs/subsystems/deliverables.zh.md`、`office-to-pdf.zh.md`、各自的 `.i18n.yaml` | 中英配对与 sidecar |
| `docs/persistence-changes/2026-09-14-workspace-changes-event.{md,zh.md,i18n.yaml,schema.json}` | 持久化契约四件套 |

```powershell
git ls-tree --name-only dsh-v0.1.6-alpha.1:docs/subsystems | Select-String 'deliver|office'
# （无输出）→ 0.1.6 不存在这两篇
```

0.1.6 的 `docs/subsystems/` 索引里同样没有这两行；本版 `docs/subsystems/README.md:18` 与 `:33` 分别登记了它们。

### 变更 6：Office 侧在本版区间内"先立后废"了一次

这是本篇最容易被漏掉的史实。三条描述 WASM-first 设计的 note **全部在本版区间内新建、且全部在本版区间内被 archived**（`git diff --diff-filter=A` 全部命中，`git cat-file -e dsh-v0.1.6-alpha.1:<path>` 全部 exit 128）：

| 归档 note | Archived 日期 | 描述的旧设计 |
|---|---|---|
| `.agents/notes/archived/architecture/2026-09-10-local-office-preview.md` | 2026-09-11 | `packages/document/document-render`（Service Definition）+ `document-render-libreoffice-wasm`（WASM provider）+ `document-render-auto`（按 `wasm.artifactDirectory` 挂载）+ 客户端消费者 |
| `.agents/notes/archived/architecture/2026-09-11-wasm-preview-font-and-image-budgets.md` | 2026-09-11 | provider 启动时建字体元数据快照、每 Worker 结构化克隆、完整请求键记忆化、`maxImageResolution` 默认 192 DPI |
| `.agents/notes/archived/process/2026-09-11-independent-libreoffice-package.md` | 2026-09-11 | `native/libreoffice-wasm` 资产包 + `libreoffice-wasm-release.yml` 显式触发的发布流水线 |

这些 note 引用的路径在本版**已不存在**：`packages/document/` 下只有 `office-to-pdf`；`native/` 下只有 `system`（`git ls-tree -d --name-only dsh-v0.1.7-rc.1:native` → `system`）。三篇的三件套哈希留在 `.agents/notes/archived/manifest.json` 里（如 `architecture/2026-09-10-local-office-preview.md: sha256:754cfb4d…`），属冻结历史，**不得当作当前权威**。

取而代之的四篇 implemented note 构成本版 Office 的现行权威：

| note | 日期 | 决定 |
|---|---|---|
| `2026-09-11-node-office-kit.md` | 09-11 | 转换交给独立发布的 `@deepseek-ai/libreoffice-kit` Node API；DSH 只拥有 Session 文件授权、转换并发、私有 scratch、输出上限、Remote 传输 |
| `2026-09-14-independent-libreoffice-kit.md` | 09-14 | `deepseek-harness/libreoffice-kit` 仓库拥有 API / Worker / 字体处理 / 引擎选择 / 构建配方 / 补丁 / 测试 / 发布；kit 版本独立于 Harness，**从 `0.0.1` 起**；API 无 Cordis 依赖 |
| `2026-09-15-platform-office-engines.md` | 09-15 | 一台平台一个引擎，从 kit 的 `optionalDependencies` 选；声明了原生包就必须装，**缺失即安装不完整，绝不选 WASM** |
| `2026-09-15-bounded-office-conversion.md` | 09-15 | 有界共享转换：准入先于读源、内容摘要分享、引擎代失效、LRU + 别名、前台优先 |
| `2026-09-17-shared-office-runtime.md` | 09-17 | Desktop 与 SDK 共用 `tool-workspace-dependencies` + `scripts/primary-runtime/prepare.ts`；SDK profile 从 carrier 默认打开查询与 Office skill，`DSH_PRIMARY_RUNTIME` 覆盖（含空串退出） |

注意 09-14 note 写"starting at `0.0.1`"，而本版实际钉住的依赖是 `^0.1.0`（`packages/document/office-to-pdf/package.json`、`apps/desktop-host/package.json` 均为此值），且 `pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude` 逐条列出 `@0.1.0`。note 描述的是"发布序列的起点"，README/清单描述的是"本版钉住的版本"，两者不矛盾但不可互相替代。

### 变更 7：引擎与运行时（含"三引擎"纠偏）

**实际模型是 native / WASM 二选一，不是三引擎。** `scripts/gen-third-party-notices.ts:56-63` 是权威清单：

```ts
const LIBREOFFICE_KIT_PACKAGE = '@deepseek-ai/libreoffice-kit'
const LIBREOFFICE_PACKAGES = new Set([
  LIBREOFFICE_KIT_PACKAGE,
  '@deepseek-ai/libreoffice-kit-wasm',
  '@deepseek-ai/libreoffice-kit-darwin-arm64',
  '@deepseek-ai/libreoffice-kit-darwin-x64',
  '@deepseek-ai/libreoffice-kit-win32-arm64',
  '@deepseek-ai/libreoffice-kit-win32-x64',
])
```

`pnpm-workspace.yaml:56-61` 对这 6 个包各自列出 `@0.1.0`。选择规则（`2026-09-15-platform-office-engines.md`）：

| 目标 | 选择 |
|---|---|
| 声明了 `@deepseek-ai/libreoffice-kit-${platform}-${arch}` | **必须**用该原生包；缺失即安装不完整，**绝不退到 WASM** |
| 未声明原生包的目标 | 用共享 WASM 包 |

note 的 Consequences 段明确：pinned kit 声明了 macOS/Windows ARM64 与 x64 原生包，因此**当前 Linux 发行版选 WASM**；kit 增加 Linux 原生目标不需要改 Harness 的选择规则。

对应地：

- `packages/document/office-to-pdf/package.json` 只依赖 kit API，**没有**直接 WASM 依赖（"The provider has no direct WASM dependency"）；
- 应用打包按目标取 kit `optionalDependencies` 里声明的原生包，或 Node WASM；
- 无效引擎元数据、缺必需资产、转换错误**一律拒绝，不切换引擎**（`index.ts:63` 的 "reject the request instead of switching engines" 与 `origin/index.ts` 兜底 `switch` 里的 `default:` → `'failed'`）；
- 许可证门禁只接受上述确切包名在 MPL-2.0，且要求保留 kit 的对应 LibreOffice 源码 pin、补丁、构建说明与许可证通告。

### 变更 8：客户端二进制传输（PDF 走 multipart）

本版把 PDF 响应从"编码传输"改为**二进制 Remote 结果**：

| 提交 | 内容 |
|---|---|
| `ecf6acfb15 feat(api): support binary fields in Remote results` | Typert/Remote 支持二进制字段 |
| `d0ddf939f0 refactor(office): transfer PDFs as multipart bytes (#4830)` | PDF 走 multipart attachment |
| `880c186146 refactor(document): consolidate Office preview remotes` | 收敛 Office 预览 Remote |
| `5e25475857 fix(office): use bundled LibreOffice Kit 0.1.0 CLI across deployments (#4902)` | 跨部署统一使用捆绑 kit 的 CLI |

客户端侧结果：拿到**一个** `ArrayBuffer` 支撑的 `Uint8Array`，没有 base64 字符串、没有二次解码缓冲。代价也被记录：cache 字节上限**不约束**瞬态传输或 viewer 内存。

### 变更 9：`office-to-pdf` 的四步收敛（提交次序）

`packages/document` 的 23 个提交里，去重后的语义步骤是：

```
96e68ded13 feat(document): decouple shared Office conversion from preview
fd3cdf539b refactor(document): name Office PDF conversion explicitly
fcf9f4cfa2 fix(document): select Office engines from declared native targets
d3ed04defa refactor(document): consolidate Office conversion into office-to-pdf
bab800bf74 docs(office-to-pdf): link the bounded conversion decision
682011adfa docs(office-to-pdf): clarify conversion and engine package ownership
```

`a193b51c96` / `a69639a200` / `11669006e6` / `773d743bce` / `e30a391326` 是同一组主题在另一分支/合并前向路径上的**重复出现**（相同标题）。本文只据"标题 + 日期"陈述这一观察，**未核实**其是否为 stack 合并前向产生的重复提交对象——若需要精确定性，应比对 `git patch-id` 或 `--cherry-mark`。

无论重复与否，语义链条清楚：**解耦**（把共享转换从预览里拆出来）→ **正名**（`document-render` → `office-to-pdf`）→ **引擎选择**（按 kit 声明选原生/WASM）→ **收敛**（合并进单一 `office-to-pdf` 包）→ **文档**（链接有界转换决定、澄清引擎包归属）。

### 变更 10：未落地的部分——后台调度的去留

`2026-09-17-defer-office-background-scheduling.md` 状态为 **proposed**（`git diff --diff-filter=A` 确认为本版新增），**尚未实施**。其主张：

- 移除 `OfficeToPdfPriority`、请求里的 `priority`、配置项 `maxBackgroundConversions`；
- 移除读者/job 优先级字段、提升与降级、投机逐出、前台读者预留、队列后台计数；
- 移除客户端 cache 的优先级透传，并同步改 Remote 签名；
- **保留** provider、可复用 converter、延迟授权读、其余资源限额、源版本检查、内容共享、有界结果缓存、独立读者取消、等待真实工作落定的处置。

其证据链值得记录为方法论样本：仓库搜索 `officeToPdf` / `OfficeToPdfRequest` / `OfficeToPdfPriority` / `maxBackgroundConversions` **找不到生产级后台请求**；`packages/client/ui-sidebar-documentpreview/src/client/office/index.ts` 调用 cache 时不传 priority（默认 foreground）；`packages/bundle/web-app/tests/document-conversion.e2e.ts` 也只提交前台请求；只有队列、Remote、客户端 cache 测试里出现后台请求。但 note 同时指出未合并的预热 PR #4064 是具体消费者，因此**验收标准第一条**是"先解决该 PR 的调度需求再实施"，并明确"仅在 master 中缺席不足以作为推进证据"。

`2026-09-15-bounded-office-conversion.md` 的 Related 段写明了二者的权威关系："this note remains the authority for the implemented behavior"。所以本篇对该调度机制的描述以现状（含 priority）为准。

### 变更 11：相邻包的连带变化（skill / runtime）

| 事项 | 事实 | 证据 |
|---|---|---|
| `skill-office` 新增 | 3 个 bundled skill（`office-docx` / `office-pptx` / `office-xlsx`）+ 共享 `check_office.py`（279 行，仅标准库）+ `src/index.ts`（97 行）；配置 `assetRoot` / `node` / `cli` | `2026-09-15-bundled-office-skills.md`；包 README；`packages/skill` 目录 diff |
| skill CLI 注入 | 加载后的技能追加 `Installed LibreOffice Kit` 段与绝对 `libreofficeKit.node` / `libreofficeKit.cli`；`cli: false` 显式关闭；捆绑 CLI 失败就上报，**不回退系统可执行文件** | `skill-office/README.md` §Use this package |
| `tool-workspace-dependencies` 新增 | 拥有清单校验、解释器路径、安装与模型查询；留在 skill 组；Desktop 导入并保留 copy-on-first-use 安装 | `2026-09-17-shared-office-runtime.md` |
| 共享构建入口 | `scripts/primary-runtime/prepare.ts` 拥有下载锁、解压与原生烟测；Desktop 提供输出路径与发布版本，要求 Node.js 与 pnpm | 同上（路径已核实存在） |
| SDK carrier 开关 | SDK profile 从 carrier 默认启用查询与 Office skill；`DSH_PRIMARY_RUNTIME` 覆盖，含空串退出；common base 与 `sdk-minimal` **不**隐式启用 Office | 同上 |
| 浏览器替身 | `webworker-runtime` 用 `unavailable` 替身替换 kit 入口 | `libreoffice-kit.ts`、README:58 |

### 变更 12：与 Session 引用/附件相关的旁支（明确排除项）

任务列出的三个 bug-fix note 里有两个其实与本篇主题无关，写清这一点比强行关联更有价值：

| note | 是否与本篇相关 | 理由 |
|---|---|---|
| `2026-09-15-trajectory-attachment-presentation.md` | **否** | 讲的是 Trajectory 检查器里图像/普通文件的**呈现**（ledger 计数、Summary/Preview 列表、Raw 折叠），归属 `ui-trajectory` / `ui-attachment` / `ui-conversation`；与 `present` 工具、交付物无关 |
| `2026-09-16-present-delayed-windows-installer.md` | **否**（标题假阳性） | "Present delayed Windows installer" 的 "Present" 是**动词**，讲的是原生安装器欢迎页在准备资源后**呈现**时的窗口次序（置前但不抢焦点、闪烁任务栏），与 `present` 工具毫无关系 |
| `2026-09-19-declared-session-attachment-carriers.md` | **弱相关** | 讲 Session 附件授权与 ZIP 导出的**内容字段选择**必须按内建事件类型，而非扫描常见字段名——防止未知 `ignorable` 事件借字段名授权图片读。它与交付物的唯一交点是"`deliverables/presented` 只带路径、不带附件引用"，因此导出 ZIP 里只有声明而无文件内容。官方 `present` README 的 Known Limitations 也写明这一点 |
| `2026-09-15-client-session-references.md` | **弱相关** | 讲客户端 Session 引用的所有权与代际（`SessionReference` / retain / release / ready）。它是客户端取 Session 身份的底座，交付卡路由与 Session 生命周期受其约束，但内容不涉及交付物 |

### 变更 13：文档、生成物与门禁的同步面

本版这两个包组触碰的生成物/门禁文件（由分组提交 stat 与各包 README 的 Related documentation 段共同确认）：

| 生成物 / 门禁 | 变化 |
|---|---|
| `docs/module-graph.md` | 新增 `group_deliverables` 子图（`tool-present`、`workspace-changes`）、`office-to-pdf` 行与三条依赖边 |
| `docs/capability-seams.md` | 新增 `ctx.officeToPdf` 与 `ctx.workspaceChanges` 两条 seam 行；`skill-office` 加入 `ctx.skills` 的提供者列表 |
| `docs/persistence-catalog.md` | `deliverables/presented` 的 Source 路径从 `packages/fs/tool-present/...` 改为 `packages/deliverables/tool-present/src/types.ts:15`；新增 `workspace/changes` 根与 `deliverables/*` / `workspace/*` 分组 |
| `docs/persistence-schema.json` | 新增 `event:workspace/changes` 与相关类型节点 |
| `docs/tool-catalog.md` | `present` 行（L25）更新为 `@deepseek-ai/dsh-tool-present`，生产者列写 `tool/call`、`deliverables/presented after a successful final result`、`tool/result` |
| `docs/config-catalog.md` | 新增 `@deepseek-ai/dsh-office-to-pdf` 段（19 字段全文粘贴） |
| `docs/event-producer-consumer.md` | `workspace-changes` 加入 `agent/turn-stopping`(serial)、`session/disposed`、`session/event`、`tools/pre-execute`(waterfall) 四个接收方列 |
| `AGENTS.md` | 仓库布局段 +1 行（仅 `deliverables/`） |
| `packages/README.md` | 包组索引 +2 行（`deliverables/` 与 `document/`） |
| `packages/skill/README.md` | 新增两个 skill 组包的行 |
| `.agents/notes/archived/manifest.json` | 新增 3 组 Office 归档 note 的三件套哈希 |
| `scripts/gen-third-party-notices.ts` | `LIBREOFFICE_PACKAGES` 6 个身份（本版新增该项） |
| `pnpm-workspace.yaml` | `minimumReleaseAgeExclude` 6 条 `@0.1.0` |

子系统页的生成机制也值得一提：`docs/subsystems/deliverables.md:140` 与 `office-to-pdf.md:44` 之间的段落由 `scripts/gen-cordis-catalog.ts` 生成，并由 `pnpm run verify-cordis-catalog` 在 doc-sync 中验证新鲜度。这意味着**改 `ctx.officeToPdf` 或 `ctx.workspaceChanges` 的签名而不同步跑生成器，会直接把文档门禁打红**。

### 变更 14：本篇明确标注"未核实"的项

| 项 | 状态与原因 |
|---|---|
| 测试通过数（如"165 tests passed"） | **未独立验证**。本检出 `node_modules` 不完整（缺 `chokidar`），`pnpm exec` 因无 TTY 拒绝装依赖。数字来自 `docs/persistence-changes/2026-09-14-workspace-changes-event.md:43` |
| `a193b51c96` 等重复标题提交是否为 stack 前向合并的重复对象 | **未核实**。仅观察到标题与主题重复；判定需 `git patch-id` / `--cherry-mark` |
| kit `0.0.1`（note）与 `0.1.0`（依赖）之间的完整发布历史 | **未核实**。kit 在独立仓库 `deepseek-harness/libreoffice-kit`，不在本检出内，无法读取其 tag 序列 |
| 原生/WASM 的实际转换保真度差异 | **未核实且官方亦未声称**。`2026-09-11-node-office-kit.md` 明确"a successful local architecture does not prove the full matrix"，并要求在每个目标上独立资格认证 |
| `packages/document/office-to-pdf` 在 Linux/WASM 下的真实运行结果 | **未核实**。需要 kit 的 WASM 资产与真实转换环境；本机为 Windows x64，且引擎资产未在此检出内 |
| 「Office 三引擎」这一提法 | **经核实为不成立**。实际是 native / WASM 二选一 + 5 个引擎包身份（见变更 7） |
| `2026-09-11-wasm-preview-font-and-image-budgets.md` 位于 `implemented/architecture/`（任务给出的路径） | **不成立**。该 note 实际在 `archived/architecture/`，且为本版区间内新增后冻结 |

---

## 附录：本版提交索引

### `packages/deliverables`（20 个提交，`--no-merges`，含 release/build）

```
a60af51e80 release(dsh): 0.1.7-rc.1
10ea83bcc3 release(dsh): 0.1.7-alpha.2
4e6028a604 build: use tilde ranges for vendor and native workspaces
37372101b5 build: pin internal DSH workspace dependencies
112ce776ac release(dsh): 0.1.7-alpha.1
223385954d fix: recommend at most four files per presentation
63c1e04b93 fix: keep file access available across presentation clients
28fbe7433d fix: guide selective file presentation through prompts
6b1808f432 release(dsh): 0.1.6-alpha.2
4233590de6 fix(workspace-changes): ignore scrubbed ambient Git config
974d0271c0 fix(deliverables): satisfy the static gates and Windows tests
2440937459 fix(workspace-changes): list oversized pairs, bound capture reads, and resolve paths through symlinked ancestors
a79b97ecca feat(deliverables): compare each changed file from the card
c8bc10440b fix(workspace-changes): review round on the served summaries
da6e3f9edf fix(workspace-changes): count an appended line as one addition
c48f4203d9 feat(workspace-changes): summarize file-tool edits outside a git repository
dde4dccbd2 feat(workspace-changes): keep change summaries on the Host for the Session's lifetime
722008aeeb docs(deliverables): add the subsystem page the package-group gate requires
fa8938d202 refactor(deliverables): simplify path helpers, hunk classification, and card status
f800ea46e5 refactor(deliverables): group tool-present and workspace-changes under packages/deliverables
```

### `packages/document`（22 个提交，`--no-merges`）

```
a60af51e80 release(dsh): 0.1.7-rc.1
5e25475857 fix(office): use bundled LibreOffice Kit 0.1.0 CLI across deployments (#4902)
10ea83bcc3 release(dsh): 0.1.7-alpha.2
4e6028a604 build: use tilde ranges for vendor and native workspaces
37372101b5 build: pin internal DSH workspace dependencies
112ce776ac release(dsh): 0.1.7-alpha.1
d0ddf939f0 refactor(office): transfer PDFs as multipart bytes (#4830)
ecf6acfb15 feat(api): support binary fields in Remote results
6b1808f432 release(dsh): 0.1.6-alpha.2
880c186146 refactor(document): consolidate Office preview remotes
e30a391326 docs(office-to-pdf): link the bounded conversion decision
773d743bce docs(office-to-pdf): clarify conversion and engine package ownership
11669006e6 refactor(document): consolidate Office conversion into office-to-pdf
a69639a200 fix(document): select Office engines from declared native targets
a193b51c96 refactor(document): name Office PDF conversion explicitly
9d2a3bf2b7 feat(document): decouple shared Office conversion from preview
bab800bf74 docs(office-to-pdf): link the bounded conversion decision
682011adfa docs(office-to-pdf): clarify conversion and engine package ownership
d3ed04defa refactor(document): consolidate Office conversion into office-to-pdf
fcf9f4cfa2 fix(document): select Office engines from declared native targets
fd3cdf539b refactor(document): name Office PDF conversion explicitly
96e68ded13 feat(document): decouple shared Office conversion from preview
```

### 相关 note 索引（本版区间新增，`--diff-filter=A` 核实）

```
.agents/notes/implemented/feature/2026-09-11-turn-changed-files-card.md
.agents/notes/implemented/feature/2026-09-15-changed-file-diff-preview.md          # 标题为 "Turn review tab"
.agents/notes/implemented/feature/2026-09-15-bundled-office-skills.md
.agents/notes/implemented/feature/2026-09-16-browser-excel-preview.md
.agents/notes/implemented/architecture/2026-09-11-node-office-kit.md
.agents/notes/implemented/architecture/2026-09-14-independent-libreoffice-kit.md
.agents/notes/implemented/architecture/2026-09-14-web-document-relative-app-routes.md
.agents/notes/implemented/architecture/2026-09-15-bounded-office-conversion.md
.agents/notes/implemented/architecture/2026-09-15-client-session-references.md
.agents/notes/implemented/architecture/2026-09-15-platform-office-engines.md
.agents/notes/implemented/architecture/2026-09-17-shared-office-runtime.md
.agents/notes/implemented/bug-fix/2026-09-15-trajectory-attachment-presentation.md
.agents/notes/implemented/bug-fix/2026-09-16-present-delayed-windows-installer.md
.agents/notes/implemented/bug-fix/2026-09-19-declared-session-attachment-carriers.md
.agents/notes/proposed/simplification/2026-09-17-defer-office-background-scheduling.md
.agents/notes/archived/architecture/2026-09-10-local-office-preview.md
.agents/notes/archived/architecture/2026-09-11-wasm-preview-font-and-image-budgets.md
.agents/notes/archived/process/2026-09-11-independent-libreoffice-package.md
```

（每篇均另有 `.zh.md` 与 `.i18n.yaml` 同名兄弟文件。）

### 相关持久化与子系统文档

```
docs/subsystems/deliverables.md                     （新增）
docs/subsystems/office-to-pdf.md                    （新增）
docs/persistence-changes/2026-09-14-workspace-changes-event.md + .schema.json   （新增）
```

### 复核命令清单（本文所有数字的来源）

```powershell
# 包组新增
git ls-tree -d --name-only dsh-v0.1.6-alpha.1:packages   # 52
git ls-tree -d --name-only dsh-v0.1.7-rc.1:packages      # 54
git cat-file -e dsh-v0.1.6-alpha.1:packages/deliverables/tool-present/package.json   # exit 1

# 规模
git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/deliverables        # 33 files, +3559
git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/document            # 18 files, +2188
git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/deliverables/tool-present       # 9 files, +685
git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/deliverables/workspace-changes  # 21 files, +2768
git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/document/office-to-pdf           # 15 files, +2082

# 搬迁（不是新增）
git ls-tree -r --name-only dsh-v0.1.6-alpha.1:packages | Select-String 'tool-present'
git diff --stat dsh-v0.1.6-alpha.1:packages/fs/tool-present dsh-v0.1.7-rc.1:packages/deliverables/tool-present
git show --stat --format="" f800ea46e5 | Select-String '=>'

# 事件新旧
git show dsh-v0.1.6-alpha.1:docs/persistence-catalog.md | Select-String 'workspace/changes'   # 空
git show dsh-v0.1.6-alpha.1:docs/persistence-catalog.md | Select-String 'deliverables/presented'  # 有

# 归档史
git diff --name-status --diff-filter=A dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- .agents/notes
git ls-tree -r --name-only dsh-v0.1.7-rc.1:.agents/notes | Select-String 'office|libreoffice|wasm-preview'

# 引用的旧路径已不存在
git ls-tree -d --name-only dsh-v0.1.7-rc.1:native                       # 仅 system
git ls-tree -d --name-only dsh-v0.1.7-rc.1:packages/document           # 仅 office-to-pdf

# 引擎清单
Select-String -Path scripts/gen-third-party-notices.ts -Pattern 'LIBREOFFICE'
Select-String -Path pnpm-workspace.yaml -Pattern 'libreoffice'
```

---

*本文所有路径、行数、digest、提交主题均取自 `E:\test\rewrite-agently\deepseek-harness`（已 checkout 到 `dsh-v0.1.7-rc.1` = `46a7f68b0922371ce7144b668b90e377d8e799f4`，工作区干净）。凡未能直接复核者，均在 §变更 14 显式标注为「未核实」并说明原因。*
