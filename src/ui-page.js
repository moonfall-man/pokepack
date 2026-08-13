// The hub page.  One file, no build step, no framework -- it is a local tool
// and the whole thing has to stay readable.
//
// The layout carries the idea: your packs live in a permanent rail down the
// left, because "which pack am I working on" is the question every other screen
// is an answer to.  Tabs made it look like one of three equal things.
//
// Mods are rows, not cards.  There are ninety-odd of them and you scan for a
// name, a version and whether it is on -- four columns of text beats four
// hundred pixels of card every time.  Community is cards, because browsing
// somebody else's work is the one place you are looking rather than scanning.
//
// Colour is spent deliberately: red is the play action and nothing else, gold
// means "this is the one running", and the three status colours only ever mean
// working / needs attention / broken.  Everything else is ink on paper.

export function page(token) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>pokepack</title>
<style>
:root {
  --bg:#0d0e12; --rail:#111318; --panel:#151821; --raise:#1b1f2a;
  --line:#232733; --line-soft:#1c2029;
  --ink:#e9ecf3; --ink-2:#aeb4c4; --dim:#767d90;
  --red:#e5484d; --red-ink:#fff; --gold:#f0b429;
  --ok:#46a758; --warn:#d29922; --bad:#e5484d;
  --focus:#4c8dff;
  --r:8px; --r-lg:12px;
}
@media (prefers-color-scheme: light) {
  :root {
    --bg:#f6f7f9; --rail:#eef0f4; --panel:#fff; --raise:#f4f5f8;
    --line:#dfe2e9; --line-soft:#e9ecf1;
    --ink:#14161c; --ink-2:#454b59; --dim:#767d90;
    --red:#d3282e; --gold:#b7791f;
    --ok:#2c7a3f; --warn:#9a6700; --bad:#cf222e;
  }
}
* { box-sizing:border-box; min-width:0; }
[hidden] { display:none !important; }
html, body { height:100%; }
body {
  margin:0; background:var(--bg); color:var(--ink);
  font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  -webkit-font-smoothing:antialiased;
  display:grid; grid-template-rows:auto auto 1fr; height:100vh; overflow:hidden;
}
:focus-visible { outline:2px solid var(--focus); outline-offset:2px; border-radius:4px; }
.num { font-variant-numeric:tabular-nums; }

/* ---- top bar */
.top {
  display:flex; align-items:center; gap:16px; padding:0 16px; height:52px;
  background:var(--rail); border-bottom:1px solid var(--line);
}
.mark { display:flex; align-items:center; gap:9px; font-weight:700; font-size:15px;
  letter-spacing:-.015em; }
.ball { width:17px; height:17px; border-radius:50%; flex:none; position:relative;
  background:linear-gradient(var(--red) 0 46%, var(--ink) 46% 54%, var(--panel) 54% 100%);
  border:1.5px solid var(--ink); }
.ball::after { content:''; position:absolute; inset:0; margin:auto; width:5px; height:5px;
  border-radius:50%; background:var(--panel); border:1.5px solid var(--ink); }
.now { display:flex; align-items:baseline; gap:8px; min-width:0; }
.now .lbl { font-size:10.5px; text-transform:uppercase; letter-spacing:.08em; color:var(--dim); }
.now .who { font-weight:650; letter-spacing:-.01em; overflow:hidden; text-overflow:ellipsis;
  white-space:nowrap; }

/* ---- buttons */
button, .btn {
  font:inherit; font-weight:600; font-size:13px; padding:7px 13px; border-radius:var(--r);
  border:1px solid var(--line); background:var(--panel); color:var(--ink);
  cursor:pointer; transition:background .12s, border-color .12s, color .12s;
  display:inline-flex; align-items:center; gap:7px; white-space:nowrap;
}
button:hover:not(:disabled) { background:var(--raise); border-color:var(--dim); }
button.primary { background:var(--red); border-color:var(--red); color:var(--red-ink); }
button.primary:hover:not(:disabled) { filter:brightness(1.1); background:var(--red); }
button.quiet { background:transparent; border-color:transparent; color:var(--ink-2); }
button.quiet:hover:not(:disabled) { background:var(--raise); color:var(--ink); }
button.danger { color:var(--bad); }
button.danger:hover:not(:disabled) { background:var(--bad); border-color:var(--bad); color:#fff; }
button.on { border-color:var(--ok); color:var(--ok); }
button.sm { padding:4px 10px; font-size:12px; }
button:disabled { opacity:.4; cursor:not-allowed; }

/* ---- notices */
#toast { display:none; padding:9px 16px; font-size:13px; font-weight:600;
  border-bottom:1px solid var(--line); background:var(--panel); }
#uptodate { display:flex; gap:12px; align-items:center; flex-wrap:wrap;
  padding:9px 16px; font-size:13px; background:var(--gold); color:#17130a;
  border-bottom:1px solid var(--line); }
#uptodate button { border-color:rgba(0,0,0,.35); background:transparent; color:#17130a; }
#uptodate a { color:#17130a; font-weight:600; }

/* ---- shell */
.shell { display:grid; grid-template-columns:232px 1fr; min-height:0; }
@media (max-width:820px) { .shell { grid-template-columns:1fr; } .rail { display:none; } }
.rail { background:var(--rail); border-right:1px solid var(--line);
  display:flex; flex-direction:column; min-height:0; }
.rail-head { display:flex; align-items:center; justify-content:space-between;
  padding:14px 14px 8px; }
.eyebrow { font-size:10.5px; text-transform:uppercase; letter-spacing:.09em;
  color:var(--dim); font-weight:700; }
.rail-list { overflow-y:auto; padding:0 8px 8px; flex:1; }
.rail-foot { padding:8px; border-top:1px solid var(--line-soft); }
.rail-foot button { width:100%; justify-content:center; }

.pk { border:1px solid transparent; border-radius:var(--r); padding:8px 10px; cursor:pointer;
  display:block; width:100%; text-align:left; background:transparent; font:inherit; }
.pk:hover { background:var(--panel); }
.pk .nm { font-weight:600; font-size:13.5px; letter-spacing:-.01em;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pk .sub { font-size:11.5px; color:var(--dim); margin-top:1px; }
.pk[aria-current="true"] { background:var(--panel); border-color:var(--line);
  box-shadow:inset 2px 0 0 var(--gold); }
/* What you can do to the pack sits beside its name in the top bar, not in the
   rail: the rail answers "which one", the bar acts on the answer. */
.pack-acts { display:flex; gap:4px; align-items:center;
  padding-left:12px; margin-left:4px; border-left:1px solid var(--line); }
.pack-acts button { padding:5px 10px; font-size:12.5px; }
@media (max-width:700px) { .pack-acts { display:none; } }

/* ---- main */
.main { display:flex; flex-direction:column; min-height:0; }
.nav { display:flex; gap:2px; padding:0 16px; border-bottom:1px solid var(--line);
  background:var(--panel); }
.nav button { border:0; background:none; border-radius:0; padding:12px 12px 10px;
  color:var(--dim); font-size:13.5px; border-bottom:2px solid transparent; }
.nav button:hover { background:none; color:var(--ink); }
.nav button[aria-selected="true"] { color:var(--ink); border-bottom-color:var(--red); }
.nav .count { font-size:11px; color:var(--dim); font-variant-numeric:tabular-nums; }
.view { overflow-y:auto; padding:16px; flex:1; }
.bar { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:12px; }
input, select, textarea {
  font:inherit; font-size:13px; padding:7px 10px; border-radius:var(--r);
  border:1px solid var(--line); background:var(--bg); color:var(--ink); width:100%;
}
input::placeholder { color:var(--dim); }
textarea { resize:vertical; line-height:1.5; }
.seg { display:inline-flex; border:1px solid var(--line); border-radius:var(--r);
  overflow:hidden; background:var(--panel); }
.seg button { border:0; border-radius:0; font-size:12.5px; padding:6px 12px; color:var(--dim); }
.seg button[aria-pressed="true"] { background:var(--raise); color:var(--ink); }
.chips { display:flex; gap:6px; flex-wrap:wrap; margin:0 0 14px; }
.chips button { padding:3px 10px; font-size:11.5px; border-radius:999px; color:var(--ink-2); }
.chips button[aria-pressed="true"] { background:var(--ink); border-color:var(--ink);
  color:var(--bg); }
.chips .n { color:inherit; opacity:.55; font-variant-numeric:tabular-nums; }

/* ---- rows, used inside dialogs */
.row { display:grid; grid-template-columns:1fr auto; gap:12px; padding:10px 0;
  border-bottom:1px solid var(--line-soft); align-items:center; }
.row:last-child { border-bottom:0; }
.row a { color:var(--dim); text-decoration:none; }
.row a:hover { color:var(--ink); text-decoration:underline; }

/* ---- mod cards.  The stripe is the mod's own colour, derived from its id --
   the same mod is the same colour every time, which is what makes a wall of
   them scannable once you know them by sight. */
.mod { background:var(--panel); border:1px solid var(--line); border-radius:var(--r-lg);
  overflow:hidden; display:flex; flex-direction:column;
  transition:border-color .12s, transform .12s; }
.mod:hover { border-color:var(--dim); transform:translateY(-1px); }
.mod .strip { height:4px; flex:none; }
.mod .body { padding:12px 14px 13px; display:flex; flex-direction:column; gap:7px; flex:1; }
.mod h3 { margin:0; font-size:14.5px; letter-spacing:-.015em; }
.mod .by { font-size:12px; color:var(--dim); margin-top:-4px; }
.mod .sum { font-size:12.5px; color:var(--ink-2); flex:1; }
.mod .tags { display:flex; gap:5px; flex-wrap:wrap; }
.mod .acts { display:flex; gap:6px; align-items:center; flex-wrap:wrap;
  padding-top:2px; }
.mod .acts a { color:var(--dim); text-decoration:none; font-size:12.5px; }
.mod .acts a:hover { color:var(--ink); text-decoration:underline; }

.tag { font-size:11px; font-weight:600; letter-spacing:.02em; padding:1px 7px;
  border-radius:999px; border:1px solid var(--line); color:var(--dim); }
.tag.ok { color:var(--ok); border-color:currentColor; }
.tag.warn { color:var(--warn); border-color:currentColor; }
.tag.bad { color:var(--bad); border-color:currentColor; }
.tag.gold { color:#17130a; background:var(--gold); border-color:var(--gold); }
.ver { font-variant-numeric:tabular-nums; color:var(--ink-2); }

/* ---- community cards */
.grid { display:grid; gap:12px; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); }
.card { background:var(--panel); border:1px solid var(--line); border-radius:var(--r-lg);
  padding:14px; display:flex; flex-direction:column; gap:8px; cursor:pointer;
  transition:border-color .12s, transform .12s; }
.card:hover { border-color:var(--dim); transform:translateY(-1px); }
.card h3 { margin:0; font-size:15px; letter-spacing:-.015em; }
.card .by { font-size:12px; color:var(--dim); }
.card .sum { font-size:13px; color:var(--ink-2); flex:1; }
.card .foot { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.votes { font-variant-numeric:tabular-nums; font-weight:700; font-size:13px; }

/* ---- misc */
.empty { text-align:center; color:var(--dim); padding:64px 16px; }
.empty .ball { width:40px; height:40px; margin:0 auto 16px; border-width:2.5px; }
.empty .ball::after { width:12px; height:12px; border-width:2.5px; }
.empty b { color:var(--ink); display:block; margin-bottom:4px; font-size:15px; }
.why { color:var(--dim); font-size:12.5px; }
code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.92em;
  background:var(--bg); padding:1px 5px; border-radius:4px; border:1px solid var(--line-soft); }
pre.log { background:var(--bg); border:1px solid var(--line); border-radius:var(--r);
  padding:11px 13px; font-size:12px; margin:0; white-space:pre-wrap; max-height:220px;
  overflow:auto; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
.note { background:var(--bg); border:1px solid var(--line);
  border-left:2px solid var(--gold); padding:10px 12px; border-radius:0 var(--r) var(--r) 0;
  font-size:13px; }
.note.bad { border-left-color:var(--bad); }

/* ---- dialog */
dialog { border:1px solid var(--line); border-radius:var(--r-lg); background:var(--panel);
  color:var(--ink); padding:0; width:min(600px,94vw); max-height:88vh; }
dialog::backdrop { background:rgba(6,7,10,.62); }
.dlg-head { padding:18px 20px 12px; border-bottom:1px solid var(--line); }
.dlg-head h2 { margin:0; font-size:16.5px; letter-spacing:-.015em; }
.dlg-body { padding:16px 20px; overflow:auto; max-height:54vh; display:grid; gap:12px; }
.dlg-foot { padding:12px 20px; border-top:1px solid var(--line); display:flex; gap:8px;
  align-items:center; flex-wrap:wrap; }
label { font-size:12.5px; color:var(--ink-2); display:block; }
label input, label textarea { margin-top:5px; }
.drow { display:flex; gap:10px; padding:8px 0; border-bottom:1px solid var(--line-soft);
  font-size:13px; align-items:center; }
.drow:last-child { border-bottom:0; }
</style>
</head>
<body>

<div class="top">
  <span class="mark"><span class="ball"></span>pokepack</span>
  <div class="now"><span class="lbl">Playing</span><span class="who" id="who">…</span></div>
  <div class="pack-acts" id="pack-acts"></div>
  <span style="flex:1"></span>
  <button id="play" class="primary">▶ Play</button>
  <button id="settings" class="quiet">Settings</button>
</div>

<div id="toast"></div>
<div id="uptodate" hidden></div>

<div class="shell">
  <aside class="rail">
    <div class="rail-head"><span class="eyebrow">My packs</span>
      <span class="eyebrow num" id="c-packs"></span></div>
    <div class="rail-list" id="rail"></div>
    <div class="rail-foot"><button id="new">+ New pack</button></div>
  </aside>

  <div class="main">
    <nav class="nav" role="tablist">
      <button id="tab-mods" role="tab" aria-selected="true">Mods
        <span class="count" id="c-mods"></span></button>
      <button id="tab-browse" role="tab" aria-selected="false">Community
        <span class="count" id="c-browse"></span></button>
      <button id="tab-logs" role="tab" aria-selected="false">Logs
        <span class="count" id="c-logs"></span></button>
    </nav>

    <div class="view" id="view-mods">
      <div class="bar">
        <div class="seg" id="mod-filter">
          <button data-f="installed" aria-pressed="true">In this pack</button>
          <button data-f="available" aria-pressed="false">Add mods</button>
          <button data-f="all" aria-pressed="false">All</button>
        </div>
        <input id="mods-q" placeholder="Search mods…" style="flex:1;min-width:180px">
        <button id="mods-zip">Add a mod…</button>
        <button id="mods-refresh" class="quiet">Refresh</button>
      </div>
      <div class="chips" id="mods-cats"></div>
      <div class="why" id="mods-meta" style="margin-bottom:10px"></div>
      <div id="mods-rows"></div>
    </div>

    <div class="view" id="view-browse" hidden></div>
    <div class="view" id="view-logs" hidden></div>
  </div>
</div>

<dialog id="dlg">
  <div class="dlg-head"><h2 id="d-title"></h2><div class="why" id="d-sub"></div></div>
  <div class="dlg-body" id="d-body"></div>
  <div class="dlg-foot"><span class="why" id="d-note"></span><span style="flex:1"></span>
    <button id="d-alt" hidden></button>
    <button id="d-close" class="quiet">Close</button>
    <button class="primary" id="d-go">OK</button></div>
</dialog>

<script>
const TOKEN = ${JSON.stringify(token)};
const api = (p, q = '') => '/api/' + p + '?token=' + TOKEN + q;
let S = null, CAT = null, tab = 'mods', filter = 'installed';
const cats = new Set();

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));

// A mod's colour, from its id.  Stable, so the same mod is the same colour on
// every screen and every machine -- that is the bit that makes it useful rather
// than decorative.  Saturation and lightness are fixed so nothing shouts.
const hue = (id) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360; return h; };
const strip = (id) => 'linear-gradient(90deg,hsl(' + hue(id) + ' 62% 52%),hsl('
  + ((hue(id) + 38) % 360) + ' 62% 44%))';

function toast(msg, bad) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.display = 'block';
  el.style.color = bad ? 'var(--bad)' : 'var(--ok)';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = 'none'; }, 7000);
}

async function post(path, payload) {
  const res = await fetch(api(path), {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  });
  return { ok: res.ok, data: await res.json() };
}

// ------- the app's own version.  The pack list looks after itself; this does not.
async function checkForUpdate() {
  let u;
  try {
    u = await (await fetch(api('update'))).json();
  } catch {
    return;
  }
  if (!u.newer) return;
  const bar = document.getElementById('uptodate');
  bar.hidden = false;
  bar.innerHTML = '<b>pokepack ' + esc(u.latest) + ' is out</b>'
    + '<span>you have ' + esc(u.current ?? '?')
    + (u.notes ? ' \\u00b7 ' + esc(u.notes.split('\\n')[0]) : '') + '</span>'
    + '<span style="flex:1"></span>'
    + (u.checkout?.clean
        ? '<button id="up-go">Update now</button>'
        : '<span style="font-size:12.5px">' + esc(u.checkout?.reason ?? '') + '</span>')
    + (u.url ? '<a href="' + esc(u.url) + '" target="_blank" rel="noopener">what changed \\u2197</a>' : '')
    + '<button id="up-hide">Later</button>';
  document.getElementById('up-hide').onclick = () => { bar.hidden = true; };
  const go = document.getElementById('up-go');
  if (go) {
    go.onclick = async () => {
      go.disabled = true; go.textContent = 'Pulling\\u2026';
      const { ok, data } = await post('update');
      if (!ok) { go.disabled = false; go.textContent = 'Update now'; return toast(data.error, true); }
      bar.innerHTML = '<b>Updated to ' + esc(data.version ?? '?') + '</b><span>'
        + esc(data.from) + ' \\u2192 ' + esc(data.to)
        + ' \\u2014 stop the hub (Ctrl+C) and start it again to run the new code.</span>';
    };
  }
}

async function load() {
  S = await (await fetch(api('state'))).json();
  document.getElementById('who').textContent = S.active ?? 'nothing yet';
  document.getElementById('c-packs').textContent = S.instances.length;
  document.getElementById('c-browse').textContent = (S.gallery ?? []).length;
  renderRail();
  renderPackActions();
  render();
}

// ------- the rail: your packs, and what you can do to the active one

function renderRail() {
  const rail = document.getElementById('rail');
  if (S.instances.length === 0) {
    rail.innerHTML = '<div class="why" style="padding:10px">No setups yet. '
      + 'Make one below, or install a pack from Community.</div>';
    return;
  }
  rail.innerHTML = S.instances.map(i => {
    const on = i.identity === S.active;
    const enabled = i.modList.filter(m => m.enabled).length;
    return '<button class="pk" data-act-inst="' + esc(i.identity) + '" aria-current="' + on + '">'
      + '<div class="nm">' + esc(i.identity) + '</div>'
      + '<div class="sub num">' + plural(i.mods, 'mod') + (i.mods ? ' \\u00b7 ' + enabled + ' on' : '')
      + (i.hasGameData ? '' : ' \\u00b7 no game data') + '</div>'
      + '</button>';
  }).join('');
}

// What you can do to the pack you are on, beside its name.  The rail answers
// "which one"; this acts on the answer.
function renderPackActions() {
  const bar = document.getElementById('pack-acts');
  const inst = S.instances.find(i => i.identity === S.active);
  if (!inst) { bar.innerHTML = ''; return; }
  const enabled = inst.modList.filter(m => m.enabled).length;
  bar.innerHTML =
    (enabled
      ? '<button class="quiet" data-export-inst="' + esc(inst.identity) + '">Export</button>'
        + '<button class="quiet" data-publish="' + esc(inst.identity) + '">Publish</button>'
        + '<button class="quiet" data-android="' + esc(inst.identity) + '">To Android</button>'
      : '')
    + (inst.isDefault ? ''
      : '<button class="quiet danger" data-del-inst="' + esc(inst.identity) + '">Delete</button>');
}

// ------- Community

function renderCommunity() {
  const view = document.getElementById('view-browse');
  const all = [...(S.gallery ?? [])].sort((a, b) =>
    ((b.votes ?? 0) - (a.votes ?? 0)) || (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1));

  const bar = '<div class="bar"><button class="primary" data-import="1">Import a pack\\u2026</button>'
    + '<span class="why">A <code>.pokepack</code> file or link somebody sent you.</span>'
    + '<span style="flex:1"></span>'
    + '<span class="why num">' + all.length + ' published</span>'
    + '<button class="quiet" data-refresh-gallery="1">Check for new</button></div>';

  if (all.length === 0) {
    view.innerHTML = bar + '<div class="empty"><div class="ball"></div>'
      + '<b>Nothing published yet</b>'
      + 'Or the gallery could not be reached. Press <b>Publish</b> on one of your packs to be first.</div>';
    return;
  }

  view.innerHTML = bar + '<div class="grid">' + all.map(p =>
    '<div class="card" data-pack="' + esc(p.id) + '">'
    + '<div><h3>' + esc(p.name) + '</h3>'
    + '<div class="by">' + (p.author ? 'by ' + esc(p.author) : '&nbsp;') + '</div></div>'
    + '<div class="sum">' + esc(p.summary || '\\u2014') + '</div>'
    + '<div class="foot">'
    + (p.votes ? '<span class="votes">\\u25b2 ' + p.votes + '</span>' : '')
    + '<span class="tag num">' + plural(p.modCount, 'mod') + '</span>'
    + (p.mods.every(m => m.pinned) ? '' : '<span class="tag warn">unpinned</span>')
    + (p.status === 'broken' ? '<span class="tag bad">broken</span>' : '')
    + '<span style="flex:1"></span>'
    + (p.thread ? '<a class="why" href="' + esc(p.thread) + '" target="_blank" rel="noopener"'
        + ' onclick="event.stopPropagation()">discuss \\u2197</a>' : '')
    + '</div></div>').join('') + '</div>';
}

// ------- Mods, as rows

async function loadMods(force) {
  const q = document.getElementById('mods-q').value.trim();
  const meta = document.getElementById('mods-meta');
  meta.textContent = 'loading\\u2026';
  const res = await fetch(api('catalogue', '&q=' + encodeURIComponent(q)
    + '&filter=' + filter + '&category=' + encodeURIComponent([...cats].join(','))
    + (force ? '&refresh=1' : '')));
  CAT = await res.json();
  if (!res.ok) { meta.textContent = CAT.error || 'could not load'; return; }

  document.getElementById('c-mods').textContent = CAT.installedCount;
  document.getElementById('mods-q').placeholder = filter === 'installed'
    ? 'Search this pack\\u2019s mods\\u2026' : 'Search ' + CAT.total + ' mods\\u2026';

  const catBar = document.getElementById('mods-cats');
  catBar.hidden = (CAT.categories ?? []).length === 0;
  catBar.innerHTML = (cats.size ? '<button data-cat="">Clear</button>' : '')
    + (CAT.categories ?? []).map(c =>
      '<button data-cat="' + esc(c.name) + '" aria-pressed="' + cats.has(c.name) + '">'
      + esc(c.name.replace(/_/g, ' ')) + ' <span class="n">' + c.count + '</span></button>').join('');

  meta.textContent =
    (filter === 'installed' ? CAT.mods.length + ' in ' + (CAT.active ?? 'nothing')
     : filter === 'available' ? CAT.mods.length + ' available to add'
     : CAT.mods.length + ' shown \\u00b7 for ' + (CAT.active ?? 'nothing'))
    + (CAT.stale ? ' \\u00b7 offline copy' : '');

  const rows = document.getElementById('mods-rows');
  if (CAT.mods.length === 0) {
    rows.innerHTML = '<div class="empty"><div class="ball"></div><b>Nothing here</b>'
      + (filter === 'installed' ? 'This pack has no mods yet \\u2014 try <b>Add mods</b>.'
         : 'Nothing matches that search.') + '</div>';
    return;
  }

  rows.innerHTML = '<div class="grid">' + CAT.mods.map(m => {
    const behind = m.installedVersion && m.latestVersion && m.installedVersion !== m.latestVersion;
    const faults = (m.missing ?? []).map(d => 'needs ' + esc(d.id))
      .concat((m.wrongVersion ?? []).map(d => 'needs ' + esc(d.id) + ' ' + esc(d.range)
        + ', have ' + esc(d.have ?? '?')))
      .concat((m.clashes ?? []).map(c => 'clashes with ' + esc(c)));
    return '<div class="mod"><div class="strip" style="background:' + strip(m.id) + '"></div>'
      + '<div class="body">'
      + '<h3>' + esc(m.title) + '</h3>'
      + (m.author ? '<div class="by">by ' + esc(m.author) + '</div>' : '')
      + '<div class="sum">' + esc(m.summary || '\\u2014') + '</div>'
      + '<div class="tags">'
      + (m.loadsAt ? '<span class="tag num" title="loads ' + m.loadsAt
          + (CAT.loadOrder ? ' of ' + CAT.loadOrder.length : '')
          + (m.loadWhy ? ' \\u2014 ' + m.loadWhy : '') + '">#' + m.loadsAt + '</span>' : '')
      + (m.installedVersion
          ? '<span class="tag gold num">' + esc(m.installedVersion) + '</span>'
          : m.latestVersion ? '<span class="tag num">' + esc(m.latestVersion) + '</span>' : '')
      + (behind ? '<span class="tag warn num">' + esc(m.latestVersion) + ' available</span>' : '')
      + (m.unlisted ? '<span class="tag">not in the index</span>' : '')
      + (!m.unlisted && !m.installable ? '<span class="tag bad">no download</span>' : '')
      + faults.map(f => '<span class="tag bad">' + f + '</span>').join('')
      + (m.categories ?? []).slice(0, 2).map(c =>
          '<span class="tag">' + esc(c.replace(/_/g, ' ')) + '</span>').join('')
      + '</div>'
      + '<div class="acts">'
      + (m.installedVersion && m.enabled !== null
          ? '<button class="sm' + (m.enabled ? ' on' : '') + '" data-mod="' + esc(m.id)
            + '" data-do="' + (m.enabled ? 'disable' : 'enable') + '">'
            + (m.enabled ? 'On' : 'Off') + '</button>'
          : '')
      + (behind && m.installable
          ? '<button class="sm" data-mod="' + esc(m.id) + '" data-do="update">Update</button>' : '')
      + (m.installedVersion
          ? '<button class="sm quiet danger" data-mod="' + esc(m.id) + '" data-do="remove">Remove</button>'
          : m.installable
            ? '<button class="sm primary" data-mod="' + esc(m.id) + '" data-do="install">Install</button>' : '')
      + '<span style="flex:1"></span>'
      + (m.github ? '<a href="https://github.com/' + esc(m.github)
          + '" target="_blank" rel="noopener">repo \\u2197</a>' : '')
      + '</div></div></div>';
  }).join('') + '</div>';
}

// What the game said last time it ran.  Leads with the lines that look like
// trouble, because the alternative is reading a thousand lines of startup
// chatter to find the one that matters.
async function loadLogs() {
  const view = document.getElementById('view-logs');
  view.innerHTML = '<div class="why">reading\\u2026</div>';
  let d;
  try {
    d = await (await fetch(api('logs'))).json();
  } catch (e) {
    view.innerHTML = '<div class="note bad">could not read the logs: ' + esc(e.message) + '</div>';
    return;
  }
  if (d.error) { view.innerHTML = '<div class="note bad">' + esc(d.error) + '</div>'; return; }

  document.getElementById('c-logs').textContent = d.notable.length || '';

  if (!d.any) {
    view.innerHTML = '<div class="empty"><div class="ball"></div><b>No logs yet</b>'
      + 'Press <b>Play</b>, then <b>close the game</b>, and what it printed shows up here.</div>';
    return;
  }

  view.innerHTML =
    '<div class="bar"><span class="why">' + esc(d.identity) + '</span>'
    + '<span style="flex:1"></span>'
    + '<button class="quiet" data-reload-logs="1">Reload</button></div>'
    // Said plainly because an empty log after a crash looks like this screen is
    // broken, when it is Windows holding the last few KB in a buffer.
    + '<div class="note" style="margin-bottom:14px">Windows holds the game\\u2019s output in a '
    + 'buffer until it exits, so <b>close the game to see the full log</b>. A crash that takes '
    + 'the graphics driver down can lose the last few lines \\u2014 Lua errors are written '
    + 'separately and survive that.</div>'
    + (d.loadOrder.length
        ? '<div class="eyebrow" style="margin-bottom:6px">Load order, last run</div>'
          + '<div class="rows" style="margin-bottom:16px">'
          + d.loadOrder.map((m, i) =>
            '<div class="row"><span style="flex:1"><span class="why num">'
            + String(i + 1).padStart(2, '0') + '</span>  <b>' + esc(m.id) + '</b></span>'
            + (m.version ? '<span class="ver">' + esc(m.version) + '</span>' : '') + '</div>').join('')
          + '</div>'
          + '<div class="why" style="margin:-8px 0 16px">Decided by the mods themselves \\u2014 '
          + 'priority, then dependencies first \\u2014 so it is the same on any machine running '
          + 'this pack. When two mods fight over the same thing, the later one usually wins.</div>'
        : '')
    + (d.notable.length
        ? '<div class="eyebrow" style="margin-bottom:6px">Worth a look</div>'
          + '<div class="rows" style="margin-bottom:16px">'
          + d.notable.map(n =>
            '<div class="row"><span style="flex:1"><span class="tag '
            + (n.level === 'error' ? 'bad' : 'warn') + '">' + n.level + '</span> '
            + esc(n.line) + '</span><span class="why">' + esc(n.from) + '</span></div>').join('')
          + '</div>'
        : '<div class="note">Nothing in the logs looks like a warning or an error. '
          + 'A crash that takes the graphics driver with it can leave no trace at all \\u2014 '
          + 'the full output is below.</div>')
    + d.sources.map(s =>
        '<details style="margin-top:10px"><summary style="cursor:pointer;font-size:13px">'
        + esc(s.label) + ' <span class="why">' + esc(s.file) + ' \\u00b7 '
        + Math.max(1, Math.round(s.size / 1024)) + ' KB'
        + (s.modified ? ' \\u00b7 ' + esc(s.modified.replace('T', ' ').slice(0, 19)) : '')
        + (s.truncated ? ' \\u00b7 showing the end' : '') + '</span></summary>'
        + '<pre class="log" style="max-height:340px;margin-top:8px">' + esc(s.text) + '</pre>'
        + '</details>').join('');
}

function render() {
  document.getElementById('tab-mods').setAttribute('aria-selected', tab === 'mods');
  document.getElementById('tab-browse').setAttribute('aria-selected', tab === 'browse');
  document.getElementById('tab-logs').setAttribute('aria-selected', tab === 'logs');
  document.getElementById('view-mods').hidden = tab !== 'mods';
  document.getElementById('view-browse').hidden = tab !== 'browse';
  document.getElementById('view-logs').hidden = tab !== 'logs';
  if (tab === 'browse') renderCommunity();
  if (tab === 'logs') loadLogs();
}

// ------- dialogs

function dialog({ title, sub, body, go, note, onGo, danger, alt }) {
  document.getElementById('d-title').textContent = title;
  document.getElementById('d-sub').textContent = sub ?? '';
  document.getElementById('d-body').innerHTML = body;
  document.getElementById('d-note').textContent = note ?? '';
  const b = document.getElementById('d-go');
  b.textContent = go ?? 'OK';
  b.className = danger ? 'danger' : 'primary';
  b.hidden = !go;
  b.disabled = false;
  b.onclick = onGo;
  const a = document.getElementById('d-alt');
  a.hidden = !alt;
  if (alt) {
    a.textContent = alt.label;
    a.className = alt.danger ? 'danger' : 'quiet';
    a.onclick = alt.onClick;
  }
  // One dialog element serves every screen, so a dialog opened *from* a dialog
  // would otherwise throw rather than replace it.
  if (!dlg.open) dlg.showModal();
}

function field(id, label, value, placeholder) {
  return '<label>' + esc(label) + '<input id="' + id + '" value="' + esc(value ?? '')
    + '" placeholder="' + esc(placeholder ?? '') + '"></label>';
}
const val = (id) => document.getElementById(id).value.trim();

// ------- play

document.getElementById('play').onclick = async () => {
  const btn = document.getElementById('play');
  btn.disabled = true;
  const { ok, data } = await post('play');
  btn.disabled = false;
  if (!ok) {
    toast(data.error, true);
    if (data.needsRom || /executable/.test(data.error)) openSettings();
    return;
  }
  toast('Launched "' + data.identity + '"'
    + (data.version ? ' straight into ' + data.version[0].toUpperCase() + data.version.slice(1) + '.' : '.')
    + (data.gameData?.how === 'copied'
        ? ' Game data copied from "' + data.gameData.from + '" first.'
        : data.linked
          ? ' Copied your ' + data.linked.label + ' ROM in \\u2014 the game imports it once, '
            + 'then boots straight in after that.'
          : ''));
};

document.getElementById('new').onclick = () => {
  dialog({
    title: 'New pack',
    sub: 'A fresh, isolated setup with no mods.',
    body: field('n-name', 'Name', '', 'kanto-3d')
      + '<div class="why">Its own mods, saves and settings. Nothing else is touched.</div>'
      + '<div id="n-out"></div>',
    go: 'Create',
    onGo: async () => {
      const b = document.getElementById('d-go');
      b.disabled = true; b.textContent = 'Creating\\u2026';
      const { ok, data } = await post('instance/new', { name: val('n-name') });
      if (!ok) {
        document.getElementById('n-out').innerHTML = '<div class="note bad">' + esc(data.error) + '</div>';
        b.disabled = false; b.textContent = 'Create';
        return;
      }
      dlg.close();
      toast('Created "' + data.identity + '" and switched to it.'
        + (data.gameData.how === 'copied' ? ' Game data copied in \\u2014 ready to play.'
          : data.gameData.how === 'rom' ? ' Your ' + data.gameData.label
            + ' ROM was copied in; the game imports it once on first launch.'
          : ' No game data \\u2014 ' + data.gameData.reason + '.'));
      tab = 'mods';
      await load();
      loadMods(false);
    },
  });
};

function exportInstance(identity) {
  const inst = S.instances.find(i => i.identity === identity);
  if (!inst) return toast('nothing to export', true);
  const on = inst.modList.filter(m => m.enabled);
  dialog({
    title: 'Export "' + inst.identity + '"',
    sub: plural(on.length, 'mod') + ' switched on will be included.',
    body: field('e-name', 'Pack name', inst.identity)
      + field('e-author', 'Author', '')
      + field('e-summary', 'Summary', '')
      + '<label style="display:flex;gap:8px;align-items:center">'
      + '<input type="checkbox" id="e-pin" checked style="width:auto"> '
      + 'Pin to exact bytes (downloads each mod once)</label>'
      + '<div class="why">' + on.map(m => esc(m.id)).join(', ') + '</div>'
      + '<div id="e-out"></div>',
    go: 'Export',
    onGo: async () => {
      const b = document.getElementById('d-go');
      b.disabled = true;
      b.textContent = document.getElementById('e-pin').checked ? 'Downloading\\u2026' : 'Writing\\u2026';
      const { ok, data } = await post('instance/export', {
        identity, name: val('e-name'), author: val('e-author'), summary: val('e-summary'),
        pin: document.getElementById('e-pin').checked,
      });
      const out = document.getElementById('e-out');
      if (!ok) {
        out.innerHTML = '<pre class="log">' + esc(data.error) + '\\n'
          + (data.warnings || []).map(esc).join('\\n') + '</pre>';
        b.disabled = false; b.textContent = 'Export';
        return;
      }
      out.innerHTML = '<pre class="log">wrote ' + esc(data.file) + '\\n' + data.mods + ' mods'
        + (data.unpinned.length ? '\\nunpinned: ' + esc(data.unpinned.join(', ')) : '\\nall pinned')
        + (data.warnings.length ? '\\n\\n' + data.warnings.map(esc).join('\\n') : '') + '</pre>'
        + '<div class="bar" style="margin:0"><button class="sm" data-share="' + esc(data.id) + '">'
        + 'Share this pack\\u2026</button><span class="why">send it to the gallery for review</span></div>';
      b.textContent = 'Exported';
      load();
    },
  });
}

// The handheld route.  The game runs on Android already; what it has no way to
// do is receive a setup built here, because POKEPORT_IDENTITY is an environment
// variable and an app has no environment.  So this is a copy job, and the
// dialog's whole job is to say plainly what travels and what does not -- the
// two questions somebody about to overwrite a device wants answered first.
function sendToAndroid(identity) {
  const inst = S.instances.find(i => i.identity === identity);
  if (!inst) return toast('no such setup', true);
  const on = inst.modList.filter(m => m.enabled).length;

  dialog({
    title: 'Send "' + identity + '" to Android',
    sub: plural(on, 'mod') + ' and every tested setting, zipped for the device.',
    body: '<div class="why">Your ROM data and your save files stay here. The device '
      + 'imports its own ROM, and its saves are its own.</div>'
      + '<div class="why" style="margin-top:8px">It travels as a profile, so the game\\u2019s '
      + 'mod manager can switch to it on the device. Sending another pack adds another '
      + 'profile rather than replacing this one.</div>'
      + '<div id="an-out"></div>',
    go: 'Build the zip',
    onGo: async () => {
      const b = document.getElementById('d-go');
      b.disabled = true;
      b.textContent = 'Zipping\\u2026';
      const { ok, data } = await post('instance/android', { identity });
      const out = document.getElementById('an-out');
      if (!ok) {
        out.innerHTML = '<pre class="log">' + esc(data.error) + '</pre>';
        b.disabled = false; b.textContent = 'Build the zip';
        return;
      }
      const mb = n => (n / 1048576).toFixed(1) + ' MB';
      out.innerHTML = '<pre class="log">wrote ' + esc(data.file) + '\\n'
        + data.entries + ' files, ' + mb(data.raw) + ' packed to ' + mb(data.bytes) + '\\n\\n'
        + 'Extract it into the game\\u2019s save folder on the device, so that\\n'
        + 'mods/ and options.lua sit directly inside:\\n\\n'
        + '    Android/data/&lt;package&gt;/files/save/' + esc(data.identity) + '/\\n\\n'
        + 'The game shows you that path on its ROM import screen.\\n'
        + (data.left.length
          ? '\\nleft behind: ' + esc(data.left.map(l => l.name).join(', ')) : '')
        + '</pre>';
      b.textContent = 'Built';
    },
  });
}

// Publishing: export, then send that for review.  One action, because "export,
// find the file, share it" is three steps for one intention.
function publishInstance(identity) {
  const inst = S.instances.find(i => i.identity === identity);
  if (!inst) return toast('no such setup', true);
  const on = inst.modList.filter(m => m.enabled);

  dialog({
    title: 'Publish "' + identity + '"',
    sub: plural(on.length, 'mod') + ' switched on will be included.',
    body: field('pb-name', 'Pack name', identity)
      + field('pb-author', 'Your name', '')
      + '<label>What is it for?<input id="pb-summary" placeholder="Voxel battles tuned for two players"></label>'
      + '<label>Anything the reviewer should know<textarea id="pb-note" rows="3" '
      + 'placeholder="What you tested, how long you played, and any setting that looks like a typo '
      + 'but is the point."></textarea></label>'
      + '<div class="note">Publishing downloads each mod once to lock its exact bytes, then opens '
      + 'GitHub with the pack filled in. It goes to the review branch \\u2014 nothing is live until '
      + 'it is merged.</div><div id="pb-out"></div>',
    go: 'Export and publish',
    onGo: async () => {
      const b = document.getElementById('d-go');
      const out = document.getElementById('pb-out');
      b.disabled = true; b.textContent = 'Pinning\\u2026';
      const { ok, data } = await post('instance/export', {
        identity, name: val('pb-name'), author: val('pb-author'),
        summary: val('pb-summary'), pin: true, overwrite: true,
      });
      if (!ok) {
        out.innerHTML = '<pre class="log">' + esc(data.error) + '\\n'
          + (data.warnings || []).map(esc).join('\\n') + '</pre>';
        b.disabled = false; b.textContent = 'Export and publish';
        return;
      }
      const note = document.getElementById('pb-note').value.trim();
      await load();
      sharePack(data.id, { note, warnings: data.warnings });
    },
  });
}

// The whole PR happens on github.com: this only opens the right link, which
// carries the filename and the file's contents.
async function sharePack(id, extra = {}) {
  const r = await (await fetch(api('pack/share', '&id=' + encodeURIComponent(id)))).json();
  if (r.needsRepo) { toast(r.error, true); return openSettings(); }
  if (r.error) return toast(r.error, true);

  dialog({
    title: 'Publish "' + r.name + '"',
    sub: 'Sends it to ' + r.repo + ' for review.',
    body: '<div class="note">Opening this fills in a new file on GitHub with your pack '
      + 'already in it. Press <b>Propose new file</b> there and it becomes a pull request. '
      + 'GitHub makes your own copy of the repo for you \\u2014 nothing is installed and '
      + 'you need no git.</div>'
      + (extra.note
          ? '<div><div class="why" style="margin-bottom:5px">Paste this into the description on GitHub:</div>'
            + '<textarea id="sh-note" rows="3" readonly>' + esc(extra.note) + '</textarea>'
            + '<button class="sm" id="sh-copy" style="margin-top:6px">Copy it</button></div>'
          : '')
      + ((extra.warnings ?? []).length
          ? '<pre class="log">' + extra.warnings.map(esc).join('\\n') + '</pre>' : '')
      + (r.unpinned.length
          ? '<div class="note bad"><b>' + plural(r.unpinned.length, 'mod is', 'mods are')
            + ' unpinned.</b> Unpinned packs are not merged \\u2014 without a checksum nobody can '
            + 'tell later whether they got the files you tested.</div>'
          : '<div class="note">Every mod is pinned. That is the main thing review checks for.</div>')
      + (r.tooLong
          ? '<div class="note bad">This pack is too big to send as a link (' + r.length
            + ' characters). Open a pull request by hand and add the file from <code>packs/</code>.</div>'
          : '')
      + '<div class="why">It lands on the review branch, not the live one. Merging is what makes '
      + 'it visible to everybody \\u2014 no one has to update anything.</div>',
    go: r.tooLong ? null : 'Open GitHub',
    onGo: () => {
      window.open(r.url, '_blank', 'noopener');
      dlg.close();
      toast('Opened GitHub. Press "Propose new file" there to finish.');
    },
  });

  const copy = document.getElementById('sh-copy');
  if (copy) {
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(extra.note);
        copy.textContent = 'Copied';
      } catch {
        document.getElementById('sh-note').select();
        copy.textContent = 'Selected \\u2014 press Ctrl+C';
      }
    };
  }
}

const size = (n) => (n >= 1073741824
  ? (n / 1073741824).toFixed(1) + ' GB' : Math.max(1, Math.round(n / 1048576)) + ' MB');

// Deleting a setup takes save files with it, so the confirmation names what is
// actually in there rather than asking "are you sure?" about an unknown.
async function confirmDeleteInstance(identity) {
  const p = await (await fetch(api('instance/preview', '&identity=' + encodeURIComponent(identity)))).json();
  if (p.error) return toast(p.error, true);
  if (!p.canDelete) {
    return dialog({ title: 'Keeping "' + identity + '"',
      body: '<div class="note bad">' + esc(p.reason) + '</div>', go: null });
  }

  const bits = [];
  if (p.mods.length) bits.push(plural(p.mods.length, 'mod'));
  if (p.saves.length) bits.push(plural(p.saves.length, 'save file'));
  if (p.romVersions.length) bits.push(p.romVersions.join(' + ') + ' game data');
  bits.push(p.files + ' files \\u00b7 ' + size(p.bytes));

  dialog({
    title: 'Delete "' + identity + '"?',
    sub: 'The whole setup goes \\u2014 its mods, its saves and its settings.',
    body: '<div class="note bad"><b>' + esc(bits.join(' \\u00b7 ')) + '</b>'
      + (p.mods.length ? '<br><span class="why">' + esc(p.mods.join(', ')) + '</span>' : '') + '</div>'
      + (p.saves.length
          ? '<div class="note bad"><b>There is progress saved in here.</b> '
            + plural(p.saves.length, 'save file') + ' belong'
            + (p.saves.length === 1 ? 's' : '') + ' to this setup and no other. '
            + 'Nothing else on this machine has a copy.</div>'
          : '')
      + (p.isActive ? '<div class="note">This is the one you are playing. Deleting it '
          + 'switches you to another setup.</div>' : '')
      + '<div class="note"><b>Nothing is erased.</b> The folder moves to<br>'
      + '<code>' + esc(p.trash) + '</code><br><span class="why">Drag it back into '
      + esc(p.path.replace(/[^\\\\/]+$/, '')) + ' to undo this completely.</span></div>'
      + field('del-name', 'Type ' + identity + ' to confirm', '')
      + '<div id="del-out"></div>',
    go: 'Delete this setup',
    danger: true,
    onGo: async () => {
      const b = document.getElementById('d-go');
      b.disabled = true; b.textContent = 'Moving\\u2026';
      const { ok, data } = await post('instance/delete', { identity, confirm: val('del-name') });
      if (!ok) {
        document.getElementById('del-out').innerHTML = '<div class="note bad">' + esc(data.error) + '</div>';
        b.disabled = false; b.textContent = 'Delete this setup';
        return;
      }
      dlg.close();
      toast('"' + identity + '" moved to ' + data.to + '.');
      await load();
    },
  });

  // The name has to be typed out.  A single mis-click should not be able to
  // take a save folder with it.
  const b = document.getElementById('d-go');
  const input = document.getElementById('del-name');
  b.disabled = true;
  input.oninput = () => { b.disabled = input.value.trim() !== identity; };
  input.focus();
}

function confirmDeletePack(id, name) {
  dialog({
    title: 'Delete the "' + name + '" pack file?',
    sub: 'That is the recipe, not a setup you play.',
    body: '<div class="note">Any setup you already installed from it keeps working exactly as it is. '
      + 'Only the shareable file goes, and it moves to <code>packs/.trash</code> rather than being '
      + 'erased.</div>' + field('dp-name', 'Type ' + id + ' to confirm', '')
      + '<div id="dp-out"></div>',
    go: 'Delete the file',
    danger: true,
    onGo: async () => {
      const { ok, data } = await post('pack/delete', { id, confirm: val('dp-name') });
      if (!ok) {
        document.getElementById('dp-out').innerHTML = '<div class="note bad">' + esc(data.error) + '</div>';
        return;
      }
      dlg.close();
      toast('"' + name + '" moved to ' + data.to + '.');
      load();
    },
  });
  const b = document.getElementById('d-go');
  const input = document.getElementById('dp-name');
  b.disabled = true;
  input.oninput = () => { b.disabled = input.value.trim() !== id; };
  input.focus();
}

// Somebody sent you a pack: a file in a chat window, or a link.  Both end at
// the same place -- checked before it is kept, then you decide.
function importPack() {
  dialog({
    title: 'Import a pack',
    sub: 'A .pokepack file, or a link to one.',
    body: '<div class="bar" style="margin:0"><button id="i-file">Choose a file\\u2026</button>'
      + '<span class="why">from your downloads, wherever they sent it</span></div>'
      + '<div class="why" style="text-align:center">or</div>'
      + field('i-url', 'Paste a link', '', 'https://\\u2026/kanto-3d.pokepack')
      + '<div class="note">It gets checked before it is kept \\u2014 the same check a pack off '
      + 'the internet gets. Coming from someone you know does not make it safe; what it downloads '
      + 'still has to be pinned and still comes from the mod authors.</div>'
      + '<div id="i-out"></div>',
    go: 'Import from link',
    onGo: () => {
      const link = val('i-url');
      if (!link) {
        document.getElementById('i-out').innerHTML =
          '<div class="note bad">Paste a link first, or choose a file instead.</div>';
        return;
      }
      runImport({ url: link });
    },
  });
  document.getElementById('i-file').onclick = () => runImport({});
}

async function runImport(payload) {
  const out = document.getElementById('i-out');
  const b = document.getElementById('d-go');
  const f = document.getElementById('i-file');
  b.disabled = true; f.disabled = true; f.textContent = 'Choosing\\u2026';
  const { ok, data } = await post('pack/import', payload);
  b.disabled = false; f.disabled = false; f.textContent = 'Choose a file\\u2026';
  if (data.cancelled) return;

  if (!ok) {
    if (data.needsReplace) {
      out.innerHTML = '<div class="note"><b>' + esc(data.error) + '</b><br>'
        + 'Replacing it changes the recipe only. Setups you already installed keep working.'
        + '<br><br><button class="primary sm" id="i-replace">Replace it</button></div>';
      document.getElementById('i-replace').onclick = () => runImport({ ...payload, replace: true });
      return;
    }
    out.innerHTML = '<div class="note bad">' + esc(data.error) + '</div>';
    return;
  }

  dlg.close();
  toast('Imported "' + data.name + '" \\u2014 ' + plural(data.mods, 'mod')
    + (data.unpinned.length ? ', ' + data.unpinned.length + ' unpinned' : ', all pinned') + '.');
  tab = 'browse';
  await load();
  showPack(data.id);
}

// What a shared recipe actually contains, before you commit to it.
async function showPack(id) {
  const p = await (await fetch(api('pack', '&id=' + encodeURIComponent(id)))).json();
  if (p.error) return toast(p.error, true);

  const bytes = p.mods.reduce((n, m) => n + (m.size || 0), 0);
  const unpinned = p.mods.filter(m => !m.pinned);

  const rows = p.mods.map(m =>
    '<div class="drow"><span style="flex:1">'
    + '<span style="font-weight:650">' + esc(m.title) + '</span> '
    + '<span class="why ver">' + esc(m.version ?? '') + (m.author ? ' \\u00b7 ' + esc(m.author) : '') + '</span>'
    + (m.summary ? '<br><span class="why">' + esc(m.summary) + '</span>' : '')
    + (Object.keys(m.options).length
        ? '<br><span class="why">settings: '
          + esc(Object.entries(m.options).map(([k, v]) => k + '=' + v).join(', ')) + '</span>' : '')
    + (m.notes ? '<br><span class="why">note: ' + esc(m.notes) + '</span>' : '')
    + '<br><span class="why">'
    + (m.pinned ? 'pinned ' + esc(m.sha256.slice(0, 12)) + '\\u2026' : 'UNPINNED')
    + (m.host ? ' \\u00b7 from ' + esc(m.host) : '')
    + (m.listed ? '' : ' \\u00b7 not in the index') + '</span></span>'
    + (m.haveVersion
        ? '<span class="tag ' + (m.haveVersion === m.version ? 'ok' : 'warn') + '">'
          + (m.haveVersion === m.version ? 'you have it' : 'you have ' + esc(m.haveVersion)) + '</span>'
        : '') + '</div>').join('');

  dialog({
    title: p.name,
    sub: (p.author ? 'by ' + p.author + ' \\u00b7 ' : '') + (p.summary || ''),
    body: '<div>' + rows + '</div>'
      + (p.disable.length
          ? '<div class="note"><b>Switches off:</b> ' + esc(p.disable.join(', '))
            + '<br><span class="why">A tested combination includes what must be off.</span></div>' : '')
      + (unpinned.length
          ? '<div class="note bad"><b>' + plural(unpinned.length, 'mod is', 'mods are')
            + ' unpinned.</b> Without a checksum there is no way to tell later whether you got '
            + 'the same files the author tested.</div>' : '')
      + '<div class="bar" style="margin:0">'
      + (p.origin === 'local'
          ? '<button class="sm" data-share="' + esc(p.id) + '">Share this pack\\u2026</button>' : '')
      + (p.thread ? '<a class="why" href="' + esc(p.thread) + '" target="_blank" rel="noopener">'
          + '\\u25b2 ' + (p.votes ?? 0) + ' \\u00b7 discussion \\u2197</a>' : '')
      + '</div>'
      + '<div class="why">' + (p.engine ? 'engine ' + esc(p.engine) + ' \\u00b7 ' : '')
      + (p.strict ? 'strict \\u2014 will not activate half-resolved' : 'loose')
      + (p.createdAt ? ' \\u00b7 made ' + esc(p.createdAt.slice(0, 10)) : '')
      + ' \\u00b7 ' + esc(p.file) + '</div>',
    note: bytes ? 'download ' + (bytes / 1048576).toFixed(1) + ' MB' : '',
    go: 'Install as new setup',
    onGo: () => installPack(p.id),
    alt: p.origin === 'local'
      ? { label: 'Delete file', danger: true, onClick: () => confirmDeletePack(p.id, p.name) }
      : null,
  });
}

function installPack(id) {
  dialog({
    title: 'Install as a new setup',
    sub: 'It gets its own mods, saves and settings \\u2014 nothing existing is touched.',
    body: field('p-name', 'Name for the new setup', id) + '<div id="p-out"></div>',
    go: 'Create & install',
    onGo: () => {
      const b = document.getElementById('d-go');
      b.disabled = true; b.textContent = 'Working\\u2026';
      const out = document.getElementById('p-out');
      out.innerHTML = '<pre class="log" id="p-log"></pre>';
      const log = document.getElementById('p-log');
      const put = (s) => { log.textContent += s + '\\n'; log.scrollTop = log.scrollHeight; };
      const src = new EventSource(api('instance/from-pack',
        '&id=' + encodeURIComponent(id) + '&name=' + encodeURIComponent(val('p-name'))));
      src.onmessage = async (ev) => {
        const m = JSON.parse(ev.data);
        if (m.type === 'created') put('created ' + m.path);
        else if (m.type === 'gameData') put('game data: ' + (m.how === 'copied'
          ? 'copied ' + m.versions.join(', ') + ' from ' + m.from
          : m.how === 'rom' ? 'your ' + m.label + ' ROM copied in' : (m.reason || 'none')));
        else if (m.type === 'start') put('downloading ' + m.id + ' ' + (m.version || ''));
        else if (m.type === 'done') put('  installed ' + m.id + ' ' + m.version);
        else if (m.type === 'failed') put('  FAILED ' + m.id + ': ' + m.reason);
        else if (m.type === 'live') put(m.applied ? '  settings applied' : '  ' + m.reason);
        else if (m.type === 'error') { put('error: ' + m.reason); src.close(); b.textContent = 'Failed'; }
        else if (m.type === 'finished') {
          src.close();
          b.textContent = 'Done';
          put('\\nNow playing "' + m.active + '".');
          tab = 'mods';
          await load();
          loadMods(false);
        }
      };
      src.onerror = () => { src.close(); put('connection closed'); b.textContent = 'Failed'; };
    },
  });
}

async function openSettings() {
  const s = S.settings;
  dialog({
    title: 'Settings',
    sub: 'Two paths, set once.',
    body: '<div><div class="why" style="margin-bottom:5px">gen1recomp.exe \\u2014 needed to Play</div>'
      + '<div style="display:flex;gap:8px"><input id="s-exe" value="' + esc(s.gamePath ?? '') + '">'
      + '<button id="s-exe-b" style="flex:none">Browse\\u2026</button></div>'
      + '<div class="why" id="s-exe-msg"></div></div>'
      + '<div><div class="why" style="margin-bottom:5px">Your ROM (.gb) \\u2014 copied into each new setup</div>'
      + '<div style="display:flex;gap:8px"><input id="s-rom" value="' + esc(s.romPath ?? '') + '">'
      + '<button id="s-rom-b" style="flex:none">Browse\\u2026</button></div>'
      + '<div class="why" id="s-rom-msg"></div></div>'
      + '<div class="why">Checked against the known Red / Blue / Yellow checksums. Never uploaded.</div>'
      + '<div style="border-top:1px solid var(--line);padding-top:12px">'
      + '<div class="why" style="margin-bottom:5px">Community packs come from</div>'
      + '<div><code style="word-break:break-all">' + esc(s.packIndexUrl) + '</code></div>'
      + '<div class="why" style="margin-top:8px">and <b>Publish</b> sends yours to <code>'
      + esc(s.submitRepo) + '</code></div>'
      + '<div class="why" style="margin-top:8px">Both are fixed in the build rather than settings. '
      + 'A pack list decides what gets installed, so it should not be repointable from a text box '
      + '\\u2014 change it in <code>src/packfeed.js</code> and restart.</div></div>'
      + '<div class="why">Your paths are saved in ' + esc(s.configPath) + '</div>',
    go: null,
  });

  const wire = (btn, kind, input, msg) => {
    document.getElementById(btn).onclick = async () => {
      const b = document.getElementById(btn);
      b.disabled = true; b.textContent = 'Choosing\\u2026';
      const { ok, data } = await post('browse', { kind });
      b.disabled = false; b.textContent = 'Browse\\u2026';
      const m = document.getElementById(msg);
      if (data.cancelled) return;
      if (!ok) { m.style.color = 'var(--bad)'; m.textContent = data.error; return; }
      document.getElementById(input).value = data.path;
      m.style.color = 'var(--ok)';
      m.textContent = data.label ? 'Recognised as ' + data.label + '.' : 'Saved.';
      load();
    };
  };
  wire('s-exe-b', 'exe', 's-exe', 's-exe-msg');
  wire('s-rom-b', 'rom', 's-rom', 's-rom-msg');
}
document.getElementById('settings').onclick = openSettings;

// ------- the rail's actions, delegated so they survive a re-render

// Pack actions live in the top bar now, so they get their own listener.
document.getElementById('pack-acts').addEventListener('click', (e) => {
  const del = e.target.closest('[data-del-inst]');
  if (del) return confirmDeleteInstance(del.dataset.delInst);
  const pub = e.target.closest('[data-publish]');
  if (pub) return publishInstance(pub.dataset.publish);
  const exp = e.target.closest('[data-export-inst]');
  if (exp) return exportInstance(exp.dataset.exportInst);
  const dro = e.target.closest('[data-android]');
  if (dro) return sendToAndroid(dro.dataset.android);
});

document.getElementById('rail').addEventListener('click', async (e) => {
  const card = e.target.closest('[data-act-inst]');
  if (!card) return;
  const { ok, data } = await post('activate', { identity: card.dataset.actInst });
  if (!ok) return toast(data.error, true);
  await load();
  if (CAT) loadMods(false);
  toast('Now playing "' + data.active + '".');
});

document.getElementById('view-browse').addEventListener('click', async (e) => {
  if (e.target.closest('[data-import]')) return importPack();
  if (e.target.closest('[data-refresh-gallery]')) {
    const was = (S.gallery ?? []).length;
    S = await (await fetch(api('state', '&refresh=1'))).json();
    document.getElementById('c-browse').textContent = (S.gallery ?? []).length;
    render();
    const now = (S.gallery ?? []).length;
    return toast(now === was ? 'No new packs published.' : (now - was) + ' new pack(s) published.');
  }
  const recipe = e.target.closest('[data-pack]');
  if (recipe) return showPack(recipe.dataset.pack);
});

// Buttons inside a dialog body, which is rebuilt every time it opens.
document.getElementById('d-body').addEventListener('click', (e) => {
  const share = e.target.closest('[data-share]');
  if (share) return sharePack(share.dataset.share);
});

// ------- mod actions

document.getElementById('mods-rows').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-mod]');
  if (!btn) return;
  const id = btn.dataset.mod;
  const doing = btn.dataset.do;
  const was = btn.textContent;
  btn.disabled = true;
  btn.textContent = doing === 'remove' ? 'Removing\\u2026'
    : doing === 'install' || doing === 'update' ? 'Installing\\u2026' : '\\u2026';

  const { ok, data } = await post('mod', {
    id,
    action: doing === 'remove' ? 'remove' : (doing === 'enable' || doing === 'disable') ? doing : 'install',
    replace: doing === 'update',
  });

  if (!ok && (data.needsDeps || data.hasClashes)) {
    btn.disabled = false; btn.textContent = was;
    return askAboutDeps(data, doing === 'update');
  }
  if (!ok || ((doing === 'enable' || doing === 'disable') && !data.changed)) {
    btn.disabled = false; btn.textContent = was;
    return toast(data.error || data.reason || 'could not do that', true);
  }
  toast(doing === 'remove' ? id + ' moved to the backup folder.'
    : doing === 'enable' ? id + ' switched on.'
    : doing === 'disable' ? id + ' switched off.'
    : id + ' ' + (data.version ?? '') + ' installed.');
  await loadMods(false);
  load();
});

function askAboutDeps(data, isUpdate) {
  const missing = data.dependencies ?? [];
  const gettable = missing.filter(d => d.installable);
  const stuck = missing.filter(d => !d.installable);

  dialog({
    title: data.title + ' needs company',
    sub: missing.length ? 'It depends on ' + plural(missing.length, 'other mod') + '.'
      : 'It conflicts with something you already have.',
    body: (missing.length
        ? '<div>' + missing.map(d =>
            '<div class="drow"><span style="flex:1"><b>' + esc(d.title) + '</b> '
            + '<span class="why">' + esc(d.id) + (d.range ? ' ' + esc(d.range) : '') + '</span></span>'
            + (d.installable
                ? '<span class="tag ok">will install ' + esc(d.version ?? '') + '</span>'
                : '<span class="tag bad">not in the index</span>') + '</div>').join('') + '</div>'
        : '')
      + (data.clashes?.length
          ? '<div class="note bad"><b>Clashes with ' + data.clashes.map(esc).join(', ') + '.</b><br>'
            + 'Two mods that replace the same thing cannot both run \\u2014 the game will refuse '
            + 'to load one of them. Remove the other first if you want this one.</div>' : '')
      + (stuck.length
          ? '<div class="note bad">' + stuck.map(d => esc(d.id)).join(', ')
            + ' cannot be fetched \\u2014 not in the index. You would have to add it yourself with '
            + '<b>Add a mod\\u2026</b>, and until then the game will not load '
            + esc(data.title) + '.</div>' : '')
      + '<div id="dep-out"></div>',
    go: gettable.length ? 'Install all ' + (gettable.length + 1) : 'Install anyway',
    danger: data.hasClashes && !gettable.length,
    onGo: async () => {
      const b = document.getElementById('d-go');
      b.disabled = true; b.textContent = 'Installing\\u2026';
      const res = await post('mod', {
        id: data.id, action: 'install', replace: isUpdate,
        acknowledged: true, withDeps: gettable.length > 0,
      });
      if (!res.ok) {
        document.getElementById('dep-out').innerHTML =
          '<div class="note bad">' + esc(res.data.error) + '</div>';
        b.disabled = false; b.textContent = 'Try again';
        return;
      }
      dlg.close();
      const also = res.data.alsoInstalled ?? [];
      toast(data.id + ' installed'
        + (also.length ? ' with ' + also.map(a => a.id).join(', ') : '') + '.');
      await loadMods(false);
      load();
    },
  });
}

// Add a mod the index has never heard of: a file, or a link.  The link is the
// one that can be shared -- a file on your disk cannot go into a pack.
document.getElementById('mods-zip').onclick = () => {
  dialog({
    title: 'Add a mod',
    sub: 'For anything the index does not list.',
    body: field('az-url', 'Link to a GitHub release, or straight to a .zip', '',
      'https://github.com/owner/repo/releases/tag/v1.8.2')
      + '<div class="note">A link is the one that can be shared. The exact file and its checksum '
      + 'are recorded, so a pack you export can point other people at it.</div>'
      + '<div class="why" style="text-align:center">or</div>'
      + '<div class="bar" style="margin:0"><button id="az-file">Choose a file\\u2026</button>'
      + '<span class="why">installs here only \\u2014 nobody else can fetch a file on your disk, '
      + 'so a pack built from it will not work for them</span></div>'
      + '<div id="az-out"></div>',
    go: 'Fetch and install',
    onGo: () => {
      const link = val('az-url');
      if (!link) {
        document.getElementById('az-out').innerHTML =
          '<div class="note bad">Paste a link first, or choose a file instead.</div>';
        return;
      }
      addMod({ url: link });
    },
  });
  document.getElementById('az-file').onclick = () => addMod({});
};

async function addMod(payload) {
  const out = document.getElementById('az-out');
  const b = document.getElementById('d-go');
  const f = document.getElementById('az-file');
  b.disabled = true; f.disabled = true;
  b.textContent = payload.url ? 'Fetching\\u2026' : 'Choosing\\u2026';
  const { ok, data } = await post('mod/zip', payload);
  b.disabled = false; f.disabled = false; b.textContent = 'Fetch and install';
  if (data.cancelled) return;

  if (!ok) {
    if (/already installed/.test(data.error || '')) {
      out.innerHTML = '<div class="note"><b>' + esc(data.error) + '</b><br>'
        + 'Replace it? The old copy is kept in the backup folder.'
        + '<br><br><button class="primary sm" id="az-replace">Replace it</button></div>';
      document.getElementById('az-replace').onclick = () => addMod({ ...payload, replace: true });
      return;
    }
    out.innerHTML = '<div class="note bad">' + esc(data.error) + '</div>';
    return;
  }

  dlg.close();
  toast(data.id + ' ' + data.version + ' installed'
    + (data.from ? ' from ' + data.from : '')
    + (data.source ? ' \\u2014 packs can point at it.' : ' \\u2014 local only, not publishable.'));
  await loadMods(false);
  load();
}

// ------- wiring

let modsTimer = null;
document.getElementById('mods-q').addEventListener('input', () => {
  clearTimeout(modsTimer);
  modsTimer = setTimeout(() => loadMods(false), 200);
});
document.getElementById('mods-refresh').onclick = () => loadMods(true);
document.getElementById('mod-filter').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-f]');
  if (!b) return;
  filter = b.dataset.f;
  for (const x of document.querySelectorAll('#mod-filter button')) {
    x.setAttribute('aria-pressed', x === b);
  }
  loadMods(false);
});
document.getElementById('mods-cats').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-cat]');
  if (!b) return;
  const name = b.dataset.cat;
  if (name === '') cats.clear();
  else if (cats.has(name)) cats.delete(name);
  else cats.add(name);
  loadMods(false);
});

document.getElementById('tab-mods').onclick = () => { tab = 'mods'; render(); loadMods(false); };
document.getElementById('tab-browse').onclick = () => { tab = 'browse'; render(); };
document.getElementById('tab-logs').onclick = () => { tab = 'logs'; render(); };
document.getElementById('view-logs').addEventListener('click', (e) => {
  if (e.target.closest('[data-reload-logs]')) loadLogs();
});
document.getElementById('d-close').onclick = () => dlg.close();

checkForUpdate();
load().then(() => loadMods(false));
</script>
</body>
</html>`;
}
