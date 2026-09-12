# Remote Access 403 Error — Discussion Issues

> 来源: GitHub Discussions 远程访问 403 相关帖子，共 61 篇去重帖子（局域网API复核家族）
> 归属: `packages/client/web-server/` — Web 服务器 Origin 校验

## 症状

尝试从远程机器（非 localhost）访问 DSH Web UI 时，服务器返回 403 Forbidden 错误。

## 根因

[Web 服务器子系统](../../official-repo/docs/subsystems/web-server.md) 实现 Host/Origin 头部校验以防止开放 Web 访问攻击。当请求的 `Host` 或 `Origin` 头部不匹配预期的本地接口（如 `127.0.0.1:3080`）时，服务器以 403 拒绝。这是安全特性 — 绑定所有接口（`0.0.0.0`）并放宽 Origin 检查会将 harness 暴露给未认证访问。

```ts type-equiv
/**
 * Origin validation result. The web server rejects requests whose Host or
 * Origin header does not match the configured allowlist. This prevents open
 * web access when the server binds to 0.0.0.0.
 */
type OriginCheckResult = 'allowed' | 'rejected'
```

## 受影响场景

- 在远程 Linux 服务器或 VM 上运行 `dsh --profile web`
- Docker 容器中 `Host` 与容器内部 IP 不同时
- SSH 隧道中 `Host` 头部携带远程主机名时

## 临时方案

1. **使用 SSH 隧道** — 将本地端口转发到远程服务器的 DSH 端口：`ssh -L 3080:127.0.0.1:3080 user@remote`。这可在 Host 头部保留 `127.0.0.1`。
2. **配置允许的原点** — [Web 服务器子系统](../../official-repo/docs/subsystems/web-server.md) 通过部署设置允许 Origin 配置。设置允许的原点以匹配访问方式。
3. **使用反向代理** — 配置 nginx 或 Caddy 转发带有正确 `Host` 和 `Origin` 头部的请求。

## 修复状态

Origin 校验是安全特性，文档在 [web-server](../../official-repo/docs/subsystems/web-server.md) 子系统。配置 API 应补充远程访问场景的显式示例文档。



---


## 官方文档参考

- **子系统文档**：[`docs/subsystems/web-server.zh.md`](../../official-repo/docs/subsystems/web-server.zh.md)

## Problem Types by Discussion Family


## 官方文档更新记录

> 本系统无已提交 git 的官方文档变更记录（troubleshooting.zh.md 为自动生成，非官方文档，已移除）。

> 本系统共 10 种问题类型，覆盖 58 篇 bug 讨论


### 1. 会话日志损坏 (Session Log)


- **帖子数**: 25 篇

- **代表帖**: #322 — Directory picker returns 403 via 127.0.0.1 but works via localhost

- **描述**: ## Reproduction
1. Start the Web UI with `pnpm dsh web`.
2. Open `http://127.0.0.1:3080`.
3. Click **Select workspace** and choose a directory.; <img width="841" height="343" alt="image" src="https://github.com/user-attachments/assets/85521c46-c567-4b01-b13a-be175b1f5df1" />



[dsh-session-ses


- **相关讨论 ID**:

  #322, #652, #849, #894, #910, #950, #1188, #1733, #2133, #2160

  #2177, #2234, #2274, #2339, #2396, #2760, #3106, #3209, #3210, #3385

  #4032, #5430, #5523, #5653, #5829


---


### 2. 安装/依赖 (Install)


- **帖子数**: 14 篇

- **代表帖**: #153 — dsh web 输出的访问地址与实际可访问地址不一致

- **受影响系统**: macos, windows

- **描述**: 使用 dsh 测试版运行 `dsh web` 时发现，CLI 输出的访问地址与实际可以正常工作的地址不一致。



环境：



* Windows

* 使用 pnpm

* dsh 测试版

* 通过 `pnpm dsh web` 启动



启动命令：



```text

pnpm dsh; **关键证据（同一台机器、同一个正在运行的服务）**
我用 curl 对 `127.0.0.1:3080` 做对照测试：


- **相关讨论 ID**:

  #153, #313, #764, #900, #1119, #1132, #1323, #2009, #2372, #2502

  #4401, #4541, #4599, #5162


---


### 3. 路径/文件操作 (Path/File)


- **帖子数**: 6 篇

- **代表帖**: #353 — 打不开文件夹

- **描述**: Couldn’t open folder



transport failure for /api/host.pickDirectory: HTTP 403; dsh Web 目前**明确拒绝** `--host 0.0.0.0`（`packages/bundle/web-app/src/startup.ts` 69-70 行）：


- **相关讨论 ID**:

  #353, #397, #538, #654, #2954, #3521


---


### 4. 内存泄漏/OOM (Memory)


- **帖子数**: 4 篇

- **代表帖**: #860 — [Bug Report] 欢迎弹窗（内测声明）在 settings 写入被拒时把用户永久锁死：无法关闭、只能无限重试"暂时无法保存确认状态，请重试"

- **描述**: 欢迎弹窗（WelcomeNotice）的确认动作走**特权 RPC** `settings.mutate`（`ui-onboarding.welcomeNoticeVersion`），而 `settings.*` 系列被信任围栏**钉死在 loopback + 同源**（`PRIVILEGED_ME; 把 `dsh web` 放在 Cloudflare Tunnel 和 Access 后面，DSH 本身仍然只监听 `127.0.0.1:3080`：



```text

浏览器

  → Cloudflare Tunnel + Access

    → 127.0.0.1:3080

  


- **相关讨论 ID**:

  #860, #2030, #2403, #4695


---


### 5. 网络/认证 (Network/Auth)


- **帖子数**: 4 篇

- **代表帖**: #128 — Bug：/api/host.listDirectory报HTTP 403

- **描述**: 这个有解决方法吗从wsl里拉出来报HTTP 403

<img width="2559" height="1347" alt="415b64bdc24f1d57789de67e0b3dcb08" src="https://github.com/user-attachments/assets/1882; 这玩意感觉半成品的味道有一点重啊



我是tailscale + 远程服务器的方式来做的，反正是骗过了dsh



1. tailscale自己设置的DNS域名，所以是自己给自己发的域名

2. 我就一个客户端，所以自己给自己颁发了CA，解决了页面上uuid的问题

3. Nginx转发，解决


- **相关讨论 ID**:

  #128, #242, #653, #756


---


### 6. Shell/信号 (Shell/Signal)


- **帖子数**: 1 篇

- **代表帖**: #4160 — [frp 公网访问修复] 11 项兼容性补丁脚本 (Cloudflare CDN + 非安全上下文)

- **描述**: 通过 frp 公网 HTTP 地址访问 DeepSeek Harness web UI 时，存在多个兼容性问题导致无法正常工作。


- **相关讨论 ID**:

  #4160


---


### 7. 配置/Schema (Config)


- **帖子数**: 1 篇

- **代表帖**: #3810 — transport failure for /api/agentPreset.list: HTTP 403

- **描述**: 当打开http://127.0.0.1:3080的时候，会报错transport failure for /api/agentPreset.list: HTTP 403，只有打开http://localhost:3080/才能正常使用


- **相关讨论 ID**:

  #3810


---


### 8. 子代理生命周期 (Subagent Lifecycle)


- **帖子数**: 1 篇

- **代表帖**: #3459 — 希望为特权 API 方法增加 privilegedTrustedHosts 配置项

- **描述**: 在反向代理（如 oauth2-proxy）后面部署 dsh 时，特权 API 方法（`settings.*`、`credentials.*`、`llm.discoverModels` 等）即使配置了 `--trusted-host` 也返回 403。


- **相关讨论 ID**:

  #3459


---


### 9. 角色映射异常 (Role Mapping)


- **帖子数**: 1 篇

- **代表帖**: #2452 — 一个通用 P2P 隧道方案：DSH 的 loopback 同源限制在远程访问下的处理

- **描述**: DeepSeek Harness（DSH）将配置面板限制为 loopback 同源，用于防范 DNS rebinding，这一设计是合理的。但该限制对远程访问提出了额外要求：通过局域网 IP 直连时 /api 返回 403，通过域名或隧道访问时设置面板为空（设置仅存在于进程内存），--trusted


- **相关讨论 ID**:

  #2452


---


### 10. UI/弹窗 (UI/Dialog)


- **帖子数**: 1 篇

- **代表帖**: #437 — Ask: 端口转发跨host后工作记录显示缺失

- **描述**: ## 环境



- 平台：Windows_x64

- 版本：`0.1.0-rc.6`





## 问题描述



我希望在与PC**同局域网**的其他设备上(手机)访问PC的dsh，尝试使用dsh的参数**未果**(--host不允许设置0.0.0.0、设置局域网IP又抛出错误)后，设置了n


- **相关讨论 ID**:

  #437

---

## 增量补充 — #5886–#6442（2026-09-12）

> 本批次新增讨论中与本子系统相关的帖子。原始全量分析见 `dsh-discussion-summary/incremental-2026-09-12/增量分析报告.md`。

### 升级后 client bundle 陈旧失效　`client-bundle-stale`

- **规模**: 13 篇（正文 >500 字）

| # | 标题 | 正文 | 评论 |
|---|---|---|---|
| [#6081](https://github.com/deepseek-ai/deepseek-harness/discussions/6081) | Web bundle should declare modules -> webServer activation dependency | 3485 | 3 |
| [#5999](https://github.com/deepseek-ai/deepseek-harness/discussions/5999) | [0.1.5-alpha.1] 升级既有 profile 后 client combo 缺失新增 bundle 模块（ui-sidebar-* 404 / loaded without re | 3651 | 2 |
| [#6280](https://github.com/deepseek-ai/deepseek-harness/discussions/6280) | [Feature] 正文内容宽度升级为一等设置项：可持久化 + 上限可调（当前自适应封顶 920px） | 3502 | 1 |
| [#6180](https://github.com/deepseek-ai/deepseek-harness/discussions/6180) | 【Bug】0.1.5-rc.1 Web 客户端必然加载失败：dsh-client-ui-sidebar-right 对未随版本发布的 @deepseek-ai/dsh-client-ui-d | 3236 | 1 |
| [#6369](https://github.com/deepseek-ai/deepseek-harness/discussions/6369) | [性能] dsh web 启动 6-7s：client-modules bundle 组装逐字符扫描约 15MB 源码（附 CPU profile 数据） | 2394 | 1 |
| [#6374](https://github.com/deepseek-ai/deepseek-harness/discussions/6374) | [Bug] Served index.html missing Cache-Control: no-store — cached documents break boot after reb | 2161 | 1 |
| [#6373](https://github.com/deepseek-ai/deepseek-harness/discussions/6373) | [Bug] pnpm run build silently does nothing under tsx (import.meta.main guard never true) | 1630 | 1 |
| [#6398](https://github.com/deepseek-ai/deepseek-harness/discussions/6398) | [Bug] 0.1.5 模型目录缓存失败状态，“重试”无法重新加载第三方模型 | 1099 | 1 |
| [#6232](https://github.com/deepseek-ai/deepseek-harness/discussions/6232) | [生态观察 #002] DeepSeek Harness v0.1.5 生态影响实测:零兼容破坏、Node 静默坑与 1522 插件的分层时刻 | 4323 | 0 |
| [#6362](https://github.com/deepseek-ai/deepseek-harness/discussions/6362) | # [BUG]在Chromium版本<122时，Web shell无法启动：ui-sidebar-documentpreview中的eagerly-evaluated pdf.js会中止插件 | 4272 | 0 |
| [#6202](https://github.com/deepseek-ai/deepseek-harness/discussions/6202) | Fail soft on client-module registration mismatch: validate at dsh plugin add + isolate single-m | 4232 | 0 |
| [#6217](https://github.com/deepseek-ai/deepseek-harness/discussions/6217) | Bug: Web GUI file preview shows "file resource service unavailable" on Chromium <= 125 — protoc | 3965 | 0 |

其余：#6128

### dsh web 进程静默死亡　`web-process-death`

- **规模**: 18 篇（正文 >500 字）

| # | 标题 | 正文 | 评论 |
|---|---|---|---|
| [#6124](https://github.com/deepseek-ai/deepseek-harness/discussions/6124) | [Bug] dsh 0.1.5-rc.1 在 Node.js < 24 上完全静默失败(import.meta.main 守卫 + 未声明 engines) | 2106 | 5 |
| [#6338](https://github.com/deepseek-ai/deepseek-harness/discussions/6338) | 关于疑似卡巴斯基 HTTPS 扫描导致 Node.js 访问 api.deepseek.com 报 SELF_SIGNED_CERT_IN_CHAIN 的反馈 | 3544 | 4 |
| [#6259](https://github.com/deepseek-ai/deepseek-harness/discussions/6259) | [Bug] revealNativePath ("Show in File Explorer") silently fails for non-ASCII/CJK paths on Wind | 4851 | 3 |
| [#6115](https://github.com/deepseek-ai/deepseek-harness/discussions/6115) | npx 启动不成功程序直接退出 `@deepseek-ai/dsh` (published package) silently exits with code 0 on Node < 24. | 4425 | 3 |
| [#6201](https://github.com/deepseek-ai/deepseek-harness/discussions/6201) | [Bug] dsh web 0.1.5-rc.1: silent process death (0xC0000409) loses in-flight turns - 12 deaths / | 19075 | 1 |
| [#6288](https://github.com/deepseek-ai/deepseek-harness/discussions/6288) | [Bug] 版本0.1.5-rc.1 Windows 沙盒下原生命令输出无法被 PowerShell 变量捕获（静默返回空值 + 0xC0000142 弹框） | 6948 | 1 |
| [#5962](https://github.com/deepseek-ai/deepseek-harness/discussions/5962) | [Windows] Host process exits on uncaughtException (ENOENT) when the subprocess spill dir is del | 5196 | 1 |
| [#6415](https://github.com/deepseek-ai/deepseek-harness/discussions/6415) | [dsh] 非法 preset 配置 → cordis 无限 reload + ~2GB 内存泄漏（~20 分钟后 OOM），且完全静默 | 3430 | 1 |
| [#5995](https://github.com/deepseek-ai/deepseek-harness/discussions/5995) | harness 进程内存随会话事件数持续增长，长批次约 8 小时后堆触顶 OOM 退出（附测量与采样归因） | 1639 | 1 |
| [#6373](https://github.com/deepseek-ai/deepseek-harness/discussions/6373) | [Bug] pnpm run build silently does nothing under tsx (import.meta.main guard never true) | 1630 | 1 |
| [#6225](https://github.com/deepseek-ai/deepseek-harness/discussions/6225) | [Bug] PM2 托管下 `dsh web` 静默空转：PM2 的 fork 容器用 `import()` 加载 `bin.ts`，`import.meta.main` 为 false（o | 11248 | 0 |
| [#6001](https://github.com/deepseek-ai/deepseek-harness/discussions/6001) | [Bug] Cross-process cold attach: observeSession/promote commits crash-repair closers against a  | 8887 | 0 |

其余：#6267, #6232, #6006, #5994, #6273, #6341

### dsh web 启动性能退化　`web-startup-perf`

- **规模**: 14 篇（正文 >500 字）

| # | 标题 | 正文 | 评论 |
|---|---|---|---|
| [#6081](https://github.com/deepseek-ai/deepseek-harness/discussions/6081) | Web bundle should declare modules -> webServer activation dependency | 3485 | 3 |
| [#6391](https://github.com/deepseek-ai/deepseek-harness/discussions/6391) | [性能/根因] dsh web 启动 2.7s → 17s：0.1.5 的 feat: electron 打包 让 client-modules 全量重组合由 1 次变 8 次（附单文件隔离 | 8947 | 2 |
| [#5999](https://github.com/deepseek-ai/deepseek-harness/discussions/5999) | [0.1.5-alpha.1] 升级既有 profile 后 client combo 缺失新增 bundle 模块（ui-sidebar-* 404 / loaded without re | 3651 | 2 |
| [#6427](https://github.com/deepseek-ai/deepseek-harness/discussions/6427) | [Bug][性能] 0.1.5-rc.2 Web UI 空闲态主线程占用约 50%、布局约 144 次/秒（≈每帧一次），拖拽窗口 resize 明显卡顿 | 2678 | 2 |
| [#6196](https://github.com/deepseek-ai/deepseek-harness/discussions/6196) | [BUG] dsh web 启动到打印 URL 约 18s，其中约 9.3s 来自 client-modules 每次启动重复 8 次全量重建组合包 | 21748 | 1 |
| [#6415](https://github.com/deepseek-ai/deepseek-harness/discussions/6415) | [dsh] 非法 preset 配置 → cordis 无限 reload + ~2GB 内存泄漏（~20 分钟后 OOM），且完全静默 | 3430 | 1 |
| [#6180](https://github.com/deepseek-ai/deepseek-harness/discussions/6180) | 【Bug】0.1.5-rc.1 Web 客户端必然加载失败：dsh-client-ui-sidebar-right 对未随版本发布的 @deepseek-ai/dsh-client-ui-d | 3236 | 1 |
| [#5957](https://github.com/deepseek-ai/deepseek-harness/discussions/5957) | Feature Request: Official extension directory for user plugins with stable service injection | 2836 | 1 |
| [#6369](https://github.com/deepseek-ai/deepseek-harness/discussions/6369) | [性能] dsh web 启动 6-7s：client-modules bundle 组装逐字符扫描约 15MB 源码（附 CPU profile 数据） | 2394 | 1 |
| [#6374](https://github.com/deepseek-ai/deepseek-harness/discussions/6374) | [Bug] Served index.html missing Cache-Control: no-store — cached documents break boot after reb | 2161 | 1 |
| [#5910](https://github.com/deepseek-ai/deepseek-harness/discussions/5910) | [Bug] Commands/list Flood Pins CPU / 自持式 commands/list 洪泛占满 CPU | 14095 | 0 |
| [#6202](https://github.com/deepseek-ai/deepseek-harness/discussions/6202) | Fail soft on client-module registration mismatch: validate at dsh plugin add + isolate single-m | 4232 | 0 |

其余：#6128, #6346

### Composer 输入法/翻译干扰　`composer-ime`

- **规模**: 13 篇（正文 >500 字）

| # | 标题 | 正文 | 评论 |
|---|---|---|---|
| [#6231](https://github.com/deepseek-ai/deepseek-harness/discussions/6231) | [Bug] Web composer stuck in IME composition — Enter stops submitting, keystrokes duplicate (Win | 7072 | 1 |
| [#6284](https://github.com/deepseek-ai/deepseek-harness/discussions/6284) | 第三方宿主（Obsidian 插件）嵌入 DSH Web UI 的若干集成障碍：输入框无可编程写入接口、iframe 嵌入缺少支持的认证方式、插件注入消息缺少身份会污染会话、会话格式容错不足 | 2732 | 1 |
| [#6360](https://github.com/deepseek-ai/deepseek-harness/discussions/6360) | Composer breaks under browser translation: IME input becomes garbled/reordered while paste work | 8290 | 0 |
| [#6052](https://github.com/deepseek-ai/deepseek-harness/discussions/6052) | [Bug] Web composer: Lexical error #14 (infinite transform loop) and amber/missing text when typ | 7939 | 0 |
| [#5959](https://github.com/deepseek-ai/deepseek-harness/discussions/5959) | [Computer Use][电脑操控]:让Agent直接操控你的Windows 桌面（输入+鼠标） | 7297 | 0 |
| [#6258](https://github.com/deepseek-ai/deepseek-harness/discussions/6258) | [Feature Request] Configurable composer send shortcut: Ctrl/Cmd+Enter to send, Enter inserts a  | 4040 | 0 |
| [#5938](https://github.com/deepseek-ai/deepseek-harness/discussions/5938) | DSH \| Session Notes \| Highlight & annotate conversation messages with sticky notes | 3774 | 0 |
| [#6271](https://github.com/deepseek-ai/deepseek-harness/discussions/6271) | Composer: with an IME, the Enter that ends a composition inserts a newline instead of sending ( | 3527 | 0 |
| [#6061](https://github.com/deepseek-ai/deepseek-harness/discussions/6061) | [Bug] 桌面端（dev:desktop / 打包版）在 macOS 上 ⌘V 粘贴失效，导致无法输入 API Key 配置模型 | 3155 | 0 |
| [#6269](https://github.com/deepseek-ai/deepseek-harness/discussions/6269) | [Bug] 启用带连字（ligature/calt）的字体后，Web 输入框开头字符不显示 | 2805 | 0 |
| [#6347](https://github.com/deepseek-ai/deepseek-harness/discussions/6347) | [Feature] Composer 输入历史回溯：PageUp/PageDown + 上下方向键 | 2540 | 0 |
| [#5895](https://github.com/deepseek-ai/deepseek-harness/discussions/5895) | [Bug] Composition-adjacent events can slip past the guard within the old 10ms window | 1825 | 0 |

其余：#6313
