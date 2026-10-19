import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AISettings, Album, Dossier, Library, LibraryConfig, ScanProgress, StorageSource, Track } from './shared/types';

export type View = 'artists' | 'now' | 'discography' | 'engine';
export type LoopMode = 'off' | 'all' | 'one';
export type AIStatus = 'online' | 'offline' | 'unset' | 'checking';
export type SourceFilter = 'all' | StorageSource | 'hires';
export type SortMode = 'artist' | 'release' | 'quality';

/** Renderer-side preferences. Secrets and library sources live in the main process. */
export interface Settings {
  aiEnabled: boolean;
  ai: AISettings;
  zeroGhost: boolean;
  cacheDossiers: boolean;
  outputDeviceId: string;
  vuReference: -20 | -18 | -14;
}

const defaultSettings: Settings = {
  aiEnabled: true,
  ai: {
    provider: 'claude',
    openaiModel: 'gpt-5',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3.1',
    tokenBudget: 'standard',
    persona: 'historian',
  },
  zeroGhost: true,
  cacheDossiers: true,
  outputDeviceId: 'default',
  vuReference: -18,
};

const EMPTY_LIBRARY: Library = { artists: [], albums: [] };

interface State {
  view: View;
  setView: (v: View) => void;

  // Library
  library: Library;
  albumIndex: Map<string, Album>;
  libraryReady: boolean;
  progress: ScanProgress;
  config: LibraryConfig | null;
  setLibrary: (lib: Library) => void;
  setProgress: (p: ScanProgress) => void;
  setConfig: (c: LibraryConfig) => void;

  // Browsing
  selectedArtistId: string | null;
  sourceFilter: SourceFilter;
  sortMode: SortMode;
  query: string;
  selectArtist: (id: string) => void;
  setSourceFilter: (f: SourceFilter) => void;
  setSortMode: (m: SortMode) => void;
  setQuery: (q: string) => void;

  // Playback
  albumId: string | null;
  trackIndex: number;
  position: number;
  duration: number;
  isPlaying: boolean;
  buffering: boolean;
  playbackError: string | null;
  volume: number;
  shuffle: boolean;
  loop: LoopMode;
  outputSampleRate: number | null;
  outputLabel: string;
  playAlbum: (albumId: string, trackIndex?: number) => void;
  togglePlay: () => void;
  next: (auto?: boolean) => void;
  previous: () => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  cycleLoop: () => void;

  // Intelligence
  aiStatus: AIStatus;
  isOnline: boolean;
  dossiers: Record<string, Dossier>;
  /** Albums with a dossier generation in flight. */
  drafting: Record<string, true>;
  /** Bumped when a secret changes so provider health is re-checked. */
  keyEpoch: number;
  setDossiers: (d: Record<string, Dossier>) => void;
  storeDossier: (d: Dossier) => void;

  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  updateAI: (patch: Partial<AISettings>) => void;
}

function playableFrom(album: Album, from: number, step: 1 | -1): number {
  for (let i = from; i >= 0 && i < album.tracks.length; i += step) if (album.tracks[i].playable) return i;
  return -1;
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      view: 'artists',
      setView: (view) => set({ view }),

      library: EMPTY_LIBRARY,
      albumIndex: new Map(),
      libraryReady: false,
      progress: { phase: 'idle', done: 0, total: 0 },
      config: null,
      setLibrary: (library) => {
        const albumIndex = new Map(library.albums.map((a) => [a.id, a]));
        const s = get();
        // Drop a cued album that no longer exists after a rescan.
        const albumGone = s.albumId && !albumIndex.has(s.albumId);
        set({
          library,
          albumIndex,
          libraryReady: true,
          ...(albumGone ? { albumId: null, trackIndex: 0, isPlaying: false, position: 0 } : {}),
          selectedArtistId:
            s.selectedArtistId && library.artists.some((a) => a.id === s.selectedArtistId)
              ? s.selectedArtistId
              : (library.artists[0]?.id ?? null),
        });
      },
      setProgress: (progress) => set({ progress }),
      setConfig: (config) => set({ config }),

      selectedArtistId: null,
      sourceFilter: 'all',
      sortMode: 'artist',
      query: '',
      selectArtist: (selectedArtistId) => set({ selectedArtistId }),
      setSourceFilter: (sourceFilter) => set({ sourceFilter }),
      setSortMode: (sortMode) => set({ sortMode }),
      setQuery: (query) => set({ query }),

      albumId: null,
      trackIndex: 0,
      position: 0,
      duration: 0,
      isPlaying: false,
      buffering: false,
      playbackError: null,
      volume: 80,
      shuffle: false,
      loop: 'off',
      outputSampleRate: null,
      outputLabel: 'System Default',
      playAlbum: (albumId, trackIndex = 0) => {
        const album = get().albumIndex.get(albumId);
        if (!album) return;
        const i = playableFrom(album, trackIndex, 1);
        if (i < 0) return set({ playbackError: 'No track on this release can be decoded here.' });
        set({ albumId, trackIndex: i, position: 0, duration: album.tracks[i].duration, isPlaying: true, playbackError: null, view: 'now' });
      },
      togglePlay: () => {
        if (!get().albumId) return;
        set((s) => ({ isPlaying: !s.isPlaying }));
      },
      next: (auto = false) => {
        const { shuffle, loop, trackIndex, albumId, albumIndex } = get();
        const album = albumId ? albumIndex.get(albumId) : undefined;
        if (!album) return;
        if (auto && loop === 'one') return set({ position: 0, trackIndex });
        const playable = album.tracks.map((t, i) => (t.playable ? i : -1)).filter((i) => i >= 0);
        let i: number;
        if (shuffle && playable.length > 1) {
          do i = playable[Math.floor(Math.random() * playable.length)];
          while (i === trackIndex);
        } else {
          i = playableFrom(album, trackIndex + 1, 1);
          if (i < 0 && loop === 'all') i = playableFrom(album, 0, 1);
        }
        if (i < 0) return set({ isPlaying: false, position: 0 });
        set({ trackIndex: i, position: 0, duration: album.tracks[i].duration, playbackError: null });
      },
      previous: () => {
        const { position, trackIndex, albumId, albumIndex } = get();
        const album = albumId ? albumIndex.get(albumId) : undefined;
        if (!album) return;
        // Hardware-deck convention: first press returns to the top of the cut.
        const prev = playableFrom(album, trackIndex - 1, -1);
        if (position > 3 || prev < 0) return set({ position: 0 });
        set({ trackIndex: prev, position: 0, duration: album.tracks[prev].duration });
      },
      setVolume: (volume) => set({ volume }),
      toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
      cycleLoop: () => set((s) => ({ loop: s.loop === 'off' ? 'all' : s.loop === 'all' ? 'one' : 'off' })),

      aiStatus: 'checking',
      isOnline: navigator.onLine,
      dossiers: {},
      drafting: {},
      keyEpoch: 0,
      setDossiers: (dossiers) => set({ dossiers }),
      storeDossier: (d) => set((s) => ({ dossiers: { ...s.dossiers, [d.albumId]: d } })),

      settings: defaultSettings,
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      updateAI: (patch) => set((s) => ({ settings: { ...s.settings, ai: { ...s.settings.ai, ...patch } } })),
    }),
    {
      name: 'c-note',
      version: 2,
      partialize: (s) => ({
        settings: s.settings,
        volume: s.volume,
        outputLabel: s.outputLabel,
        shuffle: s.shuffle,
        loop: s.loop,
        albumId: s.albumId,
        trackIndex: s.trackIndex,
        selectedArtistId: s.selectedArtistId,
        position: s.position,
        view: s.view,
        sortMode: s.sortMode,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return {
          ...current,
          ...p,
          settings: { ...current.settings, ...p.settings, ai: { ...current.settings.ai, ...p.settings?.ai } },
        };
      },
    },
  ),
);

export function useCurrent(): { album: Album; track: Track } | null {
  const albumId = useStore((s) => s.albumId);
  const trackIndex = useStore((s) => s.trackIndex);
  const album = useStore((s) => (albumId ? s.albumIndex.get(albumId) : undefined));
  if (!album) return null;
  return { album, track: album.tracks[Math.min(trackIndex, album.tracks.length - 1)] };
}

/** True when the intelligence engine can generate new dossiers right now. */
export function useHasAI(): boolean {
  return useStore((s) => s.settings.aiEnabled && s.aiStatus === 'online' && s.isOnline);
}

/**
 * The resilience contract: the dossier template renders only when a dossier
 * for this album is actually in hand — live, or from the offline cache when
 * the engine is unreachable. Anything else falls through to Pure Mode; there
 * is never a loading ghost or an empty panel.
 */
export function useDossier(albumId: string): Dossier | null {
  const hasAI = useHasAI();
  return useStore((s) => {
    if (!s.settings.aiEnabled) return null;
    const d = s.dossiers[albumId];
    if (!d) return null;
    return hasAI || s.settings.cacheDossiers ? d : null;
  });
}

/** Source and output run at the same rate, so the OS mixer isn't resampling. */
export function useNativeRate(): boolean | null {
  const cur = useCurrent();
  const out = useStore((s) => s.outputSampleRate);
  if (!cur?.track.format.sampleRate || !out) return null;
  return cur.track.format.sampleRate === out;
}
