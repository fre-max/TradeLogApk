import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLabel, VisualLine } from '@/types/indicatorScript';
import { calculerZigZag } from './zigzag';

/**
 * ==============================================================================
 * 📋 GUIDE DU DÉVELOPPEUR : CONDITIONS DU SETUP & RÈGLES DE MODIFICATION
 * ==============================================================================
 * Détecte les retournements impulsifs de chandelier (Spring haussier & UTAD baissier)
 * articulés autour de 2 bougies consécutives de sens opposé, couplé au ZigZag.
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
 *      autorisé jusqu'à `toleranceDepassement` (défaut: 200% de la hauteur moyenne).
 *    - Retrait / Déficit (la clôture n'atteint pas tout à fait Open1) :
 *      autorisé jusqu'à `toleranceDeficit` (défaut: 30% de la hauteur moyenne).
 *
 * ─── CONDITION 3 : Impulsion de la Bougie 1 (Liquidation) ─────────────────────
 *  • La hauteur totale de la Bougie 1 (High1 - Low1) doit être >= `multiplicateurBougie1`
 *    fois la moyenne des hauteurs des 10 dernières bougies (défaut: 1.0x).
 *
 * ─── CONDITION 4 : Puissance du Corps de la Bougie 2 (Réintégration) ──────────
 *  • Le corps réel de la Bougie 2 (|Open2 - Close2|) doit être >= `multiplicateurCorps2`
 *    fois la moyenne des corps des 10 dernières bougies (défaut: 1.2x).
 *
 * ─── CONDITION 5 : Filtre Pic ZigZag (Creux / Sommet Extrême) ──────────────────
 *  • Achat (Spring) : Le creux du pattern (Low de B1 ou B2) doit être le point le plus bas
 *    par rapport aux N bougies précédentes (défaut: 5 bougies).
 *  • Vente (UTAD)   : Le sommet du pattern (High de B1 ou B2) doit être le point le plus haut
 *    par rapport aux N bougies précédentes (défaut: 5 bougies).
 *  👉 Si le marché a fait un plus bas/haut plus extrême juste avant, le setup est rejeté !
 * ==============================================================================
 */

/**
 * Options de configuration complètes pour l'indicateur Liquidation & Réintégration.
 * Entièrement modulable pour affiner les filtres de volume, taille, proximité et ZigZag.
 */
export interface ParametresLiquidationReintegration {
  // Tolérance d'écart quand la réintégration reste en retrait d'Open(1) (déficit) (défaut: 0.30 = 30% de la hauteur moyenne)
  toleranceDeficit?: number;
  // Tolérance d'approximation symétrique (utilisée si toleranceDeficit n'est pas spécifié) (défaut: 0.30 = 30%)
  toleranceProximite?: number;
  // Tolérance élargie quand la réintégration dépasse Open(1) dans le sens favorable (dépassement) (défaut: 2.0 = 200%)
  toleranceDepassement?: number;

  // Active le filtre de taille relative sur l'historique récent (défaut: true)
  activerFiltreTaille?: boolean;
  // Nombre de bougies précédentes servant de référence pour la moyenne (défaut: 10)
  periodeHistorique?: number;
  // Multiplicateur requis pour la Bougie 1 entière (corps + mèches) (défaut: 1.0x)
  multiplicateurBougie1?: number;
  // Multiplicateur requis pour le corps de la Bougie 2 sans mèches (défaut: 1.2x)
  multiplicateurCorps2?: number;

  // ─── 📐 Filtre Pic ZigZag (Creux pour Achat, Sommet pour Vente) ──────────────
  // Exige que le Doji se forme sur un vrai pic ZigZag extrême (défaut: true)
  activerFiltreZigzag?: boolean;
  // Nombre de bougies précédentes devant être dépassées pour valider le pic (défaut: 5)
  profondeurZigzag?: number;
  // Affiche visuellement le tracé des segments du ZigZag sur le graphique (défaut: false)
  afficherZigzag?: boolean;
  // Couleur personnalisée des lignes du ZigZag (défaut: '#06b6d4')
  couleurZigzag?: string;

  // Sélecteurs de direction
  activerAchat?: boolean;
  activerVente?: boolean;

  // Paramètres dépréciés conservés pour compatibilité descendante
  activerFiltreTendance?: boolean;
  trendBars?: number;

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
  activerAchat?: boolean;
  activerVente?: boolean;
  activerFiltreTaille?: boolean;
  toleranceDeficit?: number;
  toleranceDepassement?: number;
  multiplicateurBougie1?: number;
  multiplicateurCorps2?: number;
  // ─── 📐 Filtre Pic ZigZag ───
  activerFiltreZigzag?: boolean;
  plusBasPrecedent?: number;
  plusHautPrecedent?: number;
  // Propriétés dépréciées conservées pour compatibilité avec d'autres modules
  openTendance?: number;
  activerFiltreTendance?: boolean;
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
 *  • Pour assouplir les tailles : réduisez `multiplicateurBougie1` ou `multiplicateurCorps2` (ex: 1.0 et 1.2).
 *  • Pour assouplir la précision de réintégration : augmentez `toleranceDepassement` ou `toleranceDeficit`.
 *  • Pour désactiver le filtre ZigZag : passez `activerFiltreZigzag: false`.
 *
 * @returns {ResultatValidationDoji} { estValide: true/false, type, situationCloture, ... }
 */
export function validerDojiPersonnalise(params: ParametresValidationDoji): ResultatValidationDoji {
  const {
    b1,
    b2,
    moyRangeHist,
    moyCorpsHist,
    activerAchat = true,
    activerVente = true,
    activerFiltreTaille = true,
    toleranceDeficit = 0.3,
    toleranceDepassement = 2.0,
    multiplicateurBougie1 = 1.0,
    multiplicateurCorps2 = 1.2,
    activerFiltreZigzag = true,
    plusBasPrecedent,
    plusHautPrecedent,
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
  const estCandidatAchat = activerAchat && (b1.close < b1.open) && (b2.close > b2.open);
  const estCandidatVente = activerVente && (b1.close > b1.open) && (b2.close < b2.open);

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

  // ─── 🔍 CONDITION 5 : Filtre Pic ZigZag (Creux pour Achat, Sommet pour Vente) ─
  // Le Doji acheteur doit impérativement marquer le creux le plus bas récent (Swing Low)
  // Le Doji vendeur doit impérativement marquer le sommet le plus haut récent (Swing High)
  if (activerFiltreZigzag && plusBasPrecedent !== undefined && plusHautPrecedent !== undefined) {
    if (typeSignal === 'ACHAT') {
      const creuxSetup = Math.min(b1.low, b2.low);
      if (creuxSetup > plusBasPrecedent) {
        // ❌ Échoué : Une bougie précédente était plus basse, ce n'est pas un pic bas ZigZag
        return { ...resultatEchec, situationCloture, ecartPrix, ratioEcart };
      }
    } else if (typeSignal === 'VENTE') {
      const sommetSetup = Math.max(b1.high, b2.high);
      if (sommetSetup < plusHautPrecedent) {
        // ❌ Échoué : Une bougie précédente était plus haute, ce n'est pas un pic haut ZigZag
        return { ...resultatEchec, situationCloture, ecartPrix, ratioEcart };
      }
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
  // Tolérance stricte quand la bougie reste en deçà d'Open1 (déficit de réintégration) (défaut: 30%)
  const valDeficit = params.toleranceDeficit !== undefined ? params.toleranceDeficit : params.toleranceProximite;
  const toleranceDeficit = valDeficit !== undefined
    ? (valDeficit > 1 ? valDeficit / 100 : valDeficit)
    : 0.3;

  // Tolérance élargie quand la bougie dépasse Open1 dans le sens favorable (dépassement avec plus de marge) (défaut: 200%)
  const valDepassement = params.toleranceDepassement !== undefined ? params.toleranceDepassement : 2.0;
  const toleranceDepassement = valDepassement > 1 ? valDepassement / 100 : valDepassement;

  const activerFiltreTaille = params.activerFiltreTaille !== false;
  const periodeHistorique = Math.max(3, Number(params.periodeHistorique !== undefined ? params.periodeHistorique : 10));
  const multiplicateurBougie1 = Math.max(0.5, Number(params.multiplicateurBougie1 !== undefined ? params.multiplicateurBougie1 : 1.0));
  const multiplicateurCorps2 = Math.max(0.5, Number(params.multiplicateurCorps2 !== undefined ? params.multiplicateurCorps2 : 1.2));

  // ─── 📐 Filtre et Tracé Visuel ZigZag ───
  const activerFiltreZigzag = params.activerFiltreZigzag !== false;
  const profondeurZigzag = Math.max(2, Number(params.profondeurZigzag !== undefined ? params.profondeurZigzag : 5));
  const afficherZigzag = Boolean(params.afficherZigzag);
  const couleurZigzag = params.couleurZigzag || '#06b6d4';

  const activerAchat = params.activerAchat !== false;
  const activerVente = params.activerVente !== false;

  const bullColor = params.bullColor || '#00E676';
  const bearColor = params.bearColor || '#F23645';
  const texteLabel = params.texteLabel || 'Liq\nReint';

  const signauxDetectes: SignalLiquidationReintegration[] = [];
  const labelsVisuels: VisualLabel[] = [];
  const lignesVisuelles: VisualLine[] = [];

  // Tracé des segments ZigZag sur le graphique si demandé par l'utilisateur
  if (afficherZigzag && bougies.length >= profondeurZigzag * 2) {
    const resZigzag = calculerZigZag(bougies, { depth: profondeurZigzag });
    if (resZigzag.pivots && resZigzag.pivots.length >= 2) {
      for (let k = 1; k < resZigzag.pivots.length; k++) {
        const p1 = resZigzag.pivots[k - 1];
        const p2 = resZigzag.pivots[k];
        lignesVisuelles.push({
          id: `liq-zigzag-line-${k}`,
          prix: p1.prix,
          prixFin: p2.prix,
          dateDebut: p1.temps,
          dateFin: p2.temps,
          couleur: couleurZigzag,
          epaisseur: 2,
          style: 'solid',
        });
      }
    }
  }

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

    // Calcul des extrêmes locaux pour le filtre Pic ZigZag (sur les profondeurZigzag bougies antérieures)
    let plusBasPrecedent = Infinity;
    let plusHautPrecedent = -Infinity;
    if (activerFiltreZigzag) {
      const indexFinZigzag = i - 2;
      const indexDebutZigzag = Math.max(0, i - 1 - profondeurZigzag);
      if (indexFinZigzag >= indexDebutZigzag) {
        for (let k = indexDebutZigzag; k <= indexFinZigzag; k++) {
          const bPrev = bougies[k];
          if (bPrev.low < plusBasPrecedent) plusBasPrecedent = bPrev.low;
          if (bPrev.high > plusHautPrecedent) plusHautPrecedent = bPrev.high;
        }
      } else {
        plusBasPrecedent = b1.low;
        plusHautPrecedent = b1.high;
      }
    }

    // ─── 🎯 VÉRIFICATION DES CONDITIONS DU DOJI (FONCTION UNIQUE ET CENTRALISÉE) ───
    const validation = validerDojiPersonnalise({
      b1,
      b2,
      moyRangeHist,
      moyCorpsHist,
      activerAchat,
      activerVente,
      activerFiltreTaille,
      toleranceDeficit,
      toleranceDepassement,
      multiplicateurBougie1,
      multiplicateurCorps2,
      activerFiltreZigzag,
      plusBasPrecedent,
      plusHautPrecedent,
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
      lignes: lignesVisuelles,
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
  const valDeficit = params.toleranceDeficit !== undefined ? params.toleranceDeficit : (params.toleranceProximite ?? 0.3);
  const toleranceDeficit = valDeficit > 1 ? valDeficit / 100 : valDeficit;

  const valDepassement = params.toleranceDepassement !== undefined ? params.toleranceDepassement : 2.0;
  const toleranceDepassement = valDepassement > 1 ? valDepassement / 100 : valDepassement;

  const activerFiltreTaille = params.activerFiltreTaille !== false;
  const periodeHistorique = Math.max(3, Number(params.periodeHistorique ?? 10));
  const multiplicateurBougie1 = Math.max(0.5, Number(params.multiplicateurBougie1 ?? 1.0));
  const multiplicateurCorps2 = Math.max(0.5, Number(params.multiplicateurCorps2 ?? 1.2));

  // ─── 📐 Filtre Pic ZigZag ───
  const activerFiltreZigzag = params.activerFiltreZigzag !== false;
  const profondeurZigzag = Math.max(2, Number(params.profondeurZigzag !== undefined ? params.profondeurZigzag : 5));

  const activerAchat = params.activerAchat !== false;
  const activerVente = params.activerVente !== false;

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

  // Calcul des extrêmes locaux pour le filtre Pic ZigZag
  let plusBasPrecedent = Infinity;
  let plusHautPrecedent = -Infinity;
  if (activerFiltreZigzag) {
    const indexFinZigzag = indexB2 - 2;
    const indexDebutZigzag = Math.max(0, indexB2 - 1 - profondeurZigzag);
    if (indexFinZigzag >= indexDebutZigzag) {
      for (let k = indexDebutZigzag; k <= indexFinZigzag; k++) {
        const bPrev = bougies[k];
        if (bPrev.low < plusBasPrecedent) plusBasPrecedent = bPrev.low;
        if (bPrev.high > plusHautPrecedent) plusHautPrecedent = bPrev.high;
      }
    } else {
      plusBasPrecedent = b1.low;
      plusHautPrecedent = b1.high;
    }
  }

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
    condDirectionValide = activerAchat;
  } else if (typeCandidat === 'VENTE') {
    condDirectionValide = activerVente;
  }
  conditions.push({
    titre: '2. Direction Autorisée',
    valide: condDirectionValide,
    valeurMesuree: typeCandidat === 'ACHAT'
      ? `Achats: ${activerAchat ? 'ON 🟢' : 'OFF 🔴'}`
      : `Ventes: ${activerVente ? 'ON 🟢' : 'OFF 🔴'}`,
    valeurRequise: typeCandidat === 'ACHAT' ? 'Achat activé dans les réglages' : 'Vente activée dans les réglages',
    explication: condDirectionValide
      ? 'La direction est autorisée par vos réglages'
      : 'La direction correspondante est désactivée dans vos réglages',
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

  // Condition 6 : Pic ZigZag (Creux pour Achat, Sommet pour Vente)
  let condZigzagValide = true;
  let valMesureeZigzag = '';
  let valRequiseZigzag = '';
  let expZigzag = '';

  if (typeCandidat === 'ACHAT') {
    const creuxSetup = Math.min(b1.low, b2.low);
    const estPicBas = creuxSetup <= plusBasPrecedent;
    condZigzagValide = !activerFiltreZigzag || estPicBas;
    valMesureeZigzag = `Creux setup: ${creuxSetup.toFixed(4)} vs plus bas des ${profondeurZigzag} barres: ${plusBasPrecedent.toFixed(4)}`;
    valRequiseZigzag = `Creux <= ${plusBasPrecedent.toFixed(4)} (Pic bas ZigZag)`;
    expZigzag = condZigzagValide
      ? `Le Doji acheteur est bien positionné sur un creux / pic bas ZigZag (${creuxSetup.toFixed(4)} <= ${plusBasPrecedent.toFixed(4)})`
      : `Rejeté par le ZigZag : la bougie précédente était plus basse (${plusBasPrecedent.toFixed(4)} < ${creuxSetup.toFixed(4)})`;
  } else if (typeCandidat === 'VENTE') {
    const sommetSetup = Math.max(b1.high, b2.high);
    const estPicHaut = sommetSetup >= plusHautPrecedent;
    condZigzagValide = !activerFiltreZigzag || estPicHaut;
    valMesureeZigzag = `Sommet setup: ${sommetSetup.toFixed(4)} vs plus haut des ${profondeurZigzag} barres: ${plusHautPrecedent.toFixed(4)}`;
    valRequiseZigzag = `Sommet >= ${plusHautPrecedent.toFixed(4)} (Pic haut ZigZag)`;
    expZigzag = condZigzagValide
      ? `Le Doji vendeur est bien positionné sur un sommet / pic haut ZigZag (${sommetSetup.toFixed(4)} >= ${plusHautPrecedent.toFixed(4)})`
      : `Rejeté par le ZigZag : la bougie précédente était plus haute (${plusHautPrecedent.toFixed(4)} > ${sommetSetup.toFixed(4)})`;
  } else {
    valMesureeZigzag = 'En attente d\'un sens opposé';
    valRequiseZigzag = `Doit marquer un extrême parmi les ${profondeurZigzag} barres`;
    expZigzag = 'Aucun retournement candidat';
  }

  conditions.push({
    titre: `6. Pic ZigZag (Extrême sur ${profondeurZigzag} barres)`,
    valide: condZigzagValide,
    valeurMesuree: valMesureeZigzag,
    valeurRequise: valRequiseZigzag,
    explication: expZigzag,
  });

  // Verdict global
  const estValideGlobal = condSensValide && condDirectionValide && condProximiteValide && condTailleB1Valide && condCorpsB2Valide && condZigzagValide;

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
    if (!condZigzagValide) motifsRejet.push(`pas sur un pic ZigZag (${typeCandidat === 'ACHAT' ? 'pas le plus bas' : 'pas le plus haut'})`);
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
