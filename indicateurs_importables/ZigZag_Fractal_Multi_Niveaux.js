/**
 * ==============================================================================
 * INDICATEUR SCRIPTABLE AUTONOME : ZIGZAG FRACTAL MULTI-NIVEAUX (MULTI-DEPTH)
 * ==============================================================================
 * 
 * Cet indicateur analyse la nature fractale des marchés financiers en imbriquant
 * 3 sensibilités de ZigZag sur le même graphique :
 * 
 * 1. NIVEAU MACRO (HTF) - Grande vague directrice :
 *    - Profondeur par défaut : 21 bougies
 *    - Tracé : Ligne dorée épaisse (#f59e0b)
 *    - Rôle : Identifie la tendance maîtresse de fond et les sommets/creux majeurs (HH, LL).
 * 
 * 2. NIVEAU INTERMÉDIAIRE (MTF) - Sous-structure de swing :
 *    - Profondeur par défaut : 8 bougies
 *    - Tracé : Ligne bleue (#3b82f6)
 *    - Rôle : Révèle les respirations et cycles intermédiaires à l'intérieur de la vague macro.
 * 
 * 3. NIVEAU MICRO (LTF) - Micro-structure d'exécution :
 *    - Profondeur par défaut : 3 bougies
 *    - Tracé : Ligne pointillée cyan (rgba(6, 182, 212, 0.65))
 *    - Rôle : Permet de voir les micro-impulsions et les cassures internes précoces.
 * 
 * 4. SYNTHÈSE ET CONFLUENCE FRACTALE :
 *    - Badge sur la dernière bougie indiquant l'état des 3 niveaux (ex: [🟢🟢🟢] 3v).
 *    - Comptage du nombre de sous-vagues dans la jambe macro courante.
 *    - Alerte visuelle de retournement précoce (Micro CHoCH / Changement de Caractère Interne)
 *      lorsque la micro-structure casse dans le sens inverse de la grande vague macro.
 * 
 * 💡 UTILISATION SUR SMARTPHONE (TRADELOG) :
 * 1. Transférez ce fichier sur votre téléphone (téléchargement, WhatsApp, etc.).
 * 2. Ouvrez l'application TradeLog -> Menu Graphique ou Backtest -> Cliquez sur "Indicateurs".
 * 3. Cliquez sur "Importer" et choisissez ce fichier (.js ou .json).
 * ==============================================================================
 */

return {
  calculer: function (contexte) {
    // 1️⃣ Vérification des données reçues
    const { bougies, parametres } = contexte;
    if (!bougies || bougies.length < 40) {
      return { donnees: {}, primitives: { boites: [], lignes: [], labels: [] } };
    }

    // 2️⃣ Lecture des options configurables par l'utilisateur
    const params = parametres || {};
    const profMacro = Number(params.profondeurMacro || 21);
    const profInter = Number(params.profondeurIntermediaire || 8);
    const profMicro = Number(params.profondeurMicro || 3);
    const lookback = Number(params.lookbackBars || 600);

    const afficherMacro = params.afficherLignesMacro !== false;
    const afficherInter = params.afficherLignesIntermediaires !== false;
    const afficherMicro = params.afficherLignesMicro !== false;
    const afficherLabels = params.afficherLabelsMacro !== false;
    const afficherAlertes = params.afficherAlerteRetournement !== false;
    const afficherBadge = params.afficherBadgeConfluence !== false;

    // 3️⃣ Fonction locale pour extraire les pivots locaux avec alternance stricte
    function extrairePivots(bars, depth, startIdx, endIdx) {
      const pivotsBruts = [];

      for (let i = startIdx; i <= endIdx; i++) {
        let estHaut = true;
        let estBas = true;
        const hRef = bars[i].high;
        const lRef = bars[i].low;

        for (let j = 1; j <= depth; j++) {
          if (i - j < 0 || i + j >= bars.length) continue;
          if (hRef <= bars[i - j].high || hRef < bars[i + j].high) estHaut = false;
          if (lRef >= bars[i - j].low || lRef > bars[i + j].low) estBas = false;
        }

        if (estHaut) {
          pivotsBruts.push({ prix: hRef, temps: bars[i].time, index: i, estHaut: true });
        } else if (estBas) {
          pivotsBruts.push({ prix: lRef, temps: bars[i].time, index: i, estHaut: false });
        }
      }

      if (pivotsBruts.length === 0) return [];

      // Filtrage pour garantir l'alternance stricte Sommet -> Creux -> Sommet
      const pivotsAlternes = [pivotsBruts[0]];
      for (let i = 1; i < pivotsBruts.length; i++) {
        const dernier = pivotsAlternes[pivotsAlternes.length - 1];
        const courant = pivotsBruts[i];

        if (courant.estHaut === dernier.estHaut) {
          if (courant.estHaut && courant.prix > dernier.prix) {
            pivotsAlternes[pivotsAlternes.length - 1] = courant;
          } else if (!courant.estHaut && courant.prix < dernier.prix) {
            pivotsAlternes[pivotsAlternes.length - 1] = courant;
          }
        } else {
          pivotsAlternes.push(courant);
        }
      }

      // Qualification SMC (HH, HL, LH, LL)
      for (let i = 2; i < pivotsAlternes.length; i++) {
        const p = pivotsAlternes[i];
        const pPrec = pivotsAlternes[i - 2];
        if (p.estHaut) {
          p.labelSMC = p.prix >= pPrec.prix ? 'HH' : 'LH';
        } else {
          p.labelSMC = p.prix >= pPrec.prix ? 'HL' : 'LL';
        }
      }

      return pivotsAlternes;
    }

    // 4️⃣ Fonction locale d'évaluation de la tendance de structure
    function determinerTendance(pivots) {
      if (pivots.length < 3) return 'NEUTRE';
      const sommets = pivots.filter(function (p) { return p.estHaut; });
      const creux = pivots.filter(function (p) { return !p.estHaut; });

      if (sommets.length < 2 || creux.length < 2) return 'NEUTRE';
      const derS = sommets[sommets.length - 1];
      const avS = sommets[sommets.length - 2];
      const derC = creux[creux.length - 1];
      const avC = creux[creux.length - 2];

      if (derS.prix > avS.prix && derC.prix > avC.prix) return 'BULLISH';
      if (derS.prix < avS.prix && derC.prix < avC.prix) return 'BEARISH';
      return 'NEUTRE';
    }

    // 5️⃣ Délimitation des bougies analysées
    const total = bougies.length;
    const debutIndex = Math.max(profMacro, total - lookback);
    const finIndex = total - 1;

    // Calcul des 3 échelles fractales de ZigZag
    const pivotsMacro = extrairePivots(bougies, profMacro, debutIndex, finIndex - profMacro);
    const pivotsInter = extrairePivots(bougies, profInter, debutIndex, finIndex - profInter);
    const pivotsMicro = extrairePivots(bougies, profMicro, debutIndex, finIndex - profMicro);

    const tMacro = determinerTendance(pivotsMacro);
    const tInter = determinerTendance(pivotsInter);
    const tMicro = determinerTendance(pivotsMicro);

    // 6️⃣ Analyse de la jambe macro courante et comptage des sous-vagues
    let directionJambeMacro = 'neutre';
    let nbSousVagues = 0;

    if (pivotsMacro.length > 0) {
      const dernierMacro = pivotsMacro[pivotsMacro.length - 1];
      directionJambeMacro = dernierMacro.estHaut ? 'baissiere' : 'haussiere';

      const microDepuisMacro = pivotsMicro.filter(function (p) { return p.index >= dernierMacro.index; });
      nbSousVagues = Math.max(0, microDepuisMacro.length - 1);
    }

    // 7️⃣ Détection du signal précoce : Micro CHoCH (Changement de caractère interne)
    let alerteRetournement = null;
    if (directionJambeMacro === 'haussiere' && pivotsMicro.length >= 2) {
      const derMicro = pivotsMicro[pivotsMicro.length - 1];
      if (!derMicro.estHaut && derMicro.labelSMC === 'LL') {
        alerteRetournement = 'Micro CHoCH Baissier (Début Pullback / Essoufflement)';
      }
    } else if (directionJambeMacro === 'baissiere' && pivotsMicro.length >= 2) {
      const derMicro = pivotsMicro[pivotsMicro.length - 1];
      if (derMicro.estHaut && derMicro.labelSMC === 'HH') {
        alerteRetournement = 'Micro CHoCH Haussier (Rebond / Fin de vague baissière)';
      }
    }

    // 8️⃣ Score de confluence et diagnostic
    let scoreAlignement = 1;
    let diagnostic = 'Divergence des structures';
    if (tMacro === 'BULLISH' && tInter === 'BULLISH' && tMicro === 'BULLISH') {
      scoreAlignement = 3;
      diagnostic = '🟢 ALIGNEMENT TOTAL HAUSSIER (3/3)';
    } else if (tMacro === 'BEARISH' && tInter === 'BEARISH' && tMicro === 'BEARISH') {
      scoreAlignement = 3;
      diagnostic = '🔴 ALIGNEMENT TOTAL BAISSIER (3/3)';
    } else if (tMacro === 'BULLISH' && (tInter === 'BEARISH' || tMicro === 'BEARISH')) {
      scoreAlignement = 2;
      diagnostic = '🟡 PULLBACK DANS TENDANCE HAUSSIÈRE';
    } else if (tMacro === 'BEARISH' && (tInter === 'BULLISH' || tMicro === 'BULLISH')) {
      scoreAlignement = 2;
      diagnostic = '🟡 REBOND DANS TENDANCE BAISSIÈRE';
    }

    // 9️⃣ Construction des primitives visuelles
    const lignes = [];
    const labels = [];

    // A. Tracé Macro (Doré)
    if (afficherMacro && pivotsMacro.length > 1) {
      for (let i = 0; i < pivotsMacro.length - 1; i++) {
        const p1 = pivotsMacro[i];
        const p2 = pivotsMacro[i + 1];
        lignes.push({
          id: 'macro-leg-' + i,
          prix: p1.prix,
          prixFin: p2.prix,
          dateDebut: p1.temps,
          dateFin: p2.temps,
          couleur: '#f59e0b',
          epaisseur: 2.8,
          style: 'solid'
        });
      }

      // Prolongement en pointillés vers le cours actuel
      const derMacro = pivotsMacro[pivotsMacro.length - 1];
      const derBar = bougies[bougies.length - 1];
      lignes.push({
        id: 'macro-leg-courante',
        prix: derMacro.prix,
        prixFin: derMacro.estHaut ? derBar.low : derBar.high,
        dateDebut: derMacro.temps,
        dateFin: derBar.time,
        couleur: '#f59e0b',
        epaisseur: 2.8,
        style: 'dashed'
      });

      // Labels Macro HH / LL
      if (afficherLabels) {
        for (let i = 0; i < pivotsMacro.length; i++) {
          const pm = pivotsMacro[i];
          if (!pm.labelSMC) continue;
          labels.push({
            id: 'lbl-macro-' + pm.index,
            prix: pm.prix,
            date: pm.temps,
            texte: '[M] ' + pm.labelSMC,
            couleur: pm.estHaut ? '#f59e0b' : '#fbbf24',
            position: pm.estHaut ? 'above' : 'below'
          });
        }
      }
    }

    // B. Tracé Intermédiaire (Bleu)
    if (afficherInter && pivotsInter.length > 1) {
      for (let i = 0; i < pivotsInter.length - 1; i++) {
        const p1 = pivotsInter[i];
        const p2 = pivotsInter[i + 1];
        lignes.push({
          id: 'inter-leg-' + i,
          prix: p1.prix,
          prixFin: p2.prix,
          dateDebut: p1.temps,
          dateFin: p2.temps,
          couleur: '#3b82f6',
          epaisseur: 1.8,
          style: 'solid'
        });
      }

      const derInter = pivotsInter[pivotsInter.length - 1];
      const derBar = bougies[bougies.length - 1];
      lignes.push({
        id: 'inter-leg-courante',
        prix: derInter.prix,
        prixFin: derInter.estHaut ? derBar.low : derBar.high,
        dateDebut: derInter.temps,
        dateFin: derBar.time,
        couleur: '#3b82f6',
        epaisseur: 1.8,
        style: 'dashed'
      });
    }

    // C. Tracé Micro (Cyan Pointillé)
    if (afficherMicro && pivotsMicro.length > 1) {
      for (let i = 0; i < pivotsMicro.length - 1; i++) {
        const p1 = pivotsMicro[i];
        const p2 = pivotsMicro[i + 1];
        lignes.push({
          id: 'micro-leg-' + i,
          prix: p1.prix,
          prixFin: p2.prix,
          dateDebut: p1.temps,
          dateFin: p2.temps,
          couleur: 'rgba(6, 182, 212, 0.65)',
          epaisseur: 1.0,
          style: 'dotted'
        });
      }
    }

    // D. Alerte visuelle Micro CHoCH
    if (afficherAlertes && alerteRetournement && pivotsMicro.length > 0) {
      const derMicro = pivotsMicro[pivotsMicro.length - 1];
      labels.push({
        id: 'alerte-choch-interne',
        prix: derMicro.prix,
        date: derMicro.temps,
        texte: directionJambeMacro === 'haussiere' ? '⚠️ CHoCH Interne ▼' : '⚠️ CHoCH Interne ▲',
        couleur: directionJambeMacro === 'haussiere' ? '#f43f5e' : '#10b981',
        position: directionJambeMacro === 'haussiere' ? 'above' : 'below'
      });
    }

    // E. Badge de Confluence Fractale
    if (afficherBadge && bougies.length > 0) {
      const derB = bougies[bougies.length - 1];
      const icMacro = tMacro === 'BULLISH' ? '🟢' : tMacro === 'BEARISH' ? '🔴' : '⚪';
      const icInter = tInter === 'BULLISH' ? '🟢' : tInter === 'BEARISH' ? '🔴' : '⚪';
      const icMicro = tMicro === 'BULLISH' ? '🟢' : tMicro === 'BEARISH' ? '🔴' : '⚪';

      labels.push({
        id: 'badge-confluence-fractale',
        prix: derB.close,
        date: derB.time,
        texte: 'FRACTAL [' + icMacro + icInter + icMicro + '] ' + nbSousVagues + 'v',
        couleur: scoreAlignement === 3 ? '#10b981' : scoreAlignement === 2 ? '#f59e0b' : '#94a3b8',
        position: 'above'
      });
    }

    // 🔟 Données et primitives finales
    return {
      donnees: {
        scoreAlignement: scoreAlignement,
        diagnostic: diagnostic,
        directionJambeMacro: directionJambeMacro,
        nbSousVagues: nbSousVagues,
        alerteRetournement: alerteRetournement,
        tendanceMacro: tMacro,
        tendanceIntermediaire: tInter,
        tendanceMicro: tMicro
      },
      primitives: {
        boites: [],
        lignes: lignes,
        labels: labels
      },
      typeSpecial: 'fractal-zigzag'
    };
  }
};
