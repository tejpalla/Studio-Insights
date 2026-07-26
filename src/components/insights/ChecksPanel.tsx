import React from 'react';
import { ConfusionInsight, RepetitionInsight } from '../../types';

export const ChecksPanel: React.FC<{
  repetition: RepetitionInsight | null;
  confusion: ConfusionInsight | null;
}> = ({ repetition, confusion }) => {
  return (
    <div className="space-y-6">
      <section className="border border-line rounded-lg bg-white/80 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-ink">Repetition</h2>
        {!repetition ? (
          <p className="text-sm text-ink-muted">No strong repeating arc flagged across these episodes.</p>
        ) : (
          <>
            <p className="font-display text-xl text-ink">{repetition.pattern}</p>
            <p className="text-sm text-ink-muted">
              Episodes {repetition.episodeNumbers.join(', ')}
            </p>
            <p className="text-sm text-ink">{repetition.whyItHurts}</p>
            <ul className="text-sm text-ink-muted list-disc pl-5 space-y-1">
              {repetition.examples.map((ex, i) => (
                <li key={i}>{ex}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="border border-line rounded-lg bg-white/80 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-ink">Confusion</h2>
        {!confusion ? (
          <p className="text-sm text-ink-muted">No major confusion beat flagged.</p>
        ) : (
          <>
            <p className="text-sm text-accent font-medium">
              Ep {confusion.episodeNumber} · {confusion.scene}
            </p>
            <p className="text-sm text-ink">{confusion.reason}</p>
            {confusion.newCharactersIntroduced?.length > 0 && (
              <p className="text-xs text-ink-muted">
                New names: {confusion.newCharactersIntroduced.join(', ')}
              </p>
            )}
            {confusion.excerpt && (
              <blockquote className="text-xs font-mono border-l-2 border-line pl-3 text-ink-muted italic">
                {confusion.excerpt}
              </blockquote>
            )}
          </>
        )}
      </section>
    </div>
  );
};
