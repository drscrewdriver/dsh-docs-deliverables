# Bug 讨论增量 — #5886–#6442

> 生成时间：2026-09-12　|　数据源：136 篇新增 Bug 类讨论
> 基线：`bug-discussions-full.md`（截至 #5885）

## 按正文长度排序（内容充实度 = 可复现性代理指标）

| # | 标题 | Category | 正文 | 评论 |
|---|---|---|---|---|
| [#6252](https://github.com/deepseek-ai/deepseek-harness/discussions/6252) | [BUG]升级到0.1.5-rc.1后原有会话无法正常读取和显示，报错提示原session中缺少surfaceOp | General | 108153 | 3 |
| [#6196](https://github.com/deepseek-ai/deepseek-harness/discussions/6196) | [BUG] dsh web 启动到打印 URL 约 18s，其中约 9.3s 来自 client-modules 每次启动重复 8 次全量重建组合包 | General | 21748 | 1 |
| [#6300](https://github.com/deepseek-ai/deepseek-harness/discussions/6300) | [Bug][0.1.5-rc.1]畸形 tool-call（空 id/name）被持久化进会话日志，导致会话永久不可恢复（每次回放 400 `missing field tool_call_id`） | General | 19659 | 1 |
| [#6201](https://github.com/deepseek-ai/deepseek-harness/discussions/6201) | [Bug] dsh web 0.1.5-rc.1: silent process death (0xC0000409) loses in-flight turns - 12 deaths / 8 da | General | 19075 | 1 |
| [#6328](https://github.com/deepseek-ai/deepseek-harness/discussions/6328) | [Bug] One unmigratable v0 artifact (subagent/descriptor v2) disables all content search | General | 16491 | 0 |
| [#6155](https://github.com/deepseek-ai/deepseek-harness/discussions/6155) | [Bug] Continuing web session loses 25 native tools and matching prompt sections between turns | General | 15578 | 0 |
| [#5909](https://github.com/deepseek-ai/deepseek-harness/discussions/5909) | [Bug] Broken sessions and v0→v1→v2 Migration Failure / 会话损坏及 v0→v1→v2 迁移失败 | General | 14290 | 12 |
| [#5910](https://github.com/deepseek-ai/deepseek-harness/discussions/5910) | [Bug] Commands/list Flood Pins CPU / 自持式 commands/list 洪泛占满 CPU | General | 14095 | 0 |
| [#6403](https://github.com/deepseek-ai/deepseek-harness/discussions/6403) | [Bug] workspace-write 沙箱下一切 schannel TLS 失败（受限令牌 restricting SID 导致 SSPI 无凭据） | General | 12565 | 0 |
| [#6277](https://github.com/deepseek-ai/deepseek-harness/discussions/6277) | [Bug] session/fork inherits the source's pending inbox — a branch's first new message is answered as | General | 11989 | 1 |
| [#6225](https://github.com/deepseek-ai/deepseek-harness/discussions/6225) | [Bug] PM2 托管下 `dsh web` 静默空转：PM2 的 fork 容器用 `import()` 加载 `bin.ts`，`import.meta.main` 为 false（online | General | 11248 | 0 |
| [#6092](https://github.com/deepseek-ai/deepseek-harness/discussions/6092) | Bug: mux heartbeat kills a healthy browser WebSocket (endless ~10s reconnect loop) | General | 10961 | 1 |
| [#6218](https://github.com/deepseek-ai/deepseek-harness/discussions/6218) | Bug: reasoning-only completions are reported as successful - the EMPTY_RESPONSE guard tests order.le | Q&A | 10638 | 1 |
| [#5920](https://github.com/deepseek-ai/deepseek-harness/discussions/5920) | [Bug] /compact fails forever after a plugin writes a marker with null turn/step | General | 9588 | 2 |
| [#6001](https://github.com/deepseek-ai/deepseek-harness/discussions/6001) | [Bug] Cross-process cold attach: observeSession/promote commits crash-repair closers against a sessi | General | 8887 | 0 |
| [#6197](https://github.com/deepseek-ai/deepseek-harness/discussions/6197) | [Bug] 分叉（fork）会继承父会话"已入队未执行"的消息并在子会话自动重跑，且没有任何干预窗口 | General | 8588 | 2 |
| [#6336](https://github.com/deepseek-ai/deepseek-harness/discussions/6336) | [Bug] Pending inbox queue is inherited by forked sessions, so stale prompts get re-sent 排队输入跨会话泄漏 —— | General | 8419 | 0 |
| [#6052](https://github.com/deepseek-ai/deepseek-harness/discussions/6052) | [Bug] Web composer: Lexical error #14 (infinite transform loop) and amber/missing text when typing a | General | 7939 | 0 |
| [#6438](https://github.com/deepseek-ai/deepseek-harness/discussions/6438) | [Bug] "Show in File Explorer" on Windows reveals the file in an invisible window (and never reveals  | General | 7499 | 1 |
| [#6157](https://github.com/deepseek-ai/deepseek-harness/discussions/6157) | [Bug] Plugin slash-command output is invisible when the command is the first action in a blank sessi | General | 7335 | 0 |
| [#6441](https://github.com/deepseek-ai/deepseek-harness/discussions/6441) | [Bug][WSL2] dsh web freeze: sync reverse DNS in flock libc probe (missing excludeNetwork) | General | 7332 | 0 |
| [#6298](https://github.com/deepseek-ai/deepseek-harness/discussions/6298) | [Bug] 改写 cordis.patch.yml 触发热重载，静默销毁所有存活会话的在途回合（aborted/disposed） | General | 7282 | 0 |
| [#6314](https://github.com/deepseek-ai/deepseek-harness/discussions/6314) | [Bug][0.1.5-rc.x] Fork 出的会话发送新消息时重放源会话旧 prompt（A），新 prompt（B/C）永久滞留队列不执行 | General | 7276 | 3 |
| [#6231](https://github.com/deepseek-ai/deepseek-harness/discussions/6231) | [Bug] Web composer stuck in IME composition — Enter stops submitting, keystrokes duplicate (Windows  | Q&A | 7072 | 1 |
| [#6349](https://github.com/deepseek-ai/deepseek-harness/discussions/6349) | [Bug] Windows：「在本地打开」不打开目录，反而把已打开的目录窗口隐藏 | General | 6982 | 0 |
| [#6288](https://github.com/deepseek-ai/deepseek-harness/discussions/6288) | [Bug] 版本0.1.5-rc.1 Windows 沙盒下原生命令输出无法被 PowerShell 变量捕获（静默返回空值 + 0xC0000142 弹框） | General | 6948 | 1 |
| [#6147](https://github.com/deepseek-ai/deepseek-harness/discussions/6147) | [Bug] Forked session inherits the parent's queued next message and runs it as a phantom turn | General | 6644 | 0 |
| [#6227](https://github.com/deepseek-ai/deepseek-harness/discussions/6227) | [Bug] dsh-client-connection@0.1.5-rc.1 fix(client-connection): register() resolves webServer without | General | 6572 | 5 |
| [#5998](https://github.com/deepseek-ai/deepseek-harness/discussions/5998) | [Bug] Minimal preset: persistent pwsh input corrupted at console-width wrap boundaries (`Write-Outpu | General | 6181 | 0 |
| [#6226](https://github.com/deepseek-ai/deepseek-harness/discussions/6226) | Bug: subagent-codex runs intermittently never settle - the child completes its turn and exits, but t | Q&A | 6042 | 1 |
| [#6262](https://github.com/deepseek-ai/deepseek-harness/discussions/6262) | [Bug Report] session.fork 的 seed 多带一条 user prompt：turn/end 与下一个 turn/start 之间的事件被扫进子会话，子会话重跑父会话的下一条任 | Q&A | 5905 | 1 |
| [#6246](https://github.com/deepseek-ai/deepseek-harness/discussions/6246) | [Bug] 远程 Web 界面混用浏览器与服务端时钟，导致对话、后台任务、子智能体耗时及定时任务逾期提示错误（0.1.5-rc.1 / rc.2） | General | 5898 | 0 |
| [#5984](https://github.com/deepseek-ai/deepseek-harness/discussions/5984) | [Bug] `ensure-project-dir` bypasses the fs seam (host `node:fs.mkdir` on a remote workspace cwd) | Q&A | 5843 | 7 |
| [#6084](https://github.com/deepseek-ai/deepseek-harness/discussions/6084) | Bug: Web GUI "Load earlier" silently no-ops and gets permanently stuck on long sessions (`request-pr | General | 5775 | 1 |
| [#6219](https://github.com/deepseek-ai/deepseek-harness/discussions/6219) | [Bug] 会话 token 计数不含 teammates：一次 Agent Teams 运行实测低估 2.3×（17.8M vs 41.1M） | Q&A | 5671 | 0 |
| [#6260](https://github.com/deepseek-ai/deepseek-harness/discussions/6260) | [Bug]dsh删了我的文件,如果反馈有帮助，希望可以修复。 | General | 5618 | 0 |
| [#6278](https://github.com/deepseek-ai/deepseek-harness/discussions/6278) | [Bug] 含"被中断轮次"（缺 turn/end）的历史会话升级后无法打开：v2→v3 迁移报 turn/start N does not open expected turn N-1 ｜ Sess | General | 5599 | 0 |
| [#6297](https://github.com/deepseek-ai/deepseek-harness/discussions/6297) | [BUG] v0→v1 迁移拒绝 0.1.0 / 0.1.1 写出的 v0 会话：subagent/descriptor v2 与 permission/preset 的 origin | General | 5494 | 1 |
| [#6311](https://github.com/deepseek-ai/deepseek-harness/discussions/6311) | [BUG] v2→v3 会话迁移对插件自定义的 message source kind 直接拒载，导致旧会话永久无法加载 | General | 5395 | 3 |
| [#6209](https://github.com/deepseek-ai/deepseek-harness/discussions/6209) | [Bug]: Windows native Job subprocess flashes console windows under console-less GUI hosts | General | 5314 | 1 |
| [#6184](https://github.com/deepseek-ai/deepseek-harness/discussions/6184) | [Bug] /compact reports transport failures as "could not produce a useful summary" | General | 5274 | 0 |
| [#6406](https://github.com/deepseek-ai/deepseek-harness/discussions/6406) | [BUG] selectCompactableRange compares a real-window token budget against heuristic node prices | Q&A | 5234 | 1 |
| [#6182](https://github.com/deepseek-ai/deepseek-harness/discussions/6182) | [Bug] Windows: revealNativePath never shows a window, and opens the Desktop instead of the target fo | General | 5176 | 0 |
| [#6264](https://github.com/deepseek-ai/deepseek-harness/discussions/6264) | [Bug] 摘要调用丢失 reasoningEffort，导致 /compact 在 provider 默认档位不被支持时必然失败，并被报成「could not produce a useful su | General | 5095 | 0 |
| [#6409](https://github.com/deepseek-ai/deepseek-harness/discussions/6409) | [Bug] Web sessions (agent preset) expose `subagent_fork` but not `subagent` (spawn) — tool is config | General | 5072 | 1 |
| [#6064](https://github.com/deepseek-ai/deepseek-harness/discussions/6064) | Bug: directory-specifier loader rows fail every DeepSeek request with REQUEST_EXTENSION | General | 5019 | 3 |
| [#6123](https://github.com/deepseek-ai/deepseek-harness/discussions/6123) | [Bug] update_goal blocked 接受未经验证的"上下文预算已耗尽"：自主轮次缺少非 blocker 收尾出口 | General | 4985 | 5 |
| [#6259](https://github.com/deepseek-ai/deepseek-harness/discussions/6259) | [Bug] revealNativePath ("Show in File Explorer") silently fails for non-ASCII/CJK paths on Windows | General | 4851 | 3 |
| [#6275](https://github.com/deepseek-ai/deepseek-harness/discussions/6275) | [Bug][Windows] 在 ACL 受限令牌沙箱下 Ninja 永久挂起：子命令已执行完毕，但 Ninja 永不退出 | General | 4839 | 0 |
| [#6437](https://github.com/deepseek-ai/deepseek-harness/discussions/6437) | [Bug] dsh-client-resources 的 protocolOf 依赖 new URL().hostname，Edge 129 下文件预览显示“文件资源服务不可用” | General | 4713 | 1 |
| [#6102](https://github.com/deepseek-ai/deepseek-harness/discussions/6102) | [Bug] dsh 0.1.2-rc.1 + V4.1：reasoning 正常但正文 content 未落地（合并后仍复现；V4-Pro 9/14 起全量路由） | General | 4644 | 1 |
| [#6376](https://github.com/deepseek-ai/deepseek-harness/discussions/6376) | [BUG] An agent acted on an instruction the user never sent, and the assembled prompt is not recorded | General | 4514 | 5 |
| [#6377](https://github.com/deepseek-ai/deepseek-harness/discussions/6377) | [BUG] An agent acted on an instruction the user never sent, and the assembled prompt is not recorded | General | 4514 | 1 |
| [#6378](https://github.com/deepseek-ai/deepseek-harness/discussions/6378) | [BUG] An agent acted on an instruction the user never sent, and the assembled prompt is not recorded | General | 4514 | 1 |
| [#5905](https://github.com/deepseek-ai/deepseek-harness/discussions/5905) | [Bug] A misbehaving MCP server can hang the app forever while listing its tools | General | 4505 | 2 |
| [#6400](https://github.com/deepseek-ai/deepseek-harness/discussions/6400) | [Bug] Directory picker is a silent no-op on Windows Session-0 service deployments (fix: pin -browse) | General | 4431 | 2 |
| [#6402](https://github.com/deepseek-ai/deepseek-harness/discussions/6402) | [Bug] 「在新对话中分支」会把分叉点之后的下一条用户消息带进新会话，并在新会话里重新执行它 | General | 4412 | 1 |
| [#6099](https://github.com/deepseek-ai/deepseek-harness/discussions/6099) | [Bug][Windows] skill-filesystem watcher can hit a high-CPU rename-event storm on a custom Codex skil | General | 4375 | 3 |
| [#6185](https://github.com/deepseek-ai/deepseek-harness/discussions/6185) | [BUG] 0.1.5-rc1 旧版本创建的preset加载错误 | General | 4374 | 1 |
| [#6223](https://github.com/deepseek-ai/deepseek-harness/discussions/6223) | [Bug] /compact says a compaction is active when the agent is simply mid-turn | Q&A | 4354 | 0 |
| [#6362](https://github.com/deepseek-ai/deepseek-harness/discussions/6362) | # [BUG]在Chromium版本<122时，Web shell无法启动：ui-sidebar-documentpreview中的eagerly-evaluated pdf.js会中止插件加载 | General | 4272 | 0 |
| [#6407](https://github.com/deepseek-ai/deepseek-harness/discussions/6407) | [Bug] Session log becomes permanently unloadable after interrupt + background-job resume: "corrupt s | General | 4164 | 3 |
| [#6272](https://github.com/deepseek-ai/deepseek-harness/discussions/6272) | [Bug] 桌面打包 prepare:dsh 必然失败：烟雾测试仍在 require 已被替换的 fs-ext | General | 4120 | 1 |
| [#6169](https://github.com/deepseek-ai/deepseek-harness/discussions/6169) | [Bug] goal-round-driver 无时间节流：轮次按「回合结束」触发，等待外部时钟的目标会在分钟级耗尽 maxGoalRounds 预算 | General | 4032 | 0 |
| [#6059](https://github.com/deepseek-ai/deepseek-harness/discussions/6059) | [Bug] Runaway tool-call arguments consume the full output budget before validation | General | 4014 | 9 |
| [#6221](https://github.com/deepseek-ai/deepseek-harness/discussions/6221) | Bug: a settings write deletes an external edit that added a key inside the namespace it writes (stil | Q&A | 3994 | 0 |
| [#6217](https://github.com/deepseek-ai/deepseek-harness/discussions/6217) | Bug: Web GUI file preview shows "file resource service unavailable" on Chromium <= 125 — protocolOf( | Q&A | 3965 | 0 |
| [#6372](https://github.com/deepseek-ai/deepseek-harness/discussions/6372) | [Bug] 0.1.5-rc.2 桌面端 prepare:dsh 必然失败：payload smoke 断言已被移除的 fs-ext，无法产出 resources/dsh | General | 3919 | 3 |
| [#5963](https://github.com/deepseek-ai/deepseek-harness/discussions/5963) | Bug: invalid stored llm-pi-ai section silently breaks Settings -> Models "Add provider" | General | 3795 | 0 |
| [#5917](https://github.com/deepseek-ai/deepseek-harness/discussions/5917) | [Bug] Saving a tool's image result can hang the session forever: no timeout on the storage step | General | 3781 | 2 |
| [#5954](https://github.com/deepseek-ai/deepseek-harness/discussions/5954) | [Bug] 内置目录刷新后，settings 里引用的孤儿模型令 llm-pi-ai 整体激活失败（静默），Web 模型选择器只剩内置 DeepSeek 组 // hand-declared mode | General | 3558 | 0 |
| [#6171](https://github.com/deepseek-ai/deepseek-harness/discussions/6171) | [Bug] Windows 桌面端：agent 每次执行命令都会弹出控制台黑窗（0.1.5-rc.1 回归） | General | 3537 | 0 |
| [#6140](https://github.com/deepseek-ai/deepseek-harness/discussions/6140) | [Bug] Web UI 长任务运行几十分钟后停止更新，重启后显示已完成（0.1.2-rc.1，附持久化日志时间线） | General | 3504 | 0 |
| [#6327](https://github.com/deepseek-ai/deepseek-harness/discussions/6327) | [Bug]session.fork 切点跨过排队中的 user/message：子会话被塞进下一轮的用户输入 | General | 3440 | 0 |
| [#6172](https://github.com/deepseek-ai/deepseek-harness/discussions/6172) | 【BUG】dsh web GUI 内存泄漏问题报告 | General | 3419 | 0 |
| [#6189](https://github.com/deepseek-ai/deepseek-harness/discussions/6189) | [BUG] 0.1.5-rc.1 会话历史永久无法加载:v0→v1 拒绝已发布的 v0 形状(permission/preset 带 origin) | General | 3411 | 2 |
| [#6316](https://github.com/deepseek-ai/deepseek-harness/discussions/6316) | [Bug][0.1.5-rc.1] Cold session list titles seeded sessions with the workspace folder name until each | Q&A | 3402 | 1 |
| [#6145](https://github.com/deepseek-ai/deepseek-harness/discussions/6145) | [Bug] settings overlay / omitted inputModalities marks vision models as text-only (UI: 当前模型不支持图片) | General | 3308 | 0 |
| [#6061](https://github.com/deepseek-ai/deepseek-harness/discussions/6061) | [Bug] 桌面端（dev:desktop / 打包版）在 macOS 上 ⌘V 粘贴失效，导致无法输入 API Key 配置模型 | General | 3155 | 0 |
| [#5964](https://github.com/deepseek-ai/deepseek-harness/discussions/5964) | [Bug] WSL 下启动的 dsh，「在应用中打开」无法唤起 VS Code / 资源管理器（应用目录表缺少 WSL 感知） | General | 3072 | 1 |
| [#6192](https://github.com/deepseek-ai/deepseek-harness/discussions/6192) | [BUG] 行尾处理：read 把「仅 CR 换行」的文件算成 1 行；edit 把「首 4KB 无换行」的 CRLF 文件整份改写成 LF | General | 3022 | 0 |
| [#6107](https://github.com/deepseek-ai/deepseek-harness/discussions/6107) | [Bug] TOOL_OUTCOME_UNKNOWN / TOOL_NOT_STARTED 合成结果缺少恢复语义：用户与模型都误判为真实工具失败（0.1.5-rc.1） | General | 2993 | 3 |
| [#6106](https://github.com/deepseek-ai/deepseek-harness/discussions/6106) | [Bug] web_search 每条查询各发一次独立计费请求，叠加子代理嵌套后单会话 854 次请求并耗尽余额 | Q&A | 2913 | 1 |
| [#6154](https://github.com/deepseek-ai/deepseek-harness/discussions/6154) | [Bug] Web 交付卡片的「在文件资源管理器中显示」只创建隐藏窗口（Windows） | General | 2910 | 0 |
| [#6269](https://github.com/deepseek-ai/deepseek-harness/discussions/6269) | [Bug] 启用带连字（ligature/calt）的字体后，Web 输入框开头字符不显示 | General | 2805 | 0 |
| [#5926](https://github.com/deepseek-ai/deepseek-harness/discussions/5926) | [Bug] connection fails to start when a third-party plugin registers an HTTP channel: cannot get prop | General | 2761 | 6 |
| [#5907](https://github.com/deepseek-ai/deepseek-harness/discussions/5907) | Bug: Chat view freezes after loading earlier history — root cause found, fix branch ready | General | 2744 | 1 |
| [#6283](https://github.com/deepseek-ai/deepseek-harness/discussions/6283) | [Bug][0.1.2-rc.1] Seeded continuation writer restarts at a regressed seq counter (duplicate/off-by-N | General | 2691 | 0 |
| [#6427](https://github.com/deepseek-ai/deepseek-harness/discussions/6427) | [Bug][性能] 0.1.5-rc.2 Web UI 空闲态主线程占用约 50%、布局约 144 次/秒（≈每帧一次），拖拽窗口 resize 明显卡顿 | General | 2678 | 2 |
| [#6162](https://github.com/deepseek-ai/deepseek-harness/discussions/6162) | [Bug Report] 会话接续后，后台子代理的完成报告仍投递给旧会话；父会话不在册时通知被静默丢弃 | General | 2580 | 0 |
| [#6082](https://github.com/deepseek-ai/deepseek-harness/discussions/6082) | [Bug] 0.1.5-alpha.2: published dsh-client-store omits Zustand/Immer runtime dependencies | General | 2520 | 3 |
| [#6295](https://github.com/deepseek-ai/deepseek-harness/discussions/6295) | [Bug][SDK 0.1.5-rc.2] Persisted session resume fails after runtime restart | General | 2520 | 0 |
| [#6282](https://github.com/deepseek-ai/deepseek-harness/discussions/6282) | [Bug][0.1.5-rc.2] Reader rejects all 0.1.2-rc.1-written sessions: header isSeeded must be a boolean | General | 2496 | 0 |
| [#6133](https://github.com/deepseek-ai/deepseek-harness/discussions/6133) | [Bug] Locale `fr-be` (Belgian French) incorrectly served as Belarusian (`be`) UI | General | 2460 | 0 |
| [#6010](https://github.com/deepseek-ai/deepseek-harness/discussions/6010) | [Bug] V2→V3 迁移拒绝含"中断轮次重启"的 v2 会话：turn/start N+1 does not open expected turn N（附根因与修复） | General | 2458 | 3 |
| [#5983](https://github.com/deepseek-ai/deepseek-harness/discussions/5983) | [Bug] Custom providers are hidden and cannot be added in web UI (`llm-pi-ai` namespace not exposed i | General | 2386 | 2 |
| [#6224](https://github.com/deepseek-ai/deepseek-harness/discussions/6224) | [Bug] llm-pi-ai/opencode-go: missing x-opencode-session header and deepseek-v4.1-flash catalog entry | Q&A | 2341 | 0 |
| [#6127](https://github.com/deepseek-ai/deepseek-harness/discussions/6127) | [Bug] 工具执行中途崩溃的轮会留下悬空 tool_calls：切到 deepseek-official 重放历史必 400（repair 只补尾部 turn，deepseek 适配器无 sanit | General | 2273 | 0 |
| [#6035](https://github.com/deepseek-ai/deepseek-harness/discussions/6035) | Bug: Tool call with empty name/id → Error: unknown tool "" (UNKNOWN_TOOL) | Q&A | 2166 | 3 |
| [#6374](https://github.com/deepseek-ai/deepseek-harness/discussions/6374) | [Bug] Served index.html missing Cache-Control: no-store — cached documents break boot after rebuild | General | 2161 | 1 |
| [#6124](https://github.com/deepseek-ai/deepseek-harness/discussions/6124) | [Bug] dsh 0.1.5-rc.1 在 Node.js < 24 上完全静默失败(import.meta.main 守卫 + 未声明 engines) | Q&A | 2106 | 5 |
| [#6187](https://github.com/deepseek-ai/deepseek-harness/discussions/6187) | [Bug] Windows 上「在文件资源管理器中显示」在含中文/非 ASCII 的路径下只打开默认文件夹，不定位文件 | General | 2094 | 0 |
| [#5978](https://github.com/deepseek-ai/deepseek-harness/discussions/5978) | [Bug] 更新到最新 master 后，部分历史会话无法加载（v0 迁移校验过度严格） | Q&A | 2050 | 2 |
| [#6144](https://github.com/deepseek-ai/deepseek-harness/discussions/6144) | [Bug] v0→v1 迁移对单条不合规历史记录整体拒载，导致旧会话永久打不开 / Whole-log refusal on one non-conforming legacy record | General | 1921 | 1 |
| [#6348](https://github.com/deepseek-ai/deepseek-harness/discussions/6348) | # [BUG] 升级 dsh 0.1.5 后，此前手工重编号修复过的会话无法加载（chunk 溯源校验拒绝） | General | 1910 | 1 |
| [#5916](https://github.com/deepseek-ai/deepseek-harness/discussions/5916) | [Bug] Custom chat provider and built-in DeepSeek web search overwrite each other's API key | General | 1903 | 0 |
| [#5895](https://github.com/deepseek-ai/deepseek-harness/discussions/5895) | [Bug] Composition-adjacent events can slip past the guard within the old 10ms window | General | 1825 | 0 |
| [#6256](https://github.com/deepseek-ai/deepseek-harness/discussions/6256) | [Bug] Wide markdown tables (4+ columns) shift all content 8px while the pointer is near the bottom e | General | 1771 | 0 |
| [#6022](https://github.com/deepseek-ai/deepseek-harness/discussions/6022) | [Bug] Forking a session inherits the parent's queued prompts — the child executes them on first subm | General | 1728 | 1 |
| [#6373](https://github.com/deepseek-ai/deepseek-harness/discussions/6373) | [Bug] pnpm run build silently does nothing under tsx (import.meta.main guard never true) | General | 1630 | 1 |
| [#5975](https://github.com/deepseek-ai/deepseek-harness/discussions/5975) | [Bug] 内测模型 deepseek-v4.1-flash-expires-on-0910 reasoning 陷入"写/好/执行"无限重复 | General | 1596 | 0 |
| [#5976](https://github.com/deepseek-ai/deepseek-harness/discussions/5976) | [Bug] Agent 在超长上下文 + max reasoning effort 下陷入思考退化循环：回合零产出、无自动熔断，需手动中止（v4.1-flash；同配置 v4-flash 3000+  | General | 1594 | 13 |
| [#6296](https://github.com/deepseek-ai/deepseek-harness/discussions/6296) | [Bug] todo 清单在 agent 长时间不同步时会静默过期（附修复与实测） | General | 1434 | 0 |
| [#5889](https://github.com/deepseek-ai/deepseek-harness/discussions/5889) | BUG(dsh 0.1.3-alpha.2):启动崩溃 — connection 的 rpc 通道注册访问未声明的 owner.webServer(附一行修复) | General | 1358 | 0 |
| [#6166](https://github.com/deepseek-ai/deepseek-harness/discussions/6166) | [Bug] Switching a blank session to an already-loaded preset drops subagent tools | General | 1330 | 0 |
| [#5887](https://github.com/deepseek-ai/deepseek-harness/discussions/5887) | Bug report: dsh-client-ui-settings-plugins (0.1.3-alpha.2) - Subagent / Web search config cards vani | General | 1283 | 0 |
| [#6356](https://github.com/deepseek-ai/deepseek-harness/discussions/6356) | [Bug] v0.1.5-rc.1/rc.2: "agent.session.events is not iterable" in headless mode | Q&A | 1246 | 2 |
| [#5977](https://github.com/deepseek-ai/deepseek-harness/discussions/5977) | Bug: three native/landlock-run package.json files have a broken repository URL (deepseek-harness/dee | General | 1194 | 1 |
| [#5965](https://github.com/deepseek-ai/deepseek-harness/discussions/5965) | [Bug] Web 设置弹窗：左侧子项较多时没有滚动条，底部选项被裁切（看不到也点不到） | General | 1137 | 0 |
| [#6401](https://github.com/deepseek-ai/deepseek-harness/discussions/6401) | [Bug] TRANSPORT retries reuse a CLOSED HTTP/2 session after the process loses a local address | General | 1115 | 0 |
| [#6398](https://github.com/deepseek-ai/deepseek-harness/discussions/6398) | [Bug] 0.1.5 模型目录缓存失败状态，“重试”无法重新加载第三方模型 | General | 1099 | 1 |
| [#6108](https://github.com/deepseek-ai/deepseek-harness/discussions/6108) | [Bug] v2.0.6: skill-registry BigInt type error breaks all requests (REQUEST_EXTENSION failed) | Q&A | 1043 | 0 |
| [#6339](https://github.com/deepseek-ai/deepseek-harness/discussions/6339) | [BUG] [v0.1.5-rc.1] `agent-presets.default: standard` 新会话切到 `ptc` 缺失工具：`subagent`、`list_subagent_mod | General | 947 | 0 |
| [#6368](https://github.com/deepseek-ai/deepseek-harness/discussions/6368) | [Bug] DSH说已写入文档但并没有写入 | General | 943 | 2 |
| [#5952](https://github.com/deepseek-ai/deepseek-harness/discussions/5952) | [Bug] 会话日志损坏：长工具调用执行期间中断回合，导致 seq 重复（中断修复路径使用了过期的 seq 基线） | Q&A | 895 | 3 |
| [#6141](https://github.com/deepseek-ai/deepseek-harness/discussions/6141) | [Bug]分叉正在运行的或者发送消息但是终止运行的会话的行为和以前不一致了 | General | 725 | 9 |
| [#6114](https://github.com/deepseek-ai/deepseek-harness/discussions/6114) | [Bug] DeepSeek-V4.1-Flash display name misses decimal point | General | 624 | 1 |
| [#6101](https://github.com/deepseek-ai/deepseek-harness/discussions/6101) | [Bug][gateway/internal] DSH 历史加载失败：cannot safely transform unclassified message source | General | 359 | 3 |
| [#6294](https://github.com/deepseek-ai/deepseek-harness/discussions/6294) | [BUG]切换模型不能全部生效 | General | 288 | 0 |
| [#6138](https://github.com/deepseek-ai/deepseek-harness/discussions/6138) | [Bug] 输入法拼音未上屏时，输入框自动填充乱码汉字 | Q&A | 270 | 0 |
| [#6087](https://github.com/deepseek-ai/deepseek-harness/discussions/6087) | BUG:UI Style issue | General | 243 | 0 |
| [#6163](https://github.com/deepseek-ai/deepseek-harness/discussions/6163) | 【BUG】创建新会话时 Web 右侧 Sidebar不显示 | General | 207 | 0 |
| [#6419](https://github.com/deepseek-ai/deepseek-harness/discussions/6419) | [Bug][WebUI] 会话宽度调整Handler会遮挡会话内垂直导航轨道 | General | 204 | 1 |
| [#6240](https://github.com/deepseek-ai/deepseek-harness/discussions/6240) | Bug:windows点击在资源管理器中显示无法打开资源管理器 | General | 141 | 0 |
| [#6041](https://github.com/deepseek-ai/deepseek-harness/discussions/6041) | 【BUG】Goal 的设计存在重大缺陷 | General | 102 | 0 |
| [#6066](https://github.com/deepseek-ai/deepseek-harness/discussions/6066) | 我找到了一个BUG | General | 68 | 1 |
