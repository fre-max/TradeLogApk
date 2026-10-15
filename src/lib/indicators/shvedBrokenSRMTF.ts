import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLine, VisualLabel } from '@/types/indicatorScript';
import {
  calculerShvedSupplyDemand,
  type ZoneShved,
} from '@/lib/bot/modules/01_liquidite/shvedSupplyDemand';

// ─── 📊 Types et Structures de Données ────────────────────────────────────────

/**
 * Options de configuration pour l'indicateur Shved Broken S/R MTF :
 * Détecte spécifiquement les Supports et Résistances CASSÉS ayant été retestés au moins une fois,
 * calculés sur une timeframe inférieure (ex: M15) et projetés en segments discontinus (dashed).
 */
export interface OptionsShvedBrokenSRMTF {
  // ─── ⏱️ Multi-Timeframe (MTF) ───
  // Unité de temps analysée pour détecter les S/R (défaut: 'M15')
  timeframeSource?: string;
  // Données brutes M1 transmises pour l'agrégation MTF
  donneesM1?: Bougie[];
  // Unité de temps du graphique d'affichage (ex: 'H4')
  chartTimeframe?: string;

  // ─── 🎯 Filtrage des Niveaux Cassés ───
  // Nombre minimum de retests requis avant la cassure (défaut: 1 pour exiger au moins 1 retest)
  minRetests?: number;
  // Afficher également les zones issues de fractals faibles (défaut: false)
  afficherFaibles?: boolean;
  // Prolonger le segment discontinu jusqu'à la dernière bougie actuelle (défaut: true)
  prolongerVersLePresent?: boolean;

  // ─── 📐 Paramètres Shved ───
  periodeATR?: number;            // Période de l'ATR (défaut: 7)
  zoneFuzzFactor?: number;        // Épaisseur de zone (défaut: 0.75)
  maxLookbackBars?: number;       // Historique scanné (défaut: 800)

  // ─── 🎨 Affichage Visuel ───
  // Afficher les étiquettes de prix discrètes (défaut: false pour un graphique épuré)
  afficherEtiquettes?: boolean;
  bullColor?: string;             // Couleur pour Support cassé (défaut: #10b981)
  bearColor?: string;             // Couleur pour Résistance cassée (défaut: #ef4444)
}

/**
 * Représente un Support ou une Résistance Shved cassé retenu
 */
export interface BrokenSRNiveau {
  id: string;
  type: 'SUPPORT_CASSE' | 'RESISTANCE_CASSEE';
  prixMedian: number;
  prixHaut: number;
  prixBas: number;
  retests: number;
  dateDebut: number | string;
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
  totalNiveauxCasses: number;
  primitives: VisualPrimitives;
  timeframeSource: string;
}

// ─── 🚀 Fonction Principale de Calcul ────────────────────────────────────────

/**
 * Calcule les supports et résistances Shved qui ont été CASSÉS après avoir été retestés au moins une fois.
 * Affiche uniquement des segments en trait discontinu (dashed) sans aucune zone rectangulaire.
 * 
 * Exemple :
 * const res = calculerShvedBrokenSRMTF(bougiesH4, {
 *   timeframeSource: 'M15',
 *   donneesM1: bougiesM1,
 *   minRetests: 1,
 *   prolongerVersLePresent: true
 * });
 */
export function calculerShvedBrokenSRMTF(
  bougies: Bougie[],
  options: OptionsShvedBrokenSRMTF = {}
): ResultatShvedBrokenSRMTF {
  // Primitives visuelles : AUCUNE boîte rectangulaire, uniquement des segments discontinus et étiquettes
  const lignes: VisualLine[] = [];
  const labels: VisualLabel[] = [];

  const defResultat: ResultatShvedBrokenSRMTF = {
    supportsCasses: [],
    resistancesCassees: [],
    totalNiveauxCasses: 0,
    primitives: { lignes, labels, boites: [], points: [] },
    timeframeSource: options.timeframeSource || 'M15',
  };

  if (!bougies || bougies.length < 5) {
    return defResultat;
  }

  // 1️⃣ Extraction des paramètres
  const tfSource = options.timeframeSource || 'M15';
  const minRetests = Math.max(1, Number(options.minRetests ?? 1));
  const afficherFaibles = Boolean(options.afficherFaibles);
  const prolongerVersLePresent = options.prolongerVersLePresent !== false;
  const afficherEtiquettes = Boolean(options.afficherEtiquettes); // Désactivé par défaut pour un graphique épuré sans texte
  const bullColor = options.bullColor || '#10b981';
  const bearColor = options.bearColor || '#ef4444';

  const derniereBougie = bougies[bougies.length - 1];
  const dateDerniereBougie = derniereBougie ? derniereBougie.time : 0;

  // 2️⃣ Appel du moteur Shved en conservant impérativement toutes les zones cassées
  // et en activant le mode Multi-Timeframe si des données M1 sont disponibles
  const resultatShved = calculerShvedSupplyDemand(bougies, {
    timeframeSource: tfSource,
    donneesM1: options.donneesM1,
    chartTimeframe: options.chartTimeframe,
    supprimerZonesCassees: false,  // CRUCIAL : on veut récupérer les zones cassées !
    afficherNonRetestees: true,    // On filtre nous-mêmes sur minRetests
    afficherFaibles: true,
    minRetests: 0,
    periodeATR: options.periodeATR ?? 7,
    zoneFuzzFactor: options.zoneFuzzFactor ?? 0.75,
    maxLookbackBars: options.maxLookbackBars ?? 800,
    afficherZones: false,          // Pas de boîtes Shved par défaut
    afficherLignes: false,
    afficherEtiquettes: false,
  });

  const toutesLesZones: ZoneShved[] = [
    ...resultatShved.supports,
    ...resultatShved.resistances,
  ];

  const supportsCasses: BrokenSRNiveau[] = [];
  const resistancesCassees: BrokenSRNiveau[] = [];

  // 3️⃣ Filtrage strict des zones cassées et retestées au moins 1 fois
  for (const zone of toutesLesZones) {
    // Règle 1 : La zone doit obligatoirement avoir été CASSÉE
    if (!zone.estCassee) continue;

    // Règle 2 : La zone doit avoir été retestée au moins 'minRetests' fois (défaut: 1)
    if (zone.retests < minRetests) continue;

    // Règle 3 : Filtrer les fractals faibles si désactivés
    if (zone.estFaible && !afficherFaibles) continue;

    const estSupport = zone.type === 'SUPPORT';
    const typeNiveau: 'SUPPORT_CASSE' | 'RESISTANCE_CASSEE' = estSupport
      ? 'SUPPORT_CASSE'
      : 'RESISTANCE_CASSEE';

    const brokenItem: BrokenSRNiveau = {
      id: `broken-${zone.id}`,
      type: typeNiveau,
      prixMedian: zone.prixMedian,
      prixHaut: zone.prixHaut,
      prixBas: zone.prixBas,
      retests: zone.retests,
      dateDebut: zone.dateDebut,
      dateCassure: zone.dateFin,
      timeframeSource: tfSource,
      zoneOrigine: zone,
    };

    if (estSupport) {
      supportsCasses.push(brokenItem);
    } else {
      resistancesCassees.push(brokenItem);
    }

    // 4️⃣ Génération du Segment en Ligne Discontinue (Dashed) épuré
    // Conformément à la demande utilisateur, suppression des textes encombrants comme "résistance cassée M15"
    const couleur = estSupport ? bullColor : bearColor;
    const dateFinSegment = prolongerVersLePresent ? dateDerniereBougie : zone.dateFin;

    lignes.push({
      id: `broken-line-${zone.id}`,
      prix: zone.prixMedian,
      dateDebut: zone.dateDebut,
      dateFin: dateFinSegment,
      couleur,
      epaisseur: 1.8,
      style: 'dashed', // Segment en trait discontinu épuré
    });

    // 5️⃣ Étiquette textuelle facultative (désactivée par défaut) : affiche uniquement le prix numérique
    if (afficherEtiquettes) {
      labels.push({
        id: `broken-lbl-${zone.id}`,
        prix: zone.prixMedian,
        date: zone.dateFin,
        texte: zone.prixMedian.toFixed(5),
        couleur,
        position: estSupport ? 'below' : 'above',
      });
    }
  }

  return {
    supportsCasses,
    resistancesCassees,
    totalNiveauxCasses: supportsCasses.length + resistancesCassees.length,
    primitives: {
      lignes,
      labels,
      boites: [], // AUCUNE zone rectangulaire n'est générée
      points: [],
    },
    timeframeSource: tfSource,
  };
}
