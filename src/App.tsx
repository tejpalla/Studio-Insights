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
import { Sparkles, AlertCircle, Download, History, FileText } from 'lucide-react';

export default function App() {
  const [currentScript, setCurrentScript] = useState<StoryScript>(() => {
    const saved = localStorage.getItem('helix_current_script');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* fallback */ }
    }
    return SAMPLE_SCRIPTS[0];
  });

  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash-lite');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(() => {
    const saved = localStorage.getItem('helix_latest_analysis');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* fallback */ }
    }
    return null;
  });

  const [analysisHistory, setAnalysisHistory] = useState<AnalysisResult[]>(() => {
    const saved = localStorage.getItem('helix_analysis_history');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* fallback */ }
    }
    return [];
  });

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'analytics' | 'script-editor' | 'sandbox'>('script-editor');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // Sandbox prepopulate state
  const [sandboxSnippet, setSandboxSnippet] = useState<string>('');
  const [sandboxInstruction, setSandboxInstruction] = useState<string>('');

  // Persist currentScript to localStorage on change
  useEffect(() => {
    localStorage.setItem('helix_current_script', JSON.stringify(currentScript));
  }, [currentScript]);

  // Persist analysisHistory and latest analysis
  useEffect(() => {
    if (analysisResult) {
      localStorage.setItem('helix_latest_analysis', JSON.stringify(analysisResult));
    }
  }, [analysisResult]);

  useEffect(() => {
    localStorage.setItem('helix_analysis_history', JSON.stringify(analysisHistory));
  }, [analysisHistory]);

  // Auto-analyze initial script on first load if no analysis exists
  useEffect(() => {
    if (!analysisResult) {
      handleAnalyzeScript(currentScript, selectedModel);
    }
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
      setAnalysisHistory(prev => [data, ...prev.filter(item => item.storyId !== data.storyId)].slice(0, 20));
      setActiveTab('analytics');
    } catch (err: any) {
      console.error('Error analyzing script:', err);
      setErrorMsg(err.message || 'Failed to analyze script.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownloadScript = () => {
    let textContent = `# TITLE: ${currentScript.title}\n# GENRE: ${currentScript.genre}\n# TARGET AUDIENCE: ${currentScript.targetAudience || 'General'}\n\n`;
    currentScript.episodes.forEach(ep => {
      textContent += `========================================\n`;
      textContent += `EPISODE ${ep.episodeNumber}: ${ep.title}\n`;
      textContent += `========================================\n\n`;
      textContent += `${ep.scriptText}\n\n\n`;
    });

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentScript.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_script.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAnalysisJSON = () => {
    if (!analysisResult) return;
    const blob = new Blob([JSON.stringify(analysisResult, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentScript.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_analysis_iq.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
        onDownloadScript={handleDownloadScript}
        onDownloadAnalysisJSON={handleDownloadAnalysisJSON}
        onOpenHistory={() => setShowHistoryModal(true)}
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
            <div className="bg-[#0A0A0C] border border-crimson-500/40 p-6 rounded shadow-xl flex flex-col items-center justify-center space-y-3 text-center">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-4 border-crimson-500/20 border-t-crimson-500 animate-spin"></div>
                <Sparkles className="w-5 h-5 text-crimson-400 absolute top-3 left-3 animate-pulse" />
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
              onDownloadScript={handleDownloadScript}
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

      {/* History & Stored Outputs Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A0A0C] border border-slate-800 rounded-lg max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <History className="w-5 h-5 text-crimson-400" />
                <h3 className="text-base font-bold text-white">Stored Analysis Outputs & History</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Helix securely stores every analysis output in local storage so you can review previous story evaluations, scores, and recommendations.
            </p>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {analysisHistory.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">No stored analysis history yet. Run Story IQ to record results.</div>
              ) : (
                analysisHistory.map((item, idx) => (
                  <div key={item.storyId + idx} className="bg-[#0F1014] border border-slate-800 rounded p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white">{item.title}</span>
                        <span className="text-[10px] bg-crimson-900/40 text-crimson-300 px-2 py-0.5 rounded">{item.commercialViability}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{item.executiveSummary}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setAnalysisResult(item);
                          setActiveTab('analytics');
                          setShowHistoryModal(false);
                        }}
                        className="px-3 py-1.5 bg-crimson-600 hover:bg-crimson-500 text-white rounded text-[10px] font-semibold"
                      >
                        View Dashboard
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="h-8 shrink-0 bg-[#0F1014] border-t border-slate-800 px-6 flex items-center justify-between">
        <div className="flex gap-6">
          <div className="text-[10px] text-slate-500">
            <span className="text-slate-400 mr-1">Platform:</span> Helix Story Intelligence (Auto-Persisted)
          </div>
        </div>
        <div className="text-[10px] text-crimson-400 font-mono tracking-tighter uppercase">
          SYSTEM STATUS: READY
        </div>
      </footer>
    </div>
  );
}

