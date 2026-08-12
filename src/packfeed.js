// The pack gallery: a published list of packs other people have made.
//
// Same shape as the mod catalogue, and for the same reason -- a merged pull
// request should be visible to everyone immediately, without anybody updating
// the tool.  If the gallery shipped inside the code, approving a pack would
// only reach people who happened to pull.
//
// A gallery entry is metadata plus a URL to the .pokepack recipe.  Nothing is
// hosted here: the recipe points at each mod author's own downloads, exactly
// as a local pack does.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fetchJson } from './net.js';
import { configPath } from './config.js';
import { decode } from './packformat.js';

export const SCHEMA_VERSION = 1;
export const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

// The gallery, and where Share submits.  These two lines are the whole
// configuration -- there is deliberately no setting for either.
//
// A pack list decides what the hub offers to install, so it is not a preference
// somebody should be able to repoint from a text box: a field like that is one
// convincing message away from being pointed at somebody else's list.  Changing
// it is a code change, reviewed like any other.
//
// The bargain is the same as the mod catalogue's: one https GET to a static
// file, no account, no telemetry, and every recipe still validated on arrival.
export const OFFICIAL_GALLERY = 'https://moonfall-man.github.io/pokepack/data/packs.json';
export const OFFICIAL_REPO = 'moonfall-man/pokepack';

export function cachePath() {
  return join(dirname(configPath()), 'gallery.json');
}

function readCache() {
  const path = cachePath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

// A gallery is somebody else's file and the hub indexes straight into it, so
// shape-check every field and refuse an unknown schema outright.
export function normalise(doc, source) {
  if (!doc || typeof doc !== 'object') throw new Error('the gallery is not an object');
  const schema = Number(doc.schema_version);
  if (!Number.isFinite(schema)) throw new Error('the gallery has no schema_version');
  if (schema !== SCHEMA_VERSION) {
    throw new Error(`gallery schema ${schema} is not supported (this build reads ${SCHEMA_VERSION})`);
  }
  if (!Array.isArray(doc.packs)) throw new Error('the gallery has no packs array');

  const str = (v) => (typeof v === 'string' && v !== '' ? v : null);
  // Anything from here can end up as a link or an image in the hub, so a URL
  // out of somebody else's file has to be a real https URL before it is kept.
  // javascript: in an href is the obvious one; there is no reason to allow any
  // other scheme either.
  const https = (v) => {
    const s = str(v);
    if (!s) return null;
    try {
      return new URL(s).protocol === 'https:' ? s : null;
    } catch {
      return null;
    }
  };
  const packs = [];

  for (const raw of doc.packs) {
    if (!raw || typeof raw.id !== 'string' || raw.id === '') continue;
    const url = str(raw.url);
    if (!url) continue; // an entry we cannot fetch is not an entry
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    // https only, same rule the pack format applies to mod sources.
    if (parsed.protocol !== 'https:') continue;

    packs.push({
      id: raw.id,
      name: str(raw.name) ?? raw.id,
      author: str(raw.author),
      summary: str(raw.summary) ?? '',
      thumbnail: https(raw.thumbnail),
      url,
      modCount: Number.isFinite(raw.modCount) ? raw.modCount : (raw.mods?.length ?? 0),
      mods: Array.isArray(raw.mods)
        ? raw.mods.filter((m) => m && typeof m.id === 'string')
          .map((m) => ({ id: m.id, version: str(m.version), pinned: m.pinned === true }))
        : [],
      disable: Array.isArray(raw.disable) ? raw.disable.filter((d) => typeof d === 'string') : [],
      engine: str(raw.engine),
      // Whether the gallery's own CI could still reach every download.  Left
      // as "unknown" rather than assumed good.
      status: str(raw.status) ?? 'unknown',
      checkedAt: str(raw.checkedAt),
      updatedAt: str(raw.updatedAt),
      // Thumbs-up on the pack's discussion thread, counted by the gallery's CI.
      // Popularity, not a safety check -- the mods are still third-party
      // downloads and a well-liked pack has no more claim on you than any other.
      votes: Number.isFinite(raw.votes) ? raw.votes : 0,
      comments: Number.isFinite(raw.comments) ? raw.comments : 0,
      thread: https(raw.thread),
    });
  }

  return {
    schemaVersion: schema,
    generatedAt: str(doc.generated_at),
    source,
    fetchedAt: null,
    packs,
  };
}

/**
 * load({ url, force, now }) -> gallery
 *
 * A failed refresh falls back to the cached copy: a stale list beats an empty
 * screen, and the entry itself carries whether CI last found it working.
 */
export async function load({ url, force = false, now = Date.now() } = {}) {
  if (!url) return { source: null, packs: [], generatedAt: null, disabled: true };

  const cached = readCache();
  const fresh = cached && cached.source === url && cached.fetchedAt
    && now - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS;
  if (fresh && !force) return { ...cached, cached: true };

  try {
    const out = normalise(await fetchJson(url), url);
    out.fetchedAt = new Date(now).toISOString();
    mkdirSync(dirname(cachePath()), { recursive: true });
    writeFileSync(cachePath(), `${JSON.stringify(out, null, 2)}\n`);
    return { ...out, cached: false };
  } catch (e) {
    if (cached && cached.source === url) {
      return { ...cached, cached: true, stale: true, error: e.message };
    }
    throw e;
  }
}

/**
 * fetchPack(url) -> pack
 *
 * Download one recipe and validate it before anything acts on it.  A gallery
 * listing buys a pack no trust: it goes through exactly the same decode as a
 * file somebody handed you on a memory stick.
 */
export async function fetchPack(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('a pack URL must be https');
  const res = await fetch(url, { headers: { 'user-agent': 'pokepack' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} fetching the pack`);
  const text = await res.text();
  if (text.length > 512 * 1024) throw new Error('that pack file is implausibly large');
  return decode(text);
}
