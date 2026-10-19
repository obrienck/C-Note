// Dev loop: Vite for the renderer (HMR), esbuild watch for main/preload,
// and Electron restarted whenever the main process bundle changes.
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const electronBin = require('electron');

const server = await createServer();
await server.listen();
const url = server.resolvedUrls.local[0];

const builder = spawn(process.execPath, ['scripts/build-electron.mjs', '--watch'], { stdio: 'inherit' });

let child = null;
let restartTimer = null;
function launch() {
  child = spawn(electronBin, ['.'], { stdio: 'inherit', env: { ...process.env, VITE_DEV_SERVER_URL: url } });
  child.on('exit', (code, signal) => {
    // Closing the window ends the dev session; a restart kills with SIGTERM.
    if (signal !== 'SIGTERM') shutdown(code ?? 0);
  });
}

function restart() {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    if (child) {
      child.removeAllListeners('exit');
      child.once('exit', launch);
      child.kill('SIGTERM');
    } else launch();
  }, 300);
}

function shutdown(code) {
  builder.kill();
  server.close().finally(() => process.exit(code));
}

// Wait for the first bundle, then relaunch on every rebuild.
const waitForBuild = setInterval(() => {
  try {
    require.resolve('../dist-electron/main.mjs');
    clearInterval(waitForBuild);
    launch();
    watch('dist-electron', (_e, file) => {
      if (file && !file.endsWith('.map')) restart();
    });
  } catch {
    /* not built yet */
  }
}, 200);

process.on('SIGINT', () => shutdown(0));
