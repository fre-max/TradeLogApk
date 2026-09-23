import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { useUIStore, useFilterStore } from '@/store';
import { useLocalDatabase } from '@/store/useLocalDatabase';

describe('Composant d intégration Sidebar', () => {
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
      isSidebarOpen: true,
    });

    useFilterStore.setState({
      filterPair: null,
      filterStrategyId: null,
    });

    useLocalDatabase.setState({
      strategies: [],
    });
  });

  const renderSidebar = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  // 1️⃣ Affichage des liens de navigation
  it('affiche les principaux liens de navigation de l application', () => {
    renderSidebar();

    expect(screen.getByText('Global')).toBeInTheDocument();
    expect(screen.getByText('Statistiques')).toBeInTheDocument();
    expect(screen.getByText('Backtesting')).toBeInTheDocument();
  });

  // 2️⃣ Filtrage rapide par paire
  it('met à jour le filtre par paire dans useFilterStore lors d un clic sur EURUSD', async () => {
    const user = userEvent.setup();
    renderSidebar();

    const boutonEurUsd = screen.getByRole('button', { name: /EURUSD/i });
    // Clic pour filtrer sur EURUSD
    await user.click(boutonEurUsd);

    expect(useFilterStore.getState().filterPair).toBe('EURUSD');

    // Deuxième clic pour désactiver le filtre
    await user.click(boutonEurUsd);
    expect(useFilterStore.getState().filterPair).toBeNull();
  });

  // 3️⃣ Clic sur un lien de navigation ferme la sidebar mobile
  it('ferme la sidebar lors du clic sur un lien de navigation', async () => {
    const user = userEvent.setup();
    renderSidebar();

    // La sidebar est ouverte
    expect(useUIStore.getState().isSidebarOpen).toBe(true);

    // Clic sur Statistiques
    const lienStats = screen.getByRole('button', { name: /Statistiques/i });
    await user.click(lienStats);

    // La navigation doit avoir fermé la sidebar
    expect(useUIStore.getState().isSidebarOpen).toBe(false);
  });
});
