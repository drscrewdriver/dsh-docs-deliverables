# Bug 归类趋势报告（LLM 语义分类）

> 生成时间：2026-09-30T23:37:16Z
> 语料：DeepSeek Harness GitHub Discussions #13–#8513，共 8377 篇
> 分类器：**Qwen3.6-35B-A3B**（局域网 vLLM @ `192.168.100.242:8200`，温度 0.1，JSON 约束输出）
> 已分类：**8377 / 8377**（覆盖率 100.0%）

---

## 一、为什么必须换成 LLM：正则口径的失真量化

正则（关键词 OR 匹配）只能做「分词解析」，其根本缺陷是**一个帖子同时命中多个族**，导致各族计数之和远超总篇数、份额无法相加、跨族比较被交叉召回污染。

LLM 版要求模型给出**唯一的 `primary` 族**，因此分布是互斥的、份额相加恒为 100%。下表把两种口径并排，量化正则的偏差：

| 问题族 | 正则命中 | LLM 主族 | 偏差 | 说明 |
|---|---|---|---|---|
| `npm-install-build` | 297 | 356 | -17% | 基本一致 |
| `sandbox-windows` | 793 | 174 | +356% | 正则显著高估 |
| `legacy-session-corruption` | 99 | 142 | -30% | 基本一致 |
| `malformed-toolcall` | 271 | 132 | +105% | 正则显著高估 |
| `legacy-plugin-load-crash` | 61 | 99 | -38% | 基本一致 |
| `web-startup-perf` | 102 | 87 | +17% | 基本一致 |
| `legacy-context-compaction` | 458 | 81 | +465% | 正则显著高估 |
| `session-migration` | 128 | 79 | +62% | 正则显著高估 |
| `web-process-death` | 233 | 74 | +215% | 正则显著高估 |
| `session-history-unreadable` | 310 | 71 | +337% | 正则显著高估 |
| `windows-reveal` | 80 | 65 | +23% | 基本一致 |
| `reasoning-loop` | 78 | 55 | +42% | 基本一致 |
| `composer-ime` | 80 | 50 | +60% | 正则显著高估 |
| `persona-preset-break` | 77 | 33 | +133% | 正则显著高估 |
| `fork-inbox` | 62 | 30 | +107% | 正则显著高估 |
| `legacy-auth-lan` | 1240 | 26 | +4669% | 正则显著高估 |
| `client-bundle-stale` | 163 | 20 | +715% | 正则显著高估 |
| `tool-visibility` | 82 | 17 | +382% | 正则显著高估 |
| `legacy-token-auth-pwa` | 593 | 3 | +19667% | 正则显著高估 |
| `legacy-sandbox-escalation` | 84 | 0 | — | 正则误报（LLM 判为 other） |

### 量化结论

| 指标 | 正则 | LLM |
|---|---|---|
| 同一子集(8377 篇)的总命中次数 | 5291 | 8650 |
| 平均每篇命中族数 | 0.63 | 1.03 |
| 命中率冗余度（总命中 ÷ 篇数） | 0.63× | — |

- 正则**单族命中**且与 LLM 主族一致：**443** 篇（5.3%）
- 正则**完全未命中**但 LLM 判定属于某具体问题族：**428** 篇（5.1%）— 这是正则漏检
- 正则**有命中**但 LLM 判定为非问题（other）：**2555** 篇（30.5%）— 这是正则误报

正则平均每篇命中 **0.63** 个族，而 LLM 为 **1.03** 个（多标签模式）或恒为 1（主族模式）。正则的命中冗余正是此前「各族之和远超总篇数、份额无法相加」的根源。

---

## 二、LLM 语义分类分布（互斥口径，全体已分类）

| 问题族 | 篇数 | 占比 |
|---|---|---|
| 其它（非问题类或未归类） `other` | 6783 | 81.0% |
| npm 安装/构建失败 `npm-install-build` | 356 | 4.2% |
| Windows 沙箱/TLS/代理 `sandbox-windows` | 174 | 2.1% |
| 会话日志损坏（seq gap/并发写） `legacy-session-corruption` | 142 | 1.7% |
| 畸形 tool-call 致会话不可恢复 `malformed-toolcall` | 132 | 1.6% |
| 插件加载失败拖垮启动 `legacy-plugin-load-crash` | 99 | 1.2% |
| dsh web 启动性能退化 `web-startup-perf` | 87 | 1.0% |
| 上下文压缩失效 `legacy-context-compaction` | 81 | 1.0% |
| 会话格式迁移失败 `session-migration` | 79 | 0.9% |
| dsh web 进程静默死亡 `web-process-death` | 74 | 0.9% |
| 升级后历史会话无法加载 `session-history-unreadable` | 71 | 0.8% |
| Windows 资源管理器定位失败 `windows-reveal` | 65 | 0.8% |
| 推理退化循环 / 空响应 `reasoning-loop` | 55 | 0.7% |
| Composer 输入法/翻译干扰 `composer-ime` | 50 | 0.6% |
| persona/preset 字段重命名破坏 `persona-preset-break` | 33 | 0.4% |
| Fork 继承父会话队列 `fork-inbox` | 30 | 0.4% |
| Web 鉴权 / 局域网访问 `legacy-auth-lan` | 26 | 0.3% |
| client bundle 陈旧失效 `client-bundle-stale` | 20 | 0.2% |
| 工具/提示词节丢失 `tool-visibility` | 17 | 0.2% |
| PWA / 移动端 / i18n `legacy-token-auth-pwa` | 3 | 0.0% |
| **合计** | **8377** | **100%** |

- **Bug 类**: 4229 篇（50.5%）— 非 Bug 类含功能请求、插件展示、提问与讨论

### 严重度分布（仅 Bug 类）

| 严重度 | 篇数 | 占 Bug 类 |
|---|---|---|
| critical | 166 | 3.9% |
| high | 2384 | 56.4% |
| medium | 1262 | 29.8% |
| low | 417 | 9.9% |

### 主要族的严重度构成

| 问题族 | critical | high | medium | low |
|---|---|---|---|---|
| 其它（非问题类或未归类） | 80 | 1266 | 1005 | 4432 |
| npm 安装/构建失败 | 0 | 270 | 50 | 36 |
| Windows 沙箱/TLS/代理 | 6 | 134 | 20 | 14 |
| 会话日志损坏（seq gap/并发写） | 48 | 91 | 1 | 2 |
| 畸形 tool-call 致会话不可恢复 | 18 | 109 | 4 | 1 |
| 插件加载失败拖垮启动 | 1 | 85 | 4 | 9 |
| dsh web 启动性能退化 | 1 | 36 | 42 | 8 |
| 上下文压缩失效 | 4 | 50 | 25 | 2 |
| 会话格式迁移失败 | 4 | 70 | 2 | 3 |
| dsh web 进程静默死亡 | 3 | 69 | 1 | 1 |
| 升级后历史会话无法加载 | 1 | 59 | 11 | 0 |
| Windows 资源管理器定位失败 | 0 | 8 | 56 | 1 |

---

## 三、周度趋势（LLM 主族，互斥口径）

> 因语料总量剧烈衰减（W0 3386 篇 → W4 355 篇），下表同时给出**绝对篇数**与**当周占比**。占比是互斥口径，可直接横向比较。

| 周 | 区间 | 已分类 | W0 | W1 | W2 | W3 | W4 | W5 | W6 |
|---|---|---|---|---|---|---|---|---|---|
| 篇数 | | | 3388 | 1206 | 767 | 608 | 803 | 753 | 852 |

### 各族周度篇数与占比

| 问题族 | W0 | W1 | W2 | W3 | W4 | W5 | W6 | W0→末周 |
|---|---|---|---|---|---|---|---|---|
| 其它（非问题类或未归类） | 2908 (85.8%) | 988 (81.9%) | 609 (79.4%) | 468 (77.0%) | 606 (75.5%) | 561 (74.5%) | 643 (75.5%) | 0.88× |
| npm 安装/构建失败 | 109 (3.2%) | 58 (4.8%) | 35 (4.6%) | 34 (5.6%) | 30 (3.7%) | 61 (8.1%) | 29 (3.4%) | 1.06× |
| Windows 沙箱/TLS/代理 | 56 (1.7%) | 12 (1.0%) | 6 (0.8%) | 8 (1.3%) | 10 (1.2%) | 16 (2.1%) | 66 (7.7%) | 4.69× |
| 会话日志损坏（seq gap/并发写） | 69 (2.0%) | 27 (2.2%) | 20 (2.6%) | 9 (1.5%) | 8 (1.0%) | 5 (0.7%) | 4 (0.5%) | 0.23× |
| 畸形 tool-call 致会话不可恢复 | 50 (1.5%) | 26 (2.2%) | 11 (1.4%) | 11 (1.8%) | 11 (1.4%) | 14 (1.9%) | 9 (1.1%) | 0.72× |
| 插件加载失败拖垮启动 | 40 (1.2%) | 10 (0.8%) | 16 (2.1%) | 8 (1.3%) | 8 (1.0%) | 11 (1.5%) | 6 (0.7%) | 0.60× |
| dsh web 启动性能退化 | 24 (0.7%) | 19 (1.6%) | 9 (1.2%) | 5 (0.8%) | 9 (1.1%) | 12 (1.6%) | 9 (1.1%) | 1.49× |
| 上下文压缩失效 | 11 (0.3%) | 14 (1.2%) | 11 (1.4%) | 12 (2.0%) | 9 (1.1%) | 11 (1.5%) | 13 (1.5%) | 4.70× |
| 会话格式迁移失败 | 4 (0.1%) | 1 (0.1%) | 3 (0.4%) | 12 (2.0%) | 31 (3.9%) | 8 (1.1%) | 20 (2.3%) | 19.88× |
| dsh web 进程静默死亡 | 21 (0.6%) | 18 (1.5%) | 11 (1.4%) | 7 (1.2%) | 9 (1.1%) | 3 (0.4%) | 5 (0.6%) | 0.95× |
| 升级后历史会话无法加载 | 25 (0.7%) | 8 (0.7%) | 9 (1.2%) | 8 (1.3%) | 8 (1.0%) | 7 (0.9%) | 6 (0.7%) | 0.95× |
| Windows 资源管理器定位失败 | 7 (0.2%) | 1 (0.1%) | 1 (0.1%) | 1 (0.2%) | 21 (2.6%) | 15 (2.0%) | 19 (2.2%) | 10.79× |
| 推理退化循环 / 空响应 | 21 (0.6%) | 6 (0.5%) | 7 (0.9%) | 5 (0.8%) | 4 (0.5%) | 8 (1.1%) | 4 (0.5%) | 0.76× |
| Composer 输入法/翻译干扰 | 12 (0.4%) | 7 (0.6%) | 3 (0.4%) | 6 (1.0%) | 9 (1.1%) | 7 (0.9%) | 6 (0.7%) | 1.99× |
| persona/preset 字段重命名破坏 | 6 (0.2%) | 6 (0.5%) | 3 (0.4%) | 4 (0.7%) | 5 (0.6%) | 3 (0.4%) | 6 (0.7%) | 3.98× |
| Fork 继承父会话队列 | 2 (0.1%) | 1 (0.1%) | 1 (0.1%) | 1 (0.2%) | 18 (2.2%) | 6 (0.8%) | 1 (0.1%) | 1.99× |
| Web 鉴权 / 局域网访问 | 15 (0.4%) | 2 (0.2%) | 4 (0.5%) | 2 (0.3%) | 0 (0.0%) | 2 (0.3%) | 1 (0.1%) | 0.27× |
| client bundle 陈旧失效 | 5 (0.1%) | 1 (0.1%) | 3 (0.4%) | 5 (0.8%) | 2 (0.2%) | 2 (0.3%) | 2 (0.2%) | 1.59× |
| 工具/提示词节丢失 | 3 (0.1%) | 0 (0.0%) | 4 (0.5%) | 1 (0.2%) | 5 (0.6%) | 1 (0.1%) | 3 (0.4%) | 3.98× |
| PWA / 移动端 / i18n | 0 (0.0%) | 1 (0.1%) | 1 (0.1%) | 1 (0.2%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0.00× |

### 关键判定（绝对增长 vs 相对抗跌）

> 已分类子集的大盘衰减系数 = 852 / 3388 = **0.251**

- **绝对增长族（2）**：`session-migration` 4→20、`windows-reveal` 7→19
- **绝对腰斩族（13）**：`other` 2908→643、`npm-install-build` 109→29、`legacy-session-corruption` 69→4、`malformed-toolcall` 50→9、`legacy-plugin-load-crash` 40→6、`web-startup-perf` 24→9、`web-process-death` 21→5、`session-history-unreadable` 25→6、`reasoning-loop` 21→4、`composer-ime` 12→6、`fork-inbox` 2→1、`legacy-auth-lan` 15→1、`client-bundle-stale` 5→2

---

## 四、正则分类法遗漏的问题族（LLM 开放式发现）

模型被允许在「现有分类都套不上」时自行命名一个新族（`new_family`）。这是纯关键词法**结构上无法**给出的信号——正则只能命中预设词表，永远不会发现词表外的模式。

> 注意：模型给每篇帖各自取名，同一个问题会出现多种拼写（`windows-path-truncation` / `win32-path-truncation` / `native-picker-path-truncation` 实为同一问题）。因此原始标签必须先经 `canon-new-families.cjs` 做**语义归并**才有意义，下表使用归并后的规范族。

原始标签 **2501** 个，参与归并 141 个（出现 ≥2 次者），归并为 **46** 个规范族。

| 规范新族 | 涉及帖数 | 归并的同义标签 | 说明 |
|---|---|---|---|
| `windows-path-truncation` | 39 | `native-picker-path-truncation`(8)<br>`native-picker-utf16-truncation`(9)<br>`windows-native-picker-utf16-truncation`(3)<br>`windows-path-truncation`(6)<br>`native-path-truncation`(5)<br>`win32-path-truncation`(3)<br>`windows-cjk-path-truncation`(2)<br>`native-picker-cjk-truncation`(3) | Path string truncation issues in native or Windows-specific pickers and path handling. |
| `sandbox-security-issues` | 25 | `sandbox-permission-escalation`(2)<br>`sandbox-escape`(3)<br>`sandbox-escalation-logic`(2)<br>`sandbox-bypass`(2)<br>`sandbox-escalation-loop`(2)<br>`sandbox-permission-loop`(2)<br>`sandbox-permission-idempotency`(2)<br>`sandbox-permission-validation`(3)<br>`sandbox-permission-escalation-bug`(3)<br>`sandbox-permission-logic`(2)<br>`sandbox-escalation-same-mode`(2) | Security vulnerabilities and logic errors related to sandbox permission escalation, bypass, and validation. |
| `ui-rendering-bugs` | 23 | `ui-stats-truncation`(2)<br>`rtl-rendering`(2)<br>`markdown-strikethrough-misparse`(2)<br>`markdown-rendering-bug`(2)<br>`math-rendering-failure`(2)<br>`math-rendering-bug`(2)<br>`markdown-math-rendering`(2)<br>`composer-ime`(3)<br>`ui-flicker`(2)<br>`ui-overlap`(2)<br>`ui-layout-scroll`(2) | Visual rendering bugs including layout, flickering, IME, and markdown/math display issues. |
| `subagent-model-issues` | 20 | `subagent-model-inheritance`(14)<br>`subagent-model-override`(2)<br>`subagent-model-stale`(2)<br>`subagent-error-propagation`(2) | Problems with subagent model configuration, inheritance, state staleness, and error handling. |
| `tool-execution-crash` | 16 | `subprocess-spill-crash`(2)<br>`plugin-install-crash`(2)<br>`composer-ui-crash`(2)<br>`composer-render-crash`(2)<br>`tool-execution-crash`(4)<br>`native-addon-crash`(2)<br>`tool-dispatch-crash`(2) | Application crashes occurring during tool execution, plugin installation, or native addon loading. |
| `tool-call-issues` | 16 | `tool-runtime-symbol-mismatch`(3)<br>`tool-call-module-duplication`(5)<br>`tool-call-empty-string-overwrite`(2)<br>`tool-call-id-collision`(2)<br>`tool-symbol-mismatch`(2)<br>`tool-runtime-init-failure`(2) | Issues with tool call identification, module duplication, runtime initialization, and symbol mismatches. |
| `tool-schema-validation` | 15 | `hook-config-validation`(2)<br>`tool-call-validation-error`(3)<br>`tool-schema-serialization`(2)<br>`tool-schema-mismatch`(2)<br>`tool-schema-validation`(2)<br>`mcp-schema-validation`(2)<br>`tool-desc-template-conflict`(2) | Errors related to tool schema definition, validation, serialization, and configuration. |
| `web-security-vulnerabilities` | 14 | `web-origin-restriction`(2)<br>`security-vulnerabilities`(2)<br>`security-vulnerability`(2)<br>`ssrf-vulnerability`(2)<br>`security-path-traversal`(2)<br>`ssrf-fake-ip-block`(2)<br>`web-fetch-fake-ip-block`(2) | Security vulnerabilities including SSRF, path traversal, and origin restriction failures. |
| `llm-reasoning-issues` | 11 | `llm-retry-misclassification`(3)<br>`auth-error-misclassification`(2)<br>`llm-role-incompatibility`(2)<br>`reasoning-only-empty-response`(2)<br>`reasoning-loop`(2) | Errors in LLM reasoning, retry logic, role compatibility, and response generation. |
| `windows-path-encoding` | 10 | `native-path-encoding`(6)<br>`windows-path-encoding`(4) | Character encoding problems when handling file paths on Windows or native systems. |
| `ui-state-sync` | 10 | `settings-race-condition`(3)<br>`task-status-sync`(3)<br>`task-state-sync`(2)<br>`ui-state-stale`(2) | Synchronization issues between UI state, settings, and task status. |
| `web-memory-leak` | 9 | `web-memory-leak`(3)<br>`sdk-memory-leak`(4)<br>`preset-memory-leak`(2) | Memory leaks occurring in web contexts, SDKs, or presets. |
| `plugin-issues` | 9 | `plugin-hot-reload-failure`(2)<br>`plugin-event-ignorable`(3)<br>`plugin-rpc-injection-failure`(2)<br>`plugin-module-duplication`(2) | Issues with plugin loading, hot reloading, RPC injection, and module duplication. |
| `windows-subprocess-issues` | 8 | `windows-subprocess-support`(2)<br>`windows-subprocess-popup`(2)<br>`windows-subprocess-console-flash`(2)<br>`windows-subprocess-flash`(2) | Issues with Windows subprocess execution, including console flashing and popup behavior. |
| `web-ui-perf-bugs` | 7 | `web-startup-perf`(3)<br>`web-ui-scroll-perf`(2)<br>`web-ui-layout-bug`(2) | Performance and layout bugs specific to the web user interface. |
| `windows-dialog-crash` | 6 | `windows-dialog-focus`(2)<br>`windows-dialog-worker-crash`(2)<br>`windows-folder-picker-crash`(2) | Crashes or focus issues related to Windows native dialogs and pickers. |
| `workspace-path-issues` | 6 | `workspace-path-validation`(2)<br>`workspace-cwd-mismatch`(2)<br>`workspace-path-resolution`(2) | Problems with workspace path validation, current working directory mismatches, and resolution. |
| `dependency-issues` | 6 | `npm-dependency-missing`(2)<br>`node-version-incompatibility`(2)<br>`dependency-version-pinning`(2) | Problems with missing dependencies, Node version incompatibility, and version pinning. |
| `session-state-errors` | 6 | `acp-session-load-missing`(2)<br>`session-race-condition`(2)<br>`session-format-validation-error`(2) | Issues related to loading, validating, or managing session state integrity. |
| `desktop-environment-issues` | 6 | `desktop-clipboard-shortcuts`(2)<br>`desktop-build-failure`(2)<br>`desktop-protocol-404`(2) | Problems specific to the desktop application environment, build, or protocol handling. |
| `macos-security-entitlements` | 6 | `macos-entitlement-missing`(4)<br>`sandbox-integrity-label`(2) | macOS-specific security issues regarding missing entitlements or sandbox labels. |
| `sdk-session-issues` | 5 | `sdk-session-resume-failure`(3)<br>`session-logging-integrity`(2) | Issues with SDK session resumption and logging data integrity. |
| `ui-selection-failure` | 4 | `ui-workspace-selection-failure`(2)<br>`workspace-selection-failure`(2) | Failures in selecting or managing workspace items in the UI. |
| `web-auth-issues` | 4 | `web-auth-missing`(2)<br>`web-http-secure-context`(2) | Authentication failures and secure context issues in web environments. |
| `provider-catalog-stale` | 4 | `model-catalog-stale`(2)<br>`provider-catalog-stale`(2) | Stale data in model or provider catalogs. |
| `data-loss-and-integrity` | 4 | `tool-truncation-data-loss`(2)<br>`settings-import-data-loss`(2) | Incidents where user data is truncated, lost, or corrupted during operations. |
| `ui-and-rendering-regressions` | 4 | `markdown-rendering`(2)<br>`ui-regression`(2) | Visual or rendering defects affecting the user interface or content display. |
| `plugin-and-module-errors` | 4 | `plugin-update-failure`(2)<br>`module-duplication-symbol-mismatch`(2) | Failures in plugin updates or module loading due to symbol conflicts. |
| `transport-and-proxy-failures` | 4 | `transport-failure`(2)<br>`proxy-redirect-failure`(2) | Network transport issues or failures in proxy redirection logic. |
| `electron-environment-leak` | 4 | `electron-env-leak`(4) | Resource or environment variable leaks within the Electron runtime. |

> 上表只列出现 ≥3 帖的规范族；完整归并结果见 `_tools/new-family-canonical.json`。

**这些新族是下一轮分类表应当补入的候选**——它们说明现有 20 个族存在覆盖盲区。

---

## 五、LLM 判定的 critical / high 问题清单

共 **2550** 篇。

| # | 严重度 | 主族 | 标题 | LLM 判定的根因 |
|---|---|---|---|---|
| [#8511](https://github.com/deepseek-ai/deepseek-harness/discussions/8511) | critical | 其它（非问题类或未归类） | 纯问答请求触发越界读取与工作区落盘 | Agent violates sandbox policy by reading outside workspace and writing files without user approval. |
| [#8465](https://github.com/deepseek-ai/deepseek-harness/discussions/8465) | critical | 畸形 tool-call 致会话不可恢复 | [Bug]内容风控拒答会让会话永久不可用，且 DSH 没有任何恢复途径 | Content moderation rejection causes session corruption or permanent unavailability without recovery  |
| [#8330](https://github.com/deepseek-ai/deepseek-harness/discussions/8330) | critical | dsh web 进程静默死亡 | Uncaught ENOENT in OutputCollector.spillAll kills the dsh web server; spill root | Uncaught ENOENT exception in OutputCollector.spillAll crashes the server when temp files are deleted |
| [#8195](https://github.com/deepseek-ai/deepseek-harness/discussions/8195) | critical | 其它（非问题类或未归类） | # [Windows] 自更新会删除位于安装目录内的工作区，随后静默重建为空目录（被掩盖的数据丢失） | NSIS installer deletes non-payload files in installation directory during update, causing data loss. |
| [#8171](https://github.com/deepseek-ai/deepseek-harness/discussions/8171) | critical | 会话日志损坏（seq gap/并发写） | Session persistence layer is not isolated between sessions - one session's file  | Shared session persistence layer lacks isolation, allowing one session's corruption to break another |
| [#8084](https://github.com/deepseek-ai/deepseek-harness/discussions/8084) | critical | 会话日志损坏（seq gap/并发写） | Session corrupt: seed assistant/message at index 4002 has invalid settlement fie | Session log data corruption causing invalid settlement fields in stored messages. |
| [#7944](https://github.com/deepseek-ai/deepseek-harness/discussions/7944) | critical | 畸形 tool-call 致会话不可恢复 | [Bug] V4 写侧 admission 不校验 tool-call 的 id/name：会话或永久打不开、或每次请求 400（0.1.7-rc.2 桌面端， | Write-side admission validation fails to check tool-call id/name, allowing creation of unreadable se |
| [#7921](https://github.com/deepseek-ai/deepseek-harness/discussions/7921) | critical | 会话格式迁移失败 | [Bug] Data dir re-initialized during 0.1.7-rc.1 → rc.2 upgrade (Windows): all se | Upgrade helper failed to preserve data and re-initialized data directory despite claiming non-destru |
| [#7784](https://github.com/deepseek-ai/deepseek-harness/discussions/7784) | critical | 其它（非问题类或未归类） | 建议为pwsh的移动/删除文件操作增加路径校验，防止目标路径解析错误 | Tool lacks path validation and error handling for PowerShell variable conflicts, leading to accident |
| [#7726](https://github.com/deepseek-ai/deepseek-harness/discussions/7726) | critical | 其它（非问题类或未归类） | [Security] Supplement to GHSA-vp88-72xg-3579: events.mux also broadcasts the ful | Security vulnerability in events.mux broadcasting full session content and unbound lookup in respond |
| [#7722](https://github.com/deepseek-ai/deepseek-harness/discussions/7722) | critical | 其它（非问题类或未归类） | [Security] Cross-session terminal hijack: the terminal namespace resolves purely | Missing authorization checks in terminal controller allow cross-session hijacking. |
| [#7661](https://github.com/deepseek-ai/deepseek-harness/discussions/7661) | critical | 其它（非问题类或未归类） | 安全隐患反馈 | Sandbox permission enforcement failed, allowing file writes outside the designated workspace directo |
| [#7637](https://github.com/deepseek-ai/deepseek-harness/discussions/7637) | critical | 升级后历史会话无法加载 | # [Bug] Sidebar history sessions and workspaces completely lost, and current ses | Session data corruption or migration failure causing complete loss of sidebar history and workspace  |
| [#7623](https://github.com/deepseek-ai/deepseek-harness/discussions/7623) | critical | 其它（非问题类或未归类） | /plugins/* carrier 路由未做请求信任校验，伪造 Host 即可读取完整插件图（附带定位，细节待私密渠道补充） | Missing Host header validation and authentication on internal plugin routes allowing unauthorized da |
| [#7613](https://github.com/deepseek-ai/deepseek-harness/discussions/7613) | critical | 其它（非问题类或未归类） | mermaid securityLevel:'strict' does not stop off-origin image requests from fenc | Mermaid strict security level fails to block off-origin image requests in HTML labels. |
| [#7517](https://github.com/deepseek-ai/deepseek-harness/discussions/7517) | critical | Windows 沙箱/TLS/代理 | [BUG] Workspace-write 沙箱缺陷：受限进程可通过工作区内的目录 Junction 删除工作区外文件 | Sandbox ACL logic allows DELETE via junctions due to inconsistent permission checks between write an |
| [#7467](https://github.com/deepseek-ai/deepseek-harness/discussions/7467) | critical | 其它（非问题类或未归类） | 完全权限模式下清空自己清空了c盘里不影响开机的部分 | User reports accidental data loss via AI instruction, not a known software defect. |
| [#7387](https://github.com/deepseek-ai/deepseek-harness/discussions/7387) | critical | 会话日志损坏（seq gap/并发写） | Bug: SessionPersistence.prepare() commits crash repair that can corrupt an activ | Race condition in SessionPersistence.prepare causes seq overlap between recovered events and synthet |
| [#7370](https://github.com/deepseek-ai/deepseek-harness/discussions/7370) | critical | 畸形 tool-call 致会话不可恢复 | Scheduler failure leaves unpaired assistant tool-call blocks, making the session | Scheduler failure leaves unpaired tool-call blocks, causing serialization failure and session corrup |
| [#7298](https://github.com/deepseek-ai/deepseek-harness/discussions/7298) | critical | Windows 沙箱/TLS/代理 | [0.1.5-rc.2]: 在某一次对话中，dsh向我汇报了工作区外目录误删的事故，想问一下是bug还是操作问题 | Sandbox ACL failed to intercept symbolic link escape to workspace-external directories. |
| [#7271](https://github.com/deepseek-ai/deepseek-harness/discussions/7271) | critical | 其它（非问题类或未归类） | [Bug] CDP doesn't need authorization to access, while /injest need authorization | Missing authorization check on CDP endpoint allows unauthorized session access. |
| [#7230](https://github.com/deepseek-ai/deepseek-harness/discussions/7230) | critical | 其它（非问题类或未归类） | [Bug] Agent rebuilds user-owned files from stale backups, silently discarding ma | Agent overwrites user-edited files using stale backups without conflict detection or user confirmati |
| [#7207](https://github.com/deepseek-ai/deepseek-harness/discussions/7207) | critical | 其它（非问题类或未归类） | [security] bwrap sandbox can be bypassed by accessing X11 socket or dbus | bwrap sandbox configuration lacks network isolation and file permission restrictions, allowing escap |
| [#7188](https://github.com/deepseek-ai/deepseek-harness/discussions/7188) | critical | 其它（非问题类或未归类） | [Safety] Agent cleanup killed unrelated user Edge processes instead of only task | Agent cleanup logic incorrectly targets and kills unrelated user processes instead of only task-owne |
| [#6964](https://github.com/deepseek-ai/deepseek-harness/discussions/6964) | critical | 其它（非问题类或未归类） | [Bug] claimed 的输入在 prepareRequest 抛错时会永久丢失：本机 154 份存档里 14 例 | User message is lost when prepareRequest fails after inbox claim but before session append. |
| [#6928](https://github.com/deepseek-ai/deepseek-harness/discussions/6928) | critical | 上下文压缩失效 | Official compaction checkpoint: the loader and the writer disagree on the shadow | Disagreement between compaction writer and session loader on shadowed node ranges causes permanent l |
| [#6892](https://github.com/deepseek-ai/deepseek-harness/discussions/6892) | critical | 其它（非问题类或未归类） | [Bug] 0.1.6-alpha.1 升级后所有会话无法创建/恢复：profile 内 dsh-scope 双副本导致 scope 身份失配 | Duplicate dsh-scope module instances cause scope identity mismatch, blocking session creation and re |
| [#6833](https://github.com/deepseek-ai/deepseek-harness/discussions/6833) | critical | 畸形 tool-call 致会话不可恢复 | A settled background subagent poisons the session: its `reasoning` block is copi | Background subagent notice incorrectly includes reasoning block in user message, causing serializati |
| [#6562](https://github.com/deepseek-ai/deepseek-harness/discussions/6562) | critical | 会话日志损坏（seq gap/并发写） | Session rows after a seq gap are silently dropped — only surfaces if a turn/end  | Session loader silently truncates history on sequence gaps without error, causing data loss. |
| [#6493](https://github.com/deepseek-ai/deepseek-harness/discussions/6493) | critical | 会话格式迁移失败 | [Bug] Session format migration (v0→v3) is non-atomic: stopping the process betwe | Non-atomic migration process allows data loss if interrupted between truncation and write. |
| [#6465](https://github.com/deepseek-ai/deepseek-harness/discussions/6465) | critical | 其它（非问题类或未归类） | [Security] agent经宿主路由以无审批方式启动本地应用  Agent Launching Local Applications Without Ap | Agent bypasses sandbox by reading plaintext credentials to forge valid browser cookies for host API  |
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
