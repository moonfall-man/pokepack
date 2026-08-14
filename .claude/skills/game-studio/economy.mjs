#!/usr/bin/env node
// Moonfall Interactive studio economy — the pretend budget that makes stakes real.
// Payroll burns it every sprint; shipped story points earn it back.
// State: <repo>/studio/economy.json. Node >= 18, zero dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SKILL_DIR, '..', '..', '..');
const STUDIO = path.resolve(process.env.STUDIO_DIR || path.join(REPO_ROOT, 'studio'));
const ECON_FILE = path.join(STUDIO, 'economy.json');
const ROSTER_FILE = path.join(STUDIO, 'roster.json');
const LOCK_DIR = path.join(STUDIO, '.economy.lock');

const DEFAULT_BALANCE = 500000;
const DEFAULT_RATE = 8000;     // $ per shipped story point
const SPRINTS_PER_YEAR = 26;   // two-week sprints; payroll per sprint = salary/26

function die(msg) { console.error(`economy: ${msg}`); process.exit(1); }
function nowIso() { return new Date().toISOString(); }
function sleepMs(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
function fmt(n) { return (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US'); }

function load() {
  if (!fs.existsSync(ECON_FILE)) return { studio: 'Moonfall Interactive', balance: 0, log: [] };
  return JSON.parse(fs.readFileSync(ECON_FILE, 'utf8'));
}

function save(e) {
  fs.mkdirSync(STUDIO, { recursive: true });
  const tmp = ECON_FILE + '.tmp';
  for (let i = 0; ; i++) {
    try {
      fs.writeFileSync(tmp, JSON.stringify(e, null, 2));
      fs.renameSync(tmp, ECON_FILE);
      return;
    } catch (err) {
      if (i >= 5) throw err;
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
      if (i >= 200) throw new Error(`economy is locked (${LOCK_DIR}); delete it if stale`);
      sleepMs(50);
    }
  }
  try {
    const st = load();
    const out = fn(st);
    save(st);
    return out;
  } finally {
    try { fs.rmdirSync(LOCK_DIR); } catch { /* already gone */ }
  }
}

function post(e, kind, amount, note) {
  e.balance = Math.round(e.balance + amount);
  e.log.push({ at: nowIso(), kind, amount: Math.round(amount), balance: e.balance, note });
  return e.balance;
}

function parseArgs(argv) {
  const BOOL = new Set(['json']);
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

const [cmd, ...rest] = process.argv.slice(2);
const { pos, flags } = parseArgs(rest);

switch (cmd) {
  case 'init': {
    const created = withLock((e) => {
      if (e.log.length || e.balance) return false;
      post(e, 'funding', Number(flags.balance || DEFAULT_BALANCE), 'seed funding from the studio head');
      return true;
    });
    console.log(created ? `studio funded with ${fmt(Number(flags.balance || DEFAULT_BALANCE))}` : 'economy already initialized');
    break;
  }
  case 'payroll': {
    if (!fs.existsSync(ROSTER_FILE)) die('no roster.json — run roster.mjs init first');
    const roster = JSON.parse(fs.readFileSync(ROSTER_FILE, 'utf8'));
    const actives = roster.employees.filter((x) => x.status === 'active');
    const cost = Math.round(actives.reduce((n, x) => n + x.salary, 0) / SPRINTS_PER_YEAR) * Number(flags.periods || 1);
    const bal = withLock((e) => post(e, 'payroll', -cost, `payroll for ${actives.length} staff (${flags.note || 'sprint'})`));
    console.log(`payroll ${fmt(-cost)} -> balance ${fmt(bal)}`);
    break;
  }
  case 'revenue': {
    const points = Number(pos[0]);
    if (!points && points !== 0) die('usage: revenue <shippedPoints> [--rate 8000] [--note "..."]');
    const rate = Number(flags.rate || DEFAULT_RATE);
    const bal = withLock((e) => post(e, 'revenue', points * rate, flags.note || `${points} story points shipped @ ${fmt(rate)}/pt`));
    console.log(`revenue ${fmt(points * rate)} -> balance ${fmt(bal)}`);
    break;
  }
  case 'post': {
    const amount = Number(pos[0]);
    const note = pos[1];
    if (!amount || !note) die('usage: post <signedAmount> "<note>" [--kind adjustment]');
    const bal = withLock((e) => post(e, flags.kind || 'adjustment', amount, note));
    console.log(`${fmt(amount)} -> balance ${fmt(bal)}`);
    break;
  }
  case 'show': {
    const e = load();
    if (flags.json) { console.log(JSON.stringify(e, null, 2)); break; }
    console.log(`balance: ${fmt(e.balance)}`);
    for (const l of e.log.slice(-8)) console.log(`  ${l.at.slice(0, 10)}  ${l.kind.padEnd(10)} ${fmt(l.amount).padStart(10)}  ${l.note}`);
    break;
  }
  default:
    console.log(`Moonfall Interactive economy (state: ${ECON_FILE})
usage: node economy.mjs <command>
  init [--balance ${DEFAULT_BALANCE}]        seed funding (idempotent)
  payroll [--periods 1] [--note "..."]   burn one sprint of payroll (reads roster.json)
  revenue <points> [--rate ${DEFAULT_RATE}]      earn for shipped story points
  post <signedAmount> "<note>"           arbitrary ledger entry
  show [--json]`);
    process.exit(cmd ? 1 : 0);
}
