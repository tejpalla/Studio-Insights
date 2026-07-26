import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { extractStructureFromEpisodes } from './src/lib/scriptGrounding.ts';
import {
  REDDIT_ROOM_SYSTEM,
  buildInsightsUserPrompt,
} from './src/lib/redditRoomPrompt.ts';
import { buildEngagementFunnel } from './src/lib/normalizeInsights.ts';
import {
  arenaEventsToJsonl,
  arenaToInsightsPayload,
  createArena,
  runArena,
} from './src/lib/redditArena.ts';
import {
  buildArenaExportPack,
  isDatabricksConfigured,
  syncArenaPackToDatabricksFree,
} from './src/lib/databricksFree.ts';

import { generateArenaTurnJson } from './src/lib/arenaLlm.ts';
import { isolationStatus } from './src/lib/agentWorkerPool.ts';

dotenv.config();

const app = express();
// Cloud hosts (including Render) assign the listening port at runtime.
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing. Add it to your .env file.');
  }
  return new OpenAI({ apiKey });
}

/** Agent turns: defaults to flagship; override with OPENAI_ARENA_MODEL */
function getArenaModel(): string {
  return (process.env.OPENAI_ARENA_MODEL || process.env.OPENAI_MODEL || 'gpt-5.4-pro').trim();
}

async function generateAgentJson(system: string, user: string): Promise<string> {
  return generateArenaTurnJson(system, user);
}

function persistArenaRun(runId: string, jsonl: string, payload: unknown) {
  try {
    const dir = path.join(process.cwd(), 'data', 'arena-runs');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${runId}.jsonl`), jsonl, 'utf8');
    fs.writeFileSync(path.join(dir, `${runId}.summary.json`), JSON.stringify(payload, null, 2), 'utf8');
  } catch (err: any) {
    console.warn('Could not persist arena run:', err?.message || err);
  }
}

/** Local pack + Databricks Unity Catalog volume sync. */
async function finalizeArenaWithDatabricks(state: any, sync = true) {
  const jsonl = arenaEventsToJsonl(state);
  persistArenaRun(state.runId, jsonl, {
    runId: state.runId,
    title: state.title,
    agents: state.agents.map((a: any) => ({
      id: a.id,
      username: a.username,
      archetype: a.archetype,
    })),
    postCount: state.posts.length,
    eventCount: state.events.length,
  });
  const pack = buildArenaExportPack(state, jsonl);
  const databricks = await syncArenaPackToDatabricksFree(pack, { sync });
  console.log('[Databricks Free]', databricks.mode, databricks.volumePath || databricks.localDir, databricks.message);
  return { jsonl, databricks };
}

/** Flagship default: gpt-5.4-pro. Override with OPENAI_MODEL=gpt-5.4|gpt-5.6|etc. */
function getRoomModel(): string {
  return (process.env.OPENAI_MODEL || 'gpt-5.4-pro').trim();
}

function getReasoningEffort(): 'low' | 'medium' | 'high' | 'xhigh' {
  const v = (process.env.OPENAI_REASONING_EFFORT || 'xhigh').trim().toLowerCase();
  if (v === 'low' || v === 'medium' || v === 'high' || v === 'xhigh') return v;
  return 'xhigh';
}

function usesResponsesReasoning(model: string): boolean {
  return /^gpt-5/i.test(model) || /^o[1-9]/i.test(model);
}

/**
 * Room / insights on flagship via Responses API (reasoning + JSON),
 * with Chat Completions fallback for older model overrides.
 */
async function generateRoomJson(system: string, user: string): Promise<string> {
  const openai = getOpenAIClient();
  const model = getRoomModel();
  const reasoning = usesResponsesReasoning(model);

  if (reasoning && typeof (openai as any).responses?.create === 'function') {
    try {
      const response = await (openai as any).responses.create({
        model,
        reasoning: { effort: getReasoningEffort() },
        input: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        text: { format: { type: 'json_object' } },
        max_output_tokens: 16000,
      });
      const text =
        response.output_text ||
        response.output
          ?.flatMap((item: any) => item?.content || [])
          ?.filter((c: any) => c?.type === 'output_text' || c?.text)
          ?.map((c: any) => c.text || c.output_text || '')
          ?.join('') ||
        '';
      if (text?.trim()) return text;
      console.warn('Responses API returned empty text — falling back to chat.completions');
    } catch (err: any) {
      console.warn('Responses API failed, falling back to chat.completions:', err?.message || err);
    }
  }

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
    ...(reasoning
      ? { max_completion_tokens: 16000 }
      : { temperature: 0.85, max_tokens: 16000 }),
  } as any);

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('Model returned an empty response.');
  return content;
}

const INSIGHTS_SYSTEM = REDDIT_ROOM_SYSTEM;

function coerceRoomComments(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') return Object.values(raw as Record<string, unknown>);
  return [];
}

function flattenPostComments(posts: any[]): any[] {
  const out: any[] = [];
  for (const p of posts || []) {
    for (const c of p?.comments || []) out.push(c);
  }
  return out;
}

/** If the model stuffs the thread under one parent, promote meaty replies to top-level. */
function expandThinThread(comments: any[]): any[] {
  if (!Array.isArray(comments) || comments.length === 0) return [];
  if (comments.length >= 4) return comments;

  const out = [...comments];
  for (const c of comments) {
    const replies = Array.isArray(c?.replies) ? c.replies : [];
    if (comments.length <= 2 && replies.length >= 3) {
      for (let i = 0; i < replies.length; i++) {
        const r = replies[i];
        const body = String(r?.body || '').trim();
        if (body.length < 20) continue;
        out.push({
          id: r?.id || `promoted_${c?.id || 'c'}_${i}`,
          username: r?.username || `reply_user_${i}`,
          vibe: i % 3 === 0 ? 'mid' : i % 3 === 1 ? 'solid' : 'slop',
          upvotes: Number(r?.upvotes) || Math.max(3, 40 - i * 5),
          body,
          talksAbout: `reply to ${c?.username || 'op'}`,
          replies: [],
        });
      }
    }
  }
  return out;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.min(100, value));
  if (typeof value === 'string') {
    const m = value.match(/-?\d+(\.\d+)?/);
    if (m) return Math.max(0, Math.min(100, Number(m[0])));
  }
  return fallback;
}

function normalizeCharacter(raw: unknown, index: number) {
  if (typeof raw === 'string' && raw.trim()) {
    return {
      name: raw.trim(),
      role: 'Character',
      firstAppearsEpisode: 0,
    };
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const name = String(o.name || o.username || '').trim();
    const ep = Number(o.firstAppearsEpisode || o.episode);
    return {
      name: name || '',
      role: String(o.role || o.description || 'Character'),
      firstAppearsEpisode: Number.isFinite(ep) && ep > 0 ? ep : 0,
      notes: o.notes ? String(o.notes) : undefined,
    };
  }
  return { name: '', role: 'Character', firstAppearsEpisode: 0 };
}

function normalizeScene(raw: unknown, index: number) {
  if (typeof raw === 'string') {
    return {
      id: `s${index + 1}`,
      episodeNumber: 1,
      order: index + 1,
      title: raw,
      summary: raw,
      charactersPresent: [] as string[],
    };
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    return {
      id: String(o.id || `s${index + 1}`),
      episodeNumber: Number(o.episodeNumber || o.episode || 1) || 1,
      order: Number(o.order || index + 1) || index + 1,
      title: String(o.title || o.name || `Scene ${index + 1}`),
      summary: String(o.summary || o.description || o.title || ''),
      charactersPresent: Array.isArray(o.charactersPresent)
        ? o.charactersPresent.map(String)
        : [],
    };
  }
  return {
    id: `s${index + 1}`,
    episodeNumber: 1,
    order: index + 1,
    title: `Scene ${index + 1}`,
    summary: '',
    charactersPresent: [] as string[],
  };
}

function normalizeTimeline(raw: unknown, index: number) {
  if (typeof raw === 'string') {
    return { episodeNumber: index + 1, label: raw, summary: raw };
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    return {
      episodeNumber: Number(o.episodeNumber || index + 1) || index + 1,
      label: String(o.label || o.title || `Beat ${index + 1}`),
      summary: String(o.summary || o.description || o.label || ''),
    };
  }
  return { episodeNumber: index + 1, label: `Beat ${index + 1}`, summary: '' };
}

function normalizePersona(raw: unknown, index: number) {
  if (!raw || typeof raw !== 'object') {
    return {
      id: `p${index + 1}`,
      name: `listener_${index + 1}`,
      profile: '',
      quitEpisode: 0,
      quitScene: '',
      reason: '',
      beatExcerpt: '',
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id || `p${index + 1}`),
    name: String(o.name || o.username || `listener_${index + 1}`),
    profile: String(o.profile || o.flair || ''),
    quitEpisode: Number(o.quitEpisode || 0) || 0,
    quitScene: o.quitScene == null ? '' : String(o.quitScene),
    reason: String(o.reason || ''),
    beatExcerpt: String(o.beatExcerpt || ''),
  };
}

/** If model skips cut or invents original text, build a script-backed Your call. */
function ensureCut(
  cut: any,
  comments: any[],
  episodes: Array<{ episodeNumber?: number; title?: string; scriptText?: string }>
) {
  if (!episodes.length) return cut && cut.original ? cut : null;

  const scored = scoreDisputedEpisode(comments, episodes);
  const epIndex = scored.index;
  const ep = episodes[epIndex];
  const epNum = Number(ep.episodeNumber) || epIndex + 1;
  const title = (ep.title || `Episode ${epNum}`).trim();
  const script = ep.scriptText || '';
  const excerpt = pickBeatExcerpt(script);

  const consensus =
    scored.consensus ||
    (Array.isArray(comments) && comments[0]?.body
      ? String(comments[0].body).slice(0, 160)
      : 'The room kept poking at this stretch.');

  const hasUsable =
    cut &&
    typeof cut === 'object' &&
    String(cut.fast || '').trim().length > 40 &&
    String(cut.detailed || '').trim().length > 40;

  // Prefer real script excerpt as original so Accept can find it in the episode
  const originalFromModel = String(cut?.original || '').trim();
  const originalInScript =
    originalFromModel.length > 60 &&
    script.replace(/\s+/g, ' ').includes(originalFromModel.replace(/\s+/g, ' ').slice(0, 80));
  const original = originalInScript ? originalFromModel : excerpt;

  if (hasUsable) {
    return {
      episodeNumber: Number(cut.episodeNumber) || epNum,
      beatLabel: String(cut.beatLabel || title),
      original,
      fast: String(cut.fast),
      detailed: String(cut.detailed),
      explanation: String(
        cut.explanation ||
          'Two alternate takes on the stretch the room argued about — your call, not an order.'
      ),
      threadConsensus: String(cut.threadConsensus || consensus),
    };
  }

  // Fully local fallback — still gives the writer something to try
  const fast = tightenBeat(original);
  const detailed = enrichBeat(original);

  return {
    episodeNumber: epNum,
    beatLabel: title,
    original,
    fast,
    detailed,
    explanation:
      'Built from the episode the room mentioned most. Tighter vs richer — keep, tweak, or ignore.',
    threadConsensus: consensus,
  };
}

function scoreDisputedEpisode(
  comments: any[],
  episodes: Array<{ episodeNumber?: number; title?: string; scriptText?: string }>
): { index: number; consensus: string } {
  const scores = episodes.map(() => 0);
  const snippets: string[] = [];

  for (const c of comments || []) {
    const blob = `${c?.body || ''} ${c?.talksAbout || ''}`.toLowerCase();
    const weight = c?.vibe === 'slop' || c?.vibe === 'mid' ? 3 : c?.vibe === 'solid' ? 1 : 0.5;
    if (c?.vibe === 'mid' || c?.vibe === 'slop') {
      snippets.push(String(c.body || '').slice(0, 140));
    }
    episodes.forEach((ep, i) => {
      const n = Number(ep.episodeNumber) || i + 1;
      const title = (ep.title || '').toLowerCase();
      if (blob.includes(`ep ${n}`) || blob.includes(`ep${n}`) || blob.includes(`episode ${n}`)) {
        scores[i] += weight * 2;
      }
      if (title && title.length > 3 && blob.includes(title.slice(0, Math.min(title.length, 18)))) {
        scores[i] += weight * 2;
      }
      // Character / keyword hits from early script text
      const hook = (ep.scriptText || '').slice(0, 200).toLowerCase();
      const words = hook.match(/\b[a-z]{5,}\b/g) || [];
      for (const w of words.slice(0, 8)) {
        if (blob.includes(w)) scores[i] += weight * 0.15;
      }
    });
    for (const r of c?.replies || []) {
      const rb = String(r?.body || '').toLowerCase();
      episodes.forEach((ep, i) => {
        const n = Number(ep.episodeNumber) || i + 1;
        if (rb.includes(`ep ${n}`) || rb.includes(`episode ${n}`)) scores[i] += 1.5;
      });
    }
  }

  let best = 0;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > scores[best]) best = i;
  }
  // Prefer a mid-series episode if everything tied at 0 (more interesting than always Ep1)
  if (scores[best] === 0 && episodes.length > 2) {
    best = Math.min(episodes.length - 1, Math.floor(episodes.length / 3));
  }

  return {
    index: best,
    consensus: snippets.filter(Boolean).slice(0, 2).join(' / ') || '',
  };
}

function pickBeatExcerpt(script: string): string {
  const cleaned = script.trim();
  if (!cleaned) return '[No script text for this episode]';

  // Prefer a dialogue block mid-episode
  const parts = cleaned.split(/\n\n+/).filter((p) => p.trim().length > 40);
  let pick = parts[Math.floor(parts.length / 2)] || parts[0] || cleaned.slice(0, 500);
  if (pick.length < 120 && parts.length > 2) {
    pick = parts.slice(Math.max(0, Math.floor(parts.length / 2) - 1), Math.floor(parts.length / 2) + 2).join('\n\n');
  }
  const out = pick.trim();
  return out.length > 900 ? out.slice(0, 900) + '…' : out;
}

function tightenBeat(original: string): string {
  const lines = original.split('\n').filter((l) => {
    const t = l.trim();
    if (!t) return false;
    if (/^NARRATOR/i.test(t)) return false;
    if (/^\[SFX:/i.test(t)) return t.length < 60; // keep short sfx, drop long
    return true;
  });
  const body = (lines.length >= 3 ? lines : original.split('\n')).join('\n').trim();
  const trimmed = body.length > 500 ? body.slice(0, 500) + '\n…' : body;
  return `${trimmed}\n\n(NARRATOR — tighter)\nSame turn. Less throat-clearing. Land the beat and move.`;
}

function enrichBeat(original: string): string {
  return `${original.trim()}

[SFX: A held breath. Something small in the room shifts — a chair, a page, a distant bell.]

(NARRATOR — richer)
One extra sensory beat. One line of cost on the character's face. Then continue — don't stall the plot.`;
}

/** Coerce messy LLM JSON into the UI schema. Structure is always parsed from scripts. */
function normalizeInsightsResult(
  parsed: any,
  meta: {
    seriesId: string;
    title: string;
    episodeCount: number;
    episodes?: Array<{ episodeNumber?: number; title?: string; scriptText?: string }>;
  }
) {
  const comments = expandThinThread(coerceRoomComments(parsed?.room?.comments));
  const vibeSplit = parsed?.room?.vibeSplit || {
    masterpiece: comments.filter((c: any) => c?.vibe === 'masterpiece').length,
    solid: comments.filter((c: any) => c?.vibe === 'solid').length,
    mid: comments.filter((c: any) => c?.vibe === 'mid').length,
    slop: comments.filter((c: any) => c?.vibe === 'slop').length,
  };

  const structureIn = parsed?.structure || {};
  const dnaIn = parsed?.dna || {};
  const episodes = Array.isArray(meta.episodes) ? meta.episodes : [];
  const posts = Array.isArray(parsed?.room?.posts) ? parsed.room.posts : [];
  const personasRaw = (Array.isArray(parsed?.personas) ? parsed.personas : []).map(normalizePersona);
  const engagement = buildEngagementFunnel(
    parsed?.room,
    posts.map((p: any, i: number) => ({
      id: String(p?.id || `post${i}`),
      kind: p?.kind || 'episode_discussion',
      title: String(p?.title || ''),
      author: String(p?.author || ''),
      upvotes: Number(p?.upvotes) || 0,
      vibe: p?.vibe || 'solid',
      comments: Array.isArray(p?.comments) ? p.comments : [],
    })),
    comments,
    personasRaw,
    meta.episodeCount || episodes.length || 8,
    8
  );

  // Live runs: structure is 100% script-derived. Demo fixture keeps its authored structure.
  let structure;
  if (episodes.length > 0 && !parsed?.isDemoFixture) {
    const grounding = extractStructureFromEpisodes(episodes);
    structure = {
      characters: grounding.characters
        .map((c, i) => normalizeCharacter(c, i))
        .filter((c) => c.name),
      scenes: grounding.scenes.map((s, i) => normalizeScene(s, i)),
      timeline: grounding.timeline.map((t, i) => normalizeTimeline(t, i)),
    };
  } else {
    structure = {
      characters: (Array.isArray(structureIn.characters) ? structureIn.characters : []).map(
        normalizeCharacter
      ),
      scenes: (Array.isArray(structureIn.scenes) ? structureIn.scenes : []).map(normalizeScene),
      timeline: (Array.isArray(structureIn.timeline) ? structureIn.timeline : []).map(
        normalizeTimeline
      ),
    };
  }

  return {
    ...parsed,
    seriesId: meta.seriesId,
    title: meta.title,
    isDemoFixture: Boolean(parsed?.isDemoFixture),
    room: {
      subreddit: parsed?.room?.subreddit || 'r/AudioDrama',
      tagline: parsed?.room?.tagline || meta.title,
      audienceSize: engagement.audienceSize,
      roomVibe: parsed?.room?.roomVibe || 'solid',
      vibeSplit,
      hotTakes: Array.isArray(parsed?.room?.hotTakes) ? parsed.room.hotTakes.map(String) : [],
      posts,
      comments,
      engagement,
    },
    structure,
    dna: {
      summary: String(dnaIn.summary || ''),
      pacing: asNumber(dnaIn.pacing, 50),
      suspense: asNumber(dnaIn.suspense, 50),
      romance: asNumber(dnaIn.romance, 20),
      conflict: asNumber(dnaIn.conflict, 50),
      dialogueDensity: asNumber(dnaIn.dialogueDensity, 50),
      emotionalIntensity: asNumber(dnaIn.emotionalIntensity, 50),
      tropes: Array.isArray(dnaIn.tropes) ? dnaIn.tropes.map(String) : [],
    },
    personas: personasRaw,
    repetition: parsed?.repetition ?? null,
    confusion: parsed?.confusion ?? null,
    cut: ensureCut(parsed?.cut, comments, episodes),
    dropOff: parsed?.dropOff ?? null,
    arena: parsed?.arena ?? undefined,
  };
}

function harborWardDemoFixture(seriesId: string, title: string) {
  return {
    seriesId,
    title,
    isDemoFixture: true,
    room: {
      subreddit: 'r/AudioDrama',
      tagline: 'Harbor Ward — bracelet hook is elite, then the loop starts smelling like recycled plot',
      audienceSize: 248,
      roomVibe: 'mid' as const,
      vibeSplit: { masterpiece: 2, solid: 3, mid: 5, slop: 2 },
      hotTakes: [
        'Ep1 bracelet? I stood up on the metro.',
        'If I see that ER dump one more time I’m uninstalling.',
        'Ep4 name-dump is textbook mid: busy, not deep.',
      ],
      comments: [
        {
          id: 'c1',
          username: 'nightshift_lurker',
          flair: 'binge brain',
          vibe: 'solid' as const,
          upvotes: 412,
          body: "Okay but that bracelet in Bay 3? That's the kind of cold open that makes me cancel sleep. Mira feels real. Lena being mostly off-page actually works — absence as pressure. Then Pier 9 happens… twice… and I can feel my brain saying 'I already know this song.'",
          talksAbout: 'Strong open vs looping middle',
          replies: [
            {
              id: 'r1',
              username: 'sfx_snob',
              body: 'The siren + fluorescent hum sold me harder than half the dialogue. Audio people ate.',
              upvotes: 89,
            },
          ],
        },
        {
          id: 'c2',
          username: 'PlotAllergy',
          flair: 'hates filler',
          vibe: 'slop' as const,
          upvotes: 867,
          body: "kidnap → chase → dumped at Harbor. Again. That's not a motif, that's a copy-paste. Mediocre serials do this when they run out of moves. I'm not mad at Mira — I'm mad that the story thinks I won't notice.",
          talksAbout: 'Repetition as lazy craft',
        },
        {
          id: 'c3',
          username: 'cast_list_karen',
          vibe: 'mid' as const,
          upvotes: 530,
          body: "Ep4 walked three full government-sounding names into Trauma 2 and expected me to care. Anika / Jay / Rafael / Calder — I don't hate twists, I hate being briefed like a Wikipedia dump mid-scene. That's how you get 'mid' instead of 'tense'.",
          talksAbout: 'Confusion / too many new names',
          replies: [
            {
              id: 'r2',
              username: 'nightshift_lurker',
              body: 'Yeah I rewound thinking I missed an earlier scene. I hadn’t.',
              upvotes: 120,
            },
          ],
        },
        {
          id: 'c4',
          username: 'soft_for_sisters',
          flair: 'family drama enjoyer',
          vibe: 'masterpiece' as const,
          upvotes: 221,
          body: "When it trusts the sister wound, it's almost great. The bracelet charm scratch detail? Tiny, human, not AI-slop vibes. Protect that instinct. Burn the corridor coffee chat.",
          talksAbout: 'Emotional core that works',
        },
        {
          id: 'c5',
          username: 'OvertimeGreg',
          vibe: 'slop' as const,
          upvotes: 701,
          body: "Lena is MISSING and they're talking schedules and overtime?? Absolute hat-slop energy. Soft piano in the waiting room while the plot naps. I said 'this is mid' out loud on the bus.",
          talksAbout: 'Paused conflict / filler beat',
        },
        {
          id: 'c6',
          username: 'serial_apologist',
          flair: 'gives 2nd chances',
          vibe: 'solid' as const,
          upvotes: 156,
          body: "I'll defend Ep2 stranger — 'don't trust the night supervisor' is a clean question. The show earns trust early. It spends it on loops later. Still not trash. Just… choose a lane.",
          talksAbout: 'Early promise vs later waste',
        },
        {
          id: 'c7',
          username: 'u/ActuallyFinishedIt',
          vibe: 'mid' as const,
          upvotes: 333,
          body: "Overall vibe: promising pilot energy trapped in a recycled second act. Not a masterpiece. Not unlistenably bad. Classic mid — and this sub can smell mid from a mile away.",
          talksAbout: 'Whole-series grade',
        },
        {
          id: 'c8',
          username: 'BinderStreetTruthers',
          vibe: 'solid' as const,
          upvotes: 98,
          body: "Cold storage shoe hit harder than the second van abduction. Physical evidence > rinse-repeat set pieces. More Binder Street, less 'somehow we're back at the ER'.",
          talksAbout: 'Which locations feel earned',
        },
        {
          id: 'c9',
          username: 'no_notes_bot',
          flair: 'rare praise',
          vibe: 'masterpiece' as const,
          upvotes: 64,
          body: "Unpopular: if they commit to the conspiracy inside the hospital instead of looping Mira like a GPS reset, this could go from mid → something people recommend with their chest.",
          talksAbout: 'Potential if craft sharpens',
        },
        {
          id: 'c10',
          username: 'HateWatchHost',
          vibe: 'mid' as const,
          upvotes: 445,
          body: "We don't need an AI to circle the bad lines. The room already did: bracelet good, name dump mid, loop slop, coffee chat criminal. Writer's call what to keep. We're just the loud neighbors.",
          talksAbout: 'Room consensus without orders',
        },
      ],
    },
    structure: {
      characters: [
        { name: 'Mira Kade', role: 'Protagonist / night-shift nurse', firstAppearsEpisode: 1 },
        { name: 'Lena Kade', role: 'Missing sister', firstAppearsEpisode: 1, notes: 'Mostly off-page' },
        { name: 'Night Supervisor', role: 'Hospital authority', firstAppearsEpisode: 2 },
        { name: 'Dr. Anika Rao', role: 'Sudden antagonist?', firstAppearsEpisode: 4 },
        { name: 'Officer Jay Velasquez', role: 'Sudden ally/threat?', firstAppearsEpisode: 4 },
        { name: 'Rafael Soto', role: 'Driver / informant', firstAppearsEpisode: 4 },
      ],
      scenes: [
        {
          id: 's1',
          episodeNumber: 1,
          order: 1,
          title: 'Bracelet discovery',
          summary: 'Mira finds Lena’s bracelet in Bay 3.',
          charactersPresent: ['Mira Kade', 'Orderly'],
        },
        {
          id: 's3',
          episodeNumber: 3,
          order: 1,
          title: 'Pier 9 abduction loop',
          summary: 'Kidnap, chase, dumped at ER.',
          charactersPresent: ['Mira Kade', 'ER Doctor'],
        },
        {
          id: 's4',
          episodeNumber: 4,
          order: 1,
          title: 'Trauma 2 confrontation',
          summary: 'Three strangers dump plot on Mira at once.',
          charactersPresent: ['Mira Kade', 'Dr. Anika Rao', 'Officer Jay Velasquez', 'Rafael Soto'],
        },
        {
          id: 's5',
          episodeNumber: 5,
          order: 2,
          title: 'Corridor pause',
          summary: 'Conflict stops for coffee and overtime talk.',
          charactersPresent: ['Mira Kade', 'Night Supervisor'],
        },
      ],
      timeline: [
        { episodeNumber: 1, label: 'Inciting object', summary: 'Bracelet proves Lena is still reachable.' },
        { episodeNumber: 3, label: 'Loop establishes', summary: 'Kidnap → chase → hospital becomes the pattern.' },
        { episodeNumber: 4, label: 'Name dump', summary: 'Anika, Jay, Rafael arrive without grounding.' },
        { episodeNumber: 5, label: 'Stakes stall', summary: 'Same loop, then a soft corridor beat.' },
      ],
    },
    dna: {
      summary:
        'Hooks hard on a sister wound, then risks sounding mid when the abduction loop and a soft corridor chat drain heat.',
      pacing: 58,
      suspense: 72,
      romance: 12,
      conflict: 64,
      dialogueDensity: 70,
      emotionalIntensity: 68,
      tropes: ['Missing sibling', 'Hospital noir', 'Conspiracy drip', 'Abduction loop'],
    },
    personas: [
      {
        id: 'p1',
        name: 'PlotAllergy',
        profile: 'Quits the second a loop teaches nothing new.',
        quitEpisode: 5,
        quitScene: 'ER dump reprise',
        reason: 'Recognizes the same kidnap–chase–hospital arc.',
        beatExcerpt: 'Somehow — Harbor’s ER doors.',
      },
      {
        id: 'p2',
        name: 'cast_list_karen',
        profile: 'Tracks names; hates briefing scenes.',
        quitEpisode: 4,
        quitScene: 'Trauma 2',
        reason: 'Three new names arrive together.',
        beatExcerpt: 'Three people she has never heard of stand over her bed',
      },
      {
        id: 'p3',
        name: 'OvertimeGreg',
        profile: 'Needs stakes every minute.',
        quitEpisode: 5,
        quitScene: 'Corridor coffee',
        reason: 'Conflict pauses while Lena is missing.',
        beatExcerpt: 'They talk about schedules. About overtime.',
      },
      {
        id: 'p4',
        name: 'sfx_snob',
        profile: 'Follows audio urgency.',
        quitEpisode: 5,
        quitScene: 'Waiting-room piano',
        reason: 'Soft piano replaces pursuit energy.',
        beatExcerpt: '[SFX: Soft piano from the waiting room TV]',
      },
      {
        id: 'p5',
        name: 'serial_apologist',
        profile: 'Defends shows that ask one clear question.',
        quitEpisode: 3,
        quitScene: 'Pier 9 return',
        reason: 'Ends on same loop, no new answer.',
        beatExcerpt: 'Same loop: taken, chased, returned to the ward.',
      },
    ],
    repetition: {
      pattern: 'Kidnap → chase → dumped at Harbor ER',
      episodeNumbers: [3, 5],
      whyItHurts: 'The room treats it as recycled plot — mediocre craft signal.',
      examples: [
        'Ep 3: Pier 9 van → chase → Trauma bay',
        'Ep 5: Binder Street van → chase → Harbor ER again',
      ],
    },
    confusion: {
      episodeNumber: 4,
      scene: 'Trauma 2 bedside',
      reason: 'Too many new names and conspiracy nouns in one bedside briefing.',
      newCharactersIntroduced: ['Dr. Anika Rao', 'Officer Jay Velasquez', 'Rafael Soto'],
      excerpt: 'Anika / Jay / Rafael / Calder arrive without grounding.',
    },
    cut: {
      episodeNumber: 5,
      beatLabel: 'Corridor stretch the room keeps roasting',
      threadConsensus:
        'The thread isn’t telling you what to write — they’re arguing that this stretch feels like the story took a smoke break while Lena is still missing. Your call.',
      original: `NARRATOR:
In the corridor, Mira stops. The night supervisor offers coffee. They talk about schedules. About overtime. About nothing that matters while Lena is still missing.

MIRA:
"I don't know if I can keep running this loop."

NIGHT SUPERVISOR:
"Then rest. We'll file another incident report in the morning."

[SFX: Clock tick, distant code blue]

NARRATOR:
Conflict pauses. No push. No reveal. The episode floats while the kidnap–chase–hospital pattern waits to repeat.`,
      fast: `NARRATOR:
In the corridor, the night supervisor blocks Mira with a paper cup.

NIGHT SUPERVISOR:
"Incident report tomorrow. Go home."

MIRA:
"Binder Street. Cold storage. If I wait until morning, Lena doesn't."

[SFX: Cup hits tile. Mira's footsteps — already leaving.]`,
      detailed: `NARRATOR:
In the corridor, Mira stops under the exit sign. The night supervisor offers coffee like a truce.

NIGHT SUPERVISOR:
"You've filed three incident reports this week. Rest. We'll handle Binder Street in daylight."

MIRA:
"Daylight is when Calder's people move the vans. Lena's shoe was still cold. Someone in this hospital signed those diversion forms."

NIGHT SUPERVISOR (too careful):
"You shouldn't say that name out loud."

[SFX: Soft piano from the waiting room TV — then Mira kills the volume with her palm]

MIRA:
"Then stop offering coffee. Unlock the staff lot. I'm going back tonight — and if you tip them off, I'll know which door you use."`,
      explanation:
        'Two directions the room might calm down about — still your story. Fast = motion. Detailed = complicity heat.',
    },
    dropOff: null,
  };
}

app.post('/api/insights', async (req, res) => {
  try {
    const { title, genre, targetAudience, episodes, seriesId, useDemoFixture } = req.body;

    if (!episodes || !Array.isArray(episodes) || episodes.length === 0) {
      return res.status(400).json({ error: 'At least one episode script is required.' });
    }

    if (useDemoFixture) {
      if (seriesId && seriesId !== 'demo-harbor-ward') {
        return res.status(400).json({
          error: 'Labeled demo fixture only works with the Harbor Ward demo series.',
        });
      }
      const fixture = harborWardDemoFixture(seriesId || 'demo-harbor-ward', title || 'Harbor Ward');
      return res.json(
        normalizeInsightsResult(fixture, {
          seriesId: fixture.seriesId,
          title: fixture.title,
          episodeCount: episodes.length,
          episodes,
        })
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error:
          'OPENAI_API_KEY missing. Add it to .env, or open Harbor Ward and use the labeled demo fixture.',
      });
    }

    const { prompt: userPrompt, targetComments, targetPosts } = buildInsightsUserPrompt(req.body);
    console.log(
      `Room model: ${getRoomModel()} (target ${targetPosts} posts / ~${targetComments} comment trees)`
    );

    let content = await generateRoomJson(INSIGHTS_SYSTEM, userPrompt);
    let parsed = JSON.parse(content);
    let posts = Array.isArray(parsed?.room?.posts) ? parsed.room.posts : [];
    let comments = flattenPostComments(posts);
    if (comments.length === 0) {
      comments = expandThinThread(coerceRoomComments(parsed?.room?.comments));
    }

    // Retry if feed is still a lonely mega-thread / empty
    if (posts.length < Math.min(5, targetPosts - 1) && comments.length < 6) {
      console.warn(
        `Thin feed (${posts.length} posts / ${comments.length} comments) — retrying once`
      );
      content = await generateRoomJson(
        INSIGHTS_SYSTEM,
        userPrompt +
          `\n\nPREVIOUS ATTEMPT FAILED: returned ${posts.length} posts. Return exactly ${targetPosts} SEPARATE posts about DIFFERENT episodes/beats.`
      );
      const retryParsed = JSON.parse(content);
      const retryPosts = Array.isArray(retryParsed?.room?.posts) ? retryParsed.room.posts : [];
      const retryComments = flattenPostComments(retryPosts);
      if (retryPosts.length > posts.length || retryComments.length > comments.length) {
        parsed = retryParsed;
        posts = retryPosts;
        comments = retryComments.length ? retryComments : expandThinThread(coerceRoomComments(retryParsed?.room?.comments));
      }
    }

    if (!parsed.room || (posts.length === 0 && comments.length === 0)) {
      return res.status(502).json({ error: 'Model response missing the fandom sub feed.' });
    }

    parsed.room = { ...parsed.room, posts, comments };

    return res.json(
      normalizeInsightsResult(
        { ...parsed, isDemoFixture: false },
        {
          seriesId: seriesId || 'series-' + Date.now(),
          title: title || parsed.title || 'Untitled Series',
          episodeCount: episodes.length,
          episodes,
        }
      )
    );
  } catch (error: any) {
    console.error('Insights error:', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Room simulation failed. Check API key and try again.',
    });
  }
});

/** Phase 2: multi-agent Reddit arena (batch result). */
app.post('/api/arena/run', async (req, res) => {
  try {
    const { title, genre, episodes, seriesId, syncDatabricks, arenaConfig } = req.body;
    if (!episodes || !Array.isArray(episodes) || episodes.length === 0) {
      return res.status(400).json({ error: 'At least one episode script is required.' });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'OPENAI_API_KEY missing.' });
    }

    const state = createArena({ title, genre, episodes, config: arenaConfig });
    console.log(
      `Arena run: ${getArenaModel()} · ${state.agents.length} agents · ${state.plan.rounds} rounds · ${state.plan.activePerRound} active/round`
    );
    await runArena(state, generateAgentJson);

    const payload = arenaToInsightsPayload(state, {
      seriesId: seriesId || state.runId,
      title: title || state.title,
      episodes,
    });
    const { databricks } = await finalizeArenaWithDatabricks(state, syncDatabricks !== false);
    payload.arena = { ...payload.arena, databricks };

    return res.json(
      normalizeInsightsResult(
        { ...payload, isDemoFixture: false },
        {
          seriesId: payload.seriesId,
          title: payload.title,
          episodeCount: episodes.length,
          episodes,
        }
      )
    );
  } catch (error: any) {
    console.error('Arena run error:', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Arena simulation failed.' });
  }
});

/** Phase 2: SSE spectator stream — events then final insights payload. */
app.post('/api/arena/stream', async (req, res) => {
  try {
    const { title, genre, episodes, seriesId, syncDatabricks, arenaConfig } = req.body;
    if (!episodes || !Array.isArray(episodes) || episodes.length === 0) {
      return res.status(400).json({ error: 'At least one episode script is required.' });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'OPENAI_API_KEY missing.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (data: unknown) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const state = createArena({ title, genre, episodes, config: arenaConfig });
    console.log(
      `Arena stream: ${getArenaModel()} · ${state.agents.length} agents · ${state.plan.rounds} rounds · ${state.plan.activePerRound} active/round`
    );

    await runArena(state, generateAgentJson, {
      onEvent: (ev) => send({ kind: 'event', event: ev }),
    });

    const payload = arenaToInsightsPayload(state, {
      seriesId: seriesId || state.runId,
      title: title || state.title,
      episodes,
    });
    send({
      kind: 'event',
      event: {
        type: 'round_end',
        ts: Date.now(),
        summary: isDatabricksConfigured()
          ? 'Syncing arena pack to Databricks…'
          : 'Writing arena export pack…',
      },
    });
    const { jsonl, databricks } = await finalizeArenaWithDatabricks(state, syncDatabricks !== false);
    payload.arena = { ...payload.arena, databricks };

    const normalized = normalizeInsightsResult(
      { ...payload, isDemoFixture: false },
      {
        seriesId: payload.seriesId,
        title: payload.title,
        episodeCount: episodes.length,
        episodes,
      }
    );

    send({ kind: 'result', insights: normalized, jsonl, databricks });
    send({ kind: 'done' });
    res.end();
  } catch (error: any) {
    console.error('Arena stream error:', error?.message || error);
    if (!res.headersSent) {
      return res.status(500).json({ error: error?.message || 'Arena stream failed.' });
    }
    res.write(
      `data: ${JSON.stringify({ kind: 'error', error: error?.message || 'Arena stream failed.' })}\n\n`
    );
    res.end();
  }
});

app.get('/api/arena/export/:runId', (req, res) => {
  const packFile = path.join(
    process.cwd(),
    'data',
    'arena-runs',
    req.params.runId,
    'events.jsonl'
  );
  const legacy = path.join(process.cwd(), 'data', 'arena-runs', `${req.params.runId}.jsonl`);
  const file = fs.existsSync(packFile) ? packFile : legacy;
  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: 'Run not found.' });
  }
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.runId}.jsonl"`);
  return res.sendFile(file);
});

app.get('/api/databricks/status', (_req, res) => {
  res.json({
    configured: isDatabricksConfigured(),
    hostSet: Boolean(process.env.DATABRICKS_HOST),
    catalog: process.env.DATABRICKS_CATALOG || 'workspace',
    schema: process.env.DATABRICKS_SCHEMA || 'default',
    volume: process.env.DATABRICKS_VOLUME || 'helix_arena',
    role: 'Helix runs the live multi-agent arena. Databricks stores each run and clusters what sparks heat at scale.',
    docs: [
      'docs/databricks/setup.sql',
      'docs/databricks/helix_arena_heat.py',
      'docs/DATABRICKS_SCALE.md',
    ],
  });
});

app.post('/api/dropoff-from-csv', async (req, res) => {
  try {
    const { rows, beatHint } = req.body as {
      rows?: Array<{ minute: number; retention: number }>;
      beatHint?: string;
    };

    if (!rows || !Array.isArray(rows) || rows.length < 2) {
      return res.status(400).json({ error: 'CSV rows with minute and retention required.' });
    }

    let dip = rows[0];
    for (const row of rows) {
      if (row.retention < dip.retention) dip = row;
    }

    return res.json({
      dropOff: {
        source: 'csv',
        dipMinute: dip.minute,
        retentionAtDip: dip.retention,
        linkedBeat: beatHint || `Around minute ${dip.minute} in your uploaded retention data`,
        reason:
          'Lowest point in your uploaded retention CSV — your data, not a platform forecast.',
      },
    });
  } catch (error: any) {
    console.error('CSV dropoff error:', error);
    return res.status(500).json({ error: 'Failed to parse retention CSV.' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    openai: Boolean(process.env.OPENAI_API_KEY),
    model: getRoomModel(),
    arenaModel: getArenaModel(),
    reasoningEffort: getReasoningEffort(),
    databricksConfigured: isDatabricksConfigured(),
    agentIsolation: isolationStatus(),
    timestamp: new Date().toISOString(),
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Studio Insights listening on http://localhost:${PORT}`);
    console.log(`OpenAI configured: ${Boolean(process.env.OPENAI_API_KEY) ? 'yes' : 'no'}`);
    console.log(`Room model: ${getRoomModel()} (effort: ${getReasoningEffort()})`);
  });
}

startServer();
