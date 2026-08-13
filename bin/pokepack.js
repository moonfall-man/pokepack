#!/usr/bin/env node
// pokepack -- build, inspect, resolve and validate gen1recomp modpack recipes.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readSync } from 'node:fs';
import { resolve as resolvePath, join, dirname } from 'node:path';
import * as pack from '../src/packformat.js';
import { readSaveDir, releasesFromCache, indexFromCache, indexFromFeeds } from '../src/state.js';
import { build, pin, slugify } from '../src/build.js';
import { resolve as plan, OK, INSTALL, RECONCILE, UNAVAILABLE, BLOCKED } from '../src/resolve.js';
import { validatePack, LIVE, CHANGED, BROKEN } from '../src/validate.js';
import { apply } from '../src/apply.js';
import { loadPacks, buildFeed, pagesBase } from '../src/feed.js';
import { hashUrl, fetchJson, downloadToBuffer, fetchReleases } from '../src/net.js';

const MARK = {
  [OK]: 'ok  ', [INSTALL]: ' +  ', [RECONCILE]: ' ~  ',
  [UNAVAILABLE]: ' x  ', [BLOCKED]: ' -  ',
};

// Set once the arguments are known: true when this is the packaged build and
// nobody passed any, which is what a double-click looks like from in here.
let doubleClicked = false;

// A double-clicked program gets a console window of its own, and that window
// closes the instant the process does -- so an error printed and exited is a
// black flash and nothing else.  Hold it open long enough to be read.
function holdWindow() {
  process.stderr.write('\nPress Enter to close this window.\n');
  try {
    readSync(0, Buffer.alloc(1), 0, 1, null);
  } catch { /* no console attached; nothing to hold open */ }
}

function die(msg) {
  process.stderr.write(`pokepack: ${msg}\n`);
  if (doubleClicked) holdWindow();
  process.exit(1);
}

function say(s = '') {
  process.stdout.write(`${s}\n`);
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, inline] = a.slice(2).split('=');
      if (inline !== undefined) flags[k] = inline;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) flags[k] = argv[++i];
      else flags[k] = true;
    } else positional.push(a);
  }
  return { positional, flags };
}

async function loadIndex(spec) {
  if (!spec) return [];
  const parts = String(spec).split(',').map((s) => s.trim()).filter(Boolean);
  const feeds = [];
  for (const p of parts) {
    if (/^https?:/.test(p)) feeds.push(await fetchJson(p));
    else if (existsSync(p)) feeds.push(JSON.parse(readFileSync(p, 'utf8')));
    else die(`no such index: ${p}`);
  }
  return feeds;
}

function readPack(path) {
  if (!existsSync(path)) die(`no such pack: ${path}`);
  try {
    return pack.decode(readFileSync(path, 'utf8'));
  } catch (e) {
    die(`${path}: ${e.message}`);
  }
}

// ------- commands

async function cmdBuild({ positional, flags }) {
  const dir = positional[0];
  if (!dir) die('usage: pokepack build <saveDir> [--profile NAME] [--index FILE|URL] [--out FILE] [--pin]');

  const state = readSaveDir(resolvePath(dir));
  if (state.profiles.length === 0) {
    die(`${dir} has no saved profiles -- make one in the launcher first (SAVE CURRENT AS)`);
  }

  const wantName = flags.profile ?? state.activeProfile;
  const profile = wantName
    ? state.profiles.find((p) => p.name === wantName)
    : state.profiles[0];
  if (!profile) {
    die(`no profile named ${wantName}. found: ${state.profiles.map((p) => p.name).join(', ')}`);
  }

  const feeds = await loadIndex(flags.index);
  const index = feeds.length ? indexFromFeeds(feeds) : indexFromCache(state);
  const releasesByRepo = releasesFromCache(state);

  // The launcher only fills options.modUpdateCache once the player has opened
  // the update panel, and a mod that is in no published index has no entry
  // either -- so on a fresh save there is frequently nowhere local to learn a
  // download URL from.  Ask GitHub directly for the repos the manifests name.
  if (!flags.offline) {
    const repos = new Set();
    for (const id of Object.keys(profile.enabled ?? {})) {
      if (profile.enabled[id] !== true) continue;
      const repo = state.mods[id]?.github ?? index[id]?.github;
      if (repo && !releasesByRepo.has(repo)) repos.add(repo);
    }
    for (const repo of repos) {
      process.stdout.write(`  looking up ${repo} ... `);
      try {
        const releases = await fetchReleases(repo);
        releasesByRepo.set(repo, releases);
        say(`${releases.length} releases`);
      } catch (e) {
        say(`failed: ${e.message}`);
      }
    }
    if (repos.size) say('');
  }

  let result;
  try {
    result = build(profile, {
      state,
      index,
      releasesByRepo,
      meta: {
        id: flags.id ?? slugify(profile.name),
        name: flags.name ?? profile.name,
        author: flags.author ?? null,
        summary: flags.summary ?? '',
        engine: flags.engine ?? null,
        createdAt: new Date().toISOString(),
        strict: flags.loose ? false : true,
      },
    });
  } catch (e) {
    for (const w of e.warnings ?? []) say(`  ${w}`);
    if (e.warnings?.length) say('');
    die(e.message);
  }

  const { pack: built, warnings } = result;

  if (flags.pin) {
    say('pinning (downloading each mod once to hash it) ...');
    const { failures } = await pin(built, {
      hashUrl,
      onStart: (m) => process.stdout.write(`  ${m.id} ... `),
      onDone: (m, res, err) => say(err ? `failed: ${err.message}` : `${res.sha256.slice(0, 12)} (${res.size} bytes)`),
    });
    for (const f of failures) warnings.push(`${f.id}: could not be pinned -- ${f.reason}`);
  }

  let text;
  try {
    text = pack.encode(built);
  } catch (e) {
    die(`the pack that came out is not valid: ${e.message}`);
  }

  const out = flags.out ?? `${built.id}${pack.EXT}`;
  if (out === '-') say(text);
  else {
    writeFileSync(out, text);
    say(`wrote ${out}  (${built.mods.length} mods, ${built.disable.length} to disable)`);
  }

  const missing = pack.unpinned(built);
  if (missing.length) {
    say('');
    say(`unpinned: ${missing.join(', ')}`);
    say('  run again with --pin to lock these to exact bytes.');
  }
  for (const w of warnings) say(`  warning: ${w}`);
}

async function planFor(p, flags) {
  const state = flags.save ? readSaveDir(resolvePath(flags.save)) : { mods: {} };
  const feeds = await loadIndex(flags.index);
  const index = feeds.length ? indexFromFeeds(feeds) : (flags.save ? indexFromCache(state) : {});
  const broken = flags.broken ? String(flags.broken).split(',').map((s) => s.trim()) : [];
  return { state, index, result: plan(p, state, index, { broken }) };
}

async function cmdResolve({ positional, flags }) {
  const p = readPack(positional[0] ?? die('usage: pokepack resolve <pack> [--save DIR] [--index FILE|URL]'));
  const { result } = await planFor(p, flags);
  if (flags.json) return say(JSON.stringify(result, null, 2));

  say(`${p.name}${p.author ? `  by ${p.author}` : ''}`);
  if (p.summary) say(p.summary);
  say('');

  for (const row of result.mods) {
    const label = row.status === RECONCILE
      ? `${row.id}  ${row.have} -> ${row.want} (${row.direction})`
      : `${row.id}${row.want ? `  ${row.want}` : ''}`;
    say(`${MARK[row.status]}${label}`);
    if (row.reason) say(`      ${row.reason}`);
  }

  for (const d of result.disable) {
    if (d.status === 'turn-off') say(` !  ${d.id}  must be switched off for this pack`);
  }

  if (result.conflicts.length) {
    say('');
    for (const c of result.conflicts) say(` !  ${c.text}`);
  }

  say('');
  const s = result.summary;
  say(`${s.ok} ready, ${s.install} to install, ${s.reconcile} to reconcile, ` +
      `${s.unavailable} unavailable, ${s.blocked} blocked`);
  if (!result.cascadeChecked) {
    say('no index given, so dependency and conflict checks did not run (pass --index)');
  }
  if (!result.canActivate) {
    say('');
    say(`this pack cannot be activated: ${p.mods.length - s.ok - s.install - s.reconcile} of ` +
        `${p.mods.length} mods will not resolve, and most of a tested setup is not a tested setup.`);
    say('pass --loose when building if a pack should activate anyway.');
  }
}

// Download a pack's mods and verify them, into a folder -- not into the game.
//
// The launcher already owns installing: every zip goes through the same
// validated path "Import mod .zip" uses.  Writing into someone's mods/ folder
// from out here would be a second, worse installer that skips those checks, so
// this stops at "here are the verified files" and hands over.
async function cmdFetch({ positional, flags }) {
  const p = readPack(positional[0] ?? die('usage: pokepack fetch <pack> [--save DIR] [--out DIR]'));
  const { result } = await planFor(p, flags);

  if (!result.canActivate && !flags.force) {
    say(`${result.summary.unavailable + result.summary.blocked} of ${p.mods.length} mods will not resolve.`);
    for (const row of result.mods) {
      if (row.status === UNAVAILABLE || row.status === BLOCKED) say(`  ${row.id}: ${row.reason}`);
    }
    die('refusing to fetch a pack that cannot be completed -- pass --force to get the rest anyway');
  }

  const outDir = resolvePath(flags.out ?? join('downloads', p.id));
  mkdirSync(outDir, { recursive: true });

  if (result.fetchable.length === 0) return say('nothing to fetch -- everything is already at the right version.');

  let failed = 0;
  for (const row of result.fetchable) {
    const name = `${row.id}-${row.want ?? 'unknown'}.zip`;
    process.stdout.write(`  ${name} ... `);
    try {
      const { buffer, sha256, size } = await downloadToBuffer(row.source.url);
      if (row.wantHash && sha256 !== row.wantHash) {
        failed++;
        say('REJECTED');
        say(`      the file downloaded, but its contents are not what this pack pinned.`);
        say(`      expected ${row.wantHash}`);
        say(`      got      ${sha256}`);
        continue;
      }
      writeFileSync(join(outDir, name), buffer);
      say(`${size} bytes${row.wantHash ? ', hash verified' : ', UNVERIFIED (pack is unpinned)'}`);
    } catch (e) {
      failed++;
      say(`failed: ${e.message}`);
    }
  }

  say('');
  say(`files are in ${outDir}`);
  say('import them with the launcher\'s "Import mod .zip", then apply the pack\'s settings.');
  const off = result.disable.filter((d) => d.status === 'turn-off');
  if (off.length) say(`then switch off: ${off.map((d) => d.id).join(', ')}`);
  if (failed) process.exit(2);
}

async function cmdValidate({ positional, flags }) {
  if (positional.length === 0) die('usage: pokepack validate <pack...> [--deep] [--json]');
  const reports = [];
  for (const path of positional) {
    const p = readPack(path);
    const report = await validatePack(p, { deep: !!flags.deep });
    reports.push(report);
    if (!flags.json) {
      const mark = { [LIVE]: 'live', [CHANGED]: 'CHANGED', [BROKEN]: 'BROKEN' }[report.status];
      say(`${mark.padEnd(8)}${report.name}  (${report.counts.live} live, ` +
          `${report.counts.changed} changed, ${report.counts.broken} broken)`);
      for (const m of report.mods) {
        if (m.status !== LIVE) say(`          ${m.id}: ${m.reason}`);
      }
    }
  }
  if (flags.json) say(JSON.stringify(reports, null, 2));
  if (reports.some((r) => r.status !== LIVE)) process.exit(2);
}

function cmdInspect({ positional }) {
  const p = readPack(positional[0] ?? die('usage: pokepack inspect <pack>'));
  say(`${p.name}  (${p.id})`);
  if (p.author) say(`by ${p.author}`);
  if (p.summary) say(p.summary);
  if (p.engine) say(`engine ${p.engine}`);
  say(`${p.strict ? 'strict' : 'loose'} -- ${p.strict ? 'will not activate unless every mod resolves' : 'will activate partially resolved'}`);
  say('');
  for (const m of p.mods) {
    say(`${m.id}  ${m.version ?? '(unversioned)'}`);
    say(`  ${m.source.sha256 ? `sha256 ${m.source.sha256}` : 'UNPINNED -- no hash'}`);
    say(`  ${m.source.url}`);
    const opts = Object.entries(m.options);
    if (opts.length) say(`  settings: ${opts.map(([k, v]) => `${k}=${v}`).join(', ')}`);
    if (m.priority !== undefined) say(`  load order override: ${m.priority}`);
    if (m.notes) say(`  note: ${m.notes}`);
  }
  if (p.disable.length) {
    say('');
    say(`must be off: ${p.disable.join(', ')}`);
  }
}

async function cmdHash({ positional }) {
  const url = positional[0] ?? die('usage: pokepack hash <url>');
  const { sha256, size } = await hashUrl(url);
  say(`${sha256}  ${size} bytes`);
}

async function cmdInstall({ positional, flags }) {
  const p = readPack(positional[0] ?? die('usage: pokepack install <pack> --save DIR'));
  if (!flags.save) die('install needs --save <your gen1recomp folder>');
  const { state, index, result } = await planFor(p, flags);

  if (!result.canActivate && !flags.force) {
    for (const row of result.mods) {
      if (row.status === UNAVAILABLE || row.status === BLOCKED) say(`  ${row.id}: ${row.reason}`);
    }
    die('this pack cannot be completed, so nothing was installed (--force overrides)');
  }

  const cfg = await import('../src/config.js');
  const out = await apply(p, {
    saveDir: resolvePath(flags.save),
    state,
    index,
    force: !!flags.force,
    applyLive: !flags['no-apply'],
    exePath: flags.exe ?? cfg.read().gamePath ?? null,
    onEvent: (ev) => {
      if (ev.type === 'start') say(`downloading ${ev.id} ${ev.version ?? ''}`);
      else if (ev.type === 'done') {
        say(`  installed ${ev.id} ${ev.version} (${ev.files} files)`);
        if (ev.backedUp) say(`  old copy moved to ${ev.backedUp}`);
      } else if (ev.type === 'failed') say(`  FAILED ${ev.id}: ${ev.reason}`);
      else if (ev.type === 'profile') say(`wrote ${ev.path}`);
      else if (ev.type === 'live') {
        say(ev.applied ? 'applied to options.lua (old copy kept alongside it)'
          : `not applied directly: ${ev.reason}`);
      }
    },
  });

  say('');
  if (out.live?.applied) {
    say('Ready to play -- the mods are on and the settings are set.');
  } else if (out.profile) {
    say(`Open gen1recomp -> MODS -> IMPORT PROFILE and pick "${out.profile.name}".`);
    say('That switches the right mods on, applies every setting, and turns off the ones that clash.');
  }
  if (out.failed.length) process.exit(2);
}

function cmdFeed({ positional, flags }) {
  const dir = positional[0] ?? 'packs';
  const entries = loadPacks(dir);
  const feed = buildFeed(entries, { generatedAt: new Date().toISOString() });
  const text = `${JSON.stringify(feed, null, 2)}\n`;
  if (flags.out && flags.out !== '-') {
    writeFileSync(flags.out, text);
    say(`wrote ${flags.out}  (${feed.counts.total} packs)`);
  } else say(text);
  for (const r of feed.rejected) say(`  rejected ${r.file}: ${r.reason}`);
}

/**
 * pokepack gallery --repo owner/name [--out data/packs.json] [--dry-run]
 *
 * What CI runs: open a discussion thread for any pack that has not got one,
 * read the thumbs-up counts off all of them, and publish the list with those
 * counts folded in.  Everything about voting lives on GitHub; this only reads
 * it and writes a number into a file.
 */
async function cmdGallery({ positional, flags }) {
  const dir = positional[0] ?? 'packs';
  const repo = flags.repo ?? process.env.GITHUB_REPOSITORY
    ?? die('usage: pokepack gallery [packsDir] --repo owner/name [--out FILE] [--dry-run]');
  const token = flags.token ?? process.env.GITHUB_TOKEN ?? null;

  const { github, listPackIssues, syncIssues, votesFrom } = await import('../src/votes.js');
  const entries = loadPacks(dir);
  const packs = entries.filter((e) => !e.error).map((e) => e.pack);
  const api = github({ repo, token });

  let existing = [];
  let votes = {};
  try {
    existing = await listPackIssues(api);
    votes = votesFrom(existing);
    say(`${existing.length} pack thread${existing.length === 1 ? '' : 's'} on ${repo}`);
  } catch (e) {
    // A gallery that cannot be published because GitHub had a bad minute is
    // worse than one published with yesterday's counts.
    say(`could not read votes (${e.message}) -- publishing without them`);
  }

  if (token) {
    try {
      const { created, skipped } = await syncIssues({
        api, packs, existing, dryRun: flags['dry-run'] === true, indexUrl: flags['index-url'] ?? null,
      });
      for (const c of created) say(`  opened a thread for ${c.id}${c.number ? ` (#${c.number})` : ' (dry run)'}`);
      if (skipped) say(`  ${skipped} already had one`);
    } catch (e) {
      say(`could not open threads: ${e.message}`);
    }
  } else {
    say('no token, so no threads were opened -- counts only');
  }

  // Every entry needs an absolute https URL to the recipe, or the hub on
  // somebody else's machine has nothing to fetch.
  const baseUrl = flags['base-url'] ?? pagesBase(repo);
  const feed = buildFeed(entries, { votes, baseUrl, generatedAt: new Date().toISOString() });
  const text = `${JSON.stringify(feed, null, 2)}\n`;
  if (flags.out && flags.out !== '-') {
    mkdirSync(dirname(resolvePath(flags.out)), { recursive: true });
    writeFileSync(flags.out, text);
    const voted = feed.packs.filter((p) => p.votes > 0).length;
    say(`wrote ${flags.out}  (${feed.counts.total} packs, ${voted} with votes)`);
    say(`  recipes will be served from ${baseUrl}`);
  } else say(text);
  for (const r of feed.rejected) say(`  rejected ${r.file}: ${r.reason}`);
}

async function cmdUi({ flags }) {
  const { serve } = await import('../src/ui.js');
  const { defaultPacksDir } = await import('../src/packaged.js');
  let started;
  try {
    started = await serve({
      // A checkout resolves this against the working directory; the exe
      // resolves it against itself, because a double-clicked program has no
      // working directory anybody chose.
      packsDir: resolvePath(flags.packs ?? defaultPacksDir()),
      saveDir: flags.save ? resolvePath(flags.save) : null,
      indexFile: flags.index ? resolvePath(flags.index) : null,
      port: Number(flags.port ?? 7666),
    });
  } catch (e) {
    die(e.message);
  }
  const { url, movedFrom } = started;
  if (movedFrom) say(`port ${movedFrom} was busy (another hub is probably still running)`);
  say(`pokepack hub running at ${url}`);
  say('it will ask which game folder to use on first run.');
  say('ctrl-c to stop.');
  if (!flags['no-open']) {
    const { spawn } = await import('node:child_process');
    const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    try { spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' }).unref(); } catch { /* browse by hand */ }
  }
}

async function cmdInstance({ positional, flags }) {
  const identity = positional[0]
    ?? die('usage: pokepack instance <name> [--pack <pack>] [--exe <gen1recomp.exe>]');
  const { createInstance, writeLauncher, checkGameExe, romSources, seedRomData } = await import('../src/instance.js');
  const cfg = await import('../src/config.js');

  let exePath = flags.exe ?? cfg.read().gamePath ?? null;
  if (exePath) {
    const check = checkGameExe(exePath);
    if (!check.ok) die(`game executable: ${check.reason}`);
    exePath = check.path;
  }

  let seededOk = false;
  const made = createInstance({ identity });
  say(`created ${made.path}`);

  // Without unpacked ROM data the game cannot get past its title screen.
  const sources = romSources();
  const seedName = flags['seed-from'] ?? (flags['no-seed'] ? null : sources[0]?.identity);
  if (seedName) {
    const src = sources.find((r) => r.identity === seedName || r.path === seedName);
    if (!src) die(`no instance with game data called ${seedName}`);
    const { copied } = seedRomData(src.path, made.path);
    seededOk = copied.length > 0;
    say(`copied game data (${copied.join(', ')}) from ${src.identity}`);
  } else {
    say('no game data copied -- the game will ask for your ROM');
  }

  if (exePath) {
    cfg.write({ gamePath: exePath });
    const { path } = writeLauncher({
      identity: made.identity, exePath, outDir: 'launchers', packName: flags.pack ?? null,
    });
    say(`launcher ${path}`);
  } else {
    say('no --exe given, so no launcher was written');
    say(`set POKEPORT_IDENTITY=${made.identity} before starting the game to use it`);
  }

  if (flags.pack) {
    const p = readPack(flags.pack);
    const out = await apply(p, {
      saveDir: made.path,
      state: { mods: {} },
      index: {},
      onEvent: (ev) => {
        if (ev.type === 'start') say(`downloading ${ev.id} ${ev.version ?? ''}`);
        else if (ev.type === 'done') say(`  installed ${ev.id} ${ev.version}`);
        else if (ev.type === 'failed') say(`  FAILED ${ev.id}: ${ev.reason}`);
        else if (ev.type === 'profile') say(`wrote ${ev.path}`);
      },
    });
    if (out.failed.length) process.exit(2);
  }

  say('');
  say(seededOk
    ? `Ready. Play it with: pokepack ui, or run launchers/play-${made.identity}.cmd`
    : 'This instance has no game data, so the game will ask for your ROM the first time.');
}

async function cmdAndroid({ positional, flags }) {
  const dir = positional[0];
  if (!dir) die('usage: pokepack android <saveDir> [--out FILE] [--name "Pack name"]');

  const android = await import('../src/android.js');
  const saveDir = resolvePath(dir);

  const preview = android.plan(saveDir);
  const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
  say(`${preview.files.length} files, ${mb(preview.bytes)} before compression`);
  for (const l of preview.left) say(`  leaving ${l.name} -- ${l.why}`);

  const { buffer, files } = android.bundle(saveDir, { packName: flags.name ?? null });
  const out = resolvePath(flags.out ?? `${dir.replace(/[\\/]+$/, '').split(/[\\/]/).pop()}-android.zip`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buffer);

  say('');
  say(`wrote ${out}  (${files.length + 1} entries, ${mb(buffer.length)})`);
  say(`extract it into the game's save folder on the device, so that mods/ and`);
  say(`options.lua sit directly inside. ${android.NOTES} in the zip says where that is.`);
}

function cmdHelp() {
  say(`pokepack -- modpack recipes for gen1recomp

  build <saveDir>      turn a saved profile into a pack
                       --offline       do not ask GitHub for release URLs
                       --profile NAME  --index FILE|URL  --out FILE
                       --pin           download each mod once to lock its hash
                       --loose         let the pack activate partially resolved
  resolve <pack>       what installing this pack would do, before it does it
                       --save DIR      compare against a real install
                       --index FILE|URL
                       --broken A,B    treat these as unreachable (from CI)
  fetch <pack>         download this pack's mods and verify them
                       --save DIR      only fetch what is missing or wrong
                       --out DIR       where to put them (default downloads/<id>)
                       --force         fetch even if the pack cannot complete
  validate <pack...>   do the links still work?  (--deep also verifies hashes)
  install <pack>       download, verify and install it  --save DIR
  ui                   browse and install in your browser  --save DIR --packs DIR
  instance <name>      make an isolated copy of the game  --pack P --exe PATH
                       --seed-from ID  copy game data from that instance
                       --no-seed       start with no game data
  android <saveDir>    zip a setup's mods and settings for an Android handheld
                       --out FILE      --name "Pack name"
  feed [packsDir]      generate packs.json for a gallery  --out FILE
  gallery [packsDir]   feed + open a thread per pack + fold in the vote counts
                       --repo owner/name  --out FILE  --token X  --dry-run
  inspect <pack>       print a pack in full
  hash <url>           sha256 of a file, for filling a source in by hand

A pack points at each author's own downloads.  It hosts nothing.`);
}

const [, , cmd, ...rest] = process.argv;
const args = parseArgs(rest);

const commands = {
  build: cmdBuild, resolve: cmdResolve, fetch: cmdFetch, install: cmdInstall,
  validate: cmdValidate, inspect: cmdInspect, hash: cmdHash, feed: cmdFeed, ui: cmdUi,
  instance: cmdInstance, gallery: cmdGallery, android: cmdAndroid,
};

// Wrapped in a function rather than run at the top level, because a top-level
// await cannot be bundled into the single executable (build/exe.mjs), and the
// exe is how most people will meet this.  Identical behaviour either way.
async function main() {
  // No arguments means two different things depending on how you got here.
  // At a prompt you typed a name and want to know what it does, so: help.
  // Double-clicked, there is no prompt to read help at and the window shuts
  // before you could -- what you wanted was the program.  So the packaged
  // build with no arguments starts the hub, and `pokepack help` still prints
  // help for anyone who asks for it by name.
  const { isPackaged } = await import('../src/packaged.js');
  doubleClicked = isPackaged() && !cmd;

  try {
    if (doubleClicked) await cmdUi({ flags: {} });
    else if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') cmdHelp();
    else if (cmd === 'version' || cmd === '--version' || cmd === '-v') {
      // Matters more for the exe than the checkout: a file somebody was handed
      // months ago cannot be identified by looking at the folder it came in.
      const { currentVersion } = await import('../src/update.js');
      say(currentVersion() ?? 'unknown');
    } else if (commands[cmd]) await commands[cmd](args);
    else die(`unknown command ${cmd}. try: pokepack help`);
  } catch (e) {
    die(e.message);
  }
}

main();
