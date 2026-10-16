/**
 * ==============================================================================
 * INDICATEUR SCRIPTABLE AUTONOME : LIQ/REINT + NIVEAU SHVED LE PLUS FORT (MTF)
 * Version 1.2.0
 * 
 * Quand le Doji personnalisé (Liq/Reint = Spring / UTAD) se produit, cet indicateur
 * recherche tous les supports et résistances Shved balayés par sa mèche extrême,
 * et retient le niveau le PLUS FORT (celui qui a le plus grand nombre de retests
 * avant le pattern = la plus forte concentration de liquidité).
 * 
 * Trace un segment horizontal discontinu (dashed) reliant le niveau balayé
 * au point de réintégration du pattern, et affiche la force (ex: 5x) et la
 * liquidité totale récupérée.
 * ==============================================================================
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres, donneesM1, timeframe } = contexte;
    if (!bougies || bougies.length < 10) {
      return { donnees: {}, primitives: { labels: [], lignes: [], boites: [], points: [] } };
    }

    if (typeof calculerSweepNiveauShvedLePlusFort === 'function') {
      const res = calculerSweepNiveauShvedLePlusFort(bougies, {
        ...parametres,
        donneesM1: donneesM1,
        chartTimeframe: timeframe
      });
      return {
        donnees: res,
        primitives: res.primitives,
        typeSpecial: 'liq-sweep-shved-plus-fort'
      };
    }

    return {
      donnees: { signaux: [] },
      primitives: { labels: [], lignes: [], boites: [], points: [] },
      typeSpecial: 'liq-sweep-shved-plus-fort'
    };
  }
};
