# DSH v0.2.0-rc.2 CHANGELOG（dsh-v0.2.0-rc.1 → dsh-v0.2.0-rc.2）

> 187 commits（140 非 merge + 47 merge）｜ 2026-09-24 ~ 2026-09-29 ｜ 发布 PR #5479
> 标记：⭐ 新能力面 ｜ ⚠️ 行为变化 ｜ 🔌 插件可见
> 结构：无新增/删除/改名包；`SESSION_FORMAT_VERSION` 保持 4；peer 兼容性校验零 diff

## Features

- **feat(user-questions): support timed waits and late replies**（`3a296b16b4` 主提交，+ `edd0660b5d`、`b6401085cb`、`f52099515e`、`8b9b7307ea`、`f04ad05f30`、`511b18e322`、`8430907d22`、`0c4498ac42`、`fc30c5a7d2`、`690239c510`、`24226a7164`、`1840297173`、`1c6c462633`、`050944fc8e`、`ed34a1d7fe`、`a0ad129252`、`fa70937848` 等）
  `tool-ask-user` Cordis 行新增 `Config { mode?: 'legacy' | 'timed', timeout?: number }`（默认 `legacy` + 120s）。timed 模式（`askTimed()`）两段结算：前台瀑布流超时返回 pending（`ASK_TIMED_OUT`），迟到回答走 `answer(agent, callId, answer)` RPC → `agent.steer()` durable user 消息（source `{ kind: 'user-question-reply', callId, outcome: 'answered' }`）；新增 `userQuestions` projection（含 PTC 子调用 pending 识别）与重复回复守卫 `REPLY_QUEUED`。配套新持久化承认 `2026-09-21-user-question-reply`（same-version，见下 Behavior Changes）。决策记录：`.agents/notes/implemented/architecture/2026-09-19-timed-user-question-two-settlements.md`。
- **feat(desktop): manage the installed dsh command from native menus**（PR #5288 `1de97d1c10`：`5f99386fa8`、`ac88033f4c`、`fa9586824e`、`fb94237085`、`d1e05324ea`、`9c8f5c2bf3`、`ae4f3546ae`、`d796ae1efd`、`5670a14646`、`0677288518`、`386487ec66`、`05c0687372`、`a01f2444c3`、`0e5ab65758`、`6863e7fe9b`、`e21ed97f29`）
  原生菜单提供 bundled CLI 安装/修复/回滚；PATH 目录只暴露 `dsh`；CLI 注册改为**安装后菜单动作**；Windows 控制台信号送达 CLI 处理器。
- **feat(desktop): 启动时读取用户登录 shell 环境**（PR #5393 `4f26143bf2`）——桌面启动注入登录 shell 环境变量。
- 🔌 **feat(client): 模型选择器模糊搜索 + 粘性分组头**（`6773e10645`、`989b93d86f`、`78bc78d48c`、`18a548a56b`、`b29578b8f0`、`75ea006f4c`、`b3d6da9083`、`45368fb158`、`bfec75eb14`、`3ec8cd925d`）
  composer 模型菜单搜索 + 分组排序统一 + 粘性头（粘性检测不做 layout 读）；`ui-primitives` 新增 `MenuGroup`，`ui-commands` 新增 `option-groups.ts`，`ui-model-selection` 新增 `provider-order.ts`。
- **feat(web): open the workspace from the sidebar file tree**（PR #5314 `afadb61008`：`be0e31233c`、`35002626a1`、`171c9e9225`、`41021fc803`）——侧栏文件夹"打开"按钮，复用 path-based open-in-app。
- **feat(schedule): frame due reminders as scheduled user messages**（PR #5137，`af39300572` + 8 docs commits）——one-shot 与 recurring 共用 `SCHEDULED_MESSAGE_FRAMING` 起始行 "This is a scheduled message from the user"；括号标记与 JSON 动态字段不变。
- **fix(windows): diagnose and repair ACL failures in one run**（PR #5432 `7cecc72cae`：`ab0195f802`、`4f96bc18df`、`58f64d0117`、`fd5e89feb7`、`e0c194cfe1`、`5329de143a` + docs/test）
  `sandbox-windows-acl` 技能单次运行完成诊断+修复；修复对照目标对象自身 ACE 校验；报告截断后可读；子树扫描后再分类。
- **fix(cordis): bound Client inspect queries and retain failures**（PR #5409 `6bb3d8becf`：`f0e97fb7bc`、`10a4a17ccc`、`657b8622c1`）——inspect 查询限时（`clientInspectTimeoutMs`）、失败保留、离线跳过。
- **fix(desktop): add fixed latest installer upload commands**（`aaceea0554`、`9ff76e66b3`）——固定版本安装器上传（含 Windows 凭据支持）。

## Behavior Changes（⚠️ 非 API breaking）

- ⚠️ 🔌 **`ask_user_question` 新增 timed 行配置**：`mode: 'timed'` 才切换工具 schema 与 `askTimed()` 路径；**默认组合仍注册 legacy 阻塞工具**（`a68ecdefc4` 保留 master legacy schema、`daec283261` 默认定义原地不动），未启用的安装行为与 rc.1 完全一致。
- ⚠️ **新持久化承认 `2026-09-21-user-question-reply`**（same-version）：`event:user/message` 等 4 个 root 登记新消息 source `{ kind: 'user-question-reply', … }`。无新事件类型、无会话头变化；旧日志有效；无 `dsh-user-questions` 的读者保留消息并从内容推导历史。
- ⚠️ **Schedule 到期提醒首行文案变化**：统一为 "This is a scheduled message from the user"。解析 reminder 消息文本的脚本/e2e 需适配。
- ⚠️ **设置页预设切换与 Creator 入口解禁**（PR #5449 `e8a777fb32`：`3442930ebf`、`3c17f569da`）——不再受"代码工作工具"开关限制。
- ⚠️ **UI 插件管理页升级引导**：改为"重装以升级"（`de1ec63678`），shipped bundle 与不兼容升级分开措辞（`05c891200c`），已装不兼容插件引导重装兼容版本（`93996db3c7`）。
- ⚠️ **LLM 目录升级**：pi-ai 0.87.1（`6ed596f71b`），Mistral 纳入兼容性类型检查（`c73b80b1ea`），允许空 compatibility guard 成员（`28648ffb6b`）。
- 🔌 **客户端问题卡契约增量扩展**（`ui-user-questions/contract/slots.ts`）：`PendingQuestion` 新增 `waitState` / `countdown` / `channel` / `dismissal` 字段，拒绝码枚举新增 `ASK_TIMED_OUT`。全部为增量，无字段删除。
- **shell 提示强化**：提醒 agent 在删除/移动前核对 resolved path（`1a50c05170`）；**pwsh** 接受 ASCII 填充的完成状态行（`4b7a45d154`）。
- **Web 体验杂项**：无赠金时隐藏设置页赠金行（`8671d30583`、`30a3913397`）；空白会话同步暂缓（`3825706a15`，提交信息明确标注）；聊天时长/主题/快捷键微调（`ad008e2ea5`）。

## Fixes（精选）

- **perf(client): 长会话渲染与鲸鱼动画降开销**（PR #5456 `fe5b4da6f5`：`6a0f36cdea`、`bb7455da04`、`167fea0723`、`e4aa508e35`）——`running-whale@2x.png` 构建期内联进 CSS；长会话 transcript 渲染与输入开销降低；可访问性保持。
- **fix(user-questions): 竞态与恢复**（`ed34a1d7fe` 重载后排队回复保持只读；`fc30c5a7d2` timed 回复可恢复；`edd0660b5d` 继续回复经入场保留；`0c4498ac42` 竞争性恢复 claim 覆盖；`fa70937848` 排队 plan reply 隐藏失败覆盖）。
- **fix(desktop): CLI/安装器可靠性**（`e21ed97f29` Windows 控制台信号；`5670a14646` 回滚保留 symlink 身份；`0677288518` 备份先声明再恢复；`d1e05324ea` CLI 准入绑定当前安装；`dbf31101d8` Intel Node 可执行内存签名 entitlement）。
- **fix(workspace-files)**: 缺失文件 watcher 分阶段上报（`a1e6ded917`）；**fix(sidebar-right)**: on-screen Session 命名与 auto-fullscreen 规则归位（`ebb6b03378`、`4ccf48c4ef`）；**fix(web)**: pending plan reviews 跨 Sidebar seat 切换可打开（`9a2f353813`）、steering dock 隐藏行注释修正（`9ed5d6db5f`）。
- **fix(queuedock)**: 折叠态动作（PR #5438 `2d15b9b3e7`）。

## Docs / 工程面

- **升级指南体系**：结构 + skill + gate（PR #5389 `17da46e4f3`：`23d3807ae1`）；升级指南**双语化**并删除 OTel 指南（`61d4ab0b6c`）；v0.1.7-rc.2 指南回填（`9126818b7f`）。
- **测试基建**：vitest lane 预算独立于负载（`333d7e75d2`、`3e38e2118c`、`0976d15122`、`9ab3f2c990`）；pwsh readiness timeline（`fc885edf72`，+354 行）；HMR 测试等待 live native watch（`7d3c9750e6`、`c194143fef`）；PTC 后台作业发布等待（`23706d7ff9`）；CI 信号陷阱先于 readiness 报告（`2b6d046f32`）；proxy opt-in 对齐（`374f7df31b`）；插件拦截证据与术语澄清（`4b19616206`）。
- **持久化 schema**：`docs/persistence-schema.json` 重新生成（+36k，timed question 类型清单）；`docs/persistence-catalog` / `config-catalog` / `subsystems/user-questions` 同步。
- 社区：中文 README 社区入口简化（`f84703543c`）；过期 Discord 邀请修复（`31ba15da2b`）。

## Reverted（窗口内落地后撤回）

- ↩️ `d0c721b3f1` "test(desktop): set installer paths through the Unicode control helper"（revert `f50b6db1c1`，测试辅助代码，非功能主线）。
