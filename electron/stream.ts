import { protocol } from 'electron';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { Readable } from 'node:stream';
import { getConfig } from './config';
import { locate } from './library';
import { getSecret } from './secrets';
import { artDir } from './store';
import { authHeader, hrefUrl } from './webdav';

/*
 * cnote://track/<id>  — audio, local or proxied from Nextcloud, with Range
 *                       support so the <audio> element can seek.
 * cnote://art/<file>  — cached cover art.
 * CORS is open so WebAudio analysers can read the samples for the meters.
 */

const MIME: Record<string, string> = {
  '.flac': 'audio/flac',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.alac': 'audio/mp4',
  '.wav': 'audio/wav',
  '.aif': 'audio/aiff',
  '.aiff': 'audio/aiff',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges' };

export function registerScheme() {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'cnote', privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true } },
  ]);
}

async function serveFile(file: string, range: string | null): Promise<Response> {
  const { size } = await stat(file);
  const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
  const m = range?.match(/bytes=(\d*)-(\d*)/);
  if (!m) {
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
      headers: { ...CORS, 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes' },
    });
  }
  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
  const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  if (start >= size) return new Response(null, { status: 416, headers: { ...CORS, 'Content-Range': `bytes */${size}` } });
  return new Response(Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream, {
    status: 206,
    headers: {
      ...CORS,
      'Content-Type': type,
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
    },
  });
}

async function serveRemote(href: string, range: string | null): Promise<Response> {
  const nc = getConfig().nextcloud;
  const password = getSecret('nextcloudPassword');
  if (!nc || !password) return new Response('Nextcloud is not connected', { status: 503, headers: CORS });
  const upstream = await fetch(hrefUrl(nc, href), {
    headers: { Authorization: authHeader(nc, password), ...(range ? { Range: range } : {}) },
  });
  const headers = new Headers(CORS);
  for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has('content-type')) headers.set('content-type', MIME[extname(href).toLowerCase()] ?? 'application/octet-stream');
  return new Response(upstream.body, { status: upstream.status, headers });
}

export function handleProtocol() {
  protocol.handle('cnote', async (req) => {
    const url = new URL(req.url);
    const id = decodeURIComponent(url.pathname.replace(/^\//, ''));
    try {
      if (url.host === 'art') {
        const dir = artDir();
        const file = normalize(join(dir, id));
        if (!file.startsWith(dir)) return new Response(null, { status: 403 });
        return await serveFile(file, null);
      }
      if (url.host === 'track') {
        const loc = locate(id);
        if (!loc) return new Response('Unknown track', { status: 404, headers: CORS });
        const range = req.headers.get('range');
        return loc.source === 'local' ? await serveFile(loc.location, range) : await serveRemote(loc.location, range);
      }
    } catch (err) {
      return new Response(String(err), { status: 500, headers: CORS });
    }
    return new Response(null, { status: 404 });
  });
}
