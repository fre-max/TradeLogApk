import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TradeDetail } from '@/components/trade/TradeDetail';
import { useUIStore } from '@/store';
import { useLocalDatabase } from '@/store/useLocalDatabase';

// Mock du module d export PDF
vi.mock('@/lib/exportPdf', () => ({
  exportPdf: vi.fn(),
}));

describe('Composant d intégration TradeDetail', () => {
  let queryClient: QueryClient;

  // Modèle d'un trade complet avec étapes pour le test
  const tradeExemple = {
    id: 'trade-uuid-1',
    pair: 'EURUSD',
    direction: 'long',
    result: 'win',
    rr_realized: 2.5,
    status: 'closed',
    created_at: '2026-09-09T10:00:00Z',
    date_backtested: '2026-09-09',
    session: 'London',
    steps: [
      { id: 'step-1', type: 'biais', title: 'Analyse 4H', images: [] },
      { id: 'step-2', type: 'entry', title: 'Prise de position 15m', images: [] },
      { id: 'step-3', type: 'result', title: 'TP touché', images: [] },
    ],
    reasons: [],
    images: [],
  } as any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    useLocalDatabase.setState({
      strategies: [],
      reasonFamilies: [],
      catalogItems: [],
    });

    useUIStore.setState({
      isDetailOpen: false,
      selectedTrade: null,
      selectedTradeId: null,
    });
  });

  const renderTradeDetail = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TradeDetail />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  // 1️⃣ Aucun trade sélectionné
  it('ne rend rien lorsque aucun trade n est sélectionné dans le store', () => {
    const { container } = renderTradeDetail();

    // Doit être vide
    expect(container.firstChild).toBeNull();
  });

  // 2️⃣ Trade sélectionné et panneau ouvert
  it('affiche les détails du trade sélectionné quand isDetailOpen est vrai', () => {
    // Configuration de l'état ouvert avec le trade modèle
    useUIStore.setState({
      isDetailOpen: true,
      selectedTrade: tradeExemple,
      selectedTradeId: tradeExemple.id,
    });

    renderTradeDetail();

    // La paire "EURUSD" et le ratio "2.5" doivent être visibles
    expect(screen.getAllByText('EURUSD').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2.5/i).length).toBeGreaterThan(0);
  });

  // 3️⃣ Action de fermeture
  it('ferme le panneau de détail lorsque l utilisateur clique sur Retour', async () => {
    const user = userEvent.setup();

    useUIStore.setState({
      isDetailOpen: true,
      selectedTrade: tradeExemple,
      selectedTradeId: tradeExemple.id,
    });

    renderTradeDetail();

    const boutonRetour = screen.getByRole('button', { name: /Retour/i });
    // Clic pour fermer
    await user.click(boutonRetour);

    // Vérifie que closeDetail() a bien été déclenché dans useUIStore
    expect(useUIStore.getState().isDetailOpen).toBe(false);
  });
});
