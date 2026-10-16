import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLabel, VisualLine, VisualPoint } from '@/types/indicatorScript';
import { determinerStepPrix } from '@/lib/indicators/unmitigatedVolumeProfile';
import { validerDojiPersonnalise } from './liquidationReintegration';

/**
 * ==============================================================================
 * 📋 GUIDE DU DÉVELOPPEUR : CONDITIONS DU SETUP & RÈGLES DE MODIFICATION
 * ==============================================================================
 * Cet indicateur combine deux analyses complémentaires :
 *  1. Le chandelier Doji de retournement (Liq / Reint = Spring / UTAD)
 *  2. Le palier horizontal dense formé par le chevauchement des mèches extrêmes
 *
 * 🎯 OÙ TROUVER ET MODIFIER LE CODE DES CONDITIONS ?
 *  👉 Condition du Doji : fonction `validerDojiPersonnalise()` dans `liquidationReintegration.ts`.
 *  👉 Condition du Palier Extrême : fonction `validerPalierExtreme()` (vers la ligne 170).
 *
 * 🎯 LES CONDITIONS CLÉS DU SETUP POUR DÉVELOPPEUR JUNIOR :
 *
 * ─── CONDITION 1 : Formation du Doji Personnalisé ─────────────────────────────
 *  • B1 impulsive dans le sens du piège + B2 puissante en sens inverse.
 *  • Clôture de B2 au niveau d'Open1 (dépassement max: 25%, déficit max: 5%).
 *
 * ─── CONDITION 2 : Chevauchement des Mèches Extrêmes (dans validerPalierExtreme) ─
 *  • Au moins `minBougiesChevauchement` bougies (défaut: 2) ont aligné leurs mèches
 *    sur le même palier de prix (support ou résistance horizontal).
 *
 * ─── CONDITION 3 : Balayage par la Mèche du Doji (dans validerPalierExtreme) ──
 *  • Pour Achat : le point bas de la mèche doit traverser sous le palier.
 *  • Pour Vente : le point haut de la mèche doit percer au-dessus du palier.
 *
 * ─── CONDITION 4 : Intégrité Unmitigated (dans validerPalierExtreme) ──────────
 *  • Aucune bougie entre la fin du palier et le Doji ne doit avoir clôturé au-delà.
 * ==============================================================================
 */

// ─── 📊 Structures et Types de Données ────────────────────────────────────────

/**
 * Options de configuration pour l'Indicateur 1 :
 * Liquidation & Réintégration combiné avec le Chevauchement des Extrêmes (Mèches / Face Haute / Face Basse)
 */
export interface ParametresChevauchementExtremes {
  // ── 🎯 Paramètres du Chevauchement des Extrêmes ──
  // Nombre de bougies antérieures scannées (défaut: 50)
  lookbackBars?: number;
  // Pas de prix de chaque palier (auto si non fourni)
  priceStep?: number;
  // Nombre minimum de bougies dont la mèche traverse le palier pour le valider (défaut: 2)
  minBougiesChevauchement?: number;
  // Exiger que le palier soit resté intact avant le setup (aucune clôture au-delà) (défaut: true)
  exigerPalierIntact?: boolean;
  // Exiger qu'un palier extrême valide ait été balayé (défaut: true)
  exigerNiveauBalaye?: boolean;

  // ── 🕯️ Paramètres du Chandelier Liq/Reint ──
  // Tolérance si la clôture est en deçà d'Open 1 (défaut: 0.05 = 5%)
  toleranceDeficit?: number;
  // Tolérance élargie si la clôture dépasse favorablement Open 1 (défaut: 0.25 = 25%)
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
  // Afficher le segment en ligne discontinue du palier balayé (défaut: true)
  afficherSegmentDiscontinue?: boolean;
  bullColor?: string;
  bearColor?: string;
  texteLabel?: string;
}

/**
 * Détails du palier de mèches extrêmes retenu
 */
export interface PalierExtremeChevauchement {
  type: 'FACE_BASSE_CREUX' | 'FACE_HAUTE_SOMMET';
  prixPalier: number;
  nbBougiesChevauchement: number;
  indexDebut: number;
  indexFin: number;
  tempsDebut: number | string;
  tempsFin: number | string;
  profondeurSweep: number;
}

/**
 * Signal complet de setup avec chevauchement des extrêmes
 */
export interface SignalChevauchementExtremes {
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
  palierExtreme?: PalierExtremeChevauchement;
}

/**
 * Résultat retourné par le moteur de calcul
 */
export interface ResultatChevauchementExtremes {
  signaux: SignalChevauchementExtremes[];
  primitives: VisualPrimitives;
  stepCalcule: number;
  statistiques: {
    totalSignaux: number;
    totalAchats: number;
    totalVentes: number;
    maxBougiesChevauchement: number;
  };
}

// ─── 🎯 FONCTION CENTRALE DE VALIDATION DU PALIER EXTRÊME (POUR LE DÉVELOPPEUR) ───

/**
 * Paramètres pour tester si un palier de chevauchement d'extrêmes est valide.
 */
export interface ParametresValidationPalierExtreme {
  prixPalier: number;
  nbBougies: number;
  indices: number[];
  direction: 'ACHAT' | 'VENTE';
  prixExtreme: number;
  minBougies?: number;
  exigerIntact?: boolean;
  bougies: Bougie[];
  indexFinScan: number;
}

/**
 * ==============================================================================
 * 🎯 FONCTION CENTRALE DE VALIDATION DU PALIER (POUR LE DÉVELOPPEUR DÉBUTANT)
 * ==============================================================================
 * Rassemble en UN SEUL BLOC toutes les conditions pour qu'un palier extrême
 * soit considéré comme balayé et valide pour le setup.
 *
 * 💡 MODIFICATION RAPIDE :
 *  • Pour désactiver l'intégrité (Unmitigated) : commentez la CONDITION 3.
 *  • Pour accepter les paliers à 1 seule bougie : mettez `minBougies: 1`.
 *
 * @returns {boolean} true si le palier respecte TOUTES les conditions, false sinon
 */
export function validerPalierExtreme(params: ParametresValidationPalierExtreme): boolean {
  const {
    prixPalier,
    nbBougies,
    indices,
    direction,
    prixExtreme,
    minBougies = 2,
    exigerIntact = true,
    bougies,
    indexFinScan,
  } = params;

  // ─── 🔍 CONDITION 1 : Densité minimale de chevauchement ─────────────────────
  if (nbBougies < minBougies) return false;

  // ─── 🔍 CONDITION 2 : Balayage effectif par l'extrême du Doji ───────────────
  // Achat : le creux du setup doit avoir percé SOUS le palier
  // Vente : le sommet du setup doit avoir percé AU-DESSUS du palier
  if (direction === 'ACHAT' && prixExtreme >= prixPalier) return false;
  if (direction === 'VENTE' && prixExtreme <= prixPalier) return false;

  // ─── 🔍 CONDITION 3 : Intégrité (Unmitigated / Palier non clôturé au-delà) ───
  if (exigerIntact && indices.length > 0) {
    const dernierIndexPalier = Math.max(...indices);
    for (let j = dernierIndexPalier + 1; j <= indexFinScan; j++) {
      if (bougies[j]) {
        if (direction === 'ACHAT' && bougies[j].close < prixPalier) return false;
        if (direction === 'VENTE' && bougies[j].close > prixPalier) return false;
      }
    }
  }

  // ✅ Palier validé !
  return true;
}

// ─── 🔍 Fonctions de Détection des Paliers d'Extrêmes ─────────────────────────

/**
 * Recherche le palier de chevauchement de mèches le plus dense traversé par la mèche du setup.
 * - Pour l'ACHAT (Spring) : examine les mèches basses (entre Low et le bas du corps).
 * - Pour la VENTE (UTAD) : examine les mèches hautes (entre le haut du corps et High).
 * 
 * Exemple :
 * const palier = identifierPalierExtremeAdapte(bougies, 'ACHAT', 95.0, 10, 45, step, 2, true);
 */
export function identifierPalierExtremeAdapte(
  bougies: Bougie[],
  direction: 'ACHAT' | 'VENTE',
  prixExtreme: number,
  indexDebutScan: number,
  indexFinScan: number,
  step: number,
  minBougies: number = 2,
  exigerIntact: boolean = true
): PalierExtremeChevauchement | null {
  if (indexFinScan <= indexDebutScan || step <= 0) return null;

  // 1️⃣ Carte des paliers de prix pour compter les passages de mèches extrêmes
  // clé: niveau de prix arrondi, valeur: liste des indices de bougies ayant touché ce palier
  const cartePaliers = new Map<number, { indices: number[]; nbBougies: number }>();

  for (let k = indexDebutScan; k <= indexFinScan; k++) {
    const b = bougies[k];
    let borneBasseMeche = 0;
    let borneHauteMeche = 0;

    if (direction === 'ACHAT') {
      // Face basse : mèche inférieure sous le corps
      borneBasseMeche = b.low;
      borneHauteMeche = Math.min(b.open, b.close);
    } else {
      // Face haute : mèche supérieure au-dessus du corps
      borneBasseMeche = Math.max(b.open, b.close);
      borneHauteMeche = b.high;
    }

    if (borneHauteMeche <= borneBasseMeche) continue;

    // Découpage par tranche de prix (step)
    for (let p = borneBasseMeche; p <= borneHauteMeche; p += step) {
      const prixArrondi = Number((Math.round(p / step) * step).toFixed(5));
      let entree = cartePaliers.get(prixArrondi);
      if (!entree) {
        entree = { indices: [], nbBougies: 0 };
        cartePaliers.set(prixArrondi, entree);
      }
      entree.indices.push(k);
      entree.nbBougies += 1;
    }
  }

  // 2️⃣ Filtrer et classer les paliers candidats
  let meilleurPalier: PalierExtremeChevauchement | null = null;
  let maxChevauchement = 0;

  for (const [prixPalier, info] of cartePaliers.entries()) {
    // ─── 🎯 VÉRIFICATION DES CONDITIONS DU PALIER ───
    const palierValide = validerPalierExtreme({
      prixPalier,
      nbBougies: info.nbBougies,
      indices: info.indices,
      direction,
      prixExtreme,
      minBougies,
      exigerIntact,
      bougies,
      indexFinScan,
    });

    if (!palierValide) continue;

    // Le palier le plus liquide est celui avec le plus fort nombre de bougies de chevauchement
    if (info.nbBougies > maxChevauchement) {
      maxChevauchement = info.nbBougies;
      const premierIdx = Math.min(...info.indices);
      const dernierIdx = Math.max(...info.indices);

      meilleurPalier = {
        type: direction === 'ACHAT' ? 'FACE_BASSE_CREUX' : 'FACE_HAUTE_SOMMET',
        prixPalier,
        nbBougiesChevauchement: info.nbBougies,
        indexDebut: premierIdx,
        indexFin: dernierIdx,
        tempsDebut: bougies[premierIdx].time,
        tempsFin: bougies[dernierIdx].time,
        profondeurSweep: Number(Math.abs(prixExtreme - prixPalier).toFixed(5)),
      };
    }
  }

  return meilleurPalier;
}

// ─── 🚀 Moteur Principal : Liq/Reint + Sweep Chevauchement Extrêmes ───────────

/**
 * Calcule l'indicateur combinant le setup Liquidation/Réintégration
 * avec l'analyse du chevauchement concentré sur les mèches extrêmes (faces haute et basse).
 * 
 * Trace un segment horizontal en ligne discontinue (dashed) représentant le niveau de liquidité.
 * 
 * Exemple :
 * const res = calculerLiquidationSweepChevauchementExtremes(bougies, { lookbackBars: 50 });
 */
export function calculerLiquidationSweepChevauchementExtremes(
  bougies: Bougie[],
  parametres: ParametresChevauchementExtremes = {}
): ResultatChevauchementExtremes {
  const labels: VisualLabel[] = [];
  const lignes: VisualLine[] = [];
  const points: VisualPoint[] = [];

  const defResultat: ResultatChevauchementExtremes = {
    signaux: [],
    primitives: { labels, lignes, boites: [], points },
    stepCalcule: 0.0001,
    statistiques: { totalSignaux: 0, totalAchats: 0, totalVentes: 0, maxBougiesChevauchement: 0 },
  };

  if (!bougies || bougies.length < 5) return defResultat;

  // 1️⃣ Extraction des paramètres
  const params = parametres || {};
  const lookbackBars = Math.max(10, Number(params.lookbackBars ?? 50));
  const minBougiesChevauchement = Math.max(1, Number(params.minBougiesChevauchement ?? 2));
  const exigerPalierIntact = params.exigerPalierIntact !== false;
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

  const signaux: SignalChevauchementExtremes[] = [];
  let countAchats = 0;
  let countVentes = 0;
  let maxBougiesGlobal = 0;

  // 2️⃣ Parcours séquentiel des bougies pour détecter le pattern à 2 bougies
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

    // 5️⃣ Détermination du point extrême balayeur et de la fenêtre d'analyse
    let prixExtreme = 0;
    let bougieExtreme: 1 | 2 = 1;
    const indexFinScan = i - 2;
    const indexDebutScan = Math.max(0, i - 1 - lookbackBars);

    if (estCandidatAchat) {
      if (b2.low <= b1.low) {
        prixExtreme = b2.low;
        bougieExtreme = 2;
      } else {
        prixExtreme = b1.low;
        bougieExtreme = 1;
      }

      // Recherche du palier de mèches basses le plus dense balayé
      const palierTrouve = identifierPalierExtremeAdapte(
        bougies,
        'ACHAT',
        prixExtreme,
        indexDebutScan,
        indexFinScan,
        step,
        minBougiesChevauchement,
        exigerPalierIntact
      );

      if (exigerNiveauBalaye && !palierTrouve) continue;

      if (palierTrouve && palierTrouve.nbBougiesChevauchement > maxBougiesGlobal) {
        maxBougiesGlobal = palierTrouve.nbBougiesChevauchement;
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
        palierExtreme: palierTrouve || undefined,
      });

      // Construction des éléments visuels
      const titreSignal = palierTrouve ? 'Spring Chevauchement' : texteLabel;
      const badgeChevauchement = palierTrouve
        ? `\nFace Basse (${palierTrouve.prixPalier.toFixed(4)}) [${palierTrouve.nbBougiesChevauchement}b]`
        : '';

      labels.push({
        id: `ext-achat-lbl-${i}`,
        prix: b2.low,
        date: b2.time,
        texte: `${titreSignal}${badgeChevauchement}`,
        couleur: bullColor,
        position: 'below',
      });

      points.push({
        id: `ext-achat-pt-${i}`,
        prix: prixExtreme,
        date: bougieExtreme === 1 ? b1.time : b2.time,
        couleur: bullColor,
      });

      // SEGMENT EN LIGNE DISCONTINUE (DASHED) : niveau de liquidité balayé
      if (palierTrouve && afficherSegment) {
        lignes.push({
          id: `ext-ligne-basse-${i}`,
          prix: palierTrouve.prixPalier,
          dateDebut: palierTrouve.tempsDebut,
          dateFin: b2.time,
          couleur: bullColor,
          epaisseur: 1.8,
          style: 'dashed',
          label: `🎯 Face Basse [${palierTrouve.nbBougiesChevauchement}b]`,
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

      // Recherche du palier de mèches hautes le plus dense balayé
      const palierTrouve = identifierPalierExtremeAdapte(
        bougies,
        'VENTE',
        prixExtreme,
        indexDebutScan,
        indexFinScan,
        step,
        minBougiesChevauchement,
        exigerPalierIntact
      );

      if (exigerNiveauBalaye && !palierTrouve) continue;

      if (palierTrouve && palierTrouve.nbBougiesChevauchement > maxBougiesGlobal) {
        maxBougiesGlobal = palierTrouve.nbBougiesChevauchement;
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
        palierExtreme: palierTrouve || undefined,
      });

      const titreSignal = palierTrouve ? 'UTAD Chevauchement' : texteLabel;
      const badgeChevauchement = palierTrouve
        ? `\nFace Haute (${palierTrouve.prixPalier.toFixed(4)}) [${palierTrouve.nbBougiesChevauchement}b]`
        : '';

      labels.push({
        id: `ext-vente-lbl-${i}`,
        prix: b2.high,
        date: b2.time,
        texte: `${titreSignal}${badgeChevauchement}`,
        couleur: bearColor,
        position: 'above',
      });

      points.push({
        id: `ext-vente-pt-${i}`,
        prix: prixExtreme,
        date: bougieExtreme === 1 ? b1.time : b2.time,
        couleur: bearColor,
      });

      // SEGMENT EN LIGNE DISCONTINUE (DASHED) : niveau de liquidité balayé
      if (palierTrouve && afficherSegment) {
        lignes.push({
          id: `ext-ligne-haute-${i}`,
          prix: palierTrouve.prixPalier,
          dateDebut: palierTrouve.tempsDebut,
          dateFin: b2.time,
          couleur: bearColor,
          epaisseur: 1.8,
          style: 'dashed',
          label: `🎯 Face Haute [${palierTrouve.nbBougiesChevauchement}b]`,
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
      maxBougiesChevauchement: maxBougiesGlobal,
    },
  };
}
