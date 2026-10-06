import { create } from 'zustand';
import type { FicheSetupSonde, SyntheseStatistiqueSetups } from '@/lib/bot/laboratoire/types';
import { calculerSyntheseSetups } from '@/lib/bot/laboratoire/sondeurSetup';

const CLE_STORAGE_LABORATOIRE = 'tradelog_laboratoire_setups_v1';

export interface TradeActifReplay {
  id: string;
  titre?: string;
  noteQualite?: 'A+' | 'A' | 'B';
  setupName?: string;
  pair?: string;
}

interface LaboratoireState {
  // Liste de tous les setups enregistrés
  setups: FicheSetupSonde[];
  // Setup en cours de visualisation ou d'ajustement dans l'inspecteur
  setupEnCoursInspection: FicheSetupSonde | null;
  // Visibilité du modal inspecteur
  inspecteurOuvert: boolean;
  // Visibilité du modal de la banque globale de setups
  banqueOuverte: boolean;

  // Trade actif rejoué depuis le Journal (pour pré-remplir la sonde)
  contexteTradeActif: TradeActifReplay | null;

  // Filtres de la Banque de Setups
  filtreNoteQualite: 'TOUS' | 'A+' | 'A' | 'B';
  filtreDirection: 'TOUS' | 'ACHAT' | 'VENTE';
  filtrePaire: string; // 'TOUTES' ou code de paire (EURUSD, etc.)
  rechercheTitre: string;

  // Actions
  ouvrirInspecteur: (setup: FicheSetupSonde) => void;
  fermerInspecteur: () => void;
  ouvrirBanque: () => void;
  fermerBanque: () => void;
  definirTradeActif: (info: TradeActifReplay | null) => void;
  sauvegarderSetup: (setup: FicheSetupSonde) => void;
  supprimerSetup: (id: string) => void;
  reinitialiserBanque: () => void;
  obtenirSynthese: (setupsSpecifiques?: FicheSetupSonde[]) => SyntheseStatistiqueSetups;

  // Actions de filtrage
  definirFiltreNoteQualite: (note: 'TOUS' | 'A+' | 'A' | 'B') => void;
  definirFiltreDirection: (dir: 'TOUS' | 'ACHAT' | 'VENTE') => void;
  definirFiltrePaire: (paire: string) => void;
  definirRechercheTitre: (recherche: string) => void;
  reinitialiserFiltres: () => void;
}

function chargerSetupsStockes(): FicheSetupSonde[] {
  try {
    const raw = localStorage.getItem(CLE_STORAGE_LABORATOIRE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('⚠️ [LaboratoireStore] Impossible de lire les setups locaux :', err);
    return [];
  }
}

function enregistrerSetupsStockes(setups: FicheSetupSonde[]): void {
  try {
    localStorage.setItem(CLE_STORAGE_LABORATOIRE, JSON.stringify(setups));
  } catch (err) {
    console.error('❌ [LaboratoireStore] Erreur lors de la sauvegarde :', err);
  }
}

export const useLaboratoireStore = create<LaboratoireState>((set, get) => ({
  setups: chargerSetupsStockes(),
  setupEnCoursInspection: null,
  inspecteurOuvert: false,
  banqueOuverte: false,
  contexteTradeActif: null,

  // Filtres par défaut
  filtreNoteQualite: 'TOUS',
  filtreDirection: 'TOUS',
  filtrePaire: 'TOUTES',
  rechercheTitre: '',

  ouvrirInspecteur: (setup) => {
    set({ setupEnCoursInspection: setup, inspecteurOuvert: true });
  },

  fermerInspecteur: () => {
    set({ inspecteurOuvert: false, setupEnCoursInspection: null });
  },

  ouvrirBanque: () => {
    set({ banqueOuverte: true });
  },

  fermerBanque: () => {
    set({ banqueOuverte: false });
  },

  definirTradeActif: (info) => {
    console.log('🎯 [LaboratoireStore] Contexte de trade actif défini pour la sonde :', info);
    set({ contexteTradeActif: info });
  },

  sauvegarderSetup: (setup) => {
    const actuels = get().setups;
    const indexExistant = actuels.findIndex((s) => s.id === setup.id);
    let nouveaux: FicheSetupSonde[];

    if (indexExistant >= 0) {
      nouveaux = [...actuels];
      nouveaux[indexExistant] = setup;
    } else {
      nouveaux = [setup, ...actuels];
    }

    enregistrerSetupsStockes(nouveaux);
    set({ setups: nouveaux, inspecteurOuvert: false, setupEnCoursInspection: null });
  },

  supprimerSetup: (id) => {
    const filtres = get().setups.filter((s) => s.id !== id);
    enregistrerSetupsStockes(filtres);
    set({ setups: filtres });
  },

  reinitialiserBanque: () => {
    enregistrerSetupsStockes([]);
    set({ setups: [] });
  },

  obtenirSynthese: (setupsSpecifiques) => {
    const liste = setupsSpecifiques ?? get().setups;
    return calculerSyntheseSetups(liste);
  },

  definirFiltreNoteQualite: (note) => set({ filtreNoteQualite: note }),
  definirFiltreDirection: (dir) => set({ filtreDirection: dir }),
  definirFiltrePaire: (paire) => set({ filtrePaire: paire }),
  definirRechercheTitre: (recherche) => set({ rechercheTitre: recherche }),
  reinitialiserFiltres: () => set({
    filtreNoteQualite: 'TOUS',
    filtreDirection: 'TOUS',
    filtrePaire: 'TOUTES',
    rechercheTitre: '',
  }),
}));
