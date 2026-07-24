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
  episodes: StoryEpisode[];
}

export interface GenreBlendItem {
  name: string;
  percentage: number;
}

export interface StoryGenome {
  primaryGenre: string;
  genreBlend: GenreBlendItem[];
  emotionalIntensity: number; // 0-100
  pacingVelocity: number; // 0-100
  dialogueDensity: number; // 0-100
  suspenseIndex: number; // 0-100
  romanceIndex: number; // 0-100
  actionScale: number; // 0-100
  humorRating: number; // 0-100
  hookStrength: number; // 0-100
  detectedTropes: string[];
  archetype: string;
}

export interface HookAnalysis {
  score: number; // 0-100
  hookTimeframe: string; // e.g., "0-45 seconds"
  verdict: 'Exceptional' | 'Engaging' | 'Moderate' | 'Weak';
  strengths: string[];
  weaknesses: string[];
  suggestedOpeningHook: string;
}

export interface RetentionSegment {
  timestamp: string; // e.g. "0:30", "1:15", "2:45"
  retentionPercent: number; // 0-100
  riskLevel: 'optimal' | 'low' | 'medium' | 'high';
  reason: string;
  suggestedFix: string;
  sceneExcerpt: string;
}

export interface EmotionalPoint {
  timestamp: string;
  sceneNumber: number;
  dominantEmotion: string; // e.g., "Tension", "Joy", "Heartbreak", "Suspense", "Betrayal"
  intensity: number; // 0-100
  valence: number; // -100 to 100
  description: string;
}

export interface StoryIssue {
  id: string;
  type: 'plot_hole' | 'character_inconsistency' | 'repetitive_dialogue' | 'pacing_drop' | 'weak_cliffhanger' | 'continuity_error';
  severity: 'critical' | 'major' | 'minor';
  title: string;
  location: string; // e.g. "Episode 1, Scene 2"
  description: string;
  suggestedResolution: string;
  beforeScriptSnippet: string;
  afterScriptSnippet: string;
}

export interface BenchmarkComparison {
  metricName: string;
  currentScore: number;
  platformTop10Avg: number;
  status: 'above_average' | 'average' | 'needs_improvement';
}

export interface EpisodeSummaryAnalysis {
  episodeNumber: number;
  title: string;
  cliffhangerScore: number;
  summary: string;
  keyStrengths: string;
  keyWeaknesses: string;
}

export interface AnalysisResult {
  storyId: string;
  title: string;
  overallScore: number; // 0-100
  commercialViability: 'S Tier' | 'A Tier' | 'B Tier' | 'C Tier';
  predictedCompletionRate: number; // 0-100
  executiveSummary: string;
  genome: StoryGenome;
  hookAnalysis: HookAnalysis;
  retentionCurve: RetentionSegment[];
  emotionalTimeline: EmotionalPoint[];
  issues: StoryIssue[];
  benchmark: BenchmarkComparison[];
  episodesAnalyses: EpisodeSummaryAnalysis[];
}
