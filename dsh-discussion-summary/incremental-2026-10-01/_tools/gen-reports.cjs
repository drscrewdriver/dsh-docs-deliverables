#!/usr/bin/env node
/**
 * Generate incremental deliverable reports from clustered new discussions.
 *
 * Input : <OUT_DIR>/new-clustered.json   (produced by cluster-new.cjs)
 * Output:
 *   <OUT_BASE>/dsh-discussion-summary/incremental-<batch>/增量分析报告.md
 *   <OUT_BASE>/dsh-discussion-summary/incremental-<batch>/插件展示增量.md
 *   <OUT_BASE>/dsh-discussion-summary/incremental-<batch>/bug讨论增量.md
 *   <OUT_BASE>/discussion-issues/<existing>/*.md                          (appended)
 *
 * This batch creates NO new subsystem docs (SUBSYS_DOCS is empty): the two docs
 * the 2026-09-12 batch created live under discussion-issues/ and must not be
 * overwritten with new-batch-only content. Only the incremental appends run.
 *
 * IDEMPOTENT: re-running strips the previously appended
 * "## 增量补充 — #<range>（<date>）" block before appending again, and rewrites
 * the standalone reports. Safe to re-run.
 */
const fs = require('fs');
const path = require('path');

// Resolve paths relative to this script so the toolkit is location-independent.
// _tools/ -> incremental-<batch>/ -> dsh-discussion-summary/ -> dsh-docs-deliverables/
const OUT_DIR = __dirname;
const OUT_BASE = path.resolve(__dirname, '..', '..', '..');
const BATCH_DIR_NAME = path.basename(path.resolve(__dirname, '..'));

const CLUSTERED = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'new-clustered.json'), 'utf-8'));
const { discussions, counts, families } = CLUSTERED;
const famName = Object.fromEntries(families.map(f => [f.id, f.name]));

const RANGE = '#6443–#8513';
const BATCH_DATE = '2026-10-01';
const APPEND_MARKER = `## 增量补充 — ${RANGE}（${BATCH_DATE}）`;

function excerpt(s, n = 300) {
  return (s || '').replace(/\s+/g, ' ').replace(/[`*_#|]/g, '').trim().slice(0, n);
}

function cleanTitle(t) {
  return (t || '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

function byFamily(id) {
  return discussions.filter(d => d.families.includes(id));
}

/** Representative post = most-commented, then longest body. */
function rankedByEngagement(items) {
  return [...items].sort((a, b) => (b.comments - a.comments) || (b.bodyLen - a.bodyLen));
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

// ============================================================
// 1. Incremental analysis report
// ============================================================
const FAMILY_DETAIL = {
  'session-migration': {
    root: '会话日志格式在 0.1.5 引入 **v0→v1→v2→v3** 连续迁移链。迁移器对**已发布过的历史形状**过度严格：单条不合规记录即拒绝**整份**日志；`subagent/descriptor` 仅按 version 数字判定；`turn/start N+1` 未开期望轮次即整体拒载。',
    fix: '迁移器需「逐条容忍 + 显式隔离」，而非整份拒载；对已发布 v0 形状做白名单而非全等校验；提供产品内恢复入口（降级读取 / 跳过不合规记录）。',
  },
  'session-history-unreadable': {
    root: '升级后历史会话加载失败的统一感受，背后是多个独立拒载点：迁移校验过严、消息 source kind 未登记、崩轮悬空 tool_calls、`surfaceOp` 字段缺失。',
    fix: '读取路径应对未知/缺失字段做**降级容忍**，并把「不可加载」的原因暴露到 UI，而非静默丢弃。',
  },
  'fork-inbox': {
    root: '`session.fork` 的 seed 切割逻辑从边界 `turn/end` 向前走到下一个 `turn/start`，把两者之间**已入队未执行**的 `agent/inbox/spliced` 事件一并复制进子会话。子会话因此重跑父会话的下一条 prompt。',
    fix: 'fork 时显式清空 pending inbox，或在 seed 切割时排除 `agent/inbox/*` 事件族。',
  },
  'windows-reveal': {
    root: '`revealNativePath()` 复用共享的 `runNativeCommand()`，该 runner 恒以 `windowsHide: true` 启动，导致 GUI 程序 `explorer.exe` 被创建但窗口不可见；非 ASCII 路径另有百分号编码回退到桌面的问题。',
    fix: '为 Explorer 交接使用独立的可见 runner（仅 `explorer.exe` 用 `windowsHide: false`），并修正 file URL 的百分号编码。',
  },
  'web-startup-perf': {
    root: '0.1.5 的 electron 打包改动使 `client-modules` 全量重组由 1 次变为 8 次，`dsh web` 启动从 ~2.7s 劣化到 ~17–18s；另有 `commands/list` 自持洪泛占满 CPU。',
    fix: 'combo 组合结果需缓存/去重；`commands/list` 需断环或加节流。',
  },
  'client-bundle-stale': {
    root: '升级后 Web 端 client combo 未重新组合：新增 bundle 模块（如 `ui-sidebar-*`）缺失，旧 revision 的 bundle 被浏览器缓存，插件树整体不激活。',
    fix: '升级需强制刷新（bundle revision 进 URL 或响应头 cache-busting）；boot 期校验 combo 完整性并报错。',
  },
  'persona-preset-break': {
    root: '官方 `@deepseek-ai/dsh-persona` 在 0.1.5-rc.1 把配置字段 `text` 重命名为 `prefix`，**无迁移提示**，导致所有引用 persona 的用户自定义 preset 无法挂载、无法创建新会话。',
    fix: '配置字段重命名必须走迁移或双读兼容，并在挂载失败时输出可操作的错误。',
  },
  'malformed-toolcall': {
    root: '空 `name`/空 `id` 的 tool-call 在落库时**没有校验**，写入后每次回放都被 provider 以 `missing field tool_call_id` 拒绝（HTTP 400），会话永久不可恢复。',
    fix: '写入层增加 tool-call 形状校验（name/callId 非空），失败路径同步更新状态并阻止落库。',
  },
  'reasoning-loop': {
    root: '超长上下文 + max reasoning effort 下模型陷入思考退化循环，回合零产出且无自动熔断；`EMPTY_RESPONSE` 守卫测试的是 `order.length` 而非实际内容长度，把 reasoning-only 响应误判为成功。',
    fix: '增加轮次预算与重复检测熔断；空响应守卫应检测有效内容而非消息条数。',
  },
  'sandbox-windows': {
    root: 'Windows 受限令牌（restricted token）下 SSPI 无凭据，导致 workspace-write 沙箱内一切 schannel TLS 握手失败；另有子进程环境变量大小写重复破坏 PowerShell `Env:` provider。',
    fix: '沙箱 runner 需在受限令牌下显式传递 TLS 凭据，或在 TLS 场景下不启用受限令牌；环境变量注入需做大小写归一。',
  },
  'composer-ime': {
    root: 'Composer 迁移到 **Lexical** 后，输入法（IME）组合态与浏览器翻译/自动填充的交互未被正确处理。组合中的 Enter 被当作换行而非提交，翻译插件改写 DOM 节点导致 React 文本节点错位。',
    fix: '禁用输入框区域的浏览器翻译（`translate="no"`），并在 Lexical 层显式处理 `compositionend` 后再判定提交键。',
  },
  'web-process-death': {
    root: '`dsh web` 进程静默死亡：Windows 下 `0xC0000409` 异常退出；PM2 fork 容器下因 `import.meta.main` 为 false 而「online 但不监听」。',
    fix: '进程退出需落盘诊断（退出码、栈、最后事件）；`import.meta.main` 守卫需兼容被 `import()` 加载的场景。',
  },
  'npm-install-build': {
    root: '`fs-ext` → `node-addon-system` 迁移后缺少预编译二进制，强制本地 MSVC 编译；源码检出缺 `bin/system.node`；Node < 24 上因 `import.meta.main` 守卫而静默失败。',
    fix: '发布预编译二进制或提供纯 JS 回退；在入口显式做 Node 版本断言并对不满足版本**响亮失败**。',
  },
  'tool-visibility': {
    root: '续接 Web 会话时，部分原生工具与对应提示词节在轮次之间丢失，模型能力面随会话年龄漂移。',
    fix: '工具注册表需在每次装配时做完整性校验，并对丢失项显式告警。',
  },
  // --- families discovered in the #6443–#8513 batch ---
  'tool-runtime-duplication': {
    root: '0.1.6-alpha.2 起源码启动的默认 runtime 解析模式把 `@deepseek-ai/dsh-tools` 装载成**两个独立实例**（workspace 链接与 node_modules shadow 并存），两实例各持一份模块级状态（已 prepare 的命令表 / Schema 注册表）。注册走 A 副本、调用走 B 副本时读到未初始化状态，表现为所有工具调用持续报 `Cannot read properties of undefined (reading \'prepare\')`（#7035，83 评论）。',
    fix: 'runtime 解析需对 workspace 包做单例归一（解析结果去重 / exports 收敛）；检测到同包多实例时**响亮报错**而非静默分裂；升级/源码混装场景需清理旧 shadow 副本。',
  },
  'sandbox-acl': {
    root: '0.1.7-rc / 0.2.0-rc 把 Windows 沙箱授权下沉到文件/目录 ACL 粒度（`SetNamedSecurityInfoW`），在受限令牌或 ACL 继承异常的卷上返回 Win32 5（拒绝访问）；授权失败**不聚合**，逐文件弹审批形成审批洪泛（#7564、#8513），用户要么无限确认、要么功能不可用。',
    fix: 'ACL 授权按目录聚合为一次性授权；失败路径显式报错并给出可操作提示（涉及哪个路径、为何被拒）；对不可授权路径白名单化或降级为只读。',
  },
  'macos-entitlements': {
    root: 'macOS 打包缺少必要的沙箱 entitlements / 完整性标签，系统层拒绝子进程派生、网络或钥匙串访问，表现为启动即崩或特定功能静默失败。',
    fix: '签名打包时补齐 entitlements 清单并纳入发布检查；启动时自检 entitlements 完整性并输出诊断。',
  },
};

function genIncrementalReport() {
  const lines = [];
  const highQ = discussions.filter(d => d.bodyLen > 1500 && d.comments >= 3)
    .sort((a, b) => b.bodyLen - a.bodyLen);

  lines.push(`# DSH 讨论区增量分析报告 ${RANGE}`);
  lines.push('');
  lines.push(`> 生成时间：${BATCH_DATE}　|　数据源：${discussions.length} 篇新增 GitHub Discussions（${RANGE}，另含 #2906/#2907/#6031 三篇补齐空洞帖）`);
  lines.push('> 基线：`incremental-2026-09-12/增量分析报告.md`（截至 #6442，6321 篇）');
  lines.push('> 累计覆盖：#13–#8513，共 8377 篇缓存（GitHub 现存 8370 篇，136 个编号已被删除）');
  lines.push('');
  lines.push('本报告聚焦增量讨论，回答三个问题：**新增了哪些问题族**、**版本演进带来什么破坏**、**插件生态增量如何**。');
  lines.push('');
  lines.push('---');
  lines.push('');

  const catCount = {};
  for (const d of discussions) catCount[d.category] = (catCount[d.category] || 0) + 1;
  lines.push('## 〇、增量总览');
  lines.push('');
  lines.push('| 维度 | 数值 |');
  lines.push('|---|---|');
  lines.push(`| 新增讨论 | **${discussions.length}** 篇 |`);
  lines.push(`| 时间跨度 | ${discussions[0].created.slice(0, 10)} → ${discussions[discussions.length - 1].created.slice(0, 10)} |`);
  lines.push(`| 有评论讨论 | ${discussions.filter(d => d.comments > 0).length} 篇 |`);
  lines.push(`| 正文总量 | ${(discussions.reduce((s, d) => s + d.bodyLen, 0) / 1024 / 1024).toFixed(2)} MB |`);
  const clusteredN = discussions.filter(d => d.families.length > 0).length;
  lines.push(`| 聚类命中 | ${clusteredN} 篇（${(clusteredN / discussions.length * 100).toFixed(0)}%）|`);
  lines.push('');
  lines.push('### 分类分布');
  lines.push('');
  lines.push('| Category | 数量 |');
  lines.push('|---|---|');
  Object.entries(catCount).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => lines.push(`| ${k} | ${v} |`));
  lines.push('');

  const verRe = /0\.\d+\.[0-9]+(?:-[a-z]+\.?[0-9]*)?/g;
  const vers = {};
  for (const d of discussions) {
    const m = (d.title + ' ' + d.body).match(verRe) || [];
    for (const v of m) vers[v] = (vers[v] || 0) + 1;
  }
  lines.push('### 版本提及热力（版本压力）');
  lines.push('');
  lines.push('| 版本 | 提及次数 |');
  lines.push('|---|---|');
  Object.entries(vers).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .forEach(([k, v]) => lines.push(`| \`${k}\` | ${v} |`));
  lines.push('');
  lines.push('> **关键判断**：增量讨论的版本焦点已扩散为 `0.1.5-rc.2`（762 次）、`0.1.7-rc.2`（633 次）、`0.1.6-alpha.2`（468 次）与 `0.2.0-rc.2`（318 次）多版本并存；升级破坏从会话持久化迁移链扩展到 **runtime 解析分裂（dsh-tools 双实例）** 与 **Windows 沙箱 ACL 授权 / 审批洪泛**。');
  lines.push('');
  lines.push('---');
  lines.push('');

  const famOrder = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

  lines.push(`## 一、新增问题族（${famOrder.length} 族，按规模排序）`);
  lines.push('');
  lines.push('| 族 | 规模 | 核心症状 |');
  lines.push('|---|---|---|');
  for (const fid of famOrder) {
    const rep = rankedByEngagement(byFamily(fid))[0];
    const symptom = rep ? `#${rep.num} ${excerpt(rep.title, 55)}` : '';
    lines.push(`| \`${fid}\` | ${counts[fid]} | ${symptom} |`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 二、问题族详解');
  lines.push('');

  for (const fid of famOrder) {
    const items = byFamily(fid);
    if (!items.length) continue;
    const detail = FAMILY_DETAIL[fid] || { root: '—', fix: '—' };
    lines.push(`### ${famName[fid]}　\`${fid}\``);
    lines.push('');
    lines.push(`- **规模**: ${items.length} 篇　|　**有实质正文**: ${items.filter(i => i.bodyLen > 800).length} 篇`);
    lines.push(`- **评论总量**: ${items.reduce((s, i) => s + i.comments, 0)}`);
    lines.push('');
    lines.push('**根因**：' + detail.root);
    lines.push('');
    lines.push('**修复方向**：' + detail.fix);
    lines.push('');
    lines.push('**代表帖**（按社区参与度排序）：');
    lines.push('');
    const ranked = rankedByEngagement(items);
    for (const it of ranked.slice(0, 8)) {
      lines.push(`- [#${it.num}](https://github.com/deepseek-ai/deepseek-harness/discussions/${it.num}) [${it.category}] ${cleanTitle(it.title).slice(0, 110)} — ${it.bodyLen}c / ${it.comments}cm`);
    }
    if (items.length > 8) {
      lines.push('');
      lines.push(`<details><summary>其余 ${items.length - 8} 篇讨论 ID</summary>`);
      lines.push('');
      lines.push(ranked.slice(8).map(i => `#${i.num}`).join(', '));
      lines.push('');
      lines.push('</details>');
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  lines.push('## 三、高质量增量讨论（正文 >1500 字且评论 ≥3）');
  lines.push('');
  lines.push(`共 **${highQ.length}** 篇。`);
  lines.push('');
  lines.push('| # | Category | 标题 | 正文 | 评论 |');
  lines.push('|---|---|---|---|---|');
  for (const d of highQ) {
    lines.push(`| [#${d.num}](https://github.com/deepseek-ai/deepseek-harness/discussions/${d.num}) | ${d.category} | ${cleanTitle(d.title).slice(0, 95)} | ${d.bodyLen} | ${d.comments} |`);
  }
  lines.push('');

  const dir = path.join(OUT_BASE, 'dsh-discussion-summary', BATCH_DIR_NAME);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, '增量分析报告.md'), lines.join('\n'), 'utf-8');
  console.log('✓ 增量分析报告.md');
  return { highQ, famOrder };
}

// ============================================================
// 2. New subsystem docs — EMPTY for this batch (see file header)
// ============================================================
const SUBSYS_DOCS = [];

function genSubsystemDocs() {
  for (const doc of SUBSYS_DOCS) {
    const allItems = doc.types.flatMap(t => byFamily(t.family))
      .filter((v, i, a) => a.findIndex(x => x.num === v.num) === i);

    const L = [];
    L.push(`# ${doc.title}`);
    L.push('');
    L.push(`> 来源: ${doc.origin}，共 ${allItems.length} 篇去重帖子`);
    L.push(`> 归属: ${doc.belongs}`);
    L.push(`> 增量批次: ${RANGE}（${BATCH_DATE} 拉取）`);
    L.push('');
    L.push('## 症状');
    L.push('');
    doc.symptoms.forEach(s => L.push(`- ${s}`));
    L.push('');
    L.push('## 根因');
    L.push('');
    doc.roots.forEach((r, i) => L.push(`${i + 1}. ${r}`));
    L.push('');
    L.push('## 临时方案');
    L.push('');
    doc.workaround.forEach((w, i) => L.push(`${i + 1}. ${w}`));
    L.push('');
    L.push('## 修复状态');
    L.push('');
    L.push(doc.fixStatus);
    L.push('');
    L.push('---');
    L.push('');
    L.push('## 官方文档参考');
    L.push('');
    for (const [name, rel, desc] of doc.docs) {
      L.push(`- **${name}**：[${rel}](../../official-repo/docs/${rel}) — ${desc}`);
    }
    L.push('');
    L.push('## Problem Types by Discussion Family');
    L.push('');
    L.push(`> 本系统共 ${doc.types.length} 种问题类型，覆盖 ${allItems.length} 篇讨论`);
    L.push('');
    let idx = 1;
    for (const t of doc.types) {
      const ti = byFamily(t.family);
      if (!ti.length) continue;
      L.push(`### ${idx}. ${t.name} (${t.en})`);
      L.push('');
      L.push(`- **帖子数**: ${ti.length} 篇`);
      L.push(`- **代表帖**: #${rankedByEngagement(ti)[0].num} — ${cleanTitle(rankedByEngagement(ti)[0].title).slice(0, 120)}`);
      L.push('- **相关讨论 ID**:');
      L.push('');
      for (let i = 0; i < ti.length; i += 10) {
        L.push(`  ${ti.slice(i, i + 10).map(x => `#${x.num}`).join(', ')}`);
      }
      L.push('');
      L.push('---');
      L.push('');
      idx++;
    }

    const dir = path.join(OUT_BASE, 'discussion-issues', doc.dir);
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, 'discussion-issues.md'), L.join('\n'), 'utf-8');
    console.log(`✓ discussion-issues/${doc.dir}/discussion-issues.md`);
  }
}

// ============================================================
// 3. Append sections to existing subsystem docs (idempotent)
// ============================================================
function appendToExisting() {
  const APPEND_MAP = {
    'session-projection': ['session-migration', 'session-history-unreadable', 'malformed-toolcall'],
    'web-server': ['web-startup-perf', 'web-process-death', 'client-bundle-stale', 'composer-ime'],
    'filesystem': ['windows-reveal', 'sandbox-windows'],
    'llm-streaming': ['reasoning-loop', 'npm-install-build'],
    'code-runtime': ['sandbox-windows', 'npm-install-build', 'tool-runtime-duplication', 'sandbox-acl', 'macos-entitlements'],
    'token-meter': ['web-startup-perf'],
    'subagent': ['fork-inbox'],
  };

  for (const [dir, famIds] of Object.entries(APPEND_MAP)) {
    const file = path.join(OUT_BASE, 'discussion-issues', dir, 'discussion-issues.md');
    if (!fs.existsSync(file)) { console.log(`  skip ${dir} (no file)`); continue; }
    const raw = fs.readFileSync(file, 'utf-8');

    // The existing docs are CRLF; our text blocks are LF. Mixing them makes the
    // append non-idempotent (the trailing-\s* normalisation behaves differently
    // on \r\n), so normalise to LF in memory and restore the file's own EOL at
    // the end. True idempotency depends on this.
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';
    let content = raw.replace(/\r\n/g, '\n');

    // Idempotency: strip any previously-appended incremental section
    const markerIdx = content.indexOf(APPEND_MARKER);
    if (markerIdx !== -1) {
      const sepIdx = content.lastIndexOf('\n---\n', markerIdx);
      content = (sepIdx !== -1 ? content.slice(0, sepIdx) : content.slice(0, markerIdx));
      console.log(`  (stripped previous append in ${dir})`);
    }

    // Normalize the tail so the appended section introduces exactly one
    // separator. ORDER MATTERS: strip the trailing horizontal rule FIRST, then
    // collapse trailing whitespace. Doing it the other way round leaves an extra
    // blank line (the rule removal itself re-introduces a newline), which makes
    // the append non-idempotent.
    content = content.replace(/\n---\s*$/, '\n').replace(/\s+$/, '\n');

    const L = [];
    L.push('');
    L.push('---');
    L.push('');
    L.push(APPEND_MARKER);
    L.push('');
    L.push(`> 本批次新增讨论中与本子系统相关的帖子。原始全量分析见 \`dsh-discussion-summary/${BATCH_DIR_NAME}/增量分析报告.md\`。`);
    L.push('');

    for (const fid of famIds) {
      const items = rankedByEngagement(byFamily(fid).filter(d => d.bodyLen > 500));
      if (!items.length) continue;
      L.push(`### ${famName[fid]}　\`${fid}\``);
      L.push('');
      L.push(`- **规模**: ${items.length} 篇（正文 >500 字）`);
      L.push('');
      L.push('| # | 标题 | 正文 | 评论 |');
      L.push('|---|---|---|---|');
      for (const it of items.slice(0, 12)) {
        L.push(`| [#${it.num}](https://github.com/deepseek-ai/deepseek-harness/discussions/${it.num}) | ${cleanTitle(it.title).slice(0, 95)} | ${it.bodyLen} | ${it.comments} |`);
      }
      L.push('');
      if (items.length > 12) {
        L.push(`其余：${items.slice(12).map(i => `#${i.num}`).join(', ')}`);
        L.push('');
      }
    }

    const out = content + L.join('\n');
    fs.writeFileSync(file, eol === '\r\n' ? out.replace(/\n/g, '\r\n') : out, 'utf-8');
    console.log(`✓ appended discussion-issues/${dir}/discussion-issues.md (${eol === '\r\n' ? 'CRLF' : 'LF'})`);
  }
}

// ============================================================
// 4. Plugin showcases
// ============================================================
function extractRepos(text) {
  return [...new Set((text.match(/https?:\/\/github\.com\/[\w.-]+\/[\w.-]+/g) || [])
    .map(u => u.replace(/[).,;]+$/, ''))
    .filter(u => !/deepseek-ai\/deepseek-harness/.test(u)))];
}

function genPluginShowcase() {
  const plugins = discussions.filter(d => d.category === 'Show Your Plugins!')
    .sort((a, b) => b.bodyLen - a.bodyLen);

  const L = [];
  L.push(`# 插件展示增量 — ${RANGE}`);
  L.push('');
  L.push(`> 生成时间：${BATCH_DATE}　|　数据源：${plugins.length} 篇新增「Show Your Plugins!」讨论`);
  L.push('> 基线：`incremental-2026-09-12/插件展示增量.md`（截至 #6442）');
  L.push('');
  L.push('## 全部新增插件展示帖');
  L.push('');
  L.push('| # | 标题 | 正文 | 评论 | 仓库链接 |');
  L.push('|---|---|---|---|---|');
  for (const p of plugins) {
    const repoStr = extractRepos(p.body).slice(0, 2)
      .map(r => `[${r.replace('https://github.com/', '')}](${r})`).join(' · ') || '—';
    L.push(`| [#${p.num}](https://github.com/deepseek-ai/deepseek-harness/discussions/${p.num}) | ${cleanTitle(p.title).slice(0, 80)} | ${p.bodyLen} | ${p.comments} | ${repoStr} |`);
  }
  L.push('');

  const repoMap = new Map();
  for (const p of plugins) {
    for (const r of extractRepos(p.body)) {
      if (!repoMap.has(r)) repoMap.set(r, []);
      repoMap.get(r).push(p.num);
    }
  }
  L.push('## 提取的仓库链接（去重）');
  L.push('');
  L.push(`共 **${repoMap.size}** 个唯一仓库。`);
  L.push('');
  L.push('| 仓库 | 提及帖 |');
  L.push('|---|---|');
  for (const [r, nums] of [...repoMap.entries()].sort((a, b) => b[1].length - a[1].length)) {
    L.push(`| [${r.replace('https://github.com/', '')}](${r}) | ${nums.map(n => `#${n}`).join(', ')} |`);
  }
  L.push('');

  const dir = path.join(OUT_BASE, 'dsh-discussion-summary', BATCH_DIR_NAME);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, '插件展示增量.md'), L.join('\n'), 'utf-8');
  console.log(`✓ 插件展示增量.md (${plugins.length} posts, ${repoMap.size} repos)`);
}

// ============================================================
// 5. Bug digest
// ============================================================
function genBugDigest() {
  const bugs = discussions
    .filter(d => /\[BUG\]|\[Bug\]|^Bug[:\s]|bug\s*报告|Bug Report|BUG\b/.test(d.title))
    .sort((a, b) => b.bodyLen - a.bodyLen);

  const L = [];
  L.push(`# Bug 讨论增量 — ${RANGE}`);
  L.push('');
  L.push(`> 生成时间：${BATCH_DATE}　|　数据源：${bugs.length} 篇新增 Bug 类讨论`);
  L.push('> 基线：`incremental-2026-09-12/bug讨论增量.md`（截至 #6442）');
  L.push('');
  L.push('## 按正文长度排序（内容充实度 = 可复现性代理指标）');
  L.push('');
  L.push('| # | 标题 | Category | 正文 | 评论 |');
  L.push('|---|---|---|---|---|');
  for (const b of bugs) {
    L.push(`| [#${b.num}](https://github.com/deepseek-ai/deepseek-harness/discussions/${b.num}) | ${cleanTitle(b.title).slice(0, 100)} | ${b.category} | ${b.bodyLen} | ${b.comments} |`);
  }
  L.push('');

  const dir = path.join(OUT_BASE, 'dsh-discussion-summary', BATCH_DIR_NAME);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'bug讨论增量.md'), L.join('\n'), 'utf-8');
  console.log(`✓ bug讨论增量.md (${bugs.length} bugs)`);
}

genIncrementalReport();
genSubsystemDocs();
appendToExisting();
genPluginShowcase();
genBugDigest();
console.log('\nDone.');
