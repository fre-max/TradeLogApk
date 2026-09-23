import { create } from 'zustand';
import { persist, StateStorage, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import type { TradeWithSteps, Strategy, ReasonFamily, ReasonCatalogItem } from '@/types';

// Adapteur IndexedDB pour Zustand
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

interface LocalDatabaseState {
  trades: TradeWithSteps[];
  strategies: Strategy[];
  reasonFamilies: ReasonFamily[];
  catalogItems: ReasonCatalogItem[];

  setTrades: (trades: TradeWithSteps[]) => void;
  addTrade: (trade: TradeWithSteps) => void;
  updateTrade: (id: string, trade: Partial<TradeWithSteps>) => void;
  deleteTrade: (id: string) => void;

  setStrategies: (strategies: Strategy[]) => void;
  setReasonFamilies: (reasonFamilies: ReasonFamily[]) => void;
  setCatalogItems: (catalogItems: ReasonCatalogItem[]) => void;

  clearDatabase: () => void;
}

export const useLocalDatabase = create<LocalDatabaseState>()(
  persist(
    (setZustand) => ({
      trades: [],
      strategies: [],
      reasonFamilies: [],
      catalogItems: [],

      setTrades: (trades) => setZustand({ trades }),
      // Ajoute ou remplace le trade sans jamais créer de doublon par identifiant (idempotence)
      addTrade: (trade) =>
        setZustand((state) => ({
          trades: [trade, ...state.trades.filter((t) => t.id !== trade.id)],
        })),
      updateTrade: (id, updatedFields) =>
        setZustand((state) => ({
          trades: state.trades.map((t) => (t.id === id ? { ...t, ...updatedFields } : t)),
        })),
      deleteTrade: (id) =>
        setZustand((state) => ({ trades: state.trades.filter((t) => t.id !== id) })),

      setStrategies: (strategies) => setZustand({ strategies }),
      setReasonFamilies: (reasonFamilies) => setZustand({ reasonFamilies }),
      setCatalogItems: (catalogItems) => setZustand({ catalogItems }),

      clearDatabase: () => setZustand({ trades: [], strategies: [], reasonFamilies: [], catalogItems: [] }),
    }),
    {
      name: 'trading-journal-local-db',
      storage: createJSONStorage(() => storage),
    }
  )
);
