# DeepSeek Harness · English Reference Index

> **Source**: [deepseek-harness.github.io/en/reference/](https://deepseek-harness.github.io/deepseek-harness/en/reference/)
> **Content**: all `.md` files live in [`official-repo/docs/`](../official-repo/docs/)

## Pages at a Glance

**66 pages** across 6 sections. The `official-repo/docs/` directory is the **single source of truth** — this README only maps website URLs to doc paths.

| # | Section | Pages | Doc Prefix |
|---|---------|-------|------------|
| 1 | Concepts | 6 | `docs/` (root) |
| 2 | Generated Reference | 3 | `docs/` (root) |
| 3 | Cordis Core API | 6 | `docs/cordis-api/` |
| 4 | Cookbook | 5 | `docs/cookbook/` |
| 5 | Subsystems | 45 | `docs/subsystems/` (incl. README.md as index) |
| | **Total** | **66** | |

## Mapping Cheat Sheet

| Website URL Pattern | → Doc File |
|---------------------|------------|
| `/en/reference/` | `architecture.md` |
| `/en/reference/{name}` | `{name}.md` |
| `/en/reference/cordis-api/{name}` | `cordis-api/{name}.md` |
| `/en/reference/cookbook/{name}` | `cookbook/{name}.md` |
| `/en/reference/subsystems/` | `subsystems/README.md` |
| `/en/reference/subsystems/{name}` | `subsystems/{name}.md` |

## Section Detail

<details>
<summary>Concepts (6 pages)</summary>

| Page | Doc |
|------|-----|
| Architecture | `architecture.md` |
| Cordis Primer | `cordis-primer.md` |
| Capability Services | `capability-seams.md` |
| Agent Lifecycle | `agent-lifecycle.md` |
| Tool Execution | `tool-execution-pipeline.md` |
| API Gateway | `api-gateway.md` |

</details>

<details>
<summary>Generated Reference (3 pages)</summary>

| Page | Doc |
|------|-----|
| Plugin Configuration | `config-catalog.md` |
| Tool Schemas | `tool-catalog.md` |
| Persistence Events | `persistence-catalog.md` |

</details>

<details>
<summary>Cordis Core API (6 pages)</summary>

| Page | Doc |
|------|-----|
| Context | `cordis-api/context.md` |
| Events | `cordis-api/events.md` |
| Fiber | `cordis-api/fiber.md` |
| Plugin Registry | `cordis-api/registry.md` |
| Service | `cordis-api/service.md` |
| Inherited Surface | `cordis-api/inherited.md` |

</details>

<details>
<summary>Cookbook (5 pages)</summary>

| Page | Doc |
|------|-----|
| Adding a Package | `cookbook/adding-a-package.md` |
| Adding a Tool | `cookbook/adding-a-tool.md` |
| Adding an LLM Adapter | `cookbook/adding-an-llm-adapter.md` |
| Adding a Settings Card | `cookbook/adding-a-settings-card.md` |
| Extension Patterns | `cookbook/extension-cookbook.md` |

</details>

<details>
<summary>Subsystems (45 pages)</summary>

**Index**: `subsystems/README.md`

| Category | Pages |
|----------|-------|
| Core & Scopes | `core`, `scope`, `invariants` |
| Sessions & Persistence | `session`, `session-query`, `session-reference`, `session-title`, `session-projection`, `persistence`, `spill`, `session-telemetry` |
| Model & Context | `llm-streaming`, `token-meter`, `system-prompt`, `compaction` |
| Execution & Tools | `tools`, `shell`, `subprocess`, `terminal`, `jobs`, `filesystem`, `lsp`, `code-runtime`, `web`, `skills`, `workflow`, `subagent` |
| Policy & Interaction | `approval`, `permission-presets`, `sandbox`, `plan`, `user-questions`, `commands`, `goal`, `schedule` |
| Platform & Access | `web-server`, `web-client`, `client-modules`, `slots`, `conversation`, `typert`, `storage`, `workspace`, `settings`, `credentials` |

</details>

## Notes

- **Content location**: All markdown content is in `official-repo/docs/`. No `.md` files are stored in this folder.
- **GitHub source**: Each page's `editSource` frontmatter points to `https://github.com/deepseek-ai/DeepSeek-Harness/edit/master/docs/{path}`.
- **VitePress hash map**: Site pages are indexed in `window.__VP_HASH_MAP__` (view source on the deployed site).
