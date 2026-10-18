/**
 * ==============================================================================
 * 🌟 CATALOGUE DES INDICATEURS FAVORIS (POUR LE CHEF D'ORCHESTRE)
 * ==============================================================================
 * Ce dossier isole les 3 indicateurs majeurs choisis pour composer notre stratégie :
 * 
 *  1️⃣ Sandbox Doji Liq/Reint + S/R Shved (Plage Ciblée)
 *     👉 Détection du Doji, isolation de la plage [Extrême Précédent -> Doji],
 *        épuration totale, calcul du score de liquidité (sur 100) et filtre Top N.
 * 
 *  2️⃣ Money Management Dynamique (R:R, Lot & Break-Even)
 *     👉 Validation de rentabilité R:R min, dimensionnement des lots, gestion Break-Even.
 * 
 *  3️⃣ Profil de Chevauchement Non-Mitigé (UOP)
 *     👉 Analyse du vrai chevauchement des bougies, zones vierges et Take Profit optimal.
 * 
 * 💡 Ces 3 briques peuvent être importées ensemble en une seule ligne dans le Chef d'Orchestre :
 * ```typescript
 * import {
 *   calculerSandboxDojiShvedPlage,
 *   calculerMoneyManagementRules,
 *   calculerUnmitigatedOverlapProfile,
 * } from '@/lib/indicators/favoris';
 * ```
 * ==============================================================================
 */

export * from './sandboxDojiShvedPlage';
export * from './moneyManagementDynamique';
export * from './unmitigatedOverlapProfile';
