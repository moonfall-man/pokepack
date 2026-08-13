# Contributing a pack

A pack is a recipe: which mods, pinned to exact bytes, plus the settings they
were tested at. It hosts nothing — every mod is fetched from its own author's
release page.

## Make one

Double-click `start-pokepack.cmd` on Windows, or run `./start-pokepack.sh` on
macOS and Linux. You need [Node.js](https://nodejs.org) 18 or newer and nothing
else.

```bash
node bin/pokepack.js ui   # the same thing, if you would rather type it
```

1. **New pack** — a fresh setup with its own mods, saves and settings.
2. **Mods** — add what you want and switch on what you tested with.
3. **Play** it until you like it.
4. **Export…** — name, author, one-line summary, and leave **Pin to exact
   bytes** ticked.

Pinning downloads each mod once and records its SHA-256. An unpinned pack will
be rejected — see below for why.

The result lands in `packs/<your-pack>.pokepack`.

## Send one to a friend

That file *is* the pack. Send it however you send files.

On their side: **Browse → Import a pack…**, either choosing the file or pasting
a link to it. It is validated on arrival — the same check a pack off the
internet gets — and then **Install as new setup** builds it in its own isolated
copy, downloading each mod from its author and refusing any whose bytes do not
match what you pinned.

Nothing about the file is special to your machine, and no server is involved.

## Check it before you open a PR

```bash
node bin/pokepack.js validate packs/your-pack.pokepack --deep
node test/run.js
```

`--deep` downloads every mod and confirms the bytes still match what you pinned.
CI runs the same thing, so this only saves you a round trip.

## Open the PR

Easiest way: press **Publish** on the pack, or **Share this pack…** right after
you export it. That opens GitHub with the file already filled in; press
**Propose new file** and you are done. GitHub makes your copy of the repo for
you, so you need no git and nothing installed.

By hand, if you prefer: branch off `master` and open a pull request back into
it. `master` refuses direct pushes from everybody, the maintainer included, so a
pull request is the only way in.

Commit just your `.pokepack` file. Nothing else should change:

```bash
git add packs/your-pack.pokepack && git commit -m "Add your-pack"
```

Name the file rather than staging everything — the hub exports into the same
folder, so `git add -A` will bring along any other pack you were still fiddling
with.

In the description, say:

- **what the pack is for** — "voxel battles tuned for two players on one screen"
  beats "my setup"
- **what you actually tested** — which game version, how long you played, what
  you checked
- **any setting that looks wrong but isn't.** Put it in the mod's `notes` field
  too. `water = "full"` instead of `"sky"` is the kind of thing that looks like
  a typo and is the entire point of the pack.

## What gets a pack merged

**Every mod pinned.** A version string is what an author *claims*; a hash is
what the file *is*. If someone re-uploads `1.7.1` with a quiet fix, a version
pin shrugs and a hash pin catches it. Unpinned packs cannot be verified later,
so they are not merged.

**Conflicts declared.** If your pack needs a mod switched *off*, it belongs in
`disable`. A tested combination includes its exclusions — that is most of what
separates a pack from a list of mod names.

**Settings that were actually tested.** The `options` are the reason this format
exists. Ship what you played with, not the defaults.

**Links that resolve.** CI checks nightly and re-verifies every hash weekly. A
pack whose downloads die gets marked broken rather than quietly serving a setup
nobody can install.

## What does not get merged

- Packs that bundle or re-host somebody's mod. Point at the author's release.
- Packs pinning a mod whose licence forbids redistribution — you are shipping a
  link and a hash, which is fine, but do not work around an author who has asked
  not to be listed.
- Packs that only reorder somebody else's pack. Open an issue on theirs.

## Voting

Every merged pack gets an issue here. **React with 👍 to upvote it**, and use
the thread to say what worked. A nightly job reads those counts into the pack
list, so the browse screen can order by them.

Deliberately no accounts, no server and no vote endpoint — GitHub already has
reactions, moderation and a spam story, and needing an account to react does
most of the work. The trade is that counts are as fresh as the last nightly run.

A vote is popularity, not a safety check. Every mod stays a third-party download
from its own author, and a well-liked pack has no more claim on you than any
other.

## A note on what approval means

Merging a pack says *this combination was tested and its links work*. It does
not vouch for the mods themselves — those are third-party downloads from their
authors' own repos, and they carry exactly the trust they would if you had
installed them by hand.

## How a change reaches people

```
  branch off master  --PR-->  master
                                ^
                          CI + review
```

One branch, one pull request per change.

```bash
git switch master && git pull && git switch -c my-change
```

`master` takes no direct pushes from anybody, including the maintainer — a pull
request with green CI is the only way in, and the branch is deleted on merge.

There was a `dev` branch in front of this and it was removed. A second
long-lived branch buys nothing that master's protection does not already give,
costs a second pull request per change, and drifts out of sync the moment
anything is squash-merged between the two — a squash gives one branch a single
commit where the other has ten, so git reads the same work arriving twice as a
conflict in files nobody touched. Short-lived branches never live long enough
for that to happen.

Every pull request needs an approving review from the code owner and a green
`test` and `validate` before the merge button lights up. Neither branch can be
force-pushed or deleted. Merging a pack is what makes it visible to everyone —
the gallery is fetched when the tool runs, so nobody has to update anything.

Setting this up on a fresh clone of the repo:

```bash
sh .github/setup-branches.sh
```

## Working on the tool itself

```bash
node test/run.js
```

105 tests, no network, no dependencies. New behaviour needs a test; the suite is
deliberately fast so there is no excuse.

Two rules the code holds to, worth knowing before you change it:

- **Nothing is ever deleted.** Replacing a mod moves the old copy to
  `mods/.pokepack-backup/`. Rewriting `options.lua` keeps the previous file. A
  player's install is not ours to throw away.
- **`options.lua` is only touched when the game is closed**, and only as a merge
  that leaves unknown keys alone. If we cannot tell whether the game is running,
  we do not touch it.
