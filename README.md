# DeepSeek Harness 文档知识库

本目录是 DSH（DeepSeek Harness）的综合文档知识库，整合官方文档、社区讨论、源码解析、插件框架四大板块。

> **注意**：这些产物是为独立参考目的而收集的。本仓库没有 `deepseek-ai/DeepSeek-Harness` 的 PR 提交权限。

---

## 四大板块

| 板块 | 目录 | 来源 | 内容 |
|------|------|------|------|
| **官方文档** | `official-repo/` | GitHub 官方仓库 | docs/ 完整镜像（85 文件 / 12 子目录） |
| **社区讨论** | `dsh-discussion-summary/` | GitHub Discussions 780 篇 | 高质量帖子、bug 分析、插件仓库归类 |
| **源码解析** | `source-analysis/` | StudyDocs 12 篇详解 | 架构总览 + 12 模块深度解析 |
| **插件框架** | `plugin-framework/` | 开发实践文档 | 文件结构、版本策略、兼容性、投稿指南 |

此外还有：
- `website-reference-en/` / `website-reference-zh/` — 网站 reference 侧边栏导航索引
- `discussion-issues/` — 按子系统分解的 Discussion 故障排查文档
- `dsh-015-notes.md` — DSH 版本变更矩阵（0.1.1→0.1.5），源码解析版本规划的导航伴侣

---

## 目录结构

```
dsh-docs-deliverables/
├── README.md                           ← 本文件（总导航）
├── dsh-015-notes.md                    ← 版本变更矩阵（0.1.1→0.1.5）
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
│   └── type-plugins/                   ← 插件仓库归类（三档）
│
├── discussion-issues/                  ← Discussion → 子系统故障排查
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
│   └── v0.1.0-rc.5/                    ← 当前版本（14 篇）
│       ├── architecture-overview.md    ← 架构总览
│       ├── 01-vendor-cordis.md         ← Cordis 框架层
│       ├── 02-core-product.md          ← Core 产品主干
│       ├── 03-shell-capabilities.md    ← Shell 能力缝
│       ├── 04-llm-typer.md             ← LLM 与 Typer
│       ├── 05-execution-world.md       ← 执行世界
│       ├── 06-memory.md                ← 记忆系统
│       ├── 07-multi-agent.md           ← 多智能体
│       ├── 08-human-agent-governance.md← 人机协作与治理
│       ├── 09-cli-boot.md              ← CLI 与 Boot
│       ├── 10-gui-frontend-backend.md  ← GUI 前后端
│       ├── 11-protocol-sdk.md          ← 协议与 SDK
│       ├── 12-engineering.md           ← 工程体系
│       └── module-template.md          ← 模块详解模板
│
├── plugin-framework/                   ← 插件开发框架
│   ├── README.md                       ← Plugin 开发总览导航
│   ├── file-structure.md               ← 标准插件文件结构
│   ├── distribution-strategy.md        ← 版本分发策略
│   ├── compatibility-guide.md          ← 兼容性指南
│   └── submission-guide.md             ← awesome-dsh-plugin 投稿步骤
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
2. `plugin-framework/compatibility-guide.md` — 兼容性设置
3. `plugin-framework/distribution-strategy.md` — 版本分发
4. `plugin-framework/submission-guide.md` — 市场投稿

### 故障排查路径

1. `dsh-015-notes.md` — 查看版本变更和 breaking changes
2. `discussion-issues/` — 按子系统查找相关问题
3. `dsh-discussion-summary/bug-discussion/` — Bug 讨论汇总

### 深度研究路径

1. `source-analysis/v0.1.0-rc.5/` — 12 篇模块详解
2. `official-repo/docs/subsystems/` — 53 个子系统官方文档
3. `dsh-015-notes.md` — 版本演进脉络

---

## 版本说明

- **官方文档镜像**: 基于 `deepseek-ai/DeepSeek-Harness` master 分支
- **源码解析**: 基于 v0.1.0-rc.5 源码快照
- **社区讨论**: 基于 GitHub Discussions 780 篇帖子分析
- **DSH 运行版本**: 0.1.1-rc.2（主机环境）

## 板块间交叉引用

| 从 → 到 | 关联 |
|----------|------|
| `source-analysis/` → `official-repo/docs/subsystems/` | 源码解析与官方子系统文档对照 |
| `plugin-framework/` → `source-analysis/` | 插件框架与内部架构的连接点 |
| `discussion-issues/` → `official-repo/docs/subsystems/` | Discussion 问题映射到官方子系统 |
| `dsh-015-notes.md` → `source-analysis/` | 版本变更矩阵指导源码解析版本规划 |
| `dsh-discussion-summary/` → `discussion-issues/` | 讨论汇总分解为子系统故障排查 |

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
