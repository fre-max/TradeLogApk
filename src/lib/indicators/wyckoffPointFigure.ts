import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualBox, VisualLine, VisualLabel } from '@/types/indicatorScript';

/**
 * ==============================================================================
 * 📋 GUIDE DU DÉVELOPPEUR : CONDITIONS DU SETUP & RÈGLES DE MODIFICATION
 * ==============================================================================
 * Cet indicateur implémente la méthode Wyckoff couplée au Point & Figure (P&F) :
 *  1. Détection des Trading Ranges de consolidation (Cause Wyckoff).
 *  2. Filtrage des niveaux horizontaux par nombre de retests (solidité).
 *  3. Détection des manipulations de fausse cassure :
 *     - Spring (Achat sous le support suivi d'une réintégration)
 *     - UTAD (Vente au-dessus de la résistance suivie d'une réintégration)
 *  4. Validation institutionnelle : Filtre de volume (Climax/Test) & Signature Bougies (Pinbar ou V-Shape).
 *
 * 🎯 OÙ TROUVER ET MODIFIER LE CODE DES CONDITIONS ?
 *  👉 Fonction centrale : `validerSetupWyckoff()` (vers la ligne 100).
 *     Cette fonction booléenne regroupe TOUTES les conditions requises pour valider un Spring ou UTAD.
 *
 * 🎯 LES CONDITIONS CLÉS DU SETUP POUR DÉVELOPPEUR JUNIOR :
 *
 * ─── CONDITION 1 : Solidité du Niveau (Retests) ───────────────────────────────
 *  • Au moins `minRetestsRequis` colonnes alignées (défaut: 2).
 *
 * ─── CONDITION 2 : Dépassement / Fausse Cassure ──────────────────────────────
 *  • Dépassement minimal : au moins 0.5 boîte pour sortir du Range.
 *  • Dépassement maximal : pas plus de 8 boîtes (au-delà, c'est un breakout durable).
 *
 * ─── CONDITION 3 : Réintégration Intérieure ──────────────────────────────────
 *  • La colonne suivante doit réintégrer d'au moins 0.5 boîte à l'intérieur du Range.
 *
 * ─── CONDITION 4 : Validation Volume & Grandes Bougies ───────────────────────
 *  • Volume climax ou test institutionnel.
 *  • Pinbar avec mèche de rejet ou V-Shape de displacement rapide.
 * ==============================================================================
 */

/**
 * Options configurables par l'utilisateur pour l'indicateur Wyckoff Point & Figure.
 */
export interface OptionsWyckoffPointFigure {
  modeTailleBox?: 'auto_atr' | 'fixe';
  periodeATR?: number;
  ratioBoxATR?: number;
  tailleBoxPips?: number;
  reversalCount?: number;
  colonnesMinRange?: number;
  minRetestsRequis?: number;
  maxLookbackBars?: number;
  // Options du filtre de volume
  activerFiltreVolume?: boolean;
  typeValidationVolume?: 'climax' | 'test' | 'climax_ou_test';
  seuilRatioVolume?: number;
  periodeMoyenneVolume?: number;
  // Options du filtre de Grandes Bougies & V-Shape Reversal (Signature Institutionnelle)
  activerFiltreGrandesBougies?: boolean;
  multiplicateurTailleATR?: number;
  exigerRetourSuperieurOuEgal?: boolean;
  maxBougiesHorsRange?: number;
  ratioMecheRejetSimple?: number;
  // Filtres de direction et d'affichage
  activerSpring?: boolean;
  activerUTAD?: boolean;
  afficherRanges?: boolean;
  afficherLignesNiveaux?: boolean;
  afficherCiblesWyckoff?: boolean;
}

/**
 * Signal de trading généré par le moteur Wyckoff Point & Figure.
 */
export interface SignalWyckoffPF {
  direction: 'achat' | 'vente';
  type: string;
  prixEntree: number;
  stopLoss: number;
  takeProfit: number;
  largeurCauseColonnes: number;
  nbRetests: number;
  qualiteNiveau: string;
  motifVolume: string;
  patternBougie?: string;
  motifBougie?: string;
  ratioForceRetour?: number;
  temps: number | string;
}

/**
 * Résultat complet retourné par le calcul de l'indicateur.
 */
export interface ResultatWyckoffPointFigure {
  totalColonnesPF: number;
  tailleBoxCalculee: number;
  modeVolumeActif: boolean;
  signaux: SignalWyckoffPF[];
  boites: VisualBox[];
  lignes: VisualLine[];
  labels: VisualLabel[];
}

/**
 * Représente une colonne du graphique Point & Figure.
 */
interface ColonnePF {
  type: 'X' | 'O';
  haut: number;
  bas: number;
  indexDebut: number;
  indexFin: number;
  tempsDebut: number | string;
  tempsFin: number | string;
}

/**
 * ==============================================================================
 * 🎯 FONCTION CENTRALE DE VALIDATION D'UN SETUP WYCKOFF (SPRING OU UTAD)
 * ==============================================================================
 * Cette fonction rassemble TOUTES les conditions qu'un Spring ou UTAD Wyckoff
 * doit respecter pour être validé et générer un signal de trading.
 *
 * Pour un développeur junior :
 * Si tu souhaites assouplir ou modifier les règles de validation Wyckoff,
 * c'est ICI qu'il faut intervenir !
 *
 * Règles vérifiées :
 *  1️⃣ Le niveau a été retesté assez de fois (`nbRetests >= minRetestsRequis`)
 *  2️⃣ Fausse cassure calibrée : dépassement entre 0.5 et 8 boîtes P&F
 *  3️⃣ Réintégration confirmée dans le Trading Range
 *  4️⃣ Validation du filtre de volume (Effort vs Résultat)
 *  5️⃣ Validation du filtre de bougies (Pinbar de rejet ou V-Shape rapide)
 *
 * Exemple :
 * const estValide = validerSetupWyckoff({
 *   type: 'spring',
 *   nbRetests: 3,
 *   minRetestsRequis: 2,
 *   depassement: 15,
 *   tailleBox: 10,
 *   aReintegre: true,
 *   volumeValide: true,
 *   bougiesValide: true
 * }); // Renvoie true
 */
export function validerSetupWyckoff(params: {
  type: 'spring' | 'utad';
  nbRetests: number;
  minRetestsRequis: number;
  depassement: number;
  tailleBox: number;
  aReintegre: boolean;
  volumeValide: boolean;
  bougiesValide: boolean;
}): boolean {
  const {
    nbRetests,
    minRetestsRequis,
    depassement,
    tailleBox,
    aReintegre,
    volumeValide,
    bougiesValide,
  } = params;

  // 1️⃣ Règle de solidité du niveau (nombre de retests)
  if (nbRetests < minRetestsRequis) {
    return false;
  }

  // 2️⃣ Règle de fausse cassure (ni trop faible ni breakout incontrôlé)
  const depassementMin = tailleBox * 0.5;
  const depassementMax = tailleBox * 8;
  if (depassement < depassementMin || depassement > depassementMax) {
    return false;
  }

  // 3️⃣ Règle de réintégration dans le Range
  if (!aReintegre) {
    return false;
  }

  // 4️⃣ Règle de volume (climax ou test)
  if (!volumeValide) {
    return false;
  }

  // 5️⃣ Règle de morphologie de bougie (rejet pinbar ou V-Shape)
  if (!bougiesValide) {
    return false;
  }

  return true;
}

/**
 * Calcule les structures Wyckoff (Ranges, Springs, UTAD) à partir d'un lissage Point & Figure,
 * avec filtre de volume paramétrable (loi Effort vs Résultat) et calcul de la Cause à Effet.
 * 
 * Exemple d'utilisation :
 * const res = calculerWyckoffPointAndFigure(bougies, {
 *   activerFiltreVolume: true,
 *   typeValidationVolume: 'climax_ou_test'
 * });
 * console.log(`Nombre de signaux Wyckoff : ${res.signaux.length}`);
 */
export function calculerWyckoffPointAndFigure(
  bougies: Bougie[],
  options: OptionsWyckoffPointFigure = {}
): ResultatWyckoffPointFigure {
  // 1️⃣ Vérifications de base des données d'entrée
  if (!bougies || bougies.length < 50) {
    return {
      totalColonnesPF: 0,
      tailleBoxCalculee: 0,
      modeVolumeActif: false,
      signaux: [],
      boites: [],
      lignes: [],
      labels: [],
    };
  }

  // 2️⃣ Préparation des paramètres par défaut
  const modeTailleBox = options.modeTailleBox || 'auto_atr';
  const periodeATR = options.periodeATR ?? 14;
  const ratioBoxATR = options.ratioBoxATR ?? 0.5;
  const tailleBoxPips = options.tailleBoxPips ?? 10;
  const reversalCount = options.reversalCount ?? 3;
  const colonnesMinRange = options.colonnesMinRange ?? 4;
  const minRetestsRequis = options.minRetestsRequis ?? 2;
  const maxLookback = options.maxLookbackBars ?? 1000;

  // Options du filtre de volume
  const activerFiltreVolume = options.activerFiltreVolume !== false;
  const typeValidationVolume = options.typeValidationVolume || 'climax_ou_test';
  const seuilRatioVolume = options.seuilRatioVolume ?? 1.3;
  const periodeMoyenneVolume = options.periodeMoyenneVolume ?? 20;

  // Options du filtre de Grandes Bougies & V-Shape Reversal
  const activerFiltreGrandesBougies = options.activerFiltreGrandesBougies !== false;
  const multiplicateurTailleATR = options.multiplicateurTailleATR ?? 1.3;
  const exigerRetourSuperieurOuEgal = options.exigerRetourSuperieurOuEgal !== false;
  const maxBougiesHorsRange = options.maxBougiesHorsRange ?? 3;
  const ratioMecheRejetSimple = options.ratioMecheRejetSimple ?? 0.40;

  // Options d'affichage
  const activerSpring = options.activerSpring !== false;
  const activerUTAD = options.activerUTAD !== false;
  const afficherRanges = options.afficherRanges !== false;
  const afficherLignesNiveaux = options.afficherLignesNiveaux !== false;
  const afficherCiblesWyckoff = options.afficherCiblesWyckoff !== false;

  // 3️⃣ Calcul du pas de cotation (pip) et de la taille de la boîte (Box Size)
  const dernierPrix = bougies[bougies.length - 1].close;
  let pipSize = 0.0001;
  if (dernierPrix > 1000) pipSize = 0.1;
  else if (dernierPrix > 50) pipSize = 0.01;

  let tailleBox = 10 * pipSize;
  if (modeTailleBox === 'auto_atr') {
    // Calcul de l'ATR sur la période récente pour adapter la boîte à la dynamique du marché
    let sommeTR = 0;
    const debutATR = Math.max(1, bougies.length - periodeATR);
    for (let i = debutATR; i < bougies.length; i++) {
      const h = bougies[i].high;
      const l = bougies[i].low;
      const prevClose = bougies[i - 1].close;
      const tr = Math.max(h - l, Math.abs(h - prevClose), Math.abs(l - prevClose));
      sommeTR += tr;
    }
    const atrMoyen = sommeTR / Math.max(1, bougies.length - debutATR);
    tailleBox = Math.max(pipSize, atrMoyen * ratioBoxATR);
  } else {
    tailleBox = Math.max(pipSize, tailleBoxPips * pipSize);
  }

  // 4️⃣ Construction des colonnes Point et Figure (P&F)
  const debutIndex = Math.max(0, bougies.length - maxLookback);
  const colonnes: ColonnePF[] = [];

  // Première colonne basée sur la première bougie analysée
  let colType: 'X' | 'O' = bougies[debutIndex].close >= bougies[debutIndex].open ? 'X' : 'O';
  let colBas = Math.floor(bougies[debutIndex].low / tailleBox) * tailleBox;
  let colHaut = Math.ceil(bougies[debutIndex].high / tailleBox) * tailleBox;
  if (colHaut <= colBas) colHaut = colBas + tailleBox;

  let colIndexDebut = debutIndex;
  let colIndexFin = debutIndex;
  let colTempsDebut = bougies[debutIndex].time;
  let colTempsFin = bougies[debutIndex].time;

  for (let i = debutIndex + 1; i < bougies.length; i++) {
    const b = bougies[i];

    if (colType === 'X') {
      // Colonne en hausse : on vérifie si elle progresse de nouvelles boîtes vers le haut
      if (b.high >= colHaut + tailleBox) {
        const boitesAjoutees = Math.floor((b.high - colHaut) / tailleBox);
        colHaut += boitesAjoutees * tailleBox;
        colIndexFin = i;
        colTempsFin = b.time;
      } else {
        // Vérification d'un retournement baissier (Reversal de N boîtes)
        const seuilRetournement = colHaut - (reversalCount * tailleBox);
        if (b.low <= seuilRetournement) {
          colonnes.push({
            type: 'X',
            haut: colHaut,
            bas: colBas,
            indexDebut: colIndexDebut,
            indexFin: colIndexFin,
            tempsDebut: colTempsDebut,
            tempsFin: colTempsFin,
          });
          // Transition vers une nouvelle colonne descendante 'O'
          colType = 'O';
          colHaut = colHaut - tailleBox;
          const boitesBaisse = Math.floor((colHaut - b.low) / tailleBox);
          colBas = colHaut - (boitesBaisse * tailleBox);
          colIndexDebut = i;
          colIndexFin = i;
          colTempsDebut = b.time;
          colTempsFin = b.time;
        }
      }
    } else {
      // Colonne en baisse : on vérifie si elle progresse de nouvelles boîtes vers le bas
      if (b.low <= colBas - tailleBox) {
        const boitesRetirees = Math.floor((colBas - b.low) / tailleBox);
        colBas -= boitesRetirees * tailleBox;
        colIndexFin = i;
        colTempsFin = b.time;
      } else {
        // Vérification d'un retournement haussier (Reversal de N boîtes)
        const seuilRetournement = colBas + (reversalCount * tailleBox);
        if (b.high >= seuilRetournement) {
          colonnes.push({
            type: 'O',
            haut: colHaut,
            bas: colBas,
            indexDebut: colIndexDebut,
            indexFin: colIndexFin,
            tempsDebut: colTempsDebut,
            tempsFin: colTempsFin,
          });
          // Transition vers une nouvelle colonne montante 'X'
          colType = 'X';
          colBas = colBas + tailleBox;
          const boitesHausse = Math.floor((b.high - colBas) / tailleBox);
          colHaut = colBas + (boitesHausse * tailleBox);
          colIndexDebut = i;
          colIndexFin = i;
          colTempsDebut = b.time;
          colTempsFin = b.time;
        }
      }
    }
  }

  // Ajout de la dernière colonne en cours
  colonnes.push({
    type: colType,
    haut: colHaut,
    bas: colBas,
    indexDebut: colIndexDebut,
    indexFin: colIndexFin,
    tempsDebut: colTempsDebut,
    tempsFin: colTempsFin,
  });

  // 5️⃣ Fonction d'évaluation du Volume selon Wyckoff (Effort vs Résultat)
  function verifierVolumeWyckoff(indexCassure: number, indexReintegration: number): { valide: boolean; motif: string } {
    // Si l'utilisateur désactive le volume, validation immédiate (Mode P&F Pur)
    if (!activerFiltreVolume) {
      return { valide: true, motif: 'Volume désactivé (P&F Pur)' };
    }

    // Calcul du volume moyen sur la période précédant la réintégration
    let sommeVolume = 0;
    let nbBougies = 0;
    const debutMoy = Math.max(0, indexReintegration - periodeMoyenneVolume);
    for (let k = debutMoy; k < indexReintegration; k++) {
      sommeVolume += Number((bougies[k] as any)?.volume || (bougies[k] as any)?.tick_volume || 0);
      nbBougies++;
    }
    const volumeMoyen = nbBougies > 0 ? (sommeVolume / nbBougies) : 1;

    const volCassure = Number((bougies[indexCassure] as any)?.volume || (bougies[indexCassure] as any)?.tick_volume || 0);
    const volReintegration = Number((bougies[indexReintegration] as any)?.volume || (bougies[indexReintegration] as any)?.tick_volume || 0);
    const volMax = Math.max(volCassure, volReintegration);

    const estClimax = volMax >= (volumeMoyen * seuilRatioVolume);
    const estTestFaible = volReintegration <= (volumeMoyen / seuilRatioVolume);

    if (typeValidationVolume === 'climax') {
      return {
        valide: estClimax,
        motif: estClimax ? 'Absorption / Climax (Fort volume)' : 'Volume insuffisant pour Climax',
      };
    } else if (typeValidationVolume === 'test') {
      return {
        valide: estTestFaible,
        motif: estTestFaible ? 'Test validé (Assèchement vendeur)' : 'Trop de volume persistant',
      };
    } else {
      // Mode mixte : absorption OU épuisement
      const estValide = estClimax || estTestFaible;
      return {
        valide: estValide,
        motif: estClimax ? 'Absorption (Climax)' : (estTestFaible ? 'Assèchement (Test)' : 'Volume neutre non validé'),
      };
    }
  }

  // Helper pour qualifier la solidité institutionnelle du niveau selon le nombre de touches P&F
  function qualifierSoliditeNiveau(touches: number): string {
    if (touches >= 4) return 'Institutionnel (A+)';
    if (touches === 3) return 'Majeur';
    if (touches === 2) return 'Standard';
    return 'Faible';
  }

  // 6️⃣ Validation chirurgicale des Grandes Bougies (Taille totale, Pinbar et V-Shape Reversal)
  interface ValidationBougieResult {
    valide: boolean;
    motif: string;
    pattern: string;
    tailleSortie: number;
    tailleRetour: number;
    ratioForce: number;
  }

  function verifierGrandesBougiesWyckoff(
    type: 'spring' | 'utad',
    indexDebutScan: number,
    indexFinScan: number
  ): ValidationBougieResult {
    if (!activerFiltreGrandesBougies) {
      return {
        valide: true,
        motif: 'Filtre grandes bougies désactivé',
        pattern: 'P&F Standard',
        tailleSortie: 0,
        tailleRetour: 0,
        ratioForce: 1,
      };
    }

    // Calcul de l'ATR local sur la période récente autour de la cassure
    let sommeTR = 0;
    let countTR = 0;
    const debutATR = Math.max(1, indexFinScan - periodeATR);
    for (let k = debutATR; k <= indexFinScan; k++) {
      const h = bougies[k].high;
      const l = bougies[k].low;
      const prevC = bougies[k - 1].close;
      sommeTR += Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
      countTR++;
    }
    const atrLocal = countTR > 0 ? sommeTR / countTR : (tailleBox / (ratioBoxATR || 0.5));
    const seuilGrandeBougie = atrLocal * multiplicateurTailleATR;

    const debut = Math.max(0, indexDebutScan);
    const fin = Math.min(bougies.length - 1, indexFinScan);

    if (type === 'spring') {
      // Trouver la bougie du point le plus bas (le sweep de liquidation)
      let minLow = 9999999;
      let indexCreux = debut;
      for (let k = debut; k <= fin; k++) {
        if (bougies[k].low < minLow) {
          minLow = bougies[k].low;
          indexCreux = k;
        }
      }

      const bSortie = bougies[indexCreux];
      const indexRetour = fin;
      const bRetour = bougies[indexRetour];
      const nbBougiesHors = Math.max(1, indexRetour - indexCreux + 1);

      const tailleSortie = bSortie.high - bSortie.low;
      const tailleRetour = bRetour.high - bRetour.low;
      const ratioForce = tailleRetour / Math.max(1e-6, tailleSortie);

      // CAS 1 : Spring en 1 seule bougie (Pinbar / Marteau avec grande mèche de rejet basse)
      if (indexCreux === indexRetour) {
        const corpsBas = Math.min(bSortie.open, bSortie.close);
        const mecheBasse = corpsBas - bSortie.low;
        const ratioMeche = mecheBasse / Math.max(1e-6, tailleSortie);

        const estGrande = tailleSortie >= seuilGrandeBougie;
        const aRejet = ratioMeche >= ratioMecheRejetSimple;

        if (estGrande && aRejet) {
          return {
            valide: true,
            motif: `Pinbar 1-Bougie (Taille: ${(tailleSortie / pipSize).toFixed(1)}p, Mèche: ${(ratioMeche * 100).toFixed(0)}%)`,
            pattern: 'Pinbar 1-Bougie',
            tailleSortie,
            tailleRetour,
            ratioForce: 1,
          };
        } else {
          return {
            valide: false,
            motif: `Pinbar rejetée (Grande: ${estGrande ? 'OUI' : 'NON'}, Rejet: ${(ratioMeche * 100).toFixed(0)}% vs min ${(ratioMecheRejetSimple * 100).toFixed(0)}%)`,
            pattern: 'Pinbar Invalide',
            tailleSortie,
            tailleRetour,
            ratioForce: 1,
          };
        }
      }

      // CAS 2 : Spring en 2 ou 3 bougies (V-Shape / Displacement)
      // A. Vérification de la rapidité (temps passé sous le niveau)
      if (nbBougiesHors > maxBougiesHorsRange) {
        return {
          valide: false,
          motif: `Retour trop lent (${nbBougiesHors} bougies > max ${maxBougiesHorsRange})`,
          pattern: 'V-Shape Rejeté',
          tailleSortie,
          tailleRetour,
          ratioForce,
        };
      }

      // B. Vérification de la taille (au moins une grande bougie au-dessus du seuil ATR)
      const auMoinsUneGrande = (tailleSortie >= seuilGrandeBougie) || (tailleRetour >= seuilGrandeBougie);
      if (!auMoinsUneGrande) {
        return {
          valide: false,
          motif: `Bougies trop petites (< seuil ATR ${(seuilGrandeBougie / pipSize).toFixed(1)}p)`,
          pattern: 'V-Shape Rejeté',
          tailleSortie,
          tailleRetour,
          ratioForce,
        };
      }

      // C. Règle clé : la bougie de retour doit être >= bougie de liquidation
      if (exigerRetourSuperieurOuEgal && ratioForce < 0.95) {
        return {
          valide: false,
          motif: `Bougie retour inférieure à la sortie (Force: ${(ratioForce * 100).toFixed(0)}% < 95%)`,
          pattern: 'V-Shape Rejeté',
          tailleSortie,
          tailleRetour,
          ratioForce,
        };
      }

      // D. La bougie de réintégration doit être haussière
      if (bRetour.close < bRetour.open) {
        return {
          valide: false,
          motif: 'Bougie de réintégration baissière',
          pattern: 'V-Shape Rejeté',
          tailleSortie,
          tailleRetour,
          ratioForce,
        };
      }

      return {
        valide: true,
        motif: `V-Shape Haussier validé (${nbBougiesHors}b, Force: ${(ratioForce * 100).toFixed(0)}%)`,
        pattern: 'V-Shape 2/3-Bougies',
        tailleSortie,
        tailleRetour,
        ratioForce,
      };
    } else {
      // UTAD (Distribution - Vente au-dessus de la résistance)
      let maxHigh = -9999999;
      let indexSommet = debut;
      for (let k = debut; k <= fin; k++) {
        if (bougies[k].high > maxHigh) {
          maxHigh = bougies[k].high;
          indexSommet = k;
        }
      }

      const bSortie = bougies[indexSommet];
      const indexRetour = fin;
      const bRetour = bougies[indexRetour];
      const nbBougiesHors = Math.max(1, indexRetour - indexSommet + 1);

      const tailleSortie = bSortie.high - bSortie.low;
      const tailleRetour = bRetour.high - bRetour.low;
      const ratioForce = tailleRetour / Math.max(1e-6, tailleSortie);

      // CAS 1 : UTAD en 1 seule bougie (Étoile filante / Pinbar haute)
      if (indexSommet === indexRetour) {
        const corpsHaut = Math.max(bSortie.open, bSortie.close);
        const mecheHaute = bSortie.high - corpsHaut;
        const ratioMeche = mecheHaute / Math.max(1e-6, tailleSortie);

        const estGrande = tailleSortie >= seuilGrandeBougie;
        const aRejet = ratioMeche >= ratioMecheRejetSimple;

        if (estGrande && aRejet) {
          return {
            valide: true,
            motif: `Pinbar Haute 1-Bougie (Taille: ${(tailleSortie / pipSize).toFixed(1)}p, Mèche: ${(ratioMeche * 100).toFixed(0)}%)`,
            pattern: 'Pinbar 1-Bougie',
            tailleSortie,
            tailleRetour,
            ratioForce: 1,
          };
        } else {
          return {
            valide: false,
            motif: `Pinbar Haute rejetée (Grande: ${estGrande ? 'OUI' : 'NON'}, Rejet: ${(ratioMeche * 100).toFixed(0)}% vs min ${(ratioMecheRejetSimple * 100).toFixed(0)}%)`,
            pattern: 'Pinbar Invalide',
            tailleSortie,
            tailleRetour,
            ratioForce: 1,
          };
        }
      }

      // CAS 2 : UTAD en 2 ou 3 bougies (V-Shape Inversé)
      if (nbBougiesHors > maxBougiesHorsRange) {
        return {
          valide: false,
          motif: `Retour trop lent (${nbBougiesHors} bougies > max ${maxBougiesHorsRange})`,
          pattern: 'V-Shape Rejeté',
          tailleSortie,
          tailleRetour,
          ratioForce,
        };
      }

      const auMoinsUneGrande = (tailleSortie >= seuilGrandeBougie) || (tailleRetour >= seuilGrandeBougie);
      if (!auMoinsUneGrande) {
        return {
          valide: false,
          motif: `Bougies trop petites (< seuil ATR ${(seuilGrandeBougie / pipSize).toFixed(1)}p)`,
          pattern: 'V-Shape Rejeté',
          tailleSortie,
          tailleRetour,
          ratioForce,
        };
      }

      if (exigerRetourSuperieurOuEgal && ratioForce < 0.95) {
        return {
          valide: false,
          motif: `Bougie retour inférieure à la sortie (Force: ${(ratioForce * 100).toFixed(0)}% < 95%)`,
          pattern: 'V-Shape Rejeté',
          tailleSortie,
          tailleRetour,
          ratioForce,
        };
      }

      if (bRetour.close > bRetour.open) {
        return {
          valide: false,
          motif: 'Bougie de réintégration haussière (non vendeuse)',
          pattern: 'V-Shape Rejeté',
          tailleSortie,
          tailleRetour,
          ratioForce,
        };
      }

      return {
        valide: true,
        motif: `V-Shape Baissier validé (${nbBougiesHors}b, Force: ${(ratioForce * 100).toFixed(0)}%)`,
        pattern: 'V-Shape 2/3-Bougies',
        tailleSortie,
        tailleRetour,
        ratioForce,
      };
    }
  }

  // 7️⃣ Détection des Trading Ranges, des Springs et des UTAD
  const boitesVisuelles: VisualBox[] = [];
  const lignesVisuelles: VisualLine[] = [];
  const labelsVisuels: VisualLabel[] = [];
  const signaux: SignalWyckoffPF[] = [];

  for (let c = colonnesMinRange + 1; c < colonnes.length; c++) {
    const colActuelle = colonnes[c];
    const colPrecedente = colonnes[c - 1];

    // ─── A. DÉTECTION DU SPRING WYCKOFF (ACHAT) ─────────────────────────
    if (activerSpring && colPrecedente.type === 'O' && colActuelle.type === 'X') {
      let minBas = 9999999;
      let maxHaut = -9999999;
      const creuxPrecedents: number[] = [];
      const debutRange = Math.max(0, c - (colonnesMinRange * 3) - 1);

      for (let r = debutRange; r < c - 1; r++) {
        if (colonnes[r].type === 'O') creuxPrecedents.push(colonnes[r].bas);
        if (colonnes[r].bas < minBas) minBas = colonnes[r].bas;
        if (colonnes[r].haut > maxHaut) maxHaut = colonnes[r].haut;
      }

      if (creuxPrecedents.length >= 2) {
        const creuxTries = [...creuxPrecedents].sort((a, b) => a - b);
        const supportEstime = creuxTries[0];

        // 🔍 Comptage précis des colonnes 'O' distinctes ayant rebondi sur ce support (à ±1.5 boîtes)
        let nbRetests = 0;
        for (let r = debutRange; r < c - 1; r++) {
          if (colonnes[r].type === 'O') {
            if (Math.abs(colonnes[r].bas - supportEstime) <= (tailleBox * 1.5)) {
              nbRetests++;
            }
          }
        }

        const qualiteNiveau = qualifierSoliditeNiveau(nbRetests);

        const depassementBas = supportEstime - colPrecedente.bas;
        const aReintegre = colActuelle.haut >= supportEstime + (tailleBox * 0.5);
        const testVolume = verifierVolumeWyckoff(colPrecedente.indexFin, colActuelle.indexFin);
        const testBougies = verifierGrandesBougiesWyckoff('spring', colPrecedente.indexDebut, colActuelle.indexFin);

        // ✅ Utilisation de la fonction centrale de validation du setup Wyckoff
        const estValide = validerSetupWyckoff({
          type: 'spring',
          nbRetests,
          minRetestsRequis,
          depassement: depassementBas,
          tailleBox,
          aReintegre,
          volumeValide: testVolume.valide,
          bougiesValide: testBougies.valide,
        });

        if (estValide) {
            const bgSignal = bougies[colActuelle.indexFin];
            const largeurRange = c - (c - colonnesMinRange - 1);
            // Loi de Cause à Effet de Wyckoff : projection proportionnelle à la largeur du Range
            const cibleWyckoff = supportEstime + (largeurRange * tailleBox * reversalCount);
            const stopLoss = colPrecedente.bas - (tailleBox * 0.5);

            signaux.push({
              direction: 'achat',
              type: 'Spring Wyckoff P&F',
              prixEntree: bgSignal.close,
              stopLoss: stopLoss,
              takeProfit: cibleWyckoff,
              largeurCauseColonnes: largeurRange,
              nbRetests: nbRetests,
              qualiteNiveau: qualiteNiveau,
              motifVolume: testVolume.motif,
              patternBougie: testBougies.pattern,
              motifBougie: testBougies.motif,
              ratioForceRetour: testBougies.ratioForce,
              temps: bgSignal.time,
            });

            if (afficherRanges) {
              boitesVisuelles.push({
                id: 'range-' + c,
                prixHaut: maxHaut,
                prixBas: supportEstime,
                dateDebut: colonnes[c - colonnesMinRange - 1].tempsDebut,
                dateFin: colActuelle.tempsFin,
                couleurFond: 'rgba(33, 150, 243, 0.08)',
                couleurBordure: 'rgba(33, 150, 243, 0.35)',
                label: 'Trading Range P&F',
              });
            }

            // Ligne horizontale du Support avec badge de retests
            if (afficherLignesNiveaux) {
              lignesVisuelles.push({
                id: 'support-pf-' + c,
                prix: supportEstime,
                dateDebut: colonnes[c - colonnesMinRange - 1].tempsDebut,
                dateFin: colActuelle.tempsFin,
                couleur: nbRetests >= 4 ? '#00e676' : (nbRetests === 3 ? '#26a69a' : '#00b0ff'),
                style: 'solid',
                epaisseur: nbRetests >= 4 ? 2.5 : (nbRetests === 3 ? 2 : 1.5),
                label: `Support (${nbRetests}x Tests - ${qualiteNiveau})`,
              });
            }

            boitesVisuelles.push({
              id: 'spring-' + c,
              prixHaut: supportEstime,
              prixBas: colPrecedente.bas,
              dateDebut: colPrecedente.tempsDebut,
              dateFin: colActuelle.tempsFin,
              couleurFond: 'rgba(0, 200, 83, 0.25)',
              couleurBordure: '#00c853',
              label: '🟢 Spring',
            });

            if (afficherCiblesWyckoff) {
              lignesVisuelles.push({
                id: 'cible-spring-' + c,
                prix: cibleWyckoff,
                dateDebut: colActuelle.tempsFin,
                couleur: '#00e676',
                style: 'dashed',
                epaisseur: 1.5,
                label: `🎯 Cible Wyckoff (${largeurRange} cols)`,
              });
            }

            const tagQualite = nbRetests >= 4 ? ` [A+ ${nbRetests}T]` : ` [${nbRetests}T]`;
            const tagVol = activerFiltreVolume ? ' Vol' : '';
            const tagPattern = activerFiltreGrandesBougies ? ` ${testBougies.pattern.includes('Pinbar') ? '⚡Pinbar' : '🚀V-Shape'}` : '';

            labelsVisuels.push({
              id: 'lbl-spring-' + c,
              prix: bgSignal.low,
              date: bgSignal.time,
              texte: `▲ SPRING${tagQualite}${tagPattern}${tagVol ? ' /' + tagVol : ''}`,
              couleur: nbRetests >= 4 ? '#00e676' : '#089981',
              position: 'below',
            });
          }
        }
    }

    // ─── B. DÉTECTION DU UTAD WYCKOFF (VENTE) ───────────────────────────
    if (activerUTAD && colPrecedente.type === 'X' && colActuelle.type === 'O') {
      let minBas = 9999999;
      let maxHaut = -9999999;
      const sommetsPrecedents: number[] = [];
      const debutRange = Math.max(0, c - (colonnesMinRange * 3) - 1);

      for (let r = debutRange; r < c - 1; r++) {
        if (colonnes[r].type === 'X') sommetsPrecedents.push(colonnes[r].haut);
        if (colonnes[r].bas < minBas) minBas = colonnes[r].bas;
        if (colonnes[r].haut > maxHaut) maxHaut = colonnes[r].haut;
      }

      if (sommetsPrecedents.length >= 2) {
        const sommetsTries = [...sommetsPrecedents].sort((a, b) => b - a);
        const resistanceEstimee = sommetsTries[0];

        // 🔍 Comptage précis des colonnes 'X' distinctes ayant rebondi sur cette résistance (à ±1.5 boîtes)
        let nbRetests = 0;
        for (let r = debutRange; r < c - 1; r++) {
          if (colonnes[r].type === 'X') {
            if (Math.abs(colonnes[r].haut - resistanceEstimee) <= (tailleBox * 1.5)) {
              nbRetests++;
            }
          }
        }

        const qualiteNiveau = qualifierSoliditeNiveau(nbRetests);

        const depassementHaut = colPrecedente.haut - resistanceEstimee;
        const aReintegre = colActuelle.bas <= resistanceEstimee - (tailleBox * 0.5);
        const testVolume = verifierVolumeWyckoff(colPrecedente.indexFin, colActuelle.indexFin);
        const testBougies = verifierGrandesBougiesWyckoff('utad', colPrecedente.indexDebut, colActuelle.indexFin);

        // ✅ Utilisation de la fonction centrale de validation du setup Wyckoff
        const estValide = validerSetupWyckoff({
          type: 'utad',
          nbRetests,
          minRetestsRequis,
          depassement: depassementHaut,
          tailleBox,
          aReintegre,
          volumeValide: testVolume.valide,
          bougiesValide: testBougies.valide,
        });

        if (estValide) {
            const bgSignal = bougies[colActuelle.indexFin];
            const largeurRange = c - (c - colonnesMinRange - 1);
            const cibleWyckoff = resistanceEstimee - (largeurRange * tailleBox * reversalCount);
            const stopLoss = colPrecedente.haut + (tailleBox * 0.5);

            signaux.push({
              direction: 'vente',
              type: 'UTAD Wyckoff P&F',
              prixEntree: bgSignal.close,
              stopLoss: stopLoss,
              takeProfit: cibleWyckoff,
              largeurCauseColonnes: largeurRange,
              nbRetests: nbRetests,
              qualiteNiveau: qualiteNiveau,
              motifVolume: testVolume.motif,
              patternBougie: testBougies.pattern,
              motifBougie: testBougies.motif,
              ratioForceRetour: testBougies.ratioForce,
              temps: bgSignal.time,
            });

            if (afficherRanges) {
              boitesVisuelles.push({
                id: 'range-utad-' + c,
                prixHaut: resistanceEstimee,
                prixBas: minBas,
                dateDebut: colonnes[c - colonnesMinRange - 1].tempsDebut,
                dateFin: colActuelle.tempsFin,
                couleurFond: 'rgba(244, 67, 54, 0.08)',
                couleurBordure: 'rgba(244, 67, 54, 0.35)',
                label: 'Trading Range P&F',
              });
            }

            // Ligne horizontale de la Résistance avec badge de retests
            if (afficherLignesNiveaux) {
              lignesVisuelles.push({
                id: 'resistance-pf-' + c,
                prix: resistanceEstimee,
                dateDebut: colonnes[c - colonnesMinRange - 1].tempsDebut,
                dateFin: colActuelle.tempsFin,
                couleur: nbRetests >= 4 ? '#ff1744' : (nbRetests === 3 ? '#ef5350' : '#ff9100'),
                style: 'solid',
                epaisseur: nbRetests >= 4 ? 2.5 : (nbRetests === 3 ? 2 : 1.5),
                label: `Résistance (${nbRetests}x Tests - ${qualiteNiveau})`,
              });
            }

            boitesVisuelles.push({
              id: 'utad-' + c,
              prixHaut: colPrecedente.haut,
              prixBas: resistanceEstimee,
              dateDebut: colPrecedente.tempsDebut,
              dateFin: colActuelle.tempsFin,
              couleurFond: 'rgba(255, 23, 68, 0.25)',
              couleurBordure: '#ff1744',
              label: '🔴 UTAD',
            });

            if (afficherCiblesWyckoff) {
              lignesVisuelles.push({
                id: 'cible-utad-' + c,
                prix: cibleWyckoff,
                dateDebut: colActuelle.tempsFin,
                couleur: '#ff5252',
                style: 'dashed',
                epaisseur: 1.5,
                label: `🎯 Cible Wyckoff (${largeurRange} cols)`,
              });
            }

            const tagQualite = nbRetests >= 4 ? ` [A+ ${nbRetests}T]` : ` [${nbRetests}T]`;
            const tagVol = activerFiltreVolume ? ' Vol' : '';
            const tagPattern = activerFiltreGrandesBougies ? ` ${testBougies.pattern.includes('Pinbar') ? '⚡Pinbar' : '🚀V-Shape'}` : '';

            labelsVisuels.push({
              id: 'lbl-utad-' + c,
              prix: bgSignal.high,
              date: bgSignal.time,
              texte: `▼ UTAD${tagQualite}${tagPattern}${tagVol ? ' /' + tagVol : ''}`,
              couleur: nbRetests >= 4 ? '#ff1744' : '#ef5350',
              position: 'above',
            });
          }
        }
    }
  }

  // 7️⃣ Finalisation et retour des données
  return {
    totalColonnesPF: colonnes.length,
    tailleBoxCalculee: tailleBox,
    modeVolumeActif: activerFiltreVolume,
    signaux: signaux,
    boites: boitesVisuelles,
    lignes: lignesVisuelles,
    labels: labelsVisuels,
  };
}
