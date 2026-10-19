import { usePlaybackEngine } from './audio/engine';
import { EmptyVault, ScanStrip } from './components/EmptyVault';
import { TopNav } from './components/TopNav';
import { TransportDeck } from './components/TransportDeck';
import { ArtistsIndex } from './screens/ArtistsIndex';
import { Discography } from './screens/Discography';
import { EngineStorage } from './screens/EngineStorage';
import { NowPlaying } from './screens/NowPlaying';
import { useAIHealth } from './services/dossier';
import { useLibrarySync } from './services/library';
import { useStore } from './store';

export default function App() {
  useLibrarySync();
  usePlaybackEngine();
  useAIHealth();
  const view = useStore((s) => s.view);
  const ready = useStore((s) => s.libraryReady);
  const empty = useStore((s) => s.library.albums.length === 0);

  // Library-backed views show the welcome card until there's something to show.
  const needsLibrary = view !== 'engine';

  return (
    <div className="flex h-full flex-col bg-canvas">
      <TopNav />
      <ScanStrip />
      <main key={view} className="min-h-0 flex-1 overflow-y-auto">
        {!ready ? null : needsLibrary && empty ? (
          <EmptyVault />
        ) : (
          <>
            {view === 'now' && <NowPlaying />}
            {view === 'artists' && <ArtistsIndex />}
            {view === 'discography' && <Discography />}
            {view === 'engine' && <EngineStorage />}
          </>
        )}
      </main>
      <TransportDeck />
    </div>
  );
}
