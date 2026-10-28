import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { BacktestWorkspace } from '@/components/backtest/BacktestWorkspace';
import { BotBacktestWorkspace } from '@/components/backtest/bots/BotBacktestWorkspace';

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * 🧭 PAGE PRINCIPALE DU BACKTESTING (MANUEL & BOTS)
 * ──────────────────────────────────────────────────────────────────────────────
 * La bascule entre le mode Manuel et le mode Bots s'effectue directement dans
 * la Navbar supérieure (à côté du bouton burger) pour maximiser l'espace d'affichage.
 * 
 * Exemple :
 * Naviguer vers /backtest ou /backtest?mode=bots
 */
export default function Backtest() {
  const [searchParams] = useSearchParams();

  // Mode actif déterminé par le paramètre URL (?mode=bots ou ?mode=manuel)
  const modeParam = searchParams.get('mode');
  const modeActif: 'manuel' | 'bots' = modeParam === 'bots' ? 'bots' : 'manuel';

  return (
    <AppLayout title={modeActif === 'bots' ? "Studio & Journal des Bots" : "Espace Backtesting"}>
      <div className="flex-1 flex flex-col overflow-hidden bg-bg">
        {/* Corps dynamique de l'espace sélectionné (espace maximisé sans barre intermédiaire) */}
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
