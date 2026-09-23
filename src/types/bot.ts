import type { Bougie } from '@/lib/chartDataHelper';
import type { ResultatLuxAlgoSMC } from '@/lib/indicators/luxAlgoSMC';
import type { ProtectedSwingsResultat } from '@/lib/indicators/protectedSwings';
import type { ResultatZigZag } from '@/lib/indicators/zigzag';
import type { ResultatUVP } from '@/lib/indicators/unmitigatedVolumeProfile';

import type { VariableExterneDef } from '@/types/indicatorScript';

/**
 * Représente un bot de trading scriptable stocké dans l'application.
 * 
 * Exemple :
 * const monBot: TradingBot = {
 *   id: 'smc-retest-v1',
 *   nom: 'SMC Retest Bot',
 *   code: 'return { onBar: ({ bougie }) => null };',
 *   parametres: { risque: 1.0 }
 * };
 */
export interface TradingBot {
  id: string;
  nom: string;
  description: string;
  auteur?: string;
  version?: string;
  code: string; // Code source JavaScript exécutable
  parametres: Record<string, number | string | boolean>;
  // Définitions des variables externes éditables visuellement par l'utilisateur
  definitionsVariables?: VariableExterneDef[];
  actif: boolean;
  creeLe: string;
  misAJourLe: string;
}

/**
 * Données télémétriques et techniques transmises au bot à chaque nouvelle bougie.
 */
export interface BotContext {
  // Bougie en cours d'évaluation
  bougie: Bougie;
  // Position dans l'historique
  index: number;
  // Fenêtre des dernières bougies (par défaut les 100 dernières)
  historique: Bougie[];
  // Indicateurs techniques calculés et synchronisés
  indicateurs: {
    smc: ResultatLuxAlgoSMC | null;
    swings: ProtectedSwingsResultat | null;
    zigzag: ResultatZigZag | null;
    uvp: ResultatUVP | null;
    // Données générées par les indicateurs scriptables personnalisés
    scripts?: Record<string, any>;
    [cle: string]: any;
  };
  // Position active en cours (ou null si aucune position ouverte)
  positionActive: {
    direction: 'long' | 'short';
    prixEntree: number;
    stopLoss: number;
    takeProfit: number;
    dureeBougies: number;
    pnlFlottant: number;
  } | null;
  // État du capital du compte
  compte: {
    capitalInitial: number;
    capitalActuel: number;
    tradesEffectues: number;
  };
  // Paramètres personnalisés définis par l'utilisateur
  parametres: Record<string, number | string | boolean>;
}

/**
 * Ordre de décision retourné par le bot lors de l'appel à onBar().
 */
export interface BotDecision {
  action: 'BUY' | 'SELL' | 'CLOSE';
  prixEntree?: number;
  stopLoss?: number;
  takeProfit?: number;
  commentaire?: string;
}

/**
 * Détail d'un trade simulé exécuté par le bot.
 */
export interface TradeBotSimule {
  id: string;
  direction: 'long' | 'short';
  indexEntree: number;
  dateEntree: string;
  prixEntree: number;
  indexSortie: number;
  dateSortie: string;
  prixSortie: number;
  stopLoss: number;
  takeProfit: number;
  resultat: 'win' | 'loss' | 'breakeven';
  pnlMontant: number;
  pnlPourcentage: number;
  ratioRR: number;
  dureeBougies: number;
  commentaire?: string;
}

/**
 * Rapport statistique complet généré après un backtest batch.
 */
export interface RapportPerformance {
  botId: string;
  botNom: string;
  periode: {
    debut: string;
    fin: string;
    totalBougies: number;
  };
  capitalInitial: number;
  capitalFinal: number;
  pnlNetMontant: number;
  pnlNetPourcentage: number;
  totalTrades: number;
  tradesGagnants: number;
  tradesPerdants: number;
  tradesBreakeven: number;
  winratePourcentage: number;
  profitFactor: number;
  maxDrawdownPourcentage: number;
  ratioRRMoyen: number;
  courbeEquity: Array<{
    date: string;
    capital: number;
  }>;
  trades: TradeBotSimule[];
}
