# 【第 11 篇】packages/api · sdk · acp · mcp · webhook：协议、远端与 SDK

> **基线说明**：本篇为 v0.1.7-rc.1 全量分析基线，rc.2 未改动本篇覆盖的系统性结构。v0.1.7-rc.2 的增量变更（约 335 个提交）请见同目录 `README.md` 与 `diff-vs-0.1.7-rc.1.md`。

> **版本**：dsh-v0.1.7-rc.1（`46a7f68b09`），对比上版 dsh-v0.1.6-alpha.1（`0a15e36e7f`）
> 难度：🟡 进阶（建议先读 `docs/api-gateway.md` 与 v0.1.6-alpha.1 的第 11 篇）
> 包范围：`deepseek-harness/packages/api/`（9 包）、`packages/sdk/`（3 包）、`packages/acp/`（1 包）、`packages/mcp/`（2 包）、`packages/webhook/`（2 包），外加 `python/`（Python SDK 与单文件 runtime）
> 上游文档：`docs/api-gateway.md`、`docs/subsystems/web-server.md`、`docs/subsystems/session-reference.md`、`docs/user/guide/python-sdk.md`、`docs/cookbook/adding-a-remote-api.md`、`packages/api/*/README.md`

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
  - [11.1 远端双工流：一条流、一条上行通道、一个调用上下文](#111-远端双工流一条流一条上行通道一个调用上下文)
  - [11.2 宿主独占远端输入校验](#112-宿主独占远端输入校验)
  - [11.3 工作区文件二进制传输](#113-工作区文件二进制传输)
  - [11.4 web 特性路由与路由门](#114-web-特性路由与路由门)
  - [11.5 API gateway 与控制器组](#115-api-gateway-与控制器组)
  - [11.6 SDK（TypeScript）](#116-sdktypescript)
  - [11.7 MCP](#117-mcp)
  - [11.8 acp 与 webhook](#118-acp-与-webhook)
  - [11.9 Python SDK 与单文件 runtime](#119-python-sdk-与单文件-runtime)
  - [11.10 与任务前提的三处偏差（已核实）](#1110-与任务前提的三处偏差已核实)
- [附录：本版提交索引](#附录本版提交索引)

---

## 引言

本文覆盖 DSH 的**边境面**：`packages/api/`（进程间 / 浏览器与宿主之间的 Remote 协议与 BFF 控制器）、`packages/sdk/`（面向外部宿主进程的 JSON-RPC SDK）、`packages/acp/`、`packages/mcp/`、`packages/webhook/`，以及 `python/`（官方 Python SDK 与单文件 runtime 包装）。

这一层的职责可以用一句话概括：**把「宿主内部的能力」翻译成「跨进程、跨机器、跨语言都可校验的协议」**。因此本层的每一次改动都会同时牵动三处：wire 类型、两端校验强度、以及破坏性变更的传播面。

本版是这一层自 0.1.6 以来动作最大的一次。量化基线（全部由 `git diff` 实测）：

```powershell
git diff --stat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/api packages/sdk packages/acp packages/mcp packages/webhook python
#  → 245 files changed, 16884 insertions(+), 5566 deletions(-)
```

按目录拆分（同一条 base/head）：

| 目录 | 文件数 | 增 | 删 |
|---|---|---|---|
| `packages/api` | 197 | +15890 | -5209 |
| `packages/sdk` | 7 | +56 | -50 |
| `packages/acp` | 8 | +61 | -49 |
| `packages/mcp` | 9 | +115 | -47 |
| `packages/webhook` | 7 | +50 | -49 |
| `python` | 17 | +712 | -162 |

提交量（`git log --oneline dsh-v0.1.6-alpha.1..dsh-v0.1.7-rc.1 -- <上述路径>`）：

| 计数 | 值 |
|---|---|
| 提交行数（含 merge） | **336** |
| 其中非 merge | **183** |
| 区间内新增包 | `packages/api/account-controller`、`packages/api/job-controller`（两者在 `dsh-v0.1.6-alpha.1` 下均不存在，实测 `git cat-file -e` 失败） |

一句话总结本版：**Remote 从「单向请求 + 单向流」升级为「每条流自带一条上行通道」**，同时把客户端侧重复的输入校验彻底删除，把二进制结果送进 Remote 结果类型，并把「浏览器代码里的路由必须是文档相对路径」变成一道可执行的静态门。

---

## 概述

本层的五个子面各自回答一个不同的问题：

| 子面 | 回答的问题 | 本版是否有协议级变更 |
|---|---|---|
| `packages/api/gateway` | 一个 Remote 方法调用如何在 Host 与 Client 之间被解析、校验、派发、取消？ | **有**（上行通道、输入校验收权、`appReady` 门） |
| `packages/api/remotes` | 本应用到底选择挂载哪些业务 Remote 贡献？ | **有**（新增 5 个贡献，去掉 1 个旧名） |
| `packages/api/*-controller` | 每个业务域自己的 Remote 命名空间与 wire 类型 | **有**（两新增包 + 四个包大改） |
| `packages/sdk` | 外部宿主进程如何用换行分隔 JSON-RPC 驱动一次任务？ | 极小（类型断言清理 + 一处负载拷贝） |
| `python/` | 官方 Python 客户端与单文件 runtime 如何交付？ | **有**（资源校验与 Office sidecar，与协议无关） |

`acp`、`mcp`、`webhook` 三组本版均为小改动：`acp` 是字段结构跟进 + 类型断言清理，`mcp-client` 是「保留有序文本与图像」的投影时机修正，`webhook` 是 `agent-presets` → `agent-preset-registry` 更名跟进与 preset scope 获取方式变更。它们都没有引入新的 wire 契约。

---

## 核心概念

| 术语（首次出现附英文） | 含义 | 本版是否受影响 |
|---|---|---|
| Remote 方法（Remote method） | `@Remote` 标记的业务方法；`@Remote({ mode: 'stream' })` 为流方法 | **流方法新增上行** |
| 下行（downlink） | Host → Client 的 `item` 序列，以 `end` 或 `error` 终止 | 未变 |
| 上行（uplink） | **本版新增**：Client → 正在运行的 Host 方法 的 `item` 序列，以 `end` 半关闭 | **新增** |
| 逻辑流 / 物理载体（logical stream / carrier） | 逻辑流是「一个 `streamId` + 一代连接」；物理载体是 WebSocket 或 in-process Connection | 未变，但语义被明确 |
| 代（generation） | 一条逻辑流的**一次**物理生命；断线即失败，重开属于上层 | 本版被写成显式术语 |
| 调用上下文（`RemoteInvocation`） | 方法通过 `this.ctx.invocation` 读到本次调用的 `request` / `service` / `peer` / `signal` / `uplink()` | **新增** |
| Peer / `PeerScope` | 一次调用「代表谁说话」；本版每条流都绑定一个 Peer | **新增** |
| 输入编解码器（input codec） | 描述符携带的严格 Zod 编解码器；本版**只在 Host 执行** | **行为变更** |
| 二进制附件（byte attachment） | `Uint8Array` 结果字段被投影成 `FormData` 部件 + JSON 元数据 | **新增** |
| 路由门（route gate） | `scripts/verify-client-route-resolution.ts`，静态拒绝绑定单一挂载点的浏览器路由 | **新增** |

---

## 包结构

`packages/api/` 下 9 个包、`packages/sdk/` 下 3 个、`packages/acp/` 下 1 个、`packages/mcp/` 下 2 个、`packages/webhook/` 下 2 个（`Get-ChildItem <group> -Directory` 实测），全部包版本统一为 `0.1.7-rc.1`。

### packages/api/（9 包）

| 包 | 职责 | 本版改动规模（`git diff --shortstat`） |
|---|---|---|
| `account-controller` | **新增**：`account` 命名空间的登录命令与可重连账户快照 | 8 files, +314（纯新增） |
| `gateway` | Remote 分发、校验、取消、流多路复用 | 21 files, +3139 / -396 |
| `job-controller` | **新增**：`job` 命名空间的会话作业名册流、单作业观察流、人工 kill | 23 files, +2633（纯新增） |
| `remotes` | 应用级 Remote 贡献装配（Host 门面 + Client 组装） | 11 files, +189 / -127 |
| `session-controller` | Agent / Session 身份策略、命令、投影、传输 | 65 files, +5367 / -3011 |
| `settings-controller` | `settings` 与 `credentials` 命名空间 | 8 files, +108 / **-516** |
| `terminal-controller` | `terminal` 命名空间：保留、附着、输入、缩放 | 21 files, +1246 / -180 |
| `workspace-controller` | `workspace` 命名空间与工作区注册表投影 | 18 files, +875 / -61 |
| `workspace-files` | `workspaceFiles` 命名空间：文本页、二进制读、目标级监听 | 19 files, +2009 / -910 |

（9 包合计 194 个文件；`packages/api` 另有 3 个组级 README 文件，合计 197，与目录级 `--shortstat` 一致。）

### 其余包组

| 包 | 职责 | 本版改动规模 |
|---|---|---|
| `sdk/client` | SDK 客户端（进程驱动、会话/事件投影） | 4 files（2 个 src 断言清理 + 版本） |
| `sdk/protocol` | 换行分隔 JSON-RPC 共享 wire 协议 | 仅 `package.json` |
| `sdk/server` | 宿主侧 JSON-RPC 服务器 | `src/server.ts` +6/-2 |
| `acp/acp` | 仅自动化用途的 ACP 桥 | 8 files, +61/-49（`codec.ts`、`index.ts`、`updates.ts`） |
| `mcp/mcp-client` | 外部 MCP 工具桥 | 7 files（`src/index.ts`、`src/tools.ts` + 测试） |
| `mcp/mcp-resources` | MCP 资源读取 | 仅 `package.json`（无 src 改动） |
| `webhook/webhook` | Webhook 入站运行时 | 4 files（`src/index.ts`、`src/session.ts` + 测试） |
| `webhook/webhook-github` | GitHub webhook 适配器 | 仅 `package.json` |

---

## 关键类型

**片段 A：`RemoteStream<Out, In>` 与 `RemoteStreamHandle<Out, In>`（本版新增的核心类型）**

文件：`packages/typert/protocol/src/types.ts:80-124`（注意：`packages/typert` 不在本篇包范围内，但本篇所有 Remote 类型都从它导出，属上游依赖）。

```ts
declare const STREAM_UPLINK: unique symbol

export type RemoteStream<Out, In = never> = AsyncIterable<Out> & { readonly [STREAM_UPLINK]?: In }

export interface RemoteStreamHandle<Out, In> extends AsyncIterable<Out> {
  send(item: In): void
  end(): void
  dispose(): void
}
```

要点：`In` 默认 `never`，表示「该方法不读上行」，此时描述符不带上行编解码器；`STREAM_UPLINK` 只在类型层携带，运行时不存在。

**片段 B：`RemoteInvocation`（方法如何读到本次调用）**

同文件 `:375-410`，导出 `PeerId`（`Branded<'PeerId'>`）、`PeerScope`、`RemoteInvocation`；`packages/typert/protocol/src/types.ts:700` 把 `ctx.invocation` 声明为 `RemoteInvocation | undefined`。

Gateway 侧的实现类在 `packages/api/gateway/src/index.ts:1295-1339`：

```ts
class GatewayInvocation implements RemoteInvocation {
  private decoder: UplinkDecoder | undefined
  private taken = false

  uplink<In = unknown>(): AsyncIterable<In> {
    if (this.taken) {
      throw new Error(`typert gateway: ${this.uplink_.endpoint}: invocation.uplink() is available once per call`)
    }
    this.taken = true
    const { source, codec, endpoint, abort } = this.uplink_
    this.decoder = new UplinkDecoder(source, codec, endpoint, this.signal, abort)
    // The descriptor codec decides what arrives; `In` is the caller's assertion.
    return this.decoder as AsyncIterable<In>
  }
}
```

**片段 C：Gateway 配置新增 `streamInboxBytes`**

`packages/api/gateway/src/index.ts:144-155`、`:200-204`：

```ts
export interface Config {
  /** WebSocket Ping interval from 1 through 2,147,483,647 milliseconds. @default 2000 */
  readonly websocketHeartbeatIntervalMs?: number
  /** Buffered uplink frame bytes one logical stream may hold before it fails with `gateway/uplink-overflow`. @default 262144 */
  readonly streamInboxBytes?: number
}
```

默认常量在同文件 `:137`：`const DEFAULT_STREAM_INBOX_BYTES = 262_144`。

**片段 D：uplink wire 帧（本版新增的两个客户端消息）**

`packages/api/gateway/src/stream-protocol.ts:234-243`：

```ts
export type RemoteStreamClientMessage =
  | { readonly type: 'open'; readonly streamId: string; readonly endpoint: string; readonly payload: unknown }
  | { readonly type: 'item'; readonly streamId: string; readonly value?: unknown }
  | { readonly type: 'end'; readonly streamId: string }
  | { readonly type: 'cancel'; readonly streamId: string }
```

同一文件 `:264-288` 的 `parseRemoteStreamClientMessage` 用 `exactKeys` 精确匹配键集，并用 `isRemoteJsonValue` 校验 `value`（顶层 `undefined` 走「无 `value` 键」的合法分支）。

**片段 E：`UplinkInbox`（Host 侧有界上行队列）**

`packages/api/gateway/src/stream-server.ts:303-345`：

```ts
class UplinkInbox implements AsyncIterable<unknown>, AsyncIterator<unknown> {
  push(value: unknown, frameBytes: number): void {
    if (this.failure !== undefined || this.closed) return
    if (this.ended) { this.violate(new RemoteError('gateway/protocol', ...)); return }
    if (this.bytes + frameBytes > this.maxBytes) {
      this.violate(new RemoteError('gateway/uplink-overflow', ...)); return
    }
    this.queue.pushBack({ value, bytes: frameBytes })
    this.bytes += frameBytes
    this.signal()
  }
}
```

**片段 F：新错误码（声明合并）**

`packages/api/gateway/src/remote-error-codes.ts`（本版 +2 行）：

```ts
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    'gateway/protocol': TypertGatewayFaultDetails
    'gateway/uplink-overflow': TypertGatewayFaultDetails
  }
}
```

**片段 G：`WorkspaceByteReadOptions`（二进制读的选项对象）**

`packages/api/workspace-files/src/types.ts`：

```ts
/** Target resolution and optional byte range for one binary file read. */
export interface WorkspaceByteReadOptions {
  readonly range?: WorkspaceByteRange
  readonly baseFile?: string
}

export interface WorkspaceFileBytes<Data extends Uint8Array = Uint8Array> extends WorkspaceFileStat {
  readonly offset: number
  readonly data: Data
  readonly eof: boolean
}
```

对比上版：上版有 `readBytes(path, range)`、`readAll(path)`、`readRelated(path, relativePath)` 三个方法，`data` 是 base64 字符串；本版合并为一个 `readBytes(path, options)`，`data` 是 `Uint8Array`。

**片段 H：`job` 命名空间的真实方法集**

`packages/api/job-controller/src/index.ts` 只有 3 个 Remote 方法：`list`（`@Remote({ mode: 'stream' })`，`:75`）、`follow`（`@Remote({ mode: 'stream' })`，`:90`）、`kill`（`@Remote('kill')`，`:109`）。**没有** `attach`，**也没有** `JobInputFrame` 这个标识符（全仓 `Select-String 'JobInputFrame'` 命中 0 条）。duplex note 里的 `job.attach(request): RemoteStream<JobFollowFrame, JobInputFrame>` 是**示意伪代码**，不是本版落地的 API。

---

## 数据流

### 一元调用（本版语义：Client 不解析，Host 独占校验）

```
Client 业务代码
  └─ ctx.remote.<ns>.<method>(args…)
       ├─ ClientRemote.prepareInvocation()          packages/api/gateway/src/client/index.ts:486
       │    ├─ 位置参数个数检查（含可选末尾 AbortSignal）
       │    ├─ 构造 descriptor 的精确具名 args；undefined 的可选值不写入
       │    ├─ 绑定 scoped Context 身份（args[projection.wire] = identity）
       │    └─ signal = AbortSignal.any([mount, callerSignal])
       │    ★ 本版不再执行任何 invocation codec 工厂
       ├─ connection.rpc.call('/api', endpoint, { args }, signal)
       │    └─ HTTP POST /api/<namespace>/<method>
       └─ Host Gateway.dispatchRpc()
            ├─ 精确具名字段匹配 + 严格参数/身份 codec + JSON 值校验
            ├─ lookup / Context 解析（Session Controller 提供 agent/session 策略）
            ├─ 调用业务方法（receiver 绑定到携带 invocation 的 Context）
            └─ 结果投影：有 encode() 走生成编解码器，否则保持严格 JSON；Uint8Array 走二进制附件
```

### 双工流（本版新增）

```
Client                                        Host
  ClientStreamHandle(this.uplink = ClientUplinkQueue)
   ├─ 构造即 downlink.next()  → 触发 open 帧（保证 open 先于任何 item 上线）
   ├─ send(item)  → 校验 isRemoteUplinkItem → queue.push
   ├─ end()       → queue.end()               （半关闭）
   └─ dispose()   → queue.close() + abort 该代 + downlink.return()
                                                  │
  RemoteStreamMuxClient.open(endpoint,payload,signal,uplink)
   ├─ 发送 { type:'open', streamId, endpoint, payload }
   └─ pumpUplink: 逐项 { type:'item', streamId, value }，源结束发 { type:'end' }
        ├─ stop() 中断阻塞在 next() 的泵并释放迭代器
        └─ 源抛错 → inbox.fail(error)（下行以该错误失败）
                                                  │
                                                  ▼
  RemoteStreamMuxServer（WebSocket /api/remote.mux）
   ├─ 逐帧 parseRemoteStreamClientMessage
   ├─ item  → UplinkInbox.push(value, frameBytes)
   ├─ end   → UplinkInbox.end()
   ├─ cancel→ control.abort(...)
   └─ 打开逻辑流：openWireStream(...) → RemoteStreamOpener
                                                  │
  TypertGatewayService.gatewayInvocation
   ├─ 方法读 this.ctx.invocation.uplink<In>()
   │    └─ UplinkDecoder：有 codec 逐项 decode(codec, value, endpoint, 'uplink')
   │         解码失败 → control.abort(failure) → 整条流以 gateway/input-invalid 失败
   └─ 下行：cancellableStream(source, endpoint, invocation)
        finally 先 await invocation.close()（关上行），再 await iterator.return?.()
```

### 二进制结果（本版新增）

```
Host 业务方法返回 { data: Uint8Array, … }
  └─ Gateway 执行生成编码器 / SRC 递归字节探测
       ├─ JSON 兼容元数据（字段名由业务拥有）
       └─ 结果相对字节附件表
            └─ Connection：标准 FormData 部件 + JSON 元数据（保留 RPC 信封与 correlation id）
                 └─ Client：Blob.arrayBuffer() 上重建 Uint8Array 视图
                      └─ 生成解码器校验（不迭代、不拷贝、不冻结字节）
```

---

## 测试覆盖

包级测试文件数（`Get-ChildItem -Recurse <dir> -File | Where-Object { $_.FullName -match '\\tests\\' }`）：

| 目录 | tests 文件数 |
|---|---|
| `packages/api` | 95 |
| `packages/sdk` | 10 |
| `packages/acp` | 12 |
| `packages/mcp` | 17 |
| `packages/webhook` | 8 |

本版新增/删除的测试（`git diff --name-status`，仅列状态为 `A`/`D` 的）：

| 文件 | 状态 | 覆盖对象 |
|---|---|---|
| `packages/api/gateway/tests/echo-stream.host.spec.ts` | **A**（96 行） | 「最小的、真的读上行的 Remote 流」在两种载体（in-process / WebSocket）上的行为 |
| `packages/api/workspace-files/tests/binary-rpc.spec.ts` | **A**（93 行） | 二进制 RPC 往返 |
| `packages/api/session-controller/tests/archived-session-gate.host.spec.ts` | **A** | 归档会话准入门 |
| `packages/api/session-controller/tests/inbox-projection.client.spec.ts` | **A** | Client 侧 inbox 投影 |
| `packages/api/session-controller/tests/reference-ownership.client.spec.ts` | **A** | Session 引用归属 |
| `packages/api/session-controller/tests/subagent-catalog.host.spec.ts` | **A** | 子代理目录 |
| `packages/api/terminal-controller/tests/retention.spec.ts` | **A** | Host 保留窗口与空闲回收 |
| `packages/api/terminal-controller/tests/retention.client.spec.ts` | **A** | 窗口 hold 流 |
| `packages/api/terminal-controller/tests/bindings.client.spec.ts` | **A** | 视图↔终端身份绑定持久化 |
| `packages/api/workspace-controller/tests/default-directory.host.spec.ts` | **A** | 首次使用工作区目录解析 |
| `scripts/verify-client-route-resolution.spec.ts` | **A**（199 行） | 路由门自身的正/负例 |
| `python/sdk/tests/test_runtime_resolution.py` | **A**（129 行） | 无密钥的 runtime 资源解析与校验 |
| `python/sdk/tests/test_release_version.py` | **A**（79 行） | 发布版本一致性 |
| `packages/api/session-controller/tests/control-jobs.host.spec.ts` | **D** | 随作业名册迁出 `session-controller` 而删除 |
| `packages/api/session-controller/tests/queue-store.client.spec.ts` | **D** | 随 `queue-mirror.ts` 删除 |

按改动行数排序，测试侧最大的三处是 `gateway.client.spec.ts`（+797/-…）、`gateway-stream.host.spec.ts`（+700）、`workspace-files/tests/changes.spec.ts`（+908）。

`packages/api/remotes/tests/built-lib.e2e.ts` 的改动值得单列：它把断言从 `invalidRejected: true`（客户端自己拒绝非法参数）改成

```ts
invalidResult: { ok: false, error: { code: 'gateway/input-invalid' } }
```

即**非法参数现在由 Host 拒绝**，这正是 11.2 节的端到端证据。

---

## 与上下游的关系

| 方向 | 对象 | 关系 |
|---|---|---|
| 上游 | `packages/typert/protocol` | 提供 `RemoteStream` / `RemoteStreamHandle` / `RemoteInvocation` / `PeerScope` / `RemoteError` / `isRemoteJsonValue` / `isRemoteUplinkItem`；本版 `stream-protocol.ts` 把本地 `isRemoteJsonValue` 实现**上移**到这里（-29 行实现 +1 行 import） |
| 上游 | `packages/typert/generator` | 从 Host `ts.Program` 生成 Host 与 Host-for-Client 产物；`RemoteStream<Out, In>` 的第二类型参数决定上行编解码器 |
| 上游 | `packages/typert/registry` | 严格描述符落位；本版 Gateway 的 `srcClaims` 失效监听依赖 `internal/service` 事件 |
| 上游 | `packages/client/connection` | 承载一元 RPC、信封、correlation id、二进制附件组帧、`/api` 共享 FetchHandler 与 WebSocket admission；`docs/subsystems/web-server.md` 本版新增 `ctx.connection` 的 `createSharedFetchHandler` / `requestRejection` / `admit` / `authorizeIndex` / `authenticatedUrl` 五个成员的目录条目，并新增 `connection/request` waterfall 事件 |
| 上游 | `packages/host/webserver` | `registerUpgrade` 提供 `/api/remote.mux` 的升级路由 |
| 上游 | `packages/boot/plugin-manager`、`packages/host/plugin-inventory` | 本版新进 `remotes` 装配的依赖 |
| 下游 | `packages/client/*`（UI 半边） | 通过 `ctx.remote.<ns>` 与 `RemoteStreamHandle` 消费；路由门约束它们的请求目标 |
| 下游 | `apps/desktop` | `./stream-protocol` 导出的共享流组帧与解析器供原生 Desktop 调用方复用（Gateway README 本版新增末段） |
| 下游 | 外部 Python 使用者 | 通过 `deepseek-harness-sdk` 驱动；本版改动集中在 runtime 资源与 Office sidecar，客户端 JSON-RPC 面未变 |

---

## 本版本变更要点（0.1.6-alpha.1 → 0.1.7-rc.1）

### 11.1 远端双工流：一条流、一条上行通道、一个调用上下文

**决策记录**：`.agents/notes/implemented/architecture/2026-09-19-remote-duplex-stream.md`（609 行，双语）。

#### 11.1.1 问题：三种互不相关的上行机制

该 note 的 `Problem` 段落自述：改造前 Client→Host 的数据通路是**三套彼此无关的机制**，并且**没有 EOF**——Client 无法表达「我写完了」，半关闭还得再借一次 RPC。本版把它们收敛为「一种流，天然双工」。

#### 11.1.2 落地的 wire 变更

`packages/api/gateway/src/stream-protocol.ts` 本版 +62/-… 行的净效果：

| 变更 | 证据 |
|---|---|
| `RemoteStreamClientMessage` 增加 `item` 与 `end` | 该文件 `:234-243`；diff 中 `+  | { readonly type: 'item'; … }` / `+  | { readonly type: 'end'; … }` |
| `end` 与 `cancel` 共享同一条精确键校验分支 | `if ((value.type === 'cancel' \|\| value.type === 'end') && exactKeys(value, ['type','streamId']) && validId(value.streamId))` |
| `item` 的键集允许「无 `value`」形式，并要求 `value` 通过 JSON 安全检查 | `(!Object.hasOwn(value, 'value') \|\| isRemoteJsonValue(value.value))` |
| 本地 `isRemoteJsonValue` / `visitJsonValue` 删除（-29 行），改为从 `@deepseek-ai/dsh-typert-protocol` 导入 | diff 中 `+import { isRemoteJsonValue } from '@deepseek-ai/dsh-typert-protocol'` 与删除的 `function visitJsonValue(...)` |
| 全部 `as unknown as X` 改为 `as X` | 4 处 `return value as unknown as …` → `return value as …`（对应仓库规则 `2026-09-19-no-unknown-casts`） |

#### 11.1.3 Host 侧：描述符带上行编解码器，调用上下文可读

`packages/api/gateway/src/index.ts` 本版 +488/-… 行，新增的结构：

| 结构 | 位置 | 作用 |
|---|---|---|
| `UplinkSource` | `:101-110` | `source` / `codec` / `endpoint` / `abort`，`GatewayInvocation.uplink()` 首次使用时构造 |
| `SRC_JSON_CODEC` | `:142` | 描述符未声明上行时使用的 `{ mode: 'src-json' }` 编解码器 |
| `methodSignal()` | `:1142-1147` | 带上行的调用把 `control.signal` 与载体信号 `AbortSignal.any` 合并；其余调用保持载体信号恒等 |
| `cancellableStream()` 的 `finally` | `:1183-1190` | **先** `await invocation.close()`（让阻塞在 `uplink.next()` 的方法解开），**再** `await iterator.return?.()` |
| `streamAbortFailure()` | `:1198-1200` | 中止原因是 `RemoteError` → 就是这条流的失败；否则折叠为 `gateway/cancelled` |
| `UplinkDecoder` | `:1215-1288` | 逐项解码；失败时 `this.abort(failure)` 并以 `gateway/input-invalid`（field `uplink`）失败整条流；`return()` 非阻塞释放载体迭代器 |
| `releaseUplink()` | `:1347-1349` | 没人读的载体上行立即释放，避免缓冲 |

方法如何拿到调用：`prepareInvocation()` 在 `:723` 用 `receiverContext.extend({ invocation }).get(descriptor.service)` 绑定接收者，因此 JSDoc 明确写着「nothing enters the parameter list」——上行**不进参数表**。

#### 11.1.4 Host 侧：有界上行收件箱

`packages/api/gateway/src/stream-server.ts` 本版 +264/-… 行，新增 `UplinkInbox`（`:303-` 起）：

- 按 **UTF-8 帧字节**计量（`push(value, frameBytes)`），上限来自 `streamInboxBytes`；
- 溢出 → `gateway/uplink-overflow`；`end` 之后再收 `item` → `gateway/protocol`；
- 两种违规都**不关物理 socket**，只让该逻辑流失败；
- `fail(error)` 幂等，清空已缓冲条目并唤醒读端；
- 单消费者（`[Symbol.asyncIterator]()` 第二次调用抛错）。

Host README（`packages/api/gateway/README.md`，本版 +29/-…）把这条契约写成读者可见的句子：*"Each logical stream buffers at most `streamInboxBytes` (262144 by default) of uplink frame bytes; overflow fails the stream with `gateway/uplink-overflow`, and an item after `end` fails it with `gateway/protocol`, in both cases without closing the socket."*

#### 11.1.5 Client 侧：`RemoteStreamHandle` 的四个动作

`packages/api/gateway/src/client/index.ts` 本版 +147/-…：

| 成员 | 位置 | 语义 |
|---|---|---|
| `invokeStream()` | `:464-484` | 调用即开流：`generation = new AbortController()`，`uplink = new ClientUplinkQueue(endpoint)`，downlink 绑定 `AbortSignal.any([prepared.signal, generation.signal])` |
| `ClientStreamHandle` | `:543-` | 构造时 `downlink.next()` prime，保证 `open` 帧先于任何 `item` 上线；失败时关闭上行队列 |
| `send(item)` | `:565-568` | 先 `isRemoteUplinkItem(item)` 检查，非无损 JSON 值直接抛错 |
| `end()` | `:570-572` | 半关闭 |
| `dispose()` | `:574-582` | 关闭队列 + abort 该代 + `downlink.return?.()`（即使无人读下行，也能让 `cancel` 立刻上线） |

`ClientUplinkQueue`（`packages/api/gateway/src/client/stream-client.ts:401-`）与 `RemoteStreamMuxClient.open(endpoint, payload, signal, uplink?)`（同文件 `:99-145`）、`pumpUplink()`（`:154-204`）构成发送侧；`pumpUplink` 有两条防串代措施：`this.socket !== socket` 检查（旧代绝不向新 socket 发帧）与「stop promise 属于单次读而非整条上行史」。

#### 11.1.6 承载体与终帧规则

- 下行终帧 `end`/`error` 一到，mux 立即在**接收路径**停泵并关闭上行队列，因此后续 `send`/`end` 无需等消费者下一次读就会抛错（README：*"after the downlink terminates `send` throws and `end` is ignored"*）。
- `cancel`：`missing → ignore`；否则 `control.abort(new Error('Remote stream cancelled'))`（无 `RemoteError` 原因 → 不发终帧）。
- 原因属于 `RemoteError` 的 abort 由泵发出 `error` 帧。

#### 11.1.7 本版谁是上行消费者（关键诚实结论）

我在**全仓非测试 `src`** 中检索 `RemoteStream<`、`ctx.invocation`、`.uplink()`，结果：

- 生产代码里**没有任何** Host 方法声明 `RemoteStream<Out, In>` 且 `In ≠ never`；
- 唯一真正声明「两参数 `RemoteStream<Out, In>`」的宿主方法是**测试服务**：`EchoService`（`packages/api/gateway/tests/echo-stream.host.spec.ts:19`，本版新建）与 `packages/api/gateway/tests/gateway-stream.host.spec.ts`（`:129/142/154/161/169/179/186/210`），另有 typert 生成器的测试夹具 `packages/typert/generator/tests/fixtures/remote-model/typert-protocol.d.ts:39`。

**结论**：本版交付的是**能力与传输层契约**，不是某个业务功能的迁移。note 的 `Consequences` 也自述终端 `attach` 流「在 Deferred 落地后取代 unary `write` 与 `attachmentId`」——即真实消费者被显式推迟。这一点必须写清楚：不能因为 note 的示例叫 `job.attach` 就宣称作业流已上行。

#### 11.1.8 取消与保留

本版另有两个围绕流生命周期的修补：

- `4cfd292a7b fix(gateway): bound stream cancellation retention` + `45f5cd34b0 fix(gateway): pass explicit undefined in retention test`：把取消路径的保留量收敛为「读局部状态，而不是已投递项的历史」；README 本版据此新增一句：*"Stream cancellation and stopping keep read-local state, not a history of delivered items, on the Host downlink, Host uplink, and Client uplink pump. Completing the downlink also wakes pending uplink reads."*
- 下行正常结束时 Host 归还上行迭代器并丢弃未读项；方法若从未取上行，项会一直待在收件箱直到此刻。

#### 11.1.9 路由门之外的 `appReady` 门

同一批改动里还有一个不显眼但重要的准入变更：**WebSocket 升级路由要等启动器宣告应用就绪后才注册**（`a44ced4b96 fix(web): gate Remote WebSockets on application readiness`）。

`packages/api/gateway/src/index.ts:264-275`：

```ts
// Existing pages reconnect before the new Host prints its URL. No stream
// may enter until the launcher has activated and audited its controllers.
const ready = webCtx.get('appReady')
if (ready === undefined) listen()
else webCtx.effect(() => {
  let closed = false
  const cancel = ready.onReady(() => { if (!closed) listen() })
  return () => { closed = true; cancel() }
}, 'api-gateway: application readiness')
```

语义（README 逐字）：就绪前的连接尝试仍是载波失败，交给 Connection 的重试策略；无 `appReady` 的嵌入式宿主立即注册并自负启动顺序；in-process 调用不受影响。注意这是用 `webCtx.get('appReady')` 读可选服务（符合仓库规则「可选服务用 `ctx.get`」），而不是声明 injection。

---

### 11.2 宿主独占远端输入校验

**决策记录**：`.agents/notes/implemented/simplification/2026-09-15-host-only-remote-input-validation.md`（Status: implemented）。实现提交：`7c74636892 perf(api-gateway): avoid duplicate client input parsing`。

**问题**：生成的 Client 方法暴露 TypeScript 签名，但每个参数都再跑一遍相同的 schema，既重复 Host 已有的校验，又让惰性 Zod schema 在 Client 被物化，还让「非法 JS 调用」的失败路径取决于哪一端先拒绝。

**决策**（note 原文要点）：

- Client 在贡献挂载时校验**描述符完整性**，之后只转发类型化参数与绑定的 Context 身份，**不再调用 invocation codec 工厂**；
- 仍然本地拒绝：位置参数个数错误、缺失的 Client Context 绑定；
- 成功的一元结果与流项也**不再做客户端类型解析**；
- `InvocationDescriptor` 仍保留 codec 元数据，因为 Host/Client 产物共享它，且 Client 挂载仍要求每个 Client 提供的字段都有严格 codec。

**代码证据**：`packages/api/gateway/src/client/index.ts:486-533` 的 `prepareInvocation()` 只做四件事——个数检查、`args` 组装、身份绑定、signal 合并；`:795` 的挂载期检查是 `if (descriptor.uplink !== undefined) requireStrictCodec(descriptor.uplink.codec, endpoint, 'uplink')`；一元结果只有 `descriptor.result.decode` 存在时才调用（`:449-451`）。

**README 措辞的同步变化**（同一 diff 内，值得作为「文档与行为同批改」的实例）：

| 位置 | 上版 | 本版 |
|---|---|---|
| Summary | `…and validates its result` | 删除（Host 不再负责结果校验的同句表述） |
| Client 段 | `Each unary call validates positional inputs…` | `checks positional arity…without executing Client-side schemas` |
| Known Limitations | `Only strict generated contributions can mount on the Client face.` | `Every Client-supplied field requires a strict generated codec when its contribution mounts.` |
| 表格 Client 行 | `initiates, validates, and cancels calls` | `initiates and cancels calls` |

**代价（note 与本版 README 都写明）**：

- 畸形运行时值**失败得更晚**；
- 未声明的对象属性可能**穿过受信载体**，直到 Host codec 才被剥掉。因此「从不可信或含密对象派生请求」的调用方**必须自己构造声明的 DTO**，不能再把 Client 解析当作脱敏步骤。这一条是本版最值得插件作者注意的行为变化。

**端到端证据**：`packages/api/remotes/tests/built-lib.e2e.ts` 从 `invalidRejected: true` 改为 `invalidResult: { ok: false, error: { code: 'gateway/input-invalid' } }`（见「测试覆盖」节）。

---

### 11.3 工作区文件二进制传输

**决策记录**：`.agents/notes/implemented/architecture/2026-09-17-workspace-file-binary-transfer.md`（Status: implemented）。实现提交：`ecf6acfb15 feat(api): support binary fields in Remote results`、`e98b5703c7 refactor(api): move Remote result projection to gateway`、`eaf0f68bb2 Merge pull request #4401 from deepseek-harness/perf/workspace-file-binary-transfer`。

**问题**：文档预览需要原生字节。base64 让负载在压缩前多出约三分之一，还要求浏览器解码；单独开一条文件 Fetch 路由又会复制 Gateway 的方法派发、Session 查找与错误处理。

**决策与分工**（note 原文职责划分）：

| 层 | 职责 |
|---|---|
| Typert | 递归识别一元结果类型中的 `Uint8Array`（根值、可选字段、容器）；生成结果编解码器的 `encode()` 与 `decode()`；Client 声明把每个字节缓冲窄化为 `ArrayBuffer` |
| Gateway | 执行生成的编码器，保持严格 JSON 值不变，对 source-mode 调用做运行时字节探测；返回 JSON 兼容元数据 + **结果相对**字节附件表 |
| Connection | 拥有标准 `FormData` 部件，保留 RPC 信封与 correlation id；**不检查业务值**、不依赖 Typert 反射 |
| 业务字段名 | 由业务自己拥有（附件表通过 JSON 结果中的路径与字节部件关联） |
| Client | 在 `Blob.arrayBuffer()` 上重建 `Uint8Array` 视图；校验委托给生成解码器 |

**`workspace-files` 的方法面收敛**（`packages/api/workspace-files/README.md` 本版 +51/-…）：

| 上版 | 本版 |
|---|---|
| `readBytes(path, { offset?, length? })` 返回 base64 `data` | `readBytes(path, { range?, baseFile? })` 返回 `Uint8Array` |
| `readAll(path)` | 删除；省略 `range` 即完整文件，受 `maxFileBytes`（32 MiB）约束 |
| `readRelated(path, relativePath)` | 删除；`options.baseFile` 承担相对解析 |
| `changes()`（整个工作区根） | `changes(path)`（**目标级**：单文件或某目录的直接子项） |
| 失败码 7 个 | 新增 `workspace-file/watch-unsupported` |

对 `baseFile` 的约束（README 逐字要点）：`path` 必须是相对的，否则 `gateway/bad-request`；`baseFile` 自身接受绝对或工作区相对路径；两个文件都过同一套常规文件检查；空目标、绝对目标、URL、含 NUL 目标一律拒绝。

**代价与边界**（note `Consequences` 段落逐字要点，必须如实转述）：

- 字节范围只在 `maxBytes` 下保留所请求字节，**与** `maxFileBytes` 无关；
- 完整读保留有界整文件；**这不是流式预览，也不是零拷贝**；
- HTTP 断连时 bridge 中止请求信号并**排空已物化响应块而不写 socket**——原因是取消 Node multipart body 可能与其生产者竞态并造成未处理的 `ERR_INVALID_STATE` 拒绝；
- Office 授权探测复用同一个 Remote，用**一字节** range；转换后的 PDF 仍以 base64 走独立的 Office Remote 与其有界解码器；
- 插件调用方需迁移到 `readBytes` 的选项形式，并停止把其数据当 base64 解码；
- **二进制参数、事件、流项仍不支持**；递归类型要求运行时值无环；**无 Session 事件或持久化格式变更**。

**`changes(path)` 的监听实现变更**（README 与源码 `src/changes.ts`、`src/client/change-feed.ts`）：

- Host 先用 `stat` 推出目标类型，**目录类型才要求工作区包含**（类型变化后亦然）；
- 一代 generation 注册观察队列、解析目标、**在 yield `ready` 之前启动 `fs.watch`**；
- 本地 provider 用 Chokidar；目录只观察直接子项；匹配的 `fs/observed` 发射也会使目标失效；
- 缺失文件在父目录仍在时保持可观察，等待同路径重建；
- 取消**独立于消费者的下一次 pull** 关闭 watcher；代或插件拆除都会等待关闭完成。

**已知限制的新增/改写**（README `Known Limitations`）：新增「Provider watch support —— 不支持的 backend（含 SSH）报 `watch-unsupported`」与「Linux 父目录重建后的自动恢复被推迟」；`Directory scope only` 改写为「目录列举与监听留在工作区内；文件读与文件监听走文件系统 backend 的读权限」。

---

### 11.4 web 特性路由与路由门

**决策记录**：`.agents/notes/implemented/architecture/2026-09-17-web-feature-routes-and-route-gate.md`。实现提交：`29182514ed fix(web): resolve feature routes from the document directory and gate browser routes`、`771ebf4ace fix(web): scan plain src for a dual-face browser package without src/client`。

> 交叉引用：本篇从**协议与路由门**角度写；插件契约与 webServer 自持路由角度见第 09 篇。

#### 11.4.1 问题

上游决策 `.agents/notes/implemented/architecture/2026-09-14-web-document-relative-app-routes.md` 让 shell、插件 bundle 与它们的流在任意挂载点下都命中同一个 listener。但**特性包自己持有的路由仍然按 origin 根寻址**，note 逐一点名了六个：

| 路由 | 常量名 |
|---|---|
| `/open-in-app/...` | `OPEN_IN_APP_*_PATH` / `*_ROUTE` |
| deliverables 的 `present.*` 与 `changes.*` | `PRESENT_*_PATH` / `*_ROUTE`、`CHANGED_FILES_PATH`、`CHANGES_*_PATH` / `*_ROUTE` |
| 会话日志导出下载 | `SESSION_LOG_EXPORT_PATH` / `_ROUTE` |
| 上传 worker 的 `/api/session/uploadFileBinary` | `FILE_UPLOAD_PATH` / `_ROUTE` |
| 本地 markdown 图片路径背后的 `/api/file` | （同属 `api` 前缀） |

在剥离前缀的反向代理下，这些请求**全部落空**；而且没有任何机制阻止「新的浏览器面引用」再次把 bundle 绑死到单一挂载点。

#### 11.4.2 决策：双形态常量 + 浏览器只认相对形态

每个特性生产者**保留其绝对注册键**，并在旁边派生浏览器形态：`X_PATH`（绝对，注册与响应表使用）与 `X_ROUTE = X_PATH.slice(1)`（相对，浏览器代码唯一可寻址形态）。我在本版 diff 中实测到的新增派生常量：

```
+export const FILE_UPLOAD_ROUTE = FILE_UPLOAD_PATH.slice(1)
+export const EVENTS_ROUTE = EVENTS_ENDPOINT.slice(1)
+export const CHANGED_FILES_ROUTE = CHANGED_FILES_PATH.slice(1)
+export const CHANGES_DIFF_ROUTE = CHANGES_DIFF_PATH.slice(1)
+export const CHANGES_OPEN_ROUTE = CHANGES_OPEN_PATH.slice(1)
+export const PRESENT_OPEN_ROUTE = PRESENT_OPEN_PATH.slice(1)
+export const PRESENT_HOST_ROUTE = PRESENT_HOST_PATH.slice(1)
+export const OPEN_IN_APP_APPS_ROUTE = OPEN_IN_APP_APPS_PATH.slice(1)
+export const OPEN_IN_APP_ICON_PREFIX_ROUTE = OPEN_IN_APP_ICON_PREFIX_PATH.slice(1)
+export const OPEN_IN_APP_OPEN_ROUTE = OPEN_IN_APP_OPEN_PATH.slice(1)
+export const SESSION_LOG_EXPORT_ROUTE = SESSION_LOG_EXPORT_PATH.slice(1)
```

页面安装的 Fetch 形态载体（`FileUploadFetch`、`RpcFetch`）接收该相对路由，并**按自身 base 解析**。只有两个消费者需要绝对 URL 并针对 `document.baseURI` 解析：上传 worker（它自己的 base 是 `blob:`）与 markdown 图片词汇（只发射绝对 `http(s)`/`blob`/`data` 目标）。

#### 11.4.3 门：`scripts/verify-client-route-resolution.ts`

| 项 | 值 |
|---|---|
| 文件 | `scripts/verify-client-route-resolution.ts`，**339 行**（本版新增） |
| 规格 | `scripts/verify-client-route-resolution.spec.ts`，**199 行**（本版新增，每条规则各有负例对照） |
| 接入 | `scripts/run-gates.ts` 修改（本版 `M`）；运行于 `hygiene` 与 CI 静态检查 |
| 扫描面 | Client 编译器面编译的**每一个浏览器源**（由 `faceConfigs` 发现；discovery spec 固定「同时被 Host 聚合编译的 DOM 工程贡献其普通 `src/`，除非它有 `src/client` 半边」） |

四条规则（源码 `RouteResolutionRule` 类型逐字）：`request-target`、`location-base`、`host-route-key`、`reference-producer`。

被判为「请求目标」的位置（源码 JSDoc 逐字）：请求构造器首参、`fetch`/`fetcher` 形态调用首参、动态 import 首参、被赋值的资源属性（`script.src = …`）、JSX `src`/`href` 属性。

被拒绝的形态：根绝对（`/api/x`）、协议相对（`//host/api/x`）、绝对（`https://host/api/x`）的 app 路由；以及用 `location` 读数解析出的相对 app 路由。共享的 `*_PATH` / `*_ENDPOINT` 键若被当作请求目标使用，**必须**先 strip 前导斜杠（对应 `host-route-key` 规则与提示文案 `strip the leading slash before the browser uses this key (KEY.slice(1))`）。

三次同批检查 Host 侧的浏览器引用生产者：`url`/`src`/`href` 字段被打上根绝对 app 路由 → 拒绝；而路由键与响应表键**保持绝对且在范围之外**。`REFERENCE_PRODUCERS` 当前只列 `packages/client/modules/src/index.ts`（源码常量数组逐字）。

**门自身的已知边界**（note `Consequences` 逐字要点 + 源码 JSDoc 重复声明）：门只读内联字面片段，**不追踪组合出来的引用**（`comboReference(...)`、`artifact.url.slice(1)`）；回归信号由 `packages/client/modules/tests/node-half.client.spec.ts` 承担（组合图行、批描述符、source-map trailer）。预览页不在文档 URL 暴露其 worker 的文件 API，因此 markdown 本地文件图片 URL 到不了那个 Host。

---

### 11.5 API gateway 与控制器组

#### 11.5.1 `packages/api/gateway`（21 files, +3139/-396）

除 11.1 与 11.2 已述的双工流与输入校验收权外，本版还有：

| 变更 | 证据 |
|---|---|
| `tsconfig.host.json` 新增对 `../../boot/cmdline` 的引用 | diff `+ { "path": "../../boot/cmdline" }` |
| `src/types.ts` +17/-… | `TypertGatewayWireStream` 增加 `uplink` 参数位 |
| `src/client/remote-events.ts` 净 -…（87 行改动） | 事件转发侧随 `PeerScope` 与代数语义调整 |
| README 新增末段：「`./stream-protocol` 导出向原生 Desktop 调用方提供共享 Remote 流组帧与解析器；这些调用方使用与浏览器客户端相同的已认证 WebSocket 端点。」 | `packages/api/gateway/README.md` 末段 |
| README 新增 Client waterfall Context 解析段（同步解析、`TypertOwnedValue<Context>` 在 handler 使用与回复落定后才释放、取消抑制迟到回复但不释放仍被 handler 使用的 Context、插件拆除与 Connection 换代会等待未完成 handler 落定） | 同上 |
| 流方法不再「逐项用生成结果 codec 校验下行项」，改为「返回业务项上的可取消迭代」 | README 上版 `then validates each yielded item with the generated result codec` → 本版 `then returns a cancellation-aware iterable over the business items` |
| 新的 Known Limitation：上行除有界收件箱外**没有流控**；上行项**不跨载体代重放**，需要恢复的上行要靠领域自己的确认游标 | README `Known Limitations` 末条 |

#### 11.5.2 `packages/api/remotes`（11 files, +189/-127）

`packages/api/remotes` 是**装配点**：Host 门面 `src/index.ts` 只注册本应用选中的唯一事件源（`apply` 里 `ctx.typertGateway.registerRemoteEvents(remoteEventSource(ctx), { home: homedir() })`，`:40-42`），Client 组装在 `src/client/index.ts` 的 `apply()` 内以 `for (const contribution of [...]) { disposers.push(await ctx.remote.$mount(contribution)) }` 逐个挂载。

Client 组装本版新增 5 个贡献、去掉 1 个旧名：

| 变化 | 贡献 |
|---|---|
| 新增 | `accountRemote`（`@deepseek-ai/dsh-api-account-controller/remote`） |
| 新增 | `officeToPdfRemote`（`@deepseek-ai/dsh-office-to-pdf/remote`） |
| 新增 | `pluginManagerRemote`（`@deepseek-ai/dsh-plugin-manager/remote`） |
| 新增 | `pluginRegistryProbeRemote`（`@deepseek-ai/dsh-client-ui-plugin-manager/remote`） |
| 新增 | `jobRemote`（`@deepseek-ai/dsh-api-job-controller/remote`） |
| 更名 | `@deepseek-ai/dsh-agent-presets/remote` → `@deepseek-ai/dsh-agent-preset-registry/remote` |
| 类型导出增补 | `BundleInfo`/`Registry`/`PluginInstallProgress` 等 21 个来自 `dsh-plugin-manager/types` 的类型；`export type {} from '@deepseek-ai/dsh-job-controller/remote'` 等 |

转发事件白名单（`src/remote-events.ts`，本版 +4）新增三条 `mode: 'emit'` 事件：`plugin-manager/changed`、`plugin-manager/install-log`、`plugin-manager/install-state`。

`package.json` 的依赖段本版整体从 `workspace:^` 迁到 `workspace:*`（vendor/native 用 `workspace:~`），这是区间内 `4e6028a604 build: use tilde ranges for vendor and native workspaces` 与 `37372101b5 build: pin internal DSH workspace dependencies` 两个全仓提交的传播结果；本篇统计里「只有 package.json 改动」的包（`mcp-resources`、`webhook-github`、`sdk/protocol`）基本都属于这一类。

#### 11.5.3 `packages/api/session-controller`（65 files, +5367/-3011）

改动量最大。可核实的三条主线：

1. **作业平面迁出**。`refactor(session-controller): drop the job roster from the control stream`（`2132b7beeb`）、`refactor(jobs): move job observation into api-job-controller`（`7ec142a325`），以及破坏性提交 `0dca00b425 refactor(api,client)!: delete the activity plane; one job roster with record observation`。文件级证据：`src/client/sessions/queue-mirror.ts` **删除**，`tests/control-jobs.host.spec.ts`、`tests/queue-store.client.spec.ts` **删除**，`tests/inbox-projection.client.spec.ts` **新增**。
2. **归档会话准入门**。新增 `src/archived-session-gate.ts`：以 `ArchivedSessionGate` 插件形式（`inject: ['agents','sessions','workspaceRegistry']`）在 `agent/pre-step` 上做 waterfall，凡是「会话已归档，或它的子代理血缘中有已归档者」就返回 `{ kind: 'reject' }`，loop 以 `blocked` 结束且**不发请求**；解除归档即对整个血缘解除门。血缘沿持久 header 字段**只走子代理来源的会话**——「归档会话的 fork 是独立会话」。配套 `tests/archived-session-gate.host.spec.ts`。对应提交 `cbae324bfa feat(workspace): stop a Session's running work before archiving it (#4765)`。
3. **Client 侧投影与引用归属**。新增 `tests/reference-ownership.client.spec.ts`、`tests/subagent-catalog.host.spec.ts`；`src/client/contract/session.ts`、`snapshot.ts` 的 JSDoc 提到 inbox 认领与「Inbox acceptance 不把 Chat echo 移入 dock」。此外有多个 chat/steering/分页边界修复（`50ba2c8bb2 fix(session): align history pagination with turn boundaries`、`809e0942b9`、`08c0e8e71b`、`1b55f5bea3`）。

> 未核实：`session-controller` 的 65 个文件我没有逐行读完，上述三条主线之外的改动（如 `src/model-selection-projection.ts`、`src/skill-catalog.ts`、`src/history.ts` 的具体语义）未展开。

#### 11.5.4 `packages/api/settings-controller`（8 files, +108/**-516**）

本版是**净删除**：实现提交 `601d6761e4 feat(settings): project volatile Config through profile-backed forms (#4587)`。

| 删除 | 证据 |
|---|---|
| `@Remote canOpenAgentPresetDirectory()` | diff 中整段删除 |
| `@Remote openAgentPresetDirectory(preset, signal)`（37 行） | 同上 |
| `Config` 接口与 `static Config = Schema.object({ nativeOpen: … })` | diff 中删除；`constructor(ctx, config = {}, internals = {})` → `constructor(ctx, internals = {})` |
| `openPath` / `canOpenPath` internals | 同上 |
| 类型 `AgentPresetDirectoryOpenValue` 导出 | `src/types.ts` -5 行 |
| `SettingsProvider` 类型改用 `SettingsForms` | `private provider(): SettingsProvider` → `: SettingsForms` |
| 「无本地文档可打开」的错误分支 | `if (path === undefined) throw …` 删除，`path` 变为非可选 |

同时 `namespaceView()` 新增投影字段 `autoGenerate: descriptor.autoGenerate`，`getState()` 的 `hasDocument` 从 `settings.documentPath !== undefined` 改为硬编码 `true`。缺 provider 的错误信息也从「本组合没挂 settings provider（例如 `@deepseek-ai/dsh-settings-file`）」改写为「在 profile 组合里挂 `@deepseek-ai/dsh-settings` 与 `@deepseek-ai/dsh-config-editor`」——即配置后端从「文件 provider」抽象为「profile-backed forms」。

测试侧 `tests/settings-controller.host.spec.ts` 从 484 行改动净减到几乎全删（`-516` 的大头在这里）。

#### 11.5.5 `packages/api/terminal-controller`（21 files, +1246/-180）

三条独立变更：

1. **窗口持有与无人值守回收**。新增 Host `src/retention.ts`（`TerminalRetention` 类：`holders` 集合、单调时钟、观察间隔、重试）、Client `src/client/retention.ts` 与 `src/client/bindings.ts`；新增 Remote 流 `retain(sessionId, id, signal)`（只确认窗口持有，不激活 Agent、不产生屏幕输出、不转移输入、不创建进程）。三个新配置项：`unattendedTimeoutMs` 默认 `7200000`（`0` 关闭自动回收）、`activityPollIntervalMs` 默认 `30000`、`cleanupRetryMs` 默认 `60000`。相关提交 `b25c5ad82e feat(web): restore sidebar layouts and reclaim unattended terminals`、`281723bed8 fix(web): isolate terminal bindings and validate saved layouts`。
2. **用户终端权限语义变更**。`ab695ef4cf feat(web): give user terminals system-user permissions`；README 从「该会话的 sandbox policy 也作用于终端」改为「用户终端以执行环境的**系统用户权限**运行，独立于 Agent 的 sandbox 模式与审批策略；操作系统/容器限制仍然适用；DSH 不提权」，并把 `.agents/notes/implemented/architecture/2026-09-16-user-terminal-permissions.md` 加进链接列表。
3. **Client 绑定持久化**。README 新增段描述 `dsh.terminal.binding.v1.*` localStorage 键、内容身份全局唯一、布局局部 tab id 只标识活视图、独立记录读写不破坏其它窗口的绑定、恢复视图不创建替代进程等。

#### 11.5.6 `packages/api/workspace-controller`（18 files, +875/-61）

新增 `src/default-directory.ts`：解析 Host 账户的 **Documents** 目录用于首次工作区创建。要点（源码逐字 JSDoc）：`validateDocumentsDirectory()` 要求完全限定路径（Windows 上还要拒绝 `\` 或 `/` 根），`defaultWorkspaceDirectory(directoryName, documentsDirectory, signal, internals)` 只在 Host 解析候选路径、**不创建文件**；平台事实与 native command runner 可注入。配套 `tests/default-directory.host.spec.ts`。相关提交 `4d2e420ef8 refactor(workspace): initialize the default workspace on startup`。

#### 11.5.7 `packages/api/account-controller`（新增，8 files, +314）

新包，命名空间 `account`，注入 `deepseekAccount`。7 个 Remote 方法（`Select-String '@Remote'` 计数为 7，逐个核实）：`getState`、`getProfile`、`getBalance`、`startSignIn(locale, callbackOrigin, loginSource)`、`cancelSignIn(attemptId)`、`signOut`、`watch(signal)`（`@Remote({ mode: 'stream' })`）。`src/types.ts` 仅 3 行再导出，注释写明「Account Remote values contain no credential payloads」。相关提交 `048297321a feat(desktop,credentials,client): integrate DeepSeek account sign-in and Platform pages`。

#### 11.5.8 `packages/api/job-controller`（新增，23 files, +2633）

新包，命名空间 `job`。方法集见「关键类型」片段 H。`src/types.ts` 定义 `JobListRequest`/`JobListFrame`（整集替换，重连首帧即真相）、`JobKillRequest`/`JobKillValue`（`'requested' | 'already-finished'`）、`JobFollowRequest`（`sessionId?`、`jobId`、`from?`）与 `JobFollowFrame`（`opened` / `output` / `status` 三态，`output` 带 `next` 与可选 `lossy`）。错误码 `job/not-found`。源码结构 `src/{index,types,observe,rows,wake}.ts` + `src/client/{index,model,service}.ts`，测试 6 个。相关提交 `7ec142a325`、`0659ded55b refactor(job-controller): drop the subagent ownership fence from job.kill`。

#### 11.5.9 `packages/api/workspace-files`（19 files, +2009/-910）

见 11.3。补充：`src/index.ts` 的 `readBytes(workspaceFileScope, path, options, signal)` 按 `options.range === undefined` 在 `ctx.fs.readBytes(target, signal, limit)` 与 `ctx.fs.readByteRange(target, window, signal)` 之间分支；`relativePath()` 在 `options.baseFile !== undefined` 时要求 `path` 相对；`changes(workspaceFileScope, path, signal)` 为流方法。

---

### 11.6 SDK（TypeScript）

#### 11.6.1 `packages/sdk`（7 files, +56/-50）

**本版没有 wire 协议变更**。三类改动：

| 文件 | 变更 |
|---|---|
| `sdk/client/src/api.ts`、`sdk/client/src/client.ts` | 3 处 `as unknown as X` → `as X`（构造器转换与两个已验证值的窄化）。来源提交 `580bdc7258 refactor: remove redundant unknown casts` |
| `sdk/server/src/server.ts` | `subagent.finished` 负载的 `lastAssistantMessage` 由直接引用改为**拷贝**：`[...info.lastAssistantMessage]`（避免把宿主内部数组交给发送侧）；注释里的 `dsh-agent-presets` → `dsh-agent-preset-registry` |
| `sdk/protocol` | 仅 `package.json`（版本 + 依赖范围） |

`sdk/client/tests/sdk-client.spec.ts` 有 4 行新增断言。

**与 `docs/subsystems/session-reference.md` 的关系**：该文档本版 +7/-6，描述的是 Session 引用候选项新增 `displayTitle?: string` 字段（「优先使用子代理的持久创建标签」），`label` 与 `displayTitle` 分工，查询同时搜索两者，Remote 候选项的规范 mention 在有 display title 时使用它。这是 `session-reference` 包的 wire 类型变化，**经** SDK 与 Client 一同投影；注意仓库规则要求「两个 SDK 都投影 loop」，所以这类 SessionEventMap/生命周期变化必须同 PR 更新 TypeScript 与 Python 两侧的期望输出。

> 未核实：我未逐一比对 `sdk/client` 的期望输出快照文件（`snapshots/`）在本区间的差异，因此「SDK 快照与本次 `lastAssistantMessage` 拷贝同步更新」这一点未获证据。

#### 11.6.2 `docs/user/guide/providers.md`（+96/-82）——与协议/SDK **无关**

任务清单把该文档列在 SDK 名下，但实测其全部差异是 **Settings → Models 页面文案与配置落点**：

| 项 | 上版 | 本版 |
|---|---|---|
| 入口按钮 | `Add provider` / `Add a custom provider` | `Add model provider`（卡片开在 `Third-party model provider`）/ `Custom model API` |
| 高级配置落点 | `$DSH_HOME/settings.yaml` | `$DSH_HOME/profiles/<profile>/cordis.patch.yml` |
| 模型字段 | 无 `input types` | 新增 `input types`，移除 headers/timeouts/retry 从本页可编辑的表述 |

因此本篇只登记为「区间的真实变更，但不属于协议/SDK 面」。

#### 11.6.3 `docs/cookbook/adding-a-remote-api.md`（+2/-2）

仅两行措辞对齐（属双工流/校验收权的传播）。

---

### 11.7 MCP

#### 11.7.1 `packages/mcp/mcp-client`（7 files，src 改动 2 处）

**背景**：0.1.6 引入官方 MCP SDK 协商后的桥；本版是对**结果投影时机**的修正（提交 `ab102138c8 fix: retain ordered tool text and images within a token budget`、`c4c18ef0d4 test: align retention checks and catalogs with token budgets`、`94728ebd23 fix: repair multimodal retention CI resolution and coverage`）。

| 变更 | 上版 | 本版 | 位置 |
|---|---|---|---|
| 工具定义钩子名 | `finalizeContent(exec, result)` | `projectContent(exec, result)` | `src/tools.ts:237` |
| 投影时机 | 在 `tools/post-execute` **之后**才装入内容 | 在 `tools/post-execute` **之前**装入，因此「保留（retention）看到真实图像」 | 同上 |
| 契约措辞 | `finalizeContent installs it only when the registry's post-execute result is unchanged, so policy blocks and value replacements stay authoritative` | `projectContent installs that content before tools/post-execute, so retention sees real images. Subsequent content replacement, value replacement, and blocking remain authoritative.` | `README.md` |
| 类型断言 | `]) as unknown as z<ConfigInput, Config>` | `]) as z<ConfigInput, Config>`；`value as unknown as McpResult` → `value as McpResult` | `src/index.ts:142`、`src/tools.ts` |

测试侧：`tests/http-fixture.ts` 的 fixture 新增 `calls: string[]` 记录实际发生的 `ping` 调用；`tests/mcp-client.spec.ts` **+64 行**，新增用例标题逐字为 `it('keeps admitted images when post-execute shortens only the text', …)`（`git diff | Select-String '^\+\s*(it|describe)\('` 仅此一条）。

#### 11.7.2 `packages/mcp/mcp-resources`

**仅 `package.json`**（28 行改动，全部是版本与 `workspace:` 范围）。无 src、无测试变化 → **本版该包无行为变更**。

#### 11.7.3 `docs/subsystems/mcp.md` 与 `docs/subsystems/lsp.md`：**区间内无变更**（已核实）

任务清单假设这两份文档在区间内有变化。实测：

```powershell
git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- docs/subsystems/mcp.md
#  → 无输出（无变更）
git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- docs/subsystems/lsp.md
#  → 无输出（无变更）
git cat-file -e dsh-v0.1.6-alpha.1:docs/subsystems/mcp.md   # 存在
git cat-file -e dsh-v0.1.7-rc.1:docs/subsystems/mcp.md      # 存在
```

即两份文档在 base 与 head 都存在且**内容逐字节相同**。因此本篇对 MCP 的文档依据只能取自 `packages/mcp/mcp-client/README.md` 的区间差异（见上表）。

---

### 11.8 acp 与 webhook

#### 11.8.1 `packages/acp`（8 files, +61/-49）

| 文件 | 变更 |
|---|---|
| `src/updates.ts` | `toolResultUpdate()` 的取值层级下移一层：`event.data.message.content[0]` → `event.data.message`，字段读取从 `result.content` / `result.toolCallId` / `result.isError` 改为 `message.*`。即工具结果事件的结构跟进 |
| `src/codec.ts` | `turnEndToStopReason()` 的 `default` 分支 v8 ignore 注释改写：从「`TurnEndReason` 是封闭联合且上面已处理每个成员」改为「`TurnEndReason` 是**可合并扩展**的；每个活轮次成员都在上面处理，seed-only 变体（`forked`）永不结束 ACP prompt turn」 |
| `src/index.ts` | 2 处：注释里的 `dsh-agent-presets` → `dsh-agent-preset-registry`；`JSON.parse(...) as unknown` → `const decoded: unknown = JSON.parse(...)` |
| `tests/` | `edges.spec.ts` +11、`turns.spec.ts` +19、`updates.spec.ts` +11、`bridge.spec.ts` 2 |

**协议面无变化**：没有新的 ACP 方法、没有 wire 类型增删。这是「上游枚举语义变化 + 事件结构变化」的跟随式改动。

#### 11.8.2 `packages/webhook`（7 files, +50/-49）

| 文件 | 变更 |
|---|---|
| `src/index.ts` | `const erased = rule as unknown as AnyWebhookRule` → `as AnyWebhookRule` |
| `src/session.ts` | ① `import type {} from '@deepseek-ai/dsh-agent-presets'` → `'@deepseek-ai/dsh-agent-preset-registry'`；② **行为变更**：`await ctx.agentPresets.standingKeyFor(preset.id)` → `await using presetScope = await ctx.agentPresets.acquireScope(preset.id); void presetScope`。即从「取一个长期键」改为「获取一个显式作用域，并以 `await using` 在其生命周期结束时释放」 |
| `tests/session.spec.ts` 等 | 跟随该 API 变更 |

`webhook-github` **仅 `package.json`**（30 行，版本与依赖范围）。

---

### 11.9 Python SDK 与单文件 runtime

#### 11.9.1 重要更正：Python SDK 的「定向客户端」改动**没有落地**

任务清单列出 note `2026-09-19-python-sdk-directional-client.md`。实测该 note 位于 **`.agents/notes/proposed/simplification/`**（Status: **proposed**），并且其主张的删除**在 rc.1 上并未发生**：

```powershell
Select-String -Path python\sdk\src\deepseek_harness\client.py -Pattern 'next_request|def respond|def notify|IncomingRequest|_requests'
#  18:  from .models import IncomingRequest, …
#  59:  self._requests: queue.Queue[IncomingRequest | BaseException] = queue.Queue()
# 214:  def notify(self, method: str, params: JsonObject | None = None) -> None:
# 240:  def next_request(self) -> IncomingRequest:
# 246:  def respond(self, request_id: str | int, result: JsonValue) -> None:
# 249:  def respond_error(
# 384:  self._requests.put(IncomingRequest(id=msg_id, method=method, …))
# 431:  self._requests.put(exc)
```

同样的检索在 `dsh-v0.1.6-alpha.1:python/sdk/src/deepseek_harness/client.py` 上得到**完全相同的行号与行内容**。并且：

```powershell
git diff --name-status dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- python/sdk
#  → 只列出 python/sdk/tests/{manual_sdk_agent_smoke.py,test_client.py,test_release_version.py,test_runtime_resolution.py,test_smoke_model.py}
#    python/sdk/src/** 一个文件都没有
```

**结论**：note 主张移除的 `next_request` / `respond` / `respond_error` / `notify` / `_requests` / `IncomingRequest` 全部仍在，`python/sdk/src` 本版**零改动**。该 note 是**提案**，不是本版交付。任何声称「本版删除了 Python SDK 反向 RPC」的表述都是错的。

（顺带：note 提到的「用请求+响应替换仅用于触发 fixture 行为的客户端通知」这一测试改动也未在 `test_client.py` 的 +9 行中体现——该文件本版仅 +9 行。）

#### 11.9.2 真实的 Python 变更：runtime 资源校验与 Office sidecar

`python/` 17 files, +712/-162 的实际内容是**单文件 runtime 的安装期资源契约**：

| 变更 | 证据 |
|---|---|
| 新增 `python/sdk-runtime/src/deepseek_harness_runtime/_resources.py`（43 行） | `validate_resources(root, target)` 校验 `primary-runtime/runtime.json` 的 `platform`/`arch` 与目标一致、`python` 版本匹配 `\d+\.\d+\.\d+`、`pythonPackages` 非空、Python 解释器与 site-packages、Node 可执行文件、`office-skills/scripts/check_office.py`、`office-{docx,pptx,xlsx}/SKILL.md` 存在；非 Windows 还校验可执行权限位（`stat` 模块） |
| `__init__.py` 的 `bundled_runtime_path()` 新增 Office sidecar 检查 | `office = path.with_name(f"{path.name.removesuffix('.exe')}-office")`；读 `node_modules/@deepseek-ai/libreoffice-kit/package.json` 的 `optionalDependencies` 决定 native 还是 `wasm` 引擎；再检查 `<engine>/prebuilds.json` |
| `runtime-bootstrap.mjs` 新增 `node:sea` 分支 | `if (isSea())` 时用 `registerHooks` 把 `@deepseek-ai/libreoffice-kit` 的解析父 URL 指向 `${execPath}-office/package.json`（「Office 会 spawn 可执行 helper 与 URL worker，其完整包树必须是真实文件」）；并注入 `DSH_BUNDLED_PRIMARY_RUNTIME = join(dirname(execPath), '<platform>-<arch>', 'primary-runtime')`（平台名 `darwin→macos`、`win32→win`） |
| `pyproject.toml` 的 hatch `artifacts` 扩展 | 除可执行文件外，纳入 `…-office/**`、`linux-*/**`、`macos-*/**`、`win-*/**`，排除 dev-only `runtime/node` |
| README 新增三段 | Office sidecar 目录要求、`primary-runtime/` + `office-skills/` 布局、`DSH_PRIMARY_RUNTIME` 覆盖语义（显式路径覆盖、空串禁用 query 与 Office provider、源码/dev Node 载体无内置默认） |
| `docs/user/guide/python-sdk.md`（+40/-20） | 全部是 VitePress `::: code-group` 化（把「Linux and macOS」/「Windows PowerShell」两个小节合并为同一代码组的两个页签），**没有** API 语义变化 |
| `python/development.md`（+2） | `advanced` 与 `restart` 快照比较现在按各自输入自身的 Session 生成代（generation）匹配 native delivery qualifiers；每侧必须在其 Session 角色间使用同一代；新日志须标识当前 writer；比较永不改写已提交的录制 |
| 新测试 | `python/sdk/tests/test_runtime_resolution.py`（129 行，无密钥，`_resource_sidecars()` 辅助构造 office sidecar）、`test_release_version.py`（79 行） |
| 相关提交 | `defb9c3736 fix(sdk): shorten bundled Python resource paths on Windows`、`37983d9298 feat(sdk): bundle shared Office authoring resources`、`5e25475857 fix(office): use bundled LibreOffice Kit 0.1.0 CLI across deployments (#4902)` |

`python/sdk-runtime/pyproject.toml` 的 `version = "0.0.0.dev0"` 是占位值（发布时由 scripts 注入），不是本版版本号。

---

### 11.10 与任务前提的三处偏差（已核实）

为便于复用与纠错，把本篇发现的三处「任务清单前提与实际不符」集中登记：

| # | 任务清单的前提 | 实测结论 | 证据 |
|---|---|---|---|
| 1 | note `2026-09-19-python-sdk-directional-client.md` 属本版重点，应展开 | 该 note 状态为 **proposed**（路径 `.agents/notes/proposed/simplification/`），其删除项在 rc.1 全部**仍在**，`python/sdk/src` 零改动 | 上节 11.9.1 的 `Select-String` 双版本对照 + `git diff --name-status … -- python/sdk` |
| 2 | `docs/subsystems/mcp.md`、`docs/subsystems/lsp.md` 在本区间有变更 | 两份文档 base/head 都存在且**逐字节相同**，无变更 | 11.7.3 的三条命令 |
| 3 | `docs/user/guide/providers.md` 属 SDK 相关变更 | 全部差异是 Settings → Models 页面文案与配置落点（`settings.yaml` → `profiles/<profile>/cordis.patch.yml`），**与协议/SDK 无关** | 11.6.2 的 diff 引文 |

另有一处不属于「偏差」但需提醒读者：note `2026-09-18-plugin-install-registries.md`（本区间新增）确实带来 `remotes` 装配与转发事件的插件管理面变化（11.5.2），但**其协议细节属插件安装/注册表选择**，本篇仅从「新增的 5 个 mount 贡献 + 3 条转发事件 + `plugin-manager/*` 事件族」角度登记，插件契约与自持 webServer 路由请交叉引用第 09 篇。

---

## 附录：本版提交索引

以下提交均为 `git log --oneline --no-merges dsh-v0.1.6-alpha.1..dsh-v0.1.7-rc.1 -- <路径>` 的实测输出（`release(dsh)` 与 `build:` 类全仓提交属发布流程，不逐条解释）。

### A. 协议主干（`packages/api/gateway`、`packages/api/remotes`）

| 提交 | 主题 |
|---|---|
| `021bd03b70` | `feat(gateway): let every Remote stream carry a client uplink` ← 双工流主体 |
| `089004c418` | `test(gateway): cover the Remote uplink and document it` |
| `355df025d4` | `fix(gateway): harden the Remote uplink lifecycle` |
| `520c225b87` | `test(gateway): cover the uplink edge paths` |
| `ffea3c8818` | `fix(gateway): close the remaining uplink lifecycle gaps` |
| `35602063d7` | `refactor(typert): name the client stream handle RemoteStreamHandle everywhere` |
| `77f1a493aa` | `refactor(typert): keep the Remote marker mode as the 'stream' literal` |
| `7c74636892` | `perf(api-gateway): avoid duplicate client input parsing` ← 11.2 |
| `1bf048eb71` | `refactor(gateway): retain Session contexts through dispatch` |
| `8ce7c27671` | `refactor(connection): admit every request as the single operator Peer` ← `PeerScope` |
| `a44ced4b96` | `fix(web): gate Remote WebSockets on application readiness` ← `appReady` 门 |
| `4cfd292a7b` | `fix(gateway): bound stream cancellation retention` |
| `45f5cd34b0` | `fix(gateway): pass explicit undefined in retention test` |
| `ecf6acfb15` | `feat(api): support binary fields in Remote results` ← 11.3 |
| `e98b5703c7` | `refactor(api): move Remote result projection to gateway` |
| `068cf03441` | `Merge pull request #4648 from deepseek-harness/worktree/remote-duplex-stream` |
| `eaf0f68bb2` | `Merge pull request #4401 from deepseek-harness/perf/workspace-file-binary-transfer` |
| `580bdc7258` | `refactor: remove redundant unknown casts`（全仓，跨本篇多数包） |
| `d07182d3d8` / `5fbae69d18` / `5a8d3b7498` / `ebdc1609c6` | note 双语与伪代码 fence 标注（文档类） |
| `51d70c5f5c` | `feat(plugins): report incompatible versions as typed refusals` |
| `3c50bf6b6c` | `feat(plugin-manager): choose the first responsive public registry` |
| `dccf989cd8` | `feat(plugin-manager): prefer the mainland mirror for CN network exits` |
| `398a4247ae` | `feat(client): pick and remember the registry a plugin install asks first` |
| `b3e964c340` / `4d1adb8541` | 插件管理器并入 Web 侧边栏页 |

### B. 控制器组

| 包 | 代表提交 |
|---|---|
| `account-controller`（新） | `048297321a feat(desktop,credentials,client): integrate DeepSeek account sign-in and Platform pages` |
| `job-controller`（新） | `7ec142a325 refactor(jobs): move job observation into api-job-controller`；`2132b7beeb refactor(session-controller): drop the job roster from the control stream`；`0659ded55b refactor(job-controller): drop the subagent ownership fence from job.kill`；`0dca00b425 refactor(api,client)!: delete the activity plane; one job roster with record observation`；`4a79310339 feat(activity): optional live-output observation seam with a web viewer` |
| `session-controller` | `cbae324bfa feat(workspace): stop a Session's running work before archiving it (#4765)`；`809e0942b9 fix(session): retire confirmed steering echoes on resync`；`3b4ecc9d20 fix(chat): retain assistant nodes and steering echoes`；`50ba2c8bb2 fix(session): align history pagination with turn boundaries`；`820824edd7 fix(chat): stabilize input echo admission and ordering`；`08c0e8e71b fix(chat): deduplicate admitted local steering`；`1b55f5bea3 fix(chat): retain preparing tools and ordering until step completion`；`5a32aae571 docs(chat): align preparing hooks and work detail modes`；`f6966f8fab test(client): align resize fixtures and restore branch coverage` |
| `settings-controller` | `601d6761e4 feat(settings): project volatile Config through profile-backed forms (#4587)` |
| `terminal-controller` | `b25c5ad82e feat(web): restore sidebar layouts and reclaim unattended terminals`；`281723bed8 fix(web): isolate terminal bindings and validate saved layouts`；`ab695ef4cf feat(web): give user terminals system-user permissions`；`232ab768a9 perf(runtime): defer optional native dependencies` |
| `workspace-controller` | `4d2e420ef8 refactor(workspace): initialize the default workspace on startup`；`5294b15b31 docs(workspace): separate constructor parameter tags` |
| `workspace-files` | `5b13cba35c test(workspace-files): cover initially missing watch targets`；`4f55590aea fix(sidebar): correct automatic refresh and watch lifecycles` |

### C. 路由门与文档

| 提交 | 主题 |
|---|---|
| `29182514ed` | `fix(web): resolve feature routes from the document directory and gate browser routes` ← 11.4 |
| `771ebf4ace` | `fix(web): scan plain src for a dual-face browser package without src/client` |
| `eeb9b03465` | `feat(web): serve the shell, API and plugin resources from the document directory`（上游决策的落地） |
| `d1e22a7e24` | `feat(preset): declare Agent compositions in profile YAML (#4569)`（`agent-presets` → `agent-preset-registry` 更名的传播源） |

### D. SDK / MCP / ACP / Webhook / Python

| 提交 | 主题 |
|---|---|
| `ab102138c8` | `fix: retain ordered tool text and images within a token budget` ← MCP 投影时机 |
| `c4c18ef0d4` | `test: align retention checks and catalogs with token budgets` |
| `94728ebd23` | `fix: repair multimodal retention CI resolution and coverage` |
| `fb79a944f5` | `refactor(llm): separate durable producer sources from request inputs`（ACP 事件结构上游） |
| `f4a32dbd0a` | `refactor(llm): flatten tool results and validate native V4 sessions` |
| `99e22ebbeb` | `refactor(llm): make the official DeepSeek adapter Messages-only` |
| `8696ec6cef` | `feat(session): fork exact event prefixes with synthetic tail results` |
| `a978ad1994` | `fix(subagent): version unknown catalog payloads locally` |
| `f984683956` | `fix(subagent): store unknown mode in the existing catalog event` |
| `17a52a8fe3` | `fix(subagent): retain unreadable children in migrated catalogs` |
| `37983d9298` | `feat(sdk): bundle shared Office authoring resources` ← Python runtime |
| `defb9c3736` | `fix(sdk): shorten bundled Python resource paths on Windows` |
| `5e25475857` | `fix(office): use bundled LibreOffice Kit 0.1.0 CLI across deployments (#4902)` |
| `6e49ccad18` | `feat(skill): extract the workspace-dependencies tool into a package` |
| `fcc6cc8c12` | `docs(boot): align runtime-only resolution contracts` |

**区间边界提交**（base / head，供复核）：

```
base  dsh-v0.1.6-alpha.1 = 0a15e36e7f82b6ed45af6fa9759f29b40dcd965d
head  dsh-v0.1.7-rc.1    = 46a7f68b0922371ce7144b668b90e377d8e799f4
release(dsh): 0.1.7-rc.1 = a60af51e80
```

---

### 本篇「未核实」项汇总

1. **note `2026-09-19-remote-duplex-stream.md` 的 609 行全文未逐行读完**——该文件在读取时被上下文压缩，我据以立论的部分（`Problem`、`Decision`、类型签名、终帧规则、错误码表、`Consequences`、测试段落）来自压缩后可见的片段与源码/README 的交叉印证；其中未展开的中间章节（如 `Host face` 的完整状态机图）未逐一核对。
2. **`session-controller` 65 个文件未逐行读完**，仅核实了「作业平面迁出」「归档会话准入门」「Client 投影与引用归属」三条主线及其文件级增删（见 11.5.3）。
3. **`packages/api` 各控制器包的 README 未与源码逐句对齐验证**（我只对 gateway、workspace-files、terminal-controller 三份 README 做了区间 diff 与源码抽查）。
4. **二进制附件在 Connection 侧的组帧实现细节未核实**——`docs/api-gateway.md` 与 note 都说 Connection 拥有 `FormData` 部件，但 `packages/client/connection` 不在本篇包范围内，我没有读它的源码来确认 multipart 的具体帧结构。
5. **`sdk/client` 的期望输出快照（`snapshots/`）本区间差异未比对**（见 11.6.1 末）。
6. **`python/sdk/tests/test_smoke_model.py`（+187/-…）与 `manual_sdk_agent_smoke.py`（+21/-…）改动内容未细读**——它们属 SDK 快照与冒烟路径，与协议面无直接关系，我未展开。
7. **`scripts/verify-client-route-resolution.ts` 我只读了前 110 行**（共 339 行），规则的实现细节（`unstrippedHostRouteKeys` 之后的判定与 `REFERENCE_PRODUCERS` 之后的遍历逻辑）未核实；本篇对该门的描述以它的文件头 JSDoc、`RouteResolutionRule` 类型、`HINT` 表与 note 原文为准。
