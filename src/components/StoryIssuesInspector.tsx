import React, { useState } from 'react';
import { StoryIssue } from '../types';
import { AlertOctagon, Bug, Sparkles, Filter, ArrowRight, ShieldAlert, CheckCircle } from 'lucide-react';

interface StoryIssuesInspectorProps {
  issues: StoryIssue[];
  onFixInSandbox: (issue: StoryIssue) => void;
}

export const StoryIssuesInspector: React.FC<StoryIssuesInspectorProps> = ({
  issues,
  onFixInSandbox,
}) => {
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filteredIssues = issues.filter((issue) => {
    if (severityFilter !== 'all' && issue.severity !== severityFilter) return false;
    if (typeFilter !== 'all' && issue.type !== typeFilter) return false;
    return true;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'major':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      default:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'plot_hole':
        return 'Plot Hole';
      case 'character_inconsistency':
        return 'Character Inconsistency';
      case 'repetitive_dialogue':
        return 'Repetitive Fluff';
      case 'weak_cliffhanger':
        return 'Weak Cliffhanger';
      case 'pacing_drop':
        return 'Slow Exposition';
      case 'continuity_error':
        return 'Continuity Error';
      default:
        return type;
    }
  };

  return (
    <div className="bg-[#0A0A0C] border border-slate-800 rounded p-6 space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-rose-900/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Bug className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-semibold text-white tracking-tight">Story Issue & Flaw Inspector</h3>
              <span className="px-2 py-0.5 rounded bg-rose-900/20 text-rose-300 text-[10px] font-bold border border-rose-500/30 uppercase tracking-widest">
                {issues.length} Flaws
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              AI detected plot holes, character glitches, and weak cliffhangers
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-3 text-[10px] font-bold uppercase tracking-widest">
          <div className="flex items-center space-x-1 bg-[#0F1014] p-1 rounded border border-slate-800">
            <Filter className="w-3 h-3 text-slate-400 ml-1.5" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-transparent text-slate-200 py-1 px-2 focus:outline-none"
            >
              <option value="all" className="bg-[#0A0A0C]">All Severities</option>
              <option value="critical" className="bg-[#0A0A0C]">Critical Only</option>
              <option value="major" className="bg-[#0A0A0C]">Major Only</option>
              <option value="minor" className="bg-[#0A0A0C]">Minor Only</option>
            </select>
          </div>

          <div className="flex items-center space-x-1 bg-[#0F1014] p-1 rounded border border-slate-800">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent text-slate-200 py-1 px-2 focus:outline-none"
            >
              <option value="all" className="bg-[#0A0A0C]">All Types</option>
              <option value="plot_hole" className="bg-[#0A0A0C]">Plot Holes</option>
              <option value="character_inconsistency" className="bg-[#0A0A0C]">Character Inconsistencies</option>
              <option value="weak_cliffhanger" className="bg-[#0A0A0C]">Weak Cliffhangers</option>
              <option value="pacing_drop" className="bg-[#0A0A0C]">Slow Exposition</option>
              <option value="repetitive_dialogue" className="bg-[#0A0A0C]">Repetitive Dialogue</option>
            </select>
          </div>
        </div>
      </div>

      {/* Issues List */}
      {filteredIssues.length === 0 ? (
        <div className="bg-[#0F1014] border border-slate-800 rounded p-8 text-center space-y-2">
          <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-200">No issues found matching filters!</p>
          <p className="text-[10px] text-slate-400">Your story script is clean for this criteria.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredIssues.map((issue) => (
            <div
              key={issue.id}
              className="bg-[#0F1014] border border-slate-800 rounded p-5 space-y-4 hover:border-slate-700 transition-colors"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${getSeverityBadge(issue.severity)}`}>
                    {issue.severity}
                  </span>
                  <span className="px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] uppercase tracking-widest font-bold border border-slate-700">
                    {getTypeLabel(issue.type)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono bg-[#0A0A0C] px-2 py-0.5 rounded border border-slate-800">
                    📍 {issue.location}
                  </span>
                </div>

                <button
                  onClick={() => onFixInSandbox(issue)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] uppercase tracking-widest rounded transition-all shrink-0"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Fix with AI Sandbox</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Title & Description */}
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">{issue.title}</h4>
                <p className="text-[10px] text-slate-300 leading-relaxed">{issue.description}</p>
              </div>

              {/* Proposed Resolution */}
              <div className="bg-indigo-900/20 border border-indigo-500/30 p-3 rounded text-[10px] space-y-1">
                <span className="font-bold text-indigo-400 uppercase tracking-widest">💡 AI Editorial Fix Strategy:</span>
                <p className="text-slate-200">{issue.suggestedResolution}</p>
              </div>

              {/* Before vs After Snippet comparison */}
              {(issue.beforeScriptSnippet || issue.afterScriptSnippet) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px] font-mono pt-2 border-t border-slate-800">
                  <div className="space-y-1">
                    <span className="text-rose-400 font-sans font-bold uppercase tracking-widest">
                      Original Script Flaw:
                    </span>
                    <div className="bg-[#0A0A0C] border border-slate-800 p-3 rounded text-rose-300/90 leading-relaxed overflow-x-auto whitespace-pre-wrap">
                      {issue.beforeScriptSnippet}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-emerald-400 font-sans font-bold uppercase tracking-widest">
                      AI Proposed Optimization:
                    </span>
                    <div className="bg-[#0A0A0C] border border-slate-800 p-3 rounded text-emerald-300/90 leading-relaxed overflow-x-auto whitespace-pre-wrap">
                      {issue.afterScriptSnippet}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
