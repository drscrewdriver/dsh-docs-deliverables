# 增量批次 #6443–#8513（2026-10-01）

本目录是 DSH 讨论区分析的**增量批次**产物，基线为 `dsh-discussion-summary/incremental-2026-09-12/`（截至 #6442，6321 篇）。

## 批次元数据

| 项 | 值 |
|---|---|
| 数据源 | `deepseek-ai/deepseek-harness` GitHub Discussions |
| 覆盖范围 | #6443 – #8513（连续新增）+ #2906 / #2907 / #6031（三篇补齐空洞帖） |
| 新增篇数 | 2056 |
| 时间跨度 | 2026-08-17 → 2026-09-30（含空洞帖；连续段为 09-07 → 09-30） |
| 拉取方式 | REST `/repos/{owner}/{repo}/discussions?per_page=100`（84 页全量列表）+ 逐帖 `/discussions/{n}/comments`（脚本：`dsh-disscu-cache/fetch-missing.js`，`gh` token 认证，限速 200ms） |
| 拉取时间戳 | 2026-09-30T23:02Z（checkpoint `20260930_23-02-24`） |
| 原始缓存 | `E:\test\rewrite-agently\dsh-disscu-cache\raw\{number}.json` |
| 累计覆盖 | #13–#8513，共 8377 篇缓存（GitHub 现存 8370 篇；136 个编号已被官方删除，见 `raw/gap-report.txt`） |
| LLM 分类 | 本批次 2056 篇已全部完成（Qwen3.6-35B-A3B，15.1 分钟，0 失败），语料覆盖率 8377/8377 |

## 产物清单

| 文件 | 内容 |
|---|---|
| `增量分析报告.md` | 新增问题族详解 + 版本压力热力 + 高质量帖清单 |
| `插件展示增量.md` | 182 篇插件展示帖 + 提取的 231 个仓库链接 |
| `bug讨论增量.md` | 507 篇 Bug 类讨论（按正文长度排序） |
| `_tools/` | 可复现的分析脚本与中间数据 |

## 核心结论

1. **版本压力多版本并存** — 焦点从 `0.1.5-rc.1` 扩散为 `0.1.5-rc.2`（762 次）/ `0.1.7-rc.2`（633 次）/ `0.1.6-alpha.2`（468 次）/ `0.2.0-rc.2`（318 次）
2. **新增问题族（此前批次未出现）**
   - `sandbox-acl`（103 篇）— 0.1.7-rc/0.2.0-rc Windows 沙箱 ACL 授权失败（`SetNamedSecurityInfoW` Win32 5）与逐文件审批洪泛
   - `tool-runtime-duplication`（86 篇）— 0.1.6-alpha.2 起 runtime 解析分裂致 `dsh-tools` 双实例，所有工具调用报 `Cannot read properties of undefined (reading 'prepare')`（#7035，83 评论，本批次最热帖）
   - `macos-entitlements`（15 篇）— macOS 打包缺 entitlements / 完整性标签
3. **既有族显著上升**（LLM 主族口径，per-1k 归一）：`windows-reveal` 6.4×、`session-migration` 3.9×、`sandbox-windows` 3.2×、`fork-inbox` 2.4×
4. **Bug 占比 66%**（LLM 判定 1348/2056）：critical 31、high 788、medium 386、low 143
5. **7 个既有子系统文档**已追加 `## 增量补充 — #6443–#8513（2026-10-01）` 段落（session-projection / web-server / filesystem / llm-streaming / code-runtime / token-meter / subagent）

## 复现方法

```powershell
cd E:\test\rewrite-agently\dsh-docs-deliverables\dsh-discussion-summary\incremental-2026-10-01\_tools

# 0. 拉取增量缓存（可重复执行，已有文件自动跳过）
node E:\test\rewrite-agently\dsh-disscu-cache\fetch-missing.js

# 1. 粗分类（广谱关键词，方向性参考）
node analyze-new.cjs

# 2. 精确问题族聚类（#6443+ 加补齐空洞；产出 new-clustered.json）
node cluster-new.cjs

# 3. 生成三份增量报告 + 向 discussion-issues 既有文档追加增量段（幂等）
node gen-reports.cjs
```

LLM 语义分类与权威趋势报告在 `discussion-issues/_tools/`：

```powershell
cd E:\test\rewrite-agently\dsh-docs-deliverables\discussion-issues\_tools
node llm-classify.cjs --since all   # jsonl 去重，只跑未分析增量
node canon-new-families.cjs         # new_family 标签语义归并
node llm-trend-report.cjs           # 渲染 趋势报告-LLM.md
node trend-analysis.cjs             # 关键词全量趋势（无门控，全语料）
node gen-trend-report.cjs           # 渲染 README.md
```
