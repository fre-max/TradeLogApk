import { describe, it, expect } from 'vitest';
import type { Bougie } from '@/lib/chartDataHelper';
import {
  calculerLiquidationSweepPointFigure,
  construireColonnesPF,
} from '../liquidationSweepPointFigure';

describe('Indicateur Combiné : Liq/Reint + Sweep Point & Figure (P&F)', () => {
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

  it('construit correctement les colonnes P&F et détecte un retournement', () => {
    const bougies: Bougie[] = [
      creerBougie(1000, 100, 105, 99, 104),
      creerBougie(2000, 104, 110, 103, 109),
      creerBougie(3000, 109, 115, 108, 114), // Colonne X monte jusqu'à 115
      creerBougie(4000, 114, 114, 98, 99),   // Chute sous 105 (Reversal vers O)
      creerBougie(5000, 99, 100, 95, 96),    // Descente continue en O
    ];

    const colonnes = construireColonnesPF(bougies, 4, 2, 3, 50);
    expect(colonnes.length).toBeGreaterThanOrEqual(2);
    expect(colonnes[0].type).toBe('X');
    expect(colonnes[1].type).toBe('O');
  });

  it('détecte un setup ACHAT balayant un palier carré P&F (Support)', () => {
    // Série de bougies formant plusieurs colonnes P&F qui rebondissent vers 100 (Support P&F carré)
    const bougies: Bougie[] = [
      creerBougie(500, 102, 106, 101, 105),
      creerBougie(800, 105, 107, 103, 104),
      creerBougie(1000, 100, 108, 100, 107),
      creerBougie(2000, 107, 107, 100, 101), // Test #1 du niveau 100
      creerBougie(3000, 101, 109, 101, 108),
      creerBougie(4000, 108, 108, 100, 101), // Test #2 du niveau 100
      creerBougie(5000, 101, 110, 101, 109),
      creerBougie(6000, 109, 109, 100, 101), // Test #3 du niveau 100 (Palier carré très testé !)
      creerBougie(7000, 101, 108, 101, 107),
      // Setup Liq/Reint balayant sous 100 :
      // Bougie 1 : Vendeuse (107 -> 97, Low = 95 < 100)
      creerBougie(8000, 107, 107, 95, 97),
      // Bougie 2 : Acheteuse impulsive réintégrant (97 -> 106.8, Low = 96)
      creerBougie(9000, 97, 107, 96, 106.8),
    ];

    const resultat = calculerLiquidationSweepPointFigure(bougies, {
      modeTailleBox: 'fixe',
      tailleBoxPips: 150, // 150 pips = 1.5 pt (pour prix ~ 100 avec pipSize 0.01)
      reversalCount: 2,
      minColonnesAlignees: 2,
      exigerNiveauPFBalaye: true,
      activerFiltreTaille: false,
    });

    expect(resultat.signaux.length).toBeGreaterThanOrEqual(1);
    const sig = resultat.signaux[resultat.signaux.length - 1];
    expect(sig.type).toBe('ACHAT');
    expect(sig.prixExtreme).toBe(95);
    expect(sig.niveauPF).toBeDefined();
    expect(sig.niveauPF?.prixNiveau).toBeGreaterThanOrEqual(98);
    expect(sig.niveauPF?.nbColonnesAlignees).toBeGreaterThanOrEqual(2);

    // Primitives visuelles du signal d'achat final
    expect(resultat.primitives.labels?.length).toBeGreaterThan(0);
    const dernierLabel = resultat.primitives.labels![resultat.primitives.labels!.length - 1];
    expect(dernierLabel.texte).toContain('Support P&F');
    expect(resultat.primitives.lignes?.length).toBeGreaterThan(0);
  });
});
