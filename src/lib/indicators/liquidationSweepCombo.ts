import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLabel, VisualLine, VisualBox, VisualPoint } from '@/types/indicatorScript';

/**
 * Options de configuration pour l'indicateur combiné :
 * Liquidation & Réintégration avec Détection de la Liquidité Balayée (Sweep BSL/SSL)
 * et Sélection Intelligente de la Liquidité la plus Adaptée (Proportionnalité, Relief & Proximité).
 */
export interface ParametresLiquidationSweepCombo {
  // ── 🎯 Détection & Sélection de la Liquidité la plus Adaptée ──
  // Mode de sélection si plusieurs niveaux ont été balayés par le point extrême :
  // 'SCORE_OPTIMAL' : Combine proportionnalité, relief du pivot et proximité (recommandé)
  // 'SWING_MAJEUR' : Priorité au sommet ou creux le plus marquant/profond
  // 'RECENT_VALIDE' : Priorité au niveau le plus récent respectant les filtres
  modeSelectionLiquidite?: 'SCORE_OPTIMAL' | 'SWING_MAJEUR' | 'RECENT_VALIDE';

  // Nombre de bougies à gauche et à droite pour valider un sommet/creux (défaut: 3)
  sensibilitePivotLiquidite?: number;
  // Nombre maximal de bougies antérieures scannées (défaut: 80)
  lookbackLiquidite?: number;
  // Distance minimale en bougies avant le setup pour ignorer le micro-bruit immédiat (défaut: 3)
  distanceMinBougies?: number;
  // Si true, le signal n'est validé QUE si une vraie liquidité antérieure a été balayée (défaut: true)
  exigerLiquiditeBalayee?: boolean;

  // ── ⚖️ Filtres de Proportionnalité & Pénétration (Sweet Spot) ──
  // Relief minimum du pivot par rapport à la taille moyenne d'une bougie (défaut: 0.5x)
  // Permet d'ignorer les petits paliers plats sans enjeu de stops
  reliefMinPivot?: number;
  // Pénétration maximale tolérée (défaut: 1.5 = 150% de la taille moyenne)
  // Évite les cassures excessives (breakout brutal au lieu d'une manipulation/chasse de stops)
  penetrationMaxRatio?: number;
  // Pénétration minimale requise pour garantir que les stops ont été touchés (défaut: 0.05 = 5%)
  penetrationMinRatio?: number;
  // Exige que la liquidité soit restée intacte (non déjà franchie) jusqu'à notre setup (défaut: true)
  exigerNiveauIntact?: boolean;

  // ── 🕯️ Paramètres du Chandelier Liq/Reint ──
  // Tolérance si la réintégration reste en deçà d'Open1 (défaut: 0.05 = 5%)
  toleranceDeficit?: number;
  // Tolérance élargie en dépassement favorable (défaut: 0.25 = 25%)
  toleranceDepassement?: number;
  // Active le filtre d'impulsion sur l'historique récent (défaut: true)
  activerFiltreTaille?: boolean;
  // Période récente de référence pour la moyenne (défaut: 10)
  periodeHistorique?: number;
  // Multiplicateur pour Bougie 1 entière (défaut: 1.75x)
  multiplicateurBougie1?: number;
  // Multiplicateur pour le corps pur de Bougie 2 (défaut: 1.75x)
  multiplicateurCorps2?: number;

  // ── 🧭 Filtre de Tendance et Directions ──
  activerAchat?: boolean;
  activerVente?: boolean;
  activerFiltreTendance?: boolean;
  trendBars?: number;

  // ── 🎨 Affichage Graphique ──
  // Afficher la ligne reliant la liquidité balayée au setup (défaut: true)
  afficherLigneLiquidite?: boolean;
  // Afficher la boîte rectangulaire de la zone de sweep (défaut: true)
  afficherZoneSweep?: boolean;
  // Afficher le badge avec le score de pertinence et la qualité (défaut: true)
  afficherBadgeScore?: boolean;
  bullColor?: string;
  bearColor?: string;
  texteLabel?: string;
}

/**
 * Informations complètes sur la liquidité antérieure sélectionnée comme la plus adaptée
 */
export interface LiquiditeBalayee {
  type: 'SSL' | 'BSL';
  prix: number;
  indexOrigine: number;
  tempsOrigine: number | string;
  distanceBougies: number;       // Nombre de bougies d'écart par rapport au setup
  profondeurSweep: number;       // Distance en prix franchie au-delà du niveau
  ratioSweep: number;            // Profondeur / taille moyenne d'une bougie
  reliefPivot: number;           // Hauteur en prix du swing du pivot (dégagement local)
  ratioRelief: number;           // Relief / taille moyenne d'une bougie
  scoreAdequation: number;       // Score de 0 à 100 mesurant la pertinence globale
  qualiteNiveau: 'MAJEUR' | 'MOYEN' | 'MINEUR'; // Classification claire pour le trader
  estIntact: boolean;            // Vrai si le niveau n'avait jamais été franchi avant
}

/**
 * Détail complet d'un signal combiné détecté
 */
export interface SignalLiquidationSweepCombo {
  type: 'ACHAT' | 'VENTE';
  indexBougie: number;
  temps: number | string;
  prixSignal: number;
  prixExtreme: number;          // Point bas le plus bas (Achat) ou haut le plus haut (Vente)
  bougieExtreme: 1 | 2;         // Indique si le sweep extrême provient de Bougie 1 ou Bougie 2
  open1: number;
  close2: number;
  ecartPrix: number;
  ratioEcart: number;
  situationCloture: 'DEPASSEMENT' | 'RETRAIT';
  rangeBougie1: number;
  corpsBougie2: number;
  liquidite?: LiquiditeBalayee;  // Liquidité la plus adaptée sélectionnée
}

/**
 * Résultat complet retourné par l'indicateur combiné
 */
export interface ResultatLiquidationSweepCombo {
  signaux: SignalLiquidationSweepCombo[];
  primitives: VisualPrimitives;
  statistiques: {
    totalSignaux: number;
    totalAchats: number;
    totalVentes: number;
    totalLiquiditesBalayees: number;
    totalAchatsAvecSweep: number;
    totalVentesAvecSweep: number;
    totalNiveauxMajeurs: number;
    totalNiveauxMoyens: number;
    totalNiveauxMineurs: number;
    scoreMoyenAdequation: number;
  };
}

/**
 * Fonction auxiliaire : vérifie si une bougie à l'index donné est un pivot haut (sommet / BSL)
 */
function estPivotHautLocal(bougies: Bougie[], index: number, sensibilite: number, indexMax: number): boolean {
  const hautCandidat = bougies[index].high;
  // Côté gauche
  for (let k = index - sensibilite; k < index; k++) {
    if (k < 0) continue;
    if (bougies[k].high > hautCandidat) return false;
  }
  // Côté droit (limité à indexMax pour ne pas regarder le futur du setup)
  const limiteDroite = Math.min(indexMax, index + sensibilite);
  for (let k = index + 1; k <= limiteDroite; k++) {
    if (bougies[k].high >= hautCandidat) return false;
  }
  return true;
}

/**
 * Fonction auxiliaire : vérifie si une bougie à l'index donné est un pivot bas (creux / SSL)
 */
function estPivotBasLocal(bougies: Bougie[], index: number, sensibilite: number, indexMax: number): boolean {
  const basCandidat = bougies[index].low;
  // Côté gauche
  for (let k = index - sensibilite; k < index; k++) {
    if (k < 0) continue;
    if (bougies[k].low < basCandidat) return false;
  }
  // Côté droit (limité à indexMax)
  const limiteDroite = Math.min(indexMax, index + sensibilite);
  for (let k = index + 1; k <= limiteDroite; k++) {
    if (bougies[k].low <= basCandidat) return false;
  }
  return true;
}

/**
 * Calcule le relief (amplitude du creux ou du sommet) dans son voisinage direct.
 * Plus le relief est grand, plus le swing est évident pour tous les participants.
 */
function calculerReliefPivot(
  bougies: Bougie[],
  indexPivot: number,
  sensibilite: number,
  typePivot: 'CREUX' | 'SOMMET'
): number {
  const indexDebut = Math.max(0, indexPivot - sensibilite * 2);
  const indexFin = Math.min(bougies.length - 1, indexPivot + sensibilite * 2);

  if (typePivot === 'CREUX') {
    // Hauteur entre le creux et le plus haut sommet du voisinage
    const prixCreux = bougies[indexPivot].low;
    let maxHigh = prixCreux;
    for (let i = indexDebut; i <= indexFin; i++) {
      if (bougies[i].high > maxHigh) {
        maxHigh = bougies[i].high;
      }
    }
    return Math.max(0.0001, maxHigh - prixCreux);
  } else {
    // Hauteur entre le sommet et le plus bas creux du voisinage
    const prixSommet = bougies[indexPivot].high;
    let minLow = prixSommet;
    for (let i = indexDebut; i <= indexFin; i++) {
      if (bougies[i].low < minLow) {
        minLow = bougies[i].low;
      }
    }
    return Math.max(0.0001, prixSommet - minLow);
  }
}

/**
 * Vérifie si le niveau de prix est resté intact (non violé) entre sa création
 * et l'arrivée du setup de bougies.
 */
function verifierNiveauIntact(
  bougies: Bougie[],
  indexPivot: number,
  indexFinRecherche: number,
  prixNiveau: number,
  direction: 'ACHAT' | 'VENTE'
): boolean {
  for (let i = indexPivot + 1; i <= indexFinRecherche; i++) {
    if (direction === 'ACHAT') {
      // Pour un SSL (creux), si une bougie antérieure est déjà descendue sous le niveau
      if (bougies[i].low < prixNiveau) return false;
    } else {
      // Pour un BSL (sommet), si une bougie antérieure est déjà montée au-dessus du niveau
      if (bougies[i].high > prixNiveau) return false;
    }
  }
  return true;
}

/**
 * Recherche et sélectionne la liquidité la plus adaptée parmi tous les pivots balayés,
 * selon les critères de proportionnalité, de relief et de proximité.
 */
function trouverLiquiditeLaPlusAdaptee(
  bougies: Bougie[],
  direction: 'ACHAT' | 'VENTE',
  prixExtreme: number,
  indexFinRecherche: number,
  indexSetupActuel: number,
  sensibilite: number,
  lookback: number,
  distanceMinBougies: number,
  reliefMinRatio: number,
  penetrationMaxRatio: number,
  penetrationMinRatio: number,
  exigerNiveauIntact: boolean,
  modeSelection: 'SCORE_OPTIMAL' | 'SWING_MAJEUR' | 'RECENT_VALIDE',
  prixReferenceHaut: number,
  prixReferenceBas: number,
  tailleMoyenneBougie: number
): LiquiditeBalayee | null {
  const indexDebut = Math.max(0, indexFinRecherche - lookback);
  const indexMaxScan = Math.max(0, indexFinRecherche - distanceMinBougies);

  // Liste des candidats éligibles balayés
  const candidats: LiquiditeBalayee[] = [];

  for (let k = indexMaxScan; k >= indexDebut; k--) {
    let estPivot = false;
    let prixPivot = 0;

    if (direction === 'ACHAT') {
      // En Achat : on cherche un creux (SSL) balayé par le point bas extrême
      if (estPivotBasLocal(bougies, k, sensibilite, indexFinRecherche)) {
        prixPivot = bougies[k].low;
        // La mèche extrême a percé le creux, et le creux reste sous la référence haute
        if (prixExtreme < prixPivot && prixPivot <= prixReferenceHaut) {
          estPivot = true;
        }
      }
    } else {
      // En Vente : on cherche un sommet (BSL) balayé par le point haut extrême
      if (estPivotHautLocal(bougies, k, sensibilite, indexFinRecherche)) {
        prixPivot = bougies[k].high;
        // La mèche extrême a dépassé le sommet, et le sommet reste au-dessus de la référence basse
        if (prixExtreme > prixPivot && prixPivot >= prixReferenceBas) {
          estPivot = true;
        }
      }
    }

    if (!estPivot) continue;

    // 1️⃣ Vérification si le niveau était intact
    const estIntact = verifierNiveauIntact(bougies, k, indexFinRecherche, prixPivot, direction);
    if (exigerNiveauIntact && !estIntact) {
      continue; // Niveau déjà violé dans le passé : ignoré
    }

    // 2️⃣ Analyse de la pénétration (Sweet Spot du sweep)
    const profondeurSweep = direction === 'ACHAT'
      ? prixPivot - prixExtreme
      : prixExtreme - prixPivot;
    const ratioSweep = profondeurSweep / tailleMoyenneBougie;

    // Filtre sur la pénétration minimale et maximale
    if (ratioSweep < penetrationMinRatio || ratioSweep > penetrationMaxRatio) {
      continue;
    }

    // 3️⃣ Analyse du relief du swing (Importance du pivot)
    const relief = calculerReliefPivot(
      bougies,
      k,
      sensibilite,
      direction === 'ACHAT' ? 'CREUX' : 'SOMMET'
    );
    const ratioRelief = relief / tailleMoyenneBougie;

    // Filtre sur le relief minimal
    if (ratioRelief < reliefMinRatio) {
      continue;
    }

    // Classification en qualité
    let qualiteNiveau: 'MAJEUR' | 'MOYEN' | 'MINEUR' = 'MINEUR';
    if (ratioRelief >= 1.5) {
      qualiteNiveau = 'MAJEUR';
    } else if (ratioRelief >= 0.75) {
      qualiteNiveau = 'MOYEN';
    }

    // 4️⃣ Distance temporelle
    const distanceBougies = indexSetupActuel - k;

    // 5️⃣ Calcul du Score d'Adéquation Global (0 à 100)
    // - Relief / Importance (jusqu'à 45 points)
    const pointsRelief = Math.min(45, (ratioRelief / 2.0) * 45);

    // - Pénétration idéale / Sweet spot entre 0.15x et 0.8x (jusqu'à 35 points)
    let pointsSweep = 35;
    if (ratioSweep < 0.15) {
      pointsSweep = Math.max(10, 35 - ((0.15 - ratioSweep) / 0.15) * 25);
    } else if (ratioSweep > 0.80) {
      pointsSweep = Math.max(10, 35 - ((ratioSweep - 0.80) / (penetrationMaxRatio - 0.80 || 1)) * 25);
    }

    // - Fraîcheur & Proximité équilibrée (jusqu'à 20 points)
    // Idéal entre 5 et 35 bougies
    let pointsProximite = 20;
    if (distanceBougies > 35) {
      const reculExcédentaire = Math.min(1, (distanceBougies - 35) / Math.max(1, lookback - 35));
      pointsProximite = Math.max(5, 20 - reculExcédentaire * 15);
    }

    const scoreAdequation = Math.min(100, Math.round(pointsRelief + pointsSweep + pointsProximite));

    candidats.push({
      type: direction === 'ACHAT' ? 'SSL' : 'BSL',
      prix: prixPivot,
      indexOrigine: k,
      tempsOrigine: bougies[k].time,
      distanceBougies,
      profondeurSweep,
      ratioSweep,
      reliefPivot: relief,
      ratioRelief,
      scoreAdequation,
      qualiteNiveau,
      estIntact,
    });
  }

  if (candidats.length === 0) return null;

  // 6️⃣ Sélection selon le mode choisi par l'utilisateur
  if (modeSelection === 'SWING_MAJEUR') {
    // Choisir le pivot qui a le plus fort relief
    return candidats.reduce((meilleur, cand) => cand.ratioRelief > meilleur.ratioRelief ? cand : meilleur, candidats[0]);
  }

  if (modeSelection === 'RECENT_VALIDE') {
    // Le plus récent (plus petite distance en bougies)
    return candidats.reduce((meilleur, cand) => cand.distanceBougies < meilleur.distanceBougies ? cand : meilleur, candidats[0]);
  }

  // Par défaut : 'SCORE_OPTIMAL' (meilleure note globale)
  return candidats.reduce((meilleur, cand) => cand.scoreAdequation > meilleur.scoreAdequation ? cand : meilleur, candidats[0]);
}

/**
 * Indicateur combiné : Détecte le setup à 2 bougies (Liquidation & Réintégration)
 * ET sélectionne précisément la liquidité la plus adaptée (BSL ou SSL)
 * basée sur la proportionnalité, le relief du pivot et la proximité.
 * 
 * Exemple :
 * const res = calculerLiquidationSweepCombo(bougies, { modeSelectionLiquidite: 'SCORE_OPTIMAL' });
 * console.log(`Nombre de signaux avec sweep adapté : ${res.statistiques.totalLiquiditesBalayees}`);
 */
export function calculerLiquidationSweepCombo(
  bougies: Bougie[],
  options?: ParametresLiquidationSweepCombo
): ResultatLiquidationSweepCombo {
  // 1️⃣ Vérification minimale des données
  if (!bougies || bougies.length < 5) {
    return {
      signaux: [],
      primitives: { labels: [], lignes: [], boites: [], points: [] },
      statistiques: {
        totalSignaux: 0,
        totalAchats: 0,
        totalVentes: 0,
        totalLiquiditesBalayees: 0,
        totalAchatsAvecSweep: 0,
        totalVentesAvecSweep: 0,
        totalNiveauxMajeurs: 0,
        totalNiveauxMoyens: 0,
        totalNiveauxMineurs: 0,
        scoreMoyenAdequation: 0,
      },
    };
  }

  // 2️⃣ Extraction et normalisation des paramètres
  const params = options || {};
  const valDeficit = params.toleranceDeficit !== undefined ? params.toleranceDeficit : 0.05;
  const toleranceDeficit = valDeficit > 1 ? valDeficit / 100 : valDeficit;

  const valDepassement = params.toleranceDepassement !== undefined ? params.toleranceDepassement : 0.25;
  const toleranceDepassement = valDepassement > 1 ? valDepassement / 100 : valDepassement;

  const modeSelection = params.modeSelectionLiquidite || 'SCORE_OPTIMAL';
  const sensibiliteLiquidite = Math.max(2, Number(params.sensibilitePivotLiquidite ?? 3));
  const lookbackLiquidite = Math.max(10, Number(params.lookbackLiquidite ?? 80));
  const distanceMinBougies = Math.max(1, Number(params.distanceMinBougies ?? 3));
  const exigerLiquidite = params.exigerLiquiditeBalayee !== false;

  const reliefMinPivot = Math.max(0.1, Number(params.reliefMinPivot ?? 0.5));
  const penetrationMaxRatio = Math.max(0.5, Number(params.penetrationMaxRatio ?? 1.5));
  const penetrationMinRatio = Math.max(0.01, Number(params.penetrationMinRatio ?? 0.05));
  const exigerNiveauIntact = params.exigerNiveauIntact !== false;

  const activerFiltreTaille = params.activerFiltreTaille !== false;
  const periodeHistorique = Math.max(3, Number(params.periodeHistorique ?? 10));
  const multiplicateurBougie1 = Math.max(0.5, Number(params.multiplicateurBougie1 ?? 1.75));
  const multiplicateurCorps2 = Math.max(0.5, Number(params.multiplicateurCorps2 ?? 1.75));

  const activerAchat = params.activerAchat !== false;
  const activerVente = params.activerVente !== false;
  const activerFiltreTendance = Boolean(params.activerFiltreTendance);
  const trendBars = Math.max(1, Number(params.trendBars ?? 5));

  const afficherLignes = params.afficherLigneLiquidite !== false;
  // Par défaut false : l'utilisateur préfère un segment en ligne discontinue plutôt qu'une zone en rectangle
  const afficherZones = Boolean(params.afficherZoneSweep);
  const afficherBadgeScore = params.afficherBadgeScore !== false;
  const bullColor = params.bullColor || '#00E676';
  const bearColor = params.bearColor || '#F23645';
  const texteLabel = params.texteLabel || 'Liq/Reint';

  const signaux: SignalLiquidationSweepCombo[] = [];
  const labels: VisualLabel[] = [];
  const lignes: VisualLine[] = [];
  const boites: VisualBox[] = [];
  const points: VisualPoint[] = [];

  let countAchats = 0;
  let countVentes = 0;
  let countAchatsSweep = 0;
  let countVentesSweep = 0;
  let countMajeurs = 0;
  let countMoyens = 0;
  let countMineurs = 0;
  let sommeScores = 0;

  // 3️⃣ Parcours des bougies pour détecter le setup de réintégration (i-1 et i)
  for (let i = 1; i < bougies.length; i++) {
    const b1 = bougies[i - 1];
    const b2 = bougies[i];

    const range1 = b1.high - b1.low;
    const range2 = b2.high - b2.low;
    const corps2 = Math.abs(b2.open - b2.close);
    const hauteurMoyenne = (range1 + range2) / 2;
    if (hauteurMoyenne <= 0) continue;

    // Filtre de tendance optionnel
    const idxTrend = Math.max(0, i - trendBars);
    const openTrend = bougies[idxTrend].open;
    const tendanceHausse = !activerFiltreTendance || openTrend < b2.open;
    const tendanceBaisse = !activerFiltreTendance || openTrend > b2.open;

    // Candidats achat/vente
    const estCandidatAchat = activerAchat && (b1.close < b1.open) && (b2.close > b2.open) && tendanceBaisse;
    const estCandidatVente = activerVente && (b1.close > b1.open) && (b2.close < b2.open) && tendanceHausse;
    if (!estCandidatAchat && !estCandidatVente) continue;

    // Proximité asymétrique
    const ecartPrix = Math.abs(b1.open - b2.close);
    const ratioEcart = ecartPrix / hauteurMoyenne;
    let situationCloture: 'DEPASSEMENT' | 'RETRAIT' = 'RETRAIT';
    let estValideProximite = false;

    if (estCandidatAchat) {
      if (b2.close >= b1.open) {
        situationCloture = 'DEPASSEMENT';
        estValideProximite = ratioEcart <= toleranceDepassement;
      } else {
        situationCloture = 'RETRAIT';
        estValideProximite = ratioEcart <= toleranceDeficit;
      }
    } else if (estCandidatVente) {
      if (b2.close <= b1.open) {
        situationCloture = 'DEPASSEMENT';
        estValideProximite = ratioEcart <= toleranceDepassement;
      } else {
        situationCloture = 'RETRAIT';
        estValideProximite = ratioEcart <= toleranceDeficit;
      }
    }
    if (!estValideProximite) continue;

    // Moyenne de référence historique
    let moyenneRangeRef = hauteurMoyenne;
    let respecteTaille = true;

    if (activerFiltreTaille) {
      const indexFinHist = i - 2;
      const indexDebutHist = Math.max(0, i - 1 - periodeHistorique);
      const nbBougiesHist = indexFinHist - indexDebutHist + 1;

      if (nbBougiesHist >= 3) {
        let sommeRanges = 0;
        let sommeCorps = 0;
        for (let k = indexDebutHist; k <= indexFinHist; k++) {
          sommeRanges += (bougies[k].high - bougies[k].low);
          sommeCorps += Math.abs(bougies[k].open - bougies[k].close);
        }
        const moyRange = sommeRanges / nbBougiesHist;
        const moyCorps = sommeCorps / nbBougiesHist;
        moyenneRangeRef = moyRange;

        const b1AssezGrande = range1 >= (multiplicateurBougie1 * moyRange);
        const corps2AssezGrand = corps2 >= (multiplicateurCorps2 * moyCorps);
        respecteTaille = b1AssezGrande && corps2AssezGrand;
      }
    }
    if (!respecteTaille) continue;

    // 4️⃣ Identification de la bougie portant le point extrême de liquidation
    let prixExtreme = 0;
    let bougieExtreme: 1 | 2 = 1;
    const indexFinRecherche = i - 2;

    if (estCandidatAchat) {
      if (b2.low <= b1.low) {
        prixExtreme = b2.low;
        bougieExtreme = 2;
      } else {
        prixExtreme = b1.low;
        bougieExtreme = 1;
      }

      // 5️⃣ Recherche de la liquidité vendeuse (SSL) la plus adaptée
      const liquiditeTrouvee = trouverLiquiditeLaPlusAdaptee(
        bougies,
        'ACHAT',
        prixExtreme,
        indexFinRecherche,
        i,
        sensibiliteLiquidite,
        lookbackLiquidite,
        distanceMinBougies,
        reliefMinPivot,
        penetrationMaxRatio,
        penetrationMinRatio,
        exigerNiveauIntact,
        modeSelection,
        Math.max(b1.open, b1.high),
        b1.low,
        moyenneRangeRef
      );

      // Si l'utilisateur exige une liquidité valide et qu'aucune n'a été retenue
      if (exigerLiquidite && !liquiditeTrouvee) continue;

      if (liquiditeTrouvee) {
        countAchatsSweep++;
        sommeScores += liquiditeTrouvee.scoreAdequation;
        if (liquiditeTrouvee.qualiteNiveau === 'MAJEUR') countMajeurs++;
        else if (liquiditeTrouvee.qualiteNiveau === 'MOYEN') countMoyens++;
        else countMineurs++;
      }
      countAchats++;

      // Enregistrement du signal
      signaux.push({
        type: 'ACHAT',
        indexBougie: i,
        temps: b2.time,
        prixSignal: b2.low,
        prixExtreme,
        bougieExtreme,
        open1: b1.open,
        close2: b2.close,
        ecartPrix,
        ratioEcart,
        situationCloture,
        rangeBougie1: range1,
        corpsBougie2: corps2,
        liquidite: liquiditeTrouvee ?? undefined,
      });

      // 6️⃣ Rendu Visuel : Label avec badge de pertinence
      let badgeQualite = '';
      if (liquiditeTrouvee && afficherBadgeScore) {
        const tagQualite = liquiditeTrouvee.qualiteNiveau === 'MAJEUR' ? ' ★' : '';
        badgeQualite = ` [${liquiditeTrouvee.scoreAdequation}%${tagQualite}]`;
      }

      const texteAffiche = liquiditeTrouvee
        ? `${texteLabel}${badgeQualite}\nSweep SSL (${liquiditeTrouvee.prix.toFixed(4)})`
        : texteLabel;

      labels.push({
        id: `combo-achat-lbl-${i}`,
        prix: b2.low,
        date: b2.time,
        texte: texteAffiche,
        couleur: bullColor,
        position: 'below',
      });

      // Point discret au creux extrême de liquidation
      points.push({
        id: `combo-pt-bas-${i}`,
        prix: prixExtreme,
        date: bougieExtreme === 1 ? b1.time : b2.time,
        couleur: bullColor,
      });

      // Ligne principale reliant le pivot d'origine jusqu'au setup
      if (liquiditeTrouvee && afficherLignes) {
        lignes.push({
          id: `combo-ligne-ssl-${i}`,
          prix: liquiditeTrouvee.prix,
          dateDebut: liquiditeTrouvee.tempsOrigine,
          dateFin: b2.time,
          couleur: bullColor,
          epaisseur: 1.5,
          style: 'dashed',
          label: `SSL Balayée (${liquiditeTrouvee.qualiteNiveau} -${(liquiditeTrouvee.profondeurSweep * 10000).toFixed(1)}p)`,
        });
      }

      // Boîte visuelle mettant en valeur la zone de sweep
      if (liquiditeTrouvee && afficherZones) {
        boites.push({
          id: `combo-zone-sweep-achat-${i}`,
          prixHaut: liquiditeTrouvee.prix,
          prixBas: prixExtreme,
          dateDebut: b1.time,
          dateFin: b2.time,
          couleurFond: 'rgba(0, 230, 118, 0.15)',
          couleurBordure: bullColor,
          label: `Zone Sweep (${liquiditeTrouvee.scoreAdequation}%)`,
        });
      }

    } else if (estCandidatVente) {
      if (b2.high >= b1.high) {
        prixExtreme = b2.high;
        bougieExtreme = 2;
      } else {
        prixExtreme = b1.high;
        bougieExtreme = 1;
      }

      // Recherche de la liquidité acheteuse (BSL) la plus adaptée
      const liquiditeTrouvee = trouverLiquiditeLaPlusAdaptee(
        bougies,
        'VENTE',
        prixExtreme,
        indexFinRecherche,
        i,
        sensibiliteLiquidite,
        lookbackLiquidite,
        distanceMinBougies,
        reliefMinPivot,
        penetrationMaxRatio,
        penetrationMinRatio,
        exigerNiveauIntact,
        modeSelection,
        b1.high,
        Math.min(b1.open, b1.low),
        moyenneRangeRef
      );

      if (exigerLiquidite && !liquiditeTrouvee) continue;

      if (liquiditeTrouvee) {
        countVentesSweep++;
        sommeScores += liquiditeTrouvee.scoreAdequation;
        if (liquiditeTrouvee.qualiteNiveau === 'MAJEUR') countMajeurs++;
        else if (liquiditeTrouvee.qualiteNiveau === 'MOYEN') countMoyens++;
        else countMineurs++;
      }
      countVentes++;

      signaux.push({
        type: 'VENTE',
        indexBougie: i,
        temps: b2.time,
        prixSignal: b2.high,
        prixExtreme,
        bougieExtreme,
        open1: b1.open,
        close2: b2.close,
        ecartPrix,
        ratioEcart,
        situationCloture,
        rangeBougie1: range1,
        corpsBougie2: corps2,
        liquidite: liquiditeTrouvee ?? undefined,
      });

      let badgeQualite = '';
      if (liquiditeTrouvee && afficherBadgeScore) {
        const tagQualite = liquiditeTrouvee.qualiteNiveau === 'MAJEUR' ? ' ★' : '';
        badgeQualite = ` [${liquiditeTrouvee.scoreAdequation}%${tagQualite}]`;
      }

      const texteAffiche = liquiditeTrouvee
        ? `${texteLabel}${badgeQualite}\nSweep BSL (${liquiditeTrouvee.prix.toFixed(4)})`
        : texteLabel;

      labels.push({
        id: `combo-vente-lbl-${i}`,
        prix: b2.high,
        date: b2.time,
        texte: texteAffiche,
        couleur: bearColor,
        position: 'above',
      });

      points.push({
        id: `combo-pt-haut-${i}`,
        prix: prixExtreme,
        date: bougieExtreme === 1 ? b1.time : b2.time,
        couleur: bearColor,
      });

      if (liquiditeTrouvee && afficherLignes) {
        lignes.push({
          id: `combo-ligne-bsl-${i}`,
          prix: liquiditeTrouvee.prix,
          dateDebut: liquiditeTrouvee.tempsOrigine,
          dateFin: b2.time,
          couleur: bearColor,
          epaisseur: 1.5,
          style: 'dashed',
          label: `BSL Balayée (${liquiditeTrouvee.qualiteNiveau} +${(liquiditeTrouvee.profondeurSweep * 10000).toFixed(1)}p)`,
        });
      }

      if (liquiditeTrouvee && afficherZones) {
        boites.push({
          id: `combo-zone-sweep-vente-${i}`,
          prixHaut: prixExtreme,
          prixBas: liquiditeTrouvee.prix,
          dateDebut: b1.time,
          dateFin: b2.time,
          couleurFond: 'rgba(242, 54, 69, 0.15)',
          couleurBordure: bearColor,
          label: `Zone Sweep (${liquiditeTrouvee.scoreAdequation}%)`,
        });
      }
    }
  }

  const totalAvecSweep = countAchatsSweep + countVentesSweep;
  const scoreMoyen = totalAvecSweep > 0 ? Math.round(sommeScores / totalAvecSweep) : 0;

  return {
    signaux,
    primitives: {
      labels,
      lignes,
      boites,
      points,
    },
    statistiques: {
      totalSignaux: signaux.length,
      totalAchats: countAchats,
      totalVentes: countVentes,
      totalLiquiditesBalayees: totalAvecSweep,
      totalAchatsAvecSweep: countAchatsSweep,
      totalVentesAvecSweep: countVentesSweep,
      totalNiveauxMajeurs: countMajeurs,
      totalNiveauxMoyens: countMoyens,
      totalNiveauxMineurs: countMineurs,
      scoreMoyenAdequation: scoreMoyen,
    },
  };
}
