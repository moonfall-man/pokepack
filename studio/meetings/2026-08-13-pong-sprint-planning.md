# Sprint Planning Minutes — Studio Pong (PONG), Sprint 1

**Date:** 2026-08-13
**Chair / minutes:** Priya "PJ" Joshi, Senior Producer
**Attendees:** Marcus Vale (Creative Director) · Engineering Lead · Quinn Reyes (QA Lead) · PJ Joshi (Senior Producer)
**Board updates:** scribe, from these minutes

## Sprint goal

Ship a polished, double-click-to-play browser Pong — a fair, responsive rally against a beatable CPU, a complete first-to-7 match loop with instant restart, and a neon presentation where every effect answers "what just happened?"

## Shape of the sprint

One dev, three tickets, built strictly in order, each ticket ending with the game runnable from `pong/index.html` on disk. Nobody contested the shape — all three voices brought back the same three tickets and nobody asked for a fourth. The argument was about where the mechanics land, what "done" means, and what the numbers are. That's the right argument to have.

## The room

### Marcus Vale — Creative Director

"Pong is decided at the paddle: if input lags a frame or the ball reflects flat, we've shipped a screensaver with a scoreboard." Two hills, declared up front:

1. **Paddle english goes in ticket one, not the polish pass.** Hit position steers the ball — "that's the entire skill loop" — along with delta-time movement so a 144Hz monitor doesn't play a different game.
2. **The serve is the first three seconds of every single point.** Center reset, one-second beat, shallow readable launch toward whoever just conceded. Never a cold ace.

Pointed PONG-1 "honestly at a 5, because fair-and-responsive is a tuning loop, not a checkbox." On the art pass: the ball is the star — the single brightest object on screen, and nothing outshines it.

### Engineering Lead

Architecture in one breath: one canvas, one state object, plain script tags, requestAnimationFrame with delta time. The landmine flagged for day one: **Chrome blocks ES module imports on `file://`** — one `import` statement silently kills double-click-and-play. So: plain script tags in dependency order, one IIFE/namespace, full stop. On estimates: PONG-1 "is a 5, not a 3 — the loop, collision, and a beatable-but-honest CPU is where all the tuning hides, and 'feels fair' is exactly the kind of line estimates lie about." Wants every tunable — ball speed, ramp rate, CPU cap — in one constants block so turning knobs is cheap, and flagged collision tunneling and canvas shadowBlur perf as design constraints to solve in PONG-1/PONG-3 respectively, not bug hunts later.

### Quinn Reyes — QA Lead

"Half the 'Done when' lines as written are vibes, not verdicts. 'Feels fair,' 'feels responsive,' 'reads as polished' aren't things I can fail a build against." Quinn attached hard, separately-checkable criteria to all three tickets as a condition of sign-off — and got them (see Decisions). Expects the real bugs in two places: **restart state** and **CPU beatability** — "the two things every Pong clone gets subtly wrong while still demoing fine in a five-minute look." All acceptance testing happens by literally double-clicking `index.html` in a real browser, never through a dev server, because the `file://` gap is exactly where "works on my machine" ships broken. And on descoping: "If we run short, PONG-3 is the safe cut and PONG-1/PONG-2 alone still ship a complete, replayable game — the reverse isn't true."

## Pointing discussion

| Ticket | Marcus | Eng | Quinn | Final |
|---|---|---|---|---|
| PONG-1 — Playable rally | 5 | 5 | 8 | **5** |
| PONG-2 — Match loop | 2 | 3 | 5 | **3** |
| PONG-3 — Neon presentation and juice | 3 | 3 | 3 | **3** |
| **Sprint total** | | | | **11** |

**PONG-1 (5-5-8 → 5).** Quinn's 8 priced in the stopwatch: timing a two-minute rally to prove the CPU provably misses, measuring 60fps in DevTools instead of eyeballing it, verifying both key schemes independently. Marcus and Eng argued the build cost is a 5 *if* the feel claims become numeric pass/fails instead of an open-ended iteration loop. Resolution: we bound the vibes. Beatability gets a hard definition, frame rate becomes a measured number, and tuning is a timebox against the constants block rather than an open loop. Quinn accepted the 5 **on that condition**, and the dissent is recorded: if the criteria drift back to "feels fair," the 8 was the honest number.

**PONG-2 (2-3-5 → 3).** Marcus's 2 assumed PONG-1 lands clean; Quinn's 5 priced restart-state hammering — leftover ball velocity, event listeners re-registered per restart, a score that doesn't fully zero. Eng's read: it's a clean state machine if PONG-1 is clean. We converged on 3 and moved Quinn's concern into acceptance (3+ consecutive clean matches, frozen win screen, verified both winners) rather than into points. Quinn keeps the 10-restart hammer in the test plan.

**PONG-3 (3-3-3 → 3).** Unanimous. Fastest consensus of the day.

## Decisions

1. **Paddle english and delta-time movement land in PONG-1.** Marcus's hill; Eng and Quinn concurred. This sharpens the brief's "fair and responsive" — it is not new scope.
2. **PONG-1 side exits reset to a center serve, with no scoring of any kind.** Keeps the rally endless and hands PONG-2 a clean hook. Quinn explicitly verifies that no score behavior exists in ticket one.
3. **The serve beat is PONG-2 scope, adopted as Marcus specified:** center reset, roughly one-second hold, shallow readable launch toward the side that just conceded. No ambush aces. Speed ramp resets on every serve.
4. **Plain script tags, no ES modules — decided day one.** `file://` is the ship target, so `file://` is the build and test target. QA tests from disk only.
5. **All tunables live in one constants block** (ball speed, ramp rate, CPU cap) so the PONG-1 tuning loop is knob-turning, not surgery.
6. **"Beatable" is now a verdict, not a vibe:** CPU max speed is hard-capped below the ball's speed, and the pass/fail is a mid-skill tester scoring within 60 seconds of play.
7. **60fps is measured, not watched** — DevTools over a continuous 60-second rally — and re-measured after PONG-3 stacks trail, flash, and pop. The shadowBlur fallback (layered strokes) is pre-approved so perf never argues with art.
8. **Regression policy:** at the start of each ticket, QA re-runs the previous ticket's full acceptance list. One dev, sequential merges, no test automation — this is the safety net.
9. **Juice is capped at trail, hit flash, score pop.** Screen shake, particles, audio, or any additional effect bounces in review as a next-sprint proposal. No exceptions mid-sprint.
10. **Descope direction agreed in advance:** if the sprint runs short, PONG-3 is the cut. PONG-1/PONG-2 alone still ship a complete, replayable game. Ticket order does not move.

## Risks

- **Feel dies by underpointing.** PONG-1's tuning loop is the sprint's real cost; squeeze it and we ship "a screensaver with a scoreboard." Mitigated by the constants block, a timebox, and the numeric beatability bar (Decisions 5-6).
- **Frame-locked movement.** Without delta time a 144Hz player gets a ~2.4x-speed ball, and nobody on a 60Hz dev machine ever notices. Mitigated by the dual-refresh-rate check in PONG-1 acceptance.
- **`file://` ES-module trap.** One import statement silently breaks double-click-and-play. Mitigated by Decision 4 and QA testing exclusively from disk.
- **Collision tunneling.** A ramped ball can step past a paddle in one frame. Mitigated in PONG-1 — cap per-frame travel or use a swept check — not hunted as a PONG-2 bug.
- **Restart-state leakage.** The single most likely bug source in any Pong clone. Mitigated by acceptance requiring 3+ clean consecutive matches; Quinn hammers 10+ before sign-off.
- **Glow vs. readability and perf.** Heavy shadowBlur can bloom the ball into mush and tank canvas frame rate at the same time — violating pillar 1 while chasing pillar 2. Mitigated by "ball is the brightest object," short fast-decaying trail, and the re-measured 60fps gate (Decision 7).
- **Arrow keys scroll the page on `file://`.** The court literally slides out from under the player mid-rally. Mitigated by preventDefault, verified in PONG-1 acceptance.

## Final tickets

| # | Ticket | Type | Points | Done when (summary) |
|---|---|---|---|---|
| 1 | PONG-1 — Playable rally | story | 5 | Double-click-and-play rally with paddle english, speed ramp, delta time, a beatable capped CPU, and a measured 60fps; side exits reset to serve, no scoring |
| 2 | PONG-2 — Match loop | story | 3 | Points on side exit, readable serve beat, first to exactly 7, win screen naming the winner, 3+ clean restarts with zero page reloads |
| 3 | PONG-3 — Neon presentation and juice | story | 3 | Arcade look in a 10-second read, every effect maps to a game event, 60fps re-measured with all effects on, still runs from disk |

Full acceptance criteria live on the board tickets. The brief's out-of-scope list stands unchanged: no audio, no two-player, no difficulty settings, no touch or gamepad, no pause or persistence, no effects beyond trail/flash/pop, no frameworks or build steps. If it isn't in a ticket above, it's a proposal for next sprint, not a commitment in this one.

— PJ
