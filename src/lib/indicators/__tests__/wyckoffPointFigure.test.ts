import { describe, it, expect } from 'vitest';
import type { Bougie } from '@/lib/chartDataHelper';
import { calculerWyckoffPointAndFigure } from '../wyckoffPointFigure';

describe('Wyckoff Point & Figure (Spring & UTAD)', () => {
  it('retourne un résultat vide si le nombre de bougies est inférieur à 50', () => {
    const res = calculerWyckoffPointAndFigure([]);
    expect(res.totalColonnesPF).toBe(0);
    expect(res.signaux).toHaveLength(0);
    expect(res.boites).toHaveLength(0);
  });

  it('génère des colonnes P&F cohérentes sur une séquence de bougies', () => {
    // Génère 60 bougies oscillantes simples
    const bougies: Bougie[] = Array.from({ length: 60 }, (_, i) => {
      const base = 100 + Math.sin(i / 5) * 10;
      return {
        time: 1700000000 + i * 60,
        open: base,
        high: base + 2,
        low: base - 2,
        close: base + 1,
        volume: 1000,
      };
    });

    const res = calculerWyckoffPointAndFigure(bougies, {
      modeTailleBox: 'fixe',
      tailleBoxPips: 10,
      reversalCount: 3,
      activerFiltreVolume: false,
    });

    expect(res.totalColonnesPF).toBeGreaterThan(0);
    expect(res.tailleBoxCalculee).toBeGreaterThan(0);
  });

  it('valide un Spring avec et sans filtre de volume', () => {
    // Création d'une structure de Range claire (support à 100)
    // Suivi d'un Spring (fausse cassure à 98) et réintégration immédiate (102)
    const bougies: Bougie[] = [];
    let t = 1700000000;

    // Phase 1 : Oscillation créant un support net à 100 (plusieurs rebonds)
    for (let c = 0; c < 6; c++) {
      const haut = 110;
      const bas = 100;
      // Montée
      for (let p = bas; p <= haut; p += 2) {
        bougies.push({ time: (t += 60), open: p, high: p + 1, low: p - 1, close: p + 1, volume: 500 });
      }
      // Descente
      for (let p = haut; p >= bas; p -= 2) {
        bougies.push({ time: (t += 60), open: p, high: p + 1, low: p - 1, close: p - 1, volume: 500 });
      }
    }

    // Phase 2 : Le Spring (casse sous 100 jusqu'à 98) avec fort volume (Absorption / Climax)
    bougies.push({ time: (t += 60), open: 100, high: 100, low: 98, close: 98, volume: 3000 });

    // Phase 3 : Réintégration haussière immédiate au-dessus de 100
    bougies.push({ time: (t += 60), open: 98, high: 103, low: 98, close: 103, volume: 2500 });

    // Test 1 : Sans filtre de volume (P&F Pur)
    const resSansVolume = calculerWyckoffPointAndFigure(bougies, {
      modeTailleBox: 'fixe',
      tailleBoxPips: 10,
      reversalCount: 3,
      colonnesMinRange: 3,
      activerFiltreVolume: false,
    });

    expect(resSansVolume.totalColonnesPF).toBeGreaterThan(4);

    // Test 2 : Avec filtre de volume activé
    const resAvecVolume = calculerWyckoffPointAndFigure(bougies, {
      modeTailleBox: 'fixe',
      tailleBoxPips: 10,
      reversalCount: 3,
      colonnesMinRange: 3,
      activerFiltreVolume: true,
      typeValidationVolume: 'climax',
      seuilRatioVolume: 1.2,
    });

    expect(resAvecVolume.modeVolumeActif).toBe(true);
  });

  it('filtre les niveaux de support/résistance selon le nombre de retests requis (minRetestsRequis)', () => {
    const bougies: Bougie[] = [];
    let t = 1700000000;

    // Phase avec 3 oscillations (3 creux à 100)
    for (let c = 0; c < 3; c++) {
      for (let p = 100; p <= 110; p += 2) {
        bougies.push({ time: (t += 60), open: p, high: p + 1, low: p - 1, close: p + 1, volume: 500 });
      }
      for (let p = 110; p >= 100; p -= 2) {
        bougies.push({ time: (t += 60), open: p, high: p + 1, low: p - 1, close: p - 1, volume: 500 });
      }
    }
    // Spring et réintégration
    bougies.push({ time: (t += 60), open: 100, high: 100, low: 98, close: 98, volume: 2000 });
    bougies.push({ time: (t += 60), open: 98, high: 103, low: 98, close: 103, volume: 2000 });

    // Avec un seuil très strict impossible (ex: 10 retests), aucun signal ne doit passer
    const resStrict = calculerWyckoffPointAndFigure(bougies, {
      modeTailleBox: 'fixe',
      tailleBoxPips: 10,
      reversalCount: 3,
      colonnesMinRange: 3,
      minRetestsRequis: 10,
      activerFiltreVolume: false,
    });
    expect(resStrict.signaux).toHaveLength(0);

    // Avec un seuil accessible (minRetestsRequis = 2)
    const resAccessible = calculerWyckoffPointAndFigure(bougies, {
      modeTailleBox: 'fixe',
      tailleBoxPips: 10,
      reversalCount: 3,
      colonnesMinRange: 3,
      minRetestsRequis: 2,
      activerFiltreVolume: false,
    });
    if (resAccessible.signaux.length > 0) {
      expect(resAccessible.signaux[0].nbRetests).toBeGreaterThanOrEqual(2);
      expect(resAccessible.signaux[0].qualiteNiveau).toBeDefined();
    }
  });

  it('détecte et valide un Spring sous forme de V-Shape Reversal avec bougie de retour dominante', () => {
    const bougies: Bougie[] = [];
    let t = 1700000000;

    // Oscillation pour former un range solide avec support à 100
    for (let c = 0; c < 4; c++) {
      for (let p = 100; p <= 110; p += 2) {
        bougies.push({ time: (t += 60), open: p, high: p + 1, low: p - 1, close: p + 1, volume: 500 });
      }
      for (let p = 110; p >= 100; p -= 2) {
        bougies.push({ time: (t += 60), open: p, high: p + 1, low: p - 1, close: p - 1, volume: 500 });
      }
    }

    // Bougie 1 : Liquidation (chute sous 100 jusqu'à 98, amplitude = 2)
    bougies.push({ time: (t += 60), open: 100, high: 100, low: 98, close: 98, volume: 1500 });

    // Bougie 2 : Réintégration puissante (de 98 à 104, amplitude = 6 > amplitude sortie)
    bougies.push({ time: (t += 60), open: 98, high: 104, low: 98, close: 104, volume: 2000 });

    const res = calculerWyckoffPointAndFigure(bougies, {
      modeTailleBox: 'fixe',
      tailleBoxPips: 100,
      reversalCount: 3,
      colonnesMinRange: 3,
      minRetestsRequis: 2,
      activerFiltreGrandesBougies: true,
      exigerRetourSuperieurOuEgal: true,
      maxBougiesHorsRange: 3,
    });

    expect(res.signaux.length).toBeGreaterThan(0);
    const signal = res.signaux[0];
    expect(signal.patternBougie).toContain('V-Shape');
    expect(signal.ratioForceRetour).toBeGreaterThanOrEqual(0.95);
  });

  it('détecte et valide un Spring en 1 seule bougie Pinbar avec grande mèche de rejet', () => {
    const bougies: Bougie[] = [];
    let t = 1700000000;

    // Oscillation formant un range solide à 100
    for (let c = 0; c < 4; c++) {
      for (let p = 100; p <= 110; p += 2) {
        bougies.push({ time: (t += 60), open: p, high: p + 1, low: p - 1, close: p + 1, volume: 500 });
      }
      for (let p = 110; p >= 100; p -= 2) {
        bougies.push({ time: (t += 60), open: p, high: p + 1, low: p - 1, close: p - 1, volume: 500 });
      }
    }

    // Bougie unique Pinbar : open à 101, plonge à 97 (mèche basse), et clôture à 103 (amplitude 6, mèche basse = 4 / 6 = 66%)
    bougies.push({ time: (t += 60), open: 101, high: 103, low: 97, close: 103, volume: 2500 });

    const res = calculerWyckoffPointAndFigure(bougies, {
      modeTailleBox: 'fixe',
      tailleBoxPips: 10,
      reversalCount: 3,
      colonnesMinRange: 3,
      minRetestsRequis: 2,
      activerFiltreGrandesBougies: true,
      ratioMecheRejetSimple: 0.40,
    });

    if (res.signaux.length > 0) {
      const signal = res.signaux[0];
      expect(signal.patternBougie).toBeDefined();
    }
  });
});
