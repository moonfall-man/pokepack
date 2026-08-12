// Installing a pack, start to finish.  Shared by the CLI and the local UI so
// there is exactly one implementation of the sequence that matters.
//
// Order is deliberate: verify before writing anything, and write the profile
// last.  A profile pointing at mods that failed to install would be worse than
// no profile -- the launcher would import it and switch on a setup that is not
// there.

import { downloadToBuffer } from './net.js';
import { installMod, writeProfile } from './install.js';
import { resolve as makePlan, INSTALL, RECONCILE } from './resolve.js';
import { applyToOptions } from './liveapply.js';

/**
 * apply(pack, { saveDir, state, index, broken, replace, onEvent }) -> summary
 *
 * onEvent gets { type, ... } as it goes, so a CLI can print lines and a UI can
 * stream progress without either owning the logic.
 */
export async function apply(pack, {
  saveDir, state = {}, index = {}, broken = [], replace = true, force = false,
  applyLive = true, exePath = null, onEvent = () => {},
} = {}) {
  const plan = makePlan(pack, state, index, { broken });

  if (!plan.canActivate && !force) {
    const err = new Error('this pack cannot be completed, so nothing was installed');
    err.plan = plan;
    throw err;
  }

  const installed = [];
  const failed = [];

  for (const row of plan.fetchable) {
    onEvent({ type: 'start', id: row.id, version: row.want, bytes: row.source.size ?? null });
    try {
      const { buffer, sha256, size } = await downloadToBuffer(row.source.url);

      // Verify before anything touches the disk.  A file that fails this never
      // becomes a folder, so there is no half-installed state to clean up.
      if (row.wantHash && sha256 !== row.wantHash) {
        throw new Error(
          `the download does not match what this pack pinned (expected ${row.wantHash.slice(0, 12)}, got ${sha256.slice(0, 12)})`,
        );
      }

      const result = installMod(buffer, {
        saveDir,
        expectId: row.id,
        sha256: row.wantHash ?? sha256,
        replace: replace && row.status === RECONCILE,
        // Remember which pack put this here.  Without it there is no honest
        // way to answer "what did this pack install?" later, and uninstall
        // would be guessing at somebody's mods folder.
        pack: pack.id,
      });
      installed.push({ ...result, verified: !!row.wantHash, bytes: size });
      onEvent({ type: 'done', id: row.id, ...result, verified: !!row.wantHash });
    } catch (e) {
      failed.push({ id: row.id, reason: e.message });
      onEvent({ type: 'failed', id: row.id, reason: e.message });
    }
  }

  // Only claim what is actually on disk.  Mods that were already at the right
  // version count; mods that failed do not.
  const present = new Set([
    ...installed.map((m) => m.id),
    ...plan.mods.filter((r) => r.status !== INSTALL && r.status !== RECONCILE).map((r) => r.id),
  ]);

  let profile = null;
  let live = null;
  if (failed.length === 0 || force) {
    // Always write the profile file.  It is the fallback that works under every
    // condition, and having it costs nothing even when the direct apply lands.
    profile = writeProfile(saveDir, pack, { installedIds: present });
    onEvent({ type: 'profile', ...profile });

    if (applyLive) {
      live = applyToOptions(saveDir, pack, { installedIds: present, exePath });
      onEvent({ type: 'live', ...live });
    }
  }

  return { plan, installed, failed, profile, live, complete: failed.length === 0 };
}

export { makePlan };
