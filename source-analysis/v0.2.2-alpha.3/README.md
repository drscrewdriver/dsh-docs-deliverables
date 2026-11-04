# DSH 0.2.2-alpha.3 动态登记

> **数据源**: `deepseek-ai/DeepSeek-Harness` tag `dsh-v0.2.2-alpha.3`（`05b1cae8db`，2026-11-03 14:19 +08）
> **发布日期**: release commit "release(vendor): cordis 4.0.6-alpha.2..."；npm `@deepseek-ai/dsh@0.2.2-alpha.3` 2026-11-03T07:48Z，宿主 dist-tag **`alpha`** 已指向本版
> **性质**: 0.2.2-alpha.2 之后**首个增量段**——有实质功能交付（Schedule 重写、SDK 命令系统、fs-patch、context-menu/file-actions UI），无兼容面换代
> **统计**: 树级对比 2315 files，+87,654 / −27,240（vs alpha.2）；**commit 数浅克隆下不可考**（rev-list 报 16285 为 graft 假象）；`next` 标已指向 0.2.2-rc.1（`66491b05e3`），后续版本待文档
> **npm dist-tags 格局（2026-11-05 实测）**: `latest`=0.2.1-rc.5、`alpha`=0.2.2-alpha.3、`next`=0.2.2-rc.1

---

## 断裂面探针（2026-11-05，a.2 → a.3 逐项）

| 面 | a.2 → a.3 状态 |
|---|---|
| 兼容性闸门（`plugin-compatibility.ts` / `compatibility-preflight.ts`） | **零 diff**（engines.dsh 时代延续；装载判据与 a.2 同） |
| `docs/capability-seams.md` | **+6/−3**——新缝 `ctx.sessionLogDeepSeek`（core，Session-log 排除策略注册）；`ctx.forgePanel` 描述精化（read-only→Session permissions）；`ctx.schedule` 措辞修正（original→target Session） |
| `docs/slot-catalog.md` | **零 diff** |
| `SESSION_FORMAT_VERSION` | **保持 4**（`packages/core/session/src/types.ts` 实测） |
| `docs/persistence-changes/` | **零 diff** |
| `docs/upgrade-guides/` | **零 diff**（无新增指南目录命名于 `v0.2.2-alpha.3/`，但 a.2 目录下补挂 13 篇——见下节） |
| 包结构 | **+3 新包 package.json**：`client/ui-context-menu`（右键菜单服务）、`client/ui-file-actions`（文件操作面板）、`fs/fs-patch`（纯 Codex-style patch 解析器/LF 更新器） |
| vendor cordis 侧 | 29 files +1330/−529（**loader 1.0.7-alpha.2 / include 1.0.11-alpha.2 / schemastery 3.18.6-alpha.2** 等全族版本 bump，详见下节 cordis-loader-entry-trees） |
| apps/ 面 | 177 files +7082/−718——大头为 **web e2e 新增/扩展**（file-browser 539+、context-menus 435+、sidebar-drawer 737+、schedule-manual 338+、forge-panel 709+）、**desktop file-actions** 192+/IPC 扩展 |

## 官方升级指南新增（17 篇，`docs/upgrade-guide/` 下）

本批在 `v0.2.2-alpha.2/` 目录下补挂 13 篇——命名按迁移源惯例（同 rc.5 放 rc.4 目录）：

| # | 指南 slug | 影响对象 |
|---|-----------|----------|
| 1 | context-menu-target | 右键菜单 target API（新包 `ui-context-menu` 配套） |
| 2 | cordis-loader-entry-trees | EntryTree.write()→commit(change)；applyEntryPatches 全返 clone；Include journal 持久化；**bundle row disabled:true 不再持久跨重启** |
| 3 | forge-git-permissions | Forge Git 访问改为 Session permissions 驱动 |
| 4 | forge-worktree-entry | Forge worktree 注册入口 |
| 5 | **fs-observation-policy-default-off** | **`fs-observation-policy` 默认 disabled → write/edit 不再强制先 read；`apply_patch` 工具进门** |
| 6 | llm-request-purpose-declarations | LLM 请求 purpose 元数据声明 |
| 7 | pi-ai-request-image-count | pi-ai 请求图片计数 |
| 8 | projection-event-frames | Session projection 事件帧结构 |
| 9 | projection-released-checkpoint | Projection released checkpoint |
| 10 | projection-snapshot-scope | Snapshot scope 语义 |
| 11 | schedule-agent-tools | Schedule 工具集成换代（agent tools） |
| 12 | schedule-remote-host-tasks | 远程主机任务调度 |
| 13 | sdk-run-commands | SDK `run()` 接受 native commands + RunResult 新增 finishReason |

另有 4 篇属早前 rc 线补挂：
- `v0.2.1-rc.2/context-menu-services`
- `v0.2.1-rc.3/computer-use-helper-permissions`、`v0.2.1-rc.3/web-file-downloads`
- `v0.2.1-rc.4/reasoning-body-props`（rc.5 的指南落地——已在 v0.2.1-rc.5 段记录过此指南存在性，此处补注 a.3 时点才实际出现在 docs 树）

## 对插件作者的即时含义

1. **装载判据未变**：闸门零 diff → 本批 23 仓已补的 `0.2.1-rc.5` 枚举串在 0.2.2-alpha.3 宿主上**同样拒载**（精确枚举无 0.2.2 项）。0.2.2 线 peer/engines 跟进决策仍暂缓。
2. **`fs-observation-policy` 默认关闭**：所有 base-backed profile（headless/web/sdk/acp）中 `write`/`edit` 不再强制先 read 才可执行；新工具 `apply_patch` 默认开启。依赖 `FS_NOT_OBSERVED` / `FS_STALE_VERSION` 拒绝逻辑的插件需自查。恢复旧行为：`cordis.patch.yml` 中 `- id: fs-observation-policy` + `disabled: false`。
3. **SDK `onUserQuestion` 返回值加宽**：`SdkUserQuestionAnswer` → `SdkUserQuestionResult`（新增 `{ cancelled: true }` 变体）。使用 SDK 的 `run()` 入口现接受 native commands，`RunResult` 新增 `finishReason` 字段。非 SDK 消费方的普通 DSH 插件不受影响。
4. **Schedule 公共类型面重写**：`ScheduleRecord`/`ScheduleDeliveryReceipt`/`ScheduleDeliveryRecord` 仍导出但结构变化；新增 `RRuleScheduleRecord`/`ScheduleInputErrorCode`/`DeliveryRetentionBounds`/`ScheduleCatalogEntry`/`ScheduleViewResult`/`ScheduleEditResult`/`ScheduleRunResult` 等。直接 import `@deepseek-ai/dsh-schedule` 类型的插件需重编对账。
5. **cordis loader 面向下游变化**：`EntryTree.write()` 删除→`commit(change)`；Include 持久化改 journal；bundle row 运行态 `disabled: true` 不再落盘。普通 DSH 插件不直接触及，但插件管理器类工具需适配。
6. **`interaction/commands/builtin.ts` 新模块**：定义第一方命令身份（goal/plan/feedback/compact/permission/export）与中英双语 token 别名解析；命令注册类插件若命中同名内置命令需注意 scoped shadowing 判定。
7. **0.2.2 线后续**：npm `next` 已指向 0.2.2-rc.1（git tag `66491b05e3`），待 rc.1 文档后综合裁定跟进窗口。

## 未核实项

1. commit 数不可考（浅克隆 graft），无法做主题聚类。
2. Schedule 重写是否对自有 `dsh-session-steward` 产生类型面冲突——需实际编译验证。
3. 新包 `fs/fs-patch` 是否注册新 slot/工具（仅见 package.json + config `applyPatch`，未见 slot diff）。
4. `context-menu-target` / `schedule-agent-tools` / `schedule-remote-host-tasks` 三篇指南的迁移细节（需逐篇精读判定是否触及自有插件）。
5. vendor cordis 全族版本从 alpha.2 → alpha.2（同版本号？或已 bump）的完整对应关系。
6. 0.2.2-rc.1 vs 0.2.2-alpha.3 的增量面。

## 复核命令

```bash
# 浅拉取 a.3 tag（走代理 + :443 绕过 insteadOf）
git -c http.proxy=http://127.0.0.1:30987 -c https.proxy=http://127.0.0.1:30987 \
  fetch https://github.com:443/deepseek-ai/deepseek-harness.git tag dsh-v0.2.2-alpha.3 --no-tags

# 可信探针（树级）
git diff --shortstat dsh-v0.2.2-alpha.2 dsh-v0.2.2-alpha.3                    # 2315 files
git diff --stat dsh-v0.2.2-alpha.2 dsh-v0.2.2-alpha.3 -- docs/capability-seams.md  # +6/−3
git diff --stat dsh-v0.2.2-alpha.2 dsh-v0.2.2-alpha.3 -- docs/slot-catalog.md     # 空
git grep "SESSION_FORMAT_VERSION" dsh-v0.2.2-alpha.3 -- packages/core/session/src/types.ts  # = 4

# 新包
git diff --name-status dsh-v0.2.2-alpha.2 dsh-v0.2.2-alpha.3 | grep "^A.*package.json$"

# 指南总数
git diff --name-status dsh-v0.2.2-alpha.2 dsh-v0.2.2-alpha.3 -- docs/upgrade-guide/ | grep "guide.md$" | wc -l  # 17

# npm dist-tags
npm view @deepseek-ai/dsh dist-tags --json  # latest=rc.5, alpha=a.3, next=rc.1
```
