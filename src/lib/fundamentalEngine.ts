import { MacroEvent, FundamentalSnapshot, CurrencyMacroState } from '../types/fundamental';

/**
 * Calcule le score individuel d'un événement économique (-3 à +3)
 * en fonction de l'écart entre le chiffre réel (actual) et les prévisions (forecast).
 * 
 * Exemple :
 * const score = calculateEventScore('inflation', 3.2, 3.1, 3); // Retourne +3 (Inflation > Prévision = Bullish USD)
 */
export function calculateEventScore(
  category: string,
  actual: number,
  forecast: number,
  impactWeight: number = 1
): number {
  const cat = (category || '').toLowerCase();
  
  // Pour le chômage, un chiffre réel plus élevé que la prévision est MAUVAIS pour la monnaie (-1)
  // Pour l'inflation, les taux et le PIB, un chiffre plus élevé est BON pour la monnaie (+1)
  const isNegativeCategory = cat.includes('unemployment') || cat.includes('jobless') || cat.includes('chomage');
  const polarity = isNegativeCategory ? -1 : 1;

  const weight = Math.max(1, Math.min(3, Math.abs(impactWeight)));
  
  if (actual > forecast) {
    return 1 * polarity * weight;
  } else if (actual < forecast) {
    return -1 * polarity * weight;
  }
  
  return 0;
}

/**
 * Analyse une ligne CSV et la transforme en timestamp Unix en millisecondes
 * Exemple de date supportée : "2024-03-12 12:30:00" ou "2024-03-12"
 */
export function parseDateToTimestamp(dateStr: string): number {
  if (!dateStr) return 0;
  const cleanStr = dateStr.trim().replace(' ', 'T');
  const timestamp = Date.parse(cleanStr);
  return isNaN(timestamp) ? 0 : timestamp;
}

/**
 * Importe et transforme une chaîne de texte au format CSV en une liste d'événements MacroEvent
 * 
 * Format CSV attendu :
 * date,asset,event,category,actual,forecast,previous,impact_weight
 * 2024-03-12 12:30:00,USD,CPI YoY,inflation,3.2,3.1,3.1,3
 * 
 * Exemple d'utilisation :
 * const events = parseMacroCSV(csvContent);
 * console.log(events.length); // Nombre d'événements chargés
 */
export function parseMacroCSV(csvText: string): MacroEvent[] {
  if (!csvText || typeof csvText !== 'string') return [];

  const lines = csvText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length < 2) return [];

  // Lecture de l'en-tête pour repérer l'ordre des colonnes
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
  
  const colIndex = {
    date: headers.indexOf('date'),
    asset: headers.indexOf('asset'),
    event: headers.indexOf('event'),
    category: headers.indexOf('category'),
    actual: headers.indexOf('actual'),
    forecast: headers.indexOf('forecast'),
    previous: headers.indexOf('previous'),
    impact_weight: headers.indexOf('impact_weight'),
  };

  const parsedEvents: MacroEvent[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',').map(cell => cell.trim().replace(/"/g, ''));
    if (row.length < 4) continue;

    const dateVal = colIndex.date >= 0 ? row[colIndex.date] : row[0];
    const assetVal = colIndex.asset >= 0 ? row[colIndex.asset] : row[1];
    const eventVal = colIndex.event >= 0 ? row[colIndex.event] : row[2];
    const categoryVal = colIndex.category >= 0 ? row[colIndex.category] : (row[3] || 'other');
    const actualVal = parseFloat(colIndex.actual >= 0 ? row[colIndex.actual] : row[4]) || 0;
    const forecastVal = parseFloat(colIndex.forecast >= 0 ? row[colIndex.forecast] : row[5]) || 0;
    const previousVal = parseFloat(colIndex.previous >= 0 ? row[colIndex.previous] : row[6]) || 0;
    const impactWeightVal = parseInt(colIndex.impact_weight >= 0 ? row[colIndex.impact_weight] : row[7], 10) || 1;

    const timestamp = parseDateToTimestamp(dateVal);
    if (!timestamp || !assetVal) continue;

    const score = calculateEventScore(categoryVal, actualVal, forecastVal, impactWeightVal);

    parsedEvents.push({
      id: `macro-${assetVal}-${timestamp}-${i}`,
      date: dateVal,
      timestamp,
      asset: assetVal.toUpperCase(),
      event: eventVal,
      category: categoryVal.toLowerCase(),
      actual: actualVal,
      forecast: forecastVal,
      previous: previousVal,
      impact_weight: impactWeightVal,
      score,
    });
  }

  // Tri chrono croissant
  return parsedEvents.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Découpe une paire de devises (ex: "EURUSD" ou "EUR/USD") en devise de base et de contrepartie
 */
export function extractAssetsFromPair(pair: string): { baseAsset: string; quoteAsset: string } {
  const cleanPair = (pair || '').replace('/', '').toUpperCase();
  if (cleanPair.length >= 6) {
    return {
      baseAsset: cleanPair.slice(0, 3),
      quoteAsset: cleanPair.slice(3, 6),
    };
  }
  return { baseAsset: 'EUR', quoteAsset: 'USD' };
}

/**
 * Calcule le snapshot de l'état fondamental à un instant T du Bar-Replay
 * en appliquant la règle d'expiration (Option A : le dernier événement par catégorie/nom remplace le précédent).
 * 
 * Exemple :
 * const snapshot = computeSnapshotAtTimestamp(allEvents, 'EURUSD', 1710246600000);
 * console.log(snapshot.biasLabel); // 'BULLISH', 'BEARISH' ou 'NEUTRAL'
 */
export function computeSnapshotAtTimestamp(
  events: MacroEvent[],
  pair: string,
  currentTimestamp: number
): FundamentalSnapshot {
  const { baseAsset, quoteAsset } = extractAssetsFromPair(pair);

  // Fonction d'extraction de l'état d'une monnaie à l'instant T
  const getCurrencyState = (asset: string): CurrencyMacroState => {
    // 1. Filtrer les événements de cette monnaie survenus jusqu'à l'instant T courant
    const pastEvents = events.filter(e => e.asset === asset && e.timestamp <= currentTimestamp);

    // 2. Option A : Remplacement strict -> ne conserver que la dernière publication pour chaque événement/catégorie
    const latestEventsMap = new Map<string, MacroEvent>();
    for (const ev of pastEvents) {
      const key = `${ev.category}-${ev.event}`;
      // Comme les événements sont triés par timestamp croissant, la dernière valeur écrase la précédente
      latestEventsMap.set(key, ev);
    }

    const activeEvents = Array.from(latestEventsMap.values());
    const totalScore = activeEvents.reduce((sum, ev) => sum + ev.score, 0);

    return {
      asset,
      totalScore,
      activeEvents,
    };
  };

  const baseState = getCurrencyState(baseAsset);
  const quoteState = getCurrencyState(quoteAsset);

  const netScore = baseState.totalScore - quoteState.totalScore;
  let biasLabel: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';

  if (netScore >= 0.5) {
    biasLabel = 'BULLISH';
  } else if (netScore <= -0.5) {
    biasLabel = 'BEARISH';
  }

  return {
    timestamp: currentTimestamp,
    baseAsset,
    quoteAsset,
    baseState,
    quoteState,
    netScore,
    biasLabel,
  };
}
