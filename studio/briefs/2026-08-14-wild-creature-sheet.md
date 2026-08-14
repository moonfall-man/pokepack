# Verdant Wilds — Creature Sheet: Thistlet & Wickerbill

**Date:** 2026-08-14 · **Author:** Marcus Vale, Creative Director · **Ticket:** WILD-6
**Fulfills:** Decision 11 (sprint-2 planning) — the sheet is Marcus's and posts to WILD-6 before the first battle-art commit. Retro Action 4.

**Status honesty, up front.** Per PJ's chair ruling on WILD-6 (2026-08-14T09:59:46Z), the snare-catch beat arrives at the sprint-3 table pre-cut; battle ships Strike/Flee, the snare stays craftable. The catch sections below are forward spec against the numbers Decision 10 already pinned — nothing in this sheet reopens the valve, and nothing in it invents a number the planning table did not.

**Originality.** Both species are original: named at the sprint-2 table (minutes §2, Decision 11), designed in this sheet, drawn as code primitives in the house atlas style. No external art, no borrowed names, no copyrighted material anywhere near this document.

**Sources of truth this sheet obeys:** Decision 10 CONSTANTS (WILD_HP_MAX 6, STRIKE_DMG 2, WILD_HUNGER_PRESS 4, BATTLE_BEAT_MS 180, ENCOUNTER_PCT 15, ENCOUNTER_WIPE_MS 450, snare = 1 wood + 2 fiber, CATCH_PCT = 20 + floor(60 × (6 − wildHP) / 6)) · WILD-2 shipped gathering rates (tree: 3 chops → 2 wood; fiber plant → 1 fiber; berry bush → 2 berries; 60s respawn) · WILD-4 node census (Bramble Run gains one tree, one fiber plant; berry bushes remain Mosshollow-only) · atlas.js as-shipped palette · my WILD-3 cold-read red-family flag, quoted below.

---

## 0. The shared staging rule — silhouette-first

The first three seconds of pillar 4 are a grass step, a 450ms code-drawn wipe, and a battle panel **with no audio to help it**. So the silhouette does the announcing:

- The wipe resolves and the wild appears as its **flat-ink silhouette** (house ink `#1c1c22`) for exactly one BATTLE_BEAT_MS, then its palette fills on the next frame. One flat-fill draw, two frames, free at our render cost (WILD-3's whole tileset measures ~0.09ms/frame).
- The announcement line lands the same frame the silhouette does. It is doing the work sound normally does — it is part of each creature's identity and is specified per species below.
- Both creatures are authored on the 16px tile canvas in atlas primitives, same discipline as every shipped glyph. The battle panel may blit at integer 2x, but **both silhouettes must pass a cold read at 1x** — shipped-scale readability is the descope floor and is never cut.

Why this staging: it turns my own acceptance bar ("two species you cannot confuse at shipped scale") into something the player re-verifies on literally every encounter. If the ink shape alone does not tell you which one you drew, the sheet has failed and the cold read will say so.

---

## 1. THISTLET

**One-line fantasy.** A burr that learned to want things — it does not hunt you, it attaches to you.

**Silhouette at 16px — class: low-round-spiky.** A squat dome filling the bottom ~10px of the tile, ~14px wide — the widest, lowest-slung body in the game. Around the dome's upper rim, seven short triangular spikes (~3px) radiate from 8 o'clock to 4 o'clock. Two stub feet under the belly; two wide-set eye dots placed LOW on the face (low face = small, stubborn, not menacing). Daylight never shows under the body — it sits.

*Why it cannot be confused with anything shipped:* the radiating-triangle rim exists nowhere else in the atlas. The berry bush is round lobes with no spikes; the player is a tall-centered circle with a direction wedge; the tree is canopy-on-trunk. Against Wickerbill it is the exact opposite axis: horizontal mass vs vertical line.

**Palette rows** (zero red, per Decision 11 and my own WILD-3 flag):

| Role | Hex | Kept apart from |
|---|---|---|
| Body moss green | `#5f7a4a` | Grayed olive vs every saturated foliage green shipped (`#4a8f3f` grass, `#2f6b34` tall-grass base, `#7fce5a` blades, `#a8d24a` fiber stalks, `#2f7a3f` berry bush) |
| Body shade / feet | `#40542f` | — |
| Spikes, bone cream | `#e6dcc0` | Grayer, less yellow than fiber seed-heads `#ecdf9c`; the brightest value on the creature sits on its identity feature |
| Spike outline | `#8a7f63` | — |
| Eyes | `#1c1c22` | House ink, shared with the player's eyes on purpose |

**Type / temperament.** Bramble; stubborn clinger. (No type chart exists in the machine and this sheet does not invent one — "type" is copy vocabulary only, zero mechanical hooks.)

**Encounter zone.** All Mosshollow tall grass — (2,2)-(3,2), (7,2)-(8,2), (12,12)-(13,12). The town-side creature: the first wild anything the player ever meets, two steps from spawn, and the one the first snare is spent on. Implementation shape (suggestion, not a knob): map id → species. No weighted table, no new constant, and the harness can assert "Mosshollow grass always rolls Thistlet" under seed for free.

**Announcement line.** `A THISTLET latches on!`

**Battle behavior in the turn structure.** The machine is pinned and identical for both species — player turn Strike / Throw Snare / Flee; wild turn presses hunger 4; wild HP 6, floors at 1; Flee always exits. This sheet says that out loud rather than pretending otherwise: **identity lives in the wild-turn presentation and the copy, inside BATTLE_BEAT_MS 180, at zero new knobs.** Thistlet's press is a lunge-and-latch: it slides into contact with the player's panel edge, holds one squashed frame pressed against it for the beat, then pops off. Copy: `THISTLET clings tight!` — hunger bar ticks the same frame, per house same-frame-feedback law.

**Snare-catch difficulty** (forward spec, sprint-3 beat): the shared pinned curve, no per-species modifier — 20% at HP 6, 40% at 4, 60% at 2, 70% at the floor of 1. Thistlet is the **teach**: grass at the town door, berry bushes and the whole pantry loop thirty steps away. The tutorial catch happens here, and the geography — not a stat — is what makes it the easy one.

**The one juice beat that sells it: the latch.** On a failed snare throw, the snare visibly lands ON Thistlet and sticks for one beat before it shakes free — spikes flare once, two cream ticks drift off, snare gone. The player's own miss becomes proof of the fantasy: this thing grabs and holds, and one day it holds onto *you*. One extra held frame plus two 1px ticks; nothing the fps guard will ever feel.

---

## 2. WICKERBILL

**One-line fantasy.** A stilt-legged wading bird woven out of dry rushes, stalking the grass rows like a stitch looking for cloth.

**Silhouette at 16px — class: tall-thin-angular.** A vertical figure ~14px tall and never wider than 6px — the tallest, thinnest body in the game. Narrow reed-bundle body in the upper third with two diagonal weave strokes across it (the "wicker" read); a straight wedge bill at head height pointing toward the player side; two 1px stilt legs dropping ~5px to splayed feet, with clear daylight under the body; a short 3px tail-vane at the back edge. One high eye dot.

*Why it cannot be confused with anything shipped:* the game has no tall-thin biped. The only other tall-thin glyph, the fiber plant, is four parallel headless stalks with no legs and pale yellow-green color. Against Thistlet: stilts-with-daylight vs belly-on-the-ground; straight angular limbs vs convex spiked rim. Squint at 1x in grayscale and one is a wide blob, the other a tall stick — that is the bar, met with margin.

**Palette rows** (zero red):

| Role | Hex | Kept apart from |
|---|---|---|
| Body rush brown | `#a08252` | Sits between path `#c9a86a` and stump `#8a6a42` — deliberately quiet, because blue carries the identity |
| Weave hatch / underside | `#7a6238` | — |
| Bill, legs, tail-vane — dusk blue | `#4a5d8a` | Grayer and darker than water `#3a6ea5`; nothing else in the game is a mid dusk-blue accent, so "the blue-billed tall one" is a one-glance read |
| Blue line work | `#2e3a56` | — |
| Eye | `#1c1c22` | House ink |

The browns are the atlas's most crowded family (path, fence, trunk, stump, facade) — which is exactly why Wickerbill's brown is body-fill only and the **dusk blue bill is the identity feature**. Color-weak players still get silhouette class; everyone else gets blue as confirmation.

**Type / temperament.** Reed; patient stalker. (Same disclaimer: fiction and copy only.)

**Encounter zone.** All Bramble Run tall grass — (8,2)-(9,2), (12,12)-(13,12), (17,12)-(18,12). The route-map creature, living exactly where WILD-4 plants the snare supply chain — that ticket's own words: "so the snare's supply chain lives where the monsters will." Crossing the map boundary IS the encounter-table change; species = place, and the world map teaches itself.

**Announcement line.** `A WICKERBILL stalks near!`

**Battle behavior in the turn structure.** Same pinned machine, same 4-hunger press — differentiated in presentation: the stilt-lean. Wickerbill tips ~20 degrees forward rotating about its feet, holds one frame at full lean (height suddenly reads as reach), then the bill snaps down-and-back inside the beat. Copy: `WICKERBILL pecks sharp!` Two frames, one rotation, 180ms, fps-guard-safe by construction.

**Snare-catch difficulty** (forward spec, sprint-3 beat): the same shared curve — and I am on the record now for the sprint-3 table: **keep it shared**. The harder second catch we want already exists structurally, free: berry bushes are Mosshollow-only, so every Bramble hunt runs the hunger bar down with no local refill — softening Wickerbill costs the same 12 hunger but the pantry is a map away. Difficulty by geography and logistics, not by a second knob. If the table still wants a stat lever, the honest one is a per-species CATCH_BASE proposed at planning — and my starting position will be against it.

**The one juice beat that sells it: the misdirection stalk.** On battle entry, after the ink-silhouette beat, Wickerbill's palette fills while it takes one single sideways stilt-step (2px strafe, one beat) before settling — the only creature that MOVES during its reveal. Thistlet is planted; Wickerbill is mid-prowl, and the first half-second tells you which temperament you drew before you read a single word. One translate, one beat, zero new systems.

---

## 3. The red-family audit — pre-cleared by spec, still run day-of

My WILD-3 cold read, on the record: "Watch the red family: the player critter and the berry dots share hue space; standing adjacent there is a genuine one-beat double-take... re-audit the moment NPCs or more red items arrive."

This sheet answers that flag by refusal: **the red family keeps exactly two members.**

| Glyph | Red-family pixels |
|---|---|
| Player (shipped) | `#d1495b` body, `#a83347` cowlick, `#7a1f2b` wedge |
| Berry dots (shipped) | `#ff4d78` fill, `#7a1030` outline |
| Thistlet | **none** — moss `#5f7a4a`/`#40542f`, cream `#e6dcc0`/`#8a7f63`, ink |
| Wickerbill | **none** — rush `#a08252`/`#7a6238`, dusk blue `#4a5d8a`/`#2e3a56`, ink |

In the battle panel the player-side avatar is the only red object on screen, against a moss-green or rush-brown wild — maximum player/wild separation precisely in the scene with no audio to disambiguate. Risk 3 ("no audio pushes screens toward red... this sprint's schedule bomb") is defused by spec, not by luck. The day-of audit at shipped scale (player vs berry dots vs each species) still runs when the art lands, per acceptance — this table makes it a formality instead of a redraw.

---

## 4. Catch economics — why the numbers already teach the right loop

All arithmetic from pinned Decision-10 constants and shipped WILD-2 rates; nothing new invented.

**The curve, as STRIKE_DMG 2 actually visits it:** HP 6 → 20% · HP 4 → 40% · HP 2 → 60% · HP 1 (floor) → 70%. Three strikes reach the floor; the floor means a catch can never be struck out of existence — **the optimal line is also the safe line**, which is exactly the beginner-proofing a first catch needs.

**The snare is fiber-priced.** Snare = 1 wood + 2 fiber. Post-WILD-4 the world holds two fiber plants (one per map) at 1 fiber / 60s each — a hard ceiling of ~1 snare per minute farmed perfectly — while one tree cycle (3 chops → 2 wood) funds two snares, so wood never binds. Fiber is the currency the catch spends.

**Throw-at-full is the trap the economy punishes gently:** expected 5 snares (1/0.20) ≈ 10 fiber ≈ five minutes of perfect two-map farming, plus ~4 failed-throw wild turns = 16 hunger. **Soften-first is the discount:** 3 strikes cost 12 hunger of presses, then expected ~1.4 snares (1/0.70) ≈ 3 fiber, ~2 more hunger. The fight converts five expected snares into one and a half — **the battle IS the catch's price mechanism**, and because hunger is the health bar, every battle spends the pantry, which makes cooking (roast berry 60) the battle-prep move. Sprint 1's gathering, sprint 2's crafting and cooking, and the catch all pull on one rope. A wasted snare is felt — a minute of gathering, gone on the throw, hit or miss — but nothing is ever unrecoverable: HP floors, Flee always exits, remaining snares stay held.

---

## 5. What this sheet refuses to do

- **No third species.** The record pins two (Decision 11); the descope floor is two; one unmistakable pair beats a mushy trio. The third species is a sprint-3-or-later planning conversation with its own silhouette class (my reservation: mid-height-segmented is the open slot).
- **No new CONSTANTS, no per-species stats.** Decision 10 closed at the table. Both species run WILD_HP_MAX 6 and the shared catch curve; identity is carried by silhouette, palette, staging, copy, and two-frame animation beats that live inside BATTLE_BEAT_MS.
- **No type chart.** No mechanical hook exists; inventing one inside an 8-pointer is exactly the second-state-machine move Elena banned.
- **No red. Not a pixel.** The double-take I flagged on WILD-3 does not get a third participant on my signature.

*— Marcus. The first three seconds are a step, a wipe, and a shape in ink. Make the shape unmistakable and the rest of the sprint gets to be arithmetic.*
