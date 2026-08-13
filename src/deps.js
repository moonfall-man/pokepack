// Dependencies and conflicts, as authors actually write them.
//
// A dependency is "ID@range", and the range is a small semver dialect the
// engine already uses: comparators separated by spaces are ANDed, alternatives
// separated by || are ORed.
//
//     "DRAMATIC_SHAPE@>=1.7.0 <2.0.0"
//     "0.0.0-dev || >=0.1.37 <2.0.0"
//
// Splitting on "@" matters more than it looks: without it the whole string is
// treated as a mod id, nothing ever matches an installed mod, and the
// dependency check silently passes everything.  That was the bug.
//
// Unrecognised comparators are ignored rather than failed.  This code decides
// whether to warn somebody their setup is broken, and inventing a missing
// dependency because an author wrote a range dialect we do not know is worse
// than missing a real one -- the game itself is the backstop either way.

// Compare dotted versions numerically, falling back to string order for the
// non-numeric tails authors sometimes ship ("1.7.6-beta").  Lives here rather
// than in resolve.js so the import between them stays one-way.
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

/**
 * parseDep(raw) -> { id, range }
 *
 * Accepts every shape seen in the wild: "ID", "ID@range", and the object form
 * { id, range } that some index entries use.
 */
export function parseDep(raw) {
  if (raw && typeof raw === 'object' && typeof raw.id === 'string') {
    return { id: raw.id, range: typeof raw.range === 'string' ? raw.range.trim() : null };
  }
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const s = raw.trim();
  const at = s.indexOf('@');
  if (at <= 0) return { id: s, range: null };
  const range = s.slice(at + 1).trim();
  return { id: s.slice(0, at).trim(), range: range === '' ? null : range };
}

export function parseDeps(list) {
  if (!Array.isArray(list)) return [];
  return list.map(parseDep).filter((d) => d && d.id);
}

export function conflictIds(list) {
  if (!Array.isArray(list)) return [];
  return list.map((c) => (typeof c === 'string' ? parseDep(c)?.id : c?.id))
    .filter((id) => typeof id === 'string' && id !== '');
}

function comparator(version, token) {
  const m = /^(>=|<=|>|<|=|\^|~)?\s*(.+)$/.exec(token);
  if (!m) return true;
  const [, op, want] = m;
  if (want === '*' || want === 'x' || want === '') return true;
  // Only something that starts like a version is treated as one.  A token we
  // cannot read is a dialect we do not know, and refusing it would report a
  // missing dependency that is sitting right there.
  if (!/^\d/.test(want)) return true;
  const cmp = compareVersions(version, want);
  switch (op) {
    case '>=': return cmp >= 0;
    case '>': return cmp > 0;
    case '<=': return cmp <= 0;
    case '<': return cmp < 0;
    case '=': case undefined: return cmp === 0;
    // ^1.2.3 and ~1.2.3 both mean "at least this, below the next boundary".
    // Treated the same deliberately: the difference never decides whether a
    // gen1 mod loads, and guessing wrong in the strict direction invents a
    // problem the player does not have.
    case '^': case '~': return cmp >= 0;
    default: return true;
  }
}

/**
 * satisfies(version, range) -> boolean
 *
 * A missing range means "any version", which is what a bare "ID" dependency
 * means.  A missing version means we cannot tell, so we say yes.
 */
export function satisfies(version, range) {
  if (!range) return true;
  if (!version) return true;
  return String(range).split('||').some((alt) => alt.trim().split(/\s+/).filter(Boolean)
    .every((token) => comparator(version, token)));
}

/**
 * check(mods) -> { [id]: { missing, wrongVersion, clashes } }
 *
 * mods: { [id]: { version, dependencies, conflicts } } -- whatever is installed.
 *
 * Conflicts are checked both ways round.  Only one side has to declare it for
 * the two to be incompatible, and which side did is not the player's problem.
 */
export function check(mods) {
  const out = {};
  const ids = Object.keys(mods);

  for (const id of ids) {
    const mod = mods[id] ?? {};
    const missing = [];
    const wrongVersion = [];

    for (const dep of parseDeps(mod.dependencies)) {
      const have = mods[dep.id];
      if (!have) missing.push(dep);
      else if (!satisfies(have.version, dep.range)) {
        wrongVersion.push({ ...dep, have: have.version ?? null });
      }
    }

    const declared = conflictIds(mod.conflicts);
    const clashes = ids.filter((other) => other !== id && (
      declared.includes(other) || conflictIds(mods[other]?.conflicts).includes(id)
    ));

    out[id] = { missing, wrongVersion, clashes };
  }
  return out;
}

/**
 * loadOrder(mods) -> { order, brokenLoop }
 *
 * The order the engine will load these mods in, worked out without running it.
 *
 * A deliberate mirror of Loader:_order, down to the tiebreaks, because the
 * point is to agree with it:
 *
 *   - only active mods take part
 *   - priority ascending, ties broken by id, so it never depends on the order
 *     a directory happened to be read in
 *   - both hard *and optional* dependencies create an ordering edge, so an
 *     optional dependency still loads first when it is present
 *   - Kahn's algorithm, always taking the ready mod with the lowest
 *     (priority, id)
 *   - an optional dependency can close a loop that the hard-dependency check
 *     deliberately ignores; break it at the lowest id rather than dropping the
 *     mods, and say which one
 *
 * priority defaults to 0, matching Manifest.lua's `tonumber(raw.priority) or 0`
 * -- a mod that declares none must not sort after one that asked for 0.
 */
export function loadOrder(mods) {
  const active = Object.keys(mods).filter((id) => mods[id]?.enabled !== false);
  const prio = (id) => {
    const p = Number(mods[id]?.priority);
    return Number.isFinite(p) ? p : 0;
  };
  const before = (a, b) => (prio(a) !== prio(b) ? prio(a) - prio(b) : (a < b ? -1 : 1));

  const pending = new Set(active);
  const indegree = new Map(active.map((id) => [id, 0]));
  const dependents = new Map();

  for (const id of active) {
    const edges = [
      ...parseDeps(mods[id]?.dependencies),
      ...parseDeps(mods[id]?.optional_dependencies ?? mods[id]?.optionalDependencies),
    ];
    for (const dep of edges) {
      if (!pending.has(dep.id) || dep.id === id) continue;
      if (!dependents.has(dep.id)) dependents.set(dep.id, []);
      dependents.get(dep.id).push(id);
      indegree.set(id, indegree.get(id) + 1);
    }
  }

  const order = [];
  let brokenLoop = null;
  while (pending.size > 0) {
    const ready = [...pending].filter((id) => indegree.get(id) === 0).sort(before);
    let next = ready[0];
    if (next === undefined) {
      // Everything left is in a cycle only optional dependencies could have
      // closed.  Dropping them would be worse than picking one.
      next = [...pending].sort()[0];
      brokenLoop = brokenLoop ?? next;
    }
    pending.delete(next);
    // Why it sits here.  "priority 110" and "after DRAMATIC_SHAPE" are
    // different problems: one you could ask an author to change, the other is
    // the dependency graph and cannot move.
    const forcedAfter = [
      ...parseDeps(mods[next]?.dependencies),
      ...parseDeps(mods[next]?.optional_dependencies ?? mods[next]?.optionalDependencies),
    ].map((d) => d.id).filter((id) => id !== next && order.some((m) => m.id === id));

    order.push({
      id: next,
      priority: prio(next),
      version: mods[next]?.version ?? null,
      after: forcedAfter,
      why: forcedAfter.length ? `after ${forcedAfter.join(', ')}` : `priority ${prio(next)}`,
    });
    for (const dependent of dependents.get(next) ?? []) {
      if (indegree.has(dependent)) indegree.set(dependent, indegree.get(dependent) - 1);
    }
  }

  return { order, brokenLoop };
}

// Does this mod have anything wrong with it?
export function isHealthy(report) {
  return !report || (report.missing.length === 0
    && report.wrongVersion.length === 0 && report.clashes.length === 0);
}
