import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLabel, VisualLine } from '@/types/indicatorScript';
import {
  calculerShvedSupplyDemand,
  type ZoneShved,
} from '@/lib/bot/modules/01_liquidite/shvedSupplyDemand';
import { calculerLiquidationReintegration } from './liquidationReintegration';

// ─── 📊 Types et Structures de Données ────────────────────────────────────────

/**
 * Options de l'indicateur combiné :
 * Doji personnalisé (Liq/Reint = Spring / UTAD) + niveau Shved le PLUS FORT balayé.
 *
 * Quand le pattern se forme, on cherche tous les supports / résistances Shved que sa mèche
 * a balayés, puis on retient celui qui a été le plus souvent retesté AVANT le pattern
 * (= celui qui contenait le plus de liquidité / de stops).
 */
export interface ParametresSweepNiveauShvedLePlusFort {
  // ─── ⏱️ Multi-Timeframe (MTF) ───
  timeframeSource?: string;        // Unité de temps des niveaux Shved (défaut: 'M15')
  donneesM1?: Bougie[];            // Données M1 pour l'agrégation MTF
  chartTimeframe?: string;         // Unité de temps du graphique (ex: 'H4')

  // ─── 📐 Paramètres Shved ───
  periodeATR?: number;             // défaut: 15
  zoneFuzzFactor?: number;         // défaut: 0.1
  maxLookbackBars?: number;        // Historique scanné en bougies (défaut: 200)
  // Nombre maximum de bougies entre la création du niveau et le pattern (défaut: 100, 0 = sans limite)
  lookbackMaxBarsAvantPattern?: number;
  afficherFaibles?: boolean;       // Inclure les fractals faibles (défaut: false)

  // ─── 🎯 Règles de liquidité ───
  // Nombre minimum de retests du niveau AVANT le pattern (défaut: 1 → jamais de niveau vierge)
  minRetests?: number;
  // N'afficher le pattern que s'il a balayé au moins un niveau Shved (défaut: true)
  exigerNiveauBalaye?: boolean;

  // ─── 🕯️ Paramètres du pattern (Doji personnalisé Liq/Reint) ───
  toleranceDeficit?: number;
  toleranceDepassement?: number;
  activerFiltreTaille?: boolean;
  periodeHistorique?: number;
  multiplicateurBougie1?: number;
  multiplicateurCorps2?: number;
  activerAchat?: boolean;
  activerVente?: boolean;
  activerFiltreTendance?: boolean;
  trendBars?: number;

  // ─── 🎨 Vision d'Ensemble & Affichage ───
  // Afficher tous les niveaux S/R Shved calculés en arrière-plan sur le graphique (défaut: true)
  afficherNiveauxShved?: boolean;
  // Afficher aussi les niveaux Shved déjà cassés en traits pointillés discrets (défaut: true)
  afficherNiveauxCasses?: boolean;
  // Afficher tous les Dojis personnalisés, même ceux sans niveau Shved balayé (défaut: true)
  afficherTousDojis?: boolean;
  // Afficher le nombre de retests du niveau le plus fort sous/au-dessus du pattern (défaut: true)
  afficherForceDansLabel?: boolean;
  // Tracer aussi (en pointillés fins) les autres niveaux balayés, moins forts (défaut: false)
  afficherAutresNiveaux?: boolean;
  bullColor?: string;
  bearColor?: string;
  texteLabel?: string;
}

/**
 * Un niveau Shved balayé par la mèche du pattern
 */
export interface NiveauShvedBalaye {
  zone: ZoneShved;
  prix: number;                   // Prix du niveau (ligne médiane Shved)
  retestsAvantPattern: number;    // Retests comptés strictement AVANT la bougie 1 du pattern
  profondeur: number;             // Distance entre le niveau et l'extrême de la mèche
}

/**
 * Un signal du pattern accompagné de la liquidité qu'il a récupérée
 */
export interface SignalSweepNiveauShvedLePlusFort {
  type: 'ACHAT' | 'VENTE';        // ACHAT = Spring, VENTE = UTAD
  indexBougie: number;            // Index de la bougie 2 (réintégration)
  temps: number | string;
  prixExtreme: number;            // Plus bas (achat) ou plus haut (vente) des 2 bougies
  open1: number;
  close2: number;
  niveauLePlusFort: NiveauShvedBalaye | null;
  niveauxBalayes: NiveauShvedBalaye[];   // Tous les niveaux balayés, du plus fort au moins fort
  nombreNiveauxBalayes: number;
  liquiditeTotale: number;        // Somme des retests de tous les niveaux balayés
}

export interface ResultatSweepNiveauShvedLePlusFort {
  signaux: SignalSweepNiveauShvedLePlusFort[];
  primitives: VisualPrimitives;
  statistiques: {
    totalSignaux: number;
    totalAchats: number;
    totalVentes: number;
    totalAvecNiveau: number;
    maxRetestsBalayes: number;
  };
}

// ─── 🛠️ Petites fonctions utilitaires ─────────────────────────────────────────

/**
 * Convertit un horodatage (nombre ou texte ISO) en nombre comparable.
 * Exemple : convertirEnSecondes('2026-10-14T00:00:00Z') → 1791936000
 */
function convertirEnSecondes(temps: number | string): number {
  if (typeof temps === 'number') return temps;
  return Math.floor(Date.parse(temps) / 1000);
}

/**
 * Compte les retests d'une zone survenus strictement AVANT un instant donné.
 * Pourquoi : le moteur Shved compte les retests sur tout l'historique ; pour savoir
 * combien de liquidité le niveau contenait AU MOMENT du pattern, on ignore les retests futurs.
 * Exemple : compterRetestsAvant(zone, tempsBougie1) → 3
 */
function compterRetestsAvant(zone: ZoneShved, tempsLimite: number): number {
  const dates = zone.datesTouches || [];
  let total = 0;
  for (const date of dates) {
    if (convertirEnSecondes(date) < tempsLimite) total++;
  }
  return total;
}

/**
 * Vérifie que le niveau existait et n'avait PAS encore été consommé (cassé par une clôture)
 * avant le début du pattern.
 * Exemple : estNiveauEncoreDisponible(zone, tempsBougie1) → true
 */
function estNiveauEncoreDisponible(zone: ZoneShved, tempsBougie1: number): boolean {
  // Le niveau doit être né avant le pattern
  if (convertirEnSecondes(zone.dateDebut) >= tempsBougie1) return false;

  // Jamais cassé → toujours disponible
  if (!zone.estCassee) return true;

  // Cassé : la cassure doit avoir lieu pendant ou après le pattern (pas avant)
  return convertirEnSecondes(zone.dateFin) >= tempsBougie1;
}

// ─── 🚀 Fonction Principale ───────────────────────────────────────────────────

/**
 * Détecte le Doji personnalisé (Liq/Reint) et identifie le niveau Shved le PLUS FORT
 * (le plus retesté) que sa mèche a balayé, ainsi que la liquidité totale récupérée.
 *
 * Exemple :
 * const res = calculerSweepNiveauShvedLePlusFort(bougiesH4, {
 *   timeframeSource: 'M15',
 *   donneesM1: bougiesM1,
 * });
 * const signal = res.signaux[0];
 * console.log(signal.niveauLePlusFort?.retestsAvantPattern); // ex: 5
 * console.log(signal.liquiditeTotale);                      // ex: 8 (5 + 2 + 1)
 */
export function calculerSweepNiveauShvedLePlusFort(
  bougies: Bougie[],
  options: ParametresSweepNiveauShvedLePlusFort = {}
): ResultatSweepNiveauShvedLePlusFort {
  const labels: VisualLabel[] = [];
  const lignes: VisualLine[] = [];

  const resultatVide: ResultatSweepNiveauShvedLePlusFort = {
    signaux: [],
    primitives: { labels, lignes, boites: [], points: [] },
    statistiques: { totalSignaux: 0, totalAchats: 0, totalVentes: 0, totalAvecNiveau: 0, maxRetestsBalayes: 0 },
  };

  // 1️⃣ Vérifications
  if (!bougies || bougies.length < 10) return resultatVide;

  // 2️⃣ Paramètres
  const minRetests = Math.max(1, Number(options.minRetests ?? 1));
  const exigerNiveauBalaye = options.exigerNiveauBalaye !== false;
  const afficherFaibles = Boolean(options.afficherFaibles);
  const afficherNiveauxShved = options.afficherNiveauxShved !== false;
  const afficherNiveauxCasses = options.afficherNiveauxCasses !== false;
  const afficherTousDojis = options.afficherTousDojis !== false;
  const afficherForceDansLabel = options.afficherForceDansLabel !== false;
  const afficherAutresNiveaux = Boolean(options.afficherAutresNiveaux);
  const bullColor = options.bullColor || '#00E676';
  const bearColor = options.bearColor || '#F23645';
  const texteLabel = options.texteLabel || 'Liq/Reint';

  // 3️⃣ Tous les niveaux Shved (actifs ET cassés), sans fusion pour garder l'historique propre à chaque niveau
  const resultatShved = calculerShvedSupplyDemand(bougies, {
    timeframeSource: options.timeframeSource || 'M15',
    donneesM1: options.donneesM1,
    chartTimeframe: options.chartTimeframe,
    supprimerZonesCassees: false,
    afficherNonRetestees: true,
    afficherFaibles: true,
    minRetests: 0,
    periodeATR: options.periodeATR ?? 15,
    zoneFuzzFactor: options.zoneFuzzFactor ?? 0.1,
    maxLookbackBars: options.maxLookbackBars ?? 200,
    afficherZones: false,
    afficherLignes: false,
    afficherEtiquettes: false,
  });

  const supports = resultatShved.supports.filter((z) => afficherFaibles || !z.estFaible);
  const resistances = resultatShved.resistances.filter((z) => afficherFaibles || !z.estFaible);

  // Estimation du pas moyen par bougie pour mesurer l'âge des niveaux
  const pasTempsSec = bougies.length >= 2
    ? Math.max(60, (convertirEnSecondes(bougies[bougies.length - 1].time) - convertirEnSecondes(bougies[0].time)) / (bougies.length - 1))
    : 3600;
  const maxBarsAge = Number(options.lookbackMaxBarsAvantPattern ?? 100);

  // 4️⃣ Détection du Doji personnalisé (Liq/Reint) avec ses propres réglages
  const resultatPattern = calculerLiquidationReintegration(bougies, {
    toleranceDeficit: options.toleranceDeficit,
    toleranceDepassement: options.toleranceDepassement,
    activerFiltreTaille: options.activerFiltreTaille,
    periodeHistorique: options.periodeHistorique,
    multiplicateurBougie1: options.multiplicateurBougie1,
    multiplicateurCorps2: options.multiplicateurCorps2,
    activerAchat: options.activerAchat,
    activerVente: options.activerVente,
    activerFiltreTendance: options.activerFiltreTendance,
    trendBars: options.trendBars,
  });

  const signaux: SignalSweepNiveauShvedLePlusFort[] = [];
  let totalAchats = 0;
  let totalVentes = 0;
  let totalAvecNiveau = 0;
  let maxRetestsBalayes = 0;

  // 5️⃣ Pour chaque pattern : quels niveaux ont été balayés, et lequel est le plus fort ?
  for (const pattern of resultatPattern.signaux) {
    const i = pattern.indexBougie;
    const bougie1 = bougies[i - 1];
    const bougie2 = bougies[i];
    if (!bougie1 || !bougie2) continue;

    const estAchat = pattern.type === 'ACHAT';
    const tempsBougie1 = convertirEnSecondes(bougie1.time);

    // Extrême de la mèche du pattern (le point qui est allé chercher la liquidité)
    const prixExtreme = estAchat
      ? Math.min(bougie1.low, bougie2.low)
      : Math.max(bougie1.high, bougie2.high);

    // Achat (Spring) → on regarde les SUPPORTS ; Vente (UTAD) → les RÉSISTANCES
    const zonesCandidates = estAchat ? supports : resistances;
    const niveauxBalayes: NiveauShvedBalaye[] = [];

    for (const zone of zonesCandidates) {
      const prixNiveau = zone.prixMedian;

      // A. La mèche a dépassé le niveau ET la clôture de réintégration est revenue de l'autre côté
      const estBalaye = estAchat
        ? prixExtreme < prixNiveau && bougie2.close > prixNiveau
        : prixExtreme > prixNiveau && bougie2.close < prixNiveau;
      if (!estBalaye) continue;

      // B. Le niveau doit encore contenir de la liquidité (pas cassé avant le pattern)
      if (!estNiveauEncoreDisponible(zone, tempsBougie1)) continue;

      // B bis. Le niveau doit être récent : pas créé il y a une éternité avant le pattern
      if (maxBarsAge > 0) {
        const ageSec = tempsBougie1 - convertirEnSecondes(zone.dateDebut);
        const ageBougies = ageSec / pasTempsSec;
        if (ageBougies > maxBarsAge) continue;
      }

      // C. Retests comptés uniquement AVANT le pattern (aucun regard vers le futur)
      const retestsAvantPattern = compterRetestsAvant(zone, tempsBougie1);
      if (retestsAvantPattern < minRetests) continue;

      niveauxBalayes.push({
        zone,
        prix: prixNiveau,
        retestsAvantPattern,
        profondeur: Math.abs(prixNiveau - prixExtreme),
      });
    }

    // D. Tri : le plus retesté d'abord ; à égalité, le niveau le plus récent
    niveauxBalayes.sort((a, b) => {
      if (b.retestsAvantPattern !== a.retestsAvantPattern) {
        return b.retestsAvantPattern - a.retestsAvantPattern;
      }
      return convertirEnSecondes(b.zone.dateDebut) - convertirEnSecondes(a.zone.dateDebut);
    });

    const niveauLePlusFort = niveauxBalayes.length > 0 ? niveauxBalayes[0] : null;

    // Si on exige un niveau balayé et qu'il n'y en a pas, on peut quand même afficher le Doji si demandé
    if (!niveauLePlusFort) {
      if (afficherTousDojis) {
        // Étiquette discrète pour repérer le Doji seul sans niveau Shved balayé
        const couleurNeutre = estAchat ? `${bullColor}77` : `${bearColor}77`;
        labels.push({
          id: `doji-seul-lbl-${i}`,
          prix: prixExtreme,
          date: bougie2.time,
          texte: estAchat ? 'Spring' : 'UTAD',
          couleur: couleurNeutre,
          position: estAchat ? 'below' : 'above',
        });
      }

      if (exigerNiveauBalaye) continue;
    }

    // E. Quantité de liquidité récupérée = somme des retests de tous les niveaux balayés
    let liquiditeTotale = 0;
    for (const niveau of niveauxBalayes) {
      liquiditeTotale += niveau.retestsAvantPattern;
    }

    signaux.push({
      type: pattern.type,
      indexBougie: i,
      temps: bougie2.time,
      prixExtreme,
      open1: pattern.open1,
      close2: pattern.close2,
      niveauLePlusFort,
      niveauxBalayes,
      nombreNiveauxBalayes: niveauxBalayes.length,
      liquiditeTotale,
    });

    if (estAchat) totalAchats++;
    else totalVentes++;
    if (niveauLePlusFort) {
      totalAvecNiveau++;
      maxRetestsBalayes = Math.max(maxRetestsBalayes, niveauLePlusFort.retestsAvantPattern);
    }

    // 6️⃣ Visuels du Combo (Doji + Niveau Shved)
    const couleur = estAchat ? bullColor : bearColor;

    // Étiquette du combo avec la force du niveau (ex: "Liq/Reint\n5x")
    let texte = texteLabel;
    if (afficherForceDansLabel && niveauLePlusFort) {
      texte = `${texteLabel}\n${niveauLePlusFort.retestsAvantPattern}x`;
      if (niveauxBalayes.length > 1) {
        texte += ` (${niveauxBalayes.length} niv.)`;
      }
    }

    labels.push({
      id: `sweep-fort-lbl-${i}`,
      prix: prixExtreme,
      date: bougie2.time,
      texte,
      couleur,
      position: estAchat ? 'below' : 'above',
    });

    // Segment discontinu du niveau le plus fort : de sa naissance jusqu'au pattern
    if (niveauLePlusFort) {
      lignes.push({
        id: `sweep-fort-line-${i}`,
        prix: niveauLePlusFort.prix,
        dateDebut: niveauLePlusFort.zone.dateDebut,
        dateFin: bougie2.time,
        couleur,
        epaisseur: 2.2,
        style: 'dashed',
      });
    }

    // Autres niveaux balayés (moins forts) en pointillés fins, si demandé
    if (afficherAutresNiveaux) {
      for (let n = 1; n < niveauxBalayes.length; n++) {
        const autre = niveauxBalayes[n];
        lignes.push({
          id: `sweep-autre-line-${i}-${n}`,
          prix: autre.prix,
          dateDebut: autre.zone.dateDebut,
          dateFin: bougie2.time,
          couleur,
          epaisseur: 1,
          style: 'dotted',
        });
      }
    }
  }

  // 7️⃣ Vision d'Ensemble : Tracé des Supports & Résistances Shved en arrière-plan
  if (afficherNiveauxShved) {
    const derniereBougie = bougies[bougies.length - 1];
    const dateDerniereBougie = derniereBougie ? derniereBougie.time : 0;
    const toutesLesZones: ZoneShved[] = [...supports, ...resistances];

    for (const zone of toutesLesZones) {
      if (zone.retests < minRetests) continue;
      if (zone.estFaible && !afficherFaibles) continue;
      if (zone.estCassee && !afficherNiveauxCasses) continue;

      const estSupport = zone.type === 'SUPPORT';
      const couleurBase = estSupport ? bullColor : bearColor;
      // Niveaux actifs en continu doux, niveaux cassés en pointillés discrets
      const couleurFond = zone.estCassee ? `${couleurBase}44` : `${couleurBase}88`;
      const dateFin = zone.estCassee ? zone.dateFin : dateDerniereBougie;

      lignes.push({
        id: `bg-shved-${zone.id}`,
        prix: zone.prixMedian,
        dateDebut: zone.dateDebut,
        dateFin,
        couleur: couleurFond,
        epaisseur: zone.estCassee ? 1.0 : 1.3,
        style: zone.estCassee ? 'dashed' : 'solid',
      });
    }
  }

  return {
    signaux,
    primitives: { labels, lignes, boites: [], points: [] },
    statistiques: {
      totalSignaux: signaux.length,
      totalAchats,
      totalVentes,
      totalAvecNiveau,
      maxRetestsBalayes,
    },
  };
}
