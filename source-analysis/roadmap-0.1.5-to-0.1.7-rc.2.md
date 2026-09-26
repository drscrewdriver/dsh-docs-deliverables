# DSH 0.1.5 → 0.1.6 → 0.1.7-rc.2 总体演进说明（跨版本综述）

> **定位**: 跨版本的"必要性"综述，回答"从 0.1.5 到 0.1.7-rc.2 代码为什么做这些改动"。
> **数据源**: 本目录各版本文件夹的分版本全量分析（v0.1.5-rc.1 / v0.1.5-rc.2 / v0.1.6-alpha.1 / v0.1.7-rc.1 / v0.1.7-rc.2）。
> **主线**: 先把能力面铺开（0.1.6），再把契约固化下来（0.1.7-rc.1），最后做稳定化收口（0.1.7-rc.2）——从"能跑的工具"走向"可被第三方插件依赖的平台"。

---

## 版本链与规模

```
dsh-v0.1.5-rc.2   (fb2c4b9e69, 2026-09-10)
    │  ← 800 commits（0.1.6-alpha.1 窗口）
dsh-v0.1.6-alpha.1 (0a15e36e7f, 2026-09-15)
    │  ← 2504 commits（0.1.6-alpha.2 → 0.1.7-alpha.1 → 0.1.7-alpha.2 → 0.1.7-rc.1）
dsh-v0.1.7-rc.1   (46a7f68b09, 2026-09-23)
    │  ← 335 commits（224 非 merge + 111 merge）
dsh-v0.1.7-rc.2   (477b4f4205, 2026-09-24)
```

累计约 3600+ commits；`packages/` 顶层分组 50 → 54，package.json 数量 296 → 349 左右；`SESSION_FORMAT_VERSION` 3 → 4（0.1.7-rc.1 完成，rc.2 保持 4）。

---

## 第一阶段：0.1.5 → 0.1.6-alpha.1 —— 能力面扩张 + 默认值收敛

解决"执行世界的覆盖面"问题，改动集中在补齐运行环境（详见 `../v0.1.6-alpha.1/`）：

- **新增 4 个能力族**：`ssh`（远端执行）、`ptc-runtime`（取代 `code-runtime` 的代码执行接缝）、`browser-use`、`computer-use`；退役 `e2b` 云沙箱——执行环境从单一本地沙箱变为本地/远端/浏览器/桌面全谱系，是后续所有 agent 能力的物理前提。
- **三个默认值收敛**：`ralph` 工具默认关闭、Session 日志上报默认开启、DeepSeek 默认走 Messages 协议——把"默认 = 安全且可预期"确立为原则。
- **首个公共插件 manifest 契约**：`DshPackageManifest` / `dsh.manifestVersion` / `engines.dsh`——插件作者第一次有了正式声明接口，为 0.1.7 的契约强制校验铺路。
- **启动解析换代**：profile 包解析从磁盘软链产物改为进程内不可变代际（`ResolutionGeneration`），解决启动期状态一致性。
- **GUI 最大增量**：侧栏终端、置顶折叠头、Mermaid 全屏查看器、归档会话恢复页。

## 第二阶段：0.1.6-alpha.x → 0.1.7-rc.1 —— 契约换代 + 一等能力化

整个跨度里最重的一段（约 2500 commits），本质是**把之前的口头约定变成强制的持久化与插件契约**（详见 `../v0.1.7-rc.1/`）：

- **会话格式 V3 → V4**（最重的持久化跃迁，`packages/core/session/src/types.ts:89`）：tool role 结果成为一等消息、生产者自有 source 取代插件包装器、新增 `developer/message` 事件、`turn/end.reason` 新增 `forked`。没有这次跃迁，后面的动态工具更新、多生产者事件流都无法表达。
- **插件契约换代**：`dsh.bundle.patch` 接受有序文件列表；`dsh.profile.patchReload` 移除；`@deepseek-ai/dsh*` 的 `peerDependencies` 范围在安装期与启动期强制校验（`engines.dsh` 仍不被读取），提供精确版本豁免——插件兼容性从"凭自觉"变成"装不上就报错"。
- **设置机制换代**：全局 `$DSH_HOME/settings.yaml` 移除，设置改为 profile 自有的 Cordis Config 易失字段（`.volatile()`）；插件 `installSection` 席位 API 整个消失，替换为 `settings.configure({ auto }, fiber)`——多 profile 隔离的必然要求。
- **交付物升为一等能力族**：`packages/deliverables`（`tool-present`、`workspace-changes`）与 `packages/document`（`office-to-pdf`）成为顶层分组；实验面新增语音输入族（5 个包，SenseVoice 提供者）。
- **文档体系升格**：官方 `docs/` 新增 5 篇子系统文档与 `persistence-changes/historical-formats/` 体系，三语（en / zh / `.i18n.yaml`）同步成为硬门禁。

## 第三阶段：0.1.7-rc.1 → rc.2 —— 稳定化收口

进入 RC 后变化性质转变：撤回冒进主线、补健壮性短板（详见 `../v0.1.7-rc.2/`，尤其 `diff-vs-0.1.7-rc.1.md`）：

- **撤销激进默认**：Schedule/time-context/ui-schedule 默认启用关回 `disabled: true`（PR #5175）；user-questions 定时等待整体 revert（PR #5174）——RC 阶段默认行为趋于保守。
- **账号/凭证体系拆分**：`llm-deepseek-account` / `llm-deepseek-api-key` 分包、认证下放 provider、401/Platform 拒绝码自动过期凭证并登出、登出确认、欠费充值提示（QuotaNoticeHost）——产品化运营的前提。
- **动态工具更新（beta）**：`mid-conversation-tool-changes-2026-07-01`，`tool_addition`/`tool_removal` 增量 block；请求扩展 8 MiB 上限。
- **prompt 经济性**：工具描述精简 + system prompt 去重，首轮约 −1918 tokens。
- **持久化健壮性**：atomic-write 接管已退出持有者的写锁、工具输出截断保住代理对、live projection 失败归类 corrupt——"长期运行不坏"级别的基础修复。
- **快捷键回归**：`client/shortcuts` 新包，Web + Desktop 可配置快捷键。

---

## 必要性总结（一句话版）

- **0.1.6 补齐执行环境与声明入口**——没有它无法承载更多能力；
- **0.1.7-rc.1 固化会话格式与插件契约**——没有它第三方插件和长期会话数据不可依赖；
- **0.1.7-rc.2 做运营化与稳定化收口**——账号体系、健壮性、默认值保守化。

三者共同把项目从开发主干推到可发布 RC 的状态。

---

## 对应的分版本详细分析（本目录）

| 版本 | 目录 | 备注 |
|---|---|---|
| v0.1.5-rc.1 / rc.2 | `../v0.1.5-rc.1/`、`../v0.1.5-rc.2/` | rc.2 含 `changelog-rc1-rc2.md`（backport 窗口） |
| v0.1.6-alpha.1 | `../v0.1.6-alpha.1/` | 覆盖 0.1.5-rc.2 → 0.1.6-alpha.1 |
| v0.1.6-alpha.2 / 0.1.7-alpha.1 / alpha.2 | 无独立目录 | 已并入 `../v0.1.7-rc.1/` 的窗口分析（其 README 有分段提交量表） |
| v0.1.7-rc.1 | `../v0.1.7-rc.1/` | 覆盖 0.1.6-alpha.1 → 0.1.7-rc.1 |
| v0.1.7-rc.2 | `../v0.1.7-rc.2/` | 覆盖 rc.1 → rc.2，含 `diff-vs-0.1.7-rc.1.md` |
