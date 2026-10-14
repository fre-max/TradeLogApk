import { describe, it, expect } from 'vitest';
import type { Bougie } from '@/lib/chartDataHelper';
import {
  calculerLiquidationSweepChevauchementExtremes,
  identifierPalierExtremeAdapte,
} from '../liquidationSweepChevauchementExtremes';

function creerBougie(
  time: number,
  open: number,
  high: number,
  low: number,
  close: number
): Bougie {
  return { time, open, high, low, close, volume: 1000 };
}

describe('Indicateur 1 : Liq/Reint + Sweep Chevauchement Extrêmes (Mèches / Faces)', () => {
  it('gère une liste vide ou insuffisante de bougies sans planter', () => {
    const res = calculerLiquidationSweepChevauchementExtremes([]);
    expect(res.signaux).toHaveLength(0);
    expect(res.primitives.lignes).toHaveLength(0);
    expect(res.primitives.labels).toHaveLength(0);
  });

  it('détecte un setup Spring Acheteur balayant un plancher de mèches basses chevauchées', () => {
    // Création d'un historique où plusieurs mèches basses s'accumulent autour de 98.0 - 99.0 (Face Basse)
    const bougies: Bougie[] = [
      creerBougie(1000, 102, 104, 100, 103),
      creerBougie(2000, 103, 105, 98.2, 102), // Mèche basse touche 98.2
      creerBougie(3000, 102, 104, 98.0, 101), // Mèche basse touche 98.0
      creerBougie(4000, 101, 103, 98.1, 102), // Mèche basse touche 98.1 -> Chevauchement dense sur 98.0 - 98.5
      creerBougie(5000, 102, 105, 101, 104),  // Remontée
      creerBougie(6000, 104, 106, 103, 105),
      creerBougie(7000, 105, 105, 96.0, 97.0), // Bougie 1 : Impulsion baissière de purge (Low = 96.0) balaye le 98.0
      creerBougie(8000, 97.0, 106, 96.8, 105.2),// Bougie 2 : Réintégration haussière forte (Close = 105.2 dépasse Open1 105)
    ];

    const resultat = calculerLiquidationSweepChevauchementExtremes(bougies, {
      lookbackBars: 20,
      minBougiesChevauchement: 2,
      activerFiltreTaille: false,
    });

    expect(resultat.signaux.length).toBeGreaterThanOrEqual(1);
    const signal = resultat.signaux[resultat.signaux.length - 1];
    expect(signal.type).toBe('ACHAT');
    expect(signal.prixExtreme).toBe(96.0);
    expect(signal.palierExtreme).toBeDefined();
    expect(signal.palierExtreme?.prixPalier).toBeGreaterThanOrEqual(98.0);
    expect(signal.palierExtreme?.nbBougiesChevauchement).toBeGreaterThanOrEqual(2);

    // Primitives : Segment horizontal en ligne discontinue ('dashed')
    expect(resultat.primitives.labels?.length).toBeGreaterThan(0);
    expect(resultat.primitives.labels?.[0]?.texte).toContain('Spring Chevauchement');
    expect(resultat.primitives.lignes?.length).toBeGreaterThan(0);
    expect(resultat.primitives.lignes?.[0]?.style).toBe('dashed');
    expect(resultat.primitives.lignes?.[0]?.label).toContain('Face Basse');
    // Pas de boîte rectangulaire par défaut
    expect(resultat.primitives.boites).toHaveLength(0);
  });

  it('détecte un setup UTAD Vendeur balayant une crête de mèches hautes chevauchées', () => {
    // Création d'un historique où plusieurs mèches hautes s'accumulent autour de 110.0 (Face Haute)
    const bougies: Bougie[] = [
      creerBougie(1000, 105, 107, 104, 106),
      creerBougie(2000, 106, 110.0, 105, 107), // Mèche haute touche 110.0
      creerBougie(3000, 107, 110.2, 106, 108), // Mèche haute touche 110.2
      creerBougie(4000, 108, 110.1, 107, 108), // Mèche haute touche 110.1 -> Chevauchement dense
      creerBougie(5000, 108, 109, 105, 106),   // Repli
      creerBougie(6000, 106, 107, 104, 105),
      creerBougie(7000, 105, 112.5, 104, 111.0), // Bougie 1 : Impulsion haussière de purge (High = 112.5) balaye le 110
      creerBougie(8000, 111.0, 111.5, 103.0, 104.5), // Bougie 2 : Réintégration baissière forte (Close = 104.5 passe sous Open1 105)
    ];

    const resultat = calculerLiquidationSweepChevauchementExtremes(bougies, {
      lookbackBars: 20,
      minBougiesChevauchement: 2,
      activerFiltreTaille: false,
    });

    expect(resultat.signaux.length).toBeGreaterThanOrEqual(1);
    const signal = resultat.signaux[resultat.signaux.length - 1];
    expect(signal.type).toBe('VENTE');
    expect(signal.prixExtreme).toBe(112.5);
    expect(signal.palierExtreme).toBeDefined();
    expect(signal.palierExtreme?.prixPalier).toBeGreaterThanOrEqual(107.0);
    expect(signal.palierExtreme?.nbBougiesChevauchement).toBeGreaterThanOrEqual(2);

    // Primitives
    expect(resultat.primitives.lignes?.length).toBeGreaterThan(0);
    expect(resultat.primitives.lignes?.[0]?.style).toBe('dashed');
    expect(resultat.primitives.lignes?.[0]?.label).toContain('Face Haute');
    expect(resultat.primitives.boites).toHaveLength(0);
  });
});
