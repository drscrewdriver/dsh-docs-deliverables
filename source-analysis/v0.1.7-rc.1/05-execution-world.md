# 【第 05 篇】packages/fs · sandbox · ptc-runtime · spill · jobs：执行世界与隔离

> **版本**：dsh-v0.1.7-rc.1（`46a7f68b09`），对比上版 dsh-v0.1.6-alpha.1（`0a15e36e7f`）
> 难度：🟡 进阶（建议先读 `docs/architecture.md` 与 `docs/subsystems/sandbox.md`）
> 包范围：`deepseek-harness/packages/` 下 6 个包组 / 21 个包：`fs/`（7）、`sandbox/`（4）、`ptc-runtime/`（2）、`spill/`（3）、`jobs/`（3）、`attachment/`（2）
> 上游文档：`docs/subsystems/filesystem.md`、`sandbox.md`、`spill.md`、`jobs.md`、`workspace.md`、`ptc-runtime.md`、`attachment.md`
> 相关笔记：`.agents/notes/implemented/feature/2026-09-19-windows-acl-mandatory-integrity-confinement.md`、`2026-09-16-sandbox-same-mode.md`、`2026-08-26-human-job-kill.md`、`2026-08-26-shell-execute-projection-and-jobs-at-start.md`、`2026-09-01-workflow-run-in-background.md`、`.agents/notes/implemented/architecture/2026-09-01-jobs-absorb-activity-record.md`、`2026-09-03-jobs-seam-consolidation.md`、`2026-09-17-workspace-file-binary-transfer.md`、`.agents/notes/implemented/bug-fix/2026-09-21-multimodal-tool-result-retention.md`、`.agents/notes/proposed/simplification/2026-09-19-omit-fs-payload-invariant.md`

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
  - [C1. Windows ACL：强制完整性 + 环境删除 DENY（本版沙箱最重要增强）](#c1-windows-acl强制完整性--环境删除-deny本版沙箱最重要增强)
  - [C2. sandbox 同模式（same-mode）不再需要审批](#c2-sandbox-同模式same-mode不再需要审批)
  - [C3. jobs：从「多缝叠加」收敛为「一圈、一投影、一流」](#c3-jobs从多缝叠加收敛为一圈一投影一流)
  - [C4. human job kill：不再混淆「取消」与「送达」](#c4-human-job-kill不再混淆取消与送达)
  - [C5. shell execute 投影与「启动即注册 job」](#c5-shell-execute-投影与启动即注册-job)
  - [C6. workflow 获得 run_in_background](#c6-workflow-获得-run_in_background)
  - [C7. spill-policy：字节预算 → 多模态 token 预算](#c7-spill-policy字节预算--多模态-token-预算)
  - [C8. fs.watch：fs 缝新增观察能力](#c8-fswatchfs-缝新增观察能力)
  - [C9. attachment-local：sharp 惰性化](#c9-attachment-localsharp-惰性化)
  - [C10. ptc-runtime：仅保留 ELECTRON_RUN_AS_NODE 到 bootstrap](#c10-ptc-runtime仅保留-electron_run_as_node-到-bootstrap)
  - [C11. workspace file binary transfer](#c11-workspace-file-binary-transfer)
  - [C12. omit fs payload invariant：本版仍是 proposed](#c12-omit-fs-payload-invariant本版仍是-proposed)
  - [C13. tool-present 迁出 packages/fs](#c13-tool-present-迁出-packagesfs)
  - [C14. 仓库级依赖范围与文档同步](#c14-仓库级依赖范围与文档同步)
- [附录：本版提交索引](#附录本版提交索引)

---

## 引言

本文覆盖 DSH 的**执行世界（execution world）**：文件读写的唯一入口（`packages/fs`）、子进程如何被关进笼子（`packages/sandbox`）、程序化工具调用（PTC）进程如何启动（`packages/ptc-runtime`）、超长工具输出如何落到文件而不撑爆上下文（`packages/spill`）、后台作业如何被注册/读取/停止（`packages/jobs`），以及二进制附件如何被持久化与归一化（`packages/attachment`）。

本版在这个范围内的量化基线（`git diff --stat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/fs packages/sandbox packages/ptc-runtime packages/spill packages/jobs packages/attachment` 实测）：

```
 136 files changed, 6584 insertions(+), 2838 deletions(-)
```

同命令对应的 `git log --oneline` 为 **142 条提交**（其中 `--no-merges` 过滤后 **74 条**）。

这 136 个变更文件的构成（按路径实测分类）：

| 文件类别 | 数量 |
|---|---|
| `*/package.json` | 22 |
| `*/tsconfig.json` | 5 |
| `*/README.i18n.yaml` | 15 |
| `*/README.md` 或 `*/README.zh.md` | 30 |
| `*/src/*.ts` | 34 |
| `*/tests/*` | 29 |
| `verify/abi-probe.cpp` | 1 |

**本版这个范围里有三件事改变了行为契约，其余是加固、收敛与文档同步**：

1. **Windows 沙箱多了一层强制完整性隔离**（C1）。这是本版沙箱最重要的平台增强：`WRITE_RESTRICTED` 令牌的「限制 SID 交集」只覆盖对象**自身**安全描述符的访问检查，Windows 还能从**父目录**的 `FILE_DELETE_CHILD` 权利授权删除，而这个权利没有任何限制 SID 需要联署。结果是 `cmd /c del` 能在两种受限模式下降级到工作区之外的删除（issue #4581）。本版用一个 DENY ACE + 一个 Low 完整性标签 + 令牌完整性级别下移来关闭它。
2. **jobs 缝完成了一次大规模收敛**（C3–C6）。`JobStart` → `JobSpec`、`readOutput`/`record`/`readRecord`/`updateDetail` 全部消失，三条监听器家族合成一条 `events.subscribe`，登记表不再保留 `reported` 位；同时新增**人工 job kill**与 **job 从启动第一秒就存在**，`workflow` 也拿到了 `run_in_background`。
3. **spill-policy 从字节预算改为共享的多模态 token 预算**（C7）。配置字段 `maxInlineBytes` → `maxInlineTokens`，随包默认值从 50 000 字节变成 12 500 估算 token，且图片不再让策略整体跳过。

PTC 执行缝（`packages/ptc-runtime`）在本版只有一处实质行为变更（C10），`docs/subsystems/ptc-runtime.md` **在区间内未被修改**。命令执行缝（`packages/shell`、`packages/subprocess`、`packages/terminal`、`packages/ssh`）归第 03 篇，本文只在与 jobs/沙箱交界处引用其结论，不复述实现。office/document 的转换运行时归第 14 篇。

---

## 概述

这 21 个包回答的是同一个问题的六个侧面：**「模型发起的副作用，凭什么可以被信任地执行？」**

| 包组 | 一句话职责 | 本版是否改变对外契约 |
|---|---|---|
| `fs/` | 唯一文件访问能力缝（`ctx.fs`）+ 模型可见文件工具 + 观察策略插件 | **是**（新增 `watch()`；`write` 结果 meta 新增 `operation`） |
| `sandbox/` | 进程/文件副作用的关押策略与服务（`ctx.sandbox`） | **是**（same-mode 不再审批；Windows rung 增加完整性层） |
| `ptc-runtime/` | `ctx.ptcRuntime` 抽象缝 + 沙箱化 Node 实现 | 否（仅 Electron 选择器保留范围） |
| `spill/` | 全文溢出存储（`ctx.spillStore`）+ 结果保留策略插件 | **是**（配置字段与预算语义都换） |
| `jobs/` | 后台作业注册表（`ctx.jobs`）+ 模型可见 `job_*` 工具 | **是**（缝大规模收敛 + 新增 `remove`） |
| `attachment/` | 不可变附件存储缝 + 本地实现 | 否（仅 `sharp` 加载时机） |

「执行世界」这个词在 DSH 里是一个**具体的、可枚举的**概念，而不是修辞：它由 `packages/fs/fs/src/index.ts` 里的 `FileSystem` 抽象方法（在**哪个世界里**解析路径、读写字节）和 `packages/sandbox` 里的 runner 选择（在**哪个笼子里** spawn 子进程）共同定义。本版把这两端各推进了一步——`fs` 多了「观察」这个动作，`sandbox` 的 Windows 端多了「完整性」这个维度。

---

## 核心概念

| 术语（首次出现附英文） | 含义 | 本版是否受影响 |
|---|---|---|
| 能力缝（capability seam） | Service Definition / Service Provider / Consumer 三角色，缺一不成缝 | 未变；本版 `ctx.jobs` 是收敛样板 |
| 执行世界（execution world） | 一个 provider 解析路径、访问字节、启动子进程的那个世界；`fs-ssh`/`fs-sandbox` 与 `fs-local` 的世界不同 | 未变；`fs.watch` 明确以「provider 自己的执行世界」为界 |
| 强制完整性级别（mandatory integrity level / IL） | Windows 的第五个授权维度：Untrusted/Low/Medium/High/System 五级固定，标签写在对象的 SACL 里，内核在访问检查内部评估 | **本版新增到沙箱语义** |
| 无写升（no-write-up） | `SYSTEM_MANDATORY_LABEL_NO_WRITE_UP`：低完整性主体不得写更高完整性对象 | **本版新增** |
| 限制令牌（restricted token） | `WRITE_RESTRICTED` 令牌：访问检查做两遍，第二遍只带限制 SID 列表 | 未变（新增「再下移完整性级别」） |
| 双列表清单（the two restricting lists） | `workspace-write`（logon SID、Everyone、workspace SID、temp SID）vs `read-only`（logon SID、Everyone） | 未变 |
| 部分强制（partial enforcement） | backend 只治理了模式承诺的一部分；Windows rung 恒为 `partial` | **理由变了**（见 C1） |
| 同模式（same-mode） | 请求的模式等于本调用的生效模式 | **本版新增语义** |
| 输出环（output ring） | 每个 job 一个有界字节环：绝对偏移、头部淘汰、可从任意偏移非消费读取 | **本版新增为缝的组成部分** |
| 拉取源（pull source / `JobOutputSource`） | 由注册表按自己的节奏轮询、把字节泵进环的 `read(fromByte)` 源 | **本版新增** |
| 生产者面（producer face / `JobHandle`） | 交给 `JobSpec.run` 的同步写入面：`append` + `updateProgress` | **本版新增**（取代 `RecordingJob`/`RunningJob`） |
| 送达申领（delivery claim） | 「这个终态已经有一条已提交的、通向模型的送达路径」 | **本版新增概念**（取代 `reported` 位） |
| 保留（retention） | 把超预算的工具结果裁成有序的头/尾两端 + 溢出定位符 | 语义改为**按估算 token 计价、可含图片** |
| 溢出（spill） | 把**完整**文本存到会话作用域文件，模型只看到定位符与取回指引 | 未变（存储层完全未动） |

---

## 包结构

`packages/fs/` 在本版从 **8 个包减到 7 个**（`tool-present` 迁出，见 C13）；其余五个包组的包数在区间内未变。

```powershell
git ls-tree -d --name-only dsh-v0.1.7-rc.1 packages/fs/ packages/sandbox/ packages/ptc-runtime/ packages/spill/ packages/jobs/ packages/attachment/
```

| 包 | 职责 | 本版改动规模（`git diff --stat` 实测） |
|---|---|---|
| `fs/fs` | `FileSystem` 抽象缝、`FsError` 分类、`FsVersion` | `src/index.ts` +16；`tests/service.spec.ts` +8 |
| `fs/fs-local` | 宿主文件系统实现（原子写/编辑、版本守卫） | `src/index.ts` 27 行改动；**新增** `tests/watch.spec.ts`（144 行） |
| `fs/fs-sandbox` | 变更端的沙箱栅栏（`FS_SANDBOX_DENIED`） | 仅 README（3 文件，各 2 行） |
| `fs/fs-observation-policy` | read-before-edit / 版本守卫的 `fs/*` 事件门（无服务 API） | 仅 `package.json`（依赖范围） |
| `fs/tool-fs` | 模型可见 `read`/`read_image`/`write`/`edit` | `src/diff.ts` 6、`src/sandbox.ts` 3、`src/write.ts` 1；`tests/tools.spec.ts` 19 |
| `fs/tool-fs-search` | `glob`/`grep`（打包 ripgrep） | 仅 `tests/tools.spec.ts` 11（测试侧类型） |
| `fs/tool-str-replace-editor` | 独立 `str_replace_editor` | 仅 `package.json`（依赖范围） |
| `sandbox/sandbox` | 沙箱缝：模式、策略、升级（escalation） | `src/escalation.ts` 17；`tests/escalation.spec.ts` 18 |
| `sandbox/sandbox-local` | runner 选择与探测（bwrap/landlock/seatbelt/windows-acl） | `src/index.ts` 19 |
| `sandbox/sandbox-policy` | 逐调用策略解析 | 仅 `package.json`（依赖范围） |
| `sandbox/sandbox-windows-acl` | Windows 受限令牌 rung + runner + DACL/标签原语 | `src/acl.ts` 297、`grant.ts` 89、`ffi.ts` 41、`win32-abi.ts` +33、`token.ts` +20、`index.ts` 19；tests 7 文件 +1291；`verify/abi-probe.cpp` +20 |
| `ptc-runtime/ptc-runtime` | `ctx.ptcRuntime` 抽象缝 | 仅 `package.json` |
| `ptc-runtime/ptc-runtime-node` | 沙箱化 Node PTC 进程实现 | `src/index.ts` 4；`tests/host-failures.spec.ts` 2；README 2 |
| `spill/spill` | `ctx.spillStore`（`saveText`）抽象缝 | 仅 README（4 文件，各 4 行） |
| `spill/spill-local` | 本地私有（0700）溢出后端 | 仅 `package.json` |
| `spill/spill-policy` | 结果保留策略插件（post-execute + dispatch-log 双臂） | `src/index.ts` 307、`notice.ts` 11、**新增** `src/retention.ts`（104 行）；tests 5 文件（3 新增） |
| `jobs/jobs` | `ctx.jobs` 抽象注册表 + 投影词汇 + 归档准入 + invariant | `src/types.ts` 288、`src/index.ts` 186、`src/invariant.ts` 117、**新增** `src/view.ts`（100）、**新增** `src/archive-admission.ts`（48） |
| `jobs/jobs-local` | 进程内实现：环、泵、事件路由 | `src/index.ts` 643、**新增** `src/ring.ts`（113）、`src/pump.ts`（106）、`src/events.ts`（102） |
| `jobs/tool-jobs` | 模型可见 `job_output`/`job_list`/`job_kill` + 完成通知 | `src/index.ts` 186、**新增** `src/render.ts`（84） |
| `attachment/attachment` | 不可变附件存储缝 | 仅 `package.json`（依赖范围） |
| `attachment/attachment-local` | 内容寻址本地存储 + 图像归一化 | `src/image.ts` 5、`normalization.ts` 13、`request-image.ts` 4、**新增** `src/sharp.ts`（7 行）；**新增** `tests/lazy-sharp-failure.spec.ts`（40 行） |

各包组的汇总（`git diff --shortstat` 实测）：

| 包组 | 文件 | 插入 | 删除 |
|---|---|---|---|
| `packages/fs` | 37 | +376 | −834 |
| `packages/sandbox` | 31 | +1673 | −387 |
| `packages/jobs` | 32 | +3451 | −1188 |
| `packages/spill` | 21 | +968 | −376 |
| `packages/ptc-runtime` | 7 | +36 | −34 |
| `packages/attachment` | 8 | +80 | −19 |

`packages/fs` 的净删除量（−834）**完全来自 `tool-present` 的迁出**，不是文件能力的收缩。

源码/测试分层（实测）：`jobs` 的 11 个 src 文件 +1432/−541 对 8 个测试文件 +1853/−525；`sandbox` 的 8 个 src 文件 +412/−123 对 8 个测试文件 +1137/−172；`fs` 的 5 个 src 文件 +49/−4 对 4 个测试文件 +177/−5。本版在这三个包组里**测试增量都大于源码增量**。

---

## 关键类型

### 片段 A：Windows grant 的三次编辑（`packages/sandbox/sandbox-windows-acl/src/acl.ts:377`）

```ts
export function grantWrite(
  api: Win32Bindings,
  path: string,
  sidPtr: NativePtr,
  lowLabelSidPtr: NativePtr,
  worldSidPtr: NativePtr,
): void {
  withPathLock(api, path, () => {
    const { oldAcl, labelAcl, descriptor } = readCurrentSecurity(api, path)
    if (oldAcl !== null && labelAcl !== null
      && hasExactGrant(oldAcl, sidPtr) && hasExactDeny(oldAcl, worldSidPtr)
      && hasExactLabel(labelAcl, lowLabelSidPtr)) {
      // The exact ACE, deny, and label stand: releasing the descriptor is the whole operation.
      if (descriptor !== null) {
        const freed = api.localFree(descriptor)
        if (!isNullPtr(freed)) throwLastError(api, 'LocalFree', `grantWrite(${path}) descriptor`)
      }
      return
    }
    // ...
    mergeAndApply(
      api, path,
      Buffer.concat([
        buildExplicitAccess(worldSidPtr, abi.DENY_ACCESS, abi.FILE_DELETE_CHILD, abi.CONTAINER_INHERIT_ACE),
        buildExplicitAccess(sidPtr, abi.GRANT_ACCESS, abi.GRANT_MASK),
      ]),
      oldAcl, { kind: 'apply', acl: label }, descriptor, 'grantWrite',
    )
  })
}
```

注意 `Buffer.concat` 的**顺序**：DENY 在前、ALLOW 在后，两次编辑在一次 `SetEntriesInAclW` 合并里完成，再连同标签 ACL 一起交给**一次** `SetNamedSecurityInfoW`（`acl.ts:229` `mergeAndApply`）。

### 片段 B：Low 完整性标签的构造（`packages/sandbox/sandbox-windows-acl/src/acl.ts:169`）

```ts
export function buildLowLabelAcl(api: Win32Bindings, lowLabelSidPtr: NativePtr): NativePtr {
  const sidLength = api.getLengthSid(lowLabelSidPtr)
  if (sidLength === 0) throwLastError(api, 'GetLengthSid', 'Low mandatory label SID')
  const aclLength = abi.ACL_HEADER_SIZE + abi.MANDATORY_ACE_OVERHEAD + sidLength
  const acl = api.localAlloc(abi.LPTR, aclLength)
  if (isNullPtr(acl)) throwLastError(api, 'LocalAlloc', 'Low mandatory label ACL')
  if (api.initializeAcl(acl, aclLength, abi.ACL_REVISION) === 0) { /* ...localFree + throwWin32... */ }
  if (api.addMandatoryAce(
    acl, abi.ACL_REVISION, abi.SUB_CONTAINERS_AND_OBJECTS_INHERIT, abi.SYSTEM_MANDATORY_LABEL_NO_WRITE_UP, lowLabelSidPtr,
  ) === 0) { /* ...localFree + throwWin32... */ }
  return acl
}
```

标签的继承标志是 `SUB_CONTAINERS_AND_OBJECTS_INHERIT`（`0x3`，`win32-abi.ts`），与 DENY ACE 的 `CONTAINER_INHERIT_ACE`（`0x2`）**不同**——这个不对称是刻意的，见 C1。

### 片段 C：令牌完整性级别下移（`packages/sandbox/sandbox-windows-acl/src/token.ts:156`）

```ts
export function restrictTokenIntegrity(api: Win32Bindings, token: NativePtr, lowLabelSidPtr: NativePtr): void {
  const sidLength = api.getLengthSid(lowLabelSidPtr)
  if (sidLength === 0) throwLastError(api, 'GetLengthSid', 'Low integrity label SID')
  const info = Buffer.alloc(abi.TOKEN_MANDATORY_LABEL_SIZE + sidLength)
  info.writeBigUInt64LE(ptrAddress(lowLabelSidPtr), 0) // Label.Sid
  info.writeUInt32LE(abi.SE_GROUP_INTEGRITY, 8) // Label.Attributes
  if (api.setTokenInformation(token, abi.TokenIntegrityLevel, info, info.length) === 0) {
    throwLastError(api, 'SetTokenInformation', 'TokenIntegrityLevel (Low)')
  }
}
```

调用点在 `src/index.ts:289`，紧跟 `createRestrictedToken(...)` 之后、`this.token = restrictedToken` 之前——即**在任何 spawn 之前**，失败即 fail-closed。

### 片段 D：`JobSpec` 与 `JobHandle`（`packages/jobs/jobs/src/types.ts:126`、`:86`）

```ts
export interface JobSpec {
  kind: JobKind
  label: string
  owner?: SessionId
  outputLimitBytes?: number
  output?: readonly JobOutputSource[]
  run(job: JobHandle): JobHooks
}

export interface JobHandle {
  readonly id: JobId
  append(text: string, options?: JobAppendOptions): void
  updateProgress(line: string): void
}
```

`JobHandle` 的 JSDoc 明确了一条**重要的失败语义**：`append`/`updateProgress` 全是同步、非抛出的；结算之后（生产者自己的终态、kill、或注册表强制 teardown）**写入只记日志并丢弃，而不是抛出**——这样生产者尾部的 flush 不会破坏自己的 teardown 路径。

### 片段 E：一条事件流的五种形态（`packages/jobs/jobs/src/types.ts:200`）

```ts
export type JobEvent =
  | { readonly type: 'registered' | 'progress' | 'stopping' | 'removed'; readonly job: JobView }
  | { readonly type: 'settled'; readonly job: JobView; readonly cause: JobSettleCause; readonly awaited: boolean }
  | { readonly type: 'output'; readonly id: JobId; readonly owner?: SessionId; readonly total: number }

export type JobEventFilter =
  | { readonly owner: SessionId }
  | { readonly owners: 'all' | 'scope' }
```

`output` 事件**只带 id 与新总量**，不推 payload：观察者拿到事件后自己按游标调 `readAt`。这是「注册表从不推送载荷」这条设计的类型级体现。

### 片段 F：输出环的淘汰（`packages/jobs/jobs-local/src/ring.ts:76`）

```ts
trim(cap: number): void {
  while (this.retainedBytes > cap && this.chunks.length > 1) {
    const dropped = this.chunks.shift()
    if (dropped === undefined) break
    this.retainedBytes -= dropped.bytes
  }
  const single = this.chunks.length === 1 ? this.chunks[0] : undefined
  if (single !== undefined && single.bytes > cap) {
    const tail = utf8Tail(single.text, cap)
    single.at += single.bytes - tail.bytes
    single.text = tail.text
    single.bytes = tail.bytes
    single.gapBefore = true
    this.retainedBytes = tail.bytes
  }
  this.earliest = this.chunks[0]?.at ?? this.total
}
```

**偏移一旦分配就永不移动**：淘汰只推进 `earliest`；单个超大 chunk 保留其 UTF-8 安全尾部并打上 `gapBefore`。

### 片段 G：保留函数（`packages/spill/spill-policy/src/retention.ts:48`）

```ts
export function retainContent(
  content: readonly RetainableBlock[],
  budget: number,
  price: (block: RetainableBlock) => number,
): RetainedContent
```

它是**纯函数**：不碰存储、不认识会话、不认识工具。首尾各拿预算的一半（`Math.ceil(budget / 2)` 与 `Math.floor(budget / 2)`）；文本可以二分切分并保护 UTF-16 代理对，**图片整体保留或整体省略**。

### 片段 H：`FileSystem.watch` 的默认实现（`packages/fs/fs/src/index.ts:100`）

```ts
watch(target: FsTarget, changed: (error?: Error) => void, signal: AbortSignal): Promise<() => Promise<void>> {
  void target
  void changed
  signal.throwIfAborted()
  return Promise.reject(new FsError('Filesystem watching is not supported by this provider.', 'FS_IO_ERROR'))
}
```

缝上给了一个**默认拒绝**而不是 `abstract`：所有既有 provider（远程、沙箱、内存 fixture）不需要为新增能力改一行代码，未实现的它们自动 fail-closed 成 `FS_IO_ERROR`。

---

## 数据流

### D1. 一次被关押的 Windows 写入

```
模型工具调用（bash/pwsh）
   → ctx.shell.resolve(request): ShellExecSpec（含 sandbox mode）
   → 沙箱 seam 解析 provider = sandbox-local，runner = windows-acl
   → AclSandbox.init()
        ① makeWellKnownSid(WinLowLabelSid)  + makeWellKnownSid(WinWorldSid)     index.ts:263-264
        ② manageDacls 时对每个 writableDir 调 grantWrite(..., lowLabelSid, worldSid)
             └─ withPathLock → readCurrentSecurity → （精确跳过？）→ mergeAndApply
                  一次 SetNamedSecurityInfoW：capability ACE + world DENY(FILE_DELETE_CHILD)
                                              + Low no-write-up 标签
        ③ createRestrictedToken(..., mode)                                     token.ts:216
        ④ restrictTokenIntegrity(restrictedToken, lowLabelSid)                 index.ts:289
   → spawn 受限子进程
   → 内核访问检查：pass-1 普通 SID ∧ pass-2 限制 SID ∧ 强制完整性策略
```

### D2. 一次后台 job 的完整生命周期

```
生产者（tool-bash / tool-pwsh / tool-workflow / subagent / tool-terminal）
   → ctx.jobs.start(spec)                                        jobs/src/index.ts:110
        · preflight（owner 权限、并发上限）必须在 starter 之前
        · run(job: JobHandle) 同步返回 hooks；抛错则「什么都不注册」
        · 注册提交 → emit('registered') 永远是第一个事件
   → 字节进入环的两条路：
        (a) 生产者直接 job.append(text, { channel, gapBefore })      ring.ts:55
        (b) 生产者给 spec.output = [JobOutputSource] → 注册表起 pump   pump.ts:53
             每 pollPollMs 排空一次；结算前再排空最后一次
   → 结算：settle（合并 kill reason、清 progress、裁到 settledRetainBytes
                 但不低于模型游标未消费的字节、释放 waiter）
        → emit('settled', { cause, awaited }) → emit('output', { total })
   → 消费者：
        · 模型：job_output → registry.read(id, caller)   移动 modelCursor
        · 浏览器：job.follow → registry.readAt(id, from) 不移动任何游标
```

### D3. 一次超限工具结果的保留（本版）

```
工具执行完成
   → ToolDefinition.projectContent（MCP 等）先装好真实的 image block
   → tools/post-execute 瀑布：spill-policy 监听器 prepend，先 await next()
        · decision 不是 accept / 带 value / 名为 read → 原样放行
        · 内容里只有 text|image 才进入 bound()
   → bound()：
        price = 该 route 的 imageRequestPricing + token-meter 文本估算
        总价 ≤ maxInlineTokens → 什么都不做
        否则：spillStore.saveText({ content: fullText(content) })
              （fullText 在每个图片位置写可读的附件路径，不写字节）
              预留「最坏情况遗漏通知」的 token → retainContent(剩余预算)
              头 + GAP + 尾 + 尾部通知 → 合并相邻 text block → 返回
   → tools/ptc-dispatch-log：同一个 bound() 上限日志副本
```

---

## 测试覆盖

本版在范围里新增/重写的测试文件（`git diff --name-status` 实测，A = 新增）：

| 测试文件 | 状态 | 覆盖的行为 |
|---|---|---|
| `packages/sandbox/sandbox-windows-acl/tests/runner.spec.ts` | M（+219） | 真实 runner + 真实受限令牌下的删除逃逸（`cmd`、.NET、`Remove-Item`、libuv 四条路径）、跨 grant 根删除、`GENERIC_ALL` 打开文件成功/打开目录被拒、双 grant 撤销后存留 grant 仍可用 |
| `packages/sandbox/sandbox-windows-acl/tests/acl.spec.ts` | M（+215） | 真实 DACL/标签生命周期；DENY 只继承到容器；共享标签的撤销规则 |
| `packages/sandbox/sandbox-windows-acl/tests/acl-failure-paths.spec.ts` | M（+671） | 每个新分配与提前退出路径（含标签 ACL 与描述符释放） |
| `packages/sandbox/sandbox-windows-acl/tests/token-failure-paths.spec.ts` | M（+58） | `TokenIntegrityLevel` 的精确载荷 |
| `packages/sandbox/sandbox/tests/escalation.spec.ts` | M（+18） | 同模式返回、更宽仍需审批、更窄/不支持仍失败 |
| `packages/fs/fs-local/tests/watch.spec.ts` | **A**（144 行） | 文件/目录观察、`ignoreInitial`、ready 前取消、初始化失败 |
| `packages/fs/fs/tests/service.spec.ts` | M（+8） | 未实现观察的 provider 以 `FS_IO_ERROR` 拒绝 |
| `packages/jobs/jobs-local/tests/ring.spec.ts` | **A**（65） | 环的偏移不变性、淘汰、单块尾部保留 |
| `packages/jobs/jobs-local/tests/pump.spec.ts` | **A**（156） | 泵的恒定资源等待、结算前最终排空、lossy 读成 gap |
| `packages/jobs/jobs-local/tests/events.spec.ts` | **A**（146） | `{owner}` / `{owners:'scope'}` / `{owners:'all'}` 三种订阅的作用域 |
| `packages/jobs/jobs-local/tests/jobs.spec.ts` | M（+986 行改动） | 注册顺序、两个游标、结算语义、删除 |
| `packages/jobs/jobs/tests/archive-admission.spec.ts` | **A**（145） | `workspace/session-activity` 与 `session-stop`（归档前停掉会话的运行中作业） |
| `packages/jobs/jobs/tests/invariant.spec.ts` | M（+227） | 事件协议（registered 首、settled 一次、removed 末）+ 事件与注册表读回的一致性 |
| `packages/jobs/tool-jobs/tests/tool-jobs.spec.ts` | M（+527） | 通知申领台账、通知文本逐字、wait 超时/中止的申领释放 |
| `packages/spill/spill-policy/tests/retention.spec.ts` | **A**（70） | 纯保留函数的头尾划分、代理对保护、图片不可分 |
| `packages/spill/spill-policy/tests/multimodal.spec.ts` | **A**（220） | 多模态保留的端到端行为 |
| `packages/spill/spill-policy/tests/multimodal-recovery.spec.ts` | **A**（209） | 恢复（图片路径不可读、缺计价器）时保持原内容 |
| `packages/spill/spill-policy/tests/notice.spec.ts` | M（+8） | 同时识别历史（纯字节）通知与带图片计数的通知 |
| `packages/spill/spill-policy/tests/spill-policy.spec.ts` | M（193） | 双臂（post-execute / dispatch-log）投影 |
| `packages/attachment/attachment-local/tests/lazy-sharp-failure.spec.ts` | **A**（40） | `sharp` 加载失败**不被误判为图像数据非法/编码失败** |

快照层（`snapshots/`，`git diff --name-status ... -- snapshots` 实测新增）：

```
A  snapshots/acp/fs-same-mode/{input.json,session.v3.jsonl,snapshot.yml,stdout.expected.jsonl,workspace.expected/escalated.md}
A  snapshots/session/bash-same-mode-empty-justification/{session.v4.jsonl,snapshot.yml}
A  snapshots/session/multimodal-spill-ends/{cordis.yml,cordis.snapshot.yml,fixture.mjs,session.v3.jsonl,session.v4.jsonl,snapshot.yml,system-prompt.expected.md,tool-schemas.expected.json}
A  snapshots/session/multimodal-spill-middle/{session.v3.jsonl,session.v4.jsonl,snapshot.yml}
M  snapshots/session/background-job-admission 相关、snapshots/web/background-job-list/{running,settled}.expected.md
M  snapshots/session/session-query-spill/{cordis.yml,cordis.snapshot.yml,resolve-spill-command.mjs,tool-schemas.expected.json}
```

`snapshots/acp/fs-same-mode/workspace.expected/escalated.md` 这个文件名本身就是断言：同模式下**不产生任何审批事件**，且写入的产物必须真实落盘。

---

## 与上下游的关系

### 上游（本版依赖这些包，但它们的实现不属本文）

| 上游 | 关系 |
|---|---|
| `packages/subprocess/win32-process` | `sandbox-windows-acl` 的进程原语、stdio、Job 对象、句柄清理都由它 owner；本包的 `verify/abi-probe.cpp` 只验沙箱自己那部分 SID/ACL/token/文件/锁声明 |
| `packages/util/lazy-require` | 本版新被 `sandbox-windows-acl/src/ffi.ts`（lazily require `koffi`）与 `attachment-local/src/sharp.ts`（lazily require `sharp`）使用 |
| `packages/llm/token-meter` + `packages/llm` 的 `imageRequestPricing` | `spill-policy` 的计价来源（`estimateContent`、`calculator.priceImages`） |
| `packages/core/tools` | `tools/post-execute` 与 `tools/ptc-dispatch-log` 是 `spill-policy` 唯一的扩展点；`ToolDefinition.projectContent` 决定图片何时装好 |
| `packages/api/job-controller` | **本版新增包**，owner `job.list` / `job.follow` / `job.kill` 三个 Remote；`packages/jobs` 只提供 `attachController` 挂载点与 `JobView` 投影词汇 |

### 下游（本版消费这些包）

| 下游 | 消费方式 |
|---|---|
| `packages/shell/{tool-bash,tool-pwsh,bash-sandbox,pwsh-sandbox}` | 本版改为「启动即注册 job」；`JobKindMap` 由 `tool-pwsh` 声明合并（`packages/shell/tool-pwsh/src/index.ts:44`），`bash` 是内置（`jobs/src/view.ts:33`） |
| `packages/terminal/tool-terminal` | 声明合并 `JobKindMap`（`src/index.ts:20`，pty 类作业） |
| `packages/workflow/tool-workflow` | 声明合并 `JobKindMap`（`src/index.ts:35`）+ 本版新增 `run_in_background` |
| `packages/subagent/*` | 一次性后台子代理作业；`JobOutcome.result` 承载子代理报告 |
| `packages/api/workspace-files` | **本版新增消费 `ctx.fs.watch`**（`src/changes.ts:79`）；同时新增 `readBytes` 二进制 Remote（见 C11） |
| `packages/workspace/workspace` | 通过 `workspace/session-activity`（waterfall）与 `workspace/session-stop`（parallel）两个事件被 jobs 挂钩；`jobs/tsconfig.json` 本版新增对 `../../workspace/workspace` 的引用 |
| `packages/client/ui-jobs` | 浏览器侧作业名册与观察流；行在存活期或留存输出后可展开 |
| `packages/fs/fs-sandbox`、`packages/fs/fs-observation-policy` | 组合在 `fs` 之上；`fs-sandbox` 本版文档明确「mutation fence 不限制观察」 |

`docs/subsystems/workspace.md` 在区间内新增了标题级结构（实测新增小节）：`## Default Workspace initialization`、`## Session pinning`、`## Archive admission`、`### workspace/* events`、`#### workspace/session-activity — waterfall`、`#### workspace/session-stop — parallel`。jobs 的归档准入正是挂在后两个事件上。

---

## 本版本变更要点（0.1.6-alpha.1 → 0.1.7-rc.1）

### C1. Windows ACL：强制完整性 + 环境删除 DENY（本版沙箱最重要增强）

**笔记**：`.agents/notes/implemented/feature/2026-09-19-windows-acl-mandatory-integrity-confinement.md`（本版新增，`git diff --name-status` 显示 `...i18n.yaml` 为 R052 重命名、`.md`/`.zh.md` 为 **A**）。

#### 问题（笔记原文复述）

受限令牌 rung 用「限制 SID 求交」关押写入，但这个交集**只覆盖对象自身安全描述符的访问检查**。Windows 还可以从**父目录**的 `FILE_DELETE_CHILD` 权利授权一次写或删除，而这个权利**不需要任何限制 SID 联署**。因此 `cmd /c del` 与 `[System.IO.File]::Delete`——任何最终到达 `DeleteFileW` 的路径——在**两种**受限模式下都能删掉工作区之外的文件（issue #4581），而同一子进程的普通写入却被拒绝。

#### 决策：每次 grant 做三次编辑，且令牌匹配下移

笔记第 13 行起明确列出「one `SetNamedSecurityInfoW` call」里的三件事，源码逐条对得上：

| # | 编辑 | 源码位置 | 关键常量 |
|---|---|---|---|
| 1 | capability-SID allow ACE（`OI\|CI`）——写权限，未变 | `acl.ts:409` | `GRANT_ACCESS` + `GRANT_MASK` |
| 2 | world SID 对 `FILE_DELETE_CHILD` 的 DENY ACE，带 `CONTAINER_INHERIT_ACE` | `acl.ts:408` | `DENY_ACCESS` + `FILE_DELETE_CHILD` + `CONTAINER_INHERIT_ACE = 0x2` |
| 3 | Low 完整性强制标签（`S-1-16-4096`、`SYSTEM_MANDATORY_LABEL_NO_WRITE_UP`、`OI\|CI`），并把受限令牌的完整性级别下移到同一级 | `acl.ts:169` `buildLowLabelAcl` + `token.ts:156` `restrictTokenIntegrity` | `WinLowLabelSid = 66`、`SYSTEM_MANDATORY_LABEL_ACE_TYPE = 0x11`、`TokenIntegrityLevel = 25`、`SE_GROUP_INTEGRITY = 0x20` |

笔记强调**每一块都是承重的**，源码里三处不对称可以一一复核：

- **标签是唯一能到达父目录 `FILE_DELETE_CHILD` 那条路的机制**：内核在访问检查**内部**评估强制策略，不论授权来自哪个权利。所以在 grant 根之外的 Medium 对象既写不进也删不掉。
- **DENY 才是把「一个 grant 根」和「另一个 grant 根」隔开的机制**：每个 grant 根都带 Low 标签，光靠完整性检查它们之间**会互相通过**。
- **DENY 只继承到容器**：`0x40`（`FILE_DELETE_CHILD`）是 `FILE_ALL_ACCESS` 的成员，若把 DENY 继承到文件上，grant 根内的每个 `GENERIC_ALL`/`FullControl` 打开都会被拒——笔记记录这是「在收窄标志前对着真实 runner 量出来的」。

新增的 ABI 常量（`src/win32-abi.ts`，本版 +33 行）与 `verify/abi-probe.cpp` 的 `static_assert` 是对应的：

```
P(CONTAINER_INHERIT_ACE);  P((int)ACCESS_DENIED_ACE_TYPE);  P((int)DENY_ACCESS);
P(LABEL_SECURITY_INFORMATION);  P((int)SYSTEM_MANDATORY_LABEL_ACE_TYPE);
P(SYSTEM_MANDATORY_LABEL_NO_WRITE_UP);  P((int)TokenIntegrityLevel);
P(SE_GROUP_INTEGRITY);  P((int)WinLowLabelSid);
P(sizeof(TOKEN_MANDATORY_LABEL));  P(offsetof(TOKEN_MANDATORY_LABEL, Label));
P(sizeof(ACL));  P(sizeof(SYSTEM_MANDATORY_LABEL_ACE));  P(ACL_REVISION);  P(LPTR);

static_assert(sizeof(TOKEN_MANDATORY_LABEL) == 16, "TOKEN_MANDATORY_LABEL size");
static_assert(sizeof(ACL) == 8, "ACL header size");
static_assert(sizeof(SYSTEM_MANDATORY_LABEL_ACE) == 12, "mandatory label ACE body size");
static_assert(ACL_REVISION == 2, "ACL revision");
static_assert(LPTR == 0x40, "LocalAlloc flags");
```

#### 幂等与撤销规则

- **幂等跳过现在要求「精确 ACE ∧ 精确 DENY ∧ 精确标签」三者齐备**（`acl.ts:386-388`）。因此**一个由更早构建授权过的根，会在下一次 provision 时补上 DENY**——这是本版能平滑升级的关键。
- **标签在工作区根上是「常驻」的（standing）**，理由与 capability ACE 相同：每会话撤销会导致每次 provision 重新传播整棵树，并与并发会话竞争。`revokeWrite` 只在目录上**不再有其他 capability grant** 时才清标签（`acl.ts:443` `hasForeignGrant(oldAcl, sidPtr) ? { kind: 'keep' } : { kind: 'clear' }`），所以同一目录上的两个 grant 仍然可以各自独立撤销。
- `mergeAndApply` 新增 `LabelEdit` 三态（`acl.ts:211`）：`apply`（带标签 ACL）/`clear`（清标签）/`keep`（**完全不传** `LABEL_SECURITY_INFORMATION`）。`keep` 分支的 `SetNamedSecurityInfoW` 信息掩码只有 `DACL_SECURITY_INFORMATION`——这一点在 `mergeAndApply` 的三元表达式里可以直接读到。

#### 被否决的替代方案（笔记 23–43 行，均有实测依据）

| 替代方案 | 否决理由（笔记原文事实） |
|---|---|
| 标签改为按会话可撤销 | 换来的是每次 provision 的**急切整树传播**（大工作区几十秒），而确定性的 per-workspace SID 正是为了避开它；并发或崩溃的会话会让标签来回震荡 |
| `read-only` 模式改用 Untrusted 完整性（`S-1-16-0`） | 「在本机实测：Untrusted 令牌**根本无法启动 `pwsh`**——DLL 初始化失败（`0x8007045A`，`BCrypt.dll`）」，于是只读模式会没有可用 shell |
| DENY 带 `OI\|CI` | 会把 DENY 也落到 grant 根内**每个文件**上（`icacls` 观察为 `Everyone:(I)(DENY)(DC)`），而 `0x40` 属于 `FILE_ALL_ACCESS`，于是对这些文件的 `CreateFileW(GENERIC_ALL)` 对用户、Administrators、SYSTEM 和 DSH host 全部返回 `ERROR_ACCESS_DENIED` |
| 拿掉隔离层、把逃逸写进文档 | 「逃逸本身就是报告」：`cmd /c del` 删到工作区外，正是沙箱承诺不允许的事，而任何读侧或纯 ACL 改动**在构造上**都无法关闭它 |
| 给每个工作区自己的完整性级别 | 强制完整性控制只有五级固定值（Untrusted/Low/Medium/High/System），无法像 `S-1-4-x-y` 能力 SID 那样按工作区派生 |

#### 代价（笔记 47 行 + 包 README「Verified boundaries」）

- **常驻 Low 标签会为同用户的任何其他 Low 完整性进程放宽工作区**，并且**比 DSH 活得更久**：另一个产品的 Low-IL 沙箱、受保护模式阅读器都能在工作区里写和删。标签是「在此完整性级别拥有写边界」的代价。
- **被授权的目录现在还必须授予 `WRITE_OWNER`**（标签在 SACL 里，属主的隐式权利只覆盖 `READ_CONTROL` 与 `WRITE_DAC`）。全控制工作区天然满足；只给 Modify 的目录现在**直接响亮失败**，而不是静默跳过隔离。
- **grant 根内目录的 FullControl 打开会被拒**（无 `OI|CI` 的必然残余代价）；`DELETE` 型删除、`MAXIMUM_ALLOWED` 与普通读写打开不受影响。
- **被 AppContainer 工具用 package SID（`S-1-15-2-…`）ACL 过的树，对 Low 子进程不可读**——内核规则未确认，不属本包职责。
- **FAT 类目标仍未验证**。

#### 强制级别的报告文字也随之改了

`packages/sandbox/sandbox-local/src/index.ts:178` 的 `STATIC_ENFORCEMENT` 表把 `'windows-acl'`（`:188`）固定为 `'partial'`，其注释从「Everyone 边界」改成三条：**NTFS 硬链接跨路径别名同一文件对象、读不受限、被 AppContainer ACL 过的树不可读**。`docs/subsystems/sandbox.md` 的对应句（本版唯一一处改动）同步改成：

> Older Landlock ABIs and the Windows ACL runner's hard-link, unconfined-read, and AppContainer-ACL boundaries are current partial cases.

`packages/sandbox/sandbox-local/README.md`（3 处）、`packages/sandbox/sandbox-windows-acl/README.md`（+34/−? ）也都改了同一句话，并在 README 里新增了「Granted directories must be caller-owned and grant `WRITE_OWNER`」「A standing Low label outlives DSH and widens the tree for other Low-integrity processes」两条 Known Limitations。

#### 一处附带的重构

`src/ffi.ts` 本版把 `koffi` 改成**惰性 require**（`createLazyRequire<Koffi>('koffi', import.meta.url)`），并把 `setNamedSecurityInfoW` 的 `sacl` 形参类型从 `null` 放宽为 `NativePtr | null`；同时新增 `initializeAcl`、`addMandatoryAce` 两个绑定，并把结尾的 `as unknown as Win32Bindings` 换成 `as Win32Bindings`（与仓库 `2026-09-19-no-unknown-casts` 规则一致）。`tsconfig.json` 因此新增对 `../../util/lazy-require` 的引用。

---

### C2. sandbox 同模式（same-mode）不再需要审批

**笔记**：`.agents/notes/implemented/feature/2026-09-16-sandbox-same-mode.md`（本版新增）。提交：`61c548e200 fix(sandbox): accept repeated effective permission modes`。

#### 问题

模型可以在某模式**已经生效**时重复请求 `sandbox_permissions: danger-full-access`。拒绝该调用会阻断已被授权的工作，却**没有阻止任何权限提升**。

#### 决策

`approveEscalation` 在请求模式与生效模式相同时**立即返回生效模式**。源码就一行，位置在严格加宽检查**之前**：

```ts
// packages/sandbox/sandbox/src/escalation.ts:153
export async function approveEscalation<A, C>(request: EscalationRequest, approval: EscalationApproval<A, C>): Promise<SandboxMode> {
  const { requestedMode: mode, effectiveMode, justification, subject } = request
  if (mode === effectiveMode) return effectiveMode       // ← 本版新增
  // Strict widening is an EXECUTION check against the call's effective mode —
  // deliberately not a schema constraint (the enum is the closed target
  // vocabulary; the effective mode is per-call truth).
```

三条边界保持原样：**参数配对（`sandbox_permissions` + `justification`）在工具侧仍是强制的**；更宽的模式仍需要审批；更窄或不受支持的目标仍然失败。`EscalationRequest.effectiveMode` 的 JSDoc 也从「the request must strictly widen」改成「repeating it needs no approval」，整个函数的 JSDoc 重写为一段「重复返回、更宽需审批、更窄/不支持抛错」的直陈。

笔记明确这是对 `.agents/notes/implemented/feature/2026-07-06-sandbox.md` 中「非加宽一律拒绝」规则的**部分取代**（partial supersession）：该 note 的关押决策与逐调用审批决策仍然有效。

#### 证据

- `packages/sandbox/sandbox/tests/escalation.spec.ts`（+18）覆盖「两种 advertised target」。
- `packages/fs/tool-fs/tests/tools.spec.ts` 新增对 fs 工具侧的参数化断言：

```ts
it.each(['workspace-write', 'danger-full-access'] as const)('writes under repeated %s without approval', async (mode) => {
  const { ctx, fs } = await setupConfining()
  const result = await call(ctx, 'write', {
    file_path: 'a.txt', content: 'x', sandbox_permissions: mode, justification: 'use the current permissions',
  }, escalationAgent([{ type: 'sandbox/mode', data: { mode } }]))
  expect(result.isError).toBe(false)
  expect(fs.stamped).toEqual([{ mode, workspaceRoot: '/session-project', sessionId: SessionId('sess-fs-esc') }])
})
```

- ACP 快照 `snapshots/acp/fs-same-mode/`（**本版新增**）验证「一次无审批事件的无限制写入」，并检查产物文件。
- bash 侧另有一份 `snapshots/session/bash-same-mode-empty-justification/`（**本版新增**）。

`packages/fs/tool-fs/src/sandbox.ts:78` 与 `packages/sandbox/sandbox/README.md`（两处）同步了措辞。

---

### C3. jobs：从「多缝叠加」收敛为「一圈、一投影、一流」

**笔记**：`.agents/notes/implemented/architecture/2026-09-01-jobs-absorb-activity-record.md` 与 `2026-09-03-jobs-seam-consolidation.md`。

> **状态核实（任务给了不确定提示，实测结论：两篇都是本版新增）**：
> ```
> git diff --name-status dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- .agents/notes
> A  .agents/notes/implemented/architecture/2026-09-01-jobs-absorb-activity-record.md
> A  .agents/notes/implemented/architecture/2026-09-03-jobs-seam-consolidation.md
> ```
> 两篇的 `.md` 与 `.zh.md` 都是 **A（新增）**，`.i18n.yaml` 显示为 R057（从别的 note 的 i18n 文件重命名而来，属 i18n 配对工具的产物）。**所以两者都确属本版区间，不是 0.1.6 遗留。**

#### 问题（两阶段）

`2026-09-01` 记的是**双注册表**问题：活动观察缝（activity observation seam）与 `ctx.jobs` 并列存在，生产者把同一件事注册两遍，手工维持两个终态一致，Web 客户端维护两份名册并按行 join。笔记给出量化：**八个配对调用点**，生产者分布为「后台 bash/pwsh（两个注册表都注册）、PTY 发送与子代理委派（只有 jobs）、前台 workflow（只有 activity）」。唯一没有 job 的活动就是前台 workflow 镜像。

`2026-09-03` 记的是**接口层问题**：生产者把输出声明两次（模型读的消费式 `readOutput` + 观察者读的可选 `record: true` 环），注册表为同一个 job 保留三套词汇（`JobSnapshot` / `SessionJob` / `JobWireChunk`），三个监听器家族（`onJobDone` / `onJobsChanged` / `onOutput`）用不同 owner 过滤交付重叠事实，且注册表自己跟踪 `reported` 这个「只有面向模型的工具才能解释」的位。评审的原话是：读者分不清 `read`、`readRecord`、`JobStart`、`RecordingJob`、`updateDetail` 里**哪个是契约、哪个是历史事故**。

#### 决策（收敛后的七条，逐条对得上源码）

| 决策 | 源码证据 |
|---|---|
| **一圈/job**：`JobSpec` 取代 `JobStart`，`output?: JobOutputSource[]` 由注册表按 `pumpPollMs` 泵；生产者拿到 `JobHandle.append` 推同一环 | `jobs/src/types.ts:126`、`:55`；`jobs-local/src/pump.ts:53` `startPump` |
| **两游标一份存储**：`read(id)` 是有状态的模型游标，`readAt(id, from)` 是无状态观察读 | `jobs/src/index.ts:136` / `:148`；`jobs-local/src/ring.ts:100` `readFrom` |
| **`updateProgress` 取代 `updateDetail`**：`JobView.progress` 是活行、结算时清空；`JobView.detail` 是终态原因，模型 `job_kill` 的 reason 合并进来 | `jobs/src/types.ts:101`、`view.ts:83`、`:85` |
| **一份投影**：`JobView`（客户端安全叶子 `@deepseek-ai/dsh-jobs/view`）被模型工具、浏览器名册和观察帧共同消费；`owner` 是 session id，**从不是 `Agent`** | `jobs/src/view.ts`（本版**新增**，100 行）；`jobs/tsconfig.json` 新增 workspace 引用 |
| **直接调用者作用域操作**：`list`/`get`/`read`/`readAt`/`kill`/`wait` 每次调用都接受 caller session；省略 caller 只允许无主 job | `jobs/src/index.ts:110-192` |
| **一条事件流**：`events.subscribe(filter, listener)`，`{owner}` / `{owners:'scope'}` / `{owners:'all'}` 取代三个监听器家族；`settled` 带 cause（`producer`/`kill`/`teardown`）；`output` 只带 id 与新 total | `jobs/src/types.ts:200`、`:235`；`jobs-local/src/events.ts`（本版新增，102 行） |
| **通知台账移到 `dsh-tool-jobs`**：注册表不再跟踪 `reported` | `jobs-local/README.md`：「the registry keeps no report bit」；`tool-jobs/src/index.ts` 的私有待领集合 |

新增 `JobRegistry.remove(id, caller)`（`jobs/src/index.ts:183`），用于「前台调用在 wait 窗口内就结束、模型不该看到 id」的场景。

#### 新增的跨包钩子：归档准入

`jobs/src/archive-admission.ts`（本版**新增**，48 行）由每个注册表实现通过 seam 的构造函数安装（`jobs/src/index.ts:96` `installJobArchiveAdmission(ctx, this)`），因此对**所有**实现都成立——它只依赖抽象的 `list` 与 `kill`：

```ts
export function installJobArchiveAdmission(ctx: Context, registry: JobRegistry): void {
  ctx.on('workspace/session-activity', async ({ sessionId }, next) => {
    const jobs = runningJobs(registry, sessionId)
    const rest = await next()
    if (jobs.length === 0) return rest
    const own: SessionActivity = { kind: 'job', items: jobs.map(job => ({ id: job.id, label: job.label })) }
    return [own, ...rest]
  })
  ctx.on('workspace/session-stop', ({ sessionId }) => {
    for (const job of runningJobs(registry, sessionId)) {
      try { registry.kill(job.id, sessionId, 'session archived') }
      catch (error: unknown) {
        // A producer throwing on cancel must not keep the Session's other jobs running once it is archived.
        ctx.logger.warn(`jobs: killing "${job.id}" for an archived Session failed: ${String(error)}`)
      }
    }
  })
}
```

注意它**只挑选 `job.owner === owner`**（`archive-admission.ts:47` 的 `runningJobs` 过滤），所以同一列表里的无主 job 不属于任何会话、不会被误杀。

#### invariant companion 换了检查对象

`jobs/src/invariant.ts` 本版从「单视图字段检查」改为**事件协议 + 事件对读回**（+117 行改动）：每个 job 必须是 `registered` 首、`settled` 恰一次、`removed` 最后；每条 announced 投影要与注册表自己的 `get` 读回一致（`kind`/`label`/`owner`/`startedAt` 恒等，且 announced 的 `output.total` **不得超前**于注册表读回的 `output.total`）；`settled` 必须 announced 终态、`finishedAt >= startedAt`、`progress` 已清空。笔记明确这条「跨观察」正是 companion 规则（`.agents/notes/implemented/simplification/2026-08-28-omit-unneeded-invariant-companions.md`）所要求的。

#### 影响面（笔记「Consequences」）

- **模型可见文本不变**：状态行、工具描述与 schema、通知措辞**逐字节相同**；唯一新增的模型可见事实是 `killed` 状态行现在带上 kill reason。
- 生产者要流式输出就选拉取源或 `append`，**永远不自己格式化消费式增量**。
- Web 客户端把每个存活 job 渲染为可展开，所以从不写输出的 job 显示空运行面板，而不是静态行。
- `JobKindMap` 的合并是宿主侧的：浏览器程序把它知道的 kind 类型化，其余当不透明字符串。实测本版的合并点：`packages/shell/tool-pwsh/src/index.ts:44`、`packages/terminal/tool-terminal/src/index.ts:20`、`packages/workflow/tool-workflow/src/index.ts:35`；`bash` 与 `subagent` 是 `jobs/src/view.ts:33` 的内置成员。

#### jobs-local 的新配置面（`jobs-local/src/index.ts:44`）

| 字段 | 默认 | 含义 |
|---|---|---|
| `maxConcurrentJobsPerOwner` | `10` | 单个精确 owner（或共享的无主桶）内 running+stopping 的上限 |
| `retainBytes` | `262144` | 每个 job 的活环保留（UTF-8 字节） |
| `settledRetainBytes` | `16384` | 结算后保留；**叠加**在「模型游标尚未消费的每个字节」之上，首次终态模型读之后才裁到这个上限 |
| `pumpPollMs` | `150` | 拉取源的轮询间隔 |

`pump.ts:45` 的注释记了一条评审修复：泵的等待**保持常量资源**——整轮运行只订阅 `until` 一次、任意时刻只挂一个 pending timer。笔记 `2026-09-01` 的 Review corrections 记录得更具体：「按默认节奏跑一整天的 job 会累积一百万个以上的闭包」。

---

### C4. human job kill：不再混淆「取消」与「送达」

**笔记**：`.agents/notes/implemented/feature/2026-08-26-human-job-kill.md`（本版新增）。提交：`51f74910ae feat(jobs): human job kill with an unclaimed terminal report`、`8f3103b511 fix(jobs): address review — error scoping, subagent fence, pending kill`。

#### 问题

Web 任务列表此前是只读的，笔记记录了原因：`JobRegistry.kill()` 会把 job 标记为 `reported`，而 `dsh-tool-jobs` 的完成报告器**会抑制已报告 job 的结算通知**。这个耦合对当时唯一的调用者（模型的 `job_kill`，它自己的工具结果已经告诉了模型）是正确的；但**人按下停止按钮没有任何模型可见通道**——那样一次 kill 会让模型以为任务还在跑。笔记点名这是 Claude Code 今天发布的「陈旧世界模型」失败（它的 `/tasks` kill 置 `notified: true`，模型什么也学不到），而 Kimi 避开了（模型 `TaskStop` 抑制自己的通知，人停止则投递一条）。

#### 决策：送达申领（delivery claim）意味着「终态有一条已提交的、通向模型的送达路径」

| 决策 | 内容 |
|---|---|
| **人工 kill 不申领送达** | `JobRegistry.kill(id, { reason? })` 只记录原因；投递台账在 `dsh-tool-jobs`，它**只**为模型自己的 `job_kill` 和它自己的 wait 申领 job。因此来自任务列表的 `job.kill` 会把结算留给既有的完成报告器（唤醒/注入、唤醒预算、截断全部不变）。它**从不**清除模型已持有的申领，终态记录也与结算时一模一样 |
| **记录下来的 kill reason 合并进 `killed` 结算的 detail** | 生产者事实在前（`signal: SIGTERM; cancelled by the user`），于是完成通知和 Web 行都能说清是谁停的，而**不需要新的快照字段或通知模板**。跑赢了 kill 的 job（结算为 `completed`/`failed`）保留纯生产者 detail |
| **`job.kill` 是 Job Controller Remote** | `@deepseek-ai/dsh-api-job-controller`，与 `job.follow` 并列；使用与 `session.cancel` 相同的 live-only Agent 查找（`ctx.agents.get`）。未知与外来 job 都收敛为**一个**作用域限于查找的 `job/not-found` 拒绝；生产者 cancel 抛错按注册表契约向上传播，而不是伪装成查找失败。控制器要求 `ctx.jobs` 存在才能加载，所以没有注册表的组合**根本没有** kill Remote |
| **访问规则只有注册表的 owner 围栏** | 不套用 Session Controller 的子代理归属围栏，所以子会话自己的 job 可以从它自己的列表里被 kill（评审拒绝了从 Session Controller 包导出该围栏的 helper）；控制器既不依赖 agent 注册表也不依赖 Session Controller |
| **无审批交互** | 这个单用户本地 BFF 把它与「取消轮次」按钮视为同一类动作 |
| **任务列表的停止控件是两段式** | 先武装、3 秒内确认（对齐 Kimi 的 `s`+`y` 与 OpenCode 的双 Esc） |

#### 关键更正（笔记顶部 Update）

笔记顶部的 Update 明确：**它引入的 `reported` 选项随 jobs 缝收敛一起消失了**。注册表不保留 report 位；`dsh-tool-jobs` 只申领它自己的 `job_kill` 并在台账里等待，所以**一次人工 `job.kill` 在构造上就是「通知仍未送达」**。reason 合并、`job.kill` Remote、两段式控件三件事未变。

#### 代价（笔记 Consequences，值得引原文）

- 人工 kill 的完成通知会**唤醒空闲属主**（默认 `wakeup` 投递）——这是刻意的代价：一条模型永远不知道的未申领完成，正是这篇笔记要修的失败。
- `kill` 的位置参数 `reason` **没了**（预发布期，不留 shim），选项对象是唯一形式。
- 被 kill 的 job 的 `detail` 现在可能带由 `; ` 连接的两个分句。任何把 `detail` 当单一生产者事实解析的代码必须把它当作不透明文本——`JobView.detail` 一直如此声明。

---

### C5. shell execute 投影与「启动即注册 job」

**笔记**：`.agents/notes/implemented/feature/2026-08-26-shell-execute-projection-and-jobs-at-start.md`（本版新增）。提交：`bb20149360 refactor(shell): register foreground commands as jobs at start and drop the promotion protocol`。

> 命令执行缝本身归第 03 篇。这里只记录它对 **jobs 缝**的契约影响。

#### 来源问题

超出前台超时的 bash 命令**被杀死、工作被丢弃**——这是长构建/安装失败最常见的方式。旧缝上无法表达「保住这条已经在跑的前台命令」：`ctx.shell` 有两个执行方法，`run()`（截止时间焊死、只有 promise、没有可留存的 handle）与 `start()`（有 handle、无截止时间）；截止时间的 owner 只能杀，调用者没有任何东西可以拿去 `ctx.jobs` 重新注册。两个方法还漂移了：不同的 stdout 预算、一条被记录在案的「start 忽略 timeoutMs」瑕疵、以及逐路径不同的同步/异步 spawn 失败行为。

#### 决策：缝收敛为 `resolve()` + `execute()`

`execute(spec)` 返回 `Promise<ShellExecution>`——活的 `ShellProcess` 本身加上前台投影 `result()`。`run()` 与 `start()` 被**删除**（预发布，无 shim）。历史差异变成显式输入：`ShellExecSpec.onExpiry` 是 `'kill'`（默认）或 `'none'`，且**一个** stdout 预算（`spec.stdoutMaxBytes`）处处适用。**没有交接协议**：想只等一会儿的调用者用 `'none'` 跑命令并自己限定等待，handle 在调用者停止等待后仍然有效。

笔记用一段「被评审否决的第一版」记录了设计演化：第一版在缝上表达交接（`onExpiry: 'offer'`、`ShellExecution.promotion`、`ShellPromotionOffer`，工具必须在截止时刻同步回答），评审否决的理由是「协议之所以存在，只因为工具在超时才注册 job，而不是在开始时」。

#### 对 jobs 的契约影响（本版 jobs 侧最实质的部分）

- **有注册表时，`tool-bash`/`tool-pwsh` 在命令启动时就把每条命令注册进 `ctx.jobs`。** `run_in_background` 立刻返回 id。
- **前台调用启动同一个 job，并用注册表的 `wait(id, timeoutMs, owner, signal)` 等它**——既有的 `timeoutMs` 就是等待上界，**没有第二个旋钮**。
- 在等待窗口内结算的命令：返回 handle `result()` 的普通前台结果，工具调 `JobRegistry.remove` 删掉作业记录，**模型永远看不到 id**，列表也不会攒下每条 `ls`。
- 跑赢等待的命令：继续作为**它本来就是的那个 job** 运行，调用返回 `{ kind: 'promoted', jobId, timeoutMs, output }`，渲染为 `[still running after <ms>; moved to background job <id>]` 加交接指引，并**预先做一次消费式注册表读**，所以后续 `job_output` 精确接着往下读。**超时时刻什么也不换手**：不是进程、不是 abort 信号、不是输出。
- **工具从不把自己的 signal 传给进程**；取消调用就是 kill 那个 job，而来自调用之外的 kill（人的停止控件、并行的 `job_kill`）通过 job 的 `cancel` 钩子到达进程，工具把它的 reason 渲染为前台结果里的 `[stopped: <reason>]`（值上的 `stopped`），让模型读到原因而不是一个命令失败。
- **后台面跟随注册表，注册表保持可选**：工具的 `inject` 不写 `jobs`。没有注册表时它注册一个纯前台定义；在 `ctx.inject(['jobs'], …)` fork 内换成 job-backed 定义；注册表卸载时再换回来。所以**没有注册表的组合仍是普通 `bash`**，其 schema 既不宣传 `run_in_background` 也不宣传交接，模型看不到任何 `job_*` 工具。
- **注册是尽力而为**：`promoteOnTimeout: false`，或注册表在启动时拒绝这个 job（属主的准入上限、没有挂载控制器），则改用执行器的 `'kill'` 截止时间跑，并记日志。
- **注册表报告等待调用者已经收走的东西**：`settled` 事件带 `awaited`——结算是否释放了一个活的 `wait`。`dsh-tool-jobs` 对 awaited 结算**以及模型通过 `job_kill` 请求的 kill** 都不发完成通知，而它的私有申领台账**已经删除**。超时或中止的等待早已离开注册表的 waiter 集合，所以之后的结算照常通知。

#### 证据

`tool-jobs` 层用真实进程钉住：`printf …; sleep 30` 配 `timeoutMs: 250`，在调用等待期间就被列为 `bash-1`，返回带早期输出的 still-running 文本，且下一次 `job_output` **不重复任何内容**；等待期间注册表 kill 渲染 `[stopped: cancelled by the user]` 于信号标记之前；取消调用以 `tool call aborted` 为 reason kill 它的 job；准入饱和回落到截止时间 kill 并告警。注册表层：`remove` 丢弃已结算记录并发 `removed` 事件，拒绝活 job、未知 id 与外来调用者。**渲染文本逐字钉住。**

#### 影响面（笔记 Consequences）

- 每个 `ShellExecutor` 消费者都迁移了：工具、hook runner、tmux-context、webworker 沙箱栈现在都说 `execute()`。
- `bash`/`pwsh` 工具描述与 `timeoutMs` schema 文本**依赖注册表是否存在**（模型可见）；输出联合类型多了 `promoted` 臂，前台臂多了可选 `stopped` reason——PTC system-prompt 快照已重录。
- **已注册的命令完全没有截止时间**：前台调用的 timeout 只界定等待；之后要停就靠 `job_kill` 或 Web 停止控件。
- Web 任务列表在每条前台命令运行时都显示它并通过 `job.list`/`job.follow` 流式传输；结算后带着结果离开。

---

### C6. workflow 获得 run_in_background

**笔记**：`.agents/notes/implemented/feature/2026-09-01-workflow-run-in-background.md`（本版新增）。

#### 问题

`workflow` 调用会**阻塞父轮**直到整个脚本结算：一次长编排（对数百个文件做审计扇出）在整个墙钟时间里把模型扣为人质——没法继续工作、人没有实时进度、取消是唯一出口。其他所有长时执行面（bash、pwsh、一次性子代理）都已经有通向 `ctx.jobs` 的 `run_in_background`。而且 `2026-09-01` 的记录合并**明确以「实时 workflow 叙述会作为后台记录 job 回归」为条件**删掉了前台 workflow 的活动镜像。

#### 决策

`workflow` 工具获得 `run_in_background: true`（由 `enableRunInBackground` 配置控制，**默认开**）：调用把这次运行注册为属主拥有的 `kind: 'workflow'` job 并立即返回 `{ kind: 'background', jobId, runId }`。

- **运行属于 job，不属于工具步骤**：引擎运行在 job starter 内启动且**没有 `exec.signal`**；`job_kill`、列表的停止控件、属主 teardown 是仅有的取消路径，各自把 reason 转发进 `run.cancel`。同步的引擎拒绝（meta/parse 失败）从 starter 抛出，于是什么都不注册，模型看到普通的可纠正错误。
- **结算就是 job 的结算**：`done` 从 `run.result` 串起——dispose（dispose 失败只告警、永不向注册表 reject）、停镜像、然后映射停止原因：`completed` 在 `JobOutcome.output` 里带与前台路径相同的渲染返回值；`cancelled` 结算为 `killed` 并把 detail 留给注册表的 kill-reason 合并；`error` 以脚本失败消息结算为 `failed`。
- **记录镜像取代被删的活动镜像**：`src/record.ts` 每插件订阅一次 `workflow/phase`、`workflow/log` 与成员生命周期事件，路由进被跟踪 run 的 `JobHandle` 面，写成与活动镜像相同的文本行，走 `log` 信道，**因此模型的 `job_output` 永不渲染它们**；`updateProgress` 跟踪当前阶段。没有 contained-error 包装：`append`/`updateProgress` 是非抛出面（结算后的 append 在注册表内部丢弃），掉队的事件找不到被跟踪的 run。
- **输出 schema 变成 `kind` 判别联合**（`background` | `foreground`），与 bash 同形；前台信封为对称也获得 `kind: 'foreground'`。
- **`workflow` 通过声明合并加入 `JobKindMap`**（`packages/workflow/tool-workflow/src/index.ts:35`），与 `pwsh`、`pty` 一样。

#### 被否决的方案

- **工具自身的 start/poll API**（`workflow_status` 伴生工具）：为单个生产者重复 `job_output`/`job_kill`，并让运行处在属主 teardown 与会话头列表之外。
- **把中间值流给模型**：workflow 的值就是脚本的唯一 return；每个 agent 的中间结果是脚本内部的（`log()` 通过记录为人叙述）。消费式模型游标会招来针对本质上「只有终值」的生产者的轮询循环。
- **把 `exec.signal` 桥进后台运行**：返回中的工具步骤被中止（轮次取消）会杀掉模型刚刚有意分离出去的工作；bash 的后台路径已经立了「只有注册表能取消」的先例。

#### 代价

后台运行的**值只在结算时到达**（此前 `job_output` 只返回状态）。快照树钉住了 schema、prompt 与 PTC stub 变更；重放完整后台运行的录制会话场景**被推迟**，并记录在包 README 的 limitations 里。

---

### C7. spill-policy：字节预算 → 多模态 token 预算

**笔记**：`.agents/notes/implemented/bug-fix/2026-09-21-multimodal-tool-result-retention.md`（本版新增）。相关提交：`ab102138c8 fix: retain ordered tool text and images within a token budget`、`5c1d966c3f`、`94728ebd23`、`b0be6e79c2`、`754733d5d1`、`9f34db2373`、`b74bef5d40`、`670a903237`。

#### 问题

MCP 在**纯渲染器**发出文本占位符的同时**异步**准备持久化图片。把已准备的内容装在 post-execute 策略**之后**，会让文本保留反过来使图片替换失效。而且纯字节上限**无法**比较文本与视觉输入的成本。

#### 决策

- **`ToolDefinition.projectContent` 在 post-execute 策略之前装好执行期准备的内容**。最终的 callback 为终端与 job 上限保留它自己独立的角色。策略的 block 与替换仍然具有最终权威。
- **策略按估算 token 给有序的文本/图片 block 计价**，复用文本估算器与**当前 route 的图片计算器**，**含描述符文本**（`spill-policy/src/index.ts` 的 `pricing()`）。
- **预留遗漏通知，把剩余 token 分给连续的头尾两端，省略中间**。文本可以在码点之间切分；图片在原位**不可分**。
- **完整溢出文件按顺序包含被接受的文本与可读的附件路径**。附件拥有图片字节。**缺图片计价或缺可读恢复路径时保留原结果并给出诊断。** PTC 程序值保持完整；转发与日志即使所有图片都被省略，也保留一条恢复通知。

#### 配置层面的破坏性变更（务必注意）

| 项 | 0.1.6-alpha.1 | 0.1.7-rc.1 |
|---|---|---|
| 字段名 | `maxInlineBytes` | **`maxInlineTokens`** |
| 单位 | UTF-8 字节 | 估算 token |
| 随包默认 | `50000` | **`12500`** |
| 图片结果 | 含任何非 text block 即**整体跳过策略** | 与文本共享同一预算 |
| 预览机制 owner | `@deepseek-ai/dsh-output-retention` 的 `TextRetainer` | **本包新增的纯函数 `retainContent`**（`src/retention.ts`） |

随包默认值的证据：

```
packages/bundle/base/cordis.patch.yml:409        maxInlineTokens: 12500
snapshots/session/multimodal-spill-ends/cordis.yml:36   maxInlineTokens: 1000
snapshots/session/parallel-tool-calls/cordis.yml:13     maxInlineTokens: !!js process.env.DSH_SNAPSHOT && 200 || 12500
```

**配置校验也换语义**：从 `Number.isInteger(maxInlineBytes) && >= 0` 改为 `Number.isSafeInteger(cap) && cap >= 0`，但**仍然是加载期失败**而不是逐调用失败——`spill-policy: maxInlineTokens must be a non-negative integer (got ${cap})`。

#### 结构变化

- 新增 `src/retention.ts`（**104 行**，纯函数，无 cordis、无存储依赖），导出 `retainContent` 与 `RetainableBlock`/`RetainedContent` 类型。它有独立的 `tests/retention.spec.ts`（70 行）。
- `src/index.ts` 从 227 行级别的纯文本策略重写为 156 行级别（diff 显示 307 行改动）；原来的两个辅助函数 `flattenPlainText`/`preview` 与 `spillReplacement` 全部消失，取而代之的是 `retainable()`/`pricing()`/`fullText()`/`bound()`。
- `src/notice.ts` 的 `formatSpillNotice` 增加第三个参数 `images = 0`，正文新增 ` Omitted ${images} images.`；`isOmission` 相应先剥离该句再校验字节计数——**历史（纯字节）通知与带图片计数的通知都能识别**，且不重写已记录文本。
- `tsconfig.json` 新增对 `../../attachment/attachment`、`../../fs/fs`、`../../llm/token-meter` 的引用。

#### 双臂（仍然两条）

1. **模型可见臂**：prepended `tools/post-execute`，先 `await next()` 再界定它接受的内容。跳过 `read`（避免 read → spill → read 循环）。PTC 子调用**仅当纯文本时**直接放行（「Text-only PTC bindings retain their asynchronous log-only spill path」）；带图片时走 `label: 'dispatch'`，并在「结果不是错误、原结果有图片、保留后已无图片」时把保留内容作为 `createUserMessage({ content: retained, source: { kind: 'ptc-mode' } })` 推入 `additionalContexts`。
2. **持久日志臂**：`tools/ptc-dispatch-log` 对日志副本施加**同一个** `bound()`。程序拿到的规范值不受影响。

#### 证据与快照

新增 `tests/multimodal.spec.ts`（220）、`tests/multimodal-recovery.spec.ts`（209）、`tests/retention.spec.ts`（70）；`tests/spill-policy.spec.ts`（193 改动）、`tests/notice.spec.ts`（+8）。快照新增 `snapshots/session/multimodal-spill-ends/` 与 `multimodal-spill-middle/`（后者只有 session/yml，没有 cordis 配置）。

#### 仍存的限制（README「Known Limitations」）

- **文本识别无法认证输出**：工具可以打印同样的通知文本；`hasSpillNotice` 识别的是文本约定，不是「策略确实存过」的证明。
- **恢复或计价不可用时**：图片需要 route 计算器与执行世界可读的附件路径，否则原内容保持可见；不支持的 block、被阻止的反馈、`read` 也都放行。
- **装不下的通知会为该调用禁用替换**：极小的 cap 或极长的 locator 会让超限原文留在行内，而 backend 已经存下一份无人引用的溢出文件。

---

### C8. fs.watch：fs 缝新增观察能力

**本版没有任何 note 覆盖这一项**——它是随 Web 侧栏资源自动刷新一起落地的（提交 `c71e907490 feat(web): watched sidebar resource refresh`、`cf9213ca5f`、`4f55590aea`、`a77250603c fix(fs): watch parent before acknowledging missing files`、`983b89f9a5 refactor(fs): default unsupported file watching`）。

#### 缝的变化

`FileSystem` 新增一个**有默认实现**的方法（`packages/fs/fs/src/index.ts:100`），默认 fail-closed 到 `FsError(..., 'FS_IO_ERROR')`。官方文档同步（`docs/subsystems/filesystem.md` +10 行，唯一一处本版新增的 catalog 条目）：

```ts
watch(target: FsTarget, changed: (error?: Error) => void, signal: AbortSignal): Promise<() => Promise<void>>
```

契约要点（JSDoc 逐条）：
- `target` 是**已解析**的文件或目录，**包括一个不存在的路径**（用于观察它的创建）；
- `changed` 是失效回调，错误可以在**初始化期间或之后**报告；
- `signal` **只取消 watcher 的初始化**；一旦初始化完成，调用者负责调用返回的**异步关闭函数**；
- provider 不支持观察或无法初始化时**抛出**。

#### fs-local 的实现

`packages/fs/fs-local/src/index.ts:69`，基于 chokidar：

```ts
override async watch(target: FsTarget, changed: (error?: Error) => void, signal: AbortSignal): Promise<() => Promise<void>> {
  signal.throwIfAborted()
  const path = resolve(this.processPath(target))
  const directory = (await this.stat(target, signal))?.type === 'directory'
  signal.throwIfAborted()
  const root = directory ? path : dirname(path)
  const watcher = watch(root, {
    ignoreInitial: true, depth: 0,
    ignored: entry => !directory && resolve(entry) !== root && resolve(entry) !== path,
  })
  watcher.on('all', (_event, entry) => { if (directory || resolve(entry) === path) changed() })
  watcher.on('error', (error) => { changed(error instanceof Error ? error : new Error(String(error))) })
  try {
    await once(watcher, 'ready', { signal })
    return () => watcher.close()
  } catch (error) {
    await watcher.close()
    throw error
  }
}
```

三点设计值得指出：**文件用「过滤过的父目录观察」**，所以 ready 也覆盖了「一个初始不存在的文件被创建」——这正是提交 `a77250603c` 修的东西（README 原文：「Files use a filtered parent-directory watch, so readiness also covers creation of an initially missing file」）；**`depth: 0`** 意味着只观察直接子项，不做递归；**OS 事件、不轮询**。

#### 消费方在本文范围之外

`packages/api/workspace-files/src/changes.ts:79` 是本版唯一的缝内消费者（`unwatch = await this.ctx.fs.watch(target, (error) => { … })`，并在 `:138` 的关闭路径里 `this.closing = this.initialized.promise.then(unwatch => unwatch?.())`）。`packages/api/home` 与 `packages/api/job-controller` 同属一个交付面，但不在本文包范围。

#### 证据与限制

- `packages/fs/fs-local/tests/watch.spec.ts`（**新增**，144 行）覆盖文件/目录两种目标、`ignoreInitial` 行为、ready 前取消、初始化失败。
- `packages/fs/fs/tests/service.spec.ts`（+8）断言未实现观察的 provider 以 `code: 'FS_IO_ERROR'` 拒绝。
- `packages/fs/fs-sandbox/README.md` 明确：**变更栅栏不限制观察**——「Reads, listings, metadata, and read-only watches work exactly as with `fs-local`; the mutation fence does not restrict observation.」这很重要：`fs-sandbox` 的 `watch` 是透传给底层 `fs-local` 的。
- **已记录限制**（`fs-local/README.md` Known Limitations）：**Linux 上父目录被删除再重建后的观察恢复被推迟**；父目录仍在的同路径文件重建是支持的。

---

### C9. attachment-local：sharp 惰性化

**本版无 note。** 提交：`232ab768a9 perf(runtime): defer optional native dependencies`。

`attachment-local` 此前在 `image.ts`、`normalization.ts`、`request-image.ts` 三个模块顶层 `import sharp from 'sharp'`。本版新增一个 7 行的模块：

```ts
// packages/attachment/attachment-local/src/sharp.ts
/** Process-realm lazy access to Sharp's CommonJS-compatible entry. */

import type sharp from 'sharp'
import { createLazyRequire } from '@deepseek-ai/dsh-lazy-require'

/** Load Sharp on the first raster operation and retain its callable export. */
export const requireSharp = createLazyRequire<typeof sharp>('sharp', import.meta.url)
```

三个模块改为 `import type { Sharp } from 'sharp'` + 在**真正要栅格化时**才调 `requireSharp()`：

- `image.ts`：`probeImage()` 与 `detectImage()` 各自在函数体第一行取 `const sharp = requireSharp()`；
- `normalization.ts`：`preparedPipeline()` 新增第一个形参 `sharp: ReturnType<typeof requireSharp>`，`normalizeImage()` 在确定需要重新编码**之后**才取（`if (canPassThroughNormalization(...)) return …` 的直通路径完全不加载 sharp）；
- `request-image.ts`：`sourcePipeline()` 内取。

**关键的正确性约束**由新测试 `tests/lazy-sharp-failure.spec.ts`（40 行）钉住：`sharp` 加载失败**不能被误分类**为「图像数据非法」或「编码失败」。测试用 `vi.mock('../src/sharp.ts', …)` 让 `requireSharp()` 抛错，然后断言：

- `probeImage`（头部探测）与 `detectImage`（完整解码）都 `rejects.toBe(state.failure)`——即抛出的是**原始错误对象本身**，而不是被 `catch` 重新包装成 `AttachmentError`；
- `normalizeImage` 也 `rejects.toBe(state.failure)`——**不**被归类为编码失败。

`package.json` 因此把 `@deepseek-ai/dsh-lazy-require` 加入 `dependencies`，`tsconfig.json` 新增对 `../../util/lazy-require` 的引用。

`docs/subsystems/attachment.md` 在区间内**未被修改**（`git diff --name-status … -- docs/subsystems/attachment.md` 无输出），本项是纯运行时加载时机优化。

---

### C10. ptc-runtime：仅保留 ELECTRON_RUN_AS_NODE 到 bootstrap

**本版 `packages/ptc-runtime/` 只有一处实质行为变更**（7 文件、+36/−34，其中 `src/index.ts` 仅 4 行改动）。提交：`a139e6e9e1 fix(ptc): preserve Electron Node mode when launching programs`、`a66d81e33f fix(ptc): limit Electron selector to startup and budget native tests`。

`ptc-runtime-node/src/index.ts:225` 附近的环境构造从：

```ts
const env: NodeJS.ProcessEnv = Object.fromEntries(Object.keys(process.env)
  .filter(key => !STARTUP_ENVIRONMENT_NAMES.has(key.toUpperCase()))
  .map(key => [key, undefined]))
```

改为额外**保留** `ELECTRON_RUN_AS_NODE`：

```ts
      // Electron needs its Node-mode selector until bootstrap; the child then removes it with other ambient values.
      const env: NodeJS.ProcessEnv = Object.fromEntries(Object.keys(process.env)
        .filter(key => !STARTUP_ENVIRONMENT_NAMES.has(key.toUpperCase()) && key.toUpperCase() !== 'ELECTRON_RUN_AS_NODE')
        .map(key => [key, undefined]))
```

包 README（中英同步）新增的表述是：**Host 仅在子进程启动时保留 `ELECTRON_RUN_AS_NODE`，使桌面端可执行文件运行 Node bootstrap；bootstrap 在求值模型代码前删除该选择变量。** 也就是「选择器只活到 bootstrap」，模型代码看到的 `process.env` 仍是空字典。测试 `tests/host-failures.spec.ts` 新增 `vi.stubEnv('ELECTRON_RUN_AS_NODE', '1')` 并断言 spawn 的环境里**没有**该键（同时保留原有 `TEMP`/`TMP` 被清空的断言）。

**关于「自 0.1.6 取代 code-runtime 后的本版演进」**：本区间内 `docs/subsystems/ptc-runtime.md` **未被修改**（`git diff --name-status dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- docs/subsystems/ptc-runtime.md` 无输出），`packages/ptc-runtime/ptc-runtime/` 只有 `package.json` 版本与依赖范围变更。**PTC 执行接缝的架构（`ctx.ptcRuntime` 抽象 + 沙箱化 Node 子进程、长度分帧 JSON 控制通道、输出账本）在本版区间内没有变化**；`packages/ptc-runtime/ptc-runtime-node/src/` 的 13 个源文件里只有 `index.ts` 被改。

**`packages/experimental/ptc-runtime-python` 存在**（属实验面，简述）：该包在 `dsh-v0.1.6-alpha.1` 就已存在（`git cat-file -e dsh-v0.1.6-alpha.1:packages/experimental/ptc-runtime-python/package.json` 成功），本区间内 diffstat 仅 **4 文件、+15/−15**：`package.json` 的版本与依赖范围、`src/index.ts` 的 2 处（`580bdc7258 refactor: remove redundant unknown casts`）、以及两个测试文件的对应改动。**本版没有为它引入任何新行为。**

---

### C11. workspace file binary transfer

**笔记**：`.agents/notes/implemented/architecture/2026-09-17-workspace-file-binary-transfer.md`（本版新增）。**实现主要在本文包范围之外**（`packages/api/workspace-files`、`packages/typert`、`packages/api/gateway`），这里只记录与本篇相关的边界。

#### 问题

文档预览需要原生字节。把文件内容编码成 base64 在压缩前就增加约三分之一载荷，还要求浏览器解码。另开一条 file Fetch 路由又会重复 Gateway 的方法分派、Session 查找与错误处理。

#### 决策要点

- **一条二进制 `readBytes` Remote**，由 workspace file service 暴露（`packages/api/workspace-files/src/index.ts:257`）。它的**必填 options 对象**独立地选择一个字节 `range` 与一个 `baseFile`（用于相对目标解析）；不给 `range` 就读完整文件。这样避免了为两个正交选择各开一个方法名，同时保留有界的 `fs.readBytes` 与 `fs.readByteRange` 读取（`index.ts:268`/`:273`）。
- **Typert 递归识别一元结果类型里的 `Uint8Array`**（含根值、可选字段、容器）：生成的 result codec 为可能含字节的子树提供 `encode()`，以及在不迭代/复制/冻结字节载荷的前提下校验重建值的 `decode()`；Client 声明把每个字节缓冲收窄为 `ArrayBuffer`。
- **Gateway 执行生成的编码器**，严格保持 JSON 值不变，并对 source-mode 调用做运行时字节检测；它返回 JSON 兼容元数据 + 结果相对的字节附件给 Connection。
- **Connection 拥有标准 `FormData` part** 并在 JSON 元数据里保留 RPC 信封与关联 id；它不检查业务值，也不依赖 Typert 反射。附件表通过 JSON 结果把字节 part 与路径关联；**字段名仍是业务所有**。
- Client 在 `Blob.arrayBuffer()` 上恢复 `Uint8Array` 视图；Gateway 把校验委托给生成的解码器。普通结果与错误仍走 JSON 响应。

#### 与本文包范围的交界

- **`fs` 侧没有新 API**：这篇笔记用的是**已有的** `fs.readBytes(target, signal, maxBytes)` 与 `fs.readByteRange(target, range, signal)`（`packages/fs/fs/src/index.ts:228` 附近的抽象成员）。本版 `packages/fs/fs/src/index.ts` 的全部改动只有 `+16` 行，且全部是 `watch()`（C8）与一处 `FsError` import。
- **Office 授权探测复用同一 Remote**，用一字节 range；转换后的 PDF 仍在单独的 Office Remote 里保持 base64 并使用它自己的有界解码器。
- **不做流式**：这不是流式预览，也不是零拷贝优化。
- 证据：`packages/api/workspace-files/tests/binary-rpc.spec.ts`（**本版新增**）。

---

### C12. omit fs payload invariant：本版仍是 proposed

**笔记**：`.agents/notes/proposed/simplification/2026-09-19-omit-fs-payload-invariant.md`。

**状态核实**：

```
git diff --name-status dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- .agents/notes
A  .agents/notes/proposed/simplification/2026-09-19-omit-fs-payload-invariant.{md,zh.md,i18n.yaml}

Test-Path packages/fs/fs/src/invariant.ts          → True（工作区）
git cat-file -e dsh-v0.1.7-rc.1:packages/fs/fs/src/invariant.ts → exit 0
```

**结论：这篇笔记在本版是 `proposed`（未接受），模块仍然存在。** 不能把它当作本版已落地的收敛来写。

#### 它提议什么

把 `packages/fs/fs/src/invariant.ts` 这个「仅校验载荷格式」的伴生模块**移除**：它只检查非空目标字符串、非空的 present version、以及一个 observation 判别式；它读取**一个** dispatch 载荷、不保留历史、不比较任何 provider/policy/文件系统或独立可变状态；它的测试直接构造畸形载荷。移除它能省下一个伴生模块、export/build 接线、invariant 依赖、编译器引用与专用测试。

#### 它暴露的政策冲突（笔记自己点明）

- `2026-08-28-omit-unneeded-invariant-companions.md` 要求**能够独立分歧的观察**；
- `2026-07-19-package-invariant-runtime-contracts.md` 又**具体举荐**了文件系统 target/version 有效性；
- 较晚的规则保留较早 note 的语义权威，所以**光靠时间顺序无法解决这个冲突**。笔记因此把「在仍然有效的主 note 里解决这条具名政策冲突」写进了 Acceptance criteria 的第一条：「do not claim this is already an uncontested mechanical omission」。

#### 提案主张的替代路线

按「独立观察」准则办事并移除该伴生模块，**保留**有类型的文件系统事件与真正的 observation-policy 消费者（`packages/fs/fs-observation-policy/src/index.ts`），以及 parser/wire/read/edit/write 在既有 owner 处的校验。若实现，需在两个 fs README 里加上该包特有的省略理由，并修订较早 note 中那条代表性检查行。

**风险（笔记原文）**：可信插件发出的畸形载荷会失去这个可选的早期诊断；移除该检查**不**构成放宽外部数据校验的理由，也**不**构成移除其他比较生命周期、持久历史或独立装配值的伴生模块的理由。

---

### C13. tool-present 迁出 packages/fs

`packages/fs/tool-present/` 在本版被**移动**到 `packages/deliverables/tool-present/`（提交 `f800ea46e5 refactor(deliverables): group tool-present and workspace-changes under packages/deliverables`）。`git diff --name-status -M` 把它识别为**重命名**，只有 `package.json` 是 A（新增）+ D（删除）成对的（内容改动超过相似度阈值）：

```
R054  packages/fs/tool-present/README.i18n.yaml      → packages/deliverables/tool-present/README.i18n.yaml
R085  packages/fs/tool-present/README.md             → packages/deliverables/tool-present/README.md
R085  packages/fs/tool-present/README.zh.md          → packages/deliverables/tool-present/README.zh.md
A     packages/deliverables/tool-present/package.json
R087  packages/fs/tool-present/src/index.ts          → packages/deliverables/tool-present/src/index.ts
R100  packages/fs/tool-present/src/types.ts          → packages/deliverables/tool-present/src/types.ts
R097  packages/fs/tool-present/tests/built-errors.e2e.ts → …
R100  packages/fs/tool-present/tests/present.spec.ts → …
R095  packages/fs/tool-present/tsconfig.json         → …
D     packages/fs/tool-present/package.json
```

**源码相似度 `R100`/`R097`/`R095`** 说明这是纯搬家加接线调整，**不是功能变化**。`packages/fs/README.md` 同步把「Eight packages」改成「Seven packages」并删掉该行（实测 `packages/fs/README.md`：3 行改动，中英各一份）。`tool-present` 的工具实现与测试归 `packages/deliverables` 那一篇。

---

### C14. 仓库级依赖范围与文档同步

本版 22 个 `package.json` 变更里，**绝大多数**是两类仓库级机械改动，不构成包行为变化：

1. **内部 DSH workspace 依赖从 `workspace:^` 改为 `workspace:*`**（提交 `37372101b5 build: pin internal DSH workspace dependencies`）；
2. **vendor/native 依赖改为 `workspace:~`**（提交 `4e6028a604 build: use tilde ranges for vendor and native workspaces`；规则 owner 是 `.agents/notes/implemented/process/2026-09-22-workspace-release-ranges.md`）。

本文范围内**只有以下 `package.json` 含真实依赖变化**：

| 包 | 真实变化 |
|---|---|
| `sandbox/sandbox-windows-acl` | 新增 `@deepseek-ai/dsh-lazy-require`（koffi 惰性化） |
| `attachment/attachment-local` | 新增 `@deepseek-ai/dsh-lazy-require`（sharp 惰性化） |
| `spill/spill-policy` | 依赖面随多模态保留变化（新增对 attachment/fs/token-meter 的引用，见 `tsconfig.json`） |
| `jobs/*`、`fs/*`、`ptc-runtime/*`、`spill/*`、`sandbox/*` | 均为版本号 + 范围规范化 |

`README.i18n.yaml`（15 文件）是双语文档配对的哈希记录，随各自 README 变更而更新。`tsconfig.json`（5 文件）的新增引用已在前文各条逐一点出。

#### 官方文档的区间变更（实测 `git diff --stat … -- docs/subsystems/…`）

| 文档 | 变更量 | 本版内容 |
|---|---|---|
| `docs/subsystems/jobs.md` | **461 行** | 整体重写为收敛后的缝；页首「设计 owner」从 `2026-06-20-generic-long-running-tool-runtime` 改为 `2026-09-03-jobs-seam-consolidation`，后者 own 当前设计、前者 own 其起源；`JobSnapshot` → `JobView`；新增 `JobSpec`/`JobHandle`/`JobEvents`/`JobEventFilter` 的镜像 |
| `docs/subsystems/workspace.md` | **215 行** | 新增 `Default Workspace initialization`、`Session pinning`、`Archive admission` 与两个 `workspace/*` 事件小节 |
| `docs/subsystems/filesystem.md` | **+10** | `FileSystem.watch` 的 catalog 条目（C8） |
| `docs/subsystems/sandbox.md` | **2** | `partial` 的当前案例列表改为 hard-link / unconfined-read / AppContainer-ACL（C1） |
| `docs/subsystems/spill.md` | **2** | `over-maxInlineBytes plain-text final result` → `over-maxInlineTokens text/image result` + 「ordered head/tail content and a spill address」（C7） |
| `docs/subsystems/attachment.md` | **0** | 区间内未被修改 |
| `docs/subsystems/ptc-runtime.md` | **0** | 区间内未被修改 |

---

## 附录：本版提交索引

以下哈希均为 `git log --oneline dsh-v0.1.6-alpha.1..dsh-v0.1.7-rc.1 -- <paths>` 实测输出，可直接 `git show <hash>` 复核。

### sandbox（31 文件、+1673/−387）

| 提交 | 主题 |
|---|---|
| `d5ad3baeb5` | fix(sandbox): confine Windows deletes with a Low integrity label |
| `36e632751e` | fix(sandbox): deny the ambient parent-delete right inside granted roots |
| `3d5ba3b83f` | fix(sandbox): scope the delete deny to containers, clearing the review round |
| `7450e1eb24` | docs(sandbox): tighten the comments added by the delete-confinement fix |
| `688d7b694b` | test(sandbox): drop the host-dependent whoami integrity assertion |
| `4753e45f95` | test(sandbox): probe cmd's own > NUL redirection |
| `e553344063` | test(sandbox): drop new unknown casts after the merge-forward |
| `61c548e200` | fix(sandbox): accept repeated effective permission modes |
| `f8b1309fe5` | fix(subprocess): hide Windows shell console windows at creation |
| `232ab768a9` | perf(runtime): defer optional native dependencies |
| `580bdc7258` | refactor: remove redundant unknown casts |

### jobs（32 文件、+3451/−1188）

| 提交 | 主题 |
|---|---|
| `51f74910ae` | feat(jobs): human job kill with an unclaimed terminal report |
| `8f3103b511` | fix(jobs): address review — error scoping, subagent fence, pending kill |
| `4a79310339` | feat(activity): optional live-output observation seam with a web viewer |
| `e580c0b333` | feat(jobs): fold the streaming observation record into the job registry |
| `3c79e71cdc` | docs(i18n): mirror the record refactor across the bilingual pairs |
| `b48c05d117` | refactor(jobs): type the producer face by the record declaration, tidy review residue |
| `07941fe5e2` | refactor(jobs): consolidate the seam into JobSpec, VisibleJobs, and one event stream |
| `1b97207150` | refactor(jobs-local): extract the output ring and the registry-owned pump |
| `f55e9805c7` | refactor(jobs-local): one ring, two cursors, and event routing |
| `6626c74dbc` | refactor(jobs-local): contain a throwing pull source instead of freezing the job |
| `0e35952802` | refactor(tool-jobs): render model reads from the ring and own the notice ledger |
| `cbb0ec0296` | docs(jobs): describe the consolidated seam |
| `7b607ae6a2` | fix(tool-jobs): build the notice status line from the public projection |
| `9e8f3ce987` | fix(tool-jobs): restore the background-job guidance text |
| `08a51f6d88` | fix(tool-jobs): keep the agent registry optional |
| `2c0ca45f76` | fix(jobs): carry the projection kind as an open string on the wire |
| `0712a4cc68` | fix(jobs-local): keep unconsumed settled output for the model and announce registration first |
| `9f0600d11b` | fix(tool-jobs): count wait claims per call |
| `e680fbc3a0` | refactor(jobs): check the announced event protocol in the invariant companion |
| `80bbdba617` | fix(jobs): restore the dropped-output notice with its spill files for the model |
| `8bcd6f7519` | refactor(jobs): rename visibleTo/VisibleJobs to forCaller/CallerJobs |
| `4baea3bb83` | fix(jobs): spill paths as source metadata, live wait claims, narrower entries |
| `761282724b` | fix(jobs): constant pump waits, quiescent client disposal, record flag on the roster |
| `7ec142a325` | refactor(jobs): move job observation into api-job-controller |
| `30b882a1b2` | fix(jobs): keep client detail tests on the pure renderer |
| `3df99217dc` | refactor(jobs): restore direct calls and align remote names |
| `bb20149360` | refactor(shell): register foreground commands as jobs at start and drop the promotion protocol |
| `cbae324bfa` | feat(workspace): stop a Session's running work before archiving it (#4765) |
| `b6775f6d4f` | fix(tool-jobs): wake an idle owner for every completion by default |
| `2d653be7b0` | fix(tool-jobs): address review on the unbounded wake default |

### spill（21 文件、+968/−376）

| 提交 | 主题 |
|---|---|
| `ab102138c8` | fix: retain ordered tool text and images within a token budget |
| `5c1d966c3f` | test: cover image recovery failures and snapshot registration |
| `b0be6e79c2` | fix: preserve failed PTC image result forwarding semantics |
| `754733d5d1` | test: update shell spill snapshot for the shared token budget |
| `94728ebd23` | fix: repair multimodal retention CI resolution and coverage |
| `9f34db2373` | test(spill-policy): await observed spill and dispatch stages |
| `b74bef5d40` | test: exercise image recovery and real PTC retention |
| `670a903237` | test: clarify parallel recovery fixture cleanup |

### fs（37 文件、+376/−834）

| 提交 | 主题 |
|---|---|
| `c71e907490` | feat(web): add watched sidebar resource refresh |
| `cf9213ca5f` | fix(sidebar): finalize resource auto-refresh behavior and tests |
| `19d1f87492` | fix(sidebar): satisfy lint and documentation checks |
| `4f55590aea` | fix(sidebar): correct automatic refresh and watch lifecycles |
| `a77250603c` | fix(fs): watch parent before acknowledging missing files |
| `7e09291f15` | fix(sidebar): preserve expansion during directory restoration |
| `983b89f9a5` | refactor(fs): default unsupported file watching |
| `f800ea46e5` | refactor(deliverables): group tool-present and workspace-changes under packages/deliverables |
| `f937f4e23b` | feat(web): record turn file changes with git snapshots and render the changed-files card |
| `0f8457a017` | feat(workspace-changes): record only git repositories and add the recorded card scenario |
| `d6634272d5` | feat(workspace-changes): keep snapshot objects in a private store under the Harness home |
| `8ea92ce9b5` | fix(workspace-changes): count argument-derived hunks, isolate per-turn state, and harden git handling |
| `86a1bf1e80` | fix(workspace-changes): resolve canonical paths lazily and make the tests portable |
| `3010cb3dba` | fix(workspace-changes): resolve the types subpath to source and complete exported JSDoc |
| `c8bc10440b` | fix(workspace-changes): review round on the served summaries |

### ptc-runtime（7 文件、+36/−34）与 attachment（8 文件、+80/−19）

| 提交 | 主题 |
|---|---|
| `a139e6e9e1` | fix(ptc): preserve Electron Node mode when launching programs |
| `a66d81e33f` | fix(ptc): limit Electron selector to startup and budget native tests |
| `232ab768a9` | perf(runtime): defer optional native dependencies |

### 全组共同

| 提交 | 主题 |
|---|---|
| `a60af51e80` | release(dsh): 0.1.7-rc.1 |
| `10ea83bcc3` | release(dsh): 0.1.7-alpha.2 |
| `112ce776ac` | release(dsh): 0.1.7-alpha.1 |
| `6b1808f432` | release(dsh): 0.1.6-alpha.2 |
| `37372101b5` | build: pin internal DSH workspace dependencies |
| `4e6028a604` | build: use tilde ranges for vendor and native workspaces |
| `580bdc7258` | refactor: remove redundant unknown casts |

---

### 未核实项（如实列出）

1. **`docs/subsystems/ptc-runtime.md` 的「区间变更」为「无」**：本文的结论建立在 `git diff --name-status dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- docs/subsystems/ptc-runtime.md` **无任何输出**之上。任务简报提到「核实 `docs/subsystems/ptc-runtime.md` 的变更」——**实测该文件在本区间未被修改**，因此无可展开的变更。若期望的「变更」指的是 0.1.6 区间（`code-runtime` → `ptc-runtime` 改名），那不在本文基线内。
2. **notes 中 `2026-09-01-jobs-absorb-activity-record` 与 `2026-09-03-jobs-seam-consolidation` 的新增状态**：已实测确认两者的 `.md` 均为 **A**，确属本版。任务简报的「可能属 0.1.6 区间」的提示不成立。
3. **`packages/sandbox/sandbox-windows-acl` 的测试未能实际执行**：本篇所有关于 Windows ACL 行为的断言来自源码、包 README、Agent Note 与提交信息，**没有在本机跑过 `runner.spec.ts`/`acl.spec.ts`**（需要 Windows 受限令牌与真实 runner；且本会话是文档撰写任务，不应触发实际关押测试）。笔记中的「本机实测」数字（如 Untrusted 令牌下 `pwsh` 失败于 `0x8007045A`）是**引用原文**，不是本文的复现结果。
4. **`JSON.stringify` 的 `Object.fromEntries` 环境构造在 Electron 下的实际效果未核实**：C10 只核到源码改了什么、README 怎么描述、测试断言了什么；未在 Desktop 打包环境下实测。
5. **`spill-policy` 的 `imageRequestPricing` 在有图片但 route 未定的调用上的实际行为**：源码路径是 `provider === undefined || model === undefined → calculator = undefined → throw new Error('the current model has no image token calculator')`，被外层 `catch` 转为 warn 并保持原内容。**「无 agent 的直调/测试调用是否普遍触发这条路径」未核实。**
6. **多模态保留的语义与 12 500 默认值之间的实测收益**：笔记写「The shipped result budget is 12,500 estimated tokens, replacing the former 50,000-byte setting」，我核到了 `packages/bundle/base/cordis.patch.yml:409` 的值，但**没有实测 12 500 token 与 50 000 字节在真实会话上的等价性或差异**。
7. **`docs/subsystems/workspace.md` 的 215 行变更中与 jobs 无关的部分**：本文只核到新增的小节标题与 jobs 归档准入挂接的两个事件；`Default Workspace initialization` 与 `Session pinning` 的正文属 workspace 包，本文未逐行阅读。
8. **`docs/subsystems/attachment.md` 与 `packages/attachment/attachment-local/README.md` 的区间状态**：前者实测未被修改；后者的 diff 未在本文逐条引用（只引用了新增 `sharp.ts` 的 7 行内容与新测试）。
