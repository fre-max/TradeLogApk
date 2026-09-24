import type { TradeWithSteps } from '@/types';
import { exporterEtTelechargerFichier } from '@/lib/telechargementFichier';

/**
 * Structure d'un trade formaté pour l'automatisation dans MetaTrader 5.
 * Ces données permettent à un script MQL5 ou Python MT5 de se positionner
 * automatiquement sur le graphique à l'instant T et de faire une capture d'écran.
 */
export interface TradeExportMT5 {
  // Identifiant unique du trade (utilisé pour nommer l'image de capture)
  id: string;
  // Paire de devises sans caractères spéciaux (ex: "EURUSD", "GBPUSD", "XAUUSD")
  symbole: string;
  // Timeframe d'entrée (ex: "M5", "M15", "H1")
  timeframe: string;
  // Date et heure au format standard MetaTrader "YYYY.MM.DD HH:MM:SS"
  date_heure: string;
  // Timestamp Unix en secondes (compris nativement par les fonctions datetime MT5)
  timestamp_unix: number;
  // Sens de la position : BUY pour un long, SELL pour un short
  direction: 'BUY' | 'SELL';
  // Nom du setup ou de la stratégie identifiée
  setup: string;
  // Prix d'exécution de l'entrée
  prix_entree: number;
  // Niveau de Stop Loss
  stop_loss: number;
  // Niveau de Take Profit
  take_profit: number;
  // Ratio Risque / Rendement
  ratio_rr: number;
  // Résultat du trade (win, loss, breakeven, inconnu)
  resultat: string;
  // Session de trading (London, NY, Asian)
  session: string;
  // Nombre de bougies d'historique à afficher dans la fenêtre de capture (par défaut 80)
  nb_bougies_visibles: number;
}

/**
 * Nettoie et standardise le nom du symbole pour MetaTrader (ex: "EUR/USD" -> "EURUSD").
 */
function standardiserSymbole(paire: string): string {
  if (!paire) return 'EURUSD';
  return paire.replace(/[\/\-_]/g, '').trim().toUpperCase();
}

/**
 * Nettoie et standardise l'unité de temps pour MT5 (ex: "5m" ou "5" -> "M5").
 */
function standardiserTimeframe(tf?: string | null): string {
  if (!tf) return 'M5';
  const tfMaj = tf.trim().toUpperCase();
  if (tfMaj.startsWith('M') || tfMaj.startsWith('H') || tfMaj.startsWith('D')) {
    return tfMaj;
  }
  // Si c'est un simple chiffre (ex: "5" -> "M5", "60" -> "H1")
  if (tfMaj === '1') return 'M1';
  if (tfMaj === '5') return 'M5';
  if (tfMaj === '15') return 'M15';
  if (tfMaj === '30') return 'M30';
  if (tfMaj === '60') return 'H1';
  if (tfMaj === '240') return 'H4';
  if (tfMaj === '1440') return 'D1';
  return tfMaj;
}

/**
 * Formate les dates et extrait le timestamp UNIX en secondes.
 */
function extraireDateEtTimestamp(trade: TradeWithSteps): { dateMT5: string; timestampUnix: number } {
  // 1️⃣ Si un timestamp précis existe dans le contexte de backtest
  const rawTs = trade.backtest_context?.timestamp ?? (trade as any).timestamp;
  if (rawTs && typeof rawTs === 'number') {
    // Si le timestamp est en millisecondes (> 10 chiffres), on le ramène en secondes
    const tsSecondes = rawTs > 10000000000 ? Math.floor(rawTs / 1000) : Math.floor(rawTs);
    const dateObj = new Date(tsSecondes * 1000);
    if (!isNaN(dateObj.getTime())) {
      const dateMT5 = dateObj.toISOString().replace('T', ' ').substring(0, 19).replace(/-/g, '.');
      return { dateMT5, timestampUnix: tsSecondes };
    }
  }

  // 2️⃣ Recherche de la date : date_backtested, puis created_at, puis date du jour
  const rawDate = trade.date_backtested || trade.created_at;
  const dateStr = rawDate ? String(rawDate).split('T')[0] : '2024-01-01';

  // 3️⃣ Recherche de l'heure : entry_time, puis created_at, puis étape entry
  const entryStep = trade.steps?.find((s) => s.type === 'entry');
  const entryFields = (entryStep?.fields ?? {}) as Record<string, unknown>;
  const heureBrute = trade.entry_time || (entryFields.time as string) || (trade.created_at ? String(trade.created_at).split('T')[1] : null);

  let heureStr = '09:00:00'; // Heure par défaut
  if (heureBrute) {
    const nettoye = String(heureBrute).replace('Z', '').trim();
    const parties = nettoye.split(':');
    if (parties.length >= 2) {
      const h = parties[0].padStart(2, '0');
      const m = parties[1].padStart(2, '0');
      const s = parties[2] ? parties[2].split('.')[0].padStart(2, '0') : '00';
      heureStr = `${h}:${m}:${s}`;
    }
  }

  // Calcul du timestamp UNIX normalisé en secondes
  const ms = Date.parse(`${dateStr}T${heureStr}Z`);
  const timestampUnix = !isNaN(ms) ? Math.floor(ms / 1000) : Math.floor(Date.now() / 1000);
  const dateMT5 = `${dateStr.replace(/-/g, '.')} ${heureStr}`;

  return { dateMT5, timestampUnix };
}

/**
 * Transforme la liste des trades de l'application en objets standardisés pour MetaTrader 5.
 * 
 * Exemple :
 * const tradesMT5 = convertirTradesPourMT5(trades);
 * console.log(`Prêts pour MT5 : ${tradesMT5.length} trades`);
 */
export function convertirTradesPourMT5(trades: TradeWithSteps[]): TradeExportMT5[] {
  return trades.map((trade, index) => {
    // 1️⃣ Recherche des étapes disponibles pour extraire les détails
    const entryStep = trade.steps?.find((s) => s.type === 'entry');
    const poiStep = trade.steps?.find((s) => s.type === 'poi');
    const biaisStep = trade.steps?.find((s) => s.type === 'biais');
    const entryFields = (entryStep?.fields ?? {}) as Record<string, unknown>;

    // 2️⃣ Symbol et Timeframe
    const symbole = standardiserSymbole(trade.pair);
    const rawTf = (entryStep?.timeframe as string) || trade.backtest_context?.timeframe || 'M5';
    const timeframe = standardiserTimeframe(rawTf);

    // 3️⃣ Date et Timestamp
    const { dateMT5, timestampUnix } = extraireDateEtTimestamp(trade);

    // 4️⃣ Niveaux de prix avec fallbacks complets (étape, champs directs du trade ou contexte backtest)
    const tradeAny = trade as any;
    const prixEntree = parseFloat(String(entryFields.price ?? tradeAny.entry_price ?? trade.backtest_context?.prixEntree ?? 0)) || 0;
    const stopLoss = parseFloat(String(entryFields.sl ?? tradeAny.entry_sl ?? trade.backtest_context?.stopLoss ?? 0)) || 0;
    const takeProfit = parseFloat(String(entryFields.tp ?? tradeAny.entry_tp ?? trade.backtest_context?.takeProfit ?? 0)) || 0;

    // 5️⃣ Ratio Risque/Rendement
    const ratioRR = trade.rr_realized ?? trade.rr_planned ?? 0;

    // 6️⃣ Nom du setup
    const nomSetup = String(
      entryFields.setup ??
      poiStep?.title ??
      biaisStep?.title ??
      'Setup Discrétionnaire'
    );

    // 7️⃣ Direction normalisée (BUY / SELL)
    const dirBrute = String(trade.direction || '').toLowerCase();
    const direction: 'BUY' | 'SELL' = (dirBrute === 'short' || dirBrute === 'sell') ? 'SELL' : 'BUY';

    // 8️⃣ Session de trading
    const session = trade.session || (entryFields.session as string) || (trade.backtest_context?.session as string) || 'London';

    return {
      id: trade.id ? trade.id : `trade_${index + 1}`,
      symbole,
      timeframe,
      date_heure: dateMT5,
      timestamp_unix: timestampUnix,
      direction,
      setup: nomSetup,
      prix_entree: prixEntree,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      ratio_rr: Number(ratioRR.toFixed(2)),
      resultat: trade.result ?? 'inconnu',
      session,
      nb_bougies_visibles: 80,
    };
  });
}

/**
 * Génère le fichier JSON formaté et déclenche son téléchargement ou partage sur mobile/web.
 * 
 * Exemple :
 * await exporterTradesPourMT5Json(trades);
 */
export async function exporterTradesPourMT5Json(trades: TradeWithSteps[]): Promise<{ succes: boolean; message: string }> {
  // 1️⃣ Vérification
  if (!trades || trades.length === 0) {
    throw new Error('Aucun trade disponible à exporter.');
  }

  // 2️⃣ Conversion des données
  const donneesMT5 = convertirTradesPourMT5(trades);

  // 3️⃣ Sérialisation JSON avec indentation propre pour faciliter la lecture humaine et le parsing
  const contenuJson = JSON.stringify(donneesMT5, null, 2);

  // 4️⃣ Téléchargement universel (Android APK ou Web)
  const dateJour = new Date().toISOString().split('T')[0];
  const nomFichier = `trades_mt5_dataset_${dateJour}.json`;

  const resultat = await exporterEtTelechargerFichier(
    nomFichier,
    contenuJson,
    'application/json;charset=utf-8;'
  );

  console.log(`✅ [Export MT5] ${donneesMT5.length} trades exportés. Résultat :`, resultat.message);
  return resultat;
}
