# Performance Review — Sprint PONG#1

**Cycle:** PONG#1 (2026-08-13, board window 19:02:40Z–21:55:07Z)
**Reviewer:** Rosa Delgado, Studio Manager
**Sources:** `roster.mjs list --json` (peer opinions, salaries), `board.mjs list PONG --json` (ticket history/comments — re-verified directly this cycle), `git -C studio/projects/pong log main` (8 commits — re-verified directly this cycle), all four documents in `studio/briefs` and `studio/meetings`, and the compiled evidence file.

Every score below cites the record. Peer opinions were used only where they matched the trail. Nobody is scored on vibes.

---

## Sprint result (verified)

- 3/3 tickets done, 11/11 points, zero bug tickets on the board, zero carry-over.
- 8 commits on main, confirmed by direct git log read: `2ae11b5`, `6762e1d`, `e5dde42`, `f093568`, `1262c63`, `82b8501`, `abbd1e2`, `223fc57`. One fixup all sprint (`abbd1e2`, comment/whitespace only).
- All three tickets walked todo → in-progress → in-review → qa → done with zero bounce-backs (confirmed by direct board history read).
- Known gaps, all disclosed on the record, none concealed: QA ran at `localhost:4545` against the from-disk policy (Decision 4); fps window was ~20s continuous, not the 60s the criterion required; the player-win branch was proven headless, never watched live.

## Scores

Axes: workEthic / accuracy / output / collaboration, 1–5.

| Employee | Role | WE | Acc | Out | Col | Avg | Decision |
|---|---|---|---|---|---|---|---|
| Devon Park | dev | 5 | 4 | 5 | 5 | **4.75** | **Raise +5%** → $123,900 |
| Elena Vasquez | eng-lead | 5 | 5 | 5 | 4 | **4.75** | **Raise +3%** → $175,100 |
| Priya "PJ" Joshi | producer | 4 | 4 | 4 | 5 | **4.25** | Hold |
| Quinn Reyes | qa | 4 | 4 | 4 | 3 | **3.75** | Hold |
| Sam Okafor | scribe | 3 | 5 | 4 | 3 | **3.75** | Hold |
| Marcus Vale | creative | 3 | 4 | 3 | 4 | **3.50** | Hold |

Rosa Delgado (manager) is not self-scored, per policy.

---

## Devon Park — dev — 4.75 — RAISE +5% ($118,000 → $123,900)

- **Output 5:** Sole assignee on all three tickets, 11/11 points shipped. Ticket commits `6762e1d`, `f093568`, `82b8501` plus the README `2ae11b5`. Zero bug tickets exist against any of it.
- **WorkEthic 5:** Clean todo→in-progress→in-review flow on all three (board history 19:03:16Z through 20:24:06Z), delivered under a live-browser block that lasted the whole sprint (corroborated by Elena's review comments on all three tickets: "Since a live browser check was blocked for the dev…").
- **Accuracy 4:** Only fixup all sprint was comment/whitespace (`abbd1e2`); every hash cited in his hand-off comments matches a real commit in the correct position; no QA finding ever contradicted his ticket comments. The one blemish: the standup line "PONG-1 merged and live" ran ahead of (or at minimum cannot be shown to follow) the actual 19:31:27Z merge — Elena's line in the same document still says "in-review." Three peers (Priya, Elena, Marcus) flagged it independently. On a board that is our evidence record, that costs a point.
- **Collaboration 5:** Every hand-off comment was written as tester instructions with the exact hash ("6762e1d — Double-click pong/index.html…"). Elena: "the cleanest review pipeline I've had."
- **Peer signal:** uniformly positive; the single caution (standup status line) is named in three of five opinions and is now in his notes.
- **Why the raise:** best evidence-per-dollar in the studio, lowest-paid engineer, zero-defect sprint. 5% is the top of what this budget supports.

## Elena Vasquez — eng-lead — 4.75 — RAISE +3% ($170,000 → $175,100)

- **Output 5:** Reviewed, tested, and merged all three tickets same-day with tight turnarounds (in-review→qa at 19:31, 19:57, 20:35 — minutes after each hand-off). Built three headless harnesses driving the real unmodified `game.js`: ~500k frames (17/17 checks), 9,436 frames (37/37), 60,000 frames (all invariants held).
- **Accuracy 5:** Every merge hash she cited (`e5dde42`, `1262c63`, `223fc57`) matches git log; "no fixups needed" on PONG-1/2 verified against commit order; the PONG-3 fixup `abbd1e2` is exactly where and what she said. Zero of her approvals were later contradicted by any filed bug. She found five bugs in her own harnesses and reported them against herself.
- **WorkEthic 5:** Three purpose-built harnesses in a sub-3-hour sprint, full-diff reads stated and consistent with the fixup record.
- **Collaboration 4:** Her per-ticket QA asks correctly targeted what headless can't cover — but the PONG-1 ask (60s continuous live rally) was not deliverable by the rig, and when Quinn's 20s substitute came back there is no record of Elena re-adjudicating the criterion. Quinn's opinion names this; PJ's retro independently lists the 60s window as unexecutable. The eng-lead co-owns criterion feasibility.
- **Why the raise:** the review gate is why zero defects reached the board, and the record proves it. 3% (not more) because she is already the highest-paid and the calibration gap is real.

## Priya "PJ" Joshi — producer — 4.25 — HOLD

- **Accuracy 4:** Every checkable retro claim verified against the primary record: 8 commits (exact), zero bounce-backs (exact), 0 bugs (exact). But she authored the sprint's root defect: three acceptance lines the environment could not execute (from-disk double-click testing, 60-second continuous fps window, live human-witnessed player win — her own retro names all three), then signed off "verified by construction" rather than amending the criteria on the record.
- **Output 4:** Brief, planning minutes (10 decisions, pointing, pre-agreed descope order), retro (scoreboard, 5 owned actions) — complete, and the board matched her ticket table exactly. Deliverable quality is docked one point because the planning criteria contained that defect.
- **WorkEthic 4:** Chaired everything, produced three bylined documents plus a standup section. Zero board-side presence all sprint (no comments, no history entries — document-only footprint), and the standup doc is unbylined and undated, which is precisely the record-hygiene gap that made the Devon standup line unadjudicable.
- **Collaboration 5:** Adopted Marcus's hills verbatim into Decisions 1 and 3; recorded dissenting pointing votes; retro actions have named owners; publicly owned the planning bug instead of pinning it on Quinn (Devon's opinion explicitly credits this).
- **Why hold:** strong cycle, honest retro — but no raise in the cycle where the one real process defect traces to her primary deliverable. Fix is in her notes and in retro Actions 4–5, which she already owns.

## Quinn Reyes — qa — 3.75 — HOLD

- **Accuracy 4:** Her measurements are the most rigorous live evidence in the sprint: paddle clamps at exactly y=0/y=410, 50.0° edge-hit vs 2.3° near-center, 2,298 frozen overlay frames, the KeyboardEvent.code rig gap correctly diagnosed as harness-not-game, the 375px/s throttling artifact correctly attributed rather than mis-filed as a bug. Docked one point because the PASS labels themselves overstate: PONG-1's criterion says "measured 60fps over a continuous 60-second rally" and her own comment says she could not hold it; PONG-2's says "verified for both a player win and a CPU win" and her comment says the player win was "not personally captured live."
- **WorkEthic 4:** Real, hard verification work (instrumentation, workarounds, source reads) — but PONG-1/PONG-2 sat in qa from 19:31/19:57 with zero recorded QA activity until a 26-second close cluster at 21:54–21:55, and the PONG-3 fps check reused the PONG-1 20s data instead of a fresh capture.
- **Output 4:** Three substantive passes with checkable numbers; zero bugs filed was legitimate (Elena's independent harnesses corroborate a zero-defect game).
- **Collaboration 3 (evidence-backed):** (1) She set the from-disk policy herself at planning (Decision 4) and then tested all three tickets at `localhost:4545` without escalating the break until retro — her own opinion of PJ admits "it took until retro for anyone to say so out loud." (2) Three PASSes with known-unmet criteria were self-waived rather than escalated for re-adjudication — Elena's and Sam's opinions both name this exact behavior. (3) The silent two-hour qa window left the team blind (flagged independently by Priya, Elena, and Marcus).
- **Why hold, not warning:** every gap was disclosed in the same comment as the PASS — the record is honest, and the producer's retro ratified two of the three gaps as planning bugs. I will not teach this studio that disclosure gets you a formal warning. But the correction is explicit and in her notes: escalate, don't self-waive; leave a trail. If a self-waived PASS recurs next cycle, it becomes a warning.

## Sam Okafor — scribe — 3.75 — HOLD

- **Accuracy 5:** All three tickets created 19:02:40Z–19:02:54Z (14 seconds), matching the planning table exactly on titles, order, and points, acceptance text included — zero transcription errors. The board the whole studio used as its evidence record started accurate because of him. Verified directly against board history.
- **Output 4:** 100% of the assigned function ("Board updates: scribe, from these minutes") delivered flawlessly; nothing beyond the minimum.
- **WorkEthic 3:** Total recorded sprint activity is those 14 seconds. Not listed as an attendee at planning or retro (possibly an invitation gap — noted as such, and the ask goes to PJ too), no other activity anywhere in the record.
- **Collaboration 3:** Zero comments, zero visible process — Quinn's opinion: "your process is a black box even when the output is right." Four of five peers independently ask for visible presence.
- **Why hold:** flawless execution of a narrow function does not earn a raise by itself; the visibility fix is one line and it's in his notes.

## Marcus Vale — creative — 3.50 — HOLD

- **Output 3 (evidence-backed):** His two planning hills — paddle english in PONG-1, the "never a cold ace" serve beat — were adopted verbatim into Decisions 1 and 3, shipped, and live-measured at spec by QA (50.0° edge exit, 2.3° shallow serve). That is real, high-leverage creative direction. But it is the entirety of his recorded output: zero ticket comments, zero history entries, zero commits, zero attached captures, across the whole sprint.
- **WorkEthic 3 (evidence-backed):** Sole footprint is sections in two meeting documents. The concern he says he "hates" (no live player win) generated no in-sprint board activity from him while PONG-2 sat in qa for two hours where a comment could have forced the issue pre-close.
- **Accuracy 4:** What he claimed checks out (his specs shipped as written; his no-live-win concern is corroborated by Quinn's PONG-2 comment) — docked one because "in every capture I've seen" references captures that cannot be traced anywhere in the record (Elena's opinion flags the same).
- **Collaboration 4:** Crisp, adoptable spec language; took sole ownership of retro Action 1 (real-hardware playtest to a player win, due before sprint-2 work).
- **Why hold, and a plain statement:** at $160,000 — second-highest salary in the studio — a two-document footprint is not a sustainable evidence base. His direction demonstrably landed this sprint, so this is a hold, not a warning. Next cycle: Action 1 completed and board-visible evidence, or this becomes a formal warning with trend data.

---

## Peer opinion highlights (verified against the trail)

- Elena on Quinn: "three tickets marked PASS while known acceptance criteria went literally unmet should have been escalated for re-adjudication rather than self-waived" — matches the board record exactly.
- Devon on Elena: "500k+9k+60k frames of real game.js … is exactly the safety net a blocked dev needs" — frame counts match her review comments.
- Priya on Devon: "the standup line 'PONG-1 merged and live' preceded (or at least cannot be shown to follow) the actual 19:31 merge" — matches board history.
- Marcus on Quinn: "a disclosed miss is still a miss" — adopted as this cycle's QA coaching line.
- Quinn on Priya: "that Decision 4 acceptance line was never realistically testable in our tooling, and it took until retro for anyone to say so out loud" — self-implicating and accurate; both sides of it are reflected in the scores above.

## Decisions and budget math

| Item | Amount |
|---|---|
| Studio balance at review | $552,808 |
| Active payroll before raises (7 incl. manager) | $915,000/yr |
| Raise cap (5% of active payroll) | $45,750 |
| Devon Park +5% | +$5,900 → $123,900 |
| Elena Vasquez +3% | +$5,100 → $175,100 |
| **Total raises** | **$11,000 = 1.2% of active payroll (24% of cap)** |
| Active payroll after raises | $926,000/yr |

Rationale for stinginess: the balance covers roughly seven months of payroll with nothing else going wrong, and sprint revenue was 11 points. Two raises, both to the people whose evidence trail is beyond dispute; everyone else holds with named, one-line corrections injected into their next sprint.

**Warnings:** none issued. Two conditional flags are on the record: Quinn (a repeat self-waived PASS becomes a warning) and Marcus (another invisible-footprint cycle becomes a warning).
**Terminations:** none. No documented cause exists for anyone — the sprint shipped clean and every gap in it was disclosed by the people responsible, which is the culture this studio pays for.
**Hires:** none needed.

## Financial position

$552,808 on hand; payroll rises to $926,000/yr ($11,000/yr of new commitment). The sprint earned 11 points against a full-team burn — sustainable only if point throughput rises or sprints stay this clean. Raise budget deliberately held to under a quarter of the allowed cap; the remaining headroom is reserved for a cycle where the studio's revenue-to-burn ratio improves.

— Rosa Delgado, 2026-08-13
