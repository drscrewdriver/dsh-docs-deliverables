# DSH 插件升级适配陷阱（讨论区实证）

> 适用场景：DSH 升级（尤其 0.1.2 → 0.1.5）后插件行为异常或导致宿主异常。
> 数据源：`deepseek-harness` 讨论区 #5886–#6442 增量分析（2026-09-12），每条均附原始讨论链接。
> 与 [compatibility-guide.md](compatibility-guide.md)（API 层适配）互补，本文聚焦**实际踩坑案例**。

---

## 一、会话数据写入类陷阱（最严重）

### 1.1 插件自定义 message source kind 会导致旧会话永久拒载 🔴

- [#6311](https://github.com/deepseek-ai/deepseek-harness/discussions/6311)：v2→v3 会话迁移对**插件自定义的 message source kind 直接拒载**，导致旧会话永久无法加载。
- [#6101](https://github.com/deepseek-ai/deepseek-harness/discussions/6101)：`cannot safely transform unclassified message source`。

**插件侧规避**：
- 不要向会话日志写入自定义 source kind；如必须标记插件产生的消息，使用**现有标准 kind + 元数据字段**。
- 升级 DSH 前，若插件写过自定义 source，先在旧版本导出/清理相关会话。

### 1.2 插件写入的 marker（null turn/step）会永久破坏 /compact

- [#5920](https://github.com/deepseek-ai/deepseek-harness/discussions/5920)：插件写入 turn/step 为 null 的 marker 后，`/compact` 永远失败。

**规避**：插件向会话写任何事件/标记时，必须携带合法的 turn/step 定位；写入前校验当前 session offset。

### 1.3 会话迁移链（v0→v1→v2→v3）整体拒载问题（宿主侧，但影响插件用户）

- [#5909](https://github.com/deepseek-ai/deepseek-harness/discussions/5909)、[#6045](https://github.com/deepseek-ai/deepseek-harness/discussions/6045)、[#6010](https://github.com/deepseek-ai/deepseek-harness/discussions/6010)、[#6189](https://github.com/deepseek-ai/deepseek-harness/discussions/6189)、[#6297](https://github.com/deepseek-ai/deepseek-harness/discussions/6297)、[#6282](https://github.com/deepseek-ai/deepseek-harness/discussions/6282)：单条不合规历史记录即拒绝**整份**日志；`subagent/descriptor` 仅按 version 数字判定；`turn/start N+1` 校验过严；`header.isSeeded` 类型全等校验拒绝 0.1.2-rc.1 写出的会话。

**对插件作者的含义**：用户升级后大量"会话打不开"的报障**不一定是插件导致**，排查时先看是否复现于禁用插件的干净 profile。

---

## 二、插件通道与生命周期陷阱

### 2.1 connection.rpc.handle() 通道在 0.1.5-rc.1/rc.2 静默失效（405）

- [#6337](https://github.com/deepseek-ai/deepseek-harness/discussions/6337)：调用 `connection.rpc.handle()` 的插件通道静默失效（HTTP 405）。
- [#6227](https://github.com/deepseek-ai/deepseek-harness/discussions/6227)：`dsh-client-connection@0.1.5-rc.1` 的 `register()` 在未声明 webServer 时崩溃。

**适配**：使用 RPC 通道的插件在 0.1.5+ 上必须实测通道往返；不要假设注册成功即可用。客户端 API 前缀也已从 `/endpoint` 变为 `/api/endpoint`（见 [distribution-strategy.md](distribution-strategy.md) §1.1）。

### 2.2 第三方插件注册 HTTP 通道可能导致 connection 启动失败

- [#5926](https://github.com/deepseek-ai/deepseek-harness/discussions/5926)：插件注册 HTTP channel 时 `cannot get property 'webServer'`，connection 无法启动。
- [#5889](https://github.com/deepseek-ai/deepseek-harness/discussions/5889)：rpc 通道注册访问未声明的 `owner.webServer`（附一行修复）。

**规避**：注册通道前运行时检测依赖服务是否存在（`ctx.get('webServer')`），缺失时降级为不注册而非抛错。

### 2.3 改写 cordis.patch.yml 触发热重载，静默销毁在途回合

- [#6298](https://github.com/deepseek-ai/deepseek-harness/discussions/6298)：开发期改写 `cordis.patch.yml` 触发热重载，所有存活会话的在途回合被静默 aborted/disposed。

**规避**：开发期热重载仅用于 UI 调试；涉及 host 半配置变更时提醒用户会话会被中断。

### 2.4 profile 内出现第二份核心包 → Symbol/instanceof 跨实例失效

- [#6416](https://github.com/deepseek-ai/deepseek-harness/discussions/6416)：profile 内出现第二份核心包时 Symbol/instanceof 跨实例失效，工具派发崩溃（`reading 'prepare'`）。

**规避**：插件**绝不要**打包/携带 `@deepseek-ai/*` 核心包副本，一律声明为 peerDependencies（`optional`）。

---

## 三、客户端 bundle 陷阱（0.1.5 升级高发）

### 3.1 升级后 client combo 陈旧，插件树整体不激活

- [#5999](https://github.com/deepseek-ai/deepseek-harness/discussions/5999)：升级既有 profile 后 client combo 缺失新增 bundle 模块（`ui-sidebar-*` 404 / loaded without registering），全部 client 插件不激活。
- [#6081](https://github.com/deepseek-ai/deepseek-harness/discussions/6081)：Web bundle 应声明模块 → webServer 激活依赖（提案）。
- [#6374](https://github.com/deepseek-ai/deepseek-harness/discussions/6374)：served index.html 缺 `Cache-Control: no-store`，重建后缓存的文档破坏 boot。

**插件侧规避**：用户报障"升级后插件全部消失"时，先让用户**强制刷新浏览器**（清缓存）再排查；插件 README 的排障章节应写明这一点。

### 3.2 bundle 内 eagerly-evaluated 依赖会中止整个插件加载

- [#6362](https://github.com/deepseek-ai/deepseek-harness/discussions/6362)：Chromium < 122 下，`ui-sidebar-documentpreview` 中的 eagerly-evaluated pdf.js 中止插件加载，Web shell 无法启动。
- [#6180](https://github.com/deepseek-ai/deepseek-harness/discussions/6180)：`dsh-client-ui-sidebar-right` 对未随版本发布的 `dsh-client-ui-dockkit` 有 43 处硬引，Web 客户端必然加载失败。

**规避**：
- 重依赖（pdf.js、molstar 等）做**懒加载**（动态 `import()`），不要在模块顶层求值。
- 不硬引用未随当前 DSH 版本发布的新包；新包用运行时检测 + 降级。

### 3.3 dsh-client-store 曾缺 Zustand/Immer 运行时依赖

- [#6082](https://github.com/deepseek-ai/deepseek-harness/discussions/6082)：0.1.5-alpha.2 发布的 `dsh-client-store` 遗漏 Zustand/Immer 运行时依赖。

**规避**：插件如直接依赖 store 生态库，在自己的 peerDependencies 中显式声明，不要假设宿主包传递依赖完整。

---

## 四、配置与升级流程陷阱

### 4.1 配置字段重命名无迁移（官方前车之鉴）

- [#5915](https://github.com/deepseek-ai/deepseek-harness/discussions/5915)、[#6342](https://github.com/deepseek-ai/deepseek-harness/discussions/6342)：官方 `dsh-persona` 在 0.1.5-rc.1 把 `config.text` 重命名为 `prefix`，无迁移提示，用户预设无法挂载、无法创建新会话。
- [#6415](https://github.com/deepseek-ai/deepseek-harness/discussions/6415)：非法 preset 配置 → cordis 无限 reload + ~2GB 内存泄漏后 OOM，且完全静默。

**插件侧规范**：
- 配置字段重命名必须**双读兼容**（读新字段，回退旧字段），至少保留一个大版本的过渡期。
- 对非法/缺失配置**响亮报错**，不要进入无限重载或静默降级。

### 4.2 Node < 24 静默失败（import.meta.main 守卫）

- [#6124](https://github.com/deepseek-ai/deepseek-harness/discussions/6124)：DSH 0.1.5-rc.1 在 Node < 24 上完全静默失败（`import.meta.main` 守卫 + 未声明 engines）。
- [#6373](https://github.com/deepseek-ai/deepseek-harness/discussions/6373)：`pnpm run build` 在 tsx 下静默不做任何事（`import.meta.main` 守卫永不为 true）。

**插件侧规范**：
- 插件构建脚本如果用 tsx/`import.meta.main` 模式，入口改为显式 `main()` 调用，不用 main 守卫。
- `package.json` 声明 `engines.node`（DSH 0.1.5 要求 Node ≥ 24）。

### 4.3 社区升级流程实践（可直接引用）

- [#6137](https://github.com/deepseek-ai/deepseek-harness/discussions/6137)（[ybl2020/dsh-upgrade](https://github.com/ybl2020/dsh-upgrade)）：推荐四阶段升级流程——**升级前评估 → 审核放行 → 升级 → 验证**，附 7 个实测坑。

**建议给用户的升级顺序**：
1. 备份 profile（含 sessions 目录）
2. 干净 profile 启动新版 DSH，确认宿主本身可用
3. 逐个装回插件并验证
4. 遇到"会话打不开"先区分：禁用插件复现？→ 宿主迁移问题；仅启用某插件复现？→ 插件问题（回到 §1/§2 排查）

---

## 五、其他插件相关已知问题速查

| # | 问题 | 影响的插件场景 |
|---|---|---|
| [#6157](https://github.com/deepseek-ai/deepseek-harness/discussions/6157) | 插件 slash-command 输出在空白会话的首次动作时不可见 | 提供 slash command 的插件 |
| [#6166](https://github.com/deepseek-ai/deepseek-harness/discussions/6166) | 空白会话切换到已加载 preset 时丢失 subagent 工具 | 依赖 subagent 工具的插件 |
| [#5926](https://github.com/deepseek-ai/deepseek-harness/discussions/5926) | 第三方插件注册 HTTP channel → connection 启动失败 | RPC/HTTP 通道插件 |
| [#6162](https://github.com/deepseek-ai/deepseek-harness/discussions/6162) | 会话接续后，后台子代理完成报告仍投递给旧会话，父会话不在册时静默丢弃 | 后台子代理类插件 |
| [#6219](https://github.com/deepseek-ai/deepseek-harness/discussions/6219) | 会话 token 计数不含 teammates（低估 2.3×） | 基于 `ctx.tokenMeter` 做计费/统计的插件 |
| [#5887](https://github.com/deepseek-ai/deepseek-harness/discussions/5887) | `dsh-client-ui-settings-plugins` 子项配置卡片消失 | 注册 settings 卡片的插件 |
| [#5954](https://github.com/deepseek-ai/deepseek-harness/discussions/5954) | settings 里引用的孤儿模型使 llm-pi-ai 整体激活失败（静默） | 写 settings 命名空间的插件 |
| [#6221](https://github.com/deepseek-ai/deepseek-harness/discussions/6221) | settings 写入会删除外部编辑加入的同命名空间新 key | 直接写 settings 文件的插件 |

---

## 六、排障决策树

```
DSH 升级后插件异常
├─ 所有插件都不激活 / client 404
│   → §3.1 强制刷新浏览器 + 清缓存（client combo 陈旧）
├─ 旧会话打不开
│   ├─ 禁用全部插件后复现 → 宿主迁移链问题（§1.3），等官方修复/降级
│   └─ 仅某插件启用时复现 → §1.1 / §1.2（插件写入了非法 source/marker）
├─ 插件加载即崩 / 整个 Web shell 挂
│   → §3.2（eager 依赖 / 硬引用未发布包）、§2.4（重复核心包）
├─ 插件 RPC / HTTP 通道不通
│   → §2.1（405 静默失效）、§2.2（webServer 未声明）
├─ 用户预设 / 配置挂载失败
│   → §4.1（字段重命名无迁移，双读兼容）
└─ 构建脚本 / 进程静默不做事
    → §4.2（import.meta.main 守卫 + Node 版本）
```

---

*生成时间：2026-09-13　|　数据源：`dsh-discussion-summary/incremental-2026-09-12/`（#5886–#6442，544 篇增量讨论）*
