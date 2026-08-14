# Verdant Wilds — Sprint 2 Planning Minutes

**Date:** 2026-08-14
**Sprint:** WILD Sprint 2 — three tickets, one dev, built in order; every merge leaves the game runnable from disk
**Chair:** Priya "PJ" Joshi, Senior Producer
**Scribe:** Sam — at the table this cycle, cutting tickets and gate objects today

**Attendees:** PJ (Producer, chair) · Marcus (Creative Director) · Elena Vasquez (Engineering Lead) · Quinn (QA Lead) · Devon (Developer — sole dev on the slate) · Sam (Scribe)

---

## 1. Where we stand

Sprint 1 banked 18/18 on evidence-only closures: cold read signed with zero bounces, the ritual performed-witnessed-logged, fps A/B inside the band, zero bugs filed. Retro entry gates are discharged. Two priced design notes from Marcus's cold read fold into this slate, and one map fact drives WILD-4: Bramble Run currently has zero gathering nodes.

Contract position: pillars 1, 2, 6 shipped on evidence. This sprint ships pillar 3 (crafting/building) whole and begins pillar 4 (taming + battles). Sprint 3 remains a proposal, not a commitment.

Standing rules bound into this plan from the sprint-1 record: rig-honest, mode-aware acceptance (Elena and Quinn's substitution template); every human gate a board object with a named assignee the day tickets are cut, creation notes included — two sprints owed; no last-day stack (QA per ticket with a visible in-progress trail, feel notes day-of, cut calls chair-logged the moment they fall due); fps grades as same-session A/B timed-draw deltas only; Elena's Action-9 seeds discharged at this table, not hallway memory.

## 2. The room

**Marcus (Creative Director).** "The first three seconds of pillar 4 are a grass step, a wipe, and a battle screen with no audio to help it — so the wipe timing, the announcement line, and two species you cannot confuse at shipped scale are where this sprint is won or lost." He named the species at the table and handed Devon the sheet in the room: **Thistlet** (low-round-spiky silhouette; moss green, bone cream) and **Wickerbill** (tall-thin-angular; rush brown, dusk blue) — opposite silhouette classes, zero red dominance, so the red-family audit runs the day the art lands, not at close. His priced one-pointer leads WILD-4 (the regrowing fiber tile keeps collision — it must read "something is here," never open grass), and his one feel demand on WILD-5 goes into acceptance rather than staying a vibe: a two-state valid/invalid tint on the faced tile, cheapest readable version, inside the 5 and inside the fps guard. On his own record, unprompted: "my cold reads and feel notes post on each ticket day-of, my gates go on the board with my name the day Sam cuts tickets, and I'm booked as ritual witness — if the valve fires at the WILD-5 merge, we cut the catch, never the readability."

**Elena Vasquez (Engineering Lead).** "The shape is right — pillar 3 whole, pillar 4 begun, recipes before placement before the grass wakes — but 18 points against the ~13 I read is a stretch with a valve, so we run it like one." Sprint 1's 18/18 "was a streak, not a new baseline." Architecture ruling: one panel-state family drives craft, cook, and battle — the Decision-8 skeleton earning its keep three more times — and one CONSTANTS block holds every new knob with tolerances written today; "nobody invents a second state machine inside an 8-pointer," and anyone who finds themselves doing so flags it the same day as a re-estimate, not a heroic Friday. WILD-6's commit order pins the descope seam — encounter roll, wipe, Strike/Flee, and freeze merge before any catch code exists — "so the cut is one withheld commit, not surgery." Her standard holds: pre-QA re-adjudication comment on every ticket, and if the rig regresses she posts the human-check board request herself, same day.

**Quinn (QA Lead).** "Eighteen points on one dev again, but this time the brief already writes acceptance rig-honest. My real worry isn't the code, it's the gap between 'harness went green' and 'QA actually watched it happen' — that gap is exactly where a sign-off slipped behind its merge last sprint." Her demands, all met at this table: live-verify and cold-read gates on all three tickets as named board objects the day Sam cuts them; WILD-6's encounter tolerance and catch-odds formula written as real numbers today, "not 'a formula' discovered mid-ticket"; an assertable signal behind every feel claim so "same-frame visible feedback" never collapses into "looks fine." Her own commitments on the record: in-progress comments as she tests each ticket, not a batch dump after close, and a same-hour blocker note on the board if her rig goes down again, instead of silence. She also asked that the sequential-build gap — ticket N+1 starting before ticket N's live sign-off lands — "be named now, not rediscovered at retro." It is: Decision 13.

**Devon (Developer).** Took the creature-sheet hand-off in the room; confirmed the commit seams as pinned (fiber glyph is WILD-4 commit 1; the catch is WILD-6's final, separable commit) and asked that every new knob land in CONSTANTS review-ready before WILD-4 opens — done, Decision 10. Committed to Elena's same-day re-estimate rule and to opening each ticket only against gate objects that already exist on the board.

**Sam (Scribe).** At the table and on the attendee line this cycle. Cuts the three tickets and every gate object today with a creation note per ticket — two sprints owed, named in the retro record — and read the final table back to the room verbatim before we broke.

## 3. Pointing

Planning poker, one round per ticket. All three written proposals arrived aligned on 5 / 5 / 8; the argument was about the total, and it was had honestly.

| Ticket | Marcus | Elena | Quinn | Consensus |
|---|---|---|---|---|
| WILD-4 — Crafting | 5 (4 + his priced 1) | 5 | 5 | **5** |
| WILD-5 — Building | 5 (tint folded in) | 5 | 5 | **5** |
| WILD-6 — Tall grass | 8 | 8 | 8 | **8** |

- **WILD-4 — 5, no dissent.** Marcus's fiber-glyph one-pointer is priced inside as commit 1. Quinn's have/need recipe-row demand folded in as presentation state on the existing panel, not a new system.
- **WILD-5 — 5, no dissent.** Marcus's valid/invalid tint accepted into acceptance at the cheapest readable version — two-state tile tint, no animation — so it lives inside the 5 and inside the fps guard.
- **WILD-6 — 8, held, with recorded dissent on shape.** Elena: three systems hide in this 8 (encounter roll, battle machine, catch/record); the number is honest only as a strict reuse of the house panel-state family. Quinn floated splitting the catch beat into its own 3-pointer so a cut would be a dropped ticket rather than a withheld commit; Elena countered that with one dev a split buys no parallelism and the commit seam gives the same clean cut for free; Marcus took the 8 with the descope order written into the ticket. The room held 8.
- **The total.** 18 committed against Elena's ~13 velocity read. Nobody at the table predicted 18/18 twice; Quinn's stated expectation is that the valve fires. We commit 18 eyes-open with the valve pre-agreed and time-boxed (Decision 9) — the plan is the cut being cheap, not the cut not happening.

## 4. Decisions

Numbering continues from the sprint-1 record.

- **Decision 9 — The slate and the valve.** 18 points committed: WILD-4 (5), WILD-5 (5), WILD-6 (8), built in that order, each merge runnable from disk. WILD-6 is the sprint cut; inside it the snare-catch beat descopes first and is sequenced as the final separable commit. **The cut call is made and chair-logged by PJ on the board at the WILD-5 merge, whichever way it falls.** Descope floor: the two-species minimum and shipped-scale readability are never cut. If the catch descopes: battle ships Strike/Flee, the snare stays craftable, catching moves to sprint 3, the contract records pillar 4 as *begun*, and the same chair-logged comment restates the ritual thread as gather → craft → cook → battle → flee — the witness never reads a script the build can't perform. If WILD-4 or WILD-5 slips past mid-sprint, the catch is already gone and we say so that day. Nothing passes retroactively.

- **Decision 10 — Every number pinned now (CONSTANTS block, tolerances written at planning).** Recipes: campfire kit 3 wood · fence piece 2 wood · shelter kit 4 wood + 2 fiber · snare 1 wood + 2 fiber; consume-exact, fail-closed. Cooking: 1 berry → 1 roast berry; ROASTED_HUNGER_RESTORE 60 (named parallel to BERRY_HUNGER_RESTORE 25), clamp-at-full. Encounters: ENCOUNTER_PCT 15, harness tolerance **±1.0 percentage point over 10k seeded grass entries**, exactly zero off grass. ENCOUNTER_WIPE_MS 450 (named rig mode may run 0); BATTLE_BEAT_MS 180 (0 headless). Battle: WILD_HP_MAX 6, STRIKE_DMG 2, WILD_HUNGER_PRESS 4 per wild turn — hunger is the health bar, famish rules unchanged; wild HP floors at 1, so no faint on either side of the screen and Decision 3 stays structural. Catch odds, the formula Quinn asked for by name: **CATCH_PCT = CATCH_BASE 20 + floor(CATCH_SCALE 60 × (WILD_HP_MAX − wildHP) / WILD_HP_MAX)** — 20% at full health rising to 70% at the floor, integer math, exact under seeded RNG (deterministic, no tolerance). Snare offered only when held; consumed on every throw, hit or miss.

- **Decision 11 — Species and the red-family audit.** Thistlet and Wickerbill named at this table; the sheet is Marcus's and posts to WILD-6 before the first battle-art commit. The audit is acceptance, not advice: no red-dominant glyph enters the atlas unaudited, and the WILD-6 cold read scores player critter vs berry dots vs each new species explicitly.

- **Decision 12 — Gates are board objects today.** Sam cuts the three tickets plus a named-assignee board object per human gate, creation notes included: Marcus's four day-of cold reads (fiber glyph; placed pairs — shelter vs map facade, campfire vs everything flameless; battle scene; both species incl. red audit), Quinn's three live mode-logged sessions, Elena's pre-QA re-adjudication per ticket, PJ's cut call at the WILD-5 merge, and the sprint-close ritual — **performer Quinn, witness Marcus, scheduled before the last day**. Marcus's silence is a blocker escalated same day, never a pass-by-default.

- **Decision 13 — Rig honesty, this cycle's edition.** Every live line runs mode-aware per the substitution template; the log states the mode; Cory's true double-click of index.html stays the standing gold invitation, never the gate. The held-key wipe-transition test (a walk key held across the encounter roll must not become a battle-menu press on frame one) is declared **executable headless as written** — synthetic held-key state across the transition frame — with the live-mode repetition riding WILD-6's live line. The sequential-build gap is named here at Quinn's insistence: with one dev, ticket N+1 may open before ticket N's live sign-off lands; we accept it eyes-open, mitigated by gates-as-board-objects and Quinn's per-ticket in-progress trail. If any day's named mode can't run a line as written, it's said on the board that day, not discovered at QA.

- **Decision 14 — Action-9 seeds discharged.** STEP_MS/TICK_MS divisibility lands as a harness assert in WILD-4 (today exactly 12 ticks per step; a knob-turn that breaks divisibility fails loud, never shifts feel silently). Mid-fuzz famish coverage extends into battle in WILD-6: wild hits pressing hunger never produce NaN or negatives, and famish behavior is bit-identical in and out of battle.

- **Chair commitments on the record (PJ).** The WILD-5-merge cut call gets logged within the hour it falls due; any gate I watch being crossed unmet gets a board comment from me in the moment. A "no blockers" standup line has to be true of the gates too.

## 5. Risks — owned, not filed

1. **Capacity — the headline, all three voices.** 18 committed vs ~13 read. The valve only works pulled on time: cut decision at the WILD-5 merge, chair-logged that hour. A late valve is the one failure mode this table refuses in advance.
2. **Marcus is the serial gate (his own flag).** Four day-of cold reads with his name on board objects. His silence is treated as a blocker and escalated same day — never a pass-by-default. Nothing of his posts first at retro this cycle.
3. **No audio pushes screens toward red (Marcus), and berries already own red.** The audit runs the day each glyph lands; discovering a red-leaning battle scene at close and redrawing inside the fps-guard window is this sprint's schedule bomb.
4. **Held-input leak across the wipe (Marcus, Elena concurring)** — the likeliest feel escape of the sprint. Written as a harness test now (Decision 13), not discovered at QA.
5. **Panel genericity (Marcus, Elena).** Battle and cook are skeleton reuses three and four; WILD-4's fake-catalog proof is the early warning and runs before WILD-5 starts. A genericity crack first found in WILD-6 slips the sprint's whole tail.
6. **Hunger-as-health couples battle to famish (Elena)** — the one place a novel death path could sneak past Decision 3 structurally rather than numerically. That is why famish fuzz lives in WILD-6 acceptance (Decision 14) instead of hallway memory.
7. **QA rig reliability (Quinn, her own flag).** If the live rig degrades, live lines lose their only net beyond a dev's own pass. Same-hour blocker note committed; evidence quality still takes the hit and we say so when it happens.
8. **Sequential sign-off gap (Quinn).** With one dev, ticket N+1 can start before ticket N's live sign-off lands. Named and accepted at Decision 13 — not rediscovered at retro.
9. **If the catch cuts, pillar 2's promised thread doesn't close (Marcus).** Hungry-to-first-companion waits for sprint 3; contract language records pillar 4 "begun"; the ritual script changes on the board the day the cut is called.
10. **fps guard discipline (Elena).** Two tickets carry the A/B guard; same-session timed-draw deltas only — an absolute carried across sessions is not evidence, and a miss files a bug, never a debate thread.

## 6. The slate

| # | Ticket | Type | Pts | Dev | Gates (named assignees on the board today) |
|---|---|---|---|---|---|
| 1 | WILD-4 — Crafting: fiber glyph redraw, craft menu, recipes, snare | story | 5 | Devon | Cold read (fiber glyph): Marcus · Live craft session: Quinn · Re-adjudication: Elena |
| 2 | WILD-5 — Building: placement tint, placeable kits, campfire cooking | story | 5 | Devon | Cold read (named pairs): Marcus · Live place/block/cook session: Quinn · fps A/B: Devon · Re-adjudication: Elena |
| 3 | WILD-6 — Tall grass wakes: encounters, battle, two species, snare catch (sprint cut valve) | story | 8 | Devon | Creature sheet + cold read + red audit: Marcus · Live thread session: Quinn · fps A/B: Devon · Cut call at WILD-5 merge: PJ · Ritual: Quinn performs, Marcus witnesses · Re-adjudication: Elena |

**Committed: 18 points, eyes open, valve pre-agreed per Decision 9.**

## 7. Close

Sam cuts tickets and gate objects today, creation notes on every one. Devon opens WILD-4 commit 1 (the fiber glyph) once the objects exist. Marcus's creature sheet posts to WILD-6 today. The ritual is on the board before the last day, performer and witness named above. The next scheduled chair log is mine, at the WILD-5 merge — whichever way it falls.

— PJ, chair
