import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLine, VisualLabel, VisualBox } from '@/types/indicatorScript';

// ─── 📊 Types et Structures de données ────────────────────────────────────────

/**
 * Mode de détection sélectionné par l'utilisateur
 */
export type ModeDetectionLiquidite = 'tous' | 'sr_seulement' | 'trendline_seulement';

/**
 * Représente un niveau de Support ou Résistance horizontal identifié
 * où la liquidité institutionnelle s'est accumulée suite à plusieurs rejets.
 */
export interface NiveauSupportResistance {
  id: string;
  type: 'SUPPORT' | 'RESISTANCE'; // Support = SSL (Sell-Side Liquidity), Résistance = BSL (Buy-Side Liquidity)
  prix: number;                   // Prix moyen de la zone
  nbTouches: number;              // Nombre de sommets ou creux ayant testé ce niveau (au moins 2)
  pivotsIndices: number[];        // Indices des bougies de contact
  dateDebut: number | string;     // Date du premier contact
  dateFin: number | string;       // Date du dernier prolongement
  estSwept: boolean;              // true si le niveau a été balayé/purgé par une mèche ultérieure
  tempsSweep?: number | string;   // Date de la bougie de balayage
  prixSweep?: number;             // Extrême atteint lors du balayage
}

/**
 * Représente une Trendline de Liquidité (droite oblique).
 * Trendline Haussière  : Creux ascendants = traînée de Stop-Loss d'acheteurs en-dessous (SSL).
 * Trendline Baissière  : Sommets descendants = traînée de Stop-Loss de vendeurs au-dessus (BSL).
 */
export interface TrendlineLiquidite {
  id: string;
  direction: 'HAUSSIERE' | 'BAISSIERE'; // Haussière (Support oblique) ou Baissière (Résistance oblique)
  typeLiquidite: 'SSL' | 'BSL';         // Haussière accumule des Sell Stops, Baissière accumule des Buy Stops
  pente: number;                        // Pente de la droite (prix par bougie)
  nbTouches: number;                    // Nombre de points de contact alignés (2 ou plus)
  indexDepart: number;                  // Index de bougie du premier pivot
  tempsDepart: number | string;
  prixDepart: number;
  indexDernierPivot: number;            // Index du dernier pivot de contact
  tempsDernierPivot: number | string;
  prixDernierPivot: number;
  indexFin: number;                     // Index jusqu'où la trendline est projetée
  tempsFin: number | string;
  prixFin: number;                      // Prix projeté à l'indexFin (pour ligne oblique !)
  estSwept: boolean;                    // true si le prix a cassé/balayé la trendline
  tempsSweep?: number | string;
  prixSweep?: number;
}

/**
 * Options de configuration personnalisables par l'utilisateur
 */
export interface OptionsDetectionLiquiditeSRTL {
  modeDetection?: ModeDetectionLiquidite; // 'tous' | 'sr_seulement' | 'trendline_seulement' (défaut: 'tous')
  profondeurPivot?: number;               // Sensibilité pour valider les sommets/creux (défaut: 5)
  minTouches?: number;                    // Nombre minimal de contacts pour valider une ligne (défaut: 2)
  tolerancePips?: number;                 // Tolérance d'alignement/contact en pips (défaut: 1.5)
  minBougiesEntrePivots?: number;         // Écart minimal en bougies entre 2 contacts (défaut: 4)
  maxBougiesHistorique?: number;          // Nombre de bougies analysées en arrière (défaut: 600)
  masquerNiveauxBalayes?: boolean;        // Masquer les niveaux déjà purgés (défaut: false)
  afficherLignes?: boolean;               // Tracer les droites sur le graphique (défaut: true)
  afficherEtiquettes?: boolean;           // Afficher les badges d'information (défaut: true)
  afficherZones?: boolean;                // Tracer les boîtes de liquidité et de sweep (défaut: true)
  taillePip?: number;                     // Taille de pip personnalisée (optionnelle)
}

/**
 * Résultat complet de l'analyse
 */
export interface ResultatDetectionLiquiditeSRTL {
  supports: NiveauSupportResistance[];
  resistances: NiveauSupportResistance[];
  trendlinesHaussieres: TrendlineLiquidite[];
  trendlinesBaissieres: TrendlineLiquidite[];
  totalNiveauxSR: number;
  totalTrendlines: number;
  primitives: VisualPrimitives;
}

// ─── 🛠️ Fonctions Internes ──────────────────────────────────────────────────

/**
 * Déduit automatiquement la taille d'un pip selon le cours
 */
function deduireTaillePip(prix: number): number {
  if (prix <= 0) return 0.0001;
  if (prix > 1000) return 0.1;
  if (prix > 50) return 0.01;
  return 0.0001;
}

interface PivotPoint {
  prix: number;
  temps: number | string;
  index: number;
  estHaut: boolean;
}

/**
 * Scan et identification des sommets et creux swing majeurs
 */
function scannerPivots(bougies: Bougie[], profondeur: number, maxHistorique: number): PivotPoint[] {
  const pivots: PivotPoint[] = [];
  const total = bougies.length;
  const debut = Math.max(profondeur, total - maxHistorique);
  const fin = total - profondeur - 1;

  for (let i = debut; i <= fin; i++) {
    let estHaut = true;
    let estBas = true;

    for (let j = 1; j <= profondeur; j++) {
      if (bougies[i].high <= bougies[i - j].high || bougies[i].high < bougies[i + j].high) estHaut = false;
      if (bougies[i].low >= bougies[i - j].low || bougies[i].low > bougies[i + j].low) estBas = false;
    }

    if (estHaut) {
      pivots.push({ prix: bougies[i].high, temps: bougies[i].time, index: i, estHaut: true });
    } else if (estBas) {
      pivots.push({ prix: bougies[i].low, temps: bougies[i].time, index: i, estHaut: false });
    }
  }

  return pivots;
}

// ─── 🧱 Détection des Supports et Résistances Horizontaux ────────────────────

function detecterSupportsResistances(
  pivots: PivotPoint[],
  bougies: Bougie[],
  minTouches: number,
  tolerancePoints: number,
  minEcartBougies: number
): { supports: NiveauSupportResistance[]; resistances: NiveauSupportResistance[] } {
  const supports: NiveauSupportResistance[] = [];
  const resistances: NiveauSupportResistance[] = [];
  const totalBougies = bougies.length;

  const sommets = pivots.filter(p => p.estHaut);
  const creux = pivots.filter(p => !p.estHaut);

  // 1️⃣ Groupement des sommets pour former les Résistances (BSL)
  const sommetsVisites = new Set<number>();
  for (let i = 0; i < sommets.length; i++) {
    if (sommetsVisites.has(sommets[i].index)) continue;

    const cluster: PivotPoint[] = [sommets[i]];
    for (let j = i + 1; j < sommets.length; j++) {
      if (sommets[j].index - cluster[cluster.length - 1].index < minEcartBougies) continue;
      if (Math.abs(sommets[j].prix - sommets[i].prix) <= tolerancePoints) {
        cluster.push(sommets[j]);
      }
    }

    if (cluster.length >= minTouches) {
      cluster.forEach(p => sommetsVisites.add(p.index));
      const prixMoyen = cluster.reduce((sum, p) => sum + p.prix, 0) / cluster.length;
      const premier = cluster[0];
      const dernier = cluster[cluster.length - 1];

      // Vérification si le niveau a été balayé après le dernier pivot
      let estSwept = false;
      let tempsSweep: number | string | undefined;
      let prixSweep: number | undefined;

      for (let b = dernier.index + 1; b < totalBougies; b++) {
        if (bougies[b].high >= prixMoyen + tolerancePoints * 0.3) {
          estSwept = true;
          tempsSweep = bougies[b].time;
          prixSweep = bougies[b].high;
          break;
        }
      }

      resistances.push({
        id: `res-${premier.index}-${dernier.index}`,
        type: 'RESISTANCE',
        prix: prixMoyen,
        nbTouches: cluster.length,
        pivotsIndices: cluster.map(p => p.index),
        dateDebut: premier.temps,
        dateFin: tempsSweep || bougies[totalBougies - 1].time,
        estSwept,
        tempsSweep,
        prixSweep,
      });
    }
  }

  // 2️⃣ Groupement des creux pour former les Supports (SSL)
  const creuxVisites = new Set<number>();
  for (let i = 0; i < creux.length; i++) {
    if (creuxVisites.has(creux[i].index)) continue;

    const cluster: PivotPoint[] = [creux[i]];
    for (let j = i + 1; j < creux.length; j++) {
      if (creux[j].index - cluster[cluster.length - 1].index < minEcartBougies) continue;
      if (Math.abs(creux[j].prix - creux[i].prix) <= tolerancePoints) {
        cluster.push(creux[j]);
      }
    }

    if (cluster.length >= minTouches) {
      cluster.forEach(p => creuxVisites.add(p.index));
      const prixMoyen = cluster.reduce((sum, p) => sum + p.prix, 0) / cluster.length;
      const premier = cluster[0];
      const dernier = cluster[cluster.length - 1];

      let estSwept = false;
      let tempsSweep: number | string | undefined;
      let prixSweep: number | undefined;

      for (let b = dernier.index + 1; b < totalBougies; b++) {
        if (bougies[b].low <= prixMoyen - tolerancePoints * 0.3) {
          estSwept = true;
          tempsSweep = bougies[b].time;
          prixSweep = bougies[b].low;
          break;
        }
      }

      supports.push({
        id: `sup-${premier.index}-${dernier.index}`,
        type: 'SUPPORT',
        prix: prixMoyen,
        nbTouches: cluster.length,
        pivotsIndices: cluster.map(p => p.index),
        dateDebut: premier.temps,
        dateFin: tempsSweep || bougies[totalBougies - 1].time,
        estSwept,
        tempsSweep,
        prixSweep,
      });
    }
  }

  return { supports, resistances };
}

// ─── 📐 Détection des Trendlines de Liquidité (Obliques) ─────────────────────

function detecterTrendlines(
  pivots: PivotPoint[],
  bougies: Bougie[],
  minTouches: number,
  tolerancePoints: number,
  minEcartBougies: number
): { trendlinesHaussieres: TrendlineLiquidite[]; trendlinesBaissieres: TrendlineLiquidite[] } {
  const trendlinesHaussieres: TrendlineLiquidite[] = [];
  const trendlinesBaissieres: TrendlineLiquidite[] = [];
  const totalBougies = bougies.length;

  const creux = pivots.filter(p => !p.estHaut);
  const sommets = pivots.filter(p => p.estHaut);

  // 1️⃣ Trendlines Haussières (Reliant des Creux Ascendants -> SSL sous la ligne)
  for (let i = 0; i < creux.length - 1; i++) {
    for (let j = i + 1; j < creux.length; j++) {
      const p1 = creux[i];
      const p2 = creux[j];
      const ecartX = p2.index - p1.index;

      if (ecartX < minEcartBougies) continue;
      if (p2.prix <= p1.prix) continue; // Pente positive exigée pour trendline haussière

      const pente = (p2.prix - p1.prix) / ecartX;

      // Vérification que les bougies intermédiaires ne cassent pas outrageusement la trendline
      let ligneCoherente = true;
      for (let k = p1.index + 1; k < p2.index; k++) {
        const prixAttendu = p1.prix + pente * (k - p1.index);
        if (bougies[k].close < prixAttendu - tolerancePoints * 1.2) {
          ligneCoherente = false;
          break;
        }
      }
      if (!ligneCoherente) continue;

      // Recherche de 3e ou 4e contacts alignés
      let nbContacts = 2;
      let dernierPivot = p2;
      for (let m = j + 1; m < creux.length; m++) {
        const p3 = creux[m];
        const prixAttendu = p1.prix + pente * (p3.index - p1.index);
        if (Math.abs(p3.prix - prixAttendu) <= tolerancePoints) {
          nbContacts++;
          dernierPivot = p3;
        }
      }

      if (nbContacts >= minTouches) {
        // Détection de balayage ultérieur (le prix casse sous la trendline)
        let estSwept = false;
        let tempsSweep: number | string | undefined;
        let prixSweep: number | undefined;
        let indexFin = totalBougies - 1;

        for (let b = dernierPivot.index + 1; b < totalBougies; b++) {
          const prixLigne = p1.prix + pente * (b - p1.index);
          if (bougies[b].low < prixLigne - tolerancePoints * 0.5) {
            estSwept = true;
            tempsSweep = bougies[b].time;
            prixSweep = bougies[b].low;
            indexFin = b;
            break;
          }
        }

        const prixFinProjete = p1.prix + pente * (indexFin - p1.index);

        trendlinesHaussieres.push({
          id: `tl-bull-${p1.index}-${dernierPivot.index}`,
          direction: 'HAUSSIERE',
          typeLiquidite: 'SSL',
          pente,
          nbTouches: nbContacts,
          indexDepart: p1.index,
          tempsDepart: p1.temps,
          prixDepart: p1.prix,
          indexDernierPivot: dernierPivot.index,
          tempsDernierPivot: dernierPivot.temps,
          prixDernierPivot: dernierPivot.prix,
          indexFin,
          tempsFin: tempsSweep || bougies[totalBougies - 1].time,
          prixFin: prixFinProjete,
          estSwept,
          tempsSweep,
          prixSweep,
        });

        break; // Une seule trendline majeure par ancre de départ
      }
    }
  }

  // 2️⃣ Trendlines Baissières (Reliant des Sommets Descendants -> BSL au-dessus de la ligne)
  for (let i = 0; i < sommets.length - 1; i++) {
    for (let j = i + 1; j < sommets.length; j++) {
      const p1 = sommets[i];
      const p2 = sommets[j];
      const ecartX = p2.index - p1.index;

      if (ecartX < minEcartBougies) continue;
      if (p2.prix >= p1.prix) continue; // Pente négative exigée

      const pente = (p2.prix - p1.prix) / ecartX;

      let ligneCoherente = true;
      for (let k = p1.index + 1; k < p2.index; k++) {
        const prixAttendu = p1.prix + pente * (k - p1.index);
        if (bougies[k].close > prixAttendu + tolerancePoints * 1.2) {
          ligneCoherente = false;
          break;
        }
      }
      if (!ligneCoherente) continue;

      let nbContacts = 2;
      let dernierPivot = p2;
      for (let m = j + 1; m < sommets.length; m++) {
        const p3 = sommets[m];
        const prixAttendu = p1.prix + pente * (p3.index - p1.index);
        if (Math.abs(p3.prix - prixAttendu) <= tolerancePoints) {
          nbContacts++;
          dernierPivot = p3;
        }
      }

      if (nbContacts >= minTouches) {
        let estSwept = false;
        let tempsSweep: number | string | undefined;
        let prixSweep: number | undefined;
        let indexFin = totalBougies - 1;

        for (let b = dernierPivot.index + 1; b < totalBougies; b++) {
          const prixLigne = p1.prix + pente * (b - p1.index);
          if (bougies[b].high > prixLigne + tolerancePoints * 0.5) {
            estSwept = true;
            tempsSweep = bougies[b].time;
            prixSweep = bougies[b].high;
            indexFin = b;
            break;
          }
        }

        const prixFinProjete = p1.prix + pente * (indexFin - p1.index);

        trendlinesBaissieres.push({
          id: `tl-bear-${p1.index}-${dernierPivot.index}`,
          direction: 'BAISSIERE',
          typeLiquidite: 'BSL',
          pente,
          nbTouches: nbContacts,
          indexDepart: p1.index,
          tempsDepart: p1.temps,
          prixDepart: p1.prix,
          indexDernierPivot: dernierPivot.index,
          tempsDernierPivot: dernierPivot.temps,
          prixDernierPivot: dernierPivot.prix,
          indexFin,
          tempsFin: tempsSweep || bougies[totalBougies - 1].time,
          prixFin: prixFinProjete,
          estSwept,
          tempsSweep,
          prixSweep,
        });

        break;
      }
    }
  }

  return { trendlinesHaussieres, trendlinesBaissieres };
}

// ─── 🚀 Moteur Principal de Calcul ────────────────────────────────────────────

/**
 * Détecte les pools de liquidité institutionnels sous forme de :
 * 1. Supports et Résistances horizontaux (Clusters de rejets)
 * 2. Trendlines obliques haussières et baissières (Trendline Liquidity)
 * 
 * Permet de basculer facilement entre les modes via le paramètre modeDetection.
 * 
 * Exemple :
 * const res = calculerDetectionLiquiditeSRTL(bougies, { modeDetection: 'tous', minTouches: 2 });
 */
export function calculerDetectionLiquiditeSRTL(
  bougies: Bougie[],
  options: OptionsDetectionLiquiditeSRTL = {}
): ResultatDetectionLiquiditeSRTL {
  const mode = options.modeDetection || 'tous';
  const profondeur = options.profondeurPivot ?? 5;
  const minTouches = options.minTouches ?? 2;
  const tolerancePips = options.tolerancePips ?? 1.5;
  const minBougies = options.minBougiesEntrePivots ?? 4;
  const maxHistorique = options.maxBougiesHistorique ?? 600;
  const masquerBalayes = Boolean(options.masquerNiveauxBalayes);
  const afficherLignes = options.afficherLignes !== false;
  const afficherEtiquettes = options.afficherEtiquettes !== false;
  const afficherZones = options.afficherZones !== false;

  if (!bougies || bougies.length < 25) {
    return {
      supports: [],
      resistances: [],
      trendlinesHaussieres: [],
      trendlinesBaissieres: [],
      totalNiveauxSR: 0,
      totalTrendlines: 0,
      primitives: { boites: [], lignes: [], labels: [] },
    };
  }

  const prixRef = bougies[bougies.length - 1].close;
  const pipSize = options.taillePip ?? deduireTaillePip(prixRef);
  const tolerancePoints = tolerancePips * pipSize;

  // 1️⃣ Scan des pivots
  const pivots = scannerPivots(bougies, profondeur, maxHistorique);

  // 2️⃣ Analyse des Supports & Résistances (si activé)
  let supports: NiveauSupportResistance[] = [];
  let resistances: NiveauSupportResistance[] = [];
  if (mode === 'tous' || mode === 'sr_seulement') {
    const sr = detecterSupportsResistances(pivots, bougies, minTouches, tolerancePoints, minBougies);
    supports = sr.supports;
    resistances = sr.resistances;
  }

  // 3️⃣ Analyse des Trendlines (si activé)
  let trendlinesHaussieres: TrendlineLiquidite[] = [];
  let trendlinesBaissieres: TrendlineLiquidite[] = [];
  if (mode === 'tous' || mode === 'trendline_seulement') {
    const tl = detecterTrendlines(pivots, bougies, minTouches, tolerancePoints, minBougies);
    trendlinesHaussieres = tl.trendlinesHaussieres;
    trendlinesBaissieres = tl.trendlinesBaissieres;
  }

  // 4️⃣ Génération des primitives visuelles universelles
  const lignes: VisualLine[] = [];
  const labels: VisualLabel[] = [];
  const boites: VisualBox[] = [];

  // A. Rendu des Résistances (BSL rouge / or)
  for (const res of resistances) {
    if (masquerBalayes && res.estSwept) continue;

    if (afficherLignes) {
      lignes.push({
        id: `ligne-${res.id}`,
        prix: res.prix,
        dateDebut: res.dateDebut,
        dateFin: res.dateFin,
        couleur: '#ef4444',
        style: res.estSwept ? 'solid' : 'dashed',
        label: `Résistance BSL (${res.nbTouches}x)${res.estSwept ? ' [Purgé]' : ' [Actif]'}`,
      });
    }

    if (afficherEtiquettes) {
      labels.push({
        id: `lbl-${res.id}`,
        prix: res.prix,
        date: res.dateDebut,
        texte: `🧱 BSL ${res.prix.toFixed(4)}`,
        couleur: '#ef4444',
        position: 'above',
      });
    }

    if (afficherZones && res.estSwept && res.tempsSweep && res.prixSweep) {
      boites.push({
        id: `box-${res.id}`,
        prixHaut: Math.max(res.prix, res.prixSweep),
        prixBas: Math.min(res.prix, res.prixSweep),
        dateDebut: res.tempsSweep,
        couleurFond: 'rgba(239, 68, 68, 0.20)',
        couleurBordure: '#ef4444',
        label: '🔴 Sweep BSL',
      });
    }
  }

  // B. Rendu des Supports (SSL vert / cyan)
  for (const sup of supports) {
    if (masquerBalayes && sup.estSwept) continue;

    if (afficherLignes) {
      lignes.push({
        id: `ligne-${sup.id}`,
        prix: sup.prix,
        dateDebut: sup.dateDebut,
        dateFin: sup.dateFin,
        couleur: '#10b981',
        style: sup.estSwept ? 'solid' : 'dashed',
        label: `Support SSL (${sup.nbTouches}x)${sup.estSwept ? ' [Purgé]' : ' [Actif]'}`,
      });
    }

    if (afficherEtiquettes) {
      labels.push({
        id: `lbl-${sup.id}`,
        prix: sup.prix,
        date: sup.dateDebut,
        texte: `🛡️ SSL ${sup.prix.toFixed(4)}`,
        couleur: '#10b981',
        position: 'below',
      });
    }

    if (afficherZones && sup.estSwept && sup.tempsSweep && sup.prixSweep) {
      boites.push({
        id: `box-${sup.id}`,
        prixHaut: Math.max(sup.prix, sup.prixSweep),
        prixBas: Math.min(sup.prix, sup.prixSweep),
        dateDebut: sup.tempsSweep,
        couleurFond: 'rgba(16, 185, 129, 0.20)',
        couleurBordure: '#10b981',
        label: '🟢 Sweep SSL',
      });
    }
  }

  // C. Rendu des Trendlines Haussières (Obliques - SSL)
  for (const tl of trendlinesHaussieres) {
    if (masquerBalayes && tl.estSwept) continue;

    if (afficherLignes) {
      lignes.push({
        id: `tl-${tl.id}`,
        prix: tl.prixDepart,
        prixFin: tl.prixFin, // Ligne oblique vers le prix projeté !
        dateDebut: tl.tempsDepart,
        dateFin: tl.tempsFin,
        couleur: '#38bdf8', // Cyan
        style: tl.estSwept ? 'solid' : 'dashed',
        label: `Trendline SSL (${tl.nbTouches}x)${tl.estSwept ? ' [Cassée]' : ' [Active]'}`,
      });
    }

    if (afficherEtiquettes) {
      labels.push({
        id: `lbl-${tl.id}`,
        prix: tl.prixDernierPivot,
        date: tl.tempsDernierPivot,
        texte: `📐 TRL-SSL (${tl.nbTouches}T)`,
        couleur: '#38bdf8',
        position: 'below',
      });
    }
  }

  // D. Rendu des Trendlines Baissières (Obliques - BSL)
  for (const tl of trendlinesBaissieres) {
    if (masquerBalayes && tl.estSwept) continue;

    if (afficherLignes) {
      lignes.push({
        id: `tl-${tl.id}`,
        prix: tl.prixDepart,
        prixFin: tl.prixFin, // Ligne oblique descendante !
        dateDebut: tl.tempsDepart,
        dateFin: tl.tempsFin,
        couleur: '#f59e0b', // Ambre / Or
        style: tl.estSwept ? 'solid' : 'dashed',
        label: `Trendline BSL (${tl.nbTouches}x)${tl.estSwept ? ' [Cassée]' : ' [Active]'}`,
      });
    }

    if (afficherEtiquettes) {
      labels.push({
        id: `lbl-${tl.id}`,
        prix: tl.prixDernierPivot,
        date: tl.tempsDernierPivot,
        texte: `📐 TRL-BSL (${tl.nbTouches}T)`,
        couleur: '#f59e0b',
        position: 'above',
      });
    }
  }

  return {
    supports,
    resistances,
    trendlinesHaussieres,
    trendlinesBaissieres,
    totalNiveauxSR: supports.length + resistances.length,
    totalTrendlines: trendlinesHaussieres.length + trendlinesBaissieres.length,
    primitives: {
      lignes,
      labels,
      boites,
    },
  };
}
