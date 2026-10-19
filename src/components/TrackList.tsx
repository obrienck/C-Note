import { BarChart3, Play } from 'lucide-react';
import type { Album, Track } from '../shared/types';
import { formatShort, formatTime, pad2 } from '../lib/format';
import { useStore } from '../store';
import { PeakBars } from './instruments';
import { cx, Dot, Tag } from './ui';

export function TrackRow({
  album,
  track,
  index,
  dense,
  subtitle,
}: {
  album: Album;
  track: Track;
  index: number;
  dense?: boolean;
  subtitle?: string;
}) {
  const playingAlbum = useStore((s) => s.albumId);
  const trackIndex = useStore((s) => s.trackIndex);
  const isPlaying = useStore((s) => s.isPlaying);
  const playAlbum = useStore((s) => s.playAlbum);
  const current = playingAlbum === album.id && trackIndex === index;

  return (
    <li>
      <button
        type="button"
        disabled={!track.playable}
        title={track.playable ? undefined : 'This format can’t be decoded by the playback engine'}
        onClick={() => playAlbum(album.id, index)}
        aria-current={current ? 'true' : undefined}
        className={cx(
          'group grid w-full grid-cols-[2.25rem_1fr_auto_auto] items-center gap-3 rounded-[3px] px-3 text-left transition-colors',
          dense ? 'py-2.5' : 'py-3',
          current ? 'bg-elevated' : 'hover:bg-white/[0.025]',
          !track.playable && 'cursor-not-allowed opacity-45',
        )}
      >
        <span
          className={cx(
            'text-center',
            current ? 'font-serif text-[20px] leading-none text-brass-hi' : 'font-mono text-[11px] text-slate',
          )}
        >
          {current ? (track.trackNo ?? track.number) : pad2(track.trackNo ?? track.number)}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className={cx('truncate text-[15px]', current ? 'text-brass-hi' : 'text-parchment')}>{track.title}</span>
            {current && <Dot tone="brass" />}
          </span>
          {(subtitle || (current && dense)) && (
            <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[9.5px] tracking-[0.06em] text-slate">
              {current && dense && (
                <>
                  <Dot />
                  <span className="text-signal-soft">{formatShort(track.format)} · Live</span>
                </>
              )}
              {!current && subtitle}
            </span>
          )}
        </span>
        {!dense && <Tag className="hidden md:inline-flex">{formatShort(track.format)}</Tag>}
        <span className="flex items-center gap-3">
          <span className={cx('font-mono text-[11px] tracking-[0.08em] tabular', current ? 'text-brass-hi' : 'text-slate')}>
            {track.duration ? formatTime(track.duration, dense) : '—'}
          </span>
          <span className="grid w-4 place-items-center">
            {current && isPlaying ? (
              <PeakBars count={3} />
            ) : current ? (
              <BarChart3 className="size-3.5 text-brass" />
            ) : (
              <Play className="size-3 text-slate-dim opacity-0 transition-opacity group-hover:opacity-100" />
            )}
          </span>
        </span>
      </button>
    </li>
  );
}
