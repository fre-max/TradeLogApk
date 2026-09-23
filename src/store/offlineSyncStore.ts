import { create } from 'zustand';
import { persist, StateStorage, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';

export type SyncActionType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface QueuedTrade {
  id: string; // UUID généré localement pour l'élément de la file
  tradeId: string; // ID réel du trade
  action: SyncActionType;
  tradeData?: any; // Les données du trade (pour INSERT/UPDATE)
  steps?: any[]; // Les étapes
  reasons?: any[]; // Les raisons techniques
  images?: any[]; // Les images
  date: string;
  tentatives?: number; // Nombre d'essais pour éviter les blocages infinis
}

interface OfflineSyncState {
  queue: QueuedTrade[];

  // Date ISO de la dernière synchronisation réussie (utilisée par le badge Cloud)
  derniereSynchroReussie: string | null;

  // Indique si une synchronisation est en cours (NON persisté pour ne jamais bloquer l'UI au démarrage)
  syncEnCours: boolean;

  ajouterALaFile: (payload: Omit<QueuedTrade, 'id' | 'date'>) => void;
  retirerDeLaFile: (id: string) => void;
  incrementerTentative: (id: string) => void;
  viderLaFile: () => void;
  setDerniereSynchroReussie: (date: string) => void;
  setSyncEnCours: (enCours: boolean) => void;
}

// Adaptateur IndexedDB asynchrone pour éviter tout freeze du thread UI synchrone
const storage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

/**
 * Store Zustand pour gérer la file d'attente des trades pris en mode hors-ligne.
 * Utilise IndexedDB (via idb-keyval) pour stocker les données sans bloquer le thread principal.
 */
export const useOfflineSyncStore = create<OfflineSyncState>()(
  persist(
    (set) => ({
      queue: [],

      // Initialement null — sera renseigné après la première sync réussie
      derniereSynchroReussie: null,

      // Toujours false au démarrage pour éviter un blocage persistant si l'app a été fermée pendant une sync
      syncEnCours: false,

      // Ajoute un trade dans la file d'attente
      ajouterALaFile: (payload) => {
        const nouveauTrade: QueuedTrade = {
          id: crypto.randomUUID(),
          ...payload,
          date: new Date().toISOString(),
          tentatives: 0,
        };
        console.log(`📦 [Offline] Action ${payload.action} ajoutée à la file d'attente (Trade: ${payload.tradeId})`);
        set((state) => ({ queue: [...state.queue, nouveauTrade] }));
      },

      // Retire un trade de la file une fois qu'il est synchronisé
      retirerDeLaFile: (id) => {
        set((state) => ({ queue: state.queue.filter((t) => t.id !== id) }));
      },

      // Incrémente le compteur d'échec pour un élément
      incrementerTentative: (id) => {
        set((state) => ({
          queue: state.queue.map((t) =>
            t.id === id ? { ...t, tentatives: (t.tentatives || 0) + 1 } : t
          ),
        }));
      },

      viderLaFile: () => set({ queue: [] }),

      // Enregistre la date/heure de la dernière synchronisation réussie
      setDerniereSynchroReussie: (date) => set({ derniereSynchroReussie: date }),

      // Active / désactive l'indicateur de chargement du badge
      setSyncEnCours: (enCours) => set({ syncEnCours: enCours }),
    }),
    {
      name: 'trading-journal-offline-queue',
      storage: createJSONStorage(() => storage),
      // ⚠️ IMPORTANT : On ne persiste QUE la queue et la dernière date.
      // syncEnCours ne doit JAMAIS être persisté sur disque pour éviter un chargement infini au redémarrage !
      partialize: (state) => ({
        queue: state.queue,
        derniereSynchroReussie: state.derniereSynchroReussie,
      }),
    }
  )
);

