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

