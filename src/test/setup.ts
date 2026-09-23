// Intègre les assertions DOM de testing-library directement dans Vitest
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Simulation (Mock) en mémoire de la base IndexedDB (idb-keyval) pour les tests unitaires
const fauxStockage = new Map<string, any>();

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => fauxStockage.get(key) || null),
  set: vi.fn(async (key: string, value: any) => {
    fauxStockage.set(key, value);
  }),
  del: vi.fn(async (key: string) => {
    fauxStockage.delete(key);
  }),
  clear: vi.fn(async () => {
    fauxStockage.clear();
  }),
}));
