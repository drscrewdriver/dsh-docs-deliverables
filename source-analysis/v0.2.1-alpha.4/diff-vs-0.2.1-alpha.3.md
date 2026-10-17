# DSH v0.2.1-alpha.3 → v0.2.1-alpha.4 逐主题差异

> 89 commits（64 非 merge + 25 merge）｜ 831 files +22232/−2044 ｜ `2fbf4359b8` → `86a402200d`

## 文件热度（Top）

| 目录 | 增量 | 主题 |
|---|---|---|
| `packages/client/ui-plugin-market` | +2886/−0（19） | §市场 UI |
| `packages/boot/plugin-market` | +2341/−0（23） | §市场后端 |
| `packages/experimental/webworker-runtime` | +1361/−186（33） | §Webworker 预览 |
| `apps/plugin-market-generator/{src,tests}` | +2181/−0（13） | §索引生成器 |
| `.agents/notes/implemented` | +1071/−12（28） | 设计依据 |
| `packages/client/ui-conversation` | +1030/−312（28） | §斜杠 chip |
| `packages/util/plugin-market-index` | +958/−0（8） | §索引格式 |
| `packages/subprocess/subprocess-local` | +929/−122（11） | §Linux 沙箱 |
| `packages/client/product-analytics` | +794/−27（14） | §遥测 |
| `packages/client/ui-settings-models` | +736/−19（15） | §推理档位 |
| `packages/client/ui-plugin-manager` | +673/−92（19） | §功能预览 |

---

## §1 兼容性闸门换代（唯一契约级）

`packages/boot/app-boot/src/plugin-compatibility.ts` +41/−27：

```
旧（0.1.7-rc.1 ~ 0.2.1-alpha.3）：只读 peerDependencies 中 @deepseek-ai/dsh* → semver.satisfies(includePrerelease)
                                  engines.dsh 完全不被读取
新（0.2.1-alpha.4+）：
  1. 有 engines.dsh → 该范围单独决定；满足→通过，不满足→requirements={'engines.dsh': range}（peers 被忽略）
  2. 无 engines.dsh → 回落旧 peer 规则（workspace:^/~/ * = runtime）
  3. engines 非对象 / engines.dsh 非字符串 → throw（拒载）
  4. engines.dsh 里的 workspace: 值 → 不满足
  接口：PluginCompatibility.peers → requirements（IncompatiblePlugin 同步）
```

- 测试面：`tests/plugin-compatibility.spec.ts` 同段更新；`packages/**` 中 `engines.dsh` 命中 0→21 文件（文档/校验/闸门）。

## §2 插件市场族

- `3de3a977e0` bundle + Discover tab；`ed92c867ed` 安装点名「插件名 + 版本」；`ab3bb74550` 携带来源仓库；`b227127d62` Installed tab 面板保留 + More 组列市场 bundle；
- `434dc116f0`/`14abe9543c` 参考生成器（commander 解析 options、记录 source repository）；
- 新缝 `ctx.pluginMarket`（fetch/validate 用户配置源；**安装走 plugin manager**——`already-installed` 等 a.3 语义照常适用）；
- slot 目录 `plugins.tab`（+63/−8）。

## §3 宿主 release 刷新语义（client-modules）

- `a7a40f93d9` 解析插件图前先比对宿主 release；`f52abc04fa` 来自其它宿主 release 的插件更新不自动应用；`7c9e54b3ef` 宿主 release 变化时提示重载（note `f12bf31c4a`）。

## §4 内置功能预览

`c1269a8f75` 标准化 + 语音输入示例；`e527c04663` bundle 详情可选预览；`ade9979185` 限双语内置 SVG；`37dbd15e0c` 本地化；`fb752c7763` badge 图示；`34252e34d0` 指南 note；`ba090a4b59` 焦点修复。

## §5 Web/UI

- 斜杠命令原子 chip：`98d93db18f` claim；`510cd4cdcc` 两步删除全路径；`6f8b55f3eb` 重载恢复（ui-conversation +1030/−312）。
- ui-tool 退出 capsule：`00f897b048`/`97a833471f`/`95e76236bf`/`e8488f6b41`/`39d3849452`/`174c08563f`。
- webworker 预览：`93d2ad2d25` 从随附 profile 引导 + 按需懒 chunk。
- models：`b542292bf9` 档位读 pi-ai schema；`f61d9982f8` 自定义模型档位编辑；`a0a04158f8` 随模型保存 + 拒答镜像；`7d654c9d8a` 删 Off 提示；`02d25c695e` 文案。

## §6 桌面 / Linux 沙箱 / 遥测 / 门禁

- desktop：`61059baf61` test 打包允许分支；`14819e2eb4`/`c7ab529c34`/`06e5024577`/`1bd032be88` 安装器与审批流修复；`24d73cae8d` 审批摘要完整。
- subprocess-local（Linux）：`da5e23e8e8`/`71de43d8ee`/`055c7d7a74`/`c97f840c89`/`0fffa2432a`（systemd<254）/`404e64b435`（每 provider 一probe）/`d73ad23353`（命名恢复）/`c218e79102`（systemd 236 下限文档）。
- telemetry：`4dee41f4bc` 缓存桌面环境入产品事件；`04c9489065` 边界修复。
- gates：`b77cc1c0f2` **包源码禁 module-scope await**（扫 `packages/*/*/src`，shebang/bin 入口豁免；三处 worker 改显式 `main()`）。
- dependencies：`22c51728ed` experimental 包进发布依赖策略。

## §7 零断裂面（显式核对）

| 面 | 结论 |
|---|---|
| settings 核心 / `configForms` | 零 diff |
| `SESSION_FORMAT_VERSION` | 保持 4；**无新承认** |
| JSONL / JobId / 子代理形状 | 沿用 a.3 |
| `plugin-install-over-installed` / HMR 替换 | 沿用 a.3 |

## 复核命令

```powershell
git diff dsh-v0.2.1-alpha.3 dsh-v0.2.1-alpha.4 -- packages/boot/app-boot/src/plugin-compatibility.ts
git diff --name-status dsh-v0.2.1-alpha.3 dsh-v0.2.1-alpha.4 -- "packages/**/package.json" | Select-String '^A'
git log --no-merges --format='%h %s' dsh-v0.2.1-alpha.3..dsh-v0.2.1-alpha.4
```
