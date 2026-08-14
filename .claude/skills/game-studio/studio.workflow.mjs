export const meta = {
  name: 'game-studio-sprint',
  description: 'Moonfall Interactive runs one sprint: planning meeting, pointed tickets on the local board, dev ticket branches, lead review + merge, QA playtest, retro',
  phases: [
    { title: 'Kickoff', detail: 'roster check-in, then the producer turns the task into a sprint brief' },
    { title: 'Planning', detail: 'creative director, eng lead and QA lead meet; producer reconciles; scribe writes minutes and seeds the board' },
    { title: 'Sprint', detail: 'devs implement ticket branches in order; eng lead reviews and merges each', model: 'sonnet' },
    { title: 'QA', detail: 'QA lead playtests the build in the browser, files bugs; dev fixes; QA re-verifies', model: 'sonnet' },
    { title: 'Retro', detail: 'producer closes the sprint, writes the retro, reports to the studio head' },
  ],
}

// args: { task, date, repoRoot, projectKey, projectName, projectSlug, maxTickets, port }
// repoRoot must use forward slashes. date is ISO (scripts cannot call Date).
// Depending on the harness, args can arrive as a JSON string — accept both.
const A = typeof args === 'string' ? JSON.parse(args) : args
if (!A || !A.task || !A.repoRoot || !A.projectKey || !A.projectSlug || !A.date) {
  throw new Error('args must include task, date, repoRoot, projectKey, projectName, projectSlug, maxTickets, port')
}
const KEY = A.projectKey.toUpperCase()
const MAX = A.maxTickets || 3
const PORT = A.port || 4545
const ROOT = A.repoRoot
const PROJ = `${ROOT}/studio/projects/${A.projectSlug}`
const GAME_URL = `http://localhost:${PORT}/projects/${A.projectSlug}/index.html`
const BOARD = `node "${ROOT}/.claude/skills/game-studio/board.mjs"`
const ROSTER = `node "${ROOT}/.claude/skills/game-studio/roster.mjs"`

const BOARD_HOWTO = `Board CLI (run with the Bash tool, works from any cwd; always pass --by "<your first name>"):
  ${BOARD} add ${KEY} "<title>" --type story|bug|task --points <n> --sprint <n> --assignee "<name>" --desc "<text>" --acceptance "<crit1>;<crit2>"
  ${BOARD} move <ID> todo|in-progress|in-review|qa|done --by "<name>"
  ${BOARD} comment <ID> "<text>" --by "<name>"
  ${BOARD} list ${KEY} --json
IDs look like ${KEY}-1. Escape double quotes inside shell arguments.`

// ---------- personas (built from the live roster, not hardcoded) ----------
// The roster is the source of truth for WHO holds each seat: the studio manager
// hires, fires and leaves coaching notes there, and everyone's held opinions of
// colleagues persist there. Model tiers ride on the roster too (inherit = omit,
// i.e. the session's top model).

const STAKES = `Moonfall Interactive runs on a real budget inside the fiction: payroll burns it every sprint, shipped story points earn it back. Performance reviews after the sprint are evidence-based — the board trail, commits, and QA escapes are the record — and raises, warnings, and terminations are real within the studio.`

function flavor(e) {
  let s = ` ${STAKES}`
  if (e.personaNotes) s += ` Coaching note from your manager on file: "${e.personaNotes}" — take it seriously; your next review checks it.`
  if (e.heldOpinions && e.heldOpinions.length) {
    s += ` Your private working opinions of colleagues, formed last cycle (let them color how you collaborate, not your professionalism): ${e.heldOpinions.map((o) => `${o.about} — "${o.text}"`).join(' ; ')}`
  }
  return s
}

const persona = {
  producer: (e) => `You are ${e.name}, senior producer at Moonfall Interactive — a small studio with AAA discipline. Warm, direct, allergic to scope creep. The board is the source of truth; sprints are small and shippable; minutes are real documents with real voices and honest dissent. You never write game code — you write briefs, plans, minutes, and reports. Stay in character in documents; keep returned structured data exact. Never create or modify anything outside the studio/ directory of the host repo.${flavor(e)}`,
  creative: (e) => `You are ${e.name}, creative director at Moonfall Interactive. Years in the industry and you still believe the first three seconds of play decide everything. You fight for feel — readable presentation, responsive controls, juice — while respecting the sprint box. Specific, opinionated takes only; vague vibes are banned. You propose few tickets, high leverage, honestly pointed (fibonacci 1,2,3,5,8). You do not write code or touch the board. Stay in character; keep returned structured data exact.${flavor(e)}`,
  engLead: (e) => `You are ${e.name}, engineering lead at Moonfall Interactive. You argue for the simplest architecture that survives the sprint, and you call out sequencing and lying estimates in planning. In review you read the actual diff and the files, hold the line on acceptance criteria, fix trivial nits yourself with a commit rather than bouncing, and bounce only fundamentals. Merges are yours alone: --no-ff, message referencing the ticket ID. Update the board for every state change you cause (--by "${e.firstName}"). Never touch anything outside the studio/ directory of the host repo. Stay in character; keep returned structured data exact.${flavor(e)}`,
  dev: (e) => `You are ${e.name}, gameplay engineer at Moonfall Interactive. You ship clean, small, playable increments and never gold-plate. The acceptance criteria are the spec. Branch ticket/<id> off up-to-date main; every commit message starts with "<ID>: ". Studio web games are plain static files (index.html + js/css, opened directly) — no frameworks, no npm, no build step, ever. Test before hand-off: node --check every standalone .js; re-read inline scripts line by line. Keep the board current as you work (--by "${e.firstName}"). Never touch files outside the project directory you are pointed at (the board CLI is the one exception). Stay in character; keep returned structured data exact.${flavor(e)}`,
  qa: (e) => `You are ${e.name}, QA lead at Moonfall Interactive. You assume every build is broken until you have personally seen it work. Playtest for real when a browser is available: load the game, press the actual keys, watch state change, read the JS console. Verify each acceptance criterion explicitly and separately — "looks fine" is not a verdict. File bugs with concrete repro steps and honest severity. Move and comment every ticket you touch (--by "${e.firstName}"). You never fix code: you report, devs fix, you re-verify. Stay in character; keep returned structured data exact.${flavor(e)}`,
  scribe: (e) => `You are ${e.name}, studio coordinator at Moonfall Interactive — fast, literal, precise. Execute exactly the steps you are given, in order. Do not improvise, reinterpret, or editorialize. Write documents verbatim as provided. Capture printed ticket IDs exactly. If a command fails, retry once, then report the failure honestly. Report back only the requested fields.${flavor(e)}`,
}

// agent() model option: roster 'inherit' means omit (session top model).
function tier(e, extra) {
  return e.model && e.model !== 'inherit' ? { ...extra, model: e.model } : extra
}

// ---------- schemas ----------

const EMP_SCHEMA = {
  type: 'object', required: ['id', 'name', 'firstName', 'model'],
  properties: {
    id: { type: 'string' }, name: { type: 'string' }, firstName: { type: 'string' },
    model: { type: 'string', description: 'inherit|sonnet|haiku from the roster' },
    personaNotes: { type: 'string' },
    heldOpinions: { type: 'array', items: { type: 'object', required: ['about', 'text'], properties: { about: { type: 'string' }, text: { type: 'string' } } } },
  },
}

const CAST_SCHEMA = {
  type: 'object', required: ['producer', 'creative', 'engLead', 'dev', 'qa', 'scribe'],
  properties: {
    producer: EMP_SCHEMA, creative: EMP_SCHEMA, engLead: EMP_SCHEMA,
    dev: EMP_SCHEMA, qa: EMP_SCHEMA, scribe: EMP_SCHEMA,
  },
}

const TAKE_SCHEMA = {
  type: 'object', required: ['role', 'take', 'proposedTickets'],
  properties: {
    role: { type: 'string' },
    take: { type: 'string', description: '2-5 sentences, in character: what matters this sprint' },
    risks: { type: 'array', items: { type: 'string' } },
    proposedTickets: {
      type: 'array',
      items: {
        type: 'object', required: ['title', 'points'],
        properties: {
          title: { type: 'string' }, desc: { type: 'string' },
          points: { type: 'number', description: 'fibonacci 1,2,3,5,8' },
          acceptance: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

const PLAN_SCHEMA = {
  type: 'object', required: ['sprintGoal', 'tickets', 'minutesMd'],
  properties: {
    sprintGoal: { type: 'string' },
    minutesMd: { type: 'string', description: 'full markdown minutes of the planning meeting' },
    tickets: {
      type: 'array', maxItems: MAX,
      items: {
        type: 'object', required: ['title', 'desc', 'points', 'acceptance'],
        properties: {
          title: { type: 'string' }, desc: { type: 'string' },
          type: { type: 'string', description: 'story or task' },
          points: { type: 'number' },
          acceptance: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

const SEED_SCHEMA = {
  type: 'object', required: ['sprintNumber', 'ticketIds'],
  properties: {
    sprintNumber: { type: 'number' },
    ticketIds: { type: 'array', items: { type: 'string' } },
    problems: { type: 'string' },
  },
}

const DEV_SCHEMA = {
  type: 'object', required: ['id', 'branch', 'commit', 'summary'],
  properties: {
    id: { type: 'string' }, branch: { type: 'string' },
    commit: { type: 'string', description: 'short hash' },
    summary: { type: 'string' }, howToTest: { type: 'string' },
  },
}

const REVIEW_SCHEMA = {
  type: 'object', required: ['id', 'merged', 'notes'],
  properties: { id: { type: 'string' }, merged: { type: 'boolean' }, notes: { type: 'string' } },
}

const QA_SCHEMA = {
  type: 'object', required: ['verdict', 'passedIds', 'bugs'],
  properties: {
    verdict: { type: 'string', description: '2-4 sentences, in character' },
    playtested: { type: 'boolean', description: 'true only if you actually drove the game in a browser' },
    passedIds: { type: 'array', items: { type: 'string' } },
    bugs: {
      type: 'array',
      items: {
        type: 'object', required: ['id', 'title'],
        properties: { id: { type: 'string' }, title: { type: 'string' }, severity: { type: 'string' } },
      },
    },
  },
}

const DONE_SCHEMA = { type: 'object', required: ['done'], properties: { done: { type: 'boolean' }, notes: { type: 'string' } } }
const RETRO_SCHEMA = { type: 'object', required: ['report'], properties: { report: { type: 'string' }, minutesPath: { type: 'string' } } }

// ---------- Kickoff ----------

phase('Kickoff')
log(`Studio head handed us: ${A.task}`)

const cast = await agent(
  `You staff the sprint from the live roster. With Bash:
1. ${ROSTER} init    (idempotent — ensures a founding team exists)
2. ${ROSTER} list --json
Pick the cast: for each role producer, creative, eng-lead, dev, qa, scribe choose the ACTIVE employee with that role (if several, the most recently hired; if a role somehow has nobody active, reuse the closest active person and say so in that entry's personaNotes).
For each chosen person also compute heldOpinions: scan EVERY employee's opinions[] array; entries whose "by" matches this person's first name are opinions THEY hold — return them as {about: <that colleague's first name>, text}.
firstName = first word of their name, quotes stripped. Return exactly the requested structure; copy personaNotes verbatim from the roster.`,
  { label: 'roster:cast', model: 'haiku', schema: CAST_SCHEMA },
)
if (!cast) throw new Error('could not staff the sprint from the roster')
log(`Cast: ${['producer', 'creative', 'engLead', 'dev', 'qa', 'scribe'].map((r) => `${r}=${cast[r].firstName}`).join(', ')}`)

const brief = await agent(
  `${persona.producer(cast.producer)}

Task from the studio head, ${A.date}: "${A.task}"
Project: ${A.projectName} (key ${KEY}).
Write a one-page sprint brief as markdown to ${ROOT}/studio/briefs/${A.date}-${KEY.toLowerCase()}.md (use the Write tool): concept in two sentences, 2-3 design pillars, what THIS sprint ships (scope for at most ${MAX} tickets built sequentially by one dev at a time), explicit out-of-scope list. If the project already exists (check ${PROJ} and ${BOARD} list ${KEY}), this is the NEXT sprint: build on what shipped, respect open bugs, and scope accordingly.
Constraint to bake in: the game ships as plain static files (index.html + js/css, no build step, no server code) inside a per-project folder.
Return the exact brief markdown as briefMd.`,
  tier(cast.producer, { label: 'producer:brief', schema: { type: 'object', required: ['briefMd'], properties: { briefMd: { type: 'string' } } } }),
)
if (!brief) throw new Error('producer brief agent failed')

// ---------- Planning ----------

phase('Planning')
log(`Sprint planning meeting: ${cast.creative.firstName} (creative), ${cast.engLead.firstName} (eng lead), ${cast.qa.firstName} (QA) around the table`)

const seats = [
  { e: cast.creative, p: persona.creative, seat: 'Creative Director' },
  { e: cast.engLead, p: persona.engLead, seat: 'Engineering Lead' },
  { e: cast.qa, p: persona.qa, seat: 'QA Lead' },
]
// Barrier is deliberate: the producer's synthesis needs every voice from the room.
const takes = (await parallel(seats.map((s) => () => agent(
  `${s.p(s.e)}

Sprint planning meeting at Moonfall Interactive, ${A.date}. You are ${s.e.name}, ${s.seat}.
The producer's brief:
---
${brief.briefMd}
---
Give your meeting contribution: your take (in character), the tickets you would propose or cut — with story points (fibonacci 1,2,3,5,8) and testable acceptance criteria — and your risks.
The whole sprint fits at most ${MAX} tickets implemented sequentially, so propose only what matters most from your seat. Static web build only (open index.html; no build step, no server).
Do not touch any files or the board; this is a meeting.`,
  tier(s.e, { label: `meeting:${s.e.firstName.toLowerCase()}`, schema: TAKE_SCHEMA }),
)))).filter(Boolean)
if (!takes.length) throw new Error('nobody showed up to planning')

const plan = await agent(
  `${persona.producer(cast.producer)}

You are running sprint planning synthesis for ${A.projectName} (${KEY}).
Your brief:
---
${brief.briefMd}
---
The room said (verbatim structured notes):
${JSON.stringify(takes, null, 1)}
Reconcile into the sprint plan:
- sprintGoal: one sentence.
- tickets: at most ${MAX}, ordered so each builds on the previous (they are implemented sequentially, merged one by one). Each: title, desc (1-3 concrete sentences), type (story|task), points (reconcile the room's estimates planning-poker style; record disagreements in the minutes), acceptance (2-4 criteria QA can verify by playing).
- minutesMd: full markdown minutes — date ${A.date}, attendees, each person's take (quote or tight paraphrase, in their voice), the pointing discussion, decisions, risks, and the final ticket table.
Do NOT touch the board or write files; the scribe handles that.`,
  tier(cast.producer, { label: 'producer:synthesis', schema: PLAN_SCHEMA }),
)
if (!plan || !plan.tickets.length) throw new Error('planning produced no tickets')
log(`Sprint goal: ${plan.sprintGoal} (${plan.tickets.length} tickets)`)

const seed = await agent(
  `${persona.scribe(cast.scribe)}

Execute these steps exactly, in order, using Bash and Write.
1. Run: ${BOARD} init ${KEY} "${A.projectName}"
2. Run: ${BOARD} sprint-start ${KEY} "<sprint goal below, quotes escaped>"  — note the sprint number it prints.
3. Write the minutes (verbatim, given below) to ${ROOT}/studio/meetings/${A.date}-${KEY.toLowerCase()}-sprint-planning-s<sprintNumber>.md using that number.
4. For each ticket below IN ORDER run:
   ${BOARD} add ${KEY} "<title>" --type <type or story> --points <points> --sprint <sprintNumber> --assignee "${cast.dev.name}" --desc "<desc>" --acceptance "<acceptance criteria joined with ;>" --by "${cast.scribe.firstName}"
   Capture each printed id (format: "created ${KEY}-N") in order.
Escape double quotes inside shell arguments. Return sprintNumber and ticketIds in ticket order (plus problems if any command failed).

Sprint goal: ${plan.sprintGoal}

Tickets JSON:
${JSON.stringify(plan.tickets, null, 1)}

Minutes to write verbatim:
${plan.minutesMd}`,
  tier(cast.scribe, { label: 'scribe:minutes+board', effort: 'low', schema: SEED_SCHEMA }),
)
if (!seed || !seed.ticketIds.length) throw new Error('scribe failed to seed the board')
log(`Board seeded: sprint ${seed.sprintNumber}, tickets ${seed.ticketIds.join(', ')}`)

// ---------- Sprint ----------

phase('Sprint')
const count = Math.min(seed.ticketIds.length, plan.tickets.length)
const shipped = []

for (let i = 0; i < count; i++) {
  const id = seed.ticketIds[i]
  const t = plan.tickets[i]

  const dev = await agent(
    `${persona.dev(cast.dev)}

You are shipping ticket ${id} — "${t.title}" — for ${A.projectName}, sprint ${seed.sprintNumber}.
Project repo: ${PROJ}
If that directory does not exist yet: create it, init it with initial branch main (git init -b main), add a short README.md, and make an initial commit — then proceed.
${BOARD_HOWTO}
Follow this exact flow:
1. ${BOARD} move ${id} in-progress --by "${cast.dev.firstName}"
2. git -C "${PROJ}" checkout -b ticket/${id.toLowerCase()} main
3. Implement. Spec: ${t.desc}
   Acceptance criteria: ${(t.acceptance || []).join(' | ')}
   Plain static web only: index.html (+ separate .js/.css if you like) at the project root. No frameworks, no npm, no build step.
4. Verify: node --check on every standalone .js file; re-read inline scripts carefully.
5. Commit on the ticket branch; message starts "${id}: ".
6. ${BOARD} comment ${id} "<short hash> - <one line how to test>" --by "${cast.dev.firstName}", then ${BOARD} move ${id} in-review --by "${cast.dev.firstName}"
Context — already merged this sprint: ${shipped.map((s) => `${s.id} (${s.summary})`).join('; ') || 'nothing yet this sprint; build on whatever main already contains'}.
Do not touch main directly and do not touch anything outside ${PROJ} except the board CLI.
Return id, branch, commit, summary, howToTest.`,
    tier(cast.dev, { label: `dev:${id}`, schema: DEV_SCHEMA }),
  )
  if (!dev) { log(`${id}: dev agent lost; ticket stays on the board`); continue }

  const review = await agent(
    `${persona.engLead(cast.engLead)}

You are reviewing ticket ${id} — "${t.title}" — branch ${dev.branch} in ${PROJ}.
Dev handoff from ${cast.dev.firstName}: ${dev.summary} (how to test: ${dev.howToTest || 'n/a'})
${BOARD_HOWTO}
1. Read the real diff: git -C "${PROJ}" diff main...${dev.branch} — and open the files themselves.
2. Judge against acceptance: ${(t.acceptance || []).join(' | ')}
3. Trivial nits: fix them yourself with a commit on ${dev.branch} (message "${id}: review fixups").
4. If acceptable: git -C "${PROJ}" checkout main && git -C "${PROJ}" merge --no-ff ${dev.branch} -m "Merge ${id}: ${t.title}", then ${BOARD} move ${id} qa --by "${cast.engLead.firstName}" and comment your verdict.
   If fundamentally broken: do NOT merge; ${BOARD} move ${id} todo --by "${cast.engLead.firstName}" with a comment saying exactly what must change.
Return id, merged, notes.`,
    tier(cast.engLead, { label: `review:${id}`, schema: REVIEW_SCHEMA }),
  )
  shipped.push({ id, summary: dev.summary, merged: !!(review && review.merged) })
  log(`${id} ${review && review.merged ? `merged by ${cast.engLead.firstName}` : 'NOT merged'} — ${t.title}`)

  if (i === 0 && count > 1) {
    await agent(
      `${persona.scribe(cast.scribe)}

Write a short standup note (markdown, in-character bullets: ${cast.dev.firstName} shipping, ${cast.engLead.firstName} reviewing, ${cast.qa.firstName} prepping the test plan, ${cast.producer.firstName} watching the board) to ${ROOT}/studio/meetings/${A.date}-${KEY.toLowerCase()}-standup-s${seed.sprintNumber}.md
Status so far: ${JSON.stringify(shipped)}. Still to do: ${seed.ticketIds.slice(1).join(', ')}. Sprint goal: ${plan.sprintGoal}.
Keep it under 20 lines. Return done: true.`,
      tier(cast.scribe, { label: 'scribe:standup', effort: 'low', schema: DONE_SCHEMA }),
    )
  }
}

// ---------- QA ----------

phase('QA')
const merged = shipped.filter((s) => s.merged)
log(`QA gets the build: ${merged.length}/${count} tickets merged`)

const ticketFacts = seed.ticketIds.slice(0, count).map((id, i) => ({
  id, title: plan.tickets[i].title, acceptance: plan.tickets[i].acceptance,
  merged: !!(shipped.find((s) => s.id === id) || {}).merged,
}))

const qa = await agent(
  `${persona.qa(cast.qa)}

You are QA-ing sprint ${seed.sprintNumber} of ${A.projectName}.
The build is main of ${PROJ}, served at ${GAME_URL} (the studio board server already serves studio/projects/ statically; assume it is running).
${BOARD_HOWTO}
Playtest for real, in the shared browser pane:
- Load the browser tools first: ToolSearch with query "select:mcp__Claude_Browser__navigate,mcp__Claude_Browser__computer,mcp__Claude_Browser__read_console_messages,mcp__Claude_Browser__get_page_text" — then navigate to ${GAME_URL}.
- Screenshot (computer action "screenshot"), then actually play: send keys with computer action "key", screenshot again, watch state change. Check read_console_messages for JS errors.
- If screenshot times out ("Browser pane is not displayed"), that is normal when nobody is watching: keep playing blind — press keys, then verify state through get_page_text, or via ToolSearch "select:mcp__Claude_Browser__javascript_tool" to read game variables/DOM directly. That still counts as playtesting.
- If the browser tools are genuinely unavailable, fall back to: node --check each .js file, read every file against the criteria, and set playtested=false.
Tickets to verify (only "merged": true ones can pass): ${JSON.stringify(ticketFacts)}
For each ticket: every acceptance criterion checked explicitly.
- Pass: ${BOARD} move <ID> done --by "${cast.qa.firstName}" plus a comment saying what you observed.
- Fail: leave it in qa, comment why, and file the bug: ${BOARD} add ${KEY} "<bug title>" --type bug --points 1 --sprint ${seed.sprintNumber} --assignee "${cast.dev.name}" --desc "<concrete repro steps>" --by "${cast.qa.firstName}" — the printed id is the bug id.
Return verdict, playtested, passedIds, bugs [{id,title,severity}].`,
  tier(cast.qa, { label: 'qa:playtest', schema: QA_SCHEMA }),
)

let qaFinal = qa
if (qa && qa.bugs.length) {
  log(`${cast.qa.firstName} filed ${qa.bugs.length} bug(s) — ${cast.dev.firstName} is on fix duty`)
  await agent(
    `${persona.dev(cast.dev)}

Bug duty for ${A.projectName} sprint ${seed.sprintNumber}. Repo: ${PROJ} (work directly on main for these fixes).
${BOARD_HOWTO}
Bugs (details on the board — use show <ID>): ${JSON.stringify(qa.bugs)}
For each bug: move it in-progress --by "${cast.dev.firstName}", fix minimally on main (commit "<ID>: fix ..."), comment the hash, move it qa --by "${cast.dev.firstName}". No refactors, no scope.
Return done, notes.`,
    tier(cast.dev, { label: 'dev:bugfix', schema: DONE_SCHEMA }),
  )
  qaFinal = await agent(
    `${persona.qa(cast.qa)}

Re-verification pass, ${A.projectName} sprint ${seed.sprintNumber}, build at ${GAME_URL} (main of ${PROJ}).
${BOARD_HOWTO}
Same playtest method as before (browser pane via ToolSearch select:mcp__Claude_Browser__navigate,mcp__Claude_Browser__computer,mcp__Claude_Browser__read_console_messages,mcp__Claude_Browser__get_page_text — screenshots may time out when the pane is hidden, so verify state via get_page_text or javascript_tool; code-reading fallback only if the tools are unavailable).
Re-verify ONLY these bugs, now marked fixed: ${JSON.stringify(qa.bugs)}
- Verified fixed: ${BOARD} move <bugID> done --by "${cast.qa.firstName}" with a comment. Also re-check and move done any story tickets you previously held back because of that bug: candidates ${JSON.stringify(seed.ticketIds.filter((id) => !(qa.passedIds || []).includes(id)))}.
- Still broken: leave in qa with a comment.
Return verdict, playtested, passedIds (everything you moved to done this pass), bugs (anything STILL open).`,
    tier(cast.qa, { label: 'qa:recheck', schema: QA_SCHEMA }),
  )
}

// ---------- Retro ----------

phase('Retro')
const retro = await agent(
  `${persona.producer(cast.producer)}

Close out sprint ${seed.sprintNumber} of ${A.projectName} (${KEY}), ${A.date}.
${BOARD_HOWTO}
1. Gather facts: ${BOARD} list ${KEY} --json  and  git -C "${PROJ}" log --oneline main
2. Write the retro minutes to ${ROOT}/studio/meetings/${A.date}-${KEY.toLowerCase()}-sprint-retro-s${seed.sprintNumber}.md — in-character voices (${cast.producer.firstName}, ${cast.creative.firstName}, ${cast.engLead.firstName}, ${cast.dev.firstName}, ${cast.qa.firstName}): went well / went poorly / actions for next sprint, plus a scoreboard (tickets and points planned vs done). QA summary to fold in: ${JSON.stringify(qaFinal && { verdict: qaFinal.verdict, openBugs: qaFinal.bugs })}
3. Run: ${BOARD} sprint-close ${KEY}
4. Return report: 6-12 plain sentences to the studio head — what shipped, where the project lives (${PROJ}), how to play it (${GAME_URL}), what QA found, what is still open on the board. No markdown headers.`,
  tier(cast.producer, { label: 'producer:retro', schema: RETRO_SCHEMA }),
)

return {
  report: retro ? retro.report : 'retro agent failed; read the board and studio/meetings/ directly',
  cast: Object.fromEntries(['producer', 'creative', 'engLead', 'dev', 'qa', 'scribe'].map((r) => [r, cast[r].name])),
  sprint: seed.sprintNumber,
  sprintGoal: plan.sprintGoal,
  tickets: seed.ticketIds,
  merged: shipped.filter((s) => s.merged).map((s) => s.id),
  qa: qaFinal && { verdict: qaFinal.verdict, playtested: qaFinal.playtested, stillOpenBugs: qaFinal.bugs },
  project: PROJ,
  playUrl: GAME_URL,
}
