import React from 'react';
import { InsightsResult } from '../../types';
import { StructurePanel } from './StructurePanel';
import { DnaPanel } from './DnaPanel';
import { DropOffPanel } from './DropOffPanel';

/** Quiet backstage map — not the product hero. */
export const MapPanel: React.FC<{
  result: InsightsResult;
  onDropOff: (dropOff: InsightsResult['dropOff']) => void;
}> = ({ result, onDropOff }) => {
  const hasDna = Boolean(result.dna?.summary || result.dna?.tropes);
  const hasStructure =
    Boolean(result.structure?.characters?.length) ||
    Boolean(result.structure?.scenes?.length) ||
    Boolean(result.structure?.timeline?.length);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="font-display text-2xl text-ink">Backstage map</h2>
        <p className="text-sm text-ink-muted max-w-2xl">
          Optional reference while you write. The thread is the main room — this is just a quiet
          sketch. Not a score report.
        </p>
      </div>

      {hasDna && result.dna ? (
        <DnaPanel dna={result.dna} />
      ) : (
        <p className="text-sm text-ink-muted border border-dashed border-line rounded-xl p-4">
          No story DNA in this run. Re-open the room to regenerate the backstage sketch.
        </p>
      )}

      {hasStructure && result.structure ? (
        <StructurePanel structure={result.structure} />
      ) : (
        <p className="text-sm text-ink-muted border border-dashed border-line rounded-xl p-4">
          No structure map in this run. Cast/scenes weren’t returned — thread still works.
        </p>
      )}

      <DropOffPanel existing={result.dropOff} onParsed={onDropOff} />
    </div>
  );
};
