import React, { useState } from 'react';
import { normalizeInsightsClient } from './lib/normalizeInsights';
import {
  AppView,
  ArenaSpawnConfig,
  InsightsResult,
  InsightsSection,
  StoryScript,
} from './types';
import { DEMO_SERIES } from './data/sampleScripts';
import { StudioHeader } from './components/insights/StudioHeader';
import { HomeView } from './components/insights/HomeView';
import { SeriesView } from './components/insights/SeriesView';
import { InsightsWorkspace } from './components/insights/InsightsWorkspace';
import type { ArenaTickerLine } from './components/insights/ArenaTicker';

const DEFAULT_ARENA_CONFIG: ArenaSpawnConfig = {
  agentCount: 16,
  rounds: 4,
  activePerRound: 12,
  syncDatabricks: true,
};

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [script, setScript] = useState<StoryScript | null>(null);
  const [insights, setInsights] = useState<InsightsResult | null>(null);
  const [section, setSection] = useState<InsightsSection>('thread');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedVariant, setAcceptedVariant] = useState<'fast' | 'detailed' | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [arenaLines, setArenaLines] = useState<ArenaTickerLine[]>([]);
  const [arenaLive, setArenaLive] = useState(false);
  const [arenaConfig, setArenaConfig] = useState<ArenaSpawnConfig>(DEFAULT_ARENA_CONFIG);

  const openSeries = (s: StoryScript) => {
    setScript(JSON.parse(JSON.stringify(s)));
    setInsights(null);
    setAcceptedVariant(null);
    setError(null);
    setIsStale(false);
    setArenaLines([]);
    setArenaLive(false);
    setSection('thread');
    setView('series');
  };

  const updateScript = (s: StoryScript) => {
    setScript(s);
    if (insights) setIsStale(true);
  };

  const runInsights = async (opts?: { useDemoFixture?: boolean }) => {
    if (!script) return;
    setIsRunning(true);
    setError(null);
    setAcceptedVariant(null);
    setArenaLive(false);
    setArenaLines([]);

    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesId: script.id,
          title: script.title,
          genre: script.genre,
          targetAudience: script.targetAudience,
          episodes: script.episodes,
          useDemoFixture: Boolean(opts?.useDemoFixture),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Room failed (${res.status})`);
      }
      setInsights(
        normalizeInsightsClient(data, {
          seriesId: script.id,
          title: script.title,
        })
      );
      setIsStale(false);
      setSection('thread');
      setView('insights');
    } catch (err: any) {
      setError(err.message || 'Room simulation failed');
    } finally {
      setIsRunning(false);
    }
  };

  const runArena = async () => {
    if (!script) return;
    setIsRunning(true);
    setError(null);
    setAcceptedVariant(null);
    setArenaLines([]);
    setArenaLive(true);
    setInsights(null);
    setSection('thread');
    setView('insights');

    try {
      const res = await fetch('/api/arena/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesId: script.id,
          title: script.title,
          genre: script.genre,
          episodes: script.episodes,
          arenaConfig,
          syncDatabricks: arenaConfig.syncDatabricks !== false,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Arena failed (${res.status})`);
      }
      if (!res.body) throw new Error('No stream from arena.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let lineSeq = 0;

      const pushLine = (ev: {
        type?: string;
        summary?: string;
        round?: number;
        username?: string;
      }) => {
        if (!ev?.summary) return;
        lineSeq += 1;
        setArenaLines((prev) =>
          [
            ...prev,
            {
              id: `arena-${lineSeq}`,
              summary: ev.summary!,
              type: ev.type,
              round: ev.round,
              username: ev.username,
            },
          ].slice(-40)
        );
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';

        for (const chunk of chunks) {
          const dataLine = chunk
            .split('\n')
            .map((l) => l.trim())
            .find((l) => l.startsWith('data:'));
          if (!dataLine) continue;
          let msg: any;
          try {
            msg = JSON.parse(dataLine.replace(/^data:\s*/, ''));
          } catch {
            continue;
          }

          if (msg.kind === 'event' && msg.event) {
            pushLine(msg.event);
          } else if ((msg.kind === 'snapshot' || msg.kind === 'result') && msg.insights) {
            setInsights(
              normalizeInsightsClient(msg.insights, {
                seriesId: script.id,
                title: script.title,
              })
            );
            setIsStale(false);
          } else if (msg.kind === 'error') {
            throw new Error(msg.error || 'Arena stream failed');
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Arena simulation failed');
      setView('series');
    } finally {
      setArenaLive(false);
      setIsRunning(false);
    }
  };

  const acceptCut = (variant: 'fast' | 'detailed') => {
    if (!script || !insights?.cut) return;
    const { cut } = insights;
    const replacement = (variant === 'fast' ? cut.fast : cut.detailed).trim();
    const original = cut.original.trim();

    const episodes = script.episodes.map((ep) => {
      if (ep.episodeNumber !== cut.episodeNumber) return ep;

      let nextText = ep.scriptText;
      if (original && nextText.includes(original)) {
        nextText = nextText.replace(original, replacement);
      } else {
        const lines = original
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 12);
        const anchor = lines.find((l) => nextText.includes(l));
        if (anchor) {
          const start = nextText.indexOf(anchor);
          const endMarkers = ['MIRA (to herself):', '[SFX: Clock tick', 'NARRATOR:\nConflict pauses'];
          let end = nextText.length;
          for (const marker of endMarkers) {
            const at = nextText.indexOf(marker, start + anchor.length);
            if (at > start && at < end) end = at;
          }
          nextText = `${nextText.slice(0, start).trimEnd()}\n\n${replacement}\n\n${nextText
            .slice(end)
            .trimStart()}`;
        } else {
          nextText = `${ep.scriptText.trim()}\n\n---\n[YOUR TAKE — ${cut.beatLabel}]\n${replacement}\n`;
        }
      }
      return { ...ep, scriptText: nextText };
    });

    setScript({ ...script, episodes });
    setAcceptedVariant(variant);
    setIsStale(true);
  };

  const onDropOff = (dropOff: InsightsResult['dropOff']) => {
    if (!insights) return;
    setInsights({ ...insights, dropOff: dropOff || null });
  };

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <StudioHeader
        view={view}
        seriesTitle={script?.title}
        onHome={() => setView('home')}
        onSeries={script ? () => setView('series') : undefined}
        onInsights={script ? () => setView('insights') : undefined}
        insightsEnabled={Boolean(insights) || view === 'insights'}
      />

      <main className="flex-1">
        {view === 'home' && (
          <HomeView onOpenSeries={openSeries} onUploadSeries={openSeries} />
        )}
        {view === 'series' && script && (
          <SeriesView
            script={script}
            setScript={updateScript}
            isRunning={isRunning}
            error={error}
            arenaConfig={arenaConfig}
            setArenaConfig={setArenaConfig}
            onRunArena={runArena}
            onRunInsights={runInsights}
            onBackHome={() => setView('home')}
            canUseFixture={script.id === DEMO_SERIES.id}
          />
        )}
        {view === 'insights' && script && (
          <InsightsWorkspace
            script={script}
            result={insights}
            section={section}
            setSection={setSection}
            onAcceptCut={acceptCut}
            acceptedVariant={acceptedVariant}
            onDropOff={onDropOff}
            isStale={isStale}
            arenaLines={arenaLines}
            arenaLive={arenaLive}
            onRerunArena={runArena}
            onRerun={() =>
              insights?.arena
                ? runArena()
                : runInsights(insights?.isDemoFixture ? { useDemoFixture: true } : undefined)
            }
          />
        )}
      </main>

      <footer className="border-t border-line py-3 px-5">
        <div className="max-w-5xl mx-auto flex justify-between text-[11px] text-ink-muted">
          <span>Studio Insights · multi-agent Reddit arena</span>
          <span>
            {script?.id === DEMO_SERIES.id
              ? 'Demo: Harbor Ward'
              : script
              ? script.title
              : 'No series open'}
          </span>
        </div>
      </footer>
    </div>
  );
}
