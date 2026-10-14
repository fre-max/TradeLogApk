/**
 * ==============================================================================
 * INDICATEUR SCRIPTABLE AUTONOME : LIQ/REINT + SWEEP CHEVAUCHEMENT EXTRÊMES (MÈCHES)
 * Version 1.0.0
 * 
 * Combine le setup de Price Action Liquidation & Réintégration avec l'analyse
 * du chevauchement de bougies concentré sur les mèches extrêmes :
 * - Achat (Spring) : cible la face basse (mèches inférieures accumulées).
 * - Vente (UTAD) : cible la face haute (mèches supérieures accumulées).
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

    if (typeof calculerLiquidationSweepChevauchementExtremes === 'function') {
      const res = calculerLiquidationSweepChevauchementExtremes(bougies, parametres);
      return {
        donnees: res,
        primitives: res.primitives,
        typeSpecial: 'liquidation-sweep-chevauchement-extremes'
      };
    }

    // Fallback autonome minimal si exécuté hors moteur complet
    return {
      donnees: { signaux: [] },
      primitives: { labels: [], lignes: [], boites: [], points: [] },
      typeSpecial: 'liquidation-sweep-chevauchement-extremes'
    };
  }
};
