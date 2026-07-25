import React, { useState } from 'react';
import { EmotionalPoint } from '../types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Heart, Activity, Flame, ShieldAlert } from 'lucide-react';

interface EmotionalTimelineGraphProps {
  timeline: EmotionalPoint[];
}

export const EmotionalTimelineGraph: React.FC<EmotionalTimelineGraphProps> = ({ timeline }) => {
  const [selectedPointIndex, setSelectedPointIndex] = useState<number>(0);

  const selectedPoint = timeline[selectedPointIndex] || timeline[0];

  return (
    <div className="bg-[#0A0A0C] border border-slate-800 rounded p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-crimson-900/20 border border-crimson-500/30 flex items-center justify-center text-crimson-400">
            <Heart className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">Emotional Journey Arc</h3>
            <p className="text-[10px] text-slate-400">
              Audio pacing of emotional intensity, conflict, and catharsis
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 bg-rose-500 inline-block"></span>
            <span>Intensity</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 bg-crimson-400 inline-block"></span>
            <span>Valence</span>
          </div>
        </div>
      </div>

      {/* Recharts Dual Line Chart */}
      <div className="h-60 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={timeline}
            onClick={(e) => {
              if (e && e.activeTooltipIndex !== undefined) {
                setSelectedPointIndex(e.activeTooltipIndex);
              }
            }}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.5} />
            <XAxis dataKey="timestamp" stroke="#64748b" tick={{ fontSize: 10 }} />
            <YAxis domain={[-100, 100]} stroke="#64748b" tick={{ fontSize: 10 }} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as EmotionalPoint;
                  return (
                    <div className="bg-[#0F1014] border border-slate-800 p-3 rounded text-xs space-y-1">
                      <p className="font-bold text-crimson-400">{data.timestamp} - Scene {data.sceneNumber}</p>
                      <p className="text-white">Emotion: <span className="font-semibold text-rose-400">{data.dominantEmotion}</span></p>
                      <p className="text-slate-300">Intensity: {data.intensity}% | Valence: {data.valence}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="intensity"
              name="Intensity"
              stroke="#f43f5e"
              strokeWidth={2}
              dot={{ r: 4, fill: '#f43f5e' }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="valence"
              name="Valence"
              stroke="#818cf8"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 4, fill: '#818cf8' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Selected Scene Breakdown Card */}
      {selectedPoint && (
        <div className="bg-[#0F1014] border border-slate-800 rounded p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-crimson-400 uppercase tracking-widest flex items-center space-x-1.5">
              <Flame className="w-3 h-3 text-rose-400" />
              <span>Scene {selectedPoint.sceneNumber} ({selectedPoint.timestamp}) Emotional Pulse</span>
            </span>

            <span className="px-2.5 py-0.5 rounded bg-rose-900/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
              {selectedPoint.dominantEmotion} (Intensity: {selectedPoint.intensity}%)
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed bg-[#0A0A0C] p-3 rounded border border-slate-800">
            {selectedPoint.description}
          </p>
        </div>
      )}
    </div>
  );
};
