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
}

interface OfflineSyncState {
  queue: QueuedTrade[];
  ajouterALaFile: (payload: Omit<QueuedTrade, 'id' | 'date'>) => void;
  retirerDeLaFile: (id: string) => void;
  viderLaFile: () => void;
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

      // Ajoute un trade dans la file d'attente
      ajouterALaFile: (payload) => {
        const nouveauTrade = {
          id: crypto.randomUUID(),
          ...payload,
          date: new Date().toISOString(),
        };
        console.log(`📦 [Offline] Action ${payload.action} ajoutée à la file d'attente (Trade: ${payload.tradeId})`);
        set((state) => ({ queue: [...state.queue, nouveauTrade] }));
      },

      // Retire un trade de la file une fois qu'il est synchronisé
      retirerDeLaFile: (id) => {
        set((state) => ({ queue: state.queue.filter((t) => t.id !== id) }));
      },

      viderLaFile: () => set({ queue: [] }),
    }),
    {
      name: 'trading-journal-offline-queue',
      storage: createJSONStorage(() => storage),
    }
  )
);
