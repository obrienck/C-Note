import { ChevronRight, Cloud, FolderOpen, HardDrive, LayoutGrid, LibraryBig, Play, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ReleaseCard } from '../components/ReleaseCard';
import { Sleeve } from '../components/Sleeve';
import { Button, cx, Dot, Mono, Panel, Segmented, Tag } from '../components/ui';
import { formatSpec, formatTime, isHiRes, totalDuration } from '../lib/format';
import type { Album, Artist } from '../shared/types';
import { useStore, type SortMode, type SourceFilter } from '../store';

const qualityRank = (a: Album) => (a.format.lossless ? 1e12 : 0) + (a.format.sampleRate ?? 0) * (a.format.bitDepth ?? 16);

export function matchesFilter(a: Album, filter: SourceFilter) {
  if (filter === 'all') return true;
  if (filter === 'hires') return isHiRes(a.format);
  return a.source === filter || a.source === 'mixed';
}

export function matchesQuery(a: Album, q: string) {
  if (!q) return true;
  return [a.title, a.artist, a.label ?? '', a.genre ?? '', ...a.tracks.map((t) => t.title)].some((s) => s.toLowerCase().includes(q));
}

export function sortReleases(list: Album[], mode: SortMode) {
  const sorted = [...list];
  if (mode === 'release') sorted.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title));
  else if (mode === 'quality') sorted.sort((a, b) => qualityRank(b) - qualityRank(a) || (a.year ?? 0) - (b.year ?? 0));
  else sorted.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.title.localeCompare(b.title));
  return sorted;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[\p{L}\p{N}]/u.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

export function FilterBar() {
  const { query, setQuery, sortMode, setSortMode, sourceFilter, setSourceFilter, library } = useStore();
  const count = (f: SourceFilter) => library.albums.filter((a) => matchesFilter(a, f)).length;
  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-black/50 bg-panel/60 px-6 py-3.5 xl:px-10">
      <label className="flex h-9 items-center gap-2 rounded-md border border-hairline bg-obsidian px-3 focus-within:border-brass/50">
        <Search className="size-4 text-slate" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search vault"
          className="w-44 bg-transparent font-mono text-[11px] tracking-[0.06em] text-parchment outline-none placeholder:text-slate-dim"
        />
        {query && <Tag tone="signal">Active</Tag>}
      </label>
      <div className="flex items-center gap-3">
        <Mono>Sort By</Mono>
        <Segmented<SortMode>
          value={sortMode}
          onChange={setSortMode}
          options={[
            { value: 'artist', label: 'Artist Chronological' },
            { value: 'release', label: 'Release Date' },
            { value: 'quality', label: 'Format Quality' },
          ]}
        />
      </div>
      <Segmented<SourceFilter>
        className="ml-auto"
        value={sourceFilter}
        onChange={setSourceFilter}
        options={[
          { value: 'all', label: `All (${count('all')})` },
          {
            value: 'nextcloud',
            label: (
              <span className="flex items-center gap-1.5">
                <Cloud className="size-3" />
                Nextcloud ({count('nextcloud')})
              </span>
            ),
          },
          {
            value: 'local',
            label: (
              <span className="flex items-center gap-1.5">
                <HardDrive className="size-3" />
                Local ({count('local')})
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}

export function ArtistsIndex() {
  const { library, query, sortMode, sourceFilter, setSourceFilter, selectedArtistId, selectArtist, playAlbum } = useStore();
  const [featuredId, setFeaturedId] = useState<string | null>(null);

  const indexed = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = library.albums.filter((a) => matchesFilter(a, sourceFilter) && matchesQuery(a, q));
    const byArtist = new Map<string, Album[]>();
    for (const a of visible) byArtist.set(a.artistId, [...(byArtist.get(a.artistId) ?? []), a]);
    return library.artists.filter((ar) => byArtist.has(ar.id)).map((artist) => ({ artist, releases: byArtist.get(artist.id)! }));
  }, [library, query, sourceFilter]);

  const current = indexed.find((r) => r.artist.id === selectedArtistId) ?? indexed[0];
  const releases = current ? sortReleases(current.releases, sortMode) : [];
  const featured = releases.find((a) => a.id === featuredId) ?? releases[0];
  const letterOf = (a: Artist) => (a.sortName[0] ?? '#').toUpperCase();
  const letters = new Set(indexed.map((r) => letterOf(r.artist)));
  const recordings = indexed.reduce((n, r) => n + r.releases.reduce((m, a) => m + a.tracks.length, 0), 0);
  const years = releases.map((a) => a.year).filter((y): y is number => Boolean(y));

  return (
    <div className="view-enter">
      <FilterBar />
      <div className="mx-auto grid max-w-[1800px] gap-7 px-6 pt-7 pb-10 lg:grid-cols-[320px_minmax(0,1fr)] xl:px-10">
        <Panel as="aside" className="self-start p-5 lg:sticky lg:top-7">
          <div className="flex items-end justify-between border-b border-hairline/70 pb-3">
            <h2 className="flex items-center gap-2 font-serif text-[22px] text-parchment">
              <LibraryBig className="size-5 text-brass" /> Master Index
            </h2>
            <Mono>{recordings} Recordings</Mono>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {(
              [
                ['all', 'All Artists'],
                ['nextcloud', 'Nextcloud'],
                ['local', 'Local'],
                ['hires', 'Hi-Res'],
              ] as [SourceFilter, string][]
            ).map(([f, label]) => (
              <button
                key={f}
                type="button"
                onClick={() => setSourceFilter(f)}
                className={cx(
                  'rounded-sm px-2 py-1 font-mono text-[9.5px] tracking-[0.12em] uppercase',
                  sourceFilter === f
                    ? 'brushed-brass'
                    : f === 'hires'
                      ? 'bg-elevated/60 text-signal-soft'
                      : 'bg-elevated/60 text-parchment/80 hover:text-parchment',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-between rounded-sm bg-obsidian px-2 py-1.5" aria-label="Jump to letter">
            {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => {
              const enabled = letters.has(l);
              const active = current && letterOf(current.artist) === l;
              return (
                <button
                  key={l}
                  type="button"
                  disabled={!enabled}
                  onClick={() => {
                    const hit = indexed.find((r) => letterOf(r.artist) === l);
                    if (hit) {
                      selectArtist(hit.artist.id);
                      setFeaturedId(null);
                      document.getElementById(`artist-${hit.artist.id}`)?.scrollIntoView({ block: 'nearest' });
                    }
                  }}
                  className={cx(
                    'font-mono text-[9px]',
                    active ? 'text-brass-hi underline underline-offset-2' : enabled ? 'text-parchment/80 hover:text-brass-hi' : 'text-slate-dim/50',
                  )}
                >
                  {l}
                </button>
              );
            })}
          </div>
          <ul className="mt-4 max-h-[calc(100vh-430px)] min-h-40 space-y-1.5 overflow-y-auto pr-1">
            {indexed.map(({ artist, releases: rel }) => {
              const selected = artist.id === current?.artist.id;
              const tracks = rel.reduce((n, a) => n + a.tracks.length, 0);
              const hires = rel.filter((a) => isHiRes(a.format)).length;
              return (
                <li key={artist.id} id={`artist-${artist.id}`}>
                  <button
                    type="button"
                    onClick={() => {
                      selectArtist(artist.id);
                      setFeaturedId(null);
                    }}
                    aria-current={selected}
                    className={cx(
                      'w-full rounded-md text-left transition-colors',
                      selected ? 'border-l-2 border-brass bg-elevated p-3' : 'flex items-center gap-3 px-2 py-2.5 hover:bg-white/[0.03]',
                    )}
                  >
                    {selected ? (
                      <>
                        <div className="flex items-center gap-3">
                          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[#303033] font-serif text-[15px] text-brass-hi">
                            {initials(artist.name)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 font-serif text-[21px] leading-tight text-brass-hi">
                              <span className="truncate">{artist.name}</span> <Dot />
                            </div>
                          </div>
                          <ChevronRight className="size-4 shrink-0 text-parchment/70" />
                        </div>
                        <div className="mt-3 grid grid-cols-3 rounded-sm bg-obsidian py-2.5 text-center">
                          {[
                            ['Albums', rel.length],
                            ['Tracks', tracks],
                            ['Hi-Res', hires],
                          ].map(([k, v], i) => (
                            <div key={k}>
                              <Mono tone={i === 2 ? 'signal' : 'slate'}>{k}</Mono>
                              <div className={cx('mt-1 font-mono text-[15px]', i === 2 ? 'text-signal-soft' : 'text-parchment')}>{v}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-elevated font-serif text-[13px] text-slate">
                          {initials(artist.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] text-parchment">{artist.name}</span>
                          <Mono className="mt-0.5 block truncate">
                            {rel.length} Release{rel.length === 1 ? '' : 's'} · {tracks} Tracks
                          </Mono>
                        </span>
                        {hires > 0 && <Mono tone="dim">Hi-Res</Mono>}
                      </>
                    )}
                  </button>
                </li>
              );
            })}
            {indexed.length === 0 && <li className="px-2 py-6 text-center text-[13px] text-slate">No artists match.</li>}
          </ul>
        </Panel>

        <div className="min-w-0 space-y-8">
          {current && featured ? (
            <>
              <Hero album={featured} onPlay={() => playAlbum(featured.id)} />
              <section>
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-hairline/70 pb-3">
                  <div className="flex items-center gap-4">
                    <h2 className="font-serif text-[28px] text-parchment">
                      {sortMode === 'quality' ? 'Discography by Resolution' : sortMode === 'release' ? 'Latest Releases First' : 'Chronological Discography'}
                    </h2>
                    {years.length > 0 && (
                      <Tag tone="signal">
                        {Math.min(...years) === Math.max(...years) ? Math.min(...years) : `${Math.min(...years)} — ${Math.max(...years)}`}
                      </Tag>
                    )}
                  </div>
                  <Mono className="flex items-center gap-2">
                    <LayoutGrid className="size-3.5" /> {releases.length} Release{releases.length === 1 ? '' : 's'}
                  </Mono>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4">
                  {releases.map((a) => (
                    <ReleaseCard key={a.id} album={a} selected={a.id === featured.id} onSelect={() => setFeaturedId(a.id)} />
                  ))}
                </div>
              </section>
            </>
          ) : (
            <NoMatches />
          )}
        </div>
      </div>
    </div>
  );
}

/** Empty search result: a designed state with a way out, not a blank pane. */
function NoMatches() {
  const { setQuery, setSourceFilter } = useStore();
  return (
    <Panel className="grid place-items-center px-8 py-20 text-center">
      <LibraryBig className="size-8 text-brass" />
      <h2 className="mt-4 font-serif text-[26px] text-parchment">Nothing in the vault matches</h2>
      <p className="mt-2 max-w-md text-[14px] text-slate">Try another title, artist or tune, or widen the source filter.</p>
      <Button
        variant="mono"
        className="mt-6"
        onClick={() => {
          setQuery('');
          setSourceFilter('all');
        }}
      >
        Clear filters
      </Button>
    </Panel>
  );
}

function Hero({ album, onPlay }: { album: Album; onPlay: () => void }) {
  const firstLocal = album.tracks.find((t) => t.source === 'local');
  const meta = [album.year && `Released ${album.year}`, album.label, album.genre].filter(Boolean) as string[];
  const playable = album.tracks.some((t) => t.playable);
  return (
    <Panel className="relative overflow-hidden bg-gradient-to-br from-[#211f1d] via-panel to-panel p-8">
      <div className="relative flex flex-col gap-8 md:flex-row md:items-center">
        <Sleeve album={album} className="w-full max-w-[260px] shrink-0">
          {album.catalog && (
            <Tag tone="dark" className="absolute top-2 right-2">
              {album.catalog}
            </Tag>
          )}
        </Sleeve>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <Tag tone={album.source === 'local' ? 'plain' : 'signal'}>
              {album.source === 'nextcloud' ? 'Nextcloud' : album.source === 'local' ? 'Local' : 'Local + Nextcloud'}
              {album.format.lossless ? ' Lossless' : ''}
            </Tag>
            <Tag>{formatSpec(album.format)}</Tag>
          </div>
          <h1 className="mt-4 font-serif text-[clamp(32px,3vw,44px)] leading-tight text-parchment">{album.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px]">
            <span className="text-brass">{album.artist}</span>
            {meta.map((m) => (
              <span key={m} className="flex items-center gap-4 text-parchment/80">
                <Dot tone="dim" /> {m}
              </span>
            ))}
          </div>
          {album.comment && <p className="mt-4 line-clamp-3 max-w-3xl text-[14.5px] leading-[1.65] text-parchment/75">{album.comment}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-6 border-t border-hairline/70 pt-5">
            <div>
              <Mono>Tracks</Mono>
              <div className="mt-1 font-mono text-[12px] text-parchment">
                {album.tracks.length} Titles ({formatTime(totalDuration(album.tracks), true)})
              </div>
            </div>
            {album.format.bitrate && (
              <>
                <div className="etched-v h-8" />
                <div>
                  <Mono>Avg Bitrate</Mono>
                  <div className="mt-1 font-mono text-[12px] text-signal-soft">{Math.round(album.format.bitrate / 1000).toLocaleString()} kbps</div>
                </div>
              </>
            )}
            {firstLocal && (
              <>
                <div className="etched-v h-8" />
                <button type="button" className="min-w-0 text-left" onClick={() => window.cnote.shell.reveal(firstLocal.location)}>
                  <Mono>Location</Mono>
                  <div className="mt-1 flex max-w-72 items-center gap-1.5 truncate font-mono text-[12px] text-brass-hi" title={firstLocal.location}>
                    <FolderOpen className="size-3.5 shrink-0" />
                    <span className="truncate">{firstLocal.location.split(/[\\/]/).slice(-3, -1).join('/')}</span>
                  </div>
                </button>
              </>
            )}
            <Button variant="brass" className="ml-auto px-6 py-3" onClick={onPlay} disabled={!playable}>
              <Play className="size-4" /> Play Release
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  );
}
