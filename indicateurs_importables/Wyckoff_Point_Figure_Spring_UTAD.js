/**
 * ==============================================================================
 * INDICATEUR SCRIPTABLE AUTONOME : WYCKOFF POINT & FIGURE (SPRING & UTAD)
 * ==============================================================================
 * 
 * Cet indicateur combine :
 * 1. La géométrie épurée du Point & Figure (P&F) pour identifier les Ranges
 *    et éliminer le bruit des mèches.
 * 2. L'évaluation de la SOLIDITÉ DU NIVEAU (comptage précis des retests) :
 *    - Niveau Faible : 1 retest
 *    - Niveau Standard : 2 retests
 *    - Niveau Majeur : 3 retests
 *    - Niveau Institutionnel (A+) : 4 retests et plus (Forteresse)
 * 3. La détection chirurgicale des Springs (Accumulation) et UTAD (Distribution).
 * 4. La loi de Cause à Effet de Wyckoff (calcul automatique de l'objectif de prix
 *    via le comptage horizontal des colonnes P&F).
 * 5. UN FILTRE DE GRANDES BOUGIES (V-SHAPE REVERSAL & PINBAR DE LIQUIDATION) :
 *    - Cas 1 (1 Bougie seule) : Rejet violent par Pinbar/Marteau avec longue mèche.
 *    - Cas 2 (2/3 Bougies) : V-Shape Reversal rapide où la bougie de réintégration
 *      est dominante (taille >= bougie de liquidation pour prouver l'absorption).
 * 6. UN FILTRE DE VOLUME TOTALEMENT PARAMÉTRABLE ET DÉBRAYABLE :
 *    - Mode Pur P&F (Volume désactivé) : validation sur la réintégration du prix.
 *    - Mode Hybride Wyckoff (Volume activé) : validation par absorption (Climax)
 *      ou par assèchement (Test à faible volume).
 * 
 * 💡 UTILISATION SUR SMARTPHONE (TRADELOG) :
 * 1. Ouvrez TradeLog -> Graphique ou Backtest -> Cliquez sur "Indicateurs".
 * 2. Cliquez sur "Importer" et choisissez ce fichier (.js ou .json).
 * ==============================================================================
 */

return {
  calculer: function (contexte) {
    // 1️⃣ Vérifications préalables des données reçues
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 50) {
      return { donnees: {}, primitives: { boites: [], lignes: [], labels: [] } };
    }

    // 2️⃣ Lecture des paramètres configurables par l'utilisateur
    const params = parametres || {};
    const modeTailleBox = String(params.modeTailleBox || 'auto_atr');
    const periodeATR = Number(params.periodeATR || 14);
    const ratioBoxATR = Number(params.ratioBoxATR || 0.5);
    const tailleBoxPips = Number(params.tailleBoxPips || 10);
    const reversalCount = Number(params.reversalCount || 3);
    const colonnesMinRange = Number(params.colonnesMinRange || 4);
    const minRetestsRequis = Number(params.minRetestsRequis || 2);
    const maxLookback = Number(params.maxLookbackBars || 1000);

    // Paramètres du filtre de Volume (Optionnel et Paramétrable)
    const activerFiltreVolume = params.activerFiltreVolume !== false;
    const typeValidationVolume = String(params.typeValidationVolume || 'climax_ou_test');
    const seuilRatioVolume = Number(params.seuilRatioVolume || 1.3);
    const periodeMoyenneVolume = Number(params.periodeMoyenneVolume || 20);

    // Paramètres du filtre de Grandes Bougies & V-Shape (Nouveau)
    const activerFiltreGrandesBougies = params.activerFiltreGrandesBougies !== false;
    const multiplicateurTailleATR = Number(params.multiplicateurTailleATR || 1.3);
    const exigerRetourSuperieurOuEgal = params.exigerRetourSuperieurOuEgal !== false;
    const maxBougiesHorsRange = Number(params.maxBougiesHorsRange || 3);
    const ratioMecheRejetSimple = Number(params.ratioMecheRejetSimple || 0.40);

    // Filtres de direction et d'affichage
    const activerSpring = params.activerSpring !== false;
    const activerUTAD = params.activerUTAD !== false;
    const afficherRanges = params.afficherRanges !== false;
    const afficherLignesNiveaux = params.afficherLignesNiveaux !== false;
    const afficherCiblesWyckoff = params.afficherCiblesWyckoff !== false;

    // 3️⃣ Calcul du pas de cotation (Pip Size) et de la taille d'une boîte (Box Size)
    const dernierPrix = bougies[bougies.length - 1].close;
    let pipSize = 0.0001;
    if (dernierPrix > 1000) pipSize = 0.1;
    else if (dernierPrix > 50) pipSize = 0.01;

    let tailleBox = 10 * pipSize;
    if (modeTailleBox === 'auto_atr') {
      let sommeTR = 0;
      const debutATR = Math.max(1, bougies.length - periodeATR);
      for (let i = debutATR; i < bougies.length; i++) {
        const h = bougies[i].high;
        const l = bougies[i].low;
        const prevClose = bougies[i - 1].close;
        const tr = Math.max(h - l, Math.abs(h - prevClose), Math.abs(l - prevClose));
        sommeTR += tr;
      }
      const atrMoyen = sommeTR / Math.max(1, bougies.length - debutATR);
      tailleBox = Math.max(pipSize, atrMoyen * ratioBoxATR);
    } else {
      tailleBox = Math.max(pipSize, tailleBoxPips * pipSize);
    }

    // 4️⃣ Construction des colonnes Point et Figure (P&F)
    const debutIndex = Math.max(0, bougies.length - maxLookback);
    const colonnes = [];

    let colType = bougies[debutIndex].close >= bougies[debutIndex].open ? 'X' : 'O';
    let colBas = Math.floor(bougies[debutIndex].low / tailleBox) * tailleBox;
    let colHaut = Math.ceil(bougies[debutIndex].high / tailleBox) * tailleBox;
    if (colHaut <= colBas) colHaut = colBas + tailleBox;

    let colIndexDebut = debutIndex;
    let colIndexFin = debutIndex;
    let colTempsDebut = bougies[debutIndex].time;
    let colTempsFin = bougies[debutIndex].time;

    for (let i = debutIndex + 1; i < bougies.length; i++) {
      const b = bougies[i];

      if (colType === 'X') {
        if (b.high >= colHaut + tailleBox) {
          const boitesAjoutees = Math.floor((b.high - colHaut) / tailleBox);
          colHaut += boitesAjoutees * tailleBox;
          colIndexFin = i;
          colTempsFin = b.time;
        } else {
          const seuilRetournement = colHaut - (reversalCount * tailleBox);
          if (b.low <= seuilRetournement) {
            colonnes.push({
              type: 'X',
              haut: colHaut,
              bas: colBas,
              indexDebut: colIndexDebut,
              indexFin: colIndexFin,
              tempsDebut: colTempsDebut,
              tempsFin: colTempsFin
            });
            colType = 'O';
            colHaut = colHaut - tailleBox;
            const boitesBaisse = Math.floor((colHaut - b.low) / tailleBox);
            colBas = colHaut - (boitesBaisse * tailleBox);
            colIndexDebut = i;
            colIndexFin = i;
            colTempsDebut = b.time;
            colTempsFin = b.time;
          }
        }
      } else {
        if (b.low <= colBas - tailleBox) {
          const boitesRetirees = Math.floor((colBas - b.low) / tailleBox);
          colBas -= boitesRetirees * tailleBox;
          colIndexFin = i;
          colTempsFin = b.time;
        } else {
          const seuilRetournement = colBas + (reversalCount * tailleBox);
          if (b.high >= seuilRetournement) {
            colonnes.push({
              type: 'O',
              haut: colHaut,
              bas: colBas,
              indexDebut: colIndexDebut,
              indexFin: colIndexFin,
              tempsDebut: colTempsDebut,
              tempsFin: colTempsFin
            });
            colType = 'X';
            colBas = colBas + tailleBox;
            const boitesHausse = Math.floor((b.high - colBas) / tailleBox);
            colHaut = colBas + (boitesHausse * tailleBox);
            colIndexDebut = i;
            colIndexFin = i;
            colTempsDebut = b.time;
            colTempsFin = b.time;
          }
        }
      }
    }

    colonnes.push({
      type: colType,
      haut: colHaut,
      bas: colBas,
      indexDebut: colIndexDebut,
      indexFin: colIndexFin,
      tempsDebut: colTempsDebut,
      tempsFin: colTempsFin
    });

    // 5️⃣ Fonction de vérification du Volume Wyckoff
    function verifierVolumeWyckoff(indexCassure, indexReintegration) {
      if (!activerFiltreVolume) {
        return { valide: true, motif: 'Volume désactivé (P&F Pur)' };
      }
      let sommeVolume = 0;
      let nbBougies = 0;
      const debutMoy = Math.max(0, indexReintegration - periodeMoyenneVolume);
      for (let k = debutMoy; k < indexReintegration; k++) {
        sommeVolume += (bougies[k].volume || 0);
        nbBougies++;
      }
      const volumeMoyen = nbBougies > 0 ? (sommeVolume / nbBougies) : 1;
      const volCassure = bougies[indexCassure].volume || 0;
      const volReintegration = bougies[indexReintegration].volume || 0;
      const volMax = Math.max(volCassure, volReintegration);
      const estClimax = volMax >= (volumeMoyen * seuilRatioVolume);
      const estTestFaible = volReintegration <= (volumeMoyen / seuilRatioVolume);

      if (typeValidationVolume === 'climax') {
        return {
          valide: estClimax,
          motif: estClimax ? 'Absorption / Climax (Fort volume)' : 'Volume insuffisant'
        };
      } else if (typeValidationVolume === 'test') {
        return {
          valide: estTestFaible,
          motif: estTestFaible ? 'Test validé (Assèchement vendeur)' : 'Trop de volume persistant'
        };
      } else {
        const valide = estClimax || estTestFaible;
        return {
          valide: valide,
          motif: estClimax ? 'Absorption (Climax)' : (estTestFaible ? 'Assèchement (Test)' : 'Volume neutre non validé')
        };
      }
    }

    // 6️⃣ Validation des Grandes Bougies, Pinbar et V-Shape Reversal
    function verifierGrandesBougies(type, indexDebutScan, indexFinScan) {
      if (!activerFiltreGrandesBougies) {
        return {
          valide: true,
          motif: 'Filtre grandes bougies désactivé',
          pattern: 'P&F Standard',
          tailleSortie: 0,
          tailleRetour: 0,
          ratioForce: 1
        };
      }

      let sommeTR = 0;
      let countTR = 0;
      const debutATR = Math.max(1, indexFinScan - periodeATR);
      for (let k = debutATR; k <= indexFinScan; k++) {
        const h = bougies[k].high;
        const l = bougies[k].low;
        const prevC = bougies[k - 1].close;
        sommeTR += Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
        countTR++;
      }
      const atrLocal = countTR > 0 ? sommeTR / countTR : (tailleBox / (ratioBoxATR || 0.5));
      const seuilGrandeBougie = atrLocal * multiplicateurTailleATR;

      const debut = Math.max(0, indexDebutScan);
      const fin = Math.min(bougies.length - 1, indexFinScan);

      if (type === 'spring') {
        let minLow = 9999999;
        let indexCreux = debut;
        for (let k = debut; k <= fin; k++) {
          if (bougies[k].low < minLow) {
            minLow = bougies[k].low;
            indexCreux = k;
          }
        }

        const bSortie = bougies[indexCreux];
        const indexRetour = fin;
        const bRetour = bougies[indexRetour];
        const nbBougiesHors = Math.max(1, indexRetour - indexCreux + 1);

        const tailleSortie = bSortie.high - bSortie.low;
        const tailleRetour = bRetour.high - bRetour.low;
        const ratioForce = tailleRetour / Math.max(1e-6, tailleSortie);

        // CAS 1 : Pinbar en 1 bougie
        if (indexCreux === indexRetour) {
          const corpsBas = Math.min(bSortie.open, bSortie.close);
          const mecheBasse = corpsBas - bSortie.low;
          const ratioMeche = mecheBasse / Math.max(1e-6, tailleSortie);
          const estGrande = tailleSortie >= seuilGrandeBougie;
          const aRejet = ratioMeche >= ratioMecheRejetSimple;

          if (estGrande && aRejet) {
            return {
              valide: true,
              motif: 'Pinbar 1-Bougie validée (' + (tailleSortie / pipSize).toFixed(1) + 'p, Mèche ' + (ratioMeche * 100).toFixed(0) + '%)',
              pattern: 'Pinbar 1-Bougie',
              tailleSortie: tailleSortie,
              tailleRetour: tailleRetour,
              ratioForce: 1
            };
          } else {
            return {
              valide: false,
              motif: 'Pinbar rejetée (Taille ou Mèche insuffisante)',
              pattern: 'Pinbar Invalide',
              tailleSortie: tailleSortie,
              tailleRetour: tailleRetour,
              ratioForce: 1
            };
          }
        }

        // CAS 2 : V-Shape en 2/3 bougies
        if (nbBougiesHors > maxBougiesHorsRange) {
          return { valide: false, motif: 'Retour trop lent (' + nbBougiesHors + 'b)', pattern: 'V-Shape Rejeté', tailleSortie: tailleSortie, tailleRetour: tailleRetour, ratioForce: ratioForce };
        }

        const auMoinsUneGrande = (tailleSortie >= seuilGrandeBougie) || (tailleRetour >= seuilGrandeBougie);
        if (!auMoinsUneGrande) {
          return { valide: false, motif: 'Bougies trop petites (< seuil ATR)', pattern: 'V-Shape Rejeté', tailleSortie: tailleSortie, tailleRetour: tailleRetour, ratioForce: ratioForce };
        }

        if (exigerRetourSuperieurOuEgal && ratioForce < 0.95) {
          return { valide: false, motif: 'Bougie retour inférieure à sortie (' + (ratioForce * 100).toFixed(0) + '%)', pattern: 'V-Shape Rejeté', tailleSortie: tailleSortie, tailleRetour: tailleRetour, ratioForce: ratioForce };
        }

        if (bRetour.close < bRetour.open) {
          return { valide: false, motif: 'Bougie réintégration baissière', pattern: 'V-Shape Rejeté', tailleSortie: tailleSortie, tailleRetour: tailleRetour, ratioForce: ratioForce };
        }

        return {
          valide: true,
          motif: 'V-Shape validé (' + nbBougiesHors + 'b, Force ' + (ratioForce * 100).toFixed(0) + '%)',
          pattern: 'V-Shape 2/3-Bougies',
          tailleSortie: tailleSortie,
          tailleRetour: tailleRetour,
          ratioForce: ratioForce
        };
      } else {
        // UTAD
        let maxHigh = -9999999;
        let indexSommet = debut;
        for (let k = debut; k <= fin; k++) {
          if (bougies[k].high > maxHigh) {
            maxHigh = bougies[k].high;
            indexSommet = k;
          }
        }

        const bSortie = bougies[indexSommet];
        const indexRetour = fin;
        const bRetour = bougies[indexRetour];
        const nbBougiesHors = Math.max(1, indexRetour - indexSommet + 1);

        const tailleSortie = bSortie.high - bSortie.low;
        const tailleRetour = bRetour.high - bRetour.low;
        const ratioForce = tailleRetour / Math.max(1e-6, tailleSortie);

        if (indexSommet === indexRetour) {
          const corpsHaut = Math.max(bSortie.open, bSortie.close);
          const mecheHaute = bSortie.high - corpsHaut;
          const ratioMeche = mecheHaute / Math.max(1e-6, tailleSortie);
          const estGrande = tailleSortie >= seuilGrandeBougie;
          const aRejet = ratioMeche >= ratioMecheRejetSimple;

          if (estGrande && aRejet) {
            return {
              valide: true,
              motif: 'Pinbar Haute 1-Bougie validée (' + (tailleSortie / pipSize).toFixed(1) + 'p)',
              pattern: 'Pinbar 1-Bougie',
              tailleSortie: tailleSortie,
              tailleRetour: tailleRetour,
              ratioForce: 1
            };
          } else {
            return { valide: false, motif: 'Pinbar Haute rejetée', pattern: 'Pinbar Invalide', tailleSortie: tailleSortie, tailleRetour: tailleRetour, ratioForce: 1 };
          }
        }

        if (nbBougiesHors > maxBougiesHorsRange) {
          return { valide: false, motif: 'Retour trop lent (' + nbBougiesHors + 'b)', pattern: 'V-Shape Rejeté', tailleSortie: tailleSortie, tailleRetour: tailleRetour, ratioForce: ratioForce };
        }

        const auMoinsUneGrande = (tailleSortie >= seuilGrandeBougie) || (tailleRetour >= seuilGrandeBougie);
        if (!auMoinsUneGrande) {
          return { valide: false, motif: 'Bougies trop petites (< seuil ATR)', pattern: 'V-Shape Rejeté', tailleSortie: tailleSortie, tailleRetour: tailleRetour, ratioForce: ratioForce };
        }

        if (exigerRetourSuperieurOuEgal && ratioForce < 0.95) {
          return { valide: false, motif: 'Bougie retour inférieure à sortie (' + (ratioForce * 100).toFixed(0) + '%)', pattern: 'V-Shape Rejeté', tailleSortie: tailleSortie, tailleRetour: tailleRetour, ratioForce: ratioForce };
        }

        if (bRetour.close > bRetour.open) {
          return { valide: false, motif: 'Bougie réintégration non baissière', pattern: 'V-Shape Rejeté', tailleSortie: tailleSortie, tailleRetour: tailleRetour, ratioForce: ratioForce };
        }

        return {
          valide: true,
          motif: 'V-Shape Baissier validé (' + nbBougiesHors + 'b, Force ' + (ratioForce * 100).toFixed(0) + '%)',
          pattern: 'V-Shape 2/3-Bougies',
          tailleSortie: tailleSortie,
          tailleRetour: tailleRetour,
          ratioForce: ratioForce
        };
      }
    }

    function qualifierSoliditeNiveau(touches) {
      if (touches >= 4) return 'Institutionnel (A+)';
      if (touches === 3) return 'Majeur';
      if (touches === 2) return 'Standard';
      return 'Faible';
    }

    const boitesVisuelles = [];
    const lignesVisuelles = [];
    const labelsVisuels = [];
    const signaux = [];

    for (let c = colonnesMinRange + 1; c < colonnes.length; c++) {
      const colActuelle = colonnes[c];
      const colPrecedente = colonnes[c - 1];

      // A. DÉTECTION DU SPRING
      if (activerSpring && colPrecedente.type === 'O' && colActuelle.type === 'X') {
        let minBas = 9999999;
        let maxHaut = -9999999;
        const creuxPrecedents = [];
        const debutRange = Math.max(0, c - (colonnesMinRange * 3) - 1);

        for (let r = debutRange; r < c - 1; r++) {
          if (colonnes[r].type === 'O') creuxPrecedents.push(colonnes[r].bas);
          if (colonnes[r].bas < minBas) minBas = colonnes[r].bas;
          if (colonnes[r].haut > maxHaut) maxHaut = colonnes[r].haut;
        }

        if (creuxPrecedents.length >= 2) {
          const creuxTries = creuxPrecedents.slice().sort(function (a, b) { return a - b; });
          const supportEstime = creuxTries[0];

          let nbRetests = 0;
          for (let r = debutRange; r < c - 1; r++) {
            if (colonnes[r].type === 'O') {
              if (Math.abs(colonnes[r].bas - supportEstime) <= (tailleBox * 1.5)) {
                nbRetests++;
              }
            }
          }

          if (nbRetests < minRetestsRequis) continue;
          const qualiteNiveau = qualifierSoliditeNiveau(nbRetests);

          const depassementBas = supportEstime - colPrecedente.bas;
          const aCasseSupport = depassementBas >= (tailleBox * 0.5) && depassementBas <= (8 * tailleBox);
          const aReintegre = colActuelle.haut >= supportEstime + (tailleBox * 0.5);

          if (aCasseSupport && aReintegre) {
            const testVolume = verifierVolumeWyckoff(colPrecedente.indexFin, colActuelle.indexFin);
            const testBougies = verifierGrandesBougies('spring', colPrecedente.indexDebut, colActuelle.indexFin);

            if (testVolume.valide && testBougies.valide) {
              const bgSignal = bougies[colActuelle.indexFin];
              const largeurRange = c - debutRange;
              const cibleWyckoff = supportEstime + (largeurRange * tailleBox * reversalCount);
              const stopLoss = colPrecedente.bas - (tailleBox * 0.5);

              signaux.push({
                direction: 'achat',
                type: 'Spring Wyckoff P&F',
                prixEntree: bgSignal.close,
                stopLoss: stopLoss,
                takeProfit: cibleWyckoff,
                largeurCauseColonnes: largeurRange,
                nbRetests: nbRetests,
                qualiteNiveau: qualiteNiveau,
                motifVolume: testVolume.motif,
                patternBougie: testBougies.pattern,
                motifBougie: testBougies.motif,
                ratioForceRetour: testBougies.ratioForce,
                temps: bgSignal.time
              });

              if (afficherRanges) {
                boitesVisuelles.push({
                  id: 'range-' + c,
                  prixHaut: maxHaut,
                  prixBas: supportEstime,
                  dateDebut: colonnes[debutRange].tempsDebut,
                  dateFin: colActuelle.tempsFin,
                  couleurFond: 'rgba(33, 150, 243, 0.08)',
                  couleurBordure: 'rgba(33, 150, 243, 0.35)',
                  label: 'Trading Range P&F'
                });
              }

              if (afficherLignesNiveaux) {
                lignesVisuelles.push({
                  id: 'support-pf-' + c,
                  prix: supportEstime,
                  dateDebut: colonnes[debutRange].tempsDebut,
                  dateFin: colActuelle.tempsFin,
                  couleur: nbRetests >= 4 ? '#00e676' : (nbRetests === 3 ? '#26a69a' : '#00b0ff'),
                  style: 'solid',
                  epaisseur: nbRetests >= 4 ? 2.5 : (nbRetests === 3 ? 2 : 1.5),
                  label: 'Support (' + nbRetests + 'x Tests - ' + qualiteNiveau + ')'
                });
              }

              boitesVisuelles.push({
                id: 'spring-' + c,
                prixHaut: supportEstime,
                prixBas: colPrecedente.bas,
                dateDebut: colPrecedente.tempsDebut,
                dateFin: colActuelle.tempsFin,
                couleurFond: 'rgba(0, 200, 83, 0.25)',
                couleurBordure: '#00c853',
                label: '🟢 Spring'
              });

              if (afficherCiblesWyckoff) {
                lignesVisuelles.push({
                  id: 'cible-spring-' + c,
                  prix: cibleWyckoff,
                  dateDebut: colActuelle.tempsFin,
                  couleur: '#00e676',
                  style: 'dashed',
                  epaisseur: 1.5,
                  label: '🎯 Cible Wyckoff (' + largeurRange + ' cols)'
                });
              }

              const tagQualite = nbRetests >= 4 ? ' [A+ ' + nbRetests + 'T]' : ' [' + nbRetests + 'T]';
              const tagVol = activerFiltreVolume ? ' Vol' : '';
              const tagPattern = activerFiltreGrandesBougies ? (testBougies.pattern.indexOf('Pinbar') !== -1 ? ' ⚡Pinbar' : ' 🚀V-Shape') : '';

              labelsVisuels.push({
                id: 'lbl-spring-' + c,
                prix: bgSignal.low,
                date: bgSignal.time,
                texte: '▲ SPRING' + tagQualite + tagPattern + (tagVol ? ' /' + tagVol : ''),
                couleur: nbRetests >= 4 ? '#00e676' : '#089981',
                position: 'below'
              });
            }
          }
        }
      }

      // B. DÉTECTION DU UTAD
      if (activerUTAD && colPrecedente.type === 'X' && colActuelle.type === 'O') {
        let minBas = 9999999;
        let maxHaut = -9999999;
        const sommetsPrecedents = [];
        const debutRange = Math.max(0, c - (colonnesMinRange * 3) - 1);

        for (let r = debutRange; r < c - 1; r++) {
          if (colonnes[r].type === 'X') sommetsPrecedents.push(colonnes[r].haut);
          if (colonnes[r].bas < minBas) minBas = colonnes[r].bas;
          if (colonnes[r].haut > maxHaut) maxHaut = colonnes[r].haut;
        }

        if (sommetsPrecedents.length >= 2) {
          const sommetsTries = sommetsPrecedents.slice().sort(function (a, b) { return b - a; });
          const resistanceEstimee = sommetsTries[0];

          let nbRetests = 0;
          for (let r = debutRange; r < c - 1; r++) {
            if (colonnes[r].type === 'X') {
              if (Math.abs(colonnes[r].haut - resistanceEstimee) <= (tailleBox * 1.5)) {
                nbRetests++;
              }
            }
          }

          if (nbRetests < minRetestsRequis) continue;
          const qualiteNiveau = qualifierSoliditeNiveau(nbRetests);

          const depassementHaut = colPrecedente.haut - resistanceEstimee;
          const aCasseResistance = depassementHaut >= (tailleBox * 0.5) && depassementHaut <= (8 * tailleBox);
          const aReintegre = colActuelle.bas <= resistanceEstimee - (tailleBox * 0.5);

          if (aCasseResistance && aReintegre) {
            const testVolume = verifierVolumeWyckoff(colPrecedente.indexFin, colActuelle.indexFin);
            const testBougies = verifierGrandesBougies('utad', colPrecedente.indexDebut, colActuelle.indexFin);

            if (testVolume.valide && testBougies.valide) {
              const bgSignal = bougies[colActuelle.indexFin];
              const largeurRange = c - debutRange;
              const cibleWyckoff = resistanceEstimee - (largeurRange * tailleBox * reversalCount);
              const stopLoss = colPrecedente.haut + (tailleBox * 0.5);

              signaux.push({
                direction: 'vente',
                type: 'UTAD Wyckoff P&F',
                prixEntree: bgSignal.close,
                stopLoss: stopLoss,
                takeProfit: cibleWyckoff,
                largeurCauseColonnes: largeurRange,
                nbRetests: nbRetests,
                qualiteNiveau: qualiteNiveau,
                motifVolume: testVolume.motif,
                patternBougie: testBougies.pattern,
                motifBougie: testBougies.motif,
                ratioForceRetour: testBougies.ratioForce,
                temps: bgSignal.time
              });

              if (afficherRanges) {
                boitesVisuelles.push({
                  id: 'range-utad-' + c,
                  prixHaut: resistanceEstimee,
                  prixBas: minBas,
                  dateDebut: colonnes[debutRange].tempsDebut,
                  dateFin: colActuelle.tempsFin,
                  couleurFond: 'rgba(244, 67, 54, 0.08)',
                  couleurBordure: 'rgba(244, 67, 54, 0.35)',
                  label: 'Trading Range P&F'
                });
              }

              if (afficherLignesNiveaux) {
                lignesVisuelles.push({
                  id: 'resistance-pf-' + c,
                  prix: resistanceEstimee,
                  dateDebut: colonnes[debutRange].tempsDebut,
                  dateFin: colActuelle.tempsFin,
                  couleur: nbRetests >= 4 ? '#ff1744' : (nbRetests === 3 ? '#ef5350' : '#ff9100'),
                  style: 'solid',
                  epaisseur: nbRetests >= 4 ? 2.5 : (nbRetests === 3 ? 2 : 1.5),
                  label: 'Résistance (' + nbRetests + 'x Tests - ' + qualiteNiveau + ')'
                });
              }

              boitesVisuelles.push({
                id: 'utad-' + c,
                prixHaut: colPrecedente.haut,
                prixBas: resistanceEstimee,
                dateDebut: colPrecedente.tempsDebut,
                dateFin: colActuelle.tempsFin,
                couleurFond: 'rgba(255, 23, 68, 0.25)',
                couleurBordure: '#ff1744',
                label: '🔴 UTAD'
              });

              if (afficherCiblesWyckoff) {
                lignesVisuelles.push({
                  id: 'cible-utad-' + c,
                  prix: cibleWyckoff,
                  dateDebut: colActuelle.tempsFin,
                  couleur: '#ff5252',
                  style: 'dashed',
                  epaisseur: 1.5,
                  label: '🎯 Cible Wyckoff (' + largeurRange + ' cols)'
                });
              }

              const tagQualite = nbRetests >= 4 ? ' [A+ ' + nbRetests + 'T]' : ' [' + nbRetests + 'T]';
              const tagVol = activerFiltreVolume ? ' Vol' : '';
              const tagPattern = activerFiltreGrandesBougies ? (testBougies.pattern.indexOf('Pinbar') !== -1 ? ' ⚡Pinbar' : ' 🚀V-Shape') : '';

              labelsVisuels.push({
                id: 'lbl-utad-' + c,
                prix: bgSignal.high,
                date: bgSignal.time,
                texte: '▼ UTAD' + tagQualite + tagPattern + (tagVol ? ' /' + tagVol : ''),
                couleur: nbRetests >= 4 ? '#ff1744' : '#ef5350',
                position: 'above'
              });
            }
          }
        }
      }
    }

    return {
      donnees: {
        totalColonnesPF: colonnes.length,
        tailleBoxCalculee: tailleBox,
        modeVolumeActif: activerFiltreVolume,
        signaux: signaux
      },
      primitives: {
        boites: boitesVisuelles,
        lignes: lignesVisuelles,
        labels: labelsVisuels
      },
      typeSpecial: 'wyckoff-point-figure'
    };
  }
};
