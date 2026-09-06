/**
 * Représente un événement ou indicateur macroéconomique individuel (ex: CPI, NFP, Taux directeurs)
 * 
 * Exemple d'utilisation :
 * const news: MacroEvent = {
 *   id: 'usd-cpi-2024-03-12',
 *   date: '2024-03-12 12:30:00',
 *   timestamp: 1710246600000,
 *   asset: 'USD',
 *   event: 'CPI YoY',
 *   category: 'inflation',
 *   actual: 3.2,
 *   forecast: 3.1,
 *   previous: 3.1,
 *   impact_weight: 3,
 *   score: 3
 * };
 */
export interface MacroEvent {
  id: string;
  date: string;
  timestamp: number;
  asset: string;
  event: string;
  category: string;
  actual: number;
  forecast: number;
  previous: number;
  impact_weight: number;
  score: number;
}

/**
 * État macroéconomique résumé pour une devise donnée (ex: EUR ou USD) à une date fixe
 */
export interface CurrencyMacroState {
  asset: string;
  totalScore: number;
  activeEvents: MacroEvent[];
}

/**
 * Snapshot macro global calculé à un instant T du Bar-Replay pour la paire sélectionnée
 */
export interface FundamentalSnapshot {
  timestamp: number;
  baseAsset: string;
  quoteAsset: string;
  baseState: CurrencyMacroState;
  quoteState: CurrencyMacroState;
  netScore: number;
  biasLabel: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}
