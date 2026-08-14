// The local hub.
//
// One idea runs through all of it: there is an **active instance**, and
// everything is scoped to it.  You pick a setup in My packs, the Mods tab shows
// that setup's mods, and Play launches that setup.  No hidden "current folder"
// setting doing double duty.
//
// A "pack" in the UI is an instance -- your own isolated copy of the game, with
// its own mods, saves and settings.  The shareable .pokepack file is a recipe
// you *export* from one or *install* to create another; it is not the thing you
// play.
//
// Runs locally so it can reach your game folder, which a web page never can.
// Bound to 127.0.0.1 and gated on a token, because this process writes files.

import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';

import { readSaveDir, indexFromCache, indexFromFeeds, releasesFromCache } from './state.js';
import { loadPacks, buildFeed, submitUrl } from './feed.js';
import { encode, decode, unpinned, EXT } from './packformat.js';
import { apply } from './apply.js';
import { removeMod } from './uninstall.js';
import { installMod, backupRoot } from './install.js';
import { setModEnabled } from './liveapply.js';
import { build, pin, slugify, gatherReleases } from './build.js';
import { fetchReleases, hashUrl, downloadToBuffer } from './net.js';
import { findSaveDirs, checkSaveDir, saveRoots, cleanPath } from './discover.js';
import {
  createInstance, writeLauncher, checkGameExe, launchGame,
  romSources, seedRomData, romVersionsIn, validIdentity,
  describeInstance, trashInstance, TRASH_DIR,
} from './instance.js';
import { identifyRom, linkRom, baseromsIn } from './rom.js';
import { pickFile, pickFolder, FILTERS } from './filepicker.js';
import * as catalogue from './catalogue.js';
import * as deps from './deps.js';
import { resolveDownload } from './github.js';
import * as update from './update.js';
import * as logs from './logs.js';
import * as gallery from './packfeed.js';
import * as config from './config.js';
import { page } from './ui-page.js';

function json(res, code, payload) {
  const text = JSON.stringify(payload);
  res.writeHead(code, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
  });
  res.end(text);
}

function readBody(req) {
  return new Promise((done) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      try {
        done(raw ? JSON.parse(raw) : {});
      } catch {
        done(null);
      }
    });
  });
}

export function serve({ packsDir, saveDir, indexFile, port = 7666, host = '127.0.0.1' }) {
  const token = randomBytes(16).toString('hex');

  const feeds = indexFile && existsSync(indexFile)
    ? [JSON.parse(readFileSync(indexFile, 'utf8'))]
    : [];

  // Stored by identity rather than path, so it stays meaningful even if LOVE's
  // save root moves.
  let active = config.read().activeInstance ?? null;

  function activeInstance() {
    const all = findSaveDirs();
    if (all.length === 0) return null;
    return all.find((i) => i.identity === active)
      ?? (saveDir ? all.find((i) => i.path === saveDir) : null)
      ?? all[0];
  }

  function setActive(identity) {
    active = identity;
    config.write({ activeInstance: identity });
  }

  function stateOf(dir) {
    try {
      return dir ? readSaveDir(dir) : { mods: {} };
    } catch {
      return { mods: {} };
    }
  }

  // Give a new instance what it needs to boot: unpacked data copied from an
  // instance you already play (instant, skips the game's import step), else the
  // ROM linked in Settings.
  async function giveGameData(path) {
    // Never seed from the folder being repaired -- romSources() lists every
    // instance including this one, and copying a folder onto itself is at best
    // a no-op reported as success.
    const src = romSources().find((s) => s.path !== path);
    if (src) {
      try {
        const { copied } = seedRomData(src.path, path);
        if (copied.length) return { how: 'copied', from: src.identity, versions: copied };
      } catch { /* fall through to the ROM */ }
    }
    const romPath = config.read().romPath;
    if (romPath) {
      try {
        const r = linkRom(romPath, path);
        return { how: 'rom', label: r.label };
      } catch (e) {
        return { how: 'none', reason: e.message };
      }
    }
    return { how: 'none', reason: 'no ROM linked in Settings' };
  }

  // The published gallery, if one is configured.  Never fatal: a gallery that
  // is unreachable should cost you the list, not the app.
  // Fixed in code, not read from config: see the note in packfeed.js.  Any
  // packIndexUrl left in an old config file is ignored rather than obeyed.
  const galleryUrl = () => gallery.OFFICIAL_GALLERY;

  async function galleryPacks({ force = false } = {}) {
    const url = galleryUrl();
    if (!url) return [];
    try {
      const g = await gallery.load({ url, force });
      return g.packs.map((p) => ({ ...p, origin: 'gallery' }));
    } catch {
      return [];
    }
  }

  function maybeLauncher(identity) {
    const exePath = config.read().gamePath;
    if (!exePath) return null;
    try {
      return writeLauncher({ identity, exePath, outDir: join(packsDir, '..', 'launchers') });
    } catch {
      return null;
    }
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${host}:${port}`);

    if (url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(page(token));
    }

    if (url.searchParams.get('token') !== token) {
      return json(res, 403, { error: 'bad or missing token' });
    }

    // ------- one request draws the whole UI

    if (url.pathname === '/api/state') {
      const all = findSaveDirs();
      const act = activeInstance();
      const cfg = config.read();

      return json(res, 200, {
        active: act ? act.identity : null,
        activePath: act ? act.path : null,
        instances: all.map((i) => ({
          identity: i.identity,
          path: i.path,
          mods: i.mods,
          fromPacks: Object.keys(i.packs ?? {}),
          isDefault: i.isDefault,
          hasGameData: romVersionsIn(i.path).length > 0 || baseromsIn(i.path).length > 0,
          modList: Object.values(stateOf(i.path).mods)
            .map((m) => ({ id: m.id, version: m.version, enabled: m.enabled }))
            .sort((a, b) => (a.id < b.id ? -1 : 1)),
        })),
        recipes: buildFeed(loadPacks(packsDir)).packs.map((p) => ({ ...p, origin: 'local' })),
        // The gallery is cached for six hours, which is right for a page that
        // reloads constantly and wrong for "I just merged it, where is it" --
        // so Community offers a way to ask now.
        gallery: await galleryPacks({ force: url.searchParams.get('refresh') === '1' }),
        galleryUrl: galleryUrl(),
        settings: {
          gamePath: cfg.gamePath ?? null,
          romPath: cfg.romPath ?? null,
          // Shown so you can see where packs come from; not editable here.
          packIndexUrl: galleryUrl(),
          submitRepo: gallery.OFFICIAL_REPO,
          configPath: config.configPath(),
        },
      });
    }

    // One recipe in full: what it installs, pinned to what, and how that
    // compares to the setup you are on.
    if (url.pathname === '/api/pack') {
      const wanted = url.searchParams.get('id');
      const entry = loadPacks(packsDir).find((e) => !e.error && e.pack.id === wanted);
      let p = entry?.pack ?? null;
      let fileLabel = entry?.name ?? null;
      let listed = null;
      if (!p) {
        // Not on disk -- try the gallery, fetching and validating the recipe.
        listed = (await galleryPacks()).find((g) => g.id === wanted);
        if (!listed) return json(res, 404, { error: 'no such pack' });
        try {
          p = await gallery.fetchPack(listed.url);
          fileLabel = listed.url;
        } catch (e) {
          return json(res, 502, { error: e.message });
        }
      }

      const act = activeInstance();
      const installed = act ? stateOf(act.path).mods : {};

      // Titles and authors come from the catalogue when it knows the mod; a
      // bare id is not much use when you are deciding whether to install.
      let known = new Map();
      try {
        const cat = await catalogue.load({ url: config.read().indexUrl || catalogue.OFFICIAL_INDEX });
        known = new Map(cat.mods.map((m) => [m.id, m]));
      } catch { /* offline: ids only */ }

      return json(res, 200, {
        id: p.id,
        name: p.name,
        author: p.author,
        summary: p.summary,
        engine: p.engine,
        strict: p.strict,
        createdAt: p.createdAt,
        file: fileLabel,
        origin: entry ? 'local' : 'gallery',
        // Popularity, from the gallery's own count -- never from the recipe.  A
        // vote inside the file would change the pack's bytes, and the bytes are
        // its identity.
        votes: listed?.votes ?? 0,
        comments: listed?.comments ?? 0,
        thread: listed?.thread ?? null,
        status: listed?.status ?? 'unknown',
        disable: p.disable,
        slots: p.slots,
        activeInstance: act ? act.identity : null,
        mods: p.mods.map((m) => {
          const cat = known.get(m.id);
          let host = null;
          try {
            host = new URL(m.source.url).host;
          } catch { /* a pack that failed validation never gets here */ }
          return {
            id: m.id,
            version: m.version,
            title: cat?.title ?? m.id,
            author: cat?.author ?? null,
            summary: cat?.summary ?? '',
            categories: cat?.categories ?? [],
            listed: !!cat,
            pinned: !!m.source.sha256,
            sha256: m.source.sha256 ?? null,
            size: m.source.size ?? null,
            host,
            options: m.options,
            notes: m.notes ?? null,
            haveVersion: installed[m.id]?.version ?? null,
          };
        }),
      });
    }

    // The app's own version.  Nothing to do with the pack list, which updates
    // itself -- this is code on disk and only a pull changes it.
    if (url.pathname === '/api/update') {
      if (req.method === 'POST') {
        try {
          return json(res, 200, update.pull());
        } catch (e) {
          return json(res, 400, { error: e.message });
        }
      }
      const out = await update.check({ force: url.searchParams.get('refresh') === '1' });
      return json(res, 200, { ...out, checkout: update.status() });
    }

    // What the game said last time it ran, for whichever pack you name.
    if (url.pathname === '/api/logs') {
      const wanted = url.searchParams.get('identity');
      const found = wanted
        ? findSaveDirs().find((i) => i.identity === wanted)
        : activeInstance();
      if (!found) return json(res, 404, { error: `no pack called ${wanted}` });
      const out = logs.readLogs(found.path);
      return json(res, 200, {
        identity: found.identity,
        path: found.path,
        ...out,
        // Pulled out so the screen can lead with what went wrong rather than
        // making somebody read a thousand lines of startup chatter.
        notable: out.sources.flatMap((s) => logs.interesting(s.text)
          .map((n) => ({ ...n, from: s.label }))).slice(-40),
        // From the most recent run that recorded any: what loaded, in the order
        // it loaded.  When two mods fight over the same thing, which one ran
        // second is usually the answer.
        loadOrder: out.sources.map((s) => logs.loadOrder(s.text)).find((o) => o.length) ?? [],
      });
    }

    if (url.pathname === '/api/activate' && req.method === 'POST') {
      const opts = await readBody(req);
      if (!opts) return json(res, 400, { error: 'bad request body' });
      const found = findSaveDirs().find((i) => i.identity === opts.identity);
      if (!found) return json(res, 404, { error: `no instance called ${opts.identity}` });
      setActive(found.identity);
      return json(res, 200, { active: found.identity, path: found.path });
    }

    // ------- mods, always scoped to the active instance

    if (url.pathname === '/api/catalogue') {
      const act = activeInstance();
      let cat;
      try {
        cat = await catalogue.load({
          url: config.read().indexUrl || catalogue.OFFICIAL_INDEX,
          force: url.searchParams.get('refresh') === '1',
        });
      } catch (e) {
        return json(res, 502, { error: e.message });
      }

      const installed = act ? stateOf(act.path).mods : {};
      const q = (url.searchParams.get('q') ?? '').trim();
      const filter = url.searchParams.get('filter') ?? 'all';

      // What the game will complain about on the next launch, worked out from
      // the installed manifests rather than the index -- these are the files it
      // will actually read.
      const health = deps.check(installed);
      // Worked out the way the engine does, so it can be shown before you play
      // rather than only read back from a log afterwards.
      const { order, brokenLoop } = deps.loadOrder(installed);
      const orderIndex = new Map(order.map((m, i) => [m.id, i + 1]));
      const orderWhy = new Map(order.map((m) => [m.id, m.why]));

      let mods = catalogue.search(cat.mods, q).map((m) => {
        const src = catalogue.installableFrom(m);
        const have = installed[m.id];
        const h = health[m.id];
        return {
          ...m,
          installable: !!src,
          latestVersion: src?.version ?? m.version ?? null,
          installedVersion: have?.version ?? null,
          enabled: have ? have.enabled : null,
          missing: h?.missing ?? [],
          wrongVersion: h?.wrongVersion ?? [],
          clashes: h?.clashes ?? [],
        };
      });

      // Installed but unlisted -- your own mods.  Omitting them would make the
      // Mods tab lie about what this instance actually contains.
      const listed = new Set(cat.mods.map((m) => m.id));
      const needle = q.toLowerCase();
      for (const m of Object.values(installed)) {
        if (listed.has(m.id)) continue;
        if (needle && !m.id.toLowerCase().includes(needle)) continue;
        const h = health[m.id];
        mods.push({
          id: m.id, title: m.id, author: null, summary: '', categories: [],
          github: m.github, installable: false, unlisted: true,
          latestVersion: null, installedVersion: m.version, enabled: m.enabled,
          missing: h?.missing ?? [], wrongVersion: h?.wrongVersion ?? [], clashes: h?.clashes ?? [],
        });
      }

      if (filter === 'installed') mods = mods.filter((m) => m.installedVersion);
      else if (filter === 'available') mods = mods.filter((m) => !m.installedVersion);

      // Counted before the category filter is applied, so each chip says how
      // many you would get by ticking it.  Counting afterwards would zero every
      // other chip the moment you picked one.
      const categories = catalogue.facets(mods);

      const wanted = (url.searchParams.get('category') ?? '')
        .split(',').map((c) => c.trim()).filter(Boolean);
      mods = catalogue.byCategory(mods, wanted);

      mods.sort((a, b) => (a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1));

      return json(res, 200, {
        active: act ? act.identity : null,
        generatedAt: cat.generatedAt,
        stale: cat.stale ?? false,
        total: cat.mods.length,
        installedCount: Object.keys(installed).length,
        categories,
        selected: wanted,
        loadOrder: order,
        brokenLoop,
        mods: mods.map((m) => ({
          ...m,
          loadsAt: orderIndex.get(m.id) ?? null,
          loadWhy: orderWhy.get(m.id) ?? null,
        })),
      });
    }

    if (url.pathname === '/api/mod' && req.method === 'POST') {
      const opts = await readBody(req);
      if (!opts) return json(res, 400, { error: 'bad request body' });
      const act = activeInstance();
      if (!act) return json(res, 400, { error: 'no active instance' });
      const exePath = config.read().gamePath ?? null;

      if (opts.action === 'enable' || opts.action === 'disable') {
        return json(res, 200, setModEnabled(act.path, opts.id, opts.action === 'enable', { exePath }));
      }
      if (opts.action === 'remove') {
        try {
          return json(res, 200, removeMod(act.path, opts.id, { exePath }));
        } catch (e) {
          return json(res, 400, { error: e.message });
        }
      }

      // Install: the caller names a mod id.  The URL comes from the catalogue,
      // never from the request.
      try {
        const cat = await catalogue.load({ url: config.read().indexUrl || catalogue.OFFICIAL_INDEX });
        const entry = cat.mods.find((m) => m.id === opts.id);
        if (!entry) return json(res, 404, { error: `${opts.id} is not in the catalogue` });
        const src = catalogue.installableFrom(entry);
        if (!src) return json(res, 409, { error: `${entry.title} publishes no installable download` });

        // What else this mod needs, and what it would fight with.  Answered
        // before anything downloads, so the choice is made with the facts
        // rather than discovered by the game an hour later.
        const have = stateOf(act.path).mods;
        const wants = deps.parseDeps(entry.dependencies)
          .filter((d) => !have[d.id])
          .map((d) => {
            const dep = cat.mods.find((m) => m.id === d.id);
            const depSrc = dep ? catalogue.installableFrom(dep) : null;
            return {
              id: d.id,
              range: d.range,
              title: dep?.title ?? d.id,
              version: depSrc?.version ?? dep?.version ?? null,
              installable: !!depSrc,
            };
          });
        const clashes = deps.check({ ...have, [entry.id]: entry })[entry.id]?.clashes ?? [];

        if ((wants.length || clashes.length) && opts.acknowledged !== true) {
          return json(res, 409, {
            needsDeps: wants.length > 0,
            hasClashes: clashes.length > 0,
            id: entry.id,
            title: entry.title,
            dependencies: wants,
            clashes,
            error: wants.length
              ? `${entry.title} needs ${wants.map((w) => w.id).join(', ')}`
              : `${entry.title} conflicts with ${clashes.join(', ')}`,
          });
        }

        // Dependencies first, so the mod is never on disk in a state the game
        // will refuse to load.  A dependency that fails stops the whole thing.
        const alsoInstalled = [];
        if (opts.withDeps === true) {
          for (const want of wants) {
            if (!want.installable) continue;
            const dep = cat.mods.find((m) => m.id === want.id);
            const depSrc = catalogue.installableFrom(dep);
            const got = await downloadToBuffer(depSrc.url);
            const done = installMod(got.buffer, {
              saveDir: act.path, expectId: dep.id, sha256: got.sha256,
            });
            setModEnabled(act.path, dep.id, true, { exePath });
            alsoInstalled.push({ id: done.id, version: done.version });
          }
        }

        const { buffer, sha256, size } = await downloadToBuffer(src.url);
        const out = installMod(buffer, {
          saveDir: act.path, expectId: entry.id, sha256, replace: opts.replace === true,
        });
        return json(res, 200, { ...out, sha256, bytes: size, alsoInstalled });
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
    }

    // Install a mod from a .zip on this machine -- your own work, a beta
    // somebody sent you, anything the catalogue has never heard of.  Same
    // installer as everything else, so the manifest is still validated and a
    // zip whose id does not match its folder is still refused.
    if (url.pathname === '/api/mod/zip' && req.method === 'POST') {
      const act = activeInstance();
      if (!act) return json(res, 400, { error: 'no active instance' });
      const opts = await readBody(req);
      if (!opts) return json(res, 400, { error: 'bad request body' });

      // From a link: a release page or a direct .zip.  Worth having because a
      // mod the index has never heard of is otherwise unpublishable -- the URL
      // is recorded against the install, so exporting a pack that includes it
      // has something real to point at.
      if (opts.url) {
        try {
          const found = await resolveDownload(opts.url, { id: opts.id ?? null });
          const { buffer, sha256, size } = await downloadToBuffer(found.url);
          const out = installMod(buffer, {
            saveDir: act.path,
            sha256,
            replace: opts.replace === true,
            source: { url: found.url, size: size ?? found.size ?? null },
          });
          return json(res, 200, {
            ...out, sha256, bytes: size, from: found.from, source: found.url,
          });
        } catch (e) {
          return json(res, 400, { error: e.message });
        }
      }

      let path = opts.path ?? null;
      if (!path) {
        path = await pickFile({ title: 'Choose a mod .zip', filter: FILTERS.zip });
        if (!path) return json(res, 200, { cancelled: true });
      }

      try {
        const buffer = readFileSync(path);
        const { createHash } = await import('node:crypto');
        const sha256 = createHash('sha256').update(buffer).digest('hex');
        const out = installMod(buffer, {
          saveDir: act.path, sha256, replace: opts.replace === true,
        });
        // No source recorded on purpose: a file on your disk is not something
        // anybody else can fetch, and inventing a URL for it would produce a
        // pack that fails for everyone but you.
        return json(res, 200, { ...out, sha256, from: path, source: null });
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
    }

    // ------- instances

    if (url.pathname === '/api/instance/new' && req.method === 'POST') {
      const opts = await readBody(req);
      if (!opts) return json(res, 400, { error: 'bad request body' });
      const identity = slugify(opts.name ?? '');
      const check = validIdentity(identity);
      if (!check.ok) return json(res, 400, { error: check.reason });

      let made;
      try {
        made = createInstance({ identity });
      } catch (e) {
        return json(res, 400, { error: e.message });
      }

      const gameData = await giveGameData(made.path);
      const launcher = maybeLauncher(made.identity);
      setActive(made.identity);
      return json(res, 200, { ...made, gameData, launcher, active: made.identity });
    }

    // Install a shared recipe -- always into its own new instance, so two packs
    // pinning different versions of the same mod can never collide.
    if (url.pathname === '/api/instance/from-pack') {
      const id = url.searchParams.get('id');
      const local = loadPacks(packsDir).find((e) => !e.error && e.pack.id === id);
      let recipe = local?.pack ?? null;
      if (!recipe) {
        const listed = (await galleryPacks()).find((g) => g.id === id);
        if (!listed) return json(res, 404, { error: `no pack called ${id}` });
        try {
          // Validated on arrival: a gallery listing buys a pack no trust it
          // would not have as a file somebody emailed you.
          recipe = await gallery.fetchPack(listed.url);
        } catch (e) {
          return json(res, 502, { error: e.message });
        }
      }

      const identity = slugify(url.searchParams.get('name') || recipe.id);
      const vcheck = validIdentity(identity);
      if (!vcheck.ok) return json(res, 400, { error: vcheck.reason });
      if (findSaveDirs().some((i) => i.identity === identity)) {
        return json(res, 409, { error: `an instance called ${identity} already exists` });
      }

      res.writeHead(200, {
        'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive',
      });
      const send = (ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`);

      let made;
      try {
        made = createInstance({ identity });
      } catch (e) {
        send({ type: 'error', reason: e.message });
        return res.end();
      }
      send({ type: 'created', path: made.path, identity: made.identity });
      send({ type: 'gameData', ...(await giveGameData(made.path)) });

      try {
        const index = feeds.length ? indexFromFeeds(feeds) : {};
        const out = await apply(recipe, {
          saveDir: made.path, state: { mods: {} }, index,
          exePath: config.read().gamePath ?? null,
          onEvent: send,
        });
        const launcher = maybeLauncher(made.identity);
        setActive(made.identity);
        send({
          type: 'finished', complete: out.complete, active: made.identity, launcher,
          installed: out.installed.map((m) => ({ id: m.id, version: m.version })),
          failed: out.failed,
        });
      } catch (e) {
        send({ type: 'error', reason: e.message });
      }
      return res.end();
    }

    // What deleting a setup would actually take with it.  Read-only, and the
    // page will not offer the button until this has answered.
    if (url.pathname === '/api/instance/preview') {
      const identity = url.searchParams.get('identity');
      const found = findSaveDirs().find((i) => i.identity === identity);
      if (!found) return json(res, 404, { error: `no instance called ${identity}` });

      const d = describeInstance(found.path);
      const check = validIdentity(identity);
      return json(res, 200, {
        identity,
        path: found.path,
        isDefault: found.isDefault,
        isActive: activeInstance()?.identity === identity,
        mods: d.mods,
        saves: d.saves,
        romVersions: d.romVersions,
        files: d.files,
        bytes: d.bytes,
        trash: join(dirname(found.path), TRASH_DIR),
        canDelete: !found.isDefault && check.ok,
        reason: found.isDefault
          ? `${identity} is the game's own save folder -- it is where gen1recomp writes when nothing sets an instance, so pokepack will not remove it`
          : (check.ok ? null : check.reason),
      });
    }

    // Delete a setup.  Nothing is erased: the folder moves to a trash folder
    // beside it, and the confirmation has to match the name exactly.
    if (url.pathname === '/api/instance/delete' && req.method === 'POST') {
      const opts = await readBody(req);
      if (!opts) return json(res, 400, { error: 'bad request body' });

      let out;
      try {
        out = trashInstance({ identity: opts.identity, confirm: opts.confirm });
      } catch (e) {
        return json(res, 400, { error: e.message });
      }

      // If that was the one being played, move to another rather than leaving
      // the header pointing at a folder that is no longer there.
      if (active === out.identity) {
        const next = findSaveDirs()[0] ?? null;
        setActive(next ? next.identity : null);
      }
      return json(res, 200, { ...out, active: activeInstance()?.identity ?? null });
    }

    // Import a pack a friend sent you -- a file on this machine, or a link.
    //
    // Either way it is decoded and validated *before* it is kept, so a file that
    // is not a pack, or is a pack with an http source or a malformed hash, is
    // refused here rather than at install time.  Being handed it by somebody you
    // know buys it exactly as much trust as finding it on the internet: none.
    if (url.pathname === '/api/pack/import' && req.method === 'POST') {
      const opts = await readBody(req);
      if (!opts) return json(res, 400, { error: 'bad request body' });

      let recipe;
      let from;
      try {
        if (opts.url) {
          recipe = await gallery.fetchPack(cleanPath(opts.url));
          from = opts.url;
        } else {
          const path = opts.path
            ? cleanPath(opts.path)
            : await pickFile({ title: 'Choose a .pokepack file', filter: FILTERS.pack });
          if (!path) return json(res, 200, { cancelled: true });
          if (!existsSync(path)) return json(res, 400, { error: `that file does not exist: ${path}` });
          recipe = decode(readFileSync(path, 'utf8'));
          from = path;
        }
      } catch (e) {
        return json(res, 400, { error: e.message, from: opts.url ?? opts.path ?? null });
      }

      const file = join(packsDir, `${recipe.id}${EXT}`);
      const already = loadPacks(packsDir).find((e) => !e.error && e.pack.id === recipe.id);
      if (already && !opts.replace) {
        return json(res, 409, {
          error: `you already have a pack called ${recipe.id} (${already.name})`,
          needsReplace: true,
          id: recipe.id,
        });
      }

      mkdirSync(packsDir, { recursive: true });
      writeFileSync(already ? already.path : file, encode(recipe));
      return json(res, 200, {
        id: recipe.id,
        name: recipe.name,
        mods: recipe.mods.length,
        unpinned: unpinned(recipe),
        file: already ? already.path : file,
        from,
        replaced: !!already,
      });
    }

    // Submitting a pack to the gallery.
    //
    // GitHub's web editor takes the filename and the contents in the URL, so
    // one link forks the repo, commits the file and opens the pull request --
    // no git, no CLI, nothing installed.  The URL is built here rather than in
    // the page because the file is here, and because the length cap wants a
    // real answer instead of a truncated file somebody then submits.
    if (url.pathname === '/api/pack/share') {
      const wanted = url.searchParams.get('id');
      const entry = loadPacks(packsDir).find((e) => !e.error && e.pack.id === wanted);
      if (!entry) return json(res, 404, { error: `no pack file called ${wanted} here` });
      const cfg = config.read();
      const repo = cfg.submitRepo ?? gallery.OFFICIAL_REPO;
      try {
        const built = submitUrl({
          repo,
          branch: cfg.submitBranch ?? 'master',
          pack: entry.pack,
          text: readFileSync(entry.path, 'utf8'),
        });
        return json(res, 200, {
          ...built,
          id: entry.pack.id,
          name: entry.pack.name,
          repo,
          unpinned: unpinned(entry.pack),
        });
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
    }

    // Delete a shared recipe file.  Same rule: it moves, it does not vanish.
    if (url.pathname === '/api/pack/delete' && req.method === 'POST') {
      const opts = await readBody(req);
      if (!opts) return json(res, 400, { error: 'bad request body' });
      const entry = loadPacks(packsDir).find((e) => !e.error && e.pack.id === opts.id);
      if (!entry) return json(res, 404, { error: `no pack file called ${opts.id} here` });
      if (opts.confirm !== entry.pack.id) {
        return json(res, 400, { error: `type ${entry.pack.id} exactly to confirm` });
      }

      const trash = join(packsDir, '.trash');
      mkdirSync(trash, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      let to = join(trash, `${stamp}-${entry.name}`);
      for (let n = 2; existsSync(to); n++) to = join(trash, `${stamp}-${n}-${entry.name}`);
      try {
        renameSync(entry.path, to);
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
      return json(res, 200, { id: entry.pack.id, from: entry.path, to });
    }

    // Export the active instance as a shareable recipe.
    if (url.pathname === '/api/instance/export' && req.method === 'POST') {
      const opts = await readBody(req);
      if (!opts) return json(res, 400, { error: 'bad request body' });
      // Named explicitly when exporting from a card, so you do not have to
      // switch to a setup just to share it.
      const act = opts.identity
        ? findSaveDirs().find((i) => i.identity === opts.identity)
        : activeInstance();
      if (!act) return json(res, 400, { error: opts.identity ? `no setup called ${opts.identity}` : 'no active instance' });

      const state = stateOf(act.path);
      const chosen = Array.isArray(opts.mods) && opts.mods.length
        ? opts.mods.filter((id) => state.mods[id])
        : Object.values(state.mods).filter((m) => m.enabled).map((m) => m.id);
      if (chosen.length === 0) return json(res, 400, { error: 'no mods selected' });

      const index = feeds.length ? indexFromFeeds(feeds) : indexFromCache(state);
      // The catalogue closes gaps a local manifest cannot: a mod with no github
      // of its own still has a home if the index knows one.
      try {
        const cat = await catalogue.load({ url: config.read().indexUrl || catalogue.OFFICIAL_INDEX });
        for (const m of cat.mods) if (!index[m.id]) index[m.id] = m;
      } catch { /* offline: use whatever is local */ }

      const profile = {
        name: opts.name || act.identity,
        enabled: Object.fromEntries(chosen.map((id) => [id, true])),
        options: {}, slots: {},
      };
      const { releasesByRepo } = await gatherReleases({
        profile, state, index, releasesByRepo: releasesFromCache(state), fetchReleases,
      });

      let result;
      try {
        result = build(profile, {
          state, index, releasesByRepo,
          meta: {
            id: slugify(opts.name || act.identity),
            name: opts.name || act.identity,
            author: opts.author || null,
            summary: opts.summary || '',
            thumbnail: opts.thumbnail || null,
            createdAt: new Date().toISOString(),
          },
        });
      } catch (e) {
        return json(res, 400, { error: e.message, warnings: e.warnings ?? [] });
      }

      if (opts.pin) {
        const { failures } = await pin(result.pack, { hashUrl });
        for (const f of failures) result.warnings.push(`${f.id}: could not be pinned -- ${f.reason}`);
      }

      let text;
      try {
        text = encode(result.pack);
      } catch (e) {
        return json(res, 400, { error: `the pack that came out is not valid: ${e.message}` });
      }

      const file = join(packsDir, `${result.pack.id}${EXT}`);
      if (existsSync(file) && !opts.overwrite) {
        return json(res, 409, { error: `${result.pack.id}${EXT} already exists`, needsOverwrite: true });
      }
      mkdirSync(packsDir, { recursive: true });
      writeFileSync(file, text);

      return json(res, 200, {
        id: result.pack.id, file, mods: result.pack.mods.length,
        unpinned: unpinned(result.pack), warnings: result.warnings,
      });
    }

    // ------- a mod's own settings, which until now only the game could reach
    if (url.pathname === '/api/mod/options') {
      const modopts = await import('./modoptions.js');
      const act = url.searchParams.get('identity')
        ? findSaveDirs().find((i) => i.identity === url.searchParams.get('identity'))
        : activeInstance();
      if (!act) return json(res, 400, { error: 'no active instance' });
      return json(res, 200, { identity: act.identity, mods: modopts.describe(act.path) });
    }

    if (url.pathname === '/api/mod/options' && req.method === 'POST') {
      return json(res, 405, { error: 'use /api/mod/option' });
    }

    if (url.pathname === '/api/mod/option' && req.method === 'POST') {
      const opts = await readBody(req);
      if (!opts) return json(res, 400, { error: 'bad request body' });
      const modopts = await import('./modoptions.js');
      const act = opts.identity
        ? findSaveDirs().find((i) => i.identity === opts.identity)
        : activeInstance();
      if (!act) return json(res, 400, { error: 'no active instance' });
      try {
        return json(res, 200, modopts.set(act.path, opts.id, opts.key, opts.value, {
          exePath: config.read().gamePath ?? null,
        }));
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
    }

    // ------- saves: the one thing here nobody can re-download
    if (url.pathname === '/api/saves') {
      const saves = await import('./saves.js');
      const all = findSaveDirs().map((i) => ({
        identity: i.identity,
        path: i.path,
        ...saves.describe(i.path),
      }));
      return json(res, 200, { setups: all.filter((s) => s.total > 0) });
    }

    if (url.pathname === '/api/saves/backup' && req.method === 'POST') {
      const opts = await readBody(req);
      if (!opts) return json(res, 400, { error: 'bad request body' });
      const saves = await import('./saves.js');
      const { homeDir } = await import('./packaged.js');
      const inst = findSaveDirs().find((i) => i.identity === opts.identity);
      if (!inst) return json(res, 400, { error: `no setup called ${opts.identity}` });
      try {
        return json(res, 200, saves.backup(inst.path, { outDir: join(homeDir(), 'save-backups') }));
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
    }

    if (url.pathname === '/api/saves/backups') {
      const saves = await import('./saves.js');
      const { homeDir } = await import('./packaged.js');
      const dir = join(homeDir(), 'save-backups');
      return json(res, 200, { dir, backups: saves.listBackups(dir) });
    }

    if (url.pathname === '/api/saves/restore' && req.method === 'POST') {
      const opts = await readBody(req);
      if (!opts) return json(res, 400, { error: 'bad request body' });
      const saves = await import('./saves.js');
      const { homeDir } = await import('./packaged.js');

      const to = findSaveDirs().find((i) => i.identity === opts.to);
      if (!to) return json(res, 400, { error: `no setup called ${opts.to}` });

      // A name from the listing, resolved here -- never a path from the page.
      // The hub writes files, so "which file" is not a question the browser
      // gets to answer freely.
      const dir = join(homeDir(), 'save-backups');
      const pick = saves.listBackups(dir).find((b) => b.name === opts.name);
      if (!pick) return json(res, 400, { error: `no backup called ${opts.name}` });
      if (pick.error) return json(res, 400, { error: `that backup cannot be read: ${pick.error}` });

      let backedUp = null;
      try {
        if (saves.describe(to.path).total > 0) {
          backedUp = saves.backup(to.path, { outDir: dir }).file;
        }
      } catch { /* nothing there to protect */ }

      try {
        const out = saves.restore({
          buffer: readFileSync(pick.file), to: to.path, exePath: config.read().gamePath ?? null,
        });
        return json(res, 200, { ...out, backedUp });
      } catch (e) {
        return json(res, 400, { error: e.message, backedUp });
      }
    }

    if (url.pathname === '/api/saves/transfer' && req.method === 'POST') {
      const opts = await readBody(req);
      if (!opts) return json(res, 400, { error: 'bad request body' });
      const saves = await import('./saves.js');
      const { homeDir } = await import('./packaged.js');
      const all = findSaveDirs();
      const from = all.find((i) => i.identity === opts.from);
      const to = all.find((i) => i.identity === opts.to);
      if (!from) return json(res, 400, { error: `no setup called ${opts.from}` });
      if (!to) return json(res, 400, { error: `no setup called ${opts.to}` });

      // Back the destination up before adding to it. Nothing here overwrites,
      // but this is the one operation where being wrong is unrecoverable.
      let backedUp = null;
      try {
        if (saves.describe(to.path).total > 0) {
          backedUp = saves.backup(to.path, { outDir: join(homeDir(), 'save-backups') }).file;
        }
      } catch { /* a destination with nothing to save needs no backup */ }

      try {
        const out = saves.transfer({
          from: from.path, to: to.path, exePath: config.read().gamePath ?? null,
        });
        return json(res, 200, { ...out, backedUp });
      } catch (e) {
        return json(res, 400, { error: e.message, backedUp });
      }
    }

    // ------- fetch the game itself
    //
    // The one question the hub could not answer for you.  Hosts nothing: it is
    // the author's own release, checked against the checksum they publish
    // beside it -- the same bargain a pack makes about a mod.
    if (url.pathname === '/api/game/install' && req.method === 'POST') {
      const opts = await readBody(req);
      if (!opts) return json(res, 400, { error: 'bad request body' });

      const game = await import('./game.js');
      const { checkGameExe } = await import('./instance.js');
      const { homeDir } = await import('./packaged.js');

      const existing = config.read().gamePath;
      if (existing && !opts.force && checkGameExe(existing).ok) {
        return json(res, 200, { alreadySetUp: true, exePath: existing });
      }

      try {
        const out = await game.install({ dir: join(homeDir(), 'game') });
        const check = checkGameExe(out.exePath);
        if (!check.ok) return json(res, 400, { error: `downloaded, but it does not look right: ${check.reason}` });
        config.write({ gamePath: check.path });
        return json(res, 200, {
          exePath: check.path, version: out.version, verified: out.verified, files: out.files.length,
        });
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
    }

    // ------- send a setup to an Android handheld
    //
    // Written to disk rather than streamed to the browser: it is tens of
    // megabytes headed for a USB cable, and what you want next is the file in a
    // folder you can drag from, not in Downloads.
    if (url.pathname === '/api/instance/android' && req.method === 'POST') {
      const opts = await readBody(req);
      if (!opts) return json(res, 400, { error: 'bad request body' });
      const act = opts.identity
        ? findSaveDirs().find((i) => i.identity === opts.identity)
        : activeInstance();
      if (!act) return json(res, 400, { error: opts.identity ? `no setup called ${opts.identity}` : 'no active instance' });

      const android = await import('./android.js');
      let made;
      try {
        made = android.bundle(act.path, { packName: opts.name || act.identity });
      } catch (e) {
        return json(res, 400, { error: e.message });
      }

      const outDir = join(packsDir, '..', 'android');
      const file = join(outDir, `${act.identity}-android.zip`);
      mkdirSync(outDir, { recursive: true });
      writeFileSync(file, made.buffer);

      return json(res, 200, {
        file,
        entries: made.files.length + 1,
        bytes: made.buffer.length,
        raw: made.bytes,
        left: made.left,
        identity: android.ANDROID_IDENTITY,
      });
    }

    // ------- play the active instance

    if (url.pathname === '/api/play' && req.method === 'POST') {
      const exePath = config.read().gamePath;
      if (!exePath) return json(res, 400, { error: 'no game executable set -- add one in Settings' });
      const act = activeInstance();
      if (!act) return json(res, 400, { error: 'no active instance' });

      // Unpacked data is what boots straight into the game.  A .gb sitting in
      // baseroms/ is not the same thing -- the game imports it on first launch,
      // which is the screen that looks like "it asked me for a ROM again".
      //
      // Checked on every Play, not only at creation: a setup made before any
      // other had unpacked data would otherwise keep that import screen for
      // ever, even once a copy became available seconds later.
      let repaired = null;
      if (romVersionsIn(act.path).length === 0) {
        repaired = await giveGameData(act.path);
        if (repaired.how === 'none' && baseromsIn(act.path).length === 0) {
          return json(res, 409, {
            error: `${act.identity} has no game data, and ${repaired.reason}.`,
            needsRom: true,
          });
        }
      }

      // Our own backup folder used to sit inside mods/, where the engine reads
      // every directory and warns about anything without a manifest.  Moving it
      // here rather than on the next install means the warning stops on the
      // very next Play, which is when somebody is looking at the log.
      try {
        backupRoot(act.path);
      } catch { /* housekeeping must never stop the game starting */ }

      // Which game to boot straight into.  Only a version this instance has
      // actually unpacked -- asking for one it has not would land you on the
      // launcher anyway, which is the screen we are trying to skip.
      const have = romVersionsIn(act.path);
      const preferred = config.read().playVersion;
      const version = have.includes(preferred) ? preferred : (have[0] ?? null);

      try {
        // saveDir is what turns stdout into a file you can read afterwards.
        const out = launchGame({
          exePath, identity: act.identity, version, saveDir: act.path,
        });
        return json(res, 200, {
          ...out,
          // 'rom' means the game still has a one-time import to do, and saying
          // so beats the player thinking the setup is broken.
          gameData: repaired,
          linked: repaired?.how === 'rom' ? { label: repaired.label } : null,
        });
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
    }

    // ------- settings

    if (url.pathname === '/api/browse' && req.method === 'POST') {
      const opts = await readBody(req);
      if (!opts) return json(res, 400, { error: 'bad request body' });
      const cfg = config.read();
      try {
        if (opts.kind === 'rom') {
          const path = await pickFile({
            title: 'Choose your Pokemon ROM', filter: FILTERS.rom,
            initialDir: cfg.romPath ? dirname(cfg.romPath) : null,
          });
          if (!path) return json(res, 200, { cancelled: true });
          const rom = identifyRom(path);
          if (!rom.ok) return json(res, 400, { error: rom.reason });
          config.write({ romPath: rom.path });
          return json(res, 200, { path: rom.path, label: rom.label });
        }
        const path = await pickFile({
          title: 'Choose gen1recomp.exe', filter: FILTERS.exe,
          initialDir: cfg.gamePath ? dirname(cfg.gamePath) : null,
        });
        if (!path) return json(res, 200, { cancelled: true });
        const exe = checkGameExe(path);
        if (!exe.ok) return json(res, 400, { error: exe.reason });
        config.write({ gamePath: exe.path });
        return json(res, 200, { path: exe.path });
      } catch (e) {
        return json(res, 500, { error: e.message });
      }
    }

    if (url.pathname === '/api/settings' && req.method === 'POST') {
      const opts = await readBody(req);
      if (!opts) return json(res, 400, { error: 'bad request body' });
      if (opts.romPath !== undefined) {
        const rom = identifyRom(opts.romPath);
        if (!rom.ok) return json(res, 400, { error: rom.reason });
        config.write({ romPath: rom.path });
        return json(res, 200, { romPath: rom.path, label: rom.label });
      }
      if (opts.gamePath !== undefined) {
        const exe = checkGameExe(opts.gamePath);
        if (!exe.ok) return json(res, 400, { error: exe.reason });
        config.write({ gamePath: exe.path });
        return json(res, 200, { gamePath: exe.path });
      }
      // No endpoint for the gallery or the submit repo, on purpose.  Those two
      // decide what the hub offers to install and where your packs get sent,
      // and a writable setting for either is one convincing message away from
      // pointing somewhere else.  They live in packfeed.js; changing them is a
      // code change.
      if (opts.packIndexUrl !== undefined || opts.submitRepo !== undefined) {
        return json(res, 403, {
          error: 'the gallery is fixed in the build -- change it in src/packfeed.js and restart',
        });
      }
      return json(res, 400, { error: 'nothing to set' });
    }

    return json(res, 404, { error: 'not found' });
  });

  return new Promise((resolvePromise, rejectPromise) => {
    let attempt = port;
    const tryListen = () => {
      server.once('error', (e) => {
        // EADDRINUSE is another hub; EACCES is Windows reserving the port.
        const retryable = e.code === 'EADDRINUSE' || e.code === 'EACCES';
        if (retryable && attempt < port + 10) {
          attempt++;
          return tryListen();
        }
        rejectPromise(retryable
          ? new Error(`ports ${port}-${attempt} are all unavailable; pass --port to pick another`)
          : e);
      });
      server.listen(attempt, host, () => {
        resolvePromise({
          server, url: `http://${host}:${attempt}/`, token, port: attempt,
          movedFrom: attempt === port ? null : port,
        });
      });
    };
    tryListen();
  });
}

export { checkSaveDir };
