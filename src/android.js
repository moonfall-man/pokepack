// Move a finished setup onto an Android handheld.
//
// The engine already runs there -- touch controls, orientation lock, its own
// mod manager -- so nothing needs porting.  What is missing is a way to get a
// pack you built and tested on a desktop onto the device, because the two
// things pokepack produces cannot travel the way they do here:
//
//   - POKEPORT_IDENTITY is an environment variable, and an Android app has no
//     environment to set one in.  conf.lua falls back to "pokemon-love2d", so
//     the device has exactly one instance and the launchers/*.cmd trick that
//     gives every pack its own world on desktop has no equivalent.
//   - the hub is a Node program serving a local page.  There is no version of
//     that which is an APK.
//
// So the transfer is a file copy, and it works because the layout is already
// identical: Loader reads "mods" relative to love.filesystem's save directory
// on every platform (Loader.lua:204), options.lua sits beside it, and neither
// carries an absolute path.  conf.lua points the Android save directory at the
// app's external-files folder precisely so it can be written over USB with no
// runtime permission -- the same door the game asks players to push their ROM
// through.

import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, posix } from 'node:path';
import * as zip from './zip.js';

// Android's identity, fixed by conf.lua's `os.getenv("POKEPORT_IDENTITY") or
// "pokemon-love2d"` reaching the fallback every time.
export const ANDROID_IDENTITY = 'pokemon-love2d';

export const NOTES = 'HOW-TO-INSTALL.txt';

// An allowlist, not a skip-list, and that direction is the point.  A skip-list
// has to be updated every time the engine grows a folder, and the failure mode
// of forgetting is that ROM-derived data walks into an archive somebody then
// shares.  Here the failure mode of forgetting is a missing feature, which
// somebody will report.
export const SHIP = {
  mods: 'the mods themselves',
  'options.lua': 'which mods are on, and every tested setting',
  // The switch between packs on a device that only has one save directory.
  //
  // A .g1rmodlist is a named snapshot -- enabled set, each mod's own options, and
  // which save slot each game version plays -- and the game's mod manager
  // imports every one it finds sitting in this folder.  That import was built
  // folder-based on purpose: ManagerState says so, "it works on the mobile
  // builds where no picker exists".  So several packs can travel in one
  // archive and be switched between in-game, with no cable and no second
  // install.
  profiles: 'a switchable profile per pack, which the game imports on the device',
  'pokepack-installed.json': 'what each mod was pinned to, so the device can be checked later',
};

// Named so the report can say why something stayed behind rather than leaving
// a player wondering.  Anything not in SHIP is left regardless; these are the
// ones worth explaining.
const EXPLAIN = {
  red: 'ROM data -- yours, and the device imports its own',
  blue: 'ROM data -- yours, and the device imports its own',
  yellow: 'ROM data -- yours, and the device imports its own',
  saves: 'your save files, which would overwrite the ones on the device',
  ghostlink: 'link-play state, tied to this machine',
  'ghostlink-status.txt': 'link-play state, tied to this machine',
  'options.lua.bak': 'a backup of settings, not the settings',
};

function walk(root, rel, out) {
  for (const name of readdirSync(join(root, rel))) {
    // .pokepack-backup and .pokepack-trash live in here; so would anything else
    // that starts with a dot, and none of it is the player's mods.
    if (name.startsWith('.')) continue;
    const next = rel === '' ? name : posix.join(rel, name);
    const st = statSync(join(root, next));
    if (st.isDirectory()) walk(root, next, out);
    else if (st.isFile()) out.push({ name: next, size: st.size });
  }
}

/**
 * plan(saveDir) -> { files, bytes, left }
 *
 * What would travel, and what would not.  Separated from bundle() so the hub
 * can show the size before anyone waits for 18MB to compress.
 */
export function plan(saveDir) {
  if (!existsSync(saveDir)) throw new Error(`no such setup: ${saveDir}`);

  const files = [];
  for (const entry of Object.keys(SHIP)) {
    const path = join(saveDir, entry);
    if (!existsSync(path)) continue;
    if (statSync(path).isDirectory()) walk(saveDir, entry, files);
    else files.push({ name: entry, size: statSync(path).size });
  }

  const left = [];
  for (const name of readdirSync(saveDir)) {
    if (name in SHIP || name.startsWith('.')) continue;
    left.push({ name, why: EXPLAIN[name] ?? 'not part of the pack' });
  }

  return { files, bytes: files.reduce((n, f) => n + f.size, 0), left };
}

/**
 * notes({ packName, files, left }) -> string
 *
 * Rides inside the archive.  A zip that turns up on a handheld six weeks later
 * should still be able to say what it is and where it goes; the save directory
 * already holds a .txt (ghostlink-status.txt) so one more is nothing new, and
 * the ROM scan only ever looks at .gb/.gbc.
 */
export function notes({ packName = null, files = [], left = [] } = {}) {
  const lines = [
    packName ? `${packName} -- for gen1recomp on Android` : 'A gen1recomp setup, for Android',
    '',
    'WHERE THIS GOES',
    '',
    '  Extract the contents of this zip into the game\'s save folder, so that',
    '  "mods" and "options.lua" sit directly inside it.',
    '',
    '  The game shows you that folder: open it, go to import a ROM, and the',
    `  path is on screen. It looks like this, where <package> is the app's:`,
    '',
    `      Android/data/<package>/files/save/${ANDROID_IDENTITY}/`,
    '',
    '  That folder is reachable over USB and from any file manager without',
    '  granting anything -- the game puts it there on purpose so you can push',
    '  your ROM in the same way.',
    '',
    'WHAT IS IN HERE',
    '',
    ...Object.entries(SHIP).map(([k, why]) => `  ${k.padEnd(26)}${why}`),
    '',
    `  ${String(files.length).padEnd(26)}files in total`,
    '',
  ];

  if (left.length) {
    lines.push('WHAT WAS LEFT BEHIND', '');
    for (const l of left) lines.push(`  ${l.name.padEnd(26)}${l.why}`);
    lines.push('');
  }

  lines.push(
    'SWITCHING BETWEEN PACKS ON THE DEVICE',
    '',
    '  Android has no environment variables, so the game cannot be given a',
    '  separate folder per pack the way it is on a desktop. One folder, one',
    '  set of mods, one set of saves.',
    '',
    '  Profiles are how you switch anyway. Open the mod manager in the game and',
    '  import: it reads every profile in the "profiles" folder, and each one',
    '  restores its pack\'s enabled mods, their options, and its save slots.',
    '  Sending another pack adds another profile rather than replacing this one.',
    '',
    '  The catch is the shared mods folder: two packs that pin different',
    '  versions of the same mod cannot both be right at once, and the last one',
    '  copied wins.',
    '',
    '  Your saves are untouched either way -- they live in "saves", which this',
    '  zip does not carry.',
    '',
  );
  return lines.join('\n');
}

/**
 * bundle(saveDir, { packName }) -> { buffer, files, bytes, left }
 *
 * The archive itself.  Paths inside are relative to the save directory, so the
 * zip extracts straight into it with no folder to step over.
 */
export function bundle(saveDir, { packName = null } = {}) {
  const planned = plan(saveDir);
  if (planned.files.length === 0) {
    throw new Error(`${saveDir} has no mods or settings to send`);
  }

  const entries = planned.files.map((f) => ({
    name: f.name,
    data: readFileSync(join(saveDir, f.name)),
  }));
  entries.unshift({
    name: NOTES,
    data: Buffer.from(notes({ packName, ...planned }), 'utf8'),
  });

  return { buffer: zip.write(entries), ...planned };
}
