import { describe, it, expect } from 'vitest';
import type { Bougie } from '@/lib/chartDataHelper';
import {
  calculerLiquidationSweepChevauchementMultiVagues,
} from '../liquidationSweepChevauchementMultiVagues';

function creerBougie(
  time: number,
  open: number,
  high: number,
  low: number,
  close: number
): Bougie {
  return { time, open, high, low, close, volume: 1000 };
}

describe('Indicateur 3 : Liq/Reint + Sweep Chevauchement Multi-Vagues (UOP Zones Fortes)', () => {
  it('gère une liste vide ou insuffisante de bougies sans planter', () => {
    const res = calculerLiquidationSweepChevauchementMultiVagues([]);
    expect(res.signaux).toHaveLength(0);
    expect(res.primitives.lignes).toHaveLength(0);
  });

  it('détecte un setup Spring balayant une zone forte UOP superposée sous le prix', () => {
    // Construction de plusieurs vagues superposées qui créent un fort cumul de trafic autour de 100.0
    const bougiesVagues: Bougie[] = [
      // Vague 1 : 98 -> 106
      creerBougie(100, 98, 101, 98, 100),
      creerBougie(200, 100, 103, 99.5, 102),
      creerBougie(300, 102, 106, 101, 105),
      // Vague 2 : 106 -> 99
      creerBougie(400, 105, 105, 102, 103),
      creerBougie(500, 103, 104, 99.5, 101), // passe par 100
      creerBougie(600, 101, 102, 99.0, 99.5),
      // Vague 3 : 99 -> 108
      creerBougie(700, 100, 103, 99.5, 102), // passe par 100
      creerBougie(800, 102, 105, 101, 104),
      creerBougie(900, 104, 108, 103, 107),
      // Vague 4 : 108 -> 100.5
      creerBougie(1000, 107, 107, 103, 104),
      creerBougie(1100, 104, 104, 100.2, 101),// repasse par 100
      creerBougie(1200, 101, 103, 100.5, 102),
    ];

    // Setup Spring : Bougie 1 perce sous 100 (Low = 97.0), Bougie 2 réintègre au-dessus
    const bougiesSetup: Bougie[] = [
      creerBougie(1300, 102, 103, 97.0, 98.0), // Bougie 1 : impulsion baissière
      creerBougie(1400, 98.0, 103, 97.5, 102.5),// Bougie 2 : réintégration haussière
    ];

    const bougies = [...bougiesVagues, ...bougiesSetup];

    const resultat = calculerLiquidationSweepChevauchementMultiVagues(bougies, {
      zigzagDepth: 2,
      zigzagBackstep: 1,
      seuilBougiesBleuFonce: 2,
      nbVaguesSuperposees: 4,
      activerFiltreTaille: false,
    });

    expect(resultat.signaux.length).toBeGreaterThanOrEqual(1);
    const signal = resultat.signaux[resultat.signaux.length - 1];
    expect(signal.type).toBe('ACHAT');
    expect(signal.prixExtreme).toBe(97.0);
    expect(signal.palierUOP).toBeDefined();

    // Primitives : segment en ligne discontinue
    expect(resultat.primitives.lignes?.length).toBeGreaterThan(0);
    expect(resultat.primitives.lignes?.[0]?.style).toBe('dashed');
    expect(resultat.primitives.lignes?.[0]?.label).toContain('Zone UOP');
    expect(resultat.primitives.boites).toHaveLength(0);
  });

  it('détecte un setup UTAD balayant une zone forte UOP superposée au-dessus du prix', () => {
    // Vagues superposées avec forte concentration autour de 110.0
    const bougiesVagues: Bougie[] = [
      creerBougie(100, 102, 105, 101, 104),
      creerBougie(200, 104, 110.5, 104, 110), // passe par 110
      creerBougie(300, 110, 112, 109, 111),
      creerBougie(400, 111, 111, 106, 107),
      creerBougie(500, 107, 110.2, 106, 110), // repasse par 110
      creerBougie(600, 110, 113, 109, 112),
      creerBougie(700, 112, 112, 107, 108),
      creerBougie(800, 108, 110.5, 108, 110), // repasse par 110
      creerBougie(900, 110, 111, 108, 109),
    ];

    const bougiesSetup: Bougie[] = [
      creerBougie(1000, 109, 114.5, 108.5, 113.5), // Bougie 1 : impulsion haussière balayant 110 et le sommet (High = 114.5)
      creerBougie(1100, 113.5, 114.0, 108.0, 108.5), // Bougie 2 : réintégration baissière sous 109 (Close = 108.5)
    ];

    const bougies = [...bougiesVagues, ...bougiesSetup];

    const resultat = calculerLiquidationSweepChevauchementMultiVagues(bougies, {
      zigzagDepth: 2,
      zigzagBackstep: 1,
      seuilBougiesBleuFonce: 2,
      nbVaguesSuperposees: 3,
      activerFiltreTaille: false,
    });

    expect(resultat.signaux.length).toBeGreaterThanOrEqual(1);
    const signal = resultat.signaux[resultat.signaux.length - 1];
    expect(signal.type).toBe('VENTE');
    expect(signal.prixExtreme).toBe(114.5);
    expect(signal.palierUOP).toBeDefined();

    expect(resultat.primitives.lignes?.length).toBeGreaterThan(0);
    expect(resultat.primitives.lignes?.[0]?.style).toBe('dashed');
    expect(resultat.primitives.lignes?.[0]?.label).toContain('Zone UOP');
    expect(resultat.primitives.boites).toHaveLength(0);
  });
});
