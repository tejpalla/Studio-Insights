import React from 'react';
import { StoryStructure } from '../../types';

export const StructurePanel: React.FC<{ structure: StoryStructure }> = ({ structure }) => {
  const characters = (structure.characters || []).filter((c) => c?.name?.trim());
  const scenes = (structure.scenes || []).filter((s) => s?.title?.trim());
  const timeline = (structure.timeline || []).filter((t) => t?.label?.trim());

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">Characters</h2>
        {characters.length === 0 ? (
          <p className="text-sm text-ink-muted">No characters mapped for this run.</p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-3">
            {characters.map((c, i) => (
              <li key={`${c.name}-${i}`} className="border border-line rounded-lg bg-white/80 p-4">
                <div className="font-medium text-ink">{c.name}</div>
                <div className="text-sm text-ink-muted mt-0.5">{c.role || 'Character'}</div>
                <div className="text-xs text-accent mt-2">
                  First appears · Ep {c.firstAppearsEpisode || '?'}
                </div>
                {c.notes && <p className="text-xs text-ink-muted mt-1">{c.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">Scenes</h2>
        {scenes.length === 0 ? (
          <p className="text-sm text-ink-muted">No scenes mapped.</p>
        ) : (
          <ol className="space-y-2">
            {scenes.map((s, i) => (
              <li
                key={s.id || i}
                className="border border-line rounded-lg bg-white/80 p-4 flex gap-4"
              >
                <div className="text-xs font-mono text-accent shrink-0">E{s.episodeNumber || '?'}</div>
                <div>
                  <div className="font-medium text-ink">{s.title}</div>
                  <p className="text-sm text-ink-muted mt-1">{s.summary}</p>
                  <p className="text-xs text-ink-muted mt-2">
                    {(s.charactersPresent || []).join(' · ')}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">Timeline</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-ink-muted">No timeline mapped.</p>
        ) : (
          <div className="border-l-2 border-line ml-2 space-y-4 pl-4">
            {timeline.map((t, i) => (
              <div key={i}>
                <div className="text-xs text-accent font-medium">
                  Ep {t.episodeNumber || '?'} · {t.label}
                </div>
                <p className="text-sm text-ink-muted mt-0.5">{t.summary}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
