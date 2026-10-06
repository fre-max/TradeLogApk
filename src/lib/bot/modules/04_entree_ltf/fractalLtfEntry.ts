import type { Bougie } from '@/lib/chartDataHelper';
import type { SignalSweepSpring, ResultatSweepSpring } from '../02_sweep_spring/sweepSpringValidation';

// ─── 🎯 Types et Structures de données ────────────────────────────────────────

/**
 * Représente la zone protégée issue de la liquidation (Module 2).
 * Pour un achat :
 * - prixProtege = le point le plus bas (creux extrême de la mèche de liquidation)
 * - prixBOS = le prix où le marché a confirmé la réintégration de structure
 */
export interface ZoneProtegee {
  direction: 'achat' | 'vente';
  prixProtege: number;        // Niveau extrême inviolable (SL structurel)
  prixBOS: number;            // Point de validation de la cassure/réintégration
  indexDebut: number;
  tempsDebut: number | string;
  indexFin: number;
  tempsFin: number | string;
}

/**
 * Order Block fractal détecté à l'intérieur de la zone protégée
 */
export interface OrderBlockFractal {
  direction: 'achat' | 'vente';
  prixHaut: number;           // Borne haute de l'Order Block
  prixBas: number;            // Borne basse de l'Order Block
  prixMedian: number;         // 50% de l'Order Block (équilibre / entrée sniper)
  index: number;              // Index de la bougie source de l'OB
  temps: number | string;
  mitige: boolean;            // Vrai dès que le prix est revenu re-tester la boîte
}

/**
 * Signal d'entrée précis généré par le module LTF
 */
export interface SignalEntreeLTF {
  id: string;
  direction: 'achat' | 'vente';
  typeEntree: 'retest_ob' | 'micro_bos';
  prixEntree: number;         // Prix d'exécution recommandé
  stopLoss: number;           // Stop Loss chirurgical placé sous l'OB ou le prix protégé
  distanceSL: number;         // Distance en prix entre l'entrée et le SL
  distancePips: number;       // Distance convertie en pips
  prixProtege: number;        // Le prix protégé de référence
  orderBlock: OrderBlockFractal;
  indexSignal: number;
  tempsSignal: number | string;
}

/**
 * Options de configuration du module d'entrée LTF
 */
export interface OptionsEntreeFractale {
  sourceSweep?: 'auto' | 'sweep-spring' | 'autonome'; // 'auto' utilise les résultats du module 2
  choixNiveauEntree?: 'bordure_ob' | 'median_ob' | 'cloture_confirmation'; // Défaut: median_ob (50%)
  tamponSLPips?: number;           // Pips de sécurité ajoutés au-delà du prix protégé (défaut: 1.0)
  activerAchats?: boolean;         // Défaut: true
  activerVentes?: boolean;         // Défaut: true
  afficherZoneProtegee?: boolean;  // Affiche le rectangle de zone protégée (défaut: true)
  afficherOrderBlocks?: boolean;   // Affiche les boîtes des Order Blocks LTF (défaut: true)
  afficherLignesEntreeSL?: boolean;// Trace les lignes de trade Entry et SL (défaut: true)
  maxLookbackBars?: number;        // Nombre de bougies analysées (défaut: 600)
  resultatsPrecedents?: Array<{ script: any; resultat: any }>;
  donneesM1?: Bougie[];
}

/**
 * Résultat complet retourné par le module d'entrée fractale LTF
 */
export interface ResultatEntreeFractale {
  entrees: SignalEntreeLTF[];
  zonesProtegees: ZoneProtegee[];
  orderBlocks: OrderBlockFractal[];
  dernierSignal: SignalEntreeLTF | null;
}

// ─── 🚀 Fonctions de Calcul Direct et Linéaire ─────────────────────────────────

/**
 * Détermine la taille d'un pip selon l'actif
 */
function calculerTaillePip(prix: number): number {
  if (prix > 1000) return 0.1;    // Crypto / Indices
  if (prix > 50) return 0.01;     // Paires JPY / Or
  return 0.0001;                  // Forex standard EURUSD, etc.
}

/**
 * Moteur principal de détection des entrées fractales LTF dans la zone protégée.
 * 
 * 1️⃣ Récupère la zone protégée issue de la liquidation (Module 2 Sweep/Spring)
 * 2️⃣ Identifie l'Order Block fractal et le micro-BOS à l'intérieur de cette zone
 * 3️⃣ Déclenche l'entrée sur le retest de l'OB avec un Stop Loss ultra-serré
 * 
 * Exemple :
 * const res = calculerFractalLtfEntry(bougies, {
 *   choixNiveauEntree: 'median_ob',
 *   tamponSLPips: 1.5
 * });
 * console.log('Entrées trouvées :', res.entrees.length);
 */
export function calculerFractalLtfEntry(
  bougies: Bougie[],
  options: OptionsEntreeFractale = {}
): { donnees: ResultatEntreeFractale; primitives: { boites: any[]; lignes: any[]; labels: any[] } } {
  // Primitives visuelles de sortie
  const boites: any[] = [];
  const lignes: any[] = [];
  const labels: any[] = [];

  const resultat: ResultatEntreeFractale = {
    entrees: [],
    zonesProtegees: [],
    orderBlocks: [],
    dernierSignal: null,
  };

  // 1️⃣ Vérification minimale des données
  if (!bougies || bougies.length < 30) {
    return { donnees: resultat, primitives: { boites, lignes, labels } };
  }

  const maxLookback = options.maxLookbackBars ?? 600;
  const indexDepart = Math.max(10, bougies.length - maxLookback);
  const niveauEntreePref = options.choixNiveauEntree ?? 'median_ob';
  const tamponPips = options.tamponSLPips ?? 1.0;
  const activerAchats = options.activerAchats !== false;
  const activerVentes = options.activerVentes !== false;
  const afficherZone = options.afficherZoneProtegee !== false;
  const afficherOB = options.afficherOrderBlocks !== false;
  const afficherTradeLignes = options.afficherLignesEntreeSL !== false;

  const prixActuel = bougies[bougies.length - 1].close;
  const pipSize = calculerTaillePip(prixActuel);
  const tamponPrix = tamponPips * pipSize;

  // 2️⃣ Extraction des zones protégées du Module 2 (Sweep / Spring)
  const zones: ZoneProtegee[] = [];

  // Recherche dans les résultats précédents injectés par le moteur du chart
  let sweepTrouve = false;
  if (options.resultatsPrecedents && options.resultatsPrecedents.length > 0) {
    for (const item of options.resultatsPrecedents) {
      if (item.script?.id === 'script-sweep-spring-validation' || item.resultat?.typeSpecial === 'sweep-spring') {
        const resSweep = item.resultat?.donnees as ResultatSweepSpring;
        if (resSweep && resSweep.signaux && resSweep.signaux.length > 0) {
          sweepTrouve = true;
          for (const s of resSweep.signaux) {
            if (s.indexSignal < indexDepart) continue;
            zones.push({
              direction: s.direction,
              prixProtege: s.stopLoss,
              prixBOS: s.prixEntree,
              indexDebut: s.indexBOS || s.indexSignal - 5,
              tempsDebut: s.tempsSignal,
              indexFin: s.indexSignal,
              tempsFin: s.tempsSignal,
            });
          }
        }
      }
    }
  }

  // Fallback autonome : si le module 2 n'est pas actif sur le graphique, on détecte les sweeps locaux
  if (!sweepTrouve || zones.length === 0) {
    const sensibilite = 5;
    for (let i = indexDepart; i < bougies.length - 5; i++) {
      // Détection d'un creux local (SSL)
      let estCreux = true;
      for (let k = 1; k <= sensibilite; k++) {
        if (bougies[i].low >= bougies[i - k].low || bougies[i].low >= bougies[i + k].low) {
          estCreux = false;
          break;
        }
      }

      if (estCreux && activerAchats) {
        // Recherche d'un balayage (Sweep) sous ce creux dans les 20 bougies suivantes
        const prixCreux = bougies[i].low;
        for (let j = i + 1; j < Math.min(bougies.length - 3, i + 30); j++) {
          if (bougies[j].low < prixCreux && bougies[j].close > prixCreux) {
            // Sweep haussier (Spring) : le prix a liquidé le creux et clôturé au-dessus
            zones.push({
              direction: 'achat',
              prixProtege: bougies[j].low,
              prixBOS: bougies[j].high,
              indexDebut: j,
              tempsDebut: bougies[j].time,
              indexFin: j + 3,
              tempsFin: bougies[Math.min(bougies.length - 1, j + 3)].time,
            });
            break;
          }
        }
      }

      // Détection d'un sommet local (BSL)
      let estSommet = true;
      for (let k = 1; k <= sensibilite; k++) {
        if (bougies[i].high <= bougies[i - k].high || bougies[i].high <= bougies[i + k].high) {
          estSommet = false;
          break;
        }
      }

      if (estSommet && activerVentes) {
        const prixSommet = bougies[i].high;
        for (let j = i + 1; j < Math.min(bougies.length - 3, i + 30); j++) {
          if (bougies[j].high > prixSommet && bougies[j].close < prixSommet) {
            // Sweep baissier (UTAD)
            zones.push({
              direction: 'vente',
              prixProtege: bougies[j].high,
              prixBOS: bougies[j].low,
              indexDebut: j,
              tempsDebut: bougies[j].time,
              indexFin: j + 3,
              tempsFin: bougies[Math.min(bougies.length - 1, j + 3)].time,
            });
            break;
          }
        }
      }
    }
  }

  resultat.zonesProtegees = zones;

  // 3️⃣ Pour chaque zone protégée, recherche de l'Order Block fractal et de l'entrée
  for (const zone of zones) {
    const estAchat = zone.direction === 'achat';
    if (estAchat && !activerAchats) continue;
    if (!estAchat && !activerVentes) continue;

    // Délimitation des bornes de la zone de travail fractale
    const zoneHaut = Math.max(zone.prixProtege, zone.prixBOS);
    const zoneBas = Math.min(zone.prixProtege, zone.prixBOS);

    // Dessin de la zone protégée si demandé
    if (afficherZone) {
      boites.push({
        id: `zone-protegee-${zone.indexDebut}-${zone.direction}`,
        prixHaut: zoneHaut,
        prixBas: zoneBas,
        dateDebut: zone.tempsDebut,
        dateFin: bougies[Math.min(bougies.length - 1, zone.indexDebut + 15)].time,
        couleurFond: estAchat ? 'rgba(56, 189, 248, 0.08)' : 'rgba(244, 63, 94, 0.08)',
        couleurBordure: estAchat ? '#38bdf8' : '#f43f5e',
        styleBordure: 'dashed',
        label: estAchat ? '🛡️ Zone Protégée Achat' : '🛡️ Zone Protégée Vente',
      });
    }

    // ── Recherche de l'Order Block fractal interne ──
    let orderBlock: OrderBlockFractal | null = null;

    if (estAchat) {
      // Pour un achat : on cherche la dernière bougie baissière (close < open)
      // située juste avant l'impulsion qui a réintégré la zone protégée
      for (let b = zone.indexDebut; b >= Math.max(0, zone.indexDebut - 8); b--) {
        const bg = bougies[b];
        if (bg.close <= bg.open && bg.low >= zone.prixProtege) {
          orderBlock = {
            direction: 'achat',
            prixHaut: Math.max(bg.open, bg.close),
            prixBas: bg.low,
            prixMedian: (Math.max(bg.open, bg.close) + bg.low) / 2.0,
            index: b,
            temps: bg.time,
            mitige: false,
          };
          break;
        }
      }
    } else {
      // Pour une vente : on cherche la dernière bougie haussière (close > open)
      for (let b = zone.indexDebut; b >= Math.max(0, zone.indexDebut - 8); b--) {
        const bg = bougies[b];
        if (bg.close >= bg.open && bg.high <= zone.prixProtege) {
          orderBlock = {
            direction: 'vente',
            prixHaut: bg.high,
            prixBas: Math.min(bg.open, bg.close),
            prixMedian: (bg.high + Math.min(bg.open, bg.close)) / 2.0,
            index: b,
            temps: bg.time,
            mitige: false,
          };
          break;
        }
      }
    }

    if (!orderBlock) continue;
    resultat.orderBlocks.push(orderBlock);

    // Dessin de la boîte de l'Order Block LTF
    if (afficherOB) {
      boites.push({
        id: `ob-ltf-${orderBlock.index}-${orderBlock.direction}`,
        prixHaut: orderBlock.prixHaut,
        prixBas: orderBlock.prixBas,
        dateDebut: orderBlock.temps,
        dateFin: bougies[Math.min(bougies.length - 1, orderBlock.index + 20)].time,
        couleurFond: estAchat ? 'rgba(16, 185, 129, 0.28)' : 'rgba(239, 68, 68, 0.28)',
        couleurBordure: estAchat ? '#10b981' : '#ef4444',
        label: estAchat ? '📦 OB Fractal Bull' : '📦 OB Fractal Bear',
      });
    }

    // ── 4️⃣ Détection du Retest de l'OB et Génération de l'Entrée ──
    const scanDebut = Math.max(zone.indexDebut, orderBlock.index + 1);
    const scanFin = Math.min(bougies.length, zone.indexDebut + 40);

    for (let k = scanDebut; k < scanFin; k++) {
      const bgTest = bougies[k];

      if (estAchat) {
        // Invalidation : si le prix traverse le Prix Protégé à la baisse, le setup est mort
        if (bgTest.low < zone.prixProtege) {
          break;
        }

        // Détection du Retest de l'Order Block haussier
        const aToucheOB = bgTest.low <= orderBlock.prixHaut && bgTest.high >= orderBlock.prixBas;
        if (aToucheOB && !orderBlock.mitige) {
          orderBlock.mitige = true;

          // Détermination du prix d'entrée selon l'option choisie
          let prixEntree = orderBlock.prixMedian;
          if (niveauEntreePref === 'bordure_ob') prixEntree = orderBlock.prixHaut;
          if (niveauEntreePref === 'cloture_confirmation') prixEntree = bgTest.close;

          // Le Stop Loss est calé sous le Prix Protégé (avec tampon de sécurité)
          const sl = zone.prixProtege - tamponPrix;
          const distSL = Math.abs(prixEntree - sl);
          const pipsSL = Number((distSL / pipSize).toFixed(1));

          const signal: SignalEntreeLTF = {
            id: `entree-achat-${k}`,
            direction: 'achat',
            typeEntree: 'retest_ob',
            prixEntree,
            stopLoss: sl,
            distanceSL: distSL,
            distancePips: pipsSL,
            prixProtege: zone.prixProtege,
            orderBlock,
            indexSignal: k,
            tempsSignal: bgTest.time,
          };

          resultat.entrees.push(signal);
          resultat.dernierSignal = signal;

          // Tracés des lignes Entry et SL chirurgical
          if (afficherTradeLignes) {
            lignes.push({
              id: `ligne-entry-${k}`,
              prix: prixEntree,
              dateDebut: bgTest.time,
              dateFin: bougies[Math.min(bougies.length - 1, k + 15)].time,
              couleur: '#38bdf8',
              style: 'solid',
              label: `🎯 Entrée LTF: ${prixEntree.toFixed(prixEntree > 100 ? 2 : 4)}`,
            });

            lignes.push({
              id: `ligne-sl-${k}`,
              prix: sl,
              dateDebut: bgTest.time,
              dateFin: bougies[Math.min(bougies.length - 1, k + 15)].time,
              couleur: '#f43f5e',
              style: 'dashed',
              label: `🛡️ SL Protégé (-${pipsSL}p): ${sl.toFixed(sl > 100 ? 2 : 4)}`,
            });
          }

          // Badge visuel sur la bougie du signal
          labels.push({
            id: `lbl-signal-${k}`,
            prix: bgTest.low,
            date: bgTest.time,
            texte: `🚀 ACHAT LTF (SL: ${pipsSL}p)`,
            couleur: '#10b981',
            position: 'below',
          });

          break; // Une seule entrée par zone protégée
        }
      } else {
        // Pour une vente
        if (bgTest.high > zone.prixProtege) {
          break; // Invalidation haussière
        }

        const aToucheOB = bgTest.high >= orderBlock.prixBas && bgTest.low <= orderBlock.prixHaut;
        if (aToucheOB && !orderBlock.mitige) {
          orderBlock.mitige = true;

          let prixEntree = orderBlock.prixMedian;
          if (niveauEntreePref === 'bordure_ob') prixEntree = orderBlock.prixBas;
          if (niveauEntreePref === 'cloture_confirmation') prixEntree = bgTest.close;

          const sl = zone.prixProtege + tamponPrix;
          const distSL = Math.abs(sl - prixEntree);
          const pipsSL = Number((distSL / pipSize).toFixed(1));

          const signal: SignalEntreeLTF = {
            id: `entree-vente-${k}`,
            direction: 'vente',
            typeEntree: 'retest_ob',
            prixEntree,
            stopLoss: sl,
            distanceSL: distSL,
            distancePips: pipsSL,
            prixProtege: zone.prixProtege,
            orderBlock,
            indexSignal: k,
            tempsSignal: bgTest.time,
          };

          resultat.entrees.push(signal);
          resultat.dernierSignal = signal;

          if (afficherTradeLignes) {
            lignes.push({
              id: `ligne-entry-${k}`,
              prix: prixEntree,
              dateDebut: bgTest.time,
              dateFin: bougies[Math.min(bougies.length - 1, k + 15)].time,
              couleur: '#38bdf8',
              style: 'solid',
              label: `🎯 Entrée LTF: ${prixEntree.toFixed(prixEntree > 100 ? 2 : 4)}`,
            });

            lignes.push({
              id: `ligne-sl-${k}`,
              prix: sl,
              dateDebut: bgTest.time,
              dateFin: bougies[Math.min(bougies.length - 1, k + 15)].time,
              couleur: '#f43f5e',
              style: 'dashed',
              label: `🛡️ SL Protégé (+${pipsSL}p): ${sl.toFixed(sl > 100 ? 2 : 4)}`,
            });
          }

          labels.push({
            id: `lbl-signal-${k}`,
            prix: bgTest.high,
            date: bgTest.time,
            texte: `🔻 VENTE LTF (SL: ${pipsSL}p)`,
            couleur: '#ef4444',
            position: 'above',
          });

          break;
        }
      }
    }
  }

  return {
    donnees: resultat,
    primitives: { boites, lignes, labels },
  };
}
