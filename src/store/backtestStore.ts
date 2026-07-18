import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Bougie } from '@/lib/chartDataHelper'

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
  resultat?: 'win' | 'loss' | 'breakeven';
  pnl?: number;
  tradeIdSupabase?: string;       // L'ID du trade associé dans Supabase (étapes 1 et 2)
  stepIdsSupabase?: {             // Les IDs des étapes associées dans Supabase
    biais: string;
    poi: string;
    entry: string;
    result: string;
  };
  planificationEnregistree?: boolean; // Indique si la planification (étape 1) a été sauvée
  estCloturee?: boolean;          // Indique si le replay ou l'utilisateur a fermé la position
}

interface BacktestState {
  // Informations de session
  actif: string;
  donneesCompletes: Bougie[];
  indexCourant: number; // L'index de la dernière bougie visible sur le graphique

  // Paramètres de la source de données (utiles pour recharger après navigation)
  paireCloud: string;    // Ex: 'EURUSD', 'GBPUSD'...
  anneeCloud: string;    // Ex: '2024', '2025'...
  timeframeSauvegarde: string; // Ex: 'H1', 'H4', 'D1'...

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
  ouvrirPosition: (
    direction: 'long' | 'short',
    prixEntree: number,
    stopLoss: number,
    takeProfit: number,
    dureeEstimeeHeures?: number,
    dureeEstimeeBougies?: number,
    dureeEstimeeLargeur?: number
  ) => void;
  modifierPositionActive: (updates: Partial<PositionSimulee>) => void;
  fermerPositionManuellement: () => void;
  archiverPositionActive: () => void;
  annulerPositionActive: () => void;
  supprimerTradeHistorique: (index: number) => void;
  reinitialiserSession: () => void;
  nettoyerRestaurationContexte: () => void;
  lancerRestaurationContexte: (contexte: { pair: string; annee: string; timeframe: string; timestamp: number }) => void;
  couperReplayAIndex: (index: number) => void;
  injecterDonneesPrecedentes: (anciennesDonnees: Bougie[]) => void;
  mettreAJourDonneesMtf: (nouvellesDonnees: Bougie[]) => void;
  contexteRestauration: { pair: string; annee: string; timeframe: string; timestamp: number } | null;
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
  indexCourant: 0,
  estEnLecture: false,
  vitesseLecture: 1000, // Par défaut : 1 bougie par seconde
  positionActive: null,
  historiqueSimule: [],

  // Paramètres de la source pour le rechargement automatique
  paireCloud: 'EURUSD',
  anneeCloud: '2025',
  timeframeSauvegarde: 'H1',

  // Contexte de restauration de replay (clic depuis le journal)
  contexteRestauration: null as { pair: string; annee: string; timeframe: string; timestamp: number } | null,

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

    // Si une position est ouverte, on vérifie si la bougie actuelle touche le SL ou le TP
    if (positionMiseAJour && !positionMiseAJour.prixSortie) {
      const { direction, stopLoss, takeProfit, prixEntree } = positionMiseAJour;
      const { high, low } = bougie;

      if (direction === 'long') {
        // Scénario LONG :
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

      // Si le trade s'est fermé sur cette bougie, on calcule la durée réelle et on le passe en mode clôturé
      if (positionMiseAJour.prixSortie) {
        if (Math.abs(positionMiseAJour.pnl || 0) < 0.05) {
          positionMiseAJour.resultat = 'breakeven';
        }
        // Calcul automatique de la durée réelle en bougies
        positionMiseAJour.indexSortie = prochainIndex;
        positionMiseAJour.dureeReelleBougies = prochainIndex - positionMiseAJour.indexEntree;
        positionMiseAJour.estCloturee = true;
        
        // On stoppe le Replay automatiquement pour donner le temps de valider la fermeture
        set({ estEnLecture: false });
        console.log("⏱️ [Backtest Store] Replay mis en pause automatique car la position active a été touchée.");
      }
    }

    set({
      indexCourant: prochainIndex,
      positionActive: positionMiseAJour,
    });
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

    set({
      indexCourant: precedentIndex,
      positionActive: positionMiseAJour,
    });
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

  ouvrirPosition: (direction, prixEntree, stopLoss, takeProfit, dureeEstimeeHeures, dureeEstimeeBougies, dureeEstimeeLargeur) => {
    const { donneesCompletes, indexCourant, positionActive } = get();
    if (positionActive) {
      console.warn('⚠️ [Backtest Store] Une position est déjà ouverte.');
      return;
    }

    const bougieActuelle = donneesCompletes[indexCourant];
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
    };

    console.log(`📈 [Backtest Store] Ouverture d'une position ${direction} à ${prixEntree}`);
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

    const pnlCalculé = positionActive.direction === 'long' 
      ? ((prixSortie - positionActive.prixEntree) / positionActive.prixEntree) * 100
      : ((positionActive.prixEntree - prixSortie) / positionActive.prixEntree) * 100;

    const positionCloturee: PositionSimulee = {
      ...positionActive,
      prixSortie,
      dateSortie: bougieActuelle.time,
      indexSortie: indexCourant,
      dureeReelleBougies: indexCourant - positionActive.indexEntree,
      pnl: pnlCalculé,
      resultat: pnlCalculé > 0.05 
        ? 'win' 
        : pnlCalculé < -0.05 
          ? 'loss' 
          : 'breakeven',
      estCloturee: true,
    };

    console.log(`🔒 [Backtest Store] Fermeture manuelle de la position à ${prixSortie}`);
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
  // Exemple d'utilisation : lancerRestaurationContexte({ pair: 'EURUSD', annee: '2025', timeframe: 'H1', timestamp: 1720000000 })
  lancerRestaurationContexte: (contexte) => {
    set({
      contexteRestauration: contexte,
      // Réinitialise la session active pour éviter les conflits,
      // mais on va recharger les nouvelles données à l'UT voulue
      positionActive: null,
      historiqueSimule: [],
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
    contexteRestauration: state.contexteRestauration,
    // donneesCompletes : volontairement EXCLU
  }),
}
  )
);
