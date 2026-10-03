import type { Bougie } from '@/lib/chartDataHelper';

// ─── 📊 Types et Structures de données ────────────────────────────────────────

/**
 * Représente un pivot swing confirmé (sommet ou creux).
 */
export interface PointPivotEQ {
  prix: number;
  temps: number | string;
  index: number;
  estHaut: boolean; // true = sommet (candidat EQH), false = creux (candidat EQL)
}

/**
 * Représente un niveau d'Equal Highs ou d'Equal Lows identifié.
 * EQH (Equal Highs) : Deux sommets alignés horizontalement = accumulation de Buy-Side Liquidity (BSL).
 * EQL (Equal Lows)  : Deux creux alignés horizontalement  = accumulation de Sell-Side Liquidity (SSL).
 * 
 * Exemple :
 * const niveau: NiveauEQ = {
 *   id: 'eqh-12-35',
 *   type: 'EQH',
 *   prix: 1.0850,
 *   prixPivot1: 1.0851,
 *   prixPivot2: 1.0849,
 *   indexPivot1: 12,
 *   tempsPivot1: 1700000000,
 *   indexPivot2: 35,
 *   tempsPivot2: 1700001000,
 *   estSwept: false,
 *   indexFin: 100,
 *   tempsFin: 1700005000,
 * };
 */
export interface NiveauEQ {
  id: string;
  type: 'EQH' | 'EQL';             // EQH = Sommets alignés, EQL = Creux alignés
  prix: number;                     // Prix moyen des deux pivots
  prixPivot1: number;               // Prix exact du premier pivot
  prixPivot2: number;               // Prix exact du deuxième pivot
  indexPivot1: number;              // Index de la bougie du premier pivot
  tempsPivot1: number | string;
  indexPivot2: number;              // Index de la bougie du deuxième pivot
  tempsPivot2: number | string;
  estSwept: boolean;                // true si une mèche ultérieure a balayé/liquidé le niveau
  indexSweep?: number;              // Index de la bougie ayant balayé le niveau
  tempsSweep?: number | string;     // Date de la bougie de balayage
  prixSweep?: number;               // Extrême atteint par la mèche de balayage
  indexFin: number;                 // Dernière bougie où le niveau est prolongé
  tempsFin: number | string;
}

/**
 * Options de configuration du détecteur d'Equal Highs et Equal Lows
 */
export interface OptionsDetectionLiquiditeEQ {
  profondeurPivot?: number;         // Sensibilité des pivots (bougies gauche/droite, ex: 5)
  tolerancePips?: number;           // Tolérance d'alignement en pips entre 2 pivots (ex: 1.5)
  minBougiesEntrePivots?: number;   // Écart minimal en bougies entre les 2 sommets/creux (ex: 4)
  maxBougiesEntrePivots?: number;   // Écart maximal en bougies entre les 2 sommets/creux (ex: 75)
  maxBougiesHistorique?: number;    // Historique maximum de bougies à analyser (ex: 600)
  taillePip?: number;               // Taille personnalisée d'un pip (ex: 0.0001)
  minSweepPips?: number;            // Dépassement minimal pour valider un sweep (ex: 0.5)
  exigerReintegration?: boolean;    // La bougie de sweep doit réintégrer le niveau (défaut: true)
}

/**
 * Résultat complet retourné par le calcul
 */
export interface ResultatDetectionLiquiditeEQ {
  niveaux: NiveauEQ[];              // Tous les niveaux EQH et EQL détectés
  niveauxActifs: NiveauEQ[];        // Niveaux non balayés (liquidité encore active)
  niveauxBalayes: NiveauEQ[];       // Niveaux déjà balayés (liquidité consommée)
  dernierEQH: NiveauEQ | null;      // Dernier niveau EQH actif
  dernierEQL: NiveauEQ | null;      // Dernier niveau EQL actif
  totalEQH: number;                 // Nombre total d'EQH
  totalEQL: number;                 // Nombre total d'EQL
}

// ─── 🛠️ Fonctions Utilitaires ──────────────────────────────────────────────────

/**
 * Déduit automatiquement la taille d'un pip en fonction du niveau de prix.
 * 
 * Exemple :
 * deduireTaillePip(1.0850) -> 0.0001 (Forex)
 * deduireTaillePip(155.20) -> 0.01   (Yen)
 * deduireTaillePip(2600)   -> 0.1    (Or / Indices)
 */
export function deduireTaillePip(prixReference: number): number {
  if (prixReference <= 0) return 0.0001;
  if (prixReference > 1000) return 0.1;
  if (prixReference > 50) return 0.01;
  return 0.0001;
}

// ─── 🔍 Étape 1 : Détection des Pivots Swings ──────────────────────────────────

/**
 * Détecte les sommets et creux pivots dans la plage de bougies demandée.
 * Reproduit la fonction DetecterPivotsSwings du code MQL5.
 */
function detecterPivotsSwings(
  bougies: Bougie[],
  profondeur: number,
  maxHistorique: number
): PointPivotEQ[] {
  const pivots: PointPivotEQ[] = [];
  const totalBougies = bougies.length;

  const debut = Math.max(profondeur, totalBougies - maxHistorique);
  const fin = totalBougies - profondeur - 1;

  for (let i = debut; i <= fin; i++) {
    let estHaut = true;
    let estBas = true;

    // Vérifie les bougies à gauche et à droite selon la profondeur
    for (let j = 1; j <= profondeur; j++) {
      if (bougies[i].high <= bougies[i - j].high || bougies[i].high < bougies[i + j].high) {
        estHaut = false;
      }
      if (bougies[i].low >= bougies[i - j].low || bougies[i].low > bougies[i + j].low) {
        estBas = false;
      }
    }

    if (estHaut) {
      pivots.push({
        prix: bougies[i].high,
        temps: bougies[i].time,
        index: i,
        estHaut: true,
      });
    } else if (estBas) {
      pivots.push({
        prix: bougies[i].low,
        temps: bougies[i].time,
        index: i,
        estHaut: false,
      });
    }
  }

  return pivots;
}

// ─── 🎯 Étape 2 : Identification des Equal Highs et Equal Lows ─────────────────

/**
 * Compare chaque paire de pivots du même type pour identifier les sommets ou creux alignés.
 * Reproduit fidèlement la fonction IdentifierEqualHighsLows du code MQL5.
 */
function identifierPairesAlignees(
  pivots: PointPivotEQ[],
  bougies: Bougie[],
  tolerancePoints: number,
  minBougies: number,
  maxBougies: number
): NiveauEQ[] {
  const niveaux: NiveauEQ[] = [];

  if (pivots.length < 2) return niveaux;

  for (let i = 0; i < pivots.length - 1; i++) {
    for (let j = i + 1; j < pivots.length; j++) {
      // 1️⃣ Doivent être de même nature (deux sommets ou deux creux)
      if (pivots[i].estHaut !== pivots[j].estHaut) continue;

      // 2️⃣ Vérification de l'écart temporel en nombre de bougies
      const ecartBougies = pivots[j].index - pivots[i].index;
      if (ecartBougies < minBougies) continue;
      if (ecartBougies > maxBougies) break; // Inutile de chercher plus loin dans l'historique

      // 3️⃣ Vérification de l'alignement en prix selon la tolérance en pips
      const ecartPrix = Math.abs(pivots[i].prix - pivots[j].prix);
      if (ecartPrix > tolerancePoints) continue;

      // 4️⃣ Vérification de non-violation intermédiaire :
      // Aucune bougie entre les deux pivots ne doit casser le niveau de manière excessive
      let niveauValide = true;
      if (pivots[i].estHaut) {
        // Pour EQH : les bougies intermédiaires ne doivent pas dépasser les sommets
        const maxPermis = Math.max(pivots[i].prix, pivots[j].prix) + tolerancePoints;
        for (let k = pivots[i].index + 1; k < pivots[j].index; k++) {
          if (bougies[k].high > maxPermis) {
            niveauValide = false;
            break;
          }
        }
      } else {
        // Pour EQL : les bougies intermédiaires ne doivent pas plonger sous les creux
        const minPermis = Math.min(pivots[i].prix, pivots[j].prix) - tolerancePoints;
        for (let k = pivots[i].index + 1; k < pivots[j].index; k++) {
          if (bougies[k].low < minPermis) {
            niveauValide = false;
            break;
          }
        }
      }

      if (niveauValide) {
        const estEQH = pivots[i].estHaut;
        const prixMoyen = (pivots[i].prix + pivots[j].prix) / 2.0;

        niveaux.push({
          id: `${estEQH ? 'eqh' : 'eql'}-${pivots[i].index}-${pivots[j].index}`,
          type: estEQH ? 'EQH' : 'EQL',
          prix: prixMoyen,
          prixPivot1: pivots[i].prix,
          prixPivot2: pivots[j].prix,
          indexPivot1: pivots[i].index,
          tempsPivot1: pivots[i].temps,
          indexPivot2: pivots[j].index,
          tempsPivot2: pivots[j].temps,
          estSwept: false,
          indexFin: bougies.length - 1,
          tempsFin: bougies[bougies.length - 1].time,
        });
      }
    }
  }

  return niveaux;
}

// ─── ⚡ Étape 3 : Vérification des Balayages (Sweeps) ───────────────────────────

/**
 * Vérifie si les bougies formées après le second pivot ont balayé (swept) le niveau d'EQH ou d'EQL.
 * Reproduit la logique de DetecterEtQualifierSweeps du MQL5.
 */
function verifierBalayageNiveaux(
  niveaux: NiveauEQ[],
  bougies: Bougie[],
  minSweepPoints: number,
  exigerReintegration: boolean
): void {
  const totalBougies = bougies.length;

  for (const niveau of niveaux) {
    const debutRecherche = niveau.indexPivot2 + 1;

    for (let b = debutRecherche; b < totalBougies; b++) {
      const bougie = bougies[b];
      const rangeBougie = bougie.high - bougie.low;
      if (rangeBougie <= 0) continue;

      if (niveau.type === 'EQH') {
        // CAS EQH : La mèche haute dépasse le niveau moyen des sommets
        if (bougie.high >= niveau.prix + minSweepPoints) {
          const depassement = bougie.high - niveau.prix;
          const reintègre = !exigerReintegration || bougie.close <= niveau.prix || bougie.close < (bougie.high - (depassement * 0.5));

          if (reintègre) {
            niveau.estSwept = true;
            niveau.indexSweep = b;
            niveau.tempsSweep = bougie.time;
            niveau.prixSweep = bougie.high;
            niveau.indexFin = b;
            niveau.tempsFin = bougie.time;
            break; // Le niveau est désormais consommé
          }
        }
      } else {
        // CAS EQL : La mèche basse plonge sous le niveau moyen des creux
        if (bougie.low <= niveau.prix - minSweepPoints) {
          const depassement = niveau.prix - bougie.low;
          const reintègre = !exigerReintegration || bougie.close >= niveau.prix || bougie.close > (bougie.low + (depassement * 0.5));

          if (reintègre) {
            niveau.estSwept = true;
            niveau.indexSweep = b;
            niveau.tempsSweep = bougie.time;
            niveau.prixSweep = bougie.low;
            niveau.indexFin = b;
            niveau.tempsFin = bougie.time;
            break; // Le niveau est désormais consommé
          }
        }
      }
    }
  }
}

// ─── 🚀 Moteur Principal de Calcul ────────────────────────────────────────────

/**
 * Calcule les zones de liquidité concentrées sur Equal Highs et Equal Lows.
 * 
 * Traduction directe du cœur algorithmique de SMC_EQH_EQL_Sweep_Profiler.mq5.
 * 
 * Exemple :
 * const resultat = calculerDetectionLiquiditeEQ(bougies, {
 *   profondeurPivot: 5,
 *   tolerancePips: 1.5,
 * });
 * console.log(`EQH actifs: ${resultat.niveauxActifs.filter(n => n.type === 'EQH').length}`);
 */
export function calculerDetectionLiquiditeEQ(
  bougies: Bougie[],
  options: OptionsDetectionLiquiditeEQ = {}
): ResultatDetectionLiquiditeEQ {
  // 1️⃣ Configuration des paramètres avec valeurs par défaut alignées sur le MQL5
  const profondeur = options.profondeurPivot ?? 5;
  const tolerancePips = options.tolerancePips ?? 1.5;
  const minBougies = options.minBougiesEntrePivots ?? 4;
  const maxBougies = options.maxBougiesEntrePivots ?? 75;
  const maxHistorique = options.maxBougiesHistorique ?? 600;
  const minSweepPips = options.minSweepPips ?? 0.5;
  const exigerReintegration = options.exigerReintegration ?? true;

  const minRequis = (profondeur * 2) + minBougies + 5;
  if (!bougies || bougies.length < minRequis) {
    return {
      niveaux: [],
      niveauxActifs: [],
      niveauxBalayes: [],
      dernierEQH: null,
      dernierEQL: null,
      totalEQH: 0,
      totalEQL: 0,
    };
  }

  // 2️⃣ Calcul de la taille du pip et de la tolérance en points
  const prixRef = bougies[bougies.length - 1].close;
  const pipSize = options.taillePip ?? deduireTaillePip(prixRef);
  const tolerancePoints = tolerancePips * pipSize;
  const minSweepPoints = minSweepPips * pipSize;

  // 3️⃣ Étape 1 : Détection des pivots swings
  const pivots = detecterPivotsSwings(bougies, profondeur, maxHistorique);

  // 4️⃣ Étape 2 : Identification des paires de sommets et creux alignés
  const niveaux = identifierPairesAlignees(pivots, bougies, tolerancePoints, minBougies, maxBougies);

  // 5️⃣ Étape 3 : Vérification des balayages ultérieurs (Sweeps)
  verifierBalayageNiveaux(niveaux, bougies, minSweepPoints, exigerReintegration);

  // 6️⃣ Séparation des niveaux actifs vs balayés
  const niveauxActifs = niveaux.filter((n) => !n.estSwept);
  const niveauxBalayes = niveaux.filter((n) => n.estSwept);

  const eqhActifs = niveauxActifs.filter((n) => n.type === 'EQH');
  const eqlActifs = niveauxActifs.filter((n) => n.type === 'EQL');

  const dernierEQH = eqhActifs.length > 0 ? eqhActifs[eqhActifs.length - 1] : null;
  const dernierEQL = eqlActifs.length > 0 ? eqlActifs[eqlActifs.length - 1] : null;

  return {
    niveaux,
    niveauxActifs,
    niveauxBalayes,
    dernierEQH,
    dernierEQL,
    totalEQH: niveaux.filter((n) => n.type === 'EQH').length,
    totalEQL: niveaux.filter((n) => n.type === 'EQL').length,
  };
}
