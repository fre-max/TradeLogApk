import type { Bougie } from '@/lib/chartDataHelper';
import type { MetriqueSweep } from '../types';

function calculerTaillePip(prix: number): number {
  if (prix > 1000) return 0.1;
  if (prix > 50) return 0.01;
  return 0.0001;
}

/**
 * 📏 CAPTEUR 2 : MESURE DU MOUVEMENT DE SWEEP (L'INCURSION)
 * 
 * Mesure avec précision chirurgicale :
 * 1. La profondeur du dépassement au-delà de la liquidité (en pips).
 * 2. La taille totale de la bougie et de la mèche de rejet.
 * 3. Le ratio de mèche (ex: 80% mèche = rejet violent, 30% = bougie pleine sans rejet).
 * 4. Le nombre de bougies restées hors de la zone.
 * 
 * Exemple :
 * const sweep = sonderMouvementSweep(bougies, indexSweep, 1.0825, 'ACHAT');
 * console.log(`Dépassement : ${sweep.profondeurPips} pips, Mèche : ${sweep.ratioMechePourcent}%`);
 */
export function sonderMouvementSweep(
  bougies: Bougie[],
  indexSweep: number,
  prixNiveauLiquidite: number,
  direction: 'ACHAT' | 'VENTE'
): MetriqueSweep {
  const b = bougies[indexSweep];
  const pipSize = calculerTaillePip(b.close);

  const tailleTotale = Math.max(0.00001, b.high - b.low);
  const tailleTotalePips = Number((tailleTotale / pipSize).toFixed(1));

  let profondeur = 0;
  let tailleMecheRejet = 0;
  let prixProtegeExtreme = b.low;

  if (direction === 'ACHAT') {
    // Pour un Achat : le sweep percute par le bas
    prixProtegeExtreme = b.low;
    profondeur = Math.max(0, prixNiveauLiquidite - b.low);
    // Mèche basse (sous le corps)
    const basCorps = Math.min(b.open, b.close);
    tailleMecheRejet = Math.max(0, basCorps - b.low);
  } else {
    // Pour une Vente : le sweep percute par le haut
    prixProtegeExtreme = b.high;
    profondeur = Math.max(0, b.high - prixNiveauLiquidite);
    // Mèche haute (au-dessus du corps)
    const hautCorps = Math.max(b.open, b.close);
    tailleMecheRejet = Math.max(0, b.high - hautCorps);
  }

  const profondeurPips = Number((profondeur / pipSize).toFixed(1));
  const tailleMechePips = Number((tailleMecheRejet / pipSize).toFixed(1));
  const ratioMeche = Math.min(100, Math.round((tailleMecheRejet / tailleTotale) * 100));

  // Compter les bougies consécutives qui ont dépassé le niveau
  let bougiesHorsZone = 1;
  // Regarder avant
  let idx = indexSweep - 1;
  while (idx >= 0 && ((direction === 'ACHAT' && bougies[idx].low < prixNiveauLiquidite) || (direction === 'VENTE' && bougies[idx].high > prixNiveauLiquidite))) {
    bougiesHorsZone++;
    idx--;
  }
  // Regarder après
  idx = indexSweep + 1;
  while (idx < bougies.length && ((direction === 'ACHAT' && bougies[idx].low < prixNiveauLiquidite) || (direction === 'VENTE' && bougies[idx].high > prixNiveauLiquidite))) {
    bougiesHorsZone++;
    idx++;
  }

  return {
    prixProtegeExtreme,
    profondeurPips,
    tailleBougieTotalePips: tailleTotalePips,
    tailleMecheRejetPips: tailleMechePips,
    ratioMechePourcent: ratioMeche,
    bougiesHorsZone,
  };
}
