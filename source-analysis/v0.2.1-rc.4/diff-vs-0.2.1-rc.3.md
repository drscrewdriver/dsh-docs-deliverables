# diff-vs-0.2.1-rc.3 — 逐主题差异明细

> 基准：`dsh-v0.2.1-rc.3`（`1f81c047fc`）→ `dsh-v0.2.1-rc.4`（`504a01a957`）。369 files +596/−381，其中 349 个仅 package.json 版本行（**逐行核验无非版本改动**），实质文件 20 个。
> 变更热度分布（实质 20 文件）：packages/client/ui-conversation 6 / packages/llm/llm-deepseek-account 5 / packages/mcp 8（mcp-client 5 + mcp-resources 3）/ apps/cli 1；含 4 包 README 三语文案 12 文件。

## 1. View 页签/More 按钮 tooltip 精化（#7183 `72624bae95`+`c38265a00e`、#7342 `199ffe37ba`）

- `packages/client/ui-conversation/src/client/skeleton/ConversationSession.tsx`（+25/−2）：
  - 新 `labelNeedsTooltip(label)`：逐字形估算宽度——全角正则 `WIDE_GLYPH`（\u1100-\u115F、\u2E80-\uA4CF、\uAC00-\uD7A3、\uF900-\uFAFF、\uFE30-\uFE4F、\uFF00-\uFF60、\uFFE0-\uFFE6）记 13px、其余 7px，超过 `TAB_LABEL_MAX_WIDTH = 88`（对齐 `ConversationRoot.module.css` 的 `.tabLabel` max-width）才判定溢出；
  - 新 `ViewTabLabel`：`<Tooltip … disabled={!labelNeedsTooltip(label)}>` 包裹——**短标签页签不再挂全名 tooltip**（rc.3 及以前恒挂）；
  - ViewsMoreMenu 的 `label` 从 `currentInMore && active ? t('session.moreViewsCurrent', {name}) : t('session.moreViews')` 改为恒 `t('session.moreViews')`——**More 按钮文案不再内嵌当前折叠视图名**（高亮态保留）。
- `src/client/locales.ts`：zh/en 两处 **删除 `session.moreViewsCurrent`** 键（其余 7 语从未有该键，rc.3 落地时即只加 en/zh）。
- 测试：`tests/skeleton.client.spec.tsx` 按新口径改写。
- **契约层判定**：slot/缝/服务导出零变化——纯宿主内部渲染行为 + 内部 locale 键；外部可见面是 **DOM 文案/tooltip 出现条件**，只伤探针不伤 API。

## 2. ACP stdout 纯净性两连击（#7179 `41736cdec5`、#7168 `cc4446eecc`）

- `packages/llm/llm-deepseek-account/src/index.ts`（+2/−1）：`ModelListing` 诊断回调 `info:` 由 `console.info(LOG_TAG, …)` 改 **`console.error(LOG_TAG, …)`**——成功加载 catalog 时的 listing 日志不再进 stdout（ACP profile 的 JSON-RPC 通道）；`warn` 原本就走 stderr 不变。测试 `provider.spec.ts` 同步。
- `packages/mcp/mcp-client/src/connection.ts`（+13/−6）：`startConnection` 工具执行 switch 前加 `const listable = generation.getServerCapabilities()?.resources !== undefined`；`resources/list`/`resources/templates/list` 两分支在 `!listable` 时**直接返回空页**（`{resources: []}` / `{resourceTemplates: []}`），不发起 SDK 调用——官方 SDK 对未宣告能力的请求虽也返回空页，但会 `console.debug` 落 stdout。`resources/read` 不加闸（读失败本来显式抛错）。
- 新增 e2e：`apps/cli/tests/profiles/acp/tests/stdout.expected.e2e.ts`（断言 ACP 会话 stdout 仅协议消息；`940aafcadb` 补 shared cleanup）。
- README 口径变化：`mcp-resources`「The **MCP client** returns empty resource and template lists **without contacting the server**」（原「The SDK returns…」）；`llm-deepseek-account`「written to **stderr** … stdout remains available for protocol messages」。
- **契约层判定**：宿主资源工具对消费方返回**形状不变**（空页本就与 SDK fallback 全等）；变化在**是否触达服务器**与**日志去向**——对插件是行为面不是 API 面。

## 3. release bump（`504a01a957`）

- 349 个 package.json 版本行 → runtime 字符串 `0.2.1-rc.4`；同三元组（0.2.1），caret `^0.2.1-alpha.1` 天然命中，**枚举式清单需加行**。

## 4. 零变化面（逐条复核）

| 面 | 结论 |
|---|---|
| `plugin-compatibility.ts` / `compatibility-preflight.ts` | 零 diff（engines.dsh 时代延续） |
| settings 核心 / configForms 消费点 | 仅版本行；cf=78 不变 |
| vendor cordis / schemastery | 零 diff |
| `docs/capability-seams.md` / **`docs/` 整目录** | 零 diff（0 缝增删；升级指南 0 篇） |
| `slot-catalog.ts` | 零 diff（0 增 / 0 删 / 0 改名） |
| `SESSION_FORMAT_VERSION` | 4（`packages/core/session/src/types.ts` 零 diff） |
| `docs/persistence-changes/` | 无新增承认 |
| 包结构 | 0 新增 / 0 删除 / 0 改名 |
| llm-typert / session / api / experimental | 全部仅 package.json 版本行 |

## 未核实项

1. `ViewTabLabel` 估算（13px/7px/88px）与实际字体渲染的偏差边界——极端字号/自定义主题下可能与真实溢出判断不一致（宿主自身亦接受该近似，注释原文 "Approximate 13px text advance"）。
2. master tip（`f3803c9697`）在 rc.4 tag 之后的未发布提交内容——超出本目录边界，未纳入。（后续注：该 tip 已于 2026-10-28 发布为 `dsh-v0.2.2-alpha.2`，见 `../v0.2.2-alpha.2/README.md` 动态条目）

## 复核命令

```bash
git diff --numstat dsh-v0.2.1-rc.3 dsh-v0.2.1-rc.4 | grep -v package.json | sort -rn | head -8
git diff dsh-v0.2.1-rc.3 dsh-v0.2.1-rc.4 -- packages/client/ui-conversation/src/client/skeleton/ConversationSession.tsx
git diff dsh-v0.2.1-rc.3 dsh-v0.2.1-rc.4 -- packages/mcp/mcp-client/src/connection.ts
git diff dsh-v0.2.1-rc.3 dsh-v0.2.1-rc.4 -- packages/llm/llm-deepseek-account/src/index.ts
git grep -c "moreViewsCurrent" dsh-v0.2.1-rc.4 -- packages   # 空（键已全删）
git ls-remote origin HEAD   # f3803c9697 —— rc.4 ≠ master tip
```
