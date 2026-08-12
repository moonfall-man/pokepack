// The hub page.  One file, no build step, no framework -- it is a local tool
// and the whole thing has to stay readable.
//
// Structure follows one rule: an **active instance** is selected in My packs,
// and every other screen is scoped to it.  Mods shows that instance's mods.
// Play launches that instance.  Nothing is configured in two places.
//
// Themed after the games' palette (the red, the gold, the blue) rather than
// their artwork: this repo ships no Pokemon images any more than it ships a
// ROM.  The only graphic is a few lines of CSS.

export function page(token) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>pokepack</title>
<style>
:root {
  --bg:#f4f5fa; --panel:#fff; --ink:#17171c; --dim:#6a6a78; --line:#e2e3ec;
  --red:#ee1515; --gold:#ffcb05; --blue:#2a75bb;
  --ok:#1f8a4c; --warn:#b26a00; --bad:#c0392b;
  --shadow:0 1px 2px rgba(20,20,40,.06), 0 8px 24px rgba(20,20,40,.05);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg:#121319; --panel:#1b1d26; --ink:#eceef6; --dim:#9599aa; --line:#2b2e3c;
    --red:#ff4d4d; --gold:#ffd633; --blue:#5aa5e8;
    --ok:#4ecb79; --warn:#e0a33a; --bad:#ff6b5b;
    --shadow:0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.3);
  }
}
* { box-sizing:border-box; }
/* An author-level display rule beats the UA's [hidden] { display:none }, so
   .grid { display:grid } would keep showing a hidden pane.  Make hidden win. */
[hidden] { display:none !important; }
body { margin:0; background:var(--bg); color:var(--ink);
  font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; }
header { padding:14px 28px; background:var(--panel); border-bottom:1px solid var(--line);
  display:flex; align-items:center; gap:14px; flex-wrap:wrap; position:sticky; top:0; z-index:5; }
.wordmark { font-size:20px; font-weight:800; letter-spacing:-.02em; margin:0;
  display:flex; align-items:center; gap:9px; }
.wordmark .a { color:var(--red); } .wordmark .b { color:var(--blue); }
/* A ball is two halves and a band -- plain CSS geometry, not shipped art. */
.ball { width:19px; height:19px; border-radius:50%; flex:none; position:relative;
  background:linear-gradient(var(--red) 0 47%, var(--line) 47% 53%, var(--panel) 53% 100%);
  border:1.5px solid var(--ink); }
.ball::after { content:''; position:absolute; inset:0; margin:auto; width:6px; height:6px;
  border-radius:50%; background:var(--panel); border:1.5px solid var(--ink); }
.playing { display:flex; flex-direction:column; line-height:1.2; }
.playing .lbl { font-size:10.5px; text-transform:uppercase; letter-spacing:.06em; color:var(--dim); }
.playing .who { font-weight:700; font-size:14px; }
.dim { color:var(--dim); font-size:12.5px; }
nav { padding:0 28px; background:var(--panel); border-bottom:1px solid var(--line); display:flex; gap:4px; }
nav button { border:0; background:transparent; padding:11px 16px; font:inherit; font-weight:650;
  font-size:14px; color:var(--dim); cursor:pointer; border-bottom:2.5px solid transparent; border-radius:0; }
nav button.on { color:var(--ink); border-bottom-color:var(--red); }
nav .count { font-size:11px; background:var(--bg); border:1px solid var(--line);
  border-radius:999px; padding:1px 7px; margin-left:6px; color:var(--dim); }
main { padding:24px 28px 60px; max-width:1180px; }
.grid { display:grid; gap:16px; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); }
.card { background:var(--panel); border:1px solid var(--line); border-radius:14px;
  overflow:hidden; box-shadow:var(--shadow); display:flex; flex-direction:column;
  transition:border-color .12s, transform .12s; }
.card.pick { cursor:pointer; }
.card.pick:hover { border-color:var(--red); transform:translateY(-2px); }
.card.active { border-color:var(--gold); box-shadow:0 0 0 2px var(--gold) inset, var(--shadow); }
.strip { height:6px; }
.body { padding:14px 16px 16px; display:flex; flex-direction:column; flex:1; gap:8px; }
.card h2 { font-size:16px; margin:0; letter-spacing:-.01em; }
.sum { font-size:13.5px; opacity:.85; flex:1; }
.badges { display:flex; gap:6px; flex-wrap:wrap; }
.badge { font-size:10.5px; font-weight:700; letter-spacing:.04em; text-transform:uppercase;
  padding:3px 8px; border-radius:999px; border:1px solid var(--line); color:var(--dim); }
.badge.ready { color:var(--ok); border-color:currentColor; }
.badge.work { color:var(--warn); border-color:currentColor; }
.badge.broken { color:var(--bad); border-color:currentColor; }
.badge.active { color:#111; background:var(--gold); border-color:var(--gold); }
.acts { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
button { font:inherit; font-weight:650; padding:9px 18px; border-radius:10px; cursor:pointer;
  border:1px solid var(--line); background:transparent; color:var(--ink); }
button:hover:not(:disabled) { border-color:var(--dim); }
button.primary { background:var(--red); border-color:var(--red); color:#fff; }
button.primary:hover:not(:disabled) { filter:brightness(1.08); }
button.ghost { border-color:transparent; color:var(--dim); }
button.danger { color:var(--bad); border-color:var(--bad); }
button.on { border-color:var(--ok); color:var(--ok); }
button.sm { padding:6px 12px; font-size:12.5px; }
button:disabled { opacity:.45; cursor:not-allowed; }
input, select, textarea { width:100%; padding:9px 11px; border-radius:9px; border:1px solid var(--line);
  background:var(--bg); color:var(--ink); font:inherit; font-size:13px; }
textarea { resize:vertical; line-height:1.45; }
.bar { display:flex; gap:10px; align-items:center; margin-bottom:18px; flex-wrap:wrap; }
.seg { display:flex; border:1px solid var(--line); border-radius:9px; overflow:hidden; }
.seg button { border:0; border-radius:0; padding:8px 14px; font-size:13px; }
.seg button.on { background:var(--red); color:#fff; }
.chips { display:flex; gap:7px; flex-wrap:wrap; margin:-6px 0 18px; }
.chips button { padding:5px 12px; font-size:12px; font-weight:650; border-radius:999px;
  letter-spacing:.02em; }
.chips button.on { background:var(--blue); border-color:var(--blue); color:#fff; }
.chips button .n { opacity:.6; font-weight:500; margin-left:5px; }
dialog { border:1px solid var(--line); border-radius:16px; background:var(--panel); color:var(--ink);
  padding:0; width:min(620px,93vw); max-height:88vh; box-shadow:var(--shadow); }
dialog::backdrop { background:rgba(10,10,25,.5); }
.dlg-head { padding:20px 24px 14px; border-bottom:1px solid var(--line); }
.dlg-body { padding:18px 24px; overflow:auto; max-height:52vh; display:grid; gap:12px; }
.dlg-foot { padding:14px 24px; border-top:1px solid var(--line);
  display:flex; gap:10px; justify-content:flex-end; align-items:center; flex-wrap:wrap; }
.row { display:flex; gap:10px; padding:7px 0; border-bottom:1px dashed var(--line);
  font-size:14px; align-items:center; }
.row:last-child { border-bottom:0; }
.why { color:var(--dim); font-size:12.5px; }
pre.log { background:var(--bg); border:1px solid var(--line); border-radius:10px;
  padding:12px 14px; font-size:12.5px; margin:0; white-space:pre-wrap; max-height:220px; overflow:auto; }
.note { background:var(--bg); border-left:3px solid var(--gold); padding:12px 14px;
  border-radius:0 9px 9px 0; font-size:13.5px; }
.note.bad { border-left-color:var(--bad); }
.empty { color:var(--dim); padding:56px 0; text-align:center; }
.empty .ball { width:46px; height:46px; margin:0 auto 18px; border-width:3px; }
.empty .ball::after { width:15px; height:15px; border-width:3px; }
code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.92em; }
#toast { display:none; padding:11px 28px; font-size:13.5px; font-weight:600;
  border-bottom:1px solid var(--line); background:var(--panel); }
</style>
</head>
<body>
<header>
  <h1 class="wordmark"><span class="ball"></span><span class="a">poke</span><span class="b">pack</span></h1>
  <div class="playing"><span class="lbl">Playing</span><span class="who" id="who">…</span></div>
  <span style="flex:1"></span>
  <button id="play" class="primary">▶ Play</button>
  <button id="new">New pack</button>
  <button id="export">Export…</button>
  <button id="settings" class="ghost">Settings</button>
</header>
<nav>
  <button id="tab-packs" class="on">My packs<span class="count" id="c-packs">0</span></button>
  <button id="tab-mods">Mods<span class="count" id="c-mods">–</span></button>
  <button id="tab-browse">Community<span class="count" id="c-browse">0</span></button>
</nav>
<div id="toast"></div>
<main>
  <div id="pane-mods" hidden>
    <div class="bar">
      <div class="seg" id="mod-filter">
        <button data-f="installed" class="on">In this pack</button>
        <button data-f="available">Add mods</button>
        <button data-f="all">All</button>
      </div>
      <input id="mods-q" placeholder="Search mods…" style="flex:1;min-width:200px">
      <button id="mods-zip">Add a mod…</button>
      <button id="mods-refresh">Refresh</button>
      <span class="dim" id="mods-meta"></span>
    </div>
    <div class="chips" id="mods-cats"></div>
    <div class="grid" id="mods-grid"></div>
  </div>
  <div class="grid" id="grid"></div>
  <div class="empty" id="empty" hidden></div>
</main>

<dialog id="dlg">
  <div class="dlg-head"><h2 id="d-title" style="margin:0;font-size:18px"></h2>
    <div class="dim" id="d-sub"></div></div>
  <div class="dlg-body" id="d-body"></div>
  <div class="dlg-foot"><span class="dim" id="d-note"></span><span style="flex:1"></span>
    <button id="d-alt" hidden></button>
    <button id="d-close">Close</button><button class="primary" id="d-go">OK</button></div>
</dialog>

<script>
const TOKEN = ${JSON.stringify(token)};
const api = (p, q = '') => '/api/' + p + '?token=' + TOKEN + q;
let S = null, CAT = null, tab = 'packs', filter = 'installed';
// Ticked categories. A set, and matched any-of, because picking UI and ART
// means "show me both kinds" -- almost nothing is tagged with both.
const cats = new Set();

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const hue = (id) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360; return h; };
const strip = (id) => 'linear-gradient(90deg,hsl(' + hue(id) + ' 70% 52%),hsl(' + ((hue(id)+42)%360) + ' 70% 44%))';

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

async function load() {
  S = await (await fetch(api('state'))).json();
  document.getElementById('who').textContent = S.active ?? 'nothing yet';
  document.getElementById('c-packs').textContent = S.instances.length;
  document.getElementById('c-browse').textContent = (S.gallery ?? []).length;
  render();
}

// ------- My packs

function renderPacks() {
  const list = S.instances;
  if (list.length === 0) {
    return '<div class="empty"><div class="ball"></div><b>No setups yet.</b><br>'
      + 'Press <b>New pack</b> to make one, or install a shared pack from <b>Browse</b>.</div>';
  }
  return '<div class="grid">' + list.map(i => {
    const on = i.identity === S.active;
    const enabled = i.modList.filter(m => m.enabled).length;
    return '<div class="card pick' + (on ? ' active' : '') + '" data-act-inst="' + esc(i.identity) + '">'
      + '<div class="strip" style="background:' + strip(i.identity) + '"></div>'
      + '<div class="body"><h2>' + esc(i.identity) + '</h2>'
      + '<div class="sum why">' + i.mods + ' mod' + (i.mods === 1 ? '' : 's')
      + (i.mods ? ' \\u00b7 ' + enabled + ' on' : '') + '</div>'
      + '<div class="badges">'
      + (on ? '<span class="badge active">playing</span>' : '')
      + (i.isDefault ? '<span class="badge">default save</span>' : '')
      + (i.fromPacks.length ? '<span class="badge">from ' + esc(i.fromPacks[0]) + '</span>' : '')
      + (i.hasGameData ? '' : '<span class="badge broken">no game data</span>')
      + '</div><div class="acts">'
      + '<span class="why">' + (on ? 'playing now' : 'click to play this one') + '</span>'
      + '<span style="flex:1"></span>'
      + (enabled
          ? '<button class="ghost sm" data-export-inst="' + esc(i.identity) + '">Export\\u2026</button>'
            + '<button class="ghost sm" data-publish="' + esc(i.identity) + '">Publish\\u2026</button>'
          : '')
      // The game's own save folder gets no Delete button: it is where a plain
      // launch writes, so removing it is never what somebody meant.
      + (i.isDefault ? '' : '<button class="ghost sm" data-del-inst="' + esc(i.identity) + '">Delete</button>')
      + '</div></div></div>';
  }).join('') + '</div>';
}

const size = (n) => (n >= 1073741824
  ? (n / 1073741824).toFixed(1) + ' GB' : Math.max(1, Math.round(n / 1048576)) + ' MB');

// Deleting a setup takes save files with it, so the confirmation names what is
// actually in there rather than asking "are you sure?" about an unknown.
async function confirmDeleteInstance(identity) {
  const p = await (await fetch(api('instance/preview', '&identity=' + encodeURIComponent(identity)))).json();
  if (p.error) return toast(p.error, true);
  if (!p.canDelete) {
    return dialog({
      title: 'Keeping "' + identity + '"',
      body: '<div class="note bad">' + esc(p.reason) + '</div>', go: null,
    });
  }

  const bits = [];
  if (p.mods.length) bits.push(p.mods.length + ' mod' + (p.mods.length === 1 ? '' : 's'));
  if (p.saves.length) bits.push(p.saves.length + ' save file' + (p.saves.length === 1 ? '' : 's'));
  if (p.romVersions.length) bits.push(p.romVersions.join(' + ') + ' game data');
  bits.push(p.files + ' files \\u00b7 ' + size(p.bytes));

  dialog({
    title: 'Delete "' + esc(identity) + '"?',
    sub: 'The whole setup goes \\u2014 its mods, its saves and its settings.',
    body: '<div class="note bad"><b>' + esc(bits.join(' \\u00b7 ')) + '</b>'
      + (p.mods.length ? '<br><span class="why">' + esc(p.mods.join(', ')) + '</span>' : '')
      + '</div>'
      + (p.saves.length
          ? '<div class="note bad"><b>There is progress saved in here.</b> '
            + p.saves.length + ' save file' + (p.saves.length === 1 ? '' : 's')
            + ' belong' + (p.saves.length === 1 ? 's' : '') + ' to this setup and no other. '
            + 'Nothing else on this machine has a copy.</div>'
          : '')
      + (p.isActive ? '<div class="note">This is the one you are playing. Deleting it '
          + 'switches you to another setup.</div>' : '')
      + '<div class="note"><b>Nothing is erased.</b> The folder moves to<br>'
      + '<code>' + esc(p.trash) + '</code><br>'
      + '<span class="why">Drag it back into ' + esc(p.path.replace(/[^\\\\/]+$/, '')) + ' to undo this completely.</span></div>'
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
      tab = 'packs';
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

// Somebody sent you a pack.  Two ways in, because a pack arrives either as a
// file in a chat window or as a link -- and both end at the same place: the
// recipe is checked before it is kept, then you decide whether to install it.
function importPack() {
  dialog({
    title: 'Import a pack',
    sub: 'A .pokepack file, or a link to one.',
    body: '<div style="display:flex;gap:8px;align-items:center">'
      + '<button id="i-file" style="flex:none">Choose a file\\u2026</button>'
      + '<span class="why">from your downloads, wherever they sent it</span></div>'
      + '<div class="why" style="text-align:center">or</div>'
      + field('i-url', 'Paste a link', '', 'https://\\u2026/kanto-3d.pokepack')
      + '<div class="note">It gets checked before it is kept \\u2014 the same check a pack off '
      + 'the internet gets. Coming from someone you know does not make it safe; '
      + 'what it downloads still has to be pinned and still comes from the mod authors.</div>'
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
    // Already having it is the ordinary case when a friend sends an update.
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
  toast('Imported "' + data.name + '" \\u2014 ' + data.mods + ' mod' + (data.mods === 1 ? '' : 's')
    + (data.unpinned.length ? ', ' + data.unpinned.length + ' unpinned' : ', all pinned') + '.');
  tab = 'browse';
  await load();
  showPack(data.id); // straight to what it contains, so Install is one click away
}

// Publishing one of your setups: export it as a pack, then send that for
// review.  One action, because "export then find the file then share it" is
// three steps for what is obviously one intention.
function publishInstance(identity) {
  const inst = S.instances.find(i => i.identity === identity);
  if (!inst) return toast('no such setup', true);
  const on = inst.modList.filter(m => m.enabled);

  dialog({
    title: 'Publish "' + identity + '"',
    sub: on.length + ' mod' + (on.length === 1 ? '' : 's') + ' switched on will be included.',
    body: field('pb-name', 'Pack name', identity)
      + field('pb-author', 'Your name', '')
      + '<label>What is it for?<br><input id="pb-summary" placeholder="Voxel battles tuned for two players"></label>'
      + '<label>Anything the reviewer should know<br>'
      + '<textarea id="pb-note" rows="3" placeholder="What you tested, how long you played, '
      + 'and any setting that looks like a typo but is the point."></textarea></label>'
      + '<div class="note">Publishing downloads each mod once to lock its exact bytes, then opens '
      + 'GitHub with the pack filled in. It goes to the review branch \\u2014 nothing is live until '
      + 'it is merged.</div>'
      + '<div id="pb-out"></div>',
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

// Submitting a pack to the gallery.
//
// The whole PR happens on github.com: this only opens the right link, which
// carries the filename and the file's contents.  GitHub does the forking, the
// commit and the pull request, so nobody needs git installed or a clone.
async function sharePack(id, extra = {}) {
  const r = await (await fetch(api('pack/share', '&id=' + encodeURIComponent(id)))).json();
  if (r.needsRepo) {
    toast(r.error, true);
    return openSettings();
  }
  if (r.error) return toast(r.error, true);

  dialog({
    title: 'Publish "' + r.name + '"',
    sub: 'Sends it to ' + r.repo + ' for review.',
    body: '<div class="note">Opening this fills in a new file on GitHub with your pack '
      + 'already in it. Press <b>Propose new file</b> there and it becomes a pull request. '
      + 'GitHub makes your own copy of the repo for you \\u2014 nothing is installed and '
      + 'you need no git.</div>'
      // GitHub's new-file page has its own message box and nothing in the link
      // can fill it in, so hand the text over to be pasted rather than pretend.
      + (extra.note
          ? '<div><div class="why" style="margin-bottom:6px">Paste this into the description on GitHub:</div>'
            + '<textarea id="sh-note" rows="3" readonly>' + esc(extra.note) + '</textarea>'
            + '<button class="sm" id="sh-copy" style="margin-top:6px">Copy it</button></div>'
          : '')
      + ((extra.warnings ?? []).length
          ? '<pre class="log">' + extra.warnings.map(esc).join('\\n') + '</pre>' : '')
      + (r.unpinned.length
          ? '<div class="note bad"><b>' + r.unpinned.length + ' mod'
            + (r.unpinned.length === 1 ? ' is' : 's are') + ' unpinned.</b> '
            + 'Unpinned packs are not merged \\u2014 without a checksum nobody can tell later '
            + 'whether they got the files you tested. Export again with '
            + '<b>Pin to exact bytes</b> ticked first.</div>'
          : '<div class="note">Every mod is pinned. That is the main thing review checks for.</div>')
      + (r.tooLong
          ? '<div class="note bad">This pack is too big to send as a link (' + r.length
            + ' characters). Open a pull request by hand and add the file from <code>packs/</code>.</div>'
          : '')
      + '<div class="why">It will land on the review branch, not the live one. '
      + 'Merging is what makes it visible to everybody \\u2014 no one has to update anything.</div>',
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
        // Clipboard access can be refused; selecting it is just as good.
        document.getElementById('sh-note').select();
        copy.textContent = 'Selected \\u2014 press Ctrl+C';
      }
    };
  }
}

// Deleting the shareable file, which is a much smaller thing than deleting a
// setup -- worth saying so, or the warning teaches people to click through.
function confirmDeletePack(id, name) {
  dialog({
    title: 'Delete the "' + name + '" pack file?',
    sub: 'That is the recipe, not a setup you play.',
    body: '<div class="note">Any setup you already installed from it keeps working exactly as it is. '
      + 'Only the shareable file goes, and it moves to <code>packs/.trash</code> rather than being erased.</div>'
      + field('dp-name', 'Type ' + id + ' to confirm', '')
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

// ------- Community (packs published in the gallery)

// Community packs: the ones published in the gallery, and nothing of yours.
//
// Kept apart from My packs deliberately.  They answer different questions --
// "what has somebody else made" versus "what am I playing" -- and mixing them
// made the browse list a pile of things with no shared meaning.
function renderCommunity() {
  const bar = '<div class="bar"><button class="primary" data-import="1">Import a pack\\u2026</button>'
    + '<span class="dim">A <code>.pokepack</code> file or link somebody sent you.</span>'
    + '<span style="flex:1"></span>'
    + '<span class="dim">' + (S.gallery ?? []).length + ' published</span>'
    + '</div>';

  const all = [...(S.gallery ?? [])]
    .sort((a, b) => ((b.votes ?? 0) - (a.votes ?? 0))
      || (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1));

  if (all.length === 0) {
    // Distinguishes "the gallery is empty" from "we could not reach it", which
    // otherwise look identical and send you looking for the wrong problem.
    return bar + '<div class="empty"><div class="ball"></div>'
      + '<b>Nothing published yet, or the gallery could not be reached.</b><br>'
      + 'Be first \\u2014 press <b>Publish</b> on one of your packs.</div>';
  }
  return bar + '<div class="grid">' + all.map(p =>
    '<div class="card pick" data-pack="' + esc(p.id) + '">'
    + '<div class="strip" style="background:' + strip(p.id) + '"></div>'
    + '<div class="body"><h2>' + esc(p.name) + '</h2>'
    + '<div class="why">' + (p.author ? 'by ' + esc(p.author) : '&nbsp;') + '</div>'
    + '<div class="sum">' + esc(p.summary || '\\u2014') + '</div>'
    + '<div class="badges">'
    + (p.votes ? '<span class="badge ready">\\u25b2 ' + p.votes + '</span>' : '')
    + '<span class="badge">' + p.modCount + ' mod' + (p.modCount === 1 ? '' : 's') + '</span>'
    + (p.disable.length ? '<span class="badge">' + p.disable.length + ' off</span>' : '')
    + (p.mods.every(m => m.pinned) ? '' : '<span class="badge work">unpinned</span>')
    + (p.status === 'broken' ? '<span class="badge broken">broken</span>' : '')
    + '</div>'
    + '<div class="acts"><span class="why">click to install</span>'
    + '<span style="flex:1"></span>'
    + (p.thread
        ? '<a class="why" href="' + esc(p.thread) + '" target="_blank" rel="noopener">'
          + '\\u25b2 ' + (p.votes ?? 0) + ' \\u00b7 discuss \\u2197</a>'
        : '')
    + '</div>'
    + '</div></div>').join('') + '</div>';
}

// ------- Mods (scoped to the active instance)

async function loadMods(force) {
  const q = document.getElementById('mods-q').value.trim();
  document.getElementById('mods-meta').textContent = 'loading\\u2026';
  const res = await fetch(api('catalogue', '&q=' + encodeURIComponent(q)
    + '&filter=' + filter + '&category=' + encodeURIComponent([...cats].join(','))
    + (force ? '&refresh=1' : '')));
  CAT = await res.json();
  if (!res.ok) { document.getElementById('mods-meta').textContent = CAT.error || 'could not load'; return; }

  // Chips come from what is actually in the index, so a category added upstream
  // appears without a release here.  Hidden when there is nothing to filter by
  // -- a pack whose mods are all unlisted has no categories, and an empty row
  // of buttons reads as broken rather than as "none".
  const catBar = document.getElementById('mods-cats');
  catBar.hidden = (CAT.categories ?? []).length === 0;
  catBar.innerHTML =
    (cats.size ? '<button data-cat="">Clear</button>' : '')
    + (CAT.categories ?? []).map(c =>
      '<button data-cat="' + esc(c.name) + '"' + (cats.has(c.name) ? ' class="on"' : '') + '>'
      + esc(c.name.replace(/_/g, ' ')) + '<span class="n">' + c.count + '</span></button>').join('');
  document.getElementById('c-mods').textContent = CAT.installedCount;
  document.getElementById('mods-q').placeholder = filter === 'installed'
    ? 'Search this pack\\u2019s mods\\u2026' : 'Search ' + CAT.total + ' mods\\u2026';
  document.getElementById('mods-meta').textContent =
    (filter === 'installed' ? CAT.mods.length + ' in ' + (CAT.active ?? 'nothing')
     : filter === 'available' ? CAT.mods.length + ' available to add'
     : CAT.mods.length + ' shown \\u00b7 for ' + (CAT.active ?? 'nothing'))
    + (CAT.stale ? ' \\u00b7 offline copy' : '');
  document.getElementById('mods-grid').innerHTML = CAT.mods.map(m => {
    const behind = m.installedVersion && m.latestVersion && m.installedVersion !== m.latestVersion;
    return '<div class="card"><div class="strip" style="background:' + strip(m.id) + '"></div>'
      + '<div class="body"><h2>' + esc(m.title) + '</h2>'
      + '<div class="why">' + (m.author ? 'by ' + esc(m.author) : '&nbsp;') + '</div>'
      + '<div class="sum">' + esc(m.summary || '\\u2014') + '</div>'
      + '<div class="badges">'
      + (m.installedVersion ? '<span class="badge active">installed ' + esc(m.installedVersion) + '</span>' : '')
      + (behind ? '<span class="badge work">' + esc(m.latestVersion) + ' available</span>'
         : !m.installedVersion && m.latestVersion ? '<span class="badge">' + esc(m.latestVersion) + '</span>' : '')
      + (m.unlisted ? '<span class="badge">not in the index</span>'
         : m.installable ? '' : '<span class="badge broken">no download</span>')
      // What the game would refuse to load, said here instead of in there.
      + (m.missing ?? []).map(d =>
          '<span class="badge broken">needs ' + esc(d.id) + '</span>').join('')
      + (m.wrongVersion ?? []).map(d =>
          '<span class="badge broken">needs ' + esc(d.id) + ' ' + esc(d.range)
          + ', have ' + esc(d.have ?? '?') + '</span>').join('')
      + (m.clashes ?? []).map(c =>
          '<span class="badge broken">clashes with ' + esc(c) + '</span>').join('')
      + (m.categories ?? []).slice(0,2).map(c => '<span class="badge">' + esc(c) + '</span>').join('')
      + '</div><div class="acts">'
      + (m.installedVersion && m.enabled !== null
          ? '<button class="sm' + (m.enabled ? ' on' : '') + '" data-mod="' + esc(m.id)
            + '" data-do="' + (m.enabled ? 'disable' : 'enable') + '">' + (m.enabled ? 'On' : 'Off') + '</button>'
          : '')
      + (m.installedVersion
          ? '<button class="danger sm" data-mod="' + esc(m.id) + '" data-do="remove">Remove</button>'
          : m.installable
            ? '<button class="primary sm" data-mod="' + esc(m.id) + '" data-do="install">Install</button>' : '')
      + (behind && m.installable
          ? '<button class="sm" data-mod="' + esc(m.id) + '" data-do="update">Update</button>' : '')
      + '<span style="flex:1"></span>'
      + (m.github ? '<a class="why" href="https://github.com/' + esc(m.github)
          + '" target="_blank" rel="noopener">repo \\u2197</a>' : '')
      + '</div></div></div>';
  }).join('');
}

function render() {
  for (const [id, name] of [['tab-packs','packs'],['tab-mods','mods'],['tab-browse','browse']]) {
    document.getElementById(id).classList.toggle('on', tab === name);
  }
  document.getElementById('pane-mods').hidden = tab !== 'mods';
  const grid = document.getElementById('grid');
  grid.hidden = tab === 'mods';
  document.getElementById('empty').hidden = true;
  if (tab === 'packs') grid.innerHTML = renderPacks();
  else if (tab === 'browse') grid.innerHTML = renderCommunity();
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
  // A second action, for the one that does not belong on the main button --
  // deleting the file you are looking at, say.
  const a = document.getElementById('d-alt');
  a.hidden = !alt;
  if (alt) {
    a.textContent = alt.label;
    a.className = alt.danger ? 'danger' : '';
    a.onclick = alt.onClick;
  }
  // One dialog element serves every screen, so a dialog opened *from* a dialog
  // would otherwise throw rather than replace it.
  if (!dlg.open) dlg.showModal();
}

function field(id, label, value, placeholder) {
  return '<label>' + esc(label) + '<br><input id="' + id + '" value="' + esc(value ?? '')
    + '" placeholder="' + esc(placeholder ?? '') + '"></label>';
}
const val = (id) => document.getElementById(id).value.trim();

// ------- actions

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
    sub: 'A fresh, isolated setup with no mods. Add them from the Mods tab.',
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
        + (data.gameData.how === 'copied' ? ' Game data copied in — ready to play.'
          : data.gameData.how === 'rom' ? ' Your ' + data.gameData.label
            + ' ROM was copied in; the game imports it once on first launch.'
          : ' No game data — ' + data.gameData.reason + '.'));
      tab = 'mods';
      await load();
      loadMods(false);
    },
  });
};

document.getElementById('export').onclick = () => exportInstance(S.active);

function exportInstance(identity) {
  const inst = S.instances.find(i => i.identity === identity);
  if (!inst) return toast('nothing to export', true);
  const on = inst.modList.filter(m => m.enabled);
  dialog({
    title: 'Export "' + inst.identity + '" as a pack',
    sub: on.length + ' mod' + (on.length === 1 ? '' : 's') + ' switched on will be included.',
    body: field('e-name', 'Pack name', inst.identity)
      + field('e-author', 'Author', '')
      + field('e-summary', 'Summary', '')
      + '<label style="font-size:13.5px"><input type="checkbox" id="e-pin" checked style="width:auto"> '
      + 'Pin to exact bytes (downloads each mod once)</label>'
      + '<div class="why">' + on.map(m => esc(m.id)).join(', ') + '</div>'
      + '<div id="e-out"></div>',
    go: 'Export',
    onGo: async () => {
      const b = document.getElementById('d-go');
      b.disabled = true; b.textContent = document.getElementById('e-pin').checked ? 'Downloading\\u2026' : 'Writing\\u2026';
      const { ok, data } = await post('instance/export', {
        name: val('e-name'), author: val('e-author'), summary: val('e-summary'),
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
        + '<div class="acts"><button class="sm" data-share="' + esc(data.id) + '">Share this pack\\u2026</button>'
        + '<span class="why">send it to the gallery for review</span></div>';
      b.textContent = 'Exported';
      load();
    },
  });
};

async function openSettings() {
  const s = S.settings;
  dialog({
    title: 'Settings',
    sub: 'Two things, set once.',
    body: '<div><div class="why" style="margin-bottom:6px">gen1recomp.exe — needed to Play</div>'
      + '<div style="display:flex;gap:8px"><input id="s-exe" value="' + esc(s.gamePath ?? '') + '">'
      + '<button id="s-exe-b" style="flex:none">Browse…</button></div>'
      + '<div class="why" id="s-exe-msg"></div></div>'
      + '<div><div class="why" style="margin-bottom:6px">Your ROM (.gb) — copied into each new setup</div>'
      + '<div style="display:flex;gap:8px"><input id="s-rom" value="' + esc(s.romPath ?? '') + '">'
      + '<button id="s-rom-b" style="flex:none">Browse…</button></div>'
      + '<div class="why" id="s-rom-msg"></div></div>'
      + '<div class="why">Checked against the known Red / Blue / Yellow checksums. Never uploaded.</div>'
      + '<div style="border-top:1px solid var(--line);padding-top:14px">'
      + '<div class="why" style="margin-bottom:6px">Community packs come from</div>'
      + '<div><code style="word-break:break-all">' + esc(s.packIndexUrl) + '</code></div>'
      + '<div class="why" style="margin-top:8px">and <b>Publish</b> sends yours to <code>'
      + esc(s.submitRepo) + '</code></div>'
      + '<div class="why" style="margin-top:8px">Both are fixed in the build rather than settings. '
      + 'A pack list decides what gets installed, so it should not be repointable from a text box \\u2014 '
      + 'change it in <code>src/packfeed.js</code> and restart.</div></div>'
      + '<div class="why">Your paths are saved in ' + esc(s.configPath) + '</div>',
    note: '',
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

// What a shared recipe actually contains, before you commit to it.
async function showPack(id) {
  const p = await (await fetch(api('pack', '&id=' + encodeURIComponent(id)))).json();
  if (p.error) return toast(p.error, true);

  const bytes = p.mods.reduce((n, m) => n + (m.size || 0), 0);
  const unpinned = p.mods.filter(m => !m.pinned);

  const rows = p.mods.map(m =>
    '<div class="row"><span style="flex:1">'
    + '<span style="font-weight:650">' + esc(m.title) + '</span> '
    + '<span class="why">' + esc(m.version ?? '') + (m.author ? ' \\u00b7 ' + esc(m.author) : '') + '</span>'
    + (m.summary ? '<br><span class="why">' + esc(m.summary) + '</span>' : '')
    + (Object.keys(m.options).length
        ? '<br><span class="why">settings: '
          + esc(Object.entries(m.options).map(([k, v]) => k + '=' + v).join(', ')) + '</span>'
        : '')
    + (m.notes ? '<br><span class="why">note: ' + esc(m.notes) + '</span>' : '')
    + '<br><span class="why">'
    + (m.pinned ? 'pinned ' + esc(m.sha256.slice(0, 12)) + '\\u2026' : 'UNPINNED')
    + (m.host ? ' \\u00b7 from ' + esc(m.host) : '')
    + (m.listed ? '' : ' \\u00b7 not in the index')
    + '</span></span>'
    + (m.haveVersion
        ? '<span class="badge' + (m.haveVersion === m.version ? ' ready' : ' work') + '">'
          + (m.haveVersion === m.version ? 'you have it' : 'you have ' + esc(m.haveVersion)) + '</span>'
        : '')
    + '</div>').join('');

  dialog({
    title: p.name,
    sub: (p.author ? 'by ' + p.author + ' \\u00b7 ' : '') + (p.summary || ''),
    body: '<div>' + rows + '</div>'
      + (p.disable.length
          ? '<div class="note"><b>Switches off:</b> ' + esc(p.disable.join(', '))
            + '<br><span class="why">A tested combination includes what must be off.</span></div>'
          : '')
      + (unpinned.length
          ? '<div class="note bad"><b>' + unpinned.length + ' mod'
            + (unpinned.length === 1 ? ' is' : 's are') + ' unpinned.</b> '
            + 'Without a checksum there is no way to tell later whether you got the same files '
            + 'the author tested.</div>'
          : '')
      + '<div class="acts">'
      + (p.origin === 'local'
          ? '<button class="sm" data-share="' + esc(p.id) + '">Share this pack\\u2026</button>' : '')
      + (p.thread
          ? '<a class="why" href="' + esc(p.thread) + '" target="_blank" rel="noopener">'
            + '\\u25b2 ' + p.votes + ' \\u00b7 discussion \\u2197</a>'
          : '')
      + '</div>'
      + '<div class="why">'
      + (p.engine ? 'engine ' + esc(p.engine) + ' \\u00b7 ' : '')
      + (p.strict ? 'strict \\u2014 will not activate half-resolved' : 'loose')
      + (p.createdAt ? ' \\u00b7 made ' + esc(p.createdAt.slice(0, 10)) : '')
      + ' \\u00b7 ' + esc(p.file) + '</div>',
    note: bytes ? 'download ' + (bytes / 1048576).toFixed(1) + ' MB' : '',
    go: 'Install as new setup',
    onGo: () => installPack(p.id),
    // Only a file on this machine can be deleted from here; a gallery listing
    // is somebody else's.
    alt: p.origin === 'local'
      ? { label: 'Delete file', danger: true, onClick: () => confirmDeletePack(p.id, p.name) }
      : null,
  });
}

// Activate an instance by clicking its card; open a recipe by clicking its.
document.getElementById('grid').addEventListener('click', async (e) => {
  // Checked first: the Delete button sits inside a card that is otherwise
  // click-to-play, and clicking it must not also switch to that setup.
  const del = e.target.closest('[data-del-inst]');
  if (del) return confirmDeleteInstance(del.dataset.delInst);
  const pub = e.target.closest('[data-publish]');
  if (pub) return publishInstance(pub.dataset.publish);
  const exp = e.target.closest('[data-export-inst]');
  if (exp) return exportInstance(exp.dataset.exportInst);
  if (e.target.closest('[data-import]')) return importPack();
  if (e.target.closest('[data-settings]')) return openSettings();
  const share = e.target.closest('[data-share]');
  if (share) return sharePack(share.dataset.share);
  const recipe = e.target.closest('[data-pack]');
  if (recipe) return showPack(recipe.dataset.pack);
  const card = e.target.closest('[data-act-inst]');
  if (!card) return;
  const { ok, data } = await post('activate', { identity: card.dataset.actInst });
  if (!ok) return toast(data.error, true);
  await load();
  if (CAT) loadMods(false);
  toast('Now playing "' + data.active + '".');
});

function installPack(id) {
  dialog({
    title: 'Install as a new setup',
    sub: 'It gets its own mods, saves and settings — nothing existing is touched.',
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
          tab = 'packs';
          await load();
        }
      };
      src.onerror = () => { src.close(); put('connection closed'); b.textContent = 'Failed'; };
    },
  });
}

// Mod actions, delegated so buttons survive a re-render.
document.getElementById('mods-grid').addEventListener('click', async (e) => {
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

  // The mod needs something else, or fights something already here.  Asked
  // before anything downloads rather than found out by the game later.
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
    sub: missing.length
      ? 'It depends on ' + missing.length + ' other mod' + (missing.length === 1 ? '' : 's') + '.'
      : 'It conflicts with something you already have.',
    body: (missing.length
        ? '<div>' + missing.map(d =>
            '<div class="row"><span style="flex:1"><b>' + esc(d.title) + '</b> '
            + '<span class="why">' + esc(d.id) + (d.range ? ' ' + esc(d.range) : '') + '</span></span>'
            + (d.installable
                ? '<span class="badge ready">will install ' + esc(d.version ?? '') + '</span>'
                : '<span class="badge broken">not in the index</span>') + '</div>').join('') + '</div>'
        : '')
      + (data.clashes?.length
          ? '<div class="note bad"><b>Clashes with ' + data.clashes.map(esc).join(', ') + '.</b><br>'
            + 'Two mods that replace the same thing cannot both run \\u2014 the game will refuse '
            + 'to load one of them. Remove the other first if you want this one.</div>'
          : '')
      + (stuck.length
          ? '<div class="note bad">' + stuck.map(d => esc(d.id)).join(', ')
            + ' cannot be fetched \\u2014 not in the index. You would have to add it yourself with '
            + '<b>Add .zip\\u2026</b>, and until then the game will not load '
            + esc(data.title) + '.</div>'
          : '')
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

let modsTimer = null;
document.getElementById('mods-q').addEventListener('input', () => {
  clearTimeout(modsTimer);
  modsTimer = setTimeout(() => loadMods(false), 200);
});
// Add a mod the index has never heard of: a file, or a link.
//
// The link matters more than it looks.  A mod installed from a file on your
// disk cannot be published -- export can pin its hash but has nowhere to point
// anybody else -- whereas one installed from a release page carries its URL
// into every pack you make from it.
document.getElementById('mods-zip').onclick = () => {
  dialog({
    title: 'Add a mod',
    sub: 'For anything the index does not list.',
    body: '<label>Link to a GitHub release, or straight to a .zip<br>'
      + '<input id="az-url" placeholder="https://github.com/owner/repo/releases/tag/v1.8.2"></label>'
      + '<div class="note">A link is the one that can be shared. The exact file and its checksum '
      + 'are recorded, so a pack you export can point other people at it.</div>'
      + '<div class="why" style="text-align:center">or</div>'
      + '<div style="display:flex;gap:8px;align-items:center">'
      + '<button id="az-file" style="flex:none">Choose a file\\u2026</button>'
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
    // Already installed is the ordinary case when iterating on your own build.
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
document.getElementById('mods-refresh').onclick = () => loadMods(true);
document.getElementById('mod-filter').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-f]');
  if (!b) return;
  filter = b.dataset.f;
  for (const x of document.querySelectorAll('#mod-filter button')) x.classList.toggle('on', x === b);
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

document.getElementById('tab-packs').onclick = () => { tab = 'packs'; render(); };
document.getElementById('tab-browse').onclick = () => { tab = 'browse'; render(); };
document.getElementById('tab-mods').onclick = () => { tab = 'mods'; render(); loadMods(false); };
document.getElementById('d-close').onclick = () => dlg.close();
// Buttons inside a dialog body, which is rebuilt every time it opens.
document.getElementById('d-body').addEventListener('click', (e) => {
  const share = e.target.closest('[data-share]');
  if (share) return sharePack(share.dataset.share);
});

load();
</script>
</body>
</html>`;
}
