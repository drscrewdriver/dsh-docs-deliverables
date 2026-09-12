#!/usr/bin/env node
/**
 * LLM-based semantic classification of every cached DSH discussion.
 *
 * Replaces the regex heuristic in trend-analysis.cjs with a real model
 * (Qwen3.6-35B-A3B on the LAN vLLM at 192.168.100.242:8200).
 *
 * Design constraints:
 *  - RESUMABLE: appends one JSON object per line to llm-classify.jsonl and skips
 *    ids already present, so a killed run continues where it stopped.
 *  - BOUNDED CONCURRENCY: default 4. Measured on this endpoint, concurrency 4
 *    gives 147 calls/min while 16 collapses to 32 calls/min (queueing), so
 *    raising it makes the job slower and degrades the shared box.
 *  - VALIDATED: family ids are checked against the taxonomy; unknown ids are
 *    kept in `raw_family_new` (discovery channel) but never pollute `families`.
 *  - DUAL OUTPUT: fixed taxonomy (comparable with the regex trend) plus
 *    open-ended `new_family` so genuinely new clusters surface.
 *
 * Usage:
 *   node llm-classify.cjs [--concurrency 4] [--limit N] [--since N|auto|all]
 *
 * --since N    : skip every cached discussion with number <= N.
 * --since auto : (DEFAULT) derive N from the newest checkpoint's ID-LIST.txt,
 *                so only the increment after the previous checkpoint is
 *                processed. Duplicate work is the dominant cost here: a full
 *                6321-doc pass takes ~62 min while a typical increment is a few
 *                hundred docs.
 * --since all  : force a full re-processing (use after changing the taxonomy;
 *                also delete llm-classify.jsonl so stale ids are not skipped).
 *
 * Note the two boundaries are different: the RESULTS FILE (llm-classify.jsonl)
 * says what was analysed; the CHECKPOINT says what was pulled. Resume honours
 * both — an id is skipped if it is in either.
 */
const fs = require('fs');
const path = require('path');
const { latestCheckpointMaxId } = require('./checkpoint.cjs');

const BASE = 'http://192.168.100.242:8200';
const MODEL = 'Qwen3.6-35B-A3B';
const RAW_DIR = 'E:/test/rewrite-agently/dsh-disscu-cache/raw';
const OUT_DIR = __dirname;
const OUT_FILE = path.join(OUT_DIR, 'llm-classify.jsonl');

const args = process.argv.slice(2);
const argVal = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const CONC = parseInt(argVal('--concurrency', '4'), 10);
const LIMIT = parseInt(argVal('--limit', '0'), 10);
const SINCE_ARG = String(argVal('--since', 'auto')).toLowerCase();

// Taxonomy — same ids as the regex pass so the two are directly comparable.
const TAXONOMY = [
  ['session-migration', 'session log format migration failure (v0->v1->v2->v3); migration refuses a whole log'],
  ['session-history-unreadable', 'existing session/history cannot be loaded or opened after upgrade'],
  ['fork-inbox', 'session.fork / branch inherits the parent pending inbox or queued prompts'],
  ['windows-reveal', 'Windows "Show in File Explorer" / reveal-native-path silently does nothing'],
  ['web-startup-perf', 'dsh web startup slow; client-modules rebuild; commands/list CPU flood'],
  ['client-bundle-stale', 'after upgrade the web client bundle is stale; plugins do not activate'],
  ['persona-preset-break', 'persona/preset config field rename or preset mount failure'],
  ['malformed-toolcall', 'malformed or empty tool-call persisted, session permanently unrecoverable'],
  ['reasoning-loop', 'model reasoning degrades into a loop; empty/zero-output turn'],
  ['sandbox-windows', 'Windows sandbox, schannel TLS, proxy env vars, sandbox escalation/permissions'],
  ['composer-ime', 'composer editor: IME composition, browser translation, key handling'],
  ['web-process-death', 'dsh web process silently dies, OOM, PM2, import.meta.main'],
  ['npm-install-build', 'npm/pnpm install or build failure, native addon, node-gyp, Node version'],
  ['tool-visibility', 'tools or prompt sections lost between turns; tool registry drift'],
  ['legacy-session-corruption', 'session log corrupted by seq gap / concurrent writers / unclean exit'],
  ['legacy-auth-lan', 'web auth token, LAN/remote access, bind host'],
  ['legacy-context-compaction', 'auto-compaction fails or destroys history'],
  ['legacy-plugin-load-crash', 'one plugin failure takes down the whole app / plugin tree'],
  ['legacy-token-auth-pwa', 'PWA, mobile layout, locale/i18n, theme'],
  ['other', 'none of the above'],
];

const FAMILY_IDS = TAXONOMY.map(t => t[0]);
const TAX_TEXT = TAXONOMY.map(([id, d]) => `- ${id}: ${d}`).join('\n');

/**
 * Some cached discussions contain LONE SURROGATES (invalid UTF-16). JSON.stringify
 * emits them happily but the resulting bytes are not valid UTF-8, and the vLLM
 * tokenizer rejects the request with HTTP 400:
 *   "TextEncodeInput must be Union[TextInputSequence, ...]"
 * toWellFormed() replaces them with U+FFFD.
 *
 * ORDER MATTERS: truncation is what *creates* lone surrogates (slicing between
 * the two halves of an emoji), so sanitize must run AFTER slice, never before.
 * Sanitizing first, as this function originally did, fixes nothing.
 */
function sanitize(s) {
  const str = String(s ?? '');
  return typeof str.toWellFormed === 'function'
    ? str.toWellFormed()
    : str.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD');
}

function buildPrompt(d) {
  const body = sanitize(d.body.replace(/\s+/g, ' ').slice(0, 1200));
  return `You are classifying posts from the DeepSeek Harness (dsh) community forum.

## Problem families
${TAX_TEXT}

## Post
Number: #${d.number}
Category: ${sanitize(d.category || 'unknown')}
Title: ${sanitize(d.title)}
Body: ${body || '(empty)'}

## Task
Return JSON only, no prose, with this exact shape:
{"families":["<id>",...],"primary":"<id>","is_bug":true|false,"severity":"low|medium|high|critical","confidence":0.0-1.0,"root_cause":"<=25 words","new_family":null}

Rules:
- "families": every id that genuinely applies (can be several). Use "other" if none apply.
- "primary": the single best id.
- "is_bug": true only if the post reports a defect, crash, data loss or regression (not a feature request or showcase).
- "severity": critical=data loss/corruption/security, high=feature blocked or crash, medium=degraded, low=cosmetic.
- "new_family": if the post describes a coherent problem that fits NONE of the ids above, give it a short kebab-case name; otherwise null.`;
}

async function callLLM(d) {
  const r = await fetch(`${BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are a precise issue classifier. Output valid JSON only.' },
        { role: 'user', content: buildPrompt(d) },
      ],
      temperature: 0.1,
      max_tokens: 300,
    }),
    signal: AbortSignal.timeout(180000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  const txt = j.choices?.[0]?.message?.content || '';
  return { txt, usage: j.usage || {} };
}

function parseAndValidate(txt, d) {
  // Tolerate ```json fences and leading prose
  let s = txt.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  let o;
  try { o = JSON.parse(s); } catch (e) { throw new Error(`bad JSON: ${txt.slice(0, 120)}`); }

  const rawFams = Array.isArray(o.families) ? o.families : [];
  const families = [...new Set(rawFams.map(x => String(x).trim()).filter(x => FAMILY_IDS.includes(x)))];
  let primary = String(o.primary || '').trim();
  if (!FAMILY_IDS.includes(primary)) primary = families[0] || 'other';
  if (!families.includes(primary)) families.push(primary);

  const sev = ['low', 'medium', 'high', 'critical'];
  const severity = sev.includes(o.severity) ? o.severity : 'medium';

  const nf = o.new_family && String(o.new_family).trim() && String(o.new_family).trim() !== 'null'
    ? String(o.new_family).trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-')
    : null;

  return {
    families,
    primary,
    is_bug: o.is_bug === true,
    severity,
    confidence: typeof o.confidence === 'number' ? Math.max(0, Math.min(1, o.confidence)) : null,
    root_cause: (o.root_cause || '').toString().slice(0, 200),
    new_family: nf,
    rejected_families: rawFams.filter(x => !FAMILY_IDS.includes(String(x).trim())),
  };
}

function loadDone() {
  const done = new Set();
  if (!fs.existsSync(OUT_FILE)) return done;
  for (const line of fs.readFileSync(OUT_FILE, 'utf-8').split('\n')) {
    if (!line.trim()) continue;
    try { done.add(JSON.parse(line).number); } catch (e) { /* skip torn line */ }
  }
  return done;
}

async function main() {
  const files = fs.readdirSync(RAW_DIR).filter(f => /^\d+\.json$/.test(f))
    .map(f => parseInt(f.replace('.json', ''))).sort((a, b) => a - b);
  const docs = [];
  for (const n of files) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(RAW_DIR, `${n}.json`), 'utf-8'));
      docs.push({ number: n, title: d.title || '', body: d.body || '', category: d.category || '', created: (d.created_at || '').slice(0, 10) });
    } catch (e) { /* skip */ }
  }

  const done = loadDone();

  // Resolve the checkpoint boundary (default behaviour: skip prior coverage).
  let SINCE = 0, sinceFrom = 'none (full corpus)';
  if (SINCE_ARG === 'all' || SINCE_ARG === '0') {
    sinceFrom = 'explicitly disabled (--since all)';
  } else if (SINCE_ARG === 'auto') {
    const cp = latestCheckpointMaxId();
    SINCE = cp.maxId;
    sinceFrom = cp.from ? `checkpoint ${cp.from} (${cp.count} ids, max #${cp.maxId})` : 'no checkpoint found';
  } else {
    SINCE = parseInt(SINCE_ARG, 10) || 0;
    sinceFrom = `explicit (--since ${SINCE})`;
  }

  let todo = docs.filter(d => !done.has(d.number));
  // Increment-only mode: skip everything the previous checkpoint already covers,
  // so a new batch costs minutes instead of a full-corpus hour.
  if (SINCE > 0) todo = todo.filter(d => d.number > SINCE);
  if (LIMIT > 0) todo = todo.slice(0, LIMIT);

  console.log(`corpus=${docs.length}  already-analysed=${done.size}  todo=${todo.length}  concurrency=${CONC}`);
  console.log(`boundary: --since=${SINCE_ARG} -> #${SINCE}  [${sinceFrom}]`);
  if (!todo.length) {
    console.log('nothing to do — every cached discussion is already covered by the results file or the checkpoint.');
    console.log('to force a full re-run:  node llm-classify.cjs --since all   (and delete llm-classify.jsonl)');
  }
  if (!todo.length) { console.log('nothing to do'); return; }

  const out = fs.createWriteStream(OUT_FILE, { flags: 'a' });
  let idx = 0, ok = 0, fail = 0, pt = 0, ct = 0;
  const t0 = Date.now();
  const errors = [];

  async function worker() {
    while (true) {
      const my = idx++;
      if (my >= todo.length) return;
      const d = todo[my];
      let attempt = 0;
      while (attempt < 3) {
        attempt++;
        try {
          const { txt, usage } = await callLLM(d);
          pt += usage.prompt_tokens || 0; ct += usage.completion_tokens || 0;
          const cls = parseAndValidate(txt, d);
          out.write(JSON.stringify({
            number: d.number, created: d.created, category: d.category,
            title: d.title, is_bug: cls.is_bug, severity: cls.severity,
            primary: cls.primary, families: cls.families,
            confidence: cls.confidence, root_cause: cls.root_cause,
            new_family: cls.new_family,
            rejected_families: cls.rejected_families.length ? cls.rejected_families : undefined,
          }) + '\n');
          ok++;
          break;
        } catch (e) {
          if (attempt >= 3) { fail++; errors.push(`#${d.number}: ${e.message}`); }
          else await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
      const total = ok + fail;
      if (total % 200 === 0 && total > 0) {
        const el = (Date.now() - t0) / 1000;
        const rate = total / el;
        console.log(`  ${total}/${todo.length}  ok=${ok} fail=${fail}  ${rate.toFixed(2)} calls/s  elapsed=${(el / 60).toFixed(1)}min  eta=${((todo.length - total) / rate / 60).toFixed(1)}min`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONC }, worker));
  await new Promise(r => out.end(r));

  const el = (Date.now() - t0) / 1000;
  console.log(`\n=== done ===`);
  console.log(`  ok=${ok} fail=${fail}  wall=${(el / 60).toFixed(1)}min  rate=${(ok / el).toFixed(2)} calls/s`);
  console.log(`  tokens: prompt=${pt} completion=${ct}`);
  console.log(`  output: ${OUT_FILE}`);
  if (errors.length) console.log(`  errors (first 5): ${errors.slice(0, 5).join(' | ')}`);
}

main();
