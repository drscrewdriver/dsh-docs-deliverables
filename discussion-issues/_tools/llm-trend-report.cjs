#!/usr/bin/env node
/**
 * Build the LLM-semantic trend report from llm-classify.jsonl.
 *
 * Key methodological gain over the regex pass: the model returns a single
 * `primary` family, which gives MUTUALLY EXCLUSIVE buckets. Shares then sum to
 * 100% and cross-family comparison stops being polluted by overlapping recall.
 *
 * Also quantifies how far the regex pass drifted from the model, per family.
 *
 * Usage: node llm-trend-report.cjs            (works on partial data too)
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = __dirname;
const ISSUES_DIR = path.resolve(__dirname, '..');
const JSONL = path.join(OUT_DIR, 'llm-classify.jsonl');
const RAW_DIR = 'E:/test/rewrite-agently/dsh-disscu-cache/raw';
const { matchFamilies, docText } = require('./families.cjs');

// Corpus size derived from the cache itself, so the report stays honest even if
// the classification run is still in flight.
const TOTAL_CORPUS = fs.readdirSync(RAW_DIR).filter(f => /^\d+\.json$/.test(f)).length;

// Family display names (keep in sync with llm-classify.cjs TAXONOMY)
const NAMES = {
  'session-migration': '会话格式迁移失败',
  'session-history-unreadable': '升级后历史会话无法加载',
  'fork-inbox': 'Fork 继承父会话队列',
  'windows-reveal': 'Windows 资源管理器定位失败',
  'web-startup-perf': 'dsh web 启动性能退化',
  'client-bundle-stale': 'client bundle 陈旧失效',
  'persona-preset-break': 'persona/preset 字段重命名破坏',
  'malformed-toolcall': '畸形 tool-call 致会话不可恢复',
  'reasoning-loop': '推理退化循环 / 空响应',
  'sandbox-windows': 'Windows 沙箱/TLS/代理',
  'composer-ime': 'Composer 输入法/翻译干扰',
  'web-process-death': 'dsh web 进程静默死亡',
  'npm-install-build': 'npm 安装/构建失败',
  'tool-visibility': '工具/提示词节丢失',
  'legacy-session-corruption': '会话日志损坏（seq gap/并发写）',
  'legacy-auth-lan': 'Web 鉴权 / 局域网访问',
  'legacy-context-compaction': '上下文压缩失效',
  'legacy-plugin-load-crash': '插件加载失败拖垮启动',
  'legacy-token-auth-pwa': 'PWA / 移动端 / i18n',
  other: '其它（非问题类或未归类）',
};

const SEV_ORDER = ['critical', 'high', 'medium', 'low'];
const ANCHOR = Date.UTC(2026, 7, 13);
const weekOf = d => Math.floor((new Date(d + 'T00:00:00Z').getTime() - ANCHOR) / (7 * 86400000));
const weekLabel = w => {
  const s = new Date(ANCHOR + w * 7 * 86400000);
  const e = new Date(s.getTime() + 6 * 86400000);
  return `${s.toISOString().slice(5, 10)}~${e.toISOString().slice(5, 10)}`;
};

function loadLLM() {
  if (!fs.existsSync(JSONL)) return [];
  const out = [];
  for (const line of fs.readFileSync(JSONL, 'utf-8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      if (typeof o.number === 'number') out.push(o);
    } catch (e) { /* skip torn tail line */ }
  }
  const seen = new Set();
  return out.filter(o => (seen.has(o.number) ? false : seen.add(o.number)));
}

function pct(n, d) { return d ? (n / d * 100).toFixed(1) + '%' : '—'; }

function main() {
  const llm = loadLLM();
  const total = TOTAL_CORPUS;
  const cov = llm.length / total;

  // ---- weekly buckets over the classified subset ----
  const wkSet = [...new Set(llm.map(o => weekOf(o.created)))].sort((a, b) => a - b);
  const wkN = {};
  for (const w of wkSet) wkN[w] = llm.filter(o => weekOf(o.created) === w).length;

  const L = [];
  L.push('# Bug 归类趋势报告（LLM 语义分类）');
  L.push('');
  L.push(`> 生成时间：${new Date().toISOString().slice(0, 19)}Z`);
  L.push(`> 语料：DeepSeek Harness GitHub Discussions #13–#6442，共 ${total} 篇`);
  L.push(`> 分类器：**Qwen3.6-35B-A3B**（局域网 vLLM @ \`192.168.100.242:8200\`，温度 0.1，JSON 约束输出）`);
  L.push(`> 已分类：**${llm.length} / ${total}**（覆盖率 ${pct(llm.length, total)}）`);
  L.push('');
  if (cov < 0.99) {
    L.push(`> ⚠️ **本报告基于部分数据**（分类任务仍在运行）。所有结论在覆盖率补齐后须复核；分周统计按已分类子集计算。`);
    L.push('');
  }
  L.push('---');
  L.push('');

  // ---- 一、方法对比 ----
  L.push('## 一、为什么必须换成 LLM：正则口径的失真量化');
  L.push('');
  L.push('正则（关键词 OR 匹配）只能做「分词解析」，其根本缺陷是**一个帖子同时命中多个族**，导致各族计数之和远超总篇数、份额无法相加、跨族比较被交叉召回污染。');
  L.push('');
  L.push('LLM 版要求模型给出**唯一的 `primary` 族**，因此分布是互斥的、份额相加恒为 100%。下表把两种口径并排，量化正则的偏差：');
  L.push('');
  L.push('| 问题族 | 正则命中 | LLM 主族 | 偏差 | 说明 |');
  L.push('|---|---|---|---|---|');

  const llmPrimary = {};
  for (const o of llm) llmPrimary[o.primary] = (llmPrimary[o.primary] || 0) + 1;

  // Regex hits recomputed on the SAME subset so the comparison is apples-to-apples.
  const regexCounts = {};
  let regexTotalHits = 0, llmTotalHits = 0, exactAgree = 0, regexMissed = 0, regexExtra = 0;
  for (const o of llm) {
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(RAW_DIR, `${o.number}.json`), 'utf-8')); }
    catch (e) { continue; }
    const rf = matchFamilies(docText(d));
    for (const f of rf) regexCounts[f] = (regexCounts[f] || 0) + 1;
    regexTotalHits += rf.length;
    llmTotalHits += o.families.length;
    // primary-level agreement
    const rp = rf.length === 1 ? rf[0] : null;
    if (rp && rp === o.primary) exactAgree++;
    if (rf.length === 0 && o.primary !== 'other') regexMissed++;
    if (rf.length > 0 && o.primary === 'other') regexExtra++;
  }

  const cmpIds = [...new Set([...Object.keys(regexCounts), ...Object.keys(llmPrimary)])]
    .filter(id => id !== 'other')
    .sort((a, b) => (llmPrimary[b] || 0) - (llmPrimary[a] || 0));

  const subsetN = llm.length;
  for (const id of cmpIds) {
    const r = regexCounts[id] || 0, l = llmPrimary[id] || 0;
    const dev = l > 0 ? ((r - l) / l) : (r > 0 ? Infinity : 0);
    const note = dev === Infinity ? '正则误报（LLM 判为 other）'
      : dev > 0.5 ? '正则显著高估'
      : dev < -0.5 ? '正则显著漏检'
      : '基本一致';
    L.push(`| \`${id}\` | ${r} | ${l} | ${isFinite(dev) ? (dev >= 0 ? '+' : '') + (dev * 100).toFixed(0) + '%' : '—'} | ${note} |`);
  }
  L.push('');
  L.push('### 量化结论');
  L.push('');
  L.push('| 指标 | 正则 | LLM |');
  L.push('|---|---|---|');
  L.push(`| 同一子集(${subsetN} 篇)的总命中次数 | ${regexTotalHits} | ${llmTotalHits} |`);
  L.push(`| 平均每篇命中族数 | ${(regexTotalHits / subsetN).toFixed(2)} | ${(llmTotalHits / subsetN).toFixed(2)} |`);
  L.push(`| 命中率冗余度（总命中 ÷ 篇数） | ${(regexTotalHits / subsetN).toFixed(2)}× | — |`);
  L.push('');
  L.push(`- 正则**单族命中**且与 LLM 主族一致：**${exactAgree}** 篇（${pct(exactAgree, subsetN)}）`);
  L.push(`- 正则**完全未命中**但 LLM 判定属于某具体问题族：**${regexMissed}** 篇（${pct(regexMissed, subsetN)}）— 这是正则漏检`);
  L.push(`- 正则**有命中**但 LLM 判定为非问题（other）：**${regexExtra}** 篇（${pct(regexExtra, subsetN)}）— 这是正则误报`);
  L.push('');
  L.push(`正则平均每篇命中 **${(regexTotalHits / subsetN).toFixed(2)}** 个族，而 LLM 为 **${(llmTotalHits / subsetN).toFixed(2)}** 个（多标签模式）或恒为 1（主族模式）。正则的命中冗余正是此前「各族之和远超总篇数、份额无法相加」的根源。`);
  L.push('');

  // ---- 二、LLM 互斥分布 ----
  L.push('---');
  L.push('');
  L.push('## 二、LLM 语义分类分布（互斥口径，全体已分类）');
  L.push('');
  const famSorted = Object.entries(llmPrimary).sort((a, b) => b[1] - a[1]);
  L.push('| 问题族 | 篇数 | 占比 |');
  L.push('|---|---|---|');
  famSorted.forEach(([k, v]) => L.push(`| ${NAMES[k] || k} \`${k}\` | ${v} | ${pct(v, llm.length)} |`));
  L.push(`| **合计** | **${llm.length}** | **100%** |`);
  L.push('');

  const bugN = llm.filter(o => o.is_bug).length;
  L.push(`- **Bug 类**: ${bugN} 篇（${pct(bugN, llm.length)}）— 非 Bug 类含功能请求、插件展示、提问与讨论`);
  L.push('');
  L.push('### 严重度分布（仅 Bug 类）');
  L.push('');
  L.push('| 严重度 | 篇数 | 占 Bug 类 |');
  L.push('|---|---|---|');
  for (const s of SEV_ORDER) {
    const n = llm.filter(o => o.is_bug && o.severity === s).length;
    L.push(`| ${s} | ${n} | ${pct(n, bugN)} |`);
  }
  L.push('');
  L.push('### 主要族的严重度构成');
  L.push('');
  L.push('| 问题族 | critical | high | medium | low |');
  L.push('|---|---|---|---|---|');
  for (const [k] of famSorted.slice(0, 12)) {
    const rows = SEV_ORDER.map(s => llm.filter(o => o.primary === k && o.severity === s).length);
    L.push(`| ${NAMES[k] || k} | ${rows.join(' | ')} |`);
  }
  L.push('');

  // ---- 三、周度趋势（互斥） ----
  L.push('---');
  L.push('');
  L.push('## 三、周度趋势（LLM 主族，互斥口径）');
  L.push('');
  L.push('> 因语料总量剧烈衰减（W0 3386 篇 → W4 355 篇），下表同时给出**绝对篇数**与**当周占比**。占比是互斥口径，可直接横向比较。');
  L.push('');
  L.push(`| 周 | 区间 | 已分类 | ${wkSet.map(w => 'W' + w).join(' | ')} |`);
  L.push(`|---|---|---|${wkSet.map(() => '---').join('|')}|`);
  L.push(`| 篇数 | | | ${wkSet.map(w => wkN[w]).join(' | ')} |`);
  L.push('');
  L.push('### 各族周度篇数与占比');
  L.push('');
  L.push(`| 问题族 | ${wkSet.map(w => 'W' + w).join(' | ')} | W0→末周 |`);
  L.push(`|---|${wkSet.map(() => '---').join('|')}|---|`);
  const trendRows = [];
  for (const [k] of famSorted) {
    const abs = wkSet.map(w => llm.filter(o => o.primary === k && weekOf(o.created) === w).length);
    const shr = wkSet.map((w, i) => wkN[w] ? abs[i] / wkN[w] * 100 : 0);
    const ratio = shr[0] > 0 ? shr[shr.length - 1] / shr[0] : (shr[shr.length - 1] > 0 ? Infinity : 0);
    trendRows.push({ k, abs, shr, ratio });
    L.push(`| ${NAMES[k] || k} | ${abs.map((a, i) => `${a} (${shr[i].toFixed(1)}%)`).join(' | ')} | ${isFinite(ratio) ? ratio.toFixed(2) + '×' : '—'} |`);
  }
  L.push('');
  L.push('### 关键判定（绝对增长 vs 相对抗跌）');
  L.push('');
  const decay = wkN[wkSet[wkSet.length - 1]] / wkN[wkSet[0]];
  L.push(`> 已分类子集的大盘衰减系数 = ${wkN[wkSet[wkSet.length - 1]]} / ${wkN[wkSet[0]]} = **${decay.toFixed(3)}**`);
  L.push('');
  const grewAbs = trendRows.filter(r => r.abs[0] > 0 && r.abs[r.abs.length - 1] / r.abs[0] >= 1.2);
  const declinedAbs = trendRows.filter(r => r.abs[0] > 0 && r.abs[r.abs.length - 1] / r.abs[0] <= 0.5);
  L.push(`- **绝对增长族（${grewAbs.length}）**：` + (grewAbs.length ? grewAbs.map(r => `\`${r.k}\` ${r.abs[0]}→${r.abs[r.abs.length - 1]}`).join('、') : '无'));
  L.push(`- **绝对腰斩族（${declinedAbs.length}）**：` + (declinedAbs.length ? declinedAbs.map(r => `\`${r.k}\` ${r.abs[0]}→${r.abs[r.abs.length - 1]}`).join('、') : '无'));
  L.push('');

  // ---- 四、新发现族 ----
  L.push('---');
  L.push('');
  L.push('## 四、正则分类法遗漏的问题族（LLM 开放式发现）');
  L.push('');
  L.push('模型被允许在「现有分类都套不上」时自行命名一个新族（`new_family`）。这是纯关键词法**结构上无法**给出的信号——正则只能命中预设词表，永远不会发现词表外的模式。');
  L.push('');
  L.push('> 注意：模型给每篇帖各自取名，同一个问题会出现多种拼写（`windows-path-truncation` / `win32-path-truncation` / `native-picker-path-truncation` 实为同一问题）。因此原始标签必须先经 `canon-new-families.cjs` 做**语义归并**才有意义，下表使用归并后的规范族。');
  L.push('');

  const CANON = path.join(OUT_DIR, 'new-family-canonical.json');
  const canon = fs.existsSync(CANON) ? JSON.parse(fs.readFileSync(CANON, 'utf-8')) : null;

  if (canon) {
    L.push(`原始标签 **${canon.distinctLabels}** 个，参与归并 ${canon.clusteredLabels} 个（出现 ≥2 次者），归并为 **${canon.clusters.length}** 个规范族。`);
    L.push('');
    L.push('| 规范新族 | 涉及帖数 | 归并的同义标签 | 说明 |');
    L.push('|---|---|---|---|');
    for (const c of canon.clusters.filter(c => c.posts >= 3).slice(0, 30)) {
      L.push(`| \`${c.canonical}\` | ${c.posts} | ${c.members.map(m => `\`${m.label}\`(${m.count})`).join('<br>')} | ${c.description} |`);
    }
    L.push('');
    L.push('> 上表只列出现 ≥3 帖的规范族；完整归并结果见 `_tools/new-family-canonical.json`。');
    L.push('');
    L.push('**这些新族是下一轮分类表应当补入的候选**——它们说明现有 20 个族存在覆盖盲区。');
  } else {
    L.push('> ⚠️ 尚未运行 `canon-new-families.cjs`，以下为未经归并的原始标签计数（同义标签未合并，计数偏低且碎片化）。');
    L.push('');
    const nf = {};
    for (const o of llm) if (o.new_family && o.is_bug) nf[o.new_family] = (nf[o.new_family] || 0) + 1;
    const nfSorted = Object.entries(nf).sort((a, b) => b[1] - a[1]);
    L.push('| 原始标签 | 篇数 |');
    L.push('|---|---|');
    nfSorted.filter(([, v]) => v >= 3).forEach(([k, v]) => L.push(`| \`${k}\` | ${v} |`));
  }
  L.push('');

  // ---- 五、高严重度清单 ----
  L.push('---');
  L.push('');
  L.push('## 五、LLM 判定的 critical / high 问题清单');
  L.push('');
  const crit = llm.filter(o => o.is_bug && (o.severity === 'critical' || o.severity === 'high'))
    .sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1) || b.number - a.number);
  L.push(`共 **${crit.length}** 篇。`);
  L.push('');
  L.push('| # | 严重度 | 主族 | 标题 | LLM 判定的根因 |');
  L.push('|---|---|---|---|---|');
  for (const o of crit.slice(0, 80)) {
    L.push(`| [#${o.number}](https://github.com/deepseek-ai/deepseek-harness/discussions/${o.number}) | ${o.severity} | ${NAMES[o.primary] || o.primary} | ${(o.title || '').replace(/\|/g, '\\|').slice(0, 80)} | ${(o.root_cause || '').replace(/\|/g, '\\|').slice(0, 100)} |`);
  }
  if (crit.length > 80) L.push(`\n> 仅列出前 80 条（按严重度与编号排序）；完整数据见 \`_tools/llm-classify.jsonl\`。`);
  L.push('');

  // ---- 六、复现 ----
  L.push('---');
  L.push('');
  L.push('## 六、复现与维护');
  L.push('');
  L.push('```powershell');
  L.push('cd E:\\test\\rewrite-agently\\dsh-docs-deliverables\\discussion-issues\\_tools');
  L.push('');
  L.push('# 1. 探测端点吞吐（可选，用于确认并发放大量）');
  L.push('node probe-throughput.cjs 4 16');
  L.push('');
  L.push('# 2. 全量分类（可中断续跑：已完成的 number 会被跳过）');
  L.push('node llm-classify.cjs --concurrency 4');
  L.push('');
  L.push('# 3. 生成本报告（幂等）');
  L.push('node llm-trend-report.cjs');
  L.push('```');
  L.push('');
  L.push('**并发选择依据**（实测该端点）：');
  L.push('');
  L.push('| 并发 | 吞吐 | p90 延迟 |');
  L.push('|---|---|---|');
  L.push('| 4 | 2.45 calls/s | 2.5 s |');
  L.push('| 16 | 0.53 calls/s | 46.1 s |');
  L.push('');
  L.push('> 并发提高到 16 反而使吞吐降到 1/5（端点排队），因此固定 4。这既是性能最优，也避免打满共享的局域网推理机。');
  L.push('');
  L.push('---');
  L.push('');
  L.push('## 七、口径局限');
  L.push('');
  L.push('1. **单模型单次判定**：未做多次采样一致性校验；`confidence` 字段可用于筛出低置信样本复判，但本轮未做。');
  L.push('2. **正文截断至 1200 字符**：超长帖子（如 #6252 的 108k 字符）的尾部细节未进入判定，可能低估其严重度。');
  L.push('3. **`is_bug` 依赖模型判断**：功能请求与缺陷的边界存在主观性，跨模型复核可提高稳健性。');
  L.push('4. **`primary` 的互斥是模型选择的结果**：互斥解决了份额可加性问题，但丢弃了「一帖多因」信息；多标签分析请看 `families` 字段。');
  L.push('5. **覆盖率**：' + pct(llm.length, total) + '。未覆盖部分在结论中按缺失处理，不做外推。');
  L.push('6. **确定性**：本报告除首行「生成时间」外完全确定——同一 `llm-classify.jsonl` 重复运行产出字节一致的正文（已实测）。');
  L.push('');

  fs.writeFileSync(path.join(ISSUES_DIR, '趋势报告-LLM.md'), L.join('\n'), 'utf-8');
  console.log(`✓ discussion-issues/趋势报告-LLM.md`);
  console.log(`  classified=${llm.length}/${total} (${pct(llm.length, total)})  weeks=${wkSet.map(w => 'W' + w + '=' + wkN[w]).join(' ')}`);
  console.log(`  families=${famSorted.length}  bugs=${bugN}  critical+high=${crit.length}  new_families=${canon ? canon.clusters.length : 'n/a (run canon-new-families.cjs)'}`);
}

main();
