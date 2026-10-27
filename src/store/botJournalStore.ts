import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { TradeBotSimule, RapportPerformance } from '@/types/bot';

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * 🤖 REPRÉSENTATION D'UNE SESSION DE BACKTESTING DE BOT
 * ──────────────────────────────────────────────────────────────────────────────
 * Regroupe tous les résultats, statistiques et trades pris de manière 100% autonome
 * par un bot (ex: Chef d'Orchestre SMC) sur un actif et une période donnée.
 */
export interface SessionBacktestBot {
  id: string;
  botId: string;
  botNom: string;
  dateExecution: string;
  paire: string;
  timeframe: string;
  totalBougies: number;
  capitalInitial: number;
  capitalFinal: number;
  pnlNetMontant: number;
  pnlNetPourcentage: number;
  winratePourcentage: number;
  profitFactor: number;
  maxDrawdownPourcentage: number;
  ratioRRMoyen: number;
  totalTrades: number;
  tradesGagnants: number;
  tradesPerdants: number;
  tradesBreakeven: number;
  trades: TradeBotSimule[];
  courbeEquity: Array<{ date: string; capital: number }>;
}

interface BotJournalState {
  // Liste ordonnée de toutes les sessions de backtest enregistrées pour les bots
  sessions: SessionBacktestBot[];
  // ID de la session actuellement ouverte dans le journal
  sessionActiveId: string | null;

  // ─── Actions ─────────────────────────────────────────────────────────────
  // Enregistre une nouvelle session complète après l'exécution d'un bot
  ajouterSession: (session: SessionBacktestBot) => void;
  // Enregistre un rapport issu du moteur de simulation
  enregistrerRapportSimulation: (
    rapport: RapportPerformance,
    paire: string,
    timeframe: string
  ) => SessionBacktestBot;
  // Supprime une session spécifique
  supprimerSession: (sessionId: string) => void;
  // Réinitialise tout l'historique des bots
  effacerToutesLesSessions: () => void;
  // Sélectionne la session active à afficher dans le journal
  selectionnerSession: (sessionId: string | null) => void;
}

/**
 * 🗄️ Store Zustand dédié au Journal de Trading des Bots
 * Totalement isolé du journal de trading manuel (Offline-First).
 * 
 * Exemple :
 * const { sessions, ajouterSession } = useBotJournalStore();
 */
export const useBotJournalStore = create<BotJournalState>()(
  persist(
    (set, get) => ({
      sessions: [],
      sessionActiveId: null,

      ajouterSession: (session) => {
        set((state) => ({
          sessions: [session, ...state.sessions],
          sessionActiveId: session.id,
        }));
      },

      enregistrerRapportSimulation: (rapport, paire, timeframe) => {
        const nouvelleSession: SessionBacktestBot = {
          id: `bot-session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          botId: rapport.botId,
          botNom: rapport.botNom,
          dateExecution: new Date().toISOString(),
          paire,
          timeframe,
          totalBougies: rapport.periode.totalBougies,
          capitalInitial: rapport.capitalInitial,
          capitalFinal: rapport.capitalFinal,
          pnlNetMontant: rapport.pnlNetMontant,
          pnlNetPourcentage: rapport.pnlNetPourcentage,
          winratePourcentage: rapport.winratePourcentage,
          profitFactor: rapport.profitFactor,
          maxDrawdownPourcentage: rapport.maxDrawdownPourcentage,
          ratioRRMoyen: rapport.ratioRRMoyen,
          totalTrades: rapport.totalTrades,
          tradesGagnants: rapport.tradesGagnants,
          tradesPerdants: rapport.tradesPerdants,
          tradesBreakeven: rapport.tradesBreakeven,
          trades: rapport.trades,
          courbeEquity: rapport.courbeEquity,
        };

        set((state) => ({
          sessions: [nouvelleSession, ...state.sessions],
          sessionActiveId: nouvelleSession.id,
        }));

        return nouvelleSession;
      },

      supprimerSession: (sessionId) => {
        set((state) => {
          const sessionsFiltrees = state.sessions.filter((s) => s.id !== sessionId);
          const nouvelleActive = state.sessionActiveId === sessionId
            ? (sessionsFiltrees[0]?.id ?? null)
            : state.sessionActiveId;
          return {
            sessions: sessionsFiltrees,
            sessionActiveId: nouvelleActive,
          };
        });
      },

      effacerToutesLesSessions: () => {
        set({ sessions: [], sessionActiveId: null });
      },

      selectionnerSession: (sessionId) => {
        set({ sessionActiveId: sessionId });
      },
    }),
    {
      name: 'tradelog_bot_journal_store_v1',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
