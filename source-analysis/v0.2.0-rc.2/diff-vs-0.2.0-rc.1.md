# v0.2.0-rc.2 逐主题 diff 说明（dsh-v0.2.0-rc.1 → dsh-v0.2.0-rc.2）

> 区间：187 commits（140 非 merge + 47 merge）｜ 1022 files changed, +33253 / −6141 ｜ 2026-09-24 ~ 2026-09-29
> 所有提交号均可用 `git show <sha>` 在 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 复核。

---

## 1. 文件热度分布（按包）

| 区域 | 文件数 | 主要内容 |
|------|--------|----------|
| `packages/interaction/user-questions` + `tool-ask-user` + `client/ui-user-questions` + `client/ui-tool` | 59 (+6521/−633) | 计时提问两段结算全套：projection / timed-wait / RPC / 卡片 UI |
| `packages/client/ui-model-selection` + `ui-commands` + `ui-primitives` | ~15 | 模型选择器模糊搜索 + `MenuGroup` + 分组排序 |
| `apps/desktop` | 46 | CLI 命令管理、登录 shell 环境、安装器/签名修复 |
| `packages/sandbox/sandbox-windows-acl` | ~12 (+539 ps1 重写) | 单次运行诊断+修复 |
| `packages/schedule/schedule` | 9 | 提醒框架化 + docs |
| `packages/llm`（pi-ai 目录消费方） | ~17 | pi-ai 0.87.1 适配 |
| `packages/extensions/cordis-host-runner` | ~12 | inspect 查询有界化 |
| `docs/persistence-changes/2026-09-21-user-question-reply.*` | 4 (+11449 schema) | 新持久化承认（same-version） |

---

## 2. 逐主题 diff 说明

### 2.1 计时提问与迟到回复（two settlements，`3a296b16b4` 主提交 + ~19 个后续修正）

**工具层**（`packages/interaction/tool-ask-user`）：

- `src/index.ts`：`Config` 新增 `mode?: 'legacy' | 'timed'`（默认 `legacy`）与 `timeout?: number`（默认 120，范围 `-1 | 1..2_147_483` 秒）。`apply()` 在 `mode === 'timed'` 时改注册 `registerTimedAskUser(ctx, timeout)`——**默认组合不变**，timed 是行级 opt-in；
- `src/timed.ts`（新增）：`ask_user_question` 的 timed 变体。超时后 tool result 返回 pending（`message` 字段内嵌 `pendingNotice`——它是结果 JSON 的字段而非旁边散文，这样 `userQuestions` projection 与客户端问题行都能从录得的 result 文本判定"这是超时不是回答"）；回答到达后经 `agent.steer()` 注入 durable user 消息。

**服务层**（`packages/interaction/user-questions`）：

- `src/timed-wait.ts`（新增）：前台等待与倒计时所有权；`src/projection.ts`（新增）：从既有 Session 事件（`tool/call` / `tool/result` / `tool/ptc-dispatch` / inbox spliced / `user/message`）重建 `userQuestions` 状态——PTC 子调用在其 `tool/ptc-dispatch` result 为 pending 时入投影（模型请求头里只有 `run_code`）；
- `src/index.ts`（+226 行）：新增 `answer(agent, callId, answer)` RPC——未知/非 continued 返回 `false`；已有回复等待入场时抛 `REPLY_QUEUED`；批量未逐题命名抛 `BAD_ANSWER`；接受后以 source `{ kind: 'user-question-reply', callId, outcome: 'answered' }` steer；
- `package.json`：新增 `./typert` 与 `./remote` 两个导出子路径（`92542fddec` "compact types" 重新生成的 typert 协议清单）；依赖新增 `dsh-typert-protocol` / `dsh-session*` / `dsh-tools`。

**客户端层**（`packages/client/ui-user-questions` + `ui-tool`）：

- `QuestionReplyView.tsx` / `question-reply.ts`（新增）：继续问题行的迟到回答渲染；`QuestionToolRow.tsx`（`ui-tool` 新增）：问题工具行动作澄清；
- `contract/slots.ts`（+476/−…）：`PendingQuestion` 卡片契约扩展——`waitState: 'counting' | 'focused' | 'editing' | 'waiting' | 'continued'`、`countdown { remainingMs, running }`、`channel: 'waterfall' | 'rpc' | 'none'`、`rejection code` 枚举新增 `ASK_TIMED_OUT`、`dismissal: 'hide' | 'cancel'`；`createWaterfallRequest` 把委托语义改成显式 `delegate()` + symbol 哨兵。**全部为增量字段/新类型，未删除既有字段**；
- 排队回复重载后保持只读（`ed34a1d7fe`）、推荐选项预选但不停表（`1c6c462633`）、竞态恢复覆盖（`0c4498ac42` / `fc30c5a7d2` / `edd0660b5d` 入场保留）、PTC 投影边界测试（`8430907d22`）。

**持久化承认**：`docs/persistence-changes/2026-09-21-user-question-reply.md`——`event:agent/inbox/spliced` / `event:developer/message` / `event:session/title-llm-request` / `event:user/message` 四个 root 登记新 source 资格，`decision: same-version`。**无新事件类型、无会话头变化；旧日志有效；无 `dsh-user-questions` 的读者保留消息并从内容推导历史。**

**legacy schema 保留**：`a68ecdefc4`（保留 master legacy 工具 schema）+ `daec283261`（默认定义原地不动）确保默认阻塞式 `ask()` 路径的 wire schema 不变；plan review 仍走 `ask()` + `plan-review` intent + `BAD_INTENT` 校验。

### 2.2 桌面 CLI 命令管理（PR #5288 `1de97d1c10` + PR #5393 `4f26143bf2`）

- `5f99386fa8` bundled CLI 启动与安装守卫；`ac88033f4c` PATH 目录只暴露 `dsh`（不再泄漏辅助二进制）；`fa9586824e` Host 与 CLI 入口 bundle 自包含；
- `9c8f5c2bf3` **原生菜单管理已安装的 dsh 命令**（安装 / 修复 / 回滚入口进应用菜单）；`a01f2444c3` CLI 注册从安装流程内联改为**安装后菜单动作**（`refactor`）；`0e5ab65758` / `6863e7fe9b` 简化 bundled CLI 与 Desktop 插件管理、修正复选框文案；
- 可靠性系列：`d1e05324ea` CLI 准入绑定当前安装、`ae4f3546ae` controller 释放后取消交接、`d796ae1efd` 保留命令所有权 + 静默安装器守卫、`5670a14646` 回滚保留 symlink 身份、`0677288518` 备份先声明再恢复、`386487ec66` 保留命令错误 + 校验安装器选择、`05c0687372` 重试后只报告保留的备份；
- `e21ed97f29` Windows 控制台信号（Ctrl-Break）送达 CLI 处理器（+ `b18bc3b6ef` 探针保活测试）；
- PR #5393（`feat(desktop): 启动时读取用户登录 shell 环境`）：桌面启动注入用户登录 shell 的环境变量——CLI 子进程与用户终端环境一致。

### 2.3 Windows ACL 单次运行修复（PR #5432 `7cecc72cae`）

- `ab0195f802` **一次运行完成"诊断 + 修复"**；`4f96bc18df` 修复结果对照**目标对象自身的 ACE** 校验（不再只看继承）；`58f64d0117` / `fd5e89feb7` 评审收紧；`e0c194cfe1` 子树扫描**之后**再分类 + 上报报告失败；`5329de143a` 报告截断后保持可读；
- `diagnose-windows-sandbox-acl.ps1` 重写 539 行；配套技能文本快照刷新（`9da8c9dd34` / `e909f866aa`）；
- 文措辞：对用户说 "Windows file permissions" 而非 "ACL"（`d7defa7e51`），解除限制的决策留给用户（`9408da49b9`），停止指引缩短并配中文（`7ac193ba45`）。

### 2.4 模型选择器重做（`6773e10645` 系列共 ~12 commits）

- `6773e10645` composer 模型菜单**模糊搜索**；`18a548a56b` / `b29578b8f0` 胶囊形输入框 + 前导图标；`75ea006f4c` 圆弧匹配；`b3d6da9083` 可访问性评审；
- `989b93d86f` 分组排序统一 + **粘性分组头**；`3ec8cd925d` 粘性检测**不做 layout 读**（perf）；`78bc78d48c` / `45368fb158` / `bfec75eb14` 搜索阈值、焦点恢复、命令菜单对齐；
- 新原语：`ui-primitives/src/MenuGroup.tsx`（+103 行 + 388 行测试）；`ui-commands/src/client/option-groups.ts`；`ui-model-selection/src/client/provider-order.ts`。

### 2.5 长会话与鲸鱼动画性能（PR #5456 `fe5b4da6f5`）

- `6a0f36cdea` 长会话 transcript 渲染与输入开销降低、鲸鱼动画开销降低；`bb7455da04` `running-whale@2x.png` **构建期内联进 CSS**（消运行时请求）；`167fea0723` 保持可访问性并更新动画测试；`e4aa508e35` 文档对齐。

### 2.6 侧栏打开工作区（PR #5314 `afadb61008`）

- `be0e31233c` 侧栏文件树文件夹行新增**打开工作区**按钮；`35002626a1` sidebar 动作改传显示目录；`171c9e9225` 复用 path-based open-in-app 动作；`41021fc803` 新终端菜单每个 shell 只列一次。

### 2.7 Schedule 提醒框架化（PR #5137 `511a62cd1b`，主提交 `af39300572`）

- 到期提醒原来以 user-role 消息进入会话，固定文本要求模型把 reminder prompt 当**不可信内容**；两条投递路径（one-shot / recurring batch）现在共用 `SCHEDULED_MESSAGE_FRAMING`，开头统一一行 **"This is a scheduled message from the user"**——消息自证来源而非自称有权给指令；
- 括号标记与 JSON 编码动态字段不变，prompt 仍无法伪造框架行；决策记录 `.agents/notes/implemented/architecture/2026-09-24-scheduled-message-framing.md`；后续 8 个 docs commits 收窄措辞（`ba92dafe00` / `7f53c7498c` 等）。

### 2.8 设置页解禁（PR #5449 `e8a777fb32`）

- `3442930ebf` 切换默认预设不再受"代码工作工具"开关限制；`3c17f569da` 设置页 Creator 入口同样解禁。相关：`8671d30583` / `30a3913397` 无赠金时隐藏设置页赠金行、统一引导页设置入口文案；`11925ce345` e2e 与设置位置稳定化。

### 2.9 LLM 层（PR #5445 `454b87e59a`）

- `6ed596f71b` **pi-ai 升级 0.87.1**（模型目录升级，`082404a7b6` 重录 unsupported-image 覆盖）；`c73b80b1ea` Mistral 纳入 pi-ai 兼容性类型检查；`28648ffb6b` 允许**空 compatibility guard 成员**；`1a50c05170`（shell）提醒 agent 在删除/移动前核对 resolved path。

### 2.10 cordis Client inspect 收口（PR #5409 `6bb3d8becf`）

- `f0e97fb7bc` Client inspect 查询**有界化**（`clientInspectTimeoutMs`）+ 失败保留；`10a4a17ccc` 离线跳过；`657b8622c1` 文档澄清；`cordis-host-runner` 新增 `inspect-registry.spec.ts`（271 行）。

### 2.11 插件管理页文案（PR #5410 `2bde15f551` + `93996db3c7`）

- `de1ec63678` 明确"**升级 = 重装**插件"（宿主无原地升级）；`05c891200c` shipped bundle 与不兼容升级**分开措辞**；`93996db3c7` 已装不兼容插件时引导重装兼容版本。

### 2.12 桌面安装器 / CI / 工程面

- `9ff76e66b3` 固定版本安装器上传支持 Windows 凭据；`aaceea0554` fixed latest installer 上传命令；`cbfcd4027f`/`2c8daf728a`/`800f1b147b` 模拟环境下原生安装器完成与目录生命周期；`dbf31101d8` Intel Node 可执行内存签名 entitlement（`34b424952c` 评审跟进）；`3545e9a2a6` Windows 冒烟测试前装 Electron；
- 测试基建：vitest lane 预算（`333d7e75d2` / `3e38e2118c` / `0976d15122`）、pwsh readiness timeline（`fc885edf72`，+354 行）、HMR 测试等待 live native watch（`7d3c9750e6`）、PTC 后台作业发布等待（`23706d7ff9`）；
- 文档：升级指南**双语化**并删除 OTel 指南（`61d4ab0b6c`）、升级指南结构 + skill + gate（`23d3807ae1`，PR #5389）、v0.1.7-rc.2 升级指南回填（`9126818b7f`）；`3825706a15` Web 空白会话同步暂缓（明确标注"本 PR 暂不同步"）。

---

## 3. 插件可见面核对（本区间零 diff 的契约文件）

| 契约 | 核对方式 | 结果 |
|------|----------|------|
| peer 兼容性校验 | `git diff rc.1..rc.2 -- packages/boot/app-boot/src/plugin-compatibility.ts` | **空** |
| manifest schema | `git diff --stat rc.1..rc.2 -- "**/dsh.plugin.schema*"` 及全仓库 manifest 相关 | **空** |
| settings 核心 | `git diff --stat rc.1..rc.2 -- packages/core/settings* packages/shell/settings*` | **空** |
| 会话格式 | `git grep SESSION_FORMAT_VERSION` @ rc.2 | **仍为 4**（`packages/core/session/src/types.ts:89`） |
| 包结构 | `git diff --diff-filter=ADR --name-status -- "*package.json"` | **无新增/删除/改名包** |
| 客户端问题卡契约 | `contract/slots.ts` diff | 增量字段（`waitState` / `countdown` / `channel` / `ASK_TIMED_OUT`），无删除 |

## 4. 复核命令

```bash
git fetch --tags
git log --oneline dsh-v0.2.0-rc.1..dsh-v0.2.0-rc.2            # 全部 187 条
git log --no-merges --oneline dsh-v0.2.0-rc.1..dsh-v0.2.0-rc.2 # 140 条非 merge
git diff --stat dsh-v0.2.0-rc.1..dsh-v0.2.0-rc.2               # 1022 files, +33253/−6141
git show 3a296b16b4                                             # 计时提问主提交
git show dsh-v0.2.0-rc.2:packages/interaction/tool-ask-user/src/index.ts   # timed mode 接线
git show dsh-v0.2.0-rc.2:docs/persistence-changes/2026-09-21-user-question-reply.md
git grep -n "SESSION_FORMAT_VERSION = " dsh-v0.2.0-rc.2 -- packages/core/session/src/types.ts
```
