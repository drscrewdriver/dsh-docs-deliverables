# DSH 0.2.2-rc.1 动态登记

> **数据源**: `deepseek-ai/DeepSeek-Harness` tag `dsh-v0.2.2-rc.1`（`66491b05e3`，2026-11-04 15:54 +08，PR #7870）
> **发布日期**: npm `@deepseek-ai/dsh@0.2.2-rc.1` 2026-11-04T09:20Z；宿主 dist-tag **`latest`** 已从 0.2.1-rc.5 切换至本版，`next` 同指本版，`alpha` 停在 0.2.2-alpha.3
> **性质**: **纯版本 bump**（同 0.2.1-rc.1 模式）——387 个 package.json 版本行从 `0.2.2-alpha.3` 改 `0.2.2-rc.1`，零代码面变化
> **统计**: 387 files changed, +387 / −387（全部为 `"version": "0.2.2-alpha.3"` → `"version": "0.2.2-rc.1"`），非 package.json 文件 **0**

---

## 关键事实

| 面 | 状态 |
|---|---|
| 代码面 | **零变化**（仅版本号字符串 bump） |
| 兼容性闸门 | 零 diff（继承 a.3 = a.2 = rc.5 = rc.4 全程零变） |
| SESSION_FORMAT_VERSION | 保持 4 |
| slot-catalog / capability-seams / persistence / upgrade-guides | 零 diff |
| npm dist-tags | `latest`=0.2.2-rc.1、`next`=0.2.2-rc.1、`alpha`=0.2.2-alpha.3 |
| 0.2.1 线状态 | `latest` 已从 0.2.1-rc.5 让位——**0.2.2 线正式接掌稳定通道** |

## 对插件作者的即时含义

1. **功能面即 alpha.3**：rc.1 相对 a.3 零代码差异，对插件的全部含义见 `v0.2.2-alpha.3/README.md`（`fs-observation-policy` 默认关、SDK 命令系统、Schedule 重写、cordis loader 换代等）——本段不再重复。
2. **装载判定变化**：runtime 字符串从 `0.2.2-alpha.3` 变为 `0.2.2-rc.1`。同三元组预发布序 `alpha < rc`，caret `^0.2.2-alpha.1` 天然命中 rc.1；**枚举式 engines.dsh 清单必须单列 `0.2.2-rc.1` 行**，仅有 `0.2.2-alpha.3` 不够。
3. **latest 切换的装机含义**：新装/自动更新的宿主默认拉 `latest`=0.2.2-rc.1；已有 0.2.1 线宿主手动升级时 peer 判定行为不变（闸门逻辑自 a.4 起未动）。
4. **0.2.1-rc.5 不再是 latest**：旧插件只列到 `0.2.1-rc.5` 的 engines.dsh 枚举在新宿主 0.2.2-rc.1 上**仍会拒载**（精确匹配无 0.2.2 项）——这是设计行为，跟进 0.2.2 线需显式补枚举。

## 复核命令

```bash
git -c http.proxy=http://127.0.0.1:30987 -c https.proxy=http://127.0.0.1:30987 \
  fetch https://github.com:443/deepseek-ai/deepseek-harness.git tag dsh-v0.2.2-rc.1 --no-tags

git diff --shortstat dsh-v0.2.2-alpha.3 dsh-v0.2.2-rc.1          # 387 +387/-387
git diff --name-only dsh-v0.2.2-alpha.3 dsh-v0.2.2-rc.1 | grep -v package.json  # 空
git show dsh-v0.2.2-rc.1:package.json | grep '"version"'         # 0.2.2-rc.1
npm view @deepseek-ai/dsh dist-tags --json                        # latest=0.2.2-rc.1
```
