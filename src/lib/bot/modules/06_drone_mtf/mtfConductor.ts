import { agregerBougies, type Bougie } from '@/lib/chartDataHelper';

// ─── 🎯 Types et Structures de données ────────────────────────────────────────

/**
 * Décision stratégique rendue par le Drone MTF pour optimiser le trade.
 */
export type DecisionDrone =
  | 'extension_runner'          // 🚀 Voie libre HTF : autoroute vers un TP étendu
  | 'reduction_securite'        // ⚠️ Obstacle HTF détecté : réduire le TP pour sortir avant
  | 'prudence_contre_tendance'  // 🚨 Trade contre la tendance macro : BE ultra-rapide
  | 'maintien_standard';        // ✅ TP optimal initial validé sans modification

/**
 * Analyse macroscopique réalisée par le Drone sur l'unité de temps supérieure.
 */
export interface ContexteMacroHTF {
  timeframeHTF: string;
  tendance: 'haussiere' | 'baissiere' | 'neutre';
  forceTendance: number;        // Pourcentage d'alignement des bougies HTF (0 à 100)
  prochainObstacle: {
    type: 'supply' | 'demand' | 'resistance' | 'support';
    prix: number;
    distancePips: number;
  } | null;
  cibleRunner: {
    prix: number;
    distancePips: number;
    type: 'liquidite_majeure' | 'sommet_htf' | 'creux_htf';
  } | null;
}

/**
 * Recommandation d'ajustement du trade formulée par le Drone.
 */
export interface RecommandationDrone {
  decision: DecisionDrone;
  directionTrade: 'achat' | 'vente';
  prixEntree: number;
  tpInitial: number;
  tpAjuste: number;
  multiplicateurTP: number;     // Ex: 1.5 = TP augmenté de 50%, 0.8 = TP réduit
  ratioRRAjuste: number;
  ajustementRisquePct: number;  // Ex: 1.0 (normal) ou 0.5 (si contre-tendance)
  messageExplicatif: string;
}

/**
 * Options de configuration du module Drone MTF
 */
export interface OptionsMtfConductor {
  timeframeHTF?: 'H1' | 'H4' | 'D1'; // Unité de temps de supervision (défaut: H4)
  facteurExtensionRunner?: number;   // Multiplicateur pour le mode runner (défaut: 1.5)
  margeObstaclePips?: number;        // Marge de retrait avant un obstacle HTF (défaut: 3.0 pips)
  filtrerContreTendance?: boolean;   // Active la détection de contre-tendance macro (défaut: true)
  afficherHUDDrone?: boolean;        // Affiche le badge récapitulatif du drone (défaut: true)
  afficherLigneTPAjuste?: boolean;   // Affiche la ligne du nouveau TP ajusté (défaut: true)
  afficherZonesObstacles?: boolean;  // Affiche la boîte de l'obstacle HTF (défaut: true)
  resultatsPrecedents?: Array<{ script: any; resultat: any }>;
  donneesM1?: Bougie[];
}

/**
 * Résultat complet retourné par le Drone MTF
 */
export interface ResultatMtfConductor {
  macroHTF: ContexteMacroHTF;
  recommandation: RecommandationDrone | null;
}

// ─── 🚀 Moteur Principal de Calcul ────────────────────────────────────────────

/**
 * Détermine la taille d'un pip selon le cours du marché
 */
function determinerTaillePip(prix: number): number {
  if (prix > 1000) return 0.1;
  if (prix > 50) return 0.01;
  return 0.0001;
}

/**
 * Module 6 : Chef d'Orchestre Multi-Timeframe ("Le Drone")
 * 
 * 1️⃣ Agrège ou analyse les bougies sur l'unité de temps supérieure (H4 ou D1)
 * 2️⃣ Identifie la tendance macro et cartographie les obstacles majeurs (Supply/Demand HTF)
 * 3️⃣ Récupère le trade actif issu du Module 5 (Money Management) ou Module 4 (Entrées LTF)
 * 4️⃣ Décide d'étendre le TP (Mode Runner) ou de le réduire (Sortie de sécurité avant obstacle)
 * 5️⃣ Projette les primitives visuelles (HUD du drone, ligne TP ajusté, obstacle HTF)
 * 
 * Exemple :
 * const res = calculerMtfConductor(bougies, {
 *   timeframeHTF: 'H4',
 *   facteurExtensionRunner: 1.6
 * });
 * console.log('Décision Drone :', res.donnees.recommandation?.decision);
 */
export function calculerMtfConductor(
  bougies: Bougie[],
  options: OptionsMtfConductor = {}
): { donnees: ResultatMtfConductor; primitives: { boites: any[]; lignes: any[]; labels: any[] } } {
  const boites: any[] = [];
  const lignes: any[] = [];
  const labels: any[] = [];

  const tfHTF = options.timeframeHTF ?? 'H4';
  const facteurExtension = options.facteurExtensionRunner ?? 1.5;
  const margeObstaclePips = options.margeObstaclePips ?? 3.0;
  const afficherHUD = options.afficherHUDDrone !== false;
  const afficherLigneTP = options.afficherLigneTPAjuste !== false;
  const afficherObstacles = options.afficherZonesObstacles !== false;

  const resultatParDefaut: ResultatMtfConductor = {
    macroHTF: {
      timeframeHTF: tfHTF,
      tendance: 'neutre',
      forceTendance: 50,
      prochainObstacle: null,
      cibleRunner: null,
    },
    recommandation: null,
  };

  // 1️⃣ Vérification minimale des données
  if (!bougies || bougies.length < 20) {
    return { donnees: resultatParDefaut, primitives: { boites, lignes, labels } };
  }

  const dernierPrix = bougies[bougies.length - 1].close;
  const pipSize = determinerTaillePip(dernierPrix);
  const margePrix = margeObstaclePips * pipSize;

  // 2️⃣ Préparation des bougies de l'unité de temps supérieure (HTF)
  let bougiesHTF: Bougie[] = [];

  // Si des données M1 sont disponibles, on agrège précisément en format H4/H1/D1
  if (options.donneesM1 && options.donneesM1.length >= 100) {
    try {
      bougiesHTF = agregerBougies(options.donneesM1, tfHTF);
    } catch {
      bougiesHTF = [];
    }
  }

  // Fallback si pas de M1 : échantillonnage macro des bougies du graphique
  if (bougiesHTF.length < 10) {
    const pas = tfHTF === 'D1' ? 24 : tfHTF === 'H4' ? 8 : 4;
    const macro: Bougie[] = [];
    for (let i = 0; i < bougies.length; i += pas) {
      const paquet = bougies.slice(i, Math.min(bougies.length, i + pas));
      if (paquet.length === 0) continue;
      let haut = paquet[0].high;
      let bas = paquet[0].low;
      for (const p of paquet) {
        if (p.high > haut) haut = p.high;
        if (p.low < bas) bas = p.low;
      }
      macro.push({
        time: paquet[0].time,
        open: paquet[0].open,
        high: haut,
        low: bas,
        close: paquet[paquet.length - 1].close,
      });
    }
    bougiesHTF = macro;
  }

  // 3️⃣ Analyse de la structure macroscopique HTF (Tendance et Obstacles)
  let tendanceHTF: 'haussiere' | 'baissiere' | 'neutre' = 'neutre';
  let forceTendance = 50;

  if (bougiesHTF.length >= 5) {
    const nbBougiesScan = Math.min(10, bougiesHTF.length);
    const recentsHTF = bougiesHTF.slice(bougiesHTF.length - nbBougiesScan);
    let haussieres = 0;

    for (const b of recentsHTF) {
      if (b.close >= b.open) haussieres++;
    }

    const ratioBull = haussieres / nbBougiesScan;
    forceTendance = Math.round(ratioBull * 100);

    const premierClose = recentsHTF[0].close;
    const dernierClose = recentsHTF[recentsHTF.length - 1].close;

    if (dernierClose > premierClose && ratioBull >= 0.6) {
      tendanceHTF = 'haussiere';
    } else if (dernierClose < premierClose && ratioBull <= 0.4) {
      tendanceHTF = 'baissiere';
    } else {
      tendanceHTF = 'neutre';
    }
  }

  // Recherche des obstacles et cibles majeures HTF
  let obstacleHaut: number | null = null;
  let obstacleBas: number | null = null;

  for (let i = Math.max(0, bougiesHTF.length - 20); i < bougiesHTF.length - 1; i++) {
    const bg = bougiesHTF[i];
    // Sommet HTF au-dessus du prix actuel
    if (bg.high > dernierPrix) {
      if (obstacleHaut === null || bg.high < obstacleHaut) {
        obstacleHaut = bg.high;
      }
    }
    // Creux HTF en-dessous du prix actuel
    if (bg.low < dernierPrix) {
      if (obstacleBas === null || bg.low > obstacleBas) {
        obstacleBas = bg.low;
      }
    }
  }

  const contexteMacro: ContexteMacroHTF = {
    timeframeHTF: tfHTF,
    tendance: tendanceHTF,
    forceTendance,
    prochainObstacle: obstacleHaut
      ? {
          type: 'resistance',
          prix: obstacleHaut,
          distancePips: Number(((obstacleHaut - dernierPrix) / pipSize).toFixed(1)),
        }
      : null,
    cibleRunner: obstacleHaut
      ? {
          type: 'sommet_htf',
          prix: obstacleHaut + 10 * pipSize,
          distancePips: Number(((obstacleHaut + 10 * pipSize - dernierPrix) / pipSize).toFixed(1)),
        }
      : null,
  };

  // 4️⃣ Récupération du Trade Actif (depuis Module 5 ou Module 4)
  let tradeDirection: 'achat' | 'vente' = 'achat';
  let tradePrixEntree = dernierPrix;
  let tradeSL = dernierPrix - 20 * pipSize;
  let tradeTPInitial = dernierPrix + 50 * pipSize;
  let tradeIndex = bougies.length - 1;
  let tradeTemps = bougies[bougies.length - 1].time;
  let tradeTrouve = false;

  if (options.resultatsPrecedents && options.resultatsPrecedents.length > 0) {
    for (const item of options.resultatsPrecedents) {
      // Priorité 1 : Résultats du Module 5 (Money Management)
      if (item.script?.id === 'script-money-management' || item.resultat?.donnees?.dernierTrade) {
        const t = item.resultat.donnees.dernierTrade;
        if (t && t.prixEntree) {
          tradeDirection = t.direction;
          tradePrixEntree = t.prixEntree;
          tradeSL = t.stopLoss;
          tradeTPInitial = t.takeProfit;
          tradeIndex = t.indexSignal;
          tradeTemps = t.tempsSignal;
          tradeTrouve = true;
          break;
        }
      }
      // Priorité 2 : Résultats du Module 4 (Entrées Fractales LTF)
      if (!tradeTrouve && (item.script?.id === 'script-fractal-ltf-entry' || item.resultat?.donnees?.dernierSignal)) {
        const s = item.resultat.donnees.dernierSignal;
        if (s && s.prixEntree) {
          tradeDirection = s.direction;
          tradePrixEntree = s.prixEntree;
          tradeSL = s.stopLoss;
          tradeTPInitial = s.direction === 'achat' ? s.prixEntree + s.distanceSL * 2.5 : s.prixEntree - s.distanceSL * 2.5;
          tradeIndex = s.indexSignal;
          tradeTemps = s.tempsSignal;
          tradeTrouve = true;
        }
      }
    }
  }

  // 5️⃣ Décision Stratégique du Drone : Ajustement du TP
  const estAchat = tradeDirection === 'achat';
  const distanceSL = Math.abs(tradePrixEntree - tradeSL);
  let decision: DecisionDrone = 'maintien_standard';
  let tpAjuste = tradeTPInitial;
  let multiplicateurTP = 1.0;
  let ajustementRisque = 1.0;
  let messageExplicatif = 'Configuration HTF neutre : maintien du Take Profit optimal.';

  if (estAchat) {
    const estContreTendance = tendanceHTF === 'baissiere';
    const obstacleProche = obstacleHaut !== null && obstacleHaut < tradeTPInitial;

    if (estContreTendance) {
      // 🚨 Alerte Contre-Tendance : On réduit l'exposition et on vise un gain rapide
      decision = 'prudence_contre_tendance';
      multiplicateurTP = 0.75;
      ajustementRisque = 0.50; // Risque réduit de moitié
      tpAjuste = tradePrixEntree + distanceSL * 1.8;
      messageExplicatif = `🚨 Attention : Achat contre la tendance macro ${tfHTF} baissière. Risque réduit à 0.5% et TP raccourci.`;
    } else if (obstacleProche && obstacleHaut !== null) {
      // ⚠️ Obstacle HTF détecté avant le TP initial : Sortie de sécurité
      decision = 'reduction_securite';
      tpAjuste = obstacleHaut - margePrix;
      const distanceAjustee = tpAjuste - tradePrixEntree;
      multiplicateurTP = Number((distanceAjustee / (tradeTPInitial - tradePrixEntree)).toFixed(2));
      messageExplicatif = `⚠️ Obstacle Résistance ${tfHTF} détecté à ${obstacleHaut.toFixed(4)}. Sortie avancée juste avant le mur.`;
    } else if (tendanceHTF === 'haussiere') {
      // 🚀 Voie libre HTF : Extension en mode Runner
      decision = 'extension_runner';
      multiplicateurTP = facteurExtension;
      const distanceEtendue = (tradeTPInitial - tradePrixEntree) * facteurExtension;
      tpAjuste = tradePrixEntree + distanceEtendue;
      messageExplicatif = `🚀 Autoroute ${tfHTF} haussière dégagée ! Le Drone conseille d'étendre l'objectif en mode Runner (x${facteurExtension}).`;
    }
  } else {
    // Cas Vente (Short)
    const estContreTendance = tendanceHTF === 'haussiere';
    const obstacleProche = obstacleBas !== null && obstacleBas > tradeTPInitial;

    if (estContreTendance) {
      decision = 'prudence_contre_tendance';
      multiplicateurTP = 0.75;
      ajustementRisque = 0.50;
      tpAjuste = tradePrixEntree - distanceSL * 1.8;
      messageExplicatif = `🚨 Attention : Vente contre la tendance macro ${tfHTF} haussière. Risque réduit à 0.5% et TP raccourci.`;
    } else if (obstacleProche && obstacleBas !== null) {
      decision = 'reduction_securite';
      tpAjuste = obstacleBas + margePrix;
      const distanceAjustee = tradePrixEntree - tpAjuste;
      multiplicateurTP = Number((distanceAjustee / (tradePrixEntree - tradeTPInitial)).toFixed(2));
      messageExplicatif = `⚠️ Obstacle Support ${tfHTF} détecté à ${obstacleBas.toFixed(4)}. Sortie avancée avant le rebond.`;
    } else if (tendanceHTF === 'baissiere') {
      decision = 'extension_runner';
      multiplicateurTP = facteurExtension;
      const distanceEtendue = (tradePrixEntree - tradeTPInitial) * facteurExtension;
      tpAjuste = tradePrixEntree - distanceEtendue;
      messageExplicatif = `🚀 Autoroute ${tfHTF} baissière dégagée ! Le Drone conseille d'étendre l'objectif en mode Runner (x${facteurExtension}).`;
    }
  }

  const distanceTPAjuste = Math.abs(tpAjuste - tradePrixEntree);
  const ratioRRAjuste = distanceSL > 0 ? Number((distanceTPAjuste / distanceSL).toFixed(2)) : 2.5;

  const recommandation: RecommandationDrone = {
    decision,
    directionTrade: tradeDirection,
    prixEntree: tradePrixEntree,
    tpInitial: tradeTPInitial,
    tpAjuste,
    multiplicateurTP,
    ratioRRAjuste,
    ajustementRisquePct: ajustementRisque,
    messageExplicatif,
  };

  // ─── 6️⃣ Primitives Visuelles sur le Graphique ─────────────────────────────
  const bgSignal = bougies[tradeIndex] || bougies[bougies.length - 1];
  const tempsDebut = bgSignal.time;
  const tempsFin = bougies[Math.min(bougies.length - 1, tradeIndex + 30)].time;

  // 🛸 Ligne du TP Ajusté par le Drone
  if (afficherLigneTP && Math.abs(tpAjuste - tradeTPInitial) > pipSize) {
    const estExtension = decision === 'extension_runner';
    lignes.push({
      id: `ligne-drone-tp-${tradeIndex}`,
      prix: tpAjuste,
      dateDebut: tempsDebut,
      dateFin: tempsFin,
      couleur: estExtension ? '#a855f7' : '#f59e0b', // Violet pour Runner, Orange pour réduction
      style: 'dashed',
      label: estExtension
        ? `🛸 TP Runner Drone (x${multiplicateurTP} | R:R ${ratioRRAjuste}): ${tpAjuste.toFixed(tpAjuste > 100 ? 2 : 4)}`
        : `🛸 TP Sécurité Drone (-${margeObstaclePips}p): ${tpAjuste.toFixed(tpAjuste > 100 ? 2 : 4)}`,
    });
  }

  // 📦 Boîte de l'obstacle HTF détecté
  if (afficherObstacles) {
    const obstacleCible = estAchat ? obstacleHaut : obstacleBas;
    if (obstacleCible !== null) {
      boites.push({
        id: `box-obstacle-htf-${tradeIndex}`,
        prixHaut: obstacleCible + 2 * pipSize,
        prixBas: obstacleCible - 2 * pipSize,
        dateDebut: tempsDebut,
        dateFin: tempsFin,
        couleurFond: 'rgba(168, 85, 247, 0.15)',
        couleurBordure: '#a855f7',
        label: `🧱 Mur HTF ${tfHTF} (${estAchat ? 'Résistance' : 'Support'})`,
      });
    }
  }

  // 🏷️ Badge HUD du Drone en haut de la bougie
  if (afficherHUD) {
    const icone =
      decision === 'extension_runner'
        ? '🚀'
        : decision === 'reduction_securite'
        ? '⚠️'
        : decision === 'prudence_contre_tendance'
        ? '🚨'
        : '🛸';

    labels.push({
      id: `hud-drone-${tradeIndex}`,
      prix: estAchat ? tpAjuste : tradeSL,
      date: tempsDebut,
      texte: `${icone} DRONE ${tfHTF} [${tendanceHTF.toUpperCase()}] : ${messageExplicatif.slice(0, 50)}...`,
      couleur: decision === 'extension_runner' ? '#a855f7' : decision === 'reduction_securite' ? '#f59e0b' : '#38bdf8',
      position: estAchat ? 'above' : 'below',
    });
  }

  return {
    donnees: {
      macroHTF: contexteMacro,
      recommandation,
    },
    primitives: { boites, lignes, labels },
  };
}
