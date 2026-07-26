/**
 * Research-backed fandom SUBREDDIT simulator for GPT-5.6.
 *
 * Structural research (not vibes):
 * - Fandom Reddit is a FEED of posts, not one OP everyone replies to.
 * - Participation inequality (NN/g 90-9-1): ~90% lurk, ~9% occasional, ~1% heavy.
 * - Serial drop-off + story-depth scaling for sub size / post volume.
 */

import { extractStructureFromEpisodes } from './scriptGrounding';
import { scaleFandomFromStory } from './fandomScale';

export const REDDIT_ROOM_SYSTEM = `You simulate a fandom subreddit feed for a serialized audio/fiction show.
You are NOT simulating one mega-thread where everyone replies to a single OP.
You are NOT a script doctor. Output one JSON object only.

## What a real fandom sub looks like
- Many independent POSTs on the front page (episode discussions, theories, character takes, pacing rants, "should I continue?", short reactions).
- Each post has its own small comment tree (often 0–4 comments). Most posts are NOT piled into by the whole sub.
- Different posts argue DIFFERENT beats/episodes. Cloning one controversy across the whole feed is fake.
- Mature balance: enough distinct OPs to feel like a feed, then real replies that react to those OPs — not random noise and not bot spam.

## Voice (critical — real fans, not robots)
Write like people who actually felt the episodes in their body at midnight.
- Feel first (grief, irritation, soft pride, dread, crush, betrayal), then one concrete Ep + cast beat from the brief.
- First person. Uneven length. Fragments, mild sarcasm, unfinished thoughts ok.
- Titles should look like real Reddit — specific, a little messy, opinionated — never "Discussion Thread" or studio labels.
- Ban essay/chatbot tells: "Great point", "This!", "I'd love to", "as an AI", "Let's unpack", "Coming in hot", "Opening take", "vibes check", "emotional cost", "told than felt", "character development", "thematic resonance", "compelling arc", "in this episode we see", corporate polish.
- Critique craft and plot. No hate speech. Avoid the word "slop" in bodies — say mid, rushed, cheap, filler, undercooked.

## Why people post (motives — do not label them in JSON)
Differentiation · disagreement · identity/experience · emotional arousal · craft taste-signal · confusion · joke.

## What creates engagement
- Contested / weakly-negative claims get more replies than pure praise.
- Depth in a few posts > one giant pile-on.
- Power law inside each post: many posts with 0–1 comments; a few get 2–4 replies.

## Hard constraints
- JSON only. Omit "structure".
- dna.* numbers 0–100. cut required.
- room.posts is the primary feed (required). Do not dump everything into room.comments only.
- Every post title and comment cites Ep N and/or a CAST name from the brief.
- Match the provided fandom scale magnitudes (members, activity) to story depth.`;

export function buildRoomBrief(
  episodes: Array<{ episodeNumber?: number; title?: string; scriptText?: string }>
): string {
  const grounding = extractStructureFromEpisodes(episodes);
  const cast = grounding.characters
    .slice(0, 22)
    .map((c) => `${c.name} (Ep ${c.firstAppearsEpisode})`)
    .join('; ');

  const n = episodes.length;
  const detailIdx = new Set<number>();
  for (let i = 0; i < Math.min(4, n); i++) detailIdx.add(i);
  if (n > 5) {
    for (const frac of [0.25, 0.4, 0.55, 0.7, 0.85]) {
      detailIdx.add(Math.min(n - 1, Math.floor(n * frac)));
    }
  }
  detailIdx.add(Math.max(0, n - 2));
  detailIdx.add(Math.max(0, n - 1));

  const lines: string[] = [
    `CAST: ${cast || '(speakers in scripts)'}`,
    `EPISODES: ${n}. Use only facts below — do not invent off-script lore.`,
  ];

  episodes.forEach((ep, i) => {
    const num = Number(ep.episodeNumber) || i + 1;
    const title = (ep.title || `Episode ${num}`).trim();
    const text = (ep.scriptText || '').replace(/\s+/g, ' ').trim();
    if (detailIdx.has(i)) {
      const excerpt = text.slice(0, 480) + (text.length > 480 ? '…' : '');
      lines.push(`★ Ep ${num} · ${title}: ${excerpt}`);
    } else {
      const hook = text.slice(0, 120) + (text.length > 120 ? '…' : '');
      lines.push(`· Ep ${num} · ${title}${hook ? `: ${hook}` : ''}`);
    }
  });

  const joined = lines.join('\n');
  if (joined.length <= 28000) return joined;
  return joined.slice(0, 18000) + '\n…[middle trimmed]…\n' + joined.slice(-8000);
}

export function buildInsightsUserPrompt(body: {
  title?: string;
  genre?: string;
  targetAudience?: string;
  episodes: Array<{ episodeNumber?: number; title?: string; scriptText?: string }>;
}): { prompt: string; targetComments: number; targetPosts: number } {
  const { title, genre, targetAudience, episodes } = body;
  const epCount = episodes.length;
  const grounding = extractStructureFromEpisodes(episodes);
  const scale = scaleFandomFromStory(epCount, grounding.characters.length);
  const targetPosts = scale.targetPosts;
  const targetComments = targetPosts;
  const seed = Math.floor(Math.random() * 9000 + 1000);
  const brief = buildRoomBrief(episodes);
  const audienceSize = scale.audienceSize;
  const heavy = Math.max(40, Math.round(audienceSize * 0.01));
  const occasional = Math.round(audienceSize * 0.09);
  const lurkers = audienceSize - heavy - occasional;
  const hotTakeCount = Math.min(5, Math.max(3, Math.floor(targetPosts / 2)));

  const extraSlots = [
    targetPosts >= 7 ? '7) reaction — short hype/grief about one moment' : '',
    targetPosts >= 8 ? '8) theory OR character on a late ★ episode' : '',
    targetPosts >= 9 ? '9) episode_discussion — a mid-series rupture beat' : '',
    targetPosts >= 10 ? '10) pacing OR should_i_continue — second drop-off angle' : '',
    targetPosts >= 11 ? '11) character — side character / mentor debate' : '',
    targetPosts >= 12 ? '12) reaction — finale / cliffhanger energy' : '',
  ]
    .filter(Boolean)
    .join('\n');

  const prompt = `Simulate the fandom SUBREDDIT for this upload — a front page of separate posts.

## Series
- Title: ${title || 'Untitled'}
- Genre: ${genre || 'Serial drama'}
- Stated audience: ${targetAudience || 'General'}
- Episodes: ${epCount}
- Cast size (parsed): ${grounding.characters.length}
- Seed: ${seed}

## Fandom scale (match these magnitudes — derived from story depth)
- depthScore: ${scale.depthScore}/100 (${scale.fandomMaturity} fandom)
- audienceSize ≈ ${audienceSize}
- onlineNow ≈ ${scale.onlineNow}
- postsPerDay ≈ ${scale.postsPerDay}, commentsPerDay ≈ ${scale.commentsPerDay}
- controversyIndex ≈ ${scale.controversyIndex}, bingeCommitment ≈ ${scale.bingeCommitment}
A ${epCount}-ep upload must feel bigger/more fractious than a short pilot. Do not undersize the sub.

## Story brief (only plot source)
${brief}

## Feed recipe (mandatory)
Create exactly ${targetPosts} items in room.posts. Each post is a DIFFERENT discussion topic.
Cover these kinds first:
1) episode_discussion — post-ep evaluation of a ★ episode
2) episode_discussion — a DIFFERENT episode
3) theory — lore / foreshadowing
4) character — earnedness / arc debate
5) pacing — mid-arc fatigue / identity-shift risk
6) should_i_continue — paused listener asks if it gets better
${extraSlots}

Rules:
- Titles look like Reddit post titles (specific, emotional, episode-tagged) — not labels like "Discussion Thread".
- Bodies and comments: human + feeling first, then Ep/cast detail. Uneven length. React to each other. No chatbot / essay filler.
- Hot takes: exactly ${hotTakeCount} strings about DIFFERENT episodes/beats.
- Inside each post: 1–4 comments. ≥3 posts have active discussion. ≥2 posts stay quiet (0–1 comments).
- Authors unique across posts.
- Vibe budget: masterpiece ≥1, solid ≥2, mid ≥2, slop ≥1. Bodies say mid/rushed/undercooked — avoid writing the word "slop".
- Upvotes scale with fandom size (hot posts can hit hundreds–thousands when established/obsessed).

## Engagement funnel (for judges)
Apply 90-9-1 on audienceSize ${audienceSize}:
- lurkersPct ≈ 90, occasionalPct ≈ 9, heavyPostersPct ≈ 1
- estimatedCommenters ≈ ${heavy + Math.round(occasional * 0.15)}
- estimatedViewers >> commenters
- Include: onlineNow, postsPerDay, commentsPerDay, depthScore, fandomMaturity, controversyIndex, bingeCommitment
- wouldFinishPct + wouldPausePct + wouldLeavePct ≈ 100
- leaveReasons: 2–4 with episodeHint + sharePct
- researchNote: cite 90-9-1 + serial drop-off + depth-scaled fandom size

Silent majority approx: lurkers ~${lurkers}, occasional ~${occasional}, heavy ~${heavy}.

## cut (required)
Stretch argued across multiple posts / leaveReasons. original from a ★ excerpt.

## personas
4–6 handles; ≥2 with quitEpisode > 0.

## JSON shape
{
  "room": {
    "subreddit": "r/...",
    "tagline": "sub sidebar energy",
    "audienceSize": number,
    "roomVibe": "masterpiece"|"solid"|"mid"|"slop",
    "vibeSplit": { "masterpiece": n, "solid": n, "mid": n, "slop": n },
    "hotTakes": ["..."],
    "posts": [ {
      "id": "p1",
      "kind": "episode_discussion"|"theory"|"character"|"pacing"|"should_i_continue"|"reaction",
      "title": "string",
      "author": "unique_handle",
      "flair": "optional",
      "upvotes": number,
      "vibe": "masterpiece"|"solid"|"mid"|"slop",
      "body": "optional short OP",
      "aboutEpisode": number,
      "comments": [ {
        "id": "c1", "username": "unique_handle", "vibe": "masterpiece"|"solid"|"mid"|"slop",
        "upvotes": number, "body": "string", "talksAbout": "string",
        "replies": [ { "id": "r1", "username": "other", "body": "string", "upvotes": number } ]
      } ]
    } ],
    "engagement": {
      "audienceSize": number,
      "lurkersPct": 90, "occasionalPct": 9, "heavyPostersPct": 1,
      "estimatedViewers": number, "estimatedCommenters": number,
      "wouldFinishPct": number, "wouldPausePct": number, "wouldLeavePct": number,
      "leaveReasons": [ { "reason": "string", "episodeHint": "Ep N · …", "sharePct": number } ],
      "researchNote": "string",
      "onlineNow": number, "postsPerDay": number, "commentsPerDay": number,
      "depthScore": number,
      "fandomMaturity": "nascent"|"growing"|"established"|"obsessed",
      "controversyIndex": number, "bingeCommitment": number
    }
  },
  "dna": {
    "summary": "2 sentences", "pacing": 0-100, "suspense": 0-100, "romance": 0-100,
    "conflict": 0-100, "dialogueDensity": 0-100, "emotionalIntensity": 0-100, "tropes": ["..."]
  },
  "personas": [
    { "id": "p1", "name": "handle", "profile": "string", "quitEpisode": number, "quitScene": "string", "reason": "string", "beatExcerpt": "string" }
  ],
  "repetition": null,
  "confusion": null,
  "cut": {
    "episodeNumber": number, "beatLabel": "string", "original": "string",
    "fast": "string", "detailed": "string", "explanation": "string", "threadConsensus": "string"
  }
}

Before finishing: posts.length === ${targetPosts}; ≥4 kinds; engagement includes depth metrics.`;

  return { prompt, targetComments, targetPosts };
}
