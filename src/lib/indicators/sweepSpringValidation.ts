import type { Bougie } from '@/lib/chartDataHelper';
import { calculerDetectionLiquidite, type NiveauLiquidite } from './detectionLiquidite';

// ─── 🎯 Types et Structures de données ────────────────────────────────────────

/**
 * Représente un signal de Sweep/Spring validé par le module.
 * Un Spring (Wyckoff) = le prix traverse brièvement un niveau de liquidité
 * puis réintègre la structure, confirmé par des bougies de consolidation.
 * 
 * Exemple :
 * {
 *   direction: 'achat',
 *   indexSignal: 120,
 *   prixEntree: 1.0830,
 *   stopLoss: 1.0795,     // Extrême du sweep (prix le plus bas atteint)
 *   niveauLiquidite: 1.0820, // La ligne SSL qui a été balayée
 * }
 */
export interface SignalSweepSpring {
  direction: 'achat' | 'vente';   // Achat = Spring sur creux, Vente = UTAD sur sommet
  indexSignal: number;             // Index de la bougie où le signal est confirmé
  tempsSignal: number | string;
  prixEntree: number;              // Prix de clôture de la bougie du signal
  stopLoss: number;                // Prix extrême du sweep (SL naturel)
  niveauLiquidite: number;         // Niveau BSL ou SSL qui a été balayé
  indexBOS: number;                // Index de la bougie de cassure (Break of Structure)
  indexReintegration: number;      // Index de la bougie de réintégration
  dureeHorsStructure: number;      // Nombre de bougies passées hors de la structure
  maxBarresAutorisees: number;     // Seuil maximal calculé (proportionnalité temporelle)
}

/**
 * Boîte visuelle de la zone de consolidation confirmée après le sweep
 */
export interface BoiteSweep {
  type: 'achat' | 'vente';
  prixHaut: number;
  prixBas: number;
  indexDebut: number;
  tempsDebut: number | string;
  indexFin: number;
  tempsFin: number | string;
}

/**
 * Options de configuration du valideur de Sweep / Spring
 */
export interface OptionsSweepSpring {
  sensibilitePivot?: number;       // Sensibilité des pivots du module de liquidité (défaut: 5)
  maxLookbackBars?: number;        // Nombre de bougies analysées (défaut: 1000)
  ratioMaxTemps?: number;          // Ratio max temps hors structure, ex: 0.10 = 1/10 (défaut: 0.10)
  nbBougiesConsolidation?: number; // Nombre de bougies de confirmation (défaut: 3)
  activerSpringSSL?: boolean;      // Valider les Springs d'achat sur creux SSL (défaut: true)
  activerUTADBSL?: boolean;        // Valider les Upthrusts de vente sur sommets BSL (défaut: true)
}

/**
 * Résultat complet du module de validation Sweep/Spring
 */
export interface ResultatSweepSpring {
  signaux: SignalSweepSpring[];          // Tous les signaux validés
  boites: BoiteSweep[];                  // Zones de consolidation correspondantes
  signauxAchat: SignalSweepSpring[];     // Signaux d'achat seulement
  signauxVente: SignalSweepSpring[];     // Signaux de vente seulement
  niveauxLiquidite: NiveauLiquidite[];   // Niveaux BSL/SSL détectés par le module 1
  totalSignaux: number;
}

// ─── 🚀 Moteur Principal de Calcul ────────────────────────────────────────────

/**
 * Valide les prises de liquidité (Sweep / Spring Wyckoff) en combinant :
 * 1. Les niveaux BSL/SSL détectés par le module de liquidité
 * 2. La règle de proportionnalité temporelle (le prix ne reste pas longtemps hors structure)
 * 3. La confirmation par N bougies de consolidation après réintégration
 * 
 * Traduction directe de Indicateur_Sweep_Spring_Validation.mq5.
 * 
 * Exemple :
 * const resultat = calculerSweepSpringValidation(bougies, { ratioMaxTemps: 0.10 });
 * console.log(resultat.signaux.length); // Nombre de signaux validés
 * console.log(resultat.signauxAchat[0]); // Premier signal d'achat (Spring)
 */
export function calculerSweepSpringValidation(
  bougies: Bougie[],
  options: OptionsSweepSpring = {}
): ResultatSweepSpring {
  // 1️⃣ Paramètres par défaut (identiques aux inputs MQL5)
  const sensibilitePivot = options.sensibilitePivot ?? 5;
  const maxLookback = options.maxLookbackBars ?? 1000;
  const ratioMaxTemps = options.ratioMaxTemps ?? 0.10;
  const nbBougiesConsolidation = options.nbBougiesConsolidation ?? 3;
  const activerSpringSSL = options.activerSpringSSL ?? true;
  const activerUTADBSL = options.activerUTADBSL ?? true;

  // Résultat vide si pas assez de données
  if (!bougies || bougies.length < 50) {
    return { signaux: [], boites: [], signauxAchat: [], signauxVente: [], niveauxLiquidite: [], totalSignaux: 0 };
  }

  // 2️⃣ Appel au module 1 de détection de liquidité (équivalent iCustom() dans le MQL5)
  const liquidite = calculerDetectionLiquidite(bougies, {
    sensibilitePivot,
    maxLookbackBars: maxLookback,
  });

  // Construction de buffers continus de BSL/SSL comme dans le MQL5
  // Pour chaque barre, on connaît le dernier niveau actif
  const bufferBSL: number[] = new Array(bougies.length).fill(0);
  const bufferSSL: number[] = new Array(bougies.length).fill(0);
  const bufferBarreBSL: number[] = new Array(bougies.length).fill(-1);
  const bufferBarreSSL: number[] = new Array(bougies.length).fill(-1);

  // Remplissage des buffers à partir des niveaux détectés
  let dernierBSLPrix = 0;
  let dernierBSLBarre = -1;
  let dernierSSLPrix = 0;
  let dernierSSLBarre = -1;

  for (const niveau of liquidite.niveaux) {
    if (niveau.type === 'BSL') {
      for (let i = niveau.indexOrigine; i <= niveau.indexFin && i < bougies.length; i++) {
        dernierBSLPrix = niveau.prix;
        dernierBSLBarre = niveau.indexOrigine;
        bufferBSL[i] = dernierBSLPrix;
        bufferBarreBSL[i] = dernierBSLBarre;
      }
    } else {
      for (let i = niveau.indexOrigine; i <= niveau.indexFin && i < bougies.length; i++) {
        dernierSSLPrix = niveau.prix;
        dernierSSLBarre = niveau.indexOrigine;
        bufferSSL[i] = dernierSSLPrix;
        bufferBarreSSL[i] = dernierSSLBarre;
      }
    }
  }

  const signaux: SignalSweepSpring[] = [];
  const boites: BoiteSweep[] = [];

  const depart = Math.max(20, bougies.length - maxLookback);

  // Mémorisation pour éviter les doublons sur le même niveau
  let dernierNiveauTraiteAchat = 0;
  let dernierNiveauTraiteVente = 0;

  // 3️⃣ Parcours chronologique barre par barre (identique au OnCalculate MQL5)
  for (let bar = depart; bar < bougies.length; bar++) {

    // ═══════════════════════════════════════════════════════════════
    // CAS 1 : VALIDATION SETUP ACHAT (SPRING SUR CREUX / SSL)
    // ═══════════════════════════════════════════════════════════════
    if (activerSpringSSL) {
      const niveauSSL = bufferSSL[bar];
      const barOrigineSSL = bufferBarreSSL[bar];

      // Il faut un niveau SSL valide et non encore traité
      if (niveauSSL > 0 && barOrigineSSL >= 0 && bar > barOrigineSSL && niveauSSL !== dernierNiveauTraiteAchat) {
        // Vérifie si la bougie actuelle traverse le niveau vers le bas (sortie de structure)
        const bougieActuelle = bougies[bar];
        const bougiePrecedente = bar > 0 ? bougies[bar - 1] : null;

        if (bougieActuelle.low < niveauSSL && (!bougiePrecedente || bougiePrecedente.low >= niveauSSL)) {
          const barBOS = bar;
          const dureeFormation = barBOS - barOrigineSSL;

          // Seuil max de barres tolérées hors structure (ex: 10% du temps de formation)
          const maxBarresHorsLigne = Math.max(1, Math.round(dureeFormation * ratioMaxTemps));

          // Parcours de la traversée hors structure pour trouver la réintégration
          let prixExtremeBas = bougieActuelle.low;
          let barReintegration = -1;

          for (let k = barBOS; k < bougies.length; k++) {
            if (bougies[k].low < prixExtremeBas) {
              prixExtremeBas = bougies[k].low;
            }

            // Réintégration : le cours repasse au-dessus de la ligne SSL
            if (bougies[k].close > niveauSSL) {
              barReintegration = k;
              break;
            }
          }

          // Vérification de la règle de proportionnalité temporelle
          if (barReintegration > 0) {
            const tempsHorsLigne = barReintegration - barBOS;

            if (tempsHorsLigne <= maxBarresHorsLigne) {
              // Règle des N bougies de confirmation (consolidation)
              const debutConsolidation = barReintegration + 1;
              const finConsolidation = debutConsolidation + nbBougiesConsolidation - 1;

              if (finConsolidation < bougies.length) {
                let consolidationValide = true;
                let hautRebondMax = bougies[barReintegration].high;

                // Les bougies de confirmation ne doivent pas ré-enfoncer le niveau
                for (let c = debutConsolidation; c <= finConsolidation; c++) {
                  if (bougies[c].high > hautRebondMax) {
                    hautRebondMax = bougies[c].high;
                  }
                  if (bougies[c].close < niveauSSL) {
                    consolidationValide = false;
                    break;
                  }
                }

                // Si les N bougies sont restées confinées au-dessus du support
                if (consolidationValide) {
                  const barreSignal = finConsolidation;

                  signaux.push({
                    direction: 'achat',
                    indexSignal: barreSignal,
                    tempsSignal: bougies[barreSignal].time,
                    prixEntree: bougies[barreSignal].close,
                    stopLoss: prixExtremeBas,
                    niveauLiquidite: niveauSSL,
                    indexBOS: barBOS,
                    indexReintegration: barReintegration,
                    dureeHorsStructure: tempsHorsLigne,
                    maxBarresAutorisees: maxBarresHorsLigne,
                  });

                  boites.push({
                    type: 'achat',
                    prixHaut: hautRebondMax,
                    prixBas: niveauSSL,
                    indexDebut: barBOS,
                    tempsDebut: bougies[barBOS].time,
                    indexFin: barreSignal,
                    tempsFin: bougies[barreSignal].time,
                  });

                  dernierNiveauTraiteAchat = niveauSSL;
                }
              }
            }
          }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // CAS 2 : VALIDATION SETUP VENTE (UTAD SUR SOMMET / BSL)
    // ═══════════════════════════════════════════════════════════════
    if (activerUTADBSL) {
      const niveauBSL = bufferBSL[bar];
      const barOrigineBSL = bufferBarreBSL[bar];

      if (niveauBSL > 0 && barOrigineBSL >= 0 && bar > barOrigineBSL && niveauBSL !== dernierNiveauTraiteVente) {
        const bougieActuelle = bougies[bar];
        const bougiePrecedente = bar > 0 ? bougies[bar - 1] : null;

        // Vérifie si la bougie actuelle traverse le niveau vers le haut (sortie vers le haut)
        if (bougieActuelle.high > niveauBSL && (!bougiePrecedente || bougiePrecedente.high <= niveauBSL)) {
          const barBOS = bar;
          const dureeFormation = barBOS - barOrigineBSL;

          const maxBarresHorsLigne = Math.max(1, Math.round(dureeFormation * ratioMaxTemps));

          let prixExtremeHaut = bougieActuelle.high;
          let barReintegration = -1;

          for (let k = barBOS; k < bougies.length; k++) {
            if (bougies[k].high > prixExtremeHaut) {
              prixExtremeHaut = bougies[k].high;
            }

            // Réintégration : le cours repasse en dessous de la résistance
            if (bougies[k].close < niveauBSL) {
              barReintegration = k;
              break;
            }
          }

          // Règle de proportionnalité temporelle
          if (barReintegration > 0) {
            const tempsHorsLigne = barReintegration - barBOS;

            if (tempsHorsLigne <= maxBarresHorsLigne) {
              // Règle des N bougies de confirmation
              const debutConsolidation = barReintegration + 1;
              const finConsolidation = debutConsolidation + nbBougiesConsolidation - 1;

              if (finConsolidation < bougies.length) {
                let consolidationValide = true;
                let basRebondMin = bougies[barReintegration].low;

                for (let c = debutConsolidation; c <= finConsolidation; c++) {
                  if (bougies[c].low < basRebondMin) {
                    basRebondMin = bougies[c].low;
                  }
                  // La bougie ne doit pas repasser au-dessus de la résistance
                  if (bougies[c].close > niveauBSL) {
                    consolidationValide = false;
                    break;
                  }
                }

                if (consolidationValide) {
                  const barreSignal = finConsolidation;

                  signaux.push({
                    direction: 'vente',
                    indexSignal: barreSignal,
                    tempsSignal: bougies[barreSignal].time,
                    prixEntree: bougies[barreSignal].close,
                    stopLoss: prixExtremeHaut,
                    niveauLiquidite: niveauBSL,
                    indexBOS: barBOS,
                    indexReintegration: barReintegration,
                    dureeHorsStructure: tempsHorsLigne,
                    maxBarresAutorisees: maxBarresHorsLigne,
                  });

                  boites.push({
                    type: 'vente',
                    prixHaut: niveauBSL,
                    prixBas: basRebondMin,
                    indexDebut: barBOS,
                    tempsDebut: bougies[barBOS].time,
                    indexFin: barreSignal,
                    tempsFin: bougies[barreSignal].time,
                  });

                  dernierNiveauTraiteVente = niveauBSL;
                }
              }
            }
          }
        }
      }
    }
  }

  // 4️⃣ Séparation des signaux par direction
  const signauxAchat = signaux.filter(s => s.direction === 'achat');
  const signauxVente = signaux.filter(s => s.direction === 'vente');

  return {
    signaux,
    boites,
    signauxAchat,
    signauxVente,
    niveauxLiquidite: liquidite.niveaux,
    totalSignaux: signaux.length,
  };
}
