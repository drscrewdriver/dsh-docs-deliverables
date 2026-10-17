# DSH v0.2.1-alpha.4 CHANGELOG（dsh-v0.2.1-alpha.3 → dsh-v0.2.1-alpha.4）

> 89 commits（64 非 merge + 25 merge）｜ 2026-10-14 ~ 2026-10-15 ｜ 发布 PR #6301（merge `86a402200d`）
> 标记：⭐ 新能力面 ｜ ⚠️ 行为变化 ｜ 🔌 插件可见 ｜ 📋 官方升级指南（`docs/upgrade-guide/v0.2.1-alpha.3/plugin-engines-dsh`）
> 结构：**5 新增包 / 0 删除 / 0 改名**；`SESSION_FORMAT_VERSION` 保持 4，**无新增持久化承认**；**兼容性闸门换代（唯一 🔌 契约级变化）**

## Packages（结构变化）

- ➕ `packages/boot/plugin-market` —— **`ctx.pluginMarket`** 缝：抓取/校验用户配置的 index 源（`3de3a977e0`）
- ➕ `packages/client/ui-plugin-market` —— 市场 UI（Discover 页 / Installed tab / More 组）
- ➕ `packages/experimental/plugin-market-bundle` —— Custom plugin markets bundle
- ➕ `packages/util/plugin-market-index` —— 索引格式与校验
- ➕ `apps/plugin-market-generator` —— 参考索引生成器（`434dc116f0`；commander 解析 + 来源仓库记录 `14abe9543c`）

## Features

- 📋 ⚠️ 🔌 **feat(plugins): `engines.dsh` 成为首要兼容判据**（`plugin-compatibility.ts` +41/−27）
  包自身 `engines.dsh` 范围**单独决定**结果并忽略 dsh peers；缺 `engines.dsh` 才逐 peer 匹配（`workspace:^/~/ *` 仅 peer 有效）；`engines.dsh` 中出现 `workspace:` = 不兼容；`engines` 非对象或 `engines.dsh` 非字符串 = 拒载。`PluginCompatibility.peers` → **`requirements`**（`IncompatiblePlugin` 同步改名；engines 判定键 `engines.dsh`、peer 判定键包名）。官方指南 `plugin-engines-dsh`。
- ⭐ 🔌 **feat(plugin-market): 插件市场族**（`3de3a977e0` bundle+Discover / `ed92c867ed` 安装点名插件与版本 / `ab3bb74550` 来源仓库 / `b227127d62` Installed tab 与 More 组列表）
  新缝 `ctx.pluginMarket`（core）+ `plugins.tab` 槽；安装仍走 plugin manager 原语。
- 🔌 **feat(client-modules): 宿主 release 换代刷新语义**（`a7a40f93d9` 解析图前先比宿主 release / `f52abc04fa` 不应用来自其它宿主 release 的插件更新 / `7c9e54b3ef` 宿主 release 变化时提示重载；决策 note `f12bf31c4a`）
- ⭐ **feat(webworker): 预览从随附 profile 引导 + 懒取 chunk**（`93d2ad2d25`；`packages/experimental/webworker-runtime` +1361/−186）
- **feat(plugins): 内置功能预览标准化**（`c1269a8f75` 统一形态 + 语音输入示例 / `e527c04663` bundle 详情可选预览 / `ade9979185` 限双语内置 SVG / `37dbd15e0c` 本地化 / `fb752c7763` badge 图示精修 / `34252e34d0` 指南 note）
- **feat(web): 斜杠命令原子 chip**（`98d93db18f` claim 为 chip / `510cd4cdcc` 两步删除覆盖每条删除路径 / `6f8b55f3eb` 重载后恢复已 claim chip）
- **feat(models): 推理档位治理**（`b542292bf9` 档位读 pi-ai schema / `f61d9982f8` 自定义 API 模型档位可编辑 / `a0a04158f8` 编辑随模型保存 + 镜像 pi-ai 拒答 / `7d654c9d8a` 删 switched-off 提示 / `02d25c695e` Off 文案与重置规则）
- **feat(ui-tool): 命令退出中性 inline capsule**（`00f897b048` 显示 / `97a833471f` 预留 inline 位 / `95e76236bf` 隔离 badge + 长描述覆盖 / `e8488f6b41` 保留缺失退出码 / `39d3849452` Host 退出解析分离）
- **feat(subagent-codex): 接受 `partial_answer` 消息相位**（`08d57291ad`；措辞修正 `e480bda8d2`）
- **feat(desktop): test 打包允许仓库分支**（`61059baf61`）；**feat(telemetry): 产品事件附缓存桌面环境**（`4dee41f4bc`；边界修复 `04c9489065`）
- **feat(gates): 包源码禁 module-scope await**（`b77cc1c0f2`——语法感知门扫 `packages/*/*/src`，仅豁免可执行入口；SenseVoice worker/SSH helper/Inspector worker 改显式 `main()`。宿主一方工程门禁，第三方插件不被扫描但建议对齐）

## Behavior Changes（⚠️ 非 API breaking）

- ⚠️ 🔌 跨宿主 release 的插件更新**不再自动应用**（见 Features §3）——升级宿主后插件生效需按提示重载。
- ⚠️ `plugins.tab` 官方市场页占位；自挂市场入口的第三方页与官方功能重叠（非冲突）。
- 🟢 设置页焦点行为（`ba090a4b59` 释放提示打开时聚焦 Not now）。

## Fixes（精选）

- **fix(subprocess-local)**: Linux  containment 可测选择器（`da5e23e8e8`）、user manager 逐次确认（`055c7d7a74`/`c97f840c89`）、systemd <254 原生 scope 支持（`0fffa2432a`）、每 provider 单次探测（`404e64b435`）、失败命名恢复（`d73ad23353`）——Linux 沙箱线大幅加固。
- **fix(desktop)**: 安装器目录锁重试与失败上报（`14819e2eb4`）、恢复路径保留（`c7ab529c34`）、展开目录失败细节封顶（`06e5024577`）、审批链接对齐规范化上传目的（`1bd032be88`）。
- **fix(inspector)**: Worker 启动期仍服务 Client bootstrap（`bf1a2bf69c`）。
- **fix(dependencies)**: experimental 包纳入发布依赖策略检查（`22c51728ed`）。
- **fix(office)**: 渲染回复与 PDF 检查限于可用文件（`f12fa3bad1`）。

## Docs / 工程面

- 官方升级指南 **1 篇**：`v0.2.1-alpha.3/plugin-engines-dsh`（三语）。
- 能力缝：`ctx.pluginMarket` +1，0 删除；slot 目录 +`plugins.tab`（+63/−8）。
- 探针（tag `dsh-v0.2.1-rc.1` 同面）：`engines.dsh` 命中文件数 0→21；gate 面 `evaluatePluginCompatibility` 7→10。

## 复核命令

```bash
git rev-list --no-merges --count dsh-v0.2.1-alpha.3..dsh-v0.2.1-alpha.4   # 64
git diff dsh-v0.2.1-alpha.3 dsh-v0.2.1-alpha.4 -- packages/boot/app-boot/src/plugin-compatibility.ts
git grep -l "engines.dsh" dsh-v0.2.1-alpha.4 -- packages   # 闸门读点
```
