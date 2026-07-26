/**
 * Deterministic fandom-sub scale from story depth.
 * Used so judges see believable member/activity numbers even when the model is vague.
 *
 * Anchors:
 * - Longer serials + denser casts → bigger, more fractious fandoms
 * - NN/g 90-9-1 still applies on top of whatever member count we set
 */

export interface FandomScale {
  depthScore: number;
  targetPosts: number;
  audienceSize: number;
  onlineNow: number;
  postsPerDay: number;
  commentsPerDay: number;
  fandomMaturity: 'nascent' | 'growing' | 'established' | 'obsessed';
  controversyIndex: number;
  bingeCommitment: number;
}

export function scaleFandomFromStory(epCount: number, castCount = 8): FandomScale {
  const eps = Math.max(1, epCount);
  const cast = Math.max(2, castCount);
  // 0–100: more episodes + named cast ⇒ deeper lore wars
  const depthScore = Math.min(
    100,
    Math.round(eps * 3.2 + Math.min(cast, 24) * 1.4 + (eps > 12 ? 12 : 0))
  );

  const targetPosts = Math.min(12, Math.max(6, 5 + Math.floor(eps / 3) + (eps >= 16 ? 1 : 0)));

  // Members scale roughly with depth² so 24-ep LOTM feels bigger than a 3-ep pilot
  const audienceSize = Math.round(900 + depthScore * depthScore * 1.85 + eps * 420 + cast * 90);

  const onlineNow = Math.max(12, Math.round(audienceSize * (0.004 + depthScore / 12000)));
  const postsPerDay = Math.max(3, Math.round(2 + depthScore / 12 + eps / 5));
  const commentsPerDay = Math.max(20, Math.round(postsPerDay * (6 + depthScore / 20)));

  let fandomMaturity: FandomScale['fandomMaturity'] = 'nascent';
  if (depthScore >= 75) fandomMaturity = 'obsessed';
  else if (depthScore >= 50) fandomMaturity = 'established';
  else if (depthScore >= 28) fandomMaturity = 'growing';

  const controversyIndex = Math.min(100, Math.round(35 + depthScore * 0.45 + (eps > 8 ? 10 : 0)));
  const bingeCommitment = Math.min(100, Math.round(40 + Math.min(eps, 16) * 2.8));

  return {
    depthScore,
    targetPosts,
    audienceSize,
    onlineNow,
    postsPerDay,
    commentsPerDay,
    fandomMaturity,
    controversyIndex,
    bingeCommitment,
  };
}
