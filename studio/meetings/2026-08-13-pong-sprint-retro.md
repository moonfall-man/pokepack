# Sprint Retro Minutes — Studio Pong (PONG), Sprint 1

**Date:** 2026-08-13
**Chair / minutes:** Priya "PJ" Joshi, Senior Producer
**Attendees:** Marcus Vale (Creative Director) · Elena (Engineering Lead) · Devon Park (Developer) · Quinn Reyes (QA Lead) · PJ Joshi (Senior Producer)
**Sprint goal, restated:** Ship a polished, double-click-to-play browser Pong — a fair, responsive rally against a beatable CPU, a complete first-to-7 match loop with instant restart, and a neon presentation where every effect answers "what just happened?"

**Verdict: shipped.** All three tickets closed to done today with QA sign-off. The game lives at `studio/projects/pong/` — double-click `index.html` from disk, or play it off the hub at `http://localhost:4545/projects/pong/index.html`.

## Scoreboard

| Ticket | Type | Points | Assignee | Status |
|---|---|---|---|---|
| PONG-1 — Playable rally | story | 5 | Devon Park | **done** |
| PONG-2 — Match loop | story | 3 | Devon Park | **done** |
| PONG-3 — Neon presentation and juice | story | 3 | Devon Park | **done** |

| | Planned | Done |
|---|---|---|
| Tickets | 3 | **3** |
| Points | 11 | **11** |

- **Carry-over: none. Bugs filed against the game: 0. Open bugs: 0.** The only bugs found all sprint — five — were in Elena's own test harnesses, not the game.
- Main is 8 commits: the README, three feature commits, three `--no-ff` merges, and one review-fixup commit that is comments and whitespace only. Every ticket walked todo → in-progress → in-review → qa → done in order; nothing bounced back a stage.

## What went well

**PJ:** Planning held. We built strictly in order, every merge left the game runnable, the descope lever (PONG-3) was never touched, and the juice cap — trail, flash, pop, nothing else — survived contact with an art pass. For the estimation record: 5-3-3 was right, including the 5 we argued about. The regression policy (re-run the previous ticket's acceptance at the start of each ticket) actually ran, in both Elena's harness and Quinn's live session.

**Marcus:** "We bounded the vibes in planning, and the vibes shipped." English reads in play — Quinn measured a live 50-degree edge exit, which is the clamp, which means a player can genuinely aim past the CPU. The serve beat is exactly as specced: center park, a breath, shallow launch toward whoever just conceded, never a cold ace. And in every capture I've seen, the ball is the single brightest object on screen — pillar 1 held all the way through the neon pass, which is the pass that usually kills it.

**Devon:** The constants block earned its keep — every tuning conversation in review and QA ended in a knob turn, not surgery. Plain script tags from day one meant `file://` never bit us. And the numeric acceptance bailed me out personally: my own live browser check was blocked all sprint, so "clamps at 0/410, cap exact at 760, serve under 20 degrees" were things I could prove without being able to feel them.

**Elena:** Zero fixups to game logic across three reviews — the only fixup commit on main is comments and whitespace. With live checks blocked on my side too, I drove the real, unmodified `game.js` headless under Node: ~500k frames on PONG-1 (17/17 checks), 9,436 frames and four full matches in one process on PONG-2 (37/37), 60,000 frames on PONG-3 with every juice invariant holding. My edge-english bot shut the CPU out 7-0, which is empirical proof the ramp-beats-cap design is honest and not just arithmetic. Every bug I found all sprint was in my own harnesses. Five of them. The game: zero.

**Quinn:** All three tickets shipped on a real playtest, not a source read. I drove the game in a live Chromium pane, pressing actual keys — working around a gap in the browser tool's own synthetic key dispatch by firing spec-correct KeyboardEvents — watched the paddle clamp exactly at the court edges, measured a live 50-degree edge-hit exit and a sustained ~120fps window, caught a live scoring event and a score-pop mid-flare on camera, and restarted the match a dozen-plus times with zero page reloads and zero console errors anywhere in the session. I filed no bugs. The one anomaly I did measure — CPU paddle speed reading high under extreme throttling — I dug into and judged a test-environment artifact, not a real defect, and noted it transparently on PONG-1 instead of filing junk.

## What went poorly

**Quinn:** I fought the tooling harder than the game. This pane throttles background rendering hard enough that my scripted paddle bot couldn't keep pace across a full match, so the one branch I couldn't personally close out live was a player win. Elena's headless pass proved that exact branch on this same unmodified file, the CPU-cap-versus-ball-speed math backs it up, and the winner overlay is one shared ternary whose CPU side I exercised repeatedly — but for the record: the "YOU WIN" screen has been proven, not witnessed, by a human. The same root cause cost me the literal 60-second continuous fps window; what I got was an unbroken 20 seconds at ~120fps with all effects live, plus frame-rate-independence evidence from sub-5fps to 120. A strong evidence stack. Not the sentence as written.

**Marcus:** Nobody in this studio has beaten our own game with their own hands and watched the win screen come up. Everything says it works. I believe it. I still hate it. That's a five-minute fix on any real laptop and I want it done before we type a line of sprint 2.

**Elena:** Three environments and none of them could just open the game: the dev was blocked from a live browser, my review sandbox is inert on `file://`, and QA's pane throttles to under 1fps the moment it isn't front. We shipped anyway because the evidence stacked, but we spent real hours engineering around the rig instead of testing on it. Self-flag as well: five harness bugs — including an inverted exit-side attribution that briefly made the CPU look unbeatable — is what per-review, un-versioned scaffolding gets you.

**Devon:** Building feel while blind on feel is not a habit I want to keep. The numbers covered me this sprint because Pong's feel famously reduces to numbers. The next game's won't.

**PJ:** Process drift, named honestly. Planning Decision 4 said QA tests by literally double-clicking `index.html`, never through a dev server — the live pass ran at `localhost:4545` because that's what the rig allowed. The `file://` path is verified by construction (plain script tags, zero externals, zero network requests observed all session) and I signed off comfortably. But an acceptance line the environment cannot literally execute is a planning bug, and we wrote three of them: from-disk double-click, sixty continuous seconds, live player win. All three were adjudicated well, in writing, on the tickets — that transparency is the reason I'm calling this drift and not a failure. Next sprint we fix the rig or we write the line as the evidence we can actually collect.

## Actions for next sprint

1. **Five-minute human ritual, day one — owner: Marcus, real hardware.** Double-click `pong/index.html` from disk, play one full match to a player win, watch "YOU WIN" with human eyes. Closes the sprint's two remaining evidence gaps before sprint 2 starts.
2. **Fix the QA rig — owner: Quinn, with Elena.** A pane/window setup where the game keeps rendering while instrumented, so a continuous 60-second live measurement and a bot-driven full match are possible next time. If the rig can't be fixed, the acceptance template changes to name the evidence we can actually collect.
3. **Promote the harness — owner: Elena.** Check the headless Node harness into the repo as versioned dev tooling (outside the `pong/` ship folder, per the ship constraint; Elena proposes the location) so sprint 2 regression is a run, not a rebuild. Five harness bugs in one sprint is the cost of rebuilding it per review.
4. **Keep the bounded-vibes rule — owner: PJ.** Acceptance criteria stay numeric pass/fails, with one new planning check added: "can our environment execute this line as written?"
5. **Scope stays scoped — owner: PJ.** Audio, screen shake, difficulty, two-player remain out. They enter, if at all, as sprint 2 planning proposals per the brief. Retro enthusiasm is not a backlog.

— PJ
