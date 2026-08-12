// Rot detection.  Mods move, get unpublished, or get re-uploaded under the
// same tag, and a gallery full of packs that quietly stopped working is worse
// than a small one.
//
// This runs where the packs live -- a scheduled job in the gallery repo -- and
// writes its answer into the feed.  Deliberately not in the launcher: N players
// times M links is a lot of requests to ask GitHub for the same answer, and
// every one of them would compute what one CI run already knows.

import * as net from './net.js';
import { mapLimit } from './net.js';

export const LIVE = 'live';       // every link resolves
export const CHANGED = 'changed'; // resolves, but the bytes are not what was pinned
export const BROKEN = 'broken';   // something no longer resolves

/**
 * validatePack(pack, { deep, concurrency }) -> report
 *
 * deep: download every mod and verify its sha256.  Slow and bandwidth-hungry,
 * so the schedule that runs it should be much lazier than the link check.
 *
 * deps lets a test hand in the wire.
 */
export async function validatePack(pack, { deep = false, concurrency = 4, deps = net } = {}) {
  const { checkUrl, hashUrl } = deps;
  const rows = await mapLimit(pack.mods, concurrency, async (mod) => {
    const row = { id: mod.id, version: mod.version, url: mod.source.url };

    const check = await checkUrl(mod.source.url);
    if (!check.ok) {
      row.status = BROKEN;
      row.reason = check.reason ?? `link does not resolve (${check.status})`;
      return row;
    }

    // A size that moved is a cheap tell that the asset was replaced, and it
    // costs nothing next to downloading tens of megabytes to find out.
    if (mod.source.size && check.size && check.size !== mod.source.size) {
      row.status = CHANGED;
      row.reason = `size is ${check.size} bytes, pack recorded ${mod.source.size}`;
      if (!deep) return row;
    }

    if (deep && mod.source.sha256) {
      try {
        const { sha256, size } = await hashUrl(mod.source.url);
        if (sha256 !== mod.source.sha256) {
          row.status = CHANGED;
          row.reason = 'the file downloads but its contents no longer match what was pinned';
          row.sha256 = sha256;
          row.size = size;
          return row;
        }
      } catch (e) {
        row.status = BROKEN;
        row.reason = `download failed: ${e.message}`;
        return row;
      }
    }

    if (!row.status) {
      row.status = LIVE;
      if (!mod.source.sha256) row.reason = 'link is live, but this mod is unpinned';
    }
    return row;
  });

  const broken = rows.filter((r) => r.status === BROKEN);
  const changed = rows.filter((r) => r.status === CHANGED);

  return {
    pack: pack.id,
    name: pack.name,
    status: broken.length ? BROKEN : changed.length ? CHANGED : LIVE,
    deep,
    mods: rows,
    counts: { live: rows.length - broken.length - changed.length, changed: changed.length, broken: broken.length },
  };
}
