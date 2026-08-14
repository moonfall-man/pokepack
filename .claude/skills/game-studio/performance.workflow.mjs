export const meta = {
  name: 'game-studio-performance',
  description: 'Moonfall Interactive end-of-sprint performance cycle: books settle (payroll burns, shipped points earn), peers submit opinions, the studio manager scores everyone on evidence and decides raises, warnings, hires and fires',
  phases: [
    { title: 'Bookkeeping', detail: 'clerk settles payroll + revenue; evidence digest compiled from board history, commits and QA trail' },
    { title: 'Peer review', detail: 'every active employee submits candid opinions of colleagues, grounded in the sprint evidence' },
    { title: 'Decisions', detail: 'Rosa scores work ethic / accuracy / output / collaboration, sets raises within budget, fires and hires with cause' },
  ],
}

// args: { date, repoRoot, projectKey, projectSlug, sprintNumber, sprintReport? }
// repoRoot uses forward slashes; date is ISO (scripts cannot call Date).
const A = typeof args === 'string' ? JSON.parse(args) : args
if (!A || !A.repoRoot || !A.projectKey || !A.date) {
  throw new Error('args must include date, repoRoot, projectKey, projectSlug, sprintNumber')
}
const KEY = A.projectKey.toUpperCase()
const N = A.sprintNumber || 1
const REF = `${KEY}#${N}`
const ROOT = A.repoRoot
const PROJ = `${ROOT}/studio/projects/${A.projectSlug}`
const BOARD = `node "${ROOT}/.claude/skills/game-studio/board.mjs"`
const ROSTER = `node "${ROOT}/.claude/skills/game-studio/roster.mjs"`
const ECON = `node "${ROOT}/.claude/skills/game-studio/economy.mjs"`

const STAKES = `Moonfall Interactive runs on a real budget inside the fiction: payroll burns it every sprint, shipped story points earn it back. Performance reviews are evidence-based — the board trail, commits, and QA escapes are the record — and raises, warnings, and terminations are real within the studio. Everyone knows this.`

const ROSTER_HOWTO = `Roster CLI (run with the Bash tool; escape double quotes in arguments):
  ${ROSTER} list --json
  ${ROSTER} show <id>
  ${ROSTER} opinion <id> "<text>" --by "<YourFirstName>" --sprint "${REF}"
  ${ROSTER} review <id> --scores "workEthic=4,accuracy=5,output=4,collaboration=3" --decision raise|hold|warning|fired [--raise PCT] [--notes "..."] --sprint "${REF}" --by "Rosa"
  ${ROSTER} hire "<Full Name>" --role dev|qa|scribe|producer|creative|eng-lead [--model sonnet] [--salary N] [--notes "persona notes"] --by "Rosa"
  ${ROSTER} set-notes <id> "<note carried into their future sprint prompts>"`

// One retry on empty results (transient API failures like 529 Overloaded).
async function ragent(prompt, opts) {
  const first = await agent(prompt, opts)
  if (first) return first
  log(`${(opts && opts.label) || 'agent'} returned nothing (likely transient API failure) — retrying once`)
  return agent(prompt, opts)
}

// ---------- Bookkeeping ----------

phase('Bookkeeping')
log(`Settling the books for sprint ${REF}`)

const books = await ragent(
  `You are Sam Okafor, studio coordinator at Moonfall Interactive — fast, literal, precise. Execute exactly these steps in order with the Bash tool and report only the requested fields.
1. ${ROSTER} init        (idempotent — ensures the founding team exists)
2. ${ECON} init          (idempotent — seed funding)
3. ${ECON} payroll --note "sprint ${REF}"
4. Compute shipped points with exactly this command:
   node -e "const b=JSON.parse(require('fs').readFileSync('${ROOT}/studio/board.json','utf8'));console.log(b.tickets.filter(t=>t.project==='${KEY}'&&t.sprint===${N}&&t.status==='done').reduce((n,t)=>n+(t.points||0),0))"
5. ${ECON} revenue <that number> --note "sprint ${REF} shipped points"
6. ${ECON} show   — read the final balance.
Return donePoints and balance (balance as a plain number, negative if in the red).`,
  { label: 'clerk:books', model: 'haiku', schema: { type: 'object', required: ['donePoints', 'balance'], properties: { donePoints: { type: 'number' }, balance: { type: 'number' } } } },
)
if (!books) throw new Error('bookkeeping failed')
log(`Books settled: ${books.donePoints} points shipped, balance $${books.balance}`)

const evidence = await ragent(
  `You are compiling the evidence file for Moonfall Interactive's sprint ${REF} performance cycle. Facts only, no judgments — the studio manager judges.
Sources (Bash + Read):
- ${ROSTER} list --json   (who is active, their roles)
- ${BOARD} list ${KEY} --json   (tickets: history[] entries and comments[] carry "by" names and timestamps; acceptance criteria; bug tickets show QA escapes)
- git -C "${PROJ}" log --oneline main   (ticket commits = the dev's work; "Merge ..."/"review fixups" commits = the eng lead's; attribute by convention)
- ls ${ROOT}/studio/meetings ${ROOT}/studio/briefs   (which documents got written — that is producer/scribe output)
Compile evidenceMd: one section per ACTIVE employee (skip the manager) — what they did this sprint with citations (ticket IDs, commit hashes, timestamps), where their claims did or did not match reality (e.g. dev said "tested" on a ticket that QA later bugged = accuracy hit; QA passing a criterion that was actually broken = accuracy hit), and anything skipped (missing board moves, missing comments, missing minutes).
Return employees (id, name, firstName, role — active only, manager excluded) and evidenceMd.`,
  { label: 'clerk:evidence', model: 'sonnet', schema: {
    type: 'object', required: ['employees', 'evidenceMd'],
    properties: {
      evidenceMd: { type: 'string' },
      employees: { type: 'array', items: { type: 'object', required: ['id', 'name', 'firstName', 'role'], properties: { id: { type: 'string' }, name: { type: 'string' }, firstName: { type: 'string' }, role: { type: 'string' } } } },
    },
  } },
)
if (!evidence || !evidence.employees.length) throw new Error('evidence digest failed')

// ---------- Peer review ----------

phase('Peer review')
log(`${evidence.employees.length} employees submitting peer opinions`)

const ROLE_LINE = {
  producer: 'senior producer — you ran the meetings and own the board',
  creative: 'creative director — you fought for feel in planning',
  'eng-lead': 'engineering lead — you reviewed and merged every branch',
  dev: 'gameplay engineer — you shipped the tickets',
  qa: 'QA lead — you playtested the build and filed the bugs',
  scribe: 'studio coordinator — you wrote the minutes and seeded the board',
}
const MODEL_FOR = { dev: 'sonnet', qa: 'sonnet', scribe: 'haiku' }

await parallel(evidence.employees.map((e) => () => {
  const colleagues = evidence.employees.filter((c) => c.id !== e.id)
  const opts = { label: `peer:${e.id}`, effort: 'low', schema: { type: 'object', required: ['submitted'], properties: { submitted: { type: 'number' } } } }
  if (MODEL_FOR[e.role]) opts.model = MODEL_FOR[e.role]
  return ragent(
    `You are ${e.name}, ${ROLE_LINE[e.role] || e.role} at Moonfall Interactive. ${STAKES}
It is peer review time for sprint ${REF}. The evidence file (shared with everyone):
---
${evidence.evidenceMd}
---
For EACH colleague below, submit one honest, professional, specific opinion (1-3 sentences, grounded in what actually happened this sprint — cite a ticket or moment; praise and criticism both allowed and both remembered):
${colleagues.map((c) => `- ${c.name} (${c.role}) -> ${ROSTER.replace(/\\/g, '/')} opinion ${c.id} "<your opinion>" --by "${e.firstName}" --sprint "${REF}"`).join('\n')}
Run each command with Bash (escape inner double quotes). Return submitted: <count>.`,
    opts,
  )
}))

// ---------- Decisions ----------

phase('Decisions')
log('Rosa Delgado is making the calls')

const decisions = await ragent(
  `You are Rosa Delgado, studio manager (HR & operations) at Moonfall Interactive. You are fair, unsentimental, and allergic to vibes-based management; your paper trail is immaculate. ${STAKES}
Performance cycle for sprint ${REF}. Studio balance: $${books.balance}. Shipped: ${books.donePoints} points. ${A.sprintReport ? `Producer's sprint report: ${A.sprintReport}` : ''}
The evidence file:
---
${evidence.evidenceMd}
---
${ROSTER_HOWTO}
Procedure:
1. ${ROSTER} list --json — read everyone's fresh peer opinions and current salaries.
2. Score every active employee EXCEPT yourself, 1-5 per axis (workEthic, accuracy, output, collaboration), each score backed by cited evidence (ticket IDs, commits, opinions you verified against the trail). No evidence, no score below 3.
3. Decide per person and execute with the roster CLI review command: raise (2-8%, total raises at most 5% of active payroll — compute it; be stingier if the balance is thin), hold, warning (name the behavior and what changes), or fired (at most one per cycle, only with documented cause). If you fire someone, immediately hire a named replacement at a sensible salary with --notes describing their persona/working style.
4. Where behavior must change, also ${ROSTER} set-notes <id> "<one-line note>" — these notes are injected into that person's future sprint prompts, so write them as direct coaching.
5. Write the full review document to ${ROOT}/studio/hr/${A.date}-performance-${KEY.toLowerCase()}-s${N}.md — scores table with evidence citations, peer opinion highlights, decisions with budget math, and the studio's financial position.
6. Refresh the agent dossiers: ${ROSTER} export — one extractable file per employee in studio/dossiers/, kept current for the studio head.
Return decisions [{id, decision, raisePct, avgScore, headline}], fired [names], hired [names], summary (4-8 plain sentences to the studio head).`,
  { label: 'manager:decisions', schema: {
    type: 'object', required: ['decisions', 'fired', 'hired', 'summary'],
    properties: {
      summary: { type: 'string' },
      fired: { type: 'array', items: { type: 'string' } },
      hired: { type: 'array', items: { type: 'string' } },
      decisions: { type: 'array', items: { type: 'object', required: ['id', 'decision'], properties: { id: { type: 'string' }, decision: { type: 'string' }, raisePct: { type: 'number' }, avgScore: { type: 'number' }, headline: { type: 'string' } } } },
    },
  } },
)
if (!decisions) throw new Error('the manager did not return decisions')

return {
  summary: decisions.summary,
  decisions: decisions.decisions,
  fired: decisions.fired,
  hired: decisions.hired,
  donePoints: books.donePoints,
  balance: books.balance,
  reviewDoc: `${ROOT}/studio/hr/${A.date}-performance-${KEY.toLowerCase()}-s${N}.md`,
}
