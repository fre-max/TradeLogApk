import type { Bougie } from '@/lib/chartDataHelper';

// ─── 📊 Structures et Types de Données ────────────────────────────────────────

/**
 * Point de pivot confirmé ou actif sur la structure ZigZag
 */
export interface PointZigZag {
  prix: number;
  temps: number | string;
  index: number;
  estHaut: boolean; // Vrai si sommet, faux si creux
}

/**
 * Palier de prix (bucket) accumulant le volume échangé dans une vague
 */
export interface PalierVolume {
  price: number;       // Prix central du palier
  volume: number;      // Volume cumulé sur ce niveau
  isMitigated: boolean;// Vrai si revisité ultérieurement par une bougie postérieure
}

/**
 * Vague structurelle reliant deux pivots alternés du ZigZag
 */
export interface VagueZigZag {
  id: number;
  indexDebut: number;
  indexFin: number;
  tempsDebut: number | string;
  tempsFin: number | string;
  prixDebut: number;
  prixFin: number;
  estHaussiere: boolean;
  paliers: PalierVolume[];
  volumeMaxNonMitigue: number;
  totalNiveauxNonMitigues: number;
}

/**
 * Niveau non mitigué ouvert utilisable comme cible de prix (draw on liquidity / POI)
 */
export interface NiveauOuvertUVP {
  price: number;
  volume: number;
  vagueId: number;
  estHaussiere: boolean;
  tempsDebut: number | string;
  tempsFin: number | string;
}

/**
 * Options de configuration du profil de volume non mitigué
 */
export interface OptionsUVP {
  zigzagDepth?: number;    // Nombre de bougies gauche/droite pour valider un pivot (défaut: 8)
  maxVagues?: number;      // Nombre de vagues récentes à analyser (défaut: 5)
  lookbackBars?: number;   // Nombre de bougies historiques prises en compte (défaut: 500)
  priceStep?: number;      // Résolution en prix de chaque palier (auto-adaptatif si non fourni)
  prolongerNiveaux?: boolean; // Prolonger les niveaux non mitigués vers la droite (défaut: true)
}

/**
 * Résultat complet de l'analyse UVP
 */
export interface ResultatUVP {
  pivots: PointZigZag[];
  vagues: VagueZigZag[];
  niveauxOuverts: NiveauOuvertUVP[];
  totalNiveauxOuverts: number;
  step: number;
}

/**
 * Snapshot technique prêt à être enregistré dans le journal lors d'une prise de trade
 */
export interface SnapshotUVP {
  totalNiveauxOuverts: number;
  nbNiveauxAuDessus: number;
  nbNiveauxEnDessous: number;
  niveauPlusProcheHaut: { price: number; distancePoints: number; volume: number } | null;
  niveauPlusProcheBas: { price: number; distancePoints: number; volume: number } | null;
  pocNonMitigueMajeur: { price: number; volume: number; directionVague: 'haussiere' | 'baissiere' } | null;
}

// ─── 📐 Utilitaires de pas de prix adaptatif ───────────────────────────────────

/**
 * Détermine un pas de prix cohérent avec l'actif si l'utilisateur n'en précise pas.
 * 
 * Exemple :
 * const step = determinerStepPrix(bougies); // 0.0001 pour Forex, 0.05 pour Gold, etc.
 */
export function determinerStepPrix(bougies: Bougie[], stepManuel?: number): number {
  if (stepManuel && stepManuel > 0) return stepManuel;
  if (bougies.length === 0) return 0.0001;

  const dernierPrix = bougies[bougies.length - 1].close;
  if (dernierPrix <= 0) return 0.0001;

  // Devises Forex (ex: EURUSD 1.0850) -> 1 pip = 0.0001
  if (dernierPrix < 2.0) return 0.0001;
  // Paires JPY / Métaux / Pétrole (ex: 150.00 ou 85.00) -> 0.05
  if (dernierPrix < 500.0) return 0.05;
  // Crypto et indices (ex: BTC 65000, US30 39000) -> 5.0
  return 5.0;
}

// ─── ⚡ Détection des Pivots ZigZag Alternés ───────────────────────────────────

/**
 * Identifie les pivots majeurs d'un ZigZag avec alternance stricte (Haut -> Bas -> Haut)
 * et incorpore la vague courante en cours de formation vers la dernière bougie.
 * 
 * Exemple :
 * const pivots = detecterPivotsZigZag(bougies, 8, 500);
 */
export function detecterPivotsZigZag(
  bougies: Bougie[],
  depth: number = 8,
  lookback: number = 500
): PointZigZag[] {
  const totalBars = bougies.length;
  if (totalBars < depth * 2 + 2) return [];

  const startBar = Math.max(depth, totalBars - lookback);
  const endBar = totalBars - depth - 1;

  const pivotsBruts: PointZigZag[] = [];

  // 1️⃣ Recherche des pivots confirmés
  for (let i = startBar; i <= endBar; i++) {
    let estHaut = true;
    let estBas = true;

    const highRef = bougies[i].high;
    const lowRef = bougies[i].low;

    for (let j = 1; j <= depth; j++) {
      if (highRef <= bougies[i - j].high || highRef < bougies[i + j].high) estHaut = false;
      if (lowRef >= bougies[i - j].low || lowRef > bougies[i + j].low) estBas = false;
    }

    if (estHaut) {
      pivotsBruts.push({
        prix: highRef,
        temps: bougies[i].time,
        index: i,
        estHaut: true,
      });
    } else if (estBas) {
      pivotsBruts.push({
        prix: lowRef,
        temps: bougies[i].time,
        index: i,
        estHaut: false,
      });
    }
  }

  if (pivotsBruts.length === 0) return [];

  // 2️⃣ Filtrage pour garantir une alternance stricte : Sommet -> Creux -> Sommet
  const pivotsZigZag: PointZigZag[] = [pivotsBruts[0]];

  for (let i = 1; i < pivotsBruts.length; i++) {
    const dernierPivot = pivotsZigZag[pivotsZigZag.length - 1];
    const courant = pivotsBruts[i];

    if (courant.estHaut === dernierPivot.estHaut) {
      // Si deux sommets consécutifs, on conserve le plus haut
      if (courant.estHaut && courant.prix > dernierPivot.prix) {
        pivotsZigZag[pivotsZigZag.length - 1] = courant;
      }
      // Si deux creux consécutifs, on conserve le plus bas
      else if (!courant.estHaut && courant.prix < dernierPivot.prix) {
        pivotsZigZag[pivotsZigZag.length - 1] = courant;
      }
    } else {
      pivotsZigZag.push(courant);
    }
  }

  // 2.5️⃣ Ancrage du premier pivot sur l'extrême initial pour ne pas orpheliner le début du graphique
  if (pivotsZigZag.length > 0 && pivotsZigZag[0].index > 0) {
    const premierPivot = pivotsZigZag[0];
    let initialIdx = 0;
    let initialPrix = premierPivot.estHaut ? bougies[0].low : bougies[0].high;

    for (let k = 1; k < premierPivot.index; k++) {
      if (premierPivot.estHaut && bougies[k].low < initialPrix) {
        initialPrix = bougies[k].low;
        initialIdx = k;
      } else if (!premierPivot.estHaut && bougies[k].high > initialPrix) {
        initialPrix = bougies[k].high;
        initialIdx = k;
      }
    }

    pivotsZigZag.unshift({
      index: initialIdx,
      temps: bougies[initialIdx].time,
      prix: initialPrix,
      estHaut: !premierPivot.estHaut,
    });
  }

  // 3️⃣ Prolongation et ajustement de la vague active jusqu'à la dernière bougie
  if (pivotsZigZag.length >= 1) {
    let dernierIdx = pivotsZigZag[pivotsZigZag.length - 1].index;
    const dernierEstHaut = pivotsZigZag[pivotsZigZag.length - 1].estHaut;

    // Si le cours a continué au-delà du dernier pivot, on l'étend
    if (dernierEstHaut) {
      let plusHautIdx = dernierIdx;
      let plusHautPrix = pivotsZigZag[pivotsZigZag.length - 1].prix;
      for (let k = dernierIdx + 1; k < totalBars; k++) {
        if (bougies[k].high > plusHautPrix) {
          plusHautPrix = bougies[k].high;
          plusHautIdx = k;
        }
      }
      if (plusHautIdx !== dernierIdx) {
        pivotsZigZag[pivotsZigZag.length - 1].prix = plusHautPrix;
        pivotsZigZag[pivotsZigZag.length - 1].index = plusHautIdx;
        pivotsZigZag[pivotsZigZag.length - 1].temps = bougies[plusHautIdx].time;
        dernierIdx = plusHautIdx;
      }
    } else {
      let plusBasIdx = dernierIdx;
      let plusBasPrix = pivotsZigZag[pivotsZigZag.length - 1].prix;
      for (let k = dernierIdx + 1; k < totalBars; k++) {
        if (bougies[k].low < plusBasPrix) {
          plusBasPrix = bougies[k].low;
          plusBasIdx = k;
        }
      }
      if (plusBasIdx !== dernierIdx) {
        pivotsZigZag[pivotsZigZag.length - 1].prix = plusBasPrix;
        pivotsZigZag[pivotsZigZag.length - 1].index = plusBasIdx;
        pivotsZigZag[pivotsZigZag.length - 1].temps = bougies[plusBasIdx].time;
        dernierIdx = plusBasIdx;
      }
    }

    // Ajout de la vague en cours se déployant vers la bougie courante
    if (dernierIdx < totalBars - 1) {
      const currentBarIdx = totalBars - 1;
      const bougieFin = bougies[currentBarIdx];

      pivotsZigZag.push({
        index: currentBarIdx,
        temps: bougieFin.time,
        prix: dernierEstHaut ? bougieFin.low : bougieFin.high,
        estHaut: !dernierEstHaut,
      });
    }
  }

  return pivotsZigZag;
}

// ─── ⚙️ Moteur Principal : Calcul du Profil Non Mitigué ───────────────────────

/**
 * Calcule le profil de volume par vague ZigZag et détecte les zones non mitiguées
 * (niveaux vierges de liquidité non comblés ultérieurement).
 * 
 * Exemple :
 * const resultat = calculerUnmitigatedVolumeProfile(bougies, { maxVagues: 5 });
 * console.log(`Total niveaux ouverts : ${resultat.totalNiveauxOuverts}`);
 */
export function calculerUnmitigatedVolumeProfile(
  bougies: Bougie[],
  options: OptionsUVP = {}
): ResultatUVP {
  const {
    zigzagDepth = 8,
    maxVagues = 5,
    lookbackBars = 500,
    priceStep,
  } = options;

  const totalBars = bougies.length;
  const step = determinerStepPrix(bougies, priceStep);

  const pivots = detecterPivotsZigZag(bougies, zigzagDepth, lookbackBars);
  const vagues: VagueZigZag[] = [];
  const niveauxOuverts: NiveauOuvertUVP[] = [];

  if (pivots.length < 2) {
    return {
      pivots,
      vagues: [],
      niveauxOuverts: [],
      totalNiveauxOuverts: 0,
      step,
    };
  }

  const totalVaguesDisponibles = pivots.length - 1;
  const vagueDepart = Math.max(0, totalVaguesDisponibles - maxVagues);

  let vagueId = 0;

  // 🔄 Parcours de chaque vague sélectionnée
  for (let v = vagueDepart; v < totalVaguesDisponibles; v++) {
    const ptA = pivots[v];
    const ptB = pivots[v + 1];

    let idxDebut = ptA.index;
    let idxFin = ptB.index;
    if (idxDebut > idxFin) {
      const temp = idxDebut;
      idxDebut = idxFin;
      idxFin = temp;
    }

    // 1️⃣ Première passe : Accumulation du volume par palier de prix dans la vague
    const bucketsMap = new Map<number, number>();

    for (let b = idxDebut; b <= idxFin; b++) {
      const bougie = bougies[b];
      const candleRange = bougie.high - bougie.low;
      if (candleRange <= 0) continue;

      // Récupération du volume réel ou volume de tick
      const volBougie = (bougie as any).volume || (bougie as any).tick_volume || 100;
      const nbPaliers = Math.max(1, Math.round(candleRange / step));
      const volParPalier = Math.max(1, Math.round(volBougie / nbPaliers));

      for (let p = bougie.low; p <= bougie.high; p += step) {
        const palierPrix = Math.round(p / step) * step;
        const arrondi = Number(palierPrix.toFixed(5));
        const volExistant = bucketsMap.get(arrondi) || 0;
        bucketsMap.set(arrondi, volExistant + volParPalier);
      }
    }

    // 2️⃣ Deuxième passe : Vérification de la mitigation par les bougies ULTÉRIEURES
    // Un palier est mitigué si une bougie après idxFin traverse cette zone de prix
    const buckets: PalierVolume[] = [];
    let volumeMaxNonMitigue = 0;
    let nbNonMitigues = 0;

    for (const [prixPalier, vol] of bucketsMap.entries()) {
      const zLow = prixPalier;
      const zHigh = prixPalier + step;

      let estMitigue = false;
      for (let j = idxFin + 1; j < totalBars; j++) {
        if (bougies[j].high >= zLow && bougies[j].low <= zHigh) {
          estMitigue = true;
          break; // Le palier a été traversé/mitigué ultérieurement
        }
      }

      buckets.push({
        price: prixPalier,
        volume: vol,
        isMitigated: estMitigue,
      });

      if (!estMitigue) {
        nbNonMitigues++;
        if (vol > volumeMaxNonMitigue) {
          volumeMaxNonMitigue = vol;
        }

        // Enregistrement comme niveau ouvert pour la prolongation et les cibles
        niveauxOuverts.push({
          price: prixPalier + step / 2, // Prix central
          volume: vol,
          vagueId: vagueId + 1,
          estHaussiere: ptB.prix > ptA.prix,
          tempsDebut: ptA.temps,
          tempsFin: ptB.temps,
        });
      }
    }

    // Enregistrement de la vague
    vagueId++;
    vagues.push({
      id: vagueId,
      indexDebut: idxDebut,
      indexFin: idxFin,
      tempsDebut: ptA.temps,
      tempsFin: ptB.temps,
      prixDebut: ptA.prix,
      prixFin: ptB.prix,
      estHaussiere: ptB.prix > ptA.prix,
      paliers: buckets,
      volumeMaxNonMitigue,
      totalNiveauxNonMitigues: nbNonMitigues,
    });
  }

  return {
    pivots,
    vagues,
    niveauxOuverts,
    totalNiveauxOuverts: niveauxOuverts.length,
    step,
  };
}

// ─── 📊 Télémétrie de Trade (Capture Snapshot) ────────────────────────────────

/**
 * Capture un instantané des zones de volume non mitiguées par rapport au prix actuel
 * pour le rattacher à la position de trading.
 * 
 * Exemple :
 * const snapshot = capturerSnapshotUVP(resultatUVP, prixEntree);
 * console.log(snapshot.nbNiveauxAuDessus); // 2 cibles ouvertes
 */
export function capturerSnapshotUVP(
  resultat: ResultatUVP,
  prixActuel: number
): SnapshotUVP {
  const { niveauxOuverts, step } = resultat;

  let nbHaut = 0;
  let nbBas = 0;

  let plusProcheHaut: { price: number; distancePoints: number; volume: number } | null = null;
  let plusProcheBas: { price: number; distancePoints: number; volume: number } | null = null;

  let maxVolNiveau: NiveauOuvertUVP | null = null;
  let maxVol = 0;

  for (const niv of niveauxOuverts) {
    const dist = Math.abs(niv.price - prixActuel);
    const points = Number((dist / step).toFixed(1));

    if (niv.price > prixActuel) {
      nbHaut++;
      if (!plusProcheHaut || dist < (plusProcheHaut.distancePoints * step)) {
        plusProcheHaut = { price: niv.price, distancePoints: points, volume: niv.volume };
      }
    } else {
      nbBas++;
      if (!plusProcheBas || dist < (plusProcheBas.distancePoints * step)) {
        plusProcheBas = { price: niv.price, distancePoints: points, volume: niv.volume };
      }
    }

    if (niv.volume > maxVol) {
      maxVol = niv.volume;
      maxVolNiveau = niv;
    }
  }

  return {
    totalNiveauxOuverts: niveauxOuverts.length,
    nbNiveauxAuDessus: nbHaut,
    nbNiveauxEnDessous: nbBas,
    niveauPlusProcheHaut: plusProcheHaut,
    niveauPlusProcheBas: plusProcheBas,
    pocNonMitigueMajeur: maxVolNiveau ? {
      price: maxVolNiveau.price,
      volume: maxVolNiveau.volume,
      directionVague: maxVolNiveau.estHaussiere ? 'haussiere' : 'baissiere',
    } : null,
  };
}
