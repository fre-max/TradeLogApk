import { describe, it, expect } from 'vitest';
import type { Bougie } from '@/lib/chartDataHelper';
import { calculerLiquidationSweepShved } from '../liquidationSweepShved';

describe('Indicateur Combiné : Liq/Reint + Sweep Shved Supply & Demand', () => {
  const creerBougie = (
    time: number,
    open: number,
    high: number,
    low: number,
    close: number
  ): Bougie => ({
    time,
    open,
    high,
    low,
    close,
    volume: 100,
  });

  it('détecte un setup ACHAT avec sweep d une zone Shved Demand', () => {
    // 15 bougies d'historique de base pour initialiser Shved (seuil min = 20 bougies)
    const bougiesInit: Bougie[] = [];
    for (let k = 0; k < 15; k++) {
      bougiesInit.push(creerBougie(k * 1000, 100, 104, 99, 101));
    }

    // Bougies formant la zone de support Shved et le setup final
    const bougiesSetup: Bougie[] = [
      creerBougie(16000, 101, 104, 96, 97),  // Creux fractal Shved à 96
      creerBougie(17000, 97, 104, 97, 103),  // Rebond
      creerBougie(18000, 103, 104, 101, 102),
      creerBougie(19000, 102, 103, 96.5, 98),// Retest de la zone
      creerBougie(20000, 98, 104, 98, 103),  // Rebond
      creerBougie(21000, 103, 104, 101, 102),
      creerBougie(22000, 102, 103, 96.2, 98),// Retest de la zone
      creerBougie(23000, 98, 104, 98, 103),
      creerBougie(24000, 103, 105, 101, 104),
      // Setup Liq/Reint balayant sous la zone vers 94 (< 96) :
      creerBougie(25000, 105, 105, 94, 96),  // Bougie 1 perce la zone (Low = 94)
      creerBougie(26000, 96, 105, 95, 104.8),// Bougie 2 réintègre au-dessus
    ];

    const bougies: Bougie[] = [...bougiesInit, ...bougiesSetup];

    const resultat = calculerLiquidationSweepShved(bougies, {
      periodeATR: 5,
      zoneFuzzFactor: 0.8,
      minRetests: 0,
      exigerZoneShvedBalayee: true,
      activerFiltreTaille: false,
    });

    expect(resultat.signaux.length).toBeGreaterThanOrEqual(1);
    const sig = resultat.signaux[resultat.signaux.length - 1];
    expect(sig.type).toBe('ACHAT');
    expect(sig.prixExtreme).toBe(94);
    expect(sig.zoneShved).toBeDefined();
    expect(sig.zoneShved?.type).toBe('SUPPORT');

    // Primitives : segment en ligne discontinue (dashed) représentant le niveau de liquidité
    expect(resultat.primitives.labels?.length).toBeGreaterThan(0);
    expect(resultat.primitives.labels?.[0]?.texte).toContain('Demand');
    expect(resultat.primitives.lignes?.length).toBeGreaterThan(0);
    expect(resultat.primitives.lignes?.[0]?.style).toBe('dashed');
  });

  it('détecte correctement une Double Liquidation Shved (Re-Sweep)', () => {
    const bougiesInit: Bougie[] = [];
    for (let k = 0; k < 15; k++) {
      bougiesInit.push(creerBougie(k * 1000, 100, 104, 99, 101));
    }

    const bougiesSetup: Bougie[] = [
      creerBougie(16000, 101, 104, 96, 97),  // Creux fractal Shved à 96
      creerBougie(17000, 97, 104, 97, 103),
      creerBougie(18000, 103, 104, 101, 102),
      creerBougie(19000, 102, 103, 96.5, 98),// Retest
      creerBougie(20000, 98, 104, 98, 103),
      creerBougie(21000, 103, 104, 101, 102),
      creerBougie(22000, 102, 103, 96.2, 98),// Retest
      creerBougie(23000, 98, 104, 98, 103),
      creerBougie(24000, 103, 105, 101, 104),
      // Bougie 1 du setup fait une 1ère liquidation (low = 95.5 < 96)
      creerBougie(25000, 105, 105, 95.5, 96),
      // Bougie 2 (le doji) fait la 2ème liquidation / purge finale (low = 93 < 95.5) et réintègre
      creerBougie(26000, 96, 105, 93, 104.8),
    ];

    const bougies = [...bougiesInit, ...bougiesSetup];
    const resultat = calculerLiquidationSweepShved(bougies, {
      periodeATR: 5,
      zoneFuzzFactor: 0.8,
      minRetests: 0,
      detecterDoubleLiquidation: true,
      activerFiltreTaille: false,
    });

    expect(resultat.signaux.length).toBeGreaterThanOrEqual(1);
    const dernierSignal = resultat.signaux[resultat.signaux.length - 1];
    expect(dernierSignal.estDoubleLiquidation).toBe(true);
    expect(dernierSignal.prixPremiereLiquidation).toBe(95.5);
    expect(dernierSignal.prixExtreme).toBe(93);
  });
});
