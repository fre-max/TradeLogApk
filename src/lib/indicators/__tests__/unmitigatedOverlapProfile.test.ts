import { describe, it, expect } from 'vitest';
import {
  calculerUnmitigatedOverlapProfile,
  detecterPivotsZigZagAvance,
  calculerTPOptimaux,
} from '@/lib/bot/modules';
import type { Bougie } from '@/lib/chartDataHelper';

describe('Unmitigated Overlap Profile (UOP) - Volume Profile de Chevauchement & TPO', () => {
  // Jeu de 60 bougies oscillantes pour créer une structure en vagues ZigZag régulières
  const bougies: Bougie[] = Array.from({ length: 60 }, (_, i) => {
    const base = 1.0800 + Math.sin(i / 5) * 0.0050;
    return {
      time: 1700000000 + i * 3600,
      open: base,
      high: base + 0.0015,
      low: base - 0.0015,
      close: base + 0.0005,
    };
  });

  it('calcule des paliers de prix basés sur le nombre de bougies de chevauchement', () => {
    const res = calculerUnmitigatedOverlapProfile(bougies, {
      zigzagDepth: 5,
      maxVagues: 3,
      lookbackBars: 60,
    });

    expect(res.vagues.length).toBeGreaterThan(0);
    const premiereVague = res.vagues[0];
    expect(premiereVague.paliers.length).toBeGreaterThan(0);

    // Vérifie que les paliers comptent des bougies et non du volume tick arbitraire
    const palierAvecBougies = premiereVague.paliers.find(p => p.nbBougiesChevauchement > 0);
    expect(palierAvecBougies).toBeDefined();
    expect(palierAvecBougies?.nbBougiesChevauchement).toBeGreaterThan(0);

    // Un palier au niveau des corps doit avoir au moins 1 bougie pleine
    const palierCorps = premiereVague.paliers.find(p => p.nbBougiesChevauchement >= 1);
    expect(palierCorps).toBeDefined();
  });

  it('superpose les vagues précédentes et la vague courante du ZigZag', () => {
    const res = calculerUnmitigatedOverlapProfile(bougies, {
      zigzagDepth: 4,
      nbVaguesSuperposees: 3,
      inclureVagueCourante: true,
      lookbackBars: 60,
    });

    // Vérifie que les vagues superposées sont identifiées
    expect(res.vaguesSuperposees.length).toBeGreaterThan(0);
    expect(res.vaguesSuperposees.length).toBeLessThanOrEqual(3);

    // Vérifie la cartographie de superposition
    expect(res.paliersSuperposition.length).toBeGreaterThan(0);

    // Un palier au cœur des oscillations doit être traversé par plusieurs vagues
    const palierMultiVagues = res.paliersSuperposition.find(p => p.nbVagues >= 2);
    expect(palierMultiVagues).toBeDefined();
    if (palierMultiVagues) {
      expect(palierMultiVagues.sommeBougies).toBeGreaterThan(0);
      expect(palierMultiVagues.vaguesIndices.length).toBe(palierMultiVagues.nbVagues);
    }
  });

  it('calcule correctement le ZigZag avec la vague courante connectée au prix actuel', () => {
    const pivotsAvecCourante = detecterPivotsZigZagAvance(bougies, {
      depth: 4,
      inclureVagueCourante: true,
    });

    const pivotsSansCourante = detecterPivotsZigZagAvance(bougies, {
      depth: 4,
      inclureVagueCourante: false,
    });

    expect(pivotsAvecCourante.length).toBeGreaterThan(0);
    expect(pivotsSansCourante.length).toBeGreaterThan(0);

    // Avec vague courante, le dernier pivot doit correspondre à la dernière bougie
    const dernierPivot = pivotsAvecCourante[pivotsAvecCourante.length - 1];
    expect(dernierPivot.index).toBe(bougies.length - 1);
    expect(dernierPivot.prix).toBe(bougies[bougies.length - 1].close);
  });

  it('prend en compte les filtres de sensibilité, backstep et déviation du ZigZag', () => {
    const pivotsStandard = detecterPivotsZigZagAvance(bougies, { depth: 3, backstep: 1, inclureVagueCourante: false });
    const pivotsFiltres = detecterPivotsZigZagAvance(bougies, { depth: 5, backstep: 5, inclureVagueCourante: false });

    expect(pivotsStandard.length).toBeGreaterThanOrEqual(pivotsFiltres.length);
  });

  it('identifie des plages de prix uniformes où le chevauchement est régulier', () => {
    const res = calculerUnmitigatedOverlapProfile(bougies, {
      zigzagDepth: 5,
      maxVagues: 3,
      minBougiesUniforme: 1,
      toleranceUniformite: 2,
      afficherBoites: true,
      afficherTexte: true,
    });

    expect(res.plagesUniformesGlobales).toBeDefined();
    if (res.plagesUniformesGlobales.length > 0) {
      expect(res.primitives.boites?.length).toBeGreaterThan(0);
      expect(res.primitives.boites?.[0].label).toContain('PLAGE UNIFORME');
    }
  });

  it('gère correctement les niveaux non-mitigués prolongés vers la droite', () => {
    const res = calculerUnmitigatedOverlapProfile(bougies, {
      zigzagDepth: 5,
      maxVagues: 2,
      prolongerNiveaux: true,
    });

    expect(res.niveauxOuverts).toBeDefined();
  });

  it('calcule les TP Optimaux à la sortie des blocs bleu foncé (Sweep) et absorbe les creux <= 5%', () => {
    // Grille de test :
    // Prix actuel = 1.0800, step = 0.0001
    // Paliers au-dessus :
    // 1.0801 -> 1.0820 (20 paliers bleu foncé = 20 pips)
    // 1.0821 (1 palier creux = 1 pip / 21 pips total = 4.7% <= 5% -> absorbé !)
    // 1.0822 -> 1.0830 (9 paliers bleu foncé ajoutés !)
    // 1.0831 -> 1.0835 (5 paliers vides > 5% -> fin de la zone, TP1 placé à 1.0831)
    const mapTest = new Map<number, number>();
    const step = 0.0001;

    // Premier bloc bleu foncé (20 paliers)
    for (let p = 1.0801; p <= 1.08205; p += step) {
      mapTest.set(Number(p.toFixed(5)), 4); // 4 bougies = bleu foncé (>= 3)
    }
    // Petit creux de 1 palier (4.7% de la zone)
    mapTest.set(Number((1.0821).toFixed(5)), 0);

    // Deuxième bloc bleu foncé consécutif
    for (let p = 1.0822; p <= 1.08305; p += step) {
      mapTest.set(Number(p.toFixed(5)), 5); // 5 bougies = bleu foncé
    }

    const { tpOptimauxAchat } = calculerTPOptimaux(1.0800, step, mapTest, {
      seuilBougiesBleuFonce: 3,
      seuilMargeTrouPourcent: 5,
    });

    expect(tpOptimauxAchat.length).toBeGreaterThan(0);
    const tp1 = tpOptimauxAchat[0];

    // Vérifie que le petit creux a bien été absorbé et que la 2ème zone a été ajoutée :
    // Le TP doit se trouver à la sortie du second bloc bleu foncé (~1.0831)
    expect(tp1.prixCible).toBeCloseTo(1.0831, 4);
    expect(tp1.prixCible).toBeGreaterThan(1.0821);
  });

  it('génère les données visuelles de diagnostic profond du TP (tronçons A, B, creux <= 5% absorbé et rupture > 5%)', () => {
    const mapTest = new Map<number, number>();
    const step = 0.0001;

    // Bloc A : 20 paliers (1.0801 -> 1.0820)
    for (let p = 1.0801; p <= 1.08205; p += step) {
      mapTest.set(Number(p.toFixed(5)), 4);
    }
    // Creux absorbé : 1 palier vide (1.0821) -> ratio ~ 4.7% <= 5%
    mapTest.set(Number((1.0821).toFixed(5)), 0);

    // Bloc B : 9 paliers (1.0822 -> 1.0830)
    for (let p = 1.0822; p <= 1.08305; p += step) {
      mapTest.set(Number(p.toFixed(5)), 5);
    }

    // Grand creux bloquant : 5 paliers vides (1.0831 -> 1.0835) -> ratio > 5%
    for (let p = 1.0831; p <= 1.08355; p += step) {
      mapTest.set(Number(p.toFixed(5)), 0);
    }

    // Bloc C (séparé) : 10 paliers
    for (let p = 1.0836; p <= 1.08455; p += step) {
      mapTest.set(Number(p.toFixed(5)), 4);
    }

    const { tpOptimauxAchat } = calculerTPOptimaux(1.0800, step, mapTest, {
      seuilBougiesBleuFonce: 3,
      seuilMargeTrouPourcent: 5,
      afficherDebugTP: true,
    });

    expect(tpOptimauxAchat.length).toBeGreaterThanOrEqual(1);
    const tp1 = tpOptimauxAchat[0];

    // Vérification des données visuelles complètes
    expect(tp1.debug).toBeDefined();
    const debug = tp1.debug!;

    // 1. Les tronçons goudronnés A et B ont été cumulés
    expect(debug.troncons.length).toBe(2);
    expect(debug.troncons[0].lettre).toBe('A');
    expect(debug.troncons[1].lettre).toBe('B');

    // 2. Le creux absorbé (<= 5%) est présent avec la mention de tolérance
    const trouAbsorbe = debug.trous.find((t) => t.estAbsorbe);
    expect(trouAbsorbe).toBeDefined();
    expect(trouAbsorbe?.ratioPourcent).toBeLessThanOrEqual(5);
    expect(trouAbsorbe?.motif).toContain('Absorbé');

    // 3. Le trou bloquant (> 5%) a été capturé et a provoqué l'arrêt
    expect(debug.trouBloquant).toBeDefined();
    expect(debug.trouBloquant?.estAbsorbe).toBe(false);
    expect(debug.trouBloquant?.ratioPourcent).toBeGreaterThan(5);
    expect(debug.trouBloquant?.motif).toContain('Rupture');

    // 4. Synthèse explicative lisible en français
    expect(debug.syntheseExplication).toContain('Route coupée');
    expect(debug.motifArret).toContain('Rupture');
  });

  it('calcule simultanément les TP Optimaux Achat et Vente basés sur la superposition des vagues', () => {
    const res = calculerUnmitigatedOverlapProfile(bougies, {
      zigzagDepth: 4,
      nbVaguesSuperposees: 4,
      minVaguesSuperposition: 1,
      lookbackBars: 60,
      seuilBougiesBleuFonce: 2,
      afficherTPOptimaux: true,
      seuilMargeTrouPourcent: 5,
      maxTPAffiches: 3,
    });

    expect(res.prixActuel).toBeGreaterThan(0);
    expect(res.tpOptimauxAchat).toBeDefined();
    expect(res.tpOptimauxVente).toBeDefined();

    const totalTP = res.tpOptimauxAchat.length + res.tpOptimauxVente.length;
    expect(totalTP).toBeGreaterThan(0);

    for (const tp of res.tpOptimauxAchat) {
      expect(tp.prixCible).toBeGreaterThan(res.prixActuel);
      expect(tp.amplitudePoints).toBeGreaterThan(0);
    }

    for (const tp of res.tpOptimauxVente) {
      expect(tp.prixCible).toBeLessThan(res.prixActuel);
      expect(tp.amplitudePoints).toBeGreaterThan(0);
    }

    expect(res.primitives.lignes?.length).toBe(totalTP);
  });

  it('différencie le corps des mèches selon typeChevauchementUOP (PONDERE vs CORPS_SEUL)', () => {
    // Bougies de test : bougies avec un corps compact et de longues mèches
    // Open = 1.0800, Close = 1.0802 (corps de 2 pips entre 1.0800 et 1.0802)
    // High = 1.0820, Low = 1.0780 (mèches longues de part et d'autre)
    const bougiesMeches: Bougie[] = Array.from({ length: 40 }, (_, i) => ({
      time: 1700000000 + i * 3600,
      open: 1.0800,
      high: 1.0820,
      low: 1.0780,
      close: 1.0802,
    }));

    // 1️⃣ En mode PONDERE : le corps pèse 1.0 et les mèches pèsent 0.25
    const resPondere = calculerUnmitigatedOverlapProfile(bougiesMeches, {
      zigzagDepth: 4,
      typeChevauchementUOP: 'PONDERE',
      poidsCorps: 1.0,
      poidsMeche: 0.25,
      lookbackBars: 40,
    });

    if (resPondere.vagues.length > 0) {
      const vague = resPondere.vagues[0];
      // Palier dans la mèche haute (ex: 1.0815)
      const palierMeche = vague.paliers.find(p => p.price >= 1.0810);
      // Palier dans le corps (ex: 1.0801)
      const palierCorps = vague.paliers.find(p => p.price >= 1.0800 && p.price <= 1.0802);

      if (palierMeche && palierCorps) {
        // Le palier du corps doit avoir un score de chevauchement strictement supérieur à la mèche
        expect(palierCorps.nbBougiesChevauchement).toBeGreaterThan(palierMeche.nbBougiesChevauchement);
      }
    }

    // 2️⃣ En mode CORPS_SEUL : les paliers dans les mèches ne doivent avoir aucun chevauchement
    const resCorpsSeul = calculerUnmitigatedOverlapProfile(bougiesMeches, {
      zigzagDepth: 4,
      typeChevauchementUOP: 'CORPS_SEUL',
      lookbackBars: 40,
    });

    if (resCorpsSeul.vagues.length > 0) {
      const vague = resCorpsSeul.vagues[0];
      const palierMeche = vague.paliers.find(p => p.price >= 1.0815);
      // Le palier dans la mèche ne doit pas exister ou avoir 0 bougies
      expect(palierMeche === undefined || palierMeche.nbBougiesChevauchement === 0).toBe(true);
    }
  });
});
