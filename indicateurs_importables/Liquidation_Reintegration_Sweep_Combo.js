/**
 * ==============================================================================
 * INDICATEUR SCRIPTABLE AUTONOME : LIQ/REINT + SWEEP LIQUIDITÉ (BSL/SSL)
 * Version 1.2.0
 * 
 * Combine le setup de Price Action Liquidation & Réintégration avec l'analyse
 * et la sélection intelligente de la Liquidité la plus Adaptée (BSL/SSL) :
 * 1. Détecte le setup à 2 bougies (Bougie 1 étendue + Bougie 2 réintégration avec proximité asymétrique).
 * 2. Identifie et sélectionne la liquidité la plus pertinente balayée par la mèche extrême,
 *    en évaluant la proportionnalité de la pénétration, le relief du pivot et la proximité.
 * 3. Trace la ligne de liquidité balayée avec badge de score et délimite la zone de sweep.
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

    // Si la fonction native du moteur est présente dans l'environnement
    if (typeof calculerLiquidationSweepCombo === 'function') {
      const res = calculerLiquidationSweepCombo(bougies, parametres);
      return {
        donnees: res,
        primitives: res.primitives,
        typeSpecial: 'liquidation-sweep-combo'
      };
    }

    // 1️⃣ Extraction des paramètres
    const params = parametres || {};
    const valDeficit = params.toleranceDeficit !== undefined ? params.toleranceDeficit : 0.05;
    const toleranceDeficit = valDeficit > 1 ? valDeficit / 100 : valDeficit;
    const valDepassement = params.toleranceDepassement !== undefined ? params.toleranceDepassement : 0.25;
    const toleranceDepassement = valDepassement > 1 ? valDepassement / 100 : valDepassement;

    const modeSelection = params.modeSelectionLiquidite || 'SCORE_OPTIMAL';
    const sensibiliteLiquidite = Math.max(2, Number(params.sensibilitePivotLiquidite ?? 3));
    const lookbackLiquidite = Math.max(10, Number(params.lookbackLiquidite ?? 80));
    const distanceMinBougies = Math.max(1, Number(params.distanceMinBougies ?? 3));
    const exigerLiquidite = params.exigerLiquiditeBalayee !== false;

    const reliefMinPivot = Math.max(0.1, Number(params.reliefMinPivot ?? 0.5));
    const penetrationMaxRatio = Math.max(0.5, Number(params.penetrationMaxRatio ?? 1.5));
    const penetrationMinRatio = Math.max(0.01, Number(params.penetrationMinRatio ?? 0.05));
    const exigerNiveauIntact = params.exigerNiveauIntact !== false;

    const activerFiltreTaille = params.activerFiltreTaille !== false;
    const periodeHistorique = Math.max(3, Number(params.periodeHistorique ?? 10));
    const multiplicateurBougie1 = Math.max(0.5, Number(params.multiplicateurBougie1 ?? 1.75));
    const multiplicateurCorps2 = Math.max(0.5, Number(params.multiplicateurCorps2 ?? 1.75));

    const activerAchat = params.activerAchat !== false;
    const activerVente = params.activerVente !== false;
    const bullColor = params.bullColor || '#00E676';
    const bearColor = params.bearColor || '#F23645';
    const texteLabel = params.texteLabel || 'Liq/Reint';
    const afficherLignes = params.afficherLigneLiquidite !== false;
    const afficherZones = params.afficherZoneSweep !== false;
    const afficherBadgeScore = params.afficherBadgeScore !== false;

    const signaux = [];
    const labels = [];
    const lignes = [];
    const boites = [];
    const points = [];
    let countAchats = 0;
    let countVentes = 0;
    let countAchatsSweep = 0;
    let countVentesSweep = 0;
    let countMajeurs = 0;
    let countMoyens = 0;
    let countMineurs = 0;
    let sommeScores = 0;

    // Fonctions locales de détection de pivots
    function estPivotHaut(arr, idx, sens, maxIdx) {
      const val = arr[idx].high;
      for (let k = idx - sens; k < idx; k++) if (k >= 0 && arr[k].high > val) return false;
      const lim = Math.min(maxIdx, idx + sens);
      for (let k = idx + 1; k <= lim; k++) if (arr[k].high >= val) return false;
      return true;
    }

    function estPivotBas(arr, idx, sens, maxIdx) {
      const val = arr[idx].low;
      for (let k = idx - sens; k < idx; k++) if (k >= 0 && arr[k].low < val) return false;
      const lim = Math.min(maxIdx, idx + sens);
      for (let k = idx + 1; k <= lim; k++) if (arr[k].low <= val) return false;
      return true;
    }

    function calcRelief(arr, idx, sens, type) {
      const d = Math.max(0, idx - sens * 2);
      const f = Math.min(arr.length - 1, idx + sens * 2);
      if (type === 'CREUX') {
        const c = arr[idx].low;
        let mx = c;
        for (let j = d; j <= f; j++) if (arr[j].high > mx) mx = arr[j].high;
        return Math.max(0.0001, mx - c);
      } else {
        const s = arr[idx].high;
        let mn = s;
        for (let j = d; j <= f; j++) if (arr[j].low < mn) mn = arr[j].low;
        return Math.max(0.0001, s - mn);
      }
    }

    function estIntact(arr, idx, fin, px, type) {
      for (let j = idx + 1; j <= fin; j++) {
        if (type === 'ACHAT' && arr[j].low < px) return false;
        if (type === 'VENTE' && arr[j].high > px) return false;
      }
      return true;
    }

    // 2️⃣ Détection des opportunités
    for (let i = 1; i < bougies.length; i++) {
      const b1 = bougies[i - 1];
      const b2 = bougies[i];
      const range1 = b1.high - b1.low;
      const range2 = b2.high - b2.low;
      const corps2 = Math.abs(b2.open - b2.close);
      const hauteurMoy = (range1 + range2) / 2;
      if (hauteurMoy <= 0) continue;

      const estAchat = activerAchat && (b1.close < b1.open) && (b2.close > b2.open);
      const estVente = activerVente && (b1.close > b1.open) && (b2.close < b2.open);
      if (!estAchat && !estVente) continue;

      const ecartPrix = Math.abs(b1.open - b2.close);
      const ratioEcart = ecartPrix / hauteurMoy;
      let situation = 'RETRAIT';
      let proximiteOk = false;
      if (estAchat) {
        if (b2.close >= b1.open) { situation = 'DEPASSEMENT'; proximiteOk = ratioEcart <= toleranceDepassement; }
        else { situation = 'RETRAIT'; proximiteOk = ratioEcart <= toleranceDeficit; }
      } else if (estVente) {
        if (b2.close <= b1.open) { situation = 'DEPASSEMENT'; proximiteOk = ratioEcart <= toleranceDepassement; }
        else { situation = 'RETRAIT'; proximiteOk = ratioEcart <= toleranceDeficit; }
      }
      if (!proximiteOk) continue;

      let moyRangeRef = hauteurMoy;
      if (activerFiltreTaille) {
        const finH = i - 2;
        const debH = Math.max(0, i - 1 - periodeHistorique);
        const nbH = finH - debH + 1;
        if (nbH >= 3) {
          let sR = 0; let sC = 0;
          for (let k = debH; k <= finH; k++) {
            sR += (bougies[k].high - bougies[k].low);
            sC += Math.abs(bougies[k].open - bougies[k].close);
          }
          const mR = sR / nbH;
          const mC = sC / nbH;
          moyRangeRef = mR;
          if (range1 < multiplicateurBougie1 * mR || corps2 < multiplicateurCorps2 * mC) continue;
        }
      }

      let prixExtreme = 0;
      let bougieExtreme = 1;
      const indexFinRecherche = i - 2;

      if (estAchat) {
        if (b2.low <= b1.low) { prixExtreme = b2.low; bougieExtreme = 2; }
        else { prixExtreme = b1.low; bougieExtreme = 1; }

        // Sélection de la liquidité la plus adaptée
        const idxDeb = Math.max(0, indexFinRecherche - lookbackLiquidite);
        const idxMaxScan = Math.max(0, indexFinRecherche - distanceMinBougies);
        const candidats = [];

        for (let k = idxMaxScan; k >= idxDeb; k--) {
          if (estPivotBas(bougies, k, sensibiliteLiquidite, indexFinRecherche)) {
            const lowK = bougies[k].low;
            if (prixExtreme < lowK && lowK <= Math.max(b1.open, b1.high)) {
              if (exigerNiveauIntact && !estIntact(bougies, k, indexFinRecherche, lowK, 'ACHAT')) continue;
              const profondeur = lowK - prixExtreme;
              const rSweep = profondeur / moyRangeRef;
              if (rSweep < penetrationMinRatio || rSweep > penetrationMaxRatio) continue;

              const rel = calcRelief(bougies, k, sensibiliteLiquidite, 'CREUX');
              const rRel = rel / moyRangeRef;
              if (rRel < reliefMinPivot) continue;

              const dist = i - k;
              const ptsRel = Math.min(45, (rRel / 2.0) * 45);
              let ptsSw = 35;
              if (rSweep < 0.15) ptsSw = Math.max(10, 35 - ((0.15 - rSweep) / 0.15) * 25);
              else if (rSweep > 0.8) ptsSw = Math.max(10, 35 - ((rSweep - 0.8) / (penetrationMaxRatio - 0.8 || 1)) * 25);
              let ptsPr = 20;
              if (dist > 35) ptsPr = Math.max(5, 20 - ((dist - 35) / Math.max(1, lookbackLiquidite - 35)) * 15);
              const score = Math.min(100, Math.round(ptsRel + ptsSw + ptsPr));
              const qualite = rRel >= 1.5 ? 'MAJEUR' : (rRel >= 0.75 ? 'MOYEN' : 'MINEUR');

              candidats.push({
                type: 'SSL', prix: lowK, indexOrigine: k, tempsOrigine: bougies[k].time,
                distanceBougies: dist, profondeurSweep: profondeur, ratioSweep: rSweep,
                reliefPivot: rel, ratioRelief: rRel, scoreAdequation: score, qualiteNiveau: qualite
              });
            }
          }
        }

        let elue = null;
        if (candidats.length > 0) {
          if (modeSelection === 'SWING_MAJEUR') elue = candidats.reduce((m, c) => c.ratioRelief > m.ratioRelief ? c : m, candidats[0]);
          else if (modeSelection === 'RECENT_VALIDE') elue = candidats.reduce((m, c) => c.distanceBougies < m.distanceBougies ? c : m, candidats[0]);
          else elue = candidats.reduce((m, c) => c.scoreAdequation > m.scoreAdequation ? c : m, candidats[0]);
        }

        if (exigerLiquidite && !elue) continue;

        if (elue) {
          countAchatsSweep++;
          sommeScores += elue.scoreAdequation;
          if (elue.qualiteNiveau === 'MAJEUR') countMajeurs++;
          else if (elue.qualiteNiveau === 'MOYEN') countMoyens++;
          else countMineurs++;
        }
        countAchats++;

        signaux.push({
          type: 'ACHAT', indexBougie: i, temps: b2.time, prixSignal: b2.low,
          prixExtreme, bougieExtreme, open1: b1.open, close2: b2.close,
          ecartPrix, ratioEcart, situationCloture: situation, rangeBougie1: range1, corpsBougie2: corps2,
          liquidite: elue || undefined
        });

        let badge = '';
        if (elue && afficherBadgeScore) {
          badge = ` [${elue.scoreAdequation}%${elue.qualiteNiveau === 'MAJEUR' ? ' ★' : ''}]`;
        }
        labels.push({
          id: `combo-achat-${i}`,
          prix: b2.low,
          date: b2.time,
          texte: elue ? `${texteLabel}${badge}\nSweep SSL (${elue.prix.toFixed(4)})` : texteLabel,
          couleur: bullColor,
          position: 'below'
        });

        points.push({ id: `combo-pt-${i}`, prix: prixExtreme, date: bougieExtreme === 1 ? b1.time : b2.time, couleur: bullColor });

        if (elue && afficherLignes) {
          lignes.push({
            id: `combo-ligne-${i}`,
            prix: elue.prix,
            dateDebut: elue.tempsOrigine,
            dateFin: b2.time,
            couleur: bullColor,
            epaisseur: 1.5,
            style: 'dashed',
            label: `SSL Balayée (${elue.qualiteNiveau} -${(elue.profondeurSweep * 10000).toFixed(1)}p)`
          });
        }
        if (elue && afficherZones) {
          boites.push({
            id: `combo-box-${i}`,
            prixHaut: elue.prix,
            prixBas: prixExtreme,
            dateDebut: b1.time,
            dateFin: b2.time,
            couleurFond: 'rgba(0, 230, 118, 0.15)',
            couleurBordure: bullColor,
            label: `Zone Sweep (${elue.scoreAdequation}%)`
          });
        }
      } else if (estVente) {
        if (b2.high >= b1.high) { prixExtreme = b2.high; bougieExtreme = 2; }
        else { prixExtreme = b1.high; bougieExtreme = 1; }

        const idxDeb = Math.max(0, indexFinRecherche - lookbackLiquidite);
        const idxMaxScan = Math.max(0, indexFinRecherche - distanceMinBougies);
        const candidats = [];

        for (let k = idxMaxScan; k >= idxDeb; k--) {
          if (estPivotHaut(bougies, k, sensibiliteLiquidite, indexFinRecherche)) {
            const highK = bougies[k].high;
            if (prixExtreme > highK && highK >= Math.min(b1.open, b1.low)) {
              if (exigerNiveauIntact && !estIntact(bougies, k, indexFinRecherche, highK, 'VENTE')) continue;
              const profondeur = prixExtreme - highK;
              const rSweep = profondeur / moyRangeRef;
              if (rSweep < penetrationMinRatio || rSweep > penetrationMaxRatio) continue;

              const rel = calcRelief(bougies, k, sensibiliteLiquidite, 'SOMMET');
              const rRel = rel / moyRangeRef;
              if (rRel < reliefMinPivot) continue;

              const dist = i - k;
              const ptsRel = Math.min(45, (rRel / 2.0) * 45);
              let ptsSw = 35;
              if (rSweep < 0.15) ptsSw = Math.max(10, 35 - ((0.15 - rSweep) / 0.15) * 25);
              else if (rSweep > 0.8) ptsSw = Math.max(10, 35 - ((rSweep - 0.8) / (penetrationMaxRatio - 0.8 || 1)) * 25);
              let ptsPr = 20;
              if (dist > 35) ptsPr = Math.max(5, 20 - ((dist - 35) / Math.max(1, lookbackLiquidite - 35)) * 15);
              const score = Math.min(100, Math.round(ptsRel + ptsSw + ptsPr));
              const qualite = rRel >= 1.5 ? 'MAJEUR' : (rRel >= 0.75 ? 'MOYEN' : 'MINEUR');

              candidats.push({
                type: 'BSL', prix: highK, indexOrigine: k, tempsOrigine: bougies[k].time,
                distanceBougies: dist, profondeurSweep: profondeur, ratioSweep: rSweep,
                reliefPivot: rel, ratioRelief: rRel, scoreAdequation: score, qualiteNiveau: qualite
              });
            }
          }
        }

        let elue = null;
        if (candidats.length > 0) {
          if (modeSelection === 'SWING_MAJEUR') elue = candidats.reduce((m, c) => c.ratioRelief > m.ratioRelief ? c : m, candidats[0]);
          else if (modeSelection === 'RECENT_VALIDE') elue = candidats.reduce((m, c) => c.distanceBougies < m.distanceBougies ? c : m, candidats[0]);
          else elue = candidats.reduce((m, c) => c.scoreAdequation > m.scoreAdequation ? c : m, candidats[0]);
        }

        if (exigerLiquidite && !elue) continue;

        if (elue) {
          countVentesSweep++;
          sommeScores += elue.scoreAdequation;
          if (elue.qualiteNiveau === 'MAJEUR') countMajeurs++;
          else if (elue.qualiteNiveau === 'MOYEN') countMoyens++;
          else countMineurs++;
        }
        countVentes++;

        signaux.push({
          type: 'VENTE', indexBougie: i, temps: b2.time, prixSignal: b2.high,
          prixExtreme, bougieExtreme, open1: b1.open, close2: b2.close,
          ecartPrix, ratioEcart, situationCloture: situation, rangeBougie1: range1, corpsBougie2: corps2,
          liquidite: elue || undefined
        });

        let badge = '';
        if (elue && afficherBadgeScore) {
          badge = ` [${elue.scoreAdequation}%${elue.qualiteNiveau === 'MAJEUR' ? ' ★' : ''}]`;
        }
        labels.push({
          id: `combo-vente-${i}`,
          prix: b2.high,
          date: b2.time,
          texte: elue ? `${texteLabel}${badge}\nSweep BSL (${elue.prix.toFixed(4)})` : texteLabel,
          couleur: bearColor,
          position: 'above'
        });

        points.push({ id: `combo-pt-${i}`, prix: prixExtreme, date: bougieExtreme === 1 ? b1.time : b2.time, couleur: bearColor });

        if (elue && afficherLignes) {
          lignes.push({
            id: `combo-ligne-${i}`,
            prix: elue.prix,
            dateDebut: elue.tempsOrigine,
            dateFin: b2.time,
            couleur: bearColor,
            epaisseur: 1.5,
            style: 'dashed',
            label: `BSL Balayée (${elue.qualiteNiveau} +${(elue.profondeurSweep * 10000).toFixed(1)}p)`
          });
        }
        if (elue && afficherZones) {
          boites.push({
            id: `combo-box-${i}`,
            prixHaut: prixExtreme,
            prixBas: elue.prix,
            dateDebut: b1.time,
            dateFin: b2.time,
            couleurFond: 'rgba(242, 54, 69, 0.15)',
            couleurBordure: bearColor,
            label: `Zone Sweep (${elue.scoreAdequation}%)`
          });
        }
      }
    }

    const totalSweep = countAchatsSweep + countVentesSweep;
    return {
      signaux,
      primitives: { labels, lignes, boites, points },
      statistiques: {
        totalSignaux: signaux.length,
        totalAchats: countAchats,
        totalVentes: countVentes,
        totalLiquiditesBalayees: totalSweep,
        totalAchatsAvecSweep: countAchatsSweep,
        totalVentesAvecSweep: countVentesSweep,
        totalNiveauxMajeurs: countMajeurs,
        totalNiveauxMoyens: countMoyens,
        totalNiveauxMineurs: countMineurs,
        scoreMoyenAdequation: totalSweep > 0 ? Math.round(sommeScores / totalSweep) : 0
      }
    };
  }
};
