# Sprint Planning Minutes — Verdant Wilds (WILD), Sprint 1

**Date:** 2026-08-13
**Chair:** Priya "PJ" Joshi, Senior Producer
**Scribe:** Sam Okafor — in the room and on the attendee record, per the PONG retro ask; Sam cuts the tickets after this meeting and leaves a creation note on each.

## Attendees

| Person | Role |
|---|---|
| Priya "PJ" Joshi | Senior Producer (chair) |
| Marcus Vale | Creative Director |
| Elena Vasquez | Engineering Lead |
| Quinn Reyes | QA Lead |
| Devon Park | Engineer — sole dev on this sprint's tickets |
| Sam Okafor | Scribe / board ops |

## Where we start

Greenfield flagship. New folder `studio/projects/wilds/`, new repo, no prior tickets — nothing to regress, everything to found. The vertical-slice contract is six pillars across multiple sprints; this sprint ships pillar 1 (tile overworld) and pillar 2 (survival gathering + hunger) whole and starts pillar 6 (readable original presentation). Ship constraint restated and non-negotiable: double-click `index.html` from disk — plain script tags, no modules, no build, no server, no network, no audio, no image files; all art code-drawn at load.

One fact framed this whole meeting: half the room carries a coaching note from the PONG cycle about the same root defect — acceptance lines our rig could not literally execute, signed off "verified by construction." Mine says validate every criterion against the rig before it enters a ticket. Elena's says confirm the rig can deliver before asking QA to verify live. Quinn's says never self-waive — escalate. Marcus's says evidence goes on the board during the sprint, not first at retro. So this meeting ran an explicit rig adjudication (below) before pointing, and nothing in this plan asks for evidence we have not named a producer of.

## The room, in their own words

**Marcus Vale (Creative Director):** "The first three seconds decide this game: double-click, hold a direction, and the step must feel tile-locked and instant — that's the whole difference between 'found Game-Boy classic' and 'web toy with a grid.'" His order of battle: movement seams first (tap-turn, buffered inputs, zero idle frames between tiles), then same-frame interact feedback — "no audio allowed, so the screen does all the talking" — then a tileset that survives a cold read by someone who didn't draw it. One structural demand, adopted whole: the sim runs on a harness-steppable clock from WILD-1 day one, "so every timer line in PJ's acceptance is executable as written — we are not re-litigating 'verified by construction' this cycle." He made one design ruling in the room so it isn't argued mid-sprint: opening the inventory pauses the world, Game-Boy style — "nobody starves while reading the inventory we're teaching them to use." On the cold-read he takes personally: "a check that can't fail isn't a check" — a written protocol, named confusable pairs, and exactly one priced revision loop. Per his coaching note, his feel notes and captures land as ticket comments the day each ticket goes live.

**Elena Vasquez (Engineering Lead):** wants "the simplest shape that survives all six pillars": game logic in plain scripts that also load headless in Node behind an export guard, one CONSTANTS block, a fixed-timestep sim, seeded RNG, and the offscreen-atlas render path built in WILD-1 with placeholder art "so WILD-3 is drawing, not plumbing." Her one demand before any ticket opened: every "live session, on camera, witnessed by human eyes" line gets checked against what the rig can literally deliver today and amended here on the record — "that was our PONG lesson and I'm not re-learning it at verification time." On the no-modules ship constraint colliding with headless testing: plain script tags do not import into Node, so the export-guard split is load-bearing for the whole scheme — "this is the sequencing hill I will die on in review." Her closing line is the sprint's epigraph: "The harness proves the numbers; humans prove the feel; neither substitutes for the other."

**Quinn Reyes (QA Lead):** the 100k-frame collision/camera harness "is the real foundation this sprint, not a checkbox" — one dev building sequentially means WILD-1's bugs are everyone's bugs. Two things she wanted settled before code, and got: an injectable clock so hunger and respawn timers simulate ("not me watching a real clock tick by"), and written tolerances on every live-measured number now — citing PONG-1's ~375 px/s under throttling against a clean 300 spec as the ambiguity she will not re-litigate mid-sprint. Her live sessions run against "the actual double-click index.html over file:// — not a dev server standing in for it, the exact gap Priya flagged as a planning bug last cycle." Per her coaching note she flagged at planning, not quietly at sign-off, that WILD-1's live session and WILD-3's cold-read and ritual need hands and eyes she cannot self-certify — booked by name in Decision 6. On the cut: if WILD-3 goes, pillar 6 is "started, not done, full stop — no backdating a readability pass we didn't run." And she will keep a visible in-progress trail on the board while testing — no more silent windows ending in a batch close.

**Devon Park (Engineer, sole dev):** took the build order, the constants-block-from-day-one carryover (his own PONG lesson), and the seam-authoring note into his handoff plan; re-affirmed the standing agreement that status lines cite board state — column and merge hash — not intentions.

**Sam Okafor (Scribe):** in the room, on the record; cuts the three tickets from the final table verbatim after the meeting, with a creation note on each.

## Rig adjudication — every live line checked before it enters a ticket

Per my coaching note, the brief's evidence lines were run against the rig we actually have, in the room, before pointing:

| Line as briefed | Can the rig execute it as written? | Ruling on the record |
|---|---|---|
| 100k frames; 10 simulated minutes; 180s drain; 60s respawn | Only on an injectable fixed-step sim clock | Clock is mandated WILD-1 acceptance; all timer lines run headless in wall-clock seconds. If the clock slips, these lines return to the board for amendment before anything is called done. |
| "Captured on camera" (WILD-2), "frame-stepped capture" (WILD-3) | Not demonstrated — PONG's untraceable "capture" claims are exactly this hole | **Amended now:** a named runner performs the session live from disk, a named witness watches where the line requires one, and the runner or witness logs the result as a ticket comment with screenshots where a still carries the evidence. Frame-exact claims split into a harness-assertable state half plus live attestation. Video, if it materializes mid-sprint, is welcome surplus — never the gate. |
| "fps holds within the rig's measured window" | The rig has demonstrated a steady sampled reading (PONG-1 held ~20s), not a continuous minute | WILD-1's live session records sampled fps plus window size as the baseline; WILD-3's bar is within 10% of that baseline, same machine and window. No bare numbers. |
| "Double-click from disk" | Yes — and it is the only load QA accepts | All live sessions run on true `file://`, never a dev server. |
| "Witnessed by human eyes / Marcus or Quinn, not the author" | Needs booked names, not a vibe | Booked: Marcus takes the cold-read; the sprint-close ritual is performed by Quinn and witnessed by Marcus, scheduled before the last day. Unbooked at ticket time = blocked, not passed. |

Standing rule, restated from PONG and enforced by the chair: nothing signs off "verified by construction," and any line that proves unexecutable mid-sprint comes back for amendment on the record — a disclosed miss is still a miss.

## Pointing discussion

Planning poker, two rounds where needed. The disagreements were substantive; they are recorded.

| Ticket | Marcus | Elena | Quinn | Settled |
|---|---|---|---|---|
| WILD-1 | 5 | 5 | 8 | **8** |
| WILD-2 | 5 | 5 | 8 | **5** |
| WILD-3 | 5 | 3 | 5 | **5** |

**WILD-1.** Quinn opened at 8 on blast radius — a WILD-1 defect blocks the other two tickets outright. Chair ruling, consistent with the PONG-2 precedent: blast radius is a sequencing problem, not a sizing input — points on this board track build-and-integration effort. But the second argument stuck: after adopting Elena's architecture whole (headless logic split, injectable clock, seeded RNG, atlas path with round-after-scale, harness scaffold and static ship-scan) plus Marcus's feel amendments (turn-lock and buffer windows, zero-idle seam chaining, transition continuity), WILD-1-as-amended is plainly a bigger build than WILD-2 — and two tickets that different cannot both be 5. Elena moved up on relative size ("the shapes are simple; there are just more of them than WILD-2 has"); Marcus moved up to keep the feel work priced so nobody shaves it under pressure. Re-vote: 8/8/8. **Settled 8 — on scope, not fear.**

**WILD-2.** Quinn's 8 priced the verification tail: fresh-load regression loops, real 180-second drains, ten real minutes per harness run. The room's answer was to engineer the tail away rather than pay dev points for it: the sim clock makes ten minutes cost seconds, the menu-pause ruling makes hunger states reachable deterministically, and the HUD exposes a state model the harness asserts without pixel-reading. Quinn re-voted 5 with her condition on the record: **if the steppable clock is not real by WILD-2, the ten-minute lines are unexecutable as written and come back for re-adjudication before anything is called done** — written into the ticket's first acceptance line, not left to goodwill. Her original 8 and its reasoning stand in these minutes as honest dissent. **Settled 5.**

**WILD-3.** Elena held 3: the atlas path is pre-built in WILD-1, so this is "drawing, not plumbing." Marcus held 5: a cold-read that can't fail isn't a check, and the two extra points price exactly one revision loop — redrawing bounced tiles is build work, not verification. Quinn at 5 for the per-class scoring and the human coordination this ticket leans on hardest. **Settled 5. Elena's dissent recorded:** if the cold-read passes first try, we over-paid two points, and she will say so at review.

**Commitment: 18 points, eyes open.** Elena's capacity read for one dev building strictly sequentially is nearer 13, and nobody argued with her. The contract this sprint must keep — pillars 1 and 2 whole, pillar 6 started — closes at 13 (WILD-1 + WILD-2, with pillar 6's atlas path and readability-first placeholders standing as the start). WILD-3 whole is the stretch, and it is the pre-agreed cut with a pre-agreed trigger: the cut decision is made on the board at the WILD-2 merge, not silently on the last day. Inside WILD-3, decorative tile variants descope first at the same cold-read bar. Payroll burns the same either way; we earn back what ships, and an honest 18 with a named valve beats a pretty 13 that hides the stretch.

## Decisions

1. **Sprint shape and cut order.** Three tickets, WILD-1 → WILD-2 → WILD-3, one dev, built sequentially; each merge leaves the game runnable from disk. WILD-3 is the sprint cut; decorative tile variants are the intra-ticket cut inside it; the whole-ticket cut call happens on the board at the WILD-2 merge. If WILD-3 is cut: placeholders ship, pillar 6 records **started, not done**, nothing presentation-shaped passes retroactively — and the sprint-close human ritual still runs on placeholders, because that lesson is sprint-scoped, not ticket-scoped.
2. **Architecture spine, mandated in WILD-1** (Elena's shape, adopted whole): logic/render split with game logic loadable headless in Node behind an export guard — no DOM or canvas in logic; fixed-timestep sim on an injectable clock the harness drives; a single CONSTANTS block holding every tunable, starting knobs `STEP_MS=200`, `TURN_LOCK_MS=120`, `BUFFER_MS=80`, `CHOPS_PER_TREE=3`, `RESPAWN_S=60`, `HUNGER_DRAIN_S=180`, `BERRY_RESTORE_PCT=25`, `FLASH_HZ=2`; seeded RNG; renderer drawing through a code-built offscreen atlas from day one with round-after-scale integer snapping (Marcus's crawl guard — retrofitting it under WILD-3 is a misery week). The versioned harness lands in `wilds/tests/` inside WILD-1, drives the real unmodified game files, and is never referenced by `index.html`.
3. **Design rulings pinned now, not argued mid-sprint** (Marcus, no dissent): (a) the inventory open **pauses the world** — movement locks, hunger drain and respawn timers freeze; (b) famished means step time exactly 2x `STEP_MS` with the meter flashing at a 2 Hz knob — no faint or death state exists anywhere in the state machine; (c) same-frame interact feedback — every valid press answers visibly on its tile within a frame, because with audio banned the screen does all the talking; (d) tall grass is paint — terrain only, zero logic this sprint.
4. **Evidence split and amendments** — per the rig adjudication table above, which is part of this plan: harness-primary for every number and timer; live-human from true `file://` for feel, readability, and fps; "on camera" lines amended to named-runner/named-witness sessions logged on tickets with screenshots; frame-exact claims split into harness half plus attestation half.
5. **Tolerances written at planning** (Quinn's ask): hunger empties at 180s ±1 sim tick; respawn at 60s ±1 tick with collision present throughout; berry restores exactly 25%; famished step duration exactly 2x `STEP_MS`; fps graded only against WILD-1's recorded baseline (value plus window size, same machine), WILD-3 within 10%.
6. **Human gates booked with names.** Cold-read: Marcus (never the author), per-class scoring including the five confusable pairs — grass/tall grass, tree/stump, bush full/picked, fiber full/pulled, path/facade — verdict and screenshot as a ticket comment; one revision loop priced in; a second failure triggers a 30-minute art-direction huddle on silhouette and palette language, not a third grind. Ritual: Quinn performs, Marcus witnesses, booked before the last day, logged on the board by the witness.
7. **Sequencing gate and board discipline.** WILD-2 does not start until WILD-1's harness is green and Quinn's live session is signed on the ticket; a first-capture movement-mush finding (idle seam frames, dropped near-step-end inputs) is a stop-and-fix before anything stacks on it. Marcus posts feel notes day-of per ticket; Quinn keeps a visible in-progress QA trail; Devon's status cites board state; Sam leaves a creation note per ticket.
8. **Scope police.** The inventory panel is an item-driven skeleton — list, cursor, use, over item definitions, nothing berry-hard-coded — and that is the entire sprint-2 concession; QA tests to this sprint's literal acceptance only, and generality beyond it earns no sprint-1 time or credit (Quinn's line, adopted). The brief's out-of-scope list stands unamended: no monsters, encounters, or tall-grass logic; no crafting or camp; no save/load or fainting; no audio; no NPCs, second route, procgen, or frameworks.

## Risks

- **The clock is last cycle's ghost** (all three voices): every timer line hangs on WILD-1's injectable clock. If it slips, WILD-2's lines are unexecutable as written and return for on-the-record amendment — never a quiet PASS. Mitigation: the clock is WILD-1 acceptance; nothing downstream starts without it.
- **No-modules vs headless Node** (Elena): plain script tags don't import, so the export-guard logic split is load-bearing for the entire rig-honest scheme — proven by WILD-1's headless-load acceptance line, and the hill she has said she will die on in review.
- **Wall-clock drift** (Elena): timers on wall clock would pass headless and drift live — the worst kind of green. The accumulator pattern is decided in WILD-1, not discovered in WILD-2.
- **Movement mush** (Marcus): dead frames at tile seams or dropped corner inputs read instantly as "cheap web game." First capture showing either is a stop-and-fix under Decision 7, before WILD-2 stacks systems on bad feel.
- **Subpixel crawl** (Marcus): round-after-scale lives in WILD-1's renderer from day one; discovering shimmer under WILD-3 means replumbing during the art ticket.
- **The seam is authored, not discovered** (Marcus; owner Devon): the town/route shared edge must align row-for-row or the transition reads as a teleport; author the seam first — the harness round-trip assert is the net, not the plan.
- **Capacity** (Elena, chair): 18 committed against a one-dev velocity nearer 13. The valve is Decision 1's cut ladder with its named trigger at the WILD-2 merge; if WILD-2's menu skeleton starts growing into a UI framework, that is where it gets caught.
- **Cold-read failure, twice** (Marcus): one revision loop is priced; two misses mean the silhouette and palette language is wrong at the root — art-direction huddle, not a third grind. Placeholders keep walkable-vs-solid distinct from day one so WILD-3 iterates on a base that already reads (Elena).
- **Human gates need booked humans** (Quinn): booked in Decision 6; if a slot evaporates when the ticket lands, the honest status is **blocked**, not passed — no self-certification.
- **Fresh-load QA loops** (Quinn): no save/load means every live regression restarts from scratch across three resources and a 180s drain. The sim-clock harness absorbs most of it, but live re-verification is slower this sprint — documented here so a longer QA cycle reads as context at review, not a performance problem.

## Final ticket table

| # | Ticket | Type | Points | Order | Cut position |
|---|---|---|---|---|---|
| WILD-1 | Walkable original overworld on the steppable-clock foundation | story | 8 | 1st | ships regardless — everything stands on it |
| WILD-2 | Gathering, inventory, hunger | story | 5 | 2nd | ships regardless — pillar 2 is contract |
| WILD-3 | Original readable presentation | story | 5 | 3rd | sprint cut; decorative variants are the intra-ticket cut |

**Sprint goal:** Ship Verdant Wilds' foundation from a double-clicked index.html: a grid-true original overworld (Mosshollow and Bramble Run) and the full gather-famish-eat survival loop — pillars 1 and 2 whole on a harness-proven, steppable-clock architecture, with pillar 6's readable original presentation started.

**Immediate checkpoints:** Devon authors the town/route seam row-aligned before movement code; the harness and injectable clock land inside WILD-1 before it reaches qa; WILD-1's live session records the fps-plus-window baseline; the cut checkpoint fires at the WILD-2 merge; the Quinn-plays, Marcus-witnesses ritual is booked before the last day; Sam cuts these three tickets verbatim with creation notes.

— PJ
