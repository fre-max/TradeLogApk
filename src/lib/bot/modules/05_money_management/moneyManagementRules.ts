import type { Bougie } from '@/lib/chartDataHelper';

// ─── 🎯 Types et Structures de données ────────────────────────────────────────

/**
 * Représente l'évaluation financière et la gestion d'un trade complet.
 * Relie l'entrée (Module 4) et le Take Profit (Module 3).
 * 
 * Exemple :
 * {
 *   direction: 'achat',
 *   prixEntree: 1.0840,
 *   stopLoss: 1.0815,
 *   takeProfit: 1.0920,
 *   ratioRR: 3.2,
 *   estValide: true,
 *   lotRecommande: 0.40,
 *   risqueMonetaire: 100, // 1% d'un compte à 10 000$
 *   gainMonetaire: 320    // 3.2 x 100$
 * }
 */
export interface EvaluationTradeMM {
  id: string;
  direction: 'achat' | 'vente';
  prixEntree: number;
  stopLoss: number;
  takeProfit: number;
  distanceSLPips: number;
  distanceTPPips: number;
  ratioRR: number;
  estValide: boolean;          // Vrai si ratioRR >= ratioRRMin
  motifRejet?: string;
  lotRecommande: number;       // Taille de position calculée en lots
  risqueMonetaire: number;     // Perte maximale acceptée ($)
  gainMonetaire: number;       // Gain potentiel au TP ($)
  prixBreakEvenDeclencheur: number; // Prix auquel le SL passe à Break-Even (ex: 50% du trajet)
  prixTPPartiel: number;       // Prix du premier encaissement partiel (TP1)
  indexSignal: number;
  tempsSignal: number | string;
}

/**
 * Options de configuration du Money Management
 */
export interface OptionsMoneyManagement {
  ratioRRMin?: number;             // Ratio Risque/Rendement minimal exigé (défaut: 2.5)
  capitalCompte?: number;          // Capital total de référence en dollars (défaut: 10 000)
  risquePourcent?: number;         // Pourcentage de risque par trade (défaut: 1.0%)
  ratioDeclenchementBE?: number;   // % de la distance au TP pour passer en Break-Even (défaut: 0.50 = 50%)
  afficherBoiteTrade?: boolean;    // Affiche le rectangle de Risk/Reward sur le chart (défaut: true)
  afficherNiveauBE?: boolean;      // Trace la ligne intermédiaire de Break-Even (défaut: true)
  afficherBadgeResume?: boolean;   // Affiche l'étiquette avec le lot et le R:R (défaut: true)
  resultatsPrecedents?: Array<{ script: any; resultat: any }>;
}

/**
 * Résultat du module de Money Management
 */
export interface ResultatMoneyManagement {
  trades: EvaluationTradeMM[];
  tradesValides: EvaluationTradeMM[];
  tradesRejetes: EvaluationTradeMM[];
  dernierTrade: EvaluationTradeMM | null;
  capitalReference: number;
  risqueParTradeUSD: number;
}

// ─── 🚀 Moteur Principal de Calcul ────────────────────────────────────────────

/**
 * Calcule la taille d'un pip selon le type d'actif
 */
function obtenirTaillePip(prix: number): number {
  if (prix > 1000) return 0.1;    // Crypto / Indices
  if (prix > 50) return 0.01;     // Paires JPY / Métaux
  return 0.0001;                  // Forex standard
}

/**
 * Calcule la valeur monétaire d'un pip pour 1 lot standard
 */
function obtenirValeurPipParLot(prix: number): number {
  if (prix > 1000) return 1.0;    // Indices / Crypto
  if (prix > 50) return 6.8;      // JPY approx
  return 10.0;                    // Forex standard (10$ par pip pour 1.0 lot)
}

/**
 * Module 5 : Money Management Dynamique
 * 
 * 1️⃣ Récupère l'entrée et le SL chirurgical calculés par le Module 4 (Entrées Fractales LTF)
 * 2️⃣ Récupère le Take Profit Optimal calculé par le Module 3 (Overlaps Non-Mitigés UOP)
 * 3️⃣ Calcule le ratio Risque/Rendement (R:R) et rejette les trades en dessous du seuil minimal
 * 4️⃣ Calcule le dimensionnement exact du lot et les paliers de gestion (Break-Even & Partiels)
 * 5️⃣ Construit les primitives visuelles de la boîte de trade sur le graphique
 * 
 * Exemple :
 * const res = calculerMoneyManagementRules(bougies, {
 *   ratioRRMin: 3.0,
 *   capitalCompte: 10000,
 *   risquePourcent: 1.0
 * });
 * console.log('Trade validé :', res.donnees.dernierTrade?.estValide);
 */
export function calculerMoneyManagementRules(
  bougies: Bougie[],
  options: OptionsMoneyManagement = {}
): { donnees: ResultatMoneyManagement; primitives: { boites: any[]; lignes: any[]; labels: any[] } } {
  // Primitives visuelles projetées sur le chart
  const boites: any[] = [];
  const lignes: any[] = [];
  const labels: any[] = [];

  const ratioMin = options.ratioRRMin ?? 2.5;
  const capital = options.capitalCompte ?? 10000;
  const risquePct = options.risquePourcent ?? 1.0;
  const ratioBE = options.ratioDeclenchementBE ?? 0.50;
  const afficherBoite = options.afficherBoiteTrade !== false;
  const afficherBE = options.afficherNiveauBE !== false;
  const afficherBadge = options.afficherBadgeResume !== false;

  const risqueUSD = (capital * risquePct) / 100.0;

  const resultat: ResultatMoneyManagement = {
    trades: [],
    tradesValides: [],
    tradesRejetes: [],
    dernierTrade: null,
    capitalReference: capital,
    risqueParTradeUSD: risqueUSD,
  };

  // 1️⃣ Vérification minimale des bougies
  if (!bougies || bougies.length < 20) {
    return { donnees: resultat, primitives: { boites, lignes, labels } };
  }

  const dernierPrix = bougies[bougies.length - 1].close;
  const pipSize = obtenirTaillePip(dernierPrix);
  const valeurPip1Lot = obtenirValeurPipParLot(dernierPrix);

  // 2️⃣ Extraction des entrées du Module 4 (Entrées LTF)
  const signauxEntree: Array<{
    direction: 'achat' | 'vente';
    prixEntree: number;
    stopLoss: number;
    indexSignal: number;
    tempsSignal: number | string;
  }> = [];

  // Recherche dans les résultats des scripts précédents injectés par le chart
  if (options.resultatsPrecedents && options.resultatsPrecedents.length > 0) {
    for (const item of options.resultatsPrecedents) {
      if (item.script?.id === 'script-fractal-ltf-entry' || item.resultat?.donnees?.entrees) {
        const entreesLTF = item.resultat.donnees.entrees;
        if (Array.isArray(entreesLTF) && entreesLTF.length > 0) {
          for (const e of entreesLTF) {
            signauxEntree.push({
              direction: e.direction,
              prixEntree: e.prixEntree,
              stopLoss: e.stopLoss,
              indexSignal: e.indexSignal,
              tempsSignal: e.tempsSignal,
            });
          }
        }
      }
    }
  }

  // 3️⃣ Extraction des TP Optimaux du Module 3 (UOP Overlaps)
  let tpOptimalAchat: number | null = null;
  let tpOptimalVente: number | null = null;

  if (options.resultatsPrecedents && options.resultatsPrecedents.length > 0) {
    for (const item of options.resultatsPrecedents) {
      if (item.script?.id === 'script-unmitigated-overlap-profile' || item.resultat?.donnees?.tpOptimaux) {
        const dataUOP = item.resultat.donnees;
        if (dataUOP.dernierTPAchat?.prix) {
          tpOptimalAchat = dataUOP.dernierTPAchat.prix;
        }
        if (dataUOP.dernierTPVente?.prix) {
          tpOptimalVente = dataUOP.dernierTPVente.prix;
        }

        // Si non trouvés, scan de la liste tpOptimaux
        if (!tpOptimalAchat && Array.isArray(dataUOP.tpOptimaux)) {
          const tpsAchat = dataUOP.tpOptimaux.filter((t: any) => t.type === 'achat');
          if (tpsAchat.length > 0) tpOptimalAchat = tpsAchat[0].prix;
        }
        if (!tpOptimalVente && Array.isArray(dataUOP.tpOptimaux)) {
          const tpsVente = dataUOP.tpOptimaux.filter((t: any) => t.type === 'vente');
          if (tpsVente.length > 0) tpOptimalVente = tpsVente[0].prix;
        }
      }
    }
  }

  // Fallback autonome si aucun signal LTF n'a été injecté :
  // On génère une simulation basée sur le prix courant et les 20 dernières bougies
  if (signauxEntree.length === 0) {
    const debut = Math.max(0, bougies.length - 15);
    let minLow = bougies[debut].low;
    let maxHigh = bougies[debut].high;

    for (let i = debut; i < bougies.length; i++) {
      if (bougies[i].low < minLow) minLow = bougies[i].low;
      if (bougies[i].high > maxHigh) maxHigh = bougies[i].high;
    }

    const slAchat = minLow - 2 * pipSize;
    const tpDefautAchat = dernierPrix + (dernierPrix - slAchat) * 2.8;

    signauxEntree.push({
      direction: 'achat',
      prixEntree: dernierPrix,
      stopLoss: slAchat,
      indexSignal: bougies.length - 1,
      tempsSignal: bougies[bougies.length - 1].time,
    });

    if (!tpOptimalAchat) tpOptimalAchat = tpDefautAchat;
  }

  // 4️⃣ Évaluation Mathématique de chaque trade
  for (const sig of signauxEntree) {
    const estAchat = sig.direction === 'achat';
    const distanceSLPrix = Math.abs(sig.prixEntree - sig.stopLoss);
    const distanceSLPips = Number((distanceSLPrix / pipSize).toFixed(1));

    if (distanceSLPrix <= 0) continue;

    // Détermination du Take Profit cible (Module 3 en priorité ou projection par défaut)
    let tp = estAchat ? tpOptimalAchat : tpOptimalVente;
    if (!tp) {
      tp = estAchat
        ? sig.prixEntree + distanceSLPrix * ratioMin
        : sig.prixEntree - distanceSLPrix * ratioMin;
    }

    const distanceTPPrix = Math.abs(tp - sig.prixEntree);
    const distanceTPPips = Number((distanceTPPrix / pipSize).toFixed(1));

    // Calcul du Ratio Risque / Rendement
    const ratioRR = Number((distanceTPPrix / distanceSLPrix).toFixed(2));
    const estValide = ratioRR >= ratioMin;
    const motifRejet = !estValide
      ? `R:R insuffisant (${ratioRR} < ${ratioMin})`
      : undefined;

    // Calcul de la taille de lot exacte : Lot = Risque ($) / (Distance SL pips * Valeur pip)
    const perteParLot = distanceSLPips * valeurPip1Lot;
    let lot = perteParLot > 0 ? Number((risqueUSD / perteParLot).toFixed(2)) : 0.01;
    if (lot < 0.01) lot = 0.01;

    const gainUSD = Number((risqueUSD * ratioRR).toFixed(2));

    // Palier de Break-Even (ex: 50% de la distance vers le TP)
    const prixBE = estAchat
      ? sig.prixEntree + distanceTPPrix * ratioBE
      : sig.prixEntree - distanceTPPrix * ratioBE;

    // Palier de TP Partiel (TP1 intermédiaire)
    const prixTP1 = estAchat
      ? sig.prixEntree + distanceTPPrix * 0.50
      : sig.prixEntree - distanceTPPrix * 0.50;

    const evalTrade: EvaluationTradeMM = {
      id: `trade-mm-${sig.indexSignal}-${sig.direction}`,
      direction: sig.direction,
      prixEntree: sig.prixEntree,
      stopLoss: sig.stopLoss,
      takeProfit: tp,
      distanceSLPips,
      distanceTPPips,
      ratioRR,
      estValide,
      motifRejet,
      lotRecommande: lot,
      risqueMonetaire: risqueUSD,
      gainMonetaire: gainUSD,
      prixBreakEvenDeclencheur: prixBE,
      prixTPPartiel: prixTP1,
      indexSignal: sig.indexSignal,
      tempsSignal: sig.tempsSignal,
    };

    resultat.trades.push(evalTrade);
    if (estValide) {
      resultat.tradesValides.push(evalTrade);
    } else {
      resultat.tradesRejetes.push(evalTrade);
    }
    resultat.dernierTrade = evalTrade;

    // ─── 5️⃣ Primitives Visuelles sur le Graphique ─────────────────────────────
    const bgSignal = bougies[Math.min(bougies.length - 1, sig.indexSignal)];
    const tempsDebut = bgSignal ? bgSignal.time : sig.tempsSignal;
    const tempsFin = bougies[Math.min(bougies.length - 1, sig.indexSignal + 25)].time;

    // 📦 Boîte de Gain (Vert émeraude si valide, gris si rejeté)
    if (afficherBoite) {
      boites.push({
        id: `box-gain-${evalTrade.id}`,
        prixHaut: Math.max(sig.prixEntree, tp),
        prixBas: Math.min(sig.prixEntree, tp),
        dateDebut: tempsDebut,
        dateFin: tempsFin,
        couleurFond: estValide ? 'rgba(16, 185, 129, 0.18)' : 'rgba(100, 116, 139, 0.12)',
        couleurBordure: estValide ? '#10b981' : '#64748b',
        label: estValide ? `🎯 GAIN CIBLE (+${ratioRR} R)` : `❌ REJETÉ (R:R ${ratioRR})`,
      });

      // 📦 Boîte de Risque (Rouge framboise)
      boites.push({
        id: `box-risque-${evalTrade.id}`,
        prixHaut: Math.max(sig.prixEntree, sig.stopLoss),
        prixBas: Math.min(sig.prixEntree, sig.stopLoss),
        dateDebut: tempsDebut,
        dateFin: tempsFin,
        couleurFond: 'rgba(239, 68, 68, 0.18)',
        couleurBordure: '#ef4444',
        label: `🛡️ RISQUE (1R: -${risqueUSD}$)`,
      });
    }

    // ── Lignes horizontales de niveaux clés ──
    // Ligne TP
    lignes.push({
      id: `ligne-tp-${evalTrade.id}`,
      prix: tp,
      dateDebut: tempsDebut,
      dateFin: tempsFin,
      couleur: '#10b981',
      style: 'solid',
      label: `🏁 TP Optimal (+${ratioRR}R / +${gainUSD}$): ${tp.toFixed(tp > 100 ? 2 : 4)}`,
    });

    // Ligne Entrée
    lignes.push({
      id: `ligne-entry-${evalTrade.id}`,
      prix: sig.prixEntree,
      dateDebut: tempsDebut,
      dateFin: tempsFin,
      couleur: '#38bdf8',
      style: 'solid',
      label: `🔵 Entrée [${lot} lot${lot > 1 ? 's' : ''}]: ${sig.prixEntree.toFixed(sig.prixEntree > 100 ? 2 : 4)}`,
    });

    // Ligne Break-Even déclencheur
    if (afficherBE) {
      lignes.push({
        id: `ligne-be-${evalTrade.id}`,
        prix: prixBE,
        dateDebut: tempsDebut,
        dateFin: tempsFin,
        couleur: '#f59e0b',
        style: 'dashed',
        label: `⚡ Seuil Break-Even (50%): ${prixBE.toFixed(prixBE > 100 ? 2 : 4)}`,
      });
    }

    // Ligne SL
    lignes.push({
      id: `ligne-sl-${evalTrade.id}`,
      prix: sig.stopLoss,
      dateDebut: tempsDebut,
      dateFin: tempsFin,
      couleur: '#ef4444',
      style: 'solid',
      label: `🛑 Stop Loss (-${distanceSLPips}p / -${risqueUSD}$): ${sig.stopLoss.toFixed(sig.stopLoss > 100 ? 2 : 4)}`,
    });

    // 🏷️ Badge récapitulatif
    if (afficherBadge) {
      labels.push({
        id: `badge-mm-${evalTrade.id}`,
        prix: estAchat ? tp : sig.stopLoss,
        date: tempsDebut,
        texte: estValide
          ? `✅ R:R ${ratioRR} | LOT: ${lot} | +${gainUSD}$`
          : `⚠️ REJETÉ : R:R ${ratioRR} < ${ratioMin}`,
        couleur: estValide ? '#10b981' : '#f59e0b',
        position: estAchat ? 'above' : 'below',
      });
    }
  }

  return {
    donnees: resultat,
    primitives: { boites, lignes, labels },
  };
}
