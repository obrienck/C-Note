import { Cloud, FolderPlus, LibraryBig } from 'lucide-react';
import { addLocalFolder } from '../services/library';
import { useStore } from '../store';
import { Monogram } from './TopNav';
import { Button, Mono, Panel } from './ui';

/** First-run and empty-library state: the way in, never a blank pane. */
export function EmptyVault() {
  const setView = useStore((s) => s.setView);
  const progress = useStore((s) => s.progress);
  const config = useStore((s) => s.config);
  const scanning = progress.phase === 'listing' || progress.phase === 'reading';
  const hasSources = Boolean(config && (config.localFolders.length || config.nextcloud));

  return (
    <div className="view-enter grid min-h-full place-items-center px-6 py-16">
      <Panel className="w-full max-w-2xl bg-gradient-to-b from-panel-hi to-panel p-10 text-center">
        <Monogram className="mx-auto size-16" />
        <h1 className="mt-6 font-serif text-[38px] leading-tight text-parchment">
          {scanning ? 'Indexing your vault' : hasSources ? 'No playable releases found' : 'Welcome to C-Note'}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-[15px] leading-[1.65] text-parchment/70">
          {scanning
            ? 'Reading tags and artwork from your files. Releases appear as soon as the index is written.'
            : hasSources
              ? 'The connected sources don’t contain audio files C-Note can read. Add another folder or check the Nextcloud path.'
              : 'Point C-Note at the music you own: a folder on this machine, a Nextcloud share, or both. Everything you see is read from your files’ own tags.'}
        </p>

        {scanning ? (
          <div className="mx-auto mt-8 max-w-md">
            <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brass-lo to-brass-hi transition-[width]"
                style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : '8%' }}
              />
            </div>
            <Mono className="mt-3 block">
              {progress.phase === 'listing'
                ? `Listing ${progress.source === 'nextcloud' ? 'Nextcloud' : 'local'} files…`
                : `${progress.done} / ${progress.total} files · ${progress.source === 'nextcloud' ? 'Nextcloud' : 'Local'}`}
            </Mono>
          </div>
        ) : (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button variant="brass" className="px-6 py-3" onClick={addLocalFolder}>
              <FolderPlus className="size-4" /> Add Music Folder
            </Button>
            <Button variant="ghost" className="px-6 py-3" onClick={() => setView('engine')}>
              <Cloud className="size-4" /> Connect Nextcloud
            </Button>
          </div>
        )}
        {progress.phase === 'error' && <p className="mt-6 font-mono text-[11px] text-clip">{progress.message}</p>}
      </Panel>
    </div>
  );
}

/** Thin progress strip shown under the top bar while a rescan runs over an existing library. */
export function ScanStrip() {
  const progress = useStore((s) => s.progress);
  const hasAlbums = useStore((s) => s.library.albums.length > 0);
  if (!hasAlbums || (progress.phase !== 'listing' && progress.phase !== 'reading')) return null;
  return (
    <div className="flex items-center gap-3 border-b border-black/50 bg-panel px-6 py-1.5 xl:px-10">
      <LibraryBig className="size-3.5 text-brass" />
      <Mono tone="parchment">
        {progress.phase === 'listing'
          ? `Listing ${progress.source === 'nextcloud' ? 'Nextcloud' : 'local'} files`
          : `Indexing ${progress.done} / ${progress.total}`}
      </Mono>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-elevated">
        <div
          className="h-full bg-brass transition-[width]"
          style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : '5%' }}
        />
      </div>
    </div>
  );
}
