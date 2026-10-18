# DSH v0.2.1-rc.2 CHANGELOG（dsh-v0.2.1-rc.1 → dsh-v0.2.1-rc.2）

> 9 commits（5 非 merge + 4 merge）｜ 2026-10-16 ｜ 发布 PR #6408（merge `687f282e86`，release 提交 `d1b9c04067`）
> 标记：⭐ 新能力面 ｜ ⚠️ 行为变化 ｜ 🔌 插件可见 ｜ 📋 有官方升级指南（本版 **0 篇**）
> 结构：**2 新增包 / 0 删除 / 0 改名**；`SESSION_FORMAT_VERSION` 保持 4，新增 **1 条同版本加性承认**；闸门 / settings 核心 / vendor / slot 结构零 diff

## Packages（结构变化）

- ➕ `packages/web/web-deepseek-api` —— DeepSeek Search / Fetch API provider，注册进既有 `ctx.web` 缝（`fda98dadd2`，PR #6103）
- ➕ `packages/client/ui-deepseek-model-label-1017` —— DeepSeek Flash「1017」临时标签组件，占槽 `conversation.input.model.label`（`3c937cd0ba`）

## Features

- ⭐ 🔌 **feat(web): DeepSeek Search and Fetch APIs behind a settings switch**（`fda98dadd2`，PR #6103）
  `ctx.web` 缝 provider 列表 +`web-deepseek-api`（与 exa/perplexity/web-search-deepseek/fetch-http 并列）；`tool-web` 模型侧稳定工具名不变；能力整族藏于 settings 开关后。持久化承认 `2026-10-13-deepseek-search-thinking`（同版本加性，搜索推理入会话日志，4 文件 ×3 语言 + schema）。
- ⭐ 🔌 **feat(web): display a temporary 1017 badge for DeepSeek Flash**（`3c937cd0ba`；前案 `7d844abc87` 改 bundled 显示名 → `32efe36a4e` revert）
  独立 client 包 `ui-deepseek-model-label-1017`（`DeepSeekModelLabel`）取代"改名方案"；slot-catalog 中 `conversation.input.model.label` 的 `occupants []→[官方徽章]`、`replaceRisk none→shadows-shipped-ui`——a.5 预留槽的第一个官方消费者。

## Behavior Changes（⚠️ 非 API breaking）

- ⚠️ bundled DeepSeek Flash **显示名回正**（revert `32efe36a4e` 恢复原名）——此前 1~2 天窗口内"追加 1017 后缀"的方案未随 rc 分发面生效即撤回。

## Docs / 工程面

- `docs/capability-seams.md`：`ctx.web` providers +1（无新缝）。
- `docs/persistence-changes/`：+1 承认（deepseek-search-thinking）；`historical-formats/README` 微调。
- 文件分布（top dirs）：`packages/client` 92 / `packages/experimental` 47 / `packages/web` 35 / `packages/session` 21 / `packages/util` 18（实现 + 测试 + snapshot 扩散，无契约面）。

## 探针复核（rc.1 ↔ rc.2）

13 列逐项全等：`iss=0 / inst=3(噪声) / scope=0 / cf=78 / vol=1 / gate=10 / dpc=2 / card=1 / rowcfg=11 / detail=9 / allowver=9 / loc=12 / snap=261`；闸门文件、settings src、vendor 版本、`core/session/src/types.ts` 零 diff。
