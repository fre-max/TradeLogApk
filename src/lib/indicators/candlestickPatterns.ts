import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLabel } from '@/types/indicatorScript';

/**
 * Options de configuration pour l'indicateur Candlesticks Patterns Identified (repo32)
 */
export interface ParametresCandlestickPatterns {
  // Taille relative du corps pour le Doji (ex: 0.05 = 5% de la hauteur totale)
  dojiSize?: number;
  // Active le filtre de tendance sur les barres précédentes (désactivé par défaut comme dans l'update 1-17-26)
  activerFiltreTendance?: boolean;
  // Nombre de barres pour évaluer la tendance si le filtre est actif
  trendBars?: number;
  // Couleur des motifs haussiers (défaut: vert néon #00E676)
  bullColor?: string;
  // Couleur des motifs baissiers (défaut: rouge vif #F23645)
  bearColor?: string;
  // Couleur du Doji (défaut: blanc #FFFFFF)
  dojiColor?: string;

  // Interrupteurs pour activer / désactiver chaque motif individuellement
  activerDoji?: boolean;
  activerBearishHarami?: boolean;
  activerBullishHarami?: boolean;
  activerBearishEngulfing?: boolean;
  activerBullishEngulfing?: boolean;
  activerPiercingLine?: boolean;
  activerBullishBelt?: boolean;
  activerBullishKicker?: boolean;
  activerBearishKicker?: boolean;
  activerHangingMan?: boolean;
  activerEveningStar?: boolean;
  activerMorningStar?: boolean;
  activerShootingStar?: boolean;
  activerHammer?: boolean;
  activerInvertedHammer?: boolean;
}

/**
 * Structure d'un motif détecté sur une bougie
 */
export interface MotifDetecte {
  nom: string;
  type: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  texteCourt: string;
  indexBougie: number;
  temps: number | string;
  prix: number;
  position: 'above' | 'below';
}

/**
 * Résultat complet retourné par le calcul des figures en chandeliers
 */
export interface ResultatCandlestickPatterns {
  motifs: MotifDetecte[];
  primitives: VisualPrimitives;
  statistiques: {
    totalMotifs: number;
    totalHaussiers: number;
    totalBaissiers: number;
    totalDojis: number;
  };
}

/**
 * Calcule l'ensemble des figures chartistes en chandeliers japonais
 * selon l'algorithme exact de l'indicateur TradingView "Candlesticks Patterns Identified (update 1-17-26) by repo32".
 * 
 * Détecte les 15 figures majeures :
 * 1. Doji
 * 2. Bearish Harami
 * 3. Bullish Harami
 * 4. Bearish Engulfing
 * 5. Bullish Engulfing
 * 6. Piercing Line (Ligne Pénétrante)
 * 7. Bullish Belt (Ceinture Haussière)
 * 8. Bullish Kicker
 * 9. Bearish Kicker
 * 10. Hanging Man (Pendu)
 * 11. Evening Star (Étoile du Soir)
 * 12. Morning Star (Étoile du Matin)
 * 13. Shooting Star (Étoile Filante)
 * 14. Hammer (Marteau, affiché "H")
 * 15. Inverted Hammer (Marteau Inversé, affiché "IH")
 * 
 * Exemple :
 * const res = calculerCandlestickPatterns(bougies, { dojiSize: 0.05, activerFiltreTendance: false });
 * console.log(res.motifs.length); // Nombre total de motifs détectés
 */
export function calculerCandlestickPatterns(
  bougies: Bougie[],
  options?: ParametresCandlestickPatterns
): ResultatCandlestickPatterns {
  // 1️⃣ Vérification minimale des données
  if (!bougies || bougies.length < 2) {
    return {
      motifs: [],
      primitives: { labels: [] },
      statistiques: { totalMotifs: 0, totalHaussiers: 0, totalBaissiers: 0, totalDojis: 0 },
    };
  }

  // 2️⃣ Extraction des paramètres avec valeurs par défaut de repo32
  const params = options || {};
  const dojiSize = Number(params.dojiSize !== undefined ? params.dojiSize : 0.05);
  const activerFiltreTendance = Boolean(params.activerFiltreTendance);
  const trendBars = Math.max(1, Number(params.trendBars !== undefined ? params.trendBars : 5));
  const bullColor = params.bullColor || '#00E676';
  const bearColor = params.bearColor || '#F23645';
  const dojiColor = params.dojiColor || '#FFFFFF';

  // Filtres d'activation par motif (tous activés par défaut dans l'update 1-17-26)
  const actDoji = params.activerDoji !== false;
  const actBearHarami = params.activerBearishHarami !== false;
  const actBullHarami = params.activerBullishHarami !== false;
  const actBearEngulf = params.activerBearishEngulfing !== false;
  const actBullEngulf = params.activerBullishEngulfing !== false;
  const actPiercing = params.activerPiercingLine !== false;
  const actBullBelt = params.activerBullishBelt !== false;
  const actBullKicker = params.activerBullishKicker !== false;
  const actBearKicker = params.activerBearishKicker !== false;
  const actHangingMan = params.activerHangingMan !== false;
  const actEveningStar = params.activerEveningStar !== false;
  const actMorningStar = params.activerMorningStar !== false;
  const actShootingStar = params.activerShootingStar !== false;
  const actHammer = params.activerHammer !== false;
  const actInvertedHammer = params.activerInvertedHammer !== false;

  const motifsDetectes: MotifDetecte[] = [];
  const labelsVisuels: VisualLabel[] = [];

  // Compteurs pour les statistiques
  let countHaussiers = 0;
  let countBaissiers = 0;
  let countDojis = 0;

  // 3️⃣ Parcours linéaire des bougies historiques
  for (let i = 0; i < bougies.length; i++) {
    const cActuelle = bougies[i];
    const open = cActuelle.open;
    const high = cActuelle.high;
    const low = cActuelle.low;
    const close = cActuelle.close;
    const range = high - low;
    const corps = Math.abs(open - close);

    // Bougie précédente (i - 1)
    const aPrecedente = i >= 1;
    const cPrec = aPrecedente ? bougies[i - 1] : null;
    const open1 = cPrec ? cPrec.open : open;
    const close1 = cPrec ? cPrec.close : close;
    const high1 = cPrec ? cPrec.high : high;
    const low1 = cPrec ? cPrec.low : low;

    // Bougie il y a 2 barres (i - 2)
    const aDeuxPrecedentes = i >= 2;
    const cPrec2 = aDeuxPrecedentes ? bougies[i - 2] : null;
    const open2 = cPrec2 ? cPrec2.open : open;
    const close2 = cPrec2 ? cPrec2.close : close;
    const high2 = cPrec2 ? cPrec2.high : high;

    // Bougie il y a 'trendBars' barres (pour le filtre de tendance historique)
    const indexTendance = Math.max(0, i - trendBars);
    const cTrend = bougies[indexTendance];
    const openTrend = cTrend.open;

    // Conditions de tendance haussière ou baissière (désactivées ou vraies selon paramètre)
    const tendanceHausse = !activerFiltreTendance || openTrend < open;
    const tendanceBaisse = !activerFiltreTendance || openTrend > open;

    // --------------------------------------------------------------------------
    // 1. DOJI
    // Formule : abs(open - close) <= (high - low) * DojiSize
    // --------------------------------------------------------------------------
    if (actDoji && range > 0 && corps <= range * dojiSize) {
      motifsDetectes.push({
        nom: 'Doji',
        type: 'NEUTRAL',
        texteCourt: 'Doji',
        indexBougie: i,
        temps: cActuelle.time,
        prix: high,
        position: 'above',
      });
      labelsVisuels.push({
        id: `doji-${i}`,
        prix: high,
        date: cActuelle.time,
        texte: 'Doji',
        couleur: dojiColor,
        position: 'above',
      });
      countDojis++;
    }

    // Si nous n'avons pas au moins une bougie précédente, les figures comparatives ne peuvent pas être évaluées
    if (!aPrecedente || !cPrec) continue;

    // --------------------------------------------------------------------------
    // 2. BEARISH HARAMI
    // Formule : close[1] > open[1] and open > close and open <= close[1] and open[1] <= close and open - close < close[1] - open[1]
    // --------------------------------------------------------------------------
    const estBearishHarami =
      close1 > open1 &&
      open > close &&
      open <= close1 &&
      open1 <= close &&
      (open - close) < (close1 - open1) &&
      tendanceHausse;

    if (actBearHarami && estBearishHarami) {
      motifsDetectes.push({
        nom: 'Bearish Harami',
        type: 'BEARISH',
        texteCourt: 'Harami',
        indexBougie: i,
        temps: cActuelle.time,
        prix: high,
        position: 'above',
      });
      labelsVisuels.push({
        id: `bear-harami-${i}`,
        prix: high,
        date: cActuelle.time,
        texte: 'Bearish\nHarami',
        couleur: bearColor,
        position: 'above',
      });
      countBaissiers++;
    }

    // --------------------------------------------------------------------------
    // 3. BULLISH HARAMI
    // Formule : open[1] > close[1] and close > open and close <= open[1] and close[1] <= open and close - open < open[1] - close[1]
    // --------------------------------------------------------------------------
    const estBullishHarami =
      open1 > close1 &&
      close > open &&
      close <= open1 &&
      close1 <= open &&
      (close - open) < (open1 - close1) &&
      tendanceBaisse;

    if (actBullHarami && estBullishHarami) {
      motifsDetectes.push({
        nom: 'Bullish Harami',
        type: 'BULLISH',
        texteCourt: 'Harami',
        indexBougie: i,
        temps: cActuelle.time,
        prix: low,
        position: 'below',
      });
      labelsVisuels.push({
        id: `bull-harami-${i}`,
        prix: low,
        date: cActuelle.time,
        texte: 'Bullish\nHarami',
        couleur: bullColor,
        position: 'below',
      });
      countHaussiers++;
    }

    // --------------------------------------------------------------------------
    // 4. BEARISH ENGULFING (Avalement Baissier)
    // Formule : close[1] > open[1] and open > close and open >= close[1] and open[1] >= close and open - close > close[1] - open[1]
    // --------------------------------------------------------------------------
    const estBearishEngulfing =
      close1 > open1 &&
      open > close &&
      open >= close1 &&
      open1 >= close &&
      (open - close) > (close1 - open1) &&
      tendanceHausse;

    if (actBearEngulf && estBearishEngulfing) {
      motifsDetectes.push({
        nom: 'Bearish Engulfing',
        type: 'BEARISH',
        texteCourt: 'Engulfing',
        indexBougie: i,
        temps: cActuelle.time,
        prix: high,
        position: 'above',
      });
      labelsVisuels.push({
        id: `bear-engulf-${i}`,
        prix: high,
        date: cActuelle.time,
        texte: 'Bearish\nEngulfing',
        couleur: bearColor,
        position: 'above',
      });
      countBaissiers++;
    }

    // --------------------------------------------------------------------------
    // 5. BULLISH ENGULFING (Avalement Haussier)
    // Formule : open[1] > close[1] and close > open and close >= open[1] and close[1] >= open and close - open > open[1] - close[1]
    // --------------------------------------------------------------------------
    const estBullishEngulfing =
      open1 > close1 &&
      close > open &&
      close >= open1 &&
      close1 >= open &&
      (close - open) > (open1 - close1) &&
      tendanceBaisse;

    if (actBullEngulf && estBullishEngulfing) {
      motifsDetectes.push({
        nom: 'Bullish Engulfing',
        type: 'BULLISH',
        texteCourt: 'Engulfing',
        indexBougie: i,
        temps: cActuelle.time,
        prix: low,
        position: 'below',
      });
      labelsVisuels.push({
        id: `bull-engulf-${i}`,
        prix: low,
        date: cActuelle.time,
        texte: 'Bullish\nEngulfing',
        couleur: bullColor,
        position: 'below',
      });
      countHaussiers++;
    }

    // --------------------------------------------------------------------------
    // 6. PIERCING LINE (Ligne Pénétrante)
    // Formule : close[1] < open[1] and open < low[1] and close > close[1] + ((open[1] - close[1])/2) and close < open[1]
    // --------------------------------------------------------------------------
    const estPiercingLine =
      close1 < open1 &&
      open < low1 &&
      close > (close1 + (open1 - close1) / 2) &&
      close < open1 &&
      tendanceBaisse;

    if (actPiercing && estPiercingLine) {
      motifsDetectes.push({
        nom: 'Piercing Line',
        type: 'BULLISH',
        texteCourt: 'Piercing',
        indexBougie: i,
        temps: cActuelle.time,
        prix: low,
        position: 'below',
      });
      labelsVisuels.push({
        id: `piercing-${i}`,
        prix: low,
        date: cActuelle.time,
        texte: 'Piercing\nLine',
        couleur: bullColor,
        position: 'below',
      });
      countHaussiers++;
    }

    // --------------------------------------------------------------------------
    // 7. BULLISH BELT (Ceinture Haussière)
    // Formule : low == open and open < lower and open < close and close > ((high[1] - low[1]) / 2) + low[1]
    // avec lower = lowest(10)[1]
    // --------------------------------------------------------------------------
    if (actBullBelt && i >= 10) {
      let min10 = bougies[i - 1].low;
      for (let k = 2; k <= 10; k++) {
        if (bougies[i - k].low < min10) min10 = bougies[i - k].low;
      }
      const lowQuasiEgalOpen = Math.abs(low - open) <= (range * 0.02 || 0.0001);
      const estBullishBelt =
        lowQuasiEgalOpen &&
        open < min10 &&
        open < close &&
        close > ((high1 - low1) / 2 + low1) &&
        tendanceBaisse;

      if (estBullishBelt) {
        motifsDetectes.push({
          nom: 'Bullish Belt',
          type: 'BULLISH',
          texteCourt: 'Belt',
          indexBougie: i,
          temps: cActuelle.time,
          prix: low,
          position: 'below',
        });
        labelsVisuels.push({
          id: `bull-belt-${i}`,
          prix: low,
          date: cActuelle.time,
          texte: 'Bullish\nBelt',
          couleur: bullColor,
          position: 'below',
        });
        countHaussiers++;
      }
    }

    // --------------------------------------------------------------------------
    // 8. BULLISH KICKER
    // Formule : open[1] > close[1] and open >= open[1] and close > open
    // --------------------------------------------------------------------------
    const estBullishKicker =
      open1 > close1 &&
      open >= open1 &&
      close > open &&
      tendanceBaisse;

    if (actBullKicker && estBullishKicker) {
      motifsDetectes.push({
        nom: 'Bullish Kicker',
        type: 'BULLISH',
        texteCourt: 'Kicker',
        indexBougie: i,
        temps: cActuelle.time,
        prix: low,
        position: 'below',
      });
      labelsVisuels.push({
        id: `bull-kicker-${i}`,
        prix: low,
        date: cActuelle.time,
        texte: 'Bullish\nKicker',
        couleur: bullColor,
        position: 'below',
      });
      countHaussiers++;
    }

    // --------------------------------------------------------------------------
    // 9. BEARISH KICKER
    // Formule : open[1] < close[1] and open <= open[1] and close <= open
    // --------------------------------------------------------------------------
    const estBearishKicker =
      open1 < close1 &&
      open <= open1 &&
      close <= open &&
      tendanceHausse;

    if (actBearKicker && estBearishKicker) {
      motifsDetectes.push({
        nom: 'Bearish Kicker',
        type: 'BEARISH',
        texteCourt: 'Kicker',
        indexBougie: i,
        temps: cActuelle.time,
        prix: high,
        position: 'above',
      });
      labelsVisuels.push({
        id: `bear-kicker-${i}`,
        prix: high,
        date: cActuelle.time,
        texte: 'Bearish\nKicker',
        couleur: bearColor,
        position: 'above',
      });
      countBaissiers++;
    }

    // --------------------------------------------------------------------------
    // 10. HANGING MAN (Pendu)
    // Formule : high - low > 4 * (open - close) et ratio >= 0.75 en sommet
    // --------------------------------------------------------------------------
    if (actHangingMan && aDeuxPrecedentes && cPrec2 && range > 0) {
      const denominateur = 0.001 + range;
      const ratioClose = (close - low) / denominateur;
      const ratioOpen = (open - low) / denominateur;
      const corpsVal = Math.abs(open - close);

      const estHangingMan =
        range > 4 * corpsVal &&
        ratioClose >= 0.75 &&
        ratioOpen >= 0.75 &&
        high1 < open &&
        high2 < open &&
        tendanceHausse;

      if (estHangingMan) {
        motifsDetectes.push({
          nom: 'Hanging Man',
          type: 'BEARISH',
          texteCourt: 'Hanging Man',
          indexBougie: i,
          temps: cActuelle.time,
          prix: high,
          position: 'above',
        });
        labelsVisuels.push({
          id: `hanging-${i}`,
          prix: high,
          date: cActuelle.time,
          texte: 'Hanging\nMan',
          couleur: bearColor,
          position: 'above',
        });
        countBaissiers++;
      }
    }

    // --------------------------------------------------------------------------
    // 11. EVENING STAR (Étoile du Soir)
    // Formule : close[2] > open[2] and min(open[1], close[1]) > close[2] and open < min(open[1], close[1]) and close < open
    // --------------------------------------------------------------------------
    if (actEveningStar && aDeuxPrecedentes && cPrec2) {
      const minCorps1 = Math.min(open1, close1);
      const estEveningStar =
        close2 > open2 &&
        minCorps1 > close2 &&
        open < minCorps1 &&
        close < open;

      if (estEveningStar) {
        motifsDetectes.push({
          nom: 'Evening Star',
          type: 'BEARISH',
          texteCourt: 'Evening Star',
          indexBougie: i,
          temps: cActuelle.time,
          prix: high,
          position: 'above',
        });
        labelsVisuels.push({
          id: `evening-star-${i}`,
          prix: high,
          date: cActuelle.time,
          texte: 'Evening\nStar',
          couleur: bearColor,
          position: 'above',
        });
        countBaissiers++;
      }
    }

    // --------------------------------------------------------------------------
    // 12. MORNING STAR (Étoile du Matin)
    // Formule : close[2] < open[2] and max(open[1], close[1]) < close[2] and open > max(open[1], close[1]) and close > open
    // --------------------------------------------------------------------------
    if (actMorningStar && aDeuxPrecedentes && cPrec2) {
      const maxCorps1 = Math.max(open1, close1);
      const estMorningStar =
        close2 < open2 &&
        maxCorps1 < close2 &&
        open > maxCorps1 &&
        close > open;

      if (estMorningStar) {
        motifsDetectes.push({
          nom: 'Morning Star',
          type: 'BULLISH',
          texteCourt: 'Morning Star',
          indexBougie: i,
          temps: cActuelle.time,
          prix: low,
          position: 'below',
        });
        labelsVisuels.push({
          id: `morning-star-${i}`,
          prix: low,
          date: cActuelle.time,
          texte: 'Morning\nStar',
          couleur: bullColor,
          position: 'below',
        });
        countHaussiers++;
      }
    }

    // --------------------------------------------------------------------------
    // 13. SHOOTING STAR (Étoile Filante)
    // Formule : open[1] < close[1] and open > close[1] and (high - max(open, close)) >= abs(open - close) * 3 and (min(close, open) - low) <= abs(open - close)
    // --------------------------------------------------------------------------
    if (actShootingStar) {
      const mecheHaute = high - Math.max(open, close);
      const mecheBasse = Math.min(close, open) - low;
      const corpsVal = Math.max(0.00001, Math.abs(open - close));

      const estShootingStar =
        open1 < close1 &&
        open > close1 &&
        mecheHaute >= corpsVal * 3 &&
        mecheBasse <= corpsVal;

      if (estShootingStar) {
        motifsDetectes.push({
          nom: 'Shooting Star',
          type: 'BEARISH',
          texteCourt: 'Shooting Star',
          indexBougie: i,
          temps: cActuelle.time,
          prix: high,
          position: 'above',
        });
        labelsVisuels.push({
          id: `shooting-star-${i}`,
          prix: high,
          date: cActuelle.time,
          texte: 'Shooting\nStar',
          couleur: bearColor,
          position: 'above',
        });
        countBaissiers++;
      }
    }

    // --------------------------------------------------------------------------
    // 14. HAMMER (Marteau, affiché "H")
    // Formule : (high - low) > 3 * abs(open - close) and ((close - low)/(0.001 + high - low) > 0.6) and ((open - low)/(0.001 + high - low) > 0.6)
    // --------------------------------------------------------------------------
    if (actHammer && range > 0) {
      const denominateur = 0.001 + range;
      const ratioClose = (close - low) / denominateur;
      const ratioOpen = (open - low) / denominateur;
      const corpsVal = Math.abs(open - close);

      const estHammer =
        range > 3 * corpsVal &&
        ratioClose > 0.6 &&
        ratioOpen > 0.6;

      if (estHammer) {
        motifsDetectes.push({
          nom: 'Hammer',
          type: 'BULLISH',
          texteCourt: 'H',
          indexBougie: i,
          temps: cActuelle.time,
          prix: low,
          position: 'below',
        });
        labelsVisuels.push({
          id: `hammer-${i}`,
          prix: low,
          date: cActuelle.time,
          texte: 'H',
          couleur: bullColor,
          position: 'below',
        });
        countHaussiers++;
      }
    }

    // --------------------------------------------------------------------------
    // 15. INVERTED HAMMER (Marteau Inversé, affiché "IH")
    // Formule : (high - low) > 3 * abs(open - close) and ((high - close)/(0.001 + high - low) > 0.6) and ((high - open)/(0.001 + high - low) > 0.6)
    // --------------------------------------------------------------------------
    if (actInvertedHammer && range > 0) {
      const denominateur = 0.001 + range;
      const ratioClose = (high - close) / denominateur;
      const ratioOpen = (high - open) / denominateur;
      const corpsVal = Math.abs(open - close);

      const estInvertedHammer =
        range > 3 * corpsVal &&
        ratioClose > 0.6 &&
        ratioOpen > 0.6;

      if (estInvertedHammer) {
        motifsDetectes.push({
          nom: 'Inverted Hammer',
          type: 'BULLISH',
          texteCourt: 'IH',
          indexBougie: i,
          temps: cActuelle.time,
          prix: low,
          position: 'below',
        });
        labelsVisuels.push({
          id: `inv-hammer-${i}`,
          prix: low,
          date: cActuelle.time,
          texte: 'IH',
          couleur: bullColor,
          position: 'below',
        });
        countHaussiers++;
      }
    }
  }

  // 4️⃣ Finalisation et retour
  return {
    motifs: motifsDetectes,
    primitives: {
      labels: labelsVisuels,
    },
    statistiques: {
      totalMotifs: motifsDetectes.length,
      totalHaussiers: countHaussiers,
      totalBaissiers: countBaissiers,
      totalDojis: countDojis,
    },
  };
}
