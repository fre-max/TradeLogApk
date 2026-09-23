import type { Bougie } from '@/lib/chartDataHelper';
import type { TradingBot, BotContext, BotDecision, TradeBotSimule, RapportPerformance } from '@/types/bot';
import { calculerLuxAlgoSMC } from '@/lib/indicators/luxAlgoSMC';
import { calculerProtectedSwings } from '@/lib/indicators/protectedSwings';
import { calculerZigZag } from '@/lib/indicators/zigzag';
import { calculerUnmitigatedVolumeProfile } from '@/lib/indicators/unmitigatedVolumeProfile';
import {
  recupererIndicateursStockes,
  evaluerIndicateurScript,
  genererDefinitionsVariablesAutomatiques,
} from '@/lib/indicators/indicatorEngine';

// Clé de stockage local pour persister les bots sur le téléphone sans recompiler
const CLE_STORAGE_BOTS = 'tradelog_bots_extensions_v1';
const CLE_STORAGE_VERSION_BOTS = 'tradelog_bots_catalogue_version';
const VERSION_CATALOGUE_BOTS = '2.1.0';

/**
 * 3 bots modèles pré-configurés pour démarrer immédiatement
 */
export const BOTS_PAR_DEFAUT: TradingBot[] = [
  {
    id: 'bot-smc-choch-v1',
    nom: 'SMC CHoCH Retest Bot',
    description: 'Prend position lors du retest d\'un Order Block après la confirmation d\'un CHoCH (Change of Character).',
    auteur: 'TradeLog SMC',
    version: '1.0.0',
    actif: true,
    parametres: {
      ratioRR: 2.5,
      risquePourcent: 1.0,
      tailleFenetreSMC: 150,
    },
    definitionsVariables: [
      {
        cle: 'ratioRR',
        label: 'Ratio Risque / Rendement (R:R)',
        description: 'Multiplicateur du Take Profit par rapport à la distance du Stop Loss',
        type: 'number',
        valeurParDefaut: 2.5,
        min: 0.5,
        max: 10,
        step: 0.1,
        groupe: 'Gestion du Risque',
      },
      {
        cle: 'risquePourcent',
        label: 'Risque par Trade (% Capital)',
        description: 'Pourcentage du capital engagé sur la position',
        type: 'number',
        valeurParDefaut: 1.0,
        min: 0.1,
        max: 5.0,
        step: 0.1,
        groupe: 'Gestion du Risque',
      },
      {
        cle: 'tailleFenetreSMC',
        label: 'Fenêtre de Calcul SMC (Bougies)',
        description: 'Nombre de bougies récentes analysées pour identifier les Order Blocks',
        type: 'number',
        valeurParDefaut: 150,
        min: 50,
        max: 500,
        step: 10,
        groupe: 'Filtres de Stratégie',
      },
    ],
    creeLe: '2026-09-23T00:00:00.000Z',
    misAJourLe: '2026-09-23T00:00:00.000Z',
    code: `/**
 * Bot SMC CHoCH Retest
 * Se déclenche après un CHoCH validé quand le prix touche un Order Block frais.
 */
return {
  onBar: function(contexte) {
    const { bougie, indicateurs, positionActive, parametres } = contexte;

    // 1️⃣ Si nous avons déjà un trade en cours, on ne fait rien
    if (positionActive) return null;

    const smc = indicateurs.smc;
    if (!smc) return null;

    const ratioRR = Number(parametres.ratioRR || 2.5);

    // 2️⃣ Vérification d'un signal CHoCH haussier récent
    const dernierChoch = smc.chochs && smc.chochs.length > 0 ? smc.chochs[smc.chochs.length - 1] : null;
    const estChochHaussier = dernierChoch && dernierChoch.type === 'BULLISH';
    const estChochBaissier = dernierChoch && dernierChoch.type === 'BEARISH';

    // 3️⃣ Signal d'achat : CHoCH haussier + prix dans la zone de l'Order Block haussier
    if (estChochHaussier && smc.orderBlocks && smc.orderBlocks.length > 0) {
      const dernierOB = smc.orderBlocks.filter(ob => ob.type === 'BULLISH' && !ob.mitigated).pop();
      if (dernierOB && bougie.low <= dernierOB.high && bougie.close >= dernierOB.low) {
        const sl = dernierOB.low - (bougie.close - dernierOB.low) * 0.1;
        const distanceSl = Math.abs(bougie.close - sl);
        const tp = bougie.close + (distanceSl * ratioRR);

        return {
          action: 'BUY',
          prixEntree: bougie.close,
          stopLoss: sl,
          takeProfit: tp,
          commentaire: 'Achat sur retest OB après CHoCH haussier'
        };
      }
    }

    // 4️⃣ Signal de vente : CHoCH baissier + prix dans l'Order Block baissier
    if (estChochBaissier && smc.orderBlocks && smc.orderBlocks.length > 0) {
      const dernierOB = smc.orderBlocks.filter(ob => ob.type === 'BEARISH' && !ob.mitigated).pop();
      if (dernierOB && bougie.high >= dernierOB.low && bougie.close <= dernierOB.high) {
        const sl = dernierOB.high + (dernierOB.high - bougie.close) * 0.1;
        const distanceSl = Math.abs(sl - bougie.close);
        const tp = bougie.close - (distanceSl * ratioRR);

        return {
          action: 'SELL',
          prixEntree: bougie.close,
          stopLoss: sl,
          takeProfit: tp,
          commentaire: 'Vente sur retest OB après CHoCH baissier'
        };
      }
    }

    return null;
  }
};`
  },
  {
    id: 'bot-swings-breakout-v1',
    nom: 'Protected Swings Breakout Bot',
    description: 'Prend position lors de la cassure confirmée d\'un Swing High ou Swing Low protégé avec ratio R:R fixe.',
    auteur: 'LuxAlgo Swings',
    version: '1.0.0',
    actif: false,
    parametres: {
      ratioRR: 2.0,
      risquePourcent: 1.0,
    },
    definitionsVariables: [
      {
        cle: 'ratioRR',
        label: 'Ratio Risque / Rendement (R:R)',
        description: 'Multiplicateur de l\'objectif TP par rapport au Stop Loss',
        type: 'number',
        valeurParDefaut: 2.0,
        min: 0.5,
        max: 10,
        step: 0.1,
        groupe: 'Gestion du Risque',
      },
      {
        cle: 'risquePourcent',
        label: 'Risque par Position (% Capital)',
        description: 'Pourcentage maximum de perte autorisée par trade',
        type: 'number',
        valeurParDefaut: 1.0,
        min: 0.1,
        max: 5.0,
        step: 0.1,
        groupe: 'Gestion du Risque',
      },
    ],
    creeLe: '2026-09-23T00:00:00.000Z',
    misAJourLe: '2026-09-23T00:00:00.000Z',
    code: `/**
 * Bot de cassure sur Protected Swings
 */
return {
  onBar: function(contexte) {
    const { bougie, historique, indicateurs, positionActive, parametres } = contexte;
    if (positionActive) return null;

    const swings = indicateurs.swings;
    if (!swings) return null;

    const ratioRR = Number(parametres.ratioRR || 2.0);
    const bougiePrecedente = historique.length >= 2 ? historique[historique.length - 2] : null;
    if (!bougiePrecedente) return null;

    // Cassure haussière d'un Swing High protégé
    if (swings.swingsHigh && swings.swingsHigh.length > 0) {
      const dernierHigh = swings.swingsHigh[swings.swingsHigh.length - 1];
      if (bougiePrecedente.close < dernierHigh.prix && bougie.close > dernierHigh.prix) {
        const sl = bougie.low - (bougie.close - bougie.low) * 0.5;
        const distance = bougie.close - sl;
        return {
          action: 'BUY',
          prixEntree: bougie.close,
          stopLoss: sl,
          takeProfit: bougie.close + (distance * ratioRR),
          commentaire: 'Cassure Swing High Protégé'
        };
      }
    }

    // Cassure baissière d'un Swing Low protégé
    if (swings.swingsLow && swings.swingsLow.length > 0) {
      const dernierLow = swings.swingsLow[swings.swingsLow.length - 1];
      if (bougiePrecedente.close > dernierLow.prix && bougie.close < dernierLow.prix) {
        const sl = bougie.high + (bougie.high - bougie.close) * 0.5;
        const distance = sl - bougie.close;
        return {
          action: 'SELL',
          prixEntree: bougie.close,
          stopLoss: sl,
          takeProfit: bougie.close - (distance * ratioRR),
          commentaire: 'Cassure Swing Low Protégé'
        };
      }
    }

    return null;
  }
};`
  },
  {
    id: 'bot-zigzag-reversal-v1',
    nom: 'ZigZag Pivot Reversal Bot',
    description: 'Stratégie de retournement basée sur les extrêmes validés du ZigZag.',
    auteur: 'TradeLog Quant',
    version: '1.0.0',
    actif: false,
    parametres: {
      ratioRR: 2.0,
      risquePourcent: 1.0,
    },
    definitionsVariables: [
      {
        cle: 'ratioRR',
        label: 'Ratio Risque / Rendement (R:R)',
        description: 'Multiplicateur de l\'objectif TP sur retournement',
        type: 'number',
        valeurParDefaut: 2.0,
        min: 0.5,
        max: 10,
        step: 0.1,
        groupe: 'Gestion du Risque',
      },
      {
        cle: 'risquePourcent',
        label: 'Risque par Position (% Capital)',
        description: 'Pourcentage maximum de perte autorisée par trade',
        type: 'number',
        valeurParDefaut: 1.0,
        min: 0.1,
        max: 5.0,
        step: 0.1,
        groupe: 'Gestion du Risque',
      },
    ],
    creeLe: '2026-09-23T00:00:00.000Z',
    misAJourLe: '2026-09-23T00:00:00.000Z',
    code: `/**
 * Bot de rebond sur pivot ZigZag
 */
return {
  onBar: function(contexte) {
    const { bougie, historique, indicateurs, positionActive, parametres } = contexte;
    if (positionActive) return null;

    const zigzag = indicateurs.zigzag;
    if (!zigzag || !zigzag.pivots || zigzag.pivots.length < 2) return null;

    const dernierPivot = zigzag.pivots[zigzag.pivots.length - 1];
    const ratioRR = Number(parametres.ratioRR || 2.0);

    // Rebond sur un Creux (Pivot Low)
    if (dernierPivot.type === 'low' && bougie.close > bougie.open && bougie.low >= dernierPivot.prix) {
      const sl = dernierPivot.prix * 0.999;
      const distance = bougie.close - sl;
      return {
        action: 'BUY',
        prixEntree: bougie.close,
        stopLoss: sl,
        takeProfit: bougie.close + (distance * ratioRR),
        commentaire: 'Rebond haussier sur creux ZigZag'
      };
    }

    // Rebond sur un Sommet (Pivot High)
    if (dernierPivot.type === 'high' && bougie.close < bougie.open && bougie.high <= dernierPivot.prix) {
      const sl = dernierPivot.prix * 1.001;
      const distance = sl - bougie.close;
      return {
        action: 'SELL',
        prixEntree: bougie.close,
        stopLoss: sl,
        takeProfit: bougie.close - (distance * ratioRR),
        commentaire: 'Rejet baissier sur sommet ZigZag'
      };
    }

    return null;
  }
};`
  }
];

/**
 * Récupère tous les bots stockés localement sur le smartphone.
 * Si aucun bot n'existe encore, initialise les bots modèles par défaut.
 * Assure que chaque bot dispose de définitions de variables externes visuelles.
 * 
 * Exemple :
 * const mesBots = recupererBotsStockes();
 */
export function recupererBotsStockes(): TradingBot[] {
  try {
    const jsonStocke = localStorage.getItem(CLE_STORAGE_BOTS);
    let bots: TradingBot[] = [];

    if (!jsonStocke) {
      localStorage.setItem(CLE_STORAGE_BOTS, JSON.stringify(BOTS_PAR_DEFAUT));
      localStorage.setItem(CLE_STORAGE_VERSION_BOTS, VERSION_CATALOGUE_BOTS);
      bots = BOTS_PAR_DEFAUT;
    } else {
      const parsed = JSON.parse(jsonStocke) as TradingBot[];
      bots = Array.isArray(parsed) && parsed.length > 0 ? parsed : BOTS_PAR_DEFAUT;

      // 🚀 Migration des nouveaux bots officiels sans écraser les suppressions volontaires de l'utilisateur
      const versionStockee = localStorage.getItem(CLE_STORAGE_VERSION_BOTS);
      if (versionStockee !== VERSION_CATALOGUE_BOTS) {
        const idsExistants = new Set(bots.map((b) => b.id));
        let aModifie = false;
        for (const botDefaut of BOTS_PAR_DEFAUT) {
          if (!idsExistants.has(botDefaut.id)) {
            bots.push(botDefaut);
            aModifie = true;
          }
        }
        localStorage.setItem(CLE_STORAGE_VERSION_BOTS, VERSION_CATALOGUE_BOTS);
        if (aModifie) {
          localStorage.setItem(CLE_STORAGE_BOTS, JSON.stringify(bots));
          console.log('🔄 [BotEngine] Nouveaux bots officiels synchronisés dans le stockage local.');
        }
      }
    }

    // Enrichit chaque bot avec ses definitionsVariables si absentes
    return bots.map((b) => {
      if (b.definitionsVariables && b.definitionsVariables.length > 0) {
        return b;
      }
      const officiel = BOTS_PAR_DEFAUT.find((def) => def.id === b.id);
      if (officiel?.definitionsVariables) {
        return { ...b, definitionsVariables: officiel.definitionsVariables };
      }
      return {
        ...b,
        definitionsVariables: genererDefinitionsVariablesAutomatiques(b.parametres || {}),
      };
    });
  } catch (error) {
    console.warn('⚠️ [BotEngine] Impossible de lire les bots depuis localStorage:', error);
    return BOTS_PAR_DEFAUT;
  }
}

/**
 * Sauvegarde ou met à jour un bot dans le stockage local.
 * 
 * Exemple :
 * sauvegarderBotStocke(monBot);
 */
export function sauvegarderBotStocke(bot: TradingBot): void {
  try {
    const bots = recupererBotsStockes();
    const indexExistant = bots.findIndex(b => b.id === bot.id);
    const botAJour = {
      ...bot,
      misAJourLe: new Date().toISOString(),
    };

    if (indexExistant >= 0) {
      bots[indexExistant] = botAJour;
    } else {
      bots.unshift(botAJour);
    }

    localStorage.setItem(CLE_STORAGE_BOTS, JSON.stringify(bots));
    console.log(`✅ [BotEngine] Bot "${bot.nom}" sauvegardé avec succès.`);
  } catch (error) {
    console.error('❌ [BotEngine] Erreur lors de la sauvegarde du bot:', error);
  }
}

/**
 * Supprime un bot du stockage local.
 */
export function supprimerBotStocke(idBot: string): void {
  try {
    const bots = recupererBotsStockes();
    const botsFiltres = bots.filter(b => b.id !== idBot);
    localStorage.setItem(CLE_STORAGE_BOTS, JSON.stringify(botsFiltres));
    console.log(`🗑️ [BotEngine] Bot "${idBot}" supprimé.`);
  } catch (error) {
    console.error('❌ [BotEngine] Erreur lors de la suppression du bot:', error);
  }
}

/**
 * Évalue le script JavaScript d'un bot dans un bac à sable (sandbox) isolé.
 * Capture toute erreur de code sans jamais faire crasher l'application.
 * 
 * Exemple :
 * const decision = evaluerBotScript(bot.code, contexte);
 */
export function evaluerBotScript(codeScript: string, contexte: BotContext): BotDecision | null {
  try {
    // 1️⃣ Création d'une fonction dynamique sécurisée
    // Le script de l'utilisateur a accès uniquement au paramètre `contexte`
    const constructeurFn = new Function('contexte', codeScript);
    const instance = constructeurFn(contexte);

    // 2️⃣ Si le script retourne un objet avec une méthode onBar()
    if (instance && typeof instance.onBar === 'function') {
      const decision = instance.onBar(contexte);
      return validerDecision(decision);
    }

    // 3️⃣ Si le script retourne directement la décision
    if (instance && typeof instance === 'object' && instance.action) {
      return validerDecision(instance);
    }

    return null;
  } catch (erreur: any) {
    // Affiche l'erreur dans la console sans bloquer l'interface
    console.warn(`⚠️ [BotEngine] Erreur d'exécution du bot à la bougie #${contexte.index}:`, erreur.message);
    return null;
  }
}

/**
 * Valide et sécurise l'objet décision retourné par le script du bot.
 */
function validerDecision(decision: any): BotDecision | null {
  if (!decision || typeof decision !== 'object') return null;
  if (decision.action !== 'BUY' && decision.action !== 'SELL' && decision.action !== 'CLOSE') {
    return null;
  }
  return {
    action: decision.action,
    prixEntree: typeof decision.prixEntree === 'number' ? decision.prixEntree : undefined,
    stopLoss: typeof decision.stopLoss === 'number' ? decision.stopLoss : undefined,
    takeProfit: typeof decision.takeProfit === 'number' ? decision.takeProfit : undefined,
    commentaire: typeof decision.commentaire === 'string' ? decision.commentaire : undefined,
  };
}

/**
 * Exécute une simulation ultra-rapide (Mode Éclair) en mémoire sur tout l'historique de bougies.
 * Parcourt 10 000 bougies en ~200 millisecondes et génère un rapport de performance complet.
 * 
 * Exemple :
 * const rapport = executerSimulationBatch(monBot, bougiesChargees, { capitalInitial: 10000 });
 */
export function executerSimulationBatch(
  bot: TradingBot,
  bougies: Bougie[],
  options: {
    capitalInitial?: number;
    risquePourcent?: number;
  } = {}
): RapportPerformance {
  const capitalInitial = options.capitalInitial || 10000;
  const risqueParDefaut = options.risquePourcent || Number(bot.parametres.risquePourcent || 1.0);

  let capitalCourant = capitalInitial;
  let capitalMax = capitalInitial;
  let maxDrawdownPourcent = 0;

  const tradesClotures: TradeBotSimule[] = [];
  const courbeEquity: Array<{ date: string; capital: number }> = [
    {
      date: bougies.length > 0 ? String(bougies[0].time) : 'Début',
      capital: capitalInitial,
    }
  ];

  // État de la position active courante dans la boucle de simulation
  let positionActive: {
    id: string;
    direction: 'long' | 'short';
    indexEntree: number;
    dateEntree: string;
    prixEntree: number;
    stopLoss: number;
    takeProfit: number;
    commentaire?: string;
    risqueMontant: number;
  } | null = null;

  // On commence après 50 bougies pour que les indicateurs aient un historique suffisant
  const indexDebut = Math.min(50, Math.floor(bougies.length / 2));
  const scriptsStockes = recupererIndicateursStockes();

  for (let i = indexDebut; i < bougies.length; i++) {
    const bougie = bougies[i];

    // 1️⃣ Gestion de la position active si elle existe (Vérification SL / TP)
    if (positionActive) {
      let sortieTouchee = false;
      let prixSortie = 0;
      let resultat: 'win' | 'loss' | 'breakeven' = 'breakeven';
      let pnlMontant = 0;

      if (positionActive.direction === 'long') {
        // En Long : Stop Loss touché par le bas ou Take Profit touché par le haut
        if (bougie.low <= positionActive.stopLoss) {
          sortieTouchee = true;
          prixSortie = positionActive.stopLoss;
          resultat = 'loss';
          pnlMontant = -positionActive.risqueMontant;
        } else if (bougie.high >= positionActive.takeProfit) {
          sortieTouchee = true;
          prixSortie = positionActive.takeProfit;
          resultat = 'win';
          const distanceSl = Math.abs(positionActive.prixEntree - positionActive.stopLoss);
          const distanceTp = Math.abs(positionActive.takeProfit - positionActive.prixEntree);
          const ratioRR = distanceSl > 0 ? distanceTp / distanceSl : 1;
          pnlMontant = positionActive.risqueMontant * ratioRR;
        }
      } else {
        // En Short : Stop Loss touché par le haut ou Take Profit touché par le bas
        if (bougie.high >= positionActive.stopLoss) {
          sortieTouchee = true;
          prixSortie = positionActive.stopLoss;
          resultat = 'loss';
          pnlMontant = -positionActive.risqueMontant;
        } else if (bougie.low <= positionActive.takeProfit) {
          sortieTouchee = true;
          prixSortie = positionActive.takeProfit;
          resultat = 'win';
          const distanceSl = Math.abs(positionActive.stopLoss - positionActive.prixEntree);
          const distanceTp = Math.abs(positionActive.prixEntree - positionActive.takeProfit);
          const ratioRR = distanceSl > 0 ? distanceTp / distanceSl : 1;
          pnlMontant = positionActive.risqueMontant * ratioRR;
        }
      }

      // Si le trade est clôturé sur cette bougie
      if (sortieTouchee) {
        capitalCourant += pnlMontant;
        if (capitalCourant > capitalMax) capitalMax = capitalCourant;

        const drawdownActuel = ((capitalMax - capitalCourant) / capitalMax) * 100;
        if (drawdownActuel > maxDrawdownPourcent) maxDrawdownPourcent = drawdownActuel;

        const distanceSl = Math.abs(positionActive.prixEntree - positionActive.stopLoss);
        const distanceSortie = Math.abs(prixSortie - positionActive.prixEntree);
        const ratioRRFinal = distanceSl > 0 ? distanceSortie / distanceSl : 1;

        tradesClotures.push({
          id: positionActive.id,
          direction: positionActive.direction,
          indexEntree: positionActive.indexEntree,
          dateEntree: positionActive.dateEntree,
          prixEntree: positionActive.prixEntree,
          indexSortie: i,
          dateSortie: String(bougie.time),
          prixSortie: prixSortie,
          stopLoss: positionActive.stopLoss,
          takeProfit: positionActive.takeProfit,
          resultat: resultat,
          pnlMontant: pnlMontant,
          pnlPourcentage: (pnlMontant / capitalInitial) * 100,
          ratioRR: resultat === 'win' ? ratioRRFinal : -1,
          dureeBougies: i - positionActive.indexEntree,
          commentaire: positionActive.commentaire,
        });

        courbeEquity.push({
          date: String(bougie.time),
          capital: Math.round(capitalCourant * 100) / 100,
        });

        positionActive = null;
      }
    }

    // 2️⃣ Si aucune position n'est active, on calcule les indicateurs et on consulte le bot
    if (!positionActive) {
      // Découpe des 120 dernières bougies pour des calculs optimisés et rapides
      const debutFenetre = Math.max(0, i - 120);
      const historiqueFenetre = bougies.slice(debutFenetre, i + 1);

      // Calcul léger et synchrone des indicateurs sur la fenêtre courante
      const smc = calculerLuxAlgoSMC(historiqueFenetre);
      const swings = calculerProtectedSwings(historiqueFenetre);
      const zigzag = calculerZigZag(historiqueFenetre);
      const uvp = calculerUnmitigatedVolumeProfile(historiqueFenetre);

      // Calcul dynamique des indicateurs en scripts modulaires
      const scriptsDonnees: Record<string, any> = {};
      for (const s of scriptsStockes) {
        if (s.collecteActive) {
          try {
            const resScript = evaluerIndicateurScript(s.code, {
              bougies: historiqueFenetre,
              parametres: s.parametres || {},
            });
            if (resScript) {
              scriptsDonnees[s.id] = resScript.donnees;
            }
          } catch (e) {
            // Ignorer silencieusement
          }
        }
      }

      const contexte: BotContext = {
        bougie: bougie,
        index: i,
        historique: historiqueFenetre,
        indicateurs: {
          smc: smc,
          swings: swings,
          zigzag: zigzag,
          uvp: uvp,
          scripts: scriptsDonnees,
          ...scriptsDonnees,
        },
        positionActive: null,
        compte: {
          capitalInitial: capitalInitial,
          capitalActuel: capitalCourant,
          tradesEffectues: tradesClotures.length,
        },
        parametres: bot.parametres,
      };

      const decision = evaluerBotScript(bot.code, contexte);

      // 3️⃣ Ouverture de position si le bot renvoie BUY ou SELL
      if (decision && (decision.action === 'BUY' || decision.action === 'SELL')) {
        const direction = decision.action === 'BUY' ? 'long' : 'short';
        const prixEntree = decision.prixEntree || bougie.close;

        // Calcul ou repli par défaut pour le SL et TP garantissant des types number
        const slFinal: number = decision.stopLoss !== undefined
          ? decision.stopLoss
          : (direction === 'long' ? prixEntree * 0.995 : prixEntree * 1.005);

        const distanceSl = Math.abs(prixEntree - slFinal);
        const ratioRR = Number(bot.parametres.ratioRR || 2.0);

        const tpFinal: number = decision.takeProfit !== undefined
          ? decision.takeProfit
          : (direction === 'long' ? prixEntree + (distanceSl * ratioRR) : prixEntree - (distanceSl * ratioRR));

        const risqueMontant = (capitalCourant * (risqueParDefaut / 100));

        positionActive = {
          id: `trade-bot-${tradesClotures.length + 1}`,
          direction: direction,
          indexEntree: i,
          dateEntree: String(bougie.time),
          prixEntree: prixEntree,
          stopLoss: slFinal,
          takeProfit: tpFinal,
          commentaire: decision.commentaire,
          risqueMontant: risqueMontant,
        };
      }
    }
  }

  // 4️⃣ Calcul des statistiques consolidées de performance
  const tradesGagnants = tradesClotures.filter(t => t.resultat === 'win').length;
  const tradesPerdants = tradesClotures.filter(t => t.resultat === 'loss').length;
  const tradesBreakeven = tradesClotures.filter(t => t.resultat === 'breakeven').length;
  const totalTrades = tradesClotures.length;

  const winrate = totalTrades > 0 ? (tradesGagnants / totalTrades) * 100 : 0;

  const gainsBruts = tradesClotures
    .filter(t => t.pnlMontant > 0)
    .reduce((somme, t) => somme + t.pnlMontant, 0);

  const pertesBrutes = Math.abs(
    tradesClotures
      .filter(t => t.pnlMontant < 0)
      .reduce((somme, t) => somme + t.pnlMontant, 0)
  );

  const profitFactor = pertesBrutes > 0 ? gainsBruts / pertesBrutes : (gainsBruts > 0 ? 99.9 : 0);

  const pnlNet = capitalCourant - capitalInitial;
  const pnlNetPourcent = (pnlNet / capitalInitial) * 100;

  const ratioRRMoyen = totalTrades > 0
    ? tradesClotures.reduce((somme, t) => somme + Math.max(0, t.ratioRR), 0) / totalTrades
    : 0;

  return {
    botId: bot.id,
    botNom: bot.nom,
    periode: {
      debut: bougies.length > 0 ? String(bougies[0].time) : '',
      fin: bougies.length > 0 ? String(bougies[bougies.length - 1].time) : '',
      totalBougies: bougies.length,
    },
    capitalInitial: capitalInitial,
    capitalFinal: Math.round(capitalCourant * 100) / 100,
    pnlNetMontant: Math.round(pnlNet * 100) / 100,
    pnlNetPourcentage: Math.round(pnlNetPourcent * 100) / 100,
    totalTrades: totalTrades,
    tradesGagnants: tradesGagnants,
    tradesPerdants: tradesPerdants,
    tradesBreakeven: tradesBreakeven,
    winratePourcentage: Math.round(winrate * 10) / 10,
    profitFactor: Math.round(profitFactor * 100) / 100,
    maxDrawdownPourcentage: Math.round(maxDrawdownPourcent * 10) / 10,
    ratioRRMoyen: Math.round(ratioRRMoyen * 100) / 100,
    courbeEquity: courbeEquity,
    trades: tradesClotures,
  };
}
