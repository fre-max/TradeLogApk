import { describe, it, expect } from 'vitest';
import type { Bougie } from '@/lib/chartDataHelper';
import type { ZoneShved } from '@/lib/bot/modules/01_liquidite/shvedSupplyDemand';
import {
  calculerSandboxDojiShvedPlage,
  calculerScoreZoneShved,
  detecterDojisAvecPlage,
  evaluerNiveauxShvedDansPlage,
  validerDojiAvecZigzag,
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
      activerFiltreZigzag: false,
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
      activerFiltreZigzag: false,
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

  it('calcule et enrichit chaque signal avec toutesZonesCandidates et zoneRetenue pour le diagnostic', () => {
    const bougies: Bougie[] = [];
    for (let k = 0; k < 25; k++) {
      bougies.push(creerBougie(k * 1000, 100, 102, 98, 100));
    }
    // Doji Achat
    bougies.push(creerBougie(25000, 99.0, 99.0, 85.0, 86.0));
    bougies.push(creerBougie(26000, 86.0, 99.0, 86.0, 98.8));

    const res = calculerSandboxDojiShvedPlage(bougies, { activerFiltreTaille: false });
    expect(res.signaux.length).toBeGreaterThanOrEqual(1);

    const sig = res.signaux[0];
    expect(sig.id).toBeDefined();
    expect(sig.toutesZonesCandidates).toBeDefined();
    expect(Array.isArray(sig.toutesZonesCandidates)).toBe(true);

    if (sig.toutesZonesCandidates && sig.toutesZonesCandidates.length > 0) {
      const cand = sig.toutesZonesCandidates[0];
      expect(cand.score).toBeDefined();
      expect(cand.pointsRetests).toBeDefined();
      expect(cand.pointsRejets).toBeDefined();
      expect(cand.pointsProportionnalite).toBeDefined();
      expect(cand.pointsIntegrite).toBeDefined();
      expect(cand.motifSelection).toBeDefined();
    }
  });

  it('définit periodeATR à 2 et zoneFuzzFactor à 0.01 par défaut dans le script officiel', async () => {
    const { INDICATEURS_PAR_DEFAUT } = await import('../indicatorEngine');
    const scriptSandbox = INDICATEURS_PAR_DEFAUT.find(
      (s) => s.id === 'script-sandbox-doji-shved-plage'
    );
    expect(scriptSandbox).toBeDefined();
    expect(scriptSandbox?.parametres?.periodeATR).toBe(2);
    expect(scriptSandbox?.parametres?.zoneFuzzFactor).toBe(0.01);

    // Vérifie la présence des variables dans definitionsVariables
    const varATR = scriptSandbox?.definitionsVariables?.find((v) => v.cle === 'periodeATR');
    const varFuzz = scriptSandbox?.definitionsVariables?.find((v) => v.cle === 'zoneFuzzFactor');
    const varSection = scriptSandbox?.definitionsVariables?.find((v) => v.cle === 'sectionnerNiveauxAnterieurs');

    expect(varATR).toBeDefined();
    expect(varATR?.valeurParDefaut).toBe(2);
    expect(varFuzz).toBeDefined();
    expect(varFuzz?.valeurParDefaut).toBe(0.01);
    expect(varSection).toBeDefined();
    expect(varSection?.valeurParDefaut).toBe(true);
  });

  it('sectionne un support né avant la plage ayant des retests dans la plage (Option A + Option 1)', () => {
    const bougies: Bougie[] = [];

    // Bougie 0 à 9 : passé lointain
    for (let k = 0; k < 10; k++) {
      bougies.push(creerBougie(k * 1000, 100, 102, 98, 100));
    }

    // Bougie 10 : creux de référence créant le début de la plage temporelle (temps = 10000)
    bougies.push(creerBougie(10000, 100, 101, 80.0, 90.0));

    // Bougies 11 à 19 : retests du niveau 95.0 à l'intérieur de la plage (à k=13 et k=16)
    for (let k = 11; k < 20; k++) {
      if (k === 13 || k === 16) {
        bougies.push(creerBougie(k * 1000, 96, 98, 94.5, 96));
      } else {
        bougies.push(creerBougie(k * 1000, 100, 105, 98, 102));
      }
    }

    // Formation du Doji Achat à 20000 et 21000
    bougies.push(creerBougie(20000, 100, 100, 81.0, 82.0));
    bougies.push(creerBougie(21000, 82.0, 101.0, 82.0, 100.5));

    // Simulation d'une zone Shved née bien avant (index 2, dateDebut = 2000)
    const zoneAncienne: ZoneShved = {
      id: 'shved-sup-ancien-2',
      type: 'SUPPORT',
      prixHaut: 95.5,
      prixBas: 94.5,
      prixMedian: 95.0,
      retests: 5, // 3 passés + 2 dans la plage
      force: 'PROVEN',
      estFaible: false,
      estCassee: false,
      indexOrigine: 2,
      dateDebut: 2000,
      dateFin: 21000,
      datesTouches: [3000, 5000, 7000, 13000, 16000],
    };

    const signalDoji = {
      type: 'ACHAT' as const,
      indexBougie: 21,
      temps: 21000,
      prixExtreme: 81.0,
      open1: 100,
      close2: 100.5,
      tailleLiquidation: 19.0,
      indexDebutPlage: 10,
      tempsDebutPlage: 10000,
      prixExtremePrecedent: 80.0,
      moyenneHauteur: 5.0,
    };

    // 1. Avec sectionnement actif (défaut) : le niveau ancien est sectionné et retenu
    const zonesAvecSection = evaluerNiveauxShvedDansPlage(
      [zoneAncienne],
      signalDoji,
      bougies,
      { exigerDebutEtFinDansPlage: true, sectionnerNiveauxAnterieurs: true }
    );

    expect(zonesAvecSection.length).toBe(1);
    const retenue = zonesAvecSection[0];
    expect(retenue.estSectionnee).toBe(true);
    // Option A : La date de début est ramenée au début de la plage temporelle
    expect(retenue.zone.dateDebut).toBe(10000);
    expect(retenue.zone.indexOrigine).toBe(10);
    // Option 1 : Les retests locaux comptabilisés sont uniquement les 2 survenus dans la plage
    expect(retenue.retestsAvant).toBe(2);

    // 2. Avec sectionnement désactivé : l'épuration totale élimine le niveau ancien
    const zonesSansSection = evaluerNiveauxShvedDansPlage(
      [zoneAncienne],
      signalDoji,
      bougies,
      { exigerDebutEtFinDansPlage: true, sectionnerNiveauxAnterieurs: false }
    );
    expect(zonesSansSection.length).toBe(0);
  });

  it('valide le filtre ZigZag : Règle 1 (sens de vague) et Règle 2 (extrême absolu de vague)', () => {
    // Construction de 20 bougies simulant une baisse depuis un sommet (index 5) jusqu'à un Doji d'achat (index 15 et 16)
    const bougies: Bougie[] = [];
    for (let k = 0; k <= 20; k++) {
      if (k === 5) {
        // Sommet ZigZag majeur à l'index 5 (High = 120)
        bougies.push(creerBougie(k * 1000, 110, 120, 108, 115));
      } else if (k < 15) {
        // Vague baissière progressive de 115 à 95
        const base = 115 - (k - 5) * 2;
        bougies.push(creerBougie(k * 1000, base, base + 2, base - 2, base));
      } else if (k === 15) {
        // Bougie 1 du Doji d'achat : liquidation vers 80 (Low = 80)
        bougies.push(creerBougie(15000, 95, 95, 80, 82));
      } else if (k === 16) {
        // Bougie 2 du Doji d'achat : réintégration haussière (Close = 96)
        bougies.push(creerBougie(16000, 82, 97, 82, 96));
      } else {
        bougies.push(creerBougie(k * 1000, 96, 98, 95, 97));
      }
    }

    // 1️⃣ Cas Valide Achat : Vague baissière (dernier pivot est un sommet à index 5) et Doji est le plus bas absolu (80)
    const pivotsBaissiers = [
      { index: 5, prix: 120, estHaut: true, temps: 5000, labelSMC: 'HH' as const },
    ];
    const verifValide = validerDojiAvecZigzag(pivotsBaissiers, bougies, 16, 'ACHAT');
    expect(verifValide.estValide).toBe(true);
    expect(verifValide.directionVague).toBe('BAISSIERE');
    expect(verifValide.prixExtremeDoji).toBe(80);

    // 2️⃣ Cas Rejet Achat : Le dernier pivot est un creux (estHaut = false) => vague haussière => refusé
    const pivotsHaussiers = [
      { index: 5, prix: 75, estHaut: false, temps: 5000, labelSMC: 'LL' as const },
    ];
    const verifRefusSens = validerDojiAvecZigzag(pivotsHaussiers, bougies, 16, 'ACHAT');
    expect(verifRefusSens.estValide).toBe(false);
    expect(verifRefusSens.motif).toContain('vague en cours est HAUSSIÈRE');

    // 3️⃣ Cas Rejet Achat : Vague baissière mais une bougie intermédiaire était encore plus basse que le Doji
    bougies[10].low = 70; // 70 < 80
    const verifRefusExtreme = validerDojiAvecZigzag(pivotsBaissiers, bougies, 16, 'ACHAT');
    expect(verifRefusExtreme.estValide).toBe(false);
    expect(verifRefusExtreme.motif).toContain("n'est pas le plus bas absolu de la vague");
    expect(verifRefusExtreme.prixExtremeVague).toBe(70);
  });

  it('expose les paramètres et variables UI ZigZag dans le script officiel', async () => {
    const { INDICATEURS_PAR_DEFAUT } = await import('../indicatorEngine');
    const scriptSandbox = INDICATEURS_PAR_DEFAUT.find(
      (s) => s.id === 'script-sandbox-doji-shved-plage'
    );
    expect(scriptSandbox).toBeDefined();
    expect(scriptSandbox?.parametres?.activerFiltreZigzag).toBe(true);
    expect(scriptSandbox?.parametres?.profondeurZigzag).toBe(5);
    expect(scriptSandbox?.parametres?.afficherLignesZigzag).toBe(false);
    expect(scriptSandbox?.parametres?.couleurZigzag).toBe('#FFA726');

    // Définitions de variables
    const varActiver = scriptSandbox?.definitionsVariables?.find((v) => v.cle === 'activerFiltreZigzag');
    const varProf = scriptSandbox?.definitionsVariables?.find((v) => v.cle === 'profondeurZigzag');
    const varAfficher = scriptSandbox?.definitionsVariables?.find((v) => v.cle === 'afficherLignesZigzag');
    const varCoul = scriptSandbox?.definitionsVariables?.find((v) => v.cle === 'couleurZigzag');

    expect(varActiver).toBeDefined();
    expect(varActiver?.groupe).toBe('Filtre Structurel ZigZag');
    expect(varProf).toBeDefined();
    expect(varProf?.valeurParDefaut).toBe(5);
    expect(varAfficher).toBeDefined();
    expect(varAfficher?.valeurParDefaut).toBe(false);
    expect(varCoul).toBeDefined();
    expect(varCoul?.valeurParDefaut).toBe('#FFA726');
  });
});

