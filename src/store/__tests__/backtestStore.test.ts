import { describe, it, expect, beforeEach } from 'vitest';
import { useBacktestStore } from '@/store/backtestStore';
import type { Bougie } from '@/lib/chartDataHelper';

describe('useBacktestStore - Moteur de backtest et simulation de trades', () => {
  // Jeu de fausses bougies pour tester les scénarios
  const bougiesMock: Bougie[] = [
    { time: 1700000000, open: 1.0800, high: 1.0850, low: 1.0790, close: 1.0840 },
    { time: 1700003600, open: 1.0840, high: 1.0900, low: 1.0820, close: 1.0890 },
    { time: 1700007200, open: 1.0890, high: 1.0950, low: 1.0880, close: 1.0940 },
    { time: 1700010800, open: 1.0940, high: 1.0960, low: 1.0750, close: 1.0760 },
  ];

  beforeEach(() => {
    // Réinitialisation de la session de backtest
    useBacktestStore.setState({
      actif: 'Aucun actif',
      donneesCompletes: [],
      indexCourant: 0,
      estEnLecture: false,
      positionActive: null,
      historiqueSimule: [],
    });
  });

  // 1️⃣ Chargement initial des bougies
  it('charge les bougies et positionne l index sur la dernière bougie', () => {
    useBacktestStore.getState().chargerDonnees(bougiesMock, 'EURUSD');

    const etat = useBacktestStore.getState();
    expect(etat.actif).toBe('EURUSD');
    expect(etat.donneesCompletes).toHaveLength(4);
    // Par défaut, l'index est calé sur la dernière bougie du jeu de données
    expect(etat.indexCourant).toBe(3);
    expect(etat.positionActive).toBeNull();
  });

  // 2️⃣ Ouverture d'une position d'achat (LONG)
  it('permet d ouvrir une position simulée LONG', () => {
    useBacktestStore.getState().chargerDonnees(bougiesMock, 'EURUSD');
    // On positionne le replay sur la première bougie
    useBacktestStore.setState({ indexCourant: 0 });

    // Ouverture d'un achat à 1.0840 avec SL à 1.0800 et TP à 1.0920
    useBacktestStore.getState().ouvrirPosition('long', 1.0840, 1.0800, 1.0920);

    const position = useBacktestStore.getState().positionActive;
    expect(position).not.toBeNull();
    expect(position?.direction).toBe('long');
    expect(position?.prixEntree).toBe(1.0840);
    expect(position?.stopLoss).toBe(1.0800);
    expect(position?.takeProfit).toBe(1.0920);
    expect(position?.resultat).toBeUndefined(); // Pas encore de résultat
  });

  // 3️⃣ Avancement du replay et déclenchement d'un Take Profit (WIN)
  it('détecte automatiquement le TP et valide une position gagnante (win)', () => {
    useBacktestStore.getState().chargerDonnees(bougiesMock, 'EURUSD');
    // On commence à l'index 1 (High: 1.0900)
    useBacktestStore.setState({ indexCourant: 1 });

    // On ouvre une position avec un TP à 1.0940 (qui sera touché par la bougie 2 dont le High est 1.0950)
    useBacktestStore.getState().ouvrirPosition('long', 1.0890, 1.0850, 1.0940);

    // Action : Le replay avance d'une bougie (passe à l'index 2)
    const aAvance = useBacktestStore.getState().avancerBougie();

    expect(aAvance).toBe(true);
    const positionApres = useBacktestStore.getState().positionActive;

    // Vérification que le TP a été validé
    expect(positionApres?.resultat).toBe('win');
    expect(positionApres?.prixSortie).toBe(1.0940);
    expect(positionApres?.pnl).toBeGreaterThan(0);
  });

  // 4️⃣ Avancement du replay et déclenchement d'un Stop Loss (LOSS)
  it('détecte automatiquement le SL et valide une position perdante (loss)', () => {
    useBacktestStore.getState().chargerDonnees(bougiesMock, 'EURUSD');
    // On commence à l'index 2
    useBacktestStore.setState({ indexCourant: 2 });

    // On ouvre un LONG avec un SL à 1.0800 (touché par la bougie 3 dont le Low est 1.0750)
    useBacktestStore.getState().ouvrirPosition('long', 1.0940, 1.0800, 1.1000);

    // Action : Avancement vers la bougie 3
    useBacktestStore.getState().avancerBougie();

    const positionApres = useBacktestStore.getState().positionActive;

    // Le SL doit être déclenché
    expect(positionApres?.resultat).toBe('loss');
    expect(positionApres?.prixSortie).toBe(1.0800);
    expect(positionApres?.pnl).toBeLessThan(0);
  });

  // 5️⃣ Clôture manuelle et archivage d'une position active
  it('permet de fermer manuellement une position et de l archiver dans l historique', () => {
    useBacktestStore.getState().chargerDonnees(bougiesMock, 'EURUSD');
    useBacktestStore.setState({ indexCourant: 0 });

    useBacktestStore.getState().ouvrirPosition('short', 1.0840, 1.0900, 1.0700);
    expect(useBacktestStore.getState().positionActive).not.toBeNull();

    // 1. Fermeture manuelle au prix de clôture de la bougie
    useBacktestStore.getState().fermerPositionManuellement();
    const positionCloturee = useBacktestStore.getState().positionActive;
    expect(positionCloturee?.estCloturee).toBe(true);
    expect(positionCloturee?.prixSortie).toBe(1.0840);

    // 2. Archivage dans l'historique
    useBacktestStore.getState().archiverPositionActive();

    // La position active est désormais libérée et présente dans historiqueSimule
    expect(useBacktestStore.getState().positionActive).toBeNull();
    const historique = useBacktestStore.getState().historiqueSimule;
    expect(historique).toHaveLength(1);
    expect(historique[0].direction).toBe('short');
  });

  // 6️⃣ Ordre en attente (Limit) MANQUÉ quand le prix touche le TP sans toucher l'entrée
  it('identifie un trade comme manqué (missed) si le Take Profit est atteint sans déclencher l ordre d entrée', () => {
    // Bougies où le prix monte directement sans jamais redescendre à 1.0810
    const bougiesLimit: Bougie[] = [
      { time: 1700000000, open: 1.0830, high: 1.0860, low: 1.0830, close: 1.0850 }, // Bougie 0 : Cours actuel à 1.0850
      { time: 1700003600, open: 1.0850, high: 1.0950, low: 1.0840, close: 1.0940 }, // Bougie 1 : Monte au TP (1.0920), Low à 1.0840 (ne touche JAMAIS 1.0810)
    ];

    useBacktestStore.getState().chargerDonnees(bougiesLimit, 'EURUSD');
    useBacktestStore.setState({ indexCourant: 0 });

    // On place un Buy Limit plus bas à 1.0810 (alors que le close actuel est 1.0850)
    // SL = 1.0780, TP = 1.0920
    useBacktestStore.getState().ouvrirPosition('long', 1.0810, 1.0780, 1.0920);

    const posInitiale = useBacktestStore.getState().positionActive;
    expect(posInitiale).not.toBeNull();
    // L'ordre doit être EN ATTENTE et NON DÉCLENCHÉ au départ
    expect(posInitiale?.estDeclenchee).toBe(false);

    // On fait avancer le replay d'une bougie
    useBacktestStore.getState().avancerBougie();

    const posApres = useBacktestStore.getState().positionActive;
    // Le prix est monté à 1.0950 (au-dessus du TP 1.0920) sans jamais toucher l'entrée 1.0810
    // L'ordre DOIT être comptabilisé comme MANQUÉ ('missed'), avec un PnL de 0% (et non un Win !)
    expect(posApres?.estCloturee).toBe(true);
    expect(posApres?.resultat).toBe('missed');
    expect(posApres?.pnl).toBe(0);
    expect(posApres?.estDeclenchee).toBe(false);
  });

  // 7️⃣ Ordre en attente (Limit) correctement déclenché PUIS validé en gain (Win)
  it('déclenche d abord l ordre limite quand le prix touche l entrée, puis valide le TP', () => {
    const bougiesDeclenchement: Bougie[] = [
      { time: 1700000000, open: 1.0830, high: 1.0860, low: 1.0830, close: 1.0850 }, // Bougie 0 : Cours actuel à 1.0850
      { time: 1700003600, open: 1.0850, high: 1.0860, low: 1.0805, close: 1.0820 }, // Bougie 1 : Descend toucher l'entrée à 1.0810 (Low: 1.0805)
      { time: 1700007200, open: 1.0820, high: 1.0930, low: 1.0820, close: 1.0925 }, // Bougie 2 : Monte au TP (1.0920)
    ];

    useBacktestStore.getState().chargerDonnees(bougiesDeclenchement, 'EURUSD');
    useBacktestStore.setState({ indexCourant: 0 });

    // Placement de l'ordre limite LONG à 1.0810
    useBacktestStore.getState().ouvrirPosition('long', 1.0810, 1.0780, 1.0920);
    expect(useBacktestStore.getState().positionActive?.estDeclenchee).toBe(false);

    // Étape 1 : Avancer vers bougie 1 -> l'ordre est touché et devient déclenché
    useBacktestStore.getState().avancerBougie();
    const posDeclenchee = useBacktestStore.getState().positionActive;
    expect(posDeclenchee?.estDeclenchee).toBe(true);
    expect(posDeclenchee?.estCloturee).toBeFalsy();
    expect(posDeclenchee?.resultat).toBeUndefined();

    // Étape 2 : Avancer vers bougie 2 -> le TP est touché, trade clôturé en WIN
    useBacktestStore.getState().avancerBougie();
    const posGagnee = useBacktestStore.getState().positionActive;
    expect(posGagnee?.estCloturee).toBe(true);
    expect(posGagnee?.resultat).toBe('win');
    expect(posGagnee?.pnl).toBeGreaterThan(0);
  });
});

