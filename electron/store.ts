import { app } from 'electron';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Everything C-Note persists lives under the per-user app data folder. */
export const dataDir = () => app.getPath('userData');
export const artDir = () => {
  const dir = join(dataDir(), 'art');
  mkdirSync(dir, { recursive: true });
  return dir;
};

export function readJson<T>(name: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(join(dataDir(), name), 'utf8')) as T;
  } catch {
    return fallback;
  }
}

/** Atomic write: a crash mid-save never leaves a truncated index. */
export function writeJson(name: string, value: unknown) {
  const file = join(dataDir(), name);
  writeFileSync(`${file}.tmp`, JSON.stringify(value));
  renameSync(`${file}.tmp`, file);
}
