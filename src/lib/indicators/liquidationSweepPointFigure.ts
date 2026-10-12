import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLabel, VisualLine, VisualBox, VisualPoint } from '@/types/indicatorScript';

/**
 * Options de configuration pour l'indicateur combiné :
 * Liquidation & Réintégration avec Détection de la Liquidité Balayée par Point & Figure (P&F).
 * Permet d'identifier la liquidité la plus solide (« le palier carré le plus testé » en colonnes X/O).
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
  // Nombre maximal de bougies antérieures pour construire la grille P&F (défaut: 300)
  lookbackBars?: number;
  // Si true, exige qu'un vrai niveau P&F horizontal ait été balayé (défaut: true)
  exigerNiveauPFBalaye?: boolean;

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
 * Recherche le palier horizontal P&F (support ou résistance le plus carré / testé)
 * qui a été balayé par la mèche extrême du setup de bougies.
 */
function identifierPalierPFLePlusTeste(
  colonnes: ColonnePFLocale[],
  direction: 'ACHAT' | 'VENTE',
  prixExtreme: number,
  tailleBox: number,
  minColonnesAlignees: number,
  prixReferenceHaut: number,
  prixReferenceBas: number
): PalierHorizontalPF | null {
  if (colonnes.length < 2) return null;

  // Tolérance pour regrouper des colonnes sur le même palier horizontal (±1 boîte)
  const margeBox = tailleBox * 1.25;
  const paliersCandidats: PalierHorizontalPF[] = [];

  if (direction === 'ACHAT') {
    // 🟢 Recherche de supports formés par les bas de colonnes 'O'
    const colonnesO = colonnes.filter((c) => c.type === 'O');

    for (let i = 0; i < colonnesO.length; i++) {
      const colBase = colonnesO[i];
      const prixSupport = colBase.bas;

      // Le support doit être au-dessus du creux extrême balayé (donc la mèche l'a transpercé)
      // et rester sous le haut de référence
      if (prixExtreme >= prixSupport || prixSupport > prixReferenceHaut) {
        continue;
      }

      // Comptage des colonnes 'O' dont le bas s'arrête sur ce même palier horizontal (±margeBox)
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

      if (countAlignes >= minColonnesAlignees) {
        let solidite: 'CARRE_MAJEUR' | 'SOLIDE' | 'STANDARD' = 'STANDARD';
        if (countAlignes >= 4) solidite = 'CARRE_MAJEUR';
        else if (countAlignes >= 3) solidite = 'SOLIDE';

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
        });
      }
    }
  } else {
    // 🔴 Recherche de résistances formées par les hauts de colonnes 'X'
    const colonnesX = colonnes.filter((c) => c.type === 'X');

    for (let i = 0; i < colonnesX.length; i++) {
      const colBase = colonnesX[i];
      const prixResistance = colBase.haut;

      // La résistance doit être sous le sommet extrême balayé
      // et rester au-dessus du bas de référence
      if (prixExtreme <= prixResistance || prixResistance < prixReferenceBas) {
        continue;
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

      if (countAlignes >= minColonnesAlignees) {
        let solidite: 'CARRE_MAJEUR' | 'SOLIDE' | 'STANDARD' = 'STANDARD';
        if (countAlignes >= 4) solidite = 'CARRE_MAJEUR';
        else if (countAlignes >= 3) solidite = 'SOLIDE';

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
        });
      }
    }
  }

  if (paliersCandidats.length === 0) return null;

  // Sélection du palier « le plus carré » : le plus grand nombre de colonnes alignées
  return paliersCandidats.reduce((meilleur, p) => {
    if (p.nbColonnesAlignees > meilleur.nbColonnesAlignees) return p;
    // En cas d'égalité, prendre celui avec le sweep le plus net
    if (p.nbColonnesAlignees === meilleur.nbColonnesAlignees && p.profondeurSweep > meilleur.profondeurSweep) {
      return p;
    }
    return meilleur;
  }, paliersCandidats[0]);
}

/**
 * Indicateur combiné : Détecte le setup de réintégration (Liq/Reint)
 * et identifie précisément quel palier Point & Figure (le plus carré et testé)
 * a été balayé par la manipulation.
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
        totalCarresMajeurs: 0,
        totalSolides: 0,
        maxColonnesAlignees: 0,
      },
    };
  }

  // 1️⃣ Paramètres
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
  const lookbackBars = Math.max(50, Number(params.lookbackBars ?? 300));
  const exigerNiveauPF = params.exigerNiveauPFBalaye !== false;

  const activerFiltreTaille = params.activerFiltreTaille !== false;
  const periodeHistorique = Math.max(3, Number(params.periodeHistorique ?? 10));
  const multiplicateurBougie1 = Math.max(0.5, Number(params.multiplicateurBougie1 ?? 1.75));
  const multiplicateurCorps2 = Math.max(0.5, Number(params.multiplicateurCorps2 ?? 1.75));

  const activerAchat = params.activerAchat !== false;
  const activerVente = params.activerVente !== false;
  const activerFiltreTendance = Boolean(params.activerFiltreTendance);
  const trendBars = Math.max(1, Number(params.trendBars ?? 5));

  const afficherLigne = params.afficherLignePF !== false;
  const afficherZone = params.afficherZoneSweep !== false;
  const afficherBoiteCause = params.afficherBoiteCausePF !== false;
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
  let countMajeurs = 0;
  let countSolides = 0;
  let maxColsAlignees = 0;

  // 3️⃣ Parcours des bougies pour détecter le setup Liq/Reint
  for (let i = 1; i < bougies.length; i++) {
    const b1 = bougies[i - 1];
    const b2 = bougies[i];

    const range1 = b1.high - b1.low;
    const range2 = b2.high - b2.low;
    const corps2 = Math.abs(b2.open - b2.close);
    const hauteurMoyenne = (range1 + range2) / 2;
    if (hauteurMoyenne <= 0) continue;

    const idxTrend = Math.max(0, i - trendBars);
    const openTrend = bougies[idxTrend].open;
    const tendanceHausse = !activerFiltreTendance || openTrend < b2.open;
    const tendanceBaisse = !activerFiltreTendance || openTrend > b2.open;

    const estCandidatAchat = activerAchat && (b1.close < b1.open) && (b2.close > b2.open) && tendanceBaisse;
    const estCandidatVente = activerVente && (b1.close > b1.open) && (b2.close < b2.open) && tendanceHausse;
    if (!estCandidatAchat && !estCandidatVente) continue;

    const ecartPrix = Math.abs(b1.open - b2.close);
    const ratioEcart = ecartPrix / hauteurMoyenne;
    let situationCloture: 'DEPASSEMENT' | 'RETRAIT' = 'RETRAIT';
    let estValideProximite = false;

    if (estCandidatAchat) {
      if (b2.close >= b1.open) {
        situationCloture = 'DEPASSEMENT';
        estValideProximite = ratioEcart <= toleranceDepassement;
      } else {
        situationCloture = 'RETRAIT';
        estValideProximite = ratioEcart <= toleranceDeficit;
      }
    } else if (estCandidatVente) {
      if (b2.close <= b1.open) {
        situationCloture = 'DEPASSEMENT';
        estValideProximite = ratioEcart <= toleranceDepassement;
      } else {
        situationCloture = 'RETRAIT';
        estValideProximite = ratioEcart <= toleranceDeficit;
      }
    }
    if (!estValideProximite) continue;

    // Filtre de momentum sur l'historique récent
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
        const moyRange = sommeRanges / nbBougiesHist;
        const moyCorps = sommeCorps / nbBougiesHist;
        if (range1 < multiplicateurBougie1 * moyRange || corps2 < multiplicateurCorps2 * moyCorps) {
          continue;
        }
      }
    }

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

      // Construction P&F sur l'historique antérieur au setup
      const colonnes = construireColonnesPF(bougies, indexFinScanPF, tailleBox, reversalCount, lookbackBars);
      const palierTrouve = identifierPalierPFLePlusTeste(
        colonnes,
        'ACHAT',
        prixExtreme,
        tailleBox,
        minColonnes,
        Math.max(b1.open, b1.high),
        b1.low
      );

      if (exigerNiveauPF && !palierTrouve) continue;

      if (palierTrouve) {
        countSweepsPF++;
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
      });

      // Visuels
      const badgePF = palierTrouve
        ? ` [P&F ${palierTrouve.nbColonnesAlignees} cols ★]\nSupport P&F (${palierTrouve.prixNiveau.toFixed(4)})`
        : '';
      labels.push({
        id: `pf-achat-lbl-${i}`,
        prix: b2.low,
        date: b2.time,
        texte: palierTrouve ? `${texteLabel}${badgePF}` : texteLabel,
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
          id: `pf-ligne-sup-${i}`,
          prix: palierTrouve.prixNiveau,
          dateDebut: palierTrouve.tempsDebut,
          dateFin: b2.time,
          couleur: bullColor,
          epaisseur: 2,
          style: 'solid',
          label: `Support P&F (${palierTrouve.nbColonnesAlignees} Colonnes | ${palierTrouve.solidite})`,
        });
      }

      if (palierTrouve && afficherZone) {
        boites.push({
          id: `pf-zone-sweep-achat-${i}`,
          prixHaut: palierTrouve.prixNiveau,
          prixBas: prixExtreme,
          dateDebut: b1.time,
          dateFin: b2.time,
          couleurFond: 'rgba(0, 230, 118, 0.18)',
          couleurBordure: bullColor,
          label: `Sweep P&F (-${(palierTrouve.profondeurSweep * 10000).toFixed(1)}p)`,
        });
      }

      if (palierTrouve && afficherBoiteCause) {
        boites.push({
          id: `pf-cause-achat-${i}`,
          prixHaut: palierTrouve.prixNiveau + (tailleBox * reversalCount),
          prixBas: palierTrouve.prixNiveau,
          dateDebut: palierTrouve.tempsDebut,
          dateFin: palierTrouve.tempsFin,
          couleurFond: 'rgba(33, 150, 243, 0.08)',
          couleurBordure: 'rgba(33, 150, 243, 0.35)',
          label: `Cause P&F (${palierTrouve.nbColonnesAlignees} Cols)`,
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
      const palierTrouve = identifierPalierPFLePlusTeste(
        colonnes,
        'VENTE',
        prixExtreme,
        tailleBox,
        minColonnes,
        b1.high,
        Math.min(b1.open, b1.low)
      );

      if (exigerNiveauPF && !palierTrouve) continue;

      if (palierTrouve) {
        countSweepsPF++;
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
      });

      const badgePF = palierTrouve
        ? ` [P&F ${palierTrouve.nbColonnesAlignees} cols ★]\nRésistance P&F (${palierTrouve.prixNiveau.toFixed(4)})`
        : '';
      labels.push({
        id: `pf-vente-lbl-${i}`,
        prix: b2.high,
        date: b2.time,
        texte: palierTrouve ? `${texteLabel}${badgePF}` : texteLabel,
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
          id: `pf-ligne-res-${i}`,
          prix: palierTrouve.prixNiveau,
          dateDebut: palierTrouve.tempsDebut,
          dateFin: b2.time,
          couleur: bearColor,
          epaisseur: 2,
          style: 'solid',
          label: `Résistance P&F (${palierTrouve.nbColonnesAlignees} Colonnes | ${palierTrouve.solidite})`,
        });
      }

      if (palierTrouve && afficherZone) {
        boites.push({
          id: `pf-zone-sweep-vente-${i}`,
          prixHaut: prixExtreme,
          prixBas: palierTrouve.prixNiveau,
          dateDebut: b1.time,
          dateFin: b2.time,
          couleurFond: 'rgba(242, 54, 69, 0.18)',
          couleurBordure: bearColor,
          label: `Sweep P&F (+${(palierTrouve.profondeurSweep * 10000).toFixed(1)}p)`,
        });
      }

      if (palierTrouve && afficherBoiteCause) {
        boites.push({
          id: `pf-cause-vente-${i}`,
          prixHaut: palierTrouve.prixNiveau,
          prixBas: palierTrouve.prixNiveau - (tailleBox * reversalCount),
          dateDebut: palierTrouve.tempsDebut,
          dateFin: palierTrouve.tempsFin,
          couleurFond: 'rgba(242, 54, 69, 0.08)',
          couleurBordure: 'rgba(242, 54, 69, 0.35)',
          label: `Cause P&F (${palierTrouve.nbColonnesAlignees} Cols)`,
        });
      }
    }
  }

  return {
    signaux,
    primitives: {
      labels,
      lignes,
      boites,
      points,
    },
    tailleBoxCalculee: tailleBox,
    statistiques: {
      totalSignaux: signaux.length,
      totalAchats: countAchats,
      totalVentes: countVentes,
      totalSweepsPF: countSweepsPF,
      totalCarresMajeurs: countMajeurs,
      totalSolides: countSolides,
      maxColonnesAlignees: maxColsAlignees,
    },
  };
}
