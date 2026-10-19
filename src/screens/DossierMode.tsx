import { ArrowRight, AudioLines, Cloud, HardDrive, Mic, Radio, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { PeakBars } from '../components/instruments';
import { Sleeve } from '../components/Sleeve';
import { TrackRow } from '../components/TrackList';
import { cx, Dot, Mono, Panel, Tag } from '../components/ui';
import { formatShort, formatSpec, formatTime, sidesOf, totalDuration } from '../lib/format';
import type { Album, Dossier, Track } from '../shared/types';
import { useNativeRate, useStore } from '../store';
import { ModeSwitch } from './NowPlaying';

export function DossierMode({ album, track, dossier }: { album: Album; track: Track; dossier: Dossier }) {
  return (
    <div className="view-enter mx-auto max-w-[1800px] px-6 pt-8 pb-10 xl:px-10">
      <StatusStrip album={album} track={track} />
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-7 self-start xl:sticky xl:top-7">
          <MediaDeck album={album} track={track} />
          <VinylCuts album={album} track={track} />
        </div>
        <DossierPanel album={album} dossier={dossier} />
      </div>
    </div>
  );
}

function StatusStrip({ album, track }: { album: Album; track: Track }) {
  const native = useNativeRate();
  const outRate = useStore((s) => s.outputSampleRate);
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {(album.label || album.catalog) && <Tag tone="brass">{[album.label, album.catalog].filter(Boolean).join(' · ')}</Tag>}
          <span className="flex items-center gap-2 font-mono text-[10.5px] tracking-[0.1em] text-parchment/80">
            {track.source === 'nextcloud' ? <Cloud className="size-3.5 text-signal-soft" /> : <HardDrive className="size-3.5 text-signal-soft" />}
            {track.source === 'nextcloud' ? 'Nextcloud WebDAV · Streamed' : 'Local · Direct read'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {album.engineer && (
            <Mono tone="parchment">
              Engineer: <span className="text-brass-hi">{album.engineer}</span>
            </Mono>
          )}
          {native !== null && (
            <Tag tone={native ? 'signal' : 'brass'}>
              <Dot tone={native ? 'signal' : 'brass'} />
              {native ? 'Native rate · no resampling' : `Resampled to ${+(outRate! / 1000).toFixed(1)} kHz by the OS mixer`}
            </Tag>
          )}
        </div>
      </div>
      <ModeSwitch albumId={album.id} />
    </div>
  );
}

function MediaDeck({ album, track }: { album: Album; track: Track }) {
  const isPlaying = useStore((s) => s.isPlaying);
  const f = track.format;
  const specs: [string, string][] = [
    ['Source', track.source === 'nextcloud' ? 'Nextcloud WebDAV' : 'Local folder'],
    ['Encoding', formatSpec(f)],
  ];
  if (album.year || album.label) specs.push(['Release', [album.year, album.label].filter(Boolean).join(' · ')]);
  if (f.bitrate) specs.push(['Bitrate', `${Math.round(f.bitrate / 1000).toLocaleString()} kbps`]);
  else if (f.channels) specs.push(['Channels', f.channels === 2 ? 'Stereo' : `${f.channels} ch`]);

  return (
    <Panel className="bg-gradient-to-br from-panel-hi to-panel p-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
        <div className="w-full max-w-[420px] shrink-0 lg:w-[46%] lg:pr-[8%]">
          <Sleeve album={album} record spinning={isPlaying} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <AudioLines className={cx('size-3.5 text-signal-soft', isPlaying && 'animate-pulse')} />
            <Mono tone="signal">{isPlaying ? 'Now Rotating · 33⅓ RPM' : 'Cued · Stylus Lifted'}</Mono>
          </div>
          <h1 className="mt-4 font-serif text-[clamp(32px,3vw,48px)] leading-[1.1] tracking-[-0.02em] text-parchment">{album.title}</h1>
          <p className="mt-1 text-[16px] text-parchment/75">{album.artist}</p>
          <p className="mt-2 font-serif text-[19px] text-brass italic">{track.title}</p>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 rounded-md border border-hairline/70 bg-obsidian/60 p-4">
            {specs.map(([k, v], i) => (
              <div key={k}>
                <dt>
                  <Mono tone="parchment">{k}</Mono>
                </dt>
                <dd className={cx('mt-1.5 font-mono text-[11px] tracking-[0.06em]', i % 2 ? 'text-signal-soft' : 'text-parchment/80')}>{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            {album.genre && <Tag>{album.genre}</Tag>}
            {album.producer && <Tag>Producer: {album.producer}</Tag>}
            {track.composer && <Tag>Composer: {track.composer}</Tag>}
            {f.lossless && <Tag tone="solid">Lossless</Tag>}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function VinylCuts({ album, track }: { album: Album; track: Track }) {
  const sides = sidesOf(album);
  const playingSide = Math.max(0, sides.findIndex((s) => s.tracks.some((x) => x.track.id === track.id)));
  const [picked, setPicked] = useState<number | null>(null);
  const side = picked ?? playingSide;

  return (
    <Panel className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Mono tone="parchment">Vinyl Cuts:</Mono>
          <div className="flex flex-wrap rounded-md border border-hairline bg-obsidian p-0.5" role="tablist">
            {sides.map((s, i) => (
              <button
                key={s.label}
                type="button"
                role="tab"
                aria-selected={side === i}
                onClick={() => setPicked(i)}
                className={cx(
                  'rounded-sm px-4 py-1 font-mono text-[10.5px] tracking-[0.12em] uppercase',
                  side === i ? 'border border-brass/40 bg-elevated text-brass-hi' : 'text-slate hover:text-parchment',
                )}
              >
                {s.label} ({formatTime(totalDuration(s.tracks.map((x) => x.track)), true)})
              </button>
            ))}
          </div>
        </div>
        <span className="flex items-center gap-2">
          <Mono tone="parchment">Dynamic Peak Monitor</Mono>
          <PeakBars />
        </span>
      </div>
      <ol className="space-y-1">
        {sides[Math.min(side, sides.length - 1)].tracks.map(({ track: t, index }) => (
          <TrackRow key={t.id} album={album} track={t} index={index} />
        ))}
      </ol>
    </Panel>
  );
}

const ARTIFACT_ICONS = [Radio, SlidersHorizontal, Mic, Sparkles];

function DossierPanel({ album, dossier }: { album: Album; dossier: Dossier }) {
  const [expanded, setExpanded] = useState(false);
  const playAlbum = useStore((s) => s.playAlbum);
  const albumIndex = useStore((s) => s.albumIndex);
  const lead = expanded ? dossier.body : dossier.body.slice(0, 4);
  const [first = '', ...rest] = lead;
  const similar = dossier.similar.flatMap((s) => {
    const a = albumIndex.get(s.albumId);
    return a ? [{ ...s, album: a }] : [];
  });

  return (
    <Panel as="article" className="relative self-start overflow-hidden bg-gradient-to-b from-[#232120] via-panel to-panel p-8">
      <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-brass/5 blur-3xl" />
      <header className="relative flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Tag tone="solid">
              <Sparkles className="size-3" /> C-Note Intelligence
            </Tag>
            <Mono tone="brass">Archive Dossier</Mono>
          </div>
          <h2 className="mt-3 font-serif text-[28px] leading-[1.15] text-parchment">{dossier.headline}</h2>
          <p className="mt-2 text-[14px] text-slate italic">{dossier.standfirst}</p>
        </div>
        {(album.catalog || album.year) && (
          <span className="shrink-0 rounded-sm border border-hairline bg-elevated px-2.5 py-1.5 font-mono text-[10px] tracking-[0.1em] text-parchment/80">
            DOC: {[album.year, album.catalog].filter(Boolean).join('-')}
          </span>
        )}
      </header>

      {first && (
        <div className="relative mt-7 space-y-5 text-[15.5px] leading-[1.75] text-parchment/85">
          <p>
            <span className="float-left mt-1 mr-3 font-serif text-[64px] leading-[0.8] text-brass-hi">{first.charAt(0)}</span>
            {first.slice(1)}
          </p>
          {rest.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}

      {dossier.personnel.length > 0 && (
        <section className="relative mt-8 rounded-md border border-hairline/70 bg-obsidian/50 p-5">
          <div className="mb-4 flex items-center justify-between">
            <Mono tone="brass">Personnel Ensemble Credits</Mono>
            {album.label && <Mono tone="parchment">{album.label}</Mono>}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {dossier.personnel.map((p) => (
              <div key={p.name + p.role} className="rounded-sm bg-elevated/70 px-3.5 py-3">
                <div className="font-mono text-[12px] tracking-[0.06em] text-parchment">{p.name}</div>
                <Mono className="mt-1 block">{p.role}</Mono>
              </div>
            ))}
          </div>
          {(album.engineer || album.producer) && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              {album.engineer && (
                <Mono>
                  Recording Engineer: <span className="text-parchment">{album.engineer}</span>
                </Mono>
              )}
              {album.producer && (
                <Mono>
                  Producer: <span className="text-parchment">{album.producer}</span>
                </Mono>
              )}
            </div>
          )}
        </section>
      )}

      {dossier.artifacts.length > 0 && (
        <section className="relative mt-7">
          <Mono tone="parchment">Session Artifacts &amp; Sonic Trivia</Mono>
          <ul className="mt-3 space-y-1.5">
            {dossier.artifacts.map((a, i) => {
              const Icon = ARTIFACT_ICONS[i % ARTIFACT_ICONS.length];
              return (
                <li key={i} className="flex items-start gap-3 rounded-sm bg-elevated/60 px-3 py-2.5">
                  <Icon className="mt-0.5 size-3.5 shrink-0 text-brass" />
                  <span className="font-mono text-[11.5px] leading-[1.5] tracking-[0.03em] text-parchment/85">{a.text}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {similar.length > 0 && (
        <section className="relative mt-7">
          <div className="flex items-center justify-between">
            <Mono tone="brass">Curated Companion Auditions</Mono>
            <Mono>From your vault</Mono>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {similar.map(({ album: a, reason }) => (
              <button
                key={a.id}
                type="button"
                title={reason}
                onClick={() => playAlbum(a.id)}
                className="group rounded-md border border-hairline/70 bg-elevated/40 p-2.5 text-left transition-colors hover:border-brass/40"
              >
                <Sleeve album={a}>
                  <Tag tone="dark" className="absolute top-1.5 right-1.5">
                    {formatShort(a.format)}
                  </Tag>
                </Sleeve>
                <div className="mt-2.5 truncate text-[13.5px] text-parchment group-hover:text-brass-hi">{a.title}</div>
                <Mono className="mt-1 block truncate">{[a.year, a.artist].filter(Boolean).join(' · ')}</Mono>
              </button>
            ))}
          </div>
        </section>
      )}

      <footer className="relative mt-7 flex items-center justify-between gap-4 border-t border-hairline/70 pt-5">
        <span className="flex items-center gap-2">
          <Dot tone="brass" />
          <Mono tone="parchment">
            {dossier.generatedBy} · {new Date(dossier.generatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </Mono>
        </span>
        {dossier.body.length > 4 && (
          <button type="button" onClick={() => setExpanded((e) => !e)} className="flex items-center gap-2 text-brass hover:text-brass-hi">
            <Mono tone="brass">{expanded ? 'Collapse Liner Book' : 'View Full Liner Book'}</Mono>
            <ArrowRight className={cx('size-3.5 transition-transform', expanded && '-rotate-90')} />
          </button>
        )}
      </footer>
    </Panel>
  );
}
