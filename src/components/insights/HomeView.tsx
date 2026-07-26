import React, { useRef } from 'react';
import { StoryScript } from '../../types';
import { SAMPLE_SCRIPTS } from '../../data/sampleScripts';

interface HomeViewProps {
  onOpenSeries: (script: StoryScript) => void;
  onUploadSeries: (script: StoryScript) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onOpenSeries, onUploadSeries }) => {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      let rawTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      rawTitle = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);

      const episodeRegex =
        /(?:^|\n)(?:#{1,3}\s*)?(?:Episode|Ep\.?)\s*(\d+)(?:\s*[:\-]?\s*(.*))?/gi;
      const matches = [...text.matchAll(episodeRegex)];
      // If a multi-book file restarts Episode 1, renumber in upload order so
      // first-appearance / scenes stay unambiguous (Ep 1, 2, … N).
      const labeledNums = matches.map((m) => parseInt(m[1], 10) || 0);
      const hasDuplicateLabels =
        labeledNums.length > 1 && new Set(labeledNums).size < labeledNums.length;
      const episodes =
        matches.length > 0
          ? matches.map((currentMatch, i) => {
              const labeled = parseInt(currentMatch[1], 10) || i + 1;
              const epNum = hasDuplicateLabels ? i + 1 : labeled;
              const epTitle = currentMatch[2]?.trim() || `Episode ${labeled}`;
              const start = currentMatch.index! + currentMatch[0].length;
              const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
              return {
                id: `up-${Date.now()}-${i}`,
                episodeNumber: epNum,
                title: epTitle,
                scriptText: text.substring(start, end).trim() || currentMatch[0],
              };
            })
          : [
              {
                id: `up-${Date.now()}-1`,
                episodeNumber: 1,
                title: 'Uploaded script',
                scriptText: text.trim(),
              },
            ];

      onUploadSeries({
        id: `upload-${Date.now()}`,
        title: rawTitle,
        genre: 'Uploaded',
        targetAudience: 'General',
        episodes,
      });
      if (fileRef.current) fileRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-5xl mx-auto px-5 py-10 space-y-12">
      <section className="space-y-4 max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-widest text-[#ff4500]">Studio Insights</p>
        <h1 className="font-display text-4xl sm:text-5xl text-ink leading-[1.1]">
          Drop your story in the room.
        </h1>
        <p className="text-ink-muted text-lg leading-relaxed">
          Simulated Reddit listeners who smell masterpiece, call mid mid, and absolutely hate slop —
          arguing about your <em>whole</em> story. Not an AI pin-pointing your sentences. You keep
          the pen.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <input ref={fileRef} type="file" accept=".txt" className="hidden" onChange={handleFile} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="px-5 py-3 bg-[#ff4500] text-white text-sm font-semibold rounded-full hover:bg-orange-600 transition-colors shadow-sm"
          >
            Upload episodes
          </button>
          <button
            type="button"
            onClick={() => onOpenSeries(SAMPLE_SCRIPTS[0])}
            className="px-5 py-3 bg-ink text-paper text-sm font-semibold rounded-full hover:bg-stone-800 transition-colors"
          >
            Try Harbor Ward
          </button>
        </div>
      </section>

      <section className="grid sm:grid-cols-3 gap-4 text-sm">
        {[
          { t: 'Whole-story talk', d: 'Taglines, arcs, vibes — not “fix line 12”.' },
          { t: 'Haters of slop', d: 'They roast loops, filler, and mushy mid.' },
          { t: 'Your liberty', d: 'Read the room. Rewrite only if you want.' },
        ].map((card) => (
          <div key={card.t} className="border border-line rounded-xl bg-white/70 p-4">
            <div className="font-semibold text-ink">{card.t}</div>
            <p className="text-ink-muted mt-1">{card.d}</p>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-ink">Series</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {SAMPLE_SCRIPTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onOpenSeries(s)}
              className="text-left p-5 rounded-xl border border-line bg-white/80 hover:border-[#ff4500]/50 hover:shadow-md transition-all"
            >
              <div className="text-[11px] uppercase tracking-wider text-ink-muted mb-1">{s.genre}</div>
              <div className="font-display text-xl text-ink">{s.title}</div>
              <p className="text-sm text-ink-muted mt-2 line-clamp-2">
                {s.synopsis || `${s.episodes.length} episode(s)`}
              </p>
              <div className="text-xs text-[#ff4500] mt-3 font-semibold">
                Open · {s.episodes.length} eps
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
