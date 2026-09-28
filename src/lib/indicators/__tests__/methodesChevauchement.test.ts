import { describe, it, expect } from 'vitest';
import { calculerMethodeACompression } from '../methodeACompressionRatio';
import { calculerMethodeBOverlap } from '../methodeBOverlapSurface';
import { calculerMethodeCSlice } from '../methodeCSliceDensity';
import type { Bougie } from '@/lib/chartDataHelper';

describe('Comparatif des 3 Méthodes de Chevauchement de Bougies', () => {
  // Jeu de bougies oscillantes avec fort chevauchement (surplace)
  const bougiesChevauchees: Bougie[] = Array.from({ length: 40 }, (_, i) => ({
    time: 1700000000 + i * 3600,
    open: 1.0800 + Math.sin(i) * 0.0010,
    high: 1.0820 + Math.sin(i) * 0.0010,
    low: 1.0780 + Math.sin(i) * 0.0010,
    close: 1.0805 + Math.sin(i) * 0.0010,
  }));

  // Jeu de bougies en tendance forte sans aucun chevauchement (marches d'escalier)
  const bougiesTendance: Bougie[] = Array.from({ length: 20 }, (_, i) => ({
    time: 1700000000 + i * 3600,
    open: 1.0800 + i * 0.0050,
    high: 1.0840 + i * 0.0050,
    low: 1.0790 + i * 0.0050,
    close: 1.0835 + i * 0.0050,
  }));

  describe('Méthode A : Bougie Mère Non-Mitigée & Chevauchement Direct', () => {
    it('détecte les bougies mères et leurs suites de chevauchement direct sur les bougies en surplace', () => {
      const res = calculerMethodeACompression(bougiesChevauchees, { lookbackBars: 500, minBougiesDirectes: 2 });
      expect(res.bougiesMeres.length).toBeGreaterThan(0);
      expect(res.primitives.boites?.length).toBeGreaterThan(0);
    });

    it('identifie correctement une zone de compression non-mitigée prolongée vers le futur', () => {
      // 4 bougies en surplace autour de 1.0800
      const cluster: Bougie[] = Array.from({ length: 4 }, (_, i) => ({
        time: 1700000000 + i * 3600,
        open: 1.0800,
        high: 1.0815,
        low: 1.0795,
        close: 1.0805,
      }));

      // Puis départ haussier violent sans retour (10 bougies loin au-dessus)
      const depart: Bougie[] = Array.from({ length: 10 }, (_, i) => ({
        time: 1700000000 + (4 + i) * 3600,
        open: 1.0850 + i * 0.0020,
        high: 1.0870 + i * 0.0020,
        low: 1.0845 + i * 0.0020,
        close: 1.0865 + i * 0.0020,
      }));

      const bougies = [...cluster, ...depart];
      const res = calculerMethodeACompression(bougies, { fenetreBougies: 4, seuilRatioCompression: 2.0 });

      expect(res.zones.length).toBeGreaterThan(0);
      expect(res.totalNonMitiguees).toBeGreaterThan(0);
      expect(res.zones[0].estMitiguee).toBe(false);

      // La boîte doit être prolongée jusqu'à la dernière bougie
      const boiteNonMitiguee = res.primitives.boites?.find(b => b.label?.includes('NON-MITIGÉ'));
      expect(boiteNonMitiguee).toBeDefined();
      expect(boiteNonMitiguee?.dateFin).toBe(depart[depart.length - 1].time);
    });
  });

  describe('Méthode B : Surface Commune Bougie à Bougie (Overlap Surface)', () => {
    it('identifie des chaînes de 3+ bougies en surface commune sur les bougies oscillantes', () => {
      const res = calculerMethodeBOverlap(bougiesChevauchees, { minBougiesChaine: 3, seuilOverlapPourcent: 50 });
      expect(res.totalChainesDetectees).toBeGreaterThan(0);
      expect(res.chaines[0].nombreBougies).toBeGreaterThanOrEqual(3);
    });

    it('ne trouve aucune chaîne de chevauchement sur une tendance unidirectionnelle', () => {
      const res = calculerMethodeBOverlap(bougiesTendance, { minBougiesChaine: 3, seuilOverlapPourcent: 50 });
      expect(res.totalChainesDetectees).toBe(0);
    });

    it('prolonge la surface partagée non-mitigée après un départ haussier', () => {
      const cluster: Bougie[] = Array.from({ length: 4 }, (_, i) => ({
        time: 1700000000 + i * 3600,
        open: 1.0800,
        high: 1.0815,
        low: 1.0795,
        close: 1.0805,
      }));
      const depart: Bougie[] = Array.from({ length: 10 }, (_, i) => ({
        time: 1700000000 + (4 + i) * 3600,
        open: 1.0850 + i * 0.0020,
        high: 1.0870 + i * 0.0020,
        low: 1.0845 + i * 0.0020,
        close: 1.0865 + i * 0.0020,
      }));
      const bougies = [...cluster, ...depart];
      const res = calculerMethodeBOverlap(bougies, { minBougiesChaine: 3, seuilOverlapPourcent: 50 });

      expect(res.totalNonMitiguees).toBeGreaterThan(0);
      expect(res.chaines[0].estMitiguee).toBe(false);

      const boite = res.primitives.boites?.find(b => b.label?.includes('NON-MITIGÉ'));
      expect(boite).toBeDefined();
      expect(boite?.dateFin).toBe(depart[depart.length - 1].time);
    });
  });

  describe('Méthode C : Densité de Traversées par Tranches dans le Couloir', () => {
    it('calcule un fort pourcentage de tranches denses sur zone de surplace', () => {
      const res = calculerMethodeCSlice(bougiesChevauchees, {
        direction: 'achat',
        prixTPManuel: 1.0830,
        nbTranches: 10,
        minBougiesParTranche: 3,
      });
      expect(res.totalTranches).toBe(10);
      expect(res.tranchesFortes).toBeGreaterThan(0);
      expect(res.primitives.lignes?.length).toBe(10);
    });
  });
});
