# Sprint Brief — Verdant Wilds (WILD), Sprint 2

- **Date:** 2026-08-14
- **Author:** Priya "PJ" Joshi, Senior Producer
- **Sprint:** WILD Sprint 2 — one dev, three tickets, built in order, each merge leaves the game runnable
- **Base:** Sprint 1 banked 18/18 on evidence-only closures: cold read signed zero bounces, ritual performed-witnessed-logged, fps A/B inside the band, zero bugs filed. Retro entry gates are discharged. Two priced design notes from Marcus's cold read fold in below. One map fact from that read matters here: Bramble Run currently has zero gathering nodes.

## Concept

Verdant Wilds is a monster-taming RPG with the bones of a Game-Boy-era classic — tile-grid overworld, tall grass, turn-based battles — fused with survival crafting: everything you fight with, you first gathered and built with your own hands. This sprint the promise turns literal: pulled fiber becomes a snare at the craft menu, a campfire cooks your berries, fences rise on the grid, and the tall grass finally stirs with original wild monsters you can catch.

## Contract position

Pillars 1, 2, 6 shipped on evidence. **This sprint ships pillar 3 (crafting/building) whole and begins pillar 4 (taming + battles).** Sprint 3 proposal, not commitment: pillar 4 continuation (your companion fights) and pillar 5 (loop closure, save/load).

## Design pillars

1. **The grid is the truth.** Placement and encounters land on the same tiles movement does: a placed fence blocks exactly like a map fence, a tall-grass step rolls the dice, and any tile still answers "can I walk it, gather it, build on it?" at a glance.
2. **Survival feeds taming.** The supply chain closes its first loop: wood and fiber → snare → caught monster. From hungry to first companion is one unbroken thread the player walks with their own feet.
3. **Original and readable.** Every new glyph — placeables, creatures, the battle scene — enters at the cold-read bar pillar 6 set: shape over color, per-class scoring, one priced revision loop. Marcus's red-family watch flag falls due the moment creature art arrives, so the audit is written into acceptance, not left as a vibe.

## Ship constraint (non-negotiable, unchanged)

Plain static files in `studio/projects/wilds/` — `index.html`, `css/`, `js/` — plain script tags (no ES modules), no build step, no server code, no network, no audio. All art code-drawn at load into offscreen atlases; no image files, no external fonts. New systems arrive as new plain scripts behind the same export guard so the harness drives them headless. If a change breaks "double-click and play," it doesn't merge.

## Standing rules from the sprint-1 record (bound into planning)

- **Rig-honest acceptance (retro hard rule):** every done-when below passed "can our rig execute this as written?" Live lines are written mode-aware per the substitution policy Elena and Quinn are putting into the acceptance template — named rig modes, log states the mode. Cory's true double-click of `index.html` remains the standing gold invitation (retro Action 5), never the gate.
- **Gates are board objects (retro Action 6):** every human gate below gets its own board entry with a named assignee the day Sam cuts the tickets — and a creation note per ticket, two sprints owed.
- **No last-day stack:** QA runs per ticket as each lands, with a visible in-progress trail; Marcus's feel notes post day-of per ticket; cold reads use the adjudicated shipped-scale PNG protocol. Cut calls are logged on the board the moment they fall due — no retroactive repair this cycle.
- **fps grades in the adjudicated same-session A/B timed-draw form** — deltas, never absolutes carried across sessions.
- **Elena's Action-9 backlog seeds** (STEP_MS/TICK_MS divisibility note; mid-fuzz famish coverage) become tickets or harness comments at planning, not hallway memory.

## This sprint ships

Three tickets, one dev, built sequentially; each merge leaves the game runnable from disk. New tunables (recipe costs, restore values, encounter and catch odds, damage) live in the CONSTANTS block with tolerances written at planning, per house rule.

### WILD-4 — Crafting: recipes, the craft menu, and the snare (5 pts = 4 + Marcus's priced 1)
First commit is Marcus's one-pointer, highest leverage on the board: redraw the pulled-fiber glyph — bolder stubs on a small dirt-patch base — because that tile keeps its collision while regrowing and must read "something is here," not open grass. Then the craft menu on WILD-2's generic panel skeleton (the concession Decision 8 priced for exactly this): a data-driven recipe catalog — campfire kit (proposed 3 wood), fence piece (2 wood), shelter kit (4 wood + 2 fiber), snare (1 wood + 2 fiber) — crafting consumes exact costs, adds the item, and refuses shortfalls fails-closed with same-frame visible feedback. Bramble Run gains its own small node set as map data (a tree, a fiber plant) so the snare's supply chain lives where the monsters will. **Done when:** the harness proves every recipe row (consume/add exact, shortfall fails closed with zero mutation, counts never negative or NaN), proves the craft menu freezes the world exactly as the inventory does, and proves panel genericity against a fake recipe catalog; a live session in the day's named rig mode crafts the snare and one kit for real, mode logged; Marcus spot-cold-reads the new fiber glyph at shipped scale against grass and tall grass, verdict on the ticket.

### WILD-5 — Building: placeable kits and the campfire that cooks (5 pts)
Using a kit from the inventory enters place mode: faced-tile placement with validity rules (on-map, walkable terrain, no node, occupant, or player), placed pieces render through the atlas with original glyphs and occupy their tile. Fence and shelter block from all four sides. E on a placed piece picks it back up — the softlock guard; no one-way walls. E on the campfire opens the cook menu (third reuse of the panel skeleton): 1 berry → 1 roast berry, restoring ROASTED_RESTORE (proposed 60 vs the berry's 25); campfire pick-up lives inside its menu so cooking stays one press. **Done when:** the harness proves placement validity fails closed on every illegal target, placed-piece collision from all four approaches, pick-up round-trips the kit exactly, cook-and-eat arithmetic exact with clamp-at-full, and menu freeze intact; the same-session A/B timed-draw fps guard (pre-ticket main vs merged) holds within 10%, a miss files a bug; a live session in the named mode places all three, gets blocked by them for real, picks one back up, cooks and eats a roast berry, mode logged; Marcus cold-reads the placed glyphs at shipped scale per the PNG protocol with named pairs — shelter vs facade, campfire vs everything flameless — verdict on the ticket.

### WILD-6 — Tall grass wakes: encounters, battle, and the snare catch (8 pts — sprint cut)
Sprint 1's twelve painted tall-grass tiles go live: entering one rolls the seeded RNG at ENCOUNTER_PCT (proposed 15) and opens the battle screen through a short code-drawn wipe — no audio, the screen announces. The battle is turn-based in the house panel style against at least two original wild-monster species, silhouette-first, named at planning — Marcus owns the sheet. Actions: Strike / Throw Snare / Flee, on a small integer damage model, all knobs. Proposed shape for planning to pin: wild hits press your hunger — survival is the health bar, famish rules unchanged, and Decision 3 stands: no faint, no death anywhere in the machine; Flee always exits this sprint. Throw Snare offers itself only when a snare is held, consumes it on the throw hit or miss, with catch odds from a CONSTANTS formula that improves as the wild weakens; a catch ends the battle and records the companion as a named menu line. The overworld freezes while the battle owns the screen (menu-pause family). Red-family audit is acceptance, not advice: no new red-dominant glyph enters the atlas unaudited, and the cold read scores player critter vs berry dots vs each new creature explicitly. **Done when:** the harness proves encounter distribution over 10k seeded grass entries within the planning-written tolerance and exactly zero off grass, plus battle-machine invariants — turn order, damage arithmetic, snare consumed on every throw, catch odds exact under seeded RNG, flee exits, structural no-faint/no-death, overworld frozen, companion record exact; the A/B fps guard holds within 10%; a live session in the named mode has a real encounter fire, one fight fled, and the full thread run — gather, craft a snare, walk the grass, catch a wild monster — session seed logged; Marcus cold-reads the battle scene and both species at shipped scale including the red-family audit, verdict on the ticket; and the sprint-close ritual (performer and witness booked by name at planning, board object, before the last day) plays the gather → craft → cook → catch thread end to end, logged by the witness, rig mode stated.

**Capacity, eyes open:** 18 points against the same one-dev velocity Elena read at ~13. The valve: WILD-6 is the sprint cut, and inside it the snare-catch beat descopes first — battle ships Strike/Flee, the snare stays craftable, catching moves to sprint 3. The cut call is made on the board at the WILD-5 merge, chair-logged when it falls due. If WILD-6 is cut whole, pillar 3 still ships whole and pillar 4 records not-started — nothing passes retroactively.

## Out of scope (do not build)

- Your companion fighting for you; party management, stats, levels, XP, evolution, healing — a catch records a companion, nothing more (pillar 4 continues in sprint 3)
- Trainer battles, monster types/abilities charts, status effects; in-battle item use beyond the snare throw — no eating mid-battle
- Save/load or persistence of any kind — placed pieces and companions last the session (pillar 5)
- Fainting, death, respawn-at-camp — Decision 3 stands; the shelter is a solid placeable, not a spawn point yet
- Recipes beyond the four named; cooking beyond berry → roast berry; crafting stations beyond the campfire; durability or repair
- Multi-tile structures, interiors, doors; moving or rotating placed pieces beyond pick-up; new maps — Bramble Run's node seeding is data-only
- NPCs, shops, dialogue, story; a second route, caves, ledges, day/night, weather
- Audio of any kind (studio-head directive); title screen, settings, key rebinding; touch, gamepad, mouse-driven play
- Frameworks, bundlers, TypeScript, image-asset pipelines — see ship constraint

If it isn't in a ticket above, it's a proposal for sprint 3, not a commitment in this one.

— PJ
