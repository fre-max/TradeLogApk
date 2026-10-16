import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLabel } from '@/types/indicatorScript';

/**
 * ==============================================================================
 * 📋 GUIDE DU DÉVELOPPEUR : CONDITIONS DU SETUP & RÈGLES DE MODIFICATION
 * ==============================================================================
 * Détecte les retournements impulsifs de chandelier (Spring haussier & UTAD baissier)
 * articulés autour de 2 bougies consécutives de sens opposé.
 *
 * 🎯 OÙ TROUVER ET MODIFIER LE CODE DES CONDITIONS DU DOJI ?
 *  👉 TOUTES les conditions du Doji sont rassemblées dans une seule fonction :
 *     `validerDojiPersonnalise(params): ResultatValidationDoji` (vers la ligne 120).
 *     Ouvrez cette fonction pour ajuster directement les règles ou désactiver un filtre !
 *
 * 🎯 LES 4 CONDITIONS OBLIGATOIRES POUR VALIDER LE PATTERN :
 *
 * ─── CONDITION 1 : Direction et Alternance des Bougies (dans validerDojiPersonnalise) ─
 *  • Achat (Spring) : Bougie 1 Baissière (Close1 < Open1) + Bougie 2 Haussière (Close2 > Open2)
 *  • Vente (UTAD)   : Bougie 1 Haussière (Close1 > Open1) + Bougie 2 Baissière (Close2 < Open2)
 *
 * ─── CONDITION 2 : Précision du Retournement (Close2 vs Open1) ────────────────
 *  • La Bougie 2 doit ramener le prix au point de départ (Open1) :
 *    - Dépassement favorable (au-dessus pour Achat, en dessous pour Vente) :
 *      autorisé jusqu'à `toleranceDepassement` (défaut: 100% de la hauteur moyenne).
 *    - Retrait / Déficit (la clôture n'atteint pas tout à fait Open1) :
 *      autorisé jusqu'à `toleranceDeficit` (défaut: 15% de la hauteur moyenne).
 *
 * ─── CONDITION 3 : Impulsion de la Bougie 1 (Liquidation) ─────────────────────
 *  • La hauteur totale de la Bougie 1 (High1 - Low1) doit être >= `multiplicateurBougie1`
 *    fois la moyenne des hauteurs des 10 dernières bougies (défaut: 1.1x).
 *  👉 Pour détecter plus de signaux : baisser à 1.2x ou 1.3x.
 *
 * ─── CONDITION 4 : Puissance du Corps de la Bougie 2 (Réintégration) ──────────
 *  • Le corps réel de la Bougie 2 (|Open2 - Close2|) doit être >= `multiplicateurCorps2`
 *    fois la moyenne des corps des 10 dernières bougies (défaut: 1.1x).
 *  👉 Pour détecter plus de signaux : baisser à 1.2x ou 1.3x.
 * ==============================================================================
 */

/**
 * Options de configuration complètes pour l'indicateur Liquidation & Réintégration.
 * Entièrement modulable pour affiner les filtres de volume, taille et proximité.
 */
export interface ParametresLiquidationReintegration {
  // Tolérance d'écart quand la réintégration reste en retrait d'Open(1) (déficit) (défaut: 0.15 = 15% de la hauteur moyenne)
  toleranceDeficit?: number;
  // Tolérance d'approximation symétrique (utilisée si toleranceDeficit n'est pas spécifié) (défaut: 0.15 = 15%)
  toleranceProximite?: number;
  // Tolérance élargie quand la réintégration dépasse Open(1) dans le sens favorable (dépassement) (défaut: 1.0 = 100%)
  toleranceDepassement?: number;

  // Active le filtre de taille relative sur l'historique récent (défaut: true)
  activerFiltreTaille?: boolean;
  // Nombre de bougies précédentes servant de référence pour la moyenne (défaut: 10)
  periodeHistorique?: number;
  // Multiplicateur requis pour la Bougie 1 entière (corps + mèches) (défaut: 1.1x)
  multiplicateurBougie1?: number;
  // Multiplicateur requis pour le corps de la Bougie 2 sans mèches (défaut: 1.1x)
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
// ─── 🎯 FONCTION CENTRALE DE VALIDATION DU DOJI (POUR LE DÉVELOPPEUR) ──────

/**
 * Paramètres pour tester si deux bougies consécutives forment un Doji personnalisé valide.
 */
export interface ParametresValidationDoji {
  b1: Bougie;
  b2: Bougie;
  moyRangeHist: number;
  moyCorpsHist: number;
  openTendance: number;
  activerAchat?: boolean;
  activerVente?: boolean;
  activerFiltreTaille?: boolean;
  activerFiltreTendance?: boolean;
  toleranceDeficit?: number;
  toleranceDepassement?: number;
  multiplicateurBougie1?: number;
  multiplicateurCorps2?: number;
}

/**
 * Résultat de la validation du Doji personnalisé.
 */
export interface ResultatValidationDoji {
  estValide: boolean;
  type: 'ACHAT' | 'VENTE';
  situationCloture: 'DEPASSEMENT' | 'RETRAIT';
  ecartPrix: number;
  ratioEcart: number;
  rangeBougie1: number;
  corpsBougie2: number;
}

/**
 * ==============================================================================
 * 🎯 FONCTION CENTRALE DE VALIDATION DU DOJI (POUR LE DÉVELOPPEUR DÉBUTANT)
 * ==============================================================================
 * Cette fonction unique rassemble dans UN SEUL BLOC toutes les conditions
 * nécessaires pour qu'un chandelier de retournement (Spring / UTAD) soit validé.
 *
 * 💡 COMMENT L'AJUSTER OU LA MODIFIER ?
 *  • Pour désactiver une condition : commentez simplement son bloc `if (...) return { ... estValide: false }`.
 *  • Pour assouplir les tailles : réduisez `multiplicateurBougie1` ou `multiplicateurCorps2` (ex: 1.2 au lieu de 1.75).
 *  • Pour assouplir la précision de réintégration : augmentez `toleranceDepassement` ou `toleranceDeficit`.
 *
 * @returns {ResultatValidationDoji} { estValide: true/false, type, situationCloture, ... }
 */
export function validerDojiPersonnalise(params: ParametresValidationDoji): ResultatValidationDoji {
  const {
    b1,
    b2,
    moyRangeHist,
    moyCorpsHist,
    openTendance,
    activerAchat = true,
    activerVente = true,
    activerFiltreTaille = true,
    activerFiltreTendance = false,
    toleranceDeficit = 0.15,
    toleranceDepassement = 1.0,
    multiplicateurBougie1 = 1.1,
    multiplicateurCorps2 = 1.1,
  } = params;

  const range1 = b1.high - b1.low;
  const corps1 = Math.abs(b1.open - b1.close);
  const range2 = b2.high - b2.low;
  const corps2 = Math.abs(b2.open - b2.close);
  const hauteurMoyenne = (range1 + range2) / 2;

  const resultatEchec: ResultatValidationDoji = {
    estValide: false,
    type: 'ACHAT',
    situationCloture: 'RETRAIT',
    ecartPrix: 0,
    ratioEcart: 0,
    rangeBougie1: range1,
    corpsBougie2: corps2,
  };

  if (hauteurMoyenne <= 0) return resultatEchec;

  // ─── 🔍 CONDITION 1 : Direction et alternance des 2 bougies ─────────────────
  // • Achat (Spring) : Bougie 1 Baissière (rouge) + Bougie 2 Haussière (verte)
  // • Vente (UTAD)   : Bougie 1 Haussière (verte) + Bougie 2 Baissière (rouge)
  const tendanceHausse = !activerFiltreTendance || openTendance < b2.open;
  const tendanceBaisse = !activerFiltreTendance || openTendance > b2.open;

  const estCandidatAchat = activerAchat && (b1.close < b1.open) && (b2.close > b2.open) && tendanceBaisse;
  const estCandidatVente = activerVente && (b1.close > b1.open) && (b2.close < b2.open) && tendanceHausse;

  if (!estCandidatAchat && !estCandidatVente) {
    // ❌ Échoué : Les sens des deux bougies ne forment pas un retournement
    return resultatEchec;
  }

  const typeSignal: 'ACHAT' | 'VENTE' = estCandidatAchat ? 'ACHAT' : 'VENTE';
  resultatEchec.type = typeSignal;

  // ─── 🔍 CONDITION 2 : Précision du retournement (Close2 vs Open1) ───────────
  // La Bougie 2 doit ramener le prix au point de départ (Open1)
  const ecartPrix = Math.abs(b1.open - b2.close);
  const ratioEcart = ecartPrix / hauteurMoyenne;
  let situationCloture: 'DEPASSEMENT' | 'RETRAIT' = 'RETRAIT';
  let respecteProximite = false;

  if (typeSignal === 'ACHAT') {
    if (b2.close >= b1.open) {
      // Dépassement haussier favorable
      situationCloture = 'DEPASSEMENT';
      respecteProximite = ratioEcart <= toleranceDepassement;
    } else {
      // En retrait (déficit)
      situationCloture = 'RETRAIT';
      respecteProximite = ratioEcart <= toleranceDeficit;
    }
  } else {
    if (b2.close <= b1.open) {
      // Dépassement baissier favorable
      situationCloture = 'DEPASSEMENT';
      respecteProximite = ratioEcart <= toleranceDepassement;
    } else {
      // En retrait (déficit)
      situationCloture = 'RETRAIT';
      respecteProximite = ratioEcart <= toleranceDeficit;
    }
  }

  if (!respecteProximite) {
    // ❌ Échoué : La clôture de B2 est trop éloignée de l'ouverture de B1
    return { ...resultatEchec, situationCloture, ecartPrix, ratioEcart };
  }

  // ─── 🔍 CONDITION 3 & 4 : Impulsion Bougie 1 et Puissance Bougie 2 ────────────
  if (activerFiltreTaille && moyRangeHist > 0 && moyCorpsHist > 0) {
    // Bougie 1 entière (corps + mèches) >= multiplicateurBougie1 x moyenne
    const bougie1AssezGrande = range1 >= (multiplicateurBougie1 * moyRangeHist);

    // Bougie 2 corps pur >= multiplicateurCorps2 x moyenne des corps
    const bougie2AssezGrande = corps2 >= (multiplicateurCorps2 * moyCorpsHist);

    if (!bougie1AssezGrande || !bougie2AssezGrande) {
      // ❌ Échoué : Manque d'impulsion sur B1 ou de puissance sur B2
      return { ...resultatEchec, situationCloture, ecartPrix, ratioEcart };
    }
  }

  // ✅ TOUTES les conditions sont satisfaites : Doji validé !
  return {
    estValide: true,
    type: typeSignal,
    situationCloture,
    ecartPrix,
    ratioEcart,
    rangeBougie1: range1,
    corpsBougie2: corps2,
  };
}

// ─── 🚀 Fonction Principale ───────────────────────────────────────────────────

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
    : 0.15;

  // Tolérance élargie quand la bougie dépasse Open1 dans le sens favorable (dépassement avec plus de marge)
  const valDepassement = params.toleranceDepassement !== undefined ? params.toleranceDepassement : 1.0;
  const toleranceDepassement = valDepassement > 1 ? valDepassement / 100 : valDepassement;

  const activerFiltreTaille = params.activerFiltreTaille !== false;
  const periodeHistorique = Math.max(3, Number(params.periodeHistorique !== undefined ? params.periodeHistorique : 10));
  const multiplicateurBougie1 = Math.max(0.5, Number(params.multiplicateurBougie1 !== undefined ? params.multiplicateurBougie1 : 1.1));
  const multiplicateurCorps2 = Math.max(0.5, Number(params.multiplicateurCorps2 !== undefined ? params.multiplicateurCorps2 : 1.1));

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
    const b1 = bougies[i - 1];
    const b2 = bougies[i];

    // Calcul des moyennes historiques pour les filtres de taille
    let moyRangeHist = 0;
    let moyCorpsHist = 0;

    if (activerFiltreTaille) {
      const indexFinHist = i - 2;
      const indexDebutHist = Math.max(0, i - 1 - periodeHistorique);
      const nbBougiesHist = indexFinHist - indexDebutHist + 1;

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
      }
    }

    const indexTendance = Math.max(0, i - trendBars);
    const openTendance = bougies[indexTendance].open;

    // ─── 🎯 VÉRIFICATION DES CONDITIONS DU DOJI (FONCTION UNIQUE ET CENTRALISÉE) ───
    const validation = validerDojiPersonnalise({
      b1,
      b2,
      moyRangeHist,
      moyCorpsHist,
      openTendance,
      activerAchat,
      activerVente,
      activerFiltreTaille,
      activerFiltreTendance,
      toleranceDeficit,
      toleranceDepassement,
      multiplicateurBougie1,
      multiplicateurCorps2,
    });

    if (!validation.estValide) {
      continue;
    }

    // 🔵 E. Enregistrement du Signal :
    if (validation.type === 'ACHAT') {
      signauxDetectes.push({
        type: 'ACHAT',
        indexBougie: i,
        temps: b2.time,
        prix: b2.low,
        open1: b1.open,
        close2: b2.close,
        ecartPrix: validation.ecartPrix,
        ratioEcart: validation.ratioEcart,
        situationCloture: validation.situationCloture,
        rangeBougie1: validation.rangeBougie1,
        corpsBougie2: validation.corpsBougie2,
        moyenneRangeHist: moyRangeHist,
        moyenneCorpsHist: moyCorpsHist,
      });

      labelsVisuels.push({
        id: `liq-reint-achat-${i}`,
        prix: b2.low,
        date: b2.time,
        texte: texteLabel,
        couleur: bullColor,
        position: 'below',
      });

      countAchats++;
    } else {
      signauxDetectes.push({
        type: 'VENTE',
        indexBougie: i,
        temps: b2.time,
        prix: b2.high,
        open1: b1.open,
        close2: b2.close,
        ecartPrix: validation.ecartPrix,
        ratioEcart: validation.ratioEcart,
        situationCloture: validation.situationCloture,
        rangeBougie1: validation.rangeBougie1,
        corpsBougie2: validation.corpsBougie2,
        moyenneRangeHist: moyRangeHist,
        moyenneCorpsHist: moyCorpsHist,
      });

      labelsVisuels.push({
        id: `liq-reint-vente-${i}`,
        prix: b2.high,
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
