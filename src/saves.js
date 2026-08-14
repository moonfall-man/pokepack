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
import { safeEntryName } from './zip.js';

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
 * readBackup(buffer) -> { setup, takenAt, saveSlots, slots: [{ version, name, data() }] }
 *
 * Open one of ours without restoring it, so "which of these has my save" is a
 * question you can answer before committing to an answer.
 *
 * Validated rather than trusted.  A zip on disk is a file anybody could have
 * put there, and this one is about to be written into a save directory: entry
 * names are checked for the usual escape, and a zip with no saves.json is
 * refused outright rather than half-restored, because without the slot list the
 * files would go back invisible.
 */
export function readBackup(buffer) {
  let entries;
  try {
    entries = zip.read(buffer);
  } catch (e) {
    return { error: `that is not a readable zip (${e.message})` };
  }

  const meta = entries.find((e) => e.name === 'saves.json');
  if (!meta) {
    return { error: 'that zip has no saves.json, so it is not a pokepack save backup' };
  }

  let doc;
  try {
    doc = JSON.parse(meta.data().toString('utf8'));
  } catch (e) {
    return { error: `its saves.json did not parse (${e.message})` };
  }

  const slots = [];
  for (const entry of entries) {
    if (entry.name === 'saves.json' || entry.isDirectory) continue;
    if (!safeEntryName(entry.name)) {
      return { error: `it contains an unsafe path and was not opened: ${entry.name}` };
    }
    const m = /^saves\/([^/]+)\/([^/]+)\.lua$/.exec(entry.name.replace(/\\/g, '/'));
    if (!m) continue;
    slots.push({ version: m[1], name: m[2], size: entry.size, data: entry.data });
  }
  if (slots.length === 0) return { error: 'that backup has no save files in it' };

  return {
    setup: typeof doc.setup === 'string' ? doc.setup : null,
    takenAt: typeof doc.takenAt === 'string' ? doc.takenAt : null,
    saveSlots: doc.saveSlots && typeof doc.saveSlots === 'object' ? doc.saveSlots : {},
    slots,
  };
}

/**
 * restore({ buffer, to, ... }) -> { restored, options }
 *
 * Put a backup back.  The counterpart to backup(), and the half that matters:
 * an archive nobody can unpack is worth about as much as no archive.
 *
 * Same rule as transfer -- nothing is overwritten.  A slot keeps its original
 * name when that name is free, which makes a restore into an empty setup come
 * out looking exactly like the original; where it is taken, the save lands
 * beside the one already there rather than on it.  Whichever slot the backup
 * recorded as active becomes active again, if it came back.
 */
export function restore({
  buffer, to, exePath = null, running: runningOverride,
} = {}) {
  if (!to || !existsSync(to)) throw new Error(`no such setup: ${to}`);

  const read = readBackup(buffer);
  if (read.error) throw new Error(read.error);

  const running = runningOverride === undefined ? isGameRunning(exePath) : runningOverride;
  if (running === true) throw new Error('the game is running -- close it first');
  if (running === null) throw new Error('could not tell whether the game is running, so nothing was changed');

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

  const restored = [];
  for (const slot of read.slots) {
    const existing = slotsFor(options, slot.version);
    const dir = join(to, SAVES, slot.version);
    mkdirSync(dir, { recursive: true });

    // Keep the name it had if nothing is using it; otherwise beside, never on.
    const taken = new Set(existing.list);
    if (existsSync(dir)) for (const n of readdirSync(dir)) taken.add(basename(n.replace(/\.bak$/, ''), EXT));
    const name = taken.has(slot.name) ? freeSlot(to, slot.version, options) : slot.name;

    writeFileSync(join(dir, `${name}${EXT}`), slot.data());

    const list = [...existing.list, name];
    const wasActive = read.saveSlots?.[slot.version]?.active === slot.name;
    options.saveSlots[slot.version] = {
      ...(options.saveSlots[slot.version] ?? {}),
      active: wasActive ? name : (existing.active ?? name),
      list: Object.fromEntries(list.map((s, i) => [String(i + 1), s])),
    };
    restored.push({
      version: slot.version,
      fromSlot: slot.name,
      toSlot: name,
      renamed: name !== slot.name,
      bytes: slot.size,
    });
  }

  // Decided after the loop, not inside it.  Restoring slot1 into an empty
  // setup makes it active for lack of anything else, and then slot2 arrives
  // and takes it -- so a flag written per slot claims two winners.
  for (const r of restored) r.active = options.saveSlots[r.version]?.active === r.toSlot;

  writeOptions(to, options);
  return { restored, options: optPath, setup: read.setup, takenAt: read.takenAt };
}

/**
 * listBackups(dir) -> [{ file, setup, takenAt, slots, error? }]
 *
 * Every backup in a folder, opened far enough to say what is in it.  A file
 * that will not open is listed with its reason rather than dropped -- a backup
 * you cannot see is one you will not know is broken until you need it.
 */
export function listBackups(dir) {
  if (!dir || !existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir).sort().reverse()) {
    if (!name.endsWith('.zip')) continue;
    const file = join(dir, name);
    try {
      const read = readBackup(readFileSync(file));
      if (read.error) out.push({ file, name, error: read.error });
      else {
        out.push({
          file,
          name,
          setup: read.setup,
          takenAt: read.takenAt,
          bytes: statSync(file).size,
          slots: read.slots.map((s) => `${s.version}/${s.name}`),
        });
      }
    } catch (e) {
      out.push({ file, name, error: e.message });
    }
  }
  return out;
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
