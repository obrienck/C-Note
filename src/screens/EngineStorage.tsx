import {
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Cloud,
  Cpu,
  FolderMinus,
  FolderPlus,
  HardDrive,
  KeyRound,
  RefreshCw,
  Server,
  SlidersHorizontal,
  Speaker,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { VUMeter } from '../components/instruments';
import { Button, cx, Dot, Mono, Panel, SectionTitle, Segmented, SpecRow, Tag, Toggle } from '../components/ui';
import { providerLabel } from '../services/dossier';
import { addLocalFolder, removeLocalFolder } from '../services/library';
import type { AIProvider, AISettings, SecretName } from '../shared/types';
import { useStore, type Settings } from '../store';

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  icon?: ReactNode;
}) {
  return (
    <label className="block">
      <Mono>{label}</Mono>
      <span className="mt-1.5 flex items-center gap-2 rounded-sm border border-hairline bg-obsidian px-3 py-2 focus-within:border-brass/50">
        {icon}
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent font-mono text-[11.5px] tracking-[0.04em] text-parchment outline-none placeholder:text-slate-dim"
        />
      </span>
    </label>
  );
}

function CardHeader({ icon, title, subtitle, aside }: { icon: ReactNode; title: ReactNode; subtitle?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-md border border-hairline bg-elevated text-parchment/80">{icon}</span>
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 font-serif text-[22px] leading-tight text-parchment">{title}</h3>
          {subtitle && <div className="mt-1 truncate font-mono text-[11px] tracking-[0.04em] text-parchment/70">{subtitle}</div>}
        </div>
      </div>
      {aside}
    </div>
  );
}

/** A keychain-backed secret: shows whether one is stored, never its value. */
function SecretField({ name, label, onChange }: { name: SecretName; label: string; onChange?: () => void }) {
  const [stored, setStored] = useState<boolean | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void window.cnote.secrets.has(name).then(setStored);
  }, [name]);

  const save = async () => {
    try {
      await window.cnote.secrets.set(name, draft.trim());
      setDraft('');
      setStored(true);
      setError(null);
      onChange?.();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div>
      <Mono>{label}</Mono>
      {stored ? (
        <div className="mt-1.5 flex items-center justify-between gap-3 rounded-sm border border-hairline bg-obsidian px-3 py-2">
          <span className="flex items-center gap-2 font-mono text-[11px] text-signal-soft">
            <KeyRound className="size-3.5" /> Stored in OS keychain
          </span>
          <button
            type="button"
            className="font-mono text-[10px] tracking-[0.1em] text-slate uppercase hover:text-clip"
            onClick={async () => {
              await window.cnote.secrets.clear(name);
              setStored(false);
              onChange?.();
            }}
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="mt-1.5 flex gap-2">
          <span className="flex flex-1 items-center gap-2 rounded-sm border border-hairline bg-obsidian px-3 py-2 focus-within:border-brass/50">
            <KeyRound className="size-3.5 text-slate" />
            <input
              type="password"
              value={draft}
              placeholder="Paste to store in the keychain"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && draft.trim() && save()}
              className="w-full bg-transparent font-mono text-[11.5px] text-parchment outline-none placeholder:text-slate-dim"
            />
          </span>
          <Button variant="mono" disabled={!draft.trim()} onClick={save}>
            Save
          </Button>
        </div>
      )}
      {error && <p className="mt-1.5 font-mono text-[10.5px] text-clip">{error}</p>}
    </div>
  );
}

export function EngineStorage() {
  const library = useStore((s) => s.library);
  const outRate = useStore((s) => s.outputSampleRate);
  const tracks = library.albums.reduce((n, a) => n + a.tracks.length, 0);

  return (
    <div className="view-enter mx-auto max-w-[1800px] px-6 pt-9 pb-12 xl:px-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <Tag tone="brass">C-Note · System Configuration</Tag>
          </div>
          <h1 className="mt-3 font-serif text-[clamp(32px,3vw,44px)] leading-tight text-parchment">Audio Engine, Storage &amp; Intelligence</h1>
          <p className="mt-2 max-w-3xl text-[15px] text-parchment/75">
            Where your music lives, the liner-notes engine, and the output path.
          </p>
        </div>
        <Panel className="flex items-center divide-x divide-hairline px-2 py-3">
          {[
            ['Releases', library.albums.length.toLocaleString()],
            ['Tracks Indexed', tracks.toLocaleString()],
            ['Output Rate', outRate ? `${+(outRate / 1000).toFixed(1)} kHz` : 'Standby'],
          ].map(([k, v]) => (
            <div key={k} className="px-5">
              <Mono>{k}</Mono>
              <div className="mt-1 font-mono text-[14px] text-signal-soft">{v}</div>
            </div>
          ))}
        </Panel>
      </div>

      <section className="mt-14">
        <SectionTitle icon={<Server className="size-5" />} aside={<RescanControl />}>
          Storage Sources &amp; WebDAV Mounts
        </SectionTitle>
        <div className="grid gap-7 xl:grid-cols-[1fr_1.15fr]">
          <LocalCard />
          <NextcloudCard />
        </div>
      </section>

      <section className="mt-14">
        <IntelligenceSection />
      </section>

      <section className="mt-14">
        <SectionTitle icon={<Cpu className="size-5" />}>Audio Output &amp; Metering</SectionTitle>
        <div className="grid gap-7 lg:grid-cols-3">
          <OutputCard />
          <CompatibilityCard />
          <BallisticsCard />
        </div>
      </section>
    </div>
  );
}

function RescanControl() {
  const progress = useStore((s) => s.progress);
  const scannedAt = useStore((s) => s.library.scannedAt);
  const busy = progress.phase === 'listing' || progress.phase === 'reading';
  return (
    <div className="flex items-center gap-4">
      <Mono tone={progress.phase === 'error' ? 'brass' : 'parchment'}>
        {busy
          ? progress.total
            ? `Indexing ${progress.done} / ${progress.total}`
            : 'Listing files…'
          : progress.phase === 'error'
            ? progress.message
            : scannedAt
              ? `Last scan ${new Date(scannedAt).toLocaleString()}`
              : 'Not scanned yet'}
      </Mono>
      <Button variant="mono" disabled={busy} onClick={() => window.cnote.library.rescan()}>
        <RefreshCw className={cx('size-3.5', busy && 'animate-spin')} /> Rescan
      </Button>
    </div>
  );
}

function LocalCard() {
  const config = useStore((s) => s.config);
  const setConfig = useStore((s) => s.setConfig);
  const library = useStore((s) => s.library);
  const folders = config?.localFolders ?? [];
  const localTracks = library.albums.flatMap((a) => a.tracks).filter((t) => t.source === 'local').length;

  return (
    <Panel className="flex flex-col p-7">
      <CardHeader
        icon={<HardDrive className="size-5" />}
        title="Local Folders"
        subtitle={folders.length ? `${localTracks} tracks indexed from ${folders.length} folder${folders.length === 1 ? '' : 's'}` : 'No folders added'}
        aside={
          folders.length > 0 && (
            <Tag tone="signal">
              <Dot /> Mounted
            </Tag>
          )
        }
      />
      <ul className="mt-6 space-y-2">
        {folders.map((f) => (
          <li key={f} className="flex items-center justify-between gap-3 rounded-sm bg-obsidian/70 px-4 py-2.5">
            <span className="truncate font-mono text-[11.5px] text-parchment/85" title={f}>
              {f}
            </span>
            <button
              type="button"
              aria-label={`Remove ${f}`}
              onClick={() => removeLocalFolder(f)}
              className="shrink-0 text-slate hover:text-clip"
            >
              <FolderMinus className="size-4" />
            </button>
          </li>
        ))}
        {folders.length === 0 && (
          <li className="rounded-sm border border-dashed border-hairline px-4 py-5 text-center text-[13px] text-slate">
            Add the folder that holds your music. Subfolders are scanned too.
          </li>
        )}
      </ul>
      <div className="mt-5 flex items-center justify-between gap-4 rounded-sm bg-elevated/60 px-4 py-4">
        <div>
          <div className="text-[14px] text-parchment">Prefer Local Over Remote</div>
          <p className="mt-1 text-[12px] text-slate">When a track exists both locally and on Nextcloud, play the local copy.</p>
        </div>
        <Toggle
          label="Prefer local copies"
          tone="brass"
          on={config?.preferLocal ?? true}
          onChange={async (v) => setConfig(await window.cnote.config.set({ preferLocal: v }))}
        />
      </div>
      <div className="mt-auto flex justify-end pt-6">
        <Button variant="ghost" onClick={addLocalFolder}>
          <FolderPlus className="size-4" /> Add Local Folder
        </Button>
      </div>
    </Panel>
  );
}

function NextcloudCard() {
  const config = useStore((s) => s.config);
  const setConfig = useStore((s) => s.setConfig);
  const library = useStore((s) => s.library);
  const nc = config?.nextcloud;
  const [draft, setDraft] = useState({ serverUrl: nc?.serverUrl ?? '', user: nc?.user ?? '', root: nc?.root ?? '/Music' });
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const remoteTracks = library.albums.flatMap((a) => a.tracks).filter((t) => t.source === 'nextcloud').length;
  const tls = draft.serverUrl.startsWith('https://');
  const valid = /^https?:\/\/.+/.test(draft.serverUrl) && draft.user.trim().length > 0;
  const dirty = !nc || nc.serverUrl !== draft.serverUrl || nc.user !== draft.user || nc.root !== draft.root;

  useEffect(() => {
    if (nc) setDraft({ serverUrl: nc.serverUrl, user: nc.user, root: nc.root });
  }, [nc]);

  const runTest = async () => {
    setTesting(true);
    setTest(await window.cnote.config.testNextcloud({ ...draft, serverUrl: draft.serverUrl.replace(/\/$/, '') }));
    setTesting(false);
  };

  return (
    <Panel className="p-7">
      <CardHeader
        icon={<Cloud className="size-5" />}
        title={
          <>
            Nextcloud Private Vault
            {draft.serverUrl && <Tag tone={tls ? 'signal' : 'brass'}>{tls ? 'TLS' : 'Unencrypted HTTP'}</Tag>}
          </>
        }
        subtitle={nc ? `${remoteTracks} tracks indexed · ${nc.serverUrl}` : 'Not connected'}
        aside={
          <Tag tone={nc ? 'signal' : 'plain'}>
            <Dot tone={nc ? 'signal' : 'dim'} /> {nc ? 'Linked' : 'Off'}
          </Tag>
        }
      />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Server URL" placeholder="https://cloud.example.com" value={draft.serverUrl} onChange={(v) => setDraft({ ...draft, serverUrl: v })} />
        <Field label="User" value={draft.user} onChange={(v) => setDraft({ ...draft, user: v })} />
        <Field label="Music Folder" placeholder="/Music" value={draft.root} onChange={(v) => setDraft({ ...draft, root: v })} />
        <SecretField name="nextcloudPassword" label="App Password" />
      </div>
      <p className="mt-3 text-[12px] text-slate">Create an app password in Nextcloud under Settings → Security → Devices &amp; sessions.</p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-sm bg-obsidian/70 px-4 py-3">
        <span className={cx('flex items-center gap-2 text-[12.5px]', test ? (test.ok ? 'text-signal-soft' : 'text-clip') : 'text-slate')}>
          {test ? test.ok ? <CheckCircle2 className="size-4" /> : <TriangleAlert className="size-4" /> : null}
          {test?.message ?? 'Test the connection before linking.'}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="mono" disabled={!valid || testing} onClick={runTest}>
            {testing ? 'Testing…' : 'Test'}
          </Button>
          {nc && !dirty ? (
            <Button variant="mono" onClick={async () => setConfig(await window.cnote.config.set({ nextcloud: null }))}>
              Disconnect
            </Button>
          ) : (
            <Button
              variant="brass"
              disabled={!valid}
              onClick={async () =>
                setConfig(
                  await window.cnote.config.set({
                    nextcloud: { serverUrl: draft.serverUrl.replace(/\/$/, ''), user: draft.user.trim(), root: draft.root || '/' },
                  }),
                )
              }
            >
              {nc ? 'Save' : 'Link Vault'}
            </Button>
          )}
        </div>
      </div>

      {nc && (
        <div className="mt-4 flex items-center justify-between">
          <Mono>Auto-Sync</Mono>
          <Segmented<number>
            size="sm"
            value={config?.autoSyncMin ?? 15}
            onChange={async (v) => setConfig(await window.cnote.config.set({ autoSyncMin: v }))}
            options={[
              { value: 0, label: 'Off' },
              { value: 15, label: '15 min' },
              { value: 60, label: '1 hr' },
            ]}
          />
        </div>
      )}
    </Panel>
  );
}

const PROVIDER_COPY: Record<AIProvider, string> = {
  claude: 'Careful historical provenance reasoning; declines rather than guesses.',
  openai: 'General-purpose drafting against your own OpenAI account.',
  ollama: 'Runs entirely on this machine; nothing leaves your listening room.',
};

function IntelligenceSection() {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const updateAI = useStore((s) => s.updateAI);
  const aiStatus = useStore((s) => s.aiStatus);
  const bumpKeys = () => useStore.setState((s) => ({ keyEpoch: s.keyEpoch + 1 }));
  const cached = useStore((s) => Object.keys(s.dossiers).length);
  const ai = settings.ai;

  const pill: [string, 'signal' | 'brass' | 'dim'] = !settings.aiEnabled
    ? ['Disabled', 'dim']
    : aiStatus === 'online'
      ? ['Active', 'signal']
      : aiStatus === 'checking'
        ? ['Checking', 'brass']
        : aiStatus === 'unset'
          ? ['Key Needed', 'brass']
          : ['Unreachable', 'brass'];

  return (
    <>
      <SectionTitle
        icon={<BrainCircuit className="size-5" />}
        aside={
          <span className="flex items-center gap-2">
            <Mono tone={pill[1] === 'signal' ? 'signal' : 'brass'}>{pill[1] === 'signal' ? 'Model Context Ready' : 'Pure Mode Fallback'}</Mono>
            <Dot tone={pill[1]} pulse={aiStatus === 'checking'} />
          </span>
        }
      >
        Intelligence &amp; Gatefold Dossier Engine
      </SectionTitle>
      <div className="grid gap-7 xl:grid-cols-[1.6fr_1fr]">
        <Panel className="p-7">
          <CardHeader
            icon={<BookOpen className="size-5" />}
            title="Liner Notes Dossier Generator"
            subtitle="Writes session notes, personnel and context from each album’s tags."
            aside={
              <span className="flex items-center gap-3 rounded-sm border border-hairline bg-obsidian px-3 py-2">
                <Mono tone="parchment">Engine: {pill[0]}</Mono>
                <Toggle label="Enable intelligence engine" on={settings.aiEnabled} onChange={(v) => update({ aiEnabled: v })} />
              </span>
            }
          />
          <Mono className="mt-7 block">Inference Provider</Mono>
          <div className="mt-3 grid gap-3 md:grid-cols-3" role="radiogroup">
            {(['claude', 'openai', 'ollama'] as AIProvider[]).map((p) => {
              const on = ai.provider === p;
              return (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => updateAI({ provider: p })}
                  className={cx(
                    'rounded-md border p-4 text-left transition-colors',
                    on ? 'border-brass/50 bg-elevated' : 'border-hairline bg-obsidian/60 hover:bg-elevated/50',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cx('text-[15px]', on ? 'text-brass-hi' : 'text-parchment')}>{providerLabel(p)}</span>
                    {on && <Dot tone={pill[1]} />}
                  </div>
                  <p className="mt-2 text-[12px] leading-[1.5] text-slate">{PROVIDER_COPY[p]}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {ai.provider === 'ollama' ? (
              <>
                <Field label="Ollama Endpoint" value={ai.ollamaUrl} onChange={(v) => updateAI({ ollamaUrl: v })} />
                <Field label="Local Model" value={ai.ollamaModel} onChange={(v) => updateAI({ ollamaModel: v })} />
              </>
            ) : (
              <>
                <SecretField
                  key={ai.provider}
                  name={ai.provider === 'claude' ? 'anthropicKey' : 'openaiKey'}
                  label={`${ai.provider === 'claude' ? 'Anthropic' : 'OpenAI'} API Key`}
                  onChange={bumpKeys}
                />
                {ai.provider === 'openai' && <Field label="Model" value={ai.openaiModel} onChange={(v) => updateAI({ openaiModel: v })} />}
              </>
            )}
            <div>
              <Mono>Length</Mono>
              <Segmented<AISettings['tokenBudget']>
                className="mt-1.5"
                value={ai.tokenBudget}
                onChange={(v) => updateAI({ tokenBudget: v })}
                options={[
                  { value: 'brief', label: 'Brief' },
                  { value: 'standard', label: 'Standard' },
                  { value: 'monograph', label: 'Monograph' },
                ]}
              />
            </div>
          </div>

          <Mono className="mt-7 block">Curator Persona</Mono>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {(
              [
                ['historian', 'Music Historian', 'Sessions, studios, producers and engineers; who played what, where, and why it mattered.'],
                ['musicologist', 'Acoustic Musicologist', 'Recording lineage, room acoustics, microphone technique and harmonic language.'],
              ] as const
            ).map(([id, name, copy]) => (
              <button
                key={id}
                type="button"
                onClick={() => updateAI({ persona: id })}
                aria-pressed={ai.persona === id}
                className={cx(
                  'rounded-md border p-4 text-left',
                  ai.persona === id ? 'border-brass/40 bg-obsidian' : 'border-hairline bg-obsidian/50 opacity-70 hover:opacity-100',
                )}
              >
                <div className={cx('font-serif text-[19px]', ai.persona === id ? 'text-brass-hi' : 'text-parchment')}>{name}</div>
                <p className="mt-1.5 text-[12.5px] leading-[1.5] text-parchment/70">{copy}</p>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="flex flex-col p-7">
          <h3 className="flex items-center gap-3 font-serif text-[22px] text-parchment">
            <SlidersHorizontal className="size-5 text-brass" /> Resilience &amp; Cache
          </h3>
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between gap-4 rounded-sm bg-obsidian/70 px-4 py-4">
              <div>
                <div className="text-[14px] text-parchment">Seamless Zero-Ghost UI</div>
                <p className="mt-1 text-[12px] text-slate">Draft dossiers silently; Pure Mode holds the screen until one is ready.</p>
              </div>
              <Toggle label="Zero-Ghost UI" on={settings.zeroGhost} onChange={(v) => update({ zeroGhost: v })} />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-sm bg-obsidian/70 px-4 py-4">
              <div>
                <div className="text-[14px] text-parchment">Show Cached Dossiers Offline</div>
                <p className="mt-1 text-[12px] text-slate">Keep showing saved monographs when the provider is unreachable.</p>
              </div>
              <Toggle label="Show cached dossiers offline" tone="brass" on={settings.cacheDossiers} onChange={(v) => update({ cacheDossiers: v })} />
            </div>
            <div className="rounded-sm border border-hairline/60 px-4 py-3">
              <SpecRow label="Fallback Trigger" value="Off · Key missing · Offline" valueTone="parchment" />
              <SpecRow label="Fallback Template" value="Pure Mode · VU Master" valueTone="signal" />
            </div>
          </div>
          <div className="mt-auto flex items-center justify-between gap-4 rounded-sm bg-obsidian/70 px-4 py-3">
            <div>
              <Mono>Cached Dossiers</Mono>
              <div className="mt-1 font-mono text-[14px] text-signal-soft">
                {cached} Album{cached === 1 ? '' : 's'}
              </div>
            </div>
            <Button
              variant="mono"
              disabled={!cached}
              onClick={async () => {
                await window.cnote.dossier.purge();
                useStore.getState().setDossiers({});
              }}
            >
              Purge Cache
            </Button>
          </div>
        </Panel>
      </div>
    </>
  );
}

function useOutputDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    const load = () =>
      navigator.mediaDevices
        ?.enumerateDevices()
        .then((list) => setDevices(list.filter((d) => d.kind === 'audiooutput' && d.deviceId !== 'default')))
        .catch(() => setDevices([]));
    void load();
    navigator.mediaDevices?.addEventListener('devicechange', load);
    return () => navigator.mediaDevices?.removeEventListener('devicechange', load);
  }, []);
  return devices;
}

function OutputCard() {
  const deviceId = useStore((s) => s.settings.outputDeviceId);
  const update = useStore((s) => s.updateSettings);
  const outRate = useStore((s) => s.outputSampleRate);
  const devices = useOutputDevices();

  const choose = (id: string) => {
    const label = id === 'default' ? 'System Default' : (devices.find((d) => d.deviceId === id)?.label ?? 'Output device');
    update({ outputDeviceId: id });
    useStore.setState({ outputLabel: label });
  };

  return (
    <Panel className="flex flex-col p-7">
      <Mono>Audio Endpoint Device</Mono>
      <div className="mt-5 flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-md bg-elevated text-brass">
          <Speaker className="size-6" />
        </span>
        <select
          aria-label="Output device"
          value={deviceId}
          onChange={(e) => choose(e.target.value)}
          className="min-w-0 flex-1 truncate bg-transparent font-serif text-[21px] text-parchment outline-none"
        >
          <option value="default" className="bg-panel font-sans text-sm">
            System Default
          </option>
          {devices.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId} className="bg-panel font-sans text-sm">
              {d.label || `Output ${i + 1}`}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-5 space-y-1 rounded-sm bg-obsidian/70 px-4 py-3">
        <SpecRow label="Output Rate" value={outRate ? `${+(outRate / 1000).toFixed(1)} kHz` : 'Starts with playback'} valueTone="signal" />
        <SpecRow label="Engine" value="WebAudio · Float32" valueTone="parchment" />
        <SpecRow label="Mode" value="Shared (OS mixer)" valueTone="parchment" />
      </div>
      <p className="mt-4 text-[12px] leading-[1.55] text-slate">
        Set your DAC’s rate in the OS audio settings to match your library; the top bar shows when playback runs at the native rate.
      </p>
    </Panel>
  );
}

function CompatibilityCard() {
  const library = useStore((s) => s.library);
  const all = library.albums.flatMap((a) => a.tracks);
  const blocked = all.filter((t) => !t.playable);
  const byExt = new Map<string, number>();
  for (const t of blocked) {
    const ext = t.location.split('.').pop()?.toUpperCase() ?? '?';
    byExt.set(ext, (byExt.get(ext) ?? 0) + 1);
  }
  const lossless = all.filter((t) => t.format.lossless).length;

  return (
    <Panel className="flex flex-col p-7">
      <div className="flex items-center justify-between">
        <Mono>Decoder Coverage</Mono>
        <Mono tone={blocked.length ? 'brass' : 'signal'}>{blocked.length ? `${blocked.length} Unplayable` : 'All Playable'}</Mono>
      </div>
      <h3 className="mt-4 font-serif text-[22px] text-parchment">Formats in Your Vault</h3>
      <div className="mt-4 space-y-1 rounded-sm bg-obsidian/70 px-4 py-3">
        <SpecRow label="Tracks" value={all.length.toLocaleString()} valueTone="parchment" />
        <SpecRow label="Lossless" value={lossless.toLocaleString()} valueTone="signal" />
        <SpecRow label="Lossy" value={(all.length - lossless).toLocaleString()} valueTone="parchment" />
        {[...byExt].map(([ext, n]) => (
          <SpecRow key={ext} label={`${ext} (no decoder)`} value={n.toLocaleString()} />
        ))}
      </div>
      <p className="mt-4 text-[12px] leading-[1.55] text-slate">
        FLAC, ALAC, WAV, AIFF, MP3, AAC, Ogg and Opus play directly. DSF/DFF, WavPack and APE are indexed but need a native decoder, which isn’t
        built yet.
      </p>
    </Panel>
  );
}

function BallisticsCard() {
  const vuReference = useStore((s) => s.settings.vuReference);
  const update = useStore((s) => s.updateSettings);
  return (
    <Panel className="flex flex-col p-7">
      <div className="flex items-center justify-between">
        <Mono>Ballistics Calibration</Mono>
        <Mono tone="brass">0 VU = {vuReference} dBFS</Mono>
      </div>
      <h3 className="mt-4 font-serif text-[22px] text-parchment">Analog VU Ballistics &amp; Scale</h3>
      <p className="mt-1.5 text-[12.5px] leading-[1.5] text-parchment/70">
        Where 0 VU sits on the digital scale. −18 dBFS is the EBU alignment; −14 dBFS suits quieter, highly dynamic masters.
      </p>
      <div className="mt-4">
        <VUMeter channel={0} label="Calibration" />
      </div>
      <Segmented<Settings['vuReference']>
        className="mt-4"
        value={vuReference}
        onChange={(v) => update({ vuReference: v })}
        options={([-20, -18, -14] as const).map((v) => ({ value: v, label: `${v} dBFS` }))}
      />
    </Panel>
  );
}
