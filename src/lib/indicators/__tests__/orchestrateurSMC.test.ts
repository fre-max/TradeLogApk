import { describe, it, expect } from 'vitest';
import type { Bougie } from '@/lib/chartDataHelper';
import { calculerOrchestrateurSMC } from '../favoris/orchestrateurSMC';

function creerBougie(
  time: number,
  open: number,
  high: number,
  low: number,
  close: number
): Bougie {
  return { time, open, high, low, close, volume: 100 };
}

describe('🎼 Chef d\'Orchestre SMC (Doji + Shved + UOP + Range Confirmation)', () => {
  it('confirme un setup Achat lorsque les 3 bougies suivantes respectent le Stop Loss', () => {
    const bougies: Bougie[] = [];

    // 15 bougies plates initiales
    for (let k = 0; k < 15; k++) {
      bougies.push(creerBougie(k * 1000, 100, 102, 98, 100));
    }

    // Doji Achat (Spring) aux bougies 15 et 16
    // B1: Liquidation baissière (High 99, Low 85, Open 99, Close 86)
    bougies.push(creerBougie(15000, 99.0, 99.0, 85.0, 86.0));
    // B2: Réintégration haussière (Open 86, High 99, Low 86, Close 98.8) -> SL à 85.0
    bougies.push(creerBougie(16000, 86.0, 99.0, 86.0, 98.8));

    // 3 bougies de confirmation du range restant STRICTEMENT au-dessus de 85.0 (SL)
    bougies.push(creerBougie(17000, 98.8, 101.0, 95.0, 100.0)); // Low 95 > 85
    bougies.push(creerBougie(18000, 100.0, 103.0, 96.0, 102.0)); // Low 96 > 85
    bougies.push(creerBougie(19000, 102.0, 105.0, 99.0, 104.0)); // Low 99 > 85

    const resultat = calculerOrchestrateurSMC(bougies, {
      activerFiltreTaille: false,
      nbBougiesConfirmation: 3,
    });

    expect(resultat.setups.length).toBeGreaterThanOrEqual(1);

    const setupAchat = resultat.setups.find((s) => s.type === 'ACHAT');
    expect(setupAchat).toBeDefined();
    expect(setupAchat?.statut).toBe('CONFIRME');
    expect(setupAchat?.prixSL).toBe(85.0);
    expect(setupAchat?.prixEntree).toBe(98.8);
    expect(setupAchat?.prixTP).toBeGreaterThan(98.8);
    expect(setupAchat?.ratioRR).toBeGreaterThan(0);

    // Vérification des primitives visuelles
    const labelsConfirmes = (resultat.primitives.labels || []).filter((l) =>
      l.texte.includes('SMC ACHAT')
    );
    expect(labelsConfirmes.length).toBeGreaterThanOrEqual(1);

    const lignesSL = (resultat.primitives.lignes || []).filter((l) =>
      l.id?.includes('orchestre-sl-')
    );
    expect(lignesSL.length).toBeGreaterThanOrEqual(1);
    expect(lignesSL[0].prix).toBe(85.0);
  });

  it('annule un setup Achat si l\'une des 3 bougies casse le Stop Loss', () => {
    const bougies: Bougie[] = [];

    for (let k = 0; k < 15; k++) {
      bougies.push(creerBougie(k * 1000, 100, 102, 98, 100));
    }

    // Doji Achat (SL à 85.0)
    bougies.push(creerBougie(15000, 99.0, 99.0, 85.0, 86.0));
    bougies.push(creerBougie(16000, 86.0, 99.0, 86.0, 98.8));

    // Bougie 17 : OK (Low 92 > 85)
    bougies.push(creerBougie(17000, 98.8, 100.0, 92.0, 94.0));
    // Bougie 18 : CASSE LE SL (Low 83 < 85) -> INVALIDATION !
    bougies.push(creerBougie(18000, 94.0, 95.0, 83.0, 84.0));
    // Bougie 19 : quelconque
    bougies.push(creerBougie(19000, 84.0, 88.0, 82.0, 86.0));

    const resultat = calculerOrchestrateurSMC(bougies, {
      activerFiltreTaille: false,
      nbBougiesConfirmation: 3,
      afficherSetupsAnnules: true,
    });

    const setupAchat = resultat.setups.find((s) => s.type === 'ACHAT');
    expect(setupAchat).toBeDefined();
    expect(setupAchat?.statut).toBe('ANNULE');
    expect(setupAchat?.bougieInvalidationIndex).toBe(18);

    // Les lignes de setup ne doivent pas être tracées pour un setup annulé
    const lignesSL = (resultat.primitives.lignes || []).filter((l) =>
      l.id?.includes(`orchestre-sl-${setupAchat?.indexDoji}`)
    );
    expect(lignesSL.length).toBe(0);
  });

  it('marque le setup EN_COURS si moins de 3 bougies sont disponibles après le Doji', () => {
    const bougies: Bougie[] = [];

    for (let k = 0; k < 15; k++) {
      bougies.push(creerBougie(k * 1000, 100, 102, 98, 100));
    }

    // Doji Achat en position 15-16
    bougies.push(creerBougie(15000, 99.0, 99.0, 85.0, 86.0));
    bougies.push(creerBougie(16000, 86.0, 99.0, 86.0, 98.8));

    // Une seule bougie suivante (17) -> encore 2 bougies d'attente
    bougies.push(creerBougie(17000, 98.8, 101.0, 96.0, 100.0));

    const resultat = calculerOrchestrateurSMC(bougies, {
      activerFiltreTaille: false,
      nbBougiesConfirmation: 3,
    });

    const setupAchat = resultat.setups.find((s) => s.type === 'ACHAT');
    expect(setupAchat).toBeDefined();
    expect(setupAchat?.statut).toBe('EN_COURS');
    expect(setupAchat?.bougiesObservees).toBe(1);
    expect(resultat.statistiques.totalEnCours).toBe(1);
  });

  it('est accessible et exporté directement depuis le dossier favoris', async () => {
    const favoris = await import('../favoris');
    expect(favoris.calculerOrchestrateurSMC).toBeDefined();
  });

  it('s\'exécute avec succès via evaluerIndicateurScript depuis INDICATEURS_PAR_DEFAUT', async () => {
    const { INDICATEURS_PAR_DEFAUT, evaluerIndicateurScript } = await import('../indicatorEngine');
    const scriptOrchestre = INDICATEURS_PAR_DEFAUT.find((s) => s.id === 'script-orchestrateur-smc');
    expect(scriptOrchestre).toBeDefined();

    const bougies: Bougie[] = [];
    for (let k = 0; k < 20; k++) {
      bougies.push(creerBougie(k * 1000, 100, 102, 98, 100));
    }
    bougies.push(creerBougie(20000, 99.0, 99.0, 85.0, 86.0));
    bougies.push(creerBougie(21000, 86.0, 99.0, 86.0, 98.8));
    bougies.push(creerBougie(22000, 98.8, 101.0, 95.0, 100.0));
    bougies.push(creerBougie(23000, 100.0, 103.0, 96.0, 102.0));
    bougies.push(creerBougie(24000, 102.0, 105.0, 99.0, 104.0));

    const res = evaluerIndicateurScript(scriptOrchestre!.code, {
      bougies,
      parametres: { ...scriptOrchestre!.parametres, activerFiltreTaille: false },
      timeframe: 'M15',
    });

    expect(res).not.toBeNull();
    expect(res?.donnees).toBeDefined();
    expect(res?.primitives).toBeDefined();
  });
});
