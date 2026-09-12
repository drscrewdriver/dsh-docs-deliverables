#!/usr/bin/env node
/**
 * Canonicalise the open-ended `new_family` labels produced by llm-classify.cjs.
 *
 * The model invents a name per post, so the same underlying problem shows up
 * under many spellings (windows-path-truncation / win32-path-truncation /
 * native-picker-path-truncation / native-picker-utf16-truncation are ONE issue).
 * Raw counts are therefore useless without a semantic merge.
 *
 * This asks the same LLM to group the distinct labels into canonical clusters,
 * then writes new-family-canonical.json.
 *
 * The batch size is tiny (one distinct label per call, few hundred total), so
 * this is cheap compared with the main classification pass.
 *
 * Usage: node canon-new-families.cjs
 */
const fs = require('fs');
const path = require('path');

const BASE = 'http://192.168.100.242:8200';
const MODEL = 'Qwen3.6-35B-A3B';
const OUT_DIR = __dirname;
const JSONL = path.join(OUT_DIR, 'llm-classify.jsonl');
const OUT = path.join(OUT_DIR, 'new-family-canonical.json');

const MIN_COUNT = 2;   // labels appearing once carry no clustering signal
const CHUNK = 120;     // labels per LLM call

function loadLabels() {
  const rows = fs.readFileSync(JSONL, 'utf-8').split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch (e) { return null; } })
    .filter(Boolean)
    // Only bugs can define a new *problem* family; feature requests and
    // showcase posts are not problem clusters.
    .filter(r => r.is_bug && r.new_family);
  const m = {};
  for (const r of rows) m[r.new_family] = (m[r.new_family] || 0) + 1;
  return m;
}

async function groupChunk(labels) {
  const prompt = `Below are auto-generated kebab-case labels describing software problems. Many are SYNONYMS or near-duplicates for the same underlying issue.

## Labels
${labels.join('\n')}

## Task
Group them into canonical clusters. Return JSON only:
{"clusters":[{"canonical":"<short-kebab-name>","members":["<label>",...],"description":"<=20 words"}]}

Rules:
- Every input label must appear in exactly one cluster.
- Merge labels that describe the same underlying defect even if worded differently.
- Prefer concise, general canonical names over narrow ones.
- If a label stands alone and is genuinely distinct, give it its own cluster.`;

  const r = await fetch(`${BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are a taxonomist. Output valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    }),
    signal: AbortSignal.timeout(300000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  let s = (j.choices?.[0]?.message?.content || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  return JSON.parse(s).clusters || [];
}

async function main() {
  if (!fs.existsSync(JSONL)) { console.error('no llm-classify.jsonl'); process.exit(1); }
  const counts = loadLabels();
  const all = Object.keys(counts);
  const keep = all.filter(l => counts[l] >= MIN_COUNT);
  console.log(`distinct new_family labels: ${all.length}  (>=${MIN_COUNT} occurrences: ${keep.length})`);

  if (!keep.length) { console.log('nothing to cluster'); return; }

  const chunks = [];
  for (let i = 0; i < keep.length; i += CHUNK) chunks.push(keep.slice(i, i + CHUNK));

  const clusters = [];
  for (let i = 0; i < chunks.length; i++) {
    process.stdout.write(`  chunk ${i + 1}/${chunks.length} (${chunks[i].length} labels) ... `);
    try {
      const c = await groupChunk(chunks[i]);
      clusters.push(...c);
      console.log(`${c.length} clusters`);
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
    }
  }

  // Aggregate member counts
  const out = clusters.map(c => {
    const members = (c.members || []).filter(m => counts[m] !== undefined);
    return {
      canonical: String(c.canonical || '').trim(),
      description: String(c.description || '').trim(),
      posts: members.reduce((s, m) => s + counts[m], 0),
      members: members.map(m => ({ label: m, count: counts[m] })),
    };
  }).sort((a, b) => b.posts - a.posts);

  fs.writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    distinctLabels: all.length,
    clusteredLabels: keep.length,
    clusters: out,
  }, null, 2), 'utf-8');

  console.log(`\n=== canonical clusters (top 25 of ${out.length}) ===`);
  out.slice(0, 25).forEach(c => console.log(`  ${String(c.posts).padStart(4)}  ${c.canonical}  (${c.members.length} labels)`));
  console.log(`\nSaved: ${OUT}`);
}

main();
