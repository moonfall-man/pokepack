// The .pokepack file: shape, validation, and serialization.
//
// A pack is a recipe, not a payload.  It names mods, pins each one to the
// exact bytes that were tested (sha256 -- the version string is a label for
// humans, the hash is the identity), carries the settings those mods were
// tested at, and says which mods must be OFF.  It hosts nothing.
//
// Validation posture is borrowed from src/mods/ModIndex.lua: an unknown
// formatVersion is refused outright rather than parsed hopefully, because a
// bumped format may reuse a field name for something else.  Everything a
// shared file provides is shape-checked before any consumer indexes into it.

export const FORMAT = 'pokepack';
export const FORMAT_VERSION = 1;
export const EXT = '.pokepack';

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const SHA256_RE = /^[a-f0-9]{64}$/;

class Invalid extends Error {}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function str(v, what) {
  if (typeof v !== 'string' || v === '') throw new Invalid(`${what} must be a non-empty string`);
  return v;
}

function optStr(v, what) {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') throw new Invalid(`${what} must be a string`);
  return v;
}

// Settings are scalars only, mirroring ModProfile.capture: the engine stores
// string/number/boolean and drops the rest, so anything else here could never
// have come from a real profile.
function scalarBucket(v, what) {
  if (v === undefined) return {};
  if (!isObj(v)) throw new Invalid(`${what} must be an object`);
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    const t = typeof val;
    if (t !== 'string' && t !== 'number' && t !== 'boolean') {
      throw new Invalid(`${what}.${k} must be a string, number or boolean`);
    }
    out[k] = val;
  }
  return out;
}

function validateSource(src, where) {
  if (!isObj(src)) throw new Invalid(`${where}.source must be an object`);
  const url = str(src.url, `${where}.source.url`);
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Invalid(`${where}.source.url is not a URL`);
  }
  // A pack is fetched unattended on someone else's machine.  Plain http means
  // whoever is between them and the author picks the bytes; the hash would
  // catch it, but only after the download, and only if the pack itself
  // arrived intact.  Refuse rather than warn.
  if (parsed.protocol !== 'https:') {
    throw new Invalid(`${where}.source.url must be https`);
  }
  const out = { url };
  if (src.sha256 !== undefined && src.sha256 !== null) {
    if (typeof src.sha256 !== 'string' || !SHA256_RE.test(src.sha256)) {
      throw new Invalid(`${where}.source.sha256 must be 64 lowercase hex characters`);
    }
    out.sha256 = src.sha256;
  }
  if (src.size !== undefined && src.size !== null) {
    if (!Number.isInteger(src.size) || src.size < 0) {
      throw new Invalid(`${where}.source.size must be a non-negative integer`);
    }
    out.size = src.size;
  }
  return out;
}

function validateMod(raw, i) {
  const where = `mods[${i}]`;
  if (!isObj(raw)) throw new Invalid(`${where} must be an object`);
  const id = str(raw.id, `${where}.id`);
  if (!ID_RE.test(id)) throw new Invalid(`${where}.id has characters outside [A-Za-z0-9_-]`);

  const mod = {
    id,
    version: optStr(raw.version, `${where}.version`) ?? null,
    source: validateSource(raw.source, where),
    options: scalarBucket(raw.options, `${where}.options`),
  };

  if (raw.priority !== undefined && raw.priority !== null) {
    if (!Number.isFinite(raw.priority)) throw new Invalid(`${where}.priority must be a number`);
    mod.priority = raw.priority;
  }
  const notes = optStr(raw.notes, `${where}.notes`);
  if (notes) mod.notes = notes;

  return mod;
}

// decode(text) -> pack.  Throws Invalid with a printable reason.
export function decode(text) {
  if (typeof text !== 'string' || text.trim() === '') throw new Invalid('empty file');
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    throw new Invalid(`not valid JSON: ${e.message}`);
  }
  return validate(doc);
}

export function validate(doc) {
  if (!isObj(doc)) throw new Invalid('a pack must be a JSON object');
  if (doc.format !== FORMAT) throw new Invalid('not a pokepack file');
  if (doc.formatVersion !== FORMAT_VERSION) {
    throw new Invalid(
      `pack format ${doc.formatVersion} is not supported (this build reads ${FORMAT_VERSION})`,
    );
  }

  const id = str(doc.id, 'id');
  if (!SLUG_RE.test(id)) {
    throw new Invalid('id must be lowercase letters, digits and dashes');
  }

  if (!Array.isArray(doc.mods)) throw new Invalid('mods must be an array');
  if (doc.mods.length === 0) throw new Invalid('a pack must list at least one mod');

  const mods = doc.mods.map(validateMod);
  const seen = new Set();
  for (const m of mods) {
    if (seen.has(m.id)) throw new Invalid(`${m.id} is listed twice`);
    seen.add(m.id);
  }

  const disable = [];
  for (const raw of doc.disable ?? []) {
    const v = str(raw, 'disable[]');
    if (!ID_RE.test(v)) throw new Invalid(`disable lists a bad mod id: ${v}`);
    if (seen.has(v)) throw new Invalid(`${v} is both installed and disabled by this pack`);
    disable.push(v);
  }

  const slots = {};
  for (const [version, slot] of Object.entries(doc.slots ?? {})) {
    if (!['red', 'blue', 'yellow'].includes(version)) {
      throw new Invalid(`slots has an unknown game version: ${version}`);
    }
    slots[version] = str(slot, `slots.${version}`);
  }

  // A screenshot makes a browse screen worth looking at, but this repo hosts no
  // images any more than it hosts mods -- the pack points at one the author
  // already publishes.  https only, same reasoning as a mod source.
  let thumbnail = null;
  if (doc.thumbnail !== undefined && doc.thumbnail !== null && doc.thumbnail !== '') {
    const url = str(doc.thumbnail, 'thumbnail');
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new Invalid('thumbnail is not a URL');
    }
    if (parsed.protocol !== 'https:') throw new Invalid('thumbnail must be https');
    thumbnail = url;
  }

  return {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    id,
    name: str(doc.name, 'name'),
    author: optStr(doc.author, 'author') ?? null,
    summary: optStr(doc.summary, 'summary') ?? '',
    thumbnail,
    engine: optStr(doc.engine, 'engine') ?? null,
    createdAt: optStr(doc.createdAt, 'createdAt') ?? null,
    // Default true on purpose.  A pack that only half-resolved is not the
    // combination its author tested, and quietly activating it reproduces the
    // exact failure packs exist to prevent.
    strict: doc.strict === undefined ? true : doc.strict === true,
    mods,
    disable,
    slots,
  };
}

export function encode(pack) {
  return `${JSON.stringify(validate(pack), null, 2)}\n`;
}

// Packs are unpinned until every mod carries a hash.  Building can legitimately
// leave them out (offline, or an author who has not published a stable asset),
// so this is a question a caller asks rather than a validation failure.
export function unpinned(pack) {
  return pack.mods.filter((m) => !m.source.sha256).map((m) => m.id);
}

export { Invalid };
