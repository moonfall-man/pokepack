// Updating pokepack itself.
//
// Worth separating from the pack list, because they work nothing alike:
//
//   the pack list   fetched from the gallery every time the hub runs.  A merged
//                   pull request is live for everybody within the cache window,
//                   and nobody updates anything.
//   the app         is code on somebody's disk.  Only a pull changes it.
//
// So this checks a small file published beside the pack list -- static, no API,
// no rate limit, no account -- and, if the checkout is clean, offers to pull.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchJson } from './net.js';
import { compareVersions } from './deps.js';

// Published by the gallery workflow from package.json, next to packs.json.
export const OFFICIAL_UPDATE = 'https://moonfall-man.github.io/pokepack/data/pokepack.json';
export const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export function repoRoot() {
  return join(dirname(fileURLToPath(import.meta.url)), '..');
}

export function currentVersion() {
  try {
    return JSON.parse(readFileSync(join(repoRoot(), 'package.json'), 'utf8')).version ?? null;
  } catch {
    return null;
  }
}

let cached = null;

/**
 * check({ url, force }) -> { current, latest, newer, notes, url, error? }
 *
 * Never throws.  An update check that breaks the screen it is on would be a
 * worse bug than the one it is trying to tell you about.
 */
export async function check({ url = OFFICIAL_UPDATE, force = false, now = Date.now() } = {}) {
  const current = currentVersion();
  if (cached && !force && now - cached.at < CACHE_TTL_MS) return { ...cached.value, cached: true };

  try {
    const doc = await fetchJson(url);
    const latest = typeof doc?.version === 'string' ? doc.version : null;
    const value = {
      current,
      latest,
      newer: !!(latest && current && compareVersions(latest, current) > 0),
      notes: typeof doc?.notes === 'string' ? doc.notes : null,
      url: typeof doc?.url === 'string' && doc.url.startsWith('https://') ? doc.url : null,
    };
    cached = { at: now, value };
    return value;
  } catch (e) {
    return { current, latest: null, newer: false, error: e.message };
  }
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).trim();
}

/**
 * status(cwd) -> { git, clean, branch, remote, reason? }
 *
 * Whether pulling is even a sensible offer.  A tarball download or a dirty
 * working tree both mean "tell them the command, do not run it".
 */
export function status(cwd = repoRoot()) {
  if (!existsSync(join(cwd, '.git'))) {
    return { git: false, clean: false, reason: 'this copy is not a git checkout, so there is nothing to pull' };
  }
  try {
    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
    const dirty = git(['status', '--porcelain'], cwd);
    const remote = git(['remote'], cwd).split('\n').filter(Boolean);
    if (!remote.includes('origin')) {
      return { git: true, clean: false, branch, remote, reason: 'no origin remote to pull from' };
    }
    if (dirty) {
      return {
        git: true,
        clean: false,
        branch,
        remote,
        // Refused rather than stashed: uncommitted work is the one thing here
        // nobody else has a copy of.
        reason: `you have uncommitted changes (${dirty.split('\n').length} files) -- commit or stash them first`,
      };
    }
    return { git: true, clean: true, branch, remote };
  } catch (e) {
    return { git: true, clean: false, reason: e.message };
  }
}

/**
 * pull(cwd) -> { pulled, from, to, output }
 *
 * --ff-only on purpose.  A merge that needs resolving is not something to start
 * from a button in a browser, and failing cleanly leaves the checkout exactly
 * as it was.
 */
export function pull(cwd = repoRoot()) {
  const st = status(cwd);
  if (!st.clean) throw new Error(st.reason ?? 'this copy cannot be updated automatically');

  const before = git(['rev-parse', 'HEAD'], cwd);
  let output;
  try {
    output = git(['pull', '--ff-only'], cwd);
  } catch (e) {
    throw new Error(`git pull failed: ${String(e.stderr || e.message).trim().split('\n')[0]}`);
  }
  const after = git(['rev-parse', 'HEAD'], cwd);
  return {
    pulled: before !== after,
    from: before.slice(0, 7),
    to: after.slice(0, 7),
    output,
    version: currentVersion(),
  };
}
