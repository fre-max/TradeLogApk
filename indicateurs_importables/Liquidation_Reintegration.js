/**
 * ==============================================================================
 * INDICATEUR SCRIPTABLE AUTONOME : LIQUIDATION & RÉINTÉGRATION (LIQ / REINT)
 * Version 1.1.0 - Logique de Proximité Asymétrique
 * 
 * Setup exclusif de Price Action & Liquidité :
 * 
 * 1. Bougie 1 (Liquidation / Sweep) :
 *    - Bougie impulsive complète (corps + mèches) >= 1.75x la moyenne récente.
 * 2. Bougie 2 (Réintégration) :
 *    - Bougie impulsive en sens inverse.
 *    - Corps pur (sans les mèches) >= 1.75x la moyenne récente des corps.
 * 3. Proximité asymétrique modulable :
 *    - En RETRAIT (la clôture n'atteint pas tout à fait Open 1) : tolérance stricte (défaut: 5%).
 *    - En DÉPASSEMENT FAVORABLE (la clôture va au-delà d'Open 1 dans le sens du retournement) :
 *      marge beaucoup plus généreuse (défaut: 25%) car cela confirme un fort momentum !
 * 
 * 💡 UTILISATION SANS RÉINSTALLER L'APK :
 * 1. Transférez ce fichier sur votre smartphone (téléchargement, WhatsApp, etc.).
 * 2. Ouvrez l'application TradeLog sur votre smartphone.
 * 3. Allez dans le Backtest -> Cliquez sur "Indicateurs".
 * 4. Cliquez sur "Importer" et sélectionnez ce fichier.
 * 5. L'indicateur est immédiatement actif sur vos graphiques !
 * ==============================================================================
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 2) {
      return { donnees: {}, primitives: { labels: [] } };
    }

    // Si la fonction native TypeScript est disponible dans le moteur, on l'appelle directement
    if (typeof calculerLiquidationReintegration === 'function') {
      const res = calculerLiquidationReintegration(bougies, parametres);
      return {
        donnees: res,
        primitives: res.primitives,
        typeSpecial: 'liquidation-reintegration'
      };
    }

    // 1️⃣ Extraction des paramètres utilisateur avec sécurisation des valeurs
    const params = parametres || {};

    // Tolérance stricte en cas de déficit (clôture en retrait)
    const valDeficit = params.toleranceDeficit !== undefined ? params.toleranceDeficit : params.toleranceProximite;
    const toleranceDeficit = valDeficit !== undefined
      ? (valDeficit > 1 ? valDeficit / 100 : valDeficit)
      : 0.05;

    // Tolérance élargie en cas de dépassement favorable (clôture au-delà de l'ouverture de départ)
    const valDepassement = params.toleranceDepassement !== undefined ? params.toleranceDepassement : 0.25;
    const toleranceDepassement = valDepassement > 1 ? valDepassement / 100 : valDepassement;

    const activerFiltreTaille = params.activerFiltreTaille !== false;
    const periodeHistorique = Math.max(3, Number(params.periodeHistorique !== undefined ? params.periodeHistorique : 10));
    const multiplicateurBougie1 = Math.max(0.5, Number(params.multiplicateurBougie1 !== undefined ? params.multiplicateurBougie1 : 1.75));
    const multiplicateurCorps2 = Math.max(0.5, Number(params.multiplicateurCorps2 !== undefined ? params.multiplicateurCorps2 : 1.75));

    const activerAchat = params.activerAchat !== false;
    const activerVente = params.activerVente !== false;
    const activerFiltreTendance = Boolean(params.activerFiltreTendance);
    const trendBars = Math.max(1, Number(params.trendBars !== undefined ? params.trendBars : 5));

    const bullColor = params.bullColor || '#00E676';
    const bearColor = params.bearColor || '#F23645';
    const texteLabel = params.texteLabel !== undefined ? params.texteLabel : 'Liq\nReint';

    const signaux = [];
    const labels = [];
    let totalAchats = 0;
    let totalVentes = 0;

    // 2️⃣ Parcours séquentiel des bougies
    for (let i = 1; i < bougies.length; i++) {
      const b1 = bougies[i - 1];
      const b2 = bougies[i];

      const range1 = b1.high - b1.low;
      const range2 = b2.high - b2.low;
      const corps2 = Math.abs(b2.open - b2.close);
      const hauteurMoyenne = (range1 + range2) / 2;
      if (hauteurMoyenne <= 0) continue;

      // Filtre optionnel de tendance
      let tendanceHausse = true;
      let tendanceBaisse = true;
      if (activerFiltreTendance) {
        const idxTrend = Math.max(0, i - trendBars);
        const openTrend = bougies[idxTrend].open;
        tendanceHausse = openTrend < b2.open;
        tendanceBaisse = openTrend > b2.open;
      }

      // Candidats Achat / Vente
      const estCandidatAchat = activerAchat && (b1.close < b1.open) && (b2.close > b2.open) && tendanceBaisse;
      const estCandidatVente = activerVente && (b1.close > b1.open) && (b2.close < b2.open) && tendanceHausse;
      if (!estCandidatAchat && !estCandidatVente) continue;

      // 3️⃣ Calcul asymétrique de la proximité
      const ecartPrix = Math.abs(b1.open - b2.close);
      const ratioEcart = ecartPrix / hauteurMoyenne;
      let situationCloture = 'RETRAIT';
      let respecteProximite = false;

      if (estCandidatAchat) {
        if (b2.close >= b1.open) {
          situationCloture = 'DEPASSEMENT';
          respecteProximite = ratioEcart <= toleranceDepassement;
        } else {
          situationCloture = 'RETRAIT';
          respecteProximite = ratioEcart <= toleranceDeficit;
        }
      } else if (estCandidatVente) {
        if (b2.close <= b1.open) {
          situationCloture = 'DEPASSEMENT';
          respecteProximite = ratioEcart <= toleranceDepassement;
        } else {
          situationCloture = 'RETRAIT';
          respecteProximite = ratioEcart <= toleranceDeficit;
        }
      }

      if (!respecteProximite) continue;

      // 4️⃣ Filtre de momentum sur l'historique
      let respecteFiltreTaille = true;
      let moyenneRangeHist = 0;
      let moyenneCorpsHist = 0;

      if (activerFiltreTaille) {
        const indexFinHist = i - 2;
        const indexDebutHist = Math.max(0, i - 1 - periodeHistorique);
        const nbBougiesHist = indexFinHist - indexDebutHist + 1;

        if (nbBougiesHist >= 3) {
          let sommeRangesHist = 0;
          let sommeCorpsHist = 0;

          for (let k = indexDebutHist; k <= indexFinHist; k++) {
            const bHist = bougies[k];
            sommeRangesHist += (bHist.high - bHist.low);
            sommeCorpsHist += Math.abs(bHist.open - bHist.close);
          }

          moyenneRangeHist = sommeRangesHist / nbBougiesHist;
          moyenneCorpsHist = sommeCorpsHist / nbBougiesHist;

          const bougie1AssezGrande = range1 >= (multiplicateurBougie1 * moyenneRangeHist);
          const corps2AssezGrand = corps2 >= (multiplicateurCorps2 * moyenneCorpsHist);
          respecteFiltreTaille = bougie1AssezGrande && corps2AssezGrand;
        }
      }

      if (!respecteFiltreTaille) continue;

      // 5️⃣ Création des signaux et étiquettes visuelles
      if (estCandidatAchat) {
        signaux.push({
          type: 'ACHAT',
          indexBougie: i,
          temps: b2.time,
          prix: b2.low,
          open1: b1.open,
          close2: b2.close,
          ecartPrix: ecartPrix,
          ratioEcart: ratioEcart,
          situationCloture: situationCloture,
          rangeBougie1: range1,
          corpsBougie2: corps2,
          moyenneRangeHist: moyenneRangeHist,
          moyenneCorpsHist: moyenneCorpsHist
        });

        labels.push({
          id: 'liq-reint-achat-' + i,
          prix: b2.low,
          date: b2.time,
          texte: texteLabel,
          couleur: bullColor,
          position: 'below'
        });
        totalAchats++;
      } else if (estCandidatVente) {
        signaux.push({
          type: 'VENTE',
          indexBougie: i,
          temps: b2.time,
          prix: b2.high,
          open1: b1.open,
          close2: b2.close,
          ecartPrix: ecartPrix,
          ratioEcart: ratioEcart,
          situationCloture: situationCloture,
          rangeBougie1: range1,
          corpsBougie2: corps2,
          moyenneRangeHist: moyenneRangeHist,
          moyenneCorpsHist: moyenneCorpsHist
        });

        labels.push({
          id: 'liq-reint-vente-' + i,
          prix: b2.high,
          date: b2.time,
          texte: texteLabel,
          couleur: bearColor,
          position: 'above'
        });
        totalVentes++;
      }
    }

    return {
      donnees: {
        signaux: signaux,
        statistiques: {
          totalSignaux: signaux.length,
          totalAchats: totalAchats,
          totalVentes: totalVentes
        }
      },
      primitives: {
        labels: labels
      },
      typeSpecial: 'liquidation-reintegration'
    };
  }
};
