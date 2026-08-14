// Moving a save between setups, and keeping copies of it.
//
// This is the one part of pokepack that handles something nobody can get back.
// A mod is a download and a pack is a recipe; a save is fifty hours that exist
// in exactly one place. So the rules here are stricter than anywhere else in
// the codebase, and they are rules about not destroying things rather than
// about correctness:
//
//   - nothing is ever overwritten.  A save copied into a setup that already has
//     one lands in a free slot beside it, never on top of it.
//   - the destination's options.lua is backed up under our own name before it
//     is touched, the same way liveapply does it.
//   - the game must be closed, for liveapply's reason: LOVE rewrites
//     options.lua wholesale on exit, so anything written under a running game
//     is lost or interleaved.
//
// A SAVE IS TWO THINGS, which is the part that catches you out. The data lives
// in saves/<version>/<slot>.lua, and which slots exist lives in options.lua
// under saveSlots:
//
//   saveSlots = { red = { active = "slot1", list = { [1] = "slot1" } } }
//
// Copy only the folder and the file is there and the game never mentions it,
// because nothing lists it. Both halves travel together or the transfer is a
// silent no-op.

import {
  existsSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync, copyFileSync,
} from 'node:fs';
import { join, basename } from 'node:path';
import { parse } from './luadata.js';
import { encode } from './luawrite.js';
import { OPTIONS, isGameRunning } from './liveapply.js';
import * as zip from './zip.js';

export const SAVES = 'saves';
export const EXT = '.lua';

// The engine's own crash-recovery copy.  Not ours to write, not ours to move,
// and not a save in its own right -- it is listed but never transferred.
const ENGINE_BAK = '.bak';

function slotsFor(options, version) {
  const entry = options?.saveSlots?.[version];
  if (!entry || typeof entry !== 'object') return { active: null, list: [] };
  const list = entry.list && typeof entry.list === 'object'
    ? Object.keys(entry.list).sort((a, b) => Number(a) - Number(b)).map((k) => entry.list[k])
    : [];
  return { active: entry.active ?? null, list: list.filter((s) => typeof s === 'string') };
}

/**
 * describe(saveDir) -> { versions: [{ version, active, slots: [...] }], total }
 *
 * What is actually in there, joined across both halves: the files on disk and
 * the list options.lua keeps.  A slot present in one and not the other is
 * reported rather than hidden, because that mismatch is exactly the state a
 * careless copy leaves behind.
 */
export function describe(saveDir) {
  const root = join(saveDir, SAVES);
  let options = {};
  const optPath = join(saveDir, OPTIONS);
  if (existsSync(optPath)) {
    try { options = parse(readFileSync(optPath, 'utf8')) ?? {}; } catch { options = {}; }
  }

  const versions = [];
  let total = 0;
  const dirs = existsSync(root)
    ? readdirSync(root).filter((n) => statSync(join(root, n)).isDirectory())
    : [];
  const named = new Set([...dirs, ...Object.keys(options.saveSlots ?? {})]);

  for (const version of [...named].sort()) {
    const { active, list } = slotsFor(options, version);
    const dir = join(root, version);
    const onDisk = existsSync(dir)
      ? readdirSync(dir).filter((n) => n.endsWith(EXT) && !n.endsWith(ENGINE_BAK))
      : [];

    const slots = [];
    for (const name of [...new Set([...list, ...onDisk.map((n) => basename(n, EXT))])].sort()) {
      const file = join(dir, `${name}${EXT}`);
      const there = existsSync(file);
      slots.push({
        name,
        file: there ? file : null,
        size: there ? statSync(file).size : 0,
        modified: there ? statSync(file).mtime : null,
        active: name === active,
        listed: list.includes(name),
        // Both of these are broken states, and naming them beats a slot that
        // silently does not appear in the game.
        orphanFile: there && !list.includes(name),
        missingFile: !there && list.includes(name),
      });
      if (there) total++;
    }
    versions.push({ version, active, slots });
  }
  return { versions, total };
}

// The next slot name nothing is using, on disk or in the list.
function freeSlot(saveDir, version, options) {
  const { list } = slotsFor(options, version);
  const dir = join(saveDir, SAVES, version);
  const taken = new Set(list);
  if (existsSync(dir)) {
    for (const n of readdirSync(dir)) taken.add(basename(n.replace(/\.bak$/, ''), EXT));
  }
  for (let i = 1; i < 1000; i++) {
    if (!taken.has(`slot${i}`)) return `slot${i}`;
  }
  throw new Error('every slot name from slot1 to slot999 is taken, which cannot be right');
}

function writeOptions(saveDir, options) {
  const path = join(saveDir, OPTIONS);
  const text = encode(options, { numericKeys: true });
  // Re-read what we are about to write.  A file that does not parse never
  // replaces one that did.
  parse(text);
  if (existsSync(path)) {
    let target = `${path}.pokepack-bak`;
    for (let n = 2; existsSync(target); n++) target = `${path}.pokepack-bak${n}`;
    copyFileSync(path, target);
  }
  writeFileSync(path, text);
  return path;
}

/**
 * transfer({ from, to, version, makeActive }) -> result
 *
 * Copy one setup's save into another, so a new pack can be played on an old
 * game.  Lands in a free slot: whatever the destination already had is still
 * there afterwards, still listed, still loadable.
 */
export function transfer({
  from, to, version = null, slot = null, makeActive = true,
  exePath = null, running: runningOverride,
} = {}) {
  if (!from || !existsSync(from)) throw new Error(`no such setup: ${from}`);
  if (!to || !existsSync(to)) throw new Error(`no such setup: ${to}`);
  if (from === to) throw new Error('those are the same setup');

  const running = runningOverride === undefined ? isGameRunning(exePath) : runningOverride;
  if (running === true) throw new Error('the game is running -- close it first');
  if (running === null) throw new Error('could not tell whether the game is running, so nothing was changed');

  const source = describe(from);
  const versions = version ? [version] : source.versions.map((v) => v.version);

  let options = {};
  const optPath = join(to, OPTIONS);
  if (existsSync(optPath)) {
    try {
      options = parse(readFileSync(optPath, 'utf8')) ?? {};
    } catch (e) {
      throw new Error(`the destination's options.lua did not parse (${e.message}), so nothing was changed`);
    }
  }
  options.saveSlots = options.saveSlots ?? {};

  const copied = [];
  for (const v of versions) {
    const entry = source.versions.find((x) => x.version === v);
    if (!entry) throw new Error(`${basename(from)} has no ${v} save`);

    // One slot by name, or whichever the source was actually playing.
    const want = slot
      ? entry.slots.find((s) => s.name === slot)
      : (entry.slots.find((s) => s.active && s.file) ?? entry.slots.find((s) => s.file));
    if (!want || !want.file) {
      if (slot) throw new Error(`${basename(from)} has no ${v} slot called ${slot}`);
      continue;
    }

    const name = freeSlot(to, v, options);
    const dir = join(to, SAVES, v);
    mkdirSync(dir, { recursive: true });
    const dest = join(dir, `${name}${EXT}`);
    if (existsSync(dest)) throw new Error(`${dest} already exists, which freeSlot should have prevented`);
    copyFileSync(want.file, dest);

    const existing = slotsFor(options, v);
    const list = [...existing.list, name];
    options.saveSlots[v] = {
      ...(options.saveSlots[v] ?? {}),
      active: makeActive ? name : (existing.active ?? name),
      list: Object.fromEntries(list.map((s, i) => [String(i + 1), s])),
    };

    copied.push({
      version: v, fromSlot: want.name, toSlot: name, bytes: statSync(dest).size,
      active: options.saveSlots[v].active === name,
      keptAlongside: existing.list,
    });
  }

  if (copied.length === 0) throw new Error(`${basename(from)} has no save to copy`);
  writeOptions(to, options);
  return { copied, options: optPath };
}

/**
 * backup(saveDir, { outDir, stamp }) -> { file, slots, bytes }
 *
 * Every save in one setup, in one zip, with the slot list beside it.  The list
 * is what makes the zip restorable rather than merely a pile of files -- see
 * the note at the top about a save being two things.
 */
export function backup(saveDir, { outDir, stamp = new Date().toISOString() } = {}) {
  const found = describe(saveDir);
  if (found.total === 0) throw new Error(`${basename(saveDir)} has no saves to back up`);

  const entries = [];
  for (const v of found.versions) {
    for (const s of v.slots) {
      if (!s.file) continue;
      entries.push({ name: `${SAVES}/${v.version}/${basename(s.file)}`, data: readFileSync(s.file) });
    }
  }

  entries.unshift({
    name: 'saves.json',
    data: Buffer.from(`${JSON.stringify({
      setup: basename(saveDir),
      takenAt: stamp,
      // Which slots existed and which was live.  Restoring without this puts
      // the files back and leaves the game unable to see them.
      saveSlots: Object.fromEntries(found.versions.map((v) => [
        v.version, { active: v.active, list: v.slots.filter((s) => s.file).map((s) => s.name) },
      ])),
    }, null, 2)}\n`, 'utf8'),
  });

  const safeStamp = String(stamp).replace(/[:.]/g, '-').replace(/T/, '_').slice(0, 19);
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `${basename(saveDir)}-saves-${safeStamp}.zip`);
  const buffer = zip.write(entries);
  writeFileSync(file, buffer);
  return { file, slots: entries.length - 1, bytes: buffer.length };
}
