# DSH v0.2.1-rc.1 CHANGELOG（dsh-v0.2.1-alpha.5 → dsh-v0.2.1-rc.1）

> 4 commits（2 非 merge + 2 merge）｜ 2026-10-16 ｜ 发布 PR #6387（merge `1600d8a1e1`）
> 355 files changed, +355 / −355 —— **全部为 `package.json` 版本行**（`0.2.1-alpha.5` → `0.2.1-rc.1`），无一个非 package.json 文件

## Packages（结构变化）

- 无。非 merge 提交仅两枚：`release: setup next release version for dsh@0.2.1-rc.1` 与 `release(dsh): 0.2.1-rc.1`。

## Features / Behavior Changes / Fixes

- **无**。本版不含任何功能、行为或修复增量；0.2.1-rc.1 的功能面 = 0.2.1-alpha.5 的功能面。

## 对插件的实际意义（唯一）

- **runtime 版本字符串**变为 `0.2.1-rc.1`：
  - peer 规则下：`0.2.1-alpha.1` 起的 caret（`^0.2.1-alpha.x`）经 `includePrerelease` **可命中** rc.1（同 `0.2.1` 三元组，预发布序 `alpha.5 < rc.1`）；
  - `>=0.2.1-rc.1` 形式**不命中** alpha 线；
  - `engines.dsh` 声明（a.4+）同理按 semver 预发布序判定。
- 0.2.1 线转 rc 意味着**进入发布候选/冻结**：新功能预期进 alpha 线（0.2.2-alpha.x），rc 段只收修复——跨线适配的验证重心可收敛。

## 复核命令

```bash
git log --format='%h %s' dsh-v0.2.1-alpha.5..dsh-v0.2.1-rc.1        # 4 条
git diff --name-only dsh-v0.2.1-alpha.5 dsh-v0.2.1-rc.1 | Select-String -NotMatch 'package\.json'   # 空
git diff --shortstat dsh-v0.2.1-alpha.5 dsh-v0.2.1-rc.1             # 355 files +355/−355
```
