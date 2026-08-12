// The mod catalogue.
//
// There is an official, CI-built index of gen1recomp mods, and it is published
// in exactly the schema the engine's own src/mods/ModIndex.lua reads:
//
//   https://bryanthaboi.github.io/gen1recomp-mod-index/data/index.json
//
// So no scraping.  An earlier plan here was to parse gen1recomp.com's HTML,
// which would have been a live dependency on somebody else's markup; this is a
// validated feed with a schema, a submission process and a build pipeline.
//
// Cached for a day, mirroring ModIndex.CACHE_TTL: the feed is rebuilt on push,
// so a day-old copy is the worst a listing can be, and the alternative is every
// hub asking GitHub Pages the same question.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fetchJson } from './net.js';
import { configPath } from './config.js';

export const OFFICIAL_INDEX = 'https://bryanthaboi.github.io/gen1recomp-mod-index/data/index.json';
export const SCHEMA_VERSION = 1;
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function cachePath() {
  return join(dirname(configPath()), 'catalogue.json');
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

function writeCache(doc) {
  const path = cachePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);
}

// Shape-check rather than trust: this is a third party's file, and the hub
// indexes straight into these fields.  An unknown schema_version is refused
// outright, the same hard gate ModIndex applies.
export function normalise(doc, source) {
  if (!doc || typeof doc !== 'object') throw new Error('the catalogue is not an object');
  const schema = Number(doc.schema_version);
  if (!Number.isFinite(schema)) throw new Error('the catalogue has no schema_version');
  if (schema !== SCHEMA_VERSION) {
    throw new Error(`catalogue schema ${schema} is not supported (this build reads ${SCHEMA_VERSION})`);
  }
  if (!Array.isArray(doc.mods)) throw new Error('the catalogue has no mods array');

  const mods = [];
  for (const raw of doc.mods) {
    if (!raw || typeof raw.id !== 'string' || raw.id === '') continue;
    mods.push({
      id: raw.id,
      title: typeof raw.title === 'string' ? raw.title : raw.id,
      author: typeof raw.author === 'string' ? raw.author : null,
      summary: typeof raw.summary === 'string' ? raw.summary : '',
      version: typeof raw.version === 'string' ? raw.version : null,
      categories: Array.isArray(raw.categories) ? raw.categories.filter((c) => typeof c === 'string') : [],
      github: typeof raw.github === 'string' ? raw.github : null,
      repo: typeof raw.repo === 'string' ? raw.repo : null,
      downloadURL: typeof raw.downloadURL === 'string' ? raw.downloadURL : null,
      api: Number.isFinite(raw.api) ? raw.api : null,
      game_version: typeof raw.game_version === 'string' ? raw.game_version : null,
      conflicts: Array.isArray(raw.conflicts) ? raw.conflicts.filter((c) => typeof c === 'string') : [],
      dependencies: raw.dependencies ?? [],
      experimental: raw.experimental === true,
      thumbnail: typeof raw.thumbnail === 'string' ? raw.thumbnail : null,
      description_url: typeof raw.description_url === 'string' ? raw.description_url : null,
      update_check: typeof raw.update_check === 'string' ? raw.update_check : 'pending',
      latest: raw.latest ?? null,
    });
  }

  return {
    schemaVersion: schema,
    generatedAt: typeof doc.generated_at === 'string' ? doc.generated_at : null,
    categories: Array.isArray(doc.categories) ? doc.categories.filter((c) => typeof c === 'string') : [],
    source,
    fetchedAt: null,
    mods,
  };
}

// The version and download URL a mod can actually be installed from, mirroring
// ModIndex.installUrl -- a verified release asset first, then the author's own
// fixed download.  A source archive URL is never invented.
export function installableFrom(entry) {
  if (entry?.update_check === 'ok' && entry.latest?.zip?.url) {
    return { url: entry.latest.zip.url, version: entry.latest.version ?? entry.version, kind: 'release' };
  }
  if (entry?.downloadURL) return { url: entry.downloadURL, version: entry.version, kind: 'download' };
  return null;
}

/**
 * load({ url, force, now }) -> catalogue
 *
 * Serves the cached copy while it is fresh.  A failed refresh falls back to
 * whatever was cached rather than leaving the Mods tab empty -- a day-old list
 * beats no list.
 */
export async function load({ url = OFFICIAL_INDEX, force = false, now = Date.now() } = {}) {
  const cached = readCache();
  const fresh = cached
    && cached.source === url
    && cached.fetchedAt
    && now - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS;

  if (fresh && !force) return { ...cached, cached: true };

  try {
    const doc = await fetchJson(url);
    const out = normalise(doc, url);
    out.fetchedAt = new Date(now).toISOString();
    writeCache(out);
    return { ...out, cached: false };
  } catch (e) {
    if (cached && cached.source === url) {
      return { ...cached, cached: true, stale: true, error: e.message };
    }
    throw e;
  }
}

// Free-text search over the fields somebody would actually type.
export function search(mods, query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return mods;
  const terms = q.split(/\s+/);
  return mods.filter((m) => {
    const hay = [m.id, m.title, m.author, m.summary, ...(m.categories ?? [])]
      .filter(Boolean).join(' ').toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}
