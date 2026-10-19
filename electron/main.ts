import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AISettings, LibraryConfig, NextcloudConfig, ScanProgress, SecretName } from '../src/shared/types';
import { getConfig, setConfig } from './config';
import { allDossiers, checkProvider, generateDossier, purgeDossiers } from './dossier';
import { getLibrary, rebuild, scan } from './library';
import { clearSecret, getSecret, hasSecret, setSecret } from './secrets';
import { handleProtocol, registerScheme } from './stream';
import { list } from './webdav';

registerScheme();

let win: BrowserWindow | null = null;
let scanning: Promise<unknown> | null = null;
let syncTimer: NodeJS.Timeout | null = null;

const send = (channel: string, payload: unknown) => win?.webContents.send(channel, payload);

function rescan() {
  // Coalesce overlapping requests into the scan already running.
  scanning ??= scan(getConfig(), (p: ScanProgress) => send('library:progress', p))
    .then((lib) => {
      send('library:changed', lib);
      return lib;
    })
    .catch((err) => {
      send('library:progress', { phase: 'error', done: 0, total: 0, message: String(err?.message ?? err) });
      return getLibrary();
    })
    .finally(() => {
      scanning = null;
    });
  return scanning;
}

function scheduleSync() {
  if (syncTimer) clearInterval(syncTimer);
  const { nextcloud, autoSyncMin } = getConfig();
  if (nextcloud && autoSyncMin > 0) syncTimer = setInterval(rescan, autoSyncMin * 60_000);
}

function registerIpc() {
  ipcMain.handle('library:get', () => getLibrary());
  ipcMain.handle('library:rescan', () => rescan());

  ipcMain.handle('config:get', () => getConfig());
  ipcMain.handle('config:set', (_e, patch: Partial<LibraryConfig>) => {
    const before = getConfig();
    const next = setConfig(patch);
    if (patch.preferLocal !== undefined && patch.preferLocal !== before.preferLocal) {
      send('library:changed', rebuild(next.preferLocal));
    }
    if ('localFolders' in patch || 'nextcloud' in patch) void rescan();
    scheduleSync();
    return next;
  });
  ipcMain.handle('config:pickFolder', async () => {
    const r = await dialog.showOpenDialog(win!, { properties: ['openDirectory', 'multiSelections'], title: 'Add music folder' });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('config:testNextcloud', async (_e, cfg: NextcloudConfig) => {
    const password = getSecret('nextcloudPassword');
    if (!password) return { ok: false, message: 'Add an app password first.' };
    try {
      const entries = await list(cfg, password, cfg.root || '/');
      return { ok: true, message: `Connected · ${entries.length} items in ${cfg.root || '/'}` };
    } catch (err) {
      return { ok: false, message: String((err as Error).message ?? err) };
    }
  });

  ipcMain.handle('secrets:has', (_e, name: SecretName) => hasSecret(name));
  ipcMain.handle('secrets:set', (_e, name: SecretName, value: string) => setSecret(name, value));
  ipcMain.handle('secrets:clear', (_e, name: SecretName) => clearSecret(name));

  ipcMain.handle('dossier:all', () => allDossiers());
  ipcMain.handle('dossier:check', (_e, s: AISettings) => checkProvider(s));
  ipcMain.handle('dossier:generate', (_e, albumId: string, s: AISettings) => generateDossier(albumId, s));
  ipcMain.handle('dossier:purge', () => purgeDossiers());

  ipcMain.handle('shell:reveal', (_e, location: string) => {
    if (existsSync(location)) shell.showItemInFolder(location);
  });
}

function createWindow() {
  win = new BrowserWindow({
    title: 'C-Note',
    width: 1480,
    height: 980,
    minWidth: 1180,
    minHeight: 720,
    backgroundColor: '#0e0e10',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 28 },
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  win.once('ready-to-show', () => win?.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(join(import.meta.dirname, '../dist/index.html'));
  win.on('closed', () => {
    win = null;
  });
}

app.whenReady().then(() => {
  handleProtocol();
  rebuild(getConfig().preferLocal);
  registerIpc();
  createWindow();
  scheduleSync();
  const { localFolders, nextcloud } = getConfig();
  if (localFolders.length || nextcloud) void rescan();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
