# 插件迁移指南 — 0.2.1-rc.3 → 0.2.1-rc.4

> 结论：**契约面零必改 + 一项元数据枚举 + 两项探针/日志自查**。rc.1/rc.2/rc.3 迁移清单照原样成立。

## 一、必做项

### M1. 元数据枚举补 `0.2.1-rc.4`（仅枚举式写法）

engines.dsh 时代（≥a.4）闸门对声明了 `engines.dsh` 的包按该键**单独裁决**：

- 枚举式清单（逐版本字符串精确匹配）：**必须加 `0.2.1-rc.4` 行**，否则在 rc.4 宿主上拒载——落点为 `scripts/hosts.mjs` 单一事实源 + `sync-hosts.mjs --write` 的双清单同串纪律（package.json peers / dsh.plugin.json / README）。
- caret 写法 `^0.2.1-alpha.1`：rc.4 同三元组（0.2.1），天然覆盖，无需动（`includePrerelease: true`）。

复核：`node scripts/sync-hosts.mjs`（校验模式）+ 装机后 `dsh plugin list` 无 `IncompatiblePlugin`。

## 二、自查项

### S1. DOM 探针 / e2e 文案锚（ui-conversation 头）

三处渲染行为变了，**任何以这些为锚的探针都会假阴性**：

- View 页签全名 tooltip **只在标签估算溢出（>88px 单元）时出现**——"hover 页签必有 title/tooltip"类断言失效；短中文名（≤6 全角字）不再有 tooltip；
- More 按钮 label/tooltip **不再内嵌当前折叠视图名**——以「更多会话视图 · {name}」/「More conversation views · {name}」全文匹配的探针失配（改用前缀/`session.moreViews` 静态文案，或改锚 `conversation.session.header.views.actions` 菜单行本身）；
- 宿主内部 locale 键 `session.moreViewsCurrent` 已删除——若曾镜像该键做翻译覆盖，同步删除。

### S2. 日志抓取面（ACP/stdout）

- `llm-deepseek-account` 模型目录诊断行**从 stdout 迁到 stderr**（tag 前缀 `[llm-deepseek-account]` 不变）——抓 stdout 建模录/listing 日志的脚本改读 stderr；
- ACP profile 下 stdout 现由 e2e 固化为**仅协议消息**：任何依赖 stdout 混排日志的旁路观测（含 mcp SDK debug 行）都不再可能有数据；
- 宿主 MCP 资源工具对**未宣告 resources 的服务器**直接回空页、不触服务器——断言"list 产生了一次服务器交互/进程写入"的测试放宽；消费侧返回形状不变（`{resources: []}`），一般无感。

### S3. rc.3 遗留自查项状态

`startSession` 空白复用排他（S1@rc.3）、三域条目可见性让渡（S2@rc.3）、DeepSeek /models listing 断言放宽（S3@rc.3）——rc.4 未改变这些事实，**清单原样继续适用**。

## 三、零动作面（复核过）

闸门两文件 / settings 核心 / vendor cordis·schemastery / `docs/` 整目录（含 capability-seams 与 upgrade-guide）/ slot-catalog（0 增删改名）/ `SESSION_FORMAT_VERSION`=4 / 持久化承认清单 / 包结构——**全部零 diff**；旧版风险表（a.1–rc.3）逐条仍适用。

## 四、升级检查清单

1. [ ] hosts.mjs 双清单加 `0.2.1-rc.4`（枚举式写法必做；caret 免）→ `sync-hosts.mjs --write` → 校验通过
2. [ ] grep 自有代码/e2e：`moreViewsCurrent`、`More conversation views`、`更多会话视图`、页签 tooltip 恒在假设——按 S1 改锚
3. [ ] 日志旁路：读 stdout 找 `[llm-deepseek-account]` 或 mcp debug 的脚本改 stderr（S2）
4. [ ] MCP 相关断言：涉及未宣告 resources 服务器的"触达性"测试放宽（S2）
5. [ ] rc.3 遗留项复核：`startSession` 排他传参 / 三域条目可见性 / DeepSeek listing 断言
6. [ ] 装机冒烟：`dsh plugin list` 无拒载；挂 View 的插件在新 tooltip 规则下头测一遍（长中文标签应仍有 tooltip、短标签应无）

## 五、可复核命令

```bash
git diff --stat dsh-v0.2.1-rc.3 dsh-v0.2.1-rc.4 -- packages/boot/app-boot/src/plugin-compatibility.ts docs/   # 空
git grep -n "moreViewsCurrent" dsh-v0.2.1-rc.4 -- packages   # 空（键删净）
git diff dsh-v0.2.1-rc.3 dsh-v0.2.1-rc.4 -- packages/mcp/mcp-client/src/connection.ts | grep -n "listable"
```
