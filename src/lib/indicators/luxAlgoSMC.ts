import type { Bougie } from '@/lib/chartDataHelper';

// ─── 📐 Types et Structures de données LuxAlgo SMC ──────────────────────────

export type TypeCassure = 'BOS' | 'CHoCH';
export type BiaisSMC = 1 | -1; // +1 pour haussier, -1 pour baissier

/**
 * Représente une cassure structurelle (BOS ou CHoCH)
 */
export interface CassureStructure {
  id: number;
  type: TypeCassure;
  biais: BiaisSMC;
  internal: boolean; // Vrai pour structure interne (micro), faux pour swing (macro)
  prix: number;
  indexDebut: number;
  indexFin: number;
  tempsDebut: number | string;
  tempsFin: number | string;
}

/**
 * Bloc d'ordres institutionnel (Order Block)
 */
export interface OrderBlockSMC {
  id: number;
  haut: number;
  bas: number;
  temps: number | string;
  index: number;
  biais: BiaisSMC;
  internal: boolean;
  mitige: boolean;
  indexMitigation?: number;
}

/**
 * Égalité de sommets ou creux (EQH / EQL - Liquidity Pools)
 */
export interface EqualHighLow {
  id: number;
  type: 'EQH' | 'EQL';
  prix: number;
  index1: number;
  index2: number;
  temps1: number | string;
  temps2: number | string;
  mitige: boolean;
}

/**
 * Déséquilibre de prix en 3 bougies (Fair Value Gap)
 */
export interface FairValueGapSMC {
  id: number;
  haut: number;
  bas: number;
  temps: number | string;
  index: number;
  biais: BiaisSMC;
  mitige: boolean;
}

/**
 * Niveaux et zones institutionnelles Premium / Discount / Équilibre
 */
export interface ZonesPremiumDiscount {
  hautRange: number;
  basRange: number;
  prixEquilibre: number;
  zonePremium: { haut: number; bas: number };
  zoneDiscount: { haut: number; bas: number };
  zoneEquilibre: { haut: number; bas: number };
  positionActuelle: 'PREMIUM' | 'DISCOUNT' | 'EQUILIBRE';
  pourcentageRange: number; // 0% (au bas) à 100% (au haut)
}

/**
 * Options configurables du moteur SMC
 */
export interface OptionsLuxAlgoSMC {
  swingLength?: number;              // Longueur de pivot macro swing (défaut: 20)
  internalLength?: number;           // Longueur de pivot micro interne (défaut: 5)
  maxOrderBlocks?: number;           // Nombre max d'OB actifs conservés (défaut: 10)
  mitigationSource?: 'highlow' | 'close'; // Source de mitigation des OB (défaut: 'highlow')
  eqhEqlSensibilite?: number;        // Facteur ATR pour tolérance d'égalité (défaut: 0.15)
  filtrerFVGAuto?: boolean;          // Seuil dynamique de taille de bougie pour FVG (défaut: true)
  lookbackBars?: number;             // Limite d'analyse historique (défaut: 1000)
}

/**
 * Résultat complet de l'analyse SMC
 */
export interface ResultatLuxAlgoSMC {
  cassures: CassureStructure[];
  orderBlocks: OrderBlockSMC[];
  equalHighsLows: EqualHighLow[];
  fvgs: FairValueGapSMC[];
  strongWeakExtremes?: {
    strongHigh?: number;
    weakHigh?: number;
    strongLow?: number;
    weakLow?: number;
    tempsHaut?: number | string;
    tempsBas?: number | string;
  };
  premiumDiscount?: ZonesPremiumDiscount;
  tendanceSwing: 'BULLISH' | 'BEARISH' | 'NEUTRE';
  tendanceInterne: 'BULLISH' | 'BEARISH' | 'NEUTRE';
}

/**
 * Snapshot technique prêt à être enregistré dans le journal de trade
 */
export interface SnapshotSMC {
  tendanceSwing: 'BULLISH' | 'BEARISH' | 'NEUTRE';
  tendanceInterne: 'BULLISH' | 'BEARISH' | 'NEUTRE';
  dernierEvenementType: string;
  dernierEvenementPrix: number;
  positionRange: 'PREMIUM' | 'DISCOUNT' | 'EQUILIBRE';
  pourcentageRange: number;
  proximiteOrderBlockPips: number;
  orderBlockPlusProcheBiais?: 'haussier' | 'baissier';
  nbOrderBlocksActifs: number;
  nbEQHActifs: number;
  nbEQLActifs: number;
  nbFVGActifs: number;
}

// ─── ⚙️ Fonctions Utilitaires & Indicateurs Auxiliaires ───────────────────────

/**
 * Calcule la True Range (TR) pour chaque bougie
 */
function calculerTrueRanges(bougies: Bougie[]): number[] {
  const n = bougies.length;
  const tr = new Array<number>(n);
  tr[0] = bougies[0].high - bougies[0].low;

  for (let i = 1; i < n; i++) {
    const hl = bougies[i].high - bougies[i].low;
    const hc = Math.abs(bougies[i].high - bougies[i - 1].close);
    const lc = Math.abs(bougies[i].low - bougies[i - 1].close);
    tr[i] = Math.max(hl, hc, lc);
  }
  return tr;
}

/**
 * Calcule l'ATR glissant (Simple Moving Average de la TR sur 'periode' barres)
 */
function calculerATRGlossant(trValues: number[], periode = 14): number[] {
  const n = trValues.length;
  const atr = new Array<number>(n);
  let somme = 0;

  for (let i = 0; i < n; i++) {
    somme += trValues[i];
    if (i >= periode) {
      somme -= trValues[i - periode];
      atr[i] = somme / periode;
    } else {
      atr[i] = somme / (i + 1);
    }
  }
  return atr;
}

// ─── 🧠 Moteur Principal LuxAlgo Smart Money Concepts ─────────────────────────

/**
 * Analyse complète des Smart Money Concepts (BOS, CHoCH, OB, EQH/EQL, FVG, Premium/Discount)
 * 
 * Exemple :
 * const resultat = calculerLuxAlgoSMC(donneesBougies, { swingLength: 20, internalLength: 5 });
 * console.log(`Tendance Swing : ${resultat.tendanceSwing}`);
 * console.log(`Zones de prix : ${resultat.premiumDiscount?.positionActuelle}`);
 */
export function calculerLuxAlgoSMC(
  bougies: Bougie[],
  options: OptionsLuxAlgoSMC = {}
): ResultatLuxAlgoSMC {
  const {
    swingLength = 20,
    internalLength = 5,
    maxOrderBlocks = 10,
    mitigationSource = 'highlow',
    eqhEqlSensibilite = 0.15,
    filtrerFVGAuto = true,
    lookbackBars = 1000,
  } = options;

  const totalBars = bougies.length;

  if (totalBars < 4) {
    return {
      cassures: [],
      orderBlocks: [],
      equalHighsLows: [],
      fvgs: [],
      tendanceSwing: 'NEUTRE',
      tendanceInterne: 'NEUTRE',
    };
  }

  const debutIndex = Math.max(0, totalBars - lookbackBars);
  const trValues = calculerTrueRanges(bougies);
  const atrValues = calculerATRGlossant(trValues, 14);

  // Tableaux de résultats
  const cassures: CassureStructure[] = [];
  const orderBlocks: OrderBlockSMC[] = [];
  const equalHighsLows: EqualHighLow[] = [];
  const fvgs: FairValueGapSMC[] = [];

  let idCompteur = 1;

  // États pour les swings (Macro)
  let swingPivotHaut = { prix: 0, index: -1, temps: '' as number | string, franchi: false, valide: false };
  let swingPivotBas = { prix: 0, index: -1, temps: '' as number | string, franchi: false, valide: false };
  let swingTrend: BiaisSMC = 1;
  let swingCurrentLeg = -1; // 0 = Bearish leg (sommet), 1 = Bullish leg (creux)

  // États pour la structure interne (Micro)
  let internalPivotHaut = { prix: 0, index: -1, temps: '' as number | string, franchi: false, valide: false };
  let internalPivotBas = { prix: 0, index: -1, temps: '' as number | string, franchi: false, valide: false };
  let internalTrend: BiaisSMC = 1;
  let internalCurrentLeg = -1;

  // Suivi des extrêmes Strong / Weak (Trailing High / Low)
  let trailingHigh = { prix: bougies[debutIndex].high, index: debutIndex, temps: bougies[debutIndex].time };
  let trailingLow = { prix: bougies[debutIndex].low, index: debutIndex, temps: bougies[debutIndex].time };

  // Suivi des candidats EQH / EQL
  let dernierCreuxEqual = { prix: 0, index: -1, temps: '' as number | string };
  let dernierSommetEqual = { prix: 0, index: -1, temps: '' as number | string };

  // 1️⃣ Boucle de calcul séquentiel chronologique (barre par barre)
  for (let i = debutIndex; i < totalBars; i++) {
    const b = bougies[i];
    const bPrev = i > 0 ? bougies[i - 1] : b;
    const atrCourant = atrValues[i] || (b.high - b.low) || 0.0001;

    // Mise à jour des extrêmes de marché trailing
    if (b.high >= trailingHigh.prix) {
      trailingHigh = { prix: b.high, index: i, temps: b.time };
    }
    if (b.low <= trailingLow.prix) {
      trailingLow = { prix: b.low, index: i, temps: b.time };
    }

    // ─── A. Détection des Pivots Swing (Macro) ─────────────────────────
    if (i >= swingLength * 2) {
      const barPivotSwing = i - swingLength;
      let maxSub = -Infinity;
      let minSub = Infinity;

      for (let k = barPivotSwing + 1; k <= i; k++) {
        if (bougies[k].high > maxSub) maxSub = bougies[k].high;
        if (bougies[k].low < minSub) minSub = bougies[k].low;
      }

      const isHighSwing = bougies[barPivotSwing].high > maxSub;
      const isLowSwing = bougies[barPivotSwing].low < minSub;
      const prevSwingLeg = swingCurrentLeg;

      if (isHighSwing) swingCurrentLeg = 0;
      else if (isLowSwing) swingCurrentLeg = 1;

      // Détection d'un nouveau creux pivot swing
      if (swingCurrentLeg === 1 && (prevSwingLeg === 0 || prevSwingLeg === -1)) {
        swingPivotBas = {
          prix: bougies[barPivotSwing].low,
          index: barPivotSwing,
          temps: bougies[barPivotSwing].time,
          franchi: false,
          valide: true,
        };
      }
      // Détection d'un nouveau sommet pivot swing
      else if (swingCurrentLeg === 0 && (prevSwingLeg === 1 || prevSwingLeg === -1)) {
        swingPivotHaut = {
          prix: bougies[barPivotSwing].high,
          index: barPivotSwing,
          temps: bougies[barPivotSwing].time,
          franchi: false,
          valide: true,
        };
      }
    }

    // ─── B. Détection des Pivots Internes (Micro) ───────────────────────
    if (i >= internalLength * 2) {
      const barPivotInt = i - internalLength;
      let maxSubInt = -Infinity;
      let minSubInt = Infinity;

      for (let k = barPivotInt + 1; k <= i; k++) {
        if (bougies[k].high > maxSubInt) maxSubInt = bougies[k].high;
        if (bougies[k].low < minSubInt) minSubInt = bougies[k].low;
      }

      const isHighInt = bougies[barPivotInt].high > maxSubInt;
      const isLowInt = bougies[barPivotInt].low < minSubInt;
      const prevIntLeg = internalCurrentLeg;

      if (isHighInt) internalCurrentLeg = 0;
      else if (isLowInt) internalCurrentLeg = 1;

      // Nouveau creux interne
      if (internalCurrentLeg === 1 && (prevIntLeg === 0 || prevIntLeg === -1)) {
        internalPivotBas = {
          prix: bougies[barPivotInt].low,
          index: barPivotInt,
          temps: bougies[barPivotInt].time,
          franchi: false,
          valide: true,
        };

        // Candidat pour EQL (Equal Lows)
        if (dernierCreuxEqual.index !== -1 && Math.abs(internalPivotBas.prix - dernierCreuxEqual.prix) <= atrCourant * eqhEqlSensibilite) {
          equalHighsLows.push({
            id: idCompteur++,
            type: 'EQL',
            prix: Number(((internalPivotBas.prix + dernierCreuxEqual.prix) / 2).toFixed(5)),
            index1: dernierCreuxEqual.index,
            index2: internalPivotBas.index,
            temps1: dernierCreuxEqual.temps,
            temps2: internalPivotBas.temps,
            mitige: false,
          });
        }
        dernierCreuxEqual = { prix: internalPivotBas.prix, index: internalPivotBas.index, temps: internalPivotBas.temps };
      }
      // Nouveau sommet interne
      else if (internalCurrentLeg === 0 && (prevIntLeg === 1 || prevIntLeg === -1)) {
        internalPivotHaut = {
          prix: bougies[barPivotInt].high,
          index: barPivotInt,
          temps: bougies[barPivotInt].time,
          franchi: false,
          valide: true,
        };

        // Candidat pour EQH (Equal Highs)
        if (dernierSommetEqual.index !== -1 && Math.abs(internalPivotHaut.prix - dernierSommetEqual.prix) <= atrCourant * eqhEqlSensibilite) {
          equalHighsLows.push({
            id: idCompteur++,
            type: 'EQH',
            prix: Number(((internalPivotHaut.prix + dernierSommetEqual.prix) / 2).toFixed(5)),
            index1: dernierSommetEqual.index,
            index2: internalPivotHaut.index,
            temps1: dernierSommetEqual.temps,
            temps2: internalPivotHaut.temps,
            mitige: false,
          });
        }
        dernierSommetEqual = { prix: internalPivotHaut.prix, index: internalPivotHaut.index, temps: internalPivotHaut.temps };
      }
    }

    // ─── C. Cassures de Structure Swing (BOS & CHoCH) ───────────────────
    // 1. Cassure haussière Swing
    if (swingPivotHaut.valide && !swingPivotHaut.franchi) {
      if (b.close > swingPivotHaut.prix && bPrev.close <= swingPivotHaut.prix) {
        const type: TypeCassure = swingTrend === -1 ? 'CHoCH' : 'BOS';
        swingPivotHaut.franchi = true;
        swingTrend = 1;

        cassures.push({
          id: idCompteur++,
          type,
          biais: 1,
          internal: false,
          prix: swingPivotHaut.prix,
          indexDebut: swingPivotHaut.index,
          indexFin: i,
          tempsDebut: swingPivotHaut.temps,
          tempsFin: b.time,
        });

        // Recherche et création de l'Order Block haussier Swing (le plus bas creux entre pivot et cassure)
        let minOB = Infinity;
        let idxOB = swingPivotHaut.index;
        for (let k = swingPivotHaut.index; k <= i; k++) {
          if (bougies[k].low < minOB) {
            minOB = bougies[k].low;
            idxOB = k;
          }
        }
        orderBlocks.unshift({
          id: idCompteur++,
          haut: bougies[idxOB].high,
          bas: bougies[idxOB].low,
          temps: bougies[idxOB].time,
          index: idxOB,
          biais: 1,
          internal: false,
          mitige: false,
        });
      }
    }

    // 2. Cassure baissière Swing
    if (swingPivotBas.valide && !swingPivotBas.franchi) {
      if (b.close < swingPivotBas.prix && bPrev.close >= swingPivotBas.prix) {
        const type: TypeCassure = swingTrend === 1 ? 'CHoCH' : 'BOS';
        swingPivotBas.franchi = true;
        swingTrend = -1;

        cassures.push({
          id: idCompteur++,
          type,
          biais: -1,
          internal: false,
          prix: swingPivotBas.prix,
          indexDebut: swingPivotBas.index,
          indexFin: i,
          tempsDebut: swingPivotBas.temps,
          tempsFin: b.time,
        });

        // Recherche et création de l'Order Block baissier Swing (le plus haut sommet entre pivot et cassure)
        let maxOB = -Infinity;
        let idxOB = swingPivotBas.index;
        for (let k = swingPivotBas.index; k <= i; k++) {
          if (bougies[k].high > maxOB) {
            maxOB = bougies[k].high;
            idxOB = k;
          }
        }
        orderBlocks.unshift({
          id: idCompteur++,
          haut: bougies[idxOB].high,
          bas: bougies[idxOB].low,
          temps: bougies[idxOB].time,
          index: idxOB,
          biais: -1,
          internal: false,
          mitige: false,
        });
      }
    }

    // ─── D. Cassures de Structure Interne (Micro BOS & CHoCH) ───────────
    // 1. Cassure haussière Interne
    if (internalPivotHaut.valide && !internalPivotHaut.franchi) {
      if (b.close > internalPivotHaut.prix && bPrev.close <= internalPivotHaut.prix) {
        const type: TypeCassure = internalTrend === -1 ? 'CHoCH' : 'BOS';
        internalPivotHaut.franchi = true;
        internalTrend = 1;

        cassures.push({
          id: idCompteur++,
          type,
          biais: 1,
          internal: true,
          prix: internalPivotHaut.prix,
          indexDebut: internalPivotHaut.index,
          indexFin: i,
          tempsDebut: internalPivotHaut.temps,
          tempsFin: b.time,
        });

        // OB interne haussier
        let minOB = Infinity;
        let idxOB = internalPivotHaut.index;
        for (let k = internalPivotHaut.index; k <= i; k++) {
          if (bougies[k].low < minOB) {
            minOB = bougies[k].low;
            idxOB = k;
          }
        }
        orderBlocks.unshift({
          id: idCompteur++,
          haut: bougies[idxOB].high,
          bas: bougies[idxOB].low,
          temps: bougies[idxOB].time,
          index: idxOB,
          biais: 1,
          internal: true,
          mitige: false,
        });
      }
    }

    // 2. Cassure baissière Interne
    if (internalPivotBas.valide && !internalPivotBas.franchi) {
      if (b.close < internalPivotBas.prix && bPrev.close >= internalPivotBas.prix) {
        const type: TypeCassure = internalTrend === 1 ? 'CHoCH' : 'BOS';
        internalPivotBas.franchi = true;
        internalTrend = -1;

        cassures.push({
          id: idCompteur++,
          type,
          biais: -1,
          internal: true,
          prix: internalPivotBas.prix,
          indexDebut: internalPivotBas.index,
          indexFin: i,
          tempsDebut: internalPivotBas.temps,
          tempsFin: b.time,
        });

        // OB interne baissier
        let maxOB = -Infinity;
        let idxOB = internalPivotBas.index;
        for (let k = internalPivotBas.index; k <= i; k++) {
          if (bougies[k].high > maxOB) {
            maxOB = bougies[k].high;
            idxOB = k;
          }
        }
        orderBlocks.unshift({
          id: idCompteur++,
          haut: bougies[idxOB].high,
          bas: bougies[idxOB].low,
          temps: bougies[idxOB].time,
          index: idxOB,
          biais: -1,
          internal: true,
          mitige: false,
        });
      }
    }

    // ─── E. Détection des Fair Value Gaps (FVG en 3 bougies) ────────────
    if (i >= 2) {
      const b0 = bougies[i - 2];
      const b1 = bougies[i - 1];
      const b2 = bougies[i];
      const tailleCorps = Math.abs(b1.close - b1.open);
      const seuilFvg = filtrerFVGAuto ? atrCourant * 0.25 : 0;

      if (tailleCorps >= seuilFvg) {
        // FVG Haussier (Low actuel > High d'il y a 2 barres)
        if (b2.low > b0.high && b1.close > b0.high) {
          fvgs.unshift({
            id: idCompteur++,
            haut: b2.low,
            bas: b0.high,
            temps: b1.time,
            index: i - 1,
            biais: 1,
            mitige: false,
          });
        }
        // FVG Baissier (High actuel < Low d'il y a 2 barres)
        else if (b2.high < b0.low && b1.close < b0.low) {
          fvgs.unshift({
            id: idCompteur++,
            haut: b0.low,
            bas: b2.high,
            temps: b1.time,
            index: i - 1,
            biais: -1,
            mitige: false,
          });
        }
      }
    }

    // ─── F. Suivi de la Mitigation en direct ────────────────────────────
    // 1. Mitigation des Order Blocks
    for (let k = 0; k < orderBlocks.length; k++) {
      const ob = orderBlocks[k];
      if (ob.mitige || ob.index >= i) continue;

      const testHaut = mitigationSource === 'close' ? b.close : b.high;
      const testBas = mitigationSource === 'close' ? b.close : b.low;

      // OB baissier invalidé/mitigué si le prix traverse le haut
      if (ob.biais === -1 && testHaut > ob.haut) {
        ob.mitige = true;
        ob.indexMitigation = i;
      }
      // OB haussier invalidé/mitigué si le prix traverse le bas
      else if (ob.biais === 1 && testBas < ob.bas) {
        ob.mitige = true;
        ob.indexMitigation = i;
      }
    }

    // 2. Mitigation des Fair Value Gaps (FVG)
    for (let k = 0; k < fvgs.length; k++) {
      const gap = fvgs[k];
      if (gap.mitige || gap.index >= i) continue;

      if (gap.biais === 1 && b.low < gap.bas) {
        gap.mitige = true;
      } else if (gap.biais === -1 && b.high > gap.haut) {
        gap.mitige = true;
      }
    }

    // 3. Balayage des EQH / EQL
    for (let k = 0; k < equalHighsLows.length; k++) {
      const eq = equalHighsLows[k];
      if (eq.mitige || eq.index2 >= i) continue;

      if (eq.type === 'EQH' && b.high > eq.prix) {
        eq.mitige = true; // Sommets égaux balayés
      } else if (eq.type === 'EQL' && b.low < eq.prix) {
        eq.mitige = true; // Creux égaux balayés
      }
    }
  }

  // 2️⃣ Calcul des Zones Premium / Discount & Équilibre
  let premiumDiscount: ZonesPremiumDiscount | undefined;
  if (trailingHigh.prix > trailingLow.prix) {
    const h = trailingHigh.prix;
    const b = trailingLow.prix;
    const eq = (h + b) / 2;

    const prixActuel = bougies[totalBars - 1].close;
    const rangeTotal = h - b;
    const pct = rangeTotal > 0 ? Math.max(0, Math.min(100, ((prixActuel - b) / rangeTotal) * 100)) : 50;

    let position: 'PREMIUM' | 'DISCOUNT' | 'EQUILIBRE' = 'EQUILIBRE';
    if (pct >= 52.5) position = 'PREMIUM';
    else if (pct <= 47.5) position = 'DISCOUNT';

    premiumDiscount = {
      hautRange: h,
      basRange: b,
      prixEquilibre: eq,
      zonePremium: { haut: h, bas: 0.95 * h + 0.05 * b },
      zoneDiscount: { haut: 0.95 * b + 0.05 * h, bas: b },
      zoneEquilibre: { haut: 0.525 * h + 0.475 * b, bas: 0.525 * b + 0.475 * h },
      positionActuelle: position,
      pourcentageRange: Number(pct.toFixed(1)),
    };
  }

  // 3️⃣ Extrêmes Strong / Weak selon la tendance Swing
  const strongWeakExtremes = {
    strongHigh: swingTrend === -1 ? trailingHigh.prix : undefined,
    weakHigh: swingTrend === 1 ? trailingHigh.prix : undefined,
    strongLow: swingTrend === 1 ? trailingLow.prix : undefined,
    weakLow: swingTrend === -1 ? trailingLow.prix : undefined,
    tempsHaut: trailingHigh.temps,
    tempsBas: trailingLow.temps,
  };

  // Filtrer les order blocks récents (max limit)
  const orderBlocksFiltres = orderBlocks.slice(0, maxOrderBlocks * 2);

  return {
    cassures,
    orderBlocks: orderBlocksFiltres,
    equalHighsLows,
    fvgs,
    strongWeakExtremes,
    premiumDiscount,
    tendanceSwing: swingTrend === 1 ? 'BULLISH' : 'BEARISH',
    tendanceInterne: internalTrend === 1 ? 'BULLISH' : 'BEARISH',
  };
}

// ─── 📊 Télémétrie de Trade (Snapshot) ────────────────────────────────────────

/**
 * Capture l'état technique complet de LuxAlgo SMC au moment précis d'un trade
 * 
 * Exemple :
 * const snap = capturerSnapshotSMC(resultatSMC, bougieCourante.close);
 */
export function capturerSnapshotSMC(
  resultat: ResultatLuxAlgoSMC,
  prixActuel: number
): SnapshotSMC {
  const { cassures, orderBlocks, equalHighsLows, fvgs, premiumDiscount, tendanceSwing, tendanceInterne } = resultat;

  const pipDiviseur = prixActuel < 2.0 ? 0.0001 : (prixActuel < 500 ? 0.01 : 1.0);

  // Trouver le dernier événement de cassure (BOS ou CHoCH)
  const derniereCassure = cassures.length > 0 ? cassures[cassures.length - 1] : undefined;

  // Calcul de la distance à l'Order Block actif le plus proche
  let distMinPoints = Infinity;
  let obPlusProcheBiais: 'haussier' | 'baissier' | undefined;

  for (const ob of orderBlocks) {
    if (ob.mitige) continue;
    const centreOB = (ob.haut + ob.bas) / 2;
    const dist = Math.abs(prixActuel - centreOB);
    if (dist < distMinPoints) {
      distMinPoints = dist;
      obPlusProcheBiais = ob.biais === 1 ? 'haussier' : 'baissier';
    }
  }

  const distMinPips = distMinPoints !== Infinity ? Number((distMinPoints / pipDiviseur).toFixed(1)) : 0;

  // Compter les éléments actifs non mitigés
  const nbOBActifs = orderBlocks.filter((o) => !o.mitige).length;
  const nbEQHActifs = equalHighsLows.filter((e) => !e.mitige && e.type === 'EQH').length;
  const nbEQLActifs = equalHighsLows.filter((e) => !e.mitige && e.type === 'EQL').length;
  const nbFVGActifs = fvgs.filter((f) => !f.mitige).length;

  return {
    tendanceSwing,
    tendanceInterne,
    dernierEvenementType: derniereCassure ? `${derniereCassure.internal ? 'Int' : 'Swing'} ${derniereCassure.type}` : 'Aucun',
    dernierEvenementPrix: derniereCassure ? derniereCassure.prix : prixActuel,
    positionRange: premiumDiscount ? premiumDiscount.positionActuelle : 'EQUILIBRE',
    pourcentageRange: premiumDiscount ? premiumDiscount.pourcentageRange : 50,
    proximiteOrderBlockPips: distMinPips,
    orderBlockPlusProcheBiais: obPlusProcheBiais,
    nbOrderBlocksActifs: nbOBActifs,
    nbEQHActifs,
    nbEQLActifs,
    nbFVGActifs,
  };
}
