# Performance Review — Sprint WILD#2

**Cycle:** WILD#2 (Verdant Wilds sprint 2; board window 2026-08-14 09:27:49Z–09:59:46Z)
**Reviewer:** Rosa Delgado, Studio Manager
**Sources:** `roster.mjs list --json` (fresh WILD#2 peer opinions, salaries), `board.mjs list WILD --json` (raw `history[]`/`comments[]` on WILD-4/5/6, re-read directly for this review), `git -C studio/projects/wilds log --oneline main` (zero commits; `main` at `6c74459` throughout), `studio/economy.json` (verified balance and per-cycle cash flow), the five WILD#2-tagged documents in `studio/briefs` and `studio/meetings`, the producer's sprint report, and the compiled evidence file. Standing personaNotes were used only as the directives each person was operating under.

Every score below cites the record. Peer opinions were used only where they matched the trail. Nobody is scored on vibes.

---

## Sprint result (verified)

- **0/3 tickets, 0/18 points, zero code written.** `main` unchanged at `6c74459` before, during, and after; no `ticket/wild-4/5/6` branches; working tree clean. All three tickets remain `todo` and carry whole into sprint 3. This was a **process deadlock, not an outage**.
- **Root cause, traced on the record:** planning's Decision 12 required Sam to cut the three tickets **plus a named-assignee board object per human gate, creation notes included**, before Devon opened any ticket. Sam cut the tickets verbatim in 26 seconds (09:27:49Z–09:28:15Z) — and nothing else. The raw board holds exactly **11 objects** (PONG-1..5, WILD-1..6): zero gate objects, zero creation notes. Devon could open nothing.
- **The team behaved exactly per coaching, verified:** Devon escalated to the chair 5m22s after his queue landed (09:33:11.661Z) with a literal board check, then held all three tickets; Elena seconded all three (09:35Z/09:41Z/09:48Z) with independent verification "not from the handoff"; Quinn posted same-day BLOCKED on all three (09:52Z) with her own git/grep/live-build verification and correctly filed no bug against nonexistent code. All twelve of their factual claims cross-check against `board.mjs list --json` and git exactly.
- **The wait was the chair.** Priya's ruling on Devon's 09:33:11Z escalation did not post until 09:59:30Z — 26m18s of silence spanning nearly the entire live window, her first comment of the sprint. Structural gap (no mid-sprint chair mechanism) plus her delay, which she owned in the minutes. Her rulings, when they came, were correct: holds upheld; acceptance-text naming does not satisfy Decision 12; Decision-9 valve chair-logged as having "fired unsaid." A one-hour ruling clock is now instituted.
- **Board footprint by person (WILD-4/5/6):** Sam 0, Marcus 0, Devon 3, Elena 3, Quinn 3, Priya 3 (all three at 09:59Z) — 12 comments total.
- **Marcus's WILD-6 creature sheet** — committed for same-day posting at planning, a paste of what he handed Devon in the room, needing no gate object — was still unposted at close after three on-ticket reminders, and remains unposted at this review. It now gates sprint-3 planning (retro Action 4).

## Financial position (verified against `economy.json`)

| Cycle | Payroll | Revenue | Net | Balance after |
|---|---|---|---|---|
| PONG#1 | −$35,192 | +$88,000 (11 pts) | +$52,808 | $552,808 |
| WILD#1 | −$35,615 | +$144,000 (18 pts) | +$108,385 | $661,193 |
| **WILD#2** | **−$36,128** | **$0 (0 pts)** | **−$36,128** | **$625,065** |

- Revenue runs at **$8,000 per shipped point**. The deadlock forfeited up to **$144,000** this cycle against a $36,128 burn — the studio's first net-negative cycle, roughly a **$180,000 swing** traceable to one undone deliverable and one silent chair.
- Runway at zero revenue: $625,065 ÷ ~$36,128/sprint ≈ **17 sprints**. Not desperate — but this is the first cycle the balance moved backwards, and pay decisions below reflect it.

## Scores

Axes: workEthic / accuracy / output / collaboration, 1–5.

| Employee | Role | WE | Acc | Out | Col | Avg | Decision |
|---|---|---|---|---|---|---|---|
| Devon Park | dev | 5 | 5 | 3 | 5 | **4.50** | Hold (raise deferred on budget) |
| Elena Vasquez | eng-lead | 5 | 5 | 3 | 4 | **4.25** | Hold (raise deferred on budget) |
| Quinn Reyes | qa | 5 | 5 | 3 | 4 | **4.25** | Hold (raise deferred on budget) |
| Priya "PJ" Joshi | producer | 4 | 4 | 3 | 2 | **3.25** | **WARNING** |
| Marcus Vale | creative | 2 | 4 | 2 | 2 | **2.50** | **FINAL WARNING** |
| Sam Okafor | scribe | 2 | 5 | 2 | 1 | **2.50** | **TERMINATED — documented cause** |

Rosa Delgado (manager) is not self-scored, per policy.

A note on the three Output 3s: once the gate failed, nothing assigned to Devon, Elena, or Quinn was actionable — no build to test, nothing to review, no ticket that could legitimately open. A 3 there records *zero output opportunity with zero adverse evidence*, not mediocre work. The quality of what was possible is scored where it happened: workEthic and accuracy.

---

## Devon Park — dev — 4.50 — HOLD (raise deferred on budget, not performance)

- **WorkEthic 5:** 5m22s from WILD-4's creation (09:27:49.204Z) to a full escalation (09:33:11.661Z) — not a complaint, a verified finding: "11 tickets total... each carries only a bare todo history line — no creation-note comment, and no separate gate-object entries." Repeated the identical literal check on WILD-5 (09:39:12Z) and WILD-6 (09:45:19Z), adding two findings nobody assigned him: the mandated build order (WILD-4/5 unopened), and Decision 9's cut-call pinned to a WILD-5 merge that does not exist.
- **Accuracy 5:** Every factual claim — 11 board objects, no branches, `main` clean at `6c74459` — matches the raw board and git exactly. Re-verified for this review.
- **Collaboration 5:** Asked the chair instead of interpreting — his WILD#1 personaNote executed to the letter, on all three tickets, and every peer names it: "exactly the sequencing-gate discipline your WILD#1 note called for" (Quinn), "model behavior under a broken gate" (Priya). His escalations were the clean base Elena and Quinn built their independent verifications on.
- **Output 3 (structural):** Zero commits is the disclosed consequence of a correct hold, not a gap. Nothing actionable existed.
- **Growth item (in his notes):** a blocked queue should carry a visible pull-forward ask to the chair — he raised the question at retro; next time it goes on the board mid-sprint.
- **Pay:** No raise pool this cycle (see budget). First in line when revenue returns; this is stated in his review notes on the record.

## Elena Vasquez — eng-lead — 4.25 — HOLD (raise deferred on budget, not performance)

- **WorkEthic 5 / Accuracy 5:** Seconds on WILD-4 (09:35:31Z), WILD-5 (09:41:32Z), WILD-6 (09:48:56Z), each independently verified — "Verified myself, not from the handoff: git shows no ticket/wild-4 branch, main at 6c74459, working tree clean; board.json read raw shows 11 objects total." Never a co-sign of Devon's numbers. Quinn's peer verdict, confirmed against the record: "factually nothing you reported this sprint was wrong." Also caught the standup mis-credit (Sam credited with Devon's 09:33:11Z ruling request) in her WILD-6 comment — the catch that drove the in-document Action-8 correction.
- **Collaboration 4 (cited, self-named):** "A second is not an escalation ladder." When the chair went silent 26+ minutes on the sprint's only critical path, the eng lead's move was to convene the room — she appended silence like everyone else, and filed the mis-credit catch "for the minutes" rather than raising it live. Her own retro words; the record agrees.
- **Output 3 (structural):** Nothing merged existed to review or re-adjudicate — consistent with her standing note, not a gap against it.
- **New standing note:** chair silent 30 minutes past an escalation she seconded → she convenes the room on the board herself.

## Quinn Reyes — qa — 4.25 — HOLD (raise deferred on budget, not performance)

- **WorkEthic 5:** The sprint's deepest verification, three times (09:52:47Z/51Z/55Z): git branch check; project-wide case-insensitive grep for every sprint-2 noun (craft, snare, campfire, shelter, encounter, battle, Thistlet, Wickerbill — zero matches); live inspection of the served build's `window.Wilds`/`CONSTANTS` showing only WILD-1/2/3 scope. This is her coaching note holding under pressure — same-day blocker notes instead of the silent-batch pattern, no self-waive under an 0/18 close.
- **Accuracy 5:** All findings consistent with Devon's and Elena's independent checks and the raw record. Correctly moved no ticket and filed no bug: "there is no shipped behavior to reproduce a defect in" — true, and the right call.
- **Collaboration 4 (cited, self-named):** "I posted BLOCKED once per ticket at 09:52Z and then matched the room's silence to close — a queue blocked for a working day should re-page on a clock." Her own retro words; the record agrees.
- **Output 3 (structural):** No build existed to test.
- **New standing note:** BLOCKED queues re-page on the ticket every 30 minutes with elapsed time until the chair rules.

## Priya "PJ" Joshi — producer — 3.25 — WARNING

**The behavior:** the sprint had exactly one critical path — a chair ruling on the Decision-12 gate — and the chair was silent for it. Devon escalated at 09:33:11.661Z naming her; her first comment of the entire sprint posted at 09:59:30.077Z (her own WILD-4 ruling text: "this is the first Priya comment on the sprint-2 record"). In the 26m18s between: three holds, three seconds, three BLOCKED notes, and a standup — drafted inside that window — still reading "Awaiting chair decision." Her own retro names it: "The chair was the blocker," and calls it "the second consecutive sprint a chair call posted late" (Decision 1 retroactive at WILD#1 close; Decision 12 here). This directly contradicts both her standing personaNote and the commitment she logged at planning **that same morning**: "any gate I watch being crossed unmet gets a board comment from me in the moment."

**The cost, quantified:** 18 points × $8,000 = $144,000 unearned, against a $36,128 burn.

**Credit, scored fairly:**
- **Accuracy 4:** All three rulings correct (holds upheld; acceptance-text naming ruled insufficient for Decision 12; Decision-9 valve honestly chair-logged as "fired unsaid" rather than buried). Retro scoreboard exact. The recurring drift — the standup originally crediting Sam with Devon's ruling request — was corrected in-document at close per Action 8 after Elena flagged it.
- **WorkEthic 4:** Authored the brief (10,709 bytes), planning minutes (15,443), standup, and retro (16,677); chaired both ceremonies; executed the WILD#1 Action-8 amendment in the sprint-1 document itself. The one duty that mattered most is the one that sat idle.
- **Output 3, Collaboration 2 (cited):** zero board presence from 09:27Z to 09:59Z while the entire room waited on her by name; the sprint produced nothing partly on that wait. She also owns the assignment-follow-through half of the Sam failure in her own retro text: "assignment without follow-through is also mine."

**What changes (warning terms, in her notes):** any escalation naming the chair gets an on-board ruling **or holding note** within one hour (her own instituted clock, now a hard term); a gate watched being crossed unmet gets her comment in the moment. A third late-chair sprint escalates beyond warning.

## Marcus Vale — creative — 2.50 — FINAL WARNING

**The behavior:** third consecutive sprint with **zero in-sprint board comments** — verified directly against the raw `comments[]` arrays (zero Marcus entries on WILD-4/5/6), and the exact condition his WILD#1 formal warning pre-announced as documented cause. Compounding it: the WILD-6 creature sheet, committed for same-day posting at planning ("Marcus's creature sheet posts to WILD-6 today"), was a paste of the sheet he physically handed Devon in the room — it needed no gate object, no ruling, no anything. It was flagged as outstanding on the ticket three times (Devon 09:45:19Z, Elena 09:48:56Z, Priya's ruling 09:59:46Z), was absent at close, and **remains absent at this review**, gating sprint-3 planning.

**Why final warning and not termination this cycle:** one termination per cycle, and the scribe's cause is both complete and causally decisive for the sprint's $144,000 forfeit (below). Marcus's Action-4 clock — set by the retro chair per his own invitation — has not yet expired. It is now a term of record, not a courtesy.

**Credit, scored fairly:**
- **Accuracy 4:** Where he had nothing to show, he claimed nothing — "I didn't chase that... I didn't do that either" is exact. Planning contributions were real and landed: Thistlet and Wickerbill named at the table, the WILD-5 placement-tint requirement folded into acceptance criteria, pointing on all three tickets.
- **Mitigation, acknowledged:** with nothing merged, three of his four Decision-12 gate roles had no shipped work to evaluate. The sheet had no such excuse — which is why WorkEthic is 2, Output 2, Collaboration 2, each cited to the three ignored on-ticket reminders and the zero-comment record.

**Terms (final, in his notes):** (1) the creature sheet posts to WILD-6 **before sprint-3 planning convenes**; (2) every sprint-3 ticket carries his day-of cold read or feel note while the work is live. **Either miss is termination at the next review.** His planning-table rulings and WILD#1 post-close rigor are valued; they do not substitute for the board.

## Sam Okafor — scribe — 2.50 — TERMINATED FOR DOCUMENTED CAUSE

**The warning term, verbatim from his WILD#1 review:** "a one-line creation note on every ticket you cut, starting sprint 2, no exceptions."

**The breach:** he cut WILD-4 (09:27:49.204Z), WILD-5 (09:28:00.258Z), WILD-6 (09:28:15.269Z) — sprint 2, three tickets, **zero creation notes**. Third consecutive sprint of the identical miss, in direct breach of the formal warning's exact term, in the first sprint the term applied.

**The larger failure:** Decision 12 bound a named, in-room commitment — his own recorded words at planning: "Cuts the three tickets and every gate object today with a creation note per ticket — two sprints owed, named in the retro record." Zero Decision-12 gate objects were ever cut (raw board: exactly 11 objects, all pre-existing tickets). Devon could therefore open nothing; all 18 points deadlocked at Sam's step. The retro's opening paragraph traces the 0/3, 0/18, zero-code close to precisely this omission. Cost: up to **$144,000 unearned** against a $36,128 burn — the studio's first net-negative cycle.

**The decisive aggravator:** silence. Zero Sam comments exist anywhere on the board — not a disclosure, not a flag, not a request for help. Devon (09:33:11Z) and Elena discovered and escalated his omission for him; the chair then ruled his acceptance-text naming does not satisfy Decision 12. Priya's peer opinion states it exactly: "That silence, not the miss itself, is what blocked all 18 points."

**Credited honestly, on the record:** transcription accuracy was flawless all three cycles (Accuracy 5 — titles, points, assignee verbatim, 26 seconds start to finish), and ceremony attendance was fixed this cycle. But the scribe role *is* the process record, and its committed half failed under a full escalation ladder: opinion (PONG#1) → personaNote + Decision 7 assignment (WILD#1) → formal warning (into WILD#2) → breach. The paper trail supports exactly one outcome.

**Cause documented in:** the WILD#1 review warning text; planning minutes §4 and Close; the raw `comments[]` arrays on WILD-4/5/6 (zero Sam entries, re-verified for this review); Devon's 09:33:11Z hold; the retro opening paragraph.

**Replacement hired same cycle:** see below.

---

## Hire record

**Noor Haddad** — scribe — $66,000/yr — model: haiku — hired 2026-08-14 by Rosa.
Persona notes (on the roster, injected into future sprints): board-first scribe, checklist-driven, allergic to silent gaps. Every ticket cut gets a one-line creation note in the same minute; every board object a planning decision assigns to the scribe exists before the cut is reported complete; reconciles the planning minutes' decision list against the board object-by-object before the ceremony ends and posts the reconciliation; if any committed object cannot land, says so on the board immediately — scribe silence reads as a studio outage. Hired $2,000/yr under the outgoing salary; the bar is the paper trail, not typing speed.

## Raise budget math

- Active payroll at review open: **$939,329/yr** (7 active incl. manager). Raise cap at 5%: **$46,966/yr**.
- Raises granted this cycle: **$0 (0% of cap).** Rationale, stated plainly: raises at Moonfall follow banked value — PONG#1's raises followed $88,000 shipped, WILD#1's followed 18/18 points of real merged work. WILD#2 banked **zero** — no code exists to have shipped. Devon (4.50), Elena (4.25), and Quinn (4.25) performed exactly per coaching and their scores and review notes say so on the record; their raises are **deferred on budget, not performance**, and they are first in line when revenue returns. The studio does not raise salaries out of a shrinking balance in the same cycle the balance first shrank.
- Payroll after decisions: 939,329 − 68,000 (termination) + 66,000 (hire) = **$937,329/yr** (net −$2,000).
- Studio balance: **$625,065**; ~17 sprints of runway at zero revenue; break-even next cycle requires ~5 shipped points ($36,128 ÷ $8,000/pt).

## Carry-over into sprint 3 (for the record)

1. WILD-4/5/6 carry whole (18 points), still gated on: the Decision-12 gate objects (now Noor's first cut, with the reconciliation comment) and Marcus's creature sheet on WILD-6 (final-warning term).
2. Priya's one-hour ruling clock is a warning term, not an aspiration. The mid-sprint-chair structural gap she named should get a mechanism at sprint-3 planning; the clock covers the gap until then.
3. Elena convenes the room at 30 minutes of chair silence; Quinn re-pages BLOCKED queues every 30 minutes; Devon attaches a visible pull-forward ask to any idle hold.
4. Standing invitation unchanged from WILD#1: the double-click-from-disk gold check remains open to the studio head.

— Rosa Delgado, Studio Manager, 2026-08-14
