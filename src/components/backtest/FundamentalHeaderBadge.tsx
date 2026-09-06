import React from 'react';
import { FundamentalSnapshot } from '@/types/fundamental';

interface FundamentalHeaderBadgeProps {
  snapshot: FundamentalSnapshot | null;
  onToggleExpand?: () => void;
  isExpanded?: boolean;
}

/**
 * Affiche le badge central du biais macroéconomique net (ex: BULLISH EUR/USD +4.5)
 * avec coloration dynamique (vert/rouge/gris).
 * 
 * Exemple d'utilisation :
 * <FundamentalHeaderBadge snapshot={activeSnapshot} isExpanded={true} onToggleExpand={() => setExpanded(!expanded)} />
 */
export const FundamentalHeaderBadge: React.FC<FundamentalHeaderBadgeProps> = ({
  snapshot,
  onToggleExpand,
  isExpanded = true,
}) => {
  if (!snapshot) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-400 text-xs font-medium">
        <span className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
        <span>Aucune donnée macro disponible</span>
      </div>
    );
  }

  const { baseAsset, quoteAsset, netScore, biasLabel, baseState, quoteState } = snapshot;

  // Configuration des couleurs selon le biais
  let badgeBg = 'bg-slate-800/90 text-slate-300 border-slate-700';
  let dotBg = 'bg-slate-400';
  let netScoreFormatted = netScore > 0 ? `+${netScore.toFixed(1)}` : netScore.toFixed(1);

  if (biasLabel === 'BULLISH') {
    badgeBg = 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60';
    dotBg = 'bg-emerald-400';
  } else if (biasLabel === 'BEARISH') {
    badgeBg = 'bg-rose-950/80 text-rose-300 border-rose-800/60';
    dotBg = 'bg-rose-400';
  }

  return (
    <div className={`flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl border backdrop-blur-md transition-all ${badgeBg}`}>
      {/* Devise A (Base) */}
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <span className="px-1.5 py-0.5 rounded bg-slate-800/70 border border-slate-700 text-slate-200">
          {baseAsset}
        </span>
        <span className={baseState.totalScore >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
          {baseState.totalScore > 0 ? `+${baseState.totalScore}` : baseState.totalScore}
        </span>
      </div>

      {/* Badge central du biais net */}
      <button
        onClick={onToggleExpand}
        className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-700/50 hover:bg-slate-900 transition-colors text-xs font-bold tracking-wide"
        title="Cliquer pour afficher/masquer le détail macro"
      >
        <span className={`w-2 h-2 rounded-full ${dotBg} animate-ping`} />
        <span>
          {biasLabel} {baseAsset}/{quoteAsset} ({netScoreFormatted})
        </span>
        <span className="text-[10px] text-slate-400 ml-1">
          {isExpanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Devise B (Quote) */}
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <span className={quoteState.totalScore >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
          {quoteState.totalScore > 0 ? `+${quoteState.totalScore}` : quoteState.totalScore}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-slate-800/70 border border-slate-700 text-slate-200">
          {quoteAsset}
        </span>
      </div>
    </div>
  );
};
