import type { Bougie } from '@/lib/chartDataHelper';

// ─── 🎯 Types et Structures de données ────────────────────────────────────────

/**
 * Checklist des confluences institutionnelles requises pour qu'un trade soit pris.
 */
export interface ChecklistConfluences {
  liquiditeBalayee: boolean;      // Module 1 & 2 : Sweep/Spring confirmé
  prixProtegeActif: boolean;      // Module 2 : Creux ou sommet extrême inviolable
  orderBlockLTFConfirme: boolean; // Module 4 : Retest de l'OB fractal interne
  tpOptimalUOPValide: boolean;    // Module 3 : Autoroute de chevauchement dégagée
  ratioRRValide: boolean;         // Module 5 : R:R >= seuil minimal (ex: 2.5)
  alignementDroneMTF: boolean;    // Module 6 : Pas d'obstacle macro bloquant
  scoreGlobal: number;            // Note sur 6 confluences
}

/**
 * Setup de trading complet prêt pour exécution automatique ou visuelle.
 * Consolide les 6 modules en une seule entité décisionnelle.
 */
export interface SetupCompletBot {
  id: string;
  direction: 'achat' | 'vente';
  estPretPourExecution: boolean;  // Vrai si 100% des critères du bot sont réunis
  prixEntree: number;
  stopLoss: number;
  takeProfitInitial: number;
  takeProfitDrone: number;        // TP ajusté par le drone (Runner ou Sécurité)
  prixBreakEven: number;
  distanceSLPips: number;
  distanceTPPips: number;
  ratioRR: number;
  lotRecommande: number;
  risqueMonetaire: number;
  gainEstime: number;
  confluences: ChecklistConfluences;
  decisionDrone: string;
  messageSynthese: string;
  indexSignal: number;
  tempsSignal: number | string;
}

/**
 * Options de configuration du Visualiseur de Setup Complet
 */
export interface OptionsVisualiseurSetup {
  ratioRRMin?: number;             // R:R minimum requis (défaut: 2.5)
  scoreMinConfluences?: number;    // Nombre minimum de confluences pour valider (défaut: 5 sur 6)
  afficherBoitePosition?: boolean; // Affiche la boîte de position style TradingView (défaut: true)
  afficherPanneauChecklist?: boolean; // Affiche le récapitulatif des confluences (défaut: true)
  afficherLigneRunner?: boolean;   // Affiche la ligne violette du TP Runner si conseillé (défaut: true)
  resultatsPrecedents?: Array<{ script: any; resultat: any }>;
}

/**
 * Résultat du visualiseur
 */
export interface ResultatVisualiseurSetup {
  setups: SetupCompletBot[];
  dernierSetup: SetupCompletBot | null;
  totalSetupsValides: number;
}

// ─── 🚀 Moteur Principal de Calcul ────────────────────────────────────────────

function calculerPip(prix: number): number {
  if (prix > 1000) return 0.1;
  if (prix > 50) return 0.01;
  return 0.0001;
}

/**
 * Module 7 : Visualiseur de Setup Complet ("Aperçu du Bot")
 * 
 * 1️⃣ Récupère les données des 6 modules précédents calculés dans la chaîne
 * 2️⃣ Évalue la checklist institutionnelle de confluences (sur 6 critères)
 * 3️⃣ Construit la boîte de position complète et les objectifs (Entry, SL, TP, BE, Runner)
 * 4️⃣ Génère le panneau visuel pour montrer à l'utilisateur ce que le bot ferait en direct
 * 
 * Exemple :
 * const res = calculerCompleteSetupVisualizer(bougies, { ratioRRMin: 2.5 });
 * console.log('Setup prêt :', res.donnees.dernierSetup?.estPretPourExecution);
 */
export function calculerCompleteSetupVisualizer(
  bougies: Bougie[],
  options: OptionsVisualiseurSetup = {}
): { donnees: ResultatVisualiseurSetup; primitives: { boites: any[]; lignes: any[]; labels: any[] } } {
  const boites: any[] = [];
  const lignes: any[] = [];
  const labels: any[] = [];

  const ratioMin = options.ratioRRMin ?? 2.5;
  const scoreMin = options.scoreMinConfluences ?? 5;
  const afficherBoite = options.afficherBoitePosition !== false;
  const afficherChecklist = options.afficherPanneauChecklist !== false;
  const afficherRunner = options.afficherLigneRunner !== false;

  const resultat: ResultatVisualiseurSetup = {
    setups: [],
    dernierSetup: null,
    totalSetupsValides: 0,
  };

  if (!bougies || bougies.length < 20) {
    return { donnees: resultat, primitives: { boites, lignes, labels } };
  }

  const dernierPrix = bougies[bougies.length - 1].close;
  const pipSize = calculerPip(dernierPrix);

  // 1️⃣ Extraction des données des modules 1 à 6
  let donneesSweep: any = null;
  let donneesEntreeLTF: any = null;
  let donneesUOP: any = null;
  let donneesMM: any = null;
  let donneesDrone: any = null;

  if (options.resultatsPrecedents && options.resultatsPrecedents.length > 0) {
    for (const item of options.resultatsPrecedents) {
      const id = item.script?.id || '';
      const donnees = item.resultat?.donnees;

      if (id === 'script-sweep-spring-validation' || item.resultat?.typeSpecial === 'sweep-spring') {
        donneesSweep = donnees;
      } else if (id === 'script-unmitigated-overlap-profile' || donnees?.tpOptimaux) {
        donneesUOP = donnees;
      } else if (id === 'script-fractal-ltf-entry' || donnees?.entrees) {
        donneesEntreeLTF = donnees;
      } else if (id === 'script-money-management' || donnees?.dernierTrade) {
        donneesMM = donnees;
      } else if (id === 'script-mtf-conductor' || donnees?.macroHTF) {
        donneesDrone = donnees;
      }
    }
  }

  // 2️⃣ Extraction des variables clés du trade
  const tradeMM = donneesMM?.dernierTrade;
  const entreeLTF = donneesEntreeLTF?.dernierSignal;
  const droneRecommandation = donneesDrone?.recommandation;

  const direction: 'achat' | 'vente' = tradeMM?.direction || entreeLTF?.direction || 'achat';
  const prixEntree: number = tradeMM?.prixEntree || entreeLTF?.prixEntree || dernierPrix;
  const stopLoss: number = tradeMM?.stopLoss || entreeLTF?.stopLoss || (direction === 'achat' ? dernierPrix - 20 * pipSize : dernierPrix + 20 * pipSize);
  const tpInitial: number = tradeMM?.takeProfit || (direction === 'achat' ? dernierPrix + 50 * pipSize : dernierPrix - 50 * pipSize);
  const tpDrone: number = droneRecommandation?.tpAjuste || tpInitial;
  const prixBE: number = tradeMM?.prixBreakEvenDeclencheur || (direction === 'achat' ? prixEntree + Math.abs(tpInitial - prixEntree) * 0.5 : prixEntree - Math.abs(tpInitial - prixEntree) * 0.5);

  const indexSignal: number = tradeMM?.indexSignal || entreeLTF?.indexSignal || (bougies.length - 1);
  const tempsSignal: number | string = tradeMM?.tempsSignal || entreeLTF?.tempsSignal || bougies[bougies.length - 1].time;

  const distSLPrix = Math.abs(prixEntree - stopLoss);
  const distTPPrix = Math.abs(tpInitial - prixEntree);
  const distSLPips = Number((distSLPrix / pipSize).toFixed(1));
  const distTPPips = Number((distTPPrix / pipSize).toFixed(1));
  const ratioRR = distSLPrix > 0 ? Number((distTPPrix / distSLPrix).toFixed(2)) : 2.5;

  const lot = tradeMM?.lotRecommande || 0.10;
  const risqueUSD = tradeMM?.risqueMonetaire || 100;
  const gainUSD = tradeMM?.gainMonetaire || Number((risqueUSD * ratioRR).toFixed(2));

  // 3️⃣ Évaluation de la Checklist Institutionnelle des Confluences
  const confluences: ChecklistConfluences = {
    liquiditeBalayee: Boolean(donneesSweep?.signaux?.length > 0 || donneesSweep?.totalSignaux > 0),
    prixProtegeActif: Boolean(entreeLTF?.prixProtege || tradeMM?.stopLoss),
    orderBlockLTFConfirme: Boolean(entreeLTF?.orderBlock && entreeLTF.typeEntree === 'retest_ob'),
    tpOptimalUOPValide: Boolean(donneesUOP?.tpOptimaux?.length > 0 || donneesUOP?.dernierTPAchat || donneesUOP?.dernierTPVente),
    ratioRRValide: ratioRR >= ratioMin,
    alignementDroneMTF: droneRecommandation?.decision !== 'prudence_contre_tendance',
    scoreGlobal: 0,
  };

  let score = 0;
  if (confluences.liquiditeBalayee) score++;
  if (confluences.prixProtegeActif) score++;
  if (confluences.orderBlockLTFConfirme) score++;
  if (confluences.tpOptimalUOPValide) score++;
  if (confluences.ratioRRValide) score++;
  if (confluences.alignementDroneMTF) score++;
  confluences.scoreGlobal = score;

  const estPret = score >= scoreMin && ratioRR >= ratioMin;
  const decisionDroneTexte = droneRecommandation?.decision || 'maintien_standard';

  const messageSynthese = estPret
    ? `✅ SETUP COMPLET VALIDÉ (${score}/6 confluences) | R:R ${ratioRR} | Lot: ${lot} | Risque: ${risqueUSD}$ | Gain: +${gainUSD}$`
    : `⚠️ SETUP INCOMPLET (${score}/6 confluences) : En attente de confirmation complète du bot.`;

  const setup: SetupCompletBot = {
    id: `setup-bot-${indexSignal}`,
    direction,
    estPretPourExecution: estPret,
    prixEntree,
    stopLoss,
    takeProfitInitial: tpInitial,
    takeProfitDrone: tpDrone,
    prixBreakEven: prixBE,
    distanceSLPips: distSLPips,
    distanceTPPips: distTPPips,
    ratioRR,
    lotRecommande: lot,
    risqueMonetaire: risqueUSD,
    gainEstime: gainUSD,
    confluences,
    decisionDrone: decisionDroneTexte,
    messageSynthese,
    indexSignal,
    tempsSignal,
  };

  resultat.setups.push(setup);
  resultat.dernierSetup = setup;
  if (estPret) resultat.totalSetupsValides++;

  // ─── 4️⃣ Construction des Primitives Visuelles ──────────────────────────────
  const bgSignal = bougies[indexSignal] || bougies[bougies.length - 1];
  const tempsDebut = bgSignal.time;
  const tempsFin = bougies[Math.min(bougies.length - 1, indexSignal + 35)].time;

  if (afficherBoite) {
    const estAchat = direction === 'achat';

    // 🟢 Boîte de Gain (Vert émeraude vif si prêt, gris si incomplet)
    boites.push({
      id: `box-bot-gain-${setup.id}`,
      prixHaut: Math.max(prixEntree, tpInitial),
      prixBas: Math.min(prixEntree, tpInitial),
      dateDebut: tempsDebut,
      dateFin: tempsFin,
      couleurFond: estPret ? 'rgba(16, 185, 129, 0.22)' : 'rgba(100, 116, 139, 0.15)',
      couleurBordure: estPret ? '#10b981' : '#64748b',
      label: estPret ? `🤖 CIBLE DU BOT (+${ratioRR}R / +${gainUSD}$)` : `🤖 SETUP EN ATTENTE`,
    });

    // 🔴 Boîte de Risque (Rouge framboise)
    boites.push({
      id: `box-bot-risque-${setup.id}`,
      prixHaut: Math.max(prixEntree, stopLoss),
      prixBas: Math.min(prixEntree, stopLoss),
      dateDebut: tempsDebut,
      dateFin: tempsFin,
      couleurFond: 'rgba(239, 68, 68, 0.22)',
      couleurBordure: '#ef4444',
      label: `🛡️ SL PROTÉGÉ (-${distSLPips}p / -${risqueUSD}$)`,
    });
  }

  // ── Lignes Niveaux Clés ──
  // Ligne d'Entrée blanche éclatante
  lignes.push({
    id: `ligne-bot-entry-${setup.id}`,
    prix: prixEntree,
    dateDebut: tempsDebut,
    dateFin: tempsFin,
    couleur: '#ffffff',
    style: 'solid',
    label: `⚡ ENTRÉE BOT [${lot} lot${lot > 1 ? 's' : ''}]: ${prixEntree.toFixed(prixEntree > 100 ? 2 : 4)}`,
  });

  // Ligne de Break-Even dorée
  lignes.push({
    id: `ligne-bot-be-${setup.id}`,
    prix: prixBE,
    dateDebut: tempsDebut,
    dateFin: tempsFin,
    couleur: '#f59e0b',
    style: 'dashed',
    label: `⚡ Seuil BE (Sécurisation 50%): ${prixBE.toFixed(prixBE > 100 ? 2 : 4)}`,
  });

  // Ligne TP Optimal UOP
  lignes.push({
    id: `ligne-bot-tp-${setup.id}`,
    prix: tpInitial,
    dateDebut: tempsDebut,
    dateFin: tempsFin,
    couleur: '#10b981',
    style: 'solid',
    label: `🏁 TP Optimal (+${ratioRR}R): ${tpInitial.toFixed(tpInitial > 100 ? 2 : 4)}`,
  });

  // Ligne TP Runner Drone si extension suggérée
  if (afficherRunner && tpDrone !== tpInitial && Math.abs(tpDrone - tpInitial) > pipSize) {
    lignes.push({
      id: `ligne-bot-runner-${setup.id}`,
      prix: tpDrone,
      dateDebut: tempsDebut,
      dateFin: tempsFin,
      couleur: '#a855f7',
      style: 'dashed',
      label: `🛸 TP Runner Drone (Extension): ${tpDrone.toFixed(tpDrone > 100 ? 2 : 4)}`,
    });
  }

  // Ligne Stop Loss
  lignes.push({
    id: `ligne-bot-sl-${setup.id}`,
    prix: stopLoss,
    dateDebut: tempsDebut,
    dateFin: tempsFin,
    couleur: '#ef4444',
    style: 'solid',
    label: `🛑 SL Protégé: ${stopLoss.toFixed(stopLoss > 100 ? 2 : 4)}`,
  });

  // ── Panneau de Checklist des Confluences ──
  if (afficherChecklist) {
    const estAchat = direction === 'achat';
    labels.push({
      id: `hud-bot-checklist-${setup.id}`,
      prix: estAchat ? Math.max(tpInitial, tpDrone) : stopLoss,
      date: tempsDebut,
      texte: `🤖 APERÇU DU BOT [${score}/6] : ${estPret ? 'PRÊT POUR TRADING AUTO' : 'FILTRE STRICT ACTIF'}`,
      couleur: estPret ? '#10b981' : '#f59e0b',
      position: estAchat ? 'above' : 'below',
    });
  }

  return {
    donnees: resultat,
    primitives: { boites, lignes, labels },
  };
}
