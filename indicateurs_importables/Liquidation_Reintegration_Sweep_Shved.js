/**
 * ==============================================================================
 * INDICATEUR SCRIPTABLE AUTONOME : LIQ/REINT + SWEEP SHVED SUPPLY & DEMAND
 * Version 1.0.0
 * 
 * Combine le setup de Price Action Liquidation & Réintégration avec les zones
 * institutionnelles Shved Supply & Demand pour identifier les fausses cassures
 * de zones majeures (PROVEN / grand nombre de retests) et en mode LTF.
 * ==============================================================================
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 10) {
      return { donnees: {}, primitives: { labels: [], lignes: [], boites: [], points: [] } };
    }

    if (typeof calculerLiquidationSweepShved === 'function') {
      const res = calculerLiquidationSweepShved(bougies, parametres);
      return {
        donnees: res,
        primitives: res.primitives,
        typeSpecial: 'liquidation-sweep-shved'
      };
    }

    return {
      donnees: { signaux: [] },
      primitives: { labels: [], lignes: [], boites: [], points: [] },
      typeSpecial: 'liquidation-sweep-shved'
    };
  }
};
