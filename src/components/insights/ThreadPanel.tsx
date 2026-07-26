import React, { useMemo, useState } from 'react';
import { RedditComment, RedditPost, RedditPostKind, RedditRoom, StoryVibe } from '../../types';
import { discussionHeat } from '../../lib/normalizeInsights';

const VIBE_LABEL: Record<StoryVibe, string> = {
  masterpiece: 'Peak',
  solid: 'Solid',
  mid: 'Mid',
  slop: 'Rough',
};

const VIBE_STYLE: Record<StoryVibe, string> = {
  masterpiece: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  solid: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  mid: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
  slop: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
};

const KIND_LABEL: Record<RedditPostKind, string> = {
  episode_discussion: 'Episode discussion',
  theory: 'Theory',
  character: 'Character',
  pacing: 'Pacing',
  should_i_continue: 'Should I continue?',
  reaction: 'Reaction',
};

type SortMode = 'hot' | 'new' | 'rough';

export const ThreadPanel: React.FC<{ room: RedditRoom }> = ({ room }) => {
  const [sort, setSort] = useState<SortMode>('hot');
  const [openPost, setOpenPost] = useState<Record<string, boolean>>({});
  const heat = room.discussionHeat || discussionHeat(room.comments || []);
  const eng = room.engagement;
  const posts = useMemo(() => {
    const list = [...(room.posts || [])];
    if (sort === 'hot') list.sort((a, b) => postScore(b) - postScore(a));
    else if (sort === 'rough') {
      list.sort((a, b) => vibeRankRough(b.vibe) - vibeRankRough(a.vibe) || postScore(b) - postScore(a));
    } else list.reverse();
    return list;
  }, [room.posts, sort]);

  return (
    <div className="space-y-4">
      {/* Sub header — Reddit dark */}
      <div className="rounded-2xl border border-[#343536] bg-[#1a1a1b] text-[#d7dadc] p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-[#ff4500] text-sm">{room.subreddit}</span>
          <span className="text-[#818384]">· Simulated fandom sub</span>
          <span className="text-[#818384]">· {(eng?.audienceSize || room.audienceSize).toLocaleString()} members</span>
          {eng?.onlineNow != null && (
            <span className="text-[#818384]">· {eng.onlineNow.toLocaleString()} online</span>
          )}
          <span className="px-2 py-0.5 rounded-full bg-[#272729] border border-[#343536] text-[#ffa657]">
            Feed · {heat.level.replace('_', ' ')}
          </span>
        </div>

        <h2 className="text-lg sm:text-xl font-semibold leading-snug text-white">{room.tagline}</h2>

        {/* Vitality metrics strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Depth" value={`${eng?.depthScore ?? '—'}`} hint={eng?.fandomMaturity || 'fandom'} />
          <Stat label="Controversy" value={`${eng?.controversyIndex ?? '—'}`} hint="index" />
          <Stat label="Posts / day" value={`${eng?.postsPerDay ?? '—'}`} hint="activity" />
          <Stat
            label="Binge pull"
            value={`${eng?.bingeCommitment ?? '—'}`}
            hint="commitment"
          />
        </div>

        <p className="text-[11px] text-[#818384]">
          {posts.length} posts on the page · not one mega-thread. {heat.why}
        </p>

        {(room.hotTakes || []).length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-[#818384]">Trending takes</p>
            <div className="flex flex-col gap-2">
              {(room.hotTakes || []).map((t) => (
                <div
                  key={t}
                  className="text-[12px] sm:text-[13px] px-3.5 py-2.5 rounded-full bg-[#272729] text-[#d7dadc] border border-[#343536] leading-snug"
                >
                  {t}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 text-xs">
          {(
            [
              { id: 'hot' as const, label: 'Hot' },
              { id: 'new' as const, label: 'New' },
              { id: 'rough' as const, label: 'Rough' },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSort(s.id)}
              className={`px-3 py-1.5 rounded-full ${
                sort === s.id ? 'bg-ink text-paper' : 'bg-paper-2 text-ink-muted hover:text-ink'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded border border-line bg-paper-2 text-ink-muted">
          Sub · {VIBE_LABEL[room.roomVibe]}
        </span>
      </div>

      {posts.length === 0 ? (
        <p className="text-sm text-ink-muted border border-dashed border-line rounded-xl p-6">
          No posts in this run — re-open the room.
        </p>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              open={openPost[post.id] ?? true}
              onToggle={() => setOpenPost((e) => ({ ...e, [post.id]: !(e[post.id] ?? true) }))}
            />
          ))}
        </div>
      )}
    </div>
  );
};

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl bg-[#272729] border border-[#343536] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[#818384]">{label}</div>
      <div className="text-base font-semibold text-white tabular-nums">{value}</div>
      <div className="text-[10px] text-[#818384] capitalize">{hint}</div>
    </div>
  );
}

function postScore(p: RedditPost) {
  const comments = p.comments || [];
  const replies = comments.reduce((n, c) => n + (c.replies?.length || 0), 0);
  return p.upvotes + comments.length * 12 + replies * 18;
}

function vibeRankRough(v: StoryVibe) {
  if (v === 'slop') return 3;
  if (v === 'mid') return 2;
  if (v === 'solid') return 1;
  return 0;
}

/** Every post uses the same dark Reddit card language as the sub header / take pills. */
const PostCard: React.FC<{
  post: RedditPost;
  open: boolean;
  onToggle: () => void;
}> = ({ post, open, onToggle }) => {
  const commentCount =
    (post.comments || []).length +
    (post.comments || []).reduce((n, c) => n + (c.replies?.length || 0), 0);

  return (
    <article className="rounded-2xl border border-[#343536] bg-[#1a1a1b] text-[#d7dadc] overflow-hidden hover:border-[#4a4a4c] transition-colors">
      <div className="flex">
        <div className="w-11 shrink-0 bg-[#141415] flex flex-col items-center py-3 text-[11px] font-semibold text-[#818384] gap-1">
          <span aria-hidden className="text-[#d7dadc]">▲</span>
          <span className="text-white tabular-nums">{formatVotes(post.upvotes)}</span>
          <span aria-hidden>▼</span>
        </div>
        <div className="flex-1 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="px-2 py-0.5 rounded-full bg-[#272729] border border-[#343536] text-[#d7dadc]">
              {KIND_LABEL[post.kind] || post.kind}
            </span>
            {post.aboutEpisode ? (
              <span className="px-2 py-0.5 rounded-full bg-[#272729] border border-[#343536] text-[#818384]">
                Ep {post.aboutEpisode}
              </span>
            ) : null}
            {post.flair && (
              <span className="px-2 py-0.5 rounded-full bg-[#272729] border border-[#343536] text-[#818384]">
                {post.flair}
              </span>
            )}
            <span
              className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase ${VIBE_STYLE[post.vibe]}`}
            >
              {VIBE_LABEL[post.vibe]}
            </span>
          </div>

          {/* Title as a pill/strip matching the trending-take UI language */}
          <div className="rounded-full bg-[#272729] border border-[#343536] px-4 py-2.5">
            <h3 className="text-[13px] sm:text-sm font-semibold text-white leading-snug">{post.title}</h3>
          </div>

          <p className="text-xs text-[#818384]">
            Posted by <span className="text-[#d7dadc]">u/{post.author}</span>
            {commentCount > 0
              ? ` · ${commentCount} comment${commentCount === 1 ? '' : 's'}`
              : ' · no comments yet'}
          </p>

          {post.body && (
            <p className="text-sm text-[#c8cbcd] leading-relaxed whitespace-pre-wrap">{post.body}</p>
          )}

          {(post.comments?.length || 0) > 0 && (
            <button
              type="button"
              onClick={onToggle}
              className="text-xs font-medium text-[#ff4500] hover:underline"
            >
              {open ? 'Hide' : 'Show'} discussion ({commentCount})
            </button>
          )}

          {open && (post.comments || []).length > 0 && (
            <div className="space-y-2 pt-1">
              {(post.comments || []).map((c) => (
                <CommentBlock key={c.id} comment={c} />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

const CommentBlock: React.FC<{ comment: RedditComment }> = ({ comment }) => {
  return (
    <div className="rounded-xl bg-[#272729] border border-[#343536] px-3 py-2.5 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-white">u/{comment.username}</span>
        <span
          className={`px-1.5 py-0.5 rounded-full border text-[10px] font-semibold uppercase ${VIBE_STYLE[comment.vibe]}`}
        >
          {VIBE_LABEL[comment.vibe]}
        </span>
        <span className="text-[#818384] tabular-nums">{formatVotes(comment.upvotes)}</span>
      </div>
      <p className="text-sm text-[#d7dadc] leading-relaxed whitespace-pre-wrap">{comment.body}</p>
      {comment.talksAbout && (
        <p className="text-[11px] text-[#818384]">About · {comment.talksAbout}</p>
      )}
      {(comment.replies || []).map((r) => (
        <div
          key={r.id}
          className="ml-2 mt-1 pl-3 border-l-2 border-[#343536] py-1.5 space-y-0.5"
        >
          <div className="text-xs font-semibold text-white">u/{r.username}</div>
          <p className="text-sm text-[#c8cbcd]">{r.body}</p>
        </div>
      ))}
    </div>
  );
};

function formatVotes(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
