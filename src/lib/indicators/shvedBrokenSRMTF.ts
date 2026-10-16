import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLine, VisualLabel } from '@/types/indicatorScript';
import {
  calculerShvedSupplyDemand,
  type ZoneShved,
} from '@/lib/bot/modules/01_liquidite/shvedSupplyDemand';

/**
 * ==============================================================================
 * 📋 GUIDE DU DÉVELOPPEUR : CONDITIONS DU SETUP & RÈGLES DE MODIFICATION
 * ==============================================================================
 * Cet indicateur détecte et projette en Multi-Timeframe (MTF) les supports et
 * résistances institutionnels Shved (Supply & Demand).
 *
 * 🎯 LES 5 RÈGLES DE DÉTECTION & DE MODIFICATION POUR DÉVELOPPEUR JUNIOR :
 *
 * ─── RÈGLE 1 : Sommets & Creux Fractals ───────────────────────────────────────
 *  • Les niveaux naissent sur des fractals rapides (`fractalFastFactor: 3`)
 *    ou lents / majeurs (`fractalSlowFactor: 6`).
 *  • Option `afficherFaibles`: autorise ou masque les niveaux issus de fractals mineurs.
 *
 * ─── RÈGLE 2 : Épaisseur de Zone & Tolérance ATR ──────────────────────────────
 *  • Dimensionné par un ATR (`periodeATR: 15`).
 *  • L'épaisseur de la zone dépend de `zoneFuzzFactor` (défaut: 0.1 = niveau très fin).
 *  👉 Pour élargir les zones : augmenter `zoneFuzzFactor` à 0.5 ou 0.75.
 *
 * ─── RÈGLE 3 : Retests Minima (Pas de niveau vierge) ──────────────────────────
 *  • Seuls les niveaux ayant au moins `minRetests` (défaut: 1) sont conservés.
 *  👉 Pour afficher aussi les zones dès leur création : mettre `minRetests: 0`.
 *  👉 Pour n'avoir que des niveaux historiques majeurs : mettre `minRetests: 3`.
 *
 * ─── RÈGLE 4 : Classement Actif vs Cassé ──────────────────────────────────────
 *  • NIVEAU ACTIF  : Aucune clôture de bougie au-delà -> Tracé en trait CONTINU (`solid`).
 *  • NIVEAU CASSÉ  : Une bougie a clôturé au-delà       -> Tracé en trait DISCONTINU (`dashed`).
 *  👉 Options : `afficherNonCasses: true` et `afficherCasses: true`.
 *
 * ─── RÈGLE 5 : Récence & Performance ──────────────────────────────────────────
 *  • Le scan ne remonte qu'aux `maxLookbackBars` dernières bougies (défaut: 200).
 *  👉 Réduire à 100 pour cibler l'action récente, ou augmenter à 500 pour plus de recul.
 * ==============================================================================
 */

// ─── 📊 Types et Structures de Données ────────────────────────────────────────

/**
 * Options de configuration pour l'indicateur Shved S/R (Actifs + Cassés) MTF :
 * Affiche les Supports et Résistances Shved retestés au moins une fois :
 *  - les niveaux ACTIFS (jamais clôturés au-delà) en trait CONTINU
 *  - les niveaux CASSÉS (clôture au-delà) en trait DISCONTINU
 * Calculés sur une timeframe inférieure (ex: M15) et projetés sur le graphique actuel (ex: H4).
 */
export interface OptionsShvedBrokenSRMTF {
  // ─── ⏱️ Multi-Timeframe (MTF) ───
  // Unité de temps analysée pour détecter les S/R (défaut: 'M15')
  timeframeSource?: string;
  // Données brutes M1 transmises pour l'agrégation MTF
  donneesM1?: Bougie[];
  // Unité de temps du graphique d'affichage (ex: 'H4')
  chartTimeframe?: string;

  // ─── 🎯 Filtrage des Niveaux ───
  // Nombre minimum de retests requis (défaut: 1 → jamais de niveau vierge)
  minRetests?: number;
  // Afficher les niveaux encore actifs / non cassés (défaut: true)
  afficherNonCasses?: boolean;
  // Afficher les niveaux cassés (défaut: true)
  afficherCasses?: boolean;
  // Afficher également les zones issues de fractals faibles (défaut: false)
  afficherFaibles?: boolean;
  // Prolonger les niveaux CASSÉS jusqu'à la dernière bougie (défaut: false → ils s'arrêtent à la cassure)
  // Les niveaux actifs, eux, vont toujours jusqu'à la bougie courante.
  prolongerVersLePresent?: boolean;

  // ─── 📐 Paramètres Shved ───
  periodeATR?: number;            // Période de l'ATR (défaut: 15)
  zoneFuzzFactor?: number;        // Épaisseur de zone (défaut: 0.1 → niveaux très fins)
  maxLookbackBars?: number;       // Historique scanné en bougies récentes (défaut: 200)

  // ─── 🎨 Affichage Visuel ───
  // Afficher les étiquettes de prix discrètes (défaut: false pour un graphique épuré)
  afficherEtiquettes?: boolean;
  bullColor?: string;             // Couleur des supports (défaut: #10b981)
  bearColor?: string;             // Couleur des résistances (défaut: #ef4444)
}

/**
 * Représente un Support ou une Résistance Shved retenu (actif ou cassé)
 */
export interface BrokenSRNiveau {
  id: string;
  type: 'SUPPORT_CASSE' | 'RESISTANCE_CASSEE' | 'SUPPORT_ACTIF' | 'RESISTANCE_ACTIVE';
  estCasse: boolean;
  prixMedian: number;
  prixHaut: number;
  prixBas: number;
  retests: number;
  dateDebut: number | string;
  // Date de cassure si le niveau est cassé, sinon date de la dernière bougie
  dateCassure: number | string;
  timeframeSource: string;
  zoneOrigine: ZoneShved;
}

/**
 * Résultat retourné par l'indicateur
 */
export interface ResultatShvedBrokenSRMTF {
  supportsCasses: BrokenSRNiveau[];
  resistancesCassees: BrokenSRNiveau[];
  supportsActifs: BrokenSRNiveau[];
  resistancesActives: BrokenSRNiveau[];
  totalNiveauxCasses: number;
  totalNiveauxActifs: number;
  primitives: VisualPrimitives;
  timeframeSource: string;
}

// ─── 🚀 Fonction Principale de Calcul ────────────────────────────────────────

/**
 * Calcule les supports et résistances Shved retestés au moins une fois,
 * et les classe en deux familles : ACTIFS (trait continu) et CASSÉS (trait discontinu).
 * Aucune zone rectangulaire, aucun texte encombrant.
 *
 * Exemple :
 * const res = calculerShvedBrokenSRMTF(bougiesH4, {
 *   timeframeSource: 'M15',
 *   donneesM1: bougiesM1,
 *   periodeATR: 15,
 *   zoneFuzzFactor: 0.1,
 * });
 * console.log(res.totalNiveauxActifs, res.totalNiveauxCasses);
 */
export function calculerShvedBrokenSRMTF(
  bougies: Bougie[],
  options: OptionsShvedBrokenSRMTF = {}
): ResultatShvedBrokenSRMTF {
  // Primitives visuelles : AUCUNE boîte rectangulaire, uniquement des segments
  const lignes: VisualLine[] = [];
  const labels: VisualLabel[] = [];

  const tfSource = options.timeframeSource || 'M15';

  if (!bougies || bougies.length < 5) {
    return {
      supportsCasses: [],
      resistancesCassees: [],
      supportsActifs: [],
      resistancesActives: [],
      totalNiveauxCasses: 0,
      totalNiveauxActifs: 0,
      primitives: { lignes, labels, boites: [], points: [] },
      timeframeSource: tfSource,
    };
  }

  // 1️⃣ Extraction des paramètres
  const minRetests = Math.max(1, Number(options.minRetests ?? 1));
  const afficherNonCasses = options.afficherNonCasses !== false;
  const afficherCasses = options.afficherCasses !== false;
  const afficherFaibles = Boolean(options.afficherFaibles);
  const prolongerCasses = Boolean(options.prolongerVersLePresent);
  const afficherEtiquettes = Boolean(options.afficherEtiquettes); // Désactivé par défaut (graphique épuré)
  const bullColor = options.bullColor || '#10b981';
  const bearColor = options.bearColor || '#ef4444';

  const derniereBougie = bougies[bougies.length - 1];
  const dateDerniereBougie = derniereBougie ? derniereBougie.time : 0;

  // 2️⃣ Appel du moteur Shved en conservant TOUTES les zones (actives + cassées)
  // zoneMerge: false → chaque niveau garde son propre état (actif/cassé) et son propre historique de retests
  const resultatShved = calculerShvedSupplyDemand(bougies, {
    timeframeSource: tfSource,
    donneesM1: options.donneesM1,
    chartTimeframe: options.chartTimeframe,
    supprimerZonesCassees: false,  // On garde les zones cassées
    afficherNonRetestees: true,    // On filtre nous-mêmes sur minRetests
    afficherFaibles: true,         // On filtre nous-mêmes sur afficherFaibles
    minRetests: 0,
    periodeATR: options.periodeATR ?? 15,
    zoneFuzzFactor: options.zoneFuzzFactor ?? 0.1,
    maxLookbackBars: options.maxLookbackBars ?? 200,
    afficherZones: false,
    afficherLignes: false,
    afficherEtiquettes: false,
  });

  const toutesLesZones: ZoneShved[] = [
    ...resultatShved.supports,
    ...resultatShved.resistances,
  ];

  const supportsCasses: BrokenSRNiveau[] = [];
  const resistancesCassees: BrokenSRNiveau[] = [];
  const supportsActifs: BrokenSRNiveau[] = [];
  const resistancesActives: BrokenSRNiveau[] = [];

  // 3️⃣ Filtrage et classement de chaque zone
  for (const zone of toutesLesZones) {
    // ─── 🔍 RÈGLE 3 : Exigence de retests (élimine les niveaux vierges sans liquidité) ───
    if (zone.retests < minRetests) continue;

    // ─── 🔍 RÈGLE 1 : Filtrage des fractals faibles (masque le bruit mineur si désactivé) ───
    if (zone.estFaible && !afficherFaibles) continue;

    // ─── 🔍 RÈGLE 4 : Tri selon le statut Actif vs Cassé ───
    const estCasse = zone.estCassee;
    if (estCasse && !afficherCasses) continue;
    if (!estCasse && !afficherNonCasses) continue;

    const estSupport = zone.type === 'SUPPORT';

    let typeNiveau: BrokenSRNiveau['type'];
    if (estSupport) {
      typeNiveau = estCasse ? 'SUPPORT_CASSE' : 'SUPPORT_ACTIF';
    } else {
      typeNiveau = estCasse ? 'RESISTANCE_CASSEE' : 'RESISTANCE_ACTIVE';
    }

    const niveau: BrokenSRNiveau = {
      id: `sr-${zone.id}`,
      type: typeNiveau,
      estCasse,
      prixMedian: zone.prixMedian,
      prixHaut: zone.prixHaut,
      prixBas: zone.prixBas,
      retests: zone.retests,
      dateDebut: zone.dateDebut,
      dateCassure: zone.dateFin,
      timeframeSource: tfSource,
      zoneOrigine: zone,
    };

    // Rangement dans la bonne liste
    if (estSupport && estCasse) supportsCasses.push(niveau);
    if (estSupport && !estCasse) supportsActifs.push(niveau);
    if (!estSupport && estCasse) resistancesCassees.push(niveau);
    if (!estSupport && !estCasse) resistancesActives.push(niveau);

    // 4️⃣ Segment horizontal épuré (sans texte)
    // - Actif  : trait CONTINU jusqu'à la bougie courante (liquidité encore disponible)
    // - Cassé  : trait DISCONTINU jusqu'à la cassure (ou jusqu'au présent si option activée)
    const couleur = estSupport ? bullColor : bearColor;
    let dateFinSegment: number | string = dateDerniereBougie;
    if (estCasse && !prolongerCasses) {
      dateFinSegment = zone.dateFin;
    }

    lignes.push({
      id: `sr-line-${zone.id}`,
      prix: zone.prixMedian,
      dateDebut: zone.dateDebut,
      dateFin: dateFinSegment,
      couleur,
      epaisseur: estCasse ? 1.5 : 1.8,
      style: estCasse ? 'dashed' : 'solid',
    });

    // 5️⃣ Étiquette facultative (désactivée par défaut) : uniquement le prix
    if (afficherEtiquettes) {
      labels.push({
        id: `sr-lbl-${zone.id}`,
        prix: zone.prixMedian,
        date: dateFinSegment,
        texte: zone.prixMedian.toFixed(5),
        couleur,
        position: estSupport ? 'below' : 'above',
      });
    }
  }

  return {
    supportsCasses,
    resistancesCassees,
    supportsActifs,
    resistancesActives,
    totalNiveauxCasses: supportsCasses.length + resistancesCassees.length,
    totalNiveauxActifs: supportsActifs.length + resistancesActives.length,
    primitives: {
      lignes,
      labels,
      boites: [], // AUCUNE zone rectangulaire
      points: [],
    },
    timeframeSource: tfSource,
  };
}
