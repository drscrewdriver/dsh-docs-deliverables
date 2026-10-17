# DSH v0.2.1-alpha.5 → v0.2.1-rc.1 变更说明（更新要点）

> **数据源**: `deepseek-ai/deepseek-harness`（tag `1517a4dbca` → `1600d8a1e1`）
> **发布日期**: 2026-10-16 ｜ **发布 PR**: [#6387](https://github.com/deepseek-ai/deepseek-harness/pull/6387)
> **性质**: 0.2.1 线第一个 rc——**纯版本 bump**：4 个提交（2 非 merge：setup + release）、355 files 全部是 `package.json` 版本号行（+355/−355 对称），**零代码面变化**
> **插件契约**: 与 0.2.1-alpha.5 **逐面全等**（闸门 / settings / 会话 V4 / slot / 包结构均零 diff）。唯一实际意义：**runtime 版本字符串变为 `0.2.1-rc.1`**——peer/engines 范围的命中判定对象换了

---

## 0.2.0-rc.2 → 0.2.1-rc.1 全程缝隙总账（本线收口）

| 断裂面 | 发生段 | 一句话 |
|---|---|---|
| Schedule 挂载制 / subpath 显示换代 / invariants 删除 / 解析刷新 | a.1 | 4 篇指南，多数插件零改但分发方有必做 |
| 子代理激活统一化 / `{{cwd}}` 删除 / BundleInfo 必填字段 / `webStartup` / SSH protocol-2 / session-title provider 换代 / TerminalBlockLabels / bundle 打包制 | a.2 | 指南级 breaking ×10、官方指南 20 篇 |
| JSONL 插件命名空间 / JobId 换代 / 子代理 persona·toolFilter→agentPreset / `already-installed` / 凭据优先级反转 / `interactions:'none'` / 槽位家族换代 | a.3 | 14 篇指南，六类必做 |
| **`engines.dsh` 成为首要判据 + `peers`→`requirements`**（装载闸门换代） | **a.4** | 1 篇指南；0.1.7 铁律作废 |
| 账号通知契约放宽 | a.5 | 1 篇指南 |
| （无） | rc.1 | 纯 bump |

> **不变面（全程成立）**：`SESSION_FORMAT_VERSION` 恒 4（累计 7 条同版本加性承认）；settings 三代形状（gen-3 `configForms`）未动；cordis/schemastery API 面未断代；豁免机制 `dsh plugin allow-version` 语义未变。
> 逐段细节见 `../v0.2.1-alpha.{1..5}/`；rc.1 无独立增量内容。

## 阅读路径

- [CHANGELOG.md](CHANGELOG.md) ｜ [diff-vs-0.2.1-alpha.5.md](diff-vs-0.2.1-alpha.5.md) ｜ [plugin-migration-guide.md](plugin-migration-guide.md)
