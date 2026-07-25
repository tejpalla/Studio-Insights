import React, { useState } from 'react';
import { HookAnalysis } from '../types';
import { Zap, CheckCircle2, XCircle, Sparkles, Copy, Check, Radio } from 'lucide-react';

interface HookAnalysisCardProps {
  hook: HookAnalysis;
  onSendToSandbox?: (hookText: string) => void;
}

export const HookAnalysisCard: React.FC<HookAnalysisCardProps> = ({ hook, onSendToSandbox }) => {
  const [copied, setCopied] = useState(false);

  const getVerdictStyle = (verdict: string) => {
    switch (verdict) {
      case 'Exceptional':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'Engaging':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'Moderate':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      default:
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(hook.suggestedOpeningHook);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#0A0A0C] border border-slate-800 rounded p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-crimson-900/20 border border-crimson-500/30 flex items-center justify-center text-crimson-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">Opening Hook Analysis (0-60 Seconds)</h3>
            <p className="text-[10px] text-slate-400">Audio drama listener retention in the first 60 seconds</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-[10px] text-slate-400 font-mono">Timeframe: {hook?.hookTimeframe}</span>
          <span
            className={`px-3 py-1 rounded text-[10px] font-bold border tracking-wide uppercase ${getVerdictStyle(
              hook?.verdict || 'Unknown'
            )}`}
          >
            {hook?.verdict || 'Unknown'} Hook ({hook?.score || 0}/100)
          </span>
        </div>
      </div>

      {/* Strengths & Weaknesses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#0F1014] border border-slate-800 rounded p-4 space-y-2">
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center space-x-1.5">
            <CheckCircle2 className="w-3 h-3" />
            <span>Hook Strengths</span>
          </span>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {(hook?.strengths || []).map((str, idx) => (
              <li key={idx} className="flex items-start space-x-2">
                <span className="text-emerald-400 mt-0.5">•</span>
                <span>{str}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-[#0F1014] border border-slate-800 rounded p-4 space-y-2">
          <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest flex items-center space-x-1.5">
            <XCircle className="w-3 h-3" />
            <span>Retention Risks</span>
          </span>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {(hook?.weaknesses || []).map((weak, idx) => (
              <li key={idx} className="flex items-start space-x-2">
                <span className="text-rose-400 mt-0.5">•</span>
                <span>{weak}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* AI Recommended Hook Script Box */}
      <div className="bg-[#0F1014] border border-crimson-500/30 rounded p-4 space-y-3 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-crimson-400 text-[10px] font-bold uppercase tracking-widest">
            <Sparkles className="w-3 h-3" />
            <span>AI Optimized Audio Hook Script Recommendation</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] uppercase font-bold rounded transition-colors flex items-center space-x-1 border border-slate-700"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {onSendToSandbox && (
              <button
                onClick={() => onSendToSandbox(hook?.suggestedOpeningHook || '')}
                className="px-2.5 py-1 bg-crimson-600 hover:bg-crimson-500 text-white text-[10px] uppercase font-bold rounded transition-colors flex items-center space-x-1"
              >
                <Radio className="w-3 h-3" />
                <span>Open in Sandbox</span>
              </button>
            )}
          </div>
        </div>

        <p className="text-xs sm:text-sm font-mono text-slate-200 bg-[#0A0A0C] p-3.5 rounded border border-slate-800 leading-relaxed whitespace-pre-wrap">
          {hook?.suggestedOpeningHook || 'No hook provided.'}
        </p>
      </div>
    </div>
  );
};
