# 增量批次 #5886–#6442（2026-09-12）

本目录是 DSH 讨论区分析的**增量批次**产物，基线为 `dsh-discussion-summary/DSH讨论区全量分析报告.md`（截至 #5885）。

## 批次元数据

| 项 | 值 |
|---|---|
| 数据源 | `deepseek-ai/deepseek-harness` GitHub Discussions |
| 覆盖范围 | #5886 – #6442 |
| 新增篇数 | 544 |
| 时间跨度 | 2026-09-07 → 2026-09-12 |
| 拉取方式 | REST `/repos/{owner}/{repo}/discussions?page=N`（page 193–211，30 条/页） |
| 拉取时间戳 | 2026-09-12T21:57:22+08:00 |
| 原始缓存 | `E:\test\rewrite-agently\dsh-disscu-cache\raw\{number}.json` |
| 累计覆盖 | #13–#6442，共 6321 篇 |

## 产物清单

| 文件 | 内容 |
|---|---|
| `增量分析报告.md` | 14 个新增问题族详解 + 版本压力热力 + 高质量帖清单 |
| `插件展示增量.md` | 67 篇插件展示帖 + 提取的 75 个仓库链接 |
| `bug讨论增量.md` | 136 篇 Bug 类讨论（按正文长度排序） |
| `_tools/` | 可复现的分析脚本与中间数据 |

## 核心结论

1. **版本压力迁移** — 讨论焦点从 `0.1.2-rc.1`（170 次提及）转向 **`0.1.5-rc.1`**（322 次）/ `0.1.5-rc.2`（165 次）
2. **迁移链是最大破坏源** — `session-migration`(24) + `session-history-unreadable`(29) 共 53 篇，根因是迁移器的**整份拒载**语义
3. **新增问题族（此前批次未出现）**
   - `fork-inbox` — Fork 继承父会话 pending inbox（18 篇）
   - `windows-reveal` — Windows「在资源管理器中显示」静默失败（15 篇）
   - `client-bundle-stale` — 升级后 client bundle 陈旧（16 篇）
   - `malformed-toolcall` — 畸形 tool-call 持久化致会话不可恢复（17 篇）
4. **Windows 环境权重上升** — `sandbox-windows` 45 篇为最大族，涵盖 schannel TLS 失败、环境变量大小写重复

## 复现方法

```powershell
cd E:\test\rewrite-agently\dsh-docs-deliverables\dsh-discussion-summary\incremental-2026-09-12\_tools

# 1. 基础统计分析（产出 new-analysis.json）
node analyze-new.cjs

# 2. 问题族聚类（产出 new-clustered.json）
node cluster-new.cjs

# 3. 生成三份 Markdown 报告（幂等，可重复运行）
node gen-reports.cjs
```

> **幂等性**：`gen-reports.cjs` 在追加到 `discussion-issues/*/discussion-issues.md` 前会先剥离上一次追加的 `## 增量补充 — #5886–#6442（2026-09-12）` 段落，因此可安全重复运行。已实测「连续两次运行字节完全一致」。

> **实现注意事项**（改动脚本时勿破坏）：
> 1. 既有交付物文档是 **CRLF**，脚本文本块是 LF——读入后须在 LF 空间运算，写回前按原文件风格还原，否则幂等性失效。
> 2. 尾部归一化**顺序不可交换**：先剥离尾部 `---`，再折叠尾部空白。
> 3. 覆盖写入用 `fs.writeFileSync(..., 'utf-8')`（Node 默认不写 BOM）；不要把文件交给 PowerShell `Set-Content -Encoding UTF8` 处理。

## 已知数据质量问题

- **BOM 污染（已修复）**：本批次文件由 PowerShell `Set-Content -Encoding UTF8` 写出，带 UTF-8 BOM，与既有文件格式不一致。已于 2026-09-12 批量剥离（544 个文件 + ID-LIST.txt）。
- **历史跳号**：缓存中缺失的 109 个编号（如 #189、#209）是 GitHub 上从未存在的 discussion 编号，非漏拉。
- **未聚类帖**：346 篇未命中任何问题族（多为一次性提问、观点表达、插件展示），不代表低价值。
