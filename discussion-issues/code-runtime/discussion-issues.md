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

