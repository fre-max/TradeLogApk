import { describe, it, expect } from 'vitest';
import {
  calculerLuxAlgoSMC,
  capturerSnapshotSMC,
} from '../luxAlgoSMC';
import type { Bougie } from '@/lib/chartDataHelper';

describe('Indicateur LuxAlgo Smart Money Concepts (SMC)', () => {
  // 1️⃣ Test de robustesse : Tableau trop court
  it('renvoie un état vide et neutre si les données sont insuffisantes', () => {
    const bougies: Bougie[] = [
      { time: 1, open: 100, high: 105, low: 95, close: 100 },
      { time: 2, open: 100, high: 106, low: 96, close: 101 },
    ];

    const res = calculerLuxAlgoSMC(bougies, { swingLength: 10, internalLength: 3 });
    expect(res.cassures).toHaveLength(0);
    expect(res.orderBlocks).toHaveLength(0);
    expect(res.tendanceSwing).toBe('NEUTRE');
  });

  // 2️⃣ Test de détection de BOS et CHoCH
  it('détecte une cassure structurelle haussière (BOS/CHoCH) et crée un Order Block', () => {
    const bougies: Bougie[] = [];

    // Phase 1 : Consolidation initiale (index 0 à 10)
    for (let i = 0; i <= 10; i++) {
      bougies.push({ time: i, open: 100, high: 102, low: 98, close: 100 });
    }

    // Phase 2 : Sommet pivot à l'index 11 (high à 115)
    bougies.push({ time: 11, open: 105, high: 115, low: 104, close: 112 });

    // Phase 3 : Descente et creux local à 95 (index 12 à 18)
    for (let i = 12; i <= 18; i++) {
      const p = 110 - (i - 11) * 2;
      bougies.push({ time: i, open: p, high: p + 1, low: p - 1, close: p });
    }

    // Phase 4 : Forte impulsion haussière qui casse les 115 (index 19 à 25)
    for (let i = 19; i <= 24; i++) {
      const p = 98 + (i - 18) * 4;
      bougies.push({ time: i, open: p, high: p + 2, low: p - 1, close: p + 1 });
    }

    // Bougie 25 qui clôture nettement au-dessus de 115 (close 122)
    bougies.push({ time: 25, open: 118, high: 125, low: 117, close: 122 });

    // Bougies suivantes
    for (let i = 26; i <= 30; i++) {
      bougies.push({ time: i, open: 122, high: 124, low: 120, close: 121 });
    }

    const res = calculerLuxAlgoSMC(bougies, {
      swingLength: 5,
      internalLength: 2,
    });

    expect(res.cassures.length).toBeGreaterThan(0);
    const cassureHaussiere = res.cassures.find((c) => c.biais === 1);
    expect(cassureHaussiere).toBeDefined();
    expect(cassureHaussiere?.type).toMatch(/BOS|CHoCH/);

    // Vérifier la présence d'un Order Block généré par la cassure
    expect(res.orderBlocks.length).toBeGreaterThan(0);
    const obBull = res.orderBlocks.find((o) => o.biais === 1);
    expect(obBull).toBeDefined();
  });

  // 3️⃣ Test de mitigation d'un Order Block
  it('identifie correctement la mitigation d\'un Order Block lorsque le prix revient le tester', () => {
    const bougies: Bougie[] = [];

    for (let i = 0; i <= 10; i++) {
      bougies.push({ time: i, open: 100, high: 101, low: 99, close: 100 });
    }

    // Pivot haut
    bougies.push({ time: 11, open: 100, high: 110, low: 99, close: 108 });
    for (let i = 12; i <= 16; i++) {
      bougies.push({ time: i, open: 105, high: 106, low: 103, close: 104 });
    }
    // Cassure haussière
    bougies.push({ time: 17, open: 108, high: 116, low: 107, close: 114 });

    // Retracement qui traverse complètement l'OB vers le bas (mitigation)
    bougies.push({ time: 18, open: 112, high: 113, low: 96, close: 97 });
    bougies.push({ time: 19, open: 97, high: 99, low: 95, close: 98 });

    const res = calculerLuxAlgoSMC(bougies, {
      swingLength: 4,
      internalLength: 2,
    });

    const obMitige = res.orderBlocks.find((o) => o.mitige);
    expect(obMitige).toBeDefined();
  });

  // 4️⃣ Test des zones Premium / Discount & Équilibre
  it('calcule correctement les zones Premium, Discount et le prix d\'Équilibre (50%)', () => {
    const bougies: Bougie[] = [
      { time: 1, open: 100, high: 100, low: 100, close: 100 },
      { time: 2, open: 100, high: 200, low: 100, close: 180 }, // Haut à 200
      { time: 3, open: 180, high: 180, low: 100, close: 120 }, // Bas à 100
      { time: 4, open: 120, high: 195, low: 115, close: 190 }, // Prix actuel à 190 (Zone Premium)
    ];

    const res = calculerLuxAlgoSMC(bougies, {
      swingLength: 1,
      internalLength: 1,
    });

    expect(res.premiumDiscount).toBeDefined();
    if (res.premiumDiscount) {
      expect(res.premiumDiscount.hautRange).toBe(200);
      expect(res.premiumDiscount.basRange).toBe(100);
      expect(res.premiumDiscount.prixEquilibre).toBe(150);
      expect(res.premiumDiscount.positionActuelle).toBe('PREMIUM');
      expect(res.premiumDiscount.pourcentageRange).toBe(90);
    }
  });

  // 5️⃣ Test de la capture de snapshot technique (télémétrie de trade)
  it('capture un snapshot complet pour alimenter le journal de trading', () => {
    const bougies: Bougie[] = [];
    for (let i = 0; i < 30; i++) {
      const p = 1.0800 + Math.sin(i / 2) * 0.0050;
      bougies.push({
        time: i,
        open: p,
        high: p + 0.0010,
        low: p - 0.0010,
        close: p + 0.0005,
      });
    }

    const res = calculerLuxAlgoSMC(bougies, { swingLength: 5, internalLength: 2 });
    const snap = capturerSnapshotSMC(res, 1.0820);

    expect(snap).toHaveProperty('tendanceSwing');
    expect(snap).toHaveProperty('tendanceInterne');
    expect(snap).toHaveProperty('positionRange');
    expect(snap).toHaveProperty('pourcentageRange');
    expect(snap).toHaveProperty('proximiteOrderBlockPips');
    expect(snap).toHaveProperty('nbOrderBlocksActifs');
    expect(snap).toHaveProperty('nbEQHActifs');
    expect(snap).toHaveProperty('nbEQLActifs');
    expect(snap).toHaveProperty('nbFVGActifs');
  });
});
