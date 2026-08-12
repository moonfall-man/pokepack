// Turn a link somebody pasted into a downloadable zip.
//
// The useful case is a mod that is not in the index: the author publishes
// releases on GitHub, so the release page is what gets shared in a thread, and
// that page is not a file.  Resolving it here means a mod added by hand still
// ends up with a real URL and a hash recorded against it -- which is the whole
// difference between a pack you can publish and one that only works on your
// own machine.
//
// https only, and only the shapes below.  A "paste any URL" box on a local
// server that then downloads and unpacks the result deserves narrow rules.

import { fetchJson } from './net.js';

const RELEASE_TAG = /^\/([^/]+)\/([^/]+)\/releases\/tag\/(.+)$/;
const RELEASE_LATEST = /^\/([^/]+)\/([^/]+)\/releases\/latest\/?$/;
const RELEASES = /^\/([^/]+)\/([^/]+)\/releases\/?$/;
const REPO = /^\/([^/]+)\/([^/]+)\/?$/;

/**
 * pickZip(assets, { id }) -> asset | null
 *
 * Prefers "<ID>-<version>.zip", which is the convention the engine's own
 * updater looks for, then any zip.  A release with a source-code zip and a mod
 * zip must not hand back the source.
 */
export function pickZip(assets, { id = null } = {}) {
  const zips = (assets ?? []).filter((a) => typeof a?.name === 'string'
    && a.name.toLowerCase().endsWith('.zip') && a.browser_download_url);
  if (zips.length === 0) return null;
  if (id) {
    const prefixed = zips.find((a) => a.name.toLowerCase().startsWith(`${id.toLowerCase()}-`));
    if (prefixed) return prefixed;
  }
  return zips.reduce((big, a) => ((a.size ?? 0) > (big.size ?? 0) ? a : big), zips[0]);
}

/**
 * resolveDownload(link, { id, fetchJson }) -> { url, size, version, from }
 *
 * Throws with a reason somebody can act on rather than returning null: this is
 * driven by a person pasting a link, and "that did not work" is not an answer.
 */
export async function resolveDownload(link, { id = null, fetch: getJson = fetchJson } = {}) {
  let u;
  try {
    u = new URL(String(link ?? '').trim());
  } catch {
    return Promise.reject(new Error(`that is not a URL: ${link}`));
  }
  if (u.protocol !== 'https:') throw new Error('the link has to be https');

  // A direct file, wherever it is hosted.
  if (u.pathname.toLowerCase().endsWith('.zip')) {
    return { url: u.href, size: null, version: null, from: 'direct link' };
  }

  const host = u.hostname.toLowerCase();
  if (host !== 'github.com' && host !== 'www.github.com') {
    throw new Error('only a GitHub release page, or a direct link to a .zip, can be resolved');
  }

  let api;
  let from;
  let m;
  if ((m = RELEASE_TAG.exec(u.pathname))) {
    api = `https://api.github.com/repos/${m[1]}/${m[2]}/releases/tags/${encodeURIComponent(m[3])}`;
    from = `${m[1]}/${m[2]} ${m[3]}`;
  } else if ((m = RELEASE_LATEST.exec(u.pathname) || RELEASES.exec(u.pathname) || REPO.exec(u.pathname))) {
    api = `https://api.github.com/repos/${m[1]}/${m[2]}/releases/latest`;
    from = `${m[1]}/${m[2]} latest`;
  } else {
    throw new Error('point at a release page, e.g. .../releases/tag/v1.8.2, or straight at a .zip');
  }

  let release;
  try {
    release = await getJson(api);
  } catch (e) {
    throw new Error(`could not read that release: ${e.message}`);
  }

  const asset = pickZip(release?.assets, { id });
  if (!asset) {
    throw new Error(`${from} publishes no .zip asset -- the release has nothing to install`);
  }
  return {
    url: asset.browser_download_url,
    size: asset.size ?? null,
    version: String(release.tag_name ?? '').replace(/^[vV]/, '') || null,
    name: asset.name,
    from,
  };
}
