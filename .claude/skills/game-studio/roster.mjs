#!/usr/bin/env node
// Moonfall Interactive staff roster — employees, salaries, reviews, peer opinions.
// State: <repo>/studio/roster.json (override the studio dir with STUDIO_DIR).
// Used by the game-studio skill's performance workflow. Node >= 18.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SKILL_DIR, '..', '..', '..');
const STUDIO = path.resolve(process.env.STUDIO_DIR || path.join(REPO_ROOT, 'studio'));
const ROSTER_FILE = path.join(STUDIO, 'roster.json');
const LOCK_DIR = path.join(STUDIO, '.roster.lock');

const ROLES = ['producer', 'creative', 'eng-lead', 'dev', 'qa', 'scribe', 'manager'];
const DECISIONS = ['raise', 'hold', 'warning', 'fired'];
const SCORE_KEYS = ['workEthic', 'accuracy', 'output', 'collaboration'];

// The founding team. Model tiers: senior judgment inherits the session's top
// model; hands-on execution runs sonnet; mechanical coordination runs haiku.
const FOUNDERS = [
  { id: 'priya', name: 'Priya "PJ" Joshi', role: 'producer', model: 'inherit', salary: 145000 },
  { id: 'marcus', name: 'Marcus Vale', role: 'creative', model: 'inherit', salary: 160000 },
  { id: 'elena', name: 'Elena Vasquez', role: 'eng-lead', model: 'inherit', salary: 170000 },
  { id: 'devon', name: 'Devon Park', role: 'dev', model: 'sonnet', salary: 118000 },
  { id: 'quinn', name: 'Quinn Reyes', role: 'qa', model: 'sonnet', salary: 104000 },
  { id: 'sam', name: 'Sam Okafor', role: 'scribe', model: 'haiku', salary: 68000 },
  { id: 'rosa', name: 'Rosa Delgado', role: 'manager', model: 'inherit', salary: 150000 },
];

function nowIso() { return new Date().toISOString(); }
function die(msg) { console.error(`roster: ${msg}`); process.exit(1); }
function sleepMs(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

function emptyRoster() { return { studio: 'Moonfall Interactive', employees: [], log: [] }; }

function load() {
  if (!fs.existsSync(ROSTER_FILE)) return emptyRoster();
  return JSON.parse(fs.readFileSync(ROSTER_FILE, 'utf8'));
}

function save(r) {
  fs.mkdirSync(STUDIO, { recursive: true });
  const tmp = ROSTER_FILE + '.tmp';
  for (let i = 0; ; i++) {
    try {
      fs.writeFileSync(tmp, JSON.stringify(r, null, 2));
      fs.renameSync(tmp, ROSTER_FILE);
      return;
    } catch (e) {
      if (i >= 5) throw e;
      sleepMs(80 * (i + 1));
    }
  }
}

function withLock(fn) {
  fs.mkdirSync(STUDIO, { recursive: true });
  for (let i = 0; ; i++) {
    try { fs.mkdirSync(LOCK_DIR); break; }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      if (i >= 200) throw new Error(`roster is locked (${LOCK_DIR}); delete it if stale`);
      sleepMs(50);
    }
  }
  try {
    const r = load();
    const out = fn(r);
    save(r);
    return out;
  } finally {
    try { fs.rmdirSync(LOCK_DIR); } catch { /* already gone */ }
  }
}

function parseArgs(argv) {
  const BOOL = new Set(['json', 'active']);
  const pos = []; const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (BOOL.has(k)) flags[k] = true;
      else flags[k] = argv[++i];
    } else pos.push(a);
  }
  return { pos, flags };
}

function empOrDie(r, id) {
  const norm = String(id).toLowerCase();
  const e = r.employees.find((e) => e.id === norm)
    || r.employees.find((e) => e.name.toLowerCase().includes(norm));
  if (!e) die(`no employee ${id}`);
  return e;
}

function slug(name) {
  return name.toLowerCase().replace(/["'.]/g, '').split(/\s+/)[0];
}

function logAction(r, action, detail, by) {
  r.log.push({ at: nowIso(), action, by: by || 'roster', detail });
}

function parseScores(s) {
  const scores = {};
  for (const pair of String(s).split(',')) {
    const [k, v] = pair.split('=').map((x) => x.trim());
    if (!SCORE_KEYS.includes(k)) die(`unknown score key ${k} (use ${SCORE_KEYS.join(',')})`);
    scores[k] = Number(v);
  }
  return scores;
}

// ---------- commands ----------

function cmdInit() {
  const created = withLock((r) => {
    if (r.employees.length) return false;
    for (const f of FOUNDERS) {
      r.employees.push({
        ...f, status: 'active', hired: nowIso(), personaNotes: '',
        opinions: [], reviews: [],
      });
    }
    logAction(r, 'founded', 'founding team hired');
    return true;
  });
  console.log(created ? `founding team of ${FOUNDERS.length} hired; roster: ${ROSTER_FILE}` : `roster already staffed; roster: ${ROSTER_FILE}`);
}

function cmdList(flags) {
  const r = load();
  const emps = r.employees.filter((e) => !flags.active || e.status === 'active');
  if (flags.json) { console.log(JSON.stringify(emps, null, 2)); return; }
  if (!emps.length) { console.log('nobody on the roster — run: roster.mjs init'); return; }
  for (const e of emps) {
    const last = e.reviews[e.reviews.length - 1];
    const avg = last ? (Object.values(last.scores).reduce((a, b) => a + b, 0) / Object.values(last.scores).length).toFixed(1) : '-';
    console.log(`${e.id.padEnd(8)} ${e.name.padEnd(22)} ${e.role.padEnd(9)} ${e.model.padEnd(8)} $${e.salary.toLocaleString('en-US').padEnd(9)} ${e.status.padEnd(7)} lastReview:${avg} opinions:${e.opinions.length}`);
  }
}

function cmdShow(pos) {
  console.log(JSON.stringify(empOrDie(load(), pos[0]), null, 2));
}

function cmdOpinion(pos, flags) {
  const [id, text] = pos;
  if (!id || !text) die('usage: opinion <id> "<text>" --by <name> [--sprint REF]');
  withLock((r) => {
    const e = empOrDie(r, id);
    e.opinions.push({ at: nowIso(), by: flags.by || 'anonymous', sprint: flags.sprint || null, text });
  });
  console.log(`opinion recorded about ${id}`);
}

function cmdReview(pos, flags) {
  const id = pos[0];
  if (!id || !flags.scores || !flags.decision) {
    die('usage: review <id> --scores "workEthic=4,accuracy=5,output=4,collaboration=3" --decision raise|hold|warning|fired [--raise PCT] [--notes "..."] [--sprint REF] --by <name>');
  }
  if (!DECISIONS.includes(flags.decision)) die(`decision must be ${DECISIONS.join('|')}`);
  const scores = parseScores(flags.scores);
  const out = withLock((r) => {
    const e = empOrDie(r, id);
    const review = {
      at: nowIso(), sprint: flags.sprint || null, by: flags.by || 'manager',
      scores, decision: flags.decision, notes: flags.notes || '',
      raisePct: 0, newSalary: e.salary,
    };
    if (flags.decision === 'raise') {
      review.raisePct = Number(flags.raise || 3);
      review.newSalary = Math.round(e.salary * (1 + review.raisePct / 100));
      e.salary = review.newSalary;
    }
    if (flags.decision === 'fired') e.status = 'fired';
    e.reviews.push(review);
    logAction(r, `review:${flags.decision}`, `${e.name}: ${flags.scores}${review.raisePct ? ` (+${review.raisePct}% -> $${review.newSalary})` : ''}${flags.notes ? ` — ${flags.notes}` : ''}`, flags.by);
    return `${e.name}: ${flags.decision}${review.raisePct ? ` +${review.raisePct}% -> $${review.newSalary.toLocaleString('en-US')}` : ''}${e.status === 'fired' ? ' (terminated)' : ''}`;
  });
  console.log(out);
}

function cmdRaise(pos, flags) {
  const [id, pct] = pos;
  if (!id || !pct) die('usage: raise <id> <pct> --by <name> [--notes "..."]');
  const out = withLock((r) => {
    const e = empOrDie(r, id);
    e.salary = Math.round(e.salary * (1 + Number(pct) / 100));
    logAction(r, 'raise', `${e.name} +${pct}% -> $${e.salary}${flags.notes ? ` — ${flags.notes}` : ''}`, flags.by);
    return `${e.name} +${pct}% -> $${e.salary.toLocaleString('en-US')}`;
  });
  console.log(out);
}

function cmdFire(pos, flags) {
  const id = pos[0];
  if (!id || !flags.reason) die('usage: fire <id> --reason "..." --by <name>');
  const out = withLock((r) => {
    const e = empOrDie(r, id);
    e.status = 'fired';
    logAction(r, 'fired', `${e.name} (${e.role}) — ${flags.reason}`, flags.by);
    return `${e.name} terminated: ${flags.reason}`;
  });
  console.log(out);
}

function cmdHire(pos, flags) {
  const name = pos[0];
  if (!name || !flags.role || !ROLES.includes(flags.role)) die(`usage: hire "<Full Name>" --role <${ROLES.join('|')}> [--model inherit|sonnet|haiku] [--salary N] [--notes "persona notes"] --by <name>`);
  const out = withLock((r) => {
    let id = slug(name);
    while (r.employees.some((e) => e.id === id)) id += '2';
    r.employees.push({
      id, name, role: flags.role,
      model: flags.model || (flags.role === 'dev' || flags.role === 'qa' ? 'sonnet' : flags.role === 'scribe' ? 'haiku' : 'inherit'),
      salary: Number(flags.salary || 100000),
      status: 'active', hired: nowIso(),
      personaNotes: flags.notes || '',
      opinions: [], reviews: [],
    });
    logAction(r, 'hired', `${name} as ${flags.role} at $${Number(flags.salary || 100000)}`, flags.by);
    return `hired ${name} (${id}) as ${flags.role}`;
  });
  console.log(out);
}

function cmdSetNotes(pos) {
  const [id, notes] = pos;
  if (!id || notes == null) die('usage: set-notes <id> "<persona notes>"');
  withLock((r) => { empOrDie(r, id).personaNotes = notes; });
  console.log(`notes set for ${id}`);
}

// ---------- main ----------

const HELP = `Moonfall Interactive roster (state: ${ROSTER_FILE})
usage: node roster.mjs <command>
  init                                   hire the founding team (idempotent)
  list [--json] [--active]
  show <id>
  opinion <id> "<text>" --by <name> [--sprint REF]
  review <id> --scores "workEthic=4,accuracy=5,output=4,collaboration=3"
              --decision raise|hold|warning|fired [--raise PCT]
              [--notes "..."] [--sprint REF] --by <name>
  raise <id> <pct> --by <name> [--notes "..."]
  fire <id> --reason "..." --by <name>
  hire "<Full Name>" --role <role> [--model M] [--salary N] [--notes "..."] --by <name>
  set-notes <id> "<persona notes>"`;

const [cmd, ...rest] = process.argv.slice(2);
const { pos, flags } = parseArgs(rest);
switch (cmd) {
  case 'init': cmdInit(); break;
  case 'list': cmdList(flags); break;
  case 'show': cmdShow(pos); break;
  case 'opinion': cmdOpinion(pos, flags); break;
  case 'review': cmdReview(pos, flags); break;
  case 'raise': cmdRaise(pos, flags); break;
  case 'fire': cmdFire(pos, flags); break;
  case 'hire': cmdHire(pos, flags); break;
  case 'set-notes': cmdSetNotes(pos); break;
  default: console.log(HELP); process.exit(cmd ? 1 : 0);
}
