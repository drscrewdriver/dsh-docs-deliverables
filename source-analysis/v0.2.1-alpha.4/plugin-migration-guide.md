# 插件迁移指南：v0.2.1-alpha.3 → v0.2.1-alpha.4

> 结论：**两类必查**——①package.json 里有 `engines.dsh` 的包（从"无害装饰"变成"独裁判据"）；②读取拒载记录 `peers` 字段的代码（改名 `requirements`）。其余多数插件零改。

## 闸门双时代（本版的分水岭意义）

| | ≤ 0.2.1-alpha.3 | ≥ 0.2.1-alpha.4 |
|---|---|---|
| `engines.dsh` | **不被读取**（写了也无效） | **单独决定**兼容性，dsh peers 全忽略 |
| dsh peers | 逐个 `semver.satisfies(includePrerelease)` | 仅当无 `engines.dsh` 时回落此规则 |
| `workspace:^/~/ *` | peer 中有效（= runtime 版本） | peer 中仍有效；**`engines.dsh` 中出现 = 不兼容** |
| 拒载记录形状 | `PluginCompatibility.peers` | `PluginCompatibility.requirements`（键：`engines.dsh` 或 peer 包名） |

## 必做项

1. **盘点 `engines.dsh`**：`grep -n '"dsh"' package.json`。
   - 若有且要跨多线：范围必须**覆盖全部支持版本**（peers 不再放宽/收窄它）——例如 `">=0.1.7-rc.1"`（注意 `includePrerelease` 下同三元组规则）；
   - 若只想沿用 peer 白名单：**删掉 `engines.dsh`** 即回到 peer 时代语义；
   - `engines.dsh` 里的 `workspace:*` 一律换成语义化范围；`engines` 保持对象、`engines.dsh` 保持字符串（否则**拒载**）。
2. **读 `IncompatiblePlugin`/`PluginCompatibility` 的代码**：`peers` → `requirements`（做兼容读取可 `rec.requirements ?? rec.peers` 过渡）。
3. **升级验证**：`dsh plugin --profile <p> add <pkg>@<version>` 装一次，不匹配时拒绝信息会列 `engines.dsh` 或对应 peer 包。

## 行为核对（无需改码）

| 面 | 现象 | 动作 |
|---|---|---|
| 宿主换代 | 升级宿主后插件更新不自动应用，界面提示重载 | 发布说明中告知"重启/重载"步骤 |
| 插件市场 | 官方 Discover/`plugins.tab` 进门 | 自挂市场入口的插件评估去留 |
| 市场安装 | 安装仍走 plugin manager | `already-installed`（a.3）语义照常处理 |
| module-scope await | 宿主一方门禁（不扫第三方包） | 新代码建议对齐（顶层 `await import` 除外） |

## peer / 装载面速核（零变化项）

- `SESSION_FORMAT_VERSION` 保持 4，无新持久化承认；settings 核心 / vendor cordis·schemastery / HMR 过期机制零 diff；
- a.3 的六类必做项（JSONL/JobId/子代理 preset/installBundle/interactions/槽名）在本版**不回收**，仍逐条成立。

## 检查清单

1. [ ] `engines.dsh` 三态决策（补范围 / 删除 / 保留）；
2. [ ] `requirements` 改名适配；
3. [ ] 目标宿主矩阵补 `0.2.1-alpha.4`，干净格装载冒烟；
4. [ ] 发布包 `npm pack` 后核对 package.json 最终形状（sync-hosts 单源下发时同步 engines 与 peers 的策略要一致）。
