/**
 * ==============================================================================
 * 🌟 INDICATEUR FAVORISÉ : PROFIL DE CHEVAUCHEMENT NON-MITIGÉ (UOP)
 * ==============================================================================
 * Cet indicateur est l'un des piliers favoris de notre stratégie SMC.
 * Au lieu de mesurer de faux volumes en ticks, il mesure le VRAI taux de chevauchement horizontal
 * des bougies sur le marché (le trafic institutionnel réel) :
 *  1️⃣ Superposition des Vagues : Superpose les vagues ZigZag antérieures et actuelles.
 *  2️⃣ Niveaux Non-Mitigés : Identifie les plages de liquidité vierges non encore revisitées.
 *  3️⃣ TP Optimaux : Calcule les cibles de sortie mathématiques (Take Profit optimal Achat / Vente).
 *
 * 💡 Utilisable de façon autonome ou directement orchestré par notre Chef d'Orchestre !
 * ==============================================================================
 */

import {
  calculerUnmitigatedOverlapProfile,
  type OptionsUOP,
  type ResultatUOP,
  type PalierChevauchement,
  type PalierSuperpositionVagues,
  type PlagePrixUniforme,
  type VagueOverlapProfile,
  type TPOptimalUOP,
  type NiveauOuvertUOP,
  type TypeChevauchementUOP,
} from '@/lib/bot/modules/03_tp_uop/unmitigatedOverlapProfile';

// Alias clairs pour la lisibilité
export type OptionsOverlapProfile = OptionsUOP;
export type ResultatOverlapProfile = ResultatUOP;

export {
  calculerUnmitigatedOverlapProfile,
  type OptionsUOP,
  type ResultatUOP,
  type PalierChevauchement,
  type PalierSuperpositionVagues,
  type PlagePrixUniforme,
  type VagueOverlapProfile,
  type TPOptimalUOP,
  type NiveauOuvertUOP,
  type TypeChevauchementUOP,
};
