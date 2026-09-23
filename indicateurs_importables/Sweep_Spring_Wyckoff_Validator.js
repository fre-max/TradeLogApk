/**
 * ==============================================================================
 * INDICATEUR SCRIPTABLE AUTONOME : SWEEP / SPRING WYCKOFF VALIDATOR
 * Traduit depuis Indicateur_Sweep_Spring_Validation.mq5
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
    if (!bougies || bougies.length < 50) {
      return { donnees: {}, primitives: { boites: [], lignes: [], labels: [] } };
    }

    const params = parametres || {};
    const sensibilite = Number(params.sensibilitePivot || 5);
    const maxLookback = Number(params.maxLookbackBars || 1000);
    const ratioMaxTemps = Number(params.ratioMaxTemps || 0.10);
    const nbConsolidation = Number(params.nbBougiesConsolidation || 3);
    const activerSpringSSL = params.activerSpringSSL !== false;
    const activerUTADBSL = params.activerUTADBSL !== false;

    // 1. Détection des niveaux BSL et SSL
    const depart = Math.max(sensibilite * 2 + 5, bougies.length - maxLookback);
    const niveaux = [];

    for (let bar = depart; bar < bougies.length; bar++) {
      const c = bar - sensibilite;
      if (c >= sensibilite) {
        let estHaut = true;
        for (let k = c - sensibilite; k < c; k++) {
          if (k >= 0 && bougies[k].high > bougies[c].high) { estHaut = false; break; }
        }
        if (estHaut) {
          for (let k = c + 1; k <= c + sensibilite; k++) {
            if (k < bougies.length && bougies[k].high >= bougies[c].high) { estHaut = false; break; }
          }
        }
        if (estHaut) {
          niveaux.push({ type: 'BSL', prix: bougies[c].high, index: c, temps: bougies[c].time });
        }

        let estBas = true;
        for (let k = c - sensibilite; k < c; k++) {
          if (k >= 0 && bougies[k].low < bougies[c].low) { estBas = false; break; }
        }
        if (estBas) {
          for (let k = c + 1; k <= c + sensibilite; k++) {
            if (k < bougies.length && bougies[k].low <= bougies[c].low) { estBas = false; break; }
          }
        }
        if (estBas) {
          niveaux.push({ type: 'SSL', prix: bougies[c].low, index: c, temps: bougies[c].time });
        }
      }
    }

    // 2. Détection des signaux de Spring (SSL) et UTAD (BSL)
    const boites = [];
    const labels = [];
    const signaux = [];

    for (const niveau of niveaux) {
      if (niveau.type === 'SSL' && !activerSpringSSL) continue;
      if (niveau.type === 'BSL' && !activerUTADBSL) continue;

      const estAchat = niveau.type === 'SSL';
      let indexBOS = -1;
      let extremePrix = estAchat ? 999999 : -999999;

      for (let b = niveau.index + 1; b < bougies.length; b++) {
        const bg = bougies[b];
        const aCasse = estAchat ? (bg.low < niveau.prix) : (bg.high > niveau.prix);

        if (aCasse && indexBOS === -1) {
          indexBOS = b;
          extremePrix = estAchat ? bg.low : bg.high;
        } else if (indexBOS !== -1) {
          if (estAchat && bg.low < extremePrix) extremePrix = bg.low;
          if (!estAchat && bg.high > extremePrix) extremePrix = bg.high;

          // Réintégration
          const aReintegre = estAchat ? (bg.close > niveau.prix) : (bg.close < niveau.prix);
          if (aReintegre) {
            const dureeHors = b - indexBOS + 1;
            const dureeDepuisPivot = indexBOS - niveau.index;
            const maxPermis = Math.max(2, Math.round(dureeDepuisPivot * ratioMaxTemps));

            if (dureeHors <= maxPermis) {
              // Vérification consolidation
              let valide = true;
              const indexSignal = b + nbConsolidation;
              if (indexSignal < bougies.length) {
                for (let c = b + 1; c <= indexSignal; c++) {
                  const check = estAchat ? (bougies[c].low >= extremePrix) : (bougies[c].high <= extremePrix);
                  if (!check) { valide = false; break; }
                }

                if (valide) {
                  const bgSignal = bougies[indexSignal];
                  signaux.push({
                    direction: estAchat ? 'achat' : 'vente',
                    prixEntree: bgSignal.close,
                    stopLoss: extremePrix,
                    niveauLiquidite: niveau.prix
                  });

                  boites.push({
                    id: 'sweep-' + indexBOS + '-' + (estAchat ? 'buy' : 'sell'),
                    prixHaut: Math.max(niveau.prix, extremePrix),
                    prixBas: Math.min(niveau.prix, extremePrix),
                    dateDebut: bougies[indexBOS].time,
                    dateFin: bgSignal.time,
                    couleurFond: estAchat ? 'rgba(8, 153, 129, 0.20)' : 'rgba(242, 54, 69, 0.20)',
                    couleurBordure: estAchat ? '#089981' : '#f23645',
                    label: estAchat ? '🟢 Spring Wyckoff' : '🔴 UTAD Wyckoff'
                  });

                  labels.push({
                    id: 'sig-' + indexSignal,
                    prix: estAchat ? bgSignal.low : bgSignal.high,
                    date: bgSignal.time,
                    texte: estAchat ? '⬆️ ACHAT Spring' : '⬇️ VENTE UTAD',
                    couleur: estAchat ? '#089981' : '#f23645',
                    position: estAchat ? 'below' : 'above'
                  });
                  break;
                }
              }
            }
          }
        }
      }
    }

    return {
      donnees: { signaux: signaux },
      primitives: { boites: boites, lignes: [], labels: labels }
    };
  }
};
