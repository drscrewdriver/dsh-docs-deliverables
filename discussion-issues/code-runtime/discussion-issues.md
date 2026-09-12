# Picker Worker Crash on Windows — Discussion Issues

> 来源: GitHub Discussions Windows 目录选择器崩溃相关帖子，共 34 篇去重帖子（局域网API复核家族）
> 归属: `packages/client/ui-directory-picker-browse/` — UI 目录选择器

## 症状

Windows 上目录选择器（文件资源管理器对话框）崩溃，阻止 agent 浏览或选择文件。

## 根因

[目录选择器](https://github.com/deepseek-ai/DeepSeek-Harness/tree/master/packages/client/ui-directory-picker-browse) 使用原生文件对话框，在 Windows 上行为不同。当对话框接收无效目录路径或错误处理 UNC 路径时发生崩溃。

## 临时方案

使用命令行文件导航代替 GUI 选择器，或通过直接文件操作访问文件。

## 修复状态

尚无合并的修复。目录选择器应增加错误处理和路径验证。



---


## 官方文档参考

- **子系统文档**：[`docs/subsystems/code-runtime.zh.md`](../../official-repo/docs/subsystems/code-runtime.zh.md)

## Problem Types by Discussion Family


## 官方文档更新记录

> 本系统无已提交 git 的官方文档变更记录（troubleshooting.zh.md 为自动生成，非官方文档，已移除）。

> 本系统共 4 种问题类型，覆盖 34 篇 bug 讨论


### 1. 会话日志损坏 (Session Log)


- **帖子数**: 29 篇

- **代表帖**: #30 — ！错误！无法打开文件夹  directory picker failed: directory picker failed: win32 folder dialog worker exite

- **受影响系统**: windows

- **描述**: 如图：

<img width="1063" height="891" alt="image" src="https://github.com/user-attachments/assets/cd4b3da1-97db-44fd-a405-78cef587e10f" />



系统信息：



<; 报错信息原文：directory picker failed: directory picker failed: win32 folder dialog failed: Error: Cannot find package 'D:\projects\tools\node-v24.18.0-win


- **相关讨论 ID**:

  #30, #38, #154, #236, #256, #259, #293, #449, #768, #1151

  #1221, #1503, #1620, #1684, #2716, #3388, #3442, #3484, #3505, #3508

  #3780, #3951, #4223, #4330, #4475, #4624, #4654, #4770, #5522


---


### 2. 角色映射异常 (Role Mapping)


- **帖子数**: 3 篇

- **代表帖**: #1074 — Windows: folder picker crash on Add workspace + headless profile segfault

- **受影响系统**: macos, windows

- **描述**: **Environment:** Windows 10/11, dsh 0.1.0-rc.6 (npm @deepseek-ai/dsh), node v22.20.0; On Windows, the workspace directory picker is completely unusable in the web UI (both `web` and any flow that adds a workspace). Clicking "Add workspa


- **相关讨论 ID**:

  #1074, #1523, #2707


---


### 3. 路径/文件操作 (Path/File)


- **帖子数**: 1 篇

- **代表帖**: #2683 — 新建工作区功能的一个问题

- **描述**: 现在的dsh在web上点击新建工作区时必须选择目录。但目录选择器是nodejs弹出的。如果有些许卡顿，而用户又点一次浏览器，那么目录选择对话框的窗口激活会被浏览器取代。看上去就像是没弹出来。除非用户最小化浏览器等，去找出被遮挡的文件夹选择对话框。

建议修改现有选择逻辑，或者强制选择窗口置顶？。


- **相关讨论 ID**:

  #2683


---


### 4. 安装/依赖 (Install)


- **帖子数**: 1 篇

- **代表帖**: #298 — dsh web 在 WSL2 + systemd-nspawn 中点击「添加工作区」无任何反应（原生目录选择器静默失败）

- **描述**: ---

name: Bug

about: 记录现有预期行为的失效

title: 'WSL2 + systemd-nspawn 下 dsh web 点击「添加工作区」无任何反应'

labels: 'area: web'

type: Bug

---



zenity 打开显示失败（退出码 


- **相关讨论 ID**:

  #298

---

## 增量补充 — #5886–#6442（2026-09-12）

> 本批次新增讨论中与本子系统相关的帖子。原始全量分析见 `dsh-discussion-summary/incremental-2026-09-12/增量分析报告.md`。

### Windows 沙箱/TLS/代理环境问题　`sandbox-windows`

- **规模**: 42 篇（正文 >500 字）

| # | 标题 | 正文 | 评论 |
|---|---|---|---|
| [#6259](https://github.com/deepseek-ai/deepseek-harness/discussions/6259) | [Bug] revealNativePath ("Show in File Explorer") silently fails for non-ASCII/CJK paths on Wind | 4851 | 3 |
| [#6107](https://github.com/deepseek-ai/deepseek-harness/discussions/6107) | [Bug] TOOL_OUTCOME_UNKNOWN / TOOL_NOT_STARTED 合成结果缺少恢复语义：用户与模型都误判为真实工具失败（0.1.5-rc.1） | 2993 | 3 |
| [#6035](https://github.com/deepseek-ai/deepseek-harness/discussions/6035) | Bug: Tool call with empty name/id → Error: unknown tool "" (UNKNOWN_TOOL) | 2166 | 3 |
| [#5952](https://github.com/deepseek-ai/deepseek-harness/discussions/5952) | [Bug] 会话日志损坏：长工具调用执行期间中断回合，导致 seq 重复（中断修复路径使用了过期的 seq 基线） | 895 | 3 |
| [#6015](https://github.com/deepseek-ai/deepseek-harness/discussions/6015) | [Proposal] Make sandbox escalation session-aware and ignore redundant same-mode requests | 2208 | 2 |
| [#6215](https://github.com/deepseek-ai/deepseek-harness/discussions/6215) | Bug/Design: approveEscalation 在 effectiveMode 为 danger-full-access 时拒绝同级/降级升级导致模型死锁循环 | 2106 | 2 |
| [#6100](https://github.com/deepseek-ai/deepseek-harness/discussions/6100) | 审批层 fail-closed 时工具文案写作 "user rejected"，会让模型误归因到用户 | 1110 | 2 |
| [#6196](https://github.com/deepseek-ai/deepseek-harness/discussions/6196) | [BUG] dsh web 启动到打印 URL 约 18s，其中约 9.3s 来自 client-modules 每次启动重复 8 次全量重建组合包 | 21748 | 1 |
| [#6426](https://github.com/deepseek-ai/deepseek-harness/discussions/6426) | [Windows] Case-duplicate proxy variables in the child environment break PowerShell Env: provide | 9598 | 1 |
| [#6288](https://github.com/deepseek-ai/deepseek-harness/discussions/6288) | [Bug] 版本0.1.5-rc.1 Windows 沙盒下原生命令输出无法被 PowerShell 变量捕获（静默返回空值 + 0xC0000142 弹框） | 6948 | 1 |
| [#6209](https://github.com/deepseek-ai/deepseek-harness/discussions/6209) | [Bug]: Windows native Job subprocess flashes console windows under console-less GUI hosts | 5314 | 1 |
| [#5962](https://github.com/deepseek-ai/deepseek-harness/discussions/5962) | [Windows] Host process exits on uncaughtException (ENOENT) when the subprocess spill dir is del | 5196 | 1 |

其余：#6272, #6098, #5964, #6403, #6225, #6293, #6274, #6431, #6349, #5998, #6260, #6335, #6182, #6027, #6275, #6392, #6171, #6158, #6192, #6154, #5958, #6235, #6247, #5886, #6187, #6442, #6137, #6245, #6018, #6011

### npm 安装/构建失败　`npm-install-build`

- **规模**: 22 篇（正文 >500 字）

| # | 标题 | 正文 | 评论 |
|---|---|---|---|
| [#5926](https://github.com/deepseek-ai/deepseek-harness/discussions/5926) | [Bug] connection fails to start when a third-party plugin registers an HTTP channel: cannot get | 2761 | 6 |
| [#5929](https://github.com/deepseek-ai/deepseek-harness/discussions/5929) | 0.1.3.Alpha.2，引入了 fs-ext@2.1.1 无预编译二进制，强制本地 MSVC 编译 | 1679 | 6 |
| [#6124](https://github.com/deepseek-ai/deepseek-harness/discussions/6124) | [Bug] dsh 0.1.5-rc.1 在 Node.js < 24 上完全静默失败(import.meta.main 守卫 + 未声明 engines) | 2106 | 5 |
| [#6115](https://github.com/deepseek-ai/deepseek-harness/discussions/6115) | npx 启动不成功程序直接退出 `@deepseek-ai/dsh` (published package) silently exits with code 0 on Node < 24. | 4425 | 3 |
| [#6372](https://github.com/deepseek-ai/deepseek-harness/discussions/6372) | [Bug] 0.1.5-rc.2 桌面端 prepare:dsh 必然失败：payload smoke 断言已被移除的 fs-ext，无法产出 resources/dsh | 3919 | 3 |
| [#6082](https://github.com/deepseek-ai/deepseek-harness/discussions/6082) | [Bug] 0.1.5-alpha.2: published dsh-client-store omits Zustand/Immer runtime dependencies | 2520 | 3 |
| [#5949](https://github.com/deepseek-ai/deepseek-harness/discussions/5949) | @deepseek-ai/dsh@0.1.3-alpha.2 cannot be installed without a C++ toolchain: new hard dependency | 2705 | 2 |
| [#5988](https://github.com/deepseek-ai/deepseek-harness/discussions/5988) | [dsh-v0.1.5-alpha.1] `pnpm install` 缺少 transitive dep `unrun`，`pnpm run build` 失败 | 1432 | 2 |
| [#6201](https://github.com/deepseek-ai/deepseek-harness/discussions/6201) | [Bug] dsh web 0.1.5-rc.1: silent process death (0xC0000409) loses in-flight turns - 12 deaths / | 19075 | 1 |
| [#6272](https://github.com/deepseek-ai/deepseek-harness/discussions/6272) | [Bug] 桌面打包 prepare:dsh 必然失败：烟雾测试仍在 require 已被替换的 fs-ext | 4120 | 1 |
| [#6355](https://github.com/deepseek-ai/deepseek-harness/discussions/6355) | v0→v3 session migration refuses legacy plugin-injected message sources (history fails to load a | 2141 | 1 |
| [#5969](https://github.com/deepseek-ai/deepseek-harness/discussions/5969) | pnpm install fails: dsh monolith dependency ranges cannot select published prerelease siblings  | 2022 | 1 |

其余：#5927, #6225, #6441, #6232, #6148, #6003, #6043, #6247, #5945, #6341
