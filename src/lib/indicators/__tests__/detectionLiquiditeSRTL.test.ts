import { describe, it, expect } from 'vitest';
import type { Bougie } from '@/lib/chartDataHelper';
import { calculerDetectionLiquiditeSRTL } from '../detectionLiquiditeSRTL';

describe('Détection Liquidité : Support / Résistance & Trendline (SRTL)', () => {
  it('gère une liste vide ou insuffisante de bougies sans erreur', () => {
    const res = calculerDetectionLiquiditeSRTL([], { profondeurPivot: 4 });
    expect(res.supports).toHaveLength(0);
    expect(res.resistances).toHaveLength(0);
    expect(res.trendlinesHaussieres).toHaveLength(0);
    expect(res.totalNiveauxSR).toBe(0);
    expect(res.totalTrendlines).toBe(0);
  });

  it('détecte une Résistance horizontale (BSL) avec 2 sommets alignés', () => {
    const bougies: Bougie[] = Array.from({ length: 40 }, (_, i) => ({
      time: 1700000000 + i * 300,
      open: 1.0800,
      high: 1.0810,
      low: 1.0790,
      close: 1.0805,
    }));

    // Sommet 1
    bougies[10].high = 1.0850;
    for (let k = 1; k <= 4; k++) {
      bougies[10 - k].high = 1.0820;
      bougies[10 + k].high = 1.0820;
    }

    // Sommet 2
    bougies[22].high = 1.0851;
    for (let k = 1; k <= 4; k++) {
      bougies[22 - k].high = 1.0820;
      bougies[22 + k].high = 1.0820;
    }

    const res = calculerDetectionLiquiditeSRTL(bougies, {
      modeDetection: 'sr_seulement',
      profondeurPivot: 4,
      tolerancePips: 2.0,
      minTouches: 2,
    });

    expect(res.resistances.length).toBeGreaterThanOrEqual(1);
    expect(res.resistances[0].prix).toBeCloseTo(1.08505, 4);
    expect(res.primitives.lignes?.length).toBeGreaterThanOrEqual(1);
    expect(res.trendlinesHaussieres.length).toBe(0); // Mode SR uniquement
  });

  it('détecte une Trendline Haussière oblique (SSL) reliant des creux ascendants', () => {
    const bougies: Bougie[] = Array.from({ length: 40 }, (_, i) => ({
      time: 1700000000 + i * 300,
      open: 1.0800 + i * 0.0003,
      high: 1.0815 + i * 0.0003,
      low: 1.0795 + i * 0.0003,
      close: 1.0810 + i * 0.0003,
    }));

    // Creux 1 à l'index 8
    bougies[8].low = 1.0750;
    for (let k = 1; k <= 3; k++) {
      bougies[8 - k].low = 1.0780;
      bougies[8 + k].low = 1.0780;
    }

    // Creux 2 à l'index 20 (ascendant : 1.0790 > 1.0750)
    bougies[20].low = 1.0790;
    for (let k = 1; k <= 3; k++) {
      bougies[20 - k].low = 1.0820;
      bougies[20 + k].low = 1.0820;
    }

    const res = calculerDetectionLiquiditeSRTL(bougies, {
      modeDetection: 'trendline_seulement',
      profondeurPivot: 3,
      minBougiesEntrePivots: 5,
      minTouches: 2,
    });

    expect(res.trendlinesHaussieres.length).toBeGreaterThanOrEqual(1);
    const tl = res.trendlinesHaussieres[0];
    expect(tl.direction).toBe('HAUSSIERE');
    expect(tl.typeLiquidite).toBe('SSL');
    expect(tl.pente).toBeGreaterThan(0);
    expect(tl.prixFin).toBeGreaterThan(tl.prixDepart); // Ligne ascendante !

    // Vérifie que les lignes graphiques ont prixFin pour le rendu oblique
    const ligneGraphique = res.primitives.lignes?.find(l => l.id?.includes('tl-'));
    expect(ligneGraphique).toBeDefined();
    expect(ligneGraphique?.prixFin).toBeDefined();
  });

  it('respecte le filtrage des modes dans les variables externes', () => {
    const bougies: Bougie[] = Array.from({ length: 40 }, (_, i) => ({
      time: 1700000000 + i * 300,
      open: 1.0800,
      high: 1.0810,
      low: 1.0790,
      close: 1.0805,
    }));

    bougies[10].high = 1.0850;
    bougies[22].high = 1.0850;

    const resSR = calculerDetectionLiquiditeSRTL(bougies, { modeDetection: 'sr_seulement', profondeurPivot: 4 });
    expect(resSR.trendlinesBaissieres).toHaveLength(0);
    expect(resSR.trendlinesHaussieres).toHaveLength(0);

    const resTL = calculerDetectionLiquiditeSRTL(bougies, { modeDetection: 'trendline_seulement', profondeurPivot: 4 });
    expect(resTL.supports).toHaveLength(0);
    expect(resTL.resistances).toHaveLength(0);
  });

  it('exécute avec succès le script autonome importable Detection_Liquidite_SR_Trendline.js', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const scriptPath = path.resolve(__dirname, '../../../../indicateurs_importables/Detection_Liquidite_SR_Trendline.js');
    const code = fs.readFileSync(scriptPath, 'utf-8');

    const bougies: Bougie[] = Array.from({ length: 40 }, (_, i) => ({
      time: 1700000000 + i * 300,
      open: 1.0800,
      high: 1.0810,
      low: 1.0790,
      close: 1.0805,
    }));
    bougies[10].high = 1.0850;
    bougies[22].high = 1.0850;

    const fnConstructeur = new Function('contexte', code);
    const instance = fnConstructeur({ bougies, parametres: { modeDetection: 'tous' } });
    const resultat = instance.calculer({ bougies, parametres: { modeDetection: 'tous' } });

    expect(resultat).toBeDefined();
    expect(resultat.primitives.lignes.length).toBeGreaterThanOrEqual(1);
    expect(resultat.donnees.mode).toBe('tous');
  });
});
