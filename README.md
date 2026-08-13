# pokepack

Modpack recipes for [gen1recomp](https://github.com/bryanthaboi/gen1recomp) — a
whole tested setup in one file, so nobody has to reassemble it by hand.

A pack **hosts nothing**. It points at each author's own downloads, pins each
one to the exact bytes that were tested, and carries the settings those mods
were tested at. Same reason the game ships no ROM: this distributes
instructions, not other people's work.

**Get it** either way:

- **One file.** Download `pokepack-windows-x64.exe` from
  [Releases](https://github.com/moonfall-man/pokepack/releases) and double-click
  it. Nothing to install — the runtime is inside. It keeps its packs in a
  `packs` folder beside itself, so the whole thing moves as a unit. Unsigned, so
  Windows warns the first time; there is a `.sha256` published next to it.
- **From source.** Double-click `start-pokepack.cmd` on Windows, or run
  `./start-pokepack.sh` on macOS and Linux. Needs [Node.js](https://nodejs.org)
  18 or newer and nothing else — pokepack has no runtime dependencies, so there
  is no install step.

```bash
node bin/pokepack.js ui   # the same thing, if you would rather type it
```

## Getting the game

```bash
node bin/pokepack.js game
```

or **Download…** beside the game path in Settings. It takes the latest release
from [the author's own repo](https://github.com/bryanthaboi/gen1recomp), checks
it against the `sha256sums.txt` they publish beside it, and points pokepack at
the result. Nothing is hosted here — the game is one more pinned download, on
the same terms as every mod.

Latest rather than pinned, deliberately: a mod is pinned because a pack was
tested against those exact bytes, while the engine is the thing packs are tested
*on*, and an old one is a bug nobody else can reproduce. The hash still comes
from the release being installed, so this is "whichever version, verified" and
not "whatever arrives".

You still supply your own ROM. That part is not automatable and should not be.

## Why not just a list of mods

Installing mods was never the hard part. The hard parts are the two things a
mod list cannot express:

- **Two mods that both want to own the same thing.** Neither author can warn you,
  because they don't know the other exists. A pack says *this one off*.
- **One setting being 1 instead of 4**, which makes a working install look
  broken. A pack ships the values, not just the names.

A pack that only bundles mods fixes neither.

## What a pack is

```json
{
  "format": "pokepack",
  "formatVersion": 1,
  "id": "couch-coop",
  "name": "COUCH CO-OP",
  "author": "moonfall-man",
  "summary": "Split screen on one PC.",
  "engine": ">=0.1.37 <2.0.0",
  "strict": true,
  "mods": [
    {
      "id": "COUCH_MULTIPLAYER",
      "version": "0.3.1",
      "source": {
        "url": "https://github.com/.../COUCH_MULTIPLAYER-0.3.1.zip",
        "sha256": "fe4b3b93...",
        "size": 69803
      },
      "options": { "PLAYERS": 2 },
      "priority": 60,
      "notes": "why this value, if it is not obvious"
    }
  ],
  "disable": ["GHOST_LINK"],
  "slots": { "red": "slot1" }
}
```

| Field | Why it exists |
|---|---|
| `source.sha256` | The identity. See below. |
| `options` | The settings that were tested. The whole point. |
| `disable` | Mods that must be **off**. A tested combination includes the exclusions. |
| `priority` | Load-order override, when a mod's own declared priority is wrong for this combination. |
| `strict` | A pack that only half-resolved will not become your active setup. |
| `slots` | Which save slot each game version plays. |

### The hash is the identity, the version is a label

A version string is what the author *claims*. A hash is what the file *is*. If
someone re-uploads `1.7.1` with a quiet fix, version pinning shrugs and hash
pinning says *that is not what I tested*.

This also means one field does two jobs — the integrity check and the version
lock are the same piece of data.

```
 ~  BATTLE_ART_VOXEL_FORK  1.7.6 -> 1.7.1 (downgrade)
```

Matching a pack can mean going **backwards**. That is why the operation is
*reconcile*, not *update* — an "update all" that walks toward latest would
break every pack it touched.

## The hub

```bash
node bin/pokepack.js ui
```

No path, no flags. One idea runs through the whole thing: there is an **active
setup**, and everything is scoped to it.

```
 Playing: couch-coop        [▶ Play]  [New pack]  [Export…]  [Settings]

 My packs (10) | Mods (4) | Browse (4)
```

- **My packs** lists every setup on the machine — pack-created ones *and* your
  own original saves. Click one to make it active; the gold card is live.
- **Mods** shows that setup's mods, filtered **All / Installed / Not installed**.
  Install, remove, or just switch one on and off.
- **Browse** is shareable `.pokepack` recipes. Installing one always creates its
  own new setup, so two packs can never fight over a mod version.
- **Play** launches the active setup.
- **New pack** makes an empty setup to fill from the Mods tab.
- **Export** turns the active setup into a shareable recipe.

Nothing is configured twice: there is no separate "current folder" setting
shadowing the active setup.

Each setup is a LÖVE identity (`POKEPORT_IDENTITY`, or `pokemon-love2d` by
default, from the game's `conf.lua`) — which is why they are genuinely isolated.

Real HTML — cards, a mouse, readable text — because browsing a grid inside a
Game Boy-styled launcher would be miserable. It runs on your own machine, so
unlike a website it can reach your game folder. Bound to `127.0.0.1` and gated
on a token, since the process writes files. If the port is busy it walks up to
the next free one and says so.

## Instances: profiles, packs, and the third thing

Three levels, and only one of them separates versions:

| | Separates | Cost to switch |
|---|---|---|
| **Profile** | which mods are on, and their settings | instant |
| **Pack** | a portable recipe, shareable | one download |
| **Instance** | *everything* — mods, saves, settings | relaunch |

Profiles already separate setups, and they're instant. What they can't separate
is mod **versions**, because there's one `mods/` folder — two packs pinning
1.7.1 and 1.7.6 of the same mod can't coexist.

That's what an instance is for, and the game already supports it. From its
`conf.lua`:

```lua
t.identity = os.getenv("POKEPORT_IDENTITY") or "pokemon-love2d"
```

Every identity gets its own `mods/`, `saves/` and `options.lua`. So **New
instance** creates one, installs the pack into it, and writes a launcher:

```cmd
@echo off
rem Launches gen1recomp in its own instance: "kanto-3d"
set "POKEPORT_IDENTITY=kanto-3d"
start "" "C:\...\gen1recomp\gen1recomp.exe"
```

Same isolation model Wabbajack and Nolvus use — one install per list — reached
with an environment variable the game already reads. Creating an instance
refuses a name that already exists, so it can never walk into a folder holding
somebody's saves.

A new instance starts with no game data, so it gets some automatically — either
the unpacked cache copied from an instance you already play (instant), or your
linked ROM dropped into `baseroms/`, which the game's own importer picks up on
first launch (one confirmation in-game, then never again).

Press **▶ Play** on an instance with neither and it copies your linked ROM in
and launches. If no ROM is linked, it says so and opens Settings.

### Play

The header **▶ Play** button starts the game on whichever instance the hub is
pointed at, by setting `POKEPORT_IDENTITY` and launching the exe you set in
**Change folder**.

Installing a pack applies it straight into `options.lua`, so Play drops you into
the setup with nothing to click inside the game. That write happens under four
conditions, and falls back to "import this profile" whenever any of them fails:

1. **The game is not running.** LÖVE rewrites `options.lua` wholesale on exit,
   so anything written while it was open would vanish. If we cannot *tell*
   whether it is running, we do not touch the file.
2. **It is a merge, not a template.** The file is read, modified and written
   back — every key we do not understand survives untouched.
3. **The result is re-parsed before it replaces anything.** A file that does not
   read back is never written.
4. **The previous file is kept**, as `options.lua.pokepack-bak`.
   `options.lua.bak` belongs to the engine's own crash recovery and is not ours
   to overwrite.

A `.g1rmodlist` is written either way, so the manual route always exists.

The executable comes from stored config and can never be named by the request
that asks to play — a local server that will start whatever binary a caller
names is a very different thing from one that starts the game you pointed it at.

It refuses to guess when the chosen folder is not under LOVE's save root, since
nothing outside it can be reached with that environment variable.

## My packs is across every instance

The hub scans every instance on the machine, not just the folder it is pointed
at. So the pack you play with friends and the one you play solo are both on
screen at once, and clicking either gives you a **Play** button per instance:

```
Installed in these instances:

  test          1 mod from this pack · 3 installed in total   [▶ Play] [Remove]
  couch-coop    1 mod from this pack · 1 installed in total   [▶ Play] [Remove]

                              [ Close ]  [ Install into another instance… ]
```

A pack is a thing you play. Which folder the hub happens to point at should not
decide whether you can see it — that only matters for building a new pack from
a profile.

## My packs, and removing one

The hub has two tabs. **Browse** is every pack in `packs/`; **My packs** is the
ones actually installed, in any instance.

It knows which is which because the lock sidecar records *which pack* put each
mod there. That matters for removal: a mod you installed by hand is never in
scope, even when a pack lists it.

**Remove** shows exactly what will move before it moves, then:

- mods go to `mods/.pokepack-backup/<id>-<version>/`, intact. Nothing is deleted.
- the lock forgets them, so a later install is a clean install
- `options.lua` is tidied under the same conditions as everything else — game
  closed, merge only, previous file kept

One thing it deliberately does **not** do: turn back on whatever the pack turned
off. Their state before the pack was never recorded, so restoring it would mean
inventing it.

## Mod manager first, packs on top

pokepack is a mod manager: browse the official catalogue, install and remove
mods one at a time, and see what you have. Packs sit on top of that — a way to
combine mods you already manage into a named, shareable, reproducible setup, and
to give each one its own instance.

    Mods tab      install / remove / update individual mods
    New pack      tick the ones you want -> a pack
    My packs      play any pack, in any instance

## The Mods tab

There is an official, CI-built index of gen1recomp mods, published in exactly
the schema the engine own `src/mods/ModIndex.lua` reads:

    https://bryanthaboi.github.io/gen1recomp-mod-index/data/index.json

93 mods, rebuilt on every push, with a JSON schema, a validation workflow and a
PR-based submission process. The hub reads it directly and caches it for a day.

So: **no scraping.** An earlier plan here was to parse gen1recomp.com HTML,
which would have been a live dependency on somebody else markup that breaks on
any redesign. This is a validated feed built for the purpose.

The tab cross-references it against what you have installed:

    Battle Art Voxel Fork    [installed 1.7.6] [1.7.9 available] ART UI
    Better Battle UI         [0.2.1] UI QOL
    PokePC Followers         [0.5.1] [no download] GAMEPLAY

Point it somewhere else with `indexUrl` in your config if you run your own.

## Settings

Three things, each with a **Browse…** button that opens a real File Explorer
dialog:

- **Game folder** — which instance to work with (auto-detected, so usually just pick one)
- **gen1recomp.exe** — needed for the Play button
- **Your ROM (.gb)** — copied into each new instance so it can start

The ROM is checked against the engine own Red / Blue / Yellow checksums, so you
get *Recognised as Pokemon Red* rather than a failure three steps later. It is
never uploaded anywhere; the tool copies a file you already have between folders
you already own.

A browser page cannot read a filesystem path from a file input — that is a
deliberate browser restriction — so the hub server opens the OS dialog itself
and reads back the path. That is only possible because it runs locally.

## Theme

The hub is themed after the games palette — the red, the gold, the blue. It
ships **no Pokemon artwork**: the only graphic is a few lines of CSS, and pack
screenshots are URLs the pack author already publishes (`thumbnail`, https
only). Same rule as the ROM and the mods.

## Commands

```
build <saveDir>      turn a profile you already play into a pack
resolve <pack>       what installing it would do, before it does it
install <pack>       download, verify and install it     --save DIR
ui                   browse and install in your browser (asks on first run)
feed [packsDir]      generate packs.json for a gallery   --out FILE
fetch <pack>         download and verify, without installing
validate <pack...>   do the links still work?
inspect <pack>       print a pack in full
hash <url>           sha256 of a file
```

### Resolve before you download

Everything a pack needs to know is knowable up front: the index publishes each
mod's dependencies and conflicts, so the plan is computed before a single byte
moves.

```
$ node bin/pokepack.js resolve fixtures/demo/kanto-3d.pokepack --save fixtures/other-save --index fixtures/index-test.json

KANTO 3D  by moonfall-man

 ~  BATTLE_ART_VOXEL_FORK  1.7.6 -> 1.7.1 (downgrade)
      installed 1.7.6, pack wants 1.7.1
 +  GHOST_LINK  0.1.0
      not installed here
 !  DRAMATIC_SHAPE  must be switched off for this pack

0 ready, 1 to install, 1 to reconcile, 0 unavailable, 0 blocked
```

Markers: `ok` ready · `+` install · `~` reconcile · `x` unavailable · `-` blocked
by a dependency that died.

If a mod cannot be resolved, everything that depends on it is marked `blocked`
rather than downloaded — you learn "this installs 3 of 6, and here is which 3"
instead of finding out after four downloads.

### Fetch stops at the door

`fetch` downloads and verifies, then hands you a folder. It does **not** write
into your game.

The launcher already owns installing, and every zip it takes goes through a
validated path that checks the manifest inside. A second installer out here
would just be a worse one that skips those checks.

```
files are in downloads/kanto-3d
import them with the launcher's "Import mod .zip", then apply the pack's settings.
then switch off: DRAMATIC_SHAPE
```

## Validation runs in CI, not in the launcher

Mods move and get unpublished. A gallery of packs that quietly stopped working
is worse than a small one.

`.github/workflows/validate.yml` checks every link nightly and verifies every
hash weekly, then publishes the answer. One run answers it for everyone —
the alternative is every copy of the game asking GitHub the same question.

`validate` exits non-zero when anything rotted, so a pack that breaks fails CI:

```
CHANGED COUCH CO-OP  (0 live, 1 changed, 0 broken)
          COUCH_MULTIPLAYER: the file downloads but its contents no longer match what was pinned
```

## Sharing packs

A pack is JSON on purpose. It diffs cleanly, so a change is legible in review:

```diff
-      "version": "1.7.1",
+      "version": "1.7.6",
-        "water": "sky"
+        "water": "full"
```

Submit a pack by PR to a gallery repo. You get versioning, history, review and
attribution for free, and there is no backend to run.

## On a handheld

The game already runs on Android — touch controls, orientation lock, its own
mod manager — so nothing needs porting. Get the APK from
[the game's own releases](https://github.com/bryanthaboi/gen1recomp/releases/latest);
this repo does not mirror it, for the same reason it ships no ROM.

What could not travel is a pack, because the two things pokepack leans on do
not exist there. `POKEPORT_IDENTITY` is an environment variable and an app has
no environment, so `conf.lua` always falls back to `pokemon-love2d` — one save
folder, where a desktop gets one per pack. And the hub is a Node program
serving a local page; there is no version of that which is an APK.

Switching between packs on the device goes through the engine's own profiles
instead. A `.g1rmodlist` is a named snapshot — enabled mods, each mod's
options, the save slot per game version — and the mod manager imports every one
it finds in `profiles/`, an import built folder-based specifically so it works
where there is no file picker. pokepack has always written that format
(`writeProfile`), so a pack arrives as a profile you switch to in-game rather
than a state you overwrite. What the shared folder still costs you: two packs
pinning different versions of the same mod cannot both be right at once.

So the transfer is a file copy, and it works because the layout is already the
same everywhere: `Loader` reads `mods` relative to the save directory, and
`options.lua` sits beside it. Neither holds an absolute path.

```bash
node bin/pokepack.js android <saveDir>
```

or **To Android** in the hub's top bar. Extract the zip into the game's save
folder on the device so `mods/` and `options.lua` sit directly inside:

```
Android/data/<package>/files/save/pokemon-love2d/
```

The game shows you that exact path on its ROM import screen. It is the app's
external-files folder — writable over USB with no permission granted, which
`conf.lua` arranges on purpose so players can push a ROM in the same way.

**What stays behind, and why.** The archive carries `mods/`, `options.lua`,
`profiles/` and `pokepack-installed.json`, and nothing else. Not your ROM data, which is yours
and which the device imports for itself. Not your save files, which would
overwrite the ones already on it. This is an allowlist rather than a skip-list
so that a folder the engine grows later cannot join by default.

## Known limits

- **Installed mods are extracted folders**, so the hash of the zip they came
  from is not recoverable from disk. Hashes verify what you *download*.
  `fetch` records them in a `pokepack-installed.json` sidecar so later
  comparisons work; without it, comparison falls back to version strings.
- **One shared mods folder.** Two packs pinning different versions of the same
  mod cannot both be reconciled at once — switching between them re-downloads.
  Wabbajack avoids this by giving each list a separate install; that is a much
  bigger change than it looks and probably wrong at this scale, so packs are
  allowed to conflict and the plan tells you when they do.
- **Offline resolve is partial.** Without an index, dependency and conflict
  cascade cannot run. The plan says so rather than implying it checked.
- **Replacing a mod never deletes it.** The old copy moves to `mods/.pokepack-backup/`.

## Why the game needs no changes

Installing finishes by writing a `.g1rmodlist` into the save directory's
`profiles/`. You open the launcher, hit **IMPORT PROFILE**, and it applies the
enable set, every mod's settings, and the save slots — all code that already
ships and already works.

So the tool does the half the launcher could not do (fetching) and hands the
rest back:

```
browse  ->  plan  ->  download + verify  ->  write mods/<ID>/
        ->  write profiles/<PACK>.g1rmodlist
        ->  "open the launcher and import it"
```

That also makes the launcher's missing-mods dead end irrelevant. Import only
ever failed because it could not fetch; if the mods are already there, it works
as shipped.

The writer is byte-compatible with `SaveSerializer.lua`, not merely similar —
the test suite re-encodes real `options.lua` files and compares them to the
original bytes. It matches, including LuaJIT's habit of writing carriage
returns as `\13` rather than `\r`.

Installing folders directly does skip the launcher's own import checks, so the
manifest is validated here on the way in. The loader re-validates everything at
load time regardless, so the worst case is a mod refused with a reason on screen
rather than a broken boot.

## Development

```bash
node test/run.js
```

162 tests, no network, no dependencies. `fixtures/index.json` is a real published
feed; `fixtures/save/` is a save directory shaped like a real one.

### Building the single file

```bash
npm install && npm run build:exe
```

`esbuild` and `postject` are the only dependencies in the project and they are
build-time only — a checkout runs with neither installed. Node's own
single-executable support does the work: the ES modules are bundled into one
CommonJS file, turned into a blob, and injected into a copy of `node` itself.
About 90MB out, nearly all of it the runtime.

Three things in the source exist because of this and look arbitrary otherwise:
`bin/pokepack.js` ends in `main()` rather than a top-level `await`, which
CommonJS cannot express; `src/packaged.js` answers the questions
`import.meta.url` used to, because that does not survive the bundle; and the
build refuses to finish unless the binary it just made reports the right
version when run.

`engine-src/` (gitignored) is the game's Lua source, unpacked from the shipped
`gen1recomp.exe`, kept locally for reference. Re-extract it with:

```bash
unzip -o gen1recomp.exe -d engine-src
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to build a pack and get it merged.

MIT licensed. The licence covers this tool and the recipes — not the mods a pack
points at, which belong to their authors.
