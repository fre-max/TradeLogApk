import type { Bougie } from '@/lib/chartDataHelper';

// ─── 📐 Types et Structures de données ZigZag ─────────────────────────────────

/**
 * Classification structurelle selon les principes SMC / Dow Theory
 * - HH : Higher High (Sommet plus haut que le précédent)
 * - LH : Lower High (Sommet plus bas que le précédent)
 * - HL : Higher Low (Creux plus haut que le précédent)
 * - LL : Lower Low (Creux plus bas que le précédent)
 */
export type LabelStructureSMC = 'HH' | 'HL' | 'LH' | 'LL' | 'PIVOT';

/**
 * Point de pivot confirmé ou actif du ZigZag
 */
export interface PivotZigZag {
  index: number;
  temps: number | string;
  prix: number;
  estHaut: boolean; // Vrai pour un sommet, faux pour un creux
  labelSMC: LabelStructureSMC;
}

/**
 * Jambe de marché (vague) reliant deux pivots consécutifs avec ses métriques
 */
export interface VagueZigZagMesuree {
  id: number;
  indexDebut: number;
  indexFin: number;
  tempsDebut: number | string;
  tempsFin: number | string;
  prixDebut: number;
  prixFin: number;
  estHaussiere: boolean;
  amplitudePoints: number;
  amplitudePips: number;
  nbBougies: number;
  vitessePointsParBougie: number;
}

/**
 * Options de configuration de l'indicateur ZigZag
 */
export interface OptionsZigZag {
  depth?: number;              // Nombre de bougies gauche/droite pour valider un pivot (défaut: 5)
  lookbackBars?: number;       // Nombre de bougies analysées dans le passé (défaut: 500)
  afficherLabelsSMC?: boolean; // Afficher les labels HH, HL, LH, LL (défaut: true)
  afficherMetriques?: boolean; // Afficher les métriques de vague (défaut: true)
}

/**
 * Résultat complet du calcul ZigZag
 */
export interface ResultatZigZag {
  pivots: PivotZigZag[];
  vagues: VagueZigZagMesuree[];
  tendanceStructurelle: 'BULLISH' | 'BEARISH' | 'NEUTRE';
  dernierSommet?: PivotZigZag;
  dernierCreux?: PivotZigZag;
  dernierPivot?: PivotZigZag;
}

/**
 * Snapshot technique prêt à être attaché à une position de trading
 */
export interface SnapshotZigZag {
  tendanceStructurelle: 'BULLISH' | 'BEARISH' | 'NEUTRE';
  dernierPivotType: LabelStructureSMC;
  prixDernierPivot: number;
  bougiesDepuisDernierPivot: number;
  distanceDernierSommetPips: number;
  distanceDernierCreuxPips: number;
  directionVagueCourante: 'haussiere' | 'baissiere';
  amplitudeVagueCourantePips: number;
}

// ─── ⚙️ Moteur Principal de Calcul ZigZag ──────────────────────────────────────

/**
 * Calcule l'indicateur ZigZag avec alternance stricte et labellisation de structure SMC.
 * 
 * Exemple :
 * const resultat = calculerZigZag(donneesBougies, { depth: 5 });
 * console.log(`Tendance actuelle : ${resultat.tendanceStructurelle}`);
 * console.log(`Dernier label : ${resultat.dernierPivot?.labelSMC}`);
 */
export function calculerZigZag(
  bougies: Bougie[],
  options: OptionsZigZag = {}
): ResultatZigZag {
  const {
    depth = 5,
    lookbackBars = 500,
  } = options;

  const totalBars = bougies.length;

  if (totalBars < depth * 2 + 2) {
    return {
      pivots: [],
      vagues: [],
      tendanceStructurelle: 'NEUTRE',
    };
  }

  const startBar = Math.max(depth, totalBars - lookbackBars);
  const endBar = totalBars - depth - 1;

  const pivotsBruts: { prix: number; temps: number | string; index: number; estHaut: boolean }[] = [];

  // 1️⃣ Détection des sommets et creux locaux
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

  if (pivotsBruts.length === 0) {
    return {
      pivots: [],
      vagues: [],
      tendanceStructurelle: 'NEUTRE',
    };
  }

  // 2️⃣ Filtrage pour alternance stricte : Sommet -> Creux -> Sommet
  const pivotsFiltres: { prix: number; temps: number | string; index: number; estHaut: boolean }[] = [pivotsBruts[0]];

  for (let i = 1; i < pivotsBruts.length; i++) {
    const dernier = pivotsFiltres[pivotsFiltres.length - 1];
    const courant = pivotsBruts[i];

    if (courant.estHaut === dernier.estHaut) {
      if (courant.estHaut && courant.prix > dernier.prix) {
        pivotsFiltres[pivotsFiltres.length - 1] = courant;
      } else if (!courant.estHaut && courant.prix < dernier.prix) {
        pivotsFiltres[pivotsFiltres.length - 1] = courant;
      }
    } else {
      pivotsFiltres.push(courant);
    }
  }

  // 2.5️⃣ Ancrage du premier pivot sur l'extrême initial pour ne pas tronquer le début
  if (pivotsFiltres.length > 0 && pivotsFiltres[0].index > 0) {
    const premier = pivotsFiltres[0];
    let initialIdx = 0;
    let initialPrix = premier.estHaut ? bougies[0].low : bougies[0].high;

    for (let k = 1; k < premier.index; k++) {
      if (premier.estHaut && bougies[k].low < initialPrix) {
        initialPrix = bougies[k].low;
        initialIdx = k;
      } else if (!premier.estHaut && bougies[k].high > initialPrix) {
        initialPrix = bougies[k].high;
        initialIdx = k;
      }
    }

    pivotsFiltres.unshift({
      index: initialIdx,
      temps: bougies[initialIdx].time,
      prix: initialPrix,
      estHaut: !premier.estHaut,
    });
  }

  // 3️⃣ Prolongation vers la bougie actuelle (vague active)
  if (pivotsFiltres.length >= 1) {
    let dernierIdx = pivotsFiltres[pivotsFiltres.length - 1].index;
    const dernierEstHaut = pivotsFiltres[pivotsFiltres.length - 1].estHaut;

    if (dernierEstHaut) {
      let plusHautIdx = dernierIdx;
      let plusHautPrix = pivotsFiltres[pivotsFiltres.length - 1].prix;
      for (let k = dernierIdx + 1; k < totalBars; k++) {
        if (bougies[k].high > plusHautPrix) {
          plusHautPrix = bougies[k].high;
          plusHautIdx = k;
        }
      }
      if (plusHautIdx !== dernierIdx) {
        pivotsFiltres[pivotsFiltres.length - 1].prix = plusHautPrix;
        pivotsFiltres[pivotsFiltres.length - 1].index = plusHautIdx;
        pivotsFiltres[pivotsFiltres.length - 1].temps = bougies[plusHautIdx].time;
        dernierIdx = plusHautIdx;
      }
    } else {
      let plusBasIdx = dernierIdx;
      let plusBasPrix = pivotsFiltres[pivotsFiltres.length - 1].prix;
      for (let k = dernierIdx + 1; k < totalBars; k++) {
        if (bougies[k].low < plusBasPrix) {
          plusBasPrix = bougies[k].low;
          plusBasIdx = k;
        }
      }
      if (plusBasIdx !== dernierIdx) {
        pivotsFiltres[pivotsFiltres.length - 1].prix = plusBasPrix;
        pivotsFiltres[pivotsFiltres.length - 1].index = plusBasIdx;
        pivotsFiltres[pivotsFiltres.length - 1].temps = bougies[plusBasIdx].time;
        dernierIdx = plusBasIdx;
      }
    }

    if (dernierIdx < totalBars - 1) {
      const currentBarIdx = totalBars - 1;
      const bougieFin = bougies[currentBarIdx];

      pivotsFiltres.push({
        index: currentBarIdx,
        temps: bougieFin.time,
        prix: dernierEstHaut ? bougieFin.low : bougieFin.high,
        estHaut: !dernierEstHaut,
      });
    }
  }

  // 4️⃣ Labellisation structurelle SMC (HH, HL, LH, LL)
  const pivotsLabellises: PivotZigZag[] = [];
  let precedentSommet: PivotZigZag | undefined;
  let precedentCreux: PivotZigZag | undefined;

  for (let i = 0; i < pivotsFiltres.length; i++) {
    const p = pivotsFiltres[i];
    let label: LabelStructureSMC = 'PIVOT';

    if (p.estHaut) {
      if (!precedentSommet) {
        label = 'PIVOT';
      } else if (p.prix >= precedentSommet.prix) {
        label = 'HH'; // Higher High
      } else {
        label = 'LH'; // Lower High
      }
    } else {
      if (!precedentCreux) {
        label = 'PIVOT';
      } else if (p.prix <= precedentCreux.prix) {
        label = 'LL'; // Lower Low
      } else {
        label = 'HL'; // Higher Low
      }
    }

    const nouveauPivot: PivotZigZag = {
      ...p,
      labelSMC: label,
    };

    if (p.estHaut) {
      precedentSommet = nouveauPivot;
    } else {
      precedentCreux = nouveauPivot;
    }

    pivotsLabellises.push(nouveauPivot);
  }

  // 5️⃣ Construction et mesure des vagues
  const vagues: VagueZigZagMesuree[] = [];

  // Évaluation d'un pip de référence pour le calcul d'amplitude
  const prixRef = bougies[bougies.length - 1].close;
  const pipDiviseur = prixRef < 2.0 ? 0.0001 : (prixRef < 500 ? 0.01 : 1.0);

  for (let i = 0; i < pivotsLabellises.length - 1; i++) {
    const a = pivotsLabellises[i];
    const b = pivotsLabellises[i + 1];

    const amplitudePoints = Math.abs(b.prix - a.prix);
    const amplitudePips = Number((amplitudePoints / pipDiviseur).toFixed(1));
    const nbBougies = Math.max(1, Math.abs(b.index - a.index));
    const vitesse = Number((amplitudePoints / nbBougies).toFixed(5));

    vagues.push({
      id: i + 1,
      indexDebut: a.index,
      indexFin: b.index,
      tempsDebut: a.temps,
      tempsFin: b.temps,
      prixDebut: a.prix,
      prixFin: b.prix,
      estHaussiere: b.prix > a.prix,
      amplitudePoints,
      amplitudePips,
      nbBougies,
      vitessePointsParBougie: vitesse,
    });
  }

  // 6️⃣ Détermination de la tendance structurelle globale
  let tendanceStructurelle: 'BULLISH' | 'BEARISH' | 'NEUTRE' = 'NEUTRE';

  if (precedentSommet && precedentCreux) {
    if (precedentSommet.labelSMC === 'HH' && precedentCreux.labelSMC === 'HL') {
      tendanceStructurelle = 'BULLISH';
    } else if (precedentSommet.labelSMC === 'LH' && precedentCreux.labelSMC === 'LL') {
      tendanceStructurelle = 'BEARISH';
    }
  }

  return {
    pivots: pivotsLabellises,
    vagues,
    tendanceStructurelle,
    dernierSommet: precedentSommet,
    dernierCreux: precedentCreux,
    dernierPivot: pivotsLabellises[pivotsLabellises.length - 1],
  };
}

// ─── 📊 Télémétrie de Trade (Snapshot) ────────────────────────────────────────

/**
 * Capture l'état de la structure de marché ZigZag pour le journal de trading
 * 
 * Exemple :
 * const snapshot = capturerSnapshotZigZag(resultatZigZag, bougieCourante.close, indexCourant);
 */
export function capturerSnapshotZigZag(
  resultat: ResultatZigZag,
  prixActuel: number,
  indexActuel: number
): SnapshotZigZag {
  const { pivots, vagues, tendanceStructurelle, dernierSommet, dernierCreux, dernierPivot } = resultat;

  const pipDiviseur = prixActuel < 2.0 ? 0.0001 : (prixActuel < 500 ? 0.01 : 1.0);

  const distanceHaut = dernierSommet ? Math.abs(dernierSommet.prix - prixActuel) / pipDiviseur : 0;
  const distanceBas = dernierCreux ? Math.abs(prixActuel - dernierCreux.prix) / pipDiviseur : 0;

  const derniereVague = vagues[vagues.length - 1];

  return {
    tendanceStructurelle,
    dernierPivotType: dernierPivot ? dernierPivot.labelSMC : 'PIVOT',
    prixDernierPivot: dernierPivot ? dernierPivot.prix : prixActuel,
    bougiesDepuisDernierPivot: dernierPivot ? Math.max(0, indexActuel - dernierPivot.index) : 0,
    distanceDernierSommetPips: Number(distanceHaut.toFixed(1)),
    distanceDernierCreuxPips: Number(distanceBas.toFixed(1)),
    directionVagueCourante: derniereVague ? (derniereVague.estHaussiere ? 'haussiere' : 'baissiere') : 'haussiere',
    amplitudeVagueCourantePips: derniereVague ? derniereVague.amplitudePips : 0,
  };
}
