import type { Bougie } from '@/lib/chartDataHelper';
import type { MetriqueRangePostSweep } from '../types';

function calculerTaillePip(prix: number): number {
  if (prix > 1000) return 0.1;
  if (prix > 50) return 0.01;
  return 0.0001;
}

/**
 * 📦 CAPTEUR 4 : MESURE DU RANGE DE CONSOLIDATION POST-SWEEP
 * 
 * Analyse la structure de temporisation qui suit la réintégration :
 * 1. Combien de bougies composent ce range de consolidation (ex: ~4 bougies) ?
 * 2. Quelle est son amplitude en pips (compression étroite ou dispersion) ?
 * 3. Le creux ou sommet protégé extrême du sweep est-il resté intact (inviolé) ?
 * 4. Quel est le point d'entrée fractal idéal suggéré ?
 * 
 * Exemple :
 * const range = sonderRangePostSweep(bougies, indexSweep, indexReint, 1.0818, 'ACHAT');
 * console.log(`Range de ${range.dureeBougies} bougies (${range.amplitudeRangePips} pips) - Protégé intact: ${range.prixProtegePreserve}`);
 */
export function sonderRangePostSweep(
  bougies: Bougie[],
  indexSweep: number,
  indexReintegration: number,
  prixProtegeExtreme: number,
  direction: 'ACHAT' | 'VENTE'
): MetriqueRangePostSweep {
  const pipSize = calculerTaillePip(prixProtegeExtreme);

  // Début du range : juste après la réintégration
  const debutRange = indexReintegration;
  // Fenêtre d'observation par défaut : 4 à 6 bougies après
  const finObservation = Math.min(bougies.length - 1, debutRange + 6);

  let maxHaut = -Infinity;
  let minBas = Infinity;
  let prixProtegePreserve = true;
  let dureeBougies = 0;

  for (let i = debutRange; i <= finObservation; i++) {
    const b = bougies[i];
    dureeBougies++;

    if (b.high > maxHaut) maxHaut = b.high;
    if (b.low < minBas) minBas = b.low;

    // Vérifier si le prix a cassé le prix protégé extrême
    if (direction === 'ACHAT' && b.low < prixProtegeExtreme) {
      prixProtegePreserve = false;
    } else if (direction === 'VENTE' && b.high > prixProtegeExtreme) {
      prixProtegePreserve = false;
    }
  }

  // Si on a moins d'une bougie analysable
  if (dureeBougies === 0 || maxHaut === -Infinity) {
    const bActuelle = bougies[indexSweep];
    maxHaut = bActuelle.high;
    minBas = bActuelle.low;
    dureeBougies = 1;
  }

  const amplitudePips = Number(((maxHaut - minBas) / pipSize).toFixed(1));

  // Point d'entrée suggéré : retest du bas du range pour un ACHAT, ou du haut pour une VENTE
  const prixEntreeSuggere = direction === 'ACHAT'
    ? minBas + (maxHaut - minBas) * 0.35 // 35% du range (zone discount)
    : maxHaut - (maxHaut - minBas) * 0.35; // 35% du range (zone premium)

  return {
    dureeBougies,
    borneHaute: maxHaut,
    borneBasse: minBas,
    amplitudeRangePips: amplitudePips,
    prixProtegePreserve,
    prixEntreeSuggere,
  };
}
