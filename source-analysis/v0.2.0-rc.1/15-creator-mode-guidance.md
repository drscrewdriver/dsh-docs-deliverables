# 创造模式插件指引与 prompt 演进（#4745 → 0.2.0-rc.1）

> **基线说明**：本篇为 v0.2.0-rc.1 目录的专题增篇（14 篇编号基线沿用 0.1.7-rc.1，本篇为增量）。
> **数据源**：`deepseek-ai/deepseek-harness`，核心提交 `7520fe94e1 refactor(preset): 精简创造模式的 system prompt (#4745)`（2026-09-21），及其后至 `dsh-v0.2.0-rc.1`（`4878cdabd8`，2026-09-28）的 10 个演进提交。
> **关联**：0.1.7-rc.2 分析的"prompt 经济学"（标准 preset 首轮 −1918 tokens，见 [../v0.1.7-rc.2/diff-vs-0.1.7-rc.1.md](../v0.1.7-rc.2/diff-vs-0.1.7-rc.1.md) §）是同一策略在标准线的前奏；本篇是它在创造模式（cordis preset）线上的落地与延伸。

---

## 一句话总结

创造模式在 0.2.0-rc.1 窗口内完成了一次 **"指引搬家"**：原来写在 cordis preset persona 里的约 15 段操作细则（宿主/预设两平面、禁改 shipped preset、视觉请求路由、plugin_manager 用法、inspect 用法、MCP 连接……）**全部移出 system prompt**，改由 **skill 描述（首-turn 目录）+ skill 正文（按需加载）+ 工具描述** 三层承接；persona 本体换成与 standard 逐字一致的一句话，并有 e2e 钉死两者相等。首轮 prompt tokens 实测 **9572 → 8815**（−757，deepseek-v4-flash 实测）。此后一周内又经历 10 个提交的持续重构，终态是 **渐进式 skill 结构**（短 SKILL.md + `references/` + `templates/`）。

---

## 1. 为什么改：重复承载

#4745 的自述理由（commit message 原文归纳）：

- cordis persona **重复了** `plugin_manager` 与 `cordis_inspect_*` 的工具描述、以及两个内置 skill 已承载的内容；
- `tool-cordis` 还有一个 system prompt section（`CORDIS_SYSTEM_PROMPT`）**复述自家工具描述**，整个删除；
- `cordis_inspect_query` 工具描述里的"导航提示"（`Service.listService` 先查目录再查详情）删除——`cordis_inspect_list` 返回的 provider manifest **本来就带这些说明**；
- 两个 skill 的 description 精简，压小首-turn skill 目录。

> 这与 `agent-experience` skill（见 §4.3）里的原则逐条对应：*"Say each fact once"*（工具描述、system-prompt section、参数描述三者不得互相复述）、*"Measure the change"*（改工具定义前后实测首轮 tokens）。0.1.7-rc.2 对标准 preset 做过同一件事（−1918），#4745 把它推到创造模式。

## 2. 规则搬家对照表（#4745）

改动前（rc.2 基线 `packages/preset/agent-presets/presets/cordis/agent.cordis.yml` 的 persona prefix，约 700 词）→ 改动后去向：

| 原 persona 段落（rc.2） | 0.2.0-rc.1 去向 |
|---|---|
| 身份句 "You are a coding agent … running on the DeepSeek Harness" + Cordis 组成介绍 | **删除**；persona 换成 standard 同款一句话：`You are a coding agent powered by the {{model}} model.`（`packages/bundle/web-app/presets/cordis.patch.yml:15-16`） |
| HOST composition vs AGENT PRESET 两平面、行归属规则 | `editing-cordis-compositions` skill 正文 |
| 自著 preset 存放路径 `${DSH_HOME}/.agent-presets/<id>/` | `editing-cordis-compositions` skill 正文 |
| 🔴 **禁改/禁删 shipped preset install**（升级覆盖、改坏 cordis 即自毁此模式；改副本不改原件） | 移交 **skills 自持 off-limits 规则**（yml 注释明言 "the skills own the off-limits rule"） |
| "写 composition 前先 load `editing-cordis-compositions`" | 该 skill 的 description 触发条件 |
| `plugin_manager` 持久安装/移除/启停、saved-state 与激活分开读、restart-required 语义 | `cordis-plugin-development` skill 正文（install 语义段，rc.2 时已在，persona 重复份删除） |
| **视觉请求路由**：未指定目的地的视觉物/装饰/小组件请求 = 装一个 UI 插件渲染进 Harness Web UI | `cordis-plugin-development` **description**（进首-turn 目录）+ skill 正文 step 1 |
| "先 inspect 再写码"：`cordis_inspect_list` → `cordis_inspect_query`、只读不调业务方法 | 工具描述（已有）+ skill "Knowledge sources, in order" 段 |
| MCP 连接：configuration-only bundle 插 `@deepseek-ai/dsh-mcp-client`、装完调 `mcp__<server>__<tool>` 验证 | skill 的 MCP 段 + `references/mcp-bundle.md` |
| 构建脚本需显式批准、保留失败与 pending、观察到能力才算成功 | `cordis-plugin-development` skill 正文（install 段尾） |
| `tool-cordis` 的 `CORDIS_SYSTEM_PROMPT` system prompt section（复述工具描述） | **整段删除**：`tool-cordis` 不再注入 `systemPrompt`（`inject` 从 `['tools','systemPrompt','cordisInspect']` 减为 `['tools','cordisInspect']`，`packages/extensions/tool-cordis/src/index.ts`） |
| `cordis_inspect_query` 描述里的导航提示（先目录后详情） | 删除（`cordis_inspect_list` 返回的 manifest 已含） |

**Token 效果**（官方实测，DeepSeek API + deepseek-v4-flash，cordis preset 首轮）：`9572 → 8975`（第一轮修剪）`→ 8815`（persona 换 standard 后）。e2e 钉死：`apps/cli/tests/web-agent-presets.e2e.ts:381-393` 逐节断言 cordis persona sections 与 standard 相等（`preset-cordis-standard-persona`）。

## 3. 文件位置迁移（同一窗口内）

| | 0.1.7-rc.2 | 0.2.0-rc.1 |
|---|---|---|
| preset 声明 | `packages/preset/agent-presets/presets/cordis/agent.cordis.yml` | **`packages/bundle/web-app/presets/cordis.patch.yml`**（`insert` 一行 `@deepseek-ai/dsh-agent-preset`，`#4569` 起预设组合改由 profile YAML 声明，Web 编辑器保存的改动按 id 覆盖该行 `config.plugins`） |
| 内置 skills | `packages/preset/agent-presets/presets/cordis/skills/`（cordis 专属） | **`packages/preset/agent-preset/skills/`**（包级共享，经 `skill-filesystem` 的 `customSkillDirs` 挂载）：`agent-experience`、`cordis-plugin-development`、`editing-cordis-compositions`、`cordis-composition-reference` |

## 4. #4745 之后的演进（2026-09-21 → 09-28，共 10 个提交）

| 提交 | 日期 | 内容 |
|---|---|---|
| `d1e22a7e24` (#4569) | 09-21 | 预设组合改由 profile YAML 声明；skills 迁到包级 `agent-preset/skills/` |
| `b13bbc027c` (#4836) | 09-21 | **渐进式 skill 结构**：`cordis-plugin-development` 拆出 `references/`（按需读）与 `templates/`（decoration 四文件、mcp 两文件，可直接拷进 workspace 起步）；补 profile shell 事实（`DSH_PROFILE` / `DSH_PROFILE_DIR` 环境变量语义、bash 与 PowerShell 读法差异） |
| `d1255ab1a4` (#4856) | 09-21 | skill 文件**只能用 Host 文件工具枚举与校验**（Desktop 中该目录在 `app.asar` 内，shell/ripgrep/node/pnpm 全部打不开；模板必须先拷进 workspace，不得原地安装或语法检查） |
| `4aa207c5fe` (#5025) | 09-23 | 新增 `references/practices.md`：选扩展点、上下文与状态机制时的升级稳定性与性能准则（超出静态装饰才必读） |
| `e1f65ea640` | 09-24 | 启用 shipped 但默认 disabled 的插件，路由经 `cordis-plugin-development`（写 workspace bundle 覆盖 `disabled: false`，不得直接改组合） |
| `68519237ac` | 09-28 | 避免自动 UI action 上下文注入 |
| `c795996b5d` | 09-28 | plugin UI action 与主题规则并入 `cordis-plugin-development` |
| `1f847565ba` | 09-28 | 明确 plugin 动作与 review 指引（新增 "Design or review" 模式：只评审不落盘） |
| `8931fa2748` | 09-28 | `agent-experience` skill 与创造模式共享（写工具定义/设计 skill 的方法论面也进创造模式） |
| `b1f5f5c171` | 09-28 | 移除视觉设计小节 |

### 4.1 终态：`cordis-plugin-development` 的当前形态（0.2.0-rc.1）

- **description 即路由**：覆盖"设计/评审/启用/禁用/安装/配置/调试插件或 MCP 连接"+ "未指定目的地的视觉请求"，一条 description 进首-turn 目录完成分流；
- **正文短、按需深读**：SKILL.md 只留流程骨架（先出能装的版本 → inspect 只查所需 API → 模板拷贝起步 → 读安装结果 `application`/`warnings` 而非服务器日志 → 同插件内修缺陷，不搞投机变体），细节全在 6 篇 `references/`（host-plugin / ui-plugin / mcp-bundle / verification / practices / user-actions）；
- **验证标准显式化**：页面/面板须过四项——只用 theme tokens、不 import Harness Client 包（如 `@deepseek-ai/dsh-client-ui-primitives`）、console 无 slot entry crash、明暗主题并排可读；无浏览器控制时按 `references/verification.md` 降级；测试改动过用户设置/状态须还原；
- **每份 SKILL.md 渲染为 `skill` 工具结果后不超过 8192 字符**——超过该阈值会被 standard preset 的 tool-result pruner 裁剪（`compaction-basic` 组的 `thresholdChars: 8192`，见 `cordis.patch.yml` compaction 组），这是 skill 拆 references 的直接约束。

### 4.2 与 bug 讨论的呼应

创造模式历史 issue 的几类高频失败，正对应这次搬家要钉死的规则：#1376（写插件失败后所有对话失败）、#2968（preset_tools 工具调用无限循环）、#4115（坏的预设启用后新会话静默失败）、#5195（`plugin` 参数 oneOf 循环）。skill 化后的"读安装结果字段而非服务器日志""失败/pending 必须保留并诊断""同一 bundle 内修复而非另起副本"等条目即针对这类失败模式。

## 5. 对插件开发者的启示

1. **在创造模式里让 agent 写插件，实际遵循的是 skill 文件而非 persona**——想理解或复刻官方指引，读 `packages/preset/agent-preset/skills/cordis-plugin-development/`，而不是 preset 声明；
2. **8192 字符阈值**是我们自己写"可被创造模式加载的 skill"时的硬约束（官方自检门槛：每份 SKILL.md 渲染结果不超限）；
3. **工具描述三不复述**原则（工具描述 / system-prompt section / 参数描述各说一遍）同样适用于我们插件的工具定义——0.1.7-rc.2 的 −1918 与本次 −757 都是这一原则的直接收益；
4. 官方模板（decoration 四文件 / mcp 两文件）是我们 [plugin-framework/dsh-plugin-template/](../../plugin-framework/dsh-plugin-template/) 的对照基线；其验证清单（theme tokens、禁 import client 包、明暗主题）可直接用作插件验收 checklist。

---

## 证据链

- 核心提交：`7520fe94e1`（#4745，2026-09-21，作者 Turtle）；演进链 §4 表内 10 个 SHA；发布 `4878cdabd8`（#5387）
- persona 终态：`packages/bundle/web-app/presets/cordis.patch.yml`（注释 "Same persona as standard…"）
- persona 相等 e2e：`apps/cli/tests/web-agent-presets.e2e.ts:381-393`
- tool-cordis section 删除：`packages/extensions/tool-cordis/src/index.ts`（`inject` 变化 + `ctx.systemPrompt.section` 调用移除）、`src/prompt.ts` 删除
- token 实测：commit message 原文（9572 → 8975 → 8815）
- skill 目录与 8192 阈值：`packages/preset/agent-preset/README.md`（"stays under the 8192-character threshold above which the standard preset's tool-result pruner trims results"）
- token 经济学前奏：`../v0.1.7-rc.2/diff-vs-0.1.7-rc.1.md`（标准 preset 首轮 7985 → 6067）
