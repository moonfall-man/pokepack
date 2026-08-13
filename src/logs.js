// What the game said, for the pack you are on.
//
// Three sources, because a crash lands in different places depending on how far
// down it happened:
//
//   pokepack-run.log   everything the game printed to stdout -- the mod loader's
//                      warnings, which mods loaded, and whatever it managed to
//                      say on the way down.  Written by us at launch.
//   lua-error.log      the engine's own record of a Lua error, written by its
//                      love.errorhandler.  Present only for errors Lua could
//                      catch: a graphics or driver fault dies below that and
//                      leaves nothing here, which is why the run log matters.
//   switch.log         the engine's buffered diagnostics, only written when a
//                      debug marker file is present.  Usually absent.
//
// Read from the end.  These grow without bound and the interesting part is
// always the last thing that happened.

import { readFileSync, existsSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { RUN_LOG, RUN_LOG_PREV } from './instance.js';

export const SOURCES = [
  { file: RUN_LOG, label: 'this run', kind: 'run' },
  { file: RUN_LOG_PREV, label: 'the run before', kind: 'run' },
  { file: 'lua-error.log', label: 'Lua errors', kind: 'error' },
  { file: 'lua-error.log.1', label: 'older Lua errors', kind: 'error' },
  { file: 'switch.log', label: 'engine diagnostics', kind: 'diag' },
];

const DEFAULT_TAIL = 64 * 1024;

/**
 * tail(path, bytes) -> string
 *
 * Reads the last chunk rather than the whole file: a long session can print
 * megabytes, and loading all of it to show the last twenty lines would stall
 * the hub for no benefit.
 */
export function tail(path, bytes = DEFAULT_TAIL) {
  const size = statSync(path).size;
  if (size <= bytes) return readFileSync(path, 'utf8');

  const fd = openSync(path, 'r');
  try {
    const buf = Buffer.alloc(bytes);
    readSync(fd, buf, 0, bytes, size - bytes);
    const text = buf.toString('utf8');
    // Drop the first line: starting mid-line reads as corruption.
    const nl = text.indexOf('\n');
    return (nl === -1 ? text : text.slice(nl + 1));
  } finally {
    closeSync(fd);
  }
}

/**
 * readLogs(saveDir, { bytes }) -> { sources, any }
 *
 * Every log this pack has, newest content last.  A missing file is simply
 * absent rather than an error -- most packs have never crashed.
 */
export function readLogs(saveDir, { bytes = DEFAULT_TAIL } = {}) {
  const sources = [];
  if (!saveDir) return { sources, any: false };

  for (const src of SOURCES) {
    const path = join(saveDir, src.file);
    if (!existsSync(path)) continue;
    let text = '';
    let size = 0;
    let modified = null;
    try {
      const st = statSync(path);
      size = st.size;
      modified = st.mtime.toISOString();
      text = tail(path, bytes);
    } catch (e) {
      text = `could not read this log: ${e.message}`;
    }
    sources.push({
      ...src, path, size, modified, text, truncated: size > bytes,
    });
  }

  return { sources, any: sources.length > 0 };
}

/**
 * interesting(text) -> [{ line, level }]
 *
 * The lines worth putting in front of somebody.  The engine tags its own output
 * with [warn] and [error]; a stack trace and a "no such" complaint are worth
 * catching too, since a mod that fails to load says so in prose.
 */
export function interesting(text) {
  const out = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    let level = null;
    if (/^\[error\]/i.test(trimmed) || /\btraceback\b/i.test(trimmed)) level = 'error';
    else if (/^\[warn\]/i.test(trimmed)) level = 'warn';
    else if (/\b(ignored|failed|missing dependency|conflicts with|could not)\b/i.test(trimmed)) {
      level = 'warn';
    }
    if (level) out.push({ line: trimmed, level });
  }
  return out;
}
