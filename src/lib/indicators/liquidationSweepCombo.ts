import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLabel, VisualLine, VisualBox, VisualPoint } from '@/types/indicatorScript';

/**
 * Options de configuration pour l'indicateur combiné :
 * Liquidation & Réintégration avec Détection de la Liquidité Balayée (Sweep BSL/SSL).
 */
export interface ParametresLiquidationSweepCombo {
  // ── 🎯 Filtres de Détection de Liquidité ──
  // Nombre de bougies à gauche et à droite pour valider un sommet/creux comme niveau de liquidité (défaut: 4)
  sensibilitePivotLiquidite?: number;
  // Nombre maximal de bougies antérieures à analyser pour trouver la liquidité (défaut: 100)
  lookbackLiquidite?: number;
  // Si true, le signal n'est validé QUE si une vraie liquidité antérieure a été balayée (défaut: true)
  exigerLiquiditeBalayee?: boolean;

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
 * Informations sur la liquidité antérieure balayée par le setup
 */
export interface LiquiditeBalayee {
  type: 'SSL' | 'BSL';
  prix: number;
  indexOrigine: number;
  tempsOrigine: number | string;
  profondeurSweep: number; // Distance franchie au-delà du niveau en pips / prix
  ratioSweep: number;      // Profondeur par rapport à la taille de la bougie
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
  liquidite?: LiquiditeBalayee; // Liquidité trouvée et balayée (si trouvée)
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
 * Recherche dans l'historique antérieur la liquidité (SSL ou BSL) la plus pertinente
 * balayée par le point extrême du pattern de bougies.
 */
function trouverLiquiditeBalayee(
  bougies: Bougie[],
  direction: 'ACHAT' | 'VENTE',
  prixExtreme: number,
  indexFinRecherche: number,
  sensibilite: number,
  lookback: number,
  prixReferenceHaut: number,
  prixReferenceBas: number
): LiquiditeBalayee | null {
  const indexDebut = Math.max(0, indexFinRecherche - lookback);
  let meilleureLiquidite: LiquiditeBalayee | null = null;
  let distanceMin = Infinity;

  // On remonte de la bougie la plus récente vers la plus ancienne
  for (let k = indexFinRecherche; k >= indexDebut; k--) {
    if (direction === 'ACHAT') {
      // 🟢 En Achat : on cherche un creux (SSL) balayé par le point bas extrême
      // Condition : le prix extrême est passé SOUS le creux ($prixExtreme < low$),
      // mais le creux était en dessous ou proche du départ de la bougie ($low <= prixReferenceHaut$)
      if (estPivotBasLocal(bougies, k, sensibilite, indexFinRecherche)) {
        const prixCreux = bougies[k].low;
        if (prixExtreme < prixCreux && prixCreux <= prixReferenceHaut) {
          const profondeur = prixCreux - prixExtreme;
          // Priorité à la liquidité la plus immédiate et pertinente
          const distanceBougies = indexFinRecherche - k;
          if (distanceBougies < distanceMin) {
            distanceMin = distanceBougies;
            meilleureLiquidite = {
              type: 'SSL',
              prix: prixCreux,
              indexOrigine: k,
              tempsOrigine: bougies[k].time,
              profondeurSweep: profondeur,
              ratioSweep: profondeur / Math.max(0.00001, prixReferenceHaut - prixExtreme),
            };
            break; // On a trouvé le niveau SSL le plus récent balayé
          }
        }
      }
    } else {
      // 🔴 En Vente : on cherche un sommet (BSL) balayé par le point haut extrême
      // Condition : le prix extrême est passé AU-DESSUS du sommet ($prixExtreme > high$),
      // mais le sommet était au-dessus ou proche du départ de la bougie ($high >= prixReferenceBas$)
      if (estPivotHautLocal(bougies, k, sensibilite, indexFinRecherche)) {
        const prixSommet = bougies[k].high;
        if (prixExtreme > prixSommet && prixSommet >= prixReferenceBas) {
          const profondeur = prixExtreme - prixSommet;
          const distanceBougies = indexFinRecherche - k;
          if (distanceBougies < distanceMin) {
            distanceMin = distanceBougies;
            meilleureLiquidite = {
              type: 'BSL',
              prix: prixSommet,
              indexOrigine: k,
              tempsOrigine: bougies[k].time,
              profondeurSweep: profondeur,
              ratioSweep: profondeur / Math.max(0.00001, prixExtreme - prixReferenceBas),
            };
            break; // On a trouvé le niveau BSL le plus récent balayé
          }
        }
      }
    }
  }

  return meilleureLiquidite;
}

/**
 * Indicateur combiné : Détecte le setup à 2 bougies (Liquidation & Réintégration)
 * ET identifie précisément la liquidité (BSL ou SSL) que cette manipulation a balayée.
 * 
 * Exemple :
 * const res = calculerLiquidationSweepCombo(bougies, { exigerLiquiditeBalayee: true });
 * console.log(`Setups avec liquidité balayée confirmée : ${res.statistiques.totalLiquiditesBalayees}`);
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
    // Pour l'achat : le point bas le plus bas parmi les deux bougies
    // Pour la vente : le point haut le plus haut parmi les deux bougies
    let prixExtreme = 0;
    let bougieExtreme: 1 | 2 = 1;
    let indexFinRecherche = i - 2;

    if (estCandidatAchat) {
      if (b2.low <= b1.low) {
        prixExtreme = b2.low;
        bougieExtreme = 2;
      } else {
        prixExtreme = b1.low;
        bougieExtreme = 1;
      }

      // 5️⃣ Recherche de la liquidité vendeuse (SSL) balayée dans le passé
      const liquiditeTrouvee = trouverLiquiditeBalayee(
        bougies,
        'ACHAT',
        prixExtreme,
        indexFinRecherche,
        sensibiliteLiquidite,
        lookbackLiquidite,
        Math.max(b1.open, b1.high),
        b1.low
      );

      // Si l'utilisateur exige une vraie liquidité et qu'aucune n'a été balayée, on ignore ce signal
      if (exigerLiquidite && !liquiditeTrouvee) continue;

      if (liquiditeTrouvee) {
        countAchatsSweep++;
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

      // Label principal sur la bougie de confirmation
      const texteAffiche = liquiditeTrouvee
        ? `${texteLabel}\nSweep SSL (${liquiditeTrouvee.prix.toFixed(4)})`
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

      // Ligne visuelle en pointillés montrant la liquidité balayée depuis son origine
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

    } else if (estCandidatVente) {
      if (b2.high >= b1.high) {
        prixExtreme = b2.high;
        bougieExtreme = 2;
      } else {
        prixExtreme = b1.high;
        bougieExtreme = 1;
      }

      // Recherche de la liquidité acheteuse (BSL) balayée dans le passé
      const liquiditeTrouvee = trouverLiquiditeBalayee(
        bougies,
        'VENTE',
        prixExtreme,
        indexFinRecherche,
        sensibiliteLiquidite,
        lookbackLiquidite,
        b1.high,
        Math.min(b1.open, b1.low)
      );

      if (exigerLiquidite && !liquiditeTrouvee) continue;

      if (liquiditeTrouvee) {
        countVentesSweep++;
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

      const texteAffiche = liquiditeTrouvee
        ? `${texteLabel}\nSweep BSL (${liquiditeTrouvee.prix.toFixed(4)})`
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
    }
  }

  // 6️⃣ Synthèse des résultats
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
    },
  };
}
