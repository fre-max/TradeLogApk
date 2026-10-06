import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Bougie } from '@/lib/chartDataHelper'
import type { MacroEvent, FundamentalSnapshot } from '@/types/fundamental'
import { computeSnapshotAtTimestamp } from '@/lib/fundamentalEngine'
import type { IndicatorScript } from '@/types/indicatorScript'
import { recupererIndicateursStockes, sauvegarderIndicateurStocke } from '@/lib/indicators/indicatorEngine'

/**
 * Représente un trade simulé pendant la session de backtesting.
 */
export interface PositionSimulee {
  direction: 'long' | 'short';
  prixEntree: number;
  stopLoss: number;
  takeProfit: number;
  dateEntree: string | number;
  indexEntree: number;           // Index de la bougie d'entrée (pour calculer la durée réelle)
  dureeEstimeeHeures?: number;   // Estimation du trader en heures
  dureeEstimeeBougies?: number;  // Conversion de l'estimation en nombre de bougies avant TP
  dureeEstimeeLargeur?: number;  // Largeur visuelle du bloc de trade en bougies
  prixSortie?: number;
  dateSortie?: string | number;
  indexSortie?: number;          // Index de la bougie de sortie
  dureeReelleBougies?: number;   // Calculé automatiquement à la clôture
  resultat?: 'win' | 'loss' | 'breakeven' | 'missed';
  pnl?: number;
  estDeclenchee?: boolean;       // Indique si l'ordre a été déclenché (au marché ou ordre limite touché)
  indexDeclenchement?: number;   // Index de la bougie où l'ordre a été déclenché
  dateDeclenchement?: string | number;
  tradeIdSupabase?: string;       // L'ID du trade associé dans Supabase (étapes 1 et 2)
  stepIdsSupabase?: {             // Les IDs des étapes associées dans Supabase
    biais: string;
    poi: string;
    entry: string;
    result: string;
  };
  planificationEnregistree?: boolean; // Indique si la planification (étape 1) a été sauvée
  estCloturee?: boolean;              // Indique si le replay ou l'utilisateur a fermé la position
  // 🛡️ Contexte technique au moment de la prise de position (Protected Swings)
  protectedSwingsSnapshot?: any;
  // 📊 Contexte technique de profil de volume non mitigué (SMC UVP)
  unmitigatedProfileSnapshot?: any;
  // 📐 Contexte technique de structure de marché et vagues (ZigZag)
  zigzagSnapshot?: any;
  // 💎 Contexte technique LuxAlgo Smart Money Concepts (SMC)
  smcSnapshot?: any;
}

/**
 * Préférences utilisateur pour la collecte des données télémétriques lors d'un trade
 */
export interface OptionsCollecteTelemetrie {
  protectedSwings: boolean;
  unmitigatedProfile: boolean;
  zigzag: boolean;
  luxAlgoSMC: boolean;
}

/**
 * Contexte de restauration permettant de rejouer n'importe quel trade (DB ou session)
 */
export interface ContexteRestaurationReplay {
  pair: string;
  annee: string;
  timeframe: string;
  timestamp: number;
  position?: {
    direction: 'long' | 'short';
    prixEntree: number;
    stopLoss: number;
    takeProfit: number;
    dureeEstimeeHeures?: number;
    dureeEstimeeBougies?: number;
    dureeEstimeeLargeur?: number;
    tradeIdSupabase?: string;
  };
  tradeInfo?: {
    id: string;
    titre?: string;
    noteQualite?: 'A+' | 'A' | 'B';
    setupName?: string;
  };
}

interface BacktestState {
  // Informations de session
  actif: string;
  donneesCompletes: Bougie[];
  donneesM1: Bougie[]; // Données M1 brutes utilisées pour les indicateurs Multi-Timeframe (MTF)
  indexCourant: number; // L'index de la dernière bougie visible sur le graphique

  // Paramètres de la source de données (utiles pour recharger après navigation)
  paireCloud: string;    // Ex: 'EURUSD', 'GBPUSD'...
  anneeCloud: string;    // Ex: '2024', '2025'...
  timeframeSauvegarde: string; // Ex: 'H1', 'H4', 'D1'...
  journalDest: 'global' | 'bias' | 'poi' | 'confirmation'; // Choix persistant du journal de destination

  // Contrôles du Replay
  estEnLecture: boolean;
  vitesseLecture: number; // Millisecondes par bougie

  // Position active et historique
  positionActive: PositionSimulee | null;
  historiqueSimule: PositionSimulee[];

  // Actions
  chargerDonnees: (donnees: Bougie[], nomActif: string) => void;
  avancerBougie: () => boolean; // Retourne true s'il y avait une bougie à avancer, false sinon
  reculerBougie: () => boolean; // Retourne true s'il y avait une bougie à reculer, false sinon
  revenirDebut: () => void;

  setEstEnLecture: (val: boolean) => void;
  setVitesseLecture: (ms: number) => void;
  setPaireCloud: (paire: string) => void;
  setAnneeCloud: (annee: string) => void;
  setTimeframeSauvegarde: (tf: string) => void;
  setJournalDest: (dest: 'global' | 'bias' | 'poi' | 'confirmation') => void;
  ouvrirPosition: (
    direction: 'long' | 'short',
    prixEntree: number,
    stopLoss: number,
    takeProfit: number,
    dureeEstimeeHeures?: number,
    dureeEstimeeBougies?: number,
    dureeEstimeeLargeur?: number,
    protectedSwingsSnapshot?: any,
    unmitigatedProfileSnapshot?: any,
    zigzagSnapshot?: any,
    smcSnapshot?: any
  ) => void;
  modifierPositionActive: (updates: Partial<PositionSimulee>) => void;
  fermerPositionManuellement: () => void;
  archiverPositionActive: () => void;
  annulerPositionActive: () => void;
  supprimerTradeHistorique: (index: number) => void;
  reinitialiserSession: () => void;
  nettoyerRestaurationContexte: () => void;
  lancerRestaurationContexte: (contexte: ContexteRestaurationReplay) => void;
  couperReplayAIndex: (index: number) => void;
  injecterDonneesPrecedentes: (anciennesDonnees: Bougie[]) => void;
  mettreAJourDonneesMtf: (nouvellesDonnees: Bougie[]) => void;
  setDonneesM1: (bougies: Bougie[]) => void;
  contexteRestauration: ContexteRestaurationReplay | null;

  // State et Actions pour l'Analyse Fondamentale
  fundamentalModeEnabled: boolean;
  macroEvents: MacroEvent[];
  activeSnapshot: FundamentalSnapshot | null;
  toggleFundamentalMode: () => void;
  setMacroEvents: (events: MacroEvent[]) => void;
  clearMacroEvents: () => void;
  recalculerSnapshotMacro: () => void;

  // State et Actions pour l'Indicateur LuxAlgo Protected Swings
  afficherProtectedSwings: boolean;
  toggleProtectedSwings: () => void;

  // State et Actions pour l'Indicateur SMC Unmitigated Volume Profile
  afficherUnmitigatedProfile: boolean;
  toggleUnmitigatedProfile: () => void;

  // State et Actions pour l'Indicateur ZigZag Autonome
  afficherZigZag: boolean;
  toggleZigZag: () => void;

  // State et Actions pour l'Indicateur LuxAlgo Smart Money Concepts (SMC)
  afficherLuxAlgoSMC: boolean;
  toggleLuxAlgoSMC: () => void;

  // Contrôle dynamique de l'affichage et de la collecte télémétrique (Style TradingView)
  retirerIndicateur: (indicateur: 'protectedSwings' | 'unmitigatedProfile' | 'zigzag' | 'luxAlgoSMC') => void;
  optionsCollecte: OptionsCollecteTelemetrie;
  setOptionCollecte: (cle: keyof OptionsCollecteTelemetrie, valeur: boolean) => void;

  // ─── Gestion Unifiée des Scripts d'Indicateurs (Style TradingView) ────────
  scriptsIndicateurs: IndicatorScript[];
  chargerScriptsIndicateurs: () => void;
  toggleVisibiliteScript: (id: string) => void;
  retirerScriptDuGraphique: (id: string) => void;
  sauvegarderScriptIndicateur: (script: IndicatorScript) => void;
}

// Le store utilise le middleware 'persist' de Zustand pour sauvegarder l'état de session
// dans le sessionStorage du navigateur. Cela permet de reprendre le backtest même après
// avoir navigué vers une autre page.
// IMPORTANT : les donneesCompletes (potentiellement très volumineuses) sont EXCLUES
// de la persistance et rechargées automatiquement au retour sur la page.
export const useBacktestStore = create<BacktestState>()(
  persist(
    (set, get) => ({
  actif: 'Aucun actif',
  donneesCompletes: [], // Jamais persisté (trop lourd pour le sessionStorage)
  donneesM1: [],        // Données M1 brutes pour les calculs multi-timeframe (MTF)
  setDonneesM1: (bougies) => set({ donneesM1: bougies }),
  indexCourant: 0,
  estEnLecture: false,
  vitesseLecture: 1000, // Par défaut : 1 bougie par seconde
  positionActive: null,
  historiqueSimule: [],

  // Paramètres de la source pour le rechargement automatique
  paireCloud: 'EURUSD',
  anneeCloud: '2025',
  timeframeSauvegarde: 'H1',
  journalDest: 'global', // Par défaut 'global', puis persistant selon le choix utilisateur

  setJournalDest: (dest) => set({ journalDest: dest }),

  // Contexte de restauration de replay (clic depuis le journal)
  contexteRestauration: null as ContexteRestaurationReplay | null,

  // Mode Analyse Fondamentale - État initial
  fundamentalModeEnabled: false,
  macroEvents: [],
  activeSnapshot: null,

  toggleFundamentalMode: () => {
    const nouveauState = !get().fundamentalModeEnabled;
    console.log(`💡 [Backtest Store] Mode Fondamental : ${nouveauState ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
    set({ fundamentalModeEnabled: nouveauState });
    get().recalculerSnapshotMacro();
  },

  // ─── Gestion Unifiée des Scripts d'Indicateurs (Style TradingView) ────────
  scriptsIndicateurs: [],
  chargerScriptsIndicateurs: () => {
    const scripts = recupererIndicateursStockes();
    set({
      scriptsIndicateurs: scripts,
      afficherLuxAlgoSMC: scripts.find(s => s.id === 'script-luxalgo-smc')?.visibleSurGraphique ?? false,
      afficherProtectedSwings: scripts.find(s => s.id === 'script-protected-swings')?.visibleSurGraphique ?? false,
      afficherUnmitigatedProfile: scripts.find(s => s.id === 'script-unmitigated-profile')?.visibleSurGraphique ?? false,
      afficherZigZag: scripts.find(s => s.id === 'script-zigzag-smc')?.visibleSurGraphique ?? false,
    });
  },
  toggleVisibiliteScript: (id: string) => {
    const scripts = get().scriptsIndicateurs.length > 0 ? get().scriptsIndicateurs : recupererIndicateursStockes();
    const script = scripts.find(s => s.id === id);
    if (!script) return;
    const nouvelleVisibilite = !script.visibleSurGraphique;
    const maj = { ...script, visibleSurGraphique: nouvelleVisibilite, misAJourLe: new Date().toISOString() };
    sauvegarderIndicateurStocke(maj);
    const nouveauxScripts = scripts.map(s => s.id === id ? maj : s);
    set({
      scriptsIndicateurs: nouveauxScripts,
      ...(id === 'script-luxalgo-smc' ? { afficherLuxAlgoSMC: nouvelleVisibilite } : {}),
      ...(id === 'script-protected-swings' ? { afficherProtectedSwings: nouvelleVisibilite } : {}),
      ...(id === 'script-unmitigated-profile' ? { afficherUnmitigatedProfile: nouvelleVisibilite } : {}),
      ...(id === 'script-zigzag-smc' ? { afficherZigZag: nouvelleVisibilite } : {}),
    });
  },
  retirerScriptDuGraphique: (id: string) => {
    const scripts = get().scriptsIndicateurs.length > 0 ? get().scriptsIndicateurs : recupererIndicateursStockes();
    const script = scripts.find(s => s.id === id);
    if (!script) return;
    const maj = { ...script, visibleSurGraphique: false, misAJourLe: new Date().toISOString() };
    sauvegarderIndicateurStocke(maj);
    const nouveauxScripts = scripts.map(s => s.id === id ? maj : s);
    set({
      scriptsIndicateurs: nouveauxScripts,
      ...(id === 'script-luxalgo-smc' ? { afficherLuxAlgoSMC: false } : {}),
      ...(id === 'script-protected-swings' ? { afficherProtectedSwings: false } : {}),
      ...(id === 'script-unmitigated-profile' ? { afficherUnmitigatedProfile: false } : {}),
      ...(id === 'script-zigzag-smc' ? { afficherZigZag: false } : {}),
    });
  },
  sauvegarderScriptIndicateur: (script: IndicatorScript) => {
    sauvegarderIndicateurStocke(script);
    const scripts = get().scriptsIndicateurs.length > 0 ? get().scriptsIndicateurs : recupererIndicateursStockes();
    const index = scripts.findIndex(s => s.id === script.id);
    const nouveauxScripts = index >= 0
      ? scripts.map(s => s.id === script.id ? script : s)
      : [...scripts, script];
    set({
      scriptsIndicateurs: nouveauxScripts,
      ...(script.id === 'script-luxalgo-smc' ? { afficherLuxAlgoSMC: script.visibleSurGraphique } : {}),
      ...(script.id === 'script-protected-swings' ? { afficherProtectedSwings: script.visibleSurGraphique } : {}),
      ...(script.id === 'script-unmitigated-profile' ? { afficherUnmitigatedProfile: script.visibleSurGraphique } : {}),
      ...(script.id === 'script-zigzag-smc' ? { afficherZigZag: script.visibleSurGraphique } : {}),
    });
  },

  // Indicateur LuxAlgo Protected Swings - Rétrocompatibilité
  afficherProtectedSwings: false,
  toggleProtectedSwings: () => {
    const nouveau = !get().afficherProtectedSwings;
    set({ afficherProtectedSwings: nouveau });
    get().toggleVisibiliteScript('script-protected-swings');
  },

  // Indicateur SMC Unmitigated Volume Profile - Rétrocompatibilité
  afficherUnmitigatedProfile: false,
  toggleUnmitigatedProfile: () => {
    const nouveau = !get().afficherUnmitigatedProfile;
    set({ afficherUnmitigatedProfile: nouveau });
    get().toggleVisibiliteScript('script-unmitigated-profile');
  },

  // Indicateur ZigZag Autonome - Rétrocompatibilité
  afficherZigZag: false,
  toggleZigZag: () => {
    const nouveau = !get().afficherZigZag;
    set({ afficherZigZag: nouveau });
    get().toggleVisibiliteScript('script-zigzag-smc');
  },

  // Indicateur LuxAlgo Smart Money Concepts (SMC) - Rétrocompatibilité
  afficherLuxAlgoSMC: false,
  toggleLuxAlgoSMC: () => {
    const nouveau = !get().afficherLuxAlgoSMC;
    set({ afficherLuxAlgoSMC: nouveau });
    get().toggleVisibiliteScript('script-luxalgo-smc');
  },

  // Retirer directement un indicateur du graphique (comme TradingView)
  retirerIndicateur: (indicateur) => {
    console.log(`🗑️ [Backtest Store] Retrait de l'indicateur ${indicateur} du graphique`);
    if (indicateur === 'protectedSwings') {
      set({ afficherProtectedSwings: false });
      get().retirerScriptDuGraphique('script-protected-swings');
    } else if (indicateur === 'unmitigatedProfile') {
      set({ afficherUnmitigatedProfile: false });
      get().retirerScriptDuGraphique('script-unmitigated-profile');
    } else if (indicateur === 'zigzag') {
      set({ afficherZigZag: false });
      get().retirerScriptDuGraphique('script-zigzag-smc');
    } else if (indicateur === 'luxAlgoSMC') {
      set({ afficherLuxAlgoSMC: false });
      get().retirerScriptDuGraphique('script-luxalgo-smc');
    }
  },

  // Options de collecte de données personnalisées par l'utilisateur
  optionsCollecte: {
    protectedSwings: true,
    unmitigatedProfile: true,
    zigzag: true,
    luxAlgoSMC: true,
  },
  setOptionCollecte: (cle, valeur) => {
    console.log(`⚙️ [Backtest Store] Collecte ${cle} : ${valeur ? 'ACTIVÉE' : 'DÉSACTIVÉE'}`);
    set((state) => ({
      optionsCollecte: {
        ...state.optionsCollecte,
        [cle]: valeur,
      },
    }));
  },

  setMacroEvents: (events) => {
    console.log(`📊 [Backtest Store] Importation de ${events.length} événements macroéconomiques.`);
    set({ macroEvents: events });
    get().recalculerSnapshotMacro();
  },

  clearMacroEvents: () => {
    console.log(`🗑️ [Backtest Store] Réinitialisation des événements macro.`);
    set({ macroEvents: [], activeSnapshot: null });
  },

  recalculerSnapshotMacro: () => {
    const { macroEvents, donneesCompletes, indexCourant, paireCloud, fundamentalModeEnabled } = get();
    if (!fundamentalModeEnabled || macroEvents.length === 0 || donneesCompletes.length === 0) {
      set({ activeSnapshot: null });
      return;
    }

    const bougieCourante = donneesCompletes[indexCourant];
    if (!bougieCourante) return;

    let tRef = 0;
    if (typeof bougieCourante.time === 'number') {
      tRef = bougieCourante.time < 10000000000 ? bougieCourante.time * 1000 : bougieCourante.time;
    } else if (typeof bougieCourante.time === 'string') {
      tRef = Date.parse(bougieCourante.time.replace(' ', 'T'));
    }

    if (!tRef || isNaN(tRef)) return;

    const snapshot = computeSnapshotAtTimestamp(macroEvents, paireCloud, tRef);
    set({ activeSnapshot: snapshot });
  },

  // Initialise la session avec de nouvelles données
  // Par défaut, on affiche les 150 premières bougies pour donner du contexte au trader
  chargerDonnees: (donnees, nomActif) => {
    console.log(`🚀 [Backtest Store] Chargement de ${donnees.length} bougies pour ${nomActif}`);
    const indexInitial = donnees.length - 1;
    set({
      actif: nomActif,
      donneesCompletes: donnees,
      indexCourant: indexInitial,
      estEnLecture: false,
      positionActive: null,
      historiqueSimule: [],
    });
    get().recalculerSnapshotMacro();
  },

  // Injecte des données plus anciennes au début de la série (défilement infini vers le passé)
  injecterDonneesPrecedentes: (anciennesDonnees) => {
    const { donneesCompletes, indexCourant, positionActive, historiqueSimule } = get();
    if (anciennesDonnees.length === 0) return;

    console.log(`📥 [Backtest Store] Injection de ${anciennesDonnees.length} anciennes bougies au début.`);
    
    // Concaténer les anciennes données suivies par les données actuelles
    const nouvellesDonnees = [...anciennesDonnees, ...donneesCompletes];
    
    // Décalage nécessaire de tous les index référencés
    const decalage = anciennesDonnees.length;
    const nouvelIndexCourant = indexCourant + decalage;

    let positionMiseAJour = null;
    if (positionActive) {
      positionMiseAJour = {
        ...positionActive,
        indexEntree: positionActive.indexEntree + decalage,
        indexSortie: positionActive.indexSortie !== undefined ? positionActive.indexSortie + decalage : undefined,
      };
    }

    const historiqueMiseAJour = historiqueSimule.map((p) => ({
      ...p,
      indexEntree: p.indexEntree + decalage,
      indexSortie: p.indexSortie !== undefined ? p.indexSortie + decalage : undefined,
    }));

    set({
      donneesCompletes: nouvellesDonnees,
      indexCourant: nouvelIndexCourant,
      positionActive: positionMiseAJour,
      historiqueSimule: historiqueMiseAJour,
    });
  },

  // Met à jour les données pour le changement d'unité de temps (MTF) sans réinitialiser la session
  mettreAJourDonneesMtf: (nouvellesDonnees) => {
    const { donneesCompletes, indexCourant, positionActive, historiqueSimule } = get();
    if (nouvellesDonnees.length === 0) return;

    console.log(`⏱️ [Backtest Store] Changement d'UT (MTF) : recalcul de la position et de l'historique...`);

    // 1. Trouver le timestamp correspondant à l'indexCourant actuel
    const bougieReference = donneesCompletes[indexCourant];
    let timestampRef = bougieReference
      ? (typeof bougieReference.time === 'number' ? bougieReference.time : Date.parse(bougieReference.time as string) / 1000)
      : null;

    // Helper pour trouver le nouvel index correspondant à une date dans les nouvelles données
    const trouverNouvelIndex = (dateRef: string | number | undefined): number | undefined => {
      if (dateRef === undefined) return undefined;
      const tRef = typeof dateRef === 'number' ? dateRef : Date.parse(dateRef) / 1000;
      if (isNaN(tRef)) return undefined;

      // Trouver l'index de la bougie la plus proche <= tRef
      let index = nouvellesDonnees.findIndex((b) => {
        const t = typeof b.time === 'number' ? b.time : Date.parse(b.time as string) / 1000;
        return t > tRef;
      });

      if (index === -1) return nouvellesDonnees.length - 1;
      if (index > 0) return index - 1;
      return 0;
    };

    // 2. Calculer le nouvel indexCourant
    let nouvelIndexCourant = nouvellesDonnees.length - 1;
    if (timestampRef !== null) {
      const idx = trouverNouvelIndex(timestampRef);
      if (idx !== undefined) nouvelIndexCourant = idx;
    }

    // 3. Recalculer les index de la position active
    let positionActiveMiseAJour = null;
    if (positionActive) {
      const nouvelIndexEntree = trouverNouvelIndex(positionActive.dateEntree) ?? positionActive.indexEntree;
      const nouvelIndexSortie = positionActive.dateSortie !== undefined ? trouverNouvelIndex(positionActive.dateSortie) : undefined;
      positionActiveMiseAJour = {
        ...positionActive,
        indexEntree: nouvelIndexEntree,
        indexSortie: nouvelIndexSortie,
      };
    }

    // 4. Recalculer les index de l'historique
    const historiqueMiseAJour = historiqueSimule.map((p) => {
      const nouvelIndexEntree = trouverNouvelIndex(p.dateEntree) ?? p.indexEntree;
      const nouvelIndexSortie = p.dateSortie !== undefined ? trouverNouvelIndex(p.dateSortie) : undefined;
      return {
        ...p,
        indexEntree: nouvelIndexEntree,
        indexSortie: nouvelIndexSortie,
      };
    });

    set({
      donneesCompletes: nouvellesDonnees,
      indexCourant: nouvelIndexCourant,
      positionActive: positionActiveMiseAJour,
      historiqueSimule: historiqueMiseAJour,
    });
  },

  // Fait avancer le replay d'une bougie et vérifie si la position active est touchée (SL/TP)
  avancerBougie: () => {
    const { indexCourant, donneesCompletes, positionActive, historiqueSimule } = get();
    
    // Vérification : reste-t-il des bougies à afficher ?
    if (indexCourant >= donneesCompletes.length - 1) {
      set({ estEnLecture: false });
      return false;
    }

    const prochainIndex = indexCourant + 1;
    const bougie = donneesCompletes[prochainIndex];

    let positionMiseAJour: PositionSimulee | null = positionActive ? { ...positionActive } : null;
    let historiqueMisAJour = [...historiqueSimule];

    // Si une position est ouverte, on vérifie si la bougie actuelle touche l'entrée, le SL ou le TP
    if (positionMiseAJour && !positionMiseAJour.prixSortie) {
      const { direction, stopLoss, takeProfit, prixEntree, estDeclenchee } = positionMiseAJour;
      const { high, low, open } = bougie;

      if (!estDeclenchee) {
        // ── CAS 1 : L'ORDRE EST EN ATTENTE (PENDING / ORDRE LIMITE OU STOP) ──
        // On vérifie si cette nouvelle bougie déclenche l'ordre en touchant ou traversant le prix d'entrée
        const toucheEntree = (low <= prixEntree && high >= prixEntree)
          || (direction === 'long' && open <= prixEntree)
          || (direction === 'short' && open >= prixEntree);

        if (toucheEntree) {
          // L'ordre est déclenché par cette bougie !
          positionMiseAJour.estDeclenchee = true;
          positionMiseAJour.indexDeclenchement = prochainIndex;
          positionMiseAJour.dateDeclenchement = bougie.time;
          console.log(`🔔 [Backtest Store] Ordre ${direction.toUpperCase()} déclenché à ${prixEntree} sur la bougie ${prochainIndex} !`);

          // Vérification si cette même bougie touche aussi le SL ou le TP APRÈS déclenchement
          if (direction === 'long') {
            if (low <= stopLoss) {
              console.log(`❌ [Backtest Store] Stop Loss touché à ${stopLoss} !`);
              positionMiseAJour.prixSortie = stopLoss;
              positionMiseAJour.dateSortie = bougie.time;
              positionMiseAJour.resultat = 'loss';
              positionMiseAJour.pnl = ((stopLoss - prixEntree) / prixEntree) * 100;
            } else if (high >= takeProfit) {
              console.log(`🎯 [Backtest Store] Take Profit touché à ${takeProfit} !`);
              positionMiseAJour.prixSortie = takeProfit;
              positionMiseAJour.dateSortie = bougie.time;
              positionMiseAJour.resultat = 'win';
              positionMiseAJour.pnl = ((takeProfit - prixEntree) / prixEntree) * 100;
            }
          } else {
            // short
            if (high >= stopLoss) {
              console.log(`❌ [Backtest Store] Stop Loss touché à ${stopLoss} !`);
              positionMiseAJour.prixSortie = stopLoss;
              positionMiseAJour.dateSortie = bougie.time;
              positionMiseAJour.resultat = 'loss';
              positionMiseAJour.pnl = ((prixEntree - stopLoss) / prixEntree) * 100;
            } else if (low <= takeProfit) {
              console.log(`🎯 [Backtest Store] Take Profit touché à ${takeProfit} !`);
              positionMiseAJour.prixSortie = takeProfit;
              positionMiseAJour.dateSortie = bougie.time;
              positionMiseAJour.resultat = 'win';
              positionMiseAJour.pnl = ((prixEntree - takeProfit) / prixEntree) * 100;
            }
          }
        } else {
          // L'ordre n'a PAS été touché par cette bougie.
          // Vérification : le prix est-il allé au Take Profit (ou invalidé au SL) sans jamais déclencher l'ordre ?
          if (direction === 'long') {
            if (high >= takeProfit) {
              // Take Profit atteint sans déclenchement -> POSITION MANQUÉE (Missed Trade)
              console.log(`🟡 [Backtest Store] Take Profit atteint à ${takeProfit} sans que l'ordre LONG ne soit déclenché (${prixEntree}) -> Position Manquée !`);
              positionMiseAJour.prixSortie = takeProfit;
              positionMiseAJour.dateSortie = bougie.time;
              positionMiseAJour.resultat = 'missed';
              positionMiseAJour.pnl = 0; // Pas d'impact financier sur une position manquée
            } else if (low <= stopLoss) {
              // Stop Loss / Invalidation atteinte sans déclenchement
              console.log(`🟡 [Backtest Store] Invalidation atteinte sous ${stopLoss} sans que l'ordre ne soit déclenché -> Position Manquée !`);
              positionMiseAJour.prixSortie = stopLoss;
              positionMiseAJour.dateSortie = bougie.time;
              positionMiseAJour.resultat = 'missed';
              positionMiseAJour.pnl = 0;
            }
          } else {
            // short
            if (low <= takeProfit) {
              // Take Profit atteint sans déclenchement -> POSITION MANQUÉE (Missed Trade)
              console.log(`🟡 [Backtest Store] Take Profit atteint à ${takeProfit} sans que l'ordre SHORT ne soit déclenché (${prixEntree}) -> Position Manquée !`);
              positionMiseAJour.prixSortie = takeProfit;
              positionMiseAJour.dateSortie = bougie.time;
              positionMiseAJour.resultat = 'missed';
              positionMiseAJour.pnl = 0;
            } else if (high >= stopLoss) {
              console.log(`🟡 [Backtest Store] Invalidation atteinte au-dessus de ${stopLoss} sans que l'ordre ne soit déclenché -> Position Manquée !`);
              positionMiseAJour.prixSortie = stopLoss;
              positionMiseAJour.dateSortie = bougie.time;
              positionMiseAJour.resultat = 'missed';
              positionMiseAJour.pnl = 0;
            }
          }
        }
      } else {
        // ── CAS 2 : L'ORDRE ÉTAIT DÉJÀ DÉCLENCHÉ ──
        if (direction === 'long') {
          // 1. Touche le Stop Loss
          if (low <= stopLoss) {
            console.log(`❌ [Backtest Store] Stop Loss touché à ${stopLoss} !`);
            positionMiseAJour.prixSortie = stopLoss;
            positionMiseAJour.dateSortie = bougie.time;
            positionMiseAJour.resultat = 'loss';
            positionMiseAJour.pnl = ((stopLoss - prixEntree) / prixEntree) * 100;
          }
          // 2. Touche le Take Profit (si le SL n'a pas été touché d'abord)
          else if (high >= takeProfit) {
            console.log(`🎯 [Backtest Store] Take Profit touché à ${takeProfit} !`);
            positionMiseAJour.prixSortie = takeProfit;
            positionMiseAJour.dateSortie = bougie.time;
            positionMiseAJour.resultat = 'win';
            positionMiseAJour.pnl = ((takeProfit - prixEntree) / prixEntree) * 100;
          }
        } else {
          // Scénario SHORT :
          // 1. Touche le Stop Loss (hausse du prix)
          if (high >= stopLoss) {
            console.log(`❌ [Backtest Store] Stop Loss touché à ${stopLoss} !`);
            positionMiseAJour.prixSortie = stopLoss;
            positionMiseAJour.dateSortie = bougie.time;
            positionMiseAJour.resultat = 'loss';
            positionMiseAJour.pnl = ((prixEntree - stopLoss) / prixEntree) * 100;
          }
          // 2. Touche le Take Profit (baisse du prix)
          else if (low <= takeProfit) {
            console.log(`🎯 [Backtest Store] Take Profit touché à ${takeProfit} !`);
            positionMiseAJour.prixSortie = takeProfit;
            positionMiseAJour.dateSortie = bougie.time;
            positionMiseAJour.resultat = 'win';
            positionMiseAJour.pnl = ((prixEntree - takeProfit) / prixEntree) * 100;
          }
        }
      }

      // Si le trade s'est fermé sur cette bougie, on calcule la durée réelle et on le passe en mode clôturé
      if (positionMiseAJour.prixSortie !== undefined) {
        if (positionMiseAJour.resultat !== 'missed' && Math.abs(positionMiseAJour.pnl || 0) < 0.05) {
          positionMiseAJour.resultat = 'breakeven';
        }
        // Calcul automatique de la durée réelle en bougies
        positionMiseAJour.indexSortie = prochainIndex;
        positionMiseAJour.dureeReelleBougies = prochainIndex - positionMiseAJour.indexEntree;
        positionMiseAJour.estCloturee = true;
        
        // On stoppe le Replay automatiquement pour donner le temps de valider la fermeture
        set({ estEnLecture: false });
        console.log(`⏱️ [Backtest Store] Replay mis en pause automatique car la position active a été fermée (${positionMiseAJour.resultat}).`);
      }
    }

    set({
      indexCourant: prochainIndex,
      positionActive: positionMiseAJour,
    });
    get().recalculerSnapshotMacro();
    return true;
  },

  // Recule le replay d'une bougie et rouvre le trade s'il a été clôturé après
  reculerBougie: () => {
    const { indexCourant, positionActive } = get();
    if (indexCourant <= 0) return false;

    const precedentIndex = indexCourant - 1;
    let positionMiseAJour = positionActive ? { ...positionActive } : null;

    // Si le trade s'est fermé après (indexSortie > precedentIndex), on le réouvre
    if (positionMiseAJour && positionMiseAJour.indexSortie !== undefined && positionMiseAJour.indexSortie > precedentIndex) {
      positionMiseAJour.prixSortie = undefined;
      positionMiseAJour.dateSortie = undefined;
      positionMiseAJour.indexSortie = undefined;
      positionMiseAJour.dureeReelleBougies = undefined;
      positionMiseAJour.resultat = undefined;
      positionMiseAJour.pnl = undefined;
      positionMiseAJour.estCloturee = false;
      console.log("🔓 [Backtest Store] Réouverture de la position active (retour dans le passé).");
    }

    // Si l'ordre avait été déclenché sur une bougie postérieure, il redevient en attente
    if (positionMiseAJour && positionMiseAJour.indexDeclenchement !== undefined && positionMiseAJour.indexDeclenchement > precedentIndex) {
      positionMiseAJour.estDeclenchee = false;
      positionMiseAJour.indexDeclenchement = undefined;
      positionMiseAJour.dateDeclenchement = undefined;
      console.log("⏳ [Backtest Store] L'ordre redevient en attente (retour arrière).");
    }

    set({
      indexCourant: precedentIndex,
      positionActive: positionMiseAJour,
    });
    get().recalculerSnapshotMacro();
    return true;
  },


  // Revient à l'état initial (les 150 premières bougies) pour recommencer
  revenirDebut: () => {
    const { donneesCompletes } = get();
    if (donneesCompletes.length === 0) return;
    
    set({
      indexCourant: donneesCompletes.length - 1,
      estEnLecture: false,
      positionActive: null,
      historiqueSimule: [],
    });
  },

  setEstEnLecture: (val) => set({ estEnLecture: val }),
  setVitesseLecture: (ms) => set({ vitesseLecture: ms }),

  // Setters pour mémoriser les paramètres de chargement (paire, année, timeframe)
  // Ces valeurs sont persistées pour savoir quoi recharger si les données sont perdues
  setPaireCloud: (paire) => set({ paireCloud: paire }),
  setAnneeCloud: (annee) => set({ anneeCloud: annee }),
  setTimeframeSauvegarde: (tf) => set({ timeframeSauvegarde: tf }),

  ouvrirPosition: (direction, prixEntree, stopLoss, takeProfit, dureeEstimeeHeures, dureeEstimeeBougies, dureeEstimeeLargeur, protectedSwingsSnapshot, unmitigatedProfileSnapshot, zigzagSnapshot, smcSnapshot) => {
    const { donneesCompletes, indexCourant, positionActive, optionsCollecte } = get();
    if (positionActive) {
      console.warn('⚠️ [Backtest Store] Une position est déjà ouverte.');
      return;
    }

    const bougieActuelle = donneesCompletes[indexCourant];
    if (!bougieActuelle) return;

    // Détermine si l'ordre est exécuté immédiatement (au marché) ou placé en attente (ordre limite/stop)
    // Tolérance d'entrée au marché : si l'écart relatif est inférieur à 0.01% (ou 0.0001)
    const tolerance = Math.max(0.0001, bougieActuelle.close * 0.0001);
    const estAuMarche = Math.abs(prixEntree - bougieActuelle.close) <= tolerance;

    const nouvellePosition: PositionSimulee = {
      direction,
      prixEntree,
      stopLoss,
      takeProfit,
      dateEntree: bougieActuelle.time,
      indexEntree: indexCourant,
      dureeEstimeeHeures,
      dureeEstimeeBougies,
      dureeEstimeeLargeur: dureeEstimeeLargeur || 30, // Largeur par défaut de 30 bougies
      // Statut de déclenchement : actif immédiatement si au marché, sinon en attente d'être touché
      estDeclenchee: estAuMarche,
      indexDeclenchement: estAuMarche ? indexCourant : undefined,
      dateDeclenchement: estAuMarche ? bougieActuelle.time : undefined,
      // Enregistre uniquement si l'utilisateur a explicitement activé la collecte pour cet indicateur
      protectedSwingsSnapshot: optionsCollecte.protectedSwings ? protectedSwingsSnapshot : undefined,
      unmitigatedProfileSnapshot: optionsCollecte.unmitigatedProfile ? unmitigatedProfileSnapshot : undefined,
      zigzagSnapshot: optionsCollecte.zigzag ? zigzagSnapshot : undefined,
      smcSnapshot: optionsCollecte.luxAlgoSMC ? smcSnapshot : undefined,
    };

    if (estAuMarche) {
      console.log(`📈 [Backtest Store] Ouverture immédiate d'une position ${direction} au marché à ${prixEntree}`);
    } else {
      console.log(`⏳ [Backtest Store] Placement d'un ordre ${direction} en attente (Limit/Stop) à ${prixEntree} (Prix marché: ${bougieActuelle.close})`);
    }

    set({ positionActive: nouvellePosition });
  },

  modifierPositionActive: (updates) => {
    const { positionActive } = get();
    if (!positionActive) return;
    set({
      positionActive: {
        ...positionActive,
        ...updates
      }
    });
  },

  // Fermeture manuelle de la position au prix actuel du marché
  fermerPositionManuellement: () => {
    const { positionActive, donneesCompletes, indexCourant } = get();
    if (!positionActive) return;

    const bougieActuelle = donneesCompletes[indexCourant];
    const prixSortie = bougieActuelle.close;

    // Si la position n'était pas déclenchée, fermer manuellement revient à annuler l'ordre non déclenché (Missed)
    const etaitDeclenchee = positionActive.estDeclenchee ?? true;
    const pnlCalculé = etaitDeclenchee
      ? (positionActive.direction === 'long'
        ? ((prixSortie - positionActive.prixEntree) / positionActive.prixEntree) * 100
        : ((positionActive.prixEntree - prixSortie) / positionActive.prixEntree) * 100)
      : 0;

    const resultatCalcule = !etaitDeclenchee
      ? 'missed'
      : pnlCalculé > 0.05
        ? 'win'
        : pnlCalculé < -0.05
          ? 'loss'
          : 'breakeven';

    const positionCloturee: PositionSimulee = {
      ...positionActive,
      prixSortie,
      dateSortie: bougieActuelle.time,
      indexSortie: indexCourant,
      dureeReelleBougies: indexCourant - positionActive.indexEntree,
      pnl: pnlCalculé,
      resultat: resultatCalcule,
      estCloturee: true,
    };

    console.log(`🔒 [Backtest Store] Fermeture manuelle de la position à ${prixSortie} (Résultat: ${resultatCalcule})`);
    set({
      positionActive: positionCloturee,
    });
  },

  // Archive la position active clôturée dans l'historique et libère le store
  archiverPositionActive: () => {
    const { positionActive, historiqueSimule } = get();
    if (!positionActive) return;

    console.log("💾 [Backtest Store] Archivage du trade dans l'historique de session.");
    set({
      positionActive: null,
      historiqueSimule: [...historiqueSimule, positionActive],
    });
  },

  // Annule/Supprime simplement la position active (non enregistrée)
  annulerPositionActive: () => {
    console.log("🗑️ [Backtest Store] Annulation de la position active.");
    set({
      positionActive: null,
    });
  },

  supprimerTradeHistorique: (index) => {
    set((state) => ({
      historiqueSimule: state.historiqueSimule.filter((_, i) => i !== index),
    }));
  },

  reinitialiserSession: () => {
    set({
      actif: 'Aucun actif',
      donneesCompletes: [],
      indexCourant: 0,
      estEnLecture: false,
      positionActive: null,
      historiqueSimule: [],
    });
  },

  // Repositionne le début du replay à un index donné, nettoyant la session en cours
  // Utilisé par le graphique au scroll ou par les clics utilisateurs
  couperReplayAIndex: (index) => {
    const { donneesCompletes } = get();
    const indexValide = Math.max(0, Math.min(index, donneesCompletes.length - 1));
    console.log(`✂️ [Backtest Store] Replay positionné à la bougie index ${indexValide}`);
    set({
      indexCourant: indexValide,
      estEnLecture: false,
      positionActive: null,
      historiqueSimule: [],
    });
  },

  nettoyerRestaurationContexte: () => {
    set({ contexteRestauration: null });
  },

  // Prépare le contexte pour recharger le backtest à un instant précis
  // Exemple d'utilisation : lancerRestaurationContexte({ pair: 'EURUSD', annee: '2025', timeframe: 'H1', timestamp: 1720000000, position: { ... } })
  lancerRestaurationContexte: (contexte) => {
    console.log("🎯 [Backtest Store] Lancement de la restauration de replay pour le trade :", contexte);
    set({
      contexteRestauration: contexte,
      estEnLecture: false,
    });
  }
}
),
{
  // Clé unique dans le sessionStorage du navigateur
  // sessionStorage : survit aux navigations SPA et aux rechargements (F5), mais pas à la fermeture de l'onglet
  name: 'backtest-session',
  storage: createJSONStorage(() => sessionStorage),

  // EXCLURE donneesCompletes de la persistance : potentiellement des MB de données
  // qui dépasseraient la limite du sessionStorage (5-10 MB)
  // Ces données sont rechargées automatiquement via paireCloud + anneeCloud
  partialize: (state) => ({
    actif: state.actif,
    indexCourant: state.indexCourant,
    vitesseLecture: state.vitesseLecture,
    positionActive: state.positionActive,
    historiqueSimule: state.historiqueSimule,
    paireCloud: state.paireCloud,
    anneeCloud: state.anneeCloud,
    timeframeSauvegarde: state.timeframeSauvegarde,
    journalDest: state.journalDest,
    contexteRestauration: state.contexteRestauration,
    fundamentalModeEnabled: state.fundamentalModeEnabled,
    macroEvents: state.macroEvents,
    afficherProtectedSwings: state.afficherProtectedSwings,
    afficherUnmitigatedProfile: state.afficherUnmitigatedProfile,
    afficherZigZag: state.afficherZigZag,
    afficherLuxAlgoSMC: state.afficherLuxAlgoSMC,
    optionsCollecte: state.optionsCollecte,
    // donneesCompletes : volontairement EXCLU
  }),
}
  )
);
