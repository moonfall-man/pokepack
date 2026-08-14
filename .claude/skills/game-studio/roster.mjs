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

// ---------- dossiers: extractable agent definitions ----------
// One markdown file per employee: seat instructions verbatim, the identity
// overlay sprints compose for them, salary/rating trajectory, full record.
// The studio head lifts these to clone or evolve agents elsewhere.

const AGENTS_DIR = path.join(REPO_ROOT, '.claude', 'agents');
const SEAT_FILE = {
  producer: 'studio-producer.md', creative: 'studio-creative.md',
  'eng-lead': 'studio-eng-lead.md', dev: 'studio-dev.md', qa: 'studio-qa.md',
  scribe: 'studio-scribe.md', manager: 'studio-manager.md',
};

function firstName(e) { return e.name.replace(/["']/g, '').split(/\s+/)[0]; }

function heldOpinions(r, e) {
  const first = firstName(e);
  const held = [];
  for (const other of r.employees) {
    for (const o of other.opinions || []) {
      if (o.by === first || e.name.startsWith(o.by || ' ')) {
        held.push({ about: other.name, sprint: o.sprint, text: o.text });
      }
    }
  }
  return held;
}

function avgScore(review) {
  const vals = Object.values(review.scores || {});
  return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}

function dossierMd(r, e) {
  const reviews = e.reviews || [];
  const trajectory = reviews.map((v) => (avgScore(v) || 0).toFixed(2)).join(' -> ') || 'unreviewed';
  const last = reviews[reviews.length - 1];
  const seatPath = path.join(AGENTS_DIR, SEAT_FILE[e.role] || '');
  let seat = '';
  try { seat = fs.readFileSync(seatPath, 'utf8').replace(/^---[\s\S]*?---\s*/, ''); }
  catch { seat = `(seat file ${SEAT_FILE[e.role] || '?'} not found)`; }
  const held = heldOpinions(r, e);

  const lines = [];
  lines.push('---');
  lines.push(`name: ${e.id}`);
  lines.push(`fullName: ${e.name}`);
  lines.push(`seat: ${e.role}`);
  lines.push(`model: ${e.model}`);
  lines.push(`status: ${e.status} — Moonfall Interactive`);
  lines.push(`salary: $${e.salary.toLocaleString('en-US')}/yr`);
  lines.push(`hired: ${(e.hired || '').slice(0, 10)}`);
  lines.push(`lastRating: ${last ? (avgScore(last) || 0).toFixed(2) : 'n/a'}`);
  lines.push(`ratingTrajectory: ${trajectory}`);
  lines.push('---');
  lines.push('');
  lines.push(`# ${e.name} — ${e.role} dossier`);
  lines.push('');
  lines.push('## Seat instructions (verbatim from the agent definition)');
  lines.push('');
  lines.push(seat.trim());
  lines.push('');
  lines.push('## Identity overlay (as sprints compose it)');
  lines.push('');
  lines.push(`You are ${e.name}, holding the ${e.role} seat at Moonfall Interactive.`);
  if (e.personaNotes) lines.push(`Coaching note from your manager on file: "${e.personaNotes}"`);
  if (held.length) {
    lines.push('Your private working opinions of colleagues:');
    for (const o of held) lines.push(`- ${o.about}${o.sprint ? ` (${o.sprint})` : ''}: "${o.text}"`);
  }
  lines.push('');
  lines.push('## Performance record');
  lines.push('');
  if (!reviews.length) lines.push('No review cycles yet.');
  for (const v of reviews) {
    lines.push(`- ${(v.at || '').slice(0, 10)} ${v.sprint || ''} — **${v.decision}**${v.raisePct ? ` +${v.raisePct}% -> $${v.newSalary.toLocaleString('en-US')}` : ''} · avg ${(avgScore(v) || 0).toFixed(2)} (${Object.entries(v.scores || {}).map(([k, n]) => `${k}=${n}`).join(', ')})`);
    if (v.notes) lines.push(`  - ${v.notes}`);
  }
  lines.push('');
  lines.push('## Peer opinions received');
  lines.push('');
  if (!(e.opinions || []).length) lines.push('None on file.');
  for (const o of e.opinions || []) lines.push(`- ${o.by}${o.sprint ? ` (${o.sprint})` : ''}: "${o.text}"`);
  lines.push('');
  return lines.join('\n');
}

function cmdDossier(pos) {
  const r = load();
  console.log(dossierMd(r, empOrDie(r, pos[0])));
}

function cmdExport(flags) {
  const r = load();
  if (!r.employees.length) die('nobody on the roster');
  const dir = path.resolve(flags.dir || path.join(STUDIO, 'dossiers'));
  fs.mkdirSync(dir, { recursive: true });
  const index = ['# Moonfall Interactive — agent dossiers', ''];
  for (const e of r.employees) {
    fs.writeFileSync(path.join(dir, `${e.id}.md`), dossierMd(r, e));
    const last = (e.reviews || [])[e.reviews.length - 1];
    index.push(`- [${e.name}](${e.id}.md) — ${e.role} · ${e.model} · $${e.salary.toLocaleString('en-US')} · ${e.status}${last ? ` · last ${(avgScore(last) || 0).toFixed(2)}` : ''}`);
  }
  fs.writeFileSync(path.join(dir, '_index.md'), index.join('\n') + '\n');
  console.log(`${r.employees.length} dossiers -> ${dir}`);
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
  set-notes <id> "<persona notes>"
  dossier <id>                           print an employee's full extractable dossier
  export [--dir PATH]                    write all dossiers to studio/dossiers/`;

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
  case 'dossier': cmdDossier(pos); break;
  case 'export': cmdExport(flags); break;
  default: console.log(HELP); process.exit(cmd ? 1 : 0);
}
