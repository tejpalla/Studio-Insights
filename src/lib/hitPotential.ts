import type { InsightsResult, StoryVibe } from '../types';

export type PromotionReadiness = 'Hold and revise' | 'Test organically' | 'Run a small promotion' | 'Scale cautiously';

export interface HitPotentialSignal {
  score: number;
  readiness: PromotionReadiness;
  confidence: 'Low';
  evidence: Array<{ label: string; value: number; detail: string }>;
  nextStep: string;
}

const VIBE_VALUE: Record<StoryVibe, number> = {
  masterpiece: 100,
  solid: 72,
  mid: 40,
  slop: 12,
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * A deliberately conservative pre-promotion signal. It is a local calculation
 * over one AI simulation, not a prediction of real-world commercial success.
 */
export function buildHitPotentialSignal(result: InsightsResult): HitPotentialSignal {
  const engagement = result.room.engagement;
  const comments = result.room.comments || [];
  const vibeScore = comments.length
    ? comments.reduce((sum, comment) => sum + VIBE_VALUE[comment.vibe], 0) / comments.length
    : VIBE_VALUE[result.room.roomVibe];
  const finish = engagement?.wouldFinishPct ?? 50;
  const leave = engagement?.wouldLeavePct ?? 30;
  const storyCraft =
    (result.dna.pacing + result.dna.suspense + result.dna.conflict + result.dna.emotionalIntensity) /
    4;
  const conversation = Math.min(
    100,
    ((result.room.posts?.length || 0) * 8 + comments.length * 5 + (engagement?.controversyIndex || 0))
  );

  const score = clamp(
    storyCraft * 0.3 + finish * 0.3 + vibeScore * 0.24 + conversation * 0.16 - leave * 0.08
  );

  let readiness: PromotionReadiness = 'Hold and revise';
  let nextStep = 'Address the strongest leave reason, then re-run the room before spending on promotion.';
  if (score >= 78) {
    readiness = 'Scale cautiously';
    nextStep = 'Validate with a small real listener cohort before increasing promotion spend.';
  } else if (score >= 64) {
    readiness = 'Run a small promotion';
    nextStep = 'Run a tightly capped promotion test and compare real completion and follow rates.';
  } else if (score >= 48) {
    readiness = 'Test organically';
    nextStep = 'Share with a small unpaid listener group and collect real continuation intent.';
  }

  return {
    score,
    readiness,
    // One generated room cannot establish real market confidence. This remains low until real audience data exists.
    confidence: 'Low',
    evidence: [
      { label: 'Story craft', value: clamp(storyCraft), detail: 'Pacing, suspense, conflict and emotional intensity.' },
      { label: 'Finish intent', value: clamp(finish), detail: `${clamp(leave)}% simulated leave rate.` },
      { label: 'Room sentiment', value: clamp(vibeScore), detail: `${comments.length} simulated comments.` },
      { label: 'Conversation pull', value: clamp(conversation), detail: 'Posts, comments and disagreement—not reach.' },
    ],
    nextStep,
  };
}
