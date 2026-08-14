// Fetching the game itself.
//
// Up to now the first thing pokepack asked was "where is your copy of
// gen1recomp", which is a fine question for somebody who already has one and a
// dead end for everybody else -- and the exe was going to be handed to exactly
// those people.
//
// This hosts nothing, which is the same promise a pack makes about mods. The
// download comes from the author's own release, and it is checked against the
// sha256sums.txt they publish beside it, so a tampered or truncated file is
// refused rather than unpacked. The game is simply one more pinned download.
//
// It is the *latest* release rather than a pinned version, deliberately: a mod
// is pinned because a pack was tested against those exact bytes, while the
// engine is the thing packs are tested *on* and an old one is a bug nobody else
// can reproduce. The hash still comes from the release being installed, so
// "unpinned" here means "whichever version, verified", not "whatever arrives".

import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fetchJson, downloadToBuffer } from './net.js';
import * as zip from './zip.js';
import { safeEntryName } from './zip.js';

export const OFFICIAL_REPO = 'bryanthaboi/gen1recomp';
export const CHECKSUMS = 'sha256sums.txt';

// Which asset belongs to the machine asking.  Deliberately not clever: an
// unknown platform gets told so, rather than handed a build for another one.
export function assetFor(platform = process.platform, arch = process.arch) {
  if (platform === 'win32') return { match: /-windows\.zip$/, exe: /gen1recomp\.exe$/i };
  if (platform === 'darwin') return { match: /-macos\.zip$/, exe: /gen1recomp(\.app\/Contents\/MacOS\/.*)?$/i };
  if (platform === 'linux') {
    return arch === 'arm64'
      ? { match: /-linux-arm64\.AppImage$/, exe: /\.AppImage$/ }
      : { match: /-linux\.zip$/, exe: /gen1recomp$/ };
  }
  return null;
}

/**
 * parseChecksums(text) -> { [filename]: sha256 }
 *
 * The shape `shasum -a 256` writes: hash, whitespace, name.  A line that is not
 * that is skipped rather than guessed at.
 */
export function parseChecksums(text) {
  const out = {};
  for (const line of String(text).split('\n')) {
    const m = /^([0-9a-f]{64})\s+\*?(.+?)\s*$/i.exec(line.trim());
    if (m) out[m[2]] = m[1].toLowerCase();
  }
  return out;
}

/**
 * latest({ repo, platform }) -> { version, name, url, sha256, notes }
 *
 * What this machine should download, and what it must hash to.  A release with
 * no checksums file still installs -- their older releases have none -- but it
 * says so, because "verified" and "not verified" should never look the same.
 */
export async function latest({ repo = OFFICIAL_REPO, platform = process.platform, arch = process.arch } = {}) {
  const want = assetFor(platform, arch);
  if (!want) throw new Error(`no gen1recomp build is published for ${platform}`);

  const rel = await fetchJson(`https://api.github.com/repos/${repo}/releases/latest`);
  const assets = Array.isArray(rel?.assets) ? rel.assets : [];
  const asset = assets.find((a) => want.match.test(a.name ?? ''));
  if (!asset) {
    throw new Error(`release ${rel?.tag_name ?? '?'} has no build for ${platform}`);
  }

  let sha256 = null;
  const sums = assets.find((a) => a.name === CHECKSUMS);
  if (sums) {
    try {
      const { buffer } = await downloadToBuffer(sums.browser_download_url);
      sha256 = parseChecksums(buffer.toString('utf8'))[asset.name] ?? null;
    } catch { /* installs unverified below, and says so */ }
  }

  return {
    version: String(rel.tag_name ?? '').replace(/^v/, ''),
    name: asset.name,
    url: asset.browser_download_url,
    size: asset.size ?? null,
    sha256,
  };
}

/**
 * unpack(buffer, dir) -> { files, exePath }
 *
 * Their zip wraps everything in one folder (gen1recomp-win64/), which is kept:
 * a folder that names its own version is easier to have two of than a pile of
 * files that do not.
 *
 * Entry names are checked before anything is written.  A zip can name
 * "../../windows/system32/..." and this one is fetched over the network, so the
 * check is not paranoia about these authors -- it is that the alternative is
 * trusting a download to be well behaved.
 */
export function unpack(buffer, dir, { exeMatch } = {}) {
  const files = [];
  let exePath = null;

  for (const entry of zip.read(buffer)) {
    if (entry.isDirectory) continue;
    if (!safeEntryName(entry.name)) {
      throw new Error(`the download contains an unsafe path and was not unpacked: ${entry.name}`);
    }
    const to = join(dir, entry.name);
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, entry.data());
    files.push(entry.name);
    if (exeMatch && exeMatch.test(entry.name) && !exePath) exePath = to;
  }

  // A zip does not carry the executable bit anywhere the reader looks at, so
  // the one file that has to be runnable is made runnable.
  if (exePath && process.platform !== 'win32') {
    try { chmodSync(exePath, 0o755); } catch { /* best effort */ }
  }
  return { files, exePath };
}

/**
 * install({ dir, onEvent }) -> { version, exePath, files, verified }
 *
 * Fetch, verify, unpack.  onEvent reports progress rather than printing, so the
 * CLI and the hub can each say it their own way.
 */
export async function install({
  dir, repo = OFFICIAL_REPO, platform = process.platform, arch = process.arch, onEvent = null,
} = {}) {
  const pick = await latest({ repo, platform, arch });
  onEvent?.({ type: 'found', ...pick });

  const { buffer, sha256, size } = await downloadToBuffer(pick.url);
  onEvent?.({ type: 'downloaded', size, sha256 });

  if (pick.sha256 && sha256 !== pick.sha256) {
    throw new Error(
      `the download does not match the checksum the author published `
      + `(expected ${pick.sha256.slice(0, 12)}, got ${sha256.slice(0, 12)})`,
    );
  }

  const into = join(dir, `gen1recomp-${pick.version}`);
  mkdirSync(into, { recursive: true });
  const { files, exePath } = unpack(buffer, into, { exeMatch: assetFor(platform, arch)?.exe });
  if (!exePath) throw new Error('the download unpacked, but no gen1recomp executable was in it');

  onEvent?.({ type: 'installed', exePath, files: files.length });
  return {
    version: pick.version,
    exePath,
    files,
    dir: into,
    verified: Boolean(pick.sha256),
    sha256,
  };
}

// Is there already one here?  Cheap enough to answer before offering a download
// that would be the second copy.
export function installedAt(dir) {
  if (!dir || !existsSync(dir)) return null;
  return dir;
}
