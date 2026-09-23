import type { TradeWithSteps } from '@/types';
import type { ContexteRestaurationReplay } from '@/store/backtestStore';

/**
 * Extrait et reconstitue le contexte complet de Replay pour n'importe quel trade enregistré en base.
 * 
 * Cette fonction est rétrocompatible : elle fonctionne aussi bien pour :
 * 1. Les trades créés depuis le Studio Backtest (qui ont un `backtest_context` complet)
 * 2. Les trades plus anciens ou créés manuellement dans le Journal (reconstitution intelligente)
 * 
 * Exemple d'utilisation :
 * const contexte = extraireContexteReplay(trade);
 * if (contexte) {
 *   lancerRestaurationContexte(contexte);
 * }
 */
export function extraireContexteReplay(trade: TradeWithSteps | null | undefined): ContexteRestaurationReplay | null {
  if (!trade) return null;

  // 1️⃣ Extraction et normalisation de la Paire Forex / Actif
  // Ex: 'EUR/USD' ou 'eurusd' -> 'EURUSD'
  const paireBrute = trade.backtest_context?.pair || trade.pair || 'EURUSD';
  const pair = String(paireBrute).replace(/[\/\-_]/g, '').toUpperCase();

  // 2️⃣ Extraction de l'Année
  let annee = trade.backtest_context?.annee;
  if (!annee && trade.date_backtested) {
    const match = String(trade.date_backtested).match(/^(\d{4})/);
    if (match) annee = match[1];
  }
  if (!annee) {
    annee = String(new Date().getFullYear());
  }

  // 3️⃣ Extraction du Timeframe d'entrée
  const entryStep = trade.steps?.find((s) => s.type === 'entry');
  const timeframe = trade.backtest_context?.timeframe || entryStep?.timeframe || 'H1';

  // 4️⃣ Extraction ou calcul précis du Timestamp UNIX (en secondes)
  let timestamp: number | null = null;
  if (trade.backtest_context?.timestamp && typeof trade.backtest_context.timestamp === 'number') {
    timestamp = trade.backtest_context.timestamp;
  } else if (trade.date_backtested) {
    // Calcul à partir de date_backtested (ex: '2024-05-14') et entry_time (ex: '14:30')
    const datePart = String(trade.date_backtested).split('T')[0];
    let heurePart = '09:00:00'; // Heure par défaut (session de Londres)

    if (trade.entry_time) {
      const heureNettoyee = String(trade.entry_time).trim();
      if (/^\d{1,2}:\d{2}$/.test(heureNettoyee)) {
        heurePart = `${heureNettoyee}:00`;
      } else if (/^\d{1,2}:\d{2}:\d{2}$/.test(heureNettoyee)) {
        heurePart = heureNettoyee;
      }
    }

    const isoStr = `${datePart}T${heurePart}Z`;
    const ms = Date.parse(isoStr);
    if (!isNaN(ms)) {
      timestamp = Math.floor(ms / 1000);
    }
  }

  // Si impossible de déterminer le timestamp, on prend la date courante par défaut
  if (!timestamp) {
    timestamp = Math.floor(Date.now() / 1000);
  }

  // 5️⃣ Extraction des Niveaux de Prix (Position : Entrée, SL, TP)
  const entryFields = (entryStep?.fields || {}) as Record<string, unknown>;
  
  let prixEntree: number | null = null;
  let stopLoss: number | null = null;
  let takeProfit: number | null = null;

  // Lecture depuis entry.fields (standard Supabase)
  if (entryFields.price != null && !isNaN(Number(entryFields.price))) {
    prixEntree = parseFloat(String(entryFields.price));
  }
  if (entryFields.sl != null && !isNaN(Number(entryFields.sl))) {
    stopLoss = parseFloat(String(entryFields.sl));
  }
  if (entryFields.tp != null && !isNaN(Number(entryFields.tp))) {
    takeProfit = parseFloat(String(entryFields.tp));
  }

  // Secours : lecture depuis backtest_context si déjà stocké
  if (prixEntree === null && trade.backtest_context?.prixEntree != null) {
    prixEntree = parseFloat(String(trade.backtest_context.prixEntree));
  }
  if (stopLoss === null && trade.backtest_context?.stopLoss != null) {
    stopLoss = parseFloat(String(trade.backtest_context.stopLoss));
  }
  if (takeProfit === null && trade.backtest_context?.takeProfit != null) {
    takeProfit = parseFloat(String(trade.backtest_context.takeProfit));
  }

  // 6️⃣ Durée estimée en bougies et largeur visuelle
  const dureeBougies = trade.duree_estimee_bougies || (trade.duree_reelle_bougies ? trade.duree_reelle_bougies : 12);
  const largeur = Math.max(25, dureeBougies + 8);

  const direction: 'long' | 'short' = trade.direction === 'short' ? 'short' : 'long';

  // Si on a un prix d'entrée mais pas de SL/TP, on propose une projection proportionnelle
  if (prixEntree !== null && (stopLoss === null || takeProfit === null)) {
    const deltaDefaut = prixEntree * 0.002; // 0.2% par défaut si absent
    if (stopLoss === null) {
      stopLoss = direction === 'long' ? prixEntree - deltaDefaut : prixEntree + deltaDefaut;
    }
    if (takeProfit === null) {
      takeProfit = direction === 'long' ? prixEntree + deltaDefaut * 2 : prixEntree - deltaDefaut * 2;
    }
  }

  // 7️⃣ Construction de l'objet final
  return {
    pair,
    annee,
    timeframe,
    timestamp,
    position: prixEntree !== null && stopLoss !== null && takeProfit !== null ? {
      direction,
      prixEntree,
      stopLoss,
      takeProfit,
      dureeEstimeeBougies: dureeBougies,
      dureeEstimeeHeures: trade.duree_estimee_heures || undefined,
      dureeEstimeeLargeur: largeur,
      tradeIdSupabase: trade.id,
    } : undefined,
  };
}
