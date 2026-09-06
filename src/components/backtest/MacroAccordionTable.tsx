import React, { useState } from 'react';
import { CurrencyMacroState } from '@/types/fundamental';

interface MacroAccordionTableProps {
  state: CurrencyMacroState;
  title: string;
  defaultExpanded?: boolean;
}

/**
 * Tableau récapitulatif dépliable pour les indicateurs macro d'une devise (ex: EUR ou USD).
 * 
 * Exemple d'utilisation :
 * <MacroAccordionTable state={snapshot.baseState} title="Euro (EUR)" defaultExpanded={true} />
 */
export const MacroAccordionTable: React.FC<MacroAccordionTableProps> = ({
  state,
  title,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const { asset, totalScore, activeEvents } = state;

  return (
    <div className="flex flex-col bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg backdrop-blur-sm text-slate-200 text-xs">
      {/* En-tête de l'accordéon */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-3 py-2 bg-slate-800/80 hover:bg-slate-800 transition-colors border-b border-slate-800/60 font-semibold"
      >
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-slate-700 flex items-center justify-center font-bold text-[11px] text-slate-100 border border-slate-600">
            {asset}
          </span>
          <span className="text-slate-200">{title}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 font-mono">
            <span className="text-slate-400 text-[11px]">Score:</span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold ${
                totalScore > 0
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                  : totalScore < 0
                  ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {totalScore > 0 ? `+${totalScore}` : totalScore}
            </span>
          </div>

          <span className="text-slate-400 text-[10px] transform transition-transform duration-200">
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {/* Contenu dépliable du tableau */}
      {isExpanded && (
        <div className="p-2 overflow-x-auto">
          {activeEvents.length === 0 ? (
            <div className="py-4 text-center text-slate-500 text-[11px] italic">
              Aucun événement enregistré jusqu'à cette date.
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[280px]">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] text-slate-400 font-medium">
                  <th className="py-1 px-1.5">Événement</th>
                  <th className="py-1 px-1.5 text-center">Réel / Prévu</th>
                  <th className="py-1 px-1.5 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {activeEvents.map((ev) => {
                  const isPositive = ev.score > 0;
                  const isNegative = ev.score < 0;

                  return (
                    <tr key={ev.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Nom de l'événement & catégorie */}
                      <td className="py-1.5 px-1.5">
                        <div className="font-medium text-slate-200 leading-snug">{ev.event}</div>
                        <div className="text-[9px] text-slate-500 capitalize">{ev.category}</div>
                      </td>

                      {/* Données Réel vs Forecast */}
                      <td className="py-1.5 px-1.5 text-center font-mono text-[11px]">
                        <span className="text-slate-100 font-semibold">{ev.actual}</span>
                        <span className="text-slate-500 mx-1">/</span>
                        <span className="text-slate-400">{ev.forecast}</span>
                      </td>

                      {/* Score individuel */}
                      <td className="py-1.5 px-1.5 text-right font-mono">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isPositive
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                              : isNegative
                              ? 'bg-rose-950 text-rose-400 border border-rose-800/50'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {ev.score > 0 ? `+${ev.score}` : ev.score}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
