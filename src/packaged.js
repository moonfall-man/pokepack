// Am I a checkout, or am I the exe?
//
// Three things change when pokepack is a single file somebody was handed:
//
//   - there is no package.json to read a version out of, so the version has to
//     be baked in at build time
//   - there is no git checkout, so "update" cannot mean `git pull` -- it means
//     "download the new one"
//   - "packs" cannot mean a folder relative to the working directory, because
//     an exe gets double-clicked and the working directory is wherever Explorer
//     felt like.  Beside the exe is the answer somebody can actually predict.
//
// Both flags are injected by build/exe.mjs through esbuild's --define, which is
// why they are read off globalThis rather than imported: reading a property
// that was never defined is undefined, while importing a module that is not
// there is a crash.  In a checkout nothing defines them and every answer here
// falls back to the checkout behaviour.
//
// node:sea would answer isPackaged() more directly, but it does not exist on
// Node 18, which package.json still promises, and a require() of it would need
// import.meta -- which is exactly the thing that does not survive the bundle.

import { dirname, join } from 'node:path';

export function isPackaged() {
  return globalThis.__POKEPACK_EXE__ === true;
}

// The version the exe was built from.  null in a checkout, where package.json
// is the better answer and is right there.
export function packagedVersion() {
  const v = globalThis.__POKEPACK_VERSION__;
  return typeof v === 'string' && v !== '' ? v : null;
}

// Where a packaged build keeps the things it makes: packs, launchers, android
// zips.  Beside the exe, so moving the exe moves everything with it and two
// copies on one machine do not share a folder.
export function homeDir() {
  return isPackaged() ? dirname(process.execPath) : process.cwd();
}

export function defaultPacksDir() {
  return isPackaged() ? join(homeDir(), 'packs') : 'packs';
}

// What to tell somebody who asked to update.  A checkout can pull; an exe can
// only be replaced, and saying so beats a button that cannot work.
export const UPDATE_BY_HAND =
  'this is the packaged pokepack -- download the new one from the releases page';
