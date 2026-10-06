import { describe, it, expect, beforeEach } from 'vitest';
import { useLaboratoireStore } from '../laboratoireStore';
import { useFilterStore } from '../index';
import type { FicheSetupSonde } from '@/lib/bot/laboratoire/types';

describe('🧪 LaboratoireStore & Filtrage Avancé', () => {
  beforeEach(() => {
    useLaboratoireStore.getState().reinitialiserBanque();
    useLaboratoireStore.getState().reinitialiserFiltres();
    useLaboratoireStore.getState().definirTradeActif(null);
    useFilterStore.getState().resetFilters();
  });

  const setupMock1: FicheSetupSonde = {
    id: 'setup-1',
    titre: 'EURUSD Spring A+',
    direction: 'ACHAT',
    paire: 'EURUSD',
    timeframe: 'M15',
    indexBougieSweep: 20,
    dateBougieSweep: '2025-01-01',
    noteQualite: 'A+',
    creeLe: '2025-01-01',
    liquidite: {
      type: 'SWING_LOW',
      prixNiveau: 1.0820,
      indexOrigine: 10,
      dateOrigine: '2025-01-01',
      bougiesEcoulees: 10,
      description: 'Creux Swing Low',
    },
    sweep: {
      prixProtegeExtreme: 1.0815,
      profondeurPips: 5.0,
      tailleBougieTotalePips: 13.0,
      tailleMecheRejetPips: 11.0,
      ratioMechePourcent: 84,
      bougiesHorsZone: 1,
    },
    reintegration: {
      indexReintegration: 20,
      delaiBougies: 0,
      amplitudeRejetPips: 11.0,
      aDisplacement: true,
      aFvg: false,
    },
    rangePostSweep: {
      dureeBougies: 5,
      borneHaute: 1.0835,
      borneBasse: 1.0820,
      amplitudeRangePips: 9.0,
      prixProtegePreserve: true,
      prixEntreeSuggere: 1.0825,
    },
  };

  const setupMock2: FicheSetupSonde = {
    ...setupMock1,
    id: 'setup-2',
    titre: 'GBPUSD Sweep B',
    direction: 'VENTE',
    paire: 'GBPUSD',
    noteQualite: 'B',
    sweep: {
      ...setupMock1.sweep,
      profondeurPips: 12.0,
      ratioMechePourcent: 50,
    },
  };

  it('gère le contexte du trade actif rejoué depuis le Journal', () => {
    useLaboratoireStore.getState().definirTradeActif({
      id: 'trade-42',
      titre: 'EURUSD - London Sweep',
      noteQualite: 'A+',
      pair: 'EURUSD',
    });

    const actif = useLaboratoireStore.getState().contexteTradeActif;
    expect(actif).toBeDefined();
    expect(actif?.titre).toBe('EURUSD - London Sweep');
    expect(actif?.noteQualite).toBe('A+');
  });

  it('calcule la synthèse globale puis la synthèse filtrée sur A+ uniquement', () => {
    useLaboratoireStore.getState().sauvegarderSetup(setupMock1);
    useLaboratoireStore.getState().sauvegarderSetup(setupMock2);

    const setups = useLaboratoireStore.getState().setups;
    expect(setups.length).toBe(2);

    // Synthèse globale (les 2 setups)
    const syntheseTous = useLaboratoireStore.getState().obtenirSynthese();
    expect(syntheseTous.totalSetups).toBe(2);
    expect(syntheseTous.profondeurSweepMoyennePips).toBe(8.5); // (5 + 12) / 2

    // Synthèse filtrée sur les A+ uniquement
    const setupsAPlus = setups.filter((s) => s.noteQualite === 'A+');
    const syntheseAPlus = useLaboratoireStore.getState().obtenirSynthese(setupsAPlus);
    expect(syntheseAPlus.totalSetups).toBe(1);
    expect(syntheseAPlus.profondeurSweepMoyennePips).toBe(5.0); // Exactement les 5 pips du setup 1
    expect(syntheseAPlus.ratioMecheMoyenPourcent).toBe(84);
  });

  it('met à jour et réinitialise les filtres du store de la banque', () => {
    useLaboratoireStore.getState().definirFiltreNoteQualite('A+');
    useLaboratoireStore.getState().definirFiltreDirection('ACHAT');
    useLaboratoireStore.getState().definirFiltrePaire('EURUSD');
    useLaboratoireStore.getState().definirRechercheTitre('Spring');

    expect(useLaboratoireStore.getState().filtreNoteQualite).toBe('A+');
    expect(useLaboratoireStore.getState().filtreDirection).toBe('ACHAT');
    expect(useLaboratoireStore.getState().filtrePaire).toBe('EURUSD');
    expect(useLaboratoireStore.getState().rechercheTitre).toBe('Spring');

    useLaboratoireStore.getState().reinitialiserFiltres();
    expect(useLaboratoireStore.getState().filtreNoteQualite).toBe('TOUS');
    expect(useLaboratoireStore.getState().filtreDirection).toBe('TOUS');
    expect(useLaboratoireStore.getState().filtrePaire).toBe('TOUTES');
    expect(useLaboratoireStore.getState().rechercheTitre).toBe('');
  });

  it('useFilterStore supporte le filtre filterQuality pour les tables de journal', () => {
    useFilterStore.getState().setFilter('filterQuality', 'A+');
    expect(useFilterStore.getState().filterQuality).toBe('A+');

    useFilterStore.getState().resetFilters();
    expect(useFilterStore.getState().filterQuality).toBeNull();
  });
});
