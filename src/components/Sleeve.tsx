import { useState, type ReactNode } from 'react';
import type { Album } from '../shared/types';
import { paletteFor } from '../lib/format';
import { cx } from './ui';

/**
 * The album jacket as a physical object. Uses embedded or folder cover art
 * when the files carry it; otherwise sets the album's own title and artist
 * as a typographic sleeve so the slot is never empty.
 */
export function Sleeve({
  album,
  className,
  record,
  spinning,
  children,
  rounded = 'rounded-[3px]',
}: {
  album: Album;
  className?: string;
  /** Show the LP peeking out from the open end of the jacket. */
  record?: boolean;
  spinning?: boolean;
  children?: ReactNode;
  rounded?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showArt = album.art && !failed;

  return (
    <div className={cx('relative aspect-square', className)}>
      {record && <Record album={album} spinning={spinning} />}
      <div className={cx('sleeve-shadow grain relative isolate size-full overflow-hidden', rounded)}>
        {showArt ? (
          <img
            src={album.art}
            alt={`${album.title} — ${album.artist}`}
            className="size-full object-cover"
            draggable={false}
            onError={() => setFailed(true)}
          />
        ) : (
          <ProceduralSleeve album={album} />
        )}
        {/* Board edge wear and a soft sheen across the laminate. */}
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),inset_0_0_30px_rgba(0,0,0,0.35)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.07)_0%,transparent_35%,transparent_70%,rgba(0,0,0,0.18)_100%)]" />
        {children}
      </div>
    </div>
  );
}

function Record({ album, spinning }: { album: Album; spinning?: boolean }) {
  return (
    <div
      aria-hidden
      className={cx(
        'absolute top-[3%] right-[-18%] h-[94%] w-[94%] transition-transform duration-700',
        spinning ? 'translate-x-[2%]' : 'translate-x-[-12%]',
      )}
    >
      <div
        className={cx('size-full rounded-full', spinning && 'animate-spin-33')}
        style={{
          background: `radial-gradient(circle at 50% 50%, ${paletteFor(album.id).accent} 0 15%, #0b0b0c 15.3% 16.5%, transparent 16.6%),
            repeating-radial-gradient(circle at 50% 50%, #111113 0 1.1px, #1a1a1c 1.1px 2.2px)`,
          boxShadow: '0 10px 30px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        {/* Light catching the grooves. */}
        <div className="size-full rounded-full bg-[conic-gradient(from_30deg,transparent_0deg,rgba(255,255,255,0.08)_25deg,transparent_60deg,transparent_180deg,rgba(255,255,255,0.06)_210deg,transparent_240deg)]" />
      </div>
      <div className="absolute top-1/2 left-1/2 size-[2.2%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0b0b0c]" />
    </div>
  );
}

function ProceduralSleeve({ album }: { album: Album }) {
  const { layout, bg, fg, accent } = paletteFor(album.id);
  const ink = fg;
  const meta = (
    <div className="absolute right-[6%] bottom-[5%] left-[6%] flex justify-between font-mono text-[clamp(6px,1.6cqw,10px)] tracking-[0.14em] uppercase opacity-80">
      <span>{album.label ?? album.year}</span>
      <span>{album.catalog}</span>
    </div>
  );
  const base = 'absolute inset-0 overflow-hidden [container-type:size]';

  switch (layout) {
    case 'split':
      return (
        <div className={base} style={{ background: bg, color: fg }}>
          <div className="absolute inset-y-0 left-0 w-[16%]" style={{ background: accent }} />
          <div className="absolute top-[8%] right-[7%] left-[22%] font-sans font-bold leading-[0.92] tracking-tight uppercase text-[clamp(14px,11cqw,64px)]">
            {album.title}
          </div>
          <div className="absolute right-[7%] bottom-[14%] left-[22%] font-serif text-[clamp(8px,4.5cqw,22px)] italic opacity-90">
            {album.artist}
          </div>
          {meta}
        </div>
      );
    case 'type':
      return (
        <div className={base} style={{ background: bg, color: fg }}>
          <div className="absolute top-[7%] left-[7%] font-sans text-[clamp(8px,4.2cqw,20px)] font-semibold tracking-[0.18em] uppercase">
            {album.artist}
          </div>
          <div
            className="absolute right-[5%] bottom-[16%] left-[5%] whitespace-pre-line font-sans font-black leading-[0.82] tracking-[-0.03em] uppercase text-[clamp(22px,22cqw,130px)]"
            style={{ color: ink }}
          >
            {album.title.split(' ').slice(0, 3).join('\n')}
          </div>
          <div className="absolute top-[22%] right-[7%] size-[26%] rounded-full" style={{ background: accent, opacity: 0.85 }} />
          {meta}
        </div>
      );
    case 'orb':
      return (
        <div className={base} style={{ background: bg, color: fg }}>
          <div
            className="absolute top-[12%] left-1/2 size-[58%] -translate-x-1/2 rounded-full"
            style={{ background: `radial-gradient(circle at 35% 35%, ${accent}, ${accent}cc 55%, ${fg}22 100%)` }}
          />
          <div className="absolute right-[7%] bottom-[14%] left-[7%] text-center">
            <div className="font-serif text-[clamp(12px,9cqw,48px)] leading-none">{album.title}</div>
            <div className="mt-[2%] font-sans text-[clamp(7px,3.6cqw,16px)] tracking-[0.2em] uppercase opacity-80">
              {album.artist}
            </div>
          </div>
          {meta}
        </div>
      );
    case 'grid':
      return (
        <div className={base} style={{ background: bg, color: fg }}>
          <div className="absolute inset-[7%] bottom-[30%] grid grid-cols-3 grid-rows-3 gap-[3%]">
            {Array.from({ length: 9 }, (_, i) => (
              <div
                key={i}
                style={{ background: [0, 4, 8].includes(i) ? accent : i % 2 ? `${fg}22` : `${fg}10` }}
                className={i === 4 ? 'rounded-full' : ''}
              />
            ))}
          </div>
          <div className="absolute right-[7%] bottom-[13%] left-[7%]">
            <div className="font-sans text-[clamp(12px,8.5cqw,44px)] leading-none font-bold tracking-tight">{album.title}</div>
            <div className="mt-[1.5%] font-sans text-[clamp(7px,3.4cqw,15px)] tracking-[0.18em] uppercase opacity-75">
              {album.artist}
            </div>
          </div>
          {meta}
        </div>
      );
    case 'portrait':
    default: {
      const initials = album.artist
        .split(/\s+/)
        .filter((w) => /^[A-Z]/.test(w))
        .slice(0, 2)
        .map((w) => w[0])
        .join('');
      return (
        <div
          className={base}
          style={{ background: `radial-gradient(120% 90% at 30% 20%, ${accent}66, ${bg} 55%, #050506 100%)`, color: fg }}
        >
          <div className="absolute -right-[6%] -bottom-[14%] font-serif text-[clamp(60px,78cqw,420px)] leading-none italic opacity-20">
            {initials}
          </div>
          <div className="absolute top-[8%] right-[7%] left-[7%]">
            <div className="font-serif text-[clamp(12px,10cqw,56px)] leading-[0.95]">{album.title}</div>
            <div className="mt-[3%] font-sans text-[clamp(7px,3.6cqw,16px)] tracking-[0.2em] uppercase opacity-80">
              {album.artist}
            </div>
          </div>
          {meta}
        </div>
      );
    }
  }
}
