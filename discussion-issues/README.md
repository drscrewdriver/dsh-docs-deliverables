# Discussion → 子系统故障排查索引 & Bug 归因

> ⚠️ **本文件中的「关键词趋势」已被 LLM 语义分类取代，仅保留作为方法对照。**
> **权威结论请看 [`趋势报告-LLM.md`](./趋势报告-LLM.md)**（Qwen3.6-35B-A3B 对全部 6321 篇逐帖分类，互斥口径）。
>
> 在同一 6321 篇语料上实测，关键词法相对模型判定：
> **误报** 1915 篇（30.3%，被关键词判为问题但实为非问题）、
> **漏检** 305 篇（4.8%）、
> **单族命中且与模型主族一致**仅 287 篇（4.5%）。
>
> 因此**下面的数字不要用于决策**，尤其是绝对值与跨族比较。

> 本目录按**子系统**分解社区讨论中的故障排查知识。每个子目录下的 `discussion-issues.md` 遵循统一骨架：
> **症状 → 根因 → 临时方案 → 修复状态 → 官方文档参考 → Problem Types by Discussion Family**。

> 趋势数据生成时间：2026-09-12T14:44:38Z　|　语料：6321 篇（#13–#6442）
> 趋势原始数据：`_tools/trend-data.json`　|　复现脚本：`_tools/trend-analysis.cjs`

**工具链**：

| 脚本 | 作用 | 产出 |
|---|---|---|
| `checkpoint.cjs` | **读取 checkpoint 边界（避免重复劳动）** | — |
| `families.cjs` | 关键词族规则（单一权威源） | — |
| `trend-analysis.cjs` | 关键词法全量趋势 | `trend-data.json` |
| `gen-trend-report.cjs` | 渲染本文件（幂等） | 本文件 |
| `llm-classify.cjs` | **LLM 语义分类（默认按 checkpoint 只处理增量）** | `llm-classify.jsonl` |
| `canon-new-families.cjs` | 模型自创族的语义归并 | `new-family-canonical.json` |
| `llm-trend-report.cjs` | 渲染 LLM 权威趋势报告（幂等） | `趋势报告-LLM.md` |
| `probe-throughput.cjs` | 端点并发吞吐标定 | — |

**增量优先（避免重复劳动）**：`llm-classify.cjs` 默认 `--since auto`，从最新 checkpoint 的 `ID-LIST.txt` 推导边界，**只处理上一 checkpoint 之后的新讨论**。实测对照：全量 6321 篇耗时 61.5 分钟，而单批次增量通常仅数百篇。

| 调用 | 行为 |
|---|---|
| `node llm-classify.cjs` | 默认：按 checkpoint 边界 + 结果文件去重，只跑增量 |
| `node llm-classify.cjs --since 6442` | 显式指定边界 |
| `node llm-classify.cjs --since all` | 强制全量（**须同时删除 `llm-classify.jsonl`**，否则旧结果仍会被跳过） |

> **例外**：`trend-analysis.cjs` **不做** checkpoint 门控——趋势分析需要完整历史语料才能对比「基线 vs 增量」，裁剪反而会破坏结论。昂贵的 LLM 环节才需要门控。

---

## 一、子系统索引

| 子系统 | 主题 | 核心根因摘要 | 引入批次 |
|---|---|---|---|
| [`session-migration/ `](./session-migration/discussion-issues.md) | 会话格式迁移失败 v0→v1→v2→v3 | 整份拒载语义：一条不合规历史记录即拒绝整份日志 | 2026-09-12 |
| [`session-fork/ `](./session-fork/discussion-issues.md) | Fork 继承父会话 pending inbox | fork seed 切割把已入队未执行的消息带进子会话 | 2026-09-12 |
| [`session-projection/ `](./session-projection/discussion-issues.md) | 长会话加载失败 / 投影缓存 | 会话读取路径的拒载点与投影缓存增长 | 基线 |
| [`subagent/ `](./subagent/discussion-issues.md) | 子代理模型继承 | 子代理继承父代理创建时的模型选择 | 基线 |
| [`llm-streaming/ `](./llm-streaming/discussion-issues.md) | Developer role 不兼容 | pi-ai 发 role:developer，第三方网关静默丢弃 | 基线 |
| [`code-runtime/ `](./code-runtime/discussion-issues.md) | 沙箱 / 工具调用运行时 | 提权语义、工具调用参数、picker 工作器 | 基线 |
| [`filesystem/ `](./filesystem/discussion-issues.md) | 文件系统 / Windows 路径 | 中文路径截断、盘符、reveal 定位失败 | 基线 |
| [`web-server/ `](./web-server/discussion-issues.md) | Web 服务 / 鉴权 / 局域网 | 一次性 token、绑定 0.0.0.0、bundle 陈旧 | 基线 |
| [`token-meter/ `](./token-meter/discussion-issues.md) | Token 计量 / 上下文压缩 | TokenMeter O(n²)、压缩失效 | 基线 |

> 另有 7 个既有子系统文档（`code-runtime` / `filesystem` / `llm-streaming` / `session-projection` / `subagent` / `token-meter` / `web-server`）在 2026-09-12 追加了 `## 增量补充 — #5886–#6442` 段落。

---

## 二、趋势口径

**语料是一个剧烈衰减的序列**：社区开版首周涌入 3386 篇，到 W4 只剩 355 篇（降至 10.5%）。这意味着：

- 直接比绝对篇数 → 会把「大盘整体退潮」误读成「每类问题都在好转」；
- 只看份额（per-1k）→ 会把「衰减得比大盘慢」误读成「问题爆发」。

**因此本报告双口径并列**，并对每一族同时给出绝对篇数与份额，判定以**绝对变化**优先：

| 口径 | 定义 | 回答的问题 | 盲区 |
|---|---|---|---|
| **绝对篇数** | 该族当周实际帖数 | 问题绝对量是增是减 | 被大盘退潮掩盖 |
| **份额** | 该族篇数 ÷ 当周总篇数 × 1000 | 社区注意力是否转向 | 无法证明绝对量增长 |
| **份额倍数** | 族衰减率 ÷ 大盘衰减率 | 相对大盘是强是弱 | 同样不等于绝对增长 |

| 周 | 日期区间 | 篇数 | 相对 W0 |
|---|---|---|---|
| W0 | 08-13~08-19 | 3386 | 100.0% |
| W1 | 08-20~08-26 | 1206 | 35.6% |
| W2 | 08-27~09-02 | 767 | 22.7% |
| W3 | 09-03~09-09 | 607 | 17.9% |
| W4 | 09-10~09-16 | 355 | 10.5% |

> **注意**：W4（09-10~09-16）仅含 09-10 至 09-12 三天数据，样本最小（355 篇），单篇帖即可影响份额约 2.8/千。W4 的高份额项须结合绝对篇数复核。

---

## 三、趋势总表（双口径：绝对篇数 + 份额）

**必须先看这一条**：语料总量本身在剧烈衰减——W0 有 3386 篇，W4 只有 355 篇（**降至 10.5%**）。因此「份额上升」不等于「问题变多」：一个族只要**衰减得比大盘慢**，份额就会上升。

| 口径 | 含义 | 能回答 | 不能回答 |
|---|---|---|---|
| **绝对篇数** | 该族当周实际帖数 | 问题绝对量是否增长 | 受大盘衰减干扰 |
| **份额 (per-1k)** | 该族占当周总量比例 | 社区注意力是否转向该族 | 不能证明绝对量增长 |
| **相对存活** = 族衰减率 ÷ 大盘衰减率 | 该族抗跌程度 | 相对大盘是强是弱 | 不等于绝对增长 |

> 本期大盘衰减系数 = 355 / 3386 = **0.1048**（即大盘降至 10.5%）。「份额倍数」= (W4篇数/W0篇数) ÷ 0.1048，与 per-1k 比值数学等价——它衡量的是**相对抗跌**，不是绝对增长。

| 问题族 | W0 篇 | W4 篇 | 绝对变化 | W0 份额 | W4 份额 | 份额倍数（相对抗跌） | 判定 |
|---|---|---|---|---|---|---|---|
| `windows-reveal` | 6 | 13 | 2.17× | 1.8 | 36.6 | 20.67× | 🔺 绝对增长 |
| `fork-inbox` | 11 | 17 | 1.55× | 3.2 | 47.9 | 14.74× | 🔺 绝对增长 |
| `session-migration` | 20 | 19 | 0.95× | 5.9 | 53.5 | 9.06× | 📈 相对上升 |
| `composer-ime` | 15 | 9 | 0.60× | 4.4 | 25.4 | 5.72× | 📈 相对上升 |
| `web-startup-perf` | 21 | 11 | 0.52× | 6.2 | 31.0 | 5.00× | 📈 相对上升 |
| `legacy-plugin-load-crash` _(legacy)_ | 19 | 8 | 0.42× | 5.6 | 22.5 | 4.02× | 📈 相对上升 |
| `persona-preset-break` | 20 | 7 | 0.35× | 5.9 | 19.7 | 3.34× | 📈 相对上升 |
| `client-bundle-stale` | 43 | 15 | 0.35× | 12.7 | 42.3 | 3.33× | 📈 相对上升 |
| `reasoning-loop` | 20 | 5 | 0.25× | 5.9 | 14.1 | 2.38× | 📈 相对上升 |
| `session-history-unreadable` | 108 | 22 | 0.20× | 31.9 | 62.0 | 1.94× | ➡️ 横盘 |
| `legacy-context-compaction` _(legacy)_ | 137 | 24 | 0.18× | 40.5 | 67.6 | 1.67× | ➡️ 横盘 |
| `web-process-death` | 77 | 13 | 0.17× | 22.7 | 36.6 | 1.61× | ➡️ 横盘 |
| `npm-install-build` | 101 | 13 | 0.13× | 29.8 | 36.6 | 1.23× | ➡️ 横盘 |
| `sandbox-windows` | 307 | 32 | 0.10× | 90.7 | 90.1 | 0.99× | ➡️ 横盘 |
| `legacy-auth-lan` _(legacy)_ | 463 | 47 | 0.10× | 136.7 | 132.4 | 0.97× | ➡️ 横盘 |
| `malformed-toolcall` | 120 | 10 | 0.08× | 35.4 | 28.2 | 0.79× | 📉 相对消退 |
| `legacy-token-auth-pwa` _(legacy)_ | 234 | 19 | 0.08× | 69.1 | 53.5 | 0.77× | 📉 相对消退 |
| `legacy-sandbox-escalation` _(legacy)_ | 30 | 2 | 0.07× | 8.9 | 5.6 | 0.64× | 📉 相对消退 |
| `tool-visibility` | 34 | 2 | 0.06× | 10.0 | 5.6 | 0.56× | 📉 相对消退 |
| `legacy-session-corruption` _(legacy)_ | 55 | 1 | 0.02× | 16.2 | 2.8 | 0.17× | ⬇️ 显著消退 |

> **关键读数**：20 个族中，只有 **2 个**在绝对篇数上真正增长（`windows-reveal` 6→13、`fork-inbox` 11→17）。其余「份额上升」的族**绝对篇数全部下降**，只是降得比大盘慢。仅凭份额把 `composer-ime`、`web-startup-perf` 说成「爆发」是错误解读。

---

## 四、趋势解读

### 4.1 三代问题的接力（核心结论）

| 世代 | 时间窗 | 主导问题族 | 特征 |
|---|---|---|---|
| **第一代** | W0–W1 | `legacy-session-corruption` (55→21 篇) · `legacy-sandbox-escalation` · `malformed-toolcall` | 0.1.1–0.1.2 期：会话日志损坏（seq gap / 并发写）、同模式提权被拒、畸形 tool-call |
| **第二代** | W2–W3 | `legacy-context-compaction` · `npm-install-build` · `session-migration` 抬头 | 0.1.2–0.1.3 期：压缩失效、安装/构建失败、迁移校验开始收紧 |
| **第三代** | W4 | `session-history-unreadable` (22 篇) · `session-migration` (19) · `fork-inbox` (17) · `windows-reveal` (13) | 0.1.5-rc 期：**格式迁移链 + 分叉语义 + Windows UI** 三线并起 |

**接力关系**：第一代的「会话日志损坏」绝对篇数从 55 降到 1，降速**远快于大盘**（份额 0.17×）。但**问题并未解决——它换了形态**：从「写入期损坏」转为「读取期拒载」，即 `session-migration` 与 `session-history-unreadable`。用户感受相同（历史会话打不开），根因位置完全不同。

> 值得注意：`session-migration` 在 W0→W3 的份额是**单调上升**的（5.9 → 7.5 → 14.3 → 24.7），这条上升线比单点对比更能说明它是持续积累的结构性问题，而非一次性波动。

### 4.2 绝对增长族（唯一两个真正变多的）

- **`windows-reveal`** — Windows 资源管理器定位失败：绝对 6 → 13 篇（2.17×），份额 1.8 → 36.6
- **`fork-inbox`** — Fork 继承父会话队列：绝对 11 → 17 篇（1.55×），份额 3.2 → 47.9

这两族是全部 20 族中**唯一在大盘衰减 90% 的背景下仍然净增**的问题类型，因此是本期最值得优先处置的对象：`windows-reveal`（Windows「在资源管理器中显示」静默失败）与 `fork-inbox`（分叉会话继承父会话排队输入）。

### 4.3 相对上升族（份额上升但绝对下降）

这些族绝对篇数在下降，但**降速显著慢于大盘**，说明它们正在取代旧问题成为社区注意力焦点：

- **`session-migration`** — 会话格式迁移失败：绝对 20 → 19 篇（0.95×，大盘 0.10×），份额 9.06×
- **`composer-ime`** — Composer 输入法/翻译干扰：绝对 15 → 9 篇（0.60×，大盘 0.10×），份额 5.72×
- **`web-startup-perf`** — dsh web 启动性能退化：绝对 21 → 11 篇（0.52×，大盘 0.10×），份额 5.00×
- **`legacy-plugin-load-crash`** — 插件加载失败拖垮启动：绝对 19 → 8 篇（0.42×，大盘 0.10×），份额 4.02×
- **`persona-preset-break`** — persona/preset 字段重命名破坏：绝对 20 → 7 篇（0.35×，大盘 0.10×），份额 3.34×
- **`client-bundle-stale`** — client bundle 陈旧失效：绝对 43 → 15 篇（0.35×，大盘 0.10×），份额 3.33×
- **`reasoning-loop`** — 推理退化循环 / 空响应：绝对 20 → 5 篇（0.25×，大盘 0.10×），份额 2.38×

### 4.4 消退族

- **`malformed-toolcall`** — 畸形 tool-call 致会话不可恢复：绝对 120 → 10 篇，份额 0.79×（**快于大盘**）
- **`legacy-token-auth-pwa`** — PWA / 移动端 / 主题：绝对 234 → 19 篇，份额 0.77×（**快于大盘**）
- **`legacy-sandbox-escalation`** — 沙箱同模式提权被拒：绝对 30 → 2 篇，份额 0.64×（**快于大盘**）
- **`tool-visibility`** — 工具/提示词节丢失：绝对 34 → 2 篇，份额 0.56×（**快于大盘**）
- **`legacy-session-corruption`** — 会话日志损坏（seq gap / 并发写）：绝对 55 → 1 篇，份额 0.17×（**快于大盘**）

### 4.5 长期横盘族（真正的「老赖」）

以下族横跨整个观察窗且 per-1k 率稳定在高位，说明**始终未被解决**，不随版本更迭消失：

- **`legacy-context-compaction`** — 上下文压缩失效：周均份额 **62.6/千**，绝对 137 → 24 篇，份额 1.67×
- **`web-process-death`** — dsh web 进程静默死亡：周均份额 **28.7/千**，绝对 77 → 13 篇，份额 1.61×
- **`npm-install-build`** — npm 安装/构建失败：周均份额 **36.4/千**，绝对 101 → 13 篇，份额 1.23×
- **`sandbox-windows`** — Windows 沙箱/TLS/代理：周均份额 **79.6/千**，绝对 307 → 32 篇，份额 0.99×
- **`legacy-auth-lan`** — Web 鉴权 / 局域网访问：周均份额 **152.2/千**，绝对 463 → 47 篇，份额 0.97×

> `sandbox-windows` 与 `legacy-auth-lan` 的 per-1k 率全程居首且几乎不降——这两类（Windows 沙箱/TLS/代理、Web 鉴权与局域网访问）是**结构性痛点**，属于产品边界问题而非某版本引入的回归。

---

## 五、按版本归因的趋势

| 版本 | 提及次数 | 关联爆发族 |
|---|---|---|
| `0.1.5-rc.1` | 35 | `session-migration` · `session-history-unreadable` · `fork-inbox` · `client-bundle-stale` · `persona-preset-break` |
| `0.1.2-rc.1` | 34 | `legacy-sandbox-escalation` · `legacy-plugin-load-crash` |
| `0.1.1-rc.2` | 33 | — |
| `0.1.0-rc.6` | 16 | — |
| `0.1.2-alpha.1` | 14 | — |
| `0.1.5-rc.2` | 10 | `session-migration` · `windows-reveal` · `web-startup-perf` |
| `0.1.5` | 9 | — |
| `0.1.0-rc.8` | 9 | — |

---

## 六、复现与维护

```powershell
cd E:\test\rewrite-agently\dsh-docs-deliverables\discussion-issues\_tools

# 1. 重算关键词趋势（读取 6321 篇缓存，产出 trend-data.json）
node trend-analysis.cjs

# 2. 重新渲染本文件（幂等）
node gen-trend-report.cjs

# --- LLM 权威链路 ---

# 3. 全量语义分类（默认按 checkpoint 只处理增量，可中断续跑）
node llm-classify.cjs --concurrency 4

#    查看 checkpoint 边界
node checkpoint.cjs

# 4. 归并模型自创族
node canon-new-families.cjs

# 5. 生成权威趋势报告
node llm-trend-report.cjs
```

**维护约定**：

1. 新增子系统文档后，须同步更新本文件 `_tools/gen-trend-report.cjs` 里的 `SUBSYSTEMS` 常量（本文件由脚本生成，手改会被覆盖）。
2. 问题族规则定义在 `_tools/families.cjs`（单一权威源），被 `trend-analysis.cjs` 与 `llm-trend-report.cjs` 共用。
3. 新增批次后重跑 `trend-analysis.cjs` 与 `llm-classify.cjs`，语料会自动纳入新讨论（LLM 侧按 number 增量续跑）。
4. 若调整分类表，须同步 `llm-classify.cjs` 的 `TAXONOMY` 与 `families.cjs`，并**清空 `llm-classify.jsonl` 重跑**，否则新旧口径混在同一文件里无法区分。

---

## 七、口径局限（须与结论一并阅读）

1. **关键词聚类是启发式的**：族归属基于正则 OR 匹配，交叉召回无法完全消除（如 `fork-inbox` 帖常同时命中 `session-projection`）。各族规模应作为**相对趋势**读，不可当作精确计数。
2. **W4 样本仅 3 天**：per-1k 率的分母小，单篇帖对率值影响约 2.8/千。W4 的「爆发」判定已结合绝对篇数复核，但仍需下一批次数据确认。
3. **发帖量 ≠ 缺陷量**：社区发帖受发布节奏、讨论热度与用户基数影响。趋势反映的是**用户感知与讨论强度**的变化，不等价于代码缺陷密度。
4. **W0 的开版噪音**：首周含大量非问题类帖（许愿、打卡、展示）。因 per-1k 归一化按周总量计算，首周噪音会**系统性压低**所有族在 W0 的率值，使后续周的增长倍数偏乐观。跨族比较（谁比谁高）比跨周倍数（涨了几倍）更可靠。
