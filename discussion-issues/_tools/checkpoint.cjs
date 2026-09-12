#!/usr/bin/env node
/**
 * Checkpoint awareness — the "don't redo what a previous checkpoint covers"
 * mechanism.
 *
 * The user's standing rule: when processing a new batch, exclude everything the
 * previous checkpoint already covers. Relying on a human to remember the
 * boundary is exactly how a 62-minute full-corpus pass gets repeated for a
 * few-hundred-doc increment.
 *
 * Checkpoint layout:
 *   dsh-disscu-cache/checkpoints/<stamp>/ID-LIST.txt   "<number>\t<title>" per line
 *
 * Two distinct boundaries exist and must not be confused:
 *   - DATA boundary      : what has been PULLED   -> latest checkpoint's max id
 *   - ANALYSIS boundary  : what has been PROCESSED -> the results file's ids
 * The results file (e.g. llm-classify.jsonl) is the authoritative source for
 * "already analysed"; the checkpoint is the fallback when no results exist yet.
 */
const fs = require('fs');
const path = require('path');

const CHECKPOINT_DIR = 'E:/test/rewrite-agently/dsh-disscu-cache/checkpoints';

/** Parse "<number>\t<title>" lines, returning the numeric ids. */
function parseIdList(file) {
  if (!fs.existsSync(file)) return [];
  const ids = [];
  for (const line of fs.readFileSync(file, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const first = t.split('\t')[0].trim();
    if (/^\d+$/.test(first)) ids.push(parseInt(first, 10));
  }
  return ids;
}

/** All checkpoints, newest last (by directory mtime, falling back to name). */
function listCheckpoints() {
  if (!fs.existsSync(CHECKPOINT_DIR)) return [];
  return fs.readdirSync(CHECKPOINT_DIR)
    .map(name => {
      const full = path.join(CHECKPOINT_DIR, name);
      if (!fs.statSync(full).isDirectory()) return null;
      return { name, full, mtime: fs.statSync(full).mtimeMs };
    })
    .filter(Boolean)
    .sort((a, b) => (a.mtime - b.mtime) || a.name.localeCompare(b.name));
}

/**
 * Highest discussion number covered by the most recent checkpoint that has an
 * ID-LIST.txt. Returns 0 when no checkpoint exists (=> process everything).
 */
function latestCheckpointMaxId({ exclude } = {}) {
  const cps = listCheckpoints().filter(c => fs.existsSync(path.join(c.full, 'ID-LIST.txt')));
  // `exclude` lets the caller ignore the checkpoint it is about to write.
  const usable = exclude ? cps.filter(c => c.name !== exclude) : cps;
  for (let i = usable.length - 1; i >= 0; i--) {
    const ids = parseIdList(path.join(usable[i].full, 'ID-LIST.txt'));
    if (ids.length) {
      return { maxId: Math.max(...ids), count: ids.length, from: usable[i].name };
    }
  }
  return { maxId: 0, count: 0, from: null };
}

module.exports = { latestCheckpointMaxId, parseIdList, listCheckpoints, CHECKPOINT_DIR };

if (require.main === module) {
  const all = listCheckpoints();
  console.log(`checkpoints found: ${all.length}`);
  for (const c of all) {
    const f = path.join(c.full, 'ID-LIST.txt');
    const ids = parseIdList(f);
    console.log(ids.length
      ? `  ${c.name.padEnd(26)} ids=${String(ids.length).padStart(5)}  max=#${Math.max(...ids)}`
      : `  ${c.name.padEnd(26)} (no ID-LIST.txt)`);
  }
  const latest = latestCheckpointMaxId();
  console.log(`\n=> previous-boundary max id: #${latest.maxId}  (from ${latest.from || 'none'})`);
  console.log(`   process with:  --since ${latest.maxId}`);
}
