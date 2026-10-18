import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLabel, VisualLine } from '@/types/indicatorScript';
import {
  calculerShvedSupplyDemand,
  type ZoneShved,
} from '@/lib/bot/modules/01_liquidite/shvedSupplyDemand';

/**
 * ==============================================================================
 * 🌟 SANDBOX MODULAIRE : DOJI LIQ/REINT + S/R SHVED (PLAGE CIBLÉE)
 * ==============================================================================
 * Cet indicateur est structuré en DEUX BLOCS AUTONOMES ET ÉTANCHES :
 * 
 * 🧩 BLOC 1 : MOTEUR DOJI PERSONNALISÉ & PLAGE CIBLÉE
 *    - Détecte les retournements de liquidation (Spring à l'Achat / UTAD à la Vente).
 *    - Détermine la fenêtre temporelle ciblée vers l'extrême précédent.
 *    - Peut être utilisé seul ou par le Chef d'Orchestre !
 * 
 * 🧩 BLOC 2 : MOTEUR S/R SHVED & SCORING DE LIQUIDITÉ
 *    - Épuration totale : filtre par sens (Supports pour Achat, Résistances pour Vente).
 *    - Vérifie que les niveaux débutent et se terminent strictement dans la plage.
 *    - Calcule le score de liquidité sur 100 points (Retests, Rejets, Proportion).
 *    - Filtre le Top N (Top 1, Top 3, Top 5...).
 * 
 * 🔗 BLOC 3 : ORCHESTRATEUR DE LA SANDBOX
 *    - Connecte simplement le Bloc 1 au Bloc 2 et trace les visuels (segments & labels).
 * ==============================================================================
 */

// ─── 📊 Types et Interfaces de Configuration ──────────────────────────────────

export interface ParametresSandboxDojiShvedPlage {
  // ─── 🕯️ Réglages du Doji Personnalisé (Liq / Reint) ───
  toleranceDeficit?: number;         // Tolérance de déficit (défaut: 0.30 = 30% du range moyen)
  toleranceDepassement?: number;     // Tolérance de dépassement favorable (défaut: 2.0 = 200%)
  activerFiltreTaille?: boolean;     // Exige des bougies supérieures à la moyenne (défaut: true)
  periodeHistorique?: number;        // Nombre de bougies pour la moyenne de taille (défaut: 10)
  multiplicateurBougie1?: number;    // Multiplicateur bougie 1 de liquidation (défaut: 1.0x)
  multiplicateurCorps2?: number;     // Multiplicateur corps de bougie 2 (défaut: 1.2x)
  activerAchat?: boolean;            // Autorise les signaux d'achat (Spring) (défaut: true)
  activerVente?: boolean;            // Autorise les signaux de vente (UTAD) (défaut: true)

  // ─── ⏱️ Multi-Timeframe (MTF) & Paramètres Shved ───
  timeframeSource?: string;          // Unité de temps Shved (ex: 'M15', 'ACTUEL', défaut: 'M15')
  donneesM1?: Bougie[];              // Bougies M1 pour le calcul MTF
  chartTimeframe?: string;           // Unité de temps du graphique actuel
  periodeATR?: number;               // ATR pour l'épaisseur des zones Shved (défaut: 15)
  zoneFuzzFactor?: number;           // Facteur d'épaisseur Shved (défaut: 0.1)
  minRetests?: number;               // Nombre minimum de retests Shved (défaut: 0 = accepte tout)
  afficherNiveauxCasses?: boolean;   // Inclut aussi les niveaux déjà cassés (défaut: true)

  // ─── 🎯 Plage Temporelle Ciblée & Épuration Totale ───
  maxReculRecherche?: number;        // Nombre max de bougies de recul pour trouver l'extrême précédent (défaut: 100)
  exigerDebutEtFinDansPlage?: boolean; // Épuration totale : début ET fin du S/R dans la plage (défaut: true)
  filtrerParDirectionSetup?: boolean; // Supports pour Achat, Résistances pour Vente (défaut: true)

  // ─── 🏆 Score de Liquidité & Filtrage Top N ───
  topNiveauxScore?: number;          // Nombre max de S/R à afficher selon le score (défaut: 3, 0 = tout afficher)
  scoreMinimum?: number;             // Seuil minimal de score (0 à 100) (défaut: 0)
  afficherScoreSurLigne?: boolean;   // Affiche le score sur le segment (ex: "Sup [85 pts]") (défaut: true)

  // ─── 🎨 Visuels & Segments Continues / Discontinues ───
  styleLignesSupport?: 'dashed' | 'solid';    // Style des lignes de Support (défaut: 'dashed')
  styleLignesResistance?: 'dashed' | 'solid'; // Style des lignes de Résistance (défaut: 'dashed')
  epaisseurLignes?: number;                   // Épaisseur des segments (défaut: 2)
  bornerALaPlage?: boolean;                   // Limiter la ligne aux bornes temporelles de la plage (défaut: true)

  bullColor?: string;                // Couleur Achat / Support (défaut: '#00E676')
  bearColor?: string;                // Couleur Vente / Résistance (défaut: '#F23645')
  texteLabel?: string;               // Texte du signal (défaut: 'Liq/Reint')
}

/**
 * Signal brut produit par le BLOC 1 (Moteur Doji Personnalisé & Plage Ciblée)
 */
export interface SignalDojiAvecPlage {
  type: 'ACHAT' | 'VENTE';
  indexBougie: number;
  temps: number | string;
  prixExtreme: number;
  open1: number;
  close2: number;
  tailleLiquidation: number;
  indexDebutPlage: number;
  tempsDebutPlage: number | string;
  prixExtremePrecedent: number;
  moyenneHauteur: number;
}

/**
 * Zone Shved évaluée et scorée par le BLOC 2 (Moteur Shved S/R)
 */
export interface ZoneShvedAvecScore {
  zone: ZoneShved;
  score: number;             // Score global sur 100 points
  retestsAvant: number;      // Retests survenus strictement avant le Doji
  rejetMoyen: number;        // Amplitude moyenne des rejets de la zone
  ratioProportion: number;   // Ratio taille bougie 1 / rejet moyen
  pointsRetests: number;     // Points attribués aux retests (max 35)
  pointsRejets: number;      // Points attribués à la hauteur de la montagne (max 30)
  pointsProportionnalite: number; // Points attribués à la proportionnalité (max 25)
  pointsIntegrite: number;   // Points bonus intégrité (max 10)
}

/**
 * Signal combiné complet de la Sandbox avec les niveaux Shved associés
 */
export interface SignalSandboxPlage {
  type: 'ACHAT' | 'VENTE';
  indexBougie: number;
  temps: number | string;
  prixExtreme: number;
  open1: number;
  close2: number;
  indexDebutPlage: number;
  tempsDebutPlage: number | string;
  prixExtremePrecedent: number;
  nombreNiveauxDansPlage: number;
  meilleurScore?: number;
  scoresNiveauxDansPlage?: number[];
  niveauxShved?: ZoneShvedAvecScore[];
}

export interface ResultatSandboxDojiShvedPlage {
  signaux: SignalSandboxPlage[];
  primitives: VisualPrimitives;
  statistiques: {
    totalSignaux: number;
    totalAchats: number;
    totalVentes: number;
  };
}

// ─── 🛠️ Fonctions Utilitaires Temporelles ──────────────────────────────────────

/**
 * Convertit un timestamp (nombre ou string ISO) en millisecondes pour comparaison linéaire
 * Exemple : convertirTempsEnMs(1727200000) -> 1727200000000
 */
export function convertirTempsEnMs(temps: number | string): number {
  if (typeof temps === 'number') {
    return temps > 10000000000 ? temps : temps * 1000;
  }
  return new Date(temps).getTime();
}

// ==============================================================================
// 🧩 BLOC 1 : MOTEUR DOJI PERSONNALISÉ & PLAGE CIBLÉE
// ==============================================================================

/**
 * Vérifie de façon linéaire si deux bougies consécutives forment un Doji personnalisé valide.
 * - Bougie 1 : Impulsion de liquidation (mèche / prise de liquidité)
 * - Bougie 2 : Réintégration du niveau d'ouverture de Bougie 1
 * 
 * Exemple :
 * const verif = verifierDojiSimple(b1, b2, 2.5, 1.2, options);
 * if (verif.estValide) console.log('Doji détecté :', verif.type);
 */
export function verifierDojiSimple(
  b1: Bougie,
  b2: Bougie,
  moyenneHauteur: number,
  moyenneCorps: number,
  options: {
    activerAchat: boolean;
    activerVente: boolean;
    activerFiltreTaille: boolean;
    multiplicateurBougie1: number;
    multiplicateurCorps2: number;
    toleranceDeficit: number;
    toleranceDepassement: number;
  }
): { estValide: boolean; type: 'ACHAT' | 'VENTE'; prixExtreme: number } {
  const range1 = b1.high - b1.low;
  const corps1 = Math.abs(b1.open - b1.close);
  const range2 = b2.high - b2.low;
  const corps2 = Math.abs(b2.open - b2.close);
  const hauteurMoyenneDoji = (range1 + range2) / 2;

  const echec = { estValide: false, type: 'ACHAT' as const, prixExtreme: 0 };
  if (hauteurMoyenneDoji <= 0) return echec;

  // 1. Sens opposés des deux bougies
  // Achat (Spring) : B1 baissière (rouge) + B2 haussière (verte)
  const estCandidatAchat = options.activerAchat && (b1.close < b1.open) && (b2.close > b2.open);
  // Vente (UTAD)   : B1 haussière (verte) + B2 baissière (rouge)
  const estCandidatVente = options.activerVente && (b1.close > b1.open) && (b2.close < b2.open);

  if (!estCandidatAchat && !estCandidatVente) return echec;
  const typeSignal: 'ACHAT' | 'VENTE' = estCandidatAchat ? 'ACHAT' : 'VENTE';

  // 2. Précision de la réintégration (Close2 rejoint le cours d'Open1)
  const ecartPrix = Math.abs(b1.open - b2.close);
  const ratioEcart = ecartPrix / hauteurMoyenneDoji;

  if (typeSignal === 'ACHAT') {
    if (b2.close >= b1.open) {
      if (ratioEcart > options.toleranceDepassement) return echec;
    } else {
      if (ratioEcart > options.toleranceDeficit) return echec;
    }
  } else {
    if (b2.close <= b1.open) {
      if (ratioEcart > options.toleranceDepassement) return echec;
    } else {
      if (ratioEcart > options.toleranceDeficit) return echec;
    }
  }

  // 3. Filtre de taille par rapport à la moyenne récente
  if (options.activerFiltreTaille) {
    if (range1 < options.multiplicateurBougie1 * moyenneHauteur) return echec;
    if (corps2 < options.multiplicateurCorps2 * moyenneCorps) return echec;
  }

  const prixExtreme = typeSignal === 'ACHAT'
    ? Math.min(b1.low, b2.low)
    : Math.max(b1.high, b2.high);

  return { estValide: true, type: typeSignal, prixExtreme };
}

/**
 * Recherche dans le passé la bougie ayant créé le plus bas (Achat) ou le plus haut (Vente)
 * précédent, marquant ainsi le début de la "Plage Temporelle Ciblée".
 * 
 * Exemple :
 * const repere = trouverBougieExtremePrecedente(bougies, indexDoji, 'ACHAT', prixPlusBas, 80);
 */
export function trouverBougieExtremePrecedente(
  bougies: Bougie[],
  indexDoji: number,
  typeSignal: 'ACHAT' | 'VENTE',
  prixExtremeDoji: number,
  maxRecul: number
): { index: number; temps: number | string; prix: number } {
  const debutScan = Math.max(0, indexDoji - 2);
  const finScan = Math.max(0, indexDoji - 2 - maxRecul);

  if (typeSignal === 'ACHAT') {
    // Achat : on cherche la bougie antérieure dont le Low <= Low du Doji
    for (let k = debutScan; k >= finScan; k--) {
      if (bougies[k].low <= prixExtremeDoji) {
        return { index: k, temps: bougies[k].time, prix: bougies[k].low };
      }
    }
    // Sinon, on prend le plus bas de la fenêtre scrutée
    let plusBasIndex = debutScan;
    let plusBasPrix = bougies[debutScan]?.low ?? prixExtremeDoji;
    for (let k = debutScan; k >= finScan; k--) {
      if (bougies[k].low < plusBasPrix) {
        plusBasPrix = bougies[k].low;
        plusBasIndex = k;
      }
    }
    return { index: plusBasIndex, temps: bougies[plusBasIndex].time, prix: plusBasPrix };
  } else {
    // Vente : on cherche la bougie antérieure dont le High >= High du Doji
    for (let k = debutScan; k >= finScan; k--) {
      if (bougies[k].high >= prixExtremeDoji) {
        return { index: k, temps: bougies[k].time, prix: bougies[k].high };
      }
    }
    // Sinon, on prend le plus haut de la fenêtre scrutée
    let plusHautIndex = debutScan;
    let plusHautPrix = bougies[debutScan]?.high ?? prixExtremeDoji;
    for (let k = debutScan; k >= finScan; k--) {
      if (bougies[k].high > plusHautPrix) {
        plusHautPrix = bougies[k].high;
        plusHautIndex = k;
      }
    }
    return { index: plusHautIndex, temps: bougies[plusHautIndex].time, prix: plusHautPrix };
  }
}

/**
 * 🌟 FONCTION PRINCIPALE DU BLOC 1 : Détecte tous les Dojis et calcule leur plage temporelle.
 * Cette fonction est 100% autonome et peut être appelée directement par le Chef d'Orchestre !
 * 
 * Exemple :
 * const dojis = detecterDojisAvecPlage(bougies, { maxReculRecherche: 100 });
 * console.log('Nombre de Dojis trouvés :', dojis.length);
 */
export function detecterDojisAvecPlage(
  bougies: Bougie[],
  options: {
    activerAchat?: boolean;
    activerVente?: boolean;
    activerFiltreTaille?: boolean;
    periodeHistorique?: number;
    multiplicateurBougie1?: number;
    multiplicateurCorps2?: number;
    toleranceDeficit?: number;
    toleranceDepassement?: number;
    maxReculRecherche?: number;
  } = {}
): SignalDojiAvecPlage[] {
  const resultats: SignalDojiAvecPlage[] = [];
  if (!bougies || bougies.length < 10) return resultats;

  const activerAchat = options.activerAchat !== false;
  const activerVente = options.activerVente !== false;
  const activerFiltreTaille = options.activerFiltreTaille !== false;
  const periodeHistorique = Math.max(3, Number(options.periodeHistorique ?? 10));
  const multiplicateurBougie1 = Number(options.multiplicateurBougie1 ?? 1.0);
  const multiplicateurCorps2 = Number(options.multiplicateurCorps2 ?? 1.2);
  const toleranceDeficit = Number(options.toleranceDeficit ?? 0.30);
  const toleranceDepassement = Number(options.toleranceDepassement ?? 2.0);
  const maxReculRecherche = Math.max(10, Number(options.maxReculRecherche ?? 100));

  for (let i = 2; i < bougies.length; i++) {
    const b1 = bougies[i - 1];
    const b2 = bougies[i];

    // Calcul de la taille moyenne des bougies sur l'historique récent
    const indexDebutRef = Math.max(0, i - 1 - periodeHistorique);
    let sommeHauteurs = 0;
    let sommeCorps = 0;
    let countRef = 0;
    for (let k = indexDebutRef; k < i - 1; k++) {
      sommeHauteurs += (bougies[k].high - bougies[k].low);
      sommeCorps += Math.abs(bougies[k].open - bougies[k].close);
      countRef++;
    }
    const moyHauteur = countRef > 0 ? (sommeHauteurs / countRef) : (b1.high - b1.low);
    const moyCorps = countRef > 0 ? (sommeCorps / countRef) : Math.abs(b1.open - b1.close);

    // Vérification du Doji
    const verification = verifierDojiSimple(b1, b2, moyHauteur, moyCorps, {
      activerAchat,
      activerVente,
      activerFiltreTaille,
      multiplicateurBougie1,
      multiplicateurCorps2,
      toleranceDeficit,
      toleranceDepassement,
    });

    if (!verification.estValide) continue;

    // Détermination de la bougie extrême précédente (début de la plage ciblée)
    const extremePrecedent = trouverBougieExtremePrecedente(
      bougies,
      i,
      verification.type,
      verification.prixExtreme,
      maxReculRecherche
    );

    // Taille de la liquidation (Bougie 1)
    const tailleLiquidation = verification.type === 'ACHAT'
      ? Math.abs(b1.open - b1.low)
      : Math.abs(b1.high - b1.open);

    resultats.push({
      type: verification.type,
      indexBougie: i,
      temps: b2.time,
      prixExtreme: verification.prixExtreme,
      open1: b1.open,
      close2: b2.close,
      tailleLiquidation,
      indexDebutPlage: extremePrecedent.index,
      tempsDebutPlage: extremePrecedent.temps,
      prixExtremePrecedent: extremePrecedent.prix,
      moyenneHauteur: moyHauteur,
    });
  }

  return resultats;
}

// ==============================================================================
// 🧩 BLOC 2 : MOTEUR S/R SHVED & SCORING DE LIQUIDITÉ DANS LA PLAGE
// ==============================================================================

/**
 * Compte les retests d'une zone Shved survenus strictement avant une date donnée.
 */
export function compterRetestsAvant(zone: ZoneShved, tempsDojiMs: number): number {
  if (zone.datesTouches && zone.datesTouches.length > 0) {
    let compteur = 0;
    for (const t of zone.datesTouches) {
      if (convertirTempsEnMs(t) < tempsDojiMs) {
        compteur++;
      }
    }
    return compteur;
  }
  return zone.retests;
}

/**
 * Calcule le score de liquidité institutionnelle sur 100 points pour un niveau Shved.
 *  1. Retests (max 35 pts)
 *  2. Rejets / Hauteur de la montagne (max 30 pts)
 *  3. Proportionnalité liquidation Doji / rejet (max 25 pts)
 *  4. Intégrité de la zone (max 10 pts)
 * 
 * Exemple :
 * const scoreZone = calculerScoreZoneShved(zone, bougies, indexB1, tempsB1, tailleLiq, moyHauteur);
 * console.log('Score :', scoreZone.score);
 */
export function calculerScoreZoneShved(
  zone: ZoneShved,
  bougies: Bougie[],
  indexBougie1: number,
  tempsBougie1: number | string,
  tailleLiquidation: number,
  tailleMoyenneBougie: number
): ZoneShvedAvecScore {
  const tempsBougie1Ms = convertirTempsEnMs(tempsBougie1);

  // 1️⃣ Retests survenus strictement avant le Doji
  const retestsAvant = compterRetestsAvant(zone, tempsBougie1Ms);

  let pointsRetests = 5;
  if (retestsAvant >= 3) {
    pointsRetests = 35;
  } else if (retestsAvant === 2) {
    pointsRetests = 25;
  } else if (retestsAvant === 1) {
    pointsRetests = 15;
  }

  // 2️⃣ Amplitude moyenne des rejets ("hauteur de la montagne")
  const indexDepart = Math.max(0, zone.indexOrigine);
  let sommetMax = zone.prixMedian;
  let creuxMin = zone.prixMedian;

  const finIndex = Math.min(bougies.length - 1, indexBougie1);
  for (let j = indexDepart; j <= finIndex; j++) {
    if (bougies[j].high > sommetMax) sommetMax = bougies[j].high;
    if (bougies[j].low < creuxMin) creuxMin = bougies[j].low;
  }

  const hauteurTotaleRejet = zone.type === 'SUPPORT'
    ? (sommetMax - zone.prixMedian)
    : (zone.prixMedian - creuxMin);

  const rejetMoyen = Math.max(0.0001, hauteurTotaleRejet / Math.max(1, retestsAvant));
  const ratioRejetMoyen = rejetMoyen / Math.max(0.0001, tailleMoyenneBougie);

  let pointsRejets = 10;
  if (ratioRejetMoyen >= 2.5) {
    pointsRejets = 30;
  } else if (ratioRejetMoyen >= 1.0) {
    pointsRejets = 20;
  }

  // 3️⃣ Proportionnalité de la liquidation (Taille Bougie 1 vs Rejet Moyen)
  const ratioProportion = tailleLiquidation / Math.max(0.0001, rejetMoyen);

  let pointsProportionnalite = 5;
  if (ratioProportion >= 0.20 && ratioProportion <= 0.80) {
    pointsProportionnalite = 25;
  } else if (ratioProportion >= 0.10 && ratioProportion <= 1.20) {
    pointsProportionnalite = 15;
  }

  // 4️⃣ Intégrité de la zone (intacte avant le Doji)
  const estIntacteAvant = !zone.estCassee || (zone.dateFin ? convertirTempsEnMs(zone.dateFin) >= tempsBougie1Ms : true);
  const pointsIntegrite = estIntacteAvant ? 10 : 0;

  // 5️⃣ Score total sur 100 points
  const score = Math.min(100, Math.round(pointsRetests + pointsRejets + pointsProportionnalite + pointsIntegrite));

  return {
    zone,
    score,
    retestsAvant,
    rejetMoyen,
    ratioProportion,
    pointsRetests,
    pointsRejets,
    pointsProportionnalite,
    pointsIntegrite,
  };
}

/**
 * 🌟 FONCTION PRINCIPALE DU BLOC 2 : Évalue, filtre et classe les zones Shved
 * strictement dans la plage temporelle d'un signal Doji donné.
 * 
 * Cette fonction est 100% autonome et peut être appelée directement par le Chef d'Orchestre !
 * 
 * Exemple :
 * const zonesScorees = evaluerNiveauxShvedDansPlage(toutesLesZones, signalDoji, bougies, { topN: 3 });
 */
export function evaluerNiveauxShvedDansPlage(
  toutesLesZonesShved: ZoneShved[],
  signalDoji: SignalDojiAvecPlage,
  bougies: Bougie[],
  options: {
    filtrerParDirectionSetup?: boolean;
    exigerDebutEtFinDansPlage?: boolean;
    afficherNiveauxCasses?: boolean;
    scoreMinimum?: number;
    topNiveauxScore?: number;
  } = {}
): ZoneShvedAvecScore[] {
  const filtrerParDirectionSetup = options.filtrerParDirectionSetup !== false;
  const exigerDebutEtFinDansPlage = options.exigerDebutEtFinDansPlage !== false;
  const afficherNiveauxCasses = options.afficherNiveauxCasses !== false;
  const scoreMinimum = Math.max(0, Number(options.scoreMinimum ?? 0));
  const topNiveauxScore = Math.max(0, Number(options.topNiveauxScore ?? 3));

  const tempsDebutPlageMs = convertirTempsEnMs(signalDoji.tempsDebutPlage);
  const tempsFinPlageMs = convertirTempsEnMs(signalDoji.temps);

  // 🎯 Règle directionnelle : Supports pour Achat, Résistances pour Vente
  const typeZoneCible = signalDoji.type === 'ACHAT' ? 'SUPPORT' : 'RESISTANCE';

  const zonesDansPlage: ZoneShvedAvecScore[] = [];

  for (const zone of toutesLesZonesShved) {
    // 1. Filtrage strict par sens
    if (filtrerParDirectionSetup && zone.type !== typeZoneCible) {
      continue;
    }

    // 2. Gestion des zones cassées
    if (zone.estCassee && !afficherNiveauxCasses) continue;

    const dateDebutZoneMs = convertirTempsEnMs(zone.dateDebut);
    const dateFinZoneMs = convertirTempsEnMs(zone.dateFin);

    // 3. Épuration totale : début ET fin compris dans la plage temporelle
    const debutComprisDansPlage = dateDebutZoneMs >= tempsDebutPlageMs && dateDebutZoneMs <= tempsFinPlageMs;
    const finCompriseDansPlage = dateFinZoneMs >= tempsDebutPlageMs && dateFinZoneMs <= tempsFinPlageMs;

    const estDansPlage = exigerDebutEtFinDansPlage
      ? (debutComprisDansPlage && finCompriseDansPlage)
      : (dateDebutZoneMs <= tempsFinPlageMs && dateFinZoneMs >= tempsDebutPlageMs);

    if (estDansPlage) {
      // 4. Calcul du score de liquidité sur 100 points
      const indexBougie1 = signalDoji.indexBougie - 1;
      const evalScore = calculerScoreZoneShved(
        zone,
        bougies,
        indexBougie1,
        bougies[indexBougie1].time,
        signalDoji.tailleLiquidation,
        signalDoji.moyenneHauteur
      );

      if (evalScore.score >= scoreMinimum) {
        zonesDansPlage.push(evalScore);
      }
    }
  }

  // 5. Tri décroissant par score (les zones institutionnelles les plus solides en premier)
  zonesDansPlage.sort((a, b) => b.score - a.score);

  // 6. Filtrage Top N (Top 1, Top 3, etc.)
  return topNiveauxScore > 0 ? zonesDansPlage.slice(0, topNiveauxScore) : zonesDansPlage;
}

// ==============================================================================
// 🔗 BLOC 3 : ORCHESTRATEUR DE LA SANDBOX (ASSEMBLAGE & VISUELS)
// ==============================================================================

/**
 * Fonction maîtresse qui assemble les deux briques :
 *  1️⃣ Appelle le BLOC 1 pour détecter les Dojis et calculer les plages.
 *  2️⃣ Appelle le BLOC 2 pour filtrer et scorer les niveaux Shved dans chaque plage.
 *  3️⃣ Génère les segments graphiques (continus / pointillés) et les étiquettes.
 * 
 * Exemple d'utilisation :
 * const res = calculerSandboxDojiShvedPlage(bougies, { topNiveauxScore: 3 });
 */
export function calculerSandboxDojiShvedPlage(
  bougies: Bougie[],
  parametres: ParametresSandboxDojiShvedPlage = {}
): ResultatSandboxDojiShvedPlage {
  const labels: VisualLabel[] = [];
  const lignes: VisualLine[] = [];

  const resultatVide: ResultatSandboxDojiShvedPlage = {
    signaux: [],
    primitives: { labels, lignes, boites: [], points: [] },
    statistiques: { totalSignaux: 0, totalAchats: 0, totalVentes: 0 },
  };

  if (!bougies || bougies.length < 10) return resultatVide;

  // Options visuelles
  const bullColor = parametres.bullColor || '#00E676';
  const bearColor = parametres.bearColor || '#F23645';
  const texteLabel = parametres.texteLabel || 'Liq/Reint';
  const styleLignesSupport = parametres.styleLignesSupport || 'dashed';
  const styleLignesResistance = parametres.styleLignesResistance || 'dashed';
  const epaisseurLignes = Number(parametres.epaisseurLignes ?? 2);
  const bornerALaPlage = parametres.bornerALaPlage !== false;
  const afficherScoreSurLigne = parametres.afficherScoreSurLigne !== false;

  // 1️⃣ Calcul des Niveaux Shved sur l'historique
  const resultatShved = calculerShvedSupplyDemand(bougies, {
    timeframeSource: parametres.timeframeSource || 'M15',
    donneesM1: parametres.donneesM1,
    chartTimeframe: parametres.chartTimeframe,
    supprimerZonesCassees: false,
    afficherNonRetestees: true,
    afficherFaibles: true,
    minRetests: Math.max(0, Number(parametres.minRetests ?? 0)),
    periodeATR: parametres.periodeATR ?? 15,
    zoneFuzzFactor: parametres.zoneFuzzFactor ?? 0.1,
    maxLookbackBars: 250,
    afficherZones: false,
    afficherLignes: false,
    afficherEtiquettes: false,
  });

  const toutesLesZonesShved: ZoneShved[] = [
    ...resultatShved.supports,
    ...resultatShved.resistances,
  ];

  // 2️⃣ Exécution du BLOC 1 : Détection des Dojis et des plages temporelles
  const signauxDojis = detecterDojisAvecPlage(bougies, parametres);

  const signauxComplets: SignalSandboxPlage[] = [];
  let totalAchats = 0;
  let totalVentes = 0;

  // 3️⃣ Exécution du BLOC 2 pour chaque signal détecté
  for (const signalDoji of signauxDojis) {
    const estAchat = signalDoji.type === 'ACHAT';
    if (estAchat) totalAchats++;
    else totalVentes++;

    // Évaluation des zones Shved dans la plage du Doji
    const zonesSelectionnees = evaluerNiveauxShvedDansPlage(
      toutesLesZonesShved,
      signalDoji,
      bougies,
      parametres
    );

    const tempsDebutPlageMs = convertirTempsEnMs(signalDoji.tempsDebutPlage);
    const tempsFinPlageMs = convertirTempsEnMs(signalDoji.temps);

    // Tracé des segments Shved pour le Top retenu
    for (const item of zonesSelectionnees) {
      const zone = item.zone;
      const estSupport = zone.type === 'SUPPORT';
      const couleurLigne = estSupport ? bullColor : bearColor;
      const styleChoisi = estSupport ? styleLignesSupport : styleLignesResistance;

      const dateDebutZoneMs = convertirTempsEnMs(zone.dateDebut);
      const dateFinZoneMs = convertirTempsEnMs(zone.dateFin);

      // Borner le segment dans la fenêtre temporelle ciblée
      const dateDebutTracé = bornerALaPlage
        ? (dateDebutZoneMs < tempsDebutPlageMs ? signalDoji.tempsDebutPlage : zone.dateDebut)
        : zone.dateDebut;

      const dateFinTracé = bornerALaPlage
        ? (dateFinZoneMs > tempsFinPlageMs ? signalDoji.temps : zone.dateFin)
        : zone.dateFin;

      const labelLigne = afficherScoreSurLigne
        ? `${estSupport ? 'Sup' : 'Res'} [${item.score} pts]`
        : undefined;

      lignes.push({
        id: `sandbox-sr-${zone.id}-doji-${signalDoji.indexBougie}`,
        prix: zone.prixMedian,
        dateDebut: dateDebutTracé,
        dateFin: dateFinTracé,
        couleur: couleurLigne,
        epaisseur: epaisseurLignes,
        style: styleChoisi,
        label: labelLigne,
      });
    }

    // Étiquette du Doji avec le meilleur score
    const couleurSignal = estAchat ? bullColor : bearColor;
    const typeSRAffiche = estAchat ? 'Sup' : 'Res';
    const meilleurScore = zonesSelectionnees.length > 0 ? zonesSelectionnees[0].score : undefined;
    const texteScore = meilleurScore !== undefined ? ` • [Top: ${meilleurScore}pts]` : '';

    const labelTexte = zonesSelectionnees.length > 0
      ? `${texteLabel}\n(${zonesSelectionnees.length} ${typeSRAffiche}${texteScore})`
      : texteLabel;

    labels.push({
      id: `sandbox-doji-lbl-${signalDoji.indexBougie}`,
      prix: signalDoji.prixExtreme,
      date: signalDoji.temps,
      texte: labelTexte,
      couleur: couleurSignal,
      position: estAchat ? 'below' : 'above',
    });

    signauxComplets.push({
      type: signalDoji.type,
      indexBougie: signalDoji.indexBougie,
      temps: signalDoji.temps,
      prixExtreme: signalDoji.prixExtreme,
      open1: signalDoji.open1,
      close2: signalDoji.close2,
      indexDebutPlage: signalDoji.indexDebutPlage,
      tempsDebutPlage: signalDoji.tempsDebutPlage,
      prixExtremePrecedent: signalDoji.prixExtremePrecedent,
      nombreNiveauxDansPlage: zonesSelectionnees.length,
      meilleurScore,
      scoresNiveauxDansPlage: zonesSelectionnees.map(z => z.score),
      niveauxShved: zonesSelectionnees,
    });
  }

  return {
    signaux: signauxComplets,
    primitives: { labels, lignes, boites: [], points: [] },
    statistiques: {
      totalSignaux: signauxComplets.length,
      totalAchats,
      totalVentes,
    },
  };
}
