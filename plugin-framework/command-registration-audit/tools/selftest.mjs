#!/usr/bin/env node
/**
 * selftest.mjs — locks in the behaviour of both audit layers.
 *
 * Run:  node tools/selftest.mjs
 * Exit: 0 all assertions hold, 1 otherwise
 *
 * The interesting assertions are the two "layering" ones:
 *   - bad-const-description : L1 can only WARN (the value is an identifier),
 *                             L2 resolves it and reports the hard ERROR.
 *   - good-function-description : zero findings — no false positives.
 * A regex-only checker fails the first; a runtime-only checker is slow and
 * noisy, so both layers earn their place.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanStatic, runtimeProbe, validateRecords } from './dsh-command-contract-audit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (n) => path.join(here, 'fixtures', n, 'lib', 'client.js');

async function audit(file) {
  const findings = [];
  findings.push(...scanStatic(file).findings);
  const probe = runtimeProbe(file);
  if (probe.loadError) {
    findings.push({
      severity: 'WARN', code: 'RUNTIME_PROBE_INCONCLUSIVE', layer: 'L2',
      line: null, message: probe.loadError,
    });
  }
  validateRecords(file, probe, findings);
  await new Promise((r) => setTimeout(r, 30)); // let queued options() probes settle
  return { probe, findings };
}

const errCodes = (fs) => fs.filter((f) => f.severity === 'ERROR').map((f) => f.code);
const warnCodes = (fs) => fs.filter((f) => f.severity === 'WARN').map((f) => f.code);
const l2Errors = (fs) => fs.filter((f) => f.severity === 'ERROR' && f.layer === 'L2');

let passed = 0;
const failures = [];
function check(label, cond, detail = '') {
  if (cond) { passed++; console.log(`  ok    ${label}`); }
  else { failures.push(label); console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ''}`); }
}

console.log('dsh-command-contract-audit :: selftest\n');

/* ---- good: zero findings, registration captured and typed correctly ---- */
{
  const { probe, findings } = await audit(fixture('good-function-description'));
  console.log('good-function-description');
  check('L2 probe ran clean', probe.loadError === null, String(probe.loadError));
  check('captured exactly one registration', probe.records.length === 1, `got ${probe.records.length}`);
  check('captured api is register()', probe.records[0]?.api === 'register', String(probe.records[0]?.api));
  check('captured description is a function', typeof probe.records[0]?.v?.description === 'function');
  check('zero errors', errCodes(findings).length === 0, errCodes(findings).join(','));
  check('zero warnings', warnCodes(findings).length === 0, warnCodes(findings).join(','));
}

/* ---- the actual incident: string literal description ---- */
{
  const { probe, findings } = await audit(fixture('bad-string-description'));
  console.log('\nbad-string-description  (the dsh-free-search@0.4.24 defect)');
  check('L1 flags DESCRIPTION_IS_STRING', errCodes(findings).includes('DESCRIPTION_IS_STRING'));
  check('L2 flags the captured description', l2Errors(findings).some((f) => /description/.test(f.message)));
  check('captured description really is a string', typeof probe.records[0]?.v?.description === 'string');
  check('L2 message names the TypeError', l2Errors(findings).some((f) => /is not a function/.test(f.message)));
}

/* ---- the layering proof: constant-indirected string ---- */
{
  const { findings } = await audit(fixture('bad-const-description'));
  console.log('\nbad-const-description  (layering proof)');
  check('L1 produces NO error (statically undecidable)',
    !errCodes(findings).includes('DESCRIPTION_IS_STRING'),
    errCodes(findings).join(','));
  check('L1 warns DESCRIPTION_NOT_OBVIOUSLY_FUNCTION',
    warnCodes(findings).includes('DESCRIPTION_NOT_OBVIOUSLY_FUNCTION'));
  check('L2 still catches it as an error', l2Errors(findings).length > 0);
}

/* ---- decorate() misuse ---- */
{
  const { probe, findings } = await audit(fixture('bad-decorate-description'));
  console.log('\nbad-decorate-description');
  check('captured api is decorate()', probe.records[0]?.api === 'decorate', String(probe.records[0]?.api));
  check('L1 flags MISSING_AVAILABLE', errCodes(findings).includes('MISSING_AVAILABLE'));
  check('warns about the stray description field', warnCodes(findings).includes('DECORATION_HAS_DESCRIPTION'));
}

console.log(`\n${passed} passed, ${failures.length} failed`);
process.exitCode = failures.length === 0 ? 0 : 1;
