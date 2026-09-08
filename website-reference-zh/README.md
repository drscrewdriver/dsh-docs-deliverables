# DeepSeek Harness · 中文 Reference 页面索引

> **来源**: [deepseek-harness.github.io/reference/](https://deepseek-harness.github.io/deepseek-harness/reference/)
> **内容**: 所有 `.md` 文件位于 [`official-repo/docs/`](../official-repo/docs/) 中，该目录是**唯一真实来源**。

## 页面概览

**66 个页面**，分为 6 个板块。`official-repo/docs/` 目录是内容的唯一来源 — 本 README 仅做 URL 与文档路径的映射。

| # | 板块 | 页面数 | 文档前缀 |
|---|------|--------|----------|
| 1 | 概念 | 6 | `docs/` (根目录) |
| 2 | 生成参考 | 3 | `docs/` (根目录) |
| 3 | Cordis Core API | 6 | `docs/cordis-api/` |
| 4 | 开发手册 | 5 | `docs/cookbook/` |
| 5 | 子系统 | 45 | `docs/subsystems/` (含 README.md 为索引) |
| | **合计** | **66** | |

## 映射速查

| 网站 URL 模式 | → 文档文件 |
|---------------|-----------|
| `/reference/` | `architecture.zh.md` |
| `/reference/{name}` | `{name}.zh.md` |
| `/reference/cordis-api/{name}` | `cordis-api/{name}.zh.md` |
| `/reference/cookbook/{name}` | `cookbook/{name}.zh.md` |
| `/reference/subsystems/` | `subsystems/README.zh.md` |
| `/reference/subsystems/{name}` | `subsystems/{name}.zh.md` |

> 部分页面（如 `cordis-api/inherited`）官方仅英文版，中文站点回退使用英文内容 (`inherited.md`)。

## 板块详情

<details>
<summary>概念 (6 页)</summary>

| 页面 | 文档 |
|------|------|
| 架构 | `architecture.zh.md` |
| Cordis 入门 | `cordis-primer.zh.md` |
| 能力服务 | `capability-seams.zh.md` |
| Agent 生命周期 | `agent-lifecycle.zh.md` |
| Tool 执行 | `tool-execution-pipeline.zh.md` |
| API Gateway | `api-gateway.zh.md` |

</details>

<details>
<summary>生成参考 (3 页)</summary>

| 页面 | 文档 |
|------|------|
| 插件配置 | `config-catalog.zh.md` |
| Tool Schema | `tool-catalog.zh.md` |
| 持久化事件 | `persistence-catalog.zh.md` |

</details>

<details>
<summary>Cordis API (6 页)</summary>

| 页面 | 文档 |
|------|------|
| Context | `cordis-api/context.zh.md` |
| Events | `cordis-api/events.zh.md` |
| Fiber | `cordis-api/fiber.zh.md` |
| Plugin Registry | `cordis-api/registry.zh.md` |
| Service | `cordis-api/service.zh.md` |
| 继承接口面 | `cordis-api/inherited.md` ⚠️ |

</details>

<details>
<summary>开发手册 (5 页)</summary>

| 页面 | 文档 |
|------|------|
| 新增 Package | `cookbook/adding-a-package.zh.md` |
| 新增 Tool | `cookbook/adding-a-tool.zh.md` |
| 新增 LLM Adapter | `cookbook/adding-an-llm-adapter.zh.md` |
| 新增设置卡片 | `cookbook/adding-a-settings-card.zh.md` |
| 扩展模式 | `cookbook/extension-cookbook.zh.md` |

</details>

<details>
<summary>子系统 (45 页)</summary>

**索引**: `subsystems/README.zh.md`

| 分类 | 页面 |
|------|------|
| 内核与作用域 | `core`, `scope`, `invariants` |
| 会话与持久化 | `session`, `session-query`, `session-reference`, `session-title`, `session-projection`, `persistence`, `spill`, `session-telemetry` |
| 模型与上下文 | `llm-streaming`, `token-meter`, `system-prompt`, `compaction` |
| 执行与工具 | `tools`, `shell`, `subprocess`, `terminal`, `jobs`, `filesystem`, `lsp`, `code-runtime`, `web`, `skills`, `workflow`, `subagent` |
| 策略与交互 | `approval`, `permission-presets`, `sandbox`, `plan`, `user-questions`, `commands`, `goal`, `schedule` |
| 平台与接入 | `web-server`, `web-client`, `client-modules`, `slots`, `conversation`, `typert`, `storage`, `workspace`, `settings`, `credentials` |

</details>

## 说明

- **内容位置**: 所有 Markdown 内容均在 `official-repo/docs/` 中，本目录不存储重复文件。
- **GitHub 源文件**: 各页面 frontmatter 的 `editSource` 指向 `https://github.com/deepseek-ai/DeepSeek-Harness/edit/master/docs/{路径}`。
- **VitePress 哈希图**: 站点页面通过 `window.__VP_HASH_MAP__` 索引（查看部署站点源码）。
