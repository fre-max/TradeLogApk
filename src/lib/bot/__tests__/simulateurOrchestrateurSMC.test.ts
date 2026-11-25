import { describe, it, expect } from 'vitest';
import {
  executerSimulationOrchestrateurSMC,
  calculerTimelineVisuelleBotSMC,
} from '../simulateurOrchestrateurSMC';
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

  it('exécute le Mode Fractal HTF ➔ LTF (Order Blocks Classiques SMC protégés + 2ème Setup LTF sans chevauchement visant le Grand TP HTF)', () => {
    // 1️⃣ Création de bougies HTF (H4) contenant un Setup Maître Achat confirmé
    const bougiesHTF: Bougie[] = [];
    for (let k = 0; k < 20; k++) {
      bougiesHTF.push({
        time: 1700000000 + k * 14400,
        open: 100,
        high: 103,
        low: 98,
        close: 101,
        volume: 100,
      });
    }
    // Doji HTF Achat aux bougies 20 et 21 (SL_HTF = 85.0, Entrée_HTF = 98.5, Amplitude = 14 -> BorneRange_HTF = 112.5)
    bougiesHTF.push({ time: 1700000000 + 20 * 14400, open: 99, high: 99, low: 85, close: 86, volume: 100 });
    bougiesHTF.push({ time: 1700000000 + 21 * 14400, open: 86, high: 99, low: 86, close: 98.5, volume: 100 });
    // 3 bougies de confirmation HTF (22, 23, 24)
    bougiesHTF.push({ time: 1700000000 + 22 * 14400, open: 98.5, high: 101, low: 95, close: 100, volume: 100 });
    bougiesHTF.push({ time: 1700000000 + 23 * 14400, open: 100, high: 102, low: 96, close: 101, volume: 100 });
    bougiesHTF.push({ time: 1700000000 + 24 * 14400, open: 101, high: 103, low: 98, close: 102, volume: 100 });

    // 2️⃣ Création de bougies LTF (M15) APRÈS la confirmation du Setup HTF (bougie 24), à l'intérieur de la plage protégée [85.0 .. 112.5]
    const tDepartLTF = 1700000000 + 24 * 14400;
    const bougiesLTF: Bougie[] = [];
    for (let j = 0; j < 15; j++) {
      bougiesLTF.push({
        time: tDepartLTF + j * 900,
        open: 95,
        high: 96,
        low: 94,
        close: 95,
        volume: 50,
      });
    }
    // Second Setup LTF (Doji Achat LTF avec un PETIT SL à 92.0 et confirmation à la 3ème bougie à 96.8 !)
    bougiesLTF.push({ time: tDepartLTF + 15 * 900, open: 95.0, high: 95.0, low: 92.0, close: 92.2, volume: 50 });
    bougiesLTF.push({ time: tDepartLTF + 16 * 900, open: 92.2, high: 95.0, low: 92.2, close: 94.8, volume: 50 });
    // 3 bougies de confirmation LTF (17, 18, 19) dans le range [92.0 .. 94.8 + 3.0 = 97.8]
    bougiesLTF.push({ time: tDepartLTF + 17 * 900, open: 94.8, high: 96.0, low: 93.5, close: 95.5, volume: 50 });
    bougiesLTF.push({ time: tDepartLTF + 18 * 900, open: 95.5, high: 96.5, low: 94.0, close: 96.0, volume: 50 });
    bougiesLTF.push({ time: tDepartLTF + 19 * 900, open: 96.0, high: 97.0, low: 95.0, close: 96.8, volume: 50 });
    // Bougie d'impulsion LTF qui va chercher le Grand TP du Setup HTF (> 125)
    bougiesLTF.push({ time: tDepartLTF + 20 * 900, open: 96.8, high: 135.0, low: 96.0, close: 132.0, volume: 50 });

    const rapportFractal = executerSimulationOrchestrateurSMC(bougiesLTF, {
      capitalInitial: 10000,
      risquePourcent: 1.0,
      modeFractal: {
        actif: true,
        timeframeHTF: '4h',
        timeframeLTF: '15m',
        filtreZoneOB: 'TOUTE_LA_PLAGE',
        bougiesHTF,
        bougiesLTF,
      },
      parametresSMC: {
        activerFiltreTaille: false,
        exigerAutorouteUOP: false,
        activerFiltrePlageTP: false,
      },
    });

    expect(rapportFractal.botId).toBe('bot-orchestrateur-smc-fractal');
    expect(rapportFractal.totalTrades).toBeGreaterThanOrEqual(1);
    const tradeFractal = rapportFractal.trades[0];
    // Petit SL du setup LTF (92.0) au lieu du gros SL HTF (85.0) et entrée réelle à la clôture de la 3ème bougie de confirmation (96.8) !
    expect(tradeFractal.stopLoss).toBe(92.0);
    expect(tradeFractal.prixEntree).toBe(96.8);
    expect(tradeFractal.resultat).toBe('win');
    expect(tradeFractal.commentaire).toContain('Fractal 4H➔15M');

    // Vérifie que la timeline visuelle (Testeur de Stratégie Visuel style MT5) génère bien les événements HTF et LTF
    const timelineVisuelle = calculerTimelineVisuelleBotSMC(bougiesLTF, {
      capitalInitial: 10000,
      risquePourcent: 1.0,
      modeFractal: {
        actif: true,
        timeframeHTF: '4h',
        timeframeLTF: '15m',
        filtreZoneOB: 'TOUTE_LA_PLAGE',
        bougiesHTF,
        bougiesLTF,
      },
      parametresSMC: {
        activerFiltreTaille: false,
        exigerAutorouteUOP: false,
        activerFiltrePlageTP: false,
      },
    });
    expect(timelineVisuelle.setupsMaitresHTF.length).toBeGreaterThanOrEqual(1);
    expect(timelineVisuelle.rapport.trades.length).toBeGreaterThanOrEqual(1);
  });
});
