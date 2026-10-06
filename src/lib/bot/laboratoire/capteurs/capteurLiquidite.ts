import type { Bougie } from '@/lib/chartDataHelper';
import type { MetriqueLiquidite } from '../types';

/**
 * Calcule la taille d'un pip selon le niveau de prix de l'actif
 */
function calculerTaillePip(prix: number): number {
  if (prix > 1000) return 0.1;   // Indices / Or / Crypto
  if (prix > 50) return 0.01;     // JPY
  return 0.0001;                 // Paires Forex standard
}

/**
 * 🎯 CAPTEUR 1 : DÉTECTION DE LA LIQUIDITÉ CIBLÉE
 * 
 * Analyse les bougies précédant le sweep pour identifier quel niveau clé
 * (Creux Swing, Sommet Swing, Equal Lows/Highs) a été percuté par la mèche.
 * 
 * Exemple :
 * const res = sonderLiquiditeCible(bougies, indexSweep, 'ACHAT');
 * console.log(res.description); // "Creux Swing (1.0825) formé il y a 14 bougies"
 */
export function sonderLiquiditeCible(
  bougies: Bougie[],
  indexSweep: number,
  direction: 'ACHAT' | 'VENTE',
  options: { lookbackMax?: number; niveauForceManuel?: number } = {}
): MetriqueLiquidite {
  const bougieSweep = bougies[indexSweep];
  const lookback = options.lookbackMax ?? 80;
  const indexDebut = Math.max(0, indexSweep - lookback);

  // 1️⃣ Si l'utilisateur a spécifié manuellement un niveau de prix
  if (options.niveauForceManuel !== undefined && options.niveauForceManuel > 0) {
    return {
      type: 'PERSONNALISE',
      prixNiveau: options.niveauForceManuel,
      indexOrigine: indexSweep - 1,
      dateOrigine: bougies[Math.max(0, indexSweep - 1)]?.time ?? '',
      bougiesEcoulees: 1,
      description: `Niveau manuel fixé à ${options.niveauForceManuel.toFixed(4)}`,
    };
  }

  // 2️⃣ Recherche des pivots précédents
  // Pour un ACHAT : le sweep descend casser un creux précédent
  if (direction === 'ACHAT') {
    const creuxTrouves: Array<{ prix: number; index: number; temps: string | number; estEqual: boolean }> = [];

    // Recherche de Swing Lows (pivot à 2 bougies à gauche et 2 bougies à droite)
    for (let i = indexDebut + 2; i <= indexSweep - 2; i++) {
      const b = bougies[i];
      const estCreux =
        b.low < bougies[i - 1].low &&
        b.low <= bougies[i - 2].low &&
        b.low < bougies[i + 1].low &&
        b.low <= bougies[i + 2].low;

      if (estCreux) {
        creuxTrouves.push({
          prix: b.low,
          index: i,
          temps: b.time,
          estEqual: false,
        });
      }
    }

    // Filtrer les creux qui ont été effectivement percés par la mèche basse du sweep
    // (Le low du sweep doit être plus bas que le niveau du creux)
    const creuxPercés = creuxTrouves.filter((c) => bougieSweep.low < c.prix);

    if (creuxPercés.length > 0) {
      // On retient le creux percé le plus bas (le niveau clé de liquidité balayé)
      const candidat = [...creuxPercés].sort((a, b) => a.prix - b.prix || b.index - a.index)[0];
      const ecartBougies = indexSweep - candidat.index;

      return {
        type: 'SWING_LOW',
        prixNiveau: candidat.prix,
        indexOrigine: candidat.index,
        dateOrigine: candidat.temps,
        bougiesEcoulees: ecartBougies,
        description: `Creux Swing Low (${candidat.prix.toFixed(4)}) formé il y a ${ecartBougies} bougies`,
      };
    }

    // Repli : si aucun pivot strict n'a été trouvé, prendre le plus bas des 20 dernières bougies
    let minRecent = Infinity;
    let indexMin = Math.max(0, indexSweep - 1);
    for (let j = Math.max(0, indexSweep - 20); j < indexSweep; j++) {
      if (bougies[j].low < minRecent) {
        minRecent = bougies[j].low;
        indexMin = j;
      }
    }

    const ecart = indexSweep - indexMin;
    return {
      type: 'RANGE_EXTREME',
      prixNiveau: minRecent,
      indexOrigine: indexMin,
      dateOrigine: bougies[indexMin].time,
      bougiesEcoulees: ecart,
      description: `Bas de consolidation récente (${minRecent.toFixed(4)}) formé il y a ${ecart} bougies`,
    };
  }

  // 3️⃣ Pour une VENTE : le sweep monte casser un sommet précédent
  const sommetsTrouves: Array<{ prix: number; index: number; temps: string | number }> = [];

  for (let i = indexDebut + 2; i <= indexSweep - 2; i++) {
    const b = bougies[i];
    const estSommet =
      b.high > bougies[i - 1].high &&
      b.high >= bougies[i - 2].high &&
      b.high > bougies[i + 1].high &&
      b.high >= bougies[i + 2].high;

    if (estSommet) {
      sommetsTrouves.push({
        prix: b.high,
        index: i,
        temps: b.time,
      });
    }
  }

  const sommetsPercés = sommetsTrouves.filter((s) => bougieSweep.high > s.prix);

  if (sommetsPercés.length > 0) {
    // On retient le sommet percé le plus haut (la liquidité clé balayée)
    const candidat = [...sommetsPercés].sort((a, b) => b.prix - a.prix || b.index - a.index)[0];
    const ecartBougies = indexSweep - candidat.index;

    return {
      type: 'SWING_HIGH',
      prixNiveau: candidat.prix,
      indexOrigine: candidat.index,
      dateOrigine: candidat.temps,
      bougiesEcoulees: ecartBougies,
      description: `Sommet Swing High (${candidat.prix.toFixed(4)}) formé il y a ${ecartBougies} bougies`,
    };
  }

  // Repli : plus haut des 20 dernières bougies
  let maxRecent = -Infinity;
  let indexMax = Math.max(0, indexSweep - 1);
  for (let j = Math.max(0, indexSweep - 20); j < indexSweep; j++) {
    if (bougies[j].high > maxRecent) {
      maxRecent = bougies[j].high;
      indexMax = j;
    }
  }

  const ecartVente = indexSweep - indexMax;
  return {
    type: 'RANGE_EXTREME',
    prixNiveau: maxRecent,
    indexOrigine: indexMax,
    dateOrigine: bougies[indexMax].time,
    bougiesEcoulees: ecartVente,
    description: `Haut de consolidation récente (${maxRecent.toFixed(4)}) formé il y a ${ecartVente} bougies`,
  };
}
