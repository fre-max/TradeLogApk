import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualBox, VisualLine, VisualLabel } from '@/types/indicatorScript';

// ─── 📊 Types et Structures de Données ────────────────────────────────────────

/**
 * Représente un obstacle identifié dans le couloir de prix (ex: FVG non comblé)
 */
export interface ObstacleCouloir {
  prixHaut: number;
  prixBas: number;
  type: 'fvg' | 'order_block';
  estComble: boolean;
  tempsOrigine: number | string;
}

/**
 * Palier de prix découpant le couloir entre l'entrée et le TP
 */
export interface PalierCouloir {
  prix: number;
  nbTraversees: number;
  estMitigue: boolean;
}

/**
 * Options de configuration pour l'indicateur Couloir d'Over-Mitigation
 */
export interface OptionsOverMitigationHighway {
  direction?: 'achat' | 'vente';      // Direction du trade attendu (défaut: 'achat')
  prixTPManuel?: number;             // Niveau de Take Profit manuel (si non fourni, cherche la liquidité opposée)
  seuilAutoroutePourcent?: number;   // Seuil minimum pour valider l'autoroute (défaut: 80%)
  nbPaliersAnalyse?: number;         // Découpage vertical du couloir (défaut: 15)
  maxLookbackBars?: number;          // Historique analysé pour la mitigation (défaut: 300)
  resultatsPrecedents?: Array<{ script: any; resultat: any }>; // Pour récupérer automatiquement le BSL/Supply opposé
}

/**
 * Résultat complet retourné par l'indicateur
 */
export interface ResultatOverMitigationHighway {
  prixEntree: number;
  prixTP: number;
  scoreAutoroute: number;            // Pourcentage de 0 à 100%
  estAutorouteDegagee: boolean;      // Vrai si score >= seuil (ex: 80%)
  totalObstacles: number;
  obstacles: ObstacleCouloir[];
  paliers: PalierCouloir[];
  primitives: VisualPrimitives;
}

// ─── 🚀 Moteur Principal de Calcul ────────────────────────────────────────────

/**
 * Calcule le degré d'Over-Mitigation entre le prix actuel et le TP ciblé.
 * Si le couloir a déjà été entièrement échangé (mitigué) sans imbalance résiduelle,
 * le marché dispose d'une "autoroute dégagée" pour aller chercher la liquidité opposée en un coup.
 * 
 * Exemple :
 * const res = calculerOverMitigationHighway(bougies, { direction: 'achat' });
 * if (res.estAutorouteDegagee) {
 *   console.log(`🚀 Autoroute validée avec ${res.scoreAutoroute}% de mitigation !`);
 * }
 */
export function calculerOverMitigationHighway(
  bougies: Bougie[],
  options: OptionsOverMitigationHighway = {}
): ResultatOverMitigationHighway {
  const primitives: VisualPrimitives = { boites: [], lignes: [], labels: [] };

  if (!bougies || bougies.length < 15) {
    return {
      prixEntree: 0,
      prixTP: 0,
      scoreAutoroute: 0,
      estAutorouteDegagee: false,
      totalObstacles: 0,
      obstacles: [],
      paliers: [],
      primitives,
    };
  }

  // 1️⃣ Extraction des paramètres et du prix actuel
  const direction = options.direction || 'achat';
  const seuilAutoroute = options.seuilAutoroutePourcent ?? 80;
  const nbPaliers = Math.max(5, options.nbPaliersAnalyse ?? 15);
  const maxLookback = Math.min(bougies.length, options.maxLookbackBars ?? 300);

  const derniereBougie = bougies[bougies.length - 1];
  const prixEntree = derniereBougie.close;

  // 2️⃣ Détermination du Take Profit ciblé (TP)
  let prixTP = options.prixTPManuel || 0;

  // Si aucun TP manuel n'est renseigné, on cherche automatiquement la liquidité opposée (BSL ou Résistance Supply)
  if (prixTP <= 0) {
    prixTP = chercherLiquiditeOpposee(bougies, direction, options.resultatsPrecedents);
  }

  // Si aucun TP n'a pu être trouvé, on prend une projection par défaut basée sur l'ATR
  if (prixTP <= 0) {
    const atrSimule = Math.abs(derniereBougie.high - derniereBougie.low) * 10;
    prixTP = direction === 'achat' ? prixEntree + atrSimule : prixEntree - atrSimule;
  }

  // Bornes du couloir vertical
  const prixBasCouloir = Math.min(prixEntree, prixTP);
  const prixHautCouloir = Math.max(prixEntree, prixTP);
  const hauteurCouloir = prixHautCouloir - prixBasCouloir;

  if (hauteurCouloir <= 0.00001) {
    return {
      prixEntree,
      prixTP,
      scoreAutoroute: 100,
      estAutorouteDegagee: true,
      totalObstacles: 0,
      obstacles: [],
      paliers: [],
      primitives,
    };
  }

  // 3️⃣ Détection des Imbalances (Obstacles FVG dans le couloir)
  // Une imbalance non comblée située dans le couloir vers le TP risque de freiner ou rejeter le prix
  const obstacles: ObstacleCouloir[] = [];
  const indexDebut = Math.max(2, bougies.length - maxLookback);

  for (let i = indexDebut; i < bougies.length; i++) {
    const b0 = bougies[i - 2];
    const b1 = bougies[i - 1];
    const b2 = bougies[i];

    // Dans un setup acheteur, les obstacles sont les FVG baissiers (vendeurs)
    if (direction === 'achat') {
      if (b2.high < b0.low) {
        const hautFVG = b0.low;
        const basFVG = b2.high;

        // Vérifie si le FVG chevauche notre couloir [prixEntree, prixTP]
        if (hautFVG > prixBasCouloir && basFVG < prixHautCouloir) {
          // Vérifie si ce FVG a été comblé par les bougies postérieures
          let estComble = false;
          for (let k = i + 1; k < bougies.length; k++) {
            if (bougies[k].high >= hautFVG) {
              estComble = true;
              break;
            }
          }

          if (!estComble) {
            obstacles.push({
              prixHaut: hautFVG,
              prixBas: basFVG,
              type: 'fvg',
              estComble: false,
              tempsOrigine: b1.time,
            });
          }
        }
      }
    } else {
      // Dans un setup vendeur, les obstacles sont les FVG haussiers (acheteurs)
      if (b2.low > b0.high) {
        const hautFVG = b2.low;
        const basFVG = b0.high;

        if (hautFVG > prixBasCouloir && basFVG < prixHautCouloir) {
          let estComble = false;
          for (let k = i + 1; k < bougies.length; k++) {
            if (bougies[k].low <= basFVG) {
              estComble = true;
              break;
            }
          }

          if (!estComble) {
            obstacles.push({
              prixHaut: hautFVG,
              prixBas: basFVG,
              type: 'fvg',
              estComble: false,
              tempsOrigine: b1.time,
            });
          }
        }
      }
    }
  }

  // 4️⃣ Découpage en paliers et calcul de l'Over-Mitigation
  const pasPrix = hauteurCouloir / nbPaliers;
  const paliers: PalierCouloir[] = [];
  let paliersMitigues = 0;

  for (let p = 0; p < nbPaliers; p++) {
    const niveauPrix = prixBasCouloir + p * pasPrix + pasPrix / 2;
    let nbTraversees = 0;

    // Compte combien de fois les bougies récentes ont traversé ce palier de prix
    for (let i = indexDebut; i < bougies.length; i++) {
      const b = bougies[i];
      if (b.low <= niveauPrix && b.high >= niveauPrix) {
        nbTraversees++;
      }
    }

    // Vérifie si ce palier tombe dans un obstacle FVG non comblé
    const aObstacle = obstacles.some(obs => niveauPrix >= obs.prixBas && niveauPrix <= obs.prixHaut);

    // Un palier est considéré "Over-Mitigated" (sain et équilibré) s'il a été traversé au moins 3 fois
    // et qu'aucun FVG non comblé ne bloque ce niveau
    const estMitigue = nbTraversees >= 3 && !aObstacle;
    if (estMitigue) {
      paliersMitigues++;
    }

    paliers.push({
      prix: niveauPrix,
      nbTraversees,
      estMitigue,
    });
  }

  // Calcul du score d'autoroute en pourcentage (0 à 100%)
  const scoreAutoroute = Math.round((paliersMitigues / nbPaliers) * 100);
  const estAutorouteDegagee = scoreAutoroute >= seuilAutoroute && obstacles.length === 0;

  // 5️⃣ Génération des Primitives Graphiques pour le Canvas
  const dateDebutCouloir = bougies[Math.max(0, bougies.length - 20)].time;
  const dateFinCouloir = derniereBougie.time;

  // A. Boîte représentant le couloir d'autoroute vers le TP
  const couleurFond = estAutorouteDegagee
    ? 'rgba(16, 185, 129, 0.12)' // Vert translucide si autoroute dégagée
    : 'rgba(239, 68, 68, 0.12)';  // Rouge/ambre translucide si obstacles

  const couleurBordure = estAutorouteDegagee ? '#10b981' : '#f59e0b';

  primitives.boites?.push({
    id: 'highway-corridor',
    prixHaut: prixHautCouloir,
    prixBas: prixBasCouloir,
    dateDebut: dateDebutCouloir,
    dateFin: dateFinCouloir,
    couleurFond,
    couleurBordure,
    label: estAutorouteDegagee
      ? `🚀 AUTOROUTE DÉGAGÉE (${scoreAutoroute}%)`
      : `⚠️ OBSTACLES (${scoreAutoroute}% Over-Mitigated)`,
  });

  // B. Ligne horizontale matérialisant la cible TP
  primitives.lignes?.push({
    id: 'highway-tp-target',
    prix: prixTP,
    dateDebut: dateDebutCouloir,
    dateFin: dateFinCouloir,
    couleur: '#38bdf8', // Bleu ciel lumineux
    epaisseur: 2,
    style: 'dashed',
    label: `🎯 Cible TP (Liquidité) : ${prixTP.toFixed(5)}`,
  });

  // C. Matérialisation des obstacles FVG résiduels dans le couloir
  for (let idx = 0; idx < obstacles.length; idx++) {
    const obs = obstacles[idx];
    primitives.boites?.push({
      id: `highway-obstacle-${idx}`,
      prixHaut: obs.prixHaut,
      prixBas: obs.prixBas,
      dateDebut: obs.tempsOrigine,
      dateFin: dateFinCouloir,
      couleurFond: 'rgba(239, 68, 68, 0.35)',
      couleurBordure: '#ef4444',
      label: '⛔ Obstacle FVG',
    });
  }

  // D. Badge textuel de décision
  primitives.labels?.push({
    id: 'highway-status-badge',
    prix: direction === 'achat' ? prixHautCouloir : prixBasCouloir,
    date: dateFinCouloir,
    texte: estAutorouteDegagee
      ? `🚀 AUTOROUTE ${scoreAutoroute}% [Voie Libre]`
      : `⚠️ BLOQUÉ ${scoreAutoroute}% [${obstacles.length} Obstacle(s)]`,
    couleur: estAutorouteDegagee ? '#10b981' : '#f59e0b',
    position: direction === 'achat' ? 'above' : 'below',
  });

  return {
    prixEntree,
    prixTP,
    scoreAutoroute,
    estAutorouteDegagee,
    totalObstacles: obstacles.length,
    obstacles,
    paliers,
    primitives,
  };
}

/**
 * Recherche la liquidité opposée la plus proche (BSL pour un achat, SSL pour une vente)
 * parmi les indicateurs précédents ou par détection directe de sommets/creux récents.
 */
function chercherLiquiditeOpposee(
  bougies: Bougie[],
  direction: 'achat' | 'vente',
  resultatsPrecedents?: Array<{ script: any; resultat: any }>
): number {
  const dernierPrix = bougies[bougies.length - 1].close;

  // 1. Recherche dans les résultats des indicateurs précédents (Shved, S/R, EQH/EQL, BSL/SSL)
  if (resultatsPrecedents && resultatsPrecedents.length > 0) {
    for (const item of resultatsPrecedents) {
      const donnees = item.resultat?.donnees;
      if (!donnees) continue;

      if (direction === 'achat') {
        // Pour un achat, la cible est une résistance / Supply / BSL au-dessus du prix
        const resistances = donnees.resistances || [];
        for (const r of resistances) {
          const prixRes = r.prixMedian || r.prixHaut || r.prix;
          if (prixRes > dernierPrix) {
            return prixRes;
          }
        }
        const niveaux = donnees.niveaux || [];
        for (const n of niveaux) {
          if (n.type === 'BSL' && n.prix > dernierPrix) {
            return n.prix;
          }
        }
      } else {
        // Pour une vente, la cible est un support / Demand / SSL en-dessous du prix
        const supports = donnees.supports || [];
        for (const s of supports) {
          const prixSup = s.prixMedian || s.prixBas || s.prix;
          if (prixSup < dernierPrix) {
            return prixSup;
          }
        }
        const niveaux = donnees.niveaux || [];
        for (const n of niveaux) {
          if (n.type === 'SSL' && n.prix < dernierPrix) {
            return n.prix;
          }
        }
      }
    }
  }

  // 2. Fallback direct : recherche du plus haut ou plus bas récent sur les 60 dernières bougies
  const fenetre = bougies.slice(-60);
  if (direction === 'achat') {
    let maxHaut = -Infinity;
    for (const b of fenetre) {
      if (b.high > maxHaut) maxHaut = b.high;
    }
    return maxHaut > dernierPrix ? maxHaut : dernierPrix * 1.005;
  } else {
    let minBas = Infinity;
    for (const b of fenetre) {
      if (b.low < minBas) minBas = b.low;
    }
    return minBas < dernierPrix ? minBas : dernierPrix * 0.995;
  }
}
