import React from 'react';
import { StoryDNA } from '../../types';

const BARS: { key: keyof StoryDNA; label: string }[] = [
  { key: 'pacing', label: 'Pacing' },
  { key: 'suspense', label: 'Suspense' },
  { key: 'romance', label: 'Romance' },
  { key: 'conflict', label: 'Conflict' },
  { key: 'dialogueDensity', label: 'Dialogue density' },
  { key: 'emotionalIntensity', label: 'Emotional intensity' },
];

export const DnaPanel: React.FC<{ dna: StoryDNA }> = ({ dna }) => {
  const score = (v: unknown) => {
    if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.min(100, v));
    if (typeof v === 'string') {
      const m = v.match(/-?\d+(\.\d+)?/);
      if (m) return Math.max(0, Math.min(100, Number(m[0])));
    }
    return 0;
  };

  return (
    <div className="space-y-6">
      <p className="text-base text-ink leading-relaxed max-w-2xl">{dna.summary}</p>
      <p className="text-xs text-ink-muted">
        Descriptive read of what the script is doing — not a hit score or tier.
      </p>

      <div className="space-y-4 max-w-xl">
        {BARS.map(({ key, label }) => {
          const value = score(dna[key]);
          return (
            <div key={key} className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-ink">{label}</span>
                <span className="font-mono text-ink-muted text-xs">{value}</span>
              </div>
              <div className="h-1.5 bg-paper-2 rounded-full overflow-hidden border border-line">
                <div
                  className="h-full bg-accent rounded-full transition-all"
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {dna.tropes?.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {dna.tropes.map((t) => (
            <span
              key={t}
              className="text-xs px-2.5 py-1 rounded border border-line bg-paper-2 text-ink-muted"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
