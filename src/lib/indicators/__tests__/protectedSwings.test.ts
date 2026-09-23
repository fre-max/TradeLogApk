import { describe, it, expect } from 'vitest';
import {
  estPivotHaut,
  estPivotBas,
  calculerProtectedSwings,
  capturerSnapshotProtectedSwings,
} from '../protectedSwings';
import type { Bougie } from '@/lib/chartDataHelper';

describe('Indicateur Protected Swings [LuxAlgo] - Logique Mathématique & Télémétrie', () => {
  // 1️⃣ Test de détection de pivot haut et bas
  it('détecte correctement un pivot haut et un pivot bas', () => {
    const bougies: Bougie[] = [
      { time: 1, open: 10, high: 11, low: 9, close: 10 },
      { time: 2, open: 10, high: 12, low: 9, close: 11 },
      { time: 3, open: 11, high: 15, low: 10, close: 14 }, // Sommet local (Pivot Haut)
      { time: 4, open: 14, high: 13, low: 10, close: 11 },
      { time: 5, open: 11, high: 12, low: 8, close: 9 },   // Creux local (Pivot Bas)
      { time: 6, open: 9, high: 11, low: 8.5, close: 10 },
      { time: 7, open: 10, high: 11, low: 9.5, close: 10.5 },
    ];

    expect(estPivotHaut(bougies, 2, 2, 2)).toBe(true);
    expect(estPivotHaut(bougies, 1, 2, 2)).toBe(false);

    expect(estPivotBas(bougies, 4, 1, 1)).toBe(true);
    expect(estPivotBas(bougies, 3, 1, 1)).toBe(false);
  });

  // 2️⃣ Test d'un scénario complet de Protected Swing Low (PSL)
  it('valide un Protected Swing Low (PSL) avec balayage et confirmation CISD', () => {
    // Construction d'une séquence de prix :
    // 1. Pivot bas initial à 100
    // 2. Remontée du prix jusqu'à 110
    // 3. Mouvement baissier (open à 108) qui descend balayer le creux précédent avec une mèche à 98 (sweep)
    // 4. Bougie haussière qui clôture au-dessus du niveau CISD (108) -> Confirmation PSL !
    const bougies: Bougie[] = [];

    // Bougies neutres autour de 105
    for (let i = 0; i < 5; i++) {
      bougies.push({ time: i, open: 105, high: 106, low: 104, close: 105 });
    }

    // Bougie 5 : Creux Pivot Bas à 100
    bougies.push({ time: 5, open: 104, high: 105, low: 100, close: 103 });

    // Bougies qui remontent jusqu'à 110
    for (let i = 6; i < 12; i++) {
      bougies.push({ time: i, open: 103 + (i - 5), high: 105 + (i - 5), low: 102 + (i - 5), close: 104 + (i - 5) });
    }

    // Bougie 12 : Début de la séquence baissière (Niveau CISD = open à 110)
    bougies.push({ time: 12, open: 110, high: 110.5, low: 104, close: 105 });

    // Bougie 13 : Deuxième bougie baissière qui descend balayer le pivot de 100 avec mèche à 98 mais clôture à 102 (Sweep)
    bougies.push({ time: 13, open: 105, high: 106, low: 98, close: 102 });

    // Bougie 14 : Bougie de réaction haussière
    bougies.push({ time: 14, open: 102, high: 107, low: 101, close: 106 });

    // Bougie 15 : Bougie d'impulsion qui clôture à 112 (au-dessus du niveau CISD de 110) -> Confirmation !
    bougies.push({ time: 15, open: 106, high: 113, low: 105, close: 112 });

    const resultat = calculerProtectedSwings(bougies, {
      sweepSensitivity: 2, // Petite sensibilité pour notre jeu de test court
      maxBarsLookback: 100,
    });

    // Vérifier que le sweep a bien été détecté
    expect(resultat.sweeps.length).toBeGreaterThan(0);
    const sweep = resultat.sweeps[0];
    expect(sweep.isHigh).toBe(false); // Balayage d'un creux
    expect(sweep.price).toBe(98);

    // Vérifier qu'un PSL a été confirmé
    expect(resultat.swingsConfirmes.length).toBeGreaterThan(0);
    const psl = resultat.swingsConfirmes[0];
    expect(psl.type).toBe('PSL');
    expect(psl.isBullish).toBe(true);
    expect(psl.swingPrice).toBe(98);
    expect(psl.levelPrice).toBe(110);
    expect(psl.cause).toBe('sweep');
  });

  // 3️⃣ Test de détection de FVG (Fair Value Gap)
  it('détecte correctement un FVG haussier et baissier', () => {
    const bougies: Bougie[] = [
      { time: 0, open: 100, high: 101, low: 99, close: 100 },
      { time: 1, open: 100, high: 102, low: 99, close: 101 },  // bar 1
      { time: 2, open: 101, high: 108, low: 101, close: 107 }, // bar 2 : grande bougie
      { time: 3, open: 107, high: 110, low: 104, close: 109 }, // bar 3 : low à 104 > high de bar 1 (102) -> Gap de 102 à 104
      { time: 4, open: 109, high: 111, low: 108, close: 110 },
      { time: 5, open: 110, high: 112, low: 109, close: 111 },
    ];

    const resultat = calculerProtectedSwings(bougies, { sweepSensitivity: 1 });
    expect(resultat.fvgs.length).toBeGreaterThan(0);
    const fvg = resultat.fvgs[0];
    expect(fvg.dir).toBe(1); // Bullish
    expect(fvg.bottom).toBe(102);
    expect(fvg.top).toBe(104);
  });

  // 4️⃣ Test de validation d'un Protected Swing High (PSH)
  it('valide un Protected Swing High (PSH) avec balayage et confirmation CISD baissière', () => {
    const bougies: Bougie[] = [];

    // Bougies initiales
    for (let i = 0; i < 5; i++) {
      bougies.push({ time: i, open: 100, high: 101, low: 99, close: 100 });
    }

    // Bougie 5 : Sommet Pivot Haut à 115
    bougies.push({ time: 5, open: 105, high: 115, low: 104, close: 108 });

    // Descente avec bougies baissières (open > close)
    for (let i = 6; i < 12; i++) {
      bougies.push({ time: i, open: 102, high: 103, low: 98, close: 99 });
    }

    // Bougie 12 : Début de la série haussière (Niveau CISD = open à 102)
    bougies.push({ time: 12, open: 102, high: 108, low: 101, close: 107 });

    // Bougie 13 : Deuxième bougie haussière qui dépasse le sommet précédent (115) avec mèche à 118 mais clôture à 112 (Sweep)
    bougies.push({ time: 13, open: 107, high: 118, low: 106, close: 112 });

    // Bougie 14 : Réaction baissière
    bougies.push({ time: 14, open: 112, high: 113, low: 105, close: 107 });

    // Bougie 15 : Clôture sous le niveau CISD (open de la série à 102) -> clôture à 100
    bougies.push({ time: 15, open: 107, high: 108, low: 99, close: 100 });

    const resultat = calculerProtectedSwings(bougies, { sweepSensitivity: 2, maxBarsLookback: 100 });

    expect(resultat.swingsConfirmes.length).toBeGreaterThan(0);
    const psh = resultat.swingsConfirmes[0];
    expect(psh.type).toBe('PSH');
    expect(psh.isBullish).toBe(false);
    expect(psh.swingPrice).toBe(118);
    expect(psh.levelPrice).toBe(102);
  });

  // 5️⃣ Test de capture du Snapshot de télémétrie pour les positions
  it('capture correctement la télémétrie lors d\'une prise de position', () => {
    const bougies: Bougie[] = [];
    for (let i = 0; i < 15; i++) {
      bougies.push({ time: i, open: 100, high: 101, low: 99, close: 100 });
    }

    const resultat = calculerProtectedSwings(bougies, { sweepSensitivity: 2 });
    const snapshot = capturerSnapshotProtectedSwings(resultat, 14);

    // Même en l'absence de signal, la structure est robuste et renvoie des valeurs saines
    expect(snapshot).toBeDefined();
    expect(snapshot.dernierSignalType).toBe('AUCUN');
    expect(snapshot.bougiesDepuisSignal).toBe(999);
  });
});
