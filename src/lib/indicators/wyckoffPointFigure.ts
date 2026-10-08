import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualBox, VisualLine, VisualLabel } from '@/types/indicatorScript';

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

  // 6️⃣ Détection des Trading Ranges, des Springs et des UTAD
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

      for (let r = c - colonnesMinRange - 1; r < c - 1; r++) {
        if (r >= 0) {
          if (colonnes[r].type === 'O') creuxPrecedents.push(colonnes[r].bas);
          if (colonnes[r].bas < minBas) minBas = colonnes[r].bas;
          if (colonnes[r].haut > maxHaut) maxHaut = colonnes[r].haut;
        }
      }

      if (creuxPrecedents.length >= 2) {
        const supportEstime = Math.min(...creuxPrecedents.slice(0, 2));

        // 🔍 Comptage précis des colonnes 'O' distinctes ayant rebondi sur ce support (à ±1 boîte)
        let nbRetests = 0;
        for (let r = c - colonnesMinRange - 1; r < c - 1; r++) {
          if (r >= 0 && colonnes[r].type === 'O') {
            if (Math.abs(colonnes[r].bas - supportEstime) <= tailleBox) {
              nbRetests++;
            }
          }
        }

        // 🛑 Filtrage de solidité : si le niveau n'a pas été retesté assez de fois, on l'ignore !
        if (nbRetests < minRetestsRequis) {
          continue;
        }

        const qualiteNiveau = qualifierSoliditeNiveau(nbRetests);

        const depassementBas = supportEstime - colPrecedente.bas;
        const aCasseSupport = depassementBas >= tailleBox && depassementBas <= (4 * tailleBox);
        const aReintegre = colActuelle.haut >= supportEstime + tailleBox;

        if (aCasseSupport && aReintegre) {
          const testVolume = verifierVolumeWyckoff(colPrecedente.indexFin, colActuelle.indexFin);

          if (testVolume.valide) {
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
            labelsVisuels.push({
              id: 'lbl-spring-' + c,
              prix: bgSignal.low,
              date: bgSignal.time,
              texte: `▲ SPRING${tagQualite}${tagVol ? ' /' + tagVol : ''}`,
              couleur: nbRetests >= 4 ? '#00e676' : '#089981',
              position: 'below',
            });
          }
        }
      }
    }

    // ─── B. DÉTECTION DU UTAD WYCKOFF (VENTE) ───────────────────────────
    if (activerUTAD && colPrecedente.type === 'X' && colActuelle.type === 'O') {
      let minBas = 9999999;
      let maxHaut = -9999999;
      const sommetsPrecedents: number[] = [];

      for (let r = c - colonnesMinRange - 1; r < c - 1; r++) {
        if (r >= 0) {
          if (colonnes[r].type === 'X') sommetsPrecedents.push(colonnes[r].haut);
          if (colonnes[r].bas < minBas) minBas = colonnes[r].bas;
          if (colonnes[r].haut > maxHaut) maxHaut = colonnes[r].haut;
        }
      }

      if (sommetsPrecedents.length >= 2) {
        const resistanceEstimee = Math.max(...sommetsPrecedents.slice(0, 2));

        // 🔍 Comptage précis des colonnes 'X' distinctes ayant rebondi sur cette résistance (à ±1 boîte)
        let nbRetests = 0;
        for (let r = c - colonnesMinRange - 1; r < c - 1; r++) {
          if (r >= 0 && colonnes[r].type === 'X') {
            if (Math.abs(colonnes[r].haut - resistanceEstimee) <= tailleBox) {
              nbRetests++;
            }
          }
        }

        // 🛑 Filtrage de solidité : si le niveau n'a pas été retesté assez de fois, on l'ignore !
        if (nbRetests < minRetestsRequis) {
          continue;
        }

        const qualiteNiveau = qualifierSoliditeNiveau(nbRetests);

        const depassementHaut = colPrecedente.haut - resistanceEstimee;
        const aCasseResistance = depassementHaut >= tailleBox && depassementHaut <= (4 * tailleBox);
        const aReintegre = colActuelle.bas <= resistanceEstimee - tailleBox;

        if (aCasseResistance && aReintegre) {
          const testVolume = verifierVolumeWyckoff(colPrecedente.indexFin, colActuelle.indexFin);

          if (testVolume.valide) {
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
            labelsVisuels.push({
              id: 'lbl-utad-' + c,
              prix: bgSignal.high,
              date: bgSignal.time,
              texte: `▼ UTAD${tagQualite}${tagVol ? ' /' + tagVol : ''}`,
              couleur: nbRetests >= 4 ? '#ff1744' : '#ef5350',
              position: 'above',
            });
          }
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
