# 插件迁移指南：v0.2.1-alpha.5 → v0.2.1-rc.1

> 结论：**无任何代码迁移项**（纯版本 bump）。唯一动作是把 `0.2.1-rc.1` 加入宿主矩阵并重跑装载冒烟。

## 装载核对

1. **peer 规则包（无 `engines.dsh`）**：runtime `0.2.1-rc.1` 命中判定——
   - `^0.2.1-alpha.1`（同三元组，含预发布）→ ✅ 命中（includePrerelease）；
   - 精确枚举 `… || 0.2.1-alpha.5` → ❌ 不命中 rc.1，**需补 `0.2.1-rc.1` 项**；
   - `>=0.2.1-rc.1` → ❌ 不命中 alpha 线（若矩阵含 alpha 需并列写）。
2. **`engines.dsh` 包（a.4+ 独裁判据）**：同上 semver 序判定（`alpha.5 < rc.1`）；`workspace:` 值仍被拒。
3. **豁免通道**：`dsh plugin allow-version` 语义不变（精确 `name@version` + 精确 runtime）。

## 检查清单

1. [ ] hosts.mjs 增 `0.2.1-rc.1` → `sync-hosts.mjs --write`（engines 与 peers 同步下发）；
2. [ ] 干净格装载冒烟（0.2.1-rc.1 预期与 alpha.5 行为逐面一致，任何差异都算宿主回归）；
3. [ ] README 兼容句由脚本更新，勿手改。
