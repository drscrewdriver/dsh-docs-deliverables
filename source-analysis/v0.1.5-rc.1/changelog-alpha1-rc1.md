# DSH v0.1.5 Alpha.1 → RC.1 变更说明

> **数据源**: `deepseek-ai/deepseek-harness` 官方仓库
> **标签对比**: `dsh-v0.1.5-alpha.1` → `dsh-v0.1.5-rc.1` (`183f08e9c6`)
> **日期**: 2026-09-06 ~ 2026-09-10
> **性质**: Alpha 发布后 140 个非 merge 提交的 RC 冲刺
> **统计**: 1506 files changed, 31,725 insertions(+), 11,448 deletions(-)

---

## 版本序列定位

```
dsh-v0.1.5-alpha.1  ← 上版（唯一 alpha，未发 rc 直接跳 rc.1）
    │
    │  ←─ 本次变更（~140 非 merge + 约 30 merge）
    │
dsh-v0.1.5-rc.1  ← 当前版（0.1.5 第一个正式版候选）
```

---

## 变更总览

Alpha.1 到 RC.1 是一次 **大规模功能丰富 + UI 精化** 阶段，核心围绕三个方向：

| 方向 | PR 范围 | 影响级别 |
|------|---------|----------|
| **反馈系统建立** | #3765, #3902 | ⭐⭐⭐⭐⭐ |
| **交付物/产物 UI** | #3780, #3819 | ⭐⭐⭐⭐⭐ |
| **侧边栏文档预览** | #3724, #3890 | ⭐⭐⭐⭐ |
| **文件类型图标** | #3812 | ⭐⭐⭐⭐ |
| **Webworker 修复** | #3871 | ⭐⭐⭐ |
| **LLM V41 Flash 默认** | #3824 | ⭐⭐⭐⭐ |
| **子代理目录/编排** | #3674 | ⭐⭐⭐ |
| **其他杂项** | 若干小 PR | ⭐⭐ |

---

## 一、反馈系统建立（核心功能）

### 1.1 反馈对话框 (Feedback Dialog) — 全新功能

**PR #3765** 引入完整的消息反馈对话框，是 RC.1 最大的新功能。

**变更组件**：`packages/client/ui-message-feedback/`

| 文件 | 行数 | 说明 |
|------|------|------|
| `FeedbackDialog.tsx` | 113 行 | 反馈对话框 UI（分类选择 + 备注输入） |
| `controller.ts` | 99 行 | 反馈控制逻辑 |
| `dialog.ts` | 129 行 | 对话框状态管理 |
| `surface.ts` | 46 行 | 反馈表面路由 |
| `slots.ts` | 68 行 | Slot 注入接口 |
| `locales.ts` | 40 行 | 多语言文案 |

**反馈对话框交互**：
- `/feedback` 命令或 Dislike 按钮打开对话框
- 分类选择（6 个分类）：任务结果、指令理解与遵循、产品功能与交互、服务稳定性、资源使用与费用、安全隐私与权限、其他
- 文本备注框（可选）
- 提交后显示 "Thanks for your feedback" toast 确认

**类型定义**：
```typescript
// packages/feedback/message-feedback/src/types.ts
export type MessageFeedbackRating = 'positive' | 'negative'
export interface MessageFeedbackItem {
  readonly rating: MessageFeedbackRating
  readonly note?: string
  readonly category?: FeedbackCategory
  readonly version: MessageFeedbackVersion
}
```

### 1.2 Like 即时记录

**RC.1 行为**：
- Like 点击即记录，无需打开对话框
- 显示 toast "Thanks for your feedback"
- 已记录 Like 再次点击取消

**注意**：这一行为在 **RC.2** 被改为对称路径（Like 也走对话框）。详见 `v0.1.5-rc.2/changelog-rc1-rc2.md`。

---

## 二、交付物/产物 UI（全新功能）

### 2.1 `ui-deliverables` 全新建立

**PR #3780, #3819** 引入产物卡片系统，展示 Agent 生成的文件。

**新增组件**：
| 文件 | 说明 |
|------|------|
| `Deliverables.tsx` | 产物卡片容器 |
| `PresentedFileCard.tsx` | 已展示文件卡片 |
| `PresentRow.tsx` | 产物行 |
| `locales.ts` | 多语言文案 |
| `turn-deliverables.ts` | 轮次产物逻辑 |
| `present-open.ts` | 打开文件逻辑 |
| `presented.ts` | 展示状态 |

### 2.2 交付物卡片设计

```
┌─ Delivered ─────────────────────────────────────┐
│ 📄 report.txt                   [Open] [⋯]    │
│ 📄 analysis.md                    [Open] [⋯]    │
└─────────────────────────────────────────────────┘

┌─ Produced ──────────────────────────────────────┐
│ Files changed                                    │
│ 📄 output.txt  ✅ Delivered                      │
└─────────────────────────────────────────────────┘
```

**CSS 初始尺寸（RC.1）**：
- 卡片高度：72px（RC.2 改为 60px）
- 图标：48×48（RC.2 改为 40×40）
- margin-top：16px（RC.2 改为 4px）

---

## 三、侧边栏文档预览

### 3.1 `ui-sidebar-documentpreview` 全新建立

**PR #3724** 引入侧边栏文档预览系统，支持多种文件格式的 inline 预览。

**支持格式**：
- PDF（pdf.js 渲染）
- HTML（内嵌 iframe）
- 图片（image）
- Markdown
- 代码（code，含语言高亮）
- 纯文本（text）

**新增 30+ 文件**，包括：
```
ui-sidebar-documentpreview/src/client/
├── pdf/PdfBody.tsx + runtime.ts + store.ts + ...
├── html/HtmlBody.tsx + bootstrap.ts + pack.ts + ...
├── image/ImageBody.tsx
├── markdown/MarkdownBody.tsx
├── code/CodeBody.tsx + languages.ts
├── text/TextBody.tsx
└── document/registry.ts + contract.ts + face.ts
```

### 3.2 旧 `ui-sidebar-textpreview` 移除

`ui-sidebar-textpreview` 包被完全删除（6 个文件全部移除），功能合并到 `ui-sidebar-documentpreview`。

---

## 四、文件类型图标系统

### 4.1 共享图标首次引入

**PR #3812** 引入共享文件类型图标集，取代各组件独立实现。

**新增**：
| 文件 | 说明 |
|------|------|
| `CodeFileIcon.tsx` | 代码文件图标（490 行 SVG） |
| `code-file-types.ts` | 340 行类型定义 |
| `FileTypeIcon.tsx` | 通用文件类型图标（268 行） |
| `LinkIcon.tsx` | 链接图标（43 行） |

### 4.2 后续演进（RC.2）

**RC.2** 将 `CodeFileIcon.tsx` 中的 490 行 SVG 提取为 `code-file-icon-artwork.ts` 数据文件，渲染逻辑精简到 ~30 行。详见 `v0.1.5-rc.2/changelog-rc1-rc2.md`。

---

## 五、LLM V41 Flash 默认

### 5.1 默认模型变更

**PR #3824** 三个提交：
| 提交 | 说明 |
|------|------|
| `feat(llm): default Chat Completions to DeepSeek V41 Flash` | 默认模型改为 V41 Flash |
| `feat(llm): retain V4 models alongside V41 Flash` | V4 模型保留在 catalog 中 |
| `feat(llm): restore V4 Flash Vision Exp catalog entry` | V4 Flash Vision Exp 恢复 |

### 5.2 Pi-AI Provider 修复

**PR #3813** 引入 pi-ai provider 的恢复诊断：
- 目录恢复时保留诊断信息
- 设置验证复用在 startup recovery 中
- catalog 无效时保持可修复性

---

## 六、Webworker 修复集群

**PR #3871** 系列修复：

| 提交 | 说明 |
|------|------|
| `fix(webworker): preserve bigint file handle identity` | 保留 bigint 文件句柄身份 |
| `fix(webworker): support file handle chmod` | 支持 chmod |
| `docs(webworker): document bigint handle identity` | 文档化 |

---

## 七、子代理目录编排

**PR #3674** 子代理父级目录基础：
| 提交 | 说明 |
|------|------|
| `refactor(subagent): expose catalog through existing projection views` | 目录通过投影暴露 |
| `fix(subagent): retain catalog event types in host exports` | 保留目录事件类型 |
| `refactor(subagent): extract persistent chunked list utility` | 提取持久化 chunked list |
| `packages/subagent/subagent/src/catalog.ts` | 156 行 — 全新目录实现 |

---

## 八、其他重要变更

### 8.1 侧边栏指引页精化

| 提交 | 说明 |
|------|------|
| `feat(sidebar): refine guide start page and quiet stat pill noise` | 指南页精化 + 安静统计 pill |
| `fix(sidebar): pin the guide hero to the pure-gray ramp` | 指南 hero 纯灰 |
| `fix(client): refine sidebar document previews` | 文档预览精化 |

### 8.2 Mermaid 预览引入 + 撤销

| 提交 | 说明 |
|------|------|
| `feat(ui): preview Mermaid diagrams in Chat code blocks` | Mermaid 预览 |
| `feat(client): preview Graphviz, SVG, and HTML Markdown fences` | 更多格式预览 |
| `Revert "feat(web): preview Mermaid, Graphviz, SVG, and HTML code fences"` | **撤销** — 因问题回退 |
| 后续又逐步恢复部分功能 | 迭代修复 |

### 8.3 侧边栏图片预览

**PR #3890**：
- `feat(sidebar): preview image files` — 侧边栏内图片预览

### 8.4 Dockkit 重大更新

**PR #3780**：
- `feat(dockkit): add reversible docking engine and pointer interactions` — 可逆停靠引擎
- `TabPanel.tsx` 306 行变更，`dockkit.module.css` 506 行变更

### 8.5 其他功能

| 提交 | 说明 |
|------|------|
| `feat(web): add native file actions to artifact cards` | 产物卡片原生文件操作 |
| `feat(minimal): remove str_replace_editor from minimal profiles` | 最小化配置移除 str_replace_editor |
| `feat(web): normalize custom provider base URLs` | 规范化自定义 Provider 基础 URL |
| `feat(web): align presented file cards with design` | 展示文件卡片对齐设计稿 |
| `feat(client): add shared file type icons` | 共享文件图标 |
| `fix(web): size diagram previews to image content` | 图表预览适配内容尺寸 |

### 8.6 测试大量更新

约 200+ 测试文件更新，涵盖：
- E2E 快照更新（60+ 文件）
- 单元测试适配新 API
- 新增 document-preview 测试
- 新增 feedback 测试

---

## 九、Breaking Changes 速查

| 变更 | 影响 | 说明 |
|------|------|------|
| `ui-sidebar-textpreview` 包删除 | ⚠️ 高 | 如自定义扩展需迁移到 `ui-sidebar-documentpreview` |
| `FileTypeIcon.tsx` 全新实现 | ⚠️ 中 | 之前无此文件，无兼容问题 |
| `MessageFeedbackController` 全新 | ✅ 无 | 全新组件，无旧代码依赖 |
| `Deliverables` 全新 | ✅ 无 | 全新组件 |
| `str_replace_editor` 从 minimal 移除 | ⚠️ 中 | 使用 minimal profile 的用户需注意 |

---

## 十、总结

Alpha.1 → RC.1 是一次 **大规模功能交付**，核心新增：

1. **反馈对话框** — 完整的消息反馈系统（RC.1 Like 即时记录，Dislike 走对话框）
2. **产物卡片** — Agent 生成文件的展示和打开
3. **文档预览** — 侧边栏支持 PDF/HTML/图片/Markdown/代码的 inline 预览
4. **共享图标** — 40+ 种文件类型的统一图标集
5. **V41 Flash 默认** — 默认模型升级为 DeepSeek V41 Flash

RC.1 是 0.1.5 的第一个候选版本，功能已基本完整，后续 RC.2 在此基础上做了 UX 对称化和 UI 精化。

---

*文档生成时间：2026-09-11*
*数据源：git diff `dsh-v0.1.5-alpha.1..dsh-v0.1.5-rc.1`*
