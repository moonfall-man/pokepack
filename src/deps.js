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

// Does this mod have anything wrong with it?
export function isHealthy(report) {
  return !report || (report.missing.length === 0
    && report.wrongVersion.length === 0 && report.clashes.length === 0);
}
