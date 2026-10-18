import { describe, it, expect } from 'vitest';
import type { Bougie } from '@/lib/chartDataHelper';
import type { ZoneShved } from '@/lib/bot/modules/01_liquidite/shvedSupplyDemand';
import {
  calculerSandboxDojiShvedPlage,
  calculerScoreZoneShved,
  detecterDojisAvecPlage,
} from '../favoris/sandboxDojiShvedPlage';

function creerBougie(
  time: number,
  open: number,
  high: number,
  low: number,
  close: number
): Bougie {
  return { time, open, high, low, close, volume: 1000 };
}

describe('Sandbox : Doji Liq/Reint + S/R Shved (Plage Ciblée)', () => {
  it('gère une liste vide ou courte sans erreur', () => {
    const res = calculerSandboxDojiShvedPlage([]);
    expect(res.signaux).toHaveLength(0);
    expect(res.primitives.labels).toHaveLength(0);
    expect(res.primitives.lignes).toHaveLength(0);
  });

  it('détecte un Doji acheteur, trouve le creux précédent et isole la plage temporelle', () => {
    const bougies: Bougie[] = [];

    // 10 bougies normales
    for (let k = 0; k < 10; k++) {
      bougies.push(creerBougie(k * 1000, 100, 102, 98, 100));
    }

    // Bougie 10 créant un plus bas antérieur de référence à 90.0
    bougies.push(creerBougie(10000, 100, 101, 90.0, 95.0));

    // Quelques bougies intermédiaires entre 95 et 105
    for (let k = 11; k < 20; k++) {
      bougies.push(creerBougie(k * 1000, 100, 105, 95, 102));
    }

    // Formation du Doji Achat (Spring) :
    // B1 : Liquidation baissière (102 -> 92.0), Low = 91.0 (supérieur ou proche de 90.0)
    bougies.push(creerBougie(20000, 102, 102, 91.0, 92.0));
    // B2 : Réintégration haussière (92.0 -> 101.8)
    bougies.push(creerBougie(21000, 92.0, 102.5, 92.0, 101.8));

    const resultat = calculerSandboxDojiShvedPlage(bougies, {
      activerFiltreTaille: false,
      styleLignesSupport: 'dashed',
      styleLignesResistance: 'solid',
      maxReculRecherche: 50,
    });

    expect(resultat.signaux.length).toBeGreaterThanOrEqual(1);
    const signal = resultat.signaux[resultat.signaux.length - 1];
    expect(signal.type).toBe('ACHAT');
    // Le creux précédent doit être identifié à l'index 10
    expect(signal.indexDebutPlage).toBe(10);
    expect(signal.prixExtremePrecedent).toBe(90.0);
    expect(signal.tempsDebutPlage).toBe(10000);
  });

  it('permet de tracer des lignes Shved en continu ("solid") ou discontinu ("dashed")', () => {
    const bougies: Bougie[] = [];
    for (let k = 0; k < 30; k++) {
      bougies.push(creerBougie(k * 1000, 100, 102, 98, 100));
    }

    // Test avec style solid pour supports et dashed pour résistances
    const res = calculerSandboxDojiShvedPlage(bougies, {
      styleLignesSupport: 'solid',
      styleLignesResistance: 'dashed',
    });

    expect(res).toBeDefined();
    expect(res.primitives).toBeDefined();
  });

  it('s\'exécute avec succès via evaluerIndicateurScript depuis INDICATEURS_PAR_DEFAUT', async () => {
    const { INDICATEURS_PAR_DEFAUT, evaluerIndicateurScript } = await import('../indicatorEngine');
    const scriptDef = INDICATEURS_PAR_DEFAUT.find(
      (s) => s.id === 'script-sandbox-doji-shved-plage'
    );
    expect(scriptDef).toBeDefined();

    const bougies: Bougie[] = [];
    for (let k = 0; k < 30; k++) {
      bougies.push(creerBougie(k * 1000, 100, 105, 95, 101));
    }

    const res = evaluerIndicateurScript(scriptDef!.code, {
      bougies,
      parametres: scriptDef!.parametres,
      timeframe: 'H4',
    });

    expect(res).not.toBeNull();
    expect(res?.primitives).toBeDefined();
    expect(res?.typeSpecial).toBe('sandbox-doji-shved-plage');
  });

  it('filtre strictement les S/R Shved dont le début ou la fin dépasse de la plage temporelle', () => {
    const bougies: Bougie[] = [];

    // 10 bougies normales pour l'initialisation Shved
    for (let k = 0; k < 10; k++) {
      bougies.push(creerBougie(k * 1000, 100, 102, 98, 100));
    }

    // Bougie 10 créant un plus bas de référence à 85.0 (début de la plage = 10000)
    bougies.push(creerBougie(10000, 100, 101, 85.0, 92.0));

    // Des bougies intermédiaires formant des sommets et creux pour créer un S/R Shved
    // Bougie 13 (time = 13000) : résistance locale fractale
    bougies.push(creerBougie(11000, 92.0, 95.0, 90.0, 93.0));
    bougies.push(creerBougie(12000, 93.0, 98.0, 92.0, 97.0));
    bougies.push(creerBougie(13000, 97.0, 108.0, 96.0, 97.5)); // Pic fractal haut
    bougies.push(creerBougie(14000, 97.5, 98.0, 94.0, 94.5));
    bougies.push(creerBougie(15000, 94.5, 95.0, 91.0, 92.0));
    bougies.push(creerBougie(16000, 92.0, 96.0, 91.5, 95.0));

    // Cassure du pic de 13000 à la bougie 18 (time = 18000)
    bougies.push(creerBougie(17000, 95.0, 100.0, 94.0, 99.0));
    bougies.push(creerBougie(18000, 99.0, 110.0, 98.0, 109.0)); // Cassure de la résistance
    bougies.push(creerBougie(19000, 109.0, 110.0, 95.0, 96.0));

    // Formation du Doji Achat à la bougie 21 (time = 21000)
    // B1: Liquidation (96 -> 87), Low = 86 (>= 85.0 du creux précédent)
    bougies.push(creerBougie(20000, 96.0, 96.0, 86.0, 87.0));
    // B2: Réintégration haussière (87 -> 95.5)
    bougies.push(creerBougie(21000, 87.0, 96.0, 87.0, 95.5));

    // 1. Avec épuration totale stricte (exigerDebutEtFinDansPlage: true)
    const resStrict = calculerSandboxDojiShvedPlage(bougies, {
      activerFiltreTaille: false,
      exigerDebutEtFinDansPlage: true,
      timeframeSource: 'ACTUEL',
    });

    // 2. Avec mode permissif (exigerDebutEtFinDansPlage: false)
    const resPermissif = calculerSandboxDojiShvedPlage(bougies, {
      activerFiltreTaille: false,
      exigerDebutEtFinDansPlage: false,
      timeframeSource: 'ACTUEL',
    });

    expect(resStrict.signaux.length).toBeGreaterThanOrEqual(1);
    expect(resPermissif.signaux.length).toBeGreaterThanOrEqual(1);

    // Toutes les lignes tracées en mode strict doivent avoir leur début et fin
    // STRICTEMENT compris à l'intérieur de la plage [tempsDebutPlage, tempsFinPlage]
    for (const ligne of resStrict.primitives.lignes || []) {
      const debutLigne = Number(ligne.dateDebut);
      const finLigne = Number(ligne.dateFin);
      expect(debutLigne).toBeGreaterThanOrEqual(10000);
      expect(finLigne).toBeLessThanOrEqual(21000);
    }
  });

  it('affiche UNIQUEMENT les supports pour un setup Achat et UNIQUEMENT les résistances pour un setup Vente', () => {
    const bougies: Bougie[] = [];

    // Bougies de base
    for (let k = 0; k < 10; k++) {
      bougies.push(creerBougie(k * 1000, 100, 102, 98, 100));
    }

    // Creux de référence à 80.0
    bougies.push(creerBougie(10000, 100, 101, 80.0, 90.0));

    // Structure interne : creux local fractal pour créer un SUPPORT à 13000
    bougies.push(creerBougie(11000, 90.0, 95.0, 88.0, 93.0));
    bougies.push(creerBougie(12000, 93.0, 96.0, 91.0, 95.0));
    bougies.push(creerBougie(13000, 95.0, 96.0, 84.0, 92.0)); // Creux fractal
    bougies.push(creerBougie(14000, 92.0, 97.0, 90.0, 96.0));
    // Pic fractal pour créer une RÉSISTANCE à 15000
    bougies.push(creerBougie(15000, 96.0, 105.0, 95.0, 97.0)); // Sommet fractal
    bougies.push(creerBougie(16000, 97.0, 98.0, 93.0, 94.0));
    bougies.push(creerBougie(17000, 94.0, 95.0, 89.0, 90.0));

    // Doji Achat à 19000
    bougies.push(creerBougie(18000, 90.0, 90.0, 81.0, 82.0));
    bougies.push(creerBougie(19000, 82.0, 91.0, 82.0, 90.5));

    const resAchat = calculerSandboxDojiShvedPlage(bougies, {
      activerFiltreTaille: false,
      filtrerParDirectionSetup: true,
      timeframeSource: 'ACTUEL',
    });

    const signalAchat = resAchat.signaux.find((s) => s.type === 'ACHAT');
    expect(signalAchat).toBeDefined();

    // Pour l'achat, toutes les lignes affichées doivent être de couleur bullColor (support)
    // et aucune ligne de résistance ne doit être présente
    for (const ligne of resAchat.primitives.lignes || []) {
      expect(ligne.couleur).toBe('#00E676'); // bullColor
    }
  });

  it('évalue avec exactitude le score sur 100 points pour un niveau Shved', () => {
    const mockZone: ZoneShved = {
      id: 'shved-sup-1',
      type: 'SUPPORT',
      prixHaut: 101,
      prixBas: 99,
      prixMedian: 100,
      retests: 3,
      force: 'PROVEN',
      estFaible: false,
      estCassee: false,
      indexOrigine: 5,
      dateDebut: 5000,
      dateFin: 25000,
      datesTouches: [10000, 15000, 18000],
    };

    const bougiesTest: Bougie[] = [];
    for (let k = 0; k < 25; k++) {
      bougiesTest.push(creerBougie(k * 1000, 100, 105, 95, 100));
    }

    const evalScore = calculerScoreZoneShved(
      mockZone,
      bougiesTest,
      20,
      20000,
      2.0,
      2.0
    );

    expect(evalScore.score).toBeGreaterThanOrEqual(50);
    expect(evalScore.pointsRetests).toBe(35); // >=3 retests = 35 points
    expect(evalScore.pointsIntegrite).toBe(10); // Intacte = 10 points
  });

  it('applique le tri par score de liquidité et le filtre Top N', () => {
    const bougies: Bougie[] = [];

    // 15 bougies d'initialisation pour l'ATR et les fractals
    for (let k = 0; k < 15; k++) {
      bougies.push(creerBougie(k * 1000, 100, 102, 98, 100));
    }

    // Creux de référence à 80.0 (index 15)
    bougies.push(creerBougie(15000, 100, 101, 80.0, 90.0));

    // Des oscillations pour former des fractals Shved dans la plage
    bougies.push(creerBougie(16000, 90.0, 95.0, 89.0, 94.0));
    bougies.push(creerBougie(17000, 94.0, 96.0, 91.0, 95.0));
    bougies.push(creerBougie(18000, 95.0, 96.0, 84.0, 92.0)); // Creux fractal
    bougies.push(creerBougie(19000, 92.0, 97.0, 90.0, 96.0));
    bougies.push(creerBougie(20000, 96.0, 102.0, 95.0, 97.0));
    bougies.push(creerBougie(21000, 97.0, 98.0, 92.0, 93.0));
    bougies.push(creerBougie(22000, 93.0, 95.0, 86.0, 91.0)); // Creux fractal 2
    bougies.push(creerBougie(23000, 91.0, 97.0, 90.0, 96.0));
    bougies.push(creerBougie(24000, 96.0, 99.0, 93.0, 94.0));

    // Doji Achat aux bougies 25-26
    bougies.push(creerBougie(25000, 94.0, 94.0, 81.0, 82.0));
    bougies.push(creerBougie(26000, 82.0, 94.0, 82.0, 93.5));

    // Test avec Top 1 et affichage du score sur la ligne
    const resTop1 = calculerSandboxDojiShvedPlage(bougies, {
      activerFiltreTaille: false,
      topNiveauxScore: 1,
      afficherScoreSurLigne: true,
      exigerDebutEtFinDansPlage: false,
      timeframeSource: 'ACTUEL',
    });

    const signalTop1 = resTop1.signaux.find((s) => s.type === 'ACHAT');
    expect(signalTop1).toBeDefined();

    // Pour ce signal, exactement 1 seul niveau a été retenu grâce au Top 1
    expect(signalTop1?.nombreNiveauxDansPlage).toBe(1);
    expect(signalTop1?.meilleurScore).toBeGreaterThanOrEqual(10);

    // Les lignes tracées pour ce signal spécifique sont limitées à 1
    const lignesDuSignal = (resTop1.primitives.lignes || []).filter(
      (l) => l.id?.endsWith(`-doji-${signalTop1!.indexBougie}`)
    );
    expect(lignesDuSignal.length).toBe(1);
    expect(lignesDuSignal[0].label).toContain('pts');
  });

  it('exporte avec succès les 3 indicateurs favoris depuis le dossier favoris', async () => {
    const favoris = await import('../favoris');
    expect(favoris.calculerSandboxDojiShvedPlage).toBeDefined();
    expect(favoris.calculerMoneyManagementRules).toBeDefined();
    expect(favoris.calculerUnmitigatedOverlapProfile).toBeDefined();
    // Vérification de la modularité des Blocs 1 et 2
    expect(favoris.detecterDojisAvecPlage).toBeDefined();
    expect(favoris.evaluerNiveauxShvedDansPlage).toBeDefined();
  });

  it('permet au Bloc 1 de détecter les Dojis de façon totalement indépendante', () => {
    const bougies: Bougie[] = [];
    for (let k = 0; k < 15; k++) {
      bougies.push(creerBougie(k * 1000, 100, 102, 98, 100));
    }
    // Doji Achat
    bougies.push(creerBougie(15000, 99.0, 99.0, 85.0, 86.0));
    bougies.push(creerBougie(16000, 86.0, 99.0, 86.0, 98.8));

    const dojis = detecterDojisAvecPlage(bougies, { activerFiltreTaille: false });
    expect(dojis.length).toBeGreaterThanOrEqual(1);
    expect(dojis[0].type).toBe('ACHAT');
    expect(dojis[0].tailleLiquidation).toBeGreaterThan(0);
    expect(dojis[0].tempsDebutPlage).toBeDefined();
  });
});

