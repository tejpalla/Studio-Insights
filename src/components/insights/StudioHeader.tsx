import React from 'react';
import { AppView } from '../../types';

interface StudioHeaderProps {
  view: AppView;
  seriesTitle?: string | null;
  onHome: () => void;
  onSeries?: () => void;
  onInsights?: () => void;
  insightsEnabled?: boolean;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  view,
  seriesTitle,
  onHome,
  onSeries,
  onInsights,
  insightsEnabled,
}) => {
  return (
    <header className="border-b border-line bg-paper/95 backdrop-blur sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
        <button type="button" onClick={onHome} className="flex items-center gap-2.5 text-left group">
          <span className="w-7 h-7 rounded-full bg-[#ff4500] text-white text-[11px] font-bold flex items-center justify-center">
            r/
          </span>
          <div>
            <div className="text-sm font-semibold text-ink leading-none group-hover:text-[#ff4500] transition-colors">
              Studio Insights
            </div>
            <div className="text-[10px] text-ink-muted mt-0.5">Simulated room · you keep the pen</div>
          </div>
        </button>

        <nav className="flex items-center gap-1 text-xs">
          <NavBtn active={view === 'home'} onClick={onHome}>
            Home
          </NavBtn>
          {onSeries && (
            <NavBtn active={view === 'series'} onClick={onSeries} disabled={!seriesTitle}>
              Series
            </NavBtn>
          )}
          {onInsights && (
            <NavBtn active={view === 'insights'} onClick={onInsights} disabled={!insightsEnabled}>
              Room
            </NavBtn>
          )}
        </nav>
      </div>
    </header>
  );
};

function NavBtn({
  children,
  active,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active ? 'bg-ink text-paper' : 'text-ink-muted hover:text-ink hover:bg-paper-2'
      }`}
    >
      {children}
    </button>
  );
}
