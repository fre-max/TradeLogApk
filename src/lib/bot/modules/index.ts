/**
 * ==============================================================================
 * 🤖 BOT INSTITUTIONNEL (SMC / WYCKOFF / LIQUIDITY PROFILER)
 * Index d'Exportation Central des 7 Modules Stratégiques
 * ==============================================================================
 * 
 * Cette architecture regroupe les 7 modules de décision du bot de trading :
 * 01_liquidite        : Détection des zones de liquidité institutionnelle S&R / Supply & Demand
 * 02_sweep_spring     : Validation des liquidations (Sweep / Spring / UTAD) et fixation du Prix Protégé
 * 03_tp_uop           : Profilage des volumes non-mitigés (UOP) et calcul des Take Profits optimaux
 * 04_entree_ltf       : Entrées fractales ultra-précises dans la zone protégée (Order Blocks & micro-BOS)
 * 05_money_management : Calcul mathématique du R:R, dimensionnement de lot et règles de Break-Even
 * 06_drone_mtf        : Chef d'orchestre multi-timeframe (Extension en mode Runner ou réduction de sécurité)
 * 07_setup_visualizer : Visualiseur de setup complet avec checklist des 6 confluences pour le trader
 */

// ─── Module 1 : Détection de Liquidité (S&R, Supply & Demand, BSL/SSL) ────────
export * from './01_liquidite/shvedSupplyDemand';
export * from './01_liquidite/detectionLiquidite';
export * from './01_liquidite/detectionLiquiditeEQ';
export * from './01_liquidite/detectionLiquiditeSRTL';

// ─── Module 2 : Détection de Liquidation & Prix Protégés (Sweep / Spring) ──────
export * from './02_sweep_spring/sweepSpringValidation';

// ─── Module 3 : Overlaps en Zone Non-Mitigée & TP Optimaux (UOP) ──────────────
export * from './03_tp_uop/unmitigatedOverlapProfile';
export * from './03_tp_uop/unmitigatedOverlapProfileRenderer';

// ─── Module 4 : Entrées Fractales LTF (Order Blocks dans la Zone Protégée) ────
export * from './04_entree_ltf/fractalLtfEntry';

// ─── Module 5 : Money Management Dynamique (R:R, Lot, Break-Even) ─────────────
export * from './05_money_management/moneyManagementRules';

// ─── Module 6 : Chef d'Orchestre Multi-Timeframe ("Le Drone" MTF) ─────────────
export * from './06_drone_mtf/mtfConductor';

// ─── Module 7 : Visualiseur de Setup Complet ("Aperçu du Bot") ────────────────
export * from './07_setup_visualizer/completeSetupVisualizer';
