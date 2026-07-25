import React, { useState, useRef } from 'react';
import { StoryScript, StoryEpisode } from '../types';
import { SAMPLE_SCRIPTS } from '../data/sampleScripts';
import { Play, Sparkles, Plus, Trash2, BookOpen, Layers, Clock, AlertCircle, Upload, Download } from 'lucide-react';

interface ScriptEditorPanelProps {
  currentScript: StoryScript;
  setCurrentScript: (script: StoryScript) => void;
  onAnalyze: (script: StoryScript, model?: string) => void;
  isAnalyzing: boolean;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  onDownloadScript: () => void;
}

export const ScriptEditorPanel: React.FC<ScriptEditorPanelProps> = ({
  currentScript,
  setCurrentScript,
  onAnalyze,
  isAnalyzing,
  selectedModel,
  setSelectedModel,
  onDownloadScript,
}) => {
  const [selectedSampleId, setSelectedSampleId] = useState<string>(SAMPLE_SCRIPTS[0].id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        let rawTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        rawTitle = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);

        const episodeRegex = /(?:^|\n)(?:#{1,3}\s*)?(?:Episode|Ep\.?)\s*(\d+)(?:\s*[:\-]?\s*(.*))?/gi;
        
        let episodes: StoryEpisode[] = [];
        let matches = [...text.matchAll(episodeRegex)];

        if (matches.length > 0) {
          for (let i = 0; i < matches.length; i++) {
            const currentMatch = matches[i];
            const epNum = parseInt(currentMatch[1], 10) || (i + 1);
            const epTitleHeading = currentMatch[2]?.trim() || `Episode ${epNum}`;
            
            const startIndex = currentMatch.index! + currentMatch[0].length;
            const endIndex = (i + 1 < matches.length) ? matches[i + 1].index! : text.length;
            const scriptText = text.substring(startIndex, endIndex).trim();

            episodes.push({
              id: `ep-${Date.now()}-${i}`,
              episodeNumber: epNum,
              title: epTitleHeading,
              scriptText: scriptText || currentMatch[0]
            });
          }
        }

        if (episodes.length === 0) {
          episodes = [
            {
              id: `ep-${Date.now()}-1`,
              episodeNumber: 1,
              title: 'Uploaded Script',
              scriptText: text.trim()
            }
          ];
        }

        setCurrentScript({
          ...currentScript,
          title: rawTitle,
          episodes
        });
        setSelectedSampleId('');
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleSelectSample = (sample: StoryScript) => {
    setSelectedSampleId(sample.id);
    setCurrentScript(JSON.parse(JSON.stringify(sample)));
  };

  const handleTitleChange = (title: string) => {
    setCurrentScript({ ...currentScript, title });
  };

  const handleGenreChange = (genre: string) => {
    setCurrentScript({ ...currentScript, genre });
  };

  const handleEpisodeChange = (index: number, field: keyof StoryEpisode, value: string) => {
    const updatedEpisodes = [...currentScript.episodes];
    updatedEpisodes[index] = {
      ...updatedEpisodes[index],
      [field]: value,
    };
    setCurrentScript({ ...currentScript, episodes: updatedEpisodes });
  };

  const handleAddEpisode = () => {
    const newNum = currentScript.episodes.length + 1;
    const newEp: StoryEpisode = {
      id: `ep-${Date.now()}`,
      episodeNumber: newNum,
      title: `Episode ${newNum}`,
      scriptText: `[SFX: Dramatic intro music fade in]\n\nNARRATOR:\nWrite or paste your episode script here...\n\n[SFX: Cliffhanger tension sting]`,
    };
    setCurrentScript({
      ...currentScript,
      episodes: [...currentScript.episodes, newEp],
    });
  };

  const handleRemoveEpisode = (index: number) => {
    if (currentScript.episodes.length <= 1) return;
    const updated = currentScript.episodes.filter((_, i) => i !== index);
    // re-number
    const renumbered = updated.map((ep, i) => ({
      ...ep,
      episodeNumber: i + 1,
    }));
    setCurrentScript({ ...currentScript, episodes: renumbered });
  };

  const totalWords = currentScript.episodes.reduce((acc, ep) => {
    return acc + (ep.scriptText ? ep.scriptText.split(/\s+/).length : 0);
  }, 0);

  const totalMinutes = (totalWords / 140).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Top Banner & Sample Preset Selector */}
      <div className="bg-[#0A0A0C] border border-slate-800 rounded p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-crimson-900/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 relative">
          <div>
            <div className="flex items-center space-x-2 text-crimson-400 text-[10px] font-bold uppercase tracking-widest mb-1">
              <BookOpen className="w-3 h-3" />
              <span>Pre-Publication Script Hub</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
              Upload or Select an Audio Story Script
            </h2>
            <p className="text-[10px] text-slate-400 mt-1">
              Test your serial audio scripts for retention bottlenecks, hook strength, and character consistency before publishing on Pocket FM.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0">
            <input 
              type="file" 
              accept=".txt" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 px-3 py-3 bg-[#0F1014] hover:bg-slate-800 text-crimson-400 border border-slate-800 font-bold text-[10px] uppercase tracking-widest rounded transition-all active:scale-95 shrink-0"
              title="Upload script text file"
            >
              <Upload className="w-4 h-4" />
              <span>Upload .TXT</span>
            </button>
            <button
              onClick={onDownloadScript}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 px-3 py-3 bg-[#0F1014] hover:bg-slate-800 text-crimson-400 border border-slate-800 font-bold text-[10px] uppercase tracking-widest rounded transition-all active:scale-95 shrink-0"
              title="Download edited script"
            >
              <Download className="w-4 h-4" />
              <span>Download Script</span>
            </button>
            <button
              onClick={() => onAnalyze(currentScript)}
              disabled={isAnalyzing}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-3 bg-crimson-600 hover:bg-crimson-500 text-white font-bold text-[10px] uppercase tracking-widest rounded transition-all active:scale-95 disabled:opacity-50 shrink-0"
            >
              <Sparkles className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{isAnalyzing ? 'Running AI Intelligence...' : 'Analyze Story Script'}</span>
            </button>
          </div>
        </div>

        {/* Model Selector & Preset Sample Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="md:col-span-1 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
              AI Model Engine
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-[#0F1014] border border-slate-800 rounded p-2.5 text-xs text-white font-medium focus:outline-none focus:border-crimson-500"
            >
              <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite</option>
              <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
              <option value="gpt-4o">OpenAI GPT-4o</option>
              <option value="gpt-4o-mini">OpenAI GPT-4o-mini</option>
            </select>
          </div>
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
              Load Pocket FM Benchmark Sample Stories
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SAMPLE_SCRIPTS.map((sample) => {
                const isSelected = selectedSampleId === sample.id;
                return (
                  <button
                    key={sample.id}
                    onClick={() => handleSelectSample(sample)}
                    className={`text-left p-3 rounded border transition-all relative ${
                      isSelected
                        ? 'bg-[#0F1014] border-crimson-500 text-white'
                        : 'bg-[#0A0A0C] border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-[#0F1014]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[9px] font-bold text-crimson-400 uppercase tracking-widest truncate max-w-[120px]">
                        {sample.genre}
                      </span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-crimson-400 animate-ping"></span>
                      )}
                    </div>
                    <h4 className="text-xs font-semibold truncate text-white tracking-tight">{sample.title}</h4>
                    <p className="text-[9px] text-slate-400 mt-0.5 flex items-center space-x-1">
                      <Layers className="w-2.5 h-2.5 text-slate-500" />
                      <span>{sample.episodes.length} Eps</span>
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Script Metadata Form */}
      <div className="bg-[#0A0A0C] border border-slate-800 rounded p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white tracking-tight flex items-center space-x-2">
          <span>Story Metadata</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Story Title</label>
            <input
              type="text"
              value={currentScript.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full bg-[#0F1014] border border-slate-800 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-crimson-500 transition-colors"
              placeholder="e.g. The Billionaire's Secret Heir"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Primary Genre / Tropes</label>
            <input
              type="text"
              value={currentScript.genre}
              onChange={(e) => handleGenreChange(e.target.value)}
              className="w-full bg-[#0F1014] border border-slate-800 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-crimson-500 transition-colors"
              placeholder="e.g. Billionaire Romance / Revenge Drama"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 text-[10px] text-slate-400 border-t border-slate-800">
          <div className="flex items-center space-x-4">
            <span>
              Total Word Count: <strong className="text-white">{totalWords.toLocaleString()} words</strong>
            </span>
            <span>
              Est. Audio Length: <strong className="text-crimson-400">{totalMinutes} mins</strong>
            </span>
          </div>
          <span className="hidden sm:inline text-slate-500 uppercase tracking-widest font-bold">
            Audio Pace Target: ~140-160 WPM
          </span>
        </div>
      </div>

      {/* Episode Editors */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center space-x-2 tracking-tight">
            <span>Episode Scripts</span>
            <span className="text-[10px] bg-[#0F1014] text-slate-300 px-2 py-0.5 rounded font-mono border border-slate-800">
              {currentScript.episodes.length}
            </span>
          </h3>

          <button
            onClick={handleAddEpisode}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#0F1014] hover:bg-slate-800 text-crimson-400 text-[10px] font-bold uppercase tracking-widest rounded transition-colors border border-slate-800"
          >
            <Plus className="w-3 h-3" />
            <span>Add Episode</span>
          </button>
        </div>

        {currentScript.episodes.map((ep, idx) => {
          const wordCount = ep.scriptText ? ep.scriptText.split(/\s+/).length : 0;
          const mins = (wordCount / 140).toFixed(1);

          return (
            <div
              key={ep.id || idx}
              className="bg-[#0A0A0C] border border-slate-800 rounded p-5 space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center space-x-3 flex-1">
                  <span className="w-8 h-8 rounded bg-crimson-900/20 text-crimson-400 border border-crimson-500/30 font-bold text-[10px] flex items-center justify-center shrink-0">
                    E{ep.episodeNumber}
                  </span>
                  <input
                    type="text"
                    value={ep.title}
                    onChange={(e) => handleEpisodeChange(idx, 'title', e.target.value)}
                    className="bg-[#0F1014] border border-slate-800 rounded px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-crimson-500 flex-1"
                    placeholder={`Episode ${ep.episodeNumber} Title`}
                  />
                </div>

                <div className="flex items-center space-x-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span className="bg-[#0F1014] px-2.5 py-1 rounded border border-slate-800 font-mono">
                    {wordCount} w • ~{mins}m
                  </span>

                  {currentScript.episodes.length > 1 && (
                    <button
                      onClick={() => handleRemoveEpisode(idx)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-900/20 rounded transition-colors"
                      title="Delete Episode"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Script Content (Include character dialogue, narrator voiceover, and [SFX: ...] sound cues)
                </label>
                <textarea
                  value={ep.scriptText}
                  onChange={(e) => handleEpisodeChange(idx, 'scriptText', e.target.value)}
                  rows={8}
                  className="w-full bg-[#0F1014] border border-slate-800 rounded p-4 text-xs font-mono text-slate-300 focus:outline-none focus:border-crimson-500 transition-colors leading-relaxed"
                  placeholder="Paste audio drama script snippet here..."
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Floating Action Bar */}
      <div className="sticky bottom-6 bg-[#0A0A0C] border border-crimson-500/30 rounded p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3 text-[10px] text-slate-300 font-bold uppercase tracking-widest">
          <AlertCircle className="w-4 h-4 text-crimson-400 shrink-0" />
          <span>Ready for pre-publication AI intelligence analysis.</span>
        </div>

        <button
          onClick={() => onAnalyze(currentScript)}
          disabled={isAnalyzing}
          className="flex items-center space-x-2 px-6 py-2.5 bg-crimson-600 hover:bg-crimson-500 text-white font-bold text-[10px] uppercase tracking-widest rounded transition-all active:scale-95 disabled:opacity-50"
        >
          <Sparkles className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
          <span>{isAnalyzing ? 'Analyzing Script...' : 'Run Story Intelligence IQ'}</span>
        </button>
      </div>
    </div>
  );
};
