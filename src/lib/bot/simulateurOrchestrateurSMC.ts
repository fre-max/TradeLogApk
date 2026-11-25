import { agregerBougies, type Bougie } from '@/lib/chartDataHelper';
import type { RapportPerformance, TradeBotSimule } from '@/types/bot';
import {
  calculerOrchestrateurSMC,
  type ParametresOrchestrateurSMC,
  type SetupOrchestreSMC,
  type OrderBlockClassiqueSMC,
} from '@/lib/indicators/favoris/orchestrateurSMC';
import {
  detecterDojisAvecPlage,
  convertirTempsEnMs,
} from '@/lib/indicators/favoris/sandboxDojiShvedPlage';

/**
 * Options du Mode Fractal Multi-Timeframe (Setup LTF à l'intérieur de la plage d'un Setup Maître HTF)
 */
export interface OptionsModeFractalHTFVersLTF {
  actif: boolean;
  timeframeHTF?: string; // Ex: '4h' (Setup Maître qui valide le chevauchement UOP et fixe le Grand TP)
  timeframeLTF?: string; // Ex: '15m' ou '30m' (Second Setup interne sans filtre de chevauchement, Petit SL)
  filtreZoneOB?: 'TOUTE_LA_PLAGE' | 'TOUT_OB_PROTEGE' | 'DERNIER_OB_UNIQUEMENT';
  bougiesHTF?: Bougie[]; // Optionnel : bougies HTF déjà agrégées
  bougiesLTF?: Bougie[]; // Optionnel : bougies LTF déjà agrégées
}

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * 🤖 MOTEUR DE SIMULATION BATCH POUR LE CHEF D'ORCHESTRE SMC
 * ──────────────────────────────────────────────────────────────────────────────
 * Exécute l'algorithme du Chef d'Orchestre SMC sur tout l'historique de bougies,
 * extrait chaque position prise automatiquement, calcule les gains/pertes monétaires
 * et génère le rapport statistique complet (Win Rate, Profit Factor, Courbe d'équité).
 * 
 * Exemple :
 * const rapport = executerSimulationOrchestrateurSMC(bougies, {
 *   palierTPVise: 'TP1',
 *   capitalInitial: 10000,
 *   risquePourcent: 1.0,
 * });
 * console.log(`Win Rate : ${rapport.winratePourcentage}%`);
 */
export function executerSimulationOrchestrateurSMC(
  bougies: Bougie[],
  options: {
    parametresSMC?: ParametresOrchestrateurSMC;
    capitalInitial?: number;
    risquePourcent?: number;
    paire?: string;
    timeframe?: string;
    donneesM1?: Bougie[];
    modeFractal?: OptionsModeFractalHTFVersLTF;
  } = {}
): RapportPerformance {
  if (options.modeFractal?.actif) {
    return executerSimulationFractaleHTFVersLTF(bougies, options);
  }
  const capitalInitial = options.capitalInitial ?? 10000;
  const risquePourcent = options.risquePourcent ?? 1.0;
  const parametresSMC = options.parametresSMC ?? {};

  if (!bougies || bougies.length < 20) {
    return {
      botId: 'bot-orchestrateur-smc',
      botNom: "Chef d'Orchestre SMC (Doji + Shved + UOP)",
      periode: {
        debut: new Date().toISOString(),
        fin: new Date().toISOString(),
        totalBougies: 0,
      },
      capitalInitial,
      capitalFinal: capitalInitial,
      pnlNetMontant: 0,
      pnlNetPourcentage: 0,
      totalTrades: 0,
      tradesGagnants: 0,
      tradesPerdants: 0,
      tradesBreakeven: 0,
      winratePourcentage: 0,
      profitFactor: 0,
      maxDrawdownPourcentage: 0,
      ratioRRMoyen: 0,
      courbeEquity: [{ date: new Date().toISOString(), capital: capitalInitial }],
      trades: [],
    };
  }

  // 1️⃣ Exécution de l'algorithme Chef d'Orchestre SMC
  // On désactive le calque HTF et on passe donneesM1: undefined pour éviter que Shved ne reparcoure 370 000 M1 en O(N²)
  const resultatSMC = calculerOrchestrateurSMC(bougies, {
    ...parametresSMC,
    masquerSetupsTermines: false, // On conserve tous les setups pour le journal
    activerCalqueFractalHTF: false,
    donneesM1: undefined,
    timeframeSource: 'ACTUEL',
    chartTimeframe: options.timeframe || '15m',
  });

  // 2️⃣ Filtrage des setups réels confirmés (ou en cours avec SL/TP calculés)
  const setupsConfirmes = (resultatSMC.setups || []).filter(
    (s) => s.prixTP !== undefined && s.prixSL !== undefined && s.statut !== 'ANNULE'
  );

  const trades: TradeBotSimule[] = [];
  let capitalActuel = capitalInitial;
  let capitalPicMax = capitalInitial;
  let maxDrawdownMontant = 0;

  let totalGainsMontant = 0;
  let totalPertesMontant = 0;
  let sommeRRGagnants = 0;
  let totalTradesGagnants = 0;
  let totalTradesPerdants = 0;
  let totalTradesBreakeven = 0;

  const courbeEquity: Array<{ date: string; capital: number }> = [
    {
      date: String(bougies[0]?.time || new Date().toISOString()),
      capital: capitalInitial,
    },
  ];

  // 3️⃣ Parcours et simulation monétaire réaliste de chaque trade (sans biais du futur ni empilement de positions)
  let dernierIndexSortie = -1;

  for (let i = 0; i < setupsConfirmes.length; i++) {
    const s = setupsConfirmes[i];
    if (s.statut !== 'CONFIRME' || s.prixTP === undefined) continue;

    const estAchat = s.type === 'ACHAT';
    const direction = estAchat ? 'long' : 'short';
    const idxConf = s.indexConfirmation ?? Math.min(bougies.length - 1, s.indexDoji + 3);

    // 🛑 1. Pas d'empilement de positions simultanées (identique à MT5 : 1 position ouverte à la fois)
    if (idxConf <= dernierIndexSortie) {
      continue;
    }

    // 🛑 2. Vérifier que le TP n'a pas déjà été touché PENDANT les 3 bougies de confirmation avant l'entrée réelle
    let tpDejaConsommePendantConfirmation = false;
    for (let k = s.indexDoji + 1; k <= idxConf && k < bougies.length; k++) {
      if (estAchat && bougies[k].high >= s.prixTP) {
        tpDejaConsommePendantConfirmation = true;
        break;
      }
      if (!estAchat && bougies[k].low <= s.prixTP) {
        tpDejaConsommePendantConfirmation = true;
        break;
      }
    }
    if (tpDejaConsommePendantConfirmation) {
      continue;
    }

    // 🎯 3. Prix d'entrée réel à la clôture de la 3ème bougie de confirmation (identique à l'exécution MT5)
    const bougieEntreeReelle = bougies[idxConf];
    const prixEntreeReel = bougieEntreeReelle ? bougieEntreeReelle.close : s.prixEntree;
    const dateEntreeReelle = bougieEntreeReelle ? bougieEntreeReelle.time : s.tempsDoji;

    // Vérifier que le prix d'entrée réel à la 3ème bougie est toujours valide entre SL et TP
    if (estAchat && (prixEntreeReel <= s.prixSL || prixEntreeReel >= s.prixTP)) continue;
    if (!estAchat && (prixEntreeReel >= s.prixSL || prixEntreeReel <= s.prixTP)) continue;

    // Montant risqué sur ce trade ($) et vrai ratio R:R depuis l'entrée réelle
    const risqueMontant = (capitalActuel * risquePourcent) / 100;
    const distanceSL = Math.max(0.0001, Math.abs(prixEntreeReel - s.prixSL));
    const distanceTP = Math.max(0.0001, Math.abs(s.prixTP - prixEntreeReel));
    const ratioRR = Number((distanceTP / distanceSL).toFixed(2));

    // 4. Suivi bougie par bougie après la 3ème bougie de confirmation (priorité conservatrice au SL si même bougie)
    let resultat: 'win' | 'loss' | 'breakeven' = 'breakeven';
    let prixSortie = prixEntreeReel;
    let indexSortie = idxConf;
    let dateSortie = dateEntreeReelle;
    let pnlMontant = 0;

    for (let m = idxConf + 1; m < bougies.length; m++) {
      const bm = bougies[m];
      const slTouche = estAchat ? bm.low <= s.prixSL : bm.high >= s.prixSL;
      const tpTouche = estAchat ? bm.high >= s.prixTP : bm.low <= s.prixTP;

      if (slTouche) {
        resultat = 'loss';
        prixSortie = s.prixSL;
        indexSortie = m;
        dateSortie = bm.time;
        pnlMontant = -risqueMontant;
        totalTradesPerdants++;
        totalPertesMontant += Math.abs(pnlMontant);
        break;
      }
      if (tpTouche) {
        resultat = 'win';
        prixSortie = s.prixTP;
        indexSortie = m;
        dateSortie = bm.time;
        pnlMontant = Number((risqueMontant * ratioRR).toFixed(2));
        totalTradesGagnants++;
        totalGainsMontant += pnlMontant;
        sommeRRGagnants += ratioRR;
        break;
      }
    }

    if (resultat === 'breakeven') {
      totalTradesBreakeven++;
    } else {
      dernierIndexSortie = indexSortie;
    }

    capitalActuel = Number((capitalActuel + pnlMontant).toFixed(2));

    // Calcul du drawdown
    if (capitalActuel > capitalPicMax) {
      capitalPicMax = capitalActuel;
    } else {
      const drawdownActuel = capitalPicMax - capitalActuel;
      if (drawdownActuel > maxDrawdownMontant) {
        maxDrawdownMontant = drawdownActuel;
      }
    }

    const tradeSimule: TradeBotSimule = {
      id: `bot-trade-${s.id}`,
      direction,
      indexEntree: idxConf,
      dateEntree: String(dateEntreeReelle),
      prixEntree: prixEntreeReel,
      indexSortie,
      dateSortie: String(dateSortie),
      prixSortie,
      stopLoss: s.prixSL,
      takeProfit: s.prixTP,
      resultat,
      pnlMontant,
      pnlPourcentage: Number(((pnlMontant / capitalInitial) * 100).toFixed(2)),
      ratioRR,
      dureeBougies: Math.max(1, indexSortie - idxConf),
      commentaire: `Palier: ${s.palierTPVise || 'AUTO'} (TP${s.ordreTP || 1}) · Score Shved: ${s.scoreShved}/100`,
    };

    trades.push(tradeSimule);

    courbeEquity.push({
      date: String(dateSortie),
      capital: capitalActuel,
    });
  }

  const totalTrades = trades.length;
  const tradesTermines = totalTradesGagnants + totalTradesPerdants;
  const winratePourcentage = tradesTermines > 0
    ? Number(((totalTradesGagnants / tradesTermines) * 100).toFixed(1))
    : 0;

  const profitFactor = totalPertesMontant > 0
    ? Number((totalGainsMontant / totalPertesMontant).toFixed(2))
    : (totalGainsMontant > 0 ? 99.99 : 0);

  const maxDrawdownPourcentage = capitalInitial > 0
    ? Number(((maxDrawdownMontant / capitalInitial) * 100).toFixed(2))
    : 0;

  const ratioRRMoyen = totalTradesGagnants > 0
    ? Number((sommeRRGagnants / totalTradesGagnants).toFixed(2))
    : 0;

  const pnlNetMontant = Number((capitalActuel - capitalInitial).toFixed(2));
  const pnlNetPourcentage = Number(((pnlNetMontant / capitalInitial) * 100).toFixed(2));

  return {
    botId: 'bot-orchestrateur-smc',
    botNom: "Chef d'Orchestre SMC (Doji + Shved + UOP)",
    periode: {
      debut: String(bougies[0]?.time || ''),
      fin: String(bougies[bougies.length - 1]?.time || ''),
      totalBougies: bougies.length,
    },
    capitalInitial,
    capitalFinal: capitalActuel,
    pnlNetMontant,
    pnlNetPourcentage,
    totalTrades,
    tradesGagnants: totalTradesGagnants,
    tradesPerdants: totalTradesPerdants,
    tradesBreakeven: totalTradesBreakeven,
    winratePourcentage,
    profitFactor,
    maxDrawdownPourcentage,
    ratioRRMoyen,
    courbeEquity,
    trades,
  };
}

/**
 * 🔬 SIMULATION FRACTALE MULTI-TIMEFRAME (SETUP LTF À L'INTÉRIEUR DU SETUP HTF)
 *
 * Logique :
 * 1. En HTF (ex: H4) : on détecte un Setup Maître complet (Doji + S/R + Range 3 bougies + Taux de Chevauchement UOP sur 10 vagues).
 *    Ce Setup Maître définit :
 *      - La Plage de Prix Protégée [SL_HTF ➔ Clôture B2_HTF ± AmplitudeDoji_HTF]
 *      - Les Rectangles des Order Blocks Classiques SMC protégés (avec hiérarchie jusqu'au Dernier OB)
 *      - Le GRAND Objectif Take Profit (TP_HTF).
 * 2. En LTF (ex: M15 ou M30) : tant que le TP_HTF n'est pas atteint et que le SL_HTF tient,
 *    on cherche à l'intérieur de cette plage de prix notre MÊME setup (Doji LTF + Range 3 bougies LTF),
 *    MAIS SANS recalculer ni exiger le taux de chevauchement UOP (car l'autoroute est déjà ouverte en HTF !).
 * 3. Nouvelle Position :
 *      - Entrée : confirmation du Second Setup LTF
 *      - Stop Loss : le PETIT SL du Second Setup LTF
 *      - Take Profit : le GRAND TP du Premier Setup HTF (TP_HTF) !
 */
export function executerSimulationFractaleHTFVersLTF(
  bougiesDefaut: Bougie[],
  options: {
    parametresSMC?: ParametresOrchestrateurSMC;
    capitalInitial?: number;
    risquePourcent?: number;
    paire?: string;
    timeframe?: string;
    donneesM1?: Bougie[];
    modeFractal?: OptionsModeFractalHTFVersLTF;
  } = {},
  outSetupsHTFValides?: SetupOrchestreSMC[]
): RapportPerformance {
  const capitalInitial = options.capitalInitial ?? 10000;
  const risquePourcent = options.risquePourcent ?? 1.0;
  const parametresSMC = options.parametresSMC ?? {};
  const tfHTF = options.modeFractal?.timeframeHTF || '4h';
  const tfLTF = options.modeFractal?.timeframeLTF || '15m';
  const filtreZoneOB = options.modeFractal?.filtreZoneOB || 'TOUTE_LA_PLAGE';

  const sourceM1 = options.donneesM1 && options.donneesM1.length > 30 ? options.donneesM1 : bougiesDefaut;
  const bougiesHTF =
    options.modeFractal?.bougiesHTF && options.modeFractal.bougiesHTF.length > 15
      ? options.modeFractal.bougiesHTF
      : options.timeframe === tfHTF
        ? bougiesDefaut
        : agregerBougies(sourceM1, tfHTF);

  const bougiesLTF =
    options.modeFractal?.bougiesLTF && options.modeFractal.bougiesLTF.length > 15
      ? options.modeFractal.bougiesLTF
      : options.timeframe === tfLTF
        ? bougiesDefaut
        : agregerBougies(sourceM1, tfLTF);

  if (!bougiesHTF || bougiesHTF.length < 15 || !bougiesLTF || bougiesLTF.length < 15) {
    return {
      botId: 'bot-orchestrateur-smc-fractal',
      botNom: `Chef d'Orchestre SMC Fractal (${tfHTF.toUpperCase()} ➔ ${tfLTF.toUpperCase()})`,
      periode: {
        debut: new Date().toISOString(),
        fin: new Date().toISOString(),
        totalBougies: 0,
      },
      capitalInitial,
      capitalFinal: capitalInitial,
      pnlNetMontant: 0,
      pnlNetPourcentage: 0,
      totalTrades: 0,
      tradesGagnants: 0,
      tradesPerdants: 0,
      tradesBreakeven: 0,
      winratePourcentage: 0,
      profitFactor: 0,
      maxDrawdownPourcentage: 0,
      ratioRRMoyen: 0,
      courbeEquity: [{ date: new Date().toISOString(), capital: capitalInitial }],
      trades: [],
    };
  }

  // 1️⃣ Détection des Setups Maîtres en HTF (AVEC calcul complet du taux de chevauchement UOP sur 10 vagues)
  // Crucial pour la performance : donneesM1: undefined + timeframeSource: 'ACTUEL' force Shved à analyser
  // uniquement les ~1 500 bougies HTF (H4) au lieu de 25 000+ bougies LTF (M15).
  const resultatHTF = calculerOrchestrateurSMC(bougiesHTF, {
    ...parametresSMC,
    masquerSetupsTermines: false,
    activerCalqueFractalHTF: false,
    donneesM1: undefined,
    timeframeSource: 'ACTUEL',
    chartTimeframe: tfHTF,
  });

  const setupsHTFValides = (resultatHTF.setups || []).filter(
    (s) => s.statut === 'CONFIRME' && s.prixTP !== undefined && s.prixSL !== undefined
  );
  if (outSetupsHTFValides) {
    outSetupsHTFValides.push(...setupsHTFValides);
  }

  // 2️⃣ Détection des Dojis candidats en LTF (pour chercher le Second Setup à l'intérieur des plages HTF)
  const nbBougiesConfLTF = Math.max(1, Number(parametresSMC.nbBougiesConfirmation ?? 3));
  const bornerRangeLTF = parametresSMC.bornerRangeConfirmationParAmplitudeDoji !== false;
  const multBorneLTF = Math.max(0.1, Number(parametresSMC.multiplicateurAmplitudeBorneRange ?? 1.0));
  const dojisLTF = detecterDojisAvecPlage(bougiesLTF, parametresSMC);

  // Pré-validation du Range de 3 bougies sur chaque Doji LTF (SANS filtre de taux de chevauchement UOP !)
  interface SecondSetupLTFValide {
    type: 'ACHAT' | 'VENTE';
    indexDojiLTF: number;
    indexConfirmationLTF: number;
    tempsDojiMs: number;
    tempsConfirmationMs: number;
    tempsConfirmationRaw: number | string;
    prixEntreeLTF: number;
    prixSLLTF: number;
    distanceSLLTF: number;
  }

  const secondsSetupsLTF: SecondSetupLTFValide[] = [];

  for (const dLTF of dojisLTF) {
    const estAchatLTF = dLTF.type === 'ACHAT';
    const idxDoji = dLTF.indexBougie;
    const idxConf = idxDoji + nbBougiesConfLTF;
    if (idxConf >= bougiesLTF.length) continue;

    const b1 = bougiesLTF[Math.max(0, idxDoji - 1)];
    const b2 = bougiesLTF[idxDoji];
    if (!b1 || !b2) continue;

    const ampDojiLTF = Math.max(b1.high - b1.low, b2.high - b2.low);
    const prixEntree = dLTF.close2;
    const prixSL = dLTF.prixExtreme;
    const borneRange = estAchatLTF
      ? prixEntree + ampDojiLTF * multBorneLTF
      : prixEntree - ampDojiLTF * multBorneLTF;

    // Vérifier que chacune des 3 bougies LTF respecte [prixSL ➔ borneRange]
    let rangeValide = true;
    for (let k = idxDoji + 1; k <= idxConf; k++) {
      const bk = bougiesLTF[k];
      if (estAchatLTF) {
        if (bk.low <= prixSL || (bornerRangeLTF && bk.close > borneRange)) {
          rangeValide = false;
          break;
        }
      } else {
        if (bk.high >= prixSL || (bornerRangeLTF && bk.close < borneRange)) {
          rangeValide = false;
          break;
        }
      }
    }
    if (!rangeValide) continue;

    // Prix d'entrée réel à la clôture de la 3ème bougie de confirmation LTF (comme dans MT5 !)
    const prixEntreeConfirmationLTF = bougiesLTF[idxConf]?.close ?? prixEntree;
    if (estAchatLTF && prixEntreeConfirmationLTF <= prixSL) continue;
    if (!estAchatLTF && prixEntreeConfirmationLTF >= prixSL) continue;

    secondsSetupsLTF.push({
      type: dLTF.type,
      indexDojiLTF: idxDoji,
      indexConfirmationLTF: idxConf,
      tempsDojiMs: convertirTempsEnMs(dLTF.temps),
      tempsConfirmationMs: convertirTempsEnMs(bougiesLTF[idxConf].time),
      tempsConfirmationRaw: bougiesLTF[idxConf].time,
      prixEntreeLTF: prixEntreeConfirmationLTF,
      prixSLLTF: prixSL,
      distanceSLLTF: Math.max(0.0001, Math.abs(prixEntreeConfirmationLTF - prixSL)),
    });
  }

  // 3️⃣ Appariement Fractal : Recherche des Seconds Setups LTF à l'intérieur de la plage protégée de chaque Setup HTF
  const trades: TradeBotSimule[] = [];
  let capitalActuel = capitalInitial;
  let capitalPicMax = capitalInitial;
  let maxDrawdownMontant = 0;

  let totalGainsMontant = 0;
  let totalPertesMontant = 0;
  let sommeRRGagnants = 0;
  let totalTradesGagnants = 0;
  let totalTradesPerdants = 0;
  let totalTradesBreakeven = 0;

  const courbeEquity: Array<{ date: string; capital: number }> = [
    {
      date: String(bougiesLTF[0]?.time || new Date().toISOString()),
      capital: capitalInitial,
    },
  ];

  const indicesLTFDejaUtilises = new Set<number>();
  let dernierIndexSortieLTFGlobal = -1;

  for (const setupHTF of setupsHTFValides) {
    if (setupHTF.prixTP === undefined) continue;
    const estAchat = setupHTF.type === 'ACHAT';
    const prixSL_HTF = setupHTF.prixSL;
    const prixTP_HTF = setupHTF.prixTP;
    const borneRange_HTF =
      setupHTF.borneRangeConfirmation ??
      (estAchat
        ? setupHTF.prixEntree + setupHTF.distanceSL * 1.5
        : setupHTF.prixEntree - setupHTF.distanceSL * 1.5);

    const minPlageProtegee = Math.min(prixSL_HTF, borneRange_HTF);
    const maxPlageProtegee = Math.max(prixSL_HTF, borneRange_HTF);

    // 🔒 ZÉRO BIAIS DU FUTUR : Le Setup Maître HTF n'est confirmé qu'à partir de sa 3ème bougie HTF de confirmation !
    // On n'autorise aucune prise de position LTF avant que le Setup HTF ne soit réellement confirmé.
    const tempsDebutHTFMs = convertirTempsEnMs(setupHTF.tempsConfirmation ?? setupHTF.tempsDoji);
    const obsProteges: OrderBlockClassiqueSMC[] = setupHTF.orderBlocksProteges || [];

    // Déterminer jusqu'à quel moment le Setup HTF reste en vie (ni TP_HTF ni SL_HTF touché après le Doji HTF)
    let tempsFinVieHTFMs = Infinity;
    const tempsDojiHTFMs = convertirTempsEnMs(setupHTF.tempsDoji);
    for (let k = 0; k < bougiesLTF.length; k++) {
      const bL = bougiesLTF[k];
      const tMs = convertirTempsEnMs(bL.time);
      if (tMs <= tempsDojiHTFMs) continue;

      const tpHTFTouche = estAchat ? bL.high >= prixTP_HTF : bL.low <= prixTP_HTF;
      const slHTFCasse = estAchat ? bL.low < prixSL_HTF : bL.high > prixSL_HTF;
      if (tpHTFTouche || slHTFCasse) {
        tempsFinVieHTFMs = tMs;
        break;
      }
    }

    // Si le Grand TP HTF ou le SL HTF a déjà été touché avant même la fin de la confirmation HTF, ce setup HTF est déjà terminé
    if (tempsFinVieHTFMs <= tempsDebutHTFMs) {
      continue;
    }

    let nbTradesPrisSurCeSetupHTF = 0;

    // Chercher les Seconds Setups LTF qui se forment à l'intérieur de cette plage protégée HTF
    for (const sLTF of secondsSetupsLTF) {
      if (sLTF.type !== setupHTF.type) continue;
      if (indicesLTFDejaUtilises.has(sLTF.indexDojiLTF)) continue;
      // 1 seule position ouverte à la fois (comme dans MT5) et max 2 tentatives par Setup HTF
      if (sLTF.indexConfirmationLTF <= dernierIndexSortieLTFGlobal) continue;
      if (nbTradesPrisSurCeSetupHTF >= 2) break;
      if (sLTF.tempsConfirmationMs < tempsDebutHTFMs || sLTF.tempsConfirmationMs >= tempsFinVieHTFMs) {
        continue;
      }

      // A. Vérifier que le Second Setup LTF se situe bien à l'intérieur de la plage de prix du Setup HTF
      const dansPlagePrixHTF =
        (sLTF.prixSLLTF >= minPlageProtegee && sLTF.prixSLLTF <= maxPlageProtegee) ||
        (sLTF.prixEntreeLTF >= minPlageProtegee && sLTF.prixEntreeLTF <= maxPlageProtegee);
      if (!dansPlagePrixHTF) continue;

      // B. Vérifier que l'entrée LTF laisse encore un potentiel positif vers le Grand TP_HTF
      if (estAchat && sLTF.prixEntreeLTF >= prixTP_HTF) continue;
      if (!estAchat && sLTF.prixEntreeLTF <= prixTP_HTF) continue;

      // C. Vérification optionnelle du contact avec un Rectangle d'Order Block Classique SMC Protégé
      let obTouche: OrderBlockClassiqueSMC | undefined = obsProteges.find(
        (ob) =>
          (sLTF.prixSLLTF >= ob.prixBas && sLTF.prixSLLTF <= ob.prixHaut) ||
          (sLTF.prixEntreeLTF >= ob.prixBas && sLTF.prixEntreeLTF <= ob.prixHaut) ||
          (estAchat
            ? sLTF.prixSLLTF <= ob.prixHaut && sLTF.prixEntreeLTF >= ob.prixBas
            : sLTF.prixSLLTF >= ob.prixBas && sLTF.prixEntreeLTF <= ob.prixHaut)
      );

      if (filtreZoneOB === 'TOUT_OB_PROTEGE' && !obTouche) {
        continue;
      }
      if (filtreZoneOB === 'DERNIER_OB_UNIQUEMENT' && (!obTouche || !obTouche.estDernierOB)) {
        continue;
      }

      indicesLTFDejaUtilises.add(sLTF.indexDojiLTF);

      // 4️⃣ Constitution de la Nouvelle Position Fractale : Petit SL (LTF) ➔ Grand TP (HTF) !
      const prixEntree = sLTF.prixEntreeLTF;
      const petitSL = sLTF.prixSLLTF;
      const grandTP = prixTP_HTF;
      const distancePetitSL = Math.max(0.0001, Math.abs(prixEntree - petitSL));
      const distanceGrandTP = Math.max(0.0001, Math.abs(grandTP - prixEntree));
      const ratioRR = Number((distanceGrandTP / distancePetitSL).toFixed(2));

      // Suivi bougie par bougie en LTF à partir de la confirmation du Second Setup LTF
      let resultat: 'win' | 'loss' | 'breakeven' = 'breakeven';
      let prixSortie = prixEntree;
      let indexSortie = sLTF.indexConfirmationLTF;
      let dateSortie = sLTF.tempsConfirmationRaw;

      for (let m = sLTF.indexConfirmationLTF + 1; m < bougiesLTF.length; m++) {
        const bm = bougiesLTF[m];
        if (estAchat) {
          const slTouche = bm.low <= petitSL;
          const tpTouche = bm.high >= grandTP;
          if (slTouche || tpTouche) {
            resultat = tpTouche && !slTouche ? 'win' : 'loss';
            prixSortie = resultat === 'win' ? grandTP : petitSL;
            indexSortie = m;
            dateSortie = bm.time;
            break;
          }
        } else {
          const slTouche = bm.high >= petitSL;
          const tpTouche = bm.low <= grandTP;
          if (slTouche || tpTouche) {
            resultat = tpTouche && !slTouche ? 'win' : 'loss';
            prixSortie = resultat === 'win' ? grandTP : petitSL;
            indexSortie = m;
            dateSortie = bm.time;
            break;
          }
        }
      }

      const risqueMontant = (capitalActuel * risquePourcent) / 100;
      let pnlMontant = 0;

      if (resultat === 'win') {
        pnlMontant = Number((risqueMontant * ratioRR).toFixed(2));
        totalTradesGagnants++;
        totalGainsMontant += pnlMontant;
        sommeRRGagnants += ratioRR;
        dernierIndexSortieLTFGlobal = indexSortie;
        nbTradesPrisSurCeSetupHTF++;
      } else if (resultat === 'loss') {
        pnlMontant = -risqueMontant;
        totalTradesPerdants++;
        totalPertesMontant += Math.abs(pnlMontant);
        dernierIndexSortieLTFGlobal = indexSortie;
        nbTradesPrisSurCeSetupHTF++;
      } else {
        totalTradesBreakeven++;
      }

      capitalActuel = Number((capitalActuel + pnlMontant).toFixed(2));
      if (capitalActuel > capitalPicMax) {
        capitalPicMax = capitalActuel;
      } else {
        const dd = capitalPicMax - capitalActuel;
        if (dd > maxDrawdownMontant) maxDrawdownMontant = dd;
      }

      const infoOBTxt = obTouche
        ? obTouche.estDernierOB
          ? `🛡️ Dernier OB #${obTouche.ordreHierarchie}`
          : `📦 OB #${obTouche.ordreHierarchie}`
        : '📦 Plage Protégée HTF';

      trades.push({
        id: `bot-fractal-${setupHTF.indexDoji}-${sLTF.indexDojiLTF}`,
        direction: estAchat ? 'long' : 'short',
        indexEntree: sLTF.indexDojiLTF,
        dateEntree: String(sLTF.tempsConfirmationRaw),
        prixEntree,
        indexSortie,
        dateSortie: String(dateSortie),
        prixSortie,
        stopLoss: petitSL,
        takeProfit: grandTP,
        resultat,
        pnlMontant,
        pnlPourcentage: Number(((pnlMontant / capitalInitial) * 100).toFixed(2)),
        ratioRR,
        dureeBougies: Math.max(1, indexSortie - sLTF.indexConfirmationLTF),
        commentaire: `🔬 Fractal ${tfHTF.toUpperCase()}➔${tfLTF.toUpperCase()} · ${infoOBTxt} · Petit SL ${tfLTF.toUpperCase()} ➔ Grand TP ${tfHTF.toUpperCase()} (${ratioRR}R)`,
      });

      courbeEquity.push({
        date: String(dateSortie),
        capital: capitalActuel,
      });
    }
  }

  const totalTrades = trades.length;
  const tradesTermines = totalTradesGagnants + totalTradesPerdants;
  const winratePourcentage =
    tradesTermines > 0 ? Number(((totalTradesGagnants / tradesTermines) * 100).toFixed(1)) : 0;
  const profitFactor =
    totalPertesMontant > 0
      ? Number((totalGainsMontant / totalPertesMontant).toFixed(2))
      : totalGainsMontant > 0
        ? 99.99
        : 0;
  const maxDrawdownPourcentage =
    capitalInitial > 0 ? Number(((maxDrawdownMontant / capitalInitial) * 100).toFixed(2)) : 0;
  const ratioRRMoyen =
    totalTradesGagnants > 0 ? Number((sommeRRGagnants / totalTradesGagnants).toFixed(2)) : 0;
  const pnlNetMontant = Number((capitalActuel - capitalInitial).toFixed(2));
  const pnlNetPourcentage = Number(((pnlNetMontant / capitalInitial) * 100).toFixed(2));

  return {
    botId: 'bot-orchestrateur-smc-fractal',
    botNom: `Chef d'Orchestre SMC Fractal (${tfHTF.toUpperCase()} ➔ ${tfLTF.toUpperCase()})`,
    periode: {
      debut: String(bougiesLTF[0]?.time || ''),
      fin: String(bougiesLTF[bougiesLTF.length - 1]?.time || ''),
      totalBougies: bougiesLTF.length,
    },
    capitalInitial,
    capitalFinal: capitalActuel,
    pnlNetMontant,
    pnlNetPourcentage,
    totalTrades,
    tradesGagnants: totalTradesGagnants,
    tradesPerdants: totalTradesPerdants,
    tradesBreakeven: totalTradesBreakeven,
    winratePourcentage,
    profitFactor,
    maxDrawdownPourcentage,
    ratioRRMoyen,
    courbeEquity,
    trades,
  };
}

/**
 * 🎬 Événement d'un Setup Maître HTF pour le Testeur de Stratégie Visuel (Style MT5)
 */
export interface EvenementSetupMaitreHTFVisuel {
  id: string;
  type: 'ACHAT' | 'VENTE';
  indexDojiHTF: number;
  tempsDojiMs: number;
  tempsConfirmationMs: number;
  tempsFinVieMs: number;
  prixEntreeHTF: number;
  prixSL_HTF: number;
  prixTP_HTF: number;
  bornePlageHTF: number;
  profondeurZigZag: number;
  nbOrderBlocksProteges: number;
}

/**
 * 🎬 Génère la chronologie complète (Setups Maîtres HTF + Trades LTF horodatés en ms)
 * pour piloter le Mode Testeur Visuel du Bot Fractal (Style Strategy Tester MT5).
 * Permet au trader de faire défiler les bougies à n'importe quelle vitesse, de basculer
 * à la volée entre H4, H1, M30, M15 et M5, et de sauter en 1 clic au prochain Setup H4 ou au prochain Trade LTF.
 *
 * Exemple :
 * const timeline = calculerTimelineVisuelleBotSMC(bougies, options);
 */
export function calculerTimelineVisuelleBotSMC(
  bougiesDefaut: Bougie[],
  options: {
    parametresSMC?: ParametresOrchestrateurSMC;
    capitalInitial?: number;
    risquePourcent?: number;
    paire?: string;
    timeframe?: string;
    donneesM1?: Bougie[];
    modeFractal?: OptionsModeFractalHTFVersLTF;
  } = {}
): {
  rapport: RapportPerformance;
  setupsMaitresHTF: EvenementSetupMaitreHTFVisuel[];
} {
  const tfHTF = options.modeFractal?.timeframeHTF || '4h';
  const sourceM1 =
    options.donneesM1 && options.donneesM1.length > 30 ? options.donneesM1 : bougiesDefaut;
  const bougiesHTF =
    options.modeFractal?.bougiesHTF && options.modeFractal.bougiesHTF.length > 15
      ? options.modeFractal.bougiesHTF
      : options.timeframe === tfHTF
        ? bougiesDefaut
        : agregerBougies(sourceM1, tfHTF);

  const setupsHTFCaptures: SetupOrchestreSMC[] = [];
  const optionsAvecHTF = {
    ...options,
    modeFractal: options.modeFractal
      ? {
          ...options.modeFractal,
          bougiesHTF,
        }
      : undefined,
  };

  // En mode Fractal, on réutilise directement les setups HTF calculés pendant la simulation (0 double calcul !)
  const rapport = optionsAvecHTF.modeFractal?.actif
    ? executerSimulationFractaleHTFVersLTF(bougiesDefaut, optionsAvecHTF, setupsHTFCaptures)
    : executerSimulationOrchestrateurSMC(bougiesDefaut, optionsAvecHTF);

  if (!optionsAvecHTF.modeFractal?.actif && bougiesHTF && bougiesHTF.length >= 15) {
    const resHTF = calculerOrchestrateurSMC(bougiesHTF, {
      ...(options.parametresSMC || {}),
      masquerSetupsTermines: false,
      activerCalqueFractalHTF: false,
      donneesM1: undefined,
      timeframeSource: 'ACTUEL',
      chartTimeframe: tfHTF,
    });
    for (const s of resHTF.setups || []) {
      if (s.statut === 'CONFIRME' && s.prixTP !== undefined) {
        setupsHTFCaptures.push(s);
      }
    }
  }

  const setupsMaitresHTF: EvenementSetupMaitreHTFVisuel[] = [];
  for (const s of setupsHTFCaptures) {
    if (s.statut !== 'CONFIRME' || s.prixTP === undefined) continue;
    const estAchat = s.type === 'ACHAT';
    const borne =
      s.borneRangeConfirmation ??
      (estAchat ? s.prixEntree + s.distanceSL * 1.5 : s.prixEntree - s.distanceSL * 1.5);
    const tDojiMs = convertirTempsEnMs(s.tempsDoji);
    const tConfMs = convertirTempsEnMs(s.tempsConfirmation ?? s.tempsDoji);
    const tFinMs = s.tempsSortieTrade ? convertirTempsEnMs(s.tempsSortieTrade) : Infinity;

    setupsMaitresHTF.push({
      id: s.id,
      type: s.type,
      indexDojiHTF: s.indexDoji,
      tempsDojiMs: tDojiMs,
      tempsConfirmationMs: tConfMs,
      tempsFinVieMs: tFinMs,
      prixEntreeHTF: s.prixEntree,
      prixSL_HTF: s.prixSL,
      prixTP_HTF: s.prixTP,
      bornePlageHTF: borne,
      profondeurZigZag:
        s.profondeurZigZagOriginale ??
        s.detailsScoreLiquidationZigZag?.zigzagDepthRetenu ??
        4,
      nbOrderBlocksProteges: (s.orderBlocksProteges || []).length,
    });
  }

  return { rapport, setupsMaitresHTF };
}
