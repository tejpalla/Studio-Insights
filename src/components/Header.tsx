import React from 'react';
import { Sparkles, Radio, FileText, BarChart3, HelpCircle, Layers } from 'lucide-react';

interface HeaderProps {
  activeTab: 'analytics' | 'script-editor' | 'sandbox';
  setActiveTab: (tab: 'analytics' | 'script-editor' | 'sandbox') => void;
  hasAnalysis: boolean;
  onAnalyzeNew: () => void;
  isAnalyzing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  hasAnalysis,
  onAnalyzeNew,
  isAnalyzing,
}) => {
  return (
    <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 lg:px-8 bg-[#0F1014] shrink-0">
      <div className="flex items-center w-full justify-between max-w-7xl mx-auto">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-sm flex items-center justify-center font-bold text-white text-xs">
            HX
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-200">
            Helix <span className="text-slate-500 font-normal">/ Story Intelligence</span>
          </h1>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('script-editor')}
            className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
              activeTab === 'script-editor'
                ? 'bg-slate-800 border-slate-700 text-white'
                : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Script Input
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            disabled={!hasAnalysis}
            className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors flex items-center gap-2 ${
              activeTab === 'analytics'
                ? 'bg-slate-800 border-slate-700 text-white'
                : hasAnalysis
                ? 'bg-transparent border-transparent text-slate-400 hover:text-slate-200'
                : 'bg-transparent border-transparent text-slate-600 cursor-not-allowed opacity-60'
            }`}
          >
            <span>Intelligence Dashboard</span>
            {hasAnalysis && activeTab !== 'analytics' && (
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('sandbox')}
            disabled={!hasAnalysis}
            className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
              activeTab === 'sandbox'
                ? 'bg-slate-800 border-slate-700 text-white'
                : hasAnalysis
                ? 'bg-transparent border-transparent text-slate-400 hover:text-slate-200'
                : 'bg-transparent border-transparent text-slate-600 cursor-not-allowed opacity-60'
            }`}
          >
            Rewrite Sandbox
          </button>
        </nav>

        {/* CTA Action */}
        <div className="flex items-center gap-3">
          <div className="hidden md:block px-3 py-1 bg-[#0A0A0C] rounded text-xs font-medium border border-slate-800 text-slate-400">
            Draft v2.4
          </div>
          <button
            onClick={onAnalyzeNew}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {isAnalyzing ? (
              <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full"></span>
            ) : null}
            <span>{isAnalyzing ? 'Analyzing...' : 'Run Story IQ'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
