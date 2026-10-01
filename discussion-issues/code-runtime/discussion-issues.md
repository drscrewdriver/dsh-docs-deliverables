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

---

## 增量补充 — #6443–#8513（2026-10-01）

> 本批次新增讨论中与本子系统相关的帖子。原始全量分析见 `dsh-discussion-summary/incremental-2026-10-01/增量分析报告.md`。

### Windows 沙箱/TLS/代理环境问题　`sandbox-windows`

- **规模**: 261 篇（正文 >500 字）

| # | 标题 | 正文 | 评论 |
|---|---|---|---|
| [#6520](https://github.com/deepseek-ai/deepseek-harness/discussions/6520) | DSH master (0.1.6-alpha.2 / ddefc45fbc) 仍未修复的问题清单（社区核实版） | 25150 | 17 |
| [#7194](https://github.com/deepseek-ai/deepseek-harness/discussions/7194) | 执行报错Cannot read properties of undefined (reading 'prepare') | 4150 | 11 |
| [#6930](https://github.com/deepseek-ai/deepseek-harness/discussions/6930) | [Windows] 托管子进程以 windowsHide: true 启动时失败 (0xC0000142) 并弹出模态错误对话框 | 1170 | 10 |
| [#7504](https://github.com/deepseek-ai/deepseek-harness/discussions/7504) | Windows: workspace-write sandbox fails with SetNamedSecurityInfoW Win32 5 when the workspace di | 16363 | 9 |
| [#7735](https://github.com/deepseek-ai/deepseek-harness/discussions/7735) | [Bug] Windows：沙箱给工作区根目录盖 Low 完整性标签后，目录内的 .bat/.cmd/.exe 双击弹「无法验证发布者」 | 13481 | 8 |
| [#6796](https://github.com/deepseek-ai/deepseek-harness/discussions/6796) | 建议：dsh web 能不能自带个方便的启动方式（后台运行 / 开机自启） | 830 | 7 |
| [#7298](https://github.com/deepseek-ai/deepseek-harness/discussions/7298) | [0.1.5-rc.2]: 在某一次对话中，dsh向我汇报了工作区外目录误删的事故，想问一下是bug还是操作问题 | 1516 | 6 |
| [#7154](https://github.com/deepseek-ai/deepseek-harness/discussions/7154) | [Bug] 沙箱升级"死选项"：广告的 sandbox_permissions 目标等于当前模式时必然抛错，且切换模式无法自愈（会话无法写盘） | 15754 | 5 |
| [#8312](https://github.com/deepseek-ai/deepseek-harness/discussions/8312) | [Bug][Windows] workspace-write leaves a permanent Low integrity label on the project, breaking  | 5566 | 5 |
| [#7468](https://github.com/deepseek-ai/deepseek-harness/discussions/7468) | [0.1.7-alpha.1 regression] dsh-http-proxy undici v8 dispatcher breaks content-encoding on inter | 2807 | 5 |
| [#7537](https://github.com/deepseek-ai/deepseek-harness/discussions/7537) | [Bug][Windows] skill-filesystem crashes dsh web when a custom skill root contains an inaccessib | 2571 | 5 |
| [#8409](https://github.com/deepseek-ai/deepseek-harness/discussions/8409) | [Bug][Windows] Windows ACL 沙箱（workspace-write）三个授权缺陷：受保护 DACL 子目录永不获授权 / desktop 根授权缓存不复核不自愈 /  | 1745 | 5 |

其余：#7485, #7720, #7842, #7816, #7907, #7874, #7108, #6629, #7807, #6555, #8232, #7134, #7517, #8193, #7079, #6488, #7499, #7033, #7709, #7875, #8395, #7638, #7771, #8249, #7223, #7323, #7292, #7646, #6599, #7836, #7622, #8485, #7804, #8336, #8048, #8376, #7528, #7510, #6515, #8204, #8113, #7750, #6898, #6571, #8303, #6818, #7329, #7876, #6758, #8295, #7854, #8472, #8403, #8314, #6684, #6820, #8208, #8175, #8501, #8383, #6714, #7545, #7538, #7921, #6483, #7639, #8275, #8421, #8339, #7306, #6822, #7846, #6802, #6935, #7126, #8272, #8174, #7244, #7898, #6517, #8322, #6655, #7106, #8268, #6646, #7216, #8412, #8411, #7957, #8067, #8238, #7320, #8056, #7395, #7523, #7598, #6992, #8001, #7871, #8426, #8265, #8313, #8513, #6465, #7519, #7877, #6543, #7257, #6575, #7152, #8136, #7860, #7378, #8266, #6536, #8387, #8420, #8032, #6789, #8219, #7899, #8025, #8223, #8160, #6944, #7593, #7662, #6444, #7652, #7055, #6544, #8453, #7266, #7067, #7603, #6624, #6508, #6447, #7531, #7069, #7567, #6719, #8143, #6649, #7955, #8170, #8508, #6636, #8209, #6701, #7250, #8115, #6814, #7140, #6445, #6917, #6884, #7912, #8471, #8153, #8098, #6446, #7944, #6448, #8448, #8494, #7259, #8161, #8130, #7021, #8158, #7381, #8293, #6685, #8205, #6869, #6962, #7583, #8011, #8141, #8142, #8122, #7267, #8093, #7904, #6801, #8450, #8451, #7164, #7364, #6561, #8356, #8463, #8311, #7640, #7254, #8331, #6457, #8449, #8019, #6606, #6450, #7732, #6925, #8263, #6689, #8282, #8315, #7277, #7671, #7246, #7093, #7578, #7916, #8497, #8059, #8415, #8469, #7693, #7319, #6938, #8261, #8259, #7724, #7121, #7890, #7476, #6879, #6461, #7163, #7915, #8262, #8177, #8305, #7426, #7886, #8410, #8264, #6777, #8260, #8062, #7575, #8401, #7333, #7190, #8429, #7784, #7500, #8225

### npm 安装/构建失败　`npm-install-build`

- **规模**: 82 篇（正文 >500 字）

| # | 标题 | 正文 | 评论 |
|---|---|---|---|
| [#7448](https://github.com/deepseek-ai/deepseek-harness/discussions/7448) | [Bug] 0.1.5-rc.* 中任意一个版本都装不上：rc.3 是一次未完成的发布 | 2045 | 7 |
| [#6678](https://github.com/deepseek-ai/deepseek-harness/discussions/6678) | DSH \| dsh-doctor + dsh-security \| 诊断与安全检查工具：40+31 项检查，含 dsh 起不来时的自救与升级前后复检 | 14046 | 5 |
| [#7436](https://github.com/deepseek-ai/deepseek-harness/discussions/7436) | [Bug] dsh@0.1.5-rc.2 / rc.3 not installable: missing @deepseek-ai/dsh-client-ui-sidebar-documen | 1558 | 5 |
| [#7431](https://github.com/deepseek-ai/deepseek-harness/discussions/7431) | @deepseek-ai/dsh is uninstallable on both `latest` and `next` — rc.3 wave shipped dsh-web-app r | 8004 | 4 |
| [#8097](https://github.com/deepseek-ai/deepseek-harness/discussions/8097) | `dsh web` fails on OpenHarmony/arm64: No usable native binding found for node-addon-require-bui | 5789 | 3 |
| [#6529](https://github.com/deepseek-ai/deepseek-harness/discussions/6529) | Tool calls crash with "Cannot read properties of undefined (reading 'prepare')" when a profile  | 3797 | 3 |
| [#7223](https://github.com/deepseek-ai/deepseek-harness/discussions/7223) | [Bug] Tool call fails with "prepare" undefined on fresh install | 3004 | 3 |
| [#7323](https://github.com/deepseek-ai/deepseek-harness/discussions/7323) | Windows 10 install fails with PowerShell 5.1 / Windows 10 使用 PowerShell 5.1 安装失败 | 2033 | 3 |
| [#8105](https://github.com/deepseek-ai/deepseek-harness/discussions/8105) | [Bug] Firefox: plain objects rejected as "not losslessly JSON-serializable" — native-constructo | 6778 | 2 |
| [#8049](https://github.com/deepseek-ai/deepseek-harness/discussions/8049) | [Windows] 桌面宿主把 ELECTRON_RUN_AS_NODE 传给 VS Code,导致「在本地打开」工作区失败(502 launch-failed) | 6268 | 2 |
| [#7850](https://github.com/deepseek-ai/deepseek-harness/discussions/7850) | 0.1.7 起两个静默升级缺口：`plugin add` 只补「本次新加」的 layer 行；`--dump-config` 对坏树恒返回 exit 0 | 4739 | 2 |
| [#7031](https://github.com/deepseek-ai/deepseek-harness/discussions/7031) | [0.1.6-alpha.2] 含 jsdom 的插件树无法启动：CJS 解析路由在 require("punycode/") 处崩溃（同 profile 在 alpha.1 正常） | 4260 | 2 |

其余：#7191, #8314, #6605, #7135, #7341, #7377, #7065, #8268, #8237, #7533, #7713, #8411, #8238, #6589, #8018, #7885, #7428, #7362, #7465, #7673, #6692, #6575, #8127, #8223, #8083, #6719, #7903, #6917, #8239, #8061, #8292, #8069, #7503, #7506, #7870, #7206, #6919, #8017, #8447, #6982, #7430, #8464, #8304, #7671, #6715, #7299, #7997, #6528, #6767, #6612, #8377, #6501, #6644, #7710, #6920, #6531, #7166, #6871, #8080, #8230, #8133, #7037, #6860, #8474, #7908, #7429, #7305, #7185, #7500, #7708

### dsh-tools 双实例 / runtime 解析分裂　`tool-runtime-duplication`

- **规模**: 74 篇（正文 >500 字）

| # | 标题 | 正文 | 评论 |
|---|---|---|---|
| [#7194](https://github.com/deepseek-ai/deepseek-harness/discussions/7194) | 执行报错Cannot read properties of undefined (reading 'prepare') | 4150 | 11 |
| [#6974](https://github.com/deepseek-ai/deepseek-harness/discussions/6974) | 0.1.6-alpha.2 regression: a source checkout now loads harness packages from both src/ and lib/, | 7130 | 8 |
| [#7011](https://github.com/deepseek-ai/deepseek-harness/discussions/7011) | [Bug] 源码启动默认 runtime 解析模式导致 dsh-tools 双实例,所有工具调用报 Cannot read properties of undefined (reading  | 7066 | 8 |
| [#6967](https://github.com/deepseek-ai/deepseek-harness/discussions/6967) | [Bug] 0.1.6-alpha.2 source launch (pnpm dsh) splits @deepseek-ai/dsh-tools across src/lib — eve | 9083 | 7 |
| [#7086](https://github.com/deepseek-ai/deepseek-harness/discussions/7086) | Tools fail to execute on a source build of dsh 0.1.6-alpha.2 (Cannot read properties of undefin | 4283 | 7 |
| [#7273](https://github.com/deepseek-ai/deepseek-harness/discussions/7273) | Source launch crashes on every tool call: Cannot read properties of undefined (reading 'prepare | 3911 | 7 |
| [#7368](https://github.com/deepseek-ai/deepseek-harness/discussions/7368) | [Bug] [0.1.6-alpha.2]Cannot read properties of undefined (reading 'prepare') on every tool call | 5694 | 6 |
| [#7219](https://github.com/deepseek-ai/deepseek-harness/discussions/7219) | [Bug] Since dsh-v0.1.6-alpha.2 every tool call fails under `pnpm dsh` source launch: `Cannot re | 3306 | 6 |
| [#7617](https://github.com/deepseek-ai/deepseek-harness/discussions/7617) | v3→v4 read-time migration refuses sessions with unresolved tool calls inside closed steps (dama | 3826 | 5 |
| [#7084](https://github.com/deepseek-ai/deepseek-harness/discussions/7084) | 源码启动（pnpm dsh）在已构建 lib/ 的树上所有工具调用失败：Cannot read properties of undefined (reading 'prepare') | 3392 | 5 |
| [#7108](https://github.com/deepseek-ai/deepseek-harness/discussions/7108) | [0.1.6] Source launch (pnpm dsh) loads @deepseek-ai/dsh-tools twice, so every tool call fails w | 4603 | 4 |
| [#7293](https://github.com/deepseek-ai/deepseek-harness/discussions/7293) | 0.1.6-alpha.2: tool calls crash with "Cannot read properties of undefined (reading 'prepare')" | 1517 | 4 |

其余：#7079, #7499, #7160, #7048, #6529, #7236, #7265, #7223, #7307, #7318, #7398, #6994, #7331, #7372, #7344, #7228, #7386, #7329, #7061, #7128, #7117, #6975, #7020, #7357, #7341, #8287, #7126, #7030, #7106, #7291, #7320, #7039, #7107, #7321, #7201, #6992, #7871, #7120, #7015, #7378, #7338, #7023, #7062, #8092, #7069, #7237, #7354, #8098, #7051, #7349, #7267, #7308, #7164, #7282, #7064, #7058, #7096, #7758, #7299, #7166, #7146, #7102

### Windows 沙箱 ACL 授权失败 / 审批洪泛　`sandbox-acl`

- **规模**: 102 篇（正文 >500 字）

| # | 标题 | 正文 | 评论 |
|---|---|---|---|
| [#6520](https://github.com/deepseek-ai/deepseek-harness/discussions/6520) | DSH master (0.1.6-alpha.2 / ddefc45fbc) 仍未修复的问题清单（社区核实版） | 25150 | 17 |
| [#7504](https://github.com/deepseek-ai/deepseek-harness/discussions/7504) | Windows: workspace-write sandbox fails with SetNamedSecurityInfoW Win32 5 when the workspace di | 16363 | 9 |
| [#7735](https://github.com/deepseek-ai/deepseek-harness/discussions/7735) | [Bug] Windows：沙箱给工作区根目录盖 Low 完整性标签后，目录内的 .bat/.cmd/.exe 双击弹「无法验证发布者」 | 13481 | 8 |
| [#7298](https://github.com/deepseek-ai/deepseek-harness/discussions/7298) | [0.1.5-rc.2]: 在某一次对话中，dsh向我汇报了工作区外目录误删的事故，想问一下是bug还是操作问题 | 1516 | 6 |
| [#8312](https://github.com/deepseek-ai/deepseek-harness/discussions/8312) | [Bug][Windows] workspace-write leaves a permanent Low integrity label on the project, breaking  | 5566 | 5 |
| [#7537](https://github.com/deepseek-ai/deepseek-harness/discussions/7537) | [Bug][Windows] skill-filesystem crashes dsh web when a custom skill root contains an inaccessib | 2571 | 5 |
| [#8409](https://github.com/deepseek-ai/deepseek-harness/discussions/8409) | [Bug][Windows] Windows ACL 沙箱（workspace-write）三个授权缺陷：受保护 DACL 子目录永不获授权 / desktop 根授权缓存不复核不自愈 /  | 1745 | 5 |
| [#7720](https://github.com/deepseek-ai/deepseek-harness/discussions/7720) | [Bug Report] Windows: workspace ACL with Modify-only (no WRITE_OWNER) makes the ACL sandbox fai | 6728 | 4 |
| [#7816](https://github.com/deepseek-ai/deepseek-harness/discussions/7816) | workspace-write sandbox fails entirely on Windows when the workspace grants no WRITE_OWNER (Set | 6315 | 4 |
| [#7907](https://github.com/deepseek-ai/deepseek-harness/discussions/7907) | [Windows] workspace-write 沙箱在工作区留下的常驻 Low 完整性标签有两个下游症状,且每次授权都会重打 | 5179 | 4 |
| [#8232](https://github.com/deepseek-ai/deepseek-harness/discussions/8232) | DSH 沙箱初始化失败：工作区位于数据盘时 grantWrite 报 Win32 5（缺 WRITE_OWNER），会话内一切命令不可用 | 1187 | 4 |
| [#7517](https://github.com/deepseek-ai/deepseek-harness/discussions/7517) | [BUG] Workspace-write 沙箱缺陷：受限进程可通过工作区内的目录 Junction 删除工作区外文件 | 756 | 4 |

其余：#8193, #6488, #7709, #7875, #7771, #7646, #7836, #7622, #8485, #7804, #8336, #8048, #8376, #7750, #7876, #7823, #8295, #8472, #8314, #8208, #8175, #8501, #8383, #6714, #7538, #6483, #7639, #8275, #8421, #8339, #6822, #7846, #8272, #8322, #7216, #8412, #8067, #7395, #8001, #8426, #8313, #8513, #7877, #6575, #8136, #8387, #8007, #8219, #8025, #8223, #8160, #6944, #7593, #6544, #8453, #7266, #6508, #7567, #8143, #8170, #8508, #6636, #8115, #6917, #7912, #8471, #8130, #8158, #7381, #8205, #6962, #7583, #8141, #8142, #6801, #6561, #8356, #8311, #7254, #6606, #7732, #8282, #7578, #7916, #8497, #6879, #6461, #7915, #8062, #8401

### macOS 沙箱 entitlements / 完整性标签　`macos-entitlements`

- **规模**: 15 篇（正文 >500 字）

| # | 标题 | 正文 | 评论 |
|---|---|---|---|
| [#8431](https://github.com/deepseek-ai/deepseek-harness/discussions/8431) | [macOS Intel][0.2.0-rc.2] 官方 x64 DMG 已存在但 Release 无下载入口；分享本地打包与兼容经验 | 3575 | 2 |
| [#7554](https://github.com/deepseek-ai/deepseek-harness/discussions/7554) | [Idea] 将 --unsigned 本地打包路径扩展到 macOS（目前仅 win-x64） | 1782 | 2 |
| [#7864](https://github.com/deepseek-ai/deepseek-harness/discussions/7864) | macOS desktop app: microphone permission can never be granted (hardened runtime, no audio-input | 3575 | 1 |
| [#7813](https://github.com/deepseek-ai/deepseek-harness/discussions/7813) | macOS Desktop first-run gaps: five reports, five concrete root causes (PATH, window zoom, fulls | 3528 | 1 |
| [#7383](https://github.com/deepseek-ai/deepseek-harness/discussions/7383) | Terminal "zsh" could not be ended: spawnSync /bin/ps EPERM inside macOS Seatbelt sandbox (nono) | 1477 | 1 |
| [#8090](https://github.com/deepseek-ai/deepseek-harness/discussions/8090) | [Bug] macOS: Voice Input is unusable — app ships hardened runtime without com.apple.security.de | 7150 | 0 |
| [#7989](https://github.com/deepseek-ai/deepseek-harness/discussions/7989) | [Bug] macOS: 硬运行时缺少麦克风 entitlement，语音输入被永久拒绝且不弹授权窗（无用户侧绕过方案） | 5830 | 0 |
| [#8061](https://github.com/deepseek-ai/deepseek-harness/discussions/8061) | [Bug] macOS arm64：自带 runtime 的 node 24.21.0 因库校验拒绝加载 adhoc 签名的原生插件预编译产物（require-builtin / node- | 5604 | 0 |
| [#7901](https://github.com/deepseek-ai/deepseek-harness/discussions/7901) | macOS: voice input is unusable — the app is signed without com.apple.security.device.audio-inpu | 4670 | 0 |
| [#7762](https://github.com/deepseek-ai/deepseek-harness/discussions/7762) | [Desktop/macOS] Voice input can never get microphone permission — hardened-runtime signature la | 3534 | 0 |
| [#8078](https://github.com/deepseek-ai/deepseek-harness/discussions/8078) | macOS: Voice input cannot reach the microphone — app ships without com.apple.security.device.au | 3398 | 0 |
| [#8134](https://github.com/deepseek-ai/deepseek-harness/discussions/8134) | [Bug][macOS] 聊天宽表格滚出可见区域后，会话标题栏空白处无法拖动窗口 | 3371 | 0 |

其余：#7785, #7972, #7059
