import { createHash } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { parseBuffer, parseFile, type IAudioMetadata, type IPicture } from 'music-metadata';
import type { Album, Artist, AudioFormat, Library, LibraryConfig, ScanProgress, StorageSource, Track } from '../src/shared/types';
import { getSecret } from './secrets';
import { artDir, readJson, writeJson } from './store';
import * as dav from './webdav';

const AUDIO = /\.(flac|wav|aiff?|m4a|alac|mp3|ogg|oga|opus|dsf|dff|wv|ape)$/i;
// Chromium has no DSD, WavPack or Monkey's Audio decoder.
const UNPLAYABLE = /\.(dsf|dff|wv|ape)$/i;
const FOLDER_ART = /^(cover|folder|front|album)\.(jpe?g|png|webp)$/i;
// Leading bytes fetched from Nextcloud to read tags and embedded art.
const REMOTE_HEAD = 4 * 1024 * 1024;

/** What we keep per file; enough to rebuild the index without re-reading. */
interface FileMeta {
  title?: string;
  artist?: string;
  albumartist?: string;
  albumartistsort?: string;
  album?: string;
  year?: number;
  disc?: number;
  trackNo?: number;
  duration: number;
  composer?: string;
  bpm?: number;
  key?: string;
  isrc?: string;
  label?: string;
  catalog?: string;
  producer?: string;
  engineer?: string;
  genre?: string;
  comment?: string;
  format: AudioFormat;
  /** File name inside the art cache. */
  art?: string;
}

interface IndexEntry {
  source: StorageSource;
  location: string;
  size: number;
  modified: string;
  meta: FileMeta;
}

interface PersistedIndex {
  entries: Record<string, IndexEntry>;
  scannedAt?: string;
}

const hash = (s: string | Uint8Array) => createHash('sha1').update(s).digest('hex').slice(0, 16);
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

let index: PersistedIndex = readJson<PersistedIndex>('library.json', { entries: {} });
let library: Library = build(index, true);
/** trackId → where to stream it from. */
const locations = new Map<string, { source: StorageSource; location: string }>();
rebuildLocations();

export function getLibrary(): Library {
  return library;
}

export function locate(trackId: string) {
  return locations.get(trackId);
}

/* ---------- tag reading ---------- */

function cacheArt(pic: IPicture | undefined): string | undefined {
  if (!pic?.data?.length) return undefined;
  const ext = pic.format.includes('png') ? 'png' : pic.format.includes('webp') ? 'webp' : 'jpg';
  const name = `${hash(pic.data)}.${ext}`;
  const file = join(artDir(), name);
  if (!existsSync(file)) writeFileSync(file, pic.data);
  return name;
}

function toMeta(m: IAudioMetadata, fileName: string): FileMeta {
  const c = m.common;
  const f = m.format;
  const first = (v?: string[]) => v?.find(Boolean);
  return {
    title: c.title,
    artist: c.artist,
    albumartist: c.albumartist,
    albumartistsort: c.albumartistsort,
    album: c.album,
    year: c.year ?? (c.originaldate ? Number(c.originaldate.slice(0, 4)) : undefined),
    disc: c.disk?.no ?? undefined,
    trackNo: c.track?.no ?? undefined,
    duration: f.duration ?? 0,
    composer: first(c.composer),
    bpm: c.bpm ? Math.round(c.bpm) : undefined,
    key: c.key,
    isrc: first(c.isrc),
    label: first(c.label),
    catalog: first(c.catalognumber),
    producer: first(c.producer),
    engineer: first(c.engineer),
    genre: first(c.genre),
    comment: c.comment?.map((x) => x.text).find(Boolean),
    format: {
      codec: f.codec ?? f.container ?? extname(fileName).slice(1).toUpperCase(),
      sampleRate: f.sampleRate,
      bitDepth: f.bitsPerSample,
      channels: f.numberOfChannels,
      lossless: Boolean(f.lossless),
      bitrate: f.bitrate ? Math.round(f.bitrate) : undefined,
    },
  };
}

async function readLocal(file: string): Promise<FileMeta> {
  const m = await parseFile(file, { duration: true });
  const meta = toMeta(m, file);
  meta.art = cacheArt(m.common.picture?.[0]);
  return meta;
}

async function readRemote(cfg: NonNullable<LibraryConfig['nextcloud']>, password: string, e: dav.DavEntry): Promise<FileMeta> {
  const head = await dav.readHead(cfg, password, e.href, Math.min(REMOTE_HEAD, e.size || REMOTE_HEAD));
  const info = { mimeType: e.contentType || undefined, size: e.size, path: e.name };
  let m: IAudioMetadata;
  try {
    m = await parseBuffer(head, info, { duration: false });
  } catch {
    // Artwork larger than the fetched head truncates the tag block; read without it.
    m = await parseBuffer(head, info, { duration: false, skipCovers: true });
  }
  const meta = toMeta(m, e.name);
  meta.art = cacheArt(m.common.picture?.[0]);
  return meta;
}

/* ---------- scanning ---------- */

async function walkLocal(dir: string, out: string[] = []): Promise<string[]> {
  let items;
  try {
    items = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const item of items) {
    if (item.name.startsWith('.')) continue;
    const full = join(dir, item.name);
    if (item.isDirectory()) await walkLocal(full, out);
    else if (AUDIO.test(item.name)) out.push(full);
  }
  return out;
}

async function folderArtLocal(dir: string, cache: Map<string, string | undefined>) {
  if (cache.has(dir)) return cache.get(dir);
  let found: string | undefined;
  try {
    const name = (await readdir(dir)).find((n) => FOLDER_ART.test(n));
    if (name) {
      const data = await readFile(join(dir, name));
      found = cacheArt({ data, format: `image/${extname(name).slice(1)}` } as IPicture);
    }
  } catch {
    /* unreadable folder art is not fatal */
  }
  cache.set(dir, found);
  return found;
}

export async function scan(config: LibraryConfig, onProgress: (p: ScanProgress) => void): Promise<Library> {
  const next: Record<string, IndexEntry> = {};

  // Local folders.
  if (config.localFolders.length) {
    onProgress({ phase: 'listing', source: 'local', done: 0, total: 0 });
    const files = (await Promise.all(config.localFolders.map((d) => walkLocal(d)))).flat();
    const artCache = new Map<string, string | undefined>();
    let done = 0;
    for (const file of files) {
      try {
        const s = await stat(file);
        const modified = s.mtime.toISOString();
        const key = `local:${file}`;
        const prev = index.entries[key];
        const meta = prev && prev.size === s.size && prev.modified === modified ? prev.meta : await readLocal(file);
        meta.art ??= await folderArtLocal(dirname(file), artCache);
        next[key] = { source: 'local', location: file, size: s.size, modified, meta };
      } catch (err) {
        console.warn('[c-note] skipped', file, err);
      }
      if (++done % 10 === 0 || done === files.length) onProgress({ phase: 'reading', source: 'local', done, total: files.length });
    }
  }

  // Nextcloud.
  const nc = config.nextcloud;
  const password = getSecret('nextcloudPassword');
  if (nc && password) {
    onProgress({ phase: 'listing', source: 'nextcloud', done: 0, total: 0 });
    const all = await dav.walk(nc, password, nc.root || '/');
    const files = all.filter((e) => AUDIO.test(e.name));
    const artByDir = new Map<string, dav.DavEntry>();
    for (const e of all) if (FOLDER_ART.test(e.name)) artByDir.set(e.href.slice(0, e.href.lastIndexOf('/')), e);
    let done = 0;
    for (const e of files) {
      try {
        const key = `nextcloud:${e.href}`;
        const prev = index.entries[key];
        const meta = prev && prev.size === e.size && prev.modified === e.modified ? prev.meta : await readRemote(nc, password, e);
        if (!meta.art) {
          const artEntry = artByDir.get(e.href.slice(0, e.href.lastIndexOf('/')));
          if (artEntry) {
            const data = await dav.readHead(nc, password, artEntry.href, artEntry.size || 8 * 1024 * 1024);
            meta.art = cacheArt({ data, format: artEntry.contentType || 'image/jpeg' } as IPicture);
          }
        }
        next[key] = { source: 'nextcloud', location: e.href, size: e.size, modified: e.modified, meta };
      } catch (err) {
        console.warn('[c-note] skipped', e.href, err);
      }
      if (++done % 5 === 0 || done === files.length) onProgress({ phase: 'reading', source: 'nextcloud', done, total: files.length });
    }
  }

  index = { entries: next, scannedAt: new Date().toISOString() };
  writeJson('library.json', index);
  library = build(index, config.preferLocal);
  rebuildLocations();
  onProgress({ phase: 'done', done: Object.keys(next).length, total: Object.keys(next).length });
  return library;
}

/* ---------- index → artists / albums ---------- */

const formatRank = (f: AudioFormat) => (f.lossless ? 1e12 : 0) + (f.sampleRate ?? 0) * (f.bitDepth ?? 16);

function build(idx: PersistedIndex, preferLocal: boolean): Library {
  const groups = new Map<string, IndexEntry[]>();
  for (const e of Object.values(idx.entries)) {
    const m = e.meta;
    const albumArtist = m.albumartist || m.artist || 'Unknown Artist';
    const album = m.album || basename(dirname(e.location)) || 'Unknown Album';
    const key = `${norm(albumArtist)}|${norm(album)}`;
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }

  const artists = new Map<string, Artist>();
  const albums: Album[] = [];

  for (const [key, entries] of groups) {
    // The same recording on both sources: keep one copy.
    const byTrack = new Map<string, IndexEntry>();
    for (const e of entries) {
      const m = e.meta;
      const tkey = `${m.disc ?? 1}|${m.trackNo ?? ''}|${norm(m.title ?? basename(e.location))}`;
      const existing = byTrack.get(tkey);
      if (!existing || (existing.source !== e.source && (e.source === 'local') === preferLocal)) byTrack.set(tkey, e);
    }
    const chosen = [...byTrack.values()].sort(
      (a, b) =>
        (a.meta.disc ?? 1) - (b.meta.disc ?? 1) ||
        (a.meta.trackNo ?? 1e9) - (b.meta.trackNo ?? 1e9) ||
        a.location.localeCompare(b.location),
    );

    const lead = chosen[0].meta;
    const albumArtist = lead.albumartist || lead.artist || 'Unknown Artist';
    const artistId = hash(norm(albumArtist));
    if (!artists.has(artistId)) {
      artists.set(artistId, { id: artistId, name: albumArtist, sortName: lead.albumartistsort || albumArtist });
    }
    const albumId = hash(key);
    const pick = <K extends keyof FileMeta>(k: K) => chosen.map((e) => e.meta[k]).find((v) => v != null && v !== '') as FileMeta[K];

    const tracks: Track[] = chosen.map((e, i) => {
      const m = e.meta;
      const id = hash(`${e.source}:${e.location}`);
      return {
        id,
        albumId,
        title: m.title || basename(e.location, extname(e.location)),
        artist: m.artist || albumArtist,
        number: i + 1,
        disc: m.disc,
        trackNo: m.trackNo,
        duration: m.duration,
        composer: m.composer,
        bpm: m.bpm,
        key: m.key,
        isrc: m.isrc,
        format: m.format,
        source: e.source,
        location: e.location,
        playable: !UNPLAYABLE.test(e.location),
      };
    });
    const sources = new Set(tracks.map((t) => t.source));
    const art = pick('art');

    albums.push({
      id: albumId,
      title: lead.album || basename(dirname(chosen[0].location)),
      artist: albumArtist,
      artistId,
      year: pick('year'),
      label: pick('label'),
      catalog: pick('catalog'),
      producer: pick('producer'),
      engineer: pick('engineer'),
      genre: pick('genre'),
      comment: pick('comment'),
      art: art ? `cnote://art/${art}` : undefined,
      source: sources.size > 1 ? 'mixed' : [...sources][0],
      format: tracks.map((t) => t.format).sort((a, b) => formatRank(b) - formatRank(a))[0],
      tracks,
    });
  }

  return {
    artists: [...artists.values()].sort((a, b) => a.sortName.localeCompare(b.sortName)),
    albums: albums.sort((a, b) => a.artist.localeCompare(b.artist) || (a.year ?? 0) - (b.year ?? 0)),
    scannedAt: idx.scannedAt,
  };
}

function rebuildLocations() {
  locations.clear();
  for (const a of library.albums) for (const t of a.tracks) locations.set(t.id, { source: t.source, location: t.location });
}

/** Re-derives albums when a merge preference changes, without rescanning. */
export function rebuild(preferLocal: boolean) {
  library = build(index, preferLocal);
  rebuildLocations();
  return library;
}
