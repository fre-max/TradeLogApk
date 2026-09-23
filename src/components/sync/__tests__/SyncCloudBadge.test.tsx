import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SyncCloudBadge } from '@/components/sync/SyncCloudBadge';
import { useOfflineSyncStore } from '@/store/offlineSyncStore';
import { useLocalDatabase } from '@/store/useLocalDatabase';
import { supabase } from '@/lib/supabase';

// Mock du hook useOfflineSyncManager pour éviter les requêtes réseau pendant les tests
vi.mock('@/hooks/useOfflineSyncManager', () => ({
  useOfflineSyncManager: () => ({
    syncAll: vi.fn(),
    synchroniserFileDAttente: vi.fn(),
  }),
}));

// Mock de Supabase
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

describe('Composant d intégration SyncCloudBadge', () => {
  beforeEach(() => {
    // Réinitialisation des stores avant chaque test
    useOfflineSyncStore.setState({
      queue: [],
      derniereSynchroReussie: null,
      syncEnCours: false,
    });
    useLocalDatabase.setState({
      trades: [],
    });

    // Par défaut, session hors-ligne
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as any);
  });

  // 1️⃣ Statut hors-ligne par défaut
  it('affiche le statut Hors-ligne quand aucun compte n est connecté', () => {
    render(<SyncCloudBadge />);

    // Le badge affiche l'icône cercle et le libellé Hors-ligne
    expect(screen.getByText('Hors-ligne')).toBeInTheDocument();
    expect(screen.getByText('○')).toBeInTheDocument();
  });

  // 2️⃣ Statut avec trades en file d attente
  it('affiche le nombre de trades en attente quand la session est active et la file non vide', async () => {
    // On simule une session active
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: { id: 'u1', email: 'trader@example.com' },
        },
      },
    } as any);

    // On simule 2 trades dans la file d'attente
    useOfflineSyncStore.setState({
      queue: [
        { id: '1', tradeId: 't1', action: 'INSERT', date: '2026-09-09' },
        { id: '2', tradeId: 't2', action: 'UPDATE', date: '2026-09-09' },
      ],
    });

    render(<SyncCloudBadge />);

    // Le badge doit afficher "2 en attente"
    expect(await screen.findByText('2 en attente')).toBeInTheDocument();
  });

  // 3️⃣ Ouverture du panneau Popover au clic sur le badge
  it('ouvre le Popover avec les statistiques de synchronisation lors d un clic', async () => {
    const user = userEvent.setup();

    render(<SyncCloudBadge />);

    const badgeBouton = screen.getByRole('button', { name: /Hors-ligne/i });
    // Clic pour ouvrir le popover
    await user.click(badgeBouton);

    // Le popover doit être visible avec ses détails
    expect(screen.getByText('☁️ Synchronisation Cloud')).toBeInTheDocument();
    expect(screen.getByText(/Sur ce téléphone/i)).toBeInTheDocument();
    expect(screen.getByText(/En attente d'envoi/i)).toBeInTheDocument();
  });

  // 4️⃣ Fermeture du Popover via le bouton ✕
  it('ferme le Popover lorsque l utilisateur clique sur la croix', async () => {
    const user = userEvent.setup();

    render(<SyncCloudBadge />);

    // 1. Ouverture du popover
    const badgeBouton = screen.getByRole('button', { name: /Hors-ligne/i });
    await user.click(badgeBouton);
    expect(screen.getByText('☁️ Synchronisation Cloud')).toBeInTheDocument();

    // 2. Clic sur le bouton de fermeture ✕
    const boutonFermer = screen.getByRole('button', { name: '✕' });
    await user.click(boutonFermer);

    // 3. Le popover n'est plus dans le DOM
    expect(screen.queryByText('☁️ Synchronisation Cloud')).not.toBeInTheDocument();
  });
});
