import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod/v4';
import type { AISettings, Album, Dossier } from '../src/shared/types';
import { getLibrary } from './library';
import { getSecret } from './secrets';
import { readJson, writeJson } from './store';

/*
 * Liner-notes dossiers. Generated on demand from the album's own tags and
 * cached on disk, so a dossier written once is available offline.
 */

const CLAUDE_MODEL = 'claude-opus-5-5';
const EFFORT = { brief: 'low', standard: 'medium', monograph: 'high' } as const;

const DossierDraft = z.object({
  headline: z.string(),
  standfirst: z.string(),
  body: z.array(z.string()),
  personnel: z.array(z.object({ role: z.string(), name: z.string() })),
  artifacts: z.array(z.object({ label: z.string(), text: z.string() })),
  similar: z.array(z.object({ albumId: z.string(), reason: z.string() })),
});
type DossierDraft = z.infer<typeof DossierDraft>;
const draftJsonSchema = z.toJSONSchema(DossierDraft);

let cache: Record<string, Dossier> = readJson('dossiers.json', {});

export function allDossiers() {
  return cache;
}

export function purgeDossiers() {
  cache = {};
  writeJson('dossiers.json', cache);
}

/* ---------- prompts ---------- */

const PERSONAS: Record<AISettings['persona'], string> = {
  historian:
    'You are a jazz and recorded-music historian writing gatefold liner-note monographs for a collector’s hi-fi player. Focus on the recording sessions, studio and engineer, producers, personnel and historical context.',
  musicologist:
    'You are an acoustic musicologist writing gatefold liner-note monographs for a collector’s hi-fi player. Focus on recording and mastering lineage, studio acoustics, microphone technique, arrangement and harmonic language.',
};

const LENGTH: Record<AISettings['tokenBudget'], string> = {
  brief: 'Write 2 short paragraphs.',
  standard: 'Write 3–4 paragraphs.',
  monograph: 'Write 5–6 paragraphs.',
};

function systemPrompt(s: AISettings) {
  return [
    PERSONAS[s.persona],
    'Accuracy matters more than colour. State only facts you are confident are documented. If a detail (an exact date, a quote, a take number, a personnel credit) is uncertain, leave it out rather than guess. Never invent quotations.',
    'If you do not recognise the release, say so plainly in the standfirst, keep the body to what the supplied tags establish, and return empty personnel and artifacts lists.',
    'Write in a restrained editorial register with no marketing language.',
  ].join('\n\n');
}

function userPrompt(album: Album, s: AISettings) {
  const tags = [
    `Title: ${album.title}`,
    `Album artist: ${album.artist}`,
    album.year && `Year: ${album.year}`,
    album.label && `Label: ${album.label}${album.catalog ? ` (${album.catalog})` : ''}`,
    album.producer && `Producer: ${album.producer}`,
    album.engineer && `Engineer: ${album.engineer}`,
    album.genre && `Genre: ${album.genre}`,
    `Tracks: ${album.tracks.map((t) => t.title).join('; ')}`,
  ].filter(Boolean);
  const vault = getLibrary()
    .albums.filter((a) => a.id !== album.id)
    .slice(0, 400)
    .map((a) => `- ${a.id}: ${a.artist} — ${a.title}${a.year ? ` (${a.year})` : ''}`)
    .join('\n');
  return `Tags read from the user's files:\n${tags.map((t) => `- ${t}`).join('\n')}

${LENGTH[s.tokenBudget]} Then list the personnel (role and name), 2–4 short session artifacts or sonic trivia (label is one lowercase word), and up to 3 companion albums chosen ONLY from the user's vault below (use the exact id before the colon; return an empty list if none fit):
${vault || '(the vault has no other albums)'}`;
}

/* ---------- providers ---------- */

function parseDraft(text: string | undefined): DossierDraft | null {
  if (!text) return null;
  try {
    const r = DossierDraft.safeParse(JSON.parse(text));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

async function draftClaude(album: Album, s: AISettings): Promise<DossierDraft | null> {
  const client = new Anthropic({ apiKey: getSecret('anthropicKey') });
  const message = await client.beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    // Route policy refusals to the server's default fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: EFFORT[s.tokenBudget], format: betaZodOutputFormat(DossierDraft) },
    system: systemPrompt(s),
    messages: [{ role: 'user', content: userPrompt(album, s) }],
  });
  if (message.stop_reason === 'refusal') return null;
  return message.parsed_output ?? null;
}

async function draftOpenAI(album: Album, s: AISettings): Promise<DossierDraft | null> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${getSecret('openaiKey')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: s.openaiModel,
      messages: [
        { role: 'system', content: systemPrompt(s) },
        { role: 'user', content: userPrompt(album, s) },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'dossier', schema: draftJsonSchema } },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return parseDraft(data.choices?.[0]?.message?.content);
}

async function draftOllama(album: Album, s: AISettings): Promise<DossierDraft | null> {
  const res = await fetch(`${s.ollamaUrl.replace(/\/$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: s.ollamaModel,
      stream: false,
      format: draftJsonSchema,
      messages: [
        { role: 'system', content: systemPrompt(s) },
        { role: 'user', content: userPrompt(album, s) },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return parseDraft(data.message?.content);
}

const LABELS = { claude: 'Claude Opus 5.5', openai: 'OpenAI', ollama: 'Local Ollama' } as const;

export async function checkProvider(s: AISettings): Promise<boolean> {
  try {
    if (s.provider === 'claude') {
      const apiKey = getSecret('anthropicKey');
      if (!apiKey) return false;
      await new Anthropic({ apiKey }).models.retrieve(CLAUDE_MODEL);
      return true;
    }
    if (s.provider === 'openai') {
      const key = getSecret('openaiKey');
      if (!key) return false;
      return (await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } })).ok;
    }
    return (await fetch(`${s.ollamaUrl.replace(/\/$/, '')}/api/tags`)).ok;
  } catch {
    return false;
  }
}

const inflight = new Map<string, Promise<Dossier | null>>();

export function generateDossier(albumId: string, s: AISettings): Promise<Dossier | null> {
  if (cache[albumId]) return Promise.resolve(cache[albumId]);
  const pending = inflight.get(albumId);
  if (pending) return pending;
  const album = getLibrary().albums.find((a) => a.id === albumId);
  if (!album) return Promise.resolve(null);

  const draft = s.provider === 'claude' ? draftClaude : s.provider === 'openai' ? draftOpenAI : draftOllama;
  const job = draft(album, s)
    .then((d) => {
      if (!d) return null;
      const known = new Set(getLibrary().albums.map((a) => a.id));
      const dossier: Dossier = {
        albumId,
        headline: d.headline,
        standfirst: d.standfirst,
        body: d.body.filter(Boolean),
        personnel: d.personnel,
        artifacts: d.artifacts,
        // Drop any companion the model made up that isn't in the vault.
        similar: d.similar.filter((x) => x.albumId !== albumId && known.has(x.albumId)),
        generatedBy: `${LABELS[s.provider]} · ${s.persona === 'historian' ? 'Music Historian' : 'Acoustic Musicologist'}`,
        generatedAt: new Date().toISOString(),
      };
      cache = { ...cache, [albumId]: dossier };
      writeJson('dossiers.json', cache);
      return dossier;
    })
    .catch((err) => {
      console.warn('[c-note] dossier generation failed', err);
      return null;
    })
    .finally(() => inflight.delete(albumId));
  inflight.set(albumId, job);
  return job;
}
