import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLabel, VisualLine } from '@/types/indicatorScript';
import {
  calculerShvedSupplyDemand,
  type ZoneShved,
} from '@/lib/bot/modules/01_liquidite/shvedSupplyDemand';
import {
  calculerZigZag,
  type PivotZigZag,
} from '../zigzag';

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
  periodeATR?: number;               // ATR pour l'épaisseur des zones Shved (défaut: 2)
  zoneFuzzFactor?: number;           // Facteur d'épaisseur Shved (défaut: 0.01)
  minRetests?: number;               // Nombre minimum de retests Shved (défaut: 0 = accepte tout)
  afficherNiveauxCasses?: boolean;   // Inclut aussi les niveaux déjà cassés (défaut: true)

  // ─── 🎯 Plage Temporelle Ciblée & Épuration Totale ───
  maxReculRecherche?: number;        // Nombre max de bougies de recul pour trouver l'extrême précédent (défaut: 100)
  exigerDebutEtFinDansPlage?: boolean; // Épuration totale : début ET fin du S/R dans la plage (défaut: true)
  filtrerParDirectionSetup?: boolean; // Supports pour Achat, Résistances pour Vente (défaut: true)
  sectionnerNiveauxAnterieurs?: boolean; // Sectionne les niveaux antérieurs ayant des retests dans la plage (défaut: true)

  // ─── 🏆 Score de Liquidité & Filtrage Top N ───
  topNiveauxScore?: number;          // Nombre max de S/R à afficher selon le score (défaut: 3, 0 = tout afficher)
  scoreMinimum?: number;             // Seuil minimal de score (0 à 100) (défaut: 0)
  afficherScoreSurLigne?: boolean;   // Affiche le score sur le segment (ex: "Sup [85 pts]") (défaut: true)

  // ─── 🎨 Visuels & Segments Continues / Discontinues ───
  styleLignesSupport?: 'dashed' | 'solid';    // Style des lignes de Support (défaut: 'dashed')
  styleLignesResistance?: 'dashed' | 'solid'; // Style des lignes de Résistance (défaut: 'dashed')
  epaisseurLignes?: number;                   // Épaisseur des segments (défaut: 2)
  bornerALaPlage?: boolean;                   // Limiter la ligne aux bornes temporelles de la plage (défaut: true)

  // ─── 📐 Filtre ZigZag & Extrême de Vague ───
  activerFiltreZigzag?: boolean;       // Filtre les Dojis par la dernière vague ZigZag (défaut: true)
  profondeurZigzag?: number;           // Profondeur de calcul des pivots ZigZag (défaut: 5)
  afficherLignesZigzag?: boolean;      // Affiche les segments ZigZag sur le graphique (défaut: false)
  couleurZigzag?: string;              // Couleur des segments ZigZag (défaut: '#FFA726')

  bullColor?: string;                // Couleur Achat / Support (défaut: '#00E676')
  bearColor?: string;                // Couleur Vente / Résistance (défaut: '#F23645')
  texteLabel?: string;               // Texte du signal (défaut: 'Liq/Reint')
}

/**
 * Informations de validation et de contexte de la vague ZigZag associée à un signal
 */
export interface InfoValidationZigzag {
  estValide: boolean;
  motif: string;
  directionVague: 'HAUSSIERE' | 'BAISSIERE';
  pivotDepartIndex: number;
  pivotDepartPrix: number;
  pivotDepartTemps: number | string;
  prixExtremeVague: number;
  prixExtremeDoji: number;
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
  infoZigzag?: InfoValidationZigzag;
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
  estRetenue?: boolean;      // Est-ce le niveau gagnant retenu par l'algorithme ?
  motifSelection?: string;   // Explication pédagogique pour le diagnostic
  estStrictementDansPlage?: boolean; // Début ET fin situés à l'intérieur de la plage
  estSectionnee?: boolean;   // Vrai si le niveau a été sectionné pour la plage (Option A + 1)
  retestsLocaux?: number;    // Nombre de touches survenues à l'intérieur de la plage
}

/**
 * Signal combiné complet de la Sandbox avec les niveaux Shved associés
 */
export interface SignalSandboxPlage {
  id?: string;               // Identifiant unique du signal pour le diagnostic
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
  infoZigzag?: InfoValidationZigzag;
  // 🔍 Diagnostic interactif complet :
  toutesZonesCandidates?: ZoneShvedAvecScore[]; // Tous les S/R du sens présents dans la plage
  zoneRetenue?: ZoneShvedAvecScore | null;       // La zone sélectionnée comme étant la meilleure
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
 * Vérifie si le Doji personnalisé valide les critères de la vague ZigZag :
 * 
 * 1. Règle du sens de la vague (Trading de retournement à l'épuisement) :
 *    - Setup ACHAT (Spring) : La dernière vague ZigZag doit être BAISSIÈRE (venant d'un sommet).
 *    - Setup VENTE (UTAD) : La dernière vague ZigZag doit être HAUSSIÈRE (venant d'un creux).
 * 
 * 2. Règle de l'extrême absolu de la vague :
 *    - Setup ACHAT : Le plus bas de toute la vague doit correspondre au Low du Doji (B1 ou B2).
 *    - Setup VENTE : Le plus haut de toute la vague doit correspondre au High du Doji (B1 ou B2).
 * 
 * Exemple :
 * const verif = validerDojiAvecZigzag(pivotsZigzag, bougies, indexBougie2, 'ACHAT');
 * if (!verif.estValide) console.log(verif.motif);
 */
export function validerDojiAvecZigzag(
  pivotsZigzag: PivotZigZag[],
  bougies: Bougie[],
  indexBougie2: number,
  typeSetup: 'ACHAT' | 'VENTE'
): {
  estValide: boolean;
  motif: string;
  directionVague?: 'HAUSSIERE' | 'BAISSIERE';
  pivotDepart?: PivotZigZag;
  prixExtremeVague?: number;
  prixExtremeDoji?: number;
} {
  const indexB1 = indexBougie2 - 1;
  const b1 = bougies[indexB1];
  const b2 = bougies[indexBougie2];

  if (!b1 || !b2) {
    return { estValide: false, motif: 'Bougies du Doji introuvables' };
  }

  // 1️⃣ Trouver le dernier pivot ZigZag strictement antérieur au Doji (avant b1)
  let dernierPivot: PivotZigZag | null = null;
  for (let k = pivotsZigzag.length - 1; k >= 0; k--) {
    if (pivotsZigzag[k].index < indexB1) {
      dernierPivot = pivotsZigzag[k];
      break;
    }
  }

  // Si aucun pivot antérieur n'est trouvé (début d'historique), on valide
  if (!dernierPivot) {
    return { estValide: true, motif: "Aucun pivot ZigZag antérieur (début d'historique)" };
  }

  // Si le dernier pivot est un sommet (estHaut = true), la vague descend vers le Doji -> Vague BAISSIÈRE
  // Si le dernier pivot est un creux (estHaut = false), la vague monte vers le Doji -> Vague HAUSSIÈRE
  const directionVague: 'HAUSSIERE' | 'BAISSIERE' = dernierPivot.estHaut ? 'BAISSIERE' : 'HAUSSIERE';

  // 2️⃣ Règle 1 : Contrôle du sens de la vague
  if (typeSetup === 'ACHAT' && directionVague !== 'BAISSIERE') {
    return {
      estValide: false,
      motif: 'Rejeté par ZigZag : la vague en cours est HAUSSIÈRE (seuls les setups Vente sont autorisés)',
      directionVague,
      pivotDepart: dernierPivot,
    };
  }

  if (typeSetup === 'VENTE' && directionVague !== 'HAUSSIERE') {
    return {
      estValide: false,
      motif: 'Rejeté par ZigZag : la vague en cours est BAISSIÈRE (seuls les setups Achat sont autorisés)',
      directionVague,
      pivotDepart: dernierPivot,
    };
  }

  // 3️⃣ Règle 2 : Le Doji doit former l'extrême absolu de toute la vague
  const indexDepart = dernierPivot.index;
  const margeFlottante = 1e-6;

  if (typeSetup === 'ACHAT') {
    // Vague baissière : recherche du Low le plus bas sur toute la vague [indexDepart -> indexBougie2]
    let plusBasVague = Infinity;
    for (let k = indexDepart; k <= indexBougie2; k++) {
      if (bougies[k].low < plusBasVague) {
        plusBasVague = bougies[k].low;
      }
    }

    const plusBasDoji = Math.min(b1.low, b2.low);
    const estExtremeDoji = (plusBasDoji <= plusBasVague + margeFlottante);

    if (!estExtremeDoji) {
      return {
        estValide: false,
        motif: `Rejeté par ZigZag : le Low du Doji (${plusBasDoji}) n'est pas le plus bas absolu de la vague (${plusBasVague})`,
        directionVague,
        pivotDepart: dernierPivot,
        prixExtremeVague: plusBasVague,
        prixExtremeDoji: plusBasDoji,
      };
    }

    return {
      estValide: true,
      motif: `✅ Validé par ZigZag : creux ultime de la vague baissière (${plusBasDoji})`,
      directionVague,
      pivotDepart: dernierPivot,
      prixExtremeVague: plusBasVague,
      prixExtremeDoji: plusBasDoji,
    };
  } else {
    // Vague haussière : recherche du High le plus haut sur toute la vague [indexDepart -> indexBougie2]
    let plusHautVague = -Infinity;
    for (let k = indexDepart; k <= indexBougie2; k++) {
      if (bougies[k].high > plusHautVague) {
        plusHautVague = bougies[k].high;
      }
    }

    const plusHautDoji = Math.max(b1.high, b2.high);
    const estExtremeDoji = (plusHautDoji >= plusHautVague - margeFlottante);

    if (!estExtremeDoji) {
      return {
        estValide: false,
        motif: `Rejeté par ZigZag : le High du Doji (${plusHautDoji}) n'est pas le plus haut absolu de la vague (${plusHautVague})`,
        directionVague,
        pivotDepart: dernierPivot,
        prixExtremeVague: plusHautVague,
        prixExtremeDoji: plusHautDoji,
      };
    }

    return {
      estValide: true,
      motif: `✅ Validé par ZigZag : sommet ultime de la vague haussière (${plusHautDoji})`,
      directionVague,
      pivotDepart: dernierPivot,
      prixExtremeVague: plusHautVague,
      prixExtremeDoji: plusHautDoji,
    };
  }
}

/**
 * 🌟 FONCTION PRINCIPALE DU BLOC 1 : Détecte tous les Dojis et calcule leur plage temporelle.
 * Cette fonction est 100% autonome et peut être appelée directement par le Chef d'Orchestre !
 * 
 * Exemple :
 * const dojis = detecterDojisAvecPlage(bougies, { maxReculRecherche: 100, activerFiltreZigzag: true });
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
    activerFiltreZigzag?: boolean;
    profondeurZigzag?: number;
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
  const activerFiltreZigzag = options.activerFiltreZigzag !== false;
  const profondeurZigzag = Math.max(2, Number(options.profondeurZigzag ?? 5));

  // 1️⃣ Calcul préalable du ZigZag si le filtre est actif
  const pivotsZigzag = (activerFiltreZigzag && bougies.length >= profondeurZigzag * 2)
    ? calculerZigZag(bougies, { depth: profondeurZigzag }).pivots
    : [];

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

    // 2️⃣ Validation par la vague ZigZag (Filtre Direction + Extrême de vague)
    let infoZigzag: InfoValidationZigzag | undefined = undefined;
    if (activerFiltreZigzag && pivotsZigzag.length > 0) {
      const verifZigzag = validerDojiAvecZigzag(pivotsZigzag, bougies, i, verification.type);
      if (!verifZigzag.estValide) {
        continue; // Écarté par le filtre ZigZag !
      }
      infoZigzag = {
        estValide: true,
        motif: verifZigzag.motif,
        directionVague: verifZigzag.directionVague!,
        pivotDepartIndex: verifZigzag.pivotDepart!.index,
        pivotDepartPrix: verifZigzag.pivotDepart!.prix,
        pivotDepartTemps: verifZigzag.pivotDepart!.temps,
        prixExtremeVague: verifZigzag.prixExtremeVague!,
        prixExtremeDoji: verifZigzag.prixExtremeDoji!,
      };
    }

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
      infoZigzag,
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
 * Extrait les horodatages des retests d'une zone Shved survenus
 * strictement à l'intérieur de la plage temporelle ciblée.
 * 
 * Exemple :
 * const touches = obtenirTouchesDansPlage(zone, bougies, indexDebutPlage, indexFinPlage, tempsDebutMs, tempsFinMs);
 * console.log('Nombre de touches dans la plage :', touches.length);
 */
export function obtenirTouchesDansPlage(
  zone: ZoneShved,
  bougies: Bougie[],
  indexDebutPlage: number,
  indexFinPlage: number,
  tempsDebutPlageMs: number,
  tempsFinPlageMs: number
): (number | string)[] {
  // 1️⃣ Si Shved a déjà enregistré les dates précises des retests
  if (zone.datesTouches && zone.datesTouches.length > 0) {
    const touchesDansFenetre = zone.datesTouches.filter((t) => {
      const tMs = convertirTempsEnMs(t);
      return tMs >= tempsDebutPlageMs && tMs <= tempsFinPlageMs;
    });
    if (touchesDansFenetre.length > 0) {
      return touchesDansFenetre;
    }
  }

  // 2️⃣ Analyse directe sur les bougies de la plage (sécurité et précision)
  const touchesDirectes: (number | string)[] = [];
  const debut = Math.max(0, indexDebutPlage);
  const fin = Math.min(bougies.length - 1, indexFinPlage);
  let dernierIndexTouche = -999;

  for (let k = debut; k <= fin; k++) {
    const b = bougies[k];
    // Le prix entre dans la zone de support ou résistance
    if (b.low <= zone.prixHaut && b.high >= zone.prixBas) {
      // On respecte un intervalle de 2 bougies pour distinguer deux retests séparés
      if (k - dernierIndexTouche >= 2) {
        touchesDirectes.push(b.time);
        dernierIndexTouche = k;
      }
    }
  }

  return touchesDirectes;
}

/**
 * Sectionne une zone Shved qui a débuté avant notre plage temporelle.
 * 
 * - Option A : Le segment démarre pile au début de la plage temporelle (creux/sommet antérieur).
 * - Option 1 : Ne comptabilise que les retests survenus à l'intérieur de la plage.
 * 
 * Exemple :
 * const zoneSectionnee = sectionnerZoneShvedDansPlage(zone, signalDoji, bougies);
 */
export function sectionnerZoneShvedDansPlage(
  zone: ZoneShved,
  signalDoji: SignalDojiAvecPlage,
  bougies: Bougie[]
): ZoneShved | null {
  const tempsDebutPlageMs = convertirTempsEnMs(signalDoji.tempsDebutPlage);
  const indexBougie1 = signalDoji.indexBougie - 1;
  const tempsBougie1Ms = convertirTempsEnMs(bougies[indexBougie1]?.time ?? signalDoji.temps);

  // 1️⃣ Recherche des touches réelles à l'intérieur de la plage
  const touchesDansPlage = obtenirTouchesDansPlage(
    zone,
    bougies,
    signalDoji.indexDebutPlage,
    indexBougie1,
    tempsDebutPlageMs,
    tempsBougie1Ms
  );

  // Si le niveau n'a pas été touché dans la plage, on ne le sectionne pas
  if (touchesDansPlage.length === 0) {
    return null;
  }

  // 2️⃣ Création du nouveau niveau sectionné
  // Option A : Date de début = tempsDebutPlage (début de la plage)
  // Option 1 : Retests = nombre de touches locales dans la plage
  const zoneSectionnee: ZoneShved = {
    ...zone,
    id: `${zone.id}-sectionne-${signalDoji.indexDebutPlage}`,
    dateDebut: signalDoji.tempsDebutPlage,
    indexOrigine: signalDoji.indexDebutPlage,
    retests: touchesDansPlage.length,
    datesTouches: touchesDansPlage,
    estFaible: false,
  };

  return zoneSectionnee;
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
    sectionnerNiveauxAnterieurs?: boolean;
    scoreMinimum?: number;
    topNiveauxScore?: number;
  } = {}
): ZoneShvedAvecScore[] {
  const filtrerParDirectionSetup = options.filtrerParDirectionSetup !== false;
  const exigerDebutEtFinDansPlage = options.exigerDebutEtFinDansPlage !== false;
  const afficherNiveauxCasses = options.afficherNiveauxCasses !== false;
  const sectionnerNiveauxAnterieurs = options.sectionnerNiveauxAnterieurs !== false;
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

    // 3. Détection de la position temporelle de la zone
    const debutComprisDansPlage = dateDebutZoneMs >= tempsDebutPlageMs && dateDebutZoneMs <= tempsFinPlageMs;
    const finCompriseDansPlage = dateFinZoneMs >= tempsDebutPlageMs && dateFinZoneMs <= tempsFinPlageMs;

    let zoneAEvaluer: ZoneShved | null = null;
    let estSectionnee = false;

    if (debutComprisDansPlage && finCompriseDansPlage) {
      // Cas 1 : Zone née directement à l'intérieur de la plage
      zoneAEvaluer = zone;
    } else if (dateDebutZoneMs < tempsDebutPlageMs && dateFinZoneMs >= tempsDebutPlageMs) {
      // Cas 2 : Zone née dans le passé lointain mais traversant notre plage
      if (sectionnerNiveauxAnterieurs) {
        // ✂️ Option A (débute au début de la plage) + Option 1 (retests uniquement dans la plage)
        const zoneSectionnee = sectionnerZoneShvedDansPlage(zone, signalDoji, bougies);
        if (zoneSectionnee) {
          zoneAEvaluer = zoneSectionnee;
          estSectionnee = true;
        }
      } else if (!exigerDebutEtFinDansPlage) {
        zoneAEvaluer = zone;
      }
    } else if (!exigerDebutEtFinDansPlage && (dateDebutZoneMs <= tempsFinPlageMs && dateFinZoneMs >= tempsDebutPlageMs)) {
      // Mode permissif sans sectionnement
      zoneAEvaluer = zone;
    }

    if (zoneAEvaluer) {
      // 4. Calcul du score de liquidité sur 100 points
      const indexBougie1 = signalDoji.indexBougie - 1;
      const evalScore = calculerScoreZoneShved(
        zoneAEvaluer,
        bougies,
        indexBougie1,
        bougies[indexBougie1].time,
        signalDoji.tailleLiquidation,
        signalDoji.moyenneHauteur
      );

      evalScore.estSectionnee = estSectionnee;
      if (estSectionnee) {
        evalScore.retestsLocaux = zoneAEvaluer.retests;
      }

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

  // 0️⃣ Tracé optionnel des segments ZigZag sur le graphique
  const afficherLignesZigzag = Boolean(parametres.afficherLignesZigzag);
  const couleurZigzag = parametres.couleurZigzag || '#FFA726';
  const profondeurZigzag = Math.max(2, Number(parametres.profondeurZigzag ?? 5));

  if (afficherLignesZigzag && bougies.length >= profondeurZigzag * 2) {
    const resZigzag = calculerZigZag(bougies, { depth: profondeurZigzag });
    if (resZigzag.pivots && resZigzag.pivots.length >= 2) {
      for (let k = 1; k < resZigzag.pivots.length; k++) {
        const p1 = resZigzag.pivots[k - 1];
        const p2 = resZigzag.pivots[k];
        lignes.push({
          id: `sandbox-zigzag-${k}`,
          prix: p1.prix,
          prixFin: p2.prix,
          dateDebut: p1.temps,
          dateFin: p2.temps,
          couleur: couleurZigzag,
          epaisseur: 2,
          style: 'solid',
        });
      }
    }
  }

  // 1️⃣ Calcul des Niveaux Shved sur l'historique
  const resultatShved = calculerShvedSupplyDemand(bougies, {
    timeframeSource: parametres.timeframeSource || 'M15',
    donneesM1: parametres.donneesM1,
    chartTimeframe: parametres.chartTimeframe,
    supprimerZonesCassees: false,
    afficherNonRetestees: true,
    afficherFaibles: true,
    minRetests: Math.max(0, Number(parametres.minRetests ?? 0)),
    periodeATR: parametres.periodeATR ?? 2,
    zoneFuzzFactor: parametres.zoneFuzzFactor ?? 0.01,
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

    // Évaluation des zones Shved dans la plage du Doji (Filtre Top N standard)
    const zonesSelectionnees = evaluerNiveauxShvedDansPlage(
      toutesLesZonesShved,
      signalDoji,
      bougies,
      parametres
    );

    const tempsDebutPlageMs = convertirTempsEnMs(signalDoji.tempsDebutPlage);
    const tempsFinPlageMs = convertirTempsEnMs(signalDoji.temps);

    // 🔍 NOUVEAU DIAGNOSTIC INTERACTIF : Récupération de TOUS les supports (Achat) ou résistances (Vente) dans la plage
    const typeZoneCible = estAchat ? 'SUPPORT' : 'RESISTANCE';
    const toutesZonesCandidates: ZoneShvedAvecScore[] = [];
    const sectionnerAnterieurs = parametres.sectionnerNiveauxAnterieurs !== false;

    for (const zone of toutesLesZonesShved) {
      // 1. Règle directionnelle stricte conservée : Supports pour Achat, Résistances pour Vente
      if (zone.type !== typeZoneCible) continue;

      const dateDebutZoneMs = convertirTempsEnMs(zone.dateDebut);
      const dateFinZoneMs = convertirTempsEnMs(zone.dateFin);

      // Présente dans la plage : chevauchement temporel avec la fenêtre ciblée
      const chevauchePlage = (dateDebutZoneMs <= tempsFinPlageMs && dateFinZoneMs >= tempsDebutPlageMs);
      if (!chevauchePlage) continue;

      const debutCompris = dateDebutZoneMs >= tempsDebutPlageMs && dateDebutZoneMs <= tempsFinPlageMs;
      const finComprise = dateFinZoneMs >= tempsDebutPlageMs && dateFinZoneMs <= tempsFinPlageMs;

      let zoneAEvaluer: ZoneShved = zone;
      let estSectionnee = false;
      let estStrictementDansPlage = debutCompris && finComprise;

      // ✂️ Si la zone est née avant la plage temporelle mais traverse notre fenêtre
      if (dateDebutZoneMs < tempsDebutPlageMs && sectionnerAnterieurs) {
        const zoneSectionnee = sectionnerZoneShvedDansPlage(zone, signalDoji, bougies);
        if (zoneSectionnee) {
          zoneAEvaluer = zoneSectionnee;
          estSectionnee = true;
          estStrictementDansPlage = true; // Démarre au début de la plage par construction (Option A)
        }
      }

      // Calcul du score de liquidité sur 100 points
      const indexBougie1 = signalDoji.indexBougie - 1;
      const evalScore = calculerScoreZoneShved(
        zoneAEvaluer,
        bougies,
        indexBougie1,
        bougies[indexBougie1].time,
        signalDoji.tailleLiquidation,
        signalDoji.moyenneHauteur
      );

      toutesZonesCandidates.push({
        ...evalScore,
        estStrictementDansPlage,
        estSectionnee,
        retestsLocaux: estSectionnee ? zoneAEvaluer.retests : undefined,
      });
    }

    // Tri de toutes les candidates par score décroissant
    toutesZonesCandidates.sort((a, b) => b.score - a.score);

    // Identifier la zone gagnante retenue selon les critères actuels du système
    const zoneRetenue = zonesSelectionnees.length > 0 ? zonesSelectionnees[0] : null;

    // Déterminer pour chaque candidate son statut et son motif explicatif
    const exigerStrict = parametres.exigerDebutEtFinDansPlage !== false;
    const scoreMin = Math.max(0, Number(parametres.scoreMinimum ?? 0));
    const accepterCassees = parametres.afficherNiveauxCasses !== false;

    for (const cand of toutesZonesCandidates) {
      if (zoneRetenue && cand.zone.id === zoneRetenue.zone.id) {
        cand.estRetenue = true;
        cand.motifSelection = cand.estSectionnee
          ? `⭐ Niveau retenu (Sectionné dans la plage, ${cand.score}/100 pts)`
          : `⭐ Meilleur niveau retenu (${cand.score}/100 pts)`;
      } else {
        cand.estRetenue = false;
        if (exigerStrict && !cand.estStrictementDansPlage) {
          cand.motifSelection = "Écarté : déborde hors de la plage sans retest local dans la fenêtre";
        } else if (!accepterCassees && cand.zone.estCassee) {
          cand.motifSelection = "Écarté : zone déjà brisée avant la survenue du Doji";
        } else if (cand.score < scoreMin) {
          cand.motifSelection = `Écarté : score de ${cand.score} pts inférieur au seuil minimal (${scoreMin} pts)`;
        } else if (zoneRetenue) {
          cand.motifSelection = cand.estSectionnee
            ? `Écarté : niveau sectionné (${cand.score} pts, ${cand.retestsLocaux ?? cand.retestsAvant} touches locales) inférieur au niveau retenu (${zoneRetenue.score} pts)`
            : `Écarté : score de ${cand.score} pts inférieur au niveau retenu (${zoneRetenue.score} pts)`;
        } else {
          cand.motifSelection = "Écarté par le tri";
        }
      }
    }

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

      const badgeSection = item.estSectionnee ? ' ✂️' : '';
      const labelLigne = afficherScoreSurLigne
        ? `${estSupport ? 'Sup' : 'Res'} [${item.score} pts]${badgeSection}`
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
      id: `sandbox-signal-${signalDoji.indexBougie}`,
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
      infoZigzag: signalDoji.infoZigzag,
      toutesZonesCandidates,
      zoneRetenue,
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
