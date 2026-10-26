import { describe, it, expect } from 'vitest';
import type { Bougie } from '@/lib/chartDataHelper';
import {
  calculerOrchestrateurSMC,
  calculerCarburantLiquidation,
  calculerPorteeDynamiqueUOP,
  trouverBougieContenantPrixTP,
  validerDojiAvecPlageTP,
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

  it('expose le paramètre palierTPVise dans le catalogue officiel', async () => {
    const { INDICATEURS_PAR_DEFAUT } = await import('../indicatorEngine');
    const scriptOrchestre = INDICATEURS_PAR_DEFAUT.find(
      (s) => s.id === 'script-orchestrateur-smc'
    );
    expect(scriptOrchestre).toBeDefined();
    expect(scriptOrchestre?.parametres?.palierTPVise).toBe('AUTO');

    const varPalier = scriptOrchestre?.definitionsVariables?.find(
      (v) => v.cle === 'palierTPVise'
    );
    expect(varPalier).toBeDefined();
    expect(varPalier?.type).toBe('select');
    expect(varPalier?.valeurParDefaut).toBe('AUTO');
    expect(varPalier?.options?.map((o) => o.value)).toEqual(['AUTO', 'TP1', 'TP2', 'TP3']);
  });
});


