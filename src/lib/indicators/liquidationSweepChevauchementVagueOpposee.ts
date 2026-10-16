import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLabel, VisualLine, VisualPoint } from '@/types/indicatorScript';
import { determinerStepPrix, type PointZigZag } from '@/lib/indicators/unmitigatedVolumeProfile';
import { detecterPivotsZigZagAvance } from '@/lib/bot/modules/03_tp_uop/unmitigatedOverlapProfile';
import { validerDojiPersonnalise } from './liquidationReintegration';

/**
 * ==============================================================================
 * 📋 GUIDE DU DÉVELOPPEUR : CONDITIONS DU SETUP & RÈGLES DE MODIFICATION
 * ==============================================================================
 * Cet indicateur combine deux analyses complémentaires :
 *  1. Le chandelier Doji de retournement (Liq / Reint = Spring / UTAD)
 *  2. Le palier horizontal de trafic de la vague ZigZag opposée précédente
 *
 * 🎯 OÙ TROUVER ET MODIFIER LE CODE DES CONDITIONS ?
 *  👉 Condition du Doji : fonction `validerDojiPersonnalise()` dans `liquidationReintegration.ts`.
 *  👉 Condition de la Vague Opposée : fonction `validerPalierVagueOpposee()` (vers la ligne 125).
 *
 * 🎯 LES CONDITIONS CLÉS DU SETUP POUR DÉVELOPPEUR JUNIOR :
 *
 * ─── CONDITION 1 : Formation du Doji Personnalisé ─────────────────────────────
 *  • B1 impulsive dans le sens du piège + B2 puissante en sens inverse.
 *  • Clôture de B2 au niveau d'Open1 (dépassement max: 25%, déficit max: 5%).
 *
 * ─── CONDITION 2 : Trafic de la Vague Opposée (dans validerPalierVagueOpposee) ─
 *  • Le palier doit avoir été traversé par au moins `minBougiesChevauchement` bougies (défaut: 2).
 *
 * ─── CONDITION 3 : Balayage par la Mèche du Doji (dans validerPalierVagueOpposee) ─
 *  • Pour Achat : le point bas de la mèche doit traverser sous le palier opposé.
 *  • Pour Vente : le point haut de la mèche doit percer au-dessus du palier opposé.
 * ==============================================================================
 */

// ─── 📊 Structures et Types de Données ────────────────────────────────────────

/**
 * Options de configuration pour l'Indicateur 2 :
 * Liquidation & Réintégration combiné avec le Chevauchement de la Vague Opposée (Structure ZigZag antérieure)
 */
export interface ParametresChevauchementVagueOpposee {
  // ── 🎯 Paramètres ZigZag pour isoler la Vague Opposée ──
  zigzagDepth?: number;           // Sensibilité des pivots ZigZag (défaut: 4)
  zigzagDeviation?: number;       // Déviation minimale en prix (défaut: 0)
  zigzagBackstep?: number;        // Écart minimal en barres (défaut: 2)
  lookbackBars?: number;          // Historique analysé (défaut: 100)
  priceStep?: number;             // Pas de prix de chaque palier (auto si non fourni)
  minBougiesChevauchement?: number;// Seuil min de bougies sur le palier pour être retenu (défaut: 2)
  exigerNiveauBalaye?: boolean;   // Exiger qu'un palier valide de la vague opposée ait été balayé (défaut: true)

  // ── 🕯️ Paramètres du Chandelier Liq/Reint ──
  toleranceDeficit?: number;      // Déficit admis en clôture (défaut: 0.05 = 5%)
  toleranceDepassement?: number;  // Dépassement favorable admis (défaut: 0.25 = 25%)
  activerFiltreTaille?: boolean;  // Active le filtre d'impulsion récente (défaut: true)
  periodeHistorique?: number;     // Période récente de référence (défaut: 10)
  multiplicateurBougie1?: number; // Multiplicateur Bougie 1 entière (défaut: 1.75x)
  multiplicateurCorps2?: number;  // Multiplicateur Corps 2 pur (défaut: 1.75x)

  // ── 🧭 Filtre de Tendance et Directions ──
  activerAchat?: boolean;
  activerVente?: boolean;
  activerFiltreTendance?: boolean;
  trendBars?: number;

  // ── 🎨 Affichage Graphique ──
  // Segment horizontal en ligne discontinue représentant le niveau balayé (défaut: true)
  afficherSegmentDiscontinue?: boolean;
  bullColor?: string;
  bearColor?: string;
  texteLabel?: string;
}

/**
 * Informations sur le palier de chevauchement identifié dans la vague opposée
 */
export interface PalierVagueOpposee {
  directionVague: 'DESCENDANTE' | 'MONTANTE';
  prixPalier: number;
  nbBougiesChevauchement: number;
  indexDebutVague: number;
  indexFinVague: number;
  tempsDebutVague: number | string;
  tempsFinVague: number | string;
  prixHautVague: number;
  prixBasVague: number;
  profondeurSweep: number;
}

/**
 * Signal complet de setup avec chevauchement de la vague opposée
 */
export interface SignalChevauchementVagueOpposee {
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
  vagueOpposee?: PalierVagueOpposee;
}

/**
 * Résultat complet retourné par l'indicateur
 */
export interface ResultatChevauchementVagueOpposee {
  signaux: SignalChevauchementVagueOpposee[];
  primitives: VisualPrimitives;
  pivotsZigZag: PointZigZag[];
  stepCalcule: number;
  statistiques: {
    totalSignaux: number;
    totalAchats: number;
    totalVentes: number;
    maxBougiesVagueOpposee: number;
  };
}

/**
 * ==============================================================================
 * 🎯 FONCTION CENTRALE DE VALIDATION DU PALIER DE LA VAGUE OPPOSÉE
 * ==============================================================================
 * Cette fonction rassemble TOUTES les conditions qu'un palier de la vague
 * opposée doit respecter pour être retenu comme niveau balayé par le setup.
 *
 * Pour un développeur junior :
 * Si tu souhaites assouplir ou modifier les règles de la vague opposée,
 * c'est ICI qu'il faut intervenir !
 *
 * Règles vérifiées :
 *  1️⃣ Le palier a été touché par au moins `minBougies` (trafic suffisant)
 *  2️⃣ En ACHAT : la mèche basse du setup a balayé sous le palier (prixExtreme < palierPrix)
 *  3️⃣ En VENTE : la mèche haute du setup a balayé au-dessus du palier (prixExtreme > palierPrix)
 *
 * Exemple :
 * const estValide = validerPalierVagueOpposee({
 *   direction: 'ACHAT',
 *   prixExtreme: 1.0920,
 *   palierPrix: 1.0950,
 *   nbBougiesSurPalier: 4,
 *   minBougiesRequises: 2
 * }); // Renvoie true
 */
export function validerPalierVagueOpposee(params: {
  direction: 'ACHAT' | 'VENTE';
  prixExtreme: number;
  palierPrix: number;
  nbBougiesSurPalier: number;
  minBougiesRequises: number;
}): boolean {
  const { direction, prixExtreme, palierPrix, nbBougiesSurPalier, minBougiesRequises } = params;

  // 1️⃣ Règle du trafic minimum
  if (nbBougiesSurPalier < minBougiesRequises) {
    return false;
  }

  // 2️⃣ Règle géométrique de balayage (sweep)
  if (direction === 'ACHAT') {
    // La mèche basse doit percer SOUS le palier de la vague descendante
    if (prixExtreme >= palierPrix) {
      return false;
    }
  } else {
    // La mèche haute doit percer AU-DESSUS du palier de la vague montante
    if (prixExtreme <= palierPrix) {
      return false;
    }
  }

  return true;
}

// ─── 🔍 Analyse du Chevauchement dans la Vague Opposée ────────────────────────

/**
 * Identifie la dernière vague ZigZag opposée antérieure au setup
 * et extrait son palier de plus fort chevauchement de bougies.
 * 
 * - Pour l'ACHAT (Spring) : cible la dernière vague DESCENDANTE (Sommet -> Creux)
 *   et cherche le niveau le plus chargé en bougies que le Spring a balayé.
 * - Pour la VENTE (UTAD) : cible la dernière vague MONTANTE (Creux -> Sommet).
 * 
 * Exemple :
 * const palier = trouverPalierVagueOpposee(bougies, pivots, 'ACHAT', 95.0, 48, step, 2);
 */
export function trouverPalierVagueOpposee(
  bougies: Bougie[],
  pivots: PointZigZag[],
  direction: 'ACHAT' | 'VENTE',
  prixExtreme: number,
  indexSetup: number,
  step: number,
  minBougies: number = 2
): PalierVagueOpposee | null {
  if (pivots.length < 2 || indexSetup < 2 || step <= 0) return null;

  // 1️⃣ Trouver la vague ZigZag antérieure adéquate
  // Pour ACHAT : on cherche une vague descendante (ptA.prix > ptB.prix, ptA.estHaut = true)
  // Pour VENTE : on cherche une vague montante (ptA.prix < ptB.prix, ptA.estHaut = false)
  let ptDebut: PointZigZag | null = null;
  let ptFin: PointZigZag | null = null;

  // On parcourt les segments ZigZag de droite à gauche avant l'index du setup
  for (let k = pivots.length - 1; k >= 1; k--) {
    const p2 = pivots[k];
    const p1 = pivots[k - 1];

    // La vague doit se situer avant ou se terminer au début de notre setup
    if (p2.index >= indexSetup) continue;

    if (direction === 'ACHAT') {
      // Vague descendante : commence sur un sommet et finit sur un creux
      if (p1.prix > p2.prix) {
        ptDebut = p1;
        ptFin = p2;
        break;
      }
    } else {
      // Vague montante : commence sur un creux et finit sur un sommet
      if (p1.prix < p2.prix) {
        ptDebut = p1;
        ptFin = p2;
        break;
      }
    }
  }

  // Si aucun segment ZigZag strict n'est trouvé, on prend le segment entre l'avant-dernier pivot et le début du setup
  if (!ptDebut || !ptFin) {
    const dernierPivotAvant = pivots.filter(p => p.index < indexSetup - 1).pop();
    if (dernierPivotAvant) {
      ptDebut = dernierPivotAvant;
      const idxFinSecours = Math.max(0, indexSetup - 2);
      ptFin = {
        prix: bougies[idxFinSecours].close,
        temps: bougies[idxFinSecours].time,
        index: idxFinSecours,
        estHaut: !dernierPivotAvant.estHaut,
      };
    }
  }

  if (!ptDebut || !ptFin) return null;

  const idxDebut = Math.min(ptDebut.index, ptFin.index);
  const idxFin = Math.max(ptDebut.index, ptFin.index);
  if (idxFin <= idxDebut) return null;

  // 2️⃣ Cartographier le chevauchement de toutes les bougies de cette vague opposée
  const buckets = new Map<number, number>();
  for (let b = idxDebut; b <= idxFin; b++) {
    const bg = bougies[b];
    for (let p = bg.low; p <= bg.high; p += step) {
      const arr = Number((Math.round(p / step) * step).toFixed(5));
      buckets.set(arr, (buckets.get(arr) || 0) + 1);
    }
  }

  // 3️⃣ Trouver le palier avec le trafic maximal balayé par notre setup
  let meilleurPalierPrix = 0;
  let maxBougies = 0;

  for (const [palierPrix, nbB] of buckets.entries()) {
    // ✅ Utilisation de la fonction centrale de validation du palier
    const estValide = validerPalierVagueOpposee({
      direction,
      prixExtreme,
      palierPrix,
      nbBougiesSurPalier: nbB,
      minBougiesRequises: minBougies,
    });

    if (!estValide) continue;

    if (nbB > maxBougies) {
      maxBougies = nbB;
      meilleurPalierPrix = palierPrix;
    }
  }

  if (maxBougies < minBougies || meilleurPalierPrix === 0) return null;

  return {
    directionVague: direction === 'ACHAT' ? 'DESCENDANTE' : 'MONTANTE',
    prixPalier: meilleurPalierPrix,
    nbBougiesChevauchement: maxBougies,
    indexDebutVague: idxDebut,
    indexFinVague: idxFin,
    tempsDebutVague: bougies[idxDebut].time,
    tempsFinVague: bougies[idxFin].time,
    prixHautVague: Math.max(ptDebut.prix, ptFin.prix),
    prixBasVague: Math.min(ptDebut.prix, ptFin.prix),
    profondeurSweep: Number(Math.abs(prixExtreme - meilleurPalierPrix).toFixed(5)),
  };
}

// ─── 🚀 Moteur Principal : Liq/Reint + Sweep Chevauchement Vague Opposée ──────

/**
 * Calcule l'indicateur combinant le setup Liquidation/Réintégration
 * avec l'analyse du chevauchement de la vague ZigZag opposée antérieure.
 * 
 * Trace un segment horizontal en ligne discontinue (dashed) représentant le niveau de liquidité.
 * 
 * Exemple :
 * const res = calculerLiquidationSweepChevauchementVagueOpposee(bougies, { lookbackBars: 60 });
 */
export function calculerLiquidationSweepChevauchementVagueOpposee(
  bougies: Bougie[],
  parametres: ParametresChevauchementVagueOpposee = {}
): ResultatChevauchementVagueOpposee {
  const labels: VisualLabel[] = [];
  const lignes: VisualLine[] = [];
  const points: VisualPoint[] = [];

  const defResultat: ResultatChevauchementVagueOpposee = {
    signaux: [],
    primitives: { labels, lignes, boites: [], points },
    pivotsZigZag: [],
    stepCalcule: 0.0001,
    statistiques: { totalSignaux: 0, totalAchats: 0, totalVentes: 0, maxBougiesVagueOpposee: 0 },
  };

  if (!bougies || bougies.length < 5) return defResultat;

  // 1️⃣ Extraction des paramètres
  const params = parametres || {};
  const depth = Math.max(2, Number(params.zigzagDepth ?? 4));
  const deviation = Math.max(0, Number(params.zigzagDeviation ?? 0));
  const backstep = Math.max(1, Number(params.zigzagBackstep ?? 2));
  const lookbackBars = Math.max(10, Number(params.lookbackBars ?? 100));
  const minBougiesChevauchement = Math.max(1, Number(params.minBougiesChevauchement ?? 2));
  const exigerNiveauBalaye = params.exigerNiveauBalaye !== false;

  const valDeficit = params.toleranceDeficit !== undefined ? params.toleranceDeficit : 0.05;
  const toleranceDeficit = valDeficit > 1 ? valDeficit / 100 : valDeficit;
  const valDepassement = params.toleranceDepassement !== undefined ? params.toleranceDepassement : 0.25;
  const toleranceDepassement = valDepassement > 1 ? valDepassement / 100 : valDepassement;

  const activerFiltreTaille = params.activerFiltreTaille !== false;
  const periodeHistorique = Math.max(3, Number(params.periodeHistorique ?? 10));
  const multiplicateurBougie1 = Math.max(0.5, Number(params.multiplicateurBougie1 ?? 1.75));
  const multiplicateurCorps2 = Math.max(0.5, Number(params.multiplicateurCorps2 ?? 1.75));

  const activerAchat = params.activerAchat !== false;
  const activerVente = params.activerVente !== false;
  const activerFiltreTendance = Boolean(params.activerFiltreTendance);
  const trendBars = Math.max(1, Number(params.trendBars ?? 5));

  const afficherSegment = params.afficherSegmentDiscontinue !== false;
  const bullColor = params.bullColor || '#00E676';
  const bearColor = params.bearColor || '#F23645';
  const texteLabel = params.texteLabel || 'Liq/Reint';

  const step = determinerStepPrix(bougies, params.priceStep);

  // 2️⃣ Détection globale des pivots ZigZag
  const pivots = detecterPivotsZigZagAvance(bougies, {
    depth,
    deviation,
    backstep,
    lookbackBars,
    inclureVagueCourante: false,
  });

  const signaux: SignalChevauchementVagueOpposee[] = [];
  let countAchats = 0;
  let countVentes = 0;
  let maxBougiesGlobal = 0;

  // 3️⃣ Parcours séquentiel des bougies
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

    let prixExtreme = 0;
    let bougieExtreme: 1 | 2 = 1;

    if (estCandidatAchat) {
      if (b2.low <= b1.low) {
        prixExtreme = b2.low;
        bougieExtreme = 2;
      } else {
        prixExtreme = b1.low;
        bougieExtreme = 1;
      }

      // Recherche du palier dans la vague opposée (vague descendante précédente)
      const palierTrouve = trouverPalierVagueOpposee(
        bougies,
        pivots,
        'ACHAT',
        prixExtreme,
        i,
        step,
        minBougiesChevauchement
      );

      if (exigerNiveauBalaye && !palierTrouve) continue;

      if (palierTrouve && palierTrouve.nbBougiesChevauchement > maxBougiesGlobal) {
        maxBougiesGlobal = palierTrouve.nbBougiesChevauchement;
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
        vagueOpposee: palierTrouve || undefined,
      });

      const titreSignal = palierTrouve ? 'Spring Chevauchement' : texteLabel;
      const badgeDetails = palierTrouve
        ? `\nVague Opposée (${palierTrouve.prixPalier.toFixed(4)}) [${palierTrouve.nbBougiesChevauchement}b]`
        : '';

      labels.push({
        id: `vop-achat-lbl-${i}`,
        prix: b2.low,
        date: b2.time,
        texte: `${titreSignal}${badgeDetails}`,
        couleur: bullColor,
        position: 'below',
      });

      points.push({
        id: `vop-achat-pt-${i}`,
        prix: prixExtreme,
        date: bougieExtreme === 1 ? b1.time : b2.time,
        couleur: bullColor,
      });

      // SEGMENT EN LIGNE DISCONTINUE (DASHED) : niveau de la vague opposée balayé
      if (palierTrouve && afficherSegment) {
        lignes.push({
          id: `vop-ligne-achat-${i}`,
          prix: palierTrouve.prixPalier,
          dateDebut: palierTrouve.tempsDebutVague,
          dateFin: b2.time,
          couleur: bullColor,
          epaisseur: 1.8,
          style: 'dashed',
          label: `🎯 Vague Opposée [${palierTrouve.nbBougiesChevauchement}b]`,
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

      // Recherche du palier dans la vague opposée (vague montante précédente)
      const palierTrouve = trouverPalierVagueOpposee(
        bougies,
        pivots,
        'VENTE',
        prixExtreme,
        i,
        step,
        minBougiesChevauchement
      );

      if (exigerNiveauBalaye && !palierTrouve) continue;

      if (palierTrouve && palierTrouve.nbBougiesChevauchement > maxBougiesGlobal) {
        maxBougiesGlobal = palierTrouve.nbBougiesChevauchement;
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
        vagueOpposee: palierTrouve || undefined,
      });

      const titreSignal = palierTrouve ? 'UTAD Chevauchement' : texteLabel;
      const badgeDetails = palierTrouve
        ? `\nVague Opposée (${palierTrouve.prixPalier.toFixed(4)}) [${palierTrouve.nbBougiesChevauchement}b]`
        : '';

      labels.push({
        id: `vop-vente-lbl-${i}`,
        prix: b2.high,
        date: b2.time,
        texte: `${titreSignal}${badgeDetails}`,
        couleur: bearColor,
        position: 'above',
      });

      points.push({
        id: `vop-vente-pt-${i}`,
        prix: prixExtreme,
        date: bougieExtreme === 1 ? b1.time : b2.time,
        couleur: bearColor,
      });

      // SEGMENT EN LIGNE DISCONTINUE (DASHED) : niveau de la vague opposée balayé
      if (palierTrouve && afficherSegment) {
        lignes.push({
          id: `vop-ligne-vente-${i}`,
          prix: palierTrouve.prixPalier,
          dateDebut: palierTrouve.tempsDebutVague,
          dateFin: b2.time,
          couleur: bearColor,
          epaisseur: 1.8,
          style: 'dashed',
          label: `🎯 Vague Opposée [${palierTrouve.nbBougiesChevauchement}b]`,
        });
      }
    }
  }

  return {
    signaux,
    primitives: { labels, lignes, boites: [], points },
    pivotsZigZag: pivots,
    stepCalcule: step,
    statistiques: {
      totalSignaux: signaux.length,
      totalAchats: countAchats,
      totalVentes: countVentes,
      maxBougiesVagueOpposee: maxBougiesGlobal,
    },
  };
}
