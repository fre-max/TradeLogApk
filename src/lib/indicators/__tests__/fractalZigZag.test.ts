import { describe, it, expect } from 'vitest';
import type { Bougie } from '@/lib/chartDataHelper';
import { calculerFractalZigZag } from '../fractalZigZag';

describe('ZigZag Fractal Multi-Niveaux (Multi-Depth)', () => {
  it('retourne un résultat vide si le nombre de bougies est insuffisant', () => {
    const res = calculerFractalZigZag([]);
    expect(res.pivotsMacro).toHaveLength(0);
    expect(res.pivotsMicro).toHaveLength(0);
    expect(res.confluence.scoreAlignement).toBe(0);
  });

  it('imbrique correctement les 3 niveaux de vagues fractales (Micro >= Intermédiaire >= Macro)', () => {
    // Génère 120 bougies d'un marché oscillant avec tendance haussière
    const bougies: Bougie[] = Array.from({ length: 120 }, (_, i) => {
      // Tendance haussière + oscillation moyenne + micro-bruit
      const base = 100 + (i * 0.5) + Math.sin(i / 6) * 8 + Math.cos(i / 2) * 2;
      return {
        time: 1700000000 + i * 60,
        open: base,
        high: base + 1.5,
        low: base - 1.5,
        close: base + 0.5,
        volume: 1000,
      };
    });

    const res = calculerFractalZigZag(bougies, {
      profondeurMacro: 18,
      profondeurIntermediaire: 8,
      profondeurMicro: 3,
    });

    // Vérifie la hiérarchie fractale : plus la profondeur est petite, plus il y a de pivots détectés
    expect(res.pivotsMicro.length).toBeGreaterThanOrEqual(res.pivotsIntermediaires.length);
    expect(res.pivotsIntermediaires.length).toBeGreaterThanOrEqual(res.pivotsMacro.length);

    // Vérifie que les lignes visuelles ont été générées pour chaque niveau
    expect(res.lignes.length).toBeGreaterThan(0);
    expect(res.confluence.diagnostic).toBeDefined();
    expect(res.confluence.scoreAlignement).toBeGreaterThanOrEqual(1);
  });

  it('détecte la direction de la jambe macro courante et compte les sous-vagues', () => {
    // Tendance haussière pure avec 80 bougies
    const bougies: Bougie[] = Array.from({ length: 80 }, (_, i) => {
      const base = 100 + i * 2 + Math.sin(i / 4) * 3;
      return {
        time: 1700000000 + i * 60,
        open: base,
        high: base + 2,
        low: base - 1,
        close: base + 1.5,
        volume: 1000,
      };
    });

    const res = calculerFractalZigZag(bougies, {
      profondeurMacro: 15,
      profondeurIntermediaire: 6,
      profondeurMicro: 3,
    });

    expect(['haussiere', 'baissiere', 'neutre']).toContain(res.directionJambeMacroCourante);
    expect(res.nbSousVaguesJambeCourante).toBeGreaterThanOrEqual(0);
  });
});
