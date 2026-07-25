import React from 'react';
import { AnalysisResult } from '../types';
import { Award, TrendingUp, Zap, Target, AlertTriangle, ShieldCheck } from 'lucide-react';

interface StoryOverviewHeaderProps {
  analysis: AnalysisResult;
}

export const StoryOverviewHeader: React.FC<StoryOverviewHeaderProps> = ({ analysis }) => {
  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'S Tier':
        return 'bg-crimson-900/20 text-crimson-300 border-crimson-500/30';
      case 'A Tier':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'B Tier':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      default:
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-crimson-400';
    if (score >= 70) return 'text-emerald-400';
    if (score >= 55) return 'text-blue-400';
    return 'text-rose-400';
  };

  return (
    <div className="bg-[#0A0A0C] border border-slate-800 rounded p-6 space-y-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-crimson-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Title & Tier Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <span
              className={`px-3 py-1 rounded text-[10px] font-bold tracking-widest uppercase border shadow-md ${getTierBadge(
                analysis?.commercialViability || 'B Tier'
              )}`}
            >
              {analysis?.commercialViability || 'Unrated'} Audio Drama
            </span>
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">
              Pre-Publication Verification
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {analysis?.title || 'Untitled Script'}
          </h1>
        </div>

        <div className="flex items-center space-x-4 bg-[#0F1014] p-3 rounded border border-slate-800">
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Overall Story IQ
            </p>
            <div className={`text-3xl font-black ${getScoreColor(analysis?.overallScore || 0)}`}>
              {analysis?.overallScore ?? 'N/A'}
              <span className="text-sm font-normal text-slate-500">/100</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded bg-crimson-900/20 border border-crimson-500/30 flex items-center justify-center text-crimson-400">
            <Award className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Executive Summary & Key Pre-Publication Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Exec Summary Box */}
        <div className="lg:col-span-2 bg-[#0F1014] border border-slate-800 rounded p-4.5 space-y-2">
          <div className="flex items-center space-x-2 text-crimson-400 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>AI Editorial Executive Verdict</span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed font-normal">
            {analysis?.executiveSummary || 'No executive summary provided.'}
          </p>
        </div>

        {/* 3 Metric Mini Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-1 gap-3">
          <div className="bg-[#0F1014] border border-slate-800 rounded p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Est. 5-Ep Retention</p>
              <p className="text-xl font-bold text-emerald-400 mt-0.5">
                {analysis?.predictedCompletionRate ?? 'N/A'}%
              </p>
            </div>
            <TrendingUp className="w-5 h-5 text-emerald-400/80" />
          </div>

          <div className="bg-[#0F1014] border border-slate-800 rounded p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Opening Hook Score</p>
              <p className="text-xl font-bold text-crimson-400 mt-0.5">
                {analysis?.hookAnalysis?.score ?? 'N/A'}
                {analysis?.hookAnalysis?.score !== undefined && <span className="text-xs text-slate-500 font-normal">/100</span>}
              </p>
            </div>
            <Zap className="w-5 h-5 text-crimson-400/80" />
          </div>
        </div>
      </div>
    </div>
  );
};
