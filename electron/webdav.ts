import type { NextcloudConfig } from '../src/shared/types';

/*
 * Minimal Nextcloud WebDAV client. Nextcloud serves each user's files at
 *   {server}/remote.php/dav/files/{user}/...
 * and accepts an app password over HTTP Basic auth. Running in the main
 * process means no CORS configuration is needed on the server.
 */

export interface DavEntry {
  href: string;
  name: string;
  isDirectory: boolean;
  size: number;
  contentType: string;
  modified: string;
}

export function davRoot({ serverUrl, user }: NextcloudConfig): string {
  return `${serverUrl.replace(/\/$/, '')}/remote.php/dav/files/${encodeURIComponent(user)}`;
}

export function authHeader(cfg: NextcloudConfig, password: string) {
  return `Basic ${Buffer.from(`${cfg.user}:${password}`).toString('base64')}`;
}

/** Absolute URL for an href returned by PROPFIND. */
export function hrefUrl(cfg: NextcloudConfig, href: string) {
  return new URL(href, cfg.serverUrl).toString();
}

const PROPFIND_BODY = `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:resourcetype/><d:getcontentlength/><d:getcontenttype/><d:getlastmodified/></d:prop>
</d:propfind>`;

// Small, dependency-free parse of the multistatus response.
function parseMultistatus(xml: string): DavEntry[] {
  const blocks = xml.split(/<(?:\w+:)?response\b[^>]*>/).slice(1);
  const tag = (block: string, name: string) =>
    block.match(new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`))?.[1]?.trim() ?? '';
  return blocks.map((b) => {
    const href = tag(b, 'href');
    return {
      href,
      name: decodeURIComponent(href.replace(/\/$/, '').split('/').pop() ?? ''),
      isDirectory: /<(?:\w+:)?collection\s*\/?>/.test(b),
      size: Number(tag(b, 'getcontentlength') || 0),
      contentType: tag(b, 'getcontenttype'),
      modified: tag(b, 'getlastmodified'),
    };
  });
}

/** Lists one directory level (Depth: 1), excluding the directory itself. */
export async function list(cfg: NextcloudConfig, password: string, path: string): Promise<DavEntry[]> {
  const url = `${davRoot(cfg)}${path.split('/').map(encodeURIComponent).join('/')}`;
  const res = await fetch(url, {
    method: 'PROPFIND',
    headers: { Authorization: authHeader(cfg, password), Depth: '1', 'Content-Type': 'application/xml' },
    body: PROPFIND_BODY,
  });
  if (res.status === 401) throw new Error('Nextcloud rejected the credentials (401)');
  if (!res.ok) throw new Error(`PROPFIND ${path} → HTTP ${res.status}`);
  return parseMultistatus(await res.text()).slice(1);
}

/** Recursively collects files under `path`. */
export async function walk(cfg: NextcloudConfig, password: string, path: string, depth = 6): Promise<DavEntry[]> {
  const entries = await list(cfg, password, path);
  const files = entries.filter((e) => !e.isDirectory);
  if (depth === 0) return files;
  const nested = [];
  for (const d of entries.filter((e) => e.isDirectory)) {
    nested.push(...(await walk(cfg, password, `${path.replace(/\/$/, '')}/${d.name}`, depth - 1)));
  }
  return files.concat(nested);
}

/** Fetches the leading bytes of a file — enough for tags and embedded art. */
export async function readHead(cfg: NextcloudConfig, password: string, href: string, bytes: number): Promise<Uint8Array> {
  const res = await fetch(hrefUrl(cfg, href), {
    headers: { Authorization: authHeader(cfg, password), Range: `bytes=0-${bytes - 1}` },
  });
  if (!res.ok) throw new Error(`GET ${href} → HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}
