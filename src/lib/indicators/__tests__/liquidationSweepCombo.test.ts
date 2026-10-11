import { describe, it, expect } from 'vitest';
import type { Bougie } from '@/lib/chartDataHelper';
import { calculerLiquidationSweepCombo } from '../liquidationSweepCombo';
import { evaluerIndicateurScript, INDICATEURS_PAR_DEFAUT } from '../indicatorEngine';

describe('Indicateur Combiné : Liq/Reint + Sweep Liquidité (BSL/SSL)', () => {
  // Fonction utilitaire pour générer des bougies de test claires et simples
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

  it('détecte un setup ACHAT avec balayage d un creux SSL préalable par la Bougie 1', () => {
    // Construction d'un historique contenant :
    // 1. Un creux pivot SSL clair à l'index 2 (Low = 96)
    // 2. Un rebond intermédiaire vers 102
    // 3. Setup Liq/Reint : Bougie 1 descend balayer le creux avec Low = 94 (< 96)
    // 4. Bougie 2 réintègre immédiatement vers 104.8
    const bougies: Bougie[] = [
      creerBougie(1000, 100, 101, 98, 99),
      creerBougie(2000, 99, 100, 97, 98),
      creerBougie(3000, 98, 99, 96, 98),   // Creux SSL (Low = 96)
      creerBougie(4000, 98, 102, 97, 101),
      creerBougie(5000, 101, 103, 100, 102),
      creerBougie(6000, 102, 103, 101, 102),
      creerBougie(7000, 102, 103, 101, 102),
      // Bougie 1 : Vendeuse impulsive balayant le creux (105 -> 96, Low = 94 < 96)
      creerBougie(8000, 105, 105, 94, 96),
      // Bougie 2 : Acheteuse impulsive réintégrant (96 -> 104.8, Low = 95)
      creerBougie(9000, 96, 105, 95, 104.8),
    ];

    const resultat = calculerLiquidationSweepCombo(bougies, {
      sensibilitePivotLiquidite: 2,
      lookbackLiquidite: 50,
      exigerLiquiditeBalayee: true,
      activerFiltreTaille: false, // Désactivé ici pour tester purement la logique de sweep
    });

    expect(resultat.signaux.length).toBe(1);
    const signal = resultat.signaux[0];
    expect(signal.type).toBe('ACHAT');
    expect(signal.indexBougie).toBe(8);
    expect(signal.prixExtreme).toBe(94); // Point bas fait par Bougie 1
    expect(signal.bougieExtreme).toBe(1);

    // Vérification de la liquidité SSL balayée
    expect(signal.liquidite).toBeDefined();
    expect(signal.liquidite?.type).toBe('SSL');
    expect(signal.liquidite?.prix).toBe(96);
    expect(signal.liquidite?.profondeurSweep).toBeCloseTo(2, 2); // 96 - 94 = 2

    // Primitives visuelles générées
    expect(resultat.primitives.lignes?.length).toBeGreaterThanOrEqual(1);
    const ligneSSL = resultat.primitives.lignes?.find((l) => l.label?.includes('SSL Balayée'));
    expect(ligneSSL).toBeDefined();
    expect(ligneSSL?.prix).toBe(96);

    expect(resultat.primitives.boites?.length).toBeGreaterThanOrEqual(1);
    const boiteSweep = resultat.primitives.boites?.find((b) => b.label?.includes('Zone de Sweep'));
    expect(boiteSweep).toBeDefined();
    expect(boiteSweep?.prixHaut).toBe(96);
    expect(boiteSweep?.prixBas).toBe(94);
  });

  it('détecte un setup ACHAT où la mèche extrême est portée par la Bougie 2', () => {
    const bougies: Bougie[] = [
      creerBougie(1000, 100, 101, 98, 99),
      creerBougie(2000, 99, 100, 97, 98),
      creerBougie(3000, 98, 99, 96, 98),   // Creux SSL (Low = 96)
      creerBougie(4000, 98, 102, 97, 101),
      creerBougie(5000, 101, 103, 100, 102),
      // Bougie 1 : Vendeuse (105 -> 97, Low = 96.5 n'a pas encore cassé 96)
      creerBougie(6000, 105, 105, 96.5, 97),
      // Bougie 2 : Acheteuse avec fausse cassure extrême (Low = 93.5 < 96) puis réintégration (97 -> 105)
      creerBougie(7000, 97, 105.2, 93.5, 105),
    ];

    const resultat = calculerLiquidationSweepCombo(bougies, {
      sensibilitePivotLiquidite: 2,
      lookbackLiquidite: 50,
      exigerLiquiditeBalayee: true,
      activerFiltreTaille: false,
    });

    expect(resultat.signaux.length).toBe(1);
    const signal = resultat.signaux[0];
    expect(signal.type).toBe('ACHAT');
    expect(signal.prixExtreme).toBe(93.5);
    expect(signal.bougieExtreme).toBe(2); // Porté par la Bougie 2 !
    expect(signal.liquidite?.type).toBe('SSL');
    expect(signal.liquidite?.prix).toBe(96);
  });

  it('détecte un setup VENTE avec balayage d un sommet BSL préalable', () => {
    const bougies: Bougie[] = [
      creerBougie(1000, 100, 101, 99, 100),
      creerBougie(2000, 100, 101, 99, 101),
      creerBougie(3000, 101, 104, 100, 103),  // Sommet BSL à 104
      creerBougie(4000, 103, 103.5, 101, 102), // Descente douce sans réintégration
      creerBougie(5000, 102, 102.5, 99, 100),
      creerBougie(6000, 100, 100.5, 98, 99),
      // Bougie 1 : Acheteuse impulsive qui monte balayer 104 (97 -> 103.5, High = 106 > 104)
      creerBougie(7000, 97, 106, 96, 103.5),
      // Bougie 2 : Vendeuse impulsive qui réintègre immédiatement vers 97.2 (103.5 -> 97.2)
      creerBougie(8000, 103.5, 104, 96.5, 97.2),
    ];

    const resultat = calculerLiquidationSweepCombo(bougies, {
      sensibilitePivotLiquidite: 2,
      lookbackLiquidite: 50,
      exigerLiquiditeBalayee: true,
      activerFiltreTaille: false,
    });

    expect(resultat.signaux.length).toBe(1);
    const signal = resultat.signaux[0];
    expect(signal.type).toBe('VENTE');
    expect(signal.prixExtreme).toBe(106);
    expect(signal.liquidite?.type).toBe('BSL');
    expect(signal.liquidite?.prix).toBe(104);
    expect(signal.liquidite?.profondeurSweep).toBeCloseTo(2, 2); // 106 - 104 = 2

    const ligneBSL = resultat.primitives.lignes?.find((l) => l.label?.includes('BSL Balayée'));
    expect(ligneBSL).toBeDefined();
    expect(ligneBSL?.prix).toBe(104);
  });

  it('rejette le signal si exigerLiquiditeBalayee = true et qu aucune liquidité n a été balayée', () => {
    // Bougies formant le pattern mais dans le vide absolu (pas de niveau historique sous Low = 95)
    const bougies: Bougie[] = [
      creerBougie(1000, 100, 101, 99, 100),
      creerBougie(2000, 100, 101, 99, 100),
      creerBougie(3000, 100, 101, 99, 100),
      // Les bougies historiques ont des creux à 90 (bien plus bas que 95, donc 95 ne les balaye pas)
      creerBougie(4000, 95, 96, 90, 92),
      creerBougie(5000, 92, 93, 90, 91),
      // Bougie 1 : Low = 95 (ne traverse aucun creux historique car les creux sont à 90)
      creerBougie(6000, 105, 105, 95, 97),
      // Bougie 2 : Réintégration
      creerBougie(7000, 97, 105, 96, 104.8),
    ];

    const resSansFiltre = calculerLiquidationSweepCombo(bougies, {
      exigerLiquiditeBalayee: false,
      activerFiltreTaille: false,
    });
    // Sans filtre de sweep obligatoire, le pattern géométrique est détecté
    expect(resSansFiltre.signaux.length).toBe(1);

    const resAvecFiltre = calculerLiquidationSweepCombo(bougies, {
      exigerLiquiditeBalayee: true,
      activerFiltreTaille: false,
    });
    // Avec le filtre, le pattern est rejeté car aucune liquidité n'a été balayée !
    expect(resAvecFiltre.signaux.length).toBe(0);
  });

  it('s exécute parfaitement dans le moteur d indicateurs officiel (evaluerIndicateurScript)', () => {
    const indScript = INDICATEURS_PAR_DEFAUT.find(
      (ind) => ind.id === 'script-liquidation-sweep-combo'
    );
    expect(indScript).toBeDefined();

    const bougies: Bougie[] = [
      creerBougie(1000, 100, 101, 98, 99),
      creerBougie(2000, 99, 100, 97, 98),
      creerBougie(3000, 98, 99, 96, 98),
      creerBougie(4000, 98, 102, 97, 101),
      creerBougie(5000, 101, 103, 100, 102),
      creerBougie(6000, 102, 103, 101, 102),
      creerBougie(7000, 102, 103, 101, 102),
      creerBougie(8000, 105, 105, 94, 96),
      creerBougie(9000, 96, 105, 95, 104.8),
    ];

    const resultat = evaluerIndicateurScript(indScript!.code, {
      bougies,
      parametres: {
        ...indScript!.parametres,
        sensibilitePivotLiquidite: 2,
        activerFiltreTaille: false,
      },
    });

    expect(resultat).not.toBeNull();
    expect(resultat?.primitives?.labels?.length).toBeGreaterThanOrEqual(1);
    expect(resultat?.primitives?.lignes?.length).toBeGreaterThanOrEqual(1);
    expect(resultat?.primitives?.boites?.length).toBeGreaterThanOrEqual(1);
  });
});
