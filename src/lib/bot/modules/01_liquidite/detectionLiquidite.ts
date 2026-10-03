import type { Bougie } from '@/lib/chartDataHelper';

// ─── 📊 Types et Structures de données ────────────────────────────────────────

/**
 * Représente un niveau de liquidité détecté (BSL ou SSL).
 * BSL = Buy-Side Liquidity (sommet où les stop-loss des vendeurs se trouvent)
 * SSL = Sell-Side Liquidity (creux où les stop-loss des acheteurs se trouvent)
 * 
 * Exemple :
 * const niveau: NiveauLiquidite = {
 *   type: 'BSL',
 *   prix: 1.0850,
 *   indexOrigine: 42,
 *   tempsOrigine: '2026-09-23T10:00:00',
 *   indexFin: 80,
 *   tempsFin: '2026-09-23T14:00:00',
 * };
 */
export interface NiveauLiquidite {
  type: 'BSL' | 'SSL';         // BSL = Résistance/Sommet, SSL = Support/Creux
  prix: number;                 // Prix du niveau de liquidité
  indexOrigine: number;         // Index de la bougie où le pivot s'est formé
  tempsOrigine: number | string;
  indexFin: number;             // Dernière bougie où la ligne est prolongée
  tempsFin: number | string;
}

/**
 * Options de configuration de l'indicateur de détection de liquidité
 */
export interface OptionsDetectionLiquidite {
  sensibilitePivot?: number;    // Nombre de bougies à gauche/droite pour valider un pivot (défaut: 5)
  maxLookbackBars?: number;     // Nombre max de bougies historiques à analyser (défaut: 1000)
  afficherLignes?: boolean;     // Tracer les lignes BSL/SSL sur le graphique (défaut: true)
  afficherEtiquettes?: boolean; // Afficher les textes "BSL" / "SSL" (défaut: true)
}

/**
 * Résultat complet retourné par le calcul de détection de liquidité
 */
export interface ResultatDetectionLiquidite {
  niveaux: NiveauLiquidite[];        // Tous les niveaux BSL et SSL détectés
  dernierBSL: NiveauLiquidite | null; // Dernier niveau BSL actif (résistance)
  dernierSSL: NiveauLiquidite | null; // Dernier niveau SSL actif (support)
  totalBSL: number;                   // Nombre total de BSL détectés
  totalSSL: number;                   // Nombre total de SSL détectés
}

// ─── 🔍 Fonctions de Détection de Pivot ────────────────────────────────────────

/**
 * Vérifie si la bougie à l'index donné est un sommet local (Pivot Haut).
 * La bougie doit être plus haute que toutes ses voisines à gauche et à droite.
 * 
 * Exemple : estPivotHaut(bougies, 10, 5) vérifie si la bougie 10
 * est plus haute que les 5 bougies à gauche et les 5 à droite.
 */
function estPivotHaut(bougies: Bougie[], index: number, sensibilite: number): boolean {
  const prixCandidat = bougies[index].high;

  // Vérification du côté gauche
  for (let k = index - sensibilite; k < index; k++) {
    if (k < 0) continue;
    if (bougies[k].high > prixCandidat) return false;
  }

  // Vérification du côté droit
  for (let k = index + 1; k <= index + sensibilite; k++) {
    if (k >= bougies.length) return false;
    if (bougies[k].high >= prixCandidat) return false;
  }

  return true;
}

/**
 * Vérifie si la bougie à l'index donné est un creux local (Pivot Bas).
 * La bougie doit être plus basse que toutes ses voisines à gauche et à droite.
 * 
 * Exemple : estPivotBas(bougies, 10, 5) vérifie si la bougie 10
 * est plus basse que les 5 bougies à gauche et les 5 à droite.
 */
function estPivotBas(bougies: Bougie[], index: number, sensibilite: number): boolean {
  const prixCandidat = bougies[index].low;

  // Vérification du côté gauche
  for (let k = index - sensibilite; k < index; k++) {
    if (k < 0) continue;
    if (bougies[k].low < prixCandidat) return false;
  }

  // Vérification du côté droit
  for (let k = index + 1; k <= index + sensibilite; k++) {
    if (k >= bougies.length) return false;
    if (bougies[k].low <= prixCandidat) return false;
  }

  return true;
}

// ─── 🚀 Moteur Principal de Calcul ────────────────────────────────────────────

/**
 * Détecte les niveaux de liquidité BSL (sommets) et SSL (creux)
 * en identifiant les pivots hauts et bas dans l'historique des bougies.
 * 
 * Traduction directe de Indicateur_Detection_Liquidite.mq5.
 * Les niveaux sont prolongés horizontalement jusqu'à la bougie courante
 * pour visualiser les zones où la liquidité s'accumule.
 * 
 * Exemple :
 * const resultat = calculerDetectionLiquidite(bougies, { sensibilitePivot: 5 });
 * console.log(resultat.dernierBSL); // { type: 'BSL', prix: 1.0850, ... }
 * console.log(resultat.dernierSSL); // { type: 'SSL', prix: 1.0720, ... }
 */
export function calculerDetectionLiquidite(
  bougies: Bougie[],
  options: OptionsDetectionLiquidite = {}
): ResultatDetectionLiquidite {
  // 1️⃣ Paramètres par défaut
  const sensibilite = options.sensibilitePivot ?? 5;
  const maxLookback = options.maxLookbackBars ?? 1000;

  // Résultat vide si pas assez de données
  const minBougies = (sensibilite * 2) + 10;
  if (!bougies || bougies.length < minBougies) {
    return { niveaux: [], dernierBSL: null, dernierSSL: null, totalBSL: 0, totalSSL: 0 };
  }

  // 2️⃣ Détermination de la bougie de départ (comme dans le MQL5)
  const depart = Math.max(sensibilite * 2 + 5, bougies.length - maxLookback);

  // Variables d'état du dernier niveau actif (comme dans le MQL5)
  let dernierBSLPrix = 0;
  let dernierBSLBarre = -1;
  let dernierSSLPrix = 0;
  let dernierSSLBarre = -1;

  // Stockage de tous les niveaux détectés
  const niveaux: NiveauLiquidite[] = [];

  // 3️⃣ Parcours chronologique barre par barre (identique au OnCalculate MQL5)
  for (let bar = depart; bar < bougies.length; bar++) {
    // Index du pivot candidat (décalé de sensibilite bougies en arrière,
    // car on a besoin des bougies à droite pour confirmer le pivot)
    const candidat = bar - sensibilite;

    if (candidat >= sensibilite) {
      // Recherche d'un Sommet (BSL / Buy-Side Liquidity)
      if (estPivotHaut(bougies, candidat, sensibilite)) {
        dernierBSLPrix = bougies[candidat].high;
        dernierBSLBarre = candidat;
      }

      // Recherche d'un Creux (SSL / Sell-Side Liquidity)
      if (estPivotBas(bougies, candidat, sensibilite)) {
        dernierSSLPrix = bougies[candidat].low;
        dernierSSLBarre = candidat;
      }
    }

    // À chaque barre, on enregistre le niveau actif prolongé
    // (reproduit le comportement des buffers continus du MQL5)
    if (dernierBSLPrix > 0 && dernierBSLBarre >= 0) {
      // Mise à jour du dernier niveau BSL enregistré ou création d'un nouveau
      const existant = niveaux.find(n => n.type === 'BSL' && n.indexOrigine === dernierBSLBarre);
      if (existant) {
        existant.indexFin = bar;
        existant.tempsFin = bougies[bar].time;
      } else {
        niveaux.push({
          type: 'BSL',
          prix: dernierBSLPrix,
          indexOrigine: dernierBSLBarre,
          tempsOrigine: bougies[dernierBSLBarre].time,
          indexFin: bar,
          tempsFin: bougies[bar].time,
        });
      }
    }

    if (dernierSSLPrix > 0 && dernierSSLBarre >= 0) {
      const existant = niveaux.find(n => n.type === 'SSL' && n.indexOrigine === dernierSSLBarre);
      if (existant) {
        existant.indexFin = bar;
        existant.tempsFin = bougies[bar].time;
      } else {
        niveaux.push({
          type: 'SSL',
          prix: dernierSSLPrix,
          indexOrigine: dernierSSLBarre,
          tempsOrigine: bougies[dernierSSLBarre].time,
          indexFin: bar,
          tempsFin: bougies[bar].time,
        });
      }
    }
  }

  // 4️⃣ Construction du résultat final
  const dernierBSL = dernierBSLBarre >= 0 ? niveaux.find(n => n.type === 'BSL' && n.indexOrigine === dernierBSLBarre) ?? null : null;
  const dernierSSL = dernierSSLBarre >= 0 ? niveaux.find(n => n.type === 'SSL' && n.indexOrigine === dernierSSLBarre) ?? null : null;

  return {
    niveaux,
    dernierBSL,
    dernierSSL,
    totalBSL: niveaux.filter(n => n.type === 'BSL').length,
    totalSSL: niveaux.filter(n => n.type === 'SSL').length,
  };
}
