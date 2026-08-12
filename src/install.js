// Putting a mod on disk, and leaving the launcher a profile to import.
//
// The rules here are copied from LauncherMods._installZipInner rather than
// invented: find the folder holding manifest.json, refuse a zip whose id is not
// the one being installed, and land it at mods/<id>.  The loader re-validates
// every manifest at load time anyway, so the worst a bad install can do is get
// refused with a reason on screen -- but failing here is friendlier than
// failing at boot.
//
// Nothing is ever deleted.  Replacing a mod moves the old copy aside; the
// player's install is not ours to throw away, and "it is easy to redownload"
// is not the same as "it is fine to remove".

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import * as zip from './zip.js';
import { encodeModList, fileNameFor } from './luawrite.js';
import { LOCK_FILE } from './state.js';

export const BACKUP_DIR = '.pokepack-backup';

function readManifest(entries, root) {
  const entry = entries.find((e) => e.name.replace(/\\/g, '/') === `${root}manifest.json`);
  if (!entry) throw new Error('the zip has no readable manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(entry.data().toString('utf8'));
  } catch (e) {
    throw new Error(`invalid mod manifest: ${e.message}`);
  }
  if (typeof manifest.id !== 'string' || manifest.id === '') {
    throw new Error('invalid mod manifest: no id');
  }
  if (typeof manifest.version !== 'string' || manifest.version === '') {
    throw new Error('invalid mod manifest: no version');
  }
  return manifest;
}

/**
 * installMod(buffer, { saveDir, expectId, sha256, replace }) -> result
 *
 * replace: move any existing copy aside first.  Off by default -- overwriting
 * an install the player already has is their call, not ours.
 */
export function installMod(buffer, { saveDir, expectId, sha256 = null, replace = false, pack = null } = {}) {
  const entries = zip.read(buffer);
  const root = zip.locateRoot(entries);
  if (typeof root !== 'string') throw new Error(root.error);

  const manifest = readManifest(entries, root);
  if (expectId && manifest.id !== expectId) {
    throw new Error(`zip is for '${manifest.id}', expected '${expectId}'`);
  }

  const dest = join(saveDir, 'mods', manifest.id);
  let backedUp = null;

  if (existsSync(dest)) {
    if (!replace) {
      throw new Error(`a mod named '${manifest.id}' is already installed`);
    }
    const stamp = `${manifest.id}-${readInstalledVersion(dest) ?? 'unknown'}`;
    const backupRoot = join(saveDir, 'mods', BACKUP_DIR);
    mkdirSync(backupRoot, { recursive: true });
    let target = join(backupRoot, stamp);
    for (let n = 2; existsSync(target); n++) target = join(backupRoot, `${stamp}-${n}`);
    renameSync(dest, target);
    backedUp = target;
  }

  let written = 0;
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const rel = entry.name.replace(/\\/g, '/');
    if (!rel.startsWith(root)) continue;
    const inner = rel.slice(root.length);
    if (inner === '' || !zip.safeEntryName(inner)) {
      throw new Error(`the zip contains an unsafe path: ${entry.name}`);
    }
    const out = join(dest, inner);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, entry.data());
    written++;
  }

  if (written === 0) throw new Error('the zip held no files for this mod');

  if (sha256 || pack) {
    recordInstall(saveDir, manifest.id, { version: manifest.version, sha256, pack });
  }

  return { id: manifest.id, version: manifest.version, dest, files: written, backedUp };
}

function readInstalledVersion(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')).version ?? null;
  } catch {
    return null;
  }
}

// The sidecar that makes hash comparison work later.  An installed mod is an
// extracted folder, so the digest of the zip it came from is not recoverable
// from disk -- it has to be written down at the moment we have it.
export function recordInstall(saveDir, id, { version, sha256, pack = null }) {
  const path = join(saveDir, LOCK_FILE);
  let doc = { mods: {} };
  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8'));
      if (parsed && typeof parsed.mods === 'object') doc = parsed;
    } catch {
      // a corrupt sidecar is not worth failing an install over; it gets rebuilt
    }
  }
  doc.mods[id] = { version, sha256, ...(pack ? { pack } : {}) };
  writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);
  return path;
}

/**
 * Write a pack out as a .g1rmodlist the launcher can import.
 *
 * This is the whole reason no engine change is needed.  The launcher already
 * imports these, and importing applies the enable set, every mod's options and
 * the save slots.  We do the half it could not do -- fetching -- and hand the
 * rest back to the code that already works.
 */
export function writeProfile(saveDir, pack, { installedIds = null } = {}) {
  const enabled = {};
  for (const mod of pack.mods) {
    if (!installedIds || installedIds.has(mod.id)) enabled[mod.id] = true;
  }
  for (const id of pack.disable) enabled[id] = false;

  const options = {};
  for (const mod of pack.mods) {
    if (Object.keys(mod.options).length > 0) options[mod.id] = { ...mod.options };
  }

  const name = pack.name.slice(0, 10);
  const dir = join(saveDir, 'profiles');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, fileNameFor(name));
  writeFileSync(path, encodeModList({ name, enabled, options, slots: pack.slots ?? {} }));
  return { path, name };
}

export function listBackups(saveDir) {
  const dir = join(saveDir, 'mods', BACKUP_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((n) => join(dir, n));
}
