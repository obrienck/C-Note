import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

/** Tiny letter-spaced monospace label: the console's engraved legend. */
export function Mono({
  children,
  className,
  tone = 'slate',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'slate' | 'dim' | 'brass' | 'signal' | 'parchment';
}) {
  const color = {
    slate: 'text-slate',
    dim: 'text-slate-dim',
    brass: 'text-brass',
    signal: 'text-signal-soft',
    parchment: 'text-parchment',
  }[tone];
  return (
    <span className={cx('font-mono text-[10px] leading-3 tracking-[0.12em] uppercase', color, className)}>
      {children}
    </span>
  );
}

export function Panel({
  children,
  className,
  style,
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: 'section' | 'div' | 'aside' | 'article';
}) {
  return (
    <Tag
      style={style}
      className={cx(
        'rounded-md border border-hairline/70 bg-panel shadow-[0_1px_0_rgba(255,255,255,0.025)_inset,0_10px_30px_-18px_rgba(0,0,0,0.9)]',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** Small engraved tag, e.g. "FLAC 24/96", "LOCAL". */
export function Tag({
  children,
  tone = 'plain',
  className,
}: {
  children: ReactNode;
  tone?: 'plain' | 'brass' | 'solid' | 'signal' | 'dark';
  className?: string;
}) {
  const tones = {
    plain: 'bg-elevated text-slate',
    brass: 'bg-brass/10 text-brass border border-brass/25',
    solid: 'brushed-brass',
    signal: 'bg-signal/10 text-signal-soft border border-signal/20',
    dark: 'bg-black/60 text-parchment backdrop-blur-sm',
  };
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-sm px-1.5 py-[3px] font-mono text-[10px] leading-3 tracking-[0.1em] uppercase whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = 'signal', pulse }: { tone?: 'signal' | 'brass' | 'clip' | 'dim'; pulse?: boolean }) {
  const c = { signal: 'bg-signal', brass: 'bg-brass', clip: 'bg-clip', dim: 'bg-slate-dim' }[tone];
  const glow = {
    signal: 'shadow-[0_0_6px_rgba(52,211,153,0.8)]',
    brass: 'shadow-[0_0_6px_rgba(200,169,126,0.7)]',
    clip: 'shadow-[0_0_6px_rgba(239,68,68,0.8)]',
    dim: '',
  }[tone];
  return <span className={cx('inline-block size-1.5 shrink-0 rounded-full', c, glow, pulse && 'animate-pulse')} />;
}

/** Hardware latching toggle. */
export function Toggle({
  on,
  onChange,
  label,
  tone = 'signal',
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  tone?: 'signal' | 'brass';
}) {
  const track = on ? (tone === 'signal' ? 'bg-signal-deep/70' : 'bg-brass-lo') : 'bg-elevated';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cx(
        'relative h-6 w-11 shrink-0 rounded-full border border-hairline transition-colors focus-visible:outline-2 focus-visible:outline-brass',
        track,
      )}
    >
      <span
        className={cx(
          'absolute top-0.5 size-[18px] rounded-full shadow-md transition-all',
          on ? 'left-[22px]' : 'left-0.5',
          on ? (tone === 'signal' ? 'bg-signal-soft' : 'bg-brass-hi') : 'bg-slate',
        )}
      />
    </button>
  );
}

/** Segmented selector (sort modes, source filters, VU reference …). */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  className,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={cx('flex rounded-md border border-hairline bg-obsidian p-0.5', className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 rounded-sm font-mono whitespace-nowrap uppercase tracking-[0.1em] transition-colors',
            size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-[10.5px]',
            o.value === value
              ? 'bg-elevated text-parchment shadow-[0_1px_0_rgba(255,255,255,0.05)_inset]'
              : 'text-slate hover:text-parchment',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Fader({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  className,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
  className?: string;
}) {
  const fill = `${((value - min) / (max - min)) * 100}%`;
  return (
    <input
      type="range"
      aria-label={label}
      className={cx('fader w-full', className)}
      min={min}
      max={max}
      step={step}
      value={value}
      style={{ '--fill': fill } as CSSProperties}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

export function IconButton({
  children,
  active,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'grid size-9 place-items-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-brass',
        active ? 'text-brass-hi' : 'text-slate hover:text-parchment',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Button({
  children,
  variant = 'ghost',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'brass' | 'ghost' | 'mono' }) {
  const v = {
    brass:
      'brushed-brass font-sans text-sm font-medium shadow-[0_6px_20px_-8px_rgba(229,195,150,0.6)] hover:brightness-105',
    ghost: 'bg-elevated text-parchment font-sans text-sm hover:bg-[#2e2e31] border border-hairline',
    mono: 'bg-elevated text-parchment font-mono text-[10.5px] uppercase tracking-[0.12em] hover:bg-[#2e2e31] border border-hairline',
  }[variant];
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 transition focus-visible:outline-2 focus-visible:outline-brass disabled:opacity-50',
        v,
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Label/value row used in spec sheets (Production Roll, Hardware Route …). */
export function SpecRow({ label, value, valueTone = 'brass' }: { label: ReactNode; value: ReactNode; valueTone?: 'brass' | 'parchment' | 'signal' }) {
  const tone = { brass: 'text-brass-hi', parchment: 'text-parchment', signal: 'text-signal-soft' }[valueTone];
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="font-mono text-[11px] tracking-[0.06em] text-slate">{label}</span>
      <span className={cx('text-right font-mono text-[11px] tracking-[0.06em]', tone)}>{value}</span>
    </div>
  );
}

export function SectionTitle({
  icon,
  children,
  aside,
}: {
  icon?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="flex items-center gap-3 font-serif text-[26px] leading-[34px] tracking-[-0.01em] text-parchment">
        {icon && <span className="text-brass">{icon}</span>}
        {children}
      </h2>
      {aside}
    </div>
  );
}
