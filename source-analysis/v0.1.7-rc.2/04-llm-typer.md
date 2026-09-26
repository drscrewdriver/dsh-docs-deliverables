# 【第 04 篇】packages/llm · typert · credentials：模型能力族与类型接缝

> **基线说明**：本篇为 v0.1.7-rc.1 全量分析基线，rc.2 未改动本篇覆盖的系统性结构。v0.1.7-rc.2 的增量变更（约 335 个提交）请见同目录 `README.md` 与 `diff-vs-0.1.7-rc.1.md`。

> **版本**：dsh-v0.1.7-rc.1（`46a7f68b09`），对比上版 dsh-v0.1.6-alpha.1（`0a15e36e7f`）
> 难度：🟡 进阶（建议先读 v0.1.6-alpha.1 的第 02 篇与 `docs/architecture.md`）
> 包范围：`deepseek-harness/packages/llm/` 7 包 + `packages/typert/` 4 包 + `packages/credentials/` 5 包，共 16 包
> 上游文档：`docs/subsystems/llm-streaming.md`、`typert.md`、`credentials.md`、`docs/deepseek-llm-api-wire-extensions.md`、`docs/config-catalog.md`

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

本文覆盖三个包组，它们在架构上并不相邻，但共享同一个性质：**都是「接缝」（capability seam）的声明侧**。

- `packages/llm/` 是模型调用的能力族：`llm` 声明 provider-neutral 的会话/流式类型与 `LlmRuntime`，`llm-deepseek` 与 `llm-pi-ai` 是两个 Service Provider，其余四包分别是请求扩展、重试、token 计量与包清单贡献；
- `packages/typert/` 是跨进程类型接缝：Host 与 Client 两侧共享生成的类型描述符、schema 与 Remote 调用契约；
- `packages/credentials/` 是凭证接缝：配置只携带**引用**（环境变量名），provider 持有值，`authorization` 提供「如何获得一个凭证」的流程注册表，`deepseek-account` / `deepseek-account-platform` 是新增的账号登录族。

本版三个包组合计 **207 个文件变更（+10,343 / −8,441）**，占全区间 `6083 files changed, +475425 / −133742` 的约 3.4% 文件量，但其中 `packages/llm/llm-deepseek` 一个包就占 **65 个文件（+4,834 / −7,191）**——净删除 2,357 行，是本版**代码净减少最多**的包之一。原因单一：Chat Completions 通道被整体移除。

本版的核心叙事可以压成三句话：

1. **DeepSeek 收敛为 Messages-only**——`src/protocols/` 目录消失，配置不再有 `protocol` 字段，Chat Completions 的 5 个源文件与其测试被删除；
2. **消息模型被「角色化」重排**——tool result 从 user 角色的嵌套 content block 提升为独立 `role: 'tool'` 消息，`MessageSource` 取消共用的 `plugin` 兜底 kind，并新增请求专用的 `RequestUserInput`；
3. **配置面从 settings section 改为 volatile Config 引用**——LLM 适配器不再 `installSection`，改由 `settings.configure({ auto: false })` + `loader/volatile-update` 驱动。

以下所有数字均由 `git diff`/`git log` 实测得到，所有文件路径均已 `Test-Path` 或读取确认存在。

---

## 概述

### `packages/llm/`（7 包，137 文件，+6,113 / −8,187）

`llm` 组提供 harness 的模型调用能力（官方表述见 `packages/llm/README.md`）：一个 provider-neutral 的流式服务，加一组 provider 适配器。

| 角色 | 包 | 说明 |
|---|---|---|
| Service Definition | `llm` | `ctx.llm`，`LlmRuntime`，消息/块/chunk 词汇表与 `BlockAssembler` |
| Service Provider | `llm-deepseek` | `deepseek-official` 路由，直连 DeepSeek Messages |
| Service Provider | `llm-pi-ai` | 按配置的 provider 路由，经 pi-ai catalog 与线协议 |
| 请求扩展点 | `deepseek-llm-api-extensions` | `ctx.deepseekLlmApiExtensions`，向官方请求注册顶层字段 |
| 扩展消费方 | `plugin-package-inventory-deepseek` | 贡献 `dsh_plugin_packages` |
| 消费者 | `llm-retry` | 流式传输的恢复策略 |
| 消费者 | `token-meter` | `ctx.tokenMeter`，按会话折叠的 token 估算 |

### `packages/typert/`（4 包，39 文件，+1,264 / −196）

| 角色 | 包 | 说明 |
|---|---|---|
| 协议与类型 | `protocol` | `Remote*` 类型、`bindTypertRemote`、`TypertRemoteService`、gateway 错误码 |
| 生成器 | `generator` | 从 TypeScript 类型图生成 schema 与 invocation descriptor |
| 注册表 | `registry` | `ctx.typert`，schema/package/lookup 的运行时注册表 |
| 装配 | `loader` | 校验包 manifest 里导出的 TYPERT 贡献 |

本版 typert 是**唯一净增**的接缝组（+1,068 行），功能集中在「Remote 双向流」与「schema 延迟物化」。

### `packages/credentials/`（5 包，31 文件，+2,966 / −58）

| 角色 | 包 | 本版性质 |
|---|---|---|
| Service Definition | `credentials` | 仅 `package.json` 版本号变动 |
| Provider | `credentials-local` | 删除 4 处 `jscpd:ignore` 注释块（−18 行），无行为变更 |
| Service Definition | `authorization` | 新增 `AuthorizationSession.commit()` 与 `committing` 标志 |
| Service Definition | `deepseek-account` | **新增包**（7 文件，+348） |
| Service Provider | `deepseek-account-platform` | **新增包**（15 文件，+2,475） |

两个新增包是 `deepseek-account` 接缝的 Definition/Provider 对，消费方是 `packages/api/account-controller` 与 `packages/llm/llm-deepseek`（见 `docs/capability-seams.md` 的本版新增行）。

---

## 核心概念

| 术语（首次出现附英文） | 含义 | 本版是否受影响 |
|---|---|---|
| 能力缝（capability seam） | Service Definition / Provider / Consumer 三角色；本文三组均为声明侧 | 新增 `ctx.deepseekAccount` 一条缝 |
| Messages / Chat Completions | DeepSeek 的两条线协议；前者为 Anthropic Messages 标准 | **Chat Completions 被移除** |
| Messages API root | `baseURL` 之下 Messages 资源的根；本版由共享 owner 解析 | **新增 `messages-api.ts`** |
| replay metadata（重放元数据） | assistant 消息携带的 provider/model/signature，供原生 thinking 回放 | 语义收窄为 Messages 专用 |
| 消息来源（message source） | 生产者声明的 `kind`；决定消费者如何解读消息 | **取消 `plugin` 兜底 kind** |
| 请求专用输入（request-only input） | 只有一次请求身份、无 Session 身份与来源的 user 内容 | **本版新增 `RequestUserInput`** |
| developer 消息 | `role: 'developer'`，承载工具增删等增量会话变更 | **本版新增角色** |
| deferred tool loading | 工具定义延迟载入模型上下文（Anthropic `defer_loading` 术语） | **本版新增 `ToolSchema.deferLoading`** |
| Remote uplink | 同一条逻辑流上 Client→Host 的反向项 | **本版新增** |
| schema factory | 以 `create()` 替代直接持有 zod 实例，首次使用时物化 | **本版新增** |
| 授权流（AuthorizationFlow） | 「如何获得一个凭证」的注册单元，一键一流 | 新增 `commit()` 提交点 |
| GrantRecord | 授权产出的凭证记录，owner-scoped | 未变（`credentials/src/types.ts:52`） |
| inference origin | 允许账号 token 认证的推理目标源 | **本版新增配置** |
| 保留预算（retention budget） | 工具结果进入模型上下文前的估算 token 上限 | **本版由字节制改为 token 制** |

---

## 包结构

### `packages/llm/`

| 包 | 职责 | 本版改动规模 |
|---|---|---|
| `llm` | 消息/块/chunk 词汇表、`LlmRuntime`、`BlockAssembler` | 16 文件（+422 / −284）；**新增** `src/message.ts` 的角色化重排。`src/content.ts` 102 行、`src/message.ts` 127 行、`src/types.ts` 55 行 |
| `llm-deepseek` | `deepseek-official` 路由，Messages 直连 | **65 文件（+4,834 / −7,191）**；删除 13 个条目 = 6 个源文件 + 6 个 spec/e2e 文件 + 1 个二进制 fixture；新增 `src/messages-api.ts`；`src/` 下 `protocols/`、`common/` 两级目录被摊平 |
| `llm-pi-ai` | pi-ai catalog 与线协议路由 | 30 文件（+641 / −529）；**新增** `src/models.ts`（67 行）；`src/context.ts` 149 行、`src/index.ts` 78 行 |
| `deepseek-llm-api-extensions` | 注册官方请求顶层字段 | 4 文件（+7 / −7）；**源码零改动**，仅 README 与 package.json |
| `plugin-package-inventory-deepseek` | 贡献 `dsh_plugin_packages` | 7 文件（+33 / −41）；`src/index.ts` 4 行（import 目标改名） |
| `llm-retry` | 传输恢复 | 2 文件（+77 / −39）；**源码零改动**，仅 `tests/transport-recovery.spec.ts`（+60）与 package.json |
| `token-meter` | token 估算与 surface 折叠 | 10 文件（+95 / −92）；`src/estimate.ts` −3、`src/surface-fold.ts` −4 |

### `packages/typert/`

| 包 | 职责 | 本版改动规模 |
|---|---|---|
| `protocol` | Remote 类型与 gateway 契约 | 12 文件（+377 / −23）；**新增** `src/json-value.ts`（53 行）、`src/owned-value.ts`（39 行）、`tests/owned-value.spec.ts`；`src/types.ts` 141 行 |
| `generator` | 类型图 → schema/descriptor 生成 | 14 文件（+729 / −90）；`src/emitter.ts` 213 行、`src/analyzer.ts` 114 行；`tests/remote-model.spec.ts` 374 行 |
| `registry` | `ctx.typert` 运行时注册表 | 7 文件（+107 / −42）；`src/service.ts` 50 行、`src/types.ts` 13 行 |
| `loader` | TYPERT manifest 校验 | 6 文件（+51 / −41）；`src/index.ts` 16 行（校验规则从 `_zod` 探测改为 `create()` 工厂探测） |

### `packages/credentials/`

| 包 | 职责 | 本版改动规模 |
|---|---|---|
| `deepseek-account` | **新增**：账号 Service Definition | 7 文件（全部新增，+348）；`src/index.ts` 106 行、`src/types.ts` 47 行 |
| `deepseek-account-platform` | **新增**：浏览器授权 provider | 15 文件（全部新增，+2,475）；`src/index.ts` 492 行、`src/protocol.ts` 200 行、`src/details.ts` 57 行、`src/logout.ts` 37 行；`tests/account.spec.ts` 1,201 行 |
| `authorization` | 授权流注册表 | 6 文件（+125 / −22）；`src/index.ts` 30 行、`tests/authorization.spec.ts` 87 行 |
| `credentials-local` | 文件型凭证 provider | 2 文件（+12 / −30）；**仅删除 4 处 `jscpd:ignore` 注释块** |
| `credentials` | 凭证 Service Definition | 1 文件（+6 / −6）；仅 package.json |

**验证命令**（本表所有数字的来源）：

```powershell
git -C E:\test\rewrite-agently\deepseek-harness diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/llm packages/typert packages/credentials
#  207 files changed, 10343 insertions(+), 8441 deletions(-)
git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/llm        # 137 files, +6113 / -8187
git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/typert     #  39 files, +1264 /  -196
git diff --shortstat dsh-v0.1.6-alpha.1 dsh-v0.1.7-rc.1 -- packages/credentials #  31 files, +2966 /   -58
```

包数由目录枚举核实：`Get-ChildItem packages\llm -Directory` → 7 项；`typert` → 4 项；`credentials` → 5 项。16 个包的 `package.json` 版本全部为 `0.1.7-rc.1`（实测于工作区快照）。

---

## 关键类型

**片段 A：`llm-deepseek` 的配置面已无协议选择器（`packages/llm/llm-deepseek/src/config.ts:28-67`）**

```ts
/**
 * Plugin config, validated by the same-named schemastery schema and doubling
 * as the `llm-deepseek` settings-section shape. …
 */
export interface Config {
  apiKeyEnv: Volatile<string>
  baseURL: Volatile<string | undefined>
  thinking: Volatile<'enabled' | 'disabled' | undefined>
  reasoningEffort: Volatile<'off' | 'low' | 'high' | 'max' | undefined>
  maxTokens: Volatile<number>
  defaultContextWindow: Volatile<number>
  models: Volatile<DeepSeekCatalogModel[]>
  // … 图像/Files 预算与 retryPolicy
}
```

对比上版，`Config` 中已无 `protocol` 字段。`resolveAdapterOptions()` 反而**主动拒绝**这个键（`config.ts:213-217`）：

```ts
export function resolveAdapterOptions(config: Options, environment?: LaunchEnvironmentSnapshot): ResolvedDeepSeekOptions {
  // Settings updates can reach this resolver without schema validation.
  if (Object.hasOwn(config, 'protocol')) {
    throw new Error('llm-deepseek: protocol is not configurable; remove it and use a Messages-compatible baseURL')
  }
```

**片段 B：Messages API root 的唯一解析规则（`packages/llm/llm-deepseek/src/messages-api.ts:4-14`）**

```ts
/** Required opt-in for Messages file operations and file-referenced image requests. */
export const MESSAGES_FILES_BETA = 'files-api-2025-04-14'

/**
 * Resolve the API root without duplicating an explicit provider version path.
 */
export function messagesApiRoot(baseURL: string): string {
  const base = baseURL.replace(/\/+$/u, '')
  return new URL(base).pathname.endsWith('/v1') ? base : `${base}/v1`
}
```

配套的官方根在 `config.ts:114-115`：

```ts
/** Public API default; the internal endpoint comes from $DEEPSEEK_BASE_URL. */
export const PUBLIC_BASE_URL = 'https://api.deepseek.com/anthropic'
```

上版导出的 `MESSAGES_BASE_URL` 常量在本版已被删除（`src/index.ts` 导出清单 diff），只保留 `PUBLIC_BASE_URL`。

**片段 C：Messages 历史 tool input 的容错（`packages/llm/llm-deepseek/src/serialize.ts:14-24`）**

```ts
/** Historical arguments that Messages cannot represent use empty input; durable content stays unchanged. */
function toolInput(raw: string): Record<string, unknown> {
  let value: unknown
  try { value = JSON.parse(raw) } catch (_invalidToolHistoryJson) {
    return {}
  }
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}
```

**片段 D：Messages 输入历史的块级丢弃（`serialize.ts:60-63`、`:112`）**

```ts
  const input = (blocks: readonly ContentBlock[]): WireInput[] => blocks.flatMap((block): WireInput[] => {
    if (block.type === 'text') return block.text ? [{ type: 'text', text: block.text }] : []
    if (block.type === 'reasoning' || block.type === 'tool-call') return []
    if (block.type !== 'image') return unsupported(`user/tool-result content ${block.type}`)
```

（`const input = (blocks: readonly ContentBlock[]): WireInput[] => blocks.flatMap(…` 起于 `serialize.ts:60`。）

```ts
    if (message.role === 'user' && content.length === 0) continue
```

即：user 与 tool-result 输入中的 `reasoning` / `tool-call` 块被**静默省略**，空 user 消息跳过，其余不支持的块仍以 `UNSUPPORTED_CONTENT` 硬失败。

**片段 E：消息角色图闭合（`packages/llm/llm/src/message.ts:157-193`）**

```ts
/** Incremental agent session changes in conversation order, currently tool additions and removals. */
export interface DeveloperMessage extends MessageBase {
  readonly role: 'developer'
}

/** A first-class tool-role message carrying the result of one tool invocation. */
export interface ToolResultMessage extends MessageBase {
  readonly role: 'tool'
  readonly source: ToolMessageSource
  /** Provider-issued id of the tool call this message answers. */
  readonly toolCallId: ToolCallId
  /** Whether the tool invocation failed. */
  readonly isError?: boolean
}

/**
 * The conversation messages persisted by Session, keyed by role. This map is
 * closed because every model-visible role must have a durable Session event
 * and an adapter projection.
 */
export interface MessageRoleMap {
  system: SystemMessage
  developer: DeveloperMessage
  user: UserMessage
  assistant: AssistantMessage
  tool: ToolResultMessage
}
```

上版 `ToolResultMessage` 的 `role` 是 `'user'`、`content` 是 `[ToolResultBlock]`；本版是 `role: 'tool'` 加独立 `toolCallId` / `isError` 字段。`ContentBlockMap` 中 `'tool-result'` 被 `'tool-addition'` / `'tool-removal'` 取代（`packages/llm/llm/src/types.ts:115`、`:127`）。

**片段 F：source kind 不再有 `plugin` 兜底（`packages/llm/llm/src/message.ts:35`，`docs/subsystems/llm-streaming.md` 本版 diff）**

```ts
/** Required source of a system-role message produced by the system-prompt plugin. */
export interface SystemPromptMessageSource {
  kind: 'system-prompt'
}
```

`MessageSourceMap` 本版为 `user` / `model` / `tool` / `'system-prompt'` 四项，上版的 `plugin: { kind: 'plugin'; plugin: string } & ContextFormed` 被删除。

**片段 G：请求专用 user 输入（`packages/llm/llm/src/types.ts:475-483`）**

```ts
/** User input for one LLM request; it has no durable Session identity or source. */
export interface RequestUserInput {
  readonly role: 'user'
  readonly content: UserMessage['content']
  readonly id?: never
  readonly source?: never
}

/** A durable conversation message or a user input used only for one request. */
export type RequestMessage = Message | RequestUserInput
```

`GenerateOptions.messages` 的类型随之从 `Message[]` 变为 `RequestMessage[]`；`llm/src/index.ts` 中 `forAdapter()`、文件投影与 `projectFilesToText()` 全部改走 `RequestMessage` 重载（`packages/llm/llm/src/content.ts` 本版新增了第二个重载签名）。

**片段 H：模型发现携带输入模态（`packages/llm/llm/src/types.ts:323-327`、`:467`）**

```ts
export interface LlmDiscoveredModel {
  contextWindow?: number
  /** Maximum output tokens, when disclosed. */
  maxTokens?: number
  /** Accepted input types when disclosed by the catalog or endpoint; absent means unknown. */
  inputModalities?: readonly ModelModality[]
}
```

```ts
export interface ToolSchema {
  /**
   * Requests deferred loading of the tool definition into model context,
   * independently of whether a tool-addition block records the tool.
   * Uses Anthropic's defer_loading terminology.
   */
  deferLoading?: true
```

**片段 I：Remote 双向流（`packages/typert/protocol/src/types.ts:93`、`:106`、`:397`）**

```ts
export type RemoteStream<Out, In = never> = AsyncIterable<Out> & { readonly [STREAM_UPLINK]?: In }

export interface RemoteStreamHandle<Out, In> extends AsyncIterable<Out> {
  send(item: In): void
  end(): void
  dispose(): void
}

export interface RemoteInvocation {
  readonly request: { readonly namespace: string; readonly method: string; readonly args: Readonly<Record<string, unknown>> }
  readonly service: string
  readonly peer: PeerScope
  readonly signal: AbortSignal
  uplink<In = unknown>(): AsyncIterable<In>
}
```

`PeerId` 定义在同文件 `:375`，`ctx.invocation` 通过 declaration merging 挂到 Cordis `Context` 上，并由 `provideInvocationAccessor()` 在非 Remote 调用时读取为 `undefined`（`packages/typert/protocol/src/index.ts`）。

**片段 J：schema 由实例改为工厂（`packages/typert/registry/src/types.ts`、`service.ts:642`）**

```ts
/** One generated Zod schema factory. */
export interface TypertSchemaFactory {
  readonly name: string
  /** Materialize and return the process-realm schema on first use. */
  readonly create: () => z.ZodType
}
```

```ts
function materializeSchema(record: TypertSchemaFactoryRecord): TypertSchemaRecord {
  const schema = record.value ??= record.create()
  return { name: record.name, schema, package: record.package, face: record.face, key: record.key }
}
```

**片段 K：账号接缝的 Host-only 凭证解析（`packages/credentials/deepseek-account/src/index.ts:71`）**

```ts
  /**
   * Resolve a credential only for the inference origin allowed by the provider.
   * @param url - actual request destination or API base URL.
   * @returns stored token, or undefined for other origins or a signed-out account.
   */
  abstract resolveToken(url: string): Promise<string | undefined>
```

**片段 L：DeepSeek 适配器接入账号 token（`packages/llm/llm-deepseek/src/index.ts:95`、`adapter.ts:83`）**

```ts
    resolveAccountToken: connection => ctx.get('deepseekAccount')?.resolveToken(connection.baseURL) ?? Promise.resolve(undefined),
```

```ts
    const accountToken = await this.dependencies.resolveAccountToken?.(connection)
    const key = accountToken ?? await this.dependencies.resolveApiKey(connection)
```

**片段 M：工具结果保留预算（`packages/spill/spill-policy/src/index.ts:24-28`）**

```ts
/** Optional result-retention budget. */
export interface Config {
  /** Maximum estimated tokens in a retained result, including image descriptors and omission notices. Omitted disables retention. */
  maxInlineTokens?: number
}
```

出货默认值在 `packages/bundle/base/cordis.patch.yml:406-409`：

```yaml
    - id: spill-policy
      name: '@deepseek-ai/dsh-spill-policy'
      config:
        maxInlineTokens: 12500
```

---

## 数据流

### 1. 一次 DeepSeek Messages 请求（本版路径）

```
agent-loop / 其他调用方
  └─ ctx.llm.stream(options)                        packages/llm/llm/src/index.ts
       ├─ forAdapter()：剥离非本适配器的 replayState   (:974 附近)
       ├─ projectFilesToText()：file 块 → handle 文本  packages/llm/llm/src/content.ts
       └─ dispatch → DeepSeekAdapter.generate()
            ├─ idleWatchdog(signal, streamIdleTimeoutMs, 'MESSAGES_IDLE')
            ├─ prepareImages()        → 请求级图像版本
            ├─ resolveAccountToken()  → 账号 token（优先）
            │   否则 resolveApiKey()  → 凭证引用解析
            ├─ 循环（最多一次降级）:
            │    ├─ prepareFileIds()  ──失败──▶ inline = true ──▶ 重建整个请求为 inline base64
            │    ├─ serialize()       → Messages JSON body
            │    ├─ prepareRequestExtensions()  → 顶层扩展字段
            │    ├─ fetch(`${messagesApiRoot(baseURL)}/messages`, { redirect: 'error' })
            │    │    headers: x-api-key | x-dsh-auth-token, anthropic-version,
            │    │             anthropic-beta: MESSAGES_FILES_BETA（含 file id 时）
            │    ├─ 非 2xx：files.retry(detail) → 换一次替换请求；否则抛 LlmError
            │    ├─ extensions.accept()
            │    └─ translate(parseSse(body)) → StreamChunk
            └─ finally: consumer.abort(); iterator.return()
```

关键点：`redirect: 'error'` 在**每一次** fetch 上生效（`adapter.ts`），因此凭证不会跟随 302 离开配置的源。账号 token 与 API key 二选一，且优先账号 token。

### 2. 消息从 Session 到 provider

```
Session V4 事件（role: 'tool' 独立消息）
  └─ deriveMessages() → MessageRoleMap 中的具名类型
       ├─ system  → SystemMessage（source: 'system-prompt'）
       ├─ developer → DeveloperMessage（tool-addition / tool-removal 块）
       ├─ user / tool / assistant
       └─ 请求装配时叠加 RequestUserInput（带外、无 Session 身份）
            └─ provider 适配器按 role 映射：
                 tool      → Messages 的 tool_result（wireRole 折回 user）
                 assistant → text / thinking / tool_use
                 user      → 只保留 text / image
```

`serialize.ts` 里还维护一个未决工具调用集合：assistant 的 `tool_use` 建集，随后 user 侧的 `tool_result` 必须逐一消费；history 结束时未消费即 `INVALID_REQUEST`。tool-result 在 wire 上折回 `user` 角色，并被重排到同消息的前部。

### 3. Remote 双向流（typert 本版）

```
Client                                     Host
  stream 方法被调用
  ├─ 打开逻辑流（生成 Client 端 RemoteStreamHandle）
  ├─ handle.send(item) ──uplink──▶  InvokeRemoteRequest.uplink
  │                                   └─ invocation.uplink<In>() 单消费者迭代
  ◀───────── downlink items ─────────  Host 方法 yield
  ├─ handle.end()   → Host 侧迭代结束
  └─ handle.dispose() → 发 cancel 帧、安静结束 downlink
```

背压由 `InvocationDescriptor.uplink.codec` 校验每个上行项；溢出以 `gateway/uplink-overflow` 失败（错误码本版新增，见 `docs/subsystems/typert.md` diff）。

### 4. 账号登录（credentials 本版）

```
UI（Web/Desktop）
  └─ startSignIn(locale, callbackOrigin, loginSource)
       └─ platform provider
            ├─ Host webServer 注册临时 /oauth/callback 路由
            ├─ auth_init → 浏览器授权
            ├─ 回调：校验 state，S256 PKCE 换取 code
            ├─ session.commit(record)  ← 本版新增提交点
            │    committing = true 后，取消不再中断提交
            └─ 重定向至 auth_exchange.biz_data.authorized_url
  signOut()
       ├─ 先删本地 grant（本地删除成功才发布已登出状态）
       └─ 后台 POST /auth-api/v0/users/logout（最多 5 次退避重试）
```

`resolveToken(url)` 只在 `url` 的 origin 等于 `inferenceOrigin`（默认 `https://api.deepseek.com`）时返回 token（`deepseek-account-platform/src/index.ts:227`）。

---

## 测试覆盖

以下为工作区快照中 `tests/` 下的 `*.spec.ts` 与 `*.e2e.ts` 文件数与总行数（实测，**未执行**——本文只统计规模，不主张用例通过）。

**计数方法说明（重要）**：本机 shell 为 Windows PowerShell 5.1，`Get-Content | Measure-Object -Line` 与 `(Get-Content).Count` 在读取 **UTF-8 无 BOM** 且含非 ASCII 字符的文件时会**少算**行数（本文写作过程中实测到 931 行的文档被算成 752 行）。因此下表使用 `[System.IO.File]::ReadAllLines(<file>).Count` 逐文件求和——该方法与 `git diff --numstat` 对同一文件的结果完全一致。

| 包 | spec/e2e 文件 | 行数 |
|---|---|---|
| `llm/llm-deepseek` | 17 | 6,576 |
| `llm/llm-pi-ai` | 16 | 6,221 |
| `llm/llm` | 13 | 3,703 |
| `llm/token-meter` | 5 | 2,437 |
| `llm/llm-retry` | 5 | 1,880 |
| `llm/plugin-package-inventory-deepseek` | 1 | 244 |
| `llm/deepseek-llm-api-extensions` | 1 | 154 |
| `typert/generator` | 8 | 4,732 |
| `typert/loader` | 1 | 731 |
| `typert/registry` | 1 | 625 |
| `typert/protocol` | 2 | 478 |
| `credentials/credentials-local` | 6 | 1,504 |
| `credentials/deepseek-account-platform` | 4 | 1,403 |
| `credentials/authorization` | 2 | 635 |
| `credentials/credentials` | 2 | 121 |
| `credentials/deepseek-account` | 0 | 0 |

（`credentials/deepseek-account` 是纯抽象 Service Definition，无自带测试；其行为由 provider 侧的 `account.spec.ts`（1,201 行，`git diff --numstat` 实测）覆盖。）

本版测试侧的三个显著变化：

1. **`llm-deepseek` 测试被大幅重写且总量收缩**：`tests/adapter.spec.ts` 从 **2,355 行缩到 503 行**（其中仅 64 行未变：`git diff --numstat` 为 `439 2291`，2355 − 2291 = 503 − 439 = 64）；`tests/serialize.spec.ts` 从 775 行缩到 458 行；同时**新增** `tests/runtime.spec.ts`（2,340 行，`--numstat` 实测）与 `tests/runtime.e2e.ts`（462 行）。净效果：删除 6 个 spec/e2e 文件、新增 2 个更大的运行时测试文件——测试重心从「逐协议序列化」转为「端到端运行时行为」；
2. **协议拒绝被显式钉住**：`tests/dynamic-config.spec.ts:310` 用 `it.each(['messages', 'chat-completions'])` 断言**两个**取值都被拒——不仅是被删掉的 `chat-completions`，连上版的默认值 `messages` 也一并拒绝，因为该键整体不再存在；
3. **保留策略有专门的图文恢复测试**：`packages/spill/spill-policy/tests/multimodal.spec.ts`（220 行）与 `multimodal-recovery.spec.ts`（209 行）为本版新增，后者第 35 行定义 `const CAP = 12500`，与出货配置一致。

`llm-retry` 与 `deepseek-llm-api-extensions` 本版**源码零改动**，前者只有 `tests/transport-recovery.spec.ts` +60 行，说明传输恢复的策略面在本区间内没有语义变更。

---

## 与上下游的关系

### 上游（本接缝消费别人的什么）

- `ctx.llm` 的上游是 `packages/core/agent-loop` 与 `packages/compaction/compaction-basic`（`docs/capability-seams.md` 的 `ctx.llm` 行），它们消费 provider-neutral 的流服务；
- 适配器消费 `ctx.credentials`（凭证引用）、`ctx.attachments`（图像）、`ctx.fs`（图像读路径）、`ctx.settings`（配置投影）、`ctx.launchEnvironment`（`$DEEPSEEK_BASE_URL`）；
- 本版**新增**消费 `ctx.deepseekAccount`：`deepseek-official` 路由现在可以拿账号 token（`docs/capability-seams.md` 本版新增边 `svc_deepseekAccount --> pkg_llm_deepseek`）；
- `typert` 的上游是 `packages/api/gateway`（`ctx.typertGateway` 由 gateway 提供），downstream 是 `typert-loader` 与其它运行时消费者；
- `credentials` 的上游是 `packages/api/settings-controller`（`ctx.credentialsController`），本版新增 `packages/api/account-controller` 消费 `ctx.deepseekAccount`。

### 下游（谁消费本接缝）

- `ctx.token-meter` 被 `compaction-basic` 消费（`docs/capability-seams.md`）；
- `spill-policy` 消费 `ctx.llm` 的 `imageRequestPricing()` 与 `dsh-token-meter/estimate` 的 `estimateContent()`——这是「多模态保留」把文本与图像放在**同一**预算下比较的实现基础；
- `tool-cordis`（`packages/extensions/tool-cordis/src/api-catalog.ts`）把本版新增的公共类型镜像进 Cordis API 目录，例如 `api-catalog.ts:5626` 的 `PeerId`、`:5930` 的 `RequestMessage`、`:5938` 的 `RequestUserInput`。这意味着本版的类型变更**同时**改变了对外暴露的 Cordis API 面。

### 一条被削弱的边

`docs/capability-seams.md` 本版 diff 删除了两行：

```
-  svc_settings --> pkg_llm_deepseek
-  svc_settings --> pkg_llm_pi_ai
```

原因是两个 LLM 适配器不再通过 `settings.installSection()` 注册自己的配置节。它们改走 `loader/volatile-update` 事件，并用 `settings.configure({ auto: false }, ctx.fiber)` 把 volatile Config 投影成表单（`packages/llm/llm-deepseek/src/index.ts`、`packages/llm/llm-pi-ai/src/index.ts` 各自的 `apply()` 首行）。相应地，`ctx.settings` 那一行的 Consumer 列表里也不再列出这两个包。

---

## 本版本变更要点（0.1.6-alpha.1 → 0.1.7-rc.1）

### 1. DeepSeek 收敛为 Messages-only（已核实）

**结论：`chat-completions` 通道被彻底移除，不是「默认关闭」，而是代码与配置面都不再存在。**

证据链（四层，逐层可复核）：

1. **目录层**：`packages/llm/llm-deepseek/src/protocols/` 在 v0.1.7-rc.1 已不存在（`Test-Path` → `False`）。上版该目录下有 `chat-completions/`（5 文件）与 `messages/`（8 文件）两个子目录；本版 `src/` 是 23 个平铺文件。
2. **删除清单**：`git diff --name-status` 显示以下源文件被删除（行数为删除行数）：
   - `src/protocols/chat-completions/adapter.ts`（−379）
   - `src/protocols/chat-completions/serialize.ts`（−443）
   - `src/protocols/chat-completions/sse.ts`（−40）
   - `src/protocols/chat-completions/translate.ts`（−210）
   - `src/protocols/chat-completions/types.ts`（−183）
   - `src/protocols/messages/adapter.ts`（−152，被摊平后的 `src/adapter.ts` 取代）
3. **符号层**：对 `packages/llm/llm-deepseek/src/*.ts` 检索 `chat-completions|chatCompletions|ChatCompletions|completions` → **0 命中**。
4. **配置层**：`config.ts` 无 `protocol` 字段；`resolveAdapterOptions()` 对传入的 `protocol` 键直接抛错（`config.ts:215-217`）；`docs/config-catalog.md` 第 1439-1526 行的 `@deepseek-ai/dsh-llm-deepseek` 段落里没有 `protocol` 行；`docs/deepseek-llm-api-wire-extensions.md` 本版把首段从「on `deepseek-official` Messages and Chat Completions requests」改为「on `deepseek-official` Messages requests」。

**上版语境**（用于说明「收敛」而非「从一开始就如此」）：v0.1.6-alpha.1 的 `packages/llm/llm-deepseek/README.md` 写着 "with Messages by default, or select Chat Completions in Cordis YAML"，配置表里有 `| protocol | messages |` 一行，并有一整节 `### Choose a protocol`。本版这三处全部删除。

**决策记录**：`.agents/notes/implemented/simplification/2026-09-19-deepseek-messages-only.md`。其 Problem 段说明理由是「选择第二条传输会重复 serializer、流处理、Files 线格式、配置分支与 fixture，而这条路由并不需要额外能力」；Alternatives 段明确否决了「保留 Chat Completions 放在可选选择器后面」与「保留只有一个实现的通用 dispatcher」两种方案。

**兼容性影响（已核实的两点）**：
- 出货配置**不含** `protocol`：`packages/bundle/base/cordis.patch.yml:524-525` 的 `llm-deepseek` 条目只有 `id` 与 `name`，无 `config`；`packages/bundle/sdk-minimal/cordis.patch.yml:26-27` 同样如此。
- 但**用户侧存量配置会硬失败**：`tests/dynamic-config.spec.ts:310` 用 `it.each(['messages', 'chat-completions'])` 断言「存储的 protocol=<任一取值> 在适配器挂载时被拒」。README 的 "Failures and recovery" 一节为本版新增了排障指引，明确指向 `$DSH_HOME/profiles/<profile>/cordis.patch.yml` 与覆盖该条目的 home patch / 命令行 overlay。

**连带删除的默认模型**：本版 `models.ts` 的 `DEFAULT_MODELS` 只剩 `deepseek-flash`（text+image，声明 `systemPromptUpdate: 'in-history'`）与 `deepseek-v4-pro`（text-only）；上版默认列表里的 `deepseek-v4-flash` 与 `deepseek-v4-flash-vision-exp` 被移除。对应提交 `f2beb99c3b feat(llm): remove the V4 Flash and V4 Flash Vision Exp defaults`。`docs/config-catalog.md:1465` 的 JSDoc 也相应改为「defaults to V41 Flash and V4 Pro」。

### 2. Messages v1 base URL 的精确识别（已核实）

**结论：只把「恰好等于 `v1` 的最后一段路径」视为已有版本号，其余一律补 `/v1`；不再把任何 `v` + 数字后缀当作版本。**

实现即片段 B 的 `messagesApiRoot()`（`src/messages-api.ts:11-14`）：先 `replace(/\/+$/u, '')` 去掉尾部斜杠，再判断 `new URL(base).pathname.endsWith('/v1')`。

关键效果（直接来自 `2026-09-15-messages-v1-base-url.md` 的 Decision 段）：
- 官方 `https://api.deepseek.com/anthropic` → 解析为 `/anthropic/v1`，所以实际请求 `/anthropic/v1/messages`；
- 显式配置的 `…/anthropic/v1` **保持不变**，不再产生上版的 `/v1/v1/messages`；
- `v1beta` / `v2` / `v4` 等后缀**不被**当作版本号，会在其下再补 `/v1`。

同一解析结果也决定 Files 路径与**文件缓存身份**（`config.ts:299` 起把 `baseURL` 放进 `ResolvedDeepSeekOptions`，`request-files.ts` 用它构造 Files 请求），所以「Messages、Files 与文件缓存身份使用同一条确定性规则」是本版成立的一致性约束。

**配置边界**（`config.ts:299-303`）：`baseURL` 优先级为「显式值 → `$DEEPSEEK_BASE_URL`（仅受信环境层）→ `PUBLIC_BASE_URL`」，且必须是 HTTP(S)、无 credentials、无 query、无 fragment 的根；否则在解析期抛错。

### 3. Messages 历史 tool input 兼容（已核实）

**结论：只会出现在**出站历史**里的畸形 tool 参数被降级为 `{}`，调用 id / 名称 / 结果 / 原始 Session 记录全部保持不变。**

上版语境：Chat Completions 把工具参数存为字符串（含失败调用的畸形 JSON）；切到 Messages 后每个 `tool_use.input` 都需要对象。上版因此在 Messages serializer 里**拒绝**这类历史参数，后果是「一个历史参数会阻塞其后所有请求，即使工具已成功重试」。

本版实现是片段 C 的 `toolInput()`（`serialize.ts:16-24`）：非 JSON、非对象（含数组、`null`）一律返回 `{}`。它对齐了 pi-ai 的历史转换（note 明确写「follows the pi-ai history conversion」），并且**只影响出站历史输入**——新生成的 Messages 响应仍要求合法对象参数，输出上限截断仍保留既有剪枝行为。

note `2026-09-16-messages-historical-tool-input.md` 还声明它**取代**（supersedes）了 `2026-09-07-deepseek-messages-adapter.md` 中「拒绝历史参数」的决定。验证覆盖包括一条录制的 Session 快照 `snapshots/session/deepseek-messages-invalid-tool-history/snapshot.yml`（路径由 note 正文给出）。

**边界（未变）**：模型看到的是 `{}` 而不是原始畸形文本，回退是静默的；原始参数仍只在 Session 日志里可查，本版**不主张**无损 provider 输入。

### 4. Messages 输入历史兼容（已核实）

**结论：user 与 tool-result 输入中的 `reasoning` 与 `tool-call` 块被按**角色 + 块类型**省略；判断不看来源、不看创建时间。**

问题是已保存的 subagent 结算通知可能把子 agent 的 reasoning 与 tool call 带进父级 user 消息。Chat Completions 与 pi-ai 会忽略这些块，Messages 若拒绝就会「阻止其后所有包含同一历史的请求」；而 text-only 的结算生产者只能防止**新**通知携带这些块，无法修复已记录的消息。

实现是片段 D（`serialize.ts:63`）。note `2026-09-18-messages-input-history-compatibility.md` 给出的其余规则：
- 空 user 消息在转换后跳过，空 tool result **保留**其 call id 与 error 标志（`serialize.ts:112` 与 tool 分支）；
- **其它**不支持的块仍以 `UNSUPPORTED_CONTENT` 失败——「两个已知 assistant 块类型的兼容，不构成对未知插件内容的兼容承诺」；
- 该 note 部分取代了结算决策中「serializer 不容错」与 Messages adapter 决策中的输入拒绝。

**未解决的历史限制（官方显式保留）**：当对应的 user 输入被整体省略时，系统更新无法前移——移动它会改变其在对话中的位置并重写已发送的前缀，因此 `packages/llm/llm-deepseek/README.md` 的 "Known Limitations and Deferred Work" 保留了这条限制。序列化测试把这一点钉成断言：user 输入被整体省略时，无论在另一个 assistant 之前还是请求末尾，in-history update 都被拒绝。

### 5. thinking markdown：**实现不在本文包范围内**（已核实并定性）

本项需要明确澄清归属，因为 note 标题容易被误读为模型侧改动。

`.agents/notes/implemented/bug-fix/2026-09-17-thinking-markdown.md` 的 Decision 段第一句是「[MarkdownText](../../../../packages/client/ui-primitives/src/markdown/MarkdownText.tsx) owns a compact presentation variant」——**唯一的实现位置是 `packages/client/ui-primitives`**，属于第 10 篇（客户端）的范围。

实测证据：
- `packages/client/ui-primitives/src/markdown/MarkdownText.tsx:182` 新增 `variant?: 'body' | 'compact'`；
- 同文件 `:197-198` 用 `variant === 'compact' && css.compact` 与 `data-markdown-variant` 应用该变体；
- 该目录在区间内共 10 个文件变化（+447 / −77），含 `MarkdownText.module.css`（+155）、`render.tsx`（+144）、新增 `MarkdownDelegate.tsx`（62 行）、`file-link.ts`（32 行）、`local-image-syntax.ts`（29 行）；
- `packages/client/ui-chat/src/client/chat/ReasoningRow.module.css` 同区间变化（33 行）。

**宿主侧的影响面为零**：`packages/llm/` 只提供 `ReasoningBlock`（thinking 文本载体），本版 `reasoning` 块的结构、序列化与 replay signature 逻辑均无与「markdown 渲染」相关的改动；note 也明确写了「The parser, frozen-block cache, stored reasoning, and Session format do not change」。因此本文只登记该变更的存在与归属，具体排版机制留给第 10 篇。

### 6. 多模态 tool result 保留（已核实；主实现跨出本文三组）

**结论：保留策略从「字节上限」改为「估算 token 预算」，并把文本与图像放在同一个预算下按顺序保留首尾、省略中间。**

这是本版对工具结果进入模型上下文影响最直接的一项，但其主实现位于 `packages/spill/spill-policy`、`packages/core/tools` 与 `packages/mcp/mcp-client`，**不在本文三个包组内**。之所以在本篇展开，是因为它决定 `packages/llm` 的 `ContentBlock` 在真实请求里最终长什么样，且它消费 `token-meter` 与 `llm` 的图像计价接口。

三方改动（`git diff --stat` 实测，`packages/spill` + `packages/core/tools` + `packages/mcp/mcp-client` 合计 40 文件 +1,285 / −490）：

| 位置 | 变更 | 证据 |
|---|---|---|
| `packages/core/tools/src/schema.ts:515-522` | `projectContent` 契约改为「在执行**后、结果策略前**安装执行期预备内容」 | 新增 JSDoc；`defineTool` 在 `:603-605` 绑定该回调 |
| `packages/spill/spill-policy/src/index.ts:24-28` | `Config.maxInlineTokens`（估算 token 上限），省略即禁用 | `:49` 读取、`:113` 校验「最坏缺省提示是否已超预算」 |
| `packages/spill/spill-policy/src/retention.ts`（新增 104 行） | `retainContent()`：首尾各取一半预算，文本可切、图像不可切 | `:48` 函数签名、`:58`/`:75` 两端预算、`:95-97` 统计省略字节与省略图像数 |
| `packages/bundle/base/cordis.patch.yml:409` | 出货默认 `maxInlineTokens: 12500` | 取代上版的 50,000 字节设置（note Consequences 段） |
| `packages/mcp/mcp-client/src/tools.ts:237` | MCP 工具提供 `projectContent`，把预备好的图像装进结果 | 与 `:461` 的 `projectContent()` 投影函数配合 |

note `2026-09-21-multimodal-tool-result-retention.md` 记录的关键取舍：
- 顺序是「先安装预备内容，再跑 post-execute 策略」——反过来做会让文本保留使图像替换失效；
- 计价复用**当前路由**的图像计算器（`packages/spill/spill-policy/src/index.ts:57-70` 通过 `ctx.llm.imageRequestPricing(provider, model)` 取），因此图像成本与文本成本可比；
- 完整 spill 文件按序记录被接受的文本与可读附件路径，**不内嵌图像字节**（base64 会膨胀产物并重复附件存储）；
- 图像边界处未用完的空间**保持未用**，以维持首尾连续；
- 缺少图像计价或可读恢复路径时保留原结果并输出诊断。

出货结果预算 12,500 估算 token；文本估算仍是启发式的，provider 上报的用量才是权威。

### 7. 统一模型输入控件：宿主侧契约（已核实）

**结论：本篇只写宿主侧；两个复选框、标签与布局属第 10 篇。**

note `2026-09-16-unified-model-input-controls.md` 的改动是跨层的：UI 侧把 DeepSeek 与 pi-ai 两套 model row 渲染器合并为共享行（`packages/client`，第 10 篇），宿主侧则新增了一条**模态能力贯通链路**：

1. **类型**：`LlmDiscoveredModel.inputModalities?: readonly ModelModality[]`（`packages/llm/llm/src/types.ts:323-327`，JSDoc 明确「absent means unknown」）；
2. **prepared call 捕获**：`PreparedLlmCall` 新增 `readonly inputModalities?: readonly ModelModality[]`（`packages/llm/llm/src/index.ts:174-175`），使「模态」与 config、retry policy、`systemPromptUpdate` 一起在同一次注册代际里被捕获；
3. **运行时投影与能力闸门**：`LlmRuntime` 在回报模型发现结果时透传该字段（`packages/llm/llm/src/index.ts:618`），并用 `detachedModalities()`（`:714`、`:781`）做防御性拷贝；**最关键的是 `:1054-1058` 的能力闸门**：

   ```ts
   if (modelInfo.inputModalities !== undefined
     && !modelInfo.inputModalities.includes('image')
     && projectedMessages.some(message => contentHasImage(message.content))) {
     projectedMessages = projectImagesForTextModel(projectedMessages)
   }
   ```

   即：当模型明确声明不支持 `image` 时，`LlmRuntime` 在**派发前**把消息里的图像投影为文本占位符。这是本版「配置只声明上游能力」这一语义在运行时的执行点——能力声明不再只是 UI 提示，而是请求装配的实际分支条件；
4. **provider 侧填充**（`llm-pi-ai`）：`src/adapter.ts:284` 与 `:311` 分别从模型描述符与解析后模型填入 `inputModalities: [...model.input]`；`src/discovery.ts:283` 对发现结果做同样填充；
5. **DeepSeek 侧校验**（`config.ts:86` schema `inputModalities: z.array(z.union(MODEL_MODALITIES)).min(1).default(['text'])`，与 `:151-166` 的解析期校验）：
   - 不得为空数组；
   - 只允许 `'text'` 与 `'image'`；
   - 不得重复；
   - **text-only 模型不得声明图像请求限额**——`if (!hasImage && (model.imagePixelBudget !== undefined || model.imageMaxBytes !== undefined))` 直接抛错。这条正是 note 中「disabling DeepSeek images removes its image request limits because the adapter rejects those limits without image input」的落地位置。

**语义边界（note Consequences 段）**：配置只**声明上游能力**，不会给 text-only 模型增加图像处理；移除 pi-ai 的 input 声明可能随 catalog 或 provider 默认值改变**有效**能力；DeepSeek 关闭图像后需要重新配置图像限额。

### 8. 配置面重构：LLM 适配器不再安装 settings section（已核实）

这是本篇中最容易被忽略、但对配置行为影响最广的一项。

上版两个适配器都用 `settingsCtx.settings.installSection(ctx, NS, Config, config, { setSource, onChange, validate })`，各自维护 `current: () => Config` 闭包，并在解析失败时**保留上一份好配置**（`llm-deepseek` 有一段 `lastRaw` / `lastGood` 缓存与「keeping the last good configuration after an invalid settings section」日志）。

本版替换为：

```ts
ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)) })
const options = (): ResolvedDeepSeekOptions => resolveAdapterOptions(plainOptions(config), launchEnvironmentOf(ctx))
```

（`packages/llm/llm-deepseek/src/index.ts` 的 `apply()` 首两行；`plainOptions()` 定义在 `config.ts:76-78`。）

随之而来的行为变化：

| 面向 | 上版 | 本版 |
|---|---|---|
| 取值来源 | settings section 覆写 | volatile `Config` 引用的**当前值** |
| 失效策略 | 保留上一份好配置并每份坏快照记一次日志 | `ensureRegistrationFacts()` 捕获解析错误、记 `warn` 并 `return`，**当前注册不变**，每个请求各自在解析时失败 |
| 变更驱动 | `settings.installSection` 的 `onChange` | `ctx.on('loader/volatile-update', ensureRegistrationFacts)` |
| 变更前校验 | 由 section 的 `validate` 承担 | pi-ai 用 `ctx.on('internal/config', …)` 在提交前跑 `Config()` + `assertServiceable()` |
| capability-seams 声明 | `svc_settings --> pkg_llm_deepseek` / `--> pkg_llm_pi_ai` | **两行删除** |

DeepSeek README 的 "Dynamic configuration" 一节因此整段重写为「Connection options are captured from volatile Config references once per operation. Config validation rejects invalid candidates before form persistence.」；"Failures and recovery" 一节新增一段说明：被适配器校验拒绝的存储配置会让后续请求**持续失败直到修正**，而且「在 Models 卡片里保存其它字段不会移除未知属性」——必须直接编辑配置文件再靠 HMR 重载或重启 profile。

`llm-deepseek` 的 settings namespace 也不再硬编码：`settingsNs: ctx.fiber.entry?.options.id ?? NS`（pi-ai 同理，改为 `directoryEntries(profiles(), settingsNs)`），因此 profile 里给插件行起的 `id` 决定设置节名。

**一处文档一致性观察**：`packages/bundle/base/cordis.patch.yml:520-523` 的注释仍写「both resolve per request from the `llm-deepseek:` settings section over this entry」。本版实际机制已如上是 volatile Config 引用 + `settings.configure({ auto: false })`；该注释是否属滞后表述，区间内未见对应修改，**未核实**（我确认了注释文本与实际代码，但未核实作者意图）。

### 9. credentials：新增账号接缝与提交点（已核实）

#### 9.1 新增 `deepseek-account`（Service Definition）

`packages/credentials/deepseek-account/src/index.ts`（106 行）声明 `DeepSeekAccount extends Service`，提供 `getState` / `getProfile` / `getBalance` / `startSignIn` / `cancelSignIn` / `signOut` / `watch`，以及两个 **Host-only** 方法：`resolveToken(url)`（`:71`）与 `getPlatformSession()`。同文件还导出两个纯函数：`mergePlatformCookies()`（`:86`，按名合并 Cookie、保留无关 cookie）与 `desktopClientHeaders()`（`:103`，`win32` → `desktop-win`，`darwin` → `desktop-mac`）。

`PlatformSession`（`:13-20`）只含 `origin`、`token` 与可选的 `embeddedPageDist`、`requestHeaders`，并且 `docs/subsystems/credentials.md` 明确它「excluded from account-controller RPC, AccountView, and AccountDetails」——凭证只走 Host 侧。

#### 9.2 新增 `deepseek-account-platform`（Provider）

15 个文件、+2,475 行，是本版 credentials 组的绝对主体。配置面（`src/index.ts:31-60` 稀疏读取，实测行号）：

- `inferenceOrigin`，默认 `'https://api.deepseek.com'`（`:54`）；解析为 origin 后校验「无 credentials、无 path、无 query、无 fragment」（`:108-113`）；
- `logoutMaxRetries`，`min(0).max(5).step(1)`，默认 `5`（`:60`）；
- 另有 `platformOrigin`、`allowLoopbackHttp`、`requestTimeoutMs`、`attemptTimeoutMs`、`logoutRetryDelayMs`、`requestHeaders`、`accountRequestHeaders`、`desktopPlatform`、`embeddedPageDist`、`rewriteBrowserOrigin`（README 与 `src/index.ts`）。

`resolveToken()` 的源校验在 `:227`：`if (destination.origin !== this.inferenceOrigin || destination.username || destination.password) return undefined`。`:236` 有对官方默认源的专门分支。

关键机制（来自 `2026-09-14-deepseek-account-login.md`，已逐条对照源码行号）：

- **本地取消是权威的**：provider 停掉回调并忽略迟到的交换结果；`auth_cancel` 用 `authorize_id` 与原始 PKCE verifier 使远端申请与未交换的 code 失效。取消只发一次后台 POST，且**不等待**，失败也**不**恢复登录。
- **提交点排他**（与 §10 的 `authorization` 改动配套）：`session.commit` 在第一次 await 前同步接纳持久化，并拒绝已被取消的流；接纳之后的取消要**等**提交结果。
- **Host-only 路由**：授权在 Host `webServer` 上注册临时 `/oauth/callback`，清理时只删该路由、保留共享连接。
- **来源受限的凭证转发**：模型与文件请求的 token 只对配置的 `inferenceOrigin` 解析，重定向一律拒绝；换 origin 而不换 Platform issuer 不会转发账号凭证。
- **issuer 不匹配即本地丢弃**：provider 初始化时，若有效 grant 的 issuer 与 `platformOrigin` 不一致，则在消费方读取账号状态**之前**本地删除，启动以登出状态继续（无远端注销请求），API key 与设备身份保留。
- **钱包分列**：`AccountDetails.balance` 把充值钱包放 `value`，促销钱包放 `bonusWallets`，各自独立币种与十进制字符串；查询失败时不含 wallet 数组（`docs/subsystems/credentials.md` 的 Embedded Platform 一节）。
- **UI 归属**：登出在侧栏账号菜单，Account 设置负责资料 / 余额 / 登录，两者共读一条 plugin-owned Host stream。

#### 9.3 `authorization` 新增提交点（30 行）

三处改动，构成同一个设计：

1. `AuthorizationSession` 新增 `commit(record: CredentialRecord): Promise<void>`，JSDoc 为「Commit a record while rejecting cancelled attempts. Once admitted, cancellation waits for completion.」（`packages/credentials/authorization/src/index.ts`，接口区）；
2. `InFlight` 增加 `committing: boolean`；`cancel()` 与请求信号的 `withdraw()` 都改为「`committing` 为真时不再 abort」（原先无条件 `controller.abort()`）；
3. `commit` 的实现先 `signal.throwIfAborted()`，再校验「当前 attempt 仍是传入 signal 对应的那一个」（否则抛 `AuthorizationError(…, 'CANCELLED')`），然后置 `committing = true` 并 `await this.ctx.credentials.modifyRecord(flow.key, …)`。

这样就把「取消」与「已接纳的持久化」之间的竞态收敛为一个单标志位加终态回填，与 note 中「session.commit admits persistence synchronously before its first await and rejects an already-cancelled flow」完全对应。

#### 9.4 `credentials-local`：纯注释删除（−18 行）

`packages/credentials/credentials-local/src/index.ts` 本版删除了 **4 组** `/* jscpd:ignore-start … jscpd:ignore-end */` 注释块（分别位于 `Config`/生命周期静态成员区、chokidar watcher 区、operation-chain 区、reload/reconcile 区），注释内容是「与 settings-file deliberately mirrored，抽出共享 helper 会耦合两个 provider 的 teardown 语义」。**没有任何可执行代码变更**——`git diff` 中该文件的删除行全部是注释。`credentials` 包本版仅有 `package.json` 版本号变化。

### 10. typert 区间演进（已核实）

typert 是本版**唯一净增**的接缝组（+1,264 / −196），三条主线：

#### 10.1 Remote 双向流与 Peer 身份

新增类型（见片段 I 与 `docs/subsystems/typert.md` 本版 diff）：`RemoteStream<Out, In>`、`RemoteStreamHandle<Out, In>`（含 `send` / `end` / `dispose`）、`PeerId`（`:375`）、`PeerScope`、`RemoteInvocation`（`:397`）、`ctx.invocation`。

`InvocationDescriptor` 新增 `uplink?: { codec: TypertCodec }`，由方法返回类型的 `In` 参数生成；`InvokeRemoteRequest` 新增 `uplink?: AsyncIterable<unknown>` 与 `peer?: PeerScope`。gateway 错误码新增 `'gateway/protocol'` 与 `'gateway/uplink-overflow'`。

`bindTypertRemote()` 有一处细节值得注意：它会 `Reflect.get(service, 'ctx')`，若拿到 `Context` 就调用 `provideInvocationAccessor(ctx)`，在**根** context 上注册 `invocation` accessor，使非 Remote 调用下 `ctx.invocation` 读为 `undefined` 而不是 Cordis reflect 的「cannot get property」错误；真正由调用派生的 Context 会用自身属性遮蔽该 accessor。对应提交含 `021bd03b70 feat(gateway): let every Remote stream carry a client uplink`、`355df025d4`/`ffea3c8818`（uplink 生命周期加固）、`35602063d7`（单一 operator Peer 接纳）、`77f1a493aa`（Remote marker 模式固定为 `'stream'` 字面量）。

`registry` 侧新增校验：`descriptor.mode` 若非 `'stream'` 直接抛错（原先只做类型约束），并校验 uplink codec。

#### 10.2 schema 延迟物化（schema factory）

`TypertSchema`（持有 `schema: z.ZodType`）被 `TypertSchemaFactory`（持有 `create: () => z.ZodType`）取代；`TypertSchemaRecord` 变为「名字 + 已物化 schema + 归属信息」。注册表内部用 `TypertSchemaFactoryRecord`（含可选 `value` 缓存），`get()` / `resolve()` / `list()` 出口统一经 `materializeSchema()`（`packages/typert/registry/src/service.ts:642`）做首用物化并缓存。`register()` 阶段新增「`schema.create` 必须是函数」的校验。

`loader` 随之把 manifest 校验从「探测 `'_zod' in schema.schema`」改为「`typeof schema.create !== 'function'` 即报 `has no create() factory`」，并新增 `decode` / `encode` 若存在则必须是函数的检查。对应提交 `e459e32637 perf(typert): materialize generated schemas on first use`。

#### 10.3 Remote 结果中的二进制字段与所有权

`TypertCodec` 的 strict 分支新增两个可选钩子：`decode?(value: unknown): unknown`（递归校验并保留原生字节视图）与 `encode?(value, writeBytes)`（把带字节的子树投影为 RPC 结果附件）。`TypertClientContextAdapter.resolve()` 的返回类型从 `Context | undefined` 扩宽为 `Context | TypertOwnedValue<Context> | undefined`，配套新增 `src/owned-value.ts`（39 行，导出 `TYPERT_OWNED_VALUE` / `isTypertOwnedValue` / `typertOwnedValue`）与 `src/json-value.ts`（53 行，导出 `isRemoteJsonValue` / `isRemoteUplinkItem`），以及 `tests/owned-value.spec.ts`。对应提交 `ecf6acfb15 feat(api): support binary fields in Remote results`、`e98b5703c7 refactor(api): move Remote result projection to gateway`。

`generator` 侧相应改动最大（+729 / −90）：`src/emitter.ts` 213 行、`src/analyzer.ts` 114 行，`tests/remote-model.spec.ts` 374 行、新增 `tests/fixtures/remote-model/typert-protocol.d.ts`（+8）。测试 fixture 里出现的 `RemoteStream<Out, In = never> = AsyncIterable<Out> & { readonly uplinkItem?: In }` 与正式定义使用不同的 marker 属性名（fixture 用 `uplinkItem`，正式用 `STREAM_UPLINK`），属 fixture 自有的最小桩，不构成接口差异。

### 11. `llm` 家族其余改动

- **tool result 不再嵌套**：`packages/llm/llm/src/content.ts` 删除了所有递归遍历 `tool-result` 内容的分支——`contentHasImage()`、`contentHasFile()`、`replaceFilesWithHandles()`、`visitImageBlocks()`、`replaceOffloadedImages()` 全部变为**单层**遍历。`token-meter` 同步删除 `src/estimate.ts` 的 `case 'tool-result'` 与 `src/surface-fold.ts` 的 `block.type === 'tool-result'` 递归分支（−3 / −4 行）。这是 §「消息模型角色化」的直接下游。
- **`BlockAssembler.message()` 签名收紧**：`message(source?: MessageSource)` 变为 `message(source: Omit<ModelMessageSource, 'kind'>): AssistantMessage`——不再有默认的 `{ kind: 'plugin', plugin: 'dsh-llm/assembler' }`，因为 `plugin` kind 已不存在。
- **`createMessage()` 语义变化**：从 `freezeMessage({...input, id})` 变成 `deepFreeze(structuredClone({...input, id}))`，即新消息与调用方传入的嵌套对象**脱离**（原先只是冻结同一引用）。
- **`llm/stream` 的 JSDoc 契约收紧**：hand-built 调用从「their messages already obey the immutable creation contract」改为「callers own their request inputs and must keep them unchanged until the stream settles」。
- **`llm-pi-ai` 的新聚合入口规避**：新增 `src/models.ts`（67 行），用 `@earendil-works/pi-ai/providers/all` 的 `builtinModels()` 建空集合后 `clearProviders()`，避免引入 pi-ai 的聚合入口（对应提交 `75a56be10c perf(llm): avoid aggregate pi-ai runtime import`）。同包另有 `a0f59aac40 fix(llm-pi-ai): stop re-parsing streamed tool-call arguments on every delta (#4740)`，并新增 `tests/tool-argument-streaming.spec.ts`（81 行）。
- **`llm-retry` 与 `deepseek-llm-api-extensions` 源码零改动**：前者只有测试与 package.json，后者只有 README 与 package.json。
- **`plugin-package-inventory-deepseek` 的 import 改名**：`@deepseek-ai/dsh-agent-presets` → `@deepseek-ai/dsh-agent-preset-registry`（对应包组重命名 `agent-presets` → `agent-preset-registry`）。

### 12. `llm-deepseek` 的错误面与 Files 响应校验（已核实）

Messages-only 收敛之后，`llm-deepseek` 的失败面被重新表述，其中两项是行为性修复而非纯文档改动。

**12.1 Files 响应的 JSON 解码与元数据校验被区分开**

上版把「Files 响应体不是合法 JSON」与「JSON 合法但字段不合法」混在同一个失败路径上。本版明确分开：成功状态码下的 Files 响应**必须**是合法 JSON；`upload` / `list` / `retrieve` / `delete` 四个操作的解码失败一律抛 `INVALID_RESPONSE`，消息里带操作名与 HTTP 状态，状态进 `LlmError.failure`，原始 parser error 进 `cause`（`packages/llm/llm-deepseek/README.md` 的 "Failures and recovery" 一节本版新增段落）。而**读体**阶段的传输错误与取消错误保持原身份，不被重新归类。

对应提交三条，构成一个完整的「先复现、再修、再补文档」序列：
```
3a0d640214 test(llm): show malformed Files payloads in case names
d6a0e3323e fix(llm): classify malformed Files JSON responses
d4ff95c8e2 docs(llm): distinguish Files JSON decoding from metadata validation
```

**12.2 `MISSING_CREDENTIAL` 的语义因账号 token 而改变**

上版措辞是「a request with no key anywhere fails with `MISSING_CREDENTIAL`」；本版改为「a request with **neither an eligible account token nor an API key** fails with `MISSING_CREDENTIAL`」。这一句的变化是 §9「账号接缝接入适配器」的直接下游：凭证来源从单一路径（API key 引用）变为两条（账号 token 优先，API key 兜底），失败判定必须同时覆盖两者。`INVALID_CREDENTIAL` 的措辞未变（仍然「naming the reference to fix — never any part of the key」）。

**12.3 认证头与重定向**

两条认证路径的头不同：账号 token 用 `x-dsh-auth-token`（**无** Bearer 前缀），API key 用 `x-api-key`（`adapter.ts` 的 fetch headers；`packages/llm/llm-deepseek/README.md` 新增的 "Account credentials" 一节）。无论哪条路径，`redirect: 'error'` 都在请求上，所以凭证不会跟随重定向离开配置的源。`anthropic-beta: files-api-2025-04-14` 只在请求真正携带 file id 时附加（`adapter.ts` 的 `fileIds === undefined || fileIds.size === 0` 分支；常量定义在 `messages-api.ts:4`）。

**12.4 一处遗留表述**

`packages/llm/llm-deepseek/README.md` 的 "Source map" 一节被整体改写为散文式描述：原先是一张 9 行的文件角色表，其中 **6 行的路径在本版已不存在**（4 行指向 `src/common/**`、2 行指向 `src/protocols/**`）。本版改为一句：`src/index.ts` 注册 provider 并解析设置与凭证，`src/adapter.ts` 负责请求生命周期，`src/serialize.ts` / `src/translate.ts` 负责模型输入与流式输出映射，`src/file-store.ts` 通过 `src/files-api.ts` 负责上传复用与恢复。该表述与本节实测的 23 个平铺文件一致。

### 13. 未核实事项

以下各点本文**未能**核实，明确标注而非模糊处理：

1. **测试是否通过**：本文只统计 spec 文件与行数，**未执行** `pnpm run test` / `test:coverage` / `test:e2e`。工作区洁净（`git status --porcelain` 输出 0 行）且 HEAD 恰为 `dsh-v0.1.7-rc.1` 标签，但通过与否不在本文主张范围。
2. **中间 tag 的边界归属**：本文对比基线为 `dsh-v0.1.6-alpha.1`，区间内含 `0.1.6-alpha.2`、`0.1.7-alpha.1`、`0.1.7-alpha.2` 三个中间发布。提交清单是**整个区间**的，未逐条归属到具体中间 tag。
3. **`bundle/base/cordis.patch.yml:520-523` 注释是否滞后**（见 §8 末）——已确认注释文本与代码现状，未核实作者的更新意图。
4. **翻译配对状态**：各组 README 与 note 均有 `.zh.md` 与 `.i18n.yaml` 兄弟文件，本版亦大量改动它们（如 `llm-deepseek/README.md` 88 行、`README.zh.md` 90 行）。本文**未审计**中英配对的一致性与 i18n 门禁结果。
5. **`deepseek-account-platform` 的运行时行为**：本文结论来自 README、`src/index.ts` 配置面与 `tests/account.spec.ts`（1,201 行）的存在性，**未运行**真实浏览器授权流程，也未在真实 Platform 环境验证。
6. **图像保留的实测数值**：12,500 估算 token 的出货配置与 `retention.ts` 的分半算法均已核实，但**未核实**该预算在真实多模态会话下的实际效果（文本估算为启发式，官方亦声明 provider 上报用量才是权威）。
7. **`docs/subsystems/typert.md` 与 `credentials.md` 之外的官方子系统页**：`llm-streaming.md` 本版 +72 行已读；`credentials.md` 为新增页（+78）已读；但 `core.md`（−279 净减）等相邻页的改动未逐行审阅，因为它们属其它篇目。
8. **`packages/llm/llm-deepseek/src/images.ts` 的重命名影响面**：该文件由 `src/protocols/messages/images.ts` 移动而来（27 行变化，含 content 变更），本文只确认了移动与它在 `adapter.ts` 中的新导入路径，未逐行审阅其内部改动。

---

## 附录：本版提交索引

以下按包组列出区间内**非发布型**提交（`git log --oneline dsh-v0.1.6-alpha.1..dsh-v0.1.7-rc.1 -- <path>` 实测；已剔除 `release(dsh): …`、`build: …` 与 merge 提交）。三个包组的提交条数分别为 **52 / 21 / 31**，因发布与构建提交同时触及多组，故存在重叠。

### `packages/llm/`（52 条中的实质提交）

```
99e22ebbeb refactor(llm): make the official DeepSeek adapter Messages-only
bd421cce7b fix(llm): resolve Messages endpoint suffix (#4241)
1f030b3c1c fix(llm): tolerate malformed historical Messages tool input
82c6a5e4f4 fix(llm): tolerate assistant blocks in Messages input history
ae180d1d24 test(llm): document Messages input compatibility limits
f4a32dbd0a refactor(llm): flatten tool results and validate native V4 sessions
fb79a944f5 refactor(llm): separate durable producer sources from request inputs
385a540d7e Fix Messages-only consumer validation and document recovery
9ab5c8e672 Fix Messages real-API package resolution and usage assertions
2b29f31dc6 test(llm): assert native Messages file metadata
d4ff95c8e2 docs(llm): distinguish Files JSON decoding from metadata validation
d6a0e3323e fix(llm): classify malformed Files JSON responses
3a0d640214 test(llm): show malformed Files payloads in case names
ab102138c8 fix: retain ordered tool text and images within a token budget
c4c18ef0d4 test: align retention checks and catalogs with token budgets
a0f59aac40 fix(llm-pi-ai): stop re-parsing streamed tool-call arguments on every delta (#4740)
75a56be10c perf(llm): avoid aggregate pi-ai runtime import
f2beb99c3b feat(llm): remove the V4 Flash and V4 Flash Vision Exp defaults
cc394230bf feat(web): unify model input controls and catalog inheritance
5d51ba5a9c refactor(web): clarify model input docs and strengthen tests
a55b08233f test(llm): point the keyless onboarding case at a listed model
43bd7010d0 test(llm): isolate idle timeout from HTTP setup timing
6ac2d741a6 test(llm): retain pending mock listeners through teardown
6f07deab31 test(llm): preserve coverage timeout budget and drain stalled fixtures
555b664b08 fix(compaction): reserve configurable 64K pressure headroom
b02b20d713 fix(compaction): pin output caps and cover proactive reserve replay
580bdc7258 refactor: remove redundant unknown casts
048297321a feat(desktop,credentials,client): integrate DeepSeek account sign-in and Platform pages
```

### `packages/typert/`（21 条中的实质提交）

```
e98b5703c7 refactor(api): move Remote result projection to gateway
ecf6acfb15 feat(api): support binary fields in Remote results
ffea3c8818 fix(gateway): close the remaining uplink lifecycle gaps
355df025d4 fix(gateway): harden the Remote uplink lifecycle
8ce7c27671 refactor(connection): admit every request as the single operator Peer
021bd03b70 feat(gateway): let every Remote stream carry a client uplink
35602063d7 refactor(typert): name the client stream handle RemoteStreamHandle everywhere
77f1a493aa refactor(typert): keep the Remote marker mode as the 'stream' literal
089004c418 test(gateway): cover the Remote uplink and document it
e459e32637 perf(typert): materialize generated schemas on first use
580bdc7258 refactor: remove redundant unknown casts
```

### `packages/credentials/`（31 条中的实质提交）

```
048297321a feat(desktop,credentials,client): integrate DeepSeek account sign-in and Platform pages
5b7195e032 feat(desktop,credentials,client): update sign-in protocol and Platform experience
b73a2c8d2d fix(desktop,credentials,ui-settings-account): configure embedded deployment and disable label selection
fe6702cb20 feat(credentials): configure inference origin and discard mismatched account grants
68f8d32d83 fix(desktop,deepseek-account): share platform headers for Host API requests
575de9ccbd fix(ui-settings-account,deepseek-account): reset copy feedback and retain successful profiles
adcd85c08a fix(deepseek-account-platform): preserve client type in login completion redirects
2d0f431181 feat(deepseek-account,ui-settings-account): display profile avatars with icon fallback
0c0789e4df fix(deepseek-account-platform): identify embedded desktop requests
f0a35eba0d feat(credentials,ui-settings-account): display bonus wallets separately
82ae763772 fix(deepseek-account): rename login source parameter
a43da8740d fix(desktop,ui-settings-account): resolve branch hygiene violations
44b15a3377 fix(desktop,credentials): address sign-in review regressions
2a1eb24285 fix(account): cover lifecycle failures and restore CI compatibility
5b9a33fa61 test(account): align browser flows and diagnose stalled transport
f5c96b6340 fix(credentials): identify web account requests with client platform header
d407a6ce90 test(credentials): allow either concurrent account request order
5f1a524f61 docs(credentials): clarify private platform request headers
4777947b6c fix(client): keep account UID fields out of questionnaire URLs
13fe312e15 test(desktop): fix login theme CI fixtures
601d6761e4 feat(settings): project volatile Config through profile-backed forms (#4587)
```

### 本版引用的 Agent Note

| note | 主题 | 对本篇的作用 |
|---|---|---|
| `simplification/2026-09-19-deepseek-messages-only.md` | 官方路由单 Messages 传输 | §1 决策依据 |
| `bug-fix/2026-09-15-messages-v1-base-url.md` | `v1` 精确识别 | §2 决策依据 |
| `bug-fix/2026-09-16-messages-historical-tool-input.md` | 畸形历史参数降级为 `{}` | §3 决策依据 |
| `bug-fix/2026-09-18-messages-input-history-compatibility.md` | user/tool-result 丢弃 reasoning 与 tool-call | §4 决策依据 |
| `bug-fix/2026-09-17-thinking-markdown.md` | Thinking 的 compact markdown 变体 | §5（归属第 10 篇） |
| `bug-fix/2026-09-21-multimodal-tool-result-retention.md` | tool result 的 token 预算保留 | §6 决策依据 |
| `feature/2026-09-16-unified-model-input-controls.md` | 统一模型输入控件 | §7 宿主侧契约 |
| `architecture/2026-09-14-deepseek-account-login.md` | 浏览器登录与本地取消 | §9 决策依据 |
| `architecture/2026-09-15-first-class-tool-role-messages.md` | tool role 一等消息 | §「角色化」依据 |
| `architecture/2026-09-09-producer-owned-message-sources.md` | 生产者自有 source kind | `plugin` kind 取消依据 |
