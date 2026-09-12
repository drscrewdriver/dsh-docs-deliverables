#!/usr/bin/env node
/**
 * Bug-classification TREND analysis across the WHOLE discussion corpus.
 *
 * Unlike cluster-new.cjs (which only looks at one increment), this classifies
 * every cached discussion (#13..#6442) with the same family rules and buckets it
 * by week, so emerging / declining / persistent problem families are visible.
 *
 * Input : <RAW_DIR>/<number>.json
 * Output: <OUT_DIR>/trend-data.json
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = __dirname;
const RAW_DIR = 'E:/test/rewrite-agently/dsh-disscu-cache/raw';

// Shared family rules (single source of truth).
const { FAMILIES, LEGACY_FAMILIES, ALL, matchFamilies, docText } = require('./families.cjs');

function isoWeekStart(dateStr) {
  // Bucket by 7-day window anchored at the corpus start (2026-08-13)
  const ANCHOR = Date.UTC(2026, 7, 13); // 2026-08-13
  const d = new Date(dateStr + 'T00:00:00Z').getTime();
  const idx = Math.floor((d - ANCHOR) / (7 * 86400000));
  return idx;
}

function main() {
  const files = fs.readdirSync(RAW_DIR)
    .filter(f => /^\d+\.json$/.test(f))
    .map(f => parseInt(f.replace('.json', '')))
    .sort((a, b) => a - b);

  const all = [];
  for (const n of files) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(RAW_DIR, `${n}.json`), 'utf-8'));
      const text = docText(d);
      all.push({
        num: n,
        title: d.title || '',
        created: (d.created_at || '').slice(0, 10),
        category: d.category || '',
        comments: d.comments_count || 0,
        bodyLen: (d.body || '').length,
        week: d.created_at ? isoWeekStart(d.created_at.slice(0, 10)) : -1,
        fams: matchFamilies(text, FAMILIES),
        legacy: matchFamilies(text, LEGACY_FAMILIES),
      });
    } catch (e) { /* skip */ }
  }

  // Week buckets
  const weekKeys = [...new Set(all.map(x => x.week))].filter(w => w >= 0).sort((a, b) => a - b);
  const weekLabels = {};
  for (const w of weekKeys) {
    const start = new Date(Date.UTC(2026, 7, 13) + w * 7 * 86400000);
    const end = new Date(start.getTime() + 6 * 86400000);
    weekLabels[w] = `${start.toISOString().slice(5, 10)}~${end.toISOString().slice(5, 10)}`;
  }

  const weekTotals = {};
  for (const w of weekKeys) weekTotals[w] = all.filter(x => x.week === w).length;

  // Per-family per-week counts
  const famTrend = {};
  for (const f of [...FAMILIES, ...LEGACY_FAMILIES]) {
    const key = f.id;
    const isLegacy = f.kw === LEGACY_FAMILIES.find(l => l.id === key)?.kw;
    famTrend[key] = { name: f.name, legacy: isLegacy, weeks: {} };
    for (const w of weekKeys) {
      const list = isLegacy
        ? all.filter(x => x.week === w && x.legacy.includes(key))
        : all.filter(x => x.week === w && x.fams.includes(key));
      famTrend[key].weeks[w] = list.length;
    }
  }

  // Batch comparison: baseline (#13..#5885) vs increment (#5886..#6442)
  const BASE_END = 5885;
  const cmp = {};
  for (const f of FAMILIES) {
    const b = all.filter(x => x.num <= BASE_END && x.fams.includes(f.id)).length;
    const i = all.filter(x => x.num > BASE_END && x.fams.includes(f.id)).length;
    cmp[f.id] = { name: f.name, baseline: b, increment: i, delta: i - b };
  }
  const legacyCmp = {};
  for (const f of LEGACY_FAMILIES) {
    const b = all.filter(x => x.num <= BASE_END && x.legacy.includes(f.id)).length;
    const i = all.filter(x => x.num > BASE_END && x.legacy.includes(f.id)).length;
    legacyCmp[f.id] = { name: f.name, baseline: b, increment: i, delta: i - b };
  }

  const out = {
    generatedAt: new Date().toISOString(),
    totalDiscussions: all.length,
    weekKeys, weekLabels, weekTotals,
    famTrend, cmp, legacyCmp,
    subset: { baseline: all.filter(x => x.num <= BASE_END).length, increment: all.filter(x => x.num > BASE_END).length },
    versionHistogram: (() => {
      const v = {};
      for (const x of all) {
        const m = (x.title + ' ' + '').match(/0\.1\.[0-9]+(?:-[a-z]+\.?[0-9]*)?/g) || [];
        for (const s of m) v[s] = (v[s] || 0) + 1;
      }
      return v;
    })(),
  };

  fs.writeFileSync(path.join(OUT_DIR, 'trend-data.json'), JSON.stringify(out, null, 2), 'utf-8');

  // Console summary
  console.log(`Corpus: ${all.length} discussions (#13..#6442)\n`);
  console.log('=== Weekly totals ===');
  for (const w of weekKeys) console.log(`  W${w} ${weekLabels[w]} : ${weekTotals[w]}`);

  console.log('\n=== NEW families: baseline vs increment (per-1k normalised) ===');
  const bN = out.subset.baseline, iN = out.subset.increment;
  console.log('  family                              base   inc   base/1k  inc/1k   ratio');
  Object.entries(cmp).sort((a, b) => (b[1].increment / iN) - (a[1].increment / bN)).forEach(([k, v]) => {
    const bRate = v.baseline / bN * 1000, iRate = v.increment / iN * 1000;
    const ratio = bRate > 0 ? (iRate / bRate) : Infinity;
    console.log(`  ${k.padEnd(34)} ${String(v.baseline).padStart(4)} ${String(v.increment).padStart(5)}   ${bRate.toFixed(1).padStart(6)}  ${iRate.toFixed(1).padStart(6)}   ${ratio === Infinity ? 'NEW' : ratio.toFixed(2) + 'x'}`);
  });

  console.log('\n=== LEGACY families: baseline vs increment ===');
  Object.entries(legacyCmp).sort((a, b) => b[1].baseline - a[1].baseline).forEach(([k, v]) => {
    const bRate = v.baseline / bN * 1000, iRate = v.increment / iN * 1000;
    const ratio = bRate > 0 ? (iRate / bRate) : Infinity;
    console.log(`  ${k.padEnd(34)} ${String(v.baseline).padStart(4)} ${String(v.increment).padStart(5)}   ${bRate.toFixed(1).padStart(6)}  ${iRate.toFixed(1).padStart(6)}   ${ratio === Infinity ? 'NEW' : ratio.toFixed(2) + 'x'}`);
  });

  console.log(`\nSaved: ${path.join(OUT_DIR, 'trend-data.json')}`);
}

main();
