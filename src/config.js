// Remember which game folder was picked, so the setup screen is a one-time
// thing rather than a flag on every command.
//
// Stored outside the repo, in the usual per-user config spot: the choice is a
// property of this machine, not of a checkout, and a cloned gallery repo should
// not carry somebody else's paths.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

export function configPath() {
  if (process.platform === 'win32' && process.env.APPDATA) {
    return join(process.env.APPDATA, 'pokepack', 'config.json');
  }
  const base = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
  return join(base, 'pokepack', 'config.json');
}

export function read() {
  const path = configPath();
  if (!existsSync(path)) return {};
  try {
    const doc = JSON.parse(readFileSync(path, 'utf8'));
    return doc && typeof doc === 'object' ? doc : {};
  } catch {
    // A corrupt config should not stop the tool -- it just means asking again.
    return {};
  }
}

export function write(patch) {
  const path = configPath();
  const next = { ...read(), ...patch };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
  return { path, config: next };
}
