// Removing a pack.
//
// Three rules, all of which exist because a mods folder is somebody's install
// and not scratch space:
//
//   1. Only mods this pack actually installed are touched.  That is knowable
//      because the lock sidecar records which pack put each one there -- a mod
//      the player added by hand is never in scope, even if the pack lists it.
//   2. A mod another installed pack also uses is kept.  Two packs sharing a
//      dependency is normal; removing one must not break the other.
//   3. Nothing is deleted.  Folders move to mods/.pokepack-backup/, which is
//      also where a replaced mod goes.  "Easy to redownload" is not the same
//      as "fine to remove", and the 21 MB voxel mod on a slow line is not
//      easy at all.

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { LOCK_FILE } from './state.js';
import { BACKUP_DIR } from './install.js';
import { parse, toArray } from './luadata.js';
import { encode } from './luawrite.js';
import { isGameRunning, OPTIONS } from './liveapply.js';

function readLock(saveDir) {
  const path = join(saveDir, LOCK_FILE);
  if (!existsSync(path)) return { path, doc: { mods: {} } };
  try {
    const doc = JSON.parse(readFileSync(path, 'utf8'));
    return { path, doc: doc && typeof doc.mods === 'object' ? doc : { mods: {} } };
  } catch {
    return { path, doc: { mods: {} } };
  }
}

/**
 * planUninstall(saveDir, packId) -> { remove, keep, notOurs }
 *
 * Pure enough to show in a confirm dialog before anything moves.
 */
export function planUninstall(saveDir, packId) {
  const { doc } = readLock(saveDir);
  const remove = [];
  const keep = [];

  for (const [id, rec] of Object.entries(doc.mods ?? {})) {
    if (rec?.pack !== packId) continue;
    if (!existsSync(join(saveDir, 'mods', id))) continue;
    // A mod is shared when some *other* pack recorded it too.  The lock keys on
    // mod id, so this can only happen once packs record more than one owner --
    // kept here so the shape is right when they do.
    const alsoUsedBy = Object.entries(doc.mods ?? {})
      .filter(([otherId, other]) => otherId === id && other?.pack && other.pack !== packId)
      .map(([, other]) => other.pack);
    if (alsoUsedBy.length) keep.push({ id, usedBy: alsoUsedBy });
    else remove.push({ id, version: rec.version ?? null });
  }

  return { packId, remove, keep };
}

/**
 * uninstall(saveDir, pack) -> result
 *
 * `pack` may be a full pack (so its `disable` list can be undone) or just an id.
 */
export function uninstall(saveDir, pack, { running: runningOverride, exePath = null } = {}) {
  const packId = typeof pack === 'string' ? pack : pack.id;
  const plan = planUninstall(saveDir, packId);

  if (plan.remove.length === 0) {
    return { ...plan, moved: [], optionsChanged: false, reason: 'nothing this pack installed is still here' };
  }

  const backupRoot = join(saveDir, 'mods', BACKUP_DIR);
  mkdirSync(backupRoot, { recursive: true });

  const moved = [];
  for (const mod of plan.remove) {
    const from = join(saveDir, 'mods', mod.id);
    let target = join(backupRoot, `${mod.id}-${mod.version ?? 'unknown'}`);
    for (let n = 2; existsSync(target); n++) {
      target = join(backupRoot, `${mod.id}-${mod.version ?? 'unknown'}-${n}`);
    }
    renameSync(from, target);
    moved.push({ id: mod.id, to: target });
  }

  // Forget them in the sidecar, so a later install is a clean install rather
  // than tripping the "already installed" guard against a folder that moved.
  const { path, doc } = readLock(saveDir);
  for (const mod of moved) delete doc.mods[mod.id];
  writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);

  const optionsResult = switchOff(saveDir, moved.map((m) => m.id), packId, {
    running: runningOverride, exePath,
  });

  return { ...plan, moved, ...optionsResult };
}

/**
 * removeMod(saveDir, id) -> result
 *
 * Remove one named mod, whoever installed it.
 *
 * This is deliberately less cautious than uninstall(): removing a *pack* has an
 * implicit scope, so it only touches what that pack put there.  Clicking Remove
 * on one named mod is explicit -- the scope is the thing you clicked.  It still
 * moves rather than deletes, so nothing is lost either way.
 */
export function removeMod(saveDir, id, { running: runningOverride, exePath = null } = {}) {
  const from = join(saveDir, 'mods', id);
  if (!existsSync(from)) return { moved: [], reason: `${id} is not installed here` };

  let version = null;
  try {
    version = JSON.parse(readFileSync(join(from, 'manifest.json'), 'utf8')).version ?? null;
  } catch { /* a mod with no readable manifest still gets moved, just unlabelled */ }

  const backupRoot = join(saveDir, 'mods', BACKUP_DIR);
  mkdirSync(backupRoot, { recursive: true });
  let target = join(backupRoot, `${id}-${version ?? 'unknown'}`);
  for (let n = 2; existsSync(target); n++) target = join(backupRoot, `${id}-${version ?? 'unknown'}-${n}`);
  renameSync(from, target);

  const { path, doc } = readLock(saveDir);
  delete doc.mods[id];
  writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);

  const optionsResult = switchOff(saveDir, [id], null, { running: runningOverride, exePath });
  return { moved: [{ id, to: target }], version, ...optionsResult };
}

// Take the removed mods out of the enable map and drop the pack's profile
// record, under the same conditions liveapply uses: game closed, merge only,
// re-parse before replacing, keep the previous file.
function switchOff(saveDir, ids, packId, { running: runningOverride, exePath }) {
  const running = runningOverride === undefined ? isGameRunning(exePath) : runningOverride;
  if (running !== false) {
    return {
      optionsChanged: false,
      optionsReason: running === true
        ? 'the game is running, so options.lua was left alone -- the mods are gone but still listed'
        : 'could not tell whether the game is running, so options.lua was left alone',
    };
  }

  const path = join(saveDir, OPTIONS);
  if (!existsSync(path)) return { optionsChanged: false };

  let options;
  try {
    options = parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return { optionsChanged: false, optionsReason: `options.lua did not parse (${e.message})` };
  }
  if (!options || typeof options !== 'object') return { optionsChanged: false };

  for (const id of ids) {
    if (options.mods) delete options.mods[id];
    if (options.modOptions) delete options.modOptions[id];
  }

  // Drop the pack's profile record too, so the launcher does not offer a
  // setup whose mods are no longer on disk.  Only when removing a whole pack:
  // pulling one mod should not delete a profile somebody hand-made.
  const profiles = packId ? toArray(options.modProfiles ?? {}) : [];
  const kept = profiles.filter((p) => !p || !ids.some((id) => p.enabled?.[id] === true));
  if (kept.length !== profiles.length) {
    const rebuilt = {};
    kept.forEach((p, i) => { rebuilt[String(i + 1)] = p; });
    options.modProfiles = rebuilt;
    if (!kept.some((p) => p?.name === options.activeProfile)) options.activeProfile = null;
  }

  let text;
  try {
    text = encode(options, { numericKeys: true });
    parse(text);
  } catch (e) {
    return { optionsChanged: false, optionsReason: `refusing to write an options.lua that does not read back: ${e.message}` };
  }

  let backup = `${path}.pokepack-bak`;
  for (let n = 2; existsSync(backup); n++) backup = `${path}.pokepack-bak${n}`;
  writeFileSync(backup, readFileSync(path));
  writeFileSync(path, text);

  return { optionsChanged: true, optionsBackup: backup, packId };
}
