import type { LibraryConfig } from '../src/shared/types';
import { readJson, writeJson } from './store';

const DEFAULTS: LibraryConfig = {
  localFolders: [],
  nextcloud: null,
  preferLocal: true,
  autoSyncMin: 15,
};

let config: LibraryConfig = { ...DEFAULTS, ...readJson<Partial<LibraryConfig>>('config.json', {}) };

export function getConfig(): LibraryConfig {
  return config;
}

export function setConfig(patch: Partial<LibraryConfig>): LibraryConfig {
  config = { ...config, ...patch };
  writeJson('config.json', config);
  return config;
}
