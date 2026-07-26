import type {
  EngagementFunnel,
  InsightsResult,
  RedditComment,
  RedditPost,
  RedditPostKind,
  StoryDNA,
  StoryStructure,
  StoryVibe,
} from '../types';
import { scaleFandomFromStory } from './fandomScale';

function asNumber(value: unknown, fallback = 50): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
  if (typeof value === 'string') {
    const m = value.match(/-?\d+(\.\d+)?/);
    if (m) return Math.max(0, Math.min(100, Math.round(Number(m[0]))));
    const lower = value.toLowerCase();
    if (/high|strong|intense|brilliant|master/.test(lower)) return 78;
    if (/low|minimal|little|weak|none/.test(lower)) return 22;
    if (/mid|medium|varied|mixed|some/.test(lower)) return 52;
  }
  return fallback;
}

function pickString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function coerceEpisode(value: unknown): number | null {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  return null;
}

function normalizeCharacter(raw: unknown, index: number) {
  if (typeof raw === 'string' && raw.trim()) {
    // Missing episode → leave unset; UI should not invent Ep 1.
    return { name: raw.trim(), role: 'Character', firstAppearsEpisode: 0 };
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const name = pickString(o.name, o.username, o.character, o.title);
    const ep = coerceEpisode(o.firstAppearsEpisode ?? o.episode);
    if (!name) {
      // e.g. { "Klein Moretti": "protagonist" }
      const entries = Object.entries(o).filter(
        ([k]) => !['role', 'notes', 'firstAppearsEpisode', 'episode'].includes(k)
      );
      if (entries.length === 1 && typeof entries[0][0] === 'string') {
        return {
          name: entries[0][0],
          role: String(entries[0][1] ?? 'Character'),
          firstAppearsEpisode: ep ?? 0,
        };
      }
    }
    if (!name) return { name: '', role: 'Character', firstAppearsEpisode: 0 };
    return {
      name,
      role: pickString(o.role, o.description) || 'Character',
      firstAppearsEpisode: ep ?? 0,
      notes: o.notes ? String(o.notes) : undefined,
    };
  }
  return { name: '', role: 'Character', firstAppearsEpisode: 0 };
}

function normalizeScene(raw: unknown, index: number) {
  if (typeof raw === 'string' && raw.trim()) {
    return {
      id: `s${index + 1}`,
      episodeNumber: 1,
      order: index + 1,
      title: raw.trim(),
      summary: raw.trim(),
      charactersPresent: [] as string[],
    };
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    return {
      id: pickString(o.id) || `s${index + 1}`,
      episodeNumber: Number(o.episodeNumber || o.episode || 1) || 1,
      order: Number(o.order || index + 1) || index + 1,
      title: pickString(o.title, o.name, o.scene) || `Scene ${index + 1}`,
      summary: pickString(o.summary, o.description, o.title) || '',
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
  if (typeof raw === 'string' && raw.trim()) {
    return { episodeNumber: index + 1, label: raw.trim(), summary: raw.trim() };
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    return {
      episodeNumber: Number(o.episodeNumber || index + 1) || index + 1,
      label: pickString(o.label, o.title, o.name) || `Beat ${index + 1}`,
      summary: pickString(o.summary, o.description, o.label) || '',
    };
  }
  return { episodeNumber: index + 1, label: `Beat ${index + 1}`, summary: '' };
}

function normalizePersona(raw: unknown, index: number, comments: RedditComment[]) {
  if (typeof raw === 'string' && raw.trim()) {
    return {
      id: `p${index + 1}`,
      name: raw.trim(),
      profile: '',
      quitEpisode: 0,
      quitScene: '',
      reason: '',
      beatExcerpt: '',
    };
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    let name = pickString(o.name, o.username, o.handle);
    if (!name && comments[index]?.username) name = comments[index].username;
    if (!name) name = `voice_${index + 1}`;
    return {
      id: pickString(o.id) || `p${index + 1}`,
      name,
      profile: pickString(o.profile, o.flair, o.bio),
      quitEpisode: Number(o.quitEpisode || 0) || 0,
      quitScene: o.quitScene == null ? '' : String(o.quitScene),
      reason: pickString(o.reason, o.take),
      beatExcerpt: pickString(o.beatExcerpt, o.excerpt),
    };
  }
  return {
    id: `p${index + 1}`,
    name: comments[index]?.username || `voice_${index + 1}`,
    profile: '',
    quitEpisode: 0,
    quitScene: '',
    reason: '',
    beatExcerpt: '',
  };
}

function countVibes(comments: RedditComment[]) {
  const split = { masterpiece: 0, solid: 0, mid: 0, slop: 0 };
  for (const c of comments) {
    if (c.vibe in split) split[c.vibe as StoryVibe] += 1;
  }
  return split;
}

/** Discussion heat from real Reddit dynamics: reply chains + polarized vibes. */
export function discussionHeat(comments: RedditComment[]): {
  level: 'quiet' | 'warm' | 'hot' | 'on_fire';
  score: number;
  why: string;
} {
  const top = comments.length;
  const replyCount = comments.reduce((n, c) => n + (c.replies?.length || 0), 0);
  const depth = top ? replyCount / top : 0;
  const split = countVibes(comments);
  const polar = (split.masterpiece + split.slop) / Math.max(1, top);
  const disagree = (split.mid + split.slop) / Math.max(1, top);
  // Weighted: nested replies matter more than pile-on top-level praise ([Conbersa](https://www.conbersa.ai/learn/how-reddit-algorithm-works), PLOS discussion size)
  let score = Math.round(
    Math.min(100, top * 4 + replyCount * 8 + polar * 35 + disagree * 25 + (depth > 1 ? 15 : 0))
  );
  let level: 'quiet' | 'warm' | 'hot' | 'on_fire' = 'quiet';
  if (score >= 70) level = 'on_fire';
  else if (score >= 45) level = 'hot';
  else if (score >= 25) level = 'warm';

  const why =
    depth >= 1
      ? 'Reply chains inside posts — depth beats a pile of lonely takes.'
      : polar > 0.35
      ? 'Polarized peak vs rough takes across the feed — controversy spreads attention.'
      : top <= 4
      ? 'Thin feed — few posts, little to disagree with.'
      : 'Mostly parallel posts — few people arguing inside threads.';

  return { level, score, why };
}

const POST_KINDS: RedditPostKind[] = [
  'episode_discussion',
  'theory',
  'character',
  'pacing',
  'should_i_continue',
  'reaction',
];

function normalizeComment(c: any, i: number): RedditComment {
  return {
    id: String(c?.id || `c${i + 1}`),
    username: pickString(c?.username, c?.name) || `user_${i + 1}`,
    flair: c?.flair ? String(c.flair) : undefined,
    vibe: (['masterpiece', 'solid', 'mid', 'slop'].includes(c?.vibe) ? c.vibe : 'solid') as StoryVibe,
    upvotes: Number(c?.upvotes) || 0,
    body: String(c?.body || ''),
    talksAbout: String(c?.talksAbout || ''),
    replies: Array.isArray(c?.replies)
      ? c.replies.map((r: any, j: number) => ({
          id: String(r?.id || `r${i}_${j}`),
          username: pickString(r?.username, r?.name) || `reply_${j}`,
          body: String(r?.body || ''),
          upvotes: Number(r?.upvotes) || 0,
        }))
      : [],
  };
}

function normalizePost(raw: any, index: number): RedditPost {
  const kind = POST_KINDS.includes(raw?.kind) ? raw.kind : 'episode_discussion';
  const comments = (Array.isArray(raw?.comments) ? raw.comments : []).map(normalizeComment);
  return {
    id: String(raw?.id || `post${index + 1}`),
    kind,
    title: pickString(raw?.title, raw?.tagline) || `Discussion ${index + 1}`,
    author: pickString(raw?.author, raw?.username) || `op_${index + 1}`,
    flair: raw?.flair ? String(raw.flair) : undefined,
    upvotes: Number(raw?.upvotes) || 0,
    vibe: (['masterpiece', 'solid', 'mid', 'slop'].includes(raw?.vibe) ? raw.vibe : 'solid') as StoryVibe,
    body: raw?.body ? String(raw.body) : undefined,
    aboutEpisode: Number(raw?.aboutEpisode) || undefined,
    comments,
  };
}

function flattenPosts(posts: RedditPost[]): RedditComment[] {
  const out: RedditComment[] = [];
  for (const p of posts) {
    for (const c of p.comments || []) out.push(c);
  }
  return out;
}

/** If model only returned flat comments, wrap into fake posts so UI still works. */
function coercePosts(room: any): RedditPost[] {
  if (Array.isArray(room?.posts) && room.posts.length > 0) {
    return room.posts.map(normalizePost);
  }
  const comments = (Array.isArray(room?.comments) ? room.comments : []).map(normalizeComment);
  if (comments.length === 0) return [];
  // Split flat comments into ~3 posts so it doesn't look like one mega-thread
  const chunk = Math.max(1, Math.ceil(comments.length / 3));
  const posts: RedditPost[] = [];
  for (let i = 0; i < comments.length; i += chunk) {
    const slice = comments.slice(i, i + chunk);
    posts.push({
      id: `legacy-${i}`,
      kind: i === 0 ? 'episode_discussion' : i === chunk ? 'character' : 'pacing',
      title: slice[0]?.talksAbout || slice[0]?.body.slice(0, 72) || `Thread ${posts.length + 1}`,
      author: slice[0]?.username || `op_${posts.length + 1}`,
      upvotes: slice[0]?.upvotes || 10,
      vibe: slice[0]?.vibe || 'solid',
      comments: slice,
    });
  }
  return posts;
}

export function buildEngagementFunnel(
  room: any,
  posts: RedditPost[],
  comments: RedditComment[],
  personas: Array<{ quitEpisode: number }>,
  episodeCount = 8,
  castCount = 8
): EngagementFunnel {
  const scale = scaleFandomFromStory(episodeCount, castCount);
  const audienceSize = Math.max(
    200,
    Number(room?.engagement?.audienceSize || room?.audienceSize) || scale.audienceSize
  );
  const fromModel = room?.engagement && typeof room.engagement === 'object' ? room.engagement : null;

  const lurkersPct = Number(fromModel?.lurkersPct) || 90;
  const occasionalPct = Number(fromModel?.occasionalPct) || 9;
  const heavyPostersPct = Number(fromModel?.heavyPostersPct) || 1;

  const estimatedCommenters =
    Number(fromModel?.estimatedCommenters) ||
    Math.max(comments.length, Math.round(audienceSize * 0.02));
  const estimatedViewers =
    Number(fromModel?.estimatedViewers) || Math.round(audienceSize * 0.85);

  let wouldLeavePct = Number(fromModel?.wouldLeavePct);
  let wouldPausePct = Number(fromModel?.wouldPausePct);
  let wouldFinishPct = Number(fromModel?.wouldFinishPct);
  if (!Number.isFinite(wouldLeavePct) || !Number.isFinite(wouldFinishPct)) {
    const quitters = personas.filter((p) => p.quitEpisode > 0).length;
    const roughShare =
      comments.filter((c) => c.vibe === 'mid' || c.vibe === 'slop').length /
      Math.max(1, comments.length);
    wouldLeavePct = Math.round(18 + roughShare * 28 + quitters * 4);
    wouldPausePct = Math.round(22 + roughShare * 12);
    wouldFinishPct = Math.max(8, 100 - wouldLeavePct - wouldPausePct);
  }

  const leaveReasons = Array.isArray(fromModel?.leaveReasons)
    ? fromModel.leaveReasons.map((r: any) => ({
        reason: String(r?.reason || ''),
        episodeHint: String(r?.episodeHint || ''),
        sharePct: Number(r?.sharePct) || 0,
      }))
    : [];

  const maturity = (['nascent', 'growing', 'established', 'obsessed'] as const).includes(
    fromModel?.fandomMaturity
  )
    ? fromModel.fandomMaturity
    : scale.fandomMaturity;

  return {
    audienceSize,
    lurkersPct,
    occasionalPct,
    heavyPostersPct,
    estimatedViewers,
    estimatedCommenters,
    wouldFinishPct,
    wouldPausePct,
    wouldLeavePct,
    leaveReasons,
    researchNote:
      String(fromModel?.researchNote || '').trim() ||
      'NN/g 90-9-1: ~90% lurk, ~9% contribute lightly, ~1% create most posts. Serials lose tire-kickers early and mid-arc ruptures later; deeper lore → larger, more controversial fandoms.',
    onlineNow: Number(fromModel?.onlineNow) || scale.onlineNow,
    postsPerDay: Number(fromModel?.postsPerDay) || scale.postsPerDay,
    commentsPerDay: Number(fromModel?.commentsPerDay) || scale.commentsPerDay,
    depthScore: Number(fromModel?.depthScore) || scale.depthScore,
    fandomMaturity: maturity,
    controversyIndex: Number(fromModel?.controversyIndex) || scale.controversyIndex,
    bingeCommitment: Number(fromModel?.bingeCommitment) || scale.bingeCommitment,
  };
}

export function normalizeInsightsClient(parsed: any, meta?: { seriesId?: string; title?: string }): InsightsResult {
  const posts = coercePosts(parsed?.room || {});
  let comments = flattenPosts(posts);
  if (comments.length === 0 && Array.isArray(parsed?.room?.comments)) {
    comments = parsed.room.comments.map(normalizeComment);
  }

  const structureIn = parsed?.structure || {};
  const dnaIn = parsed?.dna || {};
  const characters = (Array.isArray(structureIn.characters) ? structureIn.characters : [])
    .map(normalizeCharacter)
    .filter((c) => c.name);
  const scenes = (Array.isArray(structureIn.scenes) ? structureIn.scenes : []).map(normalizeScene);
  const timeline = (Array.isArray(structureIn.timeline) ? structureIn.timeline : []).map(
    normalizeTimeline
  );

  let personas = (Array.isArray(parsed?.personas) ? parsed.personas : []).map((p: unknown, i: number) =>
    normalizePersona(p, i, comments)
  );
  if (personas.length === 0 || personas.every((p) => p.name.startsWith('voice_') && !p.reason)) {
    const seen = new Set<string>();
    personas = [];
    for (const c of [...comments].sort((a, b) => b.upvotes - a.upvotes)) {
      if (seen.has(c.username)) continue;
      seen.add(c.username);
      personas.push({
        id: `from-${c.id}`,
        name: c.username,
        profile: c.flair || c.vibe,
        quitEpisode: 0,
        quitScene: '',
        reason: c.body.slice(0, 140),
        beatExcerpt: c.talksAbout,
      });
      if (personas.length >= 5) break;
    }
  }

  const dna: StoryDNA = {
    summary: String(dnaIn.summary || ''),
    pacing: asNumber(dnaIn.pacing, 50),
    suspense: asNumber(dnaIn.suspense, 50),
    romance: asNumber(dnaIn.romance, 25),
    conflict: asNumber(dnaIn.conflict, 50),
    dialogueDensity: asNumber(dnaIn.dialogueDensity, 50),
    emotionalIntensity: asNumber(dnaIn.emotionalIntensity, 50),
    tropes: Array.isArray(dnaIn.tropes) ? dnaIn.tropes.map(String) : [],
  };

  const structure: StoryStructure = { characters, scenes, timeline };
  const vibeSplit = parsed?.room?.vibeSplit || countVibes(comments);
  const heat = discussionHeat(comments);
  const engagement = buildEngagementFunnel(
    parsed?.room,
    posts,
    comments,
    personas,
    timeline.length || scenes.length || 8,
    characters.length || 8
  );

  return {
    seriesId: meta?.seriesId || parsed?.seriesId || 'series',
    title: meta?.title || parsed?.title || 'Untitled',
    isDemoFixture: Boolean(parsed?.isDemoFixture),
    room: {
      subreddit: parsed?.room?.subreddit || 'r/AudioDrama',
      tagline: parsed?.room?.tagline || meta?.title || 'Discussion',
      audienceSize: engagement.audienceSize,
      roomVibe: (parsed?.room?.roomVibe as StoryVibe) || 'solid',
      vibeSplit,
      hotTakes: Array.isArray(parsed?.room?.hotTakes) ? parsed.room.hotTakes.map(String) : [],
      posts,
      comments,
      engagement,
      discussionHeat: heat,
    },
    structure,
    dna,
    personas,
    repetition: parsed?.repetition ?? null,
    confusion: parsed?.confusion ?? null,
    cut: parsed?.cut ?? null,
    dropOff: parsed?.dropOff ?? null,
  };
}
