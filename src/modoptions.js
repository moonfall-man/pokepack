// A mod's own settings, from outside the game.
//
// Every mod setting lives in options.modOptions.<MOD_ID> and, until now, could
// only be reached from the game's own MODS menu. That is a real gap and it cost
// a long afternoon: a setting sitting at the wrong value is invisible from
// here, so "COUCH_MULTIPLAYER players = 2" can quietly split a controller
// across two windows for days while every other check comes back clean.
//
// Two halves, and they are not equally trustworthy:
//
//   current()   exact.  Read straight out of options.lua -- these are the
//               values the game will actually use.
//   declared()  best effort.  Mods register settings by CALLING
//               mod.options:define(...) at runtime, so the only complete answer
//               requires running Lua. What can be read statically is the inline
//               schema tables, where key/label/type are string literals even
//               when the defaults are expressions (Config.DEFAULT_PLAYERS and
//               friends). A mod that builds its schema in a variable or behind
//               a conditional will be under-reported, which is why the two are
//               kept separate rather than merged into one list that quietly
//               lies about being complete.
//
// Writing goes through the same discipline as everything else that touches
// options.lua: game closed, merge never template, re-parsed before it replaces
// anything, previous copy kept under our own name.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from './luadata.js';
import { encode } from './luawrite.js';
import { OPTIONS, isGameRunning } from './liveapply.js';

/**
 * current(saveDir) -> { [modId]: { [key]: value } }
 *
 * What the game will actually use. Exact.
 */
export function current(saveDir) {
  const path = join(saveDir, OPTIONS);
  if (!existsSync(path)) return {};
  try {
    const options = parse(readFileSync(path, 'utf8'));
    return options?.modOptions ?? {};
  } catch {
    return {};
  }
}

// Walk a mod folder's Lua looking for inline option schemas.  Deliberately
// dumb: a regex over `key = "x", label = "y", type = "z"` triples rather than a
// Lua parser, because the alternative to under-reporting here is pretending to
// know a mod's settings and getting the values wrong.
const ENTRY = /\{\s*key\s*=\s*"([^"]+)"\s*,\s*label\s*=\s*"([^"]*)"(?:\s*,\s*type\s*=\s*"([^"]*)")?/g;

function luaFiles(dir, out = [], depth = 0) {
  if (depth > 6) return out;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'tests') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) luaFiles(p, out, depth + 1);
    else if (e.name.endsWith('.lua')) out.push(p);
  }
  return out;
}

/**
 * declared(modDir) -> [{ key, label, type }]
 *
 * Best effort, and says so. Never the only thing shown to a player.
 */
export function declared(modDir) {
  const found = new Map();
  for (const file of luaFiles(modDir)) {
    let text;
    try { text = readFileSync(file, 'utf8'); } catch { continue; }
    if (!text.includes('key')) continue;
    for (const m of text.matchAll(ENTRY)) {
      if (!found.has(m[1])) found.set(m[1], { key: m[1], label: m[2] || m[1], type: m[3] ?? null });
    }
  }
  return [...found.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}

/**
 * describe(saveDir) -> [{ id, options: [{ key, label, type, value, set }] }]
 *
 * The two halves joined for display: every setting that has a value, plus every
 * setting the mod's source appears to declare, marked with which is which.
 */
export function describe(saveDir) {
  const set = current(saveDir);
  const modsDir = join(saveDir, 'mods');
  const ids = new Set(Object.keys(set));
  if (existsSync(modsDir)) {
    for (const n of readdirSync(modsDir)) {
      if (n.startsWith('.')) continue;
      try {
        if (statSync(join(modsDir, n)).isDirectory()) ids.add(n);
      } catch { /* unreadable entry */ }
    }
  }

  const out = [];
  for (const id of [...ids].sort()) {
    const values = set[id] ?? {};
    const seen = new Map();
    for (const d of declared(join(modsDir, id))) {
      seen.set(d.key, { ...d, value: values[d.key], set: d.key in values });
    }
    // A value with no matching declaration still shows: it is real, the game
    // reads it, and a schema we could not parse is our problem not the
    // player's.
    for (const [k, v] of Object.entries(values)) {
      if (!seen.has(k)) seen.set(k, { key: k, label: k, type: null, value: v, set: true });
    }
    if (seen.size === 0) continue;
    out.push({ id, options: [...seen.values()].sort((a, b) => (a.key < b.key ? -1 : 1)) });
  }
  return out;
}

// options.lua is typed, and the types matter: COUCH_MULTIPLAYER stores
// players = "2" as a string while quality_of_life stores banners = 2 as a
// number. Writing the wrong one is how a setting silently stops being read, so
// an existing value's type wins over anything inferred from the input.
export function coerce(input, { existing, type } = {}) {
  if (typeof existing === 'boolean') return input === true || /^(true|on|yes|1)$/i.test(String(input));
  if (typeof existing === 'number') {
    const n = Number(input);
    if (!Number.isFinite(n)) throw new Error(`${existing} is a number here, and ${JSON.stringify(input)} is not one`);
    return n;
  }
  if (typeof existing === 'string') return String(input);

  if (type === 'number') {
    const n = Number(input);
    if (!Number.isFinite(n)) throw new Error(`that setting is a number, and ${JSON.stringify(input)} is not one`);
    return n;
  }
  if (type === 'bool' || type === 'boolean') return input === true || /^(true|on|yes|1)$/i.test(String(input));
  if (type === 'text') return String(input);

  // Nothing to go on: read it the way a person would have meant it.
  if (input === 'true' || input === true) return true;
  if (input === 'false' || input === false) return false;
  const n = Number(input);
  return Number.isFinite(n) && String(input).trim() !== '' ? n : String(input);
}

/**
 * set(saveDir, modId, key, value) -> { modId, key, from, to, path }
 *
 * Same four conditions as liveapply, for the same reasons.
 */
export function set(saveDir, modId, key, value, { exePath = null, running: runningOverride } = {}) {
  if (!modId || !key) throw new Error('which mod, and which setting?');

  const running = runningOverride === undefined ? isGameRunning(exePath) : runningOverride;
  if (running === true) throw new Error('the game is running -- close it first, or it will overwrite this on exit');
  if (running === null) throw new Error('could not tell whether the game is running, so nothing was changed');

  const path = join(saveDir, OPTIONS);
  let options = {};
  if (existsSync(path)) {
    try {
      options = parse(readFileSync(path, 'utf8')) ?? {};
    } catch (e) {
      throw new Error(`options.lua did not parse (${e.message}), so nothing was changed`);
    }
  }
  options.modOptions = options.modOptions ?? {};
  options.modOptions[modId] = options.modOptions[modId] ?? {};

  const existing = options.modOptions[modId][key];
  const type = declared(join(saveDir, 'mods', modId)).find((d) => d.key === key)?.type ?? null;
  const next = coerce(value, { existing, type });

  const text = encode({ ...options, modOptions: { ...options.modOptions, [modId]: { ...options.modOptions[modId], [key]: next } } }, { numericKeys: true });
  parse(text); // a file that does not read back never replaces one that did

  if (existsSync(path)) {
    let target = `${path}.pokepack-bak`;
    for (let n = 2; existsSync(target); n++) target = `${path}.pokepack-bak${n}`;
    copyFileSync(path, target);
  }
  writeFileSync(path, text);
  return { modId, key, from: existing, to: next, path };
}
