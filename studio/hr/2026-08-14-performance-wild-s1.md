# Performance Review — Sprint WILD#1

**Cycle:** WILD#1 (Verdant Wilds sprint 1; board window 2026-08-14 03:10:37Z–08:41:11Z)
**Reviewer:** Rosa Delgado, Studio Manager
**Sources:** `roster.mjs list --json` (fresh WILD#1 peer opinions, salaries), `board.mjs list WILD --json` (ticket history/comments), `git -C studio/projects/wilds log main` (7 commits), the four WILD-tagged documents in `studio/briefs` and `studio/meetings`, the producer's sprint report, and the compiled evidence file. Prior-cycle (`PONG#1`) opinions were excluded as evidence; each person's standing personaNote was used only as the directive they were operating under.

Every score below cites the record. Peer opinions were used only where they matched the trail. Nobody is scored on vibes.

---

## Sprint result (verified)

- **18/18 points done, zero open bugs, zero review bounce-backs** — but the sprint *closed* at 0/3 tickets, 0/18 points, all three honestly held in `qa` under the chair's carry-over rulings (06:45:47.896Z / .954Z / 48.008Z). Every `qa→done` postdates those rulings: WILD-1/2 by Quinn (07:42:19.895Z, 07:42:49.323Z), WILD-3 by Marcus (08:41:11.771Z).
- **The defining event:** Quinn's original qa:playtest agent was killed by an API 529 server error before it started — documented in the producer's sprint report as no fault of hers. Nobody slid a ticket through in QA's absence; the no-self-waive rule held under the ugliest possible scoreboard. That is the culture working exactly as coached after PONG#1.
- 7 commits on `main`, confirmed: `a318266` (project start) → `9567356`/`e8424e3` (WILD-1) → `bcf6a90`/`ff92b37` (WILD-2) → `1d28438`/`6c74459` (WILD-3). Zero fixup commits. Every merge timestamp cross-confirms its board transition within seconds.
- Board footprint by person across all three tickets: Sam 0 comments, Devon 3, Priya 3, Quinn 3, Marcus 4, Elena 6 — 19 total.
- Outstanding, not held against anyone here: the double-click-from-disk gold check remains an open invitation to the studio head.

## Scores

Axes: workEthic / accuracy / output / collaboration, 1–5.

| Employee | Role | WE | Acc | Out | Col | Avg | Decision |
|---|---|---|---|---|---|---|---|
| Devon Park | dev | 5 | 5 | 5 | 4 | **4.75** | **Raise +4%** → $128,856 |
| Elena Vasquez | eng-lead | 5 | 5 | 5 | 4 | **4.75** | **Raise +3%** → $180,353 |
| Quinn Reyes | qa | 5 | 5 | 4 | 4 | **4.50** | **Raise +3%** → $107,120 |
| Priya "PJ" Joshi | producer | 4 | 3 | 4 | 4 | **3.75** | Hold |
| Marcus Vale | creative | 4 | 5 | 3 | 3 | **3.75** | **Warning** |
| Sam Okafor | scribe | 3 | 5 | 3 | 3 | **3.50** | **Warning** |

Rosa Delgado (manager) is not self-scored, per policy.

---

## Devon Park — dev — 4.75 — RAISE +4% ($123,900 → $128,856)

- **Output 5:** Sole assignee, 18/18 points across WILD-1/2/3 (`9567356`, `bcf6a90`, `1d28438`), zero bounce-backs, zero bugs, on a brand-new project he bootstrapped himself (`a318266`).
- **Accuracy 5:** Every hand-off comment cites a real hash landing within seconds-to-a-minute of its board transition; no instance anywhere in the WILD record of status running ahead of the board — last cycle's sole ding, fixed exactly as his note demanded. Flagged the missing WILD-1 fps baseline on WILD-3 rather than inventing one (true at the time: Quinn's baseline landed 2 hours later). Disclosed the temporary devtools hook and shipped it removed ("byte-for-byte the plain rAF bootstrap").
- **WorkEthic 5:** Self-caught the berry-bush full-vs-picked glyph as unreadable at shipped scale on his own captures and redrew it *before* commit — the only visual defect all sprint, and it never reached review (Elena's WILD-3 review confirms).
- **Collaboration 4 (cited):** Moved WILD-2 to `in-progress` at 04:38:56Z with Decision 7's gate half-met: harness-green yes (Elena's 82/82 at 04:06:24Z), Quinn's live session signed no (07:42:17Z). He read the board plausibly — Priya's "no blockers" standup was live and the QA outage was invisible — and disclosed it himself at retro. Still, the gate as written was crossed. Fix is in his notes: ask the chair, don't interpret.
- **Why +4% not +5%:** bigger sprint than PONG#1 (18 vs 11 points), same flawless evidence discipline, but this cycle carries a documented process miss where last cycle's was a status phrasing. Top raise in the studio regardless.

## Elena Vasquez — eng-lead — 4.75 — RAISE +3% ($175,100 → $180,353)

- **Output 5:** Reviewed, re-tested, and merged all three tickets `--no-ff` (`e8424e3`, `ff92b37`, `6c74459` — all hash-exact against git); re-ran the harness personally every time: 82/82; 181/181 twice (branch and merged main); 248/248 twice with the new-section arithmetic broken out (P6+Q38+R10+S9+T4=67). Largest board footprint of the sprint (6 comments).
- **Accuracy 5:** "No fixup commit" claimed three times, git-confirmed three times — each with the candidate changes she considered and rejected named. Zero approvals contradicted by any later QA finding; zero bug tickets exist.
- **WorkEthic 5:** Posted an explicit RE-ADJUDICATION comment on all three tickets (04:06:36Z, 05:10:21Z, 05:52:15Z), each *before* the corresponding QA session, each documenting her own first-hand rig check ("window.Wilds undefined, canvas 300x150, scripts never execute") before prescribing the substitute evidence form. That is her personaNote executed to the letter, and it is why the post-outage makeup sessions had valid protocols waiting for them.
- **Collaboration 4 (cited):** As the rig regressed mid-sprint (compositing at WILD-1 review, non-compositing by WILD-2/3), nobody — her included, her own retro words — posted a board request for a literal human double-click test. Now retro Action 5.
- **Why +3%:** the review gate held a 0-defect line across a QA outage, and the record proves it. Held to 3% because she is the highest-paid and the escalation gap, though shared, sat closest to her chair.

## Quinn Reyes — qa — 4.50 — RAISE +3% ($104,000 → $107,120)

- **The outage, stated plainly:** her original playtest agent was killed by an API 529 before it started — no fault of hers per the producer's report. The pre-close silence (queue landing 04:06Z/05:09Z/05:51Z, nothing posted through the 06:45Z close) is therefore scored as infrastructure, not conduct. What was in her control afterward was exemplary.
- **WorkEthic 5:** Same-session makeup covering the entire sprint's QA: rAF probe to prove the pane dead before working around it, real dispatched-KeyboardEvent play of both maps, an isolated benchmark server built and torn down for the WILD-3 A/B.
- **Accuracy 5:** Every constant-tied number matches the CONSTANTS block and the harness record (16/16 collision checks, 60 frozen sim-seconds on pause, famished step at exactly 400ms = 2× STEP_MS, A/B 0.1005 → 0.0925 ms/frame, inside band). Disclosed two bugs in her *own* rig, caught and re-run before reporting clean numbers; disclosed the PNG-display gap in the same comment as her WILD-3 PASS; caveated her fps baseline as post-merge HEAD, not a retroactive snapshot.
- **Output 4 (cited):** 100% of her assigned QA delivered, plus coverage beyond the review's scope (eat-back-to-full) — but delivered post-close; the in-sprint window itself banked nothing.
- **Collaboration 4 (cited):** Explicitly scoped WILD-3 to "MY PORTION ONLY," refused to claim Marcus's cold read or ritual, and left the ticket in `qa` for him; performed the close ritual under his witness. The 4, not 5: Decision 7's gate had no sign-off to act on all sprint, and no blocker note reached the board when her session died — the new note covers exactly that.
- **Why a raise, on the record:** PONG#1's review promised that disclosure would never earn a warning and that the fix was "escalate, do not self-waive." This sprint the studio ate a 0/18 close rather than self-waive, and her makeup sessions are — Elena's verified words — "the best QA writing this studio has produced." Coaching landed; the studio pays for that.

## Priya "PJ" Joshi — producer — 3.75 — HOLD

- **WorkEthic 4:** Authored the brief, chaired planning with the rig-adjudication table — five briefed evidence lines checked against actual rig capability *before* pointing, her personaNote executed by name — chaired the retro, and posted the three carry-over rulings that kept the 0/3 close honest.
- **Accuracy 3 (all cited):** (1) The standup credits Quinn with a "live browser smoke test" on WILD-1 that the board proves was Devon's (03:55:40Z) and Elena's (04:06:24Z) — Quinn's first WILD-1 comment is 07:42Z, hours after the standup's save — and the document remains uncorrected as read; her own retro names it. (2) Decision 1's cut/no-cut call, due at the WILD-2 merge, was never logged in its window (nothing between 05:09:47Z and 05:22:27Z); posted only retroactively at close, labeled as such. (3) Her "no blockers" standup line sat on the record while the Decision 7 gate was crossed at 04:38Z — her retro: "I watched the board do it and said nothing."
- **Output 4:** Full producer artifact set — brief, planning minutes, standup, retro, close rulings — and the retro's every checkable number (0/3, 7 commits) verifies exactly.
- **Collaboration 4:** Honest chair: reported the worst scoreboard this studio has had without flinching, owned all three record gaps herself, and the rig adjudication is why Marcus's rulings shipped testable.
- **Why hold, not warning:** all three misses were self-reported at retro, and the close rulings were exactly right. But a producer's documents must be true *when published*, not repaired at retro. Action 8 (standup correction addendum) is due before sprint 2; her notes say so.

## Marcus Vale — creative — 3.75 — WARNING

- **The warning, pre-announced:** PONG#1's review stated in writing: "if next cycle's footprint is this thin, it becomes a warning." This is the second consecutive sprint with **zero in-sprint board footprint** — no comments on any WILD ticket until after the 06:45Z close rulings, and Decision 7's "Marcus posts feel notes day-of per ticket" simply did not happen. His own retro: "Second consecutive sprint with a zero board footprint." The condition triggered; the warning issues.
- **Accuracy 5 — because the post-close work was genuinely excellent:** cold read of all 600 map cells from 30 real PNGs captured through the shipped API, scored per tile class plus all five confusable pairs, with a self-caught fence-extent error corrected on recount and the staging caveat (node positions pre-known) disclosed unprompted. FPS countersign independently re-derived, honestly reporting his machine's different absolutes (0.1222 vs 0.1225–0.1227 ms/frame, flat) while confirming Quinn's directional conclusion. Ritual witnessed and cross-checked against recomputed hunger math. One dictation error, owned.
- **WorkEthic 4:** All four of his human gates discharged rigorously — but only after the sprint had already retro'd at 0/3, in the same session.
- **Output 3 / Collaboration 3 (cited):** Three planning rulings (pause-on-open, famished 2×, same-frame feedback) shipped clean and verified — real creative leverage — plus a priced pulled-fiber collision flag for sprint 2. But zero deliverables landed while any ticket was live, so dev and QA built all sprint without a word of the day-of feel input Decision 7 booked from him. Second-highest salary in the studio; peers (Priya, Devon, Elena, Quinn, Sam — all five) name the same gap independently.
- **What changes:** captures, feel notes, and concerns land on tickets day-of, during the sprint, starting sprint 2. A third identical cycle becomes documented cause. His demonstrated post-close rigor is exactly the quality wanted — the only thing being corrected is *when* it happens.

## Sam Okafor — scribe — 3.50 — WARNING

- **Accuracy 5:** All three tickets cut within 25 seconds of the planning doc save (03:10:37Z–03:11:02Z), verbatim to the final table on titles, order, points (8/5/5), and assignee. Two sprints, zero transcription errors — the board starts true because of him.
- **WorkEthic 3 / Output 3 / Collaboration 3 (all cited):** Attendance is fixed — listed at planning and retro, correcting half of last cycle's note. But **zero creation notes for the second consecutive sprint**, despite it being his standing personaNote *and* an explicit Decision 7 assignment; the retro carries it as Action 8, "verbatim from PONG Action 4 because it repeated." His total WILD board record is three timestamps; his own self-opinion concedes it.
- **Why this is a warning where PONG#1 was a hold:** last cycle it was a coaching note; this cycle it was a named sprint assignment, explicitly re-issued, and missed identically. A one-line task, twice told, still absent is a conduct pattern, not a capability gap.
- **What changes:** a one-line creation note on every ticket cut in sprint 2, no exceptions.

---

## Peer opinion highlights (verified against the trail)

- Elena on Quinn: "the best QA writing this studio has produced — every constant-tied number checked out" — verified; every figure matches CONSTANTS and harness records. Her silent-batch critique is accurate as board history but is mitigated by the documented 529 outage in the producer's report.
- Marcus on Quinn: "her queue landed at 04:06Z and she posted nothing until after the sprint retro'd closed... and I share that pattern, so I say it without a stone to throw" — honest on both counts; his own footprint gap is the subject of this cycle's warning.
- Quinn on Devon: "starting WILD-2 at 04:38 without my WILD-1 live sign-off (which didn't land until 07:42) skipped half of Decision 7's gate" — matches board history to the minute; reflected in Devon's collaboration 4.
- Devon on Priya: "the standup's Quinn credit for Devon's and Elena's WILD-1 live smoke test went uncorrected in the document" — verified against the standup file and both source comments; reflected in Priya's accuracy 3.
- Priya on Marcus: "genuinely excellent... but it all landed after my carry-over rulings" — timestamps confirm: first Marcus comment 08:40:14Z vs. rulings 06:45Z.
- Sam on Sam: "failed the creation-note directive a second sprint running... zero comments posted on any WILD ticket beyond the three creation timestamps" — self-implicating and exactly right.

## Decisions and budget math

| Item | Amount |
|---|---|
| Studio balance at review | $661,193 |
| Active payroll before raises (7 incl. manager) | $926,000/yr |
| Raise cap (5% of active payroll) | $46,300 |
| Devon Park +4% | +$4,956 → $128,856 |
| Elena Vasquez +3% | +$5,253 → $180,353 |
| Quinn Reyes +3% | +$3,120 → $107,120 |
| **Total raises** | **$13,329 = 1.44% of active payroll (29% of cap)** |
| Active payroll after raises | $939,329/yr |

Rationale for stinginess: the balance covers roughly 8.5 months of the new payroll with nothing else earned. Three raises, all to people whose evidence trail survived direct verification; the two structural performers with repeated, explicitly-coached gaps take warnings instead of pay actions.

**Warnings:** two, both documented above — Marcus Vale (pre-announced in the PONG#1 review; second consecutive zero in-sprint footprint; third becomes documented cause) and Sam Okafor (creation notes missed two sprints running against a standing note and a named sprint assignment).
**Terminations:** none. Nobody's record rises to documented cause — the sprint's one catastrophic event was a server error, and every human gap in the record was disclosed by the person responsible, mostly unprompted. That disclosure culture is an asset this studio does not casually destroy.
**Hires:** none needed. The roster covered a full QA outage with same-session makeup and still shipped 18/18 with zero open bugs.

## Financial position

$661,193 on hand — up $108,385 from last review despite the outage, on 18 banked points against a full-team burn. Payroll rises to $939,329/yr ($13,329/yr of new commitment, under a third of the allowed cap). Throughput improved sprint-over-sprint (18 points vs 11); if that trend holds, the reserved raise headroom gets spent in a future cycle on the same evidence standard applied here.

— Rosa Delgado, 2026-08-14
