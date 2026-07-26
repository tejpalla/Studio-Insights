import React from 'react';
import { InsightsResult, InsightsSection, StoryScript } from '../../types';
import { ThreadPanel } from './ThreadPanel';
import { PulsePanel } from './PulsePanel';
import { CutPanel } from './CutPanel';
import { MapPanel } from './MapPanel';

interface InsightsWorkspaceProps {
  script: StoryScript;
  result: InsightsResult | null;
  section: InsightsSection;
  setSection: (s: InsightsSection) => void;
  onAcceptCut: (variant: 'fast' | 'detailed') => void;
  acceptedVariant: 'fast' | 'detailed' | null;
  onDropOff: (dropOff: InsightsResult['dropOff']) => void;
  onRerun?: () => void;
  isStale?: boolean;
}

const SECTIONS: { id: InsightsSection; label: string }[] = [
  { id: 'thread', label: 'The sub' },
  { id: 'pulse', label: 'Room pulse' },
  { id: 'cut', label: 'Your call' },
  { id: 'map', label: 'Backstage' },
];

export const InsightsWorkspace: React.FC<InsightsWorkspaceProps> = ({
  script,
  result,
  section,
  setSection,
  onAcceptCut,
  acceptedVariant,
  onDropOff,
  onRerun,
  isStale,
}) => {
  return (
    <div className="max-w-3xl mx-auto px-5 py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl text-ink">{script.title}</h1>
        <p className="text-sm text-ink-muted flex flex-wrap items-center gap-2">
          Simulated fandom sub
          {result?.isDemoFixture && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-900 border border-amber-300">
              Labeled demo fixture
            </span>
          )}
        </p>
      </div>

      {isStale && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-amber-300 bg-amber-50 text-amber-950 text-sm px-4 py-3 rounded-xl">
          <span>Script changed — this room is from the older draft.</span>
          {onRerun && (
            <button
              type="button"
              onClick={onRerun}
              className="px-3 py-1.5 bg-ink text-paper text-xs font-medium rounded"
            >
              Re-open the room
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-line pb-px">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
              section === s.id
                ? 'border-[#ff4500] text-ink font-medium'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {!result ? (
        <div className="border border-dashed border-line rounded-xl p-10 text-center space-y-2 bg-white/40">
          <p className="text-ink font-medium">Room’s empty</p>
          <p className="text-sm text-ink-muted max-w-md mx-auto">
            Open Series and drop your episodes into the simulated Reddit room.
          </p>
        </div>
      ) : !result.room ? (
        <div className="border border-amber-300 bg-amber-50 text-amber-950 text-sm px-4 py-3 rounded-xl space-y-2">
          <p>This result is missing the thread. Re-run Insights on the current build.</p>
          {onRerun && (
            <button
              type="button"
              onClick={onRerun}
              className="px-3 py-1.5 bg-ink text-paper text-xs font-medium rounded"
            >
              Re-open the room
            </button>
          )}
        </div>
      ) : (
        <div className="pt-2">
          {section === 'thread' && <ThreadPanel room={result.room} />}
          {section === 'pulse' && <PulsePanel result={result} />}
          {section === 'cut' &&
            (result.cut ? (
              <CutPanel cut={result.cut} acceptedVariant={acceptedVariant} onAccept={onAcceptCut} />
            ) : (
              <EmptyTab
                title="No stretch in dispute yet"
                body="The model didn’t flag a specific beat for Your call. Re-open the room, or keep writing — the thread is still the main signal."
                onRerun={onRerun}
              />
            ))}
          {section === 'map' && <MapPanel result={result} onDropOff={onDropOff} />}
        </div>
      )}
    </div>
  );
};

function EmptyTab({
  title,
  body,
  onRerun,
}: {
  title: string;
  body: string;
  onRerun?: () => void;
}) {
  return (
    <div className="border border-dashed border-line rounded-xl p-8 space-y-3 bg-white/60">
      <h2 className="font-display text-xl text-ink">{title}</h2>
      <p className="text-sm text-ink-muted max-w-lg">{body}</p>
      {onRerun && (
        <button
          type="button"
          onClick={onRerun}
          className="px-4 py-2 text-sm font-medium rounded-full bg-[#ff4500] text-white"
        >
          Re-open the room
        </button>
      )}
    </div>
  );
}
