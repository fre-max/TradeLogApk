/**
 * ==============================================================================
 * INDICATEUR SCRIPTABLE AUTONOME : DÉTECTION LIQUIDITÉ PIVOTS (BSL / SSL)
 * Traduit depuis Indicateur_Detection_Liquidite.mq5
 * 
 * 💡 UTILISATION SANS RÉINSTALLER L'APK :
 * 1. Transférez ce fichier sur votre smartphone.
 * 2. Ouvrez TradeLog -> Backtest -> Cliquez sur "Indicateurs".
 * 3. Cliquez sur "Importer" et sélectionnez ce fichier .js.
 * 4. L'indicateur est actif immédiatement sur vos graphiques !
 * ==============================================================================
 */
return {
  calculer: function (contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 20) {
      return { donnees: {}, primitives: { boites: [], lignes: [], labels: [] } };
    }

    const params = parametres || {};
    const sensibilite = Number(params.sensibilitePivot || 5);
    const maxLookback = Number(params.maxLookbackBars || 1000);
    const afficherLignes = params.afficherLignes !== false;
    const afficherEtiquettes = params.afficherEtiquettes !== false;

    const depart = Math.max(sensibilite * 2 + 5, bougies.length - maxLookback);
    let dernierBSLPrix = 0;
    let dernierBSLBarre = -1;
    let dernierSSLPrix = 0;
    let dernierSSLBarre = -1;
    const niveaux = [];

    for (let bar = depart; bar < bougies.length; bar++) {
      const candidat = bar - sensibilite;
      if (candidat >= sensibilite) {
        // Pivot Haut (BSL)
        let estHaut = true;
        for (let k = candidat - sensibilite; k < candidat; k++) {
          if (k >= 0 && bougies[k].high > bougies[candidat].high) { estHaut = false; break; }
        }
        if (estHaut) {
          for (let k = candidat + 1; k <= candidat + sensibilite; k++) {
            if (k < bougies.length && bougies[k].high >= bougies[candidat].high) { estHaut = false; break; }
          }
        }
        if (estHaut) {
          dernierBSLPrix = bougies[candidat].high;
          dernierBSLBarre = candidat;
        }

        // Pivot Bas (SSL)
        let estBas = true;
        for (let k = candidat - sensibilite; k < candidat; k++) {
          if (k >= 0 && bougies[k].low < bougies[candidat].low) { estBas = false; break; }
        }
        if (estBas) {
          for (let k = candidat + 1; k <= candidat + sensibilite; k++) {
            if (k < bougies.length && bougies[k].low <= bougies[candidat].low) { estBas = false; break; }
          }
        }
        if (estBas) {
          dernierSSLPrix = bougies[candidat].low;
          dernierSSLBarre = candidat;
        }
      }

      if (dernierBSLPrix > 0 && dernierBSLBarre >= 0) {
        const existant = niveaux.find(function(n) { return n.type === 'BSL' && n.indexOrigine === dernierBSLBarre; });
        if (existant) {
          existant.indexFin = bar;
          existant.tempsFin = bougies[bar].time;
        } else {
          niveaux.push({
            type: 'BSL',
            prix: dernierBSLPrix,
            indexOrigine: dernierBSLBarre,
            tempsOrigine: bougies[dernierBSLBarre].time,
            indexFin: bar,
            tempsFin: bougies[bar].time
          });
        }
      }

      if (dernierSSLPrix > 0 && dernierSSLBarre >= 0) {
        const existant = niveaux.find(function(n) { return n.type === 'SSL' && n.indexOrigine === dernierSSLBarre; });
        if (existant) {
          existant.indexFin = bar;
          existant.tempsFin = bougies[bar].time;
        } else {
          niveaux.push({
            type: 'SSL',
            prix: dernierSSLPrix,
            indexOrigine: dernierSSLBarre,
            tempsOrigine: bougies[dernierSSLBarre].time,
            indexFin: bar,
            tempsFin: bougies[bar].time
          });
        }
      }
    }

    const lignes = [];
    const labels = [];
    if (afficherLignes) {
      for (const n of niveaux) {
        const estBSL = n.type === 'BSL';
        lignes.push({
          id: 'ligne-' + n.type + '-' + n.indexOrigine,
          prix: n.prix,
          dateDebut: n.tempsOrigine,
          dateFin: n.tempsFin,
          couleur: estBSL ? '#f59e0b' : '#38bdf8',
          style: 'solid',
          label: n.type + ' (' + (estBSL ? 'Résistance' : 'Support') + ')'
        });
      }
    }

    if (afficherEtiquettes) {
      const dernierBSL = niveaux.filter(function(n) { return n.type === 'BSL'; }).pop();
      const dernierSSL = niveaux.filter(function(n) { return n.type === 'SSL'; }).pop();
      if (dernierBSL) {
        labels.push({
          id: 'lbl-bsl-' + dernierBSL.indexOrigine,
          prix: dernierBSL.prix,
          date: dernierBSL.tempsFin,
          texte: '🎯 BSL: ' + dernierBSL.prix.toFixed(4),
          couleur: '#f59e0b',
          position: 'above'
        });
      }
      if (dernierSSL) {
        labels.push({
          id: 'lbl-ssl-' + dernierSSL.indexOrigine,
          prix: dernierSSL.prix,
          date: dernierSSL.tempsFin,
          texte: '🎯 SSL: ' + dernierSSL.prix.toFixed(4),
          couleur: '#38bdf8',
          position: 'below'
        });
      }
    }

    return {
      donnees: { niveaux: niveaux },
      primitives: { boites: [], lignes: lignes, labels: labels }
    };
  }
};
