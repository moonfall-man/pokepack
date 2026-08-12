// Native file and folder pickers.
//
// A web page cannot do this: <input type="file"> hands JavaScript a File
// object, never a filesystem path -- deliberately, and no amount of asking
// changes it.  But this hub's server is a normal local process, so it can open
// the real OS dialog and read back the real path.  That is the only reason the
// browser front end can offer "Browse…" at all.
//
// Every dialog is modal to the user and slow by nature (they have to find the
// file), so these are async with a generous timeout -- a picker somebody
// wandered away from must not wedge the server for good.

import { execFile } from 'node:child_process';

const TIMEOUT_MS = 5 * 60 * 1000;

function run(cmd, args) {
  return new Promise((resolvePromise) => {
    execFile(cmd, args, { timeout: TIMEOUT_MS, windowsHide: true }, (err, stdout) => {
      if (err) return resolvePromise(null);
      const out = String(stdout).trim();
      resolvePromise(out === '' ? null : out);
    });
  });
}

// Windows: WinForms dialogs.  -STA is required (the common dialogs are
// apartment-threaded), and an invisible TopMost owner form stops the dialog
// opening behind the browser window, which reads as "nothing happened".
function windowsScript(body) {
  return [
    '-NoProfile', '-STA', '-NonInteractive', '-Command',
    `Add-Type -AssemblyName System.Windows.Forms | Out-Null;
     $owner = New-Object System.Windows.Forms.Form -Property @{TopMost=$true; ShowInTaskbar=$false};
     ${body}`,
  ];
}

function psQuote(s) {
  return `'${String(s ?? '').replace(/'/g, "''")}'`;
}

/**
 * pickFile({ title, filter, initialDir }) -> absolute path | null
 *
 * filter is a Windows-style filter string; the other platforms get the
 * extension list pulled out of it.
 */
export async function pickFile({ title = 'Choose a file', filter = 'All files (*.*)|*.*', initialDir = null } = {}) {
  if (process.platform === 'win32') {
    return run('powershell.exe', windowsScript(
      `$d = New-Object System.Windows.Forms.OpenFileDialog;
       $d.Title = ${psQuote(title)};
       $d.Filter = ${psQuote(filter)};
       ${initialDir ? `if (Test-Path ${psQuote(initialDir)}) { $d.InitialDirectory = ${psQuote(initialDir)} };` : ''}
       if ($d.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $d.FileName }`,
    ));
  }

  if (process.platform === 'darwin') {
    // "of type" wants extensions; pull them out of the Windows filter string.
    const exts = [...String(filter).matchAll(/\*\.([A-Za-z0-9]+)/g)].map((m) => m[1])
      .filter((e) => e !== '*');
    const ofType = exts.length ? ` of type {${exts.map((e) => `"${e}"`).join(', ')}}` : '';
    return run('osascript', ['-e', `POSIX path of (choose file with prompt "${title}"${ofType})`]);
  }

  return run('zenity', ['--file-selection', `--title=${title}`]);
}

export async function pickFolder({ title = 'Choose a folder', initialDir = null } = {}) {
  if (process.platform === 'win32') {
    return run('powershell.exe', windowsScript(
      `$d = New-Object System.Windows.Forms.FolderBrowserDialog;
       $d.Description = ${psQuote(title)};
       $d.ShowNewFolderButton = $false;
       ${initialDir ? `if (Test-Path ${psQuote(initialDir)}) { $d.SelectedPath = ${psQuote(initialDir)} };` : ''}
       if ($d.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $d.SelectedPath }`,
    ));
  }

  if (process.platform === 'darwin') {
    return run('osascript', ['-e', `POSIX path of (choose folder with prompt "${title}")`]);
  }

  return run('zenity', ['--file-selection', '--directory', `--title=${title}`]);
}

export const FILTERS = {
  rom: 'Game Boy ROM (*.gb;*.gbc)|*.gb;*.gbc|All files (*.*)|*.*',
  exe: process.platform === 'win32'
    ? 'gen1recomp (gen1recomp*.exe)|gen1recomp*.exe|Programs (*.exe)|*.exe|All files (*.*)|*.*'
    : 'All files (*.*)|*.*',
  // A pack somebody sent you.  Chat apps rename attachments and browsers append
  // (1), so All files stays on the list rather than hiding the file they have.
  pack: 'Modpack (*.pokepack)|*.pokepack|All files (*.*)|*.*',
  zip: 'Mod archive (*.zip)|*.zip|All files (*.*)|*.*',
};
