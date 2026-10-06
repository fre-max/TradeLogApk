import type { Bougie } from '@/lib/chartDataHelper';
import type { MetriqueReintegration } from '../types';

function calculerTaillePip(prix: number): number {
  if (prix > 1000) return 0.1;
  if (prix > 50) return 0.01;
  return 0.0001;
}

/**
 * ⚡ CAPTEUR 3 : MESURE DE LA RÉINTÉGRATION (LA RÉACTION)
 * 
 * Analyse la vitesse et la force du retour à l'intérieur de la zone :
 * 1. En combien de bougies le cours a-t-il clôturé de nouveau à l'intérieur ?
 * 2. Quelle est l'amplitude du rebond de sortie (en pips) ?
 * 3. Le mouvement présente-t-il un "Displacement" (forte impulsion nette) ?
 * 4. A-t-il laissé un Fair Value Gap (déséquilibre) confirmant l'engagement institutionnel ?
 * 
 * Exemple :
 * const retour = sonderReintegration(bougies, indexSweep, 1.0825, 'ACHAT', 1.0818);
 * console.log(`Réintégré en ${retour.delaiBougies} bougies avec rejet de ${retour.amplitudeRejetPips} pips`);
 */
export function sonderReintegration(
  bougies: Bougie[],
  indexSweep: number,
  prixNiveauLiquidite: number,
  direction: 'ACHAT' | 'VENTE',
  prixProtegeExtreme: number
): MetriqueReintegration {
  const pipSize = calculerTaillePip(prixNiveauLiquidite);
  const bougieSweep = bougies[indexSweep];

  // 1️⃣ Vérifier si la bougie de sweep a déjà clôturé elle-même à l'intérieur
  const reintSurMemeBougie =
    direction === 'ACHAT'
      ? bougieSweep.close > prixNiveauLiquidite
      : bougieSweep.close < prixNiveauLiquidite;

  let indexReint = indexSweep;
  let delai = 0;

  if (!reintSurMemeBougie) {
    // Parcourir les bougies suivantes jusqu'à 8 bougies max
    const maxIndex = Math.min(bougies.length - 1, indexSweep + 8);
    let trouve = false;

    for (let i = indexSweep + 1; i <= maxIndex; i++) {
      const b = bougies[i];
      const estDedans =
        direction === 'ACHAT'
          ? b.close > prixNiveauLiquidite
          : b.close < prixNiveauLiquidite;

      if (estDedans) {
        indexReint = i;
        delai = i - indexSweep;
        trouve = true;
        break;
      }
    }

    if (!trouve) {
      indexReint = Math.min(bougies.length - 1, indexSweep + 1);
      delai = indexReint - indexSweep;
    }
  }

  // 2️⃣ Amplitude du rebond depuis l'extrême protégé
  const bougieReint = bougies[indexReint] || bougieSweep;
  const prixSortie = bougieReint.close;
  const amplitudeRejet = Math.abs(prixSortie - prixProtegeExtreme);
  const amplitudeRejetPips = Number((amplitudeRejet / pipSize).toFixed(1));

  // 3️⃣ Détection de Displacement (corps de bougie puissant)
  const corpsReint = Math.abs(bougieReint.close - bougieReint.open);
  // Moyenne des corps des 5 bougies d'avant
  let sommeCorps = 0;
  let nb = 0;
  for (let j = Math.max(0, indexSweep - 5); j < indexSweep; j++) {
    sommeCorps += Math.abs(bougies[j].close - bougies[j].open);
    nb++;
  }
  const moyenneCorps = nb > 0 ? sommeCorps / nb : corpsReint;
  const aDisplacement = corpsReint >= moyenneCorps * 1.35;

  // 4️⃣ Détection de FVG (Fair Value Gap) dans les 3 bougies autour de la réintégration
  let aFvg = false;
  let fvgHaut: number | undefined;
  let fvgBas: number | undefined;

  for (let k = indexSweep; k <= Math.min(bougies.length - 2, indexReint + 2); k++) {
    if (k >= 2) {
      if (direction === 'ACHAT') {
        // FVG Haussier : le bas de la bougie k est supérieur au haut de la bougie k-2
        if (bougies[k].low > bougies[k - 2].high) {
          aFvg = true;
          fvgHaut = bougies[k].low;
          fvgBas = bougies[k - 2].high;
          break;
        }
      } else {
        // FVG Baissier : le haut de la bougie k est inférieur au bas de la bougie k-2
        if (bougies[k].high < bougies[k - 2].low) {
          aFvg = true;
          fvgHaut = bougies[k - 2].low;
          fvgBas = bougies[k].high;
          break;
        }
      }
    }
  }

  return {
    delaiBougies: delai,
    indexReintegration: indexReint,
    amplitudeRejetPips,
    aDisplacement,
    aFvg,
    fvgHaut,
    fvgBas,
  };
}
