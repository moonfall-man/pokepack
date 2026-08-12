// Your ROM, linked once.
//
// The game scans <instance>/baseroms/ for a .gb and unpacks it itself -- so a
// new instance does not need the *unpacked* data copied from somewhere, it just
// needs the cartridge file where the game already looks.  That is the whole
// mechanism, and it is why "link your ROM in Settings" is enough to make every
// future instance work.
//
// This repo ships no ROM and never will.  It copies a file you already have,
// between folders you already own, on your own machine.

import { readFileSync, existsSync, statSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, basename, resolve } from 'node:path';
import { cleanPath } from './discover.js';

export const BASEROMS_DIR = 'baseroms';

// From the engine's own GameVersion.VERSIONS -- the sha1 of each supported
// dump.  Matching against these means we can say "that is Blue, not Red"
// instead of letting the game fail quietly later.
export const KNOWN = {
  ea9bcae617fdf159b045185467ae58b2e4a48b9a: { version: 'red', label: 'Pokemon Red' },
  d7037c83e1ae5b39bde3c30787637ba1d4c48ce2: { version: 'blue', label: 'Pokemon Blue' },
  cc7d03262ebfaf2f06772c1a480c7d9d5f4a38e1: { version: 'yellow', label: 'Pokemon Yellow' },
};

const MAX_ROM_BYTES = 4 * 1024 * 1024;

/**
 * identifyRom(path) -> { ok, path, sha1, version, label } | { ok:false, reason }
 */
export function identifyRom(input) {
  const cleaned = cleanPath(input);
  if (!cleaned) return { ok: false, reason: 'no file given' };
  // Absolute, always.  This path is stored in a machine-global config and read
  // back by a hub that may be running from anywhere.
  const path = resolve(cleaned);
  if (!existsSync(path)) return { ok: false, path, reason: `that file does not exist: ${path}` };

  let size;
  try {
    const st = statSync(path);
    if (!st.isFile()) return { ok: false, path, reason: 'that is a folder, not a ROM file' };
    size = st.size;
  } catch (e) {
    return { ok: false, path, reason: e.message };
  }
  // Guard before reading: a Game Boy cartridge is around a megabyte, and this
  // should never slurp a DVD image into memory because someone mis-clicked.
  if (size > MAX_ROM_BYTES) {
    return { ok: false, path, reason: `that file is ${(size / 1048576).toFixed(1)} MB -- too big to be a Game Boy ROM` };
  }

  const sha1 = createHash('sha1').update(readFileSync(path)).digest('hex');
  const known = KNOWN[sha1];
  if (!known) {
    return {
      ok: false,
      path,
      sha1,
      reason: 'that is not a Red, Blue or Yellow ROM this build knows (its checksum matches none of them)',
    };
  }
  return { ok: true, path, sha1, version: known.version, label: known.label };
}

// Is there already a cartridge waiting where the game looks?
export function baseromsIn(dir) {
  const d = join(dir, BASEROMS_DIR);
  if (!existsSync(d)) return [];
  try {
    return readdirSync(d).filter((n) => /\.gbc?$/i.test(n) && !n.startsWith('.'));
  } catch {
    return [];
  }
}

/**
 * linkRom(romPath, instanceDir) -> { copied, to, label }
 *
 * Drops the cartridge into <instance>/baseroms/, which is where the game's own
 * importer scans.  It unpacks on next launch and writes its own cache -- we
 * never fabricate the derived data, we just put the source where it is found.
 */
export function linkRom(romPath, instanceDir) {
  const rom = identifyRom(romPath);
  if (!rom.ok) throw new Error(rom.reason);

  const dir = join(instanceDir, BASEROMS_DIR);
  mkdirSync(dir, { recursive: true });
  const to = join(dir, basename(rom.path));
  if (existsSync(to)) return { copied: false, to, ...rom };
  copyFileSync(rom.path, to);
  return { copied: true, to, ...rom };
}
