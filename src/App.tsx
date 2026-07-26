import React, { useState } from 'react';
import { normalizeInsightsClient } from './lib/normalizeInsights';
import { AppView, InsightsResult, InsightsSection, StoryScript } from './types';
import { DEMO_SERIES } from './data/sampleScripts';
import { StudioHeader } from './components/insights/StudioHeader';
import { HomeView } from './components/insights/HomeView';
import { SeriesView } from './components/insights/SeriesView';
import { InsightsWorkspace } from './components/insights/InsightsWorkspace';

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [script, setScript] = useState<StoryScript | null>(null);
  const [insights, setInsights] = useState<InsightsResult | null>(null);
  const [section, setSection] = useState<InsightsSection>('thread');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedVariant, setAcceptedVariant] = useState<'fast' | 'detailed' | null>(null);
  const [isStale, setIsStale] = useState(false);

  const openSeries = (s: StoryScript) => {
    setScript(JSON.parse(JSON.stringify(s)));
    setInsights(null);
    setAcceptedVariant(null);
    setError(null);
    setIsStale(false);
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
            onRerun={() => runInsights(insights?.isDemoFixture ? { useDemoFixture: true } : undefined)}
          />
        )}
      </main>

      <footer className="border-t border-line py-3 px-5">
        <div className="max-w-5xl mx-auto flex justify-between text-[11px] text-ink-muted">
          <span>Studio Insights · simulated Reddit room</span>
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
