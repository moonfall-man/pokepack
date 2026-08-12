// Generate packs.json -- the catalogue both front ends read.
//
// Deliberately a separate file from the packs themselves, for the same reason
// index.json is separate from the mods it lists: a browse screen needs things a
// pack does not carry (a card summary, a thumbnail, and above all whether it
// still works), and it needs them all in one request.
//
// Built in CI, so no player's launcher has to derive any of it.  60 GitHub API
// requests an hour does not divide well by a userbase.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { decode, EXT } from './packformat.js';

export const SCHEMA_VERSION = 1;

export function loadPacks(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith(EXT))
    .sort()
    .map((name) => {
      const path = join(dir, name);
      try {
        return { path, name, pack: decode(readFileSync(path, 'utf8')) };
      } catch (e) {
        return { path, name, error: e.message };
      }
    });
}

/**
 * buildFeed(entries, { statuses, votes, generatedAt }) -> feed
 *
 * statuses: { [packId]: validationReport } from validate.js, folded in so the
 * card can say "works" or "broken" without the client checking anything.
 *
 * votes: { [packId]: { votes, thread } } from votes.js.  Folded in here for the
 * same reason and with one extra: a vote count must never live in the pack file
 * itself.  A pack is identified by its exact bytes, so a count inside it would
 * make the pack a different pack every time somebody clicked.
 */
/**
 * pagesBase(repo) -> the https URL the published recipes will sit at
 *
 * A gallery entry has to carry an absolute https URL or the hub cannot fetch
 * the recipe -- a bare filename is meaningless to somebody else's machine.
 */
export function pagesBase(repo) {
  const [owner, name] = String(repo ?? '').split('/');
  if (!owner || !name) return null;
  // A repo named <owner>.github.io is served at the root; everything else lives
  // under /<name>/.
  return name.toLowerCase() === `${owner.toLowerCase()}.github.io`
    ? `https://${owner.toLowerCase()}.github.io/data/`
    : `https://${owner.toLowerCase()}.github.io/${name}/data/`;
}

export function buildFeed(entries, {
  statuses = {}, votes = {}, generatedAt = null, baseUrl = null,
} = {}) {
  // Left off deliberately when there is no base URL: `pokepack feed` run on a
  // laptop is inspecting packs, not publishing them, and a made-up URL in that
  // output would be worse than none.
  const base = baseUrl ? baseUrl.replace(/\/*$/, '/') : null;
  const packs = [];
  const rejected = [];

  for (const entry of entries) {
    if (entry.error) {
      rejected.push({ file: entry.name, reason: entry.error });
      continue;
    }
    const p = entry.pack;
    const status = statuses[p.id];
    packs.push({
      id: p.id,
      name: p.name,
      author: p.author,
      summary: p.summary,
      thumbnail: p.thumbnail ?? null,
      engine: p.engine,
      createdAt: p.createdAt,
      strict: p.strict,
      file: entry.name,
      url: base ? base + encodeURIComponent(entry.name) : null,
      modCount: p.mods.length,
      mods: p.mods.map((m) => ({ id: m.id, version: m.version, pinned: !!m.source.sha256 })),
      disable: p.disable,
      // Unknown is honest when no validation has run yet.  A card that claims
      // "works" on no evidence is worse than one that admits it does not know.
      status: status?.status ?? 'unknown',
      statusDetail: status?.mods?.filter((m) => m.status !== 'live')
        .map((m) => `${m.id}: ${m.reason}`) ?? [],
      checkedAt: status?.checkedAt ?? null,
      votes: votes[p.id]?.votes ?? 0,
      comments: votes[p.id]?.comments ?? 0,
      thread: votes[p.id]?.thread ?? null,
    });
  }

  // Most-voted first, so the gallery has an order even if a client does not
  // sort.  Ties fall back to the name rather than to whatever readdir returned,
  // which would otherwise reshuffle the front page on every build.
  packs.sort((a, b) => (b.votes - a.votes) || (a.name < b.name ? -1 : 1));

  return {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    counts: {
      total: packs.length,
      live: packs.filter((p) => p.status === 'live').length,
      broken: packs.filter((p) => p.status === 'broken').length,
      unknown: packs.filter((p) => p.status === 'unknown').length,
    },
    packs,
    rejected,
  };
}

/**
 * submitUrl({ repo, branch, pack, text }) -> { url, tooLong }
 *
 * GitHub's web editor takes the filename and the contents as query parameters.
 * Opening that link forks the repo, commits the file and opens the pull request
 * -- in the browser, with no git, no CLI and nothing installed.
 *
 * The length check is real: browsers and GitHub both cap a URL, and a pack big
 * enough to blow past it must be told rather than silently truncated into a
 * corrupt file the author then submits.
 */
export const URL_LIMIT = 8000;

export function submitUrl({ repo, branch = 'dev', pack, text }) {
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new Error('set the gallery repo first (owner/name)');
  }
  const url = `https://github.com/${repo}/new/${encodeURIComponent(branch)}`
    + `?filename=${encodeURIComponent(`packs/${pack.id}${EXT}`)}`
    + `&value=${encodeURIComponent(text)}`;
  return { url, tooLong: url.length > URL_LIMIT, length: url.length };
}
