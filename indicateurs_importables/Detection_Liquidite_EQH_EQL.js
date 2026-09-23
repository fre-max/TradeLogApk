/**
 * ==============================================================================
 * INDICATEUR SCRIPTABLE AUTONOME : DÉTECTION LIQUIDITÉ EQH / EQL
 * Traduit depuis le modèle SMC_EQH_EQL_Sweep_Profiler.mq5
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
  calculer: function (contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 20) {
      return { donnees: {}, primitives: { boites: [], lignes: [], labels: [] } };
    }

    // 1️⃣ Paramètres configurables (avec valeurs par défaut)
    const params = parametres || {};
    const profondeur = Number(params.profondeurPivot || 5);
    const tolerancePips = Number(params.tolerancePips || 1.5);
    const minBougies = Number(params.minBougiesEntrePivots || 4);
    const maxBougies = Number(params.maxBougiesEntrePivots || 75);
    const maxHistorique = Number(params.maxBougiesHistorique || 600);
    const afficherLignes = params.afficherLignes !== false;
    const afficherEtiquettes = params.afficherEtiquettes !== false;
    const masquerBalayes = Boolean(params.masquerNiveauxBalayes);

    // 2️⃣ Calcul automatique de la taille du pip selon l'actif
    const prixRef = bougies[bougies.length - 1].close;
    let pipSize = 0.0001;
    if (prixRef > 1000) pipSize = 0.1;
    else if (prixRef > 50) pipSize = 0.01;
    const tolerancePoints = tolerancePips * pipSize;
    const minSweepPoints = 0.5 * pipSize;

    // 3️⃣ Étape 1 : Détection des Sommets et Creux Pivots
    const pivots = [];
    const totalBougies = bougies.length;
    const debut = Math.max(profondeur, totalBougies - maxHistorique);
    const fin = totalBougies - profondeur - 1;

    for (let i = debut; i <= fin; i++) {
      let estHaut = true;
      let estBas = true;

      for (let j = 1; j <= profondeur; j++) {
        if (bougies[i].high <= bougies[i - j].high || bougies[i].high < bougies[i + j].high) estHaut = false;
        if (bougies[i].low >= bougies[i - j].low || bougies[i].low > bougies[i + j].low) estBas = false;
      }

      if (estHaut) {
        pivots.push({ prix: bougies[i].high, temps: bougies[i].time, index: i, estHaut: true });
      } else if (estBas) {
        pivots.push({ prix: bougies[i].low, temps: bougies[i].time, index: i, estHaut: false });
      }
    }

    // 4️⃣ Étape 2 : Identification des paires alignées (Equal Highs & Equal Lows)
    const niveaux = [];
    for (let i = 0; i < pivots.length - 1; i++) {
      for (let j = i + 1; j < pivots.length; j++) {
        if (pivots[i].estHaut !== pivots[j].estHaut) continue;

        const ecartBougies = pivots[j].index - pivots[i].index;
        if (ecartBougies < minBougies) continue;
        if (ecartBougies > maxBougies) break;

        const ecartPrix = Math.abs(pivots[i].prix - pivots[j].prix);
        if (ecartPrix > tolerancePoints) continue;

        // Validation de non-violation intermédiaire (garantit la propreté du pool de liquidité)
        let niveauValide = true;
        if (pivots[i].estHaut) {
          const maxPermis = Math.max(pivots[i].prix, pivots[j].prix) + tolerancePoints;
          for (let k = pivots[i].index + 1; k < pivots[j].index; k++) {
            if (bougies[k].high > maxPermis) { niveauValide = false; break; }
          }
        } else {
          const minPermis = Math.min(pivots[i].prix, pivots[j].prix) - tolerancePoints;
          for (let k = pivots[i].index + 1; k < pivots[j].index; k++) {
            if (bougies[k].low < minPermis) { niveauValide = false; break; }
          }
        }

        if (niveauValide) {
          const estEQH = pivots[i].estHaut;
          const prixMoyen = (pivots[i].prix + pivots[j].prix) / 2.0;

          niveaux.push({
            id: (estEQH ? 'eqh-' : 'eql-') + pivots[i].index + '-' + pivots[j].index,
            type: estEQH ? 'EQH' : 'EQL',
            prix: prixMoyen,
            indexPivot1: pivots[i].index,
            tempsPivot1: pivots[i].temps,
            indexPivot2: pivots[j].index,
            tempsPivot2: pivots[j].temps,
            estSwept: false,
            tempsSweep: null,
            prixSweep: null,
            indexFin: totalBougies - 1,
            tempsFin: bougies[totalBougies - 1].time,
          });
        }
      }
    }

    // 5️⃣ Étape 3 : Détection des balayages ultérieurs (Sweeps)
    for (const niveau of niveaux) {
      for (let b = niveau.indexPivot2 + 1; b < totalBougies; b++) {
        const bougie = bougies[b];
        if (niveau.type === 'EQH') {
          if (bougie.high >= niveau.prix + minSweepPoints) {
            niveau.estSwept = true;
            niveau.tempsSweep = bougie.time;
            niveau.prixSweep = bougie.high;
            niveau.indexFin = b;
            niveau.tempsFin = bougie.time;
            break;
          }
        } else {
          if (bougie.low <= niveau.prix - minSweepPoints) {
            niveau.estSwept = true;
            niveau.tempsSweep = bougie.time;
            niveau.prixSweep = bougie.low;
            niveau.indexFin = b;
            niveau.tempsFin = bougie.time;
            break;
          }
        }
      }
    }

    // 6️⃣ Étape 4 : Rendu des Primitives Graphiques pour le Canvas
    const lignes = [];
    const labels = [];
    const boites = [];

    for (const niveau of niveaux) {
      if (masquerBalayes && niveau.estSwept) continue;

      const estEQH = niveau.type === 'EQH';
      // Doré pour les Equal Highs (BSL), Bleu Cyan pour les Equal Lows (SSL)
      const couleur = estEQH ? '#f59e0b' : '#0ea5e9';

      // A. Ligne horizontale de liquidité
      if (afficherLignes) {
        lignes.push({
          id: 'ligne-' + niveau.id,
          prix: niveau.prix,
          dateDebut: niveau.tempsPivot1,
          dateFin: niveau.tempsFin,
          couleur: couleur,
          style: niveau.estSwept ? 'solid' : 'dashed',
          label: (estEQH ? 'EQH (BSL)' : 'EQL (SSL)') + (niveau.estSwept ? ' [Purgé]' : ' [Actif]'),
        });
      }

      // B. Étiquette d'identification sur le 2e pivot
      if (afficherEtiquettes) {
        labels.push({
          id: 'label-' + niveau.id,
          prix: niveau.prix,
          date: niveau.tempsPivot2,
          texte: estEQH ? '🎯 EQH' : '🎯 EQL',
          couleur: couleur,
          position: estEQH ? 'above' : 'below',
        });
      }

      // C. Boîte encadrant la mèche de Sweep
      if (niveau.estSwept && niveau.prixSweep && niveau.tempsSweep) {
        boites.push({
          id: 'box-' + niveau.id,
          prixHaut: Math.max(niveau.prix, niveau.prixSweep),
          prixBas: Math.min(niveau.prix, niveau.prixSweep),
          dateDebut: niveau.tempsSweep,
          couleurFond: estEQH ? 'rgba(239, 68, 68, 0.20)' : 'rgba(16, 185, 129, 0.20)',
          couleurBordure: estEQH ? '#ef4444' : '#10b981',
          label: estEQH ? '🔴 Sweep EQH' : '🟢 Sweep EQL',
        });
      }
    }

    return {
      donnees: {
        niveaux: niveaux,
        totalEQH: niveaux.filter(function (n) { return n.type === 'EQH'; }).length,
        totalEQL: niveaux.filter(function (n) { return n.type === 'EQL'; }).length,
      },
      primitives: {
        lignes: lignes,
        labels: labels,
        boites: boites,
      },
    };
  },
};
