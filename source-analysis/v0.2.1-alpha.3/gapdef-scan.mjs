// 0.2.1 a.1→a.2→a.3 定义变更类缝隙扫描
// 在 worktree .worktrees/dsh-021-gapcheck 内运行；用 git diff -U0 提取 export 符号增删
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PAIRS = [
  ['dsh-v0.2.1-alpha.1', 'dsh-v0.2.1-alpha.2'],
  ['dsh-v0.2.1-alpha.2', 'dsh-v0.2.1-alpha.3'],
];

const symRe = /^export\s+(?:declare\s+)?(?:default\s+)?(async\s+)?(?:function|const|let|var|class|interface|type|enum|abstract\s+class)\s+([A-Za-z0-9_$]+)/;
const starRe = /^export\s+\{([^}]*)\}/;

function symName(line) {
  let m = line.match(symRe);
  if (m) return m[2];
  m = starRe.exec(line);
  if (m) return m[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop()).join(',');
  m = line.match(/^export\s+\*\s+from/);
  if (m) return '*';
  return null;
}

const report = [];
for (const [a, b] of PAIRS) {
  const diff = execSync(`git diff -U0 --no-color ${a} ${b} -- packages apps`, {
    cwd: import.meta.dirname, maxBuffer: 1024 * 1024 * 512, encoding: 'utf8',
  });
  let file = '';
  const removed = new Map(); // pkg::sym -> files
  const added = new Map();
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('diff --git')) {
      const m = raw.match(/b\/(.+)$/);
      file = m ? m[1] : '';
      continue;
    }
    if (!/\.(?:[cm]?[jt]sx?)$/.test(file)) continue;
    if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file) || file.includes('/__tests__/') || file.includes('/vendor/')) continue;
    if (!raw.startsWith('-') && !raw.startsWith('+')) continue;
    if (raw.startsWith('---') || raw.startsWith('+++')) continue;
    const line = raw.slice(1).trim();
    if (!line.startsWith('export')) continue;
    const sym = symName(line);
    if (!sym) continue;
    const pkg = file.startsWith('packages/') ? file.split('/').slice(0, 2).join('/') : file.split('/')[0];
    const key = `${pkg}::${sym}`;
    const store = raw[0] === '-' ? removed : added;
    if (!store.has(key)) store.set(key, new Set());
    store.get(key).add(file);
  }
  // 缝隙 = 被删且对侧无同名新增
  const gaps = [];
  for (const [key, files] of removed) {
    if (!added.has(key)) gaps.push({ key, files: [...files].slice(0, 3) });
  }
  gaps.sort((x, y) => x.key.localeCompare(y.key));
  const byPkg = {};
  for (const g of gaps) {
    const pkg = g.key.split('::')[0];
    (byPkg[pkg] ??= []).push(g);
  }
  report.push(`\n########## ${a} -> ${b}  (removed-export gaps: ${gaps.length}, added-export count: ${added.size}) ##########`);
  for (const [pkg, gs] of Object.entries(byPkg)) {
    report.push(`\n### ${pkg} (${gs.length})`);
    for (const g of gs) report.push(`- ${g.key.split('::')[1]}  @${g.files.join(', ')}`);
  }
  // 同符号既删又加 = 形状可能变更，单独列
  const reshaped = [];
  for (const [key] of removed) if (added.has(key)) reshaped.push(key);
  report.push(`\n### [reshaped candidates] both removed & re-added in-window (${reshaped.length})`);
  for (const k of reshaped.sort()) report.push(`- ${k}`);
}
writeFileSync('_tmp-gapdef-report.md', report.join('\n'), 'utf8');
console.log('written _tmp-gapdef-report.md lines=', report.length);
