import type { TradeWithSteps } from '@/types';

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
  // 1️⃣ Si un timestamp précis existe déjà dans le contexte de backtest
  if (trade.backtest_context?.timestamp && typeof trade.backtest_context.timestamp === 'number') {
    const ts = trade.backtest_context.timestamp;
    const dateObj = new Date(ts * 1000);
    const dateMT5 = dateObj.toISOString().replace('T', ' ').substring(0, 19).replace(/-/g, '.');
    return { dateMT5, timestampUnix: ts };
  }

  // 2️⃣ Sinon, reconstruction à partir de date_backtested et entry_time
  const dateStr = trade.date_backtested ? String(trade.date_backtested).split('T')[0] : '2024-01-01';
  let heureStr = '09:00:00'; // Heure par défaut (session de Londres)

  if (trade.entry_time) {
    const heureNettoyee = String(trade.entry_time).trim();
    const parties = heureNettoyee.split(':');
    if (parties.length >= 2) {
      const h = parties[0].padStart(2, '0');
      const m = parties[1].padStart(2, '0');
      const s = parties[2] ? parties[2].padStart(2, '0') : '00';
      heureStr = `${h}:${m}:${s}`;
    }
  }

  // Calcul du timestamp UNIX (en secondes)
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
    // Étape d'entrée (entry) contenant les niveaux de prix réels
    const entryStep = trade.steps?.find((s) => s.type === 'entry');
    const entryFields = (entryStep?.fields ?? {}) as Record<string, unknown>;

    // Symbol et Timeframe
    const symbole = standardiserSymbole(trade.pair);
    const rawTf = (entryStep?.timeframe as string) || trade.backtest_context?.timeframe || 'M5';
    const timeframe = standardiserTimeframe(rawTf);

    // Date et Timestamp
    const { dateMT5, timestampUnix } = extraireDateEtTimestamp(trade);

    // Niveaux de prix (Entrée, SL, TP)
    const prixEntree = parseFloat(String(entryFields.price ?? 0)) || 0;
    const stopLoss = parseFloat(String(entryFields.sl ?? 0)) || 0;
    const takeProfit = parseFloat(String(entryFields.tp ?? 0)) || 0;

    // Calcul du RR réalisé ou prévu
    const ratioRR = trade.rr_realized ?? trade.rr_planned ?? 0;

    // Nom du setup
    const nomSetup = String(entryFields.setup ?? trade.steps?.find((s) => s.type === 'poi')?.title ?? 'Setup Discrétionnaire');

    // Direction normalisée (BUY / SELL)
    const direction = trade.direction === 'short' ? 'SELL' : 'BUY';

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
      session: trade.session ?? 'London',
      nb_bougies_visibles: 80,
    };
  });
}

/**
 * Génère le fichier JSON formaté et déclenche son téléchargement dans le navigateur.
 * 
 * Exemple :
 * exporterTradesPourMT5Json(trades);
 */
export function exporterTradesPourMT5Json(trades: TradeWithSteps[]): void {
  // 1️⃣ Vérification
  if (!trades || trades.length === 0) {
    throw new Error('Aucun trade disponible à exporter.');
  }

  // 2️⃣ Conversion des données
  const donneesMT5 = convertirTradesPourMT5(trades);

  // 3️⃣ Sérialisation JSON avec indentation propre pour faciliter la lecture humaine et le parsing
  const contenuJson = JSON.stringify(donneesMT5, null, 2);

  // 4️⃣ Téléchargement du fichier
  const dateJour = new Date().toISOString().split('T')[0];
  const nomFichier = `trades_mt5_dataset_${dateJour}.json`;

  const blob = new Blob([contenuJson], { type: 'application/json;charset=utf-8;' });
  const urlBlob = URL.createObjectURL(blob);

  const lien = document.createElement('a');
  lien.href = urlBlob;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);

  // Nettoyage de l'URL objet en mémoire
  URL.revokeObjectURL(urlBlob);
  console.log(`✅ [Export MT5] ${donneesMT5.length} trades exportés vers ${nomFichier}`);
}
