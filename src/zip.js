// A small ZIP reader, so the tool stays dependency-free.
//
// Only what a mod archive needs: stored and deflated entries, read from the
// central directory.  No zip64 (a mod zip is tens of megabytes, not gigabytes),
// no encryption, no spanning.

import { inflateRawSync } from 'node:zlib';

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
