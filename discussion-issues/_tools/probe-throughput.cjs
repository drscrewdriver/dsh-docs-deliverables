#!/usr/bin/env node
/**
 * Throughput probe for the LAN vLLM endpoint (192.168.100.242:8200).
 * Fires N concurrent classification calls and reports aggregate tok/s so the
 * real classification job can be sized sensibly.
 *
 * Usage: node probe-throughput.cjs [concurrency] [calls]
 */
const BASE = 'http://192.168.100.242:8200';
const MODEL = 'Qwen3.6-35B-A3B';

const CONC = parseInt(process.argv[2] || '8', 10);
const CALLS = parseInt(process.argv[3] || '32', 10);

const PROMPT = (title, body) => `Classify this DeepSeek Harness community discussion post.

Title: ${title}
Body (excerpt): ${body}

Reply with JSON only:
{"primary_family":"<one id>","all_families":["<id>",...],"is_bug":true|false,"severity":"low|medium|high|critical","root_cause":"<=25 words"}`;

async function one(i, stats) {
  const t0 = Date.now();
  try {
    const r = await fetch(`${BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: 'You are a precise classifier for a software issue tracker. Output JSON only.' },
          { role: 'user', content: PROMPT(`probe-${i}`, 'A forked session inherits the parent pending inbox queue, so the child replays the parent next prompt.') },
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const ms = Date.now() - t0;
    stats.lat.push(ms);
    stats.ok++;
    stats.pt += j.usage?.prompt_tokens || 0;
    stats.ct += j.usage?.completion_tokens || 0;
    return ms;
  } catch (e) {
    stats.fail++;
    stats.errors.push(e.message);
    return null;
  }
}

async function main() {
  // warm-up
  await one(-1, { lat: [], ok: 0, fail: 0, pt: 0, ct: 0, errors: [] });

  const stats = { lat: [], ok: 0, fail: 0, pt: 0, ct: 0, errors: [] };
  const t0 = Date.now();
  let next = 0;
  async function worker() {
    while (next < CALLS) { const i = next++; await one(i, stats); }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  const wall = (Date.now() - t0) / 1000;

  stats.lat.sort((a, b) => a - b);
  const p = q => stats.lat[Math.floor(stats.lat.length * q)] || 0;
  console.log(`concurrency=${CONC}  calls=${CALLS}  wall=${wall.toFixed(1)}s`);
  console.log(`  ok=${stats.ok} fail=${stats.fail}`);
  console.log(`  latency p50=${p(0.5)}ms p90=${p(0.9)}ms max=${stats.lat[stats.lat.length - 1]}ms`);
  console.log(`  throughput: ${(stats.ok / wall).toFixed(2)} calls/s = ${(stats.ok / wall * 60).toFixed(0)} calls/min`);
  console.log(`  tokens: prompt=${stats.pt} completion=${stats.ct} total=${stats.pt + stats.ct}`);
  console.log(`  token rate: ${((stats.pt + stats.ct) / wall).toFixed(0)} tok/s`);
  if (stats.errors.length) console.log(`  errors: ${[...new Set(stats.errors)].slice(0, 5).join(' | ')}`);
  console.log(`\n  => full corpus 6321 docs at this rate: ${((6321 / (stats.ok / wall)) / 60).toFixed(1)} min`);
}

main();
