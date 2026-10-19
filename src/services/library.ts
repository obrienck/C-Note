import { useEffect } from 'react';
import { useStore } from '../store';

/** Pulls the indexed library and source config from the main process and follows updates. */
export function useLibrarySync() {
  useEffect(() => {
    const { setLibrary, setProgress, setConfig } = useStore.getState();
    void window.cnote.library.get().then(setLibrary);
    void window.cnote.config.get().then(setConfig);
    const offProgress = window.cnote.library.onProgress(setProgress);
    const offChanged = window.cnote.library.onChanged(setLibrary);
    return () => {
      offProgress();
      offChanged();
    };
  }, []);
}

export async function addLocalFolder() {
  const folder = await window.cnote.config.pickFolder();
  if (!folder) return;
  const current = useStore.getState().config?.localFolders ?? [];
  if (current.includes(folder)) return;
  useStore.getState().setConfig(await window.cnote.config.set({ localFolders: [...current, folder] }));
}

export async function removeLocalFolder(folder: string) {
  const current = useStore.getState().config?.localFolders ?? [];
  useStore.getState().setConfig(await window.cnote.config.set({ localFolders: current.filter((f) => f !== folder) }));
}
