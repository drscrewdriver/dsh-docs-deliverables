# Windows Chinese Path Cut-off — Discussion Issues

> 来源: GitHub Discussions Windows 中文路径截断相关帖子，共 69 篇去重帖子（局域网API复核家族）
> 归属: `packages/fs/fs/` — 文件系统 UTF-8 路径处理

## 症状

Windows 系统上含中文字符的文件名或路径的文件读写编辑操作在首个低字节值为 `0x00` 处静默截断路径，将多字节 UTF-8 序列误作以 null 结尾的 C 字符串。

## 根因

[文件系统子系统](../../official-repo/docs/subsystems/filesystem.zh.md) 使用 `readUtf16` 辅助函数检查 16 位字符的低字节是否为 `0x00` — 这是检测 UTF-16LE 中 null 字节的标准技术。然而，此检查错误地应用于 UTF-8 编码路径。UTF-8 中，中文字符编码为 3 字节序列，其中中字节或首字节在解释为 16 位小端字时可能为 `0x00`，导致过早截断。

```ts type-equiv
/**
 * A path cut-off bug in the file read pipeline: the UTF-8 path string is
 * incorrectly checked for null bytes using a UTF-16 LE interpretation,
 * cutting off at the first multi-byte character whose low byte is 0x00.
 * Affects all file operations on Windows with Chinese paths.
 */
type PathCutOffBug = 'readUtf16 checks low byte of UTF-8 string'
```

## 受影响操作

- `read` — 文件内容截断，返回不完整数据
- `write` — 路径截断，无法在中文字符路径创建文件
- `edit` — 无法在中文字符目录查找文件
- 文件树浏览器 — 中文目录不可浏览

## 临时方案

1. **使用 ASCII 路径** — 工作区路径避免中文字符、emoji 或非 ASCII 字符。
2. **符号链接** — 从 ASCII 路径创建到中文路径目录的符号链接。
3. **更改工作区位置** — 将项目移至仅含 ASCII 字符的路径（如 `E:\projects\myproject`）。

## 修复状态

这是 P0 严重性 bug，已在 17 篇 GitHub 讨论中独立报告。修复位置：`packages/fs/fs/src/utf16` — 应移除低字节检查或将其限制于 UTF-16 路径。



---


## 官方文档参考

- **子系统文档**：[`docs/subsystems/filesystem.zh.md`](../../official-repo/docs/subsystems/filesystem.zh.md)

## Problem Types by Discussion Family


## 官方文档更新记录

> 本系统无已提交 git 的官方文档变更记录（troubleshooting.zh.md 为自动生成，非官方文档，已移除）。

> 本系统共 3 种问题类型，覆盖 67 篇 bug 讨论


### 1. 会话日志损坏 (Session Log)


- **帖子数**: 57 篇

- **代表帖**: #107 — issue: 非常逆天的bug,中文路径选择截断. 目前看来bug可能有点多

- **受影响系统**: windows

- **描述**: win上选工作区,native picker会截断中文路径. packages/host/directory-picker-native/src/win32-dialog-bindings.ts的 readUtf16用"单字节是否为 0"来判断 UTF-16 字符串结束,导致「开」= U+5F00,; # Bug 反馈：Windows 原生目录选择器在低字节为 0x00 的字符（如 一 U+4E00）处截断所选路径，导致 `workspace create failed: workspace-invalid-path` / ENOENT



## 问题概述



在 Windows 上，原生


- **相关讨论 ID**:

  #107, #151, #210, #244, #295, #396, #428, #488, #563, #580

  #617, #643, #644, #727, #761, #800, #945, #948, #1009, #1528

  #1653, #1660, #1777, #2126, #2268, #2355, #2362, #2386, #2451, #2479

  #2495, #2519, #2728, #2757, #2777, #2959, #3010, #3279, #3291, #3313

  #3388, #3419, #3442, #3484, #3505, #3508, #3780, #3943, #4475, #4624

  #4654, #4760, #4878, #4907, #4986, #5452, #5480


---


### 2. 路径/文件操作 (Path/File)


- **帖子数**: 8 篇

- **代表帖**: #202 — 文件不能拖进窗口里面

- **受影响系统**: windows

- **描述**: - 希望侧边栏能做成文件列表

- 现在打 `@` 也不会弹出文件选择

- 拖动到窗口里面的文件只支持图片（但是ds又不支持识图，有点招）

- 选择工作区的时候有些路径打不开，不知道为啥。显示workspace create failed: workspace-invalid-path: can; [redacted by author — privacy]


- **相关讨论 ID**:

  #202, #701, #970, #1010, #2279, #2464, #3188, #4892


---


### 3. 安装/依赖 (Install)


- **帖子数**: 2 篇

- **代表帖**: #953 — [Bug Report] Windows 原生文件夹对话框把含 U+XX00 汉字（开/一/上/下…）的路径静默截断（UTF-16 终止判定只看低字节）

- **受影响系统**: windows

- **描述**: **Windows 原生文件夹对话框返回的路径被静默截断**：`readUtf16` 用 `bytes[end] !== 0` 逐 2 字节扫描 UTF-16LE 字符串，但只检查每个码元的**低字节**；「开」U+5F00 的 UTF-16LE 编码是 `00 5F`（低字节恰为 0x00），被误判为 NUL 终止符。`@deepseek-ai/dsh-host-directory-picker-native` npm 发布版（0.1.1-rc.2）仍会截断含 U+XX00 汉字的路径。该 bug 已在 master 修复（commit `51c2427`：作者日期 2026-08-14，合入日期 2026-08-23 via PR #2956）。


- **相关讨论 ID**:

  #953, #5097

---

## 增量补充 — #5886–#6442（2026-09-12）

> 本批次新增讨论中与本子系统相关的帖子。原始全量分析见 `dsh-discussion-summary/incremental-2026-09-12/增量分析报告.md`。

### Windows「在资源管理器中显示」静默失败　`windows-reveal`

- **规模**: 14 篇（正文 >500 字）

| # | 标题 | 正文 | 评论 |
|---|---|---|---|
| [#6259](https://github.com/deepseek-ai/deepseek-harness/discussions/6259) | [Bug] revealNativePath ("Show in File Explorer") silently fails for non-ASCII/CJK paths on Wind | 4851 | 3 |
| [#6438](https://github.com/deepseek-ai/deepseek-harness/discussions/6438) | [Bug] "Show in File Explorer" on Windows reveals the file in an invisible window (and never rev | 7499 | 1 |
| [#5964](https://github.com/deepseek-ai/deepseek-harness/discussions/5964) | [Bug] WSL 下启动的 dsh，「在应用中打开」无法唤起 VS Code / 资源管理器（应用目录表缺少 WSL 感知） | 3072 | 1 |
| [#5921](https://github.com/deepseek-ai/deepseek-harness/discussions/5921) | dsh-file-explorer: 轻量级可扩展的 DSH Web 的文件浏览器插件：浏览工作区文件树、预览文件，支持通过插件扩展预览器。 | 2954 | 1 |
| [#6293](https://github.com/deepseek-ai/deepseek-harness/discussions/6293) | [Windows] "Show in File Explorer" produces no window but reports success | 8622 | 0 |
| [#6349](https://github.com/deepseek-ai/deepseek-harness/discussions/6349) | [Bug] Windows：「在本地打开」不打开目录，反而把已打开的目录窗口隐藏 | 6982 | 0 |
| [#6234](https://github.com/deepseek-ai/deepseek-harness/discussions/6234) | [bug] Windows: "reveal in file manager" is a silent no-op — percent-encoded file URL falls back | 6916 | 0 |
| [#6182](https://github.com/deepseek-ai/deepseek-harness/discussions/6182) | [Bug] Windows: revealNativePath never shows a window, and opens the Desktop instead of the targ | 5176 | 0 |
| [#6159](https://github.com/deepseek-ai/deepseek-harness/discussions/6159) | [Feature] 右侧 Sidebar 文件树缺少「在资源管理器中显示」（主机侧能力已就绪，仅客户端未接） | 4416 | 0 |
| [#6154](https://github.com/deepseek-ai/deepseek-harness/discussions/6154) | [Bug] Web 交付卡片的「在文件资源管理器中显示」只创建隐藏窗口（Windows） | 2910 | 0 |
| [#6235](https://github.com/deepseek-ai/deepseek-harness/discussions/6235) | DSH｜dsh-reveal-fix｜修掉 Windows 上「在文件资源管理器中显示」的静默失败 | 2806 | 0 |
| [#6187](https://github.com/deepseek-ai/deepseek-harness/discussions/6187) | [Bug] Windows 上「在文件资源管理器中显示」在含中文/非 ASCII 的路径下只打开默认文件夹，不定位文件 | 2094 | 0 |

其余：#6442, #6384

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

---

## 增量补充 — #6443–#8513（2026-10-01）

> 本批次新增讨论中与本子系统相关的帖子。原始全量分析见 `dsh-discussion-summary/incremental-2026-10-01/增量分析报告.md`。

### Windows「在资源管理器中显示」静默失败　`windows-reveal`

- **规模**: 46 篇（正文 >500 字）

| # | 标题 | 正文 | 评论 |
|---|---|---|---|
| [#7735](https://github.com/deepseek-ai/deepseek-harness/discussions/7735) | [Bug] Windows：沙箱给工作区根目录盖 Low 完整性标签后，目录内的 .bat/.cmd/.exe 双击弹「无法验证发布者」 | 13481 | 8 |
| [#6505](https://github.com/deepseek-ai/deepseek-harness/discussions/6505) | [Bug] "Reveal in File Explorer" creates a permanently invisible window on Windows | 4297 | 5 |
| [#7842](https://github.com/deepseek-ai/deepseek-harness/discussions/7842) | [Bug] Windows: file-manager "Show file location" / default-app open silently fails (windowsHide | 6673 | 4 |
| [#6629](https://github.com/deepseek-ai/deepseek-harness/discussions/6629) | [Bug] Windows: "Reveal in File Explorer" silently fails - two causes: percent-encoded file:// U | 4074 | 4 |
| [#8043](https://github.com/deepseek-ai/deepseek-harness/discussions/8043) | [Bug] 0.1.7-rc.2 / master：Windows 上「打开目录 / 在资源管理器中显示」的窗口不可见、或只在任务栏不弹前台 —— SW_HIDE 泄漏 + Windows  | 9294 | 3 |
| [#7033](https://github.com/deepseek-ai/deepseek-harness/discussions/7033) | revealNativePath silently fails on Windows: Explorer window is created hidden, and non-ASCII pa | 6844 | 3 |
| [#6599](https://github.com/deepseek-ai/deepseek-harness/discussions/6599) | [Windows] "Show in File Explorer" / revealNativePath creates an invisible Explorer window (wind | 15339 | 2 |
| [#6856](https://github.com/deepseek-ai/deepseek-harness/discussions/6856) | [Bug] Windows: Open In... launches the workspace folder behind the browser and never takes focu | 13829 | 2 |
| [#7510](https://github.com/deepseek-ai/deepseek-harness/discussions/7510) | 【Bug】Windows:「在文件资源管理器中显示」完全不可用(四处独立缺陷) | 6227 | 2 |
| [#6515](https://github.com/deepseek-ai/deepseek-harness/discussions/6515) | [Bug] Windows: "Reveal in File Explorer" from a deliverables card silently does nothing (execFi | 5839 | 2 |
| [#8113](https://github.com/deepseek-ai/deepseek-harness/discussions/8113) | [Bug] Windows 上「用文件资源管理器打开」只创建不可见窗口（dsh 0.1.7-rc.2） | 4675 | 2 |
| [#7757](https://github.com/deepseek-ai/deepseek-harness/discussions/7757) | [0.1.7-rc.1][Windows] open-in-app 的「文件资源管理器」静默失效：runNativeCommand 的 windowsHide:true 把 GUI 窗口一起 | 2954 | 2 |

其余：#8472, #6684, #6638, #7639, #7332, #7826, #7565, #7420, #7898, #8412, #8005, #8426, #7549, #6705, #8124, #7227, #7562, #7450, #8108, #7250, #7140, #7912, #6764, #7021, #8483, #8293, #8100, #8304, #7246, #8059, #7915, #7974, #8428, #8137

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
