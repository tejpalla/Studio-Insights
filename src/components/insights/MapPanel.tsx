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
  const arena = result.arena;
  const dbx = arena?.databricks;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="font-display text-2xl text-ink">Backstage map</h2>
        <p className="text-sm text-ink-muted max-w-2xl">
          Optional reference while you write. The thread is the main room — this is just a quiet
          sketch. Not a score report.
        </p>
      </div>

      {arena?.runId && (
        <section className="border border-line rounded-xl overflow-hidden bg-white/80">
          <div className="px-4 py-3 border-b border-line bg-[#FF3621]/10">
            <h3 className="text-sm font-semibold text-ink">Databricks</h3>
            <p className="text-xs text-ink-muted mt-0.5">
              Live agents run in Helix. This run is synced to Databricks for heat analytics and
              scale.
            </p>
          </div>

          <div className="p-4 space-y-4">
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="px-2 py-1 rounded bg-paper-2 border border-line">
                {arena.agentCount} agents
              </span>
              <span className="px-2 py-1 rounded bg-paper-2 border border-line">
                {arena.postCount ?? '—'} posts
              </span>
              <span className="px-2 py-1 rounded bg-paper-2 border border-line">
                {arena.commentCount ?? '—'} comments
              </span>
              <span className="px-2 py-1 rounded bg-paper-2 border border-line">
                {arena.eventCount} events
              </span>
            </div>

            <div className="rounded-lg border border-line p-3 space-y-1">
              <p className="text-xs font-semibold text-ink">
                Sync status:{' '}
                <span
                  className={
                    dbx?.mode === 'volume_upload'
                      ? 'text-emerald-700'
                      : dbx?.mode === 'error'
                        ? 'text-red-700'
                        : 'text-amber-800'
                  }
                >
                  {dbx?.mode === 'volume_upload'
                    ? 'Synced to Databricks'
                    : dbx?.mode === 'error'
                      ? 'Sync error'
                      : dbx?.mode === 'local_only'
                        ? 'Export ready (configure workspace token to sync)'
                        : dbx?.mode || 'not reported (re-run arena after server restart)'}
                </span>
              </p>
              {dbx?.volumePath && (
                <p className="text-[11px] font-mono text-ink-muted break-all">
                  Volume: {dbx.volumePath}
                </p>
              )}
              {dbx?.localDir && (
                <p className="text-[11px] font-mono text-ink-muted break-all">
                  Local pack: {dbx.localDir}
                </p>
              )}
              {dbx?.message && (
                <p className="text-xs text-ink-muted">{dbx.message}</p>
              )}
              {!dbx && (
                <p className="text-xs text-ink-muted">
                  Restart Helix, confirm{' '}
                  <a className="text-[#ff4500] underline" href="/api/databricks/status">
                    /api/databricks/status
                  </a>{' '}
                  is configured, then Run arena again to sync.
                </p>
              )}
            </div>

            {arena.replyStorms && arena.replyStorms.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Reply storms (heat preview)
                </h4>
                <p className="text-[11px] text-ink-muted">
                  Same signal Databricks heat clustering ranks as “what sparks heat.”
                </p>
                <ul className="space-y-1.5">
                  {arena.replyStorms.map((s) => (
                    <li
                      key={s.postId}
                      className="text-xs flex justify-between gap-3 border-b border-line/60 pb-1"
                    >
                      <span className="text-ink line-clamp-2">{s.title}</span>
                      <span className="shrink-0 text-[#ff4500] font-medium">
                        {s.commentCount} comments
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-3 text-xs">
              <a
                href={`/api/arena/export/${arena.runId}`}
                className="font-medium text-[#ff4500] hover:underline"
              >
                Download events.jsonl
              </a>
              <span className="text-ink-muted">
                Notebook: docs/databricks/helix_arena_heat.py · RUN_ID=
                {arena.runId}
              </span>
            </div>
          </div>
        </section>
      )}

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
