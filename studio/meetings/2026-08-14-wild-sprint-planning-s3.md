# Verdant Wilds (WILD) — Sprint 3 Planning Minutes

**Date:** 2026-08-14 · convened 11:05Z, closed 11:52Z
**Chair:** Priya "PJ" Joshi (Senior Producer)
**Scribe:** Sam — at the table and on the attendee list this cycle, per the sprint-1 retro ask; re-sprint notes per object are Sam's to leave
**Attendees:** PJ (chair) · Marcus Vale (Creative Director) · Elena Vasquez (Engineering Lead) · Quinn Reyes (QA Lead) · Devon Park (Developer) · Sam (Scribe)
**Speaking from the board, not present:** Noor — the two WILD-6 ambiguity flags on today's agenda are Noor's; taken up and ruled below as Decisions 16 and 17.

**Inputs on the table:**

- Sprint brief, 2026-08-14 (PJ)
- Creature sheet posted on WILD-6 at 10:31:15Z (Marcus) — `studio/briefs/2026-08-14-wild-creature-sheet.md`; delivers retro Action 4 before planning, as required
- Decision-9 consequence, chair-logged on WILD-6 at 09:59:46Z: the snare-catch beat arrived at this table **pre-cut**. Nothing at this table reopened it, and no ticket below contains it.
- Board at open: main `6c74459`; sprint 2 closed 0/18 — nothing built, nobody lied; zero open bugs, correctly zero; WILD-4/5/6 carried in `todo`; gate objects WILD-7–18 live with named assignees per Decision 12
- Budget: payroll has burned two sprints against sprint 1's banked 18. This sprint converts carried work into shipped points, or the line keeps falling.

---

## 1. The room

**Marcus Vale (Creative Director).** The sprint lands or dies in the first three seconds of pillar 3: "a grass step, a 450ms wipe, and a shape in flat ink — if that reads as a beat-then-announcement instead of a flicker-then-paint-bucket, the sprint lands." His day-of reads on WILD-7, WILD-10, and WILD-14 are terms of his employment, not commentary, and he asked for the backstop out loud: treat his silence as the same-day escalation the standing rule makes it — "page the mid-sprint chair the moment I go quiet, and I will thank whoever does it." Three rulings requested from the chair: WILD-14 stays one object with three named verdicts in a single comment; WILD-17 reassigns to him as logger, Quinn named performer in the body, slot booked before the last day; and WILD-6 re-points to 5 — "6 is not a number at this table… the honest neighbor is 5, not 8."

**Elena Vasquez (Engineering Lead).** Devon opens WILD-4 commit 1 the minute this closes — the sprint is won on how fast the two 5s land, because sequencing parks the hardest first-of-kind work (a new scene type plus two species of code-drawn art) at the end with the least slack. On the re-point: "6 isn't on our scale, and rounding the riskiest ticket down to 5 is how a table lies to itself — WILD-6 stays an honest 8, we commit 18 against my ~13 read eyes open." Two lines of board drift must be corrected at re-sprint before anyone builds or rules against them (WILD-6's stale catch title/desc; WILD-16's stale framing). Her own gates don't move: pre-QA re-adjudication on all three tickets from a fresh pull and a true double-click, never from the handoff; every merge hers, --no-ff, ticket ID in the message. Brought the held-dev policy in writing, with Devon.

**Quinn Reyes (QA Lead).** Holding every sprint-2 fix to the letter, starting with re-paging any BLOCKED gate of hers every 30 minutes with elapsed time until the chair rules. The arithmetic still doesn't close: "PJ's own 'proposal: 6' isn't a fibonacci value this team uses," and whatever WILD-6 lands at, the total is north of ~13 — so WILD-16's cut call must land inside its promised hour for real, because her live thread, Marcus's cold read, Elena's re-adjudication, and the close ritual all inherit whatever ambiguity is left on WILD-6 today. On the ritual: "performing the loop and being the one who certifies it passed is the exact self-waive pattern my last review flagged — Marcus holds the pen, or we split it, but it doesn't close under my name alone." And on scope: cutting the catch shrank Devon's build, not her verification surface.

**Devon Park (Developer).** Confirmed the mandated order and the WILD-6 dark-code commit plan — species atlases and the battle scene land behind the export guard first, the encounter roll wires in last, main shippable at every stop point. Ready to open WILD-4 commit 1 at close; the objects his hold waited on exist.

**Chair's note (PJ).** I proposed the 6 in the brief, and the room is right that it isn't on our scale. Withdrawn at the top of the pointing round — the knob rule applies to points too: nobody invents a number mid-table. That one's mine.

---

## 2. Pointing — planning poker, recorded

**WILD-4** and **WILD-5**: re-affirmed at the carried **5 each**, all cards matching, no contest.

**WILD-6**, round 1 (chair's brief-proposed 6 withdrawn as off-scale before cards): **Marcus 5 · Elena 8 · Quinn 8.**

- *Marcus for 5:* catch pre-cut per the 09:59:46Z log, every knob pinned in Decision 10, red audit pre-cleared by the posted sheet — "if anyone at this table still reads it 8, it does not fit this sprint and we hear that argument now, not at WILD-16."
- *Elena for 8:* the cut removed scope, not first-of-kind risk — the first new scene type since sprint 1, two species of code-drawn art, famish fuzz bit-identical in and out of battle; rounding down flatters the capacity math and under-banks the sprint if it ships.
- *Quinn for 8:* the verification surface is unchanged — encounter distribution, the headless wipe test, battle invariants, famish fuzz, the fps guard, the live thread, and the close ritual are all fully in scope with or without Throw Snare; 5 undersells the test load next to WILD-4/5.

Round 2 after argument: **Marcus 5 (held) · Elena 8 · Quinn 8.**

**Ruled 8** (Decision 15, 11:26Z). The eng-lead read on build risk and the QA read on verification surface converge, and the fibonacci rule leaves no honest number between. **Dissent recorded:** Marcus reads it 5 and signs the slate at 8; his line for the record — "tighter than I'd like, honest enough to sign." He asked that the 18-against-13 argument be had today rather than discovered at the WILD-5 merge. It was had today, at this table, and it is written down.

**Slate: 5 + 5 + 8 = 18 committed against Elena's ~13 one-dev read, eyes open, second sprint running** — softened by the pre-cut catch commit. Re-pointing is never the valve; whole-ticket WILD-16 is. The descope floor is unchanged and not cuttable: the two-species minimum and shipped-scale readability.

---

## 3. Decisions

**Decision 15 (11:26Z) — WILD-6 holds at 8; the slate is 18, eyes open; WILD-16 is the valve and runs on the clock.** The brief's "proposal: 6" is withdrawn as off-scale; 5 is rejected on the round-2 cards and arguments above. At the WILD-5 merge the chair rules **whether WILD-6 proceeds at all this sprint or cuts whole** — on evidence: days remaining vs the 8 remaining, WILD-4/5 actuals vs plan, gate latency to date. Ruling or dated holding note posts on the board **within one hour of the merge**, whichever way it falls. If the chair is dark 30 minutes past a seconded escalation, Elena convenes the room on the board — quorum named, blocked decision named, mid-sprint chair paged by name — and the mid-sprint chair rules. If WILD-6 cuts: pillar 3 still ships whole, pillar 4 records not-started, the sprint banks 10. Nothing passes retroactively.

**Decision 16 (11:31Z) — Noor flag (a) resolved: WILD-14 stays one object, with three named verdicts.** The art lands as one drop and is read in one sitting — one deadline, one same-day escalation. The close comment carries **three separately gradable pass/fail lines**: (1) battle-entry ink-beat readability — flat ink held exactly one BATTLE_BEAT_MS, palette fill next frame, announcement line same frame; (2) Thistlet and Wickerbill as opposite, distinct silhouette classes in grayscale at 1x; (3) the red audit — zero red pixels on both species, player vs berry dots vs each species separated at shipped scale, run day-of regardless of the sheet's pre-clear. Any single failed line files a bug that day. A holistic pass with a buried fail is a review finding, not a pass — Quinn's shaping, adopted verbatim.

**Decision 17 (11:35Z) — Noor flag (b) resolved: WILD-17 reassigns to Marcus Vale as witness/logger of record.** The ticket closes on his log existing, so the final-warning name belongs on the object. The body names Quinn performer: she performs and narrates the full loop, Marcus writes the close comment and moves the ticket. **Standing rule, generalized from Quinn's own flag: a performer never certifies their own ritual.** The dated booking comment is on-ticket **by the WILD-5 merge**; the session runs **before the last day**; each step cites the board or commit reference it verifies — no step closes on narrative alone.

**Decision 18 (11:41Z) — Held-dev pull-forward policy (Elena with Devon), written so the next hold has a rule waiting.** A sequencing-held dev may pull forward **dark code only**: atlas functions, harness fixtures, map data behind the export guard — zero wiring into live scenes. The held dev posts a daily one-liner on the blocking ticket and pages the mid-sprint chair when guard-safe work runs out; silence is never load-bearing. **Rider (Marcus's term, adopted):** pulled-forward art starts the day-of read clock the day it lands on the branch — "day-of" is never arguable, least of all at the one spot a final warning cannot afford ambiguity.

**Decision 19 (11:46Z) — Board hygiene at re-sprint; Sam executes at the table and these minutes say so.** Two lines of drift predate the Decision-9 pre-cut and are corrected before anyone builds or rules against them: (1) **WILD-6** — title still ends "snare catch (sprint cut valve)" and the desc still specifies Strike / Throw Snare / Flee, snare-consumed-on-throw, and a catch recording "a named companion line"; title and desc are replaced with this document's slate text — Strike/Flee only, no companion record, loop closes at flee. (2) **WILD-16** — desc still frames the ruling as "catch: kept or descoped"; reframed to "WILD-6 proceeds or cuts whole." Also at the table: **WILD-13 closes citing Marcus's 10:31:15Z sheet post on WILD-6**; WILD-17's assignee flips per Decision 17; Sam re-sprints WILD-4/5/6 via carryOf — same objects, no duplicates — and leaves a re-sprint note on each object so the scribe function is visible in the record.

---

## 4. Standing confirmations (no new numbers — said out loud anyway)

- **The chair runs on a clock — hard term.** Any escalation naming the chair gets an on-board ruling or dated holding note within the hour; any queue blocked past two hours convenes the room; the mid-sprint chair is staffed and gets paged, not waited on.
- **Marcus's silence on any day-of gate is a same-day escalation**, never a pass-by-default — at his own request.
- **Quinn's 30-minute BLOCKED re-page cadence is accepted.** The cost of answering it lands on the chair, not in ticket points.
- **Rig-honest acceptance carries (Decision 13):** every live line runs mode-aware, the log states the mode, wipe/beat timers may run 0 in named modes, and the held-key wipe test is executable headless as written.
- **Standup lines that say who did what carry a board citation, or they don't post.**
- **Cory's true double-click of `index.html` stays the standing gold invitation — never the gate.**

---

## 5. Risks

1. **Capacity (Elena, Quinn):** 18 against ~13 for the second sprint running, with the 8 parked last and the least slack. Mitigations: dark-code commit order keeps every stop point shippable; WILD-16 ruled on evidence within the hour of the WILD-5 merge — never deferred, never solved by re-pointing.
2. **Marcus is a four-gate single point of failure on a final-warning clock (all hands, including Marcus):** WILD-7, WILD-10, WILD-14, plus the WILD-17 pen. Day-of means day-of even when art lands at 16:50. Mitigations: read slots pencilled at planning close against Devon's landing forecast; silence escalates same-day; the mid-sprint chair page path gets exercised, not admired.
3. **Close-out clustering (Marcus):** WILD-14/15/17/18 gravitate to the final day, and sprint 1's board already showed a two-hour silent queue ending in a 26-second close cluster. Mitigations: WILD-17 booked by the WILD-5 merge and performed before the last day; gates staggered as tickets land, not batched at close.
4. **Feel evidence thins headless (Marcus):** wipe/beat timers legally run 0 in named modes, so the 450/180 staging is human-verified only in Quinn's live sessions and Marcus's reads. WILD-14 is scheduled as the load-bearing thing it is, not a courtesy pass.
5. **Mode-aware logging unproven under load (Quinn):** a substituted mode going un-flagged repeats last sprint's gap between claim and rig. Mitigation: Decision-13 template mandatory; a session-start line (mode + seed) opens every live session so Elena's re-adjudication can replay exactly.
6. **fps guard flake (Elena):** timed draws on the rig are noisy; the 10% A/B guard runs seeded over a fixed frame count, or it files phantom bugs into exactly the slack WILD-6 doesn't have.
7. **Catch leakage (Marcus, on his own document):** the sheet forward-specs catch beats one temptation away from a WILD-6 commit. Pre-cut is a chair consequence, not a suggestion: anyone finding Throw Snare or a CATCH_PCT call site flags it the day it is found — "including me when the leaked beat is mine."
8. **Held-dev dead time (Elena, Quinn):** Decision 18 closes the sprint-2 pattern; pull-forward never crosses into live wiring, so scope cannot move ahead of a cut call that hasn't landed.
9. **Budget (Elena):** two sprints of payroll burned against banked 18. Ship 18 and the line recovers; a WILD-16 cut banks 10 with pillar 3 whole; a slipped WILD-6 risks banking 10 anyway with a broken thread — which is why the cut call is a finance call made on evidence at the WILD-5 merge.

---

## 6. Sprint 3 slate

| # | Ticket (carried — same object, re-sprinted via carryOf) | Type | Pts | Assignee | Gates on the board |
|---|---|---|---|---|---|
| 1 | WILD-4 — Crafting: fiber glyph redraw, craft menu, recipes, snare | story | 5 | Devon Park | WILD-7 (Marcus, day-of) · WILD-8 (Quinn live, mode logged) · WILD-9 (Elena, pre-QA) |
| 2 | WILD-5 — Building: placement tint, placeable kits, and the campfire that cooks | story | 5 | Devon Park | WILD-10 (Marcus, named pairs) · WILD-11 (Quinn live) · WILD-12 (Elena) · **WILD-16 due at this merge (PJ, ≤ 1 hour)** |
| 3 | WILD-6 — Tall grass wakes: encounters, battle, two species — flee closes the loop | story | 8 | Devon Park | WILD-13 (closed at table, sheet cited) · WILD-14 (Marcus, three verdicts) · WILD-15 (Quinn, seed + mode) · WILD-17 (Quinn performs, Marcus logs) · WILD-18 (Elena) |

**Committed: 18 points.** If WILD-16 cuts WILD-6 whole, the sprint banks 10 and pillar 3 still ships whole; pillar 4 records not-started. Nothing passes retroactively.

---

## 7. Close

Planning closed 11:52Z. Devon opened WILD-4 commit 1 at close — the fiber glyph one-pointer is first, per the brief and per Marcus's pricing.

**Immediate actions:**

1. **Sam** — execute Decision 19 at the table: re-sprint WILD-4/5/6 via carryOf with the corrected WILD-6 title/desc, reframe WILD-16's desc, close WILD-13 citing the 10:31:15Z sheet post, flip WILD-17's assignee to Marcus, leave a re-sprint note per object.
2. **Marcus** — pencil day-of read slots against Devon's landing forecast; post the dated WILD-17 booking comment on-ticket no later than the WILD-5 merge.
3. **PJ** — WILD-16 evidence pack standing ready at the WILD-5 merge (days remaining, WILD-4/5 actuals, gate latency); ruling inside the hour, whichever way it falls.
4. **Elena** — post Decision 18 to the board as the standing held-dev note; schedule WILD-9/12/18 ahead of QA close on each ticket.
5. **Quinn** — open every live session with the session-start line (rig mode + seed) so re-adjudication can replay exactly.

— minutes by Sam, reviewed by PJ. The board is the source of truth — and this cycle, every gate on it has a name and a clock.
