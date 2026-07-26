export interface StoryEpisode {
  id: string;
  episodeNumber: number;
  title: string;
  scriptText: string;
}

export interface StoryScript {
  id: string;
  title: string;
  genre: string;
  targetAudience: string;
  synopsis?: string;
  episodes: StoryEpisode[];
}

export interface StructureCharacter {
  name: string;
  role: string;
  firstAppearsEpisode: number;
  notes?: string;
}

export interface StructureScene {
  id: string;
  episodeNumber: number;
  order: number;
  title: string;
  summary: string;
  charactersPresent: string[];
}

export interface StructureTimelineBeat {
  episodeNumber: number;
  label: string;
  summary: string;
}

export interface StoryStructure {
  characters: StructureCharacter[];
  scenes: StructureScene[];
  timeline: StructureTimelineBeat[];
}

export interface StoryDNA {
  summary: string;
  pacing: number;
  suspense: number;
  romance: number;
  conflict: number;
  dialogueDensity: number;
  emotionalIntensity: number;
  tropes: string[];
}

/** How the simulated Reddit room grades the whole story — not a line edit. */
export type StoryVibe = 'masterpiece' | 'solid' | 'mid' | 'slop';

/** Fandom-sub post kinds (TV/Reddit research: post-ep, theory, character, etc.). */
export type RedditPostKind =
  | 'episode_discussion'
  | 'theory'
  | 'character'
  | 'pacing'
  | 'should_i_continue'
  | 'reaction';

export interface RedditComment {
  id: string;
  username: string;
  flair?: string;
  vibe: StoryVibe;
  upvotes: number;
  body: string;
  /** Whole-story talk, not “change line 12”. */
  talksAbout: string;
  replies?: Array<{
    id: string;
    username: string;
    body: string;
    upvotes: number;
  }>;
}

/** One post in the fandom sub — not a reply to a single mega-thread. */
export interface RedditPost {
  id: string;
  kind: RedditPostKind;
  title: string;
  author: string;
  flair?: string;
  upvotes: number;
  vibe: StoryVibe;
  /** Short OP text (optional). */
  body?: string;
  aboutEpisode?: number;
  comments: RedditComment[];
}

/**
 * Participation + retention + sub vitality for judges.
 * Anchored on NN/g 90-9-1 + serial drop-off + story-depth scaling.
 */
export interface EngagementFunnel {
  audienceSize: number;
  lurkersPct: number;
  occasionalPct: number;
  heavyPostersPct: number;
  estimatedViewers: number;
  estimatedCommenters: number;
  wouldFinishPct: number;
  wouldPausePct: number;
  wouldLeavePct: number;
  leaveReasons: Array<{ reason: string; episodeHint: string; sharePct: number }>;
  researchNote: string;
  /** Extra sub vitality (depth-scaled). */
  onlineNow?: number;
  postsPerDay?: number;
  commentsPerDay?: number;
  depthScore?: number;
  fandomMaturity?: 'nascent' | 'growing' | 'established' | 'obsessed';
  controversyIndex?: number;
  bingeCommitment?: number;
}

export interface RedditRoom {
  subreddit: string;
  tagline: string;
  audienceSize: number;
  roomVibe: StoryVibe;
  vibeSplit: { masterpiece: number; solid: number; mid: number; slop: number };
  hotTakes: string[];
  /** Multi-post fandom feed (primary). */
  posts: RedditPost[];
  /** Flattened comments across posts — for heat / legacy panels. */
  comments: RedditComment[];
  engagement?: EngagementFunnel;
  /** Derived: why this room is quiet vs on fire (reply depth + polarization). */
  discussionHeat?: {
    level: 'quiet' | 'warm' | 'hot' | 'on_fire';
    score: number;
    why: string;
  };
}

export interface PersonaRisk {
  id: string;
  name: string;
  profile: string;
  quitEpisode: number;
  quitScene: string;
  reason: string;
  beatExcerpt: string;
}

export interface RepetitionInsight {
  pattern: string;
  episodeNumbers: number[];
  whyItHurts: string;
  examples: string[];
}

export interface ConfusionInsight {
  episodeNumber: number;
  scene: string;
  reason: string;
  newCharactersIntroduced: string[];
  excerpt: string;
}

export interface CutProposal {
  episodeNumber: number;
  beatLabel: string;
  original: string;
  fast: string;
  detailed: string;
  explanation: string;
  /** Framed as what the room is arguing about — writer keeps liberty. */
  threadConsensus?: string;
}

export interface DropOffInsight {
  source: 'csv';
  dipMinute: number;
  retentionAtDip: number;
  linkedBeat: string;
  reason: string;
}

export interface InsightsResult {
  seriesId: string;
  title: string;
  room: RedditRoom;
  structure: StoryStructure;
  dna: StoryDNA;
  personas: PersonaRisk[];
  repetition: RepetitionInsight | null;
  confusion: ConfusionInsight | null;
  cut: CutProposal | null;
  dropOff?: DropOffInsight | null;
  isDemoFixture?: boolean;
  /** Phase 2 multi-agent arena metadata */
  arena?: {
    runId: string;
    agentCount: number;
    rounds: number;
    eventCount: number;
    postCount?: number;
    commentCount?: number;
    /** Top reply-storm posts — preview of what Databricks heat notebook scores */
    replyStorms?: Array<{ postId: string; title: string; commentCount: number }>;
    databricks?: {
      synced: boolean;
      mode: 'skipped' | 'local_only' | 'volume_upload' | 'error';
      volumePath?: string;
      localDir?: string;
      message?: string;
      files?: string[];
    };
    events?: Array<{
      type: string;
      ts: number;
      round?: number;
      username?: string;
      summary: string;
    }>;
  };
}

export type AppView = 'home' | 'series' | 'insights';
export type InsightsSection = 'thread' | 'pulse' | 'cut' | 'map';
