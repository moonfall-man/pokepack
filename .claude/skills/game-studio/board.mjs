#!/usr/bin/env node
// Moonfall Interactive studio board + dashboard — local Jira-style board, zero deps.
// State: <repo>/studio/board.json (+ roster.json, economy.json rendered read-only).
// Override the studio dir with STUDIO_DIR. Used by the game-studio skill. Node >= 18.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SKILL_DIR, '..', '..', '..');
const STUDIO = path.resolve(process.env.STUDIO_DIR || path.join(REPO_ROOT, 'studio'));
const BOARD_FILE = path.join(STUDIO, 'board.json');
const ROSTER_FILE = path.join(STUDIO, 'roster.json');
const ECON_FILE = path.join(STUDIO, 'economy.json');
const LOCK_DIR = path.join(STUDIO, '.board.lock');

const STATUSES = ['backlog', 'todo', 'in-progress', 'in-review', 'qa', 'done'];
const TYPES = ['story', 'bug', 'task'];
const STATIC_ROOTS = ['projects', 'meetings', 'briefs', 'hr'];
const DEFAULT_PORT = 4545;

// ---------- state ----------

function emptyBoard() {
  return { studio: 'Moonfall Interactive', projects: {}, tickets: [], sprints: [] };
}

function load() {
  if (!fs.existsSync(BOARD_FILE)) return emptyBoard();
  return JSON.parse(fs.readFileSync(BOARD_FILE, 'utf8'));
}

function loadOther(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// OneDrive (and antivirus) can hold transient locks on the file; retry writes.
function save(board) {
  fs.mkdirSync(STUDIO, { recursive: true });
  const tmp = BOARD_FILE + '.tmp';
  for (let i = 0; ; i++) {
    try {
      fs.writeFileSync(tmp, JSON.stringify(board, null, 2));
      fs.renameSync(tmp, BOARD_FILE);
      return;
    } catch (e) {
      if (i >= 5) throw e;
      sleepMs(80 * (i + 1));
    }
  }
}

// Several agents mutate the board concurrently; a lock dir serializes read-modify-write.
function withLock(fn) {
  fs.mkdirSync(STUDIO, { recursive: true });
  for (let i = 0; ; i++) {
    try { fs.mkdirSync(LOCK_DIR); break; }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      if (i >= 200) throw new Error(`board is locked (${LOCK_DIR}); delete it if stale`);
      sleepMs(50);
    }
  }
  try {
    const board = load();
    const out = fn(board);
    save(board);
    return out;
  } finally {
    try { fs.rmdirSync(LOCK_DIR); } catch { /* already gone */ }
  }
}

// ---------- helpers ----------

function die(msg) { console.error(`board: ${msg}`); process.exit(1); }
function nowIso() { return new Date().toISOString(); }

const BOOL_FLAGS = new Set(['json']);
function parseArgs(argv) {
  const pos = []; const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (BOOL_FLAGS.has(k)) flags[k] = true;
      else flags[k] = argv[++i];
    } else pos.push(a);
  }
  return { pos, flags };
}

function projectOrDie(board, key) {
  const p = board.projects[key.toUpperCase()];
  if (!p) die(`no project ${key.toUpperCase()} — run: board.mjs init ${key.toUpperCase()} "Name"`);
  return p;
}

function ticketOrDie(board, id) {
  const t = board.tickets.find((t) => t.id.toUpperCase() === String(id).toUpperCase());
  if (!t) die(`no ticket ${id}`);
  return t;
}

function nextId(board, key) {
  const nums = board.tickets
    .filter((t) => t.project === key)
    .map((t) => Number(t.id.split('-')[1]) || 0);
  return `${key}-${Math.max(0, ...nums) + 1}`;
}

// ---------- commands ----------

function cmdInit(pos) {
  const key = (pos[0] || '').toUpperCase();
  const name = pos[1];
  if (!key || !name) die('usage: init <KEY> "<Project Name>"');
  withLock((b) => {
    if (!b.projects[key]) b.projects[key] = { key, name, created: nowIso() };
  });
  console.log(`project ${key} (${name}) ready; board file: ${BOARD_FILE}`);
}

function cmdAdd(pos, flags) {
  const key = (pos[0] || '').toUpperCase();
  const title = pos[1];
  if (!key || !title) die('usage: add <KEY> "<title>" [--type story|bug|task] [--points N] [--sprint N] [--assignee X] [--desc "..."] [--acceptance "a;b;c"] [--status s]');
  const type = flags.type || 'story';
  if (!TYPES.includes(type)) die(`type must be one of ${TYPES.join('|')}`);
  const sprint = flags.sprint ? Number(flags.sprint) : null;
  const status = flags.status || (sprint ? 'todo' : 'backlog');
  if (!STATUSES.includes(status)) die(`status must be one of ${STATUSES.join('|')}`);
  const id = withLock((b) => {
    projectOrDie(b, key);
    const id = nextId(b, key);
    b.tickets.push({
      id, project: key, title,
      desc: flags.desc || '',
      type, status,
      points: flags.points ? Number(flags.points) : 0,
      assignee: flags.assignee || '',
      sprint,
      acceptance: flags.acceptance ? flags.acceptance.split(';').map((s) => s.trim()).filter(Boolean) : [],
      comments: [],
      history: [{ at: nowIso(), from: null, to: status, by: flags.by || 'board' }],
      created: nowIso(), updated: nowIso(),
    });
    return id;
  });
  console.log(`created ${id}`);
}

function cmdMove(pos, flags) {
  const [id, status] = pos;
  if (!id || !STATUSES.includes(status)) die(`usage: move <ID> <${STATUSES.join('|')}> [--by X]`);
  withLock((b) => {
    const t = ticketOrDie(b, id);
    t.history.push({ at: nowIso(), from: t.status, to: status, by: flags.by || 'board' });
    t.status = status;
    t.updated = nowIso();
  });
  console.log(`${id.toUpperCase()} -> ${status}`);
}

function cmdComment(pos, flags) {
  const [id, text] = pos;
  if (!id || !text) die('usage: comment <ID> "<text>" [--by X]');
  withLock((b) => {
    const t = ticketOrDie(b, id);
    t.comments.push({ at: nowIso(), by: flags.by || 'board', text });
    t.updated = nowIso();
  });
  console.log(`commented on ${id.toUpperCase()}`);
}

function cmdPoint(pos) {
  const [id, points] = pos;
  if (!id || !points) die('usage: point <ID> <points>');
  withLock((b) => { const t = ticketOrDie(b, id); t.points = Number(points); t.updated = nowIso(); });
  console.log(`${id.toUpperCase()} = ${points}pt`);
}

function cmdAssign(pos) {
  const [id, name] = pos;
  if (!id || !name) die('usage: assign <ID> <name>');
  withLock((b) => { const t = ticketOrDie(b, id); t.assignee = name; t.updated = nowIso(); });
  console.log(`${id.toUpperCase()} -> ${name}`);
}

function cmdList(pos, flags) {
  const b = load();
  const key = pos[0] ? pos[0].toUpperCase() : null;
  const tickets = b.tickets.filter((t) => !key || t.project === key);
  if (flags.json) { console.log(JSON.stringify(tickets, null, 2)); return; }
  for (const s of b.sprints.filter((s) => !key || s.project === key)) {
    console.log(`sprint ${s.project}#${s.number} ${s.closed ? '(closed)' : '(open)'}: ${s.goal}`);
  }
  for (const status of STATUSES) {
    const rows = tickets.filter((t) => t.status === status);
    if (!rows.length) continue;
    console.log(`\n[${status}] (${rows.length})`);
    for (const t of rows) {
      console.log(`  ${t.id}  ${t.points}pt  ${t.type}  ${t.assignee || '-'}  ${t.title}`);
    }
  }
  if (!tickets.length) console.log('no tickets');
}

function cmdShow(pos) {
  const b = load();
  console.log(JSON.stringify(ticketOrDie(b, pos[0]), null, 2));
}

function cmdResprint(pos, flags) {
  const [id, sprint] = pos;
  if (!id || !sprint) die('usage: resprint <ID> <sprintNumber> [--by X]');
  withLock((b) => {
    const t = ticketOrDie(b, id);
    t.sprint = Number(sprint);
    if (t.status === 'backlog') t.status = 'todo';
    t.comments.push({ at: nowIso(), by: flags.by || 'board', text: `carried into sprint ${Number(sprint)}` });
    t.updated = nowIso();
  });
  console.log(`${id.toUpperCase()} -> sprint ${sprint}`);
}

function cmdSprintStart(pos) {
  const key = (pos[0] || '').toUpperCase();
  const goal = pos[1];
  if (!key || !goal) die('usage: sprint-start <KEY> "<goal>"');
  const number = withLock((b) => {
    projectOrDie(b, key);
    const number = b.sprints.filter((s) => s.project === key).length + 1;
    b.sprints.push({ project: key, number, goal, started: nowIso(), closed: null });
    return number;
  });
  console.log(`sprint ${number} started for ${key}: ${goal}`);
}

function cmdSprintClose(pos) {
  const key = (pos[0] || '').toUpperCase();
  if (!key) die('usage: sprint-close <KEY>');
  const summary = withLock((b) => {
    projectOrDie(b, key);
    const open = b.sprints.filter((s) => s.project === key && !s.closed).pop();
    if (!open) die(`no open sprint for ${key}`);
    open.closed = nowIso();
    const inSprint = b.tickets.filter((t) => t.project === key && t.sprint === open.number);
    const done = inSprint.filter((t) => t.status === 'done');
    const pts = (list) => list.reduce((n, t) => n + (t.points || 0), 0);
    return `sprint ${open.number} closed: ${done.length}/${inSprint.length} tickets done, ${pts(done)}/${pts(inSprint)} points`;
  });
  console.log(summary);
}

function allData() {
  return {
    board: load(),
    roster: loadOther(ROSTER_FILE, { employees: [], log: [] }),
    economy: loadOther(ECON_FILE, { balance: 0, log: [] }),
  };
}

function cmdSnapshot() {
  const inline = JSON.stringify(allData()).replace(/</g, '\\u003c');
  const file = path.join(STUDIO, 'board-snapshot.html');
  fs.mkdirSync(STUDIO, { recursive: true });
  fs.writeFileSync(file, uiHtml(inline));
  console.log(file);
}

// ---------- server ----------

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
};

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function cmdServe(flags) {
  const port = Number(flags.port || DEFAULT_PORT);
  const server = http.createServer((req, res) => {
    try {
      const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p === '/') return send(res, 200, 'text/html', uiHtml(null));
      if (p === '/board.json') return send(res, 200, 'application/json', JSON.stringify(load()));
      if (p === '/roster.json') return send(res, 200, 'application/json', JSON.stringify(loadOther(ROSTER_FILE, { employees: [], log: [] })));
      if (p === '/economy.json') return send(res, 200, 'application/json', JSON.stringify(loadOther(ECON_FILE, { balance: 0, log: [] })));
      const root = STATIC_ROOTS.find((r) => p === `/${r}` || p.startsWith(`/${r}/`));
      if (root) {
        let full = path.normalize(path.join(STUDIO, p));
        if (!full.startsWith(STUDIO + path.sep)) return send(res, 403, 'text/plain', 'forbidden');
        if (fs.existsSync(full) && fs.statSync(full).isDirectory()) full = path.join(full, 'index.html');
        if (!fs.existsSync(full)) return send(res, 404, 'text/plain', `not found: ${p}`);
        return send(res, 200, MIME[path.extname(full).toLowerCase()] || 'application/octet-stream', fs.readFileSync(full));
      }
      send(res, 404, 'text/plain', 'not found');
    } catch (e) {
      send(res, 500, 'text/plain', String(e));
    }
  });
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log(`port ${port} busy — board is probably already at http://localhost:${port}`);
      process.exit(0);
    }
    throw e;
  });
  server.listen(port, () => {
    console.log(`Moonfall Interactive dashboard: http://localhost:${port}`);
    console.log(`serving ${STUDIO} (projects/, meetings/, briefs/, hr/ are static)`);
  });
}

// ---------- UI ----------

function uiHtml(inlineJson) {
  const dataScript = inlineJson
    ? '<script>window.INLINE_DATA = ' + inlineJson + ';</scr' + 'ipt>'
    : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Moonfall Interactive — Studio Dashboard</title>
<style>
  :root { --bg:#0b0e14; --col:#141a24; --card:#1d2534; --line:#2a3446; --text:#e6edf3; --dim:#8b98ab;
          --story:#3fb950; --bug:#f85149; --task:#58a6ff; --accent:#c9a4ff; --gold:#e3b341; --red:#f85149; --live:#3fb950; }
  * { box-sizing:border-box; margin:0; }
  body { background:var(--bg); color:var(--text); font:14px/1.45 "Segoe UI", system-ui, sans-serif; padding:18px; }
  header { display:flex; align-items:baseline; gap:14px; flex-wrap:wrap; }
  h1 { font-size:20px; letter-spacing:.4px; }
  h1 .moon { color:var(--accent); }
  h1 small { color:var(--dim); font-size:13px; font-weight:normal; }
  .live { display:none; align-items:center; gap:6px; color:var(--live); font-size:11px; letter-spacing:1.4px; font-weight:600; }
  .live i { width:8px; height:8px; border-radius:50%; background:var(--live); animation:pulse 1.6s ease-in-out infinite; }
  #sprints { color:var(--dim); font-size:13px; }
  #sprints b { color:var(--text); }
  .secttl { margin:16px 0 8px; font-size:11px; text-transform:uppercase; letter-spacing:1.4px; color:var(--dim); }
  #vitals { display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:10px; }
  .vital { background:var(--col); border:1px solid var(--line); border-radius:10px; padding:10px 12px; }
  .vital .v { font-size:20px; font-weight:600; }
  .vital .v.gold { color:var(--gold); } .vital .v.red { color:var(--red); }
  .vital .k { color:var(--dim); font-size:11px; text-transform:uppercase; letter-spacing:1px; }
  .spark { display:flex; align-items:flex-end; gap:2px; height:26px; margin-top:6px; }
  .spark i { flex:1; background:var(--accent); opacity:.55; border-radius:1px 1px 0 0; min-width:3px; }
  #team { display:flex; gap:10px; flex-wrap:wrap; }
  .emp { background:var(--col); border:1px solid var(--line); border-radius:10px; padding:9px 12px; min-width:170px;
         display:flex; gap:10px; align-items:center; transition:transform .15s ease, box-shadow .15s ease; }
  .emp:hover { transform:translateY(-1px); box-shadow:0 4px 14px rgba(0,0,0,.35); }
  .emp.fired { opacity:.45; filter:grayscale(1); }
  .emp .n { font-weight:600; font-size:13px; }
  .emp .r { color:var(--dim); font-size:11px; }
  .emp .s { font-size:12px; margin-top:2px; }
  .emp .stars { color:var(--gold); font-size:11px; }
  .emp .tag { font-size:10px; border-radius:4px; padding:0 5px; margin-left:6px; vertical-align:1px; }
  .emp .tag.fired { background:#3d1d20; color:var(--red); }
  .av { border-radius:6px; flex:none; image-rendering:pixelated; background:#10151f; }
  #board { display:grid; grid-template-columns:repeat(6, minmax(170px, 1fr)); gap:10px; }
  .col { background:var(--col); border:1px solid var(--line); border-radius:10px; padding:8px; min-height:130px; }
  .col h2 { font-size:11px; text-transform:uppercase; letter-spacing:1px; color:var(--dim);
            display:flex; justify-content:space-between; padding:2px 4px 8px; }
  .card { background:var(--card); border:1px solid var(--line); border-left:3px solid var(--task);
          border-radius:8px; padding:8px 9px; margin-bottom:8px; transition:transform .15s ease, box-shadow .15s ease; }
  .card:hover { transform:translateY(-1px); box-shadow:0 4px 14px rgba(0,0,0,.35); }
  .card.story { border-left-color:var(--story); }
  .card.bug { border-left-color:var(--bug); }
  .card .id { font:11px ui-monospace, monospace; color:var(--dim); display:flex; justify-content:space-between; align-items:center; }
  .card .t { margin:3px 0 6px; font-size:13px; }
  .chips { display:flex; gap:6px; flex-wrap:wrap; font-size:11px; color:var(--dim); align-items:center; }
  .chips .who { display:inline-flex; gap:4px; align-items:center; }
  .pt { background:#2a3446; border-radius:9px; padding:0 7px; color:var(--text); }
  .ring { width:10px; height:10px; border:2px solid #2a3446; border-top-color:var(--accent); border-radius:50%;
          animation:spin .9s linear infinite; display:inline-block; flex:none; }
  .dot { width:8px; height:8px; border-radius:50%; background:var(--gold); animation:pulse 1.6s ease-in-out infinite; display:inline-block; flex:none; }
  .done-col .card { opacity:.72; }
  #feed { color:var(--dim); font-size:12px; }
  #feed div { padding:2px 0; border-bottom:1px dotted #1c2330; }
  #feed b { color:var(--text); font-weight:600; }
  footer { margin-top:14px; color:var(--dim); font-size:12px; }
  .tick { display:inline-block; width:7px; height:7px; border-radius:50%; background:var(--accent); opacity:.2;
          transition:opacity .25s; vertical-align:-1px; margin-right:7px; }
  .tick.on { opacity:1; }
  .skel { background:linear-gradient(90deg,#141a24 25%,#1d2534 50%,#141a24 75%); background-size:200px 100%;
          animation:shimmer 1.2s infinite linear; border-radius:10px; min-height:64px; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
  @keyframes spin { to { transform:rotate(360deg) } }
  @keyframes shimmer { 0%{background-position:-200px 0} 100%{background-position:200px 0} }
</style>${dataScript}</head>
<body>
<header>
  <h1><span class="moon">&#9790;</span> MOONFALL INTERACTIVE <small>studio dashboard</small></h1>
  <span class="live" id="live"><i></i>LIVE</span>
  <div id="sprints"></div>
</header>
<div class="secttl">Vitals</div>
<div id="vitals"><div class="skel"></div><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>
<div class="secttl">Team</div>
<div id="team"><div class="skel" style="width:100%"></div></div>
<div class="secttl">Board</div>
<div id="board"><div class="skel"></div><div class="skel"></div><div class="skel"></div><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>
<div class="secttl">Activity</div>
<div id="feed"><div class="skel" style="min-height:40px"></div></div>
<footer id="foot"></footer>
<script>
var COLS = [["backlog","Backlog"],["todo","To Do"],["in-progress","In Progress"],["in-review","In Review"],["qa","QA"],["done","Done"]];
var ROLE_EMOJI = {producer:"\\uD83C\\uDFAC", creative:"\\uD83C\\uDFA8", "eng-lead":"\\uD83D\\uDEE0\\uFE0F", dev:"\\uD83D\\uDCBB", qa:"\\uD83D\\uDD0E", scribe:"\\uD83D\\uDCCB", manager:"\\uD83D\\uDCCA"};
var KIND_EMOJI = {payroll:"\\uD83D\\uDCB0", revenue:"\\uD83D\\uDCC8", funding:"\\uD83C\\uDFE6", adjustment:"\\uD83E\\uDDFE", hired:"\\uD83C\\uDF89", fired:"\\uD83D\\uDD25", raise:"\\uD83D\\uDCB5", founded:"\\uD83C\\uDFDB\\uFE0F"};
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c]; }); }
function money(n){ var neg=n<0; n=Math.abs(Math.round(n)); var s=n>=1000?Math.round(n/1000)+"k":String(n); return (neg?"-$":"$")+s; }
function djb2(s){ var h=5381; for(var i=0;i<s.length;i++){ h=((h<<5)+h+s.charCodeAt(i))>>>0; } return h; }
function avatar(name, size){
  var h = djb2(String(name||"?"));
  var hue = h % 360;
  var cells = "";
  for (var r=0; r<5; r++) for (var c=0; c<3; c++) if ((h >> (r*3+c)) & 1) {
    cells += "<rect x='"+c+"' y='"+r+"' width='1' height='1'/>";
    if (c<2) cells += "<rect x='"+(4-c)+"' y='"+r+"' width='1' height='1'/>";
  }
  return "<svg class='av' width='"+size+"' height='"+size+"' viewBox='-0.6 -0.6 6.2 6.2'>"+
    "<rect x='-0.6' y='-0.6' width='6.2' height='6.2' fill='#10151f'/>"+
    "<g fill='hsl("+hue+",62%,60%)'>"+cells+"</g></svg>";
}
function statusIcon(st){
  if (st==="in-progress") return "<span class='ring' title='in progress'></span>";
  if (st==="in-review"||st==="qa") return "<span class='dot' title='"+st+"'></span>";
  return "";
}
function feedIcon(l){
  if (l.kind) return KIND_EMOJI[l.kind]||"\\uD83E\\uDDFE";
  var a = l.action||"";
  if (a.indexOf("review")===0) return "\\u2B50";
  return KIND_EMOJI[a]||"\\uD83D\\uDCCC";
}
function render(board, roster, econ){
  var head = [];
  var anyOpen = false;
  (board.sprints||[]).forEach(function(s){ if(!s.closed){ anyOpen=true; head.push("<b>"+esc(s.project)+" &middot; Sprint "+s.number+"</b> &mdash; "+esc(s.goal)); } });
  document.getElementById("sprints").innerHTML = head.join(" &nbsp;&middot;&nbsp; ") || "no open sprint";
  document.getElementById("live").style.display = anyOpen ? "inline-flex" : "none";

  // vitals
  var actives = (roster.employees||[]).filter(function(e){ return e.status==="active"; });
  var burn = Math.round(actives.reduce(function(n,e){ return n+e.salary; },0)/26);
  var sprints = board.sprints||[];
  var cur = sprints.filter(function(s){ return !s.closed; })[0] || sprints[sprints.length-1];
  var vel = 0, planned = 0;
  if (cur) (board.tickets||[]).forEach(function(t){
    if (t.project===cur.project && t.sprint===cur.number) { planned += t.points||0; if (t.status==="done") vel += t.points||0; }
  });
  var openBugs = (board.tickets||[]).filter(function(t){ return t.type==="bug" && t.status!=="done"; }).length;
  var hist = (econ.log||[]).slice(-24).map(function(l){ return l.balance; });
  var maxH = Math.max.apply(null, hist.concat([1]));
  var spark = hist.length>1 ? "<div class='spark'>"+hist.map(function(v){ return "<i style='height:"+Math.max(8, Math.round(v/maxH*100))+"%'></i>"; }).join("")+"</div>" : "";
  document.getElementById("vitals").innerHTML =
    "<div class='vital'><div class='v "+(econ.balance<0?"red":"gold")+"'>"+money(econ.balance||0)+"</div><div class='k'>studio balance</div>"+spark+"</div>"+
    "<div class='vital'><div class='v'>"+money(burn)+"</div><div class='k'>payroll / sprint</div></div>"+
    "<div class='vital'><div class='v'>"+actives.length+"</div><div class='k'>headcount</div></div>"+
    "<div class='vital'><div class='v'>"+vel+"/"+planned+"</div><div class='k'>sprint points done</div></div>"+
    "<div class='vital'><div class='v "+(openBugs?"red":"")+"'>"+openBugs+"</div><div class='k'>open bugs</div></div>";

  // team
  var emps = (roster.employees||[]).slice().sort(function(a,z){ return (a.status>z.status?1:a.status<z.status?-1:0) || z.salary-a.salary; });
  document.getElementById("team").innerHTML = emps.map(function(e){
    var last = (e.reviews||[])[ (e.reviews||[]).length-1 ];
    var avg = "";
    if (last) {
      var vals = []; for (var k in last.scores) vals.push(last.scores[k]);
      var m = vals.reduce(function(a,b){return a+b;},0)/vals.length;
      avg = "<span class='stars'>&#9733; "+m.toFixed(1)+"</span> &middot; ";
    }
    return "<div class='emp "+(e.status==="fired"?"fired":"")+"'>"+avatar(e.name, 34)+"<div>"+
      "<div class='n'>"+esc(e.name)+(e.status==="fired"?"<span class='tag fired'>FIRED</span>":"")+"</div>"+
      "<div class='r'>"+(ROLE_EMOJI[e.role]||"")+" "+esc(e.role)+" &middot; "+esc(e.model)+"</div>"+
      "<div class='s'>"+avg+money(e.salary)+"/yr &middot; &#128172;"+((e.opinions||[]).length)+"</div>"+
      "</div></div>";
  }).join("") || "<span style='color:var(--dim)'>no roster yet — node .claude/skills/game-studio/roster.mjs init</span>";

  // kanban
  var byCol = {};
  COLS.forEach(function(c){ byCol[c[0]] = []; });
  (board.tickets||[]).forEach(function(t){ (byCol[t.status]||byCol.backlog).push(t); });
  document.getElementById("board").innerHTML = COLS.map(function(c){
    var list = byCol[c[0]];
    list.sort(function(a,z){ return a.id.localeCompare(z.id, undefined, {numeric:true}); });
    var pts = list.reduce(function(n,t){ return n+(t.points||0); },0);
    return "<div class='col "+(c[0]==="done"?"done-col":"")+"'><h2><span>"+c[1]+"</span><span>"+list.length+(pts?" &middot; "+pts+"pt":"")+"</span></h2>"+
      list.map(function(t){
        return "<div class='card "+esc(t.type)+"'><div class='id'><span>"+esc(t.id)+"</span>"+statusIcon(t.status)+"<span>"+esc(t.type)+"</span></div>"+
          "<div class='t'>"+esc(t.title)+"</div><div class='chips'>"+
          (t.points?"<span class='pt'>"+t.points+"pt</span>":"")+
          (t.assignee?"<span class='who'>"+avatar(t.assignee,14)+esc(t.assignee.split(" ")[0])+"</span>":"")+
          (t.sprint?"<span>S"+t.sprint+"</span>":"")+
          (t.comments&&t.comments.length?"<span>&#128172;"+t.comments.length+"</span>":"")+
          "</div></div>";
      }).join("")+"</div>";
  }).join("");

  // activity feed: roster log + economy log, newest first
  var feed = [];
  (roster.log||[]).forEach(function(l){ feed.push({at:l.at, txt:feedIcon(l)+" <b>"+esc(l.action)+"</b> "+esc(l.detail)+(l.by&&l.by!=="roster"?" <i>("+esc(l.by)+")</i>":"")}); });
  (econ.log||[]).forEach(function(l){ feed.push({at:l.at, txt:feedIcon(l)+" <b>"+esc(l.kind)+"</b> "+money(l.amount)+" &mdash; "+esc(l.note)}); });
  feed.sort(function(a,z){ return a.at<z.at?1:-1; });
  document.getElementById("feed").innerHTML = feed.slice(0,14).map(function(f){
    return "<div>"+esc((f.at||"").slice(0,16).replace("T"," "))+" &middot; "+f.txt+"</div>";
  }).join("") || "<div>quiet so far</div>";

  document.getElementById("foot").innerHTML = "<span class='tick' id='tick'></span>"+
    (board.tickets||[]).length+" tickets"+(window.INLINE_DATA?" (static snapshot)":" (live, refreshes every 2s)");
}
function blip(){
  var t = document.getElementById("tick");
  if (!t) return;
  t.classList.add("on");
  setTimeout(function(){ t.classList.remove("on"); }, 350);
}
function tick(){
  if (window.INLINE_DATA) { render(window.INLINE_DATA.board, window.INLINE_DATA.roster, window.INLINE_DATA.economy); return; }
  Promise.all([
    fetch("/board.json",{cache:"no-store"}).then(function(r){return r.json();}),
    fetch("/roster.json",{cache:"no-store"}).then(function(r){return r.json();}).catch(function(){return {employees:[],log:[]};}),
    fetch("/economy.json",{cache:"no-store"}).then(function(r){return r.json();}).catch(function(){return {balance:0,log:[]};})
  ]).then(function(d){ render(d[0], d[1], d[2]); blip(); }).catch(function(){});
  setTimeout(tick, 2000);
}
tick();
</script>
</body></html>`;
}

// ---------- main ----------

const HELP = `Moonfall Interactive studio board (state: ${BOARD_FILE})
usage: node board.mjs <command>
  init <KEY> "<Project Name>"
  add <KEY> "<title>" [--type story|bug|task] [--points N] [--sprint N]
      [--assignee X] [--desc "..."] [--acceptance "a;b;c"] [--status s] [--by X]
  move <ID> <${STATUSES.join('|')}> [--by X]
  comment <ID> "<text>" [--by X]
  point <ID> <points>
  assign <ID> <name>
  list [KEY] [--json]
  show <ID>
  resprint <ID> <sprintNumber> [--by X]   carry an existing ticket into a sprint
  sprint-start <KEY> "<goal>"
  sprint-close <KEY>
  serve [--port ${DEFAULT_PORT}]
  snapshot`;

const [cmd, ...rest] = process.argv.slice(2);
const { pos, flags } = parseArgs(rest);
switch (cmd) {
  case 'init': cmdInit(pos); break;
  case 'add': cmdAdd(pos, flags); break;
  case 'move': cmdMove(pos, flags); break;
  case 'comment': cmdComment(pos, flags); break;
  case 'point': cmdPoint(pos); break;
  case 'assign': cmdAssign(pos); break;
  case 'list': cmdList(pos, flags); break;
  case 'show': cmdShow(pos); break;
  case 'resprint': cmdResprint(pos, flags); break;
  case 'sprint-start': cmdSprintStart(pos); break;
  case 'sprint-close': cmdSprintClose(pos); break;
  case 'serve': cmdServe(flags); break;
  case 'snapshot': cmdSnapshot(); break;
  default: console.log(HELP); process.exit(cmd ? 1 : 0);
}
