import { describe, it, expect } from 'vitest';
import type { Bougie } from '@/lib/chartDataHelper';
import {
  calculerOrchestrateurSMC,
  calculerCarburantLiquidation,
  calculerScoreLiquidationZigZag,
  calculerPorteeDynamiqueUOP,
  analyserRetestsAvecCollines,
  trouverBougieContenantPrixTP,
  validerDojiAvecPlageTP,
  trouverCiblesLiquiditeSRAvecChevauchement,
  recalculerSetupAvecProfondeurZigZag,
  type InfoValidationPlageTP,
} from '../favoris/orchestrateurSMC';

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
      exigerAutorouteUOP: false, // Désactivé sur ces bougies synthétiques pour tester la confirmation
    });

    expect(resultat.setups.length).toBeGreaterThanOrEqual(1);

    const setupAchat = resultat.setups.find((s) => s.type === 'ACHAT');
    expect(setupAchat).toBeDefined();
    expect(setupAchat?.statut).toBe('CONFIRME');
    expect(setupAchat?.prixSL).toBe(85.0);
    expect(setupAchat?.prixEntree).toBe(98.8);
    expect(setupAchat?.prixTP).toBeGreaterThan(98.8);
    expect(setupAchat?.ratioRR).toBeGreaterThan(0);

    // 🎨 Vérification du rendu épuré : point discret sur la mèche basse du Doji
    const pointsDoji = (resultat.primitives.points || []).filter((p) =>
      p.id?.includes('orchestre-pt-')
    );
    expect(pointsDoji.length).toBeGreaterThanOrEqual(1);
    expect(pointsDoji[0].prix).toBe(85.0);
    expect(pointsDoji[0].rayon).toBe(4);

    // Micro-segment SL court avec étiquette 'SL'
    const lignesSL = (resultat.primitives.lignes || []).filter((l) =>
      l.id?.includes('orchestre-sl-')
    );
    expect(lignesSL.length).toBeGreaterThanOrEqual(1);
    expect(lignesSL[0].prix).toBe(85.0);
    expect(lignesSL[0].label).toBe('SL');

    // Micro-segment TP court
    const lignesTP = (resultat.primitives.lignes || []).filter((l) =>
      l.id?.includes('orchestre-tp-')
    );
    expect(lignesTP.length).toBeGreaterThanOrEqual(1);
    expect(lignesTP[0].label).toContain('TP');
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
      exigerAutorouteUOP: false, // Désactivé sur bougies synthétiques
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
      exigerAutorouteUOP: false, // Désactivé sur bougies synthétiques
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

  it('masque automatiquement du graphique un setup passé dont le TP a été touché', () => {
    const bougies: Bougie[] = [];
    for (let k = 0; k < 15; k++) {
      bougies.push(creerBougie(k * 1000, 100, 102, 98, 100));
    }

    // Doji Achat (SL à 85.0, Entrée à 98.8, distance SL ~ 13.8 -> TP vers ~119.5 ou 133.3)
    bougies.push(creerBougie(15000, 99.0, 99.0, 85.0, 86.0));
    bougies.push(creerBougie(16000, 86.0, 99.0, 86.0, 98.8));

    // 3 bougies de confirmation (Low > 85.0)
    bougies.push(creerBougie(17000, 98.8, 102.0, 95.0, 101.0));
    bougies.push(creerBougie(18000, 101.0, 105.0, 97.0, 104.0));
    bougies.push(creerBougie(19000, 104.0, 108.0, 99.0, 107.0));

    // Bougie 20 : Vague haussière puissante qui touche le Take Profit (High 150.0)
    bougies.push(creerBougie(20000, 107.0, 150.0, 105.0, 145.0));

    // 1. Avec masquerSetupsTermines = true (par défaut) : le setup est masqué du graphique !
    const resMasque = calculerOrchestrateurSMC(bougies, {
      activerFiltreTaille: false,
      nbBougiesConfirmation: 3,
      masquerSetupsTermines: true,
      exigerAutorouteUOP: false, // Désactivé sur bougies synthétiques
    });

    const setupAchat = resMasque.setups.find((s) => s.type === 'ACHAT');
    expect(setupAchat).toBeDefined();
    expect(setupAchat?.statut).toBe('CONFIRME');
    expect(setupAchat?.estTermine).toBe(true);
    expect(setupAchat?.resultatTrade).toBe('TP_TOUCHE');
    expect(resMasque.statistiques.totalTPTouches).toBe(1);
    expect(resMasque.statistiques.totalActifs).toBe(0);

    // Le graphique ne doit contenir AUCUN point ni ligne pour ce setup passé
    expect(resMasque.primitives.points?.length).toBe(0);
    expect(resMasque.primitives.lignes?.length).toBe(0);

    // 2. Avec masquerSetupsTermines = false : le setup passé s'affiche pour historique
    const resAffiche = calculerOrchestrateurSMC(bougies, {
      activerFiltreTaille: false,
      nbBougiesConfirmation: 3,
      masquerSetupsTermines: false,
      exigerAutorouteUOP: false, // Désactivé sur bougies synthétiques
    });
    expect(resAffiche.primitives.points?.length).toBeGreaterThan(0);
  });

  it('calcule correctement le carburant initial selon les retests et la pénétration de la mèche', () => {
    // 3 retests (300 pts) et mèche profonde (> 1.2 ATR -> x1.6) -> 480 pts
    const res = calculerCarburantLiquidation({
      nombreRetests: 3,
      profondeurMeche: 15,
      hauteurMoyenne: 10,
    });
    expect(res.pointsRetests).toBe(300);
    expect(res.multiplicateurMeche).toBe(1.6);
    expect(res.carburantTotal).toBe(480);
  });

  it('arrête l\'avancée du TP Optimal devant un palier UOP infranchissable par manque de carburant', () => {
    // Entrée à 100, SL à 90 (distance 10)
    // 2 Paliers : Palier 1 à 120 (+20), Palier 2 à 160 (+60)
    const tpsCandidats: any[] = [
      { id: 'tp1', type: 'achat', prixCible: 120, ordre: 1, amplitudePoints: 20, tauxMoyenChevauchement: 5 },
      { id: 'tp2', type: 'achat', prixCible: 160, ordre: 2, amplitudePoints: 60, tauxMoyenChevauchement: 2 },
    ];

    // Carburant insuffisant pour percer le 2ème palier (ex: 150 pts de carburant)
    const res = calculerPorteeDynamiqueUOP({
      prixEntree: 100,
      prixSL: 90,
      direction: 'ACHAT',
      carburantInitial: 160,
      tpsCandidats,
      hauteurMoyenne: 10,
      peagePalierUOP: 100,
      coutParATR: 50,
    });

    // Le palier 1 (120) est percé, mais pas le palier 2 (160)
    expect(res.paliersTraverses).toBe(1);
    expect(res.estLimiteParPalier).toBe(true);
    expect(res.palierBloquant?.prixCible).toBe(160);
    expect(res.prixTPOptimal).toBeLessThan(160);
    expect(res.prixTPOptimal).toBeGreaterThanOrEqual(120);
  });

  it('permet de traverser tous les paliers si l\'utilisateur réduit le coût du péage externe', () => {
    const tpsCandidats: any[] = [
      { id: 'tp1', type: 'achat', prixCible: 120, ordre: 1, amplitudePoints: 20, tauxMoyenChevauchement: 5 },
      { id: 'tp2', type: 'achat', prixCible: 160, ordre: 2, amplitudePoints: 60, tauxMoyenChevauchement: 2 },
    ];

    // Avec peagePalierUOP réduit à 10 pts au lieu de 100, les 160 pts de carburant suffisent largement !
    const res = calculerPorteeDynamiqueUOP({
      prixEntree: 100,
      prixSL: 90,
      direction: 'ACHAT',
      carburantInitial: 160,
      tpsCandidats,
      hauteurMoyenne: 10,
      peagePalierUOP: 10, // Réduction du péage par l'utilisateur
      coutParATR: 10,     // Réduction de la friction
    });

    // Les 2 paliers sont maintenant tous les deux traversés !
    expect(res.paliersTraverses).toBe(2);
    expect(res.estLimiteParPalier).toBe(false);
    expect(res.prixTPOptimal).toBeGreaterThanOrEqual(160);
  });

  it('génère la liste ordonnée des paliers UOP analysés et affiche les éléments visuels épurés', () => {
    const tpsCandidats: any[] = [
      { id: 'tp1', type: 'achat', prixCible: 120, ordre: 1, amplitudePoints: 20, tauxMoyenChevauchement: 4.5 },
      { id: 'tp2', type: 'achat', prixCible: 160, ordre: 2, amplitudePoints: 60, tauxMoyenChevauchement: 1.8 },
    ];

    // Calcul de la portée : palier 1 percé, palier 2 bloquant
    const res = calculerPorteeDynamiqueUOP({
      prixEntree: 100,
      prixSL: 90,
      direction: 'ACHAT',
      carburantInitial: 160,
      tpsCandidats,
      hauteurMoyenne: 10,
      peagePalierUOP: 100,
      coutParATR: 50,
    });

    expect(res.paliersAnalyses).toHaveLength(2);
    expect(res.paliersAnalyses[0].prix).toBe(120);
    expect(res.paliersAnalyses[0].estPerce).toBe(true);
    expect(res.paliersAnalyses[0].estBloquant).toBe(false);

    expect(res.paliersAnalyses[1].prix).toBe(160);
    expect(res.paliersAnalyses[1].estPerce).toBe(false);
    expect(res.paliersAnalyses[1].estBloquant).toBe(true);

    // Test sur un graphique avec un setup actif (non terminé)
    const bougies: Bougie[] = [];
    for (let k = 0; k < 15; k++) {
      bougies.push(creerBougie(k * 1000, 100, 102, 98, 100));
    }
    // Doji Achat
    bougies.push(creerBougie(15000, 99.0, 99.0, 85.0, 86.0));
    bougies.push(creerBougie(16000, 86.0, 99.0, 86.0, 98.8));
    // 3 bougies de confirmation (sans toucher ni TP ni SL)
    bougies.push(creerBougie(17000, 98.8, 102.0, 95.0, 101.0));
    bougies.push(creerBougie(18000, 101.0, 103.0, 96.0, 102.0));
    bougies.push(creerBougie(19000, 102.0, 104.0, 97.0, 103.0));

    const resOrchestre = calculerOrchestrateurSMC(bougies, {
      activerFiltreTaille: false,
      nbBougiesConfirmation: 3,
      afficherPointsLiquidation: true,
      afficherPaliersUOP: true,
      exigerAutorouteUOP: false, // Désactivé sur bougies synthétiques
    });

    // 1. Badge de liquidité captée présent
    const badgeLiquidation = resOrchestre.primitives.labels?.find((l) => l.texte.includes('⚡'));
    expect(badgeLiquidation).toBeDefined();
    expect(badgeLiquidation?.texte).toContain('pts');

    // 2. Micro-segments de SL et TP présents
    const ligneSL = resOrchestre.primitives.lignes?.find((l) => l.label === 'SL');
    const ligneTP = resOrchestre.primitives.lignes?.find((l) => l.label?.startsWith('TP'));
    expect(ligneSL).toBeDefined();
    expect(ligneTP).toBeDefined();
  });

  it('rejette et n\'affiche absolument rien si aucune autoroute UOP fluide n\'est en face (exigerAutorouteUOP = true)', () => {
    const bougies: Bougie[] = [];
    for (let k = 0; k < 15; k++) {
      bougies.push(creerBougie(k * 1000, 100, 102, 98, 100));
    }
    // Doji Achat qui capte du carburant par liquidation
    bougies.push(creerBougie(15000, 99.0, 99.0, 85.0, 86.0));
    bougies.push(creerBougie(16000, 86.0, 99.0, 86.0, 98.8));
    // 3 bougies de confirmation
    bougies.push(creerBougie(17000, 98.8, 101.0, 95.0, 100.0));
    bougies.push(creerBougie(18000, 100.0, 103.0, 96.0, 102.0));
    bougies.push(creerBougie(19000, 102.0, 105.0, 99.0, 104.0));

    // Avec la condition stricte d'autoroute activée (par défaut) :
    // Même si le carburant a été capté, comme il n'y a pas d'autoroute UOP en face (tpsCandidats vide ou < seuil),
    // le setup NE DOIT PAS être considéré comme un setup et NE DOIT PAS être affiché !
    const resultatRejet = calculerOrchestrateurSMC(bougies, {
      activerFiltreTaille: false,
      nbBougiesConfirmation: 3,
      exigerAutorouteUOP: true, // Condition stricte activée
    });

    expect(resultatRejet.setups.length).toBe(0);
    expect(resultatRejet.statistiques.totalDetectes).toBe(0);
    expect(resultatRejet.statistiques.totalConfirmes).toBe(0);
    expect(resultatRejet.primitives.points?.length || 0).toBe(0);
    expect(resultatRejet.primitives.lignes?.length || 0).toBe(0);
  });

  it('valide ou rejette un setup selon le filtre Plage TP (trouverBougieContenantPrixTP & validerDojiAvecPlageTP)', () => {
    // Construction d'un historique de 20 bougies
    const bougies: Bougie[] = [];
    for (let k = 0; k < 20; k++) {
      if (k === 5) {
        // Bougie 5 : Contient le prix du TP (ex: TP = 115, High = 120, Low = 110)
        bougies.push(creerBougie(5000, 112, 120, 110, 118));
      } else if (k > 5 && k < 15) {
        // Descente progressive vers 95
        const base = 108 - (k - 5) * 1.5;
        bougies.push(creerBougie(k * 1000, base, base + 1, base - 1, base));
      } else if (k === 15) {
        // Bougie 1 du Doji d'achat : liquidation avec Low = 80
        bougies.push(creerBougie(15000, 95, 95, 80, 82));
      } else if (k === 16) {
        // Bougie 2 du Doji d'achat : réintégration (Close = 96)
        bougies.push(creerBougie(16000, 82, 97, 82, 96));
      } else {
        bougies.push(creerBougie(k * 1000, 96, 98, 95, 97));
      }
    }

    // 1️⃣ Trouver la bougie contenant le prix du TP (115)
    const repereTP = trouverBougieContenantPrixTP(bougies, 16, 115, 100);
    expect(repereTP).toBeDefined();
    expect(repereTP?.index).toBe(5);

    // 2️⃣ Validation Achat réussie : le Low du Doji (80) est le plus bas de toute la plage [5 -> 16]
    const verifValide = validerDojiAvecPlageTP(bougies, 16, 'ACHAT', 115, 100);
    expect(verifValide.estValide).toBe(true);
    expect(verifValide.bougieTPIndex).toBe(5);
    expect(verifValide.prixExtremeDoji).toBe(80);
    expect(verifValide.motif).toContain('creux ultime de la plage depuis le TP');

    // 3️⃣ Rejet Achat : Une bougie intermédiaire (index 10) fait un Low encore plus bas que le Doji (75 < 80)
    bougies[10].low = 75;
    const verifRejet = validerDojiAvecPlageTP(bougies, 16, 'ACHAT', 115, 100);
    expect(verifRejet.estValide).toBe(false);
    expect(verifRejet.motif).toContain("n'est pas le plus bas absolu de la plage");
    expect(verifRejet.prixExtremePlage).toBe(75);

    // 4️⃣ Validation Vente (symétrique) : le High du Doji (130) doit être le plus haut absolu jusqu'à la bougie du TP
    const bougiesVente: Bougie[] = [];
    for (let k = 0; k < 20; k++) {
      if (k === 4) {
        // Bougie 4 contenant le prix du TP Vente (TP = 85, Low = 80, High = 90)
        bougiesVente.push(creerBougie(4000, 88, 90, 80, 86));
      } else if (k === 15) {
        // B1 Doji vente : High = 130
        bougiesVente.push(creerBougie(15000, 110, 130, 108, 128));
      } else if (k === 16) {
        // B2 Doji vente : Close = 109 (réintégration)
        bougiesVente.push(creerBougie(16000, 128, 128, 108, 109));
      } else {
        bougiesVente.push(creerBougie(k * 1000, 100, 105, 95, 102));
      }
    }

    const verifVenteValide = validerDojiAvecPlageTP(bougiesVente, 16, 'VENTE', 85, 100);
    expect(verifVenteValide.estValide).toBe(true);
    expect(verifVenteValide.bougieTPIndex).toBe(4);
    expect(verifVenteValide.prixExtremeDoji).toBe(130);
    expect(verifVenteValide.motif).toContain('sommet ultime de la plage depuis le TP');

    // Rejet Vente si bougie intermédiaire a un High plus haut (ex: 135 > 130)
    bougiesVente[8].high = 135;
    const verifVenteRejet = validerDojiAvecPlageTP(bougiesVente, 16, 'VENTE', 85, 100);
    expect(verifVenteRejet.estValide).toBe(false);
    expect(verifVenteRejet.motif).toContain("n'est pas le plus haut absolu de la plage");
  });

  it('expose les variables UI du Filtre Plage TP UOP dans le script orchestrateur officiel', async () => {
    const { INDICATEURS_PAR_DEFAUT } = await import('../indicatorEngine');
    const scriptOrchestre = INDICATEURS_PAR_DEFAUT.find(
      (s) => s.id === 'script-orchestrateur-smc'
    );
    expect(scriptOrchestre).toBeDefined();
    expect(scriptOrchestre?.parametres?.activerFiltrePlageTP).toBe(true);
    expect(scriptOrchestre?.parametres?.maxReculPlageTP).toBe(100);

    // Définitions de variables
    const varActiver = scriptOrchestre?.definitionsVariables?.find(
      (v) => v.cle === 'activerFiltrePlageTP'
    );
    const varRecul = scriptOrchestre?.definitionsVariables?.find(
      (v) => v.cle === 'maxReculPlageTP'
    );

    expect(varActiver).toBeDefined();
    expect(varActiver?.groupe).toBe('Filtre Plage TP UOP');
    expect(varActiver?.valeurParDefaut).toBe(true);

    expect(varRecul).toBeDefined();
    expect(varRecul?.groupe).toBe('Filtre Plage TP UOP');
    expect(varRecul?.valeurParDefaut).toBe(100);
  });

  it('permet à l\'utilisateur de forcer le palier TP visé (TP1, TP2, TP3)', () => {
    const bougies: Bougie[] = [];

    // 15 bougies plates initiales
    for (let k = 0; k < 15; k++) {
      bougies.push(creerBougie(k * 1000, 100, 102, 98, 100));
    }

    // Doji Achat (Spring) aux bougies 15 et 16
    // SL = 85, Entrée = 98.8, Risque = 13.8
    bougies.push(creerBougie(15000, 99.0, 99.0, 85.0, 86.0));
    bougies.push(creerBougie(16000, 86.0, 99.0, 86.0, 98.8));

    // Confirmation 3 bougies
    bougies.push(creerBougie(17000, 98.8, 101.0, 95.0, 100.0));
    bougies.push(creerBougie(18000, 100.0, 103.0, 96.0, 102.0));
    bougies.push(creerBougie(19000, 102.0, 105.0, 99.0, 104.0));

    // 1️⃣ Test avec choix forcé TP1
    const resTP1 = calculerOrchestrateurSMC(bougies, {
      activerFiltreTaille: false,
      exigerAutorouteUOP: false,
      activerFiltrePlageTP: false,
      palierTPVise: 'TP1',
    });

    expect(resTP1.setups.length).toBeGreaterThanOrEqual(1);
    const setupTP1 = resTP1.setups[0];
    expect(setupTP1.palierTPVise).toBe('TP1');
    expect(setupTP1.ordreTP).toBe(1);
    // Prix TP1 secours = 98.8 + 13.8 * 1.5 = 119.5
    expect(setupTP1.prixTP).toBeCloseTo(98.8 + 13.8 * 1.5, 1);

    // 2️⃣ Test avec choix forcé TP2
    const resTP2 = calculerOrchestrateurSMC(bougies, {
      activerFiltreTaille: false,
      exigerAutorouteUOP: false,
      activerFiltrePlageTP: false,
      palierTPVise: 'TP2',
    });

    expect(resTP2.setups.length).toBeGreaterThanOrEqual(1);
    const setupTP2 = resTP2.setups[0];
    expect(setupTP2.palierTPVise).toBe('TP2');
    expect(setupTP2.ordreTP).toBe(2);
    // Prix TP2 secours = 98.8 + 13.8 * 2.5 = 133.3
    expect(setupTP2.prixTP).toBeCloseTo(98.8 + 13.8 * 2.5, 1);
    expect(setupTP2.prixTP).toBeGreaterThan(setupTP1.prixTP ?? 0);

    // 3️⃣ Test avec choix forcé TP3
    const resTP3 = calculerOrchestrateurSMC(bougies, {
      activerFiltreTaille: false,
      exigerAutorouteUOP: false,
      activerFiltrePlageTP: false,
      palierTPVise: 'TP3',
    });

    expect(resTP3.setups.length).toBeGreaterThanOrEqual(1);
    const setupTP3 = resTP3.setups[0];
    expect(setupTP3.palierTPVise).toBe('TP3');
    expect(setupTP3.ordreTP).toBe(3);
    // Prix TP3 secours = 98.8 + 13.8 * 3.5 = 147.1
    expect(setupTP3.prixTP).toBeCloseTo(98.8 + 13.8 * 3.5, 1);
    expect(setupTP3.prixTP).toBeGreaterThan(setupTP2.prixTP ?? 0);
  });

  it('expose le paramètre palierTPVise dans le catalogue officiel (défaut TP1)', async () => {
    const { INDICATEURS_PAR_DEFAUT } = await import('../indicatorEngine');
    const scriptOrchestre = INDICATEURS_PAR_DEFAUT.find(
      (s) => s.id === 'script-orchestrateur-smc'
    );
    expect(scriptOrchestre).toBeDefined();
    expect(scriptOrchestre?.parametres?.palierTPVise).toBe('TP1');

    const varPalier = scriptOrchestre?.definitionsVariables?.find(
      (v) => v.cle === 'palierTPVise'
    );
    expect(varPalier).toBeDefined();
    expect(varPalier?.type).toBe('select');
    expect(varPalier?.valeurParDefaut).toBe('TP1');
    expect(varPalier?.options?.map((o) => o.value)).toContain('TP1');
  });

  it('expose le paramètre typeChevauchementUOP et ses pondérations anatomiques', async () => {
    const { INDICATEURS_PAR_DEFAUT } = await import('../indicatorEngine');
    const scriptOrchestre = INDICATEURS_PAR_DEFAUT.find(
      (s) => s.id === 'script-orchestrateur-smc'
    );
    expect(scriptOrchestre).toBeDefined();
    expect(scriptOrchestre?.parametres?.typeChevauchementUOP).toBe('CORPS_ET_MECHES');
    expect(scriptOrchestre?.parametres?.poidsCorpsUOP).toBe(1.0);
    expect(scriptOrchestre?.parametres?.poidsMecheUOP).toBe(1.0);

    const varType = scriptOrchestre?.definitionsVariables?.find(
      (v) => v.cle === 'typeChevauchementUOP'
    );
    expect(varType).toBeDefined();
    expect(varType?.type).toBe('select');
    expect(varType?.valeurParDefaut).toBe('CORPS_ET_MECHES');
    expect(varType?.options?.map((o) => o.value)).toEqual(['CORPS_ET_MECHES', 'PONDERE', 'CORPS_SEUL']);
  });

  it('ajuste dynamiquement zigzagDepth (de 1 à 8) selon la taille de la liquidation (Doji personnalisé)', () => {
    // 1️⃣ VITESSE 1 — Petit Doji (0.8x ATR) : même avec des retests S/R, seule la taille du Doji compte => zigzagDepth = 1
    const scoreFaible = calculerScoreLiquidationZigZag({
      profondeurMeche: 0.5,
      hauteurMoyenne: 10,        // ATR = 10
      amplitudeBougieSweep: 8,   // 0.8x ATR (<= 1.2x -> zigzagDepth = 1)
      epaisseurZoneSR: 2,
      nombreRetests: 4,          // Ignoré volontairement pour ne pas gonfler zigzagDepth !
    });

    expect(scoreFaible.pointsRetestsSR).toBe(0);
    expect(scoreFaible.pointsProfondeurCassure).toBe(0);
    expect(scoreFaible.scoreTotal).toBe(10);
    expect(scoreFaible.vitesseRetenue).toBe(1);
    expect(scoreFaible.categorieVagues).toBe('PETITES_VAGUES');
    expect(scoreFaible.zigzagDepthRetenu).toBe(1);
    expect(scoreFaible.zigzagBackstepRetenu).toBe(1);
    expect(scoreFaible.nbVaguesSuperposeesRetenu).toBe(10);
    expect(scoreFaible.plafondDerniereVagueActif).toBe(false);

    // 2️⃣ VITESSE 2 — Beau Doji (2.5x ATR) => zigzagDepth = 4 ou 5
    const scoreMoyen = calculerScoreLiquidationZigZag({
      profondeurMeche: 6,
      hauteurMoyenne: 10,        // ATR = 10
      amplitudeBougieSweep: 25,  // 2.5x ATR -> zigzagDepth = 4
      epaisseurZoneSR: 5,
      nombreRetests: 2,
      dureeVieBougiesSR: 25,
    });

    expect(scoreMoyen.vitesseRetenue).toBe(2);
    expect(scoreMoyen.categorieVagues).toBe('VAGUES_MOYENNES');
    expect(scoreMoyen.zigzagDepthRetenu).toBeGreaterThanOrEqual(4);
    expect(scoreMoyen.zigzagDepthRetenu).toBeLessThanOrEqual(5);
    expect(scoreMoyen.zigzagBackstepRetenu).toBe(2);
    expect(scoreMoyen.nbVaguesSuperposeesRetenu).toBe(10);
    expect(scoreMoyen.plafondDerniereVagueActif).toBe(false);

    // 3️⃣ VITESSE 3 — Très grand Doji massif (4.0x ATR) => zigzagDepth = 8
    const scoreMassif = calculerScoreLiquidationZigZag({
      profondeurMeche: 15,
      hauteurMoyenne: 10,        // ATR = 10
      amplitudeBougieSweep: 40,  // 4.0x ATR -> zigzagDepth = 8
      epaisseurZoneSR: 10,
      nombreRetests: 0,
    });

    expect(scoreMassif.scoreTotal).toBe(100);
    expect(scoreMassif.vitesseRetenue).toBe(3);
    expect(scoreMassif.categorieVagues).toBe('GRANDES_VAGUES');
    expect(scoreMassif.zigzagDepthRetenu).toBe(8);
    expect(scoreMassif.zigzagBackstepRetenu).toBe(3);
    expect(scoreMassif.nbVaguesSuperposeesRetenu).toBe(10);
    expect(scoreMassif.resumeExplication).toContain('Taille Doji: 4x ATR');
    expect(scoreMassif.resumeExplication).toContain('ZigZag Depth: 8, 10 vagues');
  });

  it('attache detailsScoreLiquidationZigZag sur chaque setup généré par calculerOrchestrateurSMC', () => {
    const bougies: Bougie[] = [];
    for (let k = 0; k < 20; k++) {
      bougies.push(creerBougie(k * 1000, 100, 102, 98, 100));
    }

    // Doji Achat avec plongeon de liquidation
    bougies.push(creerBougie(20000, 99.0, 99.0, 85.0, 86.0));
    bougies.push(creerBougie(21000, 86.0, 99.0, 86.0, 98.8));
    bougies.push(creerBougie(22000, 98.8, 101.0, 95.0, 100.0));
    bougies.push(creerBougie(23000, 100.0, 103.0, 96.0, 102.0));
    bougies.push(creerBougie(24000, 102.0, 105.0, 99.0, 104.0));

    const res = calculerOrchestrateurSMC(bougies, {
      activerFiltreTaille: false,
      exigerAutorouteUOP: false,
      activerFiltrePlageTP: false,
    });

    expect(res.setups.length).toBeGreaterThanOrEqual(1);
    const setup = res.setups[0];
    expect(setup.detailsScoreLiquidationZigZag).toBeDefined();
    expect(setup.detailsScoreLiquidationZigZag?.scoreTotal).toBeGreaterThan(0);
    expect(setup.detailsScoreLiquidationZigZag?.zigzagDepthRetenu).toBeGreaterThanOrEqual(1);
    expect(setup.detailsScoreLiquidationZigZag?.zigzagDepthRetenu).toBeLessThanOrEqual(8);
    expect(setup.detailsScoreLiquidationZigZag?.resumeExplication).toContain('ZigZag Depth:');
  });

  it('ignore et fusionne les micro-rebonds (< 1.5x ATR ou 1 bougie) et pondère les vrais retests selon la taille de leur colline', () => {
    // Zone de support à 100.0 (99.5 .. 100.5), ATR moyen = 2.0
    const zoneSupport = {
      id: 'sup-test-collines',
      type: 'SUPPORT' as const,
      prixBas: 99.5,
      prixHaut: 100.5,
      prixMedian: 100.0,
      retests: 0,
      force: 'VERIFIED' as const,
      estFaible: false,
      estCassee: false,
      indexOrigine: 0,
      dateDebut: 1000,
      dateFin: 20000,
    };

    const bougies: Bougie[] = [
      // Index 0 : Création du support (touche 100.0)
      creerBougie(1000, 101.0, 101.5, 99.8, 100.5),
      // Index 1 : Simple micro-rebond d'une mèche (High = 101.6 -> +1.6 = 0.8x ATR < 1.5x ATR)
      creerBougie(2000, 100.6, 101.6, 100.6, 101.0),
      // Index 2 : Retouche immédiatement le support -> DOIT ÊTRE IGNORÉ (micro-rebond fusionné) !
      creerBougie(3000, 101.0, 101.2, 100.0, 100.4),

      // Index 3, 4 : Petite colline sur 2 bougies hors zone (High = 103.6 -> +3.6 = 1.8x ATR -> MINEURE +8pts)
      creerBougie(4000, 100.6, 102.5, 100.6, 102.0),
      creerBougie(5000, 102.0, 103.6, 101.5, 101.8),
      // Index 5 : Retest #1 (MINEURE)
      creerBougie(6000, 101.8, 102.0, 100.1, 100.8),

      // Index 6, 7, 8, 9 : Grand sommet / Montagne sur 4 bougies hors zone (High = 109.0 -> +9.0 = 4.5x ATR -> MAJEURE +25pts)
      creerBougie(7000, 100.8, 104.0, 100.8, 103.5),
      creerBougie(8000, 103.5, 107.0, 103.0, 106.5),
      creerBougie(9000, 106.5, 109.0, 106.0, 107.0),
      creerBougie(10000, 107.0, 107.5, 102.0, 102.5),
      // Index 10 : Retest #2 (MAJEURE)
      creerBougie(11000, 102.5, 102.8, 99.9, 101.0),
    ];

    const analyse = analyserRetestsAvecCollines(zoneSupport, bougies, 0, bougies.length - 1, 2.0);

    // 1. Le micro-rebond à l'index 2 a bien été ignoré et fusionné
    expect(analyse.touchesIgnorees.length).toBe(1);
    expect(analyse.touchesIgnorees[0].index).toBe(2);
    expect(analyse.touchesIgnorees[0].ratioCollineATR).toBeLessThan(1.5);

    // 2. Seuls les 2 vrais retests (Index 5 et Index 10) sont validés
    expect(analyse.collinesRetests.length).toBe(2);

    // Retest #1 : Petite colline (1.8x ATR sur 2 bougies) -> MINEURE (+8 pts)
    expect(analyse.collinesRetests[0].indexToucheRetest).toBe(5);
    expect(analyse.collinesRetests[0].qualite).toBe('MINEURE');
    expect(analyse.collinesRetests[0].pointsAttribues).toBe(8);

    // Retest #2 : Grand sommet (4.5x ATR sur 4 bougies) -> MAJEURE (+25 pts)
    expect(analyse.collinesRetests[1].indexToucheRetest).toBe(10);
    expect(analyse.collinesRetests[1].qualite).toBe('MAJEURE');
    expect(analyse.collinesRetests[1].pointsAttribues).toBe(25);
    expect(analyse.collinesRetests[1].pointsAttribues).toBeGreaterThan(
      analyse.collinesRetests[0].pointsAttribues
    );

    // 3. Vérification de la pondération dans calculerCarburantLiquidation :
    // Une seule colline MAJEURE (150 pts) génère plus de carburant qu'une seule colline MINEURE (60 pts)
    const carbuMineur = calculerCarburantLiquidation({
      nombreRetests: 1,
      profondeurMeche: 1.0,
      hauteurMoyenne: 2.0,
      collinesRetests: [analyse.collinesRetests[0]],
    });
    const carbuMajeur = calculerCarburantLiquidation({
      nombreRetests: 1,
      profondeurMeche: 1.0,
      hauteurMoyenne: 2.0,
      collinesRetests: [analyse.collinesRetests[1]],
    });
    expect(carbuMajeur.pointsRetests).toBe(150);
    expect(carbuMineur.pointsRetests).toBe(60);
    expect(carbuMajeur.carburantTotal).toBeGreaterThan(carbuMineur.carburantTotal);
  });

  it('verrouille le TP du setup à celui calculé lors de la 3ème bougie de confirmation', () => {
    // 1️⃣ Création d'un historique avec un setup confirmé à la 3ème bougie (index 19)
    const bougiesBase: Bougie[] = [];

    // 15 bougies plates initiales
    for (let k = 0; k < 15; k++) {
      bougiesBase.push(creerBougie(k * 1000, 100, 102, 98, 100));
    }

    // Doji Achat (Spring) aux bougies 15 et 16
    bougiesBase.push(creerBougie(15000, 99.0, 99.0, 85.0, 86.0));
    bougiesBase.push(creerBougie(16000, 86.0, 99.0, 86.0, 98.8));

    // 3 bougies de confirmation du range (Low > 85.0)
    bougiesBase.push(creerBougie(17000, 98.8, 101.0, 95.0, 100.0));
    bougiesBase.push(creerBougie(18000, 100.0, 103.0, 96.0, 102.0));
    bougiesBase.push(creerBougie(19000, 102.0, 105.0, 99.0, 104.0));

    const resConfirmation = calculerOrchestrateurSMC(bougiesBase, {
      activerFiltreTaille: false,
      exigerAutorouteUOP: false,
      activerFiltrePlageTP: false,
      palierTPVise: 'TP1',
    });

    expect(resConfirmation.setups.length).toBeGreaterThanOrEqual(1);
    const tpAuMomentConfirmation = resConfirmation.setups[0].prixTP;
    expect(tpAuMomentConfirmation).toBeDefined();

    // 2️⃣ Ajout de 10 bougies supplémentaires qui modifient la structure ultérieure
    const bougiesPlusTard: Bougie[] = [
      ...bougiesBase,
      creerBougie(20000, 104.0, 106.0, 102.0, 105.0),
      creerBougie(21000, 105.0, 110.0, 103.0, 108.0),
      creerBougie(22000, 108.0, 112.0, 106.0, 111.0),
      creerBougie(23000, 111.0, 116.0, 109.0, 115.0),
      creerBougie(24000, 115.0, 120.0, 113.0, 118.0),
      creerBougie(25000, 118.0, 122.0, 116.0, 120.0),
    ];

    const resFutur = calculerOrchestrateurSMC(bougiesPlusTard, {
      activerFiltreTaille: false,
      exigerAutorouteUOP: false,
      activerFiltrePlageTP: false,
      palierTPVise: 'TP1',
      masquerSetupsTermines: false,
    });

    const setupFutur = resFutur.setups.find((s) => s.indexDoji === resConfirmation.setups[0].indexDoji);
    expect(setupFutur).toBeDefined();
    // 🔒 Le TP doit être strictement identique et verrouillé à celui calculé lors de la 3ème bougie
    expect(setupFutur?.prixTP).toBe(tpAuMomentConfirmation);
    // 📊 Les données de l'histogramme Volume Profile UOP de la 3ème bougie doivent être attachées au setup
    expect(setupFutur?.indexConfirmation).toBe(19);
    expect(setupFutur?.tempsConfirmation).toBe(19000);
    expect(setupFutur?.stepUOP).toBeGreaterThan(0);
    expect(Array.isArray(setupFutur?.paliersSuperpositionUOP)).toBe(true);
    expect(Array.isArray(setupFutur?.vaguesSuperposeesUOP)).toBe(true);
  });

  it('cible un S/R actif non cassé uniquement si tout le trajet a un bon taux de chevauchement et respecte comportementAbsenceSR', () => {
    const bougies: Bougie[] = [];
    for (let k = 0; k < 20; k++) {
      bougies.push(creerBougie(k * 1000, 100, 102, 98, 100));
    }

    // 1️⃣ Test direct de trouverCiblesLiquiditeSRAvecChevauchement :
    // - Résistance 1 (active, non cassée, née à l'index 6) à 110..112 avec un trajet bien couvert (100 -> 110)
    // - Résistance 2 (née à l'index 1 et déjà cassée à l'index 3 par une clôture à 116) à 113..115 -> doit être ignorée
    // - Résistance 3 (active, née à l'index 6 mais loin à 130..132 avec un trou sans chevauchement entre 115 et 130) -> trajet invalide
    bougies[3] = creerBougie(3000, 112, 116, 110, 116); // Cassure de la Résistance 2 à l'index 3 (avant la naissance des Résistances 1 et 3 à l'index 6)

    const paliersSuperposition = [];
    for (let p = 100; p <= 112; p += 1) {
      paliersSuperposition.push({
        prix: p,
        nbVagues: 2,
        vaguesIndices: [0],
        sommeBougies: 3, // Fort chevauchement (3 bougies) sur tout le trajet [100..110]
        tauxMoyenBougies: 3,
        estBleuFonce: true,
        isMitigated: false,
      });
    }

    const resSR = trouverCiblesLiquiditeSRAvecChevauchement({
      toutesLesZonesShved: [
        {
          id: 'res-active-valide',
          type: 'RESISTANCE',
          prixBas: 110,
          prixHaut: 112,
          prixMedian: 111,
          retests: 2,
          force: 'VERIFIED',
          estFaible: false,
          estCassee: false,
          dateDebut: 6000,
          dateFin: 19000,
          indexOrigine: 6,
        },
        {
          id: 'res-cassee',
          type: 'RESISTANCE',
          prixBas: 113,
          prixHaut: 115,
          prixMedian: 114,
          retests: 1,
          force: 'WEAK',
          estFaible: true,
          estCassee: true,
          dateDebut: 1000,
          dateFin: 19000,
          indexOrigine: 1,
        },
        {
          id: 'res-active-trajet-vide',
          type: 'RESISTANCE',
          prixBas: 130,
          prixHaut: 132,
          prixMedian: 131,
          retests: 3,
          force: 'PROVEN',
          estFaible: false,
          estCassee: false,
          dateDebut: 6000,
          dateFin: 19000,
          indexOrigine: 6,
        },
      ],
      bougies,
      indexHorizon: 19,
      typeSetup: 'ACHAT',
      prixEntree: 100,
      paliersSuperposition,
      stepUOP: 1,
      tauxMinChevauchementTrajet: 1.5,
      couvertureMinPourcent: 70,
    });

    // La résistance cassée est ignorée, les 2 résistances actives sont analysées
    expect(resSR.toutesCiblesAnalysees.length).toBe(2);
    // Seule la résistance active à 110 possède un trajet couvert à 100% avec moyenne 3b
    expect(resSR.ciblesValides.length).toBe(1);
    expect(resSR.ciblesValides[0].zone.id).toBe('res-active-valide');
    expect(resSR.ciblesValides[0].prixCible).toBe(110);
    expect(resSR.ciblesValides[0].pourcentageTrajetCouvert).toBe(100);
    expect(resSR.ciblesValides[0].tauxMoyenChevauchementTrajet).toBe(3);

    // 2️⃣ Test du choix externe comportementAbsenceSR ('REPLI_TP_UOP' vs 'REJETER_SETUP')
    // Sur une série sans résistance active au-dessus :
    const bougiesSetup: Bougie[] = [];
    for (let k = 0; k < 15; k++) {
      bougiesSetup.push(creerBougie(k * 1000, 100, 101, 99, 100));
    }
    bougiesSetup.push(creerBougie(15000, 99.5, 99.5, 88.0, 89.0));
    bougiesSetup.push(creerBougie(16000, 89.0, 99.8, 89.0, 99.6));
    bougiesSetup.push(creerBougie(17000, 99.6, 100.5, 97.0, 100.2));
    bougiesSetup.push(creerBougie(18000, 100.2, 100.8, 98.0, 100.5));
    bougiesSetup.push(creerBougie(19000, 100.5, 101.0, 99.0, 100.8));

    // A. Lorsque le S/R actif à 101 valide le seuil (1.5b), il est retenu comme cibleLiquiditeSR
    const resAvecSR = calculerOrchestrateurSMC(bougiesSetup, {
      activerFiltreTaille: false,
      exigerAutorouteUOP: false,
      activerFiltrePlageTP: false,
      activerZigZagDynamique: false,
      zigzagDepth: 4,
      activerTPCibleLiquiditeSR: true,
      comportementAbsenceSR: 'REJETER_SETUP',
      tauxMinChevauchementTrajetSR: 1.5,
    });
    expect(resAvecSR.setups.length).toBe(1);
    expect(resAvecSR.setups[0].cibleLiquiditeSR).toBeDefined();

    // B. Lorsqu'aucun S/R actif n'atteint un seuil élevé (ex: 8.0b) :
    // - En mode 'REPLI_TP_UOP', le setup est conservé et bascule sur le TP UOP normal
    const resRepli = calculerOrchestrateurSMC(bougiesSetup, {
      activerFiltreTaille: false,
      exigerAutorouteUOP: false,
      activerFiltrePlageTP: false,
      activerTPCibleLiquiditeSR: true,
      comportementAbsenceSR: 'REPLI_TP_UOP',
      tauxMinChevauchementTrajetSR: 8.0,
    });
    expect(resRepli.setups.length).toBe(1);
    expect(resRepli.setups[0].cibleLiquiditeSR).toBeUndefined();

    // - En mode 'REJETER_SETUP', le setup est strictement rejeté
    const resStrict = calculerOrchestrateurSMC(bougiesSetup, {
      activerFiltreTaille: false,
      exigerAutorouteUOP: false,
      activerFiltrePlageTP: false,
      activerTPCibleLiquiditeSR: true,
      comportementAbsenceSR: 'REJETER_SETUP',
      tauxMinChevauchementTrajetSR: 8.0,
    });
    expect(resStrict.setups.length).toBe(0);
  });

  it('affiche la valeur de Profondeur (zigzagDepth) sur chaque setup et permet de la modifier en temps réel via recalculerSetupAvecProfondeurZigZag', () => {
    const bougies: Bougie[] = [];
    for (let k = 0; k < 20; k++) {
      // Oscillation pour créer des vagues ZigZag à différentes échelles
      const delta = k % 4 < 2 ? k * 0.5 : -k * 0.3;
      bougies.push(creerBougie(k * 1000, 100 + delta, 106 + delta, 96 + delta, 101 + delta));
    }

    // Doji Achat aux bougies 20 et 21
    bougies.push(creerBougie(20000, 96.0, 96.5, 84.0, 85.0));
    bougies.push(creerBougie(21000, 85.0, 97.0, 85.0, 96.8));

    // 3 bougies de confirmation (22, 23, 24)
    bougies.push(creerBougie(22000, 96.8, 99.0, 93.0, 98.5));
    bougies.push(creerBougie(23000, 98.5, 101.0, 96.0, 100.2));
    bougies.push(creerBougie(24000, 100.2, 103.0, 99.0, 102.5));

    // Bougies ultérieures qui montent jusqu'à 115
    bougies.push(creerBougie(25000, 102.5, 110.0, 101.0, 109.0));
    bougies.push(creerBougie(26000, 109.0, 115.0, 107.0, 114.0));

    const res = calculerOrchestrateurSMC(bougies, {
      activerFiltreTaille: false,
      exigerAutorouteUOP: false,
      activerFiltrePlageTP: false,
      masquerSetupsTermines: false,
    });

    expect(res.setups.length).toBeGreaterThanOrEqual(1);
    const setupOrigine = res.setups[0];
    expect(setupOrigine.profondeurZigZagOriginale).toBeDefined();
    expect(setupOrigine.detailsScoreLiquidationZigZag?.zigzagDepthRetenu).toBe(
      setupOrigine.profondeurZigZagOriginale
    );

    // Modification en temps réel de la variable « Profondeur » à 1 puis à 7 pour ce setup
    const setupProf1 = recalculerSetupAvecProfondeurZigZag(setupOrigine, bougies, 1);
    const setupProf7 = recalculerSetupAvecProfondeurZigZag(setupOrigine, bougies, 7);

    expect(setupProf1.profondeurZigZagPersonnalisee).toBe(1);
    expect(setupProf1.profondeurZigZagOriginale).toBe(setupOrigine.profondeurZigZagOriginale);
    expect(setupProf1.detailsScoreLiquidationZigZag?.zigzagDepthRetenu).toBe(1);

    expect(setupProf7.profondeurZigZagPersonnalisee).toBe(7);
    expect(setupProf7.profondeurZigZagOriginale).toBe(setupOrigine.profondeurZigZagOriginale);
    expect(setupProf7.detailsScoreLiquidationZigZag?.zigzagDepthRetenu).toBe(7);
    expect(setupProf7.detailsScoreLiquidationZigZag?.resumeExplication).toContain('Profondeur testée : 7');

    // Vérifie qu'en présence d'un historique ancien décalé (comme la fenêtre glissante de 350 bougies dans BacktestChart),
    // recalculerSetupAvecProfondeurZigZag retrouve la bougie exacte par son horodatage et garde les pivots ZigZag et l'histogramme alignés à l'écran !
    const bougiesAnciennesHorsEcran: Bougie[] = [];
    for (let old = 0; old < 100; old++) {
      bougiesAnciennesHorsEcran.push(creerBougie((old - 200) * 1000, 5000, 5010, 4990, 5000));
    }
    const datasetCompletDecale = [...bougiesAnciennesHorsEcran, ...bougies];
    const setupSurDatasetDecale = recalculerSetupAvecProfondeurZigZag(setupOrigine, datasetCompletDecale, 3);
    const pivotsRecalcules = setupSurDatasetDecale.detailsScoreLiquidationZigZag?.pivotsZigZag || [];
    expect(pivotsRecalcules.length).toBeGreaterThanOrEqual(2);
    // Les pivots doivent être dans la plage de prix du setup (~84..115) et non à 5000 !
    expect(pivotsRecalcules[pivotsRecalcules.length - 1].prix).toBeLessThan(200);
    expect((setupSurDatasetDecale.paliersSuperpositionUOP || []).length).toBeGreaterThan(0);
    expect(setupSurDatasetDecale.paliersSuperpositionUOP![0].prix).toBeLessThan(200);
  });

  it('annule le setup si l\'une des 3 bougies de confirmation dépasse Close(B2) + AmplitudeDuDoji (en Achat)', () => {
    const bougies: Bougie[] = [];
    for (let k = 0; k < 15; k++) {
      bougies.push(creerBougie(k * 1000, 100, 102, 98, 100));
    }

    // Doji Achat aux bougies 15 et 16 :
    // B1: High=99, Low=90 (Amplitude B1 = 9)
    // B2: High=99, Low=90, Close=98.5 (Amplitude B2 = 9, Close(B2) = 98.5)
    // => AmplitudeDuDoji = 9.0
    // => Borne Haute autorisée pour les 3 bougies du range = 98.5 + 9.0 = 107.5
    bougies.push(creerBougie(15000, 99.0, 99.0, 90.0, 91.0));
    bougies.push(creerBougie(16000, 91.0, 99.0, 90.0, 98.5));

    // Bougies 17, 18, 19 (Range de 3 bougies) :
    // La 2ème bougie du range (index 18) clôture à 110.0 (> 107.5) -> sortie par le haut du range !
    bougies.push(creerBougie(17000, 98.5, 103.0, 96.0, 102.0));
    bougies.push(creerBougie(18000, 102.0, 111.0, 101.0, 110.0));
    bougies.push(creerBougie(19000, 110.0, 112.0, 105.0, 106.0));

    const resAvecBorne = calculerOrchestrateurSMC(bougies, {
      activerFiltreTaille: false,
      exigerAutorouteUOP: false,
      activerFiltrePlageTP: false,
      bornerRangeConfirmationParAmplitudeDoji: true,
    });

    expect(resAvecBorne.setups.length).toBe(1);
    expect(resAvecBorne.setups[0].borneRangeConfirmation).toBeCloseTo(107.5, 5);
    expect(resAvecBorne.setups[0].statut).toBe('ANNULE');
    expect(resAvecBorne.setups[0].bougieInvalidationIndex).toBe(18);

    // Si on désactive la borne dans les variables externes, le setup est confirmé
    const resSansBorne = calculerOrchestrateurSMC(bougies, {
      activerFiltreTaille: false,
      exigerAutorouteUOP: false,
      activerFiltrePlageTP: false,
      bornerRangeConfirmationParAmplitudeDoji: false,
    });
    expect(resSansBorne.setups[0].statut).toBe('CONFIRME');
  });

  it('projette le Cockpit Fractal HTF (H4) sur un graphique LTF (15m) avec Plage Protégée, Order Blocks LTF et Second Setup LTF lié au Grand TP H4', () => {
    const H4_S = 4 * 3600;
    const M15_S = 15 * 60;
    const t0 = 1700001600; // Multiple exact de 14400 (4h)

    // 1️⃣ Construction d'un historique M1/M15 qui agrégé en H4 forme un Setup Maître Achat H4
    const donneesM1: Bougie[] = [];

    // Helper pour remplir un bloc H4 (16 bougies M15)
    const ajouterBlocH4 = (indexH4: number, open: number, high: number, low: number, close: number) => {
      const debutH4 = t0 + indexH4 * H4_S;
      for (let m = 0; m < 16; m++) {
        const t = debutH4 + m * M15_S;
        let o = open;
        let h = (open + high) / 2;
        let l = (open + low) / 2;
        let c = close;
        if (m === 0) o = open;
        if (m === 5) h = high;
        if (m === 10) l = low;
        if (m === 15) c = close;
        donneesM1.push(creerBougie(t, o, Math.max(o, c, h), Math.min(o, c, l), c));
      }
    };

    // 15 bougies H4 initiales oscillantes autour de 100..125 pour offrir de la hauteur ZigZag
    for (let k = 0; k < 15; k++) {
      const osc = k % 2 === 0 ? 12 : -6;
      ajouterBlocH4(k, 105 + osc, 118 + osc, 96 + osc, 108 + osc);
    }

    // Doji Achat H4 aux blocs H4 #15 (B1) et #16 (B2) :
    // B1 H4 : Open 100, High 101, Low 85, Close 86
    ajouterBlocH4(15, 100.0, 101.0, 85.0, 86.0);
    // B2 H4 : Open 86, High 100, Low 86, Close 99.0 (SL_H4 = 85.0, AmplitudeDoji_H4 = 16.0 => Plage Protégée H4 = [85.0 ➔ 115.0])
    ajouterBlocH4(16, 86.0, 100.0, 86.0, 99.0);

    // 3 bougies H4 de confirmation (#17, #18, #19) restant dans [85.0 ➔ 115.0]
    ajouterBlocH4(17, 99.0, 103.0, 94.0, 101.0);
    ajouterBlocH4(18, 101.0, 104.0, 96.0, 102.0);
    ajouterBlocH4(19, 102.0, 105.0, 97.0, 103.0);

    // 2️⃣ Au bloc H4 #20 (après la confirmation H4), on construit en M15 :
    // - Un Order Block Classique Haussier (bougie baissière suivie d'une impulsion haussière avec FVG) dans [85 ➔ 115]
    // - Un Second Setup Doji M15 + 3 bougies de confirmation M15 avec un petit SL à 91.50
    const debutBloc20 = t0 + 20 * H4_S;
    const bougiesM15Bloc20: Bougie[] = [
      // m=0 : Bougie baissière (Order Block Haussier potentiel : Low=90.0, High=92.0)
      creerBougie(debutBloc20 + 0 * M15_S, 91.8, 92.0, 90.0, 90.2),
      // m=1 : Forte impulsion haussière qui casse 92.0
      creerBougie(debutBloc20 + 1 * M15_S, 90.2, 95.0, 90.1, 94.8),
      // m=2 : Suite de l'impulsion créant un FVG (Low 93.5 > High m=0 92.0)
      creerBougie(debutBloc20 + 2 * M15_S, 94.8, 97.0, 93.5, 96.2),
      // m=3..5 : Retour calme vers 94
      creerBougie(debutBloc20 + 3 * M15_S, 96.2, 96.5, 93.8, 94.0),
      creerBougie(debutBloc20 + 4 * M15_S, 94.0, 94.5, 93.2, 93.5),
      creerBougie(debutBloc20 + 5 * M15_S, 93.5, 94.2, 93.0, 93.8),
      // m=6 & m=7 : Second Setup Doji Achat en M15 (dans la Plage Protégée H4 [85 ➔ 115])
      // B1 M15 : Open 93.8, High 94.0, Low 91.5, Close 91.7
      creerBougie(debutBloc20 + 6 * M15_S, 93.8, 94.0, 91.5, 91.7),
      // B2 M15 : Open 91.7, High 94.0, Low 91.6, Close 93.7 (Petit SL_LTF = 91.5, Entrée = 93.7)
      creerBougie(debutBloc20 + 7 * M15_S, 91.7, 94.0, 91.6, 93.7),
      // m=8, 9, 10 : 3 bougies M15 de confirmation du range LTF
      creerBougie(debutBloc20 + 8 * M15_S, 93.7, 94.5, 92.8, 94.1),
      creerBougie(debutBloc20 + 9 * M15_S, 94.1, 94.8, 93.2, 94.4),
      creerBougie(debutBloc20 + 10 * M15_S, 94.4, 95.2, 93.6, 94.9),
    ];

    const toutesBougiesM15 = [...donneesM1, ...bougiesM15Bloc20];

    // Exécution de l'Orchestrateur SMC sur le graphique M15 avec le Cockpit Fractal HTF activé
    const resLTF = calculerOrchestrateurSMC(toutesBougiesM15, {
      activerFiltreTaille: false,
      exigerAutorouteUOP: false,
      activerFiltrePlageTP: false,
      activerCalqueFractalHTF: true,
      timeframeMaitreFractal: '4h',
      chartTimeframe: '15m',
      donneesM1: toutesBougiesM15,
      afficherOrderBlocksProteges: true,
    });

    // 1. La Grande Plage Protégée H4 doit être projetée sous forme de boîte sur le graphique M15
    const zonesPlageHTF = (resLTF.primitives.boites || []).filter((z) =>
      z.id?.includes('fractal-htf-plage-')
    );
    expect(zonesPlageHTF.length).toBeGreaterThanOrEqual(1);

    // 2. La ligne du GRAND TP 4H et du SL MAÎTRE 4H doivent être projetées
    const lignesGrandTP = (resLTF.primitives.lignes || []).filter((l) =>
      l.id?.includes('fractal-htf-tp-')
    );
    expect(lignesGrandTP.length).toBeGreaterThanOrEqual(1);
    expect(lignesGrandTP[0].label).toContain('GRAND TP 4H');

    // 3. Les rectangles d'Order Blocks Classiques LTF détectés dans la plage H4 doivent être tracés
    const zonesOBLTF = (resLTF.primitives.boites || []).filter((z) =>
      z.id?.includes('fractal-ltf-ob-')
    );
    expect(zonesOBLTF.length).toBeGreaterThanOrEqual(1);

    // 4. Le Second Setup Fractal LTF doit être détecté, connecté au Grand TP H4 correspondant et générer les boîtes Position style TradingView
    const setupsFractalsLTF = resLTF.setups.filter((s) => s.estSecondSetupFractalLTF && s.type === 'ACHAT');
    expect(setupsFractalsLTF.length).toBeGreaterThanOrEqual(1);
    const secondSetup = setupsFractalsLTF[setupsFractalsLTF.length - 1];
    expect(secondSetup.timeframeMaitreHTF).toBe('4H');
    expect(
      lignesGrandTP.some((l) => Math.abs(l.prix - (secondSetup.prixTP ?? 0)) < 0.001)
    ).toBe(true);
    expect(secondSetup.prixSL).toBeGreaterThan(85.0); // Petit SL M15 (91.5) >> SL Maître H4 (85.0)

    // Vérifie la présence des boîtes de Position style TradingView (Zone de Gain TP verte + Zone de Risque SL rouge)
    const boitesPositionTV_TP = (resLTF.primitives.boites || []).filter((b) =>
      b.id?.startsWith('fractal-ltf-tv-tp-')
    );
    const boitesPositionTV_SL = (resLTF.primitives.boites || []).filter((b) =>
      b.id?.startsWith('fractal-ltf-tv-sl-')
    );
    expect(boitesPositionTV_TP.length).toBeGreaterThanOrEqual(1);
    expect(boitesPositionTV_SL.length).toBeGreaterThanOrEqual(1);
  });
});



