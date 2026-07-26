import React, { useState } from 'react';
import { CutProposal } from '../../types';

export const CutPanel: React.FC<{
  cut: CutProposal;
  acceptedVariant: 'fast' | 'detailed' | null;
  onAccept: (variant: 'fast' | 'detailed') => void;
}> = ({ cut, acceptedVariant, onAccept }) => {
  const [tab, setTab] = useState<'original' | 'fast' | 'detailed'>('original');
  const body = tab === 'original' ? cut.original : tab === 'fast' ? cut.fast : cut.detailed;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h2 className="font-display text-2xl text-ink">Your call</h2>
        <p className="text-sm text-ink-muted max-w-2xl">
          The room argued about this stretch. These are two alternate takes — not AI orders. Keep,
          tweak, or ignore.
        </p>
        {cut.threadConsensus && (
          <blockquote className="border-l-2 border-accent pl-3 text-sm text-ink italic">
            {cut.threadConsensus}
          </blockquote>
        )}
        <p className="text-sm text-ink-muted">
          Ep {cut.episodeNumber} · {cut.beatLabel}
        </p>
      </div>

      <div className="flex gap-1 border-b border-line">
        {(['original', 'fast', 'detailed'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm capitalize border-b-2 -mb-px ${
              tab === t ? 'border-accent text-ink font-medium' : 'border-transparent text-ink-muted'
            }`}
          >
            {t === 'fast' ? 'Tighter' : t === 'detailed' ? 'Richer' : 'As written'}
          </button>
        ))}
      </div>

      <pre className="whitespace-pre-wrap text-xs font-mono leading-relaxed bg-white border border-line rounded-lg p-4 text-ink min-h-[12rem]">
        {body}
      </pre>

      <p className="text-sm text-ink-muted">{cut.explanation}</p>

      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={() => onAccept('fast')}
          className="px-4 py-2 text-sm font-medium rounded bg-ink text-paper hover:bg-stone-800"
        >
          Try tighter take
        </button>
        <button
          type="button"
          onClick={() => onAccept('detailed')}
          className="px-4 py-2 text-sm font-medium rounded border border-line bg-white hover:bg-paper-2"
        >
          Try richer take
        </button>
        {acceptedVariant && (
          <span className="text-sm text-accent font-medium">
            Dropped into Ep {cut.episodeNumber} — re-run the room when you want fresh opinions
          </span>
        )}
      </div>
    </div>
  );
};
