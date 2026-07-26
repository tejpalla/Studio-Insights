import React from 'react';
import { PersonaRisk } from '../../types';

export const RiskPanel: React.FC<{ personas: PersonaRisk[] }> = ({ personas }) => {
  const quitCounts: Record<string, number> = {};
  for (const p of personas) {
    const key = `E${p.quitEpisode} · ${p.quitScene}`;
    quitCounts[key] = (quitCounts[key] || 0) + 1;
  }
  const consensus = Object.entries(quitCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-accent-soft text-accent border border-teal-200">
          Simulated
        </span>
        <p className="text-sm text-ink-muted">
          Five listener personas reacting to the script — not live Pocket traffic.
        </p>
      </div>

      {consensus && consensus[1] > 1 && (
        <div className="border border-line rounded-lg bg-paper-2/80 px-4 py-3 text-sm">
          <span className="font-medium text-ink">Shared quit pressure: </span>
          <span className="text-ink-muted">
            {consensus[1]} personas flag <strong className="text-ink">{consensus[0]}</strong>
          </span>
        </div>
      )}

      <div className="grid gap-3">
        {personas.map((p) => (
          <article key={p.id} className="border border-line rounded-lg bg-white/80 p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-medium text-ink">{p.name}</h3>
                <p className="text-xs text-ink-muted">{p.profile}</p>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-accent-soft text-accent">
                Simulated
              </span>
            </div>
            <p className="text-sm text-ink">
              Likely quit · Ep {p.quitEpisode} · {p.quitScene}
            </p>
            <p className="text-sm text-ink-muted">{p.reason}</p>
            {p.beatExcerpt && (
              <blockquote className="text-xs font-mono text-ink-muted border-l-2 border-line pl-3 italic">
                {p.beatExcerpt}
              </blockquote>
            )}
          </article>
        ))}
      </div>
    </div>
  );
};
