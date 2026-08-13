---
name: game-studio
description: Moonfall Interactive — an AAA-style game studio of agents (producer, creative director, eng lead, dev, QA, scribe, studio manager) that takes a task and ships it like a game company. Use when the user gives the studio/team a task ("have the team build X", "run a sprint", "give this to the studio"), asks to run/start/serve/screenshot the studio dashboard or board, asks about tickets/sprint/roster/budget status, or wants a performance cycle (reviews, raises, hires, fires). Runs sprints via the Workflow tool; everything is local — a file-based Jira-style board, roster, and economy under studio/.
---

# Moonfall Interactive — the game studio

All paths are relative to the repo root. State lives in `studio/` (board.json,
roster.json, economy.json, briefs/, meetings/, hr/, projects/). The studio ships
games as static-file projects in `studio/projects/<slug>/`, each its own git repo
(gitignored from the host repo).

| Piece | File | What it is |
|---|---|---|
| Sprint pipeline | `.claude/skills/game-studio/studio.workflow.mjs` | Workflow: kickoff → planning meeting → board seeding → dev branches → lead review/merge → QA playtest → retro |
| Performance cycle | `.claude/skills/game-studio/performance.workflow.mjs` | Workflow: books settle → peer opinions → manager scores, raises, warns, hires, fires |
| Board (local Jira) | `.claude/skills/game-studio/board.mjs` | CLI + dashboard server (tickets, sprints, points, comments, history) |
| Roster (HR) | `.claude/skills/game-studio/roster.mjs` | CLI: employees, salaries, reviews, peer opinions, hire/fire, manager notes |
| Economy | `.claude/skills/game-studio/economy.mjs` | CLI: budget ledger — payroll burns, shipped points earn |
| Personas | `.claude/agents/studio-*.md` | The team, for direct interactive Agent use (workflows embed the same personas from the roster) |

The roster is the source of truth for who holds each seat. Sprint kickoff reads it,
so the manager's hires/fires/coaching-notes and each person's held opinions of
colleagues flow into the next sprint's prompts automatically.

## Prerequisites

Node >= 18 on PATH (verified with v24.18.0). No installs, no npm — every tool is a
zero-dependency single file.

## Start the dashboard (agent path — do this first)

`.claude/launch.json` defines the server; start it with the preview tool:

```
preview_start {name: "studio-board"}    → http://localhost:4545
```

or by hand:

```bash
node .claude/skills/game-studio/board.mjs serve --port 4545
```

- `/` — live dashboard (vitals: balance/burn/headcount/velocity/bugs · team cards
  with salaries and ratings · kanban · activity feed), auto-refreshes every 2s.
- `/projects/<slug>/index.html` — play a shipped build (QA playtests through this URL).
- `/meetings/`, `/briefs/`, `/hr/` — the studio's documents, served as text.
- Verify the page rendered with `get_page_text` / screenshot. First init if the team
  strip is empty: `node .claude/skills/game-studio/roster.mjs init` and
  `node .claude/skills/game-studio/economy.mjs init`.

Restart the server (preview_stop + preview_start) after editing board.mjs — the UI
and endpoints are served from the running process.

## Run a sprint (the agency itself)

1. Make sure the dashboard server is up (QA playtests through it).
2. Invoke the Workflow tool with the script file and args (this exact call ran clean:
   15 agents, 0 errors, ~3h wall clock, all tickets shipped):

```
Workflow {
  scriptPath: "<abs repo root>/.claude/skills/game-studio/studio.workflow.mjs",
  args: {
    "task": "Build 'Studio Pong' — a polished browser Pong: player vs a simple CPU opponent, keyboard controls (W/S or arrow keys), first to 7 with a win screen and restart, neon arcade presentation with a little juice (ball trail, hit flash). Static files only, no audio needed.",
    "date": "<today ISO>",
    "repoRoot": "<abs repo root with FORWARD slashes>",
    "projectKey": "PONG", "projectName": "Studio Pong", "projectSlug": "pong",
    "maxTickets": 3, "port": 4545
  }
}
```

- Same `projectKey` again = next sprint on that game (sprint number increments, the
  brief builds on what shipped). New key/slug = new game.
- The return value carries the producer's report, cast, tickets, QA verdict, and the
  play URL. Relay the report to the user.
- Senior roles (producer/creative/eng-lead) inherit the session's top model — sprints
  are slow and deliberate. Watch progress with /workflows, or arm a Monitor on
  ticket movement:

```bash
prev=""; while true; do
  cur=$(node -e 'const fs=require("fs");try{const b=JSON.parse(fs.readFileSync("<abs repo root>/studio/board.json","utf8"));console.log(b.tickets.map(t=>t.id+":"+t.status).join(" ")||"board-empty")}catch(e){console.log("no-board-yet")}')
  if [ "$cur" != "$prev" ]; then echo "$cur"; prev="$cur"; fi
  sleep 15
done
```

## Run the performance cycle (after a sprint)

```
Workflow {
  scriptPath: "<abs repo root>/.claude/skills/game-studio/performance.workflow.mjs",
  args: {
    "date": "<today ISO>", "repoRoot": "<abs repo root, forward slashes>",
    "projectKey": "PONG", "projectSlug": "pong", "sprintNumber": 1,
    "sprintReport": "<the sprint's report string, condensed>"
  }
}
```

Three phases: a clerk settles the books (payroll burns ~$35k for the founding 7,
each shipped point earns $8k) and a sonnet clerk compiles the evidence file from
board history + git; every employee submits peer opinions; then Rosa Delgado scores
everyone (workEthic/accuracy/output/collaboration, 1-5, evidence-cited), grants
raises within a 5%-of-payroll budget, issues warnings, and may fire (max one, with
cause) and hire a replacement. Outputs: `studio/roster.json` (salaries, reviews,
opinions), `studio/economy.json` (ledger), `studio/hr/<date>-performance-*.md`
(the full review document). All of it shows on the dashboard.

## CLI reference (all verified)

```bash
node .claude/skills/game-studio/board.mjs init PONG "Studio Pong"
node .claude/skills/game-studio/board.mjs sprint-start PONG "Ship a playable pong"
node .claude/skills/game-studio/board.mjs add PONG "Core loop" --type story --points 3 --sprint 1 --assignee "Devon Park" --desc "..." --acceptance "a;b"
node .claude/skills/game-studio/board.mjs move PONG-1 in-progress --by "Devon"
node .claude/skills/game-studio/board.mjs comment PONG-1 "abc1234 - how to test" --by "Devon"
node .claude/skills/game-studio/board.mjs list PONG            # add --json for data
node .claude/skills/game-studio/board.mjs show PONG-2
node .claude/skills/game-studio/board.mjs sprint-close PONG
node .claude/skills/game-studio/board.mjs snapshot             # static board-snapshot.html

node .claude/skills/game-studio/roster.mjs init
node .claude/skills/game-studio/roster.mjs list                # add --json / --active
node .claude/skills/game-studio/roster.mjs opinion devon "Shipped fast, cut one corner." --by "Elena" --sprint "PONG#1"
node .claude/skills/game-studio/roster.mjs review devon --scores "workEthic=4,accuracy=3,output=5,collaboration=4" --decision raise --raise 4 --notes "strong output" --sprint "PONG#1" --by "Rosa"
node .claude/skills/game-studio/roster.mjs fire sam --reason "..." --by "Rosa"
node .claude/skills/game-studio/roster.mjs hire "Jamie Chen" --role scribe --model haiku --salary 70000 --notes "meticulous, dry humor" --by "Rosa"
node .claude/skills/game-studio/roster.mjs set-notes devon "Test the win path before claiming tested."

node .claude/skills/game-studio/economy.mjs init               # $500k seed (idempotent)
node .claude/skills/game-studio/economy.mjs payroll --note "sprint PONG#1"
node .claude/skills/game-studio/economy.mjs revenue 8
node .claude/skills/game-studio/economy.mjs show               # add --json for data
```

Statuses: backlog | todo | in-progress | in-review | qa | done. Booleans (`--json`,
`--active`) never take a value. Testing? Point `STUDIO_DIR` env var at a scratch dir
and every CLI works against it instead of `studio/`.

## The team and its models

| Seat | Founder | Model | Why |
|---|---|---|---|
| Producer | Priya "PJ" Joshi | inherit (session top) | meeting synthesis, minutes, retro judgment |
| Creative director | Marcus Vale | inherit | vision and feel arguments |
| Eng lead | Elena Vasquez | inherit | real-diff review, merge authority |
| Gameplay dev | Devon Park | sonnet | fast, strong implementation |
| QA lead | Quinn Reyes | sonnet | hands-on browser playtesting |
| Scribe | Sam Okafor | haiku (effort low) | verbatim minutes, board seeding |
| Studio manager | Rosa Delgado | inherit | evidence-based people decisions |

Model routing lives on the roster (`inherit` = omit the model option so the agent
inherits the session model); the workflows read it per seat.

## Gotchas (all hit for real in the build)

- **Workflow `args` can arrive as a JSON string**, not an object. Both workflow
  scripts open with `typeof args === 'string' ? JSON.parse(args) : args`. Keep that.
- **`.claude/agents/*.md` created mid-session are not in the agent registry** until
  the next session — `agent({agentType})` fails with "not found". That is why the
  workflows embed personas in prompts instead of using agentType.
- **`node --check` rejects workflow scripts** ("Illegal return statement") — the
  Workflow runtime wraps them in a function, so top-level `return` is legal there.
  Only validate board/roster/economy with `node --check`; validate workflows by
  launching them.
- **Browser-pane screenshots time out when the pane is not displayed**
  ("not compositing frames"). DOM tools still work — the QA prompts teach the
  fallback (`get_page_text`, `javascript_tool`). QA also found the pane's synthetic
  key dispatch doesn't reach some games and worked around it by dispatching
  spec-correct `KeyboardEvent`s via javascript_tool; background panes throttle
  `requestAnimationFrame`, which makes real-time bots unfairly slow — treat timing
  anomalies under throttling as test-environment artifacts, not game bugs.
- **OneDrive transient file locks**: all three CLIs retry writes with backoff and
  serialize read-modify-write through lock dirs (`studio/.board.lock` etc.). If a
  CLI ever reports "locked" persistently, a crashed process left the dir — delete it.
- **Monitors on the board time out during long senior-agent turns** (an inherit-tier
  review can run 30+ min without a board move). Silence usually means thinking, not
  death: check transcript file mtimes in the workflow's transcript dir before
  assuming a stall.
- **Never `git add -A` in this repo** — `studio/projects/` contains nested git repos
  (gitignored, as are `.board.lock`/`*.tmp`), and stray user files (e.g. a
  `.pokepack` in packs/) must not be swept into commits. Stage explicit paths.
- **Meeting/retro filenames carry `-s<sprintNumber>`** from sprint 2 on; sprint 1
  predates the suffix.

## Troubleshooting (errors actually hit)

- `Error: args must include task, ...` on workflow launch → args reached the script
  as a string and an old script version didn't parse it; both current scripts do.
- `agent type 'studio-…' not found. Available: claude, …` → you passed agentType in
  a session that created the agent files; use the embedded-persona path (current
  scripts already do).
- `SyntaxError: Illegal return statement` from `node --check` on a workflow script →
  expected; not an error in the script.
- `screenshot failed: … Browser pane is not displayed` → pane hidden; use
  `get_page_text`/`read_page`, or retry when the pane is visible.
- `port 4545 busy — board is probably already at http://localhost:4545` → serve
  exits 0 on EADDRINUSE by design; reuse the running server or preview_stop it.
- Sprint seems stuck → `ls -lt` the workflow transcript dir; if the newest
  `agent-*.jsonl` is minutes old it's alive. Truly dead → resume with
  `Workflow {scriptPath, resumeFromRunId}` (finished agents replay from cache).

## Human path

Open http://localhost:4545 in any browser and watch; play builds at
`/projects/<slug>/index.html`. Everything else is agent-driven.
