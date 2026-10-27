import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { BacktestWorkspace } from '@/components/backtest/BacktestWorkspace';
import { BotBacktestWorkspace } from '@/components/backtest/bots/BotBacktestWorkspace';
import { cn } from '@/lib/utils';

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * 🧭 PAGE PRINCIPALE DU BACKTESTING (MANUEL & BOTS)
 * ──────────────────────────────────────────────────────────────────────────────
 * Sépare clairement :
 * 1. Backtest Manuel : Replay graphique TradingView pour trader discrétionnaire.
 * 2. Backtest Bots : Studio de simulation batch et Journal dédié aux algorithmes.
 * 
 * Exemple :
 * Naviguer vers /backtest ou /backtest?mode=bots
 */
export default function Backtest() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Mode actif déterminé par le paramètre URL (?mode=bots ou ?mode=manuel)
  const modeParam = searchParams.get('mode');
  const modeActif: 'manuel' | 'bots' = modeParam === 'bots' ? 'bots' : 'manuel';

  // Change de mode et met à jour l'URL sans rechargement
  const changerMode = (nouveauMode: 'manuel' | 'bots') => {
    setSearchParams({ mode: nouveauMode });
  };

  return (
    <AppLayout title={modeActif === 'bots' ? "Studio & Journal des Bots" : "Espace Backtesting"}>
      <div className="flex-1 flex flex-col overflow-hidden bg-bg">
        {/* ─── Barre de bascule ergonomique Manuel vs Bots ─────────────────── */}
        <div className="bg-surface border-b border-border px-4 py-2 flex items-center justify-between flex-shrink-0 z-20">
          <div className="flex items-center gap-1.5 bg-surface2 p-1 rounded-lg border border-border">
            {/* Bouton Backtest Manuel */}
            <button
              onClick={() => changerMode('manuel')}
              className={cn(
                'px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5',
                modeActif === 'manuel'
                  ? 'bg-surface text-txt shadow-xs border border-border/80'
                  : 'text-txt3 hover:text-txt'
              )}
            >
              <span>🎯</span>
              <span>Backtest Manuel</span>
            </button>

            {/* Bouton Backtest Bots & Journal Dédié */}
            <button
              onClick={() => changerMode('bots')}
              className={cn(
                'px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5',
                modeActif === 'bots'
                  ? 'bg-accent text-white shadow-xs font-bold'
                  : 'text-txt3 hover:text-txt'
              )}
            >
              <span>🤖</span>
              <span>Backtest Bots & Journal</span>
              <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full uppercase">
                SMC
              </span>
            </button>
          </div>

          {/* Description rapide du mode actif */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-txt3">
            {modeActif === 'manuel' ? (
              <span>Replay bougie par bougie · Prise de position discrétionnaire</span>
            ) : (
              <span>Simulation batch en mémoire · Journal de trading automatisé</span>
            )}
          </div>
        </div>

        {/* ─── Corps dynamique de l'espace sélectionné ─────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {modeActif === 'manuel' ? (
            <BacktestWorkspace />
          ) : (
            <BotBacktestWorkspace />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
