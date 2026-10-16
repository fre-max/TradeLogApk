import { describe, it, expect } from 'vitest';
import type { Bougie } from '@/lib/chartDataHelper';
import { calculerLiquidationReintegration, diagnostiquerBougieDoji } from '../liquidationReintegration';
import { evaluerIndicateurScript, INDICATEURS_PAR_DEFAUT } from '../indicatorEngine';

describe('Indicateur Autonome : Liquidation & Réintégration (Liq / Reint)', () => {
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

  it('détecte un signal d achat (Bullish) avec sweep bas et réintégration où Close(2) ≈ Open(1)', () => {
    // 5 bougies d'historique de taille normale (Range = 2, Corps = 1)
    const bougies: Bougie[] = [
      creerBougie(1000, 100, 101, 99, 100),
      creerBougie(2000, 100, 101, 99, 101),
      creerBougie(3000, 100, 101, 99, 100),
      creerBougie(4000, 100, 101, 99, 101),
      creerBougie(5000, 100, 101, 99, 100),
      // Bougie 1 : Vendeuse (105 -> 97), Low = 95, Range = 10 (>= 1.75 * 2 = 3.5)
      creerBougie(6000, 105, 105, 95, 97),
      // Bougie 2 : Acheteuse (97 -> 104.8), Corps = 7.8 (>= 1.75 * 1 = 1.75), Close(104.8) ≈ Open1(105)
      creerBougie(7000, 97, 105, 96, 104.8),
    ];

    const resultat = calculerLiquidationReintegration(bougies, {
      toleranceDeficit: 0.05,
      toleranceDepassement: 0.25,
      activerFiltreTaille: true,
      multiplicateurBougie1: 1.75,
      multiplicateurCorps2: 1.75,
    });

    expect(resultat.signaux.length).toBe(1);
    const signal = resultat.signaux[0];
    expect(signal.type).toBe('ACHAT');
    expect(signal.indexBougie).toBe(6);
    expect(signal.open1).toBe(105);
    expect(signal.close2).toBe(104.8);
    expect(signal.situationCloture).toBe('RETRAIT');
    expect(resultat.primitives.labels?.some((l) => l.texte.includes('Liq\nReint'))).toBe(true);
    expect(resultat.statistiques.totalAchats).toBe(1);
  });

  it('valide un signal d achat en dépassement favorable avec marge élargie (ex: 15% au-dessus d Open 1)', () => {
    // Range1 = 10 (105 - 95), Range2 = 12 (106.5 - 94.5), Hauteur moyenne = 11
    // Open1 = 105, Close2 = 106.5 -> Dépassement de 1.5 -> Ratio = 1.5 / 11 = 13.6% (<= 25% tolérance de dépassement)
    const bougies: Bougie[] = [
      creerBougie(1000, 100, 101, 99, 100),
      creerBougie(2000, 100, 101, 99, 101),
      creerBougie(3000, 100, 101, 99, 100),
      creerBougie(4000, 100, 101, 99, 101),
      creerBougie(5000, 100, 101, 99, 100),
      // Bougie 1 : Vendeuse (105 -> 96), Range = 10
      creerBougie(6000, 105, 105, 95, 96),
      // Bougie 2 : Acheteuse impulsive qui clôture PLUS HAUT qu Open1 (96 -> 106.5)
      creerBougie(7000, 96, 106.8, 95, 106.5),
    ];

    const resultat = calculerLiquidationReintegration(bougies, {
      toleranceDeficit: 0.05,
      toleranceDepassement: 0.25,
      activerFiltreTaille: true,
    });

    expect(resultat.signaux.length).toBe(1);
    const signal = resultat.signaux[0];
    expect(signal.type).toBe('ACHAT');
    expect(signal.situationCloture).toBe('DEPASSEMENT');
    expect(signal.close2).toBeGreaterThan(signal.open1);
  });

  it('rejette un signal d achat si le dépassement haussier excède la tolérance élargie de 25%', () => {
    // Hauteur moyenne = 10. Close2 = 108.5 -> Écart avec Open1(105) = 3.5 -> Ratio = 35% (> 25%)
    const bougies: Bougie[] = [
      creerBougie(1000, 100, 101, 99, 100),
      creerBougie(2000, 100, 101, 99, 101),
      creerBougie(3000, 100, 101, 99, 100),
      creerBougie(4000, 100, 101, 99, 101),
      creerBougie(5000, 100, 101, 99, 100),
      // Bougie 1 : Vendeuse (105 -> 97)
      creerBougie(6000, 105, 105, 95, 97),
      // Bougie 2 : Close trop haut à 108.5
      creerBougie(7000, 97, 109, 96, 108.5),
    ];

    const resultat = calculerLiquidationReintegration(bougies, {
      toleranceDeficit: 0.05,
      toleranceDepassement: 0.25,
    });

    expect(resultat.signaux.length).toBe(0);
  });

  it('rejette un signal d achat si la clôture est en retrait sous Open1 de plus de 5%', () => {
    // Hauteur moyenne = 10. Close2 = 104.0 -> Écart avec Open1(105) = 1.0 -> Ratio = 10% (> 5% tolérance en retrait)
    const bougies: Bougie[] = [
      creerBougie(1000, 100, 101, 99, 100),
      creerBougie(2000, 100, 101, 99, 101),
      creerBougie(3000, 100, 101, 99, 100),
      creerBougie(4000, 100, 101, 99, 101),
      creerBougie(5000, 100, 101, 99, 100),
      // Bougie 1 : Vendeuse (105 -> 97)
      creerBougie(6000, 105, 105, 95, 97),
      // Bougie 2 : Acheteuse (97 -> 104.0), Close reste trop en deçà d'Open1 (105)
      creerBougie(7000, 97, 105, 96, 104.0),
    ];

    const resultat = calculerLiquidationReintegration(bougies, {
      toleranceDeficit: 0.05,
      toleranceDepassement: 0.25,
    });

    expect(resultat.signaux.length).toBe(0);
  });

  it('détecte un signal de vente (Bearish) avec dépassement baissier favorable (Close2 <= Open1)', () => {
    // Bougie 1 acheteuse (95 -> 103), Open1 = 95
    // Bougie 2 vendeuse impulsive qui clôture encore plus bas qu Open1 (103 -> 93.8), Close2 = 93.8
    // Hauteur moyenne = 10. Écart = 1.2 -> Ratio = 12% (<= 25% tolérance de dépassement)
    const bougies: Bougie[] = [
      creerBougie(1000, 100, 101, 99, 100),
      creerBougie(2000, 100, 101, 99, 101),
      creerBougie(3000, 100, 101, 99, 100),
      creerBougie(4000, 100, 101, 99, 101),
      creerBougie(5000, 100, 101, 99, 100),
      creerBougie(6000, 95, 105, 95, 103),
      creerBougie(7000, 103, 104, 93, 93.8),
    ];

    const resultat = calculerLiquidationReintegration(bougies, {
      toleranceDeficit: 0.05,
      toleranceDepassement: 0.25,
      activerFiltreTaille: true,
    });

    expect(resultat.signaux.length).toBe(1);
    const signal = resultat.signaux[0];
    expect(signal.type).toBe('VENTE');
    expect(signal.situationCloture).toBe('DEPASSEMENT');
    expect(signal.close2).toBeLessThan(signal.open1);
  });

  it('rejette le setup si la Bougie 1 entière est trop petite par rapport à la moyenne', () => {
    // Moyenne des ranges = 10 (100 -> 110)
    const bougies: Bougie[] = [
      creerBougie(1000, 100, 110, 100, 105),
      creerBougie(2000, 100, 110, 100, 105),
      creerBougie(3000, 100, 110, 100, 105),
      creerBougie(4000, 100, 110, 100, 105),
      creerBougie(5000, 100, 110, 100, 105),
      // Bougie 1 : Range = 12 (High 112, Low 100). Or 1.75 * 10 = 17.5 requis -> trop petite !
      creerBougie(6000, 110, 112, 100, 101),
      // Bougie 2 : Close proche
      creerBougie(7000, 101, 110.2, 100, 109.8),
    ];

    const resultat = calculerLiquidationReintegration(bougies, {
      activerFiltreTaille: true,
      multiplicateurBougie1: 1.75,
    });
    expect(resultat.signaux.length).toBe(0);
  });

  it('rejette le setup si le corps pur de la Bougie 2 est trop petit par rapport à la moyenne des corps', () => {
    // 5 bougies avec corps = 4, range = 5
    // Seuil requis pour corps 2 = 1.75 * 4 = 7.0
    const bougies: Bougie[] = [
      creerBougie(1000, 100, 105, 100, 104),
      creerBougie(2000, 104, 109, 104, 108),
      creerBougie(3000, 108, 113, 108, 112),
      creerBougie(4000, 112, 117, 112, 116),
      creerBougie(5000, 116, 121, 116, 120),
      // Bougie 1 : Grande bougie entière avec mèche basse, Range = 30 (>= 8.75 requis)
      creerBougie(6000, 125, 125, 95, 120),
      // Bougie 2 : Close(124.8) proche de Open1(125), MAIS corps = 1.8 (< 7.0 requis)
      creerBougie(7000, 123, 125, 119, 124.8),
    ];

    const resultat = calculerLiquidationReintegration(bougies, {
      activerFiltreTaille: true,
      multiplicateurCorps2: 1.75,
    });
    expect(resultat.signaux.length).toBe(0);
  });

  it('respecte la désactivation des signaux d achat ou de vente', () => {
    const bougies: Bougie[] = [
      creerBougie(1000, 100, 101, 99, 100),
      creerBougie(2000, 100, 101, 99, 101),
      creerBougie(3000, 100, 101, 99, 100),
      creerBougie(4000, 100, 101, 99, 101),
      creerBougie(5000, 100, 101, 99, 100),
      creerBougie(6000, 105, 105, 95, 97),
      creerBougie(7000, 97, 105, 96, 104.8),
    ];

    // Désactive les achats
    const resultatSansAchat = calculerLiquidationReintegration(bougies, {
      activerAchat: false,
    });
    expect(resultatSansAchat.signaux.length).toBe(0);
  });

  it('s exécute parfaitement via le moteur dynamique evaluerIndicateurScript avec script-liquidation-reintegration', () => {
    const indicateur = INDICATEURS_PAR_DEFAUT.find(
      (def) => def.id === 'script-liquidation-reintegration'
    );
    expect(indicateur).toBeDefined();

    const bougies: Bougie[] = [
      creerBougie(1000, 100, 101, 99, 100),
      creerBougie(2000, 100, 101, 99, 101),
      creerBougie(3000, 100, 101, 99, 100),
      creerBougie(4000, 100, 101, 99, 101),
      creerBougie(5000, 100, 101, 99, 100),
      creerBougie(6000, 105, 105, 95, 97),
      // Clôture en dépassement favorable à 106.0 (> Open1 105)
      creerBougie(7000, 97, 106.2, 96, 106.0),
    ];

    const resExec = evaluerIndicateurScript(indicateur!.code, {
      bougies,
      parametres: indicateur!.parametres,
    });

    expect(resExec).not.toBeNull();
    expect(resExec?.typeSpecial).toBe('liquidation-reintegration');
    expect(resExec?.primitives?.labels?.length).toBeGreaterThan(0);
    expect(resExec?.donnees?.statistiques?.totalAchats).toBe(1);
    expect(resExec?.donnees?.signaux[0]?.situationCloture).toBe('DEPASSEMENT');
  });

  it('utilise bien les nouvelles valeurs par défaut (1.0x, 1.2x corps, 30% déficit, 200% dépassement, ZigZag 5 barres)', () => {
    // Moyenne range hist = 10, moyenne corps hist = 5
    const bougies: Bougie[] = [
      creerBougie(1000, 100, 105, 95, 100),
      creerBougie(2000, 100, 105, 95, 100),
      creerBougie(3000, 100, 105, 95, 100),
      creerBougie(4000, 100, 105, 95, 100),
      creerBougie(5000, 100, 105, 95, 100),
      // B1 : Range = 11.5 (>= 1.0 * 10 = 10), Vendeuse (105 -> 95), Low = 93.5 (plus bas que 95, donc pic bas)
      creerBougie(6000, 105, 105, 93.5, 95),
      // B2 : Corps = 6 (>= 1.2 * 5 = 6.0), Acheteuse (95 -> 104) avec déficit de 1.0 (1.0 / 11 = 9% <= 30% déficit par défaut)
      creerBougie(7000, 95, 105, 94, 104),
    ];

    // Appel SANS options : prend les valeurs par défaut
    const resDefaut = calculerLiquidationReintegration(bougies);
    expect(resDefaut.signaux.length).toBe(1);
    expect(resDefaut.signaux[0].type).toBe('ACHAT');
  });

  it('valide un Doji acheteur si son creux est le plus bas des 5 bougies (Pic bas ZigZag)', () => {
    const bougies: Bougie[] = [
      creerBougie(1000, 100, 102, 98, 100),
      creerBougie(2000, 100, 102, 98, 100),
      creerBougie(3000, 100, 102, 98, 100),
      creerBougie(4000, 100, 102, 98, 100),
      creerBougie(5000, 100, 102, 98, 100), // Plus bas des 5 barres = 98
      // B1 : Low = 93 (< 98, nouveau plus bas !)
      creerBougie(6000, 105, 105, 93, 95),
      // B2 : Clôture réintégration
      creerBougie(7000, 95, 106, 94, 105),
    ];

    const resultat = calculerLiquidationReintegration(bougies, {
      activerFiltreZigzag: true,
      profondeurZigzag: 5,
    });

    expect(resultat.signaux.length).toBe(1);
    expect(resultat.signaux[0].type).toBe('ACHAT');
  });

  it('rejette un Doji acheteur si une bougie antérieure était plus basse (pas sur un pic bas ZigZag)', () => {
    const bougies: Bougie[] = [
      creerBougie(1000, 100, 102, 98, 100),
      creerBougie(2000, 100, 102, 88, 100), // ⚠️ Cette bougie est descendue à 88 (plus bas que le Doji !)
      creerBougie(3000, 100, 102, 98, 100),
      creerBougie(4000, 100, 102, 98, 100),
      creerBougie(5000, 100, 102, 98, 100),
      // B1 : Low = 93 (93 > 88, donc ce n'est PAS le point le plus bas / pic ZigZag !)
      creerBougie(6000, 105, 105, 93, 95),
      creerBougie(7000, 95, 106, 94, 105),
    ];

    const resultat = calculerLiquidationReintegration(bougies, {
      activerFiltreZigzag: true,
      profondeurZigzag: 5,
    });

    // Doit être rejeté car 93 n'est pas le plus bas parmi les 5 dernières bougies
    expect(resultat.signaux.length).toBe(0);

    // Mais si on désactive le filtre ZigZag, le setup réapparaît
    const sansZigzag = calculerLiquidationReintegration(bougies, {
      activerFiltreZigzag: false,
    });
    expect(sansZigzag.signaux.length).toBe(1);
  });

  it('produit un diagnostic complet et pédagogique expliquant pourquoi une bougie est acceptée ou rejetée', () => {
    // Bougie 1 : Range = 12, Corps = 8 (100 -> 92), Low = 90 (plus bas que 95 -> pic ZigZag valide)
    // Bougie 2 : Range = 10, Corps = 7 (92 -> 99) -> Clôture à 99 vs Open1 100 -> Retrait de 1 / 11 = 9.09%
    const bougies: Bougie[] = [
      creerBougie(1000, 100, 105, 95, 103),
      creerBougie(2000, 100, 105, 95, 103),
      creerBougie(3000, 100, 105, 95, 103),
      creerBougie(4000, 100, 105, 95, 103),
      creerBougie(5000, 100, 105, 95, 103),
      creerBougie(6000, 100, 102, 90, 92), // B1 : Low = 90 (< 95)
      creerBougie(7000, 92, 101, 91, 99),  // B2 : Corps = 7
    ];

    // Test avec tolérance de retrait stricte (5%) : doit être rejeté pour retrait trop grand
    const diagRejete = diagnostiquerBougieDoji(bougies, 6, { toleranceDeficit: 0.05 });
    expect(diagRejete).not.toBeNull();
    expect(diagRejete?.estValide).toBe(false);
    expect(diagRejete?.typeCandidat).toBe('ACHAT');
    expect(diagRejete?.verdict).toContain('REJETÉ');
    expect(diagRejete?.conditions.find((c) => c.titre.includes('Clôture'))?.valide).toBe(false);

    // Test avec tolérance de retrait par défaut (30%) : doit être validé à 100% !
    const diagAccepte = diagnostiquerBougieDoji(bougies, 6, { toleranceDeficit: 0.30 });
    expect(diagAccepte?.estValide).toBe(true);
    expect(diagAccepte?.verdict).toContain('VALIDÉ À 100%');
    expect(diagAccepte?.conditions.every((c) => c.valide)).toBe(true);
    expect(diagAccepte?.conditions.some((c) => c.titre.includes('Pic ZigZag'))).toBe(true);
  });
});
