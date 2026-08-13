// A small ZIP reader and writer, so the tool stays dependency-free.
//
// Only what a mod archive needs: stored and deflated entries, read from the
// central directory.  No zip64 (a mod zip is tens of megabytes, not gigabytes),
// no encryption, no spanning.

import { inflateRawSync, deflateRawSync } from 'node:zlib';

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

function findEocd(buf) {
  // The end-of-central-directory record sits at the very end unless there is a
  // trailing comment, which can be up to 64K.
  const min = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i;
  }
  return -1;
}

// A zip entry names its own path, and a malicious one can name "../../..".
// Refuse anything that escapes, plus absolute paths and drive letters.
export function safeEntryName(name) {
  if (name === '' || name.startsWith('/') || name.startsWith('\\')) return false;
  if (/^[A-Za-z]:/.test(name)) return false;
  return !name.split(/[/\\]/).includes('..');
}

/**
 * read(buffer) -> [{ name, isDirectory, data() }]
 *
 * data() inflates on demand, so listing an archive costs nothing.
 */
export function read(buf) {
  const eocd = findEocd(buf);
  if (eocd < 0) throw new Error('not a zip file (no end-of-central-directory record)');

  const count = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);
  const entries = [];

  for (let i = 0; i < count; i++) {
    if (ptr + 46 > buf.length || buf.readUInt32LE(ptr) !== CEN_SIG) {
      throw new Error('zip central directory is damaged');
    }
    const method = buf.readUInt16LE(ptr + 10);
    const compressedSize = buf.readUInt32LE(ptr + 20);
    const uncompressedSize = buf.readUInt32LE(ptr + 24);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOffset = buf.readUInt32LE(ptr + 42);
    const name = buf.toString('utf8', ptr + 46, ptr + 46 + nameLen);

    entries.push({
      name,
      isDirectory: name.endsWith('/') || name.endsWith('\\'),
      size: uncompressedSize,
      data() {
        if (buf.readUInt32LE(localOffset) !== LOC_SIG) {
          throw new Error(`zip entry ${name} has a damaged local header`);
        }
        // The local header repeats the name and extra fields, and its lengths
        // are the ones that locate the payload -- they can differ from the
        // central directory's.
        const ln = buf.readUInt16LE(localOffset + 26);
        const le = buf.readUInt16LE(localOffset + 28);
        const start = localOffset + 30 + ln + le;
        const raw = buf.subarray(start, start + compressedSize);
        if (method === 0) return Buffer.from(raw);
        if (method === 8) return inflateRawSync(raw);
        throw new Error(`zip entry ${name} uses unsupported compression method ${method}`);
      },
    });

    ptr += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

// ------- writing

// CRC-32, spelled out rather than taken from zlib.crc32: that was added in Node
// 22.2 and package.json promises to run on 18.
let CRC_TABLE = null;
function crcTable() {
  if (CRC_TABLE) return CRC_TABLE;
  CRC_TABLE = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    CRC_TABLE[n] = c;
  }
  return CRC_TABLE;
}

export function crc32(buf) {
  const t = crcTable();
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

// Every entry is stamped 1980-01-01, the earliest a DOS timestamp can express.
//
// The alternative is the clock, and the clock would mean zipping the same pack
// twice produced two different files.  In a tool whose whole argument is "the
// same bytes every time", an archive you cannot compare against the last one is
// a poor thing to hand somebody.  Extractors show the odd date and do not care.
const DOS_TIME = 0;
const DOS_DATE = 33; // (1980-1980) << 9 | 1 << 5 | 1
const FLAG_UTF8 = 0x0800;

/**
 * write([{ name, data }]) -> Buffer
 *
 * Entries are written in the order given.  Directory entries are not emitted;
 * every extractor in practice creates parents from the paths, and leaving them
 * out means there is one fewer thing that can disagree with itself.
 *
 * Deflate is used only when it actually wins, so already-compressed payloads
 * (png, ogg, another zip) are stored rather than grown.
 */
export function write(files) {
  if (files.length > 0xffff) {
    throw new Error(`${files.length} entries needs zip64, which this writer does not do`);
  }

  const parts = [];
  const central = [];
  let offset = 0;

  for (const f of files) {
    const name = Buffer.from(f.name.replace(/\\/g, '/'), 'utf8');
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data);
    if (data.length > 0xffffffff) throw new Error(`${f.name} is too big for a plain zip`);

    const crc = crc32(data);
    const squeezed = deflateRawSync(data, { level: 9 });
    const deflated = squeezed.length < data.length;
    const body = deflated ? squeezed : data;
    const method = deflated ? 8 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOC_SIG, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(FLAG_UTF8, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, name, body);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(CEN_SIG, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(FLAG_UTF8, 8);
    cen.writeUInt16LE(method, 10);
    cen.writeUInt16LE(DOS_TIME, 12);
    cen.writeUInt16LE(DOS_DATE, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(body.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, name);

    offset += local.length + name.length + body.length;
  }

  const dir = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIG, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(dir.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...parts, dir, eocd]);
}

// Where does the mod actually start?  Authors zip either the mod folder's
// contents or the folder itself, so manifest.json turns up at the root or one
// level down.  Mirrors LauncherMods.locateRoot.
export function locateRoot(entries) {
  const names = entries.filter((e) => !e.isDirectory).map((e) => e.name.replace(/\\/g, '/'));
  if (names.includes('manifest.json')) return '';

  const candidates = new Set();
  for (const name of names) {
    const m = /^([^/]+)\/manifest\.json$/.exec(name);
    if (m) candidates.add(m[1]);
  }
  if (candidates.size === 1) return `${[...candidates][0]}/`;
  if (candidates.size > 1) {
    return { error: `the zip holds ${candidates.size} mods; install them one at a time` };
  }
  return { error: 'the zip has no manifest.json' };
}
