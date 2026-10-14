import { describe, it, expect } from 'vitest';
import type { Bougie } from '@/lib/chartDataHelper';
import {
  calculerLiquidationSweepChevauchementVagueOpposee,
} from '../liquidationSweepChevauchementVagueOpposee';

function creerBougie(
  time: number,
  open: number,
  high: number,
  low: number,
  close: number
): Bougie {
  return { time, open, high, low, close, volume: 1000 };
}

describe('Indicateur 2 : Liq/Reint + Sweep Chevauchement Vague Opposée (ZigZag)', () => {
  it('gère une liste vide ou insuffisante de bougies sans planter', () => {
    const res = calculerLiquidationSweepChevauchementVagueOpposee([]);
    expect(res.signaux).toHaveLength(0);
    expect(res.primitives.lignes).toHaveLength(0);
  });

  it('détecte un setup Spring balayant le palier de chevauchement de la vague descendante précédente', () => {
    // 1️⃣ Construction d'une séquence avec sommet ZigZag puis vague descendante
    const bougiesInitiales: Bougie[] = [
      creerBougie(100, 100, 102, 99, 101),
      creerBougie(200, 101, 103, 100, 102),
      creerBougie(300, 102, 105, 101, 104),
      creerBougie(400, 104, 108, 103, 107),
      creerBougie(500, 107, 112, 106, 111), // Sommet ZigZag majeur à 112
      creerBougie(600, 111, 111, 107, 108),
    ];

    const bougiesVagueDescendante: Bougie[] = [
      creerBougie(1000, 108, 109, 104, 105),
      creerBougie(2000, 105, 106, 101, 102),
      creerBougie(3000, 102, 104, 99.5, 101), // Zone de compression / chevauchement dense
      creerBougie(4000, 101, 103, 99.0, 100),  // 3 bougies autour de 100
      creerBougie(5000, 100, 102, 99.5, 101),
      creerBougie(6000, 101, 102, 98.0, 98.5), // Creux de vague à 98
    ];

    // 2️⃣ Setup Liq/Reint qui vient purger en dessous de 98 (vers 96.5) et réintégrer
    const bougiesSetup: Bougie[] = [
      creerBougie(7000, 103, 104, 96.5, 97.0), // Bougie 1 : Impulsion baissière (Low = 96.5 balaye le creux 98 et la zone 100)
      creerBougie(8000, 97.0, 104, 97.0, 103.5),// Bougie 2 : Réintégration haussière forte (Close = 103.5)
    ];

    const bougies = [...bougiesInitiales, ...bougiesVagueDescendante, ...bougiesSetup];

    const resultat = calculerLiquidationSweepChevauchementVagueOpposee(bougies, {
      zigzagDepth: 2,
      zigzagBackstep: 1,
      minBougiesChevauchement: 2,
      activerFiltreTaille: false,
    });

    expect(resultat.signaux.length).toBeGreaterThanOrEqual(1);
    const signal = resultat.signaux[resultat.signaux.length - 1];
    expect(signal.type).toBe('ACHAT');
    expect(signal.prixExtreme).toBe(96.5);
    expect(signal.vagueOpposee).toBeDefined();
    expect(signal.vagueOpposee?.nbBougiesChevauchement).toBeGreaterThanOrEqual(2);

    // Primitives : segment en ligne discontinue
    expect(resultat.primitives.lignes?.length).toBeGreaterThan(0);
    expect(resultat.primitives.lignes?.[0]?.style).toBe('dashed');
    expect(resultat.primitives.lignes?.[0]?.label).toContain('Vague Opposée');
    expect(resultat.primitives.boites).toHaveLength(0);
  });

  it('détecte un setup UTAD balayant le palier de chevauchement de la vague montante précédente', () => {
    // Séquence : creux majeur, vague montante avec fort chevauchement, puis setup UTAD de purge par le haut
    const bougiesInitiales: Bougie[] = [
      creerBougie(100, 110, 111, 108, 109),
      creerBougie(200, 109, 110, 107, 108),
      creerBougie(300, 108, 109, 105, 106),
      creerBougie(400, 106, 107, 102, 103),
      creerBougie(500, 103, 104, 98.0, 99.0), // Creux ZigZag majeur à 98
      creerBougie(600, 99, 101, 99, 100),
    ];

    const bougiesVagueMontante: Bougie[] = [
      creerBougie(1000, 100, 103, 100, 102),
      creerBougie(2000, 102, 106, 102, 105),
      creerBougie(3000, 105, 108, 104, 107), // Zone de forte friction / chevauchement dense
      creerBougie(4000, 107, 109, 106, 108), // plusieurs bougies autour de 107-108
      creerBougie(5000, 108, 109, 106.5, 108),
      creerBougie(6000, 108, 110, 107.5, 109.5), // Sommet de vague à 110
    ];

    const bougiesSetup: Bougie[] = [
      creerBougie(7000, 108, 112.5, 107, 111.5), // Bougie 1 : Impulsion haussière (High = 112.5 balaye le sommet 110)
      creerBougie(8000, 111.5, 112.0, 106.5, 107.0),// Bougie 2 : Réintégration baissière sous 108 (Close = 107.0)
    ];

    const bougies = [...bougiesInitiales, ...bougiesVagueMontante, ...bougiesSetup];

    const resultat = calculerLiquidationSweepChevauchementVagueOpposee(bougies, {
      zigzagDepth: 2,
      zigzagBackstep: 1,
      minBougiesChevauchement: 2,
      activerFiltreTaille: false,
    });

    expect(resultat.signaux.length).toBeGreaterThanOrEqual(1);
    const signal = resultat.signaux[resultat.signaux.length - 1];
    expect(signal.type).toBe('VENTE');
    expect(signal.prixExtreme).toBe(112.5);
    expect(signal.vagueOpposee).toBeDefined();

    expect(resultat.primitives.lignes?.length).toBeGreaterThan(0);
    expect(resultat.primitives.lignes?.[0]?.style).toBe('dashed');
    expect(resultat.primitives.lignes?.[0]?.label).toContain('Vague Opposée');
    expect(resultat.primitives.boites).toHaveLength(0);
  });
});
