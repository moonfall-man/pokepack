// Voting, without building voting.
//
// A pack's score is the thumbs-up count on its GitHub issue.  That means no
// server, no accounts, no database, and no moderation tools to write -- GitHub
// already has all of it, and needing an account to react is most of the spam
// problem solved for nothing.  The thread doubles as the pack's discussion
// page, which was going to be wanted anyway.
//
// CI folds the counts into packs.json, so the tool reads one number and never
// learns where it came from.  That is the seam: if a daily refresh stops being
// good enough, the producer changes and no client changes at all.
//
// The cost, stated plainly: counts are as fresh as the last CI run.

import { mapLimit } from './net.js';

export const LABEL = 'pack';

// A machine-readable id in the body rather than a parsed title.  Titles get
// edited -- by the maintainer tidying up, or by GitHub's own UI -- and an issue
// that stops matching its pack silently loses every vote on it.
const MARKER = 'pokepack-id:';

export function issueBody(pack, { indexUrl = null } = {}) {
  return [
    `<!-- ${MARKER} ${pack.id} -->`,
    `**${pack.name}**${pack.author ? ` by ${pack.author}` : ''}`,
    '',
    pack.summary || '_No summary._',
    '',
    `Installs ${pack.mods.length} mod${pack.mods.length === 1 ? '' : 's'}`
      + (pack.disable?.length ? `, switches ${pack.disable.length} off` : '')
      + (pack.engine ? ` · engine ${pack.engine}` : ''),
    '',
    '---',
    '',
    '\u{1f44d} **React with a thumbs-up to upvote this pack.** The count is read',
    'nightly and shown in the browse screen. Comments here are the right place to',
    'say what worked and what did not.',
    '',
    'A vote is not a safety check. Every mod is a third-party download from its',
    'own author, and being popular does not change that.',
    indexUrl ? `\n[The pack list](${indexUrl})` : '',
  ].join('\n').trimEnd();
}

export function idFromIssue(issue) {
  const m = String(issue?.body ?? '').match(new RegExp(`${MARKER}\\s*([A-Za-z0-9._-]+)`));
  return m ? m[1] : null;
}

/**
 * github({ repo, token }) -> request(path, init) -> parsed body
 *
 * Small on purpose: the four calls this file makes, with the auth header and
 * the error message in one place.
 */
export function github({ repo, token, fetchImpl = fetch }) {
  return async function api(path, init = {}) {
    const res = await fetchImpl(`https://api.github.com/repos/${repo}${path}`, {
      ...init,
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'pokepack',
        'x-github-api-version': '2022-11-28',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${res.status} ${res.statusText} for ${path}${text ? ` -- ${text.slice(0, 200)}` : ''}`);
    }
    return res.status === 204 ? null : res.json();
  };
}

/**
 * listPackIssues(api) -> [{ id, number, votes, url, title, locked }]
 *
 * Every pack thread, open or closed.  Closed ones still count: a pack that was
 * retired should not have its history quietly deleted.
 */
export async function listPackIssues(api) {
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await api(`/issues?labels=${LABEL}&state=all&per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const issue of batch) {
      // /issues returns pull requests too.  A PR that happens to carry the
      // label would otherwise show up as a pack with votes on it.
      if (issue.pull_request) continue;
      const id = idFromIssue(issue);
      if (!id) continue;
      out.push({
        id,
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        locked: issue.locked === true,
        state: issue.state,
        votes: Number(issue.reactions?.['+1']) || 0,
        comments: Number(issue.comments) || 0,
      });
    }
    if (batch.length < 100) break;
  }
  return out;
}

/**
 * votesFrom(issues) -> { [packId]: { votes, thread, comments } }
 *
 * Duplicates collapse to the busiest thread rather than the newest, so a
 * mistakenly reopened issue cannot wipe out the votes on the real one.
 */
export function votesFrom(issues) {
  const byId = {};
  for (const issue of issues) {
    const have = byId[issue.id];
    if (!have || issue.votes > have.votes) {
      byId[issue.id] = { votes: issue.votes, thread: issue.url, comments: issue.comments };
    }
  }
  return byId;
}

/**
 * syncIssues({ api, packs, existing, indexUrl, dryRun }) -> { created, existing }
 *
 * Opens a thread for any pack that has none.  Deliberately one-way: it never
 * edits or closes an existing issue, because that thread holds votes and other
 * people's comments, and a bad run should not be able to touch either.
 */
export async function syncIssues({ api, packs, existing, indexUrl = null, dryRun = false }) {
  const known = new Set(existing.map((i) => i.id));
  const missing = packs.filter((p) => !known.has(p.id));
  if (dryRun) return { created: missing.map((p) => ({ id: p.id, number: null })), skipped: packs.length - missing.length };

  const created = await mapLimit(missing, 3, async (p) => {
    const issue = await api('/issues', {
      method: 'POST',
      body: JSON.stringify({
        title: `${p.name}${p.author ? ` — ${p.author}` : ''}`,
        body: issueBody(p, { indexUrl }),
        labels: [LABEL],
      }),
    });
    return { id: p.id, number: issue.number, url: issue.html_url };
  });

  return { created, skipped: packs.length - missing.length };
}
