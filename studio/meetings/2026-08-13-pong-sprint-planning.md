# Sprint Planning Minutes — Studio Pong (PONG), Sprint 2

**Date:** 2026-08-13
**Chair:** Priya "PJ" Joshi, Senior Producer
**Scribe:** Sam — attending and on the record this sprint, per the retro ask; Sam also leaves a creation note on each ticket at board time.

## Attendees

| Person | Role |
|---|---|
| Priya "PJ" Joshi | Senior Producer (chair) |
| Marcus Vale | Creative Director |
| Elena | Engineering Lead |
| Quinn | QA Lead |
| Devon | Engineer — sole dev on this sprint's tickets |
| Sam | Scribe / board ops |

## Where we start

Sprint 1 shipped complete: PONG-1/2/3, 11/11 points, zero open bugs. Sprint 2 modifies `studio/projects/pong/` in place. Difficulty select and screen shake enter scope by studio-head directive. The ship constraint is unchanged and non-negotiable: double-click `index.html` from disk — plain script tags, no build, no server, no audio.

One fact was put on the table before any pointing, and I verified it myself in the room rather than take anyone's word: **neither retro action 2 (rig fix) nor action 3 (harness check-in) shows any evidence of landing.** There is no `studio/tools/` directory and no Pong harness file anywhere in the repo outside sprint 1's ticket comments describing one. Quinn checked before walking in; I checked again from the chair. That finding shaped the whole meeting — see Decisions 5 and 6.

## The room, in their own words

**Marcus (Creative Director):** "The difficulty select is now our first three seconds, so it has to be an offer, not a lobby" — cold open from disk, mash the serve key, and you're in an Arcade rally with zero required extra keypresses; 1/2/3 exist for players who care, and the tier label sits at or below center-line brightness so the ball stays the loudest object on court. Before Devon types a line of PONG-4, Marcus runs his gate: double-click `index.html` on real hardware, win a full match, watch YOU WIN with his own eyes, and post capture plus feel notes as board comments the same morning — closing sprint 1's two open evidence gaps and setting the Arcade baseline every tier tunes against. If he can't win, "that is a stop signal on the whole tuning premise." Inside PONG-5: "pause is player respect and shake is garnish" — pause builds first, shake is the intra-ticket cut. And no acceptance line gets written this sprint that the rig cannot literally execute.

**Elena (Engineering Lead):** Both tickets are "the simplest shapes that survive contact." Difficulty is three data rows over two knobs that already exist in CONFIG (`CPU_MAX_SPEED`, `BALL_SPEED_RAMP`) — a data change, not a systems change; pause is one gate at the top of `update()` plus a frame-clock reset on resume; shake is a decaying render offset triggered from `awardPoint`, the single scoring call site sprint 1 deliberately kept. Day zero she checks the sprint 1 headless harness into the repo as versioned tooling at `studio/tools/pong-harness/`, "so every acceptance line is a command first and a live session second." She named the pause bug before it exists: timestamp dt with a `MAX_DT` clamp means a naive unpause injects a 33ms phantom step — the exact-equality snapshot criterion exists to make that unshippable. And she named the shake placement trap: decay must live on the juice-timer path, not inside the gated sim, or the match-winning point's shake freezes mid-offset behind the win screen. On capacity: "8 points against last sprint's 11 is honest," because the same people also carry the rig fix, the harness promotion, and Marcus's ritual.

**Quinn (QA Lead):** Priced both tickets for the verification tail, not the build. "There is no Pong harness file anywhere outside sprint 1's ticket comments describing one" — so as of planning, we were set up to repeat sprint 1's actual defect: three acceptance lines nobody could literally execute, signed off by construction. PONG-4 triples her live beatability load (three independently timed tiers, none extrapolated from another) and quietly touches PONG-2's already-shipped acceptance line "the restart key starts a fresh 0-0 match" — "I want that decided in this room, not discovered by me mid-sprint and self-waived." She wants the input seams specified now (what P does on the select and win screens; whether the final, win-ending point shakes): "I test to what the ticket states, I don't decide it myself at QA time." She also flagged the one-line miss: the on-page hint (`W / S or ↑ / ↓ — move your paddle`) documents zero of this sprint's new keys. And she asked that we agree now which verifications get a live human pass versus harness/bot coverage, rather than leaving her to triage it alone at close.

**Devon (Engineer):** Confirmed the sequential build order, the 8-point commitment, and took the seam list and the control-hint line into his handoff notes. Standing agreement re-affirmed for everyone: standup status lines cite board state (column and merge hash), not intentions.

## Pointing discussion

Planning poker, two rounds where needed. Recorded in full because the disagreement was substantive.

| Ticket | Marcus | Elena | Quinn | Settled |
|---|---|---|---|---|
| PONG-4 | 5 | 5 | 8 | **5** |
| PONG-5 | 3 | 3 | 5 | **3** |

**PONG-4.** Quinn's 8 priced three timed live beatability verdicts instead of one, the PONG-2 restart-flow reconciliation, a full four-ticket regression, and — decisive for her — zero evidence the rig or harness retro actions had landed. Elena's 5 priced the build (data rows over existing knobs) and argued the tail belongs to named, owned gating work, not to Devon's dev points: the harness check-in is hers, day zero, making the Arcade regression a command; the rig fix is hers and Quinn's, gating PONG-4's entry into qa. My call as chair: **points on this board track dev build-and-integration effort; QA's load gets made visible as recorded gating work with owners (Decision 6) and a pre-agreed evidence split (Decision 5), not as inflated dev points.** With Decisions 3–6 adopted in the room, Quinn re-voted 5, stating her condition on the record: if the rig fix slips past PONG-4-reaching-qa, the live lines get amended on the record at that moment — that protocol is written into the tickets, not left to goodwill. **Her original 8 and its reasoning stand in these minutes as honest dissent.**

**PONG-5.** Quinn's 5 priced drift-proofing across twelve toggles, the final-point ambiguity, and the rig-dependent fps line. Elena answered with the exact-equality snapshot as a harness command and the frame-clock reset as a named review item; the room resolved the final-point question outright (Decision 3), and the fps criterion carries its amend-on-record clause in its own text. Settled at 3, with shake as the declared intra-ticket cut. Quinn's 5 recorded.

**Commitment: 8 points against last sprint's 11 — deliberately.** The same people carry the rig fix, the harness promotion, and the day-one ritual. Payroll burns the same either way; we earn back what we ship, and an honest 8 beats a pretty 11 we miss.

## Decisions

1. **Sprint shape and cut order.** Two tickets, PONG-4 then PONG-5, built sequentially, each merge leaves the game runnable. PONG-5 is the sprint cut; inside PONG-5, pause builds before shake and shake is the intra-ticket cut.
2. **The select is an offer, not a lobby.** Cold open defaults to Arcade: the serve key alone starts a match with zero required extra keypresses. 1/2/3 select a tier on the pre-serve screen and again from the win screen; tier keys are dead during rallies and during pause — no mid-match switching path exists.
3. **Input seams pinned now, not reverse-engineered in QA.** P toggles pause only during rallies and the serve hold; it does nothing on the select screen or the win screen. Pausing during the serve hold resumes with the remaining hold time intact — never a restarted or shortened beat. Resume fires only on a deliberate P press; no resume countdown. **The match-winning point does shake**, with decay on the juice-timer path so it completes behind the win screen.
4. **PONG-2's shipped acceptance line is amended on the record, not silently reinterpreted.** The win-screen restart key still starts a fresh 0-0 match in one press — now *at the currently selected tier*, with 1/2/3 as an additive option before it. PJ drafts the written amendment to PONG-2's line ("the restart key starts a fresh 0-0 match at the currently selected tier"); Sam posts it as a board comment on PONG-2 this sprint; Quinn verifies the wording matches what she will test.
5. **Evidence split agreed now — the rig-honesty rule.** Harness-primary: state-equality snapshots, knob diffs, serve-beat numbers, shake trigger counts, shake-on/off state identity, and the Arcade regression suite. Live-human: the three per-tier timed beatability runs, tier-label brightness and readability in play, the PAUSED overlay, and the measured-fps window. Standing rule for the sprint, from the retro and enforced by the chair: every acceptance line must be executable as written by the rig we actually have; any mid-sprint substitution of evidence gets that criterion explicitly re-adjudicated on the ticket — never a self-waived PASS, never "verified by construction."
6. **Gating work, with owners, on the record.** (a) Elena checks the sprint 1 headless harness into `studio/tools/pong-harness/` as versioned dev tooling on day zero, before the first PONG-4 commit — regression becomes a command. (b) The rig fix — continuous 60-second from-disk fps window and a bot-driven full match — is owned by Quinn and Elena and lands before PONG-4 reaches qa, or the live lines are amended on the record at that moment. (c) Marcus's real-hardware ritual gates the first PONG-4 commit: from-disk double-click, one full match won, YOU WIN watched, capture and feel notes on the board the same morning. A loss is a stop signal on the tuning premise.
7. **Tuning numbers and invariants.** Starting knobs: Chill 220/16, Arcade 300/24 (sprint 1's shipped numbers, untouched), Ruthless 360/32. Knobs move in review only, and "the knobs move, not the bar": CPU cap strictly below the 380 serve speed at every tier, the 60-second beatability bar fixed, serve beat identical across tiers. Chill's floor is a number, not a vibe: the CPU must beat an idle player and still score against the harness's mid-skill bot policy — the tutorial-that-plays-itself tripwire.
8. **Housekeeping.** The on-page control hint gains 1/2/3 and P (one line in each dev handoff — not left to memory). Quinn keeps a visible in-progress board trail while testing rather than a silent close-out cluster. Sam is on the attendee record and leaves a creation note per ticket. Standup status lines cite board state, not intentions.

## Risks

- **Ruthless is a narrow band** (Marcus, Elena): cap under 380 plus the 60-second bar leaves little room; the fixed 760 ball ceiling means a hotter ramp converges with Arcade late-rally, so the wall has a top. One tuning loop is inside PONG-4's 5 points; a second loop starts eating PONG-5's runway — that's the cut lever working as designed. Owners: Elena (numbers), Marcus (feel), verdicts measured per Decision 7.
- **Chill floor violation** (Marcus): ease the cap too far and Chill plays itself, breaking pillar 1. Tripwire is Decision 7's bot-match floor, agreed before tuning starts.
- **Rig dependency** (all three voices): both tickets' live sign-off leans on a fix that had zero evidence of landing as of this meeting. Mitigation is Decision 6(b)'s hard sequencing plus Decision 5's amend protocol; worst case is PONG-4 idling in qa, which the harness-as-command and visible QA trail shrink.
- **Frame-clock bug on resume** (Elena): the `MAX_DT` clamp makes a naive unpause inject a 33ms phantom step. The exact-equality snapshot criterion makes that unshippable; review checks the clock reset, not the overlay.
- **Shake in the sim instead of the draw** (Elena, Marcus): if the offset touches entity positions we buy invisible physics bugs for garnish. The shake-on/off state-identity line is the guard and is not waivable; decay placement (juice path) is a named review item.
- **Input-mode seams** (Marcus, Quinn): select, serve beat, pause, and win screen now share one keydown flow, and the feel bugs live at the seams — P on the select screen, 1/2/3 during pause, pause inside the serve hold. Pinned in Decision 3; Marcus deliberately plays the seams on hardware; Quinn tests to ticket text.
- **Day-one gate surfaces a real feel bug** (Elena): Marcus's ritual is the first time human hands play this game; an unplanned fix enters scope and PONG-5 absorbs it as the declared cut.
- **Capacity is split three ways** (Elena, Quinn): Devon carries 8 dev points while Quinn and Elena carry the rig fix and harness promotion, and per-tier beatability is QA's widest verification load yet. Rig-first sequencing and Decision 5's pre-agreed evidence split are the mitigations.

## Final ticket table

| # | Ticket | Type | Points | Order | Cut position |
|---|---|---|---|---|---|
| PONG-4 | Difficulty select: Chill / Arcade / Ruthless | story | 5 | 1st | ships regardless |
| PONG-5 | Pause and score shake | story | 3 | 2nd | sprint cut; shake is the intra-ticket cut |

**Sprint goal:** Turn Studio Pong's one fair fight into three — a zero-friction, keyboard-only Chill/Arcade/Ruthless select that retunes exactly two knobs per tier and stays honestly beatable at every tier — then add a total-freeze pause and score-only screen shake, all still double-click-from-disk, with every acceptance line executable on the rig we actually have.

**Immediate checkpoints:** Elena's harness commit lands day zero; Marcus's real-hardware gate runs before the first PONG-4 commit, notes on the board that morning; rig fix confirmed before PONG-4 reaches qa; PJ's PONG-2 amendment posted via Sam this week.

— PJ
