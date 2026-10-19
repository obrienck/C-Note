import { useEffect, useRef } from 'react';
import { useStore, useCurrent } from '../store';

/*
 * Playback engine. Each track streams from the main process over
 * cnote://track/<id> into an <audio> element, then through a WebAudio graph:
 *   element ─┬→ gain (volume) → destination (selected output device)
 *            ├→ channel splitter → L/R analysers (meters)
 *            └→ mix analyser (scope, FFT)
 * The meters tap the decoded signal ahead of the volume control, so they
 * show programme level regardless of how loud you're listening.
 * Every meter in the app reads these analysers; when nothing is playing
 * they read silence.
 */

interface Graph {
  ctx: AudioContext;
  left: AnalyserNode;
  right: AnalyserNode;
  mix: AnalyserNode;
  gain: GainNode;
}

let audioEl: HTMLAudioElement | null = null;
let graph: Graph | null = null;

function element(): HTMLAudioElement {
  if (audioEl) return audioEl;
  const el = new Audio();
  el.crossOrigin = 'anonymous';
  el.preload = 'auto';
  el.addEventListener('ended', () => useStore.getState().next(true));
  el.addEventListener('waiting', () => useStore.setState({ buffering: true }));
  el.addEventListener('playing', () => useStore.setState({ buffering: false }));
  el.addEventListener('durationchange', () => {
    if (Number.isFinite(el.duration)) useStore.setState({ duration: el.duration });
  });
  el.addEventListener('error', () => {
    if (!el.getAttribute('src')) return;
    const code = el.error?.code;
    useStore.setState({
      isPlaying: false,
      buffering: false,
      playbackError:
        code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
          ? 'This file’s format can’t be decoded by the playback engine.'
          : 'The stream could not be read. Check that the source is reachable.',
    });
  });
  audioEl = el;
  return el;
}

function ensureGraph(): Graph {
  if (graph) return graph;
  const el = element();
  const ctx = new AudioContext({ latencyHint: 'playback' });
  const src = ctx.createMediaElementSource(el);
  const gain = ctx.createGain();
  const split = ctx.createChannelSplitter(2);
  const mk = (size: number) => {
    const a = ctx.createAnalyser();
    a.fftSize = size;
    a.smoothingTimeConstant = 0.6;
    return a;
  };
  const left = mk(2048);
  const right = mk(2048);
  const mix = mk(4096);
  src.connect(gain);
  gain.connect(ctx.destination);
  src.connect(split);
  src.connect(mix);
  split.connect(left, 0);
  split.connect(right, 1);
  el.volume = 1;
  gain.gain.value = (useStore.getState().volume / 100) ** 2;
  graph = { ctx, left, right, mix, gain };
  useStore.setState({ outputSampleRate: ctx.sampleRate });
  return graph;
}

/* ---------- Signal readout used by meters and scopes ---------- */

const scratch = new Float32Array(8192);
let specBins: Float32Array<ArrayBuffer> | null = null;

function rms(a: AnalyserNode): number {
  const buf = scratch.subarray(0, a.fftSize);
  a.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

function peakOf(a: AnalyserNode): number {
  const buf = scratch.subarray(0, a.fftSize);
  a.getFloatTimeDomainData(buf);
  let p = 0;
  for (let i = 0; i < buf.length; i++) p = Math.max(p, Math.abs(buf[i]));
  return p;
}

const live = (playing: boolean) => playing && graph !== null;

/** Per-channel RMS amplitude (0–1, full scale = 1). */
export function readLevels(playing: boolean): [number, number] {
  if (!live(playing)) return [0, 0];
  return [rms(graph!.left), rms(graph!.right)];
}

/** Per-channel sample peak (0–1) over the analyser window. */
export function readPeaks(playing: boolean): [number, number] {
  if (!live(playing)) return [0, 0];
  return [peakOf(graph!.left), peakOf(graph!.right)];
}

/** Magnitude spectrum in 0–1 across `out.length` log-spaced bands (30 Hz – 20 kHz). */
export function readSpectrum(playing: boolean, out: Float32Array) {
  if (!live(playing)) return out.fill(0);
  const { mix, ctx } = graph!;
  if (!specBins || specBins.length !== mix.frequencyBinCount) specBins = new Float32Array(mix.frequencyBinCount);
  mix.getFloatFrequencyData(specBins);
  const nyquist = ctx.sampleRate / 2;
  for (let i = 0; i < out.length; i++) {
    const f = 30 * Math.pow(20000 / 30, i / (out.length - 1));
    const db = specBins[Math.min(specBins.length - 1, Math.round((f / nyquist) * specBins.length))];
    out[i] = Math.max(0, Math.min(1, (db + 90) / 70));
  }
}

/** Time-domain trace for the oscilloscope, in −1…1. */
export function readWaveform(playing: boolean, out: Float32Array) {
  if (!live(playing)) return out.fill(0);
  const buf = scratch.subarray(0, graph!.mix.fftSize);
  graph!.mix.getFloatTimeDomainData(buf);
  // Show ~20 ms so individual cycles are legible.
  const span = Math.min(buf.length, Math.round(graph!.ctx.sampleRate * 0.02));
  for (let i = 0; i < out.length; i++) out[i] = buf[Math.floor((i / out.length) * span)];
}

/** Interchannel correlation (−1…+1) for the phase meter; null when silent. */
export function readCorrelation(playing: boolean): number | null {
  if (!live(playing)) return null;
  const n = graph!.left.fftSize;
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  graph!.left.getFloatTimeDomainData(l);
  graph!.right.getFloatTimeDomainData(r);
  let lr = 0,
    ll = 0,
    rr = 0;
  for (let i = 0; i < n; i++) {
    lr += l[i] * r[i];
    ll += l[i] * l[i];
    rr += r[i] * r[i];
  }
  return ll > 1e-9 && rr > 1e-9 ? lr / Math.sqrt(ll * rr) : null;
}

/* ---------- React glue ---------- */

export function usePlaybackEngine() {
  const current = useCurrent();
  const trackId = current?.track.id;
  const isPlaying = useStore((s) => s.isPlaying);
  const volume = useStore((s) => s.volume);
  const deviceId = useStore((s) => s.settings.outputDeviceId);
  // Resume where the last session left off (position is persisted).
  const restoreAt = useRef<number | null>(useStore.getState().position || null);

  // Load the stream whenever the track changes.
  useEffect(() => {
    const el = element();
    if (!trackId) {
      el.pause();
      el.removeAttribute('src');
      el.load();
      return;
    }
    el.src = `cnote://track/${trackId}`;
    if (restoreAt.current) {
      el.currentTime = restoreAt.current;
      restoreAt.current = null;
    }
    if (useStore.getState().isPlaying) {
      void ensureGraph().ctx.resume();
      el.play().catch(() => useStore.setState({ isPlaying: false }));
    }
  }, [trackId]);

  // Same-track restart (loop one, previous after 3 s) arrives as position 0.
  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        if (audioEl && s.position === 0 && prev.position > 1 && s.albumId === prev.albumId && s.trackIndex === prev.trackIndex) {
          audioEl.currentTime = 0;
          if (s.isPlaying) void audioEl.play();
        }
      }),
    [],
  );

  useEffect(() => {
    const el = element();
    if (!trackId) return;
    if (isPlaying) {
      void ensureGraph().ctx.resume();
      el.play().catch(() => useStore.setState({ isPlaying: false }));
    } else {
      el.pause();
    }
  }, [isPlaying, trackId]);

  useEffect(() => {
    if (graph) graph.gain.gain.value = (volume / 100) ** 2;
  }, [volume]);

  // Route to the chosen output device once the graph exists.
  useEffect(() => {
    const ctx = graph?.ctx as (AudioContext & { setSinkId?: (id: string) => Promise<void> }) | undefined;
    if (!ctx?.setSinkId) return;
    ctx
      .setSinkId(deviceId === 'default' ? '' : deviceId)
      .then(() => useStore.setState({ outputSampleRate: ctx.sampleRate }))
      .catch(() => useStore.getState().updateSettings({ outputDeviceId: 'default' }));
  }, [deviceId, isPlaying]);

  // Mirror the element's clock into the store.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (audioEl && !audioEl.paused) useStore.setState({ position: audioEl.currentTime });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

/** Seek that moves the audio element. */
export function seekTo(seconds: number) {
  useStore.setState({ position: seconds });
  if (audioEl) audioEl.currentTime = seconds;
}

/**
 * Animation-frame loop for canvas instruments. The callback receives the
 * frame clock (seconds), whether audio is flowing, and the frame delta.
 */
export function useSignalFrame(draw: (t: number, playing: boolean, dt: number) => void) {
  const drawRef = useRef(draw);
  drawRef.current = draw;
  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      // Schedule first so one bad frame can't stop the instrument.
      raf = requestAnimationFrame(loop);
      const s = useStore.getState();
      drawRef.current(now / 1000, s.isPlaying && !s.buffering, dt);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}
