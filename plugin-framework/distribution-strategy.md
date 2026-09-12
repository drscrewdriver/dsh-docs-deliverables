# DSH 插件多版本分发策略

> 适用场景：一个插件需要同时支持 DSH 不同大版本（如 0.1.1 和 0.1.2+），且两者的客户端依赖包不兼容。

---

## 一、问题背景

DSH 在 0.1.2-alpha.2 做了客户端包重构，在 0.1.3+ 引入了新的 peer 依赖：

| DSH 版本 | 客户端包 | Settings API | 新增 peer |
|---|---|---|---|
| ≤ 0.1.1-rc.2 | `dsh-client-runtime` | `register()` | — |
| ≥ 0.1.2-rc.1 | `dsh-client-store` | `installSection()` | `dsh-permission-presets` |
| ≥ 0.1.3-alpha.1 | `dsh-client-store` | 字符串命名空间 | `dsh-permission-presets`、`dsh-settings` |
| ≥ 0.1.5-alpha.1 | `dsh-client-store` | 字符串命名空间 | + `ui-dockkit`、`ui-sidebar-files` 等 |

### 1.1 完整依赖与能力接口矩阵

> 供分发策略制定时查表。详细的模块可用性请查阅 `dsh-015-notes.md` §插件侧模块可用性矩阵。

**客户端依赖变更**：

| 模块 | ≤ 0.1.1 | ≥ 0.1.2 | ≥ 0.1.5 | 分发影响 |
|------|---------|---------|---------|----------|
| `dsh-client-runtime` | ✅ | ❌ 移除 | ❌ | 0.1.0 版本必须声明 |
| `dsh-client-store` | ❌ | ✅ 新增 | ✅ | 0.1.1+ 版本必须声明 |
| `dsh-client-ui-conversation` | ✅ | ✅ | ✅ | 通用 |
| `dsh-client-ui-slots` | ✅ | ✅ | ✅ | 通用 |
| `dsh-client-connection` | ❌ | ❌ | ✅ 新增 | 仅 0.1.5+ RPC 通道 |

**服务端能力接口变更**：

| 接口 | ≤ 0.1.1 | ≥ 0.1.2 | ≥ 0.1.5 | 分发影响 |
|------|---------|---------|---------|----------|
| `settings.register()` | `settingsNamespace(ns)` | 直接字符串 | 同0.1.2 | 0.1.0 版本用旧 API |
| `subagents` | `registerContinuableSetup` | `startContinuable` | 同0.1.2 | 0.1.0 版本用旧 API |
| 客户端事件 | `conversationEvents` | `uiConversation` | 同0.1.2 | 0.1.0 版本用旧名 |
| RPC 通道 | `webServer.register` | `webServer.register` | `connection.rpc.intercept` | 仅 0.1.5+ 变更 |
| 客户端 API | `/endpoint` | `/endpoint` | `/api/endpoint` | 仅 0.1.5+ 变更 |
| sandbox | 隐式可用 | 隐式可用 | 显式 peerDep | 0.1.5+ 需声明 |

**结果**：插件的客户端 bundle 在不同 DSH 版本中需要导入不同的包名，无法用单一版本同时兼容。

### 1.2 已验证插件依赖迁移实例

> 12 个已分析插件的 package.json 实际依赖声明与版本适配状态（仓库地址已通过 GitHub 平台搜索核对，2026-09-12）。

| 插件 | engines.dsh | peerDependencies 范围 | inject 中的客户端包 | dsh-client-runtime？ | 0.1.2 适配 | 0.1.5 适配 |
|------|------------|----------------------|-------------------|---------------------|-----------|-----------|
| dsh-bash-terminal | — | `^0.1.5-rc.1` | locale + ui-settings + api-remotes | ❌(v0.3.15) | 🟢4处 | ✅v0.3.15原生 |
| dsh-better-display | — | `^0.1.2-rc.1` | +5项(chat,renderer,session,controller) | ❌(compat分支) | 🟡10+处 | ✅HEAD原生 |
| dsh-live-token-stats | — | cordis only | dsh-client-runtime + ui-conversation | ⚠️(0.1.2) | 🟡6处 | 🟡3处(RPC) |
| dsh-agent-teams | — | — | conversationEvents→uiConversation | ⚠️(旧版) | 🟢2处 | ✅ |
| dsh-input-traffic | `>=0.1.2-alpha.1` | `>=0.1.2-alpha.1 <0.2.0-0` | locale + ui-conversation | ❌ | ✅已适配 | ✅ |
| dsh-thinking-levels | `>=0.1.2-alpha.1` | `>=0.1.2-alpha.1 <0.2.0-0` | locale + ui-renderer + ui-slots + ui-settings | ❌ | ✅已适配 | ✅ |
| dsh-perm-gate | `>=0.1.2-alpha.1` | cordis only | locale + ui-renderer + ui-settings + ui-slots | ❌ | ✅已适配 | ⚠️permissionPresets |
| dsh-session-guard | `>=0.1.0-rc.7` | `>=0.1.0-rc.7 <0.2.0-0` | locale + ui-settings + ui-renderer | ❌ | ✅已适配 | ✅ |
| **dsh-tidychat** | **无声明** | `dsh-settings: ^0.1.0-rc.7` | **dsh-client-runtime** + ui-settings | ⚠️**是** | ❌**需迁移** | ⚠️需验证 |
| bainianlaoyao/codex | — | `^0.1.2-rc.1 \|\| ^0.1.5-rc.1` | — | — | ✅已适配 | ✅双版本 |
| shuind/codex | — | `>=0.1.0-rc.8` | dsh-client-runtime + ui-conversation | ⚠️(旧devDep) | ✅已适配 | ⚠️session修复 |
| apply-patch | — | 零依赖 | — | — | ✅零依赖 | ⚠️ctx.fs |

**跨版本兼容 workaround 案例（dsh-tidychat）**：
- inject 列表保留 `dsh-client-runtime`（旧包名），0.1.1 能解析，0.1.2+ 通过 alias 兼容
- `tsconfig.json` 设置 `skipLibCheck: true` + `strict: false`
- 代码中多处 `as any` 绕过 DSH 内部类型
- settings API 双回退：`installSection` / `register` 自动适配（v0.2.7+）
- 折叠锚点双路径：`data-chat-turn` + `data-chat-anchor-key` 回退（v0.2.8+）
- **效果**：v0.2.10 同一份代码在 DSH 0.1.0-rc.7 ~ 0.1.5+ 均可运行

**正式 0.1.2 适配模式**（dsh-tidychat / dsh-bash-terminal 同模式）：3 处替换（inject + devDeps + client import）。

---

## 二、分发方案：同名多版本

### 2.1 核心思路

**同一 npm 包名** `dsh-session-search-toggle`，通过 semver 版本区分兼容范围：

```
npm 包名：dsh-session-search-toggle
├── 0.1.0  →  DSH ≤ 0.1.1  (使用 dsh-client-runtime)
└── 0.1.1  →  DSH ≥ 0.1.2  (使用 dsh-client-store)
```

用户通过 `dsh plugin add dsh-session-search-toggle@<version>` 选择版本。

### 2.2 版本锁定机制

每个版本通过以下元数据声明兼容范围：

| 元数据 | 0.1.0 | 0.1.1 |
|---|---|---|
| `package.json → engines.dsh` | 无限制 | `>=0.1.2-rc.1` |
| `package.json → peerDependencies` | `dsh-client-runtime >=0.1.0` | `dsh-client-store >=0.1.2-rc.1` |
| `dsh.plugin.json → engines.dsh` | `>=0.0.1` | `>=0.1.2-rc.1` |

> **v0.1.3+ 注意**：如果插件使用 Permission Presets，需额外声明 `dsh-permission-presets` 为 optional peerDependency。

---

## 三、awesome-dsh-plugins 分发

### 3.1 README 条目格式

awesome-dsh-plugins 的 README.md 中，插件条目应包含版本矩阵：

```markdown
### [dsh-session-search-toggle](/dsh-session-search-toggle)
DSH web 侧边栏会话搜索增强：标题/内容一键切换，按用户/回复/工具筛选。

| 版本 | DSH 兼容 | 安装命令 |
|---|---|---|
| 0.1.0 | ≤ 0.1.1 | `dsh plugin add dsh-session-search-toggle@0.1.0` |
| 0.1.1 | ≥ 0.1.2 | `dsh plugin add dsh-session-search-toggle@0.1.1` |
```

### 3.2 投稿 PR 模板

```markdown
## 插件信息

- **名称**：dsh-session-search-toggle
- **npm**：[`dsh-session-search-toggle`](https://www.npmjs.com/package/dsh-session-search-toggle)
- **仓库**：https://github.com/drscrewdriver/dsh-session-search-toggle
- **描述**：DSH web 侧边栏会话搜索增强：标题/内容一键切换
- **版本线**：0.1.0 (DSH ≤0.1.1) → 0.1.1 (DSH ≥0.1.2)

## 版本兼容

本插件提供两个版本以适配 DSH 不同大版本：

| 版本 | DSH 范围 | 核心依赖 |
|---|---|---|
| 0.1.0 | 0.0.x ~ 0.1.1 | `dsh-client-runtime` |
| 0.1.1 | 0.1.2+ | `dsh-client-store` |

安装时请指定版本号以匹配你的 DSH 版本。
```

---

## 四、dshmarket 分发

### 4.1 插件元数据（marketplace.json 或等效格式）

```json
{
  "id": "dsh-session-search-toggle",
  "name": "会话搜索增强",
  "description": "DSH web 侧边栏会话搜索增强：标题/内容一键切换",
  "repository": "https://github.com/drscrewdriver/dsh-session-search-toggle",
  "npm": "dsh-session-search-toggle",
  "versions": [
    {
      "version": "0.1.0",
      "dshRange": ">=0.0.1 <=0.1.1-rc.2",
      "description": "旧版，使用 dsh-client-runtime"
    },
    {
      "version": "0.1.1",
      "dshRange": ">=0.1.2-rc.1",
      "description": "新版，使用 dsh-client-store"
    }
  ],
  "defaultVersion": "0.1.1"
}
```

### 4.2 自动版本匹配逻辑

marketplace 安装脚本伪代码：

```python
def install_plugin(plugin_id, dsh_version):
    versions = get_available_versions(plugin_id)
    
    # 按 DSH 版本降序排列，找到第一个兼容的版本
    for v in sorted(versions, reverse=True, key=parse_version):
        if dsh_version_matches(v.dshRange, dsh_version):
            run(f"dsh plugin add {plugin_id}@{v.version}")
            return
    
    raise Error(f"No compatible version of {plugin_id} for DSH {dsh_version}")
```

---

## 五、Git 分支策略

```
master (main)
├── v0.1.0 tag   ← 旧版锁定点
├── v0.1.1 tag   ← 新版（OldLigant cherry-pick）
└── 未来 v0.1.2  ← 新功能，继续基于 dsh-client-store
```

### 5.1 发布流程

```bash
# 1. 旧版 0.1.0 已发布（npm 上已存在）
# 无需重复发布，npm 版本不可变

# 2. 新版 0.1.1 发布
git checkout v0.1.1
pnpm install
pnpm build
npm publish --access public

# 3. 验证
npm view dsh-session-search-toggle versions
# 应显示: ["0.1.0", "0.1.1"]
```

### 5.2 未来版本规划

```
v0.1.2  ← 新功能（如高级搜索语法），继续 dsh-client-store
v0.1.3  ← Permission Presets 适配（如需要）
v0.1.5  ← Sidebar 重写适配（如插件涉及 Sidebar）
v0.2.0  ← 可能的大重构，评估是否需要新的依赖变更
```

### 5.3 三版本分发示例（0.1.5+ 场景）

如果插件需要同时支持 0.1.1、0.1.2、0.1.5 三个大版本：

```
npm 包名：my-dsh-plugin
├── 0.1.0  →  DSH ≤ 0.1.1    (dsh-client-runtime)
├── 0.1.1  →  DSH 0.1.2~0.1.3 (dsh-client-store, 无 Sidebar 依赖)
└── 0.1.2  →  DSH ≥ 0.1.5    (dsh-client-store + 可选 ui-dockkit)
```

---

## 六、常见问题

### Q: 两个版本共享同一 npm 包名，会冲突吗？

不会。npm 的 semver 机制天然支持多版本共存。用户通过 `@<version>` 指定安装哪个版本。

### Q: awesome-dsh-plugins 的 CI 如何验证两个版本？

CI 应在不同 DSH 版本环境下分别测试：
- DSH 0.1.1 + 插件 0.1.0 → 应成功
- DSH 0.1.2 + 插件 0.1.1 → 应成功
- DSH 0.1.2 + 插件 0.1.0 → 应失败（peerDep 不匹配）

### Q: 如果 DSH 未来又做了大的包重构怎么办？

重复上述流程：
1. 在当前版本打 tag
2. 适配新依赖，发布新版本
3. 更新 README 兼容矩阵
4. 更新 marketplace 的 versions 列表

### Q: 旧版本还会维护吗？

0.1.0 是"锁定"状态——不加新功能，只修安全漏洞。用户应尽快升级 DSH 到 0.1.2+ 并使用 0.1.1+。

---

## 七、验证清单

发布前逐项检查：

- [ ] 0.1.0 tag 已创建，package.json 版本正确
- [ ] 0.1.1 tag 已创建，package.json 版本正确
- [ ] 0.1.1 的 `engines.dsh` 声明为 `>=0.1.2-rc.1`
- [ ] 0.1.1 的 peerDependencies 使用 `dsh-client-store`
- [ ] 0.1.1 的 dsh.client.inject 不包含 `dsh-client-runtime`
- [ ] 如需 v0.1.3+ 兼容：检查 `dsh-permission-presets` optional peer
- [ ] 如需 v0.1.5+ 兼容：检查 Sidebar slot 契约变更
- [ ] README 顶部版本兼容矩阵已更新
- [ ] awesome-dsh-plugins README 条目包含版本矩阵
- [ ] dshmarket 的 versions 列表已更新
- [ ] npm publish 成功（`npm view` 验证）
- [ ] 在 DSH 0.1.1 上测试 0.1.0 安装成功
- [ ] 在 DSH 0.1.2 上测试 0.1.1 安装成功

---

*参考：OldLigant/dsh-session-search-toggle@456909f，DSH 0.1.2-alpha.2 客户端包重构*
