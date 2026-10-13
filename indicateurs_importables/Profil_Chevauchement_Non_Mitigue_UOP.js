/**
 * ==============================================================================
 * INDICATEUR SCRIPTABLE AUTONOME : PROFIL DE CHEVAUCHEMENT NON-MITIGÉ (UOP)
 * Version 1.2.0
 * 
 * Volume Profile basé sur le vrai taux de chevauchement des bougies (et non les ticks).
 * Détecte les zones d'accumulation (fort chevauchement en barres bleu foncé) et
 * calcule les cibles de TP Optimaux par superposition des vagues ZigZag.
 * ==============================================================================
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 15) {
      return { donnees: {}, primitives: { labels: [], lignes: [], boites: [], points: [] } };
    }

    if (typeof calculerUnmitigatedOverlapProfile === 'function') {
      const res = calculerUnmitigatedOverlapProfile(bougies, {
        zigzagDepth: Number(parametres?.zigzagDepth || 8),
        zigzagDeviation: Number(parametres?.zigzagDeviation || 0),
        zigzagBackstep: Number(parametres?.zigzagBackstep || 3),
        inclureVagueCourante: parametres?.inclureVagueCourante !== false,
        nbVaguesSuperposees: Number(parametres?.nbVaguesSuperposees || parametres?.maxVagues || 4),
        minVaguesSuperposition: Number(parametres?.minVaguesSuperposition || 1),
        maxVagues: Number(parametres?.nbVaguesSuperposees || parametres?.maxVagues || 4),
        lookbackBars: Number(parametres?.lookbackBars || 500),
        seuilBougiesBleuFonce: Number(parametres?.seuilBougiesBleuFonce || 3),
        minBougiesUniforme: Number(parametres?.minBougiesUniforme || 2),
        toleranceUniformite: Number(parametres?.toleranceUniformite || 1),
        prolongerNiveaux: parametres?.prolongerNiveaux !== false,
        uniquementNonMitigues: Boolean(parametres?.uniquementNonMitigues),
        afficherZigZag: parametres?.afficherZigZag !== false,
        afficherBarresProfil: parametres?.afficherBarresProfil !== false,
        afficherProlongation: parametres?.afficherProlongation !== false,
        afficherTPOptimaux: parametres?.afficherTPOptimaux !== false,
        seuilMargeTrouPourcent: Number(parametres?.seuilMargeTrouPourcent || 5),
        maxTPAffiches: Number(parametres?.maxTPAffiches || 3),
        afficherDebugTP: Boolean(parametres?.afficherDebugTP),
      });

      return {
        donnees: res,
        primitives: res.primitives,
        typeSpecial: 'unmitigated-overlap-profile'
      };
    }

    return {
      donnees: {},
      primitives: { labels: [], lignes: [], boites: [], points: [] },
      typeSpecial: 'unmitigated-overlap-profile'
    };
  }
};
