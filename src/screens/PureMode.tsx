import { AudioWaveform, Disc3, FolderOpen, Gauge } from 'lucide-react';
import { Oscilloscope, PhaseMeter, useCorrelation, usePeakHold, VUMeter } from '../components/instruments';
import { Sleeve } from '../components/Sleeve';
import { TrackRow } from '../components/TrackList';
import { cx, Dot, Mono, Panel, SpecRow, Tag } from '../components/ui';
import { codecName, formatPrecise, formatShort, formatSpec, formatTime, sidesOf, totalDuration } from '../lib/format';
import type { Album, Track } from '../shared/types';
import { useNativeRate, useStore } from '../store';
import { ModeSwitch } from './NowPlaying';

export function PureMode({ album, track }: { album: Album; track: Track }) {
  const native = useNativeRate();
  const outRate = useStore((s) => s.outputSampleRate);
  const f = track.format;

  return (
    <div className="view-enter mx-auto max-w-[1800px] space-y-7 px-6 pt-8 pb-10 xl:px-10">
      <Panel className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <Dot pulse />
            <Mono tone="signal">Analog Audiophile Purity Mode</Mono>
            <Dot tone="dim" />
            <Mono tone="parchment">{track.source === 'nextcloud' ? 'Nextcloud WebDAV Stream' : 'Local Direct Read'}</Mono>
            {f.lossless && (
              <>
                <Dot tone="dim" />
                <Tag>Lossless</Tag>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Mono tone="parchment">
              {codecName(f)} Bitstream: <span className="text-parchment">{formatSpec(f).split(' · ')[1] ?? '—'}</span>
            </Mono>
            {native !== null && (
              <Tag tone={native ? 'signal' : 'brass'}>
                <AudioWaveform className="size-3" />
                {native ? 'Native rate · no resampling' : `Resampled → ${+(outRate! / 1000).toFixed(1)} kHz`}
              </Tag>
            )}
          </div>
        </div>
        <ModeSwitch albumId={album.id} />
      </Panel>

      <div className="grid gap-7 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.55fr)_minmax(320px,1.15fr)]">
        <CatalogColumn album={album} track={track} />
        <CenterStage album={album} track={track} />
        <div className="space-y-7">
          <ScopePanel track={track} />
          <Sequence album={album} />
        </div>
      </div>

      <MasterPanel />
    </div>
  );
}

function CatalogColumn({ album, track }: { album: Album; track: Track }) {
  const outRate = useStore((s) => s.outputSampleRate);
  const outputLabel = useStore((s) => s.outputLabel);
  const roll: [string, string][] = (
    [
      ['Producer', album.producer],
      ['Engineer', album.engineer],
      ['Label', album.label],
      ['Catalogue', album.catalog],
      ['Genre', album.genre],
    ] as [string, string | undefined][]
  ).filter((r): r is [string, string] => Boolean(r[1]));
  const f = track.format;

  return (
    <div className="space-y-7">
      <Panel className="p-6">
        <div className="flex items-center justify-between border-b border-hairline/70 pb-3">
          <Mono tone="signal">Gatefold Archive</Mono>
          {album.catalog && <Mono tone="parchment">Cat # {album.catalog}</Mono>}
        </div>
        <h2 className="mt-5 font-serif text-[28px] leading-[1.2] text-parchment">{album.title}</h2>
        <p className="mt-2 font-serif text-[14px] leading-5 text-parchment/75 italic">
          {album.artist}
          {album.year ? ` · ${album.year}` : ''}
        </p>
        {album.comment && (
          <div className="mt-5 rounded-md border border-hairline/60 bg-obsidian/70 p-4 text-[13px] leading-[1.6] whitespace-pre-line text-parchment/80">
            {album.comment}
          </div>
        )}
        {roll.length > 0 && (
          <div className="mt-5 border-t border-hairline/70 pt-4">
            <Mono tone="brass">Production Roll</Mono>
            <div className="mt-2">
              {roll.map(([k, v]) => (
                <SpecRow key={k} label={k} value={v} />
              ))}
            </div>
          </div>
        )}
      </Panel>

      <Panel className="p-6">
        <div className="flex items-center justify-between border-b border-hairline/70 pb-3">
          <Mono tone="brass">Signal Route</Mono>
          <Dot tone={outRate ? 'signal' : 'dim'} />
        </div>
        <div className="mt-2">
          <SpecRow label="Source" value={track.source === 'nextcloud' ? 'Nextcloud WebDAV' : 'Local file'} valueTone="parchment" />
          <SpecRow label="Decoder" value={`${codecName(f)}${f.bitDepth ? ` → ${f.bitDepth}-bit` : ''}`} valueTone="parchment" />
          <SpecRow label="Engine" value="Float32 · WebAudio" valueTone="parchment" />
          <SpecRow label="Output" value={outputLabel} valueTone="parchment" />
          <SpecRow label="Output Rate" value={outRate ? `${+(outRate / 1000).toFixed(1)} kHz` : 'Standby'} valueTone="signal" />
        </div>
        {track.source === 'local' && (
          <button
            type="button"
            onClick={() => window.cnote.shell.reveal(track.location)}
            className="mt-4 flex items-center gap-2 text-slate hover:text-brass-hi"
          >
            <FolderOpen className="size-3.5" />
            <Mono>Reveal file</Mono>
          </button>
        )}
      </Panel>
    </div>
  );
}

function CenterStage({ album, track }: { album: Album; track: Track }) {
  const isPlaying = useStore((s) => s.isPlaying);
  const side = sidesOf(album).find((s) => s.tracks.some((x) => x.track.id === track.id));
  const cut = side ? side.tracks.findIndex((x) => x.track.id === track.id) + 1 : track.number;

  // Only metrics present in the tags are shown — no blank slots.
  const metrics: [string, string][] = [];
  if (track.key) metrics.push(['Key', track.key]);
  if (track.bpm) metrics.push(['Tempo', `${track.bpm} BPM`]);
  if (track.isrc) metrics.push(['ISRC', track.isrc]);
  if (track.composer) metrics.push(['Composer', track.composer]);
  if (metrics.length < 3) metrics.push(['Length', formatTime(track.duration, true)]);
  if (metrics.length < 3) metrics.push(['Format', formatShort(track.format)]);

  return (
    <div className="space-y-7">
      <Panel className="p-5">
        <Sleeve album={album} className="mx-auto w-full max-w-[640px]">
          {track.format.lossless && (
            <Tag tone="dark" className="absolute top-3 right-3">
              <Dot /> Lossless Master
            </Tag>
          )}
          {(album.label || album.year) && (
            <div className="absolute bottom-3 left-3 flex items-center gap-2.5 rounded-sm bg-black/70 px-3 py-2 backdrop-blur-sm">
              <Disc3 className={cx('size-4 text-brass-hi', isPlaying && 'animate-spin-33')} />
              <div>
                <div className="font-mono text-[10px] tracking-[0.14em] text-parchment uppercase">{album.label ?? album.artist}</div>
                <div className="font-mono text-[9px] tracking-[0.12em] text-brass">{[album.catalog, album.year].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
          )}
        </Sleeve>
      </Panel>

      <Panel className="px-8 py-7 text-center">
        <Mono tone="parchment">
          {side?.label ?? 'Side A'} <span className="text-slate-dim">·</span> Cut {String(cut).padStart(2, '0')}{' '}
          <span className="text-slate-dim">·</span> {formatSpec(track.format).replace(' · ', ' ')}
        </Mono>
        <h1 className="mt-4 font-serif text-[clamp(34px,3.2vw,52px)] leading-[1.1] tracking-[-0.02em] text-brass-hi">{track.title}</h1>
        <p className="mt-3 text-[17px] text-parchment/80">{track.artist}</p>
        <div className="mx-auto mt-6 flex max-w-xl flex-wrap items-start justify-center gap-x-8 gap-y-3">
          {metrics.slice(0, 3).map(([k, v], i) => (
            <div key={k} className="flex items-center gap-8">
              {i > 0 && <Dot tone="dim" />}
              <div>
                <Mono>{k}</Mono>
                <div className="mt-1 font-mono text-[12px] tracking-[0.06em] text-parchment">{v}</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function ScopePanel({ track }: { track: Track }) {
  const position = useStore((s) => s.position);
  const duration = useStore((s) => s.duration) || track.duration;
  const correlation = useCorrelation();
  return (
    <Panel className="p-6">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <AudioWaveform className="size-4 text-brass" />
          <Mono tone="brass">Amber Harmonic Oscilloscope</Mono>
        </span>
        <Mono tone="parchment">Realtime FFT</Mono>
      </div>
      <div className="mt-4 h-[128px] overflow-hidden rounded-sm border border-hairline bg-[radial-gradient(ellipse_at_center,#1a1712_0%,#0b0b0c_80%)] shadow-[inset_0_0_24px_rgba(0,0,0,0.8)]">
        <Oscilloscope />
      </div>
      <div className="mt-3 flex justify-between">
        <span className="font-mono text-[11px] tracking-[0.06em] text-brass-hi tabular">{formatPrecise(position)}</span>
        <Mono tone="parchment">
          Phase: {correlation == null ? '—' : `${correlation >= 0 ? '+' : ''}${correlation.toFixed(2)}`}
        </Mono>
        <span className="font-mono text-[11px] tracking-[0.06em] text-parchment/80 tabular">{formatPrecise(duration)}</span>
      </div>
    </Panel>
  );
}

function Sequence({ album }: { album: Album }) {
  const sides = sidesOf(album);
  return (
    <Panel className="p-6">
      <div className="flex items-center justify-between">
        <Mono tone="signal">{[album.label, album.catalog].filter(Boolean).join(' ') || album.title} Sequence</Mono>
        <Mono tone="parchment">
          {sides.length} {sides.length === 1 ? 'Side' : sides[0].label.startsWith('Disc') ? 'Discs' : 'Sides'} · {album.tracks.length} Cuts
        </Mono>
      </div>
      {sides.map((side) => (
        <div key={side.label} className="mt-4">
          <div className="flex items-center justify-between rounded-sm bg-obsidian/80 px-3 py-1.5">
            <Mono tone="parchment">
              {side.label} ({formatTime(totalDuration(side.tracks.map((x) => x.track)), true)})
            </Mono>
          </div>
          <ol className="mt-1">
            {side.tracks.map(({ track: t, index }) => (
              <TrackRow key={t.id} album={album} track={t} index={index} dense subtitle={t.composer ?? formatShort(t.format)} />
            ))}
          </ol>
        </div>
      ))}
    </Panel>
  );
}

function MasterPanel() {
  const peak = usePeakHold();
  const native = useNativeRate();
  return (
    <Panel className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline/70 pb-4">
        <span className="flex items-center gap-2">
          <Gauge className="size-4 text-brass" />
          <Mono tone="brass">Precision Analog Ballistic VU System</Mono>
        </span>
        <div className="flex flex-wrap gap-6">
          <Mono tone="parchment">
            Integration Time: <span className="text-signal-soft">300 ms</span>
          </Mono>
          <Mono tone="parchment">
            Peak Hold:{' '}
            <span className={cx(peak > -0.5 ? 'text-clip' : 'text-parchment')}>{Number.isFinite(peak) ? `${peak.toFixed(1)} dBFS` : '— dBFS'}</span>
          </Mono>
          <Mono tone="parchment">Response: Damped</Mono>
        </div>
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <VUMeter channel={0} label="Left Channel" />
        <VUMeter channel={1} label="Right Channel" />
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-sm bg-obsidian/70 px-4 py-2.5">
        <PhaseMeter />
        <span className="flex items-center gap-2">
          <Dot tone={native === null ? 'dim' : native ? 'signal' : 'brass'} />
          <Mono tone="parchment">
            {native === null ? 'Rate Match: Standby' : native ? 'Rate Match: Native' : 'Rate Match: Resampled by OS'}
          </Mono>
        </span>
      </div>
    </Panel>
  );
}
