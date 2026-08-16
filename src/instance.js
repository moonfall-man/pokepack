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
  openSync, closeSync,
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

  // mods/ plus our own lock file.  A bare mods/ folder is not enough to claim
  // a directory under <APPDATA>, which is shared with every other application
  // -- the lock file is what says this one is ours before the game has ever
  // run and written options.lua.
  mkdirSync(join(path, 'mods'), { recursive: true });
  writeFileSync(join(path, 'pokepack-installed.json'), `${JSON.stringify({ mods: {} }, null, 2)}\n`);
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
 * raiseWindow(pid) -> true | false
 *
 * Bring the game in front of the browser you pressed Play in.
 *
 * Best effort, and it says so: Windows refuses SetForegroundWindow to a process
 * that does not already own the foreground, which a local server started from a
 * browser tab generally does not.  The alt-key tap is the documented way round
 * that -- it makes the shell hand over the foreground lock -- and it still fails
 * sometimes.  Detached so a game that takes ten seconds to open its window does
 * not hold up the response.
 */
function raiseWindow(pid) {
  if (process.platform !== 'win32' || !pid) return false;
  // AttachThreadInput to whichever thread currently owns the foreground: that
  // borrows its foreground rights for the moment it takes to raise the window,
  // and is the documented way through the lock.  SetForegroundWindow on its own
  // is simply ignored from here -- tested, and it does nothing.
  const script = `
    Add-Type -MemberDefinition @'
      [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
      [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
      [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
      [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
      [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr p);
      [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool f);
      [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
'@ -Name Fg -Namespace P | Out-Null
    for ($i = 0; $i -lt 40; $i++) {
      $p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue
      if (-not $p) { break }
      $h = $p.MainWindowHandle
      if ($h -ne 0) {
        $me = [P.Fg]::GetCurrentThreadId()
        $them = [P.Fg]::GetWindowThreadProcessId([P.Fg]::GetForegroundWindow(), [IntPtr]::Zero)
        [P.Fg]::AttachThreadInput($me, $them, $true) | Out-Null
        [P.Fg]::ShowWindow($h, 9) | Out-Null
        [P.Fg]::BringWindowToTop($h) | Out-Null
        [P.Fg]::SetForegroundWindow($h) | Out-Null
        [P.Fg]::AttachThreadInput($me, $them, $false) | Out-Null
        break
      }
      Start-Sleep -Milliseconds 250
    }`;
  try {
    const child = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
      detached: true, stdio: 'ignore', windowsHide: true,
    });
    child.unref();
    return true;
  } catch {
    return false; // never worth failing a launch over
  }
}

/**
 * launchGame({ exePath, identity }) -> { pid }
 *
 * The exe comes from stored config, never from the request that asked to play.
 * A local server that will start whatever binary a caller names is a different
 * and much worse thing than one that starts the game you already pointed it at.
 */
export const RUN_LOG = 'pokepack-run.log';
export const RUN_LOG_PREV = 'pokepack-run.log.1';

/**
 * openRunLog(saveDir) -> fd | null
 *
 * The game prints everything it knows to stdout -- the mod loader's warnings,
 * which mods loaded, and whatever it manages to say on the way down.  Launching
 * with stdio 'ignore' threw all of that away, so a crash left nothing behind
 * unless it happened to be a Lua error the engine could catch.  A graphics
 * fault is not, which is exactly the kind that ends a session abruptly.
 *
 * The previous run is kept: the log you want is almost always the one from the
 * launch that just died, and the next launch would otherwise overwrite it.
 */
function openRunLog(saveDir) {
  if (!saveDir) return null;
  try {
    const path = join(saveDir, RUN_LOG);
    if (existsSync(path)) {
      try {
        renameSync(path, join(saveDir, RUN_LOG_PREV));
      } catch { /* keeping the previous run is a nicety, not a reason to fail */ }
    }
    return openSync(path, 'w');
  } catch {
    return null; // a log we cannot write must never stop the game starting
  }
}

export function launchGame({ exePath, identity, version = null, saveDir = null, raise = false }) {
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

  const log = openRunLog(saveDir);
  const child = spawn(check.path, [], {
    env,
    cwd: dirname(check.path),
    detached: true,
    stdio: log === null ? 'ignore' : ['ignore', log, log],
  });
  child.unref();
  // The child holds its own handle; ours would otherwise leak for the life of
  // the hub, and on Windows keep the file locked against the next rotation.
  if (log !== null) {
    try {
      closeSync(log);
    } catch { /* already gone */ }
  }
  // Off unless asked for.  This borrows another window's input queue through
  // AttachThreadInput, which Microsoft's own documentation warns can wedge
  // input, and it has never been shown to work -- it failed both tests it was
  // given when it was written.  An unverified invasive trick that fires on
  // every launch is a bad trade even when it turns out to be innocent, and
  // while a controller was mysteriously dead it was one more thing that had to
  // be argued about rather than ruled out.  Set raiseWindow in config.json to
  // turn it back on.
  const raised = raise ? raiseWindow(child.pid) : false;
  return {
    pid: child.pid,
    identity: identity ?? DEFAULT_IDENTITY,
    version,
    raised,
    log: log === null ? null : join(saveDir, RUN_LOG),
  };
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
