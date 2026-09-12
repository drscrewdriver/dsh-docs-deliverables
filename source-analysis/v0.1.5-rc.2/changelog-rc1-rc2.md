# DSH v0.1.5 RC.1 → RC.2 变更说明

> **数据源**: `deepseek-ai/deepseek-harness` 官方仓库
> **标签对比**: `dsh-v0.1.5-rc.1` (`183f08e9c6`) → `dsh-v0.1.5-rc.2` (`fb2c4b9e69`)
> **日期**: 2026-09-10
> **提交者**: yixiangihsiang (ihsiang@deepseek.com), Co-authored-by: LegGasai
> **性质**: 从 master 主干 backport 精选变更到 0.1.5 分支（Refs #3927, #3903）
> **统计**: 334 files changed, 1050 insertions(+), 1050 deletions(-)
>
> 净增 0 行 — 大量重构替换，结构变化大于体积变化。

---

## 版本序列定位

```
dsh-v0.1.5-alpha.1
    │
    ▼  (约 140 个 commit)
dsh-v0.1.5-rc.1  ← 上版
    │
    │  ←─ 本次变更（4 个 commit，含 2 个 merge）
    │
dsh-v0.1.5-rc.2  ← 当前版
```

**RC.1 前后提交链**（上下文）：

```
183f08e9c6 Merge pull request #3912 from deepseek-harness/worktree/release/dsh-0.1.5-rc.1
1ef9c1fa9a release(dsh): 0.1.5-rc.1
ecc6f11cf1 Merge pull request #3824 from deepseek-harness/worktree/deepseek-flash-catalog
0729dbec66 feat(llm): restore V4 Flash Vision Exp catalog entry
441385fe38 feat(llm): retain V4 models alongside V41 Flash
bc5fd3b8dc feat(llm): default Chat Completions to DeepSeek V41 Flash
4cbaeb8d69 Merge pull request #3909 from deepseek-harness/fix/sidebar-preview-layout-polish
...
fb2c4b9e69 Merge pull request #3978 from deepseek-harness/worktree/release-dsh-0.1.5-rc.2   ← RC.2
a305303422 release(dsh): 0.1.5-rc.2
2107e4697e Merge pull request #3973 from deepseek-harness/worktree/release-0.1.5-backport-feedback-deliverables
060323d8e2 feat(web): backport feedback and file refinements to 0.1.5   ← 唯一实际变更提交
```

---

## 变更总览

RC.2 是一次 **用户体验质量提升**，不涉及核心架构变更。两个 backport PR 从 master 主干移植：

| PR | 功能 | 提交 |
|----|------|------|
| [#3928](https://github.com/deepseek-ai/deepseek-harness/pull/3928) | 对称消息反馈提交 (Symmetric Message Feedback) | 核心 |
| [#3902](https://github.com/deepseek-ai/deepseek-harness/pull/3902) | 共享文件类型图标 + 交付物 UI 精化 | 核心 |

此外包含 ~300 个 `package.json` 的版本号批量升级。

---

## 一、对称消息反馈提交

### 1.1 问题背景（RC.1 行为）

RC.1 中 Like / Dislike 的交互路径**不对称**：

| 操作 | 交互路径 | 记录时机 | 反馈内容 |
|------|----------|----------|----------|
| **Like (点赞)** | 点击按钮 → 立即记录 | 即时 | 无分类、无备注 |
| **Dislike (点踩)** | 点击按钮 → 打开反馈对话框 → 选分类 → 写备注 → 提交 → 记录 | 提交后 | 有分类、有备注 |

这意味着用户想给负面反馈填写原因，但想给正面反馈时却无法附加说明。

### 1.2 设计变更（RC.2）

**新策略**：无论 Like 还是 Dislike，点击后都打开反馈对话框；用户在对话框中填写分类和备注并提交后，才正式记录评级。

```
旧交互:
  Like ──→ 立即记录 ──→ "Thanks for your feedback" toast
  Dislike ──→ 对话框 ──→ 填写分类+备注 ──→ 记录

新交互:
  Like ──────→ 对话框 ──→ 填写分类+备注 ──→ 记录 ──→ toast
  Dislike ──→ 对话框 ──→ 填写分类+备注 ──→ 记录 ──→ toast
```

### 1.3 组件级变更详解

#### 1.3.1 `MessageFeedbackActions.tsx` — 交互逻辑重构

**变更前后对比**：

| 维度 | RC.1 | RC.2 |
|------|------|------|
| 参数 | `toggle`, `acknowledge` | `retract` |
| Like 行为 | `toggle('positive')` 立即记录 | `choose('positive')` → 未记录时打开对话框 |
| Dislike 行为 | 未记录时 `openDialog(messageId)` | 未记录时 `openDialog(messageId, 'negative')` |
| 已记录点击 | Like: 调用 `toggle` 取消; Dislike: 调用 `toggle` 取消 | 统一调用 `retract` 取消 |

**核心代码变更**：

```diff
-export function MessageFeedbackActions({
-  messageId, ensure, current, toggle, openDialog, acknowledge, useFeedback, t,
-}: MessageFeedbackActionProps) {
+export function MessageFeedbackActions({
+  messageId, ensure, current, retract, openDialog, useFeedback, t,
+}: MessageFeedbackActionProps) {

-  const onLike = useCallback(() => {
-    setPending(true); setFailure(null)
-    void toggle(messageId, 'positive').then((result) => {
-      if (!alive.current) return
-      setPending(false)
-      if (!result.ok) { setFailure(errorCopy(result)); return }
-      if (result.rating === 'positive') acknowledge()   // ← 立即确认
-    })
-  }, [acknowledge, toggle])
+  const choose = useCallback((nextRating: MessageFeedbackRating) => {
+    setPending(true); setFailure(null)
+    void ensure().then((loaded) => {
+      if (!alive.current) return
+      if (!loaded.ok || current(messageId)?.rating !== nextRating) {
+        setPending(false); openDialog(messageId, nextRating)   // ← 打开对话框
+        return
+      }
+      void retract(messageId, nextRating).then((result) => {
+        if (!alive.current) return; setPending(false)
+        if (!result.ok) setFailure(errorCopy(result))
+      })
+    })
+  }, [current, ensure, retract])
+  const onLike = useCallback(() => { choose('positive') }, [choose])
+  const onDislike = useCallback(() => { choose('negative') }, [choose])
```

#### 1.3.2 `controller.ts` — 控制层简化

**删除**: `MessageFeedbackToggleResult` 类型（不再需要携带记录后的评级信息）

**`toggle()` → `retract()`**：从"记录或取消"变为"仅取消"。

```diff
- toggle(messageId, rating): Promise<MessageFeedbackToggleResult> {
+ retract(messageId, rating): Promise<MessageFeedbackActionResult> {
    return this.mutate(async () => {
      const observed = this.view.items.get(messageId)
-     const retract = observed?.rating === rating
-     const result = retract
+     return observed?.rating === rating
        ? await this.deleteCommitted(messageId, observed)
-       : await this.putCommitted(messageId, rating, {}, observed)
-     return result.ok ? { ok: true, rating: retract ? null : rating } : result
+       : OK   // ← 不匹配则 no-op，不再写入
    })
  }
```

**简化理由**：
- RC.1 的 `toggle` 需要判断"已记录→取消"还是"未记录→写入"，逻辑复杂
- RC.2 的 `choose()` 在 UI 层处理了写入逻辑（调用 `openDialog`），控制层只需专注取消操作
- 序列化操作保证：如果并发修改了评分，`retract` 变为 no-op，不会误删

#### 1.3.3 `FeedbackDialog.tsx` — 失败提示升级

| 维度 | RC.1 | RC.2 |
|------|------|------|
| 提交失败 | 表单内红色文本 `span.failure` | 独立 Toast 通知（带警告图标） |
| 失败提示关闭 | 关闭对话框时一起消失 | `dismissFailure()` 独立关闭，保留对话框草稿 |

**变更**：
- 新增 `IconWarningOutline16` 警告图标
- 失败 toast 显示 6 秒 (`holdMs={6000}`)，自动消失
- 成功 toast (`toast > 0`) 的显示条件改为 `toast > 0 && failure === null`，避免重叠

```diff
+  const onFailureDone = useCallback(() => { dismissFailure() }, [dismissFailure])

- {toast > 0 && (<Toast ... />)}
+ {toast > 0 && failure === null && (<Toast ... />)}
+ {failure !== null && (
+   <Toast key={`failure-${failureCode}`} text={failure} icon={<IconWarningOutline16 />}
+         anchor={card} holdMs={6000} onDone={onFailureDone} />
+ )}

- {failure !== null && <span className={css.failure}>{failure}</span>}
```

#### 1.3.4 `dialog.ts` — 状态管理

| 维度 | RC.1 | RC.2 |
|------|------|------|
| `FeedbackDialogTarget` | `{ kind: 'message'; messageId }` | 新增 `rating: MessageFeedbackRating` |
| 提交失败处理 | 设置 `failure` 字段 | 同时关闭旧 toast (`toast: 0`) 再发布失败 |
| `acknowledge()` | `public` 方法，由 `acknowledge` 回调调用 | 改为 `private`，不再对外暴露 |
| 新方法 | — | `dismissFailure()` — 单独关闭失败 toast |

#### 1.3.5 `surface.ts` — 路由层修正

```diff
- this.feedback.rate(target.messageId, 'negative', entry)
+ this.feedback.rate(target.messageId, target.rating, entry)
```

RC.1 中消息目标**硬编码**为 `'negative'`，意味着即使点击 Like 也通过负向反馈路径记录。RC.2 改为读取 `target.rating`，使 Like 和 Dislike 都能正确路由。

#### 1.3.6 `slots.ts` — 接口变更

| 接口字段 | RC.1 | RC.2 |
|----------|------|------|
| `toggle(messageId, rating)` | ✅ | ❌ 删除 |
| `retract(messageId, rating)` | — | ✅ 新增 |
| `openDialog(messageId)` | ✅ | `openDialog(messageId, rating)` 新增第二个参数 |
| `acknowledge()` | ✅ | ❌ 删除（不再需要） |
| `dismissFailure()` | — | ✅ 新增 |

### 1.4 国际化文案更新

```diff
- 'category.service-stability': '服务稳定性'
+ 'category.service-stability': '稳定性和速度'

- 'category.service-stability': 'Service stability'
+ 'category.service-stability': 'Stability and speed'
```

### 1.5 测试变更

#### 1.5.1 `apps/web/tests/feedback-release.e2e.ts`

Like 现在也通过对话框提交，验证 positive rating 携带 `category` + `note`：

```diff
+ // Like 现在也打开对话框
+ const dialog = page.getByRole('dialog', { name: 'Submit feedback' })
+ await dialog.getByRole('button', { name: 'Instruction understanding and following' }).click()
+ await dialog.getByRole('textbox', { name: 'Feedback details' }).fill('Clear and complete.')
+ await dialog.getByRole('button', { name: 'Submit' }).click()

- { data: { sessionId, item: { rating: 'positive' } } }
+ { data: { sessionId, item: { rating: 'positive', note: 'Clear and complete.', category: 'instruction-following' } } }
```

#### 1.5.2 `apps/web/tests/message-feedback.e2e.ts`

- Like 通过对话框记录（之前直接记录并等待 toast）
- 新增 **8193 字符超限**验证：提交超长备注时显示失败 toast，对话框保持打开

```diff
+ await details.fill('x'.repeat(8193))
+ await dialog.getByRole('button', { name: 'Submit' }).click()
+ await page.getByRole('alert').filter({ hasText: 'The description is too long' }).waitFor()
+ expect(await dialog.count()).toBe(1)
```

#### 1.5.3 单元测试 (5 个文件)

`packages/client/ui-message-feedback/tests/` 下所有测试适配 `retract`-only 接口：
- `browser-plugin.client.spec.tsx` — 38 行变更
- `controller.client.spec.ts` — 44 行变更
- `dialog.client.spec.ts` — 40 行变更
- `feedback-dialog.client.spec.tsx` — 34 行变更
- `message-feedback-actions.client.spec.tsx` — 109 行变更

---

## 二、共享文件类型图标 + 交付物 UI 精化

### 2.1 CodeFileIcon 图标重构

**核心变更**：将内联在 `CodeFileIcon.tsx` 中的 50+ 种代码文件 SVG 图标（~490 行）提取到独立数据文件。

| 维度 | RC.1 | RC.2 |
|------|------|------|
| `CodeFileIcon.tsx` | ~500 行（含全部 switch-case SVG） | ~30 行（纯渲染逻辑） |
| 图标数据位置 | 内联在组件中 | `code-file-icon-artwork.ts` 独立文件 |
| 图标查找 | `switch (type)` 分支 | `CODE_FILE_ARTWORK[type]` 查找表 |
| ID 管理 | `useId()` 绑定单个渐变 | `CODE_FILE_ICON_ID_TOKEN` 占位符 + 实例级替换 |

**重构后结构**：

```
packages/client/ui-primitives/src/
├── CodeFileIcon.tsx                    ← ~30 行渲染逻辑
├── code-file-icon-artwork.ts           ← 60 行数据表 + 替换逻辑
├── code-file-icon-artwork.manifest.json ← 元数据
└── code-file-types.ts                  ← 类型定义
```

**渲染逻辑变更**：

```diff
- const gradientId = useId()
- return <svg ...>{codeFileArtwork(type, gradientId)}</svg>
+ const instanceId = `dsh-code-icon-${useId().replaceAll(':', '')}`
+ const artwork = CODE_FILE_ARTWORK[type].replaceAll(CODE_FILE_ICON_ID_TOKEN, instanceId)
+ return <svg ... dangerouslySetInnerHTML={{ __html: artwork }} />
```

### 2.2 交付物卡片尺寸精化

所有尺寸缩减约 17%，使交付物区域更紧凑：

| CSS 选择器 | 属性 | RC.1 | RC.2 | 变化 |
|-----------|------|------|------|------|
| `.root` | margin-top | 16px | 4px | **-75%** |
| `.presented` | grid gap | 16px 12px | 10px | **-38%** |
| `.file` | height | 72px | 60px | **-17%** |
| `.file` | padding | 12px | 8px 10px | **-33%** |
| `.fileIcon` | width/height | 48×48 | 40×40 | **-17%** |
| `.fileIcon` | border-radius | 12px | 10px | **-17%** |
| `.fileName` | font-size | 14px | 13px | **-7%** |
| `.description` | font-size | 12px | 10px | **-17%** |
| `.split` | height | 32px | 28px | **-13%** |
| `.open` | font-size | 14px | 12px | **-14%** |
| `.chevron` | font-size | 14px | 12px | **-14%** |

### 2.3 间距智能调节

新增 `data-after-produced-files` 属性，当 `Presented files` 紧跟 `Produced files` 时自动取消顶部间距：

```diff
+ {matched.presented.length > 0 && <div
+   className={css.root}
+   data-after-produced-files={matched.produced.length > 0 || undefined}
+ >
```

```css
+ .root[data-after-produced-files='true'] { margin-top: 0; }
```

### 2.4 Turn Tail 间距修复

**问题**：完成回复的 footer（turn-tail actions）与消息内容之间间距不一致。

**修复**：

```diff
+ .actions {
+   /* 与 flow gap 16px 配合，完整间距 = 16 + 4 = 20px */
+   margin-top: 4px;
+   margin-left: -6px;
+ }
```

### 2.5 ProducedFiles 间距调整

```diff
- margin-top: 16px;   /* ProducedFiles root */
+ margin-top: 4px;    /* 与 flow gap 16px 配合 → 20px 总间距 */
```

### 2.6 测试验证

RC.2 新增 **布局几何测试**，通过 `page.evaluate()` 直接验证 DOM 尺寸：

| 测试文件 | 验证内容 |
|----------|----------|
| `apps/web/tests/present.e2e.ts` | 卡片高度 60px、间距 20px、图标 20px、字体 13/10/12px |
| `apps/web/tests/produced-files.e2e.ts` | answer→produced 间距 20px、produced→actions 间距 20px |
| `packages/client/ui-chat/tests/turn-tail-spacing.client.spec.ts` | TurnTail CSS 间距正则验证 |
| `packages/client/ui-primitives/tests/code-file-icon.client.spec.tsx` | 新图标系统验证 |

---

## 三、测试变更汇总

### 3.1 E2E 测试（4 个文件）

| 文件 | 变更量 | 变更类型 |
|------|--------|----------|
| `apps/web/tests/feedback-release.e2e.ts` | 13 行 | Like 改为对话框提交 |
| `apps/web/tests/message-feedback.e2e.ts` | 39 行 | Like 对话框 + 超限测试 |
| `apps/web/tests/present.e2e.ts` | 67 行 | **新增** 交付物几何验证 |
| `apps/web/tests/produced-files.e2e.ts` | 31 行 | **新增** 间距验证 |

### 3.2 单元测试（5 个文件）

| 文件 | 变更量 |
|------|--------|
| `browser-plugin.client.spec.tsx` | 38 行 |
| `controller.client.spec.ts` | 44 行 |
| `dialog.client.spec.ts` | 40 行 |
| `feedback-dialog.client.spec.tsx` | 34 行 |
| `message-feedback-actions.client.spec.tsx` | 109 行 |

### 3.3 新增测试文件

| 文件 | 覆盖内容 |
|------|----------|
| `apps/web/tests/present.e2e.ts` | 交付物布局几何（6 个尺寸断言） |
| `apps/web/tests/produced-files.e2e.ts` | 产出文件间距（2 个断言） |
| `packages/client/ui-chat/tests/turn-tail-spacing.client.spec.ts` | TurnTail CSS 间距 |
| `packages/client/ui-primitives/tests/code-file-icon.client.spec.tsx` | 图标系统 |

---

## 四、包版本号批量更新

~300 个 `package.json` 从 `0.1.5-rc.1` → `0.1.5-rc.2`。涉及以下目录：

| 目录 | 数量 |
|------|------|
| `apps/*/package.json` | 4 |
| `packages/client/*` | ~50 |
| `packages/core/*` | ~10 |
| `packages/feedback/*` | 3 |
| `packages/fs/*` | ~10 |
| `packages/goal/*` | ~6 |
| `packages/llm/*` | ~10 |
| `packages/sandbox/*` | ~5 |
| `packages/session/*` | ~15 |
| `packages/shell/*` | ~8 |
| `packages/subagent/*` | ~10 |
| `packages/workflow/*` | ~6 |
| 其余 packages | ~200 |

每个文件仅变更 `version` 字段 ±1 行。

---

## 五、文档变更

| 文件 | 变更类型 |
|------|----------|
| `docs/subsystems/feedback.md` + `.zh.md` + `.i18n.yaml` | 反馈子系统文档更新 |
| `.agents/notes/implemented/feature/2026-09-08-feedback-dialog-and-categories.*` | 新功能笔记 |
| `.agents/notes/implemented/feature/2026-09-10-symmetric-message-feedback-submission.*` | 对称反馈笔记 |
| `packages/client/README.i18n.yaml` + `.md` + `.zh.md` | 客户端 README |
| `packages/client/ui-chat/README.*` | Chat 包说明 |
| `packages/client/ui-deliverables/README.*` | Deliverables 说明 |
| `packages/client/ui-message-feedback/README.*` | 反馈组件说明 |
| `packages/client/ui-primitives/README.*` | 基础 UI 组件说明 |
| `packages/feedback/command-feedback/README.*` | 命令反馈说明 |
| `snapshots/web/feedback-release/feedback-release.expected.json` | 测试快照更新 |

---

## 六、变更影响评估

### 6.1 用户可见变化

| 影响 | 说明 |
|------|------|
| **交互变化** | Like 现在也打开反馈对话框，不再立即记录 |
| **反馈更完整** | 正面反馈也可附带分类和说明 |
| **失败更可见** | 提交失败从行内红字变为 Toast 通知 |
| **UI 更紧凑** | 交付物卡片高度 72→60px，间距更密集 |
| **文案微调** | "服务稳定性" → "稳定性和速度" |

### 6.2 开发者兼容性

| 组件 | 兼容性 | 说明 |
|------|--------|------|
| `MessageFeedbackController.toggle()` | ⚠️ **破坏性** | 删除，替换为 `retract()` |
| `MessageFeedbackController.MessageFeedbackToggleResult` | ⚠️ **破坏性** | 删除 |
| `MessageFeedbackInjected.toggle` | ⚠️ **破坏性** | 接口变更 |
| `MessageFeedbackInjected.acknowledge` | ⚠️ **破坏性** | 删除 |
| `MessageFeedbackInjected.openDialog(messageId)` | ⚠️ **破坏性** | 新增第二个 `rating` 参数 |
| `FeedbackDialogInjected.dismissFailure` | ✅ 新增 | 向后兼容 |
| `FeedbackDialogController.acknowledge()` | ⚠️ **破坏性** | 改为 `private` |
| `FeedbackDialogTarget` 类型 | ⚠️ **破坏性** | 新增 `rating` 字段 |

### 6.3 升级影响（如果你有自定义扩展）

如果你的插件或自定义代码扩展了反馈系统，需要检查：

1. **直接调用 `toggle()`** → 改为 `retract()`，并在 UI 层处理"写入 vs 取消"的分支逻辑
2. **使用 `acknowledge()` 回调** → 移除，不再需要
3. **调用 `openDialog(messageId)`** → 传入第二个参数 `openDialog(messageId, rating)`
4. **依赖 `FeedbackDialogController.acknowledge()` 公开方法** → 需要改用其他机制（如监听 `toast` 状态）

---

## 总结

RC.2 的核心价值是 **反馈交互对称化** + **交付物 UI 精化**：

1. **Like/Dislike 统一路径**：都通过对话框提交，体验一致，正面反馈也能携带分类和说明
2. **控制器简化**：`toggle` → `retract`，从"记录+取消"双职能简化为"仅取消"，意图更清晰
3. **失败可见性**：Toast 替代行内错误文本，符合现代交互规范
4. **交付物更紧凑**：卡片尺寸缩小 ~17%，间距智能消除双重间隔
5. **图标可维护性**：500 行内联 SVG 提取为数据驱动架构，便于后续扩展

RC.2 不引入核心架构变更，是一次纯粹的用户体验质量提升。

---

*文档生成时间：2026-09-11*
*数据源：git diff `dsh-v0.1.5-rc.1..dsh-v0.1.5-rc.2`*
