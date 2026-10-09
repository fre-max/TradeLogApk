import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualLine, VisualLabel, VisualBox } from '@/types/indicatorScript';

/**
 * Options de configuration pour l'indicateur ZigZag Fractal Multi-Niveaux.
 */
export interface OptionsFractalZigZag {
  profondeurMacro?: number;        // Profondeur du ZigZag majeur / HTF (défaut: 21)
  profondeurIntermediaire?: number;// Profondeur de la structure swing / MTF (défaut: 8)
  profondeurMicro?: number;        // Profondeur de la micro-structure / LTF (défaut: 3)
  lookbackBars?: number;           // Historique de bougies analysé (défaut: 600)
  afficherLignesMacro?: boolean;   // Tracer la grande vague directrice dorée (défaut: true)
  afficherLignesIntermediaires?: boolean; // Tracer les vagues secondaires bleues (défaut: true)
  afficherLignesMicro?: boolean;   // Tracer les micro-vagues cyan (défaut: true)
  afficherLabelsMacro?: boolean;   // Afficher les labels HH/LL majeurs (défaut: true)
  afficherAlerteRetournement?: boolean; // Détecter les cassures internes précoces (défaut: true)
  afficherBadgeConfluence?: boolean;    // Badge de synthèse 3/3 sur la dernière bougie (défaut: true)
}

/**
 * Point de pivot (sommet ou creux) calculé pour un niveau fractal donné.
 */
export interface PivotFractal {
  prix: number;
  temps: number | string;
  index: number;
  estHaut: boolean; // Vrai si sommet, faux si creux
  labelSMC?: 'HH' | 'HL' | 'LH' | 'LL';
}

/**
 * Synthèse de l'alignement fractal à travers les 3 échelles de temps/profondeur.
 */
export interface ConfluenceFractale {
  tendanceMacro: 'BULLISH' | 'BEARISH' | 'NEUTRE';
  tendanceIntermediaire: 'BULLISH' | 'BEARISH' | 'NEUTRE';
  tendanceMicro: 'BULLISH' | 'BEARISH' | 'NEUTRE';
  scoreAlignement: number; // 3 si alignement parfait, 2 si correction, 1 si divergence
  diagnostic: string;
  alerteRetournement?: string;
}

/**
 * Résultat complet retourné par le moteur ZigZag Fractal.
 */
export interface ResultatFractalZigZag {
  pivotsMacro: PivotFractal[];
  pivotsIntermediaires: PivotFractal[];
  pivotsMicro: PivotFractal[];
  confluence: ConfluenceFractale;
  nbSousVaguesJambeCourante: number;
  directionJambeMacroCourante: 'haussiere' | 'baissiere' | 'neutre';
  boites: VisualBox[];
  lignes: VisualLine[];
  labels: VisualLabel[];
}

/**
 * Calcule les pivots locaux avec alternance stricte (sommet -> creux -> sommet)
 * pour une profondeur de sensibilité donnée.
 * 
 * Exemple :
 * const pivots = extrairePivotsSensibilite(bougies, 21, 0, 500);
 */
function extrairePivotsSensibilite(
  bougies: Bougie[],
  depth: number,
  debutIndex: number,
  finIndex: number
): PivotFractal[] {
  const pivotsBruts: PivotFractal[] = [];

  // 1️⃣ Détection des sommets et creux locaux purs (barre centrale plus haute/basse que les voisines)
  for (let i = debutIndex; i <= finIndex; i++) {
    let estHaut = true;
    let estBas = true;

    const hRef = bougies[i].high;
    const lRef = bougies[i].low;

    for (let j = 1; j <= depth; j++) {
      if (i - j < 0 || i + j >= bougies.length) continue;
      if (hRef <= bougies[i - j].high || hRef < bougies[i + j].high) estHaut = false;
      if (lRef >= bougies[i - j].low || lRef > bougies[i + j].low) estBas = false;
    }

    if (estHaut) {
      pivotsBruts.push({ prix: hRef, temps: bougies[i].time, index: i, estHaut: true });
    } else if (estBas) {
      pivotsBruts.push({ prix: lRef, temps: bougies[i].time, index: i, estHaut: false });
    }
  }

  if (pivotsBruts.length === 0) return [];

  // 2️⃣ Filtrage pour forcer l'alternance stricte (Sommet -> Creux -> Sommet)
  const pivotsAlternes: PivotFractal[] = [pivotsBruts[0]];

  for (let i = 1; i < pivotsBruts.length; i++) {
    const dernier = pivotsAlternes[pivotsAlternes.length - 1];
    const courant = pivotsBruts[i];

    if (courant.estHaut === dernier.estHaut) {
      // Si deux sommets consécutifs, on garde le plus haut
      if (courant.estHaut && courant.prix > dernier.prix) {
        pivotsAlternes[pivotsAlternes.length - 1] = courant;
      }
      // Si deux creux consécutifs, on garde le plus bas
      else if (!courant.estHaut && courant.prix < dernier.prix) {
        pivotsAlternes[pivotsAlternes.length - 1] = courant;
      }
    } else {
      pivotsAlternes.push(courant);
    }
  }

  // 3️⃣ Qualification SMC (HH, HL, LH, LL)
  for (let i = 2; i < pivotsAlternes.length; i++) {
    const p = pivotsAlternes[i];
    const pPrec = pivotsAlternes[i - 2]; // Le précédent pivot de même nature (sommet ou creux)

    if (p.estHaut) {
      p.labelSMC = p.prix >= pPrec.prix ? 'HH' : 'LH';
    } else {
      p.labelSMC = p.prix >= pPrec.prix ? 'HL' : 'LL';
    }
  }

  return pivotsAlternes;
}

/**
 * Détermine la tendance structurelle d'une série de pivots ZigZag.
 */
function evaluerTendancePivots(pivots: PivotFractal[]): 'BULLISH' | 'BEARISH' | 'NEUTRE' {
  if (pivots.length < 3) return 'NEUTRE';

  const sommets = pivots.filter((p) => p.estHaut);
  const creux = pivots.filter((p) => !p.estHaut);

  if (sommets.length < 2 || creux.length < 2) return 'NEUTRE';

  const dernierS = sommets[sommets.length - 1];
  const avantDernierS = sommets[sommets.length - 2];
  const dernierC = creux[creux.length - 1];
  const avantDernierC = creux[creux.length - 2];

  // Sommets plus hauts et creux plus hauts = Hausse confirmée
  if (dernierS.prix > avantDernierS.prix && dernierC.prix > avantDernierC.prix) {
    return 'BULLISH';
  }
  // Sommets plus bas et creux plus bas = Baisse confirmée
  if (dernierS.prix < avantDernierS.prix && dernierC.prix < avantDernierC.prix) {
    return 'BEARISH';
  }

  return 'NEUTRE';
}

/**
 * Moteur principal : Calcule l'imbrication fractale Multi-Profondeurs de ZigZags.
 * 
 * Exemple :
 * const res = calculerFractalZigZag(bougies, { profondeurMacro: 21, profondeurMicro: 3 });
 * console.log(res.confluence.diagnostic); // "🟢 ALIGNEMENT TOTAL HAUSSIER (3/3)"
 */
export function calculerFractalZigZag(
  bougies: Bougie[],
  options: OptionsFractalZigZag = {}
): ResultatFractalZigZag {
  // 1️⃣ Vérifications préalables
  if (!bougies || bougies.length < 40) {
    return {
      pivotsMacro: [],
      pivotsIntermediaires: [],
      pivotsMicro: [],
      confluence: {
        tendanceMacro: 'NEUTRE',
        tendanceIntermediaire: 'NEUTRE',
        tendanceMicro: 'NEUTRE',
        scoreAlignement: 0,
        diagnostic: 'Données insuffisantes',
      },
      nbSousVaguesJambeCourante: 0,
      directionJambeMacroCourante: 'neutre',
      boites: [],
      lignes: [],
      labels: [],
    };
  }

  // 2️⃣ Préparation des paramètres
  const profMacro = options.profondeurMacro ?? 21;
  const profInter = options.profondeurIntermediaire ?? 8;
  const profMicro = options.profondeurMicro ?? 3;
  const lookback = options.lookbackBars ?? 600;

  const afficherMacro = options.afficherLignesMacro !== false;
  const afficherInter = options.afficherLignesIntermediaires !== false;
  const afficherMicro = options.afficherLignesMicro !== false;
  const afficherLabels = options.afficherLabelsMacro !== false;
  const afficherAlertes = options.afficherAlerteRetournement !== false;
  const afficherBadge = options.afficherBadgeConfluence !== false;

  const total = bougies.length;
  const debutIndex = Math.max(profMacro, total - lookback);
  const finIndex = total - 1;

  // 3️⃣ Calcul des 3 niveaux de ZigZag imbriqués
  const pivotsMacro = extrairePivotsSensibilite(bougies, profMacro, debutIndex, finIndex - profMacro);
  const pivotsInter = extrairePivotsSensibilite(bougies, profInter, debutIndex, finIndex - profInter);
  const pivotsMicro = extrairePivotsSensibilite(bougies, profMicro, debutIndex, finIndex - profMicro);

  // 4️⃣ Évaluation des tendances fractales respectives
  const tMacro = evaluerTendancePivots(pivotsMacro);
  const tInter = evaluerTendancePivots(pivotsInter);
  const tMicro = evaluerTendancePivots(pivotsMicro);

  // 5️⃣ Analyse de la jambe macro courante et décompte des sous-vagues
  let directionJambeMacro: 'haussiere' | 'baissiere' | 'neutre' = 'neutre';
  let nbSousVagues = 0;

  if (pivotsMacro.length > 0) {
    const dernierP = pivotsMacro[pivotsMacro.length - 1];
    // Si le dernier pivot macro validé est un creux, la jambe courante monte vers le prochain sommet
    directionJambeMacro = dernierP.estHaut ? 'baissiere' : 'haussiere';

    // Compte combien de micro-vagues se sont produites depuis ce pivot macro
    const microDepuisMacro = pivotsMicro.filter((p) => p.index >= dernierP.index);
    nbSousVagues = Math.max(0, microDepuisMacro.length - 1);
  }

  // 6️⃣ Détection d'alerte précoce d'épuisement / Internal CHoCH
  let alerteRetournement: string | undefined = undefined;

  if (directionJambeMacro === 'haussiere' && pivotsMicro.length >= 2) {
    const dernierMicro = pivotsMicro[pivotsMicro.length - 1];
    // Si la macro monte mais que le dernier micro-pivot est un creux plus bas (LL)
    if (!dernierMicro.estHaut && dernierMicro.labelSMC === 'LL') {
      alerteRetournement = 'Micro CHoCH Baissier (Début de Pullback / Fin de vague haussière)';
    }
  } else if (directionJambeMacro === 'baissiere' && pivotsMicro.length >= 2) {
    const dernierMicro = pivotsMicro[pivotsMicro.length - 1];
    // Si la macro descend mais que le micro-pivot fait un sommet plus haut (HH)
    if (dernierMicro.estHaut && dernierMicro.labelSMC === 'HH') {
      alerteRetournement = 'Micro CHoCH Haussier (Rebond technique / Fin de vague baissière)';
    }
  }

  // 7️⃣ Calcul du score de confluence et diagnostic clair
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
    diagnostic = '🟡 PULLBACK DANS UNE TENDANCE HAUSSIÈRE';
  } else if (tMacro === 'BEARISH' && (tInter === 'BULLISH' || tMicro === 'BULLISH')) {
    scoreAlignement = 2;
    diagnostic = '🟡 REBOND DANS UNE TENDANCE BAISSIÈRE';
  }

  const confluence: ConfluenceFractale = {
    tendanceMacro: tMacro,
    tendanceIntermediaire: tInter,
    tendanceMicro: tMicro,
    scoreAlignement,
    diagnostic,
    alerteRetournement,
  };

  // 8️⃣ Génération des primitives visuelles (Lignes obliques et étiquettes)
  const lignesVisuelles: VisualLine[] = [];
  const labelsVisuels: VisualLabel[] = [];

  // A. Tracé du ZigZag Macro (Ligne dorée épaisse d'orientation)
  if (afficherMacro && pivotsMacro.length > 1) {
    for (let i = 0; i < pivotsMacro.length - 1; i++) {
      const p1 = pivotsMacro[i];
      const p2 = pivotsMacro[i + 1];

      lignesVisuelles.push({
        id: `macro-leg-${i}`,
        prix: p1.prix,
        prixFin: p2.prix,
        dateDebut: p1.temps,
        dateFin: p2.temps,
        couleur: '#f59e0b', // Or / Ambre
        epaisseur: 2.8,
        style: 'solid',
      });
    }

    // Prolongement depuis le dernier pivot macro jusqu'au cours actuel
    const dernierMacro = pivotsMacro[pivotsMacro.length - 1];
    const derBougie = bougies[bougies.length - 1];
    lignesVisuelles.push({
      id: 'macro-leg-courante',
      prix: dernierMacro.prix,
      prixFin: dernierMacro.estHaut ? derBougie.low : derBougie.high,
      dateDebut: dernierMacro.temps,
      dateFin: derBougie.time,
      couleur: '#f59e0b',
      epaisseur: 2.8,
      style: 'dashed',
    });

    // Labels SMC Macro
    if (afficherLabels) {
      for (const pm of pivotsMacro) {
        if (!pm.labelSMC) continue;
        labelsVisuels.push({
          id: `lbl-macro-${pm.index}`,
          prix: pm.prix,
          date: pm.temps,
          texte: `[M] ${pm.labelSMC}`,
          couleur: pm.estHaut ? '#f59e0b' : '#fbbf24',
          position: pm.estHaut ? 'above' : 'below',
        });
      }
    }
  }

  // B. Tracé du ZigZag Intermédiaire (Ligne bleue moyenne de structure)
  if (afficherInter && pivotsInter.length > 1) {
    for (let i = 0; i < pivotsInter.length - 1; i++) {
      const p1 = pivotsInter[i];
      const p2 = pivotsInter[i + 1];

      lignesVisuelles.push({
        id: `inter-leg-${i}`,
        prix: p1.prix,
        prixFin: p2.prix,
        dateDebut: p1.temps,
        dateFin: p2.temps,
        couleur: '#3b82f6', // Bleu royal
        epaisseur: 1.8,
        style: 'solid',
      });
    }

    const dernierInter = pivotsInter[pivotsInter.length - 1];
    const derBougie = bougies[bougies.length - 1];
    lignesVisuelles.push({
      id: 'inter-leg-courante',
      prix: dernierInter.prix,
      prixFin: dernierInter.estHaut ? derBougie.low : derBougie.high,
      dateDebut: dernierInter.temps,
      dateFin: derBougie.time,
      couleur: '#3b82f6',
      epaisseur: 1.8,
      style: 'dashed',
    });
  }

  // C. Tracé du ZigZag Micro (Ligne cyan fine pointillée d'exécution)
  if (afficherMicro && pivotsMicro.length > 1) {
    for (let i = 0; i < pivotsMicro.length - 1; i++) {
      const p1 = pivotsMicro[i];
      const p2 = pivotsMicro[i + 1];

      lignesVisuelles.push({
        id: `micro-leg-${i}`,
        prix: p1.prix,
        prixFin: p2.prix,
        dateDebut: p1.temps,
        dateFin: p2.temps,
        couleur: 'rgba(6, 182, 212, 0.65)', // Cyan translucide
        epaisseur: 1.0,
        style: 'dotted',
      });
    }
  }

  // D. Alerte visuelle de retournement précoce (Internal CHoCH)
  if (afficherAlertes && alerteRetournement && pivotsMicro.length > 0) {
    const derMicro = pivotsMicro[pivotsMicro.length - 1];
    labelsVisuels.push({
      id: 'alerte-choch-interne',
      prix: derMicro.prix,
      date: derMicro.temps,
      texte: directionJambeMacro === 'haussiere' ? '⚠️ CHoCH Interne ▼' : '⚠️ CHoCH Interne ▲',
      couleur: directionJambeMacro === 'haussiere' ? '#f43f5e' : '#10b981',
      position: directionJambeMacro === 'haussiere' ? 'above' : 'below',
    });
  }

  // E. Badge de Confluence Fractale sur la dernière bougie
  if (afficherBadge && bougies.length > 0) {
    const derB = bougies[bougies.length - 1];
    const iconeMacro = tMacro === 'BULLISH' ? '🟢' : tMacro === 'BEARISH' ? '🔴' : '⚪';
    const iconeInter = tInter === 'BULLISH' ? '🟢' : tInter === 'BEARISH' ? '🔴' : '⚪';
    const iconeMicro = tMicro === 'BULLISH' ? '🟢' : tMicro === 'BEARISH' ? '🔴' : '⚪';

    labelsVisuels.push({
      id: 'badge-confluence-fractale',
      prix: derB.close,
      date: derB.time,
      texte: `FRACTAL [${iconeMacro}${iconeInter}${iconeMicro}] ${nbSousVagues}v`,
      couleur: scoreAlignement === 3 ? '#10b981' : scoreAlignement === 2 ? '#f59e0b' : '#94a3b8',
      position: 'above',
    });
  }

  // 9️⃣ Retour des résultats complets
  return {
    pivotsMacro,
    pivotsIntermediaires: pivotsInter,
    pivotsMicro,
    confluence,
    nbSousVaguesJambeCourante: nbSousVagues,
    directionJambeMacroCourante: directionJambeMacro,
    boites: [],
    lignes: lignesVisuelles,
    labels: labelsVisuels,
  };
}
