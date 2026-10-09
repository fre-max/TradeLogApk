import { describe, it, expect } from 'vitest';
import type { Bougie } from '@/lib/chartDataHelper';
import { calculerCandlestickPatterns } from '../candlestickPatterns';
import { evaluerIndicateurScript, INDICATEURS_PAR_DEFAUT } from '../indicatorEngine';

describe('Candlesticks Patterns Identified (repo32)', () => {
  // Bougie utilitaire pour créer rapidement un historique de test
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

  it('détecte correctement un Doji lorsque le corps est inférieur au seuil de dojiSize', () => {
    // Bougie avec amplitude 10 (100 -> 110) et corps minuscule 0.2 (105.0 -> 105.2 <= 10 * 0.05 = 0.5)
    const bougies: Bougie[] = [
      creerBougie(1000, 100, 105, 95, 102),
      creerBougie(2000, 105.0, 110.0, 100.0, 105.2),
    ];

    const resultat = calculerCandlestickPatterns(bougies, { dojiSize: 0.05 });
    const doji = resultat.motifs.find((m) => m.nom === 'Doji');

    expect(doji).toBeDefined();
    expect(doji?.type).toBe('NEUTRAL');
    expect(resultat.primitives.labels?.some((l) => l.texte === 'Doji')).toBe(true);
  });

  it('détecte un Bullish Engulfing lorsque la bougie verte englobe la bougie rouge précédente', () => {
    const bougies: Bougie[] = [
      // Bougie 1 : Rouge de 105 à 100
      creerBougie(1000, 105, 106, 99, 100),
      // Bougie 2 : Verte de 98 à 108 (englobe complètement la précédente)
      creerBougie(2000, 98, 109, 97, 108),
    ];

    const resultat = calculerCandlestickPatterns(bougies);
    const engulfing = resultat.motifs.find((m) => m.nom === 'Bullish Engulfing');

    expect(engulfing).toBeDefined();
    expect(engulfing?.type).toBe('BULLISH');
    expect(resultat.primitives.labels?.some((l) => l.texte.includes('Bullish\nEngulfing'))).toBe(true);
  });

  it('détecte un Bearish Engulfing lorsque la bougie rouge englobe la bougie verte précédente', () => {
    const bougies: Bougie[] = [
      // Bougie 1 : Verte de 100 à 105
      creerBougie(1000, 100, 106, 99, 105),
      // Bougie 2 : Rouge de 108 à 97 (englobe complètement la précédente)
      creerBougie(2000, 108, 109, 96, 97),
    ];

    const resultat = calculerCandlestickPatterns(bougies);
    const engulfing = resultat.motifs.find((m) => m.nom === 'Bearish Engulfing');

    expect(engulfing).toBeDefined();
    expect(engulfing?.type).toBe('BEARISH');
    expect(resultat.primitives.labels?.some((l) => l.texte.includes('Bearish\nEngulfing'))).toBe(true);
  });

  it('détecte un Hammer (Marteau "H") avec une longue mèche inférieure', () => {
    // Amplitude totale 20 (80 -> 100), corps de 2 (97 -> 99). Mèche basse de 17.
    // Corps dans les 40% supérieurs
    const bougies: Bougie[] = [
      creerBougie(1000, 100, 102, 95, 96),
      creerBougie(2000, 97, 100, 80, 99),
    ];

    const resultat = calculerCandlestickPatterns(bougies);
    const hammer = resultat.motifs.find((m) => m.nom === 'Hammer');

    expect(hammer).toBeDefined();
    expect(hammer?.texteCourt).toBe('H');
    expect(resultat.primitives.labels?.some((l) => l.texte === 'H')).toBe(true);
  });

  it('détecte un Inverted Hammer (Marteau Inversé "IH") avec une longue mèche supérieure', () => {
    // Amplitude totale 20 (80 -> 100), corps de 2 (81 -> 83). Mèche haute de 17.
    const bougies: Bougie[] = [
      creerBougie(1000, 100, 102, 95, 96),
      creerBougie(2000, 81, 100, 80, 83),
    ];

    const resultat = calculerCandlestickPatterns(bougies);
    const invHammer = resultat.motifs.find((m) => m.nom === 'Inverted Hammer');

    expect(invHammer).toBeDefined();
    expect(invHammer?.texteCourt).toBe('IH');
    expect(resultat.primitives.labels?.some((l) => l.texte === 'IH')).toBe(true);
  });

  it('détecte une Morning Star sur une séquence de 3 bougies', () => {
    const bougies: Bougie[] = [
      // Bougie 1 : Forte baisse (120 -> 100)
      creerBougie(1000, 120, 122, 98, 100),
      // Bougie 2 : Petite bougie en gap baissier (95 -> 96)
      creerBougie(2000, 95, 97, 93, 96),
      // Bougie 3 : Forte hausse au-dessus de la bougie intermédiaire (98 -> 115)
      creerBougie(3000, 98, 116, 97, 115),
    ];

    const resultat = calculerCandlestickPatterns(bougies);
    const morningStar = resultat.motifs.find((m) => m.nom === 'Morning Star');

    expect(morningStar).toBeDefined();
    expect(morningStar?.type).toBe('BULLISH');
  });

  it('respecte la désactivation individuelle d un motif via les options', () => {
    const bougies: Bougie[] = [
      creerBougie(1000, 105, 106, 99, 100),
      creerBougie(2000, 98, 109, 97, 108),
    ];

    // On désactive Bullish Engulfing
    const resultat = calculerCandlestickPatterns(bougies, { activerBullishEngulfing: false });
    const engulfing = resultat.motifs.find((m) => m.nom === 'Bullish Engulfing');

    expect(engulfing).toBeUndefined();
  });

  it('s exécute avec succès via le moteur dynamique evaluerIndicateurScript', () => {
    const indicateur = INDICATEURS_PAR_DEFAUT.find(
      (def) => def.id === 'script-candlestick-patterns-repo32'
    );
    expect(indicateur).toBeDefined();

    const bougies: Bougie[] = [
      creerBougie(1000, 100, 105, 95, 102),
      creerBougie(2000, 105.0, 110.0, 100.0, 105.1),
    ];

    const resExec = evaluerIndicateurScript(indicateur!.code, {
      bougies,
      parametres: indicateur!.parametres,
    });

    expect(resExec).not.toBeNull();
    expect(resExec?.typeSpecial).toBe('candlestick-patterns');
    expect(resExec?.primitives?.labels?.length).toBeGreaterThan(0);
  });

  it('détecte un Bullish Liquidation & Réintégration (Liq\\nReint) avec sweep bas et Close(2) ≈ Open(1)', () => {
    const bougies: Bougie[] = [
      // Bougie 1 : Rouge de 100 à 85, Low extrême à 80 (hauteur = 21)
      creerBougie(1000, 100, 101, 80, 85),
      // Bougie 2 : Verte de 85 à 100.5, Low à 84 (> 80), Close très proche de Open1 (100.5 vs 100 -> écart 0.5 <= 21 * 0.05 = 1.05)
      creerBougie(2000, 85, 101, 84, 100.5),
    ];

    const resultat = calculerCandlestickPatterns(bougies, { toleranceLiqReint: 0.05 });
    const liqReint = resultat.motifs.find((m) => m.nom === 'Bullish Liquidation Reintegration');

    expect(liqReint).toBeDefined();
    expect(liqReint?.type).toBe('BULLISH');
    expect(liqReint?.position).toBe('below');
    expect(resultat.primitives.labels?.some((l) => l.texte === 'Liq\nReint')).toBe(true);
  });

  it('détecte un Bearish Liquidation & Réintégration (Liq\\nReint) avec sweep haut et Close(2) ≈ Open(1)', () => {
    const bougies: Bougie[] = [
      // Bougie 1 : Verte de 100 à 115, High extrême à 121 (hauteur = 22)
      creerBougie(1000, 100, 121, 99, 115),
      // Bougie 2 : Rouge de 115 à 99.5, High à 116 (< 121), Close très proche de Open1 (99.5 vs 100 -> écart 0.5 <= 22 * 0.05 = 1.10)
      creerBougie(2000, 115, 116, 99, 99.5),
    ];

    const resultat = calculerCandlestickPatterns(bougies, { toleranceLiqReint: 0.05 });
    const liqReint = resultat.motifs.find((m) => m.nom === 'Bearish Liquidation Reintegration');

    expect(liqReint).toBeDefined();
    expect(liqReint?.type).toBe('BEARISH');
    expect(liqReint?.position).toBe('above');
    expect(resultat.primitives.labels?.some((l) => l.texte === 'Liq\nReint')).toBe(true);
  });

  it('rejette le pattern Liq\\nReint si l écart dépasse la tolérance relative de 5%', () => {
    // Bougie 1 : Range = 21 (101 - 80)
    // Bougie 2 : Range = 17 (101 - 84)
    // Hauteur moyenne = (21 + 17) / 2 = 19. 5% = 0.95
    const bougies: Bougie[] = [
      creerBougie(1000, 100, 101, 80, 85),
      creerBougie(2000, 85, 101, 84, 96),  // Close = 96 -> Écart avec Open1(100) = 4.0 (> 0.95)
    ];

    const resultat = calculerCandlestickPatterns(bougies, { toleranceLiqReint: 0.05 });
    const liqReint = resultat.motifs.find((m) => m.nom.includes('Liquidation Reintegration'));

    expect(liqReint).toBeUndefined();
  });

  it('valide le pattern Liq\\nReint même si la bougie 2 a fait le point bas (aucune obligation de sweep sur bougie 1)', () => {
    // Bougie 1 : Rouge de 100 à 85, Low1 = 88 (Range = 13)
    // Bougie 2 : Verte de 85 à 100.2, Low2 = 80 (< 88, Range = 21)
    // Hauteur moyenne = (13 + 21) / 2 = 17. 5% = 0.85. Écart = 0.2 (<= 0.85)
    const bougies: Bougie[] = [
      creerBougie(1000, 100, 101, 88, 85),
      creerBougie(2000, 85, 101, 80, 100.2),
    ];

    const resultat = calculerCandlestickPatterns(bougies, { toleranceLiqReint: 0.05 });
    const liqReint = resultat.motifs.find((m) => m.nom.includes('Liquidation Reintegration'));

    expect(liqReint).toBeDefined();
    expect(liqReint?.type).toBe('BULLISH');
  });
});

