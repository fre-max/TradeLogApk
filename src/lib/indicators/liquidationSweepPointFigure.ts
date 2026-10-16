import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLabel, VisualLine, VisualBox, VisualPoint } from '@/types/indicatorScript';
import { validerDojiPersonnalise } from './liquidationReintegration';

/**
 * ==============================================================================
 * 📋 GUIDE DU DÉVELOPPEUR : CONDITIONS DU SETUP & RÈGLES DE MODIFICATION
 * ==============================================================================
 * Cet indicateur combine deux analyses complémentaires :
 *  1. Le chandelier Doji de retournement (Liq / Reint = Spring / UTAD)
 *  2. La Cause Point & Figure (P&F) : palier horizontal carré formé par des colonnes alignées
 *
 * 🎯 OÙ TROUVER ET MODIFIER LE CODE DES CONDITIONS ?
 *  👉 Condition du Doji : fonction `validerDojiPersonnalise()` dans `liquidationReintegration.ts`.
 *  👉 Condition du Palier P&F : fonction `validerPalierPF()` (vers la ligne 255).
 *
 * 🎯 LES CONDITIONS CLÉS DU SETUP POUR DÉVELOPPEUR JUNIOR :
 *
 * ─── CONDITION 1 : Formation du Doji Personnalisé ─────────────────────────────
 *  • B1 impulsive dans le sens du piège + B2 puissante en sens inverse.
 *  • Clôture de B2 au niveau d'Open1 (dépassement max: 25%, déficit max: 5%).
 *
 * ─── CONDITION 2 : Structure Carrée P&F (dans validerPalierPF) ────────────────
 *  • Au moins `minColonnesAlignees` colonnes alignées (défaut: 2).
 *  • En ACHAT : support formé par des bas de colonnes 'O'.
 *  • En VENTE : résistance formée par des hauts de colonnes 'X'.
 *
 * ─── CONDITION 3 : Non-Consommation (Palier Intact / Unmitigated) ─────────────
 *  • Le palier ne doit jamais avoir été clôturé au-delà avant notre bougie de setup.
 *
 * ─── CONDITION 4 : Balayage (Sweep) par la Mèche du Doji ─────────────────────
 *  • Pour Achat : le point bas de la mèche doit traverser sous le support P&F.
 *  • Pour Vente : le point haut de la mèche doit percer au-dessus de la résistance P&F.
 * ==============================================================================
 */

/**
 * Options de configuration pour l'indicateur combiné :
 * Liquidation & Réintégration avec Détection de la Liquidité Balayée par Point & Figure (P&F).
 * 
 * Vise spécifiquement la Cause Wyckoff la plus PROCHE, RÉCENTE et NON CONSOMMÉE (Unmitigated),
 * correspondant au comportement institutionnel réel d'un Spring ou UTAD,
 * avec détection des doubles liquidations (Re-Sweep de confirmation).
 */
export interface ParametresLiquidationSweepPF {
  // ── 🎯 Paramètres de la Grille Point & Figure ──
  // Mode de calcul de la taille de boîte : 'auto_atr' (adaptatif) ou 'fixe' (pips)
  modeTailleBox?: 'auto_atr' | 'fixe';
  // Période de l'ATR pour la taille de boîte automatique (défaut: 14)
  periodeATR?: number;
  // Ratio de l'ATR pour la taille de boîte (défaut: 0.5)
  ratioBoxATR?: number;
  // Taille fixe de la boîte en pips si mode fixe (défaut: 10)
  tailleBoxPips?: number;
  // Seuil de retournement pour changer de colonne (défaut: 3 boîtes)
  reversalCount?: number;
  // Nombre minimum de colonnes P&F alignées pour valider un niveau horizontal carré (défaut: 2)
  minColonnesAlignees?: number;
  // Nombre maximal de bougies antérieures pour construire la grille P&F (défaut: 60)
  // Évite d'aller chercher des vieux paliers d'il y a 300 bougies déjà morts
  lookbackBars?: number;
  // Si true, exige qu'un vrai niveau P&F horizontal ait été balayé (défaut: true)
  exigerNiveauPFBalaye?: boolean;

  // ── 🎯 Fraîcheur & Précision de la Liquidité (Wyckoff Spring/UTAD) ──
  // Exiger que le palier P&F n'ait JAMAIS été clôturé au-delà avant notre setup (Unmitigated) (défaut: true)
  exigerPalierIntact?: boolean;
  // Détecter et signaler les doubles liquidations (Re-Sweep / Confirmation de purge) (défaut: true)
  detecterDoubleLiquidation?: boolean;

  // ── 🕯️ Paramètres du Chandelier Liq/Reint ──
  // Tolérance si la réintégration reste en deçà d'Open1 (défaut: 0.05 = 5%)
  toleranceDeficit?: number;
  // Tolérance élargie en dépassement favorable (défaut: 0.25 = 25%)
  toleranceDepassement?: number;
  // Active le filtre d'impulsion sur l'historique récent (défaut: true)
  activerFiltreTaille?: boolean;
  // Période récente de référence pour la moyenne (défaut: 10)
  periodeHistorique?: number;
  // Multiplicateur pour Bougie 1 entière (défaut: 1.75x)
  multiplicateurBougie1?: number;
  // Multiplicateur pour le corps pur de Bougie 2 (défaut: 1.75x)
  multiplicateurCorps2?: number;

  // ── 🧭 Filtre de Tendance et Directions ──
  activerAchat?: boolean;
  activerVente?: boolean;
  activerFiltreTendance?: boolean;
  trendBars?: number;

  // ── 🎨 Affichage Graphique ──
  // Afficher la ligne horizontale du niveau P&F balayé (défaut: true)
  afficherLignePF?: boolean;
  // Afficher la boîte de la zone de sweep (défaut: true)
  afficherZoneSweep?: boolean;
  // Afficher le rectangle de consolidation de la cause P&F (défaut: true)
  afficherBoiteCausePF?: boolean;
  bullColor?: string;
  bearColor?: string;
  texteLabel?: string;
}

/**
 * Représente une colonne du graphique Point & Figure
 */
export interface ColonnePFLocale {
  type: 'X' | 'O';
  haut: number;
  bas: number;
  indexDebut: number;
  indexFin: number;
  tempsDebut: number | string;
  tempsFin: number | string;
}

/**
 * Représente un palier horizontal P&F (Support ou Résistance carré avec colonnes alignées)
 */
export interface PalierHorizontalPF {
  type: 'SUPPORT_O' | 'RESISTANCE_X';
  prixNiveau: number;
  nbColonnesAlignees: number;
  solidite: 'CARRE_MAJEUR' | 'SOLIDE' | 'STANDARD';
  tempsDebut: number | string;
  tempsFin: number | string;
  indexDebut: number;
  indexFin: number;
  profondeurSweep: number;
  estDoubleLiquidation?: boolean;
  prixPremiereLiquidation?: number;
}

/**
 * Détail d'un signal combiné Liq/Reint + Point & Figure
 */
export interface SignalLiquidationSweepPF {
  type: 'ACHAT' | 'VENTE';
  indexBougie: number;
  temps: number | string;
  prixSignal: number;
  prixExtreme: number;
  bougieExtreme: 1 | 2;
  open1: number;
  close2: number;
  ecartPrix: number;
  ratioEcart: number;
  situationCloture: 'DEPASSEMENT' | 'RETRAIT';
  rangeBougie1: number;
  corpsBougie2: number;
  niveauPF?: PalierHorizontalPF;
  estDoubleLiquidation?: boolean;
  prixPremiereLiquidation?: number;
}

/**
 * Résultat complet de l'indicateur combiné Point & Figure
 */
export interface ResultatLiquidationSweepPF {
  signaux: SignalLiquidationSweepPF[];
  primitives: VisualPrimitives;
  tailleBoxCalculee: number;
  statistiques: {
    totalSignaux: number;
    totalAchats: number;
    totalVentes: number;
    totalSweepsPF: number;
    totalDoubleLiquidations: number;
    totalCarresMajeurs: number;
    totalSolides: number;
    maxColonnesAlignees: number;
  };
}

/**
 * Construit les colonnes Point & Figure sur les bougies fournies
 */
export function construireColonnesPF(
  bougies: Bougie[],
  indexFin: number,
  tailleBox: number,
  reversalCount: number,
  lookback: number
): ColonnePFLocale[] {
  const debutIndex = Math.max(0, indexFin - lookback);
  if (debutIndex >= indexFin) return [];

  const colonnes: ColonnePFLocale[] = [];
  let colType: 'X' | 'O' = bougies[debutIndex].close >= bougies[debutIndex].open ? 'X' : 'O';
  let colBas = Math.floor(bougies[debutIndex].low / tailleBox) * tailleBox;
  let colHaut = Math.ceil(bougies[debutIndex].high / tailleBox) * tailleBox;
  if (colHaut <= colBas) colHaut = colBas + tailleBox;

  let colIndexDebut = debutIndex;
  let colIndexFin = debutIndex;
  let colTempsDebut = bougies[debutIndex].time;
  let colTempsFin = bougies[debutIndex].time;

  for (let i = debutIndex + 1; i <= indexFin; i++) {
    const b = bougies[i];

    if (colType === 'X') {
      // Progression vers le haut
      if (b.high >= colHaut + tailleBox) {
        const boites = Math.floor((b.high - colHaut) / tailleBox);
        colHaut += boites * tailleBox;
        colIndexFin = i;
        colTempsFin = b.time;
      } else {
        // Retournement baissier
        const seuil = colHaut - (reversalCount * tailleBox);
        if (b.low <= seuil) {
          colonnes.push({
            type: 'X',
            haut: colHaut,
            bas: colBas,
            indexDebut: colIndexDebut,
            indexFin: colIndexFin,
            tempsDebut: colTempsDebut,
            tempsFin: colTempsFin,
          });
          colType = 'O';
          colHaut = colHaut - tailleBox;
          const boitesBaisse = Math.floor((colHaut - b.low) / tailleBox);
          colBas = colHaut - (boitesBaisse * tailleBox);
          colIndexDebut = i;
          colIndexFin = i;
          colTempsDebut = b.time;
          colTempsFin = b.time;
        }
      }
    } else {
      // Progression vers le bas
      if (b.low <= colBas - tailleBox) {
        const boites = Math.floor((colBas - b.low) / tailleBox);
        colBas -= boites * tailleBox;
        colIndexFin = i;
        colTempsFin = b.time;
      } else {
        // Retournement haussier
        const seuil = colBas + (reversalCount * tailleBox);
        if (b.high >= seuil) {
          colonnes.push({
            type: 'O',
            haut: colHaut,
            bas: colBas,
            indexDebut: colIndexDebut,
            indexFin: colIndexFin,
            tempsDebut: colTempsDebut,
            tempsFin: colTempsFin,
          });
          colType = 'X';
          colBas = colBas + tailleBox;
          const boitesHausse = Math.floor((b.high - colBas) / tailleBox);
          colHaut = colBas + (boitesHausse * tailleBox);
          colIndexDebut = i;
          colIndexFin = i;
          colTempsDebut = b.time;
          colTempsFin = b.time;
        }
      }
    }
  }

  colonnes.push({
    type: colType,
    haut: colHaut,
    bas: colBas,
    indexDebut: colIndexDebut,
    indexFin: colIndexFin,
    tempsDebut: colTempsDebut,
    tempsFin: colTempsFin,
  });

  return colonnes;
}

/**
 * ==============================================================================
 * 🎯 FONCTION CENTRALE DE VALIDATION DU PALIER POINT & FIGURE (P&F)
 * ==============================================================================
 * Cette fonction rassemble TOUTES les conditions qu'un palier horizontal P&F
 * (Support 'O' ou Résistance 'X') doit respecter pour être retenu comme niveau balayé.
 *
 * Pour un développeur junior :
 * Si tu souhaites assouplir ou modifier les règles de sélection P&F,
 * c'est ICI qu'il faut intervenir !
 *
 * Règles vérifiées :
 *  1️⃣ Le palier n'est pas consommé (intact / unmitigated)
 *  2️⃣ Le palier compte au moins `minColonnesAlignees` colonnes alignées (structure solide)
 *  3️⃣ En ACHAT : la mèche basse du setup a balayé sous le support P&F (prixExtreme < prixNiveau)
 *  4️⃣ En ACHAT : le support reste sous la référence haute (prixNiveau <= prixReference)
 *  5️⃣ En VENTE : la mèche haute du setup a balayé au-dessus de la résistance P&F (prixExtreme > prixNiveau)
 *  6️⃣ En VENTE : la résistance reste au-dessus de la référence basse (prixNiveau >= prixReference)
 *
 * Exemple :
 * const estValide = validerPalierPF({
 *   direction: 'ACHAT',
 *   prixExtreme: 1.0920,
 *   prixNiveau: 1.0950,
 *   prixReference: 1.1000,
 *   nbColonnesAlignees: 3,
 *   minColonnesAlignees: 2,
 *   estConsomme: false
 * }); // Renvoie true
 */
export function validerPalierPF(params: {
  direction: 'ACHAT' | 'VENTE';
  prixExtreme: number;
  prixNiveau: number;
  prixReference: number;
  nbColonnesAlignees: number;
  minColonnesAlignees: number;
  estConsomme: boolean;
}): boolean {
  const {
    direction,
    prixExtreme,
    prixNiveau,
    prixReference,
    nbColonnesAlignees,
    minColonnesAlignees,
    estConsomme,
  } = params;

  // 1️⃣ Le palier ne doit pas avoir été violé / consommé antérieurement
  if (estConsomme) {
    return false;
  }

  // 2️⃣ La structure P&F doit comporter assez de colonnes alignées
  if (nbColonnesAlignees < minColonnesAlignees) {
    return false;
  }

  // 3️⃣ Balayage géométrique et cohérence des bornes de prix
  if (direction === 'ACHAT') {
    // La mèche basse doit balayer SOUS le support
    if (prixExtreme >= prixNiveau) {
      return false;
    }
    // Le support doit rester sous la référence haute
    if (prixNiveau > prixReference) {
      return false;
    }
  } else {
    // La mèche haute doit balayer AU-DESSUS de la résistance
    if (prixExtreme <= prixNiveau) {
      return false;
    }
    // La résistance doit rester au-dessus de la référence basse
    if (prixNiveau < prixReference) {
      return false;
    }
  }

  return true;
}

/**
 * Recherche le palier horizontal P&F (support ou résistance le plus adapté)
 * qui a été balayé par la manipulation immédiate :
 * 1. Palier intact (Unmitigated) : aucune clôture antérieure n'est passée à travers
 * 2. Récence et proximité : c'est la consolidation immédiate que le Spring/UTAD liquide
 * 3. Détection de la double liquidation P&F
 */
function identifierPalierPFLePlusAdapte(
  colonnes: ColonnePFLocale[],
  direction: 'ACHAT' | 'VENTE',
  prixExtreme: number,
  tailleBox: number,
  minColonnesAlignees: number,
  prixReferenceHaut: number,
  prixReferenceBas: number,
  indexSetup: number,
  bougies: Bougie[],
  exigerPalierIntact: boolean,
  detecterDoubleLiquidation: boolean
): PalierHorizontalPF | null {
  if (colonnes.length < 2) return null;

  const margeBox = tailleBox * 1.25;
  const paliersCandidats: Array<PalierHorizontalPF & { scorePertinence: number }> = [];

  if (direction === 'ACHAT') {
    // 🟢 Recherche de supports formés par les bas de colonnes 'O'
    const colonnesO = colonnes.filter((c) => c.type === 'O');

    for (let i = 0; i < colonnesO.length; i++) {
      const colBase = colonnesO[i];
      const prixSupport = colBase.bas;

      // 1️⃣ Vérification de Non-Consommation (Unmitigated / Palier Intact) :
      let estConsomme = false;
      if (exigerPalierIntact) {
        const indexFinControle = Math.max(colBase.indexFin + 1, indexSetup - 2);
        for (let k = colBase.indexFin + 1; k < indexFinControle; k++) {
          if (bougies[k] && bougies[k].close < prixSupport) {
            estConsomme = true;
            break;
          }
        }
      }

      // 2️⃣ Comptage des colonnes 'O' alignées
      let countAlignes = 0;
      let minIdx = colBase.indexDebut;
      let maxIdx = colBase.indexFin;
      let dateDeb = colBase.tempsDebut;
      let dateFin = colBase.tempsFin;

      for (let j = 0; j < colonnesO.length; j++) {
        if (Math.abs(colonnesO[j].bas - prixSupport) <= margeBox) {
          countAlignes++;
          if (colonnesO[j].indexDebut < minIdx) {
            minIdx = colonnesO[j].indexDebut;
            dateDeb = colonnesO[j].tempsDebut;
          }
          if (colonnesO[j].indexFin > maxIdx) {
            maxIdx = colonnesO[j].indexFin;
            dateFin = colonnesO[j].tempsFin;
          }
        }
      }

      // ✅ Utilisation de la fonction centrale de validation du palier P&F
      const estValide = validerPalierPF({
        direction: 'ACHAT',
        prixExtreme,
        prixNiveau: prixSupport,
        prixReference: prixReferenceHaut,
        nbColonnesAlignees: countAlignes,
        minColonnesAlignees,
        estConsomme,
      });

      if (!estValide) continue;
        let solidite: 'CARRE_MAJEUR' | 'SOLIDE' | 'STANDARD' = 'STANDARD';
        if (countAlignes >= 4) solidite = 'CARRE_MAJEUR';
        else if (countAlignes >= 3) solidite = 'SOLIDE';

        // 3️⃣ Détection de la Double Liquidation (Re-Sweep) :
        let estDoubleLiq = false;
        let prixPremLiq: number | undefined = undefined;

        if (detecterDoubleLiquidation) {
          // Cas 1 : La bougie 1 du setup a percé le niveau et la bougie 2 va encore plus bas
          const b1 = bougies[indexSetup - 1];
          const b2 = bougies[indexSetup];
          if (b1 && b2 && b2.low < b1.low && b1.low <= prixSupport + margeBox) {
            estDoubleLiq = true;
            prixPremLiq = b1.low;
          } else {
            // Cas 2 : Une bougie dans les 6 bougies récentes précédant le setup
            const indexDebutRecent = Math.max(0, indexSetup - 6);
            let minRecent = Infinity;
            for (let m = indexDebutRecent; m <= indexSetup - 2; m++) {
              if (bougies[m] && bougies[m].low <= prixSupport + margeBox) {
                if (bougies[m].low < minRecent) {
                  minRecent = bougies[m].low;
                }
              }
            }
            if (minRecent < Infinity && prixExtreme < minRecent) {
              estDoubleLiq = true;
              prixPremLiq = minRecent;
            }
          }
        }

        // 4️⃣ Score de pertinence : récence de la consolidation + alignement + double liq
        const ecartBougies = indexSetup - maxIdx;
        const scoreRecence = Math.max(0, 100 - ecartBougies * 2);
        const scoreColonnes = countAlignes * 15;
        const bonusDoubleLiq = estDoubleLiq ? 35 : 0;
        const scorePertinence = scoreRecence + scoreColonnes + bonusDoubleLiq;

        paliersCandidats.push({
          type: 'SUPPORT_O',
          prixNiveau: prixSupport,
          nbColonnesAlignees: countAlignes,
          solidite,
          tempsDebut: dateDeb,
          tempsFin: dateFin,
          indexDebut: minIdx,
          indexFin: maxIdx,
          profondeurSweep: prixSupport - prixExtreme,
          estDoubleLiquidation: estDoubleLiq,
          prixPremiereLiquidation: prixPremLiq,
          scorePertinence,
        });
    }
  } else {
    // 🔴 Recherche de résistances formées par les hauts de colonnes 'X'
    const colonnesX = colonnes.filter((c) => c.type === 'X');

    for (let i = 0; i < colonnesX.length; i++) {
      const colBase = colonnesX[i];
      const prixResistance = colBase.haut;

      // 1️⃣ Non-Consommation :
      let estConsomme = false;
      if (exigerPalierIntact) {
        const indexFinControle = Math.max(colBase.indexFin + 1, indexSetup - 2);
        for (let k = colBase.indexFin + 1; k < indexFinControle; k++) {
          if (bougies[k] && bougies[k].close > prixResistance) {
            estConsomme = true;
            break;
          }
        }
      }

      let countAlignes = 0;
      let minIdx = colBase.indexDebut;
      let maxIdx = colBase.indexFin;
      let dateDeb = colBase.tempsDebut;
      let dateFin = colBase.tempsFin;

      for (let j = 0; j < colonnesX.length; j++) {
        if (Math.abs(colonnesX[j].haut - prixResistance) <= margeBox) {
          countAlignes++;
          if (colonnesX[j].indexDebut < minIdx) {
            minIdx = colonnesX[j].indexDebut;
            dateDeb = colonnesX[j].tempsDebut;
          }
          if (colonnesX[j].indexFin > maxIdx) {
            maxIdx = colonnesX[j].indexFin;
            dateFin = colonnesX[j].tempsFin;
          }
        }
      }

      // ✅ Utilisation de la fonction centrale de validation du palier P&F
      const estValide = validerPalierPF({
        direction: 'VENTE',
        prixExtreme,
        prixNiveau: prixResistance,
        prixReference: prixReferenceBas,
        nbColonnesAlignees: countAlignes,
        minColonnesAlignees,
        estConsomme,
      });

      if (!estValide) continue;

      let solidite: 'CARRE_MAJEUR' | 'SOLIDE' | 'STANDARD' = 'STANDARD';
      if (countAlignes >= 4) solidite = 'CARRE_MAJEUR';
      else if (countAlignes >= 3) solidite = 'SOLIDE';

        // 3️⃣ Détection Double Liquidation :
        let estDoubleLiq = false;
        let prixPremLiq: number | undefined = undefined;

        if (detecterDoubleLiquidation) {
          // Cas 1 : La bougie 1 du setup a percé le niveau et la bougie 2 va encore plus haut
          const b1 = bougies[indexSetup - 1];
          const b2 = bougies[indexSetup];
          if (b1 && b2 && b2.high > b1.high && b1.high >= prixResistance - margeBox) {
            estDoubleLiq = true;
            prixPremLiq = b1.high;
          } else {
            // Cas 2 : Une bougie dans les 6 bougies récentes précédant le setup
            const indexDebutRecent = Math.max(0, indexSetup - 6);
            let maxRecent = -Infinity;
            for (let m = indexDebutRecent; m <= indexSetup - 2; m++) {
              if (bougies[m] && bougies[m].high >= prixResistance - margeBox) {
                if (bougies[m].high > maxRecent) {
                  maxRecent = bougies[m].high;
                }
              }
            }
            if (maxRecent > -Infinity && prixExtreme > maxRecent) {
              estDoubleLiq = true;
              prixPremLiq = maxRecent;
            }
          }
        }

        const ecartBougies = indexSetup - maxIdx;
        const scoreRecence = Math.max(0, 100 - ecartBougies * 2);
        const scoreColonnes = countAlignes * 15;
        const bonusDoubleLiq = estDoubleLiq ? 35 : 0;
        const scorePertinence = scoreRecence + scoreColonnes + bonusDoubleLiq;

        paliersCandidats.push({
          type: 'RESISTANCE_X',
          prixNiveau: prixResistance,
          nbColonnesAlignees: countAlignes,
          solidite,
          tempsDebut: dateDeb,
          tempsFin: dateFin,
          indexDebut: minIdx,
          indexFin: maxIdx,
          profondeurSweep: prixExtreme - prixResistance,
          estDoubleLiquidation: estDoubleLiq,
          prixPremiereLiquidation: prixPremLiq,
          scorePertinence,
        });
    }
  }

  if (paliersCandidats.length === 0) return null;

  // Sélection du palier ayant le meilleur score de pertinence
  return paliersCandidats.reduce((meilleur, p) => {
    return p.scorePertinence > meilleur.scorePertinence ? p : meilleur;
  }, paliersCandidats[0]);
}

/**
 * Indicateur combiné : Détecte le setup de réintégration (Liq/Reint)
 * et identifie précisément quel palier Point & Figure (Cause Wyckoff fraîche et intacte)
 * a été balayé par la manipulation (avec détection de double liquidation).
 * 
 * Exemple :
 * const res = calculerLiquidationSweepPointFigure(bougies, { lookbackBars: 60 });
 */
export function calculerLiquidationSweepPointFigure(
  bougies: Bougie[],
  options?: ParametresLiquidationSweepPF
): ResultatLiquidationSweepPF {
  if (!bougies || bougies.length < 10) {
    return {
      signaux: [],
      primitives: { labels: [], lignes: [], boites: [], points: [] },
      tailleBoxCalculee: 0,
      statistiques: {
        totalSignaux: 0,
        totalAchats: 0,
        totalVentes: 0,
        totalSweepsPF: 0,
        totalDoubleLiquidations: 0,
        totalCarresMajeurs: 0,
        totalSolides: 0,
        maxColonnesAlignees: 0,
      },
    };
  }

  // 1️⃣ Extraction des paramètres
  const params = options || {};
  const valDeficit = params.toleranceDeficit !== undefined ? params.toleranceDeficit : 0.05;
  const toleranceDeficit = valDeficit > 1 ? valDeficit / 100 : valDeficit;
  const valDepassement = params.toleranceDepassement !== undefined ? params.toleranceDepassement : 0.25;
  const toleranceDepassement = valDepassement > 1 ? valDepassement / 100 : valDepassement;

  const modeTailleBox = params.modeTailleBox || 'auto_atr';
  const periodeATR = Math.max(5, Number(params.periodeATR ?? 14));
  const ratioBoxATR = Math.max(0.1, Number(params.ratioBoxATR ?? 0.5));
  const tailleBoxPips = Math.max(1, Number(params.tailleBoxPips ?? 10));
  const reversalCount = Math.max(1, Number(params.reversalCount ?? 3));
  const minColonnes = Math.max(2, Number(params.minColonnesAlignees ?? 2));
  // Lookback plus court par défaut (60 bougies au lieu de 300) pour cibler la consolidation immédiate
  const lookbackBars = Math.max(20, Math.min(200, Number(params.lookbackBars ?? 60)));
  const exigerNiveauPF = params.exigerNiveauPFBalaye !== false;
  const exigerPalierIntact = params.exigerPalierIntact !== false;
  const detecterDoubleLiquidation = params.detecterDoubleLiquidation !== false;

  const activerFiltreTaille = params.activerFiltreTaille !== false;
  const periodeHistorique = Math.max(3, Number(params.periodeHistorique ?? 10));
  const multiplicateurBougie1 = Math.max(0.5, Number(params.multiplicateurBougie1 ?? 1.75));
  const multiplicateurCorps2 = Math.max(0.5, Number(params.multiplicateurCorps2 ?? 1.75));

  const activerAchat = params.activerAchat !== false;
  const activerVente = params.activerVente !== false;
  const activerFiltreTendance = Boolean(params.activerFiltreTendance);
  const trendBars = Math.max(1, Number(params.trendBars ?? 5));

  const afficherLigne = params.afficherLignePF !== false;
  // Par défaut false : l'utilisateur préfère un segment en ligne discontinue plutôt qu'une zone en rectangle
  const afficherZone = Boolean(params.afficherZoneSweep);
  const afficherBoiteCause = Boolean(params.afficherBoiteCausePF);
  const bullColor = params.bullColor || '#00E676';
  const bearColor = params.bearColor || '#F23645';
  const texteLabel = params.texteLabel || 'Liq/Reint';

  // 2️⃣ Taille de boîte P&F
  const dernierPrix = bougies[bougies.length - 1].close;
  let pipSize = 0.0001;
  if (dernierPrix > 1000) pipSize = 0.1;
  else if (dernierPrix > 50) pipSize = 0.01;

  let tailleBox = 10 * pipSize;
  if (modeTailleBox === 'auto_atr') {
    let sommeTR = 0;
    const debutATR = Math.max(1, bougies.length - periodeATR);
    for (let i = debutATR; i < bougies.length; i++) {
      const h = bougies[i].high;
      const l = bougies[i].low;
      const prevClose = bougies[i - 1].close;
      sommeTR += Math.max(h - l, Math.abs(h - prevClose), Math.abs(l - prevClose));
    }
    const atrMoyen = sommeTR / Math.max(1, bougies.length - debutATR);
    tailleBox = Math.max(pipSize, atrMoyen * ratioBoxATR);
  } else {
    tailleBox = Math.max(pipSize, tailleBoxPips * pipSize);
  }

  const signaux: SignalLiquidationSweepPF[] = [];
  const labels: VisualLabel[] = [];
  const lignes: VisualLine[] = [];
  const boites: VisualBox[] = [];
  const points: VisualPoint[] = [];

  let countAchats = 0;
  let countVentes = 0;
  let countSweepsPF = 0;
  let countDoubleLiq = 0;
  let countMajeurs = 0;
  let countSolides = 0;
  let maxColsAlignees = 0;

  // 3️⃣ Parcours linéaire des bougies pour détecter le setup Liq/Reint (Spring/UTAD)
  for (let i = 1; i < bougies.length; i++) {
    const b1 = bougies[i - 1];
    const b2 = bougies[i];
    // Moyennes historiques pour le Doji
    let moyRange = 0;
    let moyCorps = 0;
    if (activerFiltreTaille) {
      const indexFinHist = i - 2;
      const indexDebutHist = Math.max(0, i - 1 - periodeHistorique);
      const nbBougiesHist = indexFinHist - indexDebutHist + 1;
      if (nbBougiesHist >= 3) {
        let sommeRanges = 0;
        let sommeCorps = 0;
        for (let k = indexDebutHist; k <= indexFinHist; k++) {
          sommeRanges += (bougies[k].high - bougies[k].low);
          sommeCorps += Math.abs(bougies[k].open - bougies[k].close);
        }
        moyRange = sommeRanges / nbBougiesHist;
        moyCorps = sommeCorps / nbBougiesHist;
      }
    }

    const idxTrend = Math.max(0, i - trendBars);
    const openTrend = bougies[idxTrend].open;

    // ─── 🎯 VÉRIFICATION CENTRALISÉE DU DOJI ───
    const valDoji = validerDojiPersonnalise({
      b1,
      b2,
      moyRangeHist: moyRange,
      moyCorpsHist: moyCorps,
      openTendance: openTrend,
      activerAchat,
      activerVente,
      activerFiltreTaille,
      activerFiltreTendance,
      toleranceDeficit,
      toleranceDepassement,
      multiplicateurBougie1,
      multiplicateurCorps2,
    });

    if (!valDoji.estValide) continue;

    const estCandidatAchat = valDoji.type === 'ACHAT';
    const estCandidatVente = valDoji.type === 'VENTE';
    const situationCloture = valDoji.situationCloture;
    const ecartPrix = valDoji.ecartPrix;
    const ratioEcart = valDoji.ratioEcart;
    const range1 = valDoji.rangeBougie1;
    const corps2 = valDoji.corpsBougie2;

    // Point extrême de liquidation
    let prixExtreme = 0;
    let bougieExtreme: 1 | 2 = 1;
    const indexFinScanPF = i - 2;

    if (estCandidatAchat) {
      if (b2.low <= b1.low) {
        prixExtreme = b2.low;
        bougieExtreme = 2;
      } else {
        prixExtreme = b1.low;
        bougieExtreme = 1;
      }

      // Construction P&F sur la fenêtre récente précédant le setup
      const colonnes = construireColonnesPF(bougies, indexFinScanPF, tailleBox, reversalCount, lookbackBars);
      const palierTrouve = identifierPalierPFLePlusAdapte(
        colonnes,
        'ACHAT',
        prixExtreme,
        tailleBox,
        minColonnes,
        Math.max(b1.open, b1.high),
        b1.low,
        i,
        bougies,
        exigerPalierIntact,
        detecterDoubleLiquidation
      );

      if (exigerNiveauPF && !palierTrouve) continue;

      if (palierTrouve) {
        countSweepsPF++;
        if (palierTrouve.estDoubleLiquidation) countDoubleLiq++;
        if (palierTrouve.solidite === 'CARRE_MAJEUR') countMajeurs++;
        else if (palierTrouve.solidite === 'SOLIDE') countSolides++;
        if (palierTrouve.nbColonnesAlignees > maxColsAlignees) {
          maxColsAlignees = palierTrouve.nbColonnesAlignees;
        }
      }
      countAchats++;

      signaux.push({
        type: 'ACHAT',
        indexBougie: i,
        temps: b2.time,
        prixSignal: b2.low,
        prixExtreme,
        bougieExtreme,
        open1: b1.open,
        close2: b2.close,
        ecartPrix,
        ratioEcart,
        situationCloture,
        rangeBougie1: range1,
        corpsBougie2: corps2,
        niveauPF: palierTrouve || undefined,
        estDoubleLiquidation: palierTrouve?.estDoubleLiquidation,
        prixPremiereLiquidation: palierTrouve?.prixPremiereLiquidation,
      });

      // Construction du badge
      let titreSignal = texteLabel;
      if (palierTrouve?.estDoubleLiquidation) {
        titreSignal = `2x Liq (Re-Sweep)`;
      } else if (palierTrouve) {
        titreSignal = `Spring P&F`;
      }

      const badgePF = palierTrouve
        ? `\nSupport P&F (${palierTrouve.prixNiveau.toFixed(4)}) [${palierTrouve.nbColonnesAlignees} cols]`
        : '';

      labels.push({
        id: `pf-achat-lbl-${i}`,
        prix: b2.low,
        date: b2.time,
        texte: `${titreSignal}${badgePF}`,
        couleur: bullColor,
        position: 'below',
      });

      points.push({
        id: `pf-achat-pt-${i}`,
        prix: prixExtreme,
        date: bougieExtreme === 1 ? b1.time : b2.time,
        couleur: bullColor,
      });

      if (palierTrouve && afficherLigne) {
        lignes.push({
          id: `pf-ligne-support-${i}`,
          prix: palierTrouve.prixNiveau,
          dateDebut: palierTrouve.tempsDebut,
          dateFin: b2.time,
          couleur: bullColor,
          epaisseur: palierTrouve.solidite === 'CARRE_MAJEUR' ? 2 : 1.5,
          style: 'dashed',
          label: `Support P&F (${palierTrouve.nbColonnesAlignees} colonnes)`,
        });
      }

      if (palierTrouve && afficherZone) {
        boites.push({
          id: `pf-sweep-support-${i}`,
          prixHaut: palierTrouve.prixNiveau,
          prixBas: prixExtreme,
          dateDebut: b1.time,
          dateFin: b2.time,
          couleurFond: 'rgba(0, 230, 118, 0.28)',
          couleurBordure: bullColor,
          label: palierTrouve.estDoubleLiquidation ? `2x Sweep (-${palierTrouve.profondeurSweep.toFixed(4)})` : `Sweep (-${palierTrouve.profondeurSweep.toFixed(4)})`,
        });
      }

      if (palierTrouve && afficherBoiteCause) {
        boites.push({
          id: `pf-cause-support-${i}`,
          prixHaut: palierTrouve.prixNiveau + (tailleBox * reversalCount),
          prixBas: palierTrouve.prixNiveau,
          dateDebut: palierTrouve.tempsDebut,
          dateFin: palierTrouve.tempsFin,
          couleurFond: 'rgba(0, 230, 118, 0.08)',
          couleurBordure: bullColor,
          label: `Cause P&F (${palierTrouve.nbColonnesAlignees} colonnes)`,
        });
      }

    } else if (estCandidatVente) {
      if (b2.high >= b1.high) {
        prixExtreme = b2.high;
        bougieExtreme = 2;
      } else {
        prixExtreme = b1.high;
        bougieExtreme = 1;
      }

      const colonnes = construireColonnesPF(bougies, indexFinScanPF, tailleBox, reversalCount, lookbackBars);
      const palierTrouve = identifierPalierPFLePlusAdapte(
        colonnes,
        'VENTE',
        prixExtreme,
        tailleBox,
        minColonnes,
        b1.high,
        Math.min(b1.open, b1.low),
        i,
        bougies,
        exigerPalierIntact,
        detecterDoubleLiquidation
      );

      if (exigerNiveauPF && !palierTrouve) continue;

      if (palierTrouve) {
        countSweepsPF++;
        if (palierTrouve.estDoubleLiquidation) countDoubleLiq++;
        if (palierTrouve.solidite === 'CARRE_MAJEUR') countMajeurs++;
        else if (palierTrouve.solidite === 'SOLIDE') countSolides++;
        if (palierTrouve.nbColonnesAlignees > maxColsAlignees) {
          maxColsAlignees = palierTrouve.nbColonnesAlignees;
        }
      }
      countVentes++;

      signaux.push({
        type: 'VENTE',
        indexBougie: i,
        temps: b2.time,
        prixSignal: b2.high,
        prixExtreme,
        bougieExtreme,
        open1: b1.open,
        close2: b2.close,
        ecartPrix,
        ratioEcart,
        situationCloture,
        rangeBougie1: range1,
        corpsBougie2: corps2,
        niveauPF: palierTrouve || undefined,
        estDoubleLiquidation: palierTrouve?.estDoubleLiquidation,
        prixPremiereLiquidation: palierTrouve?.prixPremiereLiquidation,
      });

      let titreSignal = texteLabel;
      if (palierTrouve?.estDoubleLiquidation) {
        titreSignal = `2x Liq (Re-Sweep)`;
      } else if (palierTrouve) {
        titreSignal = `UTAD P&F`;
      }

      const badgePF = palierTrouve
        ? `\nRésistance P&F (${palierTrouve.prixNiveau.toFixed(4)}) [${palierTrouve.nbColonnesAlignees} cols]`
        : '';

      labels.push({
        id: `pf-vente-lbl-${i}`,
        prix: b2.high,
        date: b2.time,
        texte: `${titreSignal}${badgePF}`,
        couleur: bearColor,
        position: 'above',
      });

      points.push({
        id: `pf-vente-pt-${i}`,
        prix: prixExtreme,
        date: bougieExtreme === 1 ? b1.time : b2.time,
        couleur: bearColor,
      });

      if (palierTrouve && afficherLigne) {
        lignes.push({
          id: `pf-ligne-resistance-${i}`,
          prix: palierTrouve.prixNiveau,
          dateDebut: palierTrouve.tempsDebut,
          dateFin: b2.time,
          couleur: bearColor,
          epaisseur: palierTrouve.solidite === 'CARRE_MAJEUR' ? 2 : 1.5,
          style: 'dashed',
          label: `Résistance P&F (${palierTrouve.nbColonnesAlignees} colonnes)`,
        });
      }

      if (palierTrouve && afficherZone) {
        boites.push({
          id: `pf-sweep-resistance-${i}`,
          prixHaut: prixExtreme,
          prixBas: palierTrouve.prixNiveau,
          dateDebut: b1.time,
          dateFin: b2.time,
          couleurFond: 'rgba(242, 54, 69, 0.28)',
          couleurBordure: bearColor,
          label: palierTrouve.estDoubleLiquidation ? `2x Sweep (+${palierTrouve.profondeurSweep.toFixed(4)})` : `Sweep (+${palierTrouve.profondeurSweep.toFixed(4)})`,
        });
      }

      if (palierTrouve && afficherBoiteCause) {
        boites.push({
          id: `pf-cause-resistance-${i}`,
          prixHaut: palierTrouve.prixNiveau,
          prixBas: palierTrouve.prixNiveau - (tailleBox * reversalCount),
          dateDebut: palierTrouve.tempsDebut,
          dateFin: palierTrouve.tempsFin,
          couleurFond: 'rgba(242, 54, 69, 0.08)',
          couleurBordure: bearColor,
          label: `Cause P&F (${palierTrouve.nbColonnesAlignees} colonnes)`,
        });
      }
    }
  }

  return {
    signaux,
    primitives: { labels, lignes, boites, points },
    tailleBoxCalculee: tailleBox,
    statistiques: {
      totalSignaux: signaux.length,
      totalAchats: countAchats,
      totalVentes: countVentes,
      totalSweepsPF: countSweepsPF,
      totalDoubleLiquidations: countDoubleLiq,
      totalCarresMajeurs: countMajeurs,
      totalSolides: countSolides,
      maxColonnesAlignees: maxColsAlignees,
    },
  };
}
