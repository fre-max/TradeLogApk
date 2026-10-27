import { describe, it, expect } from 'vitest';
import { executerSimulationOrchestrateurSMC } from '../simulateurOrchestrateurSMC';
import { useBotJournalStore } from '@/store/botJournalStore';
import type { Bougie } from '@/lib/chartDataHelper';

describe('🤖 Simulateur Batch du Chef d\'Orchestre SMC et Journal Dédié', () => {
  // Générateur simple de bougies synthétiques avec doji et mouvement
  const creerBougiesTest = (): Bougie[] => {
    const bougies: Bougie[] = [];
    let prix = 2000;

    for (let i = 0; i < 60; i++) {
      const open = prix;
      let close = prix + (i % 2 === 0 ? 2 : -2);
      let high = Math.max(open, close) + 3;
      let low = Math.min(open, close) - 3;

      // Création artificielle d'un doji à forte mèche basse (signal d'achat potentiel) à l'index 25
      if (i === 25) {
        close = open + 0.1;
        high = open + 1;
        low = open - 15; // Grande mèche basse
      }

      bougies.push({
        time: 1700000000 + i * 300,
        open,
        high,
        low,
        close,
        volume: 100,
      });

      prix = close;
    }

    return bougies;
  };

  it('gère correctement un historique vide ou trop court', () => {
    const rapport = executerSimulationOrchestrateurSMC([], { capitalInitial: 10000 });
    expect(rapport.totalTrades).toBe(0);
    expect(rapport.capitalFinal).toBe(10000);
    expect(rapport.winratePourcentage).toBe(0);
    expect(rapport.courbeEquity.length).toBe(1);
  });

  it('exécute la simulation SMC et retourne un rapport statistique cohérent', () => {
    const bougies = creerBougiesTest();
    const rapport = executerSimulationOrchestrateurSMC(bougies, {
      capitalInitial: 10000,
      risquePourcent: 1.0,
      parametresSMC: {
        palierTPVise: 'TP1',
        typeChevauchementUOP: 'PONDERE',
      },
    });

    expect(rapport.botId).toBe('bot-orchestrateur-smc');
    expect(rapport.capitalInitial).toBe(10000);
    expect(typeof rapport.winratePourcentage).toBe('number');
    expect(typeof rapport.profitFactor).toBe('number');
    expect(typeof rapport.maxDrawdownPourcentage).toBe('number');
    expect(Array.isArray(rapport.trades)).toBe(true);
    expect(Array.isArray(rapport.courbeEquity)).toBe(true);
  });

  it('enregistre et persiste la session de simulation dans le botJournalStore', () => {
    const store = useBotJournalStore.getState();
    store.effacerToutesLesSessions();

    const bougies = creerBougiesTest();
    const rapport = executerSimulationOrchestrateurSMC(bougies, {
      capitalInitial: 5000,
      risquePourcent: 2.0,
      paire: 'XAUUSD',
      timeframe: 'M5',
    });

    const session = store.enregistrerRapportSimulation(rapport, 'XAUUSD', 'M5');

    expect(session.id).toBeDefined();
    expect(session.botNom).toContain('Chef d\'Orchestre SMC');
    expect(session.capitalInitial).toBe(5000);

    const sessionsActuelles = useBotJournalStore.getState().sessions;
    expect(sessionsActuelles.length).toBe(1);
    expect(sessionsActuelles[0].id).toBe(session.id);

    // Test de suppression
    store.supprimerSession(session.id);
    expect(useBotJournalStore.getState().sessions.length).toBe(0);
  });
});
