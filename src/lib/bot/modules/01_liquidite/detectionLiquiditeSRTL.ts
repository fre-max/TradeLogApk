import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLine, VisualLabel, VisualBox } from '@/types/indicatorScript';

// ─── 📊 Types et Structures de données ────────────────────────────────────────

/**
 * Représente une zone de Support ou Résistance horizontale identifiée.
 * La liquidité s'accumule sous forme de Stop-Loss suite à plusieurs rejets.
 */
export interface ZoneSupportResistance {
  id: string;
  type: 'SUPPORT' | 'RESISTANCE'; // Support = SSL (Sell-Side Liquidity), Résistance = BSL (Buy-Side Liquidity)
  prixHaut: number;               // Borne supérieure de la zone (avec marge)
  prixBas: number;                // Borne inférieure de la zone (avec marge)
  prixMedian: number;             // Niveau de prix médian / moyen des touches
  nbTouches: number;              // Nombre de retests confirmés (au minimum 2)
  pivotsIndices: number[];        // Indices des bougies de contact
  dateDebut: number | string;     // Date de la 1ère touche
  dateFin: number | string;       // Date de fin (dernière bougie ou moment de cassure)
  estCassee: boolean;             // true si une bougie a clôturé franchement au-delà de la zone
  estSwept: boolean;              // true si une mèche a purgé la zone sans clôture au-delà
  tempsCassure?: number | string; // Date de la bougie d'invalidation
}

/**
 * Options de configuration personnalisables par l'utilisateur
 */
export interface OptionsDetectionLiquiditeSRTL {
  profondeurPivot?: number;       // Sensibilité pour valider les sommets/creux (défaut: 5)
  margeZonePips?: number;         // Tolérance de dépassement entre deux retests en pips (défaut: 4.0)
  epaisseurBufferPips?: number;   // Marge supplémentaire pour élargir le rectangle (défaut: 1.5)
  minTouches?: number;            // Nombre minimal de retests pour valider la zone (minimum 2, défaut: 2)
  minBougiesEntrePivots?: number; // Écart minimal en bougies entre deux contacts (défaut: 4)
  maxBougiesHistorique?: number;  // Nombre de bougies analysées en arrière (défaut: 600)
  masquerZonesCassees?: boolean;  // Masquer les zones déjà invalidées par clôture (défaut: false)
  afficherZones?: boolean;        // Afficher les rectangles des zones (défaut: true)
  afficherLignes?: boolean;       // Afficher la ligne médiane (défaut: true)
  afficherEtiquettes?: boolean;   // Afficher les badges d'information (défaut: true)
  taillePip?: number;             // Taille personnalisée d'un pip (optionnel)
}

/**
 * Résultat complet de l'analyse
 */
export interface ResultatDetectionLiquiditeSRTL {
  supports: ZoneSupportResistance[];
  resistances: ZoneSupportResistance[];
  totalZones: number;
  primitives: VisualPrimitives;
}

// ─── 🛠️ Fonctions Internes ──────────────────────────────────────────────────

/**
 * Déduit automatiquement la taille d'un pip selon le cours
 * Exemple : EURUSD -> 0.0001, USDJPY / XAUUSD -> 0.01 ou 0.1
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
 * Scan des sommets et creux swing majeurs
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
      if (bougies[i].high <= bougies[i - j].high || bougies[i].high < bougies[i + j].high) {
        estHaut = false;
      }
      if (bougies[i].low >= bougies[i - j].low || bougies[i].low > bougies[i + j].low) {
        estBas = false;
      }
    }

    if (estHaut) {
      pivots.push({ prix: bougies[i].high, temps: bougies[i].time, index: i, estHaut: true });
    } else if (estBas) {
      pivots.push({ prix: bougies[i].low, temps: bougies[i].time, index: i, estHaut: false });
    }
  }

  return pivots;
}

// ─── 🧱 Détection des Zones de Supports et Résistances ─────────────────────────

/**
 * Regroupe les sommets et creux pour former des zones épaisses avec marge.
 * Exige au minimum 2 points d'ancrage (retests) pour valider une zone de liquidité.
 */
function detecterZonesSR(
  pivots: PivotPoint[],
  bougies: Bougie[],
  minTouches: number,
  margePoints: number,
  bufferPoints: number,
  minEcartBougies: number
): { supports: ZoneSupportResistance[]; resistances: ZoneSupportResistance[] } {
  const supports: ZoneSupportResistance[] = [];
  const resistances: ZoneSupportResistance[] = [];
  const totalBougies = bougies.length;

  const sommets = pivots.filter(p => p.estHaut);
  const creux = pivots.filter(p => !p.estHaut);

  // 1️⃣ Groupement des sommets pour former les Zones de RÉSISTANCE (BSL)
  const sommetsVisites = new Set<number>();
  for (let i = 0; i < sommets.length; i++) {
    if (sommetsVisites.has(sommets[i].index)) continue;

    const cluster: PivotPoint[] = [sommets[i]];
    let maxPrix = sommets[i].prix;
    let minPrix = sommets[i].prix;

    // Recherche de retests qui approchent ou dépassent légèrement la zone
    for (let j = i + 1; j < sommets.length; j++) {
      const p = sommets[j];
      if (p.index - cluster[cluster.length - 1].index < minEcartBougies) continue;

      // On vérifie si ce sommet est dans la marge de tolérance du cluster
      const diffAvecBase = Math.abs(p.prix - sommets[i].prix);
      const diffAvecMax = Math.abs(p.prix - maxPrix);
      const diffAvecMin = Math.abs(p.prix - minPrix);

      if (diffAvecBase <= margePoints || diffAvecMax <= margePoints || diffAvecMin <= margePoints) {
        cluster.push(p);
        if (p.prix > maxPrix) maxPrix = p.prix;
        if (p.prix < minPrix) minPrix = p.prix;
      }
    }

    // On exige strictement au moins 2 points d'ancrage (retest obligatoire)
    if (cluster.length >= Math.max(2, minTouches)) {
      cluster.forEach(p => sommetsVisites.add(p.index));

      const premier = cluster[0];
      const dernier = cluster[cluster.length - 1];
      const prixHautZone = maxPrix + bufferPoints;
      const prixBasZone = Math.max(0, minPrix - bufferPoints);
      const prixMedian = (maxPrix + minPrix) / 2;

      // Analyse de l'historique après le dernier retest : cassure nette ou balayage
      let estCassee = false;
      let estSwept = false;
      let dateFin: number | string = bougies[totalBougies - 1].time;
      let tempsCassure: number | string | undefined;

      for (let b = dernier.index + 1; b < totalBougies; b++) {
        // Cassure franche : une bougie clôture nettement au-dessus de la zone
        if (bougies[b].close > prixHautZone) {
          estCassee = true;
          tempsCassure = bougies[b].time;
          dateFin = bougies[b].time;
          break;
        }
        // Mèche qui dépasse la zone sans clôturer au-dessus = Sweep de liquidité
        if (bougies[b].high > prixHautZone && bougies[b].close <= prixHautZone) {
          estSwept = true;
        }
      }

      resistances.push({
        id: `res-${premier.index}-${dernier.index}`,
        type: 'RESISTANCE',
        prixHaut: prixHautZone,
        prixBas: prixBasZone,
        prixMedian,
        nbTouches: cluster.length,
        pivotsIndices: cluster.map(p => p.index),
        dateDebut: premier.temps,
        dateFin,
        estCassee,
        estSwept,
        tempsCassure,
      });
    }
  }

  // 2️⃣ Groupement des creux pour former les Zones de SUPPORT (SSL)
  const creuxVisites = new Set<number>();
  for (let i = 0; i < creux.length; i++) {
    if (creuxVisites.has(creux[i].index)) continue;

    const cluster: PivotPoint[] = [creux[i]];
    let maxPrix = creux[i].prix;
    let minPrix = creux[i].prix;

    // Recherche de retests qui approchent ou s'enfoncent légèrement
    for (let j = i + 1; j < creux.length; j++) {
      const p = creux[j];
      if (p.index - cluster[cluster.length - 1].index < minEcartBougies) continue;

      const diffAvecBase = Math.abs(p.prix - creux[i].prix);
      const diffAvecMax = Math.abs(p.prix - maxPrix);
      const diffAvecMin = Math.abs(p.prix - minPrix);

      if (diffAvecBase <= margePoints || diffAvecMax <= margePoints || diffAvecMin <= margePoints) {
        cluster.push(p);
        if (p.prix > maxPrix) maxPrix = p.prix;
        if (p.prix < minPrix) minPrix = p.prix;
      }
    }

    // On exige strictement au moins 2 points d'ancrage (retest obligatoire)
    if (cluster.length >= Math.max(2, minTouches)) {
      cluster.forEach(p => creuxVisites.add(p.index));

      const premier = cluster[0];
      const dernier = cluster[cluster.length - 1];
      const prixHautZone = maxPrix + bufferPoints;
      const prixBasZone = Math.max(0, minPrix - bufferPoints);
      const prixMedian = (maxPrix + minPrix) / 2;

      let estCassee = false;
      let estSwept = false;
      let dateFin: number | string = bougies[totalBougies - 1].time;
      let tempsCassure: number | string | undefined;

      for (let b = dernier.index + 1; b < totalBougies; b++) {
        // Cassure franche : une bougie clôture nettement en-dessous de la zone
        if (bougies[b].close < prixBasZone) {
          estCassee = true;
          tempsCassure = bougies[b].time;
          dateFin = bougies[b].time;
          break;
        }
        // Mèche qui plonge sous la zone sans clôturer en-dessous = Sweep de liquidité
        if (bougies[b].low < prixBasZone && bougies[b].close >= prixBasZone) {
          estSwept = true;
        }
      }

      supports.push({
        id: `sup-${premier.index}-${dernier.index}`,
        type: 'SUPPORT',
        prixHaut: prixHautZone,
        prixBas: prixBasZone,
        prixMedian,
        nbTouches: cluster.length,
        pivotsIndices: cluster.map(p => p.index),
        dateDebut: premier.temps,
        dateFin,
        estCassee,
        estSwept,
        tempsCassure,
      });
    }
  }

  return { supports, resistances };
}

// ─── 🚀 Moteur Principal de Calcul ────────────────────────────────────────────

/**
 * Détecte les zones de liquidité horizontales (Supports et Résistances)
 * ayant au minimum 2 points d'ancrage confirmés (retests).
 * 
 * Génère des rectangles visibles avec marge pour matérialiser les zones de liquidité.
 * 
 * Exemple :
 * const res = calculerDetectionLiquiditeSRTL(bougies, { minTouches: 2, margeZonePips: 4.0 });
 */
export function calculerDetectionLiquiditeSRTL(
  bougies: Bougie[],
  options: OptionsDetectionLiquiditeSRTL = {}
): ResultatDetectionLiquiditeSRTL {
  const profondeur = options.profondeurPivot ?? 5;
  const margePips = options.margeZonePips ?? 4.0;
  const bufferPips = options.epaisseurBufferPips ?? 1.5;
  const minTouches = Math.max(2, options.minTouches ?? 2); // Strictement >= 2
  const minBougies = options.minBougiesEntrePivots ?? 4;
  const maxHistorique = options.maxBougiesHistorique ?? 600;
  const masquerCassees = Boolean(options.masquerZonesCassees);
  const afficherZones = options.afficherZones !== false;
  const afficherLignes = options.afficherLignes !== false;
  const afficherEtiquettes = options.afficherEtiquettes !== false;

  if (!bougies || bougies.length < 20) {
    return {
      supports: [],
      resistances: [],
      totalZones: 0,
      primitives: { boites: [], lignes: [], labels: [] },
    };
  }

  const prixRef = bougies[bougies.length - 1].close;
  const pipSize = options.taillePip ?? deduireTaillePip(prixRef);
  const margePoints = margePips * pipSize;
  const bufferPoints = bufferPips * pipSize;

  // 1️⃣ Scan des sommets et creux swing
  const pivots = scannerPivots(bougies, profondeur, maxHistorique);

  // 2️⃣ Analyse des zones S/R avec marge et validation des retests
  const { supports, resistances } = detecterZonesSR(
    pivots,
    bougies,
    minTouches,
    margePoints,
    bufferPoints,
    minBougies
  );

  // 3️⃣ Génération des primitives graphiques visuelles
  const boites: VisualBox[] = [];
  const lignes: VisualLine[] = [];
  const labels: VisualLabel[] = [];

  // A. Rendu des Résistances (BSL - Buy-Side Liquidity au-dessus)
  for (const res of resistances) {
    if (masquerCassees && res.estCassee) continue;

    // Rectangle de la zone de résistance
    if (afficherZones) {
      boites.push({
        id: `box-${res.id}`,
        prixHaut: res.prixHaut,
        prixBas: res.prixBas,
        dateDebut: res.dateDebut,
        dateFin: res.dateFin,
        couleurFond: res.estCassee
          ? 'rgba(239, 68, 68, 0.06)'
          : 'rgba(239, 68, 68, 0.16)',
        couleurBordure: res.estCassee ? '#f87171' : '#ef4444',
        label: `🧱 BSL (${res.nbTouches}x)${res.estSwept ? ' [Sweep]' : ''}`,
      });
    }

    // Ligne médiane de repère
    if (afficherLignes) {
      lignes.push({
        id: `ligne-${res.id}`,
        prix: res.prixMedian,
        dateDebut: res.dateDebut,
        dateFin: res.dateFin,
        couleur: '#ef4444',
        style: res.estCassee ? 'dotted' : 'dashed',
        label: `Résistance (${res.nbTouches} touches)`,
      });
    }

    // Badge textuel
    if (afficherEtiquettes) {
      labels.push({
        id: `lbl-${res.id}`,
        prix: res.prixHaut,
        date: res.dateDebut,
        texte: `🧱 BSL [${res.nbTouches} touches]`,
        couleur: '#ef4444',
        position: 'above',
      });
    }
  }

  // B. Rendu des Supports (SSL - Sell-Side Liquidity en-dessous)
  for (const sup of supports) {
    if (masquerCassees && sup.estCassee) continue;

    // Rectangle de la zone de support
    if (afficherZones) {
      boites.push({
        id: `box-${sup.id}`,
        prixHaut: sup.prixHaut,
        prixBas: sup.prixBas,
        dateDebut: sup.dateDebut,
        dateFin: sup.dateFin,
        couleurFond: sup.estCassee
          ? 'rgba(16, 185, 129, 0.06)'
          : 'rgba(16, 185, 129, 0.16)',
        couleurBordure: sup.estCassee ? '#34d399' : '#10b981',
        label: `🛡️ SSL (${sup.nbTouches}x)${sup.estSwept ? ' [Sweep]' : ''}`,
      });
    }

    // Ligne médiane de repère
    if (afficherLignes) {
      lignes.push({
        id: `ligne-${sup.id}`,
        prix: sup.prixMedian,
        dateDebut: sup.dateDebut,
        dateFin: sup.dateFin,
        couleur: '#10b981',
        style: sup.estCassee ? 'dotted' : 'dashed',
        label: `Support (${sup.nbTouches} touches)`,
      });
    }

    // Badge textuel
    if (afficherEtiquettes) {
      labels.push({
        id: `lbl-${sup.id}`,
        prix: sup.prixBas,
        date: sup.dateDebut,
        texte: `🛡️ SSL [${sup.nbTouches} touches]`,
        couleur: '#10b981',
        position: 'below',
      });
    }
  }

  return {
    supports,
    resistances,
    totalZones: supports.length + resistances.length,
    primitives: {
      boites,
      lignes,
      labels,
    },
  };
}
