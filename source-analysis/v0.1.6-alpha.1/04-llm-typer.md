# 【第 04 篇】LLM 能力族与 Typert 类型系统（v0.1.6-alpha.1）

> **版本**：v0.1.6-alpha.1（`0a15e36e7f`）· 对比基线 v0.1.5-rc.2（`fb2c4b9e69`）
> **难度**：🟡 进阶（建议先读第 02 篇核心主干）
> **对应目录**：`deepseek-harness/packages/llm/`、`deepseek-harness/packages/typert/`、`deepseek-harness/packages/context/`
> **子系统文档**：[`docs/subsystems/llm-streaming.md`](../deepseek-harness/docs/subsystems/llm-streaming.md)、[`docs/subsystems/typert.md`](../deepseek-harness/docs/subsystems/typert.md)、[`docs/subsystems/attachment.md`](../deepseek-harness/docs/subsystems/attachment.md)
> **规约（口径）**：本文所有结论指向具体文件、符号或 commit 哈希；无证据者标注「未核实」。

## 目录

- [1 概述](#1-概述)
- [2 核心概念](#2-核心概念)
- [3 包结构](#3-包结构)
- [4 关键类型](#4-关键类型)
- [5 数据流](#5-数据流)
- [6 测试覆盖](#6-测试覆盖)
- [7 与上游/下游的关系](#7-与上下游的关系)
- [8 本版本变更要点（rc.2 → 0.1.6-alpha.1）](#8-本版本变更要点rc2--016-alpha1)
- [9 延伸阅读](#9-延伸阅读)

---

## 1 概述

`packages/llm/` 是**模型能力族**：它拥有会话语言（`Message` / `ContentBlock`）、适配器契约（`LlmAdapter`）、重试执行器（`llm-retry`）、令牌计量（`token-meter`）与各家提供商的适配器实现。`packages/typert/` 是**类型图**基础设施：它把宿主能力投影为可在编译期校验、可在运行时注册的远程契约。`packages/context/` 是**请求上下文**族：它把工作区指令、文件引用、时间上下文等生产者文本注入模型请求。

本版本（`0a15e36e7f`）在三处的改动量：

| 目录 | 变更文件数 | 性质 |
|---|---|---|
| `packages/llm` | 111 | 结构性重构 + 能力新增 |
| `packages/context` | 38 | 纯改名 + 弃用标注 |
| `packages/typert` | 18 | 仅 `loader/src/index.ts` 有行为变更，其余为 README/版本号 |
| `packages/llm/llm-deepseek` | 58 | 本版改动重心（111 中的 58） |
| `packages/llm/llm`（核心契约包） | 11 | 类型增删（含破坏性改名） |
| `packages/llm/token-meter` | 13 | 图片计价输入类型变更 |
| `packages/llm/llm-pi-ai` | 11 | 上下文投影适配 |
| `packages/llm/llm-retry` | 5 | 图片卸载恢复点迁移 |

一句话概括本版主题：**DeepSeek 适配器从"单协议直连"拆成"一个路由、两套协议实现"，并把默认协议切换到 Messages；与此同时，请求图片的投影与计价统一到官方发布的 v41 token 网格上。**

## 2 核心概念

| 概念 | 英文 | 本版落点 | 说明 |
|---|---|---|---|
| 能力缝 | capability seam | `LlmAdapter`（[`packages/llm/llm/src/index.ts`](../deepseek-harness/packages/llm/llm/src/index.ts)） | 循环只依赖契约，不依赖任何适配器包 |
| 路由 | route | `deepseek-official`（单一路由，见 [`src/index.ts`](../deepseek-harness/packages/llm/llm-deepseek/src/index.ts)） | 协议切换不改路由名，已保存的模型选择继续有效 |
| 协议实现 | protocol implementation | `protocols/chat-completions/`、`protocols/messages/` | 本版新增的目录分层；由 `protocol` 配置选择 |
| 共享层 | common layer | `llm-deepseek/src/common/` | 配置、模型目录、能力解析、Files 生命周期 |
| 重放信封 | ReplayEnvelope | Messages 协议下的 `replay.ts` | 只存协议格式、模型身份、对齐的块种类与签名 |
| 重放降级 | replay degradation | `onReplayDegrade`（[`protocols/messages/adapter.ts`](../deepseek-harness/packages/llm/llm-deepseek/src/protocols/messages/adapter.ts)） | 不可用元数据只告警省略签名，不动持久内容 |
| 请求图片目标 | request image target | `ImageRequestTarget`（[`docs/subsystems/attachment.md`](../deepseek-harness/docs/subsystems/attachment.md)） | 路由选择尺寸，存储层只负责按目标缩放与编码 |
| 令牌网格 | token grid | `deepSeekRequestImageDimensions()`（[`src/common/image-tokens.ts`](../deepseek-harness/packages/llm/llm-deepseek/src/common/image-tokens.ts)） | 14px patch、3:1 下采样、`rows × (cols + 1) + 2`、1024 token 上限 |
| 图片卸载 | image offload | `IMAGE_OFFLOAD_REQUIRED` + `offloadImages` | 超预算请求失败并点名需要卸载的最旧出现次数 |
| 类型图 | type graph | `packages/typert/{protocol,generator,registry,loader}` | 本版协议与生成器源码未变，仅加载器实现变更 |

## 3 包结构

### 3.1 `packages/llm/`（7 个包）

| 包 | 角色 | 本版变更文件数 |
|---|---|---|
| `llm/` | 服务契约：`Message`、`ContentBlock`、`LlmAdapter`、`LlmRuntime`、`PreparedLlmCall` | 11 |
| `llm-deepseek/` | DeepSeek 直连适配器（本版拆分为双协议） | 58 |
| `llm-pi-ai/` | 库支持的孪生适配器（pi-ai） | 11 |
| `llm-retry/` | 重试执行器（消费 `retryPolicy`） | 5 |
| `token-meter/` | 令牌计量与图片压力计价 | 13 |
| `deepseek-llm-api-extensions/` | 提供商私有顶层字段的注册与接受 | — |
| `plugin-package-inventory-deepseek/` | 默认开启的插件包清单贡献 | — |

### 3.2 `llm-deepseek/src/` 目录分层（本版新形态）

```
src/
  adapter.ts                    协议分发（按 connection.protocol 选择实现）
  config.ts                     schema 与请求局部配置解析（protocol 字段在此校验）
  index.ts                      设置、凭据与提供商注册
  common/
    types.ts                    DeepSeekProtocol / DeepSeekConnectionOptions
    defaults.ts                 默认值
    models.ts / model-info.ts   共享模型目录与能力解析
    files-api.ts                MESSAGES_FILES_BETA、/v1/files 与 /files 端点
    file-store.ts               Files 缓存、刷新、配额清理、取消
    request-files.ts            Files 解析失败→内联回退
    request-pricing.ts          图片计价
    image-tokens.ts             v41 计算器 + deepSeekRequestImageDimensions
    request-extensions.ts       请求扩展的准备与接受
  protocols/chat-completions/   adapter / serialize / sse / translate / types
  protocols/messages/           adapter / images / replay / serialize / sse / translate / transport / types
```

对照 rc.2：`src/image-tokens.ts`（rc.2 为 154 行）与 `src/request-pricing.ts` 迁入 `common/`；`src/adapter.ts` 从 **715 行降至 58 行**（协议实现下沉到 `protocols/`，本文件只剩分发逻辑）；新增 `src/config.ts`（326 行）承担 schema 与请求局部配置解析。

### 3.3 `packages/typert/`（4 个包）

| 包 | 本版源码变更 |
|---|---|
| `protocol/` | **无**（仅 README 与 package.json） |
| `generator/` | **无**（仅 README 与 package.json） |
| `registry/` | **无**（仅 package.json） |
| `loader/` | `src/index.ts`（49 行）与 `tests/loader.spec.ts`（38 行） |

这是一条重要事实：**本版 typert 的类型图语言层（协议类型、`@Remote` 装饰器、生成器）零改动**，变化集中在加载器如何解析包清单。

### 3.4 `packages/context/`（本版以改名为主）

| 包 | 源码变更 |
|---|---|
| `agent-instructions/` | `WorkspaceContext` → `AgentInstructions` 系列改名（`files.ts`、`index.ts`、`render.ts`、`state.ts`），提示词正文未变 |
| `file-reference-local/`、`time-context/` | 少量（弃用标注、invariant 细节） |
| `file-reference/`、`session-reference/`、`tmux-context/` | 仅 README/i18n |

## 4 关键类型

### 4.1 本版新增

| 类型/常量 | 位置 | 语义 |
|---|---|---|
| `LlmImageRequestBudget` | `packages/llm/llm/src/types.ts` | 路由对保留出现的请求版本字节预算：`representation`（`raw` / `base64`）、`maxBytes?`、`maxImages?`、`byteQuantum?`、`countQuantum?` |
| `IMAGE_OFFLOAD_REQUIRED_CODE` | `packages/llm/llm/src/error.ts` | 常量字符串 `'IMAGE_OFFLOAD_REQUIRED'`，配 `dsh-compaction-image-offload` 的 `image/offload` 事件 |
| `LlmFailure.offloadImages` | `packages/llm/llm/src/types.ts` | 需再卸载多少条最旧保留出现；校验为正安全整数（`adapter-failure.ts`） |
| `ImageBlock.offloaded?: true` | `packages/llm/llm/src/types.ts` | 由卸载决策派生或被消息重写保留；所有路由发送占位文本而非图片字节 |
| `ProjectedDimensions` | `packages/attachment/attachment/src/index.ts`（`request-projection.ts`） | 投影后的整数宽高 |
| `ImageRequestTarget` | 同上（取代 rc.2 的 `ImageRequestPolicy`） | `width`、`height`、`maxBytes` |
| `createMcpToolDefinition` 等 | `packages/mcp/mcp-client/src/tools.ts` | 见第 11 篇 |
| `TypertArtifact`（内部 interface） | `packages/typert/loader/src/index.ts` | `{ packageName, path }`，替换原先的裸路径缓存 |

### 4.2 本版改名（破坏性）

| rc.2 | 0.1.6-alpha.1 | 影响 |
|---|---|---|
| `AssistantProvenance` | `AssistantProviderMetadata` | 跨包公开类型改名；`ModelMessageSource extends AssistantProviderMetadata`；`packages/llm/llm/src/types.ts` 的 re-export 同步改名；`docs/subsystems/llm-streaming.md` 已同步 |

### 4.3 本版签名变更（破坏性）

```ts
// rc.2
priceImages(images: readonly ImageAttachmentRef[]): readonly LlmImageRequestPrice[]
// 0.1.6-alpha.1
priceImages(images: readonly ImageBlock[]): readonly LlmImageRequestPrice[]
```

来源：[`packages/llm/llm/src/types.ts`](../deepseek-harness/packages/llm/llm/src/types.ts) 与 `docs/subsystems/llm-streaming.md`（两处同版本更新）。`offloaded` 块按占位文本计价。

### 4.4 协议选择

```ts
/** Supported wire implementations; Responses is not yet implemented. */
export type DeepSeekProtocol = 'chat-completions' | 'messages'
```

来源：[`packages/llm/llm-deepseek/src/common/types.ts`](../deepseek-harness/packages/llm/llm-deepseek/src/common/types.ts)。配置默认值与校验见 `src/config.ts`：`protocol: z.union(['chat-completions', 'messages']).default('messages')`，非法值在解析期抛 `llm-deepseek: protocol must be chat-completions or messages`；Messages 走 `https://api.deepseek.com/anthropic`，Chat 走 `https://api.deepseek.com`。

## 5 数据流

### 5.1 一次 `stream()` 的调用链（Messages 路径）

```mermaid
sequenceDiagram
    participant LOOP as core/agent-loop
    participant RT as LlmRuntime
    participant DP as DeepSeekAdapter（协议分发）
    participant MS as DeepSeekMessagesAdapter
    participant AC as attachment（按目标缩放/编码）
    participant FS as DeepSeek Files（/v1/files）
    participant API as DeepSeek Messages 端点

    LOOP->>RT: llm/stream
    RT->>DP: stream(options)
    DP->>DP: implementation() 读 connection.protocol
    DP->>MS: 委派
    MS->>AC: prepareImages（解出请求目标尺寸）
    MS->>FS: prepareFileIds（优先 file_id 引用）
    alt Files 解析失败
        MS->>MS: inlineImages 内联 base64 重建整个请求
    end
    MS->>MS: serialize（含 ReplayEnvelope 读取与降级）
    MS->>MS: prepareRequestExtensions
    MS->>API: POST /v1/messages（x-api-key、anthropic-version、按需 anthropic-beta）
    API-->>MS: SSE
    MS->>MS: accept extensions（HTTP 2xx 之后）
    MS-->>LOOP: translate(parseSse(...)) 产出 StreamChunk
```

### 5.2 四步读懂

1. **分发**：`DeepSeekAdapter` 每次调用读一次配置世代，按 `protocol` 构造对应实现（`src/adapter.ts` 的 `implementation()`，default 分支用 `assertNever` 收口）；
2. **图片目标**：路由先解出每张图的请求目标尺寸（`deepSeekRequestImageDimensions`），存储层只按目标缩放编码——本版把求解器留在 `llm-deepseek`；
3. **Files 优先**：两种协议都优先走 Files 引用，失败或超时才回退内联 base64，一次请求不混用两种表示；
4. **重放与扩展**：Messages 序列化读取 `ReplayEnvelope`，不可用时降级告警；请求扩展在 HTTP 2xx 之后接受，失败则整个请求失败。

## 6 测试覆盖

### 6.1 `packages/llm/llm-deepseek/tests/`

| 文件 | 覆盖点 |
|---|---|
| `messages/adapter.spec.ts`（新增 383 行） | Messages 传输、重放、错误分类 |
| `messages/adapter.e2e.ts`（新增 261 行） | 真实端点文本/思考/工具续接/图片/取消（凭据门槛） |
| `messages/serialize.spec.ts`（303 行）、`stream.spec.ts`（137 行）、`files.spec.ts`（215 行）、`extensions.spec.ts`（106 行） | 序列化、流转换、Files 对等、扩展接受 |
| `messages/expected/degraded-replay.json` | 降级重放的固定产物 |
| `messages/fixtures/cordis.yml`、`fixtures/red.png` | 真实 Loader 组合与图片夹具 |
| `protocol.spec.ts`（新增 92 行） | 协议分发选择 |
| `image-tokens.spec.ts`、`request-pricing.spec.ts` | v41 向量重钉 |
| `adapter.spec.ts`、`file-store.spec.ts`、`files-api.spec.ts`、`dynamic-config.spec.ts`、`loader-composition.spec.ts`、`egress.spec.ts` | 原有覆盖面（本版增量调整） |
| `messages/helpers.ts`（72 行） | 共享测试辅助 |

e2e 门槛（来自包 README「Known Limitations」）：`DEEPSEEK_FLASH_E2E=1` 开启 Chat Completions 检查；Messages 的系统更新检查需要 `DEEPSEEK_IN_HISTORY_MODEL` 指向受支持模型（如 `deepseek-flash`）并以 `high` 档运行，未设置即跳过。

### 6.2 会话级快照（keyless，本版新增）

| 快照 | 作用 |
|---|---|
| `snapshots/session/deepseek-messages-replay/` | 录制会话经 Messages 重放（含 `session.v2.jsonl` 与 `session.v3.jsonl`） |
| `snapshots/session/deepseek-messages-degraded-replay/` | 未知重放版本的降级路径 |
| `snapshots/session/deepseek-messages-system-prompt/` | Messages 下系统提示词的 in-history 更新 |
| `snapshots/session/deepseek-protocol-system-prompt/` | 协议间系统提示词行为对照 |

### 6.3 typert 与 context

- `packages/typert/loader/tests/loader.spec.ts`（38 行增量）：覆盖解析器接入与作用域名拒绝；
- `packages/context/agent-instructions/tests/`：改名后全量回归（`agent-instructions.spec.ts` 444 行重排、`agent-instructions.e2e.ts`）。

## 7 与上游/下游的关系

| 方向 | 对象 | 关系 |
|---|---|---|
| 上游 | `packages/core/agent-loop` | 循环经 `llm/stream` 消费 `StreamChunk`；本版 `LlmFailure.offloadImages` 供循环与压缩器协作 |
| 上游 | `packages/settings`、`packages/credentials` | 连接事实每次操作重读；API key 与 endpoint 同一世代（`src/common/types.ts` 的 `apiKeyEnv` 注释） |
| 下游 | `packages/attachment` | 本版契约反转：附件服务接收 `ImageRequestTarget`，不再自行决定投影 |
| 下游 | `packages/compaction` | `dsh-compaction-image-offload` 消费 `IMAGE_OFFLOAD_REQUIRED` 与 `offloadImages`，记录 `image/offload` 后重试 |
| 平级 | `packages/llm/token-meter` | 消费 `imageRequestPricing`；本版 `priceImages` 输入改为 `ImageBlock[]` |
| 平级 | `packages/mcp` | 经 `LlmAdapter` 无关；MCP 图片投影走 attachment（见第 11 篇） |
| 下游 | `packages/api/gateway`、`packages/client` | typert 契约的消费者；本版 `typert/protocol` 未变，网关侧类型不变 |

## 8 本版本变更要点（rc.2 → 0.1.6-alpha.1）

> 本节篇幅占全文一半以上。每条都给出 commit 与文件落点。

### 8.1 DeepSeek 默认协议切换到 Messages

**决定**：DeepSeek 直连适配器默认走 Anthropic Messages 协议；Chat Completions 仍可显式选择。

| 证据类型 | 内容 |
|---|---|
| Agent Note | [`.agents/notes/implemented/feature/2026-09-07-deepseek-messages-adapter.md`](../deepseek-harness/.agents/notes/implemented/feature/2026-09-07-deepseek-messages-adapter.md) |
| commit | `34154b6861` `feat(llm): add DeepSeek Anthropic Messages adapter`；`b0641b83fc` `feat(llm): default DeepSeek to Messages with Files parity`；`accafa5fb2` `refactor(llm): inherit Messages defaults and verify live parity` |
| Web 侧 | `d28286938d` `feat(web): configure DeepSeek Messages beside Chat Completions`；`c258d3cf4e` `feat(web): use Messages for the default DeepSeek provider` |
| 落点 | `src/config.ts`（`protocol` 默认 `messages`）、`src/common/defaults.ts`（新增 24 行）、`src/protocols/messages/*`（8 个文件） |

**要点（可直接引用官方表述）**：

- 「The [DeepSeek adapter] serves multiple protocols under one `deepseek-official` route and `llm-deepseek` settings namespace.」——协议切换不改路由与设置命名空间，**已保存的模型选择继续有效**；
- 「Cordis YAML selects the implementation through `protocol`, defaulting to `messages`; shipped first-party compositions inherit that default.」——出厂组合继承该默认值；
- 「The existing `PreparedAdapterCall` freezes protocol, endpoint, credential reference, and model capabilities; retries retain that generation while subsequent calls read new configuration.」——进行中的请求保留其配置，后续调用读新配置；
- 「Web always displays DeepSeek without a protocol selector.」——Web 端不暴露协议选择器；「Both protocols share `baseURL` and `apiKeyEnv`, with no nested per-protocol configuration map.」
- 「Explicit `chat-completions` remains supported with its own official default; a custom `baseURL` or environment override is never rewritten to match a protocol.」

**行为差异（Messages vs Chat）**：

| 维度 | Messages（本版默认） | Chat Completions |
|---|---|---|
| 端点 | `${baseURL}/v1/messages` | `${baseURL}/chat/completions` |
| 官方 base | `https://api.deepseek.com/anthropic` | `https://api.deepseek.com` |
| 鉴权头 | `x-api-key` + `anthropic-version: 2023-06-01` | Bearer（`authorization`） |
| 思考档位 | `output_config.effort` | `reasoning_effort` |
| 系统提示词更新 | 声明 `systemPromptUpdate: in-history` 的路由保留顶层 system 并把后续快照作为原生 system 轮次追加 | 同左（共享路由能力） |
| Files 端点 | `/v1/files`（需 `anthropic-beta: files-api-2025-04-14`） | `/files` |
| 重定向 | 「Messages model requests and all Files requests reject redirects」 | 同左 |
| 重放元数据 | `ReplayEnvelope` 存协议格式、模型、签名（含空签名） | 序列化持久内容但不带签名 |

`e5feedd14f` `feat(llm-deepseek-messages): support in-history system prompt updates` 与 `74ef3f0510` `fix(llm): degrade unusable Messages replay metadata` 分别对应上表后两行。

### 8.2 协议实现统一与目录分层

- `6a137ea702` `refactor(llm): unify DeepSeek protocol implementations`：把 rc.2 单文件适配器拆为 `common/` + `protocols/{chat-completions,messages}/`；`src/adapter.ts` 变为纯分发器（默认分支 `assertNever(connection.protocol, 'DeepSeek protocol')`）；
- `7d3dab66a2` `fix(llm): harden Messages transport and Files parity`：加固传输与 Files 对等；
- `1f88b9cd8f` `chore(llm-deepseek-messages): align version with master`；
- 备选方案被否决（官方记录）：**每协议一个插件**会重复凭据、目录、设置卡与提供商身份，并强迫用户在协议变更时重选模型；**委托 pi-ai 或 Anthropic SDK** 无法承载 DeepSeek 专属配置、附件策略、凭据解析与重试归属。

### 8.3 V41 目录同步与 Web 保留 Chat Completions

- `4af56cf808` `feat(llm): sync V41 Messages catalog and keep Web on Chat Completions`；
- 结果：默认目录为 V41 Flash（文本+图像+in-history 能力）、V4 Flash、V4 Pro、V4 Flash Vision Exp，各带 1,000,000 token 上下文窗口（`packages/llm/llm-deepseek/README.md`）；
- `ece35a1a38` `test(ci): exercise Messages defaults in runtime smokes`：CI 冒烟改走 Messages 默认；
- `packages/sdk/server`：DeepSeek 回退挂载从 `this.ctx.plugin(LlmDeepSeek, {})` 改为 `this.ctx.plugin(LlmDeepSeek)`（`packages/sdk/server/src/server.ts`），即 SDK 服务端也继承 Messages 默认。

### 8.4 图片令牌计算器迁到官方 v41 配置

| 证据 | 内容 |
|---|---|
| Agent Note | [`2026-09-10-deepseek-image-token-calculator-v41.md`](../deepseek-harness/.agents/notes/implemented/bug-fix/2026-09-10-deepseek-image-token-calculator-v41.md) |
| commit | `a64dc3a690` `fix(llm-deepseek): 图片 token 预估器改用官方计算器 v41 配置`；`f24bc3c832` `fix(llm-deepseek): correct image pricing documentation and edge-case evidence` |
| 落点 | `src/common/image-tokens.ts`（157 行，`deepSeekImageTokens()`） |

rc.2 的估算器移植的是计算器的 `v4` 配置（384×384 放大下限、384 token 上限、8:1 宽度钳制、奇偶校正行、按最坏情况计的 4 对齐填充）。本版改为 `v41` 的逐字移植：**14px patch、3:1 逐轴下采样、544×544 总像素下限、1024 token 上限**，网格公式 `rows × (cols + 1) + 2`，无奇行补行、无奇偶校正、无对齐填充、无宽高比钳制。

官方记录的具体数字差（可复核）：
- 800×800 请求图片：**422** token（原 349）；
- 640×480：**206**（原 209）；
- `low` 预算 512×512：**184**（原 201）；
- 误差来源：旧移植对 800×800 低估 73 token，对 640×480 高估 3 token。

被否决的备选：**保留两套配置按模型 id 选择**——提供方声明已退役的 `deepseek-v4-flash-vision-exp` 由当前 Flash 服务，没有任何可达路由会用旧配置计价。

### 8.5 请求图片投影改到同一 token 网格

| 证据 | 内容 |
|---|---|
| Agent Note | [`2026-09-10-deepseek-v41-request-image-projection.md`](../deepseek-harness/.agents/notes/implemented/bug-fix/2026-09-10-deepseek-v41-request-image-projection.md) |
| commit | `06c491508f` `fix(llm-deepseek): 请求图片按 V4.1 token 网格投影`；`ba30b73f7b` `refactor(attachment): 求解器留在 llm-deepseek，存储层只接收目标尺寸`（提交标题原文为中文）；`e17a736cc3` `docs: 同步请求图片投影文档与 Agent Note`；`f0f1988a7a` `Clarify token counts after aspect-preserving image projection` |
| 落点 | `src/common/image-tokens.ts` 新增 `deepSeekRequestImageDimensions(width, height)`；`packages/attachment/attachment/src/request-projection.ts` 保留 `requestImageDimensions` / `longEdgeDimensions` |

**契约反转**：rc.2 由路由给一个总像素预算（`ImageRequestPolicy.maxPixels`），附件服务自行投影；本版路由直接给出**最终目标尺寸与字节目标**（`ImageRequestTarget`），附件服务只缩放与编码。官方理由：把某提供商的 patch 常量与布局公式放进"提供商中立"包会污染该包的词汇，且每接一家规则就要加一个联合成员。

**具体规则与数字（全部出自 Agent Note）**：

- 省略 `imagePixelBudget` 时按 token 网格求解；正整数替换为总像素预算；`low` 用 512×512；
- 每张请求图片再套 **4096 像素/边**上限（提供方对"请求携带 15 张及以上图片"的限制），因此图片数量不会改变任何单张目标；
- 路由字节目标 **2 MiB**（原 1 MiB）——目标是阶梯而非硬上限，超出时取阶梯最小输出；
- 小图不放大（提供方自己在 544×544 以下放大）；
- 示例：正方形源码最多以 **1302×1302 / 994 token** 送达（原 800×800 / 422）；16:9 源码以 **1708×961** 发送、由提供方补到 **1708×966** 网格；8192×78 细长图在网格下 396 token，但受每边上限被发成 4096×39；
- pi-ai 路由的请求目标仍来自其未变的 2048×2048 像素预算。

**被否决的备选**（对本篇读者最有教益的一条）：**把总像素预算抬到 1302×1302** —— 总像素预算只对正方形正确：16:9 源码会被发成 1.69M 像素（网格只保留 1.65M），4:1 源码同理，极端比例还会丢掉网格本可保留的细节。

**代价（官方明示）**：「Every existing request-image cache entry and DeepSeek Files API mapping is regenerated on the next request.」（缓存键包含 `request-image-v6` 变换版本）。

**Keyless 覆盖的边界**：「`llm-replay` does not project images, so keyless snapshots cannot record the sent dimensions; the `llm-deepseek` adapter tests pin the resolved targets and the projected handle text against a mock server.」

### 8.6 图片卸载从"水位事件"改为"压缩执行器 + 失败点名"

| commit | 内容 |
|---|---|
| `345b5cdc6f` | `feat(session, llm): durable image offload watermark`（rc.2 之前引入的水位机制） |
| `8c7b023d6c` | `refactor(llm): move image offload planning into a plugin and trim the change surface` |
| `fcb976d3dc` | `refactor(llm): recover IMAGE_OFFLOAD_REQUIRED in llm-retry instead of a new plugin package` |
| `523ae08a2d` | `refactor(session, llm): cut the image offload surface to its callers` |
| `6329c53a37` | `refactor(llm-retry, session): offload images by surface replacement instead of a watermark event` |
| `4779f054b6` | `refactor(compaction): own image offload as a compaction executor` |
| `413ac14b16` | `refactor: move image offload projection into its plugin` |
| `b5e7fca4a5` | `feat(compaction): record image offload decisions without message replacement` |
| `debb4b9a9c` | `fix(compaction): recover durable image offload in summary requests` |
| `b3756a89d1` | `fix(headless): fail loud when --session-id would create a non-durable session`（相邻，见第 11 篇） |

**本版契约形态**（`packages/llm/llm/src/`）：

| 符号 | 文件 | 职责 |
|---|---|---|
| `projectOffloadedImages()` | `content.ts` | 把被选中的图片出现投影为占位文本 |
| `requiredImageOffload()` | `content.ts` | 计算还需要卸载多少条最旧出现 |
| `offloadedImageText()` | `content.ts` | 占位文本生成 |
| `IMAGE_OFFLOAD_REQUIRED_CODE` | `error.ts` | 稳定错误码常量 |
| `offloadImages` | `types.ts` / `index.ts` / `adapter-failure.ts` | 失败载荷携带的整数计数（校验为正安全整数） |
| `LlmImageRequestBudget` | `types.ts` | 路由预算的显式类型（表示形式、字节、数量、两种量子） |

rc.2 中存在的 `offloadRequestImagesWithPolicy()` 与 `offloadedImagePrefixCount()` 已从 `content.ts` 导出面移除。

### 8.7 类型层的其他增删

| 变更 | 位置 | 说明 |
|---|---|---|
| `AssistantProvenance` → `AssistantProviderMetadata` | `llm/src/message.ts`、`llm/src/types.ts` | 公开类型改名，消费方需同步（`docs/subsystems/llm-streaming.md` 已改） |
| `LlmFailure.offloadImages` | `llm/src/types.ts` | 与 `IMAGE_OFFLOAD_REQUIRED` 配对 |
| `ImageBlock.offloaded` | `llm/src/types.ts` | 新增可选标记 |
| `priceImages(ImageBlock[])` | `llm/src/types.ts` | 签名破坏性变更 |
| `LlmImageRequestBudget` | `llm/src/types.ts` | 新增 |
| `ContextForm` 文档措辞 | `llm/src/message.ts` | 「declared by the producer beside its provenance」→「in the same `MessageSource`」（仅 JSDoc） |

### 8.8 Typert：加载器接入插件包解析器

`packages/typert/loader/src/index.ts` 的本版变化（49 行）：

| 变化 | 细节 |
|---|---|
| 新增依赖声明 | `import type {} from '@deepseek-ai/dsh-app-boot'`（为 `pluginPackages` 服务提供类型） |
| 解析路径 | `resolveArtifact()` 先尝试 `ctx.get('pluginPackages')?.packageOf(pkgName, baseUrl)`，命中则用其 `manifestPath` 与已解析的 `manifest`，否则回退 `createRequire(...).resolve()` |
| 显式失败 | 配置了 `packages` 但无法解析 → 抛错并提示「add it to the composition package dependencies or remove it from packages」 |
| 作用域名拒绝 | 形如 `@scope/name/subpath` 或 `pkg/sub` 的条目在配置列表中时直接抛错；未配置时缓存为 `null` |
| 缓存结构 | `Map<string, string \| null>` → `Map<string, TypertArtifact \| null>`，并记录清单里的真实包名（`manifestName`）用于导出解析 |

**未变**（本节最重要的事实）：`packages/typert/protocol/src`、`packages/typert/generator/src`、`packages/typert/registry/src` **零源码变更**——`@Remote` 装饰器、`InvocationDescriptor`、`TypertLookupMap` 等契约与本版无关。

### 8.9 Context 族：纯改名与弃用标注

- `renderWorkspaceContext` → `renderAgentInstructions`、`RenderedWorkspaceContext` → `RenderedAgentInstructions`、`workspaceContextMessage` → `agentInstructionsMessage`、`renderWorkspaceInstructionSet` → `renderAgentInstructionSet`；
- 常量改名（`WORKSPACE_CONTEXT_INTRO` → `AGENT_INSTRUCTIONS_INTRO` 等），但**模型可见的提示词正文逐字未变**（`The following workspace instructions may be relevant to your work. …`）；
- 多处新增 `// oxlint-disable-next-line typescript/no-deprecated -- Existing Session history read; migration deferred.`——对应 `2026-09-09-deprecate-synchronous-session-event-reads` 这一 Agent Note 的迁移边界；
- 相邻 commit：`6c3c3064c3` `refactor: align instruction and job helper symbols`。

### 8.10 破坏性变更清单（升级必读）

| 变更 | 影响面 | 缓解 |
|---|---|---|
| 默认协议变为 `messages` | 所有未显式声明 `protocol` 的 DeepSeek 组合 | 显式写 `protocol: chat-completions`；或让自定义 `baseURL` 支持所选协议 |
| `AssistantProvenance` 改名 | 导入该类型的消费方与插件 | 改为 `AssistantProviderMetadata` |
| `priceImages()` 入参改为 `ImageBlock[]` | 实现 `LlmImageRequestPricing` 的适配器与消费方 | 按 `ImageBlock` 计价，`offloaded` 块按占位文本 |
| 请求图片缓存与 Files 映射全部失效 | 图像密集会话下一次请求会重建 | 无操作；按 `request-image-v6` 自动重建 |
| 图片尺寸变化（更大、更多 token） | 图像密集会话更早触发压缩 | 用 `imagePixelBudget`（正整数或 `low`）显式收紧 |
| 请求图片字节目标 1 MiB → 2 MiB | 上传字节量与内联回退预算 | 由 `imageMaxBytes` 控制 |
| `ImageRequestPolicy` → `ImageRequestTarget` | attachment 服务的调用方 | 传目标宽高与字节目标 |
| `IMAGE_OFFLOAD_REQUIRED` 失败载荷新增 `offloadImages` | 重试/压缩消费方 | 按其计数卸载最旧出现 |
| 导出面移除 `offloadRequestImagesWithPolicy` / `offloadedImagePrefixCount` | 直接调用者 | 改用 `projectOffloadedImages` / `requiredImageOffload` |

### 8.11 本版未变的部分（同样是结论）

- `SESSION_FORMAT_VERSION` = 3，本版未变（`docs/session-format-status.md` 记录 `latestReleasedVersion` 仍为 3）；
- `packages/typert/{protocol,generator,registry}` 源码零变更；
- `ContentBlockMap` 的块类型集合未新增（本版只给 `image` 块加 `offloaded` 标记）；
- Responses 协议仍未实现，配置层拒绝 `responses`（`packages/llm/llm-deepseek/README.md`）；
- `llm-deepseek` 未映射 `tool_choice`、仍用裸 `fetch`（同上，属已知限制）。

## 9 延伸阅读

**官方（权威来源）**

- [`packages/llm/llm-deepseek/README.md`](../deepseek-harness/packages/llm/llm-deepseek/README.md) —— 协议选择、配置字段全表、模型体验
- [`docs/subsystems/llm-streaming.md`](../deepseek-harness/docs/subsystems/llm-streaming.md) —— 适配器契约与流协议（本版更新了 `AssistantProviderMetadata`、`offloadImages`、`priceImages`）
- [`docs/subsystems/attachment.md`](../deepseek-harness/docs/subsystems/attachment.md) —— `ImageRequestTarget` 与 `ProjectedDimensions`
- [`docs/subsystems/typert.md`](../deepseek-harness/docs/subsystems/typert.md) —— 类型图公开契约

**决策记录（WHY 的一手来源）**

- 🔴 [`2026-09-07-deepseek-messages-adapter.md`](../deepseek-harness/.agents/notes/implemented/feature/2026-09-07-deepseek-messages-adapter.md) —— 单路由双协议、重放信封、Files 对等
- 🔴 [`2026-09-10-deepseek-image-token-calculator-v41.md`](../deepseek-harness/.agents/notes/implemented/bug-fix/2026-09-10-deepseek-image-token-calculator-v41.md) —— v41 计算器移植
- 🔴 [`2026-09-10-deepseek-v41-request-image-projection.md`](../deepseek-harness/.agents/notes/implemented/bug-fix/2026-09-10-deepseek-v41-request-image-projection.md) —— 请求图片网格投影与契约反转
- 🟡 [`2026-07-14-provider-routed-llm-adapters.md`](../deepseek-harness/.agents/notes/implemented/architecture/2026-07-14-provider-routed-llm-adapters.md) —— 重放降级规则的归属

**关键 commit 速查**

`34154b6861`、`b0641b83fc`、`accafa5fb2`、`7d3dab66a2`、`4af56cf808`、`6a137ea702`、`a64dc3a690`、`06c491508f`、`ba30b73f7b`、`6329c53a37`、`4779f054b6`、`b5e7fca4a5`、`74ef3f0510`、`e5feedd14f`、`e17a736cc3`、`f0f1988a7a`

---

**下一篇预告**：【第 05 篇】执行世界能力族。

---

*文档生成时间: 2026-09-17*
*数据源: dsh-v0.1.6-alpha.1 (0a15e36e7f) vs dsh-v0.1.5-rc.2 (fb2c4b9e69)*
