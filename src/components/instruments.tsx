import { useEffect, useRef, useState } from 'react';
import { readCorrelation, readLevels, readPeaks, readSpectrum, readWaveform, useSignalFrame } from '../audio/engine';
import { useStore } from '../store';
import { cx, Mono } from './ui';

/* ---------- canvas plumbing ---------- */

function useCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(([entry]) => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = entry.contentRect;
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
      size.current = { w: width, h: height, dpr };
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const ctx = () => {
    const c = ref.current?.getContext('2d');
    if (!c) return null;
    const { dpr } = size.current;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    return c;
  };
  return { ref, size, ctx };
}

const toDb = (amp: number) => (amp > 1e-5 ? 20 * Math.log10(amp) : -100);

/* ---------- Ballistic VU meter ---------- */

const VU_MIN = -20;
const VU_MAX = 3;
const SWEEP = (100 * Math.PI) / 180;
// VU scales are drawn linear in voltage, not in dB.
const scalePos = (vu: number) => {
  const v = Math.max(VU_MIN, Math.min(VU_MAX + 1, vu));
  return (10 ** (v / 20) - 10 ** (VU_MIN / 20)) / (10 ** (VU_MAX / 20) - 10 ** (VU_MIN / 20));
};

/**
 * One channel of the master VU pair. Needle dynamics follow a damped
 * spring tuned to the IEC 60268-17 300 ms integration with ~1% overshoot.
 */
export function VUMeter({ channel, label }: { channel: 0 | 1; label: string }) {
  const { ref, size, ctx } = useCanvas();
  const reference = useStore((s) => s.settings.vuReference);
  const needle = useRef({ pos: 0, vel: 0 });
  const readout = useRef<HTMLSpanElement>(null);
  const frame = useRef(0);

  useSignalFrame((_t, playing, dt) => {
    const c = ctx();
    if (!c) return;
    const { w, h } = size.current;
    if (w < 40 || h < 40) return;
    const vu = toDb(readLevels(playing)[channel]) - reference;
    const target = playing ? scalePos(vu) : 0;

    const k = (2 * Math.PI * 2.1) ** 2;
    const damp = 2 * 0.81 * Math.sqrt(k);
    const n = needle.current;
    for (let i = 0, steps = 4; i < steps; i++) {
      const h2 = dt / steps;
      n.vel += (k * (target - n.pos) - damp * n.vel) * h2;
      n.pos += n.vel * h2;
    }
    n.pos = Math.max(-0.02, Math.min(1.08, n.pos));

    // Throttle the text readout so it's legible.
    if (readout.current && ++frame.current % 8 === 0) {
      readout.current.textContent = playing && vu > VU_MIN ? `${vu >= 0 ? '+' : ''}${vu.toFixed(1)} VU` : '— VU';
    }

    c.clearRect(0, 0, w, h);
    const cxp = w / 2;
    const cy = h * 0.98;
    const r = Math.min(w * 0.42, h * 0.82);
    const angle = (p: number) => -Math.PI / 2 - SWEEP / 2 + p * SWEEP;

    // Scale arc: parchment to 0 VU, red above.
    c.lineCap = 'butt';
    c.lineWidth = 1.25;
    c.strokeStyle = 'rgba(232,227,217,0.45)';
    c.beginPath();
    c.arc(cxp, cy, r, angle(0), angle(scalePos(0)));
    c.stroke();
    c.lineWidth = 3.5;
    c.strokeStyle = 'rgba(239,68,68,0.75)';
    c.beginPath();
    c.arc(cxp, cy, r - 1, angle(scalePos(0)), angle(1));
    c.stroke();

    c.font = '500 9px "JetBrains Mono", monospace';
    c.textAlign = 'center';
    for (const mark of [-20, -10, -7, -5, -3, -1, 0, 1, 2, 3]) {
      const a = angle(scalePos(mark));
      const major = [-20, -10, -5, -1, 0, 3].includes(mark);
      const r1 = r + 2;
      const r2 = r + (major ? 11 : 6);
      c.strokeStyle = mark >= 0 ? 'rgba(239,68,68,0.85)' : 'rgba(232,227,217,0.7)';
      c.lineWidth = major ? 1.5 : 1;
      c.beginPath();
      c.moveTo(cxp + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      c.lineTo(cxp + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      c.stroke();
      if (major) {
        c.fillStyle = mark >= 0 ? 'rgba(239,140,130,0.95)' : 'rgba(142,141,146,0.95)';
        const rt = r + 20;
        c.fillText(mark > 0 ? `+${mark}` : String(mark), cxp + Math.cos(a) * rt, cy + Math.sin(a) * rt + 3);
      }
    }

    // Needle with a soft shadow, then the pivot cap.
    const a = angle(n.pos);
    const tipR = r + 8;
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(0,0,0,0.5)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(cxp + 3, cy + 2);
    c.lineTo(cxp + Math.cos(a) * tipR + 3, cy + Math.sin(a) * tipR + 2);
    c.stroke();
    c.strokeStyle = '#efe6d2';
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(cxp, cy);
    c.lineTo(cxp + Math.cos(a) * tipR, cy + Math.sin(a) * tipR);
    c.stroke();
    const g = c.createRadialGradient(cxp - 2, cy - 2, 1, cxp, cy, 9);
    g.addColorStop(0, '#5a5a5e');
    g.addColorStop(1, '#1b1b1d');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cxp, cy, 8, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#c8a97e';
    c.beginPath();
    c.arc(cxp, cy, 2.5, 0, Math.PI * 2);
    c.fill();
  });

  return (
    <div className="relative overflow-hidden rounded-md border border-hairline bg-[radial-gradient(120%_90%_at_50%_0%,#2b2620_0%,#1a1918_55%,#141415_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-30px_60px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between">
        <Mono tone="parchment">{label} · VU</Mono>
        <span className="font-mono text-[9px] tracking-[0.06em] text-slate">300 ms · IEC ballistics</span>
      </div>
      <canvas ref={ref} className="mx-auto mt-2 block h-[180px] w-full max-w-[400px]" aria-hidden />
      <div className="mt-3 flex items-center justify-between border-t border-hairline/80 pt-3">
        <Mono tone="parchment">
          Level: <span ref={readout} className="text-brass-hi tabular">— VU</span>
        </Mono>
        <Mono>
          0 VU = <span className="text-parchment">{reference} dBFS</span>
        </Mono>
      </div>
    </div>
  );
}

/** Sample peak with a 2 s hold, in dBFS (−Infinity when silent). */
export function usePeakHold(): number {
  const [peak, setPeak] = useState(-Infinity);
  const held = useRef({ value: -Infinity, at: 0 });
  useSignalFrame((t, playing) => {
    const [l, r] = readPeaks(playing);
    const p = toDb(Math.max(l, r));
    const h = held.current;
    if (p > h.value || t - h.at > 2) {
      h.value = p <= -90 ? -Infinity : p;
      h.at = t;
      setPeak(Number.isFinite(h.value) ? Math.round(h.value * 10) / 10 : -Infinity);
    }
  });
  return peak;
}

export function useCorrelation(): number | null {
  const [value, setValue] = useState<number | null>(null);
  const n = useRef(0);
  useSignalFrame((_t, playing) => {
    if (++n.current % 12) return;
    setValue(readCorrelation(playing));
  });
  return value;
}

/** Horizontal correlation bar, −1 (out of phase) … +1 (mono). */
export function PhaseMeter() {
  const c = useCorrelation();
  const v = c ?? 0;
  const pct = ((v + 1) / 2) * 100;
  return (
    <div className="flex items-center gap-3">
      <Mono>Phase Correlation</Mono>
      <div className="relative h-1.5 w-36 overflow-hidden rounded-full bg-obsidian">
        <div className="absolute top-0 left-1/2 h-full w-px bg-slate-dim" />
        <div
          className={cx('absolute top-0 h-full rounded-full', v < 0 ? 'bg-clip' : 'bg-signal-soft/80')}
          style={{ left: `${Math.min(50, pct)}%`, width: `${Math.abs(pct - 50)}%` }}
        />
      </div>
      <Mono tone={c == null ? 'dim' : v < 0 ? 'brass' : 'signal'}>
        {c == null ? 'No Signal' : `${v >= 0 ? '+' : ''}${v.toFixed(1)} ${v > 0.3 ? 'In-Phase' : v < 0 ? 'Out-of-Phase' : 'Wide'}`}
      </Mono>
    </div>
  );
}

/* ---------- Amber oscilloscope + FFT ---------- */

export function Oscilloscope({ className }: { className?: string }) {
  const { ref, size, ctx } = useCanvas();
  const wave = useRef(new Float32Array(240));
  const bands = useRef(new Float32Array(48));
  const smooth = useRef(new Float32Array(48));

  useSignalFrame((_t, playing) => {
    const c = ctx();
    if (!c) return;
    const { w, h } = size.current;
    c.clearRect(0, 0, w, h);

    // Graticule.
    c.strokeStyle = 'rgba(200,169,126,0.07)';
    c.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      c.beginPath();
      c.moveTo((w / 8) * i, 0);
      c.lineTo((w / 8) * i, h);
      c.stroke();
    }
    for (let i = 1; i < 4; i++) {
      c.beginPath();
      c.moveTo(0, (h / 4) * i);
      c.lineTo(w, (h / 4) * i);
      c.stroke();
    }

    // FFT bands behind the trace.
    readSpectrum(playing, bands.current);
    const bw = w / bands.current.length;
    for (let i = 0; i < bands.current.length; i++) {
      const s = (smooth.current[i] += (bands.current[i] - smooth.current[i]) * 0.25);
      const bh = s * h * 0.9;
      c.fillStyle = `rgba(229,195,150,${0.08 + s * 0.25})`;
      c.fillRect(i * bw + 1, h - bh, bw - 2, bh);
    }

    // Phosphor trace with glow.
    readWaveform(playing, wave.current);
    const trace = () => {
      c.beginPath();
      for (let i = 0; i < wave.current.length; i++) {
        const x = (i / (wave.current.length - 1)) * w;
        const y = h / 2 - wave.current[i] * h * 0.42;
        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
      c.stroke();
    };
    c.strokeStyle = 'rgba(229,195,150,0.25)';
    c.lineWidth = 4;
    trace();
    c.strokeStyle = '#e5c396';
    c.lineWidth = 1.25;
    trace();
  });

  return <canvas ref={ref} className={cx('block size-full', className)} aria-label="Realtime oscilloscope and FFT" />;
}

/* ---------- Small level indicators ---------- */

/** Stereo bar pair for the transport deck. */
export function MiniLevels() {
  const l = useRef<HTMLDivElement>(null);
  const r = useRef<HTMLDivElement>(null);
  const smooth = useRef([0, 0]);
  useSignalFrame((_t, playing) => {
    const lv = readLevels(playing);
    [l, r].forEach((el, i) => {
      const pos = Math.max(0, Math.min(1, (toDb(lv[i]) + 40) / 40));
      smooth.current[i] += (pos - smooth.current[i]) * 0.3;
      if (el.current) el.current.style.width = `${smooth.current[i] * 100}%`;
    });
  });
  return (
    <div className="flex w-20 flex-col gap-1.5 rounded-sm bg-obsidian px-2 py-1.5" aria-hidden>
      {[l, r].map((ref, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="font-mono text-[8px] text-slate">{i ? 'R' : 'L'}</span>
          <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-elevated">
            <div ref={ref} className="h-full rounded-full bg-gradient-to-r from-signal-deep via-signal-soft to-brass-hi" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Compact vertical bar cluster: the "dynamic peak monitor" glyph. */
export function PeakBars({ count = 5, className }: { count?: number; className?: string }) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const buf = useRef(new Float32Array(32));
  useSignalFrame((_t, playing) => {
    readSpectrum(playing, buf.current);
    bars.current.forEach((el, i) => {
      // Sample bands spread across the spectrum rather than the lowest few.
      const v = buf.current[Math.floor(((i + 0.5) / count) * buf.current.length)];
      if (el) el.style.height = `${Math.max(20, Math.min(100, 20 + v * 100))}%`;
    });
  });
  return (
    <span className={cx('inline-flex h-3 items-end gap-[2px]', className)} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            bars.current[i] = el;
          }}
          className={cx('w-[3px] rounded-[1px]', i === count - 1 ? 'bg-slate-dim' : 'bg-signal-soft')}
          style={{ height: '30%' }}
        />
      ))}
    </span>
  );
}
