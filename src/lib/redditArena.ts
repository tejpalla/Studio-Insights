/**
 * Multi-agent Reddit arena (PewDiePie Hunger Games → fandom sub).
 * Agents take turns against a shared SubState. Unpredictability = interaction, not one mega-prompt.
 */

import type {
  RedditComment,
  RedditPost,
  RedditPostKind,
  RedditRoom,
  StoryVibe,
} from '../types';
import { buildRoomBrief } from './redditRoomPrompt';
import { extractStructureFromEpisodes } from './scriptGrounding';
import { scaleFandomFromStory } from './fandomScale';
import { AGENT_TURN_SYSTEM } from './agentProtocol';
import { dispatchIsolatedTurn, isolationStatus } from './agentWorkerPool';

export const ARENA_AGENT_MIN = 8;
export const ARENA_AGENT_MAX = 45;
export const ARENA_ROUNDS_MIN = 2;
export const ARENA_ROUNDS_MAX = 8;
/** @deprecated defaults — prefer spawn config */
export const ARENA_AGENT_COUNT = 16;
export const ARENA_ROUNDS = 4;

export type ArenaActionType = 'new_post' | 'reply' | 'upvote' | 'lurk';

export interface ArenaSpawnPlan {
  agentCount: number;
  rounds: number;
  activePerRound: number;
  /** Depth target — independent of agent count (comments per post, approx) */
  minCommentsPerPost: number;
  depthWaves: number;
}

export interface ArenaAgent {
  id: string;
  username: string;
  archetype: string;
  strategy: string;
  flair: string;
  /** Preferred vibe bias when posting */
  bias: StoryVibe;
}

export interface ArenaAction {
  action: ArenaActionType;
  targetPostId?: string;
  targetCommentId?: string;
  kind?: RedditPostKind;
  title?: string;
  body?: string;
  vibe?: StoryVibe;
  aboutEpisode?: number;
  talksAbout?: string;
}

export interface ArenaEvent {
  type:
    | 'agent_spawned'
    | 'action'
    | 'round_start'
    | 'round_end'
    | 'depth_wave'
    | 'complete'
    | 'error';
  ts: number;
  round?: number;
  agentId?: string;
  username?: string;
  summary: string;
  action?: ArenaAction;
  postId?: string;
}

export interface SubState {
  runId: string;
  title: string;
  subreddit: string;
  tagline: string;
  posts: RedditPost[];
  agents: ArenaAgent[];
  events: ArenaEvent[];
  brief: string;
  epCount: number;
  castNames: string[];
  seed: number;
  plan: ArenaSpawnPlan;
}

export type JsonGenerator = (system: string, user: string) => Promise<string>;

const ARCHETYPES: Array<Omit<ArenaAgent, 'id' | 'username'> & { namePool: string[] }> = [
  {
    archetype: 'lore_nerd',
    strategy: 'Cite lore, timelines, and foreshadowing. Start theory posts. Correct people who get facts wrong.',
    flair: 'lore first',
    bias: 'solid',
    namePool: ['FogArchivist', 'NotebookMargin', 'CanonThread', 'GrayFogIndex'],
  },
  {
    archetype: 'pacing_hater',
    strategy: 'Attack filler, repetition, and mid-arc stalls. Prefer pacing posts and rough takes. Rarely praise.',
    flair: 'skip button ready',
    bias: 'slop',
    namePool: ['SkipToTwist', 'PacingKnife', 'MidArcExit', 'FillerDetector'],
  },
  {
    archetype: 'craft_defender',
    strategy: 'Defend earned craft: SFX, dialogue, structure. Reply when others dunk unfairly. Peak when a beat lands.',
    flair: 'audio craft',
    bias: 'masterpiece',
    namePool: ['SoundstageFan', 'EarnItOrDont', 'CraftOverLore', 'MicDropEp'],
  },
  {
    archetype: 'character_stan',
    strategy: 'Obsess over one character arc / earnedness. Character-kind posts. Emotional, personal stakes.',
    flair: 'character first',
    bias: 'mid',
    namePool: ['ArcOrNothing', 'StanTheCaptain', 'NameOnThePage', 'GriefMeter'],
  },
  {
    archetype: 'dropoff_risk',
    strategy: 'Ask should_i_continue. Admit pausing. Amplify confusion. Leave-adjacent energy.',
    flair: 'paused at Ep ?',
    bias: 'mid',
    namePool: ['PausedOnEp', 'ComeBackLater', 'DropThreat', 'WillItGetBetter'],
  },
  {
    archetype: 'contrarian',
    strategy: 'Differentiate. If the feed is praising, dunk. If dunking, steelman. Never clone the last take.',
    flair: 'devil advocate',
    bias: 'slop',
    namePool: ['OppositeDay', 'HotColdTake', 'NotThatTake', 'ArgueDiffer'],
  },
  {
    archetype: 'hype_beast',
    strategy: 'Short reaction posts, hype, jokes. Upvote sparks. Low-effort but on-beat.',
    flair: 'standing ovation',
    bias: 'masterpiece',
    namePool: ['LetsGoooFog', 'ClipThatBeat', 'HypeTrainEp', 'OneMoreEp'],
  },
  {
    archetype: 'confused_newbie',
    strategy: 'Ask clarifying questions. Confusion posts. Reply asking who/when. Soft solid/mid.',
    flair: 'first binge',
    bias: 'solid',
    namePool: ['WaitWhoDied', 'TimelineLost', 'NewbieNotes', 'ExplainLikeImEp1'],
  },
];

const KINDS: RedditPostKind[] = [
  'episode_discussion',
  'theory',
  'character',
  'pacing',
  'should_i_continue',
  'reaction',
];

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function pickName(pool: string[], used: Set<string>, seed: number, i: number): string {
  for (let k = 0; k < pool.length; k++) {
    const name = pool[(seed + i + k) % pool.length];
    if (!used.has(name.toLowerCase())) {
      used.add(name.toLowerCase());
      return name;
    }
  }
  const fallback = `${pool[0]}${i + 1}`;
  used.add(fallback.toLowerCase());
  return fallback;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

export function resolveSpawnPlan(config?: {
  agentCount?: number;
  rounds?: number;
  activePerRound?: number;
}): ArenaSpawnPlan {
  const agentCount = clamp(config?.agentCount ?? ARENA_AGENT_COUNT, ARENA_AGENT_MIN, ARENA_AGENT_MAX);
  const rounds = clamp(config?.rounds ?? ARENA_ROUNDS, ARENA_ROUNDS_MIN, ARENA_ROUNDS_MAX);
  const activePerRound = clamp(
    config?.activePerRound ?? Math.min(14, agentCount),
    4,
    agentCount
  );
  // Depth stays fixed regardless of cast size (8 vs 45 agents)
  const minCommentsPerPost = 8;
  const depthWaves = 6;
  return { agentCount, rounds, activePerRound, minCommentsPerPost, depthWaves };
}

export function createArena(opts: {
  title: string;
  genre?: string;
  episodes: Array<{ episodeNumber?: number; title?: string; scriptText?: string }>;
  agentCount?: number;
  config?: {
    agentCount?: number;
    rounds?: number;
    activePerRound?: number;
  };
}): SubState {
  const seed = Math.floor(Math.random() * 9000 + 1000);
  const episodes = opts.episodes || [];
  const grounding = extractStructureFromEpisodes(episodes);
  const brief = buildRoomBrief(episodes);
  const plan = resolveSpawnPlan({
    agentCount: opts.config?.agentCount ?? opts.agentCount,
    rounds: opts.config?.rounds,
    activePerRound: opts.config?.activePerRound,
  });
  const n = plan.agentCount;
  const used = new Set<string>();
  const agents: ArenaAgent[] = [];

  for (let i = 0; i < n; i++) {
    const arch = ARCHETYPES[i % ARCHETYPES.length];
    const username = pickName(arch.namePool, used, seed, i);
    agents.push({
      id: `agent_${i + 1}`,
      username,
      archetype: arch.archetype,
      strategy: arch.strategy,
      flair: arch.flair,
      bias: arch.bias,
    });
  }

  const slug = (opts.title || 'Series')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .slice(0, 18) || 'Series';

  const events: ArenaEvent[] = agents.map((a) => ({
    type: 'agent_spawned' as const,
    ts: Date.now(),
    agentId: a.id,
    username: a.username,
    summary: `Spawned u/${a.username} (${a.archetype}) — ${a.strategy.slice(0, 80)}`,
  }));

  return {
    runId: `run_${Date.now()}_${seed}`,
    title: opts.title || 'Untitled',
    subreddit: `r/${slug}Arena`,
    tagline: `${opts.title || 'Series'} — ${agents.length} bots · ${plan.rounds} rounds`,
    posts: [],
    agents,
    events,
    brief,
    epCount: episodes.length,
    castNames: grounding.characters.slice(0, 16).map((c) => c.name),
    seed,
    plan,
  };
}

function feedSnapshot(state: SubState, maxPosts = 8): string {
  if (state.posts.length === 0) {
    return 'FEED EMPTY — prefer new_post this turn (especially episode_discussion / theory / pacing).';
  }
  const ranked = [...state.posts].sort(
    (a, b) => (a.comments?.length || 0) - (b.comments?.length || 0)
  );
  return ranked
    .slice(0, maxPosts)
    .map((p) => {
      const comments = (p.comments || [])
        .slice(0, 6)
        .map((c) => {
          const replies = (c.replies || [])
            .slice(0, 5)
            .map((r) => `      ↳ [${r.id}] u/${r.username}: ${r.body.slice(0, 100)}`)
            .join('\n');
          return `    - [${c.id}] u/${c.username} (${c.vibe}, ${c.upvotes}, ${c.replies?.length || 0} nested): ${c.body.slice(0, 150)}${
            replies ? `\n${replies}` : ''
          }`;
        })
        .join('\n');
      return `[${p.id}] ${p.kind} · Ep ${p.aboutEpisode ?? '?'} · ${p.upvotes}↑ · u/${p.author} · ${(p.comments || []).length} comments\n  TITLE: ${p.title}\n  BODY: ${(p.body || '').slice(0, 160)}\n  COMMENTS:\n${comments || '    (none — start the thread)'}`;
    })
    .join('\n\n');
}

const AGENT_SYSTEM = AGENT_TURN_SYSTEM;

function countPostComments(p: RedditPost): number {
  return (p.comments || []).reduce((n, c) => n + 1 + (c.replies?.length || 0), 0);
}

function buildAgentUserPrompt(state: SubState, agent: ArenaAgent, round: number): string {
  const posts = state.posts.length;
  const depthHint =
    posts === 0
      ? 'FEED EMPTY — new_post.'
      : posts >= 4
        ? 'DEPTH MODE — prefer reply + targetCommentId. Almost never new_post. Deepen thin threads.'
        : 'A few posts exist — prefer reply/nest; new_post only for a fresh fight.';
  return `ROUND ${round}/${state.plan?.rounds ?? ARENA_ROUNDS}
SERIES: ${state.title} (${state.epCount} episodes)
CAST: ${state.castNames.join('; ') || 'see brief'}
BOARD: ${posts} posts · depth target ≥${state.plan?.minCommentsPerPost ?? 8} comments/post (independent of cast size)
${depthHint}

YOU ARE:
- username: ${agent.username}
- archetype: ${agent.archetype}
- flair: ${agent.flair}
- strategy: ${agent.strategy}
- vibe bias: ${agent.bias}

STORY BRIEF (facts only):
${state.brief.slice(0, 9000)}

CURRENT FEED:
${feedSnapshot(state)}

Return JSON:
{
  "action": "new_post" | "reply" | "upvote" | "lurk",
  "targetPostId": "optional",
  "targetCommentId": "optional — nest under this comment id",
  "kind": "episode_discussion"|"theory"|"character"|"pacing"|"should_i_continue"|"reaction",
  "title": "string if new_post",
  "body": "string if new_post or reply",
  "vibe": "masterpiece"|"solid"|"mid"|"slop",
  "aboutEpisode": number,
  "talksAbout": "short tag"
}`;
}

function parseAction(raw: string, agent: ArenaAgent, state: SubState): ArenaAction {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { action: 'lurk' };
  }
  const action = (['new_post', 'reply', 'upvote', 'lurk'] as const).includes(parsed?.action)
    ? parsed.action
    : 'lurk';

  if (state.posts.length === 0 && action !== 'new_post') {
    return {
      action: 'new_post',
      kind: agent.archetype === 'pacing_hater' ? 'pacing' : 'episode_discussion',
      title: parsed?.title || `[Ep 1] First thoughts from u/${agent.username}`,
      body:
        parsed?.body ||
        `Opening take after the brief — Ep 1 energy. (${agent.archetype})`,
      vibe: agent.bias,
      aboutEpisode: 1,
      talksAbout: 'opening',
    };
  }

  // Cast size must not flatten threads: convert extra OPs into nested replies
  if (action === 'new_post' && state.posts.length >= 4) {
    const thin = [...state.posts].sort((a, b) => countPostComments(a) - countPostComments(b))[0];
    const parent = thin?.comments?.[0];
    return {
      action: 'reply',
      targetPostId: thin?.id,
      targetCommentId: parent?.id,
      body:
        parsed?.body ||
        parsed?.title ||
        `Pushing back on this — Ep ${thin?.aboutEpisode ?? '?'} still feels off.`,
      vibe: (['masterpiece', 'solid', 'mid', 'slop'] as const).includes(parsed?.vibe)
        ? parsed.vibe
        : agent.bias,
      talksAbout: parsed?.talksAbout ? String(parsed.talksAbout) : undefined,
    };
  }

  const vibe = (['masterpiece', 'solid', 'mid', 'slop'] as const).includes(parsed?.vibe)
    ? parsed.vibe
    : agent.bias;
  const kind = KINDS.includes(parsed?.kind) ? parsed.kind : 'episode_discussion';

  return {
    action,
    targetPostId: parsed?.targetPostId ? String(parsed.targetPostId) : undefined,
    targetCommentId: parsed?.targetCommentId ? String(parsed.targetCommentId) : undefined,
    kind,
    title: parsed?.title ? String(parsed.title) : undefined,
    body: parsed?.body ? String(parsed.body) : undefined,
    vibe,
    aboutEpisode: Number(parsed?.aboutEpisode) || undefined,
    talksAbout: parsed?.talksAbout ? String(parsed.talksAbout) : undefined,
  };
}

function findPost(state: SubState, id?: string): RedditPost | undefined {
  if (!id) return state.posts[0];
  return state.posts.find((p) => p.id === id) || state.posts[0];
}

function pickNestCommentId(post: RedditPost): string | undefined {
  const comments = post.comments || [];
  if (!comments.length) return undefined;
  const ranked = [...comments].sort((a, b) => {
    const ar = a.replies?.length || 0;
    const br = b.replies?.length || 0;
    const as = ar === 0 ? 4 : ar < 8 ? 10 - ar : 1;
    const bs = br === 0 ? 4 : br < 8 ? 10 - br : 1;
    return bs - as || (b.upvotes || 0) - (a.upvotes || 0);
  });
  return ranked[0]?.id;
}

export function applyAction(
  state: SubState,
  agent: ArenaAgent,
  action: ArenaAction,
  round: number
): ArenaEvent {
  const ts = Date.now();

  if (action.action === 'lurk') {
    const ev: ArenaEvent = {
      type: 'action',
      ts,
      round,
      agentId: agent.id,
      username: agent.username,
      summary: `u/${agent.username} lurks`,
      action,
    };
    state.events.push(ev);
    return ev;
  }

  if (action.action === 'upvote') {
    const post = findPost(state, action.targetPostId);
    if (post) {
      if (action.targetCommentId) {
        for (const c of post.comments || []) {
          if (c.id === action.targetCommentId) {
            c.upvotes += 7 + (state.seed % 11);
            break;
          }
          for (const r of c.replies || []) {
            if (r.id === action.targetCommentId) {
              r.upvotes += 5 + (state.seed % 7);
              break;
            }
          }
        }
      } else {
        post.upvotes += 11 + (state.seed % 17);
      }
    }
    const ev: ArenaEvent = {
      type: 'action',
      ts,
      round,
      agentId: agent.id,
      username: agent.username,
      summary: `u/${agent.username} upvotes ${action.targetCommentId || action.targetPostId || 'something'}`,
      action,
      postId: post?.id,
    };
    state.events.push(ev);
    return ev;
  }

  if (action.action === 'new_post') {
    const aboutEpisode =
      action.aboutEpisode && action.aboutEpisode > 0
        ? Math.min(action.aboutEpisode, Math.max(1, state.epCount))
        : 1 + ((state.seed + state.posts.length) % Math.max(1, state.epCount));
    const post: RedditPost = {
      id: uid('post'),
      kind: action.kind || 'episode_discussion',
      title:
        action.title?.trim() ||
        `[Ep ${aboutEpisode}] Take from u/${agent.username}`,
      author: agent.username,
      flair: agent.flair,
      upvotes: 3 + (state.seed % 20),
      vibe: action.vibe || agent.bias,
      body: action.body?.trim() || `Thoughts on Ep ${aboutEpisode}.`,
      aboutEpisode,
      comments: [],
    };
    state.posts.unshift(post);
    const ev: ArenaEvent = {
      type: 'action',
      ts,
      round,
      agentId: agent.id,
      username: agent.username,
      summary: `u/${agent.username} posts: ${post.title.slice(0, 72)}`,
      action,
      postId: post.id,
    };
    state.events.push(ev);
    return ev;
  }

  // reply
  const post = findPost(state, action.targetPostId);
  if (!post) {
    const ev: ArenaEvent = {
      type: 'action',
      ts,
      round,
      agentId: agent.id,
      username: agent.username,
      summary: `u/${agent.username} tried to reply but found no post — lurks`,
      action: { action: 'lurk' },
    };
    state.events.push(ev);
    return ev;
  }

  const body =
    action.body?.trim() ||
    `Disagreeing a bit — Ep ${post.aboutEpisode ?? '?'} still sits weird for me.`;
  const comment: RedditComment = {
    id: uid('c'),
    username: agent.username,
    flair: agent.flair,
    vibe: action.vibe || agent.bias,
    upvotes: 2 + (state.seed % 15),
    body,
    talksAbout: action.talksAbout || post.title.slice(0, 40),
    replies: [],
  };

  let nestId = action.targetCommentId;
  if (!nestId && (post.comments?.length || 0) > 0) {
    const preferNest = (state.seed + round + agent.id.length) % 5 !== 0; // ~80% nest
    if (preferNest) nestId = pickNestCommentId(post);
  }

  if (nestId) {
    const parent = (post.comments || []).find((c) => c.id === nestId);
    if (parent) {
      parent.replies = parent.replies || [];
      parent.replies.push({
        id: uid('r'),
        username: agent.username,
        body,
        upvotes: 1 + (state.seed % 9),
      });
    } else {
      post.comments = post.comments || [];
      post.comments.push(comment);
    }
  } else {
    post.comments = post.comments || [];
    post.comments.push(comment);
  }

  const ev: ArenaEvent = {
    type: 'action',
    ts,
    round,
    agentId: agent.id,
    username: agent.username,
    summary: nestId
      ? `u/${agent.username} nests a reply on “${post.title.slice(0, 40)}”`
      : `u/${agent.username} replies on “${post.title.slice(0, 48)}”`,
    action: { ...action, targetCommentId: nestId || action.targetCommentId },
    postId: post.id,
  };
  state.events.push(ev);
  return ev;
}

export async function runAgentTurn(
  state: SubState,
  agent: ArenaAgent,
  round: number,
  generateJson: JsonGenerator
): Promise<ArenaEvent> {
  try {
    const system = AGENT_SYSTEM;
    const user = buildAgentUserPrompt(state, agent, round);
    // Prefer isolated dispatcher (worker / HTTP container / inline with one-persona context)
    let raw: string;
    try {
      const turn = await dispatchIsolatedTurn({
        requestId: `${state.runId}_${agent.id}_r${round}_${Date.now()}`,
        round,
        agent: {
          id: agent.id,
          username: agent.username,
          archetype: agent.archetype,
          strategy: agent.strategy,
          flair: agent.flair,
          bias: agent.bias,
        },
        system,
        user,
      });
      if (!turn.ok || !turn.rawJson) {
        throw new Error(turn.error || 'isolated turn failed');
      }
      raw = turn.rawJson;
    } catch {
      // Fallback to caller-provided generator (orchestrator)
      raw = await generateJson(system, user);
    }
    const action = parseAction(raw, agent, state);
    return applyAction(state, agent, action, round);
  } catch (err: any) {
    const ev: ArenaEvent = {
      type: 'error',
      ts: Date.now(),
      round,
      agentId: agent.id,
      username: agent.username,
      summary: `u/${agent.username} failed turn: ${err?.message || 'error'} — lurks`,
      action: { action: 'lurk' },
    };
    state.events.push(ev);
    applyAction(state, agent, { action: 'lurk' }, round);
    return ev;
  }
}

export async function runArena(
  state: SubState,
  generateJson: JsonGenerator,
  opts?: {
    rounds?: number;
    onEvent?: (ev: ArenaEvent) => void;
  }
): Promise<SubState> {
  const rounds = opts?.rounds ?? state.plan?.rounds ?? ARENA_ROUNDS;
  const activePerRound = state.plan?.activePerRound ?? state.agents.length;
  const emit = (ev: ArenaEvent) => {
    opts?.onEvent?.(ev);
  };

  for (const ev of state.events.filter((e) => e.type === 'agent_spawned')) {
    emit(ev);
  }

  const iso = isolationStatus();
  const castNote: ArenaEvent = {
    type: 'round_start',
    ts: Date.now(),
    round: 0,
    summary: `Cast ${state.agents.length} isolated agents · ${rounds} rounds · ${activePerRound} active/round · isolation=${iso.mode}${iso.agentUrls.length ? ` · ${iso.agentUrls.length} HTTP agents` : ''}`,
  };
  state.events.push(castNote);
  emit(castNote);

  for (let round = 1; round <= rounds; round++) {
    const start: ArenaEvent = {
      type: 'round_start',
      ts: Date.now(),
      round,
      summary: `Round ${round}/${rounds} — ${activePerRound} of ${state.agents.length} agents act`,
    };
    state.events.push(start);
    emit(start);

    const order = [...state.agents].sort((a, b) => {
      const ha = (a.id.charCodeAt(a.id.length - 1) * round + state.seed) % 97;
      const hb = (b.id.charCodeAt(b.id.length - 1) * round + state.seed) % 97;
      return ha - hb;
    });
    const active = order.slice(0, activePerRound);

    for (const agent of active) {
      const ev = await runAgentTurn(state, agent, round, generateJson);
      emit(ev);
    }

    const end: ArenaEvent = {
      type: 'round_end',
      ts: Date.now(),
      round,
      summary: `Round ${round} done — ${state.posts.length} posts on the board`,
    };
    state.events.push(end);
    emit(end);
  }

  // Depth pass — same target whether cast is 8 or 45
  await deepenThreads(state, generateJson, { onEvent: emit });

  const done: ArenaEvent = {
    type: 'complete',
    ts: Date.now(),
    summary: `Arena complete — ${state.posts.length} posts, ${state.events.length} events, ${state.agents.length} agents`,
  };
  state.events.push(done);
  emit(done);
  return state;
}

/** Reply-only waves so agent count never starves thread depth. */
async function deepenThreads(
  state: SubState,
  generateJson: JsonGenerator,
  opts?: { onEvent?: (ev: ArenaEvent) => void }
): Promise<void> {
  const emit = opts?.onEvent || (() => undefined);
  const minPer = state.plan?.minCommentsPerPost ?? 8;
  const waves = state.plan?.depthWaves ?? 6;
  const system = `You deepen Reddit threads with nested replies ONLY. Return JSON. DEPTH > BREADTH.
Casual Gen-Z fandom voice. Cite Ep N / cast. Disagree. Nest with targetCommentId whenever possible.`;

  for (let wave = 1; wave <= waves; wave++) {
    const thin = state.posts
      .map((p) => ({ p, n: countPostComments(p) }))
      .filter((x) => x.n < minPer)
      .sort((a, b) => a.n - b.n)
      .slice(0, 6);
    if (thin.length === 0 && state.posts.length > 0) break;
    if (state.posts.length === 0) break;

    const batch = 16;
    const agentLines = state.agents
      .map((a, i) => `${i}: u/${a.username} (${a.archetype})`)
      .join('\n');
    const user = `DEPTH WAVE ${wave}/${waves} (cast size does NOT change this target)
Need ~${minPer} comments per post. Thin threads:
${thin.map((t) => `- ${t.p.id} “${t.p.title.slice(0, 50)}” (${t.n} comments) ids=[${(t.p.comments || []).map((c) => c.id).slice(0, 4).join(',')}]`).join('\n')}

AGENTS:
${agentLines}

BRIEF:
${state.brief.slice(0, 5000)}

FEED:
${feedSnapshot(state, 6)}

Return JSON: { "items": [ { "type":"reply", "authorIndex":0, "targetPostId":"...", "targetCommentId":"...", "body":"...", "vibe":"mid" } ] }
~${batch} reply items. ≥80% must include targetCommentId.`;

    try {
      const raw = await generateJson(system, user);
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
      const items = Array.isArray(parsed?.items) ? parsed.items : [];
      let applied = 0;
      for (const item of items) {
        if (item?.type && item.type !== 'reply') continue;
        const idx = Number(item?.authorIndex);
        const agent =
          state.agents[
            Number.isFinite(idx)
              ? clamp(Math.floor(idx), 0, state.agents.length - 1)
              : applied % state.agents.length
          ];
        if (!agent) continue;
        applyAction(
          state,
          agent,
          {
            action: 'reply',
            targetPostId: item?.targetPostId ? String(item.targetPostId) : undefined,
            targetCommentId: item?.targetCommentId ? String(item.targetCommentId) : undefined,
            body: String(item?.body || '').trim() || undefined,
            vibe: (['masterpiece', 'solid', 'mid', 'slop'] as const).includes(item?.vibe)
              ? item.vibe
              : agent.bias,
          },
          200 + wave
        );
        applied += 1;
      }
      const ev: ArenaEvent = {
        type: 'depth_wave',
        ts: Date.now(),
        round: 200 + wave,
        summary: `Depth wave ${wave}: +${applied} nested replies (depth independent of agent count)`,
      };
      state.events.push(ev);
      emit(ev);
    } catch (err: any) {
      const ev: ArenaEvent = {
        type: 'error',
        ts: Date.now(),
        summary: `Depth wave ${wave} failed: ${err?.message || 'error'}`,
      };
      state.events.push(ev);
      emit(ev);
    }
  }
}

function flattenComments(posts: RedditPost[]): RedditComment[] {
  const out: RedditComment[] = [];
  for (const p of posts) for (const c of p.comments || []) out.push(c);
  return out;
}

function vibeSplitFrom(posts: RedditPost[]) {
  const split = { masterpiece: 0, solid: 0, mid: 0, slop: 0 };
  for (const p of posts) {
    if (p.vibe in split) split[p.vibe] += 1;
    for (const c of p.comments || []) {
      if (c.vibe in split) split[c.vibe] += 1;
    }
  }
  return split;
}

function roomVibeFrom(split: Record<string, number>): StoryVibe {
  const entries = Object.entries(split) as [StoryVibe, number][];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] || 'solid';
}

function hotTakesFrom(state: SubState): string[] {
  return state.posts
    .slice(0, 5)
    .map((p) => p.title)
    .filter(Boolean);
}

function personasFrom(state: SubState) {
  return state.agents.slice(0, 6).map((a, i) => {
    const acted = state.events.filter(
      (e) => e.agentId === a.id && e.action && e.action.action !== 'lurk'
    );
    const lurkedHard =
      state.events.filter((e) => e.agentId === a.id && e.action?.action === 'lurk').length >= 2;
    const quitEpisode = lurkedHard
      ? Math.max(1, Math.floor(state.epCount * (0.3 + (i % 3) * 0.15)))
      : 0;
    return {
      id: a.id,
      name: a.username,
      profile: `${a.archetype} · ${a.flair}`,
      quitEpisode,
      quitScene: quitEpisode ? `around Ep ${quitEpisode}` : '',
      reason:
        acted[0]?.summary ||
        (lurkedHard
          ? `Went quiet after the feed heated up — ${a.strategy.slice(0, 80)}`
          : a.strategy.slice(0, 120)),
      beatExcerpt: acted[0]?.action?.talksAbout || a.archetype,
    };
  });
}

function leaveReasonsFrom(state: SubState) {
  const pacing = state.posts.filter((p) => p.kind === 'pacing' || p.kind === 'should_i_continue');
  const reasons = pacing.slice(0, 3).map((p, i) => ({
    reason: p.body?.slice(0, 140) || p.title,
    episodeHint: `Ep ${p.aboutEpisode ?? '?'} · ${p.kind}`,
    sharePct: Math.max(8, 28 - i * 6),
  }));
  if (reasons.length === 0) {
    reasons.push({
      reason: 'Mid-arc fatigue / clarity dips — emergent from arena lurkers',
      episodeHint: `Ep ${Math.max(1, Math.floor(state.epCount / 2))}`,
      sharePct: 22,
    });
  }
  return reasons;
}

function replyStormsFrom(posts: RedditPost[]) {
  return posts
    .map((p) => {
      const commentCount = (p.comments || []).reduce(
        (n, c) => n + 1 + (c.replies?.length || 0),
        0
      );
      return { postId: p.id, title: p.title, commentCount };
    })
    .sort((a, b) => b.commentCount - a.commentCount)
    .slice(0, 5);
}

/** Map arena SubState → InsightsResult-shaped payload (room + personas + light dna/cut). */
export function arenaToInsightsPayload(
  state: SubState,
  meta: { seriesId: string; title: string; episodes: Array<{ episodeNumber?: number; title?: string; scriptText?: string }> }
) {
  const posts = state.posts;
  const comments = flattenComments(posts);
  const split = vibeSplitFrom(posts);
  const grounding = extractStructureFromEpisodes(meta.episodes);
  const scale = scaleFandomFromStory(meta.episodes.length, grounding.characters.length);
  const personas = personasFrom(state);
  const leaveReasons = leaveReasonsFrom(state);
  const storms = replyStormsFrom(posts);
  const commentCount = posts.reduce(
    (n, p) => n + (p.comments || []).reduce((m, c) => m + 1 + (c.replies?.length || 0), 0),
    0
  );

  const disputed =
    posts.find((p) => (p.comments?.length || 0) >= 2) || posts[0] || null;
  const ep = disputed?.aboutEpisode || Math.max(1, Math.floor(state.epCount / 2));
  const epObj = meta.episodes.find((e) => Number(e.episodeNumber) === ep) || meta.episodes[0];
  const excerpt = (epObj?.scriptText || '').trim().slice(0, 500) || disputed?.body || '';

  return {
    seriesId: meta.seriesId,
    title: meta.title,
    isDemoFixture: false,
    arena: {
      runId: state.runId,
      agentCount: state.agents.length,
      rounds: state.plan?.rounds ?? ARENA_ROUNDS,
      eventCount: state.events.length,
      postCount: posts.length,
      commentCount,
      replyStorms: storms,
      events: state.events,
      databricks: undefined as
        | {
            synced: boolean;
            mode: 'skipped' | 'local_only' | 'volume_upload' | 'error';
            volumePath?: string;
            localDir?: string;
            message?: string;
            files?: string[];
          }
        | undefined,
    },
    room: {
      subreddit: state.subreddit,
      tagline: state.tagline,
      audienceSize: scale.audienceSize,
      roomVibe: roomVibeFrom(split),
      vibeSplit: split,
      hotTakes: hotTakesFrom(state),
      posts,
      comments,
      engagement: {
        audienceSize: scale.audienceSize,
        lurkersPct: 90,
        occasionalPct: 9,
        heavyPostersPct: 1,
        estimatedViewers: Math.round(scale.audienceSize * 0.85),
        estimatedCommenters: Math.max(
          comments.length,
          Math.round(scale.audienceSize * 0.02)
        ),
        wouldFinishPct: 42,
        wouldPausePct: 28,
        wouldLeavePct: 30,
        leaveReasons,
        researchNote:
          'Helix runs agents live. Databricks Free stores the event pack and clusters what sparks heat across runs.',
        onlineNow: scale.onlineNow,
        postsPerDay: scale.postsPerDay,
        commentsPerDay: scale.commentsPerDay,
        depthScore: scale.depthScore,
        fandomMaturity: scale.fandomMaturity,
        controversyIndex: scale.controversyIndex,
        bingeCommitment: scale.bingeCommitment,
      },
    },
    structure: {
      characters: grounding.characters,
      scenes: grounding.scenes,
      timeline: grounding.timeline,
    },
    dna: {
      summary: `Multi-agent arena on “${state.title}”: ${posts.length} posts / ${commentCount} comments from ${state.agents.length} bots.`,
      pacing: 55,
      suspense: 60,
      romance: 20,
      conflict: 70,
      dialogueDensity: 55,
      emotionalIntensity: 58,
      tropes: ['multi-agent arena', 'emergent discourse'],
    },
    personas,
    repetition: null,
    confusion: null,
    cut: disputed
      ? {
          episodeNumber: ep,
          beatLabel: disputed.title.slice(0, 80),
          original: excerpt,
          fast: `${excerpt.slice(0, 280)}\n\n(NARRATOR — tighter)\nLand the turn; cut the throat-clearing.`,
          detailed: `${excerpt}\n\n[SFX: held breath]\n(NARRATOR — richer)\nOne extra beat of cost, then move.`,
          explanation:
            'Cut target = the post that drew the most arena replies — not a script doctor order.',
          threadConsensus: disputed.title,
        }
      : null,
    dropOff: null,
  };
}

/** JSONL lines for Databricks-style event export */
export function arenaEventsToJsonl(state: SubState): string {
  return state.events
    .map((e) =>
      JSON.stringify({
        run_id: state.runId,
        series_title: state.title,
        event_type: e.type,
        ts: e.ts,
        round: e.round ?? null,
        agent_id: e.agentId ?? null,
        username: e.username ?? null,
        summary: e.summary,
        action: e.action?.action ?? null,
        post_id: e.postId ?? null,
      })
    )
    .join('\n');
}
