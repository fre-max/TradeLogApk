import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLabel, VisualLine, VisualBox } from '@/types/indicatorScript';
import {
  detecterDojisAvecPlage,
  evaluerNiveauxShvedDansPlage,
  type SignalDojiAvecPlage,
  type ZoneShvedAvecScore,
} from './sandboxDojiShvedPlage';
import {
  calculerShvedSupplyDemand,
  type ZoneShved,
} from '@/lib/bot/modules/01_liquidite/shvedSupplyDemand';
import {
  calculerUnmitigatedOverlapProfile,
  type ResultatUOP,
  type TPOptimalUOP,
} from './unmitigatedOverlapProfile';

/**
 * ==============================================================================
 * 🎼 CHEF D'ORCHESTRE SMC (DOJI + SHVED + UOP + RANGE CONFIRMATION)
 * ==============================================================================
 * Cet indicateur est le chef d'orchestre stratégique. Il unifie 3 piliers :
 * 
 * 1️⃣ DÉCLENCHEUR : DOJI LIQ/REINT & SCORE SHVED (Bac à sable)
 *    - Détecte l'impulsion de liquidation + réintégration.
 *    - Isole la plage temporelle vers l'extrême précédent.
 *    - Calcule le score de liquidité institutionnelle sur 100 points de la zone Shved balayée.
 * 
 * 2️⃣ FILTRE DU RANGE DE CONFIRMATION (3 BOUGIES)
 *    - Le niveau de Stop Loss (SL) est fixé au prix extrême du Doji (Low en Achat, High en Vente).
 *    - On observe les 3 bougies formées juste après le Doji :
 *        ❌ Si une seule bougie casse le SL -> SETUP ANNULÉ (fausse sortie).
 *        ✅ Si les 3 bougies se maintiennent sans briser le SL -> SETUP CONFIRMÉ !
 * 
 * 3️⃣ CIBLE TP OPTIMAL & PROPORTIONNALITÉ (Overlap Profile UOP)
 *    - Récupère les Take Profits optimaux calculés par superposition des vagues UOP.
 *    - Proportionnalité au score Shved :
 *        • Score Élevé (>= 70 pts) : liquidité massive récupérée -> on vise un TP plus ambitieux (TP2).
 *        • Score Modéré (< 70 pts) : on vise le TP1 conservateur.
 *    - Calcule le Ratio Risque/Rendement (R:R).
 * ==============================================================================
 */

// ─── 📊 Interfaces et Types ───────────────────────────────────────────────────

export interface ParametresOrchestrateurSMC {
  // ─── 🕯️ Déclencheur Doji & Plage Sandbox ───
  activerAchat?: boolean;               // Autoriser les signaux d'Achat (Spring) (défaut: true)
  activerVente?: boolean;               // Autoriser les signaux de Vente (UTAD) (défaut: true)
  activerFiltreTaille?: boolean;        // Filtrer les Dojis par taille relative (défaut: true)
  periodeHistorique?: number;           // Nombre de bougies pour la moyenne de taille (défaut: 10)
  multiplicateurBougie1?: number;       // Multiplicateur bougie 1 de liquidation (défaut: 1.0)
  multiplicateurCorps2?: number;        // Multiplicateur bougie 2 de réintégration (défaut: 1.2)
  toleranceDeficit?: number;            // Tolérance de déficit de réintégration (défaut: 0.30)
  toleranceDepassement?: number;        // Tolérance de dépassement favorable (défaut: 2.0)
  maxReculRecherche?: number;           // Recul max pour la plage ciblée (défaut: 100)

  // ─── ⏱️ Multi-Timeframe & Shved ───
  timeframeSource?: string;             // Unité de temps Shved (défaut: 'M15')
  donneesM1?: Bougie[];                 // Données M1 pour calcul MTF
  chartTimeframe?: string;              // Unité de temps du graphique
  scoreMinimumShved?: number;           // Seuil minimal de score Shved (0 à 100, défaut: 0)

  // ─── ⏳ Range de Confirmation (3 Bougies) ───
  nbBougiesConfirmation?: number;        // Nombre de bougies de confirmation du range (défaut: 3)
  afficherSetupsAnnules?: boolean;       // Afficher les signaux invalidés avec un badge discret (défaut: false)

  // ─── 🎯 Cibles UOP & Proportionnalité ───
  seuilScoreGrandMouvement?: number;     // Score Shved pour viser TP2 au lieu de TP1 (défaut: 70)
  zigzagDepth?: number;                  // Sensibilité ZigZag UOP (défaut: 8)
  nbVaguesSuperposees?: number;          // Nombre de vagues superposées UOP (défaut: 4)

  // ─── 🎨 Visuels Graphiques ───
  afficherLignesSetup?: boolean;         // Afficher les lignes Entrée / SL / TP (défaut: true)
  bullColor?: string;                    // Couleur Achat / Support (défaut: '#00E676')
  bearColor?: string;                    // Couleur Vente / Résistance (défaut: '#F23645')
}

/**
 * Statut d'un setup de trading SMC
 */
export type StatutSetupSMC = 'CONFIRME' | 'ANNULE' | 'EN_COURS';

/**
 * Représentation complète d'un Setup orchestré
 */
export interface SetupOrchestreSMC {
  id: string;
  type: 'ACHAT' | 'VENTE';
  statut: StatutSetupSMC;
  indexDoji: number;
  tempsDoji: number | string;

  // Niveaux de prix clés
  prixEntree: number;           // Cours de clôture de la bougie 2 du Doji
  prixSL: number;               // Prix extrême du Doji (Stop Loss naturel)
  distanceSL: number;           // Distance en points de prix entre entrée et SL

  // Score Shved de la liquidité balayée
  scoreShved: number;           // Score sur 100 points
  meilleureZoneShved?: ZoneShvedAvecScore;

  // Validation du Range (les 3 bougies)
  bougiesObservees: number;     // Nombre de bougies écoulées après le Doji
  bougieInvalidationIndex?: number; // Index de la bougie ayant invalidé le SL si annulé

  // Cible Take Profit Optimal (UOP)
  prixTP?: number;              // Prix cible du Take Profit
  ordreTP?: number;             // Ordre du TP choisi (1 pour TP1, 2 pour TP2)
  distanceTP?: number;          // Distance en points entre entrée et TP
  ratioRR?: number;             // Ratio Risque/Rendement (R:R)
  tpSelectionne?: TPOptimalUOP;
}

export interface ResultatOrchestrateurSMC {
  setups: SetupOrchestreSMC[];
  primitives: VisualPrimitives;
  statistiques: {
    totalDetectes: number;
    totalConfirmes: number;
    totalAnnules: number;
    totalEnCours: number;
    totalAchatsConfirmes: number;
    totalVentesConfirmees: number;
    ratioMoyenRR: number;
  };
}

// ─── 🚀 Fonction Principale de l'Indicateur Chef d'Orchestre ───────────────────

/**
 * Exécute l'orchestration complète :
 * 1. Détecte les Dojis & Plages temporelles.
 * 2. Récupère le score de liquidité Shved de la zone balayée.
 * 3. Valide le Range de confirmation des 3 bougies consécutives.
 * 4. Calcule le TP Optimal UOP proportionnel au score de liquidité.
 * 5. Génère les visuels épurés pour le graphique.
 * 
 * Exemple d'utilisation :
 * ```typescript
 * const res = calculerOrchestrateurSMC(bougies, {
 *   nbBougiesConfirmation: 3,
 *   seuilScoreGrandMouvement: 70
 * });
 * console.log('Setups confirmés :', res.statistiques.totalConfirmes);
 * ```
 */
export function calculerOrchestrateurSMC(
  bougies: Bougie[],
  parametres: ParametresOrchestrateurSMC = {}
): ResultatOrchestrateurSMC {
  const labels: VisualLabel[] = [];
  const lignes: VisualLine[] = [];
  const boites: VisualBox[] = [];

  const resultatVide: ResultatOrchestrateurSMC = {
    setups: [],
    primitives: { labels, lignes, boites, points: [] },
    statistiques: {
      totalDetectes: 0,
      totalConfirmes: 0,
      totalAnnules: 0,
      totalEnCours: 0,
      totalAchatsConfirmes: 0,
      totalVentesConfirmees: 0,
      ratioMoyenRR: 0,
    },
  };

  if (!bougies || bougies.length < 15) return resultatVide;

  // 1️⃣ Options et Réglages
  const nbBougiesConfirmation = Math.max(1, Number(parametres.nbBougiesConfirmation ?? 3));
  const afficherSetupsAnnules = Boolean(parametres.afficherSetupsAnnules);
  const seuilScoreGrandMouvement = Math.max(10, Number(parametres.seuilScoreGrandMouvement ?? 70));
  const scoreMinimumShved = Math.max(0, Number(parametres.scoreMinimumShved ?? 0));
  const afficherLignesSetup = parametres.afficherLignesSetup !== false;
  const bullColor = parametres.bullColor || '#00E676';
  const bearColor = parametres.bearColor || '#F23645';

  // 2️⃣ Extraction des Niveaux Shved Supply & Demand
  const resultatShved = calculerShvedSupplyDemand(bougies, {
    timeframeSource: parametres.timeframeSource || 'M15',
    donneesM1: parametres.donneesM1,
    chartTimeframe: parametres.chartTimeframe,
    supprimerZonesCassees: false,
    afficherNonRetestees: true,
    afficherFaibles: true,
    minRetests: 0,
    maxLookbackBars: 250,
    afficherZones: false,
    afficherLignes: false,
    afficherEtiquettes: false,
  });

  const toutesLesZonesShved: ZoneShved[] = [
    ...resultatShved.supports,
    ...resultatShved.resistances,
  ];

  // 3️⃣ Extraction du Profil UOP (Chevauchement & TP Optimaux)
  const resultatUOP: ResultatUOP = calculerUnmitigatedOverlapProfile(bougies, {
    zigzagDepth: Number(parametres.zigzagDepth ?? 8),
    nbVaguesSuperposees: Number(parametres.nbVaguesSuperposees ?? 4),
    inclureVagueCourante: true,
    afficherTPOptimaux: true,
    afficherZigZag: false,
    afficherBarresProfil: false,
    afficherProlongation: false,
  });

  // 4️⃣ Détection des Dojis personnalisés avec leur plage ciblée (BLOC 1)
  const signauxDojis: SignalDojiAvecPlage[] = detecterDojisAvecPlage(bougies, parametres);

  const setups: SetupOrchestreSMC[] = [];
  let totalDetectes = 0;
  let totalConfirmes = 0;
  let totalAnnules = 0;
  let totalEnCours = 0;
  let totalAchatsConfirmes = 0;
  let totalVentesConfirmees = 0;
  let sommeRRConfirmes = 0;

  // 5️⃣ Traitement et Orchestration de chaque signal
  for (const doji of signauxDojis) {
    totalDetectes++;
    const estAchat = doji.type === 'ACHAT';
    const indexDoji = doji.indexBougie;
    const prixEntree = doji.close2;
    const prixSL = doji.prixExtreme;
    const distanceSL = Math.max(0.0001, Math.abs(prixEntree - prixSL));

    // A. Évaluation des zones Shved dans la plage ciblée (BLOC 2)
    const zonesDansPlage = evaluerNiveauxShvedDansPlage(
      toutesLesZonesShved,
      doji,
      bougies,
      {
        filtrerParDirectionSetup: true,
        exigerDebutEtFinDansPlage: true,
        afficherNiveauxCasses: true,
        scoreMinimum: 0,
        topNiveauxScore: 1, // Le meilleur niveau suffit pour scorer
      }
    );

    const meilleureZone = zonesDansPlage[0];
    const scoreShved = meilleureZone?.score ?? 0;

    // Filtre de score minimal (si demandé par l'utilisateur)
    if (scoreShved < scoreMinimumShved) {
      continue;
    }

    // B. Vérification du RANGE DE CONFIRMATION (les N bougies suivantes)
    let statut: StatutSetupSMC = 'CONFIRME';
    let bougiesObservees = 0;
    let bougieInvalidationIndex: number | undefined;

    const indexFinVerification = Math.min(indexDoji + nbBougiesConfirmation, bougies.length - 1);

    for (let k = indexDoji + 1; k <= indexFinVerification; k++) {
      bougiesObservees++;
      const bougieActuelle = bougies[k];

      if (estAchat) {
        // En Achat : si une bougie passe SOUS le plus bas du Doji (prixSL), le setup est invalidé
        if (bougieActuelle.low <= prixSL) {
          statut = 'ANNULE';
          bougieInvalidationIndex = k;
          break;
        }
      } else {
        // En Vente : si une bougie passe AU-DESSUS du plus haut du Doji (prixSL), le setup est invalidé
        if (bougieActuelle.high >= prixSL) {
          statut = 'ANNULE';
          bougieInvalidationIndex = k;
          break;
        }
      }
    }

    // Si on est encore dans les 3 bougies en fin d'historique et pas encore invalidé
    if (statut !== 'ANNULE' && bougiesObservees < nbBougiesConfirmation) {
      statut = 'EN_COURS';
    }

    // Comptabilisation des statistiques
    if (statut === 'CONFIRME') {
      totalConfirmes++;
      if (estAchat) totalAchatsConfirmes++;
      else totalVentesConfirmees++;
    } else if (statut === 'ANNULE') {
      totalAnnules++;
    } else {
      totalEnCours++;
    }

    // C. CIBLE TP OPTIMAL & PROPORTIONNALITÉ DU SCORE SHVED (BLOC UOP)
    let tpSelectionne: TPOptimalUOP | undefined;
    let prixTP: number | undefined;
    let ordreTP: number = 1;

    // Sélection des TP candidats selon la direction
    const tpsCandidats = estAchat
      ? (resultatUOP.tpOptimauxAchat || []).filter((tp) => tp.prixCible > prixEntree)
      : (resultatUOP.tpOptimauxVente || []).filter((tp) => tp.prixCible < prixEntree);

    // Règle de proportionnalité : si le score Shved est massif (ex: >= 70 pts), on prend un TP2
    const viserGrandMouvement = scoreShved >= seuilScoreGrandMouvement;

    if (tpsCandidats.length > 0) {
      if (viserGrandMouvement && tpsCandidats.length >= 2) {
        // Grand mouvement attendu -> Cible TP2
        tpSelectionne = tpsCandidats[1];
        ordreTP = 2;
      } else {
        // Mouvement standard ou conservateur -> Cible TP1
        tpSelectionne = tpsCandidats[0];
        ordreTP = 1;
      }
      prixTP = tpSelectionne.prixCible;
    } else {
      // Si aucun palier UOP n'a été trouvé, on applique un TP proportionnel au score (R:R par défaut basé sur le score)
      const multiplicateurSecours = viserGrandMouvement ? 2.5 : 1.5;
      prixTP = estAchat
        ? prixEntree + distanceSL * multiplicateurSecours
        : prixEntree - distanceSL * multiplicateurSecours;
      ordreTP = viserGrandMouvement ? 2 : 1;
    }

    const distanceTP = Math.abs(prixTP - prixEntree);
    const ratioRR = Number((distanceTP / distanceSL).toFixed(2));

    if (statut === 'CONFIRME') {
      sommeRRConfirmes += ratioRR;
    }

    // Création de l'objet Setup complet
    const setup: SetupOrchestreSMC = {
      id: `smc-setup-${indexDoji}`,
      type: doji.type,
      statut,
      indexDoji,
      tempsDoji: doji.temps,
      prixEntree,
      prixSL,
      distanceSL,
      scoreShved,
      meilleureZoneShved: meilleureZone,
      bougiesObservees,
      bougieInvalidationIndex,
      prixTP,
      ordreTP,
      distanceTP,
      ratioRR,
      tpSelectionne,
    };

    setups.push(setup);

    // ─── 🎨 Génération des Primitives Visuelles ───
    const couleurPrincipale = estAchat ? bullColor : bearColor;
    const dateDoji = doji.temps;
    const indexBougieFinRange = Math.min(bougies.length - 1, indexDoji + nbBougiesConfirmation);
    const dateFinRange = bougies[indexBougieFinRange].time;

    // 1. SETUP CONFIRMÉ ✅
    if (statut === 'CONFIRME') {
      labels.push({
        id: `orchestre-lbl-${indexDoji}`,
        prix: prixSL,
        date: dateDoji,
        texte: `✅ SMC ${estAchat ? 'ACHAT' : 'VENTE'}\nScore: ${scoreShved} pts | TP${ordreTP} (R:R 1:${ratioRR})`,
        couleur: couleurPrincipale,
        position: estAchat ? 'below' : 'above',
      });

      if (afficherLignesSetup) {
        // Ligne de Stop Loss (Rouge pointillés)
        lignes.push({
          id: `orchestre-sl-${indexDoji}`,
          prix: prixSL,
          dateDebut: dateDoji,
          dateFin: dateFinRange,
          couleur: '#FF3B30',
          epaisseur: 2,
          style: 'dashed',
          label: `SL [${prixSL.toFixed(2)}]`,
        });

        // Ligne d'Entrée (Bleue)
        lignes.push({
          id: `orchestre-entree-${indexDoji}`,
          prix: prixEntree,
          dateDebut: dateDoji,
          dateFin: dateFinRange,
          couleur: '#00B0FF',
          epaisseur: 1,
          style: 'solid',
          label: `Entrée [${prixEntree.toFixed(2)}]`,
        });

        // Ligne de Take Profit Optimal (Verte continue)
        if (prixTP !== undefined) {
          lignes.push({
            id: `orchestre-tp-${indexDoji}`,
            prix: prixTP,
            dateDebut: dateDoji,
            dateFin: dateFinRange,
            couleur: '#00E676',
            epaisseur: 2,
            style: 'solid',
            label: `TP${ordreTP} Optimal [${prixTP.toFixed(2)}] (R:R 1:${ratioRR})`,
          });
        }
      }
    }

    // 2. SETUP EN COURS DE CONFIRMATION ⏳
    else if (statut === 'EN_COURS') {
      labels.push({
        id: `orchestre-lbl-encours-${indexDoji}`,
        prix: prixSL,
        date: dateDoji,
        texte: `⏳ SMC ${estAchat ? 'Achat' : 'Vente'} (En cours ${bougiesObservees}/${nbBougiesConfirmation})\nScore: ${scoreShved} pts`,
        couleur: '#FFD600',
        position: estAchat ? 'below' : 'above',
      });
    }

    // 3. SETUP ANNULÉ PAR LE RANGE ❌ (si activé dans les paramètres)
    else if (statut === 'ANNULE' && afficherSetupsAnnules) {
      labels.push({
        id: `orchestre-lbl-annule-${indexDoji}`,
        prix: prixSL,
        date: dateDoji,
        texte: `❌ Annulé (Sortie Range B+${bougiesObservees})`,
        couleur: '#8E8E93',
        position: estAchat ? 'below' : 'above',
      });
    }
  }

  const ratioMoyenRR = totalConfirmes > 0
    ? Number((sommeRRConfirmes / totalConfirmes).toFixed(2))
    : 0;

  return {
    setups,
    primitives: { labels, lignes, boites, points: [] },
    statistiques: {
      totalDetectes,
      totalConfirmes,
      totalAnnules,
      totalEnCours,
      totalAchatsConfirmes,
      totalVentesConfirmees,
      ratioMoyenRR,
    },
  };
}
