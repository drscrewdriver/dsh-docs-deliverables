#!/usr/bin/env node
/**
 * dsh-command-contract-audit.mjs
 * ==============================
 * Client-side command-registration contract auditor for DSH plugins.
 *
 * Two layers:
 *   L1  static scan  -- dependency-free scanner that locates `commandUi.register()`
 *                       / `commandUi.decorate()` object literals and classifies the
 *                       `description` / `available` / `ui` fields.
 *   L2  runtime probe -- loads each client bundle inside a node:vm sandbox with a
 *                       recording `ctx`, actually calls `apply(ctx)`, and validates
 *                       the *captured* contribution objects. Catches what regex
 *                       cannot (const/imported/computed values, wrappers, minifiers).
 *
 * Contract (source of truth):
 *   @deepseek-ai/dsh-client-ui-commands/lib/types/client/contract.d.ts
 *     CommandContribution { name: string; description: () => string; available(s): boolean; ui: CommandUiSpec }
 *     CommandDecoration   { name: string; available(s): boolean; ui: CommandUiSpec }   // NO description
 *     CommandUiSpec       = PopupSelectSpec { kind:'popupSelect'; options; onSelect }
 *                         | ActionSpec       { kind:'action'; run }
 *
 * Why this exists:
 *   dsh-free-search@0.4.24 registered `description` as a *string*. ui-commands does
 *   zero validation at register() time; it only later evaluates
 *   `contribution.description()` while synthesising the slash-menu candidates, which
 *   throws `TypeError: contribution.description is not a function`. The rejection is
 *   swallowed by ui-input-trigger as a *source-level* failure, so the whole "command"
 *   candidate group is dropped and every slash command disappears from the menu.
 *   Silent at registration, catastrophic at first keystroke. This tool moves the
 *   detection to CI / pre-publish time.
 *
 * Usage:
 *   node dsh-command-contract-audit.mjs                     # scan every ~/.dsh/profiles/<name>
 *   node dsh-command-contract-audit.mjs --profile web
 *   node dsh-command-contract-audit.mjs --roots <dir> [<dir> ...]
 *   node dsh-command-contract-audit.mjs --static-only
 *   node dsh-command-contract-audit.mjs --include-official
 *   node dsh-command-contract-audit.mjs --json
 *
 * Exit codes: 0 = pass, 1 = at least one ERROR, 2 = usage / environment error
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

/* ------------------------------------------------------------------ *
 * 0. constants
 * ------------------------------------------------------------------ */

const VALID_UI_KINDS = new Set(['popupSelect', 'action']);
const VALID_OPTION_KEYS = new Set(['id', 'label', 'detail', 'active', 'confirmation']);
const SEV = { ERROR: 'ERROR', WARN: 'WARN', SKIP: 'SKIP' };

/* ------------------------------------------------------------------ *
 * 1. lexical helpers (string / comment / regex aware)
 * ------------------------------------------------------------------ */

function skipLineComment(s, i) {
  const n = s.indexOf('\n', i);
  return n < 0 ? s.length : n + 1;
}

function skipBlockComment(s, i) {
  const n = s.indexOf('*/', i + 2);
  return n < 0 ? s.length : n + 2;
}

function skipStringLit(s, i) {
  const q = s[i];
  i++;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') { i += 2; continue; }
    if (c === q) return i + 1;
    if (c === '\n' && q !== '`') return i; // unterminated
    i++;
  }
  return s.length;
}

function skipTemplate(s, i) {
  i++;
  let depth = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') { i += 2; continue; }
    if (depth === 0 && c === '`') return i + 1;
    if (c === '$' && s[i + 1] === '{') { depth++; i += 2; continue; }
    if (depth > 0) {
      if (c === '{') depth++;
      else if (c === '}') depth--;
      i++;
      continue;
    }
    i++;
  }
  return s.length;
}

/** Heuristic: is a `/` here the start of a regex literal rather than division? */
function regexAllowedAt(s, i) {
  for (let j = i - 1; j >= 0; j--) {
    const c = s[j];
    if (/\s/.test(c)) continue;
    return '(,=:[!&|?{};+-*%^~<>'.includes(c);
  }
  return true;
}

function skipRegex(s, i) {
  i++;
  let inClass = false;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '\n') return i;
    if (inClass) { if (c === ']') inClass = false; i++; continue; }
    if (c === '[') { inClass = true; i++; continue; }
    if (c === '/') { i++; while (i < s.length && /[a-z]/i.test(s[i])) i++; return i; }
    i++;
  }
  return s.length;
}

/** Advance past one non-code chunk, or return i unchanged when s[i] is code. */
function skipNonCode(s, i) {
  const c = s[i];
  if (c === '/' && s[i + 1] === '/') return skipLineComment(s, i);
  if (c === '/' && s[i + 1] === '*') return skipBlockComment(s, i);
  if (c === '"' || c === "'") return skipStringLit(s, i);
  if (c === '`') return skipTemplate(s, i);
  if (c === '/' && regexAllowedAt(s, i)) return skipRegex(s, i);
  return i;
}

/**
 * Skip whitespace and comments ONLY.
 * Deliberately does NOT consume string/template/regex literals: those are
 * *values*, and swallowing them here would make the caller read past the value
 * it is about to parse. (`skipNonCode` is the string-eating variant, used by
 * the balanced matchers.)
 */
function skipWsAndComments(s, i) {
  for (;;) {
    if (s[i] === '/' && s[i + 1] === '/') { i = skipLineComment(s, i); continue; }
    if (s[i] === '/' && s[i + 1] === '*') { i = skipBlockComment(s, i); continue; }
    if (i < s.length && /\s/.test(s[i])) { i++; continue; }
    return i;
  }
}

const PAIRS = { '(': ')', '[': ']', '{': '}' };

/** Index just past the matching closer for the opener at `i`, or -1. */
function matchBalanced(s, i) {
  const open = s[i];
  const close = PAIRS[open];
  if (close === undefined) return -1;
  let depth = 0;
  while (i < s.length) {
    const j = skipNonCode(s, i);
    if (j !== i) { i = j; continue; }
    const c = s[i];
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return i + 1; }
    i++;
  }
  return -1;
}

/** End index (exclusive) of the value starting at `i`, stopping at a depth-0 comma/closer. */
function readValueEnd(s, i) {
  let depth = 0;
  while (i < s.length) {
    const j = skipNonCode(s, i);
    if (j !== i) { i = j; continue; }
    const c = s[i];
    if ('([{'.includes(c)) { depth++; i++; continue; }
    if (')]}'.includes(c)) {
      if (depth === 0) return i;
      depth--; i++; continue;
    }
    if (c === ',' && depth === 0) return i;
    i++;
  }
  return s.length;
}

/* ------------------------------------------------------------------ *
 * 2. object-literal property parsing
 * ------------------------------------------------------------------ */

/** Parse the *top level* properties of an object body (text between the braces). */
function parseTopLevelProps(body) {
  const props = [];
  let i = 0;
  const n = body.length;
  while (i < n) {
    i = skipWsAndComments(body, i);
    if (i >= n) break;
    if (body[i] === ',') { i++; continue; }

    // spread element
    if (body[i] === '.' && body[i + 1] === '.' && body[i + 2] === '.') {
      i = skipWsAndComments(body, i + 3);
      const ve = readValueEnd(body, i);
      props.push({ key: '...spread', raw: body.slice(i, ve), spread: true });
      i = skipWsAndComments(body, ve);
      if (body[i] === ',') i++;
      continue;
    }

    // key
    let key = null;
    const c = body[i];
    if (c === '"' || c === "'" || c === '`') {
      const e = skipStringLit(body, i);
      key = body.slice(i + 1, Math.max(i + 1, e - 1));
      i = e;
    } else if (c === '[') {
      const e = matchBalanced(body, i);
      if (e < 0) break;
      key = body.slice(i, e);
      i = e;
    } else if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < n && /[\w$]/.test(body[j])) j++;
      key = body.slice(i, j);
      i = j;
    } else {
      break; // unexpected — bail out rather than mis-parse
    }

    i = skipWsAndComments(body, i);
    if (body[i] !== ':') {
      // shorthand / method
      props.push({ key, raw: key, shorthand: true });
      const ve = readValueEnd(body, i);
      i = skipWsAndComments(body, ve);
      if (body[i] === ',') i++;
      continue;
    }
    i = skipWsAndComments(body, i + 1); // skip ':'
    const valStart = i;
    const valEnd = readValueEnd(body, i);
    props.push({
      key,
      raw: body.slice(valStart, valEnd),
      valStart,
      valEnd,
      computed: /^\[/.test(body.slice(0, valStart).trim().slice(-1)),
    });
    i = skipWsAndComments(body, valEnd);
    if (body[i] === ',') i++;
  }
  return props;
}

/** Properties of the object literal found at/after `i`. */
function readObjectAt(s, i) {
  i = skipWsAndComments(s, i);
  if (s[i] === '(') {
    const e = matchBalanced(s, i);
    if (e < 0) return null;
    return readObjectAt(s, i + 1);
  }
  if (s[i] !== '{') return null;
  const e = matchBalanced(s, i);
  if (e < 0) return null;
  return { body: s.slice(i + 1, e - 1), start: i, end: e };
}

/* ------------------------------------------------------------------ *
 * 3. value classification
 * ------------------------------------------------------------------ */

function isArrowAfterParen(s) {
  let i = 0;
  const am = /^async\b/.exec(s);
  if (am) i = am[0].length;
  i = skipWsAndComments(s, i);
  if (s[i] !== '(') return false;
  const e = matchBalanced(s, i);
  if (e < 0) return false;
  i = skipWsAndComments(s, e);
  return s[i] === '=' && s[i + 1] === '>';
}

/**
 * @returns {'function'|'string-literal'|'template'|'identifier'|'number'|'literal'|'other'|'missing'}
 */
function classifyValue(raw) {
  const s = (raw ?? '').trim();
  if (!s) return 'missing';
  if (/^["']/.test(s)) return 'string-literal';
  if (/^`/.test(s)) {
    const e = skipTemplate(s, 0);
    const inner = s.slice(1, Math.max(1, e - 1));
    return /\$\{/.test(inner) ? 'template' : 'string-literal';
  }
  if (/^(async\s+)?function\b/.test(s)) return 'function';
  if (/^async\b/.test(s)) return isArrowAfterParen(s) ? 'function' : 'other';
  if (s[0] === '(') return isArrowAfterParen(s) ? 'function' : 'other';
  if (/^[A-Za-z_$][\w$]*\s*=>/.test(s)) return 'function';
  if (/^(true|false|null|undefined|void)\b/.test(s)) return 'literal';
  if (/^-?(\d|\.\d)/.test(s)) return 'number';
  if (/^[A-Za-z_$][\w$]*$/.test(s)) return 'identifier';
  if (s[0] === '{' || s[0] === '[') return 'other';
  return 'other';
}

const FN_LIKE = new Set(['function']);

/* ------------------------------------------------------------------ *
 * 4. L1 — static scan
 * ------------------------------------------------------------------ */

/** Variable names bound to the commandUi service inside one source text. */
function findCommandUiBindings(src) {
  const names = new Set(['commandUi', 'command']);
  const re = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;\n]{0,200}?\.get\(\s*["']commandUi["']\s*\)/g;
  let m;
  while ((m = re.exec(src))) names.add(m[1]);
  // `const { commandUi } = ctx` style destructuring
  const re2 = /\b(?:const|let|var)\s*\{([^}]*)\}\s*=\s*[^;\n]{0,120}/g;
  while ((m = re2.exec(src))) {
    for (const part of m[1].split(',')) {
      const nm = part.split(':').pop().trim();
      if (nm === 'commandUi') names.add(nm);
    }
  }
  return names;
}

function scanStatic(clientFile) {
  const src = fs.readFileSync(clientFile, 'utf8');
  const findings = [];
  const sites = [];
  if (!src.includes('commandUi')) return { sites, findings, touchesCommandUi: false };

  const bindings = findCommandUiBindings(src);
  const re = /([A-Za-z_$][\w$]*)\s*\.\s*(register|decorate)\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    const receiver = m[1];
    const api = m[2];
    const openParen = m.index + m[0].length - 1;
    const closeParen = matchBalanced(src, openParen);
    if (closeParen < 0) continue;
    const args = src.slice(openParen + 1, closeParen - 1);
    const obj = readObjectAt(args, 0);
    if (!obj) continue;
    const props = parseTopLevelProps(obj.body);
    const uiProp = props.find((p) => p.key === 'ui');
    const looksLikeCommand = receiver === 'commandUi' ||
      bindings.has(receiver) ||
      (uiProp !== undefined && /kind\s*:\s*["'](popupSelect|action)["']/.test(uiProp.raw));
    if (!looksLikeCommand) continue;

    const line = src.slice(0, m.index).split('\n').length;
    const site = { api, receiver, line, file: clientFile, props: {} };
    sites.push(site);

    const desc = props.find((p) => p.key === 'description');
    const avail = props.find((p) => p.key === 'available');
    const nameP = props.find((p) => p.key === 'name');

    site.props.name = nameP ? nameP.raw.trim().replace(/^["'`]|["'`]$/g, '') : null;
    site.props.uiKind = uiProp ? (/kind\s*:\s*["'](\w+)["']/.exec(uiProp.raw)?.[1] ?? null) : null;

    if (api === 'register') {
      if (!desc) {
        findings.push(mk('ERROR', clientFile, line, 'MISSING_DESCRIPTION',
          'register() contribution has no `description`; the contract requires `() => string`.'));
      } else {
        const kind = classifyValue(desc.raw);
        site.props.descriptionKind = kind;
        if (kind === 'string-literal') {
          findings.push(mk('ERROR', clientFile, line, 'DESCRIPTION_IS_STRING',
            `description is a string literal (${JSON.stringify(trunc(desc.raw))}). ` +
            'ui-commands evaluates `contribution.description()` at candidate time -> ' +
            'TypeError: contribution.description is not a function.'));
        } else if (kind !== 'function') {
          findings.push(mk('WARN', clientFile, line, 'DESCRIPTION_NOT_OBVIOUSLY_FUNCTION',
            `description value classified as "${kind}" (${JSON.stringify(trunc(desc.raw))}); ` +
            'statically undecidable — verify with the L2 runtime probe.'));
        }
      }
      if (!avail) {
        findings.push(mk('ERROR', clientFile, line, 'MISSING_AVAILABLE',
          'register() contribution has no `available(session)`; candidates() calls it unconditionally.'));
      } else if (!FN_LIKE.has(classifyValue(avail.raw))) {
        findings.push(mk('WARN', clientFile, line, 'AVAILABLE_NOT_FUNCTION',
          `available classified as "${classifyValue(avail.raw)}"; must be a function.`));
      }
    } else {
      // decorate(): CommandDecoration has NO description field
      if (desc) {
        findings.push(mk('WARN', clientFile, line, 'DECORATION_HAS_DESCRIPTION',
          'CommandDecoration has no `description` field; a decoration never manufactures a row. ' +
          'This field is dead weight (and a smell that register() was intended).'));
      }
      if (!avail) {
        findings.push(mk('ERROR', clientFile, line, 'MISSING_AVAILABLE',
          'decorate() decoration has no `available(session)`; the bare-invocation path calls it.'));
      }
    }

    if (uiProp) {
      const uiObj = readObjectAt(uiProp.raw, 0);
      const uiProps = uiObj ? parseTopLevelProps(uiObj.body) : [];
      const kindProp = uiProps.find((p) => p.key === 'kind');
      const kind = kindProp ? kindProp.raw.trim().replace(/^["'`]|["'`]$/g, '') : null;
      if (!kind || !VALID_UI_KINDS.has(kind)) {
        findings.push(mk('ERROR', clientFile, line, 'BAD_UI_KIND',
          `ui.kind is ${kind === null ? 'missing' : JSON.stringify(kind)}; expected one of ${[...VALID_UI_KINDS].join(' | ')}.`));
      } else if (kind === 'popupSelect') {
        for (const req of ['options', 'onSelect']) {
          if (!uiProps.some((p) => p.key === req)) {
            findings.push(mk('ERROR', clientFile, line, 'POPUPSELECT_MISSING_' + req.toUpperCase(),
              `ui.kind === "popupSelect" requires a "${req}" member.`));
          }
        }
      } else if (kind === 'action') {
        if (!uiProps.some((p) => p.key === 'run')) {
          findings.push(mk('ERROR', clientFile, line, 'ACTION_MISSING_RUN',
            'ui.kind === "action" requires a "run" member.'));
        }
      }
    } else {
      findings.push(mk('ERROR', clientFile, line, 'MISSING_UI',
        'contribution has no `ui` spec; candidates() -> dispatch() needs one to route the pick.'));
    }
  }
  return { sites, findings, touchesCommandUi: true };
}

function trunc(s, n = 60) {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

function mk(severity, file, line, code, message) {
  return { severity, file, line, code, message, layer: 'L1' };
}

/* ------------------------------------------------------------------ *
 * 5. L2 — runtime sandbox probe
 * ------------------------------------------------------------------ */

/**
 * Universal stand-in for an unavailable module/service/property.
 * Callable, constructible, arbitrarily indexable, never a thenable.
 * Identity is stable per path, so `a.Service === a.Service` holds.
 */
const MAGIC_CACHE = new Map();
const MAGIC_TAG = Symbol.for('dsh.command-audit.magic');

/**
 * Fallback prototype installed under every mock.
 *
 * esbuild's `__toESM(react, 1)` helper rebuilds a module as
 * `Object.create(Object.getPrototypeOf(mod))` and then copies only the *own*
 * enumerable properties. A bare mock function owns nothing but
 * `length`/`name`/`prototype`, so `react.memo` would come back `undefined`.
 * Answering every property on the prototype instead keeps named exports alive
 * through that transform.
 */
let MAGIC_PROTO = null;
function magicProto() {
  if (MAGIC_PROTO === null) {
    MAGIC_PROTO = new Proxy(Object.create(null), {
      get(_t, k) {
        if (k === 'then') return undefined;
        if (k === Symbol.toPrimitive) return () => 0;
        if (typeof k === 'symbol') return undefined;
        return magicFor('[module].' + String(k));
      },
      has() { return true; },
      set() { return true; },
    });
  }
  return MAGIC_PROTO;
}

function magicFor(name) {
  if (MAGIC_CACHE.has(name)) return MAGIC_CACHE.get(name);
  const fn = function () { return magic; };
  const magic = new Proxy(fn, {
    get(_t, k) {
      if (k === MAGIC_TAG) return true;                    // identifies a mock value
      if (k === 'then') return undefined;                  // never a thenable
      if (typeof k === 'symbol') {
        if (k === Symbol.toPrimitive) return () => 0;
        if (k === Symbol.toStringTag) return name;
        if (k === Symbol.iterator) {
          return function* () { for (;;) yield magicFor(name + '[]'); };
        }
        return undefined;
      }
      if (k === 'name') return name;
      if (k === 'length') return 0;
      if (k === 'prototype') return {};
      if (k === '__esModule') return true;
      if (k === 'toString') return () => `[mock ${name}]`;
      return magicFor(name + '.' + String(k));
    },
    apply() { return magicFor(name + '()'); },
    construct() { return magicFor('new ' + name); },
    getPrototypeOf() { return magicProto(); },
    has() { return true; },
    set() { return true; },
  });
  MAGIC_CACHE.set(name, magic);
  return magic;
}

/** True when a value is one of our mocks — i.e. the real value was unavailable. */
function isMagic(v) {
  if (v === null || v === undefined) return false;
  const t = typeof v;
  if (t !== 'function' && t !== 'object') return false;
  try { return v[MAGIC_TAG] === true; } catch { return false; }
}

/** Permissive DOM element stub: any read works, any write is accepted. */
function makeElementMock(tag = 'div') {
  const name = String(tag).toUpperCase();
  const target = {
    tagName: name, nodeName: name,
    style: {}, dataset: {}, attributes: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    children: [], childNodes: [],
    textContent: '', innerHTML: '', innerText: '', id: '', className: '',
    setAttribute() {}, removeAttribute() {}, getAttribute: () => null, hasAttribute: () => false,
    appendChild() {}, removeChild() {}, insertBefore() {}, replaceChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
    getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }),
    focus() {}, blur() {}, click() {}, scrollIntoView() {},
    querySelector: () => null, querySelectorAll: () => [],
    cloneNode: () => makeElementMock(tag),
    contains: () => false,
  };
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'then') return undefined;
      if (typeof k === 'symbol') return undefined;
      return magicFor(`element.${String(k)}`);
    },
    set(t, k, v) { t[k] = v; return true; },
    has() { return true; },
  });
}

function buildSandbox(entries) {
  const win = {
    __ModuleLoader__: { load(entry) { entries.push(entry); } },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    getComputedStyle: () => ({}),
    location: { href: 'http://localhost/', origin: 'http://localhost', protocol: 'http:', host: 'localhost', pathname: '/' },
    navigator: { userAgent: 'dsh-command-contract-audit', language: 'en', languages: ['en'] },
    requestAnimationFrame: (cb) => { void cb; return 0; },
    cancelAnimationFrame() {},
  };
  const documentMock = {
    head: makeElementMock('head'),
    body: makeElementMock('body'),
    documentElement: makeElementMock('html'),
    createElement: (tag) => makeElementMock(tag),
    createTextNode: () => ({ textContent: '' }),
    createDocumentFragment: () => makeElementMock('fragment'),
    querySelector: () => null, querySelectorAll: () => [],
    getElementById: () => null, getElementsByTagName: () => [],
    addEventListener() {}, removeEventListener() {},
    readyState: 'complete', title: '', cookie: '',
  };
  const sandbox = {
    window: win,
    self: win,
    document: documentMock,
    navigator: win.navigator,
    location: win.location,
    console,
    setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
    requestAnimationFrame: win.requestAnimationFrame,
    cancelAnimationFrame: win.cancelAnimationFrame,
    fetch: async () => ({ ok: false, status: 0, json: async () => ({}), text: async () => '' }),
    AbortController, AbortSignal, TextEncoder, TextDecoder, URL, URLSearchParams, structuredClone,
  };
  sandbox.globalThis = sandbox;
  return sandbox;
}

function makeRequireShim() {
  const react = magicFor('react');
  const jsx = {
    jsx: () => null, jsxs: () => null, Fragment: Symbol.for('react.fragment'),
    createElement: () => null,
  };
  return (id) => {
    if (id === 'react') return react;
    if (id === 'react/jsx-runtime' || id === 'react/jsx-dev-runtime') return jsx;
    return magicFor(`require(${id})`);
  };
}

function runtimeProbe(clientFile) {
  const src = fs.readFileSync(clientFile, 'utf8');
  const records = [];
  const problems = [];
  const entries = [];

  const recorder = {
    register(c) { records.push({ api: 'register', v: c }); return () => {}; },
    decorate(d) { records.push({ api: 'decorate', v: d }); return () => {}; },
    popupFor() { return magicFor('popup'); },
  };

  const makeCtx = (label) => {
    const slots = {
      inject(_name, cb) { if (typeof cb === 'function') { try { cb(); } catch (e) { problems.push(`${label}: slots.inject -> ${e && e.message}`); } } return () => {}; },
      register() { return () => {}; },
      order() { return () => {}; },
      entries: () => [],
      values: () => [],
      keys: () => [],
      get: () => undefined,
      has: () => false,
      delete: () => false,
      [Symbol.iterator]: () => [][Symbol.iterator](),
    };
    const locale = { register() {}, bind: () => magicFor('t'), get: () => magicFor('locale.get') };
    const inputTriggers = { registerSource: () => () => {}, get: () => undefined };
    const base = {
      get(name) {
        if (name === 'commandUi') return recorder;
        if (name === 'slots') return slots;
        if (name === 'locale') return locale;
        if (name === 'inputTriggers') return inputTriggers;
        return magicFor(`ctx.get(${name})`);
      },
      effect(fn, _lbl) {
        try { const d = fn(); if (typeof d === 'function') d; } catch (e) { problems.push(`${label}: effect -> ${e && e.message}`); }
        return () => {};
      },
      inject(_deps, cb) {
        const scope = makeCtx(label + '>inject');
        if (typeof cb === 'function') {
          try { cb(scope); } catch (e) { problems.push(`${label}: inject callback -> ${e && e.message}`); }
        }
        return scope;
      },
      on() { return () => {}; },
      $on() { return () => {}; },
      bail() { return true; },
      slots, locale, inputTriggers, commandUi: recorder,
    };
    return new Proxy(base, {
      get(t, k) {
        if (k in t) return t[k];
        if (k === 'then') return undefined;
        return magicFor(`ctx.${String(k)}`);
      },
      has() { return true; },
    });
  };

  const sandbox = buildSandbox(entries);
  const ctxObj = vm.createContext(sandbox);
  let loadError = null;
  let exportsObj = null;

  try {
    vm.runInContext(src, ctxObj, { filename: clientFile, timeout: 10000 });
  } catch (e) {
    loadError = `module evaluation failed: ${e && e.message}`;
  }

  if (!loadError && entries.length === 0) {
    loadError = 'no window.__ModuleLoader__.load() call found (not a DSH client bundle?)';
  }

  if (!loadError) {
    try {
      exportsObj = entries[0].factory(makeRequireShim());
    } catch (e) {
      loadError = `factory() threw: ${e && e.message}${where(e)}`;
    }
  }

  if (!loadError) {
    const apply = exportsObj && exportsObj.apply;
    if (typeof apply !== 'function') {
      loadError = 'bundle exports no apply(ctx) function';
    } else {
      try {
        apply(makeCtx('apply'));
      } catch (e) {
        loadError = `apply() threw: ${e && e.message}${where(e)}`;
      }
    }
  }

  return { records, problems, loadError, inject: exportsObj && exportsObj.inject };
}

function validateRecords(clientFile, probe, findings) {
  const records = probe.records || [];
  for (const rec of records) {
    const v = rec.v;
    const code = rec.api === 'register' ? 'RUNTIME_REGISTER' : 'RUNTIME_DECORATE';
    if (v === null || typeof v !== 'object') {
      findings.push(mk2('ERROR', clientFile, code, `${rec.api}() received a non-object (${typeof v}).`));
      continue;
    }
    const name = v.name;
    if (typeof name !== 'string' || name.length === 0) {
      findings.push(mk2('ERROR', clientFile, code, `${rec.api}() contribution name is not a non-empty string (${JSON.stringify(name)}).`));
    }
    if (rec.api === 'register') {
      if (!('description' in v)) {
        findings.push(mk2('ERROR', clientFile, code, `contribution /${name} has no \`description\`; contract requires () => string.`));
      } else if (typeof v.description !== 'function') {
        findings.push(mk2('ERROR', clientFile, code,
          `contribution /${name} (${rec.v && rec.v.name}) \`description\` is ${typeof v.description} ` +
          `(${JSON.stringify(trunc(String(v.description)))}) but MUST be a function. ` +
          'At candidate time ui-commands runs contribution.description() -> ' +
          'TypeError: contribution.description is not a function.'));
      } else {
        try {
          const out = v.description();
          if (typeof out !== 'string') {
            if (isMagic(out)) {
              findings.push(mk2('WARN', clientFile, code,
                `/${name}: description() returned a mocked value — the real localizer is unavailable in the sandbox, so the return type is unproven (not a violation).`));
            } else {
              findings.push(mk2('ERROR', clientFile, code, `/${name}: description() returned ${typeof out}, expected string.`));
            }
          }
        } catch (e) {
          findings.push(mk2('ERROR', clientFile, code, `/${name}: description() threw: ${e && e.message}`));
        }
      }
    } else if ('description' in v) {
      findings.push(mk2('WARN', clientFile, code,
        `decoration /${name} carries a \`description\`; CommandDecoration has no such field.`));
    }

    if (typeof v.available !== 'function') {
      findings.push(mk2('ERROR', clientFile, code,
        `${rec.api}() ${name ? '/' + name : ''} \`available\` is ${typeof v.available}; candidates() calls available(session) unconditionally.`));
    } else {
      try {
        const r = v.available(magicFor('session'));
        if (typeof r !== 'boolean' && !isMagic(r)) {
          findings.push(mk2('WARN', clientFile, code, `/${name}: available() returned ${typeof r} (expected boolean).`));
        }
      } catch (e) {
        findings.push(mk2('ERROR', clientFile, code, `/${name}: available() threw: ${e && e.message}`));
      }
    }

    const ui = v.ui;
    if (ui === null || typeof ui !== 'object') {
      findings.push(mk2('ERROR', clientFile, code, `/${name}: \`ui\` is ${ui === null ? 'null' : typeof ui}; a CommandUiSpec is required.`));
      continue;
    }
    if (!VALID_UI_KINDS.has(ui.kind)) {
      findings.push(mk2('ERROR', clientFile, code,
        `/${name}: ui.kind is ${JSON.stringify(ui.kind)}; expected ${[...VALID_UI_KINDS].join(' | ')}.`));
      continue;
    }
    if (ui.kind === 'popupSelect') {
      for (const req of ['options', 'onSelect']) {
        if (typeof ui[req] !== 'function') {
          findings.push(mk2('ERROR', clientFile, code, `/${name}: popupSelect.ui.${req} is ${typeof ui[req]}; must be a function.`));
        }
      }
      if (typeof ui.options === 'function') {
        let p;
        try { p = ui.options(magicFor('session'), magicFor('signal')); } catch (e) { p = Promise.reject(e); }
        Promise.resolve(p).then(
          (rows) => {
            if (!Array.isArray(rows)) {
              if (isMagic(rows)) {
                findings.push(mk2('WARN', clientFile, code, `/${name}: options() returned a mocked value — real deps unavailable, shape unproven (not a violation).`));
              } else {
                findings.push(mk2('ERROR', clientFile, code, `/${name}: options() resolved to ${typeof rows}; expected an array.`));
              }
              return;
            }
            for (const row of rows) {
              if (!row || typeof row !== 'object') {
                findings.push(mk2('ERROR', clientFile, code, `/${name}: options() yielded a non-object row.`));
                continue;
              }
              for (const k of Object.keys(row)) {
                if (!VALID_OPTION_KEYS.has(k)) {
                  findings.push(mk2('WARN', clientFile, code, `/${name}: SelectOption has unknown key "${k}".`));
                }
              }
              if (typeof row.id !== 'string' || typeof row.label !== 'string') {
                findings.push(mk2('ERROR', clientFile, code, `/${name}: SelectOption requires string id + label (got ${JSON.stringify(row.id)} / ${JSON.stringify(row.label)}).`));
              }
            }
          },
          (e) => findings.push(mk2('WARN', clientFile, code, `/${name}: options() rejected under the mock (often expected; needs live deps): ${e && e.message}`)),
        );
      }
    } else if (typeof ui.run !== 'function') {
      findings.push(mk2('ERROR', clientFile, code, `/${name}: action.ui.run is ${typeof ui.run}; must be a function.`));
    }
  }
}

function mk2(severity, file, code, message) {
  return { severity, file, line: null, code, message, layer: 'L2' };
}

function where(e) {
  const line = e && e.stack ? String(e.stack).split('\n')[1] : '';
  return line ? ` [${line.trim()}]` : '';
}

/* ------------------------------------------------------------------ *
 * 6. discovery
 * ------------------------------------------------------------------ */

function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function listPackageDirs(root) {
  const out = [];
  if (!isDir(root)) return out;
  for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
    if (ent.name === '.bin' || ent.name.startsWith('.')) continue;
    const p = path.join(root, ent.name);
    if (!isDir(p)) continue;
    if (ent.name.startsWith('@')) {
      for (const s of fs.readdirSync(p, { withFileTypes: true })) {
        const sp = path.join(p, s.name);
        if (isDir(sp)) out.push(sp);
      }
    } else {
      out.push(p);
    }
  }
  return out;
}

function resolveClientEntry(dir, pkg) {
  const guesses = [];
  const push = (v) => {
    // only runtime JS entries; skip the "types" branch (a .d.ts is not a bundle)
    if (typeof v === 'string' && /\.(js|mjs|cjs)$/.test(v)) guesses.push(v);
  };
  const fromExports = pkg?.exports?.['./client'];
  if (typeof fromExports === 'string') push(fromExports);
  else if (fromExports && typeof fromExports === 'object') {
    for (const k of ['default', 'import', 'require', 'module', 'browser']) push(fromExports[k]);
    for (const v of Object.values(fromExports)) push(v);
  }
  guesses.push('lib/client.js', 'dist/client.js', 'client.js');

  let firstExisting = null;
  for (const g of guesses) {
    const p = path.resolve(dir, g);
    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) continue;
    if (firstExisting === null) firstExisting = p;
    try {
      if (fs.readFileSync(p, 'utf8').includes('__ModuleLoader__')) return p;
    } catch { /* unreadable -> keep looking */ }
  }
  return firstExisting;
}

function readDisabled(profileDir) {
  const p = path.join(profileDir, '.dsh-market', 'state.json');
  try {
    const s = JSON.parse(fs.readFileSync(p, 'utf8'));
    return new Set(Array.isArray(s.disabled) ? s.disabled : []);
  } catch { return new Set(); }
}

function defaultProfileRoots() {
  const base = path.join(os.homedir(), '.dsh', 'profiles');
  if (!isDir(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter((e) => isDir(path.join(base, e.name)))
    .map((e) => ({ profile: e.name, dir: path.join(base, e.name), nm: path.join(base, e.name, 'node_modules') }));
}

function officialRoots() {
  const out = [];
  const seeds = [
    process.env.DSH_INSTALL_ROOT,
    'C:\\nodejs\\node_modules\\@deepseek-ai\\dsh',
    'C:\\nvm\\v22.22.1\\node_modules\\@deepseek-ai\\dsh',
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', '@deepseek-ai', 'dsh'),
    '/usr/local/lib/node_modules/@deepseek-ai/dsh',
  ].filter(Boolean);
  for (const s of seeds) {
    const nm = path.join(s, 'node_modules', '@deepseek-ai');
    if (isDir(nm)) out.push({ profile: 'official', dir: s, nm });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 7. CLI
 * ------------------------------------------------------------------ */

function parseArgs(argv) {
  const opts = {
    profiles: [], roots: [], json: false, staticOnly: false,
    includeOfficial: false, verbose: false, only: null, help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--profile' || a === '--profiles') opts.profiles.push(argv[++i]);
    else if (a === '--roots') { while (argv[i + 1] && !argv[i + 1].startsWith('--')) opts.roots.push(argv[++i]); }
    else if (a === '--only') opts.only = argv[++i];
    else if (a === '--json') opts.json = true;
    else if (a === '--static-only') opts.staticOnly = true;
    else if (a === '--include-official') opts.includeOfficial = true;
    else if (a === '-v' || a === '--verbose') opts.verbose = true;
    else if (a === '-h' || a === '--help') opts.help = true;
  }
  return opts;
}

const HELP = `dsh-command-contract-audit — client command-registration contract auditor

Usage:
  node dsh-command-contract-audit.mjs [options]

Options:
  --profile <name>      scan ~/.dsh/profiles/<name>            (repeatable; default: all)
  --roots <dir> [...]   scan explicit node_modules roots
  --include-official    also scan the bundled @deepseek-ai client plugins
  --only <substring>    restrict to packages whose name contains <substring>
  --static-only         skip the L2 runtime sandbox probe
  --json                machine-readable report on stdout
  -v, --verbose         list every scanned package
  -h, --help            this text

Exit codes: 0 pass, 1 findings, 2 usage/environment error
`;

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) { process.stdout.write(HELP); return 0; }

  let targets = [];
  if (opts.roots.length > 0) {
    targets = opts.roots.map((nm) => ({ profile: path.basename(path.dirname(nm)), dir: path.dirname(nm), nm }));
  } else {
    const all = defaultProfileRoots();
    if (all.length === 0) {
      process.stderr.write('error: no ~/.dsh/profiles found; pass --roots\n');
      return 2;
    }
    targets = opts.profiles.length > 0
      ? all.filter((t) => opts.profiles.includes(t.profile))
      : all;
    if (opts.profiles.length > 0 && targets.length === 0) {
      process.stderr.write(`error: no such profile(s): ${opts.profiles.join(', ')}\n`);
      return 2;
    }
  }
  if (opts.includeOfficial) targets = targets.concat(officialRoots());

  const packages = [];
  const seenPackage = new Set();
  const duplicates = [];
  for (const t of targets) {
    const disabled = readDisabled(t.dir);
    for (const dir of listPackageDirs(t.nm)) {
      let pkg = null;
      try { pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch { continue; }
      const name = pkg.name || path.basename(dir);
      if (opts.only && !name.includes(opts.only)) continue;
      // the same plugin@version can appear under several roots (e.g. two DSH
      // installs); audit each distinct version once.
      const key = `${name}@${pkg.version || '0.0.0'}`;
      if (seenPackage.has(key)) { duplicates.push({ key, root: t.nm }); continue; }
      const client = resolveClientEntry(dir, pkg);
      if (!client) continue;
      const src = fs.readFileSync(client, 'utf8');
      if (!src.includes('__ModuleLoader__')) continue; // not a client bundle
      seenPackage.add(key);
      packages.push({
        profile: t.profile, name, version: pkg.version || '0.0.0', dir, client,
        disabled: disabled.has(name),
        touchesCommandUi: src.includes('commandUi'),
      });
    }
  }

  const findings = [];
  const scanned = [];
  const skipped = [];

  for (const p of packages) {
    if (p.disabled) { skipped.push({ ...p, reason: 'disabled in .dsh-market/state.json' }); continue; }
    if (!p.touchesCommandUi) { skipped.push({ ...p, reason: 'does not reference commandUi' }); continue; }

    const entry = { name: p.name, version: p.version, profile: p.profile, client: p.client, layers: {} };
    const staticRes = scanStatic(p.client);
    findings.push(...staticRes.findings);
    entry.layers.L1 = { sites: staticRes.sites.length, findings: staticRes.findings.length };

    if (!opts.staticOnly) {
      const probe = runtimeProbe(p.client);
      const before = findings.length;
      if (probe.loadError) {
        findings.push(mk2('WARN', p.client, 'RUNTIME_PROBE_INCONCLUSIVE',
          `L2 probe could not exercise this bundle: ${probe.loadError}`));
      }
      validateRecords(p.client, probe, findings);
      entry.layers.L2 = {
        records: probe.records.length,
        apis: probe.records.map((r) => r.api),
        loadError: probe.loadError,
        findings: findings.length - before,
      };
      entry.declaredInject = probe.inject ?? null;
      if (!probe.loadError && probe.records.length === 0) {
        entry.note = 'references commandUi but registered nothing during apply(); registration may happen later (lazy/inside a component).';
      }
    }
    scanned.push(entry);
  }

  // let queued async option probes settle
  await new Promise((r) => setTimeout(r, 30));

  const errors = findings.filter((f) => f.severity === SEV.ERROR);
  const warns = findings.filter((f) => f.severity === SEV.WARN);

  if (opts.json) {
    process.stdout.write(JSON.stringify({
      generatedAt: new Date().toISOString(),
      host: os.hostname(),
      roots: targets.map((t) => t.nm),
      summary: {
        packagesDiscovered: packages.length,
        packagesScanned: scanned.length,
        packagesSkipped: skipped.length,
        errors: errors.length,
        warnings: warns.length,
        duplicateCopiesCollapsed: duplicates.length,
      },
      scanned, skipped: skipped.map((s) => ({ name: s.name, version: s.version, reason: s.reason })),
      findings,
    }, null, 2) + '\n');
    return errors.length > 0 ? 1 : 0;
  }

  const out = [];
  out.push('DSH client command-registration contract audit');
  out.push('=============================================');
  out.push(`roots      : ${targets.map((t) => t.nm).join('\n             ')}`);
  out.push(`packages   : ${packages.length} discovered, ${scanned.length} with commandUi, ${skipped.length} skipped` +
    (duplicates.length ? ` (${duplicates.length} duplicate cop${duplicates.length === 1 ? 'y' : 'ies'} collapsed)` : ''));
  out.push('');
  if (opts.verbose) {
    for (const s of skipped) out.push(`  skip  ${s.name}@${s.version}  (${s.reason})`);
    if (skipped.length) out.push('');
  }
  for (const e of scanned) {
    out.push(`  scan  ${e.name}@${e.version}  L1:${e.layers.L1.sites} sites/${e.layers.L1.findings} findings` +
      (e.layers.L2 ? `  L2:${e.layers.L2.records} registrations/${e.layers.L2.findings} findings` : '  L2: skipped'));
    if (e.layers.L2 && e.layers.L2.apis.length) out.push(`         captured: ${e.layers.L2.apis.join(', ')}`);
    if (e.note) out.push(`         note: ${e.note}`);
  }
  if (scanned.length === 0) out.push('  (no plugin touching commandUi found)');
  out.push('');

  if (findings.length === 0) {
    out.push('RESULT: PASS — no contract violations detected.');
  } else {
    out.push(`RESULT: ${errors.length > 0 ? 'FAIL' : 'WARN'} — ${errors.length} error(s), ${warns.length} warning(s)`);
    out.push('');
    for (const f of [...errors, ...warns]) {
      const rel = f.file.replace(os.homedir(), '~');
      out.push(`  [${f.severity}] ${f.code} (${f.layer})`);
      out.push(`      at ${rel}${f.line ? ':' + f.line : ''}`);
      out.push(`      ${f.message}`);
    }
  }
  process.stdout.write(out.join('\n') + '\n');
  return errors.length > 0 ? 1 : 0;
}

const invokedDirectly = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  main().then(
    (code) => { process.exitCode = code; },
    (err) => { process.stderr.write(`fatal: ${err && err.stack || err}\n`); process.exitCode = 2; },
  );
}

/* internals exposed for the unit tests (tests/contract-audit.test.mjs) */
export {
  scanStatic, parseTopLevelProps, readObjectAt, classifyValue, findCommandUiBindings,
  runtimeProbe, validateRecords, matchBalanced, readValueEnd,
  magicFor, makeRequireShim,
  listPackageDirs, resolveClientEntry,
};
