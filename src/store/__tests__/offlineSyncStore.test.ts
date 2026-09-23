import { describe, it, expect, beforeEach } from 'vitest';
import { useOfflineSyncStore } from '@/store/offlineSyncStore';

describe('useOfflineSyncStore - Gestion de la file d attente hors-ligne', () => {
  beforeEach(() => {
    // Réinitialise l'état avant chaque test
    useOfflineSyncStore.setState({
      queue: [],
      derniereSynchroReussie: null,
      syncEnCours: false,
    });
  });

  // 1️⃣ État initial
  it('démarre avec une file vide et aucune synchronisation en cours', () => {
    const etat = useOfflineSyncStore.getState();

    expect(etat.queue).toEqual([]);
    expect(etat.syncEnCours).toBe(false);
    expect(etat.derniereSynchroReussie).toBeNull();
  });

  // 2️⃣ Ajout d'une opération à la file d'attente
  it('ajoute une action INSERT dans la file d attente avec un identifiant unique', () => {
    // Action : Ajout d'un trade créé hors-ligne
    useOfflineSyncStore.getState().ajouterALaFile({
      tradeId: 'trade-uuid-123',
      action: 'INSERT',
      tradeData: { pair: 'EURUSD', type: 'BUY', lots: 1.0 },
    });

    const file = useOfflineSyncStore.getState().queue;

    // Vérifications
    expect(file).toHaveLength(1);
    expect(file[0].tradeId).toBe('trade-uuid-123');
    expect(file[0].action).toBe('INSERT');
    expect(file[0].tentatives).toBe(0);
    expect(file[0].id).toBeDefined();
    expect(file[0].date).toBeDefined();
  });

  // 3️⃣ Incrémentation des tentatives après un échec réseau
  it('incrémente le nombre de tentatives pour un élément donné', () => {
    useOfflineSyncStore.getState().ajouterALaFile({
      tradeId: 'trade-uuid-456',
      action: 'UPDATE',
    });

    const item = useOfflineSyncStore.getState().queue[0];

    // Action : La synchronisation a échoué une première fois
    useOfflineSyncStore.getState().incrementerTentative(item.id);

    const fileApresEchec = useOfflineSyncStore.getState().queue;
    expect(fileApresEchec[0].tentatives).toBe(1);
  });

  // 4️⃣ Suppression d'un élément une fois synchronisé avec succès
  it('retire un élément de la file lorsqu il est synchronisé', () => {
    useOfflineSyncStore.getState().ajouterALaFile({
      tradeId: 'trade-uuid-789',
      action: 'DELETE',
    });

    const item = useOfflineSyncStore.getState().queue[0];
    expect(useOfflineSyncStore.getState().queue).toHaveLength(1);

    // Action : Retirer l'élément de la file
    useOfflineSyncStore.getState().retirerDeLaFile(item.id);

    // Vérification : La file doit être vide
    expect(useOfflineSyncStore.getState().queue).toHaveLength(0);
  });

  // 5️⃣ Vidage complet de la file
  it('vide entièrement la file d attente', () => {
    useOfflineSyncStore.getState().ajouterALaFile({ tradeId: 't1', action: 'INSERT' });
    useOfflineSyncStore.getState().ajouterALaFile({ tradeId: 't2', action: 'UPDATE' });

    expect(useOfflineSyncStore.getState().queue).toHaveLength(2);

    useOfflineSyncStore.getState().viderLaFile();
    expect(useOfflineSyncStore.getState().queue).toHaveLength(0);
  });

  // 6️⃣ Mise à jour de la date de synchronisation et du statut
  it('met à jour la date de dernière synchronisation et l indicateur de chargement', () => {
    const dateTest = '2026-09-09T16:30:00.000Z';

    useOfflineSyncStore.getState().setSyncEnCours(true);
    expect(useOfflineSyncStore.getState().syncEnCours).toBe(true);

    useOfflineSyncStore.getState().setDerniereSynchroReussie(dateTest);
    expect(useOfflineSyncStore.getState().derniereSynchroReussie).toBe(dateTest);

    useOfflineSyncStore.getState().setSyncEnCours(false);
    expect(useOfflineSyncStore.getState().syncEnCours).toBe(false);
  });
});
