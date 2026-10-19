import { Play } from 'lucide-react';
import type { Album } from '../shared/types';
import { formatShort } from '../lib/format';
import { useStore } from '../store';
import { Sleeve } from './Sleeve';
import { cx, Mono, Tag } from './ui';

/** Vinyl-jacket card used in discography rows and the library grid. */
export function ReleaseCard({
  album,
  selected,
  onSelect,
}: {
  album: Album;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const playAlbum = useStore((s) => s.playAlbum);
  const nowPlaying = useStore((s) => s.albumId === album.id);

  return (
    <div
      className={cx(
        'group relative rounded-md border bg-panel p-2.5 transition-colors',
        selected ? 'border-brass/50 bg-panel-hi' : 'border-hairline/70 hover:border-hairline',
      )}
    >
      <button
        type="button"
        onClick={onSelect ?? (() => playAlbum(album.id))}
        onDoubleClick={() => playAlbum(album.id)}
        className="block w-full text-left"
        aria-pressed={onSelect ? selected : undefined}
        title={onSelect ? 'Select · double-click to play' : 'Play release'}
      >
        <Sleeve album={album}>
          <Tag tone="dark" className="absolute top-2 left-2">
            {formatShort(album.format)}
          </Tag>
          <Tag tone="dark" className={cx('absolute right-2 bottom-2', album.source === 'local' ? 'text-parchment' : 'text-signal-soft')}>
            {album.source === 'nextcloud' ? 'Nextcloud' : album.source === 'local' ? 'Local' : 'Local + Cloud'}
          </Tag>
          {!nowPlaying && !onSelect && (
            <span className="brushed-brass absolute top-1/2 left-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              <Play className="size-4 translate-x-px" fill="currentColor" />
            </span>
          )}
        </Sleeve>
        <div className="mt-3 flex items-start justify-between gap-2 px-0.5">
          <Mono tone="brass" className="leading-4">
            {[album.year, album.label].filter(Boolean).join(' · ') || formatShort(album.format)}
          </Mono>
          <Mono tone="parchment" className="shrink-0 leading-4">
            {album.tracks.length} Trks
          </Mono>
        </div>
        <div className="mt-1.5 truncate px-0.5 text-[16px] text-parchment">{album.title}</div>
        <div className="truncate px-0.5 pb-1 text-[13px] text-slate">{album.artist}</div>
      </button>
    </div>
  );
}
