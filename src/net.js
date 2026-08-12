// The only module that touches the wire.  Kept separate so build/resolve stay
// testable without a network, the same split src/mods/ModIndex.lua uses.

import { createHash } from 'node:crypto';

const UA = 'pokepack/0.1 (+https://github.com/moonfall-man/pokepack)';

async function request(url, init = {}) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': UA, ...(init.headers ?? {}) },
    ...init,
  });
  return res;
}

export async function fetchJson(url) {
  const res = await request(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(rateLimited(res) ?? `${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

/**
 * rateLimited(res) -> message | null
 *
 * Nothing here needs a GitHub account, which is the point -- but anonymous
 * requests get 60 an hour, and pinning a pack spends one per repo.  Hitting
 * that arrives as a bare 403 and looks like the mod is gone, so name it and
 * say when it lifts.
 */
export function rateLimited(res) {
  if (res.status !== 403 && res.status !== 429) return null;
  if (res.headers.get('x-ratelimit-remaining') !== '0') return null;
  const reset = Number(res.headers.get('x-ratelimit-reset'));
  const mins = Number.isFinite(reset)
    ? Math.max(1, Math.ceil((reset * 1000 - Date.now()) / 60000))
    : null;
  return 'GitHub is rate-limiting anonymous requests (60 an hour)'
    + (mins ? ` -- it lifts in about ${mins} minute${mins === 1 ? '' : 's'}` : '')
    + '. A direct link to the .zip works in the meantime.';
}

// Download and hash in one pass.  Mod zips run to tens of megabytes, so the
// body is streamed rather than buffered -- we want the digest, not the file.
export async function hashUrl(url, { onProgress } = {}) {
  const res = await request(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const hash = createHash('sha256');
  let size = 0;
  for await (const chunk of res.body) {
    hash.update(chunk);
    size += chunk.length;
    if (onProgress) onProgress(size);
  }
  return { sha256: hash.digest('hex'), size };
}

// Download and hash in one pass, keeping the bytes.  Used by `fetch`, where we
// need both the file and the proof it is the right file -- hashing after
// writing to disk would leave a window where an unverified zip is sitting
// somewhere a player might pick it up.
export async function downloadToBuffer(url) {
  const res = await request(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, sha256: createHash('sha256').update(buffer).digest('hex'), size: buffer.length };
}

// Does this link still resolve?  The question `validate` asks on a schedule so
// no player's launcher has to.
//
// HEAD first because it is free; some hosts refuse it, so fall back to a
// one-byte ranged GET rather than reporting a live link as dead.
export async function checkUrl(url, { retries = 3, delayMs = 1000 } = {}) {
  let last;
  for (let attempt = 0; ; attempt++) {
    last = await checkOnce(url);
    // Only a network-level failure is worth retrying.  A 404 is an answer, and
    // asking again does not make a deleted release come back.  A 429 is the
    // host asking us to wait, which is the one status that is worth repeating.
    const retryable = !last.ok && (last.status === null || last.status === 429 || last.status >= 500);
    if (last.ok || !retryable || attempt >= retries) return last;
    // Backing off rather than hammering: a shared CI runner hitting a rate
    // limit gets slower by asking faster.
    await new Promise((r) => { setTimeout(r, delayMs * (attempt + 1)); });
  }
}

// A run of this marks packs broken and fails CI, so a single flaky connection
// must not be enough to cry wolf about somebody's pack.
async function checkOnce(url) {
  try {
    const head = await request(url, { method: 'HEAD' });
    if (head.ok) {
      return {
        ok: true,
        status: head.status,
        size: Number(head.headers.get('content-length')) || null,
      };
    }
    if (head.status !== 403 && head.status !== 405 && head.status !== 501) {
      return { ok: false, status: head.status, reason: `${head.status} ${head.statusText}` };
    }
  } catch (e) {
    // fall through to the ranged GET; a refused HEAD is not a dead link
    void e;
  }

  try {
    const res = await request(url, { headers: { range: 'bytes=0-0' } });
    if (!res.ok && res.status !== 206) {
      return { ok: false, status: res.status, reason: `${res.status} ${res.statusText}` };
    }
    const range = res.headers.get('content-range');
    const total = range ? Number(range.split('/')[1]) : null;
    if (res.body) await res.body.cancel().catch(() => {});
    return { ok: true, status: res.status, size: Number.isFinite(total) ? total : null };
  } catch (e) {
    return { ok: false, status: null, reason: e.message };
  }
}

// Every release of a repo, in the shape state.releasesFromCache produces, so
// the two are interchangeable to build().
//
// This is the same endpoint src/mods/ModUpdate.lua uses.  Unauthenticated
// GitHub allows 60 requests an hour, which is plenty for the handful of mods
// in a pack but not for a loop -- callers should ask once per repo.
export async function fetchReleases(repo) {
  const doc = await fetchJson(`https://api.github.com/repos/${repo}/releases?per_page=100`);
  if (!Array.isArray(doc)) return [];
  return doc.map((rel) => {
    const zip = (rel.assets ?? []).find((a) => typeof a.name === 'string' && a.name.toLowerCase().endsWith('.zip'));
    return {
      version: String(rel.tag_name ?? '').replace(/^[vV]/, '') || null,
      tag: rel.tag_name ?? null,
      published: rel.published_at ?? null,
      prerelease: rel.prerelease === true,
      zip: zip ? { name: zip.name, url: zip.browser_download_url, size: zip.size ?? null } : null,
    };
  });
}

export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
