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

