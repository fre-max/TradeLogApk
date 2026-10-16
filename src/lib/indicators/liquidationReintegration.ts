import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLabel } from '@/types/indicatorScript';

/**
 * ==============================================================================
 * 📋 GUIDE DU DÉVELOPPEUR : CONDITIONS DU SETUP & RÈGLES DE MODIFICATION
 * ==============================================================================
 * Détecte les retournements impulsifs de chandelier (Spring haussier & UTAD baissier)
 * articulés autour de 2 bougies consécutives de sens opposé.
 *
 * 🎯 LES 4 CONDITIONS OBLIGATOIRES POUR VALIDER LE PATTERN :
 *
 * ─── CONDITION 1 : Direction et Alternance des Bougies ────────────────────────
 *  • Achat (Spring) : Bougie 1 Baissière (Close1 < Open1) + Bougie 2 Haussière (Close2 > Open2)
 *  • Vente (UTAD)   : Bougie 1 Haussière (Close1 > Open1) + Bougie 2 Baissière (Close2 < Open2)
 *
 * ─── CONDITION 2 : Impulsion de la Bougie 1 (Liquidation) ─────────────────────
 *  • La hauteur totale de la Bougie 1 (High1 - Low1) doit être >= `multiplicateurBougie1`
 *    fois la moyenne des hauteurs des 10 dernières bougies (défaut: 1.75x).
 *  👉 Pour détecter plus de signaux : baisser à 1.2x ou 1.3x.
 *
 * ─── CONDITION 3 : Puissance du Corps de la Bougie 2 (Réintégration) ──────────
 *  • Le corps réel de la Bougie 2 (|Open2 - Close2|) doit être >= `multiplicateurCorps2`
 *    fois la moyenne des corps des 10 dernières bougies (défaut: 1.75x).
 *  👉 Pour détecter plus de signaux : baisser à 1.2x ou 1.3x.
 *
 * ─── CONDITION 4 : Précision du Retournement (Open1 vs Close2) ────────────────
 *  • La Bougie 2 doit ramener le prix au point de départ (Open1) :
 *    - Dépassement favorable (au-dessus pour Achat, en dessous pour Vente) :
 *      autorisé jusqu'à `toleranceDepassement` (défaut: 25% de la hauteur moyenne).
 *    - Retrait / Déficit (la clôture n'atteint pas tout à fait Open1) :
 *      autorisé jusqu'à `toleranceDeficit` (défaut: 5% de la hauteur moyenne).
 * ==============================================================================
 */

/**
 * Options de configuration complètes pour l'indicateur Liquidation & Réintégration.
 * Entièrement modulable pour affiner les filtres de volume, taille et proximité.
 */
export interface ParametresLiquidationReintegration {
  // Tolérance d'écart quand la réintégration reste en retrait d'Open(1) (déficit) (défaut: 0.05 = 5% de la hauteur moyenne)
  toleranceDeficit?: number;
  // Tolérance d'approximation symétrique (utilisée si toleranceDeficit n'est pas spécifié) (défaut: 0.05 = 5%)
  toleranceProximite?: number;
  // Tolérance élargie quand la réintégration dépasse Open(1) dans le sens favorable (dépassement) (défaut: 0.25 = 25%)
  toleranceDepassement?: number;

  // Active le filtre de taille relative sur l'historique récent (défaut: true)
  activerFiltreTaille?: boolean;
  // Nombre de bougies précédentes servant de référence pour la moyenne (défaut: 10)
  periodeHistorique?: number;
  // Multiplicateur requis pour la Bougie 1 entière (corps + mèches) (défaut: 1.75x)
  multiplicateurBougie1?: number;
  // Multiplicateur requis pour le corps de la Bougie 2 sans mèches (défaut: 1.75x)
  multiplicateurCorps2?: number;

  // Filtre optionnel de tendance globale sur les barres antérieures (défaut: false)
  activerFiltreTendance?: boolean;
  // Nombre de barres pour évaluer la tendance si le filtre est actif (défaut: 5)
  trendBars?: number;

  // Sélecteurs de direction
  activerAchat?: boolean;
  activerVente?: boolean;

  // Couleurs et style d'affichage
  bullColor?: string;
  bearColor?: string;
  texteLabel?: string;
}

/**
 * Structure détaillée d'un signal de Liquidation & Réintégration détecté
 */
export interface SignalLiquidationReintegration {
  type: 'ACHAT' | 'VENTE';
  indexBougie: number;
  temps: number | string;
  prix: number;
  open1: number;
  close2: number;
  ecartPrix: number;
  ratioEcart: number;
  situationCloture: 'DEPASSEMENT' | 'RETRAIT';
  rangeBougie1: number;
  corpsBougie2: number;
  moyenneRangeHist: number;
  moyenneCorpsHist: number;
}

/**
 * Résultat complet retourné par l'indicateur
 */
export interface ResultatLiquidationReintegration {
  signaux: SignalLiquidationReintegration[];
  primitives: VisualPrimitives;
  statistiques: {
    totalSignaux: number;
    totalAchats: number;
    totalVentes: number;
  };
}

/**
 * Calcule les détections de Liquidation & Réintégration (Liq / Reint).
 * 
 * Principe du setup :
 * Deux bougies consécutives de sens opposés :
 * 1. Bougie de Liquidation (i - 1) :
 *    - Bougie impulsive de balayage.
 *    - Toute la bougie entière (corps + mèches) est au moins 1.75x plus grande que la moyenne récente.
 * 2. Bougie de Réintégration (i) :
 *    - Bougie impulsive de reprise en sens inverse.
 *    - Son corps pur (sans les mèches) est au moins 1.75x plus grand que la moyenne des corps récents.
 * 3. Proximité millimétrée :
 *    - La clôture de la Bougie 2 revient exactement à l'ouverture de départ de la Bougie 1 (|Open1 - Close2| <= tolerance * HauteurMoyenne).
 * 
 * Exemple :
 * const res = calculerLiquidationReintegration(bougies, { toleranceProximite: 0.05, multiplicateurCorps2: 1.75 });
 * console.log(res.signaux.length); // Nombre de setups détectés
 */
export function calculerLiquidationReintegration(
  bougies: Bougie[],
  options?: ParametresLiquidationReintegration
): ResultatLiquidationReintegration {
  // 1️⃣ Vérification minimale des données
  if (!bougies || bougies.length < 2) {
    return {
      signaux: [],
      primitives: { labels: [] },
      statistiques: { totalSignaux: 0, totalAchats: 0, totalVentes: 0 },
    };
  }

  // 2️⃣ Extraction et sécurisation des paramètres avec valeurs par défaut
  const params = options || {};
  // Tolérance stricte quand la bougie reste en deçà d'Open1 (déficit de réintégration)
  const valDeficit = params.toleranceDeficit !== undefined ? params.toleranceDeficit : params.toleranceProximite;
  const toleranceDeficit = valDeficit !== undefined
    ? (valDeficit > 1 ? valDeficit / 100 : valDeficit)
    : 0.05;

  // Tolérance élargie quand la bougie dépasse Open1 dans le sens favorable (dépassement avec plus de marge)
  const valDepassement = params.toleranceDepassement !== undefined ? params.toleranceDepassement : 0.25;
  const toleranceDepassement = valDepassement > 1 ? valDepassement / 100 : valDepassement;

  const activerFiltreTaille = params.activerFiltreTaille !== false;
  const periodeHistorique = Math.max(3, Number(params.periodeHistorique !== undefined ? params.periodeHistorique : 10));
  const multiplicateurBougie1 = Math.max(0.5, Number(params.multiplicateurBougie1 !== undefined ? params.multiplicateurBougie1 : 1.75));
  const multiplicateurCorps2 = Math.max(0.5, Number(params.multiplicateurCorps2 !== undefined ? params.multiplicateurCorps2 : 1.75));

  const activerFiltreTendance = Boolean(params.activerFiltreTendance);
  const trendBars = Math.max(1, Number(params.trendBars !== undefined ? params.trendBars : 5));

  const activerAchat = params.activerAchat !== false;
  const activerVente = params.activerVente !== false;

  const bullColor = params.bullColor || '#00E676';
  const bearColor = params.bearColor || '#F23645';
  const texteLabel = params.texteLabel || 'Liq\nReint';

  const signauxDetectes: SignalLiquidationReintegration[] = [];
  const labelsVisuels: VisualLabel[] = [];

  let countAchats = 0;
  let countVentes = 0;

  // 3️⃣ Parcours séquentiel des bougies historiques
  for (let i = 1; i < bougies.length; i++) {
    // Bougie 1 : Liquidation (i - 1)
    const b1 = bougies[i - 1];
    const open1 = b1.open;
    const high1 = b1.high;
    const low1 = b1.low;
    const close1 = b1.close;
    const range1 = high1 - low1;
    const corps1 = Math.abs(open1 - close1);

    // Bougie 2 : Réintégration (i)
    const b2 = bougies[i];
    const open2 = b2.open;
    const high2 = b2.high;
    const low2 = b2.low;
    const close2 = b2.close;
    const range2 = high2 - low2;
    const corps2 = Math.abs(open2 - close2);

    // Hauteur moyenne des deux bougies servant de référence proportionnelle
    const hauteurMoyenne = (range1 + range2) / 2;
    if (hauteurMoyenne <= 0) continue;

    // A. Filtre de tendance globale optionnel
    const indexTendance = Math.max(0, i - trendBars);
    const openTrend = bougies[indexTendance].open;
    const tendanceHausse = !activerFiltreTendance || openTrend < open2;
    const tendanceBaisse = !activerFiltreTendance || openTrend > open2;

    // ─── 🔍 CONDITION 1 : Direction et alternance des 2 bougies (Spring = Baisse puis Hausse) ───
    const estCandidatAchat = activerAchat && (close1 < open1) && (close2 > open2) && tendanceBaisse;
    const estCandidatVente = activerVente && (close1 > open1) && (close2 < open2) && tendanceHausse;

    if (!estCandidatAchat && !estCandidatVente) continue;

    // ─── 🔍 CONDITION 4 : Précision du retournement (Close2 doit revenir au niveau de Open1) ───
    const ecartPrix = Math.abs(open1 - close2);
    const ratioEcart = ecartPrix / hauteurMoyenne;
    let situationCloture: 'DEPASSEMENT' | 'RETRAIT' = 'RETRAIT';
    let respecteProximite = false;

    if (estCandidatAchat) {
      if (close2 >= open1) {
        // Dépassement haussier favorable : marge jusqu'à toleranceDepassement (défaut: 25%)
        situationCloture = 'DEPASSEMENT';
        respecteProximite = ratioEcart <= toleranceDepassement;
      } else {
        // En retrait : marge stricte toleranceDeficit (défaut: 5%)
        situationCloture = 'RETRAIT';
        respecteProximite = ratioEcart <= toleranceDeficit;
      }
    } else if (estCandidatVente) {
      if (close2 <= open1) {
        // Dépassement baissier favorable : marge jusqu'à toleranceDepassement (défaut: 25%)
        situationCloture = 'DEPASSEMENT';
        respecteProximite = ratioEcart <= toleranceDepassement;
      } else {
        // En retrait : marge stricte toleranceDeficit (défaut: 5%)
        situationCloture = 'RETRAIT';
        respecteProximite = ratioEcart <= toleranceDeficit;
      }
    }

    if (!respecteProximite) continue;

    // ─── 🔍 CONDITIONS 2 & 3 : Impulsion de Bougie 1 et Puissance du Corps de Bougie 2 ───
    let respecteTaille = true;
    let moyRangeHist = 0;
    let moyCorpsHist = 0;

    if (activerFiltreTaille) {
      const indexFinHist = i - 2;
      const indexDebutHist = Math.max(0, i - 1 - periodeHistorique);
      const nbBougiesHist = indexFinHist - indexDebutHist + 1;

      // Si nous avons au moins 3 bougies d'historique, nous appliquons le filtre d'impulsion
      if (nbBougiesHist >= 3) {
        let sommeRanges = 0;
        let sommeCorps = 0;

        for (let k = indexDebutHist; k <= indexFinHist; k++) {
          const bHist = bougies[k];
          sommeRanges += (bHist.high - bHist.low);
          sommeCorps += Math.abs(bHist.open - bHist.close);
        }

        moyRangeHist = sommeRanges / nbBougiesHist;
        moyCorpsHist = sommeCorps / nbBougiesHist;

        // CONDITION 2 : Bougie 1 entière (corps + mèches) >= multiplicateurBougie1 x moyenne (défaut: 1.75x)
        const bougie1AssezGrande = range1 >= (multiplicateurBougie1 * moyRangeHist);

        // CONDITION 3 : Bougie 2 corps pur >= multiplicateurCorps2 x moyenne des corps (défaut: 1.75x)
        const bougie2AssezGrande = corps2 >= (multiplicateurCorps2 * moyCorpsHist);

        respecteTaille = bougie1AssezGrande && bougie2AssezGrande;
      }
    }

    if (!respecteTaille) continue;

    // 🔵 E. Enregistrement du Signal d'Achat (Bullish) :
    if (estCandidatAchat) {
      signauxDetectes.push({
        type: 'ACHAT',
        indexBougie: i,
        temps: b2.time,
        prix: low2,
        open1,
        close2,
        ecartPrix,
        ratioEcart,
        situationCloture,
        rangeBougie1: range1,
        corpsBougie2: corps2,
        moyenneRangeHist: moyRangeHist,
        moyenneCorpsHist: moyCorpsHist,
      });

      labelsVisuels.push({
        id: `liq-reint-achat-${i}`,
        prix: low2,
        date: b2.time,
        texte: texteLabel,
        couleur: bullColor,
        position: 'below',
      });

      countAchats++;
      continue;
    }

    // 🔴 F. Enregistrement du Signal de Vente (Bearish) :
    if (estCandidatVente) {
      signauxDetectes.push({
        type: 'VENTE',
        indexBougie: i,
        temps: b2.time,
        prix: high2,
        open1,
        close2,
        ecartPrix,
        ratioEcart,
        situationCloture,
        rangeBougie1: range1,
        corpsBougie2: corps2,
        moyenneRangeHist: moyRangeHist,
        moyenneCorpsHist: moyCorpsHist,
      });

      labelsVisuels.push({
        id: `liq-reint-vente-${i}`,
        prix: high2,
        date: b2.time,
        texte: texteLabel,
        couleur: bearColor,
        position: 'above',
      });

      countVentes++;
    }
  }

  // 4️⃣ Finalisation et synthèse
  return {
    signaux: signauxDetectes,
    primitives: {
      labels: labelsVisuels,
    },
    statistiques: {
      totalSignaux: signauxDetectes.length,
      totalAchats: countAchats,
      totalVentes: countVentes,
    },
  };
}
