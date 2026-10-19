import { safeStorage } from 'electron';
import type { SecretName } from '../src/shared/types';
import { readJson, writeJson } from './store';

/*
 * API keys and the Nextcloud app password, encrypted with the OS keychain
 * (Keychain on macOS, DPAPI on Windows, libsecret on Linux). They never
 * cross into the renderer: it can only ask whether one is set.
 */

type Vault = Partial<Record<SecretName, string>>;

let vault: Vault = readJson<Vault>('secrets.json', {});

export function hasSecret(name: SecretName) {
  return Boolean(vault[name]);
}

export function getSecret(name: SecretName): string | undefined {
  const stored = vault[name];
  if (!stored) return undefined;
  try {
    return safeStorage.decryptString(Buffer.from(stored, 'base64'));
  } catch {
    return undefined;
  }
}

export function setSecret(name: SecretName, value: string) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS keychain encryption is unavailable');
  vault = { ...vault, [name]: safeStorage.encryptString(value).toString('base64') };
  writeJson('secrets.json', vault);
}

export function clearSecret(name: SecretName) {
  const { [name]: _removed, ...rest } = vault;
  vault = rest;
  writeJson('secrets.json', vault);
}
