import { useMemo } from 'react';
import { ReleaseCard } from '../components/ReleaseCard';
import { Mono } from '../components/ui';
import { useStore } from '../store';
import { FilterBar, matchesFilter, matchesQuery, sortReleases } from './ArtistsIndex';

/** The whole vault, artist-first, each artist's shelf in the chosen order. */
export function Discography() {
  const { library, query, sortMode, sourceFilter, selectArtist, setView } = useStore();

  const shelves = useMemo(() => {
    const q = query.trim().toLowerCase();
    return library.artists
      .map((artist) => ({
        artist,
        releases: sortReleases(
          library.albums.filter((a) => a.artistId === artist.id && matchesFilter(a, sourceFilter) && matchesQuery(a, q)),
          sortMode,
        ),
      }))
      .filter((s) => s.releases.length);
  }, [library, query, sortMode, sourceFilter]);

  const shown = shelves.reduce((n, s) => n + s.releases.length, 0);

  return (
    <div className="view-enter">
      <FilterBar />
      <div className="mx-auto max-w-[1800px] space-y-10 px-6 pt-8 pb-10 xl:px-10">
        <div className="flex items-end justify-between border-b border-hairline/70 pb-4">
          <h1 className="font-serif text-[36px] leading-tight text-parchment">The Vault</h1>
          <Mono>
            {shown} of {library.albums.length} releases · {shelves.length} artists
          </Mono>
        </div>
        {shelves.map(({ artist, releases }) => (
          <section key={artist.id}>
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <button
                type="button"
                className="font-serif text-[24px] text-parchment hover:text-brass-hi"
                onClick={() => {
                  selectArtist(artist.id);
                  setView('artists');
                }}
              >
                {artist.name}
              </button>
              <Mono>
                {releases.length} release{releases.length === 1 ? '' : 's'}
              </Mono>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
              {releases.map((a) => (
                <ReleaseCard key={a.id} album={a} />
              ))}
            </div>
          </section>
        ))}
        {shelves.length === 0 && <p className="py-16 text-center text-slate">Nothing in the vault matches these filters.</p>}
      </div>
    </div>
  );
}
