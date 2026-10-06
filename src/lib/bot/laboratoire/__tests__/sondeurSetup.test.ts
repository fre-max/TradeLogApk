import { describe, it, expect } from 'vitest';
import type { Bougie } from '@/lib/chartDataHelper';
import { sonderSetupComplet, calculerSyntheseSetups } from '../sondeurSetup';
import { sonderLiquiditeCible } from '../capteurs/capteurLiquidite';
import { sonderMouvementSweep } from '../capteurs/capteurSweep';
import { sonderReintegration } from '../capteurs/capteurReintegration';
import { sonderRangePostSweep } from '../capteurs/capteurRangePostSweep';

describe('🧪 Laboratoire de Rétro-Ingénierie de Setups - Capteurs & Sondeur', () => {
  // Générer une série de 30 bougies simulant un Spring Wyckoff réaliste :
  // 1. Un creux swing formé à la bougie 10 (low: 1.0820)
  // 2. Un rebond jusqu'à la bougie 15 (high: 1.0850)
  // 3. Une descente qui vient balayer le creux à la bougie 20 avec une mèche à 1.0815 (sweep de 5 pips)
  // 4. Une réintégration immédiate à la bougie 20 (close: 1.0825 > 1.0820)
  // 5. Un range de consolidation de 4 bougies entre 1.0822 et 1.0832 sans jamais casser 1.0815
  const bougies: Bougie[] = [];
  for (let i = 0; i < 30; i++) {
    // Par défaut, prix oscillant plus haut autour de 1.0840
    let open = 1.0840;
    let close = 1.0840;
    let high = 1.0845;
    let low = 1.0835;

    if (i === 10) {
      // Creux Swing pivot net à 1.0820
      open = 1.0828;
      close = 1.0822;
      low = 1.0820; // Niveau de liquidité à percuter plus tard
      high = 1.0830;
    } else if (i === 20) {
      // Bougie de Sweep (Spring) percutant 1.0820
      open = 1.0823;
      low = 1.0815; // Sweep de 5 pips sous 1.0820
      high = 1.0828;
      close = 1.0826; // Réintégration immédiate à l'intérieur
    } else if (i >= 21 && i <= 25) {
      // Range post-sweep
      open = 1.0825;
      close = 1.0828;
      low = 1.0823; // Ne casse jamais le prix protégé 1.0815
      high = 1.0832;
    }

    bougies.push({
      time: `2025-01-01T10:${String(i).padStart(2, '0')}:00Z`,
      open,
      high,
      low,
      close,
    });
  }

  it('Capteur 1 : identifie correctement le creux swing percuté', () => {
    const liquidite = sonderLiquiditeCible(bougies, 20, 'ACHAT');
    expect(liquidite).toBeDefined();
    expect(liquidite.prixNiveau).toBe(1.0820);
    expect(liquidite.indexOrigine).toBe(10);
    expect(liquidite.bougiesEcoulees).toBe(10);
    expect(liquidite.description).toContain('Creux Swing Low');
  });

  it('Capteur 2 : mesure précisément la profondeur du sweep et la mèche', () => {
    const sweep = sonderMouvementSweep(bougies, 20, 1.0820, 'ACHAT');
    expect(sweep).toBeDefined();
    expect(sweep.profondeurPips).toBe(5.0); // 1.0820 - 1.0815 = 0.0005 = 5 pips
    expect(sweep.prixProtegeExtreme).toBe(1.0815);
    expect(sweep.ratioMechePourcent).toBeGreaterThanOrEqual(50);
  });

  it('Capteur 3 : détecte la réintégration et l amplitude du rejet', () => {
    const reint = sonderReintegration(bougies, 20, 1.0820, 'ACHAT', 1.0815);
    expect(reint).toBeDefined();
    expect(reint.delaiBougies).toBe(0); // Réintégration sur la bougie de sweep
    expect(reint.amplitudeRejetPips).toBeGreaterThanOrEqual(10); // De 1.0815 à 1.0826 = 11 pips
  });

  it('Capteur 4 : analyse le range post-sweep et confirme la préservation du prix protégé', () => {
    const range = sonderRangePostSweep(bougies, 20, 20, 1.0815, 'ACHAT');
    expect(range).toBeDefined();
    expect(range.dureeBougies).toBeGreaterThanOrEqual(4);
    expect(range.prixProtegePreserve).toBe(true);
    expect(range.amplitudeRangePips).toBeGreaterThan(0);
  });

  it('sondeurSetupComplet : assemble une fiche complète avec les 4 capteurs', () => {
    const fiche = sonderSetupComplet(bougies, 20, {
      paire: 'EURUSD',
      timeframe: 'M15',
      direction: 'ACHAT',
      titre: 'Mon Spring Test',
      noteQualite: 'A+',
    });

    expect(fiche).toBeDefined();
    expect(fiche.direction).toBe('ACHAT');
    expect(fiche.liquidite.prixNiveau).toBe(1.0820);
    expect(fiche.sweep.profondeurPips).toBe(5.0);
    expect(fiche.reintegration.delaiBougies).toBe(0);
    expect(fiche.rangePostSweep.prixProtegePreserve).toBe(true);
  });

  it('calculerSyntheseSetups : extrait les invariants statistiques et recommande des règles', () => {
    const fiche1 = sonderSetupComplet(bougies, 20, { direction: 'ACHAT' });
    const synthese = calculerSyntheseSetups([fiche1]);

    expect(synthese.totalSetups).toBe(1);
    expect(synthese.totalAchats).toBe(1);
    expect(synthese.profondeurSweepMoyennePips).toBe(5.0);
    expect(synthese.pourcentagePrixProtegePreserve).toBe(100);
    expect(synthese.reglesRecommandees.sweepPipsMin).toBeLessThanOrEqual(5);
    expect(synthese.reglesRecommandees.sweepPipsMax).toBeGreaterThanOrEqual(5);
  });
});
