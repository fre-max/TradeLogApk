import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualBox, VisualLabel, VisualPoint } from '@/types/indicatorScript';

// ─── 📊 Types et Structures de Données ────────────────────────────────────────

/**
 * Bloc de "Bougie Mère" non-mitigée avec sa suite directe de bougies qui la chevauchent
 */
export interface BougieMereOverlapA {
  id: string;
  indexDebut: number;
  indexFin: number;
  tempsDebut: number | string;
  tempsFin: number | string;
  prixHaut: number;              // Borne haute consommée par la bougie mère et sa suite
  prixBas: number;               // Borne basse consommée
  hauteurPlage: number;          // Amplitude de la tranche de prix consommée
  nombreBougiesDirectes: number; // Nombre de bougies consécutives directes qui se chevauchent
  pourcentageMoyenOverlap: number; // Pourcentage moyen de surface partagée entre bougies directes
  estMitiguee: boolean;          // Vrai si le prix futur après la sortie est revenu dans la tranche
  indexMitigation?: number;      // Index de la bougie qui a mitigé la zone
  tempsMitigation?: number | string;
}

/**
 * Options de configuration de la Méthode A (Bougie Mère Non-Mitigée)
 */
export interface OptionsMethodeACompression {
  lookbackBars?: number;           // Nombre de bougies analysées depuis la bougie courante (défaut: 500)
  seuilOverlapPourcent?: number;   // Seuil minimal pour considérer que 2 bougies se chevauchent (défaut: 50%)
  minBougiesDirectes?: number;     // Seuil de bougies consécutives pour valider un fort trafic (défaut: 3)
  uniquementNonMitigues?: boolean; // N'afficher que les bougies mères non mitigées (défaut: false)
  prolongerNonMitigues?: boolean;  // Prolonger les bougies mères non mitigées vers la droite (défaut: true)
  afficherPoints?: boolean;        // Afficher un point net sur les bougies mères (défaut: true)
  afficherBoites?: boolean;        // Afficher les boîtes rectangulaires (défaut: false pour ne pas surcharger)
  afficherTexte?: boolean;         // Afficher les étiquettes de texte (défaut: false pour ne pas surcharger)
  // Rétrocompatibilité avec les anciens paramètres
  fenetreBougies?: number;
  seuilRatioCompression?: number;
  maxLookbackBars?: number;
}

/**
 * Résultat complet retourné par l'indicateur
 */
export interface ResultatMethodeACompression {
  bougiesMeres: BougieMereOverlapA[];
  bougiesMeresNonMitiguees: BougieMereOverlapA[];
  totalDetectees: number;
  totalNonMitiguees: number;
  // Rétrocompatibilité pour les anciens appels
  zones: BougieMereOverlapA[];
  zonesNonMitiguees: BougieMereOverlapA[];
  zoneActuelleForte: boolean;
  dernierRatio: number;
  totalZonesDetectees: number;
  primitives: VisualPrimitives;
}

// ─── 🚀 Moteur Principal de Calcul ────────────────────────────────────────────

/**
 * NOUVELLE VERSION MÉTHODE A : Bougie Mère Non-Mitigée & Chevauchement Direct
 * 
 * Logique :
 * 1. Prend une bougie de référence (bougie mère).
 * 2. Compte UNIQUEMENT les bougies qui la suivent DIRECTEMENT et la chevauchent consécutivement.
 *    Dès qu'il y a un saut (impulsion / imbalance / plus de chevauchement), la chaîne s'arrête net.
 * 3. Vérifie si cette tranche de prix est NON-MITIGÉE (aucun retour ultérieur du prix futur).
 * 4. La hauteur de cette bougie mère est retirée de la plage globale et on passe à la suite.
 * 
 * Exemple :
 * const res = calculerMethodeACompression(bougies, { lookbackBars: 500, minBougiesDirectes: 3 });
 * console.log(`Bougies mères non mitigées : ${res.totalNonMitiguees}`);
 */
export function calculerMethodeACompression(
  bougies: Bougie[],
  options: OptionsMethodeACompression = {}
): ResultatMethodeACompression {
  const primitives: VisualPrimitives = { boites: [], lignes: [], labels: [], points: [] };

  const lookback = Math.min(bougies.length, options.lookbackBars ?? options.maxLookbackBars ?? 500);
  const seuilOverlap = options.seuilOverlapPourcent ?? 50;
  const minBougies = Math.max(2, options.minBougiesDirectes ?? 3);
  const uniquementNonMitigues = options.uniquementNonMitigues ?? false;
  const prolongerNonMitigues = options.prolongerNonMitigues ?? true;

  // 🎯 Affichage épuré : Par défaut UNIQUEMENT des points sur les bougies mères (plus de carrés ni de texte)
  const afficherPoints = options.afficherPoints !== false;
  const afficherBoites = Boolean(options.afficherBoites);
  const afficherTexte = Boolean(options.afficherTexte);

  if (!bougies || bougies.length < 3) {
    return {
      bougiesMeres: [],
      bougiesMeresNonMitiguees: [],
      totalDetectees: 0,
      totalNonMitiguees: 0,
      zones: [],
      zonesNonMitiguees: [],
      zoneActuelleForte: false,
      dernierRatio: 1.0,
      totalZonesDetectees: 0,
      primitives,
    };
  }

  const derniereBougie = bougies[bougies.length - 1];
  const indexDebutAnalyse = Math.max(0, bougies.length - lookback);
  const bougiesMeres: BougieMereOverlapA[] = [];

  let i = indexDebutAnalyse;

  // 1️⃣ Parcours séquentiel des bougies pour identifier les bougies mères et leurs suites directes
  while (i < bougies.length - 1) {
    const bougieMere = bougies[i];
    let minBas = bougieMere.low;
    let maxHaut = bougieMere.high;

    let chaineLongueur = 1; // La bougie mère compte comme 1
    let totalPourcentage = 100;
    let nbPaires = 1;

    let k = i + 1;

    // 2️⃣ Analyse des bougies qui SUIVENT DIRECTEMENT la bougie mère
    while (k < bougies.length) {
      const bougieSuivante = bougies[k];
      const prev = bougies[k - 1];

      // Calcul de l'intersection de prix entre la bougie courante et la précédente
      const hautIntersection = Math.min(prev.high, bougieSuivante.high);
      const basIntersection = Math.max(prev.low, bougieSuivante.low);

      let pctOverlap = 0;
      if (hautIntersection > basIntersection) {
        const surfacePartagee = hautIntersection - basIntersection;
        const plusPetiteHauteur = Math.min(prev.high - prev.low, bougieSuivante.high - bougieSuivante.low);
        pctOverlap = plusPetiteHauteur > 0 ? (surfacePartagee / plusPetiteHauteur) * 100 : 0;
      }

      // Condition de chevauchement direct :
      // La bougie suivante doit toucher la bougie précédente avec au moins le seuil requis
      if (pctOverlap >= seuilOverlap) {
        chaineLongueur++;
        totalPourcentage += pctOverlap;
        nbPaires++;

        // Élargissement de la plage de prix consommée par ce cluster
        if (bougieSuivante.low < minBas) minBas = bougieSuivante.low;
        if (bougieSuivante.high > maxHaut) maxHaut = bougieSuivante.high;

        k++;
      } else {
        // ⚡ SAUT DÉTECTÉ (Imbalance / Impulsion qui quitte la zone)
        // La règle stricte de l'utilisateur : on ne cherche pas de bougies plus loin, la chaîne s'arrête ici !
        break;
      }
    }

    const indexFinCluster = k - 1;
    const pctMoyen = Math.round(totalPourcentage / nbPaires);

    // 3️⃣ Vérification de la Non-Mitigation par les bougies ULTÉRIEURES (après la sortie / le saut)
    let estMitiguee = false;
    let indexMitigation: number | undefined;
    let tempsMitigation: number | string | undefined;

    for (let j = indexFinCluster + 1; j < bougies.length; j++) {
      const bj = bougies[j];
      // Si une bougie ultérieure repasse dans la tranche de prix consommée
      if (bj.high >= minBas && bj.low <= maxHaut) {
        estMitiguee = true;
        indexMitigation = j;
        tempsMitigation = bj.time;
        break; // La tranche a été revisitée ultérieurement
      }
    }

    // On enregistre ce bloc si c'est au moins une bougie ou un cluster avec chevauchement
    const hauteur = Math.max(0.00001, maxHaut - minBas);

    bougiesMeres.push({
      id: `bm-${i}`,
      indexDebut: i,
      indexFin: indexFinCluster,
      tempsDebut: bougieMere.time,
      tempsFin: bougies[indexFinCluster].time,
      prixHaut: maxHaut,
      prixBas: minBas,
      hauteurPlage: hauteur,
      nombreBougiesDirectes: chaineLongueur,
      pourcentageMoyenOverlap: pctMoyen,
      estMitiguee,
      indexMitigation,
      tempsMitigation,
    });

    // 4️⃣ On avance l'index à la fin du cluster pour que la tranche suivante prenne le relais
    // (Consommation de la plage de prix et passage à la bougie suivante)
    i = indexFinCluster + 1;
  }

  const nonMitiguees = bougiesMeres.filter(b => !b.estMitiguee);
  const derniere = bougiesMeres[bougiesMeres.length - 1];
  const zoneActuelleForte = derniere ? derniere.nombreBougiesDirectes >= minBougies : false;

  // 5️⃣ Génération des Primitives Visuelles sur le Graphique
  // 🎯 Configuration épurée : Points nets sur les bougies mères sans rectangles ni textes envahissants
  for (const bm of bougiesMeres) {
    if (uniquementNonMitigues && bm.estMitiguee) continue;

    const bougieMere = bougies[bm.indexDebut];
    if (!bougieMere) continue;

    const estHaussiere = bougieMere.close >= bougieMere.open;
    const estFortTrafic = bm.nombreBougiesDirectes >= minBougies;

    // 🔴 1. Point direct sur la bougie mère
    if (afficherPoints) {
      if (!bm.estMitiguee) {
        // Bougie mère NON-MITIGÉE : Point net et lumineux (Vert si haussière, Rouge/Rose si baissière)
        const prixPoint = estHaussiere ? bougieMere.low : bougieMere.high;
        const couleurPoint = estHaussiere
          ? (estFortTrafic ? '#10b981' : '#34d399')
          : (estFortTrafic ? '#f43f5e' : '#fb7185');

        primitives.points?.push({
          id: `pt-${bm.id}`,
          prix: prixPoint,
          date: bougieMere.time,
          couleur: couleurPoint,
          rayon: estFortTrafic ? 5 : 4,
          style: 'plein',
        });
      } else if (!uniquementNonMitigues) {
        // Bougie mère DÉJÀ MITIGÉE : Petit point gris discret
        const prixPoint = estHaussiere ? bougieMere.low : bougieMere.high;
        primitives.points?.push({
          id: `pt-${bm.id}`,
          prix: prixPoint,
          date: bougieMere.time,
          couleur: 'rgba(148, 163, 184, 0.45)',
          rayon: 2.5,
          style: 'plein',
        });
      }
    }

    // 2. Boîtes rectangulaires (Désactivées par défaut pour ne pas surcharger l'écran)
    if (afficherBoites) {
      if (!bm.estMitiguee) {
        const dateFin = prolongerNonMitigues ? derniereBougie.time : bm.tempsFin;
        const couleurFond = estFortTrafic ? 'rgba(14, 165, 233, 0.26)' : 'rgba(56, 189, 248, 0.12)';
        const couleurBordure = estFortTrafic ? '#0284c7' : '#38bdf8';

        primitives.boites?.push({
          id: `box-${bm.id}`,
          prixHaut: bm.prixHaut,
          prixBas: bm.prixBas,
          dateDebut: bm.tempsDebut,
          dateFin,
          couleurFond,
          couleurBordure,
          label: afficherTexte
            ? (estFortTrafic
                ? `🎯 Bougie Mère : ${bm.nombreBougiesDirectes}b directes (${bm.pourcentageMoyenOverlap}%) [NON-MITIGÉ]`
                : `📦 Bougie Mère : ${bm.nombreBougiesDirectes}b [NON-MITIGÉ]`)
            : undefined,
        });
      } else {
        const dateFin = bm.tempsMitigation || bm.tempsFin;
        primitives.boites?.push({
          id: `box-${bm.id}`,
          prixHaut: bm.prixHaut,
          prixBas: bm.prixBas,
          dateDebut: bm.tempsDebut,
          dateFin,
          couleurFond: 'rgba(100, 116, 139, 0.07)',
          couleurBordure: 'rgba(100, 116, 139, 0.30)',
          label: afficherTexte ? `📦 Bougie Mère : ${bm.nombreBougiesDirectes}b (Mitigé)` : undefined,
        });
      }
    }

    // 3. Étiquettes de texte (Désactivées par défaut pour ne pas surcharger l'écran)
    if (afficherTexte && !bm.estMitiguee) {
      primitives.labels?.push({
        id: `lbl-${bm.id}`,
        prix: bm.prixHaut,
        date: bm.tempsFin,
        texte: estFortTrafic
          ? `🔥 ${bm.nombreBougiesDirectes}b directes [${bm.pourcentageMoyenOverlap}%]`
          : `📦 ${bm.nombreBougiesDirectes}b`,
        couleur: estFortTrafic ? '#38bdf8' : '#94a3b8',
        position: 'above',
      });
    }
  }

  return {
    bougiesMeres,
    bougiesMeresNonMitiguees: nonMitiguees,
    totalDetectees: bougiesMeres.length,
    totalNonMitiguees: nonMitiguees.length,
    // Rétrocompatibilité
    zones: bougiesMeres,
    zonesNonMitiguees: nonMitiguees,
    zoneActuelleForte,
    dernierRatio: derniere ? derniere.nombreBougiesDirectes : 1.0,
    totalZonesDetectees: bougiesMeres.length,
    primitives,
  };
}
