# DeepSeek Harness 讨论区全量分析报告

> 生成时间：2026-09-08 01:31　|　数据源：5779 篇 GitHub Discussions 结构化缓存

本报告覆盖四个分析目标：**插件生态归类**、**问题归因跟踪**、**#5880 专题与 drscrewdriver 评价**、**类 #5880 高充实讨论发现**。

---

## 一、插件展示类讨论：过滤 → 归类 → 仓库定位 → 三档分级

### 1.1 过滤（先过滤再分析）

从 5779 篇讨论中按 category 过滤出插件展示类 **1293 篇**，再用局域网 LLM（Qwen3.6-35B-A3B，keyfree，温度 0.1）逐篇判定真实性与插件归属：

| 类别 | 数量 | 说明 |
|---|---|---|
| ✅ 真实插件展示 (real) | **1127** | 人类开发者撰写：功能/用法/安装/个人体验 |
| ⚙️ 自动生成 (auto_gen) | 68 | 模板化 `DSH | xxx | desc` 标题、注册表条目生成 |
| 🗑️ 低质量 (low_quality) | 46 | 标题党、正文 <50 字、无实质内容 |

### 1.2 插件功能归类（1127 篇真实展示）

| 功能类 | 数量 | 典型插件 |
|---|---|---|
| 🛠️ tool 工具 | 616 | dsh-github、dsh-file-undo、dsh-lsp-actions |
| 🎨 ux 体验 | 211 | DeepSeek Harness Desktop、dsh-ui-appearance、dsh-composer-history |
| 🤖 agent 智能体 | 104 | dsh-agent-memory、TaskSwarm、dsh-specify-subagent-suite |
| 🔁 workflow 流程 | 97 | dsh-devflow、dsh-batch-pipeline、dsh-polling |
| 🔐 security 安全 | 76 | dsh-permission-rules、dsh-skill-pack-security、mcpguard |
| 📦 other 其他 | 23 | mydsh.dev、dsh-usage |

共识别 **994 个唯一插件名**（详见 `unique-plugins-list.txt`）。高频插件：DeepSeek Harness Desktop(6帖)、DeepSeek Phone Harness(6帖)、dsh-agent-memory(4帖)、dsh-file-undo(4帖)。

### 1.3 仓库定位与去重

从 1127 篇正文/标题提取 GitHub 仓库链接：**366 个唯一仓库** → 清洗噪声（fork 镜像、awesome 列表本体、正文提及的无关大项目）后得 **328 个真实插件仓库**。

| 清洗项 | 数量 | 示例 |
|---|---|---|
| 官方仓库 fork/镜像 | 19 | CHENHUI-X/deepseek-harness 等 |
| awesome 列表仓库本体 | 4 | 0xsline/awesome-deepseek-harness |
| 正文提及的无关项目 | 6 | earendil-works/pi ⭐10万、agentmemory ⭐2.8万 |
| 失效/更名 404 | 5 | LBurny/deepseek-harness-desktop |

### 1.4 dsh-plugin tag 核查

通过 GitHub GraphQL 拉取全部仓库 topics：**275 个**打了 `dsh-plugin`/`dsh`/`dsh-bundle`/`cordis` tag（占 87%），另有 32 个命名含 dsh 但未打 tag，其余为无标记仓库。
dsh-plugin tag 与真实收录高度相关：Tier1 收录仓库中 tag 命中率 96%。

### 1.5 三档归类（核心产出）

| 档位 | 数量 | 判定标准 | 收录组合 |
|---|---|---|---|
| 🟢 **Tier 1 已被收录** | **254** | 被 awesome-dsh-plugin **或** dsh.so 收录 | dsh.so+awesome 双重 113；仅 dsh.so 134；仅 awesome 7 |
| 🟡 **Tier 2 未收录但 star>5** | **23** | 两处均未收录，但 GitHub star > 5 | 收录缺口候选 |
| 🔴 **Tier 3 未收录且 star≤5** | **51** | 两处均未收录，star ≤ 5 | 长尾无人问津 |
| ❌ 失效/噪声 | 14 | 404 或非插件 | — |

#### Tier 1 头部（star ≥ 30）

| 仓库 | ⭐ | tag | 收录源 |
|---|---|---|---|
| [ysr666/dsh-vision-router](https://github.com/ysr666/dsh-vision-router) | 1084 | ✓ | awesome,dsh.so |
| [sandbaseai/sandbase-harness](https://github.com/sandbaseai/sandbase-harness) | 641 | 名含dsh | awesome,dsh.so |
| [saya-ch/dsh-mobile](https://github.com/saya-ch/dsh-mobile) | 231 | ✓ | awesome,dsh.so |
| [weijiafu14/pi2dsh](https://github.com/weijiafu14/pi2dsh) | 183 | ✓ | dsh.so |
| [toolclub/dsh-agent-team-gui](https://github.com/toolclub/dsh-agent-team-gui) | 170 | ✓ | awesome,dsh.so |
| [liguobao/deepseek-harness-remote](https://github.com/liguobao/deepseek-harness-remote) | 168 | ✓ | awesome,dsh.so |
| [Nwflower/dsh-chat-import](https://github.com/Nwflower/dsh-chat-import) | 139 | ✓ | awesome,dsh.so |
| [Vladimir-Human/humanizer-ru](https://github.com/Vladimir-Human/humanizer-ru) | 123 | ✗ | awesome,dsh.so |
| [PerryLink/dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules) | 113 | ✓ | awesome,dsh.so |
| [qkycir-123/dsh-run2skill](https://github.com/qkycir-123/dsh-run2skill) | 110 | ✓ | awesome,dsh.so |
| [PivotStackIntelligence/dsh-github](https://github.com/PivotStackIntelligence/dsh-github) | 103 | ✓ | dsh.so |
| [PerryLink/dsh-memento](https://github.com/PerryLink/dsh-memento) | 99 | ✓ | awesome,dsh.so |
| [franksong2702/dsh-codex-connect](https://github.com/franksong2702/dsh-codex-connect) | 90 | ✓ | awesome,dsh.so |
| [modusensus/dsh-mneme](https://github.com/modusensus/dsh-mneme) | 87 | ✓ | awesome,dsh.so |
| [Vladimir-Human/ru-marketplace-mcp](https://github.com/Vladimir-Human/ru-marketplace-mcp) | 85 | ✗ | awesome,dsh.so |
| [Noob-stupid/dsh-plugin-hub](https://github.com/Noob-stupid/dsh-plugin-hub) | 79 | ✓ | awesome,dsh.so |
| [PolinniZhong/dsh-omi-voice](https://github.com/PolinniZhong/dsh-omi-voice) | 73 | ✓ | awesome,dsh.so |
| [lamost423/dsh-trace-compare](https://github.com/lamost423/dsh-trace-compare) | 66 | ✓ | dsh.so |
| [PolinniZhong/dsh-personal-center](https://github.com/PolinniZhong/dsh-personal-center) | 62 | ✓ | awesome,dsh.so |
| [Sutera-Diffusus/dsh-whale-musume](https://github.com/Sutera-Diffusus/dsh-whale-musume) | 56 | 名含dsh | awesome,dsh.so |
| [PerryLink/dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel) | 52 | ✓ | awesome,dsh.so |
| [WSL043/dsh-codex-subscription](https://github.com/WSL043/dsh-codex-subscription) | 50 | ✓ | awesome,dsh.so |
| [Ephemeral-AI-Lab/dsh-plugins](https://github.com/Ephemeral-AI-Lab/dsh-plugins) | 48 | ✓ | awesome,dsh.so |
| [pengpengyi92/dsh-quant](https://github.com/pengpengyi92/dsh-quant) | 35 | ✓ | awesome,dsh.so |
| [Blank-not-black/dsh-Remote](https://github.com/Blank-not-black/dsh-Remote) | 33 | ✓ | awesome |
| [HiWhaleW/dsh-toolbox](https://github.com/HiWhaleW/dsh-toolbox) | 30 | ✓ | dsh.so |

#### Tier 2 全部（建议纳入收录名单）

| 仓库 | ⭐ | tag |
|---|---|---|
| [pax-beehive/dsh-hub-cli](https://github.com/pax-beehive/dsh-hub-cli) | 242 | ✓ |
| [GraySilver/dsh-task-modes](https://github.com/GraySilver/dsh-task-modes) | 206 | ✓ |
| [sandbaseai/deepseek-harness-handbook](https://github.com/sandbaseai/deepseek-harness-handbook) | 157 | 名含dsh |
| [WSL043/DSH-Portable](https://github.com/WSL043/DSH-Portable) | 31 | 名含dsh |
| [See-Sol-Lab/DeepSeekGUI](https://github.com/See-Sol-Lab/DeepSeekGUI) | 27 | ✓ |
| [Lxiayu/DshCockpit](https://github.com/Lxiayu/DshCockpit) | 24 | ✓ |
| [sleep2agi/DeepSeek-Harness-Desktop](https://github.com/sleep2agi/DeepSeek-Harness-Desktop) | 19 | ✓ |
| [pawaca/dsh-edge](https://github.com/pawaca/dsh-edge) | 15 | 名含dsh |
| [FuRongJun-1999/CommonTrustProtocol](https://github.com/FuRongJun-1999/CommonTrustProtocol) | 12 | ✓ |
| [foorgange/DeepSeek-Harness-for-VS-Code](https://github.com/foorgange/DeepSeek-Harness-for-VS-Code) | 11 | ✓ |
| [CHENHUI-X/dsh-client-ui-dashboard](https://github.com/CHENHUI-X/dsh-client-ui-dashboard) | 8 | 名含dsh |
| [AgriciDaniel/deepseek-harness-brain](https://github.com/AgriciDaniel/deepseek-harness-brain) | 7 | ✓ |
| [jo32/DeepDeck](https://github.com/jo32/DeepDeck) | 6 | ✓ |
| [reshuibuduo/TMCRA-Agent-Memory](https://github.com/reshuibuduo/TMCRA-Agent-Memory) | 6 | ✓ |
| [tyche66/DSH-money-view](https://github.com/tyche66/DSH-money-view) | 6 | ✓ |

> 📎 完整清单见 `插件仓库三档归类报告.md`；结构化数据见 `plugin-repo-triage-final.json`、`repo-metadata-cache.json`。

---

## 二、问题类讨论复核与归因跟踪

### 2.1 方法：按子系统家族为组跟踪

沿用 LAN-API 复核的 **7 子系统家族 ID**（非全局扫描），逐篇读取正文提取根因。278 篇家族成员中 **267 篇（96%）为问题帖**——证明讨论家族本质上是 bug 聚集点。

| 子系统 | 家族成员 | 问题帖 | 非问题帖 |
|---|---|---|---|
| filesystem | 69 | 67 | 2 |
| web-server | 61 | 58 | 3 |
| session-projection | 44 | 43 | 1 |
| subagent | 38 | 35 | 3 |
| code-runtime | 34 | 34 | 0 |
| llm-streaming | 29 | 27 | 2 |
| token-meter | 3 | 3 | 0 |

### 2.2 归因要点

| 子系统 | 核心归因（根因聚类） | 判断 |
|---|---|---|
| llm-streaming | `supportsDeveloperRole` 被 compat schema 丢弃 → 推理模型以 developer role 发给只认 system 的 OpenAI 兼容网关 → 400 | **配置面回归**：27帖同一根因，官方未在 settings schema 暴露开关 |
| session-projection | 会话日志并发写损坏 / seq 间隙 / 跨进程竞争 → 会话无法加载 | **架构缺陷**：多进程共享 DSH_HOME 无写锁 |
| web-server | npm 依赖解析死循环、内存泄漏 OOM、IME 中文输入乱码 | 多根因混杂：依赖图+前端 |
| filesystem | exFAT inode 校验失败、Windows 路径含 0x00 截断、文件夹选择器崩溃 | **平台适配缺陷**（Windows/exFAT 为主）|
| subagent | 子代理继承过期 base 模型、dispose 不传播致孤儿进程、空 tool call id 永久卡死 | **生命周期契约缺失**（production-constant）|
| code-runtime | os.kill(pid,0) 广播 Ctrl+C 拖垮 Host、bash ! 历史扩展误展开 | **进程信号/Shell 语义**回归 |
| token-meter | usage 映射把 cache hit/miss 误分类 | **计量偏差** |

### 2.3 关键判断：是提交(commit)引入的改动吗？

从归因文本看，问题帖普遍**不是由单一提交引入的回归**，而是三类成因：

1. **配置面长期缺口**（llm-streaming 27帖 / filesystem exFAT / token-meter）—— 功能从一开始就不完整，无历史回归点，属『从未修复』而非『被改坏』；
2. **架构契约缺失**（session-projection 并发写 / subagent dispose / code-runtime 信号）—— 属于设计期未定义 lifecycle/session 契约，代码一直按缺陷演进；
3. **平台差异回归**（web-server / filesystem Windows 特例）—— 部分有修复分支（如 #4662 跨进程写锁、#4713 复现矩阵定位），可对照 commit 验证是否已合入。

> 📎 逐篇根因提取：`family-attribution-summary.md`（含每篇问题的 root cause 段）；结构化：`family-attribution.json`。

---

## 三、专题：#5880 深度分析 & drscrewdriver 插件评价

### 3.1 讨论 #5880 是什么

**标题**：I spent 20 hours installing every plugin in the DeepSeek Harness registry — 93.9% installed cleanly, only 48.6% actually ran

**作者**：dsh.so 站长（独立索引/验证 DSH 插件的站点）。在 dsh-v0.1.3-alpha.1 发布后，花 20 小时将自建索引里的插件逐个在沙箱安装并尝试运行，跨 3 个 dsh 版本、L1→L5 五级验证阶梯（metadata → 沙箱安装 → web 启动 → HTTP → 插件清单）。

### 3.2 核心数据

| 信号 | 数量 | 占比 | 解读 |
|---|---|---|---|
| 注册表插件总数 | 13,325 | — | dsh.so 索引规模 |
| L4 安装干净通过 | 12,568 | 94.3% | 绝大多数能装 |
| L5 真正作为插件运行 | 6,448 | 48.6% | **不到一半真能跑** |
| 从未达到运行验证 | 6,755 | — | 其中 3,009 版本窗口/缺安装命令/环境不符；3,746 从不声明 `dsh.bundle`，被当作普通依赖安装、从不挂载为插件 |

**一句话结论**：『Installing is not the same as running.』——验证层（L5=沙箱安装+web 启动+HTTP 响应+插件清单激活四步全过）才是可信标准。

**方法论 caveats**（作者自述，体现严谨性）：每次新 dsh 版本发布后 verified 计数回落再爬升（版本作用域的记账行为，非插件退化）；3,009 条失败多数『非坏插件』。

### 3.3 drscrewdriver 插件项目评价

drscrewdriver 是活跃的 DSH 社区插件开发者，其在 #5008（developer-role 400 bug）中被社区用户**作为 workaround 推荐**。对 4 个仓库逐一核验（GraphQL 元数据 + dsh.so 收录探测）：

| 仓库 | ⭐ | dsh-plugin tag | dsh.so 收录 | 用途 | 社区引用 |
|---|---|---|---|---|---|
| [dsh-input-traffic](https://github.com/drscrewdriver/dsh-input-traffic) | 4 | ✓ (dsh/dsh-plugin/dsh-bundle) | ✅ | Web GUI 忙时输入队列：三层(now/next/later)规划、拖拽重排、并发保护、interject/interrupt、会话冻结 | 有独立中文技术博客介绍 |
| [dsh-thinking-levels](https://github.com/drscrewdriver/dsh-thinking-levels) | 6 | ✓ | ✅ | reasoning 强度档位调整 | **#5008 workaround 之一** |
| [dsh-session-search-toggle](https://github.com/drscrewdriver/dsh-session-search-toggle) | 3 | ✓ | ✅ | 侧边栏会话内容检索（标题/内容切换、按用户/回复/工具筛选）| — |
| [dsh-llm-openai-completions](https://github.com/drscrewdriver/dsh-llm-openai-completions) | 1 | ✓ | ❌ (404) | 配 dsh-thinking-levels 绕开 developer role | **#5008 配套推荐** |

**评价结论**：
- ✅ **质量信号**：4 仓库全部规范打 `dsh-plugin`/`dsh-plugin-market`/`dsh-bundle` tag，符合插件市场收录规范；3/4 已被 dsh.so 收录（dsh-llm-openai-completions 尚缺）；
- ✅ **社区认可**：dsh-thinking-levels + dsh-llm-openai-completions 组合被 #5008 作者当作解决 pi-ai developer-role 400 问题的现成 workaround 推荐（该问题正是 llm-streaming 家族 27 帖的根因），说明其插件填补了官方配置缺口；
- ⚠️ **规模与 star**：均属 1-6 star 的小型个人插件（与 #5880 报告中『大量插件安装容易但使用量低』的长尾特征一致），dsh-input-traffic 有独立博客背书但暂无讨论区专门好评帖。

> 📎 关联讨论 #5008：https://github.com/deepseek-ai/deepseek-harness/discussions/5008

---

## 四、类 #5880 的高充实讨论发现

### 4.1 筛选方法

以 #5880 为基准（20h 手工调查 + 数据表 + 统计 + 原创分析），先本地启发式筛选（正文 >500 字、含表格/代码块、评论 ≥5、统计量密度），再用局域网 LLM 复核定级。

### 4.2 结果：14 篇 high + 32 篇 medium

| # | 讨论 | 字数 | 评论 | 类别 | 高充实理由 |
|---|---|---|---|---|---|
| 1. **#2714** | RFC: dsh 社区插件互操作标准 v0.15 | 19583 | 6 | Ideas | 原创 RFC，字段表格+版本迭代+社区反馈 |
| 2. **#5286** | 确定性执行边界是否应成为一等 Harness 能力 | 16010 | 9 | Ideas | 官方报告+自身实验深度对比 |
| 3. **#3192** | CHA2A 智能体生态身份与来源认证规范 | 11810 | 21 | Ideas | 四层标识×分层签名原创架构 |
| 4. **#5397** | dsh 0.1.2 alpha 阶段官方改动与第三方插件影响 | 5293 | 8 | General | Git 历史数据时间线表+插件影响分析 |
| 5. **#2884** | RFC: Agent as 24×7 Background Service | 10190 | 10 | Ideas | 24×7 后台服务架构提案 |
| 6. **#4909** | Lifecycle handoff 契约缺失(孤儿子代理) | 6125 | 6 | General | 架构契约缺失+社区收敛证据 |
| 7. **#2454** | task-conditioned Harness evolution with Plugin Packs | 19334 | 22 | Ideas | 可评估 Plugin Packs 演化 RFC |
| 8. **#5182** | 一条空 id 的 tool call 会让会话永久不可用 | 18520 | 7 | General | 空 id tool call 根因链追踪 |
| 9. **#4311** | 子代理默认委派失败根因 | 13238 | 5 | General | 模型继承错误根因(快照定格/全局污染) |
| 10. **#4910** | 持久化格式零迁移路径 | 7193 | 7 | General | 格式迁移路径架构分析 |
| 11. **#4662** | 会话日志并发写损坏修复 | 2897 | 5 | General | 完整修复分支+原理 |
| 12. **#4713** | os.kill 广播 Ctrl+C 致 Host 退出 | 2423 | 5 | General | 复现矩阵+证据链修正归因 |
| 13. **#5046** | persistent bash 误展开 ! (历史扩展) | 11863 | 5 | General | bash 历史扩展机制深挖 |
| 14. **#4793** | Agent dispose 不传播到子 agent | 5985 | 5 | General | dispose 契约缺失+复现证据 |

> 📎 全量见 `content-rich-like-5880.md`；medium 档见 `content-medium.md`。

---

## 附：产出文件索引

| 文件 | 内容 |
|---|---|
| `插件仓库三档归类报告.md` | 目标1：三档完整清单(含链接) |
| `plugin-repo-triage-final.json` | 目标1：三档结构化数据 |
| `plugin-classified-all.json` | 1293 篇插件讨论逐篇判定 |
| `unique-plugins-list.txt` | 994 唯一插件名及关联讨论 |
| `family-attribution-summary.md` | 目标2：逐子系统问题归因(每篇含 root cause) |
| `family-attribution.json` | 目标2：归因结构化数据 |
| `content-rich-like-5880.md` / `.json` | 目标4：14 篇 high 充实讨论 |
| `content-medium.md` | 目标4：32 篇 medium |
| `awesome-lists-raw.json` / `dshso-probe-result.json` | 收录源原始数据 |
| `repo-metadata-cache.json` | 328 仓库 star/topics/收录源 |