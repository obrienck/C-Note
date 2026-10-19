import { useEffect } from 'react';
import type { AIProvider } from '../shared/types';
import { useStore } from '../store';

const LABELS: Record<AIProvider, string> = { claude: 'Claude Opus 5.5', openai: 'OpenAI', ollama: 'Local Ollama' };

export function providerLabel(p: AIProvider): string {
  return LABELS[p];
}

/** Loads cached dossiers and probes the configured provider when its settings change. */
export function useAIHealth() {
  const aiEnabled = useStore((s) => s.settings.aiEnabled);
  const ai = useStore((s) => s.settings.ai);
  const keyEpoch = useStore((s) => s.keyEpoch);

  useEffect(() => {
    void window.cnote.dossier.all().then((d) => useStore.getState().setDossiers(d));
    const on = () => useStore.setState({ isOnline: true });
    const off = () => useStore.setState({ isOnline: false });
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    if (!aiEnabled) return void useStore.setState({ aiStatus: 'offline' });
    let cancelled = false;
    useStore.setState({ aiStatus: 'checking' });
    const keyName = ai.provider === 'claude' ? 'anthropicKey' : ai.provider === 'openai' ? 'openaiKey' : null;
    (async () => {
      if (keyName && !(await window.cnote.secrets.has(keyName))) return 'unset' as const;
      return (await window.cnote.dossier.check(ai)) ? ('online' as const) : ('offline' as const);
    })().then((status) => {
      if (!cancelled) useStore.setState({ aiStatus: status });
    });
    return () => {
      cancelled = true;
    };
  }, [aiEnabled, ai.provider, ai.ollamaUrl, ai.ollamaModel, ai.openaiModel, keyEpoch]);
}

const attempted = new Set<string>();

/**
 * Generates a dossier for the playing album in the background when none is
 * cached. Nothing is shown while this runs: Pure Mode stays on screen and the
 * dossier takes over only once it exists. One attempt per album per session.
 */
export function useDossierPrefetch(albumId: string | undefined) {
  const status = useStore((s) => s.aiStatus);
  const isOnline = useStore((s) => s.isOnline);
  const has = useStore((s) => (albumId ? Boolean(s.dossiers[albumId]) : true));

  useEffect(() => {
    if (!albumId || status !== 'online' || !isOnline || has || attempted.has(albumId)) return;
    attempted.add(albumId);
    useStore.setState((s) => ({ drafting: { ...s.drafting, [albumId]: true } }));
    void window.cnote.dossier
      .generate(albumId, useStore.getState().settings.ai)
      .then((d) => d && useStore.getState().storeDossier(d))
      .finally(() =>
        useStore.setState((s) => {
          const { [albumId]: _done, ...rest } = s.drafting;
          return { drafting: rest };
        }),
      );
  }, [albumId, status, isOnline, has]);
}
