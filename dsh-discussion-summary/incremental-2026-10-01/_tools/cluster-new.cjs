#!/usr/bin/env node
/**
 * Cluster new discussions (#6443+ plus recovered gaps) into distinct problem families.
 *
 * Input : <RAW_DIR>/<number>.json
 * Output: <OUT_DIR>/new-clustered.json
 *
 * Precision note: short English abbreviations MUST carry a word boundary.
 * A bare /IME/ matches "timeout"/"time", which inflated the composer-ime
 * family from ~14 to 156 posts before this was fixed.
 */
const fs = require('fs');
const path = require('path');

// Resolve paths relative to this script so the toolkit is location-independent.
const OUT_DIR = __dirname;
const RAW_DIR = 'E:/test/rewrite-agently/dsh-disscu-cache/raw';
const START = 6443;

// The increment = cached files newer than START, plus gap posts below START
// that the previous batch's corpus never covered. The previous corpus is the
// first BASELINE_N lines of llm-classify.jsonl (append-only file, so the first
// N lines are immutable even while a classification run is appending).
const BASELINE_JSONL = 'E:/test/rewrite-agently/dsh-docs-deliverables/discussion-issues/_tools/llm-classify.jsonl';
const BASELINE_N = 6321;
const EXTRA = (() => {
  const base = new Set();
  for (const l of fs.readFileSync(BASELINE_JSONL, 'utf-8').split('\n').slice(0, BASELINE_N)) {
    if (!l.trim()) continue;
    try { base.add(JSON.parse(l).number); } catch (e) { /* skip */ }
  }
  const extra = fs.readdirSync(RAW_DIR)
    .filter(f => /^\d+\.json$/.test(f))
    .map(f => parseInt(f.replace('.json', '')))
    .filter(n => n < START && !base.has(n))
    .sort((a, b) => a - b);
  console.log(`recovered gap posts (< #${START}, not in previous corpus): ${extra.join(', ') || '(none)'}`);
  return new Set(extra);
})();

// Precise families — word-boundary + co-occurrence constraints, low overlap
const FAMILIES = [
  {
    id: 'session-migration',
    name: '会话格式迁移失败 (v0→v1→v2→v3)',
    kw: [/v0[→-]?to[→-]?v1|v1[→-]?to[→-]?v2|v2[→-]?to[→-]?v3/i, /v0→v1|v1→v2|v2→v3/, /session-format/i, /legacyInterruptedTurnRestart/i, /SessionFormatUnsupported/i, /(会话|session|历史).{0,20}(迁移|migration)/i, /(迁移|migration).{0,20}(会话|session)/i],
  },
  {
    id: 'session-history-unreadable',
    name: '升级后历史会话无法加载',
    kw: [/历史.*无法加载|无法加载.*历史|历史加载失败|history.*(fail|unavailable|load)/i, /session.*unreadable|unreadable.*session/i, /会话.*永久.*(打不开|不可用|无法)/i, /打不开.*会话|会话.*打不开/i, /Failed to load history/i, /cannot safely transform/i, /unknown to this harness/i, /加载历史.{0,24}(卡|挂|停|永久|stuck|hang|forever)/i, /waiter.{0,30}(settle|never)/i],
  },
  {
    id: 'fork-inbox',
    name: 'Fork 会话继承父会话队列',
    kw: [/session\.fork/i, /(fork|分叉).{0,40}(inbox|队列|排队|已入队|继承|重跑|重放)/i, /(inbox|队列|排队|已入队).{0,40}(fork|分叉|继承)/i, /pending inbox/i, /fork.{0,30}(inherit|leak|replay)/i],
  },
  {
    id: 'windows-reveal',
    name: 'Windows「在资源管理器中显示」静默失败',
    kw: [/Show in File Explorer/i, /reveal.*(Explorer|file manager|native)/i, /revealNativePath/i, /资源管理器|文件管理器/],
  },
  {
    id: 'web-startup-perf',
    name: 'dsh web 启动性能退化',
    kw: [/启动.*(慢|2\.7s|17s|18s)|startup.*(slow|perf)/i, /client-modules/i, /全量重(建|组)/, /命令列表洪泛|commands\/list/i, /Flood Pins CPU/i, /启动.*(约|耗时)/],
  },
  {
    id: 'client-bundle-stale',
    name: '升级后 client bundle 陈旧失效',
    kw: [/client combo/i, /client bundle|bundle.*revision/i, /hard refresh|硬刷新|强制刷新/i, /Failed to load plugins/i, /did not activate|loaded without registering/i],
  },
  {
    id: 'persona-preset-break',
    name: 'persona/preset 配置字段重命名破坏',
    kw: [/persona.*(config\.text|prefix|rename|重命名)/i, /(config\.text|text.*prefix).*(persona|preset)/i, /agent-preset\/invalid|preset.*failed to mou/i, /preset "(code|cute-deepseek|[a-z-]+)" (not found|failed)/i, /(预设|preset).{0,15}(无法|失效|加载错误|创建新会话)/i, /(重命名|rename).{0,20}(字段|field).{0,20}(preset|persona)/i],
  },
  {
    id: 'malformed-toolcall',
    name: '畸形 tool-call 持久化导致会话不可恢复',
    kw: [/tool.?call.*(empty|空|畸形|malformed|missing)/i, /空 id|empty.*id/i, /tool_call_id/i, /unknown tool/i, /dangling.*tool_calls|悬空 tool_calls/i, /400 INVALID_REQUEST|missing field/i],
  },
  {
    id: 'reasoning-loop',
    name: '推理退化循环 / 空响应',
    kw: [/reasoning.*(loop|退化|循环)/i, /思考.*(退化|循环|死循环)/i, /EMPTY_RESPONSE|empty response/i, /zero.*output|零产出/i, /runaway.*(arguments|tool)/i],
  },
  {
    id: 'sandbox-windows',
    name: 'Windows 沙箱/TLS/代理环境问题',
    kw: [/schannel|TLS.*(fail|失败)/i, /sandbox.*(windows|Windows)|Windows.*sandbox/i, /proxy.*(variable|env)|代理变量/i, /sandbox_permissions|沙箱.*(失败|拒绝)/i, /\bpwsh\b|PowerShell/i],
  },
  {
    id: 'composer-ime',
    name: 'Composer 输入法/翻译干扰',
    kw: [/\bIME\b/, /输入法/, /composer.*(translat|break)/i, /\bLexical\b/, /browser translation|浏览器翻译/, /中文输入/],
  },
  {
    id: 'web-process-death',
    name: 'dsh web 进程静默死亡',
    kw: [/silent.*(process )?death|静默.*(死亡|退出|空转)/i, /0xC0000409/i, /\bPM2\b/, /import\.meta\.main/i, /heap.*(OOM|limit)|JavaScript heap out of memory/i, /process.*(crash|exit)/i],
  },
  {
    id: 'npm-install-build',
    name: 'npm 安装/构建失败',
    kw: [/fs-ext|node-addon-system/i, /pnpm.*(install|build).*(fail|报错|失败)/i, /npx.*(fail|静默|退出|卡死)/i, /Cannot find module/i, /node-gyp|MSVC/i, /node_modules.*shadow/i, /Node(\.js)?\s*<\s*24|Node 2[0-3]/i],
  },
  {
    id: 'tool-visibility',
    name: '工具/提示词节丢失',
    kw: [/loses.{0,20}(native )?tools/i, /工具.{0,10}丢失/, /prompt.{0,10}section/i, /提示词.{0,6}(注入顺序|消失|丢失)/, /dynamic.{0,20}tool.{0,20}(load|register|visible)/i, /tool.{0,20}(registration|registry).{0,20}(lost|missing|dropped)/i],
  },
  // --- families discovered in the #6443–#8513 batch ---
  {
    id: 'tool-runtime-duplication',
    name: 'dsh-tools 双实例 / runtime 解析分裂',
    kw: [/dsh-tools.{0,30}(双|two|second|split|duplicate|double)/i, /(double|dual|two|双).{0,20}instance.{0,30}(dsh-tools|tools)/i, /module.{0,16}(duplicat|双|重复)/i, /symbol.{0,20}(mismatch|不一致|分裂)/i, /runtime.{0,20}(解析|resolution).{0,20}(模式|mode|split)/i, /Cannot read properties of undefined \(reading 'prepare'\)/i, /source checkout.{0,40}loads.{0,40}(harness|packages)/i],
  },
  {
    id: 'sandbox-acl',
    name: 'Windows 沙箱 ACL 授权失败 / 审批洪泛',
    kw: [/\bACL\b/i, /SetNamedSecurityInfo/i, /icacls/i, /(sandbox|沙箱).{0,24}(授权|permission|审批|approval).{0,24}(失败|拒绝|flood|太多次|太多|denied)/i, /(审批|approval).{0,16}(次数|flood|风暴|storm)/i, /Win32\s*5/i],
  },
  {
    id: 'macos-entitlements',
    name: 'macOS 沙箱 entitlements / 完整性标签',
    kw: [/entitlement/i, /macos.{0,30}(sandbox|integrity|签名|notariz|安全策略)/i, /app\.sandbox/i, /codesign/i],
  },
];

function matchFamilies(text) {
  const hits = [];
  for (const f of FAMILIES) {
    for (const k of f.kw) {
      if (k.test(text)) { hits.push(f.id); break; }
    }
  }
  return hits;
}

function main() {
  const files = fs.readdirSync(RAW_DIR)
    .filter(f => /^\d+\.json$/.test(f))
    .map(f => ({ name: f, num: parseInt(f.replace('.json', '')) }))
    .filter(f => f.num >= START || EXTRA.has(f.num))
    .sort((a, b) => a.num - b.num);

  const discussions = [];
  for (const f of files) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(RAW_DIR, f.name), 'utf-8'));
      const text = `${d.title || ''}\n${(d.body || '').slice(0, 3000)}`;
      discussions.push({
        num: d.number, title: d.title || '', body: d.body || '',
        category: d.category || '', comments: d.comments_count || 0,
        created: d.created_at || '', state: d.state || '', url: d.url || '',
        bodyLen: (d.body || '').length,
        families: matchFamilies(text),
      });
    } catch (e) { /* skip unparsable */ }
  }

  const counts = {};
  for (const d of discussions) for (const f of d.families) counts[f] = (counts[f] || 0) + 1;

  console.log('=== Family Sizes ===');
  const famMap = Object.fromEntries(FAMILIES.map(f => [f.id, f.name]));
  Object.entries(counts).sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  ${k}  — ${famMap[k]}`));

  const unclustered = discussions.filter(d => d.families.length === 0);
  console.log(`\n=== Unclustered: ${unclustered.length} ===`);

  fs.writeFileSync(
    path.join(OUT_DIR, 'new-clustered.json'),
    JSON.stringify({ discussions, counts, families: FAMILIES.map(f => ({ id: f.id, name: f.name })) }, null, 2),
    'utf-8'
  );
  console.log(`\nSaved: ${path.join(OUT_DIR, 'new-clustered.json')}`);
}

main();
