import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BacktestTradeModal } from '../BacktestTradeModal';
import { useLocalDatabase } from '@/store/useLocalDatabase';
import { useOfflineSyncStore } from '@/store/offlineSyncStore';
import { useBacktestStore, type PositionSimulee } from '@/store/backtestStore';

// Mock de Supabase pour éviter tout appel réseau réel
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({ data: [] }),
      })),
    })),
  },
}));

describe('Composant d intégration BacktestTradeModal - Mode Mobile APK', () => {
  const mockPositionEnCours: PositionSimulee = {
    direction: 'long',
    prixEntree: 1.08500,
    stopLoss: 1.08000,
    takeProfit: 1.09500,
    dateEntree: 1710000000,
    indexEntree: 10,
    estCloturee: false,
  };

  const mockPositionCloturee: PositionSimulee = {
    direction: 'short',
    prixEntree: 1.09000,
    stopLoss: 1.09500,
    takeProfit: 1.08000,
    prixSortie: 1.08000,
    dateEntree: 1710000000,
    dateSortie: 1710003600,
    indexEntree: 10,
    estCloturee: true,
    resultat: 'win',
    pnl: 2.5,
    tradeIdSupabase: 'trade-uuid-existant',
  };

  beforeEach(() => {
    // Réinitialisation des stores avant chaque test
    useLocalDatabase.setState({
      trades: [],
      strategies: [
        { id: 'strat-1', name: 'Order Block SMC', user_id: 'user-1' } as any,
      ],
    });
    useOfflineSyncStore.setState({
      queue: [],
    });
    useBacktestStore.setState({
      positionActive: null,
      historiqueSimule: [],
    });
  });

  // 1️⃣ Test d'affichage instantané de la planification
  it('affiche instantanément les détails de la position à planifier', () => {
    render(
      <BacktestTradeModal
        ouvert={true}
        onFermer={vi.fn()}
        position={mockPositionEnCours}
        paire="EURUSD"
        timeframe="15m"
        annee="2025"
      />
    );

    // Titre et détails de la position
    expect(screen.getByText('Planification du Trade')).toBeInTheDocument();
    expect(screen.getByText(/EURUSD/)).toBeInTheDocument();
    expect(screen.getByText('▲ Position Long')).toBeInTheDocument();
    expect(screen.getByText('1.08500')).toBeInTheDocument(); // Entrée
    expect(screen.getByText('1.08000')).toBeInTheDocument(); // SL
    expect(screen.getByText('1.09500')).toBeInTheDocument(); // TP

    // Bouton de validation
    expect(screen.getByRole('button', { name: /Valider la Planification/i })).toBeInTheDocument();
  });

  // 2️⃣ Test d'affichage instantané pour la résolution de trade clôturé
  it('affiche les détails et le P&L pour une position clôturée', () => {
    render(
      <BacktestTradeModal
        ouvert={true}
        onFermer={vi.fn()}
        position={mockPositionCloturee}
        paire="EURUSD"
        timeframe="15m"
        annee="2025"
      />
    );

    expect(screen.getByText('Résolution & Clôture')).toBeInTheDocument();
    expect(screen.getByText('+2.50% P&L')).toBeInTheDocument();
    expect(screen.getByText('1.08000')).toBeInTheDocument(); // Sortie
    expect(screen.getByRole('button', { name: /Clôturer & Archiver/i })).toBeInTheDocument();
  });

  // 3️⃣ Test de résolution de la capture asynchrone sans bloquer l'UI
  it('résout la promesse de capture d écran en arrière-plan sans geler l affichage', async () => {
    const promiseCapture = Promise.resolve({
      id: 'img-1',
      url: 'data:image/jpeg;base64,miniature_test',
      source: 'upload' as const,
      phase: 'avant' as const,
    });

    render(
      <BacktestTradeModal
        ouvert={true}
        onFermer={vi.fn()}
        position={mockPositionEnCours}
        paire="EURUSD"
        timeframe="15m"
        annee="2025"
        promiseCapture={promiseCapture}
      />
    );

    // L'interface est immédiatement visible
    expect(screen.getByText('Planification du Trade')).toBeInTheDocument();

    // La miniature de l'image apparaît dès que la promesse est résolue
    await waitFor(() => {
      const img = screen.getByRole('img', { name: /Aperçu graphique/i });
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'data:image/jpeg;base64,miniature_test');
    });
  });

  // 4️⃣ Test de validation et enregistrement direct dans la base locale et la file offline
  it('enregistre directement la planification en local et dans la file d attente', async () => {
    const user = userEvent.setup();
    const handleFermer = vi.fn();

    // Position active dans le store
    useBacktestStore.setState({ positionActive: mockPositionEnCours });

    render(
      <BacktestTradeModal
        ouvert={true}
        onFermer={handleFermer}
        position={mockPositionEnCours}
        paire="EURUSD"
        timeframe="15m"
        annee="2025"
      />
    );

    // Clic sur Valider la Planification
    const btnValider = screen.getByRole('button', { name: /Valider la Planification/i });
    await user.click(btnValider);

    // Vérification de l'enregistrement dans useLocalDatabase
    const tradesLocaux = useLocalDatabase.getState().trades;
    expect(tradesLocaux.length).toBe(1);
    expect(tradesLocaux[0].pair).toBe('EURUSD');
    expect(tradesLocaux[0].direction).toBe('long');
    expect(tradesLocaux[0].journal_type).toBe('backtest');

    // Vérification de l'ajout dans la file d'attente hors-ligne (useOfflineSyncStore)
    const queue = useOfflineSyncStore.getState().queue;
    expect(queue.length).toBe(1);
    expect(queue[0].action).toBe('INSERT');
    expect(queue[0].tradeData.pair).toBe('EURUSD');

    // La modale doit se fermer
    expect(handleFermer).toHaveBeenCalledTimes(1);
  });

  // 5️⃣ Test du lien vers le formulaire complet
  it('déclenche le callback onOuvrirFormulaireComplet lors du clic sur le lien', async () => {
    const user = userEvent.setup();
    const handleComplet = vi.fn();

    render(
      <BacktestTradeModal
        ouvert={true}
        onFermer={vi.fn()}
        position={mockPositionEnCours}
        paire="EURUSD"
        timeframe="15m"
        annee="2025"
        onOuvrirFormulaireComplet={handleComplet}
      />
    );

    const lienComplet = screen.getByText(/Accéder au formulaire complet/i);
    await user.click(lienComplet);

    expect(handleComplet).toHaveBeenCalledTimes(1);
  });

  // 6️⃣ Test Anti-Doublon : Cycle complet Planification (Étape 1) puis Clôture (Étape 2) sur le même trade
  it('met à jour le trade existant sans créer de doublon lors du cycle en 2 étapes', async () => {
    const user = userEvent.setup();
    const handleFermer = vi.fn();

    // Position initiale ouverte
    useBacktestStore.setState({ positionActive: mockPositionEnCours });

    // ── Phase 1 : Planification
    const { unmount } = render(
      <BacktestTradeModal
        ouvert={true}
        onFermer={handleFermer}
        position={mockPositionEnCours}
        paire="EURUSD"
        timeframe="15m"
        annee="2025"
      />
    );

    await user.click(screen.getByRole('button', { name: /Valider la Planification/i }));

    // 1 seul trade créé avec le statut in_progress
    const tradesApresEtape1 = useLocalDatabase.getState().trades;
    expect(tradesApresEtape1.length).toBe(1);
    expect(tradesApresEtape1[0].status).toBe('in_progress');
    const tradeId = tradesApresEtape1[0].id;
    unmount();

    // ── Phase 2 : Le replay avance et clôture la position
    const positionClotureeAvecMemeId: PositionSimulee = {
      ...mockPositionEnCours,
      tradeIdSupabase: tradeId,
      planificationEnregistree: true,
      estCloturee: true,
      prixSortie: 1.09500,
      resultat: 'win',
      pnl: 2.0,
      dureeReelleBougies: 8,
    };
    useBacktestStore.setState({ positionActive: positionClotureeAvecMemeId });

    render(
      <BacktestTradeModal
        ouvert={true}
        onFermer={handleFermer}
        position={positionClotureeAvecMemeId}
        paire="EURUSD"
        timeframe="15m"
        annee="2025"
      />
    );

    await user.click(screen.getByRole('button', { name: /Clôturer & Archiver/i }));

    // ✅ VÉRIFICATION CRITIQUE : Il n'y a toujours qu'UN SEUL trade dans la base locale (PAS DE DOUBLON !)
    const tradesApresEtape2 = useLocalDatabase.getState().trades;
    expect(tradesApresEtape2.length).toBe(1);
    expect(tradesApresEtape2[0].id).toBe(tradeId);
    expect(tradesApresEtape2[0].status).toBe('complete');
    expect(tradesApresEtape2[0].result).toBe('win');

    // La file d'attente hors-ligne doit comporter l'UPDATE ciblant exactement le même tradeId
    const queue = useOfflineSyncStore.getState().queue;
    expect(queue.length).toBe(2);
    expect(queue[0].action).toBe('INSERT');
    expect(queue[0].tradeId).toBe(tradeId);
    expect(queue[1].action).toBe('UPDATE');
    expect(queue[1].tradeId).toBe(tradeId);
    expect(queue[1].tradeData.id).toBe(tradeId); // L'ID est garanti présent pour l'upsert Supabase
  });

  // 7️⃣ Test Clôture directe sans planification préalable (aucun crash, création immédiate)
  it('permet d enregistrer directement un trade clôturé sans avoir planifié au préalable', async () => {
    const user = userEvent.setup();
    const positionClotureeDirecte: PositionSimulee = {
      direction: 'short',
      prixEntree: 1.09000,
      stopLoss: 1.09500,
      takeProfit: 1.08000,
      prixSortie: 1.08000,
      dateEntree: 1710000000,
      dateSortie: 1710003600,
      indexEntree: 10,
      estCloturee: true,
      resultat: 'win',
      pnl: 2.5,
      // Pas de tradeIdSupabase car non planifié
    };

    render(
      <BacktestTradeModal
        ouvert={true}
        onFermer={vi.fn()}
        position={positionClotureeDirecte}
        paire="EURUSD"
        timeframe="15m"
        annee="2025"
      />
    );

    await user.click(screen.getByRole('button', { name: /Clôturer & Archiver/i }));

    const tradesLocaux = useLocalDatabase.getState().trades;
    expect(tradesLocaux.length).toBe(1);
    expect(tradesLocaux[0].status).toBe('complete');
    expect(tradesLocaux[0].direction).toBe('short');
    expect(tradesLocaux[0].result).toBe('win');
  });
});
