# C-Note

A hi-fi desktop music player for collectors, built on Electron. Artist-first library, album art center stage, analog-style VU metering on the real signal, local folders and a Nextcloud WebDAV vault in one index, and optional AI liner-notes dossiers that fall back seamlessly to "Pure Mode".

C-Note ships with no catalogue of its own: everything on screen is read from your files' tags.

```sh
npm install
npm run dev     # Vite + Electron with hot reload
npm run build   # typecheck, renderer bundle, main/preload bundles
npm start       # build and run the production bundle
npm run dist    # package installers with electron-builder (release/)
```

## Architecture

| Path | Process | What it does |
| --- | --- | --- |
| `electron/main.ts` | main | Window, IPC handlers, scan scheduling (Nextcloud auto-sync) |
| `electron/library.ts` | main | Walks local folders and Nextcloud, parses tags with `music-metadata`, caches cover art, merges duplicates across sources, writes `library.json` |
| `electron/stream.ts` | main | `cnote://track/<id>` audio streaming with Range support (local files or proxied WebDAV); `cnote://art/<file>` covers |
| `electron/webdav.ts` | main | Minimal Nextcloud WebDAV client (PROPFIND, ranged reads) |
| `electron/dossier.ts` | main | Claude / OpenAI / Ollama dossier generation, cached in `dossiers.json` |
| `electron/secrets.ts` | main | API keys and the Nextcloud app password, encrypted with the OS keychain (`safeStorage`); never sent to the renderer |
| `electron/preload.ts` | preload | The `window.cnote` bridge (typed in `src/shared/types.ts`) |
| `src/` | renderer | React UI: `screens/`, `components/`, `audio/engine.ts` (WebAudio graph + analysers), `store.ts` (Zustand) |

App data lives in the OS user-data folder (`~/Library/Application Support/C-Note` on macOS).

## Zero-Ghost contract

Now Playing renders the dossier template only when a dossier for the album actually exists (generated, or cached for offline use). Otherwise it renders Pure Mode. Generation runs in the background; nothing shows a spinner, skeleton, or empty panel.

## Known limits

- **Shared-mode output.** Audio goes through Chromium's WebAudio and the OS mixer. C-Note shows when the source rate matches the output rate, but exclusive/bit-perfect output and DSD bitstreaming need a native audio engine, which isn't built.
- **Formats.** FLAC, ALAC, WAV, AIFF, MP3, AAC, Ogg and Opus play. DSF/DFF, WavPack and APE are indexed but marked unplayable.
- **Nextcloud tags** are read from the first 4 MB of each file; artwork larger than that is skipped unless a `cover.jpg`/`folder.jpg` sits in the album folder.
