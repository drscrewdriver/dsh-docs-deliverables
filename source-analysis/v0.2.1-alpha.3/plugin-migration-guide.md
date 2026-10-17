# 插件迁移指南：v0.2.1-alpha.2 → v0.2.1-alpha.3

> 结论：**七类插件有必做项**（JSONL 持久化消费 / JobId 解析 / 子代理 persona·toolFilter 配置 / installBundle 自动化 / 非页面 Connection 事件订阅 / 旧槽名 `conversation.message.images` 注入方 / 客户端契约具名符号 import 方）；**兼容性闸门本段零 diff**——peer 写法在 0.2.1 线仍按 a.2 口径（`engines.dsh` 换代在 a.4）。

## 必做项（按触面）

### 1. JSONL 持久化消费者

```ts
// ❌ 旧：默认导入 / 直接构造 / instanceof
import JsonlPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
// ✅ 新：命名空间插件 + 挂载
import * as JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
ctx.plugin(JsonlSessionPersistence, config)
// 类型标注用 @deepseek-ai/dsh-session-persistence 的 SessionPersistence；动态导入不再取 .default
```

### 2. JobId 消费者

- 不再按 `<kind>-N` 拼 id——**原样透传**启动结果/`jobs.list()` 的 id 给 `job_output`/`job_kill`；
- 移除 `JobExecutionId` 导入与映射；SDK 生命周期事件用 `data.jobId` 配对 `job/registered`↔`job/settled`；
- 等待结果给 `job_output` 设 `wait: true`。

### 3. 子代理配置方

- 从 profile patch / 自定义 preset 的 `dsh-tool-subagent` 行删 `persona` 与 `toolFilter`；程序化调用与能力声明同步删；
- spawn：建含 `dsh-persona` + 所需工具插件的 Agent Preset，委派工具设 `agentPreset`（父模型多选走 `allowedAgentPresets`）；fork：移除覆盖、接受继承；
- 历史子 Session 无需手动迁移（恢复时仍应用旧 descriptor 限制）。

### 4. 插件安装自动化

- `installBundle` 前先 `removeBundle(name)`（HMR 运行时对已装包直接报 `already-installed`）；
- 对 `ManagementError['code']` 做穷尽 switch 的代码补 `already-installed` 分支。

### 5. 非页面 Connection（SDK/CLI/脚本）

- 默认 `interactions:'none'`：无 `$events`/`$on()`/`$stream()`——被动流用生成的原始流方法；
- 需要回答转发的：显式 `interactions=answer` 重装 Connection；
- 重连语义：生命周期连接关闭/Host 重启后，先重新 connect 再重试。

### 6. 客户端槽位注入方

- `conversation.message.images` **改名换代**为 `conversation.chat.message.images`（助手侧）/ `conversation.chat.user.images`（用户侧）——旧名注入静默失效（不报错、无渲染）；
- 新可用面：`conversation.hero.options`（New Session options）、`conversation.user.text.node`、`workspace.toast`。

### 7. 客户端契约具名符号 import 方（定义类缝隙，符号级扫描确认全仓无残影）

| 包 | 消失的导出 | 替代形态 |
|---|---|---|
| `@deepseek-ai/dsh-client-ui-primitives` | `projectUserText()`、`UserTextReferences`（`user-text.tsx` 整体换代） | `UserTextRun`（`{text}` props）与 `ReferenceChip`（`{appearance,label,title,onActivate}`）组件 |
| `ui-conversation` 契约 | `RenderMessageImages` | `MessageImagesOwnerProps`/`MessageImagesContentInput` + slot key `conversation.images.content` |
| `@deepseek-ai/dsh-client-connection` | `OperatorPeer`（`operator-peer.ts` 整文件消失） | `Peer` + `PeerAdmission`（配合 `interactions` 模式，见 §5） |
| `ui-chat` 契约 | `TURN_PROCESS_INDEPENDENT_KINDS` | 无同名替代——按 a.3 turn-process 契约重接 |
| `api/terminal-controller` | `TerminalAttachmentId` | 深引该类型的插件需重核形状 |
| ~~`typert/generator` `WorkspaceTypertGenerator`~~ | **系扫描误报，非删除**：实现移 `src/workspace.ts`，index 仍 `export { findWorkspaceRoot, WorkspaceTypertGenerator }` 再导出，importer 无感 | 无需行动 |
| `app-boot` index | `readProfilePatches`/`resolveTelemetryPatch`/`addHarnessSourceSection`/`HARNESS_SOURCE_SECTION`（`ProfileContext` 等移 `profile-context.ts`） | 内部面收口，一般插件不触及 |

> 快速自查：`grep -rn "projectUserText\|UserTextReferences\|RenderMessageImages\|OperatorPeer\|TURN_PROCESS_INDEPENDENT_KINDS\|TerminalAttachmentId" src/ tools/`——`tsc` 对 import 被删符号直接编译不过，typecheck 即闸。

## 行为核对（无需改码但要有感）

| 面 | 变化 | 核对动作 |
|---|---|---|
| 凭据优先级 | 存储 `refs` > 导出 env；headless 禁存储 | 若插件依赖 env 注入 key，检查同名存储条目 |
| DeepSeek 账号路由 | 不收 models 目录；watch 默认不通知身份变化 | 自注册路由/订阅身份的插件按指南 `deepseek-account-*` |
| pi-ai Azure | 路由更名 `azure-openai-responses`→`azure` | 硬编码路由 id 的 profile/插件 |
| 字号快捷键 | 桌面占用组合键 | 自定义快捷键冲突排查 |
| 遮蔽 | 发送文本中的凭据被 `ui-secret-mask` 遮蔽显示 | 展示用户原文的 UI 口径 |
| sdk-minimal | 默认清单加 `read_image` + 自动压缩 | 锁旧清单行为的集成 |

## peer / 装载面速核（本段零变化）

- `SESSION_FORMAT_VERSION` 保持 4（+2 同版本加性承认：job-session-lifecycle、user-rpc-principal——**旧构建读含新事件日志被拒**规则不变）；
- 兼容性闸门 / settings 核心 / vendor cordis·schemastery / HMR package-manifest **零 diff**；
- peer range 写法沿用 a.2 口径；0.2.1 线命中：runtime 为 `0.2.1-alpha.3`，`^0.2.1-alpha.1` 形式经 `includePrerelease` 可命中同三元组全部预发布（alpha.2/3/4/5、rc.1 同为 `0.2.1` 三元组，可命中；**跨三元组 caret 仍是假声明**）。

## 检查清单

1. [ ] grep `session-persistence-jsonl` 的默认导入/`new`/`instanceof`；
2. [ ] grep `JobExecutionId`、`<kind>-${n}` 拼 id 模式；
3. [ ] profile patch：`dsh-tool-subagent` 行去 `persona`/`toolFilter`；
4. [ ] 安装自动化：install 前 remove；错误码 switch 补分支；
5. [ ] 脚本/SDK：确认未依赖 `$events`（或显式 `interactions=answer`）；
6. [ ] client 注入：`conversation.message.images` 改新家族名；
7. [ ] client import：按 §7 表 grep 被删具名符号（`projectUserText`/`RenderMessageImages`/`OperatorPeer` 等），typecheck 兜底；
8. [ ] 凭据/账号/pi-ai 路由 id：按上表核对；
9. [ ] 目标宿主矩阵补 `0.2.1-alpha.3` 后重跑装载冒烟（干净格逐 rc）。
