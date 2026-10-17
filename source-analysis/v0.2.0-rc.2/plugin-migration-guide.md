# v0.2.0-rc.2 插件迁移指南（0.2.0-rc.1 → 0.2.0-rc.2，可操作版）

> 对比基线：`dsh-v0.2.0-rc.1`（`4878cdabd8`，2026-09-28）→ `dsh-v0.2.0-rc.2`（`639ed01539`，2026-09-29，PR #5479），187 commits。
> 逐 diff、提交号、复核命令见 [diff-vs-0.2.0-rc.1.md](diff-vs-0.2.0-rc.1.md)。
> **从 0.1.7 线直接升 0.2.0 的插件：主迁移文档仍是 [../../plugin-framework/v0.2.0-migration.md](../../plugin-framework/v0.2.0-migration.md)（rc.1 基线），本指南只回答"rc.2 相比 rc.1 多了什么"。**

---

## 〇、先说结论

**rc.1 → rc.2 没有任何插件契约变化，也没有新增必做项。**

- `plugin-compatibility.ts`（peer 世代门槛的实现）**零 diff**——rc.1 的 peer 范围要求原样成立；
- manifest schema、settings 核心、加载器 / HMR / slot 机制**零 diff**；
- `SESSION_FORMAT_VERSION` **保持 4**；唯一的新持久化条目 `2026-09-21-user-question-reply` 是 **same-version** 的消息 source 资格登记（纯增量，旧日志有效）；
- `packages/` 无新增、无删除、无改名包。

**动作清单**：如果你已经完成 rc.1 的迁移（peer 范围 `>=0.2.0-rc.1 <0.3.0-0`、Schedule 三 id 复核、`displayTitle` 空串兜底），那么在 rc.2 宿主上**什么都不用改**。peer 范围 `>=0.2.0-rc.1` 天然覆盖 rc.2。

---

## 一、观察点（全部 🟢，无必做）

### 1. `ask_user_question` 的 timed 模式（opt-in，默认行为不变）

`tool-ask-user` Cordis 行新增 `Config { mode?: 'legacy' | 'timed', timeout?: number }`：

- **默认仍 `legacy`**：默认组合注册的还是阻塞式 `ask()` 工具，wire schema 与 rc.1 一致（`a68ecdefc4` 保留 master legacy schema）——**你的插件如果只是调用 `ask_user_question`，什么都不会变**；
- 宿主 profile 想启用时在行配置写 `mode: 'timed'`（`timeout` 默认 120 秒，`-1` = 阻塞）：前台等待超时后 tool result 变 pending，用户**迟到**的回答以一条 durable user 消息到达（source `user-question-reply`），不再永远占住 turn；
- **给插件作者的启示**：如果你的插件自带"向用户提问"的工具并担心阻塞模型，rc.2 提供了官方先例——`userQuestions` projection（`@deepseek-ai/dsh-user-questions` 新增 `./typert` / `./remote` 导出）+ `answer()` RPC + steer 的两段结算模式可以直接借鉴；
- plan review **不走** timed（仍 `ask()` + `plan-review` intent），依赖 plan review 的插件不受影响。

### 2. 客户端问题卡契约增量扩展（消费 question slots 的插件留意）

`ui-user-questions/src/client/contract/slots.ts` 的 `PendingQuestion` 新增增量字段：`waitState`（`'counting' | 'focused' | 'editing' | 'waiting' | 'continued'`）、`countdown`、`channel`（`'waterfall' | 'rpc' | 'none'`）、`dismissal`（`'hide' | 'cancel'`）；拒绝码枚举新增 `ASK_TIMED_OUT`。**无字段删除**——只读取既有字段的代码不受影响；做自定义问题卡渲染的插件可以用新字段区分"倒计时中"与"等待用户"。

### 3. 行为文案与测试层适配（文档/脚本层面）

| 变化 | 谁需要留意 |
|------|-----------|
| Schedule 到期提醒首行统一为 "This is a scheduled message from the user"（`af39300572`） | 解析/断言 reminder 消息文本的脚本、e2e |
| 插件管理页升级引导改为"重装以升级"（`de1ec63678`） | 你的插件文档里"如何升级"章节的截图/描述 |
| cordis Client inspect 查询有界化 + 离线跳过（`f0e97fb7bc`、`10a4a17ccc`） | 依赖 inspect 长挂起的调试流程；新增 `clientInspectTimeoutMs` 配置 |
| pi-ai 0.87.1 模型目录升级（`6ed596f71b`） | 断言模型目录快照的测试 |

### 4. rc.1 的观察点在 rc.2 上原样成立

peer 世代门槛、Schedule 默认组合移除（opt-in bundle）、`displayTitle` 空串、`forkSession` / composer 契约扩展、`ctx.otel` / `ctx.productAnalytics` 新服务——详见 [v0.2.0-rc.1/plugin-migration-guide.md](../v0.2.0-rc.1/plugin-migration-guide.md)。

---

## 二、升级检查清单（rc.1 → rc.2 增量部分）

| # | 事项 | 级别 |
|---|------|------|
| 1 | 确认已完成 rc.1 迁移清单（peer 范围 / Schedule id / displayTitle） | 🔴 前置 |
| 2 | `package.json` peer 范围核对：`>=0.2.0-rc.1 <0.3.0-0` 已覆盖 rc.2，**无需修改** | 🟢 无动作 |
| 3 | （可选）问题类插件借鉴 two-settlements 模式；消费 question slots 者了解新增字段 | 🟢 可选 |
| 4 | （可选）脚本/e2e 中 Schedule reminder 文本断言更新首行 | 🟢 有则改 |

## 三、可复核命令

```bash
git diff dsh-v0.2.0-rc.1..dsh-v0.2.0-rc.2 -- packages/boot/app-boot/src/plugin-compatibility.ts  # 空 = 门槛未动
git diff --stat dsh-v0.2.0-rc.1..dsh-v0.2.0-rc.2 -- "**/dsh.plugin.schema*"                      # 空 = manifest 未动
git grep -n "SESSION_FORMAT_VERSION = " dsh-v0.2.0-rc.2 -- packages/core/session/src/types.ts    # 仍为 4
git show dsh-v0.2.0-rc.2:packages/interaction/tool-ask-user/src/index.ts                          # timed mode 接线
git diff dsh-v0.2.0-rc.1..dsh-v0.2.0-rc.2 -- packages/client/ui-user-questions/src/client/contract/slots.ts
```
