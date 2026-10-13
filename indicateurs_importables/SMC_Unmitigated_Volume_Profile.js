/**
 * ==============================================================================
 * INDICATEUR SCRIPTABLE AUTONOME : SMC UNMITIGATED VOLUME PROFILE
 * Version 1.0.0
 * 
 * Profil de volume basé sur les ticks/volumes réels calculé sur les vagues ZigZag.
 * Identifie les POC (Point of Control) et met en évidence les niveaux de volume
 * qui n'ont pas encore été mitigés (revisités) par le prix.
 * ==============================================================================
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 10) {
      return { donnees: {}, primitives: { labels: [], lignes: [], boites: [], points: [] } };
    }

    if (typeof calculerUnmitigatedVolumeProfile === 'function') {
      const uvp = calculerUnmitigatedVolumeProfile(bougies, {
        zigzagDepth: Number(parametres?.zigzagDepth || 8),
        maxVagues: Number(parametres?.maxVagues || 5),
        lookbackBars: Number(parametres?.lookbackBars || 500),
        prolongerNiveaux: parametres?.prolongerNiveaux !== false,
      });

      const lignes = [];
      if (uvp && uvp.niveauxOuverts) {
        const tDebut = bougies[Math.max(0, bougies.length - 80)].time;
        const tFin = bougies[bougies.length - 1].time;
        for (const n of uvp.niveauxOuverts) {
          lignes.push({
            prix: n.price,
            dateDebut: n.tempsDebut || tDebut,
            dateFin: tFin,
            couleur: n.estHaussiere ? '#26a69a' : '#ef5350',
            style: 'solid',
            label: `POC ${n.volume.toFixed(0)}`,
          });
        }
      }

      return {
        donnees: uvp,
        primitives: { lignes },
        typeSpecial: 'unmitigated-profile'
      };
    }

    return {
      donnees: {},
      primitives: { labels: [], lignes: [], boites: [], points: [] },
      typeSpecial: 'unmitigated-profile'
    };
  }
};
