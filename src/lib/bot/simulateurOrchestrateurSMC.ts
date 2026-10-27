import type { Bougie } from '@/lib/chartDataHelper';
import type { RapportPerformance, TradeBotSimule } from '@/types/bot';
import {
  calculerOrchestrateurSMC,
  type ParametresOrchestrateurSMC,
  type SetupOrchestreSMC,
} from '@/lib/indicators/favoris/orchestrateurSMC';

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
  } = {}
): RapportPerformance {
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
  const resultatSMC = calculerOrchestrateurSMC(bougies, {
    ...parametresSMC,
    masquerSetupsTermines: false, // On conserve tous les setups pour le journal
    donneesM1: options.donneesM1 || bougies,
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

  // 3️⃣ Parcours et simulation monétaire de chaque trade
  for (let i = 0; i < setupsConfirmes.length; i++) {
    const s = setupsConfirmes[i];
    const estAchat = s.type === 'ACHAT';
    const direction = estAchat ? 'long' : 'short';

    // Montant risqué sur ce trade ($)
    const risqueMontant = (capitalActuel * risquePourcent) / 100;
    const distanceSL = Math.max(0.0001, s.distanceSL);
    const distanceTP = Math.max(0.0001, s.distanceTP ?? distanceSL * 1.5);
    const ratioRR = s.ratioRR ?? Number((distanceTP / distanceSL).toFixed(2));

    // Détermination de l'issue du trade
    let resultat: 'win' | 'loss' | 'breakeven' = 'loss';
    let prixSortie = s.prixSL;
    let indexSortie = s.indexSortieTrade ?? s.indexDoji + 3;
    let dateSortie = s.tempsSortieTrade ?? s.tempsDoji;
    let pnlMontant = -risqueMontant;

    if (s.resultatTrade === 'TP_TOUCHE') {
      resultat = 'win';
      prixSortie = s.prixTP ?? s.prixEntree;
      pnlMontant = Number((risqueMontant * ratioRR).toFixed(2));
      totalTradesGagnants++;
      totalGainsMontant += pnlMontant;
      sommeRRGagnants += ratioRR;
    } else if (s.resultatTrade === 'SL_TOUCHE') {
      resultat = 'loss';
      prixSortie = s.prixSL;
      pnlMontant = -risqueMontant;
      totalTradesPerdants++;
      totalPertesMontant += Math.abs(pnlMontant);
    } else {
      // Trade encore en cours ou neutre
      resultat = 'breakeven';
      prixSortie = s.prixEntree;
      pnlMontant = 0;
      totalTradesBreakeven++;
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
      indexEntree: s.indexDoji,
      dateEntree: String(s.tempsDoji),
      prixEntree: s.prixEntree,
      indexSortie,
      dateSortie: String(dateSortie),
      prixSortie,
      stopLoss: s.prixSL,
      takeProfit: s.prixTP ?? s.prixEntree,
      resultat,
      pnlMontant,
      pnlPourcentage: Number(((pnlMontant / capitalInitial) * 100).toFixed(2)),
      ratioRR,
      dureeBougies: Math.max(1, indexSortie - s.indexDoji),
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
