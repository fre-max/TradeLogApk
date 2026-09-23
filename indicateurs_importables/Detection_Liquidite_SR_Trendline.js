/**
 * Indicateur Scriptable : Détection Liquidité - Zones Supports & Résistances (S/R)
 * 
 * Cet indicateur identifie les zones horizontales de liquidité où s'accumulent les Stop-Loss :
 * - Résistances = Buy-Side Liquidity (BSL) : sommets retestés au moins 2 fois avec marge.
 * - Supports    = Sell-Side Liquidity (SSL) : creux retestés au moins 2 fois avec marge.
 * 
 * Caractéristiques :
 * - Au minimum 2 points d'ancrage (retest obligatoire). Un niveau isolé n'est pas retenu.
 * - Tolérance de dépassement : le retest peut dépasser légèrement ou s'arrêter un peu avant.
 * - Rectangles de zones avec marge/épaisseur visible.
 */
return {
  calculer: function(contexte) {
    const { bougies, parametres } = contexte;

    if (!bougies || bougies.length < 20) {
      return { donnees: { totalZones: 0 }, primitives: { boites: [], lignes: [], labels: [] } };
    }

    // Récupération des paramètres utilisateur
    const profondeur = Number(parametres.profondeurPivot || 5);
    const margePips = Number(parametres.margeZonePips || 4.0);
    const bufferPips = Number(parametres.epaisseurBufferPips || 1.5);
    const minTouches = Math.max(2, Number(parametres.minTouches || 2));
    const minBougies = Number(parametres.minBougiesEntrePivots || 4);
    const maxHistorique = Number(parametres.maxBougiesHistorique || 600);
    const afficherZones = parametres.afficherZones !== false;
    const afficherLignes = parametres.afficherLignes !== false;
    const afficherEtiquettes = parametres.afficherEtiquettes !== false;
    const masquerCassees = Boolean(parametres.masquerZonesCassees);

    // Déduction automatique de la taille du pip
    const prixRef = bougies[bougies.length - 1].close;
    let pipSize = 0.0001;
    if (prixRef > 1000) pipSize = 0.1;
    else if (prixRef > 50) pipSize = 0.01;

    const margePoints = margePips * pipSize;
    const bufferPoints = bufferPips * pipSize;

    // 1️⃣ Scan des sommets et creux swing
    const pivots = [];
    const total = bougies.length;
    const debut = Math.max(profondeur, total - maxHistorique);
    const fin = total - profondeur - 1;

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

    const sommets = pivots.filter(p => p.estHaut);
    const creux = pivots.filter(p => !p.estHaut);

    const boites = [];
    const lignes = [];
    const labels = [];
    const resistances = [];
    const supports = [];

    // 2️⃣ Groupement des Sommets en Zones de Résistance (BSL)
    const sommetsVisites = new Set();
    for (let i = 0; i < sommets.length; i++) {
      if (sommetsVisites.has(sommets[i].index)) continue;

      const cluster = [sommets[i]];
      let maxPrix = sommets[i].prix;
      let minPrix = sommets[i].prix;

      for (let j = i + 1; j < sommets.length; j++) {
        const p = sommets[j];
        if (p.index - cluster[cluster.length - 1].index < minBougies) continue;

        const diff1 = Math.abs(p.prix - sommets[i].prix);
        const diff2 = Math.abs(p.prix - maxPrix);
        const diff3 = Math.abs(p.prix - minPrix);

        if (diff1 <= margePoints || diff2 <= margePoints || diff3 <= margePoints) {
          cluster.push(p);
          if (p.prix > maxPrix) maxPrix = p.prix;
          if (p.prix < minPrix) minPrix = p.prix;
        }
      }

      // Au moins 2 points d'ancrage requis
      if (cluster.length >= minTouches) {
        cluster.forEach(p => sommetsVisites.add(p.index));

        const premier = cluster[0];
        const dernier = cluster[cluster.length - 1];
        const prixHaut = maxPrix + bufferPoints;
        const prixBas = Math.max(0, minPrix - bufferPoints);
        const prixMedian = (maxPrix + minPrix) / 2;

        let estCassee = false;
        let estSwept = false;
        let dateFin = bougies[total - 1].time;

        for (let b = dernier.index + 1; b < total; b++) {
          if (bougies[b].close > prixHaut) {
            estCassee = true;
            dateFin = bougies[b].time;
            break;
          }
          if (bougies[b].high > prixHaut && bougies[b].close <= prixHaut) {
            estSwept = true;
          }
        }

        resistances.push({ nbTouches: cluster.length, prixHaut, prixBas, prixMedian, estCassee, estSwept });

        if (!masquerCassees || !estCassee) {
          if (afficherZones) {
            boites.push({
              id: 'box-res-' + premier.index,
              prixHaut: prixHaut,
              prixBas: prixBas,
              dateDebut: premier.temps,
              dateFin: dateFin,
              couleurFond: estCassee ? 'rgba(239, 68, 68, 0.06)' : 'rgba(239, 68, 68, 0.16)',
              couleurBordure: estCassee ? '#f87171' : '#ef4444',
              label: '🧱 BSL (' + cluster.length + 'x)' + (estSwept ? ' [Sweep]' : '')
            });
          }

          if (afficherLignes) {
            lignes.push({
              id: 'ligne-res-' + premier.index,
              prix: prixMedian,
              dateDebut: premier.temps,
              dateFin: dateFin,
              couleur: '#ef4444',
              style: estCassee ? 'dotted' : 'dashed',
              label: 'Résistance (' + cluster.length + 'x)'
            });
          }

          if (afficherEtiquettes) {
            labels.push({
              id: 'lbl-res-' + premier.index,
              prix: prixHaut,
              date: premier.temps,
              texte: '🧱 BSL [' + cluster.length + ' touches]',
              couleur: '#ef4444',
              position: 'above'
            });
          }
        }
      }
    }

    // 3️⃣ Groupement des Creux en Zones de Support (SSL)
    const creuxVisites = new Set();
    for (let i = 0; i < creux.length; i++) {
      if (creuxVisites.has(creux[i].index)) continue;

      const cluster = [creux[i]];
      let maxPrix = creux[i].prix;
      let minPrix = creux[i].prix;

      for (let j = i + 1; j < creux.length; j++) {
        const p = creux[j];
        if (p.index - cluster[cluster.length - 1].index < minBougies) continue;

        const diff1 = Math.abs(p.prix - creux[i].prix);
        const diff2 = Math.abs(p.prix - maxPrix);
        const diff3 = Math.abs(p.prix - minPrix);

        if (diff1 <= margePoints || diff2 <= margePoints || diff3 <= margePoints) {
          cluster.push(p);
          if (p.prix > maxPrix) maxPrix = p.prix;
          if (p.prix < minPrix) minPrix = p.prix;
        }
      }

      // Au moins 2 points d'ancrage requis
      if (cluster.length >= minTouches) {
        cluster.forEach(p => creuxVisites.add(p.index));

        const premier = cluster[0];
        const dernier = cluster[cluster.length - 1];
        const prixHaut = maxPrix + bufferPoints;
        const prixBas = Math.max(0, minPrix - bufferPoints);
        const prixMedian = (maxPrix + minPrix) / 2;

        let estCassee = false;
        let estSwept = false;
        let dateFin = bougies[total - 1].time;

        for (let b = dernier.index + 1; b < total; b++) {
          if (bougies[b].close < prixBas) {
            estCassee = true;
            dateFin = bougies[b].time;
            break;
          }
          if (bougies[b].low < prixBas && bougies[b].close >= prixBas) {
            estSwept = true;
          }
        }

        supports.push({ nbTouches: cluster.length, prixHaut, prixBas, prixMedian, estCassee, estSwept });

        if (!masquerCassees || !estCassee) {
          if (afficherZones) {
            boites.push({
              id: 'box-sup-' + premier.index,
              prixHaut: prixHaut,
              prixBas: prixBas,
              dateDebut: premier.temps,
              dateFin: dateFin,
              couleurFond: estCassee ? 'rgba(16, 185, 129, 0.06)' : 'rgba(16, 185, 129, 0.16)',
              couleurBordure: estCassee ? '#34d399' : '#10b981',
              label: '🛡️ SSL (' + cluster.length + 'x)' + (estSwept ? ' [Sweep]' : '')
            });
          }

          if (afficherLignes) {
            lignes.push({
              id: 'ligne-sup-' + premier.index,
              prix: prixMedian,
              dateDebut: premier.temps,
              dateFin: dateFin,
              couleur: '#10b981',
              style: estCassee ? 'dotted' : 'dashed',
              label: 'Support (' + cluster.length + 'x)'
            });
          }

          if (afficherEtiquettes) {
            labels.push({
              id: 'lbl-sup-' + premier.index,
              prix: prixBas,
              date: premier.temps,
              texte: '🛡️ SSL [' + cluster.length + ' touches]',
              couleur: '#10b981',
              position: 'below'
            });
          }
        }
      }
    }

    return {
      donnees: {
        totalZones: supports.length + resistances.length,
        totalSupports: supports.length,
        totalResistances: resistances.length
      },
      primitives: {
        boites: boites,
        lignes: lignes,
        labels: labels
      }
    };
  }
};
