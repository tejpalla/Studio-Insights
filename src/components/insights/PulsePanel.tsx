import React from 'react';
import { EngagementFunnel, InsightsResult, RedditComment, StoryVibe } from '../../types';

const VIBE_LABEL: Record<StoryVibe, string> = {
  masterpiece: 'Peak',
  solid: 'Solid',
  mid: 'Mid',
  slop: 'Rough',
};

const VIBE_STYLE: Record<StoryVibe, string> = {
  masterpiece: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  solid: 'bg-sky-100 text-sky-900 border-sky-300',
  mid: 'bg-amber-100 text-amber-950 border-amber-300',
  slop: 'bg-rose-100 text-rose-900 border-rose-300',
};

function countVibes(comments: RedditComment[]) {
  const split = { masterpiece: 0, solid: 0, mid: 0, slop: 0 };
  for (const c of comments) {
    if (c.vibe in split) split[c.vibe] += 1;
  }
  return split;
}

export const PulsePanel: React.FC<{ result: InsightsResult }> = ({ result }) => {
  const { room, repetition, confusion } = result;
  const vibeSplit = room.vibeSplit ?? countVibes(room.comments || []);
  const total =
    (vibeSplit.masterpiece || 0) +
    (vibeSplit.solid || 0) +
    (vibeSplit.mid || 0) +
    (vibeSplit.slop || 0);
  const personas = Array.isArray(result.personas) ? result.personas : [];
  const roomVibe = (room.roomVibe in VIBE_STYLE ? room.roomVibe : 'solid') as StoryVibe;
  const eng = room.engagement;
  const posts = room.posts || [];

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="font-display text-2xl text-ink">Room pulse</h2>
        <p className="text-sm text-ink-muted max-w-2xl">
          Fandom-sub weather + who actually engages vs who leaves — not vanity hit %.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <span
            className={`px-3 py-1 rounded border text-xs font-semibold uppercase ${VIBE_STYLE[roomVibe]}`}
          >
            {VIBE_LABEL[roomVibe]}
          </span>
          <span className="text-sm text-ink-muted">
            {(room.audienceSize || 0).toLocaleString()} in {room.subreddit || 'r/AudioDrama'} ·{' '}
            {posts.length} posts
          </span>
        </div>
      </section>

      {eng && <EngagementCard eng={eng} />}

      <section className="border border-line rounded-xl bg-white p-5 space-y-3">
        <h3 className="text-sm font-semibold text-ink">Visible vibe split (commenters only)</h3>
        <p className="text-[11px] text-ink-muted">
          These bars are the loud 10% — lurkers never show up here (90-9-1).
        </p>
        {(
          [
            ['masterpiece', vibeSplit.masterpiece || 0],
            ['solid', vibeSplit.solid || 0],
            ['mid', vibeSplit.mid || 0],
            ['slop', vibeSplit.slop || 0],
          ] as const
        ).map(([key, count]) => (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-ink">{VIBE_LABEL[key]}</span>
              <span className="text-ink-muted">{count}</span>
            </div>
            <div className="h-2 bg-paper-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  key === 'masterpiece'
                    ? 'bg-emerald-500'
                    : key === 'solid'
                    ? 'bg-sky-500'
                    : key === 'mid'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${total ? (count / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </section>

      <section className="grid sm:grid-cols-2 gap-4">
        <div className="border border-line rounded-xl bg-white p-4 space-y-2">
          <h3 className="text-sm font-semibold text-ink">What they keep chewing on</h3>
          {repetition ? (
            <p className="text-sm text-ink-muted">
              Pattern talk: <span className="text-ink font-medium">{repetition.pattern}</span> —{' '}
              {repetition.whyItHurts}
            </p>
          ) : (
            <p className="text-sm text-ink-muted">
              No strong loop pile-on — skim posts for repeated fights.
            </p>
          )}
        </div>
        <div className="border border-line rounded-xl bg-white p-4 space-y-2">
          <h3 className="text-sm font-semibold text-ink">Where they got lost</h3>
          {confusion ? (
            <p className="text-sm text-ink-muted">
              Ep {confusion.episodeNumber}: {confusion.reason}
            </p>
          ) : (
            <p className="text-sm text-ink-muted">No explicit confusion flag — check pacing posts.</p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-ink">Voices (still Simulated)</h3>
        {personas.length === 0 ? (
          <p className="text-sm text-ink-muted border border-dashed border-line rounded-lg p-4">
            No personas this run.
          </p>
        ) : (
          <ul className="space-y-2">
            {personas.map((p) => (
              <li key={p.id} className="border border-line rounded-lg bg-white p-3">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="font-medium text-ink">u/{p.name}</span>
                  <span className="text-xs text-ink-muted">
                    {p.quitEpisode > 0 ? `Paused · Ep ${p.quitEpisode}` : 'Still in'}
                  </span>
                </div>
                <p className="text-xs text-ink-muted mt-1">{p.profile}</p>
                <p className="text-sm text-ink mt-2">{p.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

function EngagementCard({ eng }: { eng: EngagementFunnel }) {
  const finish = eng.wouldFinishPct || 0;
  const pause = eng.wouldPausePct || 0;
  const leave = eng.wouldLeavePct || 0;

  return (
    <section className="border border-line rounded-xl bg-white p-5 space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-ink">Who engages vs who leaves</h3>
        <p className="text-[11px] text-ink-muted leading-relaxed">{eng.researchNote}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <Metric label="Lurk" value={`${Math.round(eng.lurkersPct)}%`} hint="read only" />
        <Metric label="Occasional" value={`${Math.round(eng.occasionalPct)}%`} hint="light posts" />
        <Metric label="Heavy" value={`${Math.round(eng.heavyPostersPct)}%`} hint="most posts" />
        <Metric
          label="Online"
          value={`${(eng.onlineNow || 0).toLocaleString()}`}
          hint={`${eng.postsPerDay || '—'} posts/day`}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <Metric label="Depth" value={`${eng.depthScore ?? '—'}`} hint={eng.fandomMaturity || 'fandom'} />
        <Metric label="Controversy" value={`${eng.controversyIndex ?? '—'}`} hint="index" />
        <Metric label="Binge pull" value={`${eng.bingeCommitment ?? '—'}`} hint="commitment" />
        <Metric
          label="Comments/day"
          value={`${(eng.commentsPerDay || 0).toLocaleString()}`}
          hint="activity"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-paper-2 border border-line p-3">
          <div className="text-xs text-ink-muted">Estimated viewers</div>
          <div className="text-lg font-semibold text-ink">
            {(eng.estimatedViewers || 0).toLocaleString()}
          </div>
        </div>
        <div className="rounded-lg bg-paper-2 border border-line p-3">
          <div className="text-xs text-ink-muted">Estimated commenters</div>
          <div className="text-lg font-semibold text-ink">
            {(eng.estimatedCommenters || 0).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs text-ink-muted">
          <span>Finish</span>
          <span>Pause</span>
          <span>Leave</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden flex bg-paper-2">
          <div className="bg-emerald-500" style={{ width: `${finish}%` }} title="Finish" />
          <div className="bg-amber-400" style={{ width: `${pause}%` }} title="Pause" />
          <div className="bg-rose-500" style={{ width: `${leave}%` }} title="Leave" />
        </div>
        <div className="flex justify-between text-xs font-medium text-ink">
          <span>{finish}%</span>
          <span>{pause}%</span>
          <span>{leave}%</span>
        </div>
      </div>

      {(eng.leaveReasons || []).length > 0 && (
        <ul className="space-y-2">
          {eng.leaveReasons.map((r, i) => (
            <li key={i} className="text-sm border border-line rounded-lg p-3 bg-paper-2/50">
              <div className="flex justify-between gap-2 text-xs text-ink-muted">
                <span>{r.episodeHint}</span>
                <span>{r.sharePct}% of leavers</span>
              </div>
              <p className="text-ink mt-1">{r.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-line bg-paper-2 p-2">
      <div className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="text-base font-semibold text-ink">{value}</div>
      <div className="text-[10px] text-ink-muted">{hint}</div>
    </div>
  );
}
