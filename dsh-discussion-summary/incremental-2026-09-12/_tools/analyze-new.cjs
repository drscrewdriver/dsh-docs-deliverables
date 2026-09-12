#!/usr/bin/env node
/**
 * Broad subsystem classification for new discussions (#5886+).
 *
 * Input : <RAW_DIR>/<number>.json
 * Output: <OUT_DIR>/new-analysis.json
 *
 * NOTE: this pass is intentionally broad (keyword OR-matching) and is only a
 * rough orientation aid — the subsystem counts OVERLAP heavily and must not be
 * read as mutually exclusive buckets. For precise, low-overlap problem families
 * use cluster-new.cjs instead; gen-reports.cjs consumes that output.
 */
const fs = require('fs');
const path = require('path');

// Resolve paths relative to this script so the toolkit is location-independent.
const OUT_DIR = __dirname;
const RAW_DIR = 'E:/test/rewrite-agently/dsh-disscu-cache/raw';
const START = 5886;

// Subsystem keyword rules (broad orientation pass)
const SUBSYSTEM_RULES = [
  { name: 'session-persistence', kw: [/session\s*log/i, /会话日志/, /seq\s*gap/i, /corrupt.*session/i, /session.*corrupt/i, /历史加载/, /history\s*load/i, /seq\s*冲突/, /SessionPersistence/, /jsonl\.zstd/i, /v0.*migration/i, /format\s*migration/i, /会话.*损坏/, /会话.*丢失/, /history.*unavailable/i, /observeSession/, /session.*unloadable/i] },
  { name: 'subagent', kw: [/subagent/i, /子代理/, /子 agent/i, /spawn.*child/i, /continuable.*child/i, /Agent\s*Teams/i, /orphan/i, /delegat/i] },
  { name: 'llm-streaming', kw: [/stream/i, /流式/, /pi-ai/i, /provider/, /reasoning/i, /developer\s*role/i, /tool.?call/i, /finish_reason/i, /gateway/i, /网关/i, /模型/, /model\s*catalog/i, /OpenRouter/i, /Codex/i, /OAuth/i, /API\s*key/i, /retry/i, /timeout/i, /断流/i, /速率限制|rate\s*limit/i] },
  { name: 'token-meter', kw: [/token/i, /tokenUsage/, /压缩|compaction|compact/i, /context\s*window/i, /上下文/, /cache.*hit/i, /usage.*anchor/i, /OOM.*heap/i, /预算|budget/i] },
  { name: 'filesystem', kw: [/file\s*system|filesystem/i, /路径|path/i, /Windows/i, /EPERM|EACCES|ENOENT|EISDIR|EDQUOT|ENOSPC/i, /symlink|junction|符号链接|软连接/i, /exFAT|FAT32|NTFS/i, /write\s*file/i, /read\s*file/i, /glob|ripgrep|rg\s*--/i, /BOM/i, /UTF-8|UTF16|UTF-16/i, /中文路径|GBK/i] },
  { name: 'web-server', kw: [/dsh\s*web|web\s*UI|Web\s*GUI/i, /localhost|loopback|127\.0\.0\.1/i, /token.*auth|认证|鉴权/i, /host\s*0\.0\.0\.0|绑定/i, /HTTP\s*40\d/i, /crypto\.randomUUID/i, /Firefox|Chrome|Safari|移动端|mobile/i, /RTL|i18n|locale|语言包/i, /PWA/i, /WebSocket|RPC|Remote/i, /端口|port/i] },
  { name: 'code-runtime', kw: [/run_code|bash|pwsh|PowerShell/i, /sandbox/i, /沙箱|权限|permission/i, /approval|审批/i, /tool.?call.*invalid|missing required property/i, /description.*required/i, /工具调用|tool\s*call/i, /escalation|提权/i, /headless|TUI|CLI/i, /workspace.?write|danger-full-access/i, /job_output|后台任务/i, /spill/i, /cwd/i, /插件加载|plugin\s*load|Loader/i] },
];

// Coarse content-type tags (also overlapping, orientation only)
const TYPE_RULES = [
  { name: 'bug', kw: [/\[BUG\]/i, /^Bug[:\s]/i, /bug\s*report/i, /\[Bug\s*Report\]/i, /报错|错误|失败|崩溃|crash|corrupt|broken|fails?\b/i, /不工作|无法|不能|失效|丢失|卡死|死循环/i] },
  { name: 'plugin-showcase', kw: [/Show\s*(and|&)\s*Tell/i, /Showcase/i, /^DSH\s*\|/i, /\[Plugin\]/i, /插件展示|插件预览/i, /^dsh-/i, /新插件|New plugin/i] },
  { name: 'rfc', kw: [/\[RFC\]/i, /^RFC[:\s]/i, /Proposal/i, /提案|建议增加|Feature\s*Request|\[Feature\]/i, /\[Idea\]/i] },
  { name: 'question', kw: [/\?$/, /如何|怎么|怎样|为什么|求助|请问/i, /How\s*(to|do|can)/i, /^\[Q&A\]/i] },
];

function classify(text, rules) {
  const hits = [];
  for (const r of rules) {
    for (const k of r.kw) {
      if (k.test(text)) { hits.push(r.name); break; }
    }
  }
  return hits;
}

function main() {
  const files = fs.readdirSync(RAW_DIR)
    .filter(f => /^\d+\.json$/.test(f))
    .map(f => ({ name: f, num: parseInt(f.replace('.json', '')) }))
    .filter(f => f.num >= START)
    .sort((a, b) => a.num - b.num);

  const discussions = [];
  for (const f of files) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(RAW_DIR, f.name), 'utf-8'));
      const text = `${d.title || ''}\n${d.body || ''}`;
      discussions.push({
        num: d.number,
        title: d.title || '',
        body: d.body || '',
        category: d.category || '',
        comments: d.comments_count || 0,
        created: d.created_at || '',
        state: d.state || '',
        url: d.url || '',
        subsystems: classify(text, SUBSYSTEM_RULES),
        types: classify(text, TYPE_RULES),
        bodyLen: (d.body || '').length,
      });
    } catch (e) { /* skip unparsable */ }
  }

  console.log(`Analyzed: ${discussions.length} discussions\n`);

  const subCount = {};
  for (const d of discussions) {
    if (d.subsystems.length === 0) subCount['unclassified'] = (subCount['unclassified'] || 0) + 1;
    for (const s of d.subsystems) subCount[s] = (subCount[s] || 0) + 1;
  }
  console.log('=== Subsystem Distribution (OVERLAPPING — orientation only) ===');
  Object.entries(subCount).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  const typeCount = {};
  for (const d of discussions) {
    if (d.types.length === 0) typeCount['other'] = (typeCount['other'] || 0) + 1;
    for (const t of d.types) typeCount[t] = (typeCount[t] || 0) + 1;
  }
  console.log('\n=== Type Distribution (OVERLAPPING — orientation only) ===');
  Object.entries(typeCount).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  const highQ = discussions.filter(d => d.bodyLen > 1500 && d.comments >= 3);
  console.log(`\n=== High Quality (>1500 chars, >=3 comments): ${highQ.length} ===`);

  fs.writeFileSync(
    path.join(OUT_DIR, 'new-analysis.json'),
    JSON.stringify({ discussions, subCount, typeCount }, null, 2),
    'utf-8'
  );
  console.log(`\nSaved: ${path.join(OUT_DIR, 'new-analysis.json')}`);
}

main();
