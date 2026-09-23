/**
 * ==============================================================================
 * INDICATEUR SCRIPTABLE AUTONOME : DÉTECTION LIQUIDITÉ S/R & TRENDLINE
 * Détection des pools de liquidité institutionnels :
 * 1. Supports & Résistances horizontaux (Clusters de rejets multiples)
 * 2. Trendlines obliques haussières et baissières (Trendline Liquidity - TRL)
 * 
 * 💡 UTILISATION DIRECTE SUR VOTRE MOBILE SANS RÉINSTALLER L'APK :
 * 1. Copiez ce fichier sur votre smartphone.
 * 2. Ouvrez TradeLog -> Backtest -> Cliquez sur "Indicateurs".
 * 3. Cliquez sur "Importer" et sélectionnez ce fichier .js.
 * 4. L'indicateur est actif immédiatement sur vos graphiques !
 * ==============================================================================
 */
return {
  calculer: function (contexte) {
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 25) {
      return { donnees: {}, primitives: { boites: [], lignes: [], labels: [] } };
    }

    // 1️⃣ Configuration des variables externes
    const params = parametres || {};
    const mode = String(params.modeDetection || 'tous'); // 'tous' | 'sr_seulement' | 'trendline_seulement'
    const profondeur = Number(params.profondeurPivot || 5);
    const minTouches = Number(params.minTouches || 2);
    const tolerancePips = Number(params.tolerancePips || 1.5);
    const minBougies = Number(params.minBougiesEntrePivots || 4);
    const maxHistorique = Number(params.maxBougiesHistorique || 600);
    const masquerBalayes = Boolean(params.masquerNiveauxBalayes);
    const afficherLignes = params.afficherLignes !== false;
    const afficherEtiquettes = params.afficherEtiquettes !== false;
    const afficherZones = params.afficherZones !== false;

    // 2️⃣ Taille du pip
    const prixRef = bougies[bougies.length - 1].close;
    let pipSize = 0.0001;
    if (prixRef > 1000) pipSize = 0.1;
    else if (prixRef > 50) pipSize = 0.01;
    const tolerancePoints = tolerancePips * pipSize;

    // 3️⃣ Scan des sommets et creux pivots
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

    const lignes = [];
    const labels = [];
    const boites = [];

    const sommets = pivots.filter(function (p) { return p.estHaut; });
    const creux = pivots.filter(function (p) { return !p.estHaut; });

    // 4️⃣ Module A : Supports & Résistances Horizontaux
    if (mode === 'tous' || mode === 'sr_seulement') {
      // Résistances (BSL)
      const sommetsVisites = {};
      for (let i = 0; i < sommets.length; i++) {
        if (sommetsVisites[sommets[i].index]) continue;
        const cluster = [sommets[i]];

        for (let j = i + 1; j < sommets.length; j++) {
          if (sommets[j].index - cluster[cluster.length - 1].index < minBougies) continue;
          if (Math.abs(sommets[j].prix - sommets[i].prix) <= tolerancePoints) {
            cluster.push(sommets[j]);
          }
        }

        if (cluster.length >= minTouches) {
          for (let k = 0; k < cluster.length; k++) sommetsVisites[cluster[k].index] = true;
          const prixMoyen = cluster.reduce(function (sum, p) { return sum + p.prix; }, 0) / cluster.length;
          const premier = cluster[0];
          const dernier = cluster[cluster.length - 1];

          let estSwept = false;
          let tempsSweep = null;
          let prixSweep = null;

          for (let b = dernier.index + 1; b < totalBougies; b++) {
            if (bougies[b].high >= prixMoyen + tolerancePoints * 0.3) {
              estSwept = true;
              tempsSweep = bougies[b].time;
              prixSweep = bougies[b].high;
              break;
            }
          }

          if (!(masquerBalayes && estSwept)) {
            if (afficherLignes) {
              lignes.push({
                id: 'res-' + premier.index + '-' + dernier.index,
                prix: prixMoyen,
                dateDebut: premier.temps,
                dateFin: tempsSweep || bougies[totalBougies - 1].time,
                couleur: '#ef4444',
                style: estSwept ? 'solid' : 'dashed',
                label: 'Résistance BSL (' + cluster.length + 'x)' + (estSwept ? ' [Purgé]' : ' [Actif]'),
              });
            }

            if (afficherEtiquettes) {
              labels.push({
                id: 'lbl-res-' + premier.index,
                prix: prixMoyen,
                date: premier.temps,
                texte: '🧱 BSL: ' + prixMoyen.toFixed(4),
                couleur: '#ef4444',
                position: 'above',
              });
            }

            if (afficherZones && estSwept && tempsSweep && prixSweep) {
              boites.push({
                id: 'box-res-' + premier.index,
                prixHaut: Math.max(prixMoyen, prixSweep),
                prixBas: Math.min(prixMoyen, prixSweep),
                dateDebut: tempsSweep,
                couleurFond: 'rgba(239, 68, 68, 0.20)',
                couleurBordure: '#ef4444',
                label: '🔴 Sweep BSL',
              });
            }
          }
        }
      }

      // Supports (SSL)
      const creuxVisites = {};
      for (let i = 0; i < creux.length; i++) {
        if (creuxVisites[creux[i].index]) continue;
        const cluster = [creux[i]];

        for (let j = i + 1; j < creux.length; j++) {
          if (creux[j].index - cluster[cluster.length - 1].index < minBougies) continue;
          if (Math.abs(creux[j].prix - creux[i].prix) <= tolerancePoints) {
            cluster.push(creux[j]);
          }
        }

        if (cluster.length >= minTouches) {
          for (let k = 0; k < cluster.length; k++) creuxVisites[cluster[k].index] = true;
          const prixMoyen = cluster.reduce(function (sum, p) { return sum + p.prix; }, 0) / cluster.length;
          const premier = cluster[0];
          const dernier = cluster[cluster.length - 1];

          let estSwept = false;
          let tempsSweep = null;
          let prixSweep = null;

          for (let b = dernier.index + 1; b < totalBougies; b++) {
            if (bougies[b].low <= prixMoyen - tolerancePoints * 0.3) {
              estSwept = true;
              tempsSweep = bougies[b].time;
              prixSweep = bougies[b].low;
              break;
            }
          }

          if (!(masquerBalayes && estSwept)) {
            if (afficherLignes) {
              lignes.push({
                id: 'sup-' + premier.index + '-' + dernier.index,
                prix: prixMoyen,
                dateDebut: premier.temps,
                dateFin: tempsSweep || bougies[totalBougies - 1].time,
                couleur: '#10b981',
                style: estSwept ? 'solid' : 'dashed',
                label: 'Support SSL (' + cluster.length + 'x)' + (estSwept ? ' [Purgé]' : ' [Actif]'),
              });
            }

            if (afficherEtiquettes) {
              labels.push({
                id: 'lbl-sup-' + premier.index,
                prix: prixMoyen,
                date: premier.temps,
                texte: '🛡️ SSL: ' + prixMoyen.toFixed(4),
                couleur: '#10b981',
                position: 'below',
              });
            }

            if (afficherZones && estSwept && tempsSweep && prixSweep) {
              boites.push({
                id: 'box-sup-' + premier.index,
                prixHaut: Math.max(prixMoyen, prixSweep),
                prixBas: Math.min(prixMoyen, prixSweep),
                dateDebut: tempsSweep,
                couleurFond: 'rgba(16, 185, 129, 0.20)',
                couleurBordure: '#10b981',
                label: '🟢 Sweep SSL',
              });
            }
          }
        }
      }
    }

    // 5️⃣ Module B : Trendlines de Liquidité (Obliques)
    if (mode === 'tous' || mode === 'trendline_seulement') {
      // Trendlines Haussières (Creux ascendants -> SSL en-dessous)
      for (let i = 0; i < creux.length - 1; i++) {
        for (let j = i + 1; j < creux.length; j++) {
          const p1 = creux[i];
          const p2 = creux[j];
          const ecartX = p2.index - p1.index;

          if (ecartX < minBougies) continue;
          if (p2.prix <= p1.prix) continue;

          const pente = (p2.prix - p1.prix) / ecartX;

          let coherent = true;
          for (let k = p1.index + 1; k < p2.index; k++) {
            const attendu = p1.prix + pente * (k - p1.index);
            if (bougies[k].close < attendu - tolerancePoints * 1.2) {
              coherent = false;
              break;
            }
          }
          if (!coherent) continue;

          let nbContacts = 2;
          let dernierP = p2;
          for (let m = j + 1; m < creux.length; m++) {
            const p3 = creux[m];
            const attendu = p1.prix + pente * (p3.index - p1.index);
            if (Math.abs(p3.prix - attendu) <= tolerancePoints) {
              nbContacts++;
              dernierP = p3;
            }
          }

          if (nbContacts >= minTouches) {
            let estSwept = false;
            let tempsSweep = null;
            let indexFin = totalBougies - 1;

            for (let b = dernierP.index + 1; b < totalBougies; b++) {
              const prixLigne = p1.prix + pente * (b - p1.index);
              if (bougies[b].low < prixLigne - tolerancePoints * 0.5) {
                estSwept = true;
                tempsSweep = bougies[b].time;
                indexFin = b;
                break;
              }
            }

            const prixFin = p1.prix + pente * (indexFin - p1.index);

            if (!(masquerBalayes && estSwept)) {
              if (afficherLignes) {
                lignes.push({
                  id: 'tl-bull-' + p1.index + '-' + dernierP.index,
                  prix: p1.prix,
                  prixFin: prixFin, // Ligne oblique !
                  dateDebut: p1.temps,
                  dateFin: tempsSweep || bougies[totalBougies - 1].time,
                  couleur: '#38bdf8', // Cyan
                  style: estSwept ? 'solid' : 'dashed',
                  label: 'Trendline SSL (' + nbContacts + 'T)' + (estSwept ? ' [Cassée]' : ' [Active]'),
                });
              }

              if (afficherEtiquettes) {
                labels.push({
                  id: 'lbl-tl-bull-' + p1.index,
                  prix: dernierP.prix,
                  date: dernierP.temps,
                  texte: '📐 TRL-SSL (' + nbContacts + 'T)',
                  couleur: '#38bdf8',
                  position: 'below',
                });
              }
            }

            break;
          }
        }
      }

      // Trendlines Baissières (Sommets descendants -> BSL au-dessus)
      for (let i = 0; i < sommets.length - 1; i++) {
        for (let j = i + 1; j < sommets.length; j++) {
          const p1 = sommets[i];
          const p2 = sommets[j];
          const ecartX = p2.index - p1.index;

          if (ecartX < minBougies) continue;
          if (p2.prix >= p1.prix) continue;

          const pente = (p2.prix - p1.prix) / ecartX;

          let coherent = true;
          for (let k = p1.index + 1; k < p2.index; k++) {
            const attendu = p1.prix + pente * (k - p1.index);
            if (bougies[k].close > attendu + tolerancePoints * 1.2) {
              coherent = false;
              break;
            }
          }
          if (!coherent) continue;

          let nbContacts = 2;
          let dernierP = p2;
          for (let m = j + 1; m < sommets.length; m++) {
            const p3 = sommets[m];
            const attendu = p1.prix + pente * (p3.index - p1.index);
            if (Math.abs(p3.prix - attendu) <= tolerancePoints) {
              nbContacts++;
              dernierP = p3;
            }
          }

          if (nbContacts >= minTouches) {
            let estSwept = false;
            let tempsSweep = null;
            let indexFin = totalBougies - 1;

            for (let b = dernierP.index + 1; b < totalBougies; b++) {
              const prixLigne = p1.prix + pente * (b - p1.index);
              if (bougies[b].high > prixLigne + tolerancePoints * 0.5) {
                estSwept = true;
                tempsSweep = bougies[b].time;
                indexFin = b;
                break;
              }
            }

            const prixFin = p1.prix + pente * (indexFin - p1.index);

            if (!(masquerBalayes && estSwept)) {
              if (afficherLignes) {
                lignes.push({
                  id: 'tl-bear-' + p1.index + '-' + dernierP.index,
                  prix: p1.prix,
                  prixFin: prixFin, // Ligne oblique !
                  dateDebut: p1.temps,
                  dateFin: tempsSweep || bougies[totalBougies - 1].time,
                  couleur: '#f59e0b', // Or
                  style: estSwept ? 'solid' : 'dashed',
                  label: 'Trendline BSL (' + nbContacts + 'T)' + (estSwept ? ' [Cassée]' : ' [Active]'),
                });
              }

              if (afficherEtiquettes) {
                labels.push({
                  id: 'lbl-tl-bear-' + p1.index,
                  prix: dernierP.prix,
                  date: dernierP.temps,
                  texte: '📐 TRL-BSL (' + nbContacts + 'T)',
                  couleur: '#f59e0b',
                  position: 'above',
                });
              }
            }

            break;
          }
        }
      }
    }

    return {
      donnees: {
        totalLignes: lignes.length,
        mode: mode,
      },
      primitives: {
        lignes: lignes,
        labels: labels,
        boites: boites,
      },
    };
  },
};
