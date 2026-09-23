import type { Bougie } from '@/lib/chartDataHelper';

// ─── 🛡️ Types et Structures de données ────────────────────────────────────────

/**
 * Représente un Fair Value Gap (FVG / Déséquilibre de prix)
 */
export interface FVG {
  top: number;          // Borne supérieure du gap
  bottom: number;       // Borne inférieure du gap
  dir: 1 | -1;          // +1 pour Bullish (Gap Up), -1 pour Bearish (Gap Down)
  startIndex: number;   // Index de la bougie bar - 2 où débute le gap
  timeStart: number | string; // Date ou timestamp de début
  endIndex: number;     // Index de fin (étendu jusqu'à atténuation)
  timeEnd: number | string;   // Date ou timestamp de fin
  mitigated: boolean;   // Vrai si le prix a pénétré dans le gap
}

/**
 * Structure interne pour un Swing en attente de confirmation CISD
 */
export interface PendingSwing {
  swingPrice: number;   // Prix extrême du creux ou du sommet
  level: number;        // Niveau CISD (prix d'ouverture de la première bougie de la série)
  swingBar: number;     // Index de la bougie du swing (bar - 1)
  swingTime: number | string;
  levelBar: number;     // Index de la bougie source du niveau CISD
  levelTime: number | string;
  isBullish: boolean;   // Vrai pour un creux haussier (PSL), faux pour un sommet (PSH)
  swept: boolean;       // Vrai si le swing a balayé un pivot précédent
  fvgMitigated: boolean;// Vrai si le swing a comblé/atténué un FVG
  active: boolean;      // Vrai tant que non confirmé ni invalidé
}

/**
 * Représente un Protected Swing validé et confirmé
 * PSL = Protected Swing Low (Creux protégé haussier)
 * PSH = Protected Swing High (Sommet protégé baissier)
 */
export interface ProtectedSwingConfirme {
  id: string;
  type: 'PSL' | 'PSH';
  isBullish: boolean;
  swingPrice: number;
  levelPrice: number;   // Niveau CISD
  swingIndex: number;
  swingTime: number | string;
  levelIndex: number;
  levelTime: number | string;
  confirmationIndex: number;
  confirmationTime: number | string;
  cause: 'sweep' | 'fvg' | 'both';
  barsToConfirm: number; // Nombre de bougies entre le swing et sa confirmation
}

/**
 * Représente un balayage de liquidité (Sweep) détecté sur une mèche
 */
export interface SweepEvent {
  barIndex: number;
  time: number | string;
  price: number;        // Prix extrême de la mèche qui a balayé
  sweptPrice: number;   // Niveau du pivot qui a été balayé
  isHigh: boolean;      // Vrai si balayage d'un sommet, faux si balayage d'un creux
  originBarIndex: number; // Index du pivot d'origine
  originTime: number | string;
}

/**
 * Options de configuration de l'indicateur Protected Swings
 */
export interface ProtectedSwingsOptions {
  sweepSensitivity?: number;      // Nombre de bougies à gauche et droite pour valider un pivot (défaut: 5)
  includeFvgMitigation?: boolean; // Prendre en compte l'atténuation d'un FVG pour former un swing (défaut: true)
  fvgLookback?: number;           // Nombre maximum de FVG conservés en mémoire (défaut: 50)
  maxBarsLookback?: number;       // Nombre de bougies historiques analysées (défaut: 1500)
}

/**
 * Résultat complet retourné par le moteur de calcul
 */
export interface ProtectedSwingsResultat {
  swingsConfirmes: ProtectedSwingConfirme[];
  swingsEnAttente: PendingSwing[];
  fvgs: FVG[];
  sweeps: SweepEvent[];
  dernierPsl?: ProtectedSwingConfirme;
  dernierPsh?: ProtectedSwingConfirme;
  dernierSignal?: ProtectedSwingConfirme;
}

/**
 * Snapshot de télémétrie prêt à être attaché à une position de trading
 * Permet de comprendre le contexte technique exact au moment de la prise de position.
 */
export interface SnapshotProtectedSwings {
  dernierSignalType: 'PSL' | 'PSH' | 'AUCUN';
  bougiesDepuisSignal: number;
  prixSwing: number | null;
  niveauCisd: number | null;
  causeValidation: 'sweep' | 'fvg' | 'both' | 'aucune';
  fvgActifProche: { top: number; bottom: number; dir: 1 | -1 } | null;
  dernierSweepRecent: boolean;
}

// ─── 🔍 Fonctions utilitaires de détection des pivots ─────────────────────────

/**
 * Vérifie si une bougie donnée est un pivot haut (sommet local supérieur à ses voisins)
 * 
 * Exemple :
 * const estSommet = estPivotHaut(mesBougies, 10, 5, 5);
 */
export function estPivotHaut(bougies: Bougie[], indexBougie: number, gauche: number, droite: number): boolean {
  // Sécurité sur les limites du tableau
  if (indexBougie - gauche < 0 || indexBougie + droite >= bougies.length) return false;

  const prixHaut = bougies[indexBougie].high;

  // 1️⃣ Vérification côté gauche : toutes les bougies doivent avoir un high inférieur
  for (let k = indexBougie - gauche; k < indexBougie; k++) {
    if (bougies[k].high > prixHaut) return false;
  }

  // 2️⃣ Vérification côté droit : toutes les bougies doivent avoir un high strictement inférieur
  for (let k = indexBougie + 1; k <= indexBougie + droite; k++) {
    if (bougies[k].high >= prixHaut) return false;
  }

  return true;
}

/**
 * Vérifie si une bougie donnée est un pivot bas (creux local inférieur à ses voisins)
 * 
 * Exemple :
 * const estCreux = estPivotBas(mesBougies, 10, 5, 5);
 */
export function estPivotBas(bougies: Bougie[], indexBougie: number, gauche: number, droite: number): boolean {
  if (indexBougie - gauche < 0 || indexBougie + droite >= bougies.length) return false;

  const prixBas = bougies[indexBougie].low;

  // 1️⃣ Vérification côté gauche : toutes les bougies doivent avoir un low supérieur
  for (let k = indexBougie - gauche; k < indexBougie; k++) {
    if (bougies[k].low < prixBas) return false;
  }

  // 2️⃣ Vérification côté droit : toutes les bougies doivent avoir un low strictement supérieur
  for (let k = indexBougie + 1; k <= indexBougie + droite; k++) {
    if (bougies[k].low <= prixBas) return false;
  }

  return true;
}

// ─── ⚙️ Moteur Principal de Calcul ───────────────────────────────────────────

/**
 * Calcule l'indicateur LuxAlgo Protected Swings sur une liste chronologique de bougies.
 * 
 * Implémente fidèlement l'algorithme MQL5 / Pine Script :
 * 1. Détection des Pivots High / Low et Sweeps de liquidité.
 * 2. Détection et suivi des zones de Fair Value Gaps (FVG).
 * 3. Identification des Swings sur bar - 1.
 * 4. Détermination du niveau CISD (Change In State of Delivery).
 * 5. Validation par clôture au-delà du niveau CISD (confirmation PSL/PSH).
 * 
 * Exemple d'utilisation :
 * const resultat = calculerProtectedSwings(donneesBougies);
 * console.log(`Nombre de signaux confirmés : ${resultat.swingsConfirmes.length}`);
 */
export function calculerProtectedSwings(
  bougies: Bougie[],
  options: ProtectedSwingsOptions = {}
): ProtectedSwingsResultat {
  const {
    sweepSensitivity = 5,
    includeFvgMitigation = true,
    fvgLookback = 50,
    maxBarsLookback = 1500,
  } = options;

  const resultat: ProtectedSwingsResultat = {
    swingsConfirmes: [],
    swingsEnAttente: [],
    fvgs: [],
    sweeps: [],
  };

  const totalBougies = bougies.length;
  const minBougiesRequises = Math.max(5, sweepSensitivity * 2 + 1);

  // Si nous n'avons pas assez de données historiques, retourner un résultat vide
  if (totalBougies < minBougiesRequises) {
    return resultat;
  }

  // Point de départ chronologique (au moins sweepSensitivity * 2 pour évaluer les premiers pivots)
  const indexDepart = Math.max(sweepSensitivity * 2, totalBougies - maxBarsLookback);

  // Mémoire des derniers pivots confirmés
  let dernierPivotHautPrix = 0;
  let dernierPivotHautIndex = -1;
  let dernierPivotHautDate: number | string = '';

  let dernierPivotBasPrix = 0;
  let dernierPivotBasIndex = -1;
  let dernierPivotBasDate: number | string = '';

  // Listes dynamiques pendant le balayage
  const fvgsActifs: FVG[] = [];
  const pendingSwings: PendingSwing[] = [];
  let compteurSignaux = 0;

  // 🔄 Parcours chronologique bougie par bougie
  for (let bar = indexDepart; bar < totalBougies; bar++) {
    const bougieActuelle = bougies[bar];

    // ─────────────────────────────────────────────────────────────────────────
    // ÉTAPE A : Détection des Pivots & Balayages de liquidité (Sweeps)
    // ─────────────────────────────────────────────────────────────────────────
    const candPivot = bar - sweepSensitivity;
    if (candPivot >= sweepSensitivity) {
      if (estPivotHaut(bougies, candPivot, sweepSensitivity, sweepSensitivity)) {
        dernierPivotHautPrix = bougies[candPivot].high;
        dernierPivotHautIndex = candPivot;
        dernierPivotHautDate = bougies[candPivot].time;
      }

      if (estPivotBas(bougies, candPivot, sweepSensitivity, sweepSensitivity)) {
        dernierPivotBasPrix = bougies[candPivot].low;
        dernierPivotBasIndex = candPivot;
        dernierPivotBasDate = bougies[candPivot].time;
      }
    }

    const precedentHaut = dernierPivotHautPrix;
    const precedentBas = dernierPivotBasPrix;

    // Un sweep (balayage) est valide si la mèche franchit le pivot mais le corps clôture à l'intérieur
    const isSweepHigh = precedentHaut > 0 &&
      bougieActuelle.high > precedentHaut &&
      Math.max(bougieActuelle.open, bougieActuelle.close) <= precedentHaut;

    const isSweepLow = precedentBas > 0 &&
      bougieActuelle.low < precedentBas &&
      Math.min(bougieActuelle.open, bougieActuelle.close) >= precedentBas;

    if (isSweepHigh && dernierPivotHautIndex >= 0) {
      resultat.sweeps.push({
        barIndex: bar,
        time: bougieActuelle.time,
        price: bougieActuelle.high,
        sweptPrice: precedentHaut,
        isHigh: true,
        originBarIndex: dernierPivotHautIndex,
        originTime: dernierPivotHautDate,
      });
    }

    if (isSweepLow && dernierPivotBasIndex >= 0) {
      resultat.sweeps.push({
        barIndex: bar,
        time: bougieActuelle.time,
        price: bougieActuelle.low,
        sweptPrice: precedentBas,
        isHigh: false,
        originBarIndex: dernierPivotBasIndex,
        originTime: dernierPivotBasDate,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ÉTAPE B : Détection et Gestion des Fair Value Gaps (FVG)
    // ─────────────────────────────────────────────────────────────────────────
    const bougieNMoins2 = bougies[bar - 2];

    // FVG Haussier (Gap Up) : le high de bar - 2 est inférieur au low de bar
    if (bougieNMoins2.high < bougieActuelle.low) {
      const nouveauFvg: FVG = {
        top: bougieActuelle.low,
        bottom: bougieNMoins2.high,
        dir: 1,
        startIndex: bar - 2,
        timeStart: bougieNMoins2.time,
        endIndex: bar,
        timeEnd: bougieActuelle.time,
        mitigated: false,
      };
      fvgsActifs.unshift(nouveauFvg);
    }
    // FVG Baissier (Gap Down) : le low de bar - 2 est supérieur au high de bar
    else if (bougieNMoins2.low > bougieActuelle.high) {
      const nouveauFvg: FVG = {
        top: bougieNMoins2.low,
        bottom: bougieActuelle.high,
        dir: -1,
        startIndex: bar - 2,
        timeStart: bougieNMoins2.time,
        endIndex: bar,
        timeEnd: bougieActuelle.time,
        mitigated: false,
      };
      fvgsActifs.unshift(nouveauFvg);
    }

    // Mise à jour de l'atténuation (mitigation) des FVG actifs
    for (let fIdx = fvgsActifs.length - 1; fIdx >= 0; fIdx--) {
      const fvg = fvgsActifs[fIdx];
      if (!fvg.mitigated) {
        fvg.endIndex = bar;
        fvg.timeEnd = bougieActuelle.time;

        // Si le prix entre dans le FVG, il est atténué
        if (fvg.dir === 1 && bougieActuelle.low <= fvg.top) {
          fvg.mitigated = true;
        } else if (fvg.dir === -1 && bougieActuelle.high >= fvg.bottom) {
          fvg.mitigated = true;
        }
      }

      // Nettoyage des vieux FVG au-delà du lookback
      if (fIdx > fvgLookback) {
        fvgsActifs.splice(fIdx, 1);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ÉTAPE C : Contexte du Swing sur la bougie précédente (bar - 1)
    // ─────────────────────────────────────────────────────────────────────────
    const bougieNMoins1 = bougies[bar - 1];

    const isSwingLow = bougieNMoins1.low < bougieActuelle.low && bougieNMoins1.low < bougieNMoins2.low;
    const isSwingHigh = bougieNMoins1.high > bougieActuelle.high && bougieNMoins1.high > bougieNMoins2.high;

    // Vérifie si la bougie bar - 1 a balayé un pivot
    const sweptLow = precedentBas > 0 &&
      bougieNMoins1.low < precedentBas &&
      Math.min(bougieNMoins1.open, bougieNMoins1.close) >= precedentBas;

    const sweptHigh = precedentHaut > 0 &&
      bougieNMoins1.high > precedentHaut &&
      Math.max(bougieNMoins1.open, bougieNMoins1.close) <= precedentHaut;

    // Vérifie si la bougie bar - 1 a atténué un FVG actif
    let mitigatedFvgBull = false;
    let mitigatedFvgBear = false;

    if (includeFvgMitigation) {
      for (const fvg of fvgsActifs) {
        if (fvg.dir === 1 && bougieNMoins1.low <= fvg.top && bougieNMoins1.low >= fvg.bottom) {
          mitigatedFvgBull = true;
        }
        if (fvg.dir === -1 && bougieNMoins1.high >= fvg.bottom && bougieNMoins1.high <= fvg.top) {
          mitigatedFvgBear = true;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ÉTAPE D : Série Consécutive & Fixation du Niveau CISD
    // ─────────────────────────────────────────────────────────────────────────

    // 1. Cas Haussier (PSL potentiel) : Creux sur bougie baissière (close < open)
    if (isSwingLow && (sweptLow || mitigatedFvgBull) && bougieNMoins1.close < bougieNMoins1.open) {
      let recul = 1;
      // Remonter la série de bougies baissières consécutives (jusqu'à 15 bougies max)
      while (
        recul < 15 &&
        bar - (recul + 1) >= 0 &&
        bougies[bar - (recul + 1)].close < bougies[bar - (recul + 1)].open
      ) {
        recul++;
      }

      const niveauCISD = bougies[bar - recul].open;
      const barNiveau = bar - recul;

      pendingSwings.unshift({
        swingPrice: bougieNMoins1.low,
        level: niveauCISD,
        swingBar: bar - 1,
        swingTime: bougieNMoins1.time,
        levelBar: barNiveau,
        levelTime: bougies[barNiveau].time,
        isBullish: true,
        swept: sweptLow,
        fvgMitigated: mitigatedFvgBull,
        active: true,
      });
    }

    // 2. Cas Baissier (PSH potentiel) : Sommet sur bougie haussière (close > open)
    if (isSwingHigh && (sweptHigh || mitigatedFvgBear) && bougieNMoins1.close > bougieNMoins1.open) {
      let recul = 1;
      // Remonter la série de bougies haussières consécutives (jusqu'à 15 bougies max)
      while (
        recul < 15 &&
        bar - (recul + 1) >= 0 &&
        bougies[bar - (recul + 1)].close > bougies[bar - (recul + 1)].open
      ) {
        recul++;
      }

      const niveauCISD = bougies[bar - recul].open;
      const barNiveau = bar - recul;

      pendingSwings.unshift({
        swingPrice: bougieNMoins1.high,
        level: niveauCISD,
        swingBar: bar - 1,
        swingTime: bougieNMoins1.time,
        levelBar: barNiveau,
        levelTime: bougies[barNiveau].time,
        isBullish: false,
        swept: sweptHigh,
        fvgMitigated: mitigatedFvgBear,
        active: true,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ÉTAPE E : Confirmation CISD ou Invalidation des Swings en Attente
    // ─────────────────────────────────────────────────────────────────────────
    for (let pIdx = pendingSwings.length - 1; pIdx >= 0; pIdx--) {
      const ps = pendingSwings[pIdx];
      if (!ps.active) continue;

      let estConfirme = false;

      if (ps.isBullish) {
        // Invalidation : le prix casse plus bas que le creux avant la confirmation
        if (bougieActuelle.low < ps.swingPrice) {
          ps.active = false;
        }
        // Confirmation : la clôture dépasse le niveau CISD
        else if (bougieActuelle.close > ps.level) {
          estConfirme = true;
        }
      } else {
        // Invalidation : le prix casse plus haut que le sommet avant la confirmation
        if (bougieActuelle.high > ps.swingPrice) {
          ps.active = false;
        }
        // Confirmation : la clôture passe sous le niveau CISD
        else if (bougieActuelle.close < ps.level) {
          estConfirme = true;
        }
      }

      // Si le swing est confirmé (Protected Swing Low ou High)
      if (estConfirme) {
        ps.active = false;
        compteurSignaux++;

        const causeType: 'sweep' | 'fvg' | 'both' = (ps.swept && ps.fvgMitigated)
          ? 'both'
          : (ps.swept ? 'sweep' : 'fvg');

        const swingConfirme: ProtectedSwingConfirme = {
          id: `ps_${compteurSignaux}_${bar}`,
          type: ps.isBullish ? 'PSL' : 'PSH',
          isBullish: ps.isBullish,
          swingPrice: ps.swingPrice,
          levelPrice: ps.level,
          swingIndex: ps.swingBar,
          swingTime: ps.swingTime,
          levelIndex: ps.levelBar,
          levelTime: ps.levelTime,
          confirmationIndex: bar,
          confirmationTime: bougieActuelle.time,
          cause: causeType,
          barsToConfirm: bar - ps.swingBar,
        };

        resultat.swingsConfirmes.push(swingConfirme);

        // Mettre à jour les raccourcis de derniers signaux
        if (ps.isBullish) {
          resultat.dernierPsl = swingConfirme;
        } else {
          resultat.dernierPsh = swingConfirme;
        }
        resultat.dernierSignal = swingConfirme;

        // Retirer le swing confirmé de la liste d'attente
        pendingSwings.splice(pIdx, 1);
      }
    }

    // Limiter la taille de la liste d'attente à 50 éléments (comme en MQL5)
    while (pendingSwings.length > 50) {
      pendingSwings.pop();
    }
  }

  // Stocker les FVG calculés et les swings en attente restants
  resultat.fvgs = fvgsActifs;
  resultat.swingsEnAttente = pendingSwings;

  return resultat;
}

// ─── 📊 Télémétrie pour les Trades (Capture Snapshot) ─────────────────────────

/**
 * Capture un snapshot de l'état des Protected Swings à un index de bougie donné (ex: lors d'une prise de position).
 * 
 * Exemple :
 * const snapshot = capturerSnapshotProtectedSwings(resultatIndicateur, indexTrade);
 * console.log(snapshot.dernierSignalType); // "PSL"
 * console.log(snapshot.bougiesDepuisSignal); // 2 bougies
 */
export function capturerSnapshotProtectedSwings(
  resultat: ProtectedSwingsResultat,
  indexBougieActuelle: number
): SnapshotProtectedSwings {
  // Trouver le dernier signal confirmé avant ou à l'index actuel
  let dernierSignalValide: ProtectedSwingConfirme | undefined;

  for (let i = resultat.swingsConfirmes.length - 1; i >= 0; i--) {
    const s = resultat.swingsConfirmes[i];
    if (s.confirmationIndex <= indexBougieActuelle) {
      dernierSignalValide = s;
      break;
    }
  }

  // Vérifier s'il y a eu un sweep très récent (moins de 5 bougies)
  const dernierSweepRecent = resultat.sweeps.some(
    swp => swp.barIndex <= indexBougieActuelle && indexBougieActuelle - swp.barIndex <= 5
  );

  // Chercher un FVG actif proche à cet index
  const fvgProche = resultat.fvgs.find(
    fvg => fvg.startIndex <= indexBougieActuelle && (!fvg.mitigated || fvg.endIndex >= indexBougieActuelle)
  );

  if (!dernierSignalValide) {
    return {
      dernierSignalType: 'AUCUN',
      bougiesDepuisSignal: 999,
      prixSwing: null,
      niveauCisd: null,
      causeValidation: 'aucune',
      fvgActifProche: fvgProche ? { top: fvgProche.top, bottom: fvgProche.bottom, dir: fvgProche.dir } : null,
      dernierSweepRecent,
    };
  }

  return {
    dernierSignalType: dernierSignalValide.type,
    bougiesDepuisSignal: indexBougieActuelle - dernierSignalValide.confirmationIndex,
    prixSwing: dernierSignalValide.swingPrice,
    niveauCisd: dernierSignalValide.levelPrice,
    causeValidation: dernierSignalValide.cause,
    fvgActifProche: fvgProche ? { top: fvgProche.top, bottom: fvgProche.bottom, dir: fvgProche.dir } : null,
    dernierSweepRecent,
  };
}
