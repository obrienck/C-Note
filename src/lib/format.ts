import type { Album, AudioFormat, StorageSource, Track } from '../shared/types';

export function formatTime(seconds: number, pad = false): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  if (h) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${pad ? String(m).padStart(2, '0') : m}:${ss}`;
}

export function formatPrecise(seconds: number): string {
  const ms = Math.floor(((seconds || 0) % 1) * 1000);
  return `${formatTime(seconds, true)}.${String(ms).padStart(3, '0')}`;
}

export function isDsd(f: AudioFormat) {
  return /dsd|dsf|dff/i.test(f.codec);
}

/** Short codec name: "FLAC", "ALAC", "MP3", "DSD". */
export function codecName(f: AudioFormat): string {
  const c = f.codec.toUpperCase();
  if (c.includes('MPEG') && c.includes('3')) return 'MP3';
  if (c.includes('AAC') || c.includes('MP4A')) return 'AAC';
  if (c.includes('PCM') || c.includes('WAVE')) return 'PCM';
  if (isDsd(f)) return 'DSD';
  return c.split(/[\s/]/)[0];
}

const khz = (rate: number) => `${+(rate / 1000).toFixed(1)}`;

/** "96kHz / 24-bit FLAC" · "2.8MHz DSD" · "MP3 320 kbps" */
export function formatLong(f: AudioFormat): string {
  if (isDsd(f) && f.sampleRate) return `${(f.sampleRate / 1e6).toFixed(1)}MHz DSD`;
  if (!f.lossless && f.bitrate) return `${codecName(f)} ${Math.round(f.bitrate / 1000)} kbps`;
  const parts = [f.sampleRate && `${khz(f.sampleRate)}kHz`, f.bitDepth && `${f.bitDepth}-bit`].filter(Boolean);
  return parts.length ? `${parts.join(' / ')} ${codecName(f)}` : codecName(f);
}

/** Sticker form: "FLAC 24/96" · "DSD" · "MP3 320". */
export function formatShort(f: AudioFormat): string {
  if (isDsd(f)) return 'DSD';
  if (!f.lossless) return f.bitrate ? `${codecName(f)} ${Math.round(f.bitrate / 1000)}` : codecName(f);
  if (f.bitDepth && f.sampleRate) return `${codecName(f)} ${f.bitDepth}/${khz(f.sampleRate)}`;
  return codecName(f);
}

/** Spec sheet form: "FLAC · 96.0 kHz / 24-bit". */
export function formatSpec(f: AudioFormat): string {
  if (isDsd(f) && f.sampleRate) return `DSD · ${(f.sampleRate / 1e6).toFixed(4)} MHz / 1-bit`;
  const rate = f.sampleRate ? `${(f.sampleRate / 1000).toFixed(1)} kHz` : null;
  const depth = f.bitDepth ? `${f.bitDepth}-bit` : !f.lossless && f.bitrate ? `${Math.round(f.bitrate / 1000)} kbps` : null;
  return [codecName(f), [rate, depth].filter(Boolean).join(' / ')].filter(Boolean).join(' · ');
}

export function isHiRes(f: AudioFormat) {
  return isDsd(f) || (f.lossless && ((f.sampleRate ?? 0) > 48000 || (f.bitDepth ?? 0) > 16));
}

export function sourceLabel(s: StorageSource | 'mixed'): string {
  return s === 'nextcloud' ? 'Nextcloud' : s === 'local' ? 'Local' : 'Local + Nextcloud';
}

export function totalDuration(tracks: Track[]): number {
  return tracks.reduce((n, t) => n + (t.duration || 0), 0);
}

/**
 * Splits a running order into LP sides: by disc when the album has several,
 * otherwise at the track nearest the halfway point of the running time.
 */
export function sidesOf(album: Album): { label: string; tracks: { track: Track; index: number }[] }[] {
  const indexed = album.tracks.map((track, index) => ({ track, index }));
  const discs = [...new Set(album.tracks.map((t) => t.disc ?? 1))];
  if (discs.length > 1) {
    return discs.map((d) => ({ label: `Disc ${d}`, tracks: indexed.filter((x) => (x.track.disc ?? 1) === d) }));
  }
  if (indexed.length < 4) return [{ label: 'Side A', tracks: indexed }];
  const half = totalDuration(album.tracks) / 2;
  let acc = 0;
  let cut = indexed.length;
  for (let i = 0; i < indexed.length; i++) {
    acc += indexed[i].track.duration;
    if (acc >= half) {
      cut = i + 1;
      break;
    }
  }
  cut = Math.min(Math.max(cut, 1), indexed.length - 1);
  return [
    { label: 'Side A', tracks: indexed.slice(0, cut) },
    { label: 'Side B', tracks: indexed.slice(cut) },
  ];
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Deterministic palette for albums without cover art, keyed by album id. */
export function paletteFor(id: string) {
  const palettes = [
    { bg: '#d9692b', fg: '#f4ead8', accent: '#141414' },
    { bg: '#1f3f5c', fg: '#e8e3d9', accent: '#7fb2d9' },
    { bg: '#c9a54f', fg: '#1d1a14', accent: '#1d1a14' },
    { bg: '#5f7a52', fg: '#efe8d6', accent: '#1d2a1a' },
    { bg: '#e8d7b8', fg: '#3a1f12', accent: '#c4552a' },
    { bg: '#4a0f0f', fg: '#f1e6d2', accent: '#c23b2b' },
    { bg: '#20262b', fg: '#e8e3d9', accent: '#c8a97e' },
    { bg: '#b9c6cc', fg: '#1b2226', accent: '#e8e3d9' },
  ];
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { ...palettes[h % palettes.length], layout: (['split', 'type', 'orb', 'grid', 'portrait'] as const)[(h >>> 4) % 5] };
}
