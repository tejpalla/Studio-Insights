import React, { useState } from 'react';
import { Sparkles, Radio, Play, Pause, Copy, Check, RefreshCw, Volume2, ArrowRight } from 'lucide-react';

interface LiveRewriteSandboxProps {
  initialSnippet?: string;
  initialInstruction?: string;
  onApplyToScript?: (newSnippet: string) => void;
}

export const LiveRewriteSandbox: React.FC<LiveRewriteSandboxProps> = ({
  initialSnippet = '',
  initialInstruction = '',
  onApplyToScript,
}) => {
  const [originalSnippet, setOriginalSnippet] = useState<string>(
    initialSnippet ||
      `[SFX: Rain tapping against window]\n\nNARRATOR:\nDamian looked at Clara. He was very angry because she had signed the papers.\n\nDAMIAN:\n"Clara, why are you leaving me? You have no money without me."\n\nCLARA:\n"I don't care about your money, Damian. Goodbye."`
  );

  const [instruction, setInstruction] = useState<string>(
    initialInstruction || 'Amplify emotional conflict, add punchy dialogue, and end on a high-stakes audio cliffhanger.'
  );

  const [isRewriting, setIsRewriting] = useState<boolean>(false);
  const [improvedSnippet, setImprovedSnippet] = useState<string>('');
  const [explanation, setExplanation] = useState<string>('');
  const [retentionGain, setRetentionGain] = useState<string>('');

  // Audio preview state
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioObj, setAudioObj] = useState<HTMLAudioElement | null>(null);

  const handleRewrite = async () => {
    if (!originalSnippet.trim()) return;
    setIsRewriting(true);
    setAudioError(null);

    try {
      const res = await fetch('/api/rewrite-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptSnippet: originalSnippet,
          instruction: instruction,
        }),
      });

      const data = await res.json();
      if (data.improvedSnippet) {
        setImprovedSnippet(data.improvedSnippet);
        setExplanation(data.explanation || 'Optimized dialogue flow and audio tension.');
        setRetentionGain(data.estimatedRetentionGain || '+15% retention gain');
      }
    } catch (err) {
      console.error('Rewrite failed:', err);
    } finally {
      setIsRewriting(false);
    }
  };

  const handleTTSPreview = async () => {
    const textToPlay = improvedSnippet || originalSnippet;
    if (!textToPlay) return;

    if (isPlayingAudio && audioObj) {
      audioObj.pause();
      setIsPlayingAudio(false);
      return;
    }

    setIsPlayingAudio(true);
    setAudioError(null);

    try {
      // 1. Try Gemini TTS API
      const res = await fetch('/api/tts-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToPlay, voiceName: 'Kore' }),
      });

      const data = await res.json();

      if (data.audioBase64) {
        // Play PCM/Audio using Web Audio API or Data URL
        const audioSrc = `data:audio/wav;base64,${data.audioBase64}`;
        const audio = new Audio(audioSrc);
        setAudioObj(audio);
        audio.play();
        audio.onended = () => setIsPlayingAudio(false);
      } else {
        // Fallback to Web Speech Synthesis API
        playWebSpeechFallback(textToPlay);
      }
    } catch (err) {
      console.warn('Gemini TTS fallback to Web Speech API:', err);
      playWebSpeechFallback(textToPlay);
    }
  };

  const playWebSpeechFallback = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      // Remove SFX bracket tags for spoken preview
      const cleanText = text.replace(/\[SFX:[^\]]+\]/g, '').trim();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setAudioError('Browser speech synthesis unavailable.');
      setIsPlayingAudio(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Live AI Script Doctor & Sandbox</h3>
            <p className="text-xs text-slate-400">
              Instant script optimization & real-time TTS audio preview
            </p>
          </div>
        </div>

        <button
          onClick={handleRewrite}
          disabled={isRewriting || !originalSnippet.trim()}
          className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50"
        >
          <Sparkles className={`w-4 h-4 ${isRewriting ? 'animate-spin' : ''}`} />
          <span>{isRewriting ? 'Doctoring Script...' : 'Optimize Scene with AI'}</span>
        </button>
      </div>

      {/* Instruction Prompt Input */}
      <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-xl space-y-2">
        <label className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
          Editorial Instruction / Goal
        </label>
        <input
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
          placeholder="e.g. Elevate stakes, sharpen cliffhanger, fix plot hole..."
        />
      </div>

      {/* Side-by-Side Editor Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Original Script */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Original Script Snippet
            </span>
          </div>
          <textarea
            value={originalSnippet}
            onChange={(e) => setOriginalSnippet(e.target.value)}
            rows={10}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500 leading-relaxed"
            placeholder="Paste script snippet here..."
          />
        </div>

        {/* AI Optimized Result */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Optimized Script</span>
            </span>

            {retentionGain && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                {retentionGain}
              </span>
            )}
          </div>

          <div className="relative">
            <textarea
              readOnly
              value={improvedSnippet || (isRewriting ? 'Doctoring script...' : 'Click "Optimize Scene with AI" to generate rewritten script...')}
              rows={10}
              className="w-full bg-slate-950 border border-amber-500/30 rounded-xl p-4 text-xs font-mono text-amber-100/90 focus:outline-none leading-relaxed"
            />
          </div>
        </div>
      </div>

      {/* Explanation & Audio Preview Actions */}
      {improvedSnippet && (
        <div className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-2xl space-y-4">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase">AI Editorial Notes:</span>
            <p className="text-xs text-slate-300">{explanation}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
            {/* Audio Preview Trigger */}
            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <button
                onClick={handleTTSPreview}
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-amber-500 text-slate-950 hover:bg-amber-400 font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 w-full sm:w-auto"
              >
                {isPlayingAudio ? (
                  <>
                    <Pause className="w-4 h-4 animate-spin" />
                    <span>Stop Audio Preview</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" />
                    <span>Listen Audio Preview</span>
                  </>
                )}
              </button>

              {isPlayingAudio && (
                <div className="flex items-center space-x-1 px-3 py-1.5 bg-slate-900 rounded-lg border border-amber-500/30 text-amber-400 text-xs font-mono">
                  <span className="w-1.5 h-3 bg-amber-400 animate-bounce"></span>
                  <span className="w-1.5 h-4 bg-amber-400 animate-bounce delay-100"></span>
                  <span className="w-1.5 h-2 bg-amber-400 animate-bounce delay-200"></span>
                  <span className="ml-1 text-[10px]">Playing Audio Voice...</span>
                </div>
              )}
            </div>

            {/* Apply to Main Script button */}
            {onApplyToScript && (
              <button
                onClick={() => onApplyToScript(improvedSnippet)}
                className="flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 transition-colors w-full sm:w-auto justify-center"
              >
                <span>Apply to Main Script</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
