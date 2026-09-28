import { describe, it, expect } from 'vitest';
import { calculerOverMitigationHighway } from '../overMitigationHighway';
import type { Bougie } from '@/lib/chartDataHelper';

describe('Indicateur Couloir d\'Over-Mitigation & Autoroute vers le TP', () => {
  it('retourne un résultat vide si le nombre de bougies est insuffisant', () => {
    const res = calculerOverMitigationHighway([]);
    expect(res.scoreAutoroute).toBe(0);
    expect(res.estAutorouteDegagee).toBe(false);
  });

  it('calcule correctement le score d\'autoroute sur un couloir sans obstacle', () => {
    // Génération de bougies stables et oscillantes (over-mitigated)
    const bougies: Bougie[] = Array.from({ length: 50 }, (_, i) => ({
      time: 1700000000 + i * 3600,
      open: 1.0800 + Math.sin(i / 2) * 0.0050,
      high: 1.0860 + Math.sin(i / 2) * 0.0050,
      low: 1.0740 + Math.sin(i / 2) * 0.0050,
      close: 1.0810 + Math.sin(i / 2) * 0.0050,
    }));

    const res = calculerOverMitigationHighway(bougies, {
      direction: 'achat',
      prixTPManuel: 1.0850,
      seuilAutoroutePourcent: 70,
    });

    expect(res.prixEntree).toBeGreaterThan(0);
    expect(res.prixTP).toBe(1.0850);
    expect(res.scoreAutoroute).toBeGreaterThan(0);
    expect(res.primitives.boites?.length).toBeGreaterThan(0);
    expect(res.primitives.lignes?.length).toBeGreaterThan(0);
  });

  it('détecte un obstacle FVG non comblé dans le couloir et baisse le score', () => {
    // Création d'une impulsion brutale avec un FVG baissier non comblé
    const bougies: Bougie[] = [
      { time: 1000, open: 1.0900, high: 1.0950, low: 1.0890, close: 1.0910 },
      { time: 2000, open: 1.0880, high: 1.0885, low: 1.0750, close: 1.0760 }, // Grosse bougie rouge
      { time: 3000, open: 1.0760, high: 1.0770, low: 1.0720, close: 1.0730 }, // b2.high (1.0770) < b0.low (1.0890) -> FVG ouvert !
      ...Array.from({ length: 20 }, (_, i) => ({
        time: 4000 + i * 1000,
        open: 1.0730,
        high: 1.0750,
        low: 1.0710,
        close: 1.0740,
      })),
    ];

    const res = calculerOverMitigationHighway(bougies, {
      direction: 'achat',
      prixTPManuel: 1.0920,
    });

    expect(res.totalObstacles).toBeGreaterThan(0);
    expect(res.obstacles.some(obs => obs.type === 'fvg')).toBe(true);
  });
});
