# Source Analysis

DeepSeek Harness 源码深度解析。按版本快照组织，每个版本包含架构分析、Breaking Changes、插件迁移指南。

## 版本矩阵

| 版本 | 目录 | 提交数 | 重要性 | 内容 |
|------|------|--------|--------|------|
| v0.1.0-rc.5 | `v0.1.0-rc.5/` | — | ⭐⭐⭐ | 14 篇：架构总览 + 12 模块详解 + 开发模板 |
| v0.1.0-rc.7 | `v0.1.0-rc.7/` | — | ⭐ | 首个可用 tag，与 rc.5 架构一致 |
| v0.1.1-rc.2 | `v0.1.1-rc.2/` | +207 | ⭐⭐ | 首个稳定版，增量改进 |
| v0.1.2-rc.1 | `v0.1.2-rc.1/` | +1735 | ⭐⭐⭐⭐⭐ | **大重构**：Session V2、runtime→store、Apiproxy→Remote |
| v0.1.3-alpha.2 | `v0.1.3-alpha.2/` | +644 | ⭐⭐⭐ | Settings 命名空间变更、Permission Presets |
| v0.1.5-alpha.1 | `v0.1.5-alpha.1/` | +563 | ⭐⭐⭐⭐⭐ | **Sidebar 重写**、Session V3、Electron 桌面、Token Meter 扩展、Permission Presets 统一、LLM Adapter 7 方法、子代理目录 |
| v0.1.5-rc.1 | `v0.1.5-rc.1/` | +140 | ⭐⭐⭐⭐⭐ | 反馈对话框 + 产物卡片 + 文档预览 + 共享图标 |
| v0.1.5-rc.2 | `v0.1.5-rc.2/` | +2 | ⭐⭐ | 反馈对称化 + 交付物 UI 精化（backport） |
| v0.1.6-alpha.1 | `v0.1.6-alpha.1/` | +800 | ⭐⭐⭐⭐⭐ | **四个新能力族**（ssh / ptc-runtime / browser-use / computer-use）、e2b 与 code-runtime 退役、三个默认值收敛、公共包 manifest、profile 解析代际化、侧栏终端 |
| v0.1.7-rc.1 | `v0.1.7-rc.1/` | +2504 | ⭐⭐⭐⭐⭐ | **会话格式 V4**、**设置机制换代**（`installSection` 删除 + `.volatile()` + `settings.yaml` 移除）、**插件清单契约换代**（patch 数组化、`patchReload` 移除、peer 范围强制、本地化显示元数据）、`deliverables` 与 `document` 两个新顶层包组、语音输入族 |
| v0.1.7-rc.2 | `v0.1.7-rc.2/` | +335 | ⭐⭐⭐ | 账号体系拆 providers（account / api-key）、LLM 中途动态工具更新（beta wire）、可配置快捷键回归、Schedule 与 user-questions 两条激进主线撤回、prompt 经济学（标准 preset 首轮 −1918 tokens） |
| v0.2.0-rc.1 | `v0.2.0-rc.1/` | +261 | ⭐⭐⭐⭐ | **Schedule 可选 bundle 化**（默认组合裁剪）、**OTel 统一上报**（`ctx.otel` 共享服务 + 字节限额 + 端点迁移）、**productAnalytics**（desktop-only）、Session Log 上传开关（volatile 热更新）、`ToolCallRecovery`（step 失败保守恢复）、`displayTitle` 空串语义；**无 API breaking，但 peer 世代门槛挡住 0.1.7 线插件** |
| v0.2.0-rc.2 | `v0.2.0-rc.2/` | +187 | ⭐⭐⭐ | **计时提问 two-settlements**（`ask_user_question` `mode: 'timed'` + 迟到回答经 steer 入会话，same-version 持久化承认）、桌面 CLI 命令原生菜单管理、Windows ACL 单次运行诊断+修复、模型选择器模糊搜索 + 粘性分组头、长会话/鲸鱼动画降开销、Schedule 提醒框架化首行；**插件契约零 diff，rc.1 迁移清单原样适用** |
| v0.2.1-alpha.1 | `v0.2.1-alpha.1/` | +266 | ⭐⭐⭐⭐ | **Schedule 换挂载制**（rc.1 的 opt-in bundle 退役 → Web 组合全 profile 挂载 + preset 声明 `time-context`/`schedule_*` 四工具，新包 `tool-schedule`，子代理 `toolFilter.deny` + service 结构化拒绝）、**Claude Code mods 桥**（新能力族：`defineMod` 把 Anthropic mods 跑成 DSH 插件 + AbovePrompt band + Web band）、**runtime invariants 全家删除**（包/符号/`*/invariant` 导出/sdk-minimal 5 行）、**子路径插件显示面换代**（`<subpath>/icon` + locale meta，不再读 `<subpath>/package.json`）、**插件运行时解析刷新 + HMR 包配置过期**（装包/启停即时生效，覆盖安装仍需重启）、Session 检查器族（`session-inspector` + `inspector-profile`）、composer stats dock 拆 `activity`/`usage`；**4 包新增 / 1 删 / 1 改名（schedule-bundle→inspector-profile）；peer 校验/manifest/settings/会话 V4 零 diff，无新增持久化承认；官方升级指南 4 篇** |
| v0.2.1-alpha.2 | `v0.2.1-alpha.2/` | +669 | ⭐⭐⭐⭐⭐ | **子代理激活统一化**（删 `backgroundMode`/`run_in_background`，委派统一返 `{kind:'activation'}`，in-process-driver 退役）、**Working directory 能力缝**（新 `ctx.workingDirectory`/`ctx.worktrees`，接替 `{{cwd}}` 与子代理 `cwd` 配置键）、**session-title provider 换代**（三导出删除，改直注 `ctx.sessionTitle.register()`）、**BundleInfo 新增必填字段** `official`/`availability`、**Web 监听信任面换代**（`webRuntime`→`webStartup`，拒通配 host）、SSH/PTC `launch` 换代（protocol 2）、推理翻译族（`ctx.translator`/`ctx.cotTranslation` 新缝）、能力包重组 + 5 个 `*-bundle` 打包制（装包≠挂载）；3226 files +114987/−28177；**peer 闸门 / settings 核心 / cordis / schemastery / HMR 过期机制零 diff**，`SESSION_FORMAT_VERSION` 保持 4 但 **5 条同版本加性承认**；**官方升级指南 20 篇、指南级 breaking 10 条** |
| v0.2.1-alpha.3 | `v0.2.1-alpha.3/` | +852 | ⭐⭐⭐⭐⭐ | **Remote 访问 RBAC**（新缝 `ctx.remoteAccess`，typert Remote 统一定义 + principal 链）、**CUA 桌面操作成建制**（新双包 `experimental/cua(-macos)`，204 提交）、**JSONL 持久化改插件命名空间**（无默认导出）、**JobId 换代**（`<kind>-<short-uuid>`，删 `executionId`）、**子代理 `persona`/`toolFilter` 拒绝**（改 `agentPreset`）、`installBundle` 报 `already-installed`、**凭据优先级反转**（存储 > env）、非页面 Connection 默认 `interactions:'none'`、槽位家族换代（`conversation.message.images`→chat 家族，+5 槽）；**闸门本段零 diff**；指南 14 篇；3311 files +120978/−16632 |
| v0.2.1-alpha.4 | `v0.2.1-alpha.4/` | +89 | ⭐⭐⭐⭐⭐ | **兼容性闸门换代**：`engines.dsh` 成为首要判据（存在即独裁、忽略 dsh peers；`workspace:` 被拒；非字符串=拒载）、`PluginCompatibility.peers`→`requirements`——**0.1.7 以来「只读 peers」铁律作废**；插件市场族进门（5 新包 + `ctx.pluginMarket` 缝 + `plugins.tab` 槽）；跨宿主 release 的插件更新不自动应用 + 重载提示；功能预览标准化、斜杠 chip、Linux 沙箱加固、no-top-level-await 门禁；指南 1 篇 |
| v0.2.1-alpha.5 | `v0.2.1-alpha.5/` | +36 | ⭐⭐ | 收尾打磨段：账号通知契约放宽（`AccountBonusNotification` 元数据可选未校验、`orderId` 任意串、空 `expiresAt`=永久）、新槽 `conversation.input.model.label`、PTC 指令组合化 + persona 回补、斜杠菜单随 plugin manager 刷新；0 包增删改；无新持久化承认；指南 1 篇 |
| v0.2.1-rc.1 | `v0.2.1-rc.1/` | +4 | ⭐ | **纯版本 bump**：355 个 package.json 版本行，零代码面变化；对插件唯一意义是 runtime 字符串变 `0.2.1-rc.1` 的命中判定；含 0.2.0-rc.2→0.2.1-rc.1 全程缝隙总账 |
| v0.2.1-rc.2 | `v0.2.1-rc.2/` | +9 | ⭐⭐ | 功能补丁车：**2 新包**——`web-deepseek-api`（DeepSeek Search/Fetch API，既有 `ctx.web` 缝 provider，settings 开关后）+ `ui-deepseek-model-label-1017`（Flash 1017 徽章，成 `conversation.input.model.label` 槽首个官方 occupant，replaceRisk 升 `shadows-shipped-ui`）；闸门/settings/vendor/slot 结构**零断裂**（探针 13 列与 rc.1 逐项全等）；+1 同版本承认 deepseek-search-thinking；指南 0 篇 |
| v0.2.1-rc.3 | `v0.2.1-rc.3/` | +6 | ⭐⭐⭐ | 导航条目自定义功能车：**1 新包** `client/ui-entry-customization`；三域（左侧栏面板/View 页签/guide 卡）条目用户可钉选/隐藏/收进 More，**slot +3**（`*.actions` 行槽，0 删 0 改名）；**New Session 空白会话复用**（`startSession`/`openWorkspace`/`connectWorkspace` 签名不变语义变，官方指南 1 篇）；DeepSeek API-key 路由改跟随官方 `/models` listing（新 additive volatile 键 modelsTimeoutMs/modelsMaxAgeMs）；闸门/settings/vendor/缝/会话 V4 零 diff，无新承认 |
| v0.2.1-rc.4 | `v0.2.1-rc.4/` | +9 | ⭐⭐ | 纯修复车（现 0.2.1 线最新 tag，≠ master tip）：369 文件中 349 仅版本行，实质 20 文件三主题——①View 页签 tooltip 改估算溢出才出现 + More 按钮文案不再含当前视图名（**locale 键 session.moreViewsCurrent 删除**）；②ACP stdout 保留给协议消息×2（账号目录诊断 stdout→stderr；MCP 未宣告 resources 的服务器列表短路空页不触服务器）；**契约面（闸门/settings/vendor/缝/槽/docs 整目录）零 diff**，指南 0 篇，配对探针 14 列与 rc.3 全等 |

> **未覆盖的中间版本**：`dsh-v0.1.5-rc.3`（3 commits）、`dsh-v0.1.6-alpha.2`（887）、`dsh-v0.1.7-alpha.1`（1299）、`dsh-v0.1.7-alpha.2`（162）尚无独立目录。`0.1.7-rc.1` 的文档已把 `0.1.6-alpha.1 → 0.1.7-rc.1` 的 2504 commits 全部纳入（区间包含上述中间版本）；`0.1.7-rc.2` 至 **`0.2.1-rc.4`** 各线尾版均有独立目录。**0.2.0-rc.2 → 0.2.1-rc.4 全线无分析空白**（相邻 tag 间均无中间 tag）。

> 版本变更详情（0.1.1→0.1.5 完整提交级记录）参见 [dsh-015-notes.md](../dsh-015-notes.md)。

## 关键 Breaking Changes 速查

| 版本跳跃 | 影响级别 | 核心变更 |
|----------|---------|----------|
| rc.7 → 0.1.1 | 🟢 低 | 无 breaking changes |
| 0.1.1 → 0.1.2 | 🔴 高 | client/runtime→store、Session V2、Apiproxy→Remote、CallId→ToolCallId |
| 0.1.2 → 0.1.3 | 🟡 中 | settingsNamespace()→字符串、Permission Presets |
| 0.1.3 → 0.1.5 | 🔴 高 | Session V3 surface node、Sidebar 完全重写、Inbox 投影重构、Token Meter 扩展、Permission Presets 统一、LLM Adapter 7 方法 |
| 0.1.5-rc.1 → rc.2 | 🟡 中 | `toggle`→`retract` 接口变更、Like 也走对话框、图标数据化 |
| 0.1.5-rc.2 → 0.1.6-alpha.1 | 🔴 高 | `packages/e2b` 与 `code-runtime` 退役、`DshManifest` 公开面收窄、会话事件同步读取废弃、profile 解析代际化（**升级包后必须重启**）、`ralph` 默认关闭、Session 日志上报默认开启、headless `--session-id` 语义收紧、DeepSeek 默认协议改 Messages |
| 0.1.6-alpha.1 → 0.1.7-rc.1 | 🔴 高 | **`settings.installSection()` 删除**（无垫片）、**`settings.plugin.item` 席位移除**、**`$DSH_HOME/settings.yaml` 移除**、**`@deepseek-ai/dsh*` peer 范围强制校验**（不是 `engines.dsh`）、`dsh.profile.patchReload` 移除、HMR 包改名 `cordis-plugin-hmr` → `dsh-hmr`、**会话格式 V3 → V4（不可回退）**、`agent-team-web-profile` 整包删除、DeepSeek 彻底 Messages-only（存量 `protocol` 键硬失败） |
| 0.1.7-rc.1 → 0.1.7-rc.2 | 🟢 低 | 无 API breaking；账号 providers 拆分与动态工具更新均为增量，会话格式保持 V4 |
| 0.1.7-rc.2 → 0.2.0-rc.1 | 🟡 中 | **peer 世代门槛**（`>=0.1.7-rc.1 <0.2.0-0` 的插件在 0.2.0-rc.1 宿主上**安装被拒**，除非精确版本豁免）、**Schedule 默认组合移除**（引用 `time-context`/`schedule`/`ui-schedule` 的 patch 报 `entry not found`）、**`displayTitle` 可能为空串**（不再兜底 project basename / Session id）；manifest / settings API / 加载器 / HMR / slot / 会话格式 V4 **全部未动** |
| 0.2.0-rc.1 → 0.2.0-rc.2 | 🟢 低 | 无任何插件契约变化（peer 校验 / manifest / settings / 加载器零 diff，会话格式保持 V4）；新增 `ask_user_question` `mode: 'timed'`（**opt-in，默认组合不变**，same-version 持久化承认 `2026-09-21-user-question-reply`）、Schedule 提醒首行框架文案、模型选择器/桌面 CLI/ACL 修复；rc.1 迁移清单原样适用 |
| 0.2.0-rc.2 → 0.2.1-alpha.1 | 🟡 中 | 核心契约（peer 校验 / manifest / settings / 加载器 / 会话 V4）**零 diff、无新增持久化承认**，但**四处官方升级指南级变化**：①**schedule-bundle 退役**（Web 组合全挂载 `schedule`/`ui-schedule`、preset 声明时钟行与四工具、加载 profile 自动摘 bundle；顶层 `time-context` override 不再命中）②**子路径插件不再读 `<subpath>/package.json`**（locale meta + `<subpath>/icon`）③**runtime invariants 全家删除**（引用行加载失败、四发射器不再 rethrow `INVARIANT`）④**运行时解析刷新 + HMR 包配置过期**（install/enable 即时生效，覆盖安装仍 restart-required）；另 stats dock 条目 `stats` 拆 `activity`/`usage`；4 包新增 / 1 删 / 1 改名 |
| 0.2.1-alpha.1 → 0.2.1-alpha.2 | 🔴 高 | **指南级 breaking ×10**：子代理激活换代（`startActivation()`，删 `run_in_background`/`backgroundMode`，in-process-driver 退役）、session-title provider 三导出删除、**`BundleInfo` 新增必填 `official`/`availability`**（构造方/精确断言即编译失败）、`{{cwd}}` 变量与子代理 `cwd` 配置键删除（→ `ctx.workingDirectory`）、`webRuntime`→`webStartup` 且拒通配 host、SSH/PTC helper `launch` 换代（protocol 2）、`TerminalBlockLabels` 新增必需 `commandLine()`、tool presentation 拒 `both` 档、Python PTC 强制 sandbox、可选包显式 bundle 挂载（装包≠挂载，profile 禁自动 peer 安装）；核心契约面（peer 闸门 / settings / cordis / schemastery / loader / 会话 V4）**仍零 diff**；缝 **+4**（workingDirectory/worktrees/translator/cotTranslation）**0 删除**；持久化 5 条同版本加性承认；slot +2（`conversation.chat.flow`/`reasoning.body`，`chat.node` declaredBy 移位） |
| 0.2.1-alpha.2 → 0.2.1-alpha.3 | 🔴 高 | **指南级 breaking ×6**：JSONL 持久化改插件命名空间（无默认导出，直接构造/`instanceof` 失效）、JobId 换代（`<kind>-<short-uuid>`、删 `executionId`）、子代理 `persona`/`toolFilter` 拒绝（改 `agentPreset`/`allowedAgentPresets`）、`installBundle` 已装报 `already-installed`、凭据优先级反转（存储 > env；headless 禁存储）、非页面 Connection 默认 `interactions:'none'`；**旧槽名 `conversation.message.images` 改名进 chat 家族（注入静默失效）**；新缝 `ctx.remoteAccess`/`ctx.webApp`；CUA 双新包 + RBAC；**闸门/settings/cordis 零 diff**；会话 V4 +2 同版本承认 |
| 0.2.1-alpha.3 → 0.2.1-alpha.4 | 🔴 高 | **装载闸门换代（0.2.1 线分水岭）**：`engines.dsh` 存在即单独决定兼容性并**忽略 dsh peers**（`workspace:` 值被拒；非字符串=拒载）；`PluginCompatibility.peers`→`requirements`（`IncompatiblePlugin` 同步）；插件市场族进门（`ctx.pluginMarket` 缝 + `plugins.tab` 槽 + 5 新包）；跨宿主 release 的更新不自动应用；其余零断裂（无新承认、settings 不动） |
| 0.2.1-alpha.4 → 0.2.1-alpha.5 | 🟡 中 | 账号通知契约放宽（`AccountBonusNotification` 元数据可选未校验、`orderId` 任意串、空 `expiresAt`=永不过期、新增可选 `title`）；新槽 `conversation.input.model.label`；PTC 指令组合化（prompt 形状敏感者注意）；闸门/包结构/承认清单零变化 |
| 0.2.1-alpha.5 → 0.2.1-rc.1 | 🟢 低 | **纯版本 bump**（355 个 package.json 版本行），零代码面变化；唯一动作是把 `0.2.1-rc.1` 加进宿主矩阵重跑冒烟（精确枚举止于 alpha.5 的写法会漏 rc.1） |
| 0.2.1-rc.1 → 0.2.1-rc.2 | 🟢 低 | 零必做：两新包全走既有缝 provider（`ctx.web`+`web-deepseek-api`）/ 既有槽 occupant（`model.label`+1017 徽章）路径；闸门/settings/vendor/slot 结构/会话 V4 零 diff（探针 13 列全等）；同三元组故 `^0.2.1-alpha.1` 与枚举写法天然覆盖 rc.2；唯一自查：同挂 `conversation.input.model.label` 的插件与官方徽章遮蔽竞争；⚠ 后续实证补记：`ctx.web` search/fetch provider 钉选由构造期快照改 volatile config 实时读，接管型插件需改 `settings.mutate`（见 v0.2.1-rc.2/README 观察点 #5） |
| 0.2.1-rc.2 → 0.2.1-rc.3 | 🟡 中 | 核心契约（闸门/settings/vendor/缝/slot 结构删改/会话 V4）**零 diff**，但**官方升级指南 1 篇**：`startSession`/`openWorkspace`/`connectWorkspace` 从每次新建改为**按 preset 复用空白会话**（签名不变语义变）；slot **+3**（三域 `*.actions` More 行，0 删）；条目可见性让渡用户（钉选/隐藏/More）；DeepSeek API-key 路由模型目录改跟随官方 `/models`（新 additive volatile 键 ×2）；枚举式 engines.dsh/peer 清单需加 `0.2.1-rc.3` 行 |
| 0.2.1-rc.3 → 0.2.1-rc.4 | 🟢 低 | **纯修复车，契约面全零**（闸门/settings/vendor/缝/槽/docs 整目录零 diff，指南 0 篇，配对探针 14 列全等）；三处运行态行为变：①View 页签 tooltip 仅估算溢出才挂、More 按钮文案不再含当前视图名（**locale 键 `session.moreViewsCurrent` 删**）——DOM 探针文案锚需改；②MCP 未宣告 resources 的服务器列表**短路空页不触服务器**（消费形状不变）；③账号目录诊断 stdout→stderr（ACP stdout 与协议消息分道）；枚举式清单需加 `0.2.1-rc.4` 行，caret 免 |

## 推荐阅读路径

### 按版本递进（推荐）

1. **v0.1.0-rc.5** — 架构基础（12 篇模块详解）
2. **v0.1.2-rc.1** — 第一次大重构（Breaking Changes 最多）
3. **v0.1.5-alpha.1** — 第二次大重构（Sidebar + Session V3）
4. **v0.1.6-alpha.1** — 第三次扩张（能力族矩阵 + 默认值收敛 + 启动代际化）
5. **v0.1.7-rc.1** — 第四次（**契约换代**：设置 + 插件清单 + 会话格式同时换挡）
6. **v0.2.0-rc.1** — 第五次（**世代门槛 + 组合裁剪**：peer 范围挡住跨线安装、Schedule 转 opt-in、遥测收口共享服务）
7. **v0.2.0-rc.2** — rc.1 的增量打磨（**计时提问 two-settlements**、桌面 CLI 自管理、ACL 单次修复；契约面零变化）
8. **v0.2.1-alpha.1** — 第六次（**挂载制与显示面收缩**：Schedule bundle 退役改 preset 贡献制、subpath 显示换代、invariants 退场、插件运行时解析"活"过来 + Claude Code mods 新能力族进门）
9. **v0.2.1-alpha.2** — 第七次（**编排 API 与 provider 面换代**：子代理激活统一化、session-title provider 换代、`BundleInfo` 必填字段、`{{cwd}}` 退场换 `ctx.workingDirectory` 新缝、Web 信任面 `webStartup` 换代；核心契约闸门面仍零 diff；指南级 breaking ×10 / 官方指南 20 篇）
10. **v0.2.1-alpha.3** — 第八次（**消费面契约换代**：JSONL 插件命名空间、JobId 身份、子代理 preset 组装、RBAC/CUA 两大能力族进门；闸门仍零 diff）
11. **v0.2.1-alpha.4** — 第九次（**装载闸门换代**：`engines.dsh` 独裁 + `requirements` 改名；插件市场进门——0.2.1 线的兼容性判定分水岭）
12. **v0.2.1-alpha.5 → v0.2.1-rc.2** — 收口段（通知契约放宽；rc.1 纯 bump，功能面即 a.5；rc.2 = 两小功能包进门零断裂）
13. **v0.2.1-rc.3** — 导航条目自定义车（三域 pins/隐藏/More + slot×3；**New Session 空白复用带官方指南 1 篇——本段唯一语义级行为变化**；DeepSeek 模型跟官方 /models）
14. **v0.2.1-rc.4** — 纯修复车（契约面全零；页签 tooltip 精化 + ACP stdout 保留给协议消息×2；只伤 DOM 探针文案锚与 stdout 日志抓取面）

### 按角色

| 角色 | 推荐路径 |
|------|----------|
| **新插件开发者** | rc.5 架构总览 → 0.1.2 CHANGELOG → 0.1.5 CHANGELOG → 0.1.6 CHANGELOG → **0.1.7 CHANGELOG + 0.1.7 迁移指南** → 0.2.0 迁移指南（peer 范围）→ 0.2.1 的显示资源规则（locale meta + `<subpath>/icon`）与 `tool-schedule` preset 作用域范例 |
| **已有插件迁移** | 对应版本 CHANGELOG 的"插件迁移指南"小节；**跨两版者先读 [0.1.7-rc.1/diff-vs-0.1.5-rc.2.md](v0.1.7-rc.1/diff-vs-0.1.5-rc.2.md)**；0.1.7 → 0.2.0 只需 [0.2.0-rc.1/plugin-migration-guide.md](v0.2.0-rc.1/plugin-migration-guide.md)；0.2.0-rc.1/rc.2 → 0.2.1-alpha.1 需过一遍 [0.2.1-alpha.1/plugin-migration-guide.md](v0.2.1-alpha.1/plugin-migration-guide.md)（多数零修改；subpath 分发 / invariant 引用 / schedule bundle 用户有必做项） |
| **架构研究者** | rc.5 全部 14 篇 → dsh-015-notes.md → 0.1.6 的 `14-post-tag-master.md` → **0.1.7 的 `09-plugin-system.md`（插件体系全链）+ `06-memory.md`（V4 持久化）** → 0.2.0 的 `diff-vs-0.1.7-rc.2.md`（共享 OTel 服务 + ToolCallRecovery）→ 0.2.0-rc.2 的 `diff-vs-0.2.0-rc.1.md`（计时提问 two-settlements）→ 0.2.1 的 `diff-vs-0.2.0-rc.2.md`（Schedule 挂载制三代演变 + 运行时解析刷新 + mods 桥映射表） |
| **运维/部署** | **0.1.7 的 `CHANGELOG.md` §八「升级影响速查」+ `plugin-migration-guide.md` §九「升级检查清单」**；0.2.0 另需注意 **OTLP 端点迁移**（`harness-telemetry` → `dsh-otel-collector`）；0.2.1-alpha.1 注意：schedule-bundle 自动摘除后**手工删除顶层 `time-context` override**、桌面默认 **OS 分配端口**、公网部署需显式 **public URL**、Node 无 type-stripping 拒绝启动 |

## v0.1.0-rc.5 详细目录

| # | 文件 | 主题 | 核心概念 |
|---|------|------|----------|
| 01 | [01-vendor-cordis.md](v0.1.0-rc.5/01-vendor-cordis.md) | Cordis 框架层 | Service、Context、生命周期 |
| 02 | [02-core-product.md](v0.1.0-rc.5/02-core-product.md) | Core 产品主干 | 产品架构、核心流程 |
| 03 | [03-shell-capabilities.md](v0.1.0-rc.5/03-shell-capabilities.md) | Shell 能力缝 | shell 与 core 的衔接 |
| 04 | [04-llm-typer.md](v0.1.0-rc.5/04-llm-typer.md) | LLM 与 Typer | LLM 集成、类型系统 |
| 05 | [05-execution-world.md](v0.1.0-rc.5/05-execution-world.md) | 执行世界 | 会话管理、执行环境 |
| 06 | [06-memory.md](v0.1.0-rc.5/06-memory.md) | 记忆系统 | 记忆存储、检索、L1-L3 架构 |
| 07 | [07-multi-agent.md](v0.1.0-rc.5/07-multi-agent.md) | 多智能体 | AgentTeams、子代理、协作 |
| 08 | [08-human-agent-governance.md](v0.1.0-rc.5/08-human-agent-governance.md) | 人机协作与治理 | 治理框架、安全机制 |
| 09 | [09-cli-boot.md](v0.1.0-rc.5/09-cli-boot.md) | CLI 与 Boot | 命令行接口、启动流程 |
| 10 | [10-gui-frontend-backend.md](v0.1.0-rc.5/10-gui-frontend-backend.md) | GUI 前后端 | Web UI 架构、前后端通信 |
| 11 | [11-protocol-sdk.md](v0.1.0-rc.5/11-protocol-sdk.md) | 协议与 SDK | 通信协议、SDK 设计 |
| 12 | [12-engineering.md](v0.1.0-rc.5/12-engineering.md) | 工程体系 | 构建、测试、发布 |
| — | [architecture-overview.md](v0.1.0-rc.5/architecture-overview.md) | 架构总览 | 全局架构图、模块关系 |
| — | [module-template.md](v0.1.0-rc.5/module-template.md) | 模块详解模板 | 文章编写规范 |

## v0.1.5-rc.2 详细目录

| # | 文件 | 主题 | 核心概念 |
|---|------|------|----------|
| 01 | [01-cordis-framework.md](v0.1.5-rc.2/01-cordis-framework.md) | Cordis 框架层 | Service、Context、生命周期 |
| 02 | [02-core-product.md](v0.1.5-rc.2/02-core-product.md) | Core 产品主干 | 产品架构、核心流程 |
| 03 | [03-shell-capabilities.md](v0.1.5-rc.2/03-shell-capabilities.md) | Shell 能力缝 | shell 与 core 的衔接 |
| 04 | [04-llm-typer.md](v0.1.5-rc.2/04-llm-typer.md) | LLM 与 Typer | LLM 集成、类型系统 |
| 05 | [05-execution-world.md](v0.1.5-rc.2/05-execution-world.md) | 执行世界 | fs/sandbox/code-runtime |
| 06 | [06-memory.md](v0.1.5-rc.2/06-memory.md) | 记忆系统 | Session V3、compaction |
| 07 | [07-multi-agent.md](v0.1.5-rc.2/07-multi-agent.md) | 多智能体 | 子代理目录、模型路由 |
| 08 | [08-human-agent-governance.md](v0.1.5-rc.2/08-human-agent-governance.md) | 人机协作与治理 | 治理框架、安全机制 |
| 10 | [10-gui-frontend-backend.md](v0.1.5-rc.2/10-gui-frontend-backend.md) | GUI 前后端 | Web UI、Sidebar 重写 |
| 11 | [11-protocol-sdk.md](v0.1.5-rc.2/11-protocol-sdk.md) | 协议与 SDK | SDK、ACP、MCP |
| 12 | [12-engineering.md](v0.1.5-rc.2/12-engineering.md) | 工程体系 | 构建、测试、发布 |
| — | [plugin-migration-guide.md](v0.1.5-rc.2/plugin-migration-guide.md) | **插件迁移深度指南** | **Token/Permission/Inbox/Adapter 全面迁移** |
| — | [architecture-overview.md](v0.1.5-rc.2/architecture-overview.md) | 架构总览 | 全局架构图、模块关系 |
| — | [changelog-alpha1-rc1.md](v0.1.5-rc.1/changelog-alpha1-rc1.md) | Alpha.1→RC.1 变更 | 反馈对话框、产物卡片 |
| — | [changelog-rc1-rc2.md](v0.1.5-rc.2/changelog-rc1-rc2.md) | RC.1→RC.2 变更 | 反馈对称化、UI 精化 |

## v0.1.6-alpha.1 详细目录

> 快照基准：tag `dsh-v0.1.6-alpha.1` (`0a15e36e7f`)，对比上版 `dsh-v0.1.5-rc.2` (`fb2c4b9e69`)，800 commits。

| # | 文件 | 主题 | 本版核心 |
|---|------|------|----------|
| 01 | [01-cordis-framework.md](v0.1.6-alpha.1/01-cordis-framework.md) | Cordis 框架层 / 启动 | profile 解析不可变代际、启动失败分级、原生缓存归 addon |
| 02 | [02-core-product.md](v0.1.6-alpha.1/02-core-product.md) | Core 产品主干 | `agent/created` 改 serial、会话历史同步读取废弃、`ctx.ptcRuntime` 更名 |
| 03 | [03-shell-capabilities.md](v0.1.6-alpha.1/03-shell-capabilities.md) | Shell / 子进程 / 终端 | **新增 `packages/ssh`**、子进程双工控制管道、侧栏终端 |
| 04 | [04-llm-typer.md](v0.1.6-alpha.1/04-llm-typer.md) | LLM 能力族与 Typert | **DeepSeek 默认 Messages**、V41 目录、图片 token 网格投影 |
| 05 | [05-execution-world.md](v0.1.6-alpha.1/05-execution-world.md) | 执行世界 | **`code-runtime` → `ptc-runtime`**、受限 Node 执行、沙箱取消语义 |
| 06 | [06-memory.md](v0.1.6-alpha.1/06-memory.md) | 记忆与会话落地 | **持久化类型变更档案体系**、`compaction-image-offload`、图片卸载事件 |
| 07 | [07-multi-agent.md](v0.1.6-alpha.1/07-multi-agent.md) | 多智能体 | `ralph` 默认关闭、workflow 复用 PTC 沙箱、子代理创建语义 |
| 08 | [08-human-agent-governance.md](v0.1.6-alpha.1/08-human-agent-governance.md) | 人机协作与治理 | 命令身份拆分、权限修复、预设门控 |
| 10 | [10-gui-frontend-backend.md](v0.1.6-alpha.1/10-gui-frontend-backend.md) | GUI 前后端与桌面端 | 侧栏终端、置顶折叠头、Mermaid 全屏、归档会话恢复、`RemoteMock` |
| 11 | [11-protocol-sdk.md](v0.1.6-alpha.1/11-protocol-sdk.md) | 协议与 SDK | **MCP 官方 SDK 协商 + resources/instructions**、headless 机器可读运行面 |
| 12 | [12-engineering.md](v0.1.6-alpha.1/12-engineering.md) | 工程体系与发布 | 实验包公开发布与默认隔离闸门、持久化档案文档体系 |
| 13 | [13-browser-and-computer-use.md](v0.1.6-alpha.1/13-browser-and-computer-use.md) | **浏览器与桌面交互（新能力族）** | `ctx.browserUse` / `ctx.computerUse` 独占具名注册 |
| — | [CHANGELOG.md](v0.1.6-alpha.1/CHANGELOG.md) | **本版变更要点** | 4 新能力族 / 2 退役 / 3 默认值 / 契约变更 |
| — | [plugin-migration-guide.md](v0.1.6-alpha.1/plugin-migration-guide.md) | **插件迁移深度指南** | manifest、会话历史、解析代际、PTC 改名、E2B 退役、升级清单 |
| — | [architecture-overview.md](v0.1.6-alpha.1/architecture-overview.md) | 架构总览 | 52 组包结构、文件树、版本演进对比 |
| — | [14-post-tag-master.md](v0.1.6-alpha.1/14-post-tag-master.md) | **tag 之后的 master（未发布）** | `worktree-bootfast2` 启动提速波；快照漂移点 |

## v0.1.7-rc.1 详细目录

> 快照基准：tag `dsh-v0.1.7-rc.1` (`46a7f68b09`，2026-09-23)，对比上版 `dsh-v0.1.6-alpha.1` (`0a15e36e7f`)，**2504 commits（843 merge）｜6083 files ｜+475,425 / −133,742**。
> 顶层包组 52 → **54**；`package.json` 315 → **344**；`SESSION_FORMAT_VERSION` 3 → **4**。

| # | 文件 | 主题 | 本版核心 |
|---|------|------|----------|
| 01 | [01-cordis-framework.md](v0.1.7-rc.1/01-cordis-framework.md) | Cordis 框架层 / 启动 / profile | app-boot 拆包（新增 `dsh-hmr` / `dsh-config-editor` / `dsh-plugin-manager`）、解析后端改名（`ProfileResolutionGeneration` → `RuntimeResolution`）、profile 自有 live 配置、`--dump-config-schema` |
| 02 | [02-core-product.md](v0.1.7-rc.1/02-core-product.md) | Core 产品主干 | 一等 tool role 消息、生产者自有 source（core 内 5 处改写）、`developer/message` + `headerSeq` 全链校验、fork 放宽与 `forked`、`projectContent` + `deferLoading` |
| 03 | [03-shell-capabilities.md](v0.1.7-rc.1/03-shell-capabilities.md) | Shell / 子进程 / 终端 / SSH | **`run()` 与 `start()` 收敛为唯一 `execute()`**、前台超时提升为后台 job、用户终端权限模型、持久 pwsh 受控提示符、终端活动观察缝 |
| 04 | [04-llm-typer.md](v0.1.7-rc.1/04-llm-typer.md) | LLM 能力族与 Typert | **DeepSeek 彻底 Messages-only**（protocols 目录消失、`protocol` 键抛错）、`inputModalities` 与运行时图像能力闸门、Remote 双向流类型、凭证新包 |
| 05 | [05-execution-world.md](v0.1.7-rc.1/05-execution-world.md) | 执行世界与隔离 | **Windows ACL 强制完整性隔离**、sandbox same-mode、jobs 缝大规模收敛、spill 改 token 预算（`maxInlineBytes` → `maxInlineTokens`）、`fs.watch` 新能力 |
| 06 | [06-memory.md](v0.1.7-rc.1/06-memory.md) | 会话落地与记忆 | **V4 打开即自动迁移**（读 open 内存 `prepared`、写 open 发布后继）、native V4 关系校验（新增 `relationships.ts`）、projection cache 双重身份、compaction 预算化 |
| 07 | [07-multi-agent.md](v0.1.7-rc.1/07-multi-agent.md) | 多智能体 | Agent Teams 单一 bundle（**删除 `agent-team-web-profile`，非改名**）、子代理目录改父目录直读、可续期容量（默认 8 / 深度 1，不排队）、workflow 后台运行 |
| 08 | [08-human-agent-governance.md](v0.1.7-rc.1/08-human-agent-governance.md) | 人机协作与治理 | settings 服务整体重写（`SettingsProvider` → `SettingsForms`，`settings-file` 整包删除）、权限默认值迁回 Config、`user-questions` 加 `callId`、6 个治理插件统一 `MessageSourceMap` |
| 09 | [09-plugin-system.md](v0.1.7-rc.1/09-plugin-system.md) | **插件体系（全链）** | **整套插件管理本区间从零落地**（引导式安装状态机、安装源注册表、7 个席位、4 个伴随包）、**`engines.dsh` 无运行时读取方**、`peerDependencies` 强制校验、`patchReload` 删除 |
| 10 | [10-gui-frontend-backend.md](v0.1.7-rc.1/10-gui-frontend-backend.md) | GUI 与桌面端 | `packages/client` 53 → **59** 包、会话行菜单**扩展席位 API**、`client-modules` rev 改 mtime/ctime/size、`readBytes` 改 `Uint8Array`、桌面九项（强制更新 / NSIS / caption / vibrancy / webview / 崩溃报告） |
| 11 | [11-protocol-sdk.md](v0.1.7-rc.1/11-protocol-sdk.md) | 协议、远端与 SDK | **远端双工流**（`item`/`end` 帧、`streamInboxBytes` 默认 262144、`gateway/uplink-overflow`）、宿主独占远端输入校验、二进制工作区传输、路由门 `verify-client-route-resolution` |
| 12 | [12-engineering.md](v0.1.7-rc.1/12-engineering.md) | 工程体系、持久化评审与遥测 | 文档即契约（英文 md 167 → 176、三语 blob 哈希）、`persistence-review.ts` + inventory format 2 + `finalized/v4.json`、`no-unknown-casts` 基线 561 条目、五条新增静态门 |
| 13 | [13-browser-computer-and-voice.md](v0.1.7-rc.1/13-browser-computer-and-voice.md) | 浏览器 · 桌面操作 · 语音 | **语音输入族 5 包（全新，SenseVoice）**、`ctx.speechToText` / `ctx.speechController`、无人值守浏览器与终端回收、桌面浏览器 webview |
| 14 | [14-deliverables-document-office.md](v0.1.7-rc.1/14-deliverables-document-office.md) | 交付物与 Office 文档栈 | `deliverables` 与 `document` 两个**新顶层包组**；**`tool-present` 是搬家不是新写**（digest 未变）、真正新增是 `workspace-changes`、Office「每平台一个引擎」 |
| — | [CHANGELOG.md](v0.1.7-rc.1/CHANGELOG.md) | **本版变更要点** | 26 项变更总表 + 8 大节详解（持久化 / 插件契约 / 设置 / 新能力族 / GUI / 文档 / 工程 / 升级速查） |
| — | [plugin-migration-guide.md](v0.1.7-rc.1/plugin-migration-guide.md) | **插件迁移深度指南** | 6 项破坏性变更的证据链、迁移动作表、10 步检查清单、可复核命令 |
| — | [diff-vs-0.1.5-rc.2.md](v0.1.7-rc.1/diff-vs-0.1.5-rc.2.md) | **跨两版累积差异（0.1.5-rc.2 → 0.1.7-rc.1）** | 3304 commits 累积视角；6 张三版对照表（清单 / 设置 / 会话 / 启动 / 客户端 / 执行世界）；13 项破坏性变更按优先级排序 |
| — | [architecture-overview.md](v0.1.7-rc.1/architecture-overview.md) | 架构总览 | 54 组包结构、分层图、治理体系、版本演进三版对比、下钻路线图 |

> **本版有三个"反直觉"结论必须记住**：
> 1. **兼容性校验读 `peerDependencies`，不是 `engines.dsh`**（后者至今无运行时读取方）；
> 2. **`tool-present` 不是本版新写的**（仅从 `packages/fs` 搬家，持久化 digest 未变）；
> 3. **`agent-team-web-profile` 是整包删除而非改名**（0.1.6 时两包并存），会留下"既有 profile 启动即失败"的缺口。

## v0.1.7-rc.2 详细目录

> 快照基准：tag `dsh-v0.1.7-rc.2` (`477b4f4205`，2026-09-24)，对比上版 `dsh-v0.1.7-rc.1` (`46a7f68b09`)，335 commits（224 非 merge + 111 merge）。
> 模块级系统性结构与 rc.1 一致，14 篇编号文档沿用 rc.1 全量分析（各篇顶部"基线说明"）。

| 文件 | 主题 |
|-----|------|
| [README.md](v0.1.7-rc.2/README.md) | 更新要点（一句话总结 + 版本序列定位 + 变更分组 + Breaking Changes） |
| [CHANGELOG.md](v0.1.7-rc.2/CHANGELOG.md) | 逐提交分组（Features / Fixes / Reverted） |
| [diff-vs-0.1.7-rc.1.md](v0.1.7-rc.2/diff-vs-0.1.7-rc.1.md) | 文件热度 + 逐主题 diff（动态工具更新、providers 拆分、快捷键） |
| [plugin-migration-guide.md](v0.1.7-rc.2/plugin-migration-guide.md) | 插件迁移（结论：无迁移项） |
| [architecture-overview.md](v0.1.7-rc.2/architecture-overview.md) | 架构总览（rc.1 基线沿用） |

## v0.2.0-rc.1 详细目录

> 快照基准：tag `dsh-v0.2.0-rc.1` (`4878cdabd8`，2026-09-28)，对比上版 `dsh-v0.1.7-rc.2` (`477b4f4205`)，261 commits（167 非 merge + 94 merge）。
> 表面统计 +20374/−77957，其中 −75173 来自 `docs/persistence-schema.json` 压缩（非代码）。
> 新增 4 包（`telemetry/otel`、`client/product-analytics`、`client/ui-settings-session-log`、`experimental/schedule-bundle`），无删除无改名；`SESSION_FORMAT_VERSION` 保持 4；模块级 14 篇基线沿用。

| 文件 | 主题 |
|-----|------|
| [README.md](v0.2.0-rc.1/README.md) | 更新要点（Schedule opt-in、OTel 收口、productAnalytics、peer 世代门槛） |
| [CHANGELOG.md](v0.2.0-rc.1/CHANGELOG.md) | 逐提交分组（含 Behavior Changes 与 Reverted 专节） |
| [diff-vs-0.1.7-rc.2.md](v0.2.0-rc.1/diff-vs-0.1.7-rc.2.md) | 文件热度 + 9 个主题逐 diff + 复核命令 |
| [plugin-migration-guide.md](v0.2.0-rc.1/plugin-migration-guide.md) | **peer 范围世代门槛**（🔴 唯一必做）、Schedule 复核、`displayTitle` 空串、9 步检查清单 |
| 01–14 编号文档 + [architecture-overview.md](v0.2.0-rc.1/architecture-overview.md) | 模块基线（0.1.7-rc.1 全量分析沿用，各篇"基线说明"已注明） |

## v0.2.0-rc.2 详细目录

> 快照基准：tag `dsh-v0.2.0-rc.2` (`639ed01539`，2026-09-29)，对比上版 `dsh-v0.2.0-rc.1` (`4878cdabd8`)，187 commits（140 非 merge + 47 merge）。
> 1022 files changed, +33253/−6141；无新增/删除/改名包；`SESSION_FORMAT_VERSION` 保持 4；peer 校验 / manifest / settings 零 diff。
> 本目录**不含**编号模块文档——rc.2 没有触及任何模块的结构性结论，14 篇基线沿用 v0.2.0-rc.1。

| 文件 | 主题 |
|-----|------|
| [README.md](v0.2.0-rc.2/README.md) | 更新要点（计时提问 two-settlements、桌面 CLI 管理、ACL 单次修复、模型选择器、性能） |
| [CHANGELOG.md](v0.2.0-rc.2/CHANGELOG.md) | 逐提交分组（含 Behavior Changes 与 🔌 插件可见标记） |
| [diff-vs-0.2.0-rc.1.md](v0.2.0-rc.2/diff-vs-0.2.0-rc.1.md) | 文件热度 + 12 个主题逐 diff + 插件可见面核对 + 复核命令 |
| [plugin-migration-guide.md](v0.2.0-rc.2/plugin-migration-guide.md) | 结论：**rc.1 清单照做即可，rc.2 无新增必做项**；timed 模式 / 问题卡契约增量 / 文案适配观察点 |

## v0.2.1-alpha.1 详细目录

> 快照基准：tag `dsh-v0.2.1-alpha.1` (`5badb15009`，2026-10-03)，对比上版 `dsh-v0.2.0-rc.2` (`639ed01539`)，266 commits（201 非 merge + 65 merge）。
> 4190 files changed, +51032/−32761；**4 包新增 / 1 删除 / 1 改名**；`SESSION_FORMAT_VERSION` 保持 4；peer 校验 / manifest schema / settings 核心 / 加载器零 diff；无新增持久化承认。
> 本目录**不含**编号模块文档——14 篇基线沿用 v0.2.0-rc.1；官方升级指南 4 篇（`docs/upgrade-guide/v0.2.0-rc.2/`）是本版必做项的权威源。

| 文件 | 主题 |
|-----|------|
| [README.md](v0.2.1-alpha.1/README.md) | 更新要点（Schedule 换挂载制、mods 桥、运行时解析刷新、invariants 退场、subpath 显示换代） |
| [CHANGELOG.md](v0.2.1-alpha.1/CHANGELOG.md) | 逐提交分组（含 Packages 结构变化与 📋 官方指南标记） |
| [diff-vs-0.2.0-rc.2.md](v0.2.1-alpha.1/diff-vs-0.2.0-rc.2.md) | 13 个变更族逐 diff + 提交号链 + 复核命令 |
| [plugin-migration-guide.md](v0.2.1-alpha.1/plugin-migration-guide.md) | 三类必做项（subpath 显示迁移 / invariants 清理 / schedule bundle 收尾）+ rc.1 条目状态表 + 检查清单 |

## v0.2.1-alpha.3 / alpha.4 / alpha.5 / rc.1 / rc.2 / rc.3 / rc.4 详细目录

> 快照基准：`dsh-v0.2.1-alpha.3`（`2fbf4359b8`，2026-10-14）→ `dsh-v0.2.1-alpha.4`（`86a402200d`，2026-10-15）→ `dsh-v0.2.1-alpha.5`（`1517a4dbca`，2026-10-16）→ `dsh-v0.2.1-rc.1`（`1600d8a1e1`，2026-10-16）→ `dsh-v0.2.1-rc.2`（`687f282e86`，2026-10-17）→ `dsh-v0.2.1-rc.3`（`1f81c047fc`，2026-10-23）→ `dsh-v0.2.1-rc.4`（`504a01a957`，2026-10-26；**≠ master tip**，origin/master 现为 `f3803c9697`）；相邻 tag 间无中间 tag。各目录均为四件套（不含编号模块文档，14 篇基线沿用 v0.2.0-rc.1）。

| 目录 | 文件 | 主题 |
|---|---|---|
| `v0.2.1-alpha.3/` | [README](v0.2.1-alpha.3/README.md) · [CHANGELOG](v0.2.1-alpha.3/CHANGELOG.md) · [diff-vs-0.2.1-alpha.2](v0.2.1-alpha.3/diff-vs-0.2.1-alpha.2.md) · [migration](v0.2.1-alpha.3/plugin-migration-guide.md) | RBAC/CUA 进门；JSONL/JobId/子代理 preset/槽名四类换代；14 篇指南 |
| `v0.2.1-alpha.4/` | [README](v0.2.1-alpha.4/README.md) · [CHANGELOG](v0.2.1-alpha.4/CHANGELOG.md) · [diff-vs-0.2.1-alpha.3](v0.2.1-alpha.4/diff-vs-0.2.1-alpha.3.md) · [migration](v0.2.1-alpha.4/plugin-migration-guide.md) | **闸门换代 `engines.dsh` 独裁 + `requirements` 改名**；插件市场族；闸门双时代对照表 |
| `v0.2.1-alpha.5/` | [README](v0.2.1-alpha.5/README.md) · [CHANGELOG](v0.2.1-alpha.5/CHANGELOG.md) · [diff-vs-0.2.1-alpha.4](v0.2.1-alpha.5/diff-vs-0.2.1-alpha.4.md) · [migration](v0.2.1-alpha.5/plugin-migration-guide.md) | 账号通知契约放宽；model.label 槽；PTC 指令组合化 |
| `v0.2.1-rc.1/` | [README](v0.2.1-rc.1/README.md) · [CHANGELOG](v0.2.1-rc.1/CHANGELOG.md) · [diff-vs-0.2.1-alpha.5](v0.2.1-rc.1/diff-vs-0.2.1-alpha.5.md) · [migration](v0.2.1-rc.1/plugin-migration-guide.md) | 纯 bump；含 **0.2.0-rc.2 → 0.2.1-rc.1 全程缝隙总账** |
| `v0.2.1-rc.2/` | [README](v0.2.1-rc.2/README.md) · [CHANGELOG](v0.2.1-rc.2/CHANGELOG.md) · [diff-vs-0.2.1-rc.1](v0.2.1-rc.2/diff-vs-0.2.1-rc.1.md) · [migration](v0.2.1-rc.2/plugin-migration-guide.md) | DeepSeek Search/Fetch API + 1017 徽章（model.label 槽首个官方 occupant）；契约面零断裂（provider 钉选 volatile 化见 README 观察点 #5） |
| `v0.2.1-rc.3/` | [README](v0.2.1-rc.3/README.md) · [CHANGELOG](v0.2.1-rc.3/CHANGELOG.md) · [diff-vs-0.2.1-rc.2](v0.2.1-rc.3/diff-vs-0.2.1-rc.2.md) · [migration](v0.2.1-rc.3/plugin-migration-guide.md) | 导航条目自定义（新包 ui-entry-customization；三域 pins/隐藏/More，slot +3）；**New Session 空白复用（官方指南 1 篇，签名不变语义变）**；DeepSeek 跟官方 /models listing |
| `v0.2.1-rc.4/` | [README](v0.2.1-rc.4/README.md) · [CHANGELOG](v0.2.1-rc.4/CHANGELOG.md) · [diff-vs-0.2.1-rc.3](v0.2.1-rc.4/diff-vs-0.2.1-rc.3.md) · [migration](v0.2.1-rc.4/plugin-migration-guide.md) | 纯修复车：页签 tooltip 估算溢出才挂 + More 文案静态化（locale 键 moreViewsCurrent 删）；ACP stdout 保留（账号诊断→stderr；MCP 未宣告 resources 列表短路）；**契约面/docs 整目录零 diff**，指南 0 篇 |

## 原始来源

- 源码快照: `deepseek-harness/` 各 tag（本地已 fetch 至 **`dsh-v0.2.1-rc.4`**（`504a01a957`，2026-10-26；origin/master tip `f3803c9697` 更晚且未发版，不入分析边界）；历史分析 worktree 已清理，逐 tag 直读用 `git show|grep <tag>`，对象库含 dsh-v0.2.1-alpha.1..rc.4 全 tag）
- Git tags: `dsh-v0.1.0-rc.7` ~ `dsh-v0.2.1-rc.4`
- **跨版本综述**: `roadmap-0.1.5-to-0.1.7-rc.2.md`（0.1.5 → 0.1.6 → 0.1.7-rc.2 三阶段必要性总述）；`v0.2.1-rc.1/README.md` 内含 0.2.1 线缝隙总账；`v0.2.1-alpha.3/` 起为最新增量目录链
- 侦察底稿: `_analysis_output/dsh016/RECON.md`（0.1.5-rc.2 → 0.1.6-alpha.1）、**`_analysis_output/dsh017/`**（`BRIEF.md` 写作规范 + `notes-added.txt` 区间新增 note 全清单 + `notes-index.txt`）
- 原始文章: `详解/ 第01-12篇`
- 项目文档: `项目架构总览.md`、`模块详解模板.md`

### 本轮（v0.1.7-rc.1）的核实口径

- 所有数字来自对 `deepseek-harness` 检出的**实测命令**（`git diff --shortstat` / `--name-status` / `git rev-list --count` / `git ls-tree`），命令清单内联在各篇文末。
- 官方一手材料优先级：`docs/subsystems/*`（子系统权威页）> `docs/persistence-changes/*`（持久化契约 + schema）> `.agents/notes/implemented/*`（设计依据）> 包 README > 代码。
- **`implemented/` 与 `proposed/` 严格区分**：本轮共发现 6 篇被误当作已落地的 `proposed` note（`config-only-hmr`、`python-sdk-directional-client`、`shell-env-key-declarations`、`retire-prompt-registry-change-event`、`omit-fs-payload-invariant`、`trim-session-query-convenience-api`），均已在对应篇目显式标注为提案。
- **行数统计口径**：本机 shell 实为 Windows PowerShell 5.1，`Get-Content | Measure-Object -Line` 与 `(Get-Content).Count` 读取含非 ASCII 的 UTF-8 无 BOM 文件会少算行数；请用 `[System.IO.File]::ReadAllLines($p).Count` 或 `git diff --numstat`。
- 各篇文末均设有"未核实项"清单；`12-engineering.md` 的未核实项经二次补做后从 6 条收窄到 4 条。

---

*最后更新: 2026-10-28（补拉 `dsh-v0.2.1-rc.4` tag（`504a01a957`），新增 rc.4 四件套 + rc.3↔rc.4 配对探针 14 列全等实证；上一轮 2026-10-24 补拉 rc.3 并建 rc.3 四件套）*
