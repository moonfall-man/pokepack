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
export function saveRoots() {
  const home = homedir();
  const roots = [];
  if (process.platform === 'win32') {
    if (process.env.APPDATA) roots.push(join(process.env.APPDATA, 'LOVE'));
  } else if (process.platform === 'darwin') {
    roots.push(join(home, 'Library', 'Application Support', 'LOVE'));
  } else {
    roots.push(join(process.env.XDG_DATA_HOME ?? join(home, '.local', 'share'), 'love'));
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

// Does this look like a gen1recomp save rather than some other LOVE game?
function inspect(path) {
  const optionsPath = join(path, 'options.lua');
  const hasOptions = existsSync(optionsPath);
  const hasMods = existsSync(join(path, 'mods'));
  const hasSaves = existsSync(join(path, 'saves'));
  if (!hasOptions && !hasMods && !hasSaves) return null;

  let mods = 0;
  let profiles = [];
  let looksRight = hasMods || hasSaves;

  if (hasMods) {
    try {
      mods = readdirSync(join(path, 'mods'))
        .filter((n) => !n.startsWith('.') && existsSync(join(path, 'mods', n, 'manifest.json')))
        .length;
    } catch { /* unreadable is not fatal; it just scores lower */ }
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

  return found.sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    if (a.profiles.length !== b.profiles.length) return b.profiles.length - a.profiles.length;
    if (a.mods !== b.mods) return b.mods - a.mods;
    return a.identity < b.identity ? -1 : 1;
  });
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
