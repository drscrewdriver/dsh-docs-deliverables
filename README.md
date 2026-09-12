# DeepSeek Harness 文档知识库

本目录是 DSH（DeepSeek Harness）的综合文档知识库，整合官方文档、社区讨论、源码解析、插件框架四大板块。

> **注意**：这些产物是为独立参考目的而收集的。本仓库没有 `deepseek-ai/DeepSeek-Harness` 的 PR 提交权限。

---

## 四大板块

| 板块 | 目录 | 来源 | 内容 |
|------|------|------|------|
| **官方文档** | `official-repo/` | GitHub 官方仓库 | docs/ 完整镜像（85 文件 / 12 子目录） |
| **社区讨论** | `dsh-discussion-summary/` | GitHub Discussions 6321 篇 | 高质量帖子、bug 分析、插件仓库归类、增量批次 |
| **源码解析** | `source-analysis/` | StudyDocs + 各版本 CHANGELOG | 架构总览 + 模块深度解析（v0.1.0-rc.5 首版 / v0.1.5-rc.2 最新） |
| **插件框架** | `plugin-framework/` | 开发实践文档 | 文件结构、版本策略、兼容性、投稿指南、插件骨架模板 |

此外还有：
- `website-reference-en/` / `website-reference-zh/` — 网站 reference 侧边栏导航索引
- `discussion-issues/` — 按子系统分解的 Discussion 故障排查文档（9 个子系统）
- `dsh-015-notes.md` — DSH 版本变更矩阵（0.1.1→0.1.5），含**插件侧模块可用性矩阵**（28模块×3版本档 + 8项能力接口变更），源码解析版本规划的导航伴侣
- `dsh-version-migration-guide.md` — 跨插件版本迁移统一指南（7+5插件适配经验 + 决策树 + 专项报告索引 + 生态插件依赖迁移明细 + 类型优化workaround）

> **本文件是目录结构介绍的唯一权威源。新增/移除目录后必须同步更新：四大板块表、目录结构树、「增量批次记录」表、推荐阅读路径。**

---

## 目录结构

```
dsh-docs-deliverables/
├── README.md                           ← 本文件（总导航）
├── dsh-015-notes.md                    ← 版本变更矩阵（0.1.1→0.1.5）+ 插件侧模块可用性矩阵
├── dsh-version-migration-guide.md      ← 跨插件版本迁移统一指南
│
├── official-repo/                      ← 官方仓库 docs/ 完整镜像
│   └── docs/                           ← 85 文件 / 12 子目录
│       ├── architecture.md + .zh.md    ← 架构文档
│       ├── subsystems/                 ← 53 子系统文档（中英对）
│       ├── cordis-api/                 ← 6 个 API 文档
│       ├── cordis-tutorial/            ← Cordis 框架教程 7 篇
│       ├── cookbook/                   ← 开发手册 12 篇
│       ├── postmortem/                 ← 事故复盘 4 篇
│       ├── i18n/                       ← 翻译规则与术语
│       └── user/                       ← 用户指南文档
│
├── dsh-discussion-summary/             ← 社区讨论分析
│   ├── discussion-high-q/              ← 高质量深度帖子
│   ├── discussion-low-q/               ← 自动生成帖子
│   ├── bug-discussion/                 ← Bug 相关讨论
│   ├── type-plugins/                   ← 插件仓库归类（三档）
│   ├── dsh-discussion-comn/            ← 元讨论 / RFC 现状分析
│   ├── meta-chunks/                    ← 分块元数据（chunk-001..011）
│   └── incremental-2026-09-12/         ← 【增量批次】#5886–#6442 分析
│       ├── 增量分析报告.md              ← 14 个新增问题族 + 版本压力 + 高质量帖
│       ├── 插件展示增量.md              ← 67 篇插件展示 + 75 个仓库
│       └── bug讨论增量.md               ← 136 篇 Bug 类讨论
│
├── discussion-issues/                  ← Discussion → 子系统故障排查
│   ├── README.md                       ← 子系统索引 + 关键词趋势（已标注被 LLM 取代）
│   ├── 趋势报告-LLM.md                  ← 【权威】Bug 归类趋势（LLM 语义分类 6321 篇）
│   ├── _tools/                         ← 分类链路脚本（families / llm-classify / canon / 两个报告生成器）
│   ├── session-migration/              ← 【新】会话格式迁移失败 v0→v1→v2→v3
│   ├── session-fork/                   ← 【新】Fork 继承父会话队列
│   ├── llm-streaming/                  ← Developer role 不兼容
│   ├── session-projection/             ← 长会话加载失败
│   ├── web-server/                     ← 远程访问 403
│   ├── filesystem/                     ← Windows 中文路径截断
│   ├── subagent/                       ← 子代理模型继承
│   ├── code-runtime/                   ← Picker 工作器崩溃
│   └── token-meter/                    ← 性能退化
│
├── source-analysis/                    ← 源码深度解析
│   ├── README.md                       ← 版本矩阵索引 + 阅读路径
│   ├── v0.1.0-rc.5/                    ← 首版模块详解（14 篇）
│   │   ├── architecture-overview.md    ← 架构总览
│   │   ├── 01-vendor-cordis.md         ← Cordis 框架层
│   │   ├── 02-core-product.md          ← Core 产品主干
│   │   ├── 03-shell-capabilities.md    ← Shell 能力缝
│   │   ├── 04-llm-typer.md             ← LLM 与 Typer
│   │   ├── 05-execution-world.md       ← 执行世界
│   │   ├── 06-memory.md                ← 记忆系统
│   │   ├── 07-multi-agent.md           ← 多智能体
│   │   ├── 08-human-agent-governance.md← 人机协作与治理
│   │   ├── 09-cli-boot.md              ← CLI 与 Boot
│   │   ├── 10-gui-frontend-backend.md  ← GUI 前后端
│   │   ├── 11-protocol-sdk.md          ← 协议与 SDK
│   │   ├── 12-engineering.md           ← 工程体系
│   │   └── module-template.md          ← 模块详解模板
│   ├── v0.1.5-rc.2/                    ← 【最新】模块详解（13 篇）
│   │   ├── architecture-overview.md    ← 架构总览
│   │   ├── 01-cordis-framework.md      ← Cordis 框架层
│   │   ├── 02..08, 10..12-*.md         ← 各模块详解
│   │   ├── changelog-rc1-rc2.md        ← rc.1 → rc.2 变更
│   │   └── plugin-migration-guide.md   ← 插件侧迁移指引
│   ├── v0.1.5-rc.1/changelog-alpha1-rc1.md  ← alpha.1 → rc.1 变更
│   ├── v0.1.5-alpha.1/CHANGELOG.md
│   ├── v0.1.3-alpha.2/CHANGELOG.md
│   ├── v0.1.2-rc.1/                    ← CHANGELOG + permission-picker-icons.md
│   ├── v0.1.1-rc.2/CHANGELOG.md
│   └── v0.1.0-rc.7/CHANGELOG.md
│
├── plugin-framework/                   ← 插件开发框架
│   ├── README.md                       ← Plugin 开发总览导航
│   ├── file-structure.md               ← 标准插件文件结构
│   ├── distribution-strategy.md        ← 版本分发策略
│   ├── compatibility-guide.md          ← 兼容性指南
│   ├── submission-guide.md             ← awesome-dsh-plugin 投稿步骤
│   ├── v0.1.5-migration.md             ← 0.1.5 插件迁移专项
│   └── dsh-plugin-template/            ← 可直接复制的插件骨架（含 client 半包）
│
├── website-reference-en/               ← 英文网站 reference 索引
│   └── README.md                       ← 65 页面分类导航表
│
└── website-reference-zh/               ← 中文网站 reference 索引
    └── README.md                       ← 65 页面中文分类导航表
```

---

## 推荐阅读路径

### 初学者路径

1. `official-repo/docs/architecture.md` — DSH 架构概览
2. `source-analysis/v0.1.0-rc.5/architecture-overview.md` — 架构深度解读
3. `source-analysis/v0.1.0-rc.5/01-vendor-cordis.md` — Cordis 框架基础
4. `source-analysis/v0.1.0-rc.5/02-core-product.md` — 产品主干

### 插件开发者路径

1. `plugin-framework/file-structure.md` — 标准文件结构
2. `plugin-framework/dsh-plugin-template/` — 可直接复制的插件骨架
3. `plugin-framework/compatibility-guide.md` — 兼容性设置
4. `plugin-framework/v0.1.5-migration.md` — 0.1.5 插件迁移专项
5. `plugin-framework/distribution-strategy.md` — 版本分发
6. `plugin-framework/submission-guide.md` — 市场投稿

### 故障排查路径

1. `dsh-015-notes.md` — 查看版本变更和 breaking changes
2. **`discussion-issues/趋势报告-LLM.md`** — **Bug 归类趋势权威报告**（Qwen3.6-35B-A3B 对全部 6321 篇逐帖语义分类）
3. `discussion-issues/` — 按子系统查找相关问题（索引见 `discussion-issues/README.md`）
4. `dsh-discussion-summary/bug-discussion/` — Bug 讨论汇总
5. `dsh-discussion-summary/incremental-2026-09-12/增量分析报告.md` — 最新批次问题族（#5886–#6442）

> **升级前必读**（针对 0.1.5 系列）：`discussion-issues/session-migration/` —— 会话格式 v0→v1→v2→v3 迁移链的拒载语义，是当前社区最高频的「历史会话永久打不开」根因。
>
> **⚠️ 方法学提醒**：`discussion-issues/README.md` 中的**关键词趋势已被 LLM 语义分类取代**。实测关键词法在同一语料上**误报 30.3%**、漏检 4.8%、与模型主族一致仅 4.5%，其绝对值与跨族比较不可用于决策，仅作方法对照保留。

### 深度研究路径

1. `source-analysis/v0.1.5-rc.2/` — **最新**模块详解（13 篇，含插件迁移指引）
2. `source-analysis/v0.1.0-rc.5/` — 首版模块详解（14 篇，架构基线）
3. `official-repo/docs/subsystems/` — 53 个子系统官方文档
4. `dsh-015-notes.md` — 版本演进脉络

---

## 版本说明

- **官方文档镜像**: 基于 `deepseek-ai/DeepSeek-Harness` master 分支
- **源码解析**: 首版基于 v0.1.0-rc.5 快照；**最新为 v0.1.5-rc.2**（13 篇模块详解 + 插件迁移指引）；另附 rc.7 / 0.1.1-rc.2 / 0.1.2-rc.1 / 0.1.3-alpha.2 / 0.1.5-alpha.1 / 0.1.5-rc.1 的 CHANGELOG
- **社区讨论**: 基于 GitHub Discussions **6321 篇**帖子（#13–#6442）
- **DSH 运行版本**: 0.1.1-rc.2（主机环境）

## 增量批次记录

| 批次 | 覆盖范围 | 篇数 | 主要产出 |
|---|---|---|---|
| 基线 | #13–#5885 | 5779 | `DSH讨论区全量分析报告.md`、插件三档归类 |
| **2026-09-12** | **#5886–#6442** | **544** | 14 个新增问题族、2 个新子系统文档（session-migration / session-fork）、75 个新插件仓库 |

**#5886–#6442 批次核心结论**：

1. **版本压力迁移** — 讨论焦点从 `0.1.2-rc.1` 转向 `0.1.5-rc.1`/`rc.2`（提及 322/165 次）
2. **迁移链成为最大破坏源** — `session-migration` + `session-history-unreadable` 共 53 篇，根因是**整份拒载**语义
3. **全新增问题族** — Fork 继承父会话队列（18 篇）、Windows reveal 静默失败（15 篇）、client bundle 陈旧（16 篇）
4. **插件生态** — 67 篇新展示帖，75 个新仓库链接

## 板块间交叉引用

| 从 → 到 | 关联 |
|----------|------|
| `source-analysis/` → `official-repo/docs/subsystems/` | 源码解析与官方子系统文档对照 |
| `plugin-framework/` → `source-analysis/` | 插件框架与内部架构的连接点 |
| `discussion-issues/` → `official-repo/docs/subsystems/` | Discussion 问题映射到官方子系统 |
| `dsh-015-notes.md` → `source-analysis/` | 版本变更矩阵指导源码解析版本规划 |
| `dsh-discussion-summary/` → `discussion-issues/` | 讨论汇总分解为子系统故障排查 |
| `incremental-2026-09-12/` → `discussion-issues/` | 增量问题族展开为子系统排查文档 |

---

## 致谢

本知识库整合了以下开源项目与社区贡献者的工作：

| 贡献者 | 项目 | 贡献内容 |
|--------|------|----------|
| [jarvislee90s](https://github.com/jarvislee90s-dot/dsh-deepseek-harness-StudyDocs) | dsh-deepseek-harness-StudyDocs | 12 篇源码深度解析文章 + v0.1.0-rc.5 源码快照，构成 `source-analysis/v0.1.0-rc.5/` 的核心内容 |
| [BananaSoldier01](https://github.com/BananaSoldier01/dsh-tidychat) | dsh-tidychat | DSH Web 会话时间线整理插件，其 v0.2.6→v0.2.7 的适配经验为 `compatibility-guide.md` 提供了实战基础 |
| [OldLigant](https://github.com/OldLigant) | dsh-session-search-toggle | 同名多版本分发策略的贡献者，`distribution-strategy.md` 的分发方案来源于此 |
| [deepseek-ai](https://github.com/deepseek-ai/deepseek-harness) | DeepSeek Harness | 官方仓库文档镜像 + git tags 版本分析的基础 |
| [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) | awesome-dsh-plugin | 社区插件市场，`submission-guide.md` 的投稿规范来源 |
