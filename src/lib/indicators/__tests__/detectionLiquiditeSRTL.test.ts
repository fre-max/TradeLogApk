import { describe, it, expect } from 'vitest';
import type { Bougie } from '@/lib/chartDataHelper';
import { calculerDetectionLiquiditeSRTL } from '../detectionLiquiditeSRTL';

describe('Détection Liquidité : Zones Supports & Résistances (S/R)', () => {
  it('gère une liste vide ou insuffisante de bougies sans erreur', () => {
    const res = calculerDetectionLiquiditeSRTL([], { profondeurPivot: 4 });
    expect(res.supports).toHaveLength(0);
    expect(res.resistances).toHaveLength(0);
    expect(res.totalZones).toBe(0);
    expect(res.primitives.boites).toHaveLength(0);
  });

  it('ignore un sommet isolé sans retest (exige au moins 2 points d\'ancrage)', () => {
    const bougies: Bougie[] = Array.from({ length: 40 }, (_, i) => ({
      time: 1700000000 + i * 300,
      open: 1.0800,
      high: 1.0810,
      low: 1.0790,
      close: 1.0805,
    }));

    // Un seul sommet isolé à l'index 15
    bougies[15].high = 1.0860;
    for (let k = 1; k <= 4; k++) {
      bougies[15 - k].high = 1.0820;
      bougies[15 + k].high = 1.0820;
    }

    const res = calculerDetectionLiquiditeSRTL(bougies, {
      profondeurPivot: 4,
      minTouches: 2,
    });

    // Aucun niveau ne doit être validé avec 1 seul point d'ancrage !
    expect(res.resistances).toHaveLength(0);
    expect(res.supports).toHaveLength(0);
  });

  it('détecte une Zone de Résistance avec 2 retests même si le 2ème dépasse un peu le 1er (marge)', () => {
    const bougies: Bougie[] = Array.from({ length: 45 }, (_, i) => ({
      time: 1700000000 + i * 300,
      open: 1.0800,
      high: 1.0810,
      low: 1.0790,
      close: 1.0805,
    }));

    // Sommet 1 à l'index 10 (1.0850)
    bougies[10].high = 1.0850;
    for (let k = 1; k <= 4; k++) {
      bougies[10 - k].high = 1.0820;
      bougies[10 + k].high = 1.0820;
    }

    // Sommet 2 à l'index 24 (1.0853 -> dépasse de 3 pips le sommet 1 !)
    bougies[24].high = 1.0853;
    for (let k = 1; k <= 4; k++) {
      bougies[24 - k].high = 1.0820;
      bougies[24 + k].high = 1.0820;
    }

    const res = calculerDetectionLiquiditeSRTL(bougies, {
      profondeurPivot: 4,
      margeZonePips: 5.0, // Tolérance de 5 pips autorisant le dépassement
      epaisseurBufferPips: 2.0,
      minTouches: 2,
    });

    expect(res.resistances.length).toBeGreaterThanOrEqual(1);
    const zone = res.resistances[0];
    expect(zone.nbTouches).toBe(2);
    // Le rectangle englobe le point le plus haut avec de la marge
    expect(zone.prixHaut).toBeGreaterThan(1.0853);
    expect(zone.prixBas).toBeLessThan(1.0850);

    // Primitives graphiques (boîtes rectangulaires créées)
    expect(res.primitives.boites?.length).toBeGreaterThanOrEqual(1);
    const boite = res.primitives.boites![0];
    expect(boite.prixHaut).toBe(zone.prixHaut);
    expect(boite.prixBas).toBe(zone.prixBas);
    expect(boite.label).toContain('BSL');
  });

  it('détecte une Zone de Support avec 2 creux et génère les primitives SSL', () => {
    const bougies: Bougie[] = Array.from({ length: 45 }, (_, i) => ({
      time: 1700000000 + i * 300,
      open: 1.0800,
      high: 1.0815,
      low: 1.0790,
      close: 1.0805,
    }));

    // Creux 1 à l'index 10
    bougies[10].low = 1.0740;
    for (let k = 1; k <= 4; k++) {
      bougies[10 - k].low = 1.0770;
      bougies[10 + k].low = 1.0770;
    }

    // Creux 2 à l'index 25 (1.0738 -> s'enfonce de 2 pips sous le creux 1)
    bougies[25].low = 1.0738;
    for (let k = 1; k <= 4; k++) {
      bougies[25 - k].low = 1.0770;
      bougies[25 + k].low = 1.0770;
    }

    const res = calculerDetectionLiquiditeSRTL(bougies, {
      profondeurPivot: 4,
      margeZonePips: 4.0,
      epaisseurBufferPips: 1.5,
      minTouches: 2,
    });

    expect(res.supports.length).toBeGreaterThanOrEqual(1);
    const zone = res.supports[0];
    expect(zone.nbTouches).toBe(2);
    expect(zone.prixBas).toBeLessThan(1.0738);

    const boite = res.primitives.boites?.find(b => b.label?.includes('SSL'));
    expect(boite).toBeDefined();
  });

  it('détecte la cassure d\'une zone si une bougie clôture franchement au-delà', () => {
    const bougies: Bougie[] = Array.from({ length: 50 }, (_, i) => ({
      time: 1700000000 + i * 300,
      open: 1.0800,
      high: 1.0810,
      low: 1.0790,
      close: 1.0805,
    }));

    bougies[10].high = 1.0850;
    for (let k = 1; k <= 4; k++) {
      bougies[10 - k].high = 1.0820;
      bougies[10 + k].high = 1.0820;
    }

    bougies[22].high = 1.0851;
    for (let k = 1; k <= 4; k++) {
      bougies[22 - k].high = 1.0820;
      bougies[22 + k].high = 1.0820;
    }

    // Bougie 35 casse franchement à la hausse
    bougies[35].close = 1.0900;
    bougies[35].high = 1.0910;

    const res = calculerDetectionLiquiditeSRTL(bougies, {
      profondeurPivot: 4,
      minTouches: 2,
      margeZonePips: 3.0,
      epaisseurBufferPips: 1.0,
    });

    expect(res.resistances.length).toBeGreaterThanOrEqual(1);
    expect(res.resistances[0].estCassee).toBe(true);
  });
});
