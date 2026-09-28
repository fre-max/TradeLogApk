import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualBox, VisualLine, VisualLabel } from '@/types/indicatorScript';

// ─── 📊 Types et Structures de Données ────────────────────────────────────────

/**
 * Détail d'une tranche horizontale dans le couloir de prix
 */
export interface TrancheCouloirC {
  index: number;
  prixHaut: number;
  prixBas: number;
  prixMedian: number;
  nbBougiesTraversees: number; // Nombre de bougies ayant traversé cette tranche (mesure de trafic)
  estForteDensite: boolean;    // Vrai si nbBougiesTraversees >= seuil
  estMitiguee: boolean;        // Vrai si revisitée après la sortie du trafic
  indexDerniereTraversee: number;
}

/**
 * Options de configuration de la Méthode C
 */
export interface OptionsMethodeCSlice {
  direction?: 'achat' | 'vente';     // Direction du trade (défaut: 'achat')
  prixTPManuel?: number;            // Cible TP (si 0, projection par défaut ou ATR)
  nbTranches?: number;              // Nombre de tranches horizontales (défaut: 12)
  minBougiesParTranche?: number;    // Seuil de bougies pour qu'une tranche soit validée dense (défaut: 3)
  maxLookbackBars?: number;         // Historique analysé (défaut: 300)
  uniquementNonMitigues?: boolean;  // N'afficher que les tranches non mitigées (défaut: false)
  prolongerNonMitigues?: boolean;   // Prolonger les tranches non mitigées vers la droite (défaut: true)
}

/**
 * Résultat complet de la Méthode C
 */
export interface ResultatMethodeCSlice {
  prixEntree: number;
  prixTP: number;
  totalTranches: number;
  tranchesFortes: number;
  tranchesNonMitigueesFortes: number;
  pourcentageDensite: number;       // Ex: 83%
  estCouloirDense: boolean;         // Vrai si pourcentage >= 75%
  tranches: TrancheCouloirC[];
  primitives: VisualPrimitives;
}

// ─── 🚀 Moteur Principal de Calcul ────────────────────────────────────────────

/**
 * MÉTHODE C : Densité de Traversées par Tranches avec Détection de Non-Mitigation
 * Découpe l'espace en N tranches horizontales et calcule le trafic de bougies par tranche.
 * Identifie les tranches à fort trafic qui sont encore NON-MITIGÉES (cibles de liquidité vierges).
 * 
 * Exemple :
 * const res = calculerMethodeCSlice(bougies, { nbTranches: 12, minBougiesParTranche: 3 });
 * console.log(`Tranches non mitigées à fort trafic : ${res.tranchesNonMitigueesFortes}`);
 */
export function calculerMethodeCSlice(
  bougies: Bougie[],
  options: OptionsMethodeCSlice = {}
): ResultatMethodeCSlice {
  const primitives: VisualPrimitives = { boites: [], lignes: [], labels: [] };

  if (!bougies || bougies.length < 15) {
    return {
      prixEntree: 0,
      prixTP: 0,
      totalTranches: 0,
      tranchesFortes: 0,
      tranchesNonMitigueesFortes: 0,
      pourcentageDensite: 0,
      estCouloirDense: false,
      tranches: [],
      primitives,
    };
  }

  const direction = options.direction || 'achat';
  const nbTranches = Math.max(5, options.nbTranches ?? 12);
  const minBougies = Math.max(2, options.minBougiesParTranche ?? 3);
  const maxLookback = Math.min(bougies.length, options.maxLookbackBars ?? 300);
  const uniquementNonMitigues = options.uniquementNonMitigues ?? false;
  const prolongerNonMitigues = options.prolongerNonMitigues ?? true;

  const derniere = bougies[bougies.length - 1];
  const prixEntree = derniere.close;

  // Calcul du TP si non fourni
  let prixTP = options.prixTPManuel || 0;
  if (prixTP <= 0) {
    const atrApprox = Math.abs(derniere.high - derniere.low) * 12;
    prixTP = direction === 'achat' ? prixEntree + atrApprox : prixEntree - atrApprox;
  }

  const prixBasCouloir = Math.min(prixEntree, prixTP);
  const prixHautCouloir = Math.max(prixEntree, prixTP);
  const hauteurCouloir = prixHautCouloir - prixBasCouloir;

  if (hauteurCouloir <= 0.00001) {
    return {
      prixEntree,
      prixTP,
      totalTranches: nbTranches,
      tranchesFortes: nbTranches,
      tranchesNonMitigueesFortes: 0,
      pourcentageDensite: 100,
      estCouloirDense: true,
      tranches: [],
      primitives,
    };
  }

  const pasTranche = hauteurCouloir / nbTranches;
  const tranches: TrancheCouloirC[] = [];
  const indexDebut = Math.max(0, bougies.length - maxLookback);
  let tranchesFortes = 0;
  let tranchesNonMitigueesFortes = 0;

  // 1️⃣ Analyse tranche par tranche
  for (let t = 0; t < nbTranches; t++) {
    const pBas = prixBasCouloir + t * pasTranche;
    const pHaut = pBas + pasTranche;
    const pMed = (pBas + pHaut) / 2;

    const indicesTraversees: number[] = [];
    for (let i = indexDebut; i < bougies.length; i++) {
      const b = bougies[i];
      // Si la bougie chevauche la tranche
      if (b.low <= pHaut && b.high >= pBas) {
        indicesTraversees.push(i);
      }
    }

    const nbTraversees = indicesTraversees.length;
    const estForte = nbTraversees >= minBougies;
    if (estForte) tranchesFortes++;

    const dernierIdx = indicesTraversees.length > 0
      ? indicesTraversees[indicesTraversees.length - 1]
      : -1;

    // 2️⃣ Vérification de la non-mitigation :
    // Une tranche est non-mitigée si le prix s'en est éloigné (au moins 2 bougies en arrière)
    // et qu'aucune bougie ultérieure n'y est revenue depuis cette sortie
    const estMitiguee = dernierIdx >= (bougies.length - 2) || dernierIdx === -1;
    if (estForte && !estMitiguee) {
      tranchesNonMitigueesFortes++;
    }

    tranches.push({
      index: t,
      prixHaut: pHaut,
      prixBas: pBas,
      prixMedian: pMed,
      nbBougiesTraversees: nbTraversees,
      estForteDensite: estForte,
      estMitiguee,
      indexDerniereTraversee: dernierIdx,
    });
  }

  const pourcentageDensite = Math.round((tranchesFortes / nbTranches) * 100);
  const estCouloirDense = pourcentageDensite >= 75;

  // 3️⃣ Génération des Primitives Graphiques
  const dateDebutCouloir = bougies[Math.max(0, bougies.length - 25)].time;
  const dateFinCouloir = derniere.time;

  // A. Boîte globale du couloir
  primitives.boites?.push({
    id: 'slice-corridor-box',
    prixHaut: prixHautCouloir,
    prixBas: prixBasCouloir,
    dateDebut: dateDebutCouloir,
    dateFin: dateFinCouloir,
    couleurFond: estCouloirDense ? 'rgba(16, 185, 129, 0.10)' : 'rgba(245, 158, 11, 0.10)',
    couleurBordure: estCouloirDense ? '#10b981' : '#f59e0b',
    label: `🛣️ Tranches : ${pourcentageDensite}% Denses (${tranchesNonMitigueesFortes} Non-Mitigées)`,
  });

  // B. Tracé des tranches horizontales avec statut non-mitigé
  for (const tr of tranches) {
    if (uniquementNonMitigues && tr.estMitiguee) continue;

    const estNonMitigueeForte = tr.estForteDensite && !tr.estMitiguee;

    // Les tranches non-mitigées à fort trafic se prolongent vers la droite
    const dateFinLigne = (prolongerNonMitigues && estNonMitigueeForte)
      ? derniere.time
      : dateFinCouloir;

    const couleurLigne = estNonMitigueeForte
      ? '#10b981' // Vert éclatant si Fort trafic et Non-Mitigé (Cible idéale)
      : tr.estForteDensite
        ? 'rgba(16, 185, 129, 0.45)' // Vert estompé si fort trafic mais déjà mitigé
        : 'rgba(239, 68, 68, 0.40)';   // Rouge/orange si faible trafic

    primitives.lignes?.push({
      id: `slice-line-${tr.index}`,
      prix: tr.prixMedian,
      dateDebut: dateDebutCouloir,
      dateFin: dateFinLigne,
      couleur: couleurLigne,
      epaisseur: estNonMitigueeForte ? 2 : 1,
      style: estNonMitigueeForte ? 'solid' : 'dotted',
      label: estNonMitigueeForte
        ? `🎯 T${tr.index + 1}: ${tr.nbBougiesTraversees}b NON-MITIGÉ`
        : `T${tr.index + 1}: ${tr.nbBougiesTraversees}b`,
    });
  }

  // C. Badge récapitulatif
  primitives.labels?.push({
    id: 'slice-status-badge',
    prix: direction === 'achat' ? prixHautCouloir : prixBasCouloir,
    date: dateFinCouloir,
    texte: tranchesNonMitigueesFortes > 0
      ? `🎯 ${tranchesNonMitigueesFortes} TRANCHES NON-MITIGÉES À FORT TRAFIC`
      : `🛣️ COULOIR DENSE ${pourcentageDensite}%`,
    couleur: tranchesNonMitigueesFortes > 0 ? '#10b981' : '#f59e0b',
    position: direction === 'achat' ? 'above' : 'below',
  });

  return {
    prixEntree,
    prixTP,
    totalTranches: nbTranches,
    tranchesFortes,
    tranchesNonMitigueesFortes,
    pourcentageDensite,
    estCouloirDense,
    tranches,
    primitives,
  };
}
