import React from 'react';
import { ArenaSpawnConfig, StoryScript } from '../../types';

interface SeriesViewProps {
  script: StoryScript;
  setScript: (s: StoryScript) => void;
  isRunning: boolean;
  error: string | null;
  arenaConfig: ArenaSpawnConfig;
  setArenaConfig: (c: ArenaSpawnConfig) => void;
  onRunArena: () => void;
  onRunInsights: (opts?: { useDemoFixture?: boolean }) => void;
  onBackHome: () => void;
  canUseFixture: boolean;
}

function clampNum(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function NumField({
  label,
  value,
  min,
  max,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  hint?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-ink-muted uppercase tracking-wide">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={false}
        onChange={(e) => onChange(clampNum(Number(e.target.value), min, max))}
        className="w-full text-sm border border-line rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-[#ff4500]"
      />
      {hint && <span className="text-[10px] text-ink-muted">{hint}</span>}
    </label>
  );
}

export const SeriesView: React.FC<SeriesViewProps> = ({
  script,
  setScript,
  isRunning,
  error,
  arenaConfig,
  setArenaConfig,
  onRunArena,
  onRunInsights,
  onBackHome,
  canUseFixture,
}) => {
  const updateEpisode = (index: number, field: 'title' | 'scriptText', value: string) => {
    const episodes = [...script.episodes];
    episodes[index] = { ...episodes[index], [field]: value };
    setScript({ ...script, episodes });
  };

  const setAgents = (agentCount: number) => {
    const next = clampNum(agentCount, 8, 45);
    setArenaConfig({
      ...arenaConfig,
      agentCount: next,
      activePerRound: Math.min(arenaConfig.activePerRound, next),
    });
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
            {script.genre} · {script.episodes.length} episodes ·{' '}
            <span className="text-ink font-medium">{arenaConfig.agentCount} agents</span> configured
            below
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            type="button"
            disabled={isRunning}
            onClick={onRunArena}
            className="px-5 py-3 bg-[#ff4500] text-white text-sm font-semibold rounded-full hover:bg-orange-600 disabled:opacity-50 shadow-sm"
          >
            {isRunning ? 'Arena running…' : `Run arena (${arenaConfig.agentCount} agents)`}
          </button>
          <button
            type="button"
            disabled={isRunning}
            onClick={() => onRunInsights()}
            className="px-4 py-2 text-xs text-ink-muted border border-line rounded-full hover:bg-paper-2 disabled:opacity-50"
          >
            One-shot room (legacy)
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

      <section
        id="agent-spawn"
        className="border-2 border-[#ff4500]/40 rounded-xl bg-white p-4 sm:p-5 space-y-4 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-ink">Agent spawn</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Pick cast size (8–45). Depth stays reply-first whether you choose 8 or 30.
            </p>
          </div>
          <span className="text-xs font-semibold text-[#ff4500] bg-orange-50 border border-orange-200 px-2 py-1 rounded">
            {arenaConfig.agentCount} agents · {arenaConfig.rounds} rounds
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {[8, 12, 16, 24, 30, 36, 45].map((n) => (
            <button
              key={n}
              type="button"
              disabled={isRunning}
              onClick={() => setAgents(n)}
              className={`min-w-[2.75rem] px-3 py-2 text-sm font-medium rounded-full border transition-colors ${
                arenaConfig.agentCount === n
                  ? 'bg-[#ff4500] text-white border-[#ff4500]'
                  : 'border-line text-ink hover:bg-paper-2'
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <NumField
            label="Agents"
            value={arenaConfig.agentCount}
            min={8}
            max={45}
            onChange={setAgents}
            hint="Full cast size"
          />
          <NumField
            label="Rounds"
            value={arenaConfig.rounds}
            min={2}
            max={8}
            onChange={(rounds) => setArenaConfig({ ...arenaConfig, rounds })}
          />
          <NumField
            label="Active / round"
            value={Math.min(arenaConfig.activePerRound, arenaConfig.agentCount)}
            min={4}
            max={arenaConfig.agentCount}
            onChange={(activePerRound) => setArenaConfig({ ...arenaConfig, activePerRound })}
            hint="LLM turns per round"
          />
        </div>

        <label className="flex items-start gap-2 text-xs text-ink-muted cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={arenaConfig.syncDatabricks !== false}
            disabled={isRunning}
            onChange={(e) =>
              setArenaConfig({ ...arenaConfig, syncDatabricks: e.target.checked })
            }
          />
          <span>Sync run pack to Databricks after arena completes</span>
        </label>
      </section>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide">Episodes</h2>
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
