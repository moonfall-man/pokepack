// Separate instances: the isolation Wabbajack and Nolvus get by installing each
// modlist into its own folder.
//
// gen1recomp already supports it, and this repo did not have to invent it --
// conf.lua reads POKEPORT_IDENTITY, and LOVE gives every identity its own
// mods/, saves/ and options.lua.  So an instance is a folder plus a shortcut
// that sets one environment variable, and two packs pinning different versions
// of the same mod stop fighting.

import {
  existsSync, mkdirSync, writeFileSync, statSync, readdirSync, cpSync, renameSync,
} from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname, basename } from 'node:path';
import { saveRoots, DEFAULT_IDENTITY, cleanPath } from './discover.js';

// The identity becomes a folder name on disk and an environment variable, so
// keep it boring.  No dots at the front (hidden folders), no separators.
const IDENTITY_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function validIdentity(identity) {
  if (typeof identity !== 'string' || !IDENTITY_RE.test(identity)) {
    return { ok: false, reason: 'use letters, digits, dashes, dots and underscores (starting with a letter or digit)' };
  }
  if (identity === DEFAULT_IDENTITY) {
    return { ok: false, reason: `${DEFAULT_IDENTITY} is the game's own default instance -- pick another name` };
  }
  return { ok: true };
}

/**
 * createInstance({ identity, loveRoot }) -> { path, identity }
 *
 * Refuses an identity that already exists.  An existing instance holds
 * somebody's saves; "create" must never mean "walk into".
 */
export function createInstance({ identity, loveRoot = null }) {
  const check = validIdentity(identity);
  if (!check.ok) throw new Error(check.reason);

  const root = loveRoot ?? saveRoots()[0];
  if (!root) throw new Error('could not find LOVE\'s save folder on this machine');

  const path = join(root, identity);
  if (existsSync(path)) {
    throw new Error(`an instance called ${identity} already exists at ${path}`);
  }

  // mods/ is what makes the folder recognisable as a game save before the game
  // has ever run and written options.lua.
  mkdirSync(join(path, 'mods'), { recursive: true });
  return { path, identity, root };
}

// Removing an instance takes save files with it, and a save file is the one
// thing in here nobody can redownload.  So it never actually deletes: the folder
// moves to a trash folder beside it, under its own name and a timestamp, and
// dragging it back is a complete undo.
export const TRASH_DIR = '.pokepack-trash';

function walk(dir, out = { files: 0, bytes: 0 }) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out; // unreadable is not fatal -- the total is a warning, not an audit
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(path, out);
    } else {
      out.files++;
      try {
        out.bytes += statSync(path).size;
      } catch { /* vanished mid-walk */ }
    }
  }
  return out;
}

/**
 * describeInstance(path) -> { mods, saves, romVersions, files, bytes }
 *
 * What is actually inside, so a confirmation can name it.  "Are you sure?"
 * about an unknown quantity is not a warning; "12 mods and 3 save files" is.
 */
export function describeInstance(path) {
  const mods = [];
  try {
    for (const name of readdirSync(join(path, 'mods'))) {
      if (name.startsWith('.')) continue; // the backup folder is not a mod
      if (existsSync(join(path, 'mods', name, 'manifest.json'))) mods.push(name);
    }
  } catch { /* no mods folder */ }

  let saves = [];
  try {
    saves = readdirSync(join(path, 'saves')).filter((n) => !n.startsWith('.'));
  } catch { /* never played here */ }

  return { path, mods, saves, romVersions: romVersionsIn(path), ...walk(path) };
}

/**
 * trashInstance({ identity, confirm }) -> { from, to }
 *
 * Guards, in order:
 *   1. a name shaped like an identity -- which already rules out the game's own
 *      default folder, where a plain launch of gen1recomp writes;
 *   2. a confirmation that matches that name exactly;
 *   3. a folder that really sits under LOVE's save root.  The caller names an
 *      instance, never a path, so no request can point this at anything else.
 */
export function trashInstance({ identity, confirm, loveRoot = null, now = new Date() }) {
  if (identity === DEFAULT_IDENTITY) {
    throw new Error(`${DEFAULT_IDENTITY} is the game's own save folder -- it is where gen1recomp writes when nothing sets an instance, so pokepack will not remove it`);
  }
  const check = validIdentity(identity);
  if (!check.ok) throw new Error(check.reason);
  if (confirm !== identity) throw new Error(`type ${identity} exactly to confirm`);

  const roots = loveRoot ? [loveRoot] : saveRoots();
  const root = roots.find((r) => existsSync(join(r, identity)));
  if (!root) throw new Error(`no instance called ${identity}`);

  const from = join(root, identity);
  if (!statSync(from).isDirectory()) throw new Error(`${from} is not a folder`);

  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const trash = join(root, TRASH_DIR);
  mkdirSync(trash, { recursive: true });

  let to = join(trash, `${identity}-${stamp}`);
  for (let n = 2; existsSync(to); n++) to = join(trash, `${identity}-${stamp}-${n}`);
  renameSync(from, to); // same volume as the root it came from, so this is atomic

  return { identity, from, to, trash };
}

// Does this look like the game rather than some other executable?
export function checkGameExe(input) {
  const path = cleanPath(input);
  if (!path) return { ok: false, reason: 'no path given' };
  if (!existsSync(path)) {
    return { ok: false, path, reason: `that file does not exist: ${path}` };
  }
  try {
    if (!statSync(path).isFile()) {
      return { ok: false, path, reason: 'that is a folder, not the game executable' };
    }
  } catch (e) {
    return { ok: false, path, reason: e.message };
  }
  const name = basename(path).toLowerCase();
  if (!name.endsWith('.exe') && process.platform === 'win32') {
    return { ok: false, path, reason: 'expected a .exe' };
  }
  // A fused LOVE build ships love.dll beside it; a bare love.exe works too.
  const beside = existsSync(join(dirname(path), 'love.dll'))
    || existsSync(join(dirname(path), 'liblove.so'))
    || name.includes('love');
  if (!name.includes('gen1recomp') && !beside) {
    return { ok: false, path, reason: 'that does not look like gen1recomp (no love runtime beside it)' };
  }
  return { ok: true, path };
}

// The game unpacks your ROM into <instance>/<version>/ once and marks it done
// with rom-cache.complete.  A brand new instance has none, which is why it
// cannot get past the title screen -- there is nothing to boot.
export const VERSIONS = ['red', 'blue', 'yellow'];

export function romVersionsIn(dir) {
  if (!dir) return [];
  return VERSIONS.filter((v) => existsSync(join(dir, v, 'rom-cache.complete')));
}

// Instances that already have unpacked ROM data, richest first -- candidates
// to seed a new instance from.
export function romSources() {
  const out = [];
  for (const root of saveRoots()) {
    let names;
    try {
      names = readdirSync(root);
    } catch {
      continue;
    }
    for (const identity of names) {
      const path = join(root, identity);
      const versions = romVersionsIn(path);
      if (versions.length) out.push({ identity, path, versions });
    }
  }
  return out.sort((a, b) => b.versions.length - a.versions.length);
}

/**
 * seedRomData(fromDir, toDir) -> { copied }
 *
 * Copies the unpacked ROM data from one of your instances to another.  This is
 * your own data moving between your own folders -- nothing is downloaded and
 * nothing leaves the machine, and no ROM is created that did not already exist.
 *
 * Saves are deliberately NOT copied.  A new instance starting with somebody
 * else's progress is not a new instance.
 */
export function seedRomData(fromDir, toDir) {
  const versions = romVersionsIn(fromDir);
  if (versions.length === 0) throw new Error(`${fromDir} has no unpacked ROM data to copy`);

  const copied = [];
  for (const v of versions) {
    const dest = join(toDir, v);
    if (existsSync(dest)) continue; // never overwrite data already there
    cpSync(join(fromDir, v), dest, { recursive: true });
    copied.push(v);
  }
  return { copied, from: fromDir };
}

// Which identity does this save folder represent?  It is just the folder name
// under LOVE's save root -- but only if it really is under one, because the
// setup screen lets you type any path and a folder somewhere else cannot be
// reached by setting POKEPORT_IDENTITY.
export function identityFor(saveDir) {
  if (!saveDir) return null;
  const parent = dirname(saveDir);
  const known = saveRoots().some((root) => root.toLowerCase() === parent.toLowerCase());
  return known ? basename(saveDir) : null;
}

/**
 * launchGame({ exePath, identity }) -> { pid }
 *
 * The exe comes from stored config, never from the request that asked to play.
 * A local server that will start whatever binary a caller names is a different
 * and much worse thing than one that starts the game you already pointed it at.
 */
export function launchGame({ exePath, identity, version = null }) {
  const check = checkGameExe(exePath);
  if (!check.ok) throw new Error(check.reason);
  if (identity !== null && !validIdentity(identity).ok && identity !== DEFAULT_IDENTITY) {
    throw new Error(`refusing to launch with a strange instance name: ${identity}`);
  }
  if (version !== null && !VERSIONS.includes(version)) {
    throw new Error(`not a game version: ${version}`);
  }

  const env = { ...process.env };
  if (identity) env.POKEPORT_IDENTITY = identity;
  else delete env.POKEPORT_IDENTITY; // fall back to the game's own default

  // Boot straight into the game instead of the engine's own launcher screen.
  // gen1recomp reads this for exactly this case -- its own comment calls a menu
  // in between a defect for shortcut launches -- and if the version turns out
  // not to be imported it opens the launcher on that tab rather than failing.
  if (version) env.POKEPORT_GAME = version;
  else delete env.POKEPORT_GAME;

  const child = spawn(check.path, [], {
    env,
    cwd: dirname(check.path),
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return { pid: child.pid, identity: identity ?? DEFAULT_IDENTITY, version };
}

/**
 * writeLauncher -> { path }
 *
 * A tiny script rather than a shortcut file: a .cmd is readable, editable, and
 * you can see exactly what it sets.  Nothing here is magic.
 */
export function writeLauncher({ identity, exePath, outDir, packName = null, version = null }) {
  mkdirSync(outDir, { recursive: true });
  if (version !== null && !VERSIONS.includes(version)) {
    throw new Error(`not a game version: ${version}`);
  }

  if (process.platform === 'win32') {
    const path = join(outDir, `play-${identity}.cmd`);
    writeFileSync(path,
      '@echo off\r\n'
      + `rem Launches gen1recomp in its own instance: "${identity}"\r\n`
      + (packName ? `rem Built for the pack "${packName}"\r\n` : '')
      + 'rem Mods, saves and settings here are separate from every other instance.\r\n'
      + `set "POKEPORT_IDENTITY=${identity}"\r\n`
      + (version
        ? 'rem Boots straight into the game instead of the launcher screen.\r\n'
          + `set "POKEPORT_GAME=${version}"\r\n`
        : '')
      + `start "" "${exePath}"\r\n`);
    return { path };
  }

  const path = join(outDir, `play-${identity}.sh`);
  writeFileSync(path,
    '#!/bin/sh\n'
    + `# Launches gen1recomp in its own instance: "${identity}"\n`
    + (packName ? `# Built for the pack "${packName}"\n` : '')
    + (version ? '# Boots straight into the game instead of the launcher screen.\n' : '')
    + `POKEPORT_IDENTITY=${identity} ${version ? `POKEPORT_GAME=${version} ` : ''}exec "${exePath}"\n`,
    { mode: 0o755 });
  return { path };
}
