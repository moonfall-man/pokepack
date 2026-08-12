// Read a gen1recomp save directory: which mods are installed, at what version,
// which are switched on, and what the launcher has cached about them.
//
// Everything here is read-only.  The tool never writes into a save directory
// except for its own lock sidecar, and never touches options.lua -- the
// launcher owns that file and is perfectly capable of rewriting it underneath
// us mid-session.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse, toArray } from './luadata.js';

export const LOCK_FILE = 'pokepack-installed.json';

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

// An installed mod is an extracted folder, so the sha256 of the zip it came
// from is not recoverable from disk.  We record it at install time instead;
// without the sidecar, comparisons fall back to version strings.
function readLock(dir) {
  const doc = readJson(join(dir, LOCK_FILE));
  return doc && typeof doc === 'object' && doc.mods && typeof doc.mods === 'object'
    ? doc.mods
    : {};
}

export function readSaveDir(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(`not a directory: ${dir}`);
  }

  let options = {};
  const optionsPath = join(dir, 'options.lua');
  if (existsSync(optionsPath)) {
    options = parse(readFileSync(optionsPath, 'utf8')) ?? {};
  }

  const lock = readLock(dir);
  const mods = {};
  const modsDir = join(dir, 'mods');

  if (existsSync(modsDir)) {
    for (const folder of readdirSync(modsDir)) {
      const manifest = readJson(join(modsDir, folder, 'manifest.json'));
      if (!manifest || typeof manifest.id !== 'string') continue;
      const id = manifest.id;
      mods[id] = {
        id,
        folder,
        version: typeof manifest.version === 'string' ? manifest.version : null,
        // options.mods[id] is the enable map; the launcher writes false for a
        // disabled mod and leaves a never-touched mod missing, which means on.
        enabled: options.mods?.[id] !== false,
        sha256: lock[id]?.sha256 ?? null,
        github: typeof manifest.github === 'string' ? manifest.github : null,
        repo: typeof manifest.repo === 'string' ? manifest.repo : null,
      };
    }
  }

  // Which packs put something here.  The lock is the only honest source for
  // this -- a mod matching a pack's list may just as easily have been installed
  // by hand years earlier.
  const installedPacks = {};
  for (const [id, rec] of Object.entries(lock)) {
    if (!rec?.pack || !mods[id]) continue;
    (installedPacks[rec.pack] ??= []).push(id);
  }

  return {
    dir,
    mods,
    installedPacks,
    modOptions: options.modOptions ?? {},
    profiles: toArray(options.modProfiles ?? {}),
    activeProfile: options.activeProfile ?? null,
    indexCache: options.modIndexCache ?? {},
    updateCache: options.modUpdateCache ?? {},
  };
}

// Every release the launcher has already seen, keyed by mod id, newest first.
// This is what makes an offline `build` possible: the versions and asset URLs
// are sitting in options.modUpdateCache from the last time the player opened
// the update panel.
export function releasesFromCache(state) {
  const out = new Map();
  for (const [repo, entry] of Object.entries(state.updateCache ?? {})) {
    const releases = toArray(entry?.releases ?? {});
    if (releases.length === 0) continue;
    out.set(repo, releases.map((r) => ({
      version: r.version ?? r.tag ?? null,
      tag: r.tag ?? null,
      published: r.published ?? null,
      prerelease: r.prerelease === true,
      zip: r.zip ? { name: r.zip.name ?? null, url: r.zip.url ?? null, size: r.zip.size ?? null } : null,
    })));
  }
  return out;
}

// Index entries the launcher has cached, keyed by mod id.  Shape mirrors
// ModIndex.parse output closely enough for resolve() to read dependencies and
// conflicts off it.
export function indexFromCache(state) {
  const out = {};
  for (const entry of Object.values(state.indexCache ?? {})) {
    const mods = toArray(entry?.index?.mods ?? entry?.mods ?? {});
    for (const mod of mods) {
      if (mod && typeof mod.id === 'string') out[mod.id] = mod;
    }
  }
  return out;
}

// Merge one or more index.json documents (already JSON-parsed) into the
// { [id]: entry } map resolve() wants.
export function indexFromFeeds(feeds) {
  const out = {};
  for (const feed of feeds) {
    for (const mod of feed?.mods ?? []) {
      if (mod && typeof mod.id === 'string') out[mod.id] = mod;
    }
  }
  return out;
}
