import type { Bougie } from '@/lib/chartDataHelper';
import type { FicheSetupSonde, SyntheseStatistiqueSetups } from './types';
import { sonderLiquiditeCible } from './capteurs/capteurLiquidite';
import { sonderMouvementSweep } from './capteurs/capteurSweep';
import { sonderReintegration } from './capteurs/capteurReintegration';
import { sonderRangePostSweep } from './capteurs/capteurRangePostSweep';

export interface OptionsSondeSetup {
  direction?: 'ACHAT' | 'VENTE';
  paire?: string;
  timeframe?: string;
  titre?: string;
  noteQualite?: 'A+' | 'A' | 'B';
  notesTrader?: string;
  niveauLiquiditeManuel?: number;
}

/**
 * 🧭 ORCHESTRATEUR PRINCIPAL DU SONDEUR DE SETUP
 * 
 * Exécute successivement et de manière linéaire les 4 capteurs d'analyse
 * sur la bougie ciblée par le trader :
 * 1. Capteur Liquidité (Quelle cible a été balayée ?)
 * 2. Capteur Sweep (Quelle profondeur et rejet ?)
 * 3. Capteur Réintégration (Quelle vitesse et force du retour ?)
 * 4. Capteur Range Post-Sweep (Quelle consolidation et respect du SL protégé ?)
 * 
 * Exemple :
 * const fiche = sonderSetupComplet(bougies, indexSweep, { direction: 'ACHAT', paire: 'EURUSD', timeframe: 'M15' });
 * console.log(`Setup analysé : ${fiche.liquidite.description} - Sweep de ${fiche.sweep.profondeurPips} pips`);
 */
export function sonderSetupComplet(
  bougies: Bougie[],
  indexBougieSweep: number,
  options: OptionsSondeSetup = {}
): FicheSetupSonde {
  // 1️⃣ Vérifications de base
  const index = Math.max(0, Math.min(bougies.length - 1, indexBougieSweep));
  const bougieSweep = bougies[index];

  // Déduire automatiquement la direction si non précisée :
  // Si la mèche basse est prépondérante -> ACHAT (Spring)
  // Si la mèche haute est prépondérante -> VENTE (UTAD)
  let direction = options.direction;
  if (!direction) {
    const mecheBasse = Math.min(bougieSweep.open, bougieSweep.close) - bougieSweep.low;
    const mecheHaute = bougieSweep.high - Math.max(bougieSweep.open, bougieSweep.close);
    direction = mecheBasse >= mecheHaute ? 'ACHAT' : 'VENTE';
  }

  // 2️⃣ Exécution linéaire des 4 capteurs
  // Capteur 1 : Liquidité cible
  const liquidite = sonderLiquiditeCible(bougies, index, direction, {
    niveauForceManuel: options.niveauLiquiditeManuel,
  });

  // Capteur 2 : Mouvement de Sweep
  const sweep = sonderMouvementSweep(bougies, index, liquidite.prixNiveau, direction);

  // Capteur 3 : Réintégration
  const reintegration = sonderReintegration(
    bougies,
    index,
    liquidite.prixNiveau,
    direction,
    sweep.prixProtegeExtreme
  );

  // Capteur 4 : Range Post-Sweep
  const rangePostSweep = sonderRangePostSweep(
    bougies,
    index,
    reintegration.indexReintegration,
    sweep.prixProtegeExtreme,
    direction
  );

  // 3️⃣ Construction de la fiche d'identité du setup
  const id = `setup-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const titreDefaut = `${options.paire || 'Actif'} ${direction === 'ACHAT' ? 'Spring' : 'UTAD'} (#${index})`;

  return {
    id,
    titre: options.titre || titreDefaut,
    direction,
    paire: options.paire || 'EURUSD',
    timeframe: options.timeframe || 'M15',
    indexBougieSweep: index,
    dateBougieSweep: bougieSweep.time,
    noteQualite: options.noteQualite || 'A+',
    notesTrader: options.notesTrader,
    creeLe: new Date().toISOString(),
    liquidite,
    sweep,
    reintegration,
    rangePostSweep,
  };
}

/**
 * 📊 Consolide l'ensemble des fiches de setups enregistrées
 * et calcule les statistiques globales et seuils recommandés pour le bot.
 */
export function calculerSyntheseSetups(setups: FicheSetupSonde[]): SyntheseStatistiqueSetups {
  const total = setups.length;
  if (total === 0) {
    return {
      totalSetups: 0,
      totalAchats: 0,
      totalVentes: 0,
      profondeurSweepMoyennePips: 0,
      profondeurSweepMinPips: 0,
      profondeurSweepMaxPips: 0,
      ratioMecheMoyenPourcent: 0,
      delaiReintegrationMoyenBougies: 0,
      pourcentageDisplacement: 0,
      pourcentageFvg: 0,
      dureeMoyenneRangeBougies: 0,
      amplitudeMoyenneRangePips: 0,
      pourcentagePrixProtegePreserve: 100,
      reglesRecommandees: {
        sweepPipsMin: 2,
        sweepPipsMax: 8,
        delaiReintegrationMax: 2,
        dureeRangeCible: 4,
        ratioMecheMin: 60,
      },
    };
  }

  const achats = setups.filter((s) => s.direction === 'ACHAT').length;
  const ventes = setups.filter((s) => s.direction === 'VENTE').length;

  // Calcul des moyennes
  let sommeProfondeur = 0;
  let minProfondeur = Infinity;
  let maxProfondeur = -Infinity;
  let sommeRatioMeche = 0;
  let sommeDelaiReint = 0;
  let nbDisplacement = 0;
  let nbFvg = 0;
  let sommeDureeRange = 0;
  let sommeAmplitudeRange = 0;
  let nbProtegePreserve = 0;

  for (const s of setups) {
    const prof = s.sweep.profondeurPips;
    sommeProfondeur += prof;
    if (prof < minProfondeur) minProfondeur = prof;
    if (prof > maxProfondeur) maxProfondeur = prof;

    sommeRatioMeche += s.sweep.ratioMechePourcent;
    sommeDelaiReint += s.reintegration.delaiBougies;
    if (s.reintegration.aDisplacement) nbDisplacement++;
    if (s.reintegration.aFvg) nbFvg++;

    sommeDureeRange += s.rangePostSweep.dureeBougies;
    sommeAmplitudeRange += s.rangePostSweep.amplitudeRangePips;
    if (s.rangePostSweep.prixProtegePreserve) nbProtegePreserve++;
  }

  const moyProf = Number((sommeProfondeur / total).toFixed(1));
  const moyMeche = Math.round(sommeRatioMeche / total);
  const moyDelai = Number((sommeDelaiReint / total).toFixed(1));
  const moyDureeRange = Math.round(sommeDureeRange / total);
  const moyAmpRange = Number((sommeAmplitudeRange / total).toFixed(1));

  return {
    totalSetups: total,
    totalAchats: achats,
    totalVentes: ventes,
    profondeurSweepMoyennePips: moyProf,
    profondeurSweepMinPips: minProfondeur === Infinity ? 0 : minProfondeur,
    profondeurSweepMaxPips: maxProfondeur === -Infinity ? 0 : maxProfondeur,
    ratioMecheMoyenPourcent: moyMeche,
    delaiReintegrationMoyenBougies: moyDelai,
    pourcentageDisplacement: Math.round((nbDisplacement / total) * 100),
    pourcentageFvg: Math.round((nbFvg / total) * 100),
    dureeMoyenneRangeBougies: moyDureeRange,
    amplitudeMoyenneRangePips: moyAmpRange,
    pourcentagePrixProtegePreserve: Math.round((nbProtegePreserve / total) * 100),
    reglesRecommandees: {
      sweepPipsMin: Math.max(1, Number((minProfondeur * 0.8).toFixed(1))),
      sweepPipsMax: Math.max(4, Number((maxProfondeur * 1.2).toFixed(1))),
      delaiReintegrationMax: Math.max(1, Math.ceil(moyDelai + 1)),
      dureeRangeCible: Math.max(2, moyDureeRange),
      ratioMecheMin: Math.max(50, Math.round(moyMeche * 0.8)),
    },
  };
}
