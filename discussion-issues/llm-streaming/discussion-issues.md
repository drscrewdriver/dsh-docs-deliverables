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
