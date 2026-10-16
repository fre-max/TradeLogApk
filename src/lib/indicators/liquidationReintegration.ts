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

// ─── 🔍 MOTEUR D'INSPECTION & DIAGNOSTIC AU CLIC SUR LE GRAPHIQUE ─────────────

/**
 * Ligne de détail pour une condition spécifique dans le diagnostic d'une bougie
 */
export interface LigneDiagnosticCondition {
  titre: string;
  valide: boolean;
  valeurMesuree: string;
  valeurRequise: string;
  explication: string;
}

/**
 * Rapport complet de diagnostic pour une bougie inspectée
 */
export interface RapportDiagnosticDoji {
  indexBougie: number;
  temps: number | string;
  estValide: boolean;
  typeCandidat: 'ACHAT' | 'VENTE' | 'AUCUN';
  conditions: LigneDiagnosticCondition[];
  verdict: string;
  roleBougieCliquee?: 'B1' | 'B2';
  detailsPrix: {
    open1: number;
    close1: number;
    range1: number;
    open2: number;
    close2: number;
    range2: number;
    corps2: number;
    moyenneRangeHist: number;
    moyenneCorpsHist: number;
  };
}

/**
 * Analyse spécifique pour un binôme fixe [B1, B2]
 */
function analyserPaireBougies(
  bougies: Bougie[],
  indexB1: number,
  indexB2: number,
  params: ParametresLiquidationReintegration
): RapportDiagnosticDoji {
  const valDeficit = params.toleranceDeficit !== undefined ? params.toleranceDeficit : (params.toleranceProximite ?? 0.15);
  const toleranceDeficit = valDeficit > 1 ? valDeficit / 100 : valDeficit;

  const valDepassement = params.toleranceDepassement !== undefined ? params.toleranceDepassement : 1.0;
  const toleranceDepassement = valDepassement > 1 ? valDepassement / 100 : valDepassement;

  const activerFiltreTaille = params.activerFiltreTaille !== false;
  const periodeHistorique = Math.max(3, Number(params.periodeHistorique ?? 10));
  const multiplicateurBougie1 = Math.max(0.5, Number(params.multiplicateurBougie1 ?? 1.1));
  const multiplicateurCorps2 = Math.max(0.5, Number(params.multiplicateurCorps2 ?? 1.1));

  const activerAchat = params.activerAchat !== false;
  const activerVente = params.activerVente !== false;
  const activerFiltreTendance = Boolean(params.activerFiltreTendance);
  const trendBars = Math.max(1, Number(params.trendBars ?? 5));

  const b1 = bougies[indexB1];
  const b2 = bougies[indexB2];

  const range1 = b1.high - b1.low;
  const range2 = b2.high - b2.low;
  const corps2 = Math.abs(b2.open - b2.close);
  const hauteurMoyenne = (range1 + range2) / 2;

  // Calcul des moyennes historiques
  const indexFinHist = indexB2 - 2;
  const indexDebutHist = Math.max(0, indexB2 - 1 - periodeHistorique);
  const nbBougiesHist = Math.max(0, indexFinHist - indexDebutHist + 1);

  let moyRangeHist = hauteurMoyenne;
  let moyCorpsHist = corps2;

  if (nbBougiesHist >= 3) {
    let sommeRanges = 0;
    let sommeCorps = 0;
    for (let k = indexDebutHist; k <= indexFinHist; k++) {
      sommeRanges += (bougies[k].high - bougies[k].low);
      sommeCorps += Math.abs(bougies[k].open - bougies[k].close);
    }
    moyRangeHist = sommeRanges / nbBougiesHist;
    moyCorpsHist = sommeCorps / nbBougiesHist;
  }

  // Tendance
  const indexTrend = Math.max(0, indexB2 - trendBars);
  const openTrend = bougies[indexTrend].open;
  const tendanceHausse = !activerFiltreTendance || openTrend < b2.open;
  const tendanceBaisse = !activerFiltreTendance || openTrend > b2.open;

  // 1️⃣ Sens et alternance des 2 bougies
  const b1Baissiere = b1.close < b1.open;
  const b1Haussiere = b1.close > b1.open;
  const b2Haussiere = b2.close > b2.open;
  const b2Baissiere = b2.close < b2.open;

  const estAchat = b1Baissiere && b2Haussiere;
  const estVente = b1Haussiere && b2Baissiere;

  let typeCandidat: 'ACHAT' | 'VENTE' | 'AUCUN' = 'AUCUN';
  if (estAchat) typeCandidat = 'ACHAT';
  else if (estVente) typeCandidat = 'VENTE';

  const conditions: LigneDiagnosticCondition[] = [];

  // Condition 1 : Sens opposé
  const condSensValide = typeCandidat !== 'AUCUN';
  conditions.push({
    titre: '1. Alternance & Sens des Bougies',
    valide: condSensValide,
    valeurMesuree: `B1: ${b1Baissiere ? 'Baissière 🔴' : 'Haussière 🟢'} ➔ B2: ${b2Haussiere ? 'Haussière 🟢' : 'Baissière 🔴'}`,
    valeurRequise: 'B1 et B2 doivent être de sens opposés',
    explication: condSensValide
      ? `Configuration ${typeCandidat === 'ACHAT' ? 'Achat (Spring)' : 'Vente (UTAD)'} détectée`
      : 'Les deux bougies ne forment pas un retournement opposé (ex: 2 bougies de même couleur)',
  });

  // Condition 2 : Direction autorisée
  let condDirectionValide = true;
  if (typeCandidat === 'ACHAT') {
    condDirectionValide = activerAchat && tendanceBaisse;
  } else if (typeCandidat === 'VENTE') {
    condDirectionValide = activerVente && tendanceHausse;
  }
  conditions.push({
    titre: '2. Direction & Filtre Tendance',
    valide: condDirectionValide,
    valeurMesuree: typeCandidat === 'ACHAT'
      ? `Achats: ${activerAchat ? 'ON' : 'OFF'} (Tendance baisse: ${tendanceBaisse ? 'Oui' : 'Non'})`
      : `Ventes: ${activerVente ? 'ON' : 'OFF'} (Tendance hausse: ${tendanceHausse ? 'Oui' : 'Non'})`,
    valeurRequise: typeCandidat === 'ACHAT' ? 'Achat activé dans les réglages' : 'Vente activée dans les réglages',
    explication: condDirectionValide
      ? 'La direction est autorisée par vos réglages'
      : 'La direction correspondante est désactivée ou bloquée par le filtre de tendance',
  });

  // Condition 3 : Précision du retournement (Close2 vs Open1)
  const ecartPrix = Math.abs(b1.open - b2.close);
  const ratioEcart = hauteurMoyenne > 0 ? (ecartPrix / hauteurMoyenne) : 0;
  const ratioEcartPct = (ratioEcart * 100).toFixed(1);

  let estDepassement = false;
  let toleranceMax = toleranceDeficit;
  let condProximiteValide = false;

  if (typeCandidat === 'ACHAT') {
    estDepassement = b2.close >= b1.open;
    toleranceMax = estDepassement ? toleranceDepassement : toleranceDeficit;
    condProximiteValide = ratioEcart <= toleranceMax;
  } else if (typeCandidat === 'VENTE') {
    estDepassement = b2.close <= b1.open;
    toleranceMax = estDepassement ? toleranceDepassement : toleranceDeficit;
    condProximiteValide = ratioEcart <= toleranceMax;
  }

  const tolPct = (toleranceMax * 100).toFixed(0);
  conditions.push({
    titre: '3. Clôture B2 vs Ouverture B1',
    valide: condProximiteValide,
    valeurMesuree: `${estDepassement ? 'Dépassement' : 'Retrait'}: ${ratioEcartPct}% (Écart: ${ecartPrix.toFixed(4)})`,
    valeurRequise: `Max autorisé: ${tolPct}%`,
    explication: condProximiteValide
      ? `La réintégration est millimétrée (${ratioEcartPct}% <= ${tolPct}%)`
      : `La clôture est trop éloignée : ${ratioEcartPct}% mesuré vs max ${tolPct}% autorisé`,
  });

  // Condition 4 : Taille de la Bougie 1
  const ratioTailleB1 = moyRangeHist > 0 ? range1 / moyRangeHist : 1;
  const ratioTailleB1Txt = ratioTailleB1.toFixed(2);
  const condTailleB1Valide = !activerFiltreTaille || ratioTailleB1 >= multiplicateurBougie1;
  conditions.push({
    titre: '4. Impulsion Bougie 1 (Liquidation)',
    valide: condTailleB1Valide,
    valeurMesuree: `${ratioTailleB1Txt}x moyenne (${range1.toFixed(4)} vs moy ${moyRangeHist.toFixed(4)})`,
    valeurRequise: `Min requis: ${multiplicateurBougie1.toFixed(2)}x`,
    explication: condTailleB1Valide
      ? `Bougie 1 suffisamment impulsive (${ratioTailleB1Txt}x >= ${multiplicateurBougie1}x)`
      : `Bougie 1 trop courte : ${ratioTailleB1Txt}x < ${multiplicateurBougie1}x (il manque ${(multiplicateurBougie1 - ratioTailleB1).toFixed(2)}x)`,
  });

  // Condition 5 : Corps de la Bougie 2
  const ratioCorpsB2 = moyCorpsHist > 0 ? corps2 / moyCorpsHist : 1;
  const ratioCorpsB2Txt = ratioCorpsB2.toFixed(2);
  const condCorpsB2Valide = !activerFiltreTaille || ratioCorpsB2 >= multiplicateurCorps2;
  conditions.push({
    titre: '5. Puissance Corps Bougie 2 (Réintégration)',
    valide: condCorpsB2Valide,
    valeurMesuree: `${ratioCorpsB2Txt}x moyenne (${corps2.toFixed(4)} vs moy ${moyCorpsHist.toFixed(4)})`,
    valeurRequise: `Min requis: ${multiplicateurCorps2.toFixed(2)}x`,
    explication: condCorpsB2Valide
      ? `Corps de B2 suffisamment puissant (${ratioCorpsB2Txt}x >= ${multiplicateurCorps2}x)`
      : `Corps de B2 trop petit : ${ratioCorpsB2Txt}x < ${multiplicateurCorps2}x (il manque ${(multiplicateurCorps2 - ratioCorpsB2).toFixed(2)}x)`,
  });

  // Verdict global
  const estValideGlobal = condSensValide && condDirectionValide && condProximiteValide && condTailleB1Valide && condCorpsB2Valide;

  let verdict = '';
  if (estValideGlobal) {
    verdict = `✅ SETUP ${typeCandidat} VALIDÉ À 100% (Signal actif)`;
  } else {
    const motifsRejet: string[] = [];
    if (!condSensValide) motifsRejet.push('sens des bougies non opposé');
    if (!condDirectionValide) motifsRejet.push('direction/tendance désactivée');
    if (!condProximiteValide) motifsRejet.push(`écart clôture trop grand (${ratioEcartPct}% > ${tolPct}%)`);
    if (!condTailleB1Valide) motifsRejet.push(`B1 trop petite (${ratioTailleB1Txt}x < ${multiplicateurBougie1}x)`);
    if (!condCorpsB2Valide) motifsRejet.push(`corps B2 trop petit (${ratioCorpsB2Txt}x < ${multiplicateurCorps2}x)`);
    verdict = `❌ REJETÉ : ${motifsRejet.join(', ')}`;
  }

  return {
    indexBougie: indexB2,
    temps: b2.time,
    estValide: estValideGlobal,
    typeCandidat,
    conditions,
    verdict,
    detailsPrix: {
      open1: b1.open,
      close1: b1.close,
      range1,
      open2: b2.open,
      close2: b2.close,
      range2,
      corps2,
      moyenneRangeHist: moyRangeHist,
      moyenneCorpsHist: moyCorpsHist,
    },
  };
}

/**
 * ==============================================================================
 * 🔍 FONCTION D'INSPECTION & DIAGNOSTIC DES SETUPS (POUR LE TRADER ET LE DEV)
 * ==============================================================================
 * Analyse en profondeur n'importe quelle bougie du graphique (i) et sa précédente (i-1)
 * et explique en français pourquoi le setup a été accepté ou rejeté, avec chaque valeur chiffrée.
 *
 * Supporte le clic sur la 1ère bougie (B1) OU la 2ème bougie (B2) du setup !
 *
 * Exemple d'utilisation :
 * const diag = diagnostiquerBougieDoji(bougies, 142, { toleranceDeficit: 0.15 });
 * console.log(diag.verdict); // "❌ REJETÉ : écart clôture trop grand (18.2% > 15%)"
 */
export function diagnostiquerBougieDoji(
  bougies: Bougie[],
  indexBougie: number,
  options?: ParametresLiquidationReintegration
): RapportDiagnosticDoji | null {
  if (!bougies || indexBougie < 0 || indexBougie >= bougies.length) {
    return null;
  }

  const params = options || {};

  // Hypothèse 1 : La bougie cliquée est la deuxième bougie B2 (le signal)
  let diagB2: RapportDiagnosticDoji | null = null;
  if (indexBougie >= 1) {
    diagB2 = analyserPaireBougies(bougies, indexBougie - 1, indexBougie, params);
    diagB2.roleBougieCliquee = 'B2';
  }

  // Hypothèse 2 : La bougie cliquée est la première bougie B1 (l'impulsion)
  let diagB1: RapportDiagnosticDoji | null = null;
  if (indexBougie + 1 < bougies.length) {
    diagB1 = analyserPaireBougies(bougies, indexBougie, indexBougie + 1, params);
    diagB1.roleBougieCliquee = 'B1';
  }

  // 1️⃣ Si l'un des deux est valide à 100%, c'est sans doute le setup recherché
  if (diagB2 && diagB2.estValide) return diagB2;
  if (diagB1 && diagB1.estValide) return diagB1;

  // 2️⃣ Si l'un des deux a un sens opposé candidat (Achat ou Vente) et pas l'autre
  if (diagB2 && diagB2.typeCandidat !== 'AUCUN' && (!diagB1 || diagB1.typeCandidat === 'AUCUN')) {
    return diagB2;
  }
  if (diagB1 && diagB1.typeCandidat !== 'AUCUN' && (!diagB2 || diagB2.typeCandidat === 'AUCUN')) {
    return diagB1;
  }

  // 3️⃣ Par défaut, on renvoie l'analyse comme B2 (si disponible) sinon B1
  return diagB2 || diagB1;
}
