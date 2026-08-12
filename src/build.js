// Turn a profile you already play into a pack somebody else can install.
//
// The profile supplies the half that matters and that nothing else records --
// which mods, and what every one of their settings was tuned to.  Everything
// else (which release, which URL) is looked up here and written down, because
// a profile pins none of it.

import { compareVersions } from './resolve.js';

function conflictIds(entry) {
  const raw = entry?.conflicts;
  return Array.isArray(raw) ? raw.filter((c) => typeof c === 'string') : [];
}

// Where do the bytes for *this exact version* come from?
//
// Deliberately not "latest": the point of a pack is the combination that was
// tested, and the newest release is by definition not that.  Cached releases
// are consulted before the index's `latest` for the same reason.
function sourceFor(id, version, { index, releasesByRepo, state }) {
  const entry = index[id];
  const installed = state?.mods?.[id];
  const repo = installed?.github ?? entry?.github ?? null;

  // A mod's own version and the release it ships in are frequently not the
  // same string -- GHOST_LINK 0.1.0 lives inside release v0.3.1 of the couch
  // multiplayer repo.  So match the release tag *or* the asset name, which is
  // the "<id>-<version>.zip" convention ModUpdate.pickZipAsset already prefers.
  if (repo && version && releasesByRepo.has(repo)) {
    const assetName = `${id}-${version}.zip`.toLowerCase();
    for (const rel of releasesByRepo.get(repo)) {
      if (!rel.zip?.url) continue;
      if (rel.version === version || rel.zip.name?.toLowerCase() === assetName) {
        return { url: rel.zip.url, size: rel.zip.size ?? undefined, why: 'cached release' };
      }
    }
  }

  if (entry?.latest?.zip?.url && (!version || entry.latest.version === version)) {
    return { url: entry.latest.zip.url, size: entry.latest.zip.size ?? undefined, why: 'index latest' };
  }

  // A fixed downloadURL has no version behind it -- the author points it at
  // whatever they consider current.  Usable, but it cannot be pinned by
  // version, only by hash, so note that for the caller to warn about.
  if (entry?.downloadURL) {
    return { url: entry.downloadURL, why: 'author downloadURL', floating: true };
  }

  return null;
}

/**
 * build(profile, { state, index, releasesByRepo, meta }) -> { pack, warnings }
 *
 * profile  a record from options.modProfiles, or a decoded .g1rmodlist
 * meta     { id, name, author, summary, engine, createdAt }
 */
export function build(profile, { state = {}, index = {}, releasesByRepo = new Map(), meta = {} } = {}) {
  const warnings = [];
  const installed = state.mods ?? {};

  const wanted = Object.entries(profile.enabled ?? {})
    .filter(([, on]) => on === true)
    .map(([id]) => id)
    .sort();

  if (wanted.length === 0) {
    throw new Error('that profile has no mods switched on, so there is nothing to pack');
  }

  const mods = [];
  for (const id of wanted) {
    const have = installed[id];
    const version = have?.version ?? index[id]?.version ?? null;

    if (!have) {
      warnings.push(
        `${id} is enabled in the profile but not installed here, so its version is a guess from the index`,
      );
    }

    const source = sourceFor(id, version, { index, releasesByRepo, state });
    if (!source) {
      warnings.push(`${id}: no download could be resolved -- it will need a source added by hand`);
      continue;
    }
    if (source.floating) {
      warnings.push(
        `${id}: only a fixed downloadURL is published, so the version cannot be pinned -- the hash is doing all the work`,
      );
    }

    // Profile settings win over the machine's current ones: the profile is the
    // snapshot that was tested, and modOptions may have drifted since.
    const options = profile.options?.[id] ?? state.modOptions?.[id] ?? {};

    mods.push({
      id,
      version,
      source: { url: source.url, ...(source.size ? { size: source.size } : {}) },
      options: Object.fromEntries(
        Object.entries(options).filter(([, v]) =>
          ['string', 'number', 'boolean'].includes(typeof v)),
      ),
    });
  }

  if (mods.length === 0) {
    // Carry the per-mod warnings out with the failure.  "nothing resolved" on
    // its own tells you that it failed, not which mod or why, and the why is
    // sitting right here.
    const err = new Error('no mod in that profile had a resolvable download');
    err.warnings = warnings;
    throw err;
  }

  // `disable` carries only the mods that would actively break this pack --
  // something installed here that one of the packed mods declares a conflict
  // with.  A profile marks every other mod off too, but that is the player's
  // business, not the pack's.
  const packed = new Set(mods.map((m) => m.id));
  const disable = new Set();
  for (const mod of mods) {
    for (const other of conflictIds(index[mod.id])) {
      if (packed.has(other)) {
        warnings.push(
          `${mod.id} and ${other} declare a conflict but are both switched on in this profile -- ` +
          'the pack will refuse to validate until one of them goes',
        );
        continue;
      }
      if (installed[other]) disable.add(other);
    }
  }

  const pack = {
    format: 'pokepack',
    formatVersion: 1,
    id: meta.id ?? slugify(profile.name ?? 'pack'),
    name: meta.name ?? profile.name ?? 'PACK',
    author: meta.author ?? null,
    summary: meta.summary ?? '',
    thumbnail: meta.thumbnail || null,
    engine: meta.engine ?? null,
    createdAt: meta.createdAt ?? null,
    strict: meta.strict === undefined ? true : meta.strict,
    mods,
    disable: [...disable].sort(),
    slots: profile.slots && Object.keys(profile.slots).length ? { ...profile.slots } : {},
  };

  return { pack, warnings };
}

// Fill in release lists for the repos a profile's mods name.
//
// The launcher only writes options.modUpdateCache once the player opens the
// update panel, and a mod in no published index has no entry either -- so on a
// fresh save there is often nowhere local to learn a download URL from.  Kept
// here rather than in the CLI so the hub does the identical thing.
//
// fetchReleases is injected so this module stays testable without a network.
export async function gatherReleases({
  profile, state = {}, index = {}, releasesByRepo = new Map(), fetchReleases, onLookup,
}) {
  if (!fetchReleases) return { releasesByRepo, looked: [], failed: [] };
  const repos = new Set();
  for (const [id, on] of Object.entries(profile.enabled ?? {})) {
    if (on !== true) continue;
    const repo = state.mods?.[id]?.github ?? index[id]?.github;
    if (repo && !releasesByRepo.has(repo)) repos.add(repo);
  }
  const looked = [];
  const failed = [];
  for (const repo of repos) {
    onLookup?.(repo);
    try {
      const releases = await fetchReleases(repo);
      releasesByRepo.set(repo, releases);
      looked.push({ repo, count: releases.length });
    } catch (e) {
      failed.push({ repo, reason: e.message });
    }
  }
  return { releasesByRepo, looked, failed };
}

export function slugify(name) {
  const s = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s === '' ? 'pack' : s;
}

// Fill in each mod's sha256 by fetching it.  Separated from build() because it
// is the only part that needs a network, and a pack is worth writing without
// it -- unpinned, and honest about being unpinned.
export async function pin(pack, { hashUrl, onStart, onDone } = {}) {
  const failures = [];
  for (const mod of pack.mods) {
    if (mod.source.sha256) continue;
    onStart?.(mod);
    try {
      const { sha256, size } = await hashUrl(mod.source.url);
      mod.source.sha256 = sha256;
      mod.source.size = size;
      onDone?.(mod, { sha256, size });
    } catch (e) {
      failures.push({ id: mod.id, reason: e.message });
      onDone?.(mod, null, e);
    }
  }
  return { failures };
}

export { compareVersions };
