import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLabel, VisualLine, VisualBox, VisualPoint } from '@/types/indicatorScript';
import {
  calculerShvedSupplyDemand,
  type ZoneShved,
  type ForceZoneShved,
  type OptionsShvedSupplyDemand,
} from '@/lib/bot/modules/01_liquidite/shvedSupplyDemand';
import { validerDojiPersonnalise } from './liquidationReintegration';

/**
 * ==============================================================================
 * 📋 GUIDE DU DÉVELOPPEUR : CONDITIONS DU SETUP & RÈGLES DE MODIFICATION
 * ==============================================================================
 * Cet indicateur combine deux analyses complémentaires :
 *  1. Le Doji de retournement (Liq / Reint = Spring / UTAD)
 *  2. La zone Shved Supply & Demand balayée (avec détection de Re-Sweep)
 *
 * 🎯 OÙ TROUVER ET MODIFIER LE CODE DES CONDITIONS ?
 *  👉 Condition du Doji : fonction `validerDojiPersonnalise()` dans `liquidationReintegration.ts`.
 *  👉 Condition de la Zone Shved : fonction `validerZoneShvedPourSweep()` (vers la ligne 170).
 *
 * 🎯 LES CONDITIONS CLÉS DU SETUP POUR DÉVELOPPEUR JUNIOR :
 *
 * ─── RÈGLE 1 : Formation du Doji Personnalisé ─────────────────────────────────
 *  • B1 impulsive dans le sens du piège + B2 puissante en sens inverse.
 *  • Clôture de B2 au niveau d'Open1 (dépassement max: 25%, déficit max: 5%).
 *
 * ─── RÈGLE 2 : Balayage de la Zone Shved (dans validerZoneShvedPourSweep) ──────
 *  • Pour Achat (Spring) : la mèche basse perce dans ou sous le Support Demand.
 *  • Pour Vente (UTAD)   : la mèche haute perce dans ou sur la Résistance Supply.
 *
 * ─── RÈGLE 3 : Intégrité Unmitigated (dans validerZoneShvedPourSweep) ──────────
 *  • La zone ne doit JAMAIS avoir été clôturée au-delà avant le Doji actuel.
 *
 * ─── RÈGLE 4 : Récence & Fraîcheur (dans validerZoneShvedPourSweep) ────────────
 *  • La zone doit se situer dans les `lookbackMaxBars` dernières bougies (défaut: 40).
 * ==============================================================================
 */

/**
 * Options de configuration pour l'indicateur combiné :
 * Liquidation & Réintégration avec Détection de la Liquidité Balayée sur Shved Supply & Demand.
 * 
 * Vise spécifiquement la liquidité la plus PROCHE, RÉCENTE et NON CONSOMMÉE (Unmitigated),
 * correspondant au comportement institutionnel réel d'un Spring ou UTAD (Wyckoff),
 * avec détection des doubles liquidations (Re-Sweep de confirmation).
 */
export interface ParametresLiquidationSweepShved {
  // ── 🛡️ Paramètres Shved Supply & Demand ──
  // Période ATR pour dimensionner l'épaisseur dynamique de la zone (défaut: 7)
  periodeATR?: number;
  // Facteur d'épaisseur de zone ATR (défaut: 0.75)
  zoneFuzzFactor?: number;
  // Nombre minimum de retests requis pour qu'une zone soit prise en compte (défaut: 0 = inclut les zones fraîches)
  minRetests?: number;
  // Force minimale exigée pour la zone :
  // 'TOUTES' : inclut UNTESTED, VERIFIED et PROVEN
  // 'VERIFIED_MIN' : exige au moins 1 retest (VERIFIED ou PROVEN)
  // 'PROVEN_SEULEMENT' : exige une zone majeure ultra-testée (> 3 retests)
  forceMinimaleZone?: 'TOUTES' | 'VERIFIED_MIN' | 'PROVEN_SEULEMENT';
  // Timeframe source pour l'analyse multi-timeframe / Lower Timeframe (défaut: 'M15' ou 'ACTUEL')
  timeframeSource?: string;
  // Données brutes M1 éventuelles pour reconstruire le LTF
  donneesM1?: Bougie[];
  // Si true, le signal n'est validé QUE si une vraie zone Shved a été balayée (défaut: true)
  exigerZoneShvedBalayee?: boolean;

  // ── 🎯 Fraîcheur & Précision de la Liquidité (Wyckoff Spring/UTAD) ──
  // Nombre maximum de bougies dans le passé pour chercher la zone balayée (défaut: 40)
  // Évite d'aller chercher trop loin des zones déjà obsolètes ou hors-sujet
  lookbackMaxBars?: number;
  // Exiger que la zone n'ait JAMAIS été clôturée au-delà avant notre setup (Unmitigated) (défaut: true)
  exigerZoneIntacte?: boolean;
  // Détecter et signaler les doubles liquidations (Re-Sweep / Confirmation de purge) (défaut: true)
  detecterDoubleLiquidation?: boolean;

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
  // Afficher la zone Shved en boîte rectangulaire (défaut: true)
  afficherZoneShved?: boolean;
  // Afficher la boîte de la zone de sweep (défaut: true)
  afficherZoneSweep?: boolean;
  // Afficher la ligne reliant la zone au setup (défaut: true)
  afficherLigneConnexion?: boolean;
  bullColor?: string;
  bearColor?: string;
  texteLabel?: string;
}

/**
 * Détail d'un signal combiné Liq/Reint + Shved Supply & Demand
 */
export interface SignalLiquidationSweepShved {
  type: 'ACHAT' | 'VENTE';
  indexBougie: number;
  temps: number | string;
  prixSignal: number;
  prixExtreme: number;
  bougieExtreme: 1 | 2;
  open1: number;
  close2: number;
  ecartPrix: number;
  ratioEcart: number;
  situationCloture: 'DEPASSEMENT' | 'RETRAIT';
  rangeBougie1: number;
  corpsBougie2: number;
  zoneShved?: ZoneShved;
  profondeurSweep?: number;
  estDoubleLiquidation?: boolean;
  prixPremiereLiquidation?: number;
}

/**
 * Résultat complet retourné par l'indicateur
 */
export interface ResultatLiquidationSweepShved {
  signaux: SignalLiquidationSweepShved[];
  primitives: VisualPrimitives;
  zonesDetectees: {
    totalSupports: number;
    totalResistances: number;
  };
  statistiques: {
    totalSignaux: number;
    totalAchats: number;
    totalVentes: number;
    totalSweepsShved: number;
    totalDoubleLiquidations: number;
    totalProven: number;
    totalVerified: number;
    maxRetestsZone: number;
  };
}

/**
 * Vérifie si une zone respecte la force minimale configurée
 */
function respecteForceMinimale(force: ForceZoneShved, forceMin: string): boolean {
  if (forceMin === 'PROVEN_SEULEMENT') {
    return force === 'PROVEN';
  }
  if (forceMin === 'VERIFIED_MIN') {
    return force === 'PROVEN' || force === 'VERIFIED';
  }
  return true; // 'TOUTES'
}

/**
 * Information sur la zone Shved la plus adaptée balayée par le setup
 */
interface InfoZoneShvedCandidate {
  zone: ZoneShved;
  profondeur: number;
  estDoubleLiquidation: boolean;
  prixPremiereLiquidation?: number;
  scorePertinence: number;
}

// ─── 🎯 FONCTION CENTRALE DE VALIDATION DE LA ZONE SHVED (POUR LE DÉVELOPPEUR) ───

/**
 * Paramètres pour tester si une zone Shved candidate est éligible au balayage par le Doji.
 */
export interface ParametresValidationZoneSweep {
  zone: ZoneShved;
  direction: 'ACHAT' | 'VENTE';
  prixExtreme: number;
  indexSetup: number;
  bougies: Bougie[];
  forceMin?: string;
  minRetests?: number;
  prixReferenceHaut?: number;
  prixReferenceBas?: number;
  lookbackMaxBars?: number;
  exigerZoneIntacte?: boolean;
}

/**
 * ==============================================================================
 * 🎯 FONCTION CENTRALE DE VALIDATION DE LA ZONE SHVED (POUR LE DÉVELOPPEUR DÉBUTANT)
 * ==============================================================================
 * Rassemble en UN SEUL BLOC toutes les conditions pour qu'une zone Shved
 * soit considérée comme balayée et valide pour le setup institutionnel (Wyckoff).
 *
 * 💡 COMMENT L'AJUSTER OU LA MODIFIER ?
 *  • Pour désactiver l'exigence de non-consommation : commentez la CONDITION 5.
 *  • Pour accepter les zones anciennes : augmentez `lookbackMaxBars`.
 *  • Pour accepter les zones sans retest : mettez `minRetests: 0`.
 *
 * @returns {boolean} true si la zone respecte TOUTES les conditions, false sinon
 */
export function validerZoneShvedPourSweep(params: ParametresValidationZoneSweep): boolean {
  const {
    zone,
    direction,
    prixExtreme,
    indexSetup,
    bougies,
    forceMin = 'TOUTES',
    minRetests = 0,
    prixReferenceHaut = Infinity,
    prixReferenceBas = -Infinity,
    lookbackMaxBars = 40,
    exigerZoneIntacte = true,
  } = params;

  // ─── 🔍 CONDITION 1 : Antériorité de la zone ───────────────────────────────
  // La zone doit exister AVANT les deux bougies du Doji
  if (zone.indexOrigine >= indexSetup - 1) return false;

  // ─── 🔍 CONDITION 2 : Fraîcheur & Fenêtre récente (Lookback) ───────────────
  // Évite d'aller chercher de vieux niveaux obsolètes
  const ecartBougies = indexSetup - zone.indexOrigine;
  if (ecartBougies > lookbackMaxBars) return false;

  // ─── 🔍 CONDITION 3 : Retests minimaux et force institutionnelle ───────────
  if (zone.retests < minRetests) return false;
  if (!respecteForceMinimale(zone.force, forceMin)) return false;

  // ─── 🔍 CONDITION 4 : Balayage effectif par la mèche du chandelier ──────────
  if (direction === 'ACHAT') {
    if (zone.type !== 'SUPPORT') return false;
    const estBalayee = prixExtreme <= zone.prixHaut && zone.prixBas <= prixReferenceHaut;
    if (!estBalayee) return false;
  } else {
    if (zone.type !== 'RESISTANCE') return false;
    const estBalayee = prixExtreme >= zone.prixBas && zone.prixHaut >= prixReferenceBas;
    if (!estBalayee) return false;
  }

  // ─── 🔍 CONDITION 5 : Intégrité (Unmitigated / Zone non consommée) ──────────
  // Aucune bougie entre la création de la zone et le setup ne doit avoir clôturé au-delà
  if (exigerZoneIntacte) {
    const indexFinControle = Math.max(zone.indexOrigine + 1, indexSetup - 2);
    for (let k = zone.indexOrigine + 1; k < indexFinControle; k++) {
      if (bougies[k]) {
        if (direction === 'ACHAT' && bougies[k].close < zone.prixBas) return false;
        if (direction === 'VENTE' && bougies[k].close > zone.prixHaut) return false;
      }
    }
  }

  // ✅ Toutes les conditions de la zone sont satisfaites
  return true;
}

/**
 * Recherche parmi les zones Shved la zone la plus pertinente balayée par le point extrême :
 * 1. Proximité temporelle (récente dans les N dernières bougies)
 * 2. Non-consommée (Unmitigated) : aucune clôture antérieure n'a traversé la zone
 * 3. Détection de la double liquidation : si une mèche récente a déjà effleuré la zone
 */
function identifierZoneShvedLaPlusAdaptee(
  zones: ZoneShved[],
  direction: 'ACHAT' | 'VENTE',
  prixExtreme: number,
  indexSetup: number,
  bougies: Bougie[],
  options: {
    forceMin: string;
    minRetests: number;
    prixReferenceHaut: number;
    prixReferenceBas: number;
    lookbackMaxBars: number;
    exigerZoneIntacte: boolean;
    detecterDoubleLiquidation: boolean;
  }
): InfoZoneShvedCandidate | null {
  const candidates: InfoZoneShvedCandidate[] = [];
  const {
    forceMin,
    minRetests,
    prixReferenceHaut,
    prixReferenceBas,
    lookbackMaxBars,
    exigerZoneIntacte,
    detecterDoubleLiquidation,
  } = options;

  for (const zone of zones) {
    // ─── 🎯 VÉRIFICATION DES CONDITIONS DE LA ZONE CANDIDATE ───
    const zoneValide = validerZoneShvedPourSweep({
      zone,
      direction,
      prixExtreme,
      indexSetup,
      bougies,
      forceMin,
      minRetests,
      prixReferenceHaut,
      prixReferenceBas,
      lookbackMaxBars,
      exigerZoneIntacte,
    });

    if (!zoneValide) continue;

    const ecartBougies = indexSetup - zone.indexOrigine;
    let estDoubleLiq = false;
    let prixPremLiq: number | undefined = undefined;

    // Détection de la Double Liquidation (Re-Sweep de Confirmation)
    if (detecterDoubleLiquidation) {
      const b1 = bougies[indexSetup - 1];
      const b2 = bougies[indexSetup];

      if (direction === 'ACHAT') {
        if (b1 && b2 && b2.low < b1.low && b1.low <= zone.prixHaut) {
          estDoubleLiq = true;
          prixPremLiq = b1.low;
        } else {
          const indexDebutRecent = Math.max(0, indexSetup - 6);
          let minRecent = Infinity;
          for (let m = indexDebutRecent; m <= indexSetup - 2; m++) {
            if (bougies[m] && bougies[m].low <= zone.prixHaut) {
              if (bougies[m].low < minRecent) minRecent = bougies[m].low;
            }
          }
          if (minRecent < Infinity && prixExtreme < minRecent) {
            estDoubleLiq = true;
            prixPremLiq = minRecent;
          }
        }
      } else {
        if (b1 && b2 && b2.high > b1.high && b1.high >= zone.prixBas) {
          estDoubleLiq = true;
          prixPremLiq = b1.high;
        } else {
          const indexDebutRecent = Math.max(0, indexSetup - 6);
          let maxRecent = -Infinity;
          for (let m = indexDebutRecent; m <= indexSetup - 2; m++) {
            if (bougies[m] && bougies[m].high >= zone.prixBas) {
              if (bougies[m].high > maxRecent) maxRecent = bougies[m].high;
            }
          }
          if (maxRecent > -Infinity && prixExtreme > maxRecent) {
            estDoubleLiq = true;
            prixPremLiq = maxRecent;
          }
        }
      }
    }

    const scoreRecence = Math.max(0, 100 - ecartBougies * 2);
    const bonusRetests = Math.min(zone.retests, 5) * 8;
    const bonusDoubleLiq = estDoubleLiq ? 35 : 0;
    const scorePertinence = scoreRecence + bonusRetests + bonusDoubleLiq;

    const profondeur = direction === 'ACHAT'
      ? Math.max(0, zone.prixBas - prixExtreme)
      : Math.max(0, prixExtreme - zone.prixHaut);

    candidates.push({
      zone,
      profondeur,
      estDoubleLiquidation: estDoubleLiq,
      prixPremiereLiquidation: prixPremLiq,
      scorePertinence,
    });
  }

  if (candidates.length === 0) return null;

  // 7️⃣ Sélection de la zone ayant le meilleur score (la plus fraîche et adaptée)
  return candidates.reduce((meilleur, c) => {
    return c.scorePertinence > meilleur.scorePertinence ? c : meilleur;
  }, candidates[0]);
}

/**
 * Indicateur combiné : Détecte le setup de réintégration (Liq/Reint)
 * et identifie précisément quelle zone Shved Supply & Demand
 * a été balayée (avec force PROVEN/VERIFIED, récence et détection double sweep).
 * 
 * Exemple :
 * const res = calculerLiquidationSweepShved(bougies, { lookbackMaxBars: 40 });
 */
export function calculerLiquidationSweepShved(
  bougies: Bougie[],
  options?: ParametresLiquidationSweepShved
): ResultatLiquidationSweepShved {
  if (!bougies || bougies.length < 10) {
    return {
      signaux: [],
      primitives: { labels: [], lignes: [], boites: [], points: [] },
      zonesDetectees: { totalSupports: 0, totalResistances: 0 },
      statistiques: {
        totalSignaux: 0,
        totalAchats: 0,
        totalVentes: 0,
        totalSweepsShved: 0,
        totalDoubleLiquidations: 0,
        totalProven: 0,
        totalVerified: 0,
        maxRetestsZone: 0,
      },
    };
  }

  // 1️⃣ Extraction des paramètres
  const params = options || {};
  const valDeficit = params.toleranceDeficit !== undefined ? params.toleranceDeficit : 0.05;
  const toleranceDeficit = valDeficit > 1 ? valDeficit / 100 : valDeficit;
  const valDepassement = params.toleranceDepassement !== undefined ? params.toleranceDepassement : 0.25;
  const toleranceDepassement = valDepassement > 1 ? valDepassement / 100 : valDepassement;

  const periodeATR = Math.max(3, Number(params.periodeATR ?? 7));
  const zoneFuzzFactor = Math.max(0.1, Number(params.zoneFuzzFactor ?? 0.75));
  const minRetests = Math.max(0, Number(params.minRetests ?? 0)); // 0 par défaut pour ne pas bloquer les zones fraîches
  const forceMin = params.forceMinimaleZone || 'TOUTES';
  const exigerZoneShved = params.exigerZoneShvedBalayee !== false;

  // Précision et récence (anti-recherche trop loin)
  const lookbackMaxBars = Math.max(10, Math.min(200, Number(params.lookbackMaxBars ?? 40)));
  const exigerZoneIntacte = params.exigerZoneIntacte !== false;
  const detecterDoubleLiquidation = params.detecterDoubleLiquidation !== false;

  const activerFiltreTaille = params.activerFiltreTaille !== false;
  const periodeHistorique = Math.max(3, Number(params.periodeHistorique ?? 10));
  const multiplicateurBougie1 = Math.max(0.5, Number(params.multiplicateurBougie1 ?? 1.75));
  const multiplicateurCorps2 = Math.max(0.5, Number(params.multiplicateurCorps2 ?? 1.75));

  const activerAchat = params.activerAchat !== false;
  const activerVente = params.activerVente !== false;
  const activerFiltreTendance = Boolean(params.activerFiltreTendance);
  const trendBars = Math.max(1, Number(params.trendBars ?? 5));

  // Par défaut false : l'utilisateur préfère un segment en ligne discontinue plutôt qu'une zone en rectangle
  const afficherZone = Boolean(params.afficherZoneShved);
  const afficherSweep = Boolean(params.afficherZoneSweep);
  const afficherLigne = params.afficherLigneConnexion !== false;
  const bullColor = params.bullColor || '#00E676';
  const bearColor = params.bearColor || '#F23645';
  const texteLabel = params.texteLabel || 'Liq/Reint';

  // 2️⃣ Calcul des zones Shved Supply & Demand
  const optionsShved: OptionsShvedSupplyDemand = {
    periodeATR,
    zoneFuzzFactor,
    minRetests,
    supprimerZonesCassees: false, // On conserve l'historique complet pour vérifier nous-mêmes la non-consommation exacte
    timeframeSource: params.timeframeSource || 'ACTUEL',
    donneesM1: params.donneesM1,
  };

  const resultatShved = calculerShvedSupplyDemand(bougies, optionsShved);
  const supports = resultatShved.supports || [];
  const resistances = resultatShved.resistances || [];

  const signaux: SignalLiquidationSweepShved[] = [];
  const labels: VisualLabel[] = [];
  const lignes: VisualLine[] = [];
  const boites: VisualBox[] = [];
  const points: VisualPoint[] = [];

  let countAchats = 0;
  let countVentes = 0;
  let countSweepsShved = 0;
  let countDoubleLiq = 0;
  let countProven = 0;
  let countVerified = 0;
  let maxRetests = 0;

  // 3️⃣ Parcours linéaire des bougies pour détecter le setup Liq/Reint (Spring/UTAD)
  for (let i = 1; i < bougies.length; i++) {
    const b1 = bougies[i - 1];
    const b2 = bougies[i];

    // Moyennes historiques pour le Doji
    let moyRange = 0;
    let moyCorps = 0;
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
        moyRange = sommeRanges / nbBougiesHist;
        moyCorps = sommeCorps / nbBougiesHist;
      }
    }

    const idxTrend = Math.max(0, i - trendBars);
    const openTrend = bougies[idxTrend].open;

    // ─── 🎯 VÉRIFICATION CENTRALISÉE DU DOJI ───
    const valDoji = validerDojiPersonnalise({
      b1,
      b2,
      moyRangeHist: moyRange,
      moyCorpsHist: moyCorps,
      openTendance: openTrend,
      activerAchat,
      activerVente,
      activerFiltreTaille,
      activerFiltreTendance,
      toleranceDeficit,
      toleranceDepassement,
      multiplicateurBougie1,
      multiplicateurCorps2,
    });

    if (!valDoji.estValide) continue;

    const estCandidatAchat = valDoji.type === 'ACHAT';
    const estCandidatVente = valDoji.type === 'VENTE';
    const situationCloture = valDoji.situationCloture;
    const ecartPrix = valDoji.ecartPrix;
    const ratioEcart = valDoji.ratioEcart;
    const range1 = valDoji.rangeBougie1;
    const corps2 = valDoji.corpsBougie2;

    let prixExtreme = 0;
    let bougieExtreme: 1 | 2 = 1;

    if (estCandidatAchat) {
      // 🟢 En Achat : identification du point bas extrême balayeur
      if (b2.low <= b1.low) {
        prixExtreme = b2.low;
        bougieExtreme = 2;
      } else {
        prixExtreme = b1.low;
        bougieExtreme = 1;
      }

      // Recherche de la zone Demand (Support Shved) balayée
      const candidateInfo = identifierZoneShvedLaPlusAdaptee(
        supports,
        'ACHAT',
        prixExtreme,
        i,
        bougies,
        {
          forceMin,
          minRetests,
          prixReferenceHaut: Math.max(b1.open, b1.high),
          prixReferenceBas: b1.low,
          lookbackMaxBars,
          exigerZoneIntacte,
          detecterDoubleLiquidation,
        }
      );

      if (exigerZoneShved && !candidateInfo) continue;

      if (candidateInfo) {
        countSweepsShved++;
        if (candidateInfo.estDoubleLiquidation) countDoubleLiq++;
        if (candidateInfo.zone.force === 'PROVEN') countProven++;
        else if (candidateInfo.zone.force === 'VERIFIED') countVerified++;
        if (candidateInfo.zone.retests > maxRetests) maxRetests = candidateInfo.zone.retests;
      }
      countAchats++;

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
        zoneShved: candidateInfo?.zone,
        profondeurSweep: candidateInfo?.profondeur,
        estDoubleLiquidation: candidateInfo?.estDoubleLiquidation,
        prixPremiereLiquidation: candidateInfo?.prixPremiereLiquidation,
      });

      // Construction du badge textuel
      let titreSignal = texteLabel;
      if (candidateInfo?.estDoubleLiquidation) {
        titreSignal = `2x Liq (Re-Sweep)`;
      } else if (candidateInfo) {
        titreSignal = `Spring Sweep`;
      }

      const badgeDetails = candidateInfo
        ? `\nDemand (${candidateInfo.zone.prixMedian.toFixed(4)}) [${candidateInfo.zone.force}]`
        : '';

      labels.push({
        id: `shved-achat-lbl-${i}`,
        prix: b2.low,
        date: b2.time,
        texte: `${titreSignal}${badgeDetails}`,
        couleur: bullColor,
        position: 'below',
      });

      points.push({
        id: `shved-achat-pt-${i}`,
        prix: prixExtreme,
        date: bougieExtreme === 1 ? b1.time : b2.time,
        couleur: bullColor,
      });

      if (candidateInfo && afficherZone) {
        boites.push({
          id: `shved-zone-demand-${i}`,
          prixHaut: candidateInfo.zone.prixHaut,
          prixBas: candidateInfo.zone.prixBas,
          dateDebut: candidateInfo.zone.dateDebut,
          dateFin: b2.time,
          couleurFond: 'rgba(0, 230, 118, 0.12)',
          couleurBordure: bullColor,
          label: `Zone Demand (${candidateInfo.zone.force} - ${candidateInfo.zone.retests}t)`,
        });
      }

      if (candidateInfo && afficherSweep) {
        boites.push({
          id: `shved-sweep-demand-${i}`,
          prixHaut: candidateInfo.zone.prixBas,
          prixBas: prixExtreme,
          dateDebut: b1.time,
          dateFin: b2.time,
          couleurFond: 'rgba(0, 230, 118, 0.28)',
          couleurBordure: bullColor,
          label: candidateInfo.estDoubleLiquidation ? `2x Sweep (-${candidateInfo.profondeur.toFixed(4)})` : `Sweep (-${candidateInfo.profondeur.toFixed(4)})`,
        });
      }

      if (candidateInfo && afficherLigne) {
        lignes.push({
          id: `shved-ligne-demand-${i}`,
          prix: candidateInfo.zone.prixMedian,
          dateDebut: candidateInfo.zone.dateDebut,
          dateFin: b2.time,
          couleur: bullColor,
          epaisseur: 1.5,
          style: 'dashed',
          label: `Demand Médian (${candidateInfo.zone.prixMedian.toFixed(4)})`,
        });
      }

    } else if (estCandidatVente) {
      // 🔴 En Vente : identification du point haut extrême balayeur
      if (b2.high >= b1.high) {
        prixExtreme = b2.high;
        bougieExtreme = 2;
      } else {
        prixExtreme = b1.high;
        bougieExtreme = 1;
      }

      // Recherche de la zone Supply (Résistance Shved) balayée
      const candidateInfo = identifierZoneShvedLaPlusAdaptee(
        resistances,
        'VENTE',
        prixExtreme,
        i,
        bougies,
        {
          forceMin,
          minRetests,
          prixReferenceHaut: b1.high,
          prixReferenceBas: Math.min(b1.open, b1.low),
          lookbackMaxBars,
          exigerZoneIntacte,
          detecterDoubleLiquidation,
        }
      );

      if (exigerZoneShved && !candidateInfo) continue;

      if (candidateInfo) {
        countSweepsShved++;
        if (candidateInfo.estDoubleLiquidation) countDoubleLiq++;
        if (candidateInfo.zone.force === 'PROVEN') countProven++;
        else if (candidateInfo.zone.force === 'VERIFIED') countVerified++;
        if (candidateInfo.zone.retests > maxRetests) maxRetests = candidateInfo.zone.retests;
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
        zoneShved: candidateInfo?.zone,
        profondeurSweep: candidateInfo?.profondeur,
        estDoubleLiquidation: candidateInfo?.estDoubleLiquidation,
        prixPremiereLiquidation: candidateInfo?.prixPremiereLiquidation,
      });

      let titreSignal = texteLabel;
      if (candidateInfo?.estDoubleLiquidation) {
        titreSignal = `2x Liq (Re-Sweep)`;
      } else if (candidateInfo) {
        titreSignal = `UTAD Sweep`;
      }

      const badgeDetails = candidateInfo
        ? `\nSupply (${candidateInfo.zone.prixMedian.toFixed(4)}) [${candidateInfo.zone.force}]`
        : '';

      labels.push({
        id: `shved-vente-lbl-${i}`,
        prix: b2.high,
        date: b2.time,
        texte: `${titreSignal}${badgeDetails}`,
        couleur: bearColor,
        position: 'above',
      });

      points.push({
        id: `shved-vente-pt-${i}`,
        prix: prixExtreme,
        date: bougieExtreme === 1 ? b1.time : b2.time,
        couleur: bearColor,
      });

      if (candidateInfo && afficherZone) {
        boites.push({
          id: `shved-zone-supply-${i}`,
          prixHaut: candidateInfo.zone.prixHaut,
          prixBas: candidateInfo.zone.prixBas,
          dateDebut: candidateInfo.zone.dateDebut,
          dateFin: b2.time,
          couleurFond: 'rgba(242, 54, 69, 0.12)',
          couleurBordure: bearColor,
          label: `Zone Supply (${candidateInfo.zone.force} - ${candidateInfo.zone.retests}t)`,
        });
      }

      if (candidateInfo && afficherSweep) {
        boites.push({
          id: `shved-sweep-supply-${i}`,
          prixHaut: prixExtreme,
          prixBas: candidateInfo.zone.prixHaut,
          dateDebut: b1.time,
          dateFin: b2.time,
          couleurFond: 'rgba(242, 54, 69, 0.28)',
          couleurBordure: bearColor,
          label: candidateInfo.estDoubleLiquidation ? `2x Sweep (+${candidateInfo.profondeur.toFixed(4)})` : `Sweep (+${candidateInfo.profondeur.toFixed(4)})`,
        });
      }

      if (candidateInfo && afficherLigne) {
        lignes.push({
          id: `shved-ligne-supply-${i}`,
          prix: candidateInfo.zone.prixMedian,
          dateDebut: candidateInfo.zone.dateDebut,
          dateFin: b2.time,
          couleur: bearColor,
          epaisseur: 1.5,
          style: 'dashed',
          label: `Supply Médian (${candidateInfo.zone.prixMedian.toFixed(4)})`,
        });
      }
    }
  }

  return {
    signaux,
    primitives: { labels, lignes, boites, points },
    zonesDetectees: {
      totalSupports: supports.length,
      totalResistances: resistances.length,
    },
    statistiques: {
      totalSignaux: signaux.length,
      totalAchats: countAchats,
      totalVentes: countVentes,
      totalSweepsShved: countSweepsShved,
      totalDoubleLiquidations: countDoubleLiq,
      totalProven: countProven,
      totalVerified: countVerified,
      maxRetestsZone: maxRetests,
    },
  };
}
