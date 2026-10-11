/**
 * ==============================================================================
 * INDICATEUR SCRIPTABLE AUTONOME : LIQ/REINT + SWEEP LIQUIDITÉ (BSL/SSL)
 * Version 1.1.0
 * 
 * Combine le setup de Price Action Liquidation & Réintégration avec l'analyse
 * de la liquidité balayée dans l'historique et la détection des Multi-Liquidations
 * sur Support / Résistance (Simple 1x, Double 2x, Triple 3x) :
 * 1. Détecte le setup à 2 bougies (Bougie 1 étendue + Bougie 2 réintégration avec proximité asymétrique).
 * 2. Identifie quelle liquidité vendeuse (SSL) ou acheteuse (BSL) préalable a été balayée
 *    par la mèche extrême du setup (par Bougie 1 ou Bougie 2).
 * 3. Analyse si ce niveau S/R a subi de multiples balayages (Double ou Triple Liquidation).
 * 4. Trace la ligne de liquidité balayée, les lignes de multi-sweep et délimite les zones.
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

    const sensibiliteLiquidite = Math.max(2, Number(params.sensibilitePivotLiquidite ?? 4));
    const lookbackLiquidite = Math.max(10, Number(params.lookbackLiquidite ?? 100));
    const exigerLiquidite = params.exigerLiquiditeBalayee !== false;

    const valZoneSR = params.toleranceZoneSR !== undefined ? params.toleranceZoneSR : 0.15;
    const toleranceZoneSR = valZoneSR > 1 ? valZoneSR / 100 : (valZoneSR >= 0.05 ? valZoneSR / 100 : valZoneSR);
    const seuilMinLiquidations = Math.max(1, Math.min(3, Number(params.seuilMinLiquidations ?? 1)));
    const afficherLignesMultiSweep = params.afficherLignesMultiSweep !== false;
    const afficherZoneSR = params.afficherZoneSR !== false;

    const activerFiltreTaille = params.activerFiltreTaille !== false;
    const periodeHistorique = Math.max(3, Number(params.periodeHistorique ?? 10));
    const multiplicateurBougie1 = Math.max(0.5, Number(params.multiplicateurBougie1 ?? 1.75));
    const multiplicateurCorps2 = Math.max(0.5, Number(params.multiplicateurCorps2 ?? 1.75));

    const activerAchat = params.activerAchat !== false;
    const activerVente = params.activerVente !== false;
    const bullColor = params.bullColor || '#00E676';
    const bearColor = params.bearColor || '#F23645';
    const texteLabel = params.texteLabel || 'Liq/Reint';

    const signaux = [];
    const labels = [];
    const lignes = [];
    const boites = [];
    const points = [];
    let countAchats = 0;
    let countVentes = 0;
    let countAchatsSweep = 0;
    let countVentesSweep = 0;
    let countSimples = 0;
    let countDoubles = 0;
    let countTriples = 0;

    // Détection locale des pivots
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

      // Proximité asymétrique
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

      // Filtre de momentum historique
      let tailleOk = true;
      if (activerFiltreTaille) {
        const idxFin = i - 2;
        const idxDeb = Math.max(0, i - 1 - periodeHistorique);
        const nb = idxFin - idxDeb + 1;
        if (nb >= 3) {
          let sR = 0, sC = 0;
          for (let k = idxDeb; k <= idxFin; k++) {
            sR += (bougies[k].high - bougies[k].low);
            sC += Math.abs(bougies[k].open - bougies[k].close);
          }
          const mR = sR / nb, mC = sC / nb;
          tailleOk = range1 >= (multiplicateurBougie1 * mR) && corps2 >= (multiplicateurCorps2 * mC);
        }
      }
      if (!tailleOk) continue;

      const idxFinRecherche = i - 2;
      const idxDebRecherche = Math.max(0, idxFinRecherche - lookbackLiquidite);
      let liqTrouvee = null;

      // 3️⃣ Cas Achat (Sweep SSL + Reint)
      if (estAchat) {
        const prixExtreme = Math.min(b1.low, b2.low);
        const bougieExt = b2.low <= b1.low ? 2 : 1;
        const hautRef = Math.max(b1.open, b1.high);

        for (let k = idxFinRecherche; k >= idxDebRecherche; k--) {
          if (estPivotBas(bougies, k, sensibiliteLiquidite, idxFinRecherche)) {
            const creux = bougies[k].low;
            if (prixExtreme < creux && creux <= hautRef) {
              liqTrouvee = {
                type: 'SSL',
                prix: creux,
                indexOrigine: k,
                tempsOrigine: bougies[k].time,
                profondeur: creux - prixExtreme,
                balayagesPrecedents: []
              };
              break;
            }
          }
        }

        if (exigerLiquidite && !liqTrouvee) continue;

        // Analyse multi-sweep support
        if (liqTrouvee) {
          const margeZone = Math.max(0.0001, liqTrouvee.prix * toleranceZoneSR);
          const sensCluster = Math.max(1, Math.floor(sensibiliteLiquidite / 2));
          for (let j = idxDebRecherche; j <= idxFinRecherche; j++) {
            if (Math.abs(j - liqTrouvee.indexOrigine) < 2) continue;
            if (estPivotBas(bougies, j, sensCluster, idxFinRecherche)) {
              const lowJ = bougies[j].low;
              if (lowJ <= liqTrouvee.prix + margeZone && lowJ >= liqTrouvee.prix - (margeZone * 3)) {
                liqTrouvee.balayagesPrecedents.push({
                  index: j,
                  temps: bougies[j].time,
                  prix: lowJ
                });
              }
            }
          }

          liqTrouvee.totalSweeps = 1 + liqTrouvee.balayagesPrecedents.length;
          if (liqTrouvee.totalSweeps < seuilMinLiquidations) continue;

          countAchatsSweep++;
          if (liqTrouvee.totalSweeps === 1) countSimples++;
          else if (liqTrouvee.totalSweeps === 2) countDoubles++;
          else countTriples++;
        }
        countAchats++;

        signaux.push({
          type: 'ACHAT',
          indexBougie: i,
          temps: b2.time,
          prixSignal: b2.low,
          prixExtreme,
          bougieExtreme: bougieExt,
          open1: b1.open,
          close2: b2.close,
          ecartPrix,
          ratioEcart,
          situationCloture: situation,
          liquidite: liqTrouvee
        });

        let badgeMulti = '';
        if (liqTrouvee) {
          if (liqTrouvee.totalSweeps === 2) badgeMulti = ' 🔥 [Double Sweep 2x]';
          else if (liqTrouvee.totalSweeps >= 3) badgeMulti = ` 🚀 [Triple Sweep ${liqTrouvee.totalSweeps}x]`;
          else badgeMulti = ' [1x]';
        }

        const lbl = liqTrouvee
          ? `${texteLabel}${badgeMulti}\nSweep SSL (${liqTrouvee.prix.toFixed(4)})`
          : texteLabel;

        labels.push({ id: `c-a-lbl-${i}`, prix: b2.low, date: b2.time, texte: lbl, couleur: bullColor, position: 'below' });
        points.push({ id: `c-a-pt-${i}`, prix: prixExtreme, date: bougieExt === 1 ? b1.time : b2.time, couleur: bullColor });

        if (liqTrouvee) {
          lignes.push({
            id: `c-a-lig-${i}`,
            prix: liqTrouvee.prix,
            dateDebut: liqTrouvee.tempsOrigine,
            dateFin: b2.time,
            couleur: bullColor,
            epaisseur: 1.5,
            style: 'dashed',
            label: `SSL Balayée (-${(liqTrouvee.profondeur * 10000).toFixed(1)} pips)`
          });

          if (afficherLignesMultiSweep && liqTrouvee.balayagesPrecedents.length > 0) {
            liqTrouvee.balayagesPrecedents.forEach((bal, idxBal) => {
              lignes.push({
                id: `c-a-ms-${i}-${idxBal}`,
                prix: bal.prix,
                dateDebut: bal.temps,
                dateFin: b2.time,
                couleur: 'rgba(0, 230, 118, 0.65)',
                epaisseur: 1,
                style: 'dotted',
                label: `Sweep Support #${idxBal + 1}`
              });
            });
          }

          boites.push({
            id: `c-a-box-${i}`,
            prixHaut: liqTrouvee.prix,
            prixBas: prixExtreme,
            dateDebut: b1.time,
            dateFin: b2.time,
            couleurFond: 'rgba(0, 230, 118, 0.15)',
            couleurBordure: bullColor,
            label: 'Zone de Sweep'
          });

          if (afficherZoneSR && liqTrouvee.totalSweeps >= 2) {
            const margeZone = liqTrouvee.prix * toleranceZoneSR;
            boites.push({
              id: `c-a-sr-${i}`,
              prixHaut: liqTrouvee.prix + margeZone,
              prixBas: liqTrouvee.prix - margeZone,
              dateDebut: liqTrouvee.tempsOrigine,
              dateFin: b2.time,
              couleurFond: 'rgba(0, 230, 118, 0.08)',
              couleurBordure: 'rgba(0, 230, 118, 0.4)',
              label: `Zone Support (${liqTrouvee.totalSweeps}x Sweeps)`
            });
          }
        }

      // 4️⃣ Cas Vente (Sweep BSL + Reint)
      } else if (estVente) {
        const prixExtreme = Math.max(b1.high, b2.high);
        const bougieExt = b2.high >= b1.high ? 2 : 1;
        const basRef = Math.min(b1.open, b1.low);

        for (let k = idxFinRecherche; k >= idxDebRecherche; k--) {
          if (estPivotHaut(bougies, k, sensibiliteLiquidite, idxFinRecherche)) {
            const sommet = bougies[k].high;
            if (prixExtreme > sommet && sommet >= basRef) {
              liqTrouvee = {
                type: 'BSL',
                prix: sommet,
                indexOrigine: k,
                tempsOrigine: bougies[k].time,
                profondeur: prixExtreme - sommet,
                balayagesPrecedents: []
              };
              break;
            }
          }
        }

        if (exigerLiquidite && !liqTrouvee) continue;

        if (liqTrouvee) {
          const margeZone = Math.max(0.0001, liqTrouvee.prix * toleranceZoneSR);
          const sensCluster = Math.max(1, Math.floor(sensibiliteLiquidite / 2));
          for (let j = idxDebRecherche; j <= idxFinRecherche; j++) {
            if (Math.abs(j - liqTrouvee.indexOrigine) < 2) continue;
            if (estPivotHaut(bougies, j, sensCluster, idxFinRecherche)) {
              const highJ = bougies[j].high;
              if (highJ >= liqTrouvee.prix - margeZone && highJ <= liqTrouvee.prix + (margeZone * 3)) {
                liqTrouvee.balayagesPrecedents.push({
                  index: j,
                  temps: bougies[j].time,
                  prix: highJ
                });
              }
            }
          }

          liqTrouvee.totalSweeps = 1 + liqTrouvee.balayagesPrecedents.length;
          if (liqTrouvee.totalSweeps < seuilMinLiquidations) continue;

          countVentesSweep++;
          if (liqTrouvee.totalSweeps === 1) countSimples++;
          else if (liqTrouvee.totalSweeps === 2) countDoubles++;
          else countTriples++;
        }
        countVentes++;

        signaux.push({
          type: 'VENTE',
          indexBougie: i,
          temps: b2.time,
          prixSignal: b2.high,
          prixExtreme,
          bougieExtreme: bougieExt,
          open1: b1.open,
          close2: b2.close,
          ecartPrix,
          ratioEcart,
          situationCloture: situation,
          liquidite: liqTrouvee
        });

        let badgeMulti = '';
        if (liqTrouvee) {
          if (liqTrouvee.totalSweeps === 2) badgeMulti = ' 🔥 [Double Sweep 2x]';
          else if (liqTrouvee.totalSweeps >= 3) badgeMulti = ` 🚀 [Triple Sweep ${liqTrouvee.totalSweeps}x]`;
          else badgeMulti = ' [1x]';
        }

        const lbl = liqTrouvee
          ? `${texteLabel}${badgeMulti}\nSweep BSL (${liqTrouvee.prix.toFixed(4)})`
          : texteLabel;

        labels.push({ id: `c-v-lbl-${i}`, prix: b2.high, date: b2.time, texte: lbl, couleur: bearColor, position: 'above' });
        points.push({ id: `c-v-pt-${i}`, prix: prixExtreme, date: bougieExt === 1 ? b1.time : b2.time, couleur: bearColor });

        if (liqTrouvee) {
          lignes.push({
            id: `c-v-lig-${i}`,
            prix: liqTrouvee.prix,
            dateDebut: liqTrouvee.tempsOrigine,
            dateFin: b2.time,
            couleur: bearColor,
            epaisseur: 1.5,
            style: 'dashed',
            label: `BSL Balayée (+${(liqTrouvee.profondeur * 10000).toFixed(1)} pips)`
          });

          if (afficherLignesMultiSweep && liqTrouvee.balayagesPrecedents.length > 0) {
            liqTrouvee.balayagesPrecedents.forEach((bal, idxBal) => {
              lignes.push({
                id: `c-v-ms-${i}-${idxBal}`,
                prix: bal.prix,
                dateDebut: bal.temps,
                dateFin: b2.time,
                couleur: 'rgba(242, 54, 69, 0.65)',
                epaisseur: 1,
                style: 'dotted',
                label: `Sweep Résistance #${idxBal + 1}`
              });
            });
          }

          boites.push({
            id: `c-v-box-${i}`,
            prixHaut: prixExtreme,
            prixBas: liqTrouvee.prix,
            dateDebut: b1.time,
            dateFin: b2.time,
            couleurFond: 'rgba(242, 54, 69, 0.15)',
            couleurBordure: bearColor,
            label: 'Zone de Sweep'
          });

          if (afficherZoneSR && liqTrouvee.totalSweeps >= 2) {
            const margeZone = liqTrouvee.prix * toleranceZoneSR;
            boites.push({
              id: `c-v-sr-${i}`,
              prixHaut: liqTrouvee.prix + margeZone,
              prixBas: liqTrouvee.prix - margeZone,
              dateDebut: liqTrouvee.tempsOrigine,
              dateFin: b2.time,
              couleurFond: 'rgba(242, 54, 69, 0.08)',
              couleurBordure: 'rgba(242, 54, 69, 0.4)',
              label: `Zone Résistance (${liqTrouvee.totalSweeps}x Sweeps)`
            });
          }
        }
      }
    }

    return {
      signaux,
      primitives: { labels, lignes, boites, points },
      statistiques: {
        totalSignaux: signaux.length,
        totalAchats: countAchats,
        totalVentes: countVentes,
        totalLiquiditesBalayees: countAchatsSweep + countVentesSweep,
        totalSimplesLiquidations: countSimples,
        totalDoublesLiquidations: countDoubles,
        totalTriplesLiquidations: countTriples
      }
    };
  }
};
