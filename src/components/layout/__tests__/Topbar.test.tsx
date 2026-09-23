import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Topbar } from '@/components/layout/Topbar';
import { useUIStore } from '@/store';
import { useLocalDatabase } from '@/store/useLocalDatabase';

// Mock léger de Supabase pour le badge inclus dans la Topbar
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ count: 0 }),
      })),
    })),
  },
}));

describe('Composant d intégration Topbar', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    useUIStore.setState({
      isNewTradeOpen: false,
    });

    useLocalDatabase.setState({
      trades: [],
    });
  });

  // Helper pour envelopper le composant avec React Router et React Query
  const renderTopbar = (props = {}) => {
    const defaultProps = {
      title: 'Mon Journal',
      onMenuClick: vi.fn(),
      showBack: false,
      ...props,
    };

    return {
      ...render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <Topbar {...defaultProps} />
          </MemoryRouter>
        </QueryClientProvider>
      ),
      onMenuClick: defaultProps.onMenuClick,
    };
  };

  // 1️⃣ Affichage du titre
  it('affiche le titre fourni en paramètre', () => {
    renderTopbar({ title: 'Vue d ensemble' });

    expect(screen.getByText('Vue d ensemble')).toBeInTheDocument();
  });

  // 2️⃣ Calcul et affichage du Winrate et du nombre de trades
  it('calcule et affiche correctement le Winrate et les statistiques de trades', async () => {
    // 2 trades : 1 gagnant (Win) et 1 perdant (Loss) -> Win rate = 50%
    useLocalDatabase.setState({
      trades: [
        {
          id: '1',
          pair: 'EURUSD',
          direction: 'long',
          result: 'win',
          rr_realized: 2.0,
          created_at: '2026-09-09',
        } as any,
        {
          id: '2',
          pair: 'GBPUSD',
          direction: 'short',
          result: 'loss',
          rr_realized: -1.0,
          created_at: '2026-09-09',
        } as any,
      ],
    });

    renderTopbar();

    // Vérifie le calcul automatique du Win Rate (1 win sur 2 = 50%) après résolution de la query
    expect(await screen.findByText('50%')).toBeInTheDocument();
    // Vérifie le compteur de trades
    expect(await screen.findByText(/2 trades/i)).toBeInTheDocument();
  });

  // 3️⃣ Clic sur le bouton "+ Nouveau"
  it('ouvre le formulaire d ajout de trade au clic sur le bouton + Nouveau', async () => {
    const user = userEvent.setup();
    renderTopbar();

    const boutonNouveau = screen.getByRole('button', { name: /\+ Nouveau/i });
    await user.click(boutonNouveau);

    // Vérifie que l'action globale a bien ouvert le tiroir dans useUIStore
    expect(useUIStore.getState().isNewTradeOpen).toBe(true);
  });

  // 4️⃣ Clic sur le bouton burger mobile
  it('appelle la fonction onMenuClick lors du clic sur le burger mobile', async () => {
    const user = userEvent.setup();
    const { onMenuClick } = renderTopbar();

    const boutonBurger = screen.getByRole('button', { name: '☰' });
    await user.click(boutonBurger);

    expect(onMenuClick).toHaveBeenCalledTimes(1);
  });

  // 5️⃣ Bouton Retour
  it('affiche le bouton retour au lieu du burger si showBack est vrai', () => {
    renderTopbar({ showBack: true });

    // Le burger ne doit pas être affiché
    expect(screen.queryByRole('button', { name: '☰' })).not.toBeInTheDocument();
    // Le bouton retour doit être présent
    expect(screen.getByRole('button', { name: /Retour/i })).toBeInTheDocument();
  });
});
