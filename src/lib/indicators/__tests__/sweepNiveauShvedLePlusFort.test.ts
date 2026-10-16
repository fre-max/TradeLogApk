import { describe, it, expect } from 'vitest';
import type { Bougie } from '@/lib/chartDataHelper';
import { calculerSweepNiveauShvedLePlusFort } from '../sweepNiveauShvedLePlusFort';

function creerBougie(
  time: number,
  open: number,
  high: number,
  low: number,
  close: number
): Bougie {
  return { time, open, high, low, close, volume: 1000 };
}

describe('Indicateur Doji Liq/Reint + Liquidité Shved la Plus Forte', () => {
  it('gère une liste vide ou courte sans planter', () => {
    const res = calculerSweepNiveauShvedLePlusFort([]);
    expect(res.signaux).toHaveLength(0);
    expect(res.primitives.labels).toHaveLength(0);
    expect(res.primitives.lignes).toHaveLength(0);
    expect(res.statistiques.totalSignaux).toBe(0);
  });

  it('identifie le support Shved le PLUS FORT parmi plusieurs niveaux balayés par le Doji', () => {
    const bougies: Bougie[] = [];

    // 1️⃣ Historique initial régulier (10 bougies de taille moyenne ~ 2.0 pips)
    for (let k = 0; k < 10; k++) {
      bougies.push(creerBougie(k * 1000, 100, 101, 99, 100));
    }

    // 2️⃣ Niveau A : Support créé à 96.0 avec 3 retests
    bougies.push(creerBougie(10000, 100, 101, 96.0, 97.0)); // Sommet/creux
    bougies.push(creerBougie(11000, 97.0, 102, 97.0, 101.0));

    // Retest 1
    for (let k = 12; k < 18; k++) bougies.push(creerBougie(k * 1000, 101, 102, 100, 101));
    bougies.push(creerBougie(18000, 101, 102, 96.1, 98.0));
    bougies.push(creerBougie(19000, 98.0, 103, 98.0, 102.0));

    // Retest 2
    for (let k = 20; k < 26; k++) bougies.push(creerBougie(k * 1000, 102, 103, 101, 102));
    bougies.push(creerBougie(26000, 102, 103, 96.0, 98.0));
    bougies.push(creerBougie(27000, 98.0, 103, 98.0, 102.0));

    // Retest 3
    for (let k = 28; k < 34; k++) bougies.push(creerBougie(k * 1000, 102, 103, 101, 102));
    bougies.push(creerBougie(34000, 102, 103, 96.1, 98.5));
    bougies.push(creerBougie(35000, 98.5, 104, 98.5, 103.0));

    // 3️⃣ Niveau B : Support plus haut créé à 98.0 avec seulement 1 retest
    for (let k = 36; k < 40; k++) bougies.push(creerBougie(k * 1000, 102, 103, 101, 102));
    bougies.push(creerBougie(40000, 102, 103, 98.0, 99.0));
    bougies.push(creerBougie(41000, 99.0, 103, 99.0, 102.0));

    for (let k = 42; k < 48; k++) bougies.push(creerBougie(k * 1000, 101, 103, 100, 102));
    bougies.push(creerBougie(48000, 102, 103, 98.0, 100.0));
    bougies.push(creerBougie(49000, 100.0, 103, 100.0, 102.0));

    // 4️⃣ Historique stable avant le setup (moyenne ~ 2.0 pips)
    for (let k = 50; k < 60; k++) {
      bougies.push(creerBougie(k * 1000, 101, 102, 100, 101));
    }

    // 5️⃣ Le Setup Doji Liq/Reint (Spring) :
    // Bougie 1 : Impulsion baissière de balayage qui traverse 96.0 et 94.0 (mèche basse à 92.0)
    // Range1 = 101 - 92 = 9.0 (très large > 1.75 * 2.0 = 3.5)
    bougies.push(creerBougie(60000, 101, 101, 92.0, 93.0));

    // Bougie 2 : Réintégration haussière immédiate (close2 = 101.0 ~ open1 = 101.0)
    // Corps2 = |93.0 - 101.0| = 8.0 (> 1.75 * 2.0)
    bougies.push(creerBougie(61000, 93.0, 101.5, 93.0, 101.0));

    const resultat = calculerSweepNiveauShvedLePlusFort(bougies, {
      timeframeSource: 'ACTUEL',
      periodeATR: 15,
      zoneFuzzFactor: 0.1,
      minRetests: 1,
      exigerNiveauBalaye: true,
      toleranceDepassement: 0.25,
      toleranceDeficit: 0.1,
    });

    // On vérifie qu'un signal d'achat (Spring) a été détecté
    expect(resultat.signaux.length).toBeGreaterThanOrEqual(1);
    const signal = resultat.signaux[resultat.signaux.length - 1];
    expect(signal.type).toBe('ACHAT');

    // Le niveau le plus fort doit être le Support A (~96.0) qui a plusieurs retests
    expect(signal.niveauLePlusFort).toBeDefined();
    expect(signal.niveauLePlusFort?.retestsAvantPattern).toBeGreaterThanOrEqual(2);

    // Les primitives graphiques doivent inclure une ligne en trait discontinu
    expect(resultat.primitives.lignes?.length).toBeGreaterThanOrEqual(1);
    const ligneForte = resultat.primitives.lignes![0];
    expect(ligneForte.style).toBe('dashed');

    // Le label doit indiquer le nombre de retests (ex: "3x")
    const label = resultat.primitives.labels?.find((lbl) => lbl.texte.includes('x'));
    expect(label).toBeDefined();
  });

  it('s\'exécute avec succès via evaluerIndicateurScript depuis INDICATEURS_PAR_DEFAUT', async () => {
    const { INDICATEURS_PAR_DEFAUT, evaluerIndicateurScript } = await import('../indicatorEngine');
    const scriptDef = INDICATEURS_PAR_DEFAUT.find(
      (s) => s.id === 'script-liq-sweep-shved-plus-fort'
    );
    expect(scriptDef).toBeDefined();

    const bougies: Bougie[] = [];
    for (let k = 0; k < 25; k++) {
      bougies.push(creerBougie(k * 1000, 100, 105, 95, 101));
    }

    const res = evaluerIndicateurScript(scriptDef!.code, {
      bougies,
      parametres: scriptDef!.parametres,
      timeframe: 'H4',
    });

    expect(res).not.toBeNull();
    expect(res?.primitives).toBeDefined();
    expect(res?.typeSpecial).toBe('liq-sweep-shved-plus-fort');
  });

  it('affiche les niveaux Shved en arrière-plan et les Dojis seuls pour la vision d\'ensemble', () => {
    const bougies: Bougie[] = [];
    for (let k = 0; k < 15; k++) bougies.push(creerBougie(k * 1000, 100, 101, 99, 100));

    // Création d'un support Shved
    bougies.push(creerBougie(15000, 100, 101, 95.0, 96.0));
    bougies.push(creerBougie(16000, 96.0, 102, 96.0, 101.0));
    for (let k = 17; k < 23; k++) bougies.push(creerBougie(k * 1000, 101, 102, 100, 101));
    // Retest
    bougies.push(creerBougie(23000, 101, 102, 95.1, 98.0));
    bougies.push(creerBougie(24000, 98.0, 103, 98.0, 102.0));
    for (let k = 25; k < 35; k++) bougies.push(creerBougie(k * 1000, 101, 102, 100, 101));

    // Doji haut dans le ciel (vers 105.0) qui ne touche PAS le support Shved (95.0)
    bougies.push(creerBougie(35000, 101, 101, 96.0, 97.0)); // b1
    bougies.push(creerBougie(36000, 97.0, 101.5, 97.0, 101.0)); // b2 réintègre sans balayer 95.0

    const res = calculerSweepNiveauShvedLePlusFort(bougies, {
      timeframeSource: 'ACTUEL',
      periodeATR: 15,
      zoneFuzzFactor: 0.1,
      minRetests: 1,
      exigerNiveauBalaye: true,
      afficherNiveauxShved: true,
      afficherTousDojis: true,
    });

    // Les lignes doivent contenir la ligne Shved de fond
    const lignesFond = res.primitives.lignes?.filter((l) => l.id?.startsWith('bg-shved-'));
    expect(lignesFond).toBeDefined();
    expect(lignesFond!.length).toBeGreaterThanOrEqual(1);

    // Les labels doivent inclure le Doji seul
    const labelDojiSeul = res.primitives.labels?.find((l) => l.id?.startsWith('doji-seul-lbl-'));
    expect(labelDojiSeul).toBeDefined();
  });
});

