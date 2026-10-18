# diff-vs-0.2.1-rc.1：v0.2.1-rc.1 → v0.2.1-rc.2 逐主题证据

> 区间：`1600d8a1e1` → `687f282e86`；456 files changed, +4921 / −845；9 commits（5 非 merge：`fda98dadd2`/`3c937cd0ba`/`7d844abc87`/`32efe36a4e`/`d1b9c04067`）。
> 完整清单：`git log --no-merges dsh-v0.2.1-rc.1..dsh-v0.2.1-rc.2`。

## §1 DeepSeek Search / Fetch API（`fda98dadd2`，PR #6103）

- 新包 `packages/web/web-deepseek-api`（package.json 于本区间 `A`）。
- `docs/capability-seams.md` 生成区：`ctx.web` 行 providers 列表插入 `web-deepseek-api`（位于 `web-search-deepseek` 与 `web-fetch-http` 之间）；新增 mermaid 节点 `pkg_web_deepseek_api --> svc_web`。**无新增/删除缝**——走既有缝 provider 注册模式。
- `tool-web` 消费边未变（模型侧稳定工具名不变）。
- 持久化承认 `docs/persistence-changes/2026-10-13-deepseek-search-thinking.{md,zh.md,i18n.yaml,schema.json}`（4 文件；schema 231 行；同版本加性，decision 同前口径）。
- 挂载方式：settings 开关后（默认关），非 profile 结构变化。

## §2 1017 徽章与槽竞争（`7d844abc87`→`32efe36a4e`→`3c937cd0ba`）

- 路线演化：先在 bundled 显示名追加 `1017`（`7d844abc87`）→ revert 恢复原名（`32efe36a4e`）→ 改独立组件包 `packages/client/ui-deepseek-model-label-1017`（`3c937cd0ba`，merge #6417）。
- `slot-catalog.ts`（`packages/extensions/cordis-client-runner/src/client/slot-catalog.ts`）±6：`conversation.input.model.label` 的 `occupants: [] → ['client-ui-deepseek-model-label-1017 DeepSeekModelLabel']`；`replaceRisk: 'none' → 'shadows-shipped-ui'`。**无槽增删**。
- 意义：验证 a.5（`919aa5f400`）预留的 provider-aware 模型标签槽即刻被官方用作注入点——第三方插件同槽注入的遮蔽语义自此有官方先例可对照。

## §3 零断裂面清单（逐项核过）

| 面 | 检查方式 | 结果 |
|---|---|---|
| 闸门 | `git diff --stat rc.1 rc.2 -- plugin-compatibility.ts compatibility-preflight.ts profile-compatibility.ts` | 零 diff |
| settings 核心 | `packages/settings/settings/src/**` | 零 diff（本区间该目录无 src 文件） |
| vendor | `vendor/cordis|schemastery/package.json` | 零 diff（停 rc.1 正式线） |
| `SESSION_FORMAT_VERSION` | `packages/core/session/src/types.ts` | 零 diff（恒 4） |
| 升级指南 | `docs/upgrade-guide` | 无新增（0 篇） |
| 客户端具名符号 | 六符号 rc.2 全仓 grep | `projectUserText`/`RenderMessageImages`/`OperatorPeer`/`TURN_PROCESS_INDEPENDENT_KINDS`/`TerminalAttachmentId`=0；`WorkspaceTypertGenerator`=12（index 仍再导出，勘误口径延续） |
| 探针矩阵 | 13 列 `git grep -l` | rc.1↔rc.2 逐项全等 |

## §4 文件分布与实现扩散

`packages/client`=92 / `packages/experimental`=47 / `packages/web`=35 / `packages/session`=21 / `packages/util`=18 / `packages/api`=10 / `packages/shell`=10 / `apps/web`=10 / `packages/subagent`=9 / `packages/host`=9 / `packages/llm`=9 / `packages/bundle`=8 / `packages/core`=8 / `docs/persistence-changes`=7。
扩散主体为 §1 实现族及其测试/snapshot 刷新；`packages/experimental` 47 文件未见包增删改名（目录内实现跟进），无插件契约面。
