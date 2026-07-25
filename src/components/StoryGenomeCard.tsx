import React from 'react';
import { StoryGenome } from '../types';
import { Dna, Sparkles, Tag, Activity, Compass, Zap } from 'lucide-react';

interface StoryGenomeCardProps {
  genome: StoryGenome;
}

export const StoryGenomeCard: React.FC<StoryGenomeCardProps> = ({ genome }) => {
  const metrics = [
    { label: 'Emotional Intensity', value: genome?.emotionalIntensity || 0, color: 'from-crimson-600 to-crimson-400' },
    { label: 'Pacing Velocity', value: genome?.pacingVelocity || 0, color: 'from-crimson-600 to-crimson-400' },
    { label: 'Dialogue Density', value: genome?.dialogueDensity || 0, color: 'from-crimson-600 to-crimson-400' },
    { label: 'Suspense Index', value: genome?.suspenseIndex || 0, color: 'from-crimson-600 to-crimson-400' },
    { label: 'Romance Index', value: genome?.romanceIndex || 0, color: 'from-crimson-600 to-crimson-400' },
    { label: 'Action Scale', value: genome?.actionScale || 0, color: 'from-crimson-600 to-crimson-400' },
    { label: 'Humor Rating', value: genome?.humorRating || 0, color: 'from-crimson-600 to-crimson-400' },
    { label: 'Hook Strength', value: genome?.hookStrength || 0, color: 'from-crimson-600 to-crimson-400' },
  ];

  return (
    <div className="bg-[#0A0A0C] border border-slate-800 rounded p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-crimson-900/20 border border-crimson-500/30 flex items-center justify-center text-crimson-400">
            <Dna className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">Story Genome DNA</h3>
            <p className="text-[10px] text-slate-400">Structured narrative DNA & tropes profile</p>
          </div>
        </div>

        <div className="bg-[#0F1014] px-3 py-1.5 rounded border border-slate-800 text-xs text-crimson-300 font-semibold flex items-center space-x-2">
          <Compass className="w-3.5 h-3.5" />
          <span>Archetype: {genome?.archetype || 'Unknown'}</span>
        </div>
      </div>

      {/* Genre Blend Breakdown Bars */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          <span>Genre Blend DNA</span>
          <span className="text-crimson-400">{genome?.primaryGenre || 'N/A'}</span>
        </div>

        <div className="space-y-2 bg-[#0F1014] p-4 rounded border border-slate-800">
          {(genome?.genreBlend || []).map((item, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-xs text-slate-300">
                <span className="font-medium">{item.name}</span>
                <span className="font-mono text-crimson-400">{item.percentage}%</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-crimson-500 h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DNA Attribute Gauges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {metrics.map((m, idx) => (
          <div key={idx} className="bg-[#0F1014] border border-slate-800 p-3 rounded space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-medium truncate">{m.label}</span>
              <span className="text-xs font-bold text-white font-mono">{m.value}%</span>
            </div>
            <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
              <div
                className={`bg-gradient-to-r ${m.color} h-full rounded-full transition-all duration-700`}
                style={{ width: `${m.value}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      {/* Tropes Pills */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center space-x-1.5">
          <Tag className="w-3 h-3 text-crimson-400" />
          <span>Detected High-Engagement Tropes</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {(genome?.detectedTropes || []).map((trope, i) => (
            <span
              key={i}
              className="px-2.5 py-1 rounded bg-crimson-900/20 text-crimson-300 border border-crimson-500/30 text-[10px] font-medium"
            >
              #{trope}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
