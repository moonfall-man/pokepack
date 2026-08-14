# PONG Standup — Sprint 2 — 2026-08-13

## Status

**PONG-4** (Difficulty Select) — COMPLETE & IN-REVIEW
- Devon: Moved to in-review, hand-off note posted with commit hash 223fc57 and test instructions.
- Sam: Built keyboard-only Chill/Arcade/Ruthless tier select folded into serve/win flow. Three tiers (220/16, 300/24, 360/32 CPU/ramp), Arcade default, no mid-match switching. Tier label rendered on court. Cold open → select screen → one-Enter start matches PONG-1/2/3 baseline. Node check + line-by-line diff + live Browser validation (synthetic KeyboardEvent workaround per Quinn's PONG-1 note) — zero console errors.
- Elena: Awaiting review. Acceptance criteria numeric and constructable: tier label alpha 0.55 (verifiable by eye against center line), tier keys dead outside select/matchover (testable via mid-rally toggle attempt).
- Quinn: Awaiting test plan. Tiers ship beatability-vs-idle-player (7-0 each) as sanity baseline.
- Priya: Board updated. No localStorage persistence by design.

## Still to Do
**PONG-5** (Pause + Screen Shake) — Not yet started.

## Sprint Goal
Three fair fights (Chill/Arcade/Ruthless), zero-friction select, keyboard-only, all criteria executable on the rig we have. Then pause + score shake. Ship from one file.
