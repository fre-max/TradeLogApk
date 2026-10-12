/**
 * ==============================================================================
 * INDICATEUR SCRIPTABLE AUTONOME : LIQ/REINT + SWEEP POINT & FIGURE (P&F)
 * Version 1.0.0
 * 
 * Combine le setup de Price Action Liquidation & Réintégration avec l'analyse
 * de la grille Point & Figure pour repérer le palier horizontal le plus solide
 * (« le niveau carré le plus testé » avec le plus grand nombre de colonnes alignées).
 * ==============================================================================
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 10) {
      return { donnees: {}, primitives: { labels: [], lignes: [], boites: [], points: [] } };
    }

    if (typeof calculerLiquidationSweepPointFigure === 'function') {
      const res = calculerLiquidationSweepPointFigure(bougies, parametres);
      return {
        donnees: res,
        primitives: res.primitives,
        typeSpecial: 'liquidation-sweep-pf'
      };
    }

    // Fallback minimal local si exécuté en sandbox isolé
    return {
      donnees: { signaux: [] },
      primitives: { labels: [], lignes: [], boites: [], points: [] },
      typeSpecial: 'liquidation-sweep-pf'
    };
  }
};
