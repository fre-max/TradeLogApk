/**
 * ==============================================================================
 * 🧪 LABORATOIRE DE RÉTRO-INGÉNIERIE DE SETUPS
 * Types et Structures de données pour le Sondeur de Setups
 * ==============================================================================
 * 
 * Permet d'échantillonner et de sonder l'anatomie exacte d'un setup de trading
 * repéré visuellement par le trader, afin d'en extraire les règles statistiques.
 */

// ─── 1️⃣ Métriques de la Liquidité Ciblée ──────────────────────────────────────
export interface MetriqueLiquidite {
  // Type de liquidité identifiée avant le sweep
  type: 'SWING_LOW' | 'SWING_HIGH' | 'EQUAL_LOWS' | 'EQUAL_HIGHS' | 'SUPPORT_SHVED' | 'RESISTANCE_SHVED' | 'RANGE_EXTREME' | 'PERSONNALISE';
  // Prix exact du niveau de liquidité
  prixNiveau: number;
  // Index de la bougie où la liquidité s'était formée
  indexOrigine: number;
  // Date ou timestamp d'origine
  dateOrigine: string | number;
  // Nombre de bougies écoulées entre la création de la liquidité et son balayage
  bougiesEcoulees: number;
  // Description lisible pour le trader (ex: "Creux Swing M15 il y a 18 bougies")
  description: string;
}

// ─── 2️⃣ Métriques du Mouvement de Sweep (L'Incursion) ─────────────────────────
export interface MetriqueSweep {
  // Prix extrême touché par la mèche (Low pour un achat, High pour une vente)
  prixProtegeExtreme: number;
  // Dépassement au-delà du niveau de liquidité (en pips)
  profondeurPips: number;
  // Taille totale de la bougie de sweep (en pips)
  tailleBougieTotalePips: number;
  // Taille de la mèche de rejet (en pips)
  tailleMecheRejetPips: number;
  // Pourcentage de la mèche par rapport à la taille totale (ex: 75%)
  ratioMechePourcent: number;
  // Nombre de bougies dont le cours a dépassé le niveau
  bougiesHorsZone: number;
}

// ─── 3️⃣ Métriques de la Réintégration (La Réaction) ───────────────────────────
export interface MetriqueReintegration {
  // Nombre de bougies nécessaires pour clôturer à nouveau à l'intérieur du niveau
  delaiBougies: number;
  // Index de la bougie qui a validé la réintégration
  indexReintegration: number;
  // Amplitude du rebond de réintégration depuis l'extrême (en pips)
  amplitudeRejetPips: number;
  // Vrai si le retour présente un grand corps directionnel (displacement)
  aDisplacement: boolean;
  // Vrai si un Fair Value Gap (FVG) a été créé lors du retour
  aFvg: boolean;
  // Prix haut et bas du FVG si présent
  fvgHaut?: number;
  fvgBas?: number;
}

// ─── 4️⃣ Métriques du Range Post-Sweep (La Consolidation) ──────────────────────
export interface MetriqueRangePostSweep {
  // Nombre de bougies de consolidation dans ce range (ex: 4 bougies)
  dureeBougies: number;
  // Borne haute du range de consolidation
  borneHaute: number;
  // Borne basse du range de consolidation
  borneBasse: number;
  // Amplitude totale du range (en pips)
  amplitudeRangePips: number;
  // Vrai si le prix n'a jamais cassé le prix protégé extrême du sweep
  prixProtegePreserve: boolean;
  // Prix du point d'entrée idéal (ex: cassure ou retest du range)
  prixEntreeSuggere: number;
}

// ─── 📋 Fiche Complète d'un Setup Sondé (Échantillon) ─────────────────────────
export interface FicheSetupSonde {
  // Identifiant unique de l'échantillon
  id: string;
  // Nom ou libellé donné par l'utilisateur (ex: "EURUSD Spring Parfait Session Londres")
  titre: string;
  // Direction du trade sondé
  direction: 'ACHAT' | 'VENTE';
  // Paire analysée (ex: "EURUSD")
  paire: string;
  // Timeframe d'observation (ex: "M15" ou "M5")
  timeframe: string;
  // Index de la bougie clé du sweep sur le graphique
  indexBougieSweep: number;
  // Date de la bougie du sweep
  dateBougieSweep: string | number;
  // Note de qualité attribuée par le trader (A+, A, B)
  noteQualite: 'A+' | 'A' | 'B';
  // Commentaire ou remarques du trader
  notesTrader?: string;
  // Date de capture dans l'application
  creeLe: string;

  // Données mesurées par les 4 capteurs
  liquidite: MetriqueLiquidite;
  sweep: MetriqueSweep;
  reintegration: MetriqueReintegration;
  rangePostSweep: MetriqueRangePostSweep;
}

// ─── 📊 Synthèse Statistique Consolidée de la Banque de Setups ────────────────
export interface SyntheseStatistiqueSetups {
  totalSetups: number;
  totalAchats: number;
  totalVentes: number;

  // Sweep
  profondeurSweepMoyennePips: number;
  profondeurSweepMinPips: number;
  profondeurSweepMaxPips: number;
  ratioMecheMoyenPourcent: number;

  // Réintégration
  delaiReintegrationMoyenBougies: number;
  pourcentageDisplacement: number;
  pourcentageFvg: number;

  // Range Post-Sweep
  dureeMoyenneRangeBougies: number;
  amplitudeMoyenneRangePips: number;
  pourcentagePrixProtegePreserve: number;

  // Recommandation automatique de règles brutes
  reglesRecommandees: {
    sweepPipsMin: number;
    sweepPipsMax: number;
    delaiReintegrationMax: number;
    dureeRangeCible: number;
    ratioMecheMin: number;
  };
}
