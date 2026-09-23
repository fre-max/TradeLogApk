import { describe, it, expect } from 'vitest';
import {
  determinerStepPrix,
  detecterPivotsZigZag,
  calculerUnmitigatedVolumeProfile,
  capturerSnapshotUVP,
} from '../unmitigatedVolumeProfile';
import type { Bougie } from '@/lib/chartDataHelper';

describe('Indicateur SMC Unmitigated Volume Profile (UVP) - Moteur Mathématique', () => {
  // 1️⃣ Test du pas de prix adaptatif
  it('calcule un pas de prix cohérent selon le niveau de prix de l\'actif', () => {
    const bougiesForex: Bougie[] = [{ time: 1, open: 1.08, high: 1.085, low: 1.079, close: 1.082 }];
    const bougiesGold: Bougie[] = [{ time: 1, open: 150, high: 152, low: 149, close: 151 }];
    const bougiesBtc: Bougie[] = [{ time: 1, open: 60000, high: 61000, low: 59500, close: 60500 }];

    expect(determinerStepPrix(bougiesForex)).toBe(0.0001);
    expect(determinerStepPrix(bougiesGold)).toBe(0.05);
    expect(determinerStepPrix(bougiesBtc)).toBe(5.0);
  });

  // 2️⃣ Test de détection de ZigZag avec alternance stricte
  it('détecte les pivots ZigZag avec une alternance stricte Sommet / Creux', () => {
    const bougies: Bougie[] = [];

    // Vague 1 : Montée de 100 à 120 (Sommet à l'index 4)
    bougies.push({ time: 0, open: 100, high: 102, low: 99, close: 101 });
    bougies.push({ time: 1, open: 101, high: 106, low: 100, close: 105 });
    bougies.push({ time: 2, open: 105, high: 110, low: 104, close: 109 });
    bougies.push({ time: 3, open: 109, high: 115, low: 108, close: 114 });
    bougies.push({ time: 4, open: 114, high: 120, low: 113, close: 119 }); // Pivot Haut

    // Vague 2 : Descente de 120 à 90 (Creux à l'index 8)
    bougies.push({ time: 5, open: 118, high: 118, low: 110, close: 111 });
    bougies.push({ time: 6, open: 110, high: 111, low: 103, close: 104 });
    bougies.push({ time: 7, open: 104, high: 105, low: 96, close: 97 });
    bougies.push({ time: 8, open: 97, high: 98, low: 90, close: 92 });    // Pivot Bas

    // Vague 3 : Remontée vers 105 (bougie courante index 11)
    bougies.push({ time: 9, open: 92, high: 97, low: 91, close: 96 });
    bougies.push({ time: 10, open: 96, high: 101, low: 95, close: 100 });
    bougies.push({ time: 11, open: 100, high: 106, low: 99, close: 105 }); // Bougie courante

    const pivots = detecterPivotsZigZag(bougies, 2, 50);

    expect(pivots.length).toBeGreaterThanOrEqual(2);
    // Vérification de l'alternance stricte
    for (let i = 1; i < pivots.length; i++) {
      expect(pivots[i].estHaut).not.toBe(pivots[i - 1].estHaut);
    }
  });

  // 3️⃣ Test de calcul du profil de volume et détection de mitigation
  it('distingue correctement les paliers mitigués et non mitigués', () => {
    const bougies: Bougie[] = [];

    // Vague A : Montée de 100 à 110 (indices 0 à 3)
    bougies.push({ time: 0, open: 100, high: 102, low: 100, close: 102 });
    bougies.push({ time: 1, open: 102, high: 105, low: 102, close: 105 });
    bougies.push({ time: 2, open: 105, high: 108, low: 105, close: 108 });
    bougies.push({ time: 3, open: 108, high: 110, low: 107, close: 110 }); // Sommet

    // Vague B : Descente partielle de 110 à 106 (indices 4 à 5)
    // Elle mitige les niveaux entre 106 et 110, mais NE mitige PAS les niveaux sous 106 (100 à 105) !
    bougies.push({ time: 4, open: 110, high: 110, low: 107, close: 108 });
    bougies.push({ time: 5, open: 108, high: 108, low: 106, close: 106 });

    // Vague C : Repart à la hausse jusqu'à 115 (indices 6 à 7)
    bougies.push({ time: 6, open: 106, high: 112, low: 106, close: 111 });
    bougies.push({ time: 7, open: 111, high: 115, low: 110, close: 114 });

    const resultat = calculerUnmitigatedVolumeProfile(bougies, {
      zigzagDepth: 1,
      priceStep: 1.0,
      lookbackBars: 50,
    });

    expect(resultat.vagues.length).toBeGreaterThan(0);
    // Vérifie qu'il y a des niveaux ouverts (non mitigués) détectés
    expect(resultat.totalNiveauxOuverts).toBeGreaterThan(0);

    // Vérifie qu'au moins un palier bas (autour de 101-104) n'a jamais été mitigué par la descente à 106
    const niveauNonMitigueBas = resultat.niveauxOuverts.find(n => n.price <= 105);
    expect(niveauNonMitigueBas).toBeDefined();
  });

  // 4️⃣ Test du snapshot technique pour un trade
  it('fournit un snapshot précis des niveaux ouverts par rapport au prix d\'entrée', () => {
    const mockResultat = {
      pivots: [],
      vagues: [],
      step: 1.0,
      totalNiveauxOuverts: 3,
      niveauxOuverts: [
        { price: 115, volume: 500, vagueId: 1, estHaussiere: true, tempsDebut: 0, tempsFin: 5 }, // Au-dessus
        { price: 120, volume: 800, vagueId: 1, estHaussiere: true, tempsDebut: 0, tempsFin: 5 }, // Au-dessus (POC)
        { price: 95,  volume: 300, vagueId: 2, estHaussiere: false, tempsDebut: 5, tempsFin: 10 }, // En-dessous
      ],
    };

    const snapshot = capturerSnapshotUVP(mockResultat, 100);

    expect(snapshot.totalNiveauxOuverts).toBe(3);
    expect(snapshot.nbNiveauxAuDessus).toBe(2);
    expect(snapshot.nbNiveauxEnDessous).toBe(1);

    expect(snapshot.niveauPlusProcheHaut?.price).toBe(115);
    expect(snapshot.niveauPlusProcheBas?.price).toBe(95);

    expect(snapshot.pocNonMitigueMajeur?.price).toBe(120);
    expect(snapshot.pocNonMitigueMajeur?.volume).toBe(800);
  });
});
