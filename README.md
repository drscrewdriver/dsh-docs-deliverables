# DeepSeek Harness 文档交付产物

本目录包含三部分文档资料：

1. **`official-repo/`** — 从 GitHub 官方仓库 `deepseek-ai/DeepSeek-Harness/docs/` 镜像的全部文档源码
2. **`website-reference-en/`** — 英文网站 reference 页面索引与导航结构（`/en/reference/`）
3. **`website-reference-zh/`** — 中文网站 reference 页面索引与导航结构（`/reference/`）
4. **`dsh-discussion-docs/`** — 分析产出的新增/补全文档（GitHub Discussions 社区帖子驱动，见下方"补全文档清单"）

> **注意**：这些产物是为独立参考目的而收集的。本仓库没有 `deepseek-ai/DeepSeek-Harness` 的 PR 提交权限。

---

## 目录结构

```
dsh-docs-deliverables/
├── README.md                           ← 本文件
│
├── official-repo/                      ← 官方仓库 docs/ 完整镜像
│   └── docs/                           ← 85 文件 / 12 子目录
│       ├── AGENTS.md
│       ├── architecture.md + .zh.md
│       ├── subsystems/                 ← 53 子系统文档（中英对）
│       ├── cordis-api/                 ← 6 个 API 文档
│       ├── cordis-tutorial/            ← Cordis 框架教程 7 篇 + 总览
│       ├── cookbook/                   ← 开发手册 12 篇
│       ├── postmortem/                 ← 事故复盘 4 篇
│       ├── i18n/                       ← 翻译规则与术语
│       └── user/                       ← 用户指南文档
│
├── website-reference-en/               ← 英文网站 reference 索引
│   └── README.md                       ← 65 个页面的分类导航表
│
├── website-reference-zh/               ← 中文网站 reference 索引
│   └── README.md                       ← 65 个页面的中文分类导航表
│
└── dsh-discussion-docs/                ← 分析产物（GitHub Discussions 驱动）
    ├── subsystems/
    │   ├── headless.md + .zh.md + .i18n.yaml   ← headless 子系统参考
    │   ├── approval.md + .zh.md + .i18n.yaml   ← 审批 FAQ 更新
    │   ├── README.md                             ← 子系统话题分解索引
    │   ├── llm-streaming/                        ← Discussion → 官方子系统映射
    │   │   ├── discussion-issues.md              ← 中文原版
    │   │   ├── discussion-issues.en.md           ← 英文翻译
    │   │   └── .i18n.yaml
    │   ├── session-projection/
    │   │   ├── discussion-issues.md              ← 中文原版
    │   │   ├── discussion-issues.en.md           ← 英文翻译
    │   │   └── .i18n.yaml
    │   ├── web-server/
    │   │   ├── discussion-issues.md              ← 中文原版
    │   │   ├── discussion-issues.en.md           ← 英文翻译
    │   │   └── .i18n.yaml
    │   ├── filesystem/
    │   │   ├── discussion-issues.md              ← 中文原版
    │   │   ├── discussion-issues.en.md           ← 英文翻译
    │   │   └── .i18n.yaml
    │   ├── subagent/
    │   │   ├── discussion-issues.md              ← 中文原版
    │   │   ├── discussion-issues.en.md           ← 英文翻译
    │   │   └── .i18n.yaml
    │   ├── code-runtime/
    │   │   ├── discussion-issues.md              ← 中文原版
    │   │   ├── discussion-issues.en.md           ← 英文翻译
    │   │   └── .i18n.yaml
    │   └── token-meter/
    │       ├── discussion-issues.md              ← 中文原版
    │       ├── discussion-issues.en.md           ← 英文翻译
    │       └── .i18n.yaml
```

---

## 官方仓库 docs/ 镜像 (official-repo/)

从 `deepseek-ai/DeepSeek-Harness` 仓库 `master` 分支 `docs/` 目录完整克隆（sparse checkout），包含所有文档源码、i18n 配置、教程、cookbook、postmortem 等。

| 目录 | 文件数 | 说明 |
|------|--------|------|
| `docs/*.md` | ~40 | 根文档：架构、glossary、模块图、postmortem 等 |
| `docs/subsystems/` | ~100 | 53 个子系统文档（中英双语对 + i18n.yaml） |
| `docs/cordis-api/` | ~16 | 6 个 Cordis Core API 文档 |
| `docs/cordis-tutorial/` | ~24 | 7 篇 Cordis 框架教程 + 索引 |
| `docs/cookbook/` | ~30 | 12 个 cookbook 指南 |
| `docs/postmortem/` | ~12 | 4 篇事故复盘 |
| `docs/i18n/` | ~8 | 翻译规则、术语表 |
| `docs/user/` | ~40 | 用户指南文档 |

**Git 提交哈希**: `master` 分支最新

---

## 网站 Reference 页面索引 (website-reference-en / website-reference-zh)

从 VitePress 构建的网站提取的 reference 侧边栏完整导航结构。英文和中文各 65 个页面，按 Sidebar 分类排列。

### 英文 (website-reference-en/README.md)

- 站点: https://deepseek-harness.github.io/deepseek-harness/en/reference/
- 分类: Concepts → Generated Reference → Cordis Core API → Cookbook → Subsystems (8 个子分类)

### 中文 (website-reference-zh/README.md)

- 站点: https://deepseek-harness.github.io/deepseek-harness/reference/ (根语言区)
- 分类: 概念 → 生成参考 → Cordis API → 开发手册 → 总览/子系统 (8 个子分类)

每个页面包含完整 URL 和本地对标路径，可直接链接到在线版本或对照 `official-repo/docs/` 中的原始 Markdown。

---

## 补全文档清单

> **主要来源: GitHub Discussions 社区帖子**
>
> 以下所有分析产物（`dsh-discussion-docs/` 目录下）的内容、故障分类、数据均**来源于 GitHub Discussions** 的 780 篇社区讨论帖。通过 GraphQL API `discussions(first:100)` 分页提取全量帖子，按语义聚类识别出 11 个"同根生"话题家族（共 110 篇去重帖子），据此生成故障排除文档和子系统补全文档。源码和官方文档仅用于验证和补充实现细节。

### 新增子系统文档

| 文件 | 行数 | 内容 |
|---|---|---|
| `dsh-discussion-docs/subsystems/headless.md` | 160 | headless profile 完整参考：CLI 解析、运行流程、推理流、退出码映射、Cordis API |
| `dsh-discussion-docs/subsystems/headless.zh.md` | 158 | 中文版（与英文结构镜像） |
| `dsh-discussion-docs/subsystems/headless.i18n.yaml` | 6 | 中英一致性记录（git blob hash） |

### Discussion 话题 → 子系统分解（取代旧 troubleshooting.md）

| 子系统 | Discussion 话题 | 帖子数 |
|---|---|---|
| `dsh-discussion-docs/subsystems/llm-streaming/` | Developer role 不兼容 | 9 |
| `dsh-discussion-docs/subsystems/session-projection/` | 长会话加载失败 | 7 |
| `dsh-discussion-docs/subsystems/web-server/` | 远程访问 403 错误 | 16 |
| `dsh-discussion-docs/subsystems/filesystem/` | Windows 中文路径截断 | 17 |
| `dsh-discussion-docs/subsystems/subagent/` | 子代理模型继承 | 2 |
| `dsh-discussion-docs/subsystems/code-runtime/` | Picker 工作器崩溃 | 8 |
| `dsh-discussion-docs/subsystems/token-meter/` | 性能退化（二次方复杂度） | 6 |

每个子系统子目录含：`discussion-issues.md`（中文原版）+ `discussion-issues.en.md`（英文翻译）+ `.i18n.yaml`。英文版已通过 subagent 并行翻译，零中文残留。中文版末尾附有 Discussion References 表格（含 #编号、标题、URL）。

### 已更新子系统文档

| 文件 | 变更内容 |
|---|---|
| `dsh-discussion-docs/subsystems/approval.md` | 新增 FAQ 小节：5 个问题，含 ask/never 策略使用场景对照表 |
| `dsh-discussion-docs/subsystems/approval.zh.md` | 中文版 FAQ 同步 |
| `dsh-discussion-docs/subsystems/approval.i18n.yaml` | git blob hash 更新 |

### 已更新索引

| 文件 | 变更 |
|---|---|
| `dsh-discussion-docs/subsystems/README.md` | Discussion 话题 → 官方子系统映射索引 |

### 网站发布清单更新

| 文件 | 变更 |
|---|---|
| `website/docs.ts` | headless.md 加入"模型与上下文"分组；troubleshooting.md 加入 reference "概念" 小节 |

---

## 关键发现摘要

### 1. 重复反馈家族（11 个，110 篇去重帖子）

| 家族 | 帖子数 | 根因 |
|---|---|---|
| 安全审计系列 | 20 | VM逃逸、approval回环自批准、clickjacking |
| 桌面端需求 | 19 | 社区自发做 Tauri/Electron 桌面端 |
| 中文路径截断 | 17 | `readUtf16` 低字节 0x00 检查 |
| LAN/远程访问 | 16 | Host/Origin 校验导致 403 |
| **developer role 兼容** | **9** | **#5008 所属；pi-ai developer role vs system role** |
| Picker 崩溃 | 8 | Windows 目录选择器 crash |
| 历史加载失败 | 7 | sourceEventSeqs 超 V8 参数上限 |
| 性能退化 | 6 | TokenMeter 二次方复杂度 |
| unknown tool | 5 | SSE 流式解析覆盖赋值 |
| 子代理模型继承 | 2 | agentDefaultModel 继承链 |
| 中断队列 | 2 | 中断后队列状态 |

### 2. 文档覆盖缺口

| 文档 | 状态 | 原因 |
|---|---|---|
| `reference/agent-teams.md` | ❌ 404 | AgentTeams 多 agent 系统无参考文档 |
| `reference/headless.md` | ❌ 缺失 | 无人值守/CI 操作模式无文档 |
| 第三方网关兼容方言 | ⚠️ 不足 | developer role(9 篇)、reasoningEfforts 适配 |
| Windows 中文路径 | ⚠️ 不足 | 17 篇独立复现，FAQ 仅提端口占用 |
| 社区安全审计 | ⚠️ 不足 | 20 篇深度分析仅泛提 |

### 3. 本文档产物的覆盖范围

| 缺口 | 覆盖状态 | 位置 |
|---|---|---|
| AgentTeams 文档(404) | ⏳ 待补全 | 需另行分析 agent-team 子系统 |
| **headless 模式** | ✅ 已创建 | `dsh-discussion-docs/subsystems/headless.md` |
| **developer role 不兼容** | ✅ 已拆分 | `dsh-discussion-docs/subsystems/llm-streaming/discussion-issues.md` |
| **长会话加载失败** | ✅ 已拆分 | `dsh-discussion-docs/subsystems/session-projection/discussion-issues.md` |
| **远程访问 403** | ✅ 已拆分 | `dsh-discussion-docs/subsystems/web-server/discussion-issues.md` |
| **中文路径截断** | ✅ 已拆分 | `dsh-discussion-docs/subsystems/filesystem/discussion-issues.md` |
| **审批 ask/never FAQ** | ✅ 已创建 | `dsh-discussion-docs/subsystems/approval.md` FAQ |
| **子代理模型继承** | ✅ 已拆分 | `dsh-discussion-docs/subsystems/subagent/discussion-issues.md` |
| **Picker 崩溃** | ✅ 已拆分 | `dsh-discussion-docs/subsystems/code-runtime/discussion-issues.md` |
| **性能退化** | ✅ 已拆分 | `dsh-discussion-docs/subsystems/token-meter/discussion-issues.md` |

---

## 技术来源引用

所有产物中的类型声明和实现细节直接来自以下源码：

| 产物 | 源码位置 |
|---|---|
| headless 子系统 | `packages/bundle/headless/src/index.ts`, `src/startup.ts` |
| approval FAQ | `packages/interaction/user-approval/src/index.ts` |
| filesystem 路径截断 | `packages/fs/fs/src/` (readUtf16 实现) |
| token-meter 性能 | `packages/core/token-meter/` |
| session projection | `packages/session/session-projection/` |
| subagent 继承 | `packages/subagent/subagent/src/types.ts`, `src/index.ts` |
| web-server 源验证 | `packages/client/web-server/` |

---

## 使用说明

这些文档产物可以直接作为独立参考使用。如需整合到正式文档中，需要：

1. 检查 `verify-doc-budgets` 词预算（根 AGENTS.md ≤1950, architecture ≤2400）
2. 检查 `verify-md-links` 交叉引用（相对路径，无死链）
3. 运行 `pnpm run verify-translation-pairing --write` 确认双语一致性
4. 确认 `website/docs.ts` 发布清单包含新页面
