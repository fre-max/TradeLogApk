import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualBox, VisualLabel } from '@/types/indicatorScript';

// ─── 📊 Types et Structures de Données ────────────────────────────────────────

/**
 * Chaîne de bougies successives qui partagent une même zone de prix
 */
export interface ChaineChevauchementB {
  id: string;
  indexDebut: number;
  indexFin: number;
  tempsDebut: number | string;
  tempsFin: number | string;
  prixHautIntersection: number; // Borne haute de la zone partagée par toutes les bougies
  prixBasIntersection: number;  // Borne basse de la zone partagée
  nombreBougies: number;        // Ex: 4 bougies consécutives
  pourcentageMoyen: number;     // Ex: 74% de surface commune
  estMitiguee: boolean;         // Vrai si le cours futur est revenu traverser cette surface
  indexMitigation?: number;     // Index de la bougie qui a mitigé la zone
  tempsMitigation?: number | string; // Date/heure de la mitigation
}

/**
 * Options de configuration de la Méthode B
 */
export interface OptionsMethodeBOverlap {
  minBougiesChaine?: number;     // Nombre minimum de bougies qui doivent se chevaucher (défaut: 3)
  seuilOverlapPourcent?: number; // Pourcentage minimal de surface partagée entre deux bougies (défaut: 55%)
  maxLookbackBars?: number;      // Historique analysé (défaut: 300)
  uniquementNonMitigues?: boolean; // N'afficher que les zones non mitigées (défaut: false)
  prolongerNonMitigues?: boolean;  // Prolonger les zones non mitigées vers la droite (défaut: true)
}

/**
 * Résultat complet de la Méthode B
 */
export interface ResultatMethodeBOverlap {
  chaines: ChaineChevauchementB[];
  chainesNonMitiguees: ChaineChevauchementB[];
  chaineActiveEnCours: boolean;
  totalChainesDetectees: number;
  totalNonMitiguees: number;
  primitives: VisualPrimitives;
}

// ─── 🚀 Moteur Principal de Calcul ────────────────────────────────────────────

/**
 * MÉTHODE B : Surface Commune Bougie à Bougie avec Détection de Non-Mitigation
 * Calcule l'intersection exacte du range de prix entre chaque bougie et la précédente.
 * Détecte les clusters où 3, 4, 5 bougies consécutives partagent une même zone de prix,
 * puis vérifie si cette surface commune est toujours NON-MITIGÉE par la suite.
 * 
 * Exemple :
 * const res = calculerMethodeBOverlap(bougies, { minBougiesChaine: 3, seuilOverlapPourcent: 55 });
 * console.log(`Surfaces non mitigées : ${res.totalNonMitiguees}`);
 */
export function calculerMethodeBOverlap(
  bougies: Bougie[],
  options: OptionsMethodeBOverlap = {}
): ResultatMethodeBOverlap {
  const primitives: VisualPrimitives = { boites: [], lignes: [], labels: [] };

  const minBougies = Math.max(2, options.minBougiesChaine ?? 3);
  const seuilOverlap = options.seuilOverlapPourcent ?? 55;
  const maxLookback = Math.min(bougies.length, options.maxLookbackBars ?? 300);
  const uniquementNonMitigues = options.uniquementNonMitigues ?? false;
  const prolongerNonMitigues = options.prolongerNonMitigues ?? true;

  if (!bougies || bougies.length < minBougies) {
    return {
      chaines: [],
      chainesNonMitiguees: [],
      chaineActiveEnCours: false,
      totalChainesDetectees: 0,
      totalNonMitiguees: 0,
      primitives,
    };
  }

  const derniereBougie = bougies[bougies.length - 1];
  const chainesBrutes: Array<{
    id: string;
    indexDebut: number;
    indexFin: number;
    tempsDebut: number | string;
    tempsFin: number | string;
    prixHautIntersection: number;
    prixBasIntersection: number;
    nombreBougies: number;
    pourcentageMoyen: number;
  }> = [];

  const indexDebut = Math.max(1, bougies.length - maxLookback);

  let debutChaine = -1;
  let hautCommun = Infinity;
  let basCommun = -Infinity;
  let totalPct = 0;
  let nbPaires = 0;

  // 1️⃣ Balayage chronologique bougie à bougie
  for (let i = indexDebut; i < bougies.length; i++) {
    const prev = bougies[i - 1];
    const curr = bougies[i];

    // Calcul de l'intersection entre la bougie précédente et la courante
    const hautIntersection = Math.min(prev.high, curr.high);
    const basIntersection = Math.max(prev.low, curr.low);

    let pctOverlap = 0;
    if (hautIntersection > basIntersection) {
      const surfaceCommune = hautIntersection - basIntersection;
      const minHauteur = Math.min(prev.high - prev.low, curr.high - curr.low);
      pctOverlap = minHauteur > 0 ? (surfaceCommune / minHauteur) * 100 : 0;
    }

    // 2️⃣ Si les deux bougies se chevauchent au-delà du seuil requis
    if (pctOverlap >= seuilOverlap) {
      if (debutChaine === -1) {
        debutChaine = i - 1;
        hautCommun = hautIntersection;
        basCommun = basIntersection;
        totalPct = pctOverlap;
        nbPaires = 1;
      } else {
        // Resserrement de l'intersection globale partagée par TOUTES les bougies de la chaîne
        const nouveauHaut = Math.min(hautCommun, curr.high);
        const nouveauBas = Math.max(basCommun, curr.low);

        // Si la nouvelle bougie continue de partager la zone commune
        if (nouveauHaut > nouveauBas) {
          hautCommun = nouveauHaut;
          basCommun = nouveauBas;
          totalPct += pctOverlap;
          nbPaires++;
        } else {
          // La chaîne s'arrête ici : on enregistre si le nombre de bougies est suffisant
          const longueur = (i - 1) - debutChaine + 1;
          if (longueur >= minBougies) {
            chainesBrutes.push({
              id: `overlap-b-${debutChaine}`,
              indexDebut: debutChaine,
              indexFin: i - 1,
              tempsDebut: bougies[debutChaine].time,
              tempsFin: bougies[i - 1].time,
              prixHautIntersection: hautCommun,
              prixBasIntersection: basCommun,
              nombreBougies: longueur,
              pourcentageMoyen: Math.round(totalPct / nbPaires),
            });
          }
          // Réinitialisation
          debutChaine = -1;
        }
      }
    } else {
      // Pas de chevauchement suffisant : on clôture la chaîne éventuelle
      if (debutChaine !== -1) {
        const longueur = (i - 1) - debutChaine + 1;
        if (longueur >= minBougies) {
          chainesBrutes.push({
            id: `overlap-b-${debutChaine}`,
            indexDebut: debutChaine,
            indexFin: i - 1,
            tempsDebut: bougies[debutChaine].time,
            tempsFin: bougies[i - 1].time,
            prixHautIntersection: hautCommun,
            prixBasIntersection: basCommun,
            nombreBougies: longueur,
            pourcentageMoyen: Math.round(totalPct / nbPaires),
          });
        }
        debutChaine = -1;
      }
    }
  }

  // Clôture d'une chaîne active sur la dernière bougie
  let chaineActiveEnCours = false;
  if (debutChaine !== -1) {
    const longueur = (bougies.length - 1) - debutChaine + 1;
    if (longueur >= minBougies) {
      chainesBrutes.push({
        id: `overlap-b-${debutChaine}`,
        indexDebut: debutChaine,
        indexFin: bougies.length - 1,
        tempsDebut: bougies[debutChaine].time,
        tempsFin: bougies[bougies.length - 1].time,
        prixHautIntersection: hautCommun,
        prixBasIntersection: basCommun,
        nombreBougies: longueur,
        pourcentageMoyen: Math.round(totalPct / Math.max(1, nbPaires)),
      });
      chaineActiveEnCours = true;
    }
  }

  // 3️⃣ Vérification de la mitigation pour chaque chaîne
  const chaines: ChaineChevauchementB[] = [];

  for (const c of chainesBrutes) {
    let estMitiguee = false;
    let indexMitigation: number | undefined;
    let tempsMitigation: number | string | undefined;

    // On scrute les bougies postérieures à la fin de la chaîne
    for (let j = c.indexFin + 1; j < bougies.length; j++) {
      const bj = bougies[j];
      if (bj.high >= c.prixBasIntersection && bj.low <= c.prixHautIntersection) {
        estMitiguee = true;
        indexMitigation = j;
        tempsMitigation = bj.time;
        break;
      }
    }

    chaines.push({
      ...c,
      estMitiguee,
      indexMitigation,
      tempsMitigation,
    });
  }

  const chainesNonMitiguees = chaines.filter(c => !c.estMitiguee);

  // 4️⃣ Rendu graphique des boîtes de surface partagée
  for (const c of chaines) {
    if (uniquementNonMitigues && c.estMitiguee) continue;

    if (!c.estMitiguee) {
      // 🌟 SURFACE COMMUNE NON-MITIGÉE : Prolongée vers la droite comme couloir de liquidité vierge
      const dateFin = prolongerNonMitigues ? derniereBougie.time : c.tempsFin;
      const couleurFond = c.nombreBougies >= 4
        ? 'rgba(168, 85, 247, 0.28)' // Violet soutenu si 4+ bougies
        : 'rgba(192, 132, 252, 0.18)';

      const couleurBordure = c.nombreBougies >= 4 ? '#9333ea' : '#a855f7';

      primitives.boites?.push({
        id: `box-${c.id}`,
        prixHaut: c.prixHautIntersection,
        prixBas: c.prixBasIntersection,
        dateDebut: c.tempsDebut,
        dateFin,
        couleurFond,
        couleurBordure,
        label: `🔗 ${c.nombreBougies} Bougies (${c.pourcentageMoyen}%) [NON-MITIGÉ 🎯]`,
      });

      // Badge au début de la formation
      primitives.labels?.push({
        id: `lbl-${c.id}`,
        prix: c.prixHautIntersection,
        date: c.tempsFin,
        texte: `🔗 ${c.nombreBougies}b [${c.pourcentageMoyen}%] NON-MITIGÉ`,
        couleur: '#c084fc',
        position: 'above',
      });
    } else {
      // ⚪ SURFACE DÉJÀ MITIGÉE : S'arrête à la bougie de mitigation
      const dateFin = c.tempsMitigation || c.tempsFin;

      primitives.boites?.push({
        id: `box-${c.id}`,
        prixHaut: c.prixHautIntersection,
        prixBas: c.prixBasIntersection,
        dateDebut: c.tempsDebut,
        dateFin,
        couleurFond: 'rgba(148, 163, 184, 0.08)',
        couleurBordure: 'rgba(148, 163, 184, 0.35)',
        label: `🔗 ${c.nombreBougies}b (Mitigé)`,
      });
    }
  }

  return {
    chaines,
    chainesNonMitiguees,
    chaineActiveEnCours,
    totalChainesDetectees: chaines.length,
    totalNonMitiguees: chainesNonMitiguees.length,
    primitives,
  };
}
