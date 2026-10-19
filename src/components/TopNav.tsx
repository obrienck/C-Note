import { Settings2 } from 'lucide-react';
import { formatLong } from '../lib/format';
import { useCurrent, useNativeRate, useStore, type View } from '../store';
import { PeakBars } from './instruments';
import { cx, Dot } from './ui';

const NAV: { id: View; label: string }[] = [
  { id: 'artists', label: 'Artists Index' },
  { id: 'now', label: 'Now Playing' },
  { id: 'discography', label: 'Discography' },
  { id: 'engine', label: 'Engine & Storage' },
];

const isMac = navigator.userAgent.includes('Mac');

export function Monogram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <circle cx="20" cy="20" r="18.5" fill="#1b1b1d" stroke="#3a3a3d" />
      {[15, 12, 9].map((r) => (
        <circle key={r} cx="20" cy="20" r={r} fill="none" stroke="#2c2c2f" strokeWidth="0.8" />
      ))}
      <circle cx="20" cy="20" r="4.5" fill="#c8a97e" />
      <circle cx="20" cy="20" r="1" fill="#131315" />
      {/* Tonearm */}
      <path d="M33 7 L26 17 L21.5 19" fill="none" stroke="#e5c396" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="33" cy="7" r="2" fill="#e5c396" />
    </svg>
  );
}

function sourcesLine(local: number, remote: boolean) {
  if (local && remote) return 'Nextcloud WebDAV & Local';
  if (remote) return 'Nextcloud WebDAV';
  if (local) return local === 1 ? 'Local Folder' : `${local} Local Folders`;
  return 'No sources connected';
}

export function TopNav() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const config = useStore((s) => s.config);
  const outputRate = useStore((s) => s.outputSampleRate);
  const outputLabel = useStore((s) => s.outputLabel);
  const isPlaying = useStore((s) => s.isPlaying);
  const current = useCurrent();
  const native = useNativeRate();
  const connected = Boolean(config && (config.localFolders.length || config.nextcloud));

  return (
    <header
      className={cx(
        'drag-region relative z-20 flex h-[76px] shrink-0 items-center gap-6 border-b border-black/60 bg-gradient-to-b from-[#18181a] to-canvas pr-6 xl:pr-10',
        isMac ? 'pl-[92px]' : 'pl-6 xl:pl-10',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Monogram className="size-10 shrink-0" />
        <div className="min-w-0">
          <span className="font-serif text-[22px] leading-none tracking-[0.08em] text-brass-hi">C-NOTE</span>
          <div className="mt-1.5 flex items-center gap-1.5 truncate font-mono text-[10px] tracking-[0.06em] text-parchment/80">
            <Dot tone={connected ? 'signal' : 'dim'} />
            <span className="truncate">
              {sourcesLine(config?.localFolders.length ?? 0, Boolean(config?.nextcloud))}
              {current && ` · ${formatLong(current.track.format)}`}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex shrink-0 rounded-md border border-hairline/70 bg-panel p-1" aria-label="Primary">
        {NAV.map((n) => (
          <button
            key={n.id}
            type="button"
            aria-current={view === n.id ? 'page' : undefined}
            onClick={() => setView(n.id)}
            className={cx(
              'rounded-[3px] px-4 py-2 text-[14px] whitespace-nowrap transition-colors',
              view === n.id
                ? 'bg-elevated text-brass-hi shadow-[0_1px_0_rgba(255,255,255,0.05)_inset,0_2px_8px_rgba(0,0,0,0.4)]'
                : 'text-parchment/80 hover:text-parchment',
            )}
          >
            {n.label}
          </button>
        ))}
      </nav>

      <div className="flex flex-1 items-center justify-end gap-4">
        <div className="hidden items-center gap-4 rounded-md border border-hairline/70 bg-panel px-4 py-2 lg:flex">
          <div>
            <div className="font-mono text-[9px] leading-3 tracking-[0.14em] text-parchment">
              {current ? (current.track.format.lossless ? 'LOSSLESS' : 'LOSSY') : 'IDLE'}
            </div>
            <div className="flex items-center gap-2">
              <span className={cx('font-mono text-[9px] leading-3 tracking-[0.14em]', native === false ? 'text-brass' : 'text-parchment')}>
                {native === null ? 'NO SIGNAL' : native ? 'NATIVE RATE' : 'RESAMPLED'}
              </span>
              {isPlaying && <PeakBars />}
            </div>
          </div>
          <div className="etched-v h-7" />
          <div className="max-w-56 text-right">
            <div className="truncate font-mono text-[9px] leading-3 tracking-[0.14em] text-brass-hi uppercase">Out: {outputLabel}</div>
            <div className="mt-0.5 flex items-center justify-end gap-1.5 font-mono text-[9px] leading-3 tracking-[0.14em] text-parchment">
              {outputRate ? `${+(outputRate / 1000).toFixed(1)} kHz` : 'Standby'}
              <Dot tone={outputRate ? 'signal' : 'dim'} />
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-label="Engine & Storage settings"
          className="brushed-brass grid size-9 place-items-center rounded-md"
          onClick={() => setView('engine')}
        >
          <Settings2 className="size-4" strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
