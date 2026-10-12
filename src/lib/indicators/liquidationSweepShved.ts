import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLabel, VisualLine, VisualBox, VisualPoint } from '@/types/indicatorScript';
import {
  calculerShvedSupplyDemand,
  type ZoneShved,
  type ForceZoneShved,
  type OptionsShvedSupplyDemand,
} from '@/lib/bot/modules/01_liquidite/shvedSupplyDemand';

/**
 * Options de configuration pour l'indicateur combiné :
 * Liquidation & Réintégration avec Détection de la Liquidité Balayée sur Shved Supply & Demand.
 * Identifie quelle zone institutionnelle de Support (Demand) ou Résistance (Supply) a été balayée.
 */
export interface ParametresLiquidationSweepShved {
  // ── 🛡️ Paramètres Shved Supply & Demand ──
  // Période ATR pour dimensionner l'épaisseur dynamique de la zone (défaut: 7)
  periodeATR?: number;
  // Facteur d'épaisseur de zone ATR (défaut: 0.75)
  zoneFuzzFactor?: number;
  // Nombre minimum de retests requis pour qu'une zone soit prise en compte (défaut: 1)
  minRetests?: number;
  // Force minimale exigée pour la zone :
  // 'TOUTES' : inclut UNTESTED, VERIFIED et PROVEN
  // 'VERIFIED_MIN' : exige au moins 1 retest (VERIFIED ou PROVEN)
  // 'PROVEN_SEULEMENT' : exige une zone majeure ultra-testée (> 3 retests)
  forceMinimaleZone?: 'TOUTES' | 'VERIFIED_MIN' | 'PROVEN_SEULEMENT';
  // Timeframe source pour l'analyse multi-timeframe / Lower Timeframe (défaut: 'ACTUEL')
  timeframeSource?: string;
  // Données brutes M1 éventuelles pour reconstruire le LTF
  donneesM1?: Bougie[];
  // Si true, le signal n'est validé QUE si une vraie zone Shved a été balayée (défaut: true)
  exigerZoneShvedBalayee?: boolean;

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
 * Recherche parmi les zones Shved celle qui a été balayée par le point extrême
 * et qui est la plus solide (PROVEN en priorité, puis max de retests).
 */
function identifierZoneShvedLaPlusSolide(
  zones: ZoneShved[],
  direction: 'ACHAT' | 'VENTE',
  prixExtreme: number,
  indexSetup: number,
  forceMin: string,
  minRetests: number,
  prixReferenceHaut: number,
  prixReferenceBas: number
): { zone: ZoneShved; profondeur: number } | null {
  const candidates: Array<{ zone: ZoneShved; profondeur: number }> = [];

  for (const zone of zones) {
    // La zone doit être née avant le setup
    if (zone.indexOrigine >= indexSetup - 1) continue;
    // Filtre sur le nombre de retests
    if (zone.retests < minRetests) continue;
    // Filtre sur la force de la zone
    if (!respecteForceMinimale(zone.force, forceMin)) continue;

    if (direction === 'ACHAT' && zone.type === 'SUPPORT') {
      // 🟢 En Achat : Le creux extrême a percé sous la zone (ou sous son prix médian)
      // mais le prix de référence haut reste au-dessus
      if (prixExtreme <= zone.prixHaut && zone.prixBas <= prixReferenceHaut) {
        // La mèche extrême a fait un sweep sous la borne basse ou médiane
        const profondeur = Math.max(0, zone.prixBas - prixExtreme);
        candidates.push({ zone, profondeur });
      }
    } else if (direction === 'VENTE' && zone.type === 'RESISTANCE') {
      // 🔴 En Vente : Le sommet extrême a percé au-dessus de la zone (ou de son prix médian)
      if (prixExtreme >= zone.prixBas && zone.prixHaut >= prixReferenceBas) {
        const profondeur = Math.max(0, prixExtreme - zone.prixHaut);
        candidates.push({ zone, profondeur });
      }
    }
  }

  if (candidates.length === 0) return null;

  // Sélection de la zone la plus solide :
  // 1. Force PROVEN d'abord
  // 2. Nombre de retests le plus élevé
  // 3. Zone la plus récente
  return candidates.reduce((meilleur, c) => {
    const poidsForce = (f: ForceZoneShved) => f === 'PROVEN' ? 3 : (f === 'VERIFIED' ? 2 : 1);
    const pActuel = poidsForce(c.zone.force);
    const pMeilleur = poidsForce(meilleur.zone.force);

    if (pActuel > pMeilleur) return c;
    if (pActuel === pMeilleur) {
      if (c.zone.retests > meilleur.zone.retests) return c;
      if (c.zone.retests === meilleur.zone.retests && c.zone.indexOrigine > meilleur.zone.indexOrigine) {
        return c;
      }
    }
    return meilleur;
  }, candidates[0]);
}

/**
 * Indicateur combiné : Détecte le setup de réintégration (Liq/Reint)
 * et identifie précisément quelle zone Shved Supply & Demand
 * a été balayée (avec force PROVEN/VERIFIED et retests).
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
  const minRetests = Math.max(0, Number(params.minRetests ?? 1));
  const forceMin = params.forceMinimaleZone || 'TOUTES';
  const exigerZoneShved = params.exigerZoneShvedBalayee !== false;

  const activerFiltreTaille = params.activerFiltreTaille !== false;
  const periodeHistorique = Math.max(3, Number(params.periodeHistorique ?? 10));
  const multiplicateurBougie1 = Math.max(0.5, Number(params.multiplicateurBougie1 ?? 1.75));
  const multiplicateurCorps2 = Math.max(0.5, Number(params.multiplicateurCorps2 ?? 1.75));

  const activerAchat = params.activerAchat !== false;
  const activerVente = params.activerVente !== false;
  const activerFiltreTendance = Boolean(params.activerFiltreTendance);
  const trendBars = Math.max(1, Number(params.trendBars ?? 5));

  const afficherZone = params.afficherZoneShved !== false;
  const afficherSweep = params.afficherZoneSweep !== false;
  const afficherLigne = params.afficherLigneConnexion !== false;
  const bullColor = params.bullColor || '#00E676';
  const bearColor = params.bearColor || '#F23645';
  const texteLabel = params.texteLabel || 'Liq/Reint';

  // 2️⃣ Calcul des zones Shved Supply & Demand
  const optionsShved: OptionsShvedSupplyDemand = {
    periodeATR,
    zoneFuzzFactor,
    minRetests,
    supprimerZonesCassees: false, // On garde les zones pour détecter le moment exact du sweep
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
  let countProven = 0;
  let countVerified = 0;
  let maxRetests = 0;

  // 3️⃣ Parcours des bougies pour détecter le setup Liq/Reint
  for (let i = 1; i < bougies.length; i++) {
    const b1 = bougies[i - 1];
    const b2 = bougies[i];

    const range1 = b1.high - b1.low;
    const range2 = b2.high - b2.low;
    const corps2 = Math.abs(b2.open - b2.close);
    const hauteurMoyenne = (range1 + range2) / 2;
    if (hauteurMoyenne <= 0) continue;

    const idxTrend = Math.max(0, i - trendBars);
    const openTrend = bougies[idxTrend].open;
    const tendanceHausse = !activerFiltreTendance || openTrend < b2.open;
    const tendanceBaisse = !activerFiltreTendance || openTrend > b2.open;

    const estCandidatAchat = activerAchat && (b1.close < b1.open) && (b2.close > b2.open) && tendanceBaisse;
    const estCandidatVente = activerVente && (b1.close > b1.open) && (b2.close < b2.open) && tendanceHausse;
    if (!estCandidatAchat && !estCandidatVente) continue;

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

    // Filtre de taille / momentum
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
        if (range1 < multiplicateurBougie1 * moyRange || corps2 < multiplicateurCorps2 * moyCorps) {
          continue;
        }
      }
    }

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

      // Recherche de la zone Demand (Support Shved) balayée
      const zoneTrouvee = identifierZoneShvedLaPlusSolide(
        supports,
        'ACHAT',
        prixExtreme,
        i,
        forceMin,
        minRetests,
        Math.max(b1.open, b1.high),
        b1.low
      );

      if (exigerZoneShved && !zoneTrouvee) continue;

      if (zoneTrouvee) {
        countSweepsShved++;
        if (zoneTrouvee.zone.force === 'PROVEN') countProven++;
        else if (zoneTrouvee.zone.force === 'VERIFIED') countVerified++;
        if (zoneTrouvee.zone.retests > maxRetests) maxRetests = zoneTrouvee.zone.retests;
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
        zoneShved: zoneTrouvee?.zone,
        profondeurSweep: zoneTrouvee?.profondeur,
      });

      const badgeShved = zoneTrouvee
        ? ` [Demand ${zoneTrouvee.zone.force} (${zoneTrouvee.zone.retests}t)]\nSweep Demand (${zoneTrouvee.zone.prixMedian.toFixed(4)})`
        : '';

      labels.push({
        id: `shved-achat-lbl-${i}`,
        prix: b2.low,
        date: b2.time,
        texte: zoneTrouvee ? `${texteLabel}${badgeShved}` : texteLabel,
        couleur: bullColor,
        position: 'below',
      });

      points.push({
        id: `shved-achat-pt-${i}`,
        prix: prixExtreme,
        date: bougieExtreme === 1 ? b1.time : b2.time,
        couleur: bullColor,
      });

      if (zoneTrouvee && afficherZone) {
        boites.push({
          id: `shved-zone-demand-${i}`,
          prixHaut: zoneTrouvee.zone.prixHaut,
          prixBas: zoneTrouvee.zone.prixBas,
          dateDebut: zoneTrouvee.zone.dateDebut,
          dateFin: b2.time,
          couleurFond: 'rgba(0, 230, 118, 0.12)',
          couleurBordure: bullColor,
          label: `Zone Demand (${zoneTrouvee.zone.force} - ${zoneTrouvee.zone.retests} retests)`,
        });
      }

      if (zoneTrouvee && afficherSweep) {
        boites.push({
          id: `shved-sweep-demand-${i}`,
          prixHaut: zoneTrouvee.zone.prixBas,
          prixBas: prixExtreme,
          dateDebut: b1.time,
          dateFin: b2.time,
          couleurFond: 'rgba(0, 230, 118, 0.22)',
          couleurBordure: bullColor,
          label: `Sweep Demand (-${(zoneTrouvee.profondeur * 10000).toFixed(1)}p)`,
        });
      }

      if (zoneTrouvee && afficherLigne) {
        lignes.push({
          id: `shved-ligne-demand-${i}`,
          prix: zoneTrouvee.zone.prixMedian,
          dateDebut: zoneTrouvee.zone.dateDebut,
          dateFin: b2.time,
          couleur: bullColor,
          epaisseur: 1.5,
          style: 'dashed',
          label: `Demand Médian (${zoneTrouvee.zone.prixMedian.toFixed(4)})`,
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

      const zoneTrouvee = identifierZoneShvedLaPlusSolide(
        resistances,
        'VENTE',
        prixExtreme,
        i,
        forceMin,
        minRetests,
        b1.high,
        Math.min(b1.open, b1.low)
      );

      if (exigerZoneShved && !zoneTrouvee) continue;

      if (zoneTrouvee) {
        countSweepsShved++;
        if (zoneTrouvee.zone.force === 'PROVEN') countProven++;
        else if (zoneTrouvee.zone.force === 'VERIFIED') countVerified++;
        if (zoneTrouvee.zone.retests > maxRetests) maxRetests = zoneTrouvee.zone.retests;
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
        zoneShved: zoneTrouvee?.zone,
        profondeurSweep: zoneTrouvee?.profondeur,
      });

      const badgeShved = zoneTrouvee
        ? ` [Supply ${zoneTrouvee.zone.force} (${zoneTrouvee.zone.retests}t)]\nSweep Supply (${zoneTrouvee.zone.prixMedian.toFixed(4)})`
        : '';

      labels.push({
        id: `shved-vente-lbl-${i}`,
        prix: b2.high,
        date: b2.time,
        texte: zoneTrouvee ? `${texteLabel}${badgeShved}` : texteLabel,
        couleur: bearColor,
        position: 'above',
      });

      points.push({
        id: `shved-vente-pt-${i}`,
        prix: prixExtreme,
        date: bougieExtreme === 1 ? b1.time : b2.time,
        couleur: bearColor,
      });

      if (zoneTrouvee && afficherZone) {
        boites.push({
          id: `shved-zone-supply-${i}`,
          prixHaut: zoneTrouvee.zone.prixHaut,
          prixBas: zoneTrouvee.zone.prixBas,
          dateDebut: zoneTrouvee.zone.dateDebut,
          dateFin: b2.time,
          couleurFond: 'rgba(242, 54, 69, 0.12)',
          couleurBordure: bearColor,
          label: `Zone Supply (${zoneTrouvee.zone.force} - ${zoneTrouvee.zone.retests} retests)`,
        });
      }

      if (zoneTrouvee && afficherSweep) {
        boites.push({
          id: `shved-sweep-supply-${i}`,
          prixHaut: prixExtreme,
          prixBas: zoneTrouvee.zone.prixHaut,
          dateDebut: b1.time,
          dateFin: b2.time,
          couleurFond: 'rgba(242, 54, 69, 0.22)',
          couleurBordure: bearColor,
          label: `Sweep Supply (+${(zoneTrouvee.profondeur * 10000).toFixed(1)}p)`,
        });
      }

      if (zoneTrouvee && afficherLigne) {
        lignes.push({
          id: `shved-ligne-supply-${i}`,
          prix: zoneTrouvee.zone.prixMedian,
          dateDebut: zoneTrouvee.zone.dateDebut,
          dateFin: b2.time,
          couleur: bearColor,
          epaisseur: 1.5,
          style: 'dashed',
          label: `Supply Médian (${zoneTrouvee.zone.prixMedian.toFixed(4)})`,
        });
      }
    }
  }

  return {
    signaux,
    primitives: {
      labels,
      lignes,
      boites,
      points,
    },
    zonesDetectees: {
      totalSupports: supports.length,
      totalResistances: resistances.length,
    },
    statistiques: {
      totalSignaux: signaux.length,
      totalAchats: countAchats,
      totalVentes: countVentes,
      totalSweepsShved: countSweepsShved,
      totalProven: countProven,
      totalVerified: countVerified,
      maxRetestsZone: maxRetests,
    },
  };
}
