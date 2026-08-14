// Build pokepack as one file somebody can be handed.
//
//     npm install          (esbuild and postject, build-time only)
//     npm run build:exe
//
// Nothing pokepack *runs* needs a dependency; these two are here to package it,
// and a checkout keeps working with neither installed.
//
// Node's own single-executable support does the work: a script is turned into a
// blob, and the blob is injected into a copy of node itself.  Three things had
// to give way for that to be possible, all of them recorded here because they
// look arbitrary otherwise:
//
//   1. the blob's entry must be CommonJS, so the ES modules are bundled first
//   2. CommonJS has no top-level await, which is why bin/pokepack.js ends in
//      main() rather than awaiting at the top
//   3. import.meta.url does not survive the bundle, so anything that used it to
//      find its own files asks src/packaged.js instead
//
// The result is around 90MB, nearly all of it the Node runtime. That is the
// price of "no install step"; a zip of it travels at roughly a third of that.

import { execFileSync } from 'node:child_process';
import {
  copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync, statSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const WIN = process.platform === 'win32';
const NAME = WIN ? 'pokepack.exe' : 'pokepack';

// Node's own fuse string.  Not a secret and not ours to choose -- postject
// looks for exactly this sentinel inside the binary.
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', windowsHide: true, ...opts });
}

// postject's bin is a plain .js file on every platform, so running it under the
// Node we are already in is portable.  Deliberately not the node_modules/.bin
// shim: on Windows that is a .cmd, and Node has refused to execFile a .cmd
// since the argument-injection fix in 20.x -- it comes back EINVAL.
//
// esbuild does NOT get the same treatment, and the difference cost a release.
// Its bin/esbuild is a JS shim on Windows and the native executable itself on
// Linux and macOS, so `node bin/esbuild` works on one platform and dies with
// "SyntaxError: Invalid or unexpected token" on the other two, having tried to
// parse an ELF header as JavaScript.  Its JS API has no such seam, so the
// bundle step calls that instead of spawning anything.
function tool(name) {
  const pkg = join(ROOT, 'node_modules', name, 'package.json');
  if (!existsSync(pkg)) {
    throw new Error(`${name} is not installed -- run "npm install" first (it is a build-only dependency)`);
  }
  const entry = JSON.parse(readFileSync(pkg, 'utf8')).bin;
  return join(ROOT, 'node_modules', name, typeof entry === 'string' ? entry : entry[name]);
}

function runTool(name, args, opts = {}) {
  return run(process.execPath, [tool(name), ...args], opts);
}

async function loadEsbuild() {
  try {
    return await import('esbuild');
  } catch {
    throw new Error('esbuild is not installed -- run "npm install" first (it is a build-only dependency)');
  }
}

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
const say = (s) => process.stdout.write(`${s}\n`);

const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
mkdirSync(DIST, { recursive: true });

// ------- 1. one CommonJS file

const bundle = join(DIST, 'pokepack.bundle.cjs');
const esbuild = await loadEsbuild();
esbuild.buildSync({
  entryPoints: [join(ROOT, 'bin', 'pokepack.js')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: `node${process.versions.node.split('.')[0]}`,
  outfile: bundle,
  define: {
    // What tells the running program it is the exe rather than a checkout.
    'globalThis.__POKEPACK_EXE__': 'true',
    'globalThis.__POKEPACK_VERSION__': JSON.stringify(version),
  },
  // src/update.js still reads import.meta.url on the checkout path, which the
  // packaged build never reaches -- see repoRoot().
  logOverride: { 'empty-import-meta': 'silent' },
});
say(`bundled  ${mb(statSync(bundle).size)}`);

// ------- 2. blob

const config = join(DIST, 'sea-config.json');
const blob = join(DIST, 'pokepack.blob');
writeFileSync(config, JSON.stringify({
  main: bundle,
  output: blob,
  disableExperimentalSEAWarning: true,
  useCodeCache: true,
}, null, 2));
run(process.execPath, ['--experimental-sea-config', config], { stdio: 'ignore' });
say(`blob     ${mb(statSync(blob).size)}`);

// ------- 3. a copy of node, with the blob inside it

const out = join(DIST, NAME);
copyFileSync(process.execPath, out);

// The shipped node.exe is Authenticode-signed, and injecting into it leaves a
// signature that no longer matches -- which Windows treats more harshly than no
// signature at all.  Strip it first where the tooling exists; carry on where it
// does not, because an unsigned build is the goal either way.
if (WIN) {
  try {
    run('signtool', ['remove', '/s', out], { stdio: 'ignore' });
    say('stripped the inherited signature');
  } catch {
    say('signtool not available -- the binary keeps a signature that will not verify');
  }
}

runTool('postject', [out, 'NODE_SEA_BLOB', blob, '--sentinel-fuse', FUSE], { stdio: 'ignore' });

// ------- 4. prove it runs

const printed = run(out, ['--version'], { cwd: DIST }).trim();
if (printed !== version) {
  throw new Error(`the built ${NAME} reports "${printed}", not ${version}`);
}

say('');
say(`${out}  ${mb(statSync(out).size)}`);
say(`reports version ${printed}, and needs no Node installed`);
