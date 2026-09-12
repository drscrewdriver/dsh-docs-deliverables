# Developer Role Incompatibility — Discussion Issues

> 来源: GitHub Discussions #5008 及相似帖子，共 29 篇去重帖子（局域网API复核家族）
> 归属: `packages/llm/llm-pi-ai` — LLM 适配器角色兼容性

## 症状

在部分 LLM 网关上 agent 正常工作，在其他网关上出现角色错误或系统消息被静默丢弃。

## 根因

[pi-ai 网关插件](../../official-repo/packages/llm/llm-pi-ai) 对推理模型（DeepSeek R1、R1-Zero 等）发送 `role: 'developer'` 的系统消息。许多第三方 OpenAI 兼容网关（vLLM、SGLang、Qwen）仅识别 `role: 'system'`，会静默忽略或拒绝 `role: 'developer'`。Agent 在无系统提示上下文的情况下继续执行，产生降级或错误响应。

```ts type-equiv
/**
 * The `role` field sent in the model request. 'developer' is used by the
 * pi-ai adapter for reasoning models; standard OpenAI-compatible APIs expect
 * 'system'. Mismatches cause system prompt loss.
 */
type MessageRole = 'system' | 'user' | 'assistant' | 'tool' | 'developer'
```

## 受影响网关

- **vLLM** — 静默丢弃 `developer` 角色消息
- **SGLang** — 可能拒绝 `developer` 为未知角色
- **Qwen / 阿里云** — 丢弃 `developer` 角色消息
- **Ollama** — 丢弃 `developer` 角色消息
- **OpenAI API** — 内部忽略 `developer`（R1 模型专用）

## 官方文档参考

- **配置参考**：[`docs/config-catalog.zh.md`](../../official-repo/docs/config-catalog.zh.md) — `supportsDeveloperRole?: boolean` 字段定义（代码 wire-compat surface，2026-08-18 首次暴露）
- **配置层**：[`docs/user/guide/providers.md`](../../official-repo/docs/user/guide/providers.md) — YAML 配置示例（2026-08-19 首次出现，此前无此配置项）

> **注意**：官方文档通过 YAML 配置（`settings.yaml`）提供修复，**Web UI 中没有为开发者提供 toggle 开关**。
> 用户必须手动编辑 `~/.dsh/settings.yaml` 的路由 `compat` 节，在模型页面上没有可视化选项。

## 临时方案

1. **使用 `dsh-thinking-levels` + `dsh-llm-openai-completions`** — 这两个社区插件共同将推理模型的 `developer` 角色翻译回 `system`。pi-ai 插件作者（drscrewdriver）在讨论 #5008 中推荐此组合。
2. **替换 pi-ai 适配器** — 配置网关直接对支持模型的 `openai-completions` 适配器。

## 修复状态

根因位于 `packages/llm/llm-pi-ai/src/index.ts`。永久修复方案：添加配置选项使用 `system` 角色，或当未安装 pi-ai 插件时将 `openai-completions` 适配器设为默认。**建议 UI 层增加 supportsDeveloperRole 可视化开关，避免用户直接编辑 YAML。**

---

## Problem Types by Discussion Family

> 本系统共 1 种问题类型，覆盖 27 篇 bug 讨论

### 1. 角色映射异常 (Role Mapping)

- **帖子数**: 27 篇
- **代表帖**: #280 — [BUG] llm-pi-ai 应支持配置 compat.supportsDeveloperRole
- **受影响系统**: ark, openai, qwen, sglang, vllm, 火山
- **官方文档**: [providers.md](../../official-repo/docs/user/guide/providers.md) · [config-catalog.zh.md](../../official-repo/docs/config-catalog.zh.md)

- **相关讨论 ID**:

  #280, #472, #473, #551, #559, #564, #1232, #1498, #2007, #2023

  #2388, #2489, #2587, #2637, #2766, #2894, #3076, #3335, #3363, #3372

  #3379, #3394, #3495, #3531, #3789, #4937, #5008

---

## 官方文档更新记录

| 文档位置 | 首次包含时间 | 来源说明 |
|---|---|---|
| 配置参考·[config-catalog.zh.md](../../official-repo/docs/config-catalog.zh.md) | 2026-08-18 | fix(llm-pi-ai): expose the pi-ai wire-compat surface（代码暴露字段，此前无此字段） |
| 配置层·[providers.md](../../official-repo/docs/providers.md) | 2026-08-19 | docs(user): guide gateway request-compatibility switches（YAML 配置示例首次出现，此前无此配置项） |

---

## 增量补充 — #5886–#6442（2026-09-12）

> 本批次新增讨论中与本子系统相关的帖子。原始全量分析见 `dsh-discussion-summary/incremental-2026-09-12/增量分析报告.md`。

### 推理退化循环 / 空响应　`reasoning-loop`

- **规模**: 10 篇（正文 >500 字）

| # | 标题 | 正文 | 评论 |
|---|---|---|---|
| [#5976](https://github.com/deepseek-ai/deepseek-harness/discussions/5976) | [Bug] Agent 在超长上下文 + max reasoning effort 下陷入思考退化循环：回合零产出、无自动熔断，需手动中止（v4.1-flash；同配置 v4-flash 3 | 1594 | 13 |
| [#6059](https://github.com/deepseek-ai/deepseek-harness/discussions/6059) | [Bug] Runaway tool-call arguments consume the full output budget before validation | 4014 | 9 |
| [#6124](https://github.com/deepseek-ai/deepseek-harness/discussions/6124) | [Bug] dsh 0.1.5-rc.1 在 Node.js < 24 上完全静默失败(import.meta.main 守卫 + 未声明 engines) | 2106 | 5 |
| [#6218](https://github.com/deepseek-ai/deepseek-harness/discussions/6218) | Bug: reasoning-only completions are reported as successful - the EMPTY_RESPONSE guard tests ord | 10638 | 1 |
| [#6102](https://github.com/deepseek-ai/deepseek-harness/discussions/6102) | [Bug] dsh 0.1.2-rc.1 + V4.1：reasoning 正常但正文 content 未落地（合并后仍复现；V4-Pro 9/14 起全量路由） | 4644 | 1 |
| [#6366](https://github.com/deepseek-ai/deepseek-harness/discussions/6366) | 同一提示词四次实测：简单配置任务出现 33–50 轮「无界确认」行为（DeepSeek V4.1 + DSH） | 2266 | 1 |
| [#5971](https://github.com/deepseek-ai/deepseek-harness/discussions/5971) | 【Bug】在dsh中使用deepseek-v4.1-flash-expires-on-0910遇到的思考内容（reasoning_content）退化问题 | 670 | 1 |
| [#6431](https://github.com/deepseek-ai/deepseek-harness/discussions/6431) | A reasoning-only turn is reported as `completed`: no answer, no tool call, and the raw reasonin | 7058 | 0 |
| [#5974](https://github.com/deepseek-ai/deepseek-harness/discussions/5974) | 内测模型 deepseek-v4.1-flash-expires-on-0910 推理循环与输出退化 | 2305 | 0 |
| [#5975](https://github.com/deepseek-ai/deepseek-harness/discussions/5975) | [Bug] 内测模型 deepseek-v4.1-flash-expires-on-0910 reasoning 陷入"写/好/执行"无限重复 | 1596 | 0 |

### npm 安装/构建失败　`npm-install-build`

- **规模**: 22 篇（正文 >500 字）

| # | 标题 | 正文 | 评论 |
|---|---|---|---|
| [#5926](https://github.com/deepseek-ai/deepseek-harness/discussions/5926) | [Bug] connection fails to start when a third-party plugin registers an HTTP channel: cannot get | 2761 | 6 |
| [#5929](https://github.com/deepseek-ai/deepseek-harness/discussions/5929) | 0.1.3.Alpha.2，引入了 fs-ext@2.1.1 无预编译二进制，强制本地 MSVC 编译 | 1679 | 6 |
| [#6124](https://github.com/deepseek-ai/deepseek-harness/discussions/6124) | [Bug] dsh 0.1.5-rc.1 在 Node.js < 24 上完全静默失败(import.meta.main 守卫 + 未声明 engines) | 2106 | 5 |
| [#6115](https://github.com/deepseek-ai/deepseek-harness/discussions/6115) | npx 启动不成功程序直接退出 `@deepseek-ai/dsh` (published package) silently exits with code 0 on Node < 24. | 4425 | 3 |
| [#6372](https://github.com/deepseek-ai/deepseek-harness/discussions/6372) | [Bug] 0.1.5-rc.2 桌面端 prepare:dsh 必然失败：payload smoke 断言已被移除的 fs-ext，无法产出 resources/dsh | 3919 | 3 |
| [#6082](https://github.com/deepseek-ai/deepseek-harness/discussions/6082) | [Bug] 0.1.5-alpha.2: published dsh-client-store omits Zustand/Immer runtime dependencies | 2520 | 3 |
| [#5949](https://github.com/deepseek-ai/deepseek-harness/discussions/5949) | @deepseek-ai/dsh@0.1.3-alpha.2 cannot be installed without a C++ toolchain: new hard dependency | 2705 | 2 |
| [#5988](https://github.com/deepseek-ai/deepseek-harness/discussions/5988) | [dsh-v0.1.5-alpha.1] `pnpm install` 缺少 transitive dep `unrun`，`pnpm run build` 失败 | 1432 | 2 |
| [#6201](https://github.com/deepseek-ai/deepseek-harness/discussions/6201) | [Bug] dsh web 0.1.5-rc.1: silent process death (0xC0000409) loses in-flight turns - 12 deaths / | 19075 | 1 |
| [#6272](https://github.com/deepseek-ai/deepseek-harness/discussions/6272) | [Bug] 桌面打包 prepare:dsh 必然失败：烟雾测试仍在 require 已被替换的 fs-ext | 4120 | 1 |
| [#6355](https://github.com/deepseek-ai/deepseek-harness/discussions/6355) | v0→v3 session migration refuses legacy plugin-injected message sources (history fails to load a | 2141 | 1 |
| [#5969](https://github.com/deepseek-ai/deepseek-harness/discussions/5969) | pnpm install fails: dsh monolith dependency ranges cannot select published prerelease siblings  | 2022 | 1 |

其余：#5927, #6225, #6441, #6232, #6148, #6003, #6043, #6247, #5945, #6341
