import React from 'react';
import { StoryScript } from '../../types';

interface SeriesViewProps {
  script: StoryScript;
  setScript: (s: StoryScript) => void;
  isRunning: boolean;
  error: string | null;
  onRunInsights: (opts?: { useDemoFixture?: boolean }) => void;
  onBackHome: () => void;
  canUseFixture: boolean;
}

export const SeriesView: React.FC<SeriesViewProps> = ({
  script,
  setScript,
  isRunning,
  error,
  onRunInsights,
  onBackHome,
  canUseFixture,
}) => {
  const updateEpisode = (index: number, field: 'title' | 'scriptText', value: string) => {
    const episodes = [...script.episodes];
    episodes[index] = { ...episodes[index], [field]: value };
    setScript({ ...script, episodes });
  };

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-2 flex-1">
          <button type="button" onClick={onBackHome} className="text-xs text-ink-muted hover:text-ink">
            ← Home
          </button>
          <input
            value={script.title}
            onChange={(e) => setScript({ ...script, title: e.target.value })}
            className="block w-full font-display text-3xl bg-transparent border-0 border-b border-transparent focus:border-line focus:outline-none text-ink"
          />
          <p className="text-sm text-ink-muted">
            {script.genre} · {script.episodes.length} episodes · more eps → bigger simulated room
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            type="button"
            disabled={isRunning}
            onClick={() => onRunInsights()}
            className="px-5 py-3 bg-[#ff4500] text-white text-sm font-semibold rounded-full hover:bg-orange-600 disabled:opacity-50 shadow-sm"
          >
            {isRunning ? 'Room is filling…' : 'Open the Reddit room'}
          </button>
          {canUseFixture && (
            <button
              type="button"
              disabled={isRunning}
              onClick={() => onRunInsights({ useDemoFixture: true })}
              className="px-4 py-2 text-xs text-ink-muted border border-line rounded-full hover:bg-paper-2 disabled:opacity-50"
            >
              Labeled offline demo thread
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="border border-amber-700/30 bg-amber-50 text-amber-950 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {script.episodes.map((ep, idx) => (
          <article key={ep.id} className="border border-line rounded-xl bg-white/80 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[#ff4500] w-8">E{ep.episodeNumber}</span>
              <input
                value={ep.title}
                onChange={(e) => updateEpisode(idx, 'title', e.target.value)}
                className="flex-1 text-sm font-medium bg-transparent border-b border-line focus:outline-none focus:border-accent py-1"
              />
            </div>
            <textarea
              value={ep.scriptText}
              onChange={(e) => updateEpisode(idx, 'scriptText', e.target.value)}
              rows={8}
              className="w-full text-xs font-mono leading-relaxed text-ink-muted bg-paper-2/50 border border-line rounded-lg p-3 focus:outline-none focus:border-accent"
            />
          </article>
        ))}
      </div>
    </div>
  );
};
