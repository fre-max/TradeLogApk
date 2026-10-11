import { describe, it, expect } from 'vitest';
import type { Bougie } from '@/lib/chartDataHelper';
import { calculerLiquidationSweepCombo } from '../liquidationSweepCombo';
import { evaluerIndicateurScript, INDICATEURS_PAR_DEFAUT } from '../indicatorEngine';

describe('Indicateur Combiné : Liq/Reint + Sweep Liquidité & Multi-Liquidations S/R', () => {
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

  it('détecte un setup ACHAT avec balayage simple SSL (1x)', () => {
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
      activerFiltreTaille: false,
    });

    expect(resultat.signaux.length).toBe(1);
    const signal = resultat.signaux[0];
    expect(signal.type).toBe('ACHAT');
    expect(signal.prixExtreme).toBe(94);
    expect(signal.bougieExtreme).toBe(1);

    // Multi-liquidation : 1x (Simple sweep)
    expect(signal.liquidite?.compteurLiquidations).toBe(1);
    expect(signal.liquidite?.typeMultiLiquidation).toBe('SIMPLE');

    // Vérification visuelle
    expect(resultat.primitives.labels?.[0]?.texte).toContain('[1x]');
    expect(resultat.statistiques.totalSimplesLiquidations).toBe(1);
  });

  it('détecte un setup VENTE avec Double Liquidation sur Résistance (2x)', () => {
    // Historique comprenant :
    // 1. Sommet BSL #1 à 104 (temps 3000)
    // 2. Un repli puis un deuxième test/balayage à 104.2 (temps 5000)
    // 3. Setup de vente final (temps 7000-8000) montant à 106 (> 104 et 104.2) puis réintégrant
    const bougies: Bougie[] = [
      creerBougie(1000, 100, 101, 99, 100),
      creerBougie(2000, 100, 101, 99, 100.5),
      creerBougie(3000, 100.5, 104, 100, 103.5),    // Sommet #1 (High = 104)
      creerBougie(4000, 103.5, 103.8, 102.5, 103),  // Pas de réintégration
      creerBougie(5000, 103, 104.2, 101.5, 103.8),  // Sommet #2 dans la même zone S/R (High = 104.2)
      creerBougie(6000, 103.8, 103.9, 101, 102),
      creerBougie(7000, 102, 102.5, 98, 99),        // Descente vers le bas
      creerBougie(8000, 99, 100, 96, 97),
      // Setup Liq/Reint : Bougie 1 monte balayer la zone (97 -> 104, High = 106)
      creerBougie(9000, 97, 106, 96.5, 104),
      // Bougie 2 : Réintégration baissière immédiate vers 97.2 (104 -> 97.2)
      creerBougie(10000, 104, 104.5, 96.8, 97.2),
    ];

    const resultat = calculerLiquidationSweepCombo(bougies, {
      sensibilitePivotLiquidite: 2,
      lookbackLiquidite: 50,
      toleranceZoneSR: 0.5, // 0.5% pour englober 104 et 104.2
      exigerLiquiditeBalayee: true,
      activerFiltreTaille: false,
    });

    expect(resultat.signaux.length).toBe(1);
    const signal = resultat.signaux[0];
    expect(signal.type).toBe('VENTE');
    expect(signal.prixExtreme).toBe(106);

    // Détection de la Double Liquidation (2x)
    expect(signal.liquidite?.compteurLiquidations).toBe(2);
    expect(signal.liquidite?.typeMultiLiquidation).toBe('DOUBLE');
    expect(resultat.statistiques.totalDoublesLiquidations).toBe(1);

    // Badge dynamique avec 🔥
    expect(resultat.primitives.labels?.[0]?.texte).toContain('Double Sweep');
    expect(resultat.primitives.labels?.[0]?.texte).toContain('2x');

    // Lignes reliant les sweeps de résistance
    const lignesMulti = resultat.primitives.lignes?.filter((l) => l.label?.includes('Sweep Résistance'));
    expect(lignesMulti?.length).toBeGreaterThanOrEqual(1);

    // Boîte de la zone de Résistance S/R
    const boiteSR = resultat.primitives.boites?.find((b) => b.label?.includes('Zone Résistance'));
    expect(boiteSR).toBeDefined();
  });

  it('filtre efficacement avec seuilMinLiquidations = 2 pour n accepter QUE les multi-liquidations', () => {
    // Cas avec un simple sweep 1x (aucun autre sommet dans la zone)
    const bougiesSimple: Bougie[] = [
      creerBougie(1000, 100, 101, 99, 100),
      creerBougie(2000, 100, 101, 99, 101),
      creerBougie(3000, 101, 104, 100, 103),  // Sommet unique à 104
      creerBougie(4000, 103, 103.5, 101, 102),
      creerBougie(5000, 102, 102.5, 99, 100),
      creerBougie(6000, 100, 100.5, 98, 99),
      creerBougie(7000, 97, 106, 96, 103.5),
      creerBougie(8000, 103.5, 104, 96.5, 97.2),
    ];

    // Avec seuilMinLiquidations = 1 : accepté (1x)
    const resTous = calculerLiquidationSweepCombo(bougiesSimple, {
      seuilMinLiquidations: 1,
      activerFiltreTaille: false,
    });
    expect(resTous.signaux.length).toBe(1);

    // Avec seuilMinLiquidations = 2 : rejeté car ce n'est pas une double ou triple liquidation !
    const resMultiSeulement = calculerLiquidationSweepCombo(bougiesSimple, {
      seuilMinLiquidations: 2,
      activerFiltreTaille: false,
    });
    expect(resMultiSeulement.signaux.length).toBe(0);
  });

  it('s exécute parfaitement dans le moteur d indicateurs officiel avec les nouveaux paramètres', () => {
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
        toleranceZoneSR: 0.2,
        seuilMinLiquidations: 1,
        activerFiltreTaille: false,
      },
    });

    expect(resultat).not.toBeNull();
    expect(resultat?.primitives?.labels?.length).toBeGreaterThanOrEqual(1);
    expect(resultat?.primitives?.lignes?.length).toBeGreaterThanOrEqual(1);
    expect(resultat?.primitives?.boites?.length).toBeGreaterThanOrEqual(1);
  });
});
