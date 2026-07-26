import React from 'react';

export interface ArenaTickerLine {
  id: string;
  summary: string;
  type?: string;
  round?: number;
  username?: string;
}

interface ArenaTickerProps {
  lines: ArenaTickerLine[];
  isLive?: boolean;
  runId?: string | null;
  agentCount?: number;
  rounds?: number;
  activePerRound?: number;
}

export const ArenaTicker: React.FC<ArenaTickerProps> = ({
  lines,
  isLive,
  runId,
  agentCount,
  rounds,
  activePerRound,
}) => {
  if (!lines.length && !isLive) return null;

  const meta =
    agentCount != null && rounds != null
      ? `${agentCount} agents · ${rounds} rounds${
          activePerRound != null ? ` · ${activePerRound} active/round` : ''
        }`
      : 'multi-agent Hunger Games';

  return (
    <div className="border border-line rounded-xl bg-[#1a1a1b] text-[#d7dadc] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-white/10 text-[11px] uppercase tracking-wide">
        <span className="flex items-center gap-2 font-semibold text-[#ff4500]">
          {isLive && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ff4500] animate-pulse" aria-hidden />
          )}
          {isLive ? 'Arena live' : 'Arena log'}
        </span>
        <span className="text-white/50 normal-case tracking-normal">
          {meta}
          {runId ? ` · ${runId.slice(0, 12)}` : ''}
        </span>
      </div>
      <ul className="max-h-40 overflow-y-auto px-4 py-2 space-y-1.5 font-mono text-[11px] leading-snug">
        {lines.length === 0 && isLive && (
          <li className="text-white/40">Casting agents…</li>
        )}
        {lines.map((line) => {
          let body = line.summary;
          if (line.username) {
            const prefix = `u/${line.username}`;
            if (body.startsWith(prefix)) {
              body = body.slice(prefix.length).replace(/^[\s·\-—]+/, '');
            }
          }
          return (
            <li key={line.id} className="text-white/85">
              {line.round != null && (
                <span className="text-orange-500">{`r${line.round}`}</span>
              )}
              {line.round != null && ' '}
              {line.username && (
                <span className="text-sky-400">{`u/${line.username}`}</span>
              )}
              {line.username && ' '}
              <span>{body}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
