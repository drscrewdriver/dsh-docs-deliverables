#!/usr/bin/env node
/**
 * Render discussion-issues/README.md — the subsystem index + bug-trend summary.
 *
 * Input : <OUT_DIR>/trend-data.json   (produced by trend-analysis.cjs)
 * Output: <ISSUES_DIR>/README.md      (ISSUES_DIR = discussion-issues/)
 *
 * Idempotent: fully regenerates the file from trend-data.json + the static
 * narrative below.
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = __dirname;                                   // discussion-issues/_tools
const ISSUES_DIR = path.resolve(__dirname, '..');            // discussion-issues
const OUT_BASE = path.resolve(__dirname, '..', '..');        // dsh-docs-deliverables

const T = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'trend-data.json'), 'utf-8'));

// Static subsystem index — update when a subsystem doc is added/removed.
const SUBSYSTEMS = [
  ['session-migration', '会话格式迁移失败 v0→v1→v2→v3', '整份拒载语义：一条不合规历史记录即拒绝整份日志', '2026-09-12'],
  ['session-fork', 'Fork 继承父会话 pending inbox', 'fork seed 切割把已入队未执行的消息带进子会话', '2026-09-12'],
  ['session-projection', '长会话加载失败 / 投影缓存', '会话读取路径的拒载点与投影缓存增长', '基线'],
  ['subagent', '子代理模型继承', '子代理继承父代理创建时的模型选择', '基线'],
  ['llm-streaming', 'Developer role 不兼容', 'pi-ai 发 role:developer，第三方网关静默丢弃', '基线'],
  ['code-runtime', '沙箱 / 工具调用运行时', '提权语义、工具调用参数、picker 工作器', '基线'],
  ['filesystem', '文件系统 / Windows 路径', '中文路径截断、盘符、reveal 定位失败', '基线'],
  ['web-server', 'Web 服务 / 鉴权 / 局域网', '一次性 token、绑定 0.0.0.0、bundle 陈旧', '基线'],
  ['token-meter', 'Token 计量 / 上下文压缩', 'TokenMeter O(n²)、压缩失效', '基线'],
];

function pct(ratio) {
  if (!isFinite(ratio)) return 'NEW';
  return `${ratio.toFixed(2)}×`;
}

function main() {
  const wk = T.weekKeys;
  const totals = wk.map(w => T.weekTotals[w]);
  const labels = wk.map(w => T.weekLabels[w]);

  // per-1k rate per family per week
  const rate = (famId, w) => {
    const f = T.famTrend[famId];
    return f.weeks[w] / T.weekTotals[w] * 1000;
  };
  const raw = (famId, w) => T.famTrend[famId].weeks[w];

  const newIds = Object.keys(T.cmp);
  const legacyIds = Object.keys(T.legacyCmp);

  // Sort by W0 -> W4 growth
  const sorted = [...newIds, ...legacyIds].sort(
    (a, b) => (rate(b, wk[wk.length - 1]) / (rate(b, wk[0]) || 0.01)) - (rate(a, wk[wk.length - 1]) / (rate(a, wk[0]) || 0.01))
  );

  const L = [];
  L.push('# Discussion → 子系统故障排查索引 & Bug 归因');
  L.push('');

  // ---- superseded banner: quantify the regex drift from the LLM ground truth ----
  let drift = null;
  const JSONL = path.join(OUT_DIR, 'llm-classify.jsonl');
  if (fs.existsSync(JSONL)) {
    const { matchFamilies, docText } = require('./families.cjs');
    const RAW = 'E:/test/rewrite-agently/dsh-disscu-cache/raw';
    let agree = 0, missed = 0, extra = 0, n = 0;
    for (const line of fs.readFileSync(JSONL, 'utf-8').split('\n')) {
      if (!line.trim()) continue;
      let o; try { o = JSON.parse(line); } catch (e) { continue; }
      let d; try { d = JSON.parse(fs.readFileSync(path.join(RAW, `${o.number}.json`), 'utf-8')); } catch (e) { continue; }
      const rf = matchFamilies(docText(d));
      n++;
      if (rf.length === 1 && rf[0] === o.primary) agree++;
      if (rf.length === 0 && o.primary !== 'other') missed++;
      if (rf.length > 0 && o.primary === 'other') extra++;
    }
    if (n) drift = { n, agree, missed, extra };
  }

  L.push('> ⚠️ **本文件中的「关键词趋势」已被 LLM 语义分类取代，仅保留作为方法对照。**');
  L.push('> **权威结论请看 [`趋势报告-LLM.md`](./趋势报告-LLM.md)**（Qwen3.6-35B-A3B 对全部 6321 篇逐帖分类，互斥口径）。');
  if (drift) {
    L.push('>');
    L.push(`> 在同一 ${drift.n} 篇语料上实测，关键词法相对模型判定：`);
    L.push(`> **误报** ${drift.extra} 篇（${(drift.extra / drift.n * 100).toFixed(1)}%，被关键词判为问题但实为非问题）、`);
    L.push(`> **漏检** ${drift.missed} 篇（${(drift.missed / drift.n * 100).toFixed(1)}%）、`);
    L.push(`> **单族命中且与模型主族一致**仅 ${drift.agree} 篇（${(drift.agree / drift.n * 100).toFixed(1)}%）。`);
    L.push('>');
    L.push('> 因此**下面的数字不要用于决策**，尤其是绝对值与跨族比较。');
  }
  L.push('');
  L.push('> 本目录按**子系统**分解社区讨论中的故障排查知识。每个子目录下的 `discussion-issues.md` 遵循统一骨架：');
  L.push('> **症状 → 根因 → 临时方案 → 修复状态 → 官方文档参考 → Problem Types by Discussion Family**。');
  L.push('');
  L.push(`> 趋势数据生成时间：${T.generatedAt.slice(0, 19)}Z　|　语料：${T.totalDiscussions} 篇（#13–#6442）`);
  L.push('> 趋势原始数据：`_tools/trend-data.json`　|　复现脚本：`_tools/trend-analysis.cjs`');
  L.push('');
  L.push('**工具链**：');
  L.push('');
  L.push('| 脚本 | 作用 | 产出 |');
  L.push('|---|---|---|');
  L.push('| `checkpoint.cjs` | **读取 checkpoint 边界（避免重复劳动）** | — |');
  L.push('| `families.cjs` | 关键词族规则（单一权威源） | — |');
  L.push('| `trend-analysis.cjs` | 关键词法全量趋势 | `trend-data.json` |');
  L.push('| `gen-trend-report.cjs` | 渲染本文件（幂等） | 本文件 |');
  L.push('| `llm-classify.cjs` | **LLM 语义分类（默认按 checkpoint 只处理增量）** | `llm-classify.jsonl` |');
  L.push('| `canon-new-families.cjs` | 模型自创族的语义归并 | `new-family-canonical.json` |');
  L.push('| `llm-trend-report.cjs` | 渲染 LLM 权威趋势报告（幂等） | `趋势报告-LLM.md` |');
  L.push('| `probe-throughput.cjs` | 端点并发吞吐标定 | — |');
  L.push('');
  L.push('**增量优先（避免重复劳动）**：`llm-classify.cjs` 默认 `--since auto`，从最新 checkpoint 的 `ID-LIST.txt` 推导边界，**只处理上一 checkpoint 之后的新讨论**。实测对照：全量 6321 篇耗时 61.5 分钟，而单批次增量通常仅数百篇。');
  L.push('');
  L.push('| 调用 | 行为 |');
  L.push('|---|---|');
  L.push('| `node llm-classify.cjs` | 默认：按 checkpoint 边界 + 结果文件去重，只跑增量 |');
  L.push('| `node llm-classify.cjs --since 6442` | 显式指定边界 |');
  L.push('| `node llm-classify.cjs --since all` | 强制全量（**须同时删除 `llm-classify.jsonl`**，否则旧结果仍会被跳过） |');
  L.push('');
  L.push('> **例外**：`trend-analysis.cjs` **不做** checkpoint 门控——趋势分析需要完整历史语料才能对比「基线 vs 增量」，裁剪反而会破坏结论。昂贵的 LLM 环节才需要门控。');
  L.push('');
  L.push('---');
  L.push('');
  L.push('## 一、子系统索引');
  L.push('');
  L.push('| 子系统 | 主题 | 核心根因摘要 | 引入批次 |');
  L.push('|---|---|---|---|');
  for (const [dir, topic, root, batch] of SUBSYSTEMS) {
    const p = path.join(ISSUES_DIR, dir, 'discussion-issues.md');
    const exists = fs.existsSync(p);
    L.push(`| ${exists ? `[\`${dir}/ \`](./${dir}/discussion-issues.md)` : `\`${dir}/\``} | ${topic} | ${root} | ${batch} |`);
  }
  L.push('');
  L.push('> 另有 7 个既有子系统文档（`code-runtime` / `filesystem` / `llm-streaming` / `session-projection` / `subagent` / `token-meter` / `web-server`）在 2026-09-12 追加了 `## 增量补充 — #5886–#6442` 段落。');
  L.push('');
  L.push('---');
  L.push('');
  L.push('## 二、趋势口径');
  L.push('');
  L.push('**语料是一个剧烈衰减的序列**：社区开版首周涌入 3386 篇，到 W4 只剩 355 篇（降至 10.5%）。这意味着：');
  L.push('');
  L.push('- 直接比绝对篇数 → 会把「大盘整体退潮」误读成「每类问题都在好转」；');
  L.push('- 只看份额（per-1k）→ 会把「衰减得比大盘慢」误读成「问题爆发」。');
  L.push('');
  L.push('**因此本报告双口径并列**，并对每一族同时给出绝对篇数与份额，判定以**绝对变化**优先：');
  L.push('');
  L.push('| 口径 | 定义 | 回答的问题 | 盲区 |');
  L.push('|---|---|---|---|');
  L.push('| **绝对篇数** | 该族当周实际帖数 | 问题绝对量是增是减 | 被大盘退潮掩盖 |');
  L.push('| **份额** | 该族篇数 ÷ 当周总篇数 × 1000 | 社区注意力是否转向 | 无法证明绝对量增长 |');
  L.push('| **份额倍数** | 族衰减率 ÷ 大盘衰减率 | 相对大盘是强是弱 | 同样不等于绝对增长 |');
  L.push('');
  L.push('| 周 | 日期区间 | 篇数 | 相对 W0 |');
  L.push('|---|---|---|---|');
  const d0 = totals[0];
  wk.forEach((w, i) => L.push(`| W${w} | ${labels[i]} | ${totals[i]} | ${(totals[i] / d0 * 100).toFixed(1)}% |`));
  L.push('');
  L.push('> **注意**：W4（09-10~09-16）仅含 09-10 至 09-12 三天数据，样本最小（355 篇），单篇帖即可影响份额约 2.8/千。W4 的高份额项须结合绝对篇数复核。');
  L.push('');
  L.push('---');
  L.push('');
  L.push('## 三、趋势总表（双口径：绝对篇数 + 份额）');
  L.push('');
  L.push('**必须先看这一条**：语料总量本身在剧烈衰减——W0 有 3386 篇，W4 只有 355 篇（**降至 10.5%**）。因此「份额上升」不等于「问题变多」：一个族只要**衰减得比大盘慢**，份额就会上升。');
  L.push('');
  L.push('| 口径 | 含义 | 能回答 | 不能回答 |');
  L.push('|---|---|---|---|');
  L.push('| **绝对篇数** | 该族当周实际帖数 | 问题绝对量是否增长 | 受大盘衰减干扰 |');
  L.push('| **份额 (per-1k)** | 该族占当周总量比例 | 社区注意力是否转向该族 | 不能证明绝对量增长 |');
  L.push('| **相对存活** = 族衰减率 ÷ 大盘衰减率 | 该族抗跌程度 | 相对大盘是强是弱 | 不等于绝对增长 |');
  L.push('');
  const decay = totals[totals.length - 1] / totals[0];
  L.push(`> 本期大盘衰减系数 = ${totals[totals.length - 1]} / ${totals[0]} = **${decay.toFixed(4)}**（即大盘降至 10.5%）。「份额倍数」= (W4篇数/W0篇数) ÷ ${decay.toFixed(4)}，与 per-1k 比值数学等价——它衡量的是**相对抗跌**，不是绝对增长。`);
  L.push('');
  L.push(`| 问题族 | W0 篇 | W4 篇 | 绝对变化 | W0 份额 | W4 份额 | 份额倍数（相对抗跌） | 判定 |`);
  L.push(`|---|---|---|---|---|---|---|---|`);
  for (const id of sorted) {
    const r0 = raw(id, 0), r4 = raw(id, wk[wk.length - 1]);
    const abs = r0 > 0 ? r4 / r0 : (r4 > 0 ? Infinity : 0);
    const rate0 = rate(id, 0), rate4 = rate(id, wk[wk.length - 1]);
    const shareRatio = rate4 / (rate0 || 0.01);
    let verdict;
    if (abs >= 1.2) verdict = '🔺 绝对增长';
    else if (shareRatio >= 2) verdict = '📈 相对上升';
    else if (shareRatio >= 0.8) verdict = '➡️ 横盘';
    else if (shareRatio >= 0.4) verdict = '📉 相对消退';
    else verdict = '⬇️ 显著消退';
    const absStr = abs === Infinity ? '新增' : `${abs.toFixed(2)}×`;
    L.push(`| \`${id}\`${T.famTrend[id].legacy ? ' _(legacy)_' : ''} | ${r0} | ${r4} | ${absStr} | ${rate0.toFixed(1)} | ${rate4.toFixed(1)} | ${pct(shareRatio)} | ${verdict} |`);
  }
  L.push('');
  L.push('> **关键读数**：20 个族中，只有 **2 个**在绝对篇数上真正增长（`windows-reveal` 6→13、`fork-inbox` 11→17）。其余「份额上升」的族**绝对篇数全部下降**，只是降得比大盘慢。仅凭份额把 `composer-ime`、`web-startup-perf` 说成「爆发」是错误解读。');
  L.push('');
  L.push('---');
  L.push('');
  L.push('## 四、趋势解读');
  L.push('');
  L.push('### 4.1 三代问题的接力（核心结论）');
  L.push('');
  L.push('| 世代 | 时间窗 | 主导问题族 | 特征 |');
  L.push('|---|---|---|---|');
  L.push(`| **第一代** | W0–W1 | \`legacy-session-corruption\` (${raw('legacy-session-corruption', 0)}→${raw('legacy-session-corruption', 1)} 篇) · \`legacy-sandbox-escalation\` · \`malformed-toolcall\` | 0.1.1–0.1.2 期：会话日志损坏（seq gap / 并发写）、同模式提权被拒、畸形 tool-call |`);
  L.push(`| **第二代** | W2–W3 | \`legacy-context-compaction\` · \`npm-install-build\` · \`session-migration\` 抬头 | 0.1.2–0.1.3 期：压缩失效、安装/构建失败、迁移校验开始收紧 |`);
  L.push(`| **第三代** | W4 | \`session-history-unreadable\` (${raw('session-history-unreadable', 4)} 篇) · \`session-migration\` (${raw('session-migration', 4)}) · \`fork-inbox\` (${raw('fork-inbox', 4)}) · \`windows-reveal\` (${raw('windows-reveal', 4)}) | 0.1.5-rc 期：**格式迁移链 + 分叉语义 + Windows UI** 三线并起 |`);
  L.push('');
  L.push('**接力关系**：第一代的「会话日志损坏」绝对篇数从 ' + raw('legacy-session-corruption', 0) + ' 降到 ' + raw('legacy-session-corruption', wk[wk.length - 1]) + '，降速**远快于大盘**（份额 ' + pct(rate('legacy-session-corruption', wk[wk.length - 1]) / rate('legacy-session-corruption', 0)) + '）。但**问题并未解决——它换了形态**：从「写入期损坏」转为「读取期拒载」，即 `session-migration` 与 `session-history-unreadable`。用户感受相同（历史会话打不开），根因位置完全不同。');
  L.push('');
  L.push('> 值得注意：`session-migration` 在 W0→W3 的份额是**单调上升**的（' + wk.slice(0, 4).map(w => rate('session-migration', w).toFixed(1)).join(' → ') + '），这条上升线比单点对比更能说明它是持续积累的结构性问题，而非一次性波动。');
  L.push('');
  L.push('### 4.2 绝对增长族（唯一两个真正变多的）');
  L.push('');
  let anyAbs = false;
  for (const id of sorted) {
    const r0 = raw(id, 0), r4 = raw(id, wk[wk.length - 1]);
    const abs = r0 > 0 ? r4 / r0 : Infinity;
    if (abs < 1.2) continue;
    anyAbs = true;
    L.push(`- **\`${id}\`** — ${T.famTrend[id].name}：绝对 ${r0} → ${r4} 篇（${abs === Infinity ? '从 0 起步' : abs.toFixed(2) + '×'}），份额 ${rate(id, 0).toFixed(1)} → ${rate(id, wk[wk.length - 1]).toFixed(1)}`);
  }
  if (!anyAbs) L.push('（无）');
  L.push('');
  L.push('这两族是全部 20 族中**唯一在大盘衰减 90% 的背景下仍然净增**的问题类型，因此是本期最值得优先处置的对象：`windows-reveal`（Windows「在资源管理器中显示」静默失败）与 `fork-inbox`（分叉会话继承父会话排队输入）。');
  L.push('');
  L.push('### 4.3 相对上升族（份额上升但绝对下降）');
  L.push('');
  L.push('这些族绝对篇数在下降，但**降速显著慢于大盘**，说明它们正在取代旧问题成为社区注意力焦点：');
  L.push('');
  for (const id of sorted) {
    const r0 = raw(id, 0), r4 = raw(id, wk[wk.length - 1]);
    const abs = r0 > 0 ? r4 / r0 : Infinity;
    const shareRatio = rate(id, wk[wk.length - 1]) / (rate(id, 0) || 0.01);
    if (abs >= 1.2 || shareRatio < 2) continue;
    L.push(`- **\`${id}\`** — ${T.famTrend[id].name}：绝对 ${r0} → ${r4} 篇（${abs.toFixed(2)}×，大盘 ${decay.toFixed(2)}×），份额 ${pct(shareRatio)}`);
  }
  L.push('');
  L.push('### 4.4 消退族');
  L.push('');
  for (const id of sorted) {
    const shareRatio = rate(id, wk[wk.length - 1]) / (rate(id, 0) || 0.01);
    if (shareRatio >= 0.8) continue;
    const r0 = raw(id, 0), r4 = raw(id, wk[wk.length - 1]);
    L.push(`- **\`${id}\`** — ${T.famTrend[id].name}：绝对 ${r0} → ${r4} 篇，份额 ${pct(shareRatio)}（**快于大盘**）`);
  }
  L.push('');
  L.push('### 4.5 长期横盘族（真正的「老赖」）');
  L.push('');
  L.push('以下族横跨整个观察窗且 per-1k 率稳定在高位，说明**始终未被解决**，不随版本更迭消失：');
  L.push('');
  for (const id of sorted) {
    const g = rate(id, wk[wk.length - 1]) / (rate(id, 0) || 0.01);
    const avg = wk.reduce((s, w) => s + rate(id, w), 0) / wk.length;
    if (g < 0.8 || g >= 1.8 || avg < 25) continue;
    const f = T.famTrend[id];
    L.push(`- **\`${id}\`** — ${f.name}：周均份额 **${avg.toFixed(1)}/千**，绝对 ${raw(id, 0)} → ${raw(id, wk[wk.length - 1])} 篇，份额 ${pct(g)}`);
  }
  L.push('');
  L.push('> `sandbox-windows` 与 `legacy-auth-lan` 的 per-1k 率全程居首且几乎不降——这两类（Windows 沙箱/TLS/代理、Web 鉴权与局域网访问）是**结构性痛点**，属于产品边界问题而非某版本引入的回归。');
  L.push('');
  L.push('---');
  L.push('');
  L.push('## 五、按版本归因的趋势');
  L.push('');
  L.push('| 版本 | 提及次数 | 关联爆发族 |');
  L.push('|---|---|---|');
  const vh = Object.entries(T.versionHistogram).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const VERSION_LINKS = {
    '0.1.5-rc.1': '`session-migration` · `session-history-unreadable` · `fork-inbox` · `client-bundle-stale` · `persona-preset-break`',
    '0.1.5-rc.2': '`session-migration` · `windows-reveal` · `web-startup-perf`',
    '0.1.5-alpha.1': '`session-migration`（v2→v3 首现）· `npm-install-build`',
    '0.1.2-rc.1': '`legacy-sandbox-escalation` · `legacy-plugin-load-crash`',
    '0.1.3-alpha.2': '`npm-install-build`（fs-ext 引入）· `legacy-plugin-load-crash`',
  };
  for (const [v, n] of vh) {
    L.push(`| \`${v}\` | ${n} | ${VERSION_LINKS[v] || '—'} |`);
  }
  L.push('');
  L.push('---');
  L.push('');
  L.push('## 六、复现与维护');
  L.push('');
  L.push('```powershell');
  L.push('cd E:\\test\\rewrite-agently\\dsh-docs-deliverables\\discussion-issues\\_tools');
  L.push('');
  L.push('# 1. 重算关键词趋势（读取 6321 篇缓存，产出 trend-data.json）');
  L.push('node trend-analysis.cjs');
  L.push('');
  L.push('# 2. 重新渲染本文件（幂等）');
  L.push('node gen-trend-report.cjs');
  L.push('');
  L.push('# --- LLM 权威链路 ---');
  L.push('');
  L.push('# 3. 全量语义分类（默认按 checkpoint 只处理增量，可中断续跑）');
  L.push('node llm-classify.cjs --concurrency 4');
  L.push('');
  L.push('#    查看 checkpoint 边界');
  L.push('node checkpoint.cjs');
  L.push('');
  L.push('# 4. 归并模型自创族');
  L.push('node canon-new-families.cjs');
  L.push('');
  L.push('# 5. 生成权威趋势报告');
  L.push('node llm-trend-report.cjs');
  L.push('```');
  L.push('');
  L.push('**维护约定**：');
  L.push('');
  L.push('1. 新增子系统文档后，须同步更新本文件 `_tools/gen-trend-report.cjs` 里的 `SUBSYSTEMS` 常量（本文件由脚本生成，手改会被覆盖）。');
  L.push('2. 问题族规则定义在 `_tools/families.cjs`（单一权威源），被 `trend-analysis.cjs` 与 `llm-trend-report.cjs` 共用。');
  L.push('3. 新增批次后重跑 `trend-analysis.cjs` 与 `llm-classify.cjs`，语料会自动纳入新讨论（LLM 侧按 number 增量续跑）。');
  L.push('4. 若调整分类表，须同步 `llm-classify.cjs` 的 `TAXONOMY` 与 `families.cjs`，并**清空 `llm-classify.jsonl` 重跑**，否则新旧口径混在同一文件里无法区分。');
  L.push('');
  L.push('---');
  L.push('');
  L.push('## 七、口径局限（须与结论一并阅读）');
  L.push('');
  L.push('1. **关键词聚类是启发式的**：族归属基于正则 OR 匹配，交叉召回无法完全消除（如 `fork-inbox` 帖常同时命中 `session-projection`）。各族规模应作为**相对趋势**读，不可当作精确计数。');
  L.push('2. **W4 样本仅 3 天**：per-1k 率的分母小，单篇帖对率值影响约 2.8/千。W4 的「爆发」判定已结合绝对篇数复核，但仍需下一批次数据确认。');
  L.push('3. **发帖量 ≠ 缺陷量**：社区发帖受发布节奏、讨论热度与用户基数影响。趋势反映的是**用户感知与讨论强度**的变化，不等价于代码缺陷密度。');
  L.push('4. **W0 的开版噪音**：首周含大量非问题类帖（许愿、打卡、展示）。因 per-1k 归一化按周总量计算，首周噪音会**系统性压低**所有族在 W0 的率值，使后续周的增长倍数偏乐观。跨族比较（谁比谁高）比跨周倍数（涨了几倍）更可靠。');
  L.push('');

  fs.writeFileSync(path.join(ISSUES_DIR, 'README.md'), L.join('\n'), 'utf-8');
  console.log(`✓ discussion-issues/README.md (${L.length} lines)`);
  console.log(`  corpus: ${T.totalDiscussions} | weeks: ${wk.map((w, i) => `W${w}=${totals[i]}`).join(' ')}`);
  console.log(`  families: ${newIds.length} new + ${legacyIds.length} legacy = ${newIds.length + legacyIds.length}`);
}

main();
