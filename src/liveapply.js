// Apply a pack straight into options.lua, so Play drops you into the setup
// rather than into a launcher you then have to click through.
//
// This writes the file the launcher owns, which is only safe under conditions
// worth stating plainly:
//
//   1. The game must not be running.  LOVE rewrites options.lua wholesale on
//      exit, so anything we wrote while it was open would simply vanish -- or
//      worse, interleave.
//   2. The existing file is read, modified and written back.  Every key we do
//      not understand survives untouched; this is a merge, never a template.
//   3. The result is re-parsed before it replaces anything.  A file that does
//      not read back is not written.
//   4. The previous file is kept, under our own name.  options.lua.bak belongs
//      to the engine's crash recovery (SaveData.loadOptions promotes it when
//      the main file is corrupt) and is not ours to overwrite.
//
// When any of that does not hold, the caller falls back to writing a
// .g1rmodlist and asking the player to import it -- slower, but never wrong.

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, basename } from 'node:path';
import { parse, toArray } from './luadata.js';
import { encode } from './luawrite.js';

export const OPTIONS = 'options.lua';

/**
 * isGameRunning(exePath) -> true | false | null
 *
 * null means "could not tell", which callers must treat as "do not touch the
 * file".  Guessing wrong here loses somebody's settings.
 */
export function isGameRunning(exePath) {
  const name = exePath ? basename(exePath) : 'gen1recomp.exe';
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('tasklist', ['/FI', `IMAGENAME eq ${name}`, '/NH'], {
        encoding: 'utf8', windowsHide: true,
      });
      return out.toLowerCase().includes(name.toLowerCase());
    }
    const out = execFileSync('ps', ['-A', '-o', 'comm='], { encoding: 'utf8' });
    const stem = name.replace(/\.exe$/i, '').toLowerCase();
    return out.toLowerCase().split('\n').some((line) => basename(line.trim()).toLowerCase() === stem);
  } catch {
    return null;
  }
}

// Lua arrays come back as { "1": ..., "2": ... }; put one back the same way so
// the writer emits [1], [2] again.
function toLuaArray(items) {
  const out = {};
  items.forEach((v, i) => { out[String(i + 1)] = v; });
  return out;
}

function backup(path) {
  let target = `${path}.pokepack-bak`;
  for (let n = 2; existsSync(target); n++) target = `${path}.pokepack-bak${n}`;
  copyFileSync(path, target);
  return target;
}

/**
 * setModEnabled(saveDir, id, on) -> result
 *
 * Switch one mod on or off without uninstalling it -- the thing you do when
 * you like a pack but want it *slightly* different.
 *
 * Same four conditions as applyToOptions: game closed, merge only, re-parsed
 * before it replaces anything, previous file kept.
 */
export function setModEnabled(saveDir, id, on, { exePath = null, running: runningOverride } = {}) {
  const running = runningOverride === undefined ? isGameRunning(exePath) : runningOverride;
  if (running === true) {
    return { changed: false, reason: 'the game is running -- close it first' };
  }
  if (running === null) {
    return { changed: false, reason: 'could not tell whether the game is running, so nothing was changed' };
  }

  const path = join(saveDir, OPTIONS);
  let options = {};
  const existed = existsSync(path);
  if (existed) {
    try {
      options = parse(readFileSync(path, 'utf8'));
    } catch (e) {
      return { changed: false, reason: `options.lua did not parse (${e.message})` };
    }
    if (!options || typeof options !== 'object') {
      return { changed: false, reason: 'options.lua is not a table' };
    }
  }

  options.mods = options.mods ?? {};
  options.mods[id] = on === true;

  let text;
  try {
    text = encode(options, { numericKeys: true });
    parse(text);
  } catch (e) {
    return { changed: false, reason: `refusing to write an options.lua that does not read back: ${e.message}` };
  }

  const backedUp = existed ? backup(path) : null;
  writeFileSync(path, text);
  return { changed: true, id, enabled: on === true, path, backedUp };
}

/**
 * applyToOptions(saveDir, pack, { installedIds, exePath }) -> result
 *
 * Returns { applied: false, reason } rather than throwing when it is simply not
 * safe to proceed -- that is an expected outcome, not an error.
 */
export function applyToOptions(saveDir, pack, {
  installedIds = null, exePath = null, running: runningOverride,
} = {}) {
  // running can be supplied directly so a test does not have to launch a game.
  const running = runningOverride === undefined ? isGameRunning(exePath) : runningOverride;
  if (running === true) {
    return { applied: false, reason: 'the game is running -- close it first, or import the profile from inside it' };
  }
  if (running === null) {
    return { applied: false, reason: 'could not tell whether the game is running, so options.lua was left alone' };
  }

  const path = join(saveDir, OPTIONS);
  let options = {};
  let existed = false;

  if (existsSync(path)) {
    existed = true;
    try {
      options = parse(readFileSync(path, 'utf8'));
    } catch (e) {
      return { applied: false, reason: `options.lua did not parse (${e.message}) -- leaving it alone` };
    }
    if (options === null || typeof options !== 'object') {
      return { applied: false, reason: 'options.lua is not a table -- leaving it alone' };
    }
  }
  // A missing options.lua is fine: SaveData.loadOptions runs mergeOptions over
  // the defaults, so a partial file is a legal file.  This is what makes a
  // freshly created instance work without launching the game first.

  const packed = pack.mods
    .map((m) => m.id)
    .filter((id) => !installedIds || installedIds.has(id));

  // 1. enable state
  options.mods = options.mods ?? {};
  for (const id of packed) options.mods[id] = true;
  for (const id of pack.disable) options.mods[id] = false;

  // 2. each mod's settings, merged key by key the way setOption would
  options.modOptions = options.modOptions ?? {};
  for (const mod of pack.mods) {
    if (!packed.includes(mod.id)) continue;
    if (Object.keys(mod.options).length === 0) continue;
    options.modOptions[mod.id] = { ...(options.modOptions[mod.id] ?? {}), ...mod.options };
  }

  // 3. the profile record, so the setup is also switchable from inside the game
  const name = pack.name.slice(0, 10);
  const enabled = {};
  for (const id of packed) enabled[id] = true;
  for (const id of pack.disable) enabled[id] = false;
  const record = {
    name,
    enabled,
    options: Object.fromEntries(
      pack.mods.filter((m) => packed.includes(m.id) && Object.keys(m.options).length)
        .map((m) => [m.id, { ...m.options }]),
    ),
    slots: { ...(pack.slots ?? {}) },
  };

  const profiles = toArray(options.modProfiles ?? {});
  const at = profiles.findIndex((p) => p && p.name === name);
  if (at >= 0) profiles[at] = record;
  else profiles.push(record);
  options.modProfiles = toLuaArray(profiles);
  // Suppress the first-run seeding of "PROFILE 1" from whatever happens to be
  // switched on -- we are supplying the profile, so there is nothing to infer.
  options.modProfilesSeeded = true;
  options.activeProfile = name;

  // 4. save slots, but only ones already registered.  SaveData.setActiveSlot
  // would register an unknown id and conjure a slot the player never made,
  // which is exactly what ModProfile.slotMoves refuses to do.
  const slotsMoved = [];
  for (const [version, slotId] of Object.entries(pack.slots ?? {})) {
    const reg = options.saveSlots?.[version];
    const list = toArray(reg?.list ?? {});
    if (reg && list.includes(slotId)) {
      reg.active = slotId;
      slotsMoved.push([version, slotId]);
    }
  }

  // Encode, then read it back before it replaces anything real.
  let text;
  try {
    text = encode(options, { numericKeys: true });
    parse(text);
  } catch (e) {
    return { applied: false, reason: `refusing to write an options.lua that does not read back: ${e.message}` };
  }

  const backedUp = existed ? backup(path) : null;
  writeFileSync(path, text);

  return {
    applied: true,
    path,
    backedUp,
    created: !existed,
    profile: name,
    enabled: packed,
    disabled: pack.disable,
    slotsMoved,
  };
}
