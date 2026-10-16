import { agregerBougies, type Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualBox, VisualLine, VisualLabel } from '@/types/indicatorScript';

// ─── 📊 Types et Structures de Données ────────────────────────────────────────

export type ForceZoneShved = 'PROVEN' | 'VERIFIED' | 'UNTESTED' | 'WEAK';

/**
 * Représente une zone Supply ou Demand calculée selon l'algorithme Shved.
 * 
 * Exemple :
 * {
 *   id: 'shved-res-42',
 *   type: 'RESISTANCE',
 *   prixHaut: 1.0875,
 *   prixBas: 1.0850,
 *   prixMedian: 1.08625,
 *   retests: 3,
 *   force: 'PROVEN',
 *   estCassee: false,
 *   indexOrigine: 42,
 *   dateDebut: 1727180000,
 *   dateFin: 1727220000
 * }
 */
export interface ZoneShved {
  id: string;
  type: 'SUPPORT' | 'RESISTANCE'; // SUPPORT = Demand / SSL, RESISTANCE = Supply / BSL
  prixHaut: number;               // Borne haute du rectangle
  prixBas: number;                // Borne basse du rectangle
  prixMedian: number;             // Niveau de prix central de la zone
  retests: number;                // Nombre de rebonds / retests confirmés
  force: ForceZoneShved;          // PROVEN (>3), VERIFIED (1-3), UNTESTED (0), WEAK (0 faible)
  estFaible: boolean;             // Vrai si validé uniquement par un fractal rapide
  estCassee: boolean;             // Vrai si le prix a franchi la zone
  indexOrigine: number;           // Index de la bougie où la zone a pris naissance
  dateDebut: number | string;     // Horodatage de création
  dateFin: number | string;       // Horodatage de fin (dernière bougie ou moment de cassure)
  indexCassure?: number;          // Index de la bougie de cassure si rompue
  // Horodatages de chaque retest comptabilisé (permet de compter les retests AVANT un instant donné,
  // sans regarder le futur). Exemple : [1727190000, 1727205000]
  datesTouches?: (number | string)[];
}

/**
 * Options de configuration personnalisées pour Shved Supply & Demand
 */
export interface OptionsShvedSupplyDemand {
  // ─── Multi-Timeframe (Option B : Liquidité Interne LTF sur Graphique Macro HTF) ───
  timeframeSource?: string;          // Ex: 'M15', 'M30', 'M5', 'H1', 'ACTUEL' (défaut: 'M15')
  donneesM1?: Bougie[];              // Données brutes M1 transmises pour l'agrégation MTF
  chartTimeframe?: string;           // Unité de temps du graphique d'affichage (ex: 'H4')

  // ─── Filtrage des zones (Directives Utilisateur) ───
  supprimerZonesCassees?: boolean;   // Par défaut TRUE : retire immédiatement les zones rompues (pas de Turncoat)
  afficherNonRetestees?: boolean;    // Par défaut FALSE : masque les zones à 0 retest (car non encore liquidité)
  afficherFaibles?: boolean;         // Par défaut FALSE : masque les zones issues de fractals faibles
  minRetests?: number;               // Nombre minimum de retests requis (défaut: 1)
  
  // ─── Dimensions et Algorithme Shved ───
  periodeATR?: number;               // Période de l'ATR pour la tolérance (défaut: 7)
  zoneFuzzFactor?: number;           // Facteur d'épaisseur ATR (défaut: 0.75)
  zoneExtend?: boolean;              // Étendre la zone au-delà de la mèche (défaut: true)
  fractalFastFactor?: number;        // Sensibilité des fractals rapides (défaut: 3.0)
  fractalSlowFactor?: number;        // Sensibilité des fractals lents majeurs (défaut: 6.0)
  minBougiesEntreRetests?: number;   // Écart minimal de bougies entre deux touches (défaut: 6)
  zoneMerge?: boolean;               // Fusionner les zones superposées (défaut: true)
  maxLookbackBars?: number;          // Historique analysé en bougies (défaut: 200)
  
  // ─── Affichage Visuel ───
  afficherZones?: boolean;           // Dessiner les rectangles (défaut: true)
  afficherLignes?: boolean;          // Dessiner les lignes médianes (défaut: true)
  afficherEtiquettes?: boolean;      // Afficher les textes de force et retests (défaut: true)
}

/**
 * Résultat complet retourné par l'indicateur Shved Supply & Demand
 */
export interface ResultatShvedSupplyDemand {
  supports: ZoneShved[];
  resistances: ZoneShved[];
  totalZones: number;
  nearestSupport: ZoneShved | null;
  nearestResistance: ZoneShved | null;
  primitives: VisualPrimitives;
}

// ─── 🛠️ Fonctions Mathématiques & Détection Shved ────────────────────────────

/**
 * Calcule l'indicateur Average True Range (ATR) sur les bougies fournies.
 * Utilisé par Shved pour dimensionner l'épaisseur dynamique de chaque zone.
 */
function calculerATR(bougies: Bougie[], periode = 7): number[] {
  const total = bougies.length;
  const atr: number[] = new Array(total).fill(0);
  if (total < 2) return atr;

  const tr: number[] = new Array(total).fill(0);
  tr[0] = Math.max(0.0001, bougies[0].high - bougies[0].low);

  for (let i = 1; i < total; i++) {
    const h = bougies[i].high;
    const l = bougies[i].low;
    const prevClose = bougies[i - 1].close;
    tr[i] = Math.max(h - l, Math.abs(h - prevClose), Math.abs(l - prevClose));
  }

  // Moyenne initiale
  let somme = 0;
  const limiteInit = Math.min(periode, total);
  for (let i = 0; i < limiteInit; i++) {
    somme += tr[i];
    atr[i] = somme / (i + 1);
  }

  // Lissage exponentiel ATR (Wilder)
  for (let i = periode; i < total; i++) {
    atr[i] = (atr[i - 1] * (periode - 1) + tr[i]) / periode;
  }

  return atr;
}

/**
 * Vérifie si la bougie à l'index donné forme un fractal haut (sommet).
 */
function estFractalHaut(bougies: Bougie[], index: number, rayon: number): boolean {
  if (index < rayon || index >= bougies.length - rayon) return false;
  const pivotHigh = bougies[index].high;

  for (let k = 1; k <= rayon; k++) {
    if (bougies[index - k].high > pivotHigh) return false;
    if (bougies[index + k].high >= pivotHigh) return false;
  }
  return true;
}

/**
 * Vérifie si la bougie à l'index donné forme un fractal bas (creux).
 */
function estFractalBas(bougies: Bougie[], index: number, rayon: number): boolean {
  if (index < rayon || index >= bougies.length - rayon) return false;
  const pivotLow = bougies[index].low;

  for (let k = 1; k <= rayon; k++) {
    if (bougies[index - k].low < pivotLow) return false;
    if (bougies[index + k].low <= pivotLow) return false;
  }
  return true;
}

// ─── 🚀 Fonction Principale de Calcul ────────────────────────────────────────

/**
 * Calcule l'indicateur Shved Supply & Demand avec personnalisation TradeLog.
 * - Élimine les supports et résistances dès qu'ils sont cassés.
 * - Masque par défaut les zones non retestées (qui n'ont pas encore accumulé de liquidité).
 * 
 * Exemple :
 * const res = calculerShvedSupplyDemand(bougies, {
 *   supprimerZonesCassees: true,
 *   afficherNonRetestees: false
 * });
 */
export function calculerShvedSupplyDemand(
  bougies: Bougie[],
  options: OptionsShvedSupplyDemand = {}
): ResultatShvedSupplyDemand {
  // Tableaux de primitives visuelles pour le rendu sur graphique
  const boites: VisualBox[] = [];
  const lignes: VisualLine[] = [];
  const labels: VisualLabel[] = [];

  const total = bougies.length;
  if (!bougies || total < 20) {
    return {
      supports: [],
      resistances: [],
      totalZones: 0,
      nearestSupport: null,
      nearestResistance: null,
      primitives: { boites, lignes, labels },
    };
  }

  // 1️⃣ Extraction et normalisation des options
  const tfSource = options.timeframeSource || 'M15';
  let bougiesCalcul = bougies;
  let estMTFActif = false;

  // Historique maximal d'analyse demandé (défaut: 200 bougies récentes au lieu de 800)
  const maxHistoriqueDemande = Math.max(20, Number(options.maxLookbackBars ?? 200));

  // Option B : Si une timeframe spécifique (ex: M15) est demandée et qu'on dispose des bougies M1
  if (tfSource !== 'ACTUEL' && options.donneesM1 && options.donneesM1.length > 0) {
    const derniereBougieChart = bougies[bougies.length - 1];
    const tempsMaxSec = typeof derniereBougieChart.time === 'number'
      ? derniereBougieChart.time
      : Math.floor(Date.parse(derniereBougieChart.time as string) / 1000);

    // Détermine la date de début récente : on ne remonte qu'aux N dernières bougies du graphique visible !
    const indexDepartChart = Math.max(0, bougies.length - maxHistoriqueDemande);
    const premiereBougieConcernee = bougies[indexDepartChart];
    const tempsMinChartSec = premiereBougieConcernee
      ? (typeof premiereBougieConcernee.time === 'number' ? premiereBougieConcernee.time : Math.floor(Date.parse(premiereBougieConcernee.time as string) / 1000))
      : 0;

    // Marge de recul amont modérée (4 heures de M1) pour amorcer l'ATR et les premiers fractals récents
    const margeReculSec = 4 * 3600;
    const tempsDebutCalculSec = Math.max(0, tempsMinChartSec - margeReculSec);

    // Filtrage chronologique : ne conserve que la fenêtre récente demandée
    const m1Filtrees: Bougie[] = [];
    for (let k = 0; k < options.donneesM1.length; k++) {
      const b = options.donneesM1[k];
      const t = typeof b.time === 'number' ? b.time : Math.floor(Date.parse(b.time as string) / 1000);
      if (t >= tempsDebutCalculSec && t <= tempsMaxSec) {
        m1Filtrees.push(b);
      }
    }

    if (m1Filtrees.length >= 20) {
      const bougiesAgregees = agregerBougies(m1Filtrees, tfSource);
      if (bougiesAgregees.length >= 20) {
        bougiesCalcul = bougiesAgregees;
        estMTFActif = true;
      }
    }
  }

  const totalCalcul = bougiesCalcul.length;

  const supprimerZonesCassees = options.supprimerZonesCassees !== false; // Défaut: true
  const afficherNonRetestees = Boolean(options.afficherNonRetestees);     // Défaut: false (Directe demande utilisateur)
  const afficherFaibles = Boolean(options.afficherFaibles);               // Défaut: false
  const minRetests = Math.max(0, options.minRetests ?? (afficherNonRetestees ? 0 : 1));
  const periodeATR = options.periodeATR ?? 7;
  const zoneFuzzFactor = options.zoneFuzzFactor ?? 0.75;
  const zoneExtend = options.zoneExtend !== false;                       // Défaut: true
  const fastFactor = Math.max(2, Math.round(options.fractalFastFactor ?? 3.0));
  const slowFactor = Math.max(3, Math.round(options.fractalSlowFactor ?? 6.0));
  const minBougiesEntreTouches = options.minBougiesEntreRetests ?? 6;
  // Respecte la limite de bougies récentes : pas d'analyse qui remonte trop loin dans le passé
  const maxHistorique = estMTFActif ? totalCalcul : maxHistoriqueDemande;
  const zoneMerge = options.zoneMerge !== false;                         // Défaut: true
  const afficherZones = options.afficherZones !== false;
  const afficherLignes = options.afficherLignes !== false;
  const afficherEtiquettes = options.afficherEtiquettes !== false;

  // 2️⃣ Calcul des valeurs d'ATR sur l'historique
  const tableauATR = calculerATR(bougiesCalcul, periodeATR);

  // Bornes d'analyse
  const indexDebut = Math.max(slowFactor, totalCalcul - maxHistorique);
  const indexFin = totalCalcul - fastFactor - 1;

  // Liste temporaire des zones candidates identifiées
  const zonesCandidates: ZoneShved[] = [];

  // Horodatage de fin par défaut (dernière bougie du graphique visible)
  const dateFinDefaut = bougies[bougies.length - 1].time;

  // 3️⃣ Balayage chronologique de l'historique (du plus ancien au plus récent)
  for (let i = indexDebut; i <= indexFin; i++) {
    const atr = tableauATR[i] || Math.max(0.0001, bougiesCalcul[i].high - bougiesCalcul[i].low);
    const fu = (atr / 2) * zoneFuzzFactor;

    const estFastHaut = estFractalHaut(bougiesCalcul, i, fastFactor);
    const estFastBas = estFractalBas(bougiesCalcul, i, fastFactor);

    // ─── 🟥 CAS 1 : Détection d'un Sommet (Résistance / Supply / BSL) ───
    if (estFastHaut) {
      const estSlowHaut = estFractalHaut(bougiesCalcul, i, slowFactor);
      const estFaible = !estSlowHaut;

      // Calcul des bornes de zone selon la formule de Shved
      let hival = bougiesCalcul[i].high;
      if (zoneExtend) hival += fu;
      const loval = Math.max(
        Math.min(bougiesCalcul[i].close, bougiesCalcul[i].high - fu),
        bougiesCalcul[i].high - fu * 2
      );

      let testCount = 0;
      let estCassee = false;
      let indexDerniereTouche = i;
      let indexCassure = totalCalcul - 1;
      let dateFin: number | string = dateFinDefaut;
      const datesTouches: (number | string)[] = [];

      // Évolution temporelle de la zone depuis sa création jusqu'au présent
      for (let k = i + 1; k < totalCalcul; k++) {
        const b = bougiesCalcul[k];

        // A. Vérification de retest dans la zone
        if (b.high >= loval && b.low <= hival) {
          if (k - indexDerniereTouche >= minBougiesEntreTouches) {
            testCount++;
            indexDerniereTouche = k;
            datesTouches.push(b.time); // On mémorise QUAND le retest a eu lieu
          }
        }

        // B. Vérification de cassure (Breakout)
        // Si une bougie clôture au-dessus de la borne haute, la résistance est cassée
        if (b.close > hival) {
          estCassee = true;
          indexCassure = k;
          dateFin = b.time;
          break; // La zone s'arrête ici !
        }
      }

      // Évaluation de la force
      let force: ForceZoneShved = 'UNTESTED';
      if (testCount > 3) force = 'PROVEN';
      else if (testCount >= 1) force = 'VERIFIED';
      else if (estFaible) force = 'WEAK';

      // Application des règles de filtrage :
      // 1. Si la zone est cassée et que l'utilisateur veut retirer les cassées -> Ignorer
      if (estCassee && supprimerZonesCassees) continue;
      // 2. Si la zone est non retestée et que afficherNonRetestees est false -> Ignorer
      if (testCount === 0 && !afficherNonRetestees) continue;
      // 3. Si la zone est faible et qu'on ne veut pas les faibles -> Ignorer
      if (estFaible && !afficherFaibles) continue;
      // 4. Nombre de retests insuffisant -> Ignorer
      if (testCount < minRetests) continue;

      zonesCandidates.push({
        id: `shved-res-${i}`,
        type: 'RESISTANCE',
        prixHaut: hival,
        prixBas: loval,
        prixMedian: (hival + loval) / 2,
        retests: testCount,
        force,
        estFaible,
        estCassee,
        indexOrigine: i,
        dateDebut: bougiesCalcul[i].time,
        dateFin,
        indexCassure: estCassee ? indexCassure : undefined,
        datesTouches,
      });
    }

    // ─── 🟩 CAS 2 : Détection d'un Creux (Support / Demand / SSL) ───────
    if (estFastBas) {
      const estSlowBas = estFractalBas(bougiesCalcul, i, slowFactor);
      const estFaible = !estSlowBas;

      // Calcul des bornes de zone selon la formule de Shved
      let loval = bougiesCalcul[i].low;
      if (zoneExtend) loval -= fu;
      const hival = Math.min(
        Math.max(bougiesCalcul[i].close, bougiesCalcul[i].low + fu),
        bougiesCalcul[i].low + fu * 2
      );

      let testCount = 0;
      let estCassee = false;
      let indexDerniereTouche = i;
      let indexCassure = totalCalcul - 1;
      let dateFin: number | string = dateFinDefaut;
      const datesTouches: (number | string)[] = [];

      // Évolution temporelle de la zone
      for (let k = i + 1; k < totalCalcul; k++) {
        const b = bougiesCalcul[k];

        // A. Vérification de retest dans la zone
        if (b.low <= hival && b.high >= loval) {
          if (k - indexDerniereTouche >= minBougiesEntreTouches) {
            testCount++;
            indexDerniereTouche = k;
            datesTouches.push(b.time); // On mémorise QUAND le retest a eu lieu
          }
        }

        // B. Vérification de cassure
        // Si une bougie clôture sous la borne basse, le support est brisé
        if (b.close < loval) {
          estCassee = true;
          indexCassure = k;
          dateFin = b.time;
          break; // La zone s'arrête ici !
        }
      }

      // Évaluation de la force
      let force: ForceZoneShved = 'UNTESTED';
      if (testCount > 3) force = 'PROVEN';
      else if (testCount >= 1) force = 'VERIFIED';
      else if (estFaible) force = 'WEAK';

      // Application des règles de filtrage
      if (estCassee && supprimerZonesCassees) continue;
      if (testCount === 0 && !afficherNonRetestees) continue;
      if (estFaible && !afficherFaibles) continue;
      if (testCount < minRetests) continue;

      zonesCandidates.push({
        id: `shved-sup-${i}`,
        type: 'SUPPORT',
        prixHaut: hival,
        prixBas: loval,
        prixMedian: (hival + loval) / 2,
        retests: testCount,
        force,
        estFaible,
        estCassee,
        indexOrigine: i,
        dateDebut: bougiesCalcul[i].time,
        dateFin,
        indexCassure: estCassee ? indexCassure : undefined,
        datesTouches,
      });
    }
  }

  // 4️⃣ Fusion des zones qui se chevauchent (Zone Merge)
  let zonesFinales: ZoneShved[] = zonesCandidates;

  if (zoneMerge && zonesCandidates.length > 1) {
    const fusionnees: ZoneShved[] = [];
    const traitees = new Set<string>();

    for (let a = 0; a < zonesCandidates.length; a++) {
      const zA = zonesCandidates[a];
      if (traitees.has(zA.id)) continue;

      let prixHautFusion = zA.prixHaut;
      let prixBasFusion = zA.prixBas;
      let totalRetests = zA.retests;
      let dateDebutFusion = zA.dateDebut;
      let forceFusion = zA.force;
      let estCasseeFusion = zA.estCassee;
      let dateFinFusion = zA.dateFin;
      let indexCassureFusion = zA.indexCassure;
      const datesTouchesFusion: (number | string)[] = [...(zA.datesTouches || [])];
      traitees.add(zA.id);

      for (let b = a + 1; b < zonesCandidates.length; b++) {
        const zB = zonesCandidates[b];
        if (traitees.has(zB.id) || zA.type !== zB.type) continue;

        // Condition de superposition des deux bandes de prix
        const chevauchement =
          (prixHautFusion >= zB.prixBas && prixHautFusion <= zB.prixHaut) ||
          (prixBasFusion <= zB.prixHaut && prixBasFusion >= zB.prixBas) ||
          (zB.prixHaut >= prixBasFusion && zB.prixHaut <= prixHautFusion) ||
          (zB.prixBas <= prixHautFusion && zB.prixBas >= prixBasFusion);

        if (chevauchement) {
          prixHautFusion = Math.max(prixHautFusion, zB.prixHaut);
          prixBasFusion = Math.min(prixBasFusion, zB.prixBas);
          totalRetests += zB.retests;
          datesTouchesFusion.push(...(zB.datesTouches || []));
          if (zB.estCassee) {
            estCasseeFusion = true;
            dateFinFusion = zB.dateFin;
            indexCassureFusion = zB.indexCassure;
          }
          traitees.add(zB.id);

          if (totalRetests > 3) forceFusion = 'PROVEN';
          else if (totalRetests >= 1) forceFusion = 'VERIFIED';
        }
      }

      fusionnees.push({
        ...zA,
        prixHaut: prixHautFusion,
        prixBas: prixBasFusion,
        prixMedian: (prixHautFusion + prixBasFusion) / 2,
        retests: totalRetests,
        force: forceFusion,
        dateDebut: dateDebutFusion,
        dateFin: dateFinFusion,
        estCassee: estCasseeFusion,
        indexCassure: indexCassureFusion,
        datesTouches: datesTouchesFusion,
      });
    }
    zonesFinales = fusionnees;
  }

  // 5️⃣ Séparation Supports et Résistances et recherche des zones les plus proches
  const supports: ZoneShved[] = [];
  const resistances: ZoneShved[] = [];
  const dernierPrix = bougies[total - 1].close;

  let nearestSupport: ZoneShved | null = null;
  let nearestResistance: ZoneShved | null = null;
  let distanceMinSup = Infinity;
  let distanceMinRes = Infinity;

  for (const z of zonesFinales) {
    if (z.type === 'SUPPORT') {
      supports.push(z);
      if (dernierPrix >= z.prixBas) {
        const dist = Math.abs(dernierPrix - z.prixMedian);
        if (dist < distanceMinSup) {
          distanceMinSup = dist;
          nearestSupport = z;
        }
      }
    } else {
      resistances.push(z);
      if (dernierPrix <= z.prixHaut) {
        const dist = Math.abs(z.prixMedian - dernierPrix);
        if (dist < distanceMinRes) {
          distanceMinRes = dist;
          nearestResistance = z;
        }
      }
    }
  }

  // 6️⃣ Génération des Primitives Graphiques pour le Canvas de l'Application
  const chartTf = options.chartTimeframe || '';
  const estHTF = estMTFActif || chartTf === 'H1' || chartTf === 'H4' || chartTf === 'D1' || chartTf === 'W1';

  for (const z of zonesFinales) {
    const estSup = z.type === 'SUPPORT';
    
    // Définition de la palette de couleurs
    const couleurBordure = estSup ? '#10b981' : '#ef4444'; // Vert émeraude vs Rouge corail
    const couleurFond = estSup
      ? (z.force === 'PROVEN' ? 'rgba(16, 185, 129, 0.22)' : 'rgba(16, 185, 129, 0.12)')
      : (z.force === 'PROVEN' ? 'rgba(239, 68, 68, 0.22)' : 'rgba(239, 68, 68, 0.12)');

    const badgeForce = z.force === 'PROVEN' ? '⭐ Prouvé' : z.force === 'VERIFIED' ? '✓ Vérifié' : '⏳ Non retesté';
    const tagType = estSup ? '🛡️ SSL Demand' : '🧱 BSL Supply';
    const suffixeTf = estMTFActif ? ` [${tfSource}]` : (chartTf ? ` [${chartTf}]` : '');
    const texteLabel = `${tagType}${suffixeTf} [${z.retests}x] (${badgeForce})`;

    // 📦 Rectangle de Zone : UNIQUEMENT EN LOWER TIMEFRAME (M1, M5, M15, M30 sans MTF)
    // En Higher Timeframe (H1, H4, D1 ou MTF), l'utilisateur a expressément demandé de NE PAS mettre de rectangles entiers,
    // mais d'afficher uniquement des lignes nettes pour ne pas encombrer le graphique HTF.
    if (afficherZones && !estHTF) {
      boites.push({
        id: `box-${z.id}`,
        prixHaut: z.prixHaut,
        prixBas: z.prixBas,
        dateDebut: z.dateDebut,
        dateFin: z.dateFin,
        couleurFond,
        couleurBordure,
        label: texteLabel,
      });
    }

    // 📏 Ligne de Niveau de Liquidité : TOUJOURS AFFICHÉE (et seule en mode HTF / MTF)
    if (afficherLignes || estHTF) {
      const labelLigne = estHTF
        ? `${estSup ? '🟢 SUP' : '🔴 RES'}${suffixeTf} ${z.prixMedian.toFixed(5)} (${z.retests}t)`
        : `${estSup ? 'Support' : 'Résistance'} (${z.prixMedian.toFixed(4)})`;

      lignes.push({
        id: `line-${z.id}`,
        prix: z.prixMedian,
        dateDebut: z.dateDebut,
        dateFin: estHTF ? dateFinDefaut : z.dateFin,
        couleur: couleurBordure,
        epaisseur: estHTF ? 2 : 1.5,
        style: z.force === 'PROVEN' ? 'solid' : 'dashed',
        label: labelLigne,
      });
    }

    // 🏷️ Badge d'information (uniquement en mode LTF pour éviter la surcharge visuelle en HTF)
    if (afficherEtiquettes && !estHTF) {
      labels.push({
        id: `lbl-${z.id}`,
        prix: estSup ? z.prixBas : z.prixHaut,
        date: z.dateDebut,
        texte: texteLabel,
        couleur: couleurBordure,
        position: estSup ? 'below' : 'above',
      });
    }
  }

  return {
    supports,
    resistances,
    totalZones: zonesFinales.length,
    nearestSupport,
    nearestResistance,
    primitives: {
      boites,
      lignes,
      labels,
    },
  };
}
