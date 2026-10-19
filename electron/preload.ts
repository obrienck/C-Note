import { contextBridge, ipcRenderer } from 'electron';
import type { CNoteBridge, Library, ScanProgress } from '../src/shared/types';

function subscribe<T>(channel: string, cb: (v: T) => void) {
  const listener = (_e: unknown, v: T) => cb(v);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

const bridge: CNoteBridge = {
  library: {
    get: () => ipcRenderer.invoke('library:get'),
    rescan: () => ipcRenderer.invoke('library:rescan'),
    onProgress: (cb) => subscribe<ScanProgress>('library:progress', cb),
    onChanged: (cb) => subscribe<Library>('library:changed', cb),
  },
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (patch) => ipcRenderer.invoke('config:set', patch),
    pickFolder: () => ipcRenderer.invoke('config:pickFolder'),
    testNextcloud: (cfg) => ipcRenderer.invoke('config:testNextcloud', cfg),
  },
  secrets: {
    has: (name) => ipcRenderer.invoke('secrets:has', name),
    set: (name, value) => ipcRenderer.invoke('secrets:set', name, value),
    clear: (name) => ipcRenderer.invoke('secrets:clear', name),
  },
  dossier: {
    all: () => ipcRenderer.invoke('dossier:all'),
    check: (s) => ipcRenderer.invoke('dossier:check', s),
    generate: (id, s) => ipcRenderer.invoke('dossier:generate', id, s),
    purge: () => ipcRenderer.invoke('dossier:purge'),
  },
  shell: {
    reveal: (location) => ipcRenderer.invoke('shell:reveal', location),
  },
};

contextBridge.exposeInMainWorld('cnote', bridge);
