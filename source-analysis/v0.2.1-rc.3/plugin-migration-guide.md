# 插件迁移指南 — 0.2.1-rc.2 → 0.2.1-rc.3

> 结论：**契约面零必改 + 一项语义自查 + 一项元数据枚举**。rc.1/rc.2 迁移清单照原样成立。

## 一、必做项

### M1. 元数据枚举补 `0.2.1-rc.3`（仅枚举式写法）

engines.dsh 时代（≥a.4）闸门对声明了 `engines.dsh` 的包按该键**单独裁决**：

- 枚举式清单（逐版本字符串精确匹配）：**必须加 `0.2.1-rc.3` 行**，否则在 rc.3 宿主上拒载——落点为 `scripts/hosts.mjs` 单一事实源 + `sync-hosts.mjs --write` 的双清单同串纪律（package.json peers / dsh.plugin.json / README）。
- caret 写法 `^0.2.1-alpha.1`：rc.3 同三元组，天然覆盖，无需动（`includePrerelease: true`）。

复核：`node scripts/sync-hosts.mjs`（校验模式）+ 装机后 `dsh plugin list` 无 `IncompatiblePlugin`。

## 二、自查项

### S1. `startSession`/`openWorkspace`/`connectWorkspace` 调用方 —— 空白会话复用（官方指南 1 篇）

签名未变、**语义变**：从"每次调用新建 Session+Agent"改为"按 preset 复用首个未开始、未归档的空白会话"。受影响形态：

- 依赖"调用即全新 Agent"做隔离的测试夹具/自动化 → 改为显式传 `{ agentPreset }` 排他，或先清理空白会话；
- 期待 New Session 后拿到**当前** preset 定义的插件流程 → 注意复用的空白保留创建时的 preset 组成（改定义后需重启 Host）；
- 验证方法（官方指南 §3）：New Session → 打草稿 → 切走 → 再 New Session，应回到同一空白且草稿在。

### S2. 三域条目可见性让渡给用户

左侧栏面板按钮 / View 页签 / 右侧栏 guide 卡的条目现在**可被用户钉选、隐藏、收进 More**：

- 展示面依赖"用户一定看得见我的入口"的插件：图标/名称质量与发现性权重上升；考虑注册进对应 `*.actions` More 菜单槽前自查同域竞争；
- 不要假设条目顺序 = 注册顺序（region-owned pins 会重排）。

### S3. DeepSeek 模型目录断言（走 API-key 路由者）

模型可用性开始受**官方 `/models` 网络 listing** 影响（失败回落内建目录；首用等待 ≤`modelsTimeoutMs` 默认 5s）。断言"内建 catalog 即全集"的脚本/e2e 需放宽或钉死配置。route Config 新增 `modelsTimeoutMs`/`modelsMaxAgeMs` 两个 additive volatile 键——构造完整配置对象做精确断言的测试会因新键失败。

## 三、零动作面（复核过）

闸门两文件 / settings 核心 / vendor cordis·schemastery / capability-seams / slot 结构删除与改名 / `SESSION_FORMAT_VERSION`=4 / 持久化承认清单——全部零 diff 或纯增量；旧版风险表（a.1–rc.2）逐条仍适用。

## 四、升级检查清单

1. [ ] hosts.mjs 双清单加 `0.2.1-rc.3`（枚举式写法必做；caret 免）→ `sync-hosts.mjs --write` → 校验通过
2. [ ] grep 自有代码 `startSession|openWorkspace|connectWorkspace`，按 S1 判定是否需传 `{ agentPreset }`
3. [ ] 展示面自查：条目被用户折叠/隐藏后核心功能仍可达（命令面板/快捷键兜底）
4. [ ] 涉 DeepSeek 模型的断言按 S3 放宽
5. [ ] rc.2 遗留项复核：`conversation.input.model.label` 同槽遮蔽（1017 徽章）+ `ctx.web` provider 钉选 volatile 化（settings.mutate 持久钉选）
6. [ ] 装机冒烟：`dsh plugin list` 无拒载、三域 More 菜单渲染正常、e2e 全绿

## 五、可复核命令

```bash
git diff --stat dsh-v0.2.1-rc.2 dsh-v0.2.1-rc.3 -- packages/boot/app-boot/src/plugin-compatibility.ts  # 空
git show dsh-v0.2.1-rc.3:docs/upgrade-guide/v0.2.1-rc.2/new-session-blank-reuse/guide.md
git diff dsh-v0.2.1-rc.2 dsh-v0.2.1-rc.3 -- packages/client/ui-workspace/src/client/navigation.ts | grep -n "blank"
```
