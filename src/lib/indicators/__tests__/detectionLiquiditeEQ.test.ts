import { describe, it, expect } from 'vitest';
import type { Bougie } from '@/lib/chartDataHelper';
import {
  calculerDetectionLiquiditeEQ,
  deduireTaillePip,
} from '@/lib/bot/modules';

describe('Détection Liquidité EQH / EQL - Modèle SMC Sweep Profiler', () => {
  it('retourne un résultat vide si le nombre de bougies est insuffisant', () => {
    const resultat = calculerDetectionLiquiditeEQ([], { profondeurPivot: 5 });
    expect(resultat.niveaux).toHaveLength(0);
    expect(resultat.totalEQH).toBe(0);
    expect(resultat.totalEQL).toBe(0);
  });

  it('calcule correctement la taille du pip selon l\'actif', () => {
    expect(deduireTaillePip(1.0850)).toBe(0.0001); // Forex
    expect(deduireTaillePip(155.50)).toBe(0.01);   // JPY
    expect(deduireTaillePip(2600.0)).toBe(0.1);    // Gold / Indices
  });

  it('détecte des Equal Highs (EQH / BSL) sur deux sommets alignés', () => {
    // Création de 40 bougies avec deux sommets majeurs à 1.0850
    // Pivot 1 à l'index 10 (high: 1.0850)
    // Pivot 2 à l'index 22 (high: 1.0851, dans la tolérance de 1.5 pips)
    const bougies: Bougie[] = Array.from({ length: 40 }, (_, i) => ({
      time: 1700000000 + i * 300,
      open: 1.0800,
      high: 1.0810,
      low: 1.0790,
      close: 1.0805,
    }));

    // Pivot 1
    bougies[10].high = 1.0850;
    // Bougies autour plus basses
    for (let k = 1; k <= 5; k++) {
      bougies[10 - k].high = 1.0820;
      bougies[10 + k].high = 1.0820;
    }

    // Pivot 2 (12 bougies plus loin)
    bougies[22].high = 1.0851;
    for (let k = 1; k <= 5; k++) {
      bougies[22 - k].high = 1.0820;
      bougies[22 + k].high = 1.0820;
    }

    const resultat = calculerDetectionLiquiditeEQ(bougies, {
      profondeurPivot: 4,
      tolerancePips: 2.0,
      minBougiesEntrePivots: 4,
      maxBougiesEntrePivots: 30,
    });

    expect(resultat.totalEQH).toBeGreaterThanOrEqual(1);
    const eqh = resultat.niveaux.find((n) => n.type === 'EQH');
    expect(eqh).toBeDefined();
    expect(eqh?.estSwept).toBe(false); // Pas encore balayé
    expect(eqh?.prix).toBeCloseTo(1.08505, 4);
    expect(resultat.dernierEQH).toBeDefined();
  });

  it('détecte des Equal Lows (EQL / SSL) sur deux creux alignés', () => {
    // Création de 40 bougies avec deux creux majeurs à 1.0700
    const bougies: Bougie[] = Array.from({ length: 40 }, (_, i) => ({
      time: 1700000000 + i * 300,
      open: 1.0750,
      high: 1.0760,
      low: 1.0740,
      close: 1.0745,
    }));

    // Pivot Bas 1
    bougies[10].low = 1.0700;
    for (let k = 1; k <= 5; k++) {
      bougies[10 - k].low = 1.0725;
      bougies[10 + k].low = 1.0725;
    }

    // Pivot Bas 2
    bougies[22].low = 1.0701;
    for (let k = 1; k <= 5; k++) {
      bougies[22 - k].low = 1.0725;
      bougies[22 + k].low = 1.0725;
    }

    const resultat = calculerDetectionLiquiditeEQ(bougies, {
      profondeurPivot: 4,
      tolerancePips: 2.0,
      minBougiesEntrePivots: 4,
      maxBougiesEntrePivots: 30,
    });

    expect(resultat.totalEQL).toBeGreaterThanOrEqual(1);
    const eql = resultat.niveaux.find((n) => n.type === 'EQL');
    expect(eql).toBeDefined();
    expect(eql?.prix).toBeCloseTo(1.07005, 4);
  });

  it('invalide un EQH si une bougie intermédiaire dépasse largement le niveau', () => {
    const bougies: Bougie[] = Array.from({ length: 40 }, (_, i) => ({
      time: 1700000000 + i * 300,
      open: 1.0800,
      high: 1.0810,
      low: 1.0790,
      close: 1.0805,
    }));

    // Pivot 1
    bougies[10].high = 1.0850;
    // Pivot 2
    bougies[22].high = 1.0850;

    // Violation intermédiaire : la bougie 16 explose au-dessus
    bougies[16].high = 1.0900;

    const resultat = calculerDetectionLiquiditeEQ(bougies, {
      profondeurPivot: 4,
      tolerancePips: 1.5,
    });

    // L'EQH entre 10 et 22 doit être rejeté car non propre
    const eqhEntre10Et22 = resultat.niveaux.find(
      (n) => n.indexPivot1 === 10 && n.indexPivot2 === 22
    );
    expect(eqhEntre10Et22).toBeUndefined();
  });

  it('détecte le balayage (sweep) lorsqu une bougie ultérieure traverse le niveau et réintègre', () => {
    const bougies: Bougie[] = Array.from({ length: 40 }, (_, i) => ({
      time: 1700000000 + i * 300,
      open: 1.0800,
      high: 1.0810,
      low: 1.0790,
      close: 1.0805,
    }));

    // Pivot 1
    bougies[8].high = 1.0850;
    for (let k = 1; k <= 3; k++) {
      bougies[8 - k].high = 1.0820;
      bougies[8 + k].high = 1.0820;
    }

    // Pivot 2
    bougies[18].high = 1.0850;
    for (let k = 1; k <= 3; k++) {
      bougies[18 - k].high = 1.0820;
      bougies[18 + k].high = 1.0820;
    }

    // Bougie de balayage à l'index 28 :
    // Mèche haute à 1.0865 (dépassement de 1.5 pips), mais clôture réintégrée sous l'EQH à 1.0830
    bougies[28].high = 1.0865;
    bougies[28].close = 1.0830;

    const resultat = calculerDetectionLiquiditeEQ(bougies, {
      profondeurPivot: 3,
      tolerancePips: 2.0,
      minSweepPips: 0.5,
      exigerReintegration: true,
    });

    const eqh = resultat.niveaux.find((n) => n.type === 'EQH');
    expect(eqh).toBeDefined();
    expect(eqh?.estSwept).toBe(true);
    expect(eqh?.indexSweep).toBe(28);
    expect(resultat.niveauxBalayes.length).toBeGreaterThanOrEqual(1);
  });

  it('exécute avec succès le script autonome importable Detection_Liquidite_EQH_EQL.js', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const scriptPath = path.resolve(__dirname, '../../../../indicateurs_importables/Detection_Liquidite_EQH_EQL.js');
    const code = fs.readFileSync(scriptPath, 'utf-8');

    const bougies: Bougie[] = Array.from({ length: 40 }, (_, i) => ({
      time: 1700000000 + i * 300,
      open: 1.0800,
      high: 1.0810,
      low: 1.0790,
      close: 1.0805,
    }));
    bougies[10].high = 1.0850;
    bougies[22].high = 1.0851;

    // Simulation directe de l'évaluation du script autonome importé
    const fnConstructeur = new Function('contexte', code);
    const instance = fnConstructeur({ bougies, parametres: { profondeurPivot: 4 } });
    const resultat = instance.calculer({ bougies, parametres: { profondeurPivot: 4 } });

    expect(resultat).toBeDefined();
    expect(resultat.primitives.lignes.length).toBeGreaterThanOrEqual(1);
    expect(resultat.donnees.totalEQH).toBeGreaterThanOrEqual(1);
  });
});
