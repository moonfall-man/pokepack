// Offline test suite.  Nothing here touches the network; the one module that
// does is handed a fake.

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parse, toArray } from '../src/luadata.js';
import * as write from '../src/luawrite.js';
import * as zip from '../src/zip.js';
import { installMod, writeProfile } from '../src/install.js';
import { buildFeed, submitUrl, pagesBase } from '../src/feed.js';
import * as votes from '../src/votes.js';
import * as catalogue from '../src/catalogue.js';
import * as deps from '../src/deps.js';
import * as gh from '../src/github.js';
import * as net from '../src/net.js';
import * as update from '../src/update.js';
import * as logs from '../src/logs.js';
import * as packfeed from '../src/packfeed.js';
import { applyToOptions, setModEnabled } from '../src/liveapply.js';
import { uninstall, planUninstall } from '../src/uninstall.js';
import { identifyRom, linkRom, baseromsIn } from '../src/rom.js';
import { checkSaveDir, cleanPath, saveRoots } from '../src/discover.js';
import {
  validIdentity, createInstance, writeLauncher, identityFor, launchGame,
  romVersionsIn, seedRomData, describeInstance, trashInstance, TRASH_DIR, VERSIONS,
} from '../src/instance.js';
import * as pack from '../src/packformat.js';
import { readSaveDir, releasesFromCache, indexFromFeeds } from '../src/state.js';
import { build } from '../src/build.js';
import { resolve, compareVersions, OK, INSTALL, RECONCILE, UNAVAILABLE, BLOCKED } from '../src/resolve.js';
import { validatePack, LIVE, CHANGED, BROKEN } from '../src/validate.js';
import { page } from '../src/ui-page.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, '..', 'fixtures');
const SAVE = join(FIXTURES, 'save');

let passed = 0;
const failures = [];
let group = '';

function describe(name) { group = name; }

function it(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failures.push({ name: `${group}: ${name}`, error: e });
  }
}

async function itAsync(name, fn) {
  try {
    await fn();
    passed++;
  } catch (e) {
    failures.push({ name: `${group}: ${name}`, error: e });
  }
}

function eq(actual, expected, msg = '') {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg}\n  expected: ${b}\n  actual:   ${a}`);
}

function ok(cond, msg) {
  if (!cond) throw new Error(msg || 'expected truthy');
}

function throws(fn, match, msg) {
  try {
    fn();
  } catch (e) {
    if (match && !String(e.message).includes(match)) {
      throw new Error(`${msg ?? ''}\n  expected error containing ${JSON.stringify(match)}\n  got: ${e.message}`);
    }
    return;
  }
  throw new Error(msg || `expected a throw${match ? ` containing ${JSON.stringify(match)}` : ''}`);
}

// ------- luadata

describe('luadata');

const optionsText = readFileSync(join(SAVE, 'options.lua'), 'utf8');
const options = parse(optionsText);

it('reads the fixture options.lua', () => {
  eq(options.activeProfile, 'KANTO 3D');
  eq(options.fpsCap, 60);
  eq(options.animations, true);
});

it('reads 1-based table arrays in order', () => {
  const profiles = toArray(options.modProfiles);
  eq(profiles.length, 1);
  eq(profiles[0].name, 'KANTO 3D');
});

it('keeps false apart from missing in the enable map', () => {
  const p = toArray(options.modProfiles)[0];
  eq(p.enabled.DRAMATIC_SHAPE, false);
  eq(p.enabled.BATTLE_ART_VOXEL_FORK, true);
  eq(p.enabled.NOT_A_MOD, undefined);
});

it('decodes %q escapes, including continuations and quotes', () => {
  const releases = toArray(options.modUpdateCache['absol89/DramaticShapeVoxelMod'].releases);
  const body = releases[0].body;
  ok(body.includes('"quoted"'), 'escaped quotes should survive');
  ok(body.includes('\r'), '\\13 should decode to a carriage return');
  ok(body.includes('\nSecond line'), 'backslash-newline should decode to a newline');
});

it('reads bracketed string keys', () => {
  ok(options.modUpdateCache['absol89/DramaticShapeVoxelMod'], 'bracketed key should be read');
});

it('refuses anything that is not the restricted grammar', () => {
  throws(() => parse('return os.exit()'), 'unexpected character', 'must not accept a call');
  throws(() => parse('return { x = 1 } print("hi")'), 'trailing content');
  throws(() => parse('return {'), 'unterminated table');
  throws(() => parse('return "unterminated'), 'unterminated string');
  throws(() => parse(`return ${'{a='.repeat(200)}1${'}'.repeat(200)}`), 'nested too deep');
});

it('reads real save files when they are around', () => {
  const real = join(HERE, '..', '..', 'pokemon-profile-backup');
  if (!existsSync(real)) return; // not everyone has these; not a failure
  for (const p of ['gen1recomp-p1', 'gen1recomp-p2', 'pokemon-love2d']) {
    const file = join(real, p, 'options.lua');
    if (!existsSync(file)) continue;
    const doc = parse(readFileSync(file, 'utf8'));
    ok(typeof doc === 'object' && doc !== null, `${p}/options.lua should parse to a table`);
  }
});

// ------- state

describe('state');

const state = readSaveDir(SAVE);

it('finds installed mods and their versions', () => {
  eq(Object.keys(state.mods).sort(), ['BATTLE_ART_VOXEL_FORK', 'DRAMATIC_SHAPE', 'GHOST_LINK']);
  eq(state.mods.BATTLE_ART_VOXEL_FORK.version, '1.7.1');
});

it('treats a mod missing from options.mods as enabled', () => {
  eq(state.mods.GHOST_LINK.enabled, true);
  eq(state.mods.DRAMATIC_SHAPE.enabled, false);
});

it('has no hash for installed mods without a lock sidecar', () => {
  eq(state.mods.BATTLE_ART_VOXEL_FORK.sha256, null);
});

it('pulls cached releases out by repo', () => {
  const releases = releasesFromCache(state);
  eq(releases.get('absol89/DramaticShapeVoxelMod').length, 2);
});

// ------- build

describe('build');

const index = indexFromFeeds([JSON.parse(readFileSync(join(FIXTURES, 'index-test.json'), 'utf8'))]);
const profile = state.profiles[0];
const built = build(profile, {
  state, index, releasesByRepo: releasesFromCache(state),
  meta: { id: 'kanto-3d', name: 'KANTO 3D', author: 'moonfall-man' },
});

it('packs only the mods the profile switched on', () => {
  eq(built.pack.mods.map((m) => m.id), ['BATTLE_ART_VOXEL_FORK', 'GHOST_LINK']);
});

it('pins the installed version, not the newest one', () => {
  const voxel = built.pack.mods.find((m) => m.id === 'BATTLE_ART_VOXEL_FORK');
  eq(voxel.version, '1.7.1', 'the point of a pack is the version that was tested');
  ok(voxel.source.url.includes('/1.7.1/'), `expected the 1.7.1 asset, got ${voxel.source.url}`);
});

it('matches a release by asset name when the tag differs from the version', () => {
  const ghost = built.pack.mods.find((m) => m.id === 'GHOST_LINK');
  ok(ghost, 'GHOST_LINK 0.1.0 lives in release v0.3.1 and should still resolve');
  ok(ghost.source.url.includes('GHOST_LINK-0.1.0.zip'), ghost.source.url);
});

it("takes the profile's settings over the machine's current ones", () => {
  const voxel = built.pack.mods.find((m) => m.id === 'BATTLE_ART_VOXEL_FORK');
  eq(voxel.options.water, 'full', 'profile said full; live modOptions say sky');
});

it('lists a conflicting installed mod under disable', () => {
  eq(built.pack.disable, ['DRAMATIC_SHAPE']);
});

it('carries save slots through', () => {
  eq(built.pack.slots, { red: 'slot1' });
});

it('comes out unpinned until hashes are fetched', () => {
  eq(pack.unpinned(built.pack), ['BATTLE_ART_VOXEL_FORK', 'GHOST_LINK']);
});

it('refuses a profile with nothing switched on', () => {
  throws(() => build({ name: 'EMPTY', enabled: { A: false } }, { state, index }), 'nothing to pack');
});

// ------- packformat

describe('packformat');

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

const valid = {
  format: 'pokepack', formatVersion: 1, id: 'test-pack', name: 'TEST',
  mods: [{ id: 'A', version: '1.0.0', source: { url: 'https://example.com/a.zip', sha256: HASH_A } }],
};

it('round-trips a valid pack', () => {
  eq(pack.decode(pack.encode(valid)).id, 'test-pack');
});

it('defaults strict to true', () => {
  eq(pack.validate(valid).strict, true);
});

it('refuses a future format version outright', () => {
  throws(() => pack.validate({ ...valid, formatVersion: 2 }), 'not supported');
});

it('refuses plain http sources', () => {
  throws(
    () => pack.validate({ ...valid, mods: [{ id: 'A', source: { url: 'http://example.com/a.zip' } }] }),
    'must be https',
  );
});

it('refuses a malformed hash', () => {
  throws(
    () => pack.validate({ ...valid, mods: [{ id: 'A', source: { url: 'https://e.com/a.zip', sha256: 'nope' } }] }),
    '64 lowercase hex',
  );
});

it('refuses non-scalar settings', () => {
  throws(
    () => pack.validate({
      ...valid,
      mods: [{ id: 'A', source: { url: 'https://e.com/a.zip' }, options: { k: { nested: 1 } } }],
    }),
    'must be a string, number or boolean',
  );
});

it('refuses a thumbnail that is not https', () => {
  throws(() => pack.validate({ ...valid, thumbnail: 'http://e.com/a.png' }), 'must be https');
  throws(() => pack.validate({ ...valid, thumbnail: 'not a url' }), 'not a URL');
  eq(pack.validate({ ...valid, thumbnail: 'https://e.com/a.png' }).thumbnail, 'https://e.com/a.png');
  eq(pack.validate(valid).thumbnail, null);
});

it('refuses a mod that is both installed and disabled', () => {
  throws(() => pack.validate({ ...valid, disable: ['A'] }), 'both installed and disabled');
});

it('refuses a duplicate mod', () => {
  throws(() => pack.validate({ ...valid, mods: [...valid.mods, ...valid.mods] }), 'listed twice');
});

it('refuses an empty pack', () => {
  throws(() => pack.validate({ ...valid, mods: [] }), 'at least one mod');
});

// ------- resolve

describe('resolve');

const twoMods = pack.validate({
  ...valid,
  mods: [
    { id: 'BATTLE_ART_VOXEL_FORK', version: '1.7.6', source: { url: 'https://e.com/v176.zip', sha256: HASH_A } },
    { id: 'GHOST_LINK', version: '0.1.0', source: { url: 'https://e.com/g.zip', sha256: HASH_B } },
  ],
  disable: ['DRAMATIC_SHAPE'],
});

it('calls an absent mod an install', () => {
  const p = resolve(twoMods, { mods: {} });
  eq(p.summary.install, 2);
  eq(p.mods[0].status, INSTALL);
});

it('spots an upgrade and names the direction', () => {
  const p = resolve(twoMods, { mods: { BATTLE_ART_VOXEL_FORK: { version: '1.7.1', enabled: true } } });
  const row = p.mods.find((m) => m.id === 'BATTLE_ART_VOXEL_FORK');
  eq(row.status, RECONCILE);
  eq(row.direction, 'upgrade');
});

it('spots a downgrade, because matching a pack can mean going backwards', () => {
  const p = resolve(twoMods, { mods: { BATTLE_ART_VOXEL_FORK: { version: '1.8.0', enabled: true } } });
  const row = p.mods.find((m) => m.id === 'BATTLE_ART_VOXEL_FORK');
  eq(row.status, RECONCILE);
  eq(row.direction, 'downgrade');
});

it('catches a re-upload: same version number, different bytes', () => {
  const p = resolve(twoMods, {
    mods: { BATTLE_ART_VOXEL_FORK: { version: '1.7.6', sha256: HASH_B, enabled: true } },
  });
  const row = p.mods.find((m) => m.id === 'BATTLE_ART_VOXEL_FORK');
  eq(row.status, RECONCILE, 'a version string is a claim; the hash is the fact');
  ok(row.reason.includes('different bytes'), row.reason);
});

it('is satisfied when the hash matches', () => {
  const p = resolve(twoMods, {
    mods: { BATTLE_ART_VOXEL_FORK: { version: '1.7.6', sha256: HASH_A, enabled: true } },
  });
  eq(p.mods.find((m) => m.id === 'BATTLE_ART_VOXEL_FORK').status, OK);
});

it('cascades: a mod whose dependency is unavailable is blocked, not downloaded', () => {
  const withDep = pack.validate({
    ...valid,
    mods: [
      { id: 'KANTO_FIRST_PERSON', version: '0.4.0', source: { url: 'https://e.com/k.zip' } },
      { id: 'BATTLE_ART_VOXEL_FORK', version: '1.7.6', source: { url: 'https://e.com/v176.zip' } },
    ],
  });
  const p = resolve(withDep, { mods: {} }, index, { broken: ['BATTLE_ART_VOXEL_FORK'] });
  eq(p.mods.find((m) => m.id === 'BATTLE_ART_VOXEL_FORK').status, UNAVAILABLE);
  const blocked = p.mods.find((m) => m.id === 'KANTO_FIRST_PERSON');
  eq(blocked.status, BLOCKED);
  eq(blocked.blockedBy, 'BATTLE_ART_VOXEL_FORK');
});

it('blocks a mod whose dependency is neither packed nor installed', () => {
  const orphan = pack.validate({
    ...valid,
    mods: [{ id: 'KANTO_FIRST_PERSON', version: '0.4.0', source: { url: 'https://e.com/k.zip' } }],
  });
  const p = resolve(orphan, { mods: {} }, index);
  eq(p.mods[0].status, BLOCKED);
});

it('will not activate a strict pack that did not fully resolve', () => {
  const withDep = pack.validate({
    ...valid,
    mods: [{ id: 'KANTO_FIRST_PERSON', version: '0.4.0', source: { url: 'https://e.com/k.zip' } }],
  });
  eq(resolve(withDep, { mods: {} }, index).canActivate, false);
  const loose = pack.validate({ ...withDep, strict: false });
  eq(resolve(loose, { mods: {} }, index).canActivate, true);
});

it('flags an enabled installed mod that conflicts and is not disabled', () => {
  const noDisable = pack.validate({ ...twoMods, disable: [] });
  const p = resolve(noDisable, {
    mods: { DRAMATIC_SHAPE: { version: '1.6.2', enabled: true } },
  }, index);
  eq(p.conflicts.length, 1);
  eq(p.conflicts[0].kind, 'installed');
});

it('says nothing about a conflict the pack already turns off', () => {
  const p = resolve(twoMods, {
    mods: { DRAMATIC_SHAPE: { version: '1.6.2', enabled: true } },
  }, index);
  eq(p.conflicts, []);
  eq(p.disable.find((d) => d.id === 'DRAMATIC_SHAPE').status, 'turn-off');
});

it('admits when it could not run the cascade', () => {
  eq(resolve(twoMods, { mods: {} }).cascadeChecked, false);
  eq(resolve(twoMods, { mods: {} }, index).cascadeChecked, true);
});

it('orders versions sensibly', () => {
  ok(compareVersions('1.7.1', '1.7.6') < 0);
  ok(compareVersions('1.10.0', '1.9.0') > 0, 'numeric, not lexical');
  ok(compareVersions('1.7.6', '1.7.6') === 0);
});

// ------- validate

describe('validate');

const fakeNet = (responses) => ({
  checkUrl: async (url) => responses[url]?.check ?? { ok: true, status: 200, size: null },
  hashUrl: async (url) => responses[url]?.hash ?? { sha256: HASH_A, size: 1 },
});

await itAsync('reports a pack whose links all resolve as live', async () => {
  const report = await validatePack(twoMods, { deps: fakeNet({}) });
  eq(report.status, LIVE);
  eq(report.counts.broken, 0);
});

await itAsync('reports a dead link as broken', async () => {
  const report = await validatePack(twoMods, {
    deps: fakeNet({ 'https://e.com/v176.zip': { check: { ok: false, status: 404, reason: '404 Not Found' } } }),
  });
  eq(report.status, BROKEN);
  eq(report.mods.find((m) => m.id === 'BATTLE_ART_VOXEL_FORK').status, BROKEN);
});

await itAsync('notices a size that moved without downloading', async () => {
  const sized = pack.validate({
    ...twoMods,
    mods: [{ id: 'A', version: '1', source: { url: 'https://e.com/a.zip', sha256: HASH_A, size: 100 } }],
    disable: [],
  });
  const report = await validatePack(sized, {
    deps: fakeNet({ 'https://e.com/a.zip': { check: { ok: true, status: 200, size: 999 } } }),
  });
  eq(report.status, CHANGED);
});

await itAsync('catches a re-upload only on a deep check', async () => {
  const shallow = await validatePack(twoMods, {
    deps: fakeNet({ 'https://e.com/v176.zip': { hash: { sha256: 'f'.repeat(64), size: 1 } } }),
  });
  eq(shallow.status, LIVE, 'a link check cannot see contents');

  const deep = await validatePack(twoMods, {
    deep: true,
    deps: fakeNet({ 'https://e.com/v176.zip': { hash: { sha256: 'f'.repeat(64), size: 1 } } }),
  });
  eq(deep.status, CHANGED);
});

// ------- luawrite

describe('luawrite');

it('re-encodes a parsed table back to the same text', () => {
  const round = write.encode(parse(optionsText), { numericKeys: true });
  eq(round, optionsText, 'the writer must be byte-compatible with the engine');
});

it('matches the engine byte for byte on real save files', () => {
  const appdata = process.env.APPDATA;
  if (!appdata) return;
  let checked = 0;
  for (const p of ['gen1recomp-p1', 'gen1recomp-p2']) {
    const f = join(appdata, 'LOVE', p, 'options.lua');
    if (!existsSync(f)) continue;
    const orig = readFileSync(f, 'utf8');
    eq(write.encode(parse(orig), { numericKeys: true }), orig, `${p}/options.lua`);
    checked++;
  }
  ok(checked >= 0, 'nothing to check is fine');
});

it('writes control characters the way LuaJIT does', () => {
  // \r is \13, not \r -- and pads to three digits before a digit so the escape
  // cannot swallow the next character.
  eq(write.encode('a\rb'), 'return "a\\13b"\n');
  eq(write.encode('a\r1'), 'return "a\\0131"\n');
});

it('sorts numeric keys before string keys', () => {
  const out = write.encode({ 1: 'a', zebra: 'z', 2: 'b' }, { numericKeys: true });
  ok(out.indexOf('[1]') < out.indexOf('[2]'), 'numeric keys ascend');
  ok(out.indexOf('[2]') < out.indexOf('zebra'), 'numbers come before strings');
});

it('produces the envelope ModProfile.decode expects', () => {
  const text = write.encodeModList({ name: 'KANTO 3D', enabled: { A: true }, options: {}, slots: {} });
  const back = parse(text);
  eq(back.format, 'g1rmodlist');
  eq(back.formatVersion, 1);
  eq(back.profile.name, 'KANTO 3D');
  eq(back.profile.enabled.A, true);
});

it('clamps a profile name to ten characters, like the engine', () => {
  eq(parse(write.encodeModList({ name: 'A_VERY_LONG_NAME' })).profile.name, 'A_VERY_LON');
});

it('scrubs a filename so a shared name cannot escape the folder', () => {
  eq(write.fileNameFor('../../etc/passwd'), '______ETC_PASSWD.g1rmodlist');
  eq(write.fileNameFor('kanto 3d'), 'KANTO_3D.g1rmodlist');
  for (const bad of ['../x', 'a/b', 'a\\b', 'a.b']) {
    ok(!/[./\\]/.test(write.fileNameFor(bad).replace('.g1rmodlist', '')),
      `${bad} should have no path characters left`);
  }
});

// ------- zip

describe('zip');

const REAL_ZIP = join(HERE, '..', '..', 'pokemon', 'dist', 'COUCH_MULTIPLAYER-0.3.1.zip');
const haveZip = existsSync(REAL_ZIP);

it('reads a real mod archive', () => {
  if (!haveZip) return;
  const entries = zip.read(readFileSync(REAL_ZIP));
  ok(entries.length > 0, 'should find entries');
  eq(zip.locateRoot(entries), 'COUCH_MULTIPLAYER/');
  const manifest = entries.find((e) => e.name === 'COUCH_MULTIPLAYER/manifest.json');
  eq(JSON.parse(manifest.data().toString('utf8')).id, 'COUCH_MULTIPLAYER');
});

it('rejects a path that escapes the mod folder', () => {
  eq(zip.safeEntryName('assets/a.png'), true);
  eq(zip.safeEntryName('../../evil'), false);
  eq(zip.safeEntryName('/etc/passwd'), false);
  eq(zip.safeEntryName('C:\\windows\\evil'), false);
  eq(zip.safeEntryName('a/../../b'), false);
});

it('refuses something that is not a zip', () => {
  throws(() => zip.read(Buffer.from('not a zip at all')), 'not a zip file');
});

// ------- install

describe('install');

const TMP = join(HERE, '..', '.test-tmp');

it('installs a real mod and records its hash', () => {
  if (!haveZip) return;
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  const buf = readFileSync(REAL_ZIP);
  const r = installMod(buf, { saveDir: TMP, expectId: 'COUCH_MULTIPLAYER', sha256: HASH_A });
  eq(r.id, 'COUCH_MULTIPLAYER');
  eq(r.version, '0.3.1');
  ok(existsSync(join(TMP, 'mods', 'COUCH_MULTIPLAYER', 'manifest.json')));
  const lock = JSON.parse(readFileSync(join(TMP, 'pokepack-installed.json'), 'utf8'));
  eq(lock.mods.COUCH_MULTIPLAYER.sha256, HASH_A);
});

it('refuses a zip that is not the mod being installed', () => {
  if (!haveZip) return;
  throws(
    () => installMod(readFileSync(REAL_ZIP), { saveDir: TMP, expectId: 'SOMETHING_ELSE' }),
    "expected 'SOMETHING_ELSE'",
  );
});

it('will not overwrite an install without being told to', () => {
  if (!haveZip) return;
  throws(() => installMod(readFileSync(REAL_ZIP), { saveDir: TMP, expectId: 'COUCH_MULTIPLAYER' }),
    'already installed');
});

it('moves the old copy aside instead of deleting it', () => {
  if (!haveZip) return;
  const r = installMod(readFileSync(REAL_ZIP), {
    saveDir: TMP, expectId: 'COUCH_MULTIPLAYER', replace: true,
  });
  ok(r.backedUp, 'a replaced mod should be kept');
  ok(existsSync(join(r.backedUp, 'manifest.json')), 'the backup should be intact');
  rmSync(TMP, { recursive: true, force: true });
});

it('writes a profile naming only what actually got installed', () => {
  mkdirSync(TMP, { recursive: true });
  const p = pack.validate({
    ...valid,
    mods: [
      { id: 'A', version: '1', source: { url: 'https://e.com/a.zip', sha256: HASH_A } },
      { id: 'B', version: '1', source: { url: 'https://e.com/b.zip', sha256: HASH_B } },
    ],
    disable: ['C'],
  });
  const { path } = writeProfile(TMP, p, { installedIds: new Set(['A']) });
  const doc = parse(readFileSync(path, 'utf8'));
  eq(doc.profile.enabled.A, true);
  eq(doc.profile.enabled.B, undefined, 'B never installed, so it must not be switched on');
  eq(doc.profile.enabled.C, false);
  rmSync(TMP, { recursive: true, force: true });
});

// ------- discover

describe('discover');

it('accepts a real save folder', () => {
  const check = checkSaveDir(SAVE);
  eq(check.ok, true, check.reason);
  eq(check.profiles, ['KANTO 3D']);
  eq(check.mods, 3);
});

it('turns down folders that are not a game save, with a reason', () => {
  eq(checkSaveDir(join(HERE, '..', 'src')).ok, false);
  ok(checkSaveDir(join(HERE, '..', 'nope-not-here')).reason.startsWith('that folder does not exist'));
  eq(checkSaveDir(join(SAVE, 'options.lua')).reason, 'that is a file, not a folder');
  eq(checkSaveDir('').reason, 'no folder given');
});

it('recognises a folder by its mods dir even with no options.lua', () => {
  eq(checkSaveDir(join(FIXTURES, 'other-save')).ok, true);
});

// ------- instance

describe('instance');

it('survives a path pasted with quotes, which is what Windows copies', () => {
  // Explorer's "Copy as path" wraps in double quotes.  Treating those as part
  // of the filename reports a file that plainly exists as missing.
  eq(cleanPath('"C:\\games\\a.exe"'), 'C:\\games\\a.exe');
  eq(cleanPath("'C:\\games\\a.exe'"), 'C:\\games\\a.exe');
  eq(cleanPath('  C:\\games\\a.exe  '), 'C:\\games\\a.exe');
  eq(cleanPath('""C:\\games\\a.exe""'), 'C:\\games\\a.exe');
  eq(cleanPath('C:\\games\\a.exe'), 'C:\\games\\a.exe');
  eq(cleanPath(undefined), '');
});

it('looks in the fused save root first, where a shipped game actually writes', () => {
  // LOVE drops the LOVE/ folder for a fused build.  gen1recomp ships fused, so
  // <APPDATA>/<identity> is real and <APPDATA>/LOVE/<identity> is a folder the
  // game never reads -- a mod installed there is invisible, which is exactly
  // what happened.
  const roots = saveRoots();
  if (roots.length < 2) return; // only one of the two exists on this machine
  ok(!/[/\\](LOVE|love)$/.test(roots[0]), `fused root must come first, got ${roots[0]}`);
  ok(/[/\\](LOVE|love)$/.test(roots[1]), `unfused root should still be searched, got ${roots[1]}`);
});

it('does not mistake another game for a pack', () => {
  // The fused root is <APPDATA> itself, shared with everything else installed.
  // "has mods/ and saves/" describes Factorio, and claiming it would put mods
  // in somebody's Factorio install.
  const root = join(HERE, '..', '.test-tmp-neighbours');
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, 'mods'), { recursive: true });
  mkdirSync(join(root, 'saves'), { recursive: true });
  writeFileSync(join(root, 'mods', 'some-mod_1.2.3.zip'), 'not ours');
  eq(checkSaveDir(root).ok, false, 'mods/ and saves/ alone is not evidence');

  // Ours: a mod folder carrying our manifest shape.
  mkdirSync(join(root, 'mods', 'GHOST_LINK'), { recursive: true });
  writeFileSync(join(root, 'mods', 'GHOST_LINK', 'manifest.json'), '{"id":"GHOST_LINK"}');
  eq(checkSaveDir(root).ok, true, checkSaveDir(root).reason);

  rmSync(root, { recursive: true, force: true });
});

it('accepts a quoted save folder and stores it unquoted', () => {
  const check = checkSaveDir(`"${SAVE}"`);
  eq(check.ok, true, check.reason);
  eq(check.path, SAVE, 'the cleaned path is what gets remembered');
});

it('says which path it actually tried when it cannot find one', () => {
  const check = checkSaveDir('C:\\definitely\\not\\here');
  eq(check.ok, false);
  ok(check.reason.includes('C:\\definitely\\not\\here'), check.reason);
});

it('accepts sensible instance names and refuses the rest', () => {
  eq(validIdentity('kanto-3d').ok, true);
  eq(validIdentity('pack_2.1').ok, true);
  eq(validIdentity('has space').ok, false);
  eq(validIdentity('../escape').ok, false);
  eq(validIdentity('.hidden').ok, false);
  eq(validIdentity('').ok, false);
});

it("will not take over the game's own default instance", () => {
  const check = validIdentity('pokemon-love2d');
  eq(check.ok, false);
  ok(check.reason.includes('default instance'), check.reason);
});

it('works out the identity from a folder under LOVE\'s save root', () => {
  const roots = saveRoots();
  if (roots.length === 0) return;
  eq(identityFor(join(roots[0], 'kanto-3d')), 'kanto-3d');
});

it('refuses to guess an identity for a folder somewhere else', () => {
  // Setup lets you type any path, and a folder outside the save root simply
  // cannot be reached by setting POKEPORT_IDENTITY -- so say so rather than
  // launching the wrong instance.
  eq(identityFor(join(HERE, '..', 'fixtures', 'save')), null);
  eq(identityFor(null), null);
});

it('will not launch without a real game executable', () => {
  throws(() => launchGame({ exePath: 'C:\\nope\\missing.exe', identity: 'x' }), 'does not exist');
  throws(() => launchGame({ exePath: '', identity: 'x' }), 'no path given');
});

it('refuses a made-up game version rather than putting it in the environment', () => {
  throws(
    () => launchGame({ exePath: 'C:\\nope\\missing.exe', identity: 'x', version: 'gold' }),
    'does not exist',
  );
  eq(VERSIONS.includes('gold'), false, 'gold is not a gen 1 version');
  eq(VERSIONS, ['red', 'blue', 'yellow']);
});

it('writes a launcher that boots straight into the game', () => {
  // gen1recomp shows its own launcher screen unless POKEPORT_GAME is set --
  // the engine supports this exactly so a shortcut has no menu in between.
  const root = join(HERE, '..', '.test-tmp-launch');
  rmSync(root, { recursive: true, force: true });
  const { path } = writeLauncher({
    identity: 'kanto', exePath: 'C:\\games\\gen1recomp.exe', outDir: root, version: 'red',
  });
  const script = readFileSync(path, 'utf8');
  ok(script.includes('POKEPORT_IDENTITY=kanto'), 'still picks the instance');
  ok(script.includes('POKEPORT_GAME=red'), 'and skips the launcher screen');

  const plain = writeLauncher({ identity: 'kanto2', exePath: 'C:\\games\\gen1recomp.exe', outDir: root });
  ok(!readFileSync(plain.path, 'utf8').includes('POKEPORT_GAME'),
    'no version means the launcher, not a guess');

  throws(() => writeLauncher({
    identity: 'k', exePath: 'C:\\games\\gen1recomp.exe', outDir: root, version: 'crystal',
  }), 'not a game version');

  rmSync(root, { recursive: true, force: true });
});

it('spots which instances have unpacked ROM data', () => {
  const root = join(HERE, '..', '.test-tmp-rom');
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, 'red'), { recursive: true });
  eq(romVersionsIn(root), [], 'a folder without the marker does not count');
  writeFileSync(join(root, 'red', 'rom-cache.complete'), 'rom-cache-v9:abc');
  eq(romVersionsIn(root), ['red']);
  rmSync(root, { recursive: true, force: true });
});

it('copies ROM data between instances but never the saves', () => {
  const from = join(HERE, '..', '.test-tmp-from');
  const to = join(HERE, '..', '.test-tmp-to');
  for (const d of [from, to]) rmSync(d, { recursive: true, force: true });
  mkdirSync(join(from, 'red', 'data'), { recursive: true });
  mkdirSync(join(from, 'saves'), { recursive: true });
  writeFileSync(join(from, 'red', 'rom-cache.complete'), 'rom-cache-v9:abc');
  writeFileSync(join(from, 'red', 'data', 'x.bin'), 'unpacked');
  writeFileSync(join(from, 'saves', 'progress.sav'), 'someones playthrough');
  mkdirSync(to, { recursive: true });

  const r = seedRomData(from, to);
  eq(r.copied, ['red']);
  eq(readFileSync(join(to, 'red', 'data', 'x.bin'), 'utf8'), 'unpacked');
  ok(!existsSync(join(to, 'saves')), 'a new instance starting with someone else\'s progress is not a new instance');
  ok(existsSync(join(from, 'red', 'rom-cache.complete')), 'the source must be untouched');

  for (const d of [from, to]) rmSync(d, { recursive: true, force: true });
});

it('refuses to seed from an instance that has no ROM data', () => {
  const empty = join(HERE, '..', '.test-tmp-empty');
  rmSync(empty, { recursive: true, force: true });
  mkdirSync(empty, { recursive: true });
  throws(() => seedRomData(empty, empty), 'no unpacked ROM data');
  rmSync(empty, { recursive: true, force: true });
});

it('creates an instance and refuses to reuse an existing one', () => {
  const root = join(HERE, '..', '.test-tmp-love');
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });

  const made = createInstance({ identity: 'demo-pack', loveRoot: root });
  eq(made.identity, 'demo-pack');
  ok(existsSync(join(made.path, 'mods')), 'a new instance needs a mods folder');

  // The second call must fail: an existing instance holds somebody's saves.
  throws(() => createInstance({ identity: 'demo-pack', loveRoot: root }), 'already exists');

  const { path } = writeLauncher({
    identity: 'demo-pack', exePath: 'C:\\games\\gen1recomp.exe', outDir: root, packName: 'Demo',
  });
  const script = readFileSync(path, 'utf8');
  ok(script.includes('POKEPORT_IDENTITY=demo-pack'), 'the launcher must set the identity');
  ok(script.includes('gen1recomp.exe'), 'the launcher must run the game');

  rmSync(root, { recursive: true, force: true });
});

// A helper for the delete tests: a plausible instance with mods, a save and
// unpacked ROM data, so the confirmation has something real to describe.
function stockInstance(root, identity) {
  const path = join(root, identity);
  mkdirSync(join(path, 'mods', 'VOXEL'), { recursive: true });
  mkdirSync(join(path, 'mods', '.pokepack-backup', 'OLD'), { recursive: true });
  mkdirSync(join(path, 'saves'), { recursive: true });
  mkdirSync(join(path, 'red'), { recursive: true });
  writeFileSync(join(path, 'mods', 'VOXEL', 'manifest.json'), '{"id":"VOXEL","version":"1.0.0"}');
  writeFileSync(join(path, 'mods', '.pokepack-backup', 'OLD', 'manifest.json'), '{"id":"OLD"}');
  writeFileSync(join(path, 'saves', 'slot1.sav'), 'a playthrough');
  writeFileSync(join(path, 'red', 'rom-cache.complete'), 'rom-cache-v9:abc');
  return path;
}

it('describes what deleting a setup would take with it', () => {
  const root = join(HERE, '..', '.test-tmp-del');
  rmSync(root, { recursive: true, force: true });
  const path = stockInstance(root, 'doomed');

  const d = describeInstance(path);
  eq(d.mods, ['VOXEL'], 'the backup folder is not a mod');
  eq(d.saves, ['slot1.sav']);
  eq(d.romVersions, ['red']);
  ok(d.files >= 4, `expected to count the files, got ${d.files}`);
  ok(d.bytes > 0, 'a size of zero would understate what is being removed');

  rmSync(root, { recursive: true, force: true });
});

it('moves a deleted setup to the trash instead of erasing it', () => {
  const root = join(HERE, '..', '.test-tmp-del2');
  rmSync(root, { recursive: true, force: true });
  const path = stockInstance(root, 'doomed');

  const out = trashInstance({ identity: 'doomed', confirm: 'doomed', loveRoot: root });
  ok(!existsSync(path), 'the instance folder is gone from the list');
  ok(existsSync(out.to), 'but the folder itself still exists');
  eq(readFileSync(join(out.to, 'saves', 'slot1.sav'), 'utf8'), 'a playthrough',
    'the save file must survive -- it is the one thing nobody can redownload');
  ok(out.to.includes(TRASH_DIR), 'it goes to the trash folder');

  rmSync(root, { recursive: true, force: true });
});

it('parks trashed setups in a dot folder, which the scan skips', () => {
  // Not cosmetic: findSaveDirs() ignores names starting with a dot, so a
  // trashed setup reappearing in My packs would make deleting look broken.
  ok(TRASH_DIR.startsWith('.'), 'the trash folder must not read as an instance');
});

it('refuses to delete without the name typed back exactly', () => {
  const root = join(HERE, '..', '.test-tmp-del3');
  rmSync(root, { recursive: true, force: true });
  const path = stockInstance(root, 'doomed');

  throws(() => trashInstance({ identity: 'doomed', confirm: '', loveRoot: root }), 'exactly to confirm');
  throws(() => trashInstance({ identity: 'doomed', confirm: 'Doomed', loveRoot: root }), 'exactly to confirm');
  ok(existsSync(path), 'a mistyped confirmation must leave everything where it was');

  rmSync(root, { recursive: true, force: true });
});

it("will not delete the game's own save folder", () => {
  // pokemon-love2d is where gen1recomp writes when nothing sets an instance --
  // somebody's real progress, and never what "delete this pack" meant.
  throws(
    () => trashInstance({ identity: 'pokemon-love2d', confirm: 'pokemon-love2d' }),
    "game's own save folder",
  );
});

it('refuses a name that is not an instance at all', () => {
  throws(() => trashInstance({ identity: '../..', confirm: '../..' }), 'letters, digits');
  throws(
    () => trashInstance({ identity: 'no-such-pack', confirm: 'no-such-pack', loveRoot: HERE }),
    'no instance called',
  );
});

// ------- liveapply

describe('liveapply');

const livePack = pack.validate({
  ...valid,
  name: 'KANTO 3D',
  mods: [{
    id: 'BATTLE_ART_VOXEL_FORK', version: '1.7.1',
    source: { url: 'https://e.com/v.zip', sha256: HASH_A },
    options: { water: 'full', aa: 2 },
  }],
  disable: ['DRAMATIC_SHAPE'],
});

function tmpSave(withOptions) {
  const dir = join(HERE, '..', '.test-tmp-live');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  if (withOptions) writeFileSync(join(dir, 'options.lua'), readFileSync(join(SAVE, 'options.lua'), 'utf8'));
  return dir;
}

it('will not touch options.lua while the game is running', () => {
  const dir = tmpSave(true);
  const before = readFileSync(join(dir, 'options.lua'), 'utf8');
  const r = applyToOptions(dir, livePack, { running: true });
  eq(r.applied, false);
  ok(r.reason.includes('running'), r.reason);
  eq(readFileSync(join(dir, 'options.lua'), 'utf8'), before, 'the file must be untouched');
  rmSync(dir, { recursive: true, force: true });
});

it('will not touch it when it cannot tell whether the game is running', () => {
  const dir = tmpSave(true);
  const r = applyToOptions(dir, livePack, { running: null });
  eq(r.applied, false);
  ok(r.reason.includes('could not tell'), r.reason);
  rmSync(dir, { recursive: true, force: true });
});

it('merges into an existing options.lua without disturbing anything else', () => {
  const dir = tmpSave(true);
  const before = parse(readFileSync(join(dir, 'options.lua'), 'utf8'));
  const r = applyToOptions(dir, livePack, { running: false });
  eq(r.applied, true, r.reason);
  const after = parse(readFileSync(join(dir, 'options.lua'), 'utf8'));

  eq(after.mods.BATTLE_ART_VOXEL_FORK, true);
  eq(after.mods.DRAMATIC_SHAPE, false);
  eq(after.modOptions.BATTLE_ART_VOXEL_FORK.water, 'full', "the pack's tested value wins");
  eq(after.activeProfile, 'KANTO 3D');
  eq(after.modProfilesSeeded, true);

  // Unrelated keys survive untouched -- this is a merge, not a template.
  eq(after.fpsCap, before.fpsCap);
  eq(after.battleBg, before.battleBg);
  eq(after.modUpdateCache, before.modUpdateCache);
  eq(after.modOptions.GHOST_LINK, before.modOptions.GHOST_LINK);
  rmSync(dir, { recursive: true, force: true });
});

it('keeps the previous options.lua, under a name the engine does not use', () => {
  const dir = tmpSave(true);
  const r = applyToOptions(dir, livePack, { running: false });
  ok(r.backedUp, 'a backup should be kept');
  ok(existsSync(r.backedUp), 'and it should be on disk');
  // options.lua.bak is the engine's own crash recovery; ours must not be it.
  ok(!r.backedUp.endsWith('.bak'), `must not clobber the engine's backup: ${r.backedUp}`);
  rmSync(dir, { recursive: true, force: true });
});

it('writes a legal partial file when there is no options.lua yet', () => {
  const dir = tmpSave(false);
  const r = applyToOptions(dir, livePack, { running: false });
  eq(r.applied, true, r.reason);
  eq(r.created, true);
  eq(r.backedUp, null, 'nothing existed, so nothing to back up');
  const doc = parse(readFileSync(join(dir, 'options.lua'), 'utf8'));
  eq(doc.activeProfile, 'KANTO 3D');
  eq(doc.mods.BATTLE_ART_VOXEL_FORK, true);
  rmSync(dir, { recursive: true, force: true });
});

it('only names mods that actually installed', () => {
  const dir = tmpSave(false);
  applyToOptions(dir, livePack, { running: false, installedIds: new Set() });
  const doc = parse(readFileSync(join(dir, 'options.lua'), 'utf8'));
  eq(doc.mods.BATTLE_ART_VOXEL_FORK, undefined, 'nothing installed, so nothing switched on');
  eq(doc.mods.DRAMATIC_SHAPE, false, 'but the exclusion still holds');
  rmSync(dir, { recursive: true, force: true });
});

it('switches one mod on or off without uninstalling it', () => {
  const dir = tmpSave(true);
  eq(setModEnabled(dir, 'BATTLE_ART_VOXEL_FORK', false, { running: false }).changed, true);
  eq(parse(readFileSync(join(dir, 'options.lua'), 'utf8')).mods.BATTLE_ART_VOXEL_FORK, false);
  eq(setModEnabled(dir, 'BATTLE_ART_VOXEL_FORK', true, { running: false }).changed, true);
  eq(parse(readFileSync(join(dir, 'options.lua'), 'utf8')).mods.BATTLE_ART_VOXEL_FORK, true);
  rmSync(dir, { recursive: true, force: true });
});

it('refuses to toggle while the game is running', () => {
  const dir = tmpSave(true);
  const before = readFileSync(join(dir, 'options.lua'), 'utf8');
  const r = setModEnabled(dir, 'BATTLE_ART_VOXEL_FORK', false, { running: true });
  eq(r.changed, false);
  ok(r.reason.includes('running'), r.reason);
  eq(readFileSync(join(dir, 'options.lua'), 'utf8'), before, 'nothing may be written');
  rmSync(dir, { recursive: true, force: true });
});

it('will not conjure a save slot that was never registered', () => {
  const dir = tmpSave(true);
  const withSlot = pack.validate({ ...livePack, slots: { red: 'slot9' } });
  const r = applyToOptions(dir, withSlot, { running: false });
  eq(r.slotsMoved, [], 'slot9 is not registered, so it must not become active');
  rmSync(dir, { recursive: true, force: true });
});

// ------- uninstall

describe('uninstall');

function tmpInstalled() {
  const dir = join(HERE, '..', '.test-tmp-un');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'mods', 'FROM_PACK'), { recursive: true });
  mkdirSync(join(dir, 'mods', 'BY_HAND'), { recursive: true });
  writeFileSync(join(dir, 'mods', 'FROM_PACK', 'manifest.json'), '{"id":"FROM_PACK","version":"1.0.0"}');
  writeFileSync(join(dir, 'mods', 'BY_HAND', 'manifest.json'), '{"id":"BY_HAND","version":"2.0.0"}');
  // Only FROM_PACK is recorded as belonging to a pack.
  writeFileSync(join(dir, 'pokepack-installed.json'), JSON.stringify({
    mods: { FROM_PACK: { version: '1.0.0', sha256: HASH_A, pack: 'test-pack' } },
  }));
  return dir;
}

it('moves a pack\'s mods to the backup folder rather than deleting them', () => {
  const dir = tmpInstalled();
  const r = uninstall(dir, 'test-pack', { running: false });
  eq(r.moved.map((m) => m.id), ['FROM_PACK']);
  ok(!existsSync(join(dir, 'mods', 'FROM_PACK')), 'it should be gone from mods/');
  ok(existsSync(join(r.moved[0].to, 'manifest.json')), 'and intact in the backup');
  rmSync(dir, { recursive: true, force: true });
});

it('never touches a mod the player installed themselves', () => {
  const dir = tmpInstalled();
  uninstall(dir, 'test-pack', { running: false });
  ok(existsSync(join(dir, 'mods', 'BY_HAND', 'manifest.json')),
    'a mod no pack claims must survive, even in the same folder');
  rmSync(dir, { recursive: true, force: true });
});

it('forgets the removed mods in the lock file', () => {
  const dir = tmpInstalled();
  uninstall(dir, 'test-pack', { running: false });
  const lock = JSON.parse(readFileSync(join(dir, 'pokepack-installed.json'), 'utf8'));
  eq(lock.mods.FROM_PACK, undefined, 'otherwise a later install trips the already-installed guard');
  rmSync(dir, { recursive: true, force: true });
});

it('shows what would move before anything does', () => {
  const dir = tmpInstalled();
  const plan = planUninstall(dir, 'test-pack');
  eq(plan.remove.map((m) => m.id), ['FROM_PACK']);
  ok(existsSync(join(dir, 'mods', 'FROM_PACK')), 'planning must not move anything');
  rmSync(dir, { recursive: true, force: true });
});

it('does nothing for a pack that installed nothing here', () => {
  const dir = tmpInstalled();
  const r = uninstall(dir, 'some-other-pack', { running: false });
  eq(r.moved, []);
  ok(existsSync(join(dir, 'mods', 'FROM_PACK')), 'another pack\'s mods stay put');
  rmSync(dir, { recursive: true, force: true });
});

it('leaves options.lua alone while the game is running', () => {
  const dir = tmpInstalled();
  writeFileSync(join(dir, 'options.lua'), 'return {\n  mods = {\n    FROM_PACK = true,\n  },\n}\n');
  const r = uninstall(dir, 'test-pack', { running: true });
  eq(r.moved.length, 1, 'the mods still move');
  eq(r.optionsChanged, false, 'but the file the launcher owns does not');
  rmSync(dir, { recursive: true, force: true });
});

// ------- rom

describe('rom');

const REAL_ROM = join(HERE, '..', '..', 'pokemon', 'Pokemon - Red Version (USA, Europe) (SGB Enhanced).gb');

it('identifies a real ROM by checksum, not by filename', () => {
  if (!existsSync(REAL_ROM)) return;
  const r = identifyRom(REAL_ROM);
  eq(r.ok, true, r.reason);
  eq(r.version, 'red');
  eq(r.sha1, 'ea9bcae617fdf159b045185467ae58b2e4a48b9a');
});

it('accepts a quoted path and returns an absolute one', () => {
  if (!existsSync(REAL_ROM)) return;
  const r = identifyRom(`"${REAL_ROM}"`);
  eq(r.ok, true, r.reason);
  // The path is stored in a machine-global config and read back from anywhere,
  // so a relative one would break the moment the hub ran from another folder.
  ok(/^([A-Za-z]:|\/)/.test(r.path), `expected an absolute path, got ${r.path}`);
});

it('turns down a file that is not a supported ROM', () => {
  const r = identifyRom(join(HERE, '..', 'package.json'));
  eq(r.ok, false);
  ok(r.reason.includes('not a Red, Blue or Yellow ROM'), r.reason);
});

it('turns down a missing file and a folder', () => {
  ok(identifyRom(join(HERE, '..', 'no-such.gb')).reason.startsWith('that file does not exist'));
  eq(identifyRom(join(HERE, '..', 'src')).reason, 'that is a folder, not a ROM file');
  eq(identifyRom('').reason, 'no file given');
});

it('copies the ROM to where the game actually looks', () => {
  if (!existsSync(REAL_ROM)) return;
  const dir = join(HERE, '..', '.test-tmp-rom2');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  eq(baseromsIn(dir), [], 'nothing there to start with');
  const r = linkRom(REAL_ROM, dir);
  eq(r.copied, true);
  eq(baseromsIn(dir).length, 1, 'the game scans baseroms/ -- that is the whole mechanism');

  // Second call must not duplicate it.
  eq(linkRom(REAL_ROM, dir).copied, false);
  eq(baseromsIn(dir).length, 1);
  rmSync(dir, { recursive: true, force: true });
});

// ------- feed

describe('feed');

it('summarises packs for a browse screen', () => {
  const f = buildFeed([{ name: 'x.pokepack', pack: twoMods }]);
  eq(f.packs.length, 1);
  eq(f.packs[0].modCount, 2);
  eq(f.counts.unknown, 1, 'no validation has run, so status is not claimed');
});

it('keeps a bad pack out of the catalogue and says why', () => {
  const f = buildFeed([{ name: 'bad.pokepack', error: 'not valid JSON' }]);
  eq(f.packs.length, 0);
  eq(f.rejected[0].file, 'bad.pokepack');
});

it('folds vote counts in and sorts by them', () => {
  const entries = [
    { name: 'a.pokepack', pack: { ...twoMods, id: 'quiet', name: 'Quiet' } },
    { name: 'b.pokepack', pack: { ...twoMods, id: 'loud', name: 'Loud' } },
  ];
  const f = buildFeed(entries, {
    votes: { loud: { votes: 12, thread: 'https://github.com/x/y/issues/3', comments: 2 } },
  });
  eq(f.packs.map((p) => p.id), ['loud', 'quiet'], 'most-voted first');
  eq(f.packs[0].votes, 12);
  eq(f.packs[0].thread, 'https://github.com/x/y/issues/3');
  eq(f.packs[1].votes, 0, 'a pack with no thread is zero, not missing');
});

it('breaks vote ties by name so the front page does not reshuffle', () => {
  const f = buildFeed([
    { name: 'b.pokepack', pack: { ...twoMods, id: 'b', name: 'Beedrill' } },
    { name: 'a.pokepack', pack: { ...twoMods, id: 'a', name: 'Abra' } },
  ]);
  eq(f.packs.map((p) => p.name), ['Abra', 'Beedrill']);
});

it('gives every published entry an absolute URL the hub can fetch', () => {
  // A bare filename means nothing on somebody else's machine, and the gallery
  // reader drops any entry it cannot fetch -- so this is the difference between
  // a published list and an empty screen.
  const f = buildFeed([{ name: 'kanto 3d.pokepack', pack: twoMods }], {
    baseUrl: 'https://moonfall-man.github.io/pokepack/data',
  });
  eq(f.packs[0].url, 'https://moonfall-man.github.io/pokepack/data/kanto%203d.pokepack');
  eq(packfeed.normalise({ schema_version: 1, packs: f.packs }, 'x').packs.length, 1,
    'the gallery reader must accept what the builder emits');

  const local = buildFeed([{ name: 'a.pokepack', pack: twoMods }]);
  eq(local.packs[0].url, null, 'no base URL means no invented one');
});

it('works out where GitHub Pages will serve a repo', () => {
  eq(pagesBase('moonfall-man/pokepack'), 'https://moonfall-man.github.io/pokepack/data/');
  eq(pagesBase('Moonfall-Man/pokepack'), 'https://moonfall-man.github.io/pokepack/data/');
  // A repo named after the user is served at the root, not under its own name.
  eq(pagesBase('moonfall-man/moonfall-man.github.io'), 'https://moonfall-man.github.io/data/');
  eq(pagesBase('nonsense'), null);
});

it('builds a submit link GitHub can open, and refuses a silly repo', () => {
  const { url, tooLong } = submitUrl({
    repo: 'moonfall-man/pokepack', pack: twoMods, text: 'PACK 1\n{"id":"x"}',
  });
  // master, not dev: there is only one long-lived branch, and a link pointing
  // at a branch that does not exist is a dead Publish button.
  ok(url.startsWith('https://github.com/moonfall-man/pokepack/new/master?'), url);
  ok(url.includes(`filename=${encodeURIComponent(`packs/${twoMods.id}.pokepack`)}`), url);
  ok(url.includes(encodeURIComponent('{"id":"x"}')), 'the file has to travel in the link');
  eq(tooLong, false);

  throws(() => submitUrl({ repo: 'not-a-repo', pack: twoMods, text: 'x' }), 'owner/name');
  throws(() => submitUrl({ repo: '', pack: twoMods, text: 'x' }), 'owner/name');
});

it('says when a pack is too big to send as a link rather than truncating it', () => {
  // A silently cut-off file is a corrupt pack somebody then submits.
  const { tooLong } = submitUrl({ repo: 'a/b', pack: twoMods, text: 'x'.repeat(9000) });
  eq(tooLong, true);
});

// ------- logs

describe('logs');

it('reads the end of a long log, not the whole thing', () => {
  // A long session prints megabytes and the interesting part is always the
  // last thing that happened.
  const root = join(HERE, '..', '.test-tmp-logs');
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  const path = join(root, 'big.log');
  writeFileSync(path, `${'filler line\n'.repeat(2000)}the last thing\n`);

  const got = logs.tail(path, 200);
  ok(got.endsWith('the last thing\n'), 'the end must be there');
  ok(got.length <= 200, `expected a tail, got ${got.length} bytes`);
  ok(!got.startsWith('ler'), 'a tail starting mid-line reads as corruption');

  eq(logs.tail(path, 1024 * 1024).endsWith('the last thing\n'), true, 'a short file comes back whole');
  rmSync(root, { recursive: true, force: true });
});

it('collects every log a pack has, and shrugs at the ones it has not', () => {
  const root = join(HERE, '..', '.test-tmp-logs2');
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });

  eq(logs.readLogs(root).any, false, 'a pack that has never crashed has no logs');
  eq(logs.readLogs(null).sources, [], 'and no pack at all is not an error');

  writeFileSync(join(root, 'pokepack-run.log'), '[info] game loaded\n');
  writeFileSync(join(root, 'lua-error.log'), '[2026-08-12] boom\n');
  const out = logs.readLogs(root);
  eq(out.any, true);
  eq(out.sources.map((s) => s.kind), ['run', 'error']);
  ok(out.sources[0].text.includes('game loaded'));

  rmSync(root, { recursive: true, force: true });
});

it('reads back the order mods actually loaded in', () => {
  // Not predicted -- the engine decides order from the manifests (priority,
  // then dependencies first) so it is the same everywhere, but when two mods
  // fight over the same thing, which one ran second is the answer.
  const order = logs.loadOrder([
    '[info] generated data loaded (222 maps, 151 species, 165 moves)',
    '[info] loaded mod unique_menu_icons 1.4.0',
    '[info] loaded mod rby_mmo 1.0.3',
    '[info] loaded mod unique_menu_icons 1.4.0',
    '[info] game loaded',
  ].join('\n'));
  eq(order.map((m) => m.id), ['unique_menu_icons', 'rby_mmo'], 'in order, and only once each');
  eq(order[1].version, '1.0.3');
  eq(logs.loadOrder('nothing here').length, 0);
  eq(logs.loadOrder(null).length, 0);
});

it('picks out the lines worth showing first', () => {
  const found = logs.interesting([
    '[info] generated data loaded',
    '[warn] mod VOXEL_DEX ignored: missing dependency',
    '[info] display: 1024x768',
    '[error] shader failed to compile',
    'stack traceback:',
    '',
  ].join('\n'));
  eq(found.map((f) => f.level), ['warn', 'error', 'error']);
  ok(found[0].line.includes('VOXEL_DEX'));
  eq(logs.interesting('').length, 0);
  eq(logs.interesting(null).length, 0);
});

// ------- deps

describe('deps');

it('splits a dependency into an id and a range', () => {
  // The whole string used to come back as the id, so it matched no installed
  // mod and every dependency quietly passed.
  eq(deps.parseDep('DRAMATIC_SHAPE@>=1.7.0 <2.0.0'), { id: 'DRAMATIC_SHAPE', range: '>=1.7.0 <2.0.0' });
  eq(deps.parseDep('PLAIN_MOD'), { id: 'PLAIN_MOD', range: null });
  eq(deps.parseDep({ id: 'OBJ', range: '>=1' }), { id: 'OBJ', range: '>=1' });
  eq(deps.parseDep('  SPACED  '), { id: 'SPACED', range: null });
  eq(deps.parseDep(''), null);
  eq(deps.parseDep(null), null);
});

it('reads the range dialect the engine uses', () => {
  eq(deps.satisfies('1.8.2', '>=1.7.0 <2.0.0'), true);
  eq(deps.satisfies('2.0.0', '>=1.7.0 <2.0.0'), false);
  eq(deps.satisfies('1.6.9', '>=1.7.0 <2.0.0'), false);
  eq(deps.satisfies('0.0.0-dev', '0.0.0-dev || >=0.1.37 <2.0.0'), true, 'alternatives are ORed');
  eq(deps.satisfies('0.1.79', '0.0.0-dev || >=0.1.37 <2.0.0'), true);
  eq(deps.satisfies('1.0.0', null), true, 'no range means any version');
  eq(deps.satisfies(null, '>=9'), true, 'no version means we cannot tell, so do not cry wolf');
});

it('does not invent a problem out of a range dialect it does not know', () => {
  // Warning somebody their setup is broken on a guess is worse than missing a
  // real fault -- the game still checks properly either way.
  eq(deps.satisfies('1.0.0', 'somethingweird'), true);
});

it('spots a missing dependency, a wrong version and a clash', () => {
  const report = deps.check({
    VOXEL_DEX: { version: '1.0.0', dependencies: ['DRAMATIC_SHAPE@>=1.7.0 <2.0.0'], conflicts: [] },
    DRAMALESS_SHAPE: { version: '1.0.0', dependencies: [], conflicts: [] },
    gen3_box: { version: '1.5.2', dependencies: [], conflicts: [] },
  });
  eq(report.VOXEL_DEX.missing.map((d) => d.id), ['DRAMATIC_SHAPE']);
  eq(report.DRAMALESS_SHAPE.missing, []);
  eq(deps.isHealthy(report.gen3_box), true);

  const tooOld = deps.check({
    A: { version: '1.0.0', dependencies: ['B@>=2.0.0'], conflicts: [] },
    B: { version: '1.0.0', dependencies: [], conflicts: [] },
  });
  eq(tooOld.A.missing, [], 'it is installed, just not new enough');
  eq(tooOld.A.wrongVersion[0].have, '1.0.0');
});

it('reports a conflict to both sides, whichever one declared it', () => {
  // Only one manifest has to say it, and which one is not the player's problem.
  const report = deps.check({
    BATTLE_ART_VOXEL_FORK: { version: '1.8.3', conflicts: ['DRAMALESS_SHAPE'], dependencies: [] },
    DRAMALESS_SHAPE: { version: '1.0.0', conflicts: [], dependencies: [] },
  });
  eq(report.BATTLE_ART_VOXEL_FORK.clashes, ['DRAMALESS_SHAPE']);
  eq(report.DRAMALESS_SHAPE.clashes, ['BATTLE_ART_VOXEL_FORK'], 'the other side must hear about it too');
});

// ------- updating the app itself

describe('update');

await itAsync('spots a newer app version, and does not cry wolf on an equal one', async () => {
  const serve = (version) => async () => ({ version, notes: 'nicer things', url: 'https://github.com/o/r' });
  const here = update.currentVersion();
  ok(here, 'the app must know its own version');

  const older = await update.check({ url: 'x', force: true, now: 1 });
  eq(typeof older.current, 'string');

  // Injected through fetchJson would need a network; check the comparison
  // directly instead, which is the part that can be wrong.
  eq(compareVersions('0.2.0', '0.1.0') > 0, true, 'newer');
  eq(compareVersions('0.1.0', '0.1.0') > 0, false, 'same is not newer');
  eq(compareVersions('0.1.0', '0.2.0') > 0, false, 'older is not newer');
  void serve;
});

it('refuses to pull over uncommitted work', () => {
  // Uncommitted changes are the one thing in a checkout nobody else has a copy
  // of, so this reports rather than stashing or resetting.
  const st = update.status();
  eq(typeof st.git, 'boolean');
  if (st.git && !st.clean) ok(st.reason, 'an unpullable checkout has to say why');
  if (!st.clean) throws(() => update.pull(), '', 'pull must refuse when status says it cannot');
});

// ------- github links

describe('github');

const RELEASE = {
  tag_name: 'v1.8.2',
  assets: [
    { name: 'Source code.zip', size: 900, browser_download_url: 'https://e.com/src.zip' },
    { name: 'DRAMATIC_SHAPE-1.8.2.zip', size: 21000, browser_download_url: 'https://e.com/mod.zip' },
  ],
};

it('picks the mod zip out of a release, not the source archive', () => {
  const got = gh.pickZip(RELEASE.assets, { id: 'DRAMATIC_SHAPE' });
  eq(got.browser_download_url, 'https://e.com/mod.zip');
  // With no id to go on, the bigger file is the better guess than the first.
  eq(gh.pickZip(RELEASE.assets).browser_download_url, 'https://e.com/mod.zip');
  eq(gh.pickZip([{ name: 'notes.txt', browser_download_url: 'x' }]), null);
  eq(gh.pickZip([]), null);
});

await itAsync('resolves a release page to the file it publishes', async () => {
  const seen = [];
  const fake = async (u) => { seen.push(u); return RELEASE; };
  const out = await gh.resolveDownload(
    'https://github.com/scottcandy34/DramaticShapeVoxelMod-latest/releases/tag/v1.8.2',
    { id: 'DRAMATIC_SHAPE', fetch: fake },
  );
  eq(out.url, 'https://e.com/mod.zip');
  eq(out.version, '1.8.2', 'the v prefix is not part of the version');
  eq(seen[0], 'https://api.github.com/repos/scottcandy34/DramaticShapeVoxelMod-latest/releases/tags/v1.8.2');
});

await itAsync('takes a bare repo or a direct zip too', async () => {
  const fake = async () => RELEASE;
  eq((await gh.resolveDownload('https://github.com/o/r', { fetch: fake })).url, 'https://e.com/mod.zip');
  eq((await gh.resolveDownload('https://github.com/o/r/releases/latest', { fetch: fake })).url, 'https://e.com/mod.zip');
  const direct = await gh.resolveDownload('https://files.example.com/GHOST_LINK-0.1.0.zip', { fetch: fake });
  eq(direct.url, 'https://files.example.com/GHOST_LINK-0.1.0.zip');
  eq(direct.from, 'direct link', 'no API call needed for a file');
});

await itAsync('refuses a link it cannot honestly resolve', async () => {
  const fake = async () => RELEASE;
  const rejects = async (link, match) => {
    try {
      await gh.resolveDownload(link, { fetch: fake });
    } catch (e) {
      ok(String(e.message).includes(match), `expected ${match}, got ${e.message}`);
      return;
    }
    throw new Error(`expected ${link} to be refused`);
  };
  await rejects('http://github.com/o/r/releases/tag/v1', 'https');
  await rejects('https://example.com/some/page', 'GitHub release page');
  await rejects('not a url at all', 'not a URL');
  await rejects('https://github.com/o/r/issues/4', 'release page');
});

it('names the anonymous rate limit instead of showing a bare 403', () => {
  // Nothing here needs a GitHub account, but 60 requests an hour is shared per
  // IP and pinning a pack spends one per repo.  A bare 403 reads as "the mod is
  // gone", which sends people looking for the wrong problem.
  const headers = new Map([
    ['x-ratelimit-remaining', '0'],
    ['x-ratelimit-reset', String(Math.floor(Date.now() / 1000) + 300)],
  ]);
  const res = { status: 403, headers: { get: (k) => headers.get(k) ?? null } };
  const msg = net.rateLimited(res);
  ok(msg.includes('rate-limiting'), msg);
  ok(/\b5 minutes\b/.test(msg), `should say when it lifts, got: ${msg}`);

  // A 403 with requests still on the clock is a different problem entirely.
  headers.set('x-ratelimit-remaining', '42');
  eq(net.rateLimited(res), null);
  eq(net.rateLimited({ status: 404, headers: { get: () => null } }), null);
});

await itAsync('says so when a release publishes no zip', async () => {
  const empty = async () => ({ tag_name: 'v1', assets: [{ name: 'readme.md', browser_download_url: 'x' }] });
  try {
    await gh.resolveDownload('https://github.com/o/r/releases/tag/v1', { fetch: empty });
  } catch (e) {
    ok(e.message.includes('no .zip asset'), e.message);
    return;
  }
  throw new Error('expected a refusal');
});

// ------- catalogue

describe('catalogue');

const catMods = [
  { id: 'A', title: 'A', categories: ['UI', 'QOL'] },
  { id: 'B', title: 'B', categories: ['ART'] },
  { id: 'C', title: 'C', categories: ['UI'] },
  { id: 'D', title: 'D', categories: [] },
];

it('counts categories, commonest first', () => {
  eq(catalogue.facets(catMods), [
    { name: 'UI', count: 2 }, { name: 'ART', count: 1 }, { name: 'QOL', count: 1 },
  ]);
});

it('derives the categories from the index rather than a fixed list', () => {
  // One added upstream must appear without a release here.
  const withNew = [...catMods, { id: 'E', categories: ['NEWFANGLED'] }];
  ok(catalogue.facets(withNew).some((f) => f.name === 'NEWFANGLED'));
  eq(catalogue.facets([]), [], 'and none reads as none, not as a stale list of zeroes');
});

it('filters by any of the ticked categories, not all of them', () => {
  // All-of would empty the screen: almost nothing carries two tags.
  eq(catalogue.byCategory(catMods, ['UI']).map((m) => m.id), ['A', 'C']);
  eq(catalogue.byCategory(catMods, ['UI', 'ART']).map((m) => m.id), ['A', 'B', 'C']);
  eq(catalogue.byCategory(catMods, ['ui']).map((m) => m.id), ['A', 'C'], 'case must not matter');
  eq(catalogue.byCategory(catMods, []).length, 4, 'nothing ticked shows everything');
  eq(catalogue.byCategory(catMods, ['NOPE']).length, 0);
});

// ------- votes

describe('votes');

it('reads the pack id out of an issue body, not its title', () => {
  // Titles get edited.  An issue that stops matching its pack silently loses
  // every vote on it.
  const body = votes.issueBody({ id: 'kanto-3d', name: 'Kanto 3D', author: 'me', summary: 's', mods: [1, 2] });
  eq(votes.idFromIssue({ body }), 'kanto-3d');
  eq(votes.idFromIssue({ body: 'no marker here' }), null);
  eq(votes.idFromIssue({}), null);
});

it('says out loud that a vote is not a safety check', () => {
  const body = votes.issueBody({ id: 'x', name: 'X', summary: '', mods: [] });
  ok(/not a safety check/i.test(body), 'popularity must not read as endorsement');
});

await itAsync('counts thumbs-up per pack and ignores pull requests', async () => {
  const issues = [
    { number: 1, body: '<!-- pokepack-id: a -->', reactions: { '+1': 5 }, html_url: 'u1', comments: 1 },
    // A PR carrying the label would otherwise show up as a pack with votes.
    { number: 2, body: '<!-- pokepack-id: b -->', reactions: { '+1': 99 }, pull_request: {}, html_url: 'u2' },
    { number: 3, body: 'unrelated issue', reactions: { '+1': 3 }, html_url: 'u3' },
  ];
  const found = await votes.listPackIssues(async () => issues);
  eq(found.map((i) => i.id), ['a'], 'only real pack issues count');
  eq(found[0].votes, 5);
  eq(found[0].comments, 1);
});

await itAsync('opens a thread only for packs that have none', async () => {
  const calls = [];
  const api = async (path, init) => {
    calls.push(path);
    return { number: calls.length, html_url: `https://github.com/x/y/issues/${calls.length}` };
  };
  const out = await votes.syncIssues({
    api,
    packs: [{ id: 'a', name: 'A', mods: [] }, { id: 'b', name: 'B', mods: [] }],
    existing: [{ id: 'a', number: 1 }],
  });
  eq(out.created.map((c) => c.id), ['b'], 'the one that already had a thread is left alone');
  eq(out.skipped, 1);
  eq(calls.length, 1, 'and nothing else is touched -- that thread holds other people\'s votes');
});

it('fixes the gallery in the build rather than in a setting', () => {
  // The list decides what the hub offers to install, so it must not be
  // repointable from a text box -- and it must work with nothing set up.
  ok(packfeed.OFFICIAL_GALLERY.startsWith('https://'), packfeed.OFFICIAL_GALLERY);
  ok(packfeed.OFFICIAL_GALLERY.endsWith('.json'), packfeed.OFFICIAL_GALLERY);
  ok(/^[\w.-]+\/[\w.-]+$/.test(packfeed.OFFICIAL_REPO), packfeed.OFFICIAL_REPO);
  // The built-in gallery and the built-in submit target must be the same
  // project, or Share sends packs somewhere nobody is browsing.
  const owner = packfeed.OFFICIAL_REPO.split('/')[0].toLowerCase();
  ok(packfeed.OFFICIAL_GALLERY.includes(owner), 'gallery and submit repo must agree');
});

it('refuses a gallery link that is not https, wherever it appears', () => {
  // These end up as an href and an img src in the hub, out of a file somebody
  // else publishes.  javascript: in a link is the obvious one; nothing else has
  // a reason to be allowed either.
  const g = packfeed.normalise({
    schema_version: 1,
    packs: [{
      id: 'a', name: 'A', url: 'https://e.com/a.pokepack', votes: 4,
      thread: 'javascript:alert(1)', thumbnail: 'http://e.com/x.png',
    }],
  }, 'https://e.com/packs.json');
  eq(g.packs[0].thread, null, 'a javascript: link must not survive');
  eq(g.packs[0].thumbnail, null, 'nor a plain http image');
  eq(g.packs[0].votes, 4);
});

it('drops a gallery entry whose own download is not https', () => {
  const g = packfeed.normalise({
    schema_version: 1,
    packs: [{ id: 'bad', url: 'http://e.com/a.pokepack' }, { id: 'ok', url: 'https://e.com/b.pokepack' }],
  }, 'https://e.com/packs.json');
  eq(g.packs.map((p) => p.id), ['ok']);
});

it('keeps the busiest thread when a pack has two', () => {
  // A mistakenly reopened issue must not wipe the votes on the real one.
  const map = votes.votesFrom([
    { id: 'a', votes: 2, url: 'stale', comments: 0 },
    { id: 'a', votes: 40, url: 'real', comments: 9 },
  ]);
  eq(map.a.votes, 40);
  eq(map.a.thread, 'real');
});

// ------- the page itself

describe('ui-page');

it('generates a page whose script actually parses', () => {
  // The page is a template literal full of escaped quotes and \\u sequences.
  // A stray escape produces a syntax error that kills the whole UI silently --
  // the browser logs it and renders an inert page.  Parse it here instead.
  const html = page('test-token');
  const open = html.indexOf('<script>');
  const close = html.lastIndexOf('</script>');
  ok(open > 0 && close > open, 'the page should contain a script block');
  const body = html.slice(open + 8, close);
  try {
    new Function(body);
  } catch (e) {
    throw new Error(`the page script does not parse: ${e.message}`);
  }
});

it('puts the token in the page and nowhere it can leak', () => {
  const html = page('SECRET-TOKEN');
  eq(html.includes('"SECRET-TOKEN"'), true, 'the page needs the token to call its own API');
  // One occurrence: assigned once to a const, then referenced by name.
  eq(html.split('SECRET-TOKEN').length - 1, 1);
});

// ------- report

if (failures.length === 0) {
  process.stdout.write(`\n  ${passed} passing\n\n`);
} else {
  process.stdout.write(`\n  ${passed} passing, ${failures.length} failing\n\n`);
  for (const f of failures) {
    process.stdout.write(`  FAIL  ${f.name}\n        ${f.error.message.replace(/\n/g, '\n        ')}\n\n`);
  }
  process.exit(1);
}
