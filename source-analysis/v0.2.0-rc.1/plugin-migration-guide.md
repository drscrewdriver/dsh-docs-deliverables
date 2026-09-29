# DSH 0.1.7-rc.2 → 0.2.0-rc.1 插件迁移指南

> 对比基线：`dsh-v0.1.7-rc.2`（`477b4f4205`）→ `dsh-v0.2.0-rc.1`（`4878cdabd8`），261 commits。
> 本指南面向**针对 0.1.7 线编写并已发布**的插件。0.1.6 及更早的插件先读
> [v0.1.7-rc.1/plugin-migration-guide.md](../v0.1.7-rc.1/plugin-migration-guide.md) 完成 0.1.6 → 0.1.7 迁移，再回本指南。

---

## 变更分级速览

| 级别 | 数量 | 内容 |
|---|---|---|
| 🔴 **必做**（不做无法安装/激活） | 1 | §一 peer 范围世代门槛 |
| 🟡 **必须复核**（不改代码可能行为回退） | 3 | §二 Schedule 默认组合移除、§三 `displayTitle` 空串语义、§四 volatile 配置与 Session Log 开关 |
| 🟢 **建议跟进**（兼容性扩展，实现者需适配） | 4 | §五 `forkSession` / composer 提交契约、§六 TextShimmer DOM、§七 新服务 `otel` / `productAnalytics` |
| ⚪ 无需动作 | — | manifest 契约、settings 席位 API、加载器 / HMR / slot 机制、会话格式 V4：**全部未动** |

与 0.1.6 → 0.1.7 的"契约换代"（`installSection` 删除、`settings.yaml` 移除、清单 patch 数组化、会话 V3→V4）相比，
本次是**世代门槛 + 默认组合裁剪**：插件代码主体无需重写，重点在 manifest 版本声明与两处语义复核。

---

## 一、peer 范围世代门槛（🔴 必做，唯一的硬门槛）

**现象**：0.1.7 线插件在 0.2.0-rc.1 宿主上**安装直接被拒**，报 `installation rejected` + `IncompatiblePlugin { name, version, runtimeVersion, peers }`。

**原因**：`packages/boot/app-boot/src/plugin-compatibility.ts:61` 的 `evaluatePluginCompatibility` 对 manifest 里所有
`@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` peer 依赖，用 `semver.satisfies(runtimeVersion, range, { includePrerelease: true })` 校验。
0.1.7 线惯例写法 `>=0.1.7-rc.1 <0.2.0-0` 排除所有 0.2 预发布版（semver 中 `0.2.0-0` 是数值型预发布标识，
**小于**字母型的 `0.2.0-rc.1`，故 `0.2.0-rc.1` 不满足 `<0.2.0-0`）。校验发生在两个位置：

- **安装前**（`packages/boot/plugin-manager/src/operations.ts:323` preflight）：读取待装包 manifest，不满足即拒绝，**什么都没装**；
- **安装后**（同文件 ：475）：对每棵 `node_modules` 里的包（含 bundle 组件）复查，不满足即**回滚整个安装**（恢复 package.json / lockfile / node_modules）；
- **启动时**（`app-boot` preflight）：已装但 peer 不满足的包，profile 启动**拒绝加载**，除非精确版本豁免。

**迁移动作**（`package.json`）：

```jsonc
// 旧（0.1.7 线）
"peerDependencies": {
  "@deepseek-ai/dsh": ">=0.1.7-rc.1 <0.2.0-0"
}
// 新（0.2.0 线）
"peerDependencies": {
  "@deepseek-ai/dsh": ">=0.2.0-rc.1 <0.3.0-0"
}
```

三个注意点：

1. **仓库内开发期不受影响**：源码里内部依赖写 `workspace:^` / `workspace:*`，校验时被替换为运行版本本身
   （`plugin-compatibility.ts:76`）；`workspace:` 协议在发布时由 pnpm pack 改写为 `^0.2.0-rc.1`。
   所以只要发版流程不变，**peer 范围是唯一要手改的 manifest 字段**。
2. **想同时服务两条版本线**：由于 0.2.0-rc.1 对插件 API 层面完全兼容 0.1.7（见下文"无硬 breaking"结论），
   可以声明跨线范围如 `">=0.1.7-rc.1 <0.3.0-0"`——semver 会同时满足两个宿主。**但要自行承担跨线测试义务**，
   0.3.0 一旦出现真正的契约换代，宽范围会把用户挡在报错后面而不是安装前面。
3. **豁免是精确版本对**：`readProfileVersionExemptions` 按插件 `name@version` + 运行版本记录豁免；
   工具面的措辞是"Version exemptions risk crashes and data loss"——豁免是给用户的逃生门，**不是发布策略**。

---

## 二、Schedule 默认组合移除（🟡 必须复核）

`packages/bundle/web-app/cordis.patch.yml` 删除了 `time-context` / `schedule` / `ui-schedule` 三行
（0.1.7-rc.2 里它们还以 `disabled: true` 形式存在），迁入可选 bundle
`@deepseek-ai/dsh-experimental-schedule-bundle`（`packages/boot/app-boot/src/profile.ts:213` 的 `OPTIONAL_BUNDLES`）。

受影响的三类插件：

1. **profile patch / `--patch` overlay 引用这三个 id 的**：bundle 未启用时 loader 警告
   `patch: entry <id> not found`，整行不生效。对策：文档里注明用户需先在 Plugins 页启用 Schedule bundle，
   或改用 `dsh.profile.bundles` 显式带上；不要假设 id 永远在组合里。
2. **依赖 `schedule_*` 工具默认存在的**：新装 Web 默认没有这些工具。对策：能力探测
   （`ctx.get('schedule')` 判空）而不是假设注入成功；或要求用户 opt-in。
3. **消费逐步 durable clock 消息 / Automation tasks 页数据的**：数据保留在 Schedule 域，但默认不再产生新消息。
   对策：同上，opt-in 后恢复。

**不受影响**：不碰 Schedule 的插件。默认组合省掉的 4 个 tool schema 与逐步 clock 消息对所有插件都是 prompt 减负。

---

## 三、`displayTitle` 空串语义（🟡 必须复核）

`packages/client/ui-workspace/src/client/contract/slots.ts:79` 与 `tree.ts` 的 `sessionTitle()`：

- 旧："persisted title, project basename, or Session id"（**永不为空**）；
- 新："persisted title, or empty when the Session has none"（**可能为空串**），渲染层由
  `Rows.tsx` 用 `node.title || t('session.untitled')` 兜底本地化。

受影响面：**Session 行动作 slot 的消费者**（`SessionRowOwnerProps.displayTitle`，两处 slot 记录）。
若你的插件 UI 假设 `displayTitle` 非空（例如直接拿它做菜单标题、文件名、检索键），现在会拿到空串。

迁移动作：

```tsx
// 旧
const label = props.displayTitle;
// 新
const label = props.displayTitle || t('session.untitled'); // 或你自己的 "未命名会话" 文案
```

同时注意：rename 快捷键入口改传**原始标题**（可能空串），做"重命名"对话框的插件要把空串当作"未命名"而不是显示空白。

---

## 四、volatile 配置一等化 + Session Log 开关（🟡 建议跟进）

- `session-log-deepseek.Config.enabled` 改为 `z.boolean().default(true).volatile()`，
  且校验后的类型由可选变**必有**——直接读该 Config 类型的代码需要适配（`packages/session/session-log-deepseek/src/index.ts`）。
- 新的官方 UI 包 `@deepseek-ai/dsh-client-ui-settings-session-log` 在 General 设置注册 order 90 行，
  直写 Host 的 `enabled` 字段——**用户改开关即刻生效（下一请求），不再重启**。
- 同机制扩散：`ui-chat` 的 `transcriptView`、product-analytics 的 `enabled` 均为 `Volatile`。

**对插件的启示**（机制未变，但官方用法在收敛）：凡是"用户可即时开关"的偏好，用 `.volatile()` 声明并在
`prepare`/请求路径上 `config.x.get()` 读取，而不是启动时缓存布尔值。这是 0.2 线设置体系的既定方向。

---

## 五、`forkSession` 与 composer 提交契约扩展（🟢 实现者适配，调用者免改）

两组**向后兼容的签名扩展**，调用现有代码不受影响；但**实现这些接口的插件**（override 者）需要适配新签名：

1. `UiWorkspace.forkSession`（`ui-workspace/src/client/navigation.ts:45-53`）与 `ISessions.fork`
   （`session-controller/src/client/contract/sessions.ts`）：
   `(sessionId) => Promise<void>` → `(sessionId, onCreated?) => Promise<SessionId>`；
   `onCreated(childId)` 在可选的继承标题重命名**之前**回调。实现者：接受第二个可选参数并返回子会话 id。
2. composer 提交契约（`ui-conversation/src/client/contract/composer-submission.ts` 新增
   `MessageSubmission` / `MessageSubmissionState`）：`SessionInput.submit(mode?, source?)`、
   `ComposerKeyboard.submit(mode, source?)`、`InputEvent 'enter'` 与 `SubmitAttempt` 新增可选 `submission` 字段。
   实现者：接受新可选参数/透传可选字段即可；想做"提交来源感知"的插件现在有了官方挂点。

---

## 六、TextShimmer DOM 结构变化（🟢 局部）

`packages/client/ui-primitives/src/TextShimmer.tsx` / `.module.css` 重构为通用 shimmer 包装组件：
嵌套包装 + `data-shimmer-decoration` 标记，skill/tool/进程行复用（`ae9a455bfd`）。
依赖其**内部 DOM 结构**或用自定义 CSS 覆盖其样式的插件 UI 需要复核；只用组件默认渲染的不受影响。

---

## 七、新服务：`otel` 与 `productAnalytics`（🟢 可选采用）

两个新的官方扩展点，均为**可选注入**（服务不挂载时 `ctx.get(...)` 返回空，消费侧已做 `?.` 判空）：

| 服务 | 包 | API | 挂载条件 |
|---|---|---|---|
| `ctx.otel` | `@deepseek-ai/dsh-otel` | `createEventReporter(options)`（按条数分批）、`createSessionLogReporter(options)`（字节限额分批，`maxRequestBytes` 上限 4,000,000） | base bundle 均已挂载 |
| `ctx.productAnalytics` | `@deepseek-ai/dsh-client-product-analytics` | `enabled()` / `watchPolicy()` / `report(ProductEvent)` | 仅 desktop profile；普通 Web 不采集 |

**给插件作者的提示**：

- 你的插件若自建 OTLP 上报（自组 `LoggerProvider` / exporter），0.2 线的官方方向是改用 `ctx.otel`
  工厂（参考 `session-telemetry-otel` 与 `product-telemetry-otel` 的重写：只保留 reporter 调用方逻辑）；
- 产品埋点请走 `ctx.productAnalytics?.report(...)`，**不要**假设服务存在（普通 Web 不挂载），
  事件类型在 `tool-cordis` 的 api-catalog（`ProductEvent` / `ProductEventMap`）；
- `ProductTelemetryRecord` / `ProductTelemetryScalar` 改为 `OTelEventRecord` / `OTelEventScalar` 的别名——
  结构相同，仅对做 nominal 类型处理或 re-export 细节的代码有影响。

---

## 八、升级检查清单

按顺序执行，每步都可独立验证：

- [ ] `package.json`：所有 `@deepseek-ai/dsh*` peer 范围改 `>=0.2.0-rc.1 <0.3.0-0`（或跨线范围，见 §一）
- [ ] 本地 `pnpm install` + `build` + 测试全绿（代码层预期**零修改**即绿）
- [ ] grep 代码与 profile patch：是否引用 `time-context` / `schedule` / `ui-schedule`（§二）
      —— 有则加能力探测或文档注明 opt-in
- [ ] grep 代码：是否消费 `displayTitle` / `SessionNode.title`（§三）—— 有则补空串兜底
- [ ] 若直接读 `session-log-deepseek` 的 `Config` 类型：适配 `enabled: Volatile<boolean>` 且必有（§四）
- [ ] 若 override `forkSession` 或实现 composer 提交契约：适配新签名（§五）
- [ ] 若覆盖 TextShimmer 样式：复核 DOM（§六）
- [ ] 发布后在 0.2.0-rc.1 宿主上实测 `dsh plugin install`（preflight 拒绝发生在安装前，装错范围用户第一眼就看到）

## 九、可复核命令

```bash
repo=E:/test/rewrite-agently/deepseek-harness

# peer 校验语义（includePrerelease）
git -C $repo grep -n "includePrerelease\|workspace:\^" dsh-v0.2.0-rc.1 -- packages/boot/app-boot/src/plugin-compatibility.ts

# Schedule bundle 化证据
git -C $repo diff dsh-v0.1.7-rc.2..dsh-v0.2.0-rc.1 -- packages/bundle/web-app/cordis.patch.yml
git -C $repo grep -n "OPTIONAL_BUNDLES" dsh-v0.2.0-rc.1 -- packages/boot/app-boot/src/profile.ts

# displayTitle 语义
git -C $repo diff dsh-v0.1.7-rc.2..dsh-v0.2.0-rc.1 -- packages/client/ui-workspace/src/client/contract/slots.ts

# 会话格式未换代
git -C $repo grep -n "currentVersion" dsh-v0.2.0-rc.1 -- packages/session/session-format-catalog/src/generated.ts

# manifest 契约未动（diff 应为空）
git -C $repo diff dsh-v0.1.7-rc.2..dsh-v0.2.0-rc.1 -- packages/util/package-manifest/src/types.ts
```
