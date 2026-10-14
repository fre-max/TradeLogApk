/**
 * ==============================================================================
 * INDICATEUR SCRIPTABLE AUTONOME : DÉTECTION DE LIQUIDITÉ - SHVED S/R CASSÉS (MTF)
 * Version 1.0.0
 * 
 * Détecte spécifiquement les Supports et Résistances Shved qui ont été CASSÉS
 * après avoir été retestés au moins une fois (ignore les niveaux vierges sans retest).
 * Analyse les niveaux sur une unité de temps inférieure (ex: M15) et les projette
 * sur le graphique actuel (ex: H4) sous forme de segments horizontaux en ligne
 * discontinue (dashed). AUCUNE zone rectangulaire n'est tracée.
 * ==============================================================================
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres, donneesM1, timeframe } = contexte;
    if (!bougies || bougies.length < 5) {
      return { donnees: {}, primitives: { labels: [], lignes: [], boites: [], points: [] } };
    }

    if (typeof calculerShvedBrokenSRMTF === 'function') {
      const res = calculerShvedBrokenSRMTF(bougies, {
        ...parametres,
        donneesM1: donneesM1,
        chartTimeframe: timeframe
      });
      return {
        donnees: res,
        primitives: res.primitives,
        typeSpecial: 'shved-broken-sr-mtf'
      };
    }

    return {
      donnees: { supportsCasses: [], resistancesCassees: [], totalNiveauxCasses: 0 },
      primitives: { labels: [], lignes: [], boites: [], points: [] },
      typeSpecial: 'shved-broken-sr-mtf'
    };
  }
};
