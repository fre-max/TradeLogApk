/**
 * ==============================================================================
 * 🌟 INDICATEUR FAVORISÉ : MONEY MANAGEMENT DYNAMIQUE (R:R, LOT & BREAK-EVEN)
 * ==============================================================================
 * Cet indicateur est l'un des piliers favoris de notre stratégie.
 * Il assure la gestion du capital et le pilotage chirurgical du risque :
 *  1️⃣ Filtre de rentabilité R:R : Rejette automatiquement les setups avec un ratio inférieur à R:R Min (défaut: 2.5).
 *  2️⃣ Calcul de position : Calcule la taille de lot exacte selon le capital et le % de risque alloué.
 *  3️⃣ Pilotage actif : Indique le seuil pour passer en Break-Even (défaut: 50% de la distance au TP).
 *
 * 💡 Utilisable de façon autonome ou directement orchestré par notre Chef d'Orchestre !
 * ==============================================================================
 */

export {
  calculerMoneyManagementRules,
  type OptionsMoneyManagement,
  type EvaluationTradeMM,
  type ResultatMoneyManagement,
} from '@/lib/bot/modules/05_money_management/moneyManagementRules';
