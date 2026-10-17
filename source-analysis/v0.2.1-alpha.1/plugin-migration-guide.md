# v0.2.1-alpha.1 插件迁移指南（0.2.0-rc.2 → 0.2.1-alpha.1，可操作版）

> 对比基线：`dsh-v0.2.0-rc.2`（`639ed01539`，2026-09-29，PR #5479）→ `dsh-v0.2.1-alpha.1`（`5badb15009`，2026-10-03，PR #5648），266 commits（201 非 merge）。
> 逐 diff、提交号、复核命令见 [diff-vs-0.2.0-rc.2.md](diff-vs-0.2.0-rc.2.md)。
> **从 0.1.7 线直接升 0.2.x 的插件：主迁移文档仍是 [../../plugin-framework/v0.2.0-migration.md](../../plugin-framework/v0.2.0-migration.md)，本指南只回答"0.2.1-alpha.1 相比 rc.2 多了什么"。**
> 官方在本窗口新增 4 篇升级指南（`docs/upgrade-guide/v0.2.0-rc.2/`），本指南的必做项与之一一对应。

---

## 〇、先说结论

**核心 API 契约零 diff：peer 兼容性校验（`plugin-compatibility.ts`）、manifest schema、settings 核心（`plugin-config`）、加载器全部未动；`SESSION_FORMAT_VERSION` 保持 4；无新增持久化承认。** 大多数"单包单插件、走 locale meta 显示、不碰 invariant、不用 schedule bundle"的插件**零修改**，peer 范围 `>=0.2.0-rc.1 <0.3.0-0` 天然覆盖 0.2.1-alpha.1。

但有**三类必做项**，对应官方 4 篇升级指南中的 3 篇：

| 你的插件/环境属于 | 必做项 | 官方指南 |
|---|---|---|
| **以 subpath 方式分发插件**（单包多插件，如 `my-plugins/search`） | 标题/简介迁入 `locale/*.json` 的 `meta`；图标改为导出 `<subpath>/icon`；删除 subpath 的 `package.json` 导出 | `subpath-plugin-display-manifest` |
| **cordis.yml / patch / overlay 引用了 invariants**（`@deepseek-ai/dsh-invariants`、`*/invariant` 子路径、sdk-minimal 的 5 个 invariant id） | 删除这些行/补丁条目与依赖；依赖 `INVARIANT` rethrow 的改自建上报 | `remove-runtime-invariants` |
| **profile 用过 Automation tasks bundle**（`dsh.profile.bundles` 里有 `...schedule-bundle`） | 起一次 `dsh` 即自动摘除并重写；**手工删除顶层 `time-context` override**（不再命中） | `schedule-bundle-retired` |
| 都不是 | 零必做；浏览 §三观察点即可 | — |

---

## 一、必做项详解

### 1. 子路径插件显示面换代 🔴

0.2.1-alpha.1 起，**subpath 不被视为包**，Plugin Manager 与设置页不再读 `<subpath>/package.json`（`8339f16c1d`）：

- `name`/`description` 兜底来源消失 → 标题/简介**只**来自 `<subpath>/locale/*.json` 的 `meta.title` / `meta.description`；
- `icon` 字段来源消失 → 图标**只**来自导出资源 `<subpath>/icon`（如 `"exports": { "./search/icon": "./assets/search.svg" }`，且记得进 `files`）；
- **包根插件不受影响**：保留 `package.json` 文案与 `icon` 字段；`icon` 缺省时可用导出的 `./icon` 供图（`ecedbbc2e6`、`d12257c959` 保住优先级：manifest `icon` > 导出 `./icon`）；
- `verify-package-meta` 现在会**拒绝解析到 build 产物的 manifest 导出**（`f8a274b76e`），图标诊断会点名作者编辑的那份 `package.json`。

不做迁移的症状：插件管理页该行**显示退化**（无标题/无图标），但插件仍可加载、可管理——与 0.1.6 时代"会话导航静默删除"不同，这次是**可见的降级**，不至于静默失效。

### 2. runtime invariants 全家删除 🔴（引用才炸）

被删对象：`@deepseek-ai/dsh-invariants` 包、`InvariantRegistry` / `InvariantInstaller` / `InvariantFailure` / `InvariantError` 符号、每个包的 `./invariant` 子路径导出、`sdk-minimal` profile 的 5 行（`invariants` / `session-invariant` / `agent-invariant` / `scope-invariant` / `agent-loop-invariant`）。

后果（`f028f25667`、官方指南）：

- `cordis.yml`、`cordis.patch.yml`、`--patch` overlay 里 **name 指向被删模块的行加载失败**（module not found）；**target 指向 5 个 id 的 patch 条目**报 `patch: entry <id> not found`；
- TypeScript import 被删模块/符号**编译不过**；
- 四个发射器（`credentials/reference-updated`、`credentials/record-updated`、`authorization/settled`、`llm/adapters-updated`）改为**包容并日志记录**监听器失败（含 `code: 'INVARIANT'`），**不再 rethrow**——原来靠捕获 rethrow 失败做上报的插件，必须改走自己的通道。

**给你的插件的判断规则**：如果你从未挂载/patch 过 invariant 行、没 import 过 `dsh-invariants`——本条与你无关（绝大多数插件属于此类）。

### 3. schedule-bundle 退役 🟡（自动迁移 + 一处手工项）

挂载制换代全景（对照 0.2.0-rc.1 引入的 opt-in bundle）：

| 事项 | 0.2.0-rc.1/rc.2 形态 | 0.2.1-alpha.1 形态 |
|---|---|---|
| `schedule` / `ui-schedule` 行 | 装 `@deepseek-ai/dsh-experimental-schedule-bundle` 才有 | **Web 组合（`dsh-web-app`）在每个 Web profile 直接挂载**（`c6dd905972`） |
| 时钟行 `time-context` | bundle 内一行 | **由 preset 声明**：`standard`/`cordis`/`ptc` 有、`minimal` 无（`656adfc986`） |
| 四个 `schedule_*` 工具 | bundle 内一行 | **由 preset 经新包 `@deepseek-ai/dsh-tool-schedule` 声明**（同上分档）（`6c1a590a4c`） |
| bundle 包本体 | opt-in 安装 | **退役**；目录改名复用为 `inspector-profile` |
| profile 内已装条目 | — | 加载时自动从 `dsh.profile.bundles` 摘除并重写 `package.json`（`9633724b40`），存量任务/投递记录原地保留 |

插件侧注意：

- **你的插件若向 profile 打顶层 `time-context` override**：不再命中任何行（时钟行归 preset 所有），启动会报 `patch: entry not found`——**删除该 override**；要覆盖 `schedule`/`ui-schedule` 则继续写顶层 override（Web 组合带着这两行）；
- **你的插件若想给自己作用域的 agent 提醒能力**：在自己的 preset/plugin 清单里加 `- name: '@deepseek-ai/dsh-tool-schedule'`（要求同进程有 Host `@deepseek-ai/dsh-schedule` 服务；工具仅管理本 Session 的存量提醒，存储/调度/投递仍归 Host 服务）；
- **子代理不再默认拿到四工具**：shipped preset 给 subagent 行加了 `toolFilter.deny`（四工具全拒），service 层还会对 subagent 路由持有的 Session 返回结构化拒绝（`699f1a8dc1`、`96c421d985`）——如果你的插件给子代理编排"定时任务"能力，注意这一层拒绝语义（`schedule_update` 的拒绝经 update result 返回，`500295b2bd`）。

---

## 二、rc.1 指南条目的本版状态

| rc.1 条目 | 本版状态 |
|---|---|
| peer 世代门槛（`<0.2.0-0` 挡安装） | ✅ 原样成立（`plugin-compatibility.ts` 零 diff）；`>=0.2.0-rc.1 <0.3.0-0` 覆盖 0.2.1-alpha.1 |
| Schedule 默认组合移除（opt-in bundle） | ♻️ **被本版取代**——bundle 退役，Web 组合 + preset 贡献制（见 §一.3）；"报 `entry not found` 需改引 bundle"的老处方**作废** |
| `displayTitle` 空串语义 | ✅ 原样成立 |
| `forkSession` / composer 契约扩展 | ✅ 原样成立（另见 §三.1 stats dock 拆分） |
| `ctx.otel` / `ctx.productAnalytics` 新服务 | ✅ 原样成立 |

---

## 三、观察点（非必做）

### 1. composer stats dock 条目拆分 🟡（按 id 替换 pills 的插件）

`2190082866` 把单个 `conversation.composer.dock` 条目 `stats` 拆为 **`activity`**（执行次数/速度/时间弹窗）与 **`usage`**（tokens/缓存命中）。渲染结果不变，但**按条目 id 替换/隐藏的客户端插件需要改 id**（dsh-live-token-stats 族直接相关）——现在可以只替换一枚 pill 而不必重写整行。

### 2. 插件生命周期行为放宽 🟢

- GUI **install / enable** 后运行时解析即时刷新（`869afc493d`、`abf8b760ec`）——装完私有依赖立即可寻址，**不再必须重启**；**覆盖安装（overwrite）仍 `restart-required`**；`node_modules` 内替换、同路径重装、link 目标变更仍需重启；
- **无 HMR** 时：停用启动 bundle 不停止其已运行插件，且后续包操作不发布移除（保持旧表）；其他安装/移除照常发布；
- 发布被拒时**磁盘变更不回滚**，结果报告运行时应用失败；
- HMR 侧：`package.json` 变更（node_modules 外）→ `PackageManifests.invalidate()`（`6fe4a2e184`）——包配置读数走新文件、ESM `ResolveCache`/CJS `_pathCache` 清空；**纯配置型 manifest 不再触发模块重载**；以 JSON 模块加载的 package.json 仍走普通重载；同一批次的源码变更在其后重载。

### 3. 门禁与清单层收紧 🟢

- `verify-package-meta` 拒绝解析到 build 产物的 manifest 导出（`f8a274b76e`）；CI 里跑这个门的包需要核对 `exports` 指向源码；
- skills 模板要求 display metadata + icons（`310c5ae151`）、嵌套模板的导出资源会被校验（`176e961c33`）——维护插件模板/生成器的注意；
- bundle sources 排除凭据与影子副本（`6d1e12b237`）、保留别名与完整用户信息（`9b79f97010`）——打包分发类插件核对打包清单。

### 4. 部署/环境层 🟢

- 桌面默认监听 **OS 分配端口**（`ecd9bf9273`）——写死端口的脚本/防火墙规则需改；
- Web 公网部署需显式配置 public application URL（`a7c3ad99bc`，新文档 `docs/user/guide/public-deployments.md`）；
- Node 无 TypeScript type-stripping 拒绝启动（`f3013b2d8d`）——自建启动链的嵌入方核对 Node 版本与开关；
- vendor 列车进 alpha 通道（cordis 4.0.5-alpha.1 / schemastery 3.18.5-alpha.1 等 9 包，`71086449e2`）；发布支持隔离 npm channels（`185b9c59e7`）——直依赖 vendor 包的插件核对锁定策略。

---

## 四、升级检查清单（rc.2 → 0.2.1-alpha.1 增量部分）

| # | 事项 | 级别 |
|---|------|------|
| 1 | 确认已完成 rc.1 迁移清单（peer 范围 / displayTitle） | 🔴 前置 |
| 2 | subpath 分发的插件：locale meta + `<subpath>/icon` 迁移，删 subpath `package.json` 导出；跑 `pnpm run verify-package-meta` 或开 Plugin Manager 核对行显示 | 🔴 有则必做 |
| 3 | 全文检索 `invariants` / `/invariant`：cordis.yml、patch、overlay、依赖里出现即删；`tsc` 过一遍被删符号 | 🔴 有则必做 |
| 4 | profile 里用过 schedule bundle 的：起一次 `dsh`；手工删除顶层 `time-context` override；侧栏确认 Automation tasks 与存量提醒还在 | 🟡 半自动 |
| 5 | 按条目 id 替换 composer stats 的插件：`stats` → `activity`/`usage` | 🟡 有则改 |
| 6 | 给子代理发提醒工具的编排插件：确认 `toolFilter.deny` / service 拒绝语义下的行为 | 🟡 有则测 |
| 7 | peer 范围 `>=0.2.0-rc.1 <0.3.0-0` **无需修改** | 🟢 无动作 |
| 8 | （可选）利用即时解析刷新简化安装后流程；插件模板补 icons/display metadata | 🟢 可选 |

## 五、可复核命令

```bash
repo=E:/test/rewrite-agently/deepseek-harness
R1=dsh-v0.2.0-rc.2; R2=dsh-v0.2.1-alpha.1

# 核心契约零 diff（预期全部空输出）
git -C $repo diff $R1..$R2 -- packages/boot/app-boot/src/plugin-compatibility.ts   # peer 校验未动
git -C $repo diff $R1..$R2 -- packages/api/plugin-config                           # settings API 未动
git -C $repo grep -n "SESSION_FORMAT_VERSION = " $R2 -- packages/core/session/src/types.ts  # 仍为 4
git -C $repo diff --stat $R1..$R2 -- "docs/persistence-changes/" | grep -v releases # 无新增承认

# 包结构换代
git -C $repo diff --diff-filter=ADR --name-status $R1..$R2 -- "packages/*/*/package.json"

# 显示面换代
git -C $repo show $R2:docs/upgrade-guide/v0.2.0-rc.2/subpath-plugin-display-manifest/guide.md

# invariants 移除
git -C $repo show $R2:docs/upgrade-guide/v0.2.0-rc.2/remove-runtime-invariants/guide.md
git -C $repo grep -n "invariants" $R2 -- packages/boot/app-boot/src/profile-resolution/ | head  # 预期空

# Schedule 换挂载
git -C $repo show $R2:docs/upgrade-guide/v0.2.0-rc.2/schedule-bundle-retired/guide.md
git -C $repo diff $R1..$R2 -- packages/bundle/web-app/presets/standard.patch.yml   # time-context + tool-schedule + deny
git -C $repo show $R2:packages/schedule/tool-schedule/README.md                   # preset 作用域四工具

# 运行时解析 / HMR
git -C $repo show $R2:.agents/notes/implemented/architecture/2026-09-30-profile-package-refresh-and-manifest-invalidation.md
git -C $repo diff --stat $R1..$R2 -- packages/boot/hmr/                           # package-manifest.ts +330

# stats dock 拆分
git -C $repo show 2190082866 -- packages/client/ui-chat/src/client/apply.ts
```
