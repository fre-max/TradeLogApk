import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLabel, VisualLine, VisualBox, VisualPoint } from '@/types/indicatorScript';

/**
 * Options de configuration pour l'indicateur combiné :
 * Liquidation & Réintégration avec Détection de la Liquidité Balayée (Sweep BSL/SSL)
 * et analyse des Multi-Liquidations sur Support / Résistance (Double & Triple Sweeps).
 */
export interface ParametresLiquidationSweepCombo {
  // ── 🎯 Filtres de Détection de Liquidité ──
  // Nombre de bougies à gauche et à droite pour valider un sommet/creux comme niveau de liquidité (défaut: 4)
  sensibilitePivotLiquidite?: number;
  // Nombre maximal de bougies antérieures à analyser pour trouver la liquidité (défaut: 100)
  lookbackLiquidite?: number;
  // Si true, le signal n'est validé QUE si une vraie liquidité antérieure a été balayée (défaut: true)
  exigerLiquiditeBalayee?: boolean;

  // ── 🔄 Analyse des Multi-Liquidations (Double / Triple Sweeps sur Support & Résistance) ──
  // Tolérance pour regrouper les sommets/creux sur la même zone S/R (défaut: 0.15 = 0.15% du prix)
  toleranceZoneSR?: number;
  // Seuil minimal de liquidations requis :
  // 1 = Tous les signaux (Simple 1x, Double 2x, Triple 3x)
  // 2 = Multi-liquidations uniquement (Double 2x et Triple 3x)
  // 3 = Triple liquidation uniquement (3x+)
  seuilMinLiquidations?: number;
  // Afficher des lignes en pointillés vers tous les balayages antérieurs du même niveau S/R (défaut: true)
  afficherLignesMultiSweep?: boolean;
  // Afficher la boîte de la zone S/R englobant les différents tests (défaut: true)
  afficherZoneSR?: boolean;

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
  // Afficher la ligne reliant la liquidité balayée au point de sweep (défaut: true)
  afficherLigneLiquidite?: boolean;
  // Afficher la boîte rectangulaire de la zone de sweep (défaut: true)
  afficherZoneSweep?: boolean;
  bullColor?: string;
  bearColor?: string;
  texteLabel?: string;
}

/**
 * Détail d'un contact ou balayage individuel d'un niveau S/R dans le passé
 */
export interface ContactZoneSR {
  index: number;
  temps: number | string;
  prix: number;
  profondeurSweep: number;
}

/**
 * Informations sur la liquidité antérieure balayée par le setup,
 * avec compteur de multi-liquidations (Simple, Double ou Triple).
 */
export interface LiquiditeBalayee {
  type: 'SSL' | 'BSL';
  prix: number;
  indexOrigine: number;
  tempsOrigine: number | string;
  profondeurSweep: number; // Distance franchie au-delà du niveau en pips / prix
  ratioSweep: number;      // Profondeur par rapport à la taille moyenne des bougies

  // ── 🎯 Analyse Multi-Liquidation ──
  compteurLiquidations: number;               // 1 = Simple, 2 = Double, 3+ = Triple
  typeMultiLiquidation: 'SIMPLE' | 'DOUBLE' | 'TRIPLE';
  balayagesPrecedents: ContactZoneSR[];       // Détail des balayages / tests antérieurs dans la même zone
}

/**
 * Détail complet d'un signal combiné détecté
 */
export interface SignalLiquidationSweepCombo {
  type: 'ACHAT' | 'VENTE';
  indexBougie: number;
  temps: number | string;
  prixSignal: number;
  prixExtreme: number;     // Point bas le plus bas (Achat) ou haut le plus haut (Vente)
  bougieExtreme: 1 | 2;    // Indique si le sweep extrême a été fait par la Bougie 1 ou la Bougie 2
  open1: number;
  close2: number;
  ecartPrix: number;
  ratioEcart: number;
  situationCloture: 'DEPASSEMENT' | 'RETRAIT';
  rangeBougie1: number;
  corpsBougie2: number;
  liquidite?: LiquiditeBalayee; // Liquidité trouvée et balayée (avec statut multi-sweep)
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
    totalSimplesLiquidations: number;
    totalDoublesLiquidations: number;
    totalTriplesLiquidations: number;
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
 * Recherche dans l'historique antérieur la liquidité (SSL ou BSL) balayée par le setup,
 * et compte le nombre de balayages successifs (Simple, Double ou Triple liquidation) sur ce niveau S/R.
 */
function trouverLiquiditeBalayee(
  bougies: Bougie[],
  direction: 'ACHAT' | 'VENTE',
  prixExtreme: number,
  indexFinRecherche: number,
  sensibilite: number,
  lookback: number,
  prixReferenceHaut: number,
  prixReferenceBas: number,
  toleranceZoneSR: number
): LiquiditeBalayee | null {
  const indexDebut = Math.max(0, indexFinRecherche - lookback);
  let pivotTrouve: { prix: number; index: number; temps: number | string } | null = null;
  let distanceMin = Infinity;

  // 1️⃣ Trouver le pivot le plus récent et pertinent balayé par le point extrême
  for (let k = indexFinRecherche; k >= indexDebut; k--) {
    if (direction === 'ACHAT') {
      // 🟢 En Achat : on cherche un creux (SSL) balayé par le point bas extrême
      if (estPivotBasLocal(bougies, k, sensibilite, indexFinRecherche)) {
        const prixCreux = bougies[k].low;
        if (prixExtreme < prixCreux && prixCreux <= prixReferenceHaut) {
          const distanceBougies = indexFinRecherche - k;
          if (distanceBougies < distanceMin) {
            distanceMin = distanceBougies;
            pivotTrouve = {
              prix: prixCreux,
              index: k,
              temps: bougies[k].time,
            };
            break; // On a le creux SSL de référence le plus récent
          }
        }
      }
    } else {
      // 🔴 En Vente : on cherche un sommet (BSL) balayé par le point haut extrême
      if (estPivotHautLocal(bougies, k, sensibilite, indexFinRecherche)) {
        const prixSommet = bougies[k].high;
        if (prixExtreme > prixSommet && prixSommet >= prixReferenceBas) {
          const distanceBougies = indexFinRecherche - k;
          if (distanceBougies < distanceMin) {
            distanceMin = distanceBougies;
            pivotTrouve = {
              prix: prixSommet,
              index: k,
              temps: bougies[k].time,
            };
            break; // On a le sommet BSL de référence le plus récent
          }
        }
      }
    }
  }

  if (!pivotTrouve) return null;

  // 2️⃣ Analyse Multi-Liquidation sur la zone S/R :
  // Définition de la largeur de la zone de Support ou de Résistance
  const prixNiveau = pivotTrouve.prix;
  const margeZone = Math.max(0.0001, prixNiveau * toleranceZoneSR);
  const balayagesPrecedents: ContactZoneSR[] = [];
  const sensibiliteCluster = Math.max(1, Math.floor(sensibilite / 2));

  // On scanne l'historique sur la fenêtre pour trouver les autres creux/sommets
  // qui ont déjà touché ou percé cette zone de Support ou Résistance
  for (let j = indexDebut; j <= indexFinRecherche; j++) {
    // On évite la bougie du pivot d'origine lui-même pour ne pas le compter en double
    if (Math.abs(j - pivotTrouve.index) < 2) continue;

    if (direction === 'ACHAT') {
      // Support (SSL) : recherche de creux antérieurs dans la zone de support
      if (estPivotBasLocal(bougies, j, sensibiliteCluster, indexFinRecherche)) {
        const lowJ = bougies[j].low;
        // Le creux est dans la zone S/R (proche du niveau ou l'ayant déjà balayé)
        if (lowJ <= prixNiveau + margeZone && lowJ >= prixNiveau - (margeZone * 3)) {
          balayagesPrecedents.push({
            index: j,
            temps: bougies[j].time,
            prix: lowJ,
            profondeurSweep: Math.max(0, prixNiveau - lowJ),
          });
        }
      }
    } else {
      // Résistance (BSL) : recherche de sommets antérieurs dans la zone de résistance
      if (estPivotHautLocal(bougies, j, sensibiliteCluster, indexFinRecherche)) {
        const highJ = bougies[j].high;
        if (highJ >= prixNiveau - margeZone && highJ <= prixNiveau + (margeZone * 3)) {
          balayagesPrecedents.push({
            index: j,
            temps: bougies[j].time,
            prix: highJ,
            profondeurSweep: Math.max(0, highJ - prixNiveau),
          });
        }
      }
    }
  }

  // Le compteur total de liquidations comprend le pivot initial + les autres balayages/tests antérieurs + le setup actuel
  // Si aucun autre test n'a eu lieu : 1x (Simple Sweep)
  // Si 1 test/sweep antérieur a eu lieu : 2x (Double Sweep)
  // Si 2 tests/sweeps ou plus ont eu lieu : 3x+ (Triple Sweep)
  const totalBalayages = 1 + balayagesPrecedents.length;
  let typeMulti: 'SIMPLE' | 'DOUBLE' | 'TRIPLE' = 'SIMPLE';
  if (totalBalayages === 2) {
    typeMulti = 'DOUBLE';
  } else if (totalBalayages >= 3) {
    typeMulti = 'TRIPLE';
  }

  const profondeur = direction === 'ACHAT'
    ? prixNiveau - prixExtreme
    : prixExtreme - prixNiveau;

  const denominateur = direction === 'ACHAT'
    ? Math.max(0.00001, prixReferenceHaut - prixExtreme)
    : Math.max(0.00001, prixExtreme - prixReferenceBas);

  return {
    type: direction === 'ACHAT' ? 'SSL' : 'BSL',
    prix: prixNiveau,
    indexOrigine: pivotTrouve.index,
    tempsOrigine: pivotTrouve.temps,
    profondeurSweep: profondeur,
    ratioSweep: profondeur / denominateur,
    compteurLiquidations: totalBalayages,
    typeMultiLiquidation: typeMulti,
    balayagesPrecedents,
  };
}

/**
 * Indicateur combiné : Détecte le setup à 2 bougies (Liquidation & Réintégration)
 * ET identifie précisément la liquidité (BSL ou SSL) que cette manipulation a balayée,
 * avec analyse des Multi-Liquidations (Simple 1x, Double 2x, Triple 3x sur Support/Résistance).
 * 
 * Exemple :
 * const res = calculerLiquidationSweepCombo(bougies, { seuilMinLiquidations: 2 });
 * console.log(`Doubles et Triples sweeps détectés : ${res.statistiques.totalDoublesLiquidations + res.statistiques.totalTriplesLiquidations}`);
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
        totalSimplesLiquidations: 0,
        totalDoublesLiquidations: 0,
        totalTriplesLiquidations: 0,
      },
    };
  }

  // 2️⃣ Extraction et normalisation des paramètres
  const params = options || {};
  const valDeficit = params.toleranceDeficit !== undefined ? params.toleranceDeficit : 0.05;
  const toleranceDeficit = valDeficit > 1 ? valDeficit / 100 : valDeficit;

  const valDepassement = params.toleranceDepassement !== undefined ? params.toleranceDepassement : 0.25;
  const toleranceDepassement = valDepassement > 1 ? valDepassement / 100 : valDepassement;

  const sensibiliteLiquidite = Math.max(2, Number(params.sensibilitePivotLiquidite ?? 4));
  const lookbackLiquidite = Math.max(10, Number(params.lookbackLiquidite ?? 100));
  const exigerLiquidite = params.exigerLiquiditeBalayee !== false;

  // Tolérance pour regrouper la zone S/R (0.15% par défaut)
  const valZoneSR = params.toleranceZoneSR !== undefined ? params.toleranceZoneSR : 0.15;
  const toleranceZoneSR = valZoneSR > 1 ? valZoneSR / 100 : (valZoneSR >= 0.05 ? valZoneSR / 100 : valZoneSR);

  // Seuil minimal de liquidations (1 = tous, 2 = double/triple, 3 = triple)
  const seuilMinLiquidations = Math.max(1, Math.min(3, Number(params.seuilMinLiquidations ?? 1)));
  const afficherLignesMultiSweep = params.afficherLignesMultiSweep !== false;
  const afficherZoneSR = params.afficherZoneSR !== false;

  const activerFiltreTaille = params.activerFiltreTaille !== false;
  const periodeHistorique = Math.max(3, Number(params.periodeHistorique ?? 10));
  const multiplicateurBougie1 = Math.max(0.5, Number(params.multiplicateurBougie1 ?? 1.75));
  const multiplicateurCorps2 = Math.max(0.5, Number(params.multiplicateurCorps2 ?? 1.75));

  const activerAchat = params.activerAchat !== false;
  const activerVente = params.activerVente !== false;
  const activerFiltreTendance = Boolean(params.activerFiltreTendance);
  const trendBars = Math.max(1, Number(params.trendBars ?? 5));

  const afficherLignes = params.afficherLigneLiquidite !== false;
  const afficherZones = params.afficherZoneSweep !== false;
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
  let countSimples = 0;
  let countDoubles = 0;
  let countTriples = 0;

  // 3️⃣ Parcours des bougies pour détecter le pattern à 2 bougies (i-1 et i)
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

    // Candidats
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

    // Filtre de momentum sur l'historique récent
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

      // 5️⃣ Recherche de la liquidité vendeuse (SSL) balayée + Analyse Multi-Sweep sur Support
      const liquiditeTrouvee = trouverLiquiditeBalayee(
        bougies,
        'ACHAT',
        prixExtreme,
        indexFinRecherche,
        sensibiliteLiquidite,
        lookbackLiquidite,
        Math.max(b1.open, b1.high),
        b1.low,
        toleranceZoneSR
      );

      // Si l'utilisateur exige une vraie liquidité et qu'aucune n'a été balayée
      if (exigerLiquidite && !liquiditeTrouvee) continue;

      // Filtre sur le seuil minimal de multi-liquidations (ex: 2 = doubles/triples uniquement)
      if (liquiditeTrouvee && liquiditeTrouvee.compteurLiquidations < seuilMinLiquidations) {
        continue;
      }

      if (liquiditeTrouvee) {
        countAchatsSweep++;
        if (liquiditeTrouvee.typeMultiLiquidation === 'SIMPLE') countSimples++;
        else if (liquiditeTrouvee.typeMultiLiquidation === 'DOUBLE') countDoubles++;
        else countTriples++;
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

      // 6️⃣ Rendu Visuel : Label dynamique avec badge de multi-liquidation
      let badgeMulti = '';
      if (liquiditeTrouvee) {
        if (liquiditeTrouvee.typeMultiLiquidation === 'DOUBLE') {
          badgeMulti = ' 🔥 [Double Sweep 2x]';
        } else if (liquiditeTrouvee.typeMultiLiquidation === 'TRIPLE') {
          badgeMulti = ` 🚀 [Triple Sweep ${liquiditeTrouvee.compteurLiquidations}x]`;
        } else {
          badgeMulti = ' [1x]';
        }
      }

      const texteAffiche = liquiditeTrouvee
        ? `${texteLabel}${badgeMulti}\nSweep SSL (${liquiditeTrouvee.prix.toFixed(4)})`
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
          label: `SSL Balayée (-${(liquiditeTrouvee.profondeurSweep * 10000).toFixed(1)} pips)`,
        });
      }

      // Lignes connectant les autres balayages antérieurs dans la même zone de support
      if (liquiditeTrouvee && afficherLignesMultiSweep && liquiditeTrouvee.balayagesPrecedents.length > 0) {
        liquiditeTrouvee.balayagesPrecedents.forEach((bal, idxBal) => {
          lignes.push({
            id: `combo-multisweep-ssl-${i}-${idxBal}`,
            prix: bal.prix,
            dateDebut: bal.temps,
            dateFin: b2.time,
            couleur: 'rgba(0, 230, 118, 0.65)',
            epaisseur: 1,
            style: 'dotted',
            label: `Sweep Support #${idxBal + 1}`,
          });
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
          label: 'Zone de Sweep',
        });
      }

      // Boîte de la zone S/R englobant les différents tests de support
      if (liquiditeTrouvee && afficherZoneSR && liquiditeTrouvee.compteurLiquidations >= 2) {
        const margeZone = liquiditeTrouvee.prix * toleranceZoneSR;
        boites.push({
          id: `combo-zone-sr-achat-${i}`,
          prixHaut: liquiditeTrouvee.prix + margeZone,
          prixBas: liquiditeTrouvee.prix - margeZone,
          dateDebut: liquiditeTrouvee.tempsOrigine,
          dateFin: b2.time,
          couleurFond: 'rgba(0, 230, 118, 0.08)',
          couleurBordure: 'rgba(0, 230, 118, 0.4)',
          label: `Zone Support (${liquiditeTrouvee.compteurLiquidations}x Sweeps)`,
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

      // Recherche de la liquidité acheteuse (BSL) balayée + Analyse Multi-Sweep sur Résistance
      const liquiditeTrouvee = trouverLiquiditeBalayee(
        bougies,
        'VENTE',
        prixExtreme,
        indexFinRecherche,
        sensibiliteLiquidite,
        lookbackLiquidite,
        b1.high,
        Math.min(b1.open, b1.low),
        toleranceZoneSR
      );

      if (exigerLiquidite && !liquiditeTrouvee) continue;

      if (liquiditeTrouvee && liquiditeTrouvee.compteurLiquidations < seuilMinLiquidations) {
        continue;
      }

      if (liquiditeTrouvee) {
        countVentesSweep++;
        if (liquiditeTrouvee.typeMultiLiquidation === 'SIMPLE') countSimples++;
        else if (liquiditeTrouvee.typeMultiLiquidation === 'DOUBLE') countDoubles++;
        else countTriples++;
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

      let badgeMulti = '';
      if (liquiditeTrouvee) {
        if (liquiditeTrouvee.typeMultiLiquidation === 'DOUBLE') {
          badgeMulti = ' 🔥 [Double Sweep 2x]';
        } else if (liquiditeTrouvee.typeMultiLiquidation === 'TRIPLE') {
          badgeMulti = ` 🚀 [Triple Sweep ${liquiditeTrouvee.compteurLiquidations}x]`;
        } else {
          badgeMulti = ' [1x]';
        }
      }

      const texteAffiche = liquiditeTrouvee
        ? `${texteLabel}${badgeMulti}\nSweep BSL (${liquiditeTrouvee.prix.toFixed(4)})`
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
          label: `BSL Balayée (+${(liquiditeTrouvee.profondeurSweep * 10000).toFixed(1)} pips)`,
        });
      }

      if (liquiditeTrouvee && afficherLignesMultiSweep && liquiditeTrouvee.balayagesPrecedents.length > 0) {
        liquiditeTrouvee.balayagesPrecedents.forEach((bal, idxBal) => {
          lignes.push({
            id: `combo-multisweep-bsl-${i}-${idxBal}`,
            prix: bal.prix,
            dateDebut: bal.temps,
            dateFin: b2.time,
            couleur: 'rgba(242, 54, 69, 0.65)',
            epaisseur: 1,
            style: 'dotted',
            label: `Sweep Résistance #${idxBal + 1}`,
          });
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
          label: 'Zone de Sweep',
        });
      }

      if (liquiditeTrouvee && afficherZoneSR && liquiditeTrouvee.compteurLiquidations >= 2) {
        const margeZone = liquiditeTrouvee.prix * toleranceZoneSR;
        boites.push({
          id: `combo-zone-sr-vente-${i}`,
          prixHaut: liquiditeTrouvee.prix + margeZone,
          prixBas: liquiditeTrouvee.prix - margeZone,
          dateDebut: liquiditeTrouvee.tempsOrigine,
          dateFin: b2.time,
          couleurFond: 'rgba(242, 54, 69, 0.08)',
          couleurBordure: 'rgba(242, 54, 69, 0.4)',
          label: `Zone Résistance (${liquiditeTrouvee.compteurLiquidations}x Sweeps)`,
        });
      }
    }
  }

  // 7️⃣ Synthèse des résultats et statistiques
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
      totalLiquiditesBalayees: countAchatsSweep + countVentesSweep,
      totalAchatsAvecSweep: countAchatsSweep,
      totalVentesAvecSweep: countVentesSweep,
      totalSimplesLiquidations: countSimples,
      totalDoublesLiquidations: countDoubles,
      totalTriplesLiquidations: countTriples,
    },
  };
}
