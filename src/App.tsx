import React, { useState, useEffect } from 'react';
import { StoryScript, AnalysisResult, StoryIssue } from './types';
import { SAMPLE_SCRIPTS } from './data/sampleScripts';
import { Header } from './components/Header';
import { ScriptEditorPanel } from './components/ScriptEditorPanel';
import { StoryOverviewHeader } from './components/StoryOverviewHeader';
import { StoryGenomeCard } from './components/StoryGenomeCard';
import { HookAnalysisCard } from './components/HookAnalysisCard';
import { RetentionGraph } from './components/RetentionGraph';
import { EmotionalTimelineGraph } from './components/EmotionalTimelineGraph';
import { StoryIssuesInspector } from './components/StoryIssuesInspector';
import { BenchmarkingPanel } from './components/BenchmarkingPanel';
import { LiveRewriteSandbox } from './components/LiveRewriteSandbox';
import { Sparkles, AlertCircle, FileText, BarChart3, Radio } from 'lucide-react';

export default function App() {
  const [currentScript, setCurrentScript] = useState<StoryScript>(SAMPLE_SCRIPTS[0]);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash-lite');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'analytics' | 'script-editor' | 'sandbox'>('script-editor');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sandbox prepopulate state
  const [sandboxSnippet, setSandboxSnippet] = useState<string>('');
  const [sandboxInstruction, setSandboxInstruction] = useState<string>('');

  // Auto-analyze initial script on first load so user immediately sees rich data!
  useEffect(() => {
    handleAnalyzeScript(SAMPLE_SCRIPTS[0], selectedModel);
  }, []);

  const handleAnalyzeScript = async (scriptToAnalyze: StoryScript, modelToUse: string = selectedModel) => {
    setIsAnalyzing(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/analyze-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: scriptToAnalyze.id,
          title: scriptToAnalyze.title,
          genre: scriptToAnalyze.genre,
          targetAudience: scriptToAnalyze.targetAudience,
          episodes: scriptToAnalyze.episodes,
          model: modelToUse,
        }),
      });

      if (!res.ok) {
        throw new Error(`Analysis failed with status ${res.status}`);
      }

      const data: AnalysisResult = await res.json();
      setAnalysisResult(data);
      setActiveTab('analytics');
    } catch (err: any) {
      console.error('Error analyzing script:', err);
      setErrorMsg(err.message || 'Failed to analyze script.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFixInSandbox = (issue: StoryIssue) => {
    setSandboxSnippet(issue.beforeScriptSnippet || issue.location);
    setSandboxInstruction(`Fix ${issue.title}: ${issue.suggestedResolution}`);
    setActiveTab('sandbox');
  };

  const handleSendHookToSandbox = (hookText: string) => {
    setSandboxSnippet(hookText);
    setSandboxInstruction('Refine opening hook for high retention audio drama delivery.');
    setActiveTab('sandbox');
  };

  const handleOpenSandboxWithFix = (fixInstruction: string, excerpt: string) => {
    setSandboxSnippet(excerpt);
    setSandboxInstruction(fixInstruction);
    setActiveTab('sandbox');
  };

  const handleApplyToScript = (newSnippet: string) => {
    if (!currentScript.episodes.length) return;
    // Apply to first episode script
    const updatedEpisodes = [...currentScript.episodes];
    updatedEpisodes[0].scriptText =
      newSnippet + '\n\n' + updatedEpisodes[0].scriptText;
    setCurrentScript({ ...currentScript, episodes: updatedEpisodes });
    setActiveTab('script-editor');
  };

  return (
    <div className="h-screen bg-[#0A0A0C] text-slate-200 font-sans antialiased flex flex-col overflow-hidden">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasAnalysis={!!analysisResult}
        onAnalyzeNew={() => handleAnalyzeScript(currentScript)}
        isAnalyzing={isAnalyzing}
      />

      <main className="flex-1 overflow-auto bg-[#0F1014] p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Global Error Banner */}
          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
              <button
                onClick={() => setErrorMsg(null)}
                className="text-xs font-semibold hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Global Loading Overlay Banner */}
          {isAnalyzing && (
            <div className="bg-[#0A0A0C] border border-indigo-500/40 p-6 rounded shadow-xl flex flex-col items-center justify-center space-y-3 text-center">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
                <Sparkles className="w-5 h-5 text-indigo-400 absolute top-3 left-3 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Generating Story Intelligence...
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Analyzing opening hook retention, mapping Story Genome DNA, evaluating emotional pacing & detecting plot holes...
                </p>
              </div>
            </div>
          )}

          {/* Tab 1: Script Input Hub */}
          {activeTab === 'script-editor' && (
            <ScriptEditorPanel
              currentScript={currentScript}
              setCurrentScript={setCurrentScript}
              onAnalyze={(script) => handleAnalyzeScript(script, selectedModel)}
              isAnalyzing={isAnalyzing}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
            />
          )}

          {/* Tab 2: Intelligence Dashboard */}
          {activeTab === 'analytics' && analysisResult && (
            <div className="space-y-6">
              <StoryOverviewHeader analysis={analysisResult} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {analysisResult.genome && <StoryGenomeCard genome={analysisResult.genome} />}
                {analysisResult.hookAnalysis && (
                  <HookAnalysisCard
                    hook={analysisResult.hookAnalysis}
                    onSendToSandbox={handleSendHookToSandbox}
                  />
                )}
              </div>

              {analysisResult.retentionCurve && (
                <RetentionGraph
                  retentionData={analysisResult.retentionCurve}
                  onOpenSandboxWithFix={handleOpenSandboxWithFix}
                />
              )}

              {analysisResult.emotionalTimeline && (
                <EmotionalTimelineGraph timeline={analysisResult.emotionalTimeline} />
              )}

              {analysisResult.issues && (
                <StoryIssuesInspector
                  issues={analysisResult.issues}
                  onFixInSandbox={handleFixInSandbox}
                />
              )}

              {analysisResult.benchmark && (
                <BenchmarkingPanel benchmarks={analysisResult.benchmark} />
              )}
            </div>
          )}

          {/* Tab 3: Rewrite Sandbox */}
          {activeTab === 'sandbox' && (
            <LiveRewriteSandbox
              initialSnippet={sandboxSnippet}
              initialInstruction={sandboxInstruction}
              onApplyToScript={handleApplyToScript}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="h-8 shrink-0 bg-[#0F1014] border-t border-slate-800 px-6 flex items-center justify-between">
        <div className="flex gap-6">
          <div className="text-[10px] text-slate-500">
            <span className="text-slate-400 mr-1">Platform:</span> Pocket FM Story Intelligence
          </div>
        </div>
        <div className="text-[10px] text-indigo-400 font-mono tracking-tighter uppercase">
          SYSTEM STATUS: READY
        </div>
      </footer>
    </div>
  );
}
