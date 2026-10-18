import type { Bougie } from '@/lib/chartDataHelper';
import type { VisualPrimitives, VisualLabel, VisualLine } from '@/types/indicatorScript';
import {
  calculerShvedSupplyDemand,
  type ZoneShved,
} from '@/lib/bot/modules/01_liquidite/shvedSupplyDemand';

/**
 * ==============================================================================
 * 🧪 SANDBOX DÉVELOPPEUR : DOJI LIQ/REINT + SUPPORTS/RÉSISTANCES SHVED (PLAGE CIBLÉE)
 * ==============================================================================
 * Cet indicateur sert de bac à sable simplifié, pas à pas et facile à déboguer.
 * 
 * 🎯 CE QUE FAIT CET INDICATEUR :
 *  1️⃣ Détecte notre Doji personnalisé (Liquidation B1 + Réintégration B2) de manière directe.
 *  2️⃣ Dès qu'un Doji est trouvé (ex: Achat / Spring) :
 *      - Il identifie le point le plus bas du Doji (min(Low1, Low2)).
 *      - Il recule dans le temps pour trouver la bougie précédente qui avait créé un plus bas encore plus extrême.
 *      - Cela définit une "Plage Temporelle Ciblée" entre cette bougie antérieure et notre Doji.
 *  3️⃣ Épuration totale :
 *      - Pour un setup ACHAT (Spring) : N'affiche UNIQUEMENT que les SUPPORTS !
 *      - Pour un setup VENTE (UTAD)   : N'affiche UNIQUEMENT que les RÉSISTANCES !
 *      - Ne garde que les niveaux dont le début ET la fin sont compris dans la plage [Extrême Précédent -> Doji].
 *      - Permet d'épurer complètement le graphique et d'ignorer tout le bruit environnant.
 *  4️⃣ Permet de choisir librement le style des segments : CONTINUS ('solid') ou DISCONTINUS ('dashed').
 *
 * 💡 COMMENT MODIFIER LE CODE DU DOJI ?
 *  La logique du Doji est écrite directement ci-dessous dans la fonction `verifierDojiSimple()`.
 * ==============================================================================
 */

// ─── 📊 Types et Options de Configuration ─────────────────────────────────────

export interface ParametresSandboxDojiShvedPlage {
  // ─── 🕯️ Réglages du Doji Personnalisé (Liq / Reint) ───
  toleranceDeficit?: number;         // Tolérance de déficit (défaut: 0.30 = 30% du range moyen)
  toleranceDepassement?: number;     // Tolérance de dépassement favorable (défaut: 2.0 = 200%)
  activerFiltreTaille?: boolean;     // Exige des bougies supérieures à la moyenne (défaut: true)
  periodeHistorique?: number;        // Nombre de bougies pour la moyenne de taille (défaut: 10)
  multiplicateurBougie1?: number;    // Multiplicateur bougie 1 de liquidation (défaut: 1.0x)
  multiplicateurCorps2?: number;     // Multiplicateur corps de bougie 2 (défaut: 1.2x)
  activerAchat?: boolean;            // Autorise les signaux d'achat (Spring) (défaut: true)
  activerVente?: boolean;            // Autorise les signaux de vente (UTAD) (défaut: true)

  // ─── ⏱️ Multi-Timeframe (MTF) & Paramètres Shved ───
  timeframeSource?: string;          // Unité de temps Shved (ex: 'M15', 'ACTUEL', défaut: 'M15')
  donneesM1?: Bougie[];              // Bougies M1 pour le calcul MTF
  chartTimeframe?: string;           // Unité de temps du graphique actuel
  periodeATR?: number;               // ATR pour l'épaisseur des zones Shved (défaut: 15)
  zoneFuzzFactor?: number;           // Facteur d'épaisseur Shved (défaut: 0.1)
  minRetests?: number;               // Nombre minimum de retests Shved (défaut: 0 = accepte tout)
  afficherNiveauxCasses?: boolean;   // Inclut aussi les niveaux déjà cassés (défaut: true)

  // ─── 🎯 Plage Temporelle Ciblée & Épuration Totale ───
  // Nombre maximum de bougies à scruter dans le passé pour trouver le creux/sommet précédent (défaut: 100)
  maxReculRecherche?: number;
  // Épuration totale : exige que le début ET la fin du S/R soient STRICTEMENT compris dans la plage (défaut: true)
  exigerDebutEtFinDansPlage?: boolean;
  // Filtrage strict par direction : Supports uniquement pour Achat, Résistances uniquement pour Vente (défaut: true)
  filtrerParDirectionSetup?: boolean;

  // ─── 🎨 Visuels & Segments Continues / Discontinues ───
  // Style des lignes de Support ('dashed' = discontinu, 'solid' = continu)
  styleLignesSupport?: 'dashed' | 'solid';
  // Style des lignes de Résistance ('dashed' = discontinu, 'solid' = continu)
  styleLignesResistance?: 'dashed' | 'solid';
  // Épaisseur des traits de support/résistance (défaut: 2)
  epaisseurLignes?: number;
  // Borner les segments Shved strictement à l'intérieur de la plage temporelle (défaut: true)
  bornerALaPlage?: boolean;

  bullColor?: string;                // Couleur Achat / Support (défaut: '#00E676')
  bearColor?: string;                // Couleur Vente / Résistance (défaut: '#F23645')
  texteLabel?: string;               // Texte du signal (défaut: 'Liq/Reint')
}

/**
 * Signal détecté par la sandbox avec sa plage temporelle ciblée
 */
export interface SignalSandboxPlage {
  type: 'ACHAT' | 'VENTE';
  indexBougie: number;
  temps: number | string;
  prixExtreme: number;
  open1: number;
  close2: number;
  indexDebutPlage: number;
  tempsDebutPlage: number | string;
  prixExtremePrecedent: number;
  nombreNiveauxDansPlage: number;
}

export interface ResultatSandboxDojiShvedPlage {
  signaux: SignalSandboxPlage[];
  primitives: VisualPrimitives;
  statistiques: {
    totalSignaux: number;
    totalAchats: number;
    totalVentes: number;
  };
}

// ─── 🛠️ Fonctions Utilitaires ─────────────────────────────────────────────────

/**
 * Convertit un timestamp (nombre ou string ISO) en millisecondes pour comparaison
 * Exemple : convertirTemps(1727200000) -> 1727200000000
 */
function convertirTempsEnMs(temps: number | string): number {
  if (typeof temps === 'number') {
    // Si déjà en millisecondes (> 10^11) ou en secondes (< 10^11)
    return temps > 10000000000 ? temps : temps * 1000;
  }
  return new Date(temps).getTime();
}

/**
 * 1️⃣ VÉRIFICATION DIRECTE DU DOJI PERSONNALISÉ (LIQ / REINT)
 * Cette fonction vérifie de façon linéaire si deux bougies consécutives forment un retournement valide.
 * 
 * Exemple :
 * const res = verifierDojiSimple(b1, b2, 2.5, 1.2, options);
 * if (res.estValide) { ... }
 */
function verifierDojiSimple(
  b1: Bougie,
  b2: Bougie,
  moyenneHauteur: number,
  moyenneCorps: number,
  options: {
    activerAchat: boolean;
    activerVente: boolean;
    activerFiltreTaille: boolean;
    multiplicateurBougie1: number;
    multiplicateurCorps2: number;
    toleranceDeficit: number;
    toleranceDepassement: number;
  }
): { estValide: boolean; type: 'ACHAT' | 'VENTE'; prixExtreme: number } {
  const range1 = b1.high - b1.low;
  const corps1 = Math.abs(b1.open - b1.close);
  const range2 = b2.high - b2.low;
  const corps2 = Math.abs(b2.open - b2.close);
  const hauteurMoyenneDoji = (range1 + range2) / 2;

  // Par défaut : échec
  const echec = { estValide: false, type: 'ACHAT' as const, prixExtreme: 0 };
  if (hauteurMoyenneDoji <= 0) return echec;

  // 1. Sens opposés des bougies
  // Achat (Spring) : B1 baissière (rouge) + B2 haussière (verte)
  const estCandidatAchat = options.activerAchat && (b1.close < b1.open) && (b2.close > b2.open);
  // Vente (UTAD)   : B1 haussière (verte) + B2 baissière (rouge)
  const estCandidatVente = options.activerVente && (b1.close > b1.open) && (b2.close < b2.open);

  if (!estCandidatAchat && !estCandidatVente) return echec;
  const typeSignal: 'ACHAT' | 'VENTE' = estCandidatAchat ? 'ACHAT' : 'VENTE';

  // 2. Précision du retournement (Close2 revient au niveau d'Open1)
  const ecartPrix = Math.abs(b1.open - b2.close);
  const ratioEcart = ecartPrix / hauteurMoyenneDoji;

  if (typeSignal === 'ACHAT') {
    if (b2.close >= b1.open) {
      // Dépassement favorable au-dessus d'Open1
      if (ratioEcart > options.toleranceDepassement) return echec;
    } else {
      // Retrait (déficit) sous Open1
      if (ratioEcart > options.toleranceDeficit) return echec;
    }
  } else {
    if (b2.close <= b1.open) {
      // Dépassement favorable en dessous d'Open1
      if (ratioEcart > options.toleranceDepassement) return echec;
    } else {
      // Retrait (déficit) au-dessus d'Open1
      if (ratioEcart > options.toleranceDeficit) return echec;
    }
  }

  // 3. Filtre de taille relative (Impulsion de Liquidation & Réintégration)
  if (options.activerFiltreTaille) {
    if (range1 < options.multiplicateurBougie1 * moyenneHauteur) return echec;
    if (corps2 < options.multiplicateurCorps2 * moyenneCorps) return echec;
  }

  const prixExtreme = typeSignal === 'ACHAT'
    ? Math.min(b1.low, b2.low)
    : Math.max(b1.high, b2.high);

  return { estValide: true, type: typeSignal, prixExtreme };
}

/**
 * 2️⃣ TROUVER LA BOUGIE PRÉCÉDENTE CRÉANT UN PLUS BAS (ACHAT) OU PLUS HAUT (VENTE)
 * Recule dans le temps depuis le Doji pour localiser la bougie de référence.
 * 
 * Exemple :
 * const indexCreux = trouverBougieExtremePrecedente(bougies, indexDoji, 'ACHAT', prixPlusBas);
 */
function trouverBougieExtremePrecedente(
  bougies: Bougie[],
  indexDoji: number,
  typeSignal: 'ACHAT' | 'VENTE',
  prixExtremeDoji: number,
  maxRecul: number
): { index: number; temps: number | string; prix: number } {
  // On commence la recherche juste avant la bougie 1 du Doji
  const debutScan = Math.max(0, indexDoji - 2);
  const finScan = Math.max(0, indexDoji - 2 - maxRecul);

  if (typeSignal === 'ACHAT') {
    // En Achat : on cherche la bougie précédente dont le Low est <= au Low du Doji
    for (let k = debutScan; k >= finScan; k--) {
      if (bougies[k].low <= prixExtremeDoji) {
        return { index: k, temps: bougies[k].time, prix: bougies[k].low };
      }
    }
    // Si aucune bougie n'est plus basse, on prend la bougie ayant le plus bas de toute la fenêtre
    let plusBasIndex = debutScan;
    let plusBasPrix = bougies[debutScan]?.low ?? prixExtremeDoji;
    for (let k = debutScan; k >= finScan; k--) {
      if (bougies[k].low < plusBasPrix) {
        plusBasPrix = bougies[k].low;
        plusBasIndex = k;
      }
    }
    return { index: plusBasIndex, temps: bougies[plusBasIndex].time, prix: plusBasPrix };
  } else {
    // En Vente : on cherche la bougie précédente dont le High est >= au High du Doji
    for (let k = debutScan; k >= finScan; k--) {
      if (bougies[k].high >= prixExtremeDoji) {
        return { index: k, temps: bougies[k].time, prix: bougies[k].high };
      }
    }
    // Si aucune bougie n'est plus haute, on prend le plus haut de la fenêtre
    let plusHautIndex = debutScan;
    let plusHautPrix = bougies[debutScan]?.high ?? prixExtremeDoji;
    for (let k = debutScan; k >= finScan; k--) {
      if (bougies[k].high > plusHautPrix) {
        plusHautPrix = bougies[k].high;
        plusHautIndex = k;
      }
    }
    return { index: plusHautIndex, temps: bougies[plusHautIndex].time, prix: plusHautPrix };
  }
}

// ─── 🚀 Fonction Principale de l'Indicateur Sandbox ───────────────────────────

/**
 * Exécute la Sandbox Doji Liq/Reint + S/R Shved (Plage Ciblée).
 * 
 * Exemple d'utilisation :
 * ```typescript
 * const resultat = calculerSandboxDojiShvedPlage(bougies, {
 *   styleLignesSupport: 'dashed',
 *   styleLignesResistance: 'solid',
 *   maxReculRecherche: 80,
 * });
 * console.log('Nombre de signaux :', resultat.signaux.length);
 * ```
 */
export function calculerSandboxDojiShvedPlage(
  bougies: Bougie[],
  parametres: ParametresSandboxDojiShvedPlage = {}
): ResultatSandboxDojiShvedPlage {
  const labels: VisualLabel[] = [];
  const lignes: VisualLine[] = [];

  const resultatVide: ResultatSandboxDojiShvedPlage = {
    signaux: [],
    primitives: { labels, lignes, boites: [], points: [] },
    statistiques: { totalSignaux: 0, totalAchats: 0, totalVentes: 0 },
  };

  if (!bougies || bougies.length < 10) return resultatVide;

  // 1️⃣ Extraction des paramètres
  const toleranceDeficit = Number(parametres.toleranceDeficit ?? 0.30);
  const toleranceDepassement = Number(parametres.toleranceDepassement ?? 2.0);
  const activerFiltreTaille = parametres.activerFiltreTaille !== false;
  const periodeHistorique = Math.max(3, Number(parametres.periodeHistorique ?? 10));
  const multiplicateurBougie1 = Number(parametres.multiplicateurBougie1 ?? 1.0);
  const multiplicateurCorps2 = Number(parametres.multiplicateurCorps2 ?? 1.2);
  const activerAchat = parametres.activerAchat !== false;
  const activerVente = parametres.activerVente !== false;

  const maxReculRecherche = Math.max(10, Number(parametres.maxReculRecherche ?? 100));
  const exigerDebutEtFinDansPlage = parametres.exigerDebutEtFinDansPlage !== false;
  const filtrerParDirectionSetup = parametres.filtrerParDirectionSetup !== false;
  const styleLignesSupport = parametres.styleLignesSupport || 'dashed';
  const styleLignesResistance = parametres.styleLignesResistance || 'dashed';
  const epaisseurLignes = Number(parametres.epaisseurLignes ?? 2);
  const bornerALaPlage = parametres.bornerALaPlage !== false;

  const bullColor = parametres.bullColor || '#00E676';
  const bearColor = parametres.bearColor || '#F23645';
  const texteLabel = parametres.texteLabel || 'Liq/Reint';

  // 2️⃣ Calcul des Niveaux Shved Supply & Demand
  const resultatShved = calculerShvedSupplyDemand(bougies, {
    timeframeSource: parametres.timeframeSource || 'M15',
    donneesM1: parametres.donneesM1,
    chartTimeframe: parametres.chartTimeframe,
    supprimerZonesCassees: false,
    afficherNonRetestees: true,
    afficherFaibles: true,
    minRetests: Math.max(0, Number(parametres.minRetests ?? 0)),
    periodeATR: parametres.periodeATR ?? 15,
    zoneFuzzFactor: parametres.zoneFuzzFactor ?? 0.1,
    maxLookbackBars: 250,
    afficherZones: false,
    afficherLignes: false,
    afficherEtiquettes: false,
  });

  const toutesLesZonesShved: ZoneShved[] = [
    ...resultatShved.supports,
    ...resultatShved.resistances,
  ];

  const signaux: SignalSandboxPlage[] = [];
  let totalAchats = 0;
  let totalVentes = 0;

  // 3️⃣ Parcours des bougies pour détecter les Dojis personnalisés
  for (let i = 2; i < bougies.length; i++) {
    const b1 = bougies[i - 1];
    const b2 = bougies[i];

    // Calcul de la taille moyenne des bougies sur l'historique récent
    const indexDebutRef = Math.max(0, i - 1 - periodeHistorique);
    let sommeHauteurs = 0;
    let sommeCorps = 0;
    let countRef = 0;
    for (let k = indexDebutRef; k < i - 1; k++) {
      sommeHauteurs += (bougies[k].high - bougies[k].low);
      sommeCorps += Math.abs(bougies[k].open - bougies[k].close);
      countRef++;
    }
    const moyHauteur = countRef > 0 ? (sommeHauteurs / countRef) : (b1.high - b1.low);
    const moyCorps = countRef > 0 ? (sommeCorps / countRef) : Math.abs(b1.open - b1.close);

    // Détection du Doji personnalisé
    const resultatDoji = verifierDojiSimple(b1, b2, moyHauteur, moyCorps, {
      activerAchat,
      activerVente,
      activerFiltreTaille,
      multiplicateurBougie1,
      multiplicateurCorps2,
      toleranceDeficit,
      toleranceDepassement,
    });

    if (!resultatDoji.estValide) continue;

    const estAchat = resultatDoji.type === 'ACHAT';
    if (estAchat) totalAchats++;
    else totalVentes++;

    // 4️⃣ Recherche de la bougie précédente créant le plus bas / plus haut
    const extremePrecedent = trouverBougieExtremePrecedente(
      bougies,
      i,
      resultatDoji.type,
      resultatDoji.prixExtreme,
      maxReculRecherche
    );

    const tempsDebutPlageMs = convertirTempsEnMs(extremePrecedent.temps);
    const tempsFinPlageMs = convertirTempsEnMs(b2.time);

    // 5️⃣ Sélection et filtrage des supports/résistances Shved dans cette plage
    const zonesDansPlage: ZoneShved[] = [];

    // 🎯 RÈGLE DE DIRECTION (Demandée par l'utilisateur) :
    // - Setup ACHAT (Spring) -> On affiche UNIQUEMENT les SUPPORTS
    // - Setup VENTE (UTAD)   -> On affiche UNIQUEMENT les RÉSISTANCES
    const typeZoneCible = estAchat ? 'SUPPORT' : 'RESISTANCE';

    for (const zone of toutesLesZonesShved) {
      // Filtrage par sens : ignore les résistances pour un achat, et les supports pour une vente
      if (filtrerParDirectionSetup && zone.type !== typeZoneCible) {
        continue;
      }

      if (zone.estCassee && parametres.afficherNiveauxCasses === false) continue;

      const dateDebutZoneMs = convertirTempsEnMs(zone.dateDebut);
      const dateFinZoneMs = convertirTempsEnMs(zone.dateFin);

      // 🧹 RÈGLE D'ÉPURATION TOTALE :
      // Affichage des S/R Shved UNIQUEMENT si le début ET la fin du S/R sont compris
      // à l'intérieur de la plage temporelle [tempsDebutPlage, tempsFinPlage].
      const debutComprisDansPlage = dateDebutZoneMs >= tempsDebutPlageMs && dateDebutZoneMs <= tempsFinPlageMs;
      const finCompriseDansPlage = dateFinZoneMs >= tempsDebutPlageMs && dateFinZoneMs <= tempsFinPlageMs;

      const estDansPlage = exigerDebutEtFinDansPlage
        ? (debutComprisDansPlage && finCompriseDansPlage)
        : (dateDebutZoneMs <= tempsFinPlageMs && dateFinZoneMs >= tempsDebutPlageMs);

      if (estDansPlage) {
        zonesDansPlage.push(zone);

        // Tracé du segment Shved épuré (continu ou discontinu selon la préférence)
        const estSupport = zone.type === 'SUPPORT';
        const couleurLigne = estSupport ? bullColor : bearColor;
        const styleChoisi = estSupport ? styleLignesSupport : styleLignesResistance;

        // Si bornerALaPlage est activé, la ligne est bornée strictement dans la fenêtre
        const dateDebutTracé = bornerALaPlage
          ? (dateDebutZoneMs < tempsDebutPlageMs ? extremePrecedent.temps : zone.dateDebut)
          : zone.dateDebut;

        const dateFinTracé = bornerALaPlage
          ? (dateFinZoneMs > tempsFinPlageMs ? b2.time : zone.dateFin)
          : zone.dateFin;

        lignes.push({
          id: `sandbox-sr-${zone.id}-doji-${i}`,
          prix: zone.prixMedian,
          dateDebut: dateDebutTracé,
          dateFin: dateFinTracé,
          couleur: couleurLigne,
          epaisseur: epaisseurLignes,
          style: styleChoisi, // 'solid' ou 'dashed'
        });
      }
    }

    // 6️⃣ Étiquette épurée du Doji sur le graphique
    const couleurSignal = estAchat ? bullColor : bearColor;
    const typeSRAffiche = estAchat ? 'Sup' : 'Res';
    const labelTexte = zonesDansPlage.length > 0
      ? `${texteLabel}\n(${zonesDansPlage.length} ${typeSRAffiche})`
      : texteLabel;

    labels.push({
      id: `sandbox-doji-lbl-${i}`,
      prix: resultatDoji.prixExtreme,
      date: b2.time,
      texte: labelTexte,
      couleur: couleurSignal,
      position: estAchat ? 'below' : 'above',
    });

    signaux.push({
      type: resultatDoji.type,
      indexBougie: i,
      temps: b2.time,
      prixExtreme: resultatDoji.prixExtreme,
      open1: b1.open,
      close2: b2.close,
      indexDebutPlage: extremePrecedent.index,
      tempsDebutPlage: extremePrecedent.temps,
      prixExtremePrecedent: extremePrecedent.prix,
      nombreNiveauxDansPlage: zonesDansPlage.length,
    });
  }

  return {
    signaux,
    primitives: { labels, lignes, boites: [], points: [] },
    statistiques: {
      totalSignaux: signaux.length,
      totalAchats,
      totalVentes,
    },
  };
}
