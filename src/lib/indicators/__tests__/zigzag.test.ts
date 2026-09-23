import { describe, it, expect } from 'vitest';
import {
  calculerZigZag,
  capturerSnapshotZigZag,
} from '../zigzag';
import type { Bougie } from '@/lib/chartDataHelper';

describe('Indicateur ZigZag Autonome avec SMC & Mesure de Vagues', () => {
  // 1️⃣ Test de robustesse : Tableau de bougies trop court
  it('renvoie un état neutre et vide si le nombre de bougies est insuffisant', () => {
    const bougies: Bougie[] = [
      { time: 1, open: 100, high: 105, low: 95, close: 100 },
      { time: 2, open: 100, high: 106, low: 96, close: 101 },
    ];

    const resultat = calculerZigZag(bougies, { depth: 5 });
    expect(resultat.pivots).toHaveLength(0);
    expect(resultat.vagues).toHaveLength(0);
    expect(resultat.tendanceStructurelle).toBe('NEUTRE');
  });

  // 2️⃣ Test d'alternance stricte et labellisation haussière (HH et HL)
  it('identifie correctement une structure haussière avec alternance stricte et labels HH / HL', () => {
    const bougies: Bougie[] = [];

    // Construction d'une séquence avec sommets et creux croissants :
    // 0 à 4: plat bas (prix ~100)
    for (let i = 0; i < 5; i++) {
      bougies.push({ time: i, open: 100, high: 101, low: 99, close: 100 });
    }
    // 5: premier creux bas (low 90)
    bougies.push({ time: 5, open: 98, high: 99, low: 90, close: 95 });
    // 6 à 9: remontée
    for (let i = 6; i < 10; i++) {
      bougies.push({ time: i, open: 95 + (i - 5) * 5, high: 96 + (i - 5) * 5, low: 94 + (i - 5) * 5, close: 95 + (i - 5) * 5 });
    }
    // 10: premier sommet (high 130)
    bougies.push({ time: 10, open: 120, high: 130, low: 118, close: 122 });
    // 11 à 14: redescente
    for (let i = 11; i < 15; i++) {
      bougies.push({ time: i, open: 120 - (i - 10) * 3, high: 121 - (i - 10) * 3, low: 115 - (i - 10) * 3, close: 118 - (i - 10) * 3 });
    }
    // 15: creux plus haut que le précédent (low 105 > 90) -> HL
    bougies.push({ time: 15, open: 110, high: 112, low: 105, close: 108 });
    // 16 à 19: forte hausse
    for (let i = 16; i < 20; i++) {
      bougies.push({ time: i, open: 110 + (i - 15) * 8, high: 112 + (i - 15) * 8, low: 109 + (i - 15) * 8, close: 111 + (i - 15) * 8 });
    }
    // 20: sommet plus haut que 130 (high 150 > 130) -> HH
    bougies.push({ time: 20, open: 145, high: 150, low: 144, close: 146 });
    // 21 à 25: bougies de stabilisation pour que le pivot de 20 soit validé avec depth=3
    for (let i = 21; i <= 26; i++) {
      bougies.push({ time: i, open: 140, high: 142, low: 138, close: 139 });
    }

    const resultat = calculerZigZag(bougies, { depth: 3 });

    // Vérification de la présence des pivots
    expect(resultat.pivots.length).toBeGreaterThanOrEqual(3);

    // Vérifier l'alternance stricte (sommet -> creux ou creux -> sommet)
    for (let i = 0; i < resultat.pivots.length - 1; i++) {
      expect(resultat.pivots[i].estHaut).not.toBe(resultat.pivots[i + 1].estHaut);
    }

    // Trouver les labels HH et HL
    const labels = resultat.pivots.map((p) => p.labelSMC);
    expect(labels).toContain('HH');
    expect(labels).toContain('HL');

    // Tendance structurelle
    expect(resultat.tendanceStructurelle).toBe('BULLISH');
  });

  // 3️⃣ Test de calcul et mesures des vagues
  it('mesure précisément l\'amplitude en points et pips de chaque vague', () => {
    const bougies: Bougie[] = [];

    // Pivot bas initial
    bougies.push({ time: 0, open: 1.1000, high: 1.1010, low: 1.0990, close: 1.1000 });
    for (let i = 1; i < 5; i++) {
      bougies.push({ time: i, open: 1.1000, high: 1.1020, low: 1.0995, close: 1.1005 });
    }
    // Creux à 1.0950 à l'index 5
    bougies.push({ time: 5, open: 1.0980, high: 1.0990, low: 1.0950, close: 1.0970 });
    for (let i = 6; i < 10; i++) {
      bougies.push({ time: i, open: 1.1000, high: 1.1050, low: 1.0990, close: 1.1040 });
    }
    // Sommet à 1.1200 à l'index 10 (mouvement haussier de 250 pips)
    bougies.push({ time: 10, open: 1.1150, high: 1.1200, low: 1.1140, close: 1.1180 });
    for (let i = 11; i <= 15; i++) {
      bougies.push({ time: i, open: 1.1100, high: 1.1120, low: 1.1080, close: 1.1090 });
    }

    const resultat = calculerZigZag(bougies, { depth: 2 });

    expect(resultat.vagues.length).toBeGreaterThan(0);
    const premiereVague = resultat.vagues[0];
    expect(premiereVague.amplitudePoints).toBeGreaterThan(0);
    expect(premiereVague.nbBougies).toBeGreaterThan(0);
    expect(premiereVague.vitessePointsParBougie).toBeGreaterThan(0);
  });

  // 4️⃣ Test de capture de snapshot pour le trade log (télémétrie)
  it('capture un snapshot de télémétrie complet avec distances et structure', () => {
    const bougies: Bougie[] = [];
    for (let i = 0; i < 30; i++) {
      const prix = 100 + Math.sin(i / 3) * 20;
      bougies.push({
        time: i,
        open: prix,
        high: prix + 2,
        low: prix - 2,
        close: prix + 1,
      });
    }

    const resultat = calculerZigZag(bougies, { depth: 3 });
    const prixActuel = bougies[bougies.length - 1].close;
    const indexActuel = bougies.length - 1;

    const snapshot = capturerSnapshotZigZag(resultat, prixActuel, indexActuel);

    expect(snapshot).toHaveProperty('tendanceStructurelle');
    expect(snapshot).toHaveProperty('dernierPivotType');
    expect(snapshot).toHaveProperty('prixDernierPivot');
    expect(snapshot).toHaveProperty('bougiesDepuisDernierPivot');
    expect(snapshot).toHaveProperty('distanceDernierSommetPips');
    expect(snapshot).toHaveProperty('distanceDernierCreuxPips');
    expect(snapshot).toHaveProperty('directionVagueCourante');
    expect(snapshot).toHaveProperty('amplitudeVagueCourantePips');
    expect(snapshot.bougiesDepuisDernierPivot).toBeGreaterThanOrEqual(0);
  });
});
