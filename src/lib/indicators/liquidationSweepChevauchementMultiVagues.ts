import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLabel, VisualLine, VisualPoint } from '@/types/indicatorScript';
import { determinerStepPrix } from '@/lib/indicators/unmitigatedVolumeProfile';
import {
  detecterPivotsZigZagAvance,
  construireSuperpositionVagues,
  type VagueOverlapProfile,
  type PalierChevauchement,
  type PalierSuperpositionVagues,
} from '@/lib/bot/modules/03_tp_uop/unmitigatedOverlapProfile';
import { validerDojiPersonnalise } from './liquidationReintegration';

/**
 * ==============================================================================
 * 📋 GUIDE DU DÉVELOPPEUR : CONDITIONS DU SETUP & RÈGLES DE MODIFICATION
 * ==============================================================================
 * Cet indicateur combine deux analyses complémentaires :
 *  1. Le chandelier Doji de retournement (Liq / Reint = Spring / UTAD)
 *  2. La cartographie de chevauchement multi-vagues UOP (Zones Fortes superposées)
 *
 * 🎯 OÙ TROUVER ET MODIFIER LE CODE DES CONDITIONS ?
 *  👉 Condition du Doji : fonction `validerDojiPersonnalise()` dans `liquidationReintegration.ts`.
 *  👉 Condition du Palier Multi-Vagues : fonction `validerPalierMultiVagues()` (vers la ligne 185).
 *
 * 🎯 LES CONDITIONS CLÉS DU SETUP POUR DÉVELOPPEUR JUNIOR :
 *
 * ─── CONDITION 1 : Formation du Doji Personnalisé ─────────────────────────────
 *  • B1 impulsive dans le sens du piège + B2 puissante en sens inverse.
 *  • Clôture de B2 au niveau d'Open1 (dépassement max: 25%, déficit max: 5%).
 *
 * ─── CONDITION 2 : Zone Forte UOP Superposée (dans validerPalierMultiVagues) ──
 *  • Le palier doit cumuler au moins `seuilBougiesBleuFonce` bougies (défaut: 3).
 *
 * ─── CONDITION 3 : Balayage par la Mèche du Doji (dans validerPalierMultiVagues) ─
 *  • Pour Achat : le point bas de la mèche doit traverser sous le palier.
 *  • Pour Vente : le point haut de la mèche doit percer au-dessus du palier.
 * ==============================================================================
 */

// ─── 📊 Structures et Types de Données ────────────────────────────────────────

/**
 * Options de configuration pour l'Indicateur 3 :
 * Liquidation & Réintégration combiné avec la Superposition Multi-Vagues UOP (Zones Fortes)
 */
export interface ParametresChevauchementMultiVagues {
  // ── 🎯 Paramètres UOP Multi-Vagues ──
  nbVaguesSuperposees?: number;   // Nombre de vagues ZigZag à superposer (défaut: 4)
  zigzagDepth?: number;           // Sensibilité des pivots ZigZag (défaut: 5)
  zigzagDeviation?: number;       // Déviation minimale en points (défaut: 0)
  zigzagBackstep?: number;        // Écart minimum en barres (défaut: 2)
  lookbackBars?: number;          // Historique analysé (défaut: 150)
  priceStep?: number;             // Pas de prix de chaque palier (auto si non fourni)
  seuilBougiesBleuFonce?: number; // Seuil min de bougies cumulées pour qualifier une zone forte (défaut: 3)
  exigerNiveauBalaye?: boolean;   // Exiger qu'une zone forte UOP ait été balayée (défaut: true)

  // ── 🕯️ Paramètres du Chandelier Liq/Reint ──
  toleranceDeficit?: number;      // Déficit admis en clôture (défaut: 0.05 = 5%)
  toleranceDepassement?: number;  // Dépassement favorable admis (défaut: 0.25 = 25%)
  activerFiltreTaille?: boolean;  // Active le filtre d'impulsion récente (défaut: true)
  periodeHistorique?: number;     // Période récente de référence (défaut: 10)
  multiplicateurBougie1?: number; // Multiplicateur Bougie 1 entière (défaut: 1.75x)
  multiplicateurCorps2?: number;  // Multiplicateur Corps 2 pur (défaut: 1.75x)

  // ── 🧭 Filtre de Tendance et Directions ──
  activerAchat?: boolean;
  activerVente?: boolean;
  activerFiltreTendance?: boolean;
  trendBars?: number;

  // ── 🎨 Affichage Graphique ──
  afficherSegmentDiscontinue?: boolean; // Segment horizontal en ligne discontinue (défaut: true)
  bullColor?: string;
  bearColor?: string;
  texteLabel?: string;
}

/**
 * Détails du palier UOP superposé retenu
 */
export interface PalierUOPSuperpose {
  prixPalier: number;
  sommeBougies: number;
  nbVaguesTraversees: number;
  estZoneForte: boolean;
  indexDebutZone: number;
  tempsDebutZone: number | string;
  profondeurSweep: number;
}

/**
 * Signal complet de setup avec chevauchement multi-vagues UOP
 */
export interface SignalChevauchementMultiVagues {
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
  palierUOP?: PalierUOPSuperpose;
}

/**
 * Résultat retourné par l'indicateur
 */
export interface ResultatChevauchementMultiVagues {
  signaux: SignalChevauchementMultiVagues[];
  primitives: VisualPrimitives;
  stepCalcule: number;
  statistiques: {
    totalSignaux: number;
    totalAchats: number;
    totalVentes: number;
    maxBougiesCumulees: number;
  };
}

// ─── 🎯 FONCTION CENTRALE DE VALIDATION DU PALIER MULTI-VAGUES (POUR LE DÉVELOPPEUR) ───

/**
 * Paramètres pour tester si un palier superposé UOP est une zone forte balayée valide.
 */
export interface ParametresValidationPalierMultiVagues {
  palierPrix: number;
  sommeBougies: number;
  estBleuFonce: boolean;
  seuilBleuFonce: number;
  direction: 'ACHAT' | 'VENTE';
  prixExtreme: number;
}

/**
 * ==============================================================================
 * 🎯 FONCTION CENTRALE DE VALIDATION DU PALIER MULTI-VAGUES (POUR LE DÉVELOPPEUR DÉBUTANT)
 * ==============================================================================
 * Rassemble en UN SEUL BLOC toutes les conditions pour qu'un palier superposé
 * UOP soit considéré comme zone forte balayée par le Doji.
 *
 * 💡 MODIFICATION RAPIDE :
 *  • Pour assouplir le seuil de zone forte : réduisez `seuilBleuFonce` (ex: 2 au lieu de 3).
 *
 * @returns {boolean} true si le palier respecte TOUTES les conditions, false sinon
 */
export function validerPalierMultiVagues(params: ParametresValidationPalierMultiVagues): boolean {
  const { palierPrix, sommeBougies, estBleuFonce, seuilBleuFonce, direction, prixExtreme } = params;

  // ─── 🔍 CONDITION 1 : Densité de Chevauchement (Zone Forte) ──────────────────
  if (!estBleuFonce && sommeBougies < seuilBleuFonce) return false;

  // ─── 🔍 CONDITION 2 : Balayage effectif par l'extrême du Doji ────────────────
  // Achat : le creux du setup doit avoir plongé sous ce palier
  // Vente : le sommet du setup doit avoir percé au-dessus de ce palier
  if (direction === 'ACHAT' && prixExtreme >= palierPrix) return false;
  if (direction === 'VENTE' && prixExtreme <= palierPrix) return false;

  // ✅ Zone forte validée !
  return true;
}

// ─── 🔍 Analyse de la Cartographie UOP Multi-Vagues ──────────────────────────

/**
 * Découpe les vagues ZigZag antérieures au setup et calcule la carte superposée des paliers UOP.
 * Sélectionne la zone forte de chevauchement la plus dense balayée par la mèche extrême.
 * 
 * Exemple :
 * const palier = trouverZoneForteUOPAdaptee(bougies, 'ACHAT', 95.0, 48, step, 4, 3);
 */
export function trouverZoneForteUOPAdaptee(
  bougies: Bougie[],
  direction: 'ACHAT' | 'VENTE',
  prixExtreme: number,
  indexSetup: number,
  step: number,
  nbVaguesMax: number = 4,
  seuilBleuFonce: number = 3,
  depth: number = 5,
  deviation: number = 0,
  backstep: number = 2
): PalierUOPSuperpose | null {
  if (indexSetup < 4 || step <= 0) return null;

  // 1️⃣ Détection des pivots ZigZag sur la fenêtre antérieure au setup
  const bougiesHistorique = bougies.slice(0, indexSetup);
  const pivots = detecterPivotsZigZagAvance(bougiesHistorique, {
    depth,
    deviation,
    backstep,
    inclureVagueCourante: false,
    lookbackBars: 200,
  });

  if (pivots.length < 2) return null;

  // 2️⃣ Extraction des N dernières vagues
  const vagues: VagueOverlapProfile[] = [];
  const nbVaguesDisponibles = pivots.length - 1;
  const debutV = Math.max(0, nbVaguesDisponibles - nbVaguesMax);

  for (let v = debutV; v < nbVaguesDisponibles; v++) {
    const ptA = pivots[v];
    const ptB = pivots[v + 1];
    const idxDebut = Math.min(ptA.index, ptB.index);
    const idxFin = Math.max(ptA.index, ptB.index);
    const totalB = Math.max(1, idxFin - idxDebut + 1);

    const bucketsMap = new Map<number, number>();
    for (let b = idxDebut; b <= idxFin; b++) {
      const bg = bougies[b];
      for (let p = bg.low; p <= bg.high; p += step) {
        const arr = Number((Math.round(p / step) * step).toFixed(5));
        bucketsMap.set(arr, (bucketsMap.get(arr) || 0) + 1);
      }
    }

    const paliers: PalierChevauchement[] = [];
    let maxBougies = 0;
    for (const [px, nbB] of bucketsMap.entries()) {
      if (nbB > maxBougies) maxBougies = nbB;
      paliers.push({
        price: px,
        nbBougiesChevauchement: nbB,
        pourcentageChevauchement: Math.round((nbB / totalB) * 100),
        isMitigated: false,
        indexDernierPassage: idxFin,
      });
    }

    vagues.push({
      id: v + 1,
      indexDebut: idxDebut,
      indexFin: idxFin,
      tempsDebut: ptA.temps,
      tempsFin: ptB.temps,
      prixDebut: ptA.prix,
      prixFin: ptB.prix,
      estHaussiere: ptB.prix > ptA.prix,
      totalBougiesVague: totalB,
      paliers,
      maxBougiesChevauchement: maxBougies,
      totalNiveauxNonMitigues: paliers.length,
      plagesUniformes: [],
    });
  }

  if (vagues.length === 0) return null;

  // 3️⃣ Construction de la superposition des vagues
  const mapSuperposee = construireSuperpositionVagues(vagues, step, seuilBleuFonce);

  // 4️⃣ Recherche du palier superposé le plus dense balayé par le setup
  let meilleurPalier: PalierUOPSuperpose | null = null;
  let maxBougiesCumul = 0;
  const premierIndexVagues = vagues[0].indexDebut;

  for (const palier of mapSuperposee.values()) {
    // ─── 🎯 VÉRIFICATION DES CONDITIONS DU PALIER MULTI-VAGUES ───
    const palierValide = validerPalierMultiVagues({
      palierPrix: palier.prix,
      sommeBougies: palier.sommeBougies,
      estBleuFonce: palier.estBleuFonce,
      seuilBleuFonce,
      direction,
      prixExtreme,
    });

    if (!palierValide) continue;

    if (palier.sommeBougies > maxBougiesCumul) {
      maxBougiesCumul = palier.sommeBougies;
      meilleurPalier = {
        prixPalier: palier.prix,
        sommeBougies: palier.sommeBougies,
        nbVaguesTraversees: palier.nbVagues,
        estZoneForte: palier.estBleuFonce,
        indexDebutZone: premierIndexVagues,
        tempsDebutZone: bougies[premierIndexVagues].time,
        profondeurSweep: Number(Math.abs(prixExtreme - palier.prix).toFixed(5)),
      };
    }
  }

  return meilleurPalier;
}

// ─── 🚀 Moteur Principal : Liq/Reint + Sweep Chevauchement Multi-Vagues ───────

/**
 * Calcule l'indicateur combinant le setup Liquidation/Réintégration
 * avec l'analyse de la cartographie de chevauchement multi-vagues UOP superposées.
 * 
 * Trace un segment horizontal en ligne discontinue (dashed) représentant le niveau de liquidité.
 * 
 * Exemple :
 * const res = calculerLiquidationSweepChevauchementMultiVagues(bougies, { nbVaguesSuperposees: 4 });
 */
export function calculerLiquidationSweepChevauchementMultiVagues(
  bougies: Bougie[],
  parametres: ParametresChevauchementMultiVagues = {}
): ResultatChevauchementMultiVagues {
  const labels: VisualLabel[] = [];
  const lignes: VisualLine[] = [];
  const points: VisualPoint[] = [];

  const defResultat: ResultatChevauchementMultiVagues = {
    signaux: [],
    primitives: { labels, lignes, boites: [], points },
    stepCalcule: 0.0001,
    statistiques: { totalSignaux: 0, totalAchats: 0, totalVentes: 0, maxBougiesCumulees: 0 },
  };

  if (!bougies || bougies.length < 5) return defResultat;

  // 1️⃣ Extraction des paramètres
  const params = parametres || {};
  const nbVaguesSuperposees = Math.max(1, Number(params.nbVaguesSuperposees ?? 4));
  const depth = Math.max(2, Number(params.zigzagDepth ?? 4));
  const deviation = Math.max(0, Number(params.zigzagDeviation ?? 0));
  const backstep = Math.max(1, Number(params.zigzagBackstep ?? 2));
  const seuilBleuFonce = Math.max(2, Number(params.seuilBougiesBleuFonce ?? 3));
  const exigerNiveauBalaye = params.exigerNiveauBalaye !== false;

  const valDeficit = params.toleranceDeficit !== undefined ? params.toleranceDeficit : 0.05;
  const toleranceDeficit = valDeficit > 1 ? valDeficit / 100 : valDeficit;
  const valDepassement = params.toleranceDepassement !== undefined ? params.toleranceDepassement : 0.25;
  const toleranceDepassement = valDepassement > 1 ? valDepassement / 100 : valDepassement;

  const activerFiltreTaille = params.activerFiltreTaille !== false;
  const periodeHistorique = Math.max(3, Number(params.periodeHistorique ?? 10));
  const multiplicateurBougie1 = Math.max(0.5, Number(params.multiplicateurBougie1 ?? 1.75));
  const multiplicateurCorps2 = Math.max(0.5, Number(params.multiplicateurCorps2 ?? 1.75));

  const activerAchat = params.activerAchat !== false;
  const activerVente = params.activerVente !== false;
  const activerFiltreTendance = Boolean(params.activerFiltreTendance);
  const trendBars = Math.max(1, Number(params.trendBars ?? 5));

  const afficherSegment = params.afficherSegmentDiscontinue !== false;
  const bullColor = params.bullColor || '#00E676';
  const bearColor = params.bearColor || '#F23645';
  const texteLabel = params.texteLabel || 'Liq/Reint';

  const step = determinerStepPrix(bougies, params.priceStep);

  const signaux: SignalChevauchementMultiVagues[] = [];
  let countAchats = 0;
  let countVentes = 0;
  let maxCumulGlobal = 0;

  // 2️⃣ Parcours séquentiel des bougies
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
      if (b2.low <= b1.low) {
        prixExtreme = b2.low;
        bougieExtreme = 2;
      } else {
        prixExtreme = b1.low;
        bougieExtreme = 1;
      }

      // Recherche de la zone forte superposée UOP balayée
      const palierTrouve = trouverZoneForteUOPAdaptee(
        bougies,
        'ACHAT',
        prixExtreme,
        i,
        step,
        nbVaguesSuperposees,
        seuilBleuFonce,
        depth,
        deviation,
        backstep
      );

      if (exigerNiveauBalaye && !palierTrouve) continue;

      if (palierTrouve && palierTrouve.sommeBougies > maxCumulGlobal) {
        maxCumulGlobal = palierTrouve.sommeBougies;
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
        palierUOP: palierTrouve || undefined,
      });

      const titreSignal = palierTrouve ? 'Spring Chevauchement' : texteLabel;
      const badgeDetails = palierTrouve
        ? `\nZone UOP (${palierTrouve.prixPalier.toFixed(4)}) [${palierTrouve.sommeBougies}b - ${palierTrouve.nbVaguesTraversees}v]`
        : '';

      labels.push({
        id: `muop-achat-lbl-${i}`,
        prix: b2.low,
        date: b2.time,
        texte: `${titreSignal}${badgeDetails}`,
        couleur: bullColor,
        position: 'below',
      });

      points.push({
        id: `muop-achat-pt-${i}`,
        prix: prixExtreme,
        date: bougieExtreme === 1 ? b1.time : b2.time,
        couleur: bullColor,
      });

      // SEGMENT EN LIGNE DISCONTINUE (DASHED) : niveau de la zone UOP balayé
      if (palierTrouve && afficherSegment) {
        lignes.push({
          id: `muop-ligne-achat-${i}`,
          prix: palierTrouve.prixPalier,
          dateDebut: palierTrouve.tempsDebutZone,
          dateFin: b2.time,
          couleur: bullColor,
          epaisseur: 1.8,
          style: 'dashed',
          label: `🎯 Zone UOP [${palierTrouve.sommeBougies}b]`,
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

      // Recherche de la zone forte superposée UOP balayée en vente
      const palierTrouve = trouverZoneForteUOPAdaptee(
        bougies,
        'VENTE',
        prixExtreme,
        i,
        step,
        nbVaguesSuperposees,
        seuilBleuFonce,
        depth,
        deviation,
        backstep
      );

      if (exigerNiveauBalaye && !palierTrouve) continue;

      if (palierTrouve && palierTrouve.sommeBougies > maxCumulGlobal) {
        maxCumulGlobal = palierTrouve.sommeBougies;
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
        palierUOP: palierTrouve || undefined,
      });

      const titreSignal = palierTrouve ? 'UTAD Chevauchement' : texteLabel;
      const badgeDetails = palierTrouve
        ? `\nZone UOP (${palierTrouve.prixPalier.toFixed(4)}) [${palierTrouve.sommeBougies}b - ${palierTrouve.nbVaguesTraversees}v]`
        : '';

      labels.push({
        id: `muop-vente-lbl-${i}`,
        prix: b2.high,
        date: b2.time,
        texte: `${titreSignal}${badgeDetails}`,
        couleur: bearColor,
        position: 'above',
      });

      points.push({
        id: `muop-vente-pt-${i}`,
        prix: prixExtreme,
        date: bougieExtreme === 1 ? b1.time : b2.time,
        couleur: bearColor,
      });

      // SEGMENT EN LIGNE DISCONTINUE (DASHED) : niveau de la zone UOP balayé
      if (palierTrouve && afficherSegment) {
        lignes.push({
          id: `muop-ligne-vente-${i}`,
          prix: palierTrouve.prixPalier,
          dateDebut: palierTrouve.tempsDebutZone,
          dateFin: b2.time,
          couleur: bearColor,
          epaisseur: 1.8,
          style: 'dashed',
          label: `🎯 Zone UOP [${palierTrouve.sommeBougies}b]`,
        });
      }
    }
  }

  return {
    signaux,
    primitives: { labels, lignes, boites: [], points },
    stepCalcule: step,
    statistiques: {
      totalSignaux: signaux.length,
      totalAchats: countAchats,
      totalVentes: countVentes,
      maxBougiesCumulees: maxCumulGlobal,
    },
  };
}
