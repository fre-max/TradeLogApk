import { describe, it, expect } from 'vitest';
import type { Bougie } from '@/lib/chartDataHelper';
import { calculerLiquidationSweepCombo } from '../liquidationSweepCombo';
import { evaluerIndicateurScript, INDICATEURS_PAR_DEFAUT } from '../indicatorEngine';

describe('Indicateur Combiné : Liq/Reint + Sweep Liquidité la plus Adaptée', () => {
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

  it('détecte un setup ACHAT et sélectionne la liquidité SSL avec score d adéquation', () => {
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
      distanceMinBougies: 2,
      exigerLiquiditeBalayee: true,
      activerFiltreTaille: false,
    });

    expect(resultat.signaux.length).toBe(1);
    const signal = resultat.signaux[0];
    expect(signal.type).toBe('ACHAT');
    expect(signal.prixExtreme).toBe(94);
    expect(signal.bougieExtreme).toBe(1);

    // Liquidité balayée trouvée et notée
    expect(signal.liquidite).toBeDefined();
    expect(signal.liquidite?.type).toBe('SSL');
    expect(signal.liquidite?.prix).toBe(96);
    expect(signal.liquidite?.scoreAdequation).toBeGreaterThanOrEqual(50);
    expect(signal.liquidite?.profondeurSweep).toBe(2); // 96 - 94 = 2

    // Vérification visuelle
    expect(resultat.primitives.labels?.[0]?.texte).toContain('Sweep SSL');
    expect(resultat.primitives.labels?.[0]?.texte).toContain('%');
    expect(resultat.statistiques.totalLiquiditesBalayees).toBe(1);
  });

  it('choisit le creux ayant le plus fort relief en mode SWING_MAJEUR', () => {
    // Deux creux dans l'historique balayés par le même sweep extrême :
    // 1. Creux #1 à 96.5 avec grand relief (entouré de sommets à 105)
    // 2. Micro-creux #2 à 96.8 avec relief faible (entouré de sommets à 98)
    const bougies: Bougie[] = [
      creerBougie(1000, 102, 115, 101, 114),
      creerBougie(2000, 114, 114.5, 96.5, 97),  // Creux majeur #1 (Low = 96.5, relief 18.5)
      creerBougie(3000, 97, 115, 96.8, 104),   // Clôture à 104 (loin de 114, pas de setup précoce)
      creerBougie(4000, 104, 105, 103, 104),
      creerBougie(5000, 104, 104, 98, 98.5),
      creerBougie(6000, 98.5, 99, 96.8, 98.2),  // Creux mineur #2 (Low = 96.8, relief ~2.2)
      creerBougie(7000, 98.2, 99.5, 98, 99),
      creerBougie(8000, 99, 100, 98.5, 99.2),
      // Setup Liq/Reint balayant les 2 creux (Low = 95 < 96.5 et 96.8)
      creerBougie(9000, 103, 103, 95, 96),
      creerBougie(10000, 96, 103, 95.5, 102.8),
    ];

    const resSwingMajeur = calculerLiquidationSweepCombo(bougies, {
      sensibilitePivotLiquidite: 1,
      modeSelectionLiquidite: 'SWING_MAJEUR',
      distanceMinBougies: 1,
      activerFiltreTaille: false,
    });

    expect(resSwingMajeur.signaux.length).toBe(1);
    const liqChoisie = resSwingMajeur.signaux[0].liquidite;
    expect(liqChoisie).toBeDefined();
    // En mode SWING_MAJEUR, c'est le creux #1 à 96.5 qui doit être sélectionné
    expect(liqChoisie?.prix).toBe(96.5);
    expect(liqChoisie?.qualiteNiveau).toBe('MAJEUR');
  });

  it('rejette un breakout excessif grâce au filtre de pénétration maximale', () => {
    // Un cas où la mèche s'enfonce à 10x la taille moyenne (breakout brutal, pas un sweep propre)
    const bougies: Bougie[] = [
      creerBougie(1000, 100, 101, 98, 99),
      creerBougie(2000, 99, 100, 97, 98),
      creerBougie(3000, 98, 99, 96, 98),   // Creux SSL à 96
      creerBougie(4000, 98, 101, 97, 100),
      creerBougie(5000, 100, 101, 99, 100),
      creerBougie(6000, 100, 101, 99, 100),
      // Mèche descendant jusqu'à 80 (pénétration = 16 points pour des bougies de 3 points = 5.3x la moyenne)
      creerBougie(7000, 101, 101, 80, 95),
      creerBougie(8000, 95, 102, 94, 100.8),
    ];

    // Avec penetrationMaxRatio = 1.0 (rejeté car pénétration > 1.0x)
    const resFiltre = calculerLiquidationSweepCombo(bougies, {
      sensibilitePivotLiquidite: 2,
      penetrationMaxRatio: 1.0,
      exigerLiquiditeBalayee: true,
      activerFiltreTaille: false,
    });

    expect(resFiltre.signaux.length).toBe(0);
  });

  it('s exécute parfaitement dans le moteur d indicateurs officiel avec les paramètres de liquidité adaptée', () => {
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
        distanceMinBougies: 2,
        activerFiltreTaille: false,
      },
    });

    expect(resultat).toBeDefined();
    expect(resultat!.donnees.signaux.length).toBe(1);
    expect(resultat!.primitives?.labels?.length).toBeGreaterThan(0);
    expect(resultat!.donnees.statistiques.totalLiquiditesBalayees).toBe(1);
  });
});
