# Bug 归类趋势报告（LLM 语义分类）

> 生成时间：2026-09-12T15:30:31Z
> 语料：DeepSeek Harness GitHub Discussions #13–#6442，共 6321 篇
> 分类器：**Qwen3.6-35B-A3B**（局域网 vLLM @ `192.168.100.242:8200`，温度 0.1，JSON 约束输出）
> 已分类：**6321 / 6321**（覆盖率 100.0%）

---

## 一、为什么必须换成 LLM：正则口径的失真量化

正则（关键词 OR 匹配）只能做「分词解析」，其根本缺陷是**一个帖子同时命中多个族**，导致各族计数之和远超总篇数、份额无法相加、跨族比较被交叉召回污染。

LLM 版要求模型给出**唯一的 `primary` 族**，因此分布是互斥的、份额相加恒为 100%。下表把两种口径并排，量化正则的偏差：

| 问题族 | 正则命中 | LLM 主族 | 偏差 | 说明 |
|---|---|---|---|---|
| `npm-install-build` | 212 | 252 | -16% | 基本一致 |
| `legacy-session-corruption` | 95 | 128 | -26% | 基本一致 |
| `malformed-toolcall` | 221 | 102 | +117% | 正则显著高估 |
| `sandbox-windows` | 527 | 86 | +513% | 正则显著高估 |
| `legacy-plugin-load-crash` | 47 | 76 | -38% | 基本一致 |
| `web-startup-perf` | 71 | 63 | +13% | 基本一致 |
| `web-process-death` | 167 | 60 | +178% | 正则显著高估 |
| `session-history-unreadable` | 236 | 54 | +337% | 正则显著高估 |
| `legacy-context-compaction` | 334 | 52 | +542% | 正则显著高估 |
| `reasoning-loop` | 50 | 40 | +25% | 基本一致 |
| `session-migration` | 74 | 35 | +111% | 正则显著高估 |
| `composer-ime` | 53 | 32 | +66% | 正则显著高估 |
| `legacy-auth-lan` | 932 | 23 | +3952% | 正则显著高估 |
| `persona-preset-break` | 59 | 23 | +157% | 正则显著高估 |
| `windows-reveal` | 26 | 21 | +24% | 基本一致 |
| `fork-inbox` | 36 | 17 | +112% | 正则显著高估 |
| `client-bundle-stale` | 100 | 16 | +525% | 正则显著高估 |
| `tool-visibility` | 65 | 11 | +491% | 正则显著高估 |
| `legacy-token-auth-pwa` | 444 | 3 | +14700% | 正则显著高估 |
| `legacy-sandbox-escalation` | 76 | 0 | — | 正则误报（LLM 判为 other） |

### 量化结论

| 指标 | 正则 | LLM |
|---|---|---|
| 同一子集(6321 篇)的总命中次数 | 3825 | 6505 |
| 平均每篇命中族数 | 0.61 | 1.03 |
| 命中率冗余度（总命中 ÷ 篇数） | 0.61× | — |

- 正则**单族命中**且与 LLM 主族一致：**287** 篇（4.5%）
- 正则**完全未命中**但 LLM 判定属于某具体问题族：**305** 篇（4.8%）— 这是正则漏检
- 正则**有命中**但 LLM 判定为非问题（other）：**1915** 篇（30.3%）— 这是正则误报

正则平均每篇命中 **0.61** 个族，而 LLM 为 **1.03** 个（多标签模式）或恒为 1（主族模式）。正则的命中冗余正是此前「各族之和远超总篇数、份额无法相加」的根源。

---

## 二、LLM 语义分类分布（互斥口径，全体已分类）

| 问题族 | 篇数 | 占比 |
|---|---|---|
| 其它（非问题类或未归类） `other` | 5227 | 82.7% |
| npm 安装/构建失败 `npm-install-build` | 252 | 4.0% |
| 会话日志损坏（seq gap/并发写） `legacy-session-corruption` | 128 | 2.0% |
| 畸形 tool-call 致会话不可恢复 `malformed-toolcall` | 102 | 1.6% |
| Windows 沙箱/TLS/代理 `sandbox-windows` | 86 | 1.4% |
| 插件加载失败拖垮启动 `legacy-plugin-load-crash` | 76 | 1.2% |
| dsh web 启动性能退化 `web-startup-perf` | 63 | 1.0% |
| dsh web 进程静默死亡 `web-process-death` | 60 | 0.9% |
| 升级后历史会话无法加载 `session-history-unreadable` | 54 | 0.9% |
| 上下文压缩失效 `legacy-context-compaction` | 52 | 0.8% |
| 推理退化循环 / 空响应 `reasoning-loop` | 40 | 0.6% |
| 会话格式迁移失败 `session-migration` | 35 | 0.6% |
| Composer 输入法/翻译干扰 `composer-ime` | 32 | 0.5% |
| Web 鉴权 / 局域网访问 `legacy-auth-lan` | 23 | 0.4% |
| persona/preset 字段重命名破坏 `persona-preset-break` | 23 | 0.4% |
| Windows 资源管理器定位失败 `windows-reveal` | 21 | 0.3% |
| Fork 继承父会话队列 `fork-inbox` | 17 | 0.3% |
| client bundle 陈旧失效 `client-bundle-stale` | 16 | 0.3% |
| 工具/提示词节丢失 `tool-visibility` | 11 | 0.2% |
| PWA / 移动端 / i18n `legacy-token-auth-pwa` | 3 | 0.0% |
| **合计** | **6321** | **100%** |

- **Bug 类**: 2881 篇（45.6%）— 非 Bug 类含功能请求、插件展示、提问与讨论

### 严重度分布（仅 Bug 类）

| 严重度 | 篇数 | 占 Bug 类 |
|---|---|---|
| critical | 135 | 4.7% |
| high | 1596 | 55.4% |
| medium | 876 | 30.4% |
| low | 274 | 9.5% |

### 主要族的严重度构成

| 问题族 | critical | high | medium | low |
|---|---|---|---|---|
| 其它（非问题类或未归类） | 64 | 841 | 713 | 3609 |
| npm 安装/构建失败 | 0 | 185 | 38 | 29 |
| 会话日志损坏（seq gap/并发写） | 44 | 81 | 1 | 2 |
| 畸形 tool-call 致会话不可恢复 | 14 | 84 | 4 | 0 |
| Windows 沙箱/TLS/代理 | 4 | 54 | 16 | 12 |
| 插件加载失败拖垮启动 | 1 | 64 | 4 | 7 |
| dsh web 启动性能退化 | 1 | 24 | 33 | 5 |
| dsh web 进程静默死亡 | 2 | 56 | 1 | 1 |
| 升级后历史会话无法加载 | 0 | 47 | 7 | 0 |
| 上下文压缩失效 | 3 | 33 | 14 | 2 |
| 推理退化循环 / 空响应 | 0 | 31 | 8 | 1 |
| 会话格式迁移失败 | 2 | 30 | 1 | 2 |

---

## 三、周度趋势（LLM 主族，互斥口径）

> 因语料总量剧烈衰减（W0 3386 篇 → W4 355 篇），下表同时给出**绝对篇数**与**当周占比**。占比是互斥口径，可直接横向比较。

| 周 | 区间 | 已分类 | W0 | W1 | W2 | W3 | W4 |
|---|---|---|---|---|---|---|---|
| 篇数 | | | 3386 | 1206 | 767 | 607 | 355 |

### 各族周度篇数与占比

| 问题族 | W0 | W1 | W2 | W3 | W4 | W0→末周 |
|---|---|---|---|---|---|---|
| 其它（非问题类或未归类） | 2906 (85.8%) | 988 (81.9%) | 609 (79.4%) | 467 (76.9%) | 257 (72.4%) | 0.84× |
| npm 安装/构建失败 | 109 (3.2%) | 58 (4.8%) | 35 (4.6%) | 34 (5.6%) | 16 (4.5%) | 1.40× |
| 会话日志损坏（seq gap/并发写） | 69 (2.0%) | 27 (2.2%) | 20 (2.6%) | 9 (1.5%) | 3 (0.8%) | 0.41× |
| 畸形 tool-call 致会话不可恢复 | 50 (1.5%) | 26 (2.2%) | 11 (1.4%) | 11 (1.8%) | 4 (1.1%) | 0.76× |
| Windows 沙箱/TLS/代理 | 56 (1.7%) | 12 (1.0%) | 6 (0.8%) | 8 (1.3%) | 4 (1.1%) | 0.68× |
| 插件加载失败拖垮启动 | 40 (1.2%) | 10 (0.8%) | 16 (2.1%) | 8 (1.3%) | 2 (0.6%) | 0.48× |
| dsh web 启动性能退化 | 24 (0.7%) | 19 (1.6%) | 9 (1.2%) | 5 (0.8%) | 6 (1.7%) | 2.38× |
| dsh web 进程静默死亡 | 21 (0.6%) | 18 (1.5%) | 11 (1.4%) | 7 (1.2%) | 3 (0.8%) | 1.36× |
| 升级后历史会话无法加载 | 25 (0.7%) | 8 (0.7%) | 9 (1.2%) | 8 (1.3%) | 4 (1.1%) | 1.53× |
| 上下文压缩失效 | 11 (0.3%) | 14 (1.2%) | 11 (1.4%) | 12 (2.0%) | 4 (1.1%) | 3.47× |
| 推理退化循环 / 空响应 | 21 (0.6%) | 6 (0.5%) | 7 (0.9%) | 5 (0.8%) | 1 (0.3%) | 0.45× |
| 会话格式迁移失败 | 4 (0.1%) | 1 (0.1%) | 3 (0.4%) | 12 (2.0%) | 15 (4.2%) | 35.77× |
| Composer 输入法/翻译干扰 | 12 (0.4%) | 7 (0.6%) | 3 (0.4%) | 6 (1.0%) | 4 (1.1%) | 3.18× |
| Web 鉴权 / 局域网访问 | 15 (0.4%) | 2 (0.2%) | 4 (0.5%) | 2 (0.3%) | 0 (0.0%) | 0.00× |
| persona/preset 字段重命名破坏 | 6 (0.2%) | 6 (0.5%) | 3 (0.4%) | 4 (0.7%) | 4 (1.1%) | 6.36× |
| Windows 资源管理器定位失败 | 7 (0.2%) | 1 (0.1%) | 1 (0.1%) | 1 (0.2%) | 11 (3.1%) | 14.99× |
| Fork 继承父会话队列 | 2 (0.1%) | 1 (0.1%) | 1 (0.1%) | 1 (0.2%) | 12 (3.4%) | 57.23× |
| client bundle 陈旧失效 | 5 (0.1%) | 1 (0.1%) | 3 (0.4%) | 5 (0.8%) | 2 (0.6%) | 3.82× |
| 工具/提示词节丢失 | 3 (0.1%) | 0 (0.0%) | 4 (0.5%) | 1 (0.2%) | 3 (0.8%) | 9.54× |
| PWA / 移动端 / i18n | 0 (0.0%) | 1 (0.1%) | 1 (0.1%) | 1 (0.2%) | 0 (0.0%) | 0.00× |

### 关键判定（绝对增长 vs 相对抗跌）

> 已分类子集的大盘衰减系数 = 355 / 3386 = **0.105**

- **绝对增长族（3）**：`session-migration` 4→15、`windows-reveal` 7→11、`fork-inbox` 2→12
- **绝对腰斩族（14）**：`other` 2906→257、`npm-install-build` 109→16、`legacy-session-corruption` 69→3、`malformed-toolcall` 50→4、`sandbox-windows` 56→4、`legacy-plugin-load-crash` 40→2、`web-startup-perf` 24→6、`web-process-death` 21→3、`session-history-unreadable` 25→4、`legacy-context-compaction` 11→4、`reasoning-loop` 21→1、`composer-ime` 12→4、`legacy-auth-lan` 15→0、`client-bundle-stale` 5→2

---

## 四、正则分类法遗漏的问题族（LLM 开放式发现）

模型被允许在「现有分类都套不上」时自行命名一个新族（`new_family`）。这是纯关键词法**结构上无法**给出的信号——正则只能命中预设词表，永远不会发现词表外的模式。

> 注意：模型给每篇帖各自取名，同一个问题会出现多种拼写（`windows-path-truncation` / `win32-path-truncation` / `native-picker-path-truncation` 实为同一问题）。因此原始标签必须先经 `canon-new-families.cjs` 做**语义归并**才有意义，下表使用归并后的规范族。

原始标签 **1706** 个，参与归并 92 个（出现 ≥2 次者），归并为 **32** 个规范族。

| 规范新族 | 涉及帖数 | 归并的同义标签 | 说明 |
|---|---|---|---|
| `windows-path-truncation` | 41 | `native-picker-path-truncation`(8)<br>`native-picker-utf16-truncation`(9)<br>`windows-dialog-worker-crash`(2)<br>`windows-native-picker-utf16-truncation`(3)<br>`windows-path-truncation`(6)<br>`native-path-truncation`(5)<br>`win32-path-truncation`(3)<br>`windows-cjk-path-truncation`(2)<br>`native-picker-cjk-truncation`(3) | Path string truncation or encoding issues in Windows native pickers and dialogs. |
| `sandbox-permission-escalation` | 22 | `sandbox-permission-escalation`(2)<br>`sandbox-escape`(3)<br>`sandbox-escalation-logic`(2)<br>`sandbox-escalation-loop`(2)<br>`sandbox-permission-loop`(2)<br>`sandbox-permission-escalation-bug`(3)<br>`sandbox-escalation-same-mode`(2)<br>`sandbox-permission-idempotency`(2)<br>`sandbox-permission-validation`(2)<br>`sandbox-permission-logic`(2) | Logic errors, loops, or validation failures in sandbox permission escalation. |
| `subagent-model-issues` | 18 | `subagent-model-inheritance`(14)<br>`subagent-model-override`(2)<br>`subagent-model-stale`(2) | Inheritance, override, or staleness issues in subagent model definitions. |
| `web-security-vulnerabilities` | 18 | `web-origin-restriction`(2)<br>`web-memory-leak`(2)<br>`web-auth-missing`(2)<br>`web-http-secure-context`(2)<br>`ssrf-vulnerability`(2)<br>`ssrf-fake-ip-block`(2)<br>`security-vulnerabilities`(2)<br>`security-vulnerability`(2)<br>`security-path-traversal`(2) | Security vulnerabilities including SSRF, path traversal, auth, and origin restrictions. |
| `tool-call-validation` | 13 | `hook-config-validation`(2)<br>`tool-call-validation-error`(3)<br>`tool-call-module-duplication`(2)<br>`tool-call-empty-string-overwrite`(2)<br>`tool-call-id-collision`(2)<br>`tool-desc-template-conflict`(2) | Validation, duplication, or collision errors in tool call execution and configuration. |
| `windows-subprocess-issues` | 10 | `windows-subprocess-support`(2)<br>`subprocess-spill-crash`(2)<br>`windows-subprocess-popup`(2)<br>`windows-subprocess-console-flash`(2)<br>`windows-subprocess-flash`(2) | Crashes, crashes, or UI flashes related to Windows subprocess execution. |
| `windows-path-encoding` | 10 | `native-path-encoding`(6)<br>`windows-path-encoding`(4) | Character encoding issues when handling file paths on Windows. |
| `ui-rendering-errors` | 10 | `ui-stats-truncation`(2)<br>`ui-error-display`(2)<br>`ui-workspace-selection-failure`(2)<br>`ui-state-stale`(2)<br>`ui-flicker`(2) | UI rendering, state staleness, flicker, or selection failures. |
| `tool-schema-validation` | 8 | `tool-schema-serialization`(2)<br>`tool-schema-mismatch`(2)<br>`tool-schema-validation`(2)<br>`mcp-schema-validation`(2) | Serialization, mismatch, or validation errors in tool schemas. |
| `windows-dialog-crashes` | 7 | `windows-dialog-focus`(2)<br>`windows-native-crash`(3)<br>`windows-folder-picker-crash`(2) | Crashes or focus issues in Windows native dialogs and pickers. |
| `tool-execution-crash` | 7 | `tool-execution-crash`(3)<br>`unknown-tool-error`(2)<br>`tool-runtime-symbol-mismatch`(2) | Runtime crashes, unknown tools, or symbol mismatches during tool execution. |
| `sdk-session-memory` | 7 | `sdk-session-resume-failure`(3)<br>`sdk-memory-leak`(4) | Session resume failures or memory leaks in the SDK. |
| `plugin-crash` | 6 | `plugin-install-crash`(2)<br>`plugin-hot-reload-failure`(2)<br>`plugin-rpc-injection-failure`(2) | Crashes or failures during plugin installation, hot reloading, or RPC injection. |
| `workspace-path-issues` | 6 | `workspace-path-validation`(2)<br>`workspace-path-resolution`(2)<br>`workspace-cwd-mismatch`(2) | Validation, resolution, or current working directory mismatches in workspace paths. |
| `llm-role-retry-issues` | 5 | `llm-retry-misclassification`(3)<br>`llm-role-incompatibility`(2) | Misclassification during LLM retries or role incompatibility issues. |
| `settings-race-condition` | 5 | `settings-race-condition`(3)<br>`settings-wire-redaction-leak`(2) | Race conditions or data leaks in settings management. |
| `composer-crash` | 4 | `composer-ui-crash`(2)<br>`composer-render-crash`(2) | Crashes in the composer UI or rendering engine. |
| `markdown-rendering-bugs` | 4 | `markdown-strikethrough-misparse`(2)<br>`markdown-rendering-bug`(2) | Parsing or rendering bugs in markdown content. |
| `plugin-event-ignorable` | 3 | `plugin-event-ignorable`(3) | Issues with ignorable plugin events. |

> 上表只列出现 ≥3 帖的规范族；完整归并结果见 `_tools/new-family-canonical.json`。

**这些新族是下一轮分类表应当补入的候选**——它们说明现有 20 个族存在覆盖盲区。

---

## 五、LLM 判定的 critical / high 问题清单

共 **1731** 篇。

| # | 严重度 | 主族 | 标题 | LLM 判定的根因 |
|---|---|---|---|---|
| [#6358](https://github.com/deepseek-ai/deepseek-harness/discussions/6358) | critical | 会话格式迁移失败 | DSH Bug 反馈:会话日志迁移在 exFAT 等"无硬链接"文件系统上失败(ENOTSUP);且迁移会就地改写数据文件导致无法回滚 | Migration logic uses hard links unsupported by exFAT, causing failure and irreversible data corrupti |
| [#6300](https://github.com/deepseek-ai/deepseek-harness/discussions/6300) | critical | 畸形 tool-call 致会话不可恢复 | [Bug][0.1.5-rc.1]畸形 tool-call（空 id/name）被持久化进会话日志，导致会话永久不可恢复（每次回放 400 `missing f | Empty tool-call fields persist in session log, causing permanent session corruption and unrecoverabl |
| [#6283](https://github.com/deepseek-ai/deepseek-harness/discussions/6283) | critical | 会话日志损坏（seq gap/并发写） | [Bug][0.1.2-rc.1] Seeded continuation writer restarts at a regressed seq counter | Seeded continuation logic fails to correctly initialize the sequence counter, causing duplicate and  |
| [#6267](https://github.com/deepseek-ai/deepseek-harness/discussions/6267) | critical | 其它（非问题类或未归类） | V8-level fatal (uncatchable, process-wide) crash in @deepseek-ai/dsh-tools schem | V8-level fatal crash in dsh-tools schema validation recursion causing process death. |
| [#6260](https://github.com/deepseek-ai/deepseek-harness/discussions/6260) | critical | 其它（非问题类或未归类） | [Bug]dsh删了我的文件,如果反馈有帮助，希望可以修复。 | Sandbox cleanup ignores umount failure, allowing rm -rf to delete mounted user directory. |
| [#6152](https://github.com/deepseek-ai/deepseek-harness/discussions/6152) | critical | 畸形 tool-call 致会话不可恢复 | Empty tool calls (name/callId empty) are persisted without validation, then fail | Lack of validation on empty tool calls during persistence causes session corruption on load. |
| [#6019](https://github.com/deepseek-ai/deepseek-harness/discussions/6019) | critical | 其它（非问题类或未归类） | SSRF via degraded public-address validation in `@deepseek-ai/dsh-web-fetch-http` | SSRF vulnerability in web_fetch-http package due to skipped address validation when proxy is configu |
| [#6004](https://github.com/deepseek-ai/deepseek-harness/discussions/6004) | critical | 其它（非问题类或未归类） | [Security]Path traversal / arbitrary file write in `@deepseek-ai/dsh-storage-jso | Unvalidated record key in legacy migration allows path traversal. |
| [#6001](https://github.com/deepseek-ai/deepseek-harness/discussions/6001) | critical | 会话日志损坏（seq gap/并发写） | [Bug] Cross-process cold attach: observeSession/promote commits crash-repair clo | Cross-process concurrent writer race condition corrupts session log with colliding sequence numbers. |
| [#5902](https://github.com/deepseek-ai/deepseek-harness/discussions/5902) | critical | dsh web 进程静默死亡 | dsh web crash: uncaught ENOENT in dsh-subprocess-local spillAll kills the whole  | Uncaught ENOENT exception in synchronous spill logic kills the main process when temp dir is deleted |
| [#5871](https://github.com/deepseek-ai/deepseek-harness/discussions/5871) | critical | Windows 沙箱/TLS/代理 | [Security][Windows sandbox] workspace-write modified files outside the authorize | Sandbox permission enforcement failure allowing file writes outside authorized workspace boundaries. |
| [#5724](https://github.com/deepseek-ai/deepseek-harness/discussions/5724) | critical | dsh web 进程静默死亡 | 合并代码后OOM了，session处理V1升级到V2的兼容处理有问题，详细描述如下 | OOM crash during concurrent V1 to V2 session migration due to excessive memory usage. |
| [#5655](https://github.com/deepseek-ai/deepseek-harness/discussions/5655) | critical | 会话日志损坏（seq gap/并发写） | [Bug report / incident] dsh web fails to boot on corrupt session-log first frame | Corrupt zstd session log frame and broken plugin link restoration via zip backup. |
| [#5640](https://github.com/deepseek-ai/deepseek-harness/discussions/5640) | critical | 会话日志损坏（seq gap/并发写） | 【Bug Report】session: committed-region seq collisions from divergent next-seq cur | Divergent sequence cursors cause seq collisions, corrupting session logs and making them unobservabl |
| [#5561](https://github.com/deepseek-ai/deepseek-harness/discussions/5561) | critical | 其它（非问题类或未归类） | [Security] Sandboxed agent can bypass its file sandbox through the unauthenticat | Sandboxed agent bypasses file restrictions via unauthenticated localhost gateway to create new sessi |
| [#5460](https://github.com/deepseek-ai/deepseek-harness/discussions/5460) | critical | 会话日志损坏（seq gap/并发写） | Bug: JSONL session ownership is process-local, allowing concurrent writers | JSONL persistence uses process-local state for writer ownership, allowing concurrent writers to corr |
| [#5445](https://github.com/deepseek-ai/deepseek-harness/discussions/5445) | critical | 会话日志损坏（seq gap/并发写） | 长会话触发 Content Exists Risk / INVALID_REQUEST，整个会话被 400 拒绝，能否恢复？(dsh + DeepSeek AP | Session log corruption causes persistent INVALID_REQUEST errors, preventing session recovery. |
| [#5263](https://github.com/deepseek-ai/deepseek-harness/discussions/5263) | critical | 上下文压缩失效 | Auto-compaction destroys history on a bodyless HTTP 400 (misclassified as CONTEX | Misclassification of HTTP 400 as context exceeded triggers unsafe auto-compaction bypassing safety t |
| [#5255](https://github.com/deepseek-ai/deepseek-harness/discussions/5255) | critical | 会话日志损坏（seq gap/并发写） | Session logs corrupted by concurrent writers: append path trusts its in-memory c | Append path lacks concurrency guard, allowing overlapping writes and seq gaps. |
| [#4910](https://github.com/deepseek-ai/deepseek-harness/discussions/4910) | critical | 会话格式迁移失败 | [Architecture] All persistence formats hard-refuse non-current versions with zer | Persistence layer hard-refuses non-current versions without implementing any migration logic, causin |
| [#4889](https://github.com/deepseek-ai/deepseek-harness/discussions/4889) | critical | 畸形 tool-call 致会话不可恢复 | DSH agent 无法执行任何工具调用 | Tool call events persist with empty name and callId fields, causing execution failure. |
| [#4688](https://github.com/deepseek-ai/deepseek-harness/discussions/4688) | critical | Windows 沙箱/TLS/代理 | [Security] Windows workspace-write sandbox: DeleteFile via .NET API can delete f | Sandbox permission logic fails to restrict file deletion operations via .NET API, allowing escape fr |
| [#4662](https://github.com/deepseek-ai/deepseek-harness/discussions/4662) | critical | 会话日志损坏（seq gap/并发写） | 会话日志并发写损坏修复：跨进程写锁 + 尾部 seq 校验（附完整修复分支） | Concurrent writes to session log without cross-process locking cause sequence gaps and data corrupti |
| [#4611](https://github.com/deepseek-ai/deepseek-harness/discussions/4611) | critical | 畸形 tool-call 致会话不可恢复 | An empty tool call (callId = "") makes an entire history session unreadable (Ses | Empty tool call ID persists, causing validation failure and session corruption. |
| [#4598](https://github.com/deepseek-ai/deepseek-harness/discussions/4598) | critical | 会话日志损坏（seq gap/并发写） | 中断工具调用后重试会复用旧 seq，导致会话日志损坏无法打开（seq gap in committed region） | Retry events reuse interrupted seq instead of incrementing, causing gaps in committed log. |
| [#4569](https://github.com/deepseek-ai/deepseek-harness/discussions/4569) | critical | 会话日志损坏（seq gap/并发写） | Session log corrupted by concurrent writes when the host is restarted mid-turn ( | Concurrent writes from old and new PM2 processes cause sequence number gaps and interleaving in the  |
| [#4530](https://github.com/deepseek-ai/deepseek-harness/discussions/4530) | critical | 其它（非问题类或未归类） | [0.1.1-rc.2] Web UI 永久无响应：高并发下 session/projection RPC 无限写循环 | Unbounded feedback loop in session/projection RPC causing infinite write loop and server hang under  |
| [#4506](https://github.com/deepseek-ai/deepseek-harness/discussions/4506) | critical | 会话日志损坏（seq gap/并发写） | [Bug] Multi-process shared session root: concurrent writes corrupt the JSONL ses | Concurrent writes from multiple processes to the same session log cause sequence gaps and JSONL corr |
| [#4503](https://github.com/deepseek-ai/deepseek-harness/discussions/4503) | critical | 其它（非问题类或未归类） | [Security] All sandbox modes allow connecting to privileged local daemons (Docke | Sandbox Seatbelt profile lacks deny rules for network connections and socket access, allowing unauth |
| [#4496](https://github.com/deepseek-ai/deepseek-harness/discussions/4496) | critical | 其它（非问题类或未归类） | 同时配置两个deepseek的密钥，一个个人的，一个公司的，选择了公司的模型，结果扣了个人的钱 | Billing routing logic fails to respect selected model provider when multiple API keys are configured |
| [#4491](https://github.com/deepseek-ai/deepseek-harness/discussions/4491) | critical | 其它（非问题类或未归类） | 好家伙，自己派子代理，然后嫌弃子代理慢，强制终止 | Agent tool execution caused unintended data loss via git reset without proper safeguards. |
| [#4478](https://github.com/deepseek-ai/deepseek-harness/discussions/4478) | critical | 其它（非问题类或未归类） | Deepseek Harness私自调用我的Deepseek V4 api进行扣钱，把余额都扣没了！！ | Unauthorized API calls to DeepSeek model despite no configuration, causing financial loss. |
| [#4387](https://github.com/deepseek-ai/deepseek-harness/discussions/4387) | critical | 畸形 tool-call 致会话不可恢复 | [Bug] A degenerate streamed tool call (empty callId) is persisted, then the load | Empty tool call ID persists and causes loader rejection, making session permanently unloadable. |
| [#4384](https://github.com/deepseek-ai/deepseek-harness/discussions/4384) | critical | 其它（非问题类或未归类） | [Security]AI自行提级的潜在安全漏洞Potential security risks of AI upgrading itself | Missing authentication on local API endpoints allows unauthorized privilege escalation. |
| [#4343](https://github.com/deepseek-ai/deepseek-harness/discussions/4343) | critical | 会话日志损坏（seq gap/并发写） | JSONL history becomes unloadable when cold recovery races a live writer | Race condition between cold recovery and live writer causes JSONL sequence gaps and corruption. |
| [#4313](https://github.com/deepseek-ai/deepseek-harness/discussions/4313) | critical | 其它（非问题类或未归类） | [Bug 报告] 数据外泄面：/api/session.export 无认证导出完整日志+附件；FULL 遥测模式原始导出无脱敏 | Missing authentication on session export API and missing data redaction in telemetry export. |
| [#4309](https://github.com/deepseek-ai/deepseek-harness/discussions/4309) | critical | 畸形 tool-call 致会话不可恢复 | Crashed tool call leaves dangling tool_calls in session history (session permane | Module shadowing causes tool call persistence failure, leaving session permanently bricked. |
| [#4292](https://github.com/deepseek-ai/deepseek-harness/discussions/4292) | critical | 其它（非问题类或未归类） | DSH 文件读取路径无访问控制（含 shell 旁路）问题反馈 | Sandbox and tool configurations lack read access controls, allowing unrestricted file and environmen |
| [#4274](https://github.com/deepseek-ai/deepseek-harness/discussions/4274) | critical | 会话日志损坏（seq gap/并发写） | 会话恢复的 end-seed 与 inbox-splice 序列号冲突，历史损坏无法加载 | Race condition between session resume and inbox mutation causes duplicate sequence numbers, corrupti |
| [#4221](https://github.com/deepseek-ai/deepseek-harness/discussions/4221) | critical | 其它（非问题类或未归类） | llm adapters: chat completions and model discovery do not opt into the redirect  | LLM adapters do not opt into the redirect policy, allowing sensitive conversation bodies to leak via |
| [#4178](https://github.com/deepseek-ai/deepseek-harness/discussions/4178) | critical | 会话日志损坏（seq gap/并发写） | [BUG] 两个 dsh web 实例并发打开同一会话，导致会话日志 seq 冲突、历史记录损坏 | Concurrent writes to the same session log file cause sequence number collisions and data corruption. |
| [#4100](https://github.com/deepseek-ai/deepseek-harness/discussions/4100) | critical | 其它（非问题类或未归类） | Privacy: telemetry FULL mode exports complete prompts/tool results/error text wi | Telemetry lacks redaction logic, exposing sensitive data like API keys and private keys in logs and  |
| [#4096](https://github.com/deepseek-ai/deepseek-harness/discussions/4096) | critical | 其它（非问题类或未归类） | Chain: preset roots/default replaceable by later layers — arbitrary preset direc | Preset root configuration allows arbitrary directory replacement, enabling arbitrary code execution  |
| [#4095](https://github.com/deepseek-ai/deepseek-harness/discussions/4095) | critical | 其它（非问题类或未归类） | Hardening: !!js config expressions evaluate at mount in every non-repo layer — p | YAML !!js expressions execute arbitrary code at runtime in config patches, bypassing build-time secu |
| [#4094](https://github.com/deepseek-ai/deepseek-harness/discussions/4094) | critical | 其它（非问题类或未归类） | Hardening: any patch layer can silently replace security-bearing rows (sandbox p | Patch engine lacks protected-row concept, allowing silent replacement of security-critical configura |
| [#4092](https://github.com/deepseek-ai/deepseek-harness/discussions/4092) | critical | 其它（非问题类或未归类） | web_fetch is an unattended, approval-free SSRF primitive: no private-network fil | Missing private-network filtering and permission integration in web_fetch tool. |
| [#4091](https://github.com/deepseek-ai/deepseek-harness/discussions/4091) | critical | 其它（非问题类或未归类） | Bug: duplicate provider tool-call index silently merges two calls into one — the | Streaming tool-call deltas keyed by provider index lack duplicate detection, causing silent merge of |
| [#4084](https://github.com/deepseek-ai/deepseek-harness/discussions/4084) | critical | 会话日志损坏（seq gap/并发写） | Bug：Session log corrupted after seed compaction: writer resumes with stale seq c | Stale sequence counter after seed compaction causes seq gap, corrupting session log. |
| [#4081](https://github.com/deepseek-ai/deepseek-harness/discussions/4081) | critical | 其它（非问题类或未归类） | DoS family: planted session artifacts exhaust memory at boot, burn CPU in list() | Lack of input validation and caps in JSONL session loading allows DoS attacks via planted artifacts. |
| [#4080](https://github.com/deepseek-ai/deepseek-harness/discussions/4080) | critical | 其它（非问题类或未归类） | Bug: case-fold lexical fast path lets writes land OUTSIDE every writable root wh | Case-fold lexical fast path in isPathUnder allows path traversal outside sandbox roots on case-insen |
| [#4067](https://github.com/deepseek-ai/deepseek-harness/discussions/4067) | critical | 会话日志损坏（seq gap/并发写） | Session log corrupts when two dsh processes write the same JSONL session — recov | Race condition in JSONL persistence allows duplicate sequence numbers when multiple processes write  |
| [#4039](https://github.com/deepseek-ai/deepseek-harness/discussions/4039) | critical | 其它（非问题类或未归类） | 致命缺陷：deepseek明文泄露风险 | API key stored in plaintext file without user awareness, posing security risk. |
| [#4032](https://github.com/deepseek-ai/deepseek-harness/discussions/4032) | critical | 其它（非问题类或未归类） | Security fix: DNS rebinding can bypass the local API's cross-site fence (Host-he | Missing Host header validation in local API proxy allows DNS rebinding attacks. |
| [#3899](https://github.com/deepseek-ai/deepseek-harness/discussions/3899) | critical | 其它（非问题类或未归类） | [Bug] dsh-tools Symbol 实例分裂导致工具调用崩溃，且依赖不匹配时整个 dsh 直接不可用 | Symbol instance mismatch between main process and plugin due to duplicate module copies. |
| [#3896](https://github.com/deepseek-ai/deepseek-harness/discussions/3896) | critical | 会话日志损坏（seq gap/并发写） | 会话恢复时写入游标错位导致 seq 重复，会话日志损坏、历史无法加载（一周内两次） | Cursor misalignment during session recovery causes duplicate seq writes and data loss. |
| [#3872](https://github.com/deepseek-ai/deepseek-harness/discussions/3872) | critical | 会话日志损坏（seq gap/并发写） | [Bug] 打断后的迟到流式事件破坏会话日志序号连续性，整个会话变得无法读取 \| Late streaming events after interrupti | Late streaming events after interruption have lower sequence numbers than interruption markers, brea |
| [#3849](https://github.com/deepseek-ai/deepseek-harness/discussions/3849) | critical | 会话日志损坏（seq gap/并发写） | [Bug Report] 会话中断恢复后合成收尾事件与续写事件 seq 重叠，导致日志损坏、历史无法加载 | Session log corruption due to sequence number overlap during interrupt recovery, preventing history  |
| [#3719](https://github.com/deepseek-ai/deepseek-harness/discussions/3719) | critical | 其它（非问题类或未归类） | [Bug][POSIX] storage-json can overwrite a published write after directory fsync  | POSIX fsync failure after rename causes stale cache overwrite of published data. |
| [#3664](https://github.com/deepseek-ai/deepseek-harness/discussions/3664) | critical | 会话日志损坏（seq gap/并发写） | [Analysis] Subagent cancellation & session persistence: root-cause analysis with | Subagent cancellation causes permanent session persistence corruption due to disposal timing issues. |
| [#3662](https://github.com/deepseek-ai/deepseek-harness/discussions/3662) | critical | 会话日志损坏（seq gap/并发写） | [Bug] Cancelling a task that spawned subagents permanently corrupts session pers | Unclosed turn/tool entries in subagent logs cause parent session persistence failure and data loss. |
| [#3633](https://github.com/deepseek-ai/deepseek-harness/discussions/3633) | critical | 会话日志损坏（seq gap/并发写） | [Bug] [Update] Missing session-level lock silently corrupts shared-home deployme | Missing file-level locking allows concurrent writers to silently corrupt session logs. |
| [#3477](https://github.com/deepseek-ai/deepseek-harness/discussions/3477) | critical | 其它（非问题类或未归类） | [bug] async 工具 execute() 内 spawnSync → 事件循环死锁（microtask checkpoint 内嵌套 uv_run 重入 | Event loop deadlock caused by nested uv_run via spawnSync during microtask checkpoint. |
| [#3401](https://github.com/deepseek-ai/deepseek-harness/discussions/3401) | critical | 会话日志损坏（seq gap/并发写） | [Bug] Concurrent writing to the same session log corrupts seq (corrupt session l | Concurrent writes to the same session log cause seq counter race conditions and backward jumps. |
| [#3354](https://github.com/deepseek-ai/deepseek-harness/discussions/3354) | critical | 其它（非问题类或未归类） | [Security]DeepSeek Harness `dsh.bundle.patch` 清单字段路径遍历，可读取 bundle 包目录之外的任意 YAML/ | Path traversal vulnerability in loadProfile due to missing validation of bundle patch paths. |
| [#3294](https://github.com/deepseek-ai/deepseek-harness/discussions/3294) | critical | 会话日志损坏（seq gap/并发写） | 两个 harness 进程共享同一 sessions root 会损坏"回合进行中"的会话日志 —— 一方合成崩溃修复写入 + 另一方盲目追加，且整个持久化栈没 | Lack of cross-process locking allows concurrent writers to corrupt session logs with sequence gaps. |
| [#3252](https://github.com/deepseek-ai/deepseek-harness/discussions/3252) | critical | 其它（非问题类或未归类） | Sandbox containment: three structural gaps, and a request for a private disclosu | Security vulnerability in sandbox containment logic and missing private disclosure channel. |
| [#3245](https://github.com/deepseek-ai/deepseek-harness/discussions/3245) | critical | 其它（非问题类或未归类） | [Security]DeepSeek Harness `run_code` (Code Mode) executes model-written TypeScr | Code execution tool lacks sandbox confinement, allowing arbitrary file and process access. |
| [#3142](https://github.com/deepseek-ai/deepseek-harness/discussions/3142) | critical | 会话日志损坏（seq gap/并发写） | [Bug] 会话续接（resume）写入与中断回合的收尾写入竞态，导致会话日志 seq 重叠损坏 | Race condition during session resume after interruption causes duplicate event writes and sequence n |
| [#3099](https://github.com/deepseek-ai/deepseek-harness/discussions/3099) | critical | 会话日志损坏（seq gap/并发写） | Session log corruption when two harness processes share one DSH_HOME (stale live | Concurrent writes to shared session log cause sequence gaps, corrupting the log and making it unread |
| [#3051](https://github.com/deepseek-ai/deepseek-harness/discussions/3051) | critical | 其它（非问题类或未归类） | [Security] DeepSeek Harness `web_fetch` 工具与命令沙箱缺乏 SSRF/私网出口过滤，可被诱导访问云元数据与内网服务 | Missing SSRF and private network filtering in web_fetch tool and command sandbox. |
| [#3045](https://github.com/deepseek-ai/deepseek-harness/discussions/3045) | critical | 其它（非问题类或未归类） | [Security] WSL2 interop 通道完全穿透 workspace-write 沙箱：bwrap 只读挂载对 Windows 侧进程无效（含 Po | WSL interop bypasses bwrap sandbox isolation, allowing full Windows access. |
| [#3013](https://github.com/deepseek-ai/deepseek-harness/discussions/3013) | critical | 其它（非问题类或未归类） | Title: [Architecture Audit] v0.1.0-rc.6: Systematic lack of per-item fault toler | Systematic lack of per-item fault tolerance in session persistence and boot chain causes full DoS fr |
| [#2960](https://github.com/deepseek-ai/deepseek-harness/discussions/2960) | critical | 会话日志损坏（seq gap/并发写） | RFC: Agent Loop 稳定性系统性问题汇总与改进建议（Agent Loop Stability: consolidated issues & prop | Session state replay inconsistencies and tool-call block mismatches cause permanent session corrupti |
| [#2900](https://github.com/deepseek-ai/deepseek-harness/discussions/2900) | critical | 畸形 tool-call 致会话不可恢复 | DSH Bug 反馈报告：工具执行崩溃后回合被标记为已结束，留下悬空 tool_calls，会话永久 400 卡死 | Tool execution crash leaves orphaned tool_calls, causing session corruption and permanent 400 error. |
| [#2829](https://github.com/deepseek-ai/deepseek-harness/discussions/2829) | critical | 其它（非问题类或未归类） | Security: dsh web has no authentication and is reachable by every local user on  | Default configuration lacks authentication and uses loopback binding which is shared across users on |
| [#2802](https://github.com/deepseek-ai/deepseek-harness/discussions/2802) | critical | 其它（非问题类或未归类） | [Bug] rc.6: every tool call fails with "unknown tool """ — streamed deltas drop  | Streamed tool-call deltas lose name/id after first chunk, causing empty tool resolution. |
| [#2787](https://github.com/deepseek-ai/deepseek-harness/discussions/2787) | critical | 会话日志损坏（seq gap/并发写） | 为什么我的deepseek harness在跑过程中，把我会话、CC Switch、Claude code 的历史记录给清空了！！！！！！！ | File I/O error (ENOENT) caused session data loss and corruption across multiple workspaces. |
| [#2756](https://github.com/deepseek-ai/deepseek-harness/discussions/2756) | critical | 其它（非问题类或未归类） | deepseek-harness存在安全漏洞导致我的apikey泄露 | Security vulnerability causing unauthorized API key usage and billing leakage. |
| [#2725](https://github.com/deepseek-ai/deepseek-harness/discussions/2725) | critical | 畸形 tool-call 致会话不可恢复 | [BUG_REPORT] dsh_unknown_tool delta calling | Streaming delta drops tool name, persisting empty tool-call that corrupts session history. |
| [#2627](https://github.com/deepseek-ai/deepseek-harness/discussions/2627) | critical | 会话日志损坏（seq gap/并发写） | DSH-BUG-REPORT-seq-gap-overlap | Session log corruption due to sequence number overlap/gap during crash recovery, making history unre |

> 仅列出前 80 条（按严重度与编号排序）；完整数据见 `_tools/llm-classify.jsonl`。

---

## 六、复现与维护

```powershell
cd E:\test\rewrite-agently\dsh-docs-deliverables\discussion-issues\_tools

# 1. 探测端点吞吐（可选，用于确认并发放大量）
node probe-throughput.cjs 4 16

# 2. 全量分类（可中断续跑：已完成的 number 会被跳过）
node llm-classify.cjs --concurrency 4

# 3. 生成本报告（幂等）
node llm-trend-report.cjs
```

**并发选择依据**（实测该端点）：

| 并发 | 吞吐 | p90 延迟 |
|---|---|---|
| 4 | 2.45 calls/s | 2.5 s |
| 16 | 0.53 calls/s | 46.1 s |

> 并发提高到 16 反而使吞吐降到 1/5（端点排队），因此固定 4。这既是性能最优，也避免打满共享的局域网推理机。

---

## 七、口径局限

1. **单模型单次判定**：未做多次采样一致性校验；`confidence` 字段可用于筛出低置信样本复判，但本轮未做。
2. **正文截断至 1200 字符**：超长帖子（如 #6252 的 108k 字符）的尾部细节未进入判定，可能低估其严重度。
3. **`is_bug` 依赖模型判断**：功能请求与缺陷的边界存在主观性，跨模型复核可提高稳健性。
4. **`primary` 的互斥是模型选择的结果**：互斥解决了份额可加性问题，但丢弃了「一帖多因」信息；多标签分析请看 `families` 字段。
5. **覆盖率**：100.0%。未覆盖部分在结论中按缺失处理，不做外推。
6. **确定性**：本报告除首行「生成时间」外完全确定——同一 `llm-classify.jsonl` 重复运行产出字节一致的正文（已实测）。
