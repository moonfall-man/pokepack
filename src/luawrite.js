// Writer for the Lua-literal format gen1recomp reads.
//
// This has to match src/core/SaveSerializer.lua's writer exactly, not merely
// closely: the engine's own comment says the writer *is* the grammar's
// specification, and a .g1rmodlist we produce has to parse there.  So the key
// ordering, the indentation, the trailing commas and the %q escaping are all
// copied deliberately rather than approximated.
//
// The test suite proves it the only way worth trusting: re-serialize a real
// options.lua and compare against the original bytes.

// string.format("%q") as LuaJIT writes it -- which is what the game actually
// runs, and it differs from stock Lua 5.1 in one way that matters: control
// characters come out as decimal escapes (\13), not letter escapes (\r).
// Verified by round-tripping a real options.lua byte for byte.
//
// A decimal escape is padded to three digits when the next character is itself
// a digit, since "\131" would otherwise read as one escape rather than \13
// followed by "1".
function quote(s) {
  const str = String(s);
  let out = '"';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const code = str.charCodeAt(i);
    if (ch === '"') out += '\\"';
    else if (ch === '\\') out += '\\\\';
    else if (ch === '\n') out += '\\\n';
    else if (code < 32 || code === 127) {
      const next = str[i + 1];
      out += next >= '0' && next <= '9'
        ? `\\${String(code).padStart(3, '0')}`
        : `\\${code}`;
    } else out += ch;
  }
  return `${out}"`;
}

function num(n) {
  if (!Number.isFinite(n)) throw new Error(`cannot serialize the number ${n}`);
  return String(n);
}

// Keys sort by type name first, then by value -- so numeric keys land before
// string ones, and the same table always encodes the same way.  A profile file
// that encoded differently twice would make every diff meaningless.
function sortKeys(keys) {
  return keys.sort((a, b) => {
    const ta = typeof a === 'number' ? 'number' : 'string';
    const tb = typeof b === 'number' ? 'number' : 'string';
    if (ta !== tb) return ta < tb ? -1 : 1;
    if (ta === 'number') return a - b;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

const BARE_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

// A JS object has only string keys, so "1" is ambiguous: it may have come from
// a Lua array index or from a genuine string key.  Callers that care pass
// numericKeys, naming the tables whose keys should go back out as numbers.
function serialize(value, indent, opts) {
  const t = typeof value;
  if (t === 'number' || t === 'boolean') return t === 'number' ? num(value) : String(value);
  if (t === 'string') return quote(value);
  if (value === null || value === undefined) {
    throw new Error('cannot serialize nil -- Lua tables drop nil values, so leave the key out');
  }
  if (t !== 'object') throw new Error(`cannot serialize ${t}`);

  const pad = '  '.repeat(indent);
  const entries = Array.isArray(value)
    ? value.map((v, i) => [i + 1, v])
    : Object.entries(value).filter(([, v]) => v !== undefined && v !== null);

  if (entries.length === 0) return '{}';

  const map = new Map();
  for (const [k, v] of entries) {
    // Array elements arrive already numeric; object keys are numeric only when
    // the whole string is digits and the caller asked for it.
    const key = typeof k === 'number'
      ? k
      : (opts.numericKeys && /^\d+$/.test(k) ? Number(k) : k);
    map.set(key, v);
  }

  const parts = [];
  for (const key of sortKeys([...map.keys()])) {
    const rendered = typeof key === 'string' && BARE_KEY.test(key)
      ? key
      : `[${serialize(key, indent + 1, opts)}]`;
    parts.push(`${pad}  ${rendered} = ${serialize(map.get(key), indent + 1, opts)}`);
  }
  return `{\n${parts.join(',\n')},\n${pad}}`;
}

/**
 * encode(value, { numericKeys }) -> the `return ...` text the engine reads.
 *
 * numericKeys: treat all-digit object keys as Lua integer keys.  Needed when
 * round-tripping something parsed back out of Lua, where modProfiles[1] came
 * through JSON as "1".
 */
export function encode(value, { numericKeys = false } = {}) {
  return `return ${serialize(value, 0, { numericKeys })}\n`;
}

// The .g1rmodlist envelope, matching ModProfile.encode: format, formatVersion,
// and the profile record itself.  Nothing else -- an export the launcher will
// not recognise is worse than no export.
export function encodeModList(profile) {
  if (!profile || typeof profile.name !== 'string' || profile.name === '') {
    throw new Error('a profile needs a name');
  }
  return encode({
    format: 'g1rmodlist',
    formatVersion: 1,
    profile: {
      name: profile.name.slice(0, 10),
      enabled: profile.enabled ?? {},
      options: profile.options ?? {},
      slots: profile.slots ?? {},
    },
  });
}

// profiles/<NAME>.g1rmodlist, matching ModProfile.fileFor: upper-cased, and
// everything outside letters, digits and dashes replaced -- so a shared name
// can never escape the folder.
export function fileNameFor(name) {
  return `${String(name).toUpperCase().replace(/[^A-Za-z0-9-]/g, '_')}.g1rmodlist`;
}
