import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOfflineSyncManager } from '@/hooks/useOfflineSyncManager';
import { useOfflineSyncStore } from '@/store/offlineSyncStore';
import { useLocalDatabase } from '@/store/useLocalDatabase';
import { useTrades } from '@/hooks/useTrades';
import { supabase } from '@/lib/supabase';
import type { TradeWithSteps } from '@/types';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
    },
    from: vi.fn(),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  },
}));

// Mock React Query
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

describe('useOfflineSyncManager - Flux de synchronisation Offline-First', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Réinitialiser les stores Zustand
    useOfflineSyncStore.getState().viderLaFile();
    useLocalDatabase.getState().clearDatabase();

    // Mock session par défaut connectée
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: { id: 'test-user-uuid-999', email: 'trader@example.com' },
          access_token: 'fake-token',
        } as any,
      },
      error: null,
    });
  });

  it('affiche immédiatement les trades créés hors-ligne via useTrades', () => {
    // 1. Ajouter un trade en local
    const tradeOffline: TradeWithSteps = {
      id: 'trade-local-1',
      user_id: 'local-user',
      pair: 'XAUUSD',
      direction: 'long',
      session: 'London',
      date_backtested: '2026-03-01',
      entry_time: '09:00',
      exit_time: '10:00',
      status: 'in_progress',
      journal_type: 'global',
      created_at: new Date().toISOString(),
      steps: [],
    };

    useLocalDatabase.getState().addTrade(tradeOffline);

    // 2. Le hook useTrades doit retourner immédiatement le trade
    const { result } = renderHook(() => useTrades());
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].pair).toBe('XAUUSD');
    expect(result.current.data[0].id).toBe('trade-local-1');
  });

  it('fusionne de manière non-destructive les trades locaux et Cloud lors de syncAll', async () => {
    // 1. Trade local créé hors-ligne
    const tradeLocal: TradeWithSteps = {
      id: 'trade-offline-abc',
      user_id: 'test-user-uuid-999',
      pair: 'EURUSD',
      direction: 'short',
      session: 'NY',
      date_backtested: '2026-03-02',
      status: 'in_progress',
      journal_type: 'global',
      created_at: '2026-03-02T10:00:00.000Z',
      steps: [],
    };

    useLocalDatabase.getState().addTrade(tradeLocal);

    // 2. Mock de Supabase pour retourner les données Cloud lors du syncAll
    // Note : le Cloud a un autre trade 'trade-cloud-xyz'
    const tradeCloud: TradeWithSteps = {
      id: 'trade-cloud-xyz',
      user_id: 'test-user-uuid-999',
      pair: 'GBPUSD',
      direction: 'long',
      session: 'Asian',
      date_backtested: '2026-03-01',
      status: 'complete',
      journal_type: 'global',
      created_at: '2026-03-01T08:00:00.000Z',
      steps: [],
    };

    const mockSelectTrades = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [tradeCloud],
          error: null,
        }),
      }),
    });

    const mockSelectGeneric = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'trades') {
        return {
          select: mockSelectTrades,
          upsert: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      }
      return {
        select: mockSelectGeneric,
      } as any;
    });

    // 3. Exécuter syncAll
    const { result } = renderHook(() => useOfflineSyncManager());

    await act(async () => {
      await result.current.syncAll();
    });

    // 4. Vérifier que la base locale contient à la fois le trade local ET le trade Cloud !
    const tradesFinaux = useLocalDatabase.getState().trades;
    expect(tradesFinaux).toHaveLength(2);

    const ids = tradesFinaux.map((t) => t.id);
    expect(ids).toContain('trade-offline-abc'); // Le trade local n'a PAS été écrasé !
    expect(ids).toContain('trade-cloud-xyz');   // Le trade Cloud a bien été ajouté !
  });

  it('nettoie les données et met à jour user_id lors de synchroniserFileDAttente', async () => {
    // 1. Ajouter un trade hors-ligne avec user_id 'local-user' et un strategy_id vide
    const tradeId = 'trade-dirty-1';
    useLocalDatabase.getState().addTrade({
      id: tradeId,
      user_id: 'local-user',
      pair: 'BTCUSD',
      direction: 'long',
      session: 'Asian',
      date_backtested: '2026-03-03',
      status: 'in_progress',
      journal_type: 'global',
      created_at: new Date().toISOString(),
      steps: [],
    });

    useOfflineSyncStore.getState().ajouterALaFile({
      tradeId,
      action: 'INSERT',
      tradeData: {
        id: tradeId,
        user_id: 'local-user',
        strategy_id: '', // Chaîne vide qui ferait planter PostgreSQL si non nettoyée
        pair: 'BTCUSD',
        direction: 'long',
        session: 'Asian',
        date_backtested: '2026-03-03',
        steps: [{ id: 'step-1', type: 'biais', title: 'Biais' }], // Champs imbriqués parasites
      },
    });

    let upsertPayload: any = null;
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'trades') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
          upsert: vi.fn().mockImplementation((payload) => {
            upsertPayload = payload;
            return Promise.resolve({ error: null });
          }),
        } as any;
      }
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
        delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      } as any;
    });

    // 2. Exécuter la synchronisation de la file
    const { result } = renderHook(() => useOfflineSyncManager());

    await act(async () => {
      await result.current.synchroniserFileDAttente();
    });

    // 3. Vérifications :
    // - L'upsert Supabase a bien reçu le user_id de la session connectée
    expect(upsertPayload).toBeDefined();
    expect(upsertPayload.user_id).toBe('test-user-uuid-999');

    // - strategy_id "" a bien été transformé en null
    expect(upsertPayload.strategy_id).toBeNull();

    // - Le champ imbriqué 'steps' a été nettoyé de l'upsert trades
    expect(upsertPayload.steps).toBeUndefined();

    // - La base locale a aussi été mise à jour avec le bon user_id
    const localTrade = useLocalDatabase.getState().trades.find((t) => t.id === tradeId);
    expect(localTrade?.user_id).toBe('test-user-uuid-999');

    // - La file d'attente a été vidée suite au succès
    expect(useOfflineSyncStore.getState().queue).toHaveLength(0);
  });
});
