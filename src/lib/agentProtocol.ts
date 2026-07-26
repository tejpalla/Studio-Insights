/**
 * Shared protocol for isolated agent turns.
 * Orchestrator ↔ worker threads / HTTP agent containers speak this only.
 */

export type ArenaActionType = 'new_post' | 'reply' | 'upvote' | 'lurk';

export interface TurnAgentCard {
  id: string;
  username: string;
  archetype: string;
  strategy: string;
  flair: string;
  bias: string;
}

/** What an isolated worker receives — one persona only, no other agents' private state. */
export interface TurnRequest {
  requestId: string;
  round: number;
  agent: TurnAgentCard;
  system: string;
  user: string;
}

export interface TurnResponse {
  requestId: string;
  ok: boolean;
  rawJson?: string;
  error?: string;
  isolation: 'worker_thread' | 'http_container' | 'inline';
}

export const AGENT_TURN_SYSTEM = `You are ONE Reddit user in a multi-agent fandom sub simulation.
You take exactly ONE action per turn. Return ONLY JSON.
You are an isolated agent: you only know your persona card + the feed snapshot below.
Rules:
- Stay in character (archetype + strategy).
- Cite Ep N and/or a cast name from the brief when you post/reply.
- Prefer disagreement / differentiation over cloning praise.
- DEPTH > BREADTH: once a few posts exist, strongly prefer reply (nest with targetCommentId). Do NOT spam new_post.
- Only new_post if feed is empty OR you have a truly new angle.
- If feed is praise-heavy: lean mid/rough critique.
- Bodies: human Gen-Z/casual Reddit voice, variable length, light meme energy ok, no "slop" word, no corporate AI tone.
- Prefer reply over lurk when a thin thread needs depth.
- action "upvote" needs targetPostId or targetCommentId.
- action "reply" needs targetPostId and body; set targetCommentId to nest.
- action "new_post" needs kind, title, body, vibe, aboutEpisode.`;
