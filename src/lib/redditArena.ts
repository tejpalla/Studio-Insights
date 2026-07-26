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

const ARCHETYPES: Array<{
  archetype: string;
  bias: StoryVibe;
  flairs: string[];
  strategies: string[];
  namePool: string[];
}> = [
  {
    archetype: 'lore_nerd',
    bias: 'solid',
    flairs: ['lore first', 'canon cop', 'timeline enjoyer', 'notes app open'],
    strategies: [
      'Quietly obsessed — when a timeline clicks, celebrate it, then point at the Ep tip.',
      'Catch people mixing up who said what. Soft flex, not textbook.',
      'Connect early foreshadowing to a later Ep without sounding like a wiki.',
    ],
    namePool: [
      'FogArchivist', 'NotebookMargin', 'CanonThread', 'GrayFogIndex', 'MarginScribble',
      'LoreReceipts', 'PageDogEar', 'WhisperIndex', 'RedStringBoard', 'EpStickyNote',
    ],
  },
  {
    archetype: 'pacing_hater',
    bias: 'slop',
    flairs: ['skip button ready', 'mid-arc exit', 'clockwatcher', 'filler radar'],
    strategies: [
      'Restless — name the stretch that made you check the clock.',
      'Vent about stalls like texting a friend, not writing a review.',
      'Call out repetition with a specific Ep range and zero polish.',
    ],
    namePool: [
      'SkipToTwist', 'PacingKnife', 'MidArcExit', 'FillerDetector', 'SpeedRunPast',
      'WaitForPlot', 'StallAlarm', 'ChapterDrag', 'FastForwardFan', 'DeadAirEp',
    ],
  },
  {
    archetype: 'craft_defender',
    bias: 'masterpiece',
    flairs: ['audio craft', 'earn it', 'line that hit', 'structure stan'],
    strategies: [
      'Protect moments that actually hit — get defensive when dunks feel lazy.',
      'Name the line/beat that still sits in your chest.',
      'Steelman craft when the feed is piled on mid/slop takes.',
    ],
    namePool: [
      'SoundstageFan', 'EarnItOrDont', 'CraftOverLore', 'MicDropEp', 'StageLeftTear',
      'DialogueFirst', 'SceneWeight', 'SoftCutBeliever', 'BeatThatLanded', 'QuietPeak',
    ],
  },
  {
    archetype: 'character_stan',
    bias: 'mid',
    flairs: ['character first', 'protective mode', 'arc or nothing', 'soft for them'],
    strategies: [
      'Wear your heart for one cast member — hurt, proud, protective.',
      'Argue from feeling first, then cite the Ep that did it.',
      'Get soft/mad when their turn feels unfair.',
    ],
    namePool: [
      'ArcOrNothing', 'StanTheCaptain', 'NameOnThePage', 'GriefMeter', 'SoftForThem',
      'ProtectTheLead', 'HeartOnSleeve', 'ThatOneCharacter', 'EpHurtClub', 'LoyalToAFault',
    ],
  },
  {
    archetype: 'dropoff_risk',
    bias: 'mid',
    flairs: ['paused at Ep ?', 'maybe later', 'tired binge', 'come back if…'],
    strategies: [
      'Honest pause energy — say where you stopped and what might bring you back.',
      'Soft quit, not a survey. Ask if a later Ep actually pays off.',
      'Admit fatigue without performing hate.',
    ],
    namePool: [
      'PausedOnEp', 'ComeBackLater', 'DropThreat', 'WillItGetBetter', 'HalfBingeLeft',
      'SleepInstead', 'MaybeTomorrow', 'QuitAdjacent', 'EnergyGone', 'HookMeBack',
    ],
  },
  {
    archetype: 'contrarian',
    bias: 'slop',
    flairs: ['devil advocate', 'lonely take', 'not that take', 'argue different'],
    strategies: [
      'Spiky playful disagreement — take the lonely angle with feeling.',
      'If the feed agrees, push the under-discussed beat. Never clone.',
      'Steelman the villain of the thread without becoming a debate club.',
    ],
    namePool: [
      'OppositeDay', 'HotColdTake', 'NotThatTake', 'ArgueDiffer', 'UnderdogAngle',
      'WaitActually', 'CounterFog', 'SpikyTake', 'LonelyOpinion', 'FlipTheThread',
    ],
  },
  {
    archetype: 'hype_beast',
    bias: 'masterpiece',
    flairs: ['standing ovation', 'hit replay', 'one more ep', 'yelling'],
    strategies: [
      'Loud joy — name the moment that made you yell or hit replay.',
      'Short and alive. Empty hype not allowed.',
      'Celebrate a specific Ep beat like you just clipped it.',
    ],
    namePool: [
      'LetsGoooFog', 'ClipThatBeat', 'HypeTrainEp', 'OneMoreEp', 'ScreamingQuietly',
      'ReplayButton', 'ChestHit', 'ThatPeakTho', 'GoOffShow', 'StandingO',
    ],
  },
  {
    archetype: 'confused_newbie',
    bias: 'solid',
    flairs: ['first binge', 'wait who', 'timeline lost', 'explain gently'],
    strategies: [
      'Lost but invested — ask who/when/why with a little panic.',
      'Admit what you missed; keep it warm.',
      'Clarify a cast/Ep mixup without fake confidence.',
    ],
    namePool: [
      'WaitWhoDied', 'TimelineLost', 'NewbieNotes', 'ExplainLikeImEp1', 'ConfusedButIn',
      'WhoIsThatAgain', 'FirstBingeBrain', 'LostAtEp', 'HoldOnWhat', 'CatchMeUp',
    ],
  },
];

const NAME_PREFIX = [
  'Fog', 'Gray', 'Night', 'Soft', 'Wild', 'Quiet', 'Loud', 'Salt', 'Iron', 'Pale',
  'Burnt', 'Lucky', 'Tired', 'Sweet', 'Broken', 'Late', 'Early', 'Cold', 'Warm', 'Hollow',
];
const NAME_SUFFIX = [
  'Listener', 'Margin', 'Archive', 'Thread', 'Pulse', 'Echo', 'Receipt', 'Notebook',
  'Binger', 'Stan', 'Crit', 'Ghost', 'Meter', 'Radio', 'Page', 'Drop', 'Fan', 'Owl',
];

const SPAWN_VERBS = [
  'joined the sub',
  'slid into the feed',
  'opened the thread',
  'clocked in',
  'wandered in',
  'hopped on',
  'showed up spicy',
  'came back for blood',
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

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickOne<T>(list: T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length) % list.length];
}

function mintUsername(used: Set<string>, rand: () => number, pool: string[], i: number): string {
  const tries = [
    ...shuffleInPlace([...pool], rand),
    `${pickOne(NAME_PREFIX, rand)}${pickOne(NAME_SUFFIX, rand)}`,
    `${pickOne(NAME_PREFIX, rand)}${pickOne(NAME_SUFFIX, rand)}${Math.floor(rand() * 90 + 10)}`,
    `${pickOne(pool, rand)}${Math.floor(rand() * 90 + 10)}`,
    `u${Math.floor(rand() * 9000 + 1000)}fan`,
  ];
  for (const name of tries) {
    const key = name.toLowerCase();
    if (!used.has(key)) {
      used.add(key);
      return name;
    }
  }
  const fallback = `Fan${i + 1}_${Math.floor(rand() * 900 + 100)}`;
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
  const minCommentsPerPost = 6;
  const depthWaves = 4;
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
  const rand = mulberry32(seed);
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
  const castNames = grounding.characters.slice(0, 16).map((c) => c.name);
  const castHint = castNames.length ? pickOne(castNames, rand) : 'the lead';
  const epHint = 1 + Math.floor(rand() * Math.max(1, episodes.length));

  // Shuffle archetype deck each run so spawn order isn't always lore→pacing→…
  const deck = shuffleInPlace(
    Array.from({ length: n }, (_, i) => ARCHETYPES[i % ARCHETYPES.length]),
    rand
  );

  const agents: ArenaAgent[] = deck.map((arch, i) => {
    const strategy = pickOne(arch.strategies, rand);
    const flair = pickOne(arch.flairs, rand);
    const username = mintUsername(used, rand, arch.namePool, i);
    return {
      id: `agent_${i + 1}`,
      username,
      archetype: arch.archetype,
      strategy,
      flair,
      bias: arch.bias,
    };
  });

  const slug = (opts.title || 'Series')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .slice(0, 18) || 'Series';

  const events: ArenaEvent[] = agents.map((a) => {
    const verb = pickOne(SPAWN_VERBS, rand);
    const hooks = [
      `watching ${castHint}`,
      `still mad about Ep ${epHint}`,
      `here for ${a.flair}`,
      `eye on Ep ${epHint}`,
      'soft for this mess',
    ];
    return {
      type: 'agent_spawned' as const,
      ts: Date.now(),
      agentId: a.id,
      username: a.username,
      summary: `u/${a.username} ${verb} · ${a.archetype.replace(/_/g, ' ')} · ${pickOne(hooks, rand)}`,
    };
  });

  return {
    runId: `run_${Date.now()}_${seed}`,
    title: opts.title || 'Untitled',
    subreddit: `r/${slug}Arena`,
    tagline: `${opts.title || 'Series'} — ${agents.length} fans · ${plan.rounds} rounds · seed ${seed}`,
    posts: [],
    agents,
    events,
    brief,
    epCount: episodes.length,
    castNames,
    seed,
    plan,
  };
}

function feedSnapshot(state: SubState, maxPosts = 8): string {
  if (state.posts.length === 0) {
    return 'FEED EMPTY — write one careful new_post grounded in a specific Ep + cast beat from the brief.';
  }
  // Prefer thin threads so agents deepen them; still show enough body to understand
  const ranked = [...state.posts].sort(
    (a, b) => countPostComments(a) - countPostComments(b)
  );
  return ranked
    .slice(0, maxPosts)
    .map((p) => {
      const comments = (p.comments || [])
        .slice(0, 5)
        .map((c) => {
          const replies = (c.replies || [])
            .slice(0, 4)
            .map((r) => `      ↳ [${r.id}] u/${r.username}: ${r.body.slice(0, 140)}`)
            .join('\n');
          return `    - [${c.id}] u/${c.username} (${c.vibe}, ${c.upvotes}, ${c.replies?.length || 0} nested): ${c.body.slice(0, 220)}${
            replies ? `\n${replies}` : ''
          }`;
        })
        .join('\n');
      return `[${p.id}] ${p.kind} · Ep ${p.aboutEpisode ?? '?'} · ${p.upvotes}↑ · u/${p.author} · ${countPostComments(p)} comments\n  TITLE: ${p.title}\n  BODY: ${(p.body || '').slice(0, 280)}\n  COMMENTS:\n${comments || '    (none — if you reply, start the thread carefully)'}`;
    })
    .join('\n\n');
}

const AGENT_SYSTEM = AGENT_TURN_SYSTEM;

function countPostComments(p: RedditPost): number {
  return (p.comments || []).reduce((n, c) => n + 1 + (c.replies?.length || 0), 0);
}

function softPostCeiling(state: SubState): number {
  const n = state.agents.length;
  return Math.max(5, Math.min(12, Math.round(4 + n / 4)));
}

/** Grow the front page first — this is why runs were stuck at 1 OP. */
function softPostFloor(state: SubState): number {
  const ceiling = softPostCeiling(state);
  return Math.max(4, Math.min(ceiling, Math.round(ceiling * 0.75)));
}

function archetypeDefaultKind(archetype: string): RedditPostKind {
  if (archetype === 'pacing_hater') return 'pacing';
  if (archetype === 'lore_nerd') return 'theory';
  if (archetype === 'character_stan') return 'character';
  if (archetype === 'dropoff_risk') return 'should_i_continue';
  if (archetype === 'hype_beast') return 'reaction';
  if (archetype === 'confused_newbie') return 'episode_discussion';
  return 'episode_discussion';
}

function forcedNewPost(agent: ArenaAgent, state: SubState, parsed?: any): ArenaAction {
  const ep =
    Number(parsed?.aboutEpisode) > 0
      ? Math.min(Number(parsed.aboutEpisode), Math.max(1, state.epCount))
      : 1 + ((state.seed + state.posts.length * 3 + agent.id.length) % Math.max(1, state.epCount));
  const cast =
    state.castNames[(state.seed + state.posts.length + agent.id.length) % Math.max(1, state.castNames.length)] ||
    'the lead';
  const kind = KINDS.includes(parsed?.kind) ? parsed.kind : archetypeDefaultKind(agent.archetype);
  const title =
    humanizeText(parsed?.title ? String(parsed.title) : undefined) ||
    (kind === 'pacing'
      ? `Ep ${ep} almost made me quit mid-listen`
      : kind === 'theory'
        ? `ok wait — Ep ${ep} and ${cast}… I think I caught something`
        : kind === 'character'
          ? `I am UNWELL about ${cast} after Ep ${ep}`
          : kind === 'should_i_continue'
            ? `paused at Ep ${ep} and I feel weird quitting on ${cast}`
            : kind === 'reaction'
              ? `that ${cast} moment in Ep ${ep} wrecked me`
              : `can't stop thinking about ${cast} in Ep ${ep}`);

  const fallbackBodies: Record<string, string> = {
    pacing: `Ep ${ep} dragged so hard I started doomscrolling between lines. ${cast} is right there and the story just… stalls. I'm annoyed more than bored, which somehow feels worse.`,
    theory: `Rewound Ep ${ep} twice because ${cast} said something that doesn't sit clean. Maybe I'm spiraling but I don't think that tip was accidental.`,
    character: `Look I know I'm biased but Ep ${ep} hurt. ${cast} deserved better than that turn and I sat there staring at my screen like an idiot.`,
    should_i_continue: `Paused around Ep ${ep}. Not hate-watching — just tired. If ${cast} actually gets a real payoff soon I'll come back. Someone tell me honestly if it gets kinder.`,
    reaction: `Ep ${ep}. ${cast}. I actually said "nope" out loud. That one got me.`,
    episode_discussion: `Finished Ep ${ep} and I'm still stuck on ${cast}. Not a clean take — just this weird mix of care and frustration I can't shake.`,
  };
  const body =
    humanizeText(parsed?.body ? String(parsed.body) : undefined) ||
    fallbackBodies[kind] ||
    fallbackBodies.episode_discussion;

  return {
    action: 'new_post',
    kind,
    title,
    body,
    vibe: (['masterpiece', 'solid', 'mid', 'slop'] as const).includes(parsed?.vibe)
      ? parsed.vibe
      : agent.bias,
    aboutEpisode: ep,
    talksAbout: parsed?.talksAbout ? String(parsed.talksAbout) : cast,
  };
}

/** Strip common chatbot tells from model output. */
function humanizeText(text?: string): string | undefined {
  if (!text) return undefined;
  let t = text.trim();
  if (!t) return undefined;
  const banned = [
    /\bas an ai\b/gi,
    /\bi'?d love to\b/gi,
    /\bit'?s worth noting\b/gi,
    /\blet'?s unpack\b/gi,
    /\bcoming in hot\b/gi,
    /\bgreat point!?\b/gi,
    /\bthis!\b/gi,
    /\bopening take\b/gi,
    /\bin conclusion\b/gi,
    /\bvibes check\b/gi,
    /\bpushing back on this\b/gi,
    /\bthe emotional cost\b/gi,
    /\bfeels more told than felt\b/gi,
    /\bnarrative beats?\b/gi,
    /\bcharacter development\b/gi,
    /\bthematic resonance\b/gi,
    /\bcompelling arc\b/gi,
    /\bnuanced portrayal\b/gi,
    /\bas a fan i appreciate\b/gi,
  ];
  for (const re of banned) t = t.replace(re, '').trim();
  t = t.replace(/\s{2,}/g, ' ').replace(/^[,.\-\s]+/, '').trim();
  return t || undefined;
}

function buildAgentUserPrompt(state: SubState, agent: ArenaAgent, round: number): string {
  const posts = state.posts.length;
  const ceiling = softPostCeiling(state);
  const floor = softPostFloor(state);
  const avg =
    posts > 0
      ? (
          state.posts.reduce((s, p) => s + countPostComments(p), 0) / posts
        ).toFixed(1)
      : '0';

  const existingAngles = state.posts
    .slice(0, 8)
    .map((p) => `Ep ${p.aboutEpisode ?? '?'} · ${p.kind} · ${p.title.slice(0, 60)}`)
    .join(' | ');

  let depthHint: string;
  if (posts === 0) {
    depthHint =
      'FEED EMPTY — action MUST be new_post. Pick ONE concrete beat from the brief (Ep + name).';
  } else if (posts < floor) {
    depthHint = `FRONT PAGE TOO THIN (${posts}/${floor} minimum posts). action MUST be new_post with a DIFFERENT episode/character/conflict than: ${existingAngles || '(none)'}. Do NOT reply yet — grow the feed first.`;
  } else if (posts < ceiling) {
    depthHint = `BOARD GROWING (${posts}/${ceiling} posts, ~${avg} comments/post). Mix is ok: new_post only for a truly fresh angle; otherwise reply + nest.`;
  } else {
    depthHint = `BOARD MATURE (${posts} posts ≥ ceiling ${ceiling}, ~${avg} comments/post). Prefer nested reply. new_post almost never.`;
  }

  return `ROUND ${round}/${state.plan?.rounds ?? ARENA_ROUNDS}
SERIES: ${state.title} (${state.epCount} episodes)
CAST (only these people): ${state.castNames.join('; ') || 'see brief'}
BALANCE TARGET: at least ${floor} distinct posts, soft cap ~${ceiling} · then ≥${state.plan?.minCommentsPerPost ?? 6} comments per post
VOICE: lead with feeling (hurt / hype / irritation / soft pride), then one concrete Ep + cast beat. No essay-bot tone.
${depthHint}

YOU ARE (do not paste this card into your body):
- username: ${agent.username}
- archetype: ${agent.archetype}
- flair: ${agent.flair}
- strategy: ${agent.strategy}
- vibe bias: ${agent.bias}

STORY BRIEF — ground every claim here. Do not invent off-brief lore:
${state.brief.slice(0, 10000)}

CURRENT FEED (read before you write; reply to what people actually said):
${feedSnapshot(state)}

Return JSON only:
{
  "action": "new_post" | "reply" | "upvote" | "lurk",
  "targetPostId": "optional",
  "targetCommentId": "optional — nest under this comment id",
  "kind": "episode_discussion"|"theory"|"character"|"pacing"|"should_i_continue"|"reaction",
  "title": "human fan title if new_post",
  "body": "specific, story-grounded, human",
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
    return state.posts.length < softPostFloor(state)
      ? forcedNewPost(agent, state)
      : { action: 'lurk' };
  }
  const action = (['new_post', 'reply', 'upvote', 'lurk'] as const).includes(parsed?.action)
    ? parsed.action
    : 'lurk';

  const floor = softPostFloor(state);
  const ceiling = softPostCeiling(state);

  // Force a real front page before depth — models otherwise stuck on 1 mega-thread
  if (state.posts.length < floor && action !== 'new_post') {
    return forcedNewPost(agent, state, parsed);
  }

  if (state.posts.length === 0 && action !== 'new_post') {
    return forcedNewPost(agent, state, parsed);
  }

  // Mature ceiling: allow a handful of distinct OPs, then force nesting
  if (action === 'new_post' && state.posts.length >= ceiling) {
    const thin = [...state.posts].sort((a, b) => countPostComments(a) - countPostComments(b))[0];
    const parent = thin?.comments?.[0];
    const cast = state.castNames[state.seed % Math.max(1, state.castNames.length)] || 'that beat';
    return {
      action: 'reply',
      targetPostId: thin?.id,
      targetCommentId: parent?.id,
      body:
        humanizeText(parsed?.body) ||
        humanizeText(parsed?.title) ||
        `I keep circling Ep ${thin?.aboutEpisode ?? '?'} and ${cast} — your title is close but I'm still mad/soft about whether that choice was even fair to them.`,
      vibe: (['masterpiece', 'solid', 'mid', 'slop'] as const).includes(parsed?.vibe)
        ? parsed.vibe
        : agent.bias,
      talksAbout: parsed?.talksAbout ? String(parsed.talksAbout) : cast,
    };
  }

  const vibe = (['masterpiece', 'solid', 'mid', 'slop'] as const).includes(parsed?.vibe)
    ? parsed.vibe
    : agent.bias;
  const kind = KINDS.includes(parsed?.kind) ? parsed.kind : archetypeDefaultKind(agent.archetype);

  return {
    action,
    targetPostId: parsed?.targetPostId ? String(parsed.targetPostId) : undefined,
    targetCommentId: parsed?.targetCommentId ? String(parsed.targetCommentId) : undefined,
    kind,
    title: humanizeText(parsed?.title ? String(parsed.title) : undefined),
    body: humanizeText(parsed?.body ? String(parsed.body) : undefined),
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
    const castHint =
      state.castNames[(state.seed + state.posts.length) % Math.max(1, state.castNames.length)] ||
      'this cast';
    const post: RedditPost = {
      id: uid('post'),
      kind: action.kind || 'episode_discussion',
      title:
        humanizeText(action.title?.trim()) ||
        `Ep ${aboutEpisode} — is ${castHint}'s turn actually earned?`,
      author: agent.username,
      flair: agent.flair,
      upvotes: 3 + (state.seed % 20),
      vibe: action.vibe || agent.bias,
      body:
        humanizeText(action.body?.trim()) ||
        `Ep ${aboutEpisode} left me weird about ${castHint}. I care more than I want to admit and that choice still sits wrong.`,
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

  const castHint =
    state.castNames[(state.seed + round) % Math.max(1, state.castNames.length)] || 'that beat';
  const body =
    humanizeText(action.body?.trim()) ||
    `ugh I keep thinking about Ep ${post.aboutEpisode ?? '?'} and ${castHint} — your take is close but it skipped how that moment actually felt.`;
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

/** Reply waves that deepen threads with human, story-grounded comments. */
async function deepenThreads(
  state: SubState,
  generateJson: JsonGenerator,
  opts?: { onEvent?: (ev: ArenaEvent) => void }
): Promise<void> {
  const emit = opts?.onEvent || (() => undefined);
  const minPer = state.plan?.minCommentsPerPost ?? 6;
  const waves = state.plan?.depthWaves ?? 4;
  const system = `You write nested Reddit replies that could pass as real humans.
Return ONLY JSON. Replies only — no new_post.
Rules:
- Midnight-phone voice: feeling first, then one detail from the parent + Ep/cast from the brief.
- Different people each time — uneven length, first person, specific. Not a review essay.
- Ban: "Great point", "This!", "Coming in hot", "I'd love to", "as an AI", "emotional cost", "told than felt", "character development", "thematic resonance", archetype labels.
- Prefer targetCommentId nesting. React for real — don't echo.`;

  for (let wave = 1; wave <= waves; wave++) {
    const thin = state.posts
      .map((p) => ({ p, n: countPostComments(p) }))
      .filter((x) => x.n < minPer)
      .sort((a, b) => a.n - b.n)
      .slice(0, 5);
    if (thin.length === 0 && state.posts.length > 0) break;
    if (state.posts.length === 0) break;

    const batch = 12;
    const agentLines = state.agents
      .map((a, i) => `${i}: u/${a.username} (${a.archetype}, ${a.bias})`)
      .join('\n');
    const user = `DEPTH WAVE ${wave}/${waves}
Goal: about ${minPer} thoughtful comments per post (mature balance — not spam).
Thin threads to deepen:
${thin
  .map(
    (t) =>
      `- ${t.p.id} “${t.p.title.slice(0, 70)}” Ep ${t.p.aboutEpisode ?? '?'} (${t.n} comments)\n  OP: ${(t.p.body || '').slice(0, 180)}\n  commentIds=[${(t.p.comments || []).map((c) => c.id).slice(0, 5).join(', ')}]`
  )
  .join('\n')}

CAST: ${state.castNames.join(', ')}
AGENTS (authorIndex):
${agentLines}

BRIEF:
${state.brief.slice(0, 6000)}

FEED:
${feedSnapshot(state, 6)}

Return JSON:
{ "items": [ { "type":"reply", "authorIndex":0, "targetPostId":"...", "targetCommentId":"...", "body":"specific human reply", "vibe":"mid" } ] }
About ${batch} replies. ≥75% with targetCommentId. Each body: feeling + Ep or cast name. No robotic essay tone.`;

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
        const body = String(item?.body || '').trim();
        if (body.length < 24) continue;
        applyAction(
          state,
          agent,
          {
            action: 'reply',
            targetPostId: item?.targetPostId ? String(item.targetPostId) : undefined,
            targetCommentId: item?.targetCommentId ? String(item.targetCommentId) : undefined,
            body,
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
        summary: `Depth wave ${wave}: +${applied} grounded replies`,
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
