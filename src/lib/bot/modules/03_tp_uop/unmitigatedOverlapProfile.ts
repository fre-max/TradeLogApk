import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives } from '@/types/indicatorScript';
import { determinerStepPrix, type PointZigZag } from '@/lib/indicators/unmitigatedVolumeProfile';

// ─── 📊 Structures et Types de Données ────────────────────────────────────────

/**
 * Palier horizontal de prix mesurant le nombre réel de bougies qui l'ont chevauché
 * dans le cadre d'une vague ZigZag individuelle
 */
export interface PalierChevauchement {
  price: number;               // Prix central du palier
  nbBougiesChevauchement: number; // Nombre de bougies ayant traversé ce palier (mesure directe du trafic)
  pourcentageChevauchement: number; // Pourcentage par rapport au total des bougies de la vague
  isMitigated: boolean;        // Vrai si revisité ultérieurement par une bougie postérieure
  indexDernierPassage: number; // Index de la dernière bougie ayant touché ce palier
}

/**
 * Palier résultant de la SUPERPOSITION de plusieurs vagues ZigZag
 * (vagues précédentes + vague courante).
 * C'est cette cartographie superposée qui sert de fondation au calcul du TP Optimal !
 */
export interface PalierSuperpositionVagues {
  prix: number;               // Niveau de prix du palier
  sommeBougies: number;       // Cumul de bougies ayant traversé ce palier sur toutes les vagues superposées
  nbVagues: number;           // Nombre de vagues distinctes ayant traversé ce niveau
  vaguesIndices: number[];    // Numéros d'ordre des vagues ayant contribué à ce palier
  tauxMoyenBougies: number;   // Moyenne de bougies par vague sur ce niveau
  estBleuFonce: boolean;      // Vrai si le palier a atteint le seuil fort de chevauchement / Sweep (barre bleu foncé)
  isMitigated: boolean;       // Vrai si revisité ultérieurement après sa création
}

/**
 * Plage de prix continue où le taux de chevauchement est uniforme (régulier)
 */
export interface PlagePrixUniforme {
  id: string;
  prixBas: number;             // Niveau de prix plancher
  prixHaut: number;            // Niveau de prix plafond
  hauteur: number;             // Amplitude en points
  tauxMoyenBougies: number;    // Taux moyen de bougies par palier (ex: 4.2 bougies)
  nbPaliers: number;           // Nombre de paliers consécutifs composant la plage
  estNonMitigee: boolean;      // Vrai si toute la plage est restée vierge
  tempsDebut: number | string;
  tempsFin: number | string;
}

/**
 * Vague structurelle avec profil de chevauchement horizontal
 */
export interface VagueOverlapProfile {
  id: number;
  indexDebut: number;
  indexFin: number;
  tempsDebut: number | string;
  tempsFin: number | string;
  prixDebut: number;
  prixFin: number;
  estHaussiere: boolean;
  totalBougiesVague: number;
  paliers: PalierChevauchement[];
  maxBougiesChevauchement: number;
  totalNiveauxNonMitigues: number;
  plagesUniformes: PlagePrixUniforme[];
}

/**
 * Niveau ouvert non mitigué prolongé vers la droite
 */
export interface NiveauOuvertUOP {
  price: number;
  nbBougiesChevauchement: number;
  vagueId: number;
  estHaussiere: boolean;
  tempsDebut: number | string;
  tempsFin: number | string;
}

/**
 * Tronçon goudronné individuel (zone bleu foncé continue) utilisé dans le calcul du TP Optimal.
 * Sert au mode debug pour montrer à l'utilisateur quelles parties bleu foncé ont été cumulées.
 * 
 * Exemple : un tronçon AB allant de 1.0800 à 1.0820 avec 5 paliers et 18 bougies cumulées.
 */
export interface DebugTronconTP {
  prixBas: number;       // Limite basse du tronçon bleu foncé
  prixHaut: number;      // Limite haute du tronçon bleu foncé
  hauteur: number;       // Amplitude en points (prixHaut - prixBas)
  nbPaliers: number;     // Nombre de paliers consécutifs dans ce tronçon
  sommeBougies: number;  // Cumul de bougies de chevauchement dans ce tronçon
  lettre: string;        // Identifiant séquentiel : 'A', 'B', 'C', 'D', ...
}

/**
 * Trou entre deux tronçons goudronnés, avec le ratio de tolérance calculé.
 * Permet à l'utilisateur de voir si le trou a été absorbé (ratio <= seuil) ou s'il a coupé le TP.
 */
export interface DebugTrouTP {
  prixBas: number;       // Limite basse du trou (zone non bleu foncé)
  prixHaut: number;      // Limite haute du trou
  hauteur: number;       // Amplitude du trou en points
  ratioPourcent: number; // Pourcentage du trou par rapport au total (goudron + trou)
  estAbsorbe: boolean;   // Vrai si le trou a été toléré (<= seuil), faux s'il a coupé la route
}

/**
 * Données de debug complètes pour UN TP Optimal (Achat ou Vente).
 * Contient la liste ordonnée des tronçons goudronnés et des trous,
 * permettant de reconstruire visuellement toute la logique de cumul.
 */
export interface DebugTPOptimal {
  troncons: DebugTronconTP[];  // Tous les tronçons bleu foncé cumulés pour ce TP
  trous: DebugTrouTP[];       // Tous les trous entre tronçons (absorbés ou non)
  cumulGoudronTotal: number;  // Hauteur totale des parties goudronnées (AB + CD + ...)
  prixBas: number;            // Limite basse de toute la zone analysée
  prixHaut: number;           // Limite haute de toute la zone analysée
}

/**
 * Cible de Take Profit Optimal (TPO) calculée à partir de la superposition des vagues
 */
export interface TPOptimalUOP {
  id: string;
  type: 'achat' | 'vente';
  prixCible: number;               // Niveau de prix du Take Profit optimal
  prixDepart: number;              // Prix actuel au moment du calcul
  amplitudePoints: number;         // Distance entre prix actuel et TP
  hauteurZoneUniforme: number;     // Hauteur du couloir uniforme superposé exploité
  tauxMoyenChevauchement: number;  // Nombre moyen de bougies par palier dans la zone
  ordre: number;                   // 1 pour TP1, 2 pour TP2, etc.
  debug?: DebugTPOptimal;          // Données de debug (rempli uniquement si afficherDebugTP=true)
}

/**
 * Options de configuration du Profil de Chevauchement Non-Mitigué (UOP)
 */
export interface OptionsUOP {
  // ─── 📐 Contrôle Externe de la Structure ZigZag ─────────────────────────────
  zigzagDepth?: number;           // Sensibilité des pivots ZigZag (barres avant/après, défaut: 8)
  zigzagDeviation?: number;       // Déviation minimale en points de prix (défaut: 0)
  zigzagBackstep?: number;        // Écart minimum en barres entre deux pivots (défaut: 3)
  inclureVagueCourante?: boolean; // Calculer le ZigZag avec la vague active vers le cours actuel (défaut: true)
  lookbackBars?: number;          // Historique analysé (défaut: 500)

  // ─── 🌊 Contrôle de la Superposition des Vagues ────────────────────────────
  nbVaguesSuperposees?: number;   // Nombre de vagues (précédentes + courante) à superposer (défaut: 4)
  minVaguesSuperposition?: number;// Nombre minimum de vagues ayant traversé un palier (défaut: 1)
  maxVagues?: number;             // Alias pour compatibilité descendante (défaut: 4)

  // ─── 🧱 Découpage et Paliers de Prix ───────────────────────────────────────
  priceStep?: number;             // Pas de prix de chaque palier (auto si non fourni)
  seuilBougiesBleuFonce?: number; // Nombre min de bougies pour qu'une barre soit "bleu foncé" (Sweep, défaut: 3)
  minBougiesUniforme?: number;    // Rétrocompatibilité seuil min de bougies (défaut: 2)
  toleranceUniformite?: number;   // Écart max entre paliers pour être considérés uniformes (défaut: 1)
  prolongerNiveaux?: boolean;     // Prolonger les niveaux non mitigués vers la droite (défaut: true)
  uniquementNonMitigues?: boolean;// Masquer les paliers déjà mitigés (défaut: false)

  // ─── 🎨 Options de Visibilité & Flexibilité Graphique ─────────────────────────
  afficherZigZag?: boolean;       // Afficher les traits brisés de la structure ZigZag (défaut: true)
  afficherBarresProfil?: boolean; // Afficher l'histogramme horizontal du profil (défaut: true)
  afficherProlongation?: boolean; // Afficher les lignes en pointillés des niveaux non mitigés (défaut: true)
  afficherBoites?: boolean;       // Afficher les boîtes rectangulaires (défaut: false)
  afficherTexte?: boolean;        // Afficher les étiquettes de texte (défaut: false)

  // ─── 🎯 Options des Take Profit Optimaux (TPO) ───────────────────────────────
  afficherTPOptimaux?: boolean;   // Calculer et afficher les TP Optimaux Achat & Vente (défaut: true)
  seuilMargeTrouPourcent?: number;// Marge max tolérée pour les micro-creux de faible chevauchement (défaut: 5%)
  maxTPAffiches?: number;         // Nombre maximum de TP affichés par direction (défaut: 3)

  // ─── 🔍 Mode Debug Visuel des TP Optimaux ─────────────────────────────────────
  afficherDebugTP?: boolean;      // Afficher les zones de debug (tronçons goudronnés, trous, ratios) sur le graphique (défaut: false)

  // ─── 🕯️ Traitement Anatomique des Bougies (Corps vs Mèches) ───────────────────
  typeChevauchementUOP?: TypeChevauchementUOP; // PONDERE (Corps=1.0, Mèches=0.25), CORPS_SEUL ou CORPS_ET_MECHES (défaut: 'PONDERE')
  poidsCorps?: number;            // Poids attribué au corps de la bougie (défaut: 1.0)
  poidsMeche?: number;            // Poids attribué aux mèches de la bougie (défaut: 0.25)
}

/**
 * Type de pondération anatomique appliquée par l'UOP
 */
export type TypeChevauchementUOP = 'PONDERE' | 'CORPS_SEUL' | 'CORPS_ET_MECHES';

/**
 * Résultat complet retourné par le moteur UOP
 */
export interface ResultatUOP {
  pivots: PointZigZag[];
  vagues: VagueOverlapProfile[];
  vaguesSuperposees: VagueOverlapProfile[];
  paliersSuperposition: PalierSuperpositionVagues[];
  niveauxOuverts: NiveauOuvertUOP[];
  plagesUniformesGlobales: PlagePrixUniforme[];
  tpOptimauxAchat: TPOptimalUOP[];
  tpOptimauxVente: TPOptimalUOP[];
  totalNiveauxOuverts: number;
  step: number;
  prixActuel: number;
  primitives: VisualPrimitives;
}

// ─── 📐 Détection Avancée des Pivots ZigZag ───────────────────────────────────

/**
 * Détecte les pivots ZigZag avec contrôle externe complet :
 * - depth : nombre de bougies nécessaires à gauche et à droite pour valider un sommet ou un creux
 * - deviation : amplitude minimale de prix requise pour valider un retournement
 * - backstep : nombre minimum de barres d'écart entre deux pivots consécutifs
 * - inclureVagueCourante : étend dynamiquement la vague en cours jusqu'au cours actuel de la dernière bougie
 * 
 * Exemple :
 * const pivots = detecterPivotsZigZagAvance(bougies, { depth: 8, deviation: 0, backstep: 3, inclureVagueCourante: true });
 */
export function detecterPivotsZigZagAvance(
  bougies: Bougie[],
  options: {
    depth?: number;
    deviation?: number;
    backstep?: number;
    inclureVagueCourante?: boolean;
    lookbackBars?: number;
  } = {}
): PointZigZag[] {
  const depth = Math.max(2, options.depth ?? 8);
  const deviation = Math.max(0, options.deviation ?? 0);
  const backstep = Math.max(1, options.backstep ?? 3);
  const inclureVagueCourante = options.inclureVagueCourante !== false;
  const lookbackBars = options.lookbackBars ?? 500;

  const totalBars = bougies.length;
  if (totalBars < depth * 2 + 2) return [];

  const startBar = Math.max(depth, totalBars - lookbackBars);
  const endBar = totalBars - depth - 1;

  const pivotsCandidats: PointZigZag[] = [];

  // 1️⃣ Détection des sommets et creux locaux avec confirmation sur 'depth' barres
  for (let i = startBar; i <= endBar; i++) {
    let estHaut = true;
    let estBas = true;

    const highRef = bougies[i].high;
    const lowRef = bougies[i].low;

    for (let j = 1; j <= depth; j++) {
      if (highRef <= bougies[i - j].high || highRef < bougies[i + j].high) estHaut = false;
      if (lowRef >= bougies[i - j].low || lowRef > bougies[i + j].low) estBas = false;
    }

    if (estHaut) {
      pivotsCandidats.push({
        prix: highRef,
        temps: bougies[i].time,
        index: i,
        estHaut: true,
      });
    } else if (estBas) {
      pivotsCandidats.push({
        prix: lowRef,
        temps: bougies[i].time,
        index: i,
        estHaut: false,
      });
    }
  }

  if (pivotsCandidats.length === 0) return [];

  // 2️⃣ Filtrage avec Backstep, Deviation et Alternance Stricte (Haut -> Bas -> Haut)
  const pivotsFiltres: PointZigZag[] = [pivotsCandidats[0]];

  for (let i = 1; i < pivotsCandidats.length; i++) {
    const dernierPivot = pivotsFiltres[pivotsFiltres.length - 1];
    const candidat = pivotsCandidats[i];

    // Écart en barres entre le candidat et le dernier pivot
    const distanceBarres = candidat.index - dernierPivot.index;

    // Même polarité : deux sommets ou deux creux consécutifs
    if (candidat.estHaut === dernierPivot.estHaut) {
      if (candidat.estHaut && candidat.prix > dernierPivot.prix) {
        // Nouveau sommet plus élevé : on prolonge le sommet
        pivotsFiltres[pivotsFiltres.length - 1] = candidat;
      } else if (!candidat.estHaut && candidat.prix < dernierPivot.prix) {
        // Nouveau creux plus bas : on prolonge le creux
        pivotsFiltres[pivotsFiltres.length - 1] = candidat;
      }
    } else {
      // Polarité opposée (ex: Sommet -> Creux ou Creux -> Sommet)
      const amplitudePrix = Math.abs(candidat.prix - dernierPivot.prix);

      // Le pivot opposé doit respecter le backstep minimum OU présenter une amplitude significative
      if (distanceBarres >= backstep || amplitudePrix >= deviation) {
        if (deviation > 0 && amplitudePrix < deviation) {
          // Filtré car l'amplitude est inférieure au seuil de déviation requis
          continue;
        }
        pivotsFiltres.push(candidat);
      }
    }
  }

  // 2.5️⃣ Ancrage au début de la fenêtre d'observation pour ne pas tronquer le premier mouvement
  if (pivotsFiltres.length > 0 && pivotsFiltres[0].index > 0) {
    const premier = pivotsFiltres[0];
    let initialIdx = 0;
    let initialPrix = premier.estHaut ? bougies[0].low : bougies[0].high;

    for (let k = 1; k < premier.index; k++) {
      if (premier.estHaut && bougies[k].low < initialPrix) {
        initialPrix = bougies[k].low;
        initialIdx = k;
      } else if (!premier.estHaut && bougies[k].high > initialPrix) {
        initialPrix = bougies[k].high;
        initialIdx = k;
      }
    }

    pivotsFiltres.unshift({
      index: initialIdx,
      temps: bougies[initialIdx].time,
      prix: initialPrix,
      estHaut: !premier.estHaut,
    });
  }

  // 3️⃣ Intégration dynamique de la VAGUE COURANTE (reliée en temps réel au prix actuel)
  if (inclureVagueCourante && pivotsFiltres.length >= 1) {
    let dernierPivot = pivotsFiltres[pivotsFiltres.length - 1];
    let dernierIdx = dernierPivot.index;
    const dernierEstHaut = dernierPivot.estHaut;
    const currentBarIdx = totalBars - 1;
    const derniereBougie = bougies[currentBarIdx];

    // Vérifier si le marché a continué au-delà du dernier pivot confirmé
    if (dernierEstHaut) {
      let plusHautIdx = dernierIdx;
      let plusHautPrix = dernierPivot.prix;
      for (let k = dernierIdx + 1; k < totalBars; k++) {
        if (bougies[k].high > plusHautPrix) {
          plusHautPrix = bougies[k].high;
          plusHautIdx = k;
        }
      }
      if (plusHautIdx !== dernierIdx) {
        pivotsFiltres[pivotsFiltres.length - 1].prix = plusHautPrix;
        pivotsFiltres[pivotsFiltres.length - 1].index = plusHautIdx;
        pivotsFiltres[pivotsFiltres.length - 1].temps = bougies[plusHautIdx].time;
        dernierPivot = pivotsFiltres[pivotsFiltres.length - 1];
        dernierIdx = plusHautIdx;
      }
    } else {
      let plusBasIdx = dernierIdx;
      let plusBasPrix = dernierPivot.prix;
      for (let k = dernierIdx + 1; k < totalBars; k++) {
        if (bougies[k].low < plusBasPrix) {
          plusBasPrix = bougies[k].low;
          plusBasIdx = k;
        }
      }
      if (plusBasIdx !== dernierIdx) {
        pivotsFiltres[pivotsFiltres.length - 1].prix = plusBasPrix;
        pivotsFiltres[pivotsFiltres.length - 1].index = plusBasIdx;
        pivotsFiltres[pivotsFiltres.length - 1].temps = bougies[plusBasIdx].time;
        dernierPivot = pivotsFiltres[pivotsFiltres.length - 1];
        dernierIdx = plusBasIdx;
      }
    }

    // Si le dernier pivot n'est pas la bougie active, on déploie la vague courante en direct vers le cours actuel (close)
    if (dernierIdx < currentBarIdx) {
      pivotsFiltres.push({
        index: currentBarIdx,
        temps: derniereBougie.time,
        prix: derniereBougie.close,
        estHaut: !dernierEstHaut,
      });
    }
  }

  return pivotsFiltres;
}

// ─── 🌊 Moteur de Superposition des Vagues et TP Optimaux (TPO) ───────────────

/**
 * Construit la cartographie superposée des vagues sélectionnées.
 * Superpose les vagues précédentes et la vague courante sur une grille commune de prix.
 * 
 * Exemple :
 * const mapSuperposition = construireSuperpositionVagues(vaguesSelectionnees, step, 3);
 */
export function construireSuperpositionVagues(
  vagues: VagueOverlapProfile[],
  step: number,
  seuilBleuFonce: number = 3
): Map<number, PalierSuperpositionVagues> {
  const mapSuperposition = new Map<number, PalierSuperpositionVagues>();

  // Parcours de chaque vague sélectionnée (vagues précédentes + vague courante)
  for (const vague of vagues) {
    for (const palier of vague.paliers) {
      const prixArrondi = Number(palier.price.toFixed(5));

      let superpose = mapSuperposition.get(prixArrondi);
      if (!superpose) {
        superpose = {
          prix: prixArrondi,
          sommeBougies: 0,
          nbVagues: 0,
          vaguesIndices: [],
          tauxMoyenBougies: 0,
          estBleuFonce: false,
          isMitigated: palier.isMitigated,
        };
        mapSuperposition.set(prixArrondi, superpose);
      }

      // Cumul du nombre de bougies de chevauchement sur ce palier à travers les vagues
      superpose.sommeBougies += palier.nbBougiesChevauchement;
      superpose.nbVagues += 1;
      superpose.vaguesIndices.push(vague.id);

      // Si le palier dans cette vague est une barre forte (bleu foncé)
      if (palier.nbBougiesChevauchement >= seuilBleuFonce && !palier.isMitigated) {
        superpose.estBleuFonce = true;
      }

      // Si le niveau est resté non-mitigué sur l'une des vagues récentes, on le retient
      if (!palier.isMitigated) {
        superpose.isMitigated = false;
      }
    }
  }

  // Calcul du taux moyen et consolidation du statut bleu foncé (Sweep)
  for (const superpose of mapSuperposition.values()) {
    if (superpose.nbVagues > 0) {
      superpose.tauxMoyenBougies = Number((superpose.sommeBougies / superpose.nbVagues).toFixed(1));
    }
    // Si la somme cumulée de bougies atteint le seuil fort, le palier est aussi qualifié bleu foncé
    if (superpose.sommeBougies >= seuilBleuFonce) {
      superpose.estBleuFonce = true;
    }
  }

  return mapSuperposition;
}

/**
 * ==============================================================================
 * 🎯 DÉTECTION DES TAKE PROFIT OPTIMAUX (TP1 & TP2) - PRINCIPE & CONDITIONS
 * ==============================================================================
 * 
 * 💡 D'OÙ VIENNENT LE PREMIER TP (TP1) ET LE DEUXIÈME TP (TP2) ?
 * 
 * L'indicateur UOP (Unmitigated Overlap Profile) calcule les TP mathématiques non pas
 * sur des ticks fictifs, mais sur les ZONES DE FORT CHEVAUCHEMENT HORIZONTAL
 * (les zones "bleu foncé" ou "goudronnées" où les vagues ZigZag précédentes et actuelles
 * ont superposé leurs corps et mèches, créant une autoroute de liquidité institutionnelle).
 * 
 * ------------------------------------------------------------------------------
 * 🔹 ÉTAPE 1 : IDENTIFICATION DES PALIERS GOUDRONNÉS (BLEU FONCÉ)
 * ------------------------------------------------------------------------------
 * Un palier de prix (hauteur discrète `step`) est qualifié de "goudronné" si :
 *   • `sommeBougies >= seuilBougiesBleuFonce` (Par défaut : 3 bougies cumulées).
 *   • `nbVagues >= minVaguesSuperposition`   (Par défaut : au moins 1 vague ayant traversé).
 * Les paliers contigus bleu foncé forment un "Tronçon Goudronné" (ex: AB).
 * 
 * ------------------------------------------------------------------------------
 * 🔹 ÉTAPE 2 : LA CONDITION DE COUPURE DE LA ROUTE & NAISSANCE DU TP1
 * ------------------------------------------------------------------------------
 * Entre deux tronçons goudronnés successifs (ex: AB et CD), il existe un "trou" (zone blanche sans liquidité) :
 *   • Formule du trou : `totalEntier = hauteurGoudron + hauteurTrou`
 *   • Ratio du trou : `ratioTrou = (hauteurTrou / totalEntier) * 100`
 * 
 * 👉 RÈGLE DU SEUIL DE TOLÉRANCE DE 5% (`seuilMargeTrouPourcent = 5`) :
 *   1. Si `ratioTrou <= 5%` : Le trou est considéré comme une imperfection mineure.
 *      ➔ Le trou est ABSORBÉ et la route s'étend jusqu'au sommet du tronçon suivant (CD).
 *   2. Si `ratioTrou > 5%` : La discontinuité est trop importante ! La route est COUPÉE NET !
 *      ➔ La fin de cette première route goudronnée devient le **TP1 (Ordre 1)**.
 * 
 * ------------------------------------------------------------------------------
 * 🔹 ÉTAPE 3 : COMMENT NAÎT LE DEUXIÈME TP (TP2) ?
 * ------------------------------------------------------------------------------
 * Lorsque la première route est coupée (> 5% de vide), l'algorithme ne s'arrête pas :
 *   • Il saute le trou et cherche le PROCHAIN tronçon goudronné rencontré plus loin.
 *   • Il réapplique la même règle de continuité (cumul des blocs suivants avec trous <= 5%).
 *   • La fin de ce second corridor de liquidité devient le **TP2 (Ordre 2)** !
 * 
 * ------------------------------------------------------------------------------
 * ⚙️ VARIABLES DE RÉGLAGE DIRECT (Pour ajuster TP1 et TP2 dans le code) :
 * ------------------------------------------------------------------------------
 * • `seuilBougiesBleuFonce` (défaut: 3) :
 *     - Si tu l'augmentes (ex: 4 ou 5) : seuls les overlaps très denses sont goudronnés ➔ TP plus proches et sélectifs.
 *     - Si tu le diminues (ex: 2) : plus de zones sont goudronnées ➔ TP plus éloignés.
 * 
 * • `seuilMargeTrouPourcent` (défaut: 5) :
 *     - Si tu l'augmentes (ex: 10% ou 15%) : absorbe de plus grands trous ➔ fusionne TP1 et TP2 en un grand TP1 étendu.
 *     - Si tu le diminues (ex: 2% ou 3%) : moindre trou coupe la route ➔ sépare plus vite TP1 de TP2.
 * 
 * • `maxTPAffiches` (défaut: 3) :
 *     - Nombre maximal de TP calculés et renvoyés (TP1, TP2, TP3...).
 * 
 * • `nbVaguesSuperposees` (défaut: 4) :
 *     - Profondeur des vagues ZigZag superposées pour construire le profil.
 * ==============================================================================
 */
export function calculerTPOptimaux(
  prixActuel: number,
  step: number,
  mapSuperposition: Map<number, PalierSuperpositionVagues | number>,
  options: {
    seuilBougiesBleuFonce?: number;
    seuilMargeTrouPourcent?: number;
    maxTPAffiches?: number;
    minVaguesSuperposition?: number;
    minBougiesUniforme?: number;
    toleranceUniformite?: number;
    afficherDebugTP?: boolean;
  } = {}
): { tpOptimauxAchat: TPOptimalUOP[]; tpOptimauxVente: TPOptimalUOP[] } {
  const seuilBleuFonce = options.seuilBougiesBleuFonce ?? options.minBougiesUniforme ?? 3;
  const seuilMargeTrouPourcent = options.seuilMargeTrouPourcent ?? 5;
  const maxTPAffiches = options.maxTPAffiches ?? 3;
  const minVaguesSuperposition = options.minVaguesSuperposition ?? 1;
  const afficherDebugTP = options.afficherDebugTP ?? false;

  // Lettres alphabétiques pour identifier les tronçons goudronnés (A, B, C, D, ...)
  const LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  const tpOptimauxAchat: TPOptimalUOP[] = [];
  const tpOptimauxVente: TPOptimalUOP[] = [];

  const tousLesPrix = Array.from(mapSuperposition.keys()).sort((a, b) => a - b);
  if (tousLesPrix.length === 0 || prixActuel <= 0) {
    return { tpOptimauxAchat, tpOptimauxVente };
  }

  const prixMin = tousLesPrix[0];
  const prixMax = tousLesPrix[tousLesPrix.length - 1];

  // Helper pour savoir si un palier est bleu foncé (Sweep / fort chevauchement)
  function extrairePalier(prix: number): { estBleuFonce: boolean; nbBougies: number } {
    const arrondi = Number(prix.toFixed(5));
    const donnee = mapSuperposition.get(arrondi);
    if (donnee === undefined) {
      return { estBleuFonce: false, nbBougies: 0 };
    }

    if (typeof donnee === 'number') {
      return {
        estBleuFonce: donnee >= seuilBleuFonce,
        nbBougies: donnee,
      };
    }

    const nbBougies = donnee.sommeBougies;
    const respecteVagues = donnee.nbVagues >= minVaguesSuperposition;
    const estBleu = (donnee.estBleuFonce || nbBougies >= seuilBleuFonce) && respecteVagues;

    return { estBleuFonce: estBleu, nbBougies };
  }

  // Structures pour les tronçons goudronnés et les trous
  interface TronconGoudronne {
    prixBas: number;
    prixHaut: number;
    hauteur: number;
    sommeBougies: number;
    nbPaliers: number;
  }

  // ─── Helper pour construire les données de debug d'un TP ────────────────────
  // Prend la liste des tronçons, les trous, les indices de début et fin utilisés,
  // et construit un DebugTPOptimal complet pour l'affichage visuel
  function construireDebugTP(
    troncons: TronconGoudronne[],
    trous: number[],
    idxDebut: number,
    idxFin: number,
    direction: 'achat' | 'vente'
  ): DebugTPOptimal {
    const debugTroncons: DebugTronconTP[] = [];
    const debugTrous: DebugTrouTP[] = [];
    let cumulGoudron = 0;

    // Enregistrement de chaque tronçon goudronné avec sa lettre (A, B, C, ...)
    for (let i = idxDebut; i <= idxFin; i++) {
      const t = troncons[i];
      const lettreIdx = i - idxDebut;
      debugTroncons.push({
        prixBas: t.prixBas,
        prixHaut: t.prixHaut,
        hauteur: t.hauteur,
        nbPaliers: t.nbPaliers,
        sommeBougies: t.sommeBougies,
        lettre: lettreIdx < LETTRES.length ? LETTRES[lettreIdx] : `T${lettreIdx + 1}`,
      });
      cumulGoudron += t.hauteur;
    }

    // Enregistrement de chaque trou entre tronçons consécutifs
    for (let i = idxDebut; i < idxFin; i++) {
      const hauteurTrou = trous[i];
      // Calcul du ratio au moment de la décision d'absorption
      const goudronAvant = troncons.slice(idxDebut, i + 1).reduce((acc, t) => acc + t.hauteur, 0);
      const goudronApres = troncons[i + 1].hauteur;
      const totalGoudronne = goudronAvant + goudronApres;
      const totalEntier = totalGoudronne + hauteurTrou;
      const ratioPourcent = Number(((hauteurTrou / totalEntier) * 100).toFixed(2));

      // Calcul du prix bas et haut du trou selon la direction
      let trouPrixBas: number;
      let trouPrixHaut: number;

      if (direction === 'achat') {
        // En montant : le trou est entre le haut du tronçon précédent et le bas du suivant
        trouPrixBas = troncons[i].prixHaut;
        trouPrixHaut = troncons[i + 1].prixBas;
      } else {
        // En descendant : le trou est entre le bas du tronçon précédent et le haut du suivant
        trouPrixHaut = troncons[i].prixBas;
        trouPrixBas = troncons[i + 1].prixHaut;
      }

      debugTrous.push({
        prixBas: Math.min(trouPrixBas, trouPrixHaut),
        prixHaut: Math.max(trouPrixBas, trouPrixHaut),
        hauteur: hauteurTrou,
        ratioPourcent,
        estAbsorbe: ratioPourcent <= seuilMargeTrouPourcent,
      });
    }

    // Calcul des bornes globales de la zone analysée
    const tousLesPrixDebug = debugTroncons.flatMap(t => [t.prixBas, t.prixHaut]);
    const trousPrixDebug = debugTrous.flatMap(t => [t.prixBas, t.prixHaut]);
    const tousLesNiveaux = [...tousLesPrixDebug, ...trousPrixDebug];

    return {
      troncons: debugTroncons,
      trous: debugTrous,
      cumulGoudronTotal: cumulGoudron,
      prixBas: Math.min(...tousLesNiveaux),
      prixHaut: Math.max(...tousLesNiveaux),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 🟢 1. RECHERCHE DES TP OPTIMAUX ACHAT (En montant au-dessus du prix actuel)
  // ─────────────────────────────────────────────────────────────────────────
  // 1️⃣ Découpage en alternance de tronçons goudronnés (bleu foncé) et de trous (non goudronnés)
  const tronconsGoudronAchat: TronconGoudronne[] = [];
  const trousAchat: number[] = []; // Hauteur de chaque trou entre tronçons

  let pCourantA = Math.round((prixActuel + step) / step) * step;
  let goudronEnCoursA: TronconGoudronne | null = null;
  let trouEnCoursHauteurA = 0;

  while (pCourantA <= prixMax) {
    const { estBleuFonce, nbBougies } = extrairePalier(pCourantA);

    if (estBleuFonce) {
      if (trouEnCoursHauteurA > 0 && tronconsGoudronAchat.length > 0) {
        trousAchat.push(trouEnCoursHauteurA);
        trouEnCoursHauteurA = 0;
      }

      if (!goudronEnCoursA) {
        goudronEnCoursA = {
          prixBas: pCourantA,
          prixHaut: pCourantA + step,
          hauteur: step,
          sommeBougies: nbBougies,
          nbPaliers: 1,
        };
      } else {
        goudronEnCoursA.prixHaut = pCourantA + step;
        goudronEnCoursA.hauteur += step;
        goudronEnCoursA.sommeBougies += nbBougies;
        goudronEnCoursA.nbPaliers += 1;
      }
    } else {
      if (goudronEnCoursA) {
        tronconsGoudronAchat.push(goudronEnCoursA);
        goudronEnCoursA = null;
      }
      if (tronconsGoudronAchat.length > 0) {
        trouEnCoursHauteurA += step;
      }
    }

    pCourantA += step;
  }

  if (goudronEnCoursA) {
    tronconsGoudronAchat.push(goudronEnCoursA);
  }

  // 2️⃣ Règle de cumul de la route goudronnée : AB + CD avec vérification trou <= 5%
  let idxGoudronA = 0;
  let ordreAchat = 1;

  while (idxGoudronA < tronconsGoudronAchat.length && ordreAchat <= maxTPAffiches) {
    const tronconInitial = tronconsGoudronAchat[idxGoudronA];
    let cumulGoudron = tronconInitial.hauteur;
    let sommeBougies = tronconInitial.sommeBougies;
    let totalPaliers = tronconInitial.nbPaliers;
    let cibleFinale = tronconInitial.prixHaut;
    let prixDepartZone = tronconInitial.prixBas;

    let k = idxGoudronA;
    // On teste si le creux qui suit peut être absorbé par le tronçon goudronné suivant
    while (k < trousAchat.length && (k + 1) < tronconsGoudronAchat.length) {
      const hauteurTrou = trousAchat[k];
      const tronconSuivant = tronconsGoudronAchat[k + 1];

      // Formule exacte de l'utilisateur :
      // Total goudronné = première partie goudronnée (AB) + deuxième partie goudronnée (CD)
      const totalGoudronne = cumulGoudron + tronconSuivant.hauteur;
      const totalEntier = totalGoudronne + hauteurTrou;
      const ratioTrou = (hauteurTrou / totalEntier) * 100;

      // Si la partie non goudronnée est inférieure à 5% de ce total entier : on absorbe et on ajoute CD !
      if (ratioTrou <= seuilMargeTrouPourcent) {
        cumulGoudron = totalGoudronne;
        sommeBougies += tronconSuivant.sommeBougies;
        totalPaliers += tronconSuivant.nbPaliers;
        cibleFinale = tronconSuivant.prixHaut; // La cible s'étend au sommet du tronçon suivant (point D)
        k++; // On continue de tester si d'autres tronçons consécutifs s'ajoutent
      } else {
        // Le trou dépasse 5% : coupure nette de la route !
        break;
      }
    }

    const amplitude = Number((cibleFinale - prixActuel).toFixed(5));
    const tauxMoyen = Number((sommeBougies / totalPaliers).toFixed(1));
    const hauteurZone = Number((cibleFinale - prixDepartZone).toFixed(5));

    // Construction du TP avec données de debug si activé
    const tpAchat: TPOptimalUOP = {
      id: `tpo-achat-${ordreAchat}`,
      type: 'achat',
      prixCible: cibleFinale,
      prixDepart: prixActuel,
      amplitudePoints: amplitude,
      hauteurZoneUniforme: hauteurZone,
      tauxMoyenChevauchement: tauxMoyen,
      ordre: ordreAchat,
    };

    // Si le mode debug est activé, on attache les données détaillées de la construction du TP
    if (afficherDebugTP) {
      tpAchat.debug = construireDebugTP(tronconsGoudronAchat, trousAchat, idxGoudronA, k, 'achat');
    }

    tpOptimauxAchat.push(tpAchat);

    ordreAchat++;
    idxGoudronA = k + 1; // On reprend la recherche après le dernier tronçon absorbé
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 🔴 2. RECHERCHE DES TP OPTIMAUX VENTE (En descendant en-dessous du prix actuel)
  // ─────────────────────────────────────────────────────────────────────────
  const tronconsGoudronVente: TronconGoudronne[] = [];
  const trousVente: number[] = [];

  let pCourantV = Math.round((prixActuel - step) / step) * step;
  let goudronEnCoursV: TronconGoudronne | null = null;
  let trouEnCoursHauteurV = 0;

  while (pCourantV >= prixMin) {
    const { estBleuFonce, nbBougies } = extrairePalier(pCourantV);

    if (estBleuFonce) {
      if (trouEnCoursHauteurV > 0 && tronconsGoudronVente.length > 0) {
        trousVente.push(trouEnCoursHauteurV);
        trouEnCoursHauteurV = 0;
      }

      if (!goudronEnCoursV) {
        goudronEnCoursV = {
          prixHaut: pCourantV + step,
          prixBas: pCourantV,
          hauteur: step,
          sommeBougies: nbBougies,
          nbPaliers: 1,
        };
      } else {
        goudronEnCoursV.prixBas = pCourantV;
        goudronEnCoursV.hauteur += step;
        goudronEnCoursV.sommeBougies += nbBougies;
        goudronEnCoursV.nbPaliers += 1;
      }
    } else {
      if (goudronEnCoursV) {
        tronconsGoudronVente.push(goudronEnCoursV);
        goudronEnCoursV = null;
      }
      if (tronconsGoudronVente.length > 0) {
        trouEnCoursHauteurV += step;
      }
    }

    pCourantV -= step;
  }

  if (goudronEnCoursV) {
    tronconsGoudronVente.push(goudronEnCoursV);
  }

  let idxGoudronV = 0;
  let ordreVente = 1;

  while (idxGoudronV < tronconsGoudronVente.length && ordreVente <= maxTPAffiches) {
    const tronconInitial = tronconsGoudronVente[idxGoudronV];
    let cumulGoudron = tronconInitial.hauteur;
    let sommeBougies = tronconInitial.sommeBougies;
    let totalPaliers = tronconInitial.nbPaliers;
    let cibleFinale = tronconInitial.prixBas;
    let prixDepartZone = tronconInitial.prixHaut;

    let k = idxGoudronV;
    while (k < trousVente.length && (k + 1) < tronconsGoudronVente.length) {
      const hauteurTrou = trousVente[k];
      const tronconSuivant = tronconsGoudronVente[k + 1];

      const totalGoudronne = cumulGoudron + tronconSuivant.hauteur;
      const totalEntier = totalGoudronne + hauteurTrou;
      const ratioTrou = (hauteurTrou / totalEntier) * 100;

      if (ratioTrou <= seuilMargeTrouPourcent) {
        cumulGoudron = totalGoudronne;
        sommeBougies += tronconSuivant.sommeBougies;
        totalPaliers += tronconSuivant.nbPaliers;
        cibleFinale = tronconSuivant.prixBas;
        k++;
      } else {
        break;
      }
    }

    const amplitude = Number((prixActuel - cibleFinale).toFixed(5));
    const tauxMoyen = Number((sommeBougies / totalPaliers).toFixed(1));
    const hauteurZone = Number((prixDepartZone - cibleFinale).toFixed(5));

    // Construction du TP Vente avec données de debug si activé
    const tpVente: TPOptimalUOP = {
      id: `tpo-vente-${ordreVente}`,
      type: 'vente',
      prixCible: cibleFinale,
      prixDepart: prixActuel,
      amplitudePoints: amplitude,
      hauteurZoneUniforme: hauteurZone,
      tauxMoyenChevauchement: tauxMoyen,
      ordre: ordreVente,
    };

    // Si le mode debug est activé, on attache les données détaillées
    if (afficherDebugTP) {
      tpVente.debug = construireDebugTP(tronconsGoudronVente, trousVente, idxGoudronV, k, 'vente');
    }

    tpOptimauxVente.push(tpVente);

    ordreVente++;
    idxGoudronV = k + 1;
  }

  return { tpOptimauxAchat, tpOptimauxVente };
}

// ─── 🚀 Moteur Principal : Profil de Chevauchement Non-Mitigué (UOP) ──────────

/**
 * Calcule l'indicateur Profil de Chevauchement Non-Mitigué (UOP) avec superposition
 * des vagues ZigZag (vagues précédentes et vague courante).
 * 
 * Exemple :
 * const res = calculerUnmitigatedOverlapProfile(bougies, {
 *   zigzagDepth: 8,
 *   nbVaguesSuperposees: 4,
 *   inclureVagueCourante: true,
 *   afficherTPOptimaux: true
 * });
 */
export function calculerUnmitigatedOverlapProfile(
  bougies: Bougie[],
  options: OptionsUOP = {}
): ResultatUOP {
  const primitives: VisualPrimitives = { boites: [], lignes: [], labels: [] };

  const {
    zigzagDepth = 8,
    zigzagDeviation = 0,
    zigzagBackstep = 3,
    inclureVagueCourante = true,
    nbVaguesSuperposees,
    maxVagues = 4,
    lookbackBars = 500,
    priceStep,
    seuilBougiesBleuFonce = 3,
    minBougiesUniforme = 2,
    toleranceUniformite = 1,
    minVaguesSuperposition = 1,
    prolongerNiveaux = true,
    uniquementNonMitigues = false,
    afficherZigZag = true,
    afficherBarresProfil = true,
    afficherProlongation = true,
    afficherBoites = false,
    afficherTexte = false,
    afficherTPOptimaux = true,
    seuilMargeTrouPourcent = 5,
    maxTPAffiches = 3,
    afficherDebugTP = false,
    typeChevauchementUOP = 'PONDERE',
    poidsCorps = 1.0,
    poidsMeche = 0.25,
  } = options;

  // Détermination du nombre effectif de vagues à superposer
  const nombreVaguesCible = nbVaguesSuperposees ?? maxVagues ?? 4;

  const step = determinerStepPrix(bougies, priceStep);

  // 1️⃣ Détection des pivots ZigZag avec prise en compte de la vague courante et des paramètres de contrôle
  const pivots = detecterPivotsZigZagAvance(bougies, {
    depth: zigzagDepth,
    deviation: zigzagDeviation,
    backstep: zigzagBackstep,
    inclureVagueCourante,
    lookbackBars,
  });

  const vagues: VagueOverlapProfile[] = [];
  const niveauxOuverts: NiveauOuvertUOP[] = [];
  const plagesUniformesGlobales: PlagePrixUniforme[] = [];

  const derniereBougie = bougies && bougies.length > 0 ? bougies[bougies.length - 1] : null;
  const prixActuel = derniereBougie ? derniereBougie.close : 0;

  if (!bougies || bougies.length < 10 || pivots.length < 2) {
    return {
      pivots,
      vagues: [],
      vaguesSuperposees: [],
      paliersSuperposition: [],
      niveauxOuverts: [],
      plagesUniformesGlobales: [],
      tpOptimauxAchat: [],
      tpOptimauxVente: [],
      totalNiveauxOuverts: 0,
      step,
      prixActuel,
      primitives,
    };
  }

  // 2️⃣ Découpage de l'ensemble des vagues structurelles
  const totalVaguesDisponibles = pivots.length - 1;
  let vagueId = 0;

  for (let v = 0; v < totalVaguesDisponibles; v++) {
    const ptA = pivots[v];
    const ptB = pivots[v + 1];

    let idxDebut = ptA.index;
    let idxFin = ptB.index;
    if (idxDebut > idxFin) {
      const temp = idxDebut;
      idxDebut = idxFin;
      idxFin = temp;
    }

    const nbBougiesVague = Math.max(1, idxFin - idxDebut + 1);

    // Découpage en paliers de prix pour cette vague
    const bucketsMap = new Map<number, { nbBougies: number; dernierIdx: number }>();

    for (let b = idxDebut; b <= idxFin; b++) {
      const bougie = bougies[b];
      const candleRange = bougie.high - bougie.low;
      if (candleRange <= 0) continue;

      const corpsBas = Math.min(bougie.open, bougie.close);
      const corpsHaut = Math.max(bougie.open, bougie.close);

      // Si mode 'CORPS_SEUL' : on ignore les mèches éphémères et on ne parcourt que le corps de la bougie
      const scanMin = typeChevauchementUOP === 'CORPS_SEUL' ? corpsBas : bougie.low;
      const scanMax = typeChevauchementUOP === 'CORPS_SEUL' ? corpsHaut : bougie.high;
      const borneDebut = Math.min(scanMin, scanMax);
      const borneFin = Math.max(scanMin, scanMax);

      for (let p = borneDebut; p <= borneFin; p += step) {
        const palierPrix = Math.round(p / step) * step;
        const arrondi = Number(palierPrix.toFixed(5));

        // Poids attribué à ce palier selon son appartenance au corps ou aux mèches
        let poids = 1.0;
        if (typeChevauchementUOP === 'PONDERE') {
          // Si le prix p est situé à l'intérieur du corps réel de la bougie
          const estDansCorps = p >= corpsBas && p <= corpsHaut;
          poids = estDansCorps ? poidsCorps : poidsMeche;
        }

        const existant = bucketsMap.get(arrondi) || { nbBougies: 0, dernierIdx: b };
        bucketsMap.set(arrondi, {
          nbBougies: Number((existant.nbBougies + poids).toFixed(2)),
          dernierIdx: Math.max(existant.dernierIdx, b),
        });
      }
    }

    // Vérification de la mitigation ultérieure (après la fin de la vague)
    const paliers: PalierChevauchement[] = [];
    let maxBougiesChevauchement = 0;
    let nbNonMitigues = 0;

    const paliersTries = Array.from(bucketsMap.entries()).sort((a, b) => a[0] - b[0]);

    for (const [prixPalier, donnee] of paliersTries) {
      const zLow = prixPalier;
      const zHigh = prixPalier + step;

      let estMitigue = false;
      for (let j = idxFin + 1; j < bougies.length; j++) {
        if (bougies[j].high >= zLow && bougies[j].low <= zHigh) {
          estMitigue = true;
          break;
        }
      }

      const pct = Math.round((donnee.nbBougies / nbBougiesVague) * 100);

      paliers.push({
        price: prixPalier,
        nbBougiesChevauchement: donnee.nbBougies,
        pourcentageChevauchement: pct,
        isMitigated: estMitigue,
        indexDernierPassage: donnee.dernierIdx,
      });

      if (donnee.nbBougies > maxBougiesChevauchement) {
        maxBougiesChevauchement = donnee.nbBougies;
      }

      if (!estMitigue) {
        nbNonMitigues++;
        niveauxOuverts.push({
          price: prixPalier + step / 2,
          nbBougiesChevauchement: donnee.nbBougies,
          vagueId: vagueId + 1,
          estHaussiere: ptB.prix > ptA.prix,
          tempsDebut: ptA.temps,
          tempsFin: ptB.temps,
        });
      }
    }

    // Détection des plages de prix uniformes pour cette vague
    const plagesUniformesVague: PlagePrixUniforme[] = [];
    let debutPlageIdx = -1;
    let sommeBougies = 0;
    let minTaux = Infinity;
    let maxTaux = -Infinity;

    for (let k = 0; k < paliers.length; k++) {
      const palier = paliers[k];

      if (palier.nbBougiesChevauchement >= minBougiesUniforme) {
        if (debutPlageIdx === -1) {
          debutPlageIdx = k;
          sommeBougies = palier.nbBougiesChevauchement;
          minTaux = palier.nbBougiesChevauchement;
          maxTaux = palier.nbBougiesChevauchement;
        } else {
          const nouveauMin = Math.min(minTaux, palier.nbBougiesChevauchement);
          const nouveauMax = Math.max(maxTaux, palier.nbBougiesChevauchement);

          if ((nouveauMax - nouveauMin) <= toleranceUniformite) {
            sommeBougies += palier.nbBougiesChevauchement;
            minTaux = nouveauMin;
            maxTaux = nouveauMax;
          } else {
            const nbPaliers = k - debutPlageIdx;
            if (nbPaliers >= 3) {
              const pBas = paliers[debutPlageIdx].price;
              const pHaut = paliers[k - 1].price + step;
              const nonMitigee = paliers.slice(debutPlageIdx, k).some(p => !p.isMitigated);

              const plage: PlagePrixUniforme = {
                id: `uniform-v${vagueId}-${debutPlageIdx}`,
                prixBas: pBas,
                prixHaut: pHaut,
                hauteur: Number((pHaut - pBas).toFixed(5)),
                tauxMoyenBougies: Number((sommeBougies / nbPaliers).toFixed(1)),
                nbPaliers,
                estNonMitigee: nonMitigee,
                tempsDebut: ptA.temps,
                tempsFin: ptB.temps,
              };

              plagesUniformesVague.push(plage);
              plagesUniformesGlobales.push(plage);
            }

            debutPlageIdx = k;
            sommeBougies = palier.nbBougiesChevauchement;
            minTaux = palier.nbBougiesChevauchement;
            maxTaux = palier.nbBougiesChevauchement;
          }
        }
      } else {
        if (debutPlageIdx !== -1) {
          const nbPaliers = k - debutPlageIdx;
          if (nbPaliers >= 3) {
            const pBas = paliers[debutPlageIdx].price;
            const pHaut = paliers[k - 1].price + step;
            const nonMitigee = paliers.slice(debutPlageIdx, k).some(p => !p.isMitigated);

            const plage: PlagePrixUniforme = {
              id: `uniform-v${vagueId}-${debutPlageIdx}`,
              prixBas: pBas,
              prixHaut: pHaut,
              hauteur: Number((pHaut - pBas).toFixed(5)),
              tauxMoyenBougies: Number((sommeBougies / nbPaliers).toFixed(1)),
              nbPaliers,
              estNonMitigee: nonMitigee,
              tempsDebut: ptA.temps,
              tempsFin: ptB.temps,
            };

            plagesUniformesVague.push(plage);
            plagesUniformesGlobales.push(plage);
          }
          debutPlageIdx = -1;
        }
      }
    }

    if (debutPlageIdx !== -1) {
      const nbPaliers = paliers.length - debutPlageIdx;
      if (nbPaliers >= 3) {
        const pBas = paliers[debutPlageIdx].price;
        const pHaut = paliers[paliers.length - 1].price + step;
        const nonMitigee = paliers.slice(debutPlageIdx).some(p => !p.isMitigated);

        const plage: PlagePrixUniforme = {
          id: `uniform-v${vagueId}-${debutPlageIdx}`,
          prixBas: pBas,
          prixHaut: pHaut,
          hauteur: Number((pHaut - pBas).toFixed(5)),
          tauxMoyenBougies: Number((sommeBougies / nbPaliers).toFixed(1)),
          nbPaliers,
          estNonMitigee: nonMitigee,
          tempsDebut: ptA.temps,
          tempsFin: ptB.temps,
        };

        plagesUniformesVague.push(plage);
        plagesUniformesGlobales.push(plage);
      }
    }

    vagueId++;
    vagues.push({
      id: vagueId,
      indexDebut: idxDebut,
      indexFin: idxFin,
      tempsDebut: ptA.temps,
      tempsFin: ptB.temps,
      prixDebut: ptA.prix,
      prixFin: ptB.prix,
      estHaussiere: ptB.prix > ptA.prix,
      totalBougiesVague: nbBougiesVague,
      paliers,
      maxBougiesChevauchement,
      totalNiveauxNonMitigues: nbNonMitigues,
      plagesUniformes: plagesUniformesVague,
    });
  }

  // 3️⃣ Sélection des vagues pour la SUPERPOSITION (vagues précédentes + vague courante)
  const nbVaguesEffectif = Math.min(vagues.length, nombreVaguesCible);
  const vaguesSuperposees = vagues.slice(vagues.length - nbVaguesEffectif);

  // 4️⃣ Construction de la cartographie superposée multi-vagues
  const mapSuperposition = construireSuperpositionVagues(vaguesSuperposees, step, seuilBougiesBleuFonce);
  const paliersSuperposition = Array.from(mapSuperposition.values()).sort((a, b) => a.prix - b.prix);

  // 5️⃣ Génération des Primitives Graphiques pour les Plages Uniformes (optionnelles)
  if (afficherBoites || afficherTexte) {
    for (const plage of plagesUniformesGlobales) {
      if (uniquementNonMitigues && !plage.estNonMitigee) continue;

      const dateFin = (prolongerNiveaux && plage.estNonMitigee && derniereBougie)
        ? derniereBougie.time
        : plage.tempsFin;

      if (afficherBoites) {
        const couleurFond = plage.estNonMitigee
          ? 'rgba(16, 185, 129, 0.20)'
          : 'rgba(100, 116, 139, 0.08)';

        const couleurBordure = plage.estNonMitigee ? '#10b981' : 'rgba(100, 116, 139, 0.35)';

        primitives.boites?.push({
          id: `box-${plage.id}`,
          prixHaut: plage.prixHaut,
          prixBas: plage.prixBas,
          dateDebut: plage.tempsDebut,
          dateFin,
          couleurFond,
          couleurBordure,
          label: afficherTexte
            ? (plage.estNonMitigee
                ? `🛣️ PLAGE UNIFORME [${plage.prixBas.toFixed(4)} - ${plage.prixHaut.toFixed(4)}] (${plage.tauxMoyenBougies}b)`
                : `🛣️ PLAGE UNIFORME [${plage.prixBas.toFixed(4)} - ${plage.prixHaut.toFixed(4)}] (${plage.tauxMoyenBougies}b - Mitigé)`)
            : undefined,
        });
      }

      if (afficherTexte) {
        primitives.labels?.push({
          id: `lbl-${plage.id}`,
          prix: plage.prixHaut,
          date: plage.tempsFin,
          texte: `🛣️ Plage Uniforme (${plage.tauxMoyenBougies}b/palier)`,
          couleur: plage.estNonMitigee ? '#10b981' : '#94a3b8',
          position: 'above',
        });
      }
    }
  }

  // 6️⃣ Calcul des Take Profit Optimaux (TPO) Achat & Vente basés sur les zones bleu foncé (Sweep) superposées
  let tpOptimauxAchat: TPOptimalUOP[] = [];
  let tpOptimauxVente: TPOptimalUOP[] = [];

  if (afficherTPOptimaux && derniereBougie && prixActuel > 0) {
    const resultatTP = calculerTPOptimaux(prixActuel, step, mapSuperposition, {
      seuilBougiesBleuFonce,
      seuilMargeTrouPourcent,
      maxTPAffiches,
      minVaguesSuperposition,
      minBougiesUniforme,
      toleranceUniformite,
      afficherDebugTP,
    });

    tpOptimauxAchat = resultatTP.tpOptimauxAchat;
    tpOptimauxVente = resultatTP.tpOptimauxVente;

    // Primitives de lignes pour le moteur universel
    for (const tp of tpOptimauxAchat) {
      primitives.lignes?.push({
        id: `ligne-${tp.id}`,
        prix: tp.prixCible,
        dateDebut: derniereBougie.time,
        couleur: '#10b981',
        epaisseur: 1.5,
        style: 'dashed',
        label: `🎯 TP${tp.ordre} ACHAT : ${tp.prixCible.toFixed(4)} (+${tp.amplitudePoints.toFixed(4)})`,
      });
    }

    for (const tp of tpOptimauxVente) {
      primitives.lignes?.push({
        id: `ligne-${tp.id}`,
        prix: tp.prixCible,
        dateDebut: derniereBougie.time,
        couleur: '#f43f5e',
        epaisseur: 1.5,
        style: 'dashed',
        label: `🎯 TP${tp.ordre} VENTE : ${tp.prixCible.toFixed(4)} (-${tp.amplitudePoints.toFixed(4)})`,
      });
    }
  }

  return {
    pivots,
    vagues,
    vaguesSuperposees,
    paliersSuperposition,
    niveauxOuverts,
    plagesUniformesGlobales,
    tpOptimauxAchat,
    tpOptimauxVente,
    totalNiveauxOuverts: niveauxOuverts.length,
    step,
    prixActuel,
    primitives,
  };
}
