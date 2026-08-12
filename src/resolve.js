// Turn a pack plus what is on this machine into a plan, before anything is
// downloaded.
//
// Resolving up front is the whole point.  The index already publishes each
// mod's dependencies and conflicts, so a pack that cannot work is knowable
// before the first byte moves -- "installs 3 of 6, and here is which 3 and
// why" beats discovering it after four downloads.
//
// Pure: no network, no filesystem.  src/state.js reads the machine, src/net.js
// touches the wire, and this decides.

export const OK = 'ok';                   // installed, right bytes
export const INSTALL = 'install';         // absent, fetchable
export const RECONCILE = 'reconcile';     // installed, wrong version
export const UNAVAILABLE = 'unavailable'; // nothing installable to point at
export const BLOCKED = 'blocked';         // a dependency died, so this dies too

// Compare dotted versions numerically, falling back to string order for the
// non-numeric tails authors sometimes ship ("1.7.6-beta").
export function compareVersions(a, b) {
  if (a === b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  const pa = String(a).split(/[.\-+]/);
  const pb = String(b).split(/[.\-+]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? '';
    const y = pb[i] ?? '';
    const nx = Number(x);
    const ny = Number(y);
    if (Number.isFinite(nx) && Number.isFinite(ny) && x !== '' && y !== '') {
      if (nx !== ny) return nx < ny ? -1 : 1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

// Dependency lists come off the index unparsed, and authors write them both
// ways: ["OTHER_MOD"] and [{ id = "OTHER_MOD", range = ">=1.2" }].
function dependencyIds(entry) {
  const raw = entry?.dependencies;
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const dep of raw) {
    if (typeof dep === 'string') out.push(dep);
    else if (dep && typeof dep === 'object' && typeof dep.id === 'string') out.push(dep.id);
  }
  return out;
}

function conflictIds(entry) {
  const raw = entry?.conflicts;
  if (!Array.isArray(raw)) return [];
  return raw.filter((c) => typeof c === 'string');
}

/**
 * resolve(pack, state, index) -> plan
 *
 * state  { mods: { [id]: { version, sha256?, enabled } } }
 * index  { [id]: indexEntry }  -- optional; without it dependency and conflict
 *                                 cascade cannot run, and the plan says so.
 * opts   { broken: [modId] }   -- mods the gallery's last validation run found
 *                                 unreachable.  A valid pack always carries a
 *                                 URL, so a link being dead is knowledge that
 *                                 arrives from outside it; this is where the
 *                                 CI report gets folded in.
 */
export function resolve(pack, state = {}, index = {}, { broken = [] } = {}) {
  const isBroken = new Set(broken);
  const installed = state.mods ?? {};
  const rows = [];

  for (const mod of pack.mods) {
    const have = installed[mod.id];
    const row = {
      id: mod.id,
      want: mod.version,
      wantHash: mod.source.sha256 ?? null,
      have: have?.version ?? null,
      haveHash: have?.sha256 ?? null,
      source: mod.source,
      options: mod.options,
      priority: mod.priority ?? null,
      notes: mod.notes ?? null,
    };

    if (!mod.source.url) {
      row.status = UNAVAILABLE;
      row.reason = 'the pack lists no download for this mod';
    } else if (isBroken.has(mod.id)) {
      row.status = UNAVAILABLE;
      row.reason = 'the download no longer resolves (last validation run)';
    } else if (!have) {
      row.status = INSTALL;
      row.reason = 'not installed here';
    } else if (mod.source.sha256 && have.sha256) {
      // The hash is the identity.  Two files calling themselves 1.7.1 are not
      // the same mod if their bytes differ, and this is the only check that
      // notices.
      if (have.sha256 === mod.source.sha256) {
        row.status = OK;
      } else {
        row.status = RECONCILE;
        row.direction = compareVersions(have.version, mod.version) > 0 ? 'downgrade' : 'upgrade';
        row.reason = have.version === mod.version
          ? `same version number (${mod.version}) but different bytes`
          : `installed ${have.version}, pack wants ${mod.version}`;
      }
    } else if (mod.version && have.version && mod.version !== have.version) {
      row.status = RECONCILE;
      row.direction = compareVersions(have.version, mod.version) > 0 ? 'downgrade' : 'upgrade';
      row.reason = `installed ${have.version}, pack wants ${mod.version}`;
    } else {
      row.status = OK;
      if (!mod.source.sha256) row.reason = 'version matches, but this pack is unpinned';
    }

    rows.push(row);
  }

  const byId = new Map(rows.map((r) => [r.id, r]));
  const hasIndex = Object.keys(index).length > 0;

  // Cascade.  A mod whose hard dependency could not be resolved cannot work
  // either, so it is marked rather than downloaded.  Iterate to a fixed point
  // so a chain A -> B -> C fails all the way down.
  if (hasIndex) {
    for (let pass = 0; pass < rows.length; pass++) {
      let changed = false;
      for (const row of rows) {
        if (row.status === UNAVAILABLE || row.status === BLOCKED) continue;
        for (const depId of dependencyIds(index[row.id])) {
          const dep = byId.get(depId);
          const depDead = dep
            ? dep.status === UNAVAILABLE || dep.status === BLOCKED
            : !installed[depId];
          if (depDead) {
            row.status = BLOCKED;
            row.blockedBy = depId;
            row.reason = dep
              ? `needs ${depId}, which this pack cannot resolve`
              : `needs ${depId}, which the pack does not list and you do not have`;
            changed = true;
            break;
          }
        }
      }
      if (!changed) break;
    }
  }

  // Conflicts.  Two kinds worth telling apart: the pack contradicting itself
  // (its author's problem, and it should never have validated) and the pack
  // colliding with something already installed (the player's problem, and
  // fixable by listing it in `disable`).
  const conflicts = [];
  if (hasIndex) {
    const disabling = new Set(pack.disable);
    for (const row of rows) {
      for (const other of conflictIds(index[row.id])) {
        if (byId.has(other)) {
          if (row.id < other) {
            conflicts.push({
              kind: 'pack-internal',
              a: row.id,
              b: other,
              text: `${row.id} and ${other} both ship in this pack but declare a conflict`,
            });
          }
        } else if (installed[other] && installed[other].enabled && !disabling.has(other)) {
          conflicts.push({
            kind: 'installed',
            a: row.id,
            b: other,
            text: `${row.id} conflicts with ${other}, which you have enabled and this pack does not turn off`,
          });
        }
      }
    }
  }

  const disable = pack.disable.map((id) => {
    const have = installed[id];
    if (!have) return { id, status: 'absent' };
    return { id, status: have.enabled ? 'turn-off' : 'off' };
  });

  const summary = { ok: 0, install: 0, reconcile: 0, unavailable: 0, blocked: 0 };
  for (const row of rows) summary[row.status]++;

  const complete = summary.unavailable === 0 && summary.blocked === 0;

  return {
    pack: { id: pack.id, name: pack.name, author: pack.author, strict: pack.strict },
    mods: rows,
    disable,
    conflicts,
    summary,
    complete,
    cascadeChecked: hasIndex,
    // strict packs refuse to become the active setup unless every mod resolved:
    // most of a tested combination is an untested combination.
    canActivate: complete || !pack.strict,
    fetchable: rows.filter((r) => r.status === INSTALL || r.status === RECONCILE),
  };
}
