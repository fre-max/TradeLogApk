/**
 * ==============================================================================
 * INDICATEUR SCRIPTABLE AUTONOME : LIQ/REINT + SWEEP CHEVAUCHEMENT MULTI-VAGUES (UOP)
 * Version 1.0.0
 * 
 * Combine le setup de Price Action Liquidation & Réintégration avec l'analyse
 * de la cartographie superposée multi-vagues UOP :
 * - Superpose les vagues ZigZag récentes.
 * - Identifie les zones fortes denses de liquidité (bleu foncé).
 * - Détecte la purge de la zone par la mèche du Spring ou de l'UTAD.
 * - Trace un segment horizontal en ligne discontinue (dashed) représentant le niveau.
 * 
 * 💡 UTILISATION SANS RÉINSTALLER L'APK :
 * 1. Transférez ce fichier sur votre smartphone.
 * 2. Ouvrez l'application TradeLog sur votre smartphone.
 * 3. Allez dans le Backtest -> Cliquez sur "Indicateurs".
 * 4. Cliquez sur "Importer" et sélectionnez ce fichier.
 * 5. L'indicateur est immédiatement actif sur vos graphiques !
 * ==============================================================================
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 5) {
      return { donnees: {}, primitives: { labels: [], lignes: [], boites: [], points: [] } };
    }

    if (typeof calculerLiquidationSweepChevauchementMultiVagues === 'function') {
      const res = calculerLiquidationSweepChevauchementMultiVagues(bougies, parametres);
      return {
        donnees: res,
        primitives: res.primitives,
        typeSpecial: 'liquidation-sweep-chevauchement-multi-vagues'
      };
    }

    return {
      donnees: { signaux: [] },
      primitives: { labels: [], lignes: [], boites: [], points: [] },
      typeSpecial: 'liquidation-sweep-chevauchement-multi-vagues'
    };
  }
};
