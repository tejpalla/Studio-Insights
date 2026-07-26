import React, { useMemo, useState } from 'react';
import { RedditComment, RedditPost, RedditPostKind, RedditRoom, StoryVibe } from '../../types';
import { discussionHeat } from '../../lib/normalizeInsights';

/**
 * Interactive fandom-sub UI.
 * AI only supplies room JSON — all votes / expand / filters are client state.
 */

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
type Vote = 1 | 0 | -1;

export const ThreadPanel: React.FC<{ room: RedditRoom }> = ({ room }) => {
  const [sort, setSort] = useState<SortMode>('hot');
  const [kindFilter, setKindFilter] = useState<RedditPostKind | 'all'>('all');
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});
  const [focusedPostId, setFocusedPostId] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});

  const heat = room.discussionHeat || discussionHeat(room.comments || []);
  const eng = room.engagement;

  const kindsPresent = useMemo(() => {
    const set = new Set<RedditPostKind>();
    for (const p of room.posts || []) set.add(p.kind);
    return [...set];
  }, [room.posts]);

  const posts = useMemo(() => {
    let list = [...(room.posts || [])];
    if (kindFilter !== 'all') list = list.filter((p) => p.kind === kindFilter);
    if (sort === 'hot') {
      list.sort(
        (a, b) =>
          effectiveScore(b, votes[`post:${b.id}`]) - effectiveScore(a, votes[`post:${a.id}`])
      );
    } else if (sort === 'rough') {
      list.sort(
        (a, b) =>
          vibeRankRough(b.vibe) - vibeRankRough(a.vibe) ||
          effectiveScore(b, votes[`post:${b.id}`]) - effectiveScore(a, votes[`post:${a.id}`])
      );
    } else {
      list.reverse();
    }
    return list;
  }, [room.posts, sort, kindFilter, votes]);

  const focused = focusedPostId ? posts.find((p) => p.id === focusedPostId) : null;

  const castVote = (key: string, dir: 1 | -1) => {
    setVotes((prev) => {
      const cur = prev[key] || 0;
      return { ...prev, [key]: cur === dir ? 0 : dir };
    });
  };

  const togglePost = (id: string) => {
    setExpandedPosts((e) => ({ ...e, [id]: !e[id] }));
  };

  return (
    <div className="space-y-4">
      {/* Sub chrome */}
      <div className="rounded-xl border border-[#343536] bg-[#1a1a1b] text-[#d7dadc] p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-[#ff4500] text-sm">{room.subreddit}</span>
          <span className="text-[#818384]">· Simulated</span>
          <span className="text-[#818384]">
            · {(eng?.audienceSize || room.audienceSize).toLocaleString()} members
          </span>
          {eng?.onlineNow != null && (
            <span className="text-[#818384]">· {eng.onlineNow.toLocaleString()} online</span>
          )}
          <span className="px-2 py-0.5 rounded bg-[#272729] border border-[#343536] text-[#ffa657]">
            {heat.level.replace('_', ' ')}
          </span>
        </div>

        <h2 className="text-lg sm:text-xl font-semibold leading-snug text-white">{room.tagline}</h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Depth" value={`${eng?.depthScore ?? '—'}`} hint={eng?.fandomMaturity || 'fandom'} />
          <Stat label="Controversy" value={`${eng?.controversyIndex ?? '—'}`} hint="index" />
          <Stat label="Posts / day" value={`${eng?.postsPerDay ?? '—'}`} hint="activity" />
          <Stat label="Binge pull" value={`${eng?.bingeCommitment ?? '—'}`} hint="commitment" />
        </div>

        {(room.hotTakes || []).length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-[#818384]">
              Trending takes · tap to filter related posts
            </p>
            <div className="flex flex-col gap-2">
              {(room.hotTakes || []).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    const hit = (room.posts || []).find((p) =>
                      `${p.title} ${p.body || ''}`.toLowerCase().includes(extractEpHint(t))
                    );
                    if (hit) {
                      setFocusedPostId(hit.id);
                      setExpandedPosts((e) => ({ ...e, [hit.id]: true }));
                    }
                  }}
                  className="text-left text-[12px] sm:text-[13px] px-3.5 py-2.5 rounded-lg bg-[#272729] text-[#d7dadc] border border-[#343536] leading-snug hover:border-[#ff4500]/60 hover:bg-[#2d2d2f] transition-colors cursor-pointer"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 text-xs">
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
              className={`px-3 py-1.5 rounded-full cursor-pointer transition-colors ${
                sort === s.id ? 'bg-ink text-paper' : 'bg-paper-2 text-ink-muted hover:text-ink'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 text-xs">
          <FilterChip
            active={kindFilter === 'all'}
            onClick={() => setKindFilter('all')}
            label={`All (${room.posts?.length || 0})`}
          />
          {kindsPresent.map((k) => (
            <FilterChip
              key={k}
              active={kindFilter === k}
              onClick={() => setKindFilter(k)}
              label={KIND_LABEL[k]}
            />
          ))}
        </div>
      </div>

      {focused && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-ink-muted">Viewing one post</span>
          <button
            type="button"
            onClick={() => setFocusedPostId(null)}
            className="text-[#ff4500] font-medium hover:underline cursor-pointer"
          >
            ← Back to feed
          </button>
        </div>
      )}

      {posts.length === 0 ? (
        <p className="text-sm text-ink-muted border border-dashed border-line rounded-xl p-6">
          No posts match this filter — try All.
        </p>
      ) : (
        <div className="space-y-3">
          {(focused ? [focused] : posts).map((post) => {
            const isOpen = focused ? true : Boolean(expandedPosts[post.id]);
            return (
              <PostCard
                key={post.id}
                post={post}
                open={isOpen}
                vote={votes[`post:${post.id}`] || 0}
                onVote={(dir) => castVote(`post:${post.id}`, dir)}
                onToggleDiscuss={() => togglePost(post.id)}
                onOpen={() => {
                  setFocusedPostId(post.id);
                  setExpandedPosts((e) => ({ ...e, [post.id]: true }));
                }}
                votes={votes}
                onVoteComment={(id, dir) => castVote(`c:${id}`, dir)}
                expandedReplies={expandedReplies}
                onToggleReplies={(id) =>
                  setExpandedReplies((e) => ({ ...e, [id]: !e[id] }))
                }
              />
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-ink-muted">
        Votes & expand are local UI — they don’t call the model. Re-open the room for a fresh AI feed.
      </p>
    </div>
  );
};

const FilterChip: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
}> = ({ active, onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
      active
        ? 'bg-[#ff4500] text-white border-[#ff4500]'
        : 'bg-paper-2 text-ink-muted border-line hover:text-ink'
    }`}
  >
    {label}
  </button>
);

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg bg-[#272729] border border-[#343536] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[#818384]">{label}</div>
      <div className="text-base font-semibold text-white tabular-nums">{value}</div>
      <div className="text-[10px] text-[#818384] capitalize">{hint}</div>
    </div>
  );
}

function postBaseScore(p: RedditPost) {
  const comments = p.comments || [];
  const replies = comments.reduce((n, c) => n + (c.replies?.length || 0), 0);
  return p.upvotes + comments.length * 12 + replies * 18;
}

function effectiveScore(p: RedditPost, vote: Vote | undefined) {
  return postBaseScore(p) + (vote || 0) * 40;
}

function vibeRankRough(v: StoryVibe) {
  if (v === 'slop') return 3;
  if (v === 'mid') return 2;
  if (v === 'solid') return 1;
  return 0;
}

function extractEpHint(take: string): string {
  const m = take.match(/ep\s*\d+/i);
  return (m ? m[0] : take.slice(0, 18)).toLowerCase();
}

function displayScore(base: number, vote: Vote) {
  return formatVotes(base + (vote === 1 ? 1 : vote === -1 ? -1 : 0));
}

const PostCard: React.FC<{
  post: RedditPost;
  open: boolean;
  vote: Vote;
  onVote: (dir: 1 | -1) => void;
  onToggleDiscuss: () => void;
  onOpen: () => void;
  votes: Record<string, Vote>;
  onVoteComment: (id: string, dir: 1 | -1) => void;
  expandedReplies: Record<string, boolean>;
  onToggleReplies: (id: string) => void;
}> = ({
  post,
  open,
  vote,
  onVote,
  onToggleDiscuss,
  onOpen,
  votes,
  onVoteComment,
  expandedReplies,
  onToggleReplies,
}) => {
  const commentCount =
    (post.comments || []).length +
    (post.comments || []).reduce((n, c) => n + (c.replies?.length || 0), 0);

  const flair =
    post.flair && post.flair.toLowerCase() !== (KIND_LABEL[post.kind] || '').toLowerCase()
      ? post.flair
      : null;

  return (
    <article className="rounded-xl border border-[#343536] bg-[#1a1a1b] text-[#d7dadc] overflow-hidden">
      <div className="flex">
        <VoteRail score={displayScore(post.upvotes, vote)} vote={vote} onVote={onVote} />

        <div className="flex-1 p-4 space-y-2.5 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="px-2 py-0.5 rounded bg-[#272729] border border-[#343536]">
              {KIND_LABEL[post.kind] || post.kind}
            </span>
            {post.aboutEpisode != null && (
              <span className="px-2 py-0.5 rounded bg-[#272729] border border-[#343536] text-[#818384]">
                Ep {post.aboutEpisode}
              </span>
            )}
            {flair && (
              <span className="px-2 py-0.5 rounded bg-[#272729] border border-[#343536] text-[#818384]">
                {flair}
              </span>
            )}
            <span
              className={`px-2 py-0.5 rounded border text-[10px] font-semibold uppercase ${VIBE_STYLE[post.vibe]}`}
            >
              {VIBE_LABEL[post.vibe]}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpen}
            className="block w-full text-left cursor-pointer group"
          >
            <h3 className="text-[15px] sm:text-base font-semibold text-white leading-snug group-hover:text-[#ff4500] transition-colors">
              {post.title}
            </h3>
          </button>

          <p className="text-xs text-[#818384]">
            Posted by <span className="text-[#d7dadc]">u/{post.author}</span>
            {commentCount > 0
              ? ` · ${commentCount} comment${commentCount === 1 ? '' : 's'}`
              : ' · no comments yet'}
          </p>

          {post.body && (
            <p className="text-sm text-[#c8cbcd] leading-relaxed whitespace-pre-wrap">{post.body}</p>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            {(post.comments?.length || 0) > 0 && (
              <button
                type="button"
                onClick={onToggleDiscuss}
                className="text-xs font-semibold text-[#d7dadc] hover:text-[#ff4500] cursor-pointer"
              >
                {open ? 'Hide' : 'View'} comments ({commentCount})
              </button>
            )}
            <button
              type="button"
              onClick={onOpen}
              className="text-xs font-semibold text-[#818384] hover:text-[#ff4500] cursor-pointer"
            >
              Open post
            </button>
          </div>

          {open && (post.comments || []).length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#343536]">
              {(post.comments || []).map((c) => (
                <CommentBlock
                  key={c.id}
                  comment={c}
                  vote={votes[`c:${c.id}`] || 0}
                  onVote={(dir) => onVoteComment(c.id, dir)}
                  repliesOpen={expandedReplies[c.id] ?? true}
                  onToggleReplies={() => onToggleReplies(c.id)}
                  votes={votes}
                  onVoteReply={(id, dir) => onVoteComment(id, dir)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

const VoteRail: React.FC<{
  score: string;
  vote: Vote;
  onVote: (dir: 1 | -1) => void;
}> = ({ score, vote, onVote }) => (
  <div className="w-11 shrink-0 bg-[#141415] flex flex-col items-center py-3 gap-0.5">
    <button
      type="button"
      aria-label="Upvote"
      onClick={() => onVote(1)}
      className={`p-1 rounded cursor-pointer text-sm leading-none transition-colors ${
        vote === 1 ? 'text-[#ff4500]' : 'text-[#818384] hover:text-[#d7dadc]'
      }`}
    >
      ▲
    </button>
    <span
      className={`text-[11px] font-semibold tabular-nums ${
        vote === 1 ? 'text-[#ff4500]' : vote === -1 ? 'text-[#7193ff]' : 'text-white'
      }`}
    >
      {score}
    </span>
    <button
      type="button"
      aria-label="Downvote"
      onClick={() => onVote(-1)}
      className={`p-1 rounded cursor-pointer text-sm leading-none transition-colors ${
        vote === -1 ? 'text-[#7193ff]' : 'text-[#818384] hover:text-[#d7dadc]'
      }`}
    >
      ▼
    </button>
  </div>
);

const CommentBlock: React.FC<{
  comment: RedditComment;
  vote: Vote;
  onVote: (dir: 1 | -1) => void;
  repliesOpen: boolean;
  onToggleReplies: () => void;
  votes: Record<string, Vote>;
  onVoteReply: (id: string, dir: 1 | -1) => void;
}> = ({ comment, vote, onVote, repliesOpen, onToggleReplies, votes, onVoteReply }) => {
  const replyCount = comment.replies?.length || 0;

  return (
    <div className="rounded-lg bg-[#272729] border border-[#343536] overflow-hidden">
      <div className="flex">
        <div className="w-9 shrink-0 flex flex-col items-center py-2 gap-0.5 bg-[#1f1f20]">
          <button
            type="button"
            aria-label="Upvote comment"
            onClick={() => onVote(1)}
            className={`text-[10px] cursor-pointer ${
              vote === 1 ? 'text-[#ff4500]' : 'text-[#818384] hover:text-[#d7dadc]'
            }`}
          >
            ▲
          </button>
          <span className="text-[10px] font-semibold tabular-nums text-[#d7dadc]">
            {displayScore(comment.upvotes, vote)}
          </span>
          <button
            type="button"
            aria-label="Downvote comment"
            onClick={() => onVote(-1)}
            className={`text-[10px] cursor-pointer ${
              vote === -1 ? 'text-[#7193ff]' : 'text-[#818384] hover:text-[#d7dadc]'
            }`}
          >
            ▼
          </button>
        </div>
        <div className="flex-1 px-3 py-2.5 space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-white">u/{comment.username}</span>
            <span
              className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase ${VIBE_STYLE[comment.vibe]}`}
            >
              {VIBE_LABEL[comment.vibe]}
            </span>
          </div>
          <p className="text-sm text-[#d7dadc] leading-relaxed whitespace-pre-wrap">{comment.body}</p>
          {comment.talksAbout && (
            <p className="text-[11px] text-[#818384]">About · {comment.talksAbout}</p>
          )}
          {replyCount > 0 && (
            <button
              type="button"
              onClick={onToggleReplies}
              className="text-[11px] font-medium text-[#ff4500] hover:underline cursor-pointer"
            >
              {repliesOpen ? 'Hide' : 'Show'} {replyCount} repl{replyCount === 1 ? 'y' : 'ies'}
            </button>
          )}
          {repliesOpen &&
            (comment.replies || []).map((r) => {
              const rv = votes[`c:${r.id}`] || 0;
              return (
                <div
                  key={r.id}
                  className="ml-1 mt-1 pl-3 border-l-2 border-[#343536] py-1.5 space-y-1"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-white">u/{r.username}</span>
                    <button
                      type="button"
                      onClick={() => onVoteReply(r.id, 1)}
                      className={`cursor-pointer ${rv === 1 ? 'text-[#ff4500]' : 'text-[#818384]'}`}
                    >
                      ▲
                    </button>
                    <span className="tabular-nums text-[#818384]">{displayScore(r.upvotes, rv)}</span>
                    <button
                      type="button"
                      onClick={() => onVoteReply(r.id, -1)}
                      className={`cursor-pointer ${rv === -1 ? 'text-[#7193ff]' : 'text-[#818384]'}`}
                    >
                      ▼
                    </button>
                  </div>
                  <p className="text-sm text-[#c8cbcd]">{r.body}</p>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};

function formatVotes(n: number) {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
