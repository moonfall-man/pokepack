// Ask the game what it can actually see.
//
// The run log records mods, display and errors, and says nothing at all about
// controllers -- so "is the pad even reaching the game" was a question nobody
// could answer from out here. It cost more than half a day of ruling things
// out: Windows reported the pad healthy, the driver was fine, other games
// worked, and none of that says whether SDL inside THIS process enumerated it.
//
// The engine already has the hook for this. POKEPORT_DRIVER=file.lua loads a
// Lua file, calls it for a function, and resumes that function as a coroutine
// once per update with Game as its argument (main.lua:231). A driver can quit
// the game itself, which is what makes this a probe rather than a launch: one
// window, a few frames, an answer, gone.
//
// stdout is captured the same way a normal launch is. Windows buffers a GUI
// process's output until it exits, which is usually a nuisance and here is
// free: the probe exits on purpose, so the buffer flushes.

import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { checkGameExe } from './instance.js';

export const MARK = '[pokepack-pad]';

// Waits a beat before looking: SDL enumerates joysticks during init, but a pad
// connected while the window is coming up arrives as a hotplug a few frames
// later, and reporting "0 seen" because we asked too early would be worse than
// not asking.
// The report goes to a file as well as stdout, and the file is the one that
// matters. Windows buffers a GUI process's stdout until it exits, so a probe
// that hangs and gets killed prints nothing at all -- which is what the first
// two runs of this did, turning "the game could not answer" into a message
// that could not say why. A file is written as the answer is known.
export const DRIVER = `-- written by pokepack; safe to delete
local OUT = [==[__OUT__]==]
local function report(line)
  print(line)
  local f = io.open(OUT, "a")
  if f then f:write(line, "\\n") f:close() end
end

return function(Game)
  report("${MARK} driver started")
  for _ = 1, 90 do coroutine.yield() end

  local ok, list = pcall(function() return love.joystick.getJoysticks() end)
  if not ok then
    report("${MARK} love.joystick is not available: " .. tostring(list))
    love.event.quit()
    return
  end

  report(string.format("${MARK} count=%d", #list))
  for i, j in ipairs(list) do
    local function ask(fn, fallback)
      local good, value = pcall(fn)
      if good and value ~= nil then return value end
      return fallback
    end
    report(string.format(
      "${MARK} #%d name=%q guid=%s gamepad=%s connected=%s axes=%d buttons=%d hats=%d",
      i,
      tostring(ask(function() return j:getName() end, "?")),
      tostring(ask(function() return j:getGUID() end, "?")),
      tostring(ask(function() return j:isGamepad() end, false)),
      tostring(ask(function() return j:isConnected() end, false)),
      ask(function() return j:getAxisCount() end, 0),
      ask(function() return j:getButtonCount() end, 0),
      ask(function() return j:getHatCount() end, 0)))
  end

  -- A pad SDL has no mapping for is a joystick and not a gamepad, and the
  -- engine's input layer routes those differently -- worth saying out loud
  -- rather than leaving somebody to infer it from gamepad=false.
  for i, j in ipairs(list) do
    local good, isPad = pcall(function() return j:isGamepad() end)
    if good and not isPad then
      report(string.format("${MARK} #%d has no SDL gamepad mapping, so love.gamepadpressed will never fire for it", i))
    end
  end

  love.event.quit()
end
`;

/**
 * parse(text) -> { count, pads, available }
 *
 * Reads the probe's own lines back out of a run log.  Everything else in the
 * log is left alone -- this is one question, not a log reader.
 */
export function parse(text) {
  const lines = String(text ?? '').split(/\r?\n/).filter((l) => l.includes(MARK));
  if (lines.length === 0) return { available: false, count: null, pads: [], notes: [] };

  let count = null;
  const pads = [];
  const notes = [];
  for (const line of lines) {
    const c = /count=(\d+)/.exec(line);
    if (c) { count = Number(c[1]); continue; }
    const m = /#(\d+) name="(.*)" guid=(\S+) gamepad=(\w+) connected=(\w+) axes=(\d+) buttons=(\d+) hats=(\d+)/.exec(line);
    if (m) {
      pads.push({
        index: Number(m[1]),
        name: m[2],
        guid: m[3],
        gamepad: m[4] === 'true',
        connected: m[5] === 'true',
        axes: Number(m[6]),
        buttons: Number(m[7]),
        hats: Number(m[8]),
      });
      continue;
    }
    notes.push(line.slice(line.indexOf(MARK) + MARK.length).trim());
  }
  return { available: true, count: count ?? pads.length, pads, notes };
}

// SDL packs the USB ids into its GUID, which is how "the game sees a pad" and
// "the game sees the pad you are holding" stop being the same claim.
export function usbIds(guid) {
  if (typeof guid !== 'string' || guid.length < 20) return null;
  const le16 = (i) => parseInt(guid.slice(i + 2, i + 4) + guid.slice(i, i + 2), 16);
  const vendor = le16(8);
  const product = le16(16);
  if (!Number.isFinite(vendor) || !Number.isFinite(product) || (vendor === 0 && product === 0)) return null;
  const hex = (n) => n.toString(16).toUpperCase().padStart(4, '0');
  return { vendor: hex(vendor), product: hex(product) };
}

/**
 * run({ exePath, identity, timeoutMs }) -> Promise<{ ...parse(), raw, exitCode }>
 *
 * One window, opened and closed on purpose.  Not launchGame: that detaches and
 * returns immediately, which is right for playing and useless for asking a
 * question you need the answer to.
 */
export function run({ exePath, identity = null, version = 'red', timeoutMs = 45000 } = {}) {
  const check = checkGameExe(exePath);
  if (!check.ok) return Promise.reject(new Error(check.reason));

  const dir = mkdtempSync(join(tmpdir(), 'pokepack-probe-'));
  const driver = join(dir, 'pad-probe.lua');
  const log = join(dir, 'pad-probe.txt');
  // Lua long-bracket string, so a Windows path's backslashes need no escaping.
  writeFileSync(driver, DRIVER.replace('__OUT__', log));

  const env = { ...process.env, POKEPORT_DRIVER: driver };
  if (identity) env.POKEPORT_IDENTITY = identity;
  // Boot straight into the game. Without this the launcher screen is what
  // opens, and a launcher waiting to be clicked is a probe that times out --
  // which is exactly what the first run of this did.
  if (version) env.POKEPORT_GAME = version;
  else delete env.POKEPORT_GAME;

  // The file first, stdout only as a fallback: on Windows the pipe stays empty
  // until the process exits, so a probe that had to be killed has printed
  // nothing while the file already holds every line it reached.
  const readAnswer = () => {
    try {
      return existsSync(log) ? readFileSync(log, 'utf8') : '';
    } catch {
      return '';
    }
  };

  return new Promise((resolve, reject) => {
    const chunks = [];
    const child = spawn(check.path, [], { env, cwd: dirname(check.path), windowsHide: false });
    child.stdout?.on('data', (d) => chunks.push(d));
    child.stderr?.on('data', (d) => chunks.push(d));

    const finish = (code, timedOut) => {
      const fromFile = readAnswer();
      const raw = fromFile || Buffer.concat(chunks).toString('utf8');
      const out = { ...parse(raw), raw, exitCode: code, timedOut, log };
      // A timeout that still got an answer is not a failure -- the driver
      // reported and then something else kept the window open.
      if (timedOut && !out.available) {
        reject(new Error('the game did not answer within the time allowed.\n'
          + `       Nothing was written to ${log}, so the probe never ran -- the window is\n`
          + '       probably waiting on something (a ROM import, an update prompt).'));
        return;
      }
      resolve(out);
    };

    const timer = setTimeout(() => {
      child.kill();
      finish(null, true);
    }, timeoutMs);

    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => { clearTimeout(timer); finish(code, false); });
  });
}
