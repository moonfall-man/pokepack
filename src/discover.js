// Find the game's save folders, so nobody has to type a path.
//
// LOVE keeps a game's save directory at <platform save root>/<identity>, and
// gen1recomp's conf.lua sets identity to POKEPORT_IDENTITY or "pokemon-love2d".
// That env var is why one machine has several -- separate instances for couch
// testing each get their own folder -- so this lists them all and lets the
// player choose rather than guessing.

import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parse, toArray } from './luadata.js';

export const DEFAULT_IDENTITY = 'pokemon-love2d';

// Where LOVE puts save directories on each platform.
//
// There are two answers, and picking the wrong one is invisible until the game
// reports no mods:
//
//   fused      <APPDATA>/<identity>          -- a standalone game.exe
//   unfused    <APPDATA>/LOVE/<identity>     -- `love .` during development
//
// LOVE drops the LOVE/ folder for a fused build, because a shipped game has no
// business filing itself under the engine's name.  gen1recomp ships fused, so
// the real save directory is the first form -- and a mod installed into the
// second lands in a folder the game never reads.
//
// Both are returned, fused first, so an instance made here goes where the
// shipped game will look while a dev running from source is still found.
export function saveRoots() {
  const home = homedir();
  const roots = [];
  if (process.platform === 'win32') {
    if (process.env.APPDATA) roots.push(process.env.APPDATA, join(process.env.APPDATA, 'LOVE'));
  } else if (process.platform === 'darwin') {
    const base = join(home, 'Library', 'Application Support');
    roots.push(base, join(base, 'LOVE'));
  } else {
    const base = process.env.XDG_DATA_HOME ?? join(home, '.local', 'share');
    roots.push(base, join(base, 'love'));
  }
  return roots.filter(existsSync);
}

// Which packs installed something into this folder, from the lock sidecar.
// This is what lets the hub show every instance at once instead of making you
// switch folders to remember what you have.
function packsIn(path) {
  const out = {};
  try {
    const doc = JSON.parse(readFileSync(join(path, 'pokepack-installed.json'), 'utf8'));
    for (const [id, rec] of Object.entries(doc?.mods ?? {})) {
      if (rec?.pack && existsSync(join(path, 'mods', id))) (out[rec.pack] ??= []).push(id);
    }
  } catch {
    // no sidecar, or unreadable -- the folder simply has no pack-installed mods
  }
  return out;
}

// Does this look like a gen1recomp save rather than some other game?
//
// This has to be strict, because the fused save root is <APPDATA> itself --
// shared with every other application on the machine.  "has a mods folder and a
// saves folder" describes Factorio, and mistaking somebody's Factorio install
// for a pack would put mods in it.  So the evidence has to be gen1recomp's:
// its options keys, a mod with our manifest shape, an unpacked ROM cache, or a
// lock file we wrote ourselves.
function inspect(path) {
  const optionsPath = join(path, 'options.lua');
  const hasOptions = existsSync(optionsPath);
  const hasMods = existsSync(join(path, 'mods'));
  const hasSaves = existsSync(join(path, 'saves'));
  if (!hasOptions && !hasMods && !hasSaves) return null;

  let mods = 0;
  let profiles = [];
  // Ours beyond doubt: written by this tool, including for a brand new instance
  // that has nothing else in it yet.
  let looksRight = existsSync(join(path, 'pokepack-installed.json'))
    || ['red', 'blue', 'yellow'].some((v) => existsSync(join(path, v, 'rom-cache.complete')));

  if (hasMods) {
    try {
      mods = readdirSync(join(path, 'mods'))
        .filter((n) => !n.startsWith('.') && existsSync(join(path, 'mods', n, 'manifest.json')))
        .length;
    } catch { /* unreadable is not fatal; it just scores lower */ }
    // A gen1recomp mod is a folder with a manifest.json.  Factorio's mods are
    // zips, and other games' are anything but this.
    if (mods > 0) looksRight = true;
  }

  if (hasOptions) {
    try {
      const opts = parse(readFileSync(optionsPath, 'utf8'));
      // These keys are gen1recomp's, not LOVE's -- their presence is what
      // separates this game's folder from any other LOVE game's.
      if (opts && (opts.modProfiles !== undefined || opts.battleStyle !== undefined)) {
        looksRight = true;
      }
      profiles = toArray(opts?.modProfiles ?? {}).map((p) => p.name).filter(Boolean);
    } catch { /* a save mid-write can fail to parse; still a candidate */ }
  }

  return looksRight ? { mods, profiles, packs: packsIn(path) } : null;
}

/**
 * findSaveDirs() -> [{ path, identity, mods, profiles, isDefault }]
 *
 * Sorted so the likeliest choice is first: the stock identity, then whichever
 * has the most installed mods.
 */
export function findSaveDirs() {
  const found = [];
  for (const root of saveRoots()) {
    let names;
    try {
      names = readdirSync(root);
    } catch {
      continue;
    }
    for (const identity of names) {
      // A dot folder is never an identity: gen1recomp cannot produce one, and
      // it is where deleted instances are parked.  A trashed setup reappearing
      // in the list would make deleting look broken.
      if (identity.startsWith('.')) continue;
      const path = join(root, identity);
      try {
        if (!statSync(path).isDirectory()) continue;
      } catch {
        continue;
      }
      const info = inspect(path);
      if (info) {
        found.push({ path, identity, ...info, isDefault: identity === DEFAULT_IDENTITY });
      }
    }
  }

  // The same identity can exist under both roots -- typically because an older
  // build wrote to the unfused one.  Keep the fused copy, which is the one the
  // shipped game actually reads, and report the other as a stray so the hub can
  // offer to move its mods across rather than silently ignoring them.
  const seen = new Map();
  const strays = [];
  for (const entry of found) {
    const first = seen.get(entry.identity);
    if (first) strays.push({ ...entry, shadowedBy: first.path });
    else seen.set(entry.identity, entry);
  }

  const out = [...seen.values()].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    if (a.profiles.length !== b.profiles.length) return b.profiles.length - a.profiles.length;
    if (a.mods !== b.mods) return b.mods - a.mods;
    return a.identity < b.identity ? -1 : 1;
  });
  out.strays = strays;
  return out;
}

// Windows Explorer's "Copy as path" wraps the path in double quotes, and any
// pasted path can pick up stray whitespace.  Both are somebody doing the normal
// thing, so strip them -- reporting a file that plainly exists as missing is the
// tool being wrong, not the user.
export function cleanPath(input) {
  if (typeof input !== 'string') return '';
  let s = input.trim();
  while (
    s.length >= 2
    && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

// Confirm a path the player typed in themselves.  Returns a reason rather than
// a bare false, because "that is not a game folder" is not useful on its own,
// and echoes back the path actually tried so a bad paste is obvious.
export function checkSaveDir(input) {
  const path = cleanPath(input);
  if (!path) return { ok: false, reason: 'no folder given' };
  if (!existsSync(path)) {
    return { ok: false, path, reason: `that folder does not exist: ${path}` };
  }
  try {
    if (!statSync(path).isDirectory()) {
      return { ok: false, path, reason: 'that is a file, not a folder' };
    }
  } catch (e) {
    return { ok: false, path, reason: e.message };
  }
  const info = inspect(path);
  if (!info) {
    return {
      ok: false,
      path,
      reason: 'that folder has no options.lua, mods/ or saves/ -- it does not look like a gen1recomp save folder',
    };
  }
  return { ok: true, path, ...info };
}
