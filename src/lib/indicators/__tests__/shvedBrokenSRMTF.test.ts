import { describe, it, expect } from 'vitest';
import type { Bougie } from '@/lib/chartDataHelper';
import { calculerShvedBrokenSRMTF } from '../shvedBrokenSRMTF';

function creerBougie(
  time: number,
  open: number,
  high: number,
  low: number,
  close: number
): Bougie {
  return { time, open, high, low, close, volume: 1000 };
}

describe('Indicateur Shved Broken S/R MTF', () => {
  it('gère une liste vide ou insuffisante de bougies sans planter', () => {
    const res = calculerShvedBrokenSRMTF([]);
    expect(res.supportsCasses).toHaveLength(0);
    expect(res.resistancesCassees).toHaveLength(0);
    expect(res.primitives.lignes).toHaveLength(0);
    expect(res.primitives.boites).toHaveLength(0);
  });

  it('détecte un Support Shved cassé ayant au moins 1 retest et génère un segment discontinu dashed', () => {
    // 1️⃣ Création d'un historique Shved :
    // - Creux initial à 96.0 (bougie 5)
    // - Rebond vers 102.0
    // - Retest du creux à 96.2 (bougie 15) -> Valide 1 retest !
    // - Cassure franche sous 95.0 par une clôture à 93.0 (bougie 22)
    const bougies: Bougie[] = [];

    // Bougies neutres initiales
    for (let k = 0; k < 5; k++) {
      bougies.push(creerBougie(k * 1000, 100, 102, 99, 101));
    }

    // Creux fractal Shved à 96.0
    bougies.push(creerBougie(5000, 101, 102, 96.0, 97.0));
    bougies.push(creerBougie(6000, 97.0, 103, 97.0, 102.0));

    // Période intermédiaire
    for (let k = 7; k < 14; k++) {
      bougies.push(creerBougie(k * 1000, 101, 104, 100, 102));
    }

    // Retest du support (touche la zone 96.0 - 97.0)
    bougies.push(creerBougie(14000, 102, 103, 96.2, 97.5));
    bougies.push(creerBougie(15000, 97.5, 104, 97.5, 103.0));

    for (let k = 16; k < 21; k++) {
      bougies.push(creerBougie(k * 1000, 102, 104, 101, 103));
    }

    // Bougie de cassure nette (clôture sous le support à 93.0)
    bougies.push(creerBougie(21000, 102, 102, 92.5, 93.0));
    bougies.push(creerBougie(22000, 93.0, 94.0, 92.0, 93.5));

    const resultat = calculerShvedBrokenSRMTF(bougies, {
      timeframeSource: 'ACTUEL',
      periodeATR: 5,
      zoneFuzzFactor: 0.8,
      minRetests: 1, // Au moins 1 retest exigé
      prolongerVersLePresent: true,
    });

    expect(resultat.totalNiveauxCasses).toBeGreaterThanOrEqual(1);
    expect(resultat.supportsCasses.length).toBeGreaterThanOrEqual(1);

    const sup = resultat.supportsCasses[0];
    expect(sup.type).toBe('SUPPORT_CASSE');
    expect(sup.retests).toBeGreaterThanOrEqual(1);

    // Primitives graphiques
    expect(resultat.primitives.lignes?.length).toBeGreaterThanOrEqual(1);
    const ligne = resultat.primitives.lignes![0];
    expect(ligne.style).toBe('dashed'); // Trait discontinu
    expect(ligne.label).toContain('Support Cassé');

    // Vérification stricte : AUCUNE boîte rectangulaire
    expect(resultat.primitives.boites).toHaveLength(0);
  });

  it('ignore un support cassé qui n\'a AUCUN retest (0 retest)', () => {
    // Creux unique sans retest qui est immédiatement cassé plus tard
    const bougies: Bougie[] = [];

    for (let k = 0; k < 5; k++) {
      bougies.push(creerBougie(k * 1000, 100, 102, 99, 101));
    }

    // Creux isolé sans retest
    bougies.push(creerBougie(5000, 101, 102, 96.0, 97.0));
    bougies.push(creerBougie(6000, 97.0, 104, 97.0, 103.0));

    // Immédiatement cassé sans retest
    for (let k = 7; k < 12; k++) {
      bougies.push(creerBougie(k * 1000, 102, 103, 101, 102));
    }
    bougies.push(creerBougie(12000, 102, 102, 92.0, 93.0));

    const resultat = calculerShvedBrokenSRMTF(bougies, {
      timeframeSource: 'ACTUEL',
      periodeATR: 5,
      minRetests: 1, // Exige au moins 1 retest
    });

    // Le niveau sans retest doit être totalement ignoré
    expect(resultat.supportsCasses).toHaveLength(0);
    expect(resultat.primitives.lignes).toHaveLength(0);
  });

  it('détecte une Résistance Shved cassée ayant au moins 1 retest', () => {
    const bougies: Bougie[] = [];

    for (let k = 0; k < 5; k++) {
      bougies.push(creerBougie(k * 1000, 100, 101, 98, 99));
    }

    // Sommet fractal Shved à 108.0
    bougies.push(creerBougie(5000, 100, 108.0, 99, 107.0));
    bougies.push(creerBougie(6000, 107.0, 107.0, 100, 101.0));

    // Période intermédiaire
    for (let k = 7; k < 14; k++) {
      bougies.push(creerBougie(k * 1000, 101, 103, 100, 102));
    }

    // Retest de la résistance (touche 107.8)
    bougies.push(creerBougie(14000, 102, 107.8, 102, 106.5));
    bougies.push(creerBougie(15000, 106.5, 106.5, 101, 102.0));

    for (let k = 16; k < 21; k++) {
      bougies.push(creerBougie(k * 1000, 101, 103, 100, 102));
    }

    // Cassure franche vers le haut (clôture à 112.0)
    bougies.push(creerBougie(21000, 103, 112.0, 103, 111.5));
    bougies.push(creerBougie(22000, 111.5, 113.0, 110, 112.0));

    const resultat = calculerShvedBrokenSRMTF(bougies, {
      timeframeSource: 'ACTUEL',
      periodeATR: 5,
      zoneFuzzFactor: 0.8,
      minRetests: 1,
      prolongerVersLePresent: true,
    });

    expect(resultat.resistancesCassees.length).toBeGreaterThanOrEqual(1);
    const res = resultat.resistancesCassees[0];
    expect(res.type).toBe('RESISTANCE_CASSEE');
    expect(res.retests).toBeGreaterThanOrEqual(1);

    expect(resultat.primitives.lignes?.length).toBeGreaterThanOrEqual(1);
    expect(resultat.primitives.lignes![0].style).toBe('dashed');
    expect(resultat.primitives.lignes![0].label).toContain('Résistance Cassée');
    expect(resultat.primitives.boites).toHaveLength(0);
  });

  it('s\'exécute avec succès via evaluerIndicateurScript depuis INDICATEURS_PAR_DEFAUT', async () => {
    const { INDICATEURS_PAR_DEFAUT, evaluerIndicateurScript } = await import('../indicatorEngine');
    const scriptDef = INDICATEURS_PAR_DEFAUT.find(
      (s) => s.id === 'script-shved-mtf-broken-sr'
    );
    expect(scriptDef).toBeDefined();

    const bougies: Bougie[] = [];
    for (let k = 0; k < 20; k++) {
      bougies.push(creerBougie(k * 1000, 100, 105, 95, 101));
    }

    const res = evaluerIndicateurScript(scriptDef!.code, {
      bougies,
      parametres: scriptDef!.parametres,
      timeframe: 'H4',
    });

    expect(res).not.toBeNull();
    expect(res?.primitives).toBeDefined();
    expect(res?.typeSpecial).toBe('shved-broken-sr-mtf');
  });
});
