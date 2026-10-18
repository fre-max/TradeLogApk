import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLabel, VisualLine } from '@/types/indicatorScript';
import {
  calculerShvedSupplyDemand,
  type ZoneShved,
} from '@/lib/bot/modules/01_liquidite/shvedSupplyDemand';
import { calculerLiquidationReintegration } from './liquidationReintegration';

/**
 * ==============================================================================
 * 📋 GUIDE DU DÉVELOPPEUR : CONDITIONS DU SETUP & RÈGLES DE MODIFICATION
 * ==============================================================================
 * Cet indicateur combine deux analyses complémentaires :
 *  1. Le chandelier "Doji personnalisé" (Liquidation & Réintégration = Spring / UTAD)
 *  2. Les niveaux institutionnels "Shved Supply & Demand" (Supports / Résistances)
 *
 * 🎯 OÙ TROUVER ET MODIFIER LE CODE DES CONDITIONS ?
 *  👉 TOUTES les conditions Shved sont rassemblées dans une seule fonction booléenne :
 *     `validerSetupNiveauShved(params): boolean` (vers la ligne 190).
 *     Ouvrez cette fonction pour activer/désactiver/ajuster n'importe quelle règle !
 *
 * 🎯 POUR QU'UN SETUP COMPLET (COMBO) SOIT VALIDÉ, IL DOIT RESPECTER LES CONDITIONS :
 *
 * ─── CONDITION 1 : Formation du Doji Personnalisé (2 bougies consécutives) ────
 *  • Gérée par `calculerLiquidationReintegration()` dans `liquidationReintegration.ts`.
 *  • Bougie 1 (Liquidation) : Bougie impulsive dans le sens du piège.
 *  • Bougie 2 (Réintégration) : Bougie impulsive de retournement en sens inverse.
 *  • Clôture de la Bougie 2 : Doit revenir au niveau d'ouverture de la Bougie 1.
 *
 * ─── CONDITION 2 : Balayage du Niveau Shved par la Mèche (dans validerSetupNiveauShved) ───
 *  • Pour un Achat (Spring) : La mèche basse extrême (min(Low1, Low2)) doit plonger
 *    sous le support Shved, ET la clôture de la Bougie 2 doit revenir au-dessus.
 *  • Pour une Vente (UTAD)  : La mèche haute extrême (max(High1, High2)) doit percer
 *    au-dessus de la résistance Shved, ET la clôture de la Bougie 2 doit revenir en dessous.
 *
 * ─── CONDITION 3 : Intégrité du Niveau Shved (dans validerSetupNiveauShved) ────
 *  • Le niveau de liquidité devait être intact à l'arrivée du Doji (non cassé avant).
 *
 * ─── CONDITION 4 : Fraîcheur & Âge Récent du Niveau (dans validerSetupNiveauShved) ──
 *  • Le niveau ne doit pas avoir été créé trop loin dans le passé (`lookbackMaxBarsAvantPattern`).
 *
 * ─── CONDITION 5 : Retests Minima du Niveau AVANT le Doji (dans validerSetupNiveauShved) ─
 *  • Le niveau doit avoir été retesté au moins `minRetests` fois (défaut: 1).
 *
 * ─── CONDITION 6 : Proportionnalité (Liquidation vs Montagne Shved) ─────────────
 *  • Activé si `activerFiltreProportionnalite === true` (défaut: false).
 *  • La taille de la liquidation (Bougie 1) doit être comprise entre `ratioProportionMin` (défaut: 15%)
 *    et `ratioProportionMax` (défaut: 150%) du rejet moyen de la montagne Shved.
 *
 * ─── CONDITION 7 : Score de Liquidité Minimal Requis (dans validerSetupNiveauShved) ──
 *  • Activé si `scoreMinimum > 0` (défaut: 0).
 *  • Élimine les signaux dont le score de liquidité calculé sur 100 points est inférieur au seuil.
 * ==============================================================================
 */

// ─── 📊 Types et Structures de Données ────────────────────────────────────────

/**
 * Options de l'indicateur combiné :
 * Doji personnalisé (Liq/Reint = Spring / UTAD) + niveau Shved le PLUS FORT balayé.
 */
export interface ParametresSweepNiveauShvedLePlusFort {
  // ─── ⏱️ Multi-Timeframe (MTF) ───
  timeframeSource?: string;        // Unité de temps des niveaux Shved (défaut: 'M15')
  donneesM1?: Bougie[];            // Données M1 pour l'agrégation MTF
  chartTimeframe?: string;         // Unité de temps du graphique (ex: 'H4')

  // ─── 📐 Paramètres Shved ───
  periodeATR?: number;             // défaut: 15
  zoneFuzzFactor?: number;         // défaut: 0.1
  maxLookbackBars?: number;        // Historique scanné en bougies (défaut: 200)
  // Nombre maximum de bougies entre la création du niveau et le pattern (défaut: 100, 0 = sans limite)
  lookbackMaxBarsAvantPattern?: number;
  afficherFaibles?: boolean;       // Inclure les fractals faibles (défaut: false)

  // ─── 🎯 Règles de liquidité & Score Institutionnel (0 à 100) ───
  // Nombre minimum de retests du niveau AVANT le pattern (défaut: 1 → jamais de niveau vierge)
  minRetests?: number;
  // N'afficher le pattern que s'il a balayé au moins un niveau Shved (défaut: true)
  exigerNiveauBalaye?: boolean;
  // Score de liquidité minimum requis (0 à 100, défaut: 0 = aucun filtrage par score)
  scoreMinimum?: number;

  // ─── ⚖️ Filtre de Proportionnalité (Liquidation vs Montagne Shved) ───
  // Active le filtre de proportionnalité entre la bougie 1 et la hauteur du rejet Shved (défaut: false)
  activerFiltreProportionnalite?: boolean;
  // Ratio minimum requis (Taille Bougie 1 / Rejet Moyen) (défaut: 0.15 = au moins 15% de la montagne)
  ratioProportionMin?: number;
  // Ratio maximum autorisé (Taille Bougie 1 / Rejet Moyen) (défaut: 1.50 = max 150% de la montagne)
  ratioProportionMax?: number;

  // ─── 🕯️ Paramètres du pattern (Doji personnalisé Liq/Reint) ───
  toleranceDeficit?: number;
  toleranceDepassement?: number;
  activerFiltreTaille?: boolean;
  periodeHistorique?: number;
  multiplicateurBougie1?: number;
  multiplicateurCorps2?: number;
  activerAchat?: boolean;
  activerVente?: boolean;
  activerFiltreTendance?: boolean;
  trendBars?: number;

  // ─── 🎨 Vision d'Ensemble & Affichage Épuré ───
  // Affiche le badge compact du score de liquidité sur le signal (ex: [85] ou [95 ⭐]) (défaut: true)
  afficherBadgeScore?: boolean;
  // Afficher tous les niveaux S/R Shved calculés en arrière-plan sur le graphique (défaut: true)
  afficherNiveauxShved?: boolean;
  // Afficher aussi les niveaux Shved déjà cassés en traits pointillés discrets (défaut: true)
  afficherNiveauxCasses?: boolean;
  // Afficher tous les Dojis personnalisés, même ceux sans niveau Shved balayé (défaut: true)
  afficherTousDojis?: boolean;
  // Afficher le nombre de retests du niveau le plus fort sous/au-dessus du pattern (défaut: true)
  afficherForceDansLabel?: boolean;
  // Tracer aussi (en pointillés fins) les autres niveaux balayés, moins forts (défaut: false)
  afficherAutresNiveaux?: boolean;
  bullColor?: string;
  bearColor?: string;
  texteLabel?: string;
}

/**
 * Un niveau Shved balayé par la mèche du pattern avec son évaluation de liquidité SMC
 */
export interface NiveauShvedBalaye {
  zone: ZoneShved;
  prix: number;                   // Prix du niveau (ligne médiane Shved)
  retestsAvantPattern: number;    // Retests comptés strictement AVANT la bougie 1 du pattern
  profondeur: number;             // Distance entre le niveau et l'extrême de la mèche
  scoreLiquidite: number;         // Score global de liquidité calculé sur 100 points
  pointsRetests: number;          // Points attribués aux retests (max 35)
  pointsRejets: number;           // Points attribués à la hauteur moyenne des rejets Shved (max 30)
  pointsProportionnalite: number; // Points attribués à la proportionnalité liquidation / montagne (max 25)
  pointsIntegrite: number;        // Points bonus si le niveau est resté intact (max 10)
  rejetMoyen: number;             // Hauteur moyenne des rejets en prix
  ratioProportion: number;        // Ratio Taille Bougie 1 / Rejet Moyen
  qualite: 'FAIBLE' | 'MOYENNE' | 'FORTE' | 'INSTITUTIONNELLE';
}

/**
 * Un signal du pattern accompagné de la liquidité qu'il a récupérée
 */
export interface SignalSweepNiveauShvedLePlusFort {
  type: 'ACHAT' | 'VENTE';        // ACHAT = Spring, VENTE = UTAD
  indexBougie: number;            // Index de la bougie 2 (réintégration)
  temps: number | string;
  prixExtreme: number;            // Plus bas (achat) ou plus haut (vente) des 2 bougies
  open1: number;
  close2: number;
  niveauLePlusFort: NiveauShvedBalaye | null;
  niveauxBalayes: NiveauShvedBalaye[];   // Tous les niveaux balayés, du plus fort au moins fort
  nombreNiveauxBalayes: number;
  liquiditeTotale: number;        // Somme des retests de tous les niveaux balayés
  scoreLiquidite: number;         // Score de liquidité du niveau retenu (0 à 100)
  qualiteLiquidite?: 'FAIBLE' | 'MOYENNE' | 'FORTE' | 'INSTITUTIONNELLE';
  ratioProportion?: number;       // Ratio proportionnel de la liquidation
  rejetMoyen?: number;            // Hauteur moyenne de la montagne Shved balayée
}

export interface ResultatSweepNiveauShvedLePlusFort {
  signaux: SignalSweepNiveauShvedLePlusFort[];
  primitives: VisualPrimitives;
  statistiques: {
    totalSignaux: number;
    totalAchats: number;
    totalVentes: number;
    totalAvecNiveau: number;
    maxRetestsBalayes: number;
  };
}

// ─── 🛠️ Petites fonctions utilitaires ─────────────────────────────────────────

/**
 * Convertit un horodatage (nombre ou texte ISO) en nombre comparable.
 * Exemple : convertirEnSecondes('2026-10-14T00:00:00Z') → 1791936000
 */
function convertirEnSecondes(temps: number | string): number {
  if (typeof temps === 'number') return temps;
  return Math.floor(Date.parse(temps) / 1000);
}

/**
 * Compte les retests d'une zone survenus strictement AVANT un instant donné.
 * Pourquoi : le moteur Shved compte les retests sur tout l'historique ; pour savoir
 * combien de liquidité le niveau contenait AU MOMENT du pattern, on ignore les retests futurs.
 * Exemple : compterRetestsAvant(zone, tempsBougie1) → 3
 */
function compterRetestsAvant(zone: ZoneShved, tempsLimite: number): number {
  const dates = zone.datesTouches || [];
  let total = 0;
  for (const date of dates) {
    if (convertirEnSecondes(date) < tempsLimite) total++;
  }
  return total;
}

/**
 * Vérifie que le niveau existait et n'avait PAS encore été consommé (cassé par une clôture)
 * avant le début du pattern.
 * Exemple : estNiveauEncoreDisponible(zone, tempsBougie1) → true
 */
function estNiveauEncoreDisponible(zone: ZoneShved, tempsBougie1: number): boolean {
  // Le niveau doit être né avant le pattern
  if (convertirEnSecondes(zone.dateDebut) >= tempsBougie1) return false;

  // Jamais cassé → toujours disponible
  if (!zone.estCassee) return true;

  // Cassé : la cassure doit avoir lieu pendant ou après le pattern (pas avant)
  return convertirEnSecondes(zone.dateFin) >= tempsBougie1;
}

// ─── 🧮 ÉVALUATION DU SCORE DE LIQUIDITÉ & PROPORTIONNALITÉ SMC ───────────────

/**
 * Résultat détaillé de l'évaluation de liquidité d'un niveau Shved
 */
export interface EvaluationLiquiditeShved {
  scoreTotal: number;           // Note de liquidité sur 100 points
  pointsRetests: number;        // Points accordés aux retests (max 35)
  pointsRejets: number;         // Points accordés à la hauteur moyenne des rejets (max 30)
  pointsProportionnalite: number; // Points accordés à la proportionnalité liquidation / montagne (max 25)
  pointsIntegrite: number;      // Points bonus si le niveau est resté intact (max 10)
  rejetMoyen: number;           // Hauteur moyenne des rejets en prix
  ratioRejetMoyen: number;      // Rejet moyen exprimé en nombre de bougies
  ratioProportion: number;      // Ratio Taille Bougie 1 / Rejet Moyen
  qualite: 'FAIBLE' | 'MOYENNE' | 'FORTE' | 'INSTITUTIONNELLE';
}

/**
 * Calcule le Score de Liquidité Institutionnelle (0 à 100) pour un niveau Shved,
 * en combinant le nombre de retests, la hauteur moyenne des rejets ("montagnes")
 * et la proportionnalité avec la bougie de liquidation.
 *
 * Exemple :
 * const eval = evaluerScoreLiquiditeShved({
 *   zone, bougies, indexBougie1: 50, tempsBougie1: 1727200000,
 *   tailleLiquidation: 12.5, tailleMoyenneBougie: 2.0
 * });
 * console.log(`Score: ${eval.scoreTotal}/100 [${eval.qualite}]`);
 */
export function evaluerScoreLiquiditeShved(params: {
  zone: ZoneShved;
  bougies: Bougie[];
  indexBougie1: number;
  tempsBougie1: number;
  tailleLiquidation: number;
  tailleMoyenneBougie: number;
}): EvaluationLiquiditeShved {
  const {
    zone,
    bougies,
    indexBougie1,
    tempsBougie1,
    tailleLiquidation,
    tailleMoyenneBougie,
  } = params;

  // 1️⃣ Retests survenus strictement avant le Doji
  const retestsAvant = compterRetestsAvant(zone, tempsBougie1);

  // Points Retests (max 35 pts)
  let pointsRetests = 15;
  if (retestsAvant >= 3) {
    pointsRetests = 35;
  } else if (retestsAvant === 2) {
    pointsRetests = 25;
  }

  // 2️⃣ Amplitude moyenne des rejets (la "hauteur des montagnes")
  const indexDepart = Math.max(0, zone.indexOrigine);
  let sommetMax = zone.prixMedian;
  let creuxMin = zone.prixMedian;

  const finIndex = Math.min(bougies.length - 1, indexBougie1);
  for (let j = indexDepart; j < finIndex; j++) {
    if (bougies[j].high > sommetMax) sommetMax = bougies[j].high;
    if (bougies[j].low < creuxMin) creuxMin = bougies[j].low;
  }

  const hauteurTotaleRejet = zone.type === 'SUPPORT'
    ? (sommetMax - zone.prixMedian)
    : (zone.prixMedian - creuxMin);

  // Rejet moyen par test (divisé par le nombre de tests pour obtenir la moyenne des vagues)
  const rejetMoyen = Math.max(0.0001, hauteurTotaleRejet / Math.max(1, retestsAvant));
  const ratioRejetMoyen = rejetMoyen / Math.max(0.0001, tailleMoyenneBougie);

  // Points Hauteur Montagne (max 30 pts)
  let pointsRejets = 10;
  if (ratioRejetMoyen >= 2.5) {
    pointsRejets = 30;
  } else if (ratioRejetMoyen >= 1.0) {
    pointsRejets = 20;
  }

  // 3️⃣ Proportionnalité (Taille Bougie 1 Liquidation vs Rejet Moyen de la Montagne)
  // Ratio = TailleLiquidation / RejetMoyen
  const ratioProportion = tailleLiquidation / Math.max(0.0001, rejetMoyen);

  // Points Proportionnalité (max 25 pts)
  // Sweet spot : la liquidation fait entre 20% et 80% de la hauteur de la montagne
  let pointsProportionnalite = 5;
  if (ratioProportion >= 0.20 && ratioProportion <= 0.80) {
    pointsProportionnalite = 25;
  } else if (ratioProportion >= 0.10 && ratioProportion <= 1.20) {
    pointsProportionnalite = 15;
  }

  // 4️⃣ Bonus d'intégrité (max 10 pts)
  const estDisponible = estNiveauEncoreDisponible(zone, tempsBougie1);
  const pointsIntegrite = estDisponible && !zone.estCassee ? 10 : 0;

  // 5️⃣ Score total sur 100
  const scoreTotal = Math.min(100, Math.round(pointsRetests + pointsRejets + pointsProportionnalite + pointsIntegrite));

  let qualite: 'FAIBLE' | 'MOYENNE' | 'FORTE' | 'INSTITUTIONNELLE' = 'FAIBLE';
  if (scoreTotal >= 80) qualite = 'INSTITUTIONNELLE';
  else if (scoreTotal >= 60) qualite = 'FORTE';
  else if (scoreTotal >= 40) qualite = 'MOYENNE';

  return {
    scoreTotal,
    pointsRetests,
    pointsRejets,
    pointsProportionnalite,
    pointsIntegrite,
    rejetMoyen,
    ratioRejetMoyen,
    ratioProportion,
    qualite,
  };
}

// ─── 🎯 FONCTION CENTRALE DE VALIDATION DU SETUP (POUR LE DÉVELOPPEUR) ──────

/**
 * Paramètres nécessaires pour tester la validité d'un niveau Shved face à un Doji.
 */
export interface ParametresValidationSetupShved {
  estAchat: boolean;
  prixExtreme: number;
  clotureBougie2: number;
  tempsBougie1: number;
  zone: ZoneShved;
  minRetests?: number;
  maxBarsAge?: number;
  pasTempsSec?: number;
  scoreLiquidite?: number;
  scoreMinimum?: number;
  ratioProportion?: number;
  activerFiltreProportionnalite?: boolean;
  ratioProportionMin?: number;
  ratioProportionMax?: number;
}

/**
 * ==============================================================================
 * 🎯 FONCTION CENTRALE DE VALIDATION DU SETUP (POUR LE DÉVELOPPEUR DÉBUTANT)
 * ==============================================================================
 * Cette fonction unique rassemble dans UN SEUL BLOC toutes les conditions
 * nécessaires pour qu'un niveau Shved soit validé par le Doji personnalisé.
 *
 * 💡 COMMENT L'AJUSTER OU LA MODIFIER ?
 *  • Pour désactiver une condition : commentez simplement son bloc `if (...) return false;`.
 *  • Pour assouplir une règle : modifiez les opérateurs (<, >) ou les valeurs de comparaison.
 *  • Pour ajouter une nouvelle règle : ajoutez votre `if (!maCondition) return false;`.
 *
 * @returns {boolean} true si le niveau respecte TOUTES les conditions du setup, false sinon
 */
export function validerSetupNiveauShved(params: ParametresValidationSetupShved): boolean {
  const {
    estAchat,
    prixExtreme,
    clotureBougie2,
    tempsBougie1,
    zone,
    minRetests = 1,
    maxBarsAge = 100,
    pasTempsSec = 3600,
    scoreLiquidite = 0,
    scoreMinimum = 0,
    ratioProportion = 0,
    activerFiltreProportionnalite = false,
    ratioProportionMin = 0.15,
    ratioProportionMax = 1.50,
  } = params;

  const prixNiveau = zone.prixMedian;

  // ─── 🔍 CONDITION 1 : Balayage par la mèche et réintégration par la clôture ───
  // • Pour un Achat (Spring) : la mèche doit plonger SOUS le support (< prixNiveau)
  //   ET la clôture de la bougie 2 doit revenir AU-DESSUS (> prixNiveau).
  // • Pour une Vente (UTAD)  : la mèche doit percer AU-DESSUS de la résistance (> prixNiveau)
  //   ET la clôture de la bougie 2 doit revenir EN DESSOUS (< prixNiveau).
  const estBalaye = estAchat
    ? prixExtreme < prixNiveau && clotureBougie2 > prixNiveau
    : prixExtreme > prixNiveau && clotureBougie2 < prixNiveau;

  if (!estBalaye) {
    // ❌ Échoué : Le prix n'a pas balayé le niveau avec réintégration immédiate
    return false;
  }

  // ─── 🔍 CONDITION 2 : Intégrité du niveau (non cassé avant le Doji) ───────────
  // Le niveau Shved devait être intact au moment où le Doji s'est formé.
  // Si une bougie antérieure a déjà clôturé au-delà, la liquidité a déjà été consommée.
  const estDisponible = estNiveauEncoreDisponible(zone, tempsBougie1);
  if (!estDisponible) {
    // ❌ Échoué : Le niveau a été cassé dans le passé avant l'arrivée du Doji
    return false;
  }

  // ─── 🔍 CONDITION 3 : Fraîcheur & Âge récent du niveau ─────────────────────────
  // Évite de réagir à des niveaux créés trop loin dans le passé.
  // Si maxBarsAge = 0, cette règle est ignorée (historique illimité).
  if (maxBarsAge > 0) {
    const ageSec = tempsBougie1 - convertirEnSecondes(zone.dateDebut);
    const ageBougies = ageSec / Math.max(1, pasTempsSec);
    if (ageBougies > maxBarsAge) {
      // ❌ Échoué : Le niveau est trop ancien (dépasse maxBarsAge bougies)
      return false;
    }
  }

  // ─── 🔍 CONDITION 4 : Retests minimaux survenus AVANT le Doji ─────────────────
  // Ne conserve que les niveaux prouvés qui ont été testés au moins `minRetests` fois.
  // Les retests postérieurs au Doji sont strictement ignorés pour éviter tout biais futur.
  const retestsAvant = compterRetestsAvant(zone, tempsBougie1);
  if (retestsAvant < minRetests) {
    // ❌ Échoué : Le niveau n'a pas encore assez de retests prouvés
    return false;
  }

  // ─── 🔍 CONDITION 5 : Filtre de Proportionnalité (Liquidation vs Montagne) ─────
  // Vérifie que la bougie 1 n'est ni ridiculement minuscule (micro-bruit)
  // ni démesurément géante (crash) par rapport au rejet moyen du niveau.
  if (activerFiltreProportionnalite) {
    if (ratioProportion < ratioProportionMin || ratioProportion > ratioProportionMax) {
      // ❌ Échoué : La liquidation n'est pas proportionnelle à la taille du niveau
      return false;
    }
  }

  // ─── 🔍 CONDITION 6 : Score de Liquidité Minimal Requis ───────────────────────
  // Si l'utilisateur exige une qualité minimale (ex: score >= 60)
  if (scoreMinimum > 0 && scoreLiquidite < scoreMinimum) {
    // ❌ Échoué : Le niveau ne contient pas assez de liquidité selon le score
    return false;
  }

  // ✅ TOUTES les conditions sont satisfaites : le setup est validé !
  return true;
}

// ─── 🚀 Fonction Principale ───────────────────────────────────────────────────

/**
 * Détecte le Doji personnalisé (Liq/Reint) et identifie le niveau Shved le PLUS FORT
 * (le plus retesté) que sa mèche a balayé, ainsi que la liquidité totale récupérée.
 *
 * Exemple :
 * const res = calculerSweepNiveauShvedLePlusFort(bougiesH4, {
 *   timeframeSource: 'M15',
 *   donneesM1: bougiesM1,
 * });
 * const signal = res.signaux[0];
 * console.log(signal.niveauLePlusFort?.retestsAvantPattern); // ex: 5
 * console.log(signal.liquiditeTotale);                      // ex: 8 (5 + 2 + 1)
 */
export function calculerSweepNiveauShvedLePlusFort(
  bougies: Bougie[],
  options: ParametresSweepNiveauShvedLePlusFort = {}
): ResultatSweepNiveauShvedLePlusFort {
  const labels: VisualLabel[] = [];
  const lignes: VisualLine[] = [];

  const resultatVide: ResultatSweepNiveauShvedLePlusFort = {
    signaux: [],
    primitives: { labels, lignes, boites: [], points: [] },
    statistiques: { totalSignaux: 0, totalAchats: 0, totalVentes: 0, totalAvecNiveau: 0, maxRetestsBalayes: 0 },
  };

  // 1️⃣ Vérifications
  if (!bougies || bougies.length < 10) return resultatVide;

  // 2️⃣ Paramètres
  const minRetests = Math.max(1, Number(options.minRetests ?? 1));
  const exigerNiveauBalaye = options.exigerNiveauBalaye !== false;
  const afficherFaibles = Boolean(options.afficherFaibles);
  const afficherNiveauxShved = options.afficherNiveauxShved !== false;
  const afficherNiveauxCasses = options.afficherNiveauxCasses !== false;
  const afficherTousDojis = options.afficherTousDojis !== false;
  const afficherForceDansLabel = options.afficherForceDansLabel !== false;
  const afficherBadgeScore = options.afficherBadgeScore !== false;
  const scoreMinimum = Math.max(0, Number(options.scoreMinimum ?? 0));
  const activerFiltreProportionnalite = Boolean(options.activerFiltreProportionnalite);
  const ratioProportionMin = Number(options.ratioProportionMin ?? 0.15);
  const ratioProportionMax = Number(options.ratioProportionMax ?? 1.50);
  const afficherAutresNiveaux = Boolean(options.afficherAutresNiveaux);
  const bullColor = options.bullColor || '#00E676';
  const bearColor = options.bearColor || '#F23645';
  const texteLabel = options.texteLabel || 'Liq/Reint';

  // 3️⃣ Tous les niveaux Shved (actifs ET cassés), sans fusion pour garder l'historique propre à chaque niveau
  const resultatShved = calculerShvedSupplyDemand(bougies, {
    timeframeSource: options.timeframeSource || 'M15',
    donneesM1: options.donneesM1,
    chartTimeframe: options.chartTimeframe,
    supprimerZonesCassees: false,
    afficherNonRetestees: true,
    afficherFaibles: true,
    minRetests: 0,
    periodeATR: options.periodeATR ?? 15,
    zoneFuzzFactor: options.zoneFuzzFactor ?? 0.1,
    maxLookbackBars: options.maxLookbackBars ?? 200,
    afficherZones: false,
    afficherLignes: false,
    afficherEtiquettes: false,
  });

  const supports = resultatShved.supports.filter((z) => afficherFaibles || !z.estFaible);
  const resistances = resultatShved.resistances.filter((z) => afficherFaibles || !z.estFaible);

  // Estimation du pas moyen par bougie pour mesurer l'âge des niveaux
  const pasTempsSec = bougies.length >= 2
    ? Math.max(60, (convertirEnSecondes(bougies[bougies.length - 1].time) - convertirEnSecondes(bougies[0].time)) / (bougies.length - 1))
    : 3600;
  const maxBarsAge = Number(options.lookbackMaxBarsAvantPattern ?? 100);

  // 4️⃣ Détection du Doji personnalisé (Liq/Reint) avec ses propres réglages
  const resultatPattern = calculerLiquidationReintegration(bougies, {
    toleranceDeficit: options.toleranceDeficit,
    toleranceDepassement: options.toleranceDepassement,
    activerFiltreTaille: options.activerFiltreTaille,
    periodeHistorique: options.periodeHistorique,
    multiplicateurBougie1: options.multiplicateurBougie1,
    multiplicateurCorps2: options.multiplicateurCorps2,
    activerAchat: options.activerAchat,
    activerVente: options.activerVente,
    activerFiltreTendance: options.activerFiltreTendance,
    trendBars: options.trendBars,
  });

  const signaux: SignalSweepNiveauShvedLePlusFort[] = [];
  let totalAchats = 0;
  let totalVentes = 0;
  let totalAvecNiveau = 0;
  let maxRetestsBalayes = 0;

  // 5️⃣ Pour chaque pattern : quels niveaux ont été balayés, et lequel est le plus fort ?
  for (const pattern of resultatPattern.signaux) {
    const i = pattern.indexBougie;
    const bougie1 = bougies[i - 1];
    const bougie2 = bougies[i];
    if (!bougie1 || !bougie2) continue;

    const estAchat = pattern.type === 'ACHAT';
    const tempsBougie1 = convertirEnSecondes(bougie1.time);
    const tailleLiquidation = Math.max(0.0001, bougie1.high - bougie1.low);

    // Taille moyenne d'une bougie sur les 10 bougies précédant le pattern
    const indexDebutRef = Math.max(0, i - 11);
    let sommeHauteurs = 0;
    let nbRef = 0;
    for (let k = indexDebutRef; k < i - 1; k++) {
      sommeHauteurs += (bougies[k].high - bougies[k].low);
      nbRef++;
    }
    const tailleMoyenneBougie = nbRef > 0 ? (sommeHauteurs / nbRef) : tailleLiquidation;

    // Extrême de la mèche du pattern (le point qui est allé chercher la liquidité)
    const prixExtreme = estAchat
      ? Math.min(bougie1.low, bougie2.low)
      : Math.max(bougie1.high, bougie2.high);

    // Achat (Spring) → on regarde les SUPPORTS ; Vente (UTAD) → les RÉSISTANCES
    const zonesCandidates = estAchat ? supports : resistances;
    const niveauxBalayes: NiveauShvedBalaye[] = [];

    for (const zone of zonesCandidates) {
      // 🧮 Évaluation du score de liquidité & de la proportionnalité SMC
      const evaluation = evaluerScoreLiquiditeShved({
        zone,
        bougies,
        indexBougie1: i - 1,
        tempsBougie1,
        tailleLiquidation,
        tailleMoyenneBougie,
      });

      // ─── 🎯 VÉRIFICATION DES CONDITIONS DU SETUP (FONCTION UNIQUE ET CENTRALISÉE) ───
      const setupValide = validerSetupNiveauShved({
        estAchat,
        prixExtreme,
        clotureBougie2: bougie2.close,
        tempsBougie1,
        zone,
        minRetests,
        maxBarsAge,
        pasTempsSec,
        scoreLiquidite: evaluation.scoreTotal,
        scoreMinimum,
        ratioProportion: evaluation.ratioProportion,
        activerFiltreProportionnalite,
        ratioProportionMin,
        ratioProportionMax,
      });

      // Si l'une des conditions a échoué dans la fonction, on ignore ce niveau
      if (!setupValide) continue;

      const retestsAvantPattern = compterRetestsAvant(zone, tempsBougie1);
      niveauxBalayes.push({
        zone,
        prix: zone.prixMedian,
        retestsAvantPattern,
        profondeur: Math.abs(zone.prixMedian - prixExtreme),
        scoreLiquidite: evaluation.scoreTotal,
        pointsRetests: evaluation.pointsRetests,
        pointsRejets: evaluation.pointsRejets,
        pointsProportionnalite: evaluation.pointsProportionnalite,
        pointsIntegrite: evaluation.pointsIntegrite,
        rejetMoyen: evaluation.rejetMoyen,
        ratioProportion: evaluation.ratioProportion,
        qualite: evaluation.qualite,
      });
    }

    // D. Tri : le meilleur Score de Liquidité d'abord ; à égalité, le plus de retests ; à égalité, le plus récent
    niveauxBalayes.sort((a, b) => {
      if (b.scoreLiquidite !== a.scoreLiquidite) {
        return b.scoreLiquidite - a.scoreLiquidite;
      }
      if (b.retestsAvantPattern !== a.retestsAvantPattern) {
        return b.retestsAvantPattern - a.retestsAvantPattern;
      }
      return convertirEnSecondes(b.zone.dateDebut) - convertirEnSecondes(a.zone.dateDebut);
    });

    const niveauLePlusFort = niveauxBalayes.length > 0 ? niveauxBalayes[0] : null;

    // Si on exige un niveau balayé et qu'il n'y en a pas, on peut quand même afficher le Doji si demandé
    if (!niveauLePlusFort) {
      if (afficherTousDojis) {
        // Étiquette 100% opaque pour repérer le Doji seul sans niveau Shved balayé
        const couleurDojiSeul = estAchat ? bullColor : bearColor;
        labels.push({
          id: `doji-seul-lbl-${i}`,
          prix: prixExtreme,
          date: bougie2.time,
          texte: estAchat ? 'Spring' : 'UTAD',
          couleur: couleurDojiSeul,
          position: estAchat ? 'below' : 'above',
        });
      }

      if (exigerNiveauBalaye) continue;
    }

    // E. Quantité de liquidité récupérée = somme des retests de tous les niveaux balayés
    let liquiditeTotale = 0;
    for (const niveau of niveauxBalayes) {
      liquiditeTotale += niveau.retestsAvantPattern;
    }

    signaux.push({
      type: pattern.type,
      indexBougie: i,
      temps: bougie2.time,
      prixExtreme,
      open1: pattern.open1,
      close2: pattern.close2,
      niveauLePlusFort,
      niveauxBalayes,
      nombreNiveauxBalayes: niveauxBalayes.length,
      liquiditeTotale,
      scoreLiquidite: niveauLePlusFort ? niveauLePlusFort.scoreLiquidite : 0,
      qualiteLiquidite: niveauLePlusFort?.qualite,
      ratioProportion: niveauLePlusFort?.ratioProportion,
      rejetMoyen: niveauLePlusFort?.rejetMoyen,
    });

    if (estAchat) totalAchats++;
    else totalVentes++;
    if (niveauLePlusFort) {
      totalAvecNiveau++;
      maxRetestsBalayes = Math.max(maxRetestsBalayes, niveauLePlusFort.retestsAvantPattern);
    }

    // 6️⃣ Visuels du Combo (Doji + Niveau Shved Épuré)
    const couleur = estAchat ? bullColor : bearColor;

    // Étiquette épurée : intègre le score sans surcharger le graphique
    let texte = texteLabel;
    if (niveauLePlusFort) {
      if (afficherBadgeScore) {
        const badgeEtoile = niveauLePlusFort.scoreLiquidite >= 80 ? ' ⭐' : '';
        texte = `${texteLabel}\n[${niveauLePlusFort.scoreLiquidite}${badgeEtoile}]`;
        if (afficherForceDansLabel) {
          texte += ` ${niveauLePlusFort.retestsAvantPattern}x`;
        }
      } else if (afficherForceDansLabel) {
        texte = `${texteLabel}\n${niveauLePlusFort.retestsAvantPattern}x`;
        if (niveauxBalayes.length > 1) {
          texte += ` (${niveauxBalayes.length} niv.)`;
        }
      }
    }

    labels.push({
      id: `sweep-fort-lbl-${i}`,
      prix: prixExtreme,
      date: bougie2.time,
      texte,
      couleur,
      position: estAchat ? 'below' : 'above',
    });

    // Segment discontinu du niveau le plus fort : de sa naissance jusqu'au pattern (100% opaque, bien épais)
    if (niveauLePlusFort) {
      lignes.push({
        id: `sweep-fort-line-${i}`,
        prix: niveauLePlusFort.prix,
        dateDebut: niveauLePlusFort.zone.dateDebut,
        dateFin: bougie2.time,
        couleur,
        epaisseur: 2.5,
        style: 'dashed',
      });
    }

    // Autres niveaux balayés (moins forts) en pointillés fins, si demandé
    if (afficherAutresNiveaux) {
      for (let n = 1; n < niveauxBalayes.length; n++) {
        const autre = niveauxBalayes[n];
        lignes.push({
          id: `sweep-autre-line-${i}-${n}`,
          prix: autre.prix,
          dateDebut: autre.zone.dateDebut,
          dateFin: bougie2.time,
          couleur,
          epaisseur: 1.2,
          style: 'dotted',
        });
      }
    }
  }

  // 7️⃣ Vision d'Ensemble : Tracé des Supports & Résistances Shved en arrière-plan (100% Opaque)
  if (afficherNiveauxShved) {
    const derniereBougie = bougies[bougies.length - 1];
    const dateDerniereBougie = derniereBougie ? derniereBougie.time : 0;
    const toutesLesZones: ZoneShved[] = [...supports, ...resistances];

    for (const zone of toutesLesZones) {
      if (zone.retests < minRetests) continue;
      if (zone.estFaible && !afficherFaibles) continue;
      if (zone.estCassee && !afficherNiveauxCasses) continue;

      const estSupport = zone.type === 'SUPPORT';
      // 100% opaque sans canal alpha : vert franc pour support, rouge franc pour résistance
      const couleurZone = estSupport ? bullColor : bearColor;
      const dateFin = zone.estCassee ? zone.dateFin : dateDerniereBougie;

      lignes.push({
        id: `bg-shved-${zone.id}`,
        prix: zone.prixMedian,
        dateDebut: zone.dateDebut,
        dateFin,
        couleur: couleurZone,
        epaisseur: zone.estCassee ? 1.5 : 1.8,
        style: zone.estCassee ? 'dashed' : 'solid',
      });
    }
  }

  return {
    signaux,
    primitives: { labels, lignes, boites: [], points: [] },
    statistiques: {
      totalSignaux: signaux.length,
      totalAchats,
      totalVentes,
      totalAvecNiveau,
      maxRetestsBalayes,
    },
  };
}
