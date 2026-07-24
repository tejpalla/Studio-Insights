import React from 'react';
import { BenchmarkComparison } from '../types';
import { BarChart2, Award, CheckCircle, TrendingUp, AlertCircle } from 'lucide-react';

interface BenchmarkingPanelProps {
  benchmarks: BenchmarkComparison[];
}

export const BenchmarkingPanel: React.FC<BenchmarkingPanelProps> = ({ benchmarks }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'above_average':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'average':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      default:
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'above_average':
        return 'Top 10% Level';
      case 'average':
        return 'Platform Average';
      default:
        return 'Below Benchmark';
    }
  };

  return (
    <div className="bg-[#0A0A0C] border border-slate-800 rounded p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-indigo-900/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <BarChart2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">Platform Benchmark Intelligence</h3>
            <p className="text-[10px] text-slate-400">
              Comparing your script against Pocket FM's top-performing serial hits
            </p>
          </div>
        </div>

        <div className="bg-[#0F1014] px-3 py-1 rounded border border-slate-800 text-[10px] text-indigo-400 uppercase tracking-widest font-bold flex items-center space-x-1.5">
          <Award className="w-3 h-3" />
          <span>Pocket FM Top 10% Dataset</span>
        </div>
      </div>

      {/* Benchmark Metric Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {benchmarks.map((item, idx) => {
          const diff = item.currentScore - item.platformTop10Avg;
          const isHigher = diff >= 0;

          return (
            <div
              key={idx}
              className="bg-[#0F1014] border border-slate-800 rounded p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">{item.metricName}</span>
                <span
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold border tracking-wide uppercase ${getStatusBadge(
                    item.status
                  )}`}
                >
                  {getStatusLabel(item.status)}
                </span>
              </div>

              {/* Score Progress Comparison */}
              <div className="space-y-2 pt-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400 font-medium">Your Script Score</span>
                  <span className="font-bold text-indigo-400 font-mono">{item.currentScore}/100</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all duration-700"
                    style={{ width: `${item.currentScore}%` }}
                  ></div>
                </div>

                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500 font-medium">Platform Top 10% Avg</span>
                  <span className="font-mono text-slate-400">{item.platformTop10Avg}/100</span>
                </div>
                <div className="w-full bg-[#0A0A0C] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-slate-700 h-full rounded-full"
                    style={{ width: `${item.platformTop10Avg}%` }}
                  ></div>
                </div>
              </div>

              {/* Delta Callout */}
              <div className="flex items-center justify-between text-[10px] font-medium pt-1 border-t border-slate-800">
                <span className="text-slate-400">Benchmark Gap:</span>
                <span className={`font-mono font-bold ${isHigher ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isHigher ? `+${diff}` : `${diff}`} points vs Top 10%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
