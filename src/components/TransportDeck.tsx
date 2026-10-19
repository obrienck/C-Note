import { Disc3, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Speaker, Volume1, Volume2, VolumeX } from 'lucide-react';
import { useRef, useState } from 'react';
import { seekTo } from '../audio/engine';
import { formatLong, formatTime, sourceLabel } from '../lib/format';
import { useCurrent, useStore } from '../store';
import { MiniLevels } from './instruments';
import { Sleeve } from './Sleeve';
import { cx, Fader, IconButton, Tag } from './ui';

function Scrubber() {
  const current = useCurrent();
  const position = useStore((s) => s.position);
  const duration = useStore((s) => s.duration) || current?.track.duration || 0;
  const bar = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const enabled = Boolean(current && duration);
  const pct = enabled ? Math.min(100, (position / duration) * 100) : 0;

  const at = (clientX: number) => {
    const r = bar.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * duration;
  };

  return (
    <div className="flex w-full items-center gap-4">
      <span className="w-12 text-right font-mono text-[11px] tracking-[0.06em] text-parchment/80 tabular">
        {enabled ? formatTime(position, true) : '--:--'}
      </span>
      <div
        ref={bar}
        role="slider"
        tabIndex={enabled ? 0 : -1}
        aria-label="Seek"
        aria-disabled={!enabled}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(position)}
        className={cx('group relative h-4 flex-1', enabled && 'cursor-pointer')}
        onPointerDown={(e) => {
          if (!enabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          seekTo(at(e.clientX));
        }}
        onPointerMove={(e) => {
          if (!enabled) return;
          setHover(at(e.clientX));
          if (e.buttons) seekTo(at(e.clientX));
        }}
        onPointerLeave={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') seekTo(Math.min(duration - 1, position + 5));
          if (e.key === 'ArrowLeft') seekTo(Math.max(0, position - 5));
        }}
      >
        <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-elevated" />
        <div
          className="absolute top-1/2 left-0 h-[3px] -translate-y-1/2 rounded-full bg-gradient-to-r from-brass-lo to-brass-hi"
          style={{ width: `${pct}%` }}
        />
        {enabled && (
          <div
            className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brass-hi opacity-0 shadow transition-opacity group-hover:opacity-100"
            style={{ left: `${pct}%` }}
          />
        )}
        {hover != null && (
          <span
            className="pointer-events-none absolute -top-6 -translate-x-1/2 rounded-sm bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-parchment"
            style={{ left: `${(hover / duration) * 100}%` }}
          >
            {formatTime(hover, true)}
          </span>
        )}
      </div>
      <span className="w-12 font-mono text-[11px] tracking-[0.06em] text-parchment/80 tabular">
        {enabled ? formatTime(duration, true) : '--:--'}
      </span>
    </div>
  );
}

export function TransportDeck() {
  const current = useCurrent();
  const s = useStore();
  const VolumeIcon = s.volume === 0 ? VolumeX : s.volume < 50 ? Volume1 : Volume2;
  const idle = !current;

  return (
    <footer className="relative z-30 grid h-[92px] shrink-0 grid-cols-[minmax(240px,1fr)_minmax(360px,1.3fr)_minmax(240px,1fr)] items-center gap-6 border-t border-black/70 bg-[#151517]/95 px-6 shadow-[0_-12px_40px_rgba(0,0,0,0.6)] backdrop-blur xl:px-10">
      {current ? (
        <button type="button" className="flex min-w-0 items-center gap-3 text-left" onClick={() => s.setView('now')} aria-label="Open Now Playing">
          <Sleeve album={current.album} className="size-14 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[15px] text-parchment">{current.track.title}</span>
              <Tag className="py-0.5 text-[9px]">{sourceLabel(current.track.source)}</Tag>
            </div>
            <div className="truncate text-[13px] text-parchment/70">{current.track.artist}</div>
            <div className={cx('truncate font-mono text-[10px] tracking-[0.06em]', s.playbackError ? 'text-clip' : 'text-signal-soft')}>
              {s.playbackError ?? (s.buffering ? 'Buffering…' : formatLong(current.track.format))}
            </div>
          </div>
        </button>
      ) : (
        <div className="flex items-center gap-3 text-slate">
          <span className="grid size-14 place-items-center rounded-[3px] border border-hairline bg-panel">
            <Disc3 className="size-6 text-slate-dim" />
          </span>
          <div>
            <div className="text-[15px] text-parchment/80">Nothing cued</div>
            <div className="font-mono text-[10px] tracking-[0.06em]">Choose a release from the index</div>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-3">
          <IconButton aria-label="Shuffle" aria-pressed={s.shuffle} active={s.shuffle} onClick={s.toggleShuffle}>
            <Shuffle className="size-[18px]" />
          </IconButton>
          <IconButton aria-label="Previous" onClick={s.previous} disabled={idle}>
            <SkipBack className="size-[18px]" />
          </IconButton>
          <button
            type="button"
            aria-label={s.isPlaying ? 'Pause' : 'Play'}
            onClick={s.togglePlay}
            disabled={idle}
            className="brushed-brass grid size-11 place-items-center rounded-md shadow-[0_6px_18px_-6px_rgba(229,195,150,0.7)] transition hover:brightness-105 active:translate-y-px disabled:opacity-40 disabled:shadow-none"
          >
            {s.isPlaying ? <Pause className="size-5" fill="currentColor" /> : <Play className="size-5 translate-x-px" />}
          </button>
          <IconButton aria-label="Next" onClick={() => s.next()} disabled={idle}>
            <SkipForward className="size-[18px]" />
          </IconButton>
          <IconButton aria-label={`Loop: ${s.loop}`} active={s.loop !== 'off'} onClick={s.cycleLoop}>
            {s.loop === 'one' ? <Repeat1 className="size-[18px]" /> : <Repeat className="size-[18px]" />}
          </IconButton>
        </div>
        <Scrubber />
      </div>

      <div className="flex items-center justify-end gap-4">
        <MiniLevels />
        <div className="flex w-28 items-center gap-2">
          <VolumeIcon className="size-4 shrink-0 text-parchment/80" />
          <Fader label="Volume" value={s.volume} min={0} max={100} onChange={s.setVolume} />
        </div>
        <button
          type="button"
          onClick={() => s.setView('engine')}
          title="Output device"
          className="flex max-w-44 items-center gap-2 rounded-sm border border-hairline bg-elevated px-3 py-2 font-mono text-[10px] tracking-[0.12em] text-parchment uppercase"
        >
          <Speaker className="size-3.5 shrink-0" />
          <span className="truncate">{s.outputLabel}</span>
        </button>
      </div>
    </footer>
  );
}
