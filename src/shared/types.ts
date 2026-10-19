/*
 * Types shared by the Electron main process and the renderer. Everything here
 * is derived from the user's own files: tags, stream info and file paths.
 */

export type StorageSource = 'local' | 'nextcloud';

export interface AudioFormat {
  /** Container/codec as reported by the parser, e.g. "FLAC", "MPEG 1 Layer 3", "DSD". */
  codec: string;
  sampleRate?: number;
  bitDepth?: number;
  channels?: number;
  lossless: boolean;
  /** Average bitrate in bits/s when the parser reports it. */
  bitrate?: number;
}

export interface Track {
  id: string;
  albumId: string;
  title: string;
  artist: string;
  /** Position within the album, 1-based after sorting by disc and track. */
  number: number;
  disc?: number;
  trackNo?: number;
  /** Seconds. 0 when the container doesn't expose it. */
  duration: number;
  composer?: string;
  bpm?: number;
  key?: string;
  isrc?: string;
  format: AudioFormat;
  source: StorageSource;
  /** Absolute local path, or the WebDAV href. */
  location: string;
  /** False for formats Chromium can't decode (DSF/DFF). */
  playable: boolean;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  year?: number;
  label?: string;
  catalog?: string;
  producer?: string;
  engineer?: string;
  genre?: string;
  comment?: string;
  /** cnote://art/… URL when embedded or folder art was found. */
  art?: string;
  /** Where the tracks live; "mixed" when merged across sources. */
  source: StorageSource | 'mixed';
  /** Highest-resolution format among the tracks. */
  format: AudioFormat;
  tracks: Track[];
}

export interface Artist {
  id: string;
  name: string;
  sortName: string;
}

export interface Library {
  artists: Artist[];
  albums: Album[];
  scannedAt?: string;
}

export interface NextcloudConfig {
  serverUrl: string;
  user: string;
  /** Path inside the user's files, e.g. "/Music". */
  root: string;
}

export interface LibraryConfig {
  localFolders: string[];
  nextcloud: NextcloudConfig | null;
  preferLocal: boolean;
  autoSyncMin: number;
}

export interface ScanProgress {
  phase: 'idle' | 'listing' | 'reading' | 'done' | 'error';
  source?: StorageSource;
  done: number;
  total: number;
  message?: string;
}

export type AIProvider = 'claude' | 'openai' | 'ollama';

/** Non-secret intelligence settings sent with each request to the main process. */
export interface AISettings {
  provider: AIProvider;
  openaiModel: string;
  ollamaUrl: string;
  ollamaModel: string;
  tokenBudget: 'brief' | 'standard' | 'monograph';
  persona: 'historian' | 'musicologist';
}

export interface PersonnelCredit {
  role: string;
  name: string;
}

export interface Dossier {
  albumId: string;
  headline: string;
  standfirst: string;
  /** Monograph paragraphs; the first one gets the drop cap. */
  body: string[];
  personnel: PersonnelCredit[];
  artifacts: { label: string; text: string }[];
  similar: { albumId: string; reason: string }[];
  generatedBy: string;
  generatedAt: string;
}

export type SecretName = 'anthropicKey' | 'openaiKey' | 'nextcloudPassword';

/** The bridge exposed on window.cnote by the preload script. */
export interface CNoteBridge {
  library: {
    get(): Promise<Library>;
    rescan(): Promise<Library>;
    onProgress(cb: (p: ScanProgress) => void): () => void;
    onChanged(cb: (lib: Library) => void): () => void;
  };
  config: {
    get(): Promise<LibraryConfig>;
    set(patch: Partial<LibraryConfig>): Promise<LibraryConfig>;
    pickFolder(): Promise<string | null>;
    testNextcloud(cfg: NextcloudConfig): Promise<{ ok: boolean; message: string }>;
  };
  secrets: {
    has(name: SecretName): Promise<boolean>;
    set(name: SecretName, value: string): Promise<void>;
    clear(name: SecretName): Promise<void>;
  };
  dossier: {
    all(): Promise<Record<string, Dossier>>;
    check(settings: AISettings): Promise<boolean>;
    generate(albumId: string, settings: AISettings): Promise<Dossier | null>;
    purge(): Promise<void>;
  };
  shell: {
    reveal(location: string): Promise<void>;
  };
}
