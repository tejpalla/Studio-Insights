import React, { useState } from 'react';
import { RetentionSegment } from '../types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { TrendingDown, AlertTriangle, ShieldCheck, Sparkles, Clock, ArrowRight } from 'lucide-react';

interface RetentionGraphProps {
  retentionData: RetentionSegment[];
  onOpenSandboxWithFix?: (fix: string, excerpt: string) => void;
}

export const RetentionGraph: React.FC<RetentionGraphProps> = ({
  retentionData,
  onOpenSandboxWithFix,
}) => {
  const [selectedPointIndex, setSelectedPointIndex] = useState<number>(0);

  const selectedPoint = retentionData[selectedPointIndex] || retentionData[0];

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'high':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'medium':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'low':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
  };

  return (
    <div className="bg-[#0A0A0C] border border-slate-800 rounded p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-crimson-900/20 border border-crimson-500/30 flex items-center justify-center text-crimson-400">
            <TrendingDown className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">Listener Retention Forecast Curve</h3>
            <p className="text-[10px] text-slate-400">
              Predicted minute-by-minute audience drop-off points
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 bg-crimson-500 inline-block"></span>
            <span>Forecasted</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 bg-rose-500 inline-block"></span>
            <span>Threshold (75%)</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={retentionData}
            onClick={(e) => {
              if (e && typeof e.activeTooltipIndex === 'number') {
                setSelectedPointIndex(e.activeTooltipIndex);
              }
            }}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="retentionGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.5} />
            <XAxis dataKey="timestamp" stroke="#64748b" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 10 }} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as RetentionSegment;
                  return (
                    <div className="bg-[#0F1014] border border-slate-800 p-3 rounded text-xs space-y-1">
                      <p className="font-bold text-crimson-400">{data.timestamp}</p>
                      <p className="text-white">
                        Retention: <span className="font-mono">{data.retentionPercent}%</span>
                      </p>
                      <p className="text-slate-400 capitalize">Risk: {data.riskLevel}</p>
                      <p className="text-slate-500 text-[10px]">Click point to inspect</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine y={75} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: 'Target 75%', fill: '#f43f5e', fontSize: 10 }} />
            <Area
              type="monotone"
              dataKey="retentionPercent"
              stroke="#6366f1"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#retentionGrad)"
              activeDot={{ r: 6, fill: '#818cf8', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Interactive Drop-Off Point Selector Buttons */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-thin">
        {retentionData.map((pt, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedPointIndex(idx)}
            className={`px-3 py-1.5 rounded text-[10px] font-bold shrink-0 border transition-all ${
              selectedPointIndex === idx
                ? 'bg-crimson-900/20 text-crimson-300 border-crimson-500'
                : 'bg-[#0F1014] text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <span className="font-mono">{pt.timestamp}</span>
            <span className="ml-1.5 font-normal opacity-80">({pt.retentionPercent}%)</span>
          </button>
        ))}
      </div>

      {/* Detailed Point Inspection Panel */}
      {selectedPoint && (
        <div className="bg-[#0F1014] border border-slate-800 rounded p-4.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="w-3 h-3 text-crimson-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Timestamp {selectedPoint.timestamp} Segment Analysis
              </span>
            </div>
            <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border tracking-wide uppercase ${getRiskBadge(selectedPoint.riskLevel)}`}>
              {selectedPoint.riskLevel} RISK ({selectedPoint.retentionPercent}% Retention)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Scene Excerpt */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Script Excerpt:</span>
              <p className="font-mono bg-[#0A0A0C] p-2.5 rounded border border-slate-800 text-slate-300 leading-relaxed italic">
                "{selectedPoint.sceneExcerpt}"
              </p>
            </div>

            {/* AI Diagnosis */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Retention Drop Cause:</span>
              <p className="text-slate-300 bg-[#0A0A0C] p-2.5 rounded border border-slate-800 leading-relaxed">
                {selectedPoint.reason}
              </p>
            </div>
          </div>

          {/* Actionable Fix */}
          <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs space-y-0.5">
              <span className="text-crimson-400 font-bold text-[10px] uppercase tracking-widest flex items-center space-x-1">
                <Sparkles className="w-3 h-3" />
                <span>Recommended Script Fix:</span>
              </span>
              <p className="text-slate-300">{selectedPoint.suggestedFix}</p>
            </div>

            {onOpenSandboxWithFix && (
              <button
                onClick={() =>
                  onOpenSandboxWithFix(selectedPoint.suggestedFix, selectedPoint.sceneExcerpt)
                }
                className="px-3 py-1.5 bg-crimson-600 hover:bg-crimson-500 text-white text-[10px] uppercase font-bold rounded transition-colors shrink-0 flex items-center space-x-1"
              >
                <span>Fix in Sandbox</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
