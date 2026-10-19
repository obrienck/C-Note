import { Disc3, Sparkles, Waves } from 'lucide-react';
import { Button, cx, Panel } from '../components/ui';
import { useDossierPrefetch } from '../services/dossier';
import { useCurrent, useDossier, useStore } from '../store';
import { DossierMode } from './DossierMode';
import { PureMode } from './PureMode';

/**
 * Resilience contract: render the dossier template only with a dossier in
 * hand; otherwise the page rebalances into Pure Mode.
 */
export function NowPlaying() {
  const current = useCurrent();
  const dossier = useDossier(current?.album.id ?? '');
  useDossierPrefetch(current?.album.id);

  if (!current) return <NothingCued />;
  return dossier ? (
    <DossierMode album={current.album} track={current.track} dossier={dossier} />
  ) : (
    <PureMode album={current.album} track={current.track} />
  );
}

function NothingCued() {
  const setView = useStore((s) => s.setView);
  return (
    <div className="view-enter grid min-h-full place-items-center px-6 py-16">
      <Panel className="max-w-xl p-10 text-center">
        <Disc3 className="mx-auto size-10 text-brass" />
        <h1 className="mt-5 font-serif text-[32px] text-parchment">The platter is empty</h1>
        <p className="mt-2 text-[15px] text-parchment/70">Choose a release from the Artists Index to start the deck.</p>
        <Button variant="brass" className="mt-7 px-6 py-3" onClick={() => setView('artists')}>
          Open Artists Index
        </Button>
      </Panel>
    </div>
  );
}

/** Strip-level switch between the two templates (the "user toggle" trigger). */
export function ModeSwitch({ albumId }: { albumId: string }) {
  const aiEnabled = useStore((s) => s.settings.aiEnabled);
  const update = useStore((s) => s.updateSettings);
  const zeroGhost = useStore((s) => s.settings.zeroGhost);
  const drafting = useStore((s) => Boolean(s.drafting[albumId]));
  // With Zero-Ghost on, background drafting is silent; off, it's announced.
  const announce = !zeroGhost && aiEnabled && drafting;

  return (
    <div className="flex items-center gap-1 rounded-md border border-hairline bg-obsidian p-0.5" role="radiogroup" aria-label="Now Playing template">
      {[
        { on: true, label: 'Dossier', icon: <Sparkles className="size-3" /> },
        { on: false, label: 'Pure', icon: <Waves className="size-3" /> },
      ].map((o) => (
        <button
          key={o.label}
          type="button"
          role="radio"
          aria-checked={aiEnabled === o.on}
          onClick={() => update({ aiEnabled: o.on })}
          className={cx(
            'flex items-center gap-1.5 rounded-sm px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] uppercase',
            aiEnabled === o.on ? 'bg-elevated text-brass-hi' : 'text-slate hover:text-parchment',
          )}
        >
          {o.icon}
          {o.label}
          {o.on && announce && <span className="text-signal-soft normal-case">· drafting</span>}
        </button>
      ))}
    </div>
  );
}
